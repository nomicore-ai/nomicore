/**
 * SA6 最小复现 / 诊断探针 — issue #440（ADR 0034「Record 与封闭对象 delete 逐 entry 校验」）：
 * 「vfsl 逐 entry 判定接缝扩展到 Record 与封闭对象 delete」的能力缺口 + 目标行为可达性 +
 * 判据敏感性 + 立法前提。
 *
 * 这是**诊断与验收契约的可执行证据**，不是 issue #440 的交付实现（交付 = 验收契约测试
 * `packages/vfsl/test/issue-440-elementwise-entry-{contract,control}.test.ts` + 一致性夹具
 * `packages/vfsl/test/issue-440-elementwise-entry-fixture.ts` + 类型契约 `.test-d.ts`）。
 * 本文件不在 vitest include 面内（`wiki/raw/**`），只作探针运行。
 *
 * 运行（真实源码；期望 GAP 全数成立 + REF/ORACLE/NC/X 全绿，exit 0）：
 *   NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx \
 *     wiki/raw/task_issue-440_sa6_capability_probe.mts
 *
 * 检查 id（与契约报告 §5/§9/§12 对应）：
 *   G1 公共面无逐 entry 容器接缝（导出普查；运行时反射，非源码 grep）
 *   G2 legacy 边界接缝必须消费「整 map / 父对象提取值」：以在场事实 {has} 代 boundaryBase
 *      一律拒绝（record set / record delete / parent delete 三支）
 *   G3 规划闸门：Record set/delete kind=record、封闭对象 delete kind=parent（relPath=[key]、
 *      node.kind=object）；union map 位 kind=union；未声明键 delete 在规划层即拒（结构面）
 *   G4 现状语义快照：键 Pattern message+path、非法新值 rebase 路径、必填 delete message、
 *      no-op message、optional/unknown delete 允许、键违规不阻断值校验（全收集序）
 *   G5 立法前提（ADR 0034 决策 5 绿侧）：Record 层无 map 级约束——大 map（200 entry）整体
 *      接受、entry 级非法仍响亮拒绝（构建 ROOT 全量快照）
 *   REF 见证实现（纯公共导出构造）：逐 entry 语义 = 单 entry map 视图过 legacy 边界判定
 *      （record）/ 静态必填判定（parent）+ no-op 域规则
 *   O1 等价性可达：REF(witness) 与全量 oracle 在等价集上逐字节一致（含接受/拒绝两支）
 *   O2 REF 命中夹具期望：夹具生成器的期望与真实语义一致（防夹具自欺）
 *   O3 判据敏感性：触达面组（污染在目标键位之外）上 REF 与 oracle 逐字节可分（比较非空转）
 *   NC1 现状触达面锚：触达面组在 legacy 轨一律连带拒绝（ADR 0034 决策 4 对照基线）
 *   NC2 既有接缝在场锚：`applyElementwiseArrayMutation`（#435/ADR 0033）逐字不变
 */
import { strict as assert } from 'node:assert';
import * as vfsl from '../../packages/vfsl/src/index.js';
import type { DerivedSchema, MutationBoundaryPlan, ValueSchema } from '../../packages/vfsl/src/index.js';
import {
  ENTRY_SCHEMA_TEXT,
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
  targetKeyOf,
  unionMapPlan,
  verdictBytes,
  withoutField,
} from '../../packages/vfsl/test/issue-440-elementwise-entry-fixture.js';
import type { EntryCase, EntryMutationPayload, Verdict, VerdictIssue } from '../../packages/vfsl/test/issue-440-elementwise-entry-fixture.js';

type TargetResult = { ok: true } | { ok: false; issues: readonly VerdictIssue[] };
type RefFn = (
  derived: DerivedSchema,
  plan: MutationBoundaryPlan,
  facts: { readonly has: boolean },
  payload: EntryMutationPayload,
) => TargetResult;

const failures: string[] = [];
const lines: string[] = [];

function log(line: string): void {
  lines.push(line);
  process.stdout.write(line + '\n');
}

