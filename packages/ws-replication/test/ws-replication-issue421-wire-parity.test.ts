/**
 * SA6 验收契约 — issue #421（spec #415 T4）：**出站 sequence 盖章的 wire 可见性 / 字节等价 / 连接隔离**。
 *
 * 覆盖条目（契约 `wiki/raw/task_issue-421_sa6_contract.md` §12.5 WS-C1/WS-C2/WS-C3；设计
 * `wiki/raw/task_issue-421_design.md` §7-D2 egress 面 / §8.4 出站盖章等价论证 / §12「AC5」行）：
 *   WS-C1a：≥2 namespace（同一连接上两个宿主 sink）的控制/data 占位帧**交织**注入同一 mux 点，
 *           raw envelope `[8..12]` 大端序 = 1..N 严格递增（HELLO_ACK = 1；无跳号/无重复/无回退），
 *           交织序 = 出队序（wire 帧的 kind/namespaceId 序列 = 注入序）；返回的 wire 序对外可见；
 *   WS-C1b（负控）：出站盖章不影响**入站** expectedSeq 纪律——已建 ns 的合法帧若携带错序
 *           wire 序，仍不得投递任何宿主 sink，且落连接级 SEQUENCE_VIOLATION + close(1002)；
 *   WS-C2a：控制帧 hex == `encodeMessage(同一占位消息, { sequence: k })` hex（逐字节），
 *           `[8..12]` 以外字节零触碰（= 决策 2「session 侧 sequence=0 占位编码 + edge 在
 *           mux 点重写 `[8..12]`」≡「按真实序列单次编码」的运行时等价）；
 *   WS-C2b：data 帧同款等价（非平凡 payload + 连续 k=2/3 全帧逐字节复核；解码回读消息 = 原消息）；
 *   WS-C2c：连接级帧（HELLO_ACK）同款等价——解码回读消息按同一序列重编码 = wire 原字节
 *           （连接级帧与 namespace 域帧共用同一 mux 点是「单点盖章」的公共面证据）；
 *           **单体对比条款的结构性覆盖声明（本文件显式登记）**：单体公共出面 `HubConnection`
 *           （`types.ts:182-186`）只有 `state`/`peerInstanceId`/`close`，**没有宿主出站缝**
 *           （无 `egress`/无字节注入点），故「同输入序列出站帧与单体逐字节相等」对
 *           host-originated 帧只能由本条**占位编码等价**（codec 单次编码 ⟺ 占位编码 + 重写
 *           `[8..12]`）结构性覆盖；单体形态的逐字节对比面属入站驱动帧（RK-C3/`route-key-parity`），
 *           不在本文件断言面——不构造无法观察的假对比；
 *   WS-C3a：两条独立连接（同一工厂 `acceptTrusted` 两次）各自从 1 起（per-connection，非全局计数）；
 *   WS-C3b：`connection.close()` 收口后**零新出站**（wire 帧集逐字节不变 = 盖章计数不再推进；
 *           data 面前置门 → 0）且不扰动邻接连接（邻接计数继续、无 close）；
 *   WS-C3c：对端 transport close → 连接收口（state='closed' + 宿主 sink 收 `onConnectionClosed`）
 *           + data 面零新出站（`sendDataFrame` → 0）。控制面在同点之后的 wire 可见性由适配器
 *           transport 的 `closed` 事实承载（内存 fixture 的对端半开不代表生产 transport 语义），
 *           故不把「控制帧也零出站」写进本断言面——负控纪律：不做不可观察/错误的断言。
 *
 * 纪律：断言 = 运行时行为（wire 原字节 / `[8..12]` 大端值 / close code+reason / 宿主 sink 投递）；
 * 零源码 grep 断言；零 skip/only/todo；零 env override；零 mock 被测对象（stub 只在宿主缝另一侧：
 * `authorize` / `resolveSessionSink` 与假 timer）。全部微任务驱动（`settle()`），零真实时间/网络。
 */
