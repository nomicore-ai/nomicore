/**
 * SA6 验收契约 — issue #424（spec #415 T7）：**跨缝完整协议回合**（AC2；契约 §12.2 ROUND-C1~C4）。
 *
 * 装配形态（设计 §8.3 —— 本套件是 F-R1 修订的承重面）：
 *
 *   `boot({ createHub })` 注入 adopt 形态 facade（`makeShardedReplicationFacade`）——
 *   facade 把 boot 传入的 `options.registry`/`options.timer` **结构性采纳**为 ROUND 会话宿主的
 *   registry/timer（内部恰一个 `AdoptedWorker`，无 route 参数 ⟹ 错位装配不可表达）。
 *
 *   **boot 形态 registry 同一性约束（设计 §8.3.1）**：boot 的 hub 侧观察面（`run.writeHub` /
 *   `run.snapshotDoc('hub')` / `run.rootValue('hub')` / `run.bumpHubEpoch`）全部硬绑 boot 内部
 *   `hubNode`；只有会话宿主建于 `options.registry`（≡ `run.hubNode.registry`，同一对象）之上时，
 *   hub fixture 文档与复制会话驱动的文档才同源（ROUND-C1 收敛 / ROUND-C2 hub→peer UPDATE 的
 *   前提）。**每个形态 boot 后先执行引用同一性前提断言**——装配错位在场景前置即红，错误信息
 *   指向装配而非生产（SD-1 前置甄别，防伪偏差）。
 *
 *   （前提断言假定未包装的 boot registry：`driver.wrapHubRegistry` 故障注入 seam 不在本票面内。）
 *
 * 纪律：断言 = 运行时行为（wire 帧 kind/序 / `ackedSequence` 回指 / namespace 状态 / 文档
 * 收敛字节 / 会话计数 / scheduler pending / unhandled rejection）；零源码 grep；零 skip/only/todo；
 * 真 peer（`createPeerReplication`）+ 真 Registry/Runtime + 公共工厂真身。
 *
 * 规范引用（设计 §12.1）：协议 §6.3 L159 + §21 L684（GOAWAY drain：全部 channel 终态可**提前
 * 完成**，否则 deadline 到达以 WS 1001 关闭）、§12 L375（`CLOSE_OK.ackedSequence` 回指
 * `CLOSE_NAMESPACE` sequence）、§5 L114 + §6.1 L137（`UPDATE_CHUNK` 仅经协商后可用；
 * `CAP_CHUNKED_UPDATE = 0x00000001`）、§22 L701（conformance 三层断言）；ADR 0032 决策 1
 * （单体 listen = Edge 与 SessionHost 的进程内组合；协议状态机单份，只允许分布式实例化）。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { CAP_CHUNKED_UPDATE } from '@nomicore/replication-protocol';
import { advanceMs, boot, collectUnhandledRejections, type Run } from './driver.js';
import { settle, settleUntil } from './harness.js';
import {
  type ShardedFacade,
  makeShardedReplicationFacade,
} from './issue424-sharded-hub.js';

interface RoundRun {
  readonly run: Run;
  readonly sharded: ShardedFacade;
}

/** boot 一个 adopt 装配的分片回合（并在场景前置断言 registry 引用同一性）。 */
async function bootRound(chunkedUpdate?: boolean): Promise<RoundRun> {
  let sharded: ShardedFacade | undefined;
  const run = await boot({
    ...(chunkedUpdate === undefined ? {} : { chunkedUpdate }),
    createHub: (options) => {
      sharded = makeShardedReplicationFacade(options);
      return sharded.replication;
    },
  });
  if (sharded === undefined) throw new Error('ROUND 装配前提失败：facade 未被 boot 调用');
  // ROUND 装配前提（设计 §12.0/§8.3.1）：会话宿主的 registry 必须是 boot 传入的同一对象。
  expect(
    sharded.worker.registry,
    'ROUND 装配前提：worker.registry 必须 === run.hubNode.registry（同一对象）',
  ).toBe(run.hubNode.registry);
  return { run, sharded };
}

