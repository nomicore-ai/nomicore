/**
 * SA6 验收契约 — issue #421（spec #415 T4）：**edge 公共工厂的生命周期观测**（AC6）。
 *
 * 覆盖条目（契约 `wiki/raw/task_issue-421_sa6_contract.md` §12.6 LC-C1..C4）：
 *   LC-C1 `beginReauth()` → GOAWAY{REAUTH_REQUIRED, drainTimeoutMs>0} + 状态 `'draining'` +
 *         deadline 到 → `close(1001,'hub-reauth')` + 幂等（重复调用零附加帧）；负控：handshaking
 *         态 reauth 不发明 GOAWAY、直接 `close(1001)`；
 *   LC-C2 settled 信号驱动 drain 提前完成：全部已解析会话终态齐备 → 立即 1001 且 deadline 已清；
 *         任一未终态（authorize 在途 / 宿主解析在途）→ 不提前、deadline 仍武装；空会话集 → 等 deadline；
 *   LC-C3 drain 门：窗口内 OPEN 不建立会话、零宿主回调；非窗口零行为变化；
 *   LC-C4 liveness：ping/onPong 面齐备 → ping timer 武装 + 8 字节凭据；凭据逐字节匹配的 pong 清
 *         pong 超时；不匹配/迟到 → 超时保留 → `close(1001,'pong-timeout')`；两面缺省 → dormant。
 *
 * 纪律：断言 = 运行时行为（wire 帧字节/close code+reason/注入 timer 句柄/宿主回调计数）；
 * 零源码 grep 断言；零 skip/only/todo；零 mock 被测对象（stub 只在宿主缝另一侧）。
 * 本文件自带**记录型 duplex**（含可选 ping/onPong 面）——内存双工 fixture 不暴露 WS 活性面。
 */
import { describe, expect, it } from 'vitest';
import { decodeMessage, encodeMessage } from '@nomicore/replication-protocol';
import { createHubReplicationEdge } from '@nomicore/ws-replication';
import type {
  DuplexTransport,
  HubNamespaceSessionSink,
  HubReplicationEdgeConnection,
  HubReplicationEdgeFactory,
  HubReplicationEdgeOptions,
  HubSessionSinkResolver,
  NamespaceAuthorization,
  ReplicationTimer,
} from '@nomicore/ws-replication';
import { settle } from './harness.js';

// ═══════════════════════════ 局部 fixture ═══════════════════════════

const HUB_INSTANCE = 'hub-omega';
const PEER_INSTANCE = 'peer-alpha';
const NS_A = `ns-${'0'.repeat(31)}1`;
const NS_B = `ns-${'0'.repeat(31)}2`;
const NS_UNKNOWN = `ns-${'a'.repeat(32)}`;
const HELLO_NONCE = new Uint8Array(16).fill(0x80);
const PING_INTERVAL_MS = 30_000;
const PONG_TIMEOUT_MS = 10_000;
const CLOSE_TIMEOUT_MS = 5_000;

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
  readonly pingCount: () => number;
  readonly lastPing: () => Uint8Array | undefined;
  emitPong(payload?: Uint8Array): void;
}

/** 记录型 duplex（交给工厂的端）：出站记录 / 入站注入 / close 记录；可选 WS 活性面。 */
function makeWire(options: { readonly liveness?: boolean } = {}): Wire {
  const messageListeners = new Set<(bytes: Uint8Array) => void>();
  const closeListeners = new Set<(info: Readonly<{ code: number; reason: string }>) => void>();
  const pongListeners = new Set<(payload?: Uint8Array) => void>();
  const outbound: Uint8Array[] = [];
  const closes: Array<Readonly<{ code: number; reason: string }>> = [];
  let closed = false;
  let pings = 0;
  let lastPing: Uint8Array | undefined;
  const end = {
    send: (bytes: Uint8Array) => {
      if (closed) return;
      outbound.push(bytes.slice());
    },
    close: (code = 1000, reason = '') => {
      if (closed) return;
      closed = true;
      closes.push({ code, reason });
      for (const listener of [...closeListeners]) listener({ code, reason });
    },
    get closed() {
      return closed;
    },
    onMessage: (listener: (bytes: Uint8Array) => void) => {
      messageListeners.add(listener);
      return () => messageListeners.delete(listener);
    },
    onClose: (listener: (info: Readonly<{ code: number; reason: string }>) => void) => {
      closeListeners.add(listener);
      return () => closeListeners.delete(listener);
    },
    ...(options.liveness === true
      ? {
          ping: (data?: Uint8Array) => {
            pings += 1;
            lastPing = data === undefined ? undefined : data.slice();
          },
          onPong: (listener: (payload?: Uint8Array) => void) => {
            pongListeners.add(listener);
            return () => pongListeners.delete(listener);
          },
        }
      : {}),
  } as DuplexTransport;
  return {
    hubEnd: end,
    outbound,
    closes,
    closed: () => closed,
    inject: (bytes) => {
      const copy = bytes.slice();
      queueMicrotask(() => {
        for (const listener of [...messageListeners]) listener(copy);
      });
    },
    pingCount: () => pings,
    lastPing: () => lastPing,
    emitPong: (payload?: Uint8Array) => {
      for (const listener of [...pongListeners]) listener(payload);
    },
  };
}

