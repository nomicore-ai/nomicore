/**
 * issue #418 决策 4（ADR 0032）**codec 侧结构性守卫测试**：namespace 域帧的路由键定偏移布局。
 *
 * edge 半边（`hub-edge.ts`）以 O(帧头) 定偏移只读提取路由键、**不从解码对象取**：
 * - 标准 namespace 域帧：`namespaceId` 是 payload 首字段（varString）⟹ 前缀字节 `[20] == 0x23`
 *   （35）、id 窗口 `[21..56)`；
 * - `UPDATE_CHUNK`（0x42）：kind 首字段（varUint ∈ {0,1,2}，1 字节）先于 namespaceId
 *   ⟹ 前缀 `[21] == 0x23`、id 窗口 `[22..57)`；
 * - `ERROR`（namespace scope）：**例外**——scope 字节先于 code/namespaceId，路由键取解码值
 *   （有界 mini-decode 等价形态），不适用定偏移表（本文件以负控钉死该例外）；
 * - 连接级帧（HELLO_ACK 负控）：`[20..56)` 不是 namespaceId。
 *
 * 任何 codec 字段序/文法变化（例如在 namespaceId 前插入字段）都使本文件变红——这是 edge
 * 路由表（`routingKeyOf` 的结构一致性断言）的字节前提守卫。断言面 = 真实编码字节，
 * 零源码字符串断言、零 skip/only/todo。
 */
import { describe, expect, it } from 'vitest';
import { encodeMessage, type ReplicationMessage } from '../src/index.js';

const NS = `ns-${'a1'.repeat(16)}`; // 35 ASCII（`ns-` + 32 小写 hex）
const OTHER_NS = `ns-${'b2'.repeat(16)}`;
const REPLICATION_ID = '0'.repeat(31) + '2';

/** namespaceId varString 长度前缀（35 ASCII ⟹ 恒 1 字节）。 */
const NS_PREFIX = 35;
/** 标准 namespace 域帧的定偏移窗口。 */
const STANDARD_PREFIX_INDEX = 20;
const STANDARD_ID_START = 21;
/** UPDATE_CHUNK 的定偏移窗口（kind 首字段 1 字节）。 */
const CHUNK_PREFIX_INDEX = 21;
const CHUNK_ID_START = 22;

function bytesToAscii(bytes: Uint8Array, start: number, end: number): string {
  let out = '';
  for (let index = start; index < end; index += 1) out += String.fromCharCode(bytes[index]!);
  return out;
}

function encode(message: ReplicationMessage): Uint8Array {
  return encodeMessage(message, { sequence: 1 });
}

/** 全部 namespace 域 kind 的最小合法消息（namespaceId 恒为 NS）。 */
const NAMESPACE_SCOPED_MESSAGES: ReadonlyArray<{ kind: string; message: ReplicationMessage }> = [
  { kind: 'OPEN_NAMESPACE', message: { kind: 'OPEN_NAMESPACE', namespaceId: NS, hasLocalReplica: false } },
  {
    kind: 'OPEN_OK',
    message: { kind: 'OPEN_OK', namespaceId: NS, mode: 0, replicationId: REPLICATION_ID, replicationEpoch: 1 },
  },
  { kind: 'CLOSE_NAMESPACE', message: { kind: 'CLOSE_NAMESPACE', namespaceId: NS, reasonCode: 'peer-close' } },
  { kind: 'CLOSE_OK', message: { kind: 'CLOSE_OK', namespaceId: NS, ackedSequence: 4 } },
  {
    kind: 'BOOTSTRAP_SNAPSHOT',
    message: {
      kind: 'BOOTSTRAP_SNAPSHOT',
      namespaceId: NS,
      replicationId: REPLICATION_ID,
      replicationEpoch: 1,
      snapshot: new Uint8Array([1, 2, 3]),
    },
  },
  { kind: 'BOOTSTRAP_ACK', message: { kind: 'BOOTSTRAP_ACK', namespaceId: NS, ackedSequence: 3 } },
  {
    kind: 'IDENTITY_CHANGED',
    message: { kind: 'IDENTITY_CHANGED', namespaceId: NS, replicationId: REPLICATION_ID, replicationEpoch: 2 },
  },
  {
    kind: 'SYNC_STEP1',
    message: { kind: 'SYNC_STEP1', namespaceId: NS, syncRoundId: 1, stateVector: new Uint8Array([0]) },
  },
  {
    kind: 'SYNC_STEP2',
    message: {
      kind: 'SYNC_STEP2',
      namespaceId: NS,
      syncRoundId: 1,
      relatedStep1Sequence: 3,
      update: new Uint8Array([1]),
    },
  },
  {
    kind: 'SYNC_APPLIED',
    message: { kind: 'SYNC_APPLIED', namespaceId: NS, syncRoundId: 1, ackedSequence: 5 },
  },
  { kind: 'RESYNC_REQUIRED', message: { kind: 'RESYNC_REQUIRED', namespaceId: NS, reasonCode: 'STATE_DIVERGED' } },
  { kind: 'UPDATE', message: { kind: 'UPDATE', namespaceId: NS, update: new Uint8Array([7]) } },
  { kind: 'UPDATE_ACK', message: { kind: 'UPDATE_ACK', namespaceId: NS, ackedSequence: 9 } },
];

