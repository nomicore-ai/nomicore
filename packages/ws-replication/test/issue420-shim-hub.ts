/**
 * issue #420 —— 宿主桥 + shim hub（**test-only 夹具**；SA6 §12.2/§12.3、设计 §7 D6/D7）。
 *
 * 拓扑（无 socket、无跨线程面）：
 *   真 peer（`createPeerReplication`）↔ `makeWire()`（内存双端）↔ 真 edge
 *   （`createHubReplicationEdge`）↔ **宿主桥**（本文件：字节/JSON 中继 + 按准入结局路由）
 *   ↔ 公共 `createHubSessionHost`（session 半边）↔ 真 Registry/Runtime fixture。
 *
 * 职责边界（夹具只搬运，零协议决策——AC3「零 fork」）：
 * - accept/acceptTrusted 门链 = **宿主职责**的镜像（verifyToken → identity），只做组合；
 * - 首 OPEN 到达点：`port.openAdmission(ns)` 拉取 edge 侧已结算投影 → `host.open(descriptor)`
 *   （纯 JSON）→ 转发 OPEN 帧字节；
 * - 后续帧：`encodeMessage(message, { sequence })` → `handleFrame(bytes)`（顺序保真 +
 *   有界 pending 窗口）；
 * - `onFrame((frame, lane) => port.sendControlFrame/sendDataFrame(frame))` 原样回传返回序；
 * - `onSignal` → `port.onChannelSettled` / `port.connectionFatal(code)`；
 * - 不合成任何应答帧、不选错误码、不实现通道 FSM：拒绝路径（denied/throw）投递给**生产**
 *   `createHubSessionSink` 实例（denialSink，真 port 直连），wire 行为由零 diff 生产代码产出
 *   （设计 §7 D6 裁决 (i)：edge 侧处置）。
 *
 * 路由相位（每 (连接, namespace)；装配状态，**非协议 FSM**——设计 §7 D7 / §8.1）：
 *   routing → authorized | denied（互斥、单调、不可逆；桥 closed 守卫可放弃在途 routing）。
 *   `openNamespace` 三分支（SA2-F1）：① authorized → 既有句柄转发（不再调 `open()`）；
 *   ② routing → 有界 pending 窗口（≤16 帧/ns + 单帧 ≤ maxFrameBytes）按到达序冲刷；
 *   ③ denied → `denialSink.openNamespace`（通道在场 → `onOpen` 重开矩阵）。
 *
 * **载体提交（carrier commit；登记项，供 SA8 impl 复查）**：相位 `routing` 期间的**非 OPEN**
 * ns 域帧不留在窗口，而是立即把该 ns 提交给 `denialSink`（= 生产 splice + 真 port，与 listen
 * 在首 OPEN 到达点建成的通道**同一生产机械**）：`denialSink.openNamespace(firstOpen)` →
 * `denialSink.namespaceFrame(frame, sequence)`。理由 = 逐字节一致纪律（AC3 硬门）：listen 形态
 * 下此类帧到达的是**到达点已建成的生产通道**（由通道自身状态机判定合法/违例），而公共
 * `host.open()` 需要已结算投影、结构上晚于该到达点；若把此类帧留在窗口，`ac7-faults`
 * 「OPEN_OK 之前的 UPDATE → NAMESPACE_STATE_VIOLATION」（该用例断言于授权结算**之前**）将
 * 因投递被推迟而红。提交后相位落入吸收态 `denied`（承载机械已定，不再创建公共句柄），
 * 入窗的 OPEN 条目随提交放弃（listen：abort 时 `openWaiters` 静默丢弃——同构）。
 * 触点 = 本夹具文件内的装配路由；不触公共冻结签名/DENY 面/port 成员集/验收语义。
 *
 * 夹具头注登记（SA2 N1/R12 + RA6'(vi)，防止未来把本夹具误当规范宿主样例）：
 * - accept 门链与 `hub-connection.ts` 的保真度差异清单：未镜像「验证器续体后的单微任务
 *   让位」后的全部次序细节（本夹具保留同款单微任务让位）、未镜像 `rejectUpgrade` 的
 *   `auth-upgrade-rejected` observer 事件面（当前 7 矩阵 + AC2 回合均不触）；
 * - `terminateNamespace` 在相位 `routing` 期只能挂起至路由完成（listen 形态下 revoke 命中
 *   `'opening'` 通道立即发 ns ERROR——R11 观测边界：7 矩阵零 revoke 用例、A10 为 live 后
 *   直调，不触及；未来矩阵加该场景前须先扩设计）；
 * - authorized ns 不投影到 edge `.channels`（唯一投影 = denialSink 通道表；R7 观测边界）。
 *
 * mock 安全（设计 §7 D8）：本文件**只深路径 import**（`../src/*.js`）；绝不 import 包入口，
 * 否则 `vi.mock('@nomicore/ws-replication')` 工厂内会递归取到 mock 自身。
 */
