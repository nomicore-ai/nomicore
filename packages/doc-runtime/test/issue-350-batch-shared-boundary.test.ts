/**
 * issue #350 验收（F1/F5/F6 落点）— 批量信封的共享边界组合期望边界（ADR 0026 §7.5.2）。
 *
 * 契约来源（设计 `wiki/raw/task_issue-350_design.md` §12.1 文件 A；SA2 iteration 2 §12
 * AC1′/组合失败 fail-closed 行）：
 * - ADR 0026 L30：批内路径互不嵌套——**共享语义边界的兄弟路径合法**（不同键终段）；
 * - ADR 0026 L34：全部成功 → 单事务按序提交 → 逐操作边界验证；
 * - ADR 0007 #237 §5：E201-C 只保留给**真实**提交后偏离（伪触发 = 永久禁写）；
 * - 设计 §7.5.2/§7.5.3（引理 2/3/4/4′）：record/parent/union 边界的期望值必须折入同批
 *   包含足迹（含 array-* 载荷），target/array 边界天然免疫；组合边界无成员可容时
 *   fail-closed 聚合拒绝（零写入、无 fatal、无部分写）。
 *
 * 断言纪律：全部观察运行时行为（返回值、活动 Y.Doc 值、本地事务/update 事件、字节快照）；
 * `ok:true` 断言到达即证无 fatal（E201-C/D 为 throw 通道）；无 skip/only/todo/env override；
 * 无源码字符串断言。S1–S7 在本实现前红（`{ops}` 未被识别）；S8 为负向守卫——判别力在实现
 * 落地时（漏实现/弱化阶段 C 整体校验 → `ok:true` 红；误走 throw → no-throw 红；部分写 →
 * 字节不变红）。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { evaluate, parseVfsl } from '@nomicore/vfsl';
import type { DerivedSchema } from '@nomicore/vfsl';
import { applyValidatedMutation, materializeRoot } from '../src/index.js';
import type { ApplyValidatedMutationResult, MutationEnvelope, MutationIssue } from '../src/index.js';

// ── fixture ──────────────────────────────────────────────────────────────────

const TEXT = `type ROOT = {
  n: number;
  a: string;
  values: YArray<number>;
  tasks: Record<string, { status: string; reviewer?: string; notes: YArray<string> }>;
  point: { kind: "a"; x: number; y: number } | { kind: "b"; label: string };
  u: { x?: number; label?: number } | { label?: string; x?: string };
};`;

function derivedOf(text: string): DerivedSchema {
  const parsed = parseVfsl(text);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  const evaluated = evaluate(parsed.module);
  if (!evaluated.ok) throw new Error(JSON.stringify(evaluated.issues));
  return evaluated.derived;
}

interface Fx {
  derived: DerivedSchema;
  doc: Y.Doc;
  root: Y.Map<unknown>;
}

function baseSnapshot(): Record<string, unknown> {
  return {
    n: 1,
    a: 'x',
    values: [1, 2, 3],
    tasks: {
      t1: { status: 'open', reviewer: 'r0', notes: ['n0'] },
      t2: { status: 'open', reviewer: 'r0', notes: ['n0'] },
    },
    point: { kind: 'a', x: 1, y: 1 },
    u: {},
  };
}

function entry(status: string, notes: string[], reviewer = 'r0'): Record<string, unknown> {
  return { status, reviewer, notes };
}

function fixture(snapshot: Record<string, unknown> = baseSnapshot()): Fx {
  const derived = derivedOf(TEXT);
  const doc = new Y.Doc();
  const materialized = materializeRoot(derived, snapshot, doc);
  if (!materialized.ok) throw new Error(JSON.stringify(materialized.issues));
  return { derived, doc, root: doc.getMap('ROOT') };
}

function run(fx: Fx, mutation: unknown): ApplyValidatedMutationResult {
  return applyValidatedMutation(fx.derived, fx.doc, mutation as MutationEnvelope);
}

function bytes(doc: Y.Doc): number[] {
  return [...Y.encodeStateAsUpdate(doc)];
}

function tasksMap(fx: Fx): Y.Map<unknown> {
  return fx.root.get('tasks') as Y.Map<unknown>;
}

function taskEntry(fx: Fx, key: string): Y.Map<unknown> {
  return tasksMap(fx).get(key) as Y.Map<unknown>;
}

function notesOf(fx: Fx, key: string): unknown {
  return (taskEntry(fx, key).get('notes') as Y.Array<string>).toJSON();
}

function issuePaths(result: ApplyValidatedMutationResult): Array<Array<string | number>> {
  return result.ok ? [] : (result.issues as MutationIssue[]).map((issue) => [...issue.path]);
}

/** 构造前置：证明每个元素单独作为单操作信封合法（防「共享边界正例」因元素本身非法而空转）。 */
function expectEachOpLegalAlone(ops: readonly unknown[]): void {
  for (const op of ops) {
    const scratch = fixture();
    const result = run(scratch, op);
    expect(result.ok, `构造前置失败：元素单独必须合法（${JSON.stringify(op)}）；实际 ${JSON.stringify(result)}`).toBe(true);
  }
}

