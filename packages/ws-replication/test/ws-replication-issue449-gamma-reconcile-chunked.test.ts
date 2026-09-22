/**
 * SA6 验收契约 — issue #449（γ-T3）：**reconcile 与分块 transfer 跨 γ 异步缝**
 * （ROUND3 / ANCHOR3 / CHUNK3 / ABORT3 / DRAIN3 五族；契约条目权威规格 = SA6 §12.3，
 * 设计 §8.1 著写规格）。
 *
 * 装配形态（沿用 #448 `bootLiveRound` / #447 `bootAsyncRound` 先例，本文件自带局部 boot）：
 *
 *   `boot({ createHub: makeAsyncReplicationFacade, random: () => 0.5, waitFor: 'none' })`
 *   —— boot 的 `options.registry` 被 facade **结构性采纳**为 γ 会话宿主与 edge 工厂的
 *   配置（同一对象）；boot 后先置前提断言（错位装配在场景前置即红）。
 *
 *   **缝推进**：`pumpUntil` / 显式 `release(n)` / `setHeld`（延迟可注入、零真实 timer）——
 *   扣留场景经 `withholdEdgeToSession` + 逐条 `release(1)` 精确控制中间态。
 *
 * 纪律（SA6 §12.0 + A4.8）：断言 = 运行时行为（wire 帧 kind/序 / `[8..12]` / `ackedSequence`
 * 回指 / 缝消息 `delivered()` 消费序 / observer 单事件字段值 / 文档收敛）；零源码 grep；
 * 零 skip/only/todo；零 env override；零真实 timer/网络/wall-clock；隔离变异在 `finally`
 * 恢复生产原型；真 peer（`createPeerReplication`）+ 真 Registry/Runtime + 公共工厂真身。
 *
 * 条目 → 用例映射（SA6 §12.3 逐条）：
 *   ROUND3-C1 / CHUNK3-C2 → describe ROUND3 第 1 例；ROUND3-C2 → 第 2 例；ROUND3-C3 → 第 3 例；
 *   ANCHOR3-C1 → ANCHOR3 第 1 例；ANCHOR3-N1 → 第 2 例；
 *   CHUNK3-C0 / CHUNK3-C1 / CHUNK3-P1 → CHUNK3 三例；
 *   ABORT3-C1 / C2 / C3 / N1 → ABORT3 四例；DRAIN3-C1 / DRAIN3-D1 → DRAIN3 两例。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { ReplicationObserverEvent } from '@nomicore/ws-replication';
import { advanceMs, boot, type Run } from './driver.js';
import { settle, settleUntil } from './harness.js';
import {
  decodeWire,
  isInboundFrame,
  isReceipt,
  kindOfPlaceholder,
  makeAsyncObserver,
  makeAsyncReplicationFacade,
  pumpUntil,
  wireControlFrames,
  wireDataFrames,
  wireDocState,
  wireFramesHexEqual,
  wireFramesOfKind,
  wireSkeleton,
  type AsyncFacade,
  type AsyncSessionSeam,
  type EdgeToSessionMessage,
  type WireFrame,
} from './issue447-async-seam.js';

// ═══════════════════════════ 构型常量（设计 §13-R6 构型链；全部过 validate.ts 显式门） ═══════════════════════════

/** kind=2 多 chunk 构型（ROUND3-C1/C2/C3、CHUNK3-C2、CHUNK3-P1、ABORT3-C2）：
 *  diff 2B > maxSyncDiffBytes=1 ⇒ 真实改道；64 ≤ 64×1（聚合链②）；bootstrap ≤ 4096 单帧。 */
const K2_MULTI_CHUNK = {
  maxSyncDiffBytes: 1,
  maxChunkedSyncDiffBytes: 64,
  maxUpdateBytes: 1,
  maxBootstrapBytes: 4096,
} as const;

/** kind=1 分块 bootstrap 构型（ANCHOR3-C1/N1、CHUNK3-C1、ABORT3-C1/N1）：
 *  快照 > 8 ⇒ 真实改道；1024 ≤ 64×64（聚合链②）⇒ 7 chunk。 */
const K1_CHUNKED_BOOTSTRAP = {
  maxBootstrapBytes: 8,
  maxChunkedBootstrapBytes: 1024,
  maxUpdateBytes: 64,
} as const;

/** kind=0 分块 live update 构型（CHUNK3-C0）：16B 上限 ⇒ 真实改道；窗口 1 槽。 */
const K0_CHUNKED_UPDATE = {
  maxUpdateBytes: 16,
  maxChunkedUpdateBytes: 1024,
  maxInFlightUpdates: 1,
} as const;

/** DRAIN3-C1 构型：kind=2 单 chunk（diff 2B > 1）——「第 2 笔」为单帧 live UPDATE。 */
const K2_SINGLE_CHUNK = {
  maxSyncDiffBytes: 1,
  maxChunkedSyncDiffBytes: 64,
  maxUpdateBytes: 64,
} as const;

/** ABORT3-C3 构型：kind=1 分块 bootstrap（连接 0）+ kind=2 分块 sync（重连新作用域）。 */
const K_ABORT_RECONNECT = {
  maxBootstrapBytes: 8,
  maxChunkedBootstrapBytes: 1024,
  maxUpdateBytes: 64,
  maxSyncDiffBytes: 1,
  maxChunkedSyncDiffBytes: 4096,
} as const;

// ═══════════════════════════ 局部 boot（设计 §7-D5：文件内局部助手，夹具零改动） ═══════════════════════════

interface GammaRound {
  readonly run: Run;
  readonly facade: AsyncFacade;
  readonly observerEvents: readonly ReplicationObserverEvent[];
  /** edge 生成的唯一连接键（`${instanceId}-conn-${n}`）。 */
  readonly connectionKey: string;
  seam(): AsyncSessionSeam;
  hubFrames(kind: string): WireFrame[];
  peerFrames(kind: string): WireFrame[];
  dataFramesOut(): number;
  events(type: string): Array<Record<string, unknown>>;
  fatalSignals(): string[];
  settledSignals(): string[];
  awaitLive(): Promise<void>;
}

interface GammaBootOptions {
  readonly chunkedUpdate?: boolean;
  readonly limits?: Readonly<Record<string, number>>;
  readonly hubObserver?: boolean;
  readonly hubClock?: () => number | undefined;
}

/** boot 一个 adopt 装配的 γ 回合（先置前提断言；namespace 推进由显式缝泵驱动）。 */
async function bootGamma(opts: GammaBootOptions = {}): Promise<GammaRound> {
  const recorder = opts.hubObserver === true ? makeAsyncObserver() : undefined;
  const clockRef = { now: opts.hubClock };
  let facade: AsyncFacade | undefined;
  const run = await boot({
    ...(opts.chunkedUpdate === undefined ? {} : { chunkedUpdate: opts.chunkedUpdate }),
    ...(opts.limits === undefined ? {} : { limits: opts.limits }),
    ...(recorder !== undefined ? { hubObserver: recorder.observer } : {}),
    ...(opts.hubClock !== undefined
      ? { hubClock: { now: () => clockRef.now?.() ?? 0 } }
      : {}),
    waitFor: 'none',
    random: () => 0.5,
    createHub: (options) => {
      facade = makeAsyncReplicationFacade(options);
      return facade.replication;
    },
  });
  if (facade === undefined) throw new Error('issue449 前提失败：facade 未被 boot 调用');
  // 装配前提（#447 设计 §8.3.1）：会话宿主 registry 必须是 boot 传入的同一对象。
  expect(
    facade.worker.registry,
    'issue449 装配前提：worker.registry === run.hubNode.registry（同一对象）',
  ).toBe(run.hubNode.registry);
  const connections = [...facade.host.connections.keys()];
  expect(connections, 'γ 装配连接数').toHaveLength(1);
  const connectionKey = connections[0]!;
  const host = facade.host;
  return {
    run,
    facade,
    observerEvents: recorder?.events ?? [],
    connectionKey,
    seam: () => host.channel(connectionKey, run.nsId),
    hubFrames: (kind) => wireFramesOfKind(run.wire.hubToPeer, kind),
    peerFrames: (kind) => wireFramesOfKind(run.wire.peerToHub, kind),
    dataFramesOut: () => host.probes.outbound.filter((frame) => frame.lane === 'data').length,
    events: (type) =>
      (recorder?.events ?? []).filter((event) => event.type === type) as Array<
        Record<string, unknown>
      >,
    fatalSignals: () => host.probes.signals.filter((signal) => signal.startsWith('connection-fatal')),
    settledSignals: () => host.probes.signals.filter((signal) => signal.startsWith('settled:')),
    awaitLive: async () => {
      await pumpUntil(host, () => run.namespaceState() === 'live', 'namespace live');
    },
  };
}

