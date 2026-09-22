/**
 * issue #437 验收契约（最高 seam = lease `mutateData`）— 数组逐元素校验行为钉死
 * （ADR 0033 决策 1/2/3/4；任务简报 AC1–AC5）。
 *
 * 语义已于 #435（vfsl 逐元素接缝）与 #436（doc-runtime fast path 接线）落地；本票
 * **不改实现**，只把用户可见行为与不变量在 lease seam 立法成端到端回归测试：
 *
 *   AC1 行为变化：raw-replication 污染（元素载体/值非法）的数组做 array-delete /
 *        array-insert 照常 ok:true（旧语义为响亮拒绝）；触达面外非法数据不被普通
 *        写发现（污染保留、不修复、不阻断）。
 *   AC2 不变量：非法新元素零写入 + issue 路径 `[...arrayPath, index+j]` 不变；越界
 *        拒绝语义逐字不变；空载荷/空批量（`values: []` / `count: 0` / `{ops: []}`）
 *        在信封形状门照旧拒绝、零写入（恒等 accept 的 noop 属 vfsl 接缝，见 #435 B6）。
 *   AC3 union 数组目标端到端行为不变（永久 legacy 全量边界轨）——见负控文件。
 *   AC4 诊断烟测：fast-path 数组写的 committed update bytes 记录形态不变（内联
 *        carrier + 真事务增量重放 + 与标量写记录键集同构）。
 *   AC5 复制烟测：fast-path 提交经 replication apply 在对端收敛；owned update 为
 *        最小增量形态（对空 doc 不物化）、一次提交恰一事件（协议承载物零变化）。
 *
 * 判据纪律：只观察运行时行为（lease 判别联合结果、issue message/path、readData 逻辑
 * 值、replication owned update、诊断 record/carrier）；零 skip/only/todo、零 env
 * override、零 fallback、零源码字符串断言。
 *
 * 敏感性（「旧实现须在目标断言处失败」）：AC1 组是判别组——在 #436 之前（
 * `7407ce0`，doc-runtime 一律 legacy 全量边界路径）同一用例在 lease seam 得到
 * `ok:false` 响亮拒绝；证据见 SA6 契约报告 §13。AC2/AC4/AC5 为不变量组（旧新同绿）。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  applyRawRemote,
  carrierBytes,
  countElementReadsAsync,
  openLeaseFixture,
  openPeerFixture,
  readArray,
  rootArray,
  readValue,
  rootMutationRecord,
  updateCarrierOf,
  waitForAttemptRecords,
  waitForOwnedUpdates,
} from './issue-437-lease-array-e2e-fixture.js';

/** 微任务沉降（零 real sleep；session 扇出/诊断泵为异步投递）。 */
async function flushMicrotasks(times = 24): Promise<void> {
  for (let i = 0; i < times; i += 1) await Promise.resolve();
}

function issueOf(result: unknown): Array<{ message: string; path: Array<string | number> }> {
  const candidate = result as { ok: boolean; issues?: Array<{ message: string; path: Array<string | number> }> };
  expect(candidate.ok).toBe(false);
  return candidate.issues ?? [];
}

// ═══════════════════════ AC1 行为变化（判别组）═══════════════════════

