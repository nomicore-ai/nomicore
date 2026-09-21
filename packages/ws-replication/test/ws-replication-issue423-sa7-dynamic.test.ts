/**
 * SA7 动态验证补充测试 —— issue #423（spec #415 T6）：observer 发射点拆分与降级口径
 * 的数据流/状态行为收口轮（final verification）。
 *
 * 锚定 SA4 静态评审「后续动态验证项」（task_issue-423_sa4_review.md §11）与 SA1 设计 §8
 * 数据流路线表、SA6 契约 §12.4 的可观察结果。既有契约（21 用例）+ 守卫（10 用例）已动态
 * 覆盖发射侧归属（EM-C1/C4）、拒绝路径 connectionId（EM-C2）、缺面 dormant（EM-C3）、
 * 隔离（EM-C5）、listen 计数（EM-C6）、拆分前金标（EM-C7）与定偏移布局（OG-1..5）；
 * 本文件补**关键中间跳点**的运行时证据：
 *
 *   D-SEAM1（设计 §8 路线 1 缝边界① / SA4 §11「真实时钟域 sendQueueMs 残差」）：
 *     独立 session 半边（真实 Registry/Runtime）+ 记录型 seam port 桩 + **真实高分辨率
 *     时钟**（performance.now）——观察缝上实际到达的 `(frame, accounting)`：
 *     · 帧 = 占位序 UPDATE（`[8..12] === 0`——盖章发生在缝之后的 edge 侧，事实所有权边界）；
 *     · 同栈直发 ⇒ `accounting.sendQueueMs` 为真实时钟域残差（同步栈时长级，亚毫秒量级；
 *       上界 50ms 宽松护栏——若发送栈被引入新的真实等待即红）；
 *     · 故意驻留（业务项入队后真实等待 120ms 再 drain）⇒ `sendQueueMs ≥ 100ms`
 *       ——证明差值是真实的「出队 − 最旧入队」队列驻留（session 时钟域、发送调用边界
 *       采样点前移），而非常数或垃圾值；
 *     · 无 clock 面 ⇒ 缝上 `accounting === undefined`（零对象构造——D3.2 缺面纪律的
 *       跳点级证据；对照 EM-C3c 的事件级整键缺席）；
 *     · session 半边观测面零 `update-sent`（发射点已迁 edge——EM-C4b 的同轴复核）。
 *   D-BURST1（设计 §D2.2 恰一 / §D2.5 次序 / D3.4 键集，listen 组合形态）：
 *     真实时钟下连续 5 笔 hub 业务写 ⇒ 每一出站 UPDATE 帧恰一 `update-sent`（事件数 ===
 *     wire UPDATE 帧数）、逐帧 `sequence === wire [8..12]`、严格递增（无重复/无乱序）、
 *     键集逐事件恒等（= EM-C7 金标 `update-sent` 行键集）、真实时钟域残差上界成立。
 *   D-CLOSE1（SA4 §11「close/dispose 后行为」/ §D2.2 `seq > 0` 门）：
 *     工厂形态连接 close 后，宿主 egress 直驱 UPDATE 帧 ⇒ 返回 0（非伪成功）、零新
 *     `update-sent`、零新 wire UPDATE 帧——观测面在 close 后不复活。
 *
 * 纪律：真实 yjs / Registry / Runtime；fixture 骨架与 SA6 契约文件同源（stub 只落在缝的
 * 另一侧）；**唯一真实时间使用** = D-SEAM1/D-BURST1 的真实时钟注入（SA4 §11 点名的观测
 * 面）与 D-SEAM1 的 120ms 有界驻留（观测仪器，非时序依赖——断言用宽界防 flake）；
 * 零源码 grep 断言；无 skip/only/todo/env override；生产代码零改动。
 */
