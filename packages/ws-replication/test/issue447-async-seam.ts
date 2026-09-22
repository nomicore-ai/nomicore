/**
 * issue #447 —— γ 异步缝验收夹具（**test-only**；ADR 0032 附录 A4.1–A4.8 / 协议 §24；
 * 设计 §8.7/§8.8）。
 *
 * 拓扑（无 socket、**零 worker_threads / MessageChannel / MessagePort / 真实 timer**——
 * A4.8 验收纪律；异步性 = 宿主侧显式释放的 FIFO 通道）：
 *
 *   脚本注入端 / 真 peer（`createPeerReplication`）
 *        │  wire: Uint8Array 帧（20 字节 envelope，[8..12] = 出站序）
 *        ▼
 *   ingress = 公共 `createHubReplicationEdge`（连接级 FSM 单份真身）
 *        │  resolveSessionSink(connectionKey, namespaceId, grant)     ← 缝下行：纯 JSON 描述子
 *        ▼
 *   宿主桥（本文件：字节/JSON 中继 + 信号搬运 + **回执条款**，零协议决策）
 *        │  sessionToEdge: frame{tag,bytes,lane} / settled / connection-fatal
 *        │  edgeToSession: frame{bytes} / receipt{tag,sequence} / close / terminateUnauthorized
 *        ▼
 *   worker 侧 = 公共 `createHubAsyncSessionHost`（γ 第三 port 形态；真 Registry/Runtime）
 *
 * 交付物边界（夹具头注登记，镜像 #424 §8.1–§8.3 纪律）：
 *
 * 1. **非规范宿主样例**：真宿主（nomic-server ingress/worker）的传输、连接登记与生命周期
 *    由宿主自定；本夹具只证明公共面足以装配出异步缝形态。桥只做中继与信号搬运：不合成
 *    应答帧、不选错误码、不缓冲/重排/重试、不复制准入管线（全部为 edge/session 既有职责）。
 * 2. **回执条款（A4.2/§24.2.3）**：桥在 edge egress 返回值的**同一同步段**把
 *    `receipt{tag, sequence}` 入队 edgeToSession；同通道 FIFO ⇒ 序回执必先于引用它的
 *    ACK 被 session 消费。`egress` 返回 ≤ 0（帧未盖章）⇒ **不投回执**（receipt 只承载
 *    盖章事实）——该 tag 停留 pending，由 ackTimeout 有界兜底（§8.6.1/§9.1）。
 * 3. **SD-2(a) 单点登记权威**：`accept/acceptTrusted` 是唯一 `connectionKey → connection`
 *    登记点（返回后第一动作即写入）；`resolveSessionSink` 只从该表取 egress，取不到即抛
 *    （无静默兜底）。时序确定性依据同 #424 头注 2。
 * 4. **SD-3 每场景一工厂**：`makeAsyncReplicationFacade` 内部构造**恰一个** edge 工厂 +
 *    **恰一个** γ 会话宿主，`instanceId` 钉死 `HUB_INSTANCE`；同场景第二条连接复用同一
 *    工厂（`-conn-0/-conn-1` 键天然互异）；误用由 `open()` 重复键响亮 throw 守卫。
 * 5. **boot 形态 registry 同一性约束（设计 §8.3.1）**：facade 把 `options.registry` /
 *    `options.timer` / `options.limits` / `options.timeouts` / `options.observer` /
 *    `options.clock` **结构性采纳**为 γ 会话宿主与 edge 工厂的配置（错位装配在签名面不可
 *    表达）；ROUND/CHUNK 每形态 boot 后另有引用同一性前提断言。
 * 6. **显式释放（PIPE-C2）**：`enqueue` 同步入队零投递；`release(count?)` 才按 FIFO 同步
 *    搬运给消费者（`release()` = 全部，`release(n)` = 恰 n 条——PEND-C2 的「只放回执、未放
 *    ACK」中间态断言面）；`pending()`/`delivered()`/`dropped()` 为断言面。零真实 timer /
 *    零 wall-clock：投递只发生在显式 release 同步段（pumpUntil 的 await 只排空微任务）。
 * 7. **故障注入旋钮**（负控敏感性；#420 `suppressSequenceReturn` 先例）：
 *    `reorderNext`（下一次 release 交换前两条）/ `dropReceipts(n)`（丢弃前 n 条 receipt）/
 *    `withholdEdgeToSession`（扣留 edge→session 投递 = 缝扣留延迟注入面）。
 * 8. **中继保真**：`HubAsyncSessionFrame.bytes` 为 session 侧 `sequence=0` 占位编码原字节，
 *    桥原样交 edge egress（盖章在 mux 点单点发生）；入站帧经 `encodeMessage(msg,{sequence})`
 *    还原为字节——wire 与 β 形态逐字节等价的前提。
 */