describe('issue #437 AC1 — raw-replication 污染不再阻断普通数组写（ADR 0033 决策 4，旧语义为响亮拒绝）', () => {
  it('AC1-a 区间外值污染（number 数组含 raw string）：lease array-delete 照常 ok:true 且污染保留', async () => {
    const fx = await openLeaseFixture({ replication: true });
    await applyRawRemote(fx.session!, fx.doc, (doc) => {
      rootArray(doc, 'items').insert(0, ['oops']);
    });
    expect(readArray(fx.lease, ['items'])).toEqual(['oops', 1, 2, 3, 4, 5]);

    const result = await fx.lease.mutateData({ op: 'array-delete', path: ['items'], index: 2, count: 1 });
    expect(result).toEqual({ ok: true });
    // 触达面外污染不被普通写发现：未触达元素保持原样（不修复、不阻断）
    expect(readArray(fx.lease, ['items'])).toEqual(['oops', 1, 3, 4, 5]);
    await waitForOwnedUpdates(fx, 1);
    expect(fx.ownedUpdates.length).toBe(1); // 恰一次提交（单最小 edit）
  });

  it('AC1-b 区间外污染不阻断 array-insert：合法新值逐元素过 schema，污染元素零读取零修复', async () => {
    const fx = await openLeaseFixture({ replication: true });
    await applyRawRemote(fx.session!, fx.doc, (doc) => {
      rootArray(doc, 'items').insert(0, ['oops']);
    });
    const result = await fx.lease.mutateData({
      op: 'array-insert',
      path: ['items'],
      index: 2,
      values: [9],
    });
    expect(result).toEqual({ ok: true });
    expect(readArray(fx.lease, ['items'])).toEqual(['oops', 1, 9, 2, 3, 4, 5]);
    await waitForOwnedUpdates(fx, 1);
    expect(fx.ownedUpdates.length).toBe(1);
  });

  it('AC1-c 元素载体非法（记录数组含裸值）：lease array-delete 照常 ok:true', async () => {
    const fx = await openLeaseFixture({ replication: true });
    await applyRawRemote(fx.session!, fx.doc, (doc) => {
      rootArray(doc, 'rows').insert(0, [7]); // 元素载体非法（期望 Y.Map，实为 plain number）
    });
    expect(readArray(fx.lease, ['rows'])).toEqual([
      7,
      { qty: 1, tag: 'a' },
      { qty: 2, tag: 'b' },
      { qty: 3, tag: 'c' },
    ]);

    const result = await fx.lease.mutateData({ op: 'array-delete', path: ['rows'], index: 2, count: 1 });
    expect(result).toEqual({ ok: true });
    expect(readArray(fx.lease, ['rows'])).toEqual([7, { qty: 1, tag: 'a' }, { qty: 3, tag: 'c' }]);
  });

  it('AC1-d 元素字段值非法（记录数组含 qty:string 元素）：lease array-delete 照常 ok:true', async () => {
    const fx = await openLeaseFixture({ replication: true });
    await applyRawRemote(fx.session!, fx.doc, (doc) => {
      const bad = new Y.Map<unknown>();
      bad.set('qty', 'x');
      bad.set('tag', 'oops');
      rootArray(doc, 'rows').insert(0, [bad]);
    });
    expect(readArray(fx.lease, ['rows'])).toEqual([
      { qty: 'x', tag: 'oops' },
      { qty: 1, tag: 'a' },
      { qty: 2, tag: 'b' },
      { qty: 3, tag: 'c' },
    ]);

    const result = await fx.lease.mutateData({ op: 'array-delete', path: ['rows'], index: 2, count: 1 });
    expect(result).toEqual({ ok: true });
    expect(readArray(fx.lease, ['rows'])).toEqual([
      { qty: 'x', tag: 'oops' },
      { qty: 1, tag: 'a' },
      { qty: 3, tag: 'c' },
    ]);
  });
  it('AC1-e 批量信封内的数组分支同样分流：污染数组 delete 在批内 ok:true', async () => {
    const fx = await openLeaseFixture({ replication: true });
    await applyRawRemote(fx.session!, fx.doc, (doc) => {
      rootArray(doc, 'items').insert(0, ['oops']);
    });
    const result = await fx.lease.mutateData({
      ops: [{ op: 'array-delete', path: ['items'], index: 2, count: 1 }],
    });
    expect(result).toEqual({ ok: true });
    expect(readArray(fx.lease, ['items'])).toEqual(['oops', 1, 3, 4, 5]);
    await waitForOwnedUpdates(fx, 1);
    expect(fx.ownedUpdates.length).toBe(1);
  });
});

// ═══════════════════════ AC2 不变量（旧新同绿）═══════════════════════

