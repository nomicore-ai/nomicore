/**
 * SA6 验收契约 — issue #448（γ-T2）：**live update 数据面在 γ 异步缝上的完整链路**
 * （协议 §24 / ADR 0032 附录 A4；父票 #447 的缝与夹具面逐字复用）。
 *
 * 覆盖条目（与简报 6 条 AC 的映射）：
 *
 * - LIVE-WINDOW：data 面 pending→回执登记两相记账；pending 计入 `maxInFlightUpdates` 窗口
 *   （AC1/AC2）；
 * - LIVE-ORD：保序契约锚（回执恒先于引用该序的 live `UPDATE_ACK`）+ 宿主违契响亮收口
 *   （AC3）；
 * - LIVE-ACK：`update-acked` 发射点 = session 结算点、`ackLatencyMs` t0 = 推送时刻；
 *   `onAck` 的 ok/zombie/violation 三类判别（AC3/AC5）；
 * - LIVE-DRAIN：session 自驱 drain（入队 / ACK 两触发点；kind=0 分块 live update 承重分支）、
 *   推完即停、禁 busy loop / 不新增轮询定时器（AC4）；
 * - LIVE-PARITY：live update 成功路径与 β wire 等价（控制帧逐字节 + 骨架 + 文档语义；
 *   #424 ORACLE-2 口径：数据帧载荷含 Yjs clientID/clock 随机性，语义等价判据）（AC6）。
 *
 * 纪律（SA6 §12.0）：断言 = 运行时行为（wire 帧 kind/序 / `[8..12]` / `ackedSequence` 回指 /
 * 缝消息消费序 / observer 单事件字段值 / 文档收敛）；零源码 grep；零 skip/only/todo；
 * 真 peer（`createPeerReplication`）+ 真 Registry/Runtime + 公共工厂真身。
 */
import { describe, expect, it } from 'vitest';
import { boot, type Run } from './driver.js';
import { settle } from './harness.js';
import {
  decodeWire,
  isInboundFrame,
  isReceipt,
  kindOfPlaceholder,
  makeManualClock,
  pumpSteps,
  pumpUntil,
  TIMEOUTS,
  type WireFrame,
} from './issue447-async-seam.js';
import { bootLiveRound, type LiveRound } from './issue448-live-seam.js';

/** 缝上 data lane 帧的 tag 集合（data 帧与回执/盖章配对断言面）。 */
function dataTags(round: LiveRound): Set<number> {
  return new Set(round.dataFramesSent().map((frame) => frame.tag));
}

/** 某 wire 序的盖章记录（tag→sequence 配对）。 */
function stampOfSequence(round: LiveRound, sequence: number): { tag: number; sequence: number } {
  const stamp = round.facade.host.probes.stamps.find((entry) => entry.sequence === sequence);
  if (stamp === undefined) throw new Error(`issue448: 无 wire 序 ${sequence} 的盖章记录`);
  return stamp;
}

/** UPDATE_ACK 帧的 `ackedSequence` 字段值。 */
function ackedSequenceOf(frame: WireFrame): number {
  return (frame.message as { ackedSequence: number }).ackedSequence;
}

/** 入站缝消息解码（`delivered()` 消费序断言面）。 */
function inboundKind(frame: Uint8Array): string {
  return kindOfPlaceholder(frame);
}

/** hub 本地 ROOT 快照（`Y.Map.toJSON` plain 对象；仅作确定性逐值比较，零协议语义）。 */
function rootSnapshotOf(run: Run): unknown {
  return (run.snapshotDoc('hub').getMap('ROOT') as unknown as { toJSON(): unknown }).toJSON();
}

// ═══════════════════════════ LIVE-WINDOW：两相记账 + 窗口上界 ═══════════════════════════

