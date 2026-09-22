/**
 * SA6 验收契约（红灯）— issue #435：`@nomicore/vfsl` 数组逐元素校验 seam
 * （ADR 0033 决策 1/2/4/5；Parent PR #434 = spec/433 集成基线）。
 *
 * 契约来源：
 * - 任务简报 `wiki/raw/task_issue-435.md`（What to build + AC1–AC6）；
 * - `docs/adr/0033-elementwise-yarray-mutation-validation.md` 决策 1（fast path 闸门 =
 *   `plan.kind='array'` ∧ 边界值节点 kind='array'；union 数组目标永久 legacy）、决策 2
 *   （insert 逐新值过 element 子 schema、issue 路径 `[...arrayPath, index+j]`、域规则逐字
 *   一致：不 clamp / 拒越界 no-op / 批量一次判定；delete 仅域规则 O(1)）、决策 4（数组写
 *   触达面 = 载体 + 变更区间：污染数组 delete 由响亮拒绝变为照常成功）、决策 5（一致性
 *   fixture：逐元素判定 vs 全量整体验证逐字节一致）；
 * - SA6 契约报告 `wiki/raw/task_issue-435_sa6_contract.md` §12（绑定表 B-1…、用例组 A–F、
 *   敏感度防线 S-1/S-2）；探针 `wiki/raw/task_issue-435_sa6_capability_probe.mts`（GAP/ORACLE/NC）。
 *
 * 红灯机理（HEAD `f6b27da`，探针 G1/G2 实证）：包公共入口 22 个运行时导出中无任何
 * 逐元素数组接缝（`/elementwise/i` 零命中）；现行 `applyMutationAtBoundary` 对数组写必须
 * 消费「整数组边界提取值」（以载体事实 `{length}` 代替 → `ok:false` +「目标必须是数组」）
 * ⟹ 本文件 A–F 组每条断言都在 `seam()` 处因能力缺口失败（非环境/夹具/入口伪红）。
 *
 * 断言纪律：
 * - 只经包公共入口（`../src/index.js`）观察运行时行为；不 grep 生产源码、不 import 内部件；
 * - 本文件**顶层不静态 import 新名目**（新导出不存在时的 TS2305 不污染运行时红灯归因）；
 *   接缝经 `import * as vfsl` + 动态属性读取，改名只动下面 SEAM_EXPORT 一处；
 * - 全量 oracle = 既有公共导出 `applyMutationAtBoundary`（整数组重建 + validateSubtree 整体
 *   判定）；期望值或取自 oracle 逐字节比较，或取自 ADR 冻结文案的常量（域规则 message）；
 * - 零 skip/only/todo、零 env override、零 fallback、零吞错、零软化断言。
 */
import { describe, expect, it } from 'vitest';
import * as vfsl from '../src/index.js';
import type { DerivedSchema, MutationBoundaryPlan, ValidateResult } from '../src/index.js';
import {
  ARRAY_PATH_SPECS,
  UNION_ARRAY_PATH,
  buildEquivalenceCases,
  buildPollutedDeleteCases,
  elementwiseDerived,
  ivIllegal,
  ivLegal,
  legacyVerdict,
  planFor,
  targetVerdict,
  verdictBytes,
  verdictsEqual,
} from './issue-435-elementwise-array-fixture.js';
import type { ArrayMutationPayload, Verdict } from './issue-435-elementwise-array-fixture.js';

// ── §12.1 绑定点 B-1（冻结后改名只动这一处）──────────────────────────────────

const SEAM_EXPORT = 'applyElementwiseArrayMutation';

interface CarrierFacts {
  readonly length: number;
}

type SeamFn = (
  derived: DerivedSchema,
  plan: MutationBoundaryPlan,
  facts: CarrierFacts,
  payload: ArrayMutationPayload,
) => ValidateResult;

const CAPABILITY_GAP =
  `能力缺口：@nomicore/vfsl 公共入口未导出 ${SEAM_EXPORT}（ADR 0033 决策 2 数组逐元素校验接缝）`;

