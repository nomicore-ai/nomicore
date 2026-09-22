/**
 * ADR-0007 validated mutation bridge. Ordinary non-empty-path mutations run the
 * issue #237 local pipeline (mutation-local.ts): plan nearest semantic boundary
 * (vfsl planMutationBoundary) → live navigation with per-hop carrier/presence
 * checks → boundary-local extraction/rebuild/validation (vfsl
 * applyMutationAtBoundary) → detached construct → single guarded Yjs minimal
 * transaction → boundary-scoped post-commit verification (verifyPrepared: install-facts
 * for the non-union `T[]` fast path per ADR 0033 decision 3, boundary facts +
 * reprojection for the permanent legacy track).
 * The phase-1 precondition (committed ROOT legal before the call — logical
 * values + carrier topology) is documented in mutation-local.ts; the function
 * proves this mutation does not break the schema constraints it touches and no
 * longer scans/copies/validates data outside the touched path and boundary.
 * Only `set([])` keeps the legacy full-ROOT pipeline (extract → double full
 * logical validation → clone → guarded transaction → verifySnapshotIntact).
 *
 * ADR 0026 adds the mutually exclusive batch envelope `{ ops: [...] }`: envelope
 * validation (key closure / cardinality ≤ 16 / per-element reuse of the same
 * single-operation parse core / `set([])` element ban / pairwise non-nesting)
 * followed by per-operation prepare — any failure is an aggregated `ok:false`
 * with zero writes — then a composed expected boundary per item (shared
 * record/parent/union boundary siblings must not fake E201-C), one Yjs
 * transaction committing every minimal edit in order, and per-operation
 * boundary verification. Envelopes without an own `ops` key keep the exact
 * single-operation path (byte-identical frozen surface).
 *
 * ADR 0025 adds the optional single-condition `guard` to both envelope shapes'
 * *top level* (`{ op, path, ..., guard }` / `{ ops, guard }`; batch elements must
 * never carry `guard` — shape error): guard shape validation happens in the same
 * envelope parse (no stable code, zero writes, not retryable), evaluation happens
 * in the prepare phase after the parse and before the local/legacy fork (single)
 * or before per-operation prepare (batch) — a pure `readLogicalValueAtPath`
 * projection read of the committed carrier asserting `equals` (structural deep
 * equality) or `absent` (no value). A mismatch is a zero-write single issue
 * carrying the stable code `MUTATION_GUARD_MISMATCH` with `issue.path` = the
 * guard condition path (retryable CAS rejection); guard evaluation precedes
 * schema validation and never enters a Yjs transaction. Guard-less envelopes keep
 * byte-identical behavior (optional key only).
 */
import * as Y from 'yjs';
import type { BoundaryMutationPayload, DerivedSchema, MutationBoundaryPlan, StructureNode, ValidateResult } from '@nomicore/vfsl';
import { applyMutationAtBoundary, planMutationBoundary, validateLogicalSnapshot } from '@nomicore/vfsl';
import { extractYjsSnapshot, walk } from './extract.js';
import { assertOutermostTransactionContext } from './tx-guard.js';
import { buildDetachedValue, buildTopEntries } from './detached-build.js';
import { verifyInstall, verifySnapshotIntact, verifyPrepared } from './install-verify.js';
import type { VerifyPlan } from './install-verify.js';
import { carrierOf } from './carrier.js';
import { makeRefResolver } from './resolve.js';
import { DerivedInvariantError, DocRuntimeFatalError, transactGuarded } from './fatal.js';
import { prepareLocalMutation } from './mutation-local.js';
import { readLogicalValueAtPath } from './read.js';
import type { ReadLogicalValueResult } from './read.js';

export interface MutationIssue {
  message: string;
  path: Array<string | number>;
  /** 模块稳定码；键缺席 = 无码信封/形状错误（不可重试）。现役值：MUTATION_GUARD_MISMATCH。 */
  code?: string;
}

/** ADR 0025 稳定码（doc-runtime 首个领域拒绝稳定码）：guard 评估不满足——零写入单 issue、
 *  `issue.path` = guard 条件路径、可重试（CAS 竞争拒绝）。形状错误族一律键缺席（不可重试）。 */
export const MUTATION_GUARD_MISMATCH = 'MUTATION_GUARD_MISMATCH';

export type MutationPath = readonly (string | number)[];
export type ValidatedMutation =
  | { op: 'set'; path: MutationPath; value: unknown }
  | { op: 'delete'; path: MutationPath }
  | { op: 'array-insert'; path: MutationPath; index: number; values: readonly unknown[] }
  | { op: 'array-delete'; path: MutationPath; index: number; count: number };

/** ADR 0025 条件写判别联合（定稿；ADR 0025 L23–27）：`equals` 结构深相等（undefined
 *  键过滤，与读取面缺席吸收一致）/ `absent` 无值，恰现其一；guard 路径段纪律同 mutation
 *  path，长度 ≥1（`[]` 属形状错误——ROOT 整树 CAS v1 拒绝）。
 *  `?: never` 为 ADR 判别联合的静态 fail-closed 收紧（exclusive-union 惯用法）：TS 联合的
 *  excess-property 检查不拒绝「某键存在于联合任一成员」的对象字面量，故字面联合会静态接纳
 *  `{equals, absent}` 同现；补 `?: never` 后与运行时 `parseGuard` ③a 拒绝面完全一致，且
 *  合法值集合不变（成员一的 `absent`、成员二的 `equals` 本就不存在）。 */
export type MutationGuard =
  | { path: readonly (string | number)[]; equals: unknown; absent?: never }
  | { path: readonly (string | number)[]; absent: true; equals?: never };

/** ADR 0025 单操作信封：四操作 + 可选顶层 guard（键缺席即现役无 guard 契约，逐字节不变）。
 *  `ops?: never` 为 ADR 0026 双形态互斥的静态 fail-closed 收紧（exclusive-union 惯用法，
 *  同 MutationGuard `?: never` 先例）：TS 联合 excess 检查不拒绝「键存在于联合任一成员」
 *  的字面量，双形态同现对象（{op,...,ops}）否则静态通过——运行时仍拒（唯一事实源），
 *  此处仅让常见双形态错误编译期可见。 */
export type GuardedMutation = ValidatedMutation & { guard?: MutationGuard; ops?: never };