// ═══════════════════════════ 判据助手（能力感知；与夹具头注 9 同款口径） ═══════════════════════════

function rawSequenceOf(bytes: Uint8Array): number {
  return ((bytes[8]! << 24) | (bytes[9]! << 16) | (bytes[10]! << 8) | bytes[11]!) >>> 0;
}

function ackedSequenceOf(frame: WireFrame): number {
  return (frame.message as { ackedSequence: number }).ackedSequence;
}

/** 某 wire 序的盖章记录（tag→sequence 配对）。 */
function stampOfSequence(round: GammaRound, sequence: number): { tag: number; sequence: number } {
  const stamp = round.facade.host.probes.stamps.find((entry) => entry.sequence === sequence);
  if (stamp === undefined) throw new Error(`issue449: 无 wire 序 ${sequence} 的盖章记录`);
  return stamp;
}

/** 某出站帧 kind 的 tag（`probes.outbound` 事实源；缺省 = 尚未过缝）。 */
function tagOfOutboundKind(round: GammaRound, kind: string): number | undefined {
  return round.facade.host.probes.outbound.find((frame) => frame.kind === kind)?.tag;
}

/** kind 感知的 hub→peer / peer→hub 分块帧（`transferKind` 判别）。 */
function chunksOfKind(
  round: GammaRound,
  transferKind: number,
  side: 'hub' | 'peer',
): WireFrame[] {
  const frames = side === 'hub' ? round.run.wire.hubToPeer : round.run.wire.peerToHub;
  return wireFramesOfKind(frames, 'UPDATE_CHUNK').filter(
    (frame) => (frame.message as { transferKind?: number }).transferKind === transferKind,
  );
}

/** 「本方向 kind=k transfer 已全部过缝」（chunkIndex 到达申报 chunkCount）。 */
function transferSettledOutbound(round: GammaRound, transferKind: number): boolean {
  const chunks = chunksOfKind(round, transferKind, 'hub');
  if (chunks.length === 0) return false;
  const chunkCount = (chunks[0]!.message as { chunkCount: number }).chunkCount;
  return chunks.length >= chunkCount;
}

/** 缝消息名（诊断断言消息用；不改任何行为）。 */
function describeMessage(message: EdgeToSessionMessage): string {
  if (typeof message === 'string') return message;
  if (isReceipt(message)) return `receipt(tag=${message.tag},seq=${message.sequence})`;
  if (isInboundFrame(message)) {
    const frame = decodeWire([message.bytes])[0]!;
    const detail = frame.message as {
      ackedSequence?: number;
      transferKind?: number;
      chunkIndex?: number;
    };
    return `frame(${frame.kind}#${frame.sequence}${
      detail.transferKind === undefined ? '' : `,tk=${detail.transferKind},ci=${detail.chunkIndex}`
    }${detail.ackedSequence === undefined ? '' : `,ack=${detail.ackedSequence}`})`;
  }
  return '<unknown>';
}

/** 单步微任务/defer 泵（**不触碰缝通道**——扣留中间态的确定性推进）。 */
async function microPump(steps = 1): Promise<void> {
  for (let index = 0; index < steps; index += 1) {
    try {
      await settleUntil(() => false, 'microPump', 1);
    } catch {
      // 预期：单步预算内无谓词可满足。
    }
  }
}

/** 恰投递 n 条被扣消息（放行后立即重新扣留——中间态断言面）。 */
function releaseHeld(seam: AsyncSessionSeam, count: number): number {
  seam.edgeToSession.setHeld(false);
  const released = seam.edgeToSession.release(count);
  seam.edgeToSession.setHeld(true);
  return released;
}

/** 会话通道对建立（OPEN 帧入缓存的先决条件）。 */
async function seamWhenOpen(round: GammaRound): Promise<AsyncSessionSeam> {
  await settleUntil(() => round.facade.host.seams.size === 1, 'γ 会话通道对建立');
  const seam = round.seam();
  await settleUntil(() => seam.edgeToSession.pending().length >= 1, 'OPEN 帧入 edge→session 缓冲');
  return seam;
}

/** 扣留 edge→session 并只放行 OPEN 帧：会话启动、其后一切被扣（延迟注入面）。 */
async function withholdAfterOpen(round: GammaRound): Promise<AsyncSessionSeam> {
  const seam = await seamWhenOpen(round);
  round.facade.host.withholdEdgeToSession(round.connectionKey, round.run.nsId);
  seam.edgeToSession.setHeld(false);
  expect(seam.edgeToSession.release(1), '恰放行 OPEN 帧').toBe(1);
  seam.edgeToSession.setHeld(true);
  await settle();
  return seam;
}

/** 推进 kind=1 分块 bootstrap 至全部 chunk 过缝（回执全部扣留）。 */
async function driveChunkedBootstrap(round: GammaRound): Promise<AsyncSessionSeam> {
  const seam = await withholdAfterOpen(round);
  for (let step = 0; step < 80; step += 1) {
    seam.sessionToEdge.release();
    await microPump();
    if (transferSettledOutbound(round, 1)) {
      expect(chunksOfKind(round, 1, 'hub').length, 'kind=1 chunk 数（≥2 真实改道）').toBeGreaterThanOrEqual(2);
      return seam;
    }
  }
  throw new Error('issue449: kind=1 分块 bootstrap 未在有限步内全部过缝');
}

/** 推进至 kind=2 chunk 全部过缝（回执与 SYNC_APPLIED 仍扣留）。 */
async function driveChunkedStep2(round: GammaRound): Promise<AsyncSessionSeam> {
  const seam = await withholdAfterOpen(round);
  for (let step = 0; step < 120; step += 1) {
    seam.sessionToEdge.release();
    await microPump();
    if (transferSettledOutbound(round, 2)) {
      expect(chunksOfKind(round, 2, 'hub').length, 'kind=2 chunk 数').toBeGreaterThanOrEqual(1);
      return seam;
    }
    if (seam.edgeToSession.pending().length > 0) releaseHeld(seam, 1);
    await microPump();
  }
  throw new Error('issue449: kind=2 分块 Step2 未在有限步内全部过缝');
}

/** 收齐「已投递 + 缓冲」回执（扣留期配对断言面）。 */
function receiptsOf(seam: AsyncSessionSeam): Array<{ tag: number; sequence: number }> {
  return [...seam.edgeToSession.delivered(), ...seam.edgeToSession.pending()].filter(isReceipt);
}

function docHex(doc: Y.Doc): string {
  return Buffer.from(Y.encodeStateAsUpdate(doc)).toString('hex');
}

// ═══════════════════════════ ROUND3 族（AC1：三态锚 + sync round 全回合） ═══════════════════════════

/**
 * 锚相位的事实形态（评审对照 SA6 §12.3「pending」措辞用）：分块形态（kind=1/2）下 γ 的锚在
 * **末 chunk 序回执结算回调**里才落 `stamped`（`onLastChunkSent` / `noteChunkedStep2Outbound`）；
 * 在此之前锚是 **idle（undefined）** 而非 `pending(tag)`。判别口径单点在
 * `RoundEngine.anchorSequenceOf`（idle ∨ pending 皆 ⇒ undefined）⇒ **两形态同构地响亮**
 * （引用性 ACK 不得被静默接受）：本族 `ROUND3-C2/C3`、`ANCHOR3-N1` 锚的正是这一判别；单帧
 * 形态的 `pending(tag)` 面由既有 #447 `ANCHOR-C2`/`CHUNK-C2` 锚定，本票不重复。
 */
