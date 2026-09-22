/**
 * hub-edge-host —— `createHubReplicationEdge`：hub 侧**连接级半边的宿主公共工厂**
 * （ADR 0032 决策 1/2/3/4/5 的连接级出面；spec #415 T4 / issue #421；设计 §7 D1–D7）。
 *
 * 装配形态（设计 D1 Architecture-C）：公共工厂是**未改动的**内部 `HubReplicationEdgeImpl`
 * （`hub-edge.ts`，连接级 FSM 单份，零复现）的宿主化包装——每次 `accept`/`acceptTrusted`
 * 成功分配一个内部连接实例，并经该实例的构造期 `sessionFactory` 缝注入本模块的
 * `HostSessionAdapter`（实现内部缝类型 `HubSessionSink`，缝类型零改动）。
 *
 * 职责全量落地（AC1–AC6）：
 * - **双入口**：`accept(transport, { token })`（内部跑注入的 `verifyToken`，恰一次）与
 *   `acceptTrusted(transport, identity)`（pre-verified 身份，零 verifyToken 消费）——
 *   门序逐点复刻 `hub-connection.ts`（含微任务让位 + 迟拒兜底复查 → instanceId 文法，R6），
 *   与单体共享 `hub-upgrade-admission.ts` 的有界早到帧单点（#190 纪律）；
 * - **OPEN 准入管线**（ADR 决策 3）：HELLO/drain 门与全解码由内部 edge 零改动承接；
 *   authorize 真实调用在内部 edge 单点，本适配器经 `port.openAdmission` 拉取结局（三分：
 *   denied/throw/authorized）→ 宿主 `resolveSessionSink(connectionKey, namespaceId,
 *   authorization)`（仅授权通过后调用）→ pending 有界缓冲（连接级共享 ≤16 帧，序保冲刷、
 *   按 kind 分派投递面）→ 并发 OPEN 上界（≤4）→ 解析失败响亮连接收口
 *   （连接级 `INTERNAL_ERROR` + `transport.close(1011,'protocol-error')`）；
 * - **出站盖章对外可见**：连接句柄 `egress` 暴露占位编码帧的注入面，内部 `OutboundQueue`
 *   在 mux 点单点分配 `[8..12]` 序列（per-connection 从 1 严格递增）；
 * - **观测纪律**（ADR 决策 5）：拒答/合成帧的 observer 事件经 `port.emitObserver` 复用
 *   edge 单点（稳定码折叠，零新事件类型、零新错误码）。
 *
 * 命名（设计 D1）：内部 `hub-edge.ts` 模块级的每连接构造器 `createHubReplicationEdge`
 * 保持原名（#418 结构锚）；**公共名归本模块并由 `src/index.ts` 导出**——本模块内以导入别名
 * `createEdgeConnection` 消歧，两个同名函数以模块路径区分。
 */
import { encodeMessage, type ReplicationMessage } from '@nomicore/replication-protocol';
import { namespaceErrorFrame } from './frame-io.js';
import { resolveLimits, resolveTimeouts } from './defaults.js';
import { cidField, dispatchReplicationObserver } from './observer.js';
import { createHubReplicationEdge as createEdgeConnection, type HubReplicationEdge } from './hub-edge.js';
import { installEarlyFrameAdmission } from './hub-upgrade-admission.js';
import type { HubNamespaceChannel } from './hub-namespace.js';
import type {
  HubOpenAdmission,
  HubSessionEdgePort,
  HubSessionSink,
  OpenNamespaceInbound,
} from './hub-split.js';
import type {
  DuplexTransport,
  HubConnectionState,
  HubUpgradeRequest,
  NamespaceAuthorization,
  NamespaceAuthorizer,
  PeerTokenVerifier,
  ReplicationClock,
  ReplicationLimits,
  ReplicationObserver,
  ReplicationObserverEvent,
  ReplicationTimer,
  ReplicationTimeouts,
  ResolvedLimits,
  ResolvedTimeouts,
  UpgradeIdentity,
} from './types.js';
import {
  isValidInstanceId,
  validateChunkedBootstrapChain,
  validateChunkedSyncDiffChain,
  validateChunkedTransferChain,
  validateInstanceId,
  validateLimits,
  validateTimeouts,
} from './validate.js';

/** 首个 OPEN 的入站形态（与内部缝 `OpenNamespaceInbound` 同源；OPEN 全解码在 edge 完成）。 */
export type HubOpenNamespaceMessage = OpenNamespaceInbound;

/** authorize 的 ok 投影（`localOwner`/`permissions`；非摘要——协议 §19）。 */
export type NamespaceAuthorizationGrant = Extract<NamespaceAuthorization, { ok: true }>;

/**
 * 每 (连接, namespace) 的会话侧消费面（宿主实现；进程内测试可作记录桩）。
 *
 * 异常纪律（发布即冻结的契约条款，设计 §7-D2 R5）：
 * - `openNamespace` / `namespaceFrame` 的同步 throw = 宿主缺陷 → 适配器投递点防御 catch
 *   → `connectionFatal('INTERNAL_ERROR', 1011)`（连接终局；无静默 fallback）；
 * - `onConnectionClosed` 的 reject 由适配器归一吞没（`close()`/`settle()` 恒 resolve；
 *   内部 edge 的 `onConnectionDropped` 通知与 unhandledRejection 面不受宿主影响）；
 * - `terminateUnauthorized` 的 reject 由适配器归一（`revokeNamespace` 恒 resolve——与单体
 *   `terminationSettled`「吞清理异常」纪律同形，`hub-namespace.ts:1730–1734`）。
 *
 * 边界声明：OPEN 投递（`openNamespace`）不携带 wire 序——与缝契约「非 OPEN 帧才带
 * sequence」同源（`hub-split.ts:110–112`）；e-OPEN 应答矩阵（OPEN_OK）归宿主 sink 经
 * `HubReplicationEdgeConnection.egress` 产出。
 */
