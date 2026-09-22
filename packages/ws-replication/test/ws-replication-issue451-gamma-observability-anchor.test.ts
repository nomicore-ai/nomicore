/**
 * SA6 验收契约 — issue #451（γ-T5）：**观测面锚定**（`update-sent` 发射点 = edge 盖章点；
 * 其余 namespace 域事件发射点 = session）与**跨线程事件无全序下的断言纪律**
 * （协议 §24.8 / §23.1 发射侧归属表；ADR 0032 决策 5 + 附录 A4.7）。
 *
 * 覆盖条目（与简报 AC1 两半逐条映射）：
 *
 * - **ANCHOR-EDGE**：γ 异步缝上 `update-sent` 只由 edge 盖章点发射——正控（恰一、`sequence`
 *   = wire 序、`bytes` = 载荷长）、**宿主直驱判别面**（不经 session 的 egress 直驱帧仍恰一，
 *   证明锚在盖章点而非 session 推送点）、两个负控（未盖章 ⇒ 零；kind=0 分块族 ⇒ 零普通族）。
 * - **ANCHOR-SESSION**：namespace 域结算事件（`update-acked` / chunked 族）只在 session
 *   观测面——镜像负控 = 仅 session observer 时**零 `update-sent`**（若发射点回退到 session
 *   该断言即红），且零连接域事件。
 * - **ANCHOR-ORDER**：跨线程 observer 事件无全序 ⇒ 断言只依赖**单侧事实**与**因果门**：
 *   两种合法缝调度（即时释放 / 扣留回执后释放）下**调度不变量投影**逐字相同；扣留期 edge 侧
 *   事实在场而 session 侧事实缺席（两者独立可观察，不读合并数组下标）。投影**不含 `bytes`**：
 *   载荷长含 live Y.Doc `clientID` 的 varint 宽度（CSPRNG 抽签，见 `anchorProjection` 注释），
 *   跨轮字节相等不是调度事实；字节长度由每轮对本轮 wire 载荷**单轮自证**（SA6 修订 2026-09-22）。
 *
 * 纪律（与 #447/#448/#449/#450 夹具同款）：断言 = 运行时行为（wire 帧序 / observer 单事件
 * 字段值 / 缝投递序 / 连接存活）；零源码 grep、零 skip/only/todo、零 env override；真 peer
 * （`createPeerReplication`）+ 真 Registry/Runtime + 公共工厂真身 + 显式释放泵。
 *
 * 观测面注入语义（本契约的归属判据载体）：edge 半边 observer 经 facade `edgeObserver`
 * 注入（连接域 + `update-sent`），session 半边 observer 经 boot `hubObserver` 注入
 * （namespace 域）——两半边注入点分离，故「仅一侧 observer」形态可直接判别发射侧归属
 * （`issue447-async-seam.ts` 的 `makeAsyncObserver` 记录器不承诺事件序，序纪律由测试承担）。
 */
import { describe, expect, it } from 'vitest';
import type { ReplicationObserverEvent } from '@nomicore/ws-replication';
import { settle } from './harness.js';
import {
  isInboundFrame,
  kindOfPlaceholder,
  pumpSteps,
  pumpUntil,
  wireFramesOfKind,
  type AsyncSessionSeam,
  type WireFrame,
} from './issue447-async-seam.js';
import { bootFlowRound, makeLargeUpdateFrame, type FlowRound } from './issue450-flow-seam.js';

// ═══════════════════════════ 断言面助手（零协议决策） ═══════════════════════════

/** hub 侧可达连接域事件型（§23.1 归属表 edge 行；session 观测面结构性零命中）。 */
const HUB_CONNECTION_DOMAIN_TYPES = [
  'connection-state-changed',
  'connection-failed',
  'send-paused',
  'send-resumed',
  'event-loop-delay-sampled',
  'auth-upgrade-rejected',
] as const;

/** session 观测面外的 namespace 域结算/控制族（§23.1 归属表 session 行代表集）。 */
const SESSION_DOMAIN_TYPES = [
  'channel-state-changed',
  'bootstrap-snapshot-sent',
  'update-acked',
  'update-applied',
  'resync-required',
  'namespace-failed',
  'chunked-update-sent',
  'chunked-update-acked',
] as const;

