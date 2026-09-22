/**
 * SA6 验收契约 — issue #450（γ-T4）：**γ 流控与生命周期收口**（ADR 0032 附录 A4.3/A4.5；
 * 协议 §24.5/§24.7；设计 `wiki/raw/task_issue-450_design.md` §7-D1/D1.5/D3–D7、§8、§12.1）。
 *
 * 覆盖条目（与简报 7 条 AC 的映射）：
 *
 * - BPK-C1/C2（AC1/AC7）：账本投影越界 ⇒ `CONNECTION_BACKPRESSURE`(1011) 收口整条连接
 *   （无逐帧拒纳、无 deferred、无 ns 级 send-failed resync）——**无证据传输形态**（缺省
 *   `makeWire` 无 `bufferedAmount` ⇒ 账本零退休 = 永久慢对端等价，F1 头注登记）；
 * - BPK-C4（AC1/AC7，**生产拓扑形态**）：F1 旋钮置位（`bufferedAmount` 在场、只增、不
 *   advance）⇒ 前置门暂停项让位于账本终局判死：压力期 `level() > highWater` 时仍有 data 帧
 *   放行盖章（F-1 判别性观察），随后投影越界 ⇒ 恰一 1011 收口；
 * - BPK-C3/MEM-NC1（AC1/AC7 负控）：F1 持续 `advance`（及时消费）⇒ 零越界零死亡、全帧盖章；
 * - BPK-NC1（AC1 负控）：β 同步缝（`createHubSessionHost` 桥形态，SA6 §6/§12.2 的「同步缝」
 *   载体）⇒ ns 级 `RESYNC_REQUIRED{send-failed}` + 连接存活（**登记差不动**）；
 * - BPK-NC2（AC1 负控，**漏置位形态**）：γ 桥 + 缺省装配（标记缺席）⇒ 前置门仍弹回
 *   （`unsealed` 递增）、零 `connection-failed`、连接存活、ackTimeout 后 ns 级 resync；
 * - OVS-C1/NC1/NC2（AC2）：单帧超连接级上限 ⇒ `FRAME_TOO_LARGE` + close **1009** + 诊断
 *   （配置错误定性）；cap 充裕对照 / 界内帧不得收口；
 * - DROP-C1（AC3）：edge 决定收口后 session→edge 后到一切静默丢弃（收口前放行同帧 ⇒ 正常盖章）；
 * - FLUSH-C1/C2（AC3）：close 冲刷 pending（含在管帧）无泄漏；无 close 的同扣留编排必达
 *   ack-timeout 声明（判别力负控）；
 * - REVOKE-C1/NC1（AC4）：`terminateUnauthorized` 不溯及已推帧（回执 FIFO 严格先于信号）；
 *   重复 revoke 幂等；
 * - DRAIN-C1/NC1（AC5）：`settled` 未达 ⇒ 到 `closeTimeoutMs` 恰 `close(1001,'hub-reauth')`；
 *   早达 ⇒ 提前收口；收口后晚达 ⇒ 零二次收口；逃生舱随注入配置移动（参数未被软化）；
 * - OPENWP-C1/C2（AC6）：γ 缝 + F2 延迟解析 —— 恰 4 并发 OPEN / 恰 16 pending 帧零收口；
 *   第 5 / 第 17 ⇒ 恰一 `CONNECTION_POLICY_VIOLATION` + close(1008)（故障参数定性）；
 * - MEM-C1/C2（AC7）：逐跳有界——session 队列跳（queue-overflow 声明、连接存活）与 edge
 *   账本跳（1011 死亡）判然两分；死亡释放（零 pending 泄漏 + 零新盖章/回执/wire）。
 *
 * 纪律（SA6 §12.0）：断言 = 运行期行为（wire 帧原字节/kind/code/序、缝消息消费序、observer
 * 单事件字段值、`egress.sendDataFrame` 返回值、close info、句柄计数）；零源码 grep 断言；
 * 零 skip/only/todo/env override；真 peer + 真 Registry/Runtime + 公共工厂真身；时间 = 虚拟
 * 调度器 `advanceBy`；延迟 = 显式 release；peer `random` 钉死。
 */
import { describe, expect, it } from 'vitest';
import type { ReplicationObserverEvent } from '@nomicore/ws-replication';
import { boot } from './driver.js';
import { PEER_INSTANCE, settle, settleUntil } from './harness.js';
import { isReceipt, pumpSteps, pumpUntil, TIMEOUTS } from './issue447-async-seam.js';
import { createShimHubForTesting } from './issue420-shim-hub.js';
import {
  bootFlowRound,
  bootInjectionFlow,
  helloFrame450,
  makeLargeUpdateFrame,
  openFrame450,
  type FlowRound,
} from './issue450-flow-seam.js';
import {
  MAX_CONCURRENT_OPEN_ADMISSIONS,
  MAX_PENDING_FRAMES_PER_CONNECTION,
} from '../src/hub-edge-host.js';

// ═══════════════════════════ 编排常量与助手 ═══════════════════════════

/** BPK 族压力构型（链路：lowWater < highWater ≤ cap）。 */
const BPK_LIMITS = {
  maxQueuedBytesPerConnection: 4096,
  lowWater: 1024,
  highWater: 2048,
  maxInFlightUpdates: 32,
} as const;

/** BPK-C4 生产拓扑构型（判别性窗口：highWater 4096 ≪ cap 8192）。 */
const C4_LIMITS = {
  maxQueuedBytesPerConnection: 8192,
  lowWater: 2048,
  highWater: 4096,
  maxInFlightUpdates: 32,
} as const;