export type ApplyValidatedMutationResult =
  | { ok: true }
  | { ok: false; issues: MutationIssue[] };

/** ADR 0026 批量信封（形态二）+ ADR 0025 顶层可选 guard。运行时约束（`ops` 非空、≤16、
 *  元素为完整单操作信封、**元素不得携带 `guard`**（0026 L29）、批内路径互不嵌套）由运行时
 *  信封校验承载；类型面只定型元素可静态约束，基数/嵌套约束不承载。guard 只允许出现在顶层。
 *  `op?: never` 同 GuardedMutation 的双形态互斥静态收紧（exclusive-union 惯用法）。 */
export type BatchedMutation = { ops: readonly ValidatedMutation[]; guard?: MutationGuard; op?: never };

/** ADR 0026 + ADR 0025 双形态信封联合：单操作对象（含可选顶层 guard）或批量信封（含可选
 *  顶层 guard）；两形态互斥（同现为形状错误）。 */
export type MutationEnvelope = GuardedMutation | BatchedMutation;

/** ADR 0026 `ops` 元素上限（冻结词表常量；不导出——放宽须过设计评审）。 */
const MAX_BATCH_OPS = 16;

type Path = Array<string | number>;
type ParsedMutation = ValidatedMutation & { path: Path; guard?: MutationGuard };
/** @internal 包内共享类型（issue #237：mutation-local.ts 消费；不经 index.ts 导出）。 */
export type PreparedCommit =
  | { kind: 'replace-root'; rootMap: Y.Map<unknown>; entries: Array<[string, unknown]> }
  | { kind: 'set'; parent: Y.Map<unknown>; key: string; value: unknown }
  | { kind: 'delete'; parent: Y.Map<unknown>; key: string }
  | { kind: 'array-insert'; target: Y.Array<unknown>; index: number; values: unknown[] }
  | { kind: 'array-delete'; target: Y.Array<unknown>; index: number; count: number };
type MutationPrepared =
  | { kind: 'legacy'; commit: PreparedCommit; proposed: unknown }
  | { kind: 'local'; commit: PreparedCommit; verify: VerifyPlan }
  | { kind: 'batch'; items: BatchItem[] }
  | { kind: 'fail'; issues: MutationIssue[] };
/** 批量 item：单事务提交项 + 已组合期望边界的验证输入（@internal 包内类型）。 */
interface BatchItem {
  commit: PreparedCommit;
  verify: VerifyPlan;
}
type PlaceResult = { kind: 'ok'; value: unknown } | { kind: 'issue'; issue: MutationIssue };
type StepResult = { kind: 'ok'; value: unknown } | { kind: 'issue'; issue: MutationIssue };
/** @internal 包内共享类型（issue #237：mutation-local.ts 换根导航消费）。 */
export type LiveStep = { live: unknown; node: StructureNode };

/** Apply one ADR-0007 set/delete/array-insert/array-delete operation synchronously.
 *  set([]) → legacy full-ROOT pipeline；普通非空路径 mutation → issue #237 局部管线
 *  （mutation-local.ts），成功写入保持单 guarded transaction + 最小 edit + 边界级
 *  提交后验证（无无条件完整 ROOT 重提重验）。ADR 0026 批量信封 `{ops:[...]}` 走
 *  逐操作 prepare → 单事务按序提交 → 逐操作边界验证（组合期望边界）。
 *  参数面类型化（MutationEnvelope，ADR 0025/0026 双形态）：字面量调用获得判别联合
 *  补全与 excess property fail-closed；动态构造信封（JSON 反序列化等）经
 *  `as MutationEnvelope` 显式断言退出静态检查——运行时信封校验（prepareMutation
 *  解析）仍是不合格信封的唯一事实源，静态收紧零运行时语义变化。 */
export function applyValidatedMutation(
  derived: DerivedSchema,
  doc: Y.Doc,
  mutation: MutationEnvelope,
): ApplyValidatedMutationResult {
  assertOutermostTransactionContext(doc, 'applyValidatedMutation');
  const ready = prepareMutation(derived, doc, mutation);
  if (ready.kind === 'fail') return { ok: false, issues: ready.issues };
  if (ready.kind === 'batch') {
    // ADR 0026：全部 prepare 成功 → 单 Yjs 事务内按序提交全部最小 edit（观察者要么见
    // 全部要么不见、单条 owned update bytes）→ 逐操作边界验证（期望边界已在阶段 C 组合）。
    transactGuarded(doc, () => {
      for (const item of ready.items) commitPrepared(item.commit);
    });
    for (const item of ready.items) verifyPrepared(item.verify);
    return { ok: true };
  }
  transactGuarded(doc, () => commitPrepared(ready.commit));
  if (ready.kind === 'legacy') {
    if (ready.commit.kind === 'replace-root') {
      verifyInstall({ rootMap: ready.commit.rootMap, entries: ready.commit.entries });
    }
    verifySnapshotIntact(derived, ready.proposed, doc);
  } else {
    // 局部管线：边界级提交后一致性验证（验证计划判别：fast path = install facts 单核 /
    // legacy 轨 = install facts + 边界重投影核；不重过 schema——ADR 0033 决策 3）
    verifyPrepared(ready.verify);
  }
  return { ok: true };
}