export interface HubNamespaceSessionSink {
  /** 首个 OPEN（授权 + 解析通过后投递）与后续重 OPEN（重开应答矩阵归宿主 sink，经 egress 出站）。 */
  openNamespace(message: HubOpenNamespaceMessage): void;
  /** 非 OPEN 的 namespace 域帧（已解码消息 + wire 序号）。 */
  namespaceFrame(message: ReplicationMessage, sequence: number): void;
  /** `'terminateUnauthorized'` 信号（revoke 链）。幂等；无副作用 resolve。 */
  terminateUnauthorized(): Promise<void>;
  /** `'close'` 信号的 per-ns 投影（连接收口通知；清理责任在宿主 sink）。 */
  onConnectionClosed(): Promise<void>;
}

/**
 * 宿主回调（Issue 正文签名）：OPEN 授权通过后调用。
 *
 * - 返回 sink = 建立会话；
 * - 返回 `undefined` = **合法无 sink**（设计 SD-5，≠ 失败——非 OPEN 帧落合成
 *   `NAMESPACE_STATE_VIOLATION`，连接存活）；
 * - 同步 throw 与异步拒绝同归解析失败（响亮连接收口 `INTERNAL_ERROR` + 1011）。
 */
export type HubSessionSinkResolver = (
  connectionKey: string,
  namespaceId: string,
  authorization: NamespaceAuthorizationGrant,
) => HubNamespaceSessionSink | undefined | Promise<HubNamespaceSessionSink | undefined>;

/** 连接级出站缝（ADR 0032 决策 2 的宿主形态）：sink 以 sequence=0 占位编码帧注入，
 *  edge 在 mux 点盖章 `[8..12]` 后出站。 */
export interface HubReplicationEdgeEgress {
  /** 控制帧（保留额度判据在既有 sendControlFrame 单点）。返回盖章后 wire 序；0 = 未发送/被拒。 */
  sendControlFrame(frame: Uint8Array): number;
  /** data 帧（前置门 + 单帧守卫 + 连接账本 admission，次序 = `hub-session.ts:210–216` 等价）。
   *  返回盖章后 wire 序；0 = 拒纳。 */
  sendDataFrame(frame: Uint8Array): number;
  /** ns 终态一次性通知（drain 提前完成观测输入；每 ns 至多一次）。 */
  namespaceSettled(namespaceId: string): void;
  /** 通道级致命条件 → 连接收口（缺省 1002；观测折叠沿用 `stableConnectionCode` 单点）。 */
  connectionFatal(code: string, wsCloseCode?: number): void;
  /** HELLO 协商位（会话期恒定；UPDATE_CHUNK 出站判据的唯一事实源）。 */
  chunkedUpdateNegotiated(): boolean;
}

/** 公共连接句柄（设计 §7 D7；`channels` 显式不提供——D7 裁决，替代观测面 = `namespaces`）。 */
export interface HubReplicationEdgeConnection {
  readonly state: HubConnectionState;
  readonly peerInstanceId: string | undefined;
  readonly authenticatedInstanceId: string;
  /** 宿主连接键（设计 D5）：`${instanceId}-conn-${n}`；同连接恒定、跨连接互异。 */
  readonly connectionKey: string;
  /** 已解析 sink 的 ns 集（快照语义，防御性拷贝）。 */
  readonly namespaces: ReadonlySet<string>;
  readonly egress: HubReplicationEdgeEgress;
  close(code?: number, reason?: string): void;
  /** 全部会话清理结算（恒 resolve——R5 纪律）。 */
  settle(): Promise<void>;
  /** GOAWAY + drain + deadline 1001（幂等）。 */
  beginReauth(): void;
  /** → established sink `terminateUnauthorized()`（归一，恒 resolve）；其余无副作用 resolve。 */
  revokeNamespace(namespaceId: string): Promise<void>;
}

export interface HubReplicationEdgeOptions {
  /** HELLO 绑定（`validateInstanceId` 响亮）。 */
  readonly instanceId: string;
  /** 注入延迟 seam（零 native timer）。 */
  readonly timer: ReplicationTimer;
  /** 决策 3：宿主注入授权器（真实调用单点在内部 edge）。 */
  readonly authorize: NamespaceAuthorizer;
  /** 宿主缝：OPEN 授权通过后按 (连接, namespace) 解析会话 sink（设计 D2）。 */
  readonly resolveSessionSink: HubSessionSinkResolver;
  /** `accept` 路径认证器。**类型可选 ≠ 运行时容错**：缺失 → `accept` 全拒 1008
   *  （`verifier-missing`）；`acceptTrusted` 路径零消费。 */
  readonly verifyToken?: PeerTokenVerifier;
  readonly limits?: Readonly<Partial<ReplicationLimits>>;
  readonly timeouts?: Readonly<Partial<ReplicationTimeouts>>;
  readonly observer?: ReplicationObserver;
  readonly clock?: ReplicationClock;
}

export interface HubReplicationEdgeFactory {
  accept(
    transport: DuplexTransport,
    request?: HubUpgradeRequest,
  ): Promise<HubReplicationEdgeConnection | undefined>;
  acceptTrusted(
    transport: DuplexTransport,
    identity: UpgradeIdentity,
  ): Promise<HubReplicationEdgeConnection | undefined>;
}

// ═══════════════════════════ 准入管线常数（设计 SD-3：模块常数 + 内存上界推导） ═══════════════════════════

/**
 * pending 缓冲的连接级共享上界（含 OPEN 自身占位）。内存上界 = 16 × `limits.maxFrameBytes`
 * （缺省 8 MiB → 128 MiB）+ 常数数组开销——与早到帧窗口（`MAX_EARLY_FRAMES`）同账：同一
 * 对抗面（升级窗口 / 宿主解析窗口内的对端灌帧），溢出即响亮收口、内存随连接释放。
 */
