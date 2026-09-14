/**
 * SA6 验收契约（红灯）— issue #347 条件写核心（guard I）：doc-runtime 信封解析 /
 * 槽前评估 / `MUTATION_GUARD_MISMATCH`（ADR 0025，含 ADR 0026 组合节）。
 *
 * 契约来源（用例 ID 与可观察断言按 `wiki/raw/task_issue-347_sa6_contract.md` §12
 * 逐条落地；设计落点为 `wiki/raw/task_issue-347_design.md` §5 D1–D9）：
 * - ADR 0025 L21–44：四操作信封统一可选单条件 `guard`；判司联合 equals（结构深相等）/
 *   absent（无值）；absent 由读失败（PATH_NOT_ALLOWED）或投影 undefined（缺键吸收）满足；
 *   guard 路径禁 `[]`；
 * - ADR 0025 L48–51：评估在 prepare 阶段、信封解析后、局部/legacy 分叉前、先于 schema
 *   校验；槽内纯读、不进事务；
 * - ADR 0025 L53–58：两态错误域——形状错误无码不可重试；评估不满足零写入单 issue、
 *   稳定码 `MUTATION_GUARD_MISMATCH`、issue.path = guard 条件路径、message 含期望/实际
 *   摘要（截断防爆）；
 * - ADR 0025 L72–74 / ADR 0026 L29、L53–55：guard 适用于两种形态顶层；批内元素永远
 *   不得携带 guard（形状错误）；评估先于逐操作 prepare。
 *
 * 红灯现状（HEAD 1b55d5c，SA6 §5 probe 实测）：`guard` 不在任一动词封闭键集，也不在批量
 * 顶层允许键 → 任何携带 guard 的信封在信封解析期按「未知信封键」拒绝（零写入是无键拒绝的
 * 副产物）；形状错误族与评估不满足族不可区分（同文案/零写入/无码）；`MUTATION_GUARD_MISMATCH`
 * 未导出。G/M/O/P 组因此在目标行为处红；S 组在「message 不得是未知键拒绝 + 无码」处红。
 * N 组为负控（无 guard 契约逐字节不变），当前全绿，实现后必须保持全绿。
 *
 * 敏感度对照（防伪绿）：S 组强制 `message` 不匹配 /未知信封键\s*"guard"/ 且先跑合法 guard
 * anchor（证明 guard 面已被识别）；M 组强制 `code === 'MUTATION_GUARD_MISMATCH'`（旧实现
 * 无 code 字段必红）；G 组强制 `ok:true` 且值落盘（旧实现必红）。
 *
 * 纪律：全部断言观察运行时行为（结果联合、活动 Y.Doc 值、事务/update 事件、字节快照），
 * 无 skip/only/todo/env override，无以源码字符串断言代替行为验证。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { evaluate, parseVfsl } from '@nomicore/vfsl';
import type { DerivedSchema } from '@nomicore/vfsl';
import * as docRuntime from '../src/index.js';
import { applyValidatedMutation, materializeRoot } from '../src/index.js';
import type { ApplyValidatedMutationResult, MutationEnvelope, MutationIssue } from '../src/index.js';

// ── 公共面导出（AC7 / P1–P2）：HEAD 为 undefined（红），实现后 === 字面量稳定码 ──────────
const ns = docRuntime as Record<string, unknown>;
const GUARD_MISMATCH_EXPORT = ns.MUTATION_GUARD_MISMATCH;
const MUTATION_GUARD_MISMATCH = 'MUTATION_GUARD_MISMATCH';

// ── fixture（SA6 §12.2 冻结：n:4711, a:'guarded-scalar', tasks.values.more）────────────

const TEXT = `type ROOT = {
  n: number;
  a: string;
  tasks: Record<string, { status: string; reviewer?: string }>;
  values: YArray<number>;
  more: YArray<string>;
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

function baseSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    n: 4711,
    a: 'guarded-scalar',
    tasks: {
      t1: { status: 'draft', reviewer: 'r0' },
      t2: { status: 'open', reviewer: 'r0' },
    },
    values: [1, 2, 3],
    more: ['m'],
    ...overrides,
  };
}

function fixture(snapshot: Record<string, unknown> = baseSnapshot()): Fx {
  const derived = derivedOf(TEXT);
  const doc = new Y.Doc();
  const materialized = materializeRoot(derived, snapshot, doc);
  if (!materialized.ok) throw new Error(JSON.stringify(materialized.issues));
  return { derived, doc, root: doc.getMap('ROOT') };
}

/** 单一 Y.Doc 写入口；第三参公共类型为 `ValidatedMutation | unknown`，guard 信封原样传入。 */
function run(fx: Fx, mutation: unknown): ApplyValidatedMutationResult {
  return applyValidatedMutation(fx.derived, fx.doc, mutation as MutationEnvelope);
}