function eventsOf(round: FlowRound, type: string): Array<Record<string, unknown>> {
  return round.events(type);
}

/** 某型事件计数（`events()` 的口径包装，供零命中断言直读）。 */
function countOf(round: FlowRound, type: string): number {
  return round.observerEvents.filter((event) => event.type === type).length;
}

/** 断言给定事件型集合在观测面零命中（逐型给出可读判据）。 */
function expectZeroTypes(round: FlowRound, types: readonly string[]): void {
  for (const type of types) {
    expect(countOf(round, type), `观测面零命中：${type}`).toBe(0);
  }
}

/** 缝投递序中入站帧的 kind 集合（session 结算已消费的判别面，不依赖 observer）。 */
function deliveredInboundKinds(seam: AsyncSessionSeam): string[] {
  return seam.edgeToSession
    .delivered()
    .filter((message) => isInboundFrame(message))
    .map((message) => kindOfPlaceholder(message.bytes));
}

/** 扣留 edge→session 投递直至 ACK 帧被交付（session 结算前的因果门）。 */
async function pumpUntilInboundDelivered(
  round: FlowRound,
  kind: string,
  what: string,
): Promise<void> {
  const seam = round.seam();
  await pumpUntil(
    round.facade.host,
    () => deliveredInboundKinds(seam).includes(kind),
    what,
  );
}

/**
 * 按型投影（**跨线程事件无全序**纪律的载体）：只取每型事件的**调度不变量**字段、不保留合并
 * 数组下标；两调度下的投影相等即「事实集不随缝调度变化」的可执行判据。
 *
 * **边界（issue #451 SA6 修订；SA3 §7.2 根因）**：投影**不含 `bytes`**。live UPDATE 载荷 =
 * `encodeStateAsUpdate(liveDoc, remoteSV)`，其长度内含 live Y.Doc `clientID` 的 varint 宽度
 * （`packages/doc-runtime/src/create-initial-document.ts:160` 裸 `new Y.Doc()` ⇒
 * `lib0/random.uint32()` ⇒ CSPRNG；clientID 在载荷中出现 3 次，宽度 4→5 令载荷长 +3）。实测
 * 120 轮：宽 4 ⇒ 24B、宽 5 ⇒ 27B，无例外；两轮独立 boot 的字节不等概率 ≈ 11.7%
 * （`artifacts/sa6-issue451-clientid-probe.log`）。故跨轮 `bytes` 相等断言只检测 clientID
 * 抽签运气，**不是调度事实**。字节长度属**单轮自证事实**：每轮断言
 * `bytes === 本轮 wire 载荷长`（EDGE-C1/C2、SESSION-C1 同款；ORDER-C1 内逐轮复核）。
 */
function anchorProjection(events: readonly ReplicationObserverEvent[]): {
  readonly sent: Array<Record<string, unknown>>;
  readonly acked: Array<Record<string, unknown>>;
} {
  const pick = (type: string, keys: readonly string[]): Array<Record<string, unknown>> =>
    events
      .filter((event) => event.type === type)
      .map((event) => {
        const record = event as unknown as Record<string, unknown>;
        return Object.fromEntries(keys.map((key) => [key, record[key]]));
      });
  return {
    sent: pick('update-sent', ['type', 'side', 'namespaceId', 'sequence']),
    acked: pick('update-acked', ['type', 'side', 'namespaceId', 'sequence']),
  };
}

function payloadBytesOfFrame(round: FlowRound, sequence: number): number {
  return payloadBytesAt(round.hubFrames('UPDATE'), sequence);
}

function payloadBytesAt(frames: readonly WireFrame[], sequence: number): number {
  const frame = frames.find((entry) => entry.sequence === sequence);
  if (frame === undefined) {
    throw new Error(`issue451: wire 无 UPDATE 序 ${sequence}（判据面缺失即响亮 throw）`);
  }
  return (frame.message as { update: Uint8Array }).update.byteLength;
}

// ═══════════════════════════ ANCHOR-EDGE：update-sent = edge 盖章点 ═══════════════════════════

