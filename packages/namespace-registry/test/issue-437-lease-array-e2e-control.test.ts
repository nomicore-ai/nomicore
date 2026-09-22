/**
 * issue #437 负控 / 回归锚（旧新同绿）— 不得漂移的既有语义面。
 *
 * 与契约文件（`issue-437-lease-array-e2e-contract.test.ts`）成对：契约文件钉 ADR 0033
 * 带来的行为变化与不变量；本文件钉**未变化面**，并作为 AC1 判别组的同夹具 A/B 对照：
 *
 *   C1–C3：union 数组目标（`YArray<number> | YArray<string>`）永久 legacy 全量边界轨
 *          （ADR 0033 决策 1 双轨）——同一污染、同一 op 在 union 目标上照旧响亮拒绝
 *          （⇒ 契约 AC1 的 `ok:true` 断言对「快/legacy 闸门」敏感，非恒真）；
 *   C4–C6：域规则（`index === length` append、`index+count === length` delete 不 clamp）、
 *          干净写的单事件提交形态、批量信封面接线——旧新同绿，必须保持；
 *   C7：union 轨「性能路径不变」的结构性证据——元素读计数 ∝ n（仍全量边界校验），
 *      与 fast 轨 O(k) 解耦成对（沿 #436 countElementReads 代理先例）。
 *
 * 判据纪律同契约文件：只观察 lease 运行时行为；零 skip/only/todo、零源码字符串断言。
 */
import { describe, expect, it } from 'vitest';
import {
  applyRawRemote,
  countElementReadsAsync,
  openLeaseFixture,
  readArray,
  rootArray,
  waitForOwnedUpdates,
} from './issue-437-lease-array-e2e-fixture.js';

async function flushMicrotasks(times = 24): Promise<void> {
  for (let i = 0; i < times; i += 1) await Promise.resolve();
}

function issueOf(result: unknown): Array<{ message: string; path: Array<string | number> }> {
  const candidate = result as { ok: boolean; issues?: Array<{ message: string; path: Array<string | number> }> };
  expect(candidate.ok).toBe(false);
  return candidate.issues ?? [];
}

// ═══════ C1–C3 union 数组目标：永久 legacy 全量边界轨（A/B 对照）═══════

describe('issue #437 负控 — union 数组目标永久 legacy（同一污染/op 的 A/B 对照）', () => {
  it('C1 union 目标区间外污染照旧响亮拒绝：ok:false + 污染点 path + 零写入零 update', async () => {
    const fx = await openLeaseFixture({ replication: true });
    await applyRawRemote(fx.session!, fx.doc, (doc) => {
      rootArray(doc, 'uarr').insert(0, [true]); // 两 union 成员都不容的污染
    });
    expect(readArray(fx.lease, ['uarr'])).toEqual([true, 7, 8, 9]);

    const result = await fx.lease.mutateData({ op: 'array-delete', path: ['uarr'], index: 1, count: 1 });
    // legacy 全量边界校验的逐字判决（union 成员仲裁 + 污染点 path）——ADR 0033 决策 1
    // 双轨的「union 永久 legacy」行为锚
    expect(issueOf(result)).toEqual([
      { message: '联合成员 1/2：类型不匹配：期望 number，实际 boolean', path: ['uarr', 0] },
    ]);
    expect(readArray(fx.lease, ['uarr'])).toEqual([true, 7, 8, 9]); // 零写入
    await flushMicrotasks();
    expect(fx.ownedUpdates.length).toBe(0); // 零 update
  });

  it('C2 union 目标干净写照常 ok:true（legacy 轨行为正确）', async () => {
    const fx = await openLeaseFixture({ replication: true });
    const inserted = await fx.lease.mutateData({
      op: 'array-insert',
      path: ['uarr'],
      index: 1,
      values: [9],
    });
    expect(inserted).toEqual({ ok: true });
    expect(readArray(fx.lease, ['uarr'])).toEqual([7, 9, 8, 9]);

    const deleted = await fx.lease.mutateData({ op: 'array-delete', path: ['uarr'], index: 1, count: 1 });
    expect(deleted).toEqual({ ok: true });
    expect(readArray(fx.lease, ['uarr'])).toEqual([7, 8, 9]);
    await waitForOwnedUpdates(fx, 2);
    expect(fx.ownedUpdates.length).toBe(2);
  });

  it('C3 union 目标非法新值 issue path 不变：[...arrayPath, index+j]（legacy 全量校验）', async () => {
    const fx = await openLeaseFixture({ replication: true });
    const result = await fx.lease.mutateData({
      op: 'array-insert',
      path: ['uarr'],
      index: 1,
      values: [true],
    });
    expect(issueOf(result).map((issue) => issue.path)).toEqual([['uarr', 1]]);
    expect(readArray(fx.lease, ['uarr'])).toEqual([7, 8, 9]);
    await flushMicrotasks();
    expect(fx.ownedUpdates.length).toBe(0);
  });
});

