/**
 * SA6 最小复现 / 诊断探针 — issue #435（ADR 0033「YArray 数组操作逐元素校验」）：
 * 「vfsl 边界 mutation 判定支持数组逐元素校验」的能力缺口 + 目标行为可达性 + 判据敏感性。
 *
 * 这是**诊断与验收契约的可执行证据**，不是 issue #435 的交付实现（交付 = 验收契约测试
 * `packages/vfsl/test/issue-435-elementwise-array-{contract,control}.test.ts` + 一致性夹具
 * `packages/vfsl/test/issue-435-elementwise-array-fixture.ts`）。本文件不在 vitest include
 * 面内（`wiki/raw/**`），只作探针运行。
 *
 * 运行（真实源码；期望 GAP 全数成立 + ORACLE/NC 全绿，exit 0）：
 *   NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx \
 *     wiki/raw/task_issue-435_sa6_capability_probe.mts
 *
 * 检查 id（与契约报告 §5/§9/§12 对应）：
 *   G1 公共面无逐元素数组接缝（导出普查；运行时反射，非源码 grep）
 *   G2 legacy 边界接缝必须消费「整数组提取值」：以载体事实 {length} 代 boundaryBase 一律拒绝
 *   G3 legacy 数组写成本与数组长度耦合（O(n) 软证据：n=10^3 vs 10^5）
 *   G4 现状语义快照：insert/delete 域规则 message+path、批量 issue 序、污染数组 delete 拒绝
 *   G5 规划闸门：非 union 数组目标 plan.kind='array' 且 node.kind='array'；union 数组目标
 *      plan.kind='union'（永久 legacy 轨）；YPlainArray 目标被 array-* 规划拒绝
 *   REF 夹具侧见证实现（纯公共导出构造）：逐元素语义 = 独立合成 plan 逐值过 element 节点
 *   O1 等价性可达：REF(witness) 与全量 oracle 在等价集上逐字节一致（含接受/拒绝两支）
 *   O2 REF 命中夹具期望：夹具生成器的期望与真实语义一致（防夹具自欺）
 *   O3 判据敏感性：污染数组 delete 上 REF(accept) 与 oracle(reject) 逐字节可分（比较非空转）
 *   NC1 立法前提锚：VFSL v1 数组层无数组级约束（长数组/重复/无序照常接受）
 *   NC2 域规则逐字锚：legacy 越界 message 逐字节冻结
 */
import { strict as assert } from 'node:assert';
import { execSync } from 'node:child_process';
import * as vfsl from '../../packages/vfsl/src/index.js';
import type { DerivedSchema, MutationBoundaryPlan } from '../../packages/vfsl/src/index.js';
import {
  ARRAY_PATH_SPECS,
  ELEMENTWISE_SCHEMA_TEXT,
  buildEquivalenceCases,
  buildPollutedDeleteCases,
  elementwiseDerived,
  legacyVerdict,
  planFor,
  verdictBytes,
  verdictsEqual,
} from '../../packages/vfsl/test/issue-435-elementwise-array-fixture.js';
import type { ArrayMutationPayload, Verdict, VerdictIssue } from '../../packages/vfsl/test/issue-435-elementwise-array-fixture.js';

type TargetResult = { ok: true } | { ok: false; issues: readonly VerdictIssue[] };
type RefFn = (
  derived: DerivedSchema,
  plan: MutationBoundaryPlan,
  facts: { readonly length: number },
  payload: ArrayMutationPayload,
) => TargetResult;

const failures: string[] = [];
const lines: string[] = [];

function log(line: string): void {
  lines.push(line);
  process.stdout.write(line + '\n');
}

function check(id: string, condition: boolean, detail: string): void {
  if (condition) {
    log(`  [PASS] ${id} ${detail}`);
  } else {
    failures.push(`${id} ${detail}`);
    log(`  [FAIL] ${id} ${detail}`);
  }
}