describe('issue #451 ANCHOR-EDGE — γ 缝 `update-sent` 发射点 = edge 盖章点（§24.8 / §23.1 归属表 / A4.7）', () => {
  it('ANCHOR-EDGE-C1（仅 edge observer 正控 + session 域负控）：live UPDATE 恰一 `update-sent{sequence=wire 序,bytes=载荷长}`；edge 观测面零 session 域事件', async () => {
    const round = await bootFlowRound({ edgeObserver: true });
    await round.awaitLive();
    const { run } = round;
    const seam = round.seam();

    await run.writeHub({ n: 43 });
    await pumpUntil(
      round.facade.host,
      () => round.hubFrames('UPDATE').length >= 1,
      'live UPDATE 盖章出站（wire 记录）',
    );
    // 因果门：ACK 已过缝交付 session（session 结算段已运行）——「零 session 域事件」非空转断言。
    await pumpUntilInboundDelivered(round, 'UPDATE_ACK', 'UPDATE_ACK 交付 session（结算段运行）');

    const update = round.hubFrames('UPDATE');
    expect(update, '恰一帧 live UPDATE（wire 记录）').toHaveLength(1);
    const stamped = update[0]!.sequence;
    expect(stamped, 'UPDATE 已被 edge 盖章（seq > 0）').toBeGreaterThan(0);

    const sent = eventsOf(round, 'update-sent');
    expect(sent, '§24.8：edge 观测面恰一 update-sent（锚 = 盖章点）').toHaveLength(1);
    expect(sent[0]!.sequence, 'update-sent.sequence = edge 盖章 wire 序').toBe(stamped);
    expect(sent[0]!.bytes, 'update-sent.bytes = UPDATE 载荷长').toBe(payloadBytesOfFrame(round, stamped));
    expect(sent[0]!.namespaceId, 'update-sent.namespaceId = 帧路由键').toBe(run.nsId);
    expect(sent[0], 'γ 公共缝无 accounting 投影（D9 登记：sendQueueMs 整键缺席）').not.toHaveProperty(
      'sendQueueMs',
    );
    // 负控（镜像）：session 域结算/控制族不得出现在 edge 观测面。
    expectZeroTypes(round, SESSION_DOMAIN_TYPES);
  }, 30_000);

  it('ANCHOR-EDGE-C2（宿主直驱判别面）：不经 session 的 egress 直驱 UPDATE 仍恰一 `update-sent`（锚在盖章点，非 session 推送点的判别性证据）', async () => {
    const round = await bootFlowRound({ edgeObserver: true });
    await round.awaitLive();
    const { run } = round;

    const frame = makeLargeUpdateFrame(run.nsId, 64);
    run.dropNextHubFrame('UPDATE'); // 旁路记录面：隔绝对端消费（帧字节仍达 wire「丢弃」记录）
    const returned = round.connection().egress.sendDataFrame(frame);
    expect(returned, '直驱帧在 edge 盖章（返回 wire 序）').toBeGreaterThan(0);
    await settle();

    const dropped = wireFramesOfKind(round.wire.droppedHubToPeer, 'UPDATE');
    expect(dropped, '直驱帧达 wire（丢弃记录面恰一）').toHaveLength(1);
    expect(dropped[0]!.sequence, 'wire 序 = 直驱返回值').toBe(returned);

    // 判别性：该帧从未进入 session（无 tag/无 session 记账）——session 侧锚会结构性零发射。
    expect(round.dataFramesSent(), '直驱帧不过 session→edge 缝（零 data tag）').toHaveLength(0);
    const sent = eventsOf(round, 'update-sent');
    expect(sent, 'edge 盖章点恰一 update-sent（直驱路径同漏斗）').toHaveLength(1);
    expect(sent[0]!.sequence, 'update-sent.sequence = 直驱返回值').toBe(returned);
    expect(sent[0]!.bytes, 'update-sent.bytes = 直驱载荷长').toBe(payloadBytesAt(dropped, returned));
  }, 30_000);

  it('ANCHOR-EDGE-NC1（未盖章负控）：单帧超连接级上限（返回 0 + 收口）⇒ 零 `update-sent`；连接域事实在场证记录器活', async () => {
    const round = await bootFlowRound({
      edgeObserver: true,
      asyncDataAdmissionFatal: true,
      limits: { maxQueuedBytesPerConnection: 16384, highWater: 8192, lowWater: 4096 },
    });
    await round.awaitLive();

    const frame = makeLargeUpdateFrame(round.run.nsId, 20480);
    const returned = round.connection().egress.sendDataFrame(frame);
    expect(returned, '超限帧不得出站（seq = 0）').toBe(0);
    await pumpUntil(
      round.facade.host,
      () => round.hubClosed(),
      '超限帧 ⇒ 连接收口（γ 流控单点收口）',
    );

    const failed = eventsOf(round, 'connection-failed');
    expect(failed, '连接域事实在场（记录器活的判据）').toHaveLength(1);
    expect(failed[0]!.code, '收口码 = FRAME_TOO_LARGE').toBe('FRAME_TOO_LARGE');
    expect(eventsOf(round, 'update-sent'), '「未盖章 ⇒ 零事件」（seq > 0 门）').toHaveLength(0);
    expect(round.hubFrames('UPDATE'), '超限帧零 wire 字节').toHaveLength(0);
  }, 30_000);

  it('ANCHOR-EDGE-NC2（型门/R21 边界）：kind=0 分块 transfer 期间 edge 观测面零普通族 `update-sent`，chunked 族只在 session 侧恰一', async () => {
    const round = await bootFlowRound({
      chunkedUpdate: true,
      edgeObserver: true,
      hubObserver: true,
      limits: { maxUpdateBytes: 16, maxChunkedUpdateBytes: 1024, maxInFlightUpdates: 2 },
    });
    await round.awaitLive();

    await round.run.writeHub({ n: 43 });
    await pumpUntil(
      round.facade.host,
      () => round.hubFrames('UPDATE_CHUNK').length >= 2,
      'kind=0 分块族过缝盖章（≥2 chunk）',
    );

    const chunks = round.hubFrames('UPDATE_CHUNK');
    expect(chunks.every((entry) => entry.sequence > 0), '每 chunk 已盖章（戳记面在场）').toBe(true);
    // 型门：UPDATE_CHUNK（0x42）不是普通 UPDATE —— edge 不发射普通族 update-sent。
    expect(eventsOf(round, 'update-sent'), '分块族零普通族 update-sent（R21 改道）').toHaveLength(0);
    // 结算事实在 session：完成出站恰一 chunked-update-sent（同一 recorder 的双侧注入面）。
    expect(eventsOf(round, 'chunked-update-sent'), 'chunked-update-sent 恰一（session 结算点）').toHaveLength(1);
    expect(eventsOf(round, 'update-acked'), '分块窗口内普通族 update-acked 归零').toHaveLength(0);
  }, 30_000);
});