function bytes(doc: Y.Doc): number[] {
  return [...Y.encodeStateAsUpdate(doc)];
}

function taskEntry(fx: Fx, key: string): Y.Map<unknown> {
  const tasks = fx.root.get('tasks') as Y.Map<unknown>;
  return tasks.get(key) as Y.Map<unknown>;
}

function guardIssues(result: ApplyValidatedMutationResult): MutationIssue[] {
  return result.ok ? [] : (result.issues as MutationIssue[]);
}

/** 本地事务 / update 观测器（零写入承诺的两条可观察面）。 */
function watchWrites(doc: Y.Doc): { txs: { count: number }; updates: Uint8Array[] } {
  const txs = { count: 0 };
  const updates: Uint8Array[] = [];
  doc.on('afterTransaction', (transaction) => {
    if (transaction.local && transaction.changed.size > 0) txs.count += 1;
  });
  doc.on('update', (update: Uint8Array) => updates.push(update));
  return { txs, updates };
}

function expectZeroWrite(
  fx: Fx,
  watch: { txs: { count: number }; updates: Uint8Array[] },
  before: number[],
  label: string,
): void {
  expect(bytes(fx.doc), `${label}：必须零写入（文档逐字节不变）`).toEqual(before);
  expect(watch.txs.count, `${label}：guard 拒绝不得开启本地事务`).toBe(0);
  expect(watch.updates, `${label}：guard 拒绝不得产生 update`).toHaveLength(0);
}

/** 评估不满足的共同断言（M 组）：ok:false、恰 1 issue、稳定码、path = guard 路径、零写入。 */
function expectGuardMismatch(
  fx: Fx,
  result: ApplyValidatedMutationResult,
  before: number[],
  watch: { txs: { count: number }; updates: Uint8Array[] },
  guardPath: Array<string | number>,
  label: string,
): MutationIssue {
  expect(result.ok, `${label}：guard 不满足必须零写入拒绝；实际 ${JSON.stringify(result)}`).toBe(false);
  const issues = guardIssues(result);
  expect(issues, `${label}：v1 单条件、guard 先于逐操作 prepare → 恰一条 issue`).toHaveLength(1);
  const issue = issues[0]!;
  expect(issue.code, `${label}：issue.code 必须为稳定码 MUTATION_GUARD_MISMATCH`).toBe(MUTATION_GUARD_MISMATCH);
  expect(issue.code, `${label}：运行时拒绝码必须与公共入口导出值同源（P2）`).toBe(GUARD_MISMATCH_EXPORT);
  expect(issue.path, `${label}：issue.path 必须为 guard 条件路径的新鲜等价副本`).toEqual(guardPath);
  expectZeroWrite(fx, watch, before, label);
  return issue;
}

/** 形状错误的共同断言（S 组）：ok:false、恰 1 issue、无码（不可重试）、零写入、非未知键文案。 */
function expectShapeError(
  fx: Fx,
  mutation: unknown,
  watch: { txs: { count: number }; updates: Uint8Array[] },
  label: string,
): MutationIssue {
  const before = bytes(fx.doc);
  const result = run(fx, mutation);
  expect(result.ok, `${label}：形状错误必须拒绝；实际 ${JSON.stringify(result)}`).toBe(false);
  const issues = guardIssues(result);
  expect(issues, `${label}：形状错误为 fail-fast 单 issue`).toHaveLength(1);
  const issue = issues[0]!;
  expect(issue.code, `${label}：形状错误必须无稳定码（不可重试语义）`).toBeUndefined();
  expect(issue.message, `${label}：不得仍是「未知信封键 "guard"」能力缺失拒绝`).not.toMatch(/未知信封键\s*"guard"/);
  expectZeroWrite(fx, watch, before, label);
  return issue;
}

/** set n=v 承载 guard 形状用例（防 op 自身缺陷掩盖 guard 形状校验）。 */
function setWithGuard(guard: unknown): unknown {
  return { op: 'set', path: ['n'], value: 5252, guard };
}

// ── P1/P2：公共面导出（AC7）───────────────────────────────────────────────────────

