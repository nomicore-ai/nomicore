/**
 * hub-edge —— `HubReplicationEdge`：hub 侧**连接级半边**（ADR 0032 决策 1/2/3/4；设计 §7 D1~D6）。
 *
 * 职责：envelope/sequence 纪律（入站 expectedSeq 单点校验 + 出站 mux 点 `[8..12]` 盖章）、
 * HELLO 与 capability 协商、liveness、GOAWAY/reauth、连接级背压、OPEN 准入（authorize 在
 * 本半边单点真实调用 + admission 台账 + 结局经缝异步拉取）、帧路由键定偏移提取与三案路由、
 * drain 判定、五路收口。
 *
 * **进程内组合**（决策 1）：edge 只经 `HubSessionSink`（4 控制信号 + OPEN 到达点投递 + ns 帧
 * 投递 + facet 查询）与 session 半边交互——`'opening'` 行的通道 FSM 唯一实现在零 diff 的
 * `hub-namespace.ts`（本半边**零复现面**：无 fail-open/闩锁/窗口帧矩阵影子、无窗口日志、
 * 无结算段回放）。
 *
 * **OPEN 时序（D5.1，= HEAD 时序）**：首个 OPEN 全解码后，edge 在**同一同步段**内
 * ① `beginAdmission`（台账 + 唯一真实 authorize）→ ② `sink.openNamespace(message)` 无条件
 * 立即投递。次序 ①→② 是承重不变量：`startOpen` 的同步前缀在 ② 内同步调用
 * `port.openAdmission`，台账必须已存在（违反 → 响亮 reject → `INTERNAL_ERROR`）。
 * authorize 调用点较 HEAD（通道 `'opening'` 内）前移到通道创建之前——同一同步段内不可观察，
 * 且为拉取形态的结构前提（SA2 N3'）。
 */
import type { DuplexTransport } from './types.js';
import {
  CAP_CHUNKED_UPDATE,
  ENVELOPE_HEADER_BYTES,
  MESSAGE_TYPES,
  selectCapabilities,
  selectProtocolVersion,
  type ReplicationMessage,
} from '@nomicore/replication-protocol';
import { decodeInbound, connectionErrorFrame, namespaceErrorFrame, OutboundQueue } from './frame-io.js';
import { startLiveness } from './liveness.js';
import { ConnectionSender } from './backpressure.js';
import { dispatchReplicationObserver, safeNow, stableConnectionCode } from './observer.js';
import type { HubNamespaceChannel } from './hub-namespace.js';
import type {
  HubSendAccounting,
  HubSessionEdgePort,
  HubSessionSink,
  HubOpenAdmission,
  OpenNamespaceInbound,
} from './hub-split.js';
import type {
  HubConnectionState,
  NamespaceAuthorizer,
  ReplicationClock,
  ReplicationObserver,
  ReplicationTimer,
  ResolvedLimits,
  ResolvedTimeouts,
} from './types.js';

/** issue #243（DD-1.2）：hub 支持集（编译期冻结常量，源自 replication-protocol
 *  CAP_CHUNKED_UPDATE=0x1）。onHello 以 selectCapabilities(required, optional,
 *  SUPPORTED) 单点计算交集——hub 侧零配置门（ADR「取交集」字面）。 */
const HUB_SUPPORTED_CAPABILITIES = CAP_CHUNKED_UPDATE;

/** 空通道表（session 装配前的只读投影占位；恒空，非状态）。 */
const EMPTY_CHANNELS: ReadonlyMap<string, HubNamespaceChannel> = new Map();

/** namespaceId wire 形态：`ns-` + 32 小写 hex = 35 ASCII ⟹ varString 长度前缀恒 1 字节。 */
const NAMESPACE_ID_BYTES = 35;

/** UPDATE 帧头判定最小长度（`[20]` 前缀 + 35 字节 id + 载荷起点）；短于此即结构性非 UPDATE 形态。 */
const UPDATE_FRAME_MIN_BYTES = ENVELOPE_HEADER_BYTES + 1 + NAMESPACE_ID_BYTES;

/** edge 半边工厂配置（设计 §7 D1）。 */
export interface HubReplicationEdgeConfig {
  readonly transport: DuplexTransport;
  readonly timer: ReplicationTimer;
  /** 服务层 resolve+validate 后注入（校验留在组合根）。 */
  readonly limits: ResolvedLimits;
  readonly timeouts: ResolvedTimeouts;
  readonly observer?: ReplicationObserver;
  readonly clock?: ReplicationClock;
  /** hub 实例（HELLO 绑定）。 */
  readonly instanceId: string;
  /** 认证身份（authorize 键 + HELLO 恒等）。 */
  readonly peerInstanceId: string;
  /** connectionId 后缀（`${instanceId}-conn-${n}`）。 */
  readonly connectionCounter: number;
  /** 决策 3：宿主注入的授权器（C0a 测试注入桩；真实调用单点在本半边）。 */
  readonly authorize: NamespaceAuthorizer;
  /** §3.3 构造尾部重放（有界早到帧）。 */
  readonly earlyFrames: readonly Uint8Array[];
  /** session 对象生命周期归 edge（决策 3）。 */
  readonly sessionFactory: (port: HubSessionEdgePort) => HubSessionSink;
  /** cleanupAll 尾部回调（服务层 dropConnection）。 */
  readonly onConnectionDropped: () => void;
}

/** edge 半边对服务层的暴露面（`HubConnection` 公共面超集；设计 §7 D1）。 */
export interface HubReplicationEdge {
  readonly state: HubConnectionState;
  /** HELLO 前 undefined（事件可选字段语义保持）。 */
  readonly peerInstanceId: string | undefined;
  readonly authenticatedInstanceId: string;
  /** 通道表只读投影（唯一事实源在 session 半边；见 `HubSessionSink.channels`）。 */
  readonly channels: ReadonlyMap<string, HubNamespaceChannel>;
  close(code?: number, reason?: string): void;
  settle(): Promise<void>;
  beginReauth(): void;
  revokeNamespace(namespaceId: string): Promise<void>;
}