// ═══════════════════════════ ANCHOR-SESSION：namespace 域 = session 结算点 ═══════════════════════════

describe('issue #451 ANCHOR-SESSION — namespace 域事件发射点 = session 结算点（§23.1 归属表 session 行）', () => {
  it('ANCHOR-SESSION-C1（镜像负控）：仅 session observer —— `update-acked` 恰一（sequence=wire 序）；观测面零 `update-sent`、零连接域事件', async () => {
    const round = await bootFlowRound({ hubObserver: true });
    await round.awaitLive();
    const { run } = round;

    await run.writeHub({ n: 43 });
    await pumpUntil(
      round.facade.host,
      () => eventsOf(round, 'update-acked').length >= 1,
      'live UPDATE 全链结算（session 结算点）',
    );

    const update = round.hubFrames('UPDATE');
    expect(update, '恰一帧 live UPDATE').toHaveLength(1);
    const acked = eventsOf(round, 'update-acked');
    expect(acked, '恰一 update-acked（session 结算点）').toHaveLength(1);
    expect(acked[0]!.sequence, 'update-acked.sequence = wire 序（入站序关联留 session）').toBe(
      update[0]!.sequence,
    );
    expect(acked[0]!.bytes, 'update-acked.bytes = 载荷长').toBe(
      (update[0]!.message as { update: Uint8Array }).update.byteLength,
    );
    // 镜像负控：出站 sequence 事件若回退到 session 发射，本断言即红（记录器已活：update-acked 在场）。
    expect(eventsOf(round, 'update-sent'), 'session 观测面零 update-sent（出站序事实归 edge）').toHaveLength(0);
    expectZeroTypes(round, HUB_CONNECTION_DOMAIN_TYPES);
  }, 30_000);

  it('ANCHOR-SESSION-C2（chunked 族归 session）：kind=0 分块 —— session 恰一 `chunked-update-sent` + `chunked-update-acked`；零普通族、零连接域事件', async () => {
    const round = await bootFlowRound({
      chunkedUpdate: true,
      hubObserver: true,
      limits: { maxUpdateBytes: 16, maxChunkedUpdateBytes: 1024, maxInFlightUpdates: 2 },
    });
    await round.awaitLive();

    await round.run.writeHub({ n: 43 });
    await pumpUntil(
      round.facade.host,
      () => eventsOf(round, 'chunked-update-acked').length >= 1,
      'kind=0 transfer 末 chunk 结算 + ACK 收妥',
    );

    expect(eventsOf(round, 'chunked-update-sent'), 'chunked-update-sent 恰一').toHaveLength(1);
    expect(eventsOf(round, 'chunked-update-acked'), 'chunked-update-acked 恰一').toHaveLength(1);
    expect(eventsOf(round, 'update-sent'), '普通族 update-sent 归零').toHaveLength(0);
    expect(eventsOf(round, 'update-acked'), '普通族 update-acked 归零').toHaveLength(0);
    expectZeroTypes(round, HUB_CONNECTION_DOMAIN_TYPES);
  }, 30_000);

  it('ANCHOR-BOTH-C1（双 observer 共 recorder：无双发）：`update-sent` ×1 与 `update-acked` ×1 同序——恰一由两点结构性保证，非注入面偶然', async () => {
    const round = await bootFlowRound({ edgeObserver: true, hubObserver: true });
    await round.awaitLive();
    const { run } = round;

    await run.writeHub({ n: 43 });
    await pumpUntil(
      round.facade.host,
      () => eventsOf(round, 'update-acked').length >= 1 && eventsOf(round, 'update-sent').length >= 1,
      '两半边事实齐备',
    );

    const update = round.hubFrames('UPDATE');
    expect(update, '恰一帧 live UPDATE').toHaveLength(1);
    const sent = eventsOf(round, 'update-sent');
    const acked = eventsOf(round, 'update-acked');
    expect(sent, '双 observer 下无第二发射点：update-sent 恰一').toHaveLength(1);
    expect(acked, '双 observer 下无第二发射点：update-acked 恰一').toHaveLength(1);
    expect(sent[0]!.sequence, '两事件回指同一 wire 序').toBe(update[0]!.sequence);
    expect(acked[0]!.sequence, '两事件回指同一 wire 序').toBe(update[0]!.sequence);
  }, 30_000);
});

