/**
 * SA6 issue #451 — ANCHOR-ORDER-C1 nondeterminism root-cause probe (minimal, re-runnable).
 *
 * Question: `ANCHOR-ORDER-C1` compares the by-type projection (`…, sequence, bytes`) of two
 * independent `bootFlowRound` boots with `toEqual`. The assertion is flaky (bytes 24 vs 27).
 * Hypothesis (SA3 §7.2): the live UPDATE payload length depends on the live Y.Doc `clientID`
 * varint width, and the clientID is drawn from an unseeded CSPRNG (`new Y.Doc()` →
 * `lib0/random.uint32()` → `crypto.getRandomValues`).
 *
 * This probe builds byte-identical namespace content twice while pinning `doc.clientID`:
 *   part 1 — length vs clientID varint width (same content, deterministic pinning)
 *   part 2 — same width / different width hex-level comparison + clientID byte occurrences
 *   part 3 — empirical clientID varint-width distribution and the induced pairwise mismatch rate
 *
 * Run: node artifacts/sa6-issue451-clientid-probe.mjs
 */
import { createRequire } from 'node:module';

const require = createRequire(new URL('../packages/ws-replication/package.json', import.meta.url));
const Y = require('yjs');

const widthOf = (n) => {
  let w = 0;
  let v = n;
  do {
    w += 1;
    v = Math.floor(v / 128);
  } while (v > 0);
  return w;
};

/** LEB128 (Yjs varuint) encoding of a clientID, as used inside update payloads. */
const leb128 = (n) => {
  const out = [];
  let v = n;
  for (;;) {
    const byte = v % 128;
    v = Math.floor(v / 128);
    if (v > 0) out.push(byte | 0x80);
    else {
      out.push(byte);
      break;
    }
  }
  return Uint8Array.from(out);
};

const hex = (u8) => Buffer.from(u8).toString('hex').replace(/(..)/g, '$1 ').trim();

/**
 * Build the live UPDATE exactly like the γ flow: create the namespace document content in one
 * transaction (doc-runtime `create-initial-document.ts:160` bare `new Y.Doc()` shape), capture the
 * post-create state vector (what the peer has after bootstrap), then diff the live write
 * (`replication-session.ts:474` `encodeStateAsUpdate(host.doc, remoteStateVector)`).
 */
function buildLiveUpdate(clientID) {
  const doc = new Y.Doc();
  doc.clientID = clientID;
  const schema = doc.getMap('SCHEMA');
  const meta = doc.getMap('META');
  const root = doc.getMap('ROOT');
  doc.transact(() => {
    schema.set('id', 'ns-451');
    meta.set('docId', 'ns-451');
    meta.set('createdAt', '2026-09-22T00:00:00.000Z');
    root.set('n', 42);
  });
  const svAfterCreate = Y.encodeStateVector(doc);
  root.set('n', 43); // the live write under test (`run.writeHub({ n: 43 })`)
  const live = Y.encodeStateAsUpdate(doc, svAfterCreate);
  return { live, svAfterCreate };
}

console.log('## part 1 — pinned clientID → live UPDATE byte length (identical content)');
const widthClasses = [42, 127, 128, 16_383, 16_384, 2_097_151, 2_097_152, 268_435_455, 268_435_456, 4_242_424_242];
const rows = [];
for (const clientID of widthClasses) {
  const { live } = buildLiveUpdate(clientID);
  const pattern = leb128(clientID);
  const hay = Buffer.from(live).toString('hex');
  const needle = Buffer.from(pattern).toString('hex');
  let occurrences = 0;
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 2)) occurrences += 1;
  rows.push({ clientID, width: widthOf(clientID), bytes: live.byteLength, occurrences });
  console.log(
    `clientID=${String(clientID).padStart(10)} varintWidth=${widthOf(clientID)} liveBytes=${String(
      live.byteLength,
    ).padStart(3)} clientIDByteRuns=${occurrences}`,
  );
}
const distinctWidths = [...new Set(rows.map((r) => r.bytes))].sort((a, b) => a - b);
console.log(`distinct byte lengths across width classes: ${distinctWidths.join(', ')}`);
console.log(
  `step from width 4 → 5: ${rows.find((r) => r.width === 5).bytes - rows.find((r) => r.width === 4).bytes} bytes`,
);

console.log('\n## part 2 — hex-level: same width vs different width');
const a = buildLiveUpdate(0xf000_0000); // width 5
const b = buildLiveUpdate(0xf000_0001); // width 5, one bit apart
const c = buildLiveUpdate(0x0fff_ffff); // width 4
console.log(`A clientID=0xf0000000 bytes=${a.live.byteLength}`);
console.log(`  ${hex(a.live)}`);
console.log(`B clientID=0xf0000001 bytes=${b.live.byteLength}`);
console.log(`  ${hex(b.live)}`);
console.log(`C clientID=0x0fffffff bytes=${c.live.byteLength}`);
console.log(`  ${hex(c.live)}`);
const diffOffsets = (x, y) => {
  const n = Math.min(x.byteLength, y.byteLength);
  const out = [];
  for (let i = 0; i < n; i += 1) if (x[i] !== y[i]) out.push(i);
  return out;
};
console.log(`A vs B (same width) differing byte offsets: [${diffOffsets(a.live, b.live).join(', ')}]`);
console.log(`A vs C (different width) differing byte offsets: [${diffOffsets(a.live, c.live).join(', ')}]`);

console.log('\n## part 3 — empirical clientID distribution (crypto CSPRNG, as `new Y.Doc()` uses)');
const N = 200_000;
const draws = new Uint32Array(N);
for (let i = 0; i < N; i += 1) draws[i] = globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
const histogram = [0, 0, 0, 0, 0, 0];
for (const value of draws) histogram[widthOf(value)] += 1;
const p = histogram.map((count) => count / N);
for (let w = 1; w <= 5; w += 1) console.log(`width ${w}: p=${p[w].toFixed(6)} (${histogram[w]})`);
const sameWidth = p.reduce((sum, pi) => sum + pi * pi, 0);
console.log(`P(two independent rounds draw equal clientID width) = ${sameWidth.toFixed(6)}`);
console.log(`⇒ predicted P(ANCHOR-ORDER-C1 bytes mismatch) = ${(1 - sameWidth).toFixed(6)}`);
