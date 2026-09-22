/**
 * issue #450 —— γ-T4 **流控与生命周期收口**验收夹具（**test-only**；ADR 0032 附录 A4.3/A4.5 /
 * 协议 §24.5/§24.7；SA6 契约 §12.1 的 F1–F4 裁定）。
 *
 * 交付物边界（与 #447/#448 夹具同款纪律）：
 *
 * 1. **零协议决策（F4）**：本文件只做装配编排与观测投影——不合成应答帧、不选错误码、不缓冲/
 *    重排/重试、不复制准入管线。**收口一律由 edge 发起**（`connectionFatal` 单点）；夹具不得在
 *    宿主侧合成 1011/1009/错误码（ADR 0032 A4.3 流控单点）。
 * 2. **F1 慢对端/账本压力旋钮（双压力形态 + 及时消费对照）**：`pressure: true` 时对进场 hub 侧
 *    transport 施加 `Object.defineProperty(transport, 'bufferedAmount', { get })`（#137
 *    `applyPressure` 先例），水位上界 = `transport.send` 累计字节数，`advance(n)` 显式制造冲刷
 *    证据。三种编排形态：
 *    - **(α) 无面**（缺省不定义属性 = dormant）⇒ 账本零退休 = **永久慢对端等价**（`BPK-C1`；
 *      该等价性在此正式登记：缺省 `makeWire` 传输无 `bufferedAmount` 面，`readBufferedAmount`
 *      缺面 → 0 —— 与「对端永不消费」在账本投影上不可区分）；
 *    - **(β) 有面不 advance** ⇒ 水位只增 = **生产拓扑慢对端等价**（`BPK-C4`/`BPK-NC2`：协议 §17
 *      「生产 Adapter 必须暴露三面」）；
 *    - **(γ) 持续 advance** ⇒ 及时消费 ⇒ 零越界零死亡（`BPK-C3`/`MEM-NC1`）。
 * 3. **F2 延迟 sink 解析旋钮**：`deferSinkResolve: true` 转发 `issue447-async-seam.ts` 的
 *    append-only 闸门（`AsyncSeamHost.resolveSink` / `pendingSinks`）——AC6「跨线程延迟」注入面。
 * 4. **F3 单帧超限载荷面**：`makeLargeUpdateFrame(namespaceId, minFrameBytes)` —— 确定性合法
 *    UPDATE 占位帧构造器（Yjs `clientID` 钉死 → `encodeStateAsUpdate` → `encodeMessage`，
 *    帧长 ≥ minFrameBytes 且 codec 合法），经公共 egress 宿主直驱面（ADR 0032 决策 5 登记面）
 *    注入。`port.sendDataFrame` 单漏斗覆盖 session 组装路径 + 分块族 + 直驱，守卫共享。
 * 5. **D7 OPENWP 白盒编排**：`bootInjectionFlow()` = γ facade（`asyncDataAdmissionFatal: true`
 *    + F2 延迟解析）× 本地内存 wire（`createMemoryDuplexTransport` + 注入端包装，同 #421 模式）
 *    × `acceptTrusted` ⇒ 合成帧注入面；两到界形态（4 并发 OPEN 闸 / 1 OPEN + 15 缓冲帧）与
 *    OAP-C4c/C4d/C5a/C5b 同判据，仅换 γ 缝 + 真延迟 permutation。
 * 6. **零真实 timer / 零 wall-clock**：时间 = 注入调度器 `advanceBy`；延迟 = 显式 release。
 */
import type { ReplicationObserverEvent } from '@nomicore/ws-replication';
import {
  LIMITS,
  TIMEOUTS,
  makeAsyncAuthorizer,
  makeAsyncObserver,
  makeAsyncReplicationFacade,
  pumpUntil,
  wireFramesOfKind,
  type AsyncFacade,
  type AsyncSessionSeam,
  type WireFrame,
} from './issue447-async-seam.js';
import { boot, type Run } from './driver.js';
import {
  FIXED_MS,
  HUB_INSTANCE,
  HUB_OWNER,
  makeHubNamespace,
  makeNode,
  PEER_INSTANCE,
  type ReplicaNode,
  type Wire,
} from './harness.js';
import { decodeMessage, encodeMessage } from '@nomicore/replication-protocol';
import { createMemoryDuplexTransport } from '@nomicore/ws-replication/testing';
import type {
  DuplexTransport,
  HubReplication,
  HubReplicationEdgeConnection,
  ReplicationLimits,
  ReplicationTimeouts,
} from '@nomicore/ws-replication';
import * as Y from 'yjs';