/** 本地事务计数（ADR 0026 L34：全部成功 → 单事务按序提交）。 */
function countLocalTransactions(doc: Y.Doc): { count: number } {
  const counter = { count: 0 };
  doc.on('afterTransaction', (transaction) => {
    if (transaction.local && transaction.changed.size > 0) counter.count += 1;
  });
  return counter;
}

interface BatchObservation {
  txs: { count: number };
  updates: Uint8Array[];
}

function observe(fx: Fx): BatchObservation {
  const txs = countLocalTransactions(fx.doc);
  const updates: Uint8Array[] = [];
  fx.doc.on('update', (update: Uint8Array) => updates.push(update));
  return { txs, updates };
}

// ── S1–S7：共享边界合法批量（ADR 0026 L30 兄弟路径 + §7.5.2 组合期望边界）──────────

describe('issue #350 共享边界批量 — 组合期望边界使合法共享边界不伪触发 E201-C（设计 §12.1 文件 A）', () => {
  it('S1 delete + 兄弟 set 共享 parent 边界：单事务 1 update，update 时刻已见终态（无 fatal）', () => {
    const ops = [
      { op: 'delete', path: ['tasks', 't1', 'reviewer'] },
      { op: 'set', path: ['tasks', 't1', 'status'], value: 'reviewing' },
    ];
    expectEachOpLegalAlone(ops);

    const fx = fixture();
    const { txs, updates } = observe(fx);
    const observed: unknown[] = [];
    fx.doc.on('update', () => observed.push(taskEntry(fx, 't1').toJSON()));

    const result = run(fx, { ops });

    expect(result.ok, `共享 parent 边界的合法批量必须 ok:true（ok:true 到达即证无 E201-C fatal）；实际 ${JSON.stringify(result)}`).toBe(true);
    expect(taskEntry(fx, 't1').toJSON()).toEqual({ status: 'reviewing', notes: ['n0'] });
    expect(txs.count, '单事务：不得逐操作各开一个事务').toBe(1);
    expect(updates, '单事务产出一条 update').toHaveLength(1);
    expect(observed, '观察者所见每一态都必须是全部操作生效后的态').toEqual([{ status: 'reviewing', notes: ['n0'] }]);
  });

  it('S2 双 Record-键创建共享 record 边界：两键落盘、单事务 1 update（无 fatal）', () => {
    const ops = [
      { op: 'set', path: ['tasks', 't3'], value: entry('open', ['n3']) },
      { op: 'set', path: ['tasks', 't4'], value: entry('open', ['n4']) },
    ];
    expectEachOpLegalAlone(ops);

    const fx = fixture();
    const { txs, updates } = observe(fx);
    const result = run(fx, { ops });

    expect(result.ok, `共享 record 边界的双键创建必须 ok:true；实际 ${JSON.stringify(result)}`).toBe(true);
    expect(taskEntry(fx, 't3').toJSON()).toEqual({ status: 'open', reviewer: 'r0', notes: ['n3'] });
    expect(taskEntry(fx, 't4').toJSON()).toEqual({ status: 'open', reviewer: 'r0', notes: ['n4'] });
    expect(txs.count).toBe(1);
    expect(updates).toHaveLength(1);
  });

  it('S3 双 Record-键删除共享 record 边界：两键消失、单事务 1 update（无 fatal）', () => {
    const ops = [
      { op: 'delete', path: ['tasks', 't1'] },
      { op: 'delete', path: ['tasks', 't2'] },
    ];
    expectEachOpLegalAlone(ops);

    const fx = fixture();
    const { txs, updates } = observe(fx);
    const result = run(fx, { ops });

    expect(result.ok, `共享 record 边界的双键删除必须 ok:true；实际 ${JSON.stringify(result)}`).toBe(true);
    expect(tasksMap(fx).has('t1')).toBe(false);
    expect(tasksMap(fx).has('t2')).toBe(false);
    expect(txs.count).toBe(1);
    expect(updates).toHaveLength(1);
  });

  it('S4 op1 record 边界包含 op2 写位：组合不得漏吸收（无 fatal）', () => {
    const ops = [
      { op: 'set', path: ['tasks', 't3'], value: entry('open', ['n3']) },
      { op: 'set', path: ['tasks', 't1', 'status'], value: 'held' },
    ];
    expectEachOpLegalAlone(ops);

    const fx = fixture();
    const { txs, updates } = observe(fx);
    const result = run(fx, { ops });

    expect(result.ok, `record 边界包含兄弟写位的合法批量必须 ok:true；实际 ${JSON.stringify(result)}`).toBe(true);
    expect(taskEntry(fx, 't3').toJSON()).toEqual({ status: 'open', reviewer: 'r0', notes: ['n3'] });
    expect(taskEntry(fx, 't1').get('status')).toBe('held');
    expect(txs.count).toBe(1);
    expect(updates).toHaveLength(1);
  });

  it('S5 判别联合位兄弟写（relPath 不同成员字段）：组合后仍被成员容纳（无 fatal）', () => {
    const ops = [
      { op: 'set', path: ['point', 'x'], value: 2 },
      { op: 'set', path: ['point', 'y'], value: 3 },
    ];
    expectEachOpLegalAlone(ops);

    const fx = fixture();
    const { txs, updates } = observe(fx);
    const result = run(fx, { ops });

    expect(result.ok, `union 位兄弟写必须 ok:true；实际 ${JSON.stringify(result)}`).toBe(true);
    expect((fx.root.get('point') as Y.Map<unknown>).toJSON()).toEqual({ kind: 'a', x: 2, y: 3 });
    expect(txs.count).toBe(1);
    expect(updates).toHaveLength(1);
  });

  it('S6 包含谓词精度：非包含足迹（兄弟 Record 条目）不得被误吸收（无 fatal）', () => {
    const ops = [
      { op: 'delete', path: ['tasks', 't1', 'reviewer'] },
      { op: 'set', path: ['tasks', 't1', 'status'], value: 'reviewing' },
      { op: 'array-insert', path: ['tasks', 't2', 'notes'], index: 1, values: ['n1'] },
    ];
    expectEachOpLegalAlone(ops);

    const fx = fixture();
    const { txs, updates } = observe(fx);
    const result = run(fx, { ops });

    expect(result.ok, `包含精度形态必须 ok:true；实际 ${JSON.stringify(result)}`).toBe(true);
    expect(taskEntry(fx, 't1').toJSON()).toEqual({ status: 'reviewing', notes: ['n0'] });
    expect(notesOf(fx, 't2')).toEqual(['n0', 'n1']);
    expect(txs.count).toBe(1);
    expect(updates).toHaveLength(1);
  });

  it('S7 array-* 载荷折入共享 parent 边界（F5）：array-insert 足迹必须折入 delete 边界（无 fatal）', () => {
    const ops = [
      { op: 'delete', path: ['tasks', 't1', 'reviewer'] },
      { op: 'array-insert', path: ['tasks', 't1', 'notes'], index: 1, values: ['n1'] },
    ];
    expectEachOpLegalAlone(ops);

    const fx = fixture();
    const { txs, updates } = observe(fx);
    const result = run(fx, { ops });

    expect(result.ok, `array-* 载荷折入共享边界必须 ok:true（漏折迭 → 伪 E201-C throw；误拒 → ok:false）；实际 ${JSON.stringify(result)}`).toBe(true);
    expect(taskEntry(fx, 't1').toJSON()).toEqual({ status: 'open', notes: ['n0', 'n1'] });
    expect(txs.count).toBe(1);
    expect(updates).toHaveLength(1);
  });
});

