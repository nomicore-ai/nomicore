/**
 * issue #440 负控 / 既有行为回归锚（控制组恒绿；与红契约
 * `issue-440-elementwise-entry-contract.test.ts` 同批）。
 *
 * 本文件**不引用任何新名目**——它锚定红契约的全部前提，把「红」钉死在能力缺口
 * （公共面无 Record / 封闭对象 delete 逐 entry 接缝），排除环境/夹具/oracle/入口四类伪红，
 * 并在实现落地后继续充当兼容面回归网（ADR 0034 决策 1/2「域规则与现行逐字一致」、
 * 决策 4 触达面收窄前的现状、决策 5 立法前提）：
 *
 * - NC1 legacy record/parent 语义冻结（键 Pattern message+path、非法新值 rebase 路径、
 *   必填 delete message、no-op message、optional/unknown delete 允许、值位 union 仲裁）；
 * - NC2 规划闸门冻结：Record set/delete kind=record（relPath=[key]、node 含 `<key>` 槽）；
 *   封闭对象 delete kind=parent（无 `<key>` 槽）；union map 位 kind=union；未声明键 delete
 *   在规划层即拒（结构面）；
 * - NC3 legacy 输入契约 = 整 map / 父对象提取值（在场事实 `{has}` 代 boundaryBase 一律拒绝）
 *   ——能力缺口的机制锚，实现后 legacy 轨仍须保持；
 * - NC4 夹具 oracle 自洽：等价集用例的 legacy 判决与登记期望一致、issue 只落在目标键位前缀、
 *   计划种类 ∈ {record,parent}；触达面组 legacy 一律连带拒绝；用例面 census（规模/两支/两操作）
 *   ——保证红契约 E 组比较面非空转；
 * - NC5 既有公共导出超集锚（23 个运行时导出不得改名/删除；本票只允许加法）；
 * - NC6 立法前提（ADR 0034 决策 5 绿侧）：Record 层无 map 级约束——200 entry 干净 map 整体
 *   接受、entry 级非法仍响亮拒绝；
 * - NC7 现状触达面（决策 4 对照基线）：污染在目标键位之外的 record/parent 写在 legacy 轨
 *   一律连带拒绝。
 *
 * 断言只经包公共入口运行时可观察输出；不 grep 生产源码；无 skip/only/todo/env override/
 * fallback/软化断言。HEAD 与实现后均须绿。
 */
import { describe, expect, it } from 'vitest';
import * as vfsl from '../src/index.js';
import type { ValidateResult } from '../src/index.js';
import {
  PARENT_PATH_SPECS,
  RECORD_PATH_SPECS,
  buildEquivalenceCases,
  buildTouchSurfaceCases,
  entrywiseDerived,
  issuesConfinedToTargetKey,
  ivIllegal,
  ivLegal,
  legalKey,
  legacyVerdict,
  objBase,
  panelBase,
  planFor,
  planForCase,
  unionMapPlan,
  verdictBytes,
  withoutField,
} from './issue-440-elementwise-entry-fixture.js';
import type { EntryCase } from './issue-440-elementwise-entry-fixture.js';

const derived = entrywiseDerived();
const equivalenceCases = buildEquivalenceCases();
const touchSurfaceCases = buildTouchSurfaceCases();

function oracleOf(c: EntryCase) {
  return legacyVerdict(derived, planForCase(derived, c), c.base, c.payload);
}

/** ValidateResult → Verdict 规整（字节判据同口径）。 */
function resultVerdict(result: ValidateResult) {
  if (result.ok) return { ok: true as const, issues: [] as const };
  return { ok: false as const, issues: result.issues.map((issue) => ({ message: issue.message, path: [...issue.path] })) };
}

// ── NC1 legacy 语义冻结 ─────────────────────────────────────────────────────

