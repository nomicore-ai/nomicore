/**
 * SA6 验收/回归契约 — issue #418：`HubConnectionImpl` 拆分 Edge/SessionHost +
 * 单体进程内组合（ADR 0032 决策 1；spec #415 T2）。
 *
 * 任务类型 = **wide refactor**（派工明文：零新公共 API、零配置变化、wire 逐字节不变）
 * ⇒ 本文件是**回归/特征化契约**：基线在 HEAD 全绿，不伪称红灯（skill：Refactor 契约
 * 记录为何基线应为绿）。它把 #418 AC1~AC4 中**可在公共/内部运行时缝上观察**的部分钉死，
 * 供拆分实现（edge 半边 = envelope/sequence 纪律 + HELLO/capability + liveness +
 * GOAWAY/reauth + 连接级背压；session 半边 = 通道状态机 + Registry open + 出站编码）
 * 逐条保持：
 *
 *   C1  每连接**单点**出站 sequence 分配（edge 盖章）：raw `[8..12]` 自 1 严格 +1、
 *       连接级帧与 namespace 域帧共用同一序列、无 0 占位泄漏；会话记账序 == wire 序
 *       （peer 的 ackedSequence 回指）。
 *   C2  入站 expectedSeq 在 namespace 分派**之前**收口（edge 半边）：gap/repeat →
 *       连接级 `SEQUENCE_VIOLATION` + close(1002,'protocol-error')，零 authorize、
 *       零 namespace 副作用；正控 = 同帧正确序列 → OPEN_OK + authorize 恰一次。
 *   C3  wire 逐字节：非 Yjs 载荷帧（HELLO_ACK/OPEN_OK/UPDATE_ACK/ERROR/GOAWAY/CLOSE_OK）
 *      全帧 hex 钉值 + 全部帧的 envelope 头字节纪律（magic/version/flags/reserved/
 *      length 一致性）。Yjs 载荷帧（BOOTSTRAP_SNAPSHOT/SYNC_STEP1 等）的 payload 逐字节
 *      不可跨进程冻结（Yjs clientID 由库内部随机生成——见 SA6 报告 §15 边界记录），故按
 *      envelope + 解码语义锚定，绝不用 skip/软化。
 *   C4  路由键定偏移（ADR 0032 决策 4：edge O(帧头) demux 的字节前提）：namespace 域帧
 *      namespaceId 恒在 `[21..56]`（UPDATE_CHUNK 在 `[22..57]`）。
 *   C5  公共 API / 配置冻结：`@nomicore/ws-replication` 与 `/testing` 的运行时导出名集合、
 *      两个 Cordis 服务常量值、DEFAULT_* 三常量全值（零新公共 API、零配置变化）。
 *
 * 纪律：零源码 grep/字符串断言；零 mock 被测对象（真实 Registry/Runtime/HubReplication +
 * fake-duplex transport + fake scheduler）；断言 = 可观察运行时行为与 wire 原字节；
 * 不得 skip/only/todo、不得吞错或软化断言。
 *
 * C0（AC1「两个可独立实例化的内部模块」与 AC3「通道实现零改动」）是**结构契约**，
 * 其可执行形态依赖设计期确定的内部模块名/工厂签名（#418 明令零新公共 API ⇒ 不经
 * index/testing 导出面），因此不在本文件内以未定名字硬编码；验收口径见 SA6 报告 §12.1
 * （实现必须交付：edge 单独实例化 + stub session sink、session 单独实例化 + stub edge
 * host，两边共同复现本文件 C1~C6 的字节/序列事实）。
 */
import { describe, expect, it } from 'vitest';
import { decodeMessage, encodeMessage } from '@nomicore/replication-protocol';
import type { ReplicationMessage } from '@nomicore/replication-protocol';
import {
  DEFAULT_REPLICATION_BACKOFF,
  DEFAULT_REPLICATION_LIMITS,
  DEFAULT_REPLICATION_TIMEOUTS,
  NOMICORE_HUB_REPLICATION_SERVICE,
  NOMICORE_PEER_REPLICATION_SERVICE,
  createHubReplication,
} from '@nomicore/ws-replication';
import type { HubReplication } from '@nomicore/ws-replication';
import * as productionApi from '@nomicore/ws-replication';
import * as testingApi from '@nomicore/ws-replication/testing';
import { DEFAULT_PEER_VERIFIER, boot, makeAuthorizer } from './driver.js';
import type { AuthorizerSpy, Run } from './driver.js';
import {
  HUB_INSTANCE,
  PEER_INSTANCE,
  PEER_OWNER,
  makeHubNamespace,
  makeNode,
  makeWire,
  settle,
  settleUntil,
} from './harness.js';
import type { Wire } from './harness.js';