export const MAX_PENDING_FRAMES_PER_CONNECTION = 16;

/** 并发 in-flight OPEN 上界（每连接；覆盖 authorize 在途 + 解析在途）。与
 *  `maxConcurrentAssembliesPerConnection`（分块 assembly 槽位）判然两分。 */
export const MAX_CONCURRENT_OPEN_ADMISSIONS = 4;

/** 空通道表（缝类型满足；非事实源——设计 D7 裁决：工厂形态无进程内通道投影）。 */
const EMPTY_CHANNELS: ReadonlyMap<string, HubNamespaceChannel> = new Map();

// ═══════════════════════════ 准入状态表（设计 §8.2） ═══════════════════════════

/** 缓冲项按 kind 分派投递面（R3）：OPEN 项不带 wire 序（`openNamespace` 面），
 *  非 OPEN 项带 wire 序（`namespaceFrame` 面）——与缝契约 `hub-split.ts:105–112` 逐字对齐。 */
type PendingItem =
  | { readonly kind: 'open'; readonly message: HubOpenNamespaceMessage }
  | { readonly kind: 'frame'; readonly message: ReplicationMessage; readonly sequence: number };

/** OPEN 已到、authorize/宿主解析在途（每记录缓冲 + 缓存 grant）。 */
interface PendingAdmission {
  phase: 'pending';
  buffer: PendingItem[];
  grant: NamespaceAuthorizationGrant | undefined;
}

/** 终态闩锁：authorize 拒绝（ns `NAMESPACE_UNAUTHORIZED` 已发）。 */
interface DeniedAdmission {
  phase: 'denied';
}

/** 终态闩锁：authorize throw / `openAdmission` reject（ns `INTERNAL_ERROR` 已发）。 */
interface FailedAdmission {
  phase: 'failed';
}

/** 已建立会话（宿主 sink 在场）。 */
interface EstablishedAdmission {
  phase: 'established';
  sink: HubNamespaceSessionSink;
}

/** 终态记录：宿主返回 `undefined`（合法无 sink；非协议终态——SD-5，可重 OPEN 重解析）。 */
interface NoSinkAdmission {
  phase: 'no-sink';
  grant: NamespaceAuthorizationGrant;
}

type HostAdmission =
  | PendingAdmission
  | DeniedAdmission
  | FailedAdmission
  | EstablishedAdmission
  | NoSinkAdmission;

/** 适配器装配面（内部模块级导出：白盒守卫测试构造用；不进公共入口）。 */
export interface HostSessionAdapterConfig {
  readonly connectionKey: string;
  readonly port: HubSessionEdgePort;
  readonly resolveSessionSink: HubSessionSinkResolver;
}

/** `message.namespaceId` 只读提取（`'namespaceId' in message` 收窄；路由帧必在场）。 */
function namespaceIdOf(message: ReplicationMessage): string | undefined {
  return 'namespaceId' in message ? message.namespaceId : undefined;
}

/**
 * `HostSessionAdapter` —— OPEN 准入管线的**唯一落点**（设计 §8.2 伪码逐条实现）：
 * 准入状态表（键 = namespaceId，与内部 edge 台账锁步：OPEN 到达投递 ⟺ 记录在场）、有界
 * pending 缓冲（连接级共享 16 帧）、并发 OPEN 上界（4）、宿主 `resolveSessionSink` 解析、
 * 按 kind 分派冲刷、终局应答/事件复刻（单体 `finishOpenError`/`finishOpenSilently` 形状）
 * 与四成员 sink 异常纪律（R5）。
 *
 * 模块级导出供白盒守卫测试构造（`OAP-C9b` 注入 `openAdmission` reject 模拟台账缺失）；
 * **不进 `src/index.ts`**（零公共面扩大）。
 */
export class HostSessionAdapter implements HubSessionSink {
  /** 缝类型满足（非事实源——设计 D7 裁决：工厂形态无进程内通道投影）。 */
  readonly channels: ReadonlyMap<string, HubNamespaceChannel> = EMPTY_CHANNELS;
  readonly connectionKey: string;
  readonly port: HubSessionEdgePort;
  private readonly resolveSessionSink: HubSessionSinkResolver;
  private readonly table = new Map<string, HostAdmission>();
  private pendingOpenCount = 0;
  private pendingFrameCount = 0;
  private connectionClosed = false;

  constructor(config: HostSessionAdapterConfig) {
    this.connectionKey = config.connectionKey;
    this.port = config.port;
    this.resolveSessionSink = config.resolveSessionSink;
  }

  /** 已解析（established）ns 集快照——公共句柄 `namespaces` 的唯一输入。 */
  establishedNamespaces(): ReadonlySet<string> {
    const namespaces = new Set<string>();
    for (const [namespaceId, record] of this.table) {
      if (record.phase === 'established') namespaces.add(namespaceId);
    }
    return namespaces;
  }

  // ─────────────────────────────── OPEN 到达点（设计 §8.2 顶层伪码） ───────────────────────────────

