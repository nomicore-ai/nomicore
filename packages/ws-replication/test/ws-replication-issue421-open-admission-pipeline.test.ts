/**
 * SA6 验收契约 — issue #421（spec #415 T4）：**OPEN 准入管线全分支**（ADR 0032 决策 3）。
 *
 * 覆盖条目（契约 `wiki/raw/task_issue-421_sa6_contract.md` §12.2 OAP-C1..C8 + 设计 §12 增补
 * OAP-C4b/C9/C10；设计 `wiki/raw/task_issue-421_design.md` §7-D3/§8.2）：
 *   OAP-C1  HELLO/drain 门：pre-HELLO OPEN → `HELLO_REQUIRED`+1002；drain 窗口 OPEN 零 authorize/
 *           零回调（负控：窗口内 CLOSE 族照常路由）；
 *   OAP-C2  全解码：坏 magic / 截断 / seq gap → 连接级注册表码 + 1002，零 authorize/零回调；
 *   OAP-C3  authorize 三分：deny → ns `NAMESPACE_UNAUTHORIZED` + 宿主回调零调用；重 OPEN →
 *           `NAMESPACE_REOPEN_REQUIRES_RECONNECT` 且 authorize 恰一次；throw → ns `INTERNAL_ERROR`；
 *           `ok:true` 但无 read → denied；跨 ns 零互相影响；连接存活；
 *   OAP-C4  pending 有界缓冲：到达序缓冲 + 解析成功后同序按 kind 分派冲刷（OPEN → openNamespace、
 *           非 OPEN → namespaceFrame(msg, seq)）；成功后直投；第 17 项 → 恰一帧
 *           `CONNECTION_POLICY_VIOLATION` + close(1008)（负控：恰 16 项不收口）；
 *   OAP-C4b pending 期合流重 OPEN × 三结局（established → 逐项投递；denied/throw → N 帧应答 +
 *           事件族恰一；no-sink → 零应答）；
 *   OAP-C5  并发 OPEN 上界：4 个 in-flight 全通过（负控）；第 5 个 → 恰一帧连接级
 *           `CONNECTION_POLICY_VIOLATION` + close(1008)；
 *   OAP-C6  `resolveSessionSink` throw/reject → 恰一帧连接级 `INTERNAL_ERROR` + close(1011)
 *           （负控：返回 undefined 不走收口路径）；
 *   OAP-C7  已建立会话转发 + ns 键隔离；
 *   OAP-C8  调用序 `authorize → resolveSessionSink → 首帧投递` + `authorization` = ok 投影 +
 *           `connectionKey` 同连接恒定/跨连接互异 + 锁步（`namespaces` 集 ⟺ authorize 计数）；
 *   OAP-C9  迟归/守卫组（R4）：(a) authorize / 解析迟归于已收口连接 → 零 wire 零观测；
 *           (b) `openAdmission` reject（台账缺失）→ ns `INTERNAL_ERROR` 分类收口 + 连接存活；
 *   OAP-C10 sink 异常纪律（R5）：(a) 投递同步 throw → 恰一帧连接级 `INTERNAL_ERROR` + 1011；
 *           (b) `onConnectionClosed` reject → `close()`/`settle()` 恒 resolve；(c)
 *           `terminateUnauthorized` reject → `revokeNamespace` 恒 resolve；
 *   OAP-C11 SA4 F1/F2 回归：no-sink 重 OPEN（SD-5 重解析）受阶段 5 上界约束——并发 OPEN 上界
 *           与连接级 pending 帧预算两道路径均响亮收口（`CONNECTION_POLICY_VIOLATION` + 1008，
 *           被拒重 OPEN 不建会话）；上界内重解析照常成立（负控）；no-sink 结算把缓冲预算归还
 *           （循环 >16 次结算后新 ns 窗口仍满额可用，第 17 项仍响亮收口）。
 *
 * 纪律：断言 = 运行时行为（wire 原字节/close code+reason/observer 事件/宿主回调计数）；
 * 零源码 grep 断言；零 skip/only/todo；零 mock 被测对象（stub 只在宿主缝另一侧；
 * OAP-C9b 按设计授权对**内部适配器**做白盒注入——该模拟在公共面结构上不可达）。
 */
import { describe, expect, it } from 'vitest';
import { decodeMessage, encodeMessage } from '@nomicore/replication-protocol';
import type { ReplicationMessage } from '@nomicore/replication-protocol';
import { createHubReplicationEdge } from '@nomicore/ws-replication';
import type {
  DuplexTransport,
  HubNamespaceSessionSink,
  HubReplicationEdgeConnection,
  HubReplicationEdgeFactory,
  HubReplicationEdgeOptions,
  HubSessionSinkResolver,
  NamespaceAuthorization,
  NamespaceAuthorizationGrant,
  ReplicationObserverEvent,
  ReplicationTimer,
} from '@nomicore/ws-replication';
import { createMemoryDuplexTransport } from '@nomicore/ws-replication/testing';
import { collectUnhandledRejections } from './driver.js';
import { settle, settleUntil } from './harness.js';
import { HostSessionAdapter, MAX_PENDING_FRAMES_PER_CONNECTION } from '../src/hub-edge-host.js';
import type { HubSessionEdgePort } from '../src/hub-split.js';

// ═══════════════════════════ 局部 fixture ═══════════════════════════

const HUB_INSTANCE = 'hub-omega';
const PEER_INSTANCE = 'peer-alpha';
const NS_A = `ns-${'0'.repeat(31)}1`;
const NS_B = `ns-${'0'.repeat(31)}2`;
const NS_C = `ns-${'0'.repeat(31)}3`;
const NS_D = `ns-${'0'.repeat(31)}4`;
const NS_E = `ns-${'0'.repeat(31)}5`;
const NS_UNKNOWN = `ns-${'a'.repeat(32)}`;
const NS_UNKNOWN_B = `ns-${'b'.repeat(32)}`;
const HELLO_NONCE = new Uint8Array(16).fill(0x80);

const AUTHORIZED: NamespaceAuthorization = Object.freeze({
  ok: true as const,
  localOwner: Object.freeze({ userId: 'hub-owner-9f38' }),
  permissions: Object.freeze({ read: true, submit: true }),
});
const AUTHORIZED_NO_READ: NamespaceAuthorization = Object.freeze({
  ok: true as const,
  localOwner: Object.freeze({ userId: 'hub-owner-9f38' }),
  permissions: Object.freeze({ read: false, submit: true }),
});
const DENIED: NamespaceAuthorization = Object.freeze({ ok: false as const });

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

/** 路由键违例：合法帧的 namespaceId varString 前缀字节 `[20]` 由 0x23 改坏为 0x22。 */
function routeKeyViolationFrame(namespaceId: string, sequence: number): Uint8Array {
  const bytes = closeFrame(namespaceId, sequence);
  const corrupted = bytes.slice();
  corrupted[20] = 0x22;
  return corrupted;
}

function errorOf(bytes: Uint8Array): Extract<ReplicationMessage, { kind: 'ERROR' }> {
  const decoded = decodeMessage(bytes).message;
  if (decoded.kind !== 'ERROR') throw new Error(`期望 ERROR 帧，实际 ${decoded.kind}`);
  return decoded;
}