describe('issue #347 公共面 — MutationGuard / MUTATION_GUARD_MISMATCH（AC7，HEAD 红）', () => {
  it('P1 公共入口存在值导出 MUTATION_GUARD_MISMATCH，为字符串且等于冻结字面量', () => {
    expect(
      Object.prototype.hasOwnProperty.call(ns, 'MUTATION_GUARD_MISMATCH'),
      'MUTATION_GUARD_MISMATCH 必须经 src/index.ts 导出（ADR 0025 L58/L87）',
    ).toBe(true);
    expect(typeof GUARD_MISMATCH_EXPORT, 'MUTATION_GUARD_MISMATCH 必须是字符串值导出').toBe('string');
    expect(GUARD_MISMATCH_EXPORT, 'MUTATION_GUARD_MISMATCH 值必须等于冻结字面量').toBe(MUTATION_GUARD_MISMATCH);
  });

  it('P2 行为绑定：评估不满足的 issue.code 必须等于公共入口导出值（同源单点定义）', () => {
    const fx = fixture();
    const result = run(fx, {
      op: 'set',
      path: ['tasks', 't1', 'status'],
      value: 'reviewing',
      guard: { path: ['tasks', 't1', 'status'], equals: 'published' },
    });
    expect(result.ok).toBe(false);
    const issue = guardIssues(result)[0]!;
    expect(issue.code).toBe(MUTATION_GUARD_MISMATCH);
    expect(issue.code).toBe(GUARD_MISMATCH_EXPORT);
  });
});

// ── G1–G7：单操作 guard 满足 → 提交落盘（AC1/AC3，HEAD 红）───────────────────────────