/** 大突发 + 泵（P1 编排；每 4 笔释放一次缝）。 */
async function burstWrites(round: FlowRound, count: number): Promise<void> {
  for (let index = 1; index <= count; index += 1) {
    await round.run.writeHub({ n: index });
    if (index % 4 === 0) await pumpSteps(round.facade.host, 1);
    if (round.hubClosed()) break; // 收口后停止写（收口锚已达成）
  }
  await pumpSteps(round.facade.host, 4);
}

/** 指定码的连接级 ERROR 帧数。 */
function connectionErrors(round: FlowRound, code: string): number {
  return round.hubFrames('ERROR').filter((frame) => frame.code === code).length;
}

/** 指定型的 observer 事件（字段值断言面）。 */
function eventsOf(round: FlowRound, type: string): Array<Record<string, unknown>> {
  return round.events(type);
}

/** data lane 的盖章序（收口后「零新盖章」断言面；控制帧不参与）。 */
function dataLaneStamps(round: FlowRound): number[] {
  const dataTags = new Set(round.dataFramesSent().map((frame) => frame.tag));
  return round.facade.host.probes.stamps
    .filter((stamp) => dataTags.has(stamp.tag))
    .map((stamp) => stamp.sequence);
}

/** BPK-C2：γ 形态下「逐帧拒纳 / ns 级 resync」不可达的共享断言组。 */
async function assertNoGammaRejection(round: FlowRound): Promise<void> {
  await round.run.hubNode.scheduler.advanceBy(TIMEOUTS.ackTimeoutMs + 1);
  await settle();
  await pumpSteps(round.facade.host, 3);
  expect(round.hubFrames('RESYNC_REQUIRED'), 'γ：收口后不得出现 ns 级 RESYNC_REQUIRED').toHaveLength(0);
  expect(eventsOf(round, 'resync-required'), 'γ：零 resync-required 声明').toHaveLength(0);
  expect(eventsOf(round, 'update-dropped'), 'γ：零 update-dropped{update-too-large} 诊断').toHaveLength(0);
  expect(round.fatalSignals(), 'γ：收口由 edge 发起（缝上零 connection-fatal 信号）').toHaveLength(0);
  // 缝词汇 ⊆ §24.3 闭集合（零新增词汇面）。
  const vocabulary = new Set([
    'frame',
    'receipt',
    'close',
    'terminateUnauthorized',
    'settled',
    'connection-fatal',
  ]);
  for (const entry of round.facade.host.log) {
    expect(vocabulary.has(entry.name), `缝词汇闭集合：${entry.name}`).toBe(true);
  }
}

/** 收口锚（edge 发起：wire ERROR/close/observer/close 送达恰一）。 */
async function assertFatalClosure(
  round: FlowRound,
  code: string,
  wsCloseCode: number,
): Promise<void> {
  await settle(); // close 通知经微任务投递（对端观察面）
  expect(connectionErrors(round, code), `wire 连接级 ERROR{${code}} 恰一`).toBe(1);
  expect(round.hubClosed(), 'hub 侧 transport 已收口').toBe(true);
  expect(round.peerCloseInfo(), 'WS close code（静态 reason）').toEqual({
    code: wsCloseCode,
    reason: 'protocol-error',
  });
  const failed = eventsOf(round, 'connection-failed');
  expect(failed, 'connection-failed 恰一').toHaveLength(1);
  expect(failed[0], 'connection-failed 字段').toMatchObject({ code, wsCloseCode });
  const seam = round.seam();
  await pumpUntil(
    round.facade.host,
    () => round.facade.host.probes.sessions[0]?.closeCalls === 1,
    'close 信号送达 session（冲刷）',
  );
  expect(
    seam.edgeToSession.delivered().filter((message) => message === 'close'),
    'edge→session close 恰一',
  ).toHaveLength(1);
}

// ═══════════════════════════ BPK：账本越界 ⇒ 1011（AC1/AC7） ═══════════════════════════