describe('issue #449 ROUND3 — kind=2 sync round 跨缝全回合（ownStep1Seq/ownStep2Seq 三态锚）', () => {
  it('ROUND3-C1 / CHUNK3-C2（AC1/AC4）：多 chunk 构型下单帧 SYNC_STEP2 恒 0；两方向 kind=2 chunkIndex 0..k-1（k≥2）；双向 SYNC_APPLIED 回指对端末 chunk；chunked-sync-sent/-applied/-acked 各恰一次；live + 双向文档语义等', async () => {
    const round = await bootGamma({
      chunkedUpdate: true,
      limits: K2_MULTI_CHUNK,
      hubObserver: true,
    });
    await round.awaitLive();
    const { run } = round;

    // 单帧 SYNC_STEP2 恒 0（两方向）——分块改道是真实形态，非单帧路径。
    expect(round.hubFrames('SYNC_STEP2'), 'hub→peer 单帧 SYNC_STEP2 数').toHaveLength(0);
    expect(round.peerFrames('SYNC_STEP2'), 'peer→hub 单帧 SYNC_STEP2 数').toHaveLength(0);

    // 两方向 kind=2 chunk 族：chunkIndex 0..k-1、chunkCount=k、单 transferId（k≥2）。
    for (const [label, chunks] of [
      ['hub→peer', chunksOfKind(round, 2, 'hub')],
      ['peer→hub', chunksOfKind(round, 2, 'peer')],
    ] as const) {
      expect(chunks.length, `${label} kind=2 chunk 数（≥2）`).toBeGreaterThanOrEqual(2);
      expect(
        chunks.map((frame) => (frame.message as { chunkIndex: number }).chunkIndex),
        `${label} chunkIndex 严格 0..k-1`,
      ).toEqual(chunks.map((_, index) => index));
      expect(
        new Set(chunks.map((frame) => (frame.message as { chunkCount: number }).chunkCount)).size,
        `${label} chunkCount 单值`,
      ).toBe(1);
      expect(
        (chunks[0]!.message as { chunkCount: number }).chunkCount,
        `${label} chunkCount = chunk 数`,
      ).toBe(chunks.length);
      expect(
        new Set(chunks.map((frame) => (frame.message as { transferId: number }).transferId)).size,
        `${label} 单 transferId`,
      ).toBe(1);
    }
    const hubChunks = chunksOfKind(round, 2, 'hub');
    const peerChunks = chunksOfKind(round, 2, 'peer');

    // 双向回指：SYNC_APPLIED.ackedSequence = 对端末 chunk 帧序（末 chunk 回执结算锚）。
    const hubApplied = round.hubFrames('SYNC_APPLIED');
    const peerApplied = round.peerFrames('SYNC_APPLIED');
    expect(hubApplied, 'hub→peer SYNC_APPLIED 数').toHaveLength(1);
    expect(peerApplied, 'peer→hub SYNC_APPLIED 数').toHaveLength(1);
    expect(
      ackedSequenceOf(hubApplied[0]!),
      'hub SYNC_APPLIED 回指 peer 末 chunk 帧序',
    ).toBe(peerChunks[peerChunks.length - 1]!.sequence);
    expect(
      ackedSequenceOf(peerApplied[0]!),
      'peer SYNC_APPLIED 回指 hub 末 chunk 帧序',
    ).toBe(hubChunks[hubChunks.length - 1]!.sequence);

    // 事件恰一 + 无 `sequence` 键（chunked 族键集冻结）+ ackLatencyMs 在场（clock 面）。
    const sent = round.events('chunked-sync-sent');
    const applied = round.events('chunked-sync-applied');
    const acked = round.events('chunked-sync-acked');
    expect(sent, 'chunked-sync-sent 恰一次').toHaveLength(1);
    expect(applied, 'chunked-sync-applied 恰一次').toHaveLength(1);
    expect(acked, 'chunked-sync-acked 恰一次').toHaveLength(1);
    for (const [label, event] of [['sent', sent[0]!], ['applied', applied[0]!], ['acked', acked[0]!]] as const) {
      expect(event, `${label} 无 sequence 键`).not.toHaveProperty('sequence');
      expect(typeof (event.bytes ?? event.totalBytes), `${label} 字节字段在场`).toBe('number');
    }
    expect(sent[0]!.chunkCount, 'sent.chunkCount').toBe(hubChunks.length);
    expect(acked[0]!.bytes, 'acked.bytes = transfer totalBytes').toBe(
      (hubChunks[0]!.message as { totalBytes: number }).totalBytes,
    );

    // live + 双向文档语义等（Yjs clientID 随机 ⇒ 语义判据）。
    expect(run.namespaceState(), 'namespace 状态').toBe('live');
    expect(docHex(run.snapshotDoc('hub')), 'hub/peer 文档收敛').toBe(docHex(run.snapshotDoc('peer')));
    expect(round.fatalSignals(), '成功路径零响亮收口').toHaveLength(0);
  }, 30_000);

  it('ROUND3-C2（AC1 NC，ownStep1Seq pending 面）：丢弃 hub SYNC_STEP1 回执 + 对端 SYNC_STEP2 引用其序 ⇒ 响亮 SYNC_STATE_VIOLATION + namespace failed；零 park', async () => {
    const round = await bootGamma({ chunkedUpdate: true, limits: K2_MULTI_CHUNK });
    const seam = await withholdAfterOpen(round);

    // 步进推进至 hub SYNC_STEP1 出站（tag 已知）——其回执在扣留缓冲中等待投递。
    let step1Tag: number | undefined;
    for (let step = 0; step < 120 && step1Tag === undefined; step += 1) {
      seam.sessionToEdge.release();
      await microPump();
      step1Tag = tagOfOutboundKind(round, 'SYNC_STEP1');
      if (step1Tag === undefined && seam.edgeToSession.pending().length > 0) releaseHeld(seam, 1);
      await microPump();
    }
    expect(step1Tag, 'hub SYNC_STEP1 出站（tag 事实源 = probes.outbound）').toBeDefined();
    expect(
      seam.edgeToSession
        .pending()
        .some((message) => isReceipt(message) && message.tag === step1Tag),
      'SYNC_STEP1 回执已在扣留缓冲（丢弃注入前提）',
    ).toBe(true);

    // 违契注入：按 tag 丢弃该回执（锚停留 pending）⇒ 对端 SYNC_STEP2 引用未盖章序。
    seam.edgeToSession.setDropPredicate(
      (message) => isReceipt(message) && message.tag === step1Tag,
    );
    seam.edgeToSession.setHeld(false);
    seam.edgeToSession.release();
    await pumpUntil(round.facade.host, () => round.hubFrames('ERROR').length >= 1, '响亮收口 ERROR');

    const codes = round.hubFrames('ERROR').map((frame) => (frame.message as { code: string }).code);
    expect(codes, `hub ERROR 码（${JSON.stringify(codes)}）`).toContain('SYNC_STATE_VIOLATION');
    expect(round.run.namespaceState(), 'namespace 终局').toBe('failed');
    // 违契证据（反假绿）：① 被丢弃的回执确在 dropped 集（锚停留 pending）；
    // ② 对端引用帧已过缝（同 round 的 kind=2 chunk 或单帧 SYNC_STEP2）——响亮非「恰好没收到帧」。
    expect(
      seam.edgeToSession.dropped().some((message) => isReceipt(message) && message.tag === step1Tag),
      '① SYNC_STEP1 回执被丢弃（锚停留 pending 的事实源）',
    ).toBe(true);
    const step1Stamp = round.facade.host.probes.stamps.find((stamp) => stamp.tag === step1Tag)!;
    const referencing =
      round.peerFrames('SYNC_STEP2').some(
        (frame) =>
          (frame.message as { relatedStep1Sequence: number }).relatedStep1Sequence ===
          step1Stamp.sequence,
      ) || chunksOfKind(round, 2, 'peer').length > 0;
    expect(referencing, '② 对端引用帧已过缝（零 park 的对抗前提）').toBe(true);
    expect(round.events('chunked-sync-acked'), '违契下零结算事件').toHaveLength(0);
  }, 30_000);

  it('ROUND3-C3（AC2 NC，ownStep2Seq pending 面）：步进至队列头 = 末 kind=2 chunk 回执（次位 = 对端 SYNC_APPLIED），reorderNext 后先消费 SYNC_APPLIED ⇒ 响亮 SYNC_STATE_VIOLATION；交换点在场断言防编排漂移', async () => {
    const round = await bootGamma({ chunkedUpdate: true, limits: K2_MULTI_CHUNK, hubObserver: true });
    const seam = await withholdAfterOpen(round);

    // 步进放行（每次至多 1 条出站帧 / 1 条入站消息）至交换点。
    let exchange:
      | { lastChunkTag: number; lastChunkSequence: number; applied: EdgeToSessionMessage }
      | undefined;
    for (let step = 0; step < 200 && exchange === undefined; step += 1) {
      const chunks = chunksOfKind(round, 2, 'hub');
      const lastChunk = chunks[chunks.length - 1];
      if (lastChunk !== undefined) {
        const lastChunkTag = round.facade.host.probes.stamps.find(
          (stamp) => stamp.sequence === lastChunk.sequence,
        )?.tag;
        const pending = seam.edgeToSession.pending();
        const head = pending[0];
        const second = pending[1];
        if (
          lastChunkTag !== undefined &&
          head !== undefined &&
          isReceipt(head) &&
          head.tag === lastChunkTag &&
          second !== undefined &&
          isInboundFrame(second) &&
          kindOfPlaceholder(second.bytes) === 'SYNC_APPLIED'
        ) {
          exchange = { lastChunkTag, lastChunkSequence: lastChunk.sequence, applied: second };
          break;
        }
      }
      if (seam.sessionToEdge.pending().length > 0) {
        seam.sessionToEdge.release(1);
        await microPump();
        continue;
      }
      if (seam.edgeToSession.pending().length > 0) {
        releaseHeld(seam, 1);
        await microPump();
        continue;
      }
      await microPump();
    }
    // 反假绿（设计 §7-D4 步骤 2）：交换点在场断言——队列头必须是末 kind=2 chunk 回执。
    expect(
      exchange,
      `交换点未达（编排漂移）——缓冲=${seam.edgeToSession.pending().map(describeMessage).join(' | ')}`,
    ).toBeDefined();
    const { lastChunkTag, lastChunkSequence, applied } = exchange!;
    expect(
      ackedSequenceOf(decodeWire([(applied as { bytes: Uint8Array }).bytes])[0]!),
      '次位 SYNC_APPLIED 回指 hub 末 chunk 帧序',
    ).toBe(lastChunkSequence);

    // 违契注入：交换前两条 ⇒ session 先消费 SYNC_APPLIED（其引用序尚未经回执回填 ⇒ ownStep2Seq 仍 pending）。
    seam.edgeToSession.reorderNext();
    seam.edgeToSession.setHeld(false);
    expect(seam.edgeToSession.release(1), '恰放行交换后首条（SYNC_APPLIED）').toBe(1);
    seam.edgeToSession.setHeld(true);
    await microPump();
    await pumpUntil(round.facade.host, () => round.hubFrames('ERROR').length >= 1, '响亮收口 ERROR');

    const codes = round.hubFrames('ERROR').map((frame) => (frame.message as { code: string }).code);
    expect(codes, `hub ERROR 码（${JSON.stringify(codes)}）`).toContain('SYNC_STATE_VIOLATION');
    expect(round.run.namespaceState(), 'namespace 终局').toBe('failed');
    // 零静默接受：消费序证据——SYNC_APPLIED 严格先于其引用的末 chunk 回执被消费。
    seam.edgeToSession.setHeld(false);
    seam.edgeToSession.release();
    const delivered = seam.edgeToSession.delivered();
    const appliedIndex = delivered.findIndex(
      (message) =>
        isInboundFrame(message) &&
        kindOfPlaceholder(message.bytes) === 'SYNC_APPLIED' &&
        ackedSequenceOf(decodeWire([message.bytes])[0]!) === lastChunkSequence,
    );
    const receiptIndex = delivered.findIndex(
      (message) => isReceipt(message) && message.tag === lastChunkTag,
    );
    expect(appliedIndex, 'SYNC_APPLIED 在消费序中').toBeGreaterThanOrEqual(0);
    expect(receiptIndex, '末 chunk 回执在消费序中').toBeGreaterThanOrEqual(0);
    expect(appliedIndex, '违契消费序：ACK 先于其锚回执').toBeLessThan(receiptIndex);
    expect(round.events('chunked-sync-acked'), '违契下零结算事件').toHaveLength(0);
  }, 30_000);
});