function derivedOf(text: string): DerivedSchema {
  const parsed = vfsl.parseVfsl(text);
  if (!parsed.ok) throw new Error(`parseVfsl 失败: ${JSON.stringify(parsed.issues)}`);
  const evaluated = vfsl.evaluate(parsed.module);
  if (!evaluated.ok) throw new Error(`evaluate 失败: ${JSON.stringify(evaluated.issues)}`);
  return evaluated.derived;
}

// ── REF：夹具侧见证实现（纯公共导出；不是交付实现，只为证明等价性可达 + 判据敏感）──────
const refElementwise: RefFn = (derived, plan, facts, payload): TargetResult => {
  if (plan.kind !== 'array') return { ok: false, issues: [{ message: 'REF: 非 array 计划', path: [...plan.prefix, ...plan.relPath] }] };
  if (plan.node.kind !== 'array') return { ok: false, issues: [{ message: 'REF: 边界值节点非 array', path: [...plan.prefix] }] };
  const length = facts.length;
  const domainPath = [...plan.prefix, ...plan.relPath];
  if (payload.op === 'array-insert') {
    if (payload.index > length) {
      return { ok: false, issues: [{ message: 'array-insert index 越界（不 clamp）', path: [...domainPath, payload.index] }] };
    }
    const issues: VerdictIssue[] = [];
    for (let j = 0; j < payload.values.length; j++) {
      // 单元素校验：合成 kind='target' 计划（node = element 节点，relPath=[]，base 不被消费），
      // 即「逐元素过 element 子 schema + issue 按 [...arrayPath, index+j] rebase」的公共面等价式。
      const synthetic: MutationBoundaryPlan = {
        prefix: [...plan.prefix, payload.index + j],
        relPath: [],
        node: plan.node.element,
        kind: 'target',
      };
      const applied = vfsl.applyMutationAtBoundary(derived, synthetic, undefined, { op: 'set', value: payload.values[j] });
      if (!applied.ok) for (const issue of applied.result.issues) issues.push({ message: issue.message, path: issue.path });
    }
    return issues.length === 0 ? { ok: true } : { ok: false, issues };
  }
  if (payload.index >= length || payload.index + payload.count > length) {
    return {
      ok: false,
      issues: [{ message: 'array-delete 范围越界（不 clamp、不接受越界 no-op）', path: [...domainPath, payload.index] }],
    };
  }
  return { ok: true };
};

function asVerdict(result: TargetResult): Verdict {
  return result.ok ? { ok: true, issues: [] } : { ok: false, issues: result.issues.map((i) => ({ message: i.message, path: [...i.path] })) };
}

// ── E0 环境 ─────────────────────────────────────────────────────────────────
log(`E0 环境：node ${process.version} / head ${execSync('git rev-parse HEAD').toString().trim()}`);
const derived = elementwiseDerived();
log(`E0 夹具 schema：${ELEMENTWISE_SCHEMA_TEXT.replace(/\n/g, ' ').trim()}`);

// ── G1 公共面导出普查（逐元素接缝缺席）──────────────────────────────────────
log('\nG1 公共面导出普查（运行时反射）');
const surface = vfsl as unknown as Record<string, unknown>;
const exportNames = Object.keys(surface).sort();
log(`  exports(${exportNames.length}) = ${exportNames.join(', ')}`);
const elementwiseLike = exportNames.filter((n) => /elementwise|element_wise|elementWise/i.test(n));
check('G1.1', elementwiseLike.length === 0, `无任何 *elementwise* 命名导出（命中 ${JSON.stringify(elementwiseLike)}）`);
check(
  'G1.2',
  typeof surface['applyElementwiseArrayMutation'] !== 'function',
  `applyElementwiseArrayMutation 未导出（typeof=${typeof surface['applyElementwiseArrayMutation']}）`,
);
check(
  'G1.3',
  exportNames.includes('applyMutationAtBoundary') && exportNames.includes('planMutationBoundary'),
  'legacy 边界接缝在场（对照组存在）',
);