import type { NamespaceRegistry } from '@nomicore/namespace-registry';
import {
  DEFAULT_REPLICATION_LIMITS,
  DEFAULT_REPLICATION_TIMEOUTS,
  createHubAsyncSessionHost,
  createHubReplicationEdge,
} from '@nomicore/ws-replication';
import type {
  DuplexTransport,
  HubAsyncSessionFrame,
  HubAsyncSessionHandle,
  HubAsyncSessionHost,
  HubAsyncSessionReceipt,
  HubNamespaceSessionSink,
  HubReplication,
  HubReplicationEdgeConnection,
  HubReplicationEdgeFactory,
  HubSessionSignal,
  HubUpgradeRequest,
  NamespaceAuthorization,
  NamespaceAuthorizationGrant,
  NamespaceAuthorizer,
  PeerTokenVerifier,
  ReplicationClock,
  ReplicationLimits,
  ReplicationObserver,
  ReplicationObserverEvent,
  ReplicationTimeouts,
  ReplicationTimer,
  UpgradeIdentity,
} from '@nomicore/ws-replication';
import * as Y from 'yjs';
import {
  CAP_CHUNKED_UPDATE,
  decodeMessage,
  encodeMessage,
} from '@nomicore/replication-protocol';
import { HUB_INSTANCE, HUB_OWNER, settleUntil } from './harness.js';

// ═══════════════════════════ 限值 / 超时（公共冻结常量；boot 注入覆盖可采纳） ═══════════════════════════

/** 公共冻结 limits（`ResolvedLimits` 为空扩展 ⟹ 可直接赋）。 */
export const LIMITS = DEFAULT_REPLICATION_LIMITS;

/** 公共冻结 timeouts：值即 resolved 全量形；公共类型标三字段可选，故做同常量收窄。 */
type AsyncHostTimeouts = Parameters<typeof createHubAsyncSessionHost>[0]['timeouts'];
export const TIMEOUTS: AsyncHostTimeouts = DEFAULT_REPLICATION_TIMEOUTS as AsyncHostTimeouts;

/** Partial limits 合并（boot 注入 = 显式字段整值替换缺省；夹具侧与组合根同款语义）。 */
function resolveLimits(partial: Readonly<Partial<ReplicationLimits>> | undefined): ReplicationLimits {
  return { ...LIMITS, ...(partial ?? {}) };
}

// ═══════════════════════════ 缝消息词汇（§24.3 闭集合，逐字） ═══════════════════════════

/** session→edge 消息（§24.3）：`frame{tag, bytes, lane}` / `settled` / `connection-fatal`。 */
export type SessionToEdgeMessage = HubAsyncSessionFrame | HubSessionSignal;

/**
 * edge→session 消息（§24.3）：`frame{bytes}` / `receipt{tag, sequence}` / `close` /
 * `terminateUnauthorized`。
 *
 * `receipt` 用**公共类型原样**（键集恰 `{tag, sequence}`——SEAM-C3 直接对消息对象断言，
 * 不引入夹具自有键）；`frame` 以 `bytes` 键承载；两个生命周期信号以**消息名**（= §24.3
 * 词表名）承载。词汇名由 `messageNameOf` 单点提取（缝日志用）。
 */
export type EdgeToSessionMessage =
  | { readonly bytes: Uint8Array }
  | HubAsyncSessionReceipt
  | 'close'
  | 'terminateUnauthorized';

/** 缝消息名（§24.3 闭集合；词汇断言面 SEAM-C1）。 */
export type SeamMessageName =
  | 'frame'
  | 'receipt'
  | 'close'
  | 'terminateUnauthorized'
  | 'settled'
  | 'connection-fatal';

export function messageNameOf(message: SessionToEdgeMessage | EdgeToSessionMessage): SeamMessageName {
  if (typeof message === 'string') return message;
  if ('tag' in message && 'sequence' in message) return 'receipt';
  if ('type' in message) return message.type;
  return 'frame';
}

export function isAsyncOutboundFrame(message: SessionToEdgeMessage): message is HubAsyncSessionFrame {
  return 'bytes' in message && 'lane' in message;
}

export function isReceipt(message: EdgeToSessionMessage): message is HubAsyncSessionReceipt {
  return typeof message !== 'string' && 'tag' in message && 'sequence' in message;
}

export function isInboundFrame(
  message: EdgeToSessionMessage,
): message is Readonly<{ bytes: Uint8Array }> {
  return typeof message !== 'string' && 'bytes' in message;
}

// ═══════════════════════════ FIFO 通道（显式释放；PIPE-C1/C2） ═══════════════════════════

export interface SeamChannel<Message> {
  /** FIFO 追加；同步；零投递。 */
  enqueue(message: Message): void;
  /** 按 FIFO 顺序同步投递缓冲（count 缺省 = 全部）；返回投递数（确定性）。 */
  release(count?: number): number;
  /** 未投递缓冲（断言面：「不释放 ⇒ 零投递」）。 */
  pending(): readonly Message[];
  /** 已投递日志（FIFO/不丢/不重断言面）。 */
  delivered(): readonly Message[];
  /** 被故障注入丢弃的消息（`dropReceipts`）。 */
  dropped(): readonly Message[];
  onDeliver(listener: (message: Message) => void): () => void;
  /** 下一次 release 交换前两条（乱序注入；PIPE-C1/SEAM-C2 负控）。 */
  reorderNext(): void;
  /** 扣留开关（true = release 零投递；`withholdEdgeToSession` 的可观察实现）。 */
  setHeld(held: boolean): void;
  readonly held: boolean;
  /** 丢弃谓词（`dropReceipts` 注入点；单点，逐条消费）。 */
  setDropPredicate(predicate: ((message: Message) => boolean) | undefined): void;
}