/** OPEN 准入台账记录（D5.1/D5.2）：一相、每 (连接, namespace) 至多一条，只增不减。 */
interface AdmissionRecord {
  /** 至多结算一次、除台账缺失外永不 reject（`throw` 结局以值承载）。 */
  readonly promise: Promise<HubOpenAdmission>;
}

/** 连接级协议错误 → WS close code（§14 粗分类）。 */
function wsCloseCodeFor(code: string): number {
  if (code === 'FRAME_TOO_LARGE') return 1009;
  if (code === 'INSTANCE_IDENTITY_MISMATCH' || code === 'CONNECTION_POLICY_VIOLATION') return 1008;
  return 1002;
}

/** ASCII 定偏移读取（路由键；ADR 0032 决策 4「O(帧头)、不解析 payload」）。 */
function asciiAt(bytes: Uint8Array, start: number, end: number): string {
  let out = '';
  for (let index = start; index < end; index += 1) out += String.fromCharCode(bytes[index]!);
  return out;
}

/** 大端读取 uint32（envelope `[8..12]` sequence / `[12..16]` payloadLength；与 codec
 *  `writeBe32` 同构的本地只读先例——`frame-io.ts:201-206` 的写侧同款分层）。 */
function readBe32At(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0
  );
}

/** lib0 canonical varUint 定偏移只读（≤5 字节，续位 `0x80`、7bit 组 LSB 先）。
 *  越界/续位超过 5 字节/非规范输入 → undefined（调用方按布局校验不过处置，零 throw）。 */
function readVarUintAt(bytes: Uint8Array, offset: number): Readonly<{ value: number; bytes: number }> | undefined {
  let value = 0;
  let scale = 1;
  for (let index = 0; index < 5; index += 1) {
    const position = offset + index;
    if (position >= bytes.byteLength) return undefined;
    const byte = bytes[position]!;
    value += (byte & 0x7f) * scale;
    scale *= 128;
    if ((byte & 0x80) === 0) return { value, bytes: index + 1 };
  }
  return undefined; // 续位未在 5 字节内终止 ⇒ 非规范 varUint（codec 产出面结构性不可达）
}

/** issue #423：UPDATE 帧的定偏移判定结果（`namespaceId` = 路由键、`updateBytes` = 载荷长度）。 */
interface UpdateFrameProbe {
  readonly namespaceId: string;
  readonly updateBytes: number;
}

class HubReplicationEdgeImpl implements HubReplicationEdge {
  state: HubConnectionState = 'handshaking';
  peerInstanceId: string | undefined;
  readonly authenticatedInstanceId: string;
  /** 协议 §6.2 专用 observability id（HELLO 完成时捕获；此前 undefined——事件可选字段）。 */
  private connectionIdValue: string | undefined;
  private readonly outbound: OutboundQueue;
  /** 连接级发送调度（§6.3；每连接实例一个，随 transport 生命周期）。 */
  private readonly sender: ConnectionSender;
  private expectedSeq = 1;
  private readonly helloHandle: unknown;
  private closedFlag = false;
  private settleTail: Promise<void> = Promise.resolve();
  /** 定向 reauthentication 的 GOAWAY drain 状态；Hub service close 不进入该窗口。 */
  private drainActive = false;
  private readonly transportSubscribers: Array<() => void> = [];
  private stopLiveness: (() => void) | undefined;
  /** issue #243（DD-1.2）：本连接的会话协商状态——onHello 单点计算后捕获（HELLO 前 0）。 */
  private negotiatedCapabilitiesValue = 0;
  /** issue #175：reauth 已发起（连接级幂等守卫）。 */
  private reauthRequested = false;
  /** issue #175：reauth drain deadline 句柄（§8 timer 纪律：必须可清）。 */
  private reauthDeadlineHandle: unknown | undefined;
  /** issue #244（D3）：连接级入站方向并发 assembly 槽位（listen 形态归 edge）。 */
  private readonly inboundAssemblySlots = new Set<string>();
  /** OPEN 准入台账（每连接；D5.1）——台账 ⟺ 首个 OPEN 已投递 ⟺ session 通道在场（锁步）。
   *  路由（D4b）与 drain 判定（D5.4）读本台账，不读 `sink.channels` 投影。 */
  private readonly admissions = new Map<string, AdmissionRecord>();
  /** D5.4 两量之一：经 `port.onChannelSettled` 通知的终态集（单调，每通道至多一次）。 */
  private readonly settledNames = new Set<string>();
  private sinkValue: HubSessionSink | undefined;
  /** 'close' 信号（幂等）：首次调用即执行同步 quiesce 前缀（全部收口路径在 transport.close 前）。 */
  private sinkClosePromise: Promise<void> | undefined;

