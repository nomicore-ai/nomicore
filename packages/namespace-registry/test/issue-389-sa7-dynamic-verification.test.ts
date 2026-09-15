/**
 * issue #389 SA7 动态验证补充场景（dynamic-verify skill 允许的最小补充测试；
 * **非 SA6 验收契约**——不改契约文件/fixture，只复用 fixture 观察设计点名与
 * SA4 评审 §11 移交 SA7 的活链路跳点）。
 *
 * 覆盖缺口（SA4 §11「后续动态验证项」+ §12-N-O3；设计 §7-D1–D5 / §5 冻结位）：
 * - D-S1 peer 混合 update（同一 update 携带 SCHEMA text 变更 + ROOT tasks 新键）：
 *   R5 事务 data（origin='replication'）先入队、R5.7 终止项队尾追加 —— 同槽 FIFO
 *   `[data(replication), watch-end]`（SA4 §11 第 1 行；交付契约 C4 的 data 在 apply
 *   前已送达，非滞留构造）。
 * - D-S2 多订阅 × 多 lease 的 reset 投递结算：N sink（跨 lease、跨容器）在
 *   `resetReplica` 结算时已全部收到末条 `watch-end:'doc-replaced'`（免 poll；
 *   B-T3-3 drain = Promise.all 各订阅泵并发，SA4 §11 第 2 行）。
 * - D-S3 watch-end 投递的 listener throw 隔离与 drain 结算（X1 在终止项上的行为；
 *   SA4 §11 第 3 行）：坏消费者 throw 不影响好消费者、写结果与 reset 结算。
 * - D-S4 `terminateAll` 幂等 / 逐代恰一条终止（设计 §7-D1-4；SA4 N-O3-④）：
 *   同文本连续 replaceSchema——已终止订阅零重复终止项；重建后的新订阅各得恰一条。
 * - D-S5 reset mismatch 零破坏期（设计 §9：mismatch/missing 不发生终止、订阅照旧
 *   存活；错误路径不伪成功）。
 * - D-S6 正常 close 风味静默（设计 §5-§15-5：delete ≠ replace——deleteNamespace
 *   走 force-release + 正常 close admission，watch 订阅静默清场、零 watch-end）。
 *
 * 断言纪律沿 SA6 §12.5：形状 `toStrictEqual`、reason 逐字、零 skip/only/todo、
 * 零 sleep（sink 屏障 + 微任务预算）、全部断言仅经 lease/registry 公共面。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { User } from '@nomicore/persistence';
import type { NamespaceLeaseWatchMapNotification } from '@nomicore/namespace-registry';
import {
  buildT3Doc,
  createT3Registry,
  microtasks,
  openT3Hub,
  openT3Peer,
  openT3ResetFixture,
  remoteUpdateOf,
  schemaEnvelope,
  T3_DOC_ID,
  T3_OWNER,
  T3_SCHEMA_V2,
  T3Sink,
  T3StubPersistence,
  waitForSchemaReady,
} from './issue-389-change-subscription-t3-fixture.js';

const OWNER = { userId: T3_OWNER.userId };

/** 远端 apply 的新键条目写（Yjs 确定性纪律：只写 live doc 尚不存在的新键）。 */
function scratchAddTask(scratch: Y.Doc, key: string, title: string, priority: number): void {
  const tasks = scratch.getMap('ROOT').get('tasks') as Y.Map<unknown>;
  const entry = new Y.Map<unknown>();
  entry.set('title', title);
  entry.set('priority', priority);
  tasks.set(key, entry);
}

/** 坏消费者：先记录再 throw（X1 隔离观察位——throw 不中断投递序列）。 */
function throwingSink(): {
  readonly received: NamespaceLeaseWatchMapNotification[];
  readonly listener: (notification: NamespaceLeaseWatchMapNotification) => void;
} {
  const received: NamespaceLeaseWatchMapNotification[] = [];
  return {
    received,
    listener: (notification) => {
      received.push(notification);
      throw new Error('sa7-bad-consumer');
    },
  };
}

