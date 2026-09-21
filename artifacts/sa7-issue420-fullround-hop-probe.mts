/**
 * SA7 issue #420 —— P2：内存管道完整协议回合的关键跳点/状态机动态观测（shim 装配）。
 *
 * 目的：对设计 §8.2 R1–R6 逐路线收集**运行时中间值**（非仅最终断言通过），并观测通道
 * FSM 边序列（observer 事件）与桥路由相位的可观察投影（probes 计数）：
 *   R1 入站：wire → edge（序校验）→ 桥编码 → handleFrame（无 expectedSequence）→ 通道；
 *   R2 出站：通道 → 占位 0 → listener → 真 port 盖章 → wire；**返回序沿调用链回传**
 *           （sinkReturns[i] === 对应 hub→peer wire 帧 sequence，逐帧对账）；
 *   R3 准入：authorize 恰 1（edge）→ 描述子（纯 JSON）跨缝 → OPEN_OK 恰 1；
 *   R3b 再 OPEN（authorized 相位）：转发不经 open()（sessionsOpened 不变）→ 重开矩阵再答；
 *   R4 信号：settled 恰 1 经 onSignal → edge；
 *   R5 生命周期：close 幂等（同一 promise）+ drain 后零残留 timer 出帧；
 *   R6 观测：通道 FSM 边（opening→bootstrapping→reconciling→live→…）经单一 observer 分发。
 *
 * 运行：NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx artifacts/sa7-issue420-fullround-hop-probe.mts
 */
import { decodeMessage } from '../packages/replication-protocol/src/index.ts';
import {
  advanceMs,
  boot,
  collectUnhandledRejections,
} from '../packages/ws-replication/test/driver.ts';
import { settle, settleUntil } from '../packages/ws-replication/test/harness.ts';
import {
  createShimHubForTesting,
  type ShimHub,
} from '../packages/ws-replication/test/issue420-shim-hub.ts';
import type { ReplicationObserverEvent } from '../packages/ws-replication/src/types.ts';

const results: Array<{ id: string; ok: boolean; detail: unknown }> = [];
function check(id: string, ok: boolean, detail: unknown): void {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
}

const unhandled = collectUnhandledRejections();
let shim: ShimHub | undefined;
const hubEvents: ReplicationObserverEvent[] = [];
const run = await boot({
  createHub: (options) => {
    shim = createShimHubForTesting(options);
    return shim.replication;
  },
  hubObserver: (event) => hubEvents.push(event),
});
if (shim === undefined) throw new Error('P2：shim 未创建');
const probes = shim.probes;

// ── R3：OPEN 准入（描述子跨缝 + authorize 单点） ──
const descriptor = probes.openInputs[0];
check(
  'R3.descriptor.observed',
  descriptor !== undefined &&
    descriptor.namespaceId === run.nsId &&
    typeof descriptor.connectionKey === 'string' &&
    descriptor.connectionKey.length > 0 &&
    typeof descriptor.selectedCapabilities === 'number' &&
    descriptor.authorization.ok === true,
  descriptor,
);
check('R3.authorize.exactlyOnce', run.authorizer.calls.length === 1, run.authorizer.calls);
check('R3.openOk.exactlyOne', run.hubFrames('OPEN_OK').length === 1, run.hubFrames('OPEN_OK').length);
check('R3.publicSession.exactlyOne', probes.sessionsOpened === 1, probes.sessionsOpened);

// ── R1：入站跳点（wire 序透传；OPEN 中继序 = 合成 0） ──
const seamInKinds = probes.seamFramesIn.map((f) => `${f.kind}#${f.sequence}`);
const wireP2HKinds = run.frames().peerToHub.map((f) => `${f.message.kind}#${f.header.sequence}`);
check(
  'R1.inbound.seamMirrorsWire',
  probes.seamFramesIn
    .filter((f) => f.kind !== 'OPEN_NAMESPACE')
    .every((f) =>
      run
        .frames()
        .peerToHub.some((w) => w.message.kind === f.kind && w.header.sequence === f.sequence),
    ),
  { seamInKinds, wireP2HKinds },
);
check(
  'R1.inbound.openRelaySyntheticZero',
  probes.seamFramesIn
    .filter((f) => f.kind === 'OPEN_NAMESPACE')
    .every((f) => f.sequence === 0),
  probes.seamFramesIn.filter((f) => f.kind === 'OPEN_NAMESPACE').map((f) => f.sequence),
);