describe('issue #448 LIVE-WINDOW — γ live update 两相记账与 maxInFlightUpdates 窗口（延迟注入锚）', () => {
  it('LIVE-WINDOW-C1/C2：maxInFlightUpdates=2 + 扣留 edgeToSession —— 恰 2 帧过缝；回执换键不换槽；ACK 结算释放槽位后第 3 帧由自驱 drain 推出；无伪造序/无 pending 泄漏', async () => {
    const clock = makeManualClock(1_000);
    const round = await bootLiveRound({
      limits: { maxInFlightUpdates: 2 },
      hubObserver: true,
      hubClock: () => clock.now(),
    });
    await round.awaitLive();
    const { run, facade } = round;
    const seam = round.seam();

    // 延迟注入：扣留 edge→session（回执与 ACK 均不可达）。
    facade.host.withholdEdgeToSession(round.connectionKey, run.nsId);
    await run.writeHub({ n: 43 });
    await run.writeHub({ n: 44 });
    await pumpUntil(facade.host, () => round.hubFrames('UPDATE').length >= 2, '前两笔 UPDATE 过缝');
    // pending 占窗（推送时刻起算）：窗口上界 = 2 ⇒ 第 3 笔不过缝。
    await run.writeHub({ n: 45 });
    await pumpUntil(
      facade.host,
      () =>
        seam.edgeToSession
          .pending()
          .filter((message) => isInboundFrame(message) && inboundKind(message.bytes) === 'UPDATE_ACK')
          .length >= 2,
      '两笔 UPDATE_ACK 到达 session 入站通道（被扣留）',
    );
    await pumpSteps(facade.host, 3);
    expect(round.hubFrames('UPDATE'), 'AC2：窗口满时第 3 帧不得过缝').toHaveLength(2);
    expect(round.dataFramesOut(), 'AC1/AC2：缝上 data 帧数 = 窗口上界').toBe(2);

    // AC1 无伪造序：每笔过缝 data 帧的 tag → wire 序与帧 `[8..12]` 一致（盖章事实配对）。
    // 回执仍处扣留缓冲（未消费）——配对断言读入站通道缓冲（= 盖章点同步投递的原始事实）。
    const bufferedReceipts = seam.edgeToSession.pending().filter(isReceipt);
    const updateSequences = round.hubFrames('UPDATE').map((frame) => frame.sequence);
    for (const sequence of updateSequences) {
      const stamp = stampOfSequence(round, sequence);
      expect(dataTags(round).has(stamp.tag), `序 ${sequence} 的盖章 tag 属 data lane`).toBe(true);
      expect(
        bufferedReceipts.some(
          (receipt) => receipt.tag === stamp.tag && receipt.sequence === sequence,
        ),
        `序 ${sequence} 的回执（tag ${stamp.tag}）与盖章序一致`,
      ).toBe(true);
    }

    // C2 中间态：只放回执（未放 ACK）⇒ 换键不换槽：占用数守恒，第 3 帧仍不得过缝。
    seam.edgeToSession.setHeld(false);
    expect(seam.edgeToSession.release(2), '恰投递 2 条（两笔回执）').toBe(2);
    await settle();
    expect(round.hubFrames('UPDATE'), 'AC2：rekey 不释放槽位（第 3 帧仍不过缝）').toHaveLength(2);
    expect(round.events('update-acked'), 'ACK 未到 ⇒ 零结算事件').toHaveLength(0);

    // ACK 结算 ⇒ 唯一释放路径：自驱 drain（ACK 到达触发点）推出第 3 帧。
    seam.edgeToSession.release();
    await pumpUntil(facade.host, () => round.hubFrames('UPDATE').length >= 3, '第 3 帧于 ACK 结算后过缝');
    await pumpUntil(
      facade.host,
      () => round.events('update-acked').length >= 3,
      '三笔 ACK 全部在 session 结算',
    );
    expect(round.hubFrames('UPDATE'), 'AC2：恰 3 帧（无重复占槽）').toHaveLength(3);
    expect(round.peerFrames('UPDATE_ACK'), 'AC1：三笔各恰一 ACK').toHaveLength(3);
    expect(round.dataFramesSent(), 'AC1：data lane 恰 3 帧').toHaveLength(3);

    // AC1 无 pending 泄漏：窗口槽位全部释放 ⇒ 第 4 笔无需任何额外触发即过缝。
    await run.writeHub({ n: 46 });
    await pumpUntil(facade.host, () => round.hubFrames('UPDATE').length >= 4, '第 4 帧直推（槽位已释放）');
    expect(round.hubFrames('UPDATE'), 'AC1：第 4 帧恰一次').toHaveLength(4);
  }, 30_000);

  it('LIVE-WINDOW-C3 变异负控（窗口占用判据去 pendingSends ⇒ β 裸占用）：pending 不占窗 ⇒ 第 3 帧被放行（上界击穿）', async () => {
    const module = await import('../src/update-channel.js');
    const proto = module.UpdateChannel.prototype as unknown as {
      effectiveInFlightCount(): number;
      inFlight: Map<number, unknown>;
    };
    const original = proto.effectiveInFlightCount;
    // 变异 = 恢复 β 裸占用口径（不计 pendingSends）；其余生产代码零改动。
    proto.effectiveInFlightCount = function mutated(this: { inFlight: Map<number, unknown> }): number {
      return this.inFlight.size;
    };
    try {
      const round = await bootLiveRound({ limits: { maxInFlightUpdates: 2 } });
      await round.awaitLive();
      const { run, facade } = round;
      facade.host.withholdEdgeToSession(round.connectionKey, run.nsId);
      await run.writeHub({ n: 43 });
      await run.writeHub({ n: 44 });
      await run.writeHub({ n: 45 });
      await pumpUntil(facade.host, () => round.hubFrames('UPDATE').length >= 3, '变异下第 3 帧过缝');
      // 变异下 pending 不占窗 ⇒ 第 3 帧被放行 = 窗口上界被击穿 ⇒ 正测试的「恰 2 帧」断言必红。
      expect(
        round.hubFrames('UPDATE').length,
        '变异负控：裸占用口径下第 3 帧越过 maxInFlightUpdates 上界',
      ).toBe(3);
      expect(
        round.events('update-acked'),
        '变异负控：ACK 仍未到 ⇒ 零结算（上界击穿发生在占窗阶段）',
      ).toHaveLength(0);
    } finally {
      proto.effectiveInFlightCount = original;
    }
  }, 30_000);
});

