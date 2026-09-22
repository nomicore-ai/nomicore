/**
 * SA6 验收契约 — issue #421（spec #415 T4）：**路由键两分支 + 工厂/单体逐字节 parity**。
 *
 * 覆盖条目（契约 `wiki/raw/task_issue-421_sa6_contract.md` §12.3 RK-C1/RK-C2/RK-C3；
 * 设计 `wiki/raw/task_issue-421_design.md` §8.5/§12）：
 *   RK-C1a 路由键文法违例帧（ns 域帧 `[20]` 长度前缀 0x23 → 0x22）→ **恰一帧连接级**
 *         `ERROR{MALFORMED_FRAME}`（无 `namespaceId`）+ `transport.close(1002,'protocol-error')`
 *         + 零宿主 sink 投递 + 零 `resolveSessionSink` 调用 + 连接终局；
 *   RK-C1b 负控：同一帧仅 `[20]` 合法（0x23）→ 不得落违例分支（单一变量差分：除该字节外
 *         逐字节相同），连接存活、零 close；
 *   RK-C2a 合法帧 + 从未 OPEN 的 ns（edge R-none）→ 合成 ns 级
 *         `ERROR{code:'NAMESPACE_STATE_VIOLATION', namespaceId:<ns>}` + 连接存活 + 零投递零回调；
 *   RK-C2b 合法帧 + 宿主 `resolveSessionSink` 返回 `undefined`（established→no-sink，SD-5）
 *         → 同上合成 + 存活 + 零投递（解析恰一次、帧不触发重解析）；
 *   RK-C2c 负控：同一帧在已建立 ns（宿主返回 sink）→ 必须投递到宿主 sink 且零 ERROR；
 *   RK-C3a/b 同输入序列逐字节 parity（工厂 `acceptTrusted` vs 单体
 *         `createHubReplication(...).acceptTrusted`）：序列 1 = HELLO + 违例帧；序列 2 =
 *         HELLO + 两笔无 sink 帧 → 出站帧 hex 数组逐字节相等 + close code/reason 相等
 *         （差异容忍度为零）。语料取「从未 OPEN / 违例」两分支（设计 §13-1：denied/throw/
 *         no-sink 的**在途缓冲**项不在任何 parity 语料内；宿主 `undefined` 语料无单体对应态）。
 *
 * 纪律：断言 = 运行时行为（出站帧原字节 hex / `decodeMessage` 回读码、transport close
 * code+reason、宿主回调计数、宿主 sink 到达序列、连接句柄状态）；零源码 grep 断言；
 * 零 skip/only/todo；零 env override；零 mock 被测对象（stub 只在宿主缝另一侧）。
 */
import { describe, expect, it } from 'vitest';
import { decodeMessage, encodeMessage, type ReplicationMessage } from '@nomicore/replication-protocol';
import type { NamespaceRegistry } from '@nomicore/namespace-registry';
import { createHubReplication, createHubReplicationEdge } from '@nomicore/ws-replication';
import type {
  DuplexTransport,
  HubNamespaceSessionSink,
  HubOpenNamespaceMessage,
  HubReplicationEdgeConnection,
  HubReplicationEdgeFactory,
  HubReplicationEdgeOptions,
  HubSessionSinkResolver,
  NamespaceAuthorization,
  NamespaceAuthorizationGrant,
  ReplicationTimer,
} from '@nomicore/ws-replication';
import { createMemoryDuplexTransport } from '@nomicore/ws-replication/testing';
import { settle } from './harness.js';

// ═══════════════════════════ 局部 fixture（stub 只在宿主缝另一侧） ═══════════════════════════