import {
  CAP_CHUNKED_UPDATE,
  encodeMessage,
  type ReplicationMessage,
} from '@nomicore/replication-protocol';
import type { NamespaceRegistry } from '@nomicore/namespace-registry';
import { createHubReplicationEdge, type HubReplicationEdge } from '../src/hub-edge.js';
import type { HubNamespaceChannel } from '../src/hub-namespace.js';
import {
  createHubSessionHost,
  type HubSessionFrameLane,
  type HubSessionHandle,
  type HubSessionHost,
  type HubSessionOpenInput,
  type HubSessionSignal,
} from '../src/hub-session-host.js';
import { createHubSessionSink } from '../src/hub-session.js';
import type {
  HubSessionEdgePort,
  HubSessionSink,
  OpenNamespaceInbound,
} from '../src/hub-split.js';
import { resolveLimits, resolveTimeouts } from '../src/defaults.js';
import {
  isValidInstanceId,
  validateHubOptions,
  validateLimits,
  validateTimeouts,
} from '../src/validate.js';
import type {
  DuplexTransport,
  HubConnection,
  HubReplication,
  HubReplicationOptions,
  HubUpgradeRequest,
  ReplicationClock,
  ReplicationObserver,
  ReplicationTimer,
  ResolvedLimits,
  ResolvedTimeouts,
  UpgradeIdentity,
} from '../src/types.js';

/** 早到帧条数界（镜像 `hub-connection.ts` 的 `MAX_EARLY_FRAMES` 先例）。 */
const MAX_EARLY_FRAMES = 16;

/** 桥 pending 窗口条数界（S2/R4''：每 ns ≤16 帧，含在途 OPEN；镜像同一先例）。 */
const MAX_PENDING_FRAMES = 16;

/** 帧头 `[8..12]` 大端读取（判据 = wire 原字节，非解码对象）。 */
function rawSequence(bytes: Uint8Array): number {
  return ((bytes[8]! << 24) | (bytes[9]! << 16) | (bytes[10]! << 8) | bytes[11]!) >>> 0;
}

/** 缝内（`handleFrame` 方向）观测项：namespace 域 wire 帧 + 其携带序（OPEN 中继序 = 合成 0）。 */
export interface ShimSeamFrameIn {
  readonly kind: ReplicationMessage['kind'];
  readonly sequence: number;
  readonly bytes: Uint8Array;
}

/** 缝外（`onFrame` 方向）观测项：出站帧恒 `sequence=0` 占位（edge mux 点盖章）。 */
export interface ShimSeamFrameOut {
  readonly lane: HubSessionFrameLane;
  readonly placeholderSequence: number;
  readonly bytes: Uint8Array;
}