describe('issue #347 G 组 — 单操作四动词 + set([]) 合法 guard 满足（AC1/AC3，HEAD 红）', () => {
  it('G1 set + equals 满足：ok:true、值落盘、恰 1 事务 1 update', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, {
      op: 'set',
      path: ['tasks', 't1', 'status'],
      value: 'reviewing',
      guard: { path: ['tasks', 't1', 'status'], equals: 'draft' },
    });
    expect(result.ok, `合法 guard 且 equals 满足必须提交；实际 ${JSON.stringify(result)}`).toBe(true);
    expect(taskEntry(fx, 't1').get('status')).toBe('reviewing');
    expect(watch.txs.count, '成功提交仍走既有单事务路径').toBe(1);
    expect(watch.updates).toHaveLength(1);
  });

  it('G2 delete + equals 满足：ok:true、目标键删除、guard 路径与写入路径无关', () => {
    const fx = fixture();
    const result = run(fx, {
      op: 'delete',
      path: ['tasks', 't2', 'reviewer'],
      guard: { path: ['tasks', 't1', 'status'], equals: 'draft' },
    });
    expect(result.ok, `delete 携带满足 guard 必须提交；实际 ${JSON.stringify(result)}`).toBe(true);
    expect(taskEntry(fx, 't2').toJSON()).toEqual({ status: 'open' });
  });

  it('G3 array-insert + absent 满足（缺键吸收）：ok:true、数组插值正确', () => {
    const fx = fixture();
    const result = run(fx, {
      op: 'array-insert',
      path: ['values'],
      index: 1,
      values: [9],
      guard: { path: ['tasks', 't9'], absent: true },
    });
    expect(result.ok, `absent 对缺键必须满足；实际 ${JSON.stringify(result)}`).toBe(true);
    expect((fx.root.get('values') as Y.Array<number>).toJSON()).toEqual([1, 9, 2, 3]);
  });

  it('G4 array-delete + equals 满足：ok:true、数组删除生效', () => {
    const fx = fixture();
    const result = run(fx, {
      op: 'array-delete',
      path: ['more'],
      index: 0,
      count: 1,
      guard: { path: ['n'], equals: 4711 },
    });
    expect(result.ok, `array-delete 携带满足 guard 必须提交；实际 ${JSON.stringify(result)}`).toBe(true);
    expect((fx.root.get('more') as Y.Array<string>).toJSON()).toEqual([]);
  });

  it('G5 set([]) legacy 全量管线同样评估 guard：ok:true、ROOT 全等新快照、1 事务 1 update', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const nextRoot = {
      n: 99,
      a: 'guarded-scalar',
      tasks: {
        t1: { status: 'draft', reviewer: 'r0' },
        t2: { status: 'open', reviewer: 'r0' },
      },
      values: [1, 2, 3],
      more: ['m'],
    };
    const result = run(fx, { op: 'set', path: [], value: nextRoot, guard: { path: ['n'], equals: 4711 } });
    expect(result.ok, `set([]) 同样过 guard 评估（ADR 0025 L48）；实际 ${JSON.stringify(result)}`).toBe(true);
    expect(fx.root.toJSON()).toEqual(nextRoot);
    expect(watch.txs.count).toBe(1);
    expect(watch.updates).toHaveLength(1);
  });

  it('G6 absent 对读失败同样满足（标量穿越 / number 段落 Y.Map → PATH_NOT_ALLOWED，非形状错误）', () => {
    const scalarTraversal = fixture();
    const first = run(scalarTraversal, {
      op: 'set',
      path: ['n'],
      value: 5252,
      guard: { path: ['a', 'deep'], absent: true },
    });
    expect(first.ok, `标量穿越读失败 → absent 满足；实际 ${JSON.stringify(first)}`).toBe(true);
    expect(scalarTraversal.root.get('n')).toBe(5252);

    const numberSegment = fixture();
    const second = run(numberSegment, {
      op: 'set',
      path: ['n'],
      value: 5252,
      guard: { path: ['tasks', 0], absent: true },
    });
    expect(second.ok, `number 段落 Y.Map 读失败 → absent 满足（段类型合法，非形状错误）；实际 ${JSON.stringify(second)}`).toBe(true);
    expect(numberSegment.root.get('n')).toBe(5252);
  });

  it('G7 equals 深相等三形态满足：undefined 键过滤 / 键序无关 / 数组下标段与数组值', () => {
    const undefinedKey = fixture();
    const first = run(undefinedKey, {
      op: 'set',
      path: ['n'],
      value: 2,
      guard: { path: ['tasks', 't1'], equals: { status: 'draft', reviewer: 'r0', ghost: undefined } },
    });
    expect(first.ok, `undefined 值键过滤后深相等必须满足；实际 ${JSON.stringify(first)}`).toBe(true);
    expect(undefinedKey.root.get('n')).toBe(2);

    const keyOrder = fixture();
    const second = run(keyOrder, {
      op: 'set',
      path: ['n'],
      value: 2,
      guard: { path: ['tasks', 't1'], equals: { reviewer: 'r0', status: 'draft' } },
    });
    expect(second.ok, `键序无关深相等必须满足；实际 ${JSON.stringify(second)}`).toBe(true);

    const arrayValue = fixture();
    const third = run(arrayValue, {
      op: 'set',
      path: ['n'],
      value: 2,
      guard: { path: ['values'], equals: [1, 2, 3] },
    });
    expect(third.ok, `数组值深相等必须满足；实际 ${JSON.stringify(third)}`).toBe(true);

    const arrayIndex = fixture();
    const fourth = run(arrayIndex, {
      op: 'set',
      path: ['n'],
      value: 2,
      guard: { path: ['values', 0], equals: 1 },
    });
    expect(fourth.ok, `数组下标段 + 标量值深相等必须满足；实际 ${JSON.stringify(fourth)}`).toBe(true);
    expect(arrayIndex.root.get('n')).toBe(2);
  });
});

// ── G8–G9：批量顶层 guard 满足（AC8，HEAD 红）─────────────────────────────────────

const BATCH_OPS = [
  { op: 'set', path: ['tasks', 't1', 'status'], value: 'reviewing' },
  { op: 'set', path: ['tasks', 't1', 'reviewer'], value: 'u9' },
  { op: 'array-insert', path: ['values'], index: 1, values: [9] },
];

describe('issue #347 G8/G9 — 批量顶层 { ops, guard } 满足（AC8，HEAD 红）', () => {
  it('G8 批量 + 顶层 guard 满足：全部落盘、恰 1 事务 1 update（guard 不破坏整批原子）', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, {
      ops: BATCH_OPS,
      guard: { path: ['tasks', 't1', 'status'], equals: 'draft' },
    });
    expect(result.ok, `批量顶层 guard 满足必须整批提交；实际 ${JSON.stringify(result)}`).toBe(true);
    expect(taskEntry(fx, 't1').toJSON()).toEqual({ status: 'reviewing', reviewer: 'u9' });
    expect((fx.root.get('values') as Y.Array<number>).toJSON()).toEqual([1, 9, 2, 3]);
    expect(watch.txs.count, '整批仍单事务').toBe(1);
    expect(watch.updates).toHaveLength(1);
  });

  it('G9 评估一次且读批前 committed：guard 路径被批内操作自己改写仍按批前状态通过', () => {
    const fx = fixture();
    const result = run(fx, {
      ops: [
        { op: 'set', path: ['n'], value: 5252 },
        { op: 'set', path: ['a'], value: 'y' },
      ],
      guard: { path: ['n'], equals: 4711 },
    });
    expect(result.ok, `guard 读批前 committed 必须满足；实际 ${JSON.stringify(result)}`).toBe(true);
    expect(fx.root.get('n')).toBe(5252);
    expect(fx.root.get('a')).toBe('y');
  });
});