// ── G2 legacy 接缝必须消费整数组提取值 ──────────────────────────────────────
log('\nG2 legacy 边界接缝的边界提取依赖（载体事实不足以工作）');
for (const spec of ARRAY_PATH_SPECS.slice(0, 3)) {
  const plan = planFor(derived, spec.path, 'array-insert');
  const withFacts = vfsl.applyMutationAtBoundary(derived, plan, { length: 3 }, { op: 'array-insert', index: 0, values: [1] });
  const detail = withFacts.ok ? 'ok:true（!）' : `${withFacts.result.issues[0]!.message} path=${JSON.stringify(withFacts.result.issues[0]!.path)}`;
  check(
    `G2.1-${String(spec.path[spec.path.length - 1])}`,
    !withFacts.ok && withFacts.result.issues[0]!.message === 'array-insert 目标必须是数组' && withFacts.result.issues[0]!.path.length === spec.path.length,
    `以 {length} 代 boundaryBase → ok:false + 「${detail}」`,
  );
  const delPlan = planFor(derived, spec.path, 'array-delete');
  const delFacts = vfsl.applyMutationAtBoundary(derived, delPlan, { length: 3 }, { op: 'array-delete', index: 0, count: 1 });
  check(
    `G2.2-${String(spec.path[spec.path.length - 1])}`,
    !delFacts.ok && delFacts.result.issues[0]!.message === 'array-delete 目标必须是数组',
    'delete 同规：载体事实不足，必须整数组提取',
  );
}

// ── G3 规模耦合（软证据）──────────────────────────────────────────────────
function medianMs(fn: () => void, rounds: number): number {
  const samples: number[] = [];
  for (let i = 0; i < rounds; i++) {
    const t0 = process.hrtime.bigint();
    fn();
    samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)]!;
}
log('\nG3 legacy 成本与数组长度耦合（软证据，非契约断言）');
const numsDerived = derivedOf('type ROOT = { nums: YArray<number> };');
const numsPlan = planFor(numsDerived, ['nums'], 'array-insert');
const big1k = Array.from({ length: 1_000 }, (_, i) => i);
const big100k = Array.from({ length: 100_000 }, (_, i) => i);
const t1k = medianMs(() => { vfsl.applyMutationAtBoundary(numsDerived, numsPlan, big1k, { op: 'array-insert', index: 1_000, values: [1] }); }, 5);
const t100k = medianMs(() => { vfsl.applyMutationAtBoundary(numsDerived, numsPlan, big100k, { op: 'array-insert', index: 100_000, values: [1] }); }, 5);
const ratio = t100k / Math.max(t1k, 1e-6);
log(`  n=10^3 append: ${t1k.toFixed(3)}ms；n=10^5 append: ${t100k.toFixed(3)}ms；比值 ×${ratio.toFixed(1)}（100× 规模）`);
check('G3.1', ratio > 5, `整数组重建/整体校验成本随 n 增长（比值 ×${ratio.toFixed(1)} > 5）`);

