/**
 * SA6 issue #420 —— AC5（session 侧零入站 sequence 重检）证据探针。
 *
 * 同一类非法输入（非单调 sequence）在两半的**对照行为**：
 *   A. edge 半边（负控 = 唯一的 sequence 纪律执行点）：HELLO(seq1) → OPEN_NAMESPACE(seq3，期望 2)
 *      → 连接级 SEQUENCE_VIOLATION ERROR + close(1002,'protocol-error')，零缝投递（sink 零 open）。
 *   B. session 半边（零 diff 通道）：入站帧的 wire 序被**原样消费**——先按 3/4/5 走到 live，
 *      再以**回退序** 2 投递 CLOSE_NAMESPACE → 通道照常出 CLOSE_OK{ackedSequence: 2} 并 settled；
 *      若 session 侧重检 sequence（或向解码器传 expectedSequence），该帧必被拒（无 CLOSE_OK）。
 *
 * 运行：NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx artifacts/sa6-issue420-sequence-discipline-probe.mts
 */
import { decodeMessage, encodeMessage } from '../packages/replication-protocol/src/index.ts';
import type { ReplicationMessage } from '../packages/replication-protocol/src/index.ts';
import { createHubSessionHost } from '../packages/ws-replication/src/hub-session.ts';
import { createHubReplicationEdge } from '../packages/ws-replication/src/hub-edge.ts';
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