// ═══════════════════════════ ANCHOR-ORDER：跨线程事件无全序的断言纪律 ═══════════════════════════

describe('issue #451 ANCHOR-ORDER — 跨线程 observer 事件无全序：断言只依赖单侧事实与因果门（§24.8）', () => {
  it('ANCHOR-ORDER-C1（调度扰动不变性）：即时释放 vs 扣留回执后释放——两调度下按型投影逐字相同', async () => {
    // 调度 A：即时释放（默认泵）。
    const roundA = await bootFlowRound({ edgeObserver: true, hubObserver: true });
    await roundA.awaitLive();
    await roundA.run.writeHub({ n: 43 });
    await pumpUntil(
      roundA.facade.host,
      () => eventsOf(roundA, 'update-acked').length >= 1 && eventsOf(roundA, 'update-sent').length >= 1,
      '调度 A：两半边事实齐备',
    );

    // 调度 B：扣留 edge→session（回执 + 入站），推进后显式释放。
    const roundB = await bootFlowRound({ edgeObserver: true, hubObserver: true });
    await roundB.awaitLive();
    roundB.facade.host.withholdEdgeToSession(roundB.connectionKey, roundB.run.nsId);
    await roundB.run.writeHub({ n: 43 });
    await pumpUntil(
      roundB.facade.host,
      () => eventsOf(roundB, 'update-sent').length >= 1,
      '调度 B：edge 侧事实在场（回执仍被扣留）',
    );
    roundB.seam().edgeToSession.setHeld(false);
    await pumpUntil(
      roundB.facade.host,
      () => eventsOf(roundB, 'update-acked').length >= 1,
      '调度 B：释放后 session 侧事实到场',
    );

    const projectionA = anchorProjection(roundA.observerEvents);
    const projectionB = anchorProjection(roundB.observerEvents);
    expect(projectionA.sent, '调度 A：恰一 update-sent').toHaveLength(1);
    expect(projectionA.acked, '调度 A：恰一 update-acked').toHaveLength(1);
    expect(projectionB.sent, '调度 B：恰一 update-sent').toHaveLength(1);
    expect(projectionB.acked, '调度 B：恰一 update-acked').toHaveLength(1);
    // 按型投影（无合并数组下标）在两调度下逐字相同 ⇒ 断言不依赖跨半边事件的相对顺序。
    // 投影只含调度不变量字段（type/side/namespaceId/sequence）；`bytes` 的跨轮相等不是调度
    // 事实（载荷长随 live doc clientID varint 宽度 CSPRNG 抽签变化），改由下面逐轮对本轮
    // wire 载荷自证——与 EDGE-C1/C2、SESSION-C1 同款，保留对「字节事实说谎」的敏感性。
    expect(projectionB, '两调度事实集逐字相同（顺序无关投影，调度不变量字段）').toEqual(projectionA);
    for (const [label, round] of [
      ['A', roundA],
      ['B', roundB],
    ] as const) {
      const sent = eventsOf(round, 'update-sent');
      const acked = eventsOf(round, 'update-acked');
      const sentSequence = sent[0]!.sequence as number;
      const ackedSequence = acked[0]!.sequence as number;
      expect(
        sent[0]!.bytes,
        `调度 ${label}：update-sent.bytes = 本轮 wire 载荷长（单轮自证，RNG 无关）`,
      ).toBe(payloadBytesOfFrame(round, sentSequence));
      expect(
        acked[0]!.bytes,
        `调度 ${label}：update-acked.bytes = 本轮 wire 载荷长（单轮自证，RNG 无关）`,
      ).toBe(payloadBytesOfFrame(round, ackedSequence));
      expect(ackedSequence, `调度 ${label}：sent/acked 回指同一 wire 序`).toBe(sentSequence);
    }
    expect(projectionA.sent[0]!.sequence, '投影回指同一 wire 序').toBe(
      roundA.hubFrames('UPDATE')[0]!.sequence,
    );
    expect(projectionB.sent[0]!.sequence, '投影回指同一 wire 序').toBe(
      roundB.hubFrames('UPDATE')[0]!.sequence,
    );
  }, 30_000);

  it('ANCHOR-ORDER-C2（因果门独立可观察）：扣留期 edge 侧 `update-sent` 在场而 session 侧 `update-acked` 缺席；释放后两者在场——以因果门断言，不读合并数组相对位置', async () => {
    const round = await bootFlowRound({ edgeObserver: true, hubObserver: true });
    await round.awaitLive();
    round.facade.host.withholdEdgeToSession(round.connectionKey, round.run.nsId);
    await round.run.writeHub({ n: 43 });

    await pumpUntil(
      round.facade.host,
      () => eventsOf(round, 'update-sent').length >= 1,
      '扣留期：edge 侧盖章事实可观察',
    );
    // 扣留期推进（含 ACK 到达 edge 但被扣留）：session 结算事实结构性缺席。
    await pumpSteps(round.facade.host, 4);
    expect(eventsOf(round, 'update-sent'), '扣留期：update-sent 恰一（独立可观察）').toHaveLength(1);
    expect(eventsOf(round, 'update-acked'), '扣留期：update-acked 缺席（session 因果门未开）').toHaveLength(
      0,
    );
    expect(
      round.seam().edgeToSession.pending().length,
      '扣留期：edge→session 确有在途消息（缺席非「无流量」）',
    ).toBeGreaterThan(0);

    round.seam().edgeToSession.setHeld(false);
    await pumpUntil(
      round.facade.host,
      () => eventsOf(round, 'update-acked').length >= 1,
      '释放后：session 结算事实到场',
    );
    const sent = eventsOf(round, 'update-sent');
    const acked = eventsOf(round, 'update-acked');
    expect(sent, '释放后：update-sent 仍恰一（不因释放重复）').toHaveLength(1);
    expect(acked, '释放后：update-acked 恰一').toHaveLength(1);
    expect(acked[0]!.sequence, '两侧事实回指同一 wire 序').toBe(sent[0]!.sequence);
  }, 30_000);
});