// ═══════════ D-S1：peer 混合 update 的滞留 data FIFO（SA4 §11-1） ═══════════

describe('SA7 D-S1：peer 单笔混合 update（SCHEMA text + ROOT 新键）——data 先达、watch-end 末条', () => {
  it('R5 事务 data(origin=replication) 入队先于 R5.7 终止项；终止后零僵尸通知', async () => {
    const hub = await openT3Hub({ replication: true });
    const peer = await openT3Peer(hub);
    const sink = new T3Sink();
    peer.lease.watchMap(['tasks'], sink.listener);

    // 混合 update：bootstrap peer live 全量状态后，同一 scratch 上改 SCHEMA text（V2
    // 真变）+ 写 ROOT tasks 新键 t9 —— 两条变更进同一 update（R5 单事务 apply）。
    const mixed = remoteUpdateOf(peer.doc, (scratch) => {
      scratch.getMap('SCHEMA').set('text', T3_SCHEMA_V2);
      scratchAddTask(scratch, 't9', 'mixed-update', 9);
    });
    const applied = await peer.session.applyRemoteUpdate(mixed);
    expect(applied.ok, `D-S1 前提：peer apply 应成功（${JSON.stringify(applied)}）`).toBe(true);
    if (!applied.ok) return;
    expect(applied.schemaRearm?.kind, 'D-S1 oracle：re-arm 必须 applied（红灯不得误归因）').toBe(
      'applied',
    );

    await sink.waitForWatchEnd('schema-changed');
    expect(
      sink.kinds(),
      'D-S1/AC5：同一 update 的 data 与终止项同流有序——data 先达、watch-end 末条',
    ).toStrictEqual(['data', 'watch-end']);
    expect(sink.dataNotifications()[0], 'D-S1/AC1：混合 update 的 ROOT 变更 origin=replication').toStrictEqual(
      { kind: 'data', origin: 'replication', changes: [{ path: ['tasks'], key: 't9' }] },
    );
    expect(sink.last()).toStrictEqual({ kind: 'watch-end', reason: 'schema-changed' });

    // 终止后静默：re-arm 后新 schema（V2）下再写一笔合法数据——旧订阅零僵尸通知
    const after = await peer.lease.mutateData({
      op: 'set',
      path: ['tasks', 't10'],
      value: { title: 'after-termination', priority: 10, note: 'v2-field' },
    });
    expect(after.ok, 'D-S1 前提：终止后 lease 仍 active，V2 下写合法').toBe(true);
    await microtasks(400);
    expect(sink.received.length, 'AC4：终止后零僵尸 data（已注销 = 零入队点）').toBe(2);
  });
});

// ═══════════ D-S2：多订阅 × 多 lease 的 reset 投递结算（SA4 §11-2） ═══════════

