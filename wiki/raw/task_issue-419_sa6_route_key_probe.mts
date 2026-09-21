/**
 * SA6 最小复现/探针 — issue #419（spec #415 T1）：ADR 0032 §4 路由键布局事实。
 *
 * 这是**诊断与验收契约的可执行证据**，不是 issue #419 的交付实现（交付守卫测试见契约报告
 * §12：`packages/replication-protocol/test/codec-route-key-guard.test.ts`，由实现票落地）。
 *
 * 运行（真实 codec 源码，期望全绿）：
 *   NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx \
 *     wiki/raw/task_issue-419_sa6_route_key_probe.mts
 *
 * 变异敏感性（SA6_CODEC_SRC 指向 codec 源码副本，期望特定 FAIL id）：
 *   SA6_CODEC_SRC=/abs/path/to/mutant/src/index.ts \
 *     NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx \
 *     wiki/raw/task_issue-419_sa6_route_key_probe.mts
 *
 * 断言面 = codec 运行时产出的**帧字节**（encodeMessage / decodeMessage 公开 API）+ 规范登记的
 * 布局字面量（ADR 0032 §4：namespace 域帧 namespaceId 恒在帧字节 [21..56)、UPDATE_CHUNK 因
 * kind 首字段在 [22..57)；varString 长度前缀恒 1 字节）。零源码字符串/正则断言、零 skip/only。
 *
 * 探针 id 与契约条目对应：
 *   P1  namespace 域逐消息型固定偏移（13 型：prefix@20=0x23、namespaceId@[21..56)）
 *   P2  UPDATE_CHUNK 三 kind × 首/非首 chunk（含绑定块形态）：kind@20、prefix@21、namespaceId@[22..57)
 *   P3  ERROR 字段序走查（连接级/namespace 级 × relatedSequence 有无）：scope→code→fatal→retryable
 *       →relatedSequence?→namespaceId?→safeMessage，全消费；namespaceId 位置变长且不落在 [21..56)
 *   P4  差分推导（不新增任何 codec 常量即可得偏移）：同型两帧仅 namespaceId 值不同 → 差异窗口即布局窗口
 *   NC1 负控：连接级帧（HELLO/HELLO_ACK/GOAWAY/连接级 ERROR）既无 0x23@20 也不含 NS 字节
 *   NC2 负控：注册表 scope 判别——固定偏移规则恰对 namespace-scope 非 UPDATE_CHUNK 帧成立，ERROR(UPDATE_CHUNK) 为例外
 *   NC3 负控：语料级判别——18 golden 中恰 13 帧落固定偏移规则；UPDATE_CHUNK 与 ERROR 两个例外不得被误纳
 */
import { strict as assert } from 'node:assert';
import { fileURLToPath } from 'node:url';
import { GOLDEN, NS, bytesToHex, hexToBytes } from '../../packages/replication-protocol/test/fixtures.ts';

// ---------------------------------------------------------------- codec 载入（默认真实源码；变异运行显式指认副本）

const DEFAULT_SRC = new URL('../../packages/replication-protocol/src/index.ts', import.meta.url).href;
const SRC = process.env.SA6_CODEC_SRC
  ? process.env.SA6_CODEC_SRC.startsWith('/')
    ? `file://${process.env.SA6_CODEC_SRC}`
    : process.env.SA6_CODEC_SRC
  : DEFAULT_SRC;

type Codec = typeof import('../../packages/replication-protocol/src/index.ts');
const codec = (await import(SRC)) as Codec;

// ---------------------------------------------------------------- 规范登记布局事实（ADR 0032 §4 / 协议 §1 §3）

const HEADER_BYTES = 20; // §3 固定 20-byte envelope（codec 自报 ENVELOPE_HEADER_BYTES，另行交叉断言）
const NS_BYTES = 35; // `ns-` + 32 hex（§1）
const NS_PREFIX_BYTES = 1; // 35 < 0x80 ⟹ canonical varUint 长度前缀恒 1 字节
const NS_OFFSET_DOMAIN = HEADER_BYTES + NS_PREFIX_BYTES; // 21
const NS_END_DOMAIN = NS_OFFSET_DOMAIN + NS_BYTES; // 56
const NS_OFFSET_CHUNK = NS_OFFSET_DOMAIN + 1; // 22（kind 首字段）
const NS_END_CHUNK = NS_OFFSET_CHUNK + NS_BYTES; // 57
const NS_A = `ns-${'0'.repeat(32)}`;
const NS_B = `ns-${'f'.repeat(32)}`;
const CAP_BIT = 0x00000001;