function hexOf(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

function ackedSequenceOf(frame: { readonly message: unknown }): number {
  return (frame.message as { ackedSequence: number }).ackedSequence;
}

/** ROUND-C1：OPEN → bootstrap → reconcile → live + 文档收敛。 */
function assertRoundC1(run: Run): void {
  expect(run.hubFrames('OPEN_OK'), 'OPEN_OK 数').toHaveLength(1);
  const snapshots = run.hubFrames('BOOTSTRAP_SNAPSHOT');
  expect(snapshots, 'BOOTSTRAP_SNAPSHOT 数').toHaveLength(1);

  const bootstrapAcks = run.peerFrames('BOOTSTRAP_ACK');
  expect(bootstrapAcks, 'peer BOOTSTRAP_ACK 数').toHaveLength(1);
  expect(ackedSequenceOf(bootstrapAcks[0]!), 'BOOTSTRAP_ACK 回指快照帧序').toBe(
    snapshots[0]!.header.sequence,
  );

  // reconcile 三段各 ≥1（双方向 round 均计数；契约只要求「各 ≥1」）。
  for (const kind of ['SYNC_STEP1', 'SYNC_STEP2', 'SYNC_APPLIED'] as const) {
    expect(
      run.peerFrames(kind).length + run.hubFrames(kind).length,
      `${kind} 数`,
    ).toBeGreaterThanOrEqual(1);
  }

  expect(run.namespaceState(), 'namespace 状态').toBe('live');
  // 收敛：hub/peer live doc 的 `encodeStateAsUpdate` 逐字节相等（同源前提由 boot 前断言保证）。
  expect(hexOf(Y.encodeStateAsUpdate(run.snapshotDoc('hub'))), 'hub/peer 文档收敛').toBe(
    hexOf(Y.encodeStateAsUpdate(run.snapshotDoc('peer'))),
  );
}

/** ROUND-C2：live 双向更新（peer→hub UPDATE + ACK 回指；hub→peer UPDATE + ROOT 更新）。 */
async function assertRoundC2(run: Run): Promise<void> {
  await run.writePeer({ n: 7 });
  await settleUntil(() => run.hubFrames('UPDATE_ACK').length >= 1, 'peer UPDATE_ACK');
  await settle();

  const peerUpdates = run.peerFrames('UPDATE');
  const hubAcks = run.hubFrames('UPDATE_ACK');
  expect(peerUpdates, 'peer→hub UPDATE 数').toHaveLength(1);
  expect(hubAcks, 'UPDATE_ACK 数').toHaveLength(1);
  expect(ackedSequenceOf(hubAcks[0]!), 'UPDATE_ACK 回指入站序').toBe(
    peerUpdates[0]!.header.sequence,
  );
  expect(run.rootValue('hub', 'n'), 'hub ROOT.n').toBe(7);

  const hubUpdatesBefore = run.hubFrames('UPDATE').length;
  await run.writeHub({ n: 43 });
  await settleUntil(() => run.hubFrames('UPDATE').length > hubUpdatesBefore, 'hub→peer UPDATE');
  await settle();
  expect(run.hubFrames('UPDATE'), 'hub→peer UPDATE 数').toHaveLength(hubUpdatesBefore + 1);
  expect(run.rootValue('peer', 'n'), 'peer ROOT.n').toBe(43);
  // 零 resync-required：两侧仍在 live。
  expect(run.namespaceState(), 'namespace 状态（零 resync）').toBe('live');
}

/** ROUND-C3：CLOSE 回合（CLOSE_OK 回指 + settled 经缝恰一次）。 */
async function assertRoundC3(run: Run, sharded: ShardedFacade): Promise<void> {
  await run.peer.removeTarget(run.nsId);
  await settleUntil(() => run.hubFrames('CLOSE_OK').length >= 1, 'CLOSE_OK');
  await settle();

  const closeRequests = run.peerFrames('CLOSE_NAMESPACE');
  const closeOks = run.hubFrames('CLOSE_OK');
  expect(closeRequests, 'CLOSE_NAMESPACE 数').toHaveLength(1);
  expect(closeOks, 'CLOSE_OK 数').toHaveLength(1);
  // 协议 §12 L375：CLOSE_OK.ackedSequence 回指 CLOSE_NAMESPACE sequence。
  expect((closeOks[0]!.message as { ackedSequence: number }).ackedSequence, 'CLOSE_OK 回指序').toBe(
    closeRequests[0]!.header.sequence,
  );
  // settled 信号经 session→edge 缝恰一次转发。
  expect(
    sharded.host.probes.signals.filter((signal) => signal === `settled:${run.nsId}`),
    `settled 信号（${JSON.stringify(sharded.host.probes.signals)}）`,
  ).toHaveLength(1);
}

describe('issue #424 AC2 — 跨缝完整协议回合（boot adopt 装配）', () => {
  it('ROUND-C1 非协商形态：adopt 装配前提成立；OPEN_OK×1 + BOOTSTRAP_SNAPSHOT×1 + peer BOOTSTRAP_ACK×1（回指）；SYNC 三段齐备；live；hub/peer 文档收敛', async () => {
    const { run } = await bootRound();
    assertRoundC1(run);
  });

  it('ROUND-C2 非协商形态：live 双向——peer 写 → UPDATE×1 + UPDATE_ACK（回指入站序）+ hub ROOT 更新；hub 写 → UPDATE×1 + peer ROOT 更新（零 resync）', async () => {
    const { run } = await bootRound();
    await assertRoundC2(run);
  });

  it('ROUND-C3 非协商形态：CLOSE_NAMESPACE×1 → CLOSE_OK×1（回指）+ settled 信号恰一次（经缝转发）', async () => {
    const { run, sharded } = await bootRound();
    await assertRoundC3(run, sharded);
  });

  it('ROUND-C4 协商形态（chunkedUpdate:true）：C1~C3 全回合复跑成立；HELLO_ACK 与会话描述子均携带 CAP_CHUNKED_UPDATE 协商位', async () => {
    const { run, sharded } = await bootRound(true);

    const helloAcks = run.hubFrames('HELLO_ACK');
    expect(helloAcks, 'HELLO_ACK 数').toHaveLength(1);
    // 协议 §6.1 L137：CAP_CHUNKED_UPDATE = 0x00000001（required 满足后的交集）。
    expect(
      (helloAcks[0]!.message as { selectedCapabilities: number }).selectedCapabilities &
        CAP_CHUNKED_UPDATE,
      'HELLO_ACK.selectedCapabilities 协商位',
    ).not.toBe(0);
    expect(sharded.host.probes.opens, '描述子数').toHaveLength(1);
    expect(
      sharded.host.probes.opens[0]!.selectedCapabilities & CAP_CHUNKED_UPDATE,
      '描述子 selectedCapabilities 协商位',
    ).not.toBe(0);

    assertRoundC1(run);
    await assertRoundC2(run);
    await assertRoundC3(run, sharded);
  });

  it('ROUND 收尾（boot 形态 TERM 面）：close 幂等（同 promise）+ 会话全收口 + hub scheduler pending 不增 + 零新出站 + 零 unhandled rejection', async () => {
    const unhandled = collectUnhandledRejections();
    try {
      const { run, sharded } = await bootRound();
      assertRoundC1(run);
      await assertRoundC3(run, sharded);

      await run.peer.stop();
      await settle();
      const pendingBefore = run.hubNode.scheduler.pending();
      const framesBeforeClose = run.allFrames().hubToPeer.length;

      const first = run.hub.close();
      expect(run.hub.close(), 'facade.close 幂等（同 promise）').toBe(first);
      await first;
      await settle();

      const closes = sharded.host.probes.sessions.map((session) => session.closeCalls);
      expect(closes.length).toBeGreaterThanOrEqual(1);
      expect(closes.every((count) => count >= 1), `closeCalls=[${closes.join(',')}]`).toBe(true);
      // 无泄漏：hub 侧 scheduler pending 不增（boot 形态 = run.hubNode.scheduler，被采纳 timer）。
      expect(run.hubNode.scheduler.pending()).toBeLessThanOrEqual(pendingBefore);

      await advanceMs(run, 30_000);
      expect(run.allFrames().hubToPeer.length, 'close 后仍有新出站').toBe(framesBeforeClose);
      expect(unhandled.events, 'unhandled rejection').toEqual([]);
    } finally {
      unhandled.dispose();
    }
  });
});