describe('#440 NC1 legacy record/parent 语义冻结（兼容面）', () => {
  it('NC1.1 键 Pattern 违规 message+path 逐字冻结；键违规不阻断值校验（全收集，键先值后）', () => {
    const legalValue = legacyVerdict(derived, planFor(derived, ['codes', 'nope'], 'set'), {}, { op: 'set', value: ivLegal('item') });
    expect(verdictBytes(legalValue)).toBe(
      '{"ok":false,"issues":[{"message":"Record 键 \\"nope\\" 不满足 Pattern 正则 /^(id-[0-9]+)$/","path":["codes","nope"]}]}',
    );
    const illegalValue = legacyVerdict(derived, planFor(derived, ['codes', 'nope'], 'set'), {}, { op: 'set', value: ivIllegal('item') });
    expect(illegalValue.ok).toBe(false);
    if (illegalValue.ok) return;
    expect(illegalValue.issues.map((i) => i.path)).toEqual([['codes', 'nope'], ['codes', 'nope', 'qty']]);
  });

  it('NC1.2 非法新值 rebase 路径 `[...mapPath, key, ...值内路径]` 冻结', () => {
    const result = legacyVerdict(derived, planFor(derived, ['tasks', 't9'], 'set'), {}, { op: 'set', value: ivIllegal('item') });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]!.path).toEqual(['tasks', 't9', 'qty']);
    const nested = legacyVerdict(derived, planFor(derived, ['outer', 'inner', 'n9'], 'set'), {}, { op: 'set', value: ivIllegal('item') });
    expect(nested.ok).toBe(false);
    if (!nested.ok) expect(nested.issues[0]!.path).toEqual(['outer', 'inner', 'n9', 'qty']);
  });

  it('NC1.3 delete no-op message+path 逐字冻结（缺席键，与必填性/Pattern 无关）', () => {
    expect(verdictBytes(legacyVerdict(derived, planFor(derived, ['tasks', 'tX'], 'delete'), {}, { op: 'delete' }))).toBe(
      '{"ok":false,"issues":[{"message":"delete 目标键不存在（拒绝 no-op）","path":["tasks","tX"]}]}',
    );
    expect(verdictBytes(legacyVerdict(derived, planFor(derived, ['obj', 'opt'], 'delete'), withoutField(objBase(), 'opt'), { op: 'delete' }))).toBe(
      '{"ok":false,"issues":[{"message":"delete 目标键不存在（拒绝 no-op）","path":["obj","opt"]}]}',
    );
    expect(verdictBytes(legacyVerdict(derived, planFor(derived, ['codes', 'nope'], 'delete'), { 'id-1': ivLegal('item') }, { op: 'delete' }))).toBe(
      '{"ok":false,"issues":[{"message":"delete 目标键不存在（拒绝 no-op）","path":["codes","nope"]}]}',
    );
  });

  it('NC1.4 封闭对象必填 delete：message+path 逐字冻结；optional/unknown 允许', () => {
    for (const spec of [
      { path: ['obj'], base: objBase(), required: ['req', 'child', 'u'], allowed: ['opt', 'unk'] },
      { path: ['panel', 'node'], base: panelBase(), required: ['req'], allowed: ['opt', 'unk'] },
    ]) {
      for (const field of spec.required) {
        const result = legacyVerdict(derived, planFor(derived, [...spec.path, field], 'delete'), spec.base, { op: 'delete' });
        expect(result.ok, `field=${field}`).toBe(false);
        if (result.ok) continue;
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]!.message).toBe(`缺少必填字段 "${field}"`);
        expect(result.issues[0]!.path).toEqual([...spec.path, field]);
      }
      for (const field of spec.allowed) {
        expect(legacyVerdict(derived, planFor(derived, [...spec.path, field], 'delete'), spec.base, { op: 'delete' }), `field=${field}`).toEqual({ ok: true, issues: [] });
      }
    }
  });

  it('NC1.5 值位 union（Record<string, Item | Alt>）在 legacy 轨照常仲裁（逐字）', () => {
    const result = legacyVerdict(derived, planFor(derived, ['blobs', 'b1'], 'set'), {}, { op: 'set', value: { label: 'l', n: 11 } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]!.message).toBe('联合成员 2/2：期望整数区间 [0, 10]，实际 11');
    expect(result.issues[0]!.path).toEqual(['blobs', 'b1', 'n']);
  });
});

// ── NC2 规划闸门冻结 ────────────────────────────────────────────────────────

describe('#440 NC2 规划闸门冻结（planMutationBoundary 形状）', () => {
  it('NC2.1 Record set/delete：kind=record、relPath=[key]、node 为 Record 形态（含 <key> 槽）', () => {
    for (const spec of RECORD_PATH_SPECS) {
      const key = legalKey(spec, 0);
      for (const op of ['set', 'delete'] as const) {
        const plan = planFor(derived, [...spec.path, key], op);
        expect(plan.kind, `path=${JSON.stringify(spec.path)} op=${op}`).toBe('record');
        expect(plan.prefix).toEqual([...spec.path]);
        expect(plan.relPath).toEqual([key]);
        expect(plan.node.kind).toBe('object');
        if (plan.node.kind !== 'object') continue;
        expect(plan.node.fields.some((f) => f.name === '<key>')).toBe(true);
        if (spec.keyPattern !== undefined) expect(plan.node.keyPattern).toBe(spec.keyPattern);
      }
    }
  });

  it('NC2.2 封闭对象 delete：kind=parent、relPath=[字段]、node 为封闭对象形态（无 <key> 槽）', () => {
    for (const spec of PARENT_PATH_SPECS) {
      for (const field of spec.fields) {
        const plan = planFor(derived, [...spec.path, field.name], 'delete');
        expect(plan.kind, `path=${JSON.stringify(spec.path)} field=${field.name}`).toBe('parent');
        expect(plan.relPath).toEqual([field.name]);
        expect(plan.node.kind).toBe('object');
        if (plan.node.kind !== 'object') continue;
        expect(plan.node.fields.some((f) => f.name === '<key>')).toBe(false);
      }
    }
  });

  it('NC2.3 union map 位（maybe）：kind=union ∧ node.kind=union（永久 legacy 轨）', () => {
    const unionPlan = unionMapPlan(derived);
    expect(unionPlan.kind).toBe('union');
    expect(unionPlan.node.kind).toBe('union');
    expect(planFor(derived, ['maybe', 'm1'], 'delete').kind).toBe('union');
  });

  it('NC2.4 未声明键 delete：规划层结构面即拒（封闭对象不接受未声明键）', () => {
    const planned = vfsl.planMutationBoundary(derived, ['obj', 'ghost'], 'delete');
    expect(planned.ok).toBe(false);
    if (planned.ok) return;
    expect(verdictBytes(resultVerdict(planned.result))).toBe(
      '{"ok":false,"issues":[{"message":"路径不存在：未知字段 \\"ghost\\"（封闭对象不接受未声明键）","path":["obj","ghost"]}]}',
    );
  });
});