class FifoSeamChannel<Message> implements SeamChannel<Message> {
  private readonly buffer: Message[] = [];
  private readonly log: Message[] = [];
  private readonly discarded: Message[] = [];
  private readonly listeners = new Set<(message: Message) => void>();
  private reorderFlag = false;
  private heldFlag = false;
  private dropPredicate: ((message: Message) => boolean) | undefined;

  constructor(private readonly onCross: (message: Message) => void) {}

  enqueue(message: Message): void {
    this.buffer.push(message);
  }

  release(count?: number): number {
    if (this.heldFlag) return 0;
    let sent = 0;
    while (this.buffer.length > 0 && (count === undefined || sent < count)) {
      if (this.reorderFlag && this.buffer.length >= 2) {
        const [first, second] = [this.buffer[0]!, this.buffer[1]!];
        this.buffer[0] = second;
        this.buffer[1] = first;
        this.reorderFlag = false;
      }
      const message = this.buffer.shift()!;
      if (this.dropPredicate?.(message) === true) {
        this.discarded.push(message);
        continue;
      }
      this.log.push(message);
      this.onCross(message);
      for (const listener of [...this.listeners]) listener(message);
      sent += 1;
    }
    return sent;
  }

  pending(): readonly Message[] {
    return [...this.buffer];
  }

  delivered(): readonly Message[] {
    return [...this.log];
  }

  dropped(): readonly Message[] {
    return [...this.discarded];
  }