  constructor(private readonly config: HubReplicationEdgeConfig) {
    this.authenticatedInstanceId = config.peerInstanceId;
    this.outbound = new OutboundQueue(
      (bytes) => {
        if (!config.transport.closed) config.transport.send(bytes);
      },
      config.limits,
      () => this.onSequenceExhausted(),
      (info) => this.sender.onEmitted(info),
    );
    this.sender = new ConnectionSender({
      limits: config.limits,
      timer: config.timer,
      ackTimeoutMs: config.timeouts.ackTimeoutMs,
      readBufferedAmount: () => this.readBufferedAmount(),
      emitControl: (message) => this.outbound.sendControl(message),
      emitData: (message) => this.outbound.emit(message),
      emitControlFrame: (frame) => this.outbound.sendControlFrame(frame),
      emitDataFrame: (frame) => this.outbound.emitFrame(frame),
      facetOf: (namespaceId) => this.sinkValue?.dataFacetOf(namespaceId),
      isEmitAllowed: () => !this.closedFlag,
      onBackpressureExhausted: () => this.connectionFatal('CONNECTION_BACKPRESSURE', 1011),
      onSendPaused: (bufferedAmount) => this.emitWaterEvent('send-paused', bufferedAmount),
      onSendResumed: (bufferedAmount) => this.emitWaterEvent('send-resumed', bufferedAmount),
    });
    this.sinkValue = config.sessionFactory(this.makePort());
    this.helloHandle = config.timer.setTimeout(() => {
      if (this.state === 'handshaking') {
        this.connectionFatal('HELLO_TIMEOUT', 1002);
      }
    }, config.timeouts.helloTimeoutMs);
    this.transportSubscribers.push(
      config.transport.onMessage((bytes) => this.onMessage(bytes)),
      config.transport.onClose(() => this.onTransportClosed()),
    );
    // 构造尾部重放（§3.3）：早到帧不绕过任何协议纪律——handshaking 态内非 HELLO 帧 →
    // HELLO_REQUIRED fatal；有界缓冲（≤16 帧）使重放同步段长度有界。
    for (const bytes of config.earlyFrames) {
      this.onMessage(bytes);
    }
  }

  private get sink(): HubSessionSink {
    const sink = this.sinkValue;
    if (sink === undefined) {
      // 构造期不变量破坏（session 未装配）——fail-loud，无静默 fallback
      throw new Error('hub-edge: session sink 未装配');
    }
    return sink;
  }

  /** 'close' 信号单点（D6）：幂等（重复调用返回同一 promise）；首次调用同步执行 session
   *  侧的 quiesce 前缀，异步尾汇入 `cleanupAll → settleTail → onConnectionDropped`。 */
  private requestSinkClose(): Promise<void> {
    this.sinkClosePromise ??= this.sink.close();
    return this.sinkClosePromise;
  }

  /** 通道表只读投影（session 持有唯一事实源；本 accessor 仅为既有白盒锚与 drain 观测）。 */
  get channels(): ReadonlyMap<string, HubNamespaceChannel> {
    return this.sinkValue?.channels ?? EMPTY_CHANNELS;
  }

  // ─────────────────────────────── 缝 port（edge 侧实现；D1/D6） ───────────────────────────────

  private makePort(): HubSessionEdgePort {
    return {
      openAdmission: (namespaceId) => this.openAdmission(namespaceId),
      sendControlFrame: (frame) => this.sender.sendControlFrame(frame),
      // issue #423（ADR 0032 决策 5）：`update-sent` 的**唯一发射点** = 本连接级 data 帧出面
      // （盖章事实所有者 = edge `OutboundQueue.emitOne` 的 `[8..12]` 单点）。单漏斗论证：
      // hub 侧全部 data 帧（session 组装路径 + UPDATE_CHUNK/分块族 + 宿主 egress 直驱）都
      // 经本成员，`seq > 0` 门保证「未发送/被拒 ⇒ 零事件」（与既有「seq>0 每帧恰一」同构）；
      // 原生 `dispatchReplicationObserver` 单点隔离不变（observer throw 零协议影响）。
      sendDataFrame: (frame, accounting) => {
        const sequence = this.sender.tryEmitDataFrame(frame);
        if (sequence > 0) this.emitUpdateSentAtStamp(frame, sequence, accounting);
        return sequence;
      },
      dataGateOpen: () => this.sender.dataGateOpen(),
      onDataQueued: (namespaceId) => this.sender.onDataQueued(namespaceId),
      requestDataDrain: () => this.sender.requestDrain(),
      chunkedUpdateNegotiated: () => this.isChunkedNegotiated(),
      connectionFatal: (code, wsCloseCode) => this.connectionFatal(code, wsCloseCode ?? 1002),
      onChannelSettled: (namespaceId) => this.onChannelSettled(namespaceId),
      // issue #244（D3）：连接级并发 assembly 准入——幂等（同 ns 已占槽恒 true；
      // 重复首 chunk 防御由 assembler 状态机承接）+ 满额拒纳（缺省 4 → 第 5 个 → VIOLATION）
      tryBeginInboundAssembly: (namespaceId) => {
        if (this.inboundAssemblySlots.has(namespaceId)) return true;
        if (
          this.inboundAssemblySlots.size >=
          this.config.limits.maxConcurrentAssembliesPerConnection
        ) {
          return false;
        }
        this.inboundAssemblySlots.add(namespaceId);
        return true;
      },
      endInboundAssembly: (namespaceId) => {
        this.inboundAssemblySlots.delete(namespaceId); // 幂等（重复 clear/多挂点汇合零副作用）
      },
      observerPresent: () => this.connectionObserver() !== undefined,
      emitObserver: (event) => dispatchReplicationObserver(this.connectionObserver(), event),
      connectionId: () => this.connectionIdValue,
      connectionState: () => this.state,
      bufferedAmount: () => this.observableBufferedAmount(),
      // B1：时钟采样经 safeNow 折叠（throw → dormant undefined，零协议外溢）
      now: () =>
        this.connectionObserver() !== undefined
          ? safeNow(() => this.config.clock?.now())
          : undefined,
    };
  }

  // ─────────────────────────────── 生命周期（服务面） ───────────────────────────────

  close(code?: number, reason?: string): void {
    if (this.closedFlag) return;
    this.closedFlag = true;
    this.setConnState('closed');
    this.clearDrainHandles(); // §4.6 路径 1：窗口期公共 close = force-close 逃生舱
    this.sender.teardown(); // §8：poll timer 清零（连接收口必经点）
    void this.requestSinkClose(); // 同步 quiesce 前缀（全通道；transport.close 之前）
    if (!this.config.transport.closed) {
      this.config.transport.close(code ?? 1001, reason ?? 'hub-close');
    }
    void this.cleanupAll();
  }