// ═══════════════════════════ LIVE-ORD：保序契约锚 + 宿主违契响亮 ═══════════════════════════

describe('issue #448 LIVE-ORD — 回执恒先于引用该序的 live UPDATE_ACK（§24.2.3 / A4.2）', () => {
  it('LIVE-ORD-C1：延迟注入编排下，session 消费序里 update-ack 的回执 strict 先行；结算事件发生在回执登记之后', async () => {
    const clock = makeManualClock(3_000);
    const round = await bootLiveRound({ hubObserver: true, hubClock: () => clock.now() });
    await round.awaitLive();
    const { run, facade } = round;
    const seam = round.seam();

    facade.host.withholdEdgeToSession(round.connectionKey, run.nsId);
    clock.advance(4);
    await run.writeHub({ n: 43 });
    await pumpUntil(facade.host, () => round.hubFrames('UPDATE').length >= 1, 'live UPDATE 过缝');
    await pumpUntil(
      facade.host,
      () =>
        seam.edgeToSession
          .pending()
          .filter((message) => isInboundFrame(message) && inboundKind(message.bytes) === 'UPDATE_ACK')
          .length >= 1,
      'UPDATE_ACK 到达 session 入站通道（被扣留）',
    );
    const sequence = round.hubFrames('UPDATE')[0]!.sequence;

    // 步 1：只放回执 ⇒ 登记（rekey）而非结算：零 update-acked。
    seam.edgeToSession.setHeld(false);
    expect(seam.edgeToSession.release(1), '恰放行回执').toBe(1);
    await settle();
    expect(round.events('update-acked'), '回执登记不发射 update-acked').toHaveLength(0);

    // 步 2：放行 ACK ⇒ 结算（发射点 = session 结算点）。
    seam.edgeToSession.release();
    await pumpUntil(facade.host, () => round.events('update-acked').length >= 1, 'update-acked');
    const acked = round.events('update-acked');
    expect(acked, '恰一次 update-acked').toHaveLength(1);
    expect(acked[0]!.sequence, '事件序 = wire ackedSequence').toBe(sequence);

    // 消费序配对：回执（sequence = s）严格先于引用该序的 UPDATE_ACK 被 session 消费。
    const delivered = seam.edgeToSession.delivered();
    const receiptIndex = delivered.findIndex(
      (message) => isReceipt(message) && message.sequence === sequence,
    );
    const ackIndex = delivered.findIndex(
      (message) =>
        isInboundFrame(message) &&
        inboundKind(message.bytes) === 'UPDATE_ACK' &&
        ackedSequenceOf(decodeWire([message.bytes])[0]!) === sequence,
    );
    expect(receiptIndex, `回执（序 ${sequence}）在消费序中`).toBeGreaterThanOrEqual(0);
    expect(ackIndex, '引用该序的 UPDATE_ACK 在消费序中').toBeGreaterThanOrEqual(0);
    expect(receiptIndex, 'AC3：回执恒先于引用该序的 live UPDATE_ACK').toBeLessThan(ackIndex);
    expect(round.fatalSignals(), '保序编排下零响亮收口').toHaveLength(0);
  }, 30_000);

  it('LIVE-ORD-C2 负控（宿主违契：回执与 ACK 乱序投递）：保序条款被破坏 ⇒ onAck violation 响亮 ACK_STATE_VIOLATION，绝无静默接受', async () => {
    const round = await bootLiveRound({ hubObserver: true });
    await round.awaitLive();
    const { run, facade } = round;
    const seam = round.seam();

    facade.host.withholdEdgeToSession(round.connectionKey, run.nsId);
    await run.writeHub({ n: 43 });
    await pumpUntil(facade.host, () => round.hubFrames('UPDATE').length >= 1, 'live UPDATE 过缝');
    await pumpUntil(
      facade.host,
      () =>
        seam.edgeToSession
          .pending()
          .filter((message) => isInboundFrame(message) && inboundKind(message.bytes) === 'UPDATE_ACK')
          .length >= 1,
      'UPDATE_ACK 到达 session 入站通道（被扣留）',
    );
    const buffered = seam.edgeToSession.pending();
    expect(buffered.length, '扣留缓冲 = 回执 + UPDATE_ACK').toBeGreaterThanOrEqual(2);
    expect(isReceipt(buffered[0]!), 'FIFO 头 = 回执（盖章点同步投递）').toBe(true);

    // 违契注入：交换前两条（ACK 先于回执投递）——§24.2.6 宿主 bug ⇒ 响亮收口。
    seam.edgeToSession.reorderNext();
    seam.edgeToSession.setHeld(false);
    seam.edgeToSession.release();
    await pumpUntil(
      facade.host,
      () => round.fatalSignals().length >= 1,
      '宿主违契 ⇒ 响亮 connection-fatal',
    );
    expect(
      round.fatalSignals().some((signal) => signal.includes('ACK_STATE_VIOLATION')),
      `响亮码 ACK_STATE_VIOLATION（实际 ${JSON.stringify(round.fatalSignals())}）`,
    ).toBe(true);
    expect(round.events('update-acked'), '违契下零结算事件（禁静默接受）').toHaveLength(0);
  }, 30_000);
});