  openNamespace(message: HubOpenNamespaceMessage): void {
    const namespaceId = message.namespaceId;
    const record = this.table.get(namespaceId);
    if (record === undefined) {
      // 并发 OPEN 上界（阶段 5）：超额 = 对端对 hub 入站接纳政策的违例 → 1008 policy 收口
      if (this.pendingOpenCount >= MAX_CONCURRENT_OPEN_ADMISSIONS) {
        this.port.connectionFatal('CONNECTION_POLICY_VIOLATION', 1008);
        return;
      }
      this.table.set(namespaceId, {
        phase: 'pending',
        buffer: [{ kind: 'open', message }],
        grant: undefined,
      });
      this.pendingOpenCount += 1;
      this.pendingFrameCount += 1;
      this.runSettleAdmission(namespaceId);
      return;
    }
    switch (record.phase) {
      case 'pending':
        // pending 期重 OPEN → 合流（不新增解析调用；应答矩阵随终局按缓冲 OPEN 数逐帧）
        this.pushPending(namespaceId, { kind: 'open', message });
        return;
      case 'established':
        // 已建立 → 直投（重开应答矩阵归宿主 sink，经 egress 出站）
        this.deliverOpen(record.sink, message);
        return;
      case 'denied':
      case 'failed':
        // 终态闩锁 → 拒答重开（仅 wire 帧，无事件——单体 `onOpen` 终态分支形状）
        this.sendNamespaceReply('NAMESPACE_REOPEN_REQUIRES_RECONNECT', namespaceId);
        return;
      case 'no-sink':
        // SD-5：no-sink 非协议终态 → 重解析（缓存 grant 复用，authorize 不重复）。
        // 重解析受阶段 5 上界约束（设计 §7-D3 SD-5「并发重解析受阶段 5 上界约束」+ §9.3
        // 「两者溢出均响亮收口」；SA4 F1）：并发 OPEN 上界与连接级 pending 帧预算（重 OPEN
        // 占位项同样计入）两道路径与首开分支 / `pushPending` 同码响亮收口——no-sink 重 OPEN
        // 不得成为无界 in-flight resolver 调用或无界帧账目的旁路。被拒重 OPEN 不建会话
        // （记录保持 no-sink；零新解析调用）。
        if (this.pendingOpenCount >= MAX_CONCURRENT_OPEN_ADMISSIONS) {
          this.port.connectionFatal('CONNECTION_POLICY_VIOLATION', 1008);
          return;
        }
        if (this.pendingFrameCount >= MAX_PENDING_FRAMES_PER_CONNECTION) {
          this.port.connectionFatal('CONNECTION_POLICY_VIOLATION', 1008);
          return;
        }
        this.table.set(namespaceId, {
          phase: 'pending',
          buffer: [{ kind: 'open', message }],
          grant: record.grant,
        });
        this.pendingOpenCount += 1;
        this.pendingFrameCount += 1;
        this.runResolve(namespaceId, record.grant);
        return;
    }
  }

  namespaceFrame(message: ReplicationMessage, sequence: number): void {
    const namespaceId = namespaceIdOf(message);
    const record = namespaceId === undefined ? undefined : this.table.get(namespaceId);
    if (record === undefined || namespaceId === undefined) {
      // 防御分支（结构上不可达：edge 台账命中 ⟺ 记录在场）——合成违例，绝不静默误投
      if (namespaceId !== undefined) this.synthesizeStateViolation(namespaceId);
      return;
    }
    switch (record.phase) {
      case 'pending':
        this.pushPending(namespaceId, { kind: 'frame', message, sequence });
        return;
      case 'established':
        this.deliverFrame(record.sink, message, sequence);
        return;
      case 'denied':
      case 'failed':
        return; // 静默（单体 quiet 态同构）
      case 'no-sink':
        // ER 例外：ERROR 帧永不合成（单体 I5 双层形状）；其余合法帧逐帧合成违例
        if (message.kind === 'ERROR') return;
        this.synthesizeStateViolation(namespaceId);
        return;
    }
  }

  /** pending 缓冲入队（有界；溢出 = 对端灌帧 → 响亮 1008 收口，绝不静默丢帧）。 */
  private pushPending(namespaceId: string, item: PendingItem): void {
    if (this.pendingFrameCount >= MAX_PENDING_FRAMES_PER_CONNECTION) {
      this.port.connectionFatal('CONNECTION_POLICY_VIOLATION', 1008);
      return;
    }
    const record = this.table.get(namespaceId);
    if (record === undefined || record.phase !== 'pending') return;
    record.buffer.push(item);
    this.pendingFrameCount += 1;
  }

  // ─────────────────────────────── 结算续体（R4：全路径分类，零 unhandled rejection） ───────────────────────────────

  /** fire-and-forget 入口：内部全路径自兜底（`settleAdmission` 已分类）。 */
  private runSettleAdmission(namespaceId: string): void {
    void this.settleAdmission(namespaceId).catch(() => undefined);
  }

  /** fire-and-forget 入口（no-sink 重解析）：同款自兜底。 */
  private runResolve(namespaceId: string, grant: NamespaceAuthorizationGrant): void {
    void this.runResolveInner(namespaceId, grant).catch(() => undefined);
  }

  /**
   * 准入结算续体（迟归照常传播——设计 D5.6 继承）：`openAdmission` reject（台账缺失 =
   * 锁步不变量破坏）→ ns `INTERNAL_ERROR`（R4a，对齐单体 shim reject → `startOpen` catch）；
   * 连接已收口 → 静默结算（R4b：零 wire 零事件零 settled，单体 `finishOpenSilently` 同构）。
   */
  private async settleAdmission(namespaceId: string): Promise<void> {
    let admission: HubOpenAdmission;
    try {
      admission = await this.port.openAdmission(namespaceId);
    } catch {
      this.finishTerminal(namespaceId, 'INTERNAL_ERROR');
      return;
    }
    if (this.connectionClosed) {
      this.finishTerminalSilently(
        namespaceId,
        admission.outcome === 'denied' ? 'NAMESPACE_UNAUTHORIZED' : 'INTERNAL_ERROR',
      );
      return;
    }
    if (admission.outcome === 'denied') {
      this.finishTerminal(namespaceId, 'NAMESPACE_UNAUTHORIZED');
      return;
    }
    if (admission.outcome === 'throw') {
      this.finishTerminal(namespaceId, 'INTERNAL_ERROR');
      return;
    }
    const record = this.table.get(namespaceId);
    if (record === undefined || record.phase !== 'pending') return;
    this.table.set(namespaceId, {
      phase: 'pending',
      buffer: record.buffer,
      grant: admission.authorization,
    });
    await this.runResolveInner(namespaceId, admission.authorization);
  }

