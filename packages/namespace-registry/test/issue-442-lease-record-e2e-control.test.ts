/**
 * issue #442 负控 / 回归锚（恒绿）— 不得漂移的既有语义面。
 *
 * 与契约文件（`issue-442-lease-record-e2e-contract.test.ts`）成对：契约文件钉 ADR 0034
 * 带来的行为变化与不变量；本文件钉**未变化面**，并作为 AC1 判别组的同夹具 A/B 对照：
 *
 *   C1：union map 位（`maybe`）同一污染、同一 op 照旧逐字拒绝（`Yjs 载体错位（ROOT.mz）`，
 *       path `['mz']`）+ 零写入零 update ⇒ 契约 A 组的 `ok:true` 对「fast/legacy 闸门」
 *       敏感，非恒真（A 组断言非「一切放行」伪绿）；
 *   C2：union map 位干净 set/delete 照常 `ok:true`（legacy 轨可用性不变）；
 *   C3：union map 位（n=64）entry 读计数 ≥ n（全量边界校验仍在，性能路径不变）——
 *       与契约 U3 的 fast 半成对；
 *   C4：触达面内载体位（同 B7 场景）独立 A/B 对照 —— fast path 未放松载体检查。
 *
 * 判据纪律同契约文件：只观察 lease 运行时行为；零 skip/only/todo、零源码字符串断言。
 */
import { describe, expect, it } from 'vitest';
import type { Doc } from 'yjs';
import {
  applyRawRemote,
  countMapReadsAsync,
  flushAsyncFanout,
  openLeaseFixture,
  rawMapAt,
  readRecord,
  rootMap,
  sameBytes,
  stateBytes,
  updateCount,
  type LeaseRecordFixture,
} from './issue-442-lease-record-e2e-fixture.js';

// ─────────────────────────── 断言助手 ───────────────────────────

interface SimpleIssue {
  readonly message: string;
  readonly path: Array<string | number>;
}

/** ok:true 判别成员（成功面恒 `{ok:true}`）。 */
function expectOk(result: unknown): void {
  expect(result).toEqual({ ok: true });
}

/** ok:false 判别成员的 issue 投影（message/path 逐字面）。 */
function issueList(result: unknown): SimpleIssue[] {
  const candidate = result as {
    ok?: unknown;
    issues?: Array<{ message?: unknown; path?: unknown }>;
  };
  expect(candidate.ok).toBe(false);
  const issues = Array.isArray(candidate.issues) ? candidate.issues : [];
  return issues.map((issue) => ({
    message: String(issue.message),
    path: Array.isArray(issue.path) ? (issue.path as Array<string | number>) : [],
  }));
}

/** 逐字拒绝断言：首条 issue 的 message 与 path 精确相等。 */
function expectRejected(
  result: unknown,
  message: string,
  path: ReadonlyArray<string | number>,
): void {
  const issues = issueList(result);
  expect(issues.length).toBeGreaterThan(0);
  expect(issues[0]!.message).toBe(message);
  expect(issues[0]!.path).toEqual([...path]);
}

/** 拒绝分支零写入锚：live doc 状态字节逐位不变。 */
function expectZeroWrite(before: Uint8Array, doc: Doc): void {
  expect(sameBytes(before, stateBytes(doc))).toBe(true);
}

/**
 * 拒绝分支零写入锚（SA6 §12.1 B-8 三面）：状态字节逐位不变 ∧ 'update' 事件差值 0 ∧
 * owned update 差值 0（异步扇出有界排空后断言）。
 */
async function expectRejectedZeroWrite(
  fx: LeaseRecordFixture,
  before: Uint8Array,
  updatesBefore: number,
  ownedBefore: number,
): Promise<void> {
  await flushAsyncFanout();
  expectZeroWrite(before, fx.doc);
  expect(updateCount(fx)).toBe(updatesBefore);
  expect(fx.ownedUpdates.length).toBe(ownedBefore);
}

// ═══════ C1–C3 union map 位：永久 legacy 全量边界轨（A/B 对照）═══════

describe('issue #442 负控 — union map 位永久 legacy（同一污染/op 的 A/B 对照）', () => {
  it('C1 union map 位污染照旧逐字拒绝：ok:false + 载体错位 path + 零写入零 update', async () => {
    const fx = await openLeaseFixture({ replication: true });
    await applyRawRemote(fx, (doc) => {
      rawMapAt(doc, ['maybe']).set('mz', 'oops');
    });
    const before = stateBytes(fx.doc);
    const updatesBefore = updateCount(fx);
    const ownedBefore = fx.ownedUpdates.length;
    const result = await fx.lease.mutateData({
      op: 'set',
      path: ['maybe', 'm2'],
      value: { title: 'mm', qty: 6 },
    });
    expectRejected(result, 'Yjs 载体错位（ROOT.mz）：期望 Y.Map，实际 plain value', ['mz']);
    await expectRejectedZeroWrite(fx, before, updatesBefore, ownedBefore);
  });

  it('C2 union map 位干净 set/delete 照常 ok:true（legacy 轨可用性不变）', async () => {
    const fx = await openLeaseFixture({ replication: true });
    expectOk(
      await fx.lease.mutateData({ op: 'set', path: ['maybe', 'm2'], value: { title: 'mm', qty: 6 } }),
    );
    expect(readRecord(fx.lease, ['maybe', 'm2'])).toEqual({ title: 'mm', qty: 6 });
    expectOk(await fx.lease.mutateData({ op: 'delete', path: ['maybe', 'm0'] }));
    expect(Object.keys(readRecord(fx.lease, ['maybe']))).not.toContain('m0');
  });

  it('C3 union map 位（n=64）set 读计数 ≥ n（全量边界校验仍在）', async () => {
    const n = 64;
    const fx = await openLeaseFixture({ replication: true, maybeN: n });
    const reads = await countMapReadsAsync(rawMapAt(fx.doc, ['maybe']), () =>
      fx.lease.mutateData({ op: 'set', path: ['maybe', 'm2'], value: { title: 'mm', qty: 6 } }),
    );
    expect(
      reads.valueReads,
      `union legacy 轨读计数应 ∝ n（≥${n}），实际 ${JSON.stringify(reads)}`,
    ).toBeGreaterThanOrEqual(n);
  });
});

// ═══════ C4 触达面内载体位：fast path 未放松载体检查（B7 的独立对照）═══════

describe('issue #442 负控 — 触达面内载体位仍响亮拒绝（fast path 未放松）', () => {
  it('C4 ROOT.tasks 本身承载 plain 值 → 逐字拒绝、path []、零写入零 update', async () => {
    const fx = await openLeaseFixture({ replication: true });
    await applyRawRemote(fx, (doc) => {
      rootMap(doc).set('tasks', 'oops');
    });
    const before = stateBytes(fx.doc);
    const updatesBefore = updateCount(fx);
    const ownedBefore = fx.ownedUpdates.length;
    const result = await fx.lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: 't3', qty: 3 },
    });
    expectRejected(result, 'Yjs 载体错位（ROOT）：期望 Y.Map，实际 plain value', []);
    await expectRejectedZeroWrite(fx, before, updatesBefore, ownedBefore);
  });
});