// ═══════════════════════════ LIVE-ACK：发射点与 t0 口径（§24.8） ═══════════════════════════

describe('issue #448 LIVE-ACK — update-acked 发射点、ackLatencyMs t0 与 onAck 三类判别', () => {
  it('LIVE-ACK-C1（t0 = 推送时刻；§24.8）：扣留回执 k ms + ACK 前再推进 m ms ⇒ update-acked.ackLatencyMs === k + m', async () => {
    const clock = makeManualClock(5_000);
    const round = await bootLiveRound({ hubObserver: true, hubClock: () => clock.now() });
    await round.awaitLive();
    const { run, facade } = round;
    const seam = round.seam();

    facade.host.withholdEdgeToSession(round.connectionKey, run.nsId);
    // t0 = 推送时刻：**推送先发生**（sentAt 在发送调用边界采样），再推进 k（管道 + edge 等待）。
    await run.writeHub({ n: 43 });
    const k = 7;
    clock.advance(k);
    await pumpUntil(facade.host, () => round.hubFrames('UPDATE').length >= 1, 'live UPDATE 过缝');
    const sequence = round.hubFrames('UPDATE')[0]!.sequence;
    expect(round.events('update-acked'), '扣留期零 acked 事件').toHaveLength(0);

    // 步 1：只放回执（登记；ACK 仍扣留）。
    seam.edgeToSession.setHeld(false);
    expect(seam.edgeToSession.release(1), '恰放行回执').toBe(1);
    await settle();
    expect(round.events('update-acked'), '登记点不发射 update-acked').toHaveLength(0);

    // 步 2：ACK 前再推进 m ms ⇒ 回执登记后到 ACK 处理的等待计入 t1。
    const m = 5;
    clock.advance(m);
    seam.edgeToSession.release();
    await pumpUntil(facade.host, () => round.events('update-acked').length >= 1, 'update-acked');
    const acked = round.events('update-acked');
    expect(acked, '恰一次 update-acked').toHaveLength(1);
    expect(acked[0]!.sequence, '事件序 = 被 ACK 的 wire 序').toBe(sequence);
    // t0 = 推送时刻（含管道与 edge 等待，§24.8 口径）——回执/ACK 时刻采样会少 k。
    expect(acked[0]!.ackLatencyMs, 't0 = 推送时刻（k + m）').toBe(k + m);
    expect(round.peerFrames('UPDATE_ACK')[0]!.sequence, 'ACK 帧序严格递增').toBeGreaterThan(0);
    expect(ackedSequenceOf(round.peerFrames('UPDATE_ACK')[0]!), 'ACK 回指 UPDATE 帧序').toBe(sequence);
  }, 30_000);

  it('LIVE-ACK-C1 变异负控（t0 采样点改回执时刻）：rekey 时重采样 sentAt ⇒ ackLatencyMs 少 k ⇒ 断言必红', async () => {
    const module = await import('../src/update-channel.js');
    interface EntryLike {
      readonly bytes: number;
      readonly sentAt?: number;
      readonly chunked?: true;
    }
    const proto = module.UpdateChannel.prototype as unknown as {
      onReceipt(tag: number, sequence: number): 'rekeyed' | 'no-op';
      pendingSends: Map<number, EntryLike>;
      inFlight: Map<number, EntryLike>;
      host: { now?: () => number | undefined };
    };
    const original = proto.onReceipt;
    // 变异 = 「t0 = 回执时刻」的等价实现：rekey 时以当前钟重采样 sentAt（其余生产代码零改动）。
    proto.onReceipt = function mutated(
      this: { pendingSends: Map<number, EntryLike>; inFlight: Map<number, EntryLike>; host: { now?: () => number | undefined } },
      tag: number,
      sequence: number,
    ): 'rekeyed' | 'no-op' {
      const entry = this.pendingSends.get(tag);
      if (entry === undefined) return 'no-op';
      this.pendingSends.delete(tag);
      const sampled = this.host.now?.();
      this.inFlight.set(sequence, {
        ...entry,
        ...(sampled !== undefined ? { sentAt: sampled } : {}),
      });
      return 'rekeyed';
    };
    try {
      const clock = makeManualClock(7_000);
      const round = await bootLiveRound({ hubObserver: true, hubClock: () => clock.now() });
      await round.awaitLive();
      const { run, facade } = round;
      const seam = round.seam();
      facade.host.withholdEdgeToSession(round.connectionKey, run.nsId);
      await run.writeHub({ n: 43 });
      const k = 7;
      clock.advance(k);
      await pumpUntil(facade.host, () => round.hubFrames('UPDATE').length >= 1, 'live UPDATE 过缝');
      seam.edgeToSession.setHeld(false);
      expect(seam.edgeToSession.release(1), '恰放行回执').toBe(1);
      await settle();
      const m = 5;
      clock.advance(m);
      seam.edgeToSession.release();
      await pumpUntil(facade.host, () => round.events('update-acked').length >= 1, 'update-acked');
      const acked = round.events('update-acked');
      expect(acked, '恰一次 update-acked').toHaveLength(1);
      // 变异下 t0 = 回执登记时刻 ⇒ 少 k（应得 k + m）——证明 t0 推送边界采样对断言承重。
      expect(acked[0]!.ackLatencyMs, '变异下 ackLatencyMs = m（少 k）').toBe(m);
    } finally {
      proto.onReceipt = original;
    }
  }, 30_000);

  it('LIVE-OBS-C1（§24.8 观测归属锚）：update-sent 在 edge 盖章点（sequence = wire 序、bytes = 载荷长）；update-acked 在 session 结算点', async () => {
    const clock = makeManualClock(11_000);
    const round = await bootLiveRound({
      hubObserver: true,
      edgeObserver: true,
      hubClock: () => clock.now(),
    });
    await round.awaitLive();
    const { run } = round;

    await run.writeHub({ n: 43 });
    await pumpUntil(
      round.facade.host,
      () => round.events('update-acked').length >= 1,
      'live UPDATE 全链结算',
    );
    const update = round.hubFrames('UPDATE');
    expect(update, '恰一帧 live UPDATE').toHaveLength(1);
    const payloadBytes = ((update[0]!.message as { update: Uint8Array }).update).byteLength;

    const sent = round.events('update-sent');
    expect(sent, '§24.8：update-sent 在 edge 盖章点恰一次').toHaveLength(1);
    expect(sent[0]!.sequence, 'update-sent.sequence = edge 盖章 wire 序').toBe(update[0]!.sequence);
    expect(sent[0]!.bytes, 'update-sent.bytes = UPDATE 载荷长').toBe(payloadBytes);
    expect(sent[0]!, 'γ 缝词汇无 accounting 字段（D9 登记：sendQueueMs 整键缺席）').not.toHaveProperty(
      'sendQueueMs',
    );

    const acked = round.events('update-acked');
    expect(acked, '§24.8：update-acked 在 session 结算点恰一次').toHaveLength(1);
    expect(acked[0]!.sequence, 'update-acked.sequence = 同一 wire 序').toBe(update[0]!.sequence);
    expect(acked[0]!, 'update-acked 不携 tag/sendQueueMs').not.toHaveProperty('sendQueueMs');
  }, 30_000);

  it('LIVE-ACK-C2（onAck violation：回执丢失 + 直投 ACK）：引用未登记序的 live UPDATE_ACK ⇒ 响亮 ACK_STATE_VIOLATION（零静默判定）', async () => {
    const round = await bootLiveRound({ hubObserver: true });
    await round.awaitLive();
    const { run, facade } = round;
    const seam = round.seam();

    facade.host.withholdEdgeToSession(round.connectionKey, run.nsId);
    await run.writeHub({ n: 43 });
    await pumpUntil(facade.host, () => round.hubFrames('UPDATE').length >= 1, 'live UPDATE 过缝');
    await pumpUntil(
      facade.host,
      () =>
        seam.edgeToSession
          .pending()
          .filter((message) => isInboundFrame(message) && inboundKind(message.bytes) === 'UPDATE_ACK')
          .length >= 1,
      'UPDATE_ACK 到达 session 入站通道（被扣留）',
    );
    // 违契注入：丢弃回执，仅放行 ACK ⇒ 序未登记即被引用。
    facade.host.dropReceipts(round.connectionKey, run.nsId, 1);
    seam.edgeToSession.setHeld(false);
    seam.edgeToSession.release();
    await pumpUntil(
      facade.host,
      () => round.fatalSignals().length >= 1,
      'onAck violation ⇒ 响亮 connection-fatal',
    );
    expect(
      round.fatalSignals().some((signal) => signal.includes('ACK_STATE_VIOLATION')),
      `响亮码 ACK_STATE_VIOLATION（实际 ${JSON.stringify(round.fatalSignals())}）`,
    ).toBe(true);
    expect(round.events('update-acked'), 'violation 不结算').toHaveLength(0);
  }, 30_000);

  it('LIVE-ACK-C3（onAck zombie：ackTimeout 弃置后迟到回执+ACK）：良性——零 fatal、零迟到结算', async () => {
    const round = await bootLiveRound({ limits: { maxInFlightUpdates: 1 }, hubObserver: true });
    await round.awaitLive();
    const { run, facade } = round;
    const seam = round.seam();

    facade.host.withholdEdgeToSession(round.connectionKey, run.nsId);
    await run.writeHub({ n: 43 });
    await pumpUntil(facade.host, () => round.hubFrames('UPDATE').length >= 1, 'live UPDATE 过缝');
    const abandonedSequence = round.hubFrames('UPDATE')[0]!.sequence;

    // ackTimeout 有界兜底：pending-only 占用 ⇒ 弃置 + 恢复 round。
    await run.hubNode.scheduler.advanceBy(TIMEOUTS.ackTimeoutMs + 1);
    await settle();
    await pumpUntil(facade.host, () => round.hubFrames('RESYNC_REQUIRED').length >= 1, 'RESYNC_REQUIRED');
    expect(round.hubFrames('RESYNC_REQUIRED'), '弃置恰一次').toHaveLength(1);

    // 迟到回执（揭示被弃 tag 的 wire 序）+ 迟到 ACK：zombie 良性。
    seam.edgeToSession.setHeld(false);
    await pumpUntil(facade.host, () => run.namespaceState() === 'live', '恢复 round 结算回 live');
    expect(round.fatalSignals(), 'zombie 迟到 ACK 不得响亮收口').toHaveLength(0);
    expect(
      round.events('update-acked').filter((event) => event.sequence === abandonedSequence),
      '被弃序的迟到 ACK 不发射 update-acked',
    ).toHaveLength(0);
  }, 30_000);
});