describe('issue #450 BPK — γ 账本投影越界 ⇒ CONNECTION_BACKPRESSURE(1011) 收口整条连接', () => {
  it('BPK-C1/C2（无证据传输形态）：300 笔大突发 ⇒ 恰一 1011 收口；零 RESYNC_REQUIRED / 零 resync-required / 零 fatal 信号 / 缝词汇闭集合', async () => {
    const round = await bootFlowRound({
      asyncDataAdmissionFatal: true,
      edgeObserver: true,
      hubObserver: true,
      limits: BPK_LIMITS,
    });
    await round.awaitLive();
    await burstWrites(round, 300);
    await assertFatalClosure(round, 'CONNECTION_BACKPRESSURE', 1011);
    await assertNoGammaRejection(round);
  }, 30_000);

  it('BPK-C4（生产拓扑形态：bufferedAmount 在场、只增不 advance）：压力期 > highWater 仍放行盖章；投影越界 ⇒ 恰一 1011', async () => {
    const round = await bootFlowRound({
      asyncDataAdmissionFatal: true,
      pressure: true,
      edgeObserver: true,
      hubObserver: true,
      limits: C4_LIMITS,
    });
    await round.awaitLive();
    // 判别性观察（F-1）：盖章时刻水位 > highWater 的帧（前置门暂停项已让位于账本终局判死）。
    const samples = round.stampSamples();
    await burstWrites(round, 300);
    const pressure = round.pressure;
    if (pressure === undefined) throw new Error('BPK-C4：压力旋钮缺席');
    expect(pressure.level(), '慢对端形态：水位越过 highWater').toBeGreaterThan(C4_LIMITS.highWater);
    const above = samples.filter((sample) => sample.levelAtStamp > C4_LIMITS.highWater);
    expect(
      above.length,
      '翼(ii)：水位 > highWater 后 data 帧仍被放行盖章（暂停项不再先制账本守卫）',
    ).toBeGreaterThan(0);
    await assertFatalClosure(round, 'CONNECTION_BACKPRESSURE', 1011);
    await assertNoGammaRejection(round);
  }, 30_000);

  it('BPK-C3/MEM-NC1（负控：F1 持续 advance = 及时消费）⇒ 零越界零死亡、全帧放行盖章', async () => {
    const round = await bootFlowRound({
      asyncDataAdmissionFatal: true,
      pressure: true,
      edgeObserver: true,
      hubObserver: true,
      limits: C4_LIMITS,
    });
    await round.awaitLive();
    const pressure = round.pressure;
    if (pressure === undefined) throw new Error('BPK-C3：压力旋钮缺席');
    for (let index = 1; index <= 60; index += 1) {
      await round.run.writeHub({ n: index });
      pressure.advance(pressure.level()); // 对端消费 ⇒ 观察值下降 ⇒ 账本退休
      await pumpSteps(round.facade.host, 1);
    }
    await pumpUntil(
      round.facade.host,
      () => round.hubFrames('UPDATE').length >= 60,
      '界内 60 帧全部放行盖章',
    );
    expect(round.hubFrames('UPDATE'), '界内：全部帧盖章（零拒纳）').toHaveLength(60);
    expect(round.connection().state, '连接存活').toBe('ready');
    expect(round.hubClosed(), '零收口').toBe(false);
    expect(eventsOf(round, 'connection-failed')).toHaveLength(0);
    expect(round.hubFrames('RESYNC_REQUIRED')).toHaveLength(0);
    // 盖章与回执配对（无漏盖；控制帧不参与 data lane 判据）。
    expect(dataLaneStamps(round), '每 data 帧恰一盖章').toHaveLength(round.dataFramesSent().length);
    expect(dataLaneStamps(round), '恰 60 帧盖章').toHaveLength(60);
  }, 30_000);

  it('BPK-NC1（β 登记差负控）：同步缝同压力编排 ⇒ ns 级 RESYNC_REQUIRED{send-failed} + 连接存活、零 CONNECTION_BACKPRESSURE', async () => {
    const observerEvents: ReplicationObserverEvent[] = [];
    const run = await boot({
      random: () => 0.5,
      waitFor: 'none',
      limits: BPK_LIMITS,
      hubObserver: (event) => {
        observerEvents.push(event);
      },
      createHub: (options) => {
        // 同步缝（`createHubSessionHost` 桥形态；SA6 §6 NC-1「监听单体或 createHubSessionHost
        // 同步缝」的后者）——经既有 shim 桥（零改动复用，#420 夹具）注入与 BPK-C1 同款 limits。
        return createShimHubForTesting(options).replication;
      },
    });
    try {
      await run.waitNamespace('live');
      for (let index = 1; index <= 300; index += 1) {
        await run.writeHub({ n: index });
        if (index % 4 === 0) {
          await settle();
          if (run.hubFrames('RESYNC_REQUIRED').length >= 1) break;
        }
      }
      await settle();
      const resync = run.hubFrames('RESYNC_REQUIRED');
      expect(resync.length, 'β：ns 级 RESYNC_REQUIRED 必达').toBeGreaterThanOrEqual(1);
      const declared = observerEvents.filter((event) => event.type === 'resync-required');
      expect(declared.length, 'β：resync-required 声明在场').toBeGreaterThanOrEqual(1);
      expect(declared[0], 'β 登记差：cause = send-failed').toMatchObject({
        cause: 'send-failed',
        reason: 'send-frame-rejected',
      });
      expect(
        observerEvents.filter(
          (event) => event.type === 'connection-failed' && event.code === 'CONNECTION_BACKPRESSURE',
        ),
        'β：零连接级 1011（登记差不动）',
      ).toHaveLength(0);
      expect(run.wire.hubEnd.closed, 'β：连接存活').toBe(false);
    } finally {
      await run.hub.close();
    }
  }, 30_000);

  it('BPK-NC2（漏置位形态负控）：γ 桥 + 缺省装配 ⇒ 前置门弹回（unsealed 递增）+ 零收口 + 存活；ackTimeout 后 ns 级 resync', async () => {
    const round = await bootFlowRound({
      pressure: true, // 标记缺席：缺省（β 直驱宿主）语义
      edgeObserver: true,
      hubObserver: true,
      limits: BPK_LIMITS,
    });
    await round.awaitLive();
    await burstWrites(round, 300);
    const pressure = round.pressure;
    if (pressure === undefined) throw new Error('BPK-NC2：压力旋钮缺席');
    expect(pressure.level(), '水位越过 highWater').toBeGreaterThan(BPK_LIMITS.highWater);
    expect(round.facade.host.probes.unsealed, '缺省装配：data 帧在前置门弹回（未盖章）').toBeGreaterThan(0);
    expect(round.connection().state, '连接存活（暂停弹回形态为缺省装配保留）').toBe('ready');
    expect(round.hubClosed(), '零收口').toBe(false);
    expect(eventsOf(round, 'connection-failed')).toHaveLength(0);
    expect(connectionErrors(round, 'CONNECTION_BACKPRESSURE')).toBe(0);
    // 弹回的 tag 停留 pending ⇒ ackTimeout 有界兜底 ⇒ ns 级 resync（cause = ack-timeout）。
    await round.run.hubNode.scheduler.advanceBy(TIMEOUTS.ackTimeoutMs + 1);
    await settle();
    await pumpSteps(round.facade.host, 3);
    expect(
      round.hubFrames('RESYNC_REQUIRED').length,
      '漏置位形态：ns 级 RESYNC_REQUIRED 必达',
    ).toBeGreaterThanOrEqual(1);
    const declared = eventsOf(round, 'resync-required');
    expect(declared.length).toBeGreaterThanOrEqual(1);
    expect(declared[0], 'O2：漏置位形态 cause = ack-timeout（与 BPK-NC1 判别）').toMatchObject({
      cause: 'ack-timeout',
    });
    expect(eventsOf(round, 'connection-failed')).toHaveLength(0);
    expect(round.hubClosed(), '连接仍存活').toBe(false);
  }, 30_000);
});