describe('issue #437 AC2 — 非法新元素零写入 + issue 路径不变；越界/空批量语义不变（ADR 0033 决策 2）', () => {
  it('AC2-a 非法新元素：整笔零写入 + issue 路径 [...arrayPath, index+j]（含嵌套子路径）', async () => {
    const fx = await openLeaseFixture({ replication: true });
    const result = await fx.lease.mutateData({
      op: 'array-insert',
      path: ['items'],
      index: 1,
      values: [8, 'x', 'y'],
    });
    const issues = issueOf(result);
    expect(issues.map((issue) => issue.path)).toEqual([
      ['items', 2],
      ['items', 3],
    ]);
    expect(readArray(fx.lease, ['items'])).toEqual([1, 2, 3, 4, 5]);

    const nested = await fx.lease.mutateData({
      op: 'array-insert',
      path: ['rows'],
      index: 1,
      values: [{ qty: 'x', tag: 'q' }],
    });
    const nestedIssues = issueOf(nested);
    expect(nestedIssues.map((issue) => issue.path)).toEqual([['rows', 1, 'qty']]);
    expect(readArray(fx.lease, ['rows'])).toEqual([
      { qty: 1, tag: 'a' },
      { qty: 2, tag: 'b' },
      { qty: 3, tag: 'c' },
    ]);

    await flushMicrotasks();
    expect(fx.ownedUpdates.length).toBe(0); // 一切拒绝零写入零 update
  });

  it('AC2-b 越界拒绝语义逐字不变（delete 范围越界 / insert index 越界）+ 零写入零 update', async () => {
    const fx = await openLeaseFixture({ replication: true });
    const del = await fx.lease.mutateData({ op: 'array-delete', path: ['items'], index: 5, count: 1 });
    expect(issueOf(del)).toEqual([
      { message: 'array-delete 范围越界（不 clamp、不接受越界 no-op）', path: ['items', 5] },
    ]);

    const ins = await fx.lease.mutateData({
      op: 'array-insert',
      path: ['items'],
      index: 6,
      values: [1],
    });
    expect(issueOf(ins)).toEqual([{ message: 'array-insert index 越界（不 clamp）', path: ['items', 6] }]);

    expect(readArray(fx.lease, ['items'])).toEqual([1, 2, 3, 4, 5]);
    await flushMicrotasks();
    expect(fx.ownedUpdates.length).toBe(0);
  });

  it('AC2-d fast 轨元素读计数与 n 解耦（O(k)）；union legacy 轨仍 ∝ n（AC3 结构性对照）', async () => {
    const n = 64;
    const fx = await openLeaseFixture({
      replication: true,
      items: Array.from({ length: n }, (_, index) => index),
      uarr: Array.from({ length: n }, (_, index) => index),
    });
    const fastReads = await countElementReadsAsync(rootArray(fx.doc, 'items'), () =>
      fx.lease.mutateData({ op: 'array-delete', path: ['items'], index: 2, count: 1 }),
    );
    const legacyReads = await countElementReadsAsync(rootArray(fx.doc, 'uarr'), () =>
      fx.lease.mutateData({ op: 'array-delete', path: ['uarr'], index: 2, count: 1 }),
    );
    expect(readArray(fx.lease, ['items']).length).toBe(n - 1);
    expect(readArray(fx.lease, ['uarr']).length).toBe(n - 1);
    expect(fastReads, `fast 轨读计数应 O(k)（≤8），实际 ${fastReads}`).toBeLessThanOrEqual(8);
    expect(
      legacyReads,
      `union legacy 轨读计数应 ∝ n（≥${n}），实际 ${legacyReads}`,
    ).toBeGreaterThanOrEqual(n);
    expect(legacyReads).toBeGreaterThan(fastReads);
  });

  it('AC2-c 空载荷/空批量语义不变：信封形状门照旧拒绝、零写入零 update', async () => {
    const fx = await openLeaseFixture({ replication: true });
    const emptyInsert = await fx.lease.mutateData({
      op: 'array-insert',
      path: ['items'],
      index: 1,
      values: [],
    });
    expect(issueOf(emptyInsert)).toEqual([
      { message: 'array-insert values 必须是非空数组', path: ['items'] },
    ]);
    const emptyDelete = await fx.lease.mutateData({
      op: 'array-delete',
      path: ['items'],
      index: 1,
      count: 0,
    });
    expect(issueOf(emptyDelete)).toEqual([
      { message: 'array-delete count 必须是严格正整数', path: ['items'] },
    ]);
    const emptyBatch = await fx.lease.mutateData({ ops: [] });
    expect(issueOf(emptyBatch)).toEqual([
      { message: '批量信封形状错误：ops 必须是非空数组（空数组）', path: [] },
    ]);
    expect(readArray(fx.lease, ['items'])).toEqual([1, 2, 3, 4, 5]);
    await flushMicrotasks();
    expect(fx.ownedUpdates.length).toBe(0);
  });
});

