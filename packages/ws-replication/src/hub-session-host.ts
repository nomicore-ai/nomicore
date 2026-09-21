/**
 * hub-session-host —— SessionHost **公共 byte-seam 工厂**（ADR 0032 决策 2/3/5；设计 §7 D1–D5）。
 *
 * 形态（ADR 0032 决策 2 的公共面兑现）：
 * - 工厂配置 = 宿主本进程/worker 内事实（registry/limits/timeouts/timer/observer/clock），
 *   **不跨缝**；缝两侧只过 `Uint8Array` 帧与纯 JSON；本模块零跨线程面依赖或类型；
 * - `open()` 描述子为**纯 JSON**（connectionKey/remoteInstanceId/namespaceId/authorization
 *   ok-投影/selectedCapabilities/可选 connectionId）——authorize **不在本半边调用**：预算的
 *   预授权投影由 edge 结算后经描述子传入，`openAdmission` 端口以闭包原样回放；
 * - `handleFrame(bytes)` = 入站字节面（fire-and-forget）：序列**已由 edge 校验**，本半边
 *   不得再校验（解码调用不传入站序期望）；OPEN_NAMESPACE → 通道 OPEN 矩阵，其余 namespace
 *   域 kind → 分派壳，连接级/方向域 kind 静默；
 * - `onFrame(listener)` = 出站 sink（同步）：帧以 `sequence=0` 占位（wire 序由 edge 在 mux
 *   点盖章），`lane` 区分 control/data；监听者**返回被分配的 wire 序**（0 = 未发送/被拒），
 *   该值是 session 侧发送记账的承重输入（bootstrap/live ACK 结算依赖它）；
 * - `onSignal` = 会话→edge 控制信号（纯 JSON；`settled` 恰一次 / `connection-fatal{code}`，
 *   code→close code 映射单点留在 edge）；`terminateUnauthorized`/`close` = edge→session
 *   控制信号的句柄方法（幂等）。
 *
 * 内部复用：namespace 级 FSM 唯一实现仍在零 diff 的 `hub-namespace.ts`；本模块只组装
 * 既有内部 splice（`createHubSessionSink`）的**第二种 port 形态**（listen = 真 edge port；
 * 公共 = 本模块的 adapterPort）——一条组装代码、两种缝形态，无第二份状态机。
 */
import {
  CAP_CHUNKED_UPDATE,
  decodeMessage,
  type ReplicationMessage,
} from '@nomicore/replication-protocol';
import type { NamespaceRegistry } from '@nomicore/namespace-registry';
import { createHubSessionSink } from './hub-session.js';
import type { HubSessionEdgePort, HubSessionSink } from './hub-split.js';
import { dispatchReplicationObserver, safeNow } from './observer.js';
import type {
  HubConnectionState,
  NamespaceAuthorization,
  ReplicationClock,
  ReplicationObserver,
  ReplicationTimer,
  ResolvedLimits,
  ResolvedTimeouts,
} from './types.js';

/** 工厂配置：宿主本进程/worker 内事实（**不跨缝**；可含函数，但不得含 authorize/transport/缝 port）。 */
export interface HubSessionHostConfig {
  readonly registry: NamespaceRegistry;
  readonly instanceId: string; // hub 实例 id（HELLO 绑定/本地 owner 判定）
  readonly limits: ResolvedLimits; // 组合根 resolve+validate 后注入（既有纪律）
  readonly timeouts: ResolvedTimeouts;
  readonly timer: ReplicationTimer;
  readonly observer?: ReplicationObserver; // namespace 域事件发射面（决策 5：拥有事实的一侧）
  readonly clock?: ReplicationClock; // now() 采样（无 observer 零采样，既有纪律）
}

/** 单 (连接, namespace) 会话开启描述子：**纯 JSON**（可 structuredClone，无函数/live 对象）。 */
export interface HubSessionOpenInput {
  readonly connectionKey: string; // 宿主连接身份（不透明；非空；nomicore 不解释）
  readonly remoteInstanceId: string; // edge 认证后的对端 instanceId（= edge.authenticatedInstanceId）
  readonly namespaceId: string;
  readonly authorization: Extract<NamespaceAuthorization, { ok: true }>; // edge 已结算预授权投影
  readonly selectedCapabilities: number; // HELLO capability 交集位图
  readonly connectionId?: string; // 连接域 observability id（握手前 undefined）
}

