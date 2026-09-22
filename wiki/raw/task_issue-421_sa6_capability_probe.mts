/**
 * SA6 最小复现 / 诊断探针 — issue #421（spec #415 T4）：
 * 「Edge 公共工厂：accept 双入口 + OPEN 准入管线 + sequence 盖章」。
 *
 * 这是**诊断与验收契约的可执行证据**，不是 issue #421 的交付实现（交付测试见契约报告
 * §12：`packages/ws-replication/test/ws-replication-issue421-*.test.ts` 与
 * `...-api.test-d.ts`，由设计/实现票落地）。
 *
 * 运行（真实源码；期望 §全部 GAP 成立 + ORACLE/NC 全绿）：
 *   NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx \
 *     wiki/raw/task_issue-421_sa6_capability_probe.mts
 *
 * 变异运行（SA6_EDGE_SRC / SA6_FRAME_IO_SRC 指向被变异副本；见 mutation driver）：
 *   SA6_EDGE_SRC=file:///abs/mutant/hub-edge.ts \
 *   SA6_FRAME_IO_SRC=file:///abs/mutant/frame-io.ts \
 *     NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx \
 *     wiki/raw/task_issue-421_sa6_capability_probe.mts
 *
 * 断言面 = 运行时行为：出站**帧原字节**（含 envelope `[8..12]` sequence）、transport close
 * code/reason、缝另一侧 stub sink 的到达序列（openNamespace / namespaceFrame / settled 信号）。
 * 零源码字符串/正则断言、零 skip/only/env fallback、零 mock 被测对象（stub 只在缝的另一侧）。
 *
 * 检查 id 与契约条目对应（见 §12）：
 *   G1 公共入口未导出 `createHubReplicationEdge`（AC1 能力缺口）
 *   G2 连接级半边工厂无 `accept`/`acceptTrusted` 双入口（AC1/AC2 能力缺口）
 *   G3 无宿主回调 `resolveSessionSink(connectionKey, namespaceId, authorization)`（AC2 能力缺口）
 *   G4 未授权 OPEN 直达 session 半边（「未授权 OPEN 不过缝」不可表达；AC2 能力缺口）
 *   G5 无 pending 有界缓冲/序保冲刷（sink 未解析期帧即刻投递；AC2 能力缺口）
 *   G6 无并发 OPEN 上界收口（AC2 能力缺口）
 *   G7 sink 解析失败无响亮连接收口（INTERNAL_ERROR + 1011 在 wire 上不可达；AC2 能力缺口）
 *   O1 路由键违例 → MALFORMED_FRAME fatal 1002，零投递（AC3）
 *   O1b 同输入序列下内部 edge 与单体出站帧逐字节一致（违例案；AC5 对比方法）
 *   O2 合法无 sink 帧 → 合成 NAMESPACE_STATE_VIOLATION，连接存活（AC3）
 *   O2b 同输入序列下单体的无 sink 违例帧逐字节一致（AC3/AC5）
 *   O3 连接级 ERROR 不路由（零投递、零出站、连接存活；AC4）
 *   O4 namespace 级 ERROR 路由到该 ns 的 session（AC4）
 *   O5 出站盖章 per-connection 严格递增（多 ns 交织 mux；AC1）＋帧字节 == 占位帧 `[8..12]` 重写
 *   O5b 同输入序列下内部 edge 与单体出站帧逐字节一致（HELLO_ACK/ERROR 案；AC5）
 *   O6 reauth GOAWAY + settled 信号驱动 drain 提前完成；drain 门丢弃新 OPEN（AC6）
 *   O7 decode 门：非 HELLO 先行 → HELLO_REQUIRED 1002；坏 magic → MALFORMED_FRAME 1002；
 *      sequence gap → SEQUENCE_VIOLATION 1002（AC2「全解码」）
 *   O8 liveness：ping 武装 + 凭据匹配 pong 清超时 / 不匹配 pong → pong 超时 1001（AC6）
 *   NC1 相近负控：已建立 ns 的合法帧必须投递且连接存活（对照 O2 的「无 sink」分支）
 *   NC2 相近负控：另一条连接的首个出站 sequence 独立从 1 开始（对照 O5 的 per-connection 语义）
 *   NC3 相近负控：未知 ns 的 namespace 级 ERROR 静默丢弃（对照 O3/O4 的路由两分支）
 *   NC4 相近负控：ns A 已建立时，ns B 的帧不得投递（路由键/账本不外溢）
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

// ═══════════════════════════ 载入面（相对源码路径 = 与包 exports 条件同源） ═══════════════════════════

const PKG_DIR = new URL('../../packages/ws-replication/', import.meta.url);
const wsPkgJson = JSON.parse(
  readFileSync(new URL('package.json', PKG_DIR), 'utf8'),
) as { exports?: Record<string, Record<string, string> | string> };

/** 公共入口 = packages/ws-replication/package.json exports['.'] 的 nomicore-source 条件目标。 */
function resolvePublicEntry(): string {
  const entry = wsPkgJson.exports?.['.'];
  assert.ok(entry !== undefined, 'package.json exports["."] 缺失');
  const target = typeof entry === 'string' ? entry : entry['nomicore-source'] ?? entry['import'] ?? entry['default'];
  assert.ok(typeof target === 'string', 'package.json exports["."] 目标不可解析');
  return new URL(target, PKG_DIR).href;
}

const PUBLIC_ENTRY_URL = resolvePublicEntry();
const EDGE_SRC = process.env.SA6_EDGE_SRC ?? new URL('src/hub-edge.ts', PKG_DIR).href;
const FRAME_IO_SRC = process.env.SA6_FRAME_IO_SRC ?? new URL('src/frame-io.ts', PKG_DIR).href;
const DECODE_SRC = new URL('src/frame-io.ts', PKG_DIR).href; // decodeInbound 单点（未变异引用）

const protocol = (await import(new URL('../../packages/replication-protocol/src/index.ts', import.meta.url).href)) as typeof import('../../packages/replication-protocol/src/index.ts');
const defaults = (await import(new URL('src/defaults.ts', PKG_DIR).href)) as typeof import('../../packages/ws-replication/src/defaults.ts');
const publicEntry = (await import(PUBLIC_ENTRY_URL)) as Record<string, unknown>;
const edgeModule = (await import(EDGE_SRC)) as typeof import('../../packages/ws-replication/src/hub-edge.ts');
const frameIo = (await import(FRAME_IO_SRC)) as typeof import('../../packages/ws-replication/src/frame-io.ts');
const stableCodec = (await import(DECODE_SRC)) as typeof import('../../packages/ws-replication/src/frame-io.ts');

