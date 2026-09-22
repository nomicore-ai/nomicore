/**
 * SA6 验收契约（红灯）— issue #440：`@nomicore/vfsl` Record / 封闭对象 delete 的逐 entry
 * 判定接缝（ADR 0034 决策 1/2/4/5；Parent PR #438 = spec/adr-0034 集成基线）。
 *
 * 契约来源：
 * - 任务简报 `wiki/raw/task_issue-440.md`（What to build + AC1–AC6）；
 * - `docs/adr/0034-record-and-parent-elementwise-validation.md` 决策 1（Record set =
 *   键 Pattern + 新值过值 schema、旧值不读；Record delete = `has(key)` 拒 no-op；
 *   闸门 = map 位非 union Record 形态；Record 值位 union 不影响 fast path）、决策 2
 *   （封闭对象 delete 静态必填判定：必填且非 `unknown` 标量 → 拒绝；optional / `unknown`
 *   → 允许；不读父值）、决策 4（触达面 = 载体 + 目标键位）、决策 5（一致性 fixture：
 *   逐 entry 判定 vs 全量整体验证逐字节一致）；
 * - SA6 契约报告 `wiki/raw/task_issue-440_sa6_contract.md` §12（绑定表 B-1…、用例组 A–F、
 *   敏感度防线）；探针 `wiki/raw/task_issue-440_sa6_capability_probe.mts`（GAP/ORACLE/REF/NC）。
 *
 * 红灯机理（HEAD，探针 G1/G2 实证）：包公共入口 23 个运行时导出中无 Record/parent 逐 entry
 * 接缝（`/elementwise/i` 仅命中数组位 `applyElementwiseArrayMutation`）；现行
 * `applyMutationAtBoundary` 对 record/parent 写必须消费「整 map / 父对象边界提取值」
 * （以在场事实 `{has}` 代替 → record set 报 `类型不匹配：期望对象，实际 boolean`、
 * record/parent delete 报 `delete 目标键不存在（拒绝 no-op）`）⟹ 本文件 A–F 组每条断言都在
 * `seam()` 处因能力缺口失败（非环境/夹具/入口伪红）。
 *
 * 断言纪律：
 * - 只经包公共入口（`../src/index.js`）观察运行时行为；不 grep 生产源码、不 import 内部件；
 * - 本文件**顶层不静态 import 新名目**（新导出不存在时的 TS2305 不污染运行时红灯归因）；
 *   接缝经 `import * as vfsl` + 动态属性读取，改名只动下面 SEAM_EXPORT 一处；
 * - 全量 oracle = 既有公共导出 `applyMutationAtBoundary`（边界值全量重建 + `validateSubtree`
 *   整体判定）；期望值或取自 oracle 逐字节比较，或取自现行实现冻结文案的常量；
 * - 零 skip/only/todo、零 env override、零 fallback、零吞错、零软化断言。
 */
import { describe, expect, it } from 'vitest';
import * as vfsl from '../src/index.js';
import type { DerivedSchema, MutationBoundaryPlan, ValidateResult } from '../src/index.js';
import {
  OBJ_PATH,
  PANEL_PATH,
  RECORD_PATH_SPECS,
  buildEquivalenceCases,
  buildTouchSurfaceCases,
  entrywiseDerived,
  issuesConfinedToTargetKey,
  ivIllegal,
  ivLegal,
  legacyVerdict,
  legalKey,
  objBase,
  panelBase,
  planFor,
  planForCase,
  targetKeyOf,
  unionMapPlan,
  verdictBytes,
  verdictsEqual,
  withoutField,
} from './issue-440-elementwise-entry-fixture.js';
import type { EntryCase, EntryMutationPayload, Verdict } from './issue-440-elementwise-entry-fixture.js';

// ── §12.1 绑定点 B-1（冻结后改名只动这一处）──────────────────────────────────

const SEAM_EXPORT = 'applyElementwiseEntryMutation';

interface EntryCarrierFacts {
  readonly has: boolean;
}

