/**
 * SA6 issue #420 —— 因果探针：缝上「出站帧的被分配 wire 序」是**承重**事实，
 * 公共同步字节缝必须把它从宿主 pipe 回传给 session（否则协议回合响亮中断）。
 *
 * 控制变量：同一真实 Registry/Runtime fixture + 同一零 diff 通道；唯一变量 = stub edge port
 * 的 send*Frame 返回值（0 = 无回传 / 递增 = 有回传）。观察点全在运行时行为：
 *   A. control 面无回传：BOOTSTRAP_ACK（对端视图序）→ 真实通道 connectionFatal
 *      ACK_STATE_VIOLATION（bootstrap 永不结算）。
 *   B. control 面有回传：同输入 → 通道 bootstrapping→reconciling（回合继续）。
 *   C. data 面无回传（control 有回传）：live 期 hub 侧真实写 → UPDATE 发送路径返回 0
 *      → UpdateChannel 判 send-frame-rejected → RESYNC_REQUIRED{send-failed}（响亮）。
 *   D. data 面有回传：同输入 → UPDATE 出站（帧头 [8..12] 仍为 0 占位）+ 回传序被记账
 *      → 对端 UPDATE_ACK(该序) 结算在途条目（update-acked），无 resync。
 *
 * 运行：NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx artifacts/sa6-issue420-causality-probe.mts
 */
import { decodeMessage, encodeMessage } from '../packages/replication-protocol/src/index.ts';
import type { ReplicationMessage } from '../packages/replication-protocol/src/index.ts';
import { createHubSessionHost } from '../packages/ws-replication/src/hub-session.ts';
import { resolveLimits, resolveTimeouts } from '../packages/ws-replication/src/defaults.ts';
import {
  HUB_INSTANCE,
  HUB_OWNER,
  PEER_INSTANCE,
  makeHubNamespace,
  makeNode,
  settle,
  settleUntil,
} from '../packages/ws-replication/test/harness.ts';

const AUTHORIZED = {
  ok: true as const,
  localOwner: HUB_OWNER,
  permissions: { read: true, submit: true },
};

function rawSequence(bytes: Uint8Array): number {
  return (((bytes[8]! << 24) | (bytes[9]! << 16) | (bytes[10]! << 8) | bytes[11]!) >>> 0);
}
function kindsOf(frames: readonly Uint8Array[]): string[] {
  return frames.map((bytes) => decodeMessage(bytes).message.kind);
}

interface PortOptions {
  readonly controlStamp: boolean;
  readonly dataStamp: boolean;
}
function makePort(opts: PortOptions) {
  let seq = 0;
  const control: Uint8Array[] = [];
  const data: Uint8Array[] = [];
  const entries: Array<{ kind: string; lane: 'control' | 'data'; sequence: number }> = [];
  const fatal: Array<{ code: string; wsCloseCode: number | undefined }> = [];
  const settled: string[] = [];
  const events: Array<{ type: string; cause?: string; reason?: string }> = [];
  const port = {
    openAdmission: () => Promise.resolve({ outcome: 'authorized' as const, authorization: AUTHORIZED }),
    sendControlFrame(frame: Uint8Array): number {
      control.push(frame);
      if (!opts.controlStamp) return 0;
      seq += 1;
      entries.push({ kind: decodeMessage(frame).message.kind, lane: 'control', sequence: seq });
      return seq;
    },
    sendDataFrame(frame: Uint8Array): number {
      data.push(frame);
      if (!opts.dataStamp) return 0;
      seq += 1;
      entries.push({ kind: decodeMessage(frame).message.kind, lane: 'data', sequence: seq });
      return seq;
    },
    dataGateOpen: () => true,
    onDataQueued: () => undefined,
    requestDataDrain: () => undefined,
    chunkedUpdateNegotiated: () => false,
    connectionFatal: (code: string, wsCloseCode?: number) => {
      fatal.push({ code, wsCloseCode });
    },
    onChannelSettled: (namespaceId: string) => {
      settled.push(namespaceId);
    },
    tryBeginInboundAssembly: () => true,
    endInboundAssembly: () => undefined,
    observerPresent: () => true,
    emitObserver: (event: { type: string; cause?: string; reason?: string }) => {
      events.push(event);
    },
    connectionId: () => 'stub-conn-0',
    connectionState: () => 'ready' as const,
    bufferedAmount: () => 0,
    now: () => 0,
  };
  return { port, control, data, entries, fatal, settled, events };
}

