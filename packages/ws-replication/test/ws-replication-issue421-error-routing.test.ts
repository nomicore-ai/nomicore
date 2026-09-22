/**
 * SA6 验收契约 — issue #421（spec #415 T4）：**ERROR mini-decode 路由**（ER 组）。
 *
 * 覆盖条目（契约 `wiki/raw/task_issue-421_sa6_contract.md` §12.4 ER-C1/ER-C2/ER-C3；设计
 * `wiki/raw/task_issue-421_design.md` §8.5「路由键与 ERROR mini-decode（零改动复用）」）：
 *   ER-C1  已建立 ns 的 ns 级 ERROR → 投递目标 = `decodeMessage` 回读的 `namespaceId`、携带
 *          wire 序、连接存活（后续帧仍处理）；变体 = 无/有 `relatedSequence`、最长稳定码、
 *          最长可用 safeMessage（协议未定义上界，1 KiB 见证）；预算见证 = 帧内 ASCII
 *          namespaceId 起点 ≤ `ERROR_NS_PREFIX_BUDGET`
 *          (64)（T1 守卫登记，`packages/replication-protocol/test/codec-route-key-guard.test.ts:67,322`）；
 *   ER-C2  连接级 ERROR（无 `namespaceId`，含 `relatedSequence` 有无两形态）→ 宿主 sink 零投递、
 *          wire 零回显零新增帧、连接存活；负控：ns 级 ERROR 必须路由（ER-C1）——「不路由」仅限
 *          连接级；
 *   ER-C3  未知 ns（无台账记录）的 ns 级 ERROR → 零投递、零出站、连接存活（单体 I5 语义）；
 *          宿主 `resolveSessionSink` 返回 `undefined`（no-sink）的 ns 级 ERROR → 静默丢弃，绝不
 *          合成 `NAMESPACE_STATE_VIOLATION`（ERROR 是不合成分支的例外——ERROR 永不触发 R-none）。
 *
 * 纪律：断言 = 运行时行为（wire 原字节 / `decodeMessage` 回读 / 宿主 sink 投递记录 / close
 * 记录 / 连接态）；零源码 grep 断言；零 skip/only/todo；零 env override；零 mock 被测对象
 * （stub 只在宿主缝另一侧）；全微任务驱动、零真实 timer 触发。
 */
import { describe, expect, it } from 'vitest';
import { NAMESPACE_ERRORS, decodeMessage, encodeMessage } from '@nomicore/replication-protocol';
import type { ReplicationMessage } from '@nomicore/replication-protocol';
import { createHubReplicationEdge } from '@nomicore/ws-replication';
import type {
  DuplexTransport,
  HubNamespaceSessionSink,
  HubReplicationEdgeConnection,
  HubReplicationEdgeFactory,
  HubSessionSinkResolver,
  NamespaceAuthorization,
  ReplicationTimer,
} from '@nomicore/ws-replication';
import { createMemoryDuplexTransport } from '@nomicore/ws-replication/testing';
import { settle } from './harness.js';

// ═══════════════════════════ 局部 fixture（stub 只在宿主缝另一侧） ═══════════════════════════

const HUB_INSTANCE = 'hub-omega';
const PEER_INSTANCE = 'peer-alpha';
/** 合法 ns 文法：`ns-` + 32 小写 hex（协议 §1）——35 ASCII 字节，varString 长度前缀恒 1 字节。 */
const NS_A = `ns-${'0'.repeat(31)}1`;
const NS_B = `ns-${'0'.repeat(31)}2`;
const NS_UNKNOWN = `ns-${'a'.repeat(32)}`;
const HELLO_NONCE = new Uint8Array(16).fill(0x80);
/** 最长稳定 namespace 错误码（从冻结注册表派生，不手写字面量——同 T1 守卫 G4-d 手法）。 */
const LONGEST_NAMESPACE_CODE = Object.keys(NAMESPACE_ERRORS).reduce((left, right) =>
  right.length > left.length ? right : left,
);
/** 协议/注册表未定义 `safeMessage` 长度上界（协议 §13 只要求稳定、无身份/数据/cause 文本）；
 *  1 KiB 变体见证「路由 + 预算」与尾字段长度无关。 */