// ═══════════════════════ AC4 诊断烟测（记录形态不变）═══════════════════════

describe('issue #437 AC4 — fast-path 数组写的 committed update bytes 记录形态不变（ADR 0033 决策 2）', () => {
  it('AC4-a 数组写：root-mutation committed effect:update + inline carrier 重放为真事务增量', async () => {
    const fx = await openLeaseFixture({ diagnostics: true });
    const log = fx.log!;
    const baseState = Y.encodeStateAsUpdate(fx.doc);

    const result = await fx.lease.mutateData({
      op: 'array-insert',
      path: ['items'],
      index: 5,
      values: [42],
    });
    expect(result).toEqual({ ok: true });

    const records = await waitForAttemptRecords(log, 1);
    expect(records.length).toBe(1); // 恰一条最终结局
    const record = rootMutationRecord(log, 0);
    expect(record.operation).toBe('root-mutation');
    expect(record.stage).toBe('transaction');
    expect(record.source).toEqual({ kind: 'local' });
    expect(record.result.kind).toBe('committed');

    const carrier = updateCarrierOf(record);
    expect(carrier.storage).toBe('inline');
    expect(carrier.format).toBe('yjs-update-v1');
    expect(carrier.payloadLength).toBeGreaterThan(0);
    expect(carrier.crc32c).toMatch(/^[0-9a-f]{8}$/);
    if (carrier.storage !== 'inline') throw new Error('非 inline carrier（断言已抛——不可达防御）');
    expect(typeof carrier.base64).toBe('string');

    // carrier 重放 = 真事务增量：同基态重放后 items 收敛
    const replayed = new Y.Doc();
    Y.applyUpdate(replayed, baseState);
    Y.applyUpdate(replayed, carrierBytes(carrier));
    expect(rootArray(replayed, 'items').toJSON()).toEqual([1, 2, 3, 4, 5, 42]);
    // 反向鉴别：事务增量对无基态空 doc 不物化（防整文档编码冒充）
    const empty = new Y.Doc();
    Y.applyUpdate(empty, carrierBytes(carrier));
    expect(empty.getMap('ROOT').size).toBe(0);
  });

  it('AC4-b 数组写与标量写的记录/carrier 键集逐键同构（fast path 不改变记录形态）', async () => {
    const fx = await openLeaseFixture({ diagnostics: true });
    const log = fx.log!;
    await fx.lease.mutateData({ op: 'array-insert', path: ['items'], index: 5, values: [42] });
    await fx.lease.mutateData({ op: 'set', path: ['n'], value: 2 });
    await waitForAttemptRecords(log, 2);

    const arrayRecord = rootMutationRecord(log, 0);
    const setRecord = rootMutationRecord(log, 1);
    expect(Object.keys(arrayRecord).sort()).toEqual(Object.keys(setRecord).sort());
    const arrayCarrier = updateCarrierOf(arrayRecord);
    const setCarrier = updateCarrierOf(setRecord);
    expect(Object.keys(arrayCarrier).sort()).toEqual(Object.keys(setCarrier).sort());
    expect(readValue(fx.lease, ['n'])).toBe(2);
    expect(readArray(fx.lease, ['items'])).toEqual([1, 2, 3, 4, 5, 42]);
  });
});