// ═══════════════════════════ F1：慢对端 / 账本压力旋钮 ═══════════════════════════

/** F1 控制面：水位上界 = 已发送字节累计；`advance(n)` = 对端消费 n 字节的冲刷证据。 */
export interface PressureKnob {
  /** 当前水位（= 已发送 − 已消费，下界 0）。 */
  level(): number;
  /** 显式制造对端消费证据（水位下降 ⇒ `observe()` 退休 ⇒ 账本回落）。 */
  advance(n: number): void;
  /** 累计已发送字节（含控制帧）。 */
  sentBytes(): number;
  /** 最近一次 `transport.send` **前**的水位（= 该帧盖章时刻的 socket 账目）。 */
  levelBeforeLastSend(): number;
}

interface DecoratedTransport {
  readonly transport: DuplexTransport;
  readonly knob: PressureKnob;
}

/** 对进场 hub 侧 transport 施加 `bufferedAmount` 面 + 发送字节计数（F1；#137 先例）。 */
function decoratePressure(transport: DuplexTransport): DecoratedTransport {
  let sent = 0;
  let consumed = 0;
  let lastBefore = 0;
  const originalSend = transport.send.bind(transport);
  const proxy: DuplexTransport = {
    send(bytes) {
      lastBefore = Math.max(0, sent - consumed);
      sent += bytes.byteLength;
      originalSend(bytes);
    },
    close(code, reason) {
      transport.close(code, reason);
    },
    get closed() {
      return transport.closed;
    },
    onMessage(listener) {
      return transport.onMessage(listener);
    },
    onClose(listener) {
      return transport.onClose(listener);
    },
  };
  Object.defineProperty(proxy, 'bufferedAmount', {
    get: () => Math.max(0, sent - consumed),
    configurable: true,
  });
  return {
    transport: proxy,
    knob: {
      level: () => Math.max(0, sent - consumed),
      advance: (n) => {
        consumed += n;
      },
      sentBytes: () => sent,
      levelBeforeLastSend: () => lastBefore,
    },
  };
}

// ═══════════════════════════ bootFlowRound（F1 装饰 + 增量 facade options） ═══════════════════════════

export interface FlowRoundOptions {
  /** 双侧生效的 limits 注入（boot 显式 partial）。 */
  readonly limits?: Readonly<Partial<ReplicationLimits>>;
  /** 双侧生效的 timeouts 注入（`DRAIN-NC1` 逃生舱敏感面）。 */
  readonly timeouts?: Readonly<Partial<ReplicationTimeouts>>;
  readonly chunkedUpdate?: boolean;
  readonly hubObserver?: boolean;
  readonly edgeObserver?: boolean;
  readonly hubClock?: () => number | undefined;
  /** #450 核心标记：γ data admission 越界 = 连接终局（缺省零传 = 缺省装配逐字不变）。 */
  readonly asyncDataAdmissionFatal?: true;
  /** F2：延迟 sink 解析（OPENWP permutation 的「跨线程延迟」注入面）。 */
  readonly deferSinkResolve?: boolean;
  /** F1：对 hub 侧 transport 施加 `bufferedAmount` 压力面（缺省 = 无面慢对端等价）。 */
  readonly pressure?: boolean;
}