// ═══════════════════════════ OVS：单帧超限（AC2） ═══════════════════════════

describe('issue #450 OVS — 单帧超连接级上限 ⇒ 配置错误定性响亮收口（FRAME_TOO_LARGE/1009）', () => {
  it('OVS-C1：20480B 直驱帧（cap 16384）⇒ 返回 0 + 恰一 ERROR{FRAME_TOO_LARGE} + close 1009 + 诊断恰一；无「返回 0 且连接存活」形态', async () => {
    const round = await bootFlowRound({
      asyncDataAdmissionFatal: true,
      edgeObserver: true,
      hubObserver: true,
      limits: { maxQueuedBytesPerConnection: 16384, highWater: 8192, lowWater: 4096 },
    });
    await round.awaitLive();
    const frame = makeLargeUpdateFrame(round.run.nsId, 20480);
    expect(frame.byteLength, '载荷构造前提：帧长 ≥ 20480').toBeGreaterThanOrEqual(20480);
    const returned = round.connection().egress.sendDataFrame(frame);
    expect(returned, '超限帧不得出站（返回 0）').toBe(0);
    await assertFatalClosure(round, 'FRAME_TOO_LARGE', 1009);
    expect(eventsOf(round, 'update-sent'), '未盖章 ⇒ 零 update-sent').toHaveLength(0);
    expect(round.hubFrames('UPDATE'), '超限帧零 wire 字节').toHaveLength(0);
  }, 30_000);

  it('OVS-NC1/NC2：cap 充裕（65536）+ 注入前清账 ⇒ 同帧放行出站且零收口；界内小帧照常放行（严格大于判据不变）', async () => {
    const round = await bootFlowRound({
      asyncDataAdmissionFatal: true,
      pressure: true,
      edgeObserver: true,
      limits: { maxQueuedBytesPerConnection: 65536, highWater: 32768, lowWater: 16384 },
    });
    await round.awaitLive();
    const pressure = round.pressure;
    if (pressure === undefined) throw new Error('OVS-NC1：压力旋钮缺席');
    pressure.advance(pressure.level()); // 注入前清账（缺省夹具账本零退休 ⇒ 见设计 N2）
    round.run.dropNextHubFrame('UPDATE'); // 旁路记录面：隔绝对端消费（帧字节仍达 wire 记录）
    const frame = makeLargeUpdateFrame(round.run.nsId, 20480);
    const returned = round.connection().egress.sendDataFrame(frame);
    expect(returned, 'cap 充裕：同帧正常盖章出站').toBeGreaterThan(0);
    expect(round.wire.droppedHubToPeer, '帧字节达 wire（记录面）').toHaveLength(1);
    await settle();
    // OVS-NC2：界内小帧照常放行（严格大于判据不变）。
    round.run.dropNextHubFrame('UPDATE');
    const small = makeLargeUpdateFrame(round.run.nsId, 64);
    expect(small.byteLength, '界内：帧长 ≤ cap').toBeLessThanOrEqual(65536);
    expect(round.connection().egress.sendDataFrame(small), '界内帧放行').toBeGreaterThan(0);
    await settle();
    expect(round.connection().state, '连接存活').toBe('ready');
    expect(round.hubClosed(), '零收口').toBe(false);
    expect(eventsOf(round, 'connection-failed')).toHaveLength(0);
    expect(round.hubFrames('ERROR')).toHaveLength(0);
  }, 30_000);
});

// ═══════════════════════════ 生命周期四腿（AC3/AC4/AC5） ═══════════════════════════