type SeamFn = (
  derived: DerivedSchema,
  plan: MutationBoundaryPlan,
  facts: EntryCarrierFacts,
  payload: EntryMutationPayload,
) => ValidateResult;

const CAPABILITY_GAP =
  `能力缺口：@nomicore/vfsl 公共入口未导出 ${SEAM_EXPORT}（ADR 0034 决策 1/2 逐 entry 判定接缝）`;

function seam(): SeamFn {
  const candidate = (vfsl as unknown as Record<string, unknown>)[SEAM_EXPORT];
  if (typeof candidate !== 'function') {
    throw new Error(`${CAPABILITY_GAP}——实际 typeof=${typeof candidate}`);
  }
  return candidate as SeamFn;
}

/** 目标接缝调用（facts 由基线在场性折算，与 live `Y.Map.has(key)` 同义）。 */
function callOf(
  plan: MutationBoundaryPlan,
  has: boolean,
  payload: EntryMutationPayload,
): ValidateResult {
  return seam()(derived, plan, { has }, payload);
}

/** 目标接缝判决（经夹具规整，与全量 oracle 的 Verdict 同形可比）。 */
function verdictOf(c: EntryCase): Verdict {
  return targetVerdictOf(planForCase(derived, c), c);
}

function targetVerdictOf(plan: MutationBoundaryPlan, c: EntryCase): Verdict {
  const result = callOf(plan, Object.hasOwn(c.base, targetKeyOf(plan)), c.payload);
  if (result.ok) return { ok: true, issues: [] };
  return { ok: false, issues: result.issues.map((issue) => ({ message: issue.message, path: [...issue.path] })) };
}

function oracleOf(c: EntryCase): Verdict {
  return legacyVerdict(derived, planForCase(derived, c), c.base, c.payload);
}

const derived = entrywiseDerived();
const equivalenceCases = buildEquivalenceCases();
const touchSurfaceCases = buildTouchSurfaceCases();

// ── A. 公共接缝（能力缺口 + 调用形状）────────────────────────────────────────

describe('#440 A 公共接缝（经包公共入口）', () => {
  it('A1 新导出在场且是函数（公共面唯一入口 = src/index.ts）', () => {
    const surface = vfsl as unknown as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(surface, SEAM_EXPORT), `${CAPABILITY_GAP}——公共入口无此自有导出键`).toBe(true);
    expect(typeof surface[SEAM_EXPORT], CAPABILITY_GAP).toBe('function');
  });

  it('A2 合法 Record set 返回 ValidateResult 的 ok 支（`{ok:true}` 直出、无 result 包装、纯函数）', () => {
    const plan = planFor(derived, ['tasks', 't9'], 'set');
    const planBefore = JSON.stringify(plan);
    const result = callOf(plan, false, { op: 'set', value: ivLegal('item') });
    expect(result).toEqual({ ok: true });
    expect(Object.hasOwn(result as object, 'result')).toBe(false);
    expect(JSON.stringify(plan)).toBe(planBefore);
  });
});

// ── B. Record set（键 Pattern + 新值过值 schema；旧值不读）─────────────────────

