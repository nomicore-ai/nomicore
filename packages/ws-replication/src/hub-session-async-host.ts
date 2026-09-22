/**
 * hub-session-async-host —— SessionHost **公共异步缝（γ）工厂**（issue #447；
 * ADR 0032 附录 A4.1–A4.8；协议 `docs/protocols/instance-replication-v1.md` §24）。
 *
 * 形态（A4.1：公共面 = **独立的新工厂/句柄类型**，β `createHubSessionHost` 的同步冻结
 * 签名逐字保留、包导出 append-only）：
 *
 * - 缝消息词汇（§24.3 闭集合，逐字）：session→edge `frame{tag, bytes, lane}` /
 *   `settled{namespaceId}` / `connection-fatal{code}`；edge→session `frame{bytes}` /
 *   `receipt{tag, sequence}` / `close` / `terminateUnauthorized`。**无**拒纳/闸门/信用词汇；
 * - 出站帧 **fire-and-forget**：监听者无同步序号契约，帧以 `sequence=0` 占位编码过缝，
 *   wire 序由 edge 在 mux 点盖章（盖章单点不动，`frame-io.ts` `emitOne`）；
 * - 入站序回执经 `handleReceipt(tag, sequence)` 消费：`tag` 由本半边**分配**（句柄域内
 *   自 1 单调唯一，§24.2.4），`sequence` = edge 盖章值（序号事实回传，**非**接纳信号，
 *   A4.6）——回执只做 rekey/锚回填/既定 drain 触发，不参与发送决策；
 * - 第三种 port 形态（A4.1）：`HubSessionEdgePort` 的实现以 tag（而非已盖章序）应答
 *   `sendControlFrame/sendDataFrame`，`asyncSendTickets: true` 透传至 sink 组装层
 *   （三态锚 pending 相位 + `pendingSends` 两相记账，§24.4）；
 * - 保序条款（A4.2 / §24.2.3）：宿主须在**盖章点同一同步段**把 `receipt` 投回本半边
 *   （宿主桥消费 edge egress 返回值的形态，见 test-only 桥样例），同通道 FIFO ⇒ 序回执
 *   必先于引用它的 ACK 被消费。「合法 ACK 在锚回填前到达」= 宿主违契 ⇒ 既有响亮判别
 *   （`ACK_STATE_VIOLATION` / `SYNC_STATE_VIOLATION`），**禁 park/等待/缓冲**（A4.2/D7）；
 * - 违契响亮收口（§24.2.6）：未知/重复 tag、非法 sequence ⇒
 *   `connection-fatal{CONNECTION_POLICY_VIOLATION}`（code→close code 映射单点仍留 edge）；
 * - 生命周期（A4.5/§24.7）：`close`/`terminateUnauthorized` 幂等；close 后 `handleFrame`/
 *   `handleReceipt` 静默（终局无剩余收口对象）。
 *
 * 内部复用：namespace 级 FSM 唯一实现仍在 `hub-namespace.ts`（零分叉）；本模块只组装
 * `createHubSessionSink` 的**第三种 port 形态**（γ adapterPort）——一条组装代码、三种缝形态。
 */
import {
  CAP_CHUNKED_UPDATE,
  decodeMessage,
  type ReplicationMessage,
} from '@nomicore/replication-protocol';
import { createHubSessionSink } from './hub-session.js';
import type { HubSessionEdgePort, HubSessionSink } from './hub-split.js';
import type {
  HubSessionFrameLane,
  HubSessionHostConfig,
  HubSessionOpenInput,
  HubSessionSignal,
} from './hub-session-host.js';
import { dispatchReplicationObserver, safeNow } from './observer.js';
import type { HubConnectionState } from './types.js';

/** 出站缝消息（§24.3 session→edge `frame`）：`tag` 由 session 分配（句柄域内自 1 单调唯一）。 */
export interface HubAsyncSessionFrame {
  /** 会话域标识（纯 JSON 正整数；与该帧 wire 序**不同键空间**）。 */
  readonly tag: number;
  /** `sequence=0` 占位编码的 namespace 域帧字节；edge 在 mux 点重写 `[8..12]`。 */
  readonly bytes: Uint8Array;
  readonly lane: HubSessionFrameLane;
}

/** 出站 sink（fire-and-forget）：**无同步序号契约**——wire 序经 `receipt` 回传（A4.6）。 */
export type HubAsyncSessionFrameListener = (frame: HubAsyncSessionFrame) => void;

/** 序回执（§24.3 edge→session `receipt`）：序号事实回传，非接纳信号——键集恰 `{tag, sequence}`。 */
export interface HubAsyncSessionReceipt {
  readonly tag: number;
  /** 该帧 wire 字节 `[8..12]` 的盖章值（edge mux 单点分配）。 */
  readonly sequence: number;
}