// ═══════════════════════════ ANCHOR3 族（AC2：保序锚 + 延迟注入编排） ═══════════════════════════

describe('issue #449 ANCHOR3 — SYNC_APPLIED / BOOTSTRAP_ACK 保序锚（kind=1 分块形态）', () => {
  it('ANCHOR3-C1（AC2）：三步步进——① 中间 chunk 回执：仍 awaiting-ack + 零 sent；② 末 chunk 回执：锚 stamped + sent 恰一次（t0 = 推送时刻）；③ BOOTSTRAP_ACK：acked 恰一次 + 回指末 chunk 序 + 消费序 strict 先行 + live', async () => {
    const clock = {
      value: 1_000,
      advance(ms: number): void {
        this.value += ms;
      },
    };
    const round = await bootGamma({
      chunkedUpdate: true,
      limits: K1_CHUNKED_BOOTSTRAP,
      hubObserver: true,
      hubClock: () => clock.value,
    });
    const seam = await driveChunkedBootstrap(round);
    const chunks = chunksOfKind(round, 1, 'hub');
    const lastChunkSequence = chunks[chunks.length - 1]!.sequence;
    const lastChunkTag = stampOfSequence(round, lastChunkSequence).tag;

    // 步 ①：放行全部非末 chunk 回执（含 OPEN_OK 回执）⇒ 载体仍 awaiting-ack（零 sent / 零 acked）。
    const heldBeforeStep1 = seam.edgeToSession.pending().length;
    expect(heldBeforeStep1, '① 扣留缓冲含 OPEN_OK 回执 + 每 chunk 回执').toBeGreaterThanOrEqual(
      chunks.length + 1,
    );
    expect(
      releaseHeld(seam, heldBeforeStep1 - 1),
      '恰放行「除末 chunk 回执外」的全部扣留消息',
    ).toBe(heldBeforeStep1 - 1);
    await settle();
    await settleUntil(
      () =>
        seam.edgeToSession
          .pending()
          .some(
            (message) =>
              isInboundFrame(message) &&
              kindOfPlaceholder(message.bytes) === 'BOOTSTRAP_ACK',
          ),
      '① peer BOOTSTRAP_ACK 入扣留缓冲（引用帧已在场）',
    );
    expect(round.events('chunked-snapshot-sent'), '① 末 chunk 回执未到 ⇒ 零 sent 事件').toHaveLength(0);
    expect(round.events('chunked-snapshot-acked'), '① 零 acked 事件').toHaveLength(0);
    const head = seam.edgeToSession.pending()[0];
    expect(
      head !== undefined && isReceipt(head) && head.tag === lastChunkTag,
      `① 扣留缓冲头 = 末 chunk 回执（实际 ${head === undefined ? '-' : describeMessage(head)}）`,
    ).toBe(true);

    // 步 ②：k ms 后放行末 chunk 回执 ⇒ 锚 stamped + sent 恰一次（t0 = 推送时刻）；ACK 未到 ⇒ 零 acked。
    const k = 7;
    clock.advance(k);
    expect(releaseHeld(seam, 1), '② 恰放行末 chunk 回执').toBe(1);
    await settle();
    const sent = round.events('chunked-snapshot-sent');
    expect(sent, '② chunked-snapshot-sent 恰一次').toHaveLength(1);
    expect(sent[0]!.chunkCount, '② sent.chunkCount = chunk 数').toBe(chunks.length);
    expect(round.events('chunked-snapshot-acked'), '② 末 chunk 回执登记不发射 acked').toHaveLength(0);
    const nextHead = seam.edgeToSession.pending()[0];
    expect(
      nextHead !== undefined &&
        isInboundFrame(nextHead) &&
        kindOfPlaceholder(nextHead.bytes) === 'BOOTSTRAP_ACK',
      `② 缓冲头 = BOOTSTRAP_ACK 入站帧（实际 ${nextHead === undefined ? '-' : describeMessage(nextHead)}）`,
    ).toBe(true);

    // 步 ③：m ms 后放行 BOOTSTRAP_ACK ⇒ acked 恰一次 + 回指末 chunk 序 + 消费序 strict 先行。
    const m = 5;
    clock.advance(m);
    seam.edgeToSession.setHeld(false);
    seam.edgeToSession.release();
    await round.awaitLive();
    const acked = round.events('chunked-snapshot-acked');
    expect(acked, '③ chunked-snapshot-acked 恰一次').toHaveLength(1);
    expect(acked[0]!.ackLatencyMs, '③ t0 = 末 chunk 推送时刻（k + m）').toBe(k + m);
    const bootstrapAcks = round.peerFrames('BOOTSTRAP_ACK');
    expect(bootstrapAcks, '③ peer BOOTSTRAP_ACK 数').toHaveLength(1);
    expect(ackedSequenceOf(bootstrapAcks[0]!), '③ ACK 回指末 chunk 帧序').toBe(lastChunkSequence);

    const delivered = seam.edgeToSession.delivered();
    const receiptIndex = delivered.findIndex(
      (message) => isReceipt(message) && message.tag === lastChunkTag,
    );
    const ackIndex = delivered.findIndex(
      (message) =>
        isInboundFrame(message) &&
        kindOfPlaceholder(message.bytes) === 'BOOTSTRAP_ACK' &&
        ackedSequenceOf(decodeWire([message.bytes])[0]!) === lastChunkSequence,
    );
    expect(receiptIndex, '③ 末 chunk 回执在消费序中').toBeGreaterThanOrEqual(0);
    expect(ackIndex, '③ BOOTSTRAP_ACK 在消费序中').toBeGreaterThanOrEqual(0);
    expect(receiptIndex, '③ 保序条款：末 chunk 回执 strict 先于引用该序的 BOOTSTRAP_ACK').toBeLessThan(
      ackIndex,
    );

    expect(round.run.namespaceState(), '③ namespace live').toBe('live');
    expect(docHex(round.run.snapshotDoc('hub')), '③ hub/peer 文档收敛').toBe(
      docHex(round.run.snapshotDoc('peer')),
    );
  }, 30_000);

  it('ANCHOR3-N1（AC2 NC）：同构型丢弃全部 kind=1 chunk 回执（锚停留 pending）后放行 BOOTSTRAP_ACK ⇒ 响亮 connection-fatal{ACK_STATE_VIOLATION} + ERROR + 非 live；零静默接受', async () => {
    const round = await bootGamma({
      chunkedUpdate: true,
      limits: K1_CHUNKED_BOOTSTRAP,
      hubObserver: true,
    });
    const seam = await driveChunkedBootstrap(round);
    const chunks = chunksOfKind(round, 1, 'hub');
    expect(chunks.length, 'kind=1 chunk 数（≥2）').toBeGreaterThanOrEqual(2);

    // 负控注入：丢弃全部回执（含每只 kind=1 chunk 回执）⇒ bootstrap 锚停留 pending。
    round.facade.host.dropReceipts(round.connectionKey, round.run.nsId, 64);
    seam.edgeToSession.setHeld(false);
    seam.edgeToSession.release();
    await pumpUntil(
      round.facade.host,
      () => round.fatalSignals().length >= 1,
      '响亮 connection-fatal',
    );

    expect(
      round.fatalSignals().some((signal) => signal.includes('ACK_STATE_VIOLATION')),
      `响亮码 ACK_STATE_VIOLATION（实际 ${JSON.stringify(round.fatalSignals())}）`,
    ).toBe(true);
    const codes = round.hubFrames('ERROR').map((frame) => (frame.message as { code: string }).code);
    expect(codes, `hub ERROR 码（${JSON.stringify(codes)}）`).toContain('ACK_STATE_VIOLATION');
    expect(round.run.namespaceState(), 'namespace 不得 live').not.toBe('live');
    expect(round.events('chunked-snapshot-acked'), '违契下零 acked 事件').toHaveLength(0);
  }, 30_000);
});