// ═══════════════════════════ LIVE-DRAIN：自驱 drain 与 busy loop ═══════════════════════════

describe('issue #448 LIVE-DRAIN — session 自驱 drain 触发点与禁 busy loop（§24.6 / A4.4）', () => {
  it('LIVE-DRAIN-C1（kind=0 分块 live update；入队触发点）：maxInFlightUpdates=1 + 扣留 —— 整只 transfer 占 1 槽逐 chunk 过缝；末 chunk 回执结算 + ACK 后 chunked-update-acked（t0 = 推送时刻）', async () => {
    const clock = makeManualClock(9_000);
    const round = await bootLiveRound({
      chunkedUpdate: true,
      limits: { maxUpdateBytes: 16, maxChunkedUpdateBytes: 1024, maxInFlightUpdates: 1 },
      hubObserver: true,
      hubClock: () => clock.now(),
    });
    await round.awaitLive();
    const { run, facade } = round;
    const seam = round.seam();

    facade.host.withholdEdgeToSession(round.connectionKey, run.nsId);
    await run.writeHub({ n: 43 });
    await pumpUntil(
      facade.host,
      () =>
        round.hubFrames('UPDATE_CHUNK').length >= 2 &&
        seam.edgeToSession
          .pending()
          .some((message) => isInboundFrame(message) && inboundKind(message.bytes) === 'UPDATE_ACK'),
      'kind=0 chunk 族全部过缝 + UPDATE_ACK 被扣留',
    );
    const chunks = round.hubFrames('UPDATE_CHUNK');
    const transferIds = new Set(chunks.map((frame) => (frame.message as { transferId: number }).transferId));
    expect(transferIds.size, '同只 transfer（单一 transferId）').toBe(1);
    expect(
      chunks.map((frame) => (frame.message as { chunkIndex: number }).chunkIndex),
      'chunkIndex 0..k-1 严格递增',
    ).toEqual(chunks.map((_, index) => index));
    expect(
      chunks.every((frame) => (frame.message as { transferKind: number }).transferKind === 0),
      'kind=0 live update 改道形态',
    ).toBe(true);
    // 每 chunk 独立 tag/独立回执；整只 transfer 只占 1 个窗口槽（chunk 不额外占槽）。
    expect(round.dataFramesOut(), 'AC2：整只 transfer 的出站 data 帧 = chunk 数').toBe(chunks.length);
    const sentAtTransfer1 = round.events('chunked-update-sent');
    expect(sentAtTransfer1, 'AC4/§24.8：chunked-update-sent 恰一次（末 chunk 出站结算）').toHaveLength(1);
    expect(sentAtTransfer1[0]!.chunkCount, 'sent 事件 chunkCount').toBe(chunks.length);

    // 第 2 笔：窗口（1 槽）被 transfer 的末 chunk pending 占据 ⇒ 不过缝。
    await run.writeHub({ n: 44 });
    await pumpSteps(facade.host, 3);
    expect(round.hubFrames('UPDATE_CHUNK').length + round.hubFrames('UPDATE').length, 'AC2：窗口满时第 2 笔不推进').toBe(chunks.length);

    // 末 chunk 结算锚（§8.9）：先只放回执（中间 chunk no-op + 末 chunk tag→序换键），
    // 再推进 m ms 后放行 ACK —— 结算事件在 session ACK 处理点（t0 = 末 chunk 推送时刻）。
    const lastChunkSequence = chunks[chunks.length - 1]!.sequence;
    // t0 = 末 chunk 推送时刻（推送在 writeHub 内已发生）；k = 管道 + edge 等待。
    const k = 6;
    clock.advance(k);
    seam.edgeToSession.setHeld(false);
    expect(
      seam.edgeToSession.release(chunks.length),
      '恰放行 chunk 数条回执（无 ACK 混入）',
    ).toBe(chunks.length);
    await settle();
    expect(round.events('chunked-update-acked'), '末 chunk 回执登记不发射 acked 事件').toHaveLength(0);
    // 只放行第 1 只 transfer 的 UPDATE_ACK（session 结算点）——第 2 只尚在队内。
    const m = 4;
    clock.advance(m);
    expect(seam.edgeToSession.release(1), '恰放行 1 条（第 1 只 transfer 的 ACK）').toBe(1);
    await settle();
    const ackedTransfer1 = round.events('chunked-update-acked');
    expect(ackedTransfer1, 'AC5：chunked-update-acked 恰一次（session 结算点）').toHaveLength(1);
    expect(ackedTransfer1[0]!, 'chunked 族事件无 sequence 键（DD1）').not.toHaveProperty('sequence');
    expect(ackedTransfer1[0]!.ackLatencyMs, 't0 = 末 chunk 推送时刻（k + m）').toBe(k + m);
    expect(
      round.peerFrames('UPDATE_ACK').some((frame) => ackedSequenceOf(frame) === lastChunkSequence),
      'AC3：UPDATE_ACK 回指末 chunk 帧序',
    ).toBe(true);
    expect(round.events('update-acked'), 'chunked 结算不得发射 update-acked（改道）').toHaveLength(0);

    // 末 chunk 结算释放槽位 ⇒ 第 2 笔（同构可改道）由后续 drain 续推。
    await pumpUntil(
      facade.host,
      () => round.dataFramesOut() > chunks.length,
      '第 2 笔结算后续推（槽位已释放）',
    );
  }, 30_000);

  it('LIVE-DRAIN-C2（禁 busy loop / 不新增轮询定时器）：扣留期时间推进不驱动数据帧、计时器面不增；窗口满时重复泵不越界', async () => {
    const round = await bootLiveRound({ limits: { maxInFlightUpdates: 1 }, hubObserver: true });
    await round.awaitLive();
    const { run, facade } = round;
    const seam = round.seam();

    facade.host.withholdEdgeToSession(round.connectionKey, run.nsId);
    await run.writeHub({ n: 43 });
    await pumpUntil(facade.host, () => round.hubFrames('UPDATE').length >= 1, '第 1 帧过缝');
    const framesAfterPush = round.hubFrames('UPDATE').length;
    const timersAfterPush = run.hubNode.scheduler.pending();

    // 时间推进（< ackTimeoutMs）：必须零新的数据帧、零新增计时器（禁轮询）。
    await run.hubNode.scheduler.advanceBy(100);
    await settle();
    expect(round.hubFrames('UPDATE').length, '禁 busy loop：时间推进不驱动数据帧').toBe(framesAfterPush);
    expect(run.hubNode.scheduler.pending(), '不新增轮询定时器').toBe(timersAfterPush);

    // 窗口满 + 扣留：重复泵（含额外入队）不得击穿上界。
    await run.writeHub({ n: 44 });
    await pumpSteps(facade.host, 4);
    expect(round.hubFrames('UPDATE').length, 'AC2：重复泵不越窗口上界').toBe(framesAfterPush);
    expect(round.dataFramesOut(), '缝上 data 帧数不随时间/泵次数增长').toBe(framesAfterPush);

    // 推完即停：结算后额外泵不产生新帧。
    seam.edgeToSession.setHeld(false);
    await pumpUntil(facade.host, () => round.events('update-acked').length >= 2, '两笔结算');
    const framesSettled = round.hubFrames('UPDATE').length;
    await pumpSteps(facade.host, 5);
    expect(round.hubFrames('UPDATE').length, '推完即停：无新增帧').toBe(framesSettled);
  }, 30_000);
});

