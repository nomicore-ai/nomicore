/**
 * hub-session —— `HubSessionHost`：hub 侧**namespace 级半边**（ADR 0032 决策 1/3；设计 §7 D1/D2/D5/D6）。
 *
 * 职责（与 edge 半边的界线）：
 * - `channels` 容器（listen 形态只增不减）与 `HubNamespaceChannel` 全部生命周期；
 * - `HubChannelHost` 注入面组装（24 成员逐名迁移自原 `HubConnectionImpl` 内联对象）；
 * - **OPEN 到达点建通道**（= HEAD `onOpenNamespace` :880-894 时序）+ `authorize` shim
 *   **拉取** edge 侧已发起/已结算的准入结局（`port.openAdmission`；真实授权器在 edge 单点
 *   调用，本半边结构性不可触达它——决策 3 / D5.3）；
 * - 出站消息组装（UPDATE 包装 / UPDATE_CHUNK negotiated 纵深防御与绑定块）+ `sequence=0`
 *   占位编码 + data 闸门前置（设计 D3.1，与 HEAD 判定/编码次序逐路径等价）；
 * - `namespaceFrame` 分派壳（≈ HEAD `dispatchReady` 的 withChannel 段；未知 ns 防卫生分支保留）。
 *
 * `HubNamespaceChannel` 生产码**零改动**（AC3/DENY）——本模块只向它提供既有注入面。
 */
import { encodeMessage, type ReplicationMessage } from '@nomicore/replication-protocol';
import type { NamespaceRegistry } from '@nomicore/namespace-registry';
import { codecFieldLimits, namespaceErrorFrame, namespaceFieldViolation } from './frame-io.js';
import { HubNamespaceChannel, type HubChannelHost } from './hub-namespace.js';
import type { ChunkedTransferPiece } from './update-transfer.js';
import type { HubSessionEdgePort, HubSessionSink, OpenNamespaceInbound } from './hub-split.js';
import type {
  NamespaceAuthorization,
  ReplicationTimer,
  ResolvedLimits,
  ResolvedTimeouts,
} from './types.js';

/** session 半边工厂配置（设计 §7 D1）。 */
export interface HubSessionHostConfig {
  readonly port: HubSessionEdgePort;
  /** SessionHost 拥有 Registry open（被拒/throw 在 `registry.open` 之前短路）。 */
  readonly registry: NamespaceRegistry;
  readonly instanceId: string;
  readonly peerInstanceId: string;
  readonly timer: ReplicationTimer;
  readonly limits: ResolvedLimits;
  readonly timeouts: ResolvedTimeouts;
}

/** session 半边（`HubSessionSink` 的进程内实现；D1/D6）。 */
export type HubSessionHost = HubSessionSink;

class HubSessionHostImpl implements HubSessionHost {
  /** 通道表**唯一事实源**（listen 形态只增不减）；`HubSessionSink.channels` 只读投影。 */
  readonly channels = new Map<string, HubNamespaceChannel>();
  private readonly channelHost: HubChannelHost;
  private closeTail: Promise<void> | undefined;