describe('issue #450 DROP/FLUSH — 收口后静默丢弃与 close 冲刷（AC3）', () => {
  it('DROP-C1：扣留 session→edge；收口前放行同帧 ⇒ 正常盖章；收口后放行后到帧/settled ⇒ 零盖章/零回执/零新 wire/零新事件', async () => {
    const round = await bootFlowRound({
      asyncDataAdmissionFatal: true,
      edgeObserver: true,
      hubObserver: true,
    });
    await round.awaitLive();
    const seam = round.seam();
    // 阶段 1（前置：收口前放行 ⇒ 正常盖章）。
    seam.sessionToEdge.setHeld(true);
    await round.run.writeHub({ n: 43 });
    await pumpSteps(round.facade.host, 2);
    const heldBefore = seam.sessionToEdge.pending().length;
    expect(heldBefore, '帧在管（未投递）').toBeGreaterThan(0);
    const stampsBeforeClosure = dataLaneStamps(round).length;
    seam.sessionToEdge.setHeld(false);
    seam.sessionToEdge.release();
    await pumpSteps(round.facade.host, 2);
    expect(dataLaneStamps(round).length, '收口前放行 ⇒ 正常盖章').toBeGreaterThan(
      stampsBeforeClosure,
    );
    // 阶段 2：再扣留一帧，edge 决定收口（对端断链），先送达 close 再放行后到帧。
    seam.sessionToEdge.setHeld(true);
    await round.run.writeHub({ n: 44 });
    await pumpSteps(round.facade.host, 2);
    expect(seam.sessionToEdge.pending().length, '后到帧在管').toBeGreaterThan(0);
    round.wire.closePeerSide(1000, 'peer-close');
    await settle();
    await pumpUntil(
      round.facade.host,
      () => seam.edgeToSession.delivered().some((message) => message === 'close'),
      'close 信号先送达 session',
    );
    // 收口后量测基线。
    const stampsAfter = dataLaneStamps(round).length;
    const receiptsAfter = round.facade.host.probes.receipts.length;
    const wireAfter = round.wire.hubToPeer.length;
    const eventsAfter = round.observerEvents.length;
    // 后到帧 + settled 落账（公开 egress 面）⇒ 全部静默。
    seam.sessionToEdge.setHeld(false);
    seam.sessionToEdge.release();
    round.connection().egress.namespaceSettled(round.run.nsId);
    await pumpSteps(round.facade.host, 3);
    expect(dataLaneStamps(round).length, '收口后：零新盖章').toBe(stampsAfter);
    expect(round.facade.host.probes.receipts.length, '收口后：零新回执').toBe(receiptsAfter);
    expect(round.wire.hubToPeer.length, '收口后：零新 wire 字节').toBe(wireAfter);
    expect(round.observerEvents.length, '收口后：零新 observer 事件').toBe(eventsAfter);
    expect(round.connection().state, '状态保持 closed').toBe('closed');
  }, 30_000);

  it('FLUSH-C1：maxInFlightUpdates=1 + 扣留在管帧 ⇒ 送达 close：close() 同 promise 幂等、closeCalls=1；冲刷后零 RESYNC_REQUIRED、迟到回执良性', async () => {
    const round = await bootFlowRound({
      asyncDataAdmissionFatal: true,
      edgeObserver: true,
      hubObserver: true,
      limits: { maxInFlightUpdates: 1 },
    });
    await round.awaitLive();
    const seam = round.seam();
    round.facade.host.withholdEdgeToSession(round.connectionKey, round.run.nsId);
    await round.run.writeHub({ n: 43 });
    await pumpUntil(round.facade.host, () => round.hubFrames('UPDATE').length >= 1, '在管帧过缝');
    await round.run.writeHub({ n: 44 });
    await pumpSteps(round.facade.host, 2);
    expect(round.hubFrames('UPDATE'), '窗口满：第 2 帧不过缝').toHaveLength(1);
    // close 信号（对端断链 ⇒ edge → session）。
    round.wire.closePeerSide(1000, 'peer-close');
    await settle();
    seam.edgeToSession.setHeld(false);
    await pumpUntil(
      round.facade.host,
      () => seam.edgeToSession.delivered().some((message) => message === 'close'),
      'close 信号送达 session',
    );
    await pumpSteps(round.facade.host, 2);
    expect(
      seam.edgeToSession.delivered().filter((message) => message === 'close'),
      'close 恰一（幂等收敛）',
    ).toHaveLength(1);
    expect(round.facade.host.probes.sessions[0]!.closeCalls, 'closeCalls=1').toBe(1);
    // close() 幂等（同 promise）；探针计数随直接调用递增（非第二次送达）。
    const handle = round.facade.host.probes.handles[0]!;
    expect(handle.close(), 'close() 幂等（同 promise）').toBe(handle.close());
    expect(round.facade.host.probes.sessions[0]!.closeCalls, '两次直接调用 = 两次计数').toBe(3);
    // 冲刷后：ackTimeout 到点零声明、零 fatal。
    await round.run.hubNode.scheduler.advanceBy(TIMEOUTS.ackTimeoutMs + 1);
    await settle();
    await pumpSteps(round.facade.host, 3);
    expect(round.hubFrames('RESYNC_REQUIRED'), 'pending/在管整体冲刷 ⇒ 零 RESYNC_REQUIRED').toHaveLength(0);
    expect(eventsOf(round, 'resync-required')).toHaveLength(0);
    expect(round.fatalSignals()).toHaveLength(0);
    // 迟到回执（放行扣留缓冲）良性 no-op。
    seam.edgeToSession.setHeld(false);
    seam.edgeToSession.release();
    await pumpSteps(round.facade.host, 2);
    expect(round.fatalSignals(), '迟到回执良性').toHaveLength(0);
    expect(
      seam.edgeToSession.delivered().filter((message) => message === 'close'),
      '迟到回执不触发第二次送达',
    ).toHaveLength(1);
  }, 30_000);

  it('FLUSH-C2（判别力负控）：无 close 的同扣留编排 ⇒ 必达 RESYNC_REQUIRED{ack-timeout}×1（冲刷断言非恒真）', async () => {
    const round = await bootFlowRound({
      asyncDataAdmissionFatal: true,
      edgeObserver: true,
      hubObserver: true,
      limits: { maxInFlightUpdates: 1 },
    });
    await round.awaitLive();
    round.facade.host.withholdEdgeToSession(round.connectionKey, round.run.nsId);
    await round.run.writeHub({ n: 43 });
    await pumpUntil(round.facade.host, () => round.hubFrames('UPDATE').length >= 1, '在管帧过缝');
    await round.run.hubNode.scheduler.advanceBy(TIMEOUTS.ackTimeoutMs + 1);
    await settle();
    await pumpUntil(
      round.facade.host,
      () => round.hubFrames('RESYNC_REQUIRED').length >= 1,
      'ack-timeout ⇒ RESYNC_REQUIRED',
    );
    expect(round.hubFrames('RESYNC_REQUIRED'), '恰一声明').toHaveLength(1);
    expect(eventsOf(round, 'resync-required')[0]).toMatchObject({ cause: 'ack-timeout' });
    expect(round.hubClosed(), '连接存活').toBe(false);
  }, 30_000);
});

