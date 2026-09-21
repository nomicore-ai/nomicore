/**
 * issue #418 C0a~C0d ——**结构契约白盒证据**（SA6 §12.1；设计 §7 D1/D2/D5）。
 *
 * AC1 要求「连接级/namespace 级状态机成为两个**可独立实例化**的内部模块，单体 = 两者的
 * 进程内组合」，且本票**零新公共 API** ⇒ 两半只能是内部模块（既有先例：测试直接相对
 * 导入 `../src/frame-io.js` / `../src/hub-namespace.js`）。本文件按设计 D1 落定的命名与
 * 工厂签名交付可执行白盒判据：
 *
 *   C0a  `createHubReplicationEdge` 单独实例化：注入 transport 桩 + **stub session sink**
 *        （脚本化回 OPEN_OK）+ 注入 authorize 桩——**无 Registry、无 hub 服务**。判据 =
 *        HELLO_ACK / OPEN_OK 全帧 hex 与 SA6 冻结金标逐字节相等、raw `[8..12]` 恒 1..N、
 *        OPEN 准入结局（`HubOpenAdmission`）经缝传递、authorize 恰一次。
 *   C0b  `createHubSessionHost` 单独实例化：注入 **stub edge port**（记录占位帧、返回递增
 *        序号、闸门恒开）+ 真实 Registry/Runtime fixture。判据 = OPEN_OK → BOOTSTRAP_SNAPSHOT
 *        → SYNC_STEP1/2 → SYNC_APPLIED → CLOSE_OK 全生命周期走通；失败 admission（denied/
 *        throw）臂由**真实零 diff 通道**产出 ns ERROR + 事件族 + settled 且 `registry.open`
 *        零调用；**投影缺失**臂响亮（INTERNAL_ERROR ns ERROR，非静默）；占位帧字节内
 *        `[8..12] == 0`（edge 盖章职责待行）。
 *   C0c  组合根结构面：`hub-connection` 模块运行时导出面不变；两工厂与缝类型**仅模块级**
 *        导出（不进 `index.ts`/`testing.ts`——C5a 冻结面由既有契约文件锚定）；单体
 *        `acceptTrusted` 产物暴露 edge 面（`settle`/`beginReauth`/`revokeNamespace`）——
 *        单体 = 进程内组合（无「单体分支 vs 拆分分支」双实现）。
 *   C0d  缝纪律：edge→session 投递序列只含 namespace 域帧 + 4 控制信号（无 HELLO/HELLO_ACK/
 *        GOAWAY/连接级 ERROR）；`openNamespace` 必先于该 ns 的任何 `namespaceFrame`
 *        （sunk ⇒ session 通道在场的缝上投影，SA2 N1）。
 *
 * 纪律：断言 = 运行时行为 + wire 原字节；零源码 grep/字符串断言；零 skip/only/todo；
 * 零 mock 被测对象（stub 只在**缝的另一侧**，被测半边为真实生产实现）。
 */
import { describe, expect, it } from 'vitest';
import { decodeMessage, encodeMessage } from '@nomicore/replication-protocol';
import type { ReplicationMessage } from '@nomicore/replication-protocol';
import { createRegistryTestScheduler } from '@nomicore/namespace-registry/testing';
import * as hubConnectionModule from '../src/hub-connection.js';
import * as edgeModule from '../src/hub-edge.js';
import * as sessionModule from '../src/hub-session.js';
import * as splitModule from '../src/hub-split.js';
import { createHubReplicationEdge } from '../src/hub-edge.js';
import { createHubSessionHost } from '../src/hub-session.js';
import { HubNamespaceChannel } from '../src/hub-namespace.js';
import type {
  HubOpenAdmission,
  HubSessionEdgePort,
  HubSessionSink,
  OpenNamespaceInbound,
} from '../src/hub-split.js';
import { createHubReplication } from '../src/index.js';
import { resolveLimits, resolveTimeouts } from '../src/defaults.js';
import { DEFAULT_PEER_VERIFIER } from './driver.js';
import {
  HUB_INSTANCE,
  HUB_OWNER,
  PEER_INSTANCE,
  makeHubNamespace,
  makeNode,
  settle,
  settleUntil,
} from './harness.js';
import type {
  DuplexTransport,
  NamespaceAuthorization,
  ReplicationObserverEvent,
} from '@nomicore/ws-replication';

// ═══════════════════════════ 工具 ═══════════════════════════

function rawSequence(bytes: Uint8Array): number {
  return (((bytes[8]! << 24) | (bytes[9]! << 16) | (bytes[10]! << 8) | bytes[11]!) >>> 0);
}