/** 夹具探针（AC2 A1~A11 + AC3 反空跑 + RA6' 诊断）。 */
export interface ShimHubProbes {
  connectionsOpened: number;
  sessionsOpened: number;
  denialRouted: number;
  /** 载体提交计数（相位 routing 期非 OPEN 帧 → 生产 splice 承载；见头注登记）。 */
  carrierCommitted: number;
  reopenForwarded: number;
  pendingFlushed: number;
  pendingOverflow: number;
  readonly seamFramesIn: ShimSeamFrameIn[];
  readonly seamFramesOut: ShimSeamFrameOut[];
  readonly sinkReturns: number[];
  readonly signals: HubSessionSignal[];
  readonly openInputs: HubSessionOpenInput[];
  readonly handles: Map<string, HubSessionHandle>;
}

function makeShimProbes(): ShimHubProbes {
  return {
    connectionsOpened: 0,
    sessionsOpened: 0,
    denialRouted: 0,
    carrierCommitted: 0,
    reopenForwarded: 0,
    pendingFlushed: 0,
    pendingOverflow: 0,
    seamFramesIn: [],
    seamFramesOut: [],
    sinkReturns: [],
    signals: [],
    openInputs: [],
    handles: new Map(),
  };
}

/** 红臂开关（AC2 A12 / 变异 M1）：真 port 照常盖章出帧，但向 session 回传 0（宿主未回传序）。 */
export interface ShimHubOptions {
  readonly suppressSequenceReturn?: boolean;
}

export interface ShimHub {
  readonly replication: HubReplication;
  readonly probes: ShimHubProbes;
}

/** 本测试文件内全部 shim 实例（AC3 反空跑聚合观测面）。 */
export const shimHubRuns: ShimHub[] = [];

function namespaceOf(message: ReplicationMessage): string | undefined {
  return 'namespaceId' in message ? message.namespaceId : undefined;
}

interface PendingEntry {
  readonly message: ReplicationMessage;
  readonly bytes: Uint8Array;
  readonly isOpen: boolean;
  readonly sequence: number;
}

interface RouteState {
  phase: 'routing' | 'authorized' | 'denied';
  readonly namespaceId: string;
  /** 首 OPEN（到达点投递的形态；提交到生产 splice 时原样重投）。 */
  readonly firstOpen: OpenNamespaceInbound;
  readonly pending: PendingEntry[];
  handle: HubSessionHandle | undefined;
  readonly terminateWaiters: Array<() => void>;
}

interface BridgeConfig {
  readonly registry: NamespaceRegistry;
  readonly instanceId: string;
  readonly connectionKey: string;
  readonly remoteInstanceId: string;
  readonly timer: ReplicationTimer;
  readonly limits: ResolvedLimits;
  readonly timeouts: ResolvedTimeouts;
  readonly observer: ReplicationObserver | undefined;
  readonly clock: ReplicationClock | undefined;
  readonly probes: ShimHubProbes;
  readonly suppressSequenceReturn: boolean;
}

/**
 * 宿主桥：`HubSessionSink` 实现方（edge 的直接调用方）+ 公共 session 工厂的宿主装配。
 * 唯一变换 = 已解码消息 ↔ 字节的中继（`encodeMessage` 逐字节保真）+ port 成员搬运。
 */
class HostBridge implements HubSessionSink {
  private readonly denial: HubSessionSink;
  private readonly host: HubSessionHost;
  private readonly routes = new Map<string, RouteState>();
  private closeTail: Promise<void> | undefined;
  private closedFlag = false;

  constructor(
    private readonly port: HubSessionEdgePort,
    private readonly config: BridgeConfig,
  ) {
    // 拒绝路径承载机械：**生产** sink 直连真 port（设计 §7 D6）——不做协议决策。
    this.denial = createHubSessionSink({
      port,
      registry: config.registry,
      instanceId: config.instanceId,
      peerInstanceId: config.remoteInstanceId,
      timer: config.timer,
      limits: config.limits,
      timeouts: config.timeouts,
    });
    this.host = createHubSessionHost({
      registry: config.registry,
      instanceId: config.instanceId,
      limits: config.limits,
      timeouts: config.timeouts,
      timer: config.timer,
      ...(config.observer !== undefined ? { observer: config.observer } : {}),
      ...(config.clock !== undefined ? { clock: config.clock } : {}),
    });
  }

