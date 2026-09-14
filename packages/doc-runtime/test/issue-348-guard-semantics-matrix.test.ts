/**
 * issue #348 语义矩阵 — 条件写（guard II）评估语义回归锚（**目标绿**，非红灯契约）。
 *
 * 定位：ADR 0025「评估语义」的全部边角在此固化为可执行锚。guard 能力本身已由 #347
 * （61e2daa，红灯落地）+ 传递前置 #350/ADR 0026（1b55d5c）实现，HEAD 无红灯；本文件
 * 不伪称红灯（SA6 契约 §13）——被证明的真实缺口是既有 447 用例对错误实现模型 M2
 * （`-0`/`0` 误判不等）与 M3（`set([])` 跳过 guard）完全盲（SA6 §9.2）。
 *
 * 契约来源：`wiki/raw/task_issue-348_sa6_contract.md` §12.0–§12.9（用例 ID 与可观察判决
 * 契约逐条落地；每组 doc/guard 前置条件以 §12.2–§12.8 表行首为准），设计落点
 * `wiki/raw/task_issue-348_design.md` §7 D1–D9 / §8.1–§8.2。规范条款：
 * - ADR 0025 L42–44：`equals` 与投影逻辑值**结构深相等**（undefined 键过滤；比较对象 =
 *   `readLogicalValueAtPath` 投影值）；`absent` 由读失败（PATH_NOT_ALLOWED）或投影
 *   undefined（缺键吸收）满足；guard 路径段纪律同 mutation path（string=键 / number=数组
 *   下标）；穿越 XML 等「不可下钻终态」→ 读失败 → equals 不满足 / absent 满足；指向 XML
 *   终点则与其投影语义字符串比较；guard 路径禁 `[]`；
 * - ADR 0025 L48–51：评估在 prepare 阶段、解析后、局部/legacy 分叉前、先于 schema 校验；
 *   槽内纯读（零写入零事件）、不进事务；
 * - ADR 0025 L53–58：错误域两态——形状错误无码不可重试；评估不满足零写入单 issue、
 *   稳定码 `MUTATION_GUARD_MISMATCH`、`issue.path` = guard 条件路径、message 有界摘要；
 * - ADR 0025 L72–74 / ADR 0026 L29、L53–55：guard 适用于两种形态顶层；批内元素禁 guard；
 *   批量顶层 guard 恰一次、读批前 committed、先于逐操作 prepare；
 * - ADR 0008 L23：缺键/越界成功返回 `undefined`（缺席吸收）、中间缺失立即结束；L26：
 *   `Y.XmlFragment` 是不可下钻终态，终点投影语义字符串；
 * - ADR 0007 L29：路径段纪律（map/object 用 string、Y.Array 用 number；leaf/plain/XML
 *   是不可下钻终态）；L93–96：`set([])` 是唯一合法全量形态，继续走完整 ROOT 清空重装。
 *
 * 负控组织（SA6 §12.9，设计 §7 D5）：N-A（无 guard 基线）与 N-E（公共导出面）以
 * `issue-347-guard-envelope-red.test.ts` / `public-surface-guard.test.ts` 引用保持；N-B
 * （equals 反极性）/ N-C（absent 反极性）/ N-D（评估先于 schema 的次序对照）在本文件内
 * 成对落位（A1↔A1d、A3↔A4、A5/A2↔A7、F1/F2↔F3/F4；B 组读失败 absent 满足 ↔ B25/C3/
 * E6/G3 有值不满足；E4↔E7）。
 *
 * 反伪绿证据（非重言式）：SA6 §9.2 变异实验中，M1（读失败误判 equals 满足）击穿 13 例、
 * M2（-0/0 判不等）击穿 A1/A1b/A8/A12/G6 5 例、M3（set([]) 跳 guard）击穿 E1/E6/E7
 * 3 例、M4（去 undefined 键过滤）击穿 A5/A6/G8 3 例——本矩阵对四个错误模型全部敏感。
 *
 * 澄清（SA2 评审 R1/R2 落实）：各组 fixture 变体非穷举枚举，前置条件一律以 SA6 §12.2–
 * §12.8 表为准（A1/A1d `n:0`、A8 `values:[1,0,3]`、G6 `n:0`、E5 schema 合法全量快照已
 * 逐条落码）；B28（detached 载体经 plain 容器内嵌）是「loud 拒绝而非静默空投影」的区分
 * 锚——静默投影 `''` 会使 absent 满足转红；B29/B30 锚读失败路径上 equals 的 M1 敏感性，
 * 不主张「内容字面相等仍不满足」（空 fragment 无可比内容）。
 *
 * 纪律（SA6 §12.0）：全部断言观察运行时行为（结果联合、活动 Y.Doc 值、本地事务/update
 * 事件计数、`Y.encodeStateAsUpdate` 字节快照）；无 skip/only/todo、无 env override、无
 * 源码字符串断言；message 文案仅作次级辅助断言，主断言恒为判决契约（稳定码 + path +
 * 零写入三件套）；每个 `it` 独立 fixture，无跨用例共享可变状态。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { evaluate, parseVfsl } from '@nomicore/vfsl';
import type { DerivedSchema } from '@nomicore/vfsl';
import * as docRuntime from '../src/index.js';
import { applyValidatedMutation, materializeRoot } from '../src/index.js';
import type { ApplyValidatedMutationResult, MutationEnvelope, MutationIssue } from '../src/index.js';

// ── 公共面导出（N-E）：运行时稳定码必须与公共入口导出值同源（#347 P2 同款）──────────────
const ns = docRuntime as Record<string, unknown>;
const GUARD_MISMATCH_EXPORT = ns.MUTATION_GUARD_MISMATCH;
const MUTATION_GUARD_MISMATCH = 'MUTATION_GUARD_MISMATCH';

// ── fixture（SA6 §12.0 冻结文本；#347 fixture 的严格超集：新增 t3/body/blob/free）────────
const TEXT = `type Task = { status: string; reviewer?: string; tags?: YArray<string> };
type ROOT = {
  n: number; a: string;
  tasks: Record<string, Task>;
  values: YArray<number>; more: YArray<string>;
  body: YXmlFragment<{ p: string }>;
  blob: YPlainArray<YLeaf<string>>;
  free: unknown;
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
      t1: { status: 'draft', reviewer: 'r0', tags: ['x', 'y'] },
      t2: { status: 'open', reviewer: 'r0', tags: [] },
      t3: { status: 'draft' }, // 缺可选键（AC1 显式 undefined 过滤 / AC5 全量重装可观察）
    },
    values: [1, 2, 3],
    more: ['m'],
    body: '<p>hi</p>',
    blob: ['b1', 'b2'],
    free: { arr: [10, 20, { k: 'v' }], obj: { nested: { deep: true }, nil: null } },
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

/** AC1–AC4/AC6 共同承载 op：guard 评估先于 schema 校验，承载写取合法 `set n=2`。 */
function guarded(guard: unknown): unknown {
  return { op: 'set', path: ['n'], value: 2, guard };
}