function seam(): SeamFn {
  const candidate = (vfsl as unknown as Record<string, unknown>)[SEAM_EXPORT];
  if (typeof candidate !== 'function') {
    throw new Error(`${CAPABILITY_GAP}——实际 typeof=${typeof candidate}`);
  }
  return candidate as SeamFn;
}

/** 目标接缝判决（经夹具规整，与全量 oracle 的 Verdict 同形可比）。 */
function verdictOf(derived: DerivedSchema, plan: MutationBoundaryPlan, base: readonly unknown[], payload: ArrayMutationPayload): Verdict {
  return targetVerdict(seam(), derived, plan, base, payload);
}

function callOf(derived: DerivedSchema, plan: MutationBoundaryPlan, base: readonly unknown[], payload: ArrayMutationPayload): ValidateResult {
  return seam()(derived, plan, { length: base.length }, payload);
}

const derived = elementwiseDerived();
const equivalenceCases = buildEquivalenceCases();
const pollutedCases = buildPollutedDeleteCases();

// ── A. 公共接缝（能力缺口 + 调用形状）────────────────────────────────────────

describe('#435 A 公共接缝（经包公共入口）', () => {
  it('A1 新导出在场且是函数（公共面唯一入口 = src/index.ts）', () => {
    const surface = vfsl as unknown as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(surface, SEAM_EXPORT), `${CAPABILITY_GAP}——公共入口无此自有导出键`).toBe(true);
    expect(typeof surface[SEAM_EXPORT], CAPABILITY_GAP).toBe('function');
  });

  it('A2 合法 insert 返回 ValidateResult 的 ok 支（`{ok:true}`，纯函数、无副作用）', () => {
    const fn = seam();
    const plan = planFor(derived, ['items'], 'array-insert');
    const planBefore = JSON.stringify(plan);
    const result = fn(derived, plan, { length: 1 }, { op: 'array-insert', index: 1, values: [{ name: 'a', qty: 1 }] });
    expect(result).toEqual({ ok: true });
    expect(JSON.stringify(plan)).toBe(planBefore);
  });
});

// ── B. array-insert 逐元素校验 ──────────────────────────────────────────────