// ── R2：出站跳点（占位 0 + 返回序逐帧对账） ──
check(
  'R2.outbound.placeholderZero',
  probes.seamFramesOut.length > 0 && probes.seamFramesOut.every((f) => f.placeholderSequence === 0),
  {
    frames: probes.seamFramesOut.length,
    lanes: probes.seamFramesOut.map((f) => f.lane),
  },
);
// edge 自身的连接级帧（HELLO_ACK/GOAWAY 等）不经 session 缝——剔除后逐帧对账。
const EDGE_LEVEL_KINDS = new Set(['HELLO_ACK', 'GOAWAY', 'IDENTITY_CHANGED']);
const sessionOriginatedWireSeqs = run
  .frames()
  .hubToPeer.filter((f) => !EDGE_LEVEL_KINDS.has(f.message.kind))
  .map((f) => f.header.sequence);
check(
  'R2.returnPath.sinkReturnsMatchWireSequences',
  JSON.stringify(probes.sinkReturns) === JSON.stringify(sessionOriginatedWireSeqs),
  { sinkReturns: probes.sinkReturns, sessionOriginatedWireSeqs },
);
check(
  'R2.returnPath.allPositive',
  probes.sinkReturns.length > 0 && probes.sinkReturns.every((n) => n > 0),
  probes.sinkReturns,
);

// ── R6 + 状态机：通道 FSM 边序列（hub 侧 observer；按需重算——事件数组持续增长） ──
const edgesNow = (): string[] =>
  hubEvents.flatMap((event) =>
    event.type === 'channel-state-changed' && event.side === 'hub'
      ? [`${event.from}→${event.to}`]
      : [],
  );
check(
  'FSM.edges.liveReached',
  edgesNow().some((e) => e.endsWith('→live')),
  edgesNow(),
);
check(
  'FSM.noResyncNoFatal',
  !hubEvents.some((e) => e.type === 'resync-required') &&
    !hubEvents.some((e) => e.type === 'connection-failed'),
  hubEvents.filter((e) => e.type === 'resync-required' || e.type === 'connection-failed').length,
);

// ── live 双向（R1/R2 持续承重） ──
await run.writePeer({ n: 7, extra: 5 });
await run.writeHub({ n: 43 });
await settle();
const peerUpdates = run.peerFrames('UPDATE');
const hubAcks = run.hubFrames('UPDATE_ACK');
check(
  'live.peerToHub.ackedWireSequence',
  peerUpdates.length >= 1 &&
    hubAcks.some((a) => (a.message as { ackedSequence: number }).ackedSequence === peerUpdates[0]?.header.sequence),
  {
    peerUpdateSeq: peerUpdates[0]?.header.sequence,
    hubAckAcked: hubAcks.map((a) => (a.message as { ackedSequence: number }).ackedSequence),
  },
);
const hubUpdates = run.hubFrames('UPDATE');
const peerAcks = run.peerFrames('UPDATE_ACK');
check(
  'live.hubToPeer.ackedWireSequence',
  hubUpdates.length >= 1 &&
    peerAcks.some((a) => (a.message as { ackedSequence: number }).ackedSequence === hubUpdates[hubUpdates.length - 1]?.header.sequence),
  {
    hubUpdateSeq: hubUpdates[hubUpdates.length - 1]?.header.sequence,
    peerAckAcked: peerAcks.map((a) => (a.message as { ackedSequence: number }).ackedSequence),
  },
);
check(
  'live.updateAckedEvent.present',
  hubEvents.some((e) => e.type === 'update-acked'),
  hubEvents.filter((e) => e.type === 'update-acked').length,
);