// ═══════════════════════════ 字节级工具（不经过 codec 读取 sequence/golden） ═══════════════

/** 直接读 wire 原字节 `[8..12]`（大端 uint32）——edge 盖章位置的唯一权威读数。 */
function rawSequence(bytes: Uint8Array): number {
  return (((bytes[8]! << 24) | (bytes[9]! << 16) | (bytes[10]! << 8) | bytes[11]!) >>> 0);
}

function rawPayloadLength(bytes: Uint8Array): number {
  return (((bytes[12]! << 24) | (bytes[13]! << 16) | (bytes[14]! << 8) | bytes[15]!) >>> 0);
}

function hexOf(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

function asciiAt(bytes: Uint8Array, start: number, end: number): string {
  return Buffer.from(bytes.subarray(start, end)).toString('utf8');
}

function kindsOf(frames: readonly Uint8Array[]): string[] {
  return frames.map((bytes) => decodeMessage(bytes).message.kind);
}

function namespaceIdOf(message: ReplicationMessage): string | undefined {
  return 'namespaceId' in message ? message.namespaceId : undefined;
}

function nonYjsHex(frames: readonly Uint8Array[]): string[] {
  return frames
    .filter((bytes) => {
      const kind = decodeMessage(bytes).message.kind;
      return kind === 'HELLO_ACK' || kind === 'OPEN_OK' || kind === 'UPDATE_ACK' || kind === 'CLOSE_OK';
    })
    .map(hexOf);
}

function messagesOf<K extends ReplicationMessage['kind']>(
  frames: readonly Uint8Array[],
  kind: K,
): Array<Extract<ReplicationMessage, { kind: K }>> {
  return frames
    .map((bytes) => decodeMessage(bytes).message)
    .filter((message): message is Extract<ReplicationMessage, { kind: K }> => message.kind === kind);
}

// ═══════════════════════════ 冻结金标（2026-09-21 于 HEAD 27e012b 采集） ═══════════════
// 采集方法：driver `boot({ random: () => 0.5 })`（peer 侧非确定性随机源固定；wire 原始
// 字节数组 `run.wire.hubToPeer`）与 hub-only fixture（`makeNode`/`makeHubNamespace` +
// `acceptTrusted` + `makeWire`）。已在独立进程重复采集 ≥3 次验证逐字节一致。

/** 单 namespace 场景 hub→peer 帧序（kind 与 raw sequence 一一对应 1..N）。
 *  `bytes: null` = Yjs 载荷帧（BOOTSTRAP_SNAPSHOT / SYNC_STEP1 的 payload 含库内部随机
 *  clientID ⇒ 跨进程长度可能 ±1，只锚定 envelope 与解码语义，不钉长度）。 */
const FROZEN_SINGLE_NS_PLAN = [
  { kind: 'HELLO_ACK', bytes: 69 },
  { kind: 'OPEN_OK', bytes: 91 },
  { kind: 'BOOTSTRAP_SNAPSHOT', bytes: null },
  { kind: 'SYNC_STEP1', bytes: null },
  { kind: 'SYNC_STEP2', bytes: 61 },
  { kind: 'SYNC_APPLIED', bytes: 58 },
  { kind: 'UPDATE_ACK', bytes: 57 },
] as const;

const FROZEN_HELLO_ACK_HEX =
  '4e4d435201020000000000010000003100000000096875622d6f6d65676101000000001080808080808080808080808080808080106875622d6f6d6567612d636f6e6e2d30';
const FROZEN_OPEN_OK_HEX =
  '4e4d435201110000000000020000004700000000236e732d30303030303030303030303030303030303030303030303030303030303030310020303030303030303030303030303030303030303030303030303030303030303201';
const FROZEN_UPDATE_ACK_HEX =
  '4e4d435201410000000000070000002500000000236e732d303030303030303030303030303030303030303030303030303030303030303107';
/** 入站 gap/repeat → 连接级 ERROR（scope 无 namespaceId）。 */
const FROZEN_SEQUENCE_VIOLATION_ERROR_HEX =
  '4e4d435201040000000000020000003b00000000001253455155454e43455f56494f4c4154494f4e010000002270726f746f636f6c206572726f723a2053455155454e43455f56494f4c4154494f4e';
/** reauth GOAWAY（握手+OPEN_OK 后第 4 帧；drainTimeoutMs = closeTimeoutMs 缺省 5000）。 */
const FROZEN_GOAWAY_HEX = '4e4d4352010300000000000400000013000000000f5245415554485f5245515549524544882700';
/** hub-only CLOSE_NAMESPACE(seq 3) → CLOSE_OK（ackedSequence = 3）。 */
const FROZEN_CLOSE_OK_HEX =
  '4e4d435201130000000000040000002500000000236e732d303030303030303030303030303030303030303030303030303030303030303103';

const FROZEN_PRODUCTION_EXPORTS = [
  'DEFAULT_REPLICATION_BACKOFF',
  'DEFAULT_REPLICATION_LIMITS',
  'DEFAULT_REPLICATION_TIMEOUTS',
  'NOMICORE_HUB_REPLICATION_SERVICE',
  'NOMICORE_PEER_REPLICATION_SERVICE',
  'createHubReplication',
  'createHubReplicationEdge',
  'createHubReplicationPlugin',
  'createPeerReplication',
  'createPeerReplicationPlugin',
  'requireHubReplication',
  'requirePeerReplication',
];
const FROZEN_TESTING_EXPORTS = [
  'createHubReplicationForTesting',
  'createMemoryDuplexTransport',
  'safeStateVector',
  'stateVectorBytesEqual',
  'stateVectorSafeDigest',
];

const FROZEN_LIMITS = {
  maxFrameBytes: 8 * 1024 * 1024,
  maxBootstrapBytes: 4 * 1024 * 1024,
  maxSyncDiffBytes: 2 * 1024 * 1024,
  maxUpdateBytes: 512 * 1024,
  maxQueuedUpdateBytes: 4 * 1024 * 1024,
  maxQueuedUpdateCount: 256,
  maxInFlightUpdates: 32,
  maxQueuedBytesPerConnection: 8 * 1024 * 1024,
  lowWater: 64 * 1024,
  highWater: 512 * 1024,
  maxQueuedControlBytes: 8 * 1024 * 1024,
  maxChunkedUpdateBytes: 4 * 1024 * 1024,
  maxChunksPerUpdate: 64,
  maxConcurrentAssembliesPerConnection: 4,
  maxChunkedBootstrapBytes: 4 * 1024 * 1024,
  maxChunkedSyncDiffBytes: 4 * 1024 * 1024,
} as const;

const FROZEN_TIMEOUTS = {
  helloTimeoutMs: 10_000,
  openTimeoutMs: 5_000,
  bootstrapTimeoutMs: 10_000,
  reconcileTimeoutMs: 10_000,
  reconcileIntervalMs: 5 * 60_000,
  closeTimeoutMs: 5_000,
  ackTimeoutMs: 10_000,
  pingIntervalMs: 30_000,
  pongTimeoutMs: 10_000,
  assemblyTimeoutMs: 30_000,
} as const;

const FROZEN_BACKOFF = { baseMs: 100, maxMs: 30_000, resetAfterMs: 10_000 } as const;

/** namespace 域帧：namespaceId 恒在 wire `[21..56]`（varString 1 字节长度前缀 + 35 ASCII）。 */
const NAMESPACE_SCOPED_KINDS: ReadonlySet<string> = new Set([
  'OPEN_OK',
  'BOOTSTRAP_SNAPSHOT',
  'IDENTITY_CHANGED',
  'CLOSE_OK',
  'SYNC_STEP1',
  'SYNC_STEP2',
  'SYNC_APPLIED',
  'RESYNC_REQUIRED',
  'UPDATE',
  'UPDATE_ACK',
]);

// ═══════════════════════════ hub-only fixture（edge/session 缝的最小驱动） ═══════════════

const HELLO_NONCE = new Uint8Array(16).fill(0x80);
const HELLO_0X7F = new Uint8Array(16).fill(0x7f);

function helloMessage(nonce: Uint8Array): ReplicationMessage {
  return {
    kind: 'HELLO',
    peerInstanceId: PEER_INSTANCE,
    expectedHubInstanceId: HUB_INSTANCE,
    protocolVersions: [1],
    requiredCapabilities: 0,
    optionalCapabilities: 0,
    connectionNonce: nonce,
  };
}

interface HubOnlyFixture {
  readonly hub: HubReplication;
  readonly authorizer: AuthorizerSpy;
  readonly wire: Wire;
  readonly nsId: string;
  readonly closeInfo: () => Readonly<{ code: number; reason: string }> | undefined;
}

/** 真实 Registry + 真实 namespace fixture + 手写 duplex transport（无 peer 实现参与）。 */
async function makeHubOnly(): Promise<HubOnlyFixture> {
  const node = makeNode('hub');
  const fixture = await makeHubNamespace(node);
  const authorizer = makeAuthorizer();
  const hub = createHubReplication({
    instanceId: HUB_INSTANCE,
    registry: node.registry,
    authorize: authorizer.authorize,
    timer: node.scheduler,
    verifyToken: DEFAULT_PEER_VERIFIER,
  });
  const wire = makeWire();
  let closeInfo: Readonly<{ code: number; reason: string }> | undefined;
  wire.peerEnd.onClose((info) => {
    closeInfo = info;
  });
  const connection = await hub.acceptTrusted!(wire.hubEnd, { peerInstanceId: PEER_INSTANCE });
  expect(connection).toBeDefined();
  return { hub, authorizer, wire, nsId: fixture.namespaceId, closeInfo: () => closeInfo };
}

/** 以 peer 身份送入一帧（显式 sequence——调用方持有序列纪律）。 */
async function pump(fixture: HubOnlyFixture, message: ReplicationMessage, sequence: number): Promise<void> {
  fixture.wire.peerEnd.send(encodeMessage(message, { sequence }));
  await settle();
  await settle();
}

// ═══════════════════════════ C1 单点出站 sequence（edge 盖章语义） ═══════════════════════

describe('C1（#418 AC2 / ADR 0032 决策 2）：每连接单点出站 sequence + edge 盖章字节纪律', () => {
  it('C1a：单 namespace 全生命周期——raw [8..12] 自 1 严格 +1，连接级帧与 namespace 域帧共用同一序列', async () => {
    const run: Run = await boot({ random: () => 0.5 });
    await run.writePeer({ n: 7 });
    await settle();
    const frames = run.wire.hubToPeer;
    // 帧序（kind 计划）与逐帧字节长度基线（Yjs 载荷帧只锚定 kind/序列）
    const actualPlan = frames.map((bytes) => ({
      kind: decodeMessage(bytes).message.kind,
      bytes: bytes.byteLength,
    }));
    FROZEN_SINGLE_NS_PLAN.forEach((entry, index) => {
      expect(actualPlan[index]!.kind).toBe(entry.kind);
      if (entry.bytes === null) {
        expect(actualPlan[index]!.bytes).toBeGreaterThan(20);
      } else {
        expect(actualPlan[index]!.bytes).toBe(entry.bytes);
      }
    });
    expect(actualPlan).toHaveLength(FROZEN_SINGLE_NS_PLAN.length);
    // raw [8..12] 单点序列：1..N 连续、无重复、无占位 0
    expect(frames.map(rawSequence)).toEqual(frames.map((_bytes, index) => index + 1));
    // 同一序列串包含连接级帧（HELLO_ACK）与 namespace 域帧 → 单分配点跨半边
    const kinds = kindsOf(frames);
    expect(kinds[0]).toBe('HELLO_ACK');
    expect(kinds.filter((kind) => NAMESPACE_SCOPED_KINDS.has(kind)).length).toBeGreaterThanOrEqual(5);
    // envelope 头字节纪律（magic/version/flags/reserved/length 一致性）
    for (const bytes of frames) {
      expect(Array.from(bytes.subarray(0, 4))).toEqual([0x4e, 0x4d, 0x43, 0x52]);
      expect(bytes[4]).toBe(1);
      expect(Array.from(bytes.subarray(6, 8))).toEqual([0, 0]);
      expect(Array.from(bytes.subarray(16, 20))).toEqual([0, 0, 0, 0]);
      expect(bytes.byteLength).toBe(20 + rawPayloadLength(bytes));
      expect(rawSequence(bytes)).toBe(decodeMessage(bytes).header.sequence);
    }
    await run.hub.close();
  }, 60_000);

  it('C1b：会话记账序 == wire 序——peer 的 ackedSequence 回指 hub 帧 raw 序列（BOOTSTRAP/SYNC_STEP2）', async () => {
    const run: Run = await boot({ random: () => 0.5 });
    await run.writePeer({ n: 7 });
    await settle();
    const hubFrames = run.wire.hubToPeer;
    const peerFrames = run.wire.peerToHub;
    const bootstrapSeq = rawSequence(hubFrames[kindsOf(hubFrames).indexOf('BOOTSTRAP_SNAPSHOT')]!);
    const step2Seq = rawSequence(hubFrames[kindsOf(hubFrames).indexOf('SYNC_STEP2')]!);
    expect(bootstrapSeq).toBe(3);
    expect(step2Seq).toBe(5);
    expect(messagesOf(peerFrames, 'BOOTSTRAP_ACK').map((message) => message.ackedSequence)).toEqual([
      bootstrapSeq,
    ]);
    expect(messagesOf(peerFrames, 'SYNC_APPLIED').map((message) => message.ackedSequence)).toEqual([
      step2Seq,
    ]);
    await run.hub.close();
  }, 60_000);

  it('C1c：一条连接两个 namespace——单分配点（序列仍 1..N）+ 两 namespace 共用该序列', async () => {
    const run: Run = await boot({ random: () => 0.5 });
    const nsB = (await makeHubNamespace(run.hubNode)).namespaceId;
    expect(nsB).not.toBe(run.nsId);
    run.peer.addTarget({ namespaceId: nsB, localOwner: PEER_OWNER });
    await settleUntil(() => run.peer.getNamespaceState(nsB) === 'live', '第二 namespace live');
    await settle();
    const frames = run.wire.hubToPeer;
    const sequences = frames.map(rawSequence);
    expect(sequences).toEqual(frames.map((_bytes, index) => index + 1));
    const decoded = frames.map((bytes) => decodeMessage(bytes).message);
    const scoped = decoded.filter(
      (message): message is ReplicationMessage & { namespaceId: string } =>
        namespaceIdOf(message) !== undefined,
    );
    const namespaces = new Set(scoped.map((message) => message.namespaceId));
    expect(namespaces).toEqual(new Set([run.nsId, nsB]));
    // 两 namespace 各自完成 OPEN_OK → BOOTSTRAP_SNAPSHOT → SYNC 收口（每个 ns 的帧落入同一序列）
    for (const namespaceId of [run.nsId, nsB]) {
      const perNamespace = frames.filter(
        (bytes) => asciiAt(bytes, 21, 56) === namespaceId,
      );
      expect(kindsOf(perNamespace)).toEqual(
        expect.arrayContaining(['OPEN_OK', 'BOOTSTRAP_SNAPSHOT', 'SYNC_APPLIED']),
      );
    }
    await run.hub.close();
  }, 60_000);

  it('C1d：hub-only CLOSE_OK——出站序继续单点序列，ackedSequence 回指入站 CLOSE_NAMESPACE raw 序列', async () => {
    const fixture = await makeHubOnly();
    await pump(fixture, helloMessage(HELLO_NONCE), 1);
    await pump(fixture, { kind: 'OPEN_NAMESPACE', namespaceId: fixture.nsId, hasLocalReplica: false }, 2);
    await pump(fixture, { kind: 'CLOSE_NAMESPACE', namespaceId: fixture.nsId, reasonCode: 'peer-close' }, 3);
    const frames = fixture.wire.hubToPeer;
    expect(frames.map(rawSequence)).toEqual([1, 2, 3, 4]);
    const closeOk = messagesOf(frames, 'CLOSE_OK');
    expect(closeOk).toHaveLength(1);
    expect(closeOk[0]!.ackedSequence).toBe(3); // 入站 CLOSE_NAMESPACE raw 序列
    expect(hexOf(frames[3]!)).toBe(FROZEN_CLOSE_OK_HEX);
    await fixture.hub.close();
  }, 60_000);
});

// ═══════════════════════════ C2 入站 expectedSeq 分派前收口 ═══════════════════════════

describe('C2（#418 AC2 / ADR 0032 决策 2）：入站 expectedSeq 在 namespace 分派前收口（连接级 fatal）', () => {
  it('C2a：gap（OPEN_NAMESPACE seq 5）→ 连接级 SEQUENCE_VIOLATION + close(1002)，零 authorize、零 namespace 供帧', async () => {
    const fixture = await makeHubOnly();
    await pump(fixture, helloMessage(HELLO_0X7F), 1);
    expect(fixture.authorizer.calls).toEqual([]);
    await pump(fixture, { kind: 'OPEN_NAMESPACE', namespaceId: fixture.nsId, hasLocalReplica: false }, 5);
    // 连接级 ERROR：scope 无 namespaceId；全帧 hex 冻结（edge 半边收口形态）
    expect(hexOf(fixture.wire.hubToPeer[1]!)).toBe(FROZEN_SEQUENCE_VIOLATION_ERROR_HEX);
    const errors = messagesOf(fixture.wire.hubToPeer, 'ERROR');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.code).toBe('SEQUENCE_VIOLATION');
    expect(errors[0]!.namespaceId).toBeUndefined();
    expect(kindsOf(fixture.wire.hubToPeer)).toEqual(['HELLO_ACK', 'ERROR']);
    // 零 namespace 副作用：authorize 从未被调用、零 OPEN_OK
    expect(fixture.authorizer.calls).toEqual([]);
    expect(messagesOf(fixture.wire.hubToPeer, 'OPEN_OK')).toEqual([]);
    // 连接收口语义：close(1002, 'protocol-error')
    await settle();
    expect(fixture.closeInfo()).toEqual({ code: 1002, reason: 'protocol-error' });
    await fixture.hub.close();
  }, 60_000);

  it('C2b：repeat（OPEN_NAMESPACE 重放 seq 1）→ 同款连接级 fatal（重复帧同样不过缝）', async () => {
    const fixture = await makeHubOnly();
    await pump(fixture, helloMessage(HELLO_0X7F), 1);
    await pump(fixture, { kind: 'OPEN_NAMESPACE', namespaceId: fixture.nsId, hasLocalReplica: false }, 1);
    const errors = messagesOf(fixture.wire.hubToPeer, 'ERROR');
    expect(errors.map((message) => message.code)).toEqual(['SEQUENCE_VIOLATION']);
    expect(fixture.authorizer.calls).toEqual([]);
    expect(messagesOf(fixture.wire.hubToPeer, 'OPEN_OK')).toEqual([]);
    await settle();
    expect(fixture.closeInfo()).toEqual({ code: 1002, reason: 'protocol-error' });
    await fixture.hub.close();
  }, 60_000);

  it('C2c：re-OPEN（同 namespace 第二次 OPEN_NAMESPACE）→ authorize 仍恰一次（ADR 0032 决策 3 合流口径），连接零 fatal', async () => {
    const fixture = await makeHubOnly();
    await pump(fixture, helloMessage(HELLO_NONCE), 1);
    await pump(fixture, { kind: 'OPEN_NAMESPACE', namespaceId: fixture.nsId, hasLocalReplica: false }, 2);
    await pump(fixture, { kind: 'OPEN_NAMESPACE', namespaceId: fixture.nsId, hasLocalReplica: false }, 3);
    expect(messagesOf(fixture.wire.hubToPeer, 'OPEN_OK')).toHaveLength(2);
    expect(fixture.authorizer.calls).toEqual([
      { instanceIdentity: PEER_INSTANCE, namespaceId: fixture.nsId },
    ]);
    expect(messagesOf(fixture.wire.hubToPeer, 'ERROR')).toEqual([]);
    expect(fixture.wire.hubToPeer.map(rawSequence)).toEqual([1, 2, 3, 4]);
    expect(fixture.closeInfo()).toBeUndefined();
    await fixture.hub.close();
  }, 60_000);

  it('C2d 控制组（正控）：同帧正确序列 → authorize 恰一次 + OPEN_OK + 连接保持可用 + 零 ERROR', async () => {
    const fixture = await makeHubOnly();
    await pump(fixture, helloMessage(HELLO_NONCE), 1);
    await pump(fixture, { kind: 'OPEN_NAMESPACE', namespaceId: fixture.nsId, hasLocalReplica: false }, 2);
    expect(hexOf(fixture.wire.hubToPeer[1]!)).toBe(FROZEN_OPEN_OK_HEX);
    expect(messagesOf(fixture.wire.hubToPeer, 'ERROR')).toEqual([]);
    expect(fixture.authorizer.calls).toEqual([
      { instanceIdentity: PEER_INSTANCE, namespaceId: fixture.nsId },
    ]);
    // 连接仍可继续按序列推进（CLOSE_NAMESPACE seq 3 → CLOSE_OK seq 4；无 close）
    await pump(fixture, { kind: 'CLOSE_NAMESPACE', namespaceId: fixture.nsId, reasonCode: 'peer-close' }, 3);
    expect(messagesOf(fixture.wire.hubToPeer, 'CLOSE_OK')).toHaveLength(1);
    expect(fixture.closeInfo()).toBeUndefined();
    await fixture.hub.close();
  }, 60_000);
});

