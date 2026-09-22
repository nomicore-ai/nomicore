/**
 * issue #448 —— γ-T2 **live update 数据面**验收夹具（**test-only**；ADR 0032 附录 A4 / 协议 §24；
 * 装配面逐字复用 #447 `issue447-async-seam.ts` 的宿主桥、FIFO 通道与显式释放泵）。
 *
 * 交付物边界（与 #447 夹具同款纪律）：
 *
 * 1. **零协议决策**：本文件只做 boot 编排（adopt 装配）与观测投影；不合成应答帧、不选错误码、
 *    不缓冲/重排/重试、不复制准入管线。
 * 2. **boot 形态 registry 同一性约束**（#447 设计 §8.3.1）：boot 的 hub 侧观察面
 *    （`run.writeHub` / `run.snapshotDoc('hub')`）硬绑 boot 内部 `hubNode`；只有会话宿主建于
 *    `options.registry`（≡ `run.hubNode.registry`，同一对象）之上时，γ live update 才由
 *    同一 Registry 事实驱动。boot 后立即做前提断言（错位装配在场景前置即红）。
 * 3. **缝推进**：`pumpUntil` / 显式 `release(n)`——延迟注入经 `withholdEdgeToSession`；
 *    `settle()` 不推进缝（#447 泵纪律）。
 * 4. **观测面**：wire 帧经能力感知解码（`decodeWire`）；缝消息经 `delivered()`（= 消费序）；
 *    observer 单事件字段值经 `makeAsyncObserver` 记录器。
 */
import type { ReplicationObserverEvent } from '@nomicore/ws-replication';
import { boot, type Run } from './driver.js';
import { FIXED_MS } from './harness.js';
import {
  makeAsyncObserver,
  makeAsyncReplicationFacade,
  pumpUntil,
  wireFramesOfKind,
  type AsyncFacade,
  type AsyncSessionSeam,
  type WireFrame,
} from './issue447-async-seam.js';

export interface LiveRoundOptions {
  /** 会话宿主与 edge 双侧生效的 limits 注入（pump 前提：boot 显式 partial）。 */
  readonly limits?: Readonly<Record<string, number>>;
  /** CAP_CHUNKED_UPDATE 协商（kind=0 分块 live update 构型必需）。 */
  readonly chunkedUpdate?: boolean;
  /** hub 侧结构化 observer（session 侧 `update-acked`/`chunked-update-*` 事件面）。 */
  readonly hubObserver?: boolean;
  /**
   * 同一 recorder 追加装到 edge 半边（`update-sent` 的发射点 = edge 盖章点，§24.8/A4.7）——
   * 事件型互斥（`update-sent` 只在 edge、`update-acked`/chunked 族只在 session），
   * 单一 recorder 足以做双侧归属断言。
   */
  readonly edgeObserver?: boolean;
  /** hub 侧单调时源（`ackLatencyMs` t0/t1 锚；缺省 = 无 clock 面）。 */
  readonly hubClock?: () => number | undefined;
}

export interface LiveRound {
  readonly run: Run;
  readonly facade: AsyncFacade;
  readonly observerEvents: readonly ReplicationObserverEvent[];
  /** edge 生成的唯一连接键（`${instanceId}-conn-${n}`）。 */
  readonly connectionKey: string;
  /** 唯一会话缝通道对。 */
  seam(): AsyncSessionSeam;
  /** 过缝出站 data lane 帧数（`probes.outbound` 投影；含 tag/kind）。 */
  dataFramesOut(): number;
  /** 过缝出站 data lane 帧（tag/kind；与 `probes.stamps` 配对断言面）。 */
  dataFramesSent(): ReadonlyArray<{ tag: number; lane: 'control' | 'data'; kind: string }>;
  /** hub→peer wire 帧（能力感知解码）。 */
  hubFrames(kind: string): WireFrame[];
  /** peer→hub wire 帧（能力感知解码）。 */
  peerFrames(kind: string): WireFrame[];
  /** 推进到 namespace live（缝消息由显式释放搬运）。 */
  awaitLive(): Promise<void>;
  /** 指定型 observer 事件（字段值断言面）。 */
  events(type: string): Array<Record<string, unknown>>;
  /** 会话→edge 控制信号（`settled:ns` / `connection-fatal:CODE`）。 */
  fatalSignals(): string[];
}

/** boot 一个 adopt 装配的 γ 回合（先置前提断言；namespace 推进由 pumpUntil 驱动）。 */
export async function bootLiveRound(opts: LiveRoundOptions = {}): Promise<LiveRound> {
  const recorder =
    opts.hubObserver === true || opts.edgeObserver === true ? makeAsyncObserver() : undefined;
  const clockRef = { now: opts.hubClock };
  let facade: AsyncFacade | undefined;
  const run = await boot({
    ...(opts.chunkedUpdate === undefined ? {} : { chunkedUpdate: opts.chunkedUpdate }),
    ...(opts.limits === undefined ? {} : { limits: opts.limits }),
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
        // issue #448：edge 半边 observer（`update-sent` 发射点断言面）；缺省零传。
        ...(opts.edgeObserver === true && recorder !== undefined
          ? { edgeObserver: recorder.observer }
          : {}),
      });
      return facade.replication;
    },
  });
  if (facade === undefined) throw new Error('issue448 夹具前提失败：facade 未被 boot 调用');
  // 装配前提（#447 设计 §8.3.1）：会话宿主 registry 必须是 boot 传入的同一对象。
  if (facade.worker.registry !== run.hubNode.registry) {
    throw new Error('issue448 夹具前提失败：worker.registry !== run.hubNode.registry');
  }
  const connections = [...facade.host.connections.keys()];
  if (connections.length !== 1) {
    throw new Error(`issue448 夹具前提失败：γ 装配连接数 = ${connections.length}（应恰 1）`);
  }
  const connectionKey = connections[0]!;
  const host = facade.host;
  const dataFramesSent = (): ReadonlyArray<{ tag: number; lane: 'control' | 'data'; kind: string }> =>
    host.probes.outbound.filter((frame) => frame.lane === 'data');
  return {
    run,
    facade,
    observerEvents: recorder?.events ?? [],
    connectionKey,
    seam: () => host.channel(connectionKey, run.nsId),
    dataFramesOut: () => dataFramesSent().length,
    dataFramesSent,
    hubFrames: (kind) => wireFramesOfKind(run.wire.hubToPeer, kind),
    peerFrames: (kind) => wireFramesOfKind(run.wire.peerToHub, kind),
    awaitLive: async () => {
      await pumpUntil(host, () => run.namespaceState() === 'live', 'namespace live');
    },
    events: (type) =>
      (recorder?.events ?? []).filter((event) => event.type === type) as Array<
        Record<string, unknown>
      >,
    fatalSignals: () =>
      host.probes.signals.filter((signal) => signal.startsWith('connection-fatal')),
  };
}