const { decodeMessage, encodeMessage } = protocol;
const { resolveLimits, resolveTimeouts } = defaults;
const { createHubReplicationEdge } = edgeModule;

// ═══════════════════════════ 常量（协议 §1/§6.1 文法） ═══════════════════════════

const HUB_INSTANCE = 'hub-omega';
const PEER_INSTANCE = 'peer-alpha';
const NS_A = `ns-${'0'.repeat(31)}1`;
const NS_B = `ns-${'0'.repeat(31)}2`;
const NS_UNKNOWN = `ns-${'a'.repeat(32)}`;
const HELLO_NONCE = new Uint8Array(16).fill(0x80);
const LIMITS = resolveLimits(undefined);
const TIMEOUTS = resolveTimeouts(undefined);
const AUTHORIZED = {
  ok: true as const,
  localOwner: { userId: 'hub-owner-9fac' },
  permissions: { read: true, submit: true },
};

// ═══════════════════════════ 工具 ═══════════════════════════

function hexOf(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

function rawSequence(bytes: Uint8Array): number {
  return (((bytes[8]! << 24) | (bytes[9]! << 16) | (bytes[10]! << 8) | bytes[11]!) >>> 0);
}

async function settle(rounds = 6): Promise<void> {
  for (let i = 0; i < rounds; i += 1) await Promise.resolve();
}

interface RecordedTransport {
  readonly end: import('../../packages/ws-replication/src/types.ts').DuplexTransport;
  frames(): readonly Uint8Array[];
  send(bytes: Uint8Array): void;
  closeInfo(): Readonly<{ code: number; reason: string }> | undefined;
  closed(): boolean;
  pingCount(): number;
  lastPing(): Uint8Array | undefined;
  emitPong(payload?: Uint8Array): void;
}

/** 记录型 duplex（交给 edge 的端）：出站记录、入站脚本注入、close 记录；可选 ping/onPong 面。 */
function makeTransport(withLiveness = false): RecordedTransport {
  const messageListeners = new Set<(bytes: Uint8Array) => void>();
  const closeListeners = new Set<(info: Readonly<{ code: number; reason: string }>) => void>();
  const pongListeners = new Set<(payload?: Uint8Array) => void>();
  const frames: Uint8Array[] = [];
  let closed = false;
  let closeInfo: Readonly<{ code: number; reason: string }> | undefined;
  let pings = 0;
  let lastPing: Uint8Array | undefined;
  const end = {
    send(bytes: Uint8Array) {
      if (closed) return;
      frames.push(bytes.slice());
    },
    close(code = 1000, reason = '') {
      if (closed) return;
      closed = true;
      closeInfo = { code, reason };
      for (const listener of [...closeListeners]) listener(closeInfo);
    },
    get closed() {
      return closed;
    },
    onMessage(listener: (bytes: Uint8Array) => void) {
      messageListeners.add(listener);
      return () => messageListeners.delete(listener);
    },
    onClose(listener: (info: Readonly<{ code: number; reason: string }>) => void) {
      closeListeners.add(listener);
      return () => closeListeners.delete(listener);
    },
    ...(withLiveness
      ? {
          ping(data?: Uint8Array) {
            pings += 1;
            lastPing = data === undefined ? undefined : data.slice();
          },
          onPong(listener: (payload?: Uint8Array) => void) {
            pongListeners.add(listener);
            return () => pongListeners.delete(listener);
          },
        }
      : {}),
  } as import('../../packages/ws-replication/src/types.ts').DuplexTransport;
  return {
    end,
    frames: () => frames,
    send(bytes: Uint8Array) {
      const copy = bytes.slice();
      queueMicrotask(() => {
        for (const listener of [...messageListeners]) listener(copy);
      });
    },
    closeInfo: () => closeInfo,
    closed: () => closed,
    pingCount: () => pings,
    lastPing: () => lastPing,
    emitPong(payload?: Uint8Array) {
      for (const listener of [...pongListeners]) listener(payload);
    },
  };
}

interface FakeTimer {
  readonly timer: import('../../packages/ws-replication/src/types.ts').ReplicationTimer;
  pendingDelays(): number[];
  size(): number;
  /** 触发「最早武装」的 timer（FIFO），返回其 delayMs。 */
  fireNext(onlyDelayMs?: number): number;
}

function makeFakeTimer(): FakeTimer {
  let counter = 0;
  const pending = new Map<number, { cb: () => void; delayMs: number }>();
  return {
    timer: {
      setTimeout(cb: () => void, delayMs: number) {
        counter += 1;
        pending.set(counter, { cb, delayMs });
        return counter;
      },
      clearTimeout(handle: unknown) {
        pending.delete(handle as number);
      },
    },
    pendingDelays: () => [...pending.values()].map((entry) => entry.delayMs),
    size: () => pending.size,
    fireNext(onlyDelayMs?: number) {
      for (const [handle, entry] of pending) {
        if (onlyDelayMs !== undefined && entry.delayMs !== onlyDelayMs) continue;
        pending.delete(handle);
        entry.cb();
        return entry.delayMs;
      }
      throw new Error(`no pending timer${onlyDelayMs === undefined ? '' : ` with delay ${onlyDelayMs}`}`);
    },
  };
}

interface ScriptedSink {
  readonly sink: import('../../packages/ws-replication/src/hub-split.ts').HubSessionSink;
  readonly opens: string[];
  readonly frames: Array<{ namespaceId: string | undefined; kind: string; sequence: number }>;
  readonly pulls: Array<{ namespaceId: string; outcome: string }>;
  readonly channels: Map<string, unknown>;
  readonly port: import('../../packages/ws-replication/src/hub-split.ts').HubSessionEdgePort;
  closes(): number;
  /** 会话终态信号（settled）——drain 提前完成观测输入。 */
  settled(namespaceId: string): void;
}

/** 缝另一侧 stub session sink（记录到达序列 + 可脚本化出站占位帧 + settled 信号）。 */
function makeScriptedSink(
  port: import('../../packages/ws-replication/src/hub-split.ts').HubSessionEdgePort,
  opts: { respondOpenOk?: boolean } = {},
): ScriptedSink {
  const opens: string[] = [];
  const frames: Array<{ namespaceId: string | undefined; kind: string; sequence: number }> = [];
  const pulls: Array<{ namespaceId: string; outcome: string }> = [];
  const channels = new Map<string, unknown>();
  let closeCount = 0;
  const sink = {
    openNamespace(message: { namespaceId: string }) {
      opens.push(message.namespaceId);
      channels.set(message.namespaceId, { namespaceId: message.namespaceId });
      void port.openAdmission(message.namespaceId).then(
        (admission) => {
          pulls.push({ namespaceId: message.namespaceId, outcome: admission.outcome });
          if (opts.respondOpenOk === true && admission.outcome === 'authorized') {
            port.sendControlFrame(
              encodeMessage(openOkFrame(message.namespaceId), { sequence: 0 }),
            );
          }
        },
        () => pulls.push({ namespaceId: message.namespaceId, outcome: 'reject' }),
      );
    },
    namespaceFrame(message: { kind: string; namespaceId?: string }, sequence: number) {
      frames.push({ namespaceId: message.namespaceId, kind: message.kind, sequence });
    },
    async close() {
      closeCount += 1;
    },
    async terminateNamespace(namespaceId: string) {
      if (channels.has(namespaceId)) frames.push({ namespaceId, kind: 'TERMINATE', sequence: 0 });
    },
    dataFacetOf() {
      return undefined;
    },
    channels,
  } as unknown as import('../../packages/ws-replication/src/hub-split.ts').HubSessionSink;
  return {
    sink,
    opens,
    frames,
    pulls,
    channels,
    port,
    closes: () => closeCount,
    settled(namespaceId: string) {
      port.onChannelSettled(namespaceId);
    },
  };
}

function openOkFrame(namespaceId: string): import('@nomicore/replication-protocol').ReplicationMessage {
  return {
    kind: 'OPEN_OK',
    namespaceId,
    mode: 0,
    replicationId: `${'0'.repeat(31)}2`,
    replicationEpoch: 1,
  } as import('@nomicore/replication-protocol').ReplicationMessage;
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
    } as import('@nomicore/replication-protocol').ReplicationMessage,
    { sequence },
  );
}