// ── M1–M10：评估不满足（AC2/AC3，HEAD 红）────────────────────────────────────────

describe('issue #347 M 组 — guard 评估不满足：零写入单 issue + 稳定码 + guard 路径（AC2/AC3，HEAD 红）', () => {
  it('M1 equals 值不同：单 issue、稳定码、path=guard 路径、零写入、message 含期望与实际', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, {
      op: 'set',
      path: ['tasks', 't1', 'status'],
      value: 'reviewing',
      guard: { path: ['tasks', 't1', 'status'], equals: 'published' },
    });
    const issue = expectGuardMismatch(fx, result, before, watch, ['tasks', 't1', 'status'], 'M1');
    expect(issue.message, 'M1：message 必须含期望摘要 published').toContain('published');
    expect(issue.message, 'M1：message 必须含实际摘要 draft').toContain('draft');
    expect(taskEntry(fx, 't1').get('status'), 'M1：拒绝必须不落盘').toBe('draft');
  });

  it('M2 数值摘要：message 同时含期望 4242 与实际 4711', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, {
      op: 'set',
      path: ['n'],
      value: 2,
      guard: { path: ['n'], equals: 4242 },
    });
    const issue = expectGuardMismatch(fx, result, before, watch, ['n'], 'M2');
    expect(issue.message).toContain('4242');
    expect(issue.message).toContain('4711');
  });

  it('M3 缺键吸收：equals 对投影 undefined 不满足（单 issue + 稳定码 + guard 路径 + 零写入）', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, {
      op: 'set',
      path: ['n'],
      value: 2,
      guard: { path: ['tasks', 't9', 'status'], equals: 'draft' },
    });
    expectGuardMismatch(fx, result, before, watch, ['tasks', 't9', 'status'], 'M3');
  });

  it('M4 absent 对「键有值」不满足：稳定码 + 缺席语义标记 + 实际值摘要 + 零写入', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, {
      op: 'set',
      path: ['n'],
      value: 2,
      guard: { path: ['tasks', 't1', 'status'], absent: true },
    });
    const issue = expectGuardMismatch(fx, result, before, watch, ['tasks', 't1', 'status'], 'M4');
    expect(issue.message, 'M4：message 必须含实际值 draft').toContain('draft');
    expect(issue.message, 'M4：message 必须含缺席语义标记').toMatch(/absent|无值|不存在|缺失|有值/i);
  });

  it('M5 equals 因读失败（PATH_NOT_ALLOWED）不满足：稳定码 + guard 路径 + 零写入', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, {
      op: 'set',
      path: ['n'],
      value: 2,
      guard: { path: ['a', 'deep'], equals: 'guarded-scalar' },
    });
    expectGuardMismatch(fx, result, before, watch, ['a', 'deep'], 'M5');
  });

  it('M6 批量顶层 guard 不满足：恰 1 issue（先于逐 op prepare、无聚合）+ 稳定码 + 零写入 0 事务', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, {
      ops: [
        { op: 'set', path: ['n'], value: 5252 },
        { op: 'set', path: ['a'], value: 'y' },
      ],
      guard: { path: ['n'], equals: 4242 },
    });
    expectGuardMismatch(fx, result, before, watch, ['n'], 'M6');
  });

  it('M6b 批量 guard 读批前 committed：equals=批后意图值（5252）不满足 → 稳定码、零写入', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, { ops: [{ op: 'set', path: ['n'], value: 5252 }], guard: { path: ['n'], equals: 5252 } });
    expectGuardMismatch(fx, result, before, watch, ['n'], 'M6b');
  });

  it('M7 批量 guard 不满足 + 操作值 schema 非法：只报 guard（message 不含类型不匹配）', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, {
      ops: [{ op: 'set', path: ['n'], value: 'bad' }],
      guard: { path: ['n'], equals: 4242 },
    });
    const issue = expectGuardMismatch(fx, result, before, watch, ['n'], 'M7');
    expect(issue.message, 'M7：guard 先于逐 op prepare，不得出现 schema 校验消息').not.toContain('类型不匹配');
  });

  it('M8 截断防爆：1 MiB equals → 稳定码且 message 有界（< 64 KiB）', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, {
      op: 'set',
      path: ['n'],
      value: 2,
      guard: { path: ['n'], equals: 'x'.repeat(1_000_000) },
    });
    const issue = expectGuardMismatch(fx, result, before, watch, ['n'], 'M8');
    expect(issue.message.length, 'M8：message 必须确定性截断（有界）').toBeLessThan(65_536);
  });

  it('M9 可重试语义：状态改写后重放同一 guard 信封通过（state 依赖拒绝，非永久信封拒绝）', () => {
    const fx = fixture();
    const guarded = {
      op: 'set',
      path: ['tasks', 't1', 'status'],
      value: 'reviewing',
      guard: { path: ['tasks', 't1', 'status'], equals: 'published' },
    };
    const first = run(fx, guarded);
    expect(first.ok, 'M9：首次必须拒绝').toBe(false);
    expect(taskEntry(fx, 't1').get('status')).toBe('draft');

    const rewrite = run(fx, { op: 'set', path: ['tasks', 't1', 'status'], value: 'published' });
    expect(rewrite.ok, 'M9：无 guard 对照写必须提交').toBe(true);

    const replay = run(fx, guarded);
    expect(replay.ok, `M9：重放同一信封必须通过（可重试）；实际 ${JSON.stringify(replay)}`).toBe(true);
    expect(taskEntry(fx, 't1').get('status')).toBe('reviewing');
  });

  it('M10 深相等非子集：equals 缺实际存在的键即不满足（防「含子集即满足」误实现）', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, {
      op: 'set',
      path: ['n'],
      value: 2,
      guard: { path: ['tasks', 't1'], equals: { status: 'draft' } },
    });
    expectGuardMismatch(fx, result, before, watch, ['tasks', 't1'], 'M10');
  });
});