  /** issue #175 AC1/AC2/AC4：定向 reauth——GOAWAY(REAUTH_REQUIRED, drain>0) + deadline 后
   *  1001 收口。幂等（reauthRequested）；迟到/竞态（closedFlag）零副作用；绝不携带凭据。 */
  beginReauth(): void {
    if (this.closedFlag || this.reauthRequested) return;
    this.reauthRequested = true;
    if (this.state === 'handshaking') {
      // GOAWAY-before-ACK 是协议伤害：peer handshaking 门对非 HELLO_ACK 帧判
      // CONNECTION_POLICY_VIOLATION——handshaking 分支不发 GOAWAY，直接 close(1001)。
      this.close(1001, 'hub-reauth');
      return;
    }
    this.drainActive = true;
    this.state = 'draining'; // 连接级可观测迁移；**直赋保留**（不发射 connection-state-changed，D8/L1）
    try {
      this.outbound.sendControl({ // 收口路径直发豁免（同 connectionFatal 家族）
        kind: 'GOAWAY', // 生命周期控制帧不允许被 data 背压额度否决
        reasonCode: 'REAUTH_REQUIRED', // 稳定安全码，零凭据字段（AC7）
        drainTimeoutMs: this.config.timeouts.closeTimeoutMs, // drain 预算载体（§4.3）
      });
    } catch {
      this.close(1001, 'hub-reauth'); // framing 不可信 → fail-closed 直接收口
      return;
    }
    this.reauthDeadlineHandle = this.config.timer.setTimeout(() => {
      this.reauthDeadlineHandle = undefined;
      if (this.closedFlag) return; // transport 断/hub.close 已收口 → stale fire 零副作用
      this.close(1001, 'hub-reauth'); // 既有收口拓扑：teardown + quiesce + close + cleanupAll + drop
    }, this.config.timeouts.closeTimeoutMs);
  }

  /** §5.1 revoke 链第二层（D5.5）：**无条件**投递——窗口期通道已在场（`'opening'`），
   *  HEAD 的 `terminateUnauthorized()` 响亮终结；无通道/quiet 态 → session 侧无副作用 resolve。 */
  revokeNamespace(namespaceId: string): Promise<void> {
    return this.sink.terminateNamespace(namespaceId);
  }

  /** 全部通道 cleanup 结算（HubReplication.close 等待）。 */
  settle(): Promise<void> {
    return this.settleAfterClose();
  }

  private async settleAfterClose(): Promise<void> {
    await Promise.resolve();
    await this.settleTail;
  }

  // ─────────────────────────────── OPEN 准入管线（决策 3；D5） ───────────────────────────────

  /**
   * 首个 OPEN 的**到达点**处理（D5.1，= HEAD `onOpenNamespace` :880-894 时序）：
   * ① 无台账记录 → `beginAdmission`（台账 + 唯一真实 authorize，**先于**投递）；
   * ② **无条件立即投递** `sink.openNamespace(message)`（admission 结局无关）——session 同步建
   * 通道 + `startOpen`，`startOpen` 的同步前缀在 ② 内同步拉取 ① 的台账。
   * 已投递（台账命中）的再 OPEN 只投递 → 通道 `onOpen` 重开矩阵（零 authorize）。
   */
  private onOpenNamespace(message: OpenNamespaceInbound): void {
    if (!this.admissions.has(message.namespaceId)) {
      this.beginAdmission(message.namespaceId); // ① 台账必须已存在（② 内 shim 同步拉取）
    }
    this.sink.openNamespace(message); // ② 到达点投递
  }

  /**
   * 每 (连接, namespace) 首次 OPEN 的准入发起（D5.2）：**唯一真实 authorize 调用点**（C2c/C2d：
   * 入参 = HEAD `host.authorize(host.peerInstanceId(), nsId)` 逐值）。台账记录先于 authorize
   * 调用写入（同步 throw 角落也满足 shim 的拉取前提）；结局映射 = HEAD `!ok ∨ !read` 单分支
   * 折叠；同步 throw 与异步拒绝同归 `throw` 结局（= HEAD async IIFE try 语义；`Promise.resolve`
   * 包裹使非 thenable 返回值的类型违约宿主落到同一 `throw` 结局，SA2 N1'）。
   * 结算无条件传播（`.then` 闭包独立于连接状态，D5.6/H1：迟归续体的 lease 回收依赖此）。
   */
  private beginAdmission(namespaceId: string): void {
    let settle: (admission: HubOpenAdmission) => void = () => undefined;
    const promise = new Promise<HubOpenAdmission>((resolve) => {
      settle = resolve;
    });
    this.admissions.set(namespaceId, { promise });
    try {
      void Promise.resolve(this.config.authorize(this.authenticatedInstanceId, namespaceId)).then(
        (authorization) => {
          settle(
            authorization.ok && authorization.permissions.read
              ? { outcome: 'authorized', authorization } // ok-投影完整传递（localOwner/permissions）
              : { outcome: 'denied' }, // HEAD `!authz.ok || !read` 单分支折叠（:355-359）
          );
        },
        () => {
          settle({ outcome: 'throw' });
        },
      );
    } catch {
      settle({ outcome: 'throw' }); // 同步 throw 同样吸收（台账已写入，shim 后挂 .then 语义良好）
    }
  }

  /** `port.openAdmission`（D5.3 拉取面）：台账缺失 = 不变量破坏 → 响亮 reject（无静默 fallback）。 */
  private openAdmission(namespaceId: string): Promise<HubOpenAdmission> {
    const record = this.admissions.get(namespaceId);
    if (record === undefined) {
      return Promise.reject(new Error('hub-edge: open admission record missing'));
    }
    return record.promise;
  }

  // ─────────────────────────────── 入站管线（D4） ───────────────────────────────