/** 出站序列中的全部 ERROR 帧（HELLO_ACK / GOAWAY 等非 ERROR 帧先解码判别）。 */
function errorsOf(frames: readonly Uint8Array[]): Array<Extract<ReplicationMessage, { kind: 'ERROR' }>> {
  const errors: Array<Extract<ReplicationMessage, { kind: 'ERROR' }>> = [];
  for (const bytes of frames) {
    const decoded = decodeMessage(bytes).message;
    if (decoded.kind === 'ERROR') errors.push(decoded);
  }
  return errors;
}

interface FakeTimer {
  readonly timer: ReplicationTimer;
  pendingDelays(): number[];
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

interface SinkHarness {
  readonly sink: HubNamespaceSessionSink;
  readonly opens: string[];
  readonly frames: Array<Readonly<{ kind: string; namespaceId: string | undefined; sequence: number }>>;
  readonly terminated: string[];
  closedCount(): number;
}

function makeSink(overrides: {
  readonly throwOnOpen?: boolean;
  readonly throwOnFrame?: boolean;
  readonly rejectOnClose?: boolean;
  readonly rejectOnTerminate?: boolean;
} = {}): SinkHarness {
  const opens: string[] = [];
  const frames: Array<Readonly<{ kind: string; namespaceId: string | undefined; sequence: number }>> = [];
  const terminated: string[] = [];
  let closedCount = 0;
  const sink: HubNamespaceSessionSink = {
    openNamespace: (message) => {
      if (overrides.throwOnOpen === true) throw new Error('host sink openNamespace failed');
      opens.push(message.namespaceId);
    },
    namespaceFrame: (message, sequence) => {
      if (overrides.throwOnFrame === true) throw new Error('host sink namespaceFrame failed');
      frames.push({
        kind: message.kind,
        namespaceId: 'namespaceId' in message ? message.namespaceId : undefined,
        sequence,
      });
    },
    terminateUnauthorized: () => {
      terminated.push('terminate');
      return overrides.rejectOnTerminate === true
        ? Promise.reject(new Error('host sink terminateUnauthorized failed'))
        : Promise.resolve();
    },
    onConnectionClosed: () => {
      closedCount += 1;
      return overrides.rejectOnClose === true
        ? Promise.reject(new Error('host sink onConnectionClosed failed'))
        : Promise.resolve();
    },
  };
  return { sink, opens, frames, terminated, closedCount: () => closedCount };
}

interface FactoryOverrides {
  readonly authorize?: (instanceIdentity: string, namespaceId: string) => Promise<NamespaceAuthorization>;
  readonly resolveSessionSink?: HubSessionSinkResolver;
  readonly limits?: HubReplicationEdgeOptions['limits'];
  readonly timeouts?: HubReplicationEdgeOptions['timeouts'];
}

interface FactoryHarness {
  readonly factory: HubReplicationEdgeFactory;
  readonly wire: Wire;
  readonly timer: FakeTimer;
  readonly events: ReplicationObserverEvent[];
  readonly authorizeCalls: Array<Readonly<{ instanceIdentity: string; namespaceId: string }>>;
  readonly resolveCalls: Array<
    Readonly<{ connectionKey: string; namespaceId: string; authorization: NamespaceAuthorizationGrant }>
  >;
  readonly order: string[];
  readonly sinks: Map<string, SinkHarness>;
  sinkOf(namespaceId: string): SinkHarness;
}

function makeFactory(overrides: FactoryOverrides = {}): FactoryHarness {
  const wire = makeWire();
  const timer = makeFakeTimer();
  const events: ReplicationObserverEvent[] = [];
  const authorizeCalls: FactoryHarness['authorizeCalls'] = [];
  const resolveCalls: FactoryHarness['resolveCalls'] = [];
  const order: string[] = [];
  const sinks = new Map<string, SinkHarness>();
  const options: HubReplicationEdgeOptions = {
    instanceId: HUB_INSTANCE,
    timer: timer.timer,
    authorize: (instanceIdentity, namespaceId) => {
      authorizeCalls.push({ instanceIdentity, namespaceId });
      order.push(`authorize:${namespaceId}`);
      return overrides.authorize === undefined
        ? Promise.resolve(AUTHORIZED)
        : overrides.authorize(instanceIdentity, namespaceId);
    },
    resolveSessionSink: (connectionKey, namespaceId, authorization) => {
      resolveCalls.push({ connectionKey, namespaceId, authorization });
      order.push(`resolve:${namespaceId}`);
      if (overrides.resolveSessionSink !== undefined) {
        return overrides.resolveSessionSink(connectionKey, namespaceId, authorization);
      }
      const harness = makeSink();
      sinks.set(namespaceId, harness);
      return {
        openNamespace: (message) => {
          order.push(`open:${message.namespaceId}`);
          harness.sink.openNamespace(message);
        },
        namespaceFrame: (message, sequence) => {
          order.push(`frame:${message.kind}`);
          harness.sink.namespaceFrame(message, sequence);
        },
        terminateUnauthorized: () => harness.sink.terminateUnauthorized(),
        onConnectionClosed: () => harness.sink.onConnectionClosed(),
      };
    },
    observer: (event) => {
      events.push(event);
    },
    ...(overrides.limits === undefined ? {} : { limits: overrides.limits }),
    ...(overrides.timeouts === undefined ? {} : { timeouts: overrides.timeouts }),
  };
  return {
    factory: createHubReplicationEdge(options),
    wire,
    timer,
    events,
    authorizeCalls,
    resolveCalls,
    order,
    sinks,
    sinkOf: (namespaceId) => {
      const harness = sinks.get(namespaceId);
      if (harness === undefined) throw new Error(`fixture: ns ${namespaceId} 无 sink 记录`);
      return harness;
    },
  };
}

function deferred<T>(): { readonly promise: Promise<T>; readonly resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settlePromise) => {
    resolve = settlePromise;
  });
  return { promise, resolve };
}

async function connect(fixture: FactoryHarness): Promise<HubReplicationEdgeConnection> {
  const connection = await fixture.factory.acceptTrusted(fixture.wire.hubEnd, {
    peerInstanceId: PEER_INSTANCE,
  });
  await settle();
  if (connection === undefined) throw new Error('fixture: acceptTrusted 未分配连接');
  return connection;
}

/** 握手 + 建立指定 ns 的会话（记录型宿主 sink）。 */
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

function namespaceErrorEvents(
  events: readonly ReplicationObserverEvent[],
): Array<Extract<ReplicationObserverEvent, { type: 'namespace-error' }>> {
  return events.filter(
    (event): event is Extract<ReplicationObserverEvent, { type: 'namespace-error' }> =>
      event.type === 'namespace-error',
  );
}

function namespaceFailedEvents(
  events: readonly ReplicationObserverEvent[],
): Array<Extract<ReplicationObserverEvent, { type: 'namespace-failed' }>> {
  return events.filter(
    (event): event is Extract<ReplicationObserverEvent, { type: 'namespace-failed' }> =>
      event.type === 'namespace-failed',
  );
}