// ── G4 现状语义快照（byte-exact）───────────────────────────────────────────
log('\nG4 现状语义快照（全量 oracle，逐字节）');
const itemsPlanIns = planFor(derived, ['items'], 'array-insert');
const itemsPlanDel = planFor(derived, ['items'], 'array-delete');
const itemBase = [{ name: 'a', qty: 1 }, { name: 'b', qty: 2 }];
const insIllegal = legacyVerdict(derived, itemsPlanIns, itemBase, { op: 'array-insert', index: 1, values: [{ name: 'z', qty: 'bad' }] });
log(`  insert 非法新值（index=1）→ ${verdictBytes(insIllegal)}`);
check(
  'G4.1',
  !insIllegal.ok && insIllegal.issues.length === 1 && JSON.stringify(insIllegal.issues[0]!.path) === '["items",1,"qty"]',
  '非法新元素 issue 路径 = [...arrayPath, index+j, ...elementIssuePath]',
);
const insOverflow = legacyVerdict(derived, itemsPlanIns, itemBase, { op: 'array-insert', index: 3, values: [{ name: 'z', qty: 1 }] });
log(`  insert index>len → ${verdictBytes(insOverflow)}`);
check(
  'G4.2',
  !insOverflow.ok && insOverflow.issues[0]!.message === 'array-insert index 越界（不 clamp）' && JSON.stringify(insOverflow.issues[0]!.path) === '["items",3]',
  '域规则 message/path 冻结',
);
const batch = legacyVerdict(derived, itemsPlanIns, itemBase, { op: 'array-insert', index: 1, values: [{ name: 'z', qty: 101 }, { name: 'ok', qty: 1 }, { name: 'n' }] });
log(`  批量两处非法 → ${verdictBytes(batch)}`);
check(
  'G4.3',
  !batch.ok && batch.issues.length === 2 && JSON.stringify(batch.issues.map((i) => i.path)) === '[[\"items\",1,\"qty\"],[\"items\",3,\"qty\"]]',
  '批量一次判定 + issue 序 = 插入位置升序',
);
const delOverflow = legacyVerdict(derived, itemsPlanDel, itemBase, { op: 'array-delete', index: 1, count: 2 });
log(`  delete 范围越界 → ${verdictBytes(delOverflow)}`);
check(
  'G4.4',
  !delOverflow.ok && delOverflow.issues[0]!.message === 'array-delete 范围越界（不 clamp、不接受越界 no-op）' && JSON.stringify(delOverflow.issues[0]!.path) === '["items",1]',
  'delete 域规则 message/path 冻结',
);
const pollutedDelete = legacyVerdict(derived, itemsPlanDel, [{ name: 'a', qty: 1 }, { name: 'x', qty: 999 }, { name: 'b', qty: 2 }], { op: 'array-delete', index: 0, count: 1 });
log(`  污染数组 delete（变更区间外非法）→ ${verdictBytes(pollutedDelete)}`);
check('G4.5', !pollutedDelete.ok, '现状：delete 触达整数组 → 对被污染数组响亮拒绝');

// ── G5 规划闸门 ────────────────────────────────────────────────────────────
log('\nG5 规划闸门（kind=array 且节点 kind=array；union 永久 legacy）');
for (const spec of ARRAY_PATH_SPECS) {
  const p = planFor(derived, spec.path, 'array-insert');
  check(
    `G5.1-${String(spec.path[spec.path.length - 1])}`,
    p.kind === 'array' && p.node.kind === 'array' && p.relPath.length === 0,
    `kind=${p.kind} node.kind=${p.node.kind} prefix=${JSON.stringify(p.prefix)} relPath=${JSON.stringify(p.relPath)}`,
  );
}
const unionPlan = planFor(derived, ['uarr'], 'array-insert');
const unionLegacy = vfsl.applyMutationAtBoundary(derived, unionPlan, [{ name: 'a', qty: 1 }], {
  op: 'array-insert',
  index: 1,
  values: [{ name: 'b', qty: 2 }],
});
log(
  `  uarr：plan.kind=${unionPlan.kind} node.kind=${unionPlan.node.kind} prefix=${JSON.stringify(unionPlan.prefix)}；legacy 该 plan → ${unionLegacy.ok ? 'ok:true' : 'ok:false'}`,
);
check(
  'G5.2',
  unionPlan.kind === 'array' && unionPlan.node.kind === 'union',
  `union 数组目标：plan.kind=array 但边界值节点 kind=${unionPlan.node.kind}（ADR 0033 决策 1 第二条件排除，永久 legacy 轨）`,
);
check('G5.2b', unionLegacy.ok, 'legacy 轨对 union 数组目标照常工作（any-of 整体验证）');
for (const spec of ARRAY_PATH_SPECS) {
  const p = planFor(derived, spec.path, 'array-insert');
  check(
    `G5.4-${String(spec.path[spec.path.length - 1])}`,
    p.kind === 'array' && p.node.kind === 'array' && p.node.element !== undefined,
    'fast path 闸门双条件成立：plan.kind=array ∧ node.kind=array ∧ node.element 在场',
  );
}
const plainDerived = derivedOf('type ROOT = { xs: YPlainArray<string> };');
const plainPlanned = vfsl.planMutationBoundary(plainDerived, ['xs'], 'array-insert');
check(
  'G5.3',
  !plainPlanned.ok && (plainPlanned.ok ? '' : plainPlanned.result.issues[0]!.message).includes('YPlainArray'),
  'YPlainArray 目标 array-* 规划拒绝（载体范围限定可运行时观测）',
);