// ═══════════════════════════ C3 wire 逐字节金标 ═══════════════════════════

describe('C3（#418 AC4）：非 Yjs 载荷帧逐字节冻结 + envelope 计划冻结', () => {
  it('C3a：单 namespace 场景 HELLO_ACK / OPEN_OK / UPDATE_ACK 全帧 hex 逐字节相等', async () => {
    const run: Run = await boot({ random: () => 0.5 });
    await run.writePeer({ n: 7 });
    await settle();
    const frames = run.wire.hubToPeer;
    expect(hexOf(frames[0]!)).toBe(FROZEN_HELLO_ACK_HEX);
    expect(hexOf(frames[1]!)).toBe(FROZEN_OPEN_OK_HEX);
    expect(hexOf(frames[frames.length - 1]!)).toBe(FROZEN_UPDATE_ACK_HEX);
    // Yjs 载荷帧（快照/同步 diffs）在 envelope + 解码语义层锚定（payload 字节含库内部
    // 随机 clientID，不可跨进程冻结——见文件头 C3 边界说明）
    const snapshot = messagesOf(frames, 'BOOTSTRAP_SNAPSHOT');
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]!.namespaceId).toBe(run.nsId);
    expect(snapshot[0]!.snapshot.byteLength).toBeGreaterThan(0);
    for (const bytes of frames) {
      expect(bytes.byteLength).toBe(20 + rawPayloadLength(bytes));
    }
    await run.hub.close();
  }, 60_000);

  it('C3b：reauth GOAWAY 全帧 hex 逐字节相等（连接级帧在 edge 半边出站）', async () => {
    const fixture = await makeHubOnly();
    await pump(fixture, helloMessage(HELLO_NONCE), 1);
    await pump(fixture, { kind: 'OPEN_NAMESPACE', namespaceId: fixture.nsId, hasLocalReplica: false }, 2);
    await fixture.hub.requestReauth(PEER_INSTANCE);
    await settle();
    const frames = fixture.wire.hubToPeer;
    const goaway = messagesOf(frames, 'GOAWAY');
    expect(goaway).toHaveLength(1);
    expect(goaway[0]!.reasonCode).toBe('REAUTH_REQUIRED');
    expect(goaway[0]!.drainTimeoutMs).toBe(DEFAULT_REPLICATION_TIMEOUTS.closeTimeoutMs);
    expect(hexOf(frames[frames.length - 1]!)).toBe(FROZEN_GOAWAY_HEX);
    expect(rawSequence(frames[frames.length - 1]!)).toBe(frames.length);
    await fixture.hub.close();
  }, 60_000);

  it('C3c：连接级金标与 driver 全栈金标一致（HELLO_ACK 与 peer 随机源无关地可复现）', async () => {
    const fixture = await makeHubOnly();
    await pump(fixture, helloMessage(HELLO_NONCE), 1);
    expect(hexOf(fixture.wire.hubToPeer[0]!)).toBe(FROZEN_HELLO_ACK_HEX);
    await fixture.hub.close();
  }, 60_000);
});