function connectionFailedEvents(
  events: readonly ReplicationObserverEvent[],
): Array<Extract<ReplicationObserverEvent, { type: 'connection-failed' }>> {
  return events.filter(
    (event): event is Extract<ReplicationObserverEvent, { type: 'connection-failed' }> =>
      event.type === 'connection-failed',
  );
}

// ═══════════════════════════ OAP-C1：HELLO / drain 门 ═══════════════════════════

describe('issue #421 OAP-C1：HELLO/drain 门（edge 现行门零改动继承）', () => {
  it('OAP-C1a：pre-HELLO OPEN → HELLO_REQUIRED + close(1002)，零 authorize 零回调', async () => {
    const fixture = makeFactory();
    const connection = await connect(fixture);
    fixture.wire.inject(openFrame(NS_A, 1));
    await settle();
    expect(fixture.authorizeCalls).toEqual([]);
    expect(fixture.resolveCalls).toEqual([]);
    expect(fixture.wire.closes).toEqual([{ code: 1002, reason: 'protocol-error' }]);
    const preHelloError = errorOf(fixture.wire.outbound[0]!);
    expect(preHelloError.code).toBe('HELLO_REQUIRED');
    expect(preHelloError.namespaceId).toBeUndefined();
    expect(connection.namespaces.size).toBe(0);
  });

  it('OAP-C1b：drain 窗口 OPEN 零 authorize/零回调零新会话（负控：CLOSE 族照常路由）', async () => {
    const fixture = makeFactory();
    const connection = await connect(fixture);
    await establish(fixture, [NS_A]);
    expect(fixture.authorizeCalls).toHaveLength(1);
    connection.beginReauth();
    await settle();
    const framesBefore = fixture.wire.outbound.length;
    fixture.wire.inject(openFrame(NS_UNKNOWN, 3));
    await settle();
    expect(fixture.authorizeCalls).toHaveLength(1); // drain 期 OPEN 零 authorize
    expect(fixture.resolveCalls).toHaveLength(1);
    expect(connection.namespaces).toEqual(new Set([NS_A]));
    // 负控：窗口不是全静默——已建立 ns 的 CLOSE 族仍按既有门语义路由
    fixture.wire.inject(closeFrame(NS_A, 4));
    await settle();
    expect(fixture.sinkOf(NS_A).frames.map((frame) => frame.kind)).toEqual(['CLOSE_NAMESPACE']);
    expect(fixture.wire.outbound.length).toBe(framesBefore); // 零新出站帧（GOAWAY 在 framesBefore 内）
  });
});

// ═══════════════════════════ OAP-C2：全解码（畸形 ingress 收口） ═══════════════════════════

describe('issue #421 OAP-C2：全解码门（畸形 ingress → 连接级注册表码 + 1002）', () => {
  it('OAP-C2a：坏 magic → BAD_MAGIC + 1002，零 authorize/零回调/零会话', async () => {
    const fixture = makeFactory();
    await connect(fixture);
    const badMagic = helloFrame(1).slice();
    badMagic[0] = 0x00;
    fixture.wire.inject(badMagic);
    await settle();
    expect(errorOf(fixture.wire.outbound[0]!)).toMatchObject({ code: 'BAD_MAGIC' });
    expect(fixture.wire.closes).toEqual([{ code: 1002, reason: 'protocol-error' }]);
    expect(fixture.authorizeCalls).toEqual([]);
    expect(fixture.resolveCalls).toEqual([]);
  });

  it('OAP-C2b：截断帧 → MALFORMED_FRAME 族 + 1002，零 authorize/零回调', async () => {
    const fixture = makeFactory();
    await connect(fixture);
    fixture.wire.inject(helloFrame(1).slice(0, 10));
    await settle();
    const truncated = errorOf(fixture.wire.outbound[0]!);
    // 截断帧的连接级注册表码（实测 FRAME_LENGTH_MISMATCH——信封长度不自洽；连接级 scope + 1002）
    expect(['BAD_MAGIC', 'MALFORMED_FRAME', 'SEQUENCE_VIOLATION', 'FRAME_LENGTH_MISMATCH']).toContain(
      truncated.code,
    );
    expect(truncated.namespaceId).toBeUndefined();
    expect(fixture.wire.closes).toEqual([{ code: 1002, reason: 'protocol-error' }]);
    expect(fixture.authorizeCalls).toEqual([]);
    expect(fixture.resolveCalls).toEqual([]);
  });

  it('OAP-C2c：seq gap → SEQUENCE_VIOLATION + 1002，零 authorize/零回调', async () => {
    const fixture = makeFactory();
    await connect(fixture);
    fixture.wire.inject(helloFrame(3)); // 首帧序列必须 = 1
    await settle();
    expect(errorOf(fixture.wire.outbound[0]!)).toMatchObject({ code: 'SEQUENCE_VIOLATION' });
    expect(fixture.wire.closes).toEqual([{ code: 1002, reason: 'protocol-error' }]);
    expect(fixture.authorizeCalls).toEqual([]);
    expect(fixture.resolveCalls).toEqual([]);
  });

  it('OAP-C2d：合法 OPEN 必须解码成功并进入 authorize（负控）', async () => {
    const fixture = makeFactory();
    await connect(fixture);
    await establish(fixture, [NS_A]);
    expect(fixture.authorizeCalls).toEqual([
      { instanceIdentity: PEER_INSTANCE, namespaceId: NS_A },
    ]);
    expect(fixture.resolveCalls).toHaveLength(1);
    expect(fixture.wire.closes).toEqual([]);
  });
});

// ═══════════════════════════ OAP-C3：authorize 三分 ═══════════════════════════

