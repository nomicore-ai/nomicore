/**
 * SA7 issue #420 —— P3：错误路径 / 清理时序 / 桥路由相位状态机动态观测（shim 装配）。
 *
 * 场景族（设计 §8.1 路由相位投影 + §9 E2/E4/E6/E7 + R3b）：
 *   S1 (E2)：缝完整性破坏——garbage 字节经公共 handleFrame → connection-fatal{MALFORMED_FRAME}
 *            信号 → 真 edge ERROR + close(1002)；零 unhandled。
 *   S2 (R3b/routing→authorized)：授权门闩悬挂期第二个 OPEN 入有界 pending 窗口 → release →
 *            续体同步段冲刷 → OPEN_OK×2（openWaiters 合流）；sessionsOpened 恒 1（不重复 open）；
 *            authorize 恒 1；pendingFlushed=1；零 unhandled。
 *   S3 (E4)：routing 相位 OPEN 洪水——第 18 个 OPEN 触发 pending 溢出 →
 *            CONNECTION_POLICY_VIOLATION + close(1008)；pendingOverflow=1；零 unhandled。
 *   S4 (E6)：onSignal 监听者 throw 的隔离——throwing listener 在场时 CLOSE 回合不受影响
 *            （CLOSE_OK 回指 + settled 仍转发 edge + close drain resolve）。
 *   S5 (R3b/authorized 相位)：live 后重复 OPEN → 分支 ① 句柄转发（不重入 open()）→
 *            OPEN_OK×2 + reopenForwarded=1 + sessionsOpened 恒 1 + authorize 恒 1。
 *
 * 运行：NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx artifacts/sa7-issue420-error-cleanup-probe.mts
 */
import {
  boot,
  collectUnhandledRejections,
} from '../packages/ws-replication/test/driver.ts';
import { settle, settleUntil, HUB_OWNER } from '../packages/ws-replication/test/harness.ts';
import {
  createShimHubForTesting,
  type ShimHub,
} from '../packages/ws-replication/test/issue420-shim-hub.ts';