function prepareMutation(derived: DerivedSchema, doc: Y.Doc, mutation: unknown): MutationPrepared {
  try {
    // D1 信封分发：自有 `ops` 键（含 `{ops: undefined}`）→ 批量分支；其余（含非普通
    // 对象）→ 单操作分支。单操作路径经 parseMutation 原样消费，行为逐字节不变。
    const env = plainObjectOf(mutation);
    if (env !== null && Object.hasOwn(env, 'ops')) {
      return prepareBatchMutation(derived, doc, env);
    }
    const parsed = parseMutation(mutation);
    if (parsed.kind === 'fail') return parsed;
    if (derived.structure.kind !== 'root') {
      throw new DerivedInvariantError('derived.structure 非 root（手造派生物）');
    }
    // ADR 0025 L48–51：guard 评估在信封解析成功后、局部/legacy 分叉前、schema 校验之前；
    // 纯读 committed 载体（零写入、零事件）、不进事务；不满足 → 零写入单 issue（带稳定码）。
    if (parsed.mutation.guard !== undefined) {
      const verdict = evaluateGuard(doc, parsed.mutation.guard);
      if (verdict.kind === 'mismatch') return { kind: 'fail', issues: [verdict.issue] };
    }
    // set([]) 是唯一合法全量形态：legacy 完整 ROOT 管线原样（extract → 旧 ROOT 全量
    // 逻辑校验 → clone → applyToJson → proposed 全量校验 → 单事务 → verifyInstall +
    // verifySnapshotIntact）。其余全部走 issue #237 局部管线。
    const isRootReplace = parsed.mutation.op === 'set' && parsed.mutation.path.length === 0;
    if (!isRootReplace) {
      const local = prepareLocalMutation(derived, doc, parsed.mutation);
      if (local.kind === 'fail') return { kind: 'fail', issues: local.issues };
      return { kind: 'local', commit: local.commit, verify: local.verify };
    }
    const ex = extractYjsSnapshot(derived, doc);
    if (!ex.ok) return { kind: 'fail', issues: ex.issues };
    const logical = validateLogicalSnapshot(derived, ex.snapshot);
    if (!logical.ok) return { kind: 'fail', issues: logical.issues };

    const proposed = cloneJson(ex.snapshot);
    const placed = applyToJson(proposed, parsed.mutation);
    if (placed.kind === 'issue') return { kind: 'fail', issues: [placed.issue] };

    const validated = validateLogicalSnapshot(derived, placed.value);
    if (!validated.ok) return { kind: 'fail', issues: validated.issues };
    const commit = prepareCommit(derived, doc, parsed.mutation, ex.snapshot, placed.value);
    if (commit.kind === 'issue') return { kind: 'fail', issues: [commit.issue] };
    return { kind: 'legacy', commit: commit.commit, proposed: placed.value };
  } catch (err) {
    if (err instanceof DerivedInvariantError) {
      throw new DocRuntimeFatalError(
        'pre-commit-internal',
        false,
        `DOCRT-E204: 写前 internal 不变量破坏（${err.message}）——合规调用者不可达（派生物仅可由 evaluate 产出，此处为 internal 缺陷类）；本调用零写入（doc 状态不因本调用改变）；不补偿、不 fallback`,
        { cause: err },
      );
    }
    return failIssue([], `DOCRT-E205: applyValidatedMutation 内部错误（意外异常）:「${errDetailOf(err)}」`);
  }
}

/**
 * ADR 0026 批量分支（槽内 S5 位置不变）——信封校验 E1–E5 全部先于任何逐操作
 * prepare 与任何 live 读：任一步失败 = fail-fast 单 issue、无码、零写入。全部通过后
 * 逐操作 `prepareLocalMutation`（复用同一单操作管线；`set([])` 已被 E4 排除 ⇒ 元素
 * 只走局部最小 edit 管线），领域失败按 ops 顺序聚合后整体零写入；全部成功进入阶段 C
 * 组合期望边界（§7.5.2）。fatal（DerivedInvariantError / 意外异常）穿出至既有 catch
 * 分类（E204/E205），不进聚合。
 */
function prepareBatchMutation(
  derived: DerivedSchema,
  doc: Y.Doc,
  env: Record<string, unknown>,
): MutationPrepared {
  // ── E1 顶层键封闭：恰 {'ops'} ∪ 可选 'guard'（ADR 0025 L72–74：guard 适用于两种形态
  //        顶层）；`op` 同现 = 双形态；其余多余键 = 未知键 ────────────────────────────
  const extra = Object.keys(env).filter((key) => key !== 'ops' && key !== 'guard');
  if (extra.length > 0) {
    if (extra.includes('op')) {
      return failIssue([], '批量信封形状错误：双形态同现（"ops" 与单操作字段组不得同时出现）');
    }
    return failIssue([], `未知信封键 "${extra[0]}"（批量信封只允许 "ops"）`);
  }
  // ── E2 ops 必须是数组、非空、≤ MAX_BATCH_OPS ─────────────────────────────────
  const ops = env.ops;
  if (!Array.isArray(ops)) {
    return failIssue([], `批量信封形状错误：ops 必须是非空数组（实际 ${wordOf(ops)}）`);
  }
  if (ops.length === 0) {
    return failIssue([], '批量信封形状错误：ops 必须是非空数组（空数组）');
  }
  if (ops.length > MAX_BATCH_OPS) {
    return failIssue([], `批量信封形状错误：ops 元素数量超上限（${ops.length} > ${MAX_BATCH_OPS}）`);
  }
  // ── E3 逐元素解析（复用同一单操作解析核：动词封闭键集/缺键/path/值域；guard 与一切
  //        未知键由封闭键集天然排除——allowGuard=false，ADR 0026 L29 冻结面）──────
  const parsed: ParsedMutation[] = [];
  for (let i = 0; i < ops.length; i++) {
    const element = parseMutationCore(ops[i], `批量元素 #${i}：`, false);
    if (element.kind === 'fail') return element;
    parsed.push(element.mutation);
  }
  // ── E4 set([]) 元素禁令（ADR 0008 L47 唯一全量形态只保留给单操作信封）──────────
  for (let i = 0; i < parsed.length; i++) {
    const m = parsed[i]!;
    if (m.op === 'set' && m.path.length === 0) {
      return failIssue(
        [],
        `批量元素 #${i}：禁止 set([])（空路径全量重装仅保留给单操作形态——ADR 0008 唯一全量形态；批量元素必须是非空路径最小 edit）`,
      );
    }
  }
  // ── E5 批内路径互不嵌套（祖先-后代或相同）；共享边界兄弟路径（不同键终段）合法放行 ──
  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const a = parsed[i]!.path;
      const b = parsed[j]!.path;
      if (isPrefixOrEqual(a, b) || isPrefixOrEqual(b, a)) {
        return failIssue([], `批量信封形状错误：批内路径嵌套（#${i} 与 #${j} 的路径构成祖先-后代或相同关系）`);
      }
    }
  }
  // ── E6 顶层可选 guard 形状校验（ADR 0025 L53–58 形状错误族；无码 fail-fast、零写入）──
  let guard: MutationGuard | undefined;
  if (Object.hasOwn(env, 'guard')) {
    const parsedGuard = parseGuard(env.guard, '');
    if (parsedGuard.kind === 'fail') return parsedGuard;
    guard = parsedGuard.guard;
  }
  // ── 前置内部不变量：derived.structure 必须 root（fatal 位保持在先，不被领域结果掩盖）──
  if (derived.structure.kind !== 'root') {
    throw new DerivedInvariantError('derived.structure 非 root（手造派生物）');
  }
  // ── G 顶层 guard 评估（恰一次、读批前 committed、先于逐操作 prepare；ADR 0025 L74）──
  // 不满足 → 恰 1 issue（拒绝点上尚无操作 issues 可聚合）、整体零写入。
  if (guard !== undefined) {
    const verdict = evaluateGuard(doc, guard);
    if (verdict.kind === 'mismatch') return { kind: 'fail', issues: [verdict.issue] };
  }
  // ── P 逐操作 prepare（无 live 写；任一失败 → 整体零写入 + 聚合全部失败 issues）──
  const issues: MutationIssue[] = [];
  const items: BatchItem[] = [];
  for (const m of parsed) {
    const local = prepareLocalMutation(derived, doc, m);
    if (local.kind === 'fail') {
      issues.push(...local.issues);
      continue;
    }
    items.push({ commit: local.commit, verify: local.verify });
  }
  if (issues.length > 0) return { kind: 'fail', issues };
  // ── C 组合期望边界（全部 prepare 成功后、事务前；零 live 读）────────────────────
  return composeBatchVerify(derived, parsed, items);
}