describe('issue #421 OAP-C3：authorize 拒绝/重开/抛错/无 read（未授权 OPEN 不过宿主缝）', () => {
  it('OAP-C3a：授权拒绝 → ns NAMESPACE_UNAUTHORIZED + 宿主回调零调用 + 连接存活', async () => {
    const fixture = makeFactory({ authorize: () => Promise.resolve(DENIED) });
    const connection = await connect(fixture);
    await establish(fixture, [NS_A]);
    expect(fixture.resolveCalls).toEqual([]); // 未授权 OPEN 不过宿主缝
    expect(connection.namespaces.size).toBe(0);
    expect(fixture.wire.closes).toEqual([]);
    expect(errorOf(fixture.wire.outbound[1]!)).toMatchObject({
      code: 'NAMESPACE_UNAUTHORIZED',
      namespaceId: NS_A,
    });
    const sent = namespaceErrorEvents(fixture.events);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ code: 'NAMESPACE_UNAUTHORIZED', direction: 'sent', namespaceId: NS_A });
    const failed = namespaceFailedEvents(fixture.events);
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ cause: 'open-failed', namespaceId: NS_A });
    // 连接存活实证：后续未知 ns 帧仍被处理（合成违例，非断链）
    fixture.wire.inject(closeFrame(NS_UNKNOWN, 3));
    await settle();
    expect(errorOf(fixture.wire.outbound[2]!)).toMatchObject({
      code: 'NAMESPACE_STATE_VIOLATION',
      namespaceId: NS_UNKNOWN,
    });
    expect(fixture.wire.closes).toEqual([]);
  });

  it('OAP-C3b：拒绝闩锁——同 ns 重 OPEN → NAMESPACE_REOPEN_REQUIRES_RECONNECT 且 authorize 恰一次', async () => {
    const fixture = makeFactory({ authorize: () => Promise.resolve(DENIED) });
    await connect(fixture);
    await establish(fixture, [NS_A]);
    fixture.wire.inject(openFrame(NS_A, 3));
    await settle();
    expect(errorOf(fixture.wire.outbound[2]!)).toMatchObject({
      code: 'NAMESPACE_REOPEN_REQUIRES_RECONNECT',
      namespaceId: NS_A,
    });
    expect(fixture.authorizeCalls).toHaveLength(1); // 累计仍恰一次
    expect(fixture.resolveCalls).toEqual([]);
    expect(namespaceErrorEvents(fixture.events)).toHaveLength(1); // 重开拒答仅 wire 帧、无事件
  });

  it('OAP-C3c：authorize throw → ns INTERNAL_ERROR，连接存活，不建会话', async () => {
    const fixture = makeFactory({
      authorize: () => {
        throw new Error('authorizer exploded');
      },
    });
    const connection = await connect(fixture);
    await establish(fixture, [NS_A]);
    expect(fixture.resolveCalls).toEqual([]);
    expect(connection.namespaces.size).toBe(0);
    expect(fixture.wire.closes).toEqual([]);
    expect(errorOf(fixture.wire.outbound[1]!)).toMatchObject({
      code: 'INTERNAL_ERROR',
      namespaceId: NS_A,
    });
    expect(namespaceFailedEvents(fixture.events)).toHaveLength(1);
  });

  it('OAP-C3d：ok:true 但无 read → denied；跨 ns 拒绝零互相影响', async () => {
    const fixture = makeFactory({
      authorize: (_instanceIdentity, namespaceId) =>
        Promise.resolve(namespaceId === NS_A ? AUTHORIZED_NO_READ : AUTHORIZED),
    });
    await connect(fixture);
    await establish(fixture, [NS_A, NS_B]);
    expect(errorOf(fixture.wire.outbound[1]!)).toMatchObject({
      code: 'NAMESPACE_UNAUTHORIZED',
      namespaceId: NS_A,
    });
    expect(fixture.sinkOf(NS_B).opens).toEqual([NS_B]);
    expect(fixture.resolveCalls.map((call) => call.namespaceId)).toEqual([NS_B]);
  });
});

// ═══════════════════════════ OAP-C4：pending 有界缓冲 ═══════════════════════════

describe('issue #421 OAP-C4：pending 有界缓冲（序保冲刷 + 按 kind 分派 + 溢出收口）', () => {
  it('OAP-C4a：authorize 在途帧按到达序缓冲，解析成功后按同序 + 按 kind 分派冲刷', async () => {
    const gate = deferred<NamespaceAuthorization>();
    const fixture = makeFactory({ authorize: () => gate.promise });
    await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    fixture.wire.inject(openFrame(NS_A, 2));
    fixture.wire.inject(closeFrame(NS_A, 3));
    fixture.wire.inject(closeFrame(NS_A, 4));
    await settle();
    expect(fixture.sinks.size).toBe(0); // 解析未完成：零投递
    expect(fixture.order).toEqual([`authorize:${NS_A}`]);
    gate.resolve(AUTHORIZED);
    await settle();
    expect(fixture.order).toEqual([
      `authorize:${NS_A}`,
      `resolve:${NS_A}`,
      `open:${NS_A}`,
      'frame:CLOSE_NAMESPACE',
      'frame:CLOSE_NAMESPACE',
    ]);
    const sink = fixture.sinkOf(NS_A);
    expect(sink.opens).toEqual([NS_A]);
    expect(sink.frames).toEqual([
      { kind: 'CLOSE_NAMESPACE', namespaceId: NS_A, sequence: 3 },
      { kind: 'CLOSE_NAMESPACE', namespaceId: NS_A, sequence: 4 },
    ]);
  });

  it('OAP-C4b：解析成功后到达的帧直投（不再经过缓冲，序单调）', async () => {
    const fixture = makeFactory();
    await connect(fixture);
    await establish(fixture, [NS_A]);
    fixture.wire.inject(closeFrame(NS_A, 3));
    await settle();
    expect(fixture.sinkOf(NS_A).frames).toEqual([
      { kind: 'CLOSE_NAMESPACE', namespaceId: NS_A, sequence: 3 },
    ]);
  });

  it('OAP-C4c：第 17 项缓冲 → 恰一帧 CONNECTION_POLICY_VIOLATION + close(1008)，不静默丢帧', async () => {
    const gate = deferred<NamespaceAuthorization>();
    const fixture = makeFactory({ authorize: () => gate.promise });
    const connection = await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    fixture.wire.inject(openFrame(NS_A, 2)); // 缓冲项 1
    for (let index = 0; index < MAX_PENDING_FRAMES_PER_CONNECTION; index += 1) {
      fixture.wire.inject(closeFrame(NS_A, 3 + index)); // 第 17 项在最后一次到达时溢出
    }
    await settle();
    expect(connection.state).toBe('closed');
    expect(fixture.wire.closes).toEqual([{ code: 1008, reason: 'protocol-error' }]);
    const errors = errorsOf(fixture.wire.outbound);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.code).toBe('CONNECTION_POLICY_VIOLATION');
    expect(errors[0]!.namespaceId).toBeUndefined();
    expect(fixture.sinks.size).toBe(0);
    // 迟归 authorize：连接已收口 → 零新 wire（静默结算，R4b）
    const outboundBefore = fixture.wire.outbound.length;
    gate.resolve(AUTHORIZED);
    await settle();
    expect(fixture.wire.outbound.length).toBe(outboundBefore);
    expect(fixture.resolveCalls).toEqual([]);
  });

  it('OAP-C4d：恰 16 项不溢出不收口（负控），解析后 16 项按序冲刷', async () => {
    const gate = deferred<NamespaceAuthorization>();
    const fixture = makeFactory({ authorize: () => gate.promise });
    const connection = await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    fixture.wire.inject(openFrame(NS_A, 2));
    for (let index = 0; index < MAX_PENDING_FRAMES_PER_CONNECTION - 1; index += 1) {
      fixture.wire.inject(closeFrame(NS_A, 3 + index));
    }
    await settle();
    expect(fixture.wire.closes).toEqual([]);
    expect(connection.state).toBe('ready');
    gate.resolve(AUTHORIZED);
    await settle();
    expect(fixture.sinkOf(NS_A).frames.map((frame) => frame.sequence)).toEqual(
      Array.from({ length: MAX_PENDING_FRAMES_PER_CONNECTION - 1 }, (_, index) => index + 3),
    );
  });
});

// ═══════════════════════════ OAP-C4b：pending 期合流重 OPEN × 三结局 ═══════════════════════════