function check(id: string, condition: boolean, detail?: string): void {
  if (condition) {
    log(`  ok   ${id}`);
  } else {
    failures.push(id);
    log(`  FAIL ${id}${detail === undefined ? '' : ` — ${detail}`}`);
  }
}

function bytes(value: unknown): string {
  return JSON.stringify(value);
}

// ── 见证实现（纯公共导出；仅用于证明目标语义可表达、可满足）────────────────────
// record set：单 entry map 视图（base = {}）过既有 legacy 边界判定 → 恰为该 entry 的逐字判决；
// record delete：仅在场域规则；parent delete：schema 静态必填判定 + 在场域规则。
function witness(derived: DerivedSchema, plan: MutationBoundaryPlan, base: Record<string, unknown>, payload: EntryMutationPayload): Verdict {
  const key = targetKeyOf(plan);
  const has = Object.hasOwn(base, key);
  if (plan.kind === 'record') {
    if (payload.op === 'delete') {
      if (!has) return { ok: false, issues: [{ message: 'delete 目标键不存在（拒绝 no-op）', path: [...plan.prefix, key] }] };
      return { ok: true, issues: [] };
    }
    const applied = vfsl.applyMutationAtBoundary(derived, plan, {}, { op: 'set', value: payload.value });
    if (applied.ok) return { ok: true, issues: [] };
    const failure = applied.result;
    if (failure.ok) return { ok: true, issues: [] };
    return { ok: false, issues: failure.issues.map((issue) => ({ message: issue.message, path: [...issue.path] })) };
  }
  if (plan.kind !== 'parent') {
    return { ok: false, issues: [{ message: `见证实现不支持 plan.kind=${plan.kind}`, path: [...plan.prefix, ...plan.relPath] }] };
  }
  if (!has) return { ok: false, issues: [{ message: 'delete 目标键不存在（拒绝 no-op）', path: [...plan.prefix, key] }] };
  const node = plan.node;
  if (node.kind !== 'object') {
    return { ok: false, issues: [{ message: `见证实现要求 node.kind=object（实际 ${node.kind}）`, path: [...plan.prefix, key] }] };
  }
  const field = node.fields.find((f) => f.name === key);
  if (field === undefined) {
    return { ok: false, issues: [{ message: `字段 ${key} 未声明（规划层不应达）`, path: [...plan.prefix, key] }] };
  }
  const unwrapped: ValueSchema = field.value.kind === 'optional' ? field.value.value : field.value;
  const required = field.value.kind !== 'optional';
  const unknownScalar = unwrapped.kind === 'scalar' && unwrapped.type === 'unknown';
  if (required && !unknownScalar) {
    return { ok: false, issues: [{ message: `缺少必填字段 "${key}"`, path: [...plan.prefix, key] }] };
  }
  return { ok: true, issues: [] };
}

function refVerdict(derived: DerivedSchema, c: EntryCase): Verdict {
  return witness(derived, planForCase(derived, c), c.base, c.payload);
}

function oracleVerdict(derived: DerivedSchema, c: EntryCase): Verdict {
  return legacyVerdict(derived, planForCase(derived, c), c.base, c.payload);
}

const derived = entrywiseDerived();
const equivalenceCases = buildEquivalenceCases();
const touchSurfaceCases = buildTouchSurfaceCases();

log(`# SA6 issue #440 探针（ADR 0034；HEAD 能力缺口 + 目标语义可达性）`);
log(`schema 别名：${Object.keys(derived.values).join(', ')}`);