function hexOf(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

const FROZEN_HELLO_ACK_HEX =
  '4e4d435201020000000000010000003100000000096875622d6f6d65676101000000001080808080808080808080808080808080106875622d6f6d6567612d636f6e6e2d30';
const FROZEN_OPEN_OK_HEX =
  '4e4d435201110000000000020000004700000000236e732d30303030303030303030303030303030303030303030303030303030303030310020303030303030303030303030303030303030303030303030303030303030303201';

const HELLO_NONCE = new Uint8Array(16).fill(0x80);

const AUTHORIZED: Extract<NamespaceAuthorization, { ok: true }> = {
  ok: true,
  localOwner: HUB_OWNER,
  permissions: { read: true, submit: true },
};

function helloMessage(): ReplicationMessage {
  return {
    kind: 'HELLO',
    peerInstanceId: PEER_INSTANCE,
    expectedHubInstanceId: HUB_INSTANCE,
    protocolVersions: [1],
    requiredCapabilities: 0,
    optionalCapabilities: 0,
    connectionNonce: HELLO_NONCE,
  };
}

/** 记录型 duplex transport（交给 edge 的端）：出站记录、入站由测试注入。 */
function makeEdgeTransport(): {
  readonly end: DuplexTransport;
  frames(): readonly Uint8Array[];
  send(bytes: Uint8Array): void;
  closeInfo(): Readonly<{ code: number; reason: string }> | undefined;
} {
  const messageListeners = new Set<(bytes: Uint8Array) => void>();
  const frames: Uint8Array[] = [];
  let closed = false;
  let closeInfo: Readonly<{ code: number; reason: string }> | undefined;
  const end: DuplexTransport = {
    send(bytes) {
      if (closed) return;
      frames.push(bytes.slice());
    },
    close(code = 1000, reason = '') {
      if (closed) return;
      closed = true;
      closeInfo = { code, reason };
    },
    get closed() {
      return closed;
    },
    onMessage(listener) {
      messageListeners.add(listener);
      return () => messageListeners.delete(listener);
    },
    onClose() {
      return () => undefined;
    },
  };
  return {
    end,
    frames: () => frames,
    send(bytes) {
      const copy = bytes.slice();
      queueMicrotask(() => {
        for (const listener of [...messageListeners]) listener(copy);
      });
    },
    closeInfo: () => closeInfo,
  };
}

function openOkFrame(namespaceId: string): ReplicationMessage {
  return {
    kind: 'OPEN_OK',
    namespaceId,
    mode: 0,
    replicationId: `${'0'.repeat(31)}2`,
    replicationEpoch: 1,
  };
}

// ═══════════════════════════ C0a：edge 独立实例化 ═══════════════════════════

interface ScriptedSink {
  readonly sink: HubSessionSink;
  readonly opens: Array<{ message: OpenNamespaceInbound }>;
  /** `port.openAdmission(nsId)` 拉取结果（拉取形态锚：结局不经投递参数传递）。 */
  readonly pulls: Array<{ namespaceId: string; admission: HubOpenAdmission }>;
  readonly frames: Array<{ kind: string; sequence: number }>;
  readonly terminates: string[];
  /** sink 侧通道表（delivered ⇒ 通道在场：到达点锁步断言用）。 */
  readonly channels: Map<string, HubNamespaceChannel>;
  closeCount(): number;
}

/** 手动结算的 authorize 门闩（到达点断言：投递必须发生在结局产出**之前**）。 */
function deferredAuthorization(): {
  readonly promise: Promise<NamespaceAuthorization>;
  resolve(authorization: NamespaceAuthorization): void;
} {
  let resolve: (authorization: NamespaceAuthorization) => void = () => undefined;
  const promise = new Promise<NamespaceAuthorization>((inner) => {
    resolve = inner;
  });
  return { promise, resolve };
}

/**
 * 脚本化 session sink：**到达点**记录 `openNamespace(message)`（无 admission 参数），随后按
 * D5.3 shim 形态经 `port.openAdmission(nsId)` **拉取**结局；结局为 authorized 且脚本要求时
 * 回 OPEN_OK（经 port 占位编码 + edge 盖章）。
 */
function makeScriptedSink(port: HubSessionEdgePort, opts: { respondOpenOk: boolean }): ScriptedSink {
  const opens: ScriptedSink['opens'] = [];
  const pulls: ScriptedSink['pulls'] = [];
  const frames: ScriptedSink['frames'] = [];
  const terminates: string[] = [];
  const channels = new Map<string, HubNamespaceChannel>();
  let closes = 0;
  const sink: HubSessionSink = {
    openNamespace(message) {
      opens.push({ message });
      channels.set(
        message.namespaceId,
        { namespaceId: message.namespaceId } as unknown as HubNamespaceChannel,
      );
      void port.openAdmission(message.namespaceId).then((admission) => {
        pulls.push({ namespaceId: message.namespaceId, admission });
        if (opts.respondOpenOk && admission.outcome === 'authorized') {
          port.sendControlFrame(encodeMessage(openOkFrame(message.namespaceId), { sequence: 0 }));
        }
      });
    },
    namespaceFrame(message, sequence) {
      frames.push({ kind: message.kind, sequence });
    },
    async close() {
      closes += 1;
    },
    async terminateNamespace(namespaceId) {
      // ≈ session 侧 `channels.get(nsId)?.terminateUnauthorized()`：无通道 → 无副作用 resolve
      if (channels.has(namespaceId)) terminates.push(namespaceId);
    },
    dataFacetOf() {
      return undefined;
    },
    channels,
  };
  return { sink, opens, pulls, frames, terminates, channels, closeCount: () => closes };
}

describe('C0a（AC1）：edge 半边可独立实例化（无 Registry / 无 hub 服务）', () => {
  it('C0a：到达点投递（authorize 未结算）→ 拉取 authorized → 全帧 hex == SA6 冻结金标；raw [8..12] == 1..N；authorize 恰一次', async () => {
    const transport = makeEdgeTransport();
    const calls: Array<Readonly<{ instanceIdentity: string; namespaceId: string }>> = [];
    const latched = deferredAuthorization();
    let scripted: ScriptedSink | undefined;
    const edge = createHubReplicationEdge({
      transport: transport.end,
      timer: createRegistryTestScheduler(),
      limits: resolveLimits(undefined),
      timeouts: resolveTimeouts(undefined),
      instanceId: HUB_INSTANCE,
      peerInstanceId: PEER_INSTANCE,
      connectionCounter: 0,
      authorize: (instanceIdentity, namespaceId) => {
        calls.push({ instanceIdentity, namespaceId });
        return latched.promise;
      },
      earlyFrames: [],
      sessionFactory: (port) => {
        scripted = makeScriptedSink(port, { respondOpenOk: true });
        return scripted.sink;
      },
      onConnectionDropped: () => undefined,
    });
    expect(edge.state).toBe('handshaking');
    expect(edge.peerInstanceId).toBeUndefined();
    expect(edge.authenticatedInstanceId).toBe(PEER_INSTANCE);

    transport.send(encodeMessage(helloMessage(), { sequence: 1 }));
    await settle();
    expect(edge.state).toBe('ready');
    expect(edge.peerInstanceId).toBe(PEER_INSTANCE);

    const namespaceId = `ns-${'0'.repeat(31)}1`;
    transport.send(
      encodeMessage({ kind: 'OPEN_NAMESPACE', namespaceId, hasLocalReplica: false }, { sequence: 2 }),
    );
    await settle();
    // ── 到达点（D5.1）：authorize 仍在途，stub sink 已收到 OPEN（无 admission 参数），
    //    且通道已在场（delivered ⇒ 通道在场）；结局只能经 port 拉取 ──
    expect(calls).toEqual([{ instanceIdentity: PEER_INSTANCE, namespaceId }]);
    expect(scripted!.opens).toEqual([
      { message: { kind: 'OPEN_NAMESPACE', namespaceId, hasLocalReplica: false } },
    ]);
    expect(scripted!.channels.has(namespaceId)).toBe(true);
    expect(scripted!.pulls).toEqual([]); // 结局未产出 → 拉取仍 pending
    expect(transport.frames().map((bytes) => decodeMessage(bytes).message.kind)).toEqual(['HELLO_ACK']);

    latched.resolve(AUTHORIZED);
    await settleUntil(() => transport.frames().length >= 2, 'edge OPEN_OK 出站');

    const frames = transport.frames();
    expect(hexOf(frames[0]!)).toBe(FROZEN_HELLO_ACK_HEX);
    expect(hexOf(frames[1]!)).toBe(FROZEN_OPEN_OK_HEX);
    expect(frames.map(rawSequence)).toEqual([1, 2]);
    expect(decodeMessage(frames[1]!).message).toEqual(openOkFrame(namespaceId));
    // 拉取面（D5.3）：结局以纯 JSON 过缝、形态 = edge 结算投影
    expect(scripted!.pulls).toEqual([
      { namespaceId, admission: { outcome: 'authorized', authorization: AUTHORIZED } },
    ]);
    expect(calls).toEqual([{ instanceIdentity: PEER_INSTANCE, namespaceId }]);

    edge.close(1001, 'test');
    await edge.settle();
  }, 60_000);

  it('C0a-负控：deny 授权器 → 到达点投递 + 拉取得 denied（零 OPEN_OK），authorize 恰一次', async () => {
    const transport = makeEdgeTransport();
    const calls: string[] = [];
    let scripted: ScriptedSink | undefined;
    const edge = createHubReplicationEdge({
      transport: transport.end,
      timer: createRegistryTestScheduler(),
      limits: resolveLimits(undefined),
      timeouts: resolveTimeouts(undefined),
      instanceId: HUB_INSTANCE,
      peerInstanceId: PEER_INSTANCE,
      connectionCounter: 1,
      authorize: (_instanceIdentity, namespaceId) => {
        calls.push(namespaceId);
        return Promise.resolve({ ok: false });
      },
      earlyFrames: [],
      sessionFactory: (port) => {
        scripted = makeScriptedSink(port, { respondOpenOk: false });
        return scripted.sink;
      },
      onConnectionDropped: () => undefined,
    });
    transport.send(encodeMessage(helloMessage(), { sequence: 1 }));
    await settle();
    const namespaceId = `ns-${'0'.repeat(31)}2`;
    transport.send(
      encodeMessage({ kind: 'OPEN_NAMESPACE', namespaceId, hasLocalReplica: false }, { sequence: 2 }),
    );
    await settleUntil(() => scripted!.pulls.length === 1, 'deny admission 拉取');
    expect(scripted!.opens).toHaveLength(1); // 到达点投递与结局无关
    expect(scripted!.pulls[0]).toEqual({ namespaceId, admission: { outcome: 'denied' } });
    // 零 diff 通道的失败面由 session 半边产出（桩未回帧 ⇒ wire 上仅 HELLO_ACK）
    expect(transport.frames().map((bytes) => decodeMessage(bytes).message.kind)).toEqual(['HELLO_ACK']);
    expect(calls).toEqual([namespaceId]);
    edge.close(1001, 'test');
    await edge.settle();
  }, 60_000);
});

// ═══════════════════════════ C0b：session 独立实例化 ═══════════════════════════

interface StubPort {
  readonly port: HubSessionEdgePort;
  readonly control: Uint8Array[];
  readonly data: Uint8Array[];
  readonly entries: Array<{ kind: string; channel: 'control' | 'data'; sequence: number }>;
  readonly fatal: Array<{ code: string; wsCloseCode: number | undefined }>;
  readonly settled: string[];
  readonly events: ReplicationObserverEvent[];
  /** `openAdmission` 拉取次数（shim 唯一授权入口）。 */
  readonly admissionPulls: string[];
}

/** stub port 的 `openAdmission` 脚本：四形态臂（ok / denied / throw / reject）。 */
type StubAdmissionScript =
  | { readonly kind: 'resolve'; readonly admission: HubOpenAdmission }
  | { readonly kind: 'reject' };

/** 缺省脚本 = reject（台账缺失不变量破坏臂：shim 必须响亮 INTERNAL_ERROR）。 */
function makeStubPort(admissionScript?: StubAdmissionScript): StubPort {
  let sequence = 0;
  const control: Uint8Array[] = [];
  const data: Uint8Array[] = [];
  const entries: StubPort['entries'] = [];
  const fatal: StubPort['fatal'] = [];
  const settled: string[] = [];
  const events: ReplicationObserverEvent[] = [];
  const admissionPulls: string[] = [];
  const port: HubSessionEdgePort = {
    openAdmission(namespaceId) {
      admissionPulls.push(namespaceId);
      if (admissionScript === undefined || admissionScript.kind === 'reject') {
        return Promise.reject(new Error('stub: open admission record missing'));
      }
      return Promise.resolve(admissionScript.admission);
    },
    sendControlFrame(frame) {
      control.push(frame);
      sequence += 1;
      entries.push({ kind: decodeMessage(frame).message.kind, channel: 'control', sequence });
      return sequence;
    },
    sendDataFrame(frame) {
      data.push(frame);
      sequence += 1;
      entries.push({ kind: decodeMessage(frame).message.kind, channel: 'data', sequence });
      return sequence;
    },
    dataGateOpen: () => true,
    onDataQueued: () => undefined,
    requestDataDrain: () => undefined,
    chunkedUpdateNegotiated: () => false,
    connectionFatal: (code, wsCloseCode) => {
      fatal.push({ code, wsCloseCode });
    },
    onChannelSettled: (namespaceId) => {
      settled.push(namespaceId);
    },
    tryBeginInboundAssembly: () => true,
    endInboundAssembly: () => undefined,
    observerPresent: () => true,
    emitObserver: (event) => {
      events.push(event);
    },
    connectionId: () => 'stub-conn-0',
    connectionState: () => 'ready',
    bufferedAmount: () => 0,
    now: () => 0,
  };
  return { port, control, data, entries, fatal, settled, events, admissionPulls };
}

function kindsOfFrames(frames: readonly Uint8Array[]): string[] {
  return frames.map((bytes) => decodeMessage(bytes).message.kind);
}

function openMessage(namespaceId: string): OpenNamespaceInbound {
  return { kind: 'OPEN_NAMESPACE', namespaceId, hasLocalReplica: false };
}

describe('C0b（AC1/AC3）：session 半边可独立实例化（stub edge port + 真实 Registry/Runtime）', () => {
  it('C0b：OPEN_OK → BOOTSTRAP_SNAPSHOT → SYNC_STEP2 → SYNC_APPLIED → CLOSE_OK 全生命周期', async () => {
    const node = makeNode('hub');
    const fixture = await makeHubNamespace(node);
    const stub = makeStubPort({
      kind: 'resolve',
      admission: { outcome: 'authorized', authorization: AUTHORIZED },
    });
    const host = createHubSessionHost({
      port: stub.port,
      registry: node.registry,
      instanceId: HUB_INSTANCE,
      peerInstanceId: PEER_INSTANCE,
      timer: node.scheduler,
      limits: resolveLimits(undefined),
      timeouts: resolveTimeouts(undefined),
    });

    host.openNamespace(openMessage(fixture.namespaceId));
    await settleUntil(() => kindsOfFrames(stub.control).includes('BOOTSTRAP_SNAPSHOT'), 'OPEN_OK + 快照');
    expect(stub.admissionPulls).toEqual([fixture.namespaceId]); // shim 唯一授权入口 = port 拉取
    expect(kindsOfFrames(stub.control)).toEqual(['OPEN_OK', 'BOOTSTRAP_SNAPSHOT']);
    // 占位编码：session 侧帧字节 [8..12] == 0（edge 盖章职责），返回序由 port 提供
    for (const frame of stub.control) expect(rawSequence(frame)).toBe(0);
    expect(stub.entries.map((entry) => entry.sequence)).toEqual([1, 2]);

    const snapshotSeq = stub.entries[1]!.sequence;
    host.namespaceFrame(
      { kind: 'BOOTSTRAP_ACK', namespaceId: fixture.namespaceId, ackedSequence: snapshotSeq },
      2,
    );
    await settle();
    expect(stub.events.filter((event) => event.type === 'channel-state-changed').at(-1)).toMatchObject({
      from: 'bootstrapping',
      to: 'reconciling',
    });

    host.namespaceFrame(
      {
        kind: 'SYNC_STEP1',
        namespaceId: fixture.namespaceId,
        syncRoundId: 1,
        stateVector: new Uint8Array([0]),
      },
      3,
    );
    await settleUntil(() => kindsOfFrames(stub.control).includes('SYNC_STEP2'), 'SYNC_STEP2 出站');
    const step1 = stub.entries.find((entry) => entry.kind === 'SYNC_STEP1')!;
    const step2 = stub.entries.find((entry) => entry.kind === 'SYNC_STEP2')!;
    const step2Message = decodeMessage(
      stub.control[stub.entries.findIndex((entry) => entry.kind === 'SYNC_STEP2')]!,
    ).message;
    if (step2Message.kind !== 'SYNC_STEP2') throw new Error('C0b: SYNC_STEP2 形态断言失败');
    // 对端 SYNC_STEP2（回指本端 Step1 序）→ 本端 apply → remoteDiffAppliedLocally
    host.namespaceFrame(
      {
        kind: 'SYNC_STEP2',
        namespaceId: fixture.namespaceId,
        syncRoundId: 1,
        relatedStep1Sequence: step1.sequence,
        update: step2Message.update,
      },
      4,
    );
    await settle();
    // 对端 SYNC_APPLIED（回指本端 Step2 序）→ localDiffAppliedByRemote → round 结算 → live
    host.namespaceFrame(
      {
        kind: 'SYNC_APPLIED',
        namespaceId: fixture.namespaceId,
        syncRoundId: 1,
        ackedSequence: step2.sequence,
      },
      5,
    );
    await settleUntil(
      () =>
        stub.events.some(
          (event) => event.type === 'channel-state-changed' && event.to === 'live',
        ),
      'reconcile → live',
    );

    host.namespaceFrame(
      { kind: 'CLOSE_NAMESPACE', namespaceId: fixture.namespaceId, reasonCode: 'peer-close' },
      6,
    );
    await settleUntil(() => kindsOfFrames(stub.control).includes('CLOSE_OK'), 'CLOSE_OK 出站');
    const closeOk = stub.control
      .map((frame) => decodeMessage(frame).message)
      .find((message) => message.kind === 'CLOSE_OK')!;
    expect(closeOk).toMatchObject({ ackedSequence: 6 });
    expect(stub.settled).toEqual([fixture.namespaceId]);
    expect(stub.fatal).toEqual([]);
    // 通道表唯一事实源在 session（sunk ⇒ 通道在场）
    expect(host.channels.get(fixture.namespaceId)).toBeInstanceOf(HubNamespaceChannel);
  }, 60_000);

  it('C0b-denied：denied 结局（port 拉取）→ 真实通道产出 NAMESPACE_UNAUTHORIZED + 3 事件 + settled，registry.open 零调用', async () => {
    const node = makeNode('hub');
    const fixture = await makeHubNamespace(node);
    let openCalls = 0;
    const registry = new Proxy(node.registry, {
      get(target, property, receiver) {
        if (property === 'open') {
          return (...args: unknown[]) => {
            openCalls += 1;
            return (target.open as (...inner: unknown[]) => unknown)(...args);
          };
        }
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? (value as (...inner: unknown[]) => unknown).bind(target) : value;
      },
    });
    const stub = makeStubPort({ kind: 'resolve', admission: { outcome: 'denied' } });
    const host = createHubSessionHost({
      port: stub.port,
      registry,
      instanceId: HUB_INSTANCE,
      peerInstanceId: PEER_INSTANCE,
      timer: node.scheduler,
      limits: resolveLimits(undefined),
      timeouts: resolveTimeouts(undefined),
    });
    host.openNamespace(openMessage(fixture.namespaceId));
    await settleUntil(() => stub.settled.length === 1, 'denied 结算');
    expect(kindsOfFrames(stub.control)).toEqual(['ERROR']);
    const error = decodeMessage(stub.control[0]!).message;
    expect(error).toMatchObject({
      kind: 'ERROR',
      code: 'NAMESPACE_UNAUTHORIZED',
      namespaceId: fixture.namespaceId,
    });
    expect(stub.events.map((event) => event.type)).toEqual([
      'namespace-error',
      'channel-state-changed',
      'namespace-failed',
    ]);
    expect(openCalls).toBe(0); // 被拒 ns 零会话资源唤起（SA8 §3 注 C 第 2 点）
  }, 60_000);

  it('C0b-throw：throw 结局（port 拉取）→ INTERNAL_ERROR（真实通道产出）+ 零 registry.open', async () => {
    const node = makeNode('hub');
    const fixture = await makeHubNamespace(node);
    let openCalls = 0;
    const registry = new Proxy(node.registry, {
      get(target, property, receiver) {
        if (property === 'open') {
          return (...args: unknown[]) => {
            openCalls += 1;
            return (target.open as (...inner: unknown[]) => unknown)(...args);
          };
        }
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? (value as (...inner: unknown[]) => unknown).bind(target) : value;
      },
    });
    const stub = makeStubPort({ kind: 'resolve', admission: { outcome: 'throw' } });
    const host = createHubSessionHost({
      port: stub.port,
      registry,
      instanceId: HUB_INSTANCE,
      peerInstanceId: PEER_INSTANCE,
      timer: node.scheduler,
      limits: resolveLimits(undefined),
      timeouts: resolveTimeouts(undefined),
    });
    host.openNamespace(openMessage(fixture.namespaceId));
    await settleUntil(() => stub.settled.length === 1, 'throw 结算');
    expect(decodeMessage(stub.control[0]!).message).toMatchObject({
      kind: 'ERROR',
      code: 'INTERNAL_ERROR',
      namespaceId: fixture.namespaceId,
    });
    expect(openCalls).toBe(0);
  }, 60_000);

  it('C0b-fail-loud：openAdmission reject（台账缺失/不变量破坏）→ shim 响亮 INTERNAL_ERROR，非静默', async () => {
    const node = makeNode('hub');
    const fixture = await makeHubNamespace(node);
    const stub = makeStubPort({ kind: 'reject' }); // 台账缺失：port 拉取 reject
    const host = createHubSessionHost({
      port: stub.port,
      registry: node.registry,
      instanceId: HUB_INSTANCE,
      peerInstanceId: PEER_INSTANCE,
      timer: node.scheduler,
      limits: resolveLimits(undefined),
      timeouts: resolveTimeouts(undefined),
    });
    host.openNamespace(openMessage(fixture.namespaceId));
    await settleUntil(() => stub.settled.length === 1, '缺失台账结算');
    expect(stub.admissionPulls).toEqual([fixture.namespaceId]);
    expect(kindsOfFrames(stub.control)).toEqual(['ERROR']);
    expect(decodeMessage(stub.control[0]!).message).toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(stub.events.some((event) => event.type === 'namespace-failed')).toBe(true);
  }, 60_000);
});

// ═══════════════════════════ C0c：组合根结构面 ═══════════════════════════

describe('C0c（AC1）：单体 = 进程内组合；两工厂仅模块级导出（零新公共 API）', () => {
  it('C0c：模块运行时导出面（组合根不新增导出；缝类型模块零运行时导出）', () => {
    expect(Object.keys(hubConnectionModule).sort()).toEqual(['createHubReplication']);
    expect(Object.keys(edgeModule).sort()).toEqual(['createHubReplicationEdge']);
    expect(Object.keys(sessionModule).sort()).toEqual(['createHubSessionHost']);
    expect(Object.keys(splitModule)).toEqual([]);
  });

  it('C0c：单体 acceptTrusted 产物暴露 edge 面（listen = edge + session 进程内组合）', async () => {
    const node = makeNode('hub');
    await makeHubNamespace(node);
    const hub = createHubReplication({
      instanceId: HUB_INSTANCE,
      registry: node.registry,
      authorize: () => Promise.resolve(AUTHORIZED),
      timer: node.scheduler,
      verifyToken: DEFAULT_PEER_VERIFIER,
    });
    const transport = makeEdgeTransport();
    const connection = await hub.acceptTrusted!(transport.end, { peerInstanceId: PEER_INSTANCE });
    expect(connection).toBeDefined();
    const edge = connection as unknown as Record<string, unknown>;
    expect(edge.authenticatedInstanceId).toBe(PEER_INSTANCE);
    expect(typeof edge.settle).toBe('function');
    expect(typeof edge.beginReauth).toBe('function');
    expect(typeof edge.revokeNamespace).toBe('function');
    expect(hub.connections).toHaveLength(1);
    await hub.close();
    await settle();
  }, 60_000);
});

// ═══════════════════════════ C0d：缝纪律 ═══════════════════════════

/** 不得经缝投递的 kind 集：连接级帧（HELLO/HELLO_ACK/GOAWAY/连接级 ERROR）与 hub→peer
 *  方向帧（OPEN_OK/BOOTSTRAP_SNAPSHOT/IDENTITY_CHANGED——session 出站面，非入站投递面）。 */
const FORBIDDEN_SEAM_KINDS = new Set([
  'HELLO',
  'HELLO_ACK',
  'GOAWAY',
  'OPEN_OK',
  'BOOTSTRAP_SNAPSHOT',
  'IDENTITY_CHANGED',
]);

describe('C0d（AC1/决策 2/5）：缝上只有 namespace 域帧 + 4 控制信号；到达点投递 ⟺ 通道在场', () => {
  it('C0d：投递序列无连接级 kind；到达点锁步（authorize 在途通道已在场）；未知 ns 合成；ERROR 未知 ns 静默；close/terminate 幂等', async () => {
    const transport = makeEdgeTransport();
    const calls: string[] = [];
    const latched = deferredAuthorization();
    let scripted: ScriptedSink | undefined;
    const edge = createHubReplicationEdge({
      transport: transport.end,
      timer: createRegistryTestScheduler(),
      limits: resolveLimits(undefined),
      timeouts: resolveTimeouts(undefined),
      instanceId: HUB_INSTANCE,
      peerInstanceId: PEER_INSTANCE,
      connectionCounter: 3,
      authorize: (_identity, namespaceId) => {
        calls.push(namespaceId);
        return latched.promise;
      },
      earlyFrames: [],
      sessionFactory: (port) => {
        scripted = makeScriptedSink(port, { respondOpenOk: false });
        return scripted.sink;
      },
      onConnectionDropped: () => undefined,
    });
    transport.send(encodeMessage(helloMessage(), { sequence: 1 }));
    await settle();
    const nsA = `ns-${'0'.repeat(31)}a`;
    const nsB = `ns-${'0'.repeat(31)}b`;

    // 未 OPEN 的 ns → edge 路由点合成（R-none：ns ERROR 帧 + 零缝投递）
    transport.send(
      encodeMessage({ kind: 'UPDATE_ACK', namespaceId: nsB, ackedSequence: 7 }, { sequence: 2 }),
    );
    await settle();
    expect(kindsOfFrames(transport.frames())).toEqual(['HELLO_ACK', 'ERROR']);
    expect(decodeMessage(transport.frames()[1]!).message).toMatchObject({
      kind: 'ERROR',
      code: 'NAMESPACE_STATE_VIOLATION',
      namespaceId: nsB,
    });
    expect(scripted!.frames).toEqual([]);

    // ERROR（未知 ns）→ 静默丢弃（零帧零投递）
    transport.send(
      encodeMessage(
        { kind: 'ERROR', code: 'NAMESPACE_STATE_VIOLATION', safeMessage: 'x', namespaceId: nsB },
        { sequence: 3 },
      ),
    );
    await settle();
    expect(kindsOfFrames(transport.frames())).toEqual(['HELLO_ACK', 'ERROR']);
    expect(scripted!.frames).toEqual([]);

    // OPEN（authorize 在途）→ **到达点**投递：stub sink 已收 + 通道在场（delivered ⇒ 在场）；
    // 结局未产出 ⇒ 拉取 pending、零出站帧（桩不回帧）
    transport.send(encodeMessage(openMessage(nsA), { sequence: 4 }));
    await settleUntil(() => scripted!.opens.length === 1, 'openNamespace 到达点投递');
    expect(calls).toEqual([nsA]); // 真实 authorize 在 edge 单点发起
    expect(scripted!.pulls).toEqual([]);
    expect(scripted!.channels.has(nsA)).toBe(true);
    expect(edge.channels.has(nsA)).toBe(true); // 台账命中 ⟺ 通道在场（锁步）
    expect(edge.channels.has(nsB)).toBe(false);
    expect(kindsOfFrames(transport.frames())).toEqual(['HELLO_ACK', 'ERROR']);

    // authorize 在途窗口内的 ns 域帧 → R-delivered 到达点投递（零缓冲）
    transport.send(
      encodeMessage({ kind: 'UPDATE', namespaceId: nsA, update: new Uint8Array([1]) }, { sequence: 5 }),
    );
    transport.send(
      encodeMessage({ kind: 'SYNC_STEP1', namespaceId: nsA, syncRoundId: 1, stateVector: new Uint8Array([0]) }, { sequence: 6 }),
    );
    transport.send(
      encodeMessage({ kind: 'BOOTSTRAP_ACK', namespaceId: nsA, ackedSequence: 1 }, { sequence: 7 }),
    );
    transport.send(
      encodeMessage({ kind: 'UPDATE_ACK', namespaceId: nsA, ackedSequence: 2 }, { sequence: 8 }),
    );
    transport.send(
      encodeMessage({ kind: 'CLOSE_NAMESPACE', namespaceId: nsA, reasonCode: 'peer-close' }, { sequence: 9 }),
    );
    await settle();
    expect(scripted!.frames).toEqual([
      { kind: 'UPDATE', sequence: 5 },
      { kind: 'SYNC_STEP1', sequence: 6 },
      { kind: 'BOOTSTRAP_ACK', sequence: 7 },
      { kind: 'UPDATE_ACK', sequence: 8 },
      { kind: 'CLOSE_NAMESPACE', sequence: 9 },
    ]);
    // 缝纪律：零连接级 kind；每个投递都在 openNamespace 之后（delivered ⇒ session 在场）
    for (const delivery of scripted!.frames) {
      expect(FORBIDDEN_SEAM_KINDS.has(delivery.kind)).toBe(false);
    }
    expect(scripted!.opens).toHaveLength(1);
    expect(edge.channels.get(nsA)).toBe(scripted!.channels.get(nsA));

    // 迟归结算（ok）：拉取结局可见；桩不回帧 ⇒ 零新帧（迟归传播不吞）
    latched.resolve(AUTHORIZED);
    await settleUntil(() => scripted!.pulls.length === 1, '迟归 admission 拉取');
    expect(scripted!.pulls[0]!.admission).toEqual({ outcome: 'authorized', authorization: AUTHORIZED });
    expect(kindsOfFrames(transport.frames())).toEqual(['HELLO_ACK', 'ERROR']);
    // ── 结构行为证明（C0d；SA2 N2' 优先行为证明而非源码扫描）：**结算段零回放** ——
    //    窗口帧在到达点已投递（无窗口日志缓冲、无二相 entry），迟归结算不重建通道、
    //    不重放任何投递（iteration 1 的「结算段回放」形态在此必然变红） ──
    expect(scripted!.opens).toHaveLength(1);
    expect(scripted!.frames.map((delivery) => delivery.sequence)).toEqual([5, 6, 7, 8, 9]);

    // 4 信号：terminateUnauthorized（在场通道）与 close（幂等）；无通道 ns → 无副作用
    await edge.revokeNamespace(nsA);
    expect(scripted!.terminates).toEqual([nsA]);
    await edge.revokeNamespace(`ns-${'0'.repeat(31)}c`); // 无通道 → no-op resolve（零副作用）
    expect(scripted!.terminates).toEqual([nsA]);
    edge.close(1001, 'test');
    edge.close(1001, 'test'); // 幂等
    await edge.settle();
    expect(scripted!.closeCount()).toBe(1);
    expect(transport.closeInfo()).toEqual({ code: 1001, reason: 'test' });
  }, 60_000);
});