import { describe, expect, it } from 'vitest';
import { decodeMessage, encodeMessage } from '@nomicore/replication-protocol';
import type { CloseNamespaceMsg, ReplicationMessage, UpdateMsg } from '@nomicore/replication-protocol';
import { createHubReplicationEdge } from '@nomicore/ws-replication';
import type {
  DuplexTransport,
  HubNamespaceSessionSink,
  HubOpenNamespaceMessage,
  HubReplicationEdgeConnection,
  HubReplicationEdgeFactory,
  HubReplicationEdgeOptions,
  NamespaceAuthorization,
  ReplicationObserverEvent,
  ReplicationTimer,
} from '@nomicore/ws-replication';
import { createMemoryDuplexTransport } from '@nomicore/ws-replication/testing';
import { settle } from './harness.js';

// ═══════════════════════════ 局部 fixture（stub 只在宿主缝另一侧） ═══════════════════════════

const HUB_INSTANCE = 'hub-omega';
const PEER_INSTANCE = 'peer-alpha';
const PEER_BETA = 'peer-beta';
const NS_A = `ns-${'0'.repeat(31)}1`;
const NS_B = `ns-${'0'.repeat(31)}2`;
const HELLO_NONCE = new Uint8Array(16).fill(0x80);

const AUTHORIZED: NamespaceAuthorization = Object.freeze({
  ok: true as const,
  localOwner: Object.freeze({ userId: 'hub-owner-9f38' }),
  permissions: Object.freeze({ read: true, submit: true }),
});

/** raw envelope `[8..12]` 大端序（不借助 codec——断言面直接读 wire 字节）。 */
function rawSequence(bytes: Uint8Array): number {
  return (((bytes[8]! << 24) | (bytes[9]! << 16) | (bytes[10]! << 8) | bytes[11]!) >>> 0);
}

function hexOf(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

/** 逐字节差异位置（「`[8..12]` 以外零触碰」的精确见证；长度不同时以长度差暴露）。 */
function differingByteIndices(left: Uint8Array, right: Uint8Array): number[] {
  const limit = Math.max(left.byteLength, right.byteLength);
  const indices: number[] = [];
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) indices.push(index);
  }
  return indices;
}

