/**
 * SA7 issue #420 —— P1：载体提交（carrier commit）A/B 动态对照（listen vs shim）。
 *
 * 验证对象（SA3 Deviations §1 / SA4-O1 / SA8 impl 复查行 11 裁决的「已评审载体提交读法」）：
 * 相位 `routing` 期间到达的**非 OPEN** ns 域帧被立即提交给生产 splice（denialSink 直连真 port），
 * 违例应答由零 diff 通道状态机在同一到达点产出；迟归的 authorized 续体放弃（不 open() 公共句柄）。
 *
 * 方法：同一 driver、同一 Registry/Runtime fixture、同一注入序（镜像 ac7-faults 首用例），
 * 唯一变量 = hub 装配（listen 单体 vs shim = 真 edge + 宿主桥 + 公共工厂）。观察：
 *   A. 门闩悬挂期注入 UPDATE（OPEN_OK 之前）→ 两臂 wire 均立即出现 NAMESPACE_STATE_VIOLATION；
 *   B. release 后 → 两臂 wire 帧零增长（迟归续体零额外输出）；
 *   C. 计时器冲刷（advanceMs 30s）后 → 仍零增长（无残留 timer 召回出帧）；
 *   D. 两臂 wire 时间线（方向 + 原字节 hex）逐字节相等（载体提交与 listen 逐字节同构）；
 *   E. shim 臂：carrierCommitted=1、sessionsOpened=0、authorize 恒恰 1、零 unhandled rejection。
 *
 * 运行：NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx artifacts/sa7-issue420-carrier-commit-ab-probe.mts
 */
import { decodeMessage } from '../packages/replication-protocol/src/index.ts';
import {
  advanceMs,
  boot,
  collectUnhandledRejections,
} from '../packages/ws-replication/test/driver.ts';
import { settle } from '../packages/ws-replication/test/harness.ts';
import {
  createShimHubForTesting,
  type ShimHub,
} from '../packages/ws-replication/test/issue420-shim-hub.ts';
import { HUB_OWNER } from '../packages/ws-replication/test/harness.ts';

interface Snapshot {
  readonly timeline: string[]; // `${direction}:${hex}`（跨方向统一发送时间序）
  readonly peerToHub: number;
  readonly hubToPeer: number;
}

function snapshotOf(run: Awaited<ReturnType<typeof boot>>): Snapshot {
  const wire = run.wire;
  return {
    timeline: wire.timeline.map(
      (entry) => `${entry.direction}:${Buffer.from(entry.bytes).toString('hex')}`,
    ),
    peerToHub: wire.peerToHub.length,
    hubToPeer: wire.hubToPeer.length,
  };
}

function timelineKinds(run: Awaited<ReturnType<typeof boot>>): string[] {
  return run.wire.timeline.map((entry) => {
    const decoded = decodeMessage(entry.bytes);
    const extra =
      decoded.message.kind === 'ERROR' ? `(${(decoded.message as { code: string }).code})` : '';
    return `${entry.direction}:${decoded.message.kind}${extra}#${decoded.header.sequence}`;
  });
}

const results: Array<{ id: string; ok: boolean; detail: unknown }> = [];
function check(id: string, ok: boolean, detail: unknown): void {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
}

/** 确定性随机（两臂同种子 ⇒ HELLO challenge nonce 一致——排除与装配无关的随机字节差异）。 */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/** 单臂场景（与 ac7-faults 首用例同构：第一个 authorize 调用悬停于门闩）。 */
async function scenarioLatched(mode: 'listen' | 'shim') {
  const unhandled = collectUnhandledRejections();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  let shim: ShimHub | undefined;
  const run = await boot({
    start: false,
    random: seededRandom(0x420420),
    authorize: async () => {
      calls += 1;
      if (calls === 1) await gate;
      return { ok: true, localOwner: HUB_OWNER, permissions: { read: true, submit: true } };
    },
    ...(mode === 'shim'
      ? {
          createHub: (options: Parameters<typeof createShimHubForTesting>[0]) => {
            shim = createShimHubForTesting(options);
            return shim.replication;
          },
        }
      : {}),
  });
  run.peer.start();
  await settle();
  const authAtOpen = run.authorizer.calls.length;

  run.injectPeer({ kind: 'UPDATE', namespaceId: run.nsId, update: new Uint8Array([1, 2, 3]) });
  await settle();
  const atViolation = snapshotOf(run);
  const violationKinds = timelineKinds(run);

  release();
  await settle();
  const atRelease = snapshotOf(run);
  await advanceMs(run, 30_000);
  await settle();
  const afterTimers = snapshotOf(run);

  const authorizeTotal = run.authorizer.calls.length;
  await run.hub.close();
  await settle();
  const unhandledEvents = [...unhandled.events];
  unhandled.dispose();

  return {
    mode,
    authAtOpen,
    authorizeTotal,
    atViolation,
    violationKinds,
    atRelease,
    afterTimers,
    closeInfo: run.wire.peerSideCloseInfo,
    unhandled: unhandledEvents,
    probes:
      shim === undefined
        ? undefined
        : {
            carrierCommitted: shim.probes.carrierCommitted,
            denialRouted: shim.probes.denialRouted,
            sessionsOpened: shim.probes.sessionsOpened,
            reopenForwarded: shim.probes.reopenForwarded,
            pendingFlushed: shim.probes.pendingFlushed,
            pendingOverflow: shim.probes.pendingOverflow,
            signals: shim.probes.signals,
          },
  };
}