describe('issue #421 OAP-C4b：pending 期合流重 OPEN（投递面/应答帧数/事件族恰一）', () => {
  it('OAP-C4b-established：N 个合流 OPEN → N 项经 openNamespace 投递（不新增解析调用）', async () => {
    const gate = deferred<NamespaceAuthorization>();
    const fixture = makeFactory({ authorize: () => gate.promise });
    await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    fixture.wire.inject(openFrame(NS_A, 2));
    fixture.wire.inject(openFrame(NS_A, 3));
    fixture.wire.inject(openFrame(NS_A, 4));
    await settle();
    gate.resolve(AUTHORIZED);
    await settle();
    expect(fixture.sinkOf(NS_A).opens).toEqual([NS_A, NS_A, NS_A]);
    expect(fixture.resolveCalls).toHaveLength(1);
    expect(fixture.authorizeCalls).toHaveLength(1);
  });

  it('OAP-C4b-denied：N 个合流 OPEN → N 帧 ns ERROR + 事件族恰一', async () => {
    const gate = deferred<NamespaceAuthorization>();
    const fixture = makeFactory({ authorize: () => gate.promise });
    await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    fixture.wire.inject(openFrame(NS_A, 2));
    fixture.wire.inject(openFrame(NS_A, 3));
    fixture.wire.inject(openFrame(NS_A, 4));
    await settle();
    gate.resolve(DENIED);
    await settle();
    const errors = errorsOf(fixture.wire.outbound);
    expect(errors).toHaveLength(3);
    for (const error of errors) {
      expect(error.code).toBe('NAMESPACE_UNAUTHORIZED');
      expect(error.namespaceId).toBe(NS_A);
    }
    expect(namespaceErrorEvents(fixture.events)).toHaveLength(1); // HB2：不按应答帧数
    expect(namespaceFailedEvents(fixture.events)).toHaveLength(1);
    expect(fixture.resolveCalls).toEqual([]);
  });

  it('OAP-C4b-throw：N 个合流 OPEN → N 帧 ns INTERNAL_ERROR + 事件族恰一', async () => {
    const fixture = makeFactory({
      authorize: () => {
        throw new Error('authorizer exploded');
      },
    });
    await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    fixture.wire.inject(openFrame(NS_A, 2));
    fixture.wire.inject(openFrame(NS_A, 3));
    await settle();
    const errors = errorsOf(fixture.wire.outbound);
    expect(errors).toHaveLength(2);
    for (const error of errors) {
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.namespaceId).toBe(NS_A);
    }
    expect(namespaceErrorEvents(fixture.events)).toHaveLength(1);
    expect(namespaceFailedEvents(fixture.events)).toHaveLength(1);
    expect(fixture.resolveCalls).toEqual([]);
  });

  it('OAP-C4b-no-sink：合流 OPEN 零应答（SD-5 登记），连接存活', async () => {
    const gate = deferred<NamespaceAuthorization>();
    const fixture = makeFactory({
      authorize: () => gate.promise,
      resolveSessionSink: () => undefined,
    });
    const connection = await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    fixture.wire.inject(openFrame(NS_A, 2));
    fixture.wire.inject(openFrame(NS_A, 3));
    await settle();
    gate.resolve(AUTHORIZED);
    await settle();
    expect(fixture.wire.outbound).toHaveLength(1); // 仅 HELLO_ACK——零应答
    expect(fixture.wire.closes).toEqual([]);
    expect(connection.namespaces.size).toBe(0);
    expect(namespaceFailedEvents(fixture.events)).toEqual([]);
  });
});

// ═══════════════════════════ OAP-C5：并发 OPEN 上界 ═══════════════════════════

describe('issue #421 OAP-C5：并发 OPEN 上界（CONNECTION_POLICY_VIOLATION + 1008）', () => {
  it('OAP-C5a：4 个 in-flight OPEN 全部正常解析零收口（负控）', async () => {
    const gate = deferred<NamespaceAuthorization>();
    const fixture = makeFactory({ authorize: () => gate.promise });
    const connection = await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    let sequence = 2;
    for (const namespaceId of [NS_A, NS_B, NS_C, NS_D]) {
      fixture.wire.inject(openFrame(namespaceId, sequence));
      sequence += 1;
    }
    await settle();
    expect(fixture.wire.closes).toEqual([]);
    expect(connection.state).toBe('ready');
    gate.resolve(AUTHORIZED);
    await settle();
    expect(connection.namespaces).toEqual(new Set([NS_A, NS_B, NS_C, NS_D]));
  });

  it('OAP-C5b：第 5 个 in-flight OPEN → 恰一帧 CONNECTION_POLICY_VIOLATION + close(1008) + quiesce', async () => {
    const gate = deferred<NamespaceAuthorization>();
    const fixture = makeFactory({ authorize: () => gate.promise });
    const connection = await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    let sequence = 2;
    for (const namespaceId of [NS_A, NS_B, NS_C, NS_D, NS_E]) {
      fixture.wire.inject(openFrame(namespaceId, sequence));
      sequence += 1;
    }
    await settle();
    expect(fixture.wire.closes).toEqual([{ code: 1008, reason: 'protocol-error' }]);
    const errors = errorsOf(fixture.wire.outbound);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.code).toBe('CONNECTION_POLICY_VIOLATION');
    expect(errors[0]!.namespaceId).toBeUndefined();
    expect(connection.state).toBe('closed');
    expect(fixture.resolveCalls).toEqual([]); // 被拒 OPEN 不建会话
  });
});

// ═══════════════════════════ OAP-C6：sink 解析失败响亮收口 ═══════════════════════════

describe('issue #421 OAP-C6：宿主解析失败 → 恰一帧连接级 INTERNAL_ERROR + close(1011)', () => {
  it('OAP-C6a：resolveSessionSink 同步 throw → 连接级 INTERNAL_ERROR + 1011', async () => {
    const fixture = makeFactory({
      resolveSessionSink: () => {
        throw new Error('host resolver exploded');
      },
    });
    const connection = await connect(fixture);
    await establish(fixture, [NS_A]);
    expect(connection.state).toBe('closed');
    expect(fixture.wire.closes).toEqual([{ code: 1011, reason: 'protocol-error' }]);
    const errors = errorsOf(fixture.wire.outbound);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.code).toBe('INTERNAL_ERROR');
    expect(errors[0]!.namespaceId).toBeUndefined();
    expect(connection.namespaces.size).toBe(0);
    expect(connectionFailedEvents(fixture.events)).toEqual([
      expect.objectContaining({ code: 'INTERNAL_ERROR', wsCloseCode: 1011 }),
    ]);
  });

  it('OAP-C6b：resolveSessionSink reject → 同收口路径（恰一帧 + 1011）', async () => {
    const fixture = makeFactory({
      resolveSessionSink: () => Promise.reject(new Error('host resolver rejected')),
    });
    const connection = await connect(fixture);
    await establish(fixture, [NS_A]);
    expect(connection.state).toBe('closed');
    expect(fixture.wire.closes).toEqual([{ code: 1011, reason: 'protocol-error' }]);
    expect(errorsOf(fixture.wire.outbound)).toHaveLength(1);
  });

  it('OAP-C6c：合法无 sink（undefined）不得走收口路径（负控）', async () => {
    const fixture = makeFactory({ resolveSessionSink: () => undefined });
    const connection = await connect(fixture);
    await establish(fixture, [NS_A]);
    expect(fixture.wire.closes).toEqual([]);
    expect(connection.state).toBe('ready');
    expect(fixture.wire.outbound).toHaveLength(1); // 仅 HELLO_ACK
  });
});