// ── R4 + R5：CLOSE → settled 恰 1 → close 幂等 drain ──
// （authorized 相位再 OPEN 的路由观测在 P3 探针独立场景执行——同矩阵 :212/:240 驱动形态：
//   注入的重复 OPEN 只断言 hub 侧应答；peer 侧对未请求 OPEN_OK 的反应不属本缝验收面。）
const pendingBefore = run.hubNode.scheduler.pending();
await run.peer.removeTarget(run.nsId);
await settleUntil(() => run.hubFrames('CLOSE_OK').length >= 1, 'CLOSE_OK');
await settle();
const closeOks = run.hubFrames('CLOSE_OK');
const closeReq = run.peerFrames('CLOSE_NAMESPACE');
check(
  'R4.closeOk.acksInboundWireSequence',
  closeOks.length === 1 &&
    (closeOks[0]?.message as { ackedSequence: number }).ackedSequence === closeReq[0]?.header.sequence,
  {
    closeReqSeq: closeReq[0]?.header.sequence,
    closeOkAcked: (closeOks[0]?.message as { ackedSequence: number }).ackedSequence,
  },
);
const settledSignals = probes.signals.filter((s) => s.type === 'settled');
check(
  'R4.settled.exactlyOnce',
  settledSignals.length === 1 && settledSignals[0]?.namespaceId === run.nsId,
  settledSignals,
);
check(
  'R4.terminalEdge.observed',
  edgesNow().some((e) => e.endsWith('→closed')),
  edgesNow(),
);

// wire 引用先取（hub.close 后 peer 可能重拨出新 wire——run.wire 会指向新线）。
const wire = run.wire;
const firstClose = run.hub.close();
const secondClose = run.hub.close();
check('R5.close.idempotentSamePromise', firstClose === secondClose, firstClose === secondClose);
await firstClose;
await settle();
check('R5.close.resolves', true, undefined);
check('R5.wire.closed1001', wire.peerSideCloseInfo?.code === 1001, wire.peerSideCloseInfo);
check(
  'R5.scheduler.noTimerGrowth',
  run.hubNode.scheduler.pending() <= pendingBefore,
  { before: pendingBefore, after: run.hubNode.scheduler.pending() },
);
const framesAfterClose = wire.hubToPeer.length;
await advanceMs(run, 30_000);
check(
  'R5.noResidualTimerFrames',
  wire.hubToPeer.length === framesAfterClose,
  { before: framesAfterClose, after: wire.hubToPeer.length },
);
check('R5.unhandled.empty', unhandled.events.length === 0, [...unhandled.events]);

// ── 汇总跳点清单（报告用） ──
console.log('── hop dump ──');
console.log(`seamFramesIn  = ${JSON.stringify(seamInKinds)}`);
console.log(`seamFramesOut = ${probes.seamFramesOut.length} 帧（lane: ${probes.seamFramesOut.map((f) => f.lane).join(',')})`);
console.log(`sinkReturns   = ${JSON.stringify(probes.sinkReturns)}`);
console.log(`sessionWireSeq= ${JSON.stringify(sessionOriginatedWireSeqs)}`);
console.log(`hubWireSeqs   = ${JSON.stringify(wire.hubToPeer.map((bytes) => { const d = decodeMessage(bytes); return `${d.message.kind}#${d.header.sequence}`; }))}`);
console.log(`channelEdges  = ${JSON.stringify(edgesNow())}`);
console.log(`signals       = ${JSON.stringify(probes.signals)}`);

unhandled.dispose();
const failed = results.filter((r) => !r.ok);
console.log(
  `PROBE_RESULT ${results.length - failed.length}/${results.length} passed; full-round hops ${failed.length === 0 ? 'ALL OBSERVED AS DESIGNED' : 'DIVERGENT'}`,
);
if (failed.length > 0) process.exitCode = 1;