export interface HubAsyncSessionHandle {
  /** 入站 namespace 域 wire 帧（fire-and-forget）：sequence 已由 edge 校验，本半边不得再检。 */
  handleFrame(frame: Uint8Array): void;
  /** 序回执消费（签名按简报逐字）：`tag` = 本句柄已分配且未结算的 tag；`sequence` = 盖章序。 */
  handleReceipt(tag: number, sequence: number): void;
  /** 出站 sink 注册（fire-and-forget）；至多一个 sink 生效（后注册者替换）；返回退订函数。 */
  onFrame(listener: HubAsyncSessionFrameListener): () => void;
  /** 会话→edge 控制信号观察（`settled` / `connection-fatal`；复用 β 信号联合）。 */
  onSignal(listener: (signal: HubSessionSignal) => void): () => void;
  /** `'terminateUnauthorized'`（revoke 链；幂等；不溯及已推帧）。 */
  terminateUnauthorized(): Promise<void>;
  /** `'close'`（幂等，重复返回同一 promise）：未决 tag 整体冲刷 + 通道 quiesce。 */
  close(): Promise<void>;
}

export interface HubAsyncSessionHost {
  /** 同步开启一个 (连接, namespace) 会话；描述符纯 JSON（复用 β `HubSessionOpenInput`）。 */
  open(input: HubSessionOpenInput): HubAsyncSessionHandle;
}