const results: Array<{ id: string; ok: boolean; detail: unknown }> = [];
function check(id: string, ok: boolean, detail: unknown): void {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${JSON.stringify(detail)}`);
}

async function makeHost(opts: PortOptions) {
  const node = makeNode('hub');
  const fixture = await makeHubNamespace(node);
  const stub = makePort(opts);
  const host = createHubSessionHost({
    port: stub.port as never,
    registry: node.registry,
    instanceId: HUB_INSTANCE,
    peerInstanceId: PEER_INSTANCE,
    timer: node.scheduler,
    limits: resolveLimits(undefined),
    timeouts: resolveTimeouts(undefined),
  });
  return { node, fixture, stub, host };
}

const openMsg = (namespaceId: string) => ({ kind: 'OPEN_NAMESPACE' as const, namespaceId, hasLocalReplica: false });
const emit = (host: ReturnType<typeof createHubSessionHost>, message: ReplicationMessage, sequence: number) =>
  host.namespaceFrame(message, sequence);

// ── 臂 A/B：control 面回传因果（bootstrap ACK 结算） ─────────────────────────────
for (const arm of ['A', 'B'] as const) {
  const controlStamp = arm === 'B';
  const { fixture, stub, host } = await makeHost({ controlStamp, dataStamp: controlStamp });
  host.openNamespace(openMsg(fixture.namespaceId));
  await settleUntil(() => kindsOf(stub.control).includes('BOOTSTRAP_SNAPSHOT'), `${arm} OPEN_OK + 快照`);
  const snapFrame = stub.control[kindsOf(stub.control).indexOf('BOOTSTRAP_SNAPSHOT')]!;
  const wireSeqOfSnapshot = 2; // 对端视图：OPEN_OK=1、BOOTSTRAP_SNAPSHOT=2
  check(`${arm}.placeholderHeaderIsZero`, rawSequence(snapFrame) === 0, { raw: rawSequence(snapFrame) });
  emit(host, { kind: 'BOOTSTRAP_ACK', namespaceId: fixture.namespaceId, ackedSequence: wireSeqOfSnapshot }, 2);
  await settle();
  const reachedReconciling = stub.events.some(
    (event) => event.type === 'channel-state-changed' && (event as { to?: string }).to === 'reconciling',
  );
  if (arm === 'A') {
    check('A.noStamp.connectionFatalACKStateViolation', stub.fatal.length === 1 && stub.fatal[0]!.code === 'ACK_STATE_VIOLATION', {
      fatal: stub.fatal,
      reachedReconciling,
    });
  } else {
    check('B.stamp.reconcileReached', stub.fatal.length === 0 && reachedReconciling, {
      fatal: stub.fatal,
      reachedReconciling,
    });
  }
}

// ── 臂 C/D：data 面回传因果（live 期真实写 → UPDATE 发送） ───────────────────────
async function reachLive(controlStamp: boolean, dataStamp: boolean) {
  const made = await makeHost({ controlStamp, dataStamp });
  const { fixture, stub, host } = made;
  host.openNamespace(openMsg(fixture.namespaceId));
  await settleUntil(() => kindsOf(stub.control).includes('BOOTSTRAP_SNAPSHOT'), 'OPEN_OK + 快照');
  emit(host, { kind: 'BOOTSTRAP_ACK', namespaceId: fixture.namespaceId, ackedSequence: 2 }, 2);
  await settleUntil(
    () => stub.events.some((event) => event.type === 'channel-state-changed' && (event as { to?: string }).to === 'reconciling'),
    'reconciling',
  );
  emit(host, { kind: 'SYNC_STEP1', namespaceId: fixture.namespaceId, syncRoundId: 1, stateVector: new Uint8Array([0]) }, 3);
  await settleUntil(() => kindsOf(stub.control).includes('SYNC_STEP2'), 'SYNC_STEP2 出站');
  const step2Frame = stub.control[kindsOf(stub.control).indexOf('SYNC_STEP2')]!;
  const step2 = decodeMessage(step2Frame, { sequence: 0 }).message;
  if (step2.kind !== 'SYNC_STEP2') throw new Error('探针：SYNC_STEP2 形态断言失败');
  const step1AssignedSeq = stub.entries.find((entry) => entry.kind === 'SYNC_STEP1')!.sequence;
  emit(
    host,
    { kind: 'SYNC_STEP2', namespaceId: fixture.namespaceId, syncRoundId: 1, relatedStep1Sequence: step1AssignedSeq, update: step2.update },
    4,
  );
  await settle();
  const step2AssignedSeq = stub.entries.find((entry) => entry.kind === 'SYNC_STEP2')!.sequence;
  emit(host, { kind: 'SYNC_APPLIED', namespaceId: fixture.namespaceId, syncRoundId: 1, ackedSequence: step2AssignedSeq }, 5);
  await settleUntil(
    () => stub.events.some((event) => event.type === 'channel-state-changed' && (event as { to?: string }).to === 'live'),
    'live',
  );
  return made;
}

for (const arm of ['C', 'D'] as const) {
  const dataStamp = arm === 'D';
  const { fixture, stub, host } = await reachLive(true, dataStamp);
  await fixture.lease.mutateData({ op: 'set', path: ['n'], value: 43 });
  await settle();
  await settleUntil(() => stub.data.length > 0 || stub.control.some((f) => decodeMessage(f).message.kind === 'RESYNC_REQUIRED'), `${arm} 发送路径结算`);
  const updateFrames = stub.data.filter((f) => decodeMessage(f).message.kind === 'UPDATE');
  const resyncFrames = stub.control.filter((f) => decodeMessage(f).message.kind === 'RESYNC_REQUIRED');
  if (arm === 'C') {
    // 帧字节确实出帧（stub 先记录后返回 0），但记账塌陷：通道判 send-frame-rejected 并响亮声明 resync
    check(
      'C.noDataStamp.sendFrameRejectedResync',
      updateFrames.length === 1 &&
        resyncFrames.length === 1 &&
        stub.events.some((e) => e.type === 'resync-required' && e.reason === 'send-frame-rejected'),
      {
        updateFrames: updateFrames.length,
        resyncFrames: resyncFrames.length,
        resyncEvents: stub.events.filter((e) => e.type === 'resync-required').map((e) => ({ cause: e.cause, reason: e.reason })),
      },
    );
  } else {
    check('D.dataStamp.updateSentAndAcked', updateFrames.length === 1 && resyncFrames.length === 0, {
      updateFrames: updateFrames.length,
      placeholderZero: rawSequence(updateFrames[0]!) === 0,
      resyncFrames: resyncFrames.length,
    });
    const assignedSeq = stub.entries.find((entry) => entry.kind === 'UPDATE' && entry.lane === 'data')!.sequence;
    emit(host, { kind: 'UPDATE_ACK', namespaceId: fixture.namespaceId, ackedSequence: assignedSeq }, 6);
    await settle();
    check(
      'D.updateAckMatchesLedger',
      stub.events.some((event) => event.type === 'update-acked'),
      { assignedSeq, acked: stub.events.filter((e) => e.type === 'update-acked') },
    );
  }
}

const failed = results.filter((r) => !r.ok);
console.log(
  `PROBE_RESULT ${results.length - failed.length}/${results.length} passed; seq-return ${
    failed.length === 0 ? 'LOAD-BEARING (0-return breaks round loudly; return propagates round)' : 'PROBE SELF-FAILURE'
  }`,
);
if (failed.length > 0) process.exitCode = 1;
