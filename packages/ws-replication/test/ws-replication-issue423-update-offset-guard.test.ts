/**
 * 结构守卫测试 — issue #423（spec #415 T6）：**edge 盖章点 `update-sent` 的定偏移判定 vs
 * codec UPDATE 布局**（ADR 0032 决策 4「布局与 codec 字段序登记为同步维护契约，加结构性
 * 守卫测试」的扩展适用；设计 §D2.3/§D6、SA2 O5）。
 *
 * 被测行为（生产实现 `packages/ws-replication/src/hub-edge.ts`：`updateFrameProbe` +
 * `emitUpdateSentAtStamp`，经 `port.sendDataFrame` 出面可观察）：
 *   OG-1 载荷长度判定 === `decodeMessage(frame).message.update.byteLength`——跨 lib0
 *        varUint 长度前缀 1/2/3 字节边界（127|128、16383|16384）与确定性随机取样；
 *        每帧恰一 `update-sent`，`bytes`/`namespaceId`/`sequence` = 帧字节事实，
 *        无 observer `connectionId`（握手前）与 `sendQueueMs`（无记账）——键集逐字锚定；
 *   OG-2 型门：UPDATE_CHUNK（0x42，id 窗口 `[22,57)`）与非 UPDATE 数据帧零事件
 *        （「非任何帧都发」负控；返回序列不受观测面影响）；
 *   OG-3 id 窗口守卫：`[20]` 长度前缀被腐蚀 → 零事件（与 RK-C1 同源的布局契约）；
 *   OG-4 D6 防御分支（SA2 O5）：短帧 / 声明长度不自洽 / 非规范 varUint 续位 → **零 throw、
 *        零事件、返回值与 wire 序列不受影响**（观测面失败绝不改变协议结果，§23.4）；
 *   OG-5 缝上 append-only 记账投影在场 ⇒ `sendQueueMs` 键在场且取值透传（缺面 = 整键缺席）。
 *
 * 纪律：断言 = 运行时行为（wire 原字节 / observer 事件对象 / 返回值）；零源码 grep；
 * 零 skip/only/todo；零 env override；零 mock 被测对象（transport 桩只落在缝的另一侧）。
 */
import { describe, expect, it } from 'vitest';
import { MESSAGE_TYPES, decodeMessage, encodeMessage } from '@nomicore/replication-protocol';
import type { ReplicationObserverEvent, ReplicationTimer } from '@nomicore/ws-replication';
import { createHubReplicationEdge as createInternalEdge, type HubReplicationEdge } from '../src/hub-edge.js';
import type { HubSessionEdgePort } from '../src/hub-split.js';
import { resolveLimits, resolveTimeouts } from '../src/defaults.js';

// ═══════════════════════════ 局部 fixture ═══════════════════════════

const HUB_INSTANCE = 'hub-omega';
const PEER_INSTANCE = 'peer-alpha';
const NS_A = `ns-${'0'.repeat(31)}1`;

/** namespaceId varString 长度前缀（35 = `'ns-'` + 32 hex；部署常量 `hub-edge.ts` 定偏移 `[20]`）。 */
const ID_LENGTH_PREFIX = 0x23;
/** envelope 头 20 字节 + id 前缀 1 字节 + 35 字节 id = UPDATE 帧的最小结构长度。 */
const UPDATE_FRAME_MIN_BYTES = 20 + 1 + 35;

function rawSequence(bytes: Uint8Array): number {
  return (((bytes[8]! << 24) | (bytes[9]! << 16) | (bytes[10]! << 8) | bytes[11]!) >>> 0);
}

function makeFakeTimer(): ReplicationTimer {
  let counter = 0;
  const pending = new Map<number, () => void>();
  return {
    setTimeout: (callback: () => void) => {
      counter += 1;
      pending.set(counter, callback);
      return counter;
    },
    clearTimeout: (handle: unknown) => {
      pending.delete(handle as number);
    },
  };
}

interface GuardFixture {
  readonly port: HubSessionEdgePort;
  readonly edge: HubReplicationEdge;
  readonly events: ReplicationObserverEvent[];
  readonly sent: Uint8Array[];
}