describe('#440 B Record set 逐 entry 校验', () => {
  it('B1 每条 fast-path Record 路径：新键 / 既有键整值替换（合法值）均通过', () => {
    for (const spec of RECORD_PATH_SPECS) {
      const existing = legalKey(spec, 0);
      const base: Record<string, unknown> = { [existing]: ivLegal(spec.valueKind) };
      const tag = `path=${JSON.stringify(spec.path)}`;
      const newKey = spec.keyPattern === undefined ? 'zz9' : 'id-9';
      expect(callOf(planFor(derived, [...spec.path, newKey], 'set'), Object.hasOwn(base, newKey), { op: 'set', value: ivLegal(spec.valueKind) }), `${tag} 新键`).toEqual({ ok: true });
      expect(callOf(planFor(derived, [...spec.path, existing], 'set'), Object.hasOwn(base, existing), { op: 'set', value: ivLegal(spec.valueKind) }), `${tag} 既有键覆盖`).toEqual({ ok: true });
    }
  });

  it('B2 非法新值写入前拒绝：issue 路径 = [...mapPath, key, ...值内路径]（items 规范锚 + oracle 逐字节）', () => {
    const plan = planFor(derived, ['tasks', 'zz9'], 'set');
    const result = callOf(plan, false, { op: 'set', value: ivIllegal('item') });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.message).toBe('期望整数区间 [0, 100]，实际 101');
    expect(result.issues[0]!.path).toEqual(['tasks', 'zz9', 'qty']);
    const c = caseOf(['tasks'], 'zz9', {}, { op: 'set', value: ivIllegal('item') });
    expect(verdictBytes(verdictOf(c))).toBe(verdictBytes(oracleOf(c)));
  });

  it('B3 键 Pattern 违规（合法值）：message/path 与全量路径逐字节一致', () => {
    const span = { op: 'set', value: ivLegal('item') } as const;
    const result = callOf(planFor(derived, ['codes', 'nope'], 'set'), false, span);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.message).toBe('Record 键 "nope" 不满足 Pattern 正则 /^(id-[0-9]+)$/');
    expect(result.issues[0]!.path).toEqual(['codes', 'nope']);
    const c = caseOf(['codes'], 'nope', {}, span);
    expect(verdictBytes(verdictOf(c))).toBe(verdictBytes(oracleOf(c)));
  });

  it('B4 键 Pattern 违规 + 非法新值：两 issue、序 = 键先值后（全收集语义），与 oracle 逐字节一致', () => {
    const payload: EntryMutationPayload = { op: 'set', value: ivIllegal('item') };
    const result = callOf(planFor(derived, ['codes', 'nope'], 'set'), false, payload);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((i) => i.path)).toEqual([['codes', 'nope'], ['codes', 'nope', 'qty']]);
    const c = caseOf(['codes'], 'nope', {}, payload);
    expect(verdictBytes(verdictOf(c))).toBe(verdictBytes(oracleOf(c)));
  });

  it('B5 Record 值位为 union 不影响 fast path（blobs: Record<string, Item | Alt> 逐字复现 union 仲裁）', () => {
    const legal = caseOf(['blobs'], 'b9', {}, { op: 'set', value: { label: 'l', n: 3 } });
    expect(verdictOf(legal)).toEqual({ ok: true, issues: [] });
    expect(verdictBytes(verdictOf(legal))).toBe(verdictBytes(oracleOf(legal)));
    const illegal = caseOf(['blobs'], 'b9', {}, { op: 'set', value: { label: 'l', n: 11 } });
    expect(verdictBytes(verdictOf(illegal))).toBe(verdictBytes(oracleOf(illegal)));
    expect(verdictOf(illegal).ok).toBe(false);
  });

  it('B6 旧值不读：同一 payload 下 has 真/假判决逐字节相同；目标键位旧值非法不阻断（整值替换）', () => {
    for (const spec of RECORD_PATH_SPECS) {
      const plan = planFor(derived, [...spec.path, legalKey(spec, 0)], 'set');
      const payload: EntryMutationPayload = { op: 'set', value: ivLegal(spec.valueKind) };
      const a = callOf(plan, false, payload);
      const b = callOf(plan, true, payload);
      expect(a, `path=${JSON.stringify(spec.path)} has=false`).toEqual({ ok: true });
      expect(verdictBytes(resultVerdict(a))).toBe(verdictBytes(resultVerdict(b)));
    }
    const polluted = caseOf(['tasks'], 't1', { t1: { name: 'a', qty: 999 } }, { op: 'set', value: { name: 'z', qty: 1 } });
    expect(oracleOf(polluted), '前置：全量轨对 set 整值替换修复旧值照常接受').toEqual({ ok: true, issues: [] });
    expect(verdictOf(polluted)).toEqual({ ok: true, issues: [] });
  });

  it('B7 嵌套 Record 路径 rebase：issue 路径使用容器绝对路径（outer.inner）', () => {
    const payload: EntryMutationPayload = { op: 'set', value: ivIllegal('item') };
    const span = { op: 'set', value: ivIllegal('item') } as const;
    const result = callOf(planFor(derived, ['outer', 'inner', 'n9'], 'set'), false, span);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]!.path).toEqual(['outer', 'inner', 'n9', 'qty']);
    const c = caseOf(['outer', 'inner'], 'n9', {}, payload);
    expect(verdictBytes(verdictOf(c))).toBe(verdictBytes(oracleOf(c)));
  });
});