  // ─────────────────────────────── sink 面（edge → 桥） ───────────────────────────────

  get channels(): ReadonlyMap<string, HubNamespaceChannel> {
    return this.denial.channels;
  }

  dataFacetOf(namespaceId: string): ReturnType<HubSessionSink['dataFacetOf']> {
    return this.denial.dataFacetOf(namespaceId);
  }

  openNamespace(message: OpenNamespaceInbound): void {
    const namespaceId = message.namespaceId;
    const route = this.routes.get(namespaceId);
    if (route === undefined) {
      // 台账首建（edge `beginAdmission` 先于投递）：进入 routing 相位并拉取已结算投影。
      const state: RouteState = {
        phase: 'routing',
        namespaceId,
        firstOpen: message,
        pending: [],
        handle: undefined,
        terminateWaiters: [],
      };
      this.routes.set(namespaceId, state);
      void this.routeAdmission(state);
      return;
    }
    if (route.phase === 'authorized') {
      // 分支 ①：不再调 `open()`——OPEN 帧字节经既有句柄转发，重开矩阵由生产通道产出。
      this.config.probes.reopenForwarded += 1;
      this.forwardOpen(route.handle as HubSessionHandle, message);
      return;
    }
    if (route.phase === 'denied') {
      // 分支 ③：denialSink 通道在场 → 生产 `onOpen` 承接重开矩阵。
      this.denial.openNamespace(message);
      return;
    }
    // 分支 ②：在途 OPEN 入同一有界 pending 窗口（按到达序）。
    this.enqueue(route, {
      message,
      bytes: encodeMessage(message, { sequence: 0 }),
      isOpen: true,
      sequence: 0,
    });
  }

  namespaceFrame(message: ReplicationMessage, sequence: number): void {
    const namespaceId = namespaceOf(message);
    const route = namespaceId === undefined ? undefined : this.routes.get(namespaceId);
    if (route === undefined) {
      // 装配不变量破坏（edge 只在台账命中 ⟺ 首 OPEN 已投递后投递 ns 帧）→ 响亮收口。
      this.port.connectionFatal('INTERNAL_ERROR', 1011);
      return;
    }
    if (route.phase === 'authorized') {
      this.forwardFrame(route.handle as HubSessionHandle, message, sequence);
      return;
    }
    if (route.phase === 'denied') {
      this.denial.namespaceFrame(message, sequence);
      return;
    }
    if (message.kind === 'OPEN_NAMESPACE') {
      // 防御分支（edge 的 OPEN 恒走 `openNamespace`）：与内部 splice 的防御分支同形入窗。
      this.enqueue(route, {
        message,
        bytes: encodeMessage(message, { sequence: 0 }),
        isOpen: true,
        sequence: 0,
      });
      return;
    }
    // 非 OPEN 帧 + 相位 routing → 载体提交（头注登记项）：生产 splice 立即承接，
    // 由通道自身状态机产出违例/终局（与 listen 到达点同构）。
    this.commitToProduction(route, message, sequence);
  }

  private commitToProduction(
    route: RouteState,
    message: ReplicationMessage,
    sequence: number,
  ): void {
    if (route.phase !== 'routing') return;
    route.phase = 'denied'; // 吸收态：承载机械 = denialSink（生产 splice）
    route.pending.length = 0;
    this.config.probes.carrierCommitted += 1;
    this.denial.openNamespace(route.firstOpen);
    this.denial.namespaceFrame(message, sequence);
  }