/** edge 半边独立实例化（内存管道；sessionFactory 捕获缝 port——与 SA6 契约同款夹具形态）。 */
function makeGuardFixture(limitsOverride?: Readonly<{ maxQueuedBytesPerConnection?: number }>): GuardFixture {
  const events: ReplicationObserverEvent[] = [];
  const sent: Uint8Array[] = [];
  let captured: HubSessionEdgePort | undefined;
  const edge = createInternalEdge({
    transport: {
      send: (bytes) => {
        sent.push(bytes);
      },
      close: () => undefined,
      closed: false,
      onMessage: () => () => undefined,
      onClose: () => () => undefined,
    },
    timer: makeFakeTimer(),
    limits: resolveLimits(limitsOverride),
    timeouts: resolveTimeouts(undefined),
    observer: (event) => {
      events.push(event);
    },
    instanceId: HUB_INSTANCE,
    peerInstanceId: PEER_INSTANCE,
    connectionCounter: 0,
    authorize: () => Promise.resolve({ ok: false }),
    earlyFrames: [],
    sessionFactory: (port) => {
      captured = port;
      return {
        openNamespace: () => undefined,
        namespaceFrame: () => undefined,
        close: () => Promise.resolve(),
        terminateNamespace: () => Promise.resolve(),
        dataFacetOf: () => undefined,
        channels: new Map(),
      };
    },
    onConnectionDropped: () => undefined,
  });
  if (captured === undefined) throw new Error('fixture: 缝 port 未捕获');
  return { port: captured, edge, events, sent };
}

async function closeFixture(fixture: GuardFixture): Promise<void> {
  fixture.edge.close(1001, 'test');
  await fixture.edge.settle();
}

function updateFrame(namespaceId: string, updateBytes: number): Uint8Array {
  return encodeMessage(
    { kind: 'UPDATE', namespaceId, update: new Uint8Array(updateBytes).fill(0x42) },
    { sequence: 0 },
  );
}

function updateSentOf(events: readonly ReplicationObserverEvent[]): Array<
  Extract<ReplicationObserverEvent, { type: 'update-sent' }>
> {
  return events.filter(
    (event): event is Extract<ReplicationObserverEvent, { type: 'update-sent' }> =>
      event.type === 'update-sent',
  );
}

/** 确定性伪随机取样（可复现，零 flake；覆盖各 varUint 长度带的非边界值）。 */
function sampledLengths(): number[] {
  let state = 423;
  const next = (): number => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state;
  };
  return [1 + (next() % 126), 128 + (next() % 16_256), 16_384 + (next() % 40_000)];
}

/** varUint 长度前缀的字节数（lib0 canonical：7bit 组，最小字节数编码）。 */
function varUintByteCount(value: number): number {
  if (value < 128) return 1;
  if (value < 16_384) return 2;
  if (value < 2_097_152) return 3;
  if (value < 268_435_456) return 4;
  return 5;
}

// ═══════════════════════════ OG-1：长度判定 vs codec 布局 ═══════════════════════════

describe('issue #423 OG-1：定偏移载荷长度判定 === codec decoded 长度（跨 varUint 1/2/3 字节边界）', () => {
  it('OG-1a：边界长度（127/128、16383/16384/16385）逐值相等且恰一 update-sent', async () => {
    const fixture = makeGuardFixture();
    const lengths = [1, 23, 127, 128, 129, 1_000, 16_383, 16_384, 16_385, ...sampledLengths()];
    for (const length of lengths) {
      const frame = updateFrame(NS_A, length);
      const decoded = decodeMessage(frame).message;
      if (decoded.kind !== 'UPDATE') throw new Error('OG-1a: UPDATE 形态断言失败');
      expect(decoded.update.byteLength, `OG-1a: fixture 长度 ${length}`).toBe(length);
      expect(frame[5], 'OG-1a: 型码 = UPDATE（0x40，单源 MESSAGE_TYPES）').toBe(MESSAGE_TYPES.UPDATE);
      expect(frame.byteLength).toBe(
        20 + 1 + 35 + varUintByteCount(length) + length,
      );
      const before = fixture.events.length;
      const sequence = fixture.port.sendDataFrame(frame);
      expect(sequence, `OG-1a: 长度 ${length} 的帧必须被接纳（盖章）`).toBeGreaterThan(0);
      const wire = fixture.sent[fixture.sent.length - 1]!;
      expect(rawSequence(wire), 'OG-1a: 返回值 = wire [8..12]').toBe(sequence);
      const emitted = updateSentOf(fixture.events.slice(before));
      expect(emitted, `OG-1a: 长度 ${length} 必须恰一 update-sent`).toHaveLength(1);
      expect(emitted[0]).toMatchObject({
        type: 'update-sent',
        side: 'hub',
        namespaceId: NS_A,
        bytes: decoded.update.byteLength,
        sequence,
      });
      expect(emitted[0]!.bytes, `OG-1a: 长度 ${length} 判定值 == decoded 值`).toBe(length);
      // 键集逐字锚定（§23.1 update-sent 行）：握手前无 connectionId、无记账 ⇒ 无 sendQueueMs。
      expect(Object.keys(emitted[0]!).sort()).toEqual([
        'bytes',
        'namespaceId',
        'sequence',
        'side',
        'type',
      ]);
    }
    await closeFixture(fixture);
  });

  it('OG-1b：不同 namespaceId 逐帧判定（路由键取自帧字节，非投影）', async () => {
    const fixture = makeGuardFixture();
    const other = `ns-${'f'.repeat(32)}`;
    for (const namespaceId of [NS_A, other]) {
      const frame = updateFrame(namespaceId, 300);
      const before = fixture.events.length;
      fixture.port.sendDataFrame(frame);
      const emitted = updateSentOf(fixture.events.slice(before));
      expect(emitted).toHaveLength(1);
      expect(emitted[0]!.namespaceId).toBe(namespaceId);
      expect(emitted[0]!.bytes).toBe(300);
    }
    await closeFixture(fixture);
  });
});

