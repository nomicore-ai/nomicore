/**
 * issue #442 验收契约（最高 seam = lease `mutateData`）— Record/parent 逐 entry 校验行为钉死
 * （ADR 0034 决策 1/2/4/5；任务简报 AC1–AC6）。
 *
 * 语义已于 #440（vfsl 逐 entry 接缝）与 #441（doc-runtime fast path 接线）落地；本票
 * **不改实现**，只把用户可见行为与不变量在 lease seam 立法成端到端回归测试：
 *
 *   AC1 行为变化：raw-replication 污染的 Record map / 封闭对象写删**未触达 entry 非法**的
 *        目标键，目标键合法即成功（旧语义为连带拒绝）；污染保留、不修复、不阻断；恰 1 update。
 *   AC2 不变量：键 Pattern 违规与非法新值零写入 + issue 路径 `[...mapPath, key, …]` 不变；
 *        delete 不存在键的 no-op 拒绝；必填字段 delete 拒、`unknown` 标量 delete 允许；
 *        触达面内载体位响亮拒绝（path `[]`）。
 *   AC3 union map 位端到端行为与性能路径不变（仍走全量边界校验，读计数 ∝ n）。
 *   AC4 Record 值位为 union 时端到端仍走 fast path（行为正确且读计数与 n 解耦）。
 *   AC5 诊断烟测：fast path 提交的 committed update bytes 记录形态不变。
 *   AC6 复制烟测：fast path 提交经 replication apply 在对端收敛，无协议面变化。
 *
 * 判据纪律：只观察运行时行为（lease 判别联合结果、issue message/path、readData 逻辑值、
 * live `Y.Map` entry 读计数、Yjs update 事件与状态字节、诊断 record/carrier、复制 owned
 * update）；零 skip/only/todo、零 env override、零 fallback、零源码字符串断言。
 *
 * 判别性（「旧实现须在目标断言处失败」，15 its：A1–A11、U3 fast 半、U4、V3、R3）由 SA6
 * 契约 §5.3 的 `3fd6aa8` 基线证据承载；交付测试只断言 HEAD 期望（不携带 baseline 分支）。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  applyRawRemote,
  carrierBytes,
  countMapReadsAsync,
  flushAsyncFanout,
  itemEntry,
  openLeaseFixture,
  openPeerFixture,
  rawMapAt,
  readRecord,
  readValue,
  REPLAY_CLIENT_ID,
  rootMap,
  rootMutationRecords,
  sameBytes,
  stateBytes,
  updateCarrierOf,
  updateCount,
  waitForOwnedUpdates,
  waitForRootMutationRecords,
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

/** 逐字拒绝断言：首条 issue 的 message 与 path 精确相等（立法本体）。 */
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
function expectZeroWrite(before: Uint8Array, doc: Y.Doc): void {
  expect(sameBytes(before, stateBytes(doc))).toBe(true);
}

/**
 * 拒绝分支零写入锚（SA6 §12.1 B-8 三面）：状态字节逐位不变 ∧ 'update' 事件差值 0 ∧
 * owned update 差值 0（异步扇出有界排空后断言，防「当刻为 0」的伪锚）。拒绝在事务前
 * fail ⇒ 三面均被零写入语义蕴含（SA2 O-4 同判），不构成加严。
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

/** 记录投影的键集（排序后比较）。 */
function keysOf(value: Record<string, unknown>): string[] {
  return Object.keys(value).sort();
}

// ═══════════════════════ AC1 行为变化（判别组）═══════════════════════