function openFrame(namespaceId: string, sequence: number): Uint8Array {
  return encodeMessage(
    { kind: 'OPEN_NAMESPACE', namespaceId, hasLocalReplica: false } as import('@nomicore/replication-protocol').ReplicationMessage,
    { sequence },
  );
}

function closeFrame(namespaceId: string, sequence: number): Uint8Array {
  return encodeMessage(
    { kind: 'CLOSE_NAMESPACE', namespaceId, reasonCode: 'peer-close' } as import('@nomicore/replication-protocol').ReplicationMessage,
    { sequence },
  );
}

function namespaceErrorFrame(
  code: string,
  namespaceId: string,
  sequence: number,
): Uint8Array {
  return encodeMessage(
    {
      kind: 'ERROR',
      code,
      namespaceId,
      safeMessage: 'protocol error: test',
    } as unknown as import('@nomicore/replication-protocol').ReplicationMessage,
    { sequence },
  );
}

function connectionErrorFrame(code: string, sequence: number): Uint8Array {
  return encodeMessage(
    {
      kind: 'ERROR',
      code,
      safeMessage: 'protocol error: test',
    } as unknown as import('@nomicore/replication-protocol').ReplicationMessage,
    { sequence },
  );
}

/** 路由键违例帧：合法编码后把 namespaceId varString 长度前缀字节改坏（[20] 0x23 → 0x22）。 */
function corruptedRouteKeyFrame(namespaceId: string, sequence: number): Uint8Array {
  const bytes = closeFrame(namespaceId, sequence);
  assert.equal(bytes[20], 0x23, '前置条件：namespaceId varString 前缀字节必须是 0x23');
  const corrupted = bytes.slice();
  corrupted[20] = 0x22;
  return corrupted;
}

interface EdgeFixture {
  readonly edge: ReturnType<typeof createHubReplicationEdge> & Record<string, unknown>;
  readonly transport: RecordedTransport;
  readonly timer: FakeTimer;
  readonly sink: ScriptedSink;
  readonly authorizeCalls: Array<{ instanceIdentity: string; namespaceId: string }>;
  readonly dropped: () => number;
  readonly resolveSinkCalls: unknown[];
  readonly verifyTokenCalls: unknown[];
}

/** 内部 edge 半边（T2 形态：构造期注入 transport + sessionFactory + authorize）。 */
function makeEdge(overrides: {
  authorize?: (instanceIdentity: string, namespaceId: string) => Promise<unknown>;
  sessionFactory?: (port: import('../../packages/ws-replication/src/hub-split.ts').HubSessionEdgePort) => import('../../packages/ws-replication/src/hub-split.ts').HubSessionSink;
  respondOpenOk?: boolean;
  connectionCounter?: number;
  withLiveness?: boolean;
  extraConfig?: Record<string, unknown>;
} = {}): EdgeFixture {
  const transport = makeTransport(overrides.withLiveness ?? false);
  const timer = makeFakeTimer();
  const authorizeCalls: Array<{ instanceIdentity: string; namespaceId: string }> = [];
  const resolveSinkCalls: unknown[] = [];
  const verifyTokenCalls: unknown[] = [];
  let dropped = 0;
  let scripted!: ScriptedSink;
  const config: Record<string, unknown> = {
    transport: transport.end,
    timer: timer.timer,
    limits: LIMITS,
    timeouts: TIMEOUTS,
    instanceId: HUB_INSTANCE,
    peerInstanceId: PEER_INSTANCE,
    connectionCounter: overrides.connectionCounter ?? 0,
    authorize: (instanceIdentity: string, namespaceId: string) => {
      authorizeCalls.push({ instanceIdentity, namespaceId });
      return overrides.authorize === undefined
        ? Promise.resolve(AUTHORIZED)
        : overrides.authorize(instanceIdentity, namespaceId);
    },
    earlyFrames: [],
    sessionFactory: (port: import('../../packages/ws-replication/src/hub-split.ts').HubSessionEdgePort) => {
      if (overrides.sessionFactory !== undefined) return overrides.sessionFactory(port);
      scripted = makeScriptedSink(port, { respondOpenOk: overrides.respondOpenOk ?? false });
      return scripted.sink;
    },
    onConnectionDropped: () => {
      dropped += 1;
    },
    ...(overrides.extraConfig ?? {}),
  };
  const edge = createHubReplicationEdge(
    config as unknown as Parameters<typeof createHubReplicationEdge>[0],
  ) as EdgeFixture['edge'];
  return {
    edge,
    transport,
    timer,
    get sink() {
      return scripted;
    },
    authorizeCalls,
    dropped: () => dropped,
    resolveSinkCalls,
    verifyTokenCalls,
  };
}