/**
 * 阶段 C（设计 §7.5.2）：为每个批量 item 组合期望边界——把同批中写入位落在该 item 边界
 * 子树内的其他操作足迹（按 ops 序）折入 `proposedBoundary`，使共享 record/parent/union
 * 边界的合法兄弟操作不再触发伪 E201-C（ADR 0007 #237 §5「E201-C 只保留给真实提交后
 * 偏离」）。边界规划以 `planMutationBoundary` 纯函数复跑（零 base 读、零 doc 状态，
 * 与 prepare 内部同输入同结果）；折迭以合成 plan（apply 不消费 `kind`——见
 * `validate-patch.ts` 分支仅按 `mutation.op`）调用同一 `applyMutationAtBoundary`。
 * `target`/`array` 边界的 prefix 即操作自身写入位，严格前缀谓词天然零匹配（引理 3）。
 * issue #436：fast-path 数组项的验证计划为 `install-facts`（无 proposedBoundary）——
 * 按 `verify.kind` 判别直接跳过折迭；折迭输入侧（parsed 驱动）不变，legacy 边界项
 * 对批内数组足迹的吸收照旧。
 * 合成失败（可达：union 成员 any-of 重叠使组合边界无成员可容——引理 4'）→ 聚合
 * issues、整体零写入（fail-closed；不得弱化为死代码，否则提交 schema 非法文档）。
 */
function composeBatchVerify(
  derived: DerivedSchema,
  parsed: ParsedMutation[],
  items: BatchItem[],
): MutationPrepared {
  const compIssues: MutationIssue[] = [];
  const plans: Array<MutationBoundaryPlan | null> = [];
  for (const m of parsed) {
    const planned = planMutationBoundary(derived, m.path, m.op);
    if (!planned.ok) {
      // 结构性不可达（同输入确定性纯函数复跑；prepare 已以同参通过同款规划）——保留
      // fail-closed 收口纯为防御。
      compIssues.push(...issuesOf(planned.result));
      plans.push(null);
      continue;
    }
    plans.push(planned.plan);
  }
  for (let i = 0; i < items.length; i++) {
    const plan = plans[i]!;
    if (plan === null) continue;
    const verify = items[i]!.verify;
    // issue #436 / ADR 0033 决策 3：fast-path 数组项的计划为 `install-facts`（无
    // proposedBoundary 可保护/折迭）→ 跳过折迭。折迭输入侧（下循环读 parsed[j] 重放
    // 兄弟效果）不变：legacy 边界项对批内 fast-path 数组足迹的吸收照旧。正确性依据：
    // fast path 仅产生于 kind=`array` 计划，其 prefix = 操作自身路径，E5 批内路径互不
    // 嵌套 ⇒ 严格前缀谓词结构性零命中（引理 3，与 legacy 数组项同为零命中）。
    if (verify.kind !== 'boundary') continue;
    let composed = verify.input.proposedBoundary;
    for (let j = 0; j < parsed.length; j++) {
      if (j === i) continue;
      const mj = parsed[j]!;
      if (!isStrictPrefix(plan.prefix, mj.path)) continue;
      const synthetic: MutationBoundaryPlan = {
        prefix: [...plan.prefix],
        relPath: mj.path.slice(plan.prefix.length),
        node: plan.node,
        kind: plan.kind,
      };
      const applied = applyMutationAtBoundary(derived, synthetic, composed, payloadOf(mj));
      if (!applied.ok) {
        // 可达的保守收口：组合边界不再被任一 union 成员容纳 ⇒ 提交将产生 schema 非法
        // 文档（顺序单操作语义下该操作同样被拒；批量原子语义 ⊆ 顺序组合语义）。
        compIssues.push(...issuesOf(applied.result));
        break;
      }
      composed = applied.proposedBoundary;
    }
    items[i] = { ...items[i]!, verify: { kind: 'boundary', input: { ...verify.input, proposedBoundary: composed } } };
  }
  if (compIssues.length > 0) return { kind: 'fail', issues: compIssues };
  return { kind: 'batch', items };
}

/** 逐操作 payload 构造（与 mutation-local.ts 各 case 逐字同款）。 */
function payloadOf(m: ParsedMutation): BoundaryMutationPayload {
  switch (m.op) {
    case 'set': return { op: 'set', value: m.value };
    case 'delete': return { op: 'delete' };
    case 'array-insert': return { op: 'array-insert', index: m.index, values: m.values };
    case 'array-delete': return { op: 'array-delete', index: m.index, count: m.count };
  }
}

/** 严格前缀（引理 2：op_j 写位落在 boundary_i 子树内 ⟺ plan_i.prefix ⊊ path_j）。 */
function isStrictPrefix(prefix: readonly (string | number)[], path: readonly (string | number)[]): boolean {
  if (prefix.length >= path.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (prefix[i] !== path[i]) return false;
  }
  return true;
}