export interface FlowRound {
  readonly run: Run;
  readonly facade: AsyncFacade;
  readonly observerEvents: readonly ReplicationObserverEvent[];
  /** edge 生成的唯一连接键（`${instanceId}-conn-${n}`）。 */
  readonly connectionKey: string;
  /** **conn-0** 的 wire（重连产生的后续连接不污染断言面）。 */
  readonly wire: Wire;
  /** F1 旋钮（`pressure: true` 时在场）。 */
  readonly pressure: PressureKnob | undefined;
  seam(): AsyncSessionSeam;
  /** conn-0 的连接句柄（egress 直驱面 / revoke / close 面）。 */
  connection(): HubReplicationEdgeConnection;
  dataFramesOut(): number;
  dataFramesSent(): ReadonlyArray<{ tag: number; lane: 'control' | 'data'; kind: string }>;
  /** conn-0 hub→peer wire 帧（能力感知解码）。 */
  hubFrames(kind: string): WireFrame[];
  /** conn-0 peer→hub wire 帧（能力感知解码）。 */
  peerFrames(kind: string): WireFrame[];
  awaitLive(): Promise<void>;
  events(type: string): Array<Record<string, unknown>>;
  /** session→edge 控制信号（`settled:ns` / `connection-fatal:CODE`）。 */
  fatalSignals(): string[];
  /** conn-0 hub 侧传输是否已关闭（收口锚）。 */
  hubClosed(): boolean;
  /** conn-0 对端观察到的 close（`{code, reason}`；未收口 ⇒ undefined）。 */
  peerCloseInfo(): Readonly<{ code: number; reason: string }> | undefined;
  /** 帧在「水位 > highWater」时仍被盖章的判别性观察（`BPK-C4`；F1 必需）。返回**活数组**
   *  （`levelAtStamp` = 该 data 帧出站前的 socket 账目 = 盖章时刻水位），断言侧自行过滤。 */
  stampSamples(): Array<{ tag: number; sequence: number; levelAtStamp: number }>;
}