describe('issue #450 REVOKE — terminateUnauthorized 不溯及已推帧（AC4）', () => {
  it('REVOKE-C1：已推帧盖章后 revoke ⇒ 回执在 FIFO 消费序中 strict 先于 terminateUnauthorized；ns failed、连接存活', async () => {
    const round = await bootFlowRound({
      asyncDataAdmissionFatal: true,
      edgeObserver: true,
      hubObserver: true,
    });
    await round.awaitLive();
    const seam = round.seam();
    round.facade.host.withholdEdgeToSession(round.connectionKey, round.run.nsId);
    await round.run.writeHub({ n: 43 });
    await pumpUntil(round.facade.host, () => round.hubFrames('UPDATE').length >= 1, '已推帧盖章');
    const sequence = round.hubFrames('UPDATE')[0]!.sequence;
    await settleUntil(
      () => seam.edgeToSession.pending().some((message) => isReceipt(message)),
      '回执入队（扣留）',
    );
    await round.run.hub.revoke(PEER_INSTANCE, round.run.nsId);
    await settle();
    seam.edgeToSession.setHeld(false);
    seam.edgeToSession.release();
    await pumpUntil(
      round.facade.host,
      () => round.run.namespaceState() === 'failed',
      'revoke ⇒ ns failed',
    );
    await pumpSteps(round.facade.host, 2);
    const delivered = seam.edgeToSession.delivered();
    const receiptIndex = delivered.findIndex(
      (message) => isReceipt(message) && message.sequence === sequence,
    );
    const terminateIndex = delivered.findIndex((message) => message === 'terminateUnauthorized');
    expect(receiptIndex, `已推帧（序 ${sequence}）的回执在消费序中`).toBeGreaterThanOrEqual(0);
    expect(terminateIndex, 'terminateUnauthorized 在消费序中').toBeGreaterThanOrEqual(0);
    expect(receiptIndex, '不溯及：回执 strict 先于 revoke 信号').toBeLessThan(terminateIndex);
    expect(connectionErrors(round, 'NAMESPACE_UNAUTHORIZED'), '恰一 ns 撤销 ERROR').toBe(1);
    expect(round.run.namespaceState()).toBe('failed');
    expect(round.connection().state, 'ns 级终局非连接死亡').toBe('ready');
    expect(eventsOf(round, 'connection-failed')).toHaveLength(0);
  }, 30_000);

  it('REVOKE-NC1（幂等负控）：重复 revoke ⇒ 零第二次 NAMESPACE_UNAUTHORIZED、零新收口', async () => {
    const round = await bootFlowRound({
      asyncDataAdmissionFatal: true,
      edgeObserver: true,
      hubObserver: true,
    });
    await round.awaitLive();
    await round.run.hub.revoke(PEER_INSTANCE, round.run.nsId);
    await pumpUntil(
      round.facade.host,
      () => round.run.namespaceState() === 'failed',
      '首次 revoke ⇒ ns failed',
    );
    const errorsAfterFirst = connectionErrors(round, 'NAMESPACE_UNAUTHORIZED');
    const wireAfterFirst = round.wire.hubToPeer.length;
    await round.run.hub.revoke(PEER_INSTANCE, round.run.nsId);
    await settle();
    await pumpSteps(round.facade.host, 2);
    expect(connectionErrors(round, 'NAMESPACE_UNAUTHORIZED'), '重复 revoke 零第二帧').toBe(
      errorsAfterFirst,
    );
    expect(round.wire.hubToPeer.length, '零新收口字节').toBe(wireAfterFirst);
    expect(round.connection().state).toBe('ready');
  }, 30_000);
});