/** 前缀或相等（E5 嵌套判定：段严格 `===`，string/number）。 */
function isPrefixOrEqual(a: readonly (string | number)[], b: readonly (string | number)[]): boolean {
  if (a.length > b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function prepareCommit(
  derived: DerivedSchema,
  doc: Y.Doc,
  mutation: ParsedMutation,
  current: unknown,
  proposed: unknown,
): { kind: 'ok'; commit: PreparedCommit } | { kind: 'issue'; issue: MutationIssue } {
  const rootMap = doc.getMap<unknown>('ROOT');
  if (mutation.op === 'set' && mutation.path.length === 0) {
    const top = buildTopEntries(derived, proposed);
    if (top.kind === 'issue') return top;
    return { kind: 'ok', commit: { kind: 'replace-root', rootMap, entries: top.entries } };
  }

  const resolve = makeRefResolver(derived);
  if (mutation.op === 'array-insert' || mutation.op === 'array-delete') {
    const target = navigateLive(rootMap, rootStructureNode(derived), current, mutation.path, resolve);
    if (carrierOf(target.live) !== 'Y.Array') return issueOf(mutation.path, 'array mutation 目标 live 载体不是 Y.Array');
    if (mutation.op === 'array-delete') {
      return {
        kind: 'ok',
        commit: { kind: 'array-delete', target: target.live as Y.Array<unknown>, index: mutation.index, count: mutation.count },
      };
    }
    const logicalTarget = navigate(proposed, mutation.path);
    if (logicalTarget.kind === 'issue') return logicalTarget;
    const node = resolveNode(target.node, target.live, logicalTarget.value, resolve);
    if (node.kind !== 'array') throw new DerivedInvariantError('array mutation 目标结构节点非 array');
    const values: unknown[] = [];
    for (let i = 0; i < mutation.values.length; i++) {
      const built = buildDetachedValue(derived, node.element, mutation.values[i], [...mutation.path, mutation.index + i]);
      if (built.kind === 'issue') return built;
      values.push(built.value);
    }
    return {
      kind: 'ok',
      commit: { kind: 'array-insert', target: target.live as Y.Array<unknown>, index: mutation.index, values },
    };
  }

  const parentPath = mutation.path.slice(0, -1);
  const parent = navigateLive(rootMap, rootStructureNode(derived), current, parentPath, resolve);
  const key = mutation.path[mutation.path.length - 1];
  if (carrierOf(parent.live) !== 'Y.Map' || typeof key !== 'string') {
    return issueOf(mutation.path, `${mutation.op} 终态必须是 Y.Map 的字符串键`);
  }
  if (mutation.op === 'delete') {
    return { kind: 'ok', commit: { kind: 'delete', parent: parent.live as Y.Map<unknown>, key } };
  }
  const parentLogical = navigate(current, parentPath);
  if (parentLogical.kind === 'issue') return parentLogical;
  const targetNode = childNodeOf(parent.node, key, parent.live, parentLogical.value, resolve);
  const built = buildDetachedValue(derived, targetNode, mutation.value, mutation.path);
  if (built.kind === 'issue') return built;
  return { kind: 'ok', commit: { kind: 'set', parent: parent.live as Y.Map<unknown>, key, value: built.value } };
}

function rootStructureNode(derived: DerivedSchema): StructureNode {
  if (derived.structure.kind !== 'root') throw new DerivedInvariantError('derived.structure 非 root（手造派生物）');
  return derived.structure.node;
}

function commitPrepared(commit: PreparedCommit): void {
  switch (commit.kind) {
    case 'replace-root':
      commit.rootMap.clear();
      for (const [key, value] of commit.entries) commit.rootMap.set(key, value);
      return;
    case 'set':
      commit.parent.set(commit.key, commit.value);
      return;
    case 'delete':
      commit.parent.delete(commit.key);
      return;
    case 'array-insert':
      commit.target.insert(commit.index, commit.values);
      return;
    case 'array-delete':
      commit.target.delete(commit.index, commit.count);
      return;
  }
}

/**
 * live 载体导航（包内 @internal 接缝，issue #237：mutation-local.ts 换根导航复用；
 * 不经 index.ts 导出）。rootMap 形参只是「起始 live 载体」——换根调用（R1 union
 * 边界）时传入边界 live 与边界结构节点/逻辑值（算法零改动，logical 输入改为边界
 * 提取值的对应下钻）。载体/两树不一致抛 DerivedInvariantError（E204 面），由调用方
 * 顶层 catch 按管线位置分类。
 */
export function navigateLive(
  rootMap: Y.Map<unknown>,
  rootNode: StructureNode,
  logicalRoot: unknown,
  path: Path,
  resolve: (node: StructureNode) => StructureNode,
): LiveStep {
  let live: unknown = rootMap;
  let logical: unknown = logicalRoot;
  let node = rootNode;
  for (const seg of path) {
    const resolved = resolveNode(node, live, logical, resolve);
    if (resolved.kind === 'map') {
      if (carrierOf(live) !== 'Y.Map' || typeof seg !== 'string') {
        throw new DerivedInvariantError('validated map path 与 live Y.Map 载体不一致');
      }
      const parentLive = live;
      const parentLogical = logical;
      live = (parentLive as Y.Map<unknown>).get(seg);
      logical = plainObjectOf(parentLogical)?.[seg];
      node = childNodeOf(resolved, seg, parentLive, parentLogical, resolve);
      continue;
    }
    if (resolved.kind === 'array') {
      if (carrierOf(live) !== 'Y.Array' || !strictNonNegativeInteger(seg)) {
        throw new DerivedInvariantError('validated array path 与 live Y.Array 载体不一致');
      }
      live = (live as Y.Array<unknown>).get(seg);
      logical = Array.isArray(logical) ? logical[seg] : undefined;
      node = resolved.element;
      continue;
    }
    throw new DerivedInvariantError('validated path 穿越不可下钻结构终态');
  }
  return { live, node: resolveNode(node, live, logical, resolve) };
}

function resolveNode(
  node: StructureNode,
  live: unknown,
  logical: unknown,
  resolve: (node: StructureNode) => StructureNode,
): StructureNode {
  let current = resolve(node);
  if (current.kind === 'root') current = resolve(current.node);
  if (current.kind !== 'union') return current;
  for (const member of current.members) {
    const candidate = resolveNode(member, live, logical, resolve);
    if (!carrierCompatible(candidate, live)) continue;
    const trial = walk(candidate, live, [], resolve);
    if (trial.kind !== 'issue' && logicalValuesEqual(trial.snapshot, logical)) return candidate;
  }
  throw new DerivedInvariantError('validated union 无 live/logical 匹配成员');
}

function logicalValuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => logicalValuesEqual(value, b[index]));
  }
  const ao = plainObjectOf(a);
  const bo = plainObjectOf(b);
  if (ao === null || bo === null) return false;
  const aKeys = Object.keys(ao).filter((key) => ao[key] !== undefined);
  const bKeys = Object.keys(bo).filter((key) => bo[key] !== undefined);
  return aKeys.length === bKeys.length
    && aKeys.every((key) => bo[key] !== undefined && logicalValuesEqual(ao[key], bo[key]));
}