interface SinkHarness {
  readonly sink: HubNamespaceSessionSink;
  readonly opens: string[];
  readonly frames: Array<Readonly<{ kind: string; namespaceId: string | undefined; sequence: number }>>;
}

function makeSink(): SinkHarness {
  const opens: string[] = [];
  const frames: SinkHarness['frames'] = [];
  return {
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
    opens,
    frames,
  };
}

interface FactoryOverrides {
  readonly authorize?: (instanceIdentity: string, namespaceId: string) => Promise<NamespaceAuthorization>;
  readonly resolveSessionSink?: HubSessionSinkResolver;
  readonly liveness?: boolean;
}

interface FactoryHarness {
  readonly factory: HubReplicationEdgeFactory;
  readonly wire: Wire;
  readonly timer: FakeTimer;
  readonly authorizeCalls: string[];
  readonly resolveCalls: string[];
  readonly sinks: Map<string, SinkHarness>;
  sinkOf(namespaceId: string): SinkHarness;
}

function makeFactory(overrides: FactoryOverrides = {}): FactoryHarness {
  const wire = makeWire({ ...(overrides.liveness === undefined ? {} : { liveness: overrides.liveness }) });
  const timer = makeFakeTimer();
  const authorizeCalls: string[] = [];
  const resolveCalls: string[] = [];
  const sinks = new Map<string, SinkHarness>();
  const options: HubReplicationEdgeOptions = {
    instanceId: HUB_INSTANCE,
    timer: timer.timer,
    timeouts: { pingIntervalMs: PING_INTERVAL_MS, pongTimeoutMs: PONG_TIMEOUT_MS },
    authorize: (instanceIdentity, namespaceId) => {
      authorizeCalls.push(namespaceId);
      return overrides.authorize === undefined
        ? Promise.resolve(AUTHORIZED)
        : overrides.authorize(instanceIdentity, namespaceId);
    },
    resolveSessionSink: (connectionKey, namespaceId, authorization) => {
      resolveCalls.push(namespaceId);
      if (overrides.resolveSessionSink !== undefined) {
        return overrides.resolveSessionSink(connectionKey, namespaceId, authorization);
      }
      const harness = makeSink();
      sinks.set(namespaceId, harness);
      return harness.sink;
    },
  };
  return {
    factory: createHubReplicationEdge(options),
    wire,
    timer,
    authorizeCalls,
    resolveCalls,
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

function kindOf(bytes: Uint8Array): string {
  return decodeMessage(bytes).message.kind;
}

function goawayOf(bytes: Uint8Array): Extract<ReturnType<typeof decodeMessage>['message'], { kind: 'GOAWAY' }> {
  const decoded = decodeMessage(bytes).message;
  if (decoded.kind !== 'GOAWAY') throw new Error(`期望 GOAWAY 帧，实际 ${decoded.kind}`);
  return decoded;
}

// ═══════════════════════════ LC-C1：GOAWAY / deadline / 幂等 ═══════════════════════════

describe('issue #421 LC-C1：beginReauth → GOAWAY + draining + deadline 1001 + 幂等', () => {
  it('LC-C1a：ready 后 beginReauth → GOAWAY{REAUTH_REQUIRED, drain>0} + draining + deadline 1001', async () => {
    const fixture = makeFactory();
    const connection = await connect(fixture);
    await establish(fixture, [NS_A]);
    connection.beginReauth();
    expect(connection.state).toBe('draining');
    const goaway = goawayOf(fixture.wire.outbound[1]!);
    expect(goaway).toMatchObject({
      reasonCode: 'REAUTH_REQUIRED',
      drainTimeoutMs: CLOSE_TIMEOUT_MS,
    });
    expect(goaway.drainTimeoutMs).toBeGreaterThan(0);
    expect(fixture.timer.pendingDelays()).toContain(CLOSE_TIMEOUT_MS);
    fixture.timer.fireNext(CLOSE_TIMEOUT_MS);
    await settle();
    expect(fixture.wire.closes).toEqual([{ code: 1001, reason: 'hub-reauth' }]);
    expect(connection.state).toBe('closed');
  });

  it('LC-C1b：重复 beginReauth 幂等（零附加帧/零附加 close）', async () => {
    const fixture = makeFactory();
    const connection = await connect(fixture);
    await establish(fixture, [NS_A]);
    connection.beginReauth();
    await settle();
    const framesAfterFirst = fixture.wire.outbound.length;
    connection.beginReauth();
    connection.beginReauth();
    await settle();
    expect(fixture.wire.outbound.length).toBe(framesAfterFirst);
    expect(fixture.wire.closes).toEqual([]);
    expect(connection.state).toBe('draining');
  });

  it('LC-C1c：handshaking 态 reauth → 不发明 GOAWAY，直接 close(1001)', async () => {
    const fixture = makeFactory();
    const connection = await connect(fixture);
    connection.beginReauth();
    await settle();
    expect(fixture.wire.outbound).toEqual([]); // 零 GOAWAY（GOAWAY-before-ACK 是协议伤害）
    expect(fixture.wire.closes).toEqual([{ code: 1001, reason: 'hub-reauth' }]);
    expect(connection.state).toBe('closed');
  });
});

// ═══════════════════════════ LC-C2：settled 信号驱动 drain 提前完成 ═══════════════════════════

describe('issue #421 LC-C2：settled 信号驱动 drain 提前完成（deadline 兜底）', () => {
  it('LC-C2a：全部已解析会话终态齐备 → 立即 1001 且 deadline 已清（未 fire）', async () => {
    const fixture = makeFactory();
    const connection = await connect(fixture);
    await establish(fixture, [NS_A, NS_B]);
    connection.beginReauth();
    await settle();
    expect(fixture.timer.pendingDelays()).toContain(CLOSE_TIMEOUT_MS);
    connection.egress.namespaceSettled(NS_A);
    await settle();
    expect(fixture.wire.closes).toEqual([]); // 部分 settled → 不提前
    expect(fixture.timer.pendingDelays()).toContain(CLOSE_TIMEOUT_MS);
    connection.egress.namespaceSettled(NS_B);
    await settle();
    expect(fixture.wire.closes).toEqual([{ code: 1001, reason: 'hub-reauth' }]);
    expect(fixture.timer.pendingDelays()).not.toContain(CLOSE_TIMEOUT_MS); // deadline 已清
    expect(connection.state).toBe('closed');
  });

  it('LC-C2b：authorize 在途（未终态）→ 不提前收口，deadline 仍武装', async () => {
    const gate = deferred<NamespaceAuthorization>();
    const fixture = makeFactory({ authorize: () => gate.promise });
    const connection = await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    fixture.wire.inject(openFrame(NS_A, 2));
    await settle();
    connection.beginReauth();
    await settle();
    expect(fixture.wire.closes).toEqual([]);
    expect(fixture.timer.pendingDelays()).toContain(CLOSE_TIMEOUT_MS);
    // 延迟结算仍不提前：宿主解析在途窗口同样阻塞（settled 通知缺席）
    gate.resolve(AUTHORIZED);
    await settle();
    expect(fixture.wire.closes).toEqual([]);
    expect(connection.state).toBe('draining');
    fixture.timer.fireNext(CLOSE_TIMEOUT_MS);
    await settle();
    expect(fixture.wire.closes).toEqual([{ code: 1001, reason: 'hub-reauth' }]);
  });

  it('LC-C2c：空会话集 → 等 deadline（既有语义）', async () => {
    const fixture = makeFactory();
    const connection = await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    await settle();
    connection.beginReauth();
    await settle();
    expect(fixture.wire.closes).toEqual([]);
    fixture.timer.fireNext(CLOSE_TIMEOUT_MS);
    await settle();
    expect(fixture.wire.closes).toEqual([{ code: 1001, reason: 'hub-reauth' }]);
  });

  it('LC-C2d：连接已收口后的迟归结算零事件面（R4b 观测等价）', async () => {
    const gate = deferred<NamespaceAuthorization>();
    const fixture = makeFactory({ authorize: () => gate.promise });
    const connection = await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    fixture.wire.inject(openFrame(NS_A, 2));
    await settle();
    connection.egress.connectionFatal('MALFORMED_FRAME', 1002);
    await settle();
    expect(connection.state).toBe('closed');
    const framesAfterFatal = fixture.wire.outbound.length;
    connection.egress.namespaceSettled(NS_A);
    gate.resolve(AUTHORIZED);
    await settle();
    expect(fixture.wire.outbound.length).toBe(framesAfterFatal); // 零新 wire
    expect(fixture.resolveCalls).toEqual([]); // 迟归终局不建会话
  });
});

// ═══════════════════════════ LC-C3：drain 门 ═══════════════════════════

describe('issue #421 LC-C3：drain 门（窗口内 OPEN 零会话；非窗口零变化）', () => {
  it('LC-C3a：drain 窗口 OPEN 不建立会话、零宿主回调', async () => {
    const fixture = makeFactory();
    const connection = await connect(fixture);
    await establish(fixture, [NS_A]);
    const resolveCallsBefore = fixture.resolveCalls.length;
    connection.beginReauth();
    await settle();
    fixture.wire.inject(openFrame(NS_UNKNOWN, 3));
    await settle();
    expect(fixture.authorizeCalls).toEqual([NS_A]);
    expect(fixture.resolveCalls).toHaveLength(resolveCallsBefore);
    expect(connection.namespaces).toEqual(new Set([NS_A]));
  });

  it('LC-C3b：非 drain 窗口零行为变化（OPEN 正常建立会话）', async () => {
    const fixture = makeFactory();
    const connection = await connect(fixture);
    await establish(fixture, [NS_A]);
    expect(connection.namespaces).toEqual(new Set([NS_A]));
    expect(fixture.resolveCalls).toEqual([NS_A]);
  });
});

// ═══════════════════════════ LC-C4：liveness ═══════════════════════════

describe('issue #421 LC-C4：liveness（ping 武装 / 凭据匹配清超时 / 缺面 dormant）', () => {
  it('LC-C4a：ping timer 武装 + 8 字节凭据 + 凭据逐字节匹配的 pong 清超时', async () => {
    const fixture = makeFactory({ liveness: true });
    const connection = await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    await settle();
    expect(connection.state).toBe('ready');
    expect(fixture.timer.pendingDelays()).toContain(PING_INTERVAL_MS);
    fixture.timer.fireNext(PING_INTERVAL_MS);
    await settle();
    expect(fixture.wire.pingCount()).toBe(1);
    const credential = fixture.wire.lastPing();
    expect(credential).toBeDefined();
    expect(credential!.byteLength).toBe(8);
    expect(fixture.timer.pendingDelays()).toContain(PONG_TIMEOUT_MS);
    fixture.wire.emitPong(credential);
    await settle();
    expect(fixture.timer.pendingDelays()).not.toContain(PONG_TIMEOUT_MS); // 匹配 → 清超时
    expect(fixture.wire.closes).toEqual([]);
    expect(connection.state).toBe('ready');
  });

  it('LC-C4b：不匹配 / 迟到 / 空载荷 pong → 超时保留 → close(1001,pong-timeout)', async () => {
    const fixture = makeFactory({ liveness: true });
    const connection = await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    await settle();
    fixture.timer.fireNext(PING_INTERVAL_MS);
    await settle();
    fixture.wire.emitPong(new Uint8Array(8).fill(0)); // 凭据不匹配
    fixture.wire.emitPong(); // 空载荷（迟到）
    await settle();
    expect(fixture.timer.pendingDelays()).toContain(PONG_TIMEOUT_MS);
    expect(fixture.wire.closes).toEqual([]);
    fixture.timer.fireNext(PONG_TIMEOUT_MS);
    await settle();
    expect(fixture.wire.closes).toEqual([{ code: 1001, reason: 'pong-timeout' }]);
    expect(connection.state).toBe('closed');
  });

  it('LC-C4c：ping/onPong 面缺省 → dormant（零 ping timer）', async () => {
    const fixture = makeFactory();
    const connection = await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    await settle();
    expect(connection.state).toBe('ready');
    expect(fixture.timer.pendingDelays()).not.toContain(PING_INTERVAL_MS);
    expect(fixture.wire.pingCount()).toBe(0);
    // dormant 下唯一武装的是 hello timer 之外的零 timer：连接保持 ready
    expect(fixture.wire.closes).toEqual([]);
    expect(kindOf(fixture.wire.outbound[0]!)).toBe('HELLO_ACK');
  });
});
