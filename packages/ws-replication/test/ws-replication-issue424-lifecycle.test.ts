/**
 * SA6 验收契约 — issue #424（spec #415 T7）：**生命周期与经 edge 入口的 revoke/reauth**（AC4/AC5；
 * 契约 §12.4/§12.5）。
 *
 * 覆盖条目：TERM-C1（连接终结传播：edge close → 全部会话 `close()` 到达 + 零新出站）/
 * TERM-C2（无泄漏：scheduler pending 不增、`handle.close()` 幂等（同 promise）、零 unhandled
 * rejection）/ TERM-C3（负控：连接隔离——关其一不影响另一）/ REVOKE-C1（revoke 路由 + 末帧与
 * 单体逐字节相等）/ REVOKE-C2（跨 worker 零外溢）/ REVOKE-C3（未知/已终态 ns 幂等无副作用）/
 * REAUTH-C1（GOAWAY(REAUTH_REQUIRED, drain>0) → CLOSE_NAMESPACE → settled → drain 提前完成
 * close(1001)，零 deadline 推进）/ REAUTH-C2（阴性对照：不发起 reauth 则不关闭）/
 * SD-2(b) 退化负控（宿主登记缺失 → 响亮收口，非静默 fallback；设计 §7.3 追加）。
 *
 * 时间纪律（设计 §7.7）：pipe 形态推进直接调 `ShardedWorker.scheduler.advanceBy(ms)`；
 * 全虚拟、零真实 `setTimeout`/sleep/网络。断言 = wire 原字节 / `[8..12]` 序 / close code+reason /
 * 会话生命周期计数 / 信号探针。
 *
 * 规范引用（设计 §12.1）：协议 §13.1 L415（`INTERNAL_ERROR`：fatal yes / WS **1011**）、
 * §13.2 L425（`NAMESPACE_UNAUTHORIZED`→failed）、§14 L456-465（1001 = GOAWAY/计划重启；
 * 1011 = 内部错误）、§6.3 L159 + §21 L684（drain 提前完成 / deadline 1001）、§12 L375
 * （`CLOSE_OK.ackedSequence`）；ADR 0032 决策 3（「sink 解析失败响亮连接收口」为 edge 规范
 * 职责）+ 澄清附录 A1（`close`/`terminateUnauthorized`/`settled`/`connection-fatal` 缝词汇）；
 * CONTEXT.md 复制 Edge（L225-227，OPEN 准入管线归 Edge）。
 */
import { describe, expect, it } from 'vitest';
import { decodeMessage } from '@nomicore/replication-protocol';
import type { HubReplicationEdgeConnection } from '@nomicore/ws-replication';
import {
  LIMITS,
  type RecordingPipe,
  type ShardedHost,
  type ShardedWorker,
  closeNsFrame,
  decodeAll,
  framesHexEqual,
  helloFrame,
  makeAccountingTimer,
  makeAuthorizer,
  makeRecordingPipe,
  makeShardedHost,
  makeShardedWorker,
  openFrame,
  routeByNamespace,
  runMonolithTrace,
  runShardTrace,
} from './issue424-sharded-hub.js';
import { collectUnhandledRejections } from './driver.js';
import { PEER_INSTANCE, settle } from './harness.js';

const SEED_A = 1000;
const SEED_B = 2000;
const UNKNOWN_NS = `ns-${'d'.repeat(32)}`;

interface Scenario {
  readonly host: ShardedHost;
  readonly pipe: RecordingPipe;
  readonly connection: HubReplicationEdgeConnection;
  readonly workerA: ShardedWorker;
  readonly workerB: ShardedWorker;
  readonly namespaceA: string;
  readonly namespaceB: string;
}

/** 一条连接 × 两 ns × 两 worker（pipe 形态；每场景一工厂——SD-3）。 */
async function scenario(): Promise<Scenario> {
  const workerA = await makeShardedWorker(0, { seed: SEED_A, rootN: 42 });
  const workerB = await makeShardedWorker(1, { seed: SEED_B, rootN: 43 });
  const pipe = makeRecordingPipe();
  const host = makeShardedHost(routeByNamespace([workerA, workerB]), {
    authorize: makeAuthorizer('pass'),
    timer: makeAccountingTimer().timer,
  });
  const connection = await host.acceptTrusted(pipe.hubTransport, { peerInstanceId: PEER_INSTANCE });
  if (connection === undefined) throw new Error('issue424 lifecycle: acceptTrusted 拒绝');
  for (const frame of [
    helloFrame(1),
    openFrame(workerA.namespaceId, 2),
    openFrame(workerB.namespaceId, 3),
  ]) {
    pipe.sendInbound(frame);
    await settle();
  }
  expect(host.probes.sessions, '前置：两会话已建立').toHaveLength(2);
  return {
    host,
    pipe,
    connection,
    workerA,
    workerB,
    namespaceA: workerA.namespaceId,
    namespaceB: workerB.namespaceId,
  };
}