/** 单体（服务层组合根）：与内部 edge 同输入序列对照的出站帧金标来源。 */
function makeMonolith(connectionCounterIsFirst = true): {
  hub: { acceptTrusted(transport: unknown, identity: unknown): Promise<unknown> };
  transport: RecordedTransport;
  timer: FakeTimer;
} {
  const transport = makeTransport();
  const timer = makeFakeTimer();
  const hub = publicEntry.createHubReplication as (options: unknown) => {
    acceptTrusted(transport: unknown, identity: unknown): Promise<unknown>;
  };
  const instance = hub({
    instanceId: HUB_INSTANCE,
    registry: { open: async () => { throw new Error('sa6: registry.open not used'); } },
    authorize: async () => ({ ok: false }),
    timer: timer.timer,
    verifyToken: async () => null,
  });
  void connectionCounterIsFirst;
  return { hub: instance, transport, timer };
}

// ═══════════════════════════ 检查框架 ═══════════════════════════

type Kind = 'GAP' | 'ORACLE' | 'NC';
interface CheckResult {
  readonly id: string;
  readonly kind: Kind;
  readonly ok: boolean;
  readonly detail: string;
}
const results: CheckResult[] = [];

function expectEq(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: 期望 ${JSON.stringify(expected)}，实测 ${JSON.stringify(actual)}`);
  }
}
function expectDeepEq(actual: unknown, expected: unknown, label: string): void {
  try {
    assert.deepEqual(actual, expected);
  } catch {
    throw new Error(`${label}: 期望 ${JSON.stringify(expected)}，实测 ${JSON.stringify(actual)}`);
  }
}
function expectTrue(value: boolean, label: string): void {
  if (!value) throw new Error(label);
}

async function check(id: string, kind: Kind, fn: () => Promise<string> | string): Promise<void> {
  try {
    const detail = await fn();
    results.push({ id, kind, ok: true, detail });
  } catch (err) {
    results.push({ id, kind, ok: false, detail: err instanceof Error ? err.message : String(err) });
  }
}

// ═══════════════════════════ G1–G7：能力缺口（期望：确认缺失） ═══════════════════════════

await check('G1', 'GAP', () => {
  expectEq(typeof publicEntry.createHubReplicationEdge, 'undefined', '公共入口 createHubReplicationEdge');
  expectEq(typeof publicEntry.createHubSessionHost, 'undefined', '公共入口 createHubSessionHost');
  expectEq(typeof publicEntry.createHubReplication, 'function', '公共入口 createHubReplication（单体服务）');
  return `entry=${PUBLIC_ENTRY_URL.split('/packages/')[1]} exports=${Object.keys(publicEntry).length} 个；createHubReplicationEdge 未导出`;
});

await check('G2', 'GAP', async () => {
  const { edge } = makeEdge();
  expectEq(typeof (edge as Record<string, unknown>).accept, 'undefined', 'edge.accept');
  expectEq(typeof (edge as Record<string, unknown>).acceptTrusted, 'undefined', 'edge.acceptTrusted');
  const { hub } = makeMonolith();
  expectEq(typeof (hub as Record<string, unknown>).accept, 'function', '单体 hub.accept');
  expectEq(typeof (hub as Record<string, unknown>).acceptTrusted, 'function', '单体 hub.acceptTrusted');
  return '连接级半边无 accept/acceptTrusted（双入口仅存在于服务层组合根 HubReplicationImpl）';
});

await check('G3', 'GAP', async () => {
  // (a) T4 形态（宿主回调 resolveSessionSink、无 sessionFactory）不可构造
  const transport = makeTransport();
  const timer = makeFakeTimer();
  const resolveSinkCalls: unknown[] = [];
  let constructionError = '';
  try {
    createHubReplicationEdge({
      transport: transport.end,
      timer: timer.timer,
      limits: LIMITS,
      timeouts: TIMEOUTS,
      instanceId: HUB_INSTANCE,
      peerInstanceId: PEER_INSTANCE,
      connectionCounter: 0,
      authorize: async () => AUTHORIZED,
      earlyFrames: [],
      resolveSessionSink: (connectionKey: string, namespaceId: string, authorization: unknown) => {
        resolveSinkCalls.push({ connectionKey, namespaceId, authorization });
        return undefined;
      },
      onConnectionDropped: () => undefined,
    } as unknown as Parameters<typeof createHubReplicationEdge>[0]);
  } catch (err) {
    constructionError = err instanceof Error ? err.message : String(err);
  }
  expectTrue(
    constructionError.length > 0,
    'T4 形态（resolveSessionSink / 无 sessionFactory）竟然构造成功——前置事实变化',
  );
  // (b) 即便在合法配置里附送 resolveSessionSink，它也永不被调用（无解析阶段）
  const fixture = makeEdge({ respondOpenOk: true, extraConfig: { resolveSessionSink: () => undefined } });
  fixture.transport.send(helloFrame(1));
  await settle();
  fixture.transport.send(openFrame(NS_A, 2));
  await settle();
  expectEq(fixture.sink.pulls.length, 1, 'OPEN 准入结算拉取次数');
  expectEq(fixture.sink.pulls[0]!.outcome, 'authorized', 'OPEN 准入结局');
  expectEq(fixture.resolveSinkCalls.length, 0, '宿主 resolveSessionSink 调用次数');
  return `T4 形态构造抛错（${constructionError.slice(0, 72)}）；合法配置下 resolveSessionSink 调用 0 次`;
});

await check('G4', 'GAP', async () => {
  const fixture = makeEdge({
    authorize: async () => ({ ok: false }),
  });
  fixture.transport.send(helloFrame(1));
  await settle();
  fixture.transport.send(openFrame(NS_A, 2));
  await settle();
  expectDeepEq(fixture.sink.opens, [NS_A], 'denied OPEN 的 session 侧到达序列');
  return `授权拒绝下 OPEN 仍投递到 session 半边（opens=${JSON.stringify(fixture.sink.opens)}，pulls=${JSON.stringify(fixture.sink.pulls)}）——「未授权 OPEN 不过缝」无岗位可落`;
});

await check('G5', 'GAP', async () => {
  let release: (value: unknown) => void = () => undefined;
  const latched = new Promise((resolve) => {
    release = resolve;
  });
  const fixture = makeEdge({ authorize: () => latched });
  fixture.transport.send(helloFrame(1));
  await settle();
  fixture.transport.send(openFrame(NS_A, 2));
  await settle();
  // authorize 仍在途（sink 结局未产出）：非 OPEN 帧此刻到达
  fixture.transport.send(closeFrame(NS_A, 3));
  await settle();
  expectDeepEq(fixture.sink.opens, [NS_A], 'sink 到达序列（OPEN）');
  expectEq(fixture.sink.frames.length, 1, 'sink 未解析期帧投递次数');
  expectEq(fixture.sink.frames[0]!.kind, 'CLOSE_NAMESPACE', '未解析期投递帧型');
  expectEq(fixture.sink.pulls.length, 0, '结局拉取次数（应为 0 = authorize 未结）');
  expectEq(fixture.transport.closed(), false, '连接是否被上界/溢出口收口');
  release({ ok: false });
  await settle();
  return 'sink 未解析（authorize 在途）期帧即刻投递、零缓冲、零上界收口（无 pending 状态可测）';
});

await check('G6', 'GAP', async () => {
  let release: (value: unknown) => void = () => undefined;
  const latched = new Promise((resolve) => {
    release = resolve;
  });
  const fixture = makeEdge({ authorize: () => latched });
  fixture.transport.send(helloFrame(1));
  await settle();
  const namespaces = Array.from({ length: 8 }, (_, i) => `ns-${String(i + 1).padStart(32, '0')}`);
  let sequence = 2;
  for (const namespaceId of namespaces) {
    fixture.transport.send(openFrame(namespaceId, sequence));
    sequence += 1;
  }
  await settle();
  expectDeepEq(fixture.sink.opens, namespaces, '并发 OPEN 的 session 侧到达序列');
  expectEq(fixture.authorizeCalls.length, 8, 'in-flight authorize 次数');
  expectEq(fixture.transport.closed(), false, '并发 OPEN 是否触发连接收口');
  release({ ok: false });
  await settle();
  return `8 个 in-flight OPEN 全部到达 session 半边，零收口（无并发 OPEN 上界岗位）`;
});

await check('G7', 'GAP', async () => {
  const transport = makeTransport();
  const timer = makeFakeTimer();
  let thrown = '';
  try {
    createHubReplicationEdge({
      transport: transport.end,
      timer: timer.timer,
      limits: LIMITS,
      timeouts: TIMEOUTS,
      instanceId: HUB_INSTANCE,
      peerInstanceId: PEER_INSTANCE,
      connectionCounter: 0,
      authorize: async () => AUTHORIZED,
      earlyFrames: [],
      sessionFactory: () => {
        throw new Error('sa6: sink unavailable');
      },
      onConnectionDropped: () => undefined,
    });
  } catch (err) {
    thrown = err instanceof Error ? err.message : String(err);
  }
  expectTrue(thrown.length > 0, 'sink 装配失败竟然未抛错');
  expectEq(transport.frames().length, 0, 'sink 装配失败时的出站帧数');
  expectEq(transport.closed(), false, 'sink 装配失败时 transport 是否被响亮收口');
  return `sink 装配失败 = 构造期同步抛错（${thrown.slice(0, 40)}），wire 零帧零 close——连接级 INTERNAL_ERROR+1011 不可达`;
});

// ═══════════════════════════ O1–O8：契约行为（期望：现行语义已成立） ═══════════════════════════

await check('O1', 'ORACLE', async () => {
  const fixture = makeEdge({ respondOpenOk: true });
  fixture.transport.send(helloFrame(1));
  await settle();
  fixture.transport.send(corruptedRouteKeyFrame(NS_A, 2));
  await settle();
  const frames = fixture.transport.frames().map((bytes) => decodeMessage(bytes).message);
  expectDeepEq(frames.map((message) => message.kind), ['HELLO_ACK', 'ERROR'], '出站帧型序列');
  const error = frames[1] as Extract<typeof frames[number], { kind: 'ERROR' }>;
  expectEq(error.code, 'MALFORMED_FRAME', '违例帧出站 ERROR code');
  expectEq(error.namespaceId, undefined, '违例帧 ERROR 作用域（连接级）');
  expectDeepEq(fixture.transport.closeInfo(), { code: 1002, reason: 'protocol-error' }, '违例帧 close 分类');
  expectEq(fixture.sink.frames.length, 0, '违例帧的 session 投递数');
  return `违例帧 → ERROR{MALFORMED_FRAME, scope=connection} + close 1002 + 零投递（原始帧字节 [20]=0x22）`;
});

await check('O1b', 'ORACLE', async () => {
  const edgeFixture = makeEdge({ respondOpenOk: true, connectionCounter: 0 });
  edgeFixture.transport.send(helloFrame(1));
  await settle();
  edgeFixture.transport.send(corruptedRouteKeyFrame(NS_A, 2));
  await settle();
  const monolith = makeMonolith();
  await monolith.hub.acceptTrusted(monolith.transport.end, { peerInstanceId: PEER_INSTANCE });
  monolith.transport.send(helloFrame(1));
  await settle();
  monolith.transport.send(corruptedRouteKeyFrame(NS_A, 2));
  await settle();
  const edgeHex = edgeFixture.transport.frames().map(hexOf);
  const monolithHex = monolith.transport.frames().map(hexOf);
  expectDeepEq(edgeHex, monolithHex, '同输入序列出站帧 hex（edge vs 单体）');
  expectDeepEq(edgeFixture.transport.closeInfo(), monolith.transport.closeInfo(), 'close 分类');
  return `同输入序列逐字节一致（${edgeHex.length} 帧；HELLO_ACK+MALFORMED_FRAME），close 一致`;
});

await check('O2', 'ORACLE', async () => {
  const fixture = makeEdge();
  fixture.transport.send(helloFrame(1));
  await settle();
  fixture.transport.send(closeFrame(NS_UNKNOWN, 2));
  await settle();
  const frames = fixture.transport.frames().map((bytes) => decodeMessage(bytes).message);
  expectDeepEq(frames.map((message) => message.kind), ['HELLO_ACK', 'ERROR'], '无 sink 帧出站序列');
  const error = frames[1] as Extract<typeof frames[number], { kind: 'ERROR' }>;
  expectEq(error.code, 'NAMESPACE_STATE_VIOLATION', '无 sink 帧 ERROR code');
  expectEq(error.namespaceId, NS_UNKNOWN, '无 sink 帧 ERROR namespaceId');
  expectEq(fixture.transport.closed(), false, '无 sink 帧后连接存活');
  expectEq(fixture.sink.frames.length, 0, '无 sink 帧投递数');
  // 连接存活实证：后续帧继续被处理
  fixture.transport.send(closeFrame(NS_A, 3));
  await settle();
  expectEq(fixture.transport.frames().length, 3, '存活实证（第 3 帧仍产出 ERROR）');
  return `合法无 sink → ERROR{NAMESPACE_STATE_VIOLATION, ns} 且连接存活（后续帧仍处理）`;
});

await check('O2b', 'ORACLE', async () => {
  const edgeFixture = makeEdge({ connectionCounter: 0 });
  edgeFixture.transport.send(helloFrame(1));
  await settle();
  edgeFixture.transport.send(closeFrame(NS_UNKNOWN, 2));
  await settle();
  const monolith = makeMonolith();
  await monolith.hub.acceptTrusted(monolith.transport.end, { peerInstanceId: PEER_INSTANCE });
  monolith.transport.send(helloFrame(1));
  await settle();
  monolith.transport.send(closeFrame(NS_UNKNOWN, 2));
  await settle();
  expectDeepEq(
    edgeFixture.transport.frames().map(hexOf),
    monolith.transport.frames().map(hexOf),
    '无 sink 违例的同输入序列出站 hex（edge vs 单体）',
  );
  return '无 sink 合成帧与单体逐字节一致（同输入序列对比方法在 HEAD 可用）';
});

await check('O3', 'ORACLE', async () => {
  const fixture = makeEdge();
  fixture.transport.send(helloFrame(1));
  await settle();
  fixture.transport.send(connectionErrorFrame('INTERNAL_ERROR', 2));
  await settle();
  expectEq(fixture.transport.frames().length, 1, '连接级 ERROR 后的出站帧数（应仅 HELLO_ACK）');
  expectEq(fixture.sink.frames.length, 0, '连接级 ERROR 的 session 投递数');
  expectEq(fixture.transport.closed(), false, '连接级 ERROR 后连接存活');
  // 存活实证（与 R-none 分支解耦）：后续帧仍被处理并产出连接级收口
  fixture.transport.send(corruptedRouteKeyFrame(NS_A, 3));
  await settle();
  expectEq((decodeMessage(fixture.transport.frames()[1]!).message as { code?: string }).code, 'MALFORMED_FRAME', '存活实证（后续帧仍被处理）');
  return '连接级 ERROR 不路由（零投递、零出站回显、连接存活）';
});

await check('O4', 'ORACLE', async () => {
  const fixture = makeEdge({ respondOpenOk: true });
  fixture.transport.send(helloFrame(1));
  await settle();
  fixture.transport.send(openFrame(NS_A, 2));
  await settle();
  fixture.transport.send(namespaceErrorFrame('APPLY_FAILED', NS_A, 3));
  await settle();
  expectEq(fixture.sink.frames.length, 1, 'ns 级 ERROR 的 session 投递数');
  expectEq(fixture.sink.frames[0]!.kind, 'ERROR', '投递帧型');
  expectEq(fixture.sink.frames[0]!.namespaceId, NS_A, '投递目标 ns');
  expectEq(fixture.sink.frames[0]!.sequence, 3, '投递 wire 序');
  return 'namespace 级 ERROR 路由到该 ns 的 session（含 wire 序），连接存活';
});

await check('O5', 'ORACLE', async () => {
  const fixture = makeEdge({ respondOpenOk: false });
  fixture.transport.send(helloFrame(1));
  await settle();
  fixture.transport.send(openFrame(NS_A, 2));
  await settle();
  fixture.transport.send(openFrame(NS_B, 3));
  await settle();
  expectDeepEq(fixture.sink.pulls.map((pull) => pull.outcome), ['authorized', 'authorized'], '两条 OPEN 准入');
  // 多 ns 交织 mux：session 侧以 sequence=0 占位编码 4 帧
  fixture.sink.port.sendControlFrame(encodeMessage(openOkFrame(NS_A), { sequence: 0 }));
  fixture.sink.port.sendControlFrame(encodeMessage(openOkFrame(NS_B), { sequence: 0 }));
  fixture.sink.port.sendDataFrame(encodeMessage(openOkFrame(NS_A), { sequence: 0 }));
  fixture.sink.port.sendControlFrame(encodeMessage(openOkFrame(NS_B), { sequence: 0 }));
  const outbound = fixture.transport.frames();
  const sequences = outbound.map(rawSequence);
  expectDeepEq(sequences, [1, 2, 3, 4, 5], '出站 [8..12] 序列（HELLO_ACK + 4 交织帧）');
  const stampTargets: Array<[string, number]> = [
    [NS_A, 2],
    [NS_B, 3],
    [NS_A, 4],
    [NS_B, 5],
  ];
  for (let i = 0; i < 4; i += 1) {
    const [namespaceId, sequence] = stampTargets[i]!;
    const expected = encodeMessage(openOkFrame(namespaceId), { sequence });
    expectEq(hexOf(outbound[i + 1]!), hexOf(expected), `第 ${i + 1} 帧盖章字节`);
    expectEq(outbound[i + 1]![8]! * 256 + outbound[i + 1]![9]!, Math.floor(sequence / 65536), '高字节');
  }
  return 'per-connection 严格递增 1..5；交织帧字节 == 占位帧 [8..12] 重写结果';
});

await check('O5b', 'ORACLE', async () => {
  // 单体侧同输入序列（HELLO → 未知 ns 违例 ×2）出站帧与内部 edge 逐字节一致
  const edgeFixture = makeEdge({ connectionCounter: 0 });
  edgeFixture.transport.send(helloFrame(1));
  await settle();
  edgeFixture.transport.send(closeFrame(NS_UNKNOWN, 2));
  await settle();
  edgeFixture.transport.send(closeFrame(NS_B, 3));
  await settle();
  const monolith = makeMonolith();
  await monolith.hub.acceptTrusted(monolith.transport.end, { peerInstanceId: PEER_INSTANCE });
  monolith.transport.send(helloFrame(1));
  await settle();
  monolith.transport.send(closeFrame(NS_UNKNOWN, 2));
  await settle();
  monolith.transport.send(closeFrame(NS_B, 3));
  await settle();
  const edgeSequences = edgeFixture.transport.frames().map(rawSequence);
  expectDeepEq(edgeSequences, [1, 2, 3], 'edge 出站序列');
  expectDeepEq(
    edgeFixture.transport.frames().map(hexOf),
    monolith.transport.frames().map(hexOf),
    '三帧同输入序列出站 hex（edge vs 单体）',
  );
  return 'HELLO_ACK + 两笔违例 ERROR 三帧逐字节一致（盖章后 wire 与单体等价）';
});

await check('O6', 'ORACLE', async () => {
  const fixture = makeEdge({ respondOpenOk: true, connectionCounter: 0 });
  fixture.transport.send(helloFrame(1));
  await settle();
  fixture.transport.send(openFrame(NS_A, 2));
  fixture.transport.send(openFrame(NS_B, 3));
  await settle();
  const readyFrames = fixture.transport.frames().length;
  fixture.edge.beginReauth();
  expectEq(fixture.edge.state, 'draining', 'reauth 后连接状态');
  const goawayFrame = fixture.transport.frames()[readyFrames]!;
  const goaway = decodeMessage(goawayFrame).message;
  expectEq(goaway.kind, 'GOAWAY', 'reauth 首帧型');
  expectDeepEq(
    { reasonCode: (goaway as { reasonCode?: string }).reasonCode, drainTimeoutMs: (goaway as { drainTimeoutMs?: number }).drainTimeoutMs },
    { reasonCode: 'REAUTH_REQUIRED', drainTimeoutMs: TIMEOUTS.closeTimeoutMs },
    'GOAWAY 字段',
  );
  // drain 门：窗口内 OPEN 不再进入 session
  fixture.transport.send(openFrame(NS_UNKNOWN, 4));
  await settle();
  expectDeepEq(fixture.sink.opens, [NS_A, NS_B], 'drain 期 OPEN 到达序列（应不增）');
  // settled 信号驱动提前完成：仅一个通道终态 → 不收口
  fixture.sink.settled(NS_A);
  await settle();
  expectEq(fixture.transport.closed(), false, '单通道 settled 后是否提前收口（应否）');
  expectTrue(fixture.timer.pendingDelays().includes(TIMEOUTS.closeTimeoutMs), 'deadline 仍在武装');
  // 全部通道终态 → 立即收口（settled 驱动，不依赖 deadline fire）
  fixture.sink.settled(NS_B);
  await settle();
  expectEq(fixture.transport.closed(), true, '全通道 settled 后是否提前收口（应然）');
  expectDeepEq(fixture.transport.closeInfo(), { code: 1001, reason: 'hub-reauth' }, '提前完成 close 分类');
  expectEq(fixture.timer.pendingDelays().includes(TIMEOUTS.closeTimeoutMs), false, 'deadline 是否已清');
  return 'GOAWAY(REAUTH_REQUIRED, drain>0) → drain 门丢新 OPEN → settled 全覆盖提前 1001（deadline 未 fire）';
});

await check('O7', 'ORACLE', async () => {
  // (a) 非 HELLO 先行
  const a = makeEdge();
  a.transport.send(closeFrame(NS_A, 1));
  await settle();
  expectEq((decodeMessage(a.transport.frames()[0]!).message as { code?: string }).code, 'HELLO_REQUIRED', '非 HELLO 先行 ERROR');
  expectDeepEq(a.transport.closeInfo(), { code: 1002, reason: 'protocol-error' }, '非 HELLO 先行 close');
  // (b) 坏 magic（信封头结构性失败 → BAD_MAGIC 1002；与路由键违例的 MALFORMED_FRAME 可分）
  const b = makeEdge();
  const badMagic = closeFrame(NS_A, 1).slice();
  badMagic[0] = 0x00;
  b.transport.send(badMagic);
  await settle();
  expectEq((decodeMessage(b.transport.frames()[0]!).message as { code?: string }).code, 'BAD_MAGIC', '坏 magic ERROR');
  expectDeepEq(b.transport.closeInfo(), { code: 1002, reason: 'protocol-error' }, '坏 magic close');
  // (c) 入站 sequence gap（首帧 seq=3）
  const c = makeEdge();
  c.transport.send(helloFrame(3));
  await settle();
  expectEq((decodeMessage(c.transport.frames()[0]!).message as { code?: string }).code, 'SEQUENCE_VIOLATION', 'seq gap ERROR');
  expectDeepEq(c.transport.closeInfo(), { code: 1002, reason: 'protocol-error' }, 'seq gap close');
  return '非 HELLO → HELLO_REQUIRED 1002；坏 magic → BAD_MAGIC 1002；seq gap → SEQUENCE_VIOLATION 1002';
});

await check('O8', 'ORACLE', async () => {
  const fixture = makeEdge({ withLiveness: true, connectionCounter: 0 });
  fixture.transport.send(helloFrame(1));
  await settle();
  expectTrue(fixture.timer.pendingDelays().includes(TIMEOUTS.pingIntervalMs), 'ping timer 武装');
  fixture.timer.fireNext(TIMEOUTS.pingIntervalMs);
  await settle();
  const credential = fixture.transport.lastPing();
  expectTrue(credential !== undefined && credential.byteLength === 8, 'ping 凭据（8 字节）');
  expectTrue(fixture.timer.pendingDelays().includes(TIMEOUTS.pongTimeoutMs), 'pong 超时武装');
  // 迟到/不匹配 pong → 超时保留
  fixture.transport.emitPong(new Uint8Array(8).fill(0));
  await settle();
  expectTrue(fixture.timer.pendingDelays().includes(TIMEOUTS.pongTimeoutMs), '不匹配 pong 后超时仍在');
  // 凭据逐字节匹配的 pong → 清超时（另一条连接实证，避免与上一语句共用状态）
  const second = makeEdge({ withLiveness: true, connectionCounter: 1 });
  second.transport.send(helloFrame(1));
  await settle();
  second.timer.fireNext(TIMEOUTS.pingIntervalMs);
  await settle();
  const matched = second.transport.lastPing();
  expectTrue(matched !== undefined, '第二连接 ping 凭据');
  second.transport.emitPong(matched);
  await settle();
  expectEq(second.timer.pendingDelays().includes(TIMEOUTS.pongTimeoutMs), false, '匹配 pong 后超时清除');
  expectEq(second.transport.closed(), false, '匹配 pong 后连接存活');
  fixture.timer.fireNext(TIMEOUTS.pongTimeoutMs);
  await settle();
  expectDeepEq(fixture.transport.closeInfo(), { code: 1001, reason: 'pong-timeout' }, 'pong 超时 close');
  return 'ping 武装 + 不匹配 pong 不清超时 → 1001；匹配 pong 清超时且连接存活';
});

// ═══════════════════════════ NC1–NC4：相近负控（期望：全绿） ═══════════════════════════

await check('NC1', 'NC', async () => {
  const fixture = makeEdge({ respondOpenOk: true });
  fixture.transport.send(helloFrame(1));
  await settle();
  fixture.transport.send(openFrame(NS_A, 2));
  await settle();
  fixture.transport.send(closeFrame(NS_A, 3));
  await settle();
  expectDeepEq(fixture.sink.frames.map((frame) => frame.kind), ['CLOSE_NAMESPACE'], '已建立 ns 的投递');
  expectEq(fixture.transport.frames().length, 2, '已建立 ns 帧无额外 ERROR（仅 HELLO_ACK+OPEN_OK）');
  expectEq(fixture.transport.closed(), false, '已建立 ns 帧后连接存活');
  return '已建立 ns 的合法帧投递且零违例（对照 O2 的「无 sink」分支可判别）';
});

await check('NC2', 'NC', async () => {
  const first = makeEdge({ respondOpenOk: false, connectionCounter: 0 });
  first.transport.send(helloFrame(1));
  await settle();
  first.transport.send(openFrame(NS_A, 2));
  await settle();
  first.sink.port.sendControlFrame(encodeMessage(openOkFrame(NS_A), { sequence: 0 }));
  const second = makeEdge({ respondOpenOk: false, connectionCounter: 1 });
  second.transport.send(helloFrame(1));
  await settle();
  second.transport.send(openFrame(NS_A, 2));
  await settle();
  second.sink.port.sendControlFrame(encodeMessage(openOkFrame(NS_A), { sequence: 0 }));
  expectDeepEq(first.transport.frames().map(rawSequence), [1, 2], '连接 1 出站序列');
  expectDeepEq(second.transport.frames().map(rawSequence), [1, 2], '连接 2 出站序列');
  return '两条连接各自从 1 起（per-connection 而非全局计数）';
});

await check('NC3', 'NC', async () => {
  const fixture = makeEdge();
  fixture.transport.send(helloFrame(1));
  await settle();
  fixture.transport.send(namespaceErrorFrame('APPLY_FAILED', NS_UNKNOWN, 2));
  await settle();
  expectEq(fixture.sink.frames.length, 0, '未知 ns 的 ERROR 投递数');
  expectEq(fixture.transport.frames().length, 1, '未知 ns 的 ERROR 出站帧数');
  expectEq(fixture.transport.closed(), false, '连接存活');
  return '未知 ns 的 namespace 级 ERROR 静默丢弃（单体 I5 语义；与 O3/O4 两分支可判别）';
});

await check('NC4', 'NC', async () => {
  const fixture = makeEdge({ respondOpenOk: false });
  fixture.transport.send(helloFrame(1));
  await settle();
  fixture.transport.send(openFrame(NS_A, 2));
  await settle();
  fixture.transport.send(closeFrame(NS_B, 3));
  await settle();
  expectDeepEq(fixture.sink.frames.length, 0, '未建立 ns B 的投递数（不得外溢到已建 ns A 的 session）');
  const frames = fixture.transport.frames().map((bytes) => decodeMessage(bytes).message);
  expectDeepEq(frames.map((message) => message.kind), ['HELLO_ACK', 'ERROR'], 'ns B 违例出站序列');
  const error = frames[1] as { code?: string; namespaceId?: string };
  expectEq(error.code, 'NAMESPACE_STATE_VIOLATION', 'ns B 违例 code');
  expectEq(error.namespaceId, NS_B, 'ns B 违例目标 ns');
  return '已建 ns A 时 ns B 帧不得投递；违例帧点名 ns B（账本按键隔离）';
});

// ═══════════════════════════ 汇总 ═══════════════════════════

for (const result of results) {
  const status = result.ok ? (result.kind === 'GAP' ? 'ABSENT' : 'ok') : 'FAIL';
  console.log(`${result.kind.padEnd(6)} ${result.id.padEnd(4)} ${status.padEnd(6)} ${result.detail}`);
}
const gaps = results.filter((result) => result.kind === 'GAP');
const oracles = results.filter((result) => result.kind !== 'GAP');
const gapsOk = gaps.filter((result) => result.ok).length;
const oraclesOk = oracles.filter((result) => result.ok).length;
const failedOracleIds = oracles.filter((result) => !result.ok).map((result) => result.id);
const failedGapIds = gaps.filter((result) => !result.ok).map((result) => result.id);
console.log(
  `RESULT gaps=${gapsOk}/${gaps.length} oracle+nc=${oraclesOk}/${oracles.length} ` +
    `failed_oracle=[${failedOracleIds.join(',')}] failed_gap=[${failedGapIds.join(',')}]`,
);
const EXPECTED_FAIL = (process.env.SA6_EXPECT_FAIL ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter((id) => id.length > 0);
// 变异模式 = 环境变量**在场**（空期望集也是合法期望：中性变异必须全绿）
if (process.env.SA6_EXPECT_FAIL !== undefined) {
  const actualFail = [...failedGapIds, ...failedOracleIds].sort();
  const expected = [...EXPECTED_FAIL].sort();
  console.log(`MUTATION_RESULT actual_fail=[${actualFail.join(',')}] expected_fail=[${expected.join(',')}]`);
  process.exitCode = actualFail.join(',') === expected.join(',') ? 0 : 1;
} else {
  process.exitCode = failedOracleIds.length === 0 && gaps.length === gapsOk ? 0 : 1;
}