// ═══════ C4–C6 域规则 / 提交形态 / 批量面基线（旧新同绿）═══════

describe('issue #437 负控 — 域规则与提交形态基线（不 clamp、单事件、批量面）', () => {
  it('C4 index === length append 与 index+count === length delete 照常接受（两条轨）', async () => {
    const fx = await openLeaseFixture({ replication: true });
    const appendFast = await fx.lease.mutateData({
      op: 'array-insert',
      path: ['items'],
      index: 5,
      values: [6],
    });
    expect(appendFast).toEqual({ ok: true });
    const tailDeleteFast = await fx.lease.mutateData({
      op: 'array-delete',
      path: ['items'],
      index: 5,
      count: 1,
    });
    expect(tailDeleteFast).toEqual({ ok: true });
    expect(readArray(fx.lease, ['items'])).toEqual([1, 2, 3, 4, 5]);

    const appendLegacy = await fx.lease.mutateData({
      op: 'array-insert',
      path: ['uarr'],
      index: 3,
      values: [10],
    });
    expect(appendLegacy).toEqual({ ok: true });
    const tailDeleteLegacy = await fx.lease.mutateData({
      op: 'array-delete',
      path: ['uarr'],
      index: 3,
      count: 1,
    });
    expect(tailDeleteLegacy).toEqual({ ok: true });
    expect(readArray(fx.lease, ['uarr'])).toEqual([7, 8, 9]);
  });

  it('C5 干净数组写 = 恰一次提交（单 owned update）且逻辑值正确', async () => {
    const fx = await openLeaseFixture({ replication: true });
    const result = await fx.lease.mutateData({ op: 'array-delete', path: ['items'], index: 0, count: 1 });
    expect(result).toEqual({ ok: true });
    expect(readArray(fx.lease, ['items'])).toEqual([2, 3, 4, 5]);
    await waitForOwnedUpdates(fx, 1);
    await flushMicrotasks();
    expect(fx.ownedUpdates.length).toBe(1);
  });

  it('C6 批量信封内数组 op 照常 ok:true（批量面接线不变，单事务单事件）', async () => {
    const fx = await openLeaseFixture({ replication: true });
    const result = await fx.lease.mutateData({
      ops: [
        { op: 'array-insert', path: ['items'], index: 5, values: [6] },
        { op: 'array-delete', path: ['rows'], index: 0, count: 1 },
      ],
    });
    expect(result).toEqual({ ok: true });
    expect(readArray(fx.lease, ['items'])).toEqual([1, 2, 3, 4, 5, 6]);
    expect(readArray(fx.lease, ['rows'])).toEqual([
      { qty: 2, tag: 'b' },
      { qty: 3, tag: 'c' },
    ]);
    await waitForOwnedUpdates(fx, 1);
    await flushMicrotasks();
    expect(fx.ownedUpdates.length).toBe(1);
  });

  it('C7 union legacy 轨元素读计数 ∝ n（AC3 结构性锚：全量边界校验仍在）', async () => {
    const n = 64;
    const fx = await openLeaseFixture({
      replication: true,
      uarr: Array.from({ length: n }, (_, index) => index),
    });
    const legacyReads = await countElementReadsAsync(rootArray(fx.doc, 'uarr'), () =>
      fx.lease.mutateData({ op: 'array-delete', path: ['uarr'], index: 2, count: 1 }),
    );
    expect(readArray(fx.lease, ['uarr']).length).toBe(n - 1);
    expect(
      legacyReads,
      `union legacy 轨读计数应 ∝ n（≥${n}），实际 ${legacyReads}`,
    ).toBeGreaterThanOrEqual(n);
  });
});