// ── C. Record delete（仅在场/no-op 域规则；不触碰其他 entry）───────────────────

describe('#440 C Record delete 仅域规则判定', () => {
  it('C1 缺席键拒 no-op：message/path 与现行逐字一致', () => {
    const result = callOf(planFor(derived, ['tasks', 'tX'], 'delete'), false, { op: 'delete' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.message).toBe('delete 目标键不存在（拒绝 no-op）');
    expect(result.issues[0]!.path).toEqual(['tasks', 'tX']);
    const c = caseOf(['tasks'], 'tX', {}, { op: 'delete' });
    expect(verdictBytes(verdictOf(c))).toBe(verdictBytes(oracleOf(c)));
  });

  it('C2 在场键 delete 全部通过（空对象合法 ⇒ 删除永不使 Record 变非法）', () => {
    for (const spec of RECORD_PATH_SPECS) {
      const key = legalKey(spec, 0);
      const base: Record<string, unknown> = { [key]: ivLegal(spec.valueKind) };
      const c = caseOf(spec.path, key, base, { op: 'delete' });
      expect(callOf(planFor(derived, [...spec.path, key], 'delete'), true, { op: 'delete' }), `path=${JSON.stringify(spec.path)}`).toEqual({ ok: true });
      expect(verdictBytes(verdictOf(c))).toBe(verdictBytes(oracleOf(c)));
    }
  });

  it('C3 不触碰其他 entry：同 has 事实下干净基线与邻位污染基线判决逐字节相同', () => {
    const clean = caseOf(['tasks'], 't1', { t1: { name: 'a', qty: 1 } }, { op: 'delete' });
    const polluted = caseOf(['tasks'], 't1', { t1: { name: 'a', qty: 1 }, t2: { name: 'b', qty: 999 } }, { op: 'delete' });
    expect(verdictBytes(verdictOf(clean))).toBe(verdictBytes(verdictOf(polluted)));
    expect(verdictOf(polluted)).toEqual({ ok: true, issues: [] });
    // 前置对照：全量 oracle 对邻位污染连带拒绝（触达面收窄的对照面）
    expect(oracleOf(polluted).ok).toBe(false);
  });

  it('C4 目标键本身违反 keyPattern 但存在：delete 照常成功（delete 不查键 Pattern）', () => {
    const c = caseOf(['codes'], 'nope', { nope: { name: 'a', qty: 1 } }, { op: 'delete' });
    expect(verdictOf(c)).toEqual({ ok: true, issues: [] });
    expect(verdictBytes(verdictOf(c))).toBe(verdictBytes(oracleOf(c)));
  });

  it('C5 缺席键即使违反 keyPattern 也只报 no-op（域规则先于 schema 判定）', () => {
    const c = caseOf(['codes'], 'nope', { 'id-1': { name: 'a', qty: 1 } }, { op: 'delete' });
    expect(verdictBytes(verdictOf(c))).toBe(verdictBytes(oracleOf(c)));
    expect(verdictBytes(verdictOf(c))).toBe('{"ok":false,"issues":[{"message":"delete 目标键不存在（拒绝 no-op）","path":["codes","nope"]}]}');
  });
});

// ── D. 封闭对象 delete 静态规则全矩阵（kind=parent）──────────────────────────

describe('#440 D 封闭对象 delete 静态必填判定（不读父值）', () => {
  it('D1 必填且非 unknown 标量 → 拒绝（message/path 逐字一致；两 parent 路径全矩阵）', () => {
    for (const spec of [
      { path: OBJ_PATH, base: objBase(), required: ['req', 'child', 'u'] },
      { path: PANEL_PATH, base: panelBase(), required: ['req'] },
    ]) {
      for (const field of spec.required) {
        const span = { op: 'delete' } as const;
        const result = callOf(planFor(derived, [...spec.path, field], 'delete'), true, span);
        expect(result.ok, `path=${JSON.stringify(spec.path)} field=${field}`).toBe(false);
        if (result.ok) continue;
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]!.message).toBe(`缺少必填字段 "${field}"`);
        expect(result.issues[0]!.path).toEqual([...spec.path, field]);
        const c = caseOf(spec.path, field, spec.base, span);
        expect(verdictBytes(verdictOf(c))).toBe(verdictBytes(oracleOf(c)));
      }
    }
  });

  it('D2 optional / unknown 标量字段 → 允许（与 oracle 逐字节一致）', () => {
    for (const spec of [
      { path: OBJ_PATH, base: objBase(), allowed: ['opt', 'unk'] },
      { path: PANEL_PATH, base: panelBase(), allowed: ['opt', 'unk'] },
    ]) {
      for (const field of spec.allowed) {
        const span = { op: 'delete' } as const;
        expect(callOf(planFor(derived, [...spec.path, field], 'delete'), true, span), `path=${JSON.stringify(spec.path)} field=${field}`).toEqual({ ok: true });
        const c = caseOf(spec.path, field, spec.base, span);
        expect(verdictBytes(verdictOf(c))).toBe(verdictBytes(oracleOf(c)));
      }
    }
  });

  it('D3 字段缺席（has=false）→ 拒 no-op（必填性无关的域规则）', () => {
    const span = { op: 'delete' } as const;
    const result = callOf(planFor(derived, ['obj', 'opt'], 'delete'), false, span);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]!.message).toBe('delete 目标键不存在（拒绝 no-op）');
    expect(result.issues[0]!.path).toEqual(['obj', 'opt']);
    const c = caseOf(['obj'], 'req', withoutField(objBase(), 'req'), span);
    expect(verdictBytes(verdictOf(c))).toBe(verdictBytes(oracleOf(c)));
    expect(oracleOf(c).ok).toBe(false);
  });

  it('D4 静态性（数据无关）：目标字段值形态不影响判决（必填拒绝 / optional 允许）', () => {
    const rejectableLegal = caseOf(['obj'], 'req', objBase(), { op: 'delete' });
    const rejectablePolluted = caseOf(['obj'], 'req', { ...objBase(), req: 42 }, { op: 'delete' });
    expect(verdictBytes(verdictOf(rejectableLegal))).toBe(verdictBytes(verdictOf(rejectablePolluted)));
    expect(verdictOf(rejectablePolluted).ok).toBe(false);
    const allowedLegal = caseOf(['obj'], 'opt', objBase(), { op: 'delete' });
    const allowedPolluted = caseOf(['obj'], 'opt', { ...objBase(), opt: 'x' }, { op: 'delete' });
    expect(verdictBytes(verdictOf(allowedLegal))).toBe(verdictBytes(verdictOf(allowedPolluted)));
    expect(verdictOf(allowedPolluted)).toEqual({ ok: true, issues: [] });
  });

  it('D5 不读父值 / 同胞不重验：同 has 事实下干净基线与同胞污染基线判决逐字节相同', () => {
    const pollutedBase = { ...objBase(), child: { deep: 5 } };
    for (const field of ['req', 'opt', 'unk', 'child', 'u']) {
      const clean = caseOf(['obj'], field, objBase(), { op: 'delete' });
      const polluted = caseOf(['obj'], field, pollutedBase, { op: 'delete' });
      expect(verdictBytes(verdictOf(clean)), `field=${field}`).toBe(verdictBytes(verdictOf(polluted)));
    }
    // 前置对照：全量 oracle 对同胞污染连带拒绝（触达面收窄的对照面）
    const c = caseOf(['obj'], 'opt', pollutedBase, { op: 'delete' });
    expect(oracleOf(c).ok).toBe(false);
    expect(verdictOf(c)).toEqual({ ok: true, issues: [] });
  });

  it('D6 嵌套封闭对象路径 rebase：issue 路径使用父对象绝对路径（panel.node）', () => {
    const c = caseOf(PANEL_PATH, 'req', panelBase(), { op: 'delete' });
    expect(verdictBytes(verdictOf(c))).toBe(verdictBytes(oracleOf(c)));
    const result = callOf(planFor(derived, ['panel', 'node', 'req'], 'delete'), true, { op: 'delete' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]!.path).toEqual(['panel', 'node', 'req']);
  });
});

