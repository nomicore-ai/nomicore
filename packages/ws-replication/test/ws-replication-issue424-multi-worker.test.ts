/**
 * SA6 验收契约 — issue #424（spec #415 T7）：**多 worker 分派与出站序**（AC3；契约 §12.3）。
 *
 * 覆盖条目：SHARD-C1（1 连接 × 2 ns × 2 worker：解析/会话各归其位、同一 connectionKey）/
 * SHARD-C2（demux/mux：出站帧覆盖两 ns、每 ns OPEN_OK 恰一、按协议序）/ SHARD-C3（负控：
 * 从未 OPEN 的 ns 帧 → 合成 `NAMESPACE_STATE_VIOLATION`、零会话、连接存活、不落任一 worker
 * ——ADR 0032 决策 4 + NC1）/ SEQ-C1（per-connection 出站 `[8..12]` 严格递增；第二连接从 1
 * 重新起算）。
 *
 * 纪律与硬门口径同 `ws-replication-issue424-auth-parity.test.ts` 头注（控制帧 = 运行时字节；
 * 数据帧 = 文档语义；observer 面不入判据）。断言全部读取 wire 原字节 / `[8..12]` 序 /
 * 描述子 JSON / 会话计数。
 *
 * 规范引用（设计 §12.1）：协议 §3 L57（「正常 frame 从 `1` 严格递增」= per-connection 序纪律）、
 * §7.1 L176（OPEN 矩阵）、§13.2 L430（`NAMESPACE_STATE_VIOLATION`→failed）；ADR 0032 决策 4
 * （路由键定偏移只读提取；合法无 sink → 合成 `NAMESPACE_STATE_VIOLATION`，连接存活）；
 * CONTEXT.md 路由键契约（L233-235）。
 */
import { describe, expect, it } from 'vitest';
import {
  closeNsFrame,
  controlFramesOf,
  dataFramesOf,
  decodeAll,
  framesHexEqual,
  helloFrame,
  makeAccountingTimer,
  makeAuthorizer,
  makeRecordingPipe,
  makeShardedHost,
  makeShardedWorker,
  openFrame,
  parityOf,
  rawSequence,
  routeByNamespace,
  runMonolithTrace,
  runShardTrace,
  skeletonOf,
} from './issue424-sharded-hub.js';
import { PEER_INSTANCE, settle } from './harness.js';

const SEED_A = 1000;
const SEED_B = 2000;
const UNKNOWN_NS = `ns-${'c'.repeat(32)}`;

/** 两条 worker 与共享脚本（A/B 各一 ns；同 seed 建两 worker 供两形态比较）。 */
async function twoWorkers(): Promise<{
  readonly workerA: Awaited<ReturnType<typeof makeShardedWorker>>;
  readonly workerB: Awaited<ReturnType<typeof makeShardedWorker>>;
}> {
  return {
    workerA: await makeShardedWorker(0, { seed: SEED_A, rootN: 42 }),
    workerB: await makeShardedWorker(1, { seed: SEED_B, rootN: 43 }),
  };
}

function twoNamespaceScript(namespaceA: string, namespaceB: string): readonly Uint8Array[] {
  return [helloFrame(1), openFrame(namespaceA, 2), openFrame(namespaceB, 3)];
}