// ═══════════════════════════ C4 路由键定偏移（edge O(帧头) demux 字节前提） ═══════════════

describe('C4（ADR 0032 决策 4）：namespace 域帧 namespaceId 恒在 wire [21..56]', () => {
  it('C4a：单 namespace 捕获逐帧定偏移读取 == 解码命名空间（35 字节 ASCII）', async () => {
    const run: Run = await boot({ random: () => 0.5 });
    await run.writePeer({ n: 7 });
    await settle();
    let scoped = 0;
    for (const bytes of run.wire.hubToPeer) {
      const message = decodeMessage(bytes).message;
      if (!NAMESPACE_SCOPED_KINDS.has(message.kind)) continue;
      scoped += 1;
      expect(asciiAt(bytes, 21, 56)).toBe(run.nsId);
      expect(bytes[20]).toBe(35); // varString 长度前缀恒 1 字节
    }
    expect(scoped).toBeGreaterThanOrEqual(5);
    // 负控：连接级帧在 [21..56] 不是 namespaceId（HELLO_ACK 载荷是 instanceId 等）
    expect(asciiAt(run.wire.hubToPeer[0]!, 21, 56)).not.toBe(run.nsId);
    await run.hub.close();
  }, 60_000);

  it('C4b：两 namespace 捕获——定偏移读取分别命中各自 namespaceId（无广播/无歧义）', async () => {
    const run: Run = await boot({ random: () => 0.5 });
    const nsB = (await makeHubNamespace(run.hubNode)).namespaceId;
    run.peer.addTarget({ namespaceId: nsB, localOwner: PEER_OWNER });
    await settleUntil(() => run.peer.getNamespaceState(nsB) === 'live', '第二 namespace live');
    await settle();
    const seen = new Set<string>();
    for (const bytes of run.wire.hubToPeer) {
      const message = decodeMessage(bytes).message;
      if (!NAMESPACE_SCOPED_KINDS.has(message.kind)) continue;
      const byOffset = asciiAt(bytes, 21, 56);
      expect(byOffset).toBe(namespaceIdOf(message));
      seen.add(byOffset);
    }
    expect(seen).toEqual(new Set([run.nsId, nsB]));
    await run.hub.close();
  }, 60_000);
});