// ── G1 公共面无逐 entry 容器接缝（运行时反射）────────────────────────────────
log('\n[G1] 公共面导出普查（运行时反射）');
const surface = vfsl as unknown as Record<string, unknown>;
const runtimeExports = Object.keys(vfsl).sort();
log(`  运行时导出（${runtimeExports.length}）：${runtimeExports.join(', ')}`);
const elementwiseExports = runtimeExports.filter((k) => /elementwise/i.test(k));
log(`  /elementwise/i 命中：${elementwiseExports.join(', ') || '(无)'}`);
check(
  'G1.1 公共面无 Record/parent 逐 entry 接缝（applyElementwiseEntryMutation 缺席）',
  typeof surface['applyElementwiseEntryMutation'] === 'undefined',
  `typeof=${typeof surface['applyElementwiseEntryMutation']}`,
);
check(
  'G1.2 唯一逐元素接缝是数组位 applyElementwiseArrayMutation（ADR 0033，#435）',
  elementwiseExports.length === 1 && elementwiseExports[0] === 'applyElementwiseArrayMutation',
  elementwiseExports.join(','),
);
check('G1.3 全量 oracle 接缝在场（applyMutationAtBoundary / planMutationBoundary）', typeof vfsl.applyMutationAtBoundary === 'function' && typeof vfsl.planMutationBoundary === 'function');

// ── G2 legacy 接缝的输入契约 = 整 map / 父对象提取值 ─────────────────────────
log('\n[G2] legacy 以在场事实 {has} 代 boundaryBase（三支）');
{
  const factsBase = { has: true };
  const recordSetPlan = planFor(derived, ['tasks', 't3'], 'set');
  const recordDeletePlan = planFor(derived, ['tasks', 't1'], 'delete');
  const parentDeletePlan = planFor(derived, ['obj', 'req'], 'delete');
  const g2a = legacyVerdict(derived, recordSetPlan, factsBase, { op: 'set', value: ivLegal('item') });
  const g2b = legacyVerdict(derived, recordDeletePlan, factsBase, { op: 'delete' });
  const g2c = legacyVerdict(derived, parentDeletePlan, factsBase, { op: 'delete' });
  log(`  record set  + {has:true} → ${verdictBytes(g2a)}`);
  log(`  record del  + {has:true} → ${verdictBytes(g2b)}`);
  log(`  parent del  + {has:true} → ${verdictBytes(g2c)}`);
  check(
    'G2.1 record set：事实对象被当作 map 内容整体校验（响亮拒绝，非静默接受）',
    !g2a.ok && verdictBytes(g2a).includes('"tasks","has"'),
    verdictBytes(g2a),
  );
  check(
    'G2.2 record delete：在场事实不足以判定（Object.hasOwn({has},key)=false → no-op 拒绝）',
    !g2b.ok && verdictBytes(g2b).includes('delete 目标键不存在'),
    verdictBytes(g2b),
  );
  check(
    'G2.3 parent delete：同理 no-op 拒绝——legacy 的必填判定绑在父值重建后',
    !g2c.ok && verdictBytes(g2c).includes('delete 目标键不存在'),
    verdictBytes(g2c),
  );
}