  onDeliver(listener: (message: Message) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  reorderNext(): void {
    this.reorderFlag = true;
  }

  setHeld(held: boolean): void {
    this.heldFlag = held;
  }

  get held(): boolean {
    return this.heldFlag;
  }

  /** 丢弃谓词（`dropReceipts` 注入点；单点，逐条消费）。 */
  setDropPredicate(predicate: ((message: Message) => boolean) | undefined): void {
    this.dropPredicate = predicate;
  }
}

/** 独立通道工厂（PIPE-C1/C2 的单元面；宿主桥内部亦用同一实现）。 */
export function makeSeamChannel<Message>(
  onCross: (message: Message) => void = () => undefined,
): SeamChannel<Message> {
  return new FifoSeamChannel<Message>(onCross);
}

// ═══════════════════════════ 每 (connectionKey, namespaceId) 一对专用通道 ═══════════════════════════

export interface AsyncSessionSeam {
  readonly connectionKey: string;
  readonly namespaceId: string;
  readonly sessionToEdge: SeamChannel<SessionToEdgeMessage>;
  readonly edgeToSession: SeamChannel<EdgeToSessionMessage>;
}

export interface SeamLogEntry {
  readonly direction: 'session-to-edge' | 'edge-to-session';
  readonly name: SeamMessageName;
  readonly lane?: 'control' | 'data';
  readonly tag?: number;
  readonly sequence?: number;
}

export interface AsyncProbes {
  /** 每会话记录（close/terminate 调用计数——TERM 面）。 */
  readonly sessions: Array<{ namespaceId: string; closeCalls: number; terminateCalls: number }>;
  readonly opens: Array<{
    connectionKey: string;
    namespaceId: string;
    selectedCapabilities: number;
    remoteInstanceId: string;
  }>;
  readonly resolves: string[];
  /** 会话→edge 控制信号（`settled:ns` / `connection-fatal:CODE`）。 */
  readonly signals: string[];
  /** 出站帧（session→edge，投递序）：tag/lane/占位帧 kind。 */
  readonly outbound: Array<{ tag: number; lane: 'control' | 'data'; kind: string }>;
  /** egress 为每个 tag 返回的盖章序（0 = 未发送/被拒）；seq>0 才有回执。 */
  readonly stamps: Array<{ tag: number; sequence: number }>;
  /** edge→session 实际投递的回执（SEAM-C2/ROUND-C3 配对断言面）。 */
  readonly receipts: HubAsyncSessionReceipt[];
  /** 未决 tag 的「未盖章」计数（egress ≤ 0，不投回执；§9.1）。 */
  readonly unsealed: number;
  readonly handles: HubAsyncSessionHandle[];
}

// ═══════════════════════════ 宿主桥 + facade ═══════════════════════════

export interface AsyncSeamHost {
  readonly factory: HubReplicationEdgeFactory;
  readonly connections: ReadonlyMap<string, HubReplicationEdgeConnection>;
  readonly seams: ReadonlyMap<string, AsyncSessionSeam>;
  readonly log: readonly SeamLogEntry[];
  readonly probes: AsyncProbes;
  accept(
    transport: DuplexTransport,
    request?: HubUpgradeRequest,
  ): Promise<HubReplicationEdgeConnection | undefined>;
  acceptTrusted(
    transport: DuplexTransport,
    identity: UpgradeIdentity,
  ): Promise<HubReplicationEdgeConnection | undefined>;
  /** 取会话通道对（缺失即响亮 throw——无静默兜底）。 */
  channel(connectionKey: string, namespaceId: string): AsyncSessionSeam;
  /** 释放全部会话双向通道（held 通道零投递）；返回投递总数。 */
  releaseAll(): number;
  /**
   * issue #450（append-only，F2 延迟解析泵）：`deferSinkResolve` 置位时挂起的
   * `${connectionKey}\u0000${namespaceId}` 键快照（未置位 ⇒ 恒空数组）。
   */
  pendingSinks(): readonly string[];
  /** issue #450（append-only，F2）：显式结算一个挂起的宿主解析（按 namespaceId 定位；
   *  未挂起 ⇒ 响亮 throw——无静默兜底）。 */
  resolveSink(namespaceId: string): void;
  /** 扣留 edge→session 投递（延迟注入；PEND/CHUNK 负控面）。 */
  withholdEdgeToSession(connectionKey: string, namespaceId: string, held?: boolean): void;
  /** 丢弃前 n 条 edge→session receipt（SEAM-C2/ANCHOR-C2 负控）。 */
  dropReceipts(connectionKey: string, namespaceId: string, n: number): void;
  /** 下一次 release 交换前两条（乱序注入）。 */
  reorderNext(
    connectionKey: string,
    namespaceId: string,
    direction?: 'session-to-edge' | 'edge-to-session',
  ): void;
}

export interface AsyncFacadeOptions {
  /** 必填：boot 恒传 `hubNode.registry`（≡ `run.hubNode.registry`，同一对象）——头注 5。 */
  readonly registry: NamespaceRegistry;
  readonly authorize: NamespaceAuthorizer;
  readonly verifyToken?: PeerTokenVerifier;
  readonly timer: ReplicationTimer;
  readonly limits?: Readonly<Partial<ReplicationLimits>>;
  readonly timeouts?: Readonly<Partial<ReplicationTimeouts>>;
  readonly observer?: ReplicationObserver;
  readonly clock?: ReplicationClock;
  /**
   * issue #448（append-only 可选成员；缺省零传 = #447 行为逐字不变）：edge 半边的结构化
   * observer 注入面——`update-sent` 的发射点在 edge 盖章点（§24.8/A4.7），该事件只在本
   * 键在场时可观察。session 侧 observer 仍走 `observer` 键（两半边可共用一个 recorder，
   * 事件型互斥：`update-sent` 只在 edge、`update-acked`/chunked 族只在 session）。
   */
  readonly edgeObserver?: ReplicationObserver;
  /**
   * issue #450（append-only 可选成员；缺省零传 = #447 行为逐字不变）：γ 装配标记转发
   * ——edge 工厂 `asyncDataAdmissionFatal: true`（ADR 0032 A4.3 / 协议 §24.5：data
   * admission 越界 = 连接终局；缺省缺席 ⇒ α/β 语义逐字保留）。
   */
  readonly asyncDataAdmissionFatal?: true;
  /**
   * issue #450（append-only 可选成员；缺省 false = #447 同步解析行为逐字不变）：F2 延迟
   * sink 解析旋钮——置位时 `resolveSessionSink` 返回挂起 promise（登记到闸门），由
   * `AsyncSeamHost.resolveSink(namespaceId)` 显式 resolve 泵结算（AC6「跨线程延迟」注入面）。
   */
  readonly deferSinkResolve?: boolean;
}

export interface AsyncFacade {
  readonly replication: HubReplication;
  readonly host: AsyncSeamHost;
  readonly worker: {
    readonly index: 0;
    readonly registry: NamespaceRegistry;
    readonly host: HubAsyncSessionHost;
  };
}

/**
 * 异步缝 facade（adopt 形态）：内部建**恰一个** γ 会话宿主 + 恰一个 edge 工厂，并把全部
 * `resolveSessionSink` 路由到该宿主；桥/登记/探针与 #424 同款单点纪律。返回 `replication`
 * 面供 `boot({ createHub })` 直接注入（同一集成点）。
 */
export function makeAsyncReplicationFacade(options: AsyncFacadeOptions): AsyncFacade {
  const limits = resolveLimits(options.limits);
  const timeouts = (options.timeouts ?? TIMEOUTS) as AsyncHostTimeouts;
  const connections = new Map<string, HubReplicationEdgeConnection>();
  const seams = new Map<string, AsyncSessionSeam>();
  const log: SeamLogEntry[] = [];
  const sessions: AsyncProbes['sessions'] = [];
  const opens: AsyncProbes['opens'] = [];
  const resolves: string[] = [];
  const signals: string[] = [];
  const outbound: AsyncProbes['outbound'] = [];
  const stamps: AsyncProbes['stamps'] = [];
  const receipts: HubAsyncSessionReceipt[] = [];
  const handles: HubAsyncSessionHandle[] = [];
  const probeState = { unsealed: 0 };
  /** issue #450（append-only，F2）：挂起的宿主解析闸门（键 = `${connectionKey}\u0000${namespaceId}`）。 */
  const sinkGate = new Map<string, () => void>();
  const probes: AsyncProbes = {
    sessions,
    opens,
    resolves,
    signals,
    outbound,
    stamps,
    receipts,
    get unsealed() {
      return probeState.unsealed;
    },
    handles,
  };

  const worker = {
    index: 0 as const,
    registry: options.registry,
    host: createHubAsyncSessionHost({
      registry: options.registry,
      instanceId: HUB_INSTANCE,
      limits,
      timeouts,
      timer: options.timer,
      ...(options.observer !== undefined ? { observer: options.observer } : {}),
      ...(options.clock !== undefined ? { clock: options.clock } : {}),
    }),
  };

  const record = (entry: SeamLogEntry): void => {
    log.push(entry);
  };

  const makeSeam = (connectionKey: string, namespaceId: string): AsyncSessionSeam => {
    const sessionToEdge = new FifoSeamChannel<SessionToEdgeMessage>((message) => {
      const name = messageNameOf(message);
      record({
        direction: 'session-to-edge',
        name,
        ...(name === 'frame' && isAsyncOutboundFrame(message)
          ? { lane: message.lane, tag: message.tag }
          : {}),
      });
    });
    const edgeToSession = new FifoSeamChannel<EdgeToSessionMessage>((message) => {
      const name = messageNameOf(message);
      record({
        direction: 'edge-to-session',
        name,
        ...(isReceipt(message) ? { tag: message.tag, sequence: message.sequence } : {}),
      });
      if (isReceipt(message)) receipts.push({ tag: message.tag, sequence: message.sequence });
    });
    const seam: AsyncSessionSeam = { connectionKey, namespaceId, sessionToEdge, edgeToSession };
    seams.set(`${connectionKey}\u0000${namespaceId}`, seam);
    return seam;
  };

  const factory = createHubReplicationEdge({
    instanceId: HUB_INSTANCE,
    timer: options.timer,
    authorize: options.authorize,
    ...(options.verifyToken === undefined ? {} : { verifyToken: options.verifyToken }),
    // issue #448（append-only）：edge 侧 observer 缺省零传（#447 行为逐字不变）；在场时
    // `update-sent`（发射点 = edge 盖章点，§24.8）可观察——session 侧 observer 走 `observer` 键。
    ...(options.edgeObserver === undefined ? {} : { observer: options.edgeObserver }),
    // 显式只传 **partial**（与 boot 单体注入面同形态）：edge 侧 resolve+validate 与组合根
    // 同款语义；传全量 resolved 会把缺省值误当显式表达而激活分块链校验（构型误报）。
    ...(options.limits === undefined ? {} : { limits: options.limits }),
    ...(options.timeouts === undefined ? {} : { timeouts: options.timeouts }),
    // issue #450（append-only）：γ 装配标记缺省零传（#447 行为逐字不变）；在场 ⇒ edge
    // 工厂 data admission 越界 = 连接终局（ADR 0032 A4.3 / 协议 §24.5）。
    ...(options.asyncDataAdmissionFatal === true
      ? { asyncDataAdmissionFatal: true as const }
      : {}),
    resolveSessionSink: (connectionKey, namespaceId, authorization) => {
      // SD-2(a)：登记权威是唯一写点（accept/acceptTrusted 返回后第一动作）；取不到即抛。
      const connection = connections.get(connectionKey);
      if (connection === undefined) {
        throw new Error(`issue447 fixture: resolver 无登记连接 ${connectionKey}`);
      }
      const build = (): HubNamespaceSessionSink => {
        // 描述子 `selectedCapabilities` 的唯一事实源 = edge 协商位（决策 2/5）。
        const selectedCapabilities = connection.egress.chunkedUpdateNegotiated()
          ? CAP_CHUNKED_UPDATE
          : 0;
        const handle = worker.host.open({
          connectionKey,
          remoteInstanceId: connection.authenticatedInstanceId,
          namespaceId,
          authorization,
          selectedCapabilities,
          connectionId: connectionKey,
        });
        opens.push({
          connectionKey,
          namespaceId,
          selectedCapabilities,
          remoteInstanceId: connection.authenticatedInstanceId,
        });
        resolves.push(`${namespaceId}:w0`);
        const sessionRecord = { namespaceId, closeCalls: 0, terminateCalls: 0 };
        sessions.push(sessionRecord);
        // 句柄投影：计数包裹只加探针，零改写生产返回值。
        const wrapped: HubAsyncSessionHandle = {
          handleFrame: (frame) => handle.handleFrame(frame),
          handleReceipt: (tag, sequence) => handle.handleReceipt(tag, sequence),
          onFrame: (listener) => handle.onFrame(listener),
          onSignal: (listener) => handle.onSignal(listener),
          terminateUnauthorized: () => {
            sessionRecord.terminateCalls += 1;
            return handle.terminateUnauthorized();
          },
          close: () => {
            sessionRecord.closeCalls += 1;
            return handle.close();
          },
        };
        handles.push(wrapped);

        const seam = makeSeam(connectionKey, namespaceId);
        // ── session → edge：纯中继 + 回执条款（盖章返回值同一同步段入队） ──
        handle.onFrame((frame) => {
          seam.sessionToEdge.enqueue(frame);
        });
        handle.onSignal((signal) => {
          seam.sessionToEdge.enqueue(signal);
        });
        seam.sessionToEdge.onDeliver((message) => {
          if (isAsyncOutboundFrame(message)) {
            const sequence =
              message.lane === 'control'
                ? connection.egress.sendControlFrame(message.bytes)
                : connection.egress.sendDataFrame(message.bytes);
            outbound.push({
              tag: message.tag,
              lane: message.lane,
              kind: kindOfPlaceholder(message.bytes),
            });
            if (sequence > 0) {
              // ★ A4.2/§24.2.3：盖章点同一同步段投回执；同通道 FIFO ⇒ 先于后续 ACK。
              stamps.push({ tag: message.tag, sequence });
              seam.edgeToSession.enqueue({ tag: message.tag, sequence });
            } else {
              // 帧未盖章（0 = 未发送/被拒）：不投回执；tag 停留 pending（ackTimeout 兜底）。
              probeState.unsealed += 1;
            }
            return;
          }
          if (message.type === 'settled') {
            signals.push(`settled:${message.namespaceId}`);
            connection.egress.namespaceSettled(message.namespaceId);
            return;
          }
          signals.push(`connection-fatal:${message.code}`);
          connection.egress.connectionFatal(message.code);
        });
        // ── edge → session：帧 / 回执 / close / terminateUnauthorized ──
        seam.edgeToSession.onDeliver((message) => {
          if (message === 'close') {
            void wrapped.close();
            return;
          }
          if (message === 'terminateUnauthorized') {
            void wrapped.terminateUnauthorized();
            return;
          }
          if (isReceipt(message)) {
            wrapped.handleReceipt(message.tag, message.sequence);
            return;
          }
          wrapped.handleFrame(message.bytes);
        });

        const sink: HubNamespaceSessionSink = {
          openNamespace: (message) => {
            seam.edgeToSession.enqueue({ bytes: encodeMessage(message, { sequence: 0 }) });
          },
          namespaceFrame: (message, sequence) => {
            seam.edgeToSession.enqueue({ bytes: encodeMessage(message, { sequence }) });
          },
          terminateUnauthorized: () => {
            seam.edgeToSession.enqueue('terminateUnauthorized');
            return Promise.resolve();
          },
          onConnectionClosed: () => {
            seam.edgeToSession.enqueue('close');
            return Promise.resolve();
          },
        };
        return sink;
      };
      // issue #450（append-only，F2）：延迟解析（缺省 false ⇒ 下方同步分支逐字不变）。
      if (options.deferSinkResolve === true) {
        return new Promise<HubNamespaceSessionSink>((resolve) => {
          sinkGate.set(`${connectionKey}\u0000${namespaceId}`, () => resolve(build()));
        });
      }
      return build();
    },
  });

  const register = (
    connection: HubReplicationEdgeConnection | undefined,
  ): HubReplicationEdgeConnection | undefined => {
    if (connection === undefined) return undefined;
    connections.set(connection.connectionKey, connection);
    return connection;
  };

  let closeTail: Promise<void> | undefined;
  const host: AsyncSeamHost = {
    factory,
    connections,
    seams,
    log,
    probes,
    async accept(transport, request) {
      return register(await factory.accept(transport, request));
    },
    async acceptTrusted(transport, identity) {
      return register(await factory.acceptTrusted(transport, identity));
    },
    channel(connectionKey, namespaceId) {
      const seam = seams.get(`${connectionKey}\u0000${namespaceId}`);
      if (seam === undefined) {
        throw new Error(`issue447 fixture: 无会话通道对 (${connectionKey}, ${namespaceId})`);
      }
      return seam;
    },
    pendingSinks() {
      return [...sinkGate.keys()];
    },
    resolveSink(namespaceId) {
      for (const [key, resolve] of sinkGate) {
        if (!key.endsWith(`\u0000${namespaceId}`)) continue;
        sinkGate.delete(key);
        resolve();
        return;
      }
      throw new Error(`issue447 fixture: 无挂起的 sink 解析（${namespaceId}）`);
    },
    releaseAll() {
      let delivered = 0;
      for (const seam of seams.values()) {
        delivered += seam.sessionToEdge.release();
        delivered += seam.edgeToSession.release();
      }
      return delivered;
    },
    withholdEdgeToSession(connectionKey, namespaceId, held = true) {
      host.channel(connectionKey, namespaceId).edgeToSession.setHeld(held);
    },
    dropReceipts(connectionKey, namespaceId, n) {
      let remaining = n;
      host.channel(connectionKey, namespaceId).edgeToSession.setDropPredicate((message) => {
        if (remaining <= 0) return false;
        if (!isReceipt(message)) return false;
        remaining -= 1;
        return true;
      });
    },
    reorderNext(connectionKey, namespaceId, direction = 'edge-to-session') {
      const seam = host.channel(connectionKey, namespaceId);
      if (direction === 'session-to-edge') seam.sessionToEdge.reorderNext();
      else seam.edgeToSession.reorderNext();
    },
  };

  const replication: HubReplication = {
    accept: (transport, request) => host.accept(transport, request),
    acceptTrusted: (transport, identity) => host.acceptTrusted(transport, identity),
    get connections() {
      return [...host.connections.values()];
    },
    async revoke(instanceIdentity: string, namespaceId: string) {
      const tails: Promise<void>[] = [];
      for (const connection of host.connections.values()) {
        if (connection.authenticatedInstanceId !== instanceIdentity) continue;
        tails.push(connection.revokeNamespace(namespaceId));
      }
      await Promise.all(tails);
    },
    async requestReauth(instanceIdentity: string) {
      for (const connection of host.connections.values()) {
        if (connection.authenticatedInstanceId !== instanceIdentity) continue;
        connection.beginReauth();
      }
    },
    close(): Promise<void> {
      if (closeTail !== undefined) return closeTail;
      const list = [...host.connections.values()];
      for (const connection of list) connection.close(1001, 'hub-shutdown');
      closeTail = Promise.all(list.map((connection) => connection.settle())).then(() => undefined);
      return closeTail;
    },
  };

  return { replication, host, worker };
}

// ═══════════════════════════ 泵（显式释放驱动；零真实 timer） ═══════════════════════════

/**
 * 确定性定点泵：每轮先把全部通道按 FIFO 释放，再用 `settleUntil` 排空微任务/defer 泵；
 * 谓词达成即返回。**这不是协议决策**——只做「宿主及时泵送」这一 §24.2 传输义务的测试
 * 实现；扣留场景不调用它（或用 withhold 旋钮）。
 */
export async function pumpUntil(
  host: AsyncSeamHost,
  predicate: () => boolean,
  what: string,
  rounds = 40,
  budgetPerRound = 200,
): Promise<void> {
  for (let round = 0; round < rounds; round += 1) {
    host.releaseAll();
    try {
      await settleUntil(
        () => {
          host.releaseAll();
          return predicate();
        },
        what,
        budgetPerRound,
      );
      return;
    } catch {
      // 本轮预算内未达谓词：继续下一轮（继续释放新产生的缝消息）。
    }
  }
  if (predicate()) return;
  throw new Error(`issue447 fixture: pumpUntil 未达谓词（${what}）`);
}

/**
 * 有界泵步（不等待谓词）：用于「**不该发生**的事」断言之前的确定性推进（PEND-C1 的
 * 「第二帧不得过缝」等）。每步释放全部通道并排空微任务 + defer 泵。
 */
export async function pumpSteps(host: AsyncSeamHost, steps = 4): Promise<void> {
  for (let index = 0; index < steps; index += 1) {
    host.releaseAll();
    try {
      await settleUntil(() => false, 'pumpSteps', 1);
    } catch {
      // 预期：单步预算内无谓词可满足——continue。
    }
  }
}

// ═══════════════════════════ 判据助手 ═══════════════════════════

export interface WireFrame {
  readonly kind: string;
  readonly code?: string;
  readonly namespaceId?: string;
  readonly sequence: number;
  readonly message: unknown;
}

/**
 * 能力感知的 wire 解码面（分块构型必需）：`driver.Run.frames()` 走无参 `decodeMessage`，
 * 遇到 `UPDATE_CHUNK` 会因未声明协商位而响亮拒绝（`UNSUPPORTED_MESSAGE_TYPE`）——本助手
 * 显式声明 `CAP_CHUNKED_UPDATE`（分块族验收面），非分块帧逐字节等价。
 */
export function decodeWire(frames: readonly Uint8Array[]): WireFrame[] {
  return frames.map((bytes) => {
    const decoded = decodeMessage(bytes, {
      maxFrameBytes: LIMITS.maxFrameBytes,
      selectedCapabilities: CAP_CHUNKED_UPDATE,
    });
    const message = decoded.message as {
      kind: string;
      code?: string;
      namespaceId?: string;
      ackedSequence?: number;
    };
    return {
      kind: message.kind,
      ...(message.code === undefined ? {} : { code: message.code }),
      ...(message.namespaceId === undefined ? {} : { namespaceId: message.namespaceId }),
      sequence: decoded.header.sequence,
      message,
    };
  });
}

export function wireFramesOfKind(frames: readonly Uint8Array[], kind: string): WireFrame[] {
  return decodeWire(frames).filter((frame) => frame.kind === kind);
}

/** 控制帧白名单（与 #424 `issue424-sharded-hub.ts` 逐字同源，但解码声明协商位）。 */
const SEAM_CONTROL_KINDS: ReadonlySet<string> = new Set([
  'HELLO_ACK',
  'OPEN_OK',
  'ERROR',
  'CLOSE_OK',
  'GOAWAY',
]);

/** 数据帧白名单（同源）；分块族经 `UPDATE_CHUNK` 逐帧承载。 */
const SEAM_DATA_KINDS: ReadonlySet<string> = new Set([
  'BOOTSTRAP_SNAPSHOT',
  'UPDATE',
  'UPDATE_CHUNK',
  'SYNC_STEP2',
]);

export function wireControlFrames(frames: readonly Uint8Array[]): Uint8Array[] {
  return frames.filter((bytes) => SEAM_CONTROL_KINDS.has(kindOfPlaceholder(bytes)));
}

export function wireDataFrames(frames: readonly Uint8Array[]): Uint8Array[] {
  return frames.filter((bytes) => SEAM_DATA_KINDS.has(kindOfPlaceholder(bytes)));
}

/** 全轨迹骨架 `kind(code?)#sequence`（能力感知解码；与 #424 `skeletonOf` 同构）。 */
export function wireSkeleton(frames: readonly Uint8Array[]): string {
  return decodeWire(frames)
    .map((frame) => `${frame.kind}${frame.code === undefined ? '' : `(${frame.code})`}#${frame.sequence}`)
    .join(' ');
}

/**
 * 数据帧承载的文档语义（能力感知：分块族按 `transferId` 重组后应用）。与 #424
 * `docStateOf` 同判据（ROOT/META JSON——clientID 无关），必要差异 = `UPDATE_CHUNK` 的
 * 重组（既有助手按单帧载荷取用，遇分块族会静默跳过——分块构型下不可用作 parity 判据）。
 */
export function wireDocState(frames: readonly Uint8Array[]): string {
  const doc = new Y.Doc();
  const chunked = new Map<number, { readonly chunkCount: number; readonly parts: Uint8Array[] }>();
  for (const bytes of frames) {
    const message = decodeMessage(bytes, {
      maxFrameBytes: LIMITS.maxFrameBytes,
      selectedCapabilities: CAP_CHUNKED_UPDATE,
    }).message as {
      kind: string;
      snapshot?: Uint8Array;
      update?: Uint8Array;
      bytes?: Uint8Array;
      transferId?: number;
      chunkIndex?: number;
      chunkCount?: number;
    };
    if (message.kind === 'BOOTSTRAP_SNAPSHOT' && message.snapshot !== undefined) {
      Y.applyUpdate(doc, message.snapshot);
      continue;
    }
    if ((message.kind === 'UPDATE' || message.kind === 'SYNC_STEP2') && message.update !== undefined) {
      Y.applyUpdate(doc, message.update);
      continue;
    }
    if (message.kind === 'UPDATE_CHUNK' && message.bytes !== undefined) {
      const transferId = message.transferId ?? -1;
      const entry = chunked.get(transferId) ?? {
        chunkCount: message.chunkCount ?? 0,
        parts: [],
      };
      entry.parts[message.chunkIndex ?? 0] = message.bytes;
      chunked.set(transferId, entry);
    }
  }
  for (const entry of chunked.values()) {
    const total = entry.parts.reduce((sum, part) => sum + (part?.byteLength ?? 0), 0);
    const joined = new Uint8Array(total);
    let offset = 0;
    for (const part of entry.parts) {
      if (part === undefined) continue;
      joined.set(part, offset);
      offset += part.byteLength;
    }
    Y.applyUpdate(doc, joined);
  }
  return JSON.stringify({
    root: doc.getMap('ROOT').toJSON(),
    meta: doc.getMap('META').toJSON(),
  });
}

/** 逐帧 hex 全等（undefined = 等；与 #424 `framesHexEqual` 同判据）。 */
export function wireFramesHexEqual(
  left: readonly Uint8Array[],
  right: readonly Uint8Array[],
): string | undefined {
  if (left.length !== right.length) {
    return `帧数不同 left=${left.length} right=${right.length}`;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (Buffer.from(left[index]!).toString('hex') !== Buffer.from(right[index]!).toString('hex')) {
      return `第 ${index} 帧字节不同`;
    }
  }
  return undefined;
}

/** 占位编码帧的 kind（诊断/配对断言；不改变任何行为）。 */
export function kindOfPlaceholder(bytes: Uint8Array): string {
  const decoded = decodeMessage(bytes, {
    maxFrameBytes: LIMITS.maxFrameBytes,
    selectedCapabilities: CAP_CHUNKED_UPDATE,
  });
  return decoded.message.kind;
}

/** observer 记录器（CHUNK-C3 单事件字段值断言面；零事件序断言纪律由测试侧承担）。 */
export function makeAsyncObserver(): {
  readonly observer: ReplicationObserver;
  readonly events: ReplicationObserverEvent[];
} {
  const events: ReplicationObserverEvent[] = [];
  return {
    observer: (event: ReplicationObserverEvent) => {
      events.push(event);
    },
    events,
  };
}

/** 手动时钟（`now()` 读数可推进；不驱动任何 timer——零真实时间）。 */
export function makeManualClock(start = 1_000): {
  readonly clock: ReplicationClock;
  now(): number;
  advance(ms: number): void;
} {
  let value = start;
  return {
    clock: { now: () => value },
    now: () => value,
    advance: (ms: number) => {
      value += ms;
    },
  };
}

/** 授权桩（三形态 + 调用序记录；真实调用单点在 edge）。 */
export function makeAsyncAuthorizer(
  form: 'pass' | 'deny' | 'throw' = 'pass',
  calls: string[] = [],
): NamespaceAuthorizer {
  return async (_instanceIdentity: string, namespaceId: string): Promise<NamespaceAuthorization> => {
    calls.push(namespaceId);
    if (form === 'deny') return { ok: false };
    if (form === 'throw') throw new Error('issue447 fixture: authorizer boom');
    return {
      ok: true,
      localOwner: HUB_OWNER,
      permissions: { read: true, submit: true },
    };
  };
}