// ── NC3 legacy 输入契约 = 整 map / 父对象提取值 ─────────────────────────────

describe('#440 NC3 legacy 输入契约（在场事实不足以判定）', () => {
  it('NC3.1 record set + {has:true} 代 boundaryBase：事实对象被当作 map 内容整体校验 → 响亮拒绝', () => {
    const result = legacyVerdict(derived, planFor(derived, ['tasks', 't3'], 'set'), { has: true }, { op: 'set', value: ivLegal('item') });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]!.path).toEqual(['tasks', 'has']);
  });

  it('NC3.2 record delete / parent delete + {has:true}：no-op 拒绝（legacy 的必填判定绑在父值重建后）', () => {
    const recordDelete = legacyVerdict(derived, planFor(derived, ['tasks', 't1'], 'delete'), { has: true }, { op: 'delete' });
    expect(recordDelete.ok).toBe(false);
    if (!recordDelete.ok) expect(recordDelete.issues[0]!.message).toBe('delete 目标键不存在（拒绝 no-op）');
    const parentDelete = legacyVerdict(derived, planFor(derived, ['obj', 'req'], 'delete'), { has: true }, { op: 'delete' });
    expect(parentDelete.ok).toBe(false);
    if (!parentDelete.ok) expect(parentDelete.issues[0]!.message).toBe('delete 目标键不存在（拒绝 no-op）');
  });
});

// ── NC4 夹具 oracle 自洽 + census ───────────────────────────────────────────

describe('#440 NC4 夹具 oracle 自洽（比较面非空转）', () => {
  it('NC4.1 等价集：oracle 判决 = 登记期望；issue 只落在目标键位前缀；计划 ∈ {record,parent}', () => {
    expect(equivalenceCases.length).toBeGreaterThanOrEqual(100);
    for (const c of equivalenceCases) {
      const plan = planForCase(derived, c);
      const oracle = oracleOf(c);
      expect(oracle.ok, `${c.id} 期望=${c.expectTarget} oracle=${verdictBytes(oracle)}`).toBe(c.expectTarget === 'accept');
      expect(issuesConfinedToTargetKey(oracle, plan), `${c.id} 等价集 oracle issue 越出目标键位前缀`).toBe(true);
      expect(['record', 'parent'], `${c.id} 计划种类`).toContain(plan.kind);
    }
  });

  it('NC4.2 census：接受/拒绝两支、set/delete 两操作、record/parent 两形态均非空', () => {
    const accept = equivalenceCases.filter((c) => c.expectTarget === 'accept').length;
    const reject = equivalenceCases.filter((c) => c.expectTarget === 'reject').length;
    const sets = equivalenceCases.filter((c) => c.payload.op === 'set').length;
    const deletes = equivalenceCases.filter((c) => c.payload.op === 'delete').length;
    const records = equivalenceCases.filter((c) => planForCase(derived, c).kind === 'record').length;
    const parents = equivalenceCases.filter((c) => planForCase(derived, c).kind === 'parent').length;
    expect(accept).toBeGreaterThan(0);
    expect(reject).toBeGreaterThan(0);
    expect(sets).toBeGreaterThan(0);
    expect(deletes).toBeGreaterThan(0);
    expect(records).toBeGreaterThan(0);
    expect(parents).toBeGreaterThan(0);
    expect(accept + reject).toBe(equivalenceCases.length);
  });

  it('NC4.3 触达面组登记自洽：legacy 一律连带拒绝（现状对照基线），组非空', () => {
    expect(touchSurfaceCases.length).toBeGreaterThan(0);
    for (const c of touchSurfaceCases) {
      expect(oracleOf(c).ok, `${c.id} 前置：legacy 对触达面外污染连带拒绝`).toBe(false);
    }
  });
});