// ═══════════════════════════ OAP-C7：已建立会话转发 + ns 隔离 ═══════════════════════════

describe('issue #421 OAP-C7：已建立会话转发与 ns 键隔离', () => {
  it('OAP-C7a：解析成功后该 ns 帧投递到该 ns sink；他 ns sink 零污染', async () => {
    const fixture = makeFactory();
    await connect(fixture);
    await establish(fixture, [NS_A, NS_B]);
    fixture.wire.inject(closeFrame(NS_B, 4));
    await settle();
    expect(fixture.sinkOf(NS_A).frames).toEqual([]);
    expect(fixture.sinkOf(NS_B).frames).toEqual([
      { kind: 'CLOSE_NAMESPACE', namespaceId: NS_B, sequence: 4 },
    ]);
  });

  it('OAP-C7b：未 OPEN 的 ns 帧零投递（NC4 形态）', async () => {
    const fixture = makeFactory();
    await connect(fixture);
    await establish(fixture, [NS_A]);
    fixture.wire.inject(closeFrame(NS_UNKNOWN_B, 3));
    await settle();
    expect(fixture.sinkOf(NS_A).frames).toEqual([]);
    expect(errorOf(fixture.wire.outbound[1]!)).toMatchObject({
      code: 'NAMESPACE_STATE_VIOLATION',
      namespaceId: NS_UNKNOWN_B,
    });
  });
});

// ═══════════════════════════ OAP-C8：调用序 + 锁步 ═══════════════════════════

describe('issue #421 OAP-C8：调用序（authorize → resolve → 投递）与锁步断言', () => {
  it('OAP-C8a：authorization = ok 投影（localOwner/permissions，非摘要）', async () => {
    const fixture = makeFactory();
    const connection = await connect(fixture);
    await establish(fixture, [NS_A]);
    expect(fixture.resolveCalls).toHaveLength(1);
    const call = fixture.resolveCalls[0]!;
    expect(call.authorization).toEqual(AUTHORIZED);
    expect(call.authorization.localOwner).toEqual({ userId: 'hub-owner-9f38' });
    expect(call.authorization.permissions).toEqual({ read: true, submit: true });
    expect(call.namespaceId).toBe(NS_A);
    expect(call.connectionKey).toBe(connection.connectionKey);
  });

  it('OAP-C8b：connectionKey 同连接恒定、跨连接互异（形态 = `${instanceId}-conn-${n}`）', async () => {
    const fixture = makeFactory();
    const first = await connect(fixture);
    await establish(fixture, [NS_A, NS_B]);
    expect(new Set(fixture.resolveCalls.map((call) => call.connectionKey))).toEqual(
      new Set([first.connectionKey]),
    );
    expect(first.connectionKey).toBe(`${HUB_INSTANCE}-conn-0`);
    const secondWire = makeWire();
    const second = await fixture.factory.acceptTrusted(secondWire.hubEnd, {
      peerInstanceId: PEER_INSTANCE,
    });
    await settle();
    expect(second?.connectionKey).toBe(`${HUB_INSTANCE}-conn-1`);
    expect(second?.connectionKey).not.toBe(first.connectionKey);
  });

  it('OAP-C8c：锁步不变量（namespaces 集 ⟺ authorize 计数）+ 重复 OPEN 不新增解析调用', async () => {
    const fixture = makeFactory();
    const connection = await connect(fixture);
    await establish(fixture, [NS_A, NS_B]);
    expect(connection.namespaces).toEqual(new Set([NS_A, NS_B]));
    expect(fixture.authorizeCalls).toHaveLength(connection.namespaces.size);
    expect(fixture.resolveCalls).toHaveLength(connection.namespaces.size);
    fixture.wire.inject(openFrame(NS_A, 4)); // established 后重 OPEN
    await settle();
    expect(fixture.resolveCalls).toHaveLength(2); // 不新增解析调用
    expect(fixture.sinkOf(NS_A).opens).toEqual([NS_A, NS_A]); // 重开矩阵归宿主 sink
  });

  it('OAP-C8d：no-sink 重 OPEN → 重解析（缓存 grant 复用，authorize 不重复）', async () => {
    let reply: HubNamespaceSessionSink | undefined;
    const fixture = makeFactory({ resolveSessionSink: () => reply });
    await connect(fixture);
    await establish(fixture, [NS_A]);
    expect(fixture.resolveCalls).toHaveLength(1);
    fixture.wire.inject(openFrame(NS_A, 3));
    await settle();
    expect(fixture.resolveCalls).toHaveLength(2); // 重解析（SD-5 裁决）
    expect(fixture.authorizeCalls).toHaveLength(1); // authorize 不重复
    expect(fixture.wire.closes).toEqual([]);
  });
});

// ═══════════════════════════ OAP-C9：迟归/守卫组（R4） ═══════════════════════════

describe('issue #421 OAP-C9：迟归守卫（R4a/R4b）', () => {
  it('OAP-C9a：authorize 迟归于已收口连接 → 零 wire 零观测（denied/throw/authorized 三形态）', async () => {
    for (const verdict of [DENIED, AUTHORIZED]) {
      const gate = deferred<NamespaceAuthorization>();
      const fixture = makeFactory({ authorize: () => gate.promise });
      const connection = await connect(fixture);
      fixture.wire.inject(helloFrame(1));
      fixture.wire.inject(openFrame(NS_A, 2));
      await settle();
      // 他 ns fatal 先行（路由键违例 → 连接收口）
      fixture.wire.inject(routeKeyViolationFrame(NS_B, 3));
      await settle();
      expect(connection.state).toBe('closed');
      const outboundBefore = fixture.wire.outbound.length;
      const eventsBefore = fixture.events.length;
      gate.resolve(verdict);
      await settle();
      expect(fixture.wire.outbound.length).toBe(outboundBefore); // 零新 wire
      expect(fixture.events.length).toBe(eventsBefore); // 零新观测事件
      expect(fixture.resolveCalls).toEqual([]);
      expect(connection.namespaces.size).toBe(0);
    }
  });

  it('OAP-C9b：解析迟归（authorized 已过、宿主 sink 未归）→ 仅归一 onConnectionClosed 卫生通知', async () => {
    const gate = deferred<HubNamespaceSessionSink | undefined>();
    const fixture = makeFactory({ resolveSessionSink: () => gate.promise });
    const connection = await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    fixture.wire.inject(openFrame(NS_A, 2));
    await settle();
    fixture.wire.inject(routeKeyViolationFrame(NS_B, 3));
    await settle();
    expect(connection.state).toBe('closed');
    const late = makeSink();
    const outboundBefore = fixture.wire.outbound.length;
    gate.resolve(late.sink);
    await settle();
    expect(late.closedCount()).toBe(1); // 归一卫生通知（恰一次）
    expect(late.opens).toEqual([]);
    expect(fixture.wire.outbound.length).toBe(outboundBefore);
    expect(connection.namespaces.size).toBe(0);
  });

  it('OAP-C9c：openAdmission reject（台账缺失，白盒注入）→ ns INTERNAL_ERROR 分类收口 + 连接存活', async () => {
    const unhandled = collectUnhandledRejections();
    try {
      const control: Uint8Array[] = [];
      const events: ReplicationObserverEvent[] = [];
      const fatalCalls: Array<Readonly<{ code: string; wsCloseCode: number | undefined }>> = [];
      const port = {
        openAdmission: () => Promise.reject(new Error('ledger record missing')),
        sendControlFrame: (frame: Uint8Array) => {
          control.push(frame);
          return control.length;
        },
        sendDataFrame: () => 0,
        dataGateOpen: () => true,
        onDataQueued: () => undefined,
        requestDataDrain: () => undefined,
        chunkedUpdateNegotiated: () => false,
        connectionFatal: (code: string, wsCloseCode?: number) => {
          fatalCalls.push({ code, wsCloseCode });
        },
        onChannelSettled: () => undefined,
        tryBeginInboundAssembly: () => true,
        endInboundAssembly: () => undefined,
        observerPresent: () => true,
        emitObserver: (event: ReplicationObserverEvent) => {
          events.push(event);
        },
        connectionId: () => `${HUB_INSTANCE}-conn-0`,
        connectionState: () => 'ready' as const,
        bufferedAmount: () => undefined,
      } as unknown as HubSessionEdgePort;
      const adapter = new HostSessionAdapter({
        connectionKey: `${HUB_INSTANCE}-conn-0`,
        port,
        resolveSessionSink: () => undefined,
      });
      adapter.openNamespace({ kind: 'OPEN_NAMESPACE', namespaceId: NS_A, hasLocalReplica: false });
      await settleUntil(() => control.length > 0, 'openAdmission reject → ns INTERNAL_ERROR');
      expect(errorOf(control[0]!)).toMatchObject({ code: 'INTERNAL_ERROR', namespaceId: NS_A });
      expect(fatalCalls).toEqual([]); // 连接存活（分类收口，非连接级收口）
      expect(namespaceErrorEvents(events)).toHaveLength(1);
      expect(namespaceFailedEvents(events)).toHaveLength(1);
      await settle();
      expect(unhandled.events).toEqual([]); // 零 unhandled rejection
    } finally {
      unhandled.dispose();
    }
  });
});