  constructor(private readonly config: HubSessionHostConfig) {    const { limits, timeouts, timer, registry, instanceId, port } = config;
    this.channelHost = {
      limits,
      timeouts,
      timer,
      registry,
      instanceId,
      peerInstanceId: () => config.peerInstanceId,
      // 决策 3 / D5.3：真实授权器在 edge 单点调用；本半边只**拉取**其结算结局
      // （`port.openAdmission` 返回 edge 侧该 (连接, ns) 唯一在途 authorize 的投影）。
      authorize: (_instanceIdentity, namespaceId) => this.pullAuthorization(namespaceId),
      sendControl: (message) => this.sendControl(message),
      // issue #423（SA2 O2 点名绑定箭头）：accounting 必须逐层透传——缺失即 EM-C4c 红
      // （typecheck 不强制少参箭头，故此处显式三参）。
      sendData: (namespaceId, bytes, accounting) => this.sendData(namespaceId, bytes, accounting),
      // issue #243（DD-3.5）：UPDATE_CHUNK 与 UPDATE 同一 data 出站点
      sendUpdateChunk: (namespaceId, chunk) => this.sendUpdateChunk(namespaceId, chunk),
      chunkedUpdateNegotiated: () => port.chunkedUpdateNegotiated(),
      dataGateOpen: () => port.dataGateOpen(),
      onDataQueued: (namespaceId) => port.onDataQueued(namespaceId),
      requestDataDrain: () => port.requestDataDrain(),
      connectionFatal: (code, wsCloseCode) => port.connectionFatal(code, wsCloseCode ?? 1002),
      onChannelSettled: (namespaceId) => port.onChannelSettled(namespaceId),
      tryBeginInboundAssembly: (namespaceId) => port.tryBeginInboundAssembly(namespaceId),
      endInboundAssembly: (namespaceId) => port.endInboundAssembly(namespaceId),
      observerPresent: () => port.observerPresent(),
      emitObserver: (event) => port.emitObserver(event),
      connectionId: () => port.connectionId(),
      connectionState: () => port.connectionState(),
      bufferedAmount: () => port.bufferedAmount(),
      now: () => port.now?.(),
    };
  }

  // ─────────────────────────────── OPEN 管线（session 侧，= HEAD onOpenNamespace :880-894） ───────────────────────────────

  openNamespace(message: OpenNamespaceInbound): void {
    const channel = this.channels.get(message.namespaceId);
    if (channel === undefined) {
      // 到达点建通道（D5.1）：`channels.set` 在返回前完成 ⟹ edge 台账命中 ⟺ 通道在场（锁步）
      const created = new HubNamespaceChannel(this.channelHost, message.namespaceId);
      this.channels.set(message.namespaceId, created);
      created.startOpen(message); // 同步前缀执行至首个 await（shim 在此同步拉取 admission）
      return;
    }
    channel.onOpen(message);
  }

  /**
   * authorize shim（D5.3）：**拉取** edge 侧该 (连接, ns) 唯一在途真实 authorize 的结算结局，
   * **绝不触达真实授权器**（结构性不可达——只能消费已结算结局，无法注入/影响/重试授权）。
   * - `authorized` → 完整 ok-投影逐字回放；
   * - `denied` → `{ok:false}`（与被拒同形；续体在 `registry.open` 之前短路，:355-359）；
   * - `throw` → reject（错误值被 `startOpen` catch 丢弃，仅「抛出」这一事实上 wire）；
   * - 台账缺失（不变量破坏）→ `port.openAdmission` reject → 同一 reject 通道 →
   *   `INTERNAL_ERROR`（响亮，非静默 fallback）。
   */
  private pullAuthorization(namespaceId: string): Promise<NamespaceAuthorization> {
    return this.config.port.openAdmission(namespaceId).then((admission) => {
      if (admission.outcome === 'authorized') return admission.authorization;
      if (admission.outcome === 'denied') return { ok: false };
      throw new Error('hub-split: authorizer threw');
    });
  }

  // ─────────────────────────────── 帧分派壳（≈ HEAD dispatchReady 的 withChannel 段） ───────────────────────────────