function carrierCompatible(node: StructureNode, live: unknown): boolean {
  switch (node.kind) {
    case 'map': return live === undefined || carrierOf(live) === 'Y.Map';
    case 'array': return live === undefined || carrierOf(live) === 'Y.Array';
    case 'xml-fragment': return live === undefined || carrierOf(live) === 'Y.XmlFragment';
    case 'leaf':
    case 'plain': return live === undefined || carrierOf(live) === 'plain value';
    default: return true;
  }
}

function childNodeOf(
  node: StructureNode,
  key: string,
  live: unknown,
  logical: unknown,
  resolve: (node: StructureNode) => StructureNode,
): StructureNode {
  const resolved = resolveNode(node, live, logical, resolve);
  if (resolved.kind !== 'map') throw new DerivedInvariantError('validated map child 的结构节点非 map');
  const record = resolved.fields.length === 1 && resolved.fields[0]?.name === '<key>'
    ? resolved.fields[0].node
    : undefined;
  const child = record ?? resolved.fields.find((field) => field.name === key)?.node;
  if (child === undefined) throw new DerivedInvariantError(`validated map child 缺少结构字段（${key}）`);
  return child;
}

/** 单操作信封解析（现役契约入口；消息零变化；顶层可选 guard 属 ADR 0025 演进面）。 */
function parseMutation(input: unknown):
  | { kind: 'ok'; mutation: ParsedMutation }
  | { kind: 'fail'; issues: MutationIssue[] } {
  return parseMutationCore(input, '', true);
}

/** 单操作解析核（单操作分支与批量元素循环共同消费的唯一实现；`prefix` 为空串时消息
 *  逐字节不变，批量元素以 `批量元素 #i：` 前缀标注）。
 *  `allowGuard`：仅单操作顶层与批量顶层形态为 true（ADR 0025 L72–74）；批量元素循环传
 *  false ⇒ `guard` 键由动词封闭键集天然排除，维持无码形状错误（ADR 0026 L29 冻结面）。
 *  可选键集为旁路（不进入 specs 必需键检查）：无 guard 输入的未知键消息逐字节不变。 */
function parseMutationCore(input: unknown, prefix: string, allowGuard: boolean):
  | { kind: 'ok'; mutation: ParsedMutation }
  | { kind: 'fail'; issues: MutationIssue[] } {
  const env = plainObjectOf(input);
  if (env === null) return failIssue([], `${prefix}mutation 信封形状错误：期望普通对象，实际 ${wordOf(input)}`);
  const op = env.op;
  const specs: Record<string, readonly string[]> = {
    set: ['op', 'path', 'value'],
    delete: ['op', 'path'],
    'array-insert': ['op', 'path', 'index', 'values'],
    'array-delete': ['op', 'path', 'index', 'count'],
  };
  if (typeof op !== 'string' || !Object.hasOwn(specs, op)) return failIssue([], `${prefix}未知操作 "${String(op)}"`);
  const operation = op as ValidatedMutation['op'];
  const allowed = specs[operation]!;
  const unknown = Object.keys(env).find((k) => !allowed.includes(k) && !(allowGuard && k === 'guard'));
  if (unknown !== undefined) return failIssue([], `${prefix}未知信封键 "${unknown}"（操作 ${op}）`);
  const missing = allowed.find((k) => !Object.hasOwn(env, k));
  if (missing !== undefined) return failIssue([], `${prefix}信封缺少必需键 "${missing}"（操作 ${op}）`);
  if (!Array.isArray(env.path)) return failIssue([], `${prefix}path 必须是数组（段为 string|number）`);
  const path = [...env.path] as Path;
  for (const seg of path) {
    if (typeof seg !== 'string' && typeof seg !== 'number') return failIssue([], `${prefix}path 段类型错误：期望 string|number，实际 ${typeof seg}`);
  }
  let base: ParsedMutation;
  if (op === 'set') {
    if (env.value === undefined) return failIssue([], `${prefix}set 需携带非 undefined value`);
    base = { op, path, value: env.value };
  } else if (op === 'delete') {
    base = { op, path };
  } else {
    if (!strictNonNegativeInteger(env.index)) return failIssue(path, `${prefix}${op} index 必须是严格非负整数`);
    if (op === 'array-insert') {
      if (!Array.isArray(env.values) || env.values.length === 0) return failIssue(path, `${prefix}array-insert values 必须是非空数组`);
      if (env.values.some((v) => v === undefined)) return failIssue(path, `${prefix}array-insert values 不得包含 undefined`);
      base = { op, path, index: env.index, values: [...env.values] };
    } else {
      if (op !== 'array-delete') return failIssue([], `未知操作 "${String(op)}"`);
      if (!strictPositiveInteger(env.count)) return failIssue(path, `${prefix}array-delete count 必须是严格正整数`);
      base = { op, path, index: env.index, count: env.count };
    }
  }
  // 可选 guard 形状校验放在 op 自身全部形状检查之后（SA2 N3）：非 guard 缺陷消息保持既有
  // 优先级；guard 形状错误一律无码（不可重试，ADR 0025 L53–58）。
  if (!allowGuard || !Object.hasOwn(env, 'guard')) return { kind: 'ok', mutation: base };
  const parsedGuard = parseGuard(env.guard, prefix);
  if (parsedGuard.kind === 'fail') return parsedGuard;
  return { kind: 'ok', mutation: { ...base, guard: parsedGuard.guard } };
}

