/**
 * SA6 验收契约 — issue #421（spec #415 T4）：**edge 公共工厂 accept 双入口 + 早到帧 parity**。
 *
 * 覆盖条目（契约 `wiki/raw/task_issue-421_sa6_contract.md` §12.1 EF-C2/EF-C3；设计
 * `wiki/raw/task_issue-421_design.md` §7-D4/§8.1/§8.3 R5）：
 *   EF-C2a `accept(transport, { token })`：verifyToken **恰一次**（入参 = token）+ 句柄面齐备；
 *   EF-C2b `acceptTrusted(transport, identity)`：verifyToken **零调用** + 身份绑定（HELLO 自报不覆盖）；
 *   EF-C2c 缺凭据（缺失/非串/空串）→ `close(1008,'upgrade-unauthorized')` + 零调用零分配；
 *   EF-C2d 无认证器 → 1008 + `auth-upgrade-rejected{verifier-missing}`（fail-closed）；
 *   EF-C2e 裁决 null/{ok:false}/throw/文法违例 → 1008 + reason 闭集 + **accept 永不 reject**；
 *   EF-C2f auth timer 超时 → 1008 'upgrade-timeout' + `auth-timeout`；
 *   EF-C3a ≤16 早到帧按到达序重放（合规 HELLO 早到 → HELLO_ACK 正常）；
 *   EF-C3b 第 17 帧 → `close(1008,'upgrade-frame-limit')` + `early-frame-limit`；
 *   EF-C3c 单帧 > maxFrameBytes → `close(1009,'upgrade-frame-limit')` + `frame-too-large`；
 *   EF-C3d 门 6/7 次序（即时验证器 + 升级期超界帧的零宽窗口）→ 与单体同 close code/reason
 *         （让位复查先于文法检查——SA2 R6）。
 *
 * 纪律：断言 = 运行时行为（wire 原字节/close code+reason/observer 事件/回调计数）；
 * 零源码 grep 断言；零 skip/only/todo；零 mock 被测对象（stub 只在宿主缝另一侧）。
 */
import { describe, expect, it } from 'vitest';
import { decodeMessage, encodeMessage } from '@nomicore/replication-protocol';
import type { NamespaceRegistry } from '@nomicore/namespace-registry';
import { createHubReplication, createHubReplicationEdge } from '@nomicore/ws-replication';
import type {
  DuplexTransport,
  HubNamespaceSessionSink,
  HubReplicationEdgeConnection,
  HubReplicationEdgeFactory,
  HubReplicationEdgeOptions,
  HubSessionSinkResolver,
  HubUpgradeRequest,
  NamespaceAuthorization,
  NamespaceAuthorizationGrant,
  PeerTokenVerifier,
  ReplicationObserverEvent,
  ReplicationTimer,
} from '@nomicore/ws-replication';
import { createMemoryDuplexTransport } from '@nomicore/ws-replication/testing';
import { settle } from './harness.js';

// ═══════════════════════════ 局部 fixture（stub 只在宿主缝另一侧） ═══════════════════════════

const HUB_INSTANCE = 'hub-omega';
const PEER_INSTANCE = 'peer-alpha';
const TOKEN = 'tok-test-421';
const NS_A = `ns-${'0'.repeat(31)}1`;
const HELLO_NONCE = new Uint8Array(16).fill(0x80);

const AUTHORIZED: NamespaceAuthorization = Object.freeze({
  ok: true as const,
  localOwner: Object.freeze({ userId: 'hub-owner-9f38' }),
  permissions: Object.freeze({ read: true, submit: true }),
});

/** 小帧界合法配置（`validateLimits` 链自洽）：用于升级期超界帧语料（600B > 512B）。 */
const FRAME_LIMIT_LIMITS: HubReplicationEdgeOptions['limits'] = Object.freeze({
  maxFrameBytes: 512,
  maxBootstrapBytes: 256,
  maxSyncDiffBytes: 256,
  maxUpdateBytes: 256,
  maxQueuedUpdateBytes: 256,
  maxQueuedControlBytes: 512,
  lowWater: 64,
  highWater: 256,
  maxQueuedBytesPerConnection: 256,
});
const OVERSIZED_FRAME_BYTES = 600;

