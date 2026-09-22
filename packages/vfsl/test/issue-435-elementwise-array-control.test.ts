/**
 * issue #435 负控 / 既有行为回归锚（控制组恒绿；与红契约
 * `issue-435-elementwise-array-contract.test.ts` 同批）。
 *
 * 本文件**不引用任何新名目**——它锚定红契约的全部前提，把「红」钉死在能力缺口
 * （公共面无数组逐元素校验接缝），排除环境/夹具/oracle/入口四类伪红，并在实现落地后
 * 继续充当兼容面回归网（ADR 0033 决策 2「域规则逐字一致」、决策 4 触达面收窄前的现状、
 * 决策 5 立法前提）：
 *
 * - NC1 legacy `applyMutationAtBoundary` 数组路径语义冻结（insert/delete 域规则 message+path、
 *   批量 issue 序、非法新元素 rebase 路径）；
 * - NC2 现状触达面：污染数组 delete 响亮拒绝（实现改道 fast path 后，本锚仍约束 legacy 轨，
 *   并作为 ADR 0033 决策 4 行为变更的对照基线）；
 * - NC3 规划闸门冻结：非 union 数组目标 kind=array ∧ node.kind=array；union 数组目标
 *   node.kind=union（永久 legacy 轨）；YPlainArray 目标 array-* 拒绝；
 * - NC4 立法前提：VFSL v1 数组层无长度/唯一性/有序性约束（长数组/重复/无序照常接受），
 *   且元素级非法仍逐位响亮拒绝（锚非空转）；
 * - NC5 夹具 oracle 自洽：等价集用例的 legacy 判决与登记期望一致；污染组 legacy 拒绝；
 *   用例面 census（规模/两支/两操作/全路径）——保证红契约 E 组比较面非空转；
 * - NC6 既有公共导出超集锚（本票触及的 7 个运行时导出不得改名/删除）。
 *
 * 断言只经包公共入口运行时可观察输出；不 grep 生产源码；无 skip/only/todo/env override/
 * fallback/软化断言。HEAD 与实现后均须绿。
 */
import { describe, expect, it } from 'vitest';
import * as vfsl from '../src/index.js';
import type { ValidateResult } from '../src/index.js';
import {
  ARRAY_PATH_SPECS,
  UNION_ARRAY_PATH,
  buildEquivalenceCases,
  buildPollutedDeleteCases,
  elementwiseDerived,
  legacyVerdict,
  planFor,
} from './issue-435-elementwise-array-fixture.js';

const derived = elementwiseDerived();

function legacy(plan: Parameters<typeof legacyVerdict>[1], base: readonly unknown[], payload: Parameters<typeof legacyVerdict>[3]): ReturnType<typeof legacyVerdict> {
  return legacyVerdict(derived, plan, base, payload);
}

const itemsPlanInsert = planFor(derived, ['items'], 'array-insert');
const itemsPlanDelete = planFor(derived, ['items'], 'array-delete');
const itemBase = [{ name: 'a', qty: 1 }, { name: 'b', qty: 2 }];