  namespaceFrame(message: ReplicationMessage, sequence: number): void {
    switch (message.kind) {
      case 'OPEN_NAMESPACE':
        // 防御分支：edge 的 OPEN 管线走 openNamespace（到达点 + 台账已建）；此处保持同构
        // 处理（无台账 → shim 响亮缺失 → INTERNAL_ERROR，非静默）
        this.openNamespace(message);
        return;
      case 'BOOTSTRAP_ACK':
        this.withChannel(message.namespaceId, (c) => c.onBootstrapAck({ ackedSequence: message.ackedSequence }));
        return;
      case 'SYNC_STEP1':
        this.withChannel(message.namespaceId, (c) => c.onSyncStep1({ ...message, sequence }));
        return;
      case 'SYNC_STEP2':
        this.withChannel(message.namespaceId, (c) => c.onSyncStep2({ ...message, sequence }));
        return;
      case 'SYNC_APPLIED':
        this.withChannel(message.namespaceId, (c) => c.onSyncApplied(message));
        return;
      case 'RESYNC_REQUIRED':
        this.withChannel(message.namespaceId, (c) => c.onResyncReceived());
        return;
      case 'UPDATE': {
        const violation = namespaceFieldViolation(message, codecFieldLimits(this.config.limits));
        this.withChannel(message.namespaceId, (c) => {
          if (violation !== undefined) {
            c.onFieldViolation(violation);
            return;
          }
          c.onUpdate({ update: message.update, sequence });
        });
        return;
      }
      case 'UPDATE_ACK':
        this.withChannel(message.namespaceId, (c) => c.onUpdateAck(message));
        return;
      case 'CLOSE_NAMESPACE':
        this.withChannel(message.namespaceId, (c) => c.onCloseRequest({ ...message, sequence }));
        return;
      case 'CLOSE_OK':
        // hub 不发 CLOSE（CLOSE 恒由 peer 发起）；收到即方向异常
        this.withChannel(message.namespaceId, (c) => c.onErrorFrame({ code: 'NAMESPACE_STATE_VIOLATION' }));
        return;
      case 'ERROR':
        if (message.namespaceId !== undefined) {
          const channel = this.channels.get(message.namespaceId);
          if (channel !== undefined) channel.onErrorFrame(message);
        }
        return;
      case 'UPDATE_CHUNK':
        // issue #243（DD-5）：协商位透传正确时本分支可到达；转发通道做 detached assembly
        this.withChannel(message.namespaceId, (c) => c.onUpdateChunk({ ...message, sequence }));
        return;
      default:
        // 连接级/方向域帧不经缝（D2/D6）；未知形态静默（edge 是唯一调用方）
        return;
    }
  }

  /** 防御性未知 ns 分支（edge 已在路由点 R-none 合成；此处保持 HEAD `withChannel` 同形）。 */
  private withChannel(namespaceId: string, fn: (c: HubNamespaceChannel) => void): void {
    const channel = this.channels.get(namespaceId);
    if (channel === undefined) {
      try {
        this.config.port.sendControlFrame(
          this.encodePlaceholder(namespaceErrorFrame('NAMESPACE_STATE_VIOLATION', namespaceId)),
        );
      } catch {
        // 连接已收口；忽略
      }
      if (this.config.port.observerPresent()) {
        const connectionId = this.config.port.connectionId();
        this.config.port.emitObserver({
          type: 'namespace-error',
          side: 'hub',
          ...(connectionId !== undefined ? { connectionId } : {}),
          namespaceId,
          code: 'NAMESPACE_STATE_VIOLATION',
          direction: 'sent',
        });
      }
      return;
    }
    fn(channel);
  }

  // ─────────────────────────────── 出站发送面（组装 + 占位编码 + 闸门前置；D3.1） ───────────────────────────────

  /** 控制帧：占位编码（编码异常在此同步抛出，经缝同步传播回 `sendChecked` catch——O6）。 */
  private sendControl(message: ReplicationMessage): number {
    return this.config.port.sendControlFrame(this.encodePlaceholder(message));
  }

  /** data 帧（UPDATE）：闸门前置（对应 HEAD `isEmitAllowed → dataGateOpen` 先于探针）
   *  → 占位编码（对应探针位置：不可编码消息在此抛出，先于一切额度判定）→ 缝。
   *  issue #423（SA2 O2 点名绑定箭头）：`accounting`（纯 JSON `{sendQueueMs?}`）透传至缝
   *  ——edge 盖章点据此发射 `update-sent` 且不丢 `sendQueueMs`；宿主直驱帧不传 ⇒ 整键缺席。 */
  private sendData(
    namespaceId: string,
    bytes: Uint8Array,
    accounting?: Readonly<{ sendQueueMs?: number }>,
  ): number {
    if (this.config.port.connectionState() === 'closed') return 0;
    if (!this.config.port.dataGateOpen()) return 0;
    return this.config.port.sendDataFrame(
      this.encodePlaceholder({ kind: 'UPDATE', namespaceId, update: bytes }),
      accounting,
    );
  }