// ── G3 规划闸门（record / parent / union / 结构面拒绝）────────────────────────
log('\n[G3] planMutationBoundary 形状（闸门前提）');
{
  const recordPlan = planFor(derived, ['tasks', 't1'], 'set');
  const recordDelete = planFor(derived, ['tasks', 't1'], 'delete');
  const parentPlan = planFor(derived, ['obj', 'opt'], 'delete');
  const unionPlan = unionMapPlan(derived);
  const unknownKey = vfsl.planMutationBoundary(derived, ['obj', 'ghost'], 'delete');
  log(`  record set   → kind=${recordPlan.kind} prefix=${bytes(recordPlan.prefix)} relPath=${bytes(recordPlan.relPath)} node.kind=${recordPlan.node.kind}`);
  log(`  record delete→ kind=${recordDelete.kind} prefix=${bytes(recordDelete.prefix)} relPath=${bytes(recordDelete.relPath)}`);
  log(`  parent delete→ kind=${parentPlan.kind} prefix=${bytes(parentPlan.prefix)} relPath=${bytes(parentPlan.relPath)} node.kind=${parentPlan.node.kind}`);
  log(`  union map set→ kind=${unionPlan.kind} node.kind=${unionPlan.node.kind}`);
  log(`  未声明键 delete → ${unknownKey.ok ? 'PLAN-OK' : bytes(unknownKey.result)}`);

  const slot = (p: MutationBoundaryPlan): boolean => p.node.kind === 'object' && p.node.fields.some((f) => f.name === '<key>');
  check('G3.1 Record set/delete：kind=record、relPath=[key]、node 为 Record 形态（含 <key> 槽）', recordPlan.kind === 'record' && recordDelete.kind === 'record' && recordPlan.relPath.length === 1 && slot(recordPlan) && slot(recordDelete));
  check('G3.2 封闭对象 delete：kind=parent、relPath=[key]、node 为封闭对象形态（无 <key> 槽）', parentPlan.kind === 'parent' && parentPlan.relPath.length === 1 && parentPlan.node.kind === 'object' && !slot(parentPlan));
  check('G3.3 union map 位（Record<string,Item> | {fixed:string}）：kind=union ∧ node.kind=union ⇒ 永久 legacy 轨', unionPlan.kind === 'union' && unionPlan.node.kind === 'union');
  check('G3.4 未声明键 delete 在规划层即拒（结构面：封闭对象不接受未声明键）', !unknownKey.ok && bytes(unknownKey).includes('未知字段 \\"ghost\\"'));
  void RECORD_PATH_SPECS;
  void PARENT_PATH_SPECS;
}

// ── G4 现状语义快照（兼容面：目标接缝必须逐字复现）────────────────────────────
log('\n[G4] legacy 语义快照（逐字）');
{
  const codesPlan = planFor(derived, ['codes', 'nope'], 'set');
  const g4a = legacyVerdict(derived, codesPlan, {}, { op: 'set', value: ivLegal('item') });
  const g4b = legacyVerdict(derived, codesPlan, {}, { op: 'set', value: ivIllegal('item') });
  const g4c = legacyVerdict(derived, planFor(derived, ['tasks', 't9'], 'set'), {}, { op: 'set', value: ivIllegal('item') });
  const g4d = legacyVerdict(derived, planFor(derived, ['obj', 'req'], 'delete'), objBase(), { op: 'delete' });
  const g4e = legacyVerdict(derived, planFor(derived, ['obj', 'opt'], 'delete'), withoutField(objBase(), 'opt'), { op: 'delete' });
  const g4f = legacyVerdict(derived, planFor(derived, ['obj', 'opt'], 'delete'), objBase(), { op: 'delete' });
  const g4g = legacyVerdict(derived, planFor(derived, ['obj', 'unk'], 'delete'), objBase(), { op: 'delete' });
  const g4h = legacyVerdict(derived, planFor(derived, ['blobs', 'b1'], 'set'), {}, { op: 'set', value: { label: 'l', n: 99 } });
  log(`  键 Pattern 违规（合法值）→ ${verdictBytes(g4a)}`);
  log(`  键 Pattern 违规 + 非法值 → ${verdictBytes(g4b)}`);
  log(`  非法新值（tasks/t9）→ ${verdictBytes(g4c)}`);
  log(`  必填 delete（obj/req）→ ${verdictBytes(g4d)}`);
  log(`  no-op delete（obj/opt 缺席）→ ${verdictBytes(g4e)}`);
  log(`  optional delete（obj/opt）→ ${verdictBytes(g4f)}`);
  log(`  unknown delete（obj/unk）→ ${verdictBytes(g4g)}`);
  log(`  值位 union（blobs/b1）→ ${verdictBytes(g4h)}`);
  check(
    'G4.1 键 Pattern message+path 冻结：`Record 键 "nope" 不满足 Pattern 正则 /^(id-[0-9]+)$/` @ ["codes","nope"]',
    verdictBytes(g4a) === '{"ok":false,"issues":[{"message":"Record 键 \\"nope\\" 不满足 Pattern 正则 /^(id-[0-9]+)$/","path":["codes","nope"]}]}',
    verdictBytes(g4a),
  );
  check(
    'G4.2 键违规不阻断值校验（全收集，序 = 键先值后）',
    !g4b.ok && g4b.issues.length === 2 && g4b.issues[0]!.path[1] === 'nope' && g4b.issues[1]!.path.join('/') === 'codes/nope/qty',
    verdictBytes(g4b),
  );
  check(
    'G4.3 非法新值 rebase：issue 落在 [...mapPath, key, ...值内路径]',
    !g4c.ok && g4c.issues[0]!.path.join('/') === 'tasks/t9/qty',
    verdictBytes(g4c),
  );
  check(
    'G4.4 必填 delete 逐字：`缺少必填字段 "req"` @ ["obj","req"]',
    verdictBytes(g4d) === '{"ok":false,"issues":[{"message":"缺少必填字段 \\"req\\"","path":["obj","req"]}]}',
    verdictBytes(g4d),
  );
  check(
    'G4.5 no-op delete 逐字：`delete 目标键不存在（拒绝 no-op）` @ ["obj","opt"]',
    verdictBytes(g4e) === '{"ok":false,"issues":[{"message":"delete 目标键不存在（拒绝 no-op）","path":["obj","opt"]}]}',
    verdictBytes(g4e),
  );
  check('G4.6 optional / unknown 字段 delete 允许（静态规则绿侧）', g4f.ok && g4g.ok, `${verdictBytes(g4f)} / ${verdictBytes(g4g)}`);
  check(
    'G4.7 值位 union（Item | Alt）在 legacy 轨照常仲裁（fast path 必须逐字复现）',
    !g4h.ok && g4h.issues[0]!.message.includes('联合成员 2/2'),
    verdictBytes(g4h),
  );
}