const AUTHORIZED = { ok: true as const, localOwner: HUB_OWNER, permissions: { read: true, submit: true } };
const results: Array<{ id: string; ok: boolean; detail: unknown }> = [];
function check(id: string, ok: boolean, detail: unknown): void {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${JSON.stringify(detail)}`);
}
function kindsOf(frames: readonly Uint8Array[]): string[] {
  return frames.map((bytes) => decodeMessage(bytes).message.kind);
}

// ── 臂 A：edge = sequence 纪律单点（负控） ────────────────────────────────────────
{
  const messageListeners = new Set<(bytes: Uint8Array) => void>();
  const outbound: Uint8Array[] = [];
  let closeInfo: { code: number; reason: string } | undefined;
  let closed = false;
  const transport = {
    send(bytes: Uint8Array) {
      if (!closed) outbound.push(bytes.slice());
    },
    close(code = 1000, reason = '') {
      if (closed) return;
      closed = true;
      closeInfo = { code, reason };
    },
    get closed() {
      return closed;
    },
    onMessage(listener: (bytes: Uint8Array) => void) {
      messageListeners.add(listener);
      return () => messageListeners.delete(listener);
    },
    onClose() {
      return () => undefined;
    },
  };
  const delivered: Array<{ kind: string; sequence: number }> = [];
  const edge = createHubReplicationEdge({
    transport: transport as never,
    timer: makeNode('hub').scheduler,
    limits: resolveLimits(undefined),
    timeouts: resolveTimeouts(undefined),
    instanceId: HUB_INSTANCE,
    peerInstanceId: PEER_INSTANCE,
    connectionCounter: 1,
    authorize: () => Promise.resolve(AUTHORIZED),
    earlyFrames: [],
    sessionFactory: () => ({
      openNamespace: (message: { namespaceId: string }) => delivered.push({ kind: 'OPEN_NAMESPACE', sequence: -1 }),
      namespaceFrame: (message: ReplicationMessage, sequence: number) => delivered.push({ kind: message.kind, sequence }),
      close: () => Promise.resolve(),
      terminateNamespace: () => Promise.resolve(),
      dataFacetOf: () => undefined,
      channels: new Map(),
    }),
    onConnectionDropped: () => undefined,
  } as never);
  const push = (message: ReplicationMessage, sequence: number) => {
    for (const listener of [...messageListeners]) listener(encodeMessage(message, { sequence }));
  };
  push(
    {
      kind: 'HELLO',
      peerInstanceId: PEER_INSTANCE,
      expectedHubInstanceId: HUB_INSTANCE,
      protocolVersions: [1],
      requiredCapabilities: 0,
      optionalCapabilities: 0,
      connectionNonce: new Uint8Array(16).fill(0x80),
    },
    1,
  );
  await settle();
  const nsId = `ns-${'0'.repeat(31)}a`;
  push({ kind: 'OPEN_NAMESPACE', namespaceId: nsId, hasLocalReplica: false }, 3); // 期望 2 → gap
  await settle();
  const errorFrame = outbound.find((frame) => decodeMessage(frame).message.kind === 'ERROR');
  const errorCode = errorFrame === undefined ? undefined : (decodeMessage(errorFrame).message as { code: string }).code;
  check('A.edgeRejectsNonMonotonicSequence', errorCode === 'SEQUENCE_VIOLATION' && closeInfo?.code === 1002, {
    errorCode,
    closeInfo,
    delivered,
    wireKinds: kindsOf(outbound),
  });
  edge.close(1001, 'probe-end');
  await edge.settle();
}

// ── 臂 B：session 原样消费 wire 序（无重检） ─────────────────────────────────────
{
  let seq = 0;
  const control: Uint8Array[] = [];
  const entries: Array<{ kind: string; sequence: number }> = [];
  const settledNs: string[] = [];
  const fatal: unknown[] = [];
  const events: Array<{ type: string; to?: string }> = [];
  const port = {
    openAdmission: () => Promise.resolve({ outcome: 'authorized' as const, authorization: AUTHORIZED }),
    sendControlFrame(frame: Uint8Array): number {
      control.push(frame);
      seq += 1;
      entries.push({ kind: decodeMessage(frame).message.kind, sequence: seq });
      return seq;
    },
    sendDataFrame(frame: Uint8Array): number {
      seq += 1;
      entries.push({ kind: decodeMessage(frame).message.kind, sequence: seq });
      void frame;
      return seq;
    },
    dataGateOpen: () => true,
    onDataQueued: () => undefined,
    requestDataDrain: () => undefined,
    chunkedUpdateNegotiated: () => false,
    connectionFatal: (code: string) => fatal.push(code),
    onChannelSettled: (namespaceId: string) => settledNs.push(namespaceId),
    tryBeginInboundAssembly: () => true,
    endInboundAssembly: () => undefined,
    observerPresent: () => true,
    emitObserver: (event: { type: string; to?: string }) => events.push(event),
    connectionId: () => 'stub-conn-0',
    connectionState: () => 'ready' as const,
    bufferedAmount: () => 0,
    now: () => 0,
  };
  const node = makeNode('hub');
  const fixture = await makeHubNamespace(node);
  const host = createHubSessionHost({
    port: port as never,
    registry: node.registry,
    instanceId: HUB_INSTANCE,
    peerInstanceId: PEER_INSTANCE,
    timer: node.scheduler,
    limits: resolveLimits(undefined),
    timeouts: resolveTimeouts(undefined),
  });
  const emit = (message: ReplicationMessage, sequence: number) => host.namespaceFrame(message, sequence);
  host.openNamespace({ kind: 'OPEN_NAMESPACE', namespaceId: fixture.namespaceId, hasLocalReplica: false });
  await settleUntil(() => kindsOf(control).includes('BOOTSTRAP_SNAPSHOT'), 'OPEN_OK + 快照');
  emit({ kind: 'BOOTSTRAP_ACK', namespaceId: fixture.namespaceId, ackedSequence: 2 }, 2);
  await settleUntil(() => events.some((event) => event.type === 'channel-state-changed' && event.to === 'reconciling'), 'reconciling');
  emit({ kind: 'SYNC_STEP1', namespaceId: fixture.namespaceId, syncRoundId: 1, stateVector: new Uint8Array([0]) }, 3);
  await settleUntil(() => kindsOf(control).includes('SYNC_STEP2'), 'SYNC_STEP2');
  const step2Frame = control[kindsOf(control).indexOf('SYNC_STEP2')]!;
  const step2 = decodeMessage(step2Frame).message;
  if (step2.kind !== 'SYNC_STEP2') throw new Error('探针：SYNC_STEP2 形态断言失败');
  emit(
    {
      kind: 'SYNC_STEP2',
      namespaceId: fixture.namespaceId,
      syncRoundId: 1,
      relatedStep1Sequence: entries.find((entry) => entry.kind === 'SYNC_STEP1')!.sequence,
      update: step2.update,
    },
    4,
  );
  await settle();
  emit(
    {
      kind: 'SYNC_APPLIED',
      namespaceId: fixture.namespaceId,
      syncRoundId: 1,
      ackedSequence: entries.find((entry) => entry.kind === 'SYNC_STEP2')!.sequence,
    },
    5,
  );
  await settleUntil(() => events.some((event) => event.type === 'channel-state-changed' && event.to === 'live'), 'live');
  // 回退序（2 < 已消费的 5）：session 半边原样消费、照常出 CLOSE_OK{ackedSequence: 2}
  emit({ kind: 'CLOSE_NAMESPACE', namespaceId: fixture.namespaceId, reasonCode: 'peer-close' }, 2);
  await settleUntil(() => kindsOf(control).includes('CLOSE_OK'), 'CLOSE_OK');
  const closeOk = control.map((frame) => decodeMessage(frame).message).find((message) => message.kind === 'CLOSE_OK');
  check(
    'B.sessionConsumesOutOfOrderSequenceWithoutRecheck',
    (closeOk as { ackedSequence?: number } | undefined)?.ackedSequence === 2 &&
      settledNs.length === 1 &&
      fatal.length === 0,
    { closeOk, settledNs, fatal },
  );
}

const failed = results.filter((r) => !r.ok);
console.log(
  `PROBE_RESULT ${results.length - failed.length}/${results.length} passed; sequence discipline = edge single point, session zero re-check ${
    failed.length === 0 ? 'CONFIRMED' : 'PROBE SELF-FAILURE'
  }`,
);
if (failed.length > 0) process.exitCode = 1;