describe('issue #450 DRAIN — settled 晚到与 closeTimeoutMs 逃生舱（AC5）', () => {
  it('DRAIN-C1：reauth GOAWAY 后 settled 未达 ⇒ 到点前零收口、到点恰 close(1001,hub-reauth)；收口后晚达 settled 零二次收口', async () => {
    const round = await bootFlowRound({
      asyncDataAdmissionFatal: true,
      edgeObserver: true,
      hubObserver: true,
    });
    await round.awaitLive();
    let closeEvents = 0;
    round.wire.peerEnd.onClose(() => {
      closeEvents += 1;
    });
    await round.run.hub.requestReauth(PEER_INSTANCE);
    await settle();
    expect(round.hubFrames('GOAWAY'), 'GOAWAY 恰一').toHaveLength(1);
    await round.run.hubNode.scheduler.advanceBy(TIMEOUTS.closeTimeoutMs - 1);
    await settle();
    expect(round.hubClosed(), '到点前不得收口').toBe(false);
    await round.run.hubNode.scheduler.advanceBy(2);
    await settle();
    expect(round.peerCloseInfo(), '到点恰 1001 hub-reauth').toEqual({
      code: 1001,
      reason: 'hub-reauth',
    });
    expect(closeEvents, 'close 恰一次').toBe(1);
    // 收口后晚达 settled ⇒ 零二次收口 / 零新事件（基线取全泵之后，隔离开窗残留事件）。
    await pumpSteps(round.facade.host, 3);
    await settle();
    const eventsAfter = round.observerEvents.length;
    round.connection().egress.namespaceSettled(round.run.nsId);
    await settle();
    await pumpSteps(round.facade.host, 3);
    expect(closeEvents, '晚达 settled 零二次收口').toBe(1);
    expect(round.observerEvents.length, '晚达 settled 零新事件').toBe(eventsAfter);
  }, 30_000);

  it('DRAIN-C1（早达形态）：drain 窗口内 ns settled ⇒ 提前收口（< deadline）', async () => {
    const round = await bootFlowRound({
      asyncDataAdmissionFatal: true,
      edgeObserver: true,
      hubObserver: true,
    });
    await round.awaitLive();
    await round.run.hub.requestReauth(PEER_INSTANCE);
    await settle();
    expect(round.hubFrames('GOAWAY')).toHaveLength(1);
    // drain 窗口内 revoke ⇒ ns failed ⇒ settled 信号 ⇒ 提前完成（零时间推进）。
    await round.run.hub.revoke(PEER_INSTANCE, round.run.nsId);
    await pumpUntil(round.facade.host, () => round.hubClosed(), 'settled 早达 ⇒ 提前收口');
    expect(round.peerCloseInfo(), '提前收口同码').toEqual({ code: 1001, reason: 'hub-reauth' });
    expect(round.fatalSignals(), 'settled 落账不触发连接级 fatal').toHaveLength(0);
  }, 30_000);

  it('DRAIN-NC1（逃生舱敏感）：注入 2× closeTimeoutMs ⇒ 收口时刻随配置移动（参数未被软化）', async () => {
    const round = await bootFlowRound({
      asyncDataAdmissionFatal: true,
      timeouts: { closeTimeoutMs: 10_000 },
    });
    await round.awaitLive();
    await round.run.hub.requestReauth(PEER_INSTANCE);
    await settle();
    const goaway = round.hubFrames('GOAWAY');
    expect(goaway, 'GOAWAY 携带注入 drain 窗口').toHaveLength(1);
    expect((goaway[0]!.message as { drainTimeoutMs: number }).drainTimeoutMs).toBe(10_000);
    await round.run.hubNode.scheduler.advanceBy(9_999);
    await settle();
    expect(round.hubClosed(), '注入窗口内不得收口').toBe(false);
    await round.run.hubNode.scheduler.advanceBy(2);
    await settle();
    expect(round.peerCloseInfo()).toEqual({ code: 1001, reason: 'hub-reauth' });
  }, 30_000);
});

// ═══════════════════════════ OPENWP：OPEN 水位 γ permutation（AC6） ═══════════════════════════

describe('issue #450 OPENWP — OPEN 水位原值不误收口 / 打穿响亮收口（γ 缝 + F2 延迟解析）', () => {
  it('OPENWP-C1（并发闸形态）：恰 4 并发 deferred OPEN 零收口；resolve 后台账归还', async () => {
    const flow = await bootInjectionFlow();
    flow.inject(helloFrame450(1));
    await settle();
    const namespaces = [0, 1, 2, 3].map((index) => `ns-${'0'.repeat(31)}${index}`);
    let sequence = 2;
    for (const namespaceId of namespaces) {
      flow.inject(openFrame450(namespaceId, sequence));
      sequence += 1;
    }
    await settle();
    expect(flow.closes, '恰 4 并发 OPEN ⇒ 零收口').toHaveLength(0);
    expect(flow.connection.state).toBe('ready');
    expect(flow.errors(), '零 ERROR').toHaveLength(0);
    expect(flow.facade.host.pendingSinks(), '4 个解析挂起（跨线程延迟形态）').toHaveLength(
      MAX_CONCURRENT_OPEN_ADMISSIONS,
    );
  }, 30_000);

  it('OPENWP-C2（并发闸打穿）：第 5 个并发 OPEN ⇒ 恰一 CONNECTION_POLICY_VIOLATION + close(1008) + quiesce', async () => {
    const flow = await bootInjectionFlow();
    flow.inject(helloFrame450(1));
    await settle();
    const namespaces = [0, 1, 2, 3, 4].map((index) => `ns-${'0'.repeat(31)}${index}`);
    let sequence = 2;
    for (const namespaceId of namespaces) {
      flow.inject(openFrame450(namespaceId, sequence));
      sequence += 1;
    }
    await settle();
    expect(flow.connection.state, 'quiesce').toBe('closed');
    expect(flow.closes, '打穿 = 故障参数定性（响亮收口）').toEqual([
      { code: 1008, reason: 'protocol-error' },
    ]);
    const connectionErrors450 = flow.errors().filter((error) => error.namespaceId === undefined);
    expect(connectionErrors450, '恰一连接级 ERROR').toHaveLength(1);
    expect(connectionErrors450[0]!.code).toBe('CONNECTION_POLICY_VIOLATION');
  }, 30_000);

  it('OPENWP-C1（帧闸形态）：1 OPEN + 15 缓冲早期帧（恰 16）零收口；resolve 后按序冲刷', async () => {
    const flow = await bootInjectionFlow();
    flow.inject(helloFrame450(1));
    await settle();
    flow.inject(openFrame450(flow.nsId, 2));
    for (let index = 0; index < MAX_PENDING_FRAMES_PER_CONNECTION - 1; index += 1) {
      flow.inject(openFrame450(flow.nsId, 3 + index));
    }
    await settle();
    expect(flow.closes, '恰 16 pending ⇒ 零收口').toHaveLength(0);
    expect(flow.connection.state).toBe('ready');
    expect(flow.errors()).toHaveLength(0);
    expect(flow.facade.host.pendingSinks(), '解析挂起（延迟注入）').toHaveLength(1);
    // 显式 resolve 泵 ⇒ 台账归还 + 缓冲按序冲刷（零收口）。
    flow.facade.host.resolveSink(flow.nsId);
    await settleUntil(
      () => flow.facade.host.pendingSinks().length === 0,
      'resolve 泵结算挂起解析',
    );
    await settle();
    expect(flow.facade.host.pendingSinks(), '台账已归还').toHaveLength(0);
    expect(flow.closes, 'resolve 后仍零收口').toHaveLength(0);
    expect(flow.connection.state).toBe('ready');
  }, 30_000);

  it('OPENWP-C2（帧闸打穿）：1 OPEN + 16 缓冲帧（第 17 项）⇒ 恰一 CONNECTION_POLICY_VIOLATION + close(1008)', async () => {
    const flow = await bootInjectionFlow();
    flow.inject(helloFrame450(1));
    await settle();
    flow.inject(openFrame450(flow.nsId, 2));
    for (let index = 0; index < MAX_PENDING_FRAMES_PER_CONNECTION; index += 1) {
      flow.inject(openFrame450(flow.nsId, 3 + index));
    }
    await settle();
    expect(flow.connection.state).toBe('closed');
    expect(flow.closes).toEqual([{ code: 1008, reason: 'protocol-error' }]);
    const connectionErrors450 = flow.errors().filter((error) => error.namespaceId === undefined);
    expect(connectionErrors450).toHaveLength(1);
    expect(connectionErrors450[0]!.code).toBe('CONNECTION_POLICY_VIOLATION');
  }, 30_000);
});