// ═══════════════════════════ CHUNK3 族（AC3/AC4：kind 0/1/2 全回合 + parity） ═══════════════════════════

describe('issue #449 CHUNK3 — kind 0/1/2 分块 transfer 跨缝全回合', () => {
  it('CHUNK3-C0（AC3）：kind=0 步进回执切片——中间回执零占位变化/零事件；末回执换键不换槽（仍 1 槽）；ACK 后 chunked-update-acked 恰一次（t0 = 推送时刻）+ UPDATE_ACK 回指末 chunk 序 + 第 2 笔由 drain 续推', async () => {
    const clock = {
      value: 1_000,
      advance(ms: number): void {
        this.value += ms;
      },
    };
    const round = await bootGamma({
      chunkedUpdate: true,
      limits: K0_CHUNKED_UPDATE,
      hubObserver: true,
      hubClock: () => clock.value,
    });
    await round.awaitLive();
    const { run, facade } = round;
    const seam = round.seam();

    facade.host.withholdEdgeToSession(round.connectionKey, run.nsId);
    await run.writeHub({ n: 43 });
    await pumpUntil(
      facade.host,
      () =>
        transferSettledOutbound(round, 0) &&
        seam.edgeToSession
          .pending()
          .some((message) => isInboundFrame(message) && kindOfPlaceholder(message.bytes) === 'UPDATE_ACK'),
      'kind=0 chunk 族全部过缝 + UPDATE_ACK 被扣留',
    );
    const chunks = chunksOfKind(round, 0, 'hub');
    expect(chunks.length, 'kind=0 chunk 数（≥2）').toBeGreaterThanOrEqual(2);
    expect(
      chunks.map((frame) => (frame.message as { chunkIndex: number }).chunkIndex),
      'chunkIndex 0..k-1 严格递增',
    ).toEqual(chunks.map((_, index) => index));
    expect(
      new Set(chunks.map((frame) => (frame.message as { transferId: number }).transferId)).size,
      '同只 transfer（单一 transferId）',
    ).toBe(1);
    expect(round.dataFramesOut(), '整只 transfer 出站 data 帧 = chunk 数').toBe(chunks.length);
    const sentAtPush = round.events('chunked-update-sent');
    expect(sentAtPush, '末 chunk 出站结算：chunked-update-sent 恰一次').toHaveLength(1);
    expect(sentAtPush[0]!.chunkCount, 'sent.chunkCount').toBe(chunks.length);

    // 第 2 笔入队：窗口（1 槽）被本 transfer 的末 chunk pending 占据 ⇒ 不过缝。
    await run.writeHub({ n: 44 });
    await microPump(2);
    const chunksBefore = round.dataFramesOut();
    const lastChunkSequence = chunks[chunks.length - 1]!.sequence;
    const lastChunkTag = stampOfSequence(round, lastChunkSequence).tag;

    // 中间回执：换键不换槽的「无登记」侧——零新出站帧、零新事件、第 2 笔仍不过缝。
    expect(releaseHeld(seam, chunks.length - 1), '恰放行中间 chunk 回执').toBe(chunks.length - 1);
    await settle();
    expect(round.dataFramesOut(), '中间回执零占位变化（第 2 笔不过缝）').toBe(chunksBefore);
    expect(round.events('chunked-update-sent'), '中间回执零新 sent 事件').toHaveLength(1);
    expect(round.events('chunked-update-acked'), '中间回执零 acked 事件').toHaveLength(0);
    const headAfterMiddle = seam.edgeToSession.pending()[0];
    expect(
      headAfterMiddle !== undefined &&
        isReceipt(headAfterMiddle) &&
        headAfterMiddle.tag === lastChunkTag,
      `中间回执放行后缓冲头 = 末 chunk 回执（实际 ${headAfterMiddle === undefined ? '-' : describeMessage(headAfterMiddle)}）`,
    ).toBe(true);

    // 末 chunk 回执：tag→序换键不换槽（仍 1 槽）⇒ 第 2 笔仍不过缝、零 acked。
    const k = 6;
    clock.advance(k);
    expect(releaseHeld(seam, 1), '恰放行末 chunk 回执').toBe(1);
    await settle();
    expect(round.dataFramesOut(), '末 chunk 回执换键不换槽（仍 1 槽占用）').toBe(chunksBefore);
    expect(round.events('chunked-update-acked'), '末 chunk 回执登记不发射 acked').toHaveLength(0);

    // ACK：结算恰一次（t0 = 末 chunk 推送时刻）+ 回指末 chunk 序 + 槽位释放 ⇒ 第 2 笔由 drain 续推。
    const m = 4;
    clock.advance(m);
    seam.edgeToSession.setHeld(false);
    seam.edgeToSession.release();
    await pumpUntil(
      facade.host,
      () => round.events('chunked-update-acked').length >= 1,
      'chunked-update-acked',
    );
    const acked = round.events('chunked-update-acked');
    expect(acked, 'chunked-update-acked 恰一次').toHaveLength(1);
    expect(acked[0]!, 'chunked 族事件无 sequence 键').not.toHaveProperty('sequence');
    expect(acked[0]!.ackLatencyMs, 't0 = 末 chunk 推送时刻（k + m）').toBe(k + m);
    expect(
      round.peerFrames('UPDATE_ACK').some(
        (frame) => ackedSequenceOf(frame) === lastChunkSequence,
      ),
      'UPDATE_ACK 回指末 chunk 帧序',
    ).toBe(true);
    expect(round.events('update-acked'), 'chunked 结算不得发射 update-acked（改道）').toHaveLength(0);

    await pumpUntil(
      facade.host,
      () => round.dataFramesOut() > chunksBefore,
      '第 2 笔结算后续推（槽位已释放）',
    );
    const secondTransferChunks = chunksOfKind(round, 0, 'hub').filter(
      (frame) => (frame.message as { transferId: number }).transferId !== 1,
    );
    expect(secondTransferChunks.length, '第 2 笔恰一次推出（新 transferId 族）').toBeGreaterThanOrEqual(1);
    expect(
      (secondTransferChunks[0]!.message as { chunkIndex: number }).chunkIndex,
      '第 2 笔自 chunkIndex 0 起',
    ).toBe(0);
  }, 30_000);

  it('CHUNK3-C1（AC4）：kind=1 逐 chunk 独立 tag/独立回执（每 tag 恰一条、receipt.sequence = 该帧 wire [8..12]）；中间回执 no-op（零 sent）；末回执结算 sent 恰一次；BOOTSTRAP_ACK 回指末 chunk 序；live + 收敛', async () => {
    const round = await bootGamma({
      chunkedUpdate: true,
      limits: K1_CHUNKED_BOOTSTRAP,
      hubObserver: true,
    });
    const seam = await driveChunkedBootstrap(round);
    const chunks = chunksOfKind(round, 1, 'hub');
    const buffered = receiptsOf(seam);

    // 每 chunk 独立 tag ∧ 每 tag 恰一条 receipt ∧ receipt.sequence = 该帧 wire 序（[8..12] 原字节）。
    const dataTags = round.facade.host.probes.outbound
      .filter((frame) => frame.lane === 'data')
      .map((frame) => frame.tag);
    expect(new Set(dataTags).size, '每 chunk 独立 tag（无复用）').toBe(chunks.length);
    for (const chunk of chunks) {
      const wireBytes = round.run.wire.hubToPeer.find(
        (bytes) => rawSequenceOf(bytes) === chunk.sequence,
      );
      expect(wireBytes, `chunk 序 ${chunk.sequence} 的 wire 帧在场`).toBeDefined();
      expect(kindOfPlaceholder(wireBytes!), `序 ${chunk.sequence} 的 wire 帧型`).toBe('UPDATE_CHUNK');
      const stamp = stampOfSequence(round, chunk.sequence);
      const matched = buffered.filter((receipt) => receipt.tag === stamp.tag);
      expect(matched, `tag ${stamp.tag} 恰一条回执`).toHaveLength(1);
      expect(matched[0]!.sequence, `tag ${stamp.tag} 回执序 = wire [8..12]`).toBe(
        rawSequenceOf(wireBytes!),
      );
    }
    expect(buffered.length, '回执数 = 出站帧数（OPEN_OK + 每 chunk）').toBe(
      round.facade.host.probes.stamps.length,
    );

    // 中间回执 no-op：零 sent / 零 acked；末回执结算：sent 恰一次。
    expect(releaseHeld(seam, chunks.length - 1 + 1), '恰放行 OPEN_OK 回执 + 全部中间 chunk 回执').toBe(
      chunks.length,
    );
    await settle();
    expect(round.events('chunked-snapshot-sent'), '中间回执 no-op（零 sent 事件）').toHaveLength(0);
    expect(round.events('chunked-snapshot-acked'), '中间回执零 acked 事件').toHaveLength(0);
    expect(releaseHeld(seam, 1), '恰放行末 chunk 回执').toBe(1);
    await settle();
    expect(round.events('chunked-snapshot-sent'), '末 chunk 回执结算 sent 恰一次').toHaveLength(1);

    // ACK 全回合：回指末 chunk 序 + live + 收敛。
    seam.edgeToSession.setHeld(false);
    seam.edgeToSession.release();
    await round.awaitLive();
    const bootstrapAcks = round.peerFrames('BOOTSTRAP_ACK');
    expect(bootstrapAcks, 'BOOTSTRAP_ACK 数').toHaveLength(1);
    expect(ackedSequenceOf(bootstrapAcks[0]!), 'BOOTSTRAP_ACK 回指末 chunk 帧序').toBe(
      chunks[chunks.length - 1]!.sequence,
    );
    expect(round.events('chunked-snapshot-acked'), 'chunked-snapshot-acked 恰一次').toHaveLength(1);
    expect(round.run.namespaceState(), 'namespace live').toBe('live');
    expect(docHex(round.run.snapshotDoc('hub')), 'hub/peer 文档收敛').toBe(
      docHex(round.run.snapshotDoc('peer')),
    );
  }, 30_000);

  it('CHUNK3-P1（AC1b 回归哨兵）：T3 多 chunk 构型下 γ（异步缝）vs β（sharded 同步缝）——控制帧逐字节等 + 全轨迹骨架等（含 UPDATE_CHUNK 帧型/帧序）+ 数据帧文档语义等；内容变异必报差异', async () => {
    // β 参照 = 进程内组合根单体（`createHubReplication` 缺省形态；#447 CHUNK-C1 parity 同款
    // 选择）：`issue424-sharded-hub` 夹具按自身纪律（头注 6/SA2-N2）恒用公共冻结缺省 limits，
    // 无法表达本票 T3 多 chunk 构型（用它作参照会退化为两侧单帧的平凡 parity）。
    const beta = await boot({
      limits: K2_MULTI_CHUNK,
      chunkedUpdate: true,
      random: () => 0.5,
      waitFor: 'live',
    });
    const gamma = await bootGamma({ chunkedUpdate: true, limits: K2_MULTI_CHUNK });
    await gamma.awaitLive();

    // 参照确为分块改道（多 chunk 构型；既有 parity 只覆盖单帧/kind=1）。
    expect(
      wireFramesOfKind(beta.wire.hubToPeer, 'UPDATE_CHUNK').length,
      'β 参照确为 kind=2 多 chunk 改道',
    ).toBeGreaterThanOrEqual(2);

    for (const [label, left, right] of [
      ['hub→peer', beta.wire.hubToPeer, gamma.run.wire.hubToPeer],
      ['peer→hub', beta.wire.peerToHub, gamma.run.wire.peerToHub],
    ] as const) {
      // 控制帧子集逐字节等（能力感知白名单；与 #424/#447 parity 同判据）。
      expect(
        wireFramesHexEqual(wireControlFrames(left), wireControlFrames(right)),
        `${label} 控制帧逐字节`,
      ).toBeUndefined();
      // 全轨迹骨架（kind(code?)#sequence）——含 UPDATE_CHUNK 帧型与帧序。
      expect(wireSkeleton(right), `${label} 骨架（含 UPDATE_CHUNK 帧型与帧序）`).toBe(
        wireSkeleton(left),
      );
    }
    // 数据帧文档语义等（分块族按 transferId 重组后应用——#424 ORACLE-2 口径）。
    expect(
      wireDocState(wireDataFrames(gamma.run.wire.hubToPeer)),
      '数据帧文档语义（含 UPDATE_CHUNK 重组）',
    ).toBe(wireDocState(wireDataFrames(beta.wire.hubToPeer)));

    // NC-1（内容敏感性，判据非恒真）：β 侧另一内容（n=43）⇒ 文档语义比对必报差异。
    const varied = await boot({
      limits: K2_MULTI_CHUNK,
      chunkedUpdate: true,
      hubRoot: { n: 43 },
      random: () => 0.5,
      waitFor: 'live',
    });
    expect(
      wireDocState(wireDataFrames(varied.wire.hubToPeer)),
      'NC-1：内容变异必被数据帧语义比对捕获',
    ).not.toBe(wireDocState(wireDataFrames(gamma.run.wire.hubToPeer)));
  }, 30_000);
});