// ── O1/O2 等价性可达 + 夹具自洽 ─────────────────────────────────────────────
log('\nO1 夹具侧见证实现 vs 全量 oracle（等价集逐字节）');
const equivalence = buildEquivalenceCases();
let agree = 0;
let refAccept = 0;
let legacyAccept = 0;
const mismatches: string[] = [];
for (const c of equivalence) {
  const plan = planFor(derived, c.path, c.payload.op);
  const oracle = legacyVerdict(derived, plan, c.base, c.payload);
  const witness = asVerdict(refElementwise(derived, plan, { length: c.base.length }, c.payload));
  if (verdictsEqual(oracle, witness)) agree += 1;
  else mismatches.push(`${c.id}: oracle=${verdictBytes(oracle)} witness=${verdictBytes(witness)}`);
  if (oracle.ok) legacyAccept += 1;
  if (witness.ok) refAccept += 1;
}
log(`  用例数=${equivalence.length}；逐字节一致=${agree}；接受支 oracle=${legacyAccept}/witness=${refAccept}`);
if (mismatches.length > 0) log(`  不一致样例：${mismatches.slice(0, 5).join(' | ')}`);
check('O1.1', equivalence.length >= 100, `等价集规模 ${equivalence.length} ≥ 100（参数化 + 确定性随机）`);
check('O1.2', agree === equivalence.length, `见证实现与全量 oracle 全数逐字节一致（${agree}/${equivalence.length}）`);
check('O1.3', legacyAccept > 0 && legacyAccept < equivalence.length, `接受/拒绝两支均覆盖（accept=${legacyAccept}, reject=${equivalence.length - legacyAccept}）`);
const opsCovered = new Set(equivalence.map((c) => c.payload.op));
const pathsCovered = new Set(equivalence.map((c) => JSON.stringify(c.path)));
check('O1.4', opsCovered.size === 2 && pathsCovered.size === ARRAY_PATH_SPECS.length, `op 覆盖 ${[...opsCovered].join('/')}；路径覆盖 ${pathsCovered.size}`);
let expectHit = 0;
for (const c of equivalence) {
  const plan = planFor(derived, c.path, c.payload.op);
  const witness = asVerdict(refElementwise(derived, plan, { length: c.base.length }, c.payload));
  if ((witness.ok ? 'accept' : 'reject') === c.expectTarget) expectHit += 1;
}
check('O2.1', expectHit === equivalence.length, `夹具期望与真实语义一致（${expectHit}/${equivalence.length}）`);

// ── O3 判据敏感性 ──────────────────────────────────────────────────────────
log('\nO3 判据敏感性（比较必须能看见真实差异）');
const polluted = buildPollutedDeleteCases();
let sensitive = 0;
for (const c of polluted) {
  const plan = planFor(derived, c.path, c.payload.op);
  const oracle = legacyVerdict(derived, plan, c.base, c.payload);
  const witness = asVerdict(refElementwise(derived, plan, { length: c.base.length }, c.payload));
  if (!oracle.ok && witness.ok && !verdictsEqual(oracle, witness)) sensitive += 1;
}
check('O3.1', polluted.length > 0 && sensitive === polluted.length, `污染 delete：oracle 拒绝 / 逐元素成功，逐字节可分（${sensitive}/${polluted.length}）`);
const legalA = legacyVerdict(derived, itemsPlanIns, itemBase, { op: 'array-insert', index: 1, values: [{ name: 'z', qty: 1 }] });
const legalB = legacyVerdict(derived, itemsPlanIns, itemBase, { op: 'array-insert', index: 1, values: [{ name: 'z', qty: 101 }] });
check('O3.2', legalA.ok && !legalB.ok && !verdictsEqual(legalA, legalB), '合法/非法 insert 的判据字节可分（比较面非恒真）');