describe('SA7 D-S2：reset 多订阅/多 lease——全部 sink 结算即已收末条 doc-replaced（免 poll）', () => {
  it('2 lease × 3 sink（含零 data 的 ghost 订阅）全部在 resetReplica 结算时已投递终止项', async () => {
    const fixture = await openT3ResetFixture();
    const sinkTasks = new T3Sink();
    const sinkGhost = new T3Sink();
    const handleTasks = fixture.lease.watchMap(['tasks'], sinkTasks.listener);
    fixture.lease.watchMap(['ghost'], sinkGhost.listener);

    const second = await fixture.registry.open(OWNER, T3_DOC_ID);
    expect(second.ok, `D-S2 前提：同 entry 第二 lease 应成功（${JSON.stringify(second)}）`).toBe(true);
    if (!second.ok) return;
    await waitForSchemaReady(second.lease);
    const sinkSecondLease = new T3Sink();
    second.lease.watchMap(['tasks'], sinkSecondLease.listener);

    const write = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: 'before-reset', priority: 3 },
    });
    expect(write.ok).toBe(true);
    await sinkTasks.waitForCount(1);
    await sinkSecondLease.waitForCount(1);

    const reset = await fixture.registry.resetReplica(OWNER, T3_DOC_ID, fixture.identity);
    expect(reset.ok, `D-S2：resetReplica 应 ok（${JSON.stringify(reset)}）`).toBe(true);

    // 免 poll 断言：结算 = close 承诺 ∧ 全部终止项已投递（B-T3-3）
    expect(sinkTasks.kinds(), 'D-S2：lease1/tasks = [data, watch-end]').toStrictEqual([
      'data',
      'watch-end',
    ]);
    expect(sinkGhost.kinds(), 'D-S2：零 data 的订阅也恰收一条终止项（终止作用于全部存活订阅）').toStrictEqual([
      'watch-end',
    ]);
    expect(sinkGhost.last()).toStrictEqual({ kind: 'watch-end', reason: 'doc-replaced' });
    expect(sinkSecondLease.kinds(), 'D-S2：lease2 同刻终止（force-release 全量）').toStrictEqual([
      'data',
      'watch-end',
    ]);
    expect(sinkSecondLease.last()).toStrictEqual({ kind: 'watch-end', reason: 'doc-replaced' });
    expect(fixture.lease.getStatus().lease, 'D-S2：lease1 released').toBe('released');
    expect(second.lease.getStatus().lease, 'D-S2：lease2 released').toBe('released');

    // 终止后 unsubscribe 幂等 no-op（AC4；×2 零 throw、零新增通知）
    const beforeUnsub = sinkTasks.received.length;
    handleTasks.unsubscribe();
    handleTasks.unsubscribe();
    expect(sinkTasks.received.length).toBe(beforeUnsub);
    expect(sinkTasks.watchEnds().length).toBe(1);
    expect(sinkGhost.watchEnds().length).toBe(1);
    expect(sinkSecondLease.watchEnds().length).toBe(1);
  });
});

// ═══════════ D-S3：watch-end 投递的 listener throw 隔离 + drain 结算（SA4 §11-3） ═══════════

describe('SA7 D-S3：坏消费者 throw 不影响好消费者、写结果、reset 结算（X1 延伸到终止项）', () => {
  it('schema 路径：坏 sink 在 data 与 watch-end 上均 throw——好 sink 收齐、replaceSchema ok', async () => {
    const hub = await openT3Hub();
    const bad = throwingSink();
    const good = new T3Sink();
    hub.lease.watchMap(['tasks'], bad.listener);
    hub.lease.watchMap(['tasks'], good.listener);

    const write = await hub.lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: 'throw-isolation', priority: 3 },
    });
    expect(write.ok, 'X1：坏消费者 throw 不影响写结果').toBe(true);
    await good.waitForCount(1);

    const replaced = await hub.lease.replaceSchema({ schema: schemaEnvelope(T3_SCHEMA_V2) });
    expect(replaced.ok, 'X1：坏消费者 throw 不影响 schema 写结果').toBe(true);
    await good.waitForWatchEnd('schema-changed');

    expect(good.kinds(), 'D-S3：好消费者收齐 data + watch-end').toStrictEqual(['data', 'watch-end']);
    await microtasks(400);
    expect(bad.received.length, 'D-S3：坏消费者自身投递序列不被 throw 中断（data + 终止项均达）').toBe(2);
    expect(bad.received[1]).toStrictEqual({ kind: 'watch-end', reason: 'schema-changed' });
    expect(hub.lease.getStatus().lease).toBe('active');
  });

  it('reset 路径：坏 sink 在自己的 doc-replaced 投递上 throw——reset 结算仍含 drain（好 sink 末条已投递）', async () => {
    const fixture = await openT3ResetFixture();
    const bad = throwingSink();
    const good = new T3Sink();
    fixture.lease.watchMap(['tasks'], bad.listener);
    fixture.lease.watchMap(['tasks'], good.listener);

    const write = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: 'before-reset', priority: 3 },
    });
    expect(write.ok).toBe(true);
    await good.waitForCount(1);

    const reset = await fixture.registry.resetReplica(OWNER, T3_DOC_ID, fixture.identity);
    expect(reset.ok, 'D-S3：reset 结算 = barrier ∧ 全部 drain（含坏消费者）——throw 不悬挂结算').toBe(true);
    // 结算即已投递（免 poll）：好 sink 与坏 sink 的终止项均已在流末
    expect(good.kinds()).toStrictEqual(['data', 'watch-end']);
    expect(good.last()).toStrictEqual({ kind: 'watch-end', reason: 'doc-replaced' });
    expect(bad.received.length, 'D-S3：坏消费者的终止项也已投递（drain resolve）').toBe(2);
    expect(bad.received[1]).toStrictEqual({ kind: 'watch-end', reason: 'doc-replaced' });
  });
});