// ═══════════════════════════ OAP-C10：sink 异常纪律（R5） ═══════════════════════════

describe('issue #421 OAP-C10：宿主 sink 异常纪律（发布即冻结的契约条款）', () => {
  it('OAP-C10a：sink 投递同步 throw → 恰一帧连接级 INTERNAL_ERROR + close(1011)', async () => {
    const throwing = makeSink({ throwOnOpen: true });
    const fixture = makeFactory({ resolveSessionSink: () => throwing.sink });
    const connection = await connect(fixture);
    await establish(fixture, [NS_A]);
    expect(connection.state).toBe('closed');
    expect(fixture.wire.closes).toEqual([{ code: 1011, reason: 'protocol-error' }]);
    const errors = errorsOf(fixture.wire.outbound);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.code).toBe('INTERNAL_ERROR');
    expect(errors[0]!.namespaceId).toBeUndefined();
  });

  it('OAP-C10a2：已建立会话的 namespaceFrame throw → 同收口路径', async () => {
    const throwing = makeSink({ throwOnFrame: true });
    const fixture = makeFactory({ resolveSessionSink: () => throwing.sink });
    const connection = await connect(fixture);
    await establish(fixture, [NS_A]);
    expect(fixture.wire.closes).toEqual([]);
    fixture.wire.inject(closeFrame(NS_A, 3));
    await settle();
    expect(connection.state).toBe('closed');
    expect(fixture.wire.closes).toEqual([{ code: 1011, reason: 'protocol-error' }]);
    expect(errorsOf(fixture.wire.outbound)).toHaveLength(1);
  });

  it('OAP-C10b：onConnectionClosed reject → close()/settle() 恒 resolve + 零 unhandled rejection', async () => {
    const unhandled = collectUnhandledRejections();
    try {
      const rejecting = makeSink({ rejectOnClose: true });
      const fixture = makeFactory({ resolveSessionSink: () => rejecting.sink });
      const connection = await connect(fixture);
      await establish(fixture, [NS_A, NS_B]);
      connection.close(1001, 'host-close');
      await expect(connection.settle()).resolves.toBeUndefined();
      await settle();
      expect(rejecting.closedCount()).toBe(2); // 两个 established sink 各恰一次通知
      expect(connection.state).toBe('closed');
      expect(unhandled.events).toEqual([]);
    } finally {
      unhandled.dispose();
    }
  });

  it('OAP-C10c：terminateUnauthorized reject → revokeNamespace 恒 resolve；无会话态零副作用', async () => {
    const unhandled = collectUnhandledRejections();
    try {
      const rejecting = makeSink({ rejectOnTerminate: true });
      const fixture = makeFactory({ resolveSessionSink: () => rejecting.sink });
      const connection = await connect(fixture);
      await establish(fixture, [NS_A]);
      await expect(connection.revokeNamespace(NS_A)).resolves.toBeUndefined();
      expect(rejecting.terminated).toEqual(['terminate']);
      await expect(connection.revokeNamespace(NS_UNKNOWN)).resolves.toBeUndefined();
      expect(fixture.wire.closes).toEqual([]);
      expect(unhandled.events).toEqual([]);
    } finally {
      unhandled.dispose();
    }
  });
});

// ═══════════════ OAP-C11：SA4 F1/F2 回归（no-sink 重解析上界 + 结算账目归还） ═══════════════