// ── S8：组合失败 fail-closed 负向守卫（F6；HEAD 即绿，判别力在实现期）──────────────

/**
 * S8 构造的 SA3 记录（设计 §12.1 的字面 fixture 不可执行，语义不变、构造等价替换）：
 * 设计原字面 `u: { x?: number } | { label?: string }` 的两个操作**并非各自单独合法**——
 * 对空 `u`（Y.Map 无键），`walkUnion` 的封闭 map 成员试验对「全可选字段缺席」直接接受，
 * 声明序首成员恒胜；写侧 `navigateLive → resolveNode` 同判据仲裁出成员 0（仅声明 `x`），
 * 于是 `set ['u','label']` 在**单操作**路径即 `childNodeOf` 失败 → E204 fatal（本仓库
 * 既有行为，`mutation-local.ts` 未改动；`expectEachOpLegalAlone` 前置因此无法通过）。
 * 替换为同构造类（非判别联合、全可选字段、封闭对象 any-of 重叠）的**镜像成员**：
 * 两成员都声明 `x`/`label`（保证两个操作各自可导航），但值类型互斥——单操作时各自由一个
 * 成员容纳，折迭后 `{x:5,label:'L'}` 无成员可容。断言语义与设计逐字一致（ok:false、
 * 聚合 issues、字节不变、0 事务 0 update、无 fatal、后续单操作仍 ok）。
 */