const HUB_INSTANCE = 'hub-omega';
const PEER_INSTANCE = 'peer-alpha';
const CONNECTION_KEY = `${HUB_INSTANCE}-conn-0`;
const NS_A = `ns-${'0'.repeat(31)}1`;
const NS_B = `ns-${'0'.repeat(31)}2`;
const NS_UNKNOWN = `ns-${'a'.repeat(32)}`;
/** namespaceId varString 长度前缀（35 = `'ns-'` + 32 位 id；`hub-edge.ts` 定偏移 `[20]`）。 */
const ID_LENGTH_PREFIX = 0x23;
const CORRUPTED_ID_LENGTH_PREFIX = 0x22;
const HELLO_NONCE = new Uint8Array(16).fill(0x80);

const AUTHORIZED: NamespaceAuthorization = Object.freeze({
  ok: true as const,
  localOwner: Object.freeze({ userId: 'hub-owner-9f38' }),
  permissions: Object.freeze({ read: true, submit: true }),
});

function hexOf(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

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

/** 路由键违例帧：合法 `CLOSE_NAMESPACE` 编码后改坏 namespaceId 长度前缀（`[20]` 0x23 → 0x22）。 */
function corruptedRouteKeyFrame(namespaceId: string, sequence: number): Uint8Array {
  const corrupted = closeFrame(namespaceId, sequence).slice();
  corrupted[20] = CORRUPTED_ID_LENGTH_PREFIX;
  return corrupted;
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
  readonly closed: () => boolean;
  inject(bytes: Uint8Array): void;
}

function makeWire(): Wire {
  const { peer, hub } = createMemoryDuplexTransport();
  const outbound: Uint8Array[] = [];
  const closes: Array<Readonly<{ code: number; reason: string }>> = [];
  peer.onMessage((bytes) => outbound.push(bytes));
  peer.onClose((info) => closes.push({ code: info.code, reason: info.reason }));
  return { hubEnd: hub, outbound, closes, closed: () => hub.closed, inject: (bytes) => peer.send(bytes) };
}

function decodedMessages(wire: Wire): ReplicationMessage[] {
  return wire.outbound.map((bytes) => decodeMessage(bytes).message);
}

type ErrorMessage = Extract<ReplicationMessage, { kind: 'ERROR' }>;

function errorMessages(wire: Wire): ErrorMessage[] {
  return decodedMessages(wire).filter((message): message is ErrorMessage => message.kind === 'ERROR');
}

interface FrameArrival {
  readonly kind: string;
  readonly namespaceId: string | undefined;
  readonly sequence: number;
}

/** 宿主 sink 到达记录（投递面分派：OPEN → `opens`；非 OPEN 帧 → `frames` 含 wire 序）。 */
interface Deliveries {
  readonly opens: string[];
  readonly frames: FrameArrival[];
}

function makeRecordingSink(deliveries: Deliveries): HubNamespaceSessionSink {
  return {
    openNamespace: (message: HubOpenNamespaceMessage): void => {
      deliveries.opens.push(message.namespaceId);
    },
    namespaceFrame: (message: ReplicationMessage, sequence: number): void => {
      deliveries.frames.push({
        kind: message.kind,
        namespaceId: 'namespaceId' in message ? message.namespaceId : undefined,
        sequence,
      });
    },
    terminateUnauthorized: () => Promise.resolve(),
    onConnectionClosed: () => Promise.resolve(),
  };
}

interface ResolveCall {
  readonly connectionKey: string;
  readonly namespaceId: string;
  readonly authorization: NamespaceAuthorizationGrant;
}

interface FactoryOverrides {
  readonly authorize?: (instanceIdentity: string, namespaceId: string) => Promise<NamespaceAuthorization>;
  readonly resolveSessionSink?: HubSessionSinkResolver;
}

interface FactoryHarness {
  readonly factory: HubReplicationEdgeFactory;
  readonly wire: Wire;
  readonly timer: FakeTimer;
  readonly resolveCalls: ResolveCall[];
  readonly deliveries: Deliveries;
}

function makeFactory(overrides: FactoryOverrides = {}): FactoryHarness {
  const wire = makeWire();
  const timer = makeFakeTimer();
  const resolveCalls: ResolveCall[] = [];
  const deliveries: Deliveries = { opens: [], frames: [] };
  const baseResolver: HubSessionSinkResolver =
    overrides.resolveSessionSink ?? (() => makeRecordingSink(deliveries));
  const options: HubReplicationEdgeOptions = {
    instanceId: HUB_INSTANCE,
    timer: timer.timer,
    authorize: overrides.authorize ?? ((): Promise<NamespaceAuthorization> => Promise.resolve(AUTHORIZED)),
    // 计数包裹：违例/无 sink 分支的「零回调」与「解析恰一次」共用同一单点
    resolveSessionSink: (connectionKey, namespaceId, authorization) => {
      resolveCalls.push({ connectionKey, namespaceId, authorization });
      return baseResolver(connectionKey, namespaceId, authorization);
    },
  };
  return { factory: createHubReplicationEdge(options), wire, timer, resolveCalls, deliveries };
}

/** 单体（服务层组合根）：parity 金标来源（与工厂同 instanceId/连接序）。 */
function makeMonolith(): Readonly<{ hub: ReturnType<typeof createHubReplication>; wire: Wire; authorizeCalls: () => number }> {
  const wire = makeWire();
  const timer = makeFakeTimer();
  let authorizeCalls = 0;
  const hub = createHubReplication({
    instanceId: HUB_INSTANCE,
    registry: {
      open: async () => {
        throw new Error('parity fixture: registry.open 未被使用');
      },
    } as unknown as NamespaceRegistry,
    authorize: async () => {
      authorizeCalls += 1;
      return { ok: false };
    },
    timer: timer.timer,
    verifyToken: async () => ({ ok: false as const }), // acceptTrusted 路径不使用
  });
  return { hub, wire, authorizeCalls: () => authorizeCalls };
}

/** 工厂形态：`acceptTrusted` 后按序注入（每帧一次微任务排空）。 */
async function driveFactorySequence(
  frames: readonly Uint8Array[],
): Promise<FactoryHarness & Readonly<{ connection: HubReplicationEdgeConnection }>> {
  const fixture = makeFactory();
  const connection = await fixture.factory.acceptTrusted(fixture.wire.hubEnd, {
    peerInstanceId: PEER_INSTANCE,
  });
  await settle();
  if (connection === undefined) throw new Error('parity 夹具：工厂 acceptTrusted 未返回连接句柄');
  for (const frame of frames) {
    fixture.wire.inject(frame);
    await settle();
  }
  return { ...fixture, connection };
}

/** 单体形态：同输入序列（同一 acceptTrusted 契约面）。 */
async function driveMonolithSequence(
  frames: readonly Uint8Array[],
): Promise<Readonly<{ wire: Wire; authorizeCalls: number }>> {
  const monolith = makeMonolith();
  const connection = await monolith.hub.acceptTrusted!(monolith.wire.hubEnd, {
    peerInstanceId: PEER_INSTANCE,
  });
  await settle();
  if (connection === undefined) throw new Error('parity 夹具：单体 acceptTrusted 未返回连接句柄');
  for (const frame of frames) {
    monolith.wire.inject(frame);
    await settle();
  }
  return { wire: monolith.wire, authorizeCalls: monolith.authorizeCalls() };
}

// ═══════════════════════════ RK-C1：路由键文法违例（连接级 fatal） ═══════════════════════════

describe('issue #421 RK-C1：路由键违例 → 恰一帧连接级 MALFORMED_FRAME + close(1002)', () => {
  it('RK-C1a：`[20]` 0x23→0x22 违例帧 → ERROR{MALFORMED_FRAME}（无 ns）+ 1002 protocol-error + 零投递零回调', async () => {
    const fixture = makeFactory();
    const connection = await fixture.factory.acceptTrusted(fixture.wire.hubEnd, {
      peerInstanceId: PEER_INSTANCE,
    });
    await settle();
    expect(connection).toBeDefined();
    fixture.wire.inject(helloFrame(1));
    await settle();
    expect(decodedMessages(fixture.wire).map((message) => message.kind)).toEqual(['HELLO_ACK']);

    fixture.wire.inject(corruptedRouteKeyFrame(NS_A, 2));
    await settle();

    // 恰一帧连接级 ERROR{MALFORMED_FRAME}（无 namespaceId）——绝不静默误路由
    expect(decodedMessages(fixture.wire).map((message) => message.kind)).toEqual(['HELLO_ACK', 'ERROR']);
    const errors = errorMessages(fixture.wire);
    expect(errors.map((message) => message.code)).toEqual(['MALFORMED_FRAME']);
    expect(errors[0]!.namespaceId).toBeUndefined();
    // 唯一 transport 收口分类
    expect(fixture.wire.closes).toEqual([{ code: 1002, reason: 'protocol-error' }]);
    expect(fixture.wire.closed()).toBe(true);
    expect(connection!.state).toBe('closed');
    // 零宿主 sink 投递 + 零 resolveSessionSink 调用
    expect(fixture.deliveries).toEqual({ opens: [], frames: [] });
    expect(fixture.resolveCalls).toEqual([]);
  });

  it('RK-C1b 负控：同一帧仅 `[20]` 合法（0x23）→ 不落违例分支（零 MALFORMED_FRAME、零 close、连接存活）', async () => {
    const legal = closeFrame(NS_A, 2);
    const corrupted = corruptedRouteKeyFrame(NS_A, 2);
    expect(legal[20]).toBe(ID_LENGTH_PREFIX);
    expect(corrupted[20]).toBe(CORRUPTED_ID_LENGTH_PREFIX);
    // 单一变量：两帧除 `[20]` 外逐字节相同（差异容忍度为零的负控话语）
    const differingBytes: number[] = [];
    legal.forEach((byte, index) => {
      if (byte !== corrupted[index]) differingBytes.push(index);
    });
    expect(differingBytes).toEqual([20]);

    const fixture = makeFactory();
    const connection = await fixture.factory.acceptTrusted(fixture.wire.hubEnd, {
      peerInstanceId: PEER_INSTANCE,
    });
    await settle();
    fixture.wire.inject(helloFrame(1));
    await settle();
    fixture.wire.inject(legal);
    await settle();

    // 合法帧落「无 sink」分支，而非 MALFORMED_FRAME 分支
    const errors = errorMessages(fixture.wire);
    expect(errors.map((message) => message.code)).toEqual(['NAMESPACE_STATE_VIOLATION']);
    expect(errors[0]!.namespaceId).toBe(NS_A);
    expect(fixture.wire.closes).toEqual([]);
    expect(fixture.wire.closed()).toBe(false);
    expect(connection!.state).toBe('ready');
    expect(fixture.resolveCalls).toEqual([]);
    expect(fixture.deliveries).toEqual({ opens: [], frames: [] });
  });
});

// ═══════════════════════════ RK-C2：合法帧 + 无已解析 sink（合成违例，连接存活） ═══════════════════════════

describe('issue #421 RK-C2：合法帧 + 无已解析 sink → 合成 NAMESPACE_STATE_VIOLATION 且连接存活', () => {
  it('RK-C2a：从未 OPEN 的 ns 合法帧 → ns 级 NAMESPACE_STATE_VIOLATION + 存活 + 零回调零投递', async () => {
    const fixture = makeFactory();
    const connection = await fixture.factory.acceptTrusted(fixture.wire.hubEnd, {
      peerInstanceId: PEER_INSTANCE,
    });
    await settle();
    fixture.wire.inject(helloFrame(1));
    await settle();
    fixture.wire.inject(closeFrame(NS_UNKNOWN, 2));
    await settle();

    expect(decodedMessages(fixture.wire).map((message) => message.kind)).toEqual(['HELLO_ACK', 'ERROR']);
    const [violation] = errorMessages(fixture.wire);
    expect(violation!.code).toBe('NAMESPACE_STATE_VIOLATION');
    expect(violation!.namespaceId).toBe(NS_UNKNOWN);
    expect(fixture.resolveCalls).toEqual([]);
    expect(fixture.deliveries).toEqual({ opens: [], frames: [] });
    expect(fixture.wire.closes).toEqual([]);

    // 存活实证：后续帧（另一从未 OPEN 的 ns）仍被处理并逐帧合成
    fixture.wire.inject(closeFrame(NS_B, 3));
    await settle();
    expect(errorMessages(fixture.wire).map((message) => message.namespaceId)).toEqual([NS_UNKNOWN, NS_B]);
    expect(fixture.wire.outbound).toHaveLength(3);
    expect(fixture.wire.closed()).toBe(false);
    expect(connection!.state).toBe('ready');
    expect(connection!.namespaces.size).toBe(0);
  });

  it('RK-C2b：宿主 resolveSessionSink 返回 undefined（established→no-sink，SD-5）→ 合成违例 + 存活 + 零投递', async () => {
    const fixture = makeFactory({ resolveSessionSink: () => undefined });
    const connection = await fixture.factory.acceptTrusted(fixture.wire.hubEnd, {
      peerInstanceId: PEER_INSTANCE,
    });
    await settle();
    fixture.wire.inject(helloFrame(1));
    await settle();
    fixture.wire.inject(openFrame(NS_A, 2));
    await settle();

    // 解析恰一次（授权通过后、携带 ok-投影）；返回 undefined = 合法无 sink：OPEN 零应答（非失败）
    expect(fixture.resolveCalls).toHaveLength(1);
    expect(fixture.resolveCalls[0]).toMatchObject({ connectionKey: CONNECTION_KEY, namespaceId: NS_A });
    expect(fixture.resolveCalls[0]!.authorization.ok).toBe(true);
    expect(fixture.wire.outbound).toHaveLength(1);
    expect(connection!.namespaces.size).toBe(0);

    fixture.wire.inject(closeFrame(NS_A, 3));
    await settle();
    const errors = errorMessages(fixture.wire);
    expect(errors.map((message) => `${message.code}:${message.namespaceId ?? '-'}`)).toEqual([
      `NAMESPACE_STATE_VIOLATION:${NS_A}`,
    ]);
    expect(fixture.deliveries).toEqual({ opens: [], frames: [] });
    expect(fixture.wire.closes).toEqual([]);

    // 存活实证：后续帧仍处理（逐帧合成），且帧不触发重解析
    fixture.wire.inject(closeFrame(NS_A, 4));
    await settle();
    expect(fixture.wire.outbound).toHaveLength(3);
    expect(fixture.resolveCalls).toHaveLength(1);
    expect(fixture.wire.closed()).toBe(false);
    expect(connection!.state).toBe('ready');
  });

  it('RK-C2c 负控：已建立 ns（宿主返回 sink）的同一帧 → 投递到 sink 且零 ERROR', async () => {
    const fixture = makeFactory();
    const connection = await fixture.factory.acceptTrusted(fixture.wire.hubEnd, {
      peerInstanceId: PEER_INSTANCE,
    });
    await settle();
    fixture.wire.inject(helloFrame(1));
    await settle();
    fixture.wire.inject(openFrame(NS_A, 2));
    await settle();
    expect(fixture.resolveCalls).toHaveLength(1);
    expect(fixture.deliveries.opens).toEqual([NS_A]);
    expect(connection!.namespaces.has(NS_A)).toBe(true);

    fixture.wire.inject(closeFrame(NS_A, 3));
    await settle();

    expect(fixture.deliveries.frames).toEqual([{ kind: 'CLOSE_NAMESPACE', namespaceId: NS_A, sequence: 3 }]);
    expect(errorMessages(fixture.wire)).toEqual([]);
    expect(fixture.wire.outbound).toHaveLength(1); // 仅 HELLO_ACK：已建立 ns 帧零违例回显
    expect(fixture.wire.closes).toEqual([]);
    expect(fixture.wire.closed()).toBe(false);
    expect(connection!.state).toBe('ready');
  });
});

// ═══════════════════════════ RK-C3：工厂 vs 单体同输入序列逐字节 parity ═══════════════════════════

describe('issue #421 RK-C3：同输入序列下工厂与单体出站帧 hex 逐字节相等（差异容忍度为零）', () => {
  it('RK-C3a 序列 1：HELLO + 违例帧 → 出站 hex 相同 + close code/reason 相同', async () => {
    const steps = [helloFrame(1), corruptedRouteKeyFrame(NS_A, 2)];
    const factoryRun = await driveFactorySequence(steps);
    const monolithRun = await driveMonolithSequence(steps);

    const factoryHex = factoryRun.wire.outbound.map(hexOf);
    const monolithHex = monolithRun.wire.outbound.map(hexOf);
    expect(factoryHex).toHaveLength(2); // HELLO_ACK + 连接级 MALFORMED_FRAME
    // 两形态确实走了同一分支（否则「相等」可能是两支皆空/皆无 ERROR 的假绿）
    expect(errorMessages(factoryRun.wire).map((message) => message.code)).toEqual(['MALFORMED_FRAME']);
    expect(errorMessages(monolithRun.wire).map((message) => message.code)).toEqual(['MALFORMED_FRAME']);
    // 逐帧 hex 逐字节相等（任一字节差异即红）
    expect(factoryHex).toEqual(monolithHex);
    expect(factoryHex.join('')).toBe(monolithHex.join(''));
    expect(factoryRun.wire.closes).toEqual(monolithRun.wire.closes);
    expect(monolithRun.wire.closes).toEqual([{ code: 1002, reason: 'protocol-error' }]);
    expect(factoryRun.connection.state).toBe('closed');
    // 两形态均零 OPEN 准入（无 authorize、无宿主回调）
    expect(monolithRun.authorizeCalls).toBe(0);
    expect(factoryRun.resolveCalls).toEqual([]);
  });

  it('RK-C3b 序列 2：HELLO + 两笔无 sink 帧 → 出站 hex 相同 + 双方零 close', async () => {
    const steps = [helloFrame(1), closeFrame(NS_UNKNOWN, 2), closeFrame(NS_B, 3)];
    const factoryRun = await driveFactorySequence(steps);
    const monolithRun = await driveMonolithSequence(steps);

    const factoryHex = factoryRun.wire.outbound.map(hexOf);
    const monolithHex = monolithRun.wire.outbound.map(hexOf);
    expect(factoryHex).toHaveLength(3); // HELLO_ACK + 两笔合成 NAMESPACE_STATE_VIOLATION
    expect(errorMessages(factoryRun.wire).map((message) => message.code)).toEqual([
      'NAMESPACE_STATE_VIOLATION',
      'NAMESPACE_STATE_VIOLATION',
    ]);
    expect(errorMessages(monolithRun.wire).map((message) => message.code)).toEqual([
      'NAMESPACE_STATE_VIOLATION',
      'NAMESPACE_STATE_VIOLATION',
    ]);
    expect(factoryHex).toEqual(monolithHex);
    expect(factoryHex.join('')).toBe(monolithHex.join(''));
    expect(factoryRun.wire.closes).toEqual([]);
    expect(monolithRun.wire.closes).toEqual([]);
    expect(factoryRun.connection.state).toBe('ready');
    expect(monolithRun.authorizeCalls).toBe(0);
    expect(factoryRun.resolveCalls).toEqual([]);
  });
});