// ═══════════ D-S4：terminateAll 幂等 / 逐代恰一条终止（设计 §7-D1-4；SA4 N-O3-④） ═══════════

describe('SA7 D-S4：连续 schema 变更——已终止订阅零重复终止项；重建订阅各得恰一条', () => {
  it('同文本连续 replaceSchema ×3：第一代订阅恰 1 条 watch-end；重建订阅恰 1 条；新数据正常投递', async () => {
    const hub = await openT3Hub();
    const first = new T3Sink();
    hub.lease.watchMap(['tasks'], first.listener);

    const write = await hub.lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: 'gen-1', priority: 3 },
    });
    expect(write.ok).toBe(true);
    await first.waitForCount(1);

    const replaced1 = await hub.lease.replaceSchema({ schema: schemaEnvelope(T3_SCHEMA_V2) });
    expect(replaced1.ok).toBe(true);
    await first.waitForWatchEnd('schema-changed');
    expect(first.watchEnds().length).toBe(1);

    // 第二次（同文本——本地路径无 text 门，设计 §7-D3 N-3）：存活集合已空 ⟹ 零新终止项
    const replaced2 = await hub.lease.replaceSchema({ schema: schemaEnvelope(T3_SCHEMA_V2) });
    expect(replaced2.ok).toBe(true);
    await microtasks(400);
    expect(first.watchEnds().length, 'D1-4 幂等：已终止订阅不在集合内，零重复终止项').toBe(1);
    expect(first.kinds()).toStrictEqual(['data', 'watch-end']);

    // 重建（AC6）：新订阅在下一 schema 变更时恰得一条终止项；旧订阅不重复
    const reborn = new T3Sink();
    hub.lease.watchMap(['tasks'], reborn.listener);
    const replaced3 = await hub.lease.replaceSchema({ schema: schemaEnvelope(T3_SCHEMA_V2) });
    expect(replaced3.ok).toBe(true);
    await reborn.waitForWatchEnd('schema-changed');
    expect(reborn.watchEnds().length, 'D1-4：重建订阅恰一条（第二次 terminateAll 作用于新集合）').toBe(1);
    expect(first.watchEnds().length).toBe(1);

    // 再重建后的新订阅在新 schema 下正常投递数据（resubscription 正例）
    const reborn2 = new T3Sink();
    hub.lease.watchMap(['tasks'], reborn2.listener);
    const after = await hub.lease.mutateData({
      op: 'set',
      path: ['tasks', 't5'],
      value: { title: 'gen-3', priority: 5, note: 'v2-note' },
    });
    expect(after.ok).toBe(true);
    await reborn2.waitForCount(1);
    expect(reborn2.received[0]).toStrictEqual({
      kind: 'data',
      origin: 'local',
      changes: [{ path: ['tasks'], key: 't5' }],
    });
    expect(reborn2.watchEnds()).toStrictEqual([]);
  });
});

// ═══════════ D-S5：reset mismatch 零破坏期（设计 §9 错误路径） ═══════════