// ── NC 立法前提 + 域规则锚 ─────────────────────────────────────────────────
log('\nNC 立法前提与域规则锚（恒绿面）');
const anchorDerived = derivedOf('type ROOT = { nums: YArray<number>; tags: YArray<string> };');
const longRoot = { nums: Array.from({ length: 300 }, (_, i) => i % 7), tags: ['b', 'a', 'b', 'b', 'a'] };
const anchor = vfsl.validateLogicalSnapshot(anchorDerived, longRoot);
check('NC1.1', anchor.ok, `长数组/重复/无序照常接受（数组层无长度/唯一性/有序性约束）：${JSON.stringify(anchor)}`);
const anchorBad = vfsl.validateLogicalSnapshot(anchorDerived, { nums: [1, 2, 'x'], tags: [] });
check(
  'NC1.2',
  !anchorBad.ok && JSON.stringify(anchorBad.issues[0]!.path) === '["nums",2]',
  `元素级非法仍响亮拒绝（锚非空转）：${JSON.stringify(anchorBad.ok ? [] : anchorBad.issues.map((i) => i.path))}`,
);
check(
  'NC2.1',
  !legacyVerdict(derived, itemsPlanDel, [], { op: 'array-delete', index: 0, count: 1 }).ok,
  '空数组 delete 域拒绝锚',
);
const countZero = legacyVerdict(derived, itemsPlanDel, itemBase, { op: 'array-delete', index: 0, count: 0 });
log(`  legacy 在界内 count=0 → ${verdictBytes(countZero)}（doc-runtime E3 不接受该形态；仅作现状快照，不进目标契约）`);

// ── DRY 契约干跑（以见证实现冒充目标接缝）──────────────────────────────────
// 目的：证明验收契约的**全部显式期望值可被忠实实现命中**（目标实现期望结果），
// 即红灯只卡在「公共面无该导出」这一能力缺口上，而不是契约自身写错。
log('\nDRY 契约干跑（见证实现 = 目标语义；逐条复算契约测试的显式期望）');
const itemsPlan = planFor(derived, ['items'], 'array-insert');
const insSpec0 = ARRAY_PATH_SPECS[0]!;
const w = (plan: MutationBoundaryPlan, base: readonly unknown[], payload: ArrayMutationPayload): TargetResult =>
  refElementwise(derived, plan, { length: base.length }, payload);