  close(): Promise<void> {
    if (this.closeTail !== undefined) return this.closeTail;
    // closed 守卫先置位：在途 routing 续体完成时放弃（零可观察输出）。
    this.closedFlag = true;
    const tails: Array<Promise<void>> = [this.denial.close()];
    for (const route of this.routes.values()) {
      if (route.handle !== undefined) tails.push(route.handle.close());
    }
    this.closeTail = Promise.all(tails).then(() => undefined);
    return this.closeTail;
  }

  terminateNamespace(namespaceId: string): Promise<void> {
    if (this.closedFlag) return Promise.resolve();
    const route = this.routes.get(namespaceId);
    if (route === undefined) return Promise.resolve(); // 无通道 → no-op resolve（listen 同构）
    if (route.phase === 'authorized' && route.handle !== undefined) {
      return route.handle.terminateUnauthorized();
    }
    if (route.phase === 'denied') return this.denial.terminateNamespace(namespaceId);
    // 相位 routing：挂起至路由完成再按结局投递（设计 §7 D7；closed 守卫 → no-op resolve）。
    return new Promise<void>((resolve) => {
      route.terminateWaiters.push(resolve);
    });
  }

  // ─────────────────────────────── 路由续体（桥唯一异步段） ───────────────────────────────

  private async routeAdmission(route: RouteState): Promise<void> {
    const namespaceId = route.namespaceId;
    try {
      const admission = await this.port.openAdmission(namespaceId);
      if (this.closedFlag) return; // closed 守卫：放弃（不 open()、不投递、丢弃 pending）
      if (route.phase !== 'routing') return; // 载体已提交（生产 splice 承接）→ 本续体放弃
      if (admission.outcome === 'authorized') {
        const connectionId = this.port.connectionId();
        const descriptor: HubSessionOpenInput = {
          connectionKey: this.config.connectionKey,
          remoteInstanceId: this.config.remoteInstanceId,
          namespaceId,
          authorization: admission.authorization,
          selectedCapabilities: this.port.chunkedUpdateNegotiated() ? CAP_CHUNKED_UPDATE : 0,
          ...(connectionId !== undefined ? { connectionId } : {}),
        };
        this.config.probes.openInputs.push(descriptor);
        const handle = this.host.open(descriptor);
        route.handle = handle;
        route.phase = 'authorized';
        this.config.probes.sessionsOpened += 1;
        this.config.probes.handles.set(namespaceId, handle);
        handle.onFrame((frame, lane) => this.deliverOutbound(frame, lane));
        handle.onSignal((signal) => {
          this.config.probes.signals.push(signal);
          if (signal.type === 'settled') this.port.onChannelSettled(signal.namespaceId);
          else this.port.connectionFatal(signal.code); // code→close code 映射单点留 edge
        });
        this.forwardOpen(handle, route.firstOpen);
        this.flushAuthorized(route);
      } else {
        // denied / throw：生产 sink 直连真 port——ERROR 帧/终态/事件族/settled 全由零 diff 生产代码产出。
        this.denial.openNamespace(route.firstOpen);
        route.phase = 'denied';
        this.config.probes.denialRouted += 1;
        this.flushDenied(route);
      }
    } catch {
      // 宿主契约外异常（描述子构造等）→ 响亮收口（在册码 INTERNAL_ERROR → 1011），零无承载 reject。
      this.port.connectionFatal('INTERNAL_ERROR', 1011);
    } finally {
      this.settleTerminateWaiters(route);
    }
  }

  private settleTerminateWaiters(route: RouteState): void {
    const waiters = route.terminateWaiters.splice(0);
    if (waiters.length === 0) return;
    const delegate =
      route.phase === 'authorized' && route.handle !== undefined
        ? route.handle.terminateUnauthorized()
        : route.phase === 'denied'
          ? this.denial.terminateNamespace(route.namespaceId)
          : undefined;
    for (const resolve of waiters) {
      if (delegate === undefined) resolve();
      else void delegate.then(resolve, resolve);
    }
  }