const LONG_SAFE_MESSAGE = `protocol error: ${'x'.repeat(1024)}`;

const AUTHORIZED: NamespaceAuthorization = Object.freeze({
  ok: true as const,
  localOwner: Object.freeze({ userId: 'hub-owner-9f38' }),
  permissions: Object.freeze({ read: true, submit: true }),
});

function helloFrame(sequence: number): Uint8Array {
  return encodeMessage(
    {
      kind: 'HELLO',
      peerInstanceId: PEER_INSTANCE,
      expectedHubInstanceId: HUB_INSTANCE,
      protocolVersions: [1],
      requiredCapabilities: 0,
      optionalCapabilities: 0,
      connectionNonce: HELLO_NONCE,
    },
    { sequence },
  );
}

function openFrame(namespaceId: string, sequence: number): Uint8Array {
  return encodeMessage({ kind: 'OPEN_NAMESPACE', namespaceId, hasLocalReplica: false }, { sequence });
}

function closeFrame(namespaceId: string, sequence: number): Uint8Array {
  return encodeMessage({ kind: 'CLOSE_NAMESPACE', namespaceId, reasonCode: 'peer-close' }, { sequence });
}

interface ErrorFrameOptions {
  readonly sequence: number;
  readonly relatedSequence?: number;
  readonly safeMessage?: string;
}

/** namespace 级 ERROR（携带 `namespaceId` ⇒ codec 解析为 namespace scope）。 */
function namespaceErrorFrame(
  namespaceId: string,
  code: string,
  options: ErrorFrameOptions,
): Uint8Array {
  return encodeMessage(
    {
      kind: 'ERROR',
      code,
      safeMessage: options.safeMessage ?? `protocol error: ${code}`,
      namespaceId,
      ...(options.relatedSequence === undefined ? {} : { relatedSequence: options.relatedSequence }),
    },
    { sequence: options.sequence },
  );
}

/** 连接级 ERROR（无 `namespaceId` ⇒ codec 解析为 connection scope）。 */
function connectionErrorFrame(code: string, options: ErrorFrameOptions): Uint8Array {
  return encodeMessage(
    {
      kind: 'ERROR',
      code,
      safeMessage: options.safeMessage ?? `protocol error: ${code}`,
      ...(options.relatedSequence === undefined ? {} : { relatedSequence: options.relatedSequence }),
    },
    { sequence: options.sequence },
  );
}

function decodedOf(bytes: Uint8Array): ReplicationMessage {
  return decodeMessage(bytes).message;
}

function errorOf(bytes: Uint8Array): Extract<ReplicationMessage, { kind: 'ERROR' }> {
  const message = decodedOf(bytes);
  if (message.kind !== 'ERROR') throw new Error(`fixture: 期望 ERROR 帧，实际 ${message.kind}`);
  return message;
}

/**
 * ERROR 布局预算见证（T1 守卫登记 `ERROR_NS_PREFIX_BUDGET = 64`）：按 ASCII 扫描帧内
 * namespaceId 字节，断言其**实际起点** ≤ 64，且前一字节是该 varString 的长度前缀
 * （= 35 = `0x23`，协议 §1 文法）——证明扫描命中的确是 ERROR 的 namespaceId 字段。
 */