function rawSequence(bytes: Uint8Array): number {
  return (((bytes[8]! << 24) | (bytes[9]! << 16) | (bytes[10]! << 8) | bytes[11]!) >>> 0);
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

function closeFrame(namespaceId: string, sequence: number): Uint8Array {
  return encodeMessage({ kind: 'CLOSE_NAMESPACE', namespaceId, reasonCode: 'peer-close' }, { sequence });
}

function bigFrame(byteLength: number): Uint8Array {
  // 超界帧：只要求 byteLength > maxFrameBytes（admission 单帧界在 codec 之前拒绝）
  const bytes = new Uint8Array(byteLength).fill(0x41);
  bytes[0] = 0x4e;
  bytes[1] = 0x4d;
  bytes[2] = 0x43;
  bytes[3] = 0x52;
  return bytes;
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

function makeSinkHarness(): HubNamespaceSessionSink {
  return {
    openNamespace: () => undefined,
    namespaceFrame: () => undefined,
    terminateUnauthorized: () => Promise.resolve(),
    onConnectionClosed: () => Promise.resolve(),
  };
}

interface FactoryOverrides {
  readonly authorize?: (instanceIdentity: string, namespaceId: string) => Promise<NamespaceAuthorization>;
  readonly resolveSessionSink?: HubSessionSinkResolver;
  readonly verifyToken?: PeerTokenVerifier;
  readonly limits?: HubReplicationEdgeOptions['limits'];
  readonly timeouts?: HubReplicationEdgeOptions['timeouts'];
}

interface FactoryHarness {
  readonly factory: HubReplicationEdgeFactory;
  readonly wire: Wire;
  readonly timer: FakeTimer;
  readonly events: ReplicationObserverEvent[];
  readonly verifyTokenCalls: string[];
  readonly resolveCalls: Array<Readonly<{ connectionKey: string; namespaceId: string }>>;
}

function makeFactory(overrides: FactoryOverrides = {}): FactoryHarness {
  const wire = makeWire();
  const timer = makeFakeTimer();
  const events: ReplicationObserverEvent[] = [];
  const verifyTokenCalls: string[] = [];
  const resolveCalls: Array<Readonly<{ connectionKey: string; namespaceId: string }>> = [];
  const options: HubReplicationEdgeOptions = {
    instanceId: HUB_INSTANCE,
    timer: timer.timer,
    authorize: overrides.authorize ?? ((): Promise<NamespaceAuthorization> => Promise.resolve(AUTHORIZED)),
    resolveSessionSink:
      overrides.resolveSessionSink ??
      ((connectionKey, namespaceId) => {
        resolveCalls.push({ connectionKey, namespaceId });
        return makeSinkHarness();
      }),
    observer: (event) => {
      events.push(event);
    },
    ...(overrides.verifyToken === undefined
      ? {}
      : {
          verifyToken: (token: string) => {
            verifyTokenCalls.push(token);
            return overrides.verifyToken!(token);
          },
        }),
    ...(overrides.limits === undefined ? {} : { limits: overrides.limits }),
    ...(overrides.timeouts === undefined ? {} : { timeouts: overrides.timeouts }),
  };
  return { factory: createHubReplicationEdge(options), wire, timer, events, verifyTokenCalls, resolveCalls };
}

function rejectionReasons(events: readonly ReplicationObserverEvent[]): string[] {
  return events
    .filter(
      (event): event is Extract<ReplicationObserverEvent, { type: 'auth-upgrade-rejected' }> =>
        event.type === 'auth-upgrade-rejected',
    )
    .map((event) => event.reason);
}

function deferred<T>(): { readonly promise: Promise<T>; readonly resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settlePromise) => {
    resolve = settlePromise;
  });
  return { promise, resolve };
}

const IMMEDIATE_VERIFIER: PeerTokenVerifier = async (token: string) =>
  token === TOKEN ? { ok: true, instanceId: PEER_INSTANCE } : { ok: false };