describe('issue #424 AC3 — 一条连接多 namespace 分属多 session host 实例', () => {
  it('SHARD-C1 路由：resolveSessionSink 对 A/B 各恰一次；A 会话只在 w0、B 只在 w1；描述子 connectionKey 相同（同一连接）', async () => {
    const { workerA, workerB } = await twoWorkers();
    const script = twoNamespaceScript(workerA.namespaceId, workerB.namespaceId);
    const shard = await runShardTrace('pass', [workerA, workerB], script);

    // resolveSessionSink 恰一次/ns（seeded 随机源 ⟹ 同 seed 同 ns 身份）。
    expect(shard.resolves).toEqual([
      `${workerA.namespaceId}:w0`,
      `${workerB.namespaceId}:w1`,
    ]);
    expect(shard.opens).toHaveLength(2);
    expect(shard.sessions).toHaveLength(2);

    const openA = shard.opens.find((open) => open.namespaceId === workerA.namespaceId);
    const openB = shard.opens.find((open) => open.namespaceId === workerB.namespaceId);
    expect(openA?.workerIndex).toBe(0);
    expect(openB?.workerIndex).toBe(1);
    // 同一连接：两描述子 connectionKey 相同（SD-3 单工厂键空间）。
    expect(openA?.connectionKey).toBe(openB?.connectionKey);
    expect(openA?.remoteInstanceId).toBe(PEER_INSTANCE);
    expect(openB?.remoteInstanceId).toBe(PEER_INSTANCE);

    const sessionA = shard.sessions.find((session) => session.namespaceId === workerA.namespaceId);
    const sessionB = shard.sessions.find((session) => session.namespaceId === workerB.namespaceId);
    expect(sessionA?.workerIndex).toBe(0);
    expect(sessionB?.workerIndex).toBe(1);
  });

  it('SHARD-C2 demux/mux：出站帧覆盖 A/B；每 ns OPEN_OK 恰一；每 ns 内部按协议序（OPEN_OK → BOOTSTRAP_SNAPSHOT）', async () => {
    const { workerA, workerB } = await twoWorkers();
    const script = twoNamespaceScript(workerA.namespaceId, workerB.namespaceId);
    const shard = await runShardTrace('pass', [workerA, workerB], script);

    const decoded = decodeAll(shard.frames);
    const namespaces = new Set(
      decoded.map((item) => item.namespaceId).filter((value): value is string => value !== undefined),
    );
    expect(namespaces).toEqual(new Set([workerA.namespaceId, workerB.namespaceId]));

    for (const namespaceId of [workerA.namespaceId, workerB.namespaceId]) {
      const kinds = decoded
        .filter((item) => item.namespaceId === namespaceId)
        .map((item) => item.kind);
      expect(kinds.filter((kind) => kind === 'OPEN_OK'), `${namespaceId}: OPEN_OK 数`).toHaveLength(1);
      expect(
        kinds.filter((kind) => kind === 'BOOTSTRAP_SNAPSHOT'),
        `${namespaceId}: BOOTSTRAP_SNAPSHOT 数`,
      ).toHaveLength(1);
      expect(kinds.indexOf('OPEN_OK')).toBeLessThan(kinds.indexOf('BOOTSTRAP_SNAPSHOT'));
    }
  });

  it('SHARD-C3 负控（NC1）：从未 OPEN 的 ns 帧 → 合成 NAMESPACE_STATE_VIOLATION、零新会话、连接存活、不落任一 worker；两形态逐字节相等', async () => {
    const { workerA, workerB } = await twoWorkers();
    const pipe = makeRecordingPipe();
    const host = makeShardedHost(routeByNamespace([workerA, workerB]), {
      authorize: makeAuthorizer('pass'),
      timer: makeAccountingTimer().timer,
    });
    const connection = await host.acceptTrusted(pipe.hubTransport, { peerInstanceId: PEER_INSTANCE });
    expect(connection).toBeDefined();
    for (const frame of twoNamespaceScript(workerA.namespaceId, workerB.namespaceId)) {
      pipe.sendInbound(frame);
      await settle();
    }
    const opensBefore = host.probes.opens.length;

    pipe.sendInbound(closeNsFrame(UNKNOWN_NS, 4));
    await settle();

    const violations = decodeAll(pipe.frames()).filter(
      (item) => item.kind === 'ERROR' && item.code === 'NAMESPACE_STATE_VIOLATION',
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]!.namespaceId).toBe(UNKNOWN_NS);
    // 不落任一 worker（无解析、无会话追加），连接存活（决策 4：合法无 sink → 合成违例）。
    expect(host.probes.opens).toHaveLength(opensBefore);
    expect(host.probes.sessions).toHaveLength(2);
    expect(host.probes.resolves).toEqual([
      `${workerA.namespaceId}:w0`,
      `${workerB.namespaceId}:w1`,
    ]);
    expect(connection!.state).not.toBe('closed');
    expect(pipe.hubCloseInfo()).toBeUndefined();

    // NC1 的两形态对照：同一语料（HELLO#1 + 未 OPEN 的 ns CLOSE#2）在单体与分片逐字节相等。
    const monoWorker = await makeShardedWorker(0, { seed: SEED_A, rootN: 42 });
    const parityScript = [helloFrame(1), closeNsFrame(UNKNOWN_NS, 2)];
    const mono = await runMonolithTrace('pass', monoWorker.registry, parityScript);
    const parityWorker = await makeShardedWorker(0, { seed: SEED_A, rootN: 42 });
    const shard = await runShardTrace('pass', [parityWorker], parityScript);
    const parity = parityOf(mono, shard);
    expect(parity.ok, parity.detail).toBe(true);
    expect(framesHexEqual(controlFramesOf(mono.frames), controlFramesOf(shard.frames))).toBeUndefined();
    expect(skeletonOf(shard.frames)).toBe('HELLO_ACK#1 ERROR(NAMESPACE_STATE_VIOLATION)#2');
    expect(shard.sessions).toHaveLength(0);
    expect(shard.state).not.toBe('closed');
  });

  it('SEQ-C1 出站序：`[8..12]` 大端 = 1..N 严格递增（无跳/重/回退）；每 ns 首帧序 = OPEN 注入序；同工厂第二连接首帧序 = 1', async () => {
    const { workerA, workerB } = await twoWorkers();
    const host = makeShardedHost(routeByNamespace([workerA, workerB]), {
      authorize: makeAuthorizer('pass'),
      timer: makeAccountingTimer().timer,
    });

    // 第一条连接：1 连接 × 2 ns × 2 worker（同一 ShardedHost 场景实例）。
    const pipe = makeRecordingPipe();
    const first = await host.acceptTrusted(pipe.hubTransport, { peerInstanceId: PEER_INSTANCE });
    expect(first).toBeDefined();
    for (const frame of twoNamespaceScript(workerA.namespaceId, workerB.namespaceId)) {
      pipe.sendInbound(frame);
      await settle();
    }

    const frames = pipe.frames();
    const sequences = frames.map(rawSequence);
    expect(sequences.length).toBeGreaterThanOrEqual(5);
    // per-connection 从 1 起、严格递增（无跳号/重复/回退）。
    expect(sequences).toEqual(sequences.map((_value, index) => index + 1));

    const decoded = decodeAll(frames);
    const firstIndexOf = (namespaceId: string): number =>
      decoded.findIndex((item) => item.namespaceId === namespaceId);
    // 每 ns 首帧出现序 = OPEN 注入序（A 先于 B）。
    expect(firstIndexOf(workerA.namespaceId)).toBeGreaterThanOrEqual(0);
    expect(firstIndexOf(workerB.namespaceId)).toBeGreaterThan(firstIndexOf(workerA.namespaceId));
    // per-ns 子序列 = 协议序（OPEN_OK 先于 BOOTSTRAP_SNAPSHOT）。
    for (const namespaceId of [workerA.namespaceId, workerB.namespaceId]) {
      const kinds = decoded
        .filter((item) => item.namespaceId === namespaceId)
        .map((item) => item.kind);
      expect(kinds[0], `${namespaceId}: 首帧 kind`).toBe('OPEN_OK');
      expect(kinds.indexOf('OPEN_OK')).toBeLessThan(kinds.indexOf('BOOTSTRAP_SNAPSHOT'));
    }

    // 第二条连接（同一工厂 ⟹ 同实例计数器、键后缀互异）：出站序从 1 重新起算（per-connection）。
    const secondPipe = makeRecordingPipe();
    const second = await host.acceptTrusted(secondPipe.hubTransport, {
      peerInstanceId: PEER_INSTANCE,
    });
    expect(second).toBeDefined();
    expect(second!.connectionKey).not.toBe(first!.connectionKey);
    secondPipe.sendInbound(helloFrame(1));
    await settle();
    expect(secondPipe.frames().map(rawSequence)).toEqual([1]);

    // 首连接序列不受第二连接影响（连接隔离：独立内部 edge + 独立出站计数）。
    expect(pipe.frames().map(rawSequence)).toEqual(sequences);
    expect(decodeAll(pipe.frames()).filter((item) => item.kind === 'HELLO_ACK')).toHaveLength(1);
    // 数据帧白名单仍非空（demux/mux 覆盖两 ns 的 bootstrap）。
    expect(dataFramesOf(pipe.frames()).length).toBeGreaterThanOrEqual(2);
  });
});