// ═══════════════════════ AC5 复制烟测（对端收敛）═══════════════════════

describe('issue #437 AC5 — fast-path 提交经 replication apply 在对端收敛（协议面零变化）', () => {
  it('AC5-a hub 数组写 → owned update → peer apply 收敛（逻辑值 + diff 定点 + session 状态）', async () => {
    const hub = await openLeaseFixture({ replication: true });
    const peer = await openPeerFixture(hub);
    const baseState = Y.encodeStateAsUpdate(hub.doc);

    const result = await hub.lease.mutateData({
      op: 'array-delete',
      path: ['items'],
      index: 0,
      count: 1,
    });
    expect(result).toEqual({ ok: true });
    await waitForOwnedUpdates(hub, 1);
    const update = hub.ownedUpdates[0]!;

    // 协议面无关的形态 oracle：同一 update 应用到同基态纯 Y.Doc 得同一逻辑值
    const plain = new Y.Doc();
    plain.clientID = 987_654;
    Y.applyUpdate(plain, baseState);
    Y.applyUpdate(plain, update);
    expect(rootArray(plain, 'items').toJSON()).toEqual([2, 3, 4, 5]);

    const applied = await peer.session!.applyRemoteUpdate(update);
    expect(applied.ok).toBe(true);
    expect(readArray(peer.lease, ['items'])).toEqual([2, 3, 4, 5]);
    expect(readArray(peer.lease, ['items'])).toEqual(readArray(hub.lease, ['items']));

    // 协议收敛判据：hub 对 peer 状态向量的增量为空（diff 定点，apply 后值不变）
    const rest = hub.session!.encodeDiff(peer.session!.encodeStateVector());
    const fixpoint = await peer.session!.applyRemoteUpdate(rest);
    expect(fixpoint.ok).toBe(true);
    expect(readArray(peer.lease, ['items'])).toEqual([2, 3, 4, 5]);

    const status = peer.session!.getStatus();
    expect(status.state).toBe('open');
    expect(status.direction).toBe('hub-to-peer');
    expect(peer.session!.localRole).toBe('peer');
    expect(peer.session!.remoteInstanceId).toBe('hub-437');
  });

  it('AC5-b owned update 为最小增量形态（对空 doc 不物化 ROOT）且每次提交恰一事件', async () => {
    const hub = await openLeaseFixture({ replication: true });
    const baseState = Y.encodeStateAsUpdate(hub.doc);

    const result = await hub.lease.mutateData({
      op: 'array-insert',
      path: ['items'],
      index: 5,
      values: [42],
    });
    expect(result).toEqual({ ok: true });
    await waitForOwnedUpdates(hub, 1);
    await flushMicrotasks();
    expect(hub.ownedUpdates.length).toBe(1); // 一次提交 = 恰一 owned update

    const update = hub.ownedUpdates[0]!;
    // 增量形态（提交 = Y.Array 区间最小 edit）：对无基态空 doc 不物化 ROOT
    // —— 整文档编码会物化（反向鉴别，与 AC4-a 同款 oracle）
    const empty = new Y.Doc();
    Y.applyUpdate(empty, update);
    expect(empty.getMap('ROOT').size).toBe(0);
    // 同基态重放收敛（协议承载物 = 合法 Yjs update）
    const replayed = new Y.Doc();
    Y.applyUpdate(replayed, baseState);
    Y.applyUpdate(replayed, update);
    expect(rootArray(replayed, 'items').toJSON()).toEqual([1, 2, 3, 4, 5, 42]);

    // 第二次干净写：恰再一次事件（持久订阅面无累积/重复扇出）
    const second = await hub.lease.mutateData({
      op: 'array-delete',
      path: ['items'],
      index: 0,
      count: 1,
    });
    expect(second).toEqual({ ok: true });
    await waitForOwnedUpdates(hub, 2);
    await flushMicrotasks();
    expect(hub.ownedUpdates.length).toBe(2);
  });
});