  private onMessage(bytes: Uint8Array): void {
    if (this.closedFlag) return;
    let decoded: { header: { sequence: number }; message: ReplicationMessage };
    try {
      decoded = decodeInbound(bytes, {
        expectedSequence: this.expectedSeq,
        maxFrameBytes: this.config.limits.maxFrameBytes,
        // issue #243（DD-1.4）：decode 门控透传——握手期 0，ready 后 = onHello 捕获的
        // selectCapabilities 交集结果。
        selectedCapabilities: this.negotiatedCapabilitiesValue,
      });
    } catch (err) {
      const code = (err as { code?: string }).code ?? 'MALFORMED_FRAME';
      this.connectionFatal(code, wsCloseCodeFor(code));
      return;
    }
    this.expectedSeq = decoded.header.sequence + 1;
    const message = decoded.message;
    if (this.state === 'handshaking') {
      if (message.kind === 'HELLO') {
        this.onHello(message);
        return;
      }
      this.connectionFatal('HELLO_REQUIRED', 1002);
      return;
    }
    // GOAWAY drain 开始后仍需分发到 drain 专用门：它只保留自然 CLOSE/CLOSE_OK、
    // 已接纳 apply 的必要 ACK 与 ERROR 收口；其余 namespace frame 不再进入 channel。
    this.dispatchReady(message, decoded.header.sequence, bytes);
  }

  private onHello(message: {
    peerInstanceId: string;
    expectedHubInstanceId: string;
    protocolVersions: number[];
    requiredCapabilities: number;
    optionalCapabilities: number;
    connectionNonce: Uint8Array;
  }): void {
    if (this.state !== 'handshaking') {
      this.connectionFatal('CONNECTION_POLICY_VIOLATION', 1008);
      return;
    }
    // D2（§4）：HELLO 自声明身份必须等于认证身份（token 绑定的可信身份，一层↔二层绑定）
    if (message.peerInstanceId !== this.authenticatedInstanceId) {
      this.connectionFatal('INSTANCE_IDENTITY_MISMATCH', 1008);
      return;
    }
    if (message.expectedHubInstanceId !== this.config.instanceId) {
      this.connectionFatal('INSTANCE_IDENTITY_MISMATCH', 1008);
      return;
    }
    const version = selectProtocolVersion(message.protocolVersions, [1]);
    if (version === null) {
      this.connectionFatal('UNSUPPORTED_PROTOCOL_VERSION', 1002);
      return;
    }
    const negotiated = selectCapabilities(
      message.requiredCapabilities,
      message.optionalCapabilities,
      HUB_SUPPORTED_CAPABILITIES,
    );
    if (!negotiated.ok) {
      this.connectionFatal('UNSUPPORTED_CAPABILITY', 1002);
      return;
    }
    this.negotiatedCapabilitiesValue = negotiated.selected;
    this.peerInstanceId = this.authenticatedInstanceId;
    this.connectionIdValue = `${this.config.instanceId}-conn-${this.config.connectionCounter}`;
    this.setConnState('ready');
    if (this.config.transport.ping !== undefined && this.config.transport.onPong !== undefined) {
      this.stopLiveness = startLiveness({
        timer: this.config.timer,
        pingIntervalMs: this.config.timeouts.pingIntervalMs,
        pongTimeoutMs: this.config.timeouts.pongTimeoutMs,
        ping: this.config.transport.ping,
        onPong: this.config.transport.onPong,
        // issue #238 §6（H1 判别探针）：observer + clock + ping/onPong 三者齐备才武装。
        ...(this.config.clock !== undefined && this.connectionObserver() !== undefined
          ? {
              delayProbe: {
                now: () =>
                  this.connectionObserver() !== undefined
                    ? safeNow(() => this.config.clock?.now())
                    : undefined,
                sample: (delayMs) => {
                  const observer = this.connectionObserver();
                  if (observer === undefined) return;
                  dispatchReplicationObserver(observer, {
                    type: 'event-loop-delay-sampled',
                    side: 'hub',
                    ...(this.connectionIdValue !== undefined
                      ? { connectionId: this.connectionIdValue }
                      : {}),
                    delayMs,
                  });
                },
              },
            }
          : {}),
        // issue #170 R1：pong 超时 = §18 L524 临时失败——close(1001)、零 ERROR 帧
        onPongTimeout: () => this.onLivenessLost(),
      });
    }
    // N1：§16 行 1「HELLO_ACK 解除」——HELLO 握手完成的同步段解除 hello timer
    this.config.timer.clearTimeout(this.helloHandle);
    const connectionId = `${this.config.instanceId}-conn-${this.config.connectionCounter}`;
    this.sendControlChecked({
      kind: 'HELLO_ACK',
      hubInstanceId: this.config.instanceId,
      protocolVersion: version,
      selectedCapabilities: this.negotiatedCapabilitiesValue,
      connectionNonce: message.connectionNonce,
      connectionId,
    });
  }