  private forwardOpen(handle: HubSessionHandle, message: OpenNamespaceInbound): void {
    // OPEN 中继序 = 桥合成值 0（协议无消费者——SA6 E3 边界登记；可与非 wire 值域区分）。
    const bytes = encodeMessage(message, { sequence: 0 });
    this.config.probes.seamFramesIn.push({ kind: message.kind, sequence: 0, bytes });
    handle.handleFrame(bytes);
  }

  private forwardFrame(handle: HubSessionHandle, message: ReplicationMessage, sequence: number): void {
    const bytes = encodeMessage(message, { sequence });
    this.config.probes.seamFramesIn.push({ kind: message.kind, sequence, bytes });
    handle.handleFrame(bytes);
  }

  /** 出站：真 port 盖章并原样回传被分配序（E1 承重）；红臂下回传 0（= 未回传）。 */
  private deliverOutbound(frame: Uint8Array, lane: HubSessionFrameLane): number {
    // 快照跨越时刻的字节：edge mux 会**就地**改写占位字节 [8..12]（E1 盖章），
    // 因此占位序必须在投递前采样、字节取副本（缝内事实 = 时刻值）。
    this.config.probes.seamFramesOut.push({
      lane,
      placeholderSequence: rawSequence(frame),
      bytes: frame.slice(),
    });
    const assigned =
      lane === 'control' ? this.port.sendControlFrame(frame) : this.port.sendDataFrame(frame);
    this.config.probes.sinkReturns.push(assigned);
    return this.config.suppressSequenceReturn ? 0 : assigned;
  }

  private flushAuthorized(route: RouteState): void {
    const entries = route.pending.splice(0);
    this.config.probes.pendingFlushed += entries.length;
    for (const entry of entries) {
      const handle = route.handle as HubSessionHandle;
      if (entry.isOpen) this.forwardOpen(handle, entry.message as OpenNamespaceInbound);
      else this.forwardFrame(handle, entry.message, entry.sequence);
    }
  }

  private flushDenied(route: RouteState): void {
    const entries = route.pending.splice(0);
    this.config.probes.pendingFlushed += entries.length;
    for (const entry of entries) {
      if (entry.isOpen) this.denial.openNamespace(entry.message as OpenNamespaceInbound);
      else this.denial.namespaceFrame(entry.message, entry.sequence);
    }
  }

  private enqueue(route: RouteState, entry: PendingEntry): void {
    if (
      route.pending.length >= MAX_PENDING_FRAMES ||
      entry.bytes.byteLength > this.config.limits.maxFrameBytes
    ) {
      // S2/R4''：有界 + 顺序保真 + 溢出响亮收口（无静默丢弃）。
      this.config.probes.pendingOverflow += 1;
      route.pending.length = 0;
      this.port.connectionFatal('CONNECTION_POLICY_VIOLATION', 1008);
      return;
    }
    route.pending.push(entry);
  }
}

interface EarlyFrameAdmission {
  readonly frames: Uint8Array[];
  isRejected(): boolean;
  markRejected(): void;
  isEarlyClosed(): boolean;
  detach(): void;
}

/** 有界早到帧 admission（镜像宿主门链纪律：帧到达同步段、三检全过才保留）。 */
function installEarlyFrameAdmission(
  transport: DuplexTransport,
  limits: ResolvedLimits,
): EarlyFrameAdmission {
  const frames: Uint8Array[] = [];
  const state = { rejected: false, earlyClosed: false };
  let offMessage: () => void = () => {};
  let offClose: () => void = () => {};
  offMessage = transport.onMessage((bytes) => {
    if (state.rejected) return;
    if (bytes.byteLength > limits.maxFrameBytes) {
      state.rejected = true;
      transport.close(1009, 'upgrade-frame-limit');
      return;
    }
    if (frames.length >= MAX_EARLY_FRAMES) {
      state.rejected = true;
      transport.close(1008, 'upgrade-frame-limit');
      return;
    }
    frames.push(bytes);
  });
  offClose = transport.onClose(() => {
    state.earlyClosed = true;
  });
  return {
    frames,
    isRejected: () => state.rejected,
    markRejected: () => {
      state.rejected = true;
    },
    isEarlyClosed: () => state.earlyClosed,
    detach: () => {
      offMessage();
      offClose();
    },
  };
}