describe('SA7 D-S5：reset identity mismatch——零破坏、零终止、订阅照旧存活', () => {
  it('mismatch → NAMESPACE_RESET_IDENTITY_MISMATCH；此后数据照常投递；正确 reset 后 doc-replaced 末条', async () => {
    const fixture = await openT3ResetFixture();
    const sink = new T3Sink();
    fixture.lease.watchMap(['tasks'], sink.listener);

    const write = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: 'before-mismatch', priority: 3 },
    });
    expect(write.ok).toBe(true);
    await sink.waitForCount(1);

    const mismatch = await fixture.registry.resetReplica(OWNER, T3_DOC_ID, {
      replicationId: 'b'.repeat(32),
      replicationEpoch: fixture.identity.replicationEpoch,
    });
    expect(mismatch.ok, 'D-S5：mismatch 必须显式失败（错误路径不伪成功）').toBe(false);
    if (!mismatch.ok) {
      expect(mismatch.code).toBe('NAMESPACE_RESET_IDENTITY_MISMATCH');
    }
    await microtasks(400);
    expect(sink.watchEnds(), 'D-S5：零破坏期不发生终止（doc 未被替换）').toStrictEqual([]);
    expect(fixture.lease.getStatus().lease, 'D-S5：零破坏期 lease 仍 active').toBe('active');
    expect(fixture.persistence.archiveCalls.length, 'D-S5：mismatch 零归档').toBe(0);

    // 订阅照旧存活：后续写照常投递
    const again = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't4'],
      value: { title: 'after-mismatch', priority: 4 },
    });
    expect(again.ok).toBe(true);
    await sink.waitForCount(2);
    expect(sink.dataKeys()).toStrictEqual(['t3', 't4']);

    // 随后正确 reset → 终止项按契约送达（流末条）
    const reset = await fixture.registry.resetReplica(OWNER, T3_DOC_ID, fixture.identity);
    expect(reset.ok).toBe(true);
    expect(sink.kinds()).toStrictEqual(['data', 'data', 'watch-end']);
    expect(sink.last()).toStrictEqual({ kind: 'watch-end', reason: 'doc-replaced' });
  });
});

// ═══════════ D-S6：正常 close 风味静默（设计 §5-§15-5：delete ≠ replace） ═══════════

/** deleteNamespace 需要 persistence.deleteDoc 能力——fixture stub 的最小扩展（本文件私有）。 */
class Sa7DeleteCapablePersistence extends T3StubPersistence {
  readonly deleteCalls: Array<{ owner: User; docId: string }> = [];

  async deleteDoc(owner: User, docId: string): Promise<Readonly<{ ok: true }>> {
    this.deleteCalls.push({ owner, docId });
    return { ok: true };
  }
}

describe('SA7 D-S6：deleteNamespace（正常 close 风味）——watch 订阅静默清场、零 watch-end', () => {
  it('活 lease + 活订阅下删除：零 watch-end、lease released、已投递流不复活', async () => {
    const persistence = new Sa7DeleteCapablePersistence();
    persistence.seedDocument(T3_OWNER, T3_DOC_ID, buildT3Doc());
    const { registry } = createT3Registry(persistence, 'hub');
    const opened = await registry.open(OWNER, T3_DOC_ID);
    expect(opened.ok, `D-S6 前提：open 应成功（${JSON.stringify(opened)}）`).toBe(true);
    if (!opened.ok) return;
    const lease = opened.lease;
    await waitForSchemaReady(lease);

    const sink = new T3Sink();
    lease.watchMap(['tasks'], sink.listener);
    const write = await lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: 'before-delete', priority: 3 },
    });
    expect(write.ok).toBe(true);
    await sink.waitForCount(1);

    const deleted = await registry.deleteNamespace(OWNER, T3_DOC_ID);
    expect(deleted.ok, `D-S6：deleteNamespace 应 ok（${JSON.stringify(deleted)}）`).toBe(true);
    expect(persistence.deleteCalls.length).toBe(1);

    await microtasks(400);
    expect(sink.watchEnds(), '§15-5：删除 ≠ 替换——正常 close 风味静默收口，零 watch-end').toStrictEqual([]);
    expect(sink.kinds(), 'D-S6：已投递流保持、无新通知（静默清场）').toStrictEqual(['data']);
    expect(lease.getStatus().lease, 'D-S6：force-release 后 lease released').toBe('released');
  });
});