describe('issue #442 AC1 — raw 污染不再阻断未触达目标键的 Record/封闭对象写删（ADR 0034 决策 4）', () => {
  it('A1 污染 sibling entry（载体错位）→ Record set 目标键合法即成功、污染保留、恰 1 update', async () => {
    const fx = await openLeaseFixture({ replication: true });
    await applyRawRemote(fx, (doc) => {
      rawMapAt(doc, ['tasks']).set('t9', 'oops');
    });
    expect(readValue(fx.lease, ['tasks', 't9'])).toBe('oops');

    const updatesBefore = updateCount(fx);
    expectOk(
      await fx.lease.mutateData({ op: 'set', path: ['tasks', 't3'], value: { title: 't3', qty: 3 } }),
    );
    expect(updateCount(fx) - updatesBefore).toBe(1); // 单事务单 update
    expect(readRecord(fx.lease, ['tasks', 't3'])).toEqual({ title: 't3', qty: 3 });
    expect(readValue(fx.lease, ['tasks', 't9'])).toBe('oops'); // 触达面外污染不修复
  });

  it('A2 同污染 → Record delete 既有键成功、污染保留、恰 1 update', async () => {
    const fx = await openLeaseFixture({ replication: true });
    await applyRawRemote(fx, (doc) => {
      rawMapAt(doc, ['tasks']).set('t9', 'oops');
    });
    const updatesBefore = updateCount(fx);
    expectOk(await fx.lease.mutateData({ op: 'delete', path: ['tasks', 't0'] }));
    expect(updateCount(fx) - updatesBefore).toBe(1);
    expect(keysOf(readRecord(fx.lease, ['tasks']))).not.toContain('t0');
    expect(readValue(fx.lease, ['tasks', 't9'])).toBe('oops');
  });

  it('A3 同污染 → delete 污染键自身成功（delete 不读旧值）、恰 1 update', async () => {
    const fx = await openLeaseFixture({ replication: true });
    await applyRawRemote(fx, (doc) => {
      rawMapAt(doc, ['tasks']).set('t9', 'oops');
    });
    const updatesBefore = updateCount(fx);
    expectOk(await fx.lease.mutateData({ op: 'delete', path: ['tasks', 't9'] }));
    expect(updateCount(fx) - updatesBefore).toBe(1);
    expect(keysOf(readRecord(fx.lease, ['tasks']))).not.toContain('t9');
  });

  it('A4 兄弟 entry 值非法（qty:string）→ set 目标键不受连带拒绝、污染不修复', async () => {
    const fx = await openLeaseFixture({ replication: true });
    await applyRawRemote(fx, (doc) => {
      rawMapAt(doc, ['tasks']).set('t9', itemEntry('bad', 'x'));
    });
    const updatesBefore = updateCount(fx);
    expectOk(
      await fx.lease.mutateData({ op: 'set', path: ['tasks', 't3'], value: { title: 't3', qty: 3 } }),
    );
    expect(updateCount(fx) - updatesBefore).toBe(1);
    expect(readRecord(fx.lease, ['tasks', 't9']).qty).toBe('x'); // 污染未修复
    expect(readRecord(fx.lease, ['tasks', 't3'])).toEqual({ title: 't3', qty: 3 });
  });

  it('A5 兄弟键违约（codes.nope）→ set 目标键不受连带拒绝、违约键保留', async () => {
    const fx = await openLeaseFixture({ replication: true });
    await applyRawRemote(fx, (doc) => {
      rawMapAt(doc, ['codes']).set('nope', itemEntry('n', 1));
    });
    const updatesBefore = updateCount(fx);
    expectOk(
      await fx.lease.mutateData({ op: 'set', path: ['codes', 'id-2'], value: { title: 'c2', qty: 2 } }),
    );
    expect(updateCount(fx) - updatesBefore).toBe(1);
    expect(readRecord(fx.lease, ['codes', 'id-2'])).toEqual({ title: 'c2', qty: 2 });
    expect(keysOf(readRecord(fx.lease, ['codes']))).toContain('nope'); // 违约键未被修复/删除
  });

  it('A6 封闭对象 delete optional @ 兄弟字段载体错位 → 成功、恰 1 update、污染保留', async () => {
    const fx = await openLeaseFixture({ replication: true });
    await applyRawRemote(fx, (doc) => {
      rawMapAt(doc, ['obj']).set('deep', 5);
    });
    const updatesBefore = updateCount(fx);
    expectOk(await fx.lease.mutateData({ op: 'delete', path: ['obj', 'opt'] }));
    expect(updateCount(fx) - updatesBefore).toBe(1);
    expect(keysOf(readRecord(fx.lease, ['obj']))).not.toContain('opt');
    expect(readValue(fx.lease, ['obj', 'deep'])).toBe(5); // 污染字段不连坐、不修复
  });

  it('A7 封闭对象 delete unknown 标量 @ 兄弟字段载体错位 → 成功、恰 1 update', async () => {
    const fx = await openLeaseFixture({ replication: true });
    await applyRawRemote(fx, (doc) => {
      rawMapAt(doc, ['obj']).set('deep', 5);
    });
    const updatesBefore = updateCount(fx);
    expectOk(await fx.lease.mutateData({ op: 'delete', path: ['obj', 'unk'] }));
    expect(updateCount(fx) - updatesBefore).toBe(1);
    expect(keysOf(readRecord(fx.lease, ['obj']))).not.toContain('unk');
    expect(readValue(fx.lease, ['obj', 'deep'])).toBe(5);
  });

  it('A8 封闭对象 delete 必填字段 @ 兄弟字段污染 → 静态理由逐字拒绝 + 零写入零 update（message 级判别）', async () => {
    const fx = await openLeaseFixture({ replication: true });
    await applyRawRemote(fx, (doc) => {
      rawMapAt(doc, ['obj']).set('deep', 5);
    });
    const before = stateBytes(fx.doc);
    const updatesBefore = updateCount(fx);
    const ownedBefore = fx.ownedUpdates.length;
    const result = await fx.lease.mutateData({ op: 'delete', path: ['obj', 'req'] });
    // 旧语义（pre-#441）在同一场景下的理由 = 父值载体错位（path ['deep']）；此处钉静态判定
    expectRejected(result, '缺少必填字段 "req"', ['obj', 'req']);
    await expectRejectedZeroWrite(fx, before, updatesBefore, ownedBefore);
  });

  it('A9 Record 值位 union（blobs）兄弟载体错位 → 仍走 fast path 成功、污染保留', async () => {
    const fx = await openLeaseFixture({ replication: true });
    await applyRawRemote(fx, (doc) => {
      rawMapAt(doc, ['blobs']).set('b9', 'oops');
    });
    const updatesBefore = updateCount(fx);
    expectOk(
      await fx.lease.mutateData({ op: 'set', path: ['blobs', 'b2'], value: { title: 'v', qty: 5 } }),
    );
    expect(updateCount(fx) - updatesBefore).toBe(1);
    expect(readRecord(fx.lease, ['blobs', 'b2'])).toEqual({ title: 'v', qty: 5 });
    expect(readValue(fx.lease, ['blobs', 'b9'])).toBe('oops');
  });

  it('A10 深层 Record（outer.inner）兄弟污染 → 深层写成功、路径语义不变、污染保留', async () => {
    const fx = await openLeaseFixture({ replication: true });
    await applyRawRemote(fx, (doc) => {
      rawMapAt(doc, ['outer', 'inner']).set('n9', 'oops');
    });
    const updatesBefore = updateCount(fx);
    expectOk(
      await fx.lease.mutateData({
        op: 'set',
        path: ['outer', 'inner', 'n2'],
        value: { title: 'n2', qty: 2 },
      }),
    );
    expect(updateCount(fx) - updatesBefore).toBe(1);
    expect(readRecord(fx.lease, ['outer', 'inner', 'n2'])).toEqual({ title: 'n2', qty: 2 });
    expect(readValue(fx.lease, ['outer', 'inner', 'n9'])).toBe('oops');
  });

  it('A11 批量信封内 Record set @ 兄弟污染 → 批内两键写入 + 单事务单 update', async () => {
    const fx = await openLeaseFixture({ replication: true });
    await applyRawRemote(fx, (doc) => {
      rawMapAt(doc, ['tasks']).set('t9', 'oops');
    });
    const updatesBefore = updateCount(fx);
    expectOk(
      await fx.lease.mutateData({
        ops: [
          { op: 'set', path: ['tasks', 't7'], value: { title: 'seven', qty: 7 } },
          { op: 'set', path: ['tasks', 't8'], value: { title: 'eight', qty: 8 } },
        ],
      }),
    );
    expect(updateCount(fx) - updatesBefore).toBe(1); // 批量 = 单事务单 update
    expect(readRecord(fx.lease, ['tasks', 't7'])).toEqual({ title: 'seven', qty: 7 });
    expect(readRecord(fx.lease, ['tasks', 't8'])).toEqual({ title: 'eight', qty: 8 });
    expect(readValue(fx.lease, ['tasks', 't9'])).toBe('oops');
  });
});