  /**
   * 宿主解析（阶段 4/6）：`Promise.resolve(...)` 包裹使同步 throw 同归拒绝面；解析失败 →
   * 连接级 `INTERNAL_ERROR` + 1011（恰一帧 + transport close；无静默 fallback）。
   */
  private async runResolveInner(
    namespaceId: string,
    grant: NamespaceAuthorizationGrant,
  ): Promise<void> {
    let sink: HubNamespaceSessionSink | undefined;
    try {
      sink = await Promise.resolve(this.resolveSessionSink(this.connectionKey, namespaceId, grant));
    } catch {
      this.port.connectionFatal('INTERNAL_ERROR', 1011);
      return;
    }
    if (this.connectionClosed) {
      // 迟归解析于已收口连接：归一卫生通知 + 缓冲丢弃（零投递零 wire）
      if (sink !== undefined) this.notifyConnectionClosed(sink);
      this.discardBuffer(namespaceId);
      return;
    }
    if (sink === undefined) {
      // SD-5：合法无 sink ≠ 失败 → 终态记录 + 缓冲静默丢弃（含合流 OPEN）+ settled。
      // SA4 F2：释放必须先于 phase 迁移——设计 §8.2 的 `discardBuffer` 守卫是缓冲在场判定，
      // 而迁移后的 no-sink 记录不再携带 buffer；原次序（先 `table.set` 后 discard）使
      // `pendingFrameCount` 永不递减 = 连接级帧预算泄漏（累积后健康窗口被虚假 1008 收口）。
      this.discardBuffer(namespaceId);
      this.table.set(namespaceId, { phase: 'no-sink', grant });
      this.pendingOpenCount -= 1;
      this.port.onChannelSettled(namespaceId);
      return;
    }
    const record = this.table.get(namespaceId);
    if (record === undefined || record.phase !== 'pending') {
      // 结构上不可达（记录必为 pending）：迟归卫生通知 + 缓冲丢弃
      this.notifyConnectionClosed(sink);
      this.discardBuffer(namespaceId);
      return;
    }
    this.table.set(namespaceId, { phase: 'established', sink });
    this.pendingOpenCount -= 1;
    this.flushPending(record.buffer, sink);
  }

  // ─────────────────────────────── 单点账目（SA2 N4） ───────────────────────────────

  /** 释放缓冲并递减连接级账目（flush / discard / terminal 三处共用唯一递减点）。 */
  private releaseBuffer(buffer: PendingItem[]): PendingItem[] {
    this.pendingFrameCount -= buffer.length;
    const items = buffer.slice();
    buffer.length = 0;
    return items;
  }

  /** 丢弃缓冲并归还连接级预算（SA2 N4 单点账目）。守卫按**缓冲在场**判定（对齐设计 §8.2
   *  `discardBuffer`：`rec.buffer.length === 0` 早退）而非 phase——phase 迁移不得使预算归还
   *  失效（SA4 F2 根因）；联合类型下仅 pending 记录携带 buffer，故与 phase 判定等价。 */
  private discardBuffer(namespaceId: string): void {
    const record = this.table.get(namespaceId);
    if (record === undefined || !('buffer' in record)) return;
    this.releaseBuffer(record.buffer);
  }

  /** 冲刷（阶段 7）：按 kind 分派投递面（R3）+ 到达序保序。 */
  private flushPending(buffer: PendingItem[], sink: HubNamespaceSessionSink): void {
    for (const item of this.releaseBuffer(buffer)) {
      if (item.kind === 'open') this.deliverOpen(sink, item.message);
      else this.deliverFrame(sink, item.message, item.sequence);
    }
  }

  // ─────────────────────────────── 投放点（R5/ER-2：sink throw = 宿主缺陷 → 连接终局） ───────────────────────────────

  private deliverOpen(sink: HubNamespaceSessionSink, message: HubOpenNamespaceMessage): void {
    try {
      sink.openNamespace(message);
    } catch {
      this.port.connectionFatal('INTERNAL_ERROR', 1011);
    }
  }

  private deliverFrame(sink: HubNamespaceSessionSink, message: ReplicationMessage, sequence: number): void {
    try {
      sink.namespaceFrame(message, sequence);
    } catch {
      this.port.connectionFatal('INTERNAL_ERROR', 1011);
    }
  }

  private notifyConnectionClosed(sink: HubNamespaceSessionSink): void {
    try {
      void Promise.resolve(sink.onConnectionClosed()).catch(() => undefined);
    } catch {
      // 同步 throw 同归归一（R5：宿主清理缺陷不穿透连接收口）
    }
  }

  // ─────────────────────────────── 终局（deny/throw/reject：单体 finishOpenError 形状） ───────────────────────────────

  private finishTerminal(
    namespaceId: string,
    code: 'NAMESPACE_UNAUTHORIZED' | 'INTERNAL_ERROR',
  ): void {
    if (this.connectionClosed) {
      this.finishTerminalSilently(namespaceId, code);
      return;
    }
    const record = this.table.get(namespaceId);
    if (record === undefined || record.phase !== 'pending') return;
    const items = this.releaseBuffer(record.buffer);
    const openCount = items.filter((item) => item.kind === 'open').length;
    // 应答帧数 = 缓冲 OPEN 项数（单体 waiter 语义：N 个合流 OPEN → N 帧）
    this.sendNamespaceReplies(code, namespaceId, openCount);
    this.emitNamespaceErrorSent(code, namespaceId); // HB2：恰一（不按应答帧数）
    this.emitNamespaceFailed(namespaceId); // 迁移 failed 时恰一
    this.table.set(namespaceId, code === 'NAMESPACE_UNAUTHORIZED' ? { phase: 'denied' } : { phase: 'failed' });
    this.pendingOpenCount -= 1;
    this.port.onChannelSettled(namespaceId);
  }