// ── G5 立法前提（ADR 0034 决策 5 绿侧）────────────────────────────────────────
log('\n[G5] 立法前提：Record 层无 map 级约束（大 map）');
{
  const tasks: Record<string, unknown> = {};
  for (let i = 0; i < 200; i++) tasks[legalKey(RECORD_PATH_SPECS[0]!, i)] = { name: `n${i}`, qty: i % 101 };
  const snapshot = {
    tasks,
    codes: {},
    blobs: {},
    maybe: { fixed: 'f' },
    outer: { inner: {} },
    obj: objBase(),
    panel: { node: panelBase() },
  };
  const clean = vfsl.validateLogicalSnapshot(derived, snapshot);
  const polluted = vfsl.validateLogicalSnapshot(derived, { ...snapshot, tasks: { ...tasks, t7: { name: 'n7', qty: 999 } } });
  log(`  200 entry 干净 map 整体校验 → ${clean.ok ? 'OK' : verdictBytes(clean)}`);
  log(`  单 entry 非法 → ${verdictBytes(polluted)}`);
  check('G5.1 大 Record（200 entry）整体接受：无键数上限 / 无跨键约束（决策 5 前提）', clean.ok, verdictBytes(clean));
  check('G5.2 entry 级非法仍响亮拒绝（立法非空转）', !polluted.ok && polluted.issues.some((i) => i.path.join('/') === 'tasks/t7/qty'), verdictBytes(polluted));
}

// ── REF/O1/O2：目标语义可达（见证 vs 全量 oracle）────────────────────────────
log('\n[REF] 见证实现（纯公共导出）');
const refFailures: string[] = [];
for (const c of equivalenceCases) {
  const oracle = oracleVerdict(derived, c);
  const ref = refVerdict(derived, c);
  if (verdictBytes(ref) !== verdictBytes(oracle)) refFailures.push(`${c.id}: ref=${verdictBytes(ref)} oracle=${verdictBytes(oracle)}`);
}
log(`  等价集 ${equivalenceCases.length} 例：ref vs oracle 逐字节不一致 ${refFailures.length} 例`);
for (const f of refFailures) log(`    ${f}`);
check('O1 等价性可达：见证与全量 oracle 在等价集上逐字节一致（接受/拒绝两支）', refFailures.length === 0, refFailures[0]);