/** guard 形状错误全表（ADR 0025 L53–58 + 设计 §5 D4 确定性检查序）：一律 `failIssue([], …)`
 *  ——信封级错误、path `[]`、键缺席构造（`code === undefined`，不可重试）。检查序：
 *  ① 普通对象 → ② 未知键 → ③ equals/absent 恰其一 → ④ absent 字面 true →
 *  ⑤ equals 非 undefined / 任意深度不含非有限数 → ⑥ path 存在/数组/段型/非空。 */
function parseGuard(value: unknown, prefix: string):
  | { kind: 'ok'; guard: MutationGuard }
  | { kind: 'fail'; issues: MutationIssue[] } {
  const env = plainObjectOf(value);
  if (env === null) return failIssue([], `${prefix}guard 形状错误：必须是普通对象（实际 ${wordOf(value)}）`);
  const unknown = Object.keys(env).find((k) => k !== 'path' && k !== 'equals' && k !== 'absent');
  if (unknown !== undefined) {
    return failIssue([], `${prefix}guard 形状错误：未知键 "${unknown}"（只允许 "path" 与 "equals"/"absent" 恰其一）`);
  }
  const hasEquals = Object.hasOwn(env, 'equals');
  const hasAbsent = Object.hasOwn(env, 'absent');
  if (hasEquals && hasAbsent) return failIssue([], `${prefix}guard 形状错误："equals" 与 "absent" 不得同时出现`);
  if (!hasEquals && !hasAbsent) return failIssue([], `${prefix}guard 形状错误：缺判别键（"equals" 与 "absent" 必须恰现其一）`);
  if (hasAbsent && env.absent !== true) {
    return failIssue([], `${prefix}guard 形状错误："absent" 必须是字面 true（实际 ${wordOf(env.absent)}）`);
  }
  if (hasEquals && env.equals === undefined) {
    return failIssue([], `${prefix}guard 形状错误："equals" 不得为 undefined（无值断言请用 absent: true）`);
  }
  if (hasEquals && containsNonFiniteNumber(env.equals)) {
    return failIssue([], `${prefix}guard 形状错误："equals" 含非有限数（NaN/Infinity 值域外）`);
  }
  if (!Object.hasOwn(env, 'path')) return failIssue([], `${prefix}guard 形状错误：缺 "path"`);
  if (!Array.isArray(env.path)) return failIssue([], `${prefix}guard 形状错误：path 必须是数组（段为 string|number）`);
  const path = [...env.path] as Path;
  for (const seg of path) {
    if (typeof seg !== 'string' && typeof seg !== 'number') {
      return failIssue([], `${prefix}guard 形状错误：path 段类型错误：期望 string|number，实际 ${typeof seg}`);
    }
  }
  if (path.length === 0) {
    return failIssue([], `${prefix}guard 形状错误：path 不得为空数组（ROOT 整树 CAS v1 拒绝——ADR 0025）`);
  }
  if (hasAbsent) return { kind: 'ok', guard: { path, absent: true } };
  return { kind: 'ok', guard: { path, equals: env.equals } };
}

/** `equals` 任意深度含非有限数（number 顶层或嵌套；数组/plain object 递归）。
 *  其余载体（string/boolean/null/bigint/Date…）不含——留给评估期自然不相等，不扩大立法面。 */
function containsNonFiniteNumber(value: unknown): boolean {
  if (typeof value === 'number') return !Number.isFinite(value);
  if (Array.isArray(value)) return value.some((entry) => containsNonFiniteNumber(entry));
  const obj = plainObjectOf(value);
  if (obj !== null) return Object.keys(obj).some((key) => containsNonFiniteNumber(obj[key]));
  return false;
}

/** guard 评估判决（prepare 阶段一次性纯读；ADR 0025 L42–44）。 */
type GuardVerdict = { kind: 'satisfied' } | { kind: 'mismatch'; issue: MutationIssue };

/** absent 成员判别（parse 产物恰携其一；`in` 收窄经谓词显式化，避免 exclusive-union 的
 *  可选 `never` 键影响调用点收窄）。 */
type AbsentGuard = { path: readonly (string | number)[]; absent: true };

function isAbsentGuard(guard: MutationGuard): guard is AbsentGuard {
  return 'absent' in guard;
}

/** 复用既有投影读取与深相等（SA8 required action 4，不新起第二套语义）：
 *  - equals：`readLogicalValueAtPath` 投影逻辑值 ⊗ `logicalValuesEqual`（undefined 键过滤
 *    结构深相等）；读失败（PATH_NOT_ALLOWED/E100）不满足；
 *  - absent：读失败或投影 undefined（缺键吸收）满足；键有值不满足。
 *  纯读零写入零事件（INV-R1/R9），不进事务；调用点在 `transactGuarded` 之外。 */
function evaluateGuard(doc: Y.Doc, guard: MutationGuard): GuardVerdict {
  const read = readLogicalValueAtPath(doc, guard.path);
  const satisfied = isAbsentGuard(guard)
    ? !read.ok || read.value === undefined
    : read.ok && logicalValuesEqual(read.value, guard.equals);
  if (satisfied) return { kind: 'satisfied' };
  return { kind: 'mismatch', issue: mismatchIssue(guard, read) };
}

/** 评估不满足的单 issue（ADR 0025 L58）：稳定码 + `issue.path` 为 guard 条件路径的新鲜
 *  等价副本；message 含期望/实际有界摘要（截断防爆，单侧 ≤256 字符 + 标记）。 */
function mismatchIssue(guard: MutationGuard, read: ReadLogicalValueResult): MutationIssue {
  const guardPath = renderGuardPath(guard.path);
  const actual = read.ok ? summarizeLogicalValue(read.value) : '不可读（PATH_NOT_ALLOWED）';
  const message = isAbsentGuard(guard)
    ? `${MUTATION_GUARD_MISMATCH}: guard 条件不满足（guard 路径 ${guardPath}：期望 absent 无值，实际=${actual}）`
    : `${MUTATION_GUARD_MISMATCH}: guard 条件不满足（guard 路径 ${guardPath}：期望 equals=${summarizeLogicalValue(guard.equals)}，实际=${actual}）`;
  return { message, path: [...guard.path], code: MUTATION_GUARD_MISMATCH };
}