function expectNamespaceBudget(frame: Uint8Array, namespaceId: string): number {
  const needle = Array.from(namespaceId, (char) => char.charCodeAt(0));
  let found = -1;
  for (let start = 0; start + needle.length <= frame.byteLength && found < 0; start += 1) {
    let matched = true;
    for (let index = 0; index < needle.length; index += 1) {
      if (frame[start + index] !== needle[index]) {
        matched = false;
        break;
      }
    }
    if (matched) found = start;
  }
  expect(found, `ERROR 帧内必须出现 ASCII namespaceId ${namespaceId}`).toBeGreaterThan(0);
  expect(frame[found - 1], `namespaceId varString 长度前缀 @${found - 1} 必须 = 35`).toBe(35);
  expect(
    found,
    `namespaceId 起点 ${found} 字节超出 ERROR_NS_PREFIX_BUDGET(64)：ERROR 前导字段序或码长漂移`,
  ).toBeLessThanOrEqual(64);
  return found;
}

/** 握手基线钉死：出站恰一帧 HELLO_ACK——「零新增帧」断言的锚点不得是退化值 0。 */
function expectHelloAckBaseline(wire: Wire, connection: HubReplicationEdgeConnection): void {
  expect(connection.state).toBe('ready');
  expect(wire.outbound).toHaveLength(1);
  expect(decodedOf(wire.outbound[0]!)).toMatchObject({ kind: 'HELLO_ACK' });
  expect(wire.closes).toEqual([]);
}

function makeFakeTimer(): ReplicationTimer {
  let counter = 0;
  const pending = new Map<number, () => void>();
  return {
    setTimeout: (callback: () => void, _delayMs: number) => {
      counter += 1;
      pending.set(counter, callback);
      return counter;
    },
    clearTimeout: (handle: unknown) => {
      pending.delete(handle as number);
    },
  };
}

interface Wire {
  readonly hubEnd: DuplexTransport;
  readonly outbound: Uint8Array[];
  readonly closes: Array<Readonly<{ code: number; reason: string }>>;
  inject(bytes: Uint8Array): void;
}

function makeWire(): Wire {
  const { peer, hub } = createMemoryDuplexTransport();
  const outbound: Uint8Array[] = [];
  const closes: Array<Readonly<{ code: number; reason: string }>> = [];
  peer.onMessage((bytes) => outbound.push(bytes));
  peer.onClose((info) => closes.push({ code: info.code, reason: info.reason }));
  return { hubEnd: hub, outbound, closes, inject: (bytes) => peer.send(bytes) };
}

interface SinkHarness {
  readonly sink: HubNamespaceSessionSink;
  readonly opens: string[];
  readonly frames: Array<Readonly<{ kind: string; namespaceId: string | undefined; sequence: number }>>;
}

function makeSinkHarness(): SinkHarness {
  const opens: string[] = [];
  const frames: SinkHarness['frames'] = [];
  return {
    opens,
    frames,
    sink: {
      openNamespace: (message) => {
        opens.push(message.namespaceId);
      },
      namespaceFrame: (message, sequence) => {
        frames.push({
          kind: message.kind,
          namespaceId: 'namespaceId' in message ? message.namespaceId : undefined,
          sequence,
        });
      },
      terminateUnauthorized: () => Promise.resolve(),
      onConnectionClosed: () => Promise.resolve(),
    },
  };
}

interface FactoryOverrides {
  /** 指定 ns 落「合法无 sink」（SD-5）——`resolveSessionSink` 返回 `undefined`。 */
  readonly noSinkFor?: (namespaceId: string) => boolean;
  readonly resolveSessionSink?: HubSessionSinkResolver;
}

interface FactoryHarness {
  readonly factory: HubReplicationEdgeFactory;
  readonly wire: Wire;
  readonly resolveCalls: string[];
  readonly sinks: Map<string, SinkHarness>;
  sinkOf(namespaceId: string): SinkHarness;
}

