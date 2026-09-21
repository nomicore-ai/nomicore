/**
 * SA6 验收契约 — issue #423（spec #415 T6）：**observer 发射点拆分与降级口径**。
 *
 * 契约来源：issue #423 正文（What to build + 6 条 Acceptance criteria）、ADR 0032 决策 5、
 * `docs/protocols/instance-replication-v1.md` §23（事件词汇 / 稳定码 / safe-field / 隔离语义）。
 * 报告：`wiki/raw/task_issue-423_sa6_contract.md`。
 *
 * AC 映射（红/绿见报告 §13）：
 *   EM-C1 → AC1 发射侧归属：连接域事件由 **edge** 发射（宿主 session 桩零参与即在场的证据）；
 *          edge 复现的拒绝/合成路径；edge 半边零 namespace 域成功族越界发射。
 *   EM-C2 → AC3 授权拒绝路径字段：`namespace-error{sent}` / `namespace-failed{open-failed}`
 *          的 **connectionId 在场纪律**（§23.3：受控标识缺席只允许出现在握手完成前）+ 键集
 *          ⊆ §23 注册集。**当前实现红灯**：工厂形态两事件缺 connectionId，单体形态在场
 *          —— 同协议路径两形态字段集不一致。
 *   EM-C3 → AC2 缺面 dormant：session 侧 shim 无 `bufferedAmount` / 无 clock（`now`）/
 *          无 ping-onPong 面 → 对应字段整键缺席（非 0 / 非 undefined 值），并带可观测面与
 *          wire 面正控（证明断言敏感、非恒真）。
 *   EM-C4 → AC1 出站 sequence 事件：`update-sent`（family 中唯一携盖章后 `sequence` 的型，
 *          读法登记见报告 §11）由 **edge** 在盖章点发射，`sequence` == wire `[8..12]`、
 *          `bytes` == 出站 UPDATE 载荷长度、恰一（无重复）；session 半边不再发射出站
 *          sequence 事件。**当前实现红灯**。
 *   EM-C5 → AC4 observer throw 隔离：两侧（edge 公共出面 / 单体进程内组合）observer 全抛
 *          时 wire 帧、协议状态、业务收敛零变化 + 零 unhandledRejection。
 *   EM-C6 → AC5 listen 模式 `maxConcurrentAssembliesPerConnection` 计数口径不变（回归锚：
 *          per-connection 跨 namespace 共享槽位；分片形态 per-session 降级为文档面，见报告 §12.5）。
 *   EM-C7 → AC6 单体进程内组合事件序列 == **拆分前金标**（型 + 精确键集 + 稳定字面量字段；
 *          无重复 / 无缺失 / 无乱序）。金标由拆分提交 `1278fd3` 的父提交 `e9cd7eb`
 *          worktree 实跑采集（同一脚本在 HEAD 复跑逐字相等；报告 §9/§13）。
 *
 * 纪律：断言 = 运行时行为（wire 原字节 / observer 事件 / 宿主回调计数 / 句柄投影）；
 * 零源码 grep / 字符串断言；零 skip/only/todo/env override；零 mock 被测对象（桩只落在
 * **缝的另一侧**：宿主 sink / seam port）。灯具：真实 Registry/Runtime（session 侧）、
 * 内存管道（工厂/edge 侧）、fake timer（零 real sleep）。
 */
import { describe, expect, it } from 'vitest';
import { decodeMessage, encodeMessage } from '@nomicore/replication-protocol';
import type { DecodedMessage, ReplicationMessage } from '@nomicore/replication-protocol';
import { createHubReplicationEdge } from '@nomicore/ws-replication';
import type {
  DuplexTransport,
  HubNamespaceSessionSink,
  HubReplicationEdgeConnection,
  HubReplicationEdgeFactory,
  HubReplicationEdgeOptions,
  HubSessionSinkResolver,
  NamespaceAuthorization,
  ReplicationClock,
  ReplicationObserver,
  ReplicationObserverEvent,
  ReplicationTimer,
} from '@nomicore/ws-replication';
import { createMemoryDuplexTransport } from '@nomicore/ws-replication/testing';
import { createHubReplicationEdge as createInternalEdge } from '../src/hub-edge.js';
import { createHubSessionHost, type HubSessionHost } from '../src/hub-session.js';
import type { HubSessionEdgePort } from '../src/hub-split.js';
import { resolveLimits, resolveTimeouts } from '../src/defaults.js';
import { boot, collectUnhandledRejections } from './driver.js';
import { HUB_INSTANCE, PEER_INSTANCE, makeHubNamespace, makeNode, settle, settleUntil } from './harness.js';

// ═══════════════════════════ 局部工具（不触碰 src） ═══════════════════════════

const NS_A = `ns-${'0'.repeat(31)}1`;
const NS_C = `ns-${'0'.repeat(31)}3`;
const HELLO_NONCE = new Uint8Array(16).fill(0x80);

/** 手动单调时钟（`ReplicationClock`；零 real sleep）。 */
class ManualClock implements ReplicationClock {
  private value = 1_000;
  now = (): number => this.value;
  advance = (ms: number): void => {
    this.value += ms;
  };
}

function rawSequence(bytes: Uint8Array): number {
  return (((bytes[8]! << 24) | (bytes[9]! << 16) | (bytes[10]! << 8) | bytes[11]!) >>> 0);
}