function helloFrame(sequence: number, peerInstanceId = PEER_INSTANCE): Uint8Array {
  return encodeMessage(
    {
      kind: 'HELLO',
      peerInstanceId,
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

/** 控制占位消息（namespace 域控制帧；出站缝的宿主形态 = sink 侧 sequence=0 占位编码）。 */
function controlMessage(namespaceId: string): CloseNamespaceMsg {
  return { kind: 'CLOSE_NAMESPACE', namespaceId, reasonCode: 'peer-close' };
}

/** data 占位消息（非平凡 payload：含 0x00/0x7f/0x80/0xff，防「空 payload 使字节等价恒真」）。 */
function dataMessage(namespaceId: string): UpdateMsg {
  return {
    kind: 'UPDATE',
    namespaceId,
    update: Uint8Array.from([0x00, 0x01, 0x02, 0x03, 0x7f, 0x80, 0xff]),
  };
}

function controlPlaceholder(namespaceId: string): Uint8Array {
  return encodeMessage(controlMessage(namespaceId), { sequence: 0 });
}

function dataPlaceholder(namespaceId: string): Uint8Array {
  return encodeMessage(dataMessage(namespaceId), { sequence: 0 });
}

interface FakeTimer {
  readonly timer: ReplicationTimer;
  pendingDelays(): number[];
  size(): number;
  fireNext(onlyDelayMs?: number): number;
}

function makeFakeTimer(): FakeTimer {
  let counter = 0;
  const pending = new Map<number, { callback: () => void; delayMs: number }>();
  return {
    timer: {
      setTimeout: (callback: () => void, delayMs: number) => {
        counter += 1;
        pending.set(counter, { callback, delayMs });
        return counter;
      },
      clearTimeout: (handle: unknown) => {
        pending.delete(handle as number);
      },
    },
    pendingDelays: () => [...pending.values()].map((entry) => entry.delayMs),
    size: () => pending.size,
    fireNext: (onlyDelayMs?: number) => {
      for (const [handle, entry] of pending) {
        if (onlyDelayMs !== undefined && entry.delayMs !== onlyDelayMs) continue;
        pending.delete(handle);
        entry.callback();
        return entry.delayMs;
      }
      throw new Error(`no pending timer${onlyDelayMs === undefined ? '' : ` with delay ${onlyDelayMs}`}`);
    },
  };
}

interface Wire {
  readonly hubEnd: DuplexTransport;
  readonly outbound: Uint8Array[];
  readonly closes: Array<Readonly<{ code: number; reason: string }>>;
  inject(bytes: Uint8Array): void;
  closeFromPeer(code?: number, reason?: string): void;
}

function makeWire(): Wire {
  const { peer, hub } = createMemoryDuplexTransport();
  const outbound: Uint8Array[] = [];
  const closes: Array<Readonly<{ code: number; reason: string }>> = [];
  peer.onMessage((bytes) => outbound.push(bytes));
  peer.onClose((info) => closes.push({ code: info.code, reason: info.reason }));
  return {
    hubEnd: hub,
    outbound,
    closes,
    inject: (bytes) => peer.send(bytes),
    closeFromPeer: (code, reason) => peer.close(code, reason),
  };
}

/** 记录型宿主 sink（宿主缝另一侧的 stub；只记录，不响应）。 */
interface RecordingSink {
  readonly handle: HubNamespaceSessionSink;
  readonly opens: HubOpenNamespaceMessage[];
  readonly frames: Array<Readonly<{ message: ReplicationMessage; sequence: number }>>;
  readonly terminateCalls: number;
  readonly closeCalls: number;
}

function makeRecordingSink(): RecordingSink {
  const state = {
    opens: [] as HubOpenNamespaceMessage[],
    frames: [] as Array<Readonly<{ message: ReplicationMessage; sequence: number }>>,
    terminateCalls: 0,
    closeCalls: 0,
  };
  const handle: HubNamespaceSessionSink = {
    openNamespace: (message) => {
      state.opens.push(message);
    },
    namespaceFrame: (message, sequence) => {
      state.frames.push({ message, sequence });
    },
    terminateUnauthorized: () => {
      state.terminateCalls += 1;
      return Promise.resolve();
    },
    onConnectionClosed: () => {
      state.closeCalls += 1;
      return Promise.resolve();
    },
  };
  return {
    handle,
    get opens() {
      return state.opens;
    },
    get frames() {
      return state.frames;
    },
    get terminateCalls() {
      return state.terminateCalls;
    },
    get closeCalls() {
      return state.closeCalls;
    },
  };
}

interface FactoryHarness {
  readonly factory: HubReplicationEdgeFactory;
  readonly timer: FakeTimer;
  readonly events: ReplicationObserverEvent[];
  readonly resolveCalls: Array<Readonly<{ connectionKey: string; namespaceId: string }>>;
  readonly sinks: Map<string, RecordingSink>;
  newWire(): Wire;
}

function makeFactory(): FactoryHarness {
  const timer = makeFakeTimer();
  const events: ReplicationObserverEvent[] = [];
  const resolveCalls: Array<Readonly<{ connectionKey: string; namespaceId: string }>> = [];
  const sinks = new Map<string, RecordingSink>();
  const options: HubReplicationEdgeOptions = {
    instanceId: HUB_INSTANCE,
    timer: timer.timer,
    authorize: (): Promise<NamespaceAuthorization> => Promise.resolve(AUTHORIZED),
    resolveSessionSink: (connectionKey, namespaceId) => {
      resolveCalls.push({ connectionKey, namespaceId });
      const sink = makeRecordingSink();
      sinks.set(`${connectionKey}/${namespaceId}`, sink);
      return sink.handle;
    },
    observer: (event) => {
      events.push(event);
    },
  };
  return { factory: createHubReplicationEdge(options), timer, events, resolveCalls, sinks, newWire: makeWire };
}

function sinkFor(harness: FactoryHarness, connectionKey: string, namespaceId: string): RecordingSink {
  const sink = harness.sinks.get(`${connectionKey}/${namespaceId}`);
  if (sink === undefined) {
    throw new Error(`宿主 sink 未解析：${connectionKey}/${namespaceId}`);
  }
  return sink;
}

/** acceptTrusted → HELLO(1) → OPEN_NAMESPACE(2..n) → 句柄 ready（宿主 sink 已建立）。 */
async function establish(
  harness: FactoryHarness,
  wire: Wire,
  namespaces: readonly string[],
  peerInstanceId: string = PEER_INSTANCE,
): Promise<HubReplicationEdgeConnection> {
  const connection = await harness.factory.acceptTrusted(wire.hubEnd, { peerInstanceId });
  if (connection === undefined) {
    throw new Error('acceptTrusted 未返回连接句柄');
  }
  wire.inject(helloFrame(1, peerInstanceId));
  await settle();
  namespaces.forEach((namespaceId, index) => {
    wire.inject(openFrame(namespaceId, index + 2));
  });
  await settle();
  return connection;
}

/** wire 帧的 (kind, namespaceId) 序列（连接级帧无 namespaceId）。 */
function wireShape(wire: Wire): Array<readonly [string, string | undefined]> {
  return wire.outbound.map((bytes) => {
    const message = decodeMessage(bytes).message;
    return [message.kind, 'namespaceId' in message ? message.namespaceId : undefined] as const;
  });
}

// ═══════════════════════════ WS-C1：多宿主 sink 交织盖章 ═══════════════════════════

describe('issue #421 WS-C1：多宿主 sink 交织出站 → per-connection `[8..12]` 严格 1..N', () => {
  it('WS-C1a：双 namespace 控制/data 交织 → 序 1..N 无跳号/重复/回退，交织序 = 出队序，两 sink 各得其帧', async () => {
    const harness = makeFactory();
    const wire = harness.newWire();
    const connection = await establish(harness, wire, [NS_A, NS_B]);
    expect(connection.state).toBe('ready');
    expect([...connection.namespaces].sort()).toEqual([NS_A, NS_B]);
    // 两个宿主 sink 各自解析一次（多会话形态的接入缝证据）
    expect(
      harness.resolveCalls
        .map((call) => `${call.connectionKey}/${call.namespaceId}`)
        .sort(),
    ).toEqual([`${connection.connectionKey}/${NS_A}`, `${connection.connectionKey}/${NS_B}`].sort());
    const sinkA = sinkFor(harness, connection.connectionKey, NS_A);
    const sinkB = sinkFor(harness, connection.connectionKey, NS_B);
    expect(sinkA).not.toBe(sinkB);
    expect(sinkA.opens.map((message) => message.namespaceId)).toEqual([NS_A]);
    expect(sinkB.opens.map((message) => message.namespaceId)).toEqual([NS_B]);
    // HELLO_ACK 已占序 1：连接级帧与 namespace 域帧共用同一 mux 点
    expect(wire.outbound.map(rawSequence)).toEqual([1]);
    expect(decodeMessage(wire.outbound[0]!).message.kind).toBe('HELLO_ACK');

    // 两个 ns 的控制/data 占位帧交织注入（每帧都是 sequence=0 占位编码）
    const plan = [
      { namespaceId: NS_A, kind: 'control' as const },
      { namespaceId: NS_B, kind: 'data' as const },
      { namespaceId: NS_B, kind: 'control' as const },
      { namespaceId: NS_A, kind: 'data' as const },
      { namespaceId: NS_B, kind: 'data' as const },
      { namespaceId: NS_A, kind: 'control' as const },
    ];
    const stamped = plan.map((step) =>
      step.kind === 'control'
        ? connection.egress.sendControlFrame(controlPlaceholder(step.namespaceId))
        : connection.egress.sendDataFrame(dataPlaceholder(step.namespaceId)),
    );
    await settle();

    // 盖章对外可见：返回值 = 该帧的 wire 序（出队序 = 注入序）
    expect(stamped).toEqual([2, 3, 4, 5, 6, 7]);
    expect(wireShape(wire)).toEqual([
      ['HELLO_ACK', undefined],
      ...plan.map(
        (step) =>
          [step.kind === 'control' ? 'CLOSE_NAMESPACE' : 'UPDATE', step.namespaceId] as const,
      ),
    ]);
    const sequences = wire.outbound.map(rawSequence);
    // 严格 1..N：无跳号、无重复、无回退
    expect(sequences).toEqual(Array.from({ length: plan.length + 1 }, (_, index) => index + 1));
    expect(new Set(sequences).size).toBe(sequences.length);
    for (let index = 1; index < sequences.length; index += 1) {
      expect(sequences[index]! - sequences[index - 1]!).toBe(1);
    }
    expect(wire.closes).toEqual([]);

    // 两 sink 各消费本 ns 域帧（NC1 形态：已建 ns 的合法帧必须投递），且投递不改变出站序列
    wire.inject(encodeMessage(controlMessage(NS_A), { sequence: 4 }));
    await settle();
    expect(sinkA.frames.map((entry) => [entry.message.kind, entry.sequence])).toEqual([
      ['CLOSE_NAMESPACE', 4],
    ]);
    expect(sinkB.frames).toEqual([]);
    expect(wire.outbound.map(rawSequence)).toEqual(sequences);
  });

  it('WS-C1b（负控）：错序入站帧仍 → 连接级 SEQUENCE_VIOLATION（出站盖章不放松入站纪律）', async () => {
    const harness = makeFactory();
    const wire = harness.newWire();
    const connection = await establish(harness, wire, [NS_A]);
    const sinkA = sinkFor(harness, connection.connectionKey, NS_A);
    expect(wire.outbound.map(rawSequence)).toEqual([1]);
    // 入站下一期望序 = 3；注入 wire 序 9 的合法 ns 帧 → 不得投递、连接级 ERROR + close(1002)
    wire.inject(encodeMessage(controlMessage(NS_A), { sequence: 9 }));
    await settle();
    expect(sinkA.frames).toEqual([]);
    const errorFrame = decodeMessage(wire.outbound[1]!).message;
    expect(errorFrame.kind).toBe('ERROR');
    expect(errorFrame).toMatchObject({ kind: 'ERROR', code: 'SEQUENCE_VIOLATION' });
    // 连接域 ERROR（不点名 namespace）
    expect('namespaceId' in errorFrame ? errorFrame.namespaceId : undefined).toBeUndefined();
    // 该 ERROR 自身仍按出站纪律盖章（1 → 2）：出站序列单点不受入站违规影响
    expect(wire.outbound.map(rawSequence)).toEqual([1, 2]);
    expect(wire.closes).toEqual([{ code: 1002, reason: 'protocol-error' }]);
    expect(connection.state).toBe('closed');
    expect(sinkA.closeCalls).toBe(1);
  });
});

// ═══════════════════════════ WS-C2：盖章字节等价 ═══════════════════════════

describe('issue #421 WS-C2：占位编码 + mux 点重写 ≡ 按真实序列单次编码（逐字节）', () => {
  it('WS-C2a：控制帧 hex == encodeMessage(同占位消息, { sequence: k })，`[8..12]` 外零触碰', async () => {
    const harness = makeFactory();
    const wire = harness.newWire();
    const connection = await establish(harness, wire, [NS_A]);
    const message = controlMessage(NS_A);
    // session 侧占位形态：sequence=0 编码后交出站缝
    expect(connection.egress.sendControlFrame(encodeMessage(message, { sequence: 0 }))).toBe(2);
    await settle();
    const stamped = wire.outbound[1]!;
    expect(rawSequence(stamped)).toBe(2);
    // 与「按真实序列单次编码」逐字节相等（差异容忍度为零）
    expect(hexOf(stamped)).toBe(hexOf(encodeMessage(message, { sequence: 2 })));
    // `[8..12]` 以外字节零触碰（对 test 侧重编码的 pristine 占位帧取差异位置）
    const pristine = encodeMessage(message, { sequence: 0 });
    expect(stamped.byteLength).toBe(pristine.byteLength);
    expect(hexOf(stamped.subarray(0, 8))).toBe(hexOf(pristine.subarray(0, 8)));
    expect(hexOf(stamped.subarray(12))).toBe(hexOf(pristine.subarray(12)));
    expect(
      differingByteIndices(stamped, pristine).every((index) => index >= 8 && index < 12),
    ).toBe(true);
    expect(decodeMessage(stamped).message).toEqual(message);
    expect(wire.closes).toEqual([]);
  });

  it('WS-C2b：data 帧同款等价（非平凡 payload，连续 k=2/3 全帧复核 + 解码回读 = 原消息）', async () => {
    const harness = makeFactory();
    const wire = harness.newWire();
    const connection = await establish(harness, wire, [NS_A]);
    const data = dataMessage(NS_A);
    const control = controlMessage(NS_A);
    expect(connection.egress.sendDataFrame(encodeMessage(data, { sequence: 0 }))).toBe(2);
    expect(connection.egress.sendControlFrame(encodeMessage(control, { sequence: 0 }))).toBe(3);
    await settle();

    const expectations: ReadonlyArray<
      Readonly<{ message: ReplicationMessage; sequence: number }>
    > = [
      { message: data, sequence: 2 },
      { message: control, sequence: 3 },
    ];
    expectations.forEach((expectation, index) => {
      const stamped = wire.outbound[index + 1]!;
      const pristine = encodeMessage(expectation.message, { sequence: 0 });
      expect(stamped.byteLength).toBe(pristine.byteLength);
      expect(rawSequence(stamped)).toBe(expectation.sequence);
      expect(hexOf(stamped)).toBe(
        hexOf(encodeMessage(expectation.message, { sequence: expectation.sequence })),
      );
      expect(hexOf(stamped.subarray(0, 8))).toBe(hexOf(pristine.subarray(0, 8)));
      expect(hexOf(stamped.subarray(12))).toBe(hexOf(pristine.subarray(12)));
      expect(
        differingByteIndices(stamped, pristine).every(
          (offset) => offset >= 8 && offset < 12,
        ),
      ).toBe(true);
      // payload 逐字节保真：解码回读消息 = 注入的同一占位消息（含 7 字节非平凡 payload）
      expect(decodeMessage(stamped).message).toEqual(expectation.message);
    });
    expect(wire.closes).toEqual([]);
  });

  it('WS-C2c：连接级帧（HELLO_ACK）同款等价——解码回读消息按同一序列重编码 = wire 原字节', async () => {
    const harness = makeFactory();
    const wire = harness.newWire();
    const connection = await establish(harness, wire, [NS_A]);
    const helloAck = wire.outbound[0]!;
    expect(rawSequence(helloAck)).toBe(1);
    const decoded = decodeMessage(helloAck).message;
    expect(decoded).toMatchObject({ kind: 'HELLO_ACK', connectionId: connection.connectionKey });
    // 连接级帧与 namespace 域帧经同一 mux 点：序列 1 处亦逐字节等同「按真实序列单次编码」
    expect(hexOf(encodeMessage(decoded, { sequence: 1 }))).toBe(hexOf(helloAck));
  });
});

// ═══════════════════════════ WS-C3：连接隔离与收口 ═══════════════════════════

describe('issue #421 WS-C3：per-connection 计数与收口后零新出站', () => {
  it('WS-C3a：同一工厂两条连接各自从 1 起（per-connection，非全局计数）', async () => {
    const harness = makeFactory();
    const wire1 = harness.newWire();
    const wire2 = harness.newWire();
    const connection1 = await establish(harness, wire1, [NS_A]);
    const connection2 = await establish(harness, wire2, [NS_B], PEER_BETA);
    expect(connection1.connectionKey).not.toBe(connection2.connectionKey);
    expect(connection1.authenticatedInstanceId).toBe(PEER_INSTANCE);
    expect(connection2.authenticatedInstanceId).toBe(PEER_BETA);
    expect(wire1.outbound.map(rawSequence)).toEqual([1]);
    expect(wire2.outbound.map(rawSequence)).toEqual([1]);
    // 交替推进：全局计数器会让第二条连接返回 3（本断言对全局单调实现红）
    expect(connection1.egress.sendControlFrame(controlPlaceholder(NS_A))).toBe(2);
    expect(connection2.egress.sendControlFrame(controlPlaceholder(NS_B))).toBe(2);
    expect(connection1.egress.sendDataFrame(dataPlaceholder(NS_A))).toBe(3);
    expect(connection2.egress.sendDataFrame(dataPlaceholder(NS_B))).toBe(3);
    await settle();
    expect(wire1.outbound.map(rawSequence)).toEqual([1, 2, 3]);
    expect(wire2.outbound.map(rawSequence)).toEqual([1, 2, 3]);
    // 无跨连接污染：每条 wire 只承载本连接的 ns 帧
    expect(wireShape(wire1)).toEqual([
      ['HELLO_ACK', undefined],
      ['CLOSE_NAMESPACE', NS_A],
      ['UPDATE', NS_A],
    ]);
    expect(wireShape(wire2)).toEqual([
      ['HELLO_ACK', undefined],
      ['CLOSE_NAMESPACE', NS_B],
      ['UPDATE', NS_B],
    ]);
    expect(wire1.closes).toEqual([]);
    expect(wire2.closes).toEqual([]);
  });

  it('WS-C3b：connection.close() 收口后零新出站（盖章不再推进）且不扰动邻接连接', async () => {
    const harness = makeFactory();
    const wire1 = harness.newWire();
    const wire2 = harness.newWire();
    const connection1 = await establish(harness, wire1, [NS_A]);
    const connection2 = await establish(harness, wire2, [NS_B], PEER_BETA);
    const sink1 = sinkFor(harness, connection1.connectionKey, NS_A);
    expect(connection1.egress.sendControlFrame(controlPlaceholder(NS_A))).toBe(2);
    expect(connection1.egress.sendDataFrame(dataPlaceholder(NS_A))).toBe(3);
    expect(connection2.egress.sendControlFrame(controlPlaceholder(NS_B))).toBe(2);
    await settle();
    expect(wire1.outbound.map(rawSequence)).toEqual([1, 2, 3]);
    const framesBeforeClose = wire1.outbound.map(hexOf);

    connection1.close();
    await settle();
    expect(connection1.state).toBe('closed');
    expect(wire1.hubEnd.closed).toBe(true); // 收口 = 本端 transport 关闭（零新出站的承载事实）
    expect(wire1.closes).toEqual([{ code: 1001, reason: 'hub-close' }]);
    expect(sink1.closeCalls).toBe(1);

    // 收口后：data 面前置门拒纳（返回 0）；控制帧在已收口 transport 上被抑制 → wire 零新帧
    // （「盖章计数不再推进」的可观察面 = 出站帧集逐字节不变；被抑制帧不产生 wire 事实）
    for (let index = 0; index < 3; index += 1) {
      connection1.egress.sendControlFrame(controlPlaceholder(NS_A));
    }
    expect(connection1.egress.sendDataFrame(dataPlaceholder(NS_A))).toBe(0);
    await settle();
    expect(wire1.outbound.map(hexOf)).toEqual(framesBeforeClose); // 盖章计数不再推进
    expect(wire1.closes).toHaveLength(1);
    expect(sink1.closeCalls).toBe(1);

    // 邻接连接不受扰：自身计数从 3 继续、无 close、仍 ready
    expect(connection2.egress.sendControlFrame(controlPlaceholder(NS_B))).toBe(3);
    await settle();
    expect(wire2.outbound.map(rawSequence)).toEqual([1, 2, 3]);
    expect(wire2.closes).toEqual([]);
    expect(connection2.state).toBe('ready');
  });

  it('WS-C3c：对端 transport close → 连接收口 + sink 收口通知 + data 面零新出站', async () => {
    const harness = makeFactory();
    const wire = harness.newWire();
    const connection = await establish(harness, wire, [NS_A]);
    const sinkA = sinkFor(harness, connection.connectionKey, NS_A);
    expect(connection.egress.sendControlFrame(controlPlaceholder(NS_A))).toBe(2);
    await settle();
    expect(wireShape(wire)).toEqual([
      ['HELLO_ACK', undefined],
      ['CLOSE_NAMESPACE', NS_A],
    ]);

    wire.closeFromPeer(1000, 'peer-close');
    await settle();
    expect(connection.state).toBe('closed');
    expect(sinkA.closeCalls).toBe(1);
    // data 面收口后零新出站（closed 前置门 → 0）
    expect(connection.egress.sendDataFrame(dataPlaceholder(NS_A))).toBe(0);
    await settle();
    expect(wireShape(wire)).toEqual([
      ['HELLO_ACK', undefined],
      ['CLOSE_NAMESPACE', NS_A],
    ]);
    expect(wire.outbound.filter((bytes) => decodeMessage(bytes).message.kind === 'UPDATE')).toEqual(
      [],
    );
  });
});