import { describe, expect, it } from 'vitest';
import { decodeMessage, encodeMessage } from '@nomicore/replication-protocol';
import { createHubReplicationEdge } from '@nomicore/ws-replication';
import type {
  DuplexTransport,
  HubNamespaceSessionSink,
  HubReplicationEdgeConnection,
  HubReplicationEdgeFactory,
  HubReplicationEdgeOptions,
  NamespaceAuthorization,
  ReplicationClock,
  ReplicationObserver,
  ReplicationObserverEvent,
  ReplicationTimer,
} from '@nomicore/ws-replication';
import { createMemoryDuplexTransport } from '@nomicore/ws-replication/testing';
import { createHubSessionHost, type HubSessionHost } from '../src/hub-session.js';
import type { HubSessionEdgePort } from '../src/hub-split.js';
import { resolveLimits, resolveTimeouts } from '../src/defaults.js';
import { boot } from './driver.js';
import { HUB_INSTANCE, PEER_INSTANCE, makeHubNamespace, makeNode, settle, settleUntil } from './harness.js';

// ═══════════════════════════ 局部工具（不触碰 src） ═══════════════════════════

const NS_A = `ns-${'0'.repeat(31)}1`;
const HELLO_NONCE = new Uint8Array(16).fill(0x80);

/** 真实高分辨率单调时钟（SA4 §11「真实时钟域残差」观测仪器；亚毫秒分辨率）。 */
class RealHiResClock implements ReplicationClock {
  readonly now = (): number => performance.now();
}

/** 有界真实驻留（D-SEAM1 观测仪器：制造真实队列驻留差值；非时序依赖）。 */
const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function rawSequence(bytes: Uint8Array): number {
  return (((bytes[8]! << 24) | (bytes[9]! << 16) | (bytes[10]! << 8) | bytes[11]!) >>> 0);
}