function makeFactory(overrides: FactoryOverrides = {}): FactoryHarness {
  const wire = makeWire();
  const resolveCalls: string[] = [];
  const sinks = new Map<string, SinkHarness>();
  const factory = createHubReplicationEdge({
    instanceId: HUB_INSTANCE,
    timer: makeFakeTimer(),
    authorize: () => Promise.resolve(AUTHORIZED),
    resolveSessionSink: (connectionKey, namespaceId, authorization) => {
      resolveCalls.push(namespaceId);
      if (overrides.resolveSessionSink !== undefined) {
        return overrides.resolveSessionSink(connectionKey, namespaceId, authorization);
      }
      if (overrides.noSinkFor?.(namespaceId) === true) return undefined;
      const harness = makeSinkHarness();
      sinks.set(namespaceId, harness);
      return harness.sink;
    },
  });
  return {
    factory,
    wire,
    resolveCalls,
    sinks,
    sinkOf: (namespaceId) => {
      const harness = sinks.get(namespaceId);
      if (harness === undefined) throw new Error(`fixture: ns ${namespaceId} 无宿主 sink 记录`);
      return harness;
    },
  };
}

async function connect(fixture: FactoryHarness): Promise<HubReplicationEdgeConnection> {
  const connection = await fixture.factory.acceptTrusted(fixture.wire.hubEnd, {
    peerInstanceId: PEER_INSTANCE,
  });
  await settle();
  if (connection === undefined) throw new Error('fixture: acceptTrusted 未分配连接');
  return connection;
}

/** 握手（HELLO@1）+ 按序 OPEN 建立指定 ns 的会话（宿主 sink 记录型）。 */
async function establish(fixture: FactoryHarness, namespaceIds: readonly string[]): Promise<void> {
  fixture.wire.inject(helloFrame(1));
  await settle();
  let sequence = 2;
  for (const namespaceId of namespaceIds) {
    fixture.wire.inject(openFrame(namespaceId, sequence));
    sequence += 1;
  }
  await settle();
}

// ═══════════════════════════ ER-C1：已建立 ns 的 ns 级 ERROR 路由 ═══════════════════════════