const itemBase2 = [{ name: 'a', qty: 1 }, { name: 'b', qty: 2 }];
const b2 = w(itemsPlan, itemBase2, { op: 'array-insert', index: 1, values: [{ name: 'ok', qty: 3 }, { name: 'bad', qty: 'x' }] });
check(
  'DRY-B2',
  !b2.ok && JSON.stringify(b2.issues.map((i) => i.path)) === '[[\"items\",2,\"qty\"]]',
  'insert index=1、j=1 → issue 路径 ["items",2,"qty"]',
);
const b3 = w(itemsPlan, itemBase2, { op: 'array-insert', index: 1, values: [{ name: 'x', qty: 101 }, { name: 'ok', qty: 1 }, { name: 'y' }] });
check(
  'DRY-B3',
  !b3.ok && JSON.stringify(b3.issues.map((i) => i.path)) === '[[\"items\",1,\"qty\"],[\"items\",3,\"qty\"]]',
  '批量两处非法 → 位置升序 issue 序',
);
const b5 = w(planFor(derived, ['nested', 'inner'], 'array-insert'), [{ name: 'a', qty: 1 }], { op: 'array-insert', index: 1, values: [{ name: 'b', qty: -1 }] });
check('DRY-B5', !b5.ok && JSON.stringify(b5.issues[0]!.path) === '[\"nested\",\"inner\",1,\"qty\"]', '嵌套路径绝对 rebase');
const b7a = w(planFor(derived, ['variants'], 'array-insert'), [{ label: 'l', n: 0 }], { op: 'array-insert', index: 1, values: [{ label: 'l', n: 11 }] });
check('DRY-B7a', !b7a.ok && JSON.stringify(b7a.issues[0]!.path) === '[\"variants\",1,\"n\"]', '全容器形联合元素（Item | Alt）逐元素');
const b7b = w(planFor(derived, ['scalars'], 'array-insert'), [1], { op: 'array-insert', index: 1, values: [null] });
check('DRY-B7b', !b7b.ok && JSON.stringify(b7b.issues[0]!.path) === '[\"scalars\",1]', '全标量形联合元素（string | number）逐元素');
let dryC = 0;
for (const spec of ARRAY_PATH_SPECS) {
  const plan = planFor(derived, spec.path, 'array-insert');
  const r = w(plan, [], { op: 'array-insert', index: 1, values: [1] });
  if (!r.ok && r.issues.length === 1 && r.issues[0]!.message === 'array-insert index 越界（不 clamp）' && JSON.stringify(r.issues[0]!.path) === JSON.stringify([...spec.path, 1])) dryC += 1;
}
check('DRY-C1', dryC === ARRAY_PATH_SPECS.length, `insert 越界 message/path 逐字（${dryC}/${ARRAY_PATH_SPECS.length}）`);
const dryC2 = w(planFor(derived, ['nums'], 'array-insert'), [1, 2], { op: 'array-insert', index: 9, values: [3] });
check('DRY-C2', !dryC2.ok && JSON.stringify(dryC2.issues[0]!.path) === '[\"nums\",9]', '不 clamp：index=9 拒绝');
let dryD = 0;
for (const spec of ARRAY_PATH_SPECS) {
  const plan = planFor(derived, spec.path, 'array-delete');
  const r = w(plan, [1], { op: 'array-delete', index: 1, count: 1 });
  if (!r.ok && r.issues.length === 1 && r.issues[0]!.message === 'array-delete 范围越界（不 clamp、不接受越界 no-op）' && JSON.stringify(r.issues[0]!.path) === JSON.stringify([...spec.path, 1])) dryD += 1;
}
check('DRY-D2', dryD === ARRAY_PATH_SPECS.length, `delete 越界 message/path 逐字（${dryD}/${ARRAY_PATH_SPECS.length}）`);
const dryD3 = w(planFor(derived, ['items'], 'array-delete'), itemBase2, { op: 'array-delete', index: 1, count: 2 });
check('DRY-D3', !dryD3.ok && dryD3.issues[0]!.message === 'array-delete 范围越界（不 clamp、不接受越界 no-op）' && JSON.stringify(dryD3.issues[0]!.path) === '[\"items\",1]', '范围越界：path 指向 index');
let dryAccept = 0;
for (const spec of ARRAY_PATH_SPECS) {
  const plan = planFor(derived, spec.path, 'array-insert');
  const r = w(plan, [], { op: 'array-insert', index: 0, values: [] });
  if (r.ok) dryAccept += 1;
}
check('DRY-F1', dryAccept === ARRAY_PATH_SPECS.length, `fast path 闸门计划上空批量恒等接受（${dryAccept}/${ARRAY_PATH_SPECS.length}）`);
const dryF2 = w(unionPlan, [{ name: 'a', qty: 1 }], { op: 'array-insert', index: 1, values: [{ name: 'b', qty: 2 }] });
check('DRY-F2', !dryF2.ok, 'union 数组目标（node.kind=union）→ 见证实现 fail closed');
const targetSetPlanned = vfsl.planMutationBoundary(derived, ['items'], 'set');
check(
  'DRY-F3a',
  targetSetPlanned.ok && targetSetPlanned.plan.kind === 'target' && targetSetPlanned.plan.node.kind === 'array',
  'set 目标位计划：kind=target、node.kind=array（闸门负例的前置锚）',
);
const dryF3 = w(targetSetPlanned.ok ? targetSetPlanned.plan : itemsPlan, [], { op: 'array-insert', index: 0, values: [] });
check('DRY-F3b', !dryF3.ok, '非 array 计划（kind=target）→ 见证实现 fail closed');

// ── 汇总 ───────────────────────────────────────────────────────────────────
log(`\n=== 汇总：GAP 5 组 + ORACLE 9 项 + NC 3 项；failures=${failures.length} ===`);
for (const f of failures) log(`  FAILURE: ${f}`);
process.exitCode = failures.length === 0 ? 0 : 1;