/** boot 一个 γ 回合（镜像 `bootLiveRound` + 增量 options + F1 accept 装饰）。 */
export async function bootFlowRound(opts: FlowRoundOptions = {}): Promise<FlowRound> {
  const recorder =
    opts.hubObserver === true || opts.edgeObserver === true ? makeAsyncObserver() : undefined;
  const clockRef = { now: opts.hubClock };
  // timeouts 先 resolve 为全量形（facade 的同步解析路径要求 resolved 形；与组合根语义一致）。
  const resolvedTimeouts = { ...TIMEOUTS, ...(opts.timeouts ?? {}) };
  let knob: PressureKnob | undefined;
  let facade: AsyncFacade | undefined;
  const run = await boot({
    ...(opts.chunkedUpdate === undefined ? {} : { chunkedUpdate: opts.chunkedUpdate }),
    ...(opts.limits === undefined ? {} : { limits: opts.limits }),
    ...(opts.timeouts === undefined ? {} : { timeouts: resolvedTimeouts }),
    ...(opts.hubObserver === true && recorder !== undefined
      ? { hubObserver: recorder.observer }
      : {}),
    ...(opts.hubClock !== undefined
      ? { hubClock: { now: () => clockRef.now?.() ?? FIXED_MS } }
      : {}),
    waitFor: 'none',
    random: () => 0.5,
    createHub: (options) => {
      facade = makeAsyncReplicationFacade({
        ...options,
        ...(opts.asyncDataAdmissionFatal === true
          ? { asyncDataAdmissionFatal: true as const }
          : {}),
        ...(opts.deferSinkResolve === true ? { deferSinkResolve: true } : {}),
        ...(opts.edgeObserver === true && recorder !== undefined
          ? { edgeObserver: recorder.observer }
          : {}),
      });
      const inner = facade.replication;
      // F1：接受侧装饰（缺省零装饰 = #447/#448 装配逐字不变）。
      return {
        accept: (transport, request) => {
          const decorated = opts.pressure === true ? decoratePressure(transport) : undefined;
          if (decorated !== undefined) knob = decorated.knob;
          return inner.accept(decorated?.transport ?? transport, request);
        },
        acceptTrusted: (transport: DuplexTransport, identity) => {
          const decorated = opts.pressure === true ? decoratePressure(transport) : undefined;
          if (decorated !== undefined) knob = decorated.knob;
          const acceptTrusted = inner.acceptTrusted;
          if (acceptTrusted === undefined) {
            throw new Error('issue450 夹具前提失败：内层 replication 无 acceptTrusted');
          }
          return acceptTrusted(decorated?.transport ?? transport, identity);
        },
        get connections() {
          return inner.connections;
        },
        revoke: (instanceIdentity, namespaceId) => inner.revoke(instanceIdentity, namespaceId),
        requestReauth: (instanceIdentity) => inner.requestReauth(instanceIdentity),
        close: () => inner.close(),
      } satisfies HubReplication;
    },
  });
  if (facade === undefined) throw new Error('issue450 夹具前提失败：facade 未被 boot 调用');
  if (facade.worker.registry !== run.hubNode.registry) {
    throw new Error('issue450 夹具前提失败：worker.registry !== run.hubNode.registry');
  }
  const connectionKeys = [...facade.host.connections.keys()];
  if (connectionKeys.length !== 1) {
    throw new Error(`issue450 夹具前提失败：γ 装配连接数 = ${connectionKeys.length}（应恰 1）`);
  }
  const connectionKey = connectionKeys[0]!;
  const wire = run.wires[0];
  if (wire === undefined) throw new Error('issue450 夹具前提失败：conn-0 wire 缺席');
  const host = facade.host;
  const dataFramesSent = (): ReadonlyArray<{ tag: number; lane: 'control' | 'data'; kind: string }> =>
    host.probes.outbound.filter((frame) => frame.lane === 'data');
  const connection = (): HubReplicationEdgeConnection => {
    const found = host.connections.get(connectionKey);
    if (found === undefined) throw new Error(`issue450 夹具前提失败：无连接 ${connectionKey}`);
    return found;
  };
  return {
    run,
    facade,
    observerEvents: recorder?.events ?? [],
    connectionKey,
    wire,
    pressure: knob,
    seam: () => host.channel(connectionKey, run.nsId),
    connection,
    dataFramesOut: () => dataFramesSent().length,
    dataFramesSent,
    hubFrames: (kind) => wireFramesOfKind(wire.hubToPeer, kind),
    peerFrames: (kind) => wireFramesOfKind(wire.peerToHub, kind),
    awaitLive: async () => {
      await pumpUntil(host, () => run.namespaceState() === 'live', 'namespace live');
    },
    events: (type) =>
      (recorder?.events ?? []).filter((event) => event.type === type) as Array<
        Record<string, unknown>
      >,
    fatalSignals: () =>
      host.probes.signals.filter((signal) => signal.startsWith('connection-fatal')),
    hubClosed: () => wire.hubEnd.closed,
    peerCloseInfo: () => wire.peerSideCloseInfo,
    stampSamples: () => {
      const pressure = knob;
      const samples: Array<{ tag: number; sequence: number; levelAtStamp: number }> = [];
      if (pressure === undefined) {
        throw new Error('issue450 夹具前提失败：压力旋钮未启用（pressure: true 必需）');
      }
      // 监听器注册晚于桥内监听器 ⇒ 在 egress 返回值与 probes.stamps 落账之后运行；
      // `levelBeforeLastSend()` = 该 data 帧出站前的 socket 账目（= 盖章时刻水位）。
      host.channel(connectionKey, run.nsId).sessionToEdge.onDeliver((message) => {
        if (!('lane' in message) || message.lane !== 'data') return;
        const stamp = host.probes.stamps.filter((entry) => entry.tag === message.tag).at(-1);
        if (stamp === undefined || stamp.sequence <= 0) return;
        samples.push({
          tag: stamp.tag,
          sequence: stamp.sequence,
          levelAtStamp: pressure.levelBeforeLastSend(),
        });
      });
      return samples;
    },
  };
}

// ═══════════════════════════ F3：单帧超限载荷构造器 ═══════════════════════════

/**
 * 确定性合法 UPDATE 帧（Yjs `clientID` 钉死 + 定长内容）：帧长 ≥ `minFrameBytes` 且 codec 合法。
 * 逐字节非金标（载荷含 Yjs 结构历史），帧长判据用 `byteLength` 下界（R5）。
 */
export function makeLargeUpdateFrame(namespaceId: string, minFrameBytes: number): Uint8Array {
  const doc = new Y.Doc();
  doc.clientID = 424_242;
  const payload = doc.getMap('PAYLOAD_450');
  let size = minFrameBytes;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    payload.set('blob', 'x'.repeat(size));
    const frame = encodeMessage(
      { kind: 'UPDATE', namespaceId, update: Y.encodeStateAsUpdate(doc) },
      { sequence: 0, maxFrameBytes: LIMITS.maxFrameBytes },
    );
    if (frame.byteLength >= minFrameBytes) return frame;
    size += minFrameBytes;
  }
  throw new Error('issue450 夹具前提失败：makeLargeUpdateFrame 未达最小帧长');
}

