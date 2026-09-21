/**
 * 路由键契约结构性守卫测试 — issue #419（spec #415 T1；ADR 0032 §4 决策 D7/D11）。
 *
 * 规范来源（只读）：
 * - ADR 0032 §4：namespace 域帧的 namespaceId 恒在帧字节 `[21..56)`；`UPDATE_CHUNK` 因 kind 首字段
 *   在 `[22..57)`；varString 长度前缀恒 1 字节；OPEN 全解码 / ERROR 有界 mini-decode 两例外；
 *   「路由键布局与 codec 字段序登记为同步维护契约，codec 侧加结构性守卫测试」。
 * - 协议 §1（身份文法）、§3（固定 20-byte envelope）、§4（lib0 canonical）、§5（消息注册表+scope）、
 *   §10.3（UPDATE_CHUNK 字段表）、§13（ERROR 字段表）。
 *
 * 断言面：codec 公开 API 产出的**运行时帧字节**（`encodeMessage` 产出 + golden hex 解码两源）与公开
 * 值面（`decodeMessage` 回读、`MESSAGE_REGISTRY` scope、错误注册表元数据）。失败消息一律点名消息型
 * + 偏移 + 实测值，使「路由键布局漂移」可直接定位到具体编码器函数。
 *
 * 形态（SA6 契约 §13）：**baseline-green + mutation-red** —— 现行 wire 布局正确，本文件把既有事实
 * 固化为可执行契约；可证伪性由 SA6 变异矩阵承载（M1–M4 各自点亮对应断言、NM1/NM2 保持绿）。任何在
 * 当前代码上「红」的路由键断言都只能是假红（环境/fixture/入口错误），不得写入本文件。
 *
 * 同源消费（AC4 / RK-C4，SD-1B 形态）：偏移事实不在测试内手抄第二份字段表——20 消费 codec 导出
 * `ENVELOPE_HEADER_BYTES`，值面消费 `encodeMessage`/`decodeMessage`/注册表，偏移由行为面差分推导
 * 互证；规范登记字面量（35 / 1 与派生 21 / 22 / 56 / 57）只在下块单点钉死（G1-a 是唯一裸字面量断言
 * 点）。ERROR 走查故意使用**独立最小读取器**（不复用 codec 的 CanonicalReader），使编码/解码同源缺陷
 * 无法互相抵消；其解读再经 `decodeMessage` 值面交叉核对。
 *
 * 维护契约（SA8 Required action 2 / SA1 设计 §13-R3）：消息注册表与错误注册表 append-only。新增
 * namespace-scope 消息型 = 必须显式裁决「落 [21..56) 固定偏移」还是「登记为例外」；新增错误码 = 必须
 * 复核 ERROR mini-decode 预算（≤ 64 字节）。因此本文件的计数/集合断言写成精确值：注册表增长时本文件
 * 响亮红——这是**有意识的契约修订信号**，不是测试脆弱。
 *
 * 纪律（SA6 §3-4）：零 skip/only/todo、零 env 读取、零 fallback、零吞错、零源码字符串/正则断言；
 * 不修改任何生产代码（`git diff -- packages/replication-protocol/src` 必须为空）。
 */
import { describe, expect, it } from 'vitest';
import {
  CAP_CHUNKED_UPDATE,
  ENVELOPE_HEADER_BYTES,
  MESSAGE_REGISTRY,
  NAMESPACE_ERRORS,
  ProtocolError,
  decodeMessage,
  encodeMessage,
  lookupError,
  type DecodeOptions,
  type DecodedMessage,
  type EncodeOptions,
  type ErrorMsg,
  type MessageName,
  type ReplicationMessage,
  type UpdateChunkMsg,
  type UpdateChunkTransferKind,
} from '@nomicore/replication-protocol';
import { GOLDEN, NS, RID, bytesToHex, hexToBytes, type GoldenFixture } from './fixtures';

// ---------------------------------------------------------------- 路由键布局事实（单一事实源）
//
// SD-1B（issue #419 范围裁决）：本块是本票范围内的唯一登记点；未来 edge demux 消费者切片落地时应把它
// 升格为 `src/constants.ts` 导出常量（预留名见 SA1 设计 §13-F1），本块改为消费常量并保留 G1 钉死断言。
// 偏移字面量 21/22/56/57 只经下面的派生式出现（G1-a 是唯一例外——它把 ADR/协议字面量钉死）；
// 35 / 1 字面量仅本块一处。
const HEADER_BYTES = ENVELOPE_HEADER_BYTES; // 同源消费 codec 导出（= 20，G1-a 钉死）
const NS_BYTES = 35; // `ns-` + 32 hex（协议 §1 文法）
const NS_PREFIX_BYTES = 1; // 35 < 0x80 ⟹ canonical varUint 最短编码恒 1 字节
const NS_OFFSET_DOMAIN = HEADER_BYTES + NS_PREFIX_BYTES; // 21（派生，不手写）
const NS_END_DOMAIN = NS_OFFSET_DOMAIN + NS_BYTES; // 56（派生）
const NS_OFFSET_CHUNK = NS_OFFSET_DOMAIN + 1; // 22（kind 首字段占 1 字节；kind ∈ {0,1,2} 恒单字节）
const NS_END_CHUNK = NS_OFFSET_CHUNK + NS_BYTES; // 57（派生）
const ERROR_NS_PREFIX_BUDGET = 64; // edge 有界 mini-decode 上界（ADR 0032 §4；实测最坏 46）

/** 差分推导用的两个合法 namespaceId（仅最后 32 个 hex 字符不同）。 */
const NS_A = `ns-${'0'.repeat(32)}`;
const NS_B = `ns-${'f'.repeat(32)}`;
/** 差分窗口内不变成分（值域差窗 = 字段窗口去掉这 3 字节 `ns-` 字面）。 */
const VALUE_INVARIANT_BYTES = 'ns-'.length;

const CAP_DECODE: DecodeOptions = { selectedCapabilities: CAP_CHUNKED_UPDATE };

// ---------------------------------------------------------------- 断言侧最小工具（刻意不复用 codec reader）

const utf8 = new TextDecoder('utf-8', { fatal: true });

function ascii(bytes: Uint8Array): string {
  return utf8.decode(bytes);
}