  /**
   * ready 态分派（全序与 HEAD `onMessage → dispatchReady` 一致）：drain 门 → 方向纪律 →
   * OPEN 管线 / 定偏移路由（D4b 三案：R-delivered / R-none / R-violation）。
   */
  private dispatchReady(message: ReplicationMessage, sequence: number, bytes: Uint8Array): void {
    if (this.drainActive) {
      switch (message.kind) {
        case 'OPEN_NAMESPACE':
          // REAUTH_REQUIRED 窗口零响应，避免认证失效后泄露 namespace 观测。
          return;
        case 'BOOTSTRAP_ACK':
        case 'SYNC_STEP1':
        case 'SYNC_STEP2':
        case 'RESYNC_REQUIRED':
        case 'UPDATE':
        case 'UPDATE_CHUNK':
          // 同列——reauth drain 窗口不得进入 channel（防注入在 drain 期开新 assembly）。
          // 门先于一切 ns 路由：被门丢弃的帧不入窗口日志（与 HEAD 到不了 withChannel 同构）。
          return;
        default:
          break;
      }
    }
    switch (message.kind) {
      case 'HELLO':
      case 'HELLO_ACK':
      case 'OPEN_OK':
      case 'BOOTSTRAP_SNAPSHOT':
      case 'IDENTITY_CHANGED':
      case 'GOAWAY':
        // 方向纪律（R2.1 澄清）：hub 收到 hub→peer 方向专用帧 → 连接策略拒绝（§6）
        this.connectionFatal('CONNECTION_POLICY_VIOLATION', 1008);
        return;
      case 'OPEN_NAMESPACE':
        this.onOpenNamespace(message);
        return;
      case 'ERROR': {
        // I5 原样：ERROR 无 nsId / 未知 ns（无台账记录）→ 静默丢弃（不进 R-none）
        if (message.namespaceId === undefined) return;
        if (!this.admissions.has(message.namespaceId)) return;
        this.sink.namespaceFrame(message, sequence); // R-delivered
        return;
      }
      default: {
        // 定偏移路由键（决策 4；O(帧头)、不从解码对象取）
        const namespaceId = this.routingKeyOf(message, bytes);
        if (namespaceId === undefined) {
          // 结构不变量破坏（codec 字段序/偏移守卫测试覆盖）→ 响亮收口，绝不静默误路由
          this.connectionFatal('MALFORMED_FRAME', wsCloseCodeFor('MALFORMED_FRAME'));
          return;
        }
        if (!this.admissions.has(namespaceId)) {
          this.synthesizeNamespaceStateViolation(namespaceId); // R-none（逐符号迁移 withChannel 未知 ns 分支）
          return;
        }
        // R-delivered：台账命中 ⟺ 首个 OPEN 已投递 ⟺ session 通道在场（authorize 在途亦然）
        // ——到达点即时投递，零缓冲（D4b/D5.1；§2.2 窗口矩阵由零 diff 通道原生产出）
        this.sink.namespaceFrame(message, sequence);
        return;
      }
    }
  }

  /**
   * 路由键定偏移只读提取（ADR 0032 决策 4）：标准 namespace 域帧 id 窗口 `[21,56)`、前缀
   * `[20]`；UPDATE_CHUNK（kind 首字段在 payload 首字节）id 窗口 `[22,57)`、前缀 `[21]`。
   * 解码值只作**结构一致性断言**（守卫测试同源），路由键唯一来源是帧字节。
   */
  private routingKeyOf(message: ReplicationMessage, bytes: Uint8Array): string | undefined {
    const isChunk = message.kind === 'UPDATE_CHUNK';
    const prefixIndex = isChunk ? 21 : 20;
    const start = isChunk ? 22 : 21;
    const end = start + NAMESPACE_ID_BYTES;
    if (bytes.byteLength < end || bytes[prefixIndex] !== NAMESPACE_ID_BYTES) return undefined;
    const key = asciiAt(bytes, start, end);
    const decoded = 'namespaceId' in message ? message.namespaceId : undefined;
    return key === decoded ? key : undefined;
  }

  /** R-none：无 entry 分支逐符号迁移（合成 ns ERROR + `namespace-error{sent}` 观测）。 */
  private synthesizeNamespaceStateViolation(namespaceId: string): void {
    try {
      this.sendControlChecked(namespaceErrorFrame('NAMESPACE_STATE_VIOLATION', namespaceId));
    } catch {
      // 连接已收口；忽略
    }
    if (this.connectionObserver() !== undefined) {
      dispatchReplicationObserver(this.connectionObserver(), {
        type: 'namespace-error',
        side: 'hub',
        ...(this.connectionIdValue !== undefined ? { connectionId: this.connectionIdValue } : {}),
        namespaceId,
        code: 'NAMESPACE_STATE_VIOLATION',
        direction: 'sent',
      });
    }
  }

  // ─────────────────────────────── 收口（五路同构；D8/L1/L2） ───────────────────────────────

  private onTransportClosed(): void {
    if (this.closedFlag) return;
    this.closedFlag = true;
    this.setConnState('closed');
    this.clearDrainHandles(); // §4.6 路径 2：对端已关 = 窗口无服务对象
    this.sender.teardown();
    void this.cleanupAll();
  }

  private async cleanupAll(): Promise<void> {
    // issue #175：reauth deadline 句柄单点清理（覆盖全部收口路径——§8.1 timer 纪律）
    if (this.reauthDeadlineHandle !== undefined) {
      this.config.timer.clearTimeout(this.reauthDeadlineHandle);
      this.reauthDeadlineHandle = undefined;
    }
    // 'close' 信号：同步 quiesce 前缀（幂等——多数路径已在 transport.close 前调用）+ 异步尾
    this.settleTail = this.requestSinkClose().then(() => undefined);
    this.stopLiveness?.();
    this.stopLiveness = undefined;
    for (const off of this.transportSubscribers.splice(0)) off();
    // D5.6：台账不摘除（迟归 authorize 结算照常传播——通道经 sink.close() 收口 / H1 回收）
    try {
      await this.settleTail;
      this.config.onConnectionDropped();
    } finally {
      // cleanupAll 的 settleTail 在异常路径也已归一化，由 Hub close 等待。
    }
  }

  private connectionFatal(code: string, wsCloseCode: number): void {
    if (this.closedFlag) return;
    this.clearDrainHandles(); // §4.6 路径 3（R2-M1）：drain 期 fatal 不留 timer 残留
    this.sender.teardown();
    try {
      // §4.3 豁免（R2，SA2 #2）：收口 ERROR 直发 outbound——绕过 sender 额度判据；收口路径零递归。
      this.outbound.sendControl(connectionErrorFrame(code));
    } catch {
      // best-effort；framing 已不可信
    }
    this.closedFlag = true;
    this.setConnState('closed');
    void this.requestSinkClose(); // 同步 quiesce 前缀（transport.close 之前）
    if (!this.config.transport.closed) {
      this.config.transport.close(wsCloseCode, 'protocol-error');
    }
    if (this.connectionObserver() !== undefined) {
      dispatchReplicationObserver(this.connectionObserver(), {
        type: 'connection-failed',
        side: 'hub',
        ...(this.connectionIdValue !== undefined ? { connectionId: this.connectionIdValue } : {}),
        code: stableConnectionCode(code),
        wsCloseCode,
      });
    }
    void this.cleanupAll();
  }