// ── O1–O3：评估次序（guard 先于 schema 校验，AC5）─────────────────────────────────

describe('issue #347 O 组 — guard 评估先于 schema 校验（AC5，HEAD 红）', () => {
  it('O1 guard 不满足 + 新值违反 schema：只报 guard（单 issue + 稳定码，无类型不匹配）', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, {
      op: 'set',
      path: ['n'],
      value: 'bad',
      guard: { path: ['n'], equals: 4242 },
    });
    const issue = expectGuardMismatch(fx, result, before, watch, ['n'], 'O1');
    expect(issue.message, 'O1：guard 不满足时 schema 管线不得先行报错').not.toContain('类型不匹配');
  });

  it('O2 对照（guard 满足 + 新值非法）：schema 管线仍可达——ok:false、无码、类型不匹配', () => {
    const fx = fixture();
    const result = run(fx, {
      op: 'set',
      path: ['n'],
      value: 'bad',
      guard: { path: ['n'], equals: 4711 },
    });
    expect(result.ok, `O2：guard 满足后必须进入 schema 校验并拒绝；实际 ${JSON.stringify(result)}`).toBe(false);
    const issue = guardIssues(result)[0]!;
    expect(issue.code, 'O2：schema 域拒绝无稳定码（两态可判别）').toBeUndefined();
    expect(issue.message, 'O2：必须证明 schema 管线在 guard 之后可达').toContain('类型不匹配');
  });

  it('O3 对照（guard 满足 + 批量两操作非法）：聚合 ≥2 issues、各无码、零写入', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, {
      ops: [
        { op: 'set', path: ['n'], value: 'bad' },
        { op: 'set', path: ['a'], value: 5 },
      ],
      guard: { path: ['n'], equals: 4711 },
    });
    expect(result.ok, 'O3：guard 满足不改变批量操作失败聚合语义').toBe(false);
    const issues = guardIssues(result);
    expect(issues.length, `O3：必须聚合两个失败操作；实际 ${JSON.stringify(result)}`).toBeGreaterThanOrEqual(2);
    const paths = issues.map((issue) => JSON.stringify(issue.path));
    expect(paths).toContain(JSON.stringify(['n']));
    expect(paths).toContain(JSON.stringify(['a']));
    for (const issue of issues) expect(issue.code, 'O3：操作失败 issue 无稳定码').toBeUndefined();
    expectZeroWrite(fx, watch, before, 'O3');
  });
});