export type HubSessionFrameLane = 'control' | 'data';
/** 出站 sink：同步收帧，返回**被分配的 wire 序**（0 = 未发送/被拒）。 */
export type HubSessionFrameListener = (frame: Uint8Array, lane: HubSessionFrameLane) => number;

/** 会话→edge 控制信号（纯 JSON；ADR 决策 2 的 session→edge 半边在字节缝上的载体）。 */
export type HubSessionSignal =
  | { readonly type: 'settled'; readonly namespaceId: string }
  | { readonly type: 'connection-fatal'; readonly code: string };

export interface HubSessionHandle {
  /** 入站（fire-and-forget）：namespace 域 wire 帧；序列已由 edge 校验——本半边**不得**再校验。 */
  handleFrame(frame: Uint8Array): void;
  /** 出站 sink 注册（同步）；至多一个 sink 生效：后注册者替换先注册者；返回退订函数。 */
  onFrame(listener: HubSessionFrameListener): () => void;
  /** 会话→edge 控制信号观察（纯 JSON；可多监听，返回值忽略）。 */
  onSignal(listener: (signal: HubSessionSignal) => void): () => void;
  /** 'terminateUnauthorized' 控制信号（revoke 链；幂等；无通道则 resolve）。 */
  terminateUnauthorized(): Promise<void>;
  /** 'close' 控制信号：同步前缀 quiesce + 异步尾 cleanup；幂等（重复返回同一 promise）。 */
  close(): Promise<void>;
}

export interface HubSessionHost {
  /** 同步开启一个 (连接, namespace) 会话（同一 handle 只服务该 ns；(connectionKey, namespaceId) 唯一属宿主前置条件）。 */
  open(input: HubSessionOpenInput): HubSessionHandle;
}

/** 单会话句柄：公共字节面 ↔ 内部 splice（`createHubSessionSink`）+ adapterPort（决策 5 dormant 面）。 */
class HubSessionHandleImpl implements HubSessionHandle {
  /** 至多一个出站 sink（后注册者替换）。 */
  private frameListener: HubSessionFrameListener | undefined;
  private readonly signalListeners = new Set<(signal: HubSessionSignal) => void>();
  /** 连接级投影的**本地**形态（{ready, closed} 两态；行为面仅判 `=== 'closed'`）。 */
  private connectionStateValue: HubConnectionState = 'ready';
  /** 决策 5 per-session 降级：单 ns 句柄下入站 assembly 槽位恒 ≤1。 */
  private readonly inboundAssemblySlots = new Set<string>();
  private readonly sink: HubSessionSink;

  constructor(
    private readonly input: HubSessionOpenInput,
    private readonly config: HubSessionHostConfig,
  ) {
    this.sink = createHubSessionSink({
      port: this.makePort(),
      registry: config.registry,
      instanceId: config.instanceId,
      peerInstanceId: input.remoteInstanceId,
      timer: config.timer,
      limits: config.limits,
      timeouts: config.timeouts,
    });
  }

  // ─────────────────────────────── 公共句柄面 ───────────────────────────────

  handleFrame(frame: Uint8Array): void {
    let decoded: { header: { sequence: number }; message: ReplicationMessage };
    try {
      decoded = decodeMessage(frame, {
        maxFrameBytes: this.config.limits.maxFrameBytes,
        selectedCapabilities: this.input.selectedCapabilities,
      });
    } catch (err) {
      // 缝完整性破坏（edge 已验证的字节在本半边不可解码）→ 响亮连接收口，绝不静默吞帧。
      this.emitConnectionFatal((err as { code?: string }).code ?? 'MALFORMED_FRAME');
      return;
    }
    switch (decoded.message.kind) {
      case 'OPEN_NAMESPACE':
        // 到达点建通道 / 通道在场 → 'onOpen' 重开矩阵（分派与内部 splice 同构）。
        this.sink.openNamespace(decoded.message);
        return;
      case 'HELLO':
      case 'HELLO_ACK':
      case 'OPEN_OK':
      case 'BOOTSTRAP_SNAPSHOT':
      case 'IDENTITY_CHANGED':
      case 'GOAWAY':
        // 连接级/方向域帧不经缝（edge 是唯一合法供帧方）——静默（与内部 default 分支同构）。
        return;
      default:
        this.sink.namespaceFrame(decoded.message, decoded.header.sequence);
        return;
    }
  }

  onFrame(listener: HubSessionFrameListener): () => void {
    this.frameListener = listener;
    return () => {
      if (this.frameListener === listener) this.frameListener = undefined;
    };
  }