  /** 连接已收口的迟归结算（R4b）：零 wire、零 observer 事件、零 settled（单体
   *  `finishOpenSilently` 逐点同构；闩锁防重入 + 缓冲丢弃 + 账目）。 */
  private finishTerminalSilently(
    namespaceId: string,
    code: 'NAMESPACE_UNAUTHORIZED' | 'INTERNAL_ERROR',
  ): void {
    const record = this.table.get(namespaceId);
    if (record === undefined || record.phase !== 'pending') return;
    this.releaseBuffer(record.buffer);
    this.pendingOpenCount -= 1;
    this.table.set(namespaceId, code === 'NAMESPACE_UNAUTHORIZED' ? { phase: 'denied' } : { phase: 'failed' });
  }

  /** deny/throw/reject 的 ns ERROR 应答（帧构造单源 `namespaceErrorFrame` + 占位编码 →
   *  edge 盖章单点）；发送面防御 catch 镜像 `sendChecked` 形状（SA2 M1/ER-7）。 */
  private sendNamespaceReplies(code: string, namespaceId: string, count: number): void {
    try {
      for (let index = 0; index < count; index += 1) {
        this.port.sendControlFrame(
          encodeMessage(namespaceErrorFrame(code, namespaceId), { sequence: 0 }),
        );
      }
    } catch {
      // 编码/发送面异常（理论不可达）：终局照常落定（闩锁 + 丢弃 + settled）
    }
  }

  /** 重开拒答（仅 wire 帧、无事件——单体 `sendChecked` 形状）。 */
  private sendNamespaceReply(code: string, namespaceId: string): void {
    try {
      this.port.sendControlFrame(
        encodeMessage(namespaceErrorFrame(code, namespaceId), { sequence: 0 }),
      );
    } catch {
      // 连接已收口/编码不可信：best-effort（edge R-none 同形）
    }
  }

  /** no-sink 合法帧的合成违例（形状复刻 `hub-edge.ts:570–586`：帧 + 事件 + 连接存活）。 */
  private synthesizeStateViolation(namespaceId: string): void {
    try {
      this.port.sendControlFrame(
        encodeMessage(namespaceErrorFrame('NAMESPACE_STATE_VIOLATION', namespaceId), { sequence: 0 }),
      );
    } catch {
      // 连接已收口；忽略
    }
    this.port.emitObserver({
      type: 'namespace-error',
      side: 'hub',
      // issue #423（ADR 0032 决策 5 / 协议 §23.3 在场纪律）：本复刻面与单体发射体同构——
      // `connectionId` 在握手完成后恒在场（条件展开单点 `cidField`，非无条件加字段）。
      ...cidField(this.port.connectionId()),
      namespaceId,
      code: 'NAMESPACE_STATE_VIOLATION',
      direction: 'sent',
    });
  }

  private emitNamespaceErrorSent(
    code: 'NAMESPACE_UNAUTHORIZED' | 'INTERNAL_ERROR',
    namespaceId: string,
  ): void {
    this.port.emitObserver({
      type: 'namespace-error',
      side: 'hub',
      // issue #423 AC3：edge 复现拒绝路径的 §23.3 在场纪律收口（值 = 端口 connectionId() =
      // 句柄 connectionKey 单一键系统；HELLO 门之后恒在场，条件展开保留握手前防御形状）。
      ...cidField(this.port.connectionId()),
      namespaceId,
      code,
      direction: 'sent',
    });
  }

  private emitNamespaceFailed(namespaceId: string): void {
    const event: ReplicationObserverEvent = {
      type: 'namespace-failed',
      side: 'hub',
      ...cidField(this.port.connectionId()),
      namespaceId,
      cause: 'open-failed',
    };
    this.port.emitObserver(event);
  }

  // ─────────────────────────────── 4 控制信号（设计 §8.2 尾部） ───────────────────────────────

  /** `'close'` 信号（幂等 closeTail）：逐 established sink 归一（R5/ER-3——`close()`/`settle()`
   *  恒 resolve，内部 edge 的 `cleanupAll → settleTail → onConnectionDropped` 不被宿主缺陷跳过）。 */
  close(): Promise<void> {
    this.connectionClosed = true;
    const tails: Array<Promise<void>> = [];
    for (const record of this.table.values()) {
      if (record.phase !== 'established') continue;
      try {
        tails.push(Promise.resolve(record.sink.onConnectionClosed()).then(() => undefined, () => undefined));
      } catch {
        // 同步 throw 同归归一
      }
    }
    return Promise.all(tails).then(() => undefined);
  }

  /** `'terminateUnauthorized'` 信号：established → sink 委托后归一（恒 resolve）；其余无副作用。 */
  terminateNamespace(namespaceId: string): Promise<void> {
    const record = this.table.get(namespaceId);
    if (record === undefined || record.phase !== 'established') return Promise.resolve();
    try {
      return Promise.resolve(record.sink.terminateUnauthorized()).then(() => undefined, () => undefined);
    } catch {
      return Promise.resolve();
    }
  }

  /** listen 形态 wheel/shed facet 查询：工厂形态 dormant（缺面 = 降级，ADR 决策 5）。 */
  dataFacetOf(): undefined {
    return undefined;
  }
}

// ═══════════════════════════ 公共连接句柄（设计 §7 D7） ═══════════════════════════