// ── S1–S8（+设计 §5 D4 三项裁定）：形状错误全家桶（AC4，HEAD 红）─────────────────────

describe('issue #347 S 组 — guard 形状错误：无码零写入不可重试（AC4，HEAD 红）', () => {
  it('S0 anchor：合法 guard 且 equals 满足必须提交（证明 guard 面已被识别，防与能力缺失同义反复）', () => {
    const fx = fixture();
    const result = run(fx, {
      op: 'set',
      path: ['n'],
      value: 2,
      guard: { path: ['n'], equals: 4711 },
    });
    expect(result.ok, `S 组 anchor 必须通过（否则形状错误断言与「未知键拒绝」同义）；实际 ${JSON.stringify(result)}`).toBe(true);
  });

  it('S1 guard 非对象：42 / null / "x" / []', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    for (const guard of [42, null, 'x', []]) {
      const issue = expectShapeError(fx, setWithGuard(guard), watch, `S1 guard=${JSON.stringify(guard)}`);
      expect(issue.path, 'S1：信封级错误 path 为 []').toEqual([]);
    }
  });

  it('S2 equals/absent 非恰其一：同现 / 皆缺', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    expectShapeError(fx, setWithGuard({ path: ['n'], equals: 4711, absent: true }), watch, 'S2 同现');
    expectShapeError(fx, setWithGuard({ path: ['n'] }), watch, 'S2 皆缺');
  });

  it('S3 缺 path：{equals} / {absent}', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    expectShapeError(fx, setWithGuard({ equals: 4711 }), watch, 'S3 缺 path（equals）');
    expectShapeError(fx, setWithGuard({ absent: true }), watch, 'S3 缺 path（absent）');
  });

  it('S4 absent 非字面 true：1 / "true" / false', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    for (const absent of [1, 'true', false]) {
      expectShapeError(fx, setWithGuard({ path: ['n'], absent }), watch, `S4 absent=${JSON.stringify(absent)}`);
    }
  });

  it('S5 path 段类型错误：true / {} / null', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    expectShapeError(fx, setWithGuard({ path: ['n', true], equals: 4711 }), watch, 'S5 段 true');
    expectShapeError(fx, setWithGuard({ path: [{}], equals: 4711 }), watch, 'S5 段 object');
    expectShapeError(fx, setWithGuard({ path: ['n', null], equals: 4711 }), watch, 'S5 段 null');
  });

  it('S6 path 为 []：equals 形态与 absent 形态均形状错误（ROOT 整树 CAS v1 拒绝）', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    expectShapeError(fx, setWithGuard({ path: [], equals: 4711 }), watch, 'S6 path=[]（equals）');
    expectShapeError(fx, setWithGuard({ path: [], absent: true }), watch, 'S6 path=[]（absent）');
  });

  it('S7 equals 任意深度含非有限数：NaN / Infinity / -Infinity / 嵌套数组与对象', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    expectShapeError(fx, setWithGuard({ path: ['n'], equals: NaN }), watch, 'S7 NaN');
    expectShapeError(fx, setWithGuard({ path: ['n'], equals: Infinity }), watch, 'S7 Infinity');
    expectShapeError(fx, setWithGuard({ path: ['n'], equals: -Infinity }), watch, 'S7 -Infinity');
    expectShapeError(fx, setWithGuard({ path: ['n'], equals: { v: [NaN] } }), watch, 'S7 嵌套数组 NaN');
    expectShapeError(fx, setWithGuard({ path: ['n'], equals: { v: { w: Infinity } } }), watch, 'S7 嵌套对象 Infinity');
  });

  it('S8 批量顶层 guard 形状错误：42 / 缺判别键 / path=[] / absent 非字面 true（无码零写入）', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const ops = [{ op: 'set', path: ['n'], value: 5252 }];
    expectShapeError(fx, { ops, guard: 42 }, watch, 'S8 guard=42');
    expectShapeError(fx, { ops, guard: { path: ['n'] } }, watch, 'S8 缺判别键');
    expectShapeError(fx, { ops, guard: { path: [], equals: 4711 } }, watch, 'S8 path=[]');
    expectShapeError(fx, { ops, guard: { path: ['n'], absent: 1 } }, watch, 'S8 absent 非字面 true');
  });

  it('S9 设计 §5 D4 裁定：guard 内未知键 = 形状错误（封闭判别联合）', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const issue = expectShapeError(fx, setWithGuard({ path: ['n'], absent: true, zzz: 1 }), watch, 'S9 guard 内未知键');
    expect(issue.message, 'S9：必须点名未知键').toContain('zzz');
  });

  it('S10 设计 §5 D4 裁定：equals 键存在但值为 undefined = 形状错误（无值断言请用 absent: true）', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    expectShapeError(fx, setWithGuard({ path: ['n'], equals: undefined }), watch, 'S10 equals=undefined');
  });

  it('S11 设计 §5 D4 裁定：{ guard: undefined }（键在值为 undefined）= 形状错误', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    expectShapeError(fx, { op: 'set', path: ['n'], value: 5252, guard: undefined }, watch, 'S11 guard=undefined');
  });
});