// ── E. 一致性 fixture（逐 entry 判定 vs 全量整体验证逐字节一致）───────────────

describe('#440 E 一致性 fixture（ADR 0034 决策 5）', () => {
  it('E1 全用例：逐 entry 判定与全量整体验证的接受/拒绝及 issue 内容逐字节一致', () => {
    expect(equivalenceCases.length).toBeGreaterThanOrEqual(100);
    let checked = 0;
    for (const c of equivalenceCases) {
      const oracle = oracleOf(c);
      const target = verdictOf(c);
      expect(verdictBytes(target), `${c.id}（${c.note}）逐 entry=${verdictBytes(target)} 全量=${verdictBytes(oracle)}`).toBe(verdictBytes(oracle));
      checked += 1;
    }
    expect(checked).toBe(equivalenceCases.length);
  });

  it('E2 比较判据敏感：触达面组（污染在目标键位之外）上目标判决与全量 oracle 逐字节可分', () => {
    expect(touchSurfaceCases.length).toBeGreaterThan(0);
    let detected = 0;
    for (const c of touchSurfaceCases) {
      const oracle = oracleOf(c);
      expect(oracle.ok, `${c.id} 前置：全量 oracle 对触达面外污染连带拒绝`).toBe(false);
      if (!verdictsEqual(verdictOf(c), oracle)) detected += 1;
    }
    expect(detected).toBe(touchSurfaceCases.length);
  });

  it('E3 触达面目标行为：目标键位合法即成功；拒绝时只报目标键位（不连带邻位污染）', () => {
    for (const c of touchSurfaceCases) {
      const target = verdictOf(c);
      expect(target.ok, `${c.id}（${c.note}）`).toBe(c.expectTarget === 'accept');
      expect(issuesConfinedToTargetKey(target, planForCase(derived, c)), `${c.id} 目标 issue 必须只落在目标键位前缀`).toBe(true);
    }
    // 拒绝支的对比证据：目标只报目标键位，oracle 连带邻位污染（issue 数不同 ⇒ 判据非恒真）
    const rejectCases = touchSurfaceCases.filter((c) => c.expectTarget === 'reject');
    expect(rejectCases.length).toBeGreaterThan(0);
    for (const c of rejectCases) {
      const target = verdictOf(c);
      const oracle = oracleOf(c);
      if (target.ok || oracle.ok) continue;
      expect(target.issues.length, `${c.id} 目标 issue 数 < oracle issue 数（只报目标键位）`).toBeLessThan(oracle.issues.length);
    }
  });
});