/** 窄化辅助：undefined 即响亮失败（不吞错、不给 fallback）。 */
function must<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

function mustByte(frame: Uint8Array, pos: number, label: string, field: string): number {
  const byte = frame[pos];
  if (byte === undefined) throw new Error(`${label}: ${field}@${pos} 越界（帧长 ${frame.length}）`);
  return byte;
}

function readVarUint(buf: Uint8Array, pos: number, label: string): [number, number] {
  let value = 0;
  let mult = 1;
  let i = pos;
  for (;;) {
    if (i >= buf.length) throw new Error(`${label}: varUint 越界 @${i}（帧长 ${buf.length}）`);
    const b = buf[i++]!;
    value += (b & 0x7f) * mult;
    mult *= 128;
    if (b < 0x80) return [value, i];
  }
}

function readVarString(buf: Uint8Array, pos: number, label: string): [string, number] {
  const [len, after] = readVarUint(buf, pos, label);
  if (after + len > buf.length) throw new Error(`${label}: varString 越界 len=${len} @${after}`);
  return [ascii(buf.subarray(after, after + len)), after + len];
}

/** 字节级子串定位（不得对含二进制载荷的帧做整体 UTF-8 解码）。 */
function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function nsBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function encode(message: ReplicationMessage, options?: EncodeOptions): Uint8Array {
  return encodeMessage(message, options);
}

function namespaceIdOf(message: ReplicationMessage): string | undefined {
  return 'namespaceId' in message ? message.namespaceId : undefined;
}

function expectMalformed(fn: () => unknown, label: string): void {
  let caught: unknown;
  try {
    fn();
  } catch (e) {
    caught = e;
  }
  expect(caught, `${label}: 必须抛 ProtocolError`).toBeInstanceOf(ProtocolError);
  expect((caught as ProtocolError).code, `${label}: 错误分类`).toBe('MALFORMED_FRAME');
}

function decodedChunk(decoded: DecodedMessage, label: string): UpdateChunkMsg {
  const message = decoded.message;
  if (message.kind !== 'UPDATE_CHUNK') {
    throw new Error(`${label}: decode 判别键应为 UPDATE_CHUNK，实得 ${message.kind}（chunk 解码需 selectedCapabilities 已协商）`);
  }
  return message;
}

function decodedError(decoded: DecodedMessage, label: string): ErrorMsg {
  const message = decoded.message;
  if (message.kind !== 'ERROR') {
    throw new Error(`${label}: decode 判别键应为 ERROR，实得 ${message.kind}`);
  }
  return message;
}

function chunkMessageOf(message: ReplicationMessage, label: string): UpdateChunkMsg {
  if (message.kind !== 'UPDATE_CHUNK') {
    throw new Error(`${label}: 构造面应为 UPDATE_CHUNK，实得 ${message.kind}`);
  }
  return message;
}

function errorMessageOf(message: ReplicationMessage, label: string): ErrorMsg {
  if (message.kind !== 'ERROR') {
    throw new Error(`${label}: 构造面应为 ERROR，实得 ${message.kind}`);
  }
  return message;
}

/** golden 双面：golden 冻结字节（已发布 wire 事实）+ 带 sequence 重编码字节（当前编码器行为）。 */
function goldenFaces(golden: GoldenFixture): Array<[string, Uint8Array]> {
  return [
    ['golden-bytes', hexToBytes(golden.frameHex)],
    ['re-encoded', encode(golden.message, { sequence: golden.sequence })],
  ];
}

// ---------------------------------------------------------------- 构造面（走 codec 公开 encode 面）