// ── NC5 既有公共导出超集锚 ─────────────────────────────────────────────────

describe('#440 NC5 既有公共导出超集锚', () => {
  it('NC5.1 23 个既有运行时导出在场（本票只允许新增，不允许改名/删除）', () => {
    const surface = vfsl as unknown as Record<string, unknown>;
    const existing = [
      'FileSchemaSource',
      'SchemaSourceError',
      'applyElementwiseArrayMutation',
      'applyMutationAtBoundary',
      'assertVfslDialect',
      'compilePattern',
      'compileSchemaEnvelope',
      'deriveSchemaIdentity',
      'evaluate',
      'getCompiled',
      'getCompiledWith',
      'isSchemaTruncationMarker',
      'matchPattern',
      'parseSchemaEnvelope',
      'parseVfsl',
      'planMutationBoundary',
      'renderProjectionText',
      'resolveSchemaAtPath',
      'validateAppendToArray',
      'validateDeleteFromArray',
      'validateInsertIntoArray',
      'validateLogicalSnapshot',
      'validatePatch',
    ];
    for (const name of existing) {
      expect(Object.prototype.hasOwnProperty.call(surface, name), `既有导出缺失：${name}`).toBe(true);
      expect(surface[name], `既有导出形态变化：${name}`).toBeDefined();
    }
  });

  it('NC5.2 数组逐元素接缝（#435/ADR 0033）在场且为函数（本票不得改动其签名面）', () => {
    expect(typeof (vfsl as unknown as Record<string, unknown>)['applyElementwiseArrayMutation']).toBe('function');
  });
});

// ── NC6 立法前提（决策 5 绿侧）────────────────────────────────────────────

describe('#440 NC6 立法前提：Record 层无 map 级约束', () => {
  const tasks: Record<string, unknown> = {};
  for (let i = 0; i < 200; i++) tasks[legalKey(RECORD_PATH_SPECS[0]!, i)] = { name: `n${i}`, qty: i % 101 };
  const snapshot: Record<string, unknown> = {
    tasks,
    codes: {},
    blobs: {},
    maybe: { fixed: 'f' },
    outer: { inner: {} },
    obj: objBase(),
    panel: { node: panelBase() },
  };

  it('NC6.1 200 entry 干净 Record 整体接受（无键数上限 / 无跨键约束）', () => {
    expect(vfsl.validateLogicalSnapshot(derived, snapshot)).toEqual({ ok: true });
  });

  it('NC6.2 entry 级非法仍响亮拒绝（立法非空转）', () => {
    const polluted = vfsl.validateLogicalSnapshot(derived, { ...snapshot, tasks: { ...tasks, t7: { name: 'n7', qty: 999 } } });
    expect(polluted.ok).toBe(false);
    if (polluted.ok) return;
    expect(polluted.issues.some((i) => i.path.join('/') === 'tasks/t7/qty')).toBe(true);
  });
});

// ── NC7 现状触达面（决策 4 对照基线）──────────────────────────────────────

describe('#440 NC7 现状触达面（legacy 连带拒绝 = 行为变化对照面）', () => {
  it('NC7.1 污染在目标键位之外：record set/delete 与 parent delete 在 legacy 轨响亮拒绝', () => {
    const item = { name: 'a', qty: 1 };
    const cases: Array<{ path: readonly (string | number)[]; base: Record<string, unknown>; payload: EntryCase['payload'] }> = [
      { path: ['tasks', 't3'], base: { t1: item, t2: { name: 'b', qty: 999 } }, payload: { op: 'set', value: item } },
      { path: ['tasks', 't1'], base: { t1: item, t2: { name: 'b', qty: 999 } }, payload: { op: 'delete' } },
      { path: ['obj', 'opt'], base: { ...objBase(), child: { deep: 5 } }, payload: { op: 'delete' } },
    ];
    for (const c of cases) {
      const result = legacyVerdict(derived, planFor(derived, [...c.path], c.payload.op), c.base, c.payload);
      expect(result.ok, `path=${JSON.stringify(c.path)}`).toBe(false);
      if (result.ok) continue;
      // 拒绝原因必须指向目标键位之外：无任何 issue 落在 [...容器路径, 目标键] 前缀上
      const prefix = [...c.path];
      const startsAtTarget = (issuePath: readonly (string | number)[]): boolean =>
        issuePath.length > prefix.length - 1 && prefix.every((seg, i) => issuePath[i] === seg);
      expect(result.issues.some((i) => startsAtTarget(i.path)), `path=${JSON.stringify(c.path)} 拒绝原因应含目标键位外的污染`).toBe(false);
    }
  });
});