class HostEdgeConnection implements HubReplicationEdgeConnection {
  readonly connectionKey: string;
  readonly egress: HubReplicationEdgeEgress;

  constructor(
    private readonly edge: HubReplicationEdge,
    private readonly adapter: HostSessionAdapter,
  ) {
    this.connectionKey = adapter.connectionKey;
    const port = adapter.port;
    this.egress = {
      sendControlFrame: (frame) => port.sendControlFrame(frame),
      // 判定次序 = `hub-session.ts:210–216` sendData（门前置 → 守卫 → 账本 → 出队盖章）
      sendDataFrame: (frame) =>
        port.connectionState() === 'closed' || !port.dataGateOpen() ? 0 : port.sendDataFrame(frame),
      namespaceSettled: (namespaceId) => port.onChannelSettled(namespaceId),
      connectionFatal: (code, wsCloseCode) => port.connectionFatal(code, wsCloseCode),
      chunkedUpdateNegotiated: () => port.chunkedUpdateNegotiated(),
    };
  }

  get state(): HubConnectionState {
    return this.edge.state;
  }

  get peerInstanceId(): string | undefined {
    return this.edge.peerInstanceId;
  }

  get authenticatedInstanceId(): string {
    return this.edge.authenticatedInstanceId;
  }

  get namespaces(): ReadonlySet<string> {
    return this.adapter.establishedNamespaces();
  }

  close(code?: number, reason?: string): void {
    this.edge.close(code, reason);
  }

  settle(): Promise<void> {
    return this.edge.settle();
  }

  beginReauth(): void {
    this.edge.beginReauth();
  }

  revokeNamespace(namespaceId: string): Promise<void> {
    return this.edge.revokeNamespace(namespaceId);
  }
}

// ═══════════════════════════ 工厂（设计 §8.1） ═══════════════════════════

/** 形状门（缺成员/非函数 → TypeError，message 恒定不回显传入值；`validate.ts` 同款纪律）。 */
function assertCallable(value: unknown, name: string): void {
  if (typeof value !== 'function') throw new TypeError(`${name}: ${name} 必须是函数`);
}