  /** issue #243（DD-3.5）/issue #295 切片 2（D5/C6）：UPDATE_CHUNK 帧组装——kind 首字段与
   *  绑定块透传 piece；`negotiated` 位做纵深防御（wire 协商位由控制器侧改道判据保证）。 */
  private sendUpdateChunk(namespaceId: string, chunk: ChunkedTransferPiece): number {
    if (!this.config.port.chunkedUpdateNegotiated()) return 0;
    const transferKind = chunk.transferKind ?? 0;
    const base = {
      kind: 'UPDATE_CHUNK' as const,
      transferKind,
      namespaceId,
      transferId: chunk.transferId,
      chunkIndex: chunk.chunkIndex,
      chunkCount: chunk.chunkCount,
      totalBytes: chunk.totalBytes,
      bytes: chunk.bytes,
    };
    let message: ReplicationMessage;
    // 绑定块透传（kind≠0 ∧ chunkIndex=0）；缺失成员由 codec 单形态规则响亮拒绝（MALFORMED_FRAME）
    if (
      transferKind === 1 &&
      chunk.chunkIndex === 0 &&
      chunk.replicationId !== undefined &&
      chunk.replicationEpoch !== undefined
    ) {
      message = {
        ...base,
        replicationId: chunk.replicationId,
        replicationEpoch: chunk.replicationEpoch,
      };
    } else if (transferKind === 2 && chunk.chunkIndex === 0 && chunk.syncRoundId !== undefined) {
      message = { ...base, syncRoundId: chunk.syncRoundId };
    } else {
      message = base;
    }
    if (this.config.port.connectionState() === 'closed') return 0;
    if (!this.config.port.dataGateOpen()) return 0;
    return this.config.port.sendDataFrame(this.encodePlaceholder(message));
  }

  /** `sequence=0` 占位编码（edge 在 mux 点重写 `[8..12]`；D3 字节等价根基）。 */
  private encodePlaceholder(message: ReplicationMessage): Uint8Array {
    return encodeMessage(message, {
      sequence: 0,
      maxFrameBytes: this.config.limits.maxFrameBytes,
      limits: codecFieldLimits(this.config.limits),
    });
  }

  // ─────────────────────────────── 生命周期信号（D6） ───────────────────────────────

  /** 'close' 信号：同步 prefix = 全通道 quiesce（五路收口在 transport.close 前调用）；
   *  异步尾 = 全通道 onConnectionClosed 汇流；幂等（重复调用返回同一 promise）。 */
  close(): Promise<void> {
    if (this.closeTail !== undefined) return this.closeTail;
    for (const channel of this.channels.values()) channel.quiesceConnection();
    const cleanups = [...this.channels.values()].map((channel) => channel.onConnectionClosed());
    this.closeTail = Promise.all(cleanups).then(() => undefined);
    return this.closeTail;
  }

  /** 'terminateUnauthorized' 信号（≈ HEAD `channels.get(nsId)?.terminateUnauthorized()`）。 */
  terminateNamespace(namespaceId: string): Promise<void> {
    const channel = this.channels.get(namespaceId);
    if (channel === undefined) return Promise.resolve();
    return channel.terminateUnauthorized();
  }

  /** listen 形态 drain/wheel/shed 的通道 facet 查询（进程内组合成员；D6 边界注记）。 */
  dataFacetOf(namespaceId: string): ReturnType<HubSessionSink['dataFacetOf']> {
    return this.channels.get(namespaceId)?.sendFacet;
  }
}

/** 工厂：session 半边可独立实例化（注入 edge 提供的 `HubSessionEdgePort`）。 */
export function createHubSessionHost(config: HubSessionHostConfig): HubSessionHost {
  return new HubSessionHostImpl(config);
}