class ShimHubImpl implements HubReplication {
  private readonly limits: ResolvedLimits;
  private readonly timeouts: ResolvedTimeouts;
  private readonly connectionList: HubReplicationEdge[] = [];
  private readonly probes = makeShimProbes();
  private closed = false;
  private connectionCounter = 0;
  private closeTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly options: HubReplicationOptions,
    private readonly shimOptions: ShimHubOptions,
  ) {
    validateHubOptions(options);
    this.limits = resolveLimits(options.limits);
    this.timeouts = resolveTimeouts(options.timeouts);
    validateLimits(this.limits);
    validateTimeouts(this.timeouts);
  }

  probe(): ShimHubProbes {
    return this.probes;
  }

  async accept(
    transport: DuplexTransport,
    request?: HubUpgradeRequest,
  ): Promise<HubConnection | undefined> {
    if (this.closed) {
      transport.close(1001, 'hub-shutdown');
      return undefined;
    }
    const token = request?.token;
    if (typeof token !== 'string' || token.length === 0) {
      transport.close(1008, 'upgrade-unauthorized');
      return undefined;
    }
    if (typeof this.options.verifyToken !== 'function') {
      transport.close(1008, 'upgrade-unauthorized');
      return undefined;
    }
    const admission = installEarlyFrameAdmission(transport, this.limits);
    if (admission.isRejected() || admission.isEarlyClosed()) {
      admission.detach();
      return undefined;
    }
    const authHandle = this.options.timer.setTimeout(() => {
      admission.markRejected();
      admission.detach();
      if (!transport.closed) transport.close(1008, 'upgrade-timeout');
    }, this.timeouts.helloTimeoutMs);
    const clearAuthTimer = (): void => {
      this.options.timer.clearTimeout(authHandle);
    };
    let instanceId: unknown;
    try {
      const verdict = await this.options.verifyToken(token);
      clearAuthTimer();
      if (admission.isRejected()) return undefined;
      if (
        verdict === null ||
        typeof verdict !== 'object' ||
        (verdict as { ok?: unknown }).ok !== true
      ) {
        return this.rejectUpgrade(transport, admission.detach);
      }
      instanceId = (verdict as { instanceId: unknown }).instanceId;
    } catch {
      clearAuthTimer();
      if (admission.isRejected()) return undefined;
      return this.rejectUpgrade(transport, admission.detach);
    }
    // 单微任务让位（镜像宿主门链：使排队中的首帧先进入早到缓冲再复核）。
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    if (admission.isRejected()) return undefined;
    if (!isValidInstanceId(instanceId)) return this.rejectUpgrade(transport, admission.detach);
    admission.detach();
    if (this.closed) {
      transport.close(1001, 'hub-shutdown');
      return undefined;
    }
    if (admission.isEarlyClosed() || transport.closed) return undefined;
    const connection = this.createEdge(transport, instanceId as string, admission.frames);
    this.connectionList.push(connection);
    this.probes.connectionsOpened += 1;
    return connection;
  }

  async acceptTrusted(
    transport: DuplexTransport,
    identity: UpgradeIdentity,
  ): Promise<HubConnection | undefined> {
    if (this.closed) {
      transport.close(1001, 'hub-shutdown');
      return undefined;
    }
    if (!isValidInstanceId(identity?.peerInstanceId)) {
      transport.close(1008, 'upgrade-unauthorized');
      return undefined;
    }
    const admission = installEarlyFrameAdmission(transport, this.limits);
    if (admission.isRejected()) {
      admission.detach();
      return undefined;
    }
    if (this.closed) {
      admission.detach();
      transport.close(1001, 'hub-shutdown');
      return undefined;
    }
    if (admission.isEarlyClosed() || transport.closed) {
      admission.detach();
      return undefined;
    }
    admission.detach();
    const connection = this.createEdge(transport, identity.peerInstanceId, admission.frames);
    this.connectionList.push(connection);
    this.probes.connectionsOpened += 1;
    return connection;
  }

  async revoke(instanceIdentity: string, namespaceId: string): Promise<void> {
    const tails: Promise<void>[] = [];
    for (const connection of [...this.connectionList]) {
      if (connection.authenticatedInstanceId !== instanceIdentity) continue;
      tails.push(connection.revokeNamespace(namespaceId));
    }
    await Promise.all(tails);
  }

  async requestReauth(instanceIdentity: string): Promise<void> {
    if (this.closed) return;
    for (const connection of [...this.connectionList]) {
      if (connection.authenticatedInstanceId !== instanceIdentity) continue;
      connection.beginReauth();
    }
  }

  get connections(): readonly HubConnection[] {
    return this.connectionList;
  }

  close(): Promise<void> {
    if (this.closed) return this.closeTail;
    this.closed = true;
    for (const connection of [...this.connectionList]) connection.close(1001, 'hub-shutdown');
    this.closeTail = Promise.all(
      this.connectionList.map((connection) => connection.settle()),
    ).then(() => undefined);
    return this.closeTail;
  }

  private rejectUpgrade(transport: DuplexTransport, detachEarly: () => void): undefined {
    detachEarly();
    transport.close(1008, 'upgrade-unauthorized');
    return undefined;
  }

  private createEdge(
    transport: DuplexTransport,
    peerInstanceId: string,
    earlyFrames: readonly Uint8Array[],
  ): HubReplicationEdge {
    let connection: HubReplicationEdge | undefined;
    const connectionKey = `${this.options.instanceId}-conn-${this.connectionCounter}`;
    connection = createHubReplicationEdge({
      transport,
      timer: this.options.timer,
      limits: this.limits,
      timeouts: this.timeouts,
      ...(this.options.observer !== undefined ? { observer: this.options.observer } : {}),
      ...(this.options.clock !== undefined ? { clock: this.options.clock } : {}),
      instanceId: this.options.instanceId,
      peerInstanceId,
      connectionCounter: this.connectionCounter++,
      authorize: this.options.authorize,
      earlyFrames,
      sessionFactory: (port) =>
        new HostBridge(port, {
          registry: this.options.registry,
          instanceId: this.options.instanceId,
          connectionKey,
          remoteInstanceId: peerInstanceId,
          timer: this.options.timer,
          limits: this.limits,
          timeouts: this.timeouts,
          observer: this.options.observer,
          clock: this.options.clock,
          probes: this.probes,
          suppressSequenceReturn: this.shimOptions.suppressSequenceReturn ?? false,
        }),
      onConnectionDropped: () => {
        if (connection !== undefined) this.dropConnection(connection);
      },
    });
    return connection;
  }

  private dropConnection(connection: HubReplicationEdge): void {
    const index = this.connectionList.indexOf(connection);
    if (index >= 0) this.connectionList.splice(index, 1);
  }
}

/** shim hub 工厂（`HubReplication` 面；生产件全部真身，仅 session 装配换为宿主桥）。 */
export function createShimHubForTesting(
  options: HubReplicationOptions,
  shimOptions: ShimHubOptions = {},
): ShimHub {
  const impl = new ShimHubImpl(options, shimOptions);
  const shim: ShimHub = { replication: impl, probes: impl.probe() };
  shimHubRuns.push(shim);
  return shim;
}