  /**
   * 活性失联（临时类，协议 L524/§14/L42）：零 ERROR 帧——该错误码不在 connection
   * 错误注册表（§13.1 append-only）；close(1001) + 与 connectionFatal 同构的收口拓扑
   *（ready → closed **直赋**；不发射 connection-state-changed，D8/L1）。
   */
  private onLivenessLost(): void {
    if (this.closedFlag) return; // 重入守卫（与 connectionFatal 同构）
    this.sender.teardown(); // §8：poll timer 清零（连接收口必经点）
    this.closedFlag = true; // 先置位：close 触发的 onClose 命中 onTransportClosed 早退
    this.state = 'closed'; // 直赋保留（L1）；reauth deadline 句柄由 cleanupAll 清理
    void this.requestSinkClose(); // 同步 quiesce 前缀
    if (!this.config.transport.closed) {
      this.config.transport.close(1001, 'pong-timeout');
    }
    void this.cleanupAll();
  }

  /** §4.1 R3/#11：出站 uint32 耗尽（实践不可达）→ 直接 close(1008)，零出站帧。 */
  private onSequenceExhausted(): void {
    if (this.config.transport.closed) return;
    this.clearDrainHandles(); // §4.6 路径 4（R2-M1）：drain 期序列耗尽不留 timer 残留
    this.sender.teardown();
    if (!this.config.transport.closed) {
      this.config.transport.close(1008, 'sequence-exhausted');
    }
    this.closedFlag = true;
    this.setConnState('closed');
    if (this.connectionObserver() !== undefined) {
      dispatchReplicationObserver(this.connectionObserver(), {
        type: 'connection-failed',
        side: 'hub',
        ...(this.connectionIdValue !== undefined ? { connectionId: this.connectionIdValue } : {}),
        code: 'OUTBOUND_SEQUENCE_EXHAUSTED',
        wsCloseCode: 1008,
      });
    }
    void this.cleanupAll();
  }

  // ─────────────────────────────── drain（D5.4） ───────────────────────────────

  /** 通道终态一次性通知（session→edge 'settled' 信号）：记 settled + 判定提前完成。 */
  private onChannelSettled(namespaceId: string): void {
    this.settledNames.add(namespaceId);
    this.maybeFinishDrainEarly();
  }

  /**
   * issue #174 §4.3 / 设计 D5.4：drain 窗口提前完成观测——判定式
   * `∀ nsId ∈ admissions.keys(): nsId ∈ settledNames`（仅在 settled 信号上执行，与 HEAD
   * `onChannelSettled` 唯一触发点同构）。
   *
   * 同构论证：台账 keys ≡ 已投递 ns 集（D5.1 锁步 + D4b 路由事实源），`'opening'` 通道
   * （authorize 在途）⟺ 非终态 ⟺ 未 settled（I12）⇒ 天然阻塞——HEAD `maybeFinishDrainEarly`
   * 对 `'opening'`/`'closing'` 的阻塞案被**包含式收编**，无需独立 pending 集（两量单调：
   * 台账只增不减；settled 每通道至多一次）。空台账 ⟺ HEAD 空通道表：两侧都等 deadline。
   */
  private maybeFinishDrainEarly(): void {
    if (!this.drainActive || this.closedFlag) return; // 非 drain 零开销；closedFlag 为第二道闸
    for (const namespaceId of this.admissions.keys()) {
      if (!this.settledNames.has(namespaceId)) return; // 含 authorize 在途的 'opening' 通道
    }
    this.finishDrain(); // 全部已投递 ns 终态（或空）→ 提前收口
  }

  /** issue #174 §4.4：drain 收口点——deadline/提前完成/对端关三入口合流（幂等）。
   *  deadline fire 时【不检查任何 channel/apply 状态】——不等待未完成网络 ACK（AC4）。 */
  private finishDrain(): void {
    if (this.closedFlag || !this.drainActive) return;
    this.clearDrainHandles();
    this.close(1001, 'hub-reauth');
  }

  /** issue #174 §4.6-R2 单点：drain 复位 + deadline 句柄清理。幂等；四条连接终结路径共用。 */
  private clearDrainHandles(): void {
    this.drainActive = false;
  }

  // ─────────────────────────────── 发送 / 观测（连接级） ───────────────────────────────

  private sendControlChecked(message: ReplicationMessage): number {
    // §4.3：保留额度判据在 sender.sendControl 单点（收口路径直发 outbound 豁免）。
    return this.sender.sendControl(message);
  }

  /** issue #243（DD-1.5）：wire 协商交集位判据（发送门与 decode 门共用同一判据）。 */
  private isChunkedNegotiated(): boolean {
    return (this.negotiatedCapabilitiesValue & CAP_CHUNKED_UPDATE) !== 0;
  }

  /** §4.2 鸭子类型读取 transport.bufferedAmount（属性形态；缺失/非法 → 0=无压力）。 */
  private readBufferedAmount(): number {
    return this.observableBufferedAmount() ?? 0;
  }

  /** issue #231 观测口径：与 §4.2 同一鸭子类型读取，但「缺面/非法」映射为 undefined。 */
  private observableBufferedAmount(): number | undefined {
    try {
      const level = (this.config.transport as { readonly bufferedAmount?: unknown }).bufferedAmount;
      return typeof level === 'number' && Number.isFinite(level) ? level : undefined;
    } catch {
      return undefined; // seam 契约：transport 契约是「number 属性或缺失」；非契约形态 = 不可观测
    }
  }