function helloFrame(sequence: number): Uint8Array {
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

function openFrame(namespaceId: string, sequence: number): Uint8Array {
  return encodeMessage({ kind: 'OPEN_NAMESPACE', namespaceId, hasLocalReplica: false }, { sequence });
}

function placeholderUpdateFrame(namespaceId: string, updateBytes: number): Uint8Array {
  return encodeMessage(
    { kind: 'UPDATE', namespaceId, update: new Uint8Array(updateBytes).fill(0x42) },
    { sequence: 0 },
  );
}

const UPDATE_SENT_KEY_SET = 'bytes,connectionId,namespaceId,sendQueueMs,sequence,side,type';

/** EM-C7 金标 `update-sent` 行键集（拆分前逐字一致面——D3.4）。 */
function keySetOf(event: Readonly<Record<string, unknown>>): string {
  return Object.keys(event).sort().join(',');
}

// ═════════════════ D-SEAM1：session 半边缝上记账投影（真实时钟） ═════════════════

const AUTHORIZED: Extract<NamespaceAuthorization, { ok: true }> = {
  ok: true,
  localOwner: Object.freeze({ userId: 'hub-owner-9f38' }),
  permissions: Object.freeze({ read: true, submit: true }),
};

interface SeamRecord {
  readonly frame: Uint8Array;
  readonly accounting: Readonly<{ sendQueueMs?: number }> | undefined;
}

interface RecordingStub {
  readonly port: HubSessionEdgePort;
  readonly control: Uint8Array[];
  readonly seam: SeamRecord[];
  readonly events: ReplicationObserverEvent[];
}

/** 记录型 seam port 桩（缝的另一侧）：缝上到达的 (frame, accounting) 逐笔留痕。
 *  `gate` 可控（D-SEAM1b 用：闸门关闭 ⇒ `deliver` 走有界队列分支，制造真实队列驻留）。 */
function makeRecordingStub(
  facets: Readonly<{ now?: () => number }>,
  gate: Readonly<{ open: boolean }> = { open: true },
): RecordingStub {
  let sequence = 0;
  const control: Uint8Array[] = [];
  const seam: SeamRecord[] = [];
  const events: ReplicationObserverEvent[] = [];
  const port: HubSessionEdgePort = {
    openAdmission: () => Promise.resolve({ outcome: 'authorized', authorization: AUTHORIZED }),
    sendControlFrame: (frame) => {
      control.push(frame);
      sequence += 1;
      return sequence;
    },
    sendDataFrame: (frame, accounting) => {
      seam.push({ frame, accounting });
      sequence += 1;
      return sequence;
    },
    dataGateOpen: () => gate.open,
    onDataQueued: () => undefined,
    requestDataDrain: () => undefined,
    chunkedUpdateNegotiated: () => false,
    connectionFatal: () => undefined,
    onChannelSettled: () => undefined,
    tryBeginInboundAssembly: () => true,
    endInboundAssembly: () => undefined,
    observerPresent: () => true,
    emitObserver: (event) => {
      events.push(event);
    },
    connectionId: () => 'sa7-seam-conn-0',
    connectionState: () => 'ready',
    bufferedAmount: () => undefined,
    ...(facets.now === undefined ? {} : { now: facets.now }),
  };
  return { port, control, seam, events };
}

interface SeamFixture {
  readonly host: HubSessionHost;
  readonly stub: RecordingStub;
  readonly namespaceId: string;
  /** 业务写（入队；不驱动出站——驻留窗口由调用方控制）。 */
  readonly enqueue: (value: number) => Promise<void>;
  /** 显式驱动出站（独立 session 半边无 edge poll——同 SA6 契约 fixture 纪律）。 */
  readonly drain: () => Promise<void>;
  /** 通道队列深度（可观察：入队事实与出队消费进度）。 */
  readonly queuedCount: () => number;
}

async function makeSeamFixture(
  facets: Readonly<{ now?: () => number }>,
  gate: Readonly<{ open: boolean }> = { open: true },
): Promise<SeamFixture> {
  const node = makeNode('hub');
  const fixture = await makeHubNamespace(node);
  const stub = makeRecordingStub(facets, gate);
  const host = createHubSessionHost({
    port: stub.port,
    registry: node.registry,
    instanceId: HUB_INSTANCE,
    peerInstanceId: PEER_INSTANCE,
    timer: node.scheduler,
    limits: resolveLimits({ maxUpdateBytes: 8_192, maxQueuedUpdateBytes: 32_768 }),
    timeouts: resolveTimeouts(undefined),
  });
  const namespaceId = fixture.namespaceId;
  host.openNamespace({ kind: 'OPEN_NAMESPACE', namespaceId, hasLocalReplica: false });
  await settleUntil(
    () => stub.control.some((frame) => decodeMessage(frame).message.kind === 'BOOTSTRAP_SNAPSHOT'),
    'BOOTSTRAP_SNAPSHOT 出站',
  );
  const snapshotIndex = stub.control.findIndex(
    (frame) => decodeMessage(frame).message.kind === 'BOOTSTRAP_SNAPSHOT',
  );
  host.namespaceFrame({ kind: 'BOOTSTRAP_ACK', namespaceId, ackedSequence: snapshotIndex + 1 }, 2);
  await settle();
  host.namespaceFrame(
    { kind: 'SYNC_STEP1', namespaceId, syncRoundId: 1, stateVector: new Uint8Array([0]) },
    3,
  );
  await settleUntil(
    () => stub.control.some((frame) => decodeMessage(frame).message.kind === 'SYNC_STEP2'),
    'SYNC_STEP2 出站',
  );
  const step1Index = stub.control.findIndex(
    (frame) => decodeMessage(frame).message.kind === 'SYNC_STEP1',
  );
  const step2Index = stub.control.findIndex(
    (frame) => decodeMessage(frame).message.kind === 'SYNC_STEP2',
  );
  const step2Message = decodeMessage(stub.control[step2Index]!).message;
  if (step2Message.kind !== 'SYNC_STEP2') throw new Error('fixture: SYNC_STEP2 形态断言失败');
  host.namespaceFrame(
    {
      kind: 'SYNC_STEP2',
      namespaceId,
      syncRoundId: 1,
      relatedStep1Sequence: step1Index + 1,
      update: step2Message.update,
    },
    4,
  );
  await settle();
  host.namespaceFrame(
    { kind: 'SYNC_APPLIED', namespaceId, syncRoundId: 1, ackedSequence: step2Index + 1 },
    5,
  );
  await settleUntil(
    () => stub.events.some((event) => event.type === 'channel-state-changed' && event.to === 'live'),
    'reconcile → live',
  );
  if (host.channels.get(namespaceId) === undefined) throw new Error('fixture: 通道未在场');
  return {
    host,
    stub,
    namespaceId,
    enqueue: async (value: number): Promise<void> => {
      const result = await fixture.lease.mutateData({ op: 'set', path: ['n'], value });
      if (!result.ok) throw new Error(`fixture: 业务写失败 ${JSON.stringify(result)}`);
      await settle();
    },
    drain: async (): Promise<void> => {
      const facet = host.dataFacetOf(namespaceId);
      if (facet === undefined) throw new Error('fixture: data facet 缺失');
      for (let pass = 0; pass < 4 && facet.queuedCount() > 0; pass += 1) facet.pullAndSendOne();
      await settle();
    },
    queuedCount: (): number => host.dataFacetOf(namespaceId)?.queuedCount() ?? 0,
  };
}

describe('issue #423 SA7 D-SEAM1：缝上发送记账投影（session 半边，真实高分辨率时钟）', () => {
  it('D-SEAM1a：同栈直发 ⇒ 缝上帧为占位序 UPDATE（[8..12]=0）、accounting 在场且为真实时钟域残差（<50ms）', async () => {
    const fixture = await makeSeamFixture({ now: new RealHiResClock().now });
    const before = fixture.stub.seam.length;
    await fixture.enqueue(101); // 入队（queuedAt = 真实时钟读数）
    await fixture.drain(); // 同一驱动栈内出站（sentAt - queuedAt ≈ 同步栈时长）
    const records = fixture.stub.seam.slice(before);
    expect(records, 'D-SEAM1a: 场景必须真实过缝 1 帧').toHaveLength(1);
    const message = decodeMessage(records[0]!.frame).message;
    expect(message.kind).toBe('UPDATE');
    expect(
      rawSequence(records[0]!.frame),
      'D-SEAM1a: 缝上帧必须仍是占位序（[8..12]=0）——盖章发生在缝后的 edge 侧',
    ).toBe(0);
    const accounting = records[0]!.accounting;
    expect(accounting, 'D-SEAM1a: clock 在场 ⇒ accounting 对象必须在缝上到达').toBeDefined();
    expect(accounting!.sendQueueMs, 'D-SEAM1a: sendQueueMs 成员必须在场').toBeDefined();
    expect(accounting!.sendQueueMs!).toBeGreaterThanOrEqual(0);
    expect(
      accounting!.sendQueueMs!,
      'D-SEAM1a: 真实时钟域残差 = 同步栈时长级（亚毫秒量级；若发送栈被引入新的真实等待即红）',
    ).toBeLessThan(50);
    expect(
      fixture.stub.events.filter((event) => event.type === 'update-sent'),
      'D-SEAM1a: session 半边观测面零 update-sent（发射点 = edge）',
    ).toEqual([]);
  });

  it('D-SEAM1b：闸门关闭入队后真实驻留 120ms 再出站 ⇒ 缝上 sendQueueMs ≥ 100ms（真实队列驻留差值，非常数）', async () => {
    const gate = { open: false }; // 闸门关 ⇒ deliver 走有界队列分支（queuedAt = 入队时刻）
    const fixture = await makeSeamFixture({ now: new RealHiResClock().now }, gate);
    const before = fixture.stub.seam.length;
    await fixture.enqueue(102);
    // 冲刷 defer 泵直到业务项真实进入通道队列（入队事实先于驻留窗口——可观察锚）。
    await settleUntil(() => fixture.queuedCount() >= 1, '业务项进入通道队列（闸门关闭分支）');
    expect(fixture.stub.seam.length, 'D-SEAM1b: 闸门关闭 ⇒ 驻留期间零过缝帧').toBe(before);
    await realSleep(120); // 真实驻留：业务项在通道有界队列中等待（fake scheduler 不推进任何 timer）
    gate.open = true;
    await fixture.drain();
    const records = fixture.stub.seam.slice(before);
    expect(records, 'D-SEAM1b: 场景必须真实过缝 1 帧').toHaveLength(1);
    const accounting = records[0]!.accounting;
    expect(accounting?.sendQueueMs, 'D-SEAM1b: sendQueueMs 必须在场').toBeDefined();
    expect(
      accounting!.sendQueueMs!,
      'D-SEAM1b: sendQueueMs = 出站时刻 − 最旧入队时刻（真实队列驻留 ≥ 100ms；证明差值语义与采样点前移——差值在发送调用边界已算好并过缝）',
    ).toBeGreaterThanOrEqual(100);
  });

  it('D-SEAM1c：无 clock 面 ⇒ 缝上 accounting === undefined（零对象构造；帧照常过缝）', async () => {
    const fixture = await makeSeamFixture({});
    const before = fixture.stub.seam.length;
    await fixture.enqueue(103);
    await fixture.drain();
    const records = fixture.stub.seam.slice(before);
    expect(records, 'D-SEAM1c: 场景必须真实过缝 1 帧（缺面只缺记账，不缺发送）').toHaveLength(1);
    expect(
      records[0]!.accounting,
      'D-SEAM1c: clock 缺面 ⇒ 缝上整个 accounting 参数缺席（零构造——D3.2 跳点级缺面纪律）',
    ).toBeUndefined();
  });
});

// ═════════════════ D-BURST1：listen 组合形态连发恰一/次序/键集（真实时钟） ═════════════════

describe('issue #423 SA7 D-BURST1：listen 组合形态连续写——恰一、序一致、键集恒等（真实时钟）', () => {
  it('D-BURST1：5 笔 hub 业务写 ⇒ 每出站 UPDATE 帧恰一 update-sent、sequence == wire [8..12] 且严格递增、键集 = 金标行', async () => {
    const events: ReplicationObserverEvent[] = [];
    const run = await boot({ hubObserver: (event) => events.push(event), hubClock: new RealHiResClock() });
    await settle();
    events.length = 0;
    for (let i = 0; i < 5; i += 1) {
      await run.writeHub({ n: 1_000 + i });
      await settleUntil(
        () => events.filter((event) => event.type === 'update-sent').length >= i + 1,
        `第 ${i + 1} 笔 update-sent 到达`,
      );
    }
    await settle();
    const sent = events.filter(
      (event): event is Extract<ReplicationObserverEvent, { type: 'update-sent' }> =>
        event.type === 'update-sent' && event.side === 'hub',
    );
    const wireUpdates = run.wire.hubToPeer.filter(
      (bytes) => decodeMessage(bytes).message.kind === 'UPDATE',
    );
    expect(wireUpdates.length, 'D-BURST1: 场景必须真实出站多帧').toBeGreaterThanOrEqual(3);
    expect(
      sent.length,
      'D-BURST1: 恰一性——update-sent 事件数 === wire UPDATE 帧数（无重复、无缺失）',
    ).toBe(wireUpdates.length);
    const sequences: number[] = [];
    for (let i = 0; i < sent.length; i += 1) {
      const wire = rawSequence(wireUpdates[i]!);
      expect(sent[i]!.sequence, `D-BURST1: 第 ${i + 1} 帧事件 sequence === wire [8..12]`).toBe(wire);
      const decoded = decodeMessage(wireUpdates[i]!).message;
      if (decoded.kind !== 'UPDATE') throw new Error('D-BURST1: UPDATE 形态断言失败');
      expect(sent[i]!.bytes).toBe(decoded.update.byteLength);
      expect(sent[i]!.namespaceId).toBe(run.nsId);
      expect(sent[i]!.connectionId, 'D-BURST1: 握手后 connectionId 在场').toBeDefined();
      expect(
        keySetOf(sent[i]! as unknown as Readonly<Record<string, unknown>>),
        `D-BURST1: 第 ${i + 1} 事件键集 = EM-C7 金标 update-sent 行键集`,
      ).toBe(UPDATE_SENT_KEY_SET);
      expect(sent[i]!.sendQueueMs, 'D-BURST1: clock 在场 ⇒ sendQueueMs 在场').toBeDefined();
      expect(sent[i]!.sendQueueMs!).toBeGreaterThanOrEqual(0);
      expect(
        sent[i]!.sendQueueMs!,
        'D-BURST1: 真实时钟域残差上界（同步栈时长级；毫秒级漂移 = 发送栈被引入新时钟读/真实等待）',
      ).toBeLessThan(50);
      sequences.push(sent[i]!.sequence);
    }
    expect(
      new Set(sequences).size,
      'D-BURST1: sequence 严格递增不重复（天然幂等键）',
    ).toBe(sequences.length);
    for (let i = 1; i < sequences.length; i += 1) {
      expect(sequences[i]!, 'D-BURST1: wire 序严格递增（无乱序）').toBeGreaterThan(sequences[i - 1]!);
    }
    await run.hub.close();
    await run.peer.stop().catch(() => undefined);
  });
});

// ═════════════════ D-CLOSE1：close 后观测面不复活（工厂形态） ═════════════════

describe('issue #423 SA7 D-CLOSE1：连接 close 后 egress 直驱 UPDATE ⇒ 返回 0、零事件、零 wire 帧', () => {
  it('D-CLOSE1：close 前恰一事件在场的正控 + close 后零复活', async () => {
    const events: ReplicationObserverEvent[] = [];
    const { peer, hub } = createMemoryDuplexTransport();
    const outbound: Uint8Array[] = [];
    const fakeTimer: ReplicationTimer = {
      setTimeout: () => 0,
      clearTimeout: () => undefined,
    };
    peer.onMessage((bytes) => outbound.push(bytes));
    const options: HubReplicationEdgeOptions = {
      instanceId: HUB_INSTANCE,
      timer: fakeTimer,
      authorize: () => Promise.resolve(AUTHORIZED),
      resolveSessionSink: (): HubNamespaceSessionSink => ({
        openNamespace: () => undefined,
        namespaceFrame: () => undefined,
        terminateUnauthorized: () => Promise.resolve(),
        onConnectionClosed: () => Promise.resolve(),
      }),
      observer: (event) => events.push(event),
    };
    const factory: HubReplicationEdgeFactory = createHubReplicationEdge(options);
    const connection: HubReplicationEdgeConnection = (await factory.acceptTrusted(hub, {
      peerInstanceId: PEER_INSTANCE,
    }))!;
    await settle();
    if (connection === undefined) throw new Error('fixture: acceptTrusted 未分配连接');
    if (!hub.closed) peer.send(helloFrame(1));
    await settle();
    if (!hub.closed) peer.send(openFrame(NS_A, 2));
    await settleUntil(() => connection.namespaces.has(NS_A), '会话建立');

    // 正控：close 前恰一事件 + wire 恰一 UPDATE 帧
    const stamped = connection.egress.sendDataFrame(placeholderUpdateFrame(NS_A, 23));
    await settle();
    expect(stamped).toBeGreaterThan(0);
    expect(events.filter((event) => event.type === 'update-sent')).toHaveLength(1);
    expect(outbound.filter((bytes) => decodeMessage(bytes).message.kind === 'UPDATE')).toHaveLength(1);

    connection.close(1001, 'sa7-close');
    await connection.settle();

    const eventsBefore = events.length;
    const outboundBefore = outbound.length;
    const after = connection.egress.sendDataFrame(placeholderUpdateFrame(NS_A, 31));
    await settle();
    expect(after, 'D-CLOSE1: close 后 data 帧发送被拒（返回 0，非伪成功）').toBe(0);
    expect(
      events.slice(eventsBefore).filter((event) => event.type === 'update-sent'),
      'D-CLOSE1: close 后零新 update-sent（观测面不复活）',
    ).toEqual([]);
    expect(outbound.slice(outboundBefore), 'D-CLOSE1: close 后零新 wire 帧').toEqual([]);
  });
});