const GUARD_SUMMARY_LIMIT = 256;
const GUARD_SUMMARY_MARK = '…(截断)';

/** 有界摘要（确定性字符截断 + 标记；远低于诊断 message 4096B 预算）。 */
function truncateSummary(text: string): string {
  return text.length <= GUARD_SUMMARY_LIMIT ? text : `${text.slice(0, GUARD_SUMMARY_LIMIT)}${GUARD_SUMMARY_MARK}`;
}

/** guard 路径渲染（JSON 数组文本，截断有界）。 */
function renderGuardPath(path: readonly (string | number)[]): string {
  return truncateSummary(JSON.stringify(path));
}

/** 期望/实际值摘要：undefined 显式标注读得无值；`JSON.stringify` 抛错或返回非字符串
 *  （function/symbol 等）时回退 `<不可序列化：类型>`；其余截断有界。 */
function summarizeLogicalValue(value: unknown): string {
  if (value === undefined) return 'undefined（读得无值）';
  try {
    const text = JSON.stringify(value);
    if (typeof text !== 'string') return `<不可序列化：${wordOf(value)}>`;
    return truncateSummary(text);
  } catch {
    return `<不可序列化：${wordOf(value)}>`;
  }
}

function applyToJson(root: unknown, mutation: ParsedMutation): PlaceResult {
  switch (mutation.op) {
    case 'set': return placeSet(root, mutation.path, mutation.value);
    case 'delete': return placeDelete(root, mutation.path);
    case 'array-insert': return placeArrayInsert(root, mutation.path, mutation.index, mutation.values);
    case 'array-delete': return placeArrayDelete(root, mutation.path, mutation.index, mutation.count);
  }
}

function placeSet(root: unknown, path: Path, value: unknown): PlaceResult {
  if (path.length === 0) return { kind: 'ok', value };
  const parent = navigateToParent(root, path);
  if (parent.kind === 'issue') return parent;
  const seg = path[path.length - 1]!;
  const obj = plainObjectOf(parent.value);
  if (obj === null) {
    if (Array.isArray(parent.value)) return issueOf(path, 'set 终态不支持数组下标');
    return issueOf(path, `路径穿越不可下钻终态——终段父节点非普通对象（实际 ${wordOf(parent.value)}）`);
  }
  if (typeof seg !== 'string') return issueOf(path, '终段键段非字符串');
  Object.defineProperty(obj, seg, { value, writable: true, enumerable: true, configurable: true });
  return { kind: 'ok', value: root };
}

function placeDelete(root: unknown, path: Path): PlaceResult {
  if (path.length === 0) return issueOf([], 'delete 禁止删除 ROOT');
  const parent = navigateToParent(root, path);
  if (parent.kind === 'issue') return parent;
  if (Array.isArray(parent.value)) return issueOf(path, 'delete 禁止数组下标；请使用 array-delete');
  const obj = plainObjectOf(parent.value);
  const seg = path[path.length - 1]!;
  if (obj === null || typeof seg !== 'string') return issueOf(path, 'delete 终段必须是普通对象的字符串键');
  if (!Object.hasOwn(obj, seg)) return issueOf(path, 'delete 目标键不存在（拒绝 no-op）');
  delete obj[seg];
  return { kind: 'ok', value: root };
}

function placeArrayInsert(root: unknown, path: Path, index: number, values: readonly unknown[]): PlaceResult {
  const target = navigate(root, path);
  if (target.kind === 'issue') return target;
  if (!Array.isArray(target.value)) return issueOf(path, 'array-insert 目标必须是数组');
  if (index > target.value.length) return issueOf(path, 'array-insert index 越界（不 clamp）');
  target.value.splice(index, 0, ...values);
  return { kind: 'ok', value: root };
}

function placeArrayDelete(root: unknown, path: Path, index: number, count: number): PlaceResult {
  const target = navigate(root, path);
  if (target.kind === 'issue') return target;
  if (!Array.isArray(target.value)) return issueOf(path, 'array-delete 目标必须是数组');
  if (index >= target.value.length || index + count > target.value.length) return issueOf(path, 'array-delete 范围越界（不 clamp、不接受越界 no-op）');
  target.value.splice(index, count);
  return { kind: 'ok', value: root };
}

function navigateToParent(root: unknown, path: Path): StepResult {
  return navigate(root, path.slice(0, -1));
}

function navigate(root: unknown, path: Path): StepResult {
  let cur = root;
  for (let i = 0; i < path.length; i++) {
    const next = stepInto(cur, path[i]!, path, i);
    if (next.kind === 'issue') return next;
    cur = next.value;
  }
  return { kind: 'ok', value: cur };
}

function stepInto(parent: unknown, seg: string | number, path: Path, at: number): StepResult {
  const prefix = path.slice(0, at);
  const obj = plainObjectOf(parent);
  if (obj !== null) {
    if (typeof seg !== 'string') return issueOf(prefix, '中间容器导航键段非字符串');
    if (!Object.hasOwn(obj, seg)) return issueOf(prefix, '中间容器缺失——不自动创建中间容器');
    return { kind: 'ok', value: obj[seg] };
  }
  if (Array.isArray(parent)) {
    if (!strictNonNegativeInteger(seg) || seg >= parent.length) return issueOf(prefix, '数组下标越界或非整数下标');
    return { kind: 'ok', value: parent[seg] };
  }
  return issueOf(prefix, `路径穿越不可下钻终态（实际 ${wordOf(parent)}）`);
}

function cloneJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

function strictNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function strictPositiveInteger(value: unknown): value is number {
  return strictNonNegativeInteger(value) && value > 0;
}

function plainObjectOf(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null ? value as Record<string, unknown> : null;
}

function wordOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function failIssue(path: Path, message: string): { kind: 'fail'; issues: MutationIssue[] } {
  return { kind: 'fail', issues: [{ message, path }] };
}

/** ValidateResult → MutationIssue[]（ok:true 分支无 issues——调用点已判 !ok）。 */
function issuesOf(result: ValidateResult): MutationIssue[] {
  return result.ok ? [] : result.issues;
}

function issueOf(path: Path, message: string): { kind: 'issue'; issue: MutationIssue } {
  return { kind: 'issue', issue: { message, path } };
}

function errDetailOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