function sessionOf(host: ShardedHost, namespaceId: string): { closeCalls: number; terminateCalls: number } {
  const record = host.probes.sessions.find((session) => session.namespaceId === namespaceId);
  if (record === undefined) throw new Error(`issue424 lifecycle: 无 ${namespaceId} 会话`);
  return record;
}

describe('issue #424 AC4/AC5 — 连接终结传播与经 edge 入口的 revoke/reauth', () => {
  it('TERM-C1 终结传播：connection.close() → state=closed；两 worker 会话 closeCalls 各 ≥1（经 onConnectionClosed 投影）；此后显式推进 30s 零新出站', async () => {
    const { host, pipe, connection, workerA, workerB, namespaceA, namespaceB } = await scenario();

    connection.close();
    await settle();

    expect(connection.state).toBe('closed');
    expect(sessionOf(host, namespaceA).closeCalls).toBeGreaterThanOrEqual(1);
    expect(sessionOf(host, namespaceB).closeCalls).toBeGreaterThanOrEqual(1);

    const framesAtClose = pipe.frames().length;
    await workerA.scheduler.advanceBy(30_000);
    await workerB.scheduler.advanceBy(30_000);
    await settle();
    expect(pipe.frames().length, 'close 后仍有新出站').toBe(framesAtClose);
  });

  it('TERM-C2 无泄漏：close 后 worker scheduler pending 不增；handle.close() 幂等（同 promise）；零 unhandled rejection', async () => {
    const unhandled = collectUnhandledRejections();
    try {
      const { host, pipe, connection, workerA, workerB } = await scenario();
      const pendingA = workerA.scheduler.pending();
      const pendingB = workerB.scheduler.pending();
      const framesBefore = pipe.frames().length;

      connection.close();
      await settle();
      await connection.settle();

      expect(workerA.scheduler.pending(), 'worker0 scheduler pending 增长').toBeLessThanOrEqual(pendingA);
      expect(workerB.scheduler.pending(), 'worker1 scheduler pending 增长').toBeLessThanOrEqual(pendingB);
      expect(pipe.frames().length, 'close 后有新出站').toBe(framesBefore);

      // 会话句柄 close 幂等（同 promise）——§9 幂等纪律。
      const handle = host.probes.handles[0]!;
      const first = handle.close();
      const second = handle.close();
      expect(second).toBe(first);
      await first;
      await settle();

      expect(unhandled.events, 'unhandled rejection').toEqual([]);
    } finally {
      unhandled.dispose();
    }
  });

  it('TERM-C3 负控（连接隔离）：同一 host 两条连接各自持 ns；关闭其一 → 另一连接会话零 close、零新出站', async () => {
    const workerA = await makeShardedWorker(0, { seed: SEED_A, rootN: 42 });
    const workerB = await makeShardedWorker(1, { seed: SEED_B, rootN: 43 });
    const host = makeShardedHost(routeByNamespace([workerA, workerB]), {
      authorize: makeAuthorizer('pass'),
      timer: makeAccountingTimer().timer,
    });

    // 连接 1 持 A；连接 2（同工厂 ⟹ 键后缀互异）持 B。
    const pipeOne = makeRecordingPipe();
    const first = await host.acceptTrusted(pipeOne.hubTransport, { peerInstanceId: PEER_INSTANCE });
    expect(first).toBeDefined();
    for (const frame of [helloFrame(1), openFrame(workerA.namespaceId, 2)]) {
      pipeOne.sendInbound(frame);
      await settle();
    }
    const pipeTwo = makeRecordingPipe();
    const second = await host.acceptTrusted(pipeTwo.hubTransport, { peerInstanceId: PEER_INSTANCE });
    expect(second).toBeDefined();
    expect(second!.connectionKey).not.toBe(first!.connectionKey);
    for (const frame of [helloFrame(1), openFrame(workerB.namespaceId, 2)]) {
      pipeTwo.sendInbound(frame);
      await settle();
    }
    expect(host.probes.sessions).toHaveLength(2);

    first!.close();
    await settle();

    expect(first!.state).toBe('closed');
    expect(sessionOf(host, workerA.namespaceId).closeCalls, 'A 会话应收到 close 信号').toBeGreaterThanOrEqual(1);
    expect(sessionOf(host, workerB.namespaceId).closeCalls, 'B 会话被误收口').toBe(0);
    expect(second!.state).not.toBe('closed');

    const framesOfSecond = pipeTwo.frames().length;
    await workerB.scheduler.advanceBy(30_000);
    await settle();
    expect(pipeTwo.frames().length, '另一连接出现新出站').toBe(framesOfSecond);
  });

  it('REVOKE-C1 revoke 路由：terminate 恰一次；wire 出现 ns ERROR(NAMESPACE_UNAUTHORIZED)；末帧与单体 revoke(instanceIdentity, ns) 逐字节相等', async () => {
    const shardWorker = await makeShardedWorker(0, { seed: SEED_A, rootN: 42 });
    const monoWorker = await makeShardedWorker(0, { seed: SEED_A, rootN: 42 });
    expect(monoWorker.namespaceId).toBe(shardWorker.namespaceId);
    const script = [helloFrame(1), openFrame(shardWorker.namespaceId, 2)];

    const mono = await runMonolithTrace('pass', monoWorker.registry, script, {
      revoke: [shardWorker.namespaceId],
    });
    const shard = await runShardTrace('pass', [shardWorker], script, {
      revoke: [shardWorker.namespaceId],
    });

    expect(framesHexEqual(mono.frames.slice(-1), shard.frames.slice(-1)), 'revoke 末帧').toBeUndefined();
    const unauthorized = decodeAll(shard.frames).filter(
      (item) => item.kind === 'ERROR' && item.code === 'NAMESPACE_UNAUTHORIZED',
    );
    expect(unauthorized).toHaveLength(1);
    expect(unauthorized[0]!.namespaceId).toBe(shardWorker.namespaceId);
    expect(shard.sessions).toHaveLength(1);
    expect(shard.sessions[0]!.terminateCalls).toBe(1);
  });

  it('REVOKE-C2 跨 worker 零外溢：revoke B → B terminate 恰一次、A terminateCalls=0 且 wire 零 A 的 ERROR 帧', async () => {
    const workerA = await makeShardedWorker(0, { seed: SEED_A, rootN: 42 });
    const workerB = await makeShardedWorker(1, { seed: SEED_B, rootN: 43 });
    const script = [helloFrame(1), openFrame(workerA.namespaceId, 2), openFrame(workerB.namespaceId, 3)];
    const shard = await runShardTrace('pass', [workerA, workerB], script, {
      revoke: [workerB.namespaceId],
    });

    const sessionA = shard.sessions.find((session) => session.namespaceId === workerA.namespaceId);
    const sessionB = shard.sessions.find((session) => session.namespaceId === workerB.namespaceId);
    expect(sessionB?.terminateCalls).toBe(1);
    expect(sessionA?.terminateCalls).toBe(0);
    const spilled = decodeAll(shard.frames).filter(
      (item) => item.kind === 'ERROR' && item.namespaceId === workerA.namespaceId,
    );
    expect(spilled, 'revoke B 引发 A 的 ERROR 帧').toHaveLength(0);
  });

  it('REVOKE-C3 幂等无副作用：未知/已终态 ns 的 revoke 无副作用 resolve；重复 revoke 恒 resolve', async () => {
    const { host, pipe, connection, namespaceA, namespaceB } = await scenario();
    const framesBefore = pipe.frames().length;

    await connection.revokeNamespace(UNKNOWN_NS);
    await connection.revokeNamespace(UNKNOWN_NS);
    await settle();
    expect(pipe.frames().length, '未知 ns revoke 产生 wire').toBe(framesBefore);
    expect(sessionOf(host, namespaceA).terminateCalls).toBe(0);
    expect(sessionOf(host, namespaceB).terminateCalls).toBe(0);

    // 已终态 ns：revoke 后再 revoke 恒 resolve（幂等）。
    await connection.revokeNamespace(namespaceA);
    await connection.revokeNamespace(namespaceA);
    await settle();
    expect(sessionOf(host, namespaceA).terminateCalls).toBeGreaterThanOrEqual(1);
    expect(sessionOf(host, namespaceB).terminateCalls).toBe(0);
  });

  it('REAUTH-C1 drain 提前完成：beginReauth → GOAWAY(REAUTH_REQUIRED, drainTimeoutMs>0) 恰一帧；CLOSE_NAMESPACE → settled → close(1001)（零 deadline 推进）', async () => {
    const worker = await makeShardedWorker(0, { seed: SEED_A, rootN: 42 });
    const timer = makeAccountingTimer();
    const pipe = makeRecordingPipe();
    const host = makeShardedHost(() => worker, { authorize: makeAuthorizer('pass'), timer: timer.timer });
    const connection = await host.acceptTrusted(pipe.hubTransport, { peerInstanceId: PEER_INSTANCE });
    expect(connection).toBeDefined();
    for (const frame of [helloFrame(1), openFrame(worker.namespaceId, 2)]) {
      pipe.sendInbound(frame);
      await settle();
    }
    expect(host.probes.sessions).toHaveLength(1);

    connection!.beginReauth();
    await settle();
    const goaways = pipe.frames().filter(
      (bytes) =>
        (decodeMessage(bytes, { maxFrameBytes: LIMITS.maxFrameBytes }).message as { kind: string })
          .kind === 'GOAWAY',
    );
    expect(goaways, 'GOAWAY 数').toHaveLength(1);
    // 协议 §6.3/§21 L684：REAUTH_REQUIRED 窗口 drain>0（deadline 兜底 1001）。
    const goawayMessage = decodeMessage(goaways[0]!, { maxFrameBytes: LIMITS.maxFrameBytes }).message as {
      reasonCode: string;
      drainTimeoutMs: number;
    };
    expect(goawayMessage.reasonCode).toBe('REAUTH_REQUIRED');
    expect(goawayMessage.drainTimeoutMs).toBeGreaterThan(0);

    // drain 窗口内 CLOSE_NAMESPACE → 通道 settled → 全部终态 → 提前完成 drain → close(1001)。
    pipe.sendInbound(closeNsFrame(worker.namespaceId, 3));
    await settle();

    expect(decodeAll(pipe.frames()).filter((item) => item.kind === 'CLOSE_OK')).toHaveLength(1);
    expect(
      host.probes.signals.filter((signal) => signal === `settled:${worker.namespaceId}`),
    ).toHaveLength(1);
    expect(pipe.hubCloseInfo()?.code, 'drain 未提前完成（应 close(1001)）').toBe(1001);
    // 判据：close(1001) 发生在**零 deadline 推进**下（假 timer 零触发）。
    expect(timer.fires(), 'deadline timer 被触发').toBe(0);
  });

  it('REAUTH-C2 阴性对照：同脚本不发起 reauth → 连接不关闭（1001 归因于 drain 收口）', async () => {
    const worker = await makeShardedWorker(0, { seed: SEED_A, rootN: 42 });
    const pipe = makeRecordingPipe();
    const host = makeShardedHost(() => worker, {
      authorize: makeAuthorizer('pass'),
      timer: makeAccountingTimer().timer,
    });
    const connection = await host.acceptTrusted(pipe.hubTransport, { peerInstanceId: PEER_INSTANCE });
    expect(connection).toBeDefined();
    for (const frame of [helloFrame(1), openFrame(worker.namespaceId, 2)]) {
      pipe.sendInbound(frame);
      await settle();
    }

    pipe.sendInbound(closeNsFrame(worker.namespaceId, 3));
    await settle();

    expect(decodeAll(pipe.frames()).filter((item) => item.kind === 'GOAWAY')).toHaveLength(0);
    expect(pipe.hubCloseInfo(), '未发起 reauth 却关闭了连接').toBeUndefined();
    expect(connection!.state).not.toBe('closed');
  });

  it('SD-2(b) 退化负控：宿主登记缺失（factory 直连 accept）→ HELLO_ACK×1 + 连接级 ERROR(INTERNAL_ERROR)×1 + close(1011,protocol-error) + 零会话（响亮收口）', async () => {
    const worker = await makeShardedWorker(0, { seed: SEED_A, rootN: 42 });
    const pipe = makeRecordingPipe();
    const host = makeShardedHost(() => worker, {
      authorize: makeAuthorizer('pass'),
      timer: makeAccountingTimer().timer,
    });
    // 故意经 factory 直连 accept（**不**经 host.accept/acceptTrusted ⟹ 登记权威无该键）。
    const connection = await host.factory.acceptTrusted(pipe.hubTransport, {
      peerInstanceId: PEER_INSTANCE,
    });
    expect(connection).toBeDefined();
    expect(host.connections.size, '登记权威应为空').toBe(0);

    pipe.sendInbound(helloFrame(1));
    await settle();
    pipe.sendInbound(openFrame(worker.namespaceId, 2));
    await settle();

    const decoded = decodeAll(pipe.frames());
    expect(decoded.filter((item) => item.kind === 'HELLO_ACK')).toHaveLength(1);
    const connectionLevelInternal = decoded.filter(
      (item) => item.kind === 'ERROR' && item.code === 'INTERNAL_ERROR' && item.namespaceId === undefined,
    );
    expect(connectionLevelInternal, '连接级 INTERNAL_ERROR 数').toHaveLength(1);
    expect(host.probes.sessions, '零静默建会话').toHaveLength(0);
    expect(pipe.hubCloseInfo(), '未响亮收口').toEqual({ code: 1011, reason: 'protocol-error' });
  });
});