describe('issue #421 OAP-C11（SA4 F1/F2 回归）：no-sink 重解析上界与结算账目', () => {
  it('OAP-C11a：4 个 in-flight 首开 + no-sink ns 重 OPEN → 恰一帧 CONNECTION_POLICY_VIOLATION + close(1008)', async () => {
    const gate = deferred<NamespaceAuthorization>();
    const fixture = makeFactory({
      // NS_A 授权即时（走 no-sink 终局）；其余 ns 的 authorize 停在闸门后（in-flight 占满上界）
      authorize: (_instanceIdentity, namespaceId) =>
        namespaceId === NS_A ? Promise.resolve(AUTHORIZED) : gate.promise,
      resolveSessionSink: () => undefined,
    });
    const connection = await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    await settle();
    fixture.wire.inject(openFrame(NS_A, 2));
    await settle();
    expect(fixture.wire.closes).toEqual([]); // no-sink 终局：零应答零收口
    expect(fixture.resolveCalls).toHaveLength(1);
    let sequence = 3;
    for (const namespaceId of [NS_B, NS_C, NS_D, NS_E]) {
      fixture.wire.inject(openFrame(namespaceId, sequence)); // 恰满并发上界（负控：不收口）
      sequence += 1;
    }
    await settle();
    expect(fixture.wire.closes).toEqual([]);
    expect(connection.state).toBe('ready');
    fixture.wire.inject(openFrame(NS_A, sequence)); // 第 5 个 in-flight = no-sink 重 OPEN → 超额
    await settle();
    expect(connection.state).toBe('closed');
    expect(fixture.wire.closes).toEqual([{ code: 1008, reason: 'protocol-error' }]);
    const errors = errorsOf(fixture.wire.outbound);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.code).toBe('CONNECTION_POLICY_VIOLATION');
    expect(errors[0]!.namespaceId).toBeUndefined();
    expect(fixture.resolveCalls).toHaveLength(1); // 被拒重 OPEN 不建会话（零新解析调用）
    expect(connection.namespaces.size).toBe(0);
    // 迟归 authorize：已收口连接 → 静默结算（零新 wire，R4b）
    const outboundBefore = fixture.wire.outbound.length;
    gate.resolve(AUTHORIZED);
    await settle();
    expect(fixture.wire.outbound.length).toBe(outboundBefore);
    expect(fixture.resolveCalls).toHaveLength(1);
  });

  it('OAP-C11b：pending 帧预算已满（16 项）+ no-sink ns 重 OPEN → 占位项过预算，同码收口', async () => {
    const gate = deferred<NamespaceAuthorization>();
    const fixture = makeFactory({
      authorize: (_instanceIdentity, namespaceId) =>
        namespaceId === NS_A ? Promise.resolve(AUTHORIZED) : gate.promise,
      resolveSessionSink: () => undefined,
    });
    const connection = await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    await settle();
    fixture.wire.inject(openFrame(NS_A, 2));
    await settle();
    expect(fixture.wire.closes).toEqual([]); // 结算已归还预算（no-sink 的 1 项占位已释放）
    let sequence = 3;
    fixture.wire.inject(openFrame(NS_B, sequence)); // NS_B 首开（authorize 在途）：预算项 1（占位）
    sequence += 1;
    await settle();
    for (let index = 0; index < MAX_PENDING_FRAMES_PER_CONNECTION - 1; index += 1) {
      fixture.wire.inject(closeFrame(NS_B, sequence)); // 预算项 2..16：恰满（负控）
      sequence += 1;
    }
    await settle();
    expect(fixture.wire.closes).toEqual([]);
    expect(connection.state).toBe('ready');
    fixture.wire.inject(openFrame(NS_A, sequence)); // 第 17 项（重 OPEN 占位）→ 溢出收口
    await settle();
    expect(connection.state).toBe('closed');
    expect(fixture.wire.closes).toEqual([{ code: 1008, reason: 'protocol-error' }]);
    const errors = errorsOf(fixture.wire.outbound);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.code).toBe('CONNECTION_POLICY_VIOLATION');
    expect(errors[0]!.namespaceId).toBeUndefined();
    expect(fixture.resolveCalls).toHaveLength(1); // 被拒重 OPEN 不建会话
    expect(connection.namespaces.size).toBe(0);
  });

  it('OAP-C11c：上界内重解析照常成立（3 in-flight + no-sink 重 OPEN = 第 4 个，负控）', async () => {
    const authorizeGate = deferred<NamespaceAuthorization>();
    const sinkGate = deferred<HubNamespaceSessionSink | undefined>();
    const reSink = makeSink();
    let resolvesForA = 0;
    const fixture = makeFactory({
      authorize: (_instanceIdentity, namespaceId) =>
        namespaceId === NS_A ? Promise.resolve(AUTHORIZED) : authorizeGate.promise,
      resolveSessionSink: (_connectionKey, namespaceId) => {
        if (namespaceId !== NS_A) return sinkGate.promise;
        resolvesForA += 1;
        return resolvesForA === 1 ? undefined : reSink.sink; // 首解析 no-sink，重解析建会话
      },
    });
    const connection = await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    await settle();
    fixture.wire.inject(openFrame(NS_A, 2));
    await settle();
    let sequence = 3;
    for (const namespaceId of [NS_B, NS_C, NS_D]) {
      fixture.wire.inject(openFrame(namespaceId, sequence));
      sequence += 1;
    }
    await settle();
    fixture.wire.inject(openFrame(NS_A, sequence)); // 第 4 个 in-flight（≤ 上界）→ 允许
    await settle();
    expect(fixture.wire.closes).toEqual([]);
    expect(connection.namespaces).toEqual(new Set([NS_A])); // 重解析成功建会话
    expect(reSink.opens).toEqual([NS_A]);
    expect(fixture.resolveCalls.filter((call) => call.namespaceId === NS_A)).toHaveLength(2);
    expect(fixture.authorizeCalls.filter((call) => call.namespaceId === NS_A)).toHaveLength(1); // grant 复用
    // 收尾：迟归 authorize/解析在收口前结算（no-sink 终局），连接存活
    authorizeGate.resolve(AUTHORIZED);
    await settle();
    sinkGate.resolve(undefined);
    await settle();
    expect(fixture.wire.closes).toEqual([]);
    expect(connection.state).toBe('ready');
  });

  it('OAP-C11d：循环 no-sink 结算 >16 次后帧预算归还（新 ns 窗口满额可用；第 17 项仍响亮收口）', async () => {
    const sinkGate = deferred<HubNamespaceSessionSink | undefined>();
    const fixture = makeFactory({
      authorize: () => Promise.resolve(AUTHORIZED),
      resolveSessionSink: (_connectionKey, namespaceId) =>
        namespaceId === NS_A ? undefined : sinkGate.promise,
    });
    const connection = await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    await settle();
    let sequence = 2;
    const cycles = MAX_PENDING_FRAMES_PER_CONNECTION + 1; // 17 次「重 OPEN → undefined」
    for (let index = 0; index < cycles; index += 1) {
      fixture.wire.inject(openFrame(NS_A, sequence)); // 每轮 1 项占位（结算时必须归还预算）
      sequence += 1;
      await settle();
    }
    expect(fixture.resolveCalls).toHaveLength(cycles); // 首开 1 + 重解析 16
    expect(fixture.authorizeCalls).toHaveLength(1); // grant 复用（authorize 不重复）
    expect(fixture.wire.closes).toEqual([]); // 预算未泄漏：零虚假 policy 收口
    expect(connection.state).toBe('ready');
    // 新 ns 的 pending 窗口满额可用：1 占位 + 15 帧 = 16 项，零收口
    fixture.wire.inject(openFrame(NS_B, sequence));
    sequence += 1;
    await settle();
    for (let index = 0; index < MAX_PENDING_FRAMES_PER_CONNECTION - 1; index += 1) {
      fixture.wire.inject(closeFrame(NS_B, sequence));
      sequence += 1;
    }
    await settle();
    expect(fixture.wire.closes).toEqual([]);
    expect(connection.state).toBe('ready');
    // 第 17 项 → 上界仍然有界（恰溢出时响亮收口，未被修复禁用）
    fixture.wire.inject(closeFrame(NS_B, sequence));
    await settle();
    expect(connection.state).toBe('closed');
    expect(fixture.wire.closes).toEqual([{ code: 1008, reason: 'protocol-error' }]);
    const errors = errorsOf(fixture.wire.outbound);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.code).toBe('CONNECTION_POLICY_VIOLATION');
    // 迟归解析：已收口连接 → 零投递零新 wire
    const outboundBefore = fixture.wire.outbound.length;
    sinkGate.resolve(undefined);
    await settle();
    expect(fixture.wire.outbound.length).toBe(outboundBefore);
    expect(connection.namespaces.size).toBe(0);
  });
});