  onSignal(listener: (signal: HubSessionSignal) => void): () => void {
    this.signalListeners.add(listener);
    return () => {
      this.signalListeners.delete(listener);
    };
  }

  terminateUnauthorized(): Promise<void> {
    return this.sink.terminateNamespace(this.input.namespaceId);
  }

  close(): Promise<void> {
    this.connectionStateValue = 'closed';
    return this.sink.close();
  }

  // ─────────────────────────────── adapterPort（17 成员；决策 5 dormant 映射） ───────────────────────────────

  private makePort(): HubSessionEdgePort {
    return {
      // authorize 不在 session 侧调用：闭包回放 edge 已结算的 ok-投影（denied/throw 结构性不过缝）。
      openAdmission: () =>
        Promise.resolve({
          outcome: 'authorized' as const,
          authorization: this.input.authorization,
        }),
      sendControlFrame: (frame) => this.deliverFrame(frame, 'control'),
      sendDataFrame: (frame) => this.deliverFrame(frame, 'data'),
      // 决策 5 dormant：宿主传输水位闸门休眠（连接级总量保护收敛 edge）。
      dataGateOpen: () => true,
      onDataQueued: () => undefined,
      requestDataDrain: () => undefined,
      chunkedUpdateNegotiated: () => (this.input.selectedCapabilities & CAP_CHUNKED_UPDATE) !== 0,
      connectionFatal: (code) => this.emitConnectionFatal(code),
      onChannelSettled: (namespaceId) => this.emitSignal({ type: 'settled', namespaceId }),
      tryBeginInboundAssembly: (namespaceId) => {
        if (this.inboundAssemblySlots.has(namespaceId)) return true;
        if (this.inboundAssemblySlots.size >= 1) return false;
        this.inboundAssemblySlots.add(namespaceId);
        return true;
      },
      endInboundAssembly: (namespaceId) => {
        this.inboundAssemblySlots.delete(namespaceId);
      },
      observerPresent: () => this.config.observer !== undefined,
      emitObserver: (event) => dispatchReplicationObserver(this.config.observer, event),
      connectionId: () => this.input.connectionId,
      connectionState: () => this.connectionStateValue,
      // 决策 5 dormant：socket 缓冲面缺席（不可观测）。
      bufferedAmount: () => undefined,
      now: () =>
        this.config.observer !== undefined ? safeNow(() => this.config.clock?.now()) : undefined,
    };
  }

  // ─────────────────────────────── 缝纪律（失败语义/隔离） ───────────────────────────────

  /** 出站投递：未注册 sink ⇒ 0（=「未发送」，通道按既有 0 值语义响亮处理）；监听者同步抛出原样传播。 */
  private deliverFrame(frame: Uint8Array, lane: HubSessionFrameLane): number {
    const listener = this.frameListener;
    if (listener === undefined) return 0;
    return listener(frame, lane);
  }

  private emitConnectionFatal(code: string): void {
    this.connectionStateValue = 'closed';
    this.emitSignal({ type: 'connection-fatal', code });
  }

  /** 信号分发与 observer 同款隔离：监听者抛出不得改变协议状态、不得逃逸到帧路径。 */
  private emitSignal(signal: HubSessionSignal): void {
    for (const listener of [...this.signalListeners]) {
      try {
        listener(signal);
      } catch {
        // 观察者隔离（与 dispatchReplicationObserver 同款纪律）。
      }
    }
  }
}

class HubSessionHostImpl implements HubSessionHost {
  private readonly sessions = new Map<string, HubSessionHandle>();

  constructor(private readonly config: HubSessionHostConfig) {}

  open(input: HubSessionOpenInput): HubSessionHandle {
    // 宿主契约违反即响亮拒绝（无静默复用/静默新建）。
    if (typeof input.connectionKey !== 'string' || input.connectionKey.length === 0) {
      throw new Error('hub-session-host: connectionKey 必须为非空字符串');
    }
    const key = `${input.connectionKey}\u0000${input.namespaceId}`;
    if (this.sessions.has(key)) {
      throw new Error(
        `hub-session-host: (connectionKey, namespaceId) 重复开启（${input.namespaceId}）`,
      );
    }
    const handle = new HubSessionHandleImpl(input, this.config);
    this.sessions.set(key, handle);
    return handle;
  }
}

/** 工厂：公共 byte-seam 会话半边（namespace 级；描述子纯 JSON、缝只过字节与信号）。 */
export function createHubSessionHost(config: HubSessionHostConfig): HubSessionHost {
  return new HubSessionHostImpl(config);
}