describe('#435 NC1 legacy 数组写语义冻结（域规则 + rebase 路径 + 批量序）', () => {
  it('NC1.1 insert：非法新元素路径 = [...arrayPath, index+j, ...elementPath]；合法 insert 接受', () => {
    const ok = legacy(itemsPlanInsert, itemBase, { op: 'array-insert', index: 1, values: [{ name: 'z', qty: 3 }] });
    expect(ok).toEqual({ ok: true, issues: [] });
    const bad = legacy(itemsPlanInsert, itemBase, { op: 'array-insert', index: 1, values: [{ name: 'ok', qty: 3 }, { name: 'bad', qty: 'x' }] });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.issues).toHaveLength(1);
    expect(bad.issues[0]!.path).toEqual(['items', 2, 'qty']);
  });

  it('NC1.2 insert 域规则：index === length 接受；index > length 拒绝（不 clamp，message/path 冻结）', () => {
    expect(legacy(itemsPlanInsert, itemBase, { op: 'array-insert', index: 2, values: [{ name: 'z', qty: 3 }] })).toEqual({ ok: true, issues: [] });
    const overflow = legacy(itemsPlanInsert, itemBase, { op: 'array-insert', index: 3, values: [{ name: 'z', qty: 3 }] });
    expect(overflow.ok).toBe(false);
    if (overflow.ok) return;
    expect(overflow.issues).toHaveLength(1);
    expect(overflow.issues[0]!.message).toBe('array-insert index 越界（不 clamp）');
    expect(overflow.issues[0]!.path).toEqual(['items', 3]);
  });

  it('NC1.3 批量一次判定：两处非法 → 两 issue，序 = 插入后位置升序（中间态不参与）', () => {
    const batch = legacy(itemsPlanInsert, itemBase, {
      op: 'array-insert',
      index: 1,
      values: [{ name: 'x', qty: 101 }, { name: 'ok', qty: 1 }, { name: 'y' }],
    });
    expect(batch.ok).toBe(false);
    if (batch.ok) return;
    expect(batch.issues.map((i) => i.path)).toEqual([['items', 1, 'qty'], ['items', 3, 'qty']]);
  });

  it('NC1.4 delete 域规则：合法段接受；index >= length 与 index + count > length 拒绝（message/path 冻结）', () => {
    expect(legacy(itemsPlanDelete, itemBase, { op: 'array-delete', index: 0, count: 1 })).toEqual({ ok: true, issues: [] });
    expect(legacy(itemsPlanDelete, itemBase, { op: 'array-delete', index: 0, count: 2 })).toEqual({ ok: true, issues: [] });
    const atLen = legacy(itemsPlanDelete, itemBase, { op: 'array-delete', index: 2, count: 1 });
    expect(atLen.ok).toBe(false);
    if (!atLen.ok) {
      expect(atLen.issues[0]!.message).toBe('array-delete 范围越界（不 clamp、不接受越界 no-op）');
      expect(atLen.issues[0]!.path).toEqual(['items', 2]);
    }
    const over = legacy(itemsPlanDelete, itemBase, { op: 'array-delete', index: 1, count: 2 });
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.issues[0]!.message).toBe('array-delete 范围越界（不 clamp、不接受越界 no-op）');
      expect(over.issues[0]!.path).toEqual(['items', 1]);
    }
  });

  it('NC1.5 现状快照（不进目标契约）：界内 count=0 被 legacy 接受（doc-runtime E3 不接受该形态）', () => {
    expect(legacy(itemsPlanDelete, itemBase, { op: 'array-delete', index: 0, count: 0 })).toEqual({ ok: true, issues: [] });
  });
});

describe('#435 NC2 现状触达面：污染数组 delete 响亮拒绝（ADR 0033 决策 4 对照基线）', () => {
  it('NC2.1 变更区间外非法元素仍被 legacy 检出（整数组触达）', () => {
    const polluted = legacy(itemsPlanDelete, [{ name: 'a', qty: 1 }, { name: 'x', qty: 999 }, { name: 'b', qty: 2 }], { op: 'array-delete', index: 0, count: 1 });
    expect(polluted.ok).toBe(false);
    if (polluted.ok) return;
    expect(polluted.issues[0]!.path).toEqual(['items', 0, 'qty']); // 删除后残留数组的下标 0
  });

  it('NC2.2 污染组用例：legacy 判决恒为拒绝（与用例登记的目标期望 accept 形成对照）', () => {
    const polluted = buildPollutedDeleteCases();
    expect(polluted.length).toBe(ARRAY_PATH_SPECS.length);
    for (const c of polluted) {
      const verdict = legacy(planFor(derived, c.path, c.payload.op), c.base, c.payload);
      expect(verdict.ok, `${c.id}: legacy 触达整数组 → 拒绝`).toBe(false);
    }
  });
});

describe('#435 NC3 规划闸门冻结（kind / 节点 kind / 载体范围）', () => {
  it('NC3.1 6 条非 union 数组路径：plan.kind=array ∧ node.kind=array ∧ node.element 在场 ∧ relPath=[]', () => {
    for (const spec of ARRAY_PATH_SPECS) {
      const plan = planFor(derived, spec.path, 'array-insert');
      expect(plan.kind, JSON.stringify(spec.path)).toBe('array');
      expect(plan.node.kind).toBe('array');
      if (plan.node.kind === 'array') expect(plan.node.element).toBeDefined();
      expect(plan.prefix).toEqual([...spec.path]);
      expect(plan.relPath).toEqual([]);
    }
  });

  it('NC3.2 union 数组目标：plan.kind=array 但 node.kind=union —— 闸门第二条件排除（永久 legacy 轨）', () => {
    const plan = planFor(derived, UNION_ARRAY_PATH, 'array-insert');
    expect(plan.kind).toBe('array');
    expect(plan.node.kind).toBe('union');
    expect(legacy(plan, [{ name: 'a', qty: 1 }], { op: 'array-insert', index: 1, values: [{ name: 'b', qty: 2 }] }).ok).toBe(true);
  });

  it('NC3.3 YPlainArray 目标：array-* 规划拒绝（纯值终态只能整体替换）', () => {
    const plainDerived = (() => {
      const parsed = vfsl.parseVfsl('type ROOT = { xs: YPlainArray<string> };');
      if (!parsed.ok) throw new Error('前置 parseVfsl 失败');
      const evaluated = vfsl.evaluate(parsed.module);
      if (!evaluated.ok) throw new Error('前置 evaluate 失败');
      return evaluated.derived;
    })();
    const planned = vfsl.planMutationBoundary(plainDerived, ['xs'], 'array-insert');
    expect(planned.ok).toBe(false);
    if (planned.ok) return;
    const failure = planned.result;
    if (failure.ok) return;
    expect(failure.issues[0]!.message).toContain('YPlainArray');
  });

  it('NC3.4 set 目标位计划：kind=target、node.kind=array（闸门负例前置锚）', () => {
    const planned = vfsl.planMutationBoundary(derived, ['items'], 'set');
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.plan.kind).toBe('target');
    expect(planned.plan.node.kind).toBe('array');
  });
});