// ── F. fast path 闸门（ADR 0034 决策 1；非闸门计划 fail closed）───────────────

describe('#440 F fast path 闸门 fail closed', () => {
  it('F1 闸门前提：record 计划 = kind=record ∧ node 为 Record 形态（含 <key> 槽）；parent 计划 = kind=parent ∧ 封闭对象形态', () => {
    const hasKeySlot = (plan: MutationBoundaryPlan): boolean =>
      plan.node.kind === 'object' && plan.node.fields.some((f) => f.name === '<key>');
    for (const c of equivalenceCases) {
      const plan = planForCase(derived, c);
      expect(plan.relPath.length, `${c.id} relPath 长度`).toBe(1);
      expect(plan.node.kind, `${c.id} node.kind`).toBe('object');
      if (plan.kind === 'record') {
        expect(hasKeySlot(plan), `${c.id} Record 形态含 <key> 槽`).toBe(true);
      } else {
        expect(plan.kind, `${c.id} 计划种类`).toBe('parent');
        expect(hasKeySlot(plan), `${c.id} 封闭对象形态无 <key> 槽`).toBe(false);
      }
      // 闸门内的计划必须被接缝接管（可含拒绝，但不得因闸门误判而崩）
      const result = callOf(plan, Object.hasOwn(c.base, targetKeyOf(plan)), c.payload);
      expect(typeof result.ok, `${c.id} 接缝返回判别联合`).toBe('boolean');
    }
  });

  it('F2 union map 位（maybe）永久 legacy：节点 kind=union ⇒ 新接缝不静默接受', () => {
    const unionPlan = unionMapPlan(derived);
    expect(unionPlan.kind).toBe('union');
    expect(unionPlan.node.kind).toBe('union');
    const rejected = callOf(unionPlan, false, { op: 'set', value: ivLegal('item') });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.issues.length).toBeGreaterThan(0);
    const deletePlan = planFor(derived, ['maybe', 'm1'], 'delete');
    const rejectedDelete = callOf(deletePlan, true, { op: 'delete' });
    expect(rejectedDelete.ok).toBe(false);
    // legacy 轨照常工作（只锚「有可用轨道」）
    expect(oracleOf(caseOf(['maybe'], 'm1', {}, { op: 'set', value: ivLegal('item') })).ok).toBe(true);
    expect(oracleOf(caseOf(['maybe'], 'm1', { m1: ivLegal('item') }, { op: 'delete' })).ok).toBe(true);
  });

  it('F3 非闸门计划（target / array / 手造 kind / relPath ≠ [key]）一律 fail closed（不静默 ok）', () => {
    const recordPlan = planFor(derived, ['tasks', 't1'], 'set');
    const parentPlan = planFor(derived, ['obj', 'opt'], 'delete');
    const targetPlan = planFor(derived, ['obj', 'req'], 'set');
    expect(targetPlan.kind).toBe('target');
    const cases: Array<{ id: string; plan: MutationBoundaryPlan; payload: EntryMutationPayload }> = [
      { id: 'target 计划（封闭对象字段 set）', plan: targetPlan, payload: { op: 'set', value: 'x' } },
      { id: '手造 kind=union', plan: { ...recordPlan, kind: 'union' }, payload: { op: 'set', value: ivLegal('item') } },
      { id: '手造 kind=array', plan: { ...recordPlan, kind: 'array' }, payload: { op: 'set', value: ivLegal('item') } },
      { id: '手造 kind=target', plan: { ...recordPlan, kind: 'target' }, payload: { op: 'set', value: ivLegal('item') } },
      { id: 'parent 位不接受 set', plan: parentPlan, payload: { op: 'set', value: 1 } },
      { id: '手造 relPath 长度 2', plan: { ...recordPlan, prefix: [], relPath: [...recordPlan.prefix, ...recordPlan.relPath] }, payload: { op: 'set', value: ivLegal('item') } },
    ];
    for (const c of cases) {
      const result = callOf(c.plan, false, c.payload);
      expect(result.ok, `${c.id} 必须 fail closed`).toBe(false);
      if (!result.ok) expect(result.issues.length, `${c.id} 必须响亮带 issue`).toBeGreaterThan(0);
    }
    // 载荷形状违约（数组载荷混入）也必须 fail closed（不抛、不静默 ok）
    const badPayload = callOf(recordPlan, false, { op: 'array-insert', index: 0, values: [] } as unknown as EntryMutationPayload);
    expect(badPayload.ok).toBe(false);
  });
});

// ── 夹具辅助（本文件内）──────────────────────────────────────────────────────

function caseOf(
  path: readonly (string | number)[],
  key: string,
  base: Record<string, unknown>,
  payload: EntryMutationPayload,
): EntryCase {
  return { id: `inline-${path.join('.')}-${key}`, path, key, base, payload, expectTarget: 'accept', note: '契约内联用例' };
}

function resultVerdict(result: ValidateResult): Verdict {
  if (result.ok) return { ok: true, issues: [] };
  return { ok: false, issues: result.issues.map((issue) => ({ message: issue.message, path: [...issue.path] })) };
}