  /** H10：hub 连接 FSM 唯一迁移点（带事件；同态早退——边沿 exactly-once）。
   *  两处**有意的无事件直赋**（beginReauth 的 'draining'、onLivenessLost 的 'closed'）
   *  不在此列（D8/L1 保留义务）。 */
  private setConnState(next: HubConnectionState): void {
    if (this.state === next) return;
    const from = this.state;
    this.state = next;
    if (this.connectionObserver() !== undefined) {
      dispatchReplicationObserver(this.connectionObserver(), {
        type: 'connection-state-changed',
        side: 'hub',
        ...(this.connectionIdValue !== undefined ? { connectionId: this.connectionIdValue } : {}),
        from,
        to: next,
      });
    }
  }

  private connectionObserver(): ReplicationObserver | undefined {
    return this.config.observer;
  }

  /** H15：连接级水位边沿事件（send-paused / send-resumed）。 */
  private emitWaterEvent(type: 'send-paused' | 'send-resumed', bufferedAmount: number): void {
    const observer = this.connectionObserver();
    if (observer === undefined) return;
    dispatchReplicationObserver(observer, {
      type,
      side: 'hub',
      ...(this.connectionIdValue !== undefined ? { connectionId: this.connectionIdValue } : {}),
      bufferedAmount,
    });
  }

  /**
   * issue #423（ADR 0032 决策 5；协议 §23.1 `update-sent` 行）：
   * **edge 盖章点单点发射**——出站 UPDATE 帧实际出站后（序已分配）恰一事件。
   *
   * - 首行 observer 门：无 observer ⇒ 零构造、零字段读取、零判定（§23.4 热路径纪律）；
   * - 型门 + 定偏移判定（`updateFrameProbe`）：非 UPDATE（含 UPDATE_CHUNK 0x42 与一切经
   *   data 面出站的其它型）与布局校验不过一律 dormant 零事件（决策 4「O(帧头)、不解析
   *   payload」；观测面失败绝不改变协议结果——§23.4）；
   * - 字段：`sequence` = `[8..12]` 盖章返回值（同点派生）；`bytes` = 出站 UPDATE 载荷长度；
   *   `namespaceId` = 帧路由键（防缝上投影说谎——同一代码路径同时服务 session 帧与宿主
   *   直驱帧）；`sendQueueMs` 仅记账投影在场时携带（缺面 = 整键缺席，非 0）。
   */
  private emitUpdateSentAtStamp(
    frame: Uint8Array,
    sequence: number,
    accounting?: HubSendAccounting,
  ): void {
    if (this.connectionObserver() === undefined) return;
    const probe = updateFrameProbe(frame);
    if (probe === undefined) return; // 型门/布局校验不过 ⇒ dormant（零 throw、零事件）
    dispatchReplicationObserver(this.connectionObserver(), {
      type: 'update-sent',
      side: 'hub',
      ...(this.connectionIdValue !== undefined ? { connectionId: this.connectionIdValue } : {}),
      namespaceId: probe.namespaceId,
      bytes: probe.updateBytes,
      sequence,
      ...(accounting?.sendQueueMs !== undefined ? { sendQueueMs: accounting.sendQueueMs } : {}),
    });
  }
}

/**
 * issue #423：UPDATE 帧定偏移判定（ADR 0032 决策 4 的扩展适用 + 长度交叉校验）。
 *
 * 布局（与 codec 字段序的同步维护契约；守卫测试 = `ws-replication-issue423-update-offset-guard`）：
 * `[5]` = messageType（UPDATE = 0x40）、`[12..16]` = payloadLength、
 * payload = `varString(namespaceId)`（35 字节 ASCII ⟹ 前缀恒 1 字节，id 窗口 `[21,56)`）
 * + `varUint8Array(update)`（varUint 长度前缀自 `[56]` 起）。
 *
 * 判定 ⟹ `payloadLength === 1 + 35 + varUint 字节数 + updateLen` 且
 * `frame.byteLength === 20 + payloadLength`（两式同时成立才算结构自洽）。
 * 返回 undefined = 非 UPDATE 形态或布局不自洽（正常路径不可达：到达本面的 UPDATE 帧由
 * `encodeMessage` 产出，畸形输入在编码期响亮 throw，先于任何字节出站）。
 */
function updateFrameProbe(frame: Uint8Array): UpdateFrameProbe | undefined {
  if (frame.byteLength < UPDATE_FRAME_MIN_BYTES || frame[5] !== MESSAGE_TYPES.UPDATE) {
    return undefined; // 短帧 / 非 UPDATE 型（UPDATE_CHUNK 0x42、控制帧结构性不触达本面）
  }
  if (frame[20] !== NAMESPACE_ID_BYTES) return undefined; // 路由键长度前缀不符（窗口契约破坏）
  const payloadLength = readBe32At(frame, 12);
  if (frame.byteLength !== ENVELOPE_HEADER_BYTES + payloadLength) return undefined;
  const prefix = readVarUintAt(frame, ENVELOPE_HEADER_BYTES + 1 + NAMESPACE_ID_BYTES);
  if (prefix === undefined) return undefined;
  if (payloadLength !== 1 + NAMESPACE_ID_BYTES + prefix.bytes + prefix.value) return undefined;
  return {
    namespaceId: asciiAt(frame, ENVELOPE_HEADER_BYTES + 1, ENVELOPE_HEADER_BYTES + 1 + NAMESPACE_ID_BYTES),
    updateBytes: prefix.value,
  };
}

/** 工厂：edge 半边可独立实例化（注入 transport/authorize/sessionFactory；无 Registry 依赖）。 */
export function createHubReplicationEdge(config: HubReplicationEdgeConfig): HubReplicationEdge {
  return new HubReplicationEdgeImpl(config);
}