/** AC5 承载：`set([])` 唯一合法全量形态 + 顶层 guard（ADR 0007 L93–96 / ADR 0025 L48）。 */
function rootReplace(value: Record<string, unknown>, guard: unknown): unknown {
  return { op: 'set', path: [], value, guard };
}

/** AC6 宽向 fixture：64 键 Record（每项含嵌套 tags）。程序化构造，不用字面量。 */
function bigTasks(count: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < count; i++) out[`k${i}`] = { status: 'draft', tags: [`g${i}`, 'x'] };
  return out;
}

/** AC1/A14 深向 fixture：程序化 24 层嵌套 plain 对象。 */
function deepFree(levels: number): Record<string, unknown> {
  let node: unknown = 'leaf';
  for (let i = 0; i < levels; i++) node = { [`l${i}`]: node };
  return node as Record<string, unknown>;
}

function bytes(doc: Y.Doc): number[] {
  return [...Y.encodeStateAsUpdate(doc)];
}

function taskEntry(fx: Fx, key: string): Y.Map<unknown> {
  const tasks = fx.root.get('tasks') as Y.Map<unknown>;
  return tasks.get(key) as Y.Map<unknown>;
}

function valuesArray(fx: Fx): Y.Array<number> {
  return fx.root.get('values') as Y.Array<number>;
}

function guardIssues(result: ApplyValidatedMutationResult): MutationIssue[] {
  return result.ok ? [] : (result.issues as MutationIssue[]);
}

/** 本地事务 / update 观测器（零写入与满足态契约的两条可观察面）。 */
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

/** 满足判决共同断言（SA6 §12.0，设计 §7 D6）：ok:true + 恰 1 次本地事务 + 恰 1 次 update。
 *  落盘值断言逐用例内联（SA2 N3）。 */
function expectCommitted(
  result: ApplyValidatedMutationResult,
  watch: { txs: { count: number }; updates: Uint8Array[] },
  label: string,
): void {
  expect(result.ok, `${label}：guard 满足必须提交；实际 ${JSON.stringify(result)}`).toBe(true);
  expect(watch.txs.count, `${label}：满足态恰 1 次本地事务（单提交路径）`).toBe(1);
  expect(watch.updates, `${label}：满足态恰 1 次 update`).toHaveLength(1);
}

/** 评估不满足的共同断言：ok:false、恰 1 issue、稳定码（与公共导出口同源）、
 *  `issue.path` = guard 条件路径、零写入三件套。 */
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
  expect(issue.code, `${label}：运行时拒绝码必须与公共入口导出值同源（N-E）`).toBe(GUARD_MISMATCH_EXPORT);
  expect(issue.path, `${label}：issue.path 必须为 guard 条件路径的新鲜等价副本`).toEqual(guardPath);
  expectZeroWrite(fx, watch, before, label);
  return issue;
}