const UPDATE_CHUNK_MESSAGES: ReadonlyArray<{ kind: string; message: ReplicationMessage }> = [
  {
    kind: 'UPDATE_CHUNK(kind=0)',
    message: {
      kind: 'UPDATE_CHUNK',
      transferKind: 0,
      namespaceId: NS,
      transferId: 1,
      chunkIndex: 0,
      chunkCount: 1,
      totalBytes: 1,
      bytes: new Uint8Array([1]),
    },
  },
  {
    kind: 'UPDATE_CHUNK(kind=1)',
    message: {
      kind: 'UPDATE_CHUNK',
      transferKind: 1,
      namespaceId: NS,
      transferId: 1,
      chunkIndex: 0,
      chunkCount: 1,
      totalBytes: 1,
      bytes: new Uint8Array([1]),
      replicationId: REPLICATION_ID,
      replicationEpoch: 1,
    },
  },
  {
    kind: 'UPDATE_CHUNK(kind=2)',
    message: {
      kind: 'UPDATE_CHUNK',
      transferKind: 2,
      namespaceId: NS,
      transferId: 1,
      chunkIndex: 0,
      chunkCount: 1,
      totalBytes: 1,
      bytes: new Uint8Array([1]),
      syncRoundId: 1,
    },
  },
];

describe('决策 4 守卫：namespace 域帧 namespaceId 恒在定偏移窗口（edge 路由键字节前提）', () => {
  it('标准 namespace 域帧：前缀 [20] == 35 且 [21..56) == namespaceId', () => {
    for (const { kind, message } of NAMESPACE_SCOPED_MESSAGES) {
      const bytes = encode(message);
      expect(bytes[STANDARD_PREFIX_INDEX], `${kind} 前缀字节`).toBe(NS_PREFIX);
      expect(bytesToAscii(bytes, STANDARD_ID_START, STANDARD_ID_START + NS_PREFIX), kind).toBe(NS);
    }
  });

  it('UPDATE_CHUNK：kind 首字段 1 字节 ⟹ 前缀 [21] == 35 且 [22..57) == namespaceId', () => {
    for (const { kind, message } of UPDATE_CHUNK_MESSAGES) {
      const bytes = encode(message);
      expect(bytes[CHUNK_PREFIX_INDEX], `${kind} 前缀字节`).toBe(NS_PREFIX);
      expect(bytesToAscii(bytes, CHUNK_ID_START, CHUNK_ID_START + NS_PREFIX), kind).toBe(NS);
      // 负控：标准偏移在 UPDATE_CHUNK 上不是 namespaceId（kind 首字段占位）
      expect(bytes[STANDARD_PREFIX_INDEX], `${kind} 标准偏移负控`).not.toBe(NS_PREFIX);
    }
  });

  it('定偏移读数 == 解码值（全部 kind 双 ns 无歧义）', () => {
    const messages: ReplicationMessage[] = [
      ...NAMESPACE_SCOPED_MESSAGES.map((entry) => entry.message),
      ...UPDATE_CHUNK_MESSAGES.map((entry) => entry.message),
    ];
    for (const template of messages) {
      for (const namespaceId of [NS, OTHER_NS]) {
        const message = { ...template, namespaceId } as ReplicationMessage;
        const bytes = encode(message);
        const chunk = message.kind === 'UPDATE_CHUNK';
        const start = chunk ? CHUNK_ID_START : STANDARD_ID_START;
        expect(bytesToAscii(bytes, start, start + NS_PREFIX)).toBe(namespaceId);
      }
    }
  });

  it('例外负控：namespace scope ERROR 的定偏移窗口不是 namespaceId（路由取解码值）', () => {
    const bytes = encode({
      kind: 'ERROR',
      code: 'NAMESPACE_STATE_VIOLATION',
      safeMessage: 'protocol error: NAMESPACE_STATE_VIOLATION',
      namespaceId: NS,
    });
    expect(bytesToAscii(bytes, STANDARD_ID_START, STANDARD_ID_START + NS_PREFIX)).not.toBe(NS);
  });

  it('连接级帧负控：HELLO_ACK 的 [20..56) 不是 namespaceId（不上 ns 路由表）', () => {
    const bytes = encode({
      kind: 'HELLO_ACK',
      hubInstanceId: 'hub-omega',
      protocolVersion: 1,
      selectedCapabilities: 0,
      connectionNonce: new Uint8Array(16).fill(0x80),
      connectionId: 'hub-omega-conn-0',
    });
    expect(bytesToAscii(bytes, STANDARD_ID_START, STANDARD_ID_START + NS_PREFIX)).not.toBe(NS);
    expect(bytes[STANDARD_PREFIX_INDEX]).not.toBe(NS_PREFIX);
  });
});