// ═══════════════════════ AC2 不变量（旧新同绿）═══════════════════════

describe('issue #442 AC2 — 域规则与 issue 路径逐字不变 + 非法输入零写入（ADR 0034 决策 5）', () => {
  it('B1 Record set 新值非法 → 逐字 message + path [...mapPath, key, …值内路径]、零写入零 update', async () => {
    const fx = await openLeaseFixture({ replication: true });
    const before = stateBytes(fx.doc);
    const updatesBefore = updateCount(fx);
    const ownedBefore = fx.ownedUpdates.length;
    const result = await fx.lease.mutateData({
      op: 'set',
      path: ['tasks', 't9'],
      value: { title: 'x', qty: 'y' },
    });
    expectRejected(result, '类型不匹配：期望 number，实际 string', ['tasks', 't9', 'qty']);
    await expectRejectedZeroWrite(fx, before, updatesBefore, ownedBefore);
  });

  it('B2 Record 键 Pattern 违约 → 逐字 message + path 指向违约键本身、零写入零 update', async () => {
    const fx = await openLeaseFixture({ replication: true });
    const before = stateBytes(fx.doc);
    const updatesBefore = updateCount(fx);
    const ownedBefore = fx.ownedUpdates.length;
    const result = await fx.lease.mutateData({
      op: 'set',
      path: ['codes', 'nope'],
      value: { title: 'n', qty: 1 },
    });
    expectRejected(result, 'Record 键 "nope" 不满足 Pattern 正则 /^(id-[0-9]+)$/', ['codes', 'nope']);
    await expectRejectedZeroWrite(fx, before, updatesBefore, ownedBefore);
  });

  it('B3 delete 不存在键 → no-op 逐字拒绝 + 零写入', async () => {
    const fx = await openLeaseFixture({ replication: true });
    const before = stateBytes(fx.doc);
    const updatesBefore = updateCount(fx);
    const ownedBefore = fx.ownedUpdates.length;
    const result = await fx.lease.mutateData({ op: 'delete', path: ['tasks', 'zz'] });
    expectRejected(result, 'delete 目标键不存在（拒绝 no-op）', ['tasks', 'zz']);
    await expectRejectedZeroWrite(fx, before, updatesBefore, ownedBefore);
  });

  it('B4 封闭对象必填字段 delete → 静态逐字拒绝 + 零写入', async () => {
    const fx = await openLeaseFixture({ replication: true });
    const before = stateBytes(fx.doc);
    const updatesBefore = updateCount(fx);
    const ownedBefore = fx.ownedUpdates.length;
    const result = await fx.lease.mutateData({ op: 'delete', path: ['obj', 'req'] });
    expectRejected(result, '缺少必填字段 "req"', ['obj', 'req']);
    await expectRejectedZeroWrite(fx, before, updatesBefore, ownedBefore);
  });

  it('B5 封闭对象 unknown 标量字段 delete → 允许（静态规则不变）', async () => {
    const fx = await openLeaseFixture({ replication: true });
    expectOk(await fx.lease.mutateData({ op: 'delete', path: ['obj', 'unk'] }));
    expect(keysOf(readRecord(fx.lease, ['obj']))).not.toContain('unk');
  });

  it('B6 封闭对象 optional 字段 delete 允许、重复 delete 落到 no-op 逐字拒绝', async () => {
    const fx = await openLeaseFixture({ replication: true });
    expectOk(await fx.lease.mutateData({ op: 'delete', path: ['obj', 'opt'] }));
    expect(keysOf(readRecord(fx.lease, ['obj']))).not.toContain('opt');
    await waitForOwnedUpdates(fx, 1); // 首删扇出结算后再取重复 delete 的前后差值
    const before = stateBytes(fx.doc);
    const updatesBefore = updateCount(fx);
    const ownedBefore = fx.ownedUpdates.length;
    const repeat = await fx.lease.mutateData({ op: 'delete', path: ['obj', 'opt'] });
    expectRejected(repeat, 'delete 目标键不存在（拒绝 no-op）', ['obj', 'opt']);
    await expectRejectedZeroWrite(fx, before, updatesBefore, ownedBefore);
  });
  it('B7 触达面内载体位（ROOT.tasks 本身非 Y.Map）→ 逐字拒绝、path []、零写入零 update', async () => {
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

  it('B8 深层 Record 非法新值 → issue 路径跨深度 rebase 正确 + 零写入', async () => {
    const fx = await openLeaseFixture({ replication: true });
    const before = stateBytes(fx.doc);
    const updatesBefore = updateCount(fx);
    const ownedBefore = fx.ownedUpdates.length;
    const result = await fx.lease.mutateData({
      op: 'set',
      path: ['outer', 'inner', 'n2'],
      value: { title: 'x', qty: 'y' },
    });
    expectRejected(result, '类型不匹配：期望 number，实际 string', ['outer', 'inner', 'n2', 'qty']);
    await expectRejectedZeroWrite(fx, before, updatesBefore, ownedBefore);
  });
});

// ═══════════════════════ AC3 union map 位（永久 legacy 轨）═══════════════════════

describe('issue #442 AC3 — union map 位端到端行为与性能路径不变（ADR 0034 决策 1 双轨）', () => {
  it('U3 n=64：Record fast 轨读计数 ≤8；union map 位 legacy 轨读计数 ≥ n（全量边界校验仍在）', async () => {
    const n = 64;
    const fx = await openLeaseFixture({ replication: true, tasksN: n, blobsN: n, maybeN: n });
    const tasksReads = await countMapReadsAsync(rawMapAt(fx.doc, ['tasks']), () =>
      fx.lease.mutateData({ op: 'set', path: ['tasks', 'tz'], value: { title: 'tz', qty: 1 } }),
    );
    const maybeReads = await countMapReadsAsync(rawMapAt(fx.doc, ['maybe']), () =>
      fx.lease.mutateData({ op: 'set', path: ['maybe', 'm2'], value: { title: 'mm', qty: 6 } }),
    );
    expect(
      tasksReads.valueReads,
      `fast 轨读计数应 O(k)（≤8），实际 ${JSON.stringify(tasksReads)}`,
    ).toBeLessThanOrEqual(8);
    expect(
      maybeReads.valueReads,
      `union legacy 轨读计数应 ∝ n（≥${n}），实际 ${JSON.stringify(maybeReads)}`,
    ).toBeGreaterThanOrEqual(n);
  });

  it('U4 Record set：n=64 与 n=256 读计数均 ≤8 且相等（与 n 解耦）', async () => {
    const small = await openLeaseFixture({ replication: true, tasksN: 64 });
    const big = await openLeaseFixture({ replication: true, tasksN: 256 });
    const smallReads = await countMapReadsAsync(rawMapAt(small.doc, ['tasks']), () =>
      small.lease.mutateData({ op: 'set', path: ['tasks', 'tz'], value: { title: 'tz', qty: 1 } }),
    );
    const bigReads = await countMapReadsAsync(rawMapAt(big.doc, ['tasks']), () =>
      big.lease.mutateData({ op: 'set', path: ['tasks', 'tz'], value: { title: 'tz', qty: 1 } }),
    );
    expect(
      smallReads.valueReads,
      `n=64 读计数应 ≤8，实际 ${JSON.stringify(smallReads)}`,
    ).toBeLessThanOrEqual(8);
    expect(
      bigReads.valueReads,
      `n=256 读计数应 ≤8，实际 ${JSON.stringify(bigReads)}`,
    ).toBeLessThanOrEqual(8);
    expect(
      smallReads.valueReads,
      `读计数应与 n 解耦，实际 64→${smallReads.valueReads}、256→${bigReads.valueReads}`,
    ).toBe(bigReads.valueReads);
  });
});

// ═══════════════════════ AC4 Record 值位 union（仍 fast path）═══════════════════════

describe('issue #442 AC4 — Record 值位为 union 时端到端仍走 fast path（ADR 0034 决策 1）', () => {
  it('V1 值位 union 两支成员新值均接受（clean）', async () => {
    const fx = await openLeaseFixture({ replication: true });
    expectOk(
      await fx.lease.mutateData({ op: 'set', path: ['blobs', 'b2'], value: { title: 'i', qty: 5 } }),
    );
    expectOk(
      await fx.lease.mutateData({ op: 'set', path: ['blobs', 'b3'], value: { label: 'a', n: 5 } }),
    );
    expect(readRecord(fx.lease, ['blobs', 'b2'])).toEqual({ title: 'i', qty: 5 });
    expect(readRecord(fx.lease, ['blobs', 'b3'])).toEqual({ label: 'a', n: 5 });
  });

  it('V2 值位 union 非法值 → 恰 2 条联合成员 issue 逐字拒绝 + 零写入零 update', async () => {
    const fx = await openLeaseFixture({ replication: true });
    const before = stateBytes(fx.doc);
    const updatesBefore = updateCount(fx);
    const ownedBefore = fx.ownedUpdates.length;
    const result = await fx.lease.mutateData({
      op: 'set',
      path: ['blobs', 'b2'],
      value: { title: 'x', n: 5 },
    });
    expect(issueList(result)).toEqual([
      { message: '联合成员 1/2：缺少必填字段 "qty"', path: ['blobs', 'b2', 'qty'] },
      { message: '联合成员 1/2：未知字段 "n"：封闭对象不接受未声明键', path: ['blobs', 'b2', 'n'] },
    ]);
    await expectRejectedZeroWrite(fx, before, updatesBefore, ownedBefore);
  });

  it('V3 值位 union 的 Record set：n=64 与 n=256 读计数均 ≤8 且相等（不阻断 fast path）', async () => {
    const small = await openLeaseFixture({ replication: true, blobsN: 64 });
    const big = await openLeaseFixture({ replication: true, blobsN: 256 });
    const smallReads = await countMapReadsAsync(rawMapAt(small.doc, ['blobs']), () =>
      small.lease.mutateData({ op: 'set', path: ['blobs', 'bz'], value: { title: 'bz', qty: 1 } }),
    );
    const bigReads = await countMapReadsAsync(rawMapAt(big.doc, ['blobs']), () =>
      big.lease.mutateData({ op: 'set', path: ['blobs', 'bz'], value: { title: 'bz', qty: 1 } }),
    );
    expect(
      smallReads.valueReads,
      `n=64 读计数应 ≤8，实际 ${JSON.stringify(smallReads)}`,
    ).toBeLessThanOrEqual(8);
    expect(
      bigReads.valueReads,
      `n=256 读计数应 ≤8，实际 ${JSON.stringify(bigReads)}`,
    ).toBeLessThanOrEqual(8);
    expect(
      smallReads.valueReads,
      `读计数应与 n 解耦（值位 union 不阻断），实际 64→${smallReads.valueReads}、256→${bigReads.valueReads}`,
    ).toBe(bigReads.valueReads);
  });
});

// ═══════════════════════ AC5 诊断烟测（记录形态不变）═══════════════════════

describe('issue #442 AC5 — fast path 提交的 committed update bytes 记录形态不变（ADR 0011/0014）', () => {
  it('E1 恰 1 条 root-mutation committed effect:update + inline carrier 重放为真事务增量、不物化 ROOT', async () => {
    const fx = await openLeaseFixture({ diagnostics: true });
    const log = fx.log!;
    const baseState = stateBytes(fx.doc);
    expectOk(
      await fx.lease.mutateData({ op: 'set', path: ['tasks', 't3'], value: { title: 't3', qty: 3 } }),
    );
    const records = await waitForRootMutationRecords(log, 1);
    expect(records.length).toBe(1); // 恰一条最终结局
    const record = records[0]!;
    expect(record.stage).toBe('transaction');
    expect(record.source).toEqual({ kind: 'local' });
    const carrier = updateCarrierOf(record);
    expect(carrier.storage).toBe('inline');
    expect(carrier.format).toBe('yjs-update-v1');
    expect(carrier.payloadLength).toBeGreaterThan(0);
    expect(carrier.crc32c).toMatch(/^[0-9a-f]{8}$/);

    const bytes = carrierBytes(carrier);
    const replayed = new Y.Doc();
    Y.applyUpdate(replayed, baseState);
    Y.applyUpdate(replayed, bytes);
    expect((replayed.getMap('ROOT').get('tasks') as Y.Map<unknown>).has('t3')).toBe(true);
    const empty = new Y.Doc();
    Y.applyUpdate(empty, bytes);
    expect(empty.getMap('ROOT').size).toBe(0); // 最小增量（不物化 ROOT）
  });

  it('E2 Record 写与标量写的记录键集与 carrier 键集逐键同构', async () => {
    const fx = await openLeaseFixture({ diagnostics: true });
    const log = fx.log!;
    expectOk(
      await fx.lease.mutateData({ op: 'set', path: ['tasks', 't3'], value: { title: 't3', qty: 3 } }),
    );
    expectOk(await fx.lease.mutateData({ op: 'set', path: ['n'], value: 2 }));
    const records = await waitForRootMutationRecords(log, 2);
    const [recordWrite, scalarWrite] = records;
    expect(recordWrite).toBeDefined();
    expect(scalarWrite).toBeDefined();
    expect(keysOf(recordWrite as unknown as Record<string, unknown>)).toEqual(
      keysOf(scalarWrite as unknown as Record<string, unknown>),
    );
    expect(Object.keys(updateCarrierOf(recordWrite!)).sort()).toEqual(
      Object.keys(updateCarrierOf(scalarWrite!)).sort(),
    );
    expect(rootMutationRecords(log).length).toBe(2);
  });
});

// ═══════════════════════ AC6 复制烟测（协议承载物零变化）═══════════════════════

describe('issue #442 AC6 — fast path 提交经 replication apply 在对端收敛（ADR 0010）', () => {
  it('R1 owned update 收敛 + diff 定点 + session 状态/方向/角色/远端 id 不变', async () => {
    const hub = await openLeaseFixture({ replication: true });
    const peer = await openPeerFixture(hub);
    const baseState = stateBytes(hub.doc);
    expectOk(
      await hub.lease.mutateData({ op: 'set', path: ['tasks', 't3'], value: { title: 't3', qty: 3 } }),
    );
    await waitForOwnedUpdates(hub, 1);
    const update = hub.ownedUpdates[0]!;
    const plain = new Y.Doc();
    plain.clientID = REPLAY_CLIENT_ID;
    Y.applyUpdate(plain, baseState);
    Y.applyUpdate(plain, update);
    expect((plain.getMap('ROOT').get('tasks') as Y.Map<unknown>).has('t3')).toBe(true);

    const applied = await peer.session!.applyRemoteUpdate(update);
    expect(applied.ok).toBe(true);
    expect(readValue(peer.lease, ['tasks', 't3'])).toEqual(readValue(hub.lease, ['tasks', 't3']));

    const rest = hub.session!.encodeDiff(peer.session!.encodeStateVector());
    const fixpoint = await peer.session!.applyRemoteUpdate(rest);
    expect(fixpoint.ok).toBe(true);
    expect(readRecord(peer.lease, ['tasks', 't3'])).toEqual({ title: 't3', qty: 3 });

    const status = peer.session!.getStatus();
    expect(status.state).toBe('open');
    expect(status.direction).toBe('hub-to-peer');
    expect(peer.session!.localRole).toBe('peer');
    expect(peer.session!.remoteInstanceId).toBe('hub-442');
  });

  it('R2 owned update 为最小增量（空 doc 不物化 ROOT）；一次提交恰一事件、两笔恰两事件', async () => {
    const hub = await openLeaseFixture({ replication: true });
    const baseState = stateBytes(hub.doc);
    expectOk(
      await hub.lease.mutateData({ op: 'set', path: ['tasks', 't3'], value: { title: 't3', qty: 3 } }),
    );
    await waitForOwnedUpdates(hub, 1);
    const update = hub.ownedUpdates[0]!;
    const empty = new Y.Doc();
    Y.applyUpdate(empty, update);
    expect(empty.getMap('ROOT').size).toBe(0);
    const replayed = new Y.Doc();
    Y.applyUpdate(replayed, baseState);
    Y.applyUpdate(replayed, update);
    expect((replayed.getMap('ROOT').get('tasks') as Y.Map<unknown>).has('t3')).toBe(true);

    expectOk(await hub.lease.mutateData({ op: 'delete', path: ['tasks', 't0'] }));
    await waitForOwnedUpdates(hub, 2);
    expect(hub.ownedUpdates.length).toBe(2);
  });

  it('R3 污染在场（peer bootstrap 自含污染）→ 复制后对端既得新值又保留污染（非整 map 重写）', async () => {
    const hub = await openLeaseFixture({ replication: true });
    await applyRawRemote(hub, (doc) => {
      rawMapAt(doc, ['tasks']).set('t9', 'oops');
    });
    const peer = await openPeerFixture(hub); // 对端 bootstrap 自含污染的同基态
    expect(readValue(peer.lease, ['tasks', 't9'])).toBe('oops');

    expectOk(
      await hub.lease.mutateData({ op: 'set', path: ['tasks', 't3'], value: { title: 't3', qty: 3 } }),
    );
    await waitForOwnedUpdates(hub, 1);
    const applied = await peer.session!.applyRemoteUpdate(hub.ownedUpdates[0]!);
    expect(applied.ok).toBe(true);
    expect(readValue(peer.lease, ['tasks', 't9'])).toBe('oops'); // 污染未被整 map 重写抹掉
    expect(readRecord(peer.lease, ['tasks', 't3'])).toEqual({ title: 't3', qty: 3 });
  });
});