describe('issue #350 组合失败负向守卫 — union 成员 any-of 重叠批量整体零写入（设计 §7.5.2/引理 4′）', () => {
  it('S8 两操作各自合法但组合边界无成员可容：ok:false 聚合、零写入、无 fatal、写能力保持', () => {
    const ops = [
      { op: 'set', path: ['u', 'x'], value: 5 },
      { op: 'set', path: ['u', 'label'], value: 'L' },
    ];
    expectEachOpLegalAlone(ops);

    const fx = fixture();
    const before = bytes(fx.doc);
    const { txs, updates } = observe(fx);

    const result = run(fx, { ops });

    expect(result.ok, `组合边界无 union 成员可容 → 必须 fail-closed 拒绝（弱化/删除阶段 C 整体校验 → ok:true 红）；实际 ${JSON.stringify(result)}`).toBe(false);
    expect(issuePaths(result).length, '组合失败必须携带聚合 issues').toBeGreaterThanOrEqual(1);
    expect(bytes(fx.doc), '组合失败必须整体零写入（不得部分写）').toEqual(before);
    expect(txs.count, '组合失败不得开事务').toBe(0);
    expect(updates, '组合失败不得产生 update').toHaveLength(0);

    // 写能力保持：组合失败是返回值而非 fatal（不得 markWriteFatal / 误走 throw 通道）
    const after = run(fx, { op: 'set', path: ['n'], value: 2 });
    expect(after.ok, `组合失败后后续单操作必须仍 ok:true（证明无永久禁写）；实际 ${JSON.stringify(after)}`).toBe(true);
    expect(fx.root.get('n')).toBe(2);
  });
});

// ── 文件内负控：单操作路径行为不变 + 结果确定性 ────────────────────────────────

describe('issue #350 共享边界文件内负控 — 单操作等价与确定性', () => {
  it('S1/S7 批量的单操作等价逐个执行结果一致（组合逻辑不外溢到单操作路径）', () => {
    const singleS1 = fixture();
    expect(run(singleS1, { op: 'delete', path: ['tasks', 't1', 'reviewer'] }).ok).toBe(true);
    expect(run(singleS1, { op: 'set', path: ['tasks', 't1', 'status'], value: 'reviewing' }).ok).toBe(true);

    const batchS1 = fixture();
    expect(run(batchS1, {
      ops: [
        { op: 'delete', path: ['tasks', 't1', 'reviewer'] },
        { op: 'set', path: ['tasks', 't1', 'status'], value: 'reviewing' },
      ],
    }).ok).toBe(true);
    expect(taskEntry(batchS1, 't1').toJSON()).toEqual(taskEntry(singleS1, 't1').toJSON());

    const singleS7 = fixture();
    expect(run(singleS7, { op: 'delete', path: ['tasks', 't1', 'reviewer'] }).ok).toBe(true);
    expect(run(singleS7, { op: 'array-insert', path: ['tasks', 't1', 'notes'], index: 1, values: ['n1'] }).ok).toBe(true);

    const batchS7 = fixture();
    expect(run(batchS7, {
      ops: [
        { op: 'delete', path: ['tasks', 't1', 'reviewer'] },
        { op: 'array-insert', path: ['tasks', 't1', 'notes'], index: 1, values: ['n1'] },
      ],
    }).ok).toBe(true);
    expect(taskEntry(batchS7, 't1').toJSON()).toEqual(taskEntry(singleS7, 't1').toJSON());
  });

  it('S1 批量在双 fixture 上重复执行结果确定性同果（无状态漂移）', () => {
    const batch = {
      ops: [
        { op: 'delete', path: ['tasks', 't1', 'reviewer'] },
        { op: 'set', path: ['tasks', 't1', 'status'], value: 'reviewing' },
      ],
    };
    const first = fixture();
    const second = fixture();
    const r1 = run(first, batch);
    const r2 = run(second, batch);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(taskEntry(first, 't1').toJSON()).toEqual(taskEntry(second, 't1').toJSON());
  });
});