describe('issue #421 ER-C1：ns 级 ERROR 路由到该 ns 的宿主 sink（预算 ≤64 字节见证）', () => {
  it('ER-C1a：无 relatedSequence → 投递目标 = 解码回读 ns、携带 wire 序、零回显、连接存活', async () => {
    const fixture = makeFactory();
    const connection = await connect(fixture);
    await establish(fixture, [NS_A]);
    expect(connection.namespaces).toEqual(new Set([NS_A]));
    expect(fixture.wire.outbound).toHaveLength(1); // 仅 HELLO_ACK

    const frame = namespaceErrorFrame(NS_A, 'SYNC_STATE_VIOLATION', { sequence: 3 });
    const readback = errorOf(frame);
    expect(readback).toMatchObject({ code: 'SYNC_STATE_VIOLATION', namespaceId: NS_A });
    fixture.wire.inject(frame);
    await settle();

    // 投递目标 ns 必须等于 wire 回读的 namespaceId，且携带 wire 序
    expect(fixture.sinkOf(NS_A).frames).toEqual([
      { kind: 'ERROR', namespaceId: readback.namespaceId, sequence: 3 },
    ]);
    expect(fixture.wire.outbound).toHaveLength(1); // 无回显、无新增帧
    expect(fixture.wire.closes).toEqual([]);
    expect(connection.state).toBe('ready');

    // 连接存活：后续帧仍被处理
    fixture.wire.inject(closeFrame(NS_A, 4));
    await settle();
    expect(fixture.sinkOf(NS_A).frames.map((record) => record.kind)).toEqual([
      'ERROR',
      'CLOSE_NAMESPACE',
    ]);
  });

  it('ER-C1b：带 relatedSequence → 同路由 + 帧内 namespaceId 起点 ≤ 64', async () => {
    const fixture = makeFactory();
    const connection = await connect(fixture);
    await establish(fixture, [NS_A]);

    const frame = namespaceErrorFrame(NS_A, 'SYNC_STATE_VIOLATION', {
      sequence: 3,
      relatedSequence: 7,
    });
    const readback = errorOf(frame);
    expect(readback).toMatchObject({ namespaceId: NS_A, relatedSequence: 7 });
    expectNamespaceBudget(frame, NS_A);
    fixture.wire.inject(frame);
    await settle();

    expect(fixture.sinkOf(NS_A).frames).toEqual([
      { kind: 'ERROR', namespaceId: readback.namespaceId, sequence: 3 },
    ]);
    expect(fixture.wire.outbound).toHaveLength(1);
    expect(fixture.wire.closes).toEqual([]);
    fixture.wire.inject(closeFrame(NS_A, 4));
    await settle();
    expect(fixture.sinkOf(NS_A).frames.map((record) => record.kind)).toEqual([
      'ERROR',
      'CLOSE_NAMESPACE',
    ]);
    expect(connection.state).toBe('ready');
  });

  it('ER-C1c：最长稳定码（+ relatedSequence 在场）→ 仍路由且预算 ≤ 64', async () => {
    const fixture = makeFactory();
    const connection = await connect(fixture);
    await establish(fixture, [NS_A]);

    const frame = namespaceErrorFrame(NS_A, LONGEST_NAMESPACE_CODE, {
      sequence: 3,
      relatedSequence: 9,
    });
    expect(LONGEST_NAMESPACE_CODE.length).toBeGreaterThan(0);
    const readback = errorOf(frame);
    expect(readback).toMatchObject({
      code: LONGEST_NAMESPACE_CODE,
      namespaceId: NS_A,
      relatedSequence: 9,
    });
    expectNamespaceBudget(frame, NS_A);
    fixture.wire.inject(frame);
    await settle();

    expect(fixture.sinkOf(NS_A).frames).toEqual([
      { kind: 'ERROR', namespaceId: readback.namespaceId, sequence: 3 },
    ]);
    expect(fixture.wire.outbound).toHaveLength(1);
    expect(fixture.wire.closes).toEqual([]);
    fixture.wire.inject(closeFrame(NS_A, 4));
    await settle();
    expect(fixture.sinkOf(NS_A).frames.map((record) => record.kind)).toEqual([
      'ERROR',
      'CLOSE_NAMESPACE',
    ]);
    expect(connection.state).toBe('ready');
  });

  it('ER-C1d：长 safeMessage → 路由与预算和尾字段长度无关', async () => {
    const fixture = makeFactory();
    const connection = await connect(fixture);
    await establish(fixture, [NS_A]);

    const frame = namespaceErrorFrame(NS_A, 'NAMESPACE_STATE_VIOLATION', {
      sequence: 3,
      safeMessage: LONG_SAFE_MESSAGE,
    });
    const readback = errorOf(frame);
    expect(readback).toMatchObject({
      namespaceId: NS_A,
      safeMessage: LONG_SAFE_MESSAGE,
    });
    expect(frame.byteLength).toBeGreaterThan(LONG_SAFE_MESSAGE.length);
    expectNamespaceBudget(frame, NS_A);
    fixture.wire.inject(frame);
    await settle();

    expect(fixture.sinkOf(NS_A).frames).toEqual([
      { kind: 'ERROR', namespaceId: readback.namespaceId, sequence: 3 },
    ]);
    expect(fixture.wire.outbound).toHaveLength(1);
    expect(fixture.wire.closes).toEqual([]);
    fixture.wire.inject(closeFrame(NS_A, 4));
    await settle();
    expect(fixture.sinkOf(NS_A).frames.map((record) => record.kind)).toEqual([
      'ERROR',
      'CLOSE_NAMESPACE',
    ]);
    expect(connection.state).toBe('ready');
  });
});

// ═══════════════════════════ ER-C2：连接级 ERROR 不路由 ═══════════════════════════