describe('#435 B array-insert 逐新值过 element 子 schema', () => {
  it('B1 每条 fast-path 数组路径：合法新值插入（头部/尾部）通过', () => {
    for (const spec of ARRAY_PATH_SPECS) {
      const plan = planFor(derived, spec.path, 'array-insert');
      const base = [ivLegal(spec.elementKind), ivLegal(spec.elementKind)];
      expect(
        callOf(derived, plan, base, { op: 'array-insert', index: 0, values: [ivLegal(spec.elementKind)] }),
        `path=${JSON.stringify(spec.path)} 头部插入`,
      ).toEqual({ ok: true });
      expect(
        callOf(derived, plan, base, { op: 'array-insert', index: 2, values: [ivLegal(spec.elementKind)] }),
        `path=${JSON.stringify(spec.path)} append 位插入`,
      ).toEqual({ ok: true });
    }
  });

  it('B2 非法新元素在任一位置被拒绝，issue 路径 = [...arrayPath, index+j, ...elementPath]（items 规范锚）', () => {
    const plan = planFor(derived, ['items'], 'array-insert');
    const base = [{ name: 'a', qty: 1 }, { name: 'b', qty: 2 }];
    // index=1 处插入，j=1 → 插入后数组位置 2
    const result = callOf(derived, plan, base, { op: 'array-insert', index: 1, values: [{ name: 'ok', qty: 3 }, { name: 'bad', qty: 'x' }] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.path).toEqual(['items', 2, 'qty']);
  });

  it('B3 批量两处非法 → 两 issue，序 = 插入后位置升序（批量一次判定、中间态不参与）', () => {
    const plan = planFor(derived, ['items'], 'array-insert');
    const base = [{ name: 'a', qty: 1 }, { name: 'b', qty: 2 }];
    const result = callOf(derived, plan, base, {
      op: 'array-insert',
      index: 1,
      values: [{ name: 'x', qty: 101 }, { name: 'ok', qty: 1 }, { name: 'y' }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((i) => i.path)).toEqual([['items', 1, 'qty'], ['items', 3, 'qty']]);
  });

  it('B4 整批拒绝语义：任一非法新值 ⇒ 整批 ok:false（无部分接受分支）', () => {
    const plan = planFor(derived, ['items'], 'array-insert');
    const base = [{ name: 'a', qty: 1 }];
    const result = callOf(derived, plan, base, { op: 'array-insert', index: 1, values: [{ name: 'ok', qty: 1 }, null] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // 合法新值不得被单独报告为 issue（issue 只指向非法新元素）
    for (const issue of result.issues) expect(issue.path[1]).toBe(2);
  });

  it('B5 嵌套数组路径 rebase：issue 路径使用数组绝对路径（nested.inner）', () => {
    const plan = planFor(derived, ['nested', 'inner'], 'array-insert');
    const base = [{ name: 'a', qty: 1 }];
    const result = callOf(derived, plan, base, { op: 'array-insert', index: 1, values: [{ name: 'b', qty: -1 }] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]!.path).toEqual(['nested', 'inner', 1, 'qty']);
  });

  it('B6 空批量（values: []）在合法 index 上 = 恒等 → ok:true', () => {
    for (const spec of ARRAY_PATH_SPECS) {
      const plan = planFor(derived, spec.path, 'array-insert');
      expect(callOf(derived, plan, [], { op: 'array-insert', index: 0, values: [] }), `path=${JSON.stringify(spec.path)}`).toEqual({ ok: true });
    }
  });

  it('B7 全容器形联合元素（variants: YArray<Item | Alt>）与全标量形联合元素（scalars）逐元素判定与整体一致', () => {
    const variants = planFor(derived, ['variants'], 'array-insert');
    expect(callOf(derived, variants, [{ label: 'l', n: 0 }], { op: 'array-insert', index: 1, values: [{ name: 'a', qty: 1 }] })).toEqual({ ok: true });
    const badVariant = callOf(derived, variants, [{ label: 'l', n: 0 }], { op: 'array-insert', index: 1, values: [{ label: 'l', n: 11 }] });
    expect(badVariant.ok).toBe(false);
    if (!badVariant.ok) expect(badVariant.issues[0]!.path).toEqual(['variants', 1, 'n']);

    const scalars = planFor(derived, ['scalars'], 'array-insert');
    expect(callOf(derived, scalars, [1], { op: 'array-insert', index: 1, values: ['s', 2] })).toEqual({ ok: true });
    const badScalar = callOf(derived, scalars, [1], { op: 'array-insert', index: 1, values: [null] });
    expect(badScalar.ok).toBe(false);
    if (!badScalar.ok) expect(badScalar.issues[0]!.path).toEqual(['scalars', 1]);
  });
});

// ── C. array-insert 域规则（逐字对齐）───────────────────────────────────────

describe('#435 C array-insert 域规则（不 clamp；域规则逐字一致）', () => {
  it('C1 index === length（append 位）接受；index = length + 1 拒绝且 message/path 与现行逐字一致', () => {
    for (const spec of ARRAY_PATH_SPECS) {
      const plan = planFor(derived, spec.path, 'array-insert');
      const base = [ivLegal(spec.elementKind)];
      expect(callOf(derived, plan, base, { op: 'array-insert', index: 1, values: [ivLegal(spec.elementKind)] }), 'append 位').toEqual({ ok: true });
      const overflow = callOf(derived, plan, base, { op: 'array-insert', index: 2, values: [ivLegal(spec.elementKind)] });
      expect(overflow.ok).toBe(false);
      if (overflow.ok) continue;
      expect(overflow.issues).toHaveLength(1);
      expect(overflow.issues[0]!.message).toBe('array-insert index 越界（不 clamp）');
      expect(overflow.issues[0]!.path).toEqual([...spec.path, 2]);
    }
  });

  it('C2 不 clamp：index 远超 length 时拒绝而非截断插入', () => {
    const plan = planFor(derived, ['nums'], 'array-insert');
    const result = callOf(derived, plan, [1, 2], { op: 'array-insert', index: 9, values: [3] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]!.path).toEqual(['nums', 9]);
  });
});

// ── D. array-delete 仅域规则（不触碰元素值）─────────────────────────────────

describe('#435 D array-delete 仅域规则判定（O(1)，不触碰元素值）', () => {
  it('D1 合法删除（单元素 / 整段 / 整数组）通过', () => {
    for (const spec of ARRAY_PATH_SPECS) {
      const plan = planFor(derived, spec.path, 'array-delete');
      const base = [ivLegal(spec.elementKind), ivLegal(spec.elementKind)];
      expect(callOf(derived, plan, base, { op: 'array-delete', index: 0, count: 1 }), '单元素').toEqual({ ok: true });
      expect(callOf(derived, plan, base, { op: 'array-delete', index: 0, count: 2 }), '整数组').toEqual({ ok: true });
    }
  });

  it('D2 index >= length（越界 no-op）拒绝且 message/path 与现行逐字一致', () => {
    for (const spec of ARRAY_PATH_SPECS) {
      const plan = planFor(derived, spec.path, 'array-delete');
      const base = [ivLegal(spec.elementKind)];
      const result = callOf(derived, plan, base, { op: 'array-delete', index: 1, count: 1 });
      expect(result.ok, `path=${JSON.stringify(spec.path)}`).toBe(false);
      if (result.ok) continue;
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]!.message).toBe('array-delete 范围越界（不 clamp、不接受越界 no-op）');
      expect(result.issues[0]!.path).toEqual([...spec.path, 1]);
    }
  });

  it('D3 index + count > length（范围越界）拒绝且不 clamp（path 指向 index）', () => {
    const plan = planFor(derived, ['items'], 'array-delete');
    const base = [{ name: 'a', qty: 1 }, { name: 'b', qty: 2 }];
    const result = callOf(derived, plan, base, { op: 'array-delete', index: 1, count: 2 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]!.message).toBe('array-delete 范围越界（不 clamp、不接受越界 no-op）');
    expect(result.issues[0]!.path).toEqual(['items', 1]);
  });

  it('D4 ADR 0033 决策 4：污染数组（变更区间外非法元素）delete 照常成功——触达面收窄', () => {
    expect(pollutedCases.length).toBeGreaterThan(0);
    for (const c of pollutedCases) {
      const plan = planFor(derived, c.path, c.payload.op);
      const oracle = legacyVerdict(derived, plan, c.base, c.payload);
      const target = verdictOf(derived, plan, c.base, c.payload);
      expect(oracle.ok, `${c.id} 前置：全量 oracle 对污染数组响亮拒绝`).toBe(false);
      expect(target.ok, `${c.id} 目标行为：delete 只查域规则 → 照常成功`).toBe(true);
    }
  });

  it('D5 delete 判定不消费元素值：同 length 的污染基线与合法基线判决完全相同', () => {
    for (const spec of ARRAY_PATH_SPECS) {
      const plan = planFor(derived, spec.path, 'array-delete');
      const legalBase = [ivLegal(spec.elementKind), ivLegal(spec.elementKind), ivLegal(spec.elementKind)];
      const pollutedBase = [ivIllegal(spec.elementKind), ivIllegal(spec.elementKind), ivIllegal(spec.elementKind)];
      const payload: ArrayMutationPayload = { op: 'array-delete', index: 0, count: 1 };
      const a = callOf(derived, plan, legalBase, payload);
      const b = callOf(derived, plan, pollutedBase, payload);
      expect(verdictBytes(targetVerdict(seam(), derived, plan, legalBase, payload)), `path=${JSON.stringify(spec.path)}`).toBe(
        verdictBytes(targetVerdict(seam(), derived, plan, pollutedBase, payload)),
      );
      expect(a).toEqual({ ok: true });
      expect(b).toEqual({ ok: true });
    }
  });
});

// ── E. 一致性 fixture（逐元素 vs 全量整体验证逐字节一致）─────────────────────

describe('#435 E 一致性 fixture（ADR 0033 决策 5）', () => {
  it('E1 全用例：逐元素判定与全量整体验证的接受/拒绝及 issue 内容逐字节一致', () => {
    expect(equivalenceCases.length).toBeGreaterThanOrEqual(100);
    let checked = 0;
    for (const c of equivalenceCases) {
      const plan = planFor(derived, c.path, c.payload.op);
      const oracle = legacyVerdict(derived, plan, c.base, c.payload);
      const target = verdictOf(derived, plan, c.base, c.payload);
      expect(verdictBytes(target), `${c.id}（${c.note}）逐元素=${verdictBytes(target)} 全量=${verdictBytes(oracle)}`).toBe(verdictBytes(oracle));
      checked += 1;
    }
    expect(checked).toBe(equivalenceCases.length);
  });

  it('E2 比较判据敏感：污染 delete 上目标判决与全量 oracle 逐字节可分（E1 非恒真）', () => {
    let detected = 0;
    for (const c of pollutedCases) {
      const plan = planFor(derived, c.path, c.payload.op);
      const oracle = legacyVerdict(derived, plan, c.base, c.payload);
      const target = verdictOf(derived, plan, c.base, c.payload);
      if (!verdictsEqual(target, oracle)) detected += 1;
    }
    expect(detected).toBe(pollutedCases.length);
  });
});

// ── F. fast path 闸门（ADR 0033 决策 1；非闸门计划 fail closed）──────────────

describe('#435 F fast path 闸门 fail closed', () => {
  it('F1 闸门前提：6 条数组路径的 plan.kind=array 且边界值节点 kind=array（node.element 在场）', () => {
    const fn = seam();
    for (const spec of ARRAY_PATH_SPECS) {
      const plan = planFor(derived, spec.path, 'array-insert');
      expect(plan.kind).toBe('array');
      expect(plan.node.kind).toBe('array');
      if (plan.node.kind !== 'array') continue;
      expect(plan.node.element).toBeDefined();
      expect(fn(derived, plan, { length: 0 }, { op: 'array-insert', index: 0, values: [] }), `path=${JSON.stringify(spec.path)}`).toEqual({ ok: true });
    }
  });

  it('F2 union 数组目标（uarr: YArray<Item> | YArray<string>）永久 legacy：节点 kind=union ⇒ 新接缝不静默接受', () => {
    const plan = planFor(derived, UNION_ARRAY_PATH, 'array-insert');
    expect(plan.kind).toBe('array');
    expect(plan.node.kind).toBe('union'); // 闸门第二条件排除（探针 G5.2 实证）
    const result = callOf(derived, plan, [{ name: 'a', qty: 1 }], { op: 'array-insert', index: 1, values: [{ name: 'b', qty: 2 }] });
    expect(result.ok).toBe(false);
    // legacy 轨照常工作（不作为快路径断言，只锚「有可用轨道」）
    const oracle = legacyVerdict(derived, plan, [{ name: 'a', qty: 1 }], { op: 'array-insert', index: 1, values: [{ name: 'b', qty: 2 }] });
    expect(oracle.ok).toBe(true);
  });

  it('F3 非 array 计划（kind=target，数组值整体替换位）⇒ fail closed（不静默 ok）', () => {
    const targetPlan = vfsl.planMutationBoundary(derived, ['items'], 'set');
    expect(targetPlan.ok).toBe(true);
    if (!targetPlan.ok) return;
    expect(targetPlan.plan.kind).toBe('target');
    expect(targetPlan.plan.node.kind).toBe('array');
    const result = callOf(derived, targetPlan.plan, [], { op: 'array-insert', index: 0, values: [] });
    expect(result.ok).toBe(false);
  });
});