function hexOf(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

interface FakeTimer {
  readonly timer: ReplicationTimer;
  readonly size: () => number;
}

function makeFakeTimer(): FakeTimer {
  let counter = 0;
  const pending = new Map<number, () => void>();
  return {
    timer: {
      setTimeout: (callback: () => void) => {
        counter += 1;
        pending.set(counter, callback);
        return counter;
      },
      clearTimeout: (handle: unknown) => {
        pending.delete(handle as number);
      },
    },
    size: () => pending.size,
  };
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

function closeFrame(namespaceId: string, sequence: number): Uint8Array {
  return encodeMessage({ kind: 'CLOSE_NAMESPACE', namespaceId, reasonCode: 'peer-close' }, { sequence });
}

/** UPDATE 占位帧（sequence=0；edge 在 mux 点盖章）。 */
function placeholderUpdateFrame(namespaceId: string, updateBytes: number): Uint8Array {
  return encodeMessage(
    { kind: 'UPDATE', namespaceId, update: new Uint8Array(updateBytes).fill(0x42) },
    { sequence: 0 },
  );
}

function openOkFrame(namespaceId: string): Uint8Array {
  return encodeMessage(
    {
      kind: 'OPEN_OK',
      namespaceId,
      mode: 0,
      replicationId: 'a'.repeat(32),
      replicationEpoch: 1,
    },
    { sequence: 0 },
  );
}

function ofType<T extends ReplicationObserverEvent['type']>(
  events: readonly ReplicationObserverEvent[],
  type: T,
): Array<Extract<ReplicationObserverEvent, { type: T }>> {
  return events.filter(
    (event): event is Extract<ReplicationObserverEvent, { type: T }> => event.type === type,
  );
}

function errorOf(bytes: Uint8Array): Extract<ReplicationMessage, { kind: 'ERROR' }> {
  const message = decodeMessage(bytes).message;
  if (message.kind !== 'ERROR') throw new Error(`fixture: 期望 ERROR 帧，实得 ${message.kind}`);
  return message;
}

// ═══════════════════════════ §23 字段注册表（本契约触及的型） ═══════════════════════════

/** key = 事件型；`required` = §23 表格中无 `?` 的字段；`optional` = 带 `?` 的字段。 */
const SECTION_23_FIELDS: Readonly<
  Record<string, Readonly<{ required: readonly string[]; optional: readonly string[] }>>
> = Object.freeze({
  'connection-state-changed': { required: ['from', 'to'], optional: ['connectionId'] },
  'connection-failed': { required: ['code', 'wsCloseCode'], optional: ['connectionId'] },
  'auth-upgrade-rejected': { required: ['reason'], optional: [] },
  'send-paused': { required: ['bufferedAmount'], optional: ['connectionId'] },
  'send-resumed': { required: ['bufferedAmount'], optional: ['connectionId'] },
  'event-loop-delay-sampled': { required: ['delayMs'], optional: ['connectionId'] },
  'channel-state-changed': { required: ['namespaceId', 'from', 'to'], optional: ['connectionId'] },
  'bootstrap-snapshot-sent': { required: ['namespaceId', 'bytes'], optional: ['connectionId'] },
  'sync-step2-sent': {
    required: ['namespaceId', 'bytes', 'syncRoundId', 'encodedUpdateBytes'],
    optional: ['connectionId'],
  },
  'sync-diff-applied': {
    required: [
      'namespaceId',
      'bytes',
      'syncRoundId',
      'encodedUpdateBytes',
      'sequence',
      'stateVectorChanged',
      'applyEffect',
    ],
    optional: [
      'connectionId',
      'applyLatencyMs',
      'stateVectorBeforeHash',
      'stateVectorAfterHash',
      'queueWaitMs',
      'protectedCheckMs',
      'liveApplyMs',
      'dirtyNotifyMs',
    ],
  },
  'update-sent': {
    required: ['namespaceId', 'bytes', 'sequence'],
    optional: ['connectionId', 'sendQueueMs'],
  },
  'update-applied': {
    required: ['namespaceId', 'bytes', 'sequence'],
    optional: [
      'connectionId',
      'applyLatencyMs',
      'queueWaitMs',
      'protectedCheckMs',
      'liveApplyMs',
      'dirtyNotifyMs',
    ],
  },
  'update-acked': {
    required: ['namespaceId', 'bytes', 'sequence'],
    optional: ['connectionId', 'ackLatencyMs'],
  },
  'resync-required': {
    required: ['namespaceId', 'cause'],
    optional: [
      'connectionId',
      'reason',
      'updateBytes',
      'maxUpdateBytes',
      'channelState',
      'connectionState',
      'queuedUpdateCount',
      'queuedUpdateBytes',
      'inFlightCount',
      'bufferedAmount',
    ],
  },
  'update-dropped': {
    required: ['namespaceId', 'reason'],
    optional: [
      'connectionId',
      'updateBytes',
      'maxUpdateBytes',
      'channelState',
      'connectionState',
      'queuedUpdateCount',
      'queuedUpdateBytes',
      'inFlightCount',
      'bufferedAmount',
    ],
  },
  'namespace-error': {
    required: ['namespaceId', 'code', 'direction'],
    optional: ['connectionId', 'terminalState'],
  },
  'namespace-failed': {
    required: ['namespaceId', 'cause'],
    optional: ['connectionId', 'timeoutMs'],
  },
});

/** 连接域（edge 半边）型集——§23 分类：连接域 + pre-connection 拒绝。 */
const CONNECTION_DOMAIN_TYPES: ReadonlySet<string> = new Set([
  'connection-state-changed',
  'connection-backoff-scheduled',
  'goaway-received',
  'event-loop-delay-sampled',
  'connection-failed',
  'auth-upgrade-rejected',
  'send-paused',
  'send-resumed',
]);

function assertSection23Shape(events: readonly ReplicationObserverEvent[], label: string): void {
  for (const event of events) {
    const schema = SECTION_23_FIELDS[event.type];
    expect(schema, `${label}: 未登记的 §23 事件型 ${event.type}`).toBeDefined();
    const keys = Object.keys(event);
    for (const key of keys) {
      expect(
        key === 'type' ||
          key === 'side' ||
          schema!.required.includes(key) ||
          schema!.optional.includes(key),
        `${label}: ${event.type} 意外键 ${key}（§23 注册集外）`,
      ).toBe(true);
    }
    for (const key of schema!.required) {
      expect(keys, `${label}: ${event.type} 缺必填键 ${key}`).toContain(key);
    }
    const text = JSON.stringify(event);
    expect(text.includes('SENTINEL'), `${label}: ${event.type} 泄漏异常原文`).toBe(false);
    const visit = (value: unknown): void => {
      if (value === null || typeof value !== 'object') return;
      expect(
        value instanceof Uint8Array || value instanceof ArrayBuffer || value instanceof DataView,
        `${label}: ${event.type} 含二进制对象`,
      ).toBe(false);
      expect(value instanceof Error, `${label}: ${event.type} 含 Error 对象`).toBe(false);
      for (const inner of Object.values(value)) visit(inner);
    };
    visit(event);
  }
}

// ═══════════════════════════ 工厂（edge 公共出面）灯具 ═══════════════════════════

interface EdgeWire {
  readonly hubEnd: DuplexTransport;
  readonly outbound: Uint8Array[];
  readonly closes: Array<Readonly<{ code: number; reason: string }>>;
  inject(bytes: Uint8Array): void;
}

function makeEdgeWire(): EdgeWire {
  const { peer, hub } = createMemoryDuplexTransport();
  const outbound: Uint8Array[] = [];
  const closes: Array<Readonly<{ code: number; reason: string }>> = [];
  peer.onMessage((bytes) => outbound.push(bytes));
  peer.onClose((info) => closes.push({ code: info.code, reason: info.reason }));
  return {
    hubEnd: hub,
    outbound,
    closes,
    inject: (bytes) => {
      if (!hub.closed) peer.send(bytes);
    },
  };
}

interface FactoryFixture {
  readonly factory: HubReplicationEdgeFactory;
  readonly wire: EdgeWire;
  readonly events: ReplicationObserverEvent[];
  readonly timer: FakeTimer;
}

function makeFactory(
  overrides: Readonly<{
    authorize?: HubReplicationEdgeOptions['authorize'];
    observer?: ReplicationObserver;
    clock?: ReplicationClock;
    resolveSessionSink?: HubSessionSinkResolver;
  }> = {},
): FactoryFixture {
  const wire = makeEdgeWire();
  const timer = makeFakeTimer();
  const events: ReplicationObserverEvent[] = [];
  const options: HubReplicationEdgeOptions = {
    instanceId: HUB_INSTANCE,
    timer: timer.timer,
    authorize: overrides.authorize ?? (() => Promise.resolve({ ok: false })),
    resolveSessionSink: overrides.resolveSessionSink ?? (() => undefined),
    observer: overrides.observer ?? ((event) => events.push(event)),
    ...(overrides.clock === undefined ? {} : { clock: overrides.clock }),
  };
  return { factory: createHubReplicationEdge(options), wire, events, timer };
}

async function connect(fixture: FactoryFixture): Promise<HubReplicationEdgeConnection> {
  const connection = await fixture.factory.acceptTrusted(fixture.wire.hubEnd, {
    peerInstanceId: PEER_INSTANCE,
  });
  await settle();
  if (connection === undefined) throw new Error('fixture: acceptTrusted 未分配连接');
  return connection;
}

/** 记录型宿主 sink（缝的另一侧；零 observer 面——事件只能来自 edge）。 */
function makeHostSink(): HubNamespaceSessionSink {
  return {
    openNamespace: () => undefined,
    namespaceFrame: () => undefined,
    terminateUnauthorized: () => Promise.resolve(),
    onConnectionClosed: () => Promise.resolve(),
  };
}

// ═══════════════════════════ session 半边（seam port 桩）灯具 ═══════════════════════════

const AUTHORIZED: Extract<NamespaceAuthorization, { ok: true }> = {
  ok: true,
  localOwner: Object.freeze({ userId: 'hub-owner-9f38' }),
  permissions: Object.freeze({ read: true, submit: true }),
};

interface StubPort {
  readonly port: HubSessionEdgePort;
  readonly control: Uint8Array[];
  readonly data: Uint8Array[];
  readonly events: ReplicationObserverEvent[];
  readonly settled: string[];
}

interface StubFacets {
  readonly bufferedAmount?: () => number | undefined;
  readonly now?: () => number;
  readonly observerPresent?: boolean;
}

function makeStubPort(facets: StubFacets = {}): StubPort {
  let sequence = 0;
  const control: Uint8Array[] = [];
  const data: Uint8Array[] = [];
  const events: ReplicationObserverEvent[] = [];
  const settled: string[] = [];
  const port: HubSessionEdgePort = {
    openAdmission: () => Promise.resolve({ outcome: 'authorized', authorization: AUTHORIZED }),
    sendControlFrame: (frame) => {
      control.push(frame);
      sequence += 1;
      return sequence;
    },
    sendDataFrame: (frame) => {
      data.push(frame);
      sequence += 1;
      return sequence;
    },
    dataGateOpen: () => true,
    onDataQueued: () => undefined,
    requestDataDrain: () => undefined,
    chunkedUpdateNegotiated: () => false,
    connectionFatal: () => undefined,
    onChannelSettled: (namespaceId) => {
      settled.push(namespaceId);
    },
    tryBeginInboundAssembly: () => true,
    endInboundAssembly: () => undefined,
    observerPresent: () => facets.observerPresent ?? true,
    emitObserver: (event) => {
      events.push(event);
    },
    connectionId: () => 'stub-conn-0',
    connectionState: () => 'ready',
    bufferedAmount: facets.bufferedAmount ?? (() => undefined),
    ...(facets.now === undefined ? {} : { now: facets.now }),
  };
  return { port, control, data, events, settled };
}

interface SessionFixture {
  readonly host: HubSessionHost;
  readonly stub: StubPort;
  readonly namespaceId: string;
  readonly write: (value: number) => Promise<void>;
}

/** session 半边独立实例化 + 真实 Registry/Runtime；OPEN → bootstrap → reconcile → live。 */
async function makeSessionHostFixture(
  facets: StubFacets,
  limitsOverrides: Readonly<{ maxUpdateBytes?: number; maxQueuedUpdateBytes?: number }> = {},
): Promise<SessionFixture> {
  const node = makeNode('hub');
  const fixture = await makeHubNamespace(node);
  const stub = makeStubPort(facets);
  const limits = resolveLimits({
    maxUpdateBytes: limitsOverrides.maxUpdateBytes ?? 16,
    maxQueuedUpdateBytes: limitsOverrides.maxQueuedUpdateBytes ?? 64,
  });
  const host = createHubSessionHost({
    port: stub.port,
    registry: node.registry,
    instanceId: HUB_INSTANCE,
    peerInstanceId: PEER_INSTANCE,
    timer: node.scheduler,
    limits,
    timeouts: resolveTimeouts(undefined),
  });
  const namespaceId = fixture.namespaceId;
  host.openNamespace({ kind: 'OPEN_NAMESPACE', namespaceId, hasLocalReplica: false });
  await settleUntil(
    () => stub.control.some((frame) => decodeMessage(frame).message.kind === 'BOOTSTRAP_SNAPSHOT'),
    'BOOTSTRAP_SNAPSHOT 出站',
  );
  const snapshotIndex = stub.control.findIndex(
    (frame) => decodeMessage(frame).message.kind === 'BOOTSTRAP_SNAPSHOT',
  );
  host.namespaceFrame({ kind: 'BOOTSTRAP_ACK', namespaceId, ackedSequence: snapshotIndex + 1 }, 2);
  await settle();
  host.namespaceFrame(
    { kind: 'SYNC_STEP1', namespaceId, syncRoundId: 1, stateVector: new Uint8Array([0]) },
    3,
  );
  await settleUntil(
    () => stub.control.some((frame) => decodeMessage(frame).message.kind === 'SYNC_STEP2'),
    'SYNC_STEP2 出站',
  );
  const step1Index = stub.control.findIndex(
    (frame) => decodeMessage(frame).message.kind === 'SYNC_STEP1',
  );
  const step2Index = stub.control.findIndex(
    (frame) => decodeMessage(frame).message.kind === 'SYNC_STEP2',
  );
  const step2Message = decodeMessage(stub.control[step2Index]!).message;
  if (step2Message.kind !== 'SYNC_STEP2') throw new Error('fixture: SYNC_STEP2 形态断言失败');
  host.namespaceFrame(
    {
      kind: 'SYNC_STEP2',
      namespaceId,
      syncRoundId: 1,
      relatedStep1Sequence: step1Index + 1,
      update: step2Message.update,
    },
    4,
  );
  await settle();
  host.namespaceFrame(
    { kind: 'SYNC_APPLIED', namespaceId, syncRoundId: 1, ackedSequence: step2Index + 1 },
    5,
  );
  await settleUntil(
    () =>
      stub.events.some((event) => event.type === 'channel-state-changed' && event.to === 'live'),
    'reconcile → live',
  );
  const channel = host.channels.get(namespaceId);
  if (channel === undefined) throw new Error('fixture: 通道未在场');
  return {
    host,
    stub,
    namespaceId,
    write: async (value: number): Promise<void> => {
      const result = await fixture.lease.mutateData({ op: 'set', path: ['n'], value });
      if (!result.ok) throw new Error(`fixture: 业务写失败 ${JSON.stringify(result)}`);
      await settle();
      // listen 形态 drain 由 edge 连接级 poll 驱动；独立 session 半边显式驱动同一 facet。
      const facet = host.dataFacetOf(namespaceId);
      if (facet === undefined) throw new Error('fixture: data facet 缺失');
      for (let pass = 0; pass < 4 && facet.queuedCount() > 0; pass += 1) facet.pullAndSendOne();
      await settle();
    },
  };
}

function updateSentEvents(
  events: readonly ReplicationObserverEvent[],
): Array<Extract<ReplicationObserverEvent, { type: 'update-sent' }>> {
  return ofType(events, 'update-sent');
}

// ═══════════════════════════ EM-C1：发射侧归属（edge / session） ═══════════════════════════

describe('issue #423 EM-C1：发射侧归属 — edge 半边', () => {
  it('EM-C1a：HELLO → connection-state-changed 由 edge 发射（宿主 session 桩零事件参与）', async () => {
    const fixture = makeFactory({ authorize: () => Promise.resolve({ ok: false }) });
    const connection = await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    await settle();
    const states = ofType(fixture.events, 'connection-state-changed');
    expect(states).toHaveLength(1);
    expect(states[0]).toMatchObject({ side: 'hub', from: 'handshaking', to: 'ready' });
    expect(states[0]!.connectionId).toBe(connection.connectionKey);
    assertSection23Shape(fixture.events, 'EM-C1a');
    connection.close(1001, 'test');
    await connection.settle();
  });

  it('EM-C1b：未授权 OPEN → edge 复现拒绝路径（ns ERROR 帧 + 恰一 namespace-error + 恰一 namespace-failed）', async () => {
    const fixture = makeFactory();
    const connection = await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    await settle();
    fixture.wire.inject(openFrame(NS_A, 2));
    await settleUntil(
      () => fixture.events.some((event) => event.type === 'namespace-failed'),
      '拒绝结算',
    );
    const namespaceErrors = fixture.wire.outbound
      .map((bytes) => decodeMessage(bytes).message)
      .filter(
        (message): message is Extract<ReplicationMessage, { kind: 'ERROR' }> =>
          message.kind === 'ERROR' && message.namespaceId !== undefined,
      );
    expect(namespaceErrors).toHaveLength(1);
    expect(namespaceErrors[0]).toMatchObject({ code: 'NAMESPACE_UNAUTHORIZED', namespaceId: NS_A });
    expect(ofType(fixture.events, 'namespace-error')).toHaveLength(1);
    expect(ofType(fixture.events, 'namespace-failed')).toHaveLength(1);
    expect(connection.namespaces.size).toBe(0);
    expect(fixture.wire.closes).toEqual([]); // 连接存活
    assertSection23Shape(fixture.events, 'EM-C1b');
    connection.close(1001, 'test');
    await connection.settle();
  });

  it('EM-C1c：无台账 ns 帧 → edge 合成 NAMESPACE_STATE_VIOLATION（R-none；session 桩零投递）', async () => {
    const opens: string[] = [];
    const frames: string[] = [];
    const sink: HubNamespaceSessionSink = {
      openNamespace: (message) => {
        opens.push(message.namespaceId);
      },
      namespaceFrame: (message) => {
        frames.push(message.kind);
      },
      terminateUnauthorized: () => Promise.resolve(),
      onConnectionClosed: () => Promise.resolve(),
    };
    const fixture = makeFactory({ resolveSessionSink: () => sink });
    const connection = await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    await settle();
    fixture.wire.inject(closeFrame(NS_C, 2)); // 未投递 ns 的合法 ns 域帧 → R-none
    await settle();
    expect(opens).toEqual([]);
    expect(frames).toEqual([]); // 帧不过缝
    const synthesized = ofType(fixture.events, 'namespace-error');
    expect(synthesized).toHaveLength(1);
    expect(synthesized[0]).toMatchObject({
      side: 'hub',
      namespaceId: NS_C,
      code: 'NAMESPACE_STATE_VIOLATION',
      direction: 'sent',
    });
    expect(connection.state).toBe('ready'); // 连接存活
    assertSection23Shape(fixture.events, 'EM-C1c');
    connection.close(1001, 'test');
    await connection.settle();
  });

  it('EM-C1d（负控）：edge 半边零 namespace 域成功族越界发射（bootstrap/sync/applied 型零出现）', async () => {
    const fixture = makeFactory({
      resolveSessionSink: () => makeHostSink(),
      authorize: () => Promise.resolve(AUTHORIZED),
    });
    const connection = await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    await settle();
    fixture.wire.inject(openFrame(NS_A, 2));
    await settleUntil(() => connection.namespaces.has(NS_A), '会话建立');
    connection.egress.sendDataFrame(placeholderUpdateFrame(NS_A, 23));
    fixture.wire.inject(closeFrame(NS_A, 3));
    await settle();
    const types: ReadonlySet<string> = new Set(fixture.events.map((event) => event.type));
    for (const forbidden of [
      'channel-state-changed',
      'bootstrap-snapshot-sent',
      'sync-step2-sent',
      'sync-diff-applied',
      'update-applied',
      'update-acked',
      'resync-required',
    ]) {
      expect(types.has(forbidden), `EM-C1d: edge 半边不得替 session 发射 ${forbidden}`).toBe(false);
    }
    connection.close(1001, 'test');
    await connection.settle();
  });

  it('EM-C1e（session 半边负控）：独立 session host 零连接域事件（连接域事实不在 session）', async () => {
    const fixture = await makeSessionHostFixture(
      {},
      { maxUpdateBytes: 8_192, maxQueuedUpdateBytes: 32_768 },
    );
    await fixture.write(43);
    expect(fixture.stub.events.length).toBeGreaterThan(0); // 场景确实产出了事件（非空断言）
    for (const event of fixture.stub.events) {
      expect(
        CONNECTION_DOMAIN_TYPES.has(event.type),
        `EM-C1e: session 半边不得发射连接域事件 ${event.type}`,
      ).toBe(false);
    }
    expect(fixture.stub.data, 'EM-C1e: 场景确实驱动了 data 出站（非空断言）').toHaveLength(1);
  });
});

// ═══════════════════════════ EM-C2：授权拒绝路径字段（AC3） ═══════════════════════════

describe('issue #423 EM-C2：授权拒绝路径的字段正确性（connectionId 在场纪律）', () => {
  it('EM-C2a：工厂形态拒绝路径两事件必须携 connectionId（= 句柄 connectionKey；握手后在场的纪律）', async () => {
    const fixture = makeFactory();
    const connection = await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    await settle();
    fixture.wire.inject(openFrame(NS_A, 2));
    await settleUntil(
      () => fixture.events.some((event) => event.type === 'namespace-failed'),
      '拒绝结算',
    );
    const error = ofType(fixture.events, 'namespace-error')[0]!;
    const failed = ofType(fixture.events, 'namespace-failed')[0]!;
    expect(error.connectionId, 'EM-C2a: namespace-error{sent} 缺 connectionId').toBe(
      connection.connectionKey,
    );
    expect(failed.connectionId, 'EM-C2a: namespace-failed{open-failed} 缺 connectionId').toBe(
      connection.connectionKey,
    );
    connection.close(1001, 'test');
    await connection.settle();
  });

  it('EM-C2b：authorize throw 同族——键集 ⊆ §23 注册集、必填键在场、零异常原文', async () => {
    const fixture = makeFactory({
      authorize: () => Promise.reject(new Error('SENTINEL-authorizer-exploded')),
    });
    const connection = await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    await settle();
    fixture.wire.inject(openFrame(NS_A, 2));
    await settleUntil(
      () => fixture.events.some((event) => event.type === 'namespace-failed'),
      'throw 结算',
    );
    const error = ofType(fixture.events, 'namespace-error')[0]!;
    const failed = ofType(fixture.events, 'namespace-failed')[0]!;
    expect(error).toMatchObject({ code: 'INTERNAL_ERROR', direction: 'sent', namespaceId: NS_A });
    expect(failed).toMatchObject({ cause: 'open-failed', namespaceId: NS_A });
    assertSection23Shape(fixture.events, 'EM-C2b');
    connection.close(1001, 'test');
    await connection.settle();
  });

  it('EM-C2c（负控）：pre-connection `auth-upgrade-rejected` 无 connectionId（§23 既有形态；在场纪律非无条件加字段）', async () => {
    const fixture = makeFactory();
    await fixture.factory.accept(fixture.wire.hubEnd, { token: '' });
    await settle();
    const rejected = ofType(fixture.events, 'auth-upgrade-rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({ side: 'hub', reason: 'missing-token' });
    expect(Object.keys(rejected[0]!).sort()).toEqual(['reason', 'side', 'type']);
    expect(fixture.wire.closes).toEqual([{ code: 1008, reason: 'upgrade-unauthorized' }]);
    assertSection23Shape(fixture.events, 'EM-C2c');
  });
});

// ═══════════════════════════ EM-C3：缺面 dormant（AC2） ═══════════════════════════

describe('issue #423 EM-C3：缺面 dormant — session 侧 shim 无 bufferedAmount/clock/ping-onPong', () => {
  it('EM-C3a：shim 无 bufferedAmount → 发送失败事件该键**缺失**（非 0、非 undefined 值）', async () => {
    const fixture = await makeSessionHostFixture({ bufferedAmount: () => undefined });
    await fixture.write(43);
    const resync = ofType(fixture.stub.events, 'resync-required').filter(
      (event) => event.cause === 'send-failed',
    );
    expect(resync).toHaveLength(1);
    expect(resync[0]).toMatchObject({ reason: 'update-too-large', namespaceId: fixture.namespaceId });
    expect('bufferedAmount' in resync[0]!, 'EM-C3a: 缺面必须整键缺席').toBe(false);
    expect(fixture.stub.data).toEqual([]); // 超限项未上线（失败语义未变）
    assertSection23Shape(fixture.stub.events, 'EM-C3a');
  });

  it('EM-C3b（正控）：bufferedAmount 可观测 → 该键在场且为真实读数（0 与 12 两取值）', async () => {
    const zero = await makeSessionHostFixture({ bufferedAmount: () => 0 });
    await zero.write(43);
    const zeroEvent = ofType(zero.stub.events, 'resync-required').filter(
      (event) => event.cause === 'send-failed',
    )[0]!;
    expect('bufferedAmount' in zeroEvent).toBe(true);
    expect(zeroEvent.bufferedAmount).toBe(0); // 0 是真实读数，不得折叠为「缺面」

    const nonZero = await makeSessionHostFixture({ bufferedAmount: () => 12 });
    await nonZero.write(43);
    const nonZeroEvent = ofType(nonZero.stub.events, 'resync-required').filter(
      (event) => event.cause === 'send-failed',
    )[0]!;
    expect(nonZeroEvent.bufferedAmount).toBe(12);
    assertSection23Shape(nonZero.stub.events, 'EM-C3b');
  });

  it('EM-C3c：缺 clock → 出站 sequence 事件无 sendQueueMs（§23.4 整键缺席；正控 = EM-C4c clock 在场键在场）', async () => {
    const events: ReplicationObserverEvent[] = [];
    const run = await boot({ hubObserver: (event) => events.push(event) });
    await settle();
    events.length = 0;
    await run.writeHub({ n: 42 });
    await settle();
    await settle();
    const sent = updateSentEvents(events);
    expect(sent).toHaveLength(1); // 场景确实触达出站 sequence 事件面（非空断言）
    expect(
      'sendQueueMs' in sent[0]!,
      'EM-C3c: clock 缺面 ⇒ 差值字段整键缺席（非 0 / 非 undefined 值）',
    ).toBe(false);
    const hasUpdate = run.wire.hubToPeer.some(
      (bytes) => decodeMessage(bytes).message.kind === 'UPDATE',
    );
    expect(hasUpdate).toBe(true); // wire 面未被观测面折损
    await run.hub.close();
    await run.peer.stop().catch(() => undefined);
  });

  it('EM-C3d：无 ping/onPong 面（session 侧无 liveness）→ 全生命周期零 event-loop-delay-sampled', async () => {
    const fixture = await makeSessionHostFixture(
      {},
      { maxUpdateBytes: 8_192, maxQueuedUpdateBytes: 32_768 },
    );
    await fixture.write(43);
    expect(fixture.stub.events.length).toBeGreaterThan(0);
    expect(
      fixture.stub.events.some((event) => event.type === 'event-loop-delay-sampled'),
      'EM-C3d: session 侧无 ping/onPong 面 ⇒ liveness 采样休眠（零事件、非 0 值字段）',
    ).toBe(false);
    expect(fixture.stub.data, 'EM-C3d: 场景确实驱动了 data 出站').toHaveLength(1);
  });
});

// ═══════════════════════════ EM-C4：出站 sequence 事件（AC1） ═══════════════════════════

describe('issue #423 EM-C4：出站 sequence 事件（update-sent）由 edge 盖章点发射', () => {
  it('EM-C4a：工厂形态 host 数据帧 → edge 恰一 update-sent（sequence = 盖章序、bytes = UPDATE 载荷长度）', async () => {
    const fixture = makeFactory({
      resolveSessionSink: () => makeHostSink(),
      authorize: () => Promise.resolve(AUTHORIZED),
      clock: new ManualClock(),
    });
    const connection = await connect(fixture);
    fixture.wire.inject(helloFrame(1));
    await settle();
    fixture.wire.inject(openFrame(NS_A, 2));
    await settleUntil(() => connection.namespaces.has(NS_A), '会话建立');
    const before = fixture.events.length;

    const stamped = connection.egress.sendDataFrame(placeholderUpdateFrame(NS_A, 23));
    await settle();
    expect(stamped).toBeGreaterThan(0);
    const wireUpdate = fixture.wire.outbound.filter(
      (bytes) => decodeMessage(bytes).message.kind === 'UPDATE',
    );
    expect(wireUpdate).toHaveLength(1);
    expect(rawSequence(wireUpdate[0]!)).toBe(stamped); // 盖章序 = wire `[8..12]`

    const sent = updateSentEvents(fixture.events.slice(before));
    expect(sent, 'EM-C4a: edge 盖章点必须发射恰一 update-sent').toHaveLength(1);
    const decoded = decodeMessage(wireUpdate[0]!).message;
    if (decoded.kind !== 'UPDATE') throw new Error('EM-C4a: UPDATE 形态断言失败');
    expect(sent[0]).toMatchObject({
      side: 'hub',
      connectionId: connection.connectionKey,
      namespaceId: NS_A,
      bytes: decoded.update.byteLength,
      sequence: stamped,
    });
    assertSection23Shape(sent, 'EM-C4a');

    // 负控：control 帧不得产出 update-sent（非「任何帧都发」）
    const afterData = updateSentEvents(fixture.events).length;
    connection.egress.sendControlFrame(openOkFrame(NS_A));
    await settle();
    expect(updateSentEvents(fixture.events).length).toBe(afterData);
    connection.close(1001, 'test');
    await connection.settle();
  });

  it('EM-C4b：session 半边不再发射出站 sequence 事件（帧已出站，但 update-sent 不在 session 观测面）', async () => {
    const fixture = await makeSessionHostFixture(
      {},
      { maxUpdateBytes: 8_192, maxQueuedUpdateBytes: 32_768 },
    );
    await fixture.write(43);
    expect(fixture.stub.data, 'EM-C4b: 场景必须真出站 1 帧').toHaveLength(1);
    const sessionSent = updateSentEvents(fixture.stub.events);
    expect(
      sessionSent.map((event) => event.type),
      'EM-C4b: 出站 sequence 事件的发射侧 = edge（盖章事实所有者）；session 侧零发射',
    ).toEqual([]);
    // 注：`chunked-update-sent`（无 sequence 键，transfer 结算事实在 session 侧）不在本断言面；
    // 读法登记见报告 §11/§15（「update-sent 族」的作用域留给设计裁决）。
  });

  it('EM-C4c：listen 组合形态恰一 update-sent（无重复）、sequence == wire [8..12]、字段集 ⊆ §23', async () => {
    const events: ReplicationObserverEvent[] = [];
    const clock = new ManualClock();
    const run = await boot({ hubClock: clock, hubObserver: (event) => events.push(event) });
    await settle();
    events.length = 0;
    await run.writeHub({ n: 42 });
    clock.advance(500);
    await settle();
    await settle();
    const sent = updateSentEvents(events);
    expect(sent).toHaveLength(1);
    const wireUpdate = run.wire.hubToPeer.filter(
      (bytes) => decodeMessage(bytes).message.kind === 'UPDATE',
    );
    expect(wireUpdate).toHaveLength(1);
    expect(sent[0]!.sequence).toBe(rawSequence(wireUpdate[0]!));
    expect(sent[0]!.namespaceId).toBe(run.nsId);
    expect('sendQueueMs' in sent[0]!, 'EM-C4c: append-only 字段集——clock 在场时 sendQueueMs 保留').toBe(
      true,
    );
    assertSection23Shape(events, 'EM-C4c');
    await run.hub.close();
    await run.peer.stop().catch(() => undefined);
  });
});

// ═══════════════════════════ EM-C5：observer throw 隔离（AC4） ═══════════════════════════

describe('issue #423 EM-C5：observer throw 隔离（dispatchReplicationObserver 单点语义）', () => {
  it('EM-C5a：edge 公共出面——全抛 observer 下 wire 逐帧等于健康 observer 运行、连接存活、零 unhandledRejection', async () => {
    const unhandled = collectUnhandledRejections();
    try {
      const drive = async (
        throwing: boolean,
      ): Promise<Readonly<{ frames: string[]; closes: Array<{ code: number; reason: string }>; states: string[] }>> => {
        const observed: ReplicationObserverEvent[] = [];
        const observer: ReplicationObserver = (event) => {
          if (throwing) throw new Error('SENTINEL-observer-throw');
          observed.push(event);
        };
        const fixture = makeFactory({
          observer,
          resolveSessionSink: () => makeHostSink(),
          authorize: () => Promise.resolve(AUTHORIZED),
        });
        const connection = await connect(fixture);
        fixture.wire.inject(helloFrame(1));
        await settle();
        fixture.wire.inject(openFrame(NS_A, 2));
        await settleUntil(() => connection.namespaces.has(NS_A), '会话建立');
        connection.egress.sendDataFrame(placeholderUpdateFrame(NS_A, 23));
        connection.egress.sendControlFrame(openOkFrame(NS_A));
        fixture.wire.inject(closeFrame(NS_A, 3));
        await settle();
        const result = {
          frames: fixture.wire.outbound.map(hexOf),
          closes: fixture.wire.closes.map((info) => ({ ...info })),
          states: observed.map((event) => event.type),
        };
        expect(connection.state).toBe('ready');
        connection.close(1001, 'test');
        await connection.settle();
        return result;
      };

      const healthy = await drive(false);
      const throwingRun = await drive(true);
      expect(throwingRun.frames).toEqual(healthy.frames); // 帧字节/序零影响
      expect(throwingRun.closes).toEqual(healthy.closes);
      expect(throwingRun.states).toEqual([]); // 抛错 sink 零事件交付（隔离=丢弃，非缓存重放）
      expect(healthy.states.length).toBeGreaterThan(0); // 场景确实产出事件（非空断言）
      await settle();
      expect(unhandled.events).toEqual([]);
    } finally {
      unhandled.dispose();
    }
  });

  it('EM-C5b：单体进程内组合——全抛 observer 下业务收敛不变、零 unhandledRejection', async () => {
    const unhandled = collectUnhandledRejections();
    try {
      const throwing: ReplicationObserver = () => {
        throw new Error('SENTINEL-observer-throw');
      };
      const clock = new ManualClock();
      const run = await boot({ hubObserver: throwing, hubClock: clock });
      await settle();
      await run.writeHub({ n: 42 });
      clock.advance(500);
      await settle();
      await settleUntil(() => run.rootValue('peer', 'n') === 42, 'peer 收敛');
      expect(run.peer.getNamespaceState(run.nsId)).toBe('live');
      const wireUpdate = run.wire.hubToPeer.filter(
        (bytes) => decodeMessage(bytes).message.kind === 'UPDATE',
      );
      expect(wireUpdate.length).toBeGreaterThan(0); // wire 面未被抛错 sink 改变
      await run.hub.close();
      await run.peer.stop().catch(() => undefined);
      await settle();
      expect(unhandled.events).toEqual([]);
    } finally {
      unhandled.dispose();
    }
  });
});

// ═══════════════════════════ EM-C6：listen 计数口径（AC5 回归锚） ═══════════════════════════

describe('issue #423 EM-C6：listen 模式 maxConcurrentAssembliesPerConnection 计数口径不变', () => {
  it('EM-C6a：listen 缝 = per-connection 跨 namespace 共享槽位（limit=2；释放后可再纳）', async () => {
    let captured: HubSessionEdgePort | undefined;
    const edge = createInternalEdge({
      transport: {
        send: () => undefined,
        close: () => undefined,
        closed: false,
        onMessage: () => () => undefined,
        onClose: () => () => undefined,
      },
      timer: makeFakeTimer().timer,
      limits: resolveLimits({ maxConcurrentAssembliesPerConnection: 2 }),
      timeouts: resolveTimeouts(undefined),
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
    const port = captured!;
    expect(port.tryBeginInboundAssembly(NS_A)).toBe(true);
    expect(port.tryBeginInboundAssembly(`ns-${'0'.repeat(31)}2`)).toBe(true);
    expect(
      port.tryBeginInboundAssembly(NS_C),
      'EM-C6a: 第 3 个 ns 超额（listen 口径 = per-connection 跨 ns 共享）',
    ).toBe(false);
    port.endInboundAssembly(NS_A);
    expect(port.tryBeginInboundAssembly(NS_C)).toBe(true);
    port.endInboundAssembly(NS_A); // 幂等（重复归还零副作用）
    expect(port.tryBeginInboundAssembly(`ns-${'0'.repeat(31)}4`)).toBe(false);
    edge.close(1001, 'test');
    await edge.settle();
  });

  it('EM-C6b（负控）：缺省 4 → 第 5 个 distinct ns 超额；槽位非 per-namespace 无限', async () => {
    let captured: HubSessionEdgePort | undefined;
    const edge = createInternalEdge({
      transport: {
        send: () => undefined,
        close: () => undefined,
        closed: false,
        onMessage: () => () => undefined,
        onClose: () => () => undefined,
      },
      timer: makeFakeTimer().timer,
      limits: resolveLimits(undefined),
      timeouts: resolveTimeouts(undefined),
      instanceId: HUB_INSTANCE,
      peerInstanceId: PEER_INSTANCE,
      connectionCounter: 1,
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
    const port = captured!;
    const admitted: boolean[] = [];
    for (let index = 1; index <= 5; index += 1) {
      admitted.push(port.tryBeginInboundAssembly(`ns-${'0'.repeat(31)}${index}`));
    }
    expect(admitted).toEqual([true, true, true, true, false]);
    edge.close(1001, 'test');
    await edge.settle();
  });
});

// ═══════════════════════════ EM-C7：单体序列 == 拆分前金标（AC6） ═══════════════════════════

/**
 * 事件序列结构投影：型 + **精确键集** + 稳定字面量字段。数值测量（bytes / latency / count）
 * 有意排除——Yjs 载荷长度与 state vector digest 不跨进程可复现（随机 client id），其语义面
 * 由既有 wire/§23 锚定承载；本锚定针对 AC6 的「无重复 / 无缺失 / 无乱序 + 字段集」。
 */
const GOLDEN_KEEP: readonly string[] = [
  'side',
  'connectionId',
  'namespaceId',
  'from',
  'to',
  'code',
  'direction',
  'terminalState',
  'channelState',
  'connectionState',
  'cause',
  'reason',
  'reasonCode',
  'via',
  'attempt',
  'wsCloseCode',
  'sequence',
  'syncRoundId',
  'transferId',
  'chunkCount',
  'receivedChunks',
  'applyEffect',
  'stateVectorChanged',
];

function structuralSequence(events: readonly ReplicationObserverEvent[]): string[] {
  return events.map((event) => {
    const record = event as unknown as Record<string, unknown>;
    const keys = Object.keys(event).sort().join(',');
    const kept = GOLDEN_KEEP.filter((key) => record[key] !== undefined)
      .map((key) => `${key}=${String(record[key])}`)
      .join(';');
    return `${event.type}|${keys}|${kept}`;
  });
}

/** 拆分前金标（提交 `e9cd7eb` = 拆分提交 `1278fd3` 的父提交；worktree 实跑采集）。 */
const PRE_SPLIT_LIVE_GOLDEN: readonly string[] = [
  'connection-state-changed|connectionId,from,side,to,type|side=hub;connectionId=hub-omega-conn-0;from=handshaking;to=ready',
  'channel-state-changed|connectionId,from,namespaceId,side,to,type|side=hub;connectionId=hub-omega-conn-0;namespaceId=ns-00000000000000000000000000000001;from=opening;to=bootstrapping',
  'bootstrap-snapshot-sent|bytes,connectionId,namespaceId,side,type|side=hub;connectionId=hub-omega-conn-0;namespaceId=ns-00000000000000000000000000000001',
  'channel-state-changed|connectionId,from,namespaceId,side,to,type|side=hub;connectionId=hub-omega-conn-0;namespaceId=ns-00000000000000000000000000000001;from=bootstrapping;to=reconciling',
  'sync-step2-sent|bytes,connectionId,encodedUpdateBytes,namespaceId,side,syncRoundId,type|side=hub;connectionId=hub-omega-conn-0;namespaceId=ns-00000000000000000000000000000001;syncRoundId=1',
  'sync-diff-applied|applyEffect,applyLatencyMs,bytes,connectionId,encodedUpdateBytes,namespaceId,sequence,side,stateVectorAfterHash,stateVectorBeforeHash,stateVectorChanged,syncRoundId,type|side=hub;connectionId=hub-omega-conn-0;namespaceId=ns-00000000000000000000000000000001;sequence=5;syncRoundId=1;applyEffect=noop;stateVectorChanged=false',
  'channel-state-changed|connectionId,from,namespaceId,side,to,type|side=hub;connectionId=hub-omega-conn-0;namespaceId=ns-00000000000000000000000000000001;from=reconciling;to=live',
  'update-sent|bytes,connectionId,namespaceId,sendQueueMs,sequence,side,type|side=hub;connectionId=hub-omega-conn-0;namespaceId=ns-00000000000000000000000000000001;sequence=7',
  'update-acked|ackLatencyMs,bytes,connectionId,namespaceId,sequence,side,type|side=hub;connectionId=hub-omega-conn-0;namespaceId=ns-00000000000000000000000000000001;sequence=7',
  'update-applied|applyLatencyMs,bytes,connectionId,namespaceId,sequence,side,type|side=hub;connectionId=hub-omega-conn-0;namespaceId=ns-00000000000000000000000000000001;sequence=8',
];

const PRE_SPLIT_DENIED_GOLDEN: readonly string[] = [
  'connection-state-changed|connectionId,from,side,to,type|side=hub;connectionId=hub-omega-conn-0;from=handshaking;to=ready',
  'namespace-error|code,connectionId,direction,namespaceId,side,type|side=hub;connectionId=hub-omega-conn-0;namespaceId=ns-00000000000000000000000000000001;code=NAMESPACE_UNAUTHORIZED;direction=sent',
  'channel-state-changed|connectionId,from,namespaceId,side,to,type|side=hub;connectionId=hub-omega-conn-0;namespaceId=ns-00000000000000000000000000000001;from=opening;to=failed',
  'namespace-failed|cause,connectionId,namespaceId,side,type|side=hub;connectionId=hub-omega-conn-0;namespaceId=ns-00000000000000000000000000000001;cause=open-failed',
];

describe('issue #423 EM-C7：单体进程内组合事件序列 == 拆分前金标（AC6）', () => {
  it('EM-C7a：live 全序列逐字相等（handshake→open→bootstrap→reconcile→live→双向写）', async () => {
    const events: ReplicationObserverEvent[] = [];
    const clock = new ManualClock();
    const run = await boot({ hubClock: clock, hubObserver: (event) => events.push(event) });
    await settle();
    await run.writeHub({ n: 42 });
    clock.advance(500);
    await settle();
    await settle();
    await run.writePeer({ n: 43 });
    clock.advance(500);
    await settle();
    await settle();
    const actual = structuralSequence(events);
    expect(actual).toEqual([...PRE_SPLIT_LIVE_GOLDEN]);
    // 显式重述 AC6 三性质（无重复 / 无缺失 / 无乱序）
    expect(new Set(actual).size).toBe(actual.length); // 逐项唯一（无重复）
    expect(actual.length).toBe(PRE_SPLIT_LIVE_GOLDEN.length); // 无缺失
    await run.hub.close();
    await settle();
    await run.peer.stop().catch(() => undefined);
    await settle();
  });

  it('EM-C7b：拒绝臂全序列逐字相等（连接域 + 拒绝路径四事件）', async () => {
    const events: ReplicationObserverEvent[] = [];
    const clock = new ManualClock();
    const run = await boot({
      authorize: { deny: ['*'] },
      waitFor: 'none',
      hubClock: clock,
      hubObserver: (event) => events.push(event),
    });
    await settle();
    await settle();
    const actual = structuralSequence(events);
    expect(actual).toEqual([...PRE_SPLIT_DENIED_GOLDEN]);
    await run.hub.close();
    await settle();
    await run.peer.stop().catch(() => undefined);
    await settle();
  });
});
