/**
 * SA6 issue #420 —— 宿主桥（内存管道）字节中继保真度探针。
 *
 * 目标形态：shim 组合里 edge→session 的入帧由宿主桥中继。当前 edge 缝面（#418）交的是
 * 「已解码消息 + wire 序」，字节入帧面（handleFrame）要求 Uint8Array ⟹ 桥必须把消息重新
 * 编码为帧字节。本探针验证该中继的**唯一前提**：对真实回合产生的每一帧，
 * `encode(decode(frame), {sequence: frame[8..12]})` 与原帧逐字节相等（canonical 往返）。
 *
 * 运行：NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx artifacts/sa6-issue420-bridge-relay-fidelity-probe.mts
 */
import { decodeMessage, encodeMessage } from '../packages/replication-protocol/src/index.ts';
import { advanceMs, boot } from '../packages/ws-replication/test/driver.ts';
import { settle } from '../packages/ws-replication/test/harness.ts';

const results: Array<{ id: string; ok: boolean; detail: unknown }> = [];
function check(id: string, ok: boolean, detail: unknown): void {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${JSON.stringify(detail)}`);
}
function hexOf(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

const run = await boot();
await run.writePeer({ n: 7 });
await run.writeHub({ n: 43 });
await advanceMs(run, 40);
await settle();
await run.hub.close();
await settle();

const NAMESPACE_DOMAIN = new Set([
  'OPEN_NAMESPACE',
  'OPEN_OK',
  'BOOTSTRAP_SNAPSHOT',
  'BOOTSTRAP_ACK',
  'SYNC_STEP1',
  'SYNC_STEP2',
  'SYNC_APPLIED',
  'UPDATE',
  'UPDATE_ACK',
  'UPDATE_CHUNK',
  'CLOSE_NAMESPACE',
  'CLOSE_OK',
  'RESYNC_REQUIRED',
  'IDENTITY_CHANGED',
]);

for (const [direction, frames] of [
  ['peerToHub', run.wire.peerToHub],
  ['hubToPeer', run.wire.hubToPeer],
] as const) {
  let total = 0;
  let mismatches = 0;
  const kindsSeen = new Set<string>();
  for (const frame of frames) {
    const decoded = decodeMessage(frame);
    if (!NAMESPACE_DOMAIN.has(decoded.message.kind)) continue;
    total += 1;
    kindsSeen.add(decoded.message.kind);
    const relayed = encodeMessage(decoded.message, { sequence: decoded.header.sequence });
    if (hexOf(relayed) !== hexOf(frame)) mismatches += 1;
  }
  check(`relayFidelity.${direction}`, total > 0 && mismatches === 0, {
    namespaceDomainFrames: total,
    mismatches,
    kinds: [...kindsSeen].sort(),
  });
}

const failed = results.filter((r) => !r.ok);
console.log(
  `PROBE_RESULT ${results.length - failed.length}/${results.length} passed; decoded→bytes relay ${
    failed.length === 0 ? 'BYTE-FAITHFUL for namespace-domain frames (bridge relay premise holds)' : 'PROBE SELF-FAILURE'
  }`,
);
if (failed.length > 0) process.exitCode = 1;