// ═══════════════════════════ D7：OPENWP 注入面（γ facade × 本地 wire） ═══════════════════════════

const HELLO_NONCE = new Uint8Array(16).fill(0x81);

export function helloFrame450(sequence: number): Uint8Array {
  return encodeMessage(
    {
      kind: 'HELLO',
      peerInstanceId: PEER_INSTANCE,
      expectedHubInstanceId: HUB_INSTANCE,
      protocolVersions: [1],
      requiredCapabilities: 0,
      optionalCapabilities: 0,
      connectionNonce: HELLO_NONCE,
    },
    { sequence },
  );
}

export function openFrame450(namespaceId: string, sequence: number): Uint8Array {
  return encodeMessage(
    { kind: 'OPEN_NAMESPACE', namespaceId, hasLocalReplica: false },
    { sequence },
  );
}

export interface InjectionFlow {
  readonly facade: AsyncFacade;
  readonly node: ReplicaNode;
  readonly connection: HubReplicationEdgeConnection;
  /** 真实 hub namespace（OPEN 的目标；authorize 桩返回其 owner）。 */
  readonly nsId: string;
  /** hub 侧出站帧（按到达对端序；未被丢帧）。 */
  readonly outbound: Uint8Array[];
  /** 对端观察到的 close（`{code, reason}`）。 */
  readonly closes: Array<Readonly<{ code: number; reason: string }>>;
  /** 注入一帧到 hub（同 #421 `inject` 模式）。 */
  inject(bytes: Uint8Array): void;
  /** 出站 ERROR 帧（解码面）。 */
  errors(): Array<{ readonly code: string; readonly namespaceId?: string }>;
  /** 全部出站帧的解码 kind（序断言面）。 */
  kinds(): string[];
}

/**
 * D7 白盒编排：γ facade（`asyncDataAdmissionFatal: true` + F2 延迟解析）× 本地内存 wire ×
 * `acceptTrusted`。零真实 timer（注入调度器）；零协议决策（夹具只注入对端帧）。
 */
export async function bootInjectionFlow(): Promise<InjectionFlow> {
  const node = makeNode('hub');
  const fixture = await makeHubNamespace(node, { owner: HUB_OWNER, root: { n: 42, extra: 77 } });
  const facade = makeAsyncReplicationFacade({
    registry: node.registry,
    authorize: makeAsyncAuthorizer('pass'),
    timer: node.scheduler,
    asyncDataAdmissionFatal: true,
    deferSinkResolve: true,
  });
  const duplex = createMemoryDuplexTransport();
  const outbound: Uint8Array[] = [];
  const closes: Array<Readonly<{ code: number; reason: string }>> = [];
  duplex.peer.onMessage((bytes) => {
    outbound.push(bytes);
  });
  duplex.peer.onClose((info) => {
    closes.push({ code: info.code, reason: info.reason });
  });
  const connection = await facade.host.acceptTrusted(duplex.hub, {
    peerInstanceId: PEER_INSTANCE,
  });
  if (connection === undefined) throw new Error('issue450 夹具前提失败：acceptTrusted 未分配连接');
  return {
    facade,
    node,
    connection,
    nsId: fixture.namespaceId,
    outbound,
    closes,
    inject: (bytes) => duplex.peer.send(bytes),
    errors: () => {
      const errors: Array<{ code: string; namespaceId?: string }> = [];
      for (const bytes of outbound) {
        const decoded = decodeMessage450(bytes);
        if (decoded.kind !== 'ERROR') continue;
        const message = decoded.message as { code: string; namespaceId?: string };
        errors.push({
          code: message.code,
          ...(message.namespaceId === undefined ? {} : { namespaceId: message.namespaceId }),
        });
      }
      return errors;
    },
    kinds: () => outbound.map((bytes) => decodeMessage450(bytes).kind),
  };
}

/** 轻量解码（注入面观测；能力位无关——OPENWP 只产出控制帧）。 */
function decodeMessage450(bytes: Uint8Array): { kind: string; message: unknown } {
  const decoded = decodeMessage(bytes, { maxFrameBytes: LIMITS.maxFrameBytes });
  const message = decoded.message as { kind: string };
  return { kind: message.kind, message };
}