describe('issue #421 ER-C2：连接级 ERROR 零投递零回显（负控：ns 级必须路由）', () => {
  it('ER-C2a：无 namespaceId（含 relatedSequence 有无两形态）→ 零投递、零回显、连接存活', async () => {
    const fixture = makeFactory();
    const connection = await connect(fixture);
    await establish(fixture, [NS_A]);
    expectHelloAckBaseline(fixture.wire, connection);
    const outboundBefore = fixture.wire.outbound.length; // 1 = HELLO_ACK

    const cases: ReadonlyArray<Readonly<{ label: string; frame: Uint8Array }>> = [
      { label: '无 relatedSequence', frame: connectionErrorFrame('BAD_MAGIC', { sequence: 3 }) },
      {
        label: '有 relatedSequence',
        frame: connectionErrorFrame('INTERNAL_ERROR', { sequence: 4, relatedSequence: 3 }),
      },
    ];
    for (const testCase of cases) {
      const readback = decodedOf(testCase.frame);
      if (readback.kind !== 'ERROR') {
        throw new Error(`fixture: ${testCase.label} 语料必须是 ERROR 帧`);
      }
      expect(readback.namespaceId, `${testCase.label}: 语料必须是连接级 ERROR`).toBeUndefined();
      fixture.wire.inject(testCase.frame);
      await settle();
      // 零投递 + wire 零回显零新增帧
      expect(fixture.sinkOf(NS_A).frames, testCase.label).toEqual([]);
      expect(fixture.wire.outbound, testCase.label).toHaveLength(outboundBefore);
      expect(fixture.wire.closes, testCase.label).toEqual([]);
      expect(connection.state, testCase.label).toBe('ready');
    }

    // 连接存活：后续 ns 帧仍被处理
    fixture.wire.inject(closeFrame(NS_A, 5));
    await settle();
    expect(fixture.sinkOf(NS_A).frames).toEqual([
      { kind: 'CLOSE_NAMESPACE', namespaceId: NS_A, sequence: 5 },
    ]);
  });

  it('ER-C2b：负控——同连接内连接级不路由而 ns 级必须路由（判别性）', async () => {
    const fixture = makeFactory();
    const connection = await connect(fixture);
    await establish(fixture, [NS_A]);
    expectHelloAckBaseline(fixture.wire, connection);
    const outboundBefore = fixture.wire.outbound.length;

    fixture.wire.inject(connectionErrorFrame('BAD_MAGIC', { sequence: 3 }));
    await settle();
    expect(fixture.sinkOf(NS_A).frames).toEqual([]);

    fixture.wire.inject(namespaceErrorFrame(NS_A, 'SYNC_STATE_VIOLATION', { sequence: 4 }));
    await settle();
    expect(fixture.sinkOf(NS_A).frames).toEqual([
      { kind: 'ERROR', namespaceId: NS_A, sequence: 4 },
    ]);
    expect(fixture.wire.outbound).toHaveLength(outboundBefore);
    expect(fixture.wire.closes).toEqual([]);
    expect(connection.state).toBe('ready');
  });
});

// ═══════════════════════════ ER-C3：未知 ns 与 no-sink 的静默 ═══════════════════════════