const CHECK_HEADER = { maxFrameBytes: 64 * 1024 * 1024 };
const DECODE_CHUNK = { selectedCapabilities: CAP_BIT };

// ---------------------------------------------------------------- 结果收集

interface CheckResult {
  readonly id: string;
  readonly ok: boolean;
  readonly detail: string;
}
const results: CheckResult[] = [];

function check(id: string, fn: () => string): void {
  try {
    results.push({ id, ok: true, detail: fn() });
  } catch (e) {
    results.push({ id, ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
}

const utf8 = new TextDecoder('utf-8', { fatal: true });
const ascii = (b: Uint8Array): string => utf8.decode(b);

// ---------------------------------------------------------------- 最小独立读取器（断言侧，故意不复用 codec 的 reader）

function readVarUint(buf: Uint8Array, pos: number): [number, number] {
  let value = 0;
  let mult = 1;
  let i = pos;
  for (;;) {
    assert.ok(i < buf.length, `varUint 越界 @${i}`);
    const b = buf[i++]!;
    value += (b & 0x7f) * mult;
    mult *= 128;
    if (b < 0x80) return [value, i];
  }
}

function readVarString(buf: Uint8Array, pos: number): [string, number] {
  const [len, after] = readVarUint(buf, pos);
  assert.ok(after + len <= buf.length, `varString 越界 len=${len} @${after}`);
  return [ascii(buf.subarray(after, after + len)), after + len];
}

function bytesAt(frame: Uint8Array, start: number, end: number): string {
  return bytesToHex(frame.subarray(start, end));
}

function nsBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** 字节级子串存在性（不得对含二进制载荷的帧做整体 UTF-8 解码）。 */
function containsBytes(haystack: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- 消息构造（走 codec 公开 encode 面）

const M = codec.MESSAGE_TYPES;
const CAP = { selectedCapabilities: CAP_BIT };

/** 直落固定偏移的 namespace 域消息（UPDATE_CHUNK 由 P2 覆盖；ERROR 由 P3 覆盖）。 */
function domainMessages(ns: string): Array<{ kind: string; message: Codec['ReplicationMessage'] }> {
  return [
    { kind: 'OPEN_NAMESPACE', message: { kind: 'OPEN_NAMESPACE', namespaceId: ns, hasLocalReplica: true, replicationId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', replicationEpoch: 1 } },
    { kind: 'OPEN_NAMESPACE#no-identity', message: { kind: 'OPEN_NAMESPACE', namespaceId: ns, hasLocalReplica: false } },
    { kind: 'OPEN_OK', message: { kind: 'OPEN_OK', namespaceId: ns, mode: 1, replicationId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', replicationEpoch: 1 } },
    { kind: 'CLOSE_NAMESPACE', message: { kind: 'CLOSE_NAMESPACE', namespaceId: ns, reasonCode: 'USER_REMOVED' } },
    { kind: 'CLOSE_OK', message: { kind: 'CLOSE_OK', namespaceId: ns, ackedSequence: 9 } },
    { kind: 'BOOTSTRAP_SNAPSHOT', message: { kind: 'BOOTSTRAP_SNAPSHOT', namespaceId: ns, replicationId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', replicationEpoch: 1, snapshot: Uint8Array.from([0, 1, 2, 3]) } },
    { kind: 'BOOTSTRAP_ACK', message: { kind: 'BOOTSTRAP_ACK', namespaceId: ns, ackedSequence: 4 } },
    { kind: 'IDENTITY_CHANGED', message: { kind: 'IDENTITY_CHANGED', namespaceId: ns, replicationId: '0123456789abcdef0123456789abcdef', replicationEpoch: 2 } },
    { kind: 'SYNC_STEP1', message: { kind: 'SYNC_STEP1', namespaceId: ns, syncRoundId: 1, stateVector: Uint8Array.from([0]) } },
    { kind: 'SYNC_STEP2', message: { kind: 'SYNC_STEP2', namespaceId: ns, syncRoundId: 1, relatedStep1Sequence: 2, update: Uint8Array.from([1, 2, 3]) } },
    { kind: 'SYNC_APPLIED', message: { kind: 'SYNC_APPLIED', namespaceId: ns, syncRoundId: 1, ackedSequence: 3 } },
    { kind: 'RESYNC_REQUIRED', message: { kind: 'RESYNC_REQUIRED', namespaceId: ns, reasonCode: 'ACK_TIMEOUT' } },
    { kind: 'UPDATE', message: { kind: 'UPDATE', namespaceId: ns, update: Uint8Array.from([4, 5, 6]) } },
    { kind: 'UPDATE_ACK', message: { kind: 'UPDATE_ACK', namespaceId: ns, ackedSequence: 6 } },
  ];
}

/** UPDATE_CHUNK 三 kind × 首/非首 chunk（首 chunk 携带绑定块形态）。 */
function chunkMessages(ns: string): Array<{ label: string; transferKind: 0 | 1 | 2; message: Codec['ReplicationMessage'] }> {
  const bindSnapshot = { replicationId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', replicationEpoch: 1 } as const;
  const bindSync = { syncRoundId: 5 } as const;
  return [
    { label: 'kind0/first', transferKind: 0, message: { kind: 'UPDATE_CHUNK', transferKind: 0, namespaceId: ns, transferId: 1, chunkIndex: 0, chunkCount: 3, totalBytes: 600, bytes: Uint8Array.from([0x0a, 0x0b, 0x0c]) } },
    { label: 'kind0/later', transferKind: 0, message: { kind: 'UPDATE_CHUNK', transferKind: 0, namespaceId: ns, transferId: 300, chunkIndex: 63, chunkCount: 64, totalBytes: 4194304, bytes: Uint8Array.from([0xde, 0xad]) } },
    { label: 'kind1/first+binding', transferKind: 1, message: { kind: 'UPDATE_CHUNK', transferKind: 1, namespaceId: ns, transferId: 1, chunkIndex: 0, chunkCount: 3, totalBytes: 600, ...bindSnapshot, bytes: Uint8Array.from([0x0a, 0x0b, 0x0c]) } },
    { label: 'kind1/later', transferKind: 1, message: { kind: 'UPDATE_CHUNK', transferKind: 1, namespaceId: ns, transferId: 7, chunkIndex: 2, chunkCount: 3, totalBytes: 600, bytes: Uint8Array.from([0x0a]) } },
    { label: 'kind2/first+binding', transferKind: 2, message: { kind: 'UPDATE_CHUNK', transferKind: 2, namespaceId: ns, transferId: 9, chunkIndex: 0, chunkCount: 2, totalBytes: 1000, ...bindSync, bytes: Uint8Array.from([0xde, 0xad, 0xbe, 0xef]) } },
    { label: 'kind2/later', transferKind: 2, message: { kind: 'UPDATE_CHUNK', transferKind: 2, namespaceId: ns, transferId: 9, chunkIndex: 1, chunkCount: 2, totalBytes: 1000, bytes: Uint8Array.from([0x0a]) } },
  ];
}

/** ERROR 四象限：连接级/namespace 级 × relatedSequence 有无。 */
function errorMessages(ns: string): Array<{ label: string; message: Codec['ReplicationMessage'] }> {
  return [
    { label: 'conn/related', message: { kind: 'ERROR', code: 'BAD_MAGIC', relatedSequence: 7, safeMessage: 'bad magic' } },
    { label: 'conn/no-related', message: { kind: 'ERROR', code: 'BAD_MAGIC', safeMessage: 'bad magic' } },
    { label: 'ns/related', message: { kind: 'ERROR', code: 'SYNC_STATE_VIOLATION', relatedSequence: 12, namespaceId: ns, safeMessage: 'sync violation' } },
    { label: 'ns/no-related', message: { kind: 'ERROR', code: 'SYNC_STATE_VIOLATION', namespaceId: ns, safeMessage: 'sync violation' } },
  ];
}

function encode(message: Codec['ReplicationMessage'], options?: Parameters<Codec['encodeMessage']>[1]): Uint8Array {
  return codec.encodeMessage(message, { ...CHECK_HEADER, ...(options ?? {}) });
}

// ---------------------------------------------------------------- P1：namespace 域逐消息型固定偏移

check('P1.domain-fixed-offset', () => {
  assert.equal(codec.ENVELOPE_HEADER_BYTES, HEADER_BYTES, 'ENVELOPE_HEADER_BYTES ≠ 20（§3）');
  const scopeByKind = new Map(Object.entries(codec.MESSAGE_REGISTRY).map(([k, v]) => [k, v.scope]));
  let covered = 0;
  for (const { kind, message } of domainMessages(NS)) {
    const frame = encode(message);
    assert.ok(frame.length >= NS_END_DOMAIN, `${kind}: 帧长 ${frame.length} 不足以容纳 namespaceId`);
    assert.equal(frame[HEADER_BYTES], NS_BYTES, `${kind}: prefix@20 = ${frame[HEADER_BYTES]} ≠ 0x23`);
    assert.ok(frame[HEADER_BYTES]! < 0x80, `${kind}: prefix 非单字节 varUint`);
    assert.equal(ascii(frame.subarray(NS_OFFSET_DOMAIN, NS_END_DOMAIN)), NS, `${kind}: namespaceId 不在 [21..56)`);
    const decoded = codec.decodeMessage(frame, CAP);
    assert.equal('namespaceId' in decoded.message ? decoded.message.namespaceId : undefined, NS, `${kind}: decode 回读不等`);
    // 固定偏移规则必须由注册表 scope 支撑（namespace 域；逐型覆盖）
    assert.equal(scopeByKind.get(kind.split('#')[0]!), 'namespace', `${kind}: 注册表 scope 非 namespace`);
    covered++;
  }
  assert.equal(covered, 14, `构造面未覆盖全部直落型（期望 14，实得 ${covered}）`);
  return `${covered} 构造（13 型 × OPEN_NAMESPACE identity 两态）落 [${NS_OFFSET_DOMAIN}..${NS_END_DOMAIN})`;
});

// ---------------------------------------------------------------- P2：UPDATE_CHUNK 三 kind × 首/非首 chunk

check('P2.update-chunk-kind-first', () => {
  const labels: string[] = [];
  for (const { label, transferKind, message } of chunkMessages(NS)) {
    const frame = encode(message);
    assert.equal(frame[HEADER_BYTES], transferKind, `${label}: kind@20 = ${frame[HEADER_BYTES]} ≠ ${transferKind}`);
    assert.equal(frame[HEADER_BYTES + 1], NS_BYTES, `${label}: prefix@21 = ${frame[HEADER_BYTES + 1]} ≠ 0x23`);
    assert.equal(ascii(frame.subarray(NS_OFFSET_CHUNK, NS_END_CHUNK)), NS, `${label}: namespaceId 不在 [22..57)`);
    const decoded = codec.decodeMessage(frame, CAP);
    assert.equal(decoded.message.kind, 'UPDATE_CHUNK', `${label}: kind 判别键`);
    const chunk = decoded.message as Codec['UpdateChunkMsg'];
    assert.equal(chunk.transferKind, transferKind, `${label}: decode transferKind`);
    assert.equal(chunk.namespaceId, NS, `${label}: decode namespaceId`);
    // 若按 namespace 域固定偏移 [21..56) 提取（漏掉 kind 首字段）→ 必然取不到合法 namespaceId
    assert.notEqual(frame[HEADER_BYTES], NS_BYTES, `${label}: kind 与 prefix 不可同置（两规则必须可判别）`);
    labels.push(`${label}:kind@20=${transferKind},ns@[22..57)`);
  }
  // 三 kind 全枚举（AC2）
  assert.deepEqual([...new Set(chunkMessages(NS).map((c) => c.transferKind))].sort(), [0, 1, 2], 'kind 三态未全覆盖');
  return labels.join(' | ');
});

// ---------------------------------------------------------------- P3：ERROR 字段序走查（四象限）

/** ERROR 字段序走查：按 §13 固定序消费 codec 产出字节；返回值 = namespaceId 变长字段起点（payload 相对），无则 -1。 */
function walkError(frame: Uint8Array, label: string): number {
  const scope = frame[HEADER_BYTES]!;
  assert.ok(scope === 0 || scope === 1, `${label}: scope@20 必须 0|1`);
  let p = HEADER_BYTES + 1;
  const [code, afterCode] = readVarString(frame, p);
  p = afterCode;
  const registry = scope === 1 ? codec.NAMESPACE_ERRORS : codec.CONNECTION_ERRORS;
  const entry = registry[code as keyof typeof registry];
  assert.ok(entry, `${label}: 注册表缺 ${scope === 1 ? 'namespace' : 'connection'} 码 ${code}`);
  const fatal = frame[p++]!;
  const retryable = frame[p++]!;
  assert.equal(fatal, entry!.fatal ? 1 : 0, `${label}: fatal 必须在 code 之后第 1 字节且与注册表一致`);
  assert.equal(retryable, entry!.retryable !== 'no' ? 1 : 0, `${label}: retryable 必须在 fatal 之后且与注册表一致`);
  const relMarker = frame[p++]!;
  assert.ok(relMarker === 0 || relMarker === 1, `${label}: relatedSequence marker 必须 0|1`);
  let relatedSequence: number | undefined;
  if (relMarker === 1) {
    const [rel, after] = readVarUint(frame, p);
    p = after;
    relatedSequence = rel;
  }
  const nsMarker = frame[p++]!;
  assert.ok(nsMarker === 0 || nsMarker === 1, `${label}: namespaceId marker 必须 0|1`);
  let nsStart = -1;
  if (nsMarker === 1) {
    nsStart = p;
    const [ns, after] = readVarString(frame, p);
    p = after;
    assert.equal(ns.length, NS_BYTES, `${label}: namespaceId 值长度 ≠ 35`);
    assert.equal(p - nsStart, NS_PREFIX_BYTES + NS_BYTES, `${label}: namespaceId varString（1 字节前缀 + 35 字节）长度不符`);
    assert.equal(frame[nsStart], NS_BYTES, `${label}: namespaceId varString 长度前缀 ≠ 0x23`);
  }
  const [safe, afterSafe] = readVarString(frame, p);
  p = afterSafe;
  assert.ok(safe.length >= 0, `${label}: safeMessage 必须为 varString`);
  assert.equal(p, frame.length, `${label}: safeMessage 必须是末字段且全消费（尾随 ${frame.length - p} 字节）`);
  assert.equal(scope, nsMarker === 1 ? 1 : 0, `${label}: scope 与 namespaceId 出现性必须一致（namespace 必有 / connection 必无）`);
  void relatedSequence;
  return nsStart;
}


check('P3.error-field-order', () => {
  const notes: string[] = [];
  for (const { label, message } of errorMessages(NS)) {
    const frame = encode(message);
    const msg = message as Extract<Codec['ReplicationMessage'], { kind: 'ERROR' }>;
    const nsStart = walkError(frame, label);
    // 值面交叉核对：走查出的字段位置必须与 codec 解码结果一致（同源消费解码器）
    const decoded = codec.decodeMessage(frame, CAP).message as Extract<Codec['ReplicationMessage'], { kind: 'ERROR' }>;
    assert.equal(decoded.code, msg.code, `${label}: decode code`);
    assert.equal(decoded.relatedSequence, msg.relatedSequence, `${label}: decode relatedSequence 位置/值`);
    assert.equal(decoded.namespaceId, msg.namespaceId, `${label}: decode namespaceId 位置/值`);
    assert.equal(decoded.safeMessage, msg.safeMessage, `${label}: decode safeMessage 位置/值`);
    if (nsStart >= 0) {
      // ERROR 的 namespaceId 不在固定偏移 [21..56)：该窗口里是 code 字符串
      assert.notEqual(ascii(frame.subarray(NS_OFFSET_DOMAIN, NS_END_DOMAIN)), NS, `${label}: ERROR 不得被误判为固定偏移`);
      const bound = nsStart - HEADER_BYTES;
      assert.ok(bound <= 64, `${label}: namespaceId 距 payload 起点 ${bound} 字节，超出 edge mini-decode 有界预算`);
      notes.push(`${label}:ns@payload+${bound}(bounded)`);
    } else {
      assert.ok(!containsBytes(frame, nsBytes(NS)), `${label}: 连接级 ERROR 不得携带 namespaceId 字节`);
      notes.push(`${label}:no-ns`);
    }
  }
  // 最坏前缀：最长 namespace 错误码（35 字节）+ relatedSequence=0xffffffff（5 字节 varUint）
  const longestCode = Object.keys(codec.NAMESPACE_ERRORS).reduce((a, b) => (b.length > a.length ? b : a));
  const worst = encode({ kind: 'ERROR', code: longestCode, relatedSequence: 0xffffffff, namespaceId: NS, safeMessage: 'x' });
  const worstStart = walkError(worst, `worst/${longestCode}`);
  assert.ok(worstStart > 0, '最坏 ERROR 必须携带 namespaceId');
  assert.equal(worstStart - HEADER_BYTES, 1 + 1 + longestCode.length + 1 + 1 + 1 + 5 + 1, '最坏 ERROR 的 namespaceId 前缀字节数不符');
  notes.push(`worst(${longestCode.length}B code):ns@payload+${worstStart - HEADER_BYTES}`);
  return notes.join(' | ');
});

// ---------------------------------------------------------------- P4：差分推导（零新增 codec 常量）

check('P4.differential-window', () => {
  // 值域差分只能标出「随 namespaceId 值变化的字节」= 完整字段窗口去掉不变成分
  // （1 字节 varString 前缀 + 3 字节 'ns-' 字面）。字段窗口起点由差分起点回推不变成分得到，
  // 再与规范登记偏移交叉断言 → 偏移事实不依赖新增 codec 常量即可被行为面覆盖。
  const cases: Array<{ label: string; make: (ns: string) => Codec['ReplicationMessage']; fieldStart: number; fieldEnd: number }> = [
    { label: 'UPDATE', make: (ns) => ({ kind: 'UPDATE', namespaceId: ns, update: Uint8Array.from([1, 2]) }), fieldStart: NS_OFFSET_DOMAIN, fieldEnd: NS_END_DOMAIN },
    { label: 'CLOSE_OK', make: (ns) => ({ kind: 'CLOSE_OK', namespaceId: ns, ackedSequence: 1 }), fieldStart: NS_OFFSET_DOMAIN, fieldEnd: NS_END_DOMAIN },
    { label: 'RESYNC_REQUIRED', make: (ns) => ({ kind: 'RESYNC_REQUIRED', namespaceId: ns, reasonCode: 'ACK_TIMEOUT' }), fieldStart: NS_OFFSET_DOMAIN, fieldEnd: NS_END_DOMAIN },
    { label: 'UPDATE_CHUNK/kind0', make: (ns) => ({ kind: 'UPDATE_CHUNK', transferKind: 0, namespaceId: ns, transferId: 1, chunkIndex: 0, chunkCount: 1, totalBytes: 3, bytes: Uint8Array.from([1, 2, 3]) }), fieldStart: NS_OFFSET_CHUNK, fieldEnd: NS_END_CHUNK },
    { label: 'UPDATE_CHUNK/kind2-first', make: (ns) => ({ kind: 'UPDATE_CHUNK', transferKind: 2, namespaceId: ns, transferId: 1, chunkIndex: 0, chunkCount: 1, totalBytes: 3, syncRoundId: 5, bytes: Uint8Array.from([1, 2, 3]) }), fieldStart: NS_OFFSET_CHUNK, fieldEnd: NS_END_CHUNK },
  ];
  const notes: string[] = [];
  const VALUE_INVARIANT = 'ns-'.length; // 值域内不变成分（3 字节字面）；长度前缀在字段窗口之前
  for (const { label, make, fieldStart, fieldEnd } of cases) {
    const a = encode(make(NS_A));
    const b = encode(make(NS_B));
    assert.equal(a.length, b.length, `${label}: 同型两帧长度必须相等`);
    let first = -1;
    let last = -1;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        if (first === -1) first = i;
        last = i;
      }
    }
    assert.equal(first, fieldStart + VALUE_INVARIANT, `${label}: 差分值域起点 ${first} ≠ ${fieldStart + VALUE_INVARIANT}`);
    assert.equal(last + 1, fieldEnd, `${label}: 差分值域终点 ${last + 1} ≠ ${fieldEnd}`);
    // 不变成分：窗口前的 1 字节长度前缀（0x23）与 3 字节 'ns-' 在两帧中逐字节相同
    assert.equal(bytesAt(a, fieldStart - 1, first), bytesAt(b, fieldStart - 1, first), `${label}: 不变成分（前缀+'ns-'）应稳定`);
    assert.equal(a[fieldStart - 1], NS_BYTES, `${label}: 字段窗口前一字节 = varString 长度前缀 0x23`);
    assert.equal(ascii(a.subarray(fieldStart - 1, first)), `${String.fromCharCode(NS_BYTES)}ns-`, `${label}: 字段窗口头部`);
    assert.equal(ascii(a.subarray(first, last + 1)), NS_A.slice(3), `${label}: 值域 A 必须是 NS_A 去不变前缀`);
    assert.equal(ascii(b.subarray(first, last + 1)), NS_B.slice(3), `${label}: 值域 B 必须是 NS_B 去不变前缀`);
    assert.equal(ascii(a.subarray(fieldStart, fieldEnd)), NS_A, `${label}: 登记字段窗口 ≠ NS_A`);
    notes.push(`${label}:Δ[${first}..${last + 1})⇒field[${fieldStart}..${fieldEnd})`);
  }
  return notes.join(' | ');
});

// ---------------------------------------------------------------- NC1：连接级帧无路由键

check('NC1.connection-frames-silent', () => {
  const frames: Array<[string, Codec['ReplicationMessage']]> = [
    ['HELLO', { kind: 'HELLO', peerInstanceId: 'peer-a', expectedHubInstanceId: 'hub-a', protocolVersions: [1], requiredCapabilities: 0, optionalCapabilities: 0, connectionNonce: Uint8Array.from({ length: 16 }) }],
    ['HELLO_ACK', { kind: 'HELLO_ACK', hubInstanceId: 'hub-a', protocolVersion: 1, selectedCapabilities: 0, connectionNonce: Uint8Array.from({ length: 16 }), connectionId: 'conn-1' }],
    ['GOAWAY', { kind: 'GOAWAY', reasonCode: 'SERVER_RESTARTING', drainTimeoutMs: 5000 }],
    ['ERROR/conn', { kind: 'ERROR', code: 'BAD_MAGIC', safeMessage: 'bad magic' }],
  ];
  for (const [label, message] of frames) {
    const frame = encode(message);
    assert.notEqual(frame[HEADER_BYTES], NS_BYTES, `${label}: 连接级帧不得以 0x23 长度前缀开头`);
    assert.ok(!containsBytes(frame, nsBytes(NS)), `${label}: 连接级帧不得含 namespaceId 字节`);
    codec.decodeMessage(frame, CAP); // 仍须可解码（负控不是“拒绝”而是“无路由键”）
  }
  return 'HELLO/HELLO_ACK/GOAWAY/连接级 ERROR 均无 0x23@20 且不含 NS 字节';
});

// ---------------------------------------------------------------- NC2：注册表 scope 判别 + 例外清单

check('NC2.registry-scope-partition', () => {
  const namespaceKinds = Object.entries(codec.MESSAGE_REGISTRY).filter(([, v]) => v.scope === 'namespace').map(([k]) => k);
  assert.equal(namespaceKinds.length, 14, `namespace-scope 消息型应为 14（18 − 3 连接级 − ERROR either）`);
  assert.ok(namespaceKinds.includes('UPDATE_CHUNK'), 'UPDATE_CHUNK 必为 namespace scope');
  assert.equal(codec.MESSAGE_REGISTRY.ERROR.scope, 'either', 'ERROR 为 either（固定偏移规则的例外）');
  const chunk = encode({ kind: 'UPDATE_CHUNK', transferKind: 1, namespaceId: NS, transferId: 1, chunkIndex: 0, chunkCount: 1, totalBytes: 1, replicationId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', replicationEpoch: 1, bytes: Uint8Array.from([1]) });
  assert.notEqual(chunk[HEADER_BYTES], NS_BYTES, 'UPDATE_CHUNK 首字节是 kind，不得被 [21..56) 规则误纳');
  assert.equal(chunk[HEADER_BYTES + 1], NS_BYTES, 'UPDATE_CHUNK 的 prefix 在 21');
  return `namespace-scope=14；固定偏移规则适用 = 13（排除 UPDATE_CHUNK）+ ERROR 全例外`;
});

// ---------------------------------------------------------------- NC3：18 golden 语料级判别

check('NC3.corpus-discrimination', () => {
  let fixed = 0;
  let chunkRule = 0;
  let errorRule = 0;
  const exceptions: string[] = [];
  for (const g of GOLDEN) {
    const frame = hexToBytes(g.frameHex);
    const scope = codec.MESSAGE_REGISTRY[g.kind as Codec['MessageName']]?.scope;
    const isFixed = frame[HEADER_BYTES] === NS_BYTES && ascii(frame.subarray(NS_OFFSET_DOMAIN, NS_END_DOMAIN)) === NS;
    if (isFixed) {
      fixed++;
      assert.notEqual(g.kind, 'UPDATE_CHUNK', `${g.name}: UPDATE_CHUNK 不得落固定偏移`);
      assert.notEqual(g.kind, 'ERROR', `${g.name}: ERROR 不得落固定偏移`);
      assert.equal(scope, 'namespace', `${g.name}: 落固定偏移者必须 namespace scope`);
    } else {
      exceptions.push(g.name);
      if (g.kind === 'UPDATE_CHUNK') {
        chunkRule++;
        assert.ok(frame[HEADER_BYTES]! <= 2, `${g.name}: UPDATE_CHUNK kind@20 非 {0,1,2}`);
        assert.equal(frame[HEADER_BYTES + 1], NS_BYTES, `${g.name}: UPDATE_CHUNK prefix@21 ≠ 0x23`);
        assert.equal(ascii(frame.subarray(NS_OFFSET_CHUNK, NS_END_CHUNK)), NS, `${g.name}: UPDATE_CHUNK namespaceId 不在 [22..57)`);
      } else if (g.kind === 'ERROR') {
        errorRule++;
        assert.notEqual(frame[HEADER_BYTES], NS_BYTES, `${g.name}: ERROR 不得以 0x23 开头（首字段是 scope）`);
      } else {
        assert.equal(scope, 'connection', `${g.name}: 非固定偏移且非 UPDATE_CHUNK/ERROR 者必须 connection scope`);
      }
    }
  }
  assert.equal(fixed, 13, `21 golden 中固定偏移命中数 ${fixed} ≠ 13`);
  assert.equal(chunkRule, 3, `UPDATE_CHUNK golden 覆盖数 ${chunkRule} ≠ 3（三 kind 全量）`);
  assert.equal(errorRule, 2, `ERROR golden 覆盖数 ${errorRule} ≠ 2（连接级/namespace 级）`);
  assert.deepEqual(exceptions.sort(), ['ERROR_CONN', 'ERROR_NS', 'GOAWAY', 'HELLO', 'HELLO_ACK', 'UPDATE_CHUNK_BASIC', 'UPDATE_CHUNK_MULTIBYTE', 'UPDATE_CHUNK_U32_MAX'], `例外集合不符：${exceptions.join(',')}`);
  return `fixed=13 / chunk=3 / error=2 / exceptions=${exceptions.join(',')}`;
});

// ---------------------------------------------------------------- 汇总

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id} :: ${r.detail}`);
}
console.log(`SRC ${fileURLToPath(SRC)}`);
console.log(`RESULT ${results.length - failed.length}/${results.length} passed${failed.length ? ` ; FAILED_IDS=${failed.map((f) => f.id).join(',')}` : ''}`);
process.exitCode = failed.length ? 1 : 0;