// ═══════════════════════════ OG-2：型门（负控） ═══════════════════════════

describe('issue #423 OG-2：型门——非 UPDATE 数据帧零 update-sent（非「任何帧都发」）', () => {
  it('OG-2a：UPDATE_CHUNK（0x42，id 窗口 [22,57)）经 data 面出站 → 零事件、返回值不受影响', async () => {
    const fixture = makeGuardFixture();
    const chunk = encodeMessage(
      {
        kind: 'UPDATE_CHUNK',
        transferKind: 0,
        namespaceId: NS_A,
        transferId: 1,
        chunkIndex: 0,
        chunkCount: 1,
        totalBytes: 64,
        bytes: new Uint8Array(64).fill(0x42),
      },
      { sequence: 0 },
    );
    expect(chunk[5]).toBe(MESSAGE_TYPES.UPDATE_CHUNK);
    expect(chunk[20]).toBe(0); // kind 首字段在 id 前缀位置 ⇒ 与 UPDATE 窗口结构性不同
    const before = fixture.events.length;
    const sequence = fixture.port.sendDataFrame(chunk);
    expect(sequence, 'OG-2a: 负控帧仍实际出站（观测面零折损）').toBeGreaterThan(0);
    expect(rawSequence(fixture.sent[fixture.sent.length - 1]!)).toBe(sequence);
    expect(updateSentOf(fixture.events.slice(before))).toHaveLength(0);
    await closeFixture(fixture);
  });

  it('OG-2b：OPEN_OK（0x11）型帧经 data 面出站 → 零事件、返回值不受影响', async () => {
    const fixture = makeGuardFixture();
    const other = encodeMessage(
      {
        kind: 'OPEN_OK',
        namespaceId: NS_A,
        mode: 0,
        replicationId: 'a'.repeat(32),
        replicationEpoch: 1,
      },
      { sequence: 0 },
    );
    expect(other[5]).toBe(MESSAGE_TYPES.OPEN_OK);
    const before = fixture.events.length;
    const sequence = fixture.port.sendDataFrame(other);
    expect(sequence).toBeGreaterThan(0);
    expect(rawSequence(fixture.sent[fixture.sent.length - 1]!)).toBe(sequence);
    expect(updateSentOf(fixture.events.slice(before))).toHaveLength(0);
    await closeFixture(fixture);
  });
});

// ═══════════════════════════ OG-3/OG-4：布局守卫与 D6 防御分支 ═══════════════════════════