// ═══════════════════════════ MEM：逐跳有界与死亡释放（AC7） ═══════════════════════════

describe('issue #450 MEM — 逐跳有界与死亡释放（session 队列跳 / edge 账本跳判然两分）', () => {
  it('MEM-C1（session 队列跳）：小 maxQueuedUpdateBytes 构型 + 扣留 ⇒ 既有 queue-overflow 声明（ns 级）+ 连接存活', async () => {
    const round = await bootFlowRound({
      asyncDataAdmissionFatal: true,
      edgeObserver: true,
      hubObserver: true,
      limits: { maxUpdateBytes: 256, maxQueuedUpdateBytes: 512, maxQueuedUpdateCount: 3 },
    });
    await round.awaitLive();
    round.facade.host.withholdEdgeToSession(round.connectionKey, round.run.nsId);
    for (let index = 1; index <= 48; index += 1) {
      await round.run.writeHub({ n: index });
      if (index % 4 === 0) await pumpSteps(round.facade.host, 1);
    }
    await pumpSteps(round.facade.host, 2);
    const declared = eventsOf(round, 'resync-required');
    expect(declared.length, 'session 队列跳：既有 queue-overflow 声明恰一').toBe(1);
    expect(declared[0]).toMatchObject({ cause: 'queue-overflow' });
    expect(round.connection().state, '队列跳 = ns 级（连接存活）').toBe('ready');
    expect(round.hubClosed()).toBe(false);
    expect(eventsOf(round, 'connection-failed')).toHaveLength(0);
  }, 30_000);

  it('MEM-C1b/MEM-C2（edge 账本跳 + 死亡释放）：越界 ⇒ 1011 死亡（非静默丢帧充当上限）；teardown 后零 pending 泄漏与零新观测', async () => {
    const round = await bootFlowRound({
      asyncDataAdmissionFatal: true,
      edgeObserver: true,
      hubObserver: true,
      limits: BPK_LIMITS,
    });
    await round.awaitLive();
    await burstWrites(round, 300);
    await assertFatalClosure(round, 'CONNECTION_BACKPRESSURE', 1011);
    // 两跳判然两分：edge 跳死亡路径上 session 队列跳（queue-overflow）零声明。
    expect(
      eventsOf(round, 'resync-required').filter((event) => event.cause === 'queue-overflow'),
      'edge 跳：session 队列未被用作上限',
    ).toHaveLength(0);
    // 死亡释放：全泵 + ackTimeout 后零新盖章/回执/wire 字节、零 RESYNC_REQUIRED、closeCalls=1。
    const stampsAfter = dataLaneStamps(round).length;
    const receiptsAfter = round.facade.host.probes.receipts.length;
    const wireAfter = round.wire.hubToPeer.length;
    await round.run.hubNode.scheduler.advanceBy(TIMEOUTS.ackTimeoutMs + 1);
    await settle();
    await pumpSteps(round.facade.host, 4);
    expect(round.hubFrames('RESYNC_REQUIRED'), '账目归零：零 pending 泄漏（零 resync 声明）').toHaveLength(0);
    expect(dataLaneStamps(round).length, '零新盖章').toBe(stampsAfter);
    expect(round.facade.host.probes.receipts.length, '零新回执').toBe(receiptsAfter);
    expect(round.wire.hubToPeer.length, '零新 wire 字节').toBe(wireAfter);
    expect(round.facade.host.probes.sessions[0]!.closeCalls, 'closeCalls=1').toBe(1);
  }, 30_000);
});

// ═══════════════════════════ 缺省装配不变性（β/α 硬门哨兵） ═══════════════════════════

describe('issue #450 PUB — 缺省装配零传不变性', () => {
  it('缺省零传：γ 桥不置位标记 ⇒ 成功路径逐字节正常（HEAD 语义保留）', async () => {
    const round = await bootFlowRound({ edgeObserver: true, hubObserver: true });
    await round.awaitLive();
    await round.run.writeHub({ n: 43 });
    await pumpUntil(
      round.facade.host,
      () => eventsOf(round, 'update-acked').length >= 1,
      '缺省装配 live UPDATE 全链结算',
    );
    expect(round.hubFrames('UPDATE'), '缺省装配：正常出站').toHaveLength(1);
    expect(round.connection().state).toBe('ready');
    expect(eventsOf(round, 'connection-failed')).toHaveLength(0);
  }, 30_000);
});