// ═══════════════════════════ ABORT3 族（AC5：连接死亡整体 abort + 无洞不变量） ═══════════════════════════

describe('issue #449 ABORT3 — 连接死亡 ⇒ transfer 整体 abort（无洞中 transfer 形态锚）', () => {
  it('ABORT3-C1（AC5）：kind=1 在途（chunk 族 ≥2 过缝、回执扣留）+ closePeerSide(1006) ⇒ 死 session 出站/投递零增长、零 settled、unsealed === 0、零 chunked-snapshot-sent、非 live', async () => {
    const round = await bootGamma({ chunkedUpdate: true, limits: K1_CHUNKED_BOOTSTRAP, hubObserver: true });
    const seam = await driveChunkedBootstrap(round);
    const before = {
      outbound: round.facade.host.probes.outbound.length,
      hubToPeer: round.run.wire.hubToPeer.length,
      sessionToEdge: seam.sessionToEdge.delivered().length,
      timers: round.run.hubNode.scheduler.pending(),
    };

    round.run.wire.closePeerSide(1006);
    await settle();
    await microPump(4);

    expect(round.facade.host.probes.outbound.length, '死亡后缝出站帧零增长').toBe(before.outbound);
    expect(round.run.wire.hubToPeer.length, '死亡后 hub→peer 帧零增长').toBe(before.hubToPeer);
    expect(seam.sessionToEdge.delivered().length, '死亡后 session→edge 零增长').toBe(
      before.sessionToEdge,
    );
    expect(round.settledSignals(), '零 settled 信号').toHaveLength(0);
    expect(round.facade.host.probes.unsealed, '无未盖章洞（unsealed === 0）').toBe(0);
    expect(round.events('chunked-snapshot-sent'), '零 chunked-snapshot-sent').toHaveLength(0);
    expect(round.events('chunked-snapshot-acked'), '零 chunked-snapshot-acked').toHaveLength(0);
    expect(round.run.namespaceState(), 'namespace 非 live').not.toBe('live');

    // 收口路径同向补强：放行被扣缓冲（含 close 信号）后仍零新数据帧、零未盖章洞。
    seam.edgeToSession.setHeld(false);
    seam.edgeToSession.release();
    await microPump(4);
    expect(round.facade.host.probes.outbound.length, '收口后零新出站').toBe(before.outbound);
    expect(round.facade.host.probes.unsealed, '收口后无未盖章洞').toBe(0);
    expect(round.run.namespaceState(), '收口后 namespace 非 live').not.toBe('live');
  }, 30_000);

  it('ABORT3-C2（AC5）：kind=2 在途 + 断链 ⇒ 同上零增长 + 零 chunked-sync-sent/-acked；死 session quiesce', async () => {
    const round = await bootGamma({ chunkedUpdate: true, limits: K2_MULTI_CHUNK, hubObserver: true });
    const seam = await driveChunkedStep2(round);
    const chunks = chunksOfKind(round, 2, 'hub');
    expect(chunks.length, 'kind=2 chunk 数（≥2 在途）').toBeGreaterThanOrEqual(2);
    const before = {
      outbound: round.facade.host.probes.outbound.length,
      hubToPeer: round.run.wire.hubToPeer.length,
      sessionToEdge: seam.sessionToEdge.delivered().length,
    };

    round.run.wire.closePeerSide(1006);
    await settle();
    await microPump(4);

    expect(round.facade.host.probes.outbound.length, '死亡后缝出站帧零增长').toBe(before.outbound);
    expect(round.run.wire.hubToPeer.length, '死亡后 hub→peer 帧零增长').toBe(before.hubToPeer);
    expect(seam.sessionToEdge.delivered().length, '死亡后 session→edge 零增长').toBe(
      before.sessionToEdge,
    );
    expect(round.settledSignals(), '零 settled 信号').toHaveLength(0);
    expect(round.facade.host.probes.unsealed, 'unsealed === 0').toBe(0);
    expect(round.events('chunked-sync-sent'), '零 chunked-sync-sent（末 chunk 回执未结算）').toHaveLength(0);
    expect(round.events('chunked-sync-acked'), '零 chunked-sync-acked').toHaveLength(0);
    expect(round.run.namespaceState(), 'namespace 非 live').not.toBe('live');
  }, 30_000);

  it('ABORT3-C3（AC5）：死亡后 advanceMs 推 backoff 重连 ⇒ 新会话独立收敛至 live；新作用域 transferId === 1 ∧ chunkIndex 从 0 严格递增；旧 transfer 零续传', async () => {
    const round = await bootGamma({ chunkedUpdate: true, limits: K_ABORT_RECONNECT, hubObserver: true });
    const oldSeam = await driveChunkedBootstrap(round);
    const oldDelivered = oldSeam.sessionToEdge.delivered().length;
    const oldDataOutbound = round.facade.host.probes.outbound.filter(
      (frame) => frame.lane === 'data',
    ).length;
    const oldWire = round.run.wire;
    const oldWireHubToPeer = oldWire.hubToPeer.length;
    expect(chunksOfKind(round, 1, 'hub').length, '连接 0 在途 kind=1 chunk 数').toBeGreaterThanOrEqual(2);

    round.run.wire.closePeerSide(1006);
    await settle();

    // 重连（确定性假调度器推 backoff）；新会话独立完成 reconcile 至 live。
    await advanceMs(round.run, 5000);
    await settle();
    expect(round.run.connectionState(), '重连后连接状态').toBe('ready');
    await pumpUntil(
      round.facade.host,
      () => round.run.namespaceState() === 'live',
      '重连新会话收敛 live',
      120,
    );
    const newKey = [...round.facade.host.connections.keys()].find(
      (key) => key !== round.connectionKey,
    );
    expect(newKey, '重连产生新连接键').toBeDefined();
    expect(round.facade.host.seams.size, '新会话通道对').toBe(2);

    // 旧作用域零续传：死 session 出站/投递与死连接 wire 均不随后续活动增长。
    expect(oldSeam.sessionToEdge.delivered().length, '旧 session 出站零增长').toBe(oldDelivered);
    expect(oldWire.hubToPeer.length, '死连接 hub→peer 帧零增长（旧 kind=1 transfer 零续传）').toBe(
      oldWireHubToPeer,
    );
    expect(oldDataOutbound, '连接 0 在途 data 帧数（重连前事实源）').toBeGreaterThanOrEqual(2);
    expect(
      round.facade.host.probes.sessions.length,
      '重连后会话面：旧句柄 + 新句柄（新作用域隔离）',
    ).toBeGreaterThanOrEqual(2);

    // 新作用域：kind=2 chunk 族 transferId === 1 ∧ chunkIndex 从 0 严格递增。
    const newChunks = chunksOfKind(round, 2, 'hub');
    expect(newChunks.length, '新连接 kind=2 chunk 数').toBeGreaterThanOrEqual(1);
    expect(
      new Set(newChunks.map((frame) => (frame.message as { transferId: number }).transferId)),
      '新作用域 transferId 归 1',
    ).toEqual(new Set([1]));
    expect(
      newChunks.map((frame) => (frame.message as { chunkIndex: number }).chunkIndex),
      '新作用域 chunkIndex 从 0 严格递增',
    ).toEqual(newChunks.map((_, index) => index));
    expect(round.facade.host.probes.unsealed, '重连后无未盖章洞').toBe(0);
    expect(round.run.namespaceState(), '新会话 live').toBe('live');
    expect(docHex(round.run.snapshotDoc('hub')), '重连后文档收敛').toBe(
      docHex(round.run.snapshotDoc('peer')),
    );
  }, 30_000);

  it('ABORT3-N1（存活对照）：同 ABORT3-C1 编排但连接存活、回执/ACK 全放行 ⇒ 结算恰一次 + live（证明 abort 断言非空）', async () => {
    const round = await bootGamma({ chunkedUpdate: true, limits: K1_CHUNKED_BOOTSTRAP, hubObserver: true });
    const seam = await driveChunkedBootstrap(round);

    seam.edgeToSession.setHeld(false);
    seam.edgeToSession.release();
    await round.awaitLive();

    expect(round.events('chunked-snapshot-sent'), '存活对照：sent 恰一次').toHaveLength(1);
    expect(round.events('chunked-snapshot-acked'), '存活对照：acked 恰一次').toHaveLength(1);
    expect(round.run.namespaceState(), '存活对照：live').toBe('live');
    expect(round.fatalSignals(), '存活对照：零响亮收口').toHaveLength(0);
    expect(round.facade.host.probes.unsealed, '存活对照：unsealed === 0').toBe(0);
    expect(docHex(round.run.snapshotDoc('hub')), '存活对照：文档收敛').toBe(
      docHex(round.run.snapshotDoc('peer')),
    );
  }, 30_000);
});