const results: Array<{ id: string; ok: boolean; detail: unknown }> = [];
function check(id: string, ok: boolean, detail: unknown): void {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${JSON.stringify(detail)}`);
}

function errorCodesOf(run: Awaited<ReturnType<typeof boot>>): string[] {
  return run
    .hubFrames('ERROR')
    .map((f) => (f.message as { code: string }).code);
}

async function bootShim(options: Parameters<typeof boot>[0] = {}): Promise<{
  run: Awaited<ReturnType<typeof boot>>;
  shim: ShimHub;
}> {
  let shim: ShimHub | undefined;
  const run = await boot({
    ...options,
    createHub: (opts) => {
      shim = createShimHubForTesting(opts);
      return (shim as ShimHub).replication;
    },
  });
  if (shim === undefined) throw new Error('P3：shim 未创建');
  return { run, shim };
}

// ═══════════ S1（E2）：garbage/违例字节过公共 handleFrame ═══════════
// 设计 E2 = `connection-fatal{code: err.code ?? 'MALFORMED_FRAME'}`：codec 错误码原样传播；
// 两臂分别观察「codec 码在场」（BAD_MAGIC——magic 失配）与在册 MALFORMED_FRAME（reserved≠0）。
{
  const unhandled = collectUnhandledRejections();
  const { run, shim } = await bootShim();
  const handle = shim.probes.handles.get(run.nsId);
  if (handle === undefined) throw new Error('S1：公共句柄未观测到');
  const fatalSignals: Array<{ code: string }> = [];
  handle.onSignal((signal) => {
    if (signal.type === 'connection-fatal') fatalSignals.push({ code: signal.code });
  });
  // 臂 A：magic 失配 → codec 码 BAD_MAGIC 原样传播。
  handle.handleFrame(new Uint8Array([0xff, 0xfe, 0xfd, 0xfc, 0x00, 0x01, 0x02]));
  await settle();
  check('S1.E2a.codecCodePropagates', fatalSignals.some((s) => s.code === 'BAD_MAGIC'), fatalSignals);
  check(
    'S1.E2a.wireLoudClose',
    run.wire.peerSideCloseInfo !== undefined && run.wire.peerSideCloseInfo.code === 1002,
    run.wire.peerSideCloseInfo,
  );
  check('S1.unhandled.empty.armA', unhandled.events.length === 0, [...unhandled.events]);
  await run.hub.close();
  await settle();
  unhandled.dispose();
}
{
  const unhandled = collectUnhandledRejections();
  const { run, shim } = await bootShim();
  const handle = shim.probes.handles.get(run.nsId);
  if (handle === undefined) throw new Error('S1：公共句柄未观测到（臂 B）');
  const fatalSignals: Array<{ code: string }> = [];
  handle.onSignal((signal) => {
    if (signal.type === 'connection-fatal') fatalSignals.push({ code: signal.code });
  });
  // 臂 B：合法 magic/flags 但 reserved≠0（envelope 检查序第 5 步，offset 16）→ MALFORMED_FRAME。
  const frame = await import('../packages/replication-protocol/src/index.ts').then((m) =>
    m.encodeMessage(
      { kind: 'CLOSE_NAMESPACE', namespaceId: run.nsId, reasonCode: 'client-close' },
      { sequence: 2 },
    ),
  );
  const corrupted = frame.slice();
  corrupted[16] = 0x01; // reserved ≠ 0
  handle.handleFrame(corrupted);
  await settle();
  check(
    'S1.E2b.malformedFrameCode',
    fatalSignals.some((s) => s.code === 'MALFORMED_FRAME'),
    fatalSignals,
  );
  check(
    'S1.E2b.wireLoudClose',
    run.wire.peerSideCloseInfo !== undefined && run.wire.peerSideCloseInfo.code === 1002,
    run.wire.peerSideCloseInfo,
  );
  check('S1.unhandled.empty.armB', unhandled.events.length === 0, [...unhandled.events]);
  await run.hub.close();
  await settle();
  unhandled.dispose();
}

// ═══════════ S2（R3b/routing→authorized）：在途 OPEN 入窗 → 冲刷 ═══════════
{
  const unhandled = collectUnhandledRejections();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const { run, shim } = await bootShim({
    start: false,
    authorize: async () => {
      calls += 1;
      if (calls === 1) await gate;
      return { ok: true, localOwner: HUB_OWNER, permissions: { read: true, submit: true } };
    },
  });
  run.peer.start();
  await settle();
  // 第二个 OPEN（在途）：入有界 pending 窗口（分支 ②）。
  run.injectPeer({ kind: 'OPEN_NAMESPACE', namespaceId: run.nsId, hasLocalReplica: false });
  await settle();
  check('S2.pendingBeforeRelease.noOpenOkYet', run.hubFrames('OPEN_OK').length === 0, 0);
  release();
  await settleUntil(() => run.hubFrames('OPEN_OK').length >= 2, 'OPEN_OK×2');
  await settle();
  check(
    'S2.routingToAuthorized.flushMergesOpenWaiters',
    run.hubFrames('OPEN_OK').length === 2 &&
      shim.probes.pendingFlushed === 1 &&
      shim.probes.reopenForwarded === 0 &&
      shim.probes.sessionsOpened === 1 &&
      run.authorizer.calls.length === 1,
    {
      openOk: run.hubFrames('OPEN_OK').length,
      pendingFlushed: shim.probes.pendingFlushed,
      reopenForwarded: shim.probes.reopenForwarded,
      sessionsOpened: shim.probes.sessionsOpened,
      authorize: run.authorizer.calls.length,
    },
  );
  check(
    'S2.noInternalErrorSignature',
    !shim.probes.signals.some((s) => s.type === 'connection-fatal'),
    shim.probes.signals,
  );
  check('S2.unhandled.empty', unhandled.events.length === 0, [...unhandled.events]);
  await run.hub.close();
  await settle();
  unhandled.dispose();
}

// ═══════════ S3（E4）：routing 相位 OPEN 洪水 → pending 溢出响亮收口 ═══════════
{
  const unhandled = collectUnhandledRejections();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const { run, shim } = await bootShim({
    start: false,
    authorize: async () => {
      calls += 1;
      if (calls === 1) await gate;
      return { ok: true, localOwner: HUB_OWNER, permissions: { read: true, submit: true } };
    },
  });
  run.peer.start();
  await settle();
  // 首 OPEN = firstOpen（route 建立）；OPEN #2..#17 = 16 条 pending（界内）；#18 = 溢出。
  for (let i = 2; i <= 18; i += 1) {
    run.injectPeer({ kind: 'OPEN_NAMESPACE', namespaceId: run.nsId, hasLocalReplica: false });
  }
  await settle();
  check(
    'S3.E4.overflowLoudClosure',
    shim.probes.pendingOverflow === 1 &&
      errorCodesOf(run).includes('CONNECTION_POLICY_VIOLATION') &&
      run.wire.peerSideCloseInfo?.code === 1008,
    {
      pendingOverflow: shim.probes.pendingOverflow,
      errors: errorCodesOf(run),
      closeInfo: run.wire.peerSideCloseInfo,
    },
  );
  release();
  await settle();
  // closed 守卫：在途 routing 续体放弃——零可观察输出（不 open()、零 INTERNAL_ERROR、零新帧）。
  const framesAfterRelease = run.wire.hubToPeer.length;
  check(
    'S3.closedGuard.abandonsInFlightRouting',
    shim.probes.sessionsOpened === 0 &&
      !shim.probes.signals.some((s) => s.type === 'connection-fatal') &&
      run.wire.hubToPeer.length === framesAfterRelease,
    {
      sessionsOpened: shim.probes.sessionsOpened,
      signals: shim.probes.signals,
      hubFramesAfterRelease: framesAfterRelease,
    },
  );
  check('S3.unhandled.empty', unhandled.events.length === 0, [...unhandled.events]);
  await run.hub.close();
  await settle();
  unhandled.dispose();
}

// ═══════════ S4（E6）：onSignal 监听者 throw 隔离 ═══════════
{
  const unhandled = collectUnhandledRejections();
  const { run, shim } = await bootShim();
  const handle = shim.probes.handles.get(run.nsId);
  if (handle === undefined) throw new Error('S4：公共句柄未观测到');
  let threw = 0;
  handle.onSignal(() => {
    threw += 1;
    throw new Error('S4：敌意信号监听者');
  });
  await run.peer.removeTarget(run.nsId);
  await settleUntil(() => run.hubFrames('CLOSE_OK').length >= 1, 'CLOSE_OK');
  await settle();
  const closeReq = run.peerFrames('CLOSE_NAMESPACE');
  const closeOks = run.hubFrames('CLOSE_OK');
  check(
    'S4.E6.protocolUnaffectedByThrowingListener',
    threw > 0 &&
      closeOks.length === 1 &&
      (closeOks[0]?.message as { ackedSequence: number }).ackedSequence ===
        closeReq[0]?.header.sequence &&
      shim.probes.signals.some((s) => s.type === 'settled'),
    {
      listenerThrows: threw,
      closeOkAcked: (closeOks[0]?.message as { ackedSequence: number }).ackedSequence,
      closeReqSeq: closeReq[0]?.header.sequence,
      settledForwarded: shim.probes.signals.some((s) => s.type === 'settled'),
    },
  );
  const firstClose = run.hub.close();
  await firstClose;
  await settle();
  check('S4.drain.resolvesDespiteThrowingListener', true, undefined);
  check('S4.unhandled.empty', unhandled.events.length === 0, [...unhandled.events]);
  unhandled.dispose();
}

// ═══════════ S5（R3b/authorized 相位）：live 后重复 OPEN → 句柄转发 ═══════════
{
  const unhandled = collectUnhandledRejections();
  const { run, shim } = await bootShim();
  const openOkBefore = run.hubFrames('OPEN_OK').length;
  run.injectPeer({ kind: 'OPEN_NAMESPACE', namespaceId: run.nsId, hasLocalReplica: false });
  await settle();
  check(
    'S5.authorizedPhase.reopenForwarded',
    shim.probes.reopenForwarded === 1 &&
      shim.probes.sessionsOpened === 1 &&
      run.hubFrames('OPEN_OK').length === openOkBefore + 1 &&
      run.authorizer.calls.length === 1,
    {
      reopenForwarded: shim.probes.reopenForwarded,
      sessionsOpened: shim.probes.sessionsOpened,
      openOk: run.hubFrames('OPEN_OK').length,
      authorize: run.authorizer.calls.length,
    },
  );
  check(
    'S5.noFatal',
    !shim.probes.signals.some((s) => s.type === 'connection-fatal'),
    shim.probes.signals,
  );
  check('S5.unhandled.empty', unhandled.events.length === 0, [...unhandled.events]);
  await run.hub.close();
  await settle();
  unhandled.dispose();
}

const failed = results.filter((r) => !r.ok);
console.log(
  `PROBE_RESULT ${results.length - failed.length}/${results.length} passed; error/cleanup/state-machine ${failed.length === 0 ? 'ALL AS DESIGNED' : 'DIVERGENT'}`,
);
if (failed.length > 0) process.exitCode = 1;