/** 形状错误的共同断言：ok:false、恰 1 issue、无码（不可重试）、零写入。 */
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
  expectZeroWrite(fx, watch, before, label);
  return issue;
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// A 组 — AC1 equals 深相等细节（16 用例；SA6 §12.2）
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('issue #348 A 组 — AC1 equals 深相等细节（16 用例）', () => {
  it('A1 doc n:0 / equals:-0 → -0 与 0 深相等：ok:true、n=2 落盘', () => {
    const fx = fixture(baseSnapshot({ n: 0 }));
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['n'], equals: -0 }));
    expectCommitted(result, watch, 'A1');
    expect(fx.root.get('n'), 'A1：承载写必须落盘').toBe(2);
  });

  it('A1b doc n:-0 / equals:0 → -0 保号读回且与 0 相等：ok:true、n=2 落盘', () => {
    // rebase 适配（ADR 0020 决策 3 / ADR 0021 number 值域收窄入 main 后）：-0 不在可写值域，
    // materializeRoot 校验拒绝含 -0 的 snapshot，baseSnapshot({ n: -0 }) 物化路径失效；
    // 读侧载体 schema-independent（ADR 0008），改经合法物化后直写载体放 -0（同 B 组
    // Y.Text/Y.XmlFragment 直写模式）。A1c 保号证据随之锚载体直写，M2 敏感性不变。
    const fx = fixture(baseSnapshot({ n: 0 }));
    fx.root.set('n', -0);
    expect(Object.is(fx.root.get('n'), -0), 'A1b：载体直写后 -0 未被归一（A1c 证据，SA6 §5）').toBe(true);
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['n'], equals: 0 }));
    expectCommitted(result, watch, 'A1b');
    expect(fx.root.get('n')).toBe(2);
  });

  it('A1d（A1 反极性负控）doc n:0 / equals:1 → 不满足判决 + 零写入', () => {
    const fx = fixture(baseSnapshot({ n: 0 }));
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, guarded({ path: ['n'], equals: 1 }));
    expectGuardMismatch(fx, result, before, watch, ['n'], 'A1d');
    expect(fx.root.get('n'), 'A1d：拒绝必须不落盘').toBe(0);
  });

  it('A2 path tasks.t1 / equals 嵌套对象+嵌套数组结构 → ok:true、n=2 落盘', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({
      path: ['tasks', 't1'],
      equals: { status: 'draft', reviewer: 'r0', tags: ['x', 'y'] },
    }));
    expectCommitted(result, watch, 'A2');
    expect(fx.root.get('n')).toBe(2);
    expect(taskEntry(fx, 't1').get('status'), 'A2：guard 路径与写入路径无关，t1 不被改动').toBe('draft');
  });

  it('A3 path tasks.t1.tags / equals 同序数组 → ok:true（数组逐位递归）', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['tasks', 't1', 'tags'], equals: ['x', 'y'] }));
    expectCommitted(result, watch, 'A3');
    expect(fx.root.get('n')).toBe(2);
  });

  it('A4（A3 反极性负控）同路径 / equals 异序数组 → 不满足判决（数组顺序敏感）', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, guarded({ path: ['tasks', 't1', 'tags'], equals: ['y', 'x'] }));
    expectGuardMismatch(fx, result, before, watch, ['tasks', 't1', 'tags'], 'A4');
  });

  it('A5 path tasks.t1 / equals 含 ghost:undefined → undefined 键过滤后相等：ok:true', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({
      path: ['tasks', 't1'],
      equals: { status: 'draft', reviewer: 'r0', tags: ['x', 'y'], ghost: undefined },
    }));
    expectCommitted(result, watch, 'A5');
    expect(fx.root.get('n')).toBe(2);
  });

  it('A6 path tasks.t3 / equals {status, reviewer:undefined} → 显式 undefined ≡ 缺键：ok:true', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['tasks', 't3'], equals: { status: 'draft', reviewer: undefined } }));
    expectCommitted(result, watch, 'A6');
    expect(fx.root.get('n')).toBe(2);
  });

  it('A7（A5 反极性负控）path tasks.t1 / equals 缺实际存在的 tags → 不满足判决（键完整，非子集）', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, guarded({
      path: ['tasks', 't1'],
      equals: { status: 'draft', reviewer: 'r0', ghost: undefined },
    }));
    expectGuardMismatch(fx, result, before, watch, ['tasks', 't1'], 'A7');
  });

  it('A8 doc values:[1,0,3] / equals [1,-0,3] → 嵌套 -0 与 0 相等：ok:true', () => {
    const fx = fixture(baseSnapshot({ values: [1, 0, 3] }));
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['values'], equals: [1, -0, 3] }));
    expectCommitted(result, watch, 'A8');
    expect(valuesArray(fx).toJSON(), 'A8：guard 只读，values 不被改动').toEqual([1, 0, 3]);
  });

  it('A9 path free / equals 嵌套 plain object+array+null 结构 → ok:true', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({
      path: ['free'],
      equals: { arr: [10, 20, { k: 'v' }], obj: { nested: { deep: true }, nil: null } },
    }));
    expectCommitted(result, watch, 'A9');
    expect(fx.root.get('n')).toBe(2);
  });

  it('A10 path free.obj.nested / equals {deep:true} → ok:true（深层 plain 对象）', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['free', 'obj', 'nested'], equals: { deep: true } }));
    expectCommitted(result, watch, 'A10');
    expect(fx.root.get('n')).toBe(2);
  });

  it('A11（A9 反极性负控）同 A9 但 nested.deep=false → 不满足判决', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, guarded({
      path: ['free'],
      equals: { arr: [10, 20, { k: 'v' }], obj: { nested: { deep: false }, nil: null } },
    }));
    expectGuardMismatch(fx, result, before, watch, ['free'], 'A11');
  });

  it('A12 doc free:{z:0} / equals {z:-0} → 嵌套 -0 与 0 相等：ok:true', () => {
    const fx = fixture(baseSnapshot({ free: { z: 0 } }));
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['free'], equals: { z: -0 } }));
    expectCommitted(result, watch, 'A12');
    expect(fx.root.get('n')).toBe(2);
  });

  it('A13 equals:undefined → 形状错误对照：无码 + 零写入（与 #347 S10 同源）', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    expectShapeError(fx, guarded({ path: ['n'], equals: undefined }), watch, 'A13');
  });

  it('A14 free 24 层嵌套对象 / equals 独立构造同结构 → ok:true（深度方向覆盖）', () => {
    const fx = fixture(baseSnapshot({ free: deepFree(24) }));
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['free'], equals: deepFree(24) }));
    expectCommitted(result, watch, 'A14');
    expect(fx.root.get('n')).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// B 组 — AC2 读失败路径与缺席吸收（31 用例；SA6 §12.3）
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('issue #348 B 组 — AC2 读失败路径与缺席吸收（31 用例）', () => {
  it('B1 标量穿越 ["a","deep"]（PATH_NOT_ALLOWED）→ equals 不满足：稳定码 + 零写入', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, guarded({ path: ['a', 'deep'], equals: 'guarded-scalar' }));
    expectGuardMismatch(fx, result, before, watch, ['a', 'deep'], 'B1');
  });

  it('B2（B1 反极性负控）同路径 absent → 读失败满足 absent：ok:true、n=2 落盘', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['a', 'deep'], absent: true }));
    expectCommitted(result, watch, 'B2');
    expect(fx.root.get('n')).toBe(2);
  });

  it('B3 中间容器缺失 ["tasks","t9","status"]（缺键吸收）→ equals 不满足', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, guarded({ path: ['tasks', 't9', 'status'], equals: 'draft' }));
    expectGuardMismatch(fx, result, before, watch, ['tasks', 't9', 'status'], 'B3');
  });

  it('B4（B3 反极性负控）同路径 absent → 缺键吸收满足：ok:true、n=2 落盘', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['tasks', 't9', 'status'], absent: true }));
    expectCommitted(result, watch, 'B4');
    expect(fx.root.get('n')).toBe(2);
  });

  it('B5 Y.Array 越界 ["values",99] → 越界吸收（ok undefined）→ equals 不满足', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, guarded({ path: ['values', 99], equals: 1 }));
    expectGuardMismatch(fx, result, before, watch, ['values', 99], 'B5');
  });

  it('B6（B5 反极性负控）同路径 absent → 越界吸收满足：ok:true、n=2 落盘', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['values', 99], absent: true }));
    expectCommitted(result, watch, 'B6');
    expect(fx.root.get('n')).toBe(2);
  });

  it('B7 负下标 ["values",-1] → 读失败（非形状错误）→ equals 不满足：稳定码', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, guarded({ path: ['values', -1], equals: 1 }));
    expectGuardMismatch(fx, result, before, watch, ['values', -1], 'B7');
  });

  it('B8（B7 反极性负控）同路径 absent → 读失败满足：ok:true、n=2 落盘', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['values', -1], absent: true }));
    expectCommitted(result, watch, 'B8');
    expect(fx.root.get('n')).toBe(2);
  });

  it('B9 非整数下标 ["values",1.5] → 读失败 → equals 不满足：稳定码', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, guarded({ path: ['values', 1.5], equals: 1 }));
    expectGuardMismatch(fx, result, before, watch, ['values', 1.5], 'B9');
  });

  it('B10（B9 反极性负控）同路径 absent → 读失败满足：ok:true、n=2 落盘', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['values', 1.5], absent: true }));
    expectCommitted(result, watch, 'B10');
    expect(fx.root.get('n')).toBe(2);
  });

  it('B11 plain array 越界 ["free","arr",99] → 越界吸收 absent 满足：ok:true、n=2 落盘', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['free', 'arr', 99], absent: true }));
    expectCommitted(result, watch, 'B11');
    expect(fx.root.get('n')).toBe(2);
  });

  it('B12（B11 反极性负控）同路径 equals:10 → 越界吸收不得满足 equals：不满足判决', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, guarded({ path: ['free', 'arr', 99], equals: 10 }));
    expectGuardMismatch(fx, result, before, watch, ['free', 'arr', 99], 'B12');
  });

  it('B13 string 段落 plain array ["blob","x"] → 读失败 absent 满足：ok:true、n=2 落盘', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['blob', 'x'], absent: true }));
    expectCommitted(result, watch, 'B13');
    expect(fx.root.get('n')).toBe(2);
  });

  it('B14 null 穿越 ["free","obj","nil","deep"] → 标量不可下钻（读失败）→ absent 满足', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['free', 'obj', 'nil', 'deep'], absent: true }));
    expectCommitted(result, watch, 'B14');
    expect(fx.root.get('n')).toBe(2);
  });

  it('B15（B14 反极性对照）同路径 equals:null → 读失败不得满足 equals：不满足判决', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, guarded({ path: ['free', 'obj', 'nil', 'deep'], equals: null }));
    expectGuardMismatch(fx, result, before, watch, ['free', 'obj', 'nil', 'deep'], 'B15');
  });

  it('B16 null 终点 ["free","obj","nil"] / equals:null → null 是合法值：ok:true', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['free', 'obj', 'nil'], equals: null }));
    expectCommitted(result, watch, 'B16');
    expect(fx.root.get('n')).toBe(2);
  });

  it('B17 plain 缺键立即结束 ["free","obj","missing","deep"] → absent 满足：ok:true', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['free', 'obj', 'missing', 'deep'], absent: true }));
    expectCommitted(result, watch, 'B17');
    expect(fx.root.get('n')).toBe(2);
  });

  it('B18（B17 反极性负控）同路径 equals:1 → 缺席不得满足 equals：不满足判决', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, guarded({ path: ['free', 'obj', 'missing', 'deep'], equals: 1 }));
    expectGuardMismatch(fx, result, before, watch, ['free', 'obj', 'missing', 'deep'], 'B18');
  });

  it('B19 布尔标量穿越 ["free","obj","nested","deep","x"] → 读失败 absent 满足：ok:true', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['free', 'obj', 'nested', 'deep', 'x'], absent: true }));
    expectCommitted(result, watch, 'B19');
    expect(fx.root.get('n')).toBe(2);
  });

  it('B20 越界先于后续段 ["values",99,"x"] → 立即 ok undefined → absent 满足：ok:true', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['values', 99, 'x'], absent: true }));
    expectCommitted(result, watch, 'B20');
    expect(fx.root.get('n')).toBe(2);
  });

  it('B21 段型不符先于后续段 ["values","0","x"] → 读失败 absent 满足：ok:true', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['values', '0', 'x'], absent: true }));
    expectCommitted(result, watch, 'B21');
    expect(fx.root.get('n')).toBe(2);
  });

  it('B22 Y.Text 终点（直造载体）["free"] → 读失败 absent 满足：ok:true、n=2 落盘', () => {
    const fx = fixture();
    fx.root.set('free', new Y.Text('t'));
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['free'], absent: true }));
    expectCommitted(result, watch, 'B22');
    expect(fx.root.get('n')).toBe(2);
  });

  it('B23（B22 反极性负控）Y.Text 终点 ["free"] / equals:"t" → 读失败不满足 equals：稳定码', () => {
    const fx = fixture();
    fx.root.set('free', new Y.Text('t'));
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, guarded({ path: ['free'], equals: 't' }));
    expectGuardMismatch(fx, result, before, watch, ['free'], 'B23');
  });

  it('B24 Y.Text 穿越 ["free","x"] → 不可下钻终态读失败 absent 满足：ok:true', () => {
    const fx = fixture();
    fx.root.set('free', new Y.Text('t'));
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['free', 'x'], absent: true }));
    expectCommitted(result, watch, 'B24');
    expect(fx.root.get('n')).toBe(2);
  });

  it('B25 空 XML 终点（投影 "" 属有值）["free"] absent → 不满足判决 + 零写入', () => {
    const fx = fixture();
    fx.root.set('free', new Y.XmlFragment());
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, guarded({ path: ['free'], absent: true }));
    expectGuardMismatch(fx, result, before, watch, ['free'], 'B25');
  });

  it('B25b（B25 反极性）空 XML 终点 ["free"] / equals:"" → 有值且相等：ok:true、n=2 落盘', () => {
    const fx = fixture();
    fx.root.set('free', new Y.XmlFragment());
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['free'], equals: '' }));
    expectCommitted(result, watch, 'B25b');
    expect(fx.root.get('n')).toBe(2);
  });

  it('B26 非 plain 原型对象（Date）穿越 ["free","x"] → 不可下钻 absent 满足：ok:true', () => {
    const fx = fixture();
    fx.root.set('free', new Date(0));
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['free', 'x'], absent: true }));
    expectCommitted(result, watch, 'B26');
    expect(fx.root.get('n')).toBe(2);
  });

  it('B27（B26 反极性负控）Date 终点 ["free"] / equals:0 → 投影失败不满足 equals：稳定码', () => {
    const fx = fixture();
    fx.root.set('free', new Date(0));
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, guarded({ path: ['free'], equals: 0 }));
    expectGuardMismatch(fx, result, before, watch, ['free'], 'B27');
  });

  it('B28 detached 载体（plain 容器内嵌）["free","frag"] absent → loud 拒绝读失败满足：ok:true', () => {
    const fx = fixture();
    fx.root.set('free', { frag: new Y.XmlFragment() }); // 未集成 doc（doc===null）
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['free', 'frag'], absent: true }));
    expectCommitted(result, watch, 'B28');
    expect(fx.root.get('n')).toBe(2);
  });

  it('B29（B28 反极性负控）同路径 equals:"x" → detached 不得静默投影：不满足判决', () => {
    const fx = fixture();
    fx.root.set('free', { frag: new Y.XmlFragment() });
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, guarded({ path: ['free', 'frag'], equals: 'x' }));
    expectGuardMismatch(fx, result, before, watch, ['free', 'frag'], 'B29');
  });

  it('B30 同路径 equals:"<p>hi</p>"（XML 语义字符串形态）→ 读失败路径上 equals 不满足', () => {
    const fx = fixture();
    fx.root.set('free', { frag: new Y.XmlFragment() });
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, guarded({ path: ['free', 'frag'], equals: '<p>hi</p>' }));
    expectGuardMismatch(fx, result, before, watch, ['free', 'frag'], 'B30');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// C 组 — AC3 XML 穿越 / 终点两形态（7 用例；SA6 §12.4）
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('issue #348 C 组 — AC3 XML 穿越 / 终点两形态（7 用例）', () => {
  it('C1 XML 终点 ["body"] / equals:"<p>hi</p>"（= toString()，X0 口径）→ ok:true', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['body'], equals: '<p>hi</p>' }));
    expectCommitted(result, watch, 'C1');
    expect(fx.root.get('n')).toBe(2);
  });

  it('C2（C1 反极性负控）同路径 equals:"<p>bye</p>" → 不满足判决 + message 含实际摘要', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, guarded({ path: ['body'], equals: '<p>bye</p>' }));
    const issue = expectGuardMismatch(fx, result, before, watch, ['body'], 'C2');
    expect(issue.message, 'C2：message 含实际投影摘要（次级辅助断言；主断言为判决契约）')
      .toContain('<p>hi</p>');
  });

  it('C3 XML 终点 ["body"] absent → 语义字符串是值：不满足判决 + 零写入', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, guarded({ path: ['body'], absent: true }));
    expectGuardMismatch(fx, result, before, watch, ['body'], 'C3');
  });

  it('C4 穿越 XML 不可下钻终态 ["body","p"] / equals:"hi" → 读失败不满足：稳定码', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, guarded({ path: ['body', 'p'], equals: 'hi' }));
    expectGuardMismatch(fx, result, before, watch, ['body', 'p'], 'C4');
  });

  it('C5（C4 反极性负控）同路径 absent → 穿越读失败满足：ok:true、n=2 落盘', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['body', 'p'], absent: true }));
    expectCommitted(result, watch, 'C5');
    expect(fx.root.get('n')).toBe(2);
  });

  it('C6 穿越 XML（number 段）["body",0] absent → 读失败满足：ok:true、n=2 落盘', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['body', 0], absent: true }));
    expectCommitted(result, watch, 'C6');
    expect(fx.root.get('n')).toBe(2);
  });

  it('C7（C6 反极性负控）同路径 equals:"hi" → 读失败不满足：稳定码 + 零写入', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, guarded({ path: ['body', 0], equals: 'hi' }));
    expectGuardMismatch(fx, result, before, watch, ['body', 0], 'C7');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// D 组 — AC4 数组下标段纪律（15 用例；SA6 §12.5）
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('issue #348 D 组 — AC4 数组下标段纪律（15 用例）', () => {
  it('D1 Y.Array 位置读 ["values",1] / equals:2 → ok:true、n=2 落盘', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['values', 1], equals: 2 }));
    expectCommitted(result, watch, 'D1');
    expect(fx.root.get('n')).toBe(2);
  });

  it('D2 嵌套 Y.Array 位置 ["tasks","t1","tags",1] / equals:"y" → ok:true', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['tasks', 't1', 'tags', 1], equals: 'y' }));
    expectCommitted(result, watch, 'D2');
    expect(fx.root.get('n')).toBe(2);
  });

  it('D3 下标 -0 归一 0 ["values",-0] / equals:1 → ok:true（读面 D3）', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['values', -0], equals: 1 }));
    expectCommitted(result, watch, 'D3');
    expect(fx.root.get('n')).toBe(2);
  });

  it('D4 string 段落 Y.Array ["values","0"] / equals:1 → 读失败不满足：稳定码', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, guarded({ path: ['values', '0'], equals: 1 }));
    expectGuardMismatch(fx, result, before, watch, ['values', '0'], 'D4');
  });

  it('D5（D4 反极性负控）同路径 absent → 段型不符读失败满足：ok:true、n=2 落盘', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['values', '0'], absent: true }));
    expectCommitted(result, watch, 'D5');
    expect(fx.root.get('n')).toBe(2);
  });

  it('D6 number 段落 Y.Map ["tasks",0] / equals:"x" → 读失败不满足：稳定码', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, guarded({ path: ['tasks', 0], equals: 'x' }));
    expectGuardMismatch(fx, result, before, watch, ['tasks', 0], 'D6');
  });

  it('D7（D6 反极性负控）同路径 absent → number 段落 Y.Map 读失败满足：ok:true', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['tasks', 0], absent: true }));
    expectCommitted(result, watch, 'D7');
    expect(fx.root.get('n')).toBe(2);
  });

  it('D8 越界 index == length ["values",3] absent → 越界吸收满足：ok:true、n=2 落盘', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['values', 3], absent: true }));
    expectCommitted(result, watch, 'D8');
    expect(fx.root.get('n')).toBe(2);
  });

  it('D9 plain array 位置 ["free","arr",1] / equals:20 → ok:true（plain 位置读）', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['free', 'arr', 1], equals: 20 }));
    expectCommitted(result, watch, 'D9');
    expect(fx.root.get('n')).toBe(2);
  });

  it('D10 下标段 + 键段混用 ["free","arr",2,"k"] / equals:"v" → ok:true', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['free', 'arr', 2, 'k'], equals: 'v' }));
    expectCommitted(result, watch, 'D10');
    expect(fx.root.get('n')).toBe(2);
  });

  it('D11 string 段落 plain array ["free","arr","2"] absent → 读失败满足：ok:true', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['free', 'arr', '2'], absent: true }));
    expectCommitted(result, watch, 'D11');
    expect(fx.root.get('n')).toBe(2);
  });

  it('D12 YPlainArray 位置 ["blob",0] / equals:"b1" → ok:true', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['blob', 0], equals: 'b1' }));
    expectCommitted(result, watch, 'D12');
    expect(fx.root.get('n')).toBe(2);
  });

  it('D13 plain array 下标 -0 归一 ["free","arr",-0] / equals:10 → ok:true', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['free', 'arr', -0], equals: 10 }));
    expectCommitted(result, watch, 'D13');
    expect(fx.root.get('n')).toBe(2);
  });

  it('D14 值域边界段 ["values",Number.MAX_SAFE_INTEGER+2] absent → 越界吸收满足、非形状错误', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['values', Number.MAX_SAFE_INTEGER + 2], absent: true }));
    expectCommitted(result, watch, 'D14');
    expect(fx.root.get('n')).toBe(2);
  });

  it('D15 非下标段 ["values",NaN] absent → 读失败满足、非 guard 形状错误：ok:true', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['values', NaN], absent: true }));
    expectCommitted(result, watch, 'D15');
    expect(fx.root.get('n')).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// E 组 — AC5 set([]) legacy 全量替换先过 guard（7 用例；SA6 §12.6）
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('issue #348 E 组 — AC5 set([]) legacy 全量替换先过 guard（7 用例）', () => {
  it('E1 set([]) + guard 不满足（n=4242）→ 零写入：0 事务 / 0 update / 字节不变', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, rootReplace(baseSnapshot({ n: 99 }), { path: ['n'], equals: 4242 }));
    expectGuardMismatch(fx, result, before, watch, ['n'], 'E1');
    expect(fx.root.get('n'), 'E1：legacy 管线不得因 guard 不满足而改道写入').toBe(4711);
  });

  it('E2 set([]) + guard 满足（n=4711）→ 走完整 legacy 管线：ROOT 全等新快照、1 事务 1 update', () => {
    const fx = fixture();
    const next = baseSnapshot({ n: 99 });
    const watch = watchWrites(fx.doc);
    const result = run(fx, rootReplace(next, { path: ['n'], equals: 4711 }));
    expectCommitted(result, watch, 'E2');
    expect(fx.root.toJSON(), 'E2：legacy 全量重装后 ROOT 全等新快照').toEqual(next);
  });

  it('E3 set([]) 满足 + 新快照省略可选 tasks.t1.reviewer → 提交后该键不存在（清空重装非合并）', () => {
    const fx = fixture();
    const next = baseSnapshot({
      n: 99,
      tasks: {
        t1: { status: 'draft', tags: ['x', 'y'] }, // 省略可选 reviewer
        t2: { status: 'open', reviewer: 'r0', tags: [] },
        t3: { status: 'draft' },
      },
    });
    const watch = watchWrites(fx.doc);
    const result = run(fx, rootReplace(next, { path: ['n'], equals: 4711 }));
    expectCommitted(result, watch, 'E3');
    expect(taskEntry(fx, 't1').has('reviewer'), 'E3：完整 ROOT 清空重装 → 旧 reviewer 必须消失').toBe(false);
    expect(taskEntry(fx, 't1').toJSON()).toEqual({ status: 'draft', tags: ['x', 'y'] });
  });

  it('E4 次序对照（N-D）：guard 满足 + 新值违反 schema → schema 管线可达、无码、message 含类型不匹配', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, rootReplace(baseSnapshot({ n: 'bad' }), { path: ['n'], equals: 4711 }));
    expect(result.ok, `E4：guard 满足后必须进入 schema 校验并拒绝；实际 ${JSON.stringify(result)}`).toBe(false);
    const issue = guardIssues(result)[0]!;
    expect(issue.code, 'E4：schema 域拒绝无稳定码（两态可判别）').toBeUndefined();
    expect(issue.message, 'E4：必须证明 legacy 分支的 schema 管线在 guard 之后可达').toContain('类型不匹配');
    expectZeroWrite(fx, watch, before, 'E4');
  });

  it('E5 set([]) + absent 对缺键（tasks.t9）满足 → 合法全量快照正常重装：ok:true、ROOT 全等', () => {
    const fx = fixture();
    const next = baseSnapshot({ n: 42 });
    const watch = watchWrites(fx.doc);
    const result = run(fx, rootReplace(next, { path: ['tasks', 't9'], absent: true }));
    expectCommitted(result, watch, 'E5');
    expect(fx.root.toJSON()).toEqual(next);
  });

  it('E6 set([]) + absent 对「键有值」（tasks.t1）→ 不满足判决 + 零写入', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, rootReplace(baseSnapshot({ n: 99 }), { path: ['tasks', 't1'], absent: true }));
    expectGuardMismatch(fx, result, before, watch, ['tasks', 't1'], 'E6');
  });

  it('E7 次序对照（N-D）：guard 不满足（n=4242）+ 同款非法新值 → 唯一 guard issue、message 不含类型不匹配', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, rootReplace(baseSnapshot({ n: 'bad' }), { path: ['n'], equals: 4242 }));
    const issue = expectGuardMismatch(fx, result, before, watch, ['n'], 'E7');
    expect(issue.message, 'E7：评估先于 schema 校验，legacy 分支同样成立').not.toContain('类型不匹配');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// F 组 — AC6 大子树结构比较（4 用例；SA6 §12.7）
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('issue #348 F 组 — AC6 大子树结构比较（4 用例）', () => {
  it('F1 64 键 tasks Record 整树 equals（手写期望结构）→ ok:true、n=2 落盘', () => {
    const fx = fixture(baseSnapshot({ tasks: bigTasks(64) }));
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({ path: ['tasks'], equals: bigTasks(64) }));
    expectCommitted(result, watch, 'F1');
    expect(fx.root.get('n')).toBe(2);
  });

  it('F2 values 256 元素整树 equals → ok:true、n=2 落盘', () => {
    const fx = fixture(baseSnapshot({ values: Array.from({ length: 256 }, (_, i) => i) }));
    const watch = watchWrites(fx.doc);
    const result = run(fx, guarded({
      path: ['values'],
      equals: Array.from({ length: 256 }, (_, i) => i),
    }));
    expectCommitted(result, watch, 'F2');
    expect(fx.root.get('n')).toBe(2);
  });

  it('F3（F2 反极性负控）同规模末元素差异 → 不满足判决 + message 有界（< 4096）', () => {
    const fx = fixture(baseSnapshot({ values: Array.from({ length: 256 }, (_, i) => i) }));
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const expected = Array.from({ length: 256 }, (_, i) => i);
    expected[255] = -1;
    const result = run(fx, guarded({ path: ['values'], equals: expected }));
    const issue = expectGuardMismatch(fx, result, before, watch, ['values'], 'F3');
    expect(issue.message.length, 'F3：摘要必须确定性截断（截断防爆）').toBeLessThan(4096);
  });

  it('F4（F1 反极性负控）64 键 Record 单键差异 → 不满足判决 + message 有界（< 4096）', () => {
    const fx = fixture(baseSnapshot({ tasks: bigTasks(64) }));
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const expected = bigTasks(64);
    (expected['k63'] as Record<string, unknown>)['status'] = 'open';
    const result = run(fx, guarded({ path: ['tasks'], equals: expected }));
    const issue = expectGuardMismatch(fx, result, before, watch, ['tasks'], 'F4');
    expect(issue.message.length, 'F4：摘要必须确定性截断（截断防爆）').toBeLessThan(4096);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// G 组 — AC7 批量 { ops, guard } 顶层同语义（12 用例；SA6 §12.8）
// ═══════════════════════════════════════════════════════════════════════════════════════

/** 批量固定 ops：set tasks.t1.status='reviewing' + array-insert values@1 [9]（互不嵌套）。 */
function batchOps(): unknown[] {
  return [
    { op: 'set', path: ['tasks', 't1', 'status'], value: 'reviewing' },
    { op: 'array-insert', path: ['values'], index: 1, values: [9] },
  ];
}

/** 批量满足态落盘断言：两 op 全部生效。 */
function expectBatchLanded(fx: Fx, label: string): void {
  expect(taskEntry(fx, 't1').get('status'), `${label}：op1 必须落盘`).toBe('reviewing');
  expect(valuesArray(fx).toJSON(), `${label}：op2 必须落盘`).toEqual([1, 9, 2, 3]);
}

describe('issue #348 G 组 — AC7 批量 { ops, guard } 顶层同语义（12 用例）', () => {
  it('G1 批量顶层 guard equals 嵌套结构（配对 A2）满足 → 两 op 全落盘、恰 1 事务 1 update', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, {
      ops: batchOps(),
      guard: { path: ['tasks', 't1'], equals: { status: 'draft', reviewer: 'r0', tags: ['x', 'y'] } },
    });
    expectCommitted(result, watch, 'G1');
    expectBatchLanded(fx, 'G1');
  });

  it('G2 批量顶层 guard absent 对缺键（配对 B4）满足 → 两 op 全落盘', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, { ops: batchOps(), guard: { path: ['tasks', 't9'], absent: true } });
    expectCommitted(result, watch, 'G2');
    expectBatchLanded(fx, 'G2');
  });

  it('G3（B 组极性反例）批量顶层 guard absent 对「键有值」→ 恰 1 issue（无聚合）+ 零写入', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, { ops: batchOps(), guard: { path: ['tasks', 't1'], absent: true } });
    expectGuardMismatch(fx, result, before, watch, ['tasks', 't1'], 'G3');
  });

  it('G4 批量顶层 guard 穿越 XML（配对 C4）equals 不满足 → 零写入', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, { ops: batchOps(), guard: { path: ['body', 'p'], equals: 'hi' } });
    expectGuardMismatch(fx, result, before, watch, ['body', 'p'], 'G4');
  });

  it('G5 批量顶层 guard XML 终点（配对 C1）equals 满足 → 两 op 全落盘', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, { ops: batchOps(), guard: { path: ['body'], equals: '<p>hi</p>' } });
    expectCommitted(result, watch, 'G5');
    expectBatchLanded(fx, 'G5');
  });

  it('G6 批量顶层 guard doc n:0 / equals:-0（配对 A1）满足 → 两 op 全落盘', () => {
    const fx = fixture(baseSnapshot({ n: 0 }));
    const watch = watchWrites(fx.doc);
    const result = run(fx, { ops: batchOps(), guard: { path: ['n'], equals: -0 } });
    expectCommitted(result, watch, 'G6');
    expectBatchLanded(fx, 'G6');
  });

  it('G7 批量顶层 guard 数组下标段（配对 D1）equals 满足 → 两 op 全落盘', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, { ops: batchOps(), guard: { path: ['values', 1], equals: 2 } });
    expectCommitted(result, watch, 'G7');
    expectBatchLanded(fx, 'G7');
  });

  it('G8 批量顶层 guard 缺键 ≡ 显式 undefined（配对 A6）满足 → 两 op 全落盘', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, {
      ops: batchOps(),
      guard: { path: ['tasks', 't3'], equals: { status: 'draft', reviewer: undefined } },
    });
    expectCommitted(result, watch, 'G8');
    expectBatchLanded(fx, 'G8');
  });

  it('G9 批量顶层 guard 越界吸收（配对 B6）absent 满足 → 两 op 全落盘', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, { ops: batchOps(), guard: { path: ['values', 99], absent: true } });
    expectCommitted(result, watch, 'G9');
    expectBatchLanded(fx, 'G9');
  });

  it('G10 批量顶层 guard 不满足（配对 E7/O1）+ 元素值非法 → 唯一 guard issue、message 不含类型不匹配', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const before = bytes(fx.doc);
    const result = run(fx, {
      ops: [{ op: 'set', path: ['n'], value: 'bad' }],
      guard: { path: ['n'], equals: 4242 },
    });
    const issue = expectGuardMismatch(fx, result, before, watch, ['n'], 'G10');
    expect(issue.message, 'G10：guard 先于逐操作 prepare，不得出现 schema 校验消息').not.toContain('类型不匹配');
  });

  it('G11 批量顶层 guard 段型不符读失败（配对 D5）absent 满足 → 两 op 全落盘', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, { ops: batchOps(), guard: { path: ['values', '0'], absent: true } });
    expectCommitted(result, watch, 'G11');
    expectBatchLanded(fx, 'G11');
  });

  it('G12 批量顶层 guard 下标段 + 键段（配对 A10/D10）equals 满足 → 两 op 全落盘', () => {
    const fx = fixture();
    const watch = watchWrites(fx.doc);
    const result = run(fx, { ops: batchOps(), guard: { path: ['free', 'arr', 2], equals: { k: 'v' } } });
    expectCommitted(result, watch, 'G12');
    expectBatchLanded(fx, 'G12');
  });
});