/** 单会话句柄：公共异步字节面 ↔ 内部 splice（`createHubSessionSink`，`asyncSendTickets` 单点置位）。 */
class HubAsyncSessionHandleImpl implements HubAsyncSessionHandle {
  /** 至多一个出站 sink（后注册者替换）——与 β 同款纪律。 */
  private frameListener: HubAsyncSessionFrameListener | undefined;
  private readonly signalListeners = new Set<(signal: HubSessionSignal) => void>();
  /** 连接级投影的**本地**两态形态（行为面仅判 `=== 'closed'`；β 同款）。 */
  private connectionStateValue: HubConnectionState = 'ready';
  /** 决策 5 per-session 降级：单 ns 句柄下入站 assembly 槽位恒 ≤1。 */
  private readonly inboundAssemblySlots = new Set<string>();
  /** tag 分配单点（句柄 = 每 (connectionKey, namespaceId) 会话；§24.2.4）。 */
  private tagCounter = 0;
  /** 已分配、序回执未到的 tag（未决集）——一次性消费面；close/teardown 整体冲刷。 */
  private readonly unresolvedTags = new Set<number>();
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
      // γ 唯一设置点：返回值语义 = tag（未盖章）——三态锚 + pendingSends 两相记账的前提。
      asyncSendTickets: true,
    });
  }

  // ─────────────────────────────── 公共句柄面 ───────────────────────────────

  handleFrame(frame: Uint8Array): void {
    if (this.connectionStateValue === 'closed') return; // A4.5：收口后后到一切静默丢弃
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
        break;
      case 'HELLO':
      case 'HELLO_ACK':
      case 'OPEN_OK':
      case 'BOOTSTRAP_SNAPSHOT':
      case 'IDENTITY_CHANGED':
      case 'GOAWAY':
        // 连接级/方向域帧不经缝（edge 是唯一合法供帧方）——静默（与内部 default 分支同构）。
        break;
      default:
        this.sink.namespaceFrame(decoded.message, decoded.header.sequence);
        break;
    }
    // A4.4 触发点②：每条入站缝消息消费之后自驱 drain（「ACK 到达」的保守超集；
    // 无工作即 no-op，幂等）。
    this.selfDrain();
  }

  /**
   * 序回执消费单点（§8.3）。判别次序：终态静默 → sequence 域校验 → 未决集命中 → fan-out。
   * 未知/重复 tag 与非法 sequence 都是**宿主违契**（FIFO 不丢不重不伪造，§24.2.6）⇒
   * 响亮 `CONNECTION_POLICY_VIOLATION`（经 `connection-fatal` 信号交 edge 收口），
   * 绝不静默忽略。
   */
  handleReceipt(tag: number, sequence: number): void {
    if (this.connectionStateValue === 'closed') return; // A4.5：收口后迟到回执静默（防御）
    if (!Number.isInteger(sequence) || sequence < 1 || sequence > 0xffffffff) {
      // 伪造序号（CONTEXT「序回执」_Avoid_：不伪造序号）——响亮。
      this.emitConnectionFatal('CONNECTION_POLICY_VIOLATION');
      return;
    }
    if (!this.unresolvedTags.has(tag)) {
      // 未知 tag（从未分配/句柄域外）或重复投递（tag 已出未决集）= 宿主 bug ⇒ 响亮。
      this.emitConnectionFatal('CONNECTION_POLICY_VIOLATION');
      return;
    }
    this.unresolvedTags.delete(tag);
    const settledTransferLastChunk = this.sink.onReceipt?.(tag, sequence) === true;
    // A4.4 触发点③：transfer 末 chunk 回执结算后自驱 drain（释放的窗口空位立即续推）。
    if (settledTransferLastChunk) this.selfDrain();
  }

  onFrame(listener: HubAsyncSessionFrameListener): () => void {
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
    // §9.2：按未发送清算——未决 tag 集合整体冲刷（其后迟到回执经终态门静默）。
    this.unresolvedTags.clear();
    return this.sink.close();
  }

  // ─────────────────────────────── γ adapterPort（第三种 port 形态） ───────────────────────────────

  private makePort(): HubSessionEdgePort {
    return {
      // authorize 不在 session 侧调用：闭包回放 edge 已结算的 ok-投影（denied/throw 结构性不过缝）。
      openAdmission: () =>
        Promise.resolve({
          outcome: 'authorized' as const,
          authorization: this.input.authorization,
        }),
      // D3/§8.3：以 **tag** 应答（fire-and-forget）——wire 序经 receipt 回传。
      sendControlFrame: (frame) => this.emitSeam(frame, 'control'),
      // 缝词汇无 accounting 字段（§24.3）：γ 下丢弃（与 β 工厂形态 dormant 同款）。
      sendDataFrame: (frame) => this.emitSeam(frame, 'data'),
      // D5/A4.3 dormant 面：流控单点在 edge 账本；共享闸门代码在 γ 下自然 no-op。
      dataGateOpen: () => true,
      // D6：data 入队/请求 drain → 自驱 drain（推-FIFO pacing；γ 无连接级 wheel）。
      onDataQueued: () => this.selfDrain(),
      requestDataDrain: () => this.selfDrain(),
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
      bufferedAmount: () => undefined,
      now: () =>
        this.config.observer !== undefined ? safeNow(() => this.config.clock?.now()) : undefined,
    };
  }

  // ─────────────────────────────── 缝纪律（tag 分配 / drain / 信号） ───────────────────────────────

  /**
   * 出站投递单点（§8.3 `emitSeam`）：
   * - 未注册 sink ⇒ 返回 0（=「未发送」，与 β `deliverFrame` 逐字同构：不登记未决 tag、
   *   不发 seam 消息；通道按既有 0 值语义响亮处理）；
   * - 已注册 ⇒ `tag = ++tagCounter` → 登记未决集 → 同步调用监听者 → 返回 tag。
   *
   * `tag` 的分配与校验全部归本层（§24.2.4）；**监听者同步 throw 原样传播**（β 镜像），
   * 不吞、不触发隐式 fatal。
   */
  private emitSeam(frame: Uint8Array, lane: HubSessionFrameLane): number {
    const listener = this.frameListener;
    if (listener === undefined) return 0;
    this.tagCounter += 1;
    const tag = this.tagCounter;
    this.unresolvedTags.add(tag);
    listener({ tag, bytes: frame, lane });
    return tag;
  }

  /**
   * D6/A4.4 自驱 drain：循环 `pullAndSendOne()` 直至 false（推完即停，禁 busy loop——
   * 每次 pull 消费队列项或发送一 chunk，循环必然终止）。γ 不保持跨 session 轮转公平
   * （A4.4 显式接受：连接级 wheel 是拉取机械，跨异步边界物理不成立）。
   */
  private selfDrain(): void {
    const facet = this.sink.dataFacetOf(this.input.namespaceId);
    if (facet === undefined) return;
    while (facet.pullAndSendOne()) {
      // 每次 pull 取得进展；耗尽即 false 退出。
    }
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

class HubAsyncSessionHostImpl implements HubAsyncSessionHost {
  private readonly sessions = new Map<string, HubAsyncSessionHandle>();

  constructor(private readonly config: HubSessionHostConfig) {}

  open(input: HubSessionOpenInput): HubAsyncSessionHandle {
    // 宿主契约违反即响亮拒绝（无静默复用/静默新建）——与 β 工厂同款守卫。
    if (typeof input.connectionKey !== 'string' || input.connectionKey.length === 0) {
      throw new Error('hub-session-async-host: connectionKey 必须为非空字符串');
    }
    const key = `${input.connectionKey}\u0000${input.namespaceId}`;
    if (this.sessions.has(key)) {
      throw new Error(
        `hub-session-async-host: (connectionKey, namespaceId) 重复开启（${input.namespaceId}）`,
      );
    }
    const handle = new HubAsyncSessionHandleImpl(input, this.config);
    this.sessions.set(key, handle);
    return handle;
  }
}

/**
 * 工厂：公共异步缝（γ）会话半边。配置复用 β `HubSessionHostConfig`（宿主本进程/worker
 * 内事实，**不跨缝**；纯 JSON 描述子复用 `HubSessionOpenInput`；信号复用 `HubSessionSignal`）。
 */
export function createHubAsyncSessionHost(config: HubSessionHostConfig): HubAsyncSessionHost {
  return new HubAsyncSessionHostImpl(config);
}