function hasOwnKey(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

class HubReplicationEdgeFactoryImpl implements HubReplicationEdgeFactory {
  private readonly limits: ResolvedLimits;
  private readonly timeouts: ResolvedTimeouts;
  private connectionCounter = 0;

  constructor(private readonly options: HubReplicationEdgeOptions) {
    validateInstanceId(options.instanceId, 'instanceId');
    if (options.timer === null || typeof options.timer !== 'object') {
      throw new TypeError('timer: timer 必须是对象');
    }
    assertCallable(options.timer.setTimeout, 'timer.setTimeout');
    assertCallable(options.timer.clearTimeout, 'timer.clearTimeout');
    assertCallable(options.authorize, 'authorize');
    assertCallable(options.resolveSessionSink, 'resolveSessionSink');
    if (options.verifyToken !== undefined) assertCallable(options.verifyToken, 'verifyToken');
    const limits = resolveLimits(options.limits);
    const timeouts = resolveTimeouts(options.timeouts);
    validateLimits(limits);
    validateTimeouts(timeouts);
    // 分块族跨字段响亮链（与单体组合根同款条件链：仅显式表达链上键时激活）
    if (
      options.limits != null &&
      (hasOwnKey(options.limits, 'maxChunkedUpdateBytes') || hasOwnKey(options.limits, 'maxChunksPerUpdate'))
    ) {
      validateChunkedTransferChain(limits);
    }
    if (options.limits != null && hasOwnKey(options.limits, 'maxChunkedBootstrapBytes')) {
      validateChunkedBootstrapChain(limits);
    }
    if (options.limits != null && hasOwnKey(options.limits, 'maxChunkedSyncDiffBytes')) {
      validateChunkedSyncDiffChain(limits);
    }
    this.limits = limits;
    this.timeouts = timeouts;
  }

  /** `auth-upgrade-rejected` 发射（pre-connection：无 connectionId 可挂——文档化形态）。 */
  private emitUpgradeRejected(
    reason:
      | 'missing-token'
      | 'verifier-missing'
      | 'frame-too-large'
      | 'early-frame-limit'
      | 'auth-timeout'
      | 'invalid-credentials'
      | 'invalid-instance-id'
      | 'peer-disconnected',
  ): void {
    const observer = this.options.observer;
    if (observer === undefined) return;
    dispatchReplicationObserver(observer, { type: 'auth-upgrade-rejected', side: 'hub', reason });
  }

  async accept(
    transport: DuplexTransport,
    request?: HubUpgradeRequest,
  ): Promise<HubReplicationEdgeConnection | undefined> {
    // ── 门 1：缺凭据（未传 request / 无 token 字段 / 非字符串 / 空串）→ 拒绝 ──
    const token = request?.token;
    if (typeof token !== 'string' || token.length === 0) {
      transport.close(1008, 'upgrade-unauthorized'); // 静态 reason，零 token/身份回显
      this.emitUpgradeRejected('missing-token');
      return undefined;
    }
    // ── 门 2：无认证器 → fail-closed（类型可选 ≠ 运行时容错；协议 §2 硬核） ──
    const verifyToken = this.options.verifyToken;
    if (typeof verifyToken !== 'function') {
      transport.close(1008, 'upgrade-unauthorized');
      this.emitUpgradeRejected('verifier-missing');
      return undefined;
    }
    // ── 门 3：共享有界早到帧 admission（单点复用 `hub-upgrade-admission.ts`） ──
    const admission = installEarlyFrameAdmission(
      transport,
      this.limits,
      (reason) => this.emitUpgradeRejected(reason),
    );
    if (admission.isRejected() || admission.isEarlyClosed()) {
      admission.detach();
      return undefined;
    }
    // 认证等待封顶（复用 timeouts.helloTimeoutMs——零新 knob）
    const authHandle = this.options.timer.setTimeout(() => {
      admission.markRejected();
      admission.detach();
      if (!transport.closed) transport.close(1008, 'upgrade-timeout');
      this.emitUpgradeRejected('auth-timeout');
    }, this.timeouts.helloTimeoutMs);
    const clearAuthTimer = (): void => {
      this.options.timer.clearTimeout(authHandle);
    };

    // ── 门 4：验证（accept 永不 reject——promise 恒 resolve） ──
    let instanceId: unknown;
    try {
      const verdict = await verifyToken(token);
      clearAuthTimer(); // 首要动作：验证器已归，封顶 timer 必清
      if (admission.isRejected()) return undefined; // 缓冲期已拒（帧限/超时）——迟归不复活
      if (verdict === null || typeof verdict !== 'object' || (verdict as { ok?: unknown }).ok !== true) {
        this.emitUpgradeRejected('invalid-credentials');
        return this.rejectUpgrade(transport, admission.detach);
      }
      instanceId = (verdict as { instanceId: unknown }).instanceId;
    } catch {
      clearAuthTimer();
      if (admission.isRejected()) return undefined;
      this.emitUpgradeRejected('invalid-credentials');
      return this.rejectUpgrade(transport, admission.detach);
    }
    // A2-d 零宽窗口面（次序对齐单体，R6）：先让出一次微任务，使排队中的帧先进入早到缓冲
    // （超界 → 1009 / 条数界 → 1008），迟拒复查之后再跑 instanceId 文法。
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    if (admission.isRejected()) return undefined;
    if (!isValidInstanceId(instanceId)) {
      this.emitUpgradeRejected('invalid-instance-id');
      return this.rejectUpgrade(transport, admission.detach);
    }
    // ── 门 5：认证期间世界变化（先摘早到监听 → 再检查 → 再构造） ──
    admission.detach();
    if (admission.isEarlyClosed() || transport.closed) {
      this.emitUpgradeRejected('peer-disconnected'); // 对端已断：零分配、零 close 副作用
      return undefined;
    }
    return this.allocate(transport, instanceId as string, admission.frames);
  }

  async acceptTrusted(
    transport: DuplexTransport,
    identity: UpgradeIdentity,
  ): Promise<HubReplicationEdgeConnection | undefined> {
    if (!isValidInstanceId(identity?.peerInstanceId)) {
      transport.close(1008, 'upgrade-unauthorized');
      this.emitUpgradeRejected('invalid-instance-id');
      return undefined;
    }
    // 共享有界早到帧 admission（与 accept() 门 3 同一机制单点）；trusted 路径无验证器、
    // 无 auth timer（单同步段零 await）。
    const admission = installEarlyFrameAdmission(
      transport,
      this.limits,
      (reason) => this.emitUpgradeRejected(reason),
    );
    if (admission.isRejected()) {
      admission.detach();
      return undefined; // 帧限拒绝已完成 close + 事件——零分配、零补发
    }
    if (admission.isEarlyClosed() || transport.closed) {
      admission.detach();
      this.emitUpgradeRejected('peer-disconnected');
      return undefined;
    }
    admission.detach();
    return this.allocate(transport, identity.peerInstanceId, admission.frames);
  }

  private rejectUpgrade(transport: DuplexTransport, detachEarly: () => void): undefined {
    detachEarly(); // 幂等——预算路径已摘时零副作用
    transport.close(1008, 'upgrade-unauthorized');
    return undefined;
  }

  /** 分配（一次 accept 一个内部 edge 实例）：connectionKey 与既有 observability
   *  `connectionId` 同串（单一键系统，设计 D5）。 */
  private allocate(
    transport: DuplexTransport,
    peerInstanceId: string,
    earlyFrames: readonly Uint8Array[],
  ): HubReplicationEdgeConnection {
    const connectionCounter = this.connectionCounter;
    this.connectionCounter += 1;
    const connectionKey = `${this.options.instanceId}-conn-${connectionCounter}`;
    const options = this.options;
    let adapter: HostSessionAdapter | undefined;
    const edge = createEdgeConnection({
      transport,
      timer: options.timer,
      limits: this.limits,
      timeouts: this.timeouts,
      ...(options.observer === undefined ? {} : { observer: options.observer }),
      ...(options.clock === undefined ? {} : { clock: options.clock }),
      instanceId: options.instanceId,
      peerInstanceId,
      connectionCounter,
      authorize: options.authorize,
      earlyFrames,
      sessionFactory: (port) => {
        adapter = new HostSessionAdapter({
          connectionKey,
          port,
          resolveSessionSink: options.resolveSessionSink,
        });
        return adapter;
      },
      // 工厂无服务面连接清单（设计 §1 非目标）：drop 通知 = no-op（M2 缺省登记）
      onConnectionDropped: () => undefined,
    });
    const created = adapter;
    if (created === undefined) {
      // 构造期不变量破坏（sessionFactory 为构造期同步调用）：fail-loud，无静默 fallback
      throw new Error('hub-edge-host: session adapter 未装配');
    }
    return new HostEdgeConnection(edge, created);
  }
}

/**
 * 工厂：连接级半边的宿主公共出面（ADR 0032:41 后果节「edge 以普通工厂导出」）。
 *
 * 非 Cordis 插件、无 Registry 依赖：宿主注入 `authorize` / `resolveSessionSink` /
 * `verifyToken` 与全部 seam（timer/limits/timeouts/observer/clock）；每次 `accept` /
 * `acceptTrusted` 分配一个独立内部 edge 实例（连接隔离）并返回连接句柄。
 */
export function createHubReplicationEdge(
  options: HubReplicationEdgeOptions,
): HubReplicationEdgeFactory {
  return new HubReplicationEdgeFactoryImpl(options);
}