function makeMonolith(
  verifyToken: PeerTokenVerifier,
  limits?: HubReplicationEdgeOptions['limits'],
): { readonly hub: ReturnType<typeof createHubReplication>; readonly wire: Wire } {
  const wire = makeWire();
  const timer = makeFakeTimer();
  const hub = createHubReplication({
    instanceId: HUB_INSTANCE,
    registry: {
      open: async () => {
        throw new Error('parity fixture: registry.open 未被使用');
      },
    } as unknown as NamespaceRegistry,
    authorize: async () => ({ ok: false }),
    timer: timer.timer,
    verifyToken,
    ...(limits === undefined ? {} : { limits }),
  });
  return { hub, wire };
}

// ═══════════════════════════ EF-C2：accept 双入口 ═══════════════════════════

describe('issue #421 EF-C2：accept 双入口（verifyToken 恰一次 / acceptTrusted 零调用）', () => {
  it('EF-C1：公共入口运行期导出面 append-only（+1 且既有 11 名零删除；零 Registry 依赖）', async () => {
    const productionApi = (await import('@nomicore/ws-replication')) as Record<string, unknown>;
    expect(typeof productionApi.createHubReplicationEdge).toBe('function');
    const legacyNames = [
      'DEFAULT_REPLICATION_BACKOFF',
      'DEFAULT_REPLICATION_LIMITS',
      'DEFAULT_REPLICATION_TIMEOUTS',
      'NOMICORE_HUB_REPLICATION_SERVICE',
      'NOMICORE_PEER_REPLICATION_SERVICE',
      'createHubReplication',
      'createHubReplicationPlugin',
      'createPeerReplication',
      'createPeerReplicationPlugin',
      'requireHubReplication',
      'requirePeerReplication',
    ];
    for (const name of legacyNames) {
      expect(Object.keys(productionApi)).toContain(name);
    }
    expect(Object.keys(productionApi).length).toBeGreaterThanOrEqual(legacyNames.length + 1);
    // 普通工厂（非 Cordis 插件、无 Registry 依赖）：fixture 仅注入 transport/timer/authorize/
    // resolveSessionSink 即可构造并接纳（上方各用例已实证）——此处锁工厂面两成员。
    const fixture = makeFactory();
    expect(typeof fixture.factory.accept).toBe('function');
    expect(typeof fixture.factory.acceptTrusted).toBe('function');
  });

  it('EF-C2a：accept 成功 → verifyToken 恰一次（入参 = token）+ 句柄面齐备 + HELLO 后可握手', async () => {
    const fixture = makeFactory({ verifyToken: IMMEDIATE_VERIFIER });
    const connection = await fixture.factory.accept(fixture.wire.hubEnd, { token: TOKEN });
    await settle();
    expect(fixture.verifyTokenCalls).toEqual([TOKEN]);
    expect(connection).toBeDefined();
    const handle = connection!;
    expect(handle.authenticatedInstanceId).toBe(PEER_INSTANCE);
    expect(handle.connectionKey).toBe(`${HUB_INSTANCE}-conn-0`);
    expect(handle.state).toBe('handshaking');
    expect(handle.peerInstanceId).toBeUndefined();
    expect(handle.namespaces.size).toBe(0);
    for (const member of [
      handle.egress.sendControlFrame,
      handle.egress.sendDataFrame,
      handle.egress.namespaceSettled,
      handle.egress.connectionFatal,
      handle.egress.chunkedUpdateNegotiated,
      handle.close,
      handle.settle,
      handle.beginReauth,
      handle.revokeNamespace,
    ]) {
      expect(typeof member).toBe('function');
    }
    fixture.wire.inject(helloFrame(1));
    await settle();
    expect(handle.state).toBe('ready');
    expect(handle.peerInstanceId).toBe(PEER_INSTANCE);
    expect(fixture.wire.outbound.map(rawSequence)).toEqual([1]);
    expect(decodeMessage(fixture.wire.outbound[0]!).message).toMatchObject({
      kind: 'HELLO_ACK',
      connectionId: `${HUB_INSTANCE}-conn-0`,
    });
    expect(fixture.wire.closes).toEqual([]);
  });

  it('EF-C2b：acceptTrusted → verifyToken 零调用 + 认证身份绑定（HELLO 自报不得覆盖）', async () => {
    const fixture = makeFactory({
      verifyToken: async () => {
        throw new Error('acceptTrusted 不得消费 verifyToken');
      },
    });
    const connection = await fixture.factory.acceptTrusted(fixture.wire.hubEnd, {
      peerInstanceId: PEER_INSTANCE,
    });
    await settle();
    expect(connection).toBeDefined();
    expect(fixture.verifyTokenCalls).toEqual([]);
    expect(connection!.authenticatedInstanceId).toBe(PEER_INSTANCE);
    // HELLO 自报另一身份 → 连接级 INSTANCE_IDENTITY_MISMATCH + 1008（受信身份为权威）
    fixture.wire.inject(helloFrame(1, 'peer-mallory'));
    await settle();
    expect(fixture.wire.closes).toEqual([{ code: 1008, reason: 'protocol-error' }]);
    expect(fixture.wire.outbound).toHaveLength(1);
    expect(decodeMessage(fixture.wire.outbound[0]!).message).toMatchObject({
      kind: 'ERROR',
      code: 'INSTANCE_IDENTITY_MISMATCH',
    });
  });

  it('EF-C2c：缺凭据（缺失/非串/空串）→ 1008 upgrade-unauthorized + 零调用零分配', async () => {
    for (const request of [undefined, { token: 123 } as unknown as HubUpgradeRequest, { token: '' }]) {
      const fixture = makeFactory({ verifyToken: IMMEDIATE_VERIFIER });
      const connection = await fixture.factory.accept(fixture.wire.hubEnd, request);
      await settle();
      expect(connection).toBeUndefined();
      expect(fixture.verifyTokenCalls).toEqual([]);
      expect(fixture.resolveCalls).toEqual([]);
      expect(fixture.wire.closes).toEqual([{ code: 1008, reason: 'upgrade-unauthorized' }]);
      expect(rejectionReasons(fixture.events)).toEqual(['missing-token']);
    }
  });

  it('EF-C2d：无认证器 → 1008 upgrade-unauthorized + {verifier-missing}（fail-closed）', async () => {
    const fixture = makeFactory();
    const connection = await fixture.factory.accept(fixture.wire.hubEnd, { token: TOKEN });
    await settle();
    expect(connection).toBeUndefined();
    expect(fixture.wire.closes).toEqual([{ code: 1008, reason: 'upgrade-unauthorized' }]);
    expect(rejectionReasons(fixture.events)).toEqual(['verifier-missing']);
  });

  it('EF-C2e：裁决 null/{ok:false}/throw/文法违例 → 1008 + reason 闭集 + accept 永不 reject', async () => {
    const cases: Array<Readonly<{ verifier: PeerTokenVerifier; reason: string }>> = [
      { verifier: async () => null as unknown as { ok: false }, reason: 'invalid-credentials' },
      { verifier: async () => ({ ok: false }), reason: 'invalid-credentials' },
      {
        verifier: async () => {
          throw new Error('verifier exploded');
        },
        reason: 'invalid-credentials',
      },
      { verifier: async () => ({ ok: true, instanceId: 'Bad-Id!' }), reason: 'invalid-instance-id' },
    ];
    for (const testCase of cases) {
      const fixture = makeFactory({ verifyToken: testCase.verifier });
      const connection = await fixture.factory.accept(fixture.wire.hubEnd, { token: TOKEN });
      await settle();
      expect(connection).toBeUndefined();
      expect(fixture.resolveCalls).toEqual([]);
      expect(fixture.wire.closes).toEqual([{ code: 1008, reason: 'upgrade-unauthorized' }]);
      expect(rejectionReasons(fixture.events)).toEqual([testCase.reason]);
    }
  });

  it('EF-C2f：auth timer 超时 → 1008 upgrade-timeout + {auth-timeout}；裁决迟归不复活（零分配）', async () => {
    const verdict = deferred<{ ok: true; instanceId: string }>();
    const fixture = makeFactory({
      timeouts: { helloTimeoutMs: 1_000 },
      verifyToken: () => verdict.promise,
    });
    const pending = fixture.factory.accept(fixture.wire.hubEnd, { token: TOKEN });
    await settle();
    expect(fixture.timer.pendingDelays()).toContain(1_000);
    fixture.timer.fireNext(1_000);
    await settle();
    // 超时效果同步可见（close + observer 事件 + 零分配）——`accept` 自身在验证器归位后才结算
    expect(fixture.wire.closes).toEqual([{ code: 1008, reason: 'upgrade-timeout' }]);
    expect(rejectionReasons(fixture.events)).toEqual(['auth-timeout']);
    expect(fixture.resolveCalls).toEqual([]);
    expect(fixture.timer.pendingDelays()).toEqual([]);
    verdict.resolve({ ok: true, instanceId: PEER_INSTANCE });
    const connection = await pending;
    await settle();
    expect(connection).toBeUndefined();
    expect(fixture.resolveCalls).toEqual([]);
  });

  it('EF-C2g：acceptTrusted 身份文法违例 → 1008 + {invalid-instance-id}', async () => {
    const fixture = makeFactory();
    const connection = await fixture.factory.acceptTrusted(fixture.wire.hubEnd, {
      peerInstanceId: 'Bad-Id!',
    });
    await settle();
    expect(connection).toBeUndefined();
    expect(fixture.wire.closes).toEqual([{ code: 1008, reason: 'upgrade-unauthorized' }]);
    expect(rejectionReasons(fixture.events)).toEqual(['invalid-instance-id']);
  });

  it('EF-C2h：accept 路径的裁决迟到于超时 → 零分配（迟归不复活）', async () => {
    const verdict = deferred<{ ok: true; instanceId: string }>();
    const fixture = makeFactory({
      timeouts: { helloTimeoutMs: 500 },
      verifyToken: () => verdict.promise,
    });
    const pending = fixture.factory.accept(fixture.wire.hubEnd, { token: TOKEN });
    await settle();
    fixture.timer.fireNext(500);
    await settle();
    verdict.resolve({ ok: true, instanceId: PEER_INSTANCE });
    const connection = await pending;
    await settle();
    expect(connection).toBeUndefined();
    expect(fixture.resolveCalls).toEqual([]);
    expect(fixture.wire.closes).toEqual([{ code: 1008, reason: 'upgrade-timeout' }]);
    expect(rejectionReasons(fixture.events)).toEqual(['auth-timeout']);
  });
});