const listen = await scenarioLatched('listen');
const shimRes = await scenarioLatched('shim');

// ── 断言族 ──
for (const arm of [listen, shimRes]) {
  check(
    `${arm.mode}.authorize.exactlyOnce`,
    arm.authAtOpen === 1 && arm.authorizeTotal === 1,
    { atOpen: arm.authAtOpen, total: arm.authorizeTotal },
  );
  check(
    `${arm.mode}.violation.immediate`,
    arm.violationKinds.some((k) => k.includes('hub-to-peer:ERROR(NAMESPACE_STATE_VIOLATION)')),
    arm.violationKinds,
  );
  check(
    `${arm.mode}.release.zeroNewFrames`,
    arm.atRelease.timeline.length === arm.atViolation.timeline.length,
    { before: arm.atViolation.timeline.length, after: arm.atRelease.timeline.length },
  );
  check(
    `${arm.mode}.timers.zeroNewFrames`,
    arm.afterTimers.timeline.length === arm.atRelease.timeline.length,
    { before: arm.atRelease.timeline.length, after: arm.afterTimers.timeline.length },
  );
  check(`${arm.mode}.unhandled.empty`, arm.unhandled.length === 0, arm.unhandled);
}

check(
  'AB.timeline.byteIdentical.atViolation',
  JSON.stringify(listen.atViolation.timeline) === JSON.stringify(shimRes.atViolation.timeline),
  {
    listen: listen.atViolation.timeline,
    shim: shimRes.atViolation.timeline,
  },
);
check(
  'AB.timeline.byteIdentical.atRelease',
  JSON.stringify(listen.atRelease.timeline) === JSON.stringify(shimRes.atRelease.timeline),
  { listenFrames: listen.atRelease.timeline.length, shimFrames: shimRes.atRelease.timeline.length },
);
check(
  'AB.timeline.byteIdentical.afterTimers',
  JSON.stringify(listen.afterTimers.timeline) === JSON.stringify(shimRes.afterTimers.timeline),
  { listenFrames: listen.afterTimers.timeline.length, shimFrames: shimRes.afterTimers.timeline.length },
);

if (shimRes.probes !== undefined) {
  const p = shimRes.probes;
  check('shim.carrierCommitted.exactly1', p.carrierCommitted === 1, p.carrierCommitted);
  check('shim.sessionsOpened.zero', p.sessionsOpened === 0, p.sessionsOpened);
  check('shim.denialRouted.zero', p.denialRouted === 0, p.denialRouted);
  check('shim.pendingFlushed.zero', p.pendingFlushed === 0, p.pendingFlushed);
  check('shim.pendingOverflow.zero', p.pendingOverflow === 0, p.pendingOverflow);
  check(
    'shim.signals.noFatal',
    p.signals.every((s) => s.type !== 'connection-fatal'),
    p.signals,
  );
} else {
  check('shim.probes.present', false, 'shim 探针缺失');
}

const failed = results.filter((r) => !r.ok);
console.log(
  `PROBE_RESULT ${results.length - failed.length}/${results.length} passed; carrier-commit A/B ${failed.length === 0 ? 'EQUIVALENT (listen ≡ shim, byte-for-byte)' : 'DIVERGENT'}`,
);
if (failed.length > 0) process.exitCode = 1;