// ═══════════════════════════ DRAIN3 族（AC6：自驱 drain 第三触发点） ═══════════════════════════

describe('issue #449 DRAIN3 — 末 chunk 回执（第三触发点）行为边界与承重性诊断', () => {
  it('DRAIN3-C1（AC6）：kind=2 在途 + ACK 扣留 + 队列有第 2 笔 —— 末 chunk 回执结算后零新增 data 帧、scheduler.pending() 不增、载体仍 awaiting-ack（零 acked）；ACK 放行 ⇒ 第 2 笔恰一次推出', async () => {
    const round = await bootGamma({ chunkedUpdate: true, limits: K2_SINGLE_CHUNK, hubObserver: true });
    const seam = await driveChunkedStep2(round);
    expect(round.run.namespaceState(), 'DRAIN3-C1：reconcile 相（非 live）').not.toBe('live');

    // 第 2 笔：reconciling 期 hub 本地写 ⇒ 入队等待（窗口/载体占位）。
    await round.run.writeHub({ n: 43 });
    await microPump(2);
    const before = {
      data: round.facade.host.probes.outbound.filter((frame) => frame.lane === 'data').length,
      timers: round.run.hubNode.scheduler.pending(),
      updates: round.hubFrames('UPDATE').length,
    };
    expect(before.updates, '第 2 笔在载体占位下不过缝').toBe(0);

    // 只放行回执（末 chunk 回执结算；ACK 仍扣留）。
    const heldReceipts = seam.edgeToSession.pending().filter(isReceipt).length;
    expect(heldReceipts, '扣留缓冲含末 chunk 回执').toBeGreaterThanOrEqual(1);
    expect(releaseHeld(seam, heldReceipts), '恰放行全部回执（不含 ACK）').toBe(heldReceipts);
    await settle();
    await microPump(3);

    expect(
      round.facade.host.probes.outbound.filter((frame) => frame.lane === 'data').length,
      '末 chunk 回执结算后零新增 data 帧',
    ).toBe(before.data);
    expect(round.run.hubNode.scheduler.pending(), 'scheduler.pending() 不增（零 busy loop/新计时器）').toBe(
      before.timers,
    );
    expect(round.events('chunked-sync-acked'), '载体仍 awaiting-ack（零 acked）').toHaveLength(0);
    expect(round.hubFrames('UPDATE').length, '第 2 笔仍不过缝').toBe(0);

    // ACK（SYNC_APPLIED）放行 ⇒ round 结算 + 自驱 drain 推出第 2 笔恰一次。
    seam.edgeToSession.setHeld(false);
    seam.edgeToSession.release();
    await pumpUntil(round.facade.host, () => round.run.namespaceState() === 'live', 'round 结算 live');
    await pumpUntil(round.facade.host, () => round.hubFrames('UPDATE').length >= 1, '第 2 笔推出');
    await microPump(3);
    expect(round.hubFrames('UPDATE').length, '第 2 笔恰一次推出').toBe(1);
    expect(round.events('chunked-sync-acked'), 'ACK 后 chunked-sync-acked 恰一次').toHaveLength(1);
  }, 30_000);

  it('DRAIN3-D1（诊断，dormant 登记）：隔离变异 BulkTransferSender.prototype.onReceipt（照常结算但 return false）⇒ 轨迹/事件/收敛与基线逐值相同（触发点③在现态机非承重）；finally 恢复原型', async () => {
    /** 基线/变异共用编排：kind=1 分块全回合（三步步进全放行）——返回逐值签名。 */
    const runProbe = async (): Promise<{
      chunks: number;
      live: boolean;
      ackedSequence: number;
      chunkedSent: number;
      chunkedAcked: number;
      outbound: number;
      delivered: number;
    }> => {
      const round = await bootGamma({ chunkedUpdate: true, limits: K1_CHUNKED_BOOTSTRAP, hubObserver: true });
      const seam = await driveChunkedBootstrap(round);
      seam.edgeToSession.setHeld(false);
      seam.edgeToSession.release();
      await round.awaitLive();
      const ack = round.peerFrames('BOOTSTRAP_ACK');
      expect(ack, 'BOOTSTRAP_ACK 恰一次').toHaveLength(1);
      return {
        chunks: chunksOfKind(round, 1, 'hub').length,
        live: round.run.namespaceState() === 'live',
        ackedSequence: ackedSequenceOf(ack[0]!),
        chunkedSent: round.events('chunked-snapshot-sent').length,
        chunkedAcked: round.events('chunked-snapshot-acked').length,
        outbound: round.facade.host.probes.outbound.length,
        delivered: seam.sessionToEdge.delivered().length,
      };
    };

    const baseline = await runProbe();

    const module = await import('../src/bulk-transfer.js');
    const proto = module.BulkTransferSender.prototype as unknown as {
      onReceipt(tag: number, sequence: number): boolean;
    };
    const original = proto.onReceipt;
    let isolatedCalls = 0;
    // 变异 = 触发点③的返回值被隔离（照常结算、返回 false ⇒ 不触发 selfDrain）；其余生产代码零改动。
    proto.onReceipt = function mutated(
      this: unknown,
      tag: number,
      sequence: number,
    ): boolean {
      isolatedCalls += 1;
      (original as (this: unknown, tag: number, sequence: number) => boolean).call(
        this,
        tag,
        sequence,
      );
      return false;
    };
    try {
      const mutated = await runProbe();
      expect(isolatedCalls, '变异生效（onReceipt 至少被调用一次 = 末 chunk 回执结算路径）').toBeGreaterThan(0);
      expect(mutated, 'DRAIN3-D1：隔离触发点③后轨迹逐值不变（dormant 保险丝）').toEqual(baseline);
    } finally {
      proto.onReceipt = original;
    }
  }, 60_000);
});