describe('#435 NC4 立法前提：数组层无数组级约束（ADR 0033 决策 5 的绿侧）', () => {
  const anchorDerived = (() => {
    const parsed = vfsl.parseVfsl('type ROOT = { nums: YArray<number>; tags: YArray<string> };');
    if (!parsed.ok) throw new Error('前置 parseVfsl 失败');
    const evaluated = vfsl.evaluate(parsed.module);
    if (!evaluated.ok) throw new Error('前置 evaluate 失败');
    return evaluated.derived;
  })();

  it('NC4.1 长数组 / 重复元素 / 无序元素照常接受（无长度、唯一性、有序性语义）', () => {
    const result: ValidateResult = vfsl.validateLogicalSnapshot(anchorDerived, {
      nums: Array.from({ length: 300 }, (_, i) => i % 7),
      tags: ['b', 'a', 'b', 'b', 'a'],
    });
    expect(result).toEqual({ ok: true });
  });

  it('NC4.2 锚非空转：元素级非法仍逐位响亮拒绝', () => {
    const result = vfsl.validateLogicalSnapshot(anchorDerived, { nums: [1, 2, 'x'], tags: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]!.path).toEqual(['nums', 2]);
  });
});

describe('#435 NC5 一致性夹具 oracle 自洽与用例面 census', () => {
  it('NC5.1 等价集：legacy 判决与用例登记期望全数一致（红契约比较面的金标）', () => {
    const cases = buildEquivalenceCases();
    expect(cases.length).toBeGreaterThanOrEqual(100);
    let hit = 0;
    for (const c of cases) {
      const verdict = legacy(planFor(derived, c.path, c.payload.op), c.base, c.payload);
      expect(verdict.ok ? 'accept' : 'reject', `${c.id}（${c.note}）`).toBe(c.expectTarget);
      hit += 1;
    }
    expect(hit).toBe(cases.length);
  });

  it('NC5.2 用例面支覆盖：接受/拒绝两支、两类操作、全部 fast-path 数组路径', () => {
    const cases = buildEquivalenceCases();
    const accepts = cases.filter((c) => legacy(planFor(derived, c.path, c.payload.op), c.base, c.payload).ok);
    expect(accepts.length).toBeGreaterThan(0);
    expect(cases.length - accepts.length).toBeGreaterThan(0);
    expect(new Set(cases.map((c) => c.payload.op)).size).toBe(2);
    expect(new Set(cases.map((c) => JSON.stringify(c.path))).size).toBe(ARRAY_PATH_SPECS.length);
  });

  it('NC5.3 夹具基线前提：等价集基线数组整体合法（全量 oracle 不因既存元素报 issue）', () => {
    for (const c of buildEquivalenceCases()) {
      const plan = planFor(derived, c.path, c.payload.op);
      if (c.payload.op !== 'array-delete' || c.base.length === 0) continue;
      // 在基线上执行「无变更 delete」不可行（域规则拒绝 no-op），改用等价语义的 insert 空批量：
      const untouched = legacy(plan, c.base, { op: 'array-insert', index: 0, values: [] });
      expect(untouched.ok, `${c.id}: 基线数组必须整体合法（空批量恒等判定）`).toBe(true);
    }
  });
});

describe('#435 NC6 既有公共导出超集锚（本票触及面）', () => {
  it('NC6.1 七个既有运行时导出在场且为函数/类（实现只允许新增，不允许改名/删除）', () => {
    const surface = vfsl as unknown as Record<string, unknown>;
    for (const name of [
      'applyMutationAtBoundary',
      'planMutationBoundary',
      'validateAppendToArray',
      'validateInsertIntoArray',
      'validateDeleteFromArray',
      'validatePatch',
      'validateLogicalSnapshot',
    ]) {
      expect(typeof surface[name], `既有导出缺失或非函数：${name}`).toBe('function');
    }
  });
});