// ═══════════════════════════ C6 反证：断言对「拆分失败形态」的敏感性 ═══════════════════════

/** 重写 wire `[8..12]`（大端 uint32）——模拟占位泄漏 / 双计数器等拆分失败形态。 */
function withSequence(bytes: Uint8Array, sequence: number): Uint8Array {
  const copy = bytes.slice();
  copy[8] = (sequence >>> 24) & 0xff;
  copy[9] = (sequence >>> 16) & 0xff;
  copy[10] = (sequence >>> 8) & 0xff;
  copy[11] = sequence & 0xff;
  return copy;
}

function decodeErrorCode(bytes: Uint8Array, expectedSequence: number): string | undefined {
  try {
    decodeMessage(bytes, { expectedSequence });
    return undefined;
  } catch (err) {
    return (err as { code?: string }).code;
  }
}

// ═══════════════════════════ C5 公共 API / 配置冻结 ═══════════════════════════

describe('C5（#418：零新公共 API、零配置变化）：导出面、服务常量与 DEFAULT_* 三常量冻结', () => {
  it('C5a：生产入口与 /testing 入口运行时导出名集合冻结（增删均红）', () => {
    expect(Object.keys(productionApi).sort()).toEqual(FROZEN_PRODUCTION_EXPORTS);
    expect(Object.keys(testingApi).sort()).toEqual(FROZEN_TESTING_EXPORTS);
    expect(NOMICORE_HUB_REPLICATION_SERVICE).toBe('nomicoreHubReplication');
    expect(NOMICORE_PEER_REPLICATION_SERVICE).toBe('nomicorePeerReplication');
  });

  it('C5b：DEFAULT_REPLICATION_LIMITS / TIMEOUTS / BACKOFF 全值冻结', () => {
    expect(DEFAULT_REPLICATION_LIMITS).toEqual(FROZEN_LIMITS);
    expect(DEFAULT_REPLICATION_TIMEOUTS).toEqual(FROZEN_TIMEOUTS);
    expect(DEFAULT_REPLICATION_BACKOFF).toEqual(FROZEN_BACKOFF);
    expect(Object.isFrozen(DEFAULT_REPLICATION_LIMITS)).toBe(true);
    expect(Object.isFrozen(DEFAULT_REPLICATION_TIMEOUTS)).toBe(true);
    expect(Object.isFrozen(DEFAULT_REPLICATION_BACKOFF)).toBe(true);
  });

  it('C5c：重复采集（独立 hub/peer 实例）——序列计划与非 Yjs 帧逐字节一致', async () => {
    const run: Run = await boot({ random: () => 0.5 });
    await run.writePeer({ n: 7 });
    await settle();
    const second: Run = await boot({ random: () => 0.5 });
    await second.writePeer({ n: 7 });
    await settle();
    // 非 Yjs 载荷帧：两次独立采集逐字节相等（跨实例、跨 hub/peer 对象）
    expect(nonYjsHex(second.wire.hubToPeer)).toEqual(nonYjsHex(run.wire.hubToPeer));
    expect(hexOf(second.wire.hubToPeer[0]!)).toBe(hexOf(run.wire.hubToPeer[0]!));
    // 序列计划（kind 序列 + raw [8..12] 1..N）一致；Yjs 载荷不参与比较
    expect(kindsOf(second.wire.hubToPeer)).toEqual(kindsOf(run.wire.hubToPeer));
    expect(second.wire.hubToPeer.map(rawSequence)).toEqual(
      second.wire.hubToPeer.map((_bytes, index) => index + 1),
    );
    await run.hub.close();
    await second.hub.close();
  }, 60_000);
});