describe('issue #421 ER-C3：未知 ns / no-sink 的 ns 级 ERROR 静默（ERROR 永不合成违例）', () => {
  it('ER-C3a：未知 ns（无台账）→ 零投递零出站、连接存活；负控：非 ERROR 帧必须合成违例', async () => {
    const fixture = makeFactory();
    const connection = await connect(fixture);
    await establish(fixture, [NS_A]);
    expectHelloAckBaseline(fixture.wire, connection);
    const outboundBefore = fixture.wire.outbound.length; // 1 = HELLO_ACK

    fixture.wire.inject(namespaceErrorFrame(NS_UNKNOWN, 'NAMESPACE_STATE_VIOLATION', { sequence: 3 }));
    await settle();
    expect(fixture.sinks.size).toBe(1);
    expect(fixture.sinkOf(NS_A).frames).toEqual([]); // 唯一 sink 零污染
    expect(fixture.wire.outbound).toHaveLength(outboundBefore); // 零出站（不得合成 ERROR）
    expect(fixture.wire.closes).toEqual([]);
    expect(connection.state).toBe('ready');

    // 连接存活：已建立 ns 的后续帧仍被处理
    fixture.wire.inject(closeFrame(NS_A, 4));
    await settle();
    expect(fixture.sinkOf(NS_A).frames.map((record) => record.kind)).toEqual(['CLOSE_NAMESPACE']);

    // 判别性负控：未知 ns 的**非 ERROR** 合法帧 → 恰一帧合成 NAMESPACE_STATE_VIOLATION
    // （证明「零出站」来自 ERROR 例外，而非未知 ns 全静默）
    fixture.wire.inject(closeFrame(NS_UNKNOWN, 5));
    await settle();
    expect(fixture.wire.outbound).toHaveLength(outboundBefore + 1);
    expect(errorOf(fixture.wire.outbound[outboundBefore]!)).toMatchObject({
      code: 'NAMESPACE_STATE_VIOLATION',
      namespaceId: NS_UNKNOWN,
    });
    expect(fixture.sinkOf(NS_A).frames.map((record) => record.kind)).toEqual(['CLOSE_NAMESPACE']);
    expect(fixture.wire.closes).toEqual([]);
    expect(connection.state).toBe('ready');
  });

  it('ER-C3b：宿主返回 undefined（no-sink）→ ns 级 ERROR 静默丢弃，不合成 STATE_VIOLATION', async () => {
    const fixture = makeFactory({ noSinkFor: (namespaceId) => namespaceId === NS_A });
    const connection = await connect(fixture);
    await establish(fixture, [NS_A]);
    expect(fixture.resolveCalls).toEqual([NS_A]);
    expect(connection.namespaces).toEqual(new Set()); // no-sink 非 established
    expectHelloAckBaseline(fixture.wire, connection);
    const outboundBefore = fixture.wire.outbound.length; // 1 = HELLO_ACK

    // ERROR 例外：no-sink 分支不得合成 NAMESPACE_STATE_VIOLATION
    fixture.wire.inject(namespaceErrorFrame(NS_A, 'SYNC_STATE_VIOLATION', { sequence: 3 }));
    await settle();
    expect(fixture.wire.outbound).toHaveLength(outboundBefore);
    expect(fixture.wire.closes).toEqual([]);

    // 判别性负控：同 ns 的非 ERROR 帧 → 恰一帧合成 NAMESPACE_STATE_VIOLATION（分支可判别）
    fixture.wire.inject(closeFrame(NS_A, 4));
    await settle();
    expect(fixture.wire.outbound).toHaveLength(outboundBefore + 1);
    expect(errorOf(fixture.wire.outbound[outboundBefore]!)).toMatchObject({
      code: 'NAMESPACE_STATE_VIOLATION',
      namespaceId: NS_A,
    });
    expect(fixture.wire.closes).toEqual([]);

    // 连接存活：另一 ns 建立后 ns 级 ERROR 仍按 ER-C1 路由
    fixture.wire.inject(openFrame(NS_B, 5));
    await settle();
    expect(connection.namespaces).toEqual(new Set([NS_B]));
    fixture.wire.inject(namespaceErrorFrame(NS_B, 'SYNC_STATE_VIOLATION', { sequence: 6 }));
    await settle();
    expect(fixture.sinkOf(NS_B).frames).toEqual([
      { kind: 'ERROR', namespaceId: NS_B, sequence: 6 },
    ]);
    expect(fixture.wire.outbound).toHaveLength(outboundBefore + 1); // 无新增出站
    expect(fixture.wire.closes).toEqual([]);
    expect(connection.state).toBe('ready');
  });
});