describe('issue #423 OG-3/OG-4：布局校验不过 ⇒ dormant（零 throw、零事件、返回值不受影响）', () => {
  it('OG-3：id 长度前缀被腐蚀（[20] 0x23 → 0x22/0x24）→ 零事件', async () => {
    const fixture = makeGuardFixture();
    for (const corrupted of [ID_LENGTH_PREFIX - 1, ID_LENGTH_PREFIX + 1]) {
      const frame = updateFrame(NS_A, 23);
      frame[20] = corrupted;
      const before = fixture.events.length;
      const sequence = fixture.port.sendDataFrame(frame);
      expect(sequence, 'OG-3: 判定不改变出站结果').toBeGreaterThan(0);
      expect(rawSequence(fixture.sent[fixture.sent.length - 1]!)).toBe(sequence);
      expect(updateSentOf(fixture.events.slice(before))).toHaveLength(0);
    }
    await closeFixture(fixture);
  });

  it('OG-4a：短帧（截断至 id 窗口内 / 裸 envelope 头）→ 零 throw、零事件', async () => {
    const fixture = makeGuardFixture();
    const full = updateFrame(NS_A, 23);
    for (const malformed of [
      full.slice(0, UPDATE_FRAME_MIN_BYTES - 1),
      full.slice(0, 21),
      full.slice(0, 20), // 裸 envelope 头（无 payload）
    ]) {
      const before = fixture.events.length;
      const sequence = fixture.port.sendDataFrame(malformed);
      expect(sequence, 'OG-4a: 防御分支不改变出站结果（返回盖章序）').toBeGreaterThan(0);
      expect(rawSequence(fixture.sent[fixture.sent.length - 1]!)).toBe(sequence);
      expect(updateSentOf(fixture.events.slice(before))).toHaveLength(0);
    }
    await closeFixture(fixture);
  });

  it('OG-4b：声明 payloadLength 与帧长不自洽 → 零 throw、零事件', async () => {
    const fixture = makeGuardFixture();
    const frame = updateFrame(NS_A, 23);
    frame[15] = (frame[15]! + 1) & 0xff; // [12..16] payloadLength 低位 +1
    const before = fixture.events.length;
    const sequence = fixture.port.sendDataFrame(frame);
    expect(sequence).toBeGreaterThan(0);
    expect(rawSequence(fixture.sent[fixture.sent.length - 1]!)).toBe(sequence);
    expect(updateSentOf(fixture.events.slice(before))).toHaveLength(0);
    await closeFixture(fixture);
  });

  it('OG-4c：非规范 varUint 续位（长度前缀置续位 / 5 字节续位未终止）→ 零 throw、零事件', async () => {
    const fixture = makeGuardFixture();
    const continuation = updateFrame(NS_A, 23);
    continuation[56] = continuation[56]! | 0x80; // 续位：解出第二字节 ⇒ 长度交叉校验不过
    const runaway = updateFrame(NS_A, 23);
    for (let index = 0; index < 5; index += 1) runaway[56 + index] = 0x80; // 续位超过 5 字节
    for (const malformed of [continuation, runaway]) {
      const before = fixture.events.length;
      const sequence = fixture.port.sendDataFrame(malformed);
      expect(sequence).toBeGreaterThan(0);
      expect(rawSequence(fixture.sent[fixture.sent.length - 1]!)).toBe(sequence);
      expect(updateSentOf(fixture.events.slice(before))).toHaveLength(0);
    }
    await closeFixture(fixture);
  });
});

// ═══════════════════════════ OG-5：缝上 append-only 记账投影 ═══════════════════════════

describe('issue #423 OG-5：记账投影（append-only 纯 JSON）两态', () => {
  it('OG-5a：accounting 在场 ⇒ sendQueueMs 键在场且取值透传；缺省 ⇒ 整键缺席', async () => {
    const fixture = makeGuardFixture();
    const frame = updateFrame(NS_A, 23);

    const beforeWith = fixture.events.length;
    fixture.port.sendDataFrame(frame, { sendQueueMs: 7 });
    const withAccounting = updateSentOf(fixture.events.slice(beforeWith));
    expect(withAccounting).toHaveLength(1);
    expect(withAccounting[0]!.sendQueueMs).toBe(7);

    const beforeWithout = fixture.events.length;
    fixture.port.sendDataFrame(updateFrame(NS_A, 23));
    const withoutAccounting = updateSentOf(fixture.events.slice(beforeWithout));
    expect(withoutAccounting).toHaveLength(1);
    expect('sendQueueMs' in withoutAccounting[0]!, 'OG-5a: 缺面必须整键缺席（非 undefined 值）').toBe(
      false,
    );
    await closeFixture(fixture);
  });

  it('OG-5b：admission 拒绝（帧超连接级总压额度）⇒ 零事件（记账随拒帧弃置）', async () => {
    const fixture = makeGuardFixture({ maxQueuedBytesPerConnection: 64 });
    const before = fixture.events.length;
    // 80 字节 UPDATE 帧 > 64 字节连接级额度 ⇒ 出站被拒（seq = 0）
    expect(fixture.port.sendDataFrame(updateFrame(NS_A, 23), { sendQueueMs: 3 })).toBe(0);
    expect(fixture.sent).toHaveLength(0);
    expect(updateSentOf(fixture.events.slice(before))).toHaveLength(0);
    await closeFixture(fixture);
  });
});