// ═══════════════════════════ LIVE-PARITY：与 β wire 等价（AC6） ═══════════════════════════

interface ShardedHelpers {
  framesHexEqual(left: readonly Uint8Array[], right: readonly Uint8Array[]): string | undefined;
  controlFramesOf(frames: readonly Uint8Array[]): Uint8Array[];
  dataFramesOf(frames: readonly Uint8Array[]): Uint8Array[];
  skeletonOf(frames: readonly Uint8Array[]): string;
  docStateOf(frames: readonly Uint8Array[]): string;
  makeShardedReplicationFacade(
    options: Parameters<typeof import('./issue424-sharded-hub.js').makeShardedReplicationFacade>[0],
  ): { replication: Run['hub'] };
}

async function shardedHelpers(): Promise<ShardedHelpers> {
  return (await import('./issue424-sharded-hub.js')) as unknown as ShardedHelpers;
}

describe('issue #448 LIVE-PARITY — live update 成功路径与 β wire 等价（A4.8 / #424 ORACLE-2 口径）', () => {
  it('LIVE-PARITY-C1：同场 β（sharded 同步缝）vs γ —— 控制帧逐字节等；全轨迹骨架等；live UPDATE/ACK 配对与文档语义等', async () => {
    const { framesHexEqual, controlFramesOf, dataFramesOf, skeletonOf, docStateOf, makeShardedReplicationFacade } =
      await shardedHelpers();
    const beta = await boot({
      random: () => 0.5,
      waitFor: 'none',
      createHub: (options) => makeShardedReplicationFacade(options).replication,
    });
    await beta.waitNamespace('live');
    const gamma = await bootLiveRound({ hubObserver: true });
    await gamma.awaitLive();

    // 同一业务写：live UPDATE 成功路径（hub 本地写 → UPDATE → peer apply → UPDATE_ACK）。
    await beta.writeHub({ n: 43 });
    await settle();
    await gamma.run.writeHub({ n: 43 });
    await pumpUntil(
      gamma.facade.host,
      () => gamma.peerFrames('UPDATE_ACK').length >= 1 && gamma.events('update-acked').length >= 1,
      'γ live UPDATE 全链结算',
    );

    expect(beta.wire.hubToPeer.filter((bytes) => kindOfPlaceholder(bytes) === 'UPDATE')).toHaveLength(1);
    expect(gamma.hubFrames('UPDATE'), 'γ live UPDATE 恰一帧').toHaveLength(1);
    expect(beta.wire.peerToHub.filter((bytes) => kindOfPlaceholder(bytes) === 'UPDATE_ACK')).toHaveLength(1);
    expect(gamma.peerFrames('UPDATE_ACK'), 'γ live UPDATE_ACK 恰一帧').toHaveLength(1);

    // 控制帧子集逐字节等（两方向）。
    expect(
      framesHexEqual(controlFramesOf(beta.wire.hubToPeer), controlFramesOf(gamma.run.wire.hubToPeer)),
      'hub→peer 控制帧逐字节',
    ).toBeUndefined();
    expect(
      framesHexEqual(controlFramesOf(beta.wire.peerToHub), controlFramesOf(gamma.run.wire.peerToHub)),
      'peer→hub 控制帧逐字节',
    ).toBeUndefined();
    // 全轨迹骨架（kind(code?)#sequence）逐方向全等——live UPDATE/UPDATE_ACK 的序位等价。
    expect(skeletonOf(gamma.run.wire.hubToPeer), 'hub→peer 骨架').toBe(
      skeletonOf(beta.wire.hubToPeer),
    );
    expect(skeletonOf(gamma.run.wire.peerToHub), 'peer→hub 骨架').toBe(
      skeletonOf(beta.wire.peerToHub),
    );
    // 数据帧文档语义等（Yjs clientID/clock 随机 ⇒ #424 ORACLE-2 语义判据）。
    expect(docStateOf(dataFramesOf(gamma.run.wire.hubToPeer)), '数据帧文档语义').toBe(
      docStateOf(dataFramesOf(beta.wire.hubToPeer)),
    );
    // hub 本地文档（写后）逐值等（Y.Map.toJSON 为 plain 对象快照）。
    expect(rootSnapshotOf(gamma.run), 'hub 本地文档（写后）').toEqual(rootSnapshotOf(beta));
    expect(
      gamma.run.rootValue('peer', 'n'),
      'peer 收敛到 live update 值',
    ).toBe(43);
  }, 30_000);
});