// ═══════════════════════════ C6 反证：契约对拆分失败形态的敏感性 ═══════════════════════════

describe('C6（契约敏感性反证）：sequence=0 占位 / 双计数器形态在接收侧必被拒——C1 的 1..N 断言是 wire 义务', () => {
  it('C6a：接收侧负控——未变异 HELLO_ACK 按 expectedSequence 1 解出；占位 0 / 重复序均 SEQUENCE_VIOLATION', async () => {
    const run: Run = await boot({ random: () => 0.5 });
    await run.writePeer({ n: 7 });
    await settle();
    const frames = run.wire.hubToPeer;
    const helloAck = frames[0]!;
    // 对照：正确的 raw 序列可解码
    expect(decodeErrorCode(helloAck, 1)).toBeUndefined();
    expect(decodeErrorCode(helloAck, 2)).toBe('SEQUENCE_VIOLATION');
    // 拆分失败形态 1：session 侧 sequence=0 占位未在 edge 盖章 → 接收侧拒
    expect(decodeErrorCode(withSequence(helloAck, 0), 1)).toBe('SEQUENCE_VIOLATION');
    // 拆分失败形态 2：两个 per-session 计数器各自从 1 起（第二路首帧与本路首帧撞序）
    const secondStreamFirstFrame = withSequence(frames[1]!, 1);
    expect(decodeErrorCode(frames[1]!, 2)).toBeUndefined();
    expect(decodeErrorCode(secondStreamFirstFrame, 2)).toBe('SEQUENCE_VIOLATION');
    await run.hub.close();
  }, 60_000);
});