// ═══════════════════════════ EF-C3：早到帧 admission parity ═══════════════════════════

describe('issue #421 EF-C3：升级期早到帧有界 admission（工厂入口与单体同机制单点）', () => {
  it('EF-C3a：≤16 早到帧按到达序重放（合规 HELLO 早到 → HELLO_ACK 正常）', async () => {
    const verdict = deferred<{ ok: true; instanceId: string }>();
    const fixture = makeFactory({ verifyToken: () => verdict.promise });
    const pending = fixture.factory.accept(fixture.wire.hubEnd, { token: TOKEN });
    await settle();
    // 16 帧早到（HELLO + 15 笔未知 ns 帧）——HELLO 使连接进入 ready，后续帧逐帧合成违例 ERROR
    fixture.wire.inject(helloFrame(1));
    for (let index = 0; index < 15; index += 1) {
      fixture.wire.inject(closeFrame(NS_A, index + 2));
    }
    await settle();
    expect(fixture.wire.outbound).toEqual([]);
    verdict.resolve({ ok: true, instanceId: PEER_INSTANCE });
    const connection = await pending;
    await settle();
    expect(connection).toBeDefined();
    // 构造尾按到达序重放：HELLO_ACK + 15 笔违例 ERROR，sequence 严格 1..16
    expect(fixture.wire.outbound.map(rawSequence)).toEqual(
      Array.from({ length: 16 }, (_, index) => index + 1),
    );
    expect(fixture.wire.closes).toEqual([]);
  });

  it('EF-C3b：第 17 帧 → 1008 upgrade-frame-limit + {early-frame-limit} + 零分配', async () => {
    const verdict = deferred<{ ok: true; instanceId: string }>();
    const fixture = makeFactory({ verifyToken: () => verdict.promise });
    const pending = fixture.factory.accept(fixture.wire.hubEnd, { token: TOKEN });
    await settle();
    for (let index = 0; index < 17; index += 1) {
      fixture.wire.inject(helloFrame(index + 1));
    }
    await settle();
    expect(fixture.wire.closes).toEqual([{ code: 1008, reason: 'upgrade-frame-limit' }]);
    verdict.resolve({ ok: true, instanceId: PEER_INSTANCE });
    const connection = await pending;
    await settle();
    expect(connection).toBeUndefined();
    expect(fixture.resolveCalls).toEqual([]);
    expect(rejectionReasons(fixture.events)).toEqual(['early-frame-limit']);
  });

  it('EF-C3c：单帧 > maxFrameBytes → 1009 upgrade-frame-limit + {frame-too-large}', async () => {
    const verdict = deferred<{ ok: true; instanceId: string }>();
    const fixture = makeFactory({
      limits: FRAME_LIMIT_LIMITS,
      verifyToken: () => verdict.promise,
    });
    const pending = fixture.factory.accept(fixture.wire.hubEnd, { token: TOKEN });
    await settle();
    fixture.wire.inject(bigFrame(OVERSIZED_FRAME_BYTES));
    await settle();
    expect(fixture.wire.closes).toEqual([{ code: 1009, reason: 'upgrade-frame-limit' }]);
    expect(rejectionReasons(fixture.events)).toEqual(['frame-too-large']);
    verdict.resolve({ ok: true, instanceId: PEER_INSTANCE });
    const connection = await pending;
    expect(connection).toBeUndefined();
    expect(fixture.resolveCalls).toEqual([]);
  });

  it('EF-C3d：门 6/7 次序（即时验证器 + 超界帧零宽窗口）→ 工厂与单体同 close code/reason', async () => {
    const grammarViolatingVerifier: PeerTokenVerifier = async () => ({
      ok: true,
      instanceId: 'Bad-Id!',
    });
    const factoryFixture = makeFactory({
      limits: FRAME_LIMIT_LIMITS,
      verifyToken: grammarViolatingVerifier,
    });
    const factoryPending = factoryFixture.factory.accept(factoryFixture.wire.hubEnd, { token: TOKEN });
    factoryFixture.wire.inject(bigFrame(OVERSIZED_FRAME_BYTES));
    const factoryConnection = await factoryPending;
    await settle();

    const monolith = makeMonolith(grammarViolatingVerifier, FRAME_LIMIT_LIMITS);
    const monolithPending = monolith.hub.accept(monolith.wire.hubEnd, { token: TOKEN });
    monolith.wire.inject(bigFrame(OVERSIZED_FRAME_BYTES));
    const monolithConnection = await monolithPending;
    await settle();

    expect(factoryConnection).toBeUndefined();
    expect(monolithConnection).toBeUndefined();
    // 让位复查（帧限先于文法检查）→ 两者都落帧限拒绝，而非 'invalid-instance-id'
    expect(factoryFixture.wire.closes).toEqual([{ code: 1009, reason: 'upgrade-frame-limit' }]);
    expect(monolith.wire.closes).toEqual(factoryFixture.wire.closes);
    expect(rejectionReasons(factoryFixture.events)).toEqual(['frame-too-large']);
  });

  it('EF-C3e：合规单帧 HELLO 早到必须成功接纳（负控：门不是全拒）', async () => {
    const verdict = deferred<{ ok: true; instanceId: string }>();
    const fixture = makeFactory({ verifyToken: () => verdict.promise });
    const pending = fixture.factory.accept(fixture.wire.hubEnd, { token: TOKEN });
    await settle();
    fixture.wire.inject(helloFrame(1));
    await settle();
    verdict.resolve({ ok: true, instanceId: PEER_INSTANCE });
    const connection = await pending;
    await settle();
    expect(connection).toBeDefined();
    expect(fixture.wire.closes).toEqual([]);
    expect(fixture.wire.outbound.map(rawSequence)).toEqual([1]);
  });

  it('EF-C3f：类型面接线（句柄/sink/egress 具名类型可从公共入口导入）', () => {
    const resolver: HubSessionSinkResolver = () => undefined;
    const grant: NamespaceAuthorizationGrant = AUTHORIZED;
    const connection: HubReplicationEdgeConnection | undefined = undefined;
    expect(resolver(`${HUB_INSTANCE}-conn-0`, NS_A, grant)).toBeUndefined();
    expect(grant.ok).toBe(true);
    expect(connection).toBeUndefined();
  });
});