const expectFailures: string[] = [];
const oracleConfineFailures: string[] = [];
for (const c of equivalenceCases) {
  const oracle = oracleVerdict(derived, c);
  if (oracle.ok !== (c.expectTarget === 'accept')) expectFailures.push(`${c.id}: expect=${c.expectTarget} oracle=${verdictBytes(oracle)}`);
  if (!issuesConfinedToTargetKey(oracle, planForCase(derived, c))) oracleConfineFailures.push(`${c.id}: ${verdictBytes(oracle)}`);
}
log(`  等价集登记期望 vs oracle 不一致 ${expectFailures.length} 例；oracle issue 越出目标键位前缀 ${oracleConfineFailures.length} 例`);
check('O2 REF 命中夹具期望（夹具不自欺）', expectFailures.length === 0, expectFailures[0]);
check('O2b 等价集纪律：oracle 判决只落在目标键位前缀（污染只在目标键位之内）', oracleConfineFailures.length === 0, oracleConfineFailures[0]);

// ── O3/NC1：判据敏感性 + 现状触达面锚 ───────────────────────────────────────
log('\n[O3/NC1] 触达面组（污染在目标键位之外）');
let distinguishable = 0;
let oracleRejects = 0;
let targetMismatch = 0;
for (const c of touchSurfaceCases) {
  const oracle = oracleVerdict(derived, c);
  const ref = refVerdict(derived, c);
  if (!oracle.ok) oracleRejects += 1;
  if (verdictBytes(ref) !== verdictBytes(oracle)) distinguishable += 1;
  if (ref.ok !== (c.expectTarget === 'accept')) targetMismatch += 1;
  log(`  ${c.id}: oracle=${oracle.ok ? 'OK' : 'REJECT'} target=${ref.ok ? 'OK' : 'REJECT'}`);
}
log(`  触达面组 ${touchSurfaceCases.length} 例：oracle 拒绝 ${oracleRejects}、ref/oracle 逐字节可分 ${distinguishable}、目标期望不符 ${targetMismatch}`);
check('O3 判据敏感性：触达面组 ref 与 oracle 全数逐字节可分（比较非空转）', distinguishable === touchSurfaceCases.length && touchSurfaceCases.length > 0);
check('NC1 现状触达面：legacy 轨对触达面组一律连带拒绝（决策 4 对照基线）', oracleRejects === touchSurfaceCases.length);
check('O3b 触达面组目标行为登记自洽（accept/reject 与静态判定一致）', targetMismatch === 0);

// ── NC2 既有接缝在场锚 ───────────────────────────────────────────────────────
log('\n[NC2] 既有接缝在场锚');
check('NC2.1 数组逐元素接缝（#435/ADR 0033）在场且为函数——本票只允许加法', typeof surface['applyElementwiseArrayMutation'] === 'function');
check(
  'NC2.2 公共面既有导出超集在场（23 个）',
  runtimeExports.length >= 23 && ['planMutationBoundary', 'applyMutationAtBoundary', 'validateLogicalSnapshot', 'validatePatch'].every((n) => typeof surface[n] === 'function'),
  String(runtimeExports.length),
);

// ── 收尾 ────────────────────────────────────────────────────────────────────
log('\n# 结论');
log(`  等价集：${equivalenceCases.length} 例（accept ${equivalenceCases.filter((c) => c.expectTarget === 'accept').length} / reject ${equivalenceCases.filter((c) => c.expectTarget === 'reject').length}）`);
log(`  触达面组：${touchSurfaceCases.length} 例（全部可判别）`);
log(`  schema 文本指纹（夹具冻结）：${ENTRY_SCHEMA_TEXT.length} 字符`);
log(`  失败检查：${failures.length === 0 ? '无' : failures.join(', ')}`);

assert.deepEqual(failures, [], `探针失败检查：${failures.join(', ')}`);
assert.ok(equivalenceCases.length >= 100, `等价集规模不足：${equivalenceCases.length}`);
log('  探针 exit 0（GAP + ORACLE + REF + NC 全数命中）');