// ═══════════════════════════ NC：内容敏感性（断言非恒真） ═══════════════════════════

describe('issue #448 LIVE-PARITY-NC — 内容变异负控（数据面判据非恒真）', () => {
  it('LIVE-PARITY-NC1：γ 侧 live 写值变异（43 → 44）⇒ 文档语义比对必报差异；控制帧仍逐字节等', async () => {
    const { framesHexEqual, controlFramesOf, dataFramesOf, docStateOf, makeShardedReplicationFacade } =
      await shardedHelpers();
    const beta = await boot({
      random: () => 0.5,
      waitFor: 'none',
      createHub: (options) => makeShardedReplicationFacade(options).replication,
    });
    await beta.waitNamespace('live');
    await beta.writeHub({ n: 43 });
    await settle();

    const gamma = await bootLiveRound({ hubObserver: true });
    await gamma.awaitLive();
    await gamma.run.writeHub({ n: 44 });
    await pumpUntil(
      gamma.facade.host,
      () => gamma.events('update-acked').length >= 1,
      'γ 变异写结算',
    );

    expect(
      framesHexEqual(controlFramesOf(beta.wire.hubToPeer), controlFramesOf(gamma.run.wire.hubToPeer)),
      'NC：控制帧不承载数据内容 ⇒ 仍逐字节等',
    ).toBeUndefined();
    expect(
      docStateOf(dataFramesOf(gamma.run.wire.hubToPeer)),
      'NC：内容变异必被数据帧语义比对捕获',
    ).not.toBe(docStateOf(dataFramesOf(beta.wire.hubToPeer)));
  }, 30_000);
});