/** 直落固定偏移的 namespace 域消息（UPDATE_CHUNK 由 G3 覆盖；ERROR 由 G4 覆盖）。 */
function domainMessages(ns: string): Array<{ kind: MessageName; message: ReplicationMessage }> {
  return [
    { kind: 'OPEN_NAMESPACE', message: { kind: 'OPEN_NAMESPACE', namespaceId: ns, hasLocalReplica: true, replicationId: RID, replicationEpoch: 1 } },
    { kind: 'OPEN_NAMESPACE', message: { kind: 'OPEN_NAMESPACE', namespaceId: ns, hasLocalReplica: false } },
    { kind: 'OPEN_OK', message: { kind: 'OPEN_OK', namespaceId: ns, mode: 1, replicationId: RID, replicationEpoch: 1 } },
    { kind: 'CLOSE_NAMESPACE', message: { kind: 'CLOSE_NAMESPACE', namespaceId: ns, reasonCode: 'USER_REMOVED' } },
    { kind: 'CLOSE_OK', message: { kind: 'CLOSE_OK', namespaceId: ns, ackedSequence: 9 } },
    { kind: 'BOOTSTRAP_SNAPSHOT', message: { kind: 'BOOTSTRAP_SNAPSHOT', namespaceId: ns, replicationId: RID, replicationEpoch: 1, snapshot: Uint8Array.from([0, 1, 2, 3]) } },
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
function chunkMessages(
  ns: string,
): Array<{ label: string; transferKind: UpdateChunkTransferKind; message: ReplicationMessage }> {
  const bindSnapshot = { replicationId: RID, replicationEpoch: 1 } as const;
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

/** ERROR 四象限（连接级/namespace 级 × relatedSequence 有无）+ fatal=false wire 形态样本（SA2 O3）。 */
function errorMessages(ns: string): Array<{ label: string; message: ErrorMsg }> {
  return [
    { label: 'conn/related', message: { kind: 'ERROR', code: 'BAD_MAGIC', relatedSequence: 7, safeMessage: 'bad magic' } },
    { label: 'conn/no-related', message: { kind: 'ERROR', code: 'BAD_MAGIC', safeMessage: 'bad magic' } },
    { label: 'ns/related', message: { kind: 'ERROR', code: 'SYNC_STATE_VIOLATION', relatedSequence: 12, namespaceId: ns, safeMessage: 'sync violation' } },
    { label: 'ns/no-related', message: { kind: 'ERROR', code: 'SYNC_STATE_VIOLATION', namespaceId: ns, safeMessage: 'sync violation' } },
    // ACK_TIMEOUT 是唯一 fatal=false 的注册表码：直接入样 wire `fatal=0` 位形态（其余样本恒 1）。
    { label: 'ns/fatal-false', message: { kind: 'ERROR', code: 'ACK_TIMEOUT', namespaceId: ns, safeMessage: 'ack timeout' } },
  ];
}

// ---------------------------------------------------------------- ERROR 字段序独立走查器（§13 序）

interface ErrorWalk {
  readonly scope: 0 | 1;
  readonly code: string;
  readonly relatedSequence: number | undefined;
  readonly namespaceId: string | undefined;
  readonly safeMessage: string;
  /** namespaceId varString 起点（帧绝对偏移）；连接级无 key 时 = -1。 */
  readonly nsStart: number;
}

/**
 * 按协议 §13 固定序消费 codec 产出的 ERROR 字节：
 * scope(u8) → code(varString) → fatal(u8) → retryable(u8) → relatedSequence?(marker+varUint32)
 * → namespaceId?(marker+varString) → safeMessage(varString)。
 * 走查序即断言序：relatedSequence 必须先于 namespaceId；safeMessage 必须末字段且恰好全消费。
 */
function walkError(frame: Uint8Array, label: string): ErrorWalk {
  const scopeByte = frame[HEADER_BYTES];
  expect(scopeByte === 0 || scopeByte === 1, `${label}: ERROR scope@${HEADER_BYTES} 必须 ∈ {0,1}，实测 ${scopeByte}`).toBe(true);
  const scope: 0 | 1 = scopeByte === 1 ? 1 : 0;
  let p = HEADER_BYTES + 1; // scope(u8) 恒 1 字节
  const [code, afterCode] = readVarString(frame, p, label);
  p = afterCode;
  const entry = must(
    lookupError(scope === 1 ? 'namespace' : 'connection', code),
    `${label}: 错误注册表缺 ${scope === 1 ? 'namespace' : 'connection'} 码 ${code}`,
  );
  const fatal = mustByte(frame, p, label, 'fatal');
  p += 1;
  expect(fatal, `${label}: fatal 必须紧随 code(varString) 之后且与注册表一致`).toBe(entry.fatal ? 1 : 0);
  const retryable = mustByte(frame, p, label, 'retryable');
  p += 1;
  expect(retryable, `${label}: retryable 必须紧随 fatal 之后且与注册表一致（registry.retryable !== 'no'）`).toBe(
    entry.retryable !== 'no' ? 1 : 0,
  );
  const relatedMarker = mustByte(frame, p, label, 'relatedSequence marker');
  p += 1;
  expect(relatedMarker === 0 || relatedMarker === 1, `${label}: relatedSequence marker 必须 ∈ {0,1}，实测 ${relatedMarker}`).toBe(true);
  let relatedSequence: number | undefined;
  if (relatedMarker === 1) {
    const [value, after] = readVarUint(frame, p, label);
    p = after;
    relatedSequence = value;
  }
  const nsMarker = mustByte(frame, p, label, 'namespaceId marker');
  p += 1;
  expect(
    nsMarker === 0 || nsMarker === 1,
    `${label}: namespaceId marker 必须 ∈ {0,1}，实测 ${nsMarker}（此处错位即 relatedSequence/namespaceId 次序漂移）`,
  ).toBe(true);
  let nsStart = -1;
  let namespaceId: string | undefined;
  if (nsMarker === 1) {
    nsStart = p;
    const [value, after] = readVarString(frame, p, label);
    p = after;
    namespaceId = value;
    expect(value.length, `${label}: namespaceId 值长度必须 = ${NS_BYTES}`).toBe(NS_BYTES);
    expect(p - nsStart, `${label}: namespaceId varString 必须 = ${NS_PREFIX_BYTES} 字节前缀 + ${NS_BYTES} 字节值`).toBe(
      NS_PREFIX_BYTES + NS_BYTES,
    );
    expect(frame[nsStart], `${label}: namespaceId varString 长度前缀必须 = 0x23`).toBe(NS_BYTES);
  }
  const [safeMessage, afterSafe] = readVarString(frame, p, label);
  p = afterSafe;
  expect(p, `${label}: safeMessage 必须是末字段且恰好全消费（尾随 ${frame.length - p} 字节）`).toBe(frame.length);
  expect(scope, `${label}: scope 与 namespaceId 出现性必须等价（namespace ⇔ present）`).toBe(nsMarker === 1 ? 1 : 0);
  return { scope, code, relatedSequence, namespaceId, safeMessage, nsStart };
}

// ---------------------------------------------------------------- G1 布局事实登记与交叉核对

describe('G1 布局事实登记与交叉核对（AC4 / RK-C4）：单一事实源 + 同源消费', () => {
  it('G1-a 规范登记字面量单点钉死（ADR 0032 §4 / 协议 §1 §3）：20 / 35 / 1 与派生 21 / 22 / 56 / 57', () => {
    expect(ENVELOPE_HEADER_BYTES, 'codec 自报头长必须 = 协议 §3 的 20').toBe(20);
    expect(HEADER_BYTES, '登记头长必须同源消费 codec 导出').toBe(20);
    expect(NS_BYTES, 'namespaceId 字节数必须 = 35（协议 §1 文法 ns- + 32 hex）').toBe(35);
    expect(NS_PREFIX_BYTES, 'varString 长度前缀必须恒 1 字节（35 < 0x80 ⟹ canonical 最短编码）').toBe(1);
    expect(NS_OFFSET_DOMAIN, 'namespace 域帧 namespaceId 起点必须 = 21').toBe(21);
    expect(NS_END_DOMAIN, 'namespace 域帧 namespaceId 终点必须 = 56').toBe(56);
    expect(NS_OFFSET_CHUNK, 'UPDATE_CHUNK namespaceId 起点必须 = 22（kind 首字段占 1 字节）').toBe(22);
    expect(NS_END_CHUNK, 'UPDATE_CHUNK namespaceId 终点必须 = 57').toBe(57);
    expect(ERROR_NS_PREFIX_BUDGET, 'ERROR 有界 mini-decode 预算上界').toBe(64);
  });

  it('G1-b 35 字节与 codec 文法互证：合法 namespaceId 可编码且 UTF-8 字节数 = 35', () => {
    expect(nsBytes(NS).byteLength, `fixtures 合法 id ${NS} 的 UTF-8 字节数`).toBe(NS_BYTES);
    const frame = encode({ kind: 'UPDATE', namespaceId: NS, update: Uint8Array.from([1]) });
    expect(frame.length, '合法 namespaceId 必须通过 codec 文法（checkNamespaceId）并被编码').toBeGreaterThan(0);
    expect(ascii(frame.subarray(NS_OFFSET_DOMAIN, NS_END_DOMAIN)), 'codec 写出的 namespaceId 窗口').toBe(NS);
  });

  it(`G1-c 长度前缀运行时观察：任一 namespace 域帧 frame[${ENVELOPE_HEADER_BYTES}] = 0x23 且 < 0x80`, () => {
    const frame = encode({ kind: 'CLOSE_OK', namespaceId: NS, ackedSequence: 1 });
    expect(frame[HEADER_BYTES], `prefix@${HEADER_BYTES} 必须 = 0x23`).toBe(NS_BYTES);
    expect(frame[HEADER_BYTES]! < 0x80, '前缀必须是单字节 canonical varUint（35 < 0x80）').toBe(true);
  });

  it('G1-d 恒 35 的双向锁定（SA2 O4 加固）：非 35 字节形态必须 MALFORMED_FRAME', () => {
    expectMalformed(
      () => encode({ kind: 'UPDATE', namespaceId: `ns-${'0'.repeat(31)}`, update: Uint8Array.from([1]) }),
      '34 字符 namespaceId（少 1 字节）',
    );
    expectMalformed(
      () => encode({ kind: 'UPDATE', namespaceId: `ns-${'0'.repeat(33)}`, update: Uint8Array.from([1]) }),
      '36 字符 namespaceId（多 1 字节）',
    );
  });
});

// ---------------------------------------------------------------- G2 namespace 域固定偏移

describe('G2 namespace 域固定偏移（AC1 / RK-C1）：prefix@20 + namespaceId ∈ [21..56)', () => {
  it('G2-a 14 构造（13 型 + OPEN_NAMESPACE identity 两态）逐型断言固定偏移与值面', () => {
    const covered = new Set<MessageName>();
    const constructions = domainMessages(NS);
    for (const { kind, message } of constructions) {
      const label = kind;
      const frame = encode(message);
      expect(frame.length >= NS_END_DOMAIN, `${label}: 帧长 ${frame.length} 不足以容纳 namespaceId（需 ≥ ${NS_END_DOMAIN}）`).toBe(true);
      expect(frame[HEADER_BYTES], `${label}: prefix@${HEADER_BYTES} = ${frame[HEADER_BYTES]} ≠ 0x23`).toBe(NS_BYTES);
      expect(frame[HEADER_BYTES]! < 0x80, `${label}: prefix 必须是单字节 canonical varUint`).toBe(true);
      expect(
        ascii(frame.subarray(NS_OFFSET_DOMAIN, NS_END_DOMAIN)),
        `${label}: namespaceId 不在 [${NS_OFFSET_DOMAIN}..${NS_END_DOMAIN})`,
      ).toBe(NS);
      expect(namespaceIdOf(decodeMessage(frame).message), `${label}: decode 回读 namespaceId`).toBe(NS);
      expect(MESSAGE_REGISTRY[kind].scope, `${label}: 固定偏移规则的适用域必须由注册表 scope 支撑`).toBe('namespace');
      covered.add(kind);
    }
    expect(constructions.length, '构造面必须 = 13 型 + OPEN_NAMESPACE identity 两态').toBe(14);
    const expectedKinds = Object.entries(MESSAGE_REGISTRY)
      .filter(([kind, info]) => info.scope === 'namespace' && kind !== 'UPDATE_CHUNK')
      .map(([kind]) => kind as MessageName)
      .sort();
    expect(expectedKinds.length, 'namespace-scope 非 chunk 消息型必须恰 13 型（13 型逐型覆盖）').toBe(13);
    expect([...covered].sort(), '固定偏移构造面必须逐型覆盖全部 namespace-scope 非 chunk 消息型').toEqual(expectedKinds);
  });

  it('G2-b 13 条 namespace 域 golden 双面：golden 字节 + 带 sequence 重编码字节', () => {
    const goldens = GOLDEN.filter(
      (g) => g.message.kind !== 'UPDATE_CHUNK' && MESSAGE_REGISTRY[g.message.kind].scope === 'namespace',
    );
    expect(goldens.length, 'namespace 域非 chunk golden 必须恰 13 条').toBe(13);
    expect(new Set(goldens.map((g) => g.message.kind)).size, '13 条 golden 必须逐型覆盖').toBe(13);
    for (const g of goldens) {
      for (const [face, frame] of goldenFaces(g)) {
        const label = `${g.name}/${face}`;
        expect(frame.length >= NS_END_DOMAIN, `${label}: 帧长 ${frame.length} 不足以容纳 namespaceId`).toBe(true);
        expect(frame[HEADER_BYTES], `${label}: prefix@${HEADER_BYTES} = ${frame[HEADER_BYTES]} ≠ 0x23`).toBe(NS_BYTES);
        expect(frame[HEADER_BYTES]! < 0x80, `${label}: prefix 必须是单字节 canonical varUint`).toBe(true);
        expect(
          ascii(frame.subarray(NS_OFFSET_DOMAIN, NS_END_DOMAIN)),
          `${label}: namespaceId 不在 [${NS_OFFSET_DOMAIN}..${NS_END_DOMAIN})`,
        ).toBe(NS);
        expect(namespaceIdOf(decodeMessage(frame).message), `${label}: decode 回读 namespaceId`).toBe(NS);
      }
      expect(bytesToHex(hexToBytes(g.frameHex)), `${g.name}: golden 字节面与重编码面必须互锁`).toBe(
        bytesToHex(encode(g.message, { sequence: g.sequence })),
      );
    }
  });
});

// ---------------------------------------------------------------- G3 UPDATE_CHUNK kind-first

describe('G3 UPDATE_CHUNK kind-first 偏移（AC2 / RK-C2）：namespaceId ∈ [22..57)', () => {
  it('G3-a 6 组合（3 kind × 首/非首，含绑定块形态）：kind@20 + prefix@21 + namespaceId ∈ [22..57)', () => {
    for (const { label, transferKind, message } of chunkMessages(NS)) {
      const frame = encode(message);
      expect(frame[HEADER_BYTES], `${label}: kind@${HEADER_BYTES} = ${frame[HEADER_BYTES]} ≠ ${transferKind}`).toBe(transferKind);
      expect(frame[HEADER_BYTES + 1], `${label}: prefix@${HEADER_BYTES + 1} = ${frame[HEADER_BYTES + 1]} ≠ 0x23`).toBe(NS_BYTES);
      expect(frame[HEADER_BYTES + 1]! < 0x80, `${label}: prefix 必须是单字节 canonical varUint`).toBe(true);
      expect(
        ascii(frame.subarray(NS_OFFSET_CHUNK, NS_END_CHUNK)),
        `${label}: namespaceId 不在 [${NS_OFFSET_CHUNK}..${NS_END_CHUNK})`,
      ).toBe(NS);
      const chunk = decodedChunk(decodeMessage(frame, CAP_DECODE), label);
      expect(chunk.transferKind, `${label}: decode 回读 transferKind`).toBe(transferKind);
      expect(chunk.namespaceId, `${label}: decode 回读 namespaceId`).toBe(NS);
      expect(
        frame[HEADER_BYTES],
        `${label}: kind 与 varString 前缀不可同置（[21..56) 与 [22..57) 两条规则必须可判别）`,
      ).not.toBe(NS_BYTES);
    }
  });

  it('G3-b 绑定块不位移：同 kind 首/非首两帧的 namespaceId 实际起点一致且 = 22', () => {
    for (const transferKind of [0, 1, 2] as const) {
      const pair = chunkMessages(NS).filter((c) => c.transferKind === transferKind);
      const labels = pair.map((c) => c.label);
      expect(pair.length, `kind ${transferKind}: 必须恰有首/非首两帧，实得 ${labels.join(', ')}`).toBe(2);
      expect(labels.some((l) => l.includes('first')), `kind ${transferKind}: 必须构造首 chunk`).toBe(true);
      expect(labels.some((l) => l.includes('later')), `kind ${transferKind}: 必须构造非首 chunk`).toBe(true);
      if (transferKind !== 0) {
        expect(
          labels.filter((l) => l.includes('first')).every((l) => l.includes('binding')),
          `kind ${transferKind}: 首 chunk 必须携带绑定块形态（kind≠0 ∧ chunkIndex=0）`,
        ).toBe(true);
      }
      const positions = pair.map(({ label, message }) => {
        const frame = encode(message);
        const at = indexOfBytes(frame, nsBytes(NS));
        expect(at, `${label}: 帧内实际 namespaceId 起点 ${at} ≠ ${NS_OFFSET_CHUNK}（绑定块不得位移 namespaceId）`).toBe(
          NS_OFFSET_CHUNK,
        );
        return at;
      });
      expect(new Set(positions).size, `kind ${transferKind}: 首/非首 chunk 的 namespaceId 起点必须一致`).toBe(1);
    }
  });

  it('G3-c 三 kind 全覆盖 {0,1,2}（枚举锁）', () => {
    const kinds = chunkMessages(NS).map((c) => c.transferKind);
    expect(kinds.length, 'chunk 构造面 = 3 kind × 首/非首').toBe(6);
    expect([...new Set(kinds)].sort((a, b) => a - b), 'chunk 构造面必须覆盖 kind 三态').toEqual([0, 1, 2]);
  });

  it('G3-d 3 条 UPDATE_CHUNK golden 走 kind-first 规则（golden 字节 + 重编码字节双面）', () => {
    const goldens = GOLDEN.filter((g) => g.message.kind === 'UPDATE_CHUNK');
    expect(goldens.length, 'UPDATE_CHUNK golden 必须恰 3 条').toBe(3);
    const kinds = new Set<number>();
    for (const g of goldens) {
      const message = chunkMessageOf(g.message, g.name);
      kinds.add(message.transferKind);
      for (const [face, frame] of goldenFaces(g)) {
        const label = `${g.name}/${face}`;
        expect(frame[HEADER_BYTES], `${label}: kind@${HEADER_BYTES} = ${frame[HEADER_BYTES]} ≠ ${message.transferKind}`).toBe(
          message.transferKind,
        );
        expect(frame[HEADER_BYTES + 1], `${label}: prefix@${HEADER_BYTES + 1} = ${frame[HEADER_BYTES + 1]} ≠ 0x23`).toBe(NS_BYTES);
        expect(
          ascii(frame.subarray(NS_OFFSET_CHUNK, NS_END_CHUNK)),
          `${label}: namespaceId 不在 [${NS_OFFSET_CHUNK}..${NS_END_CHUNK})`,
        ).toBe(NS);
        const chunk = decodedChunk(decodeMessage(frame, CAP_DECODE), label);
        expect(chunk.transferKind, `${label}: decode 回读 transferKind`).toBe(message.transferKind);
        expect(chunk.namespaceId, `${label}: decode 回读 namespaceId`).toBe(NS);
      }
      expect(bytesToHex(hexToBytes(g.frameHex)), `${g.name}: golden 字节面与重编码面必须互锁`).toBe(
        bytesToHex(encode(g.message, { sequence: g.sequence })),
      );
    }
    expect([...kinds].sort((a, b) => a - b), '3 条 chunk golden 必须覆盖 kind 三态').toEqual([0, 1, 2]);
  });
});

// ---------------------------------------------------------------- G4 ERROR 字段序

describe('G4 ERROR 字段序（AC3 / RK-C3）：scope → code → fatal → retryable → relatedSequence? → namespaceId? → safeMessage', () => {
  it('G4-a 四象限 + fatal=false 样本：按 §13 序完整走查并与解码值面交叉', () => {
    const constructions = errorMessages(NS);
    const quadrants = new Set(
      constructions
        .filter(({ message }) => message.code !== 'ACK_TIMEOUT')
        .map(({ message }) => `${message.namespaceId === undefined ? 'conn' : 'ns'}/${message.relatedSequence === undefined ? 'no-related' : 'related'}`),
    );
    expect([...quadrants].sort(), 'ERROR 构造面必须覆盖四象限（连接级/namespace 级 × relatedSequence 有无）').toEqual([
      'conn/no-related',
      'conn/related',
      'ns/no-related',
      'ns/related',
    ]);
    for (const { label, message } of constructions) {
      const frame = encode(message);
      const walked = walkError(frame, label);
      const decoded = decodedError(decodeMessage(frame), label);
      expect(walked.scope, `${label}: scope@${HEADER_BYTES} 必须 = 0（连接级）/ 1（namespace 级）`).toBe(
        message.namespaceId === undefined ? 0 : 1,
      );
      expect(walked.code, `${label}: 走查 code 必须紧随 scope(u8)`).toBe(message.code);
      expect(decoded.code, `${label}: decode 回读 code`).toBe(message.code);
      expect(walked.relatedSequence, `${label}: 走查 relatedSequence 位置/值`).toBe(message.relatedSequence);
      expect(decoded.relatedSequence, `${label}: decode 回读 relatedSequence`).toBe(message.relatedSequence);
      expect(walked.namespaceId, `${label}: 走查 namespaceId（必须后于 relatedSequence、先于 safeMessage）`).toBe(
        message.namespaceId,
      );
      expect(decoded.namespaceId, `${label}: decode 回读 namespaceId`).toBe(message.namespaceId);
      expect(walked.safeMessage, `${label}: 走查 safeMessage（末字段，零尾随）`).toBe(message.safeMessage);
      expect(decoded.safeMessage, `${label}: decode 回读 safeMessage`).toBe(message.safeMessage);
    }
    expect(constructions.some(({ message }) => message.code === 'ACK_TIMEOUT'), 'fatal=false 的 wire 位形态样本必须在位').toBe(true);
  });

  it(`G4-b namespace 级：namespaceId 不在 [21..56)（该窗口是 code）且距 payload 起点 ≤ ${ERROR_NS_PREFIX_BUDGET}`, () => {
    const cases = errorMessages(NS).filter(({ message }) => message.namespaceId !== undefined);
    expect(cases.length, 'namespace 级 ERROR 用例数（四象限两例 + fatal=false 样本）').toBe(3);
    for (const { label, message } of cases) {
      const frame = encode(message);
      const walked = walkError(frame, label);
      expect(walked.nsStart, `${label}: namespace 级 ERROR 必须携带 namespaceId`).toBeGreaterThan(0);
      expect(
        bytesToHex(frame.subarray(NS_OFFSET_DOMAIN, NS_END_DOMAIN)),
        `${label}: [${NS_OFFSET_DOMAIN}..${NS_END_DOMAIN}) 窗口内是 code，绝不能被当作 namespaceId 提取`,
      ).not.toBe(bytesToHex(nsBytes(NS)));
      const distance = walked.nsStart - HEADER_BYTES;
      expect(
        distance,
        `${label}: namespaceId 距 payload 起点 ${distance} 字节，超出 edge mini-decode 有界预算 ${ERROR_NS_PREFIX_BUDGET}`,
      ).toBeLessThanOrEqual(ERROR_NS_PREFIX_BUDGET);
    }
  });

  it('G4-c 连接级：帧内字节级不含 namespaceId（不做整帧 UTF-8 解码）', () => {
    const cases = errorMessages(NS).filter(({ message }) => message.namespaceId === undefined);
    expect(cases.length, '连接级 ERROR 用例数（relatedSequence 有无）').toBe(2);
    for (const { label, message } of cases) {
      const frame = encode(message);
      const walked = walkError(frame, label);
      expect(walked.scope, `${label}: 连接级 ERROR scope 必须是 0`).toBe(0);
      expect(walked.namespaceId, `${label}: 连接级 ERROR 不得携带 namespaceId 字段`).toBeUndefined();
      expect(indexOfBytes(frame, nsBytes(NS)), `${label}: 连接级帧内不得出现 namespaceId 字节`).toBe(-1);
      expect(frame[HEADER_BYTES], `${label}: 连接级 ERROR 首字段是 scope，不得是 0x23`).not.toBe(NS_BYTES);
    }
  });

  it('G4-d 最坏用例（最长 namespace 错误码 + relatedSequence = 0xffffffff）：前缀公式逐项核对且在预算内', () => {
    const longestCode = Object.keys(NAMESPACE_ERRORS).reduce((a, b) => (b.length > a.length ? b : a));
    // §13 字段序逐项（不含 namespaceId 本体）：scope(1) + code 长度前缀(1) + code 字节 + fatal(1)
    // + retryable(1) + relatedSequence marker(1) + varUint32 最长 5 字节 + namespaceId marker(1)。
    const expectedPrefix = 1 + NS_PREFIX_BYTES + longestCode.length + 1 + 1 + 1 + 5 + 1;
    const frame = encode({ kind: 'ERROR', code: longestCode, relatedSequence: 0xffffffff, namespaceId: NS, safeMessage: 'x' });
    const walked = walkError(frame, `worst/${longestCode}`);
    expect(walked.nsStart > 0, '最坏 ERROR 必须携带 namespaceId').toBe(true);
    expect(
      walked.nsStart - HEADER_BYTES,
      `worst/${longestCode}: namespaceId 距 payload 起点 ${walked.nsStart - HEADER_BYTES} ≠ 字段序公式 ${expectedPrefix}`,
    ).toBe(expectedPrefix);
    expect(
      walked.nsStart - HEADER_BYTES,
      `worst/${longestCode}: 前缀 ${expectedPrefix} 字节超出预算 ${ERROR_NS_PREFIX_BUDGET}`,
    ).toBeLessThanOrEqual(ERROR_NS_PREFIX_BUDGET);
    expect(walked.relatedSequence, 'relatedSequence 5 字节 varUint 极值回读').toBe(0xffffffff);
    expect(walked.namespaceId, '最坏用例 namespaceId 回读').toBe(NS);
  });

  it('G4-e 2 条 ERROR golden（连接级/namespace 级）双面走查：首字段是 scope 不是 0x23', () => {
    const goldens = GOLDEN.filter((g) => g.message.kind === 'ERROR');
    expect(goldens.length, 'ERROR golden 必须恰 2 条').toBe(2);
    const scopes = new Set<number>();
    for (const g of goldens) {
      const expected = errorMessageOf(g.message, g.name);
      for (const [face, frame] of goldenFaces(g)) {
        const label = `${g.name}/${face}`;
        const walked = walkError(frame, label);
        scopes.add(walked.scope);
        expect(walked.code, `${label}: 走查 code`).toBe(expected.code);
        expect(walked.relatedSequence, `${label}: 走查 relatedSequence`).toBe(expected.relatedSequence);
        expect(walked.namespaceId, `${label}: 走查 namespaceId`).toBe(expected.namespaceId);
        expect(walked.safeMessage, `${label}: 走查 safeMessage`).toBe(expected.safeMessage);
        expect(
          frame[HEADER_BYTES],
          `${label}: ERROR 首字段是 scope，不得被 [21..56) 固定偏移规则误纳`,
        ).not.toBe(NS_BYTES);
        const decoded = decodedError(decodeMessage(frame), label);
        expect(decoded.namespaceId, `${label}: decode 回读 namespaceId`).toBe(expected.namespaceId);
      }
      expect(bytesToHex(hexToBytes(g.frameHex)), `${g.name}: golden 字节面与重编码面必须互锁`).toBe(
        bytesToHex(encode(g.message, { sequence: g.sequence })),
      );
    }
    expect([...scopes].sort((a, b) => a - b), 'ERROR golden 必须覆盖连接级(0)与 namespace 级(1)两 scope').toEqual([0, 1]);
  });
});

// ---------------------------------------------------------------- G5 差分推导

describe('G5 差分推导（AC4 / RK-C4）：偏移事实可由行为面复得（零新增 codec 常量）', () => {
  it('G5-a 5 个代表构造：同型两帧仅 namespaceId 值不同 → 差异窗口 = 字段窗口去掉不变成分', () => {
    const cases: Array<{ label: string; make: (ns: string) => ReplicationMessage; fieldStart: number; fieldEnd: number }> = [
      { label: 'UPDATE', make: (ns) => ({ kind: 'UPDATE', namespaceId: ns, update: Uint8Array.from([1, 2]) }), fieldStart: NS_OFFSET_DOMAIN, fieldEnd: NS_END_DOMAIN },
      { label: 'CLOSE_OK', make: (ns) => ({ kind: 'CLOSE_OK', namespaceId: ns, ackedSequence: 1 }), fieldStart: NS_OFFSET_DOMAIN, fieldEnd: NS_END_DOMAIN },
      { label: 'RESYNC_REQUIRED', make: (ns) => ({ kind: 'RESYNC_REQUIRED', namespaceId: ns, reasonCode: 'ACK_TIMEOUT' }), fieldStart: NS_OFFSET_DOMAIN, fieldEnd: NS_END_DOMAIN },
      { label: 'UPDATE_CHUNK/kind0', make: (ns) => ({ kind: 'UPDATE_CHUNK', transferKind: 0, namespaceId: ns, transferId: 1, chunkIndex: 0, chunkCount: 1, totalBytes: 3, bytes: Uint8Array.from([1, 2, 3]) }), fieldStart: NS_OFFSET_CHUNK, fieldEnd: NS_END_CHUNK },
      { label: 'UPDATE_CHUNK/kind2-first', make: (ns) => ({ kind: 'UPDATE_CHUNK', transferKind: 2, namespaceId: ns, transferId: 1, chunkIndex: 0, chunkCount: 1, totalBytes: 3, syncRoundId: 5, bytes: Uint8Array.from([1, 2, 3]) }), fieldStart: NS_OFFSET_CHUNK, fieldEnd: NS_END_CHUNK },
    ];
    expect(cases.length, '差分代表构造（3 域型 + 2 chunk 型）').toBe(5);
    for (const { label, make, fieldStart, fieldEnd } of cases) {
      const a = encode(make(NS_A));
      const b = encode(make(NS_B));
      expect(a.length, `${label}: 同型两帧长度必须相等`).toBe(b.length);
      let first = -1;
      let last = -1;
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
          if (first === -1) first = i;
          last = i;
        }
      }
      expect(
        first,
        `${label}: 差分值域起点 ${first} ≠ ${fieldStart + VALUE_INVARIANT_BYTES}（偏移事实必须可由行为面复得）`,
      ).toBe(fieldStart + VALUE_INVARIANT_BYTES);
      expect(last + 1, `${label}: 差分值域终点 ${last + 1} ≠ ${fieldEnd}`).toBe(fieldEnd);
      expect(a[fieldStart - 1], `${label}: 字段窗口前一字节必须是 varString 长度前缀 0x23`).toBe(NS_BYTES);
      expect(
        bytesToHex(a.subarray(fieldStart - 1, first)),
        `${label}: 窗口内不变成分（长度前缀 + 'ns-'）必须逐字节稳定`,
      ).toBe(bytesToHex(b.subarray(fieldStart - 1, first)));
      expect(ascii(a.subarray(fieldStart - 1, first)), `${label}: 窗口头部 = 长度前缀 + 'ns-'`).toBe(
        `${String.fromCharCode(NS_BYTES)}ns-`,
      );
      expect(ascii(a.subarray(first, last + 1)), `${label}: 值域 A 必须是 NS_A 去掉不变成分`).toBe(NS_A.slice(3));
      expect(ascii(b.subarray(first, last + 1)), `${label}: 值域 B 必须是 NS_B 去掉不变成分`).toBe(NS_B.slice(3));
      expect(ascii(a.subarray(fieldStart, fieldEnd)), `${label}: 登记字段窗口必须等于 namespaceId 全量`).toBe(NS_A);
    }
  });
});

// ---------------------------------------------------------------- G6 负控

describe('G6 负控（RK-C5）：非恒真 + 两条规则可判别 + 语料级双向锁定', () => {
  it('NC1 连接级帧无路由键（HELLO / HELLO_ACK / GOAWAY / 连接级 ERROR）', () => {
    const frames: Array<[string, ReplicationMessage]> = [
      ['HELLO', { kind: 'HELLO', peerInstanceId: 'peer-a', expectedHubInstanceId: 'hub-a', protocolVersions: [1], requiredCapabilities: 0, optionalCapabilities: 0, connectionNonce: Uint8Array.from({ length: 16 }) }],
      ['HELLO_ACK', { kind: 'HELLO_ACK', hubInstanceId: 'hub-a', protocolVersion: 1, selectedCapabilities: 0, connectionNonce: Uint8Array.from({ length: 16 }), connectionId: 'conn-1' }],
      ['GOAWAY', { kind: 'GOAWAY', reasonCode: 'SERVER_RESTARTING', drainTimeoutMs: 5000 }],
      ['ERROR/connection', { kind: 'ERROR', code: 'BAD_MAGIC', safeMessage: 'bad magic' }],
    ];
    for (const [label, message] of frames) {
      const frame = encode(message);
      expect(frame[HEADER_BYTES], `${label}: 连接级帧不得以 0x23 长度前缀开头`).not.toBe(NS_BYTES);
      expect(indexOfBytes(frame, nsBytes(NS)), `${label}: 连接级帧不得含 namespaceId 字节`).toBe(-1);
      decodeMessage(frame); // 仍须可解码（负控不是「拒绝」而是「无路由键」）
    }
  });

  it('NC2 注册表 scope 判别：namespace-scope 恰 14 型、ERROR = either、UPDATE_CHUNK 不得被 [21..56) 误纳', () => {
    const namespaceKinds = Object.entries(MESSAGE_REGISTRY)
      .filter(([, info]) => info.scope === 'namespace')
      .map(([kind]) => kind);
    expect(namespaceKinds.length, '注册表 namespace-scope 必须恰 14 型（18 − 3 连接级 − ERROR either）').toBe(14);
    expect(namespaceKinds, 'UPDATE_CHUNK 必为 namespace scope（kind 首字段是域内例外）').toContain('UPDATE_CHUNK');
    expect(MESSAGE_REGISTRY.ERROR.scope, 'ERROR 为 either（固定偏移规则的例外）').toBe('either');
    expect(
      namespaceKinds.filter((kind) => kind !== 'UPDATE_CHUNK').length,
      '固定偏移 [21..56) 规则的适用型数必须 = 13（排除 kind-first 的 UPDATE_CHUNK）',
    ).toBe(13);
    const chunk = encode({
      kind: 'UPDATE_CHUNK',
      transferKind: 1,
      namespaceId: NS,
      transferId: 1,
      chunkIndex: 0,
      chunkCount: 1,
      totalBytes: 1,
      replicationId: RID,
      replicationEpoch: 1,
      bytes: Uint8Array.from([1]),
    });
    expect(chunk[HEADER_BYTES], 'UPDATE_CHUNK 首字节是 kind，不得被 [21..56) 规则误纳').not.toBe(NS_BYTES);
    expect(chunk[HEADER_BYTES + 1], 'UPDATE_CHUNK 的 varString 前缀必须落在 kind 之后的 1 字节处').toBe(NS_BYTES);
  });

  it('NC3 21 条 golden 语料级判别：fixed = 13 / chunk = 3 / error = 2 + 例外集合恰 8 元素', () => {
    expect(GOLDEN.length, 'golden 语料必须恰 21 条（13 域型 + 3 chunk + 2 ERROR + 3 连接级）').toBe(21);
    let fixed = 0;
    let chunkRule = 0;
    let errorRule = 0;
    const exceptions: string[] = [];
    for (const g of GOLDEN) {
      const frame = hexToBytes(g.frameHex);
      const scope = MESSAGE_REGISTRY[g.message.kind].scope;
      const isFixed =
        frame[HEADER_BYTES] === NS_BYTES &&
        bytesToHex(frame.subarray(NS_OFFSET_DOMAIN, NS_END_DOMAIN)) === bytesToHex(nsBytes(NS));
      if (isFixed) {
        fixed++;
        expect(g.message.kind, `${g.name}: UPDATE_CHUNK 不得落固定偏移规则`).not.toBe('UPDATE_CHUNK');
        expect(g.message.kind, `${g.name}: ERROR 不得落固定偏移规则`).not.toBe('ERROR');
        expect(scope, `${g.name}: 落固定偏移者必须是 namespace scope`).toBe('namespace');
      } else {
        exceptions.push(g.name);
        if (g.message.kind === 'UPDATE_CHUNK') {
          chunkRule++;
          expect(frame[HEADER_BYTES]! <= 2, `${g.name}: UPDATE_CHUNK kind@${HEADER_BYTES} 必须 ∈ {0,1,2}`).toBe(true);
          expect(frame[HEADER_BYTES + 1], `${g.name}: UPDATE_CHUNK prefix@${HEADER_BYTES + 1} ≠ 0x23`).toBe(NS_BYTES);
          expect(
            ascii(frame.subarray(NS_OFFSET_CHUNK, NS_END_CHUNK)),
            `${g.name}: UPDATE_CHUNK namespaceId 不在 [${NS_OFFSET_CHUNK}..${NS_END_CHUNK})`,
          ).toBe(NS);
        } else if (g.message.kind === 'ERROR') {
          errorRule++;
          expect(frame[HEADER_BYTES], `${g.name}: ERROR 首字段是 scope，不得以 0x23 开头`).not.toBe(NS_BYTES);
        } else {
          expect(scope, `${g.name}: 非固定偏移且非 UPDATE_CHUNK/ERROR 者必须 connection scope`).toBe('connection');
        }
      }
    }
    expect(fixed, `21 条 golden 中固定偏移命中数必须 = 13，实得 ${fixed}`).toBe(13);
    expect(chunkRule, 'UPDATE_CHUNK golden 覆盖数必须 = 3（kind 三态全量）').toBe(3);
    expect(errorRule, 'ERROR golden 覆盖数必须 = 2（连接级/namespace 级）').toBe(2);
    expect(exceptions.sort(), '例外集合必须恰为 8 元素（两规则不得互相误纳）').toEqual([
      'ERROR_CONN',
      'ERROR_NS',
      'GOAWAY',
      'HELLO',
      'HELLO_ACK',
      'UPDATE_CHUNK_BASIC',
      'UPDATE_CHUNK_MULTIBYTE',
      'UPDATE_CHUNK_U32_MAX',
    ]);
  });
});