// ── N1–N4：负控（HEAD 绿；无 guard 契约与元素禁令逐字节不变）─────────────────────────

describe('issue #347 N 组 — 负控：无 guard 契约与元素禁令保持（HEAD 绿，实现后必须保持）', () => {
  it('N1 无 guard 四动词各自 ok:true、各 1 事务 1 update；未知键 zzz 文案与零写入不变', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    expect(run(fx, { op: 'set', path: ['n'], value: 2 }).ok).toBe(true);
    expect(run(fx, { op: 'delete', path: ['tasks', 't2', 'reviewer'] }).ok).toBe(true);
    expect(run(fx, { op: 'array-insert', path: ['values'], index: 3, values: [4] }).ok).toBe(true);
    expect(run(fx, { op: 'array-delete', path: ['more'], index: 0, count: 1 }).ok).toBe(true);
    expect(fx.root.get('n')).toBe(2);
    expect(taskEntry(fx, 't2').toJSON()).toEqual({ status: 'open' });
    expect((fx.root.get('values') as Y.Array<number>).toJSON()).toEqual([1, 2, 3, 4]);
    expect((fx.root.get('more') as Y.Array<string>).toJSON()).toEqual([]);
    expect(watch.txs.count).toBe(4);
    expect(watch.updates).toHaveLength(4);

    const before = bytes(fx.doc);
    const unknownKey = run(fx, { op: 'set', path: ['n'], value: 2, zzz: 1 });
    expect(unknownKey.ok).toBe(false);
    const issue = guardIssues(unknownKey)[0]!;
    expect(issue.message).toContain('未知信封键 "zzz"');
    expect(issue.message).toContain('操作 set');
    expect(bytes(fx.doc)).toEqual(before);
  });

  it('N2 无 guard 批量三操作 ok:true（1 事务 1 update）；批量顶层未知键 zzz 仍零写入拒绝', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, { ops: BATCH_OPS });
    expect(result.ok).toBe(true);
    expect(watch.txs.count).toBe(1);
    expect(watch.updates).toHaveLength(1);

    const before = bytes(fx.doc);
    const unknownKey = run(fx, { ops: [{ op: 'set', path: ['n'], value: 3 }], zzz: 1 });
    expect(unknownKey.ok).toBe(false);
    expect(guardIssues(unknownKey)[0]?.message).toContain('未知信封键 "zzz"');
    expect(bytes(fx.doc)).toEqual(before);
  });

  it('N3 批量元素携带 guard = 形状错误（无码、零写入、0 事务 0 update；ADR 0026 L29 冻结面）', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, {
      ops: [{ op: 'set', path: ['n'], value: 5252, guard: { path: ['n'], equals: 4711 } }],
    });
    expect(result.ok, '批内元素永远不得携带 guard').toBe(false);
    const issue = guardIssues(result)[0]!;
    expect(issue.code, 'N3：元素 guard 为形状错误（不可重试）').toBeUndefined();
    expectZeroWrite(fx, watch, before, 'N3');
  });

  it('N4 无 guard set([]) legacy 全量重装仍 ok:true（ADR 0008 L47）', () => {
    const fx = fixture();
    const nextRoot = {
      n: 5,
      a: 'z',
      tasks: {
        t1: { status: 'draft', reviewer: 'r0' },
        t2: { status: 'open', reviewer: 'r0' },
      },
      values: [1, 2, 3],
      more: ['m'],
    };
    const watch = watchWrites(fx.doc);
    const result = run(fx, { op: 'set', path: [], value: nextRoot });
    expect(result.ok).toBe(true);
    expect(fx.root.toJSON()).toEqual(nextRoot);
    expect(watch.txs.count).toBe(1);
  });
});
