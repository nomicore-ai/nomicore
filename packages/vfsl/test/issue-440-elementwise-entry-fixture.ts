/**
 * issue #440 SA6 一致性夹具（参数化 + 确定性随机）——ADR 0034 决策 5「容器约束逐 entry
 * 可组合」的兜底执行面（扩展 ADR 0033 数组案 `issue-435-elementwise-array-fixture.ts`）。
 *
 * 立法：「Record 合法 ⟺ 逐键值合法（键过 Pattern ∧ 值过值 schema）」∧「封闭对象
 * delete 合法性 = 目标字段必填性的静态事实」。本夹具生成合法基线（Record map 值 /
 * 封闭对象父值）上的 `set`/`delete` 用例，并把**逐 entry 判定**（issue #440 目标接缝）
 * 与**全量整体验证**（现行 `applyMutationAtBoundary` = 全量拷贝重建 + `validateSubtree`
 * 整体判定 + issue 按 prefix rebase，issue #237 路径）的接受/拒绝结论与 issue 内容做
 * 逐字节比较：未来若有人以校验器特判引入 map 级约束（键数 / 跨键语义），全量侧会多出
 * 容器级 issue 或相反判决，本夹具红灯。
 *
 * 纪律（与 #435 同款）：
 * - 只经包公共入口（`../src/index.js`）观察运行时行为；不 grep 生产源码、不 import 内部件。
 * - 用例生成确定性（mulberry32 定种子 440）：同输入恒同用例集，便于红/绿证据逐轮复现；
 *   同时覆盖参数化边界组（P）与随机组（R），并显式登记接受/拒绝两支，防「比较面空转」。
 * - `legacyVerdict` 是**全量整体验证 oracle**（既有公共导出，非本票实现）；`targetVerdict`
 *   由契约测试注入目标接缝（本文件不引用新名目，改名只动契约测试的绑定块）。
 * - **触达面分类**（ADR 0034 决策 4）：污染位于**目标键位之内**的用例（set 整值替换旧
 *   非法值 / delete 删除非法键位本身）进等价集（旧新同判）；污染位于**目标键位之外**的
 *   用例进触达面组（`buildTouchSurfaceCases`）——全量 oracle 连带拒绝，目标行为是目标键
 *   合法即成功，二者逐字节可分（判据敏感性证据）。
 * - 等价集纪律：每个用例的全量 oracle 判决只允许落在目标键位前缀
 *   `[...plan.prefix, key]` 上（`issuesConfinedToTargetKey`）——违反即夹具自欺，
 *   由控制组 NC4 红灯。
 */
import { applyMutationAtBoundary, evaluate, parseVfsl, planMutationBoundary } from '../src/index.js';
import type { DerivedSchema, MutationBoundaryPlan } from '../src/index.js';

// ── schema 与夹具域 ──────────────────────────────────────────────────────────

export const ENTRY_SCHEMA_TEXT = [
  'type Item = { name: string; qty: number & Int<0, 100> };',
  'type Alt = { label: string; n: number & Int<0, 10> };',
  'type ROOT = {',
  '  tasks: Record<string, Item>;',
  '  codes: Record<string & Pattern<"^(id-[0-9]+)$">, Item>;',
  '  blobs: Record<string, Item | Alt>;',
  '  maybe: Record<string, Item> | { fixed: string };',
  '  outer: { inner: Record<string, Item> };',
  '  obj: { req: string; opt?: number; unk: unknown; child: { deep: string }; u: string | number };',
  '  panel: { node: { req: string; opt?: number; unk: unknown } };',
  '};',
  '',
].join('\n');

let cachedDerived: DerivedSchema | undefined;

export function entrywiseDerived(): DerivedSchema {
  if (cachedDerived !== undefined) return cachedDerived;
  const parsed = parseVfsl(ENTRY_SCHEMA_TEXT);
  if (!parsed.ok) throw new Error(`夹具 schema parseVfsl 失败: ${JSON.stringify(parsed.issues)}`);
  const evaluated = evaluate(parsed.module);
  if (!evaluated.ok) throw new Error(`夹具 schema evaluate 失败: ${JSON.stringify(evaluated.issues)}`);
  cachedDerived = evaluated.derived;
  return cachedDerived;
}

// ── Record 路径域（fast path 候选：非 union Record 形态）────────────────────────

/** entry 值域类别（`<key>` 槽的值 schema 形状）。 */
export type EntryValueKind = 'item' | 'item-union';

export interface RecordPathSpec {
  readonly path: readonly (string | number)[];
  readonly valueKind: EntryValueKind;
  /** 合法键前缀（`codes` 用 `id-` 满足 `^(id-[0-9]+)$`）。 */
  readonly keyPrefix: string;
  /** 违反 keyPattern 的键（无 Pattern 的 Record 上仅作「任意其他键」使用）。 */
  readonly badKey: string;
  readonly keyPattern?: string;
}

export const RECORD_PATH_SPECS: readonly RecordPathSpec[] = [
  { path: ['tasks'], valueKind: 'item', keyPrefix: 't', badKey: 'BAD KEY' },
  { path: ['codes'], valueKind: 'item', keyPrefix: 'id-', badKey: 'nope', keyPattern: '^(id-[0-9]+)$' },
  { path: ['blobs'], valueKind: 'item-union', keyPrefix: 'b', badKey: 'BAD KEY' },
  { path: ['outer', 'inner'], valueKind: 'item', keyPrefix: 'n', badKey: 'BAD KEY' },
];

/** union map 位（`Record<string, Item> | { fixed: string }`）——永久 legacy 轨（闸门负例）。 */
export const UNION_MAP_PATH: readonly (string | number)[] = ['maybe'];

/** 合法键生成（同 spec 内确定性：`<keyPrefix><n>`）。 */
export function legalKey(spec: RecordPathSpec, n: number): string {
  return `${spec.keyPrefix}${n}`;
}

// ── 封闭对象（parent delete）域 ──────────────────────────────────────────────

export type FieldKind = 'required' | 'optional' | 'unknown';

export interface ParentFieldSpec {
  readonly name: string;
  readonly kind: FieldKind;
}

export interface ParentPathSpec {
  readonly path: readonly (string | number)[];
  /** 干净基线（全必填在场、无未知键、字段值合法）。 */
  base(): Record<string, unknown>;
  readonly fields: readonly ParentFieldSpec[];
}

export const OBJ_PATH: readonly (string | number)[] = ['obj'];
export const PANEL_PATH: readonly (string | number)[] = ['panel', 'node'];

export function objBase(): Record<string, unknown> {
  return { req: 'r', opt: 1, unk: { k: 1 }, child: { deep: 'd' }, u: 7 };
}

export function panelBase(): Record<string, unknown> {
  return { req: 'r', opt: 2, unk: [1, 2] };
}

export const PARENT_PATH_SPECS: readonly ParentPathSpec[] = [
  {
    path: OBJ_PATH,
    base: objBase,
    fields: [
      { name: 'req', kind: 'required' },
      { name: 'opt', kind: 'optional' },
      { name: 'unk', kind: 'unknown' },
      { name: 'child', kind: 'required' },
      { name: 'u', kind: 'required' },
    ],
  },
  {
    path: PANEL_PATH,
    base: panelBase,
    fields: [
      { name: 'req', kind: 'required' },
      { name: 'opt', kind: 'optional' },
      { name: 'unk', kind: 'unknown' },
    ],
  },
];

/** 干净基线去掉某字段（no-op delete 用例的基线构造）。 */
export function withoutField(base: Record<string, unknown>, field: string): Record<string, unknown> {
  const copy = { ...base };
  delete copy[field];
  return copy;
}

// ── 值池（合法 / 非法，均取自 JSON 值域）─────────────────────────────────────

const ITEM_LEGAL: readonly unknown[] = [
  { name: 'a', qty: 0 },
  { name: 'b', qty: 1 },
  { name: '', qty: 100 },
  { name: 'c', qty: 50 },
];

const ITEM_ILLEGAL: readonly unknown[] = [
  { name: 'a', qty: 101 }, // Int<0,100> 上溢
  { name: 'a', qty: -1 }, // Int<0,100> 下溢
  { name: 'a' }, // 缺必填 qty
  { qty: 1 }, // 缺必填 name
  { name: 'a', qty: 1, extra: true }, // 封闭对象未知键
  { name: 'a', qty: '1' }, // 型错
  'nope',
  null,
  [],
  {},
];

const UNION_LEGAL: readonly unknown[] = [
  { name: 'a', qty: 1 },
  { name: 'b', qty: 100 },
  { label: 'l', n: 0 },
  { label: 'm', n: 10 },
];

const UNION_ILLEGAL: readonly unknown[] = [
  { label: 'l', n: 11 }, // Alt 上溢
  { label: 'l' }, // Alt 缺必填
  { name: 'a', qty: 101 }, // Item 上溢（Alt 无此键）
  { name: 'a', qty: 1, extra: true }, // 两成员封闭对象均拒
  'x',
  null,
  5,
  {},
];

interface Pools {
  readonly legal: readonly unknown[];
  readonly illegal: readonly unknown[];
}

function poolsFor(kind: EntryValueKind): Pools {
  switch (kind) {
    case 'item':
      return { legal: ITEM_LEGAL, illegal: ITEM_ILLEGAL };
    case 'item-union':
      return { legal: UNION_LEGAL, illegal: UNION_ILLEGAL };
  }
}

/** 该 entry 值类别的规范合法值（poolsFor 首位；契约测试构造期望锚用）。 */
export function ivLegal(kind: EntryValueKind): unknown {
  return poolsFor(kind).legal[0];
}

/** 该 entry 值类别的规范非法值（poolsFor 首位；契约测试构造期望锚用）。 */
export function ivIllegal(kind: EntryValueKind): unknown {
  return poolsFor(kind).illegal[0];
}

// ── 确定性随机（mulberry32；种子冻结为 440）────────────────────────────────────

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 用例模型 ────────────────────────────────────────────────────────────────

export type EntryMutationPayload = { op: 'set'; value: unknown } | { op: 'delete' };

export interface EntryCase {
  readonly id: string;
  /** 容器绝对路径（Record map 位 / 封闭对象父位）= `plan.prefix` 的冻结副本。 */
  readonly path: readonly (string | number)[];
  /** 目标键位（Record 键 / 封闭对象字段名）= `plan.relPath` 唯一段。 */
  readonly key: string;
  /** 边界基值：Record 用例 = 整 map 值；parent 用例 = 父对象值（全量 oracle 的边界提取值）。 */
  readonly base: Record<string, unknown>;
  readonly payload: EntryMutationPayload;
  /** 目标接缝期望结论（等价集内与全量 oracle 恒同；触达面组内为 ADR 0034 目标行为）。 */
  readonly expectTarget: 'accept' | 'reject';
  readonly note: string;
}

export type Verdict =
  | { readonly ok: true; readonly issues: readonly [] }
  | { readonly ok: false; readonly issues: ReadonlyArray<{ readonly message: string; readonly path: readonly (string | number)[] }> };

export interface VerdictIssue {
  readonly message: string;
  readonly path: readonly (string | number)[];
}

/** 全量整体验证 oracle（既有公共导出）：边界值全量重建 + `validateSubtree` 整体判定。 */
export function legacyVerdict(
  derived: DerivedSchema,
  plan: MutationBoundaryPlan,
  base: Record<string, unknown>,
  payload: EntryMutationPayload,
): Verdict {
  const applied = applyMutationAtBoundary(derived, plan, base, payload);
  if (applied.ok) return { ok: true, issues: [] };
  const failure = applied.result;
  if (failure.ok) return { ok: true, issues: [] }; // 形状上不可达（ok:false 支恒带 result.ok:false）
  return { ok: false, issues: failure.issues.map((issue) => ({ message: issue.message, path: [...issue.path] })) };
}

/** 目标键位（plan.relPath 唯一段；契约冻结：record/parent 计划 relPath 长度恒为 1）。 */
export function targetKeyOf(plan: MutationBoundaryPlan): string {
  const key = plan.relPath[plan.relPath.length - 1];
  return typeof key === 'string' ? key : String(key);
}

/**
 * 目标接缝（issue #440 新导出）判决规整——接缝以参数注入，夹具不引用新名目。
 * 载体域事实 `has` = 目标键位在场（O(1)，`Object.hasOwn`）——与 live `Y.Map.has(key)` 同义。
 */
export function targetVerdict(
  seam: (
    derived: DerivedSchema,
    plan: MutationBoundaryPlan,
    facts: { readonly has: boolean },
    payload: EntryMutationPayload,
  ) => { ok: true } | { ok: false; issues: ReadonlyArray<VerdictIssue> },
  derived: DerivedSchema,
  plan: MutationBoundaryPlan,
  base: Record<string, unknown>,
  payload: EntryMutationPayload,
): Verdict {
  const result = seam(derived, plan, { has: Object.hasOwn(base, targetKeyOf(plan)) }, payload);
  if (result.ok) return { ok: true, issues: [] };
  return { ok: false, issues: result.issues.map((issue) => ({ message: issue.message, path: [...issue.path] })) };
}

/** 逐字节判据（message + path 全序，含失败支的 issue 顺序）。 */
export function verdictBytes(verdict: Verdict): string {
  return JSON.stringify(verdict);
}

export function verdictsEqual(a: Verdict, b: Verdict): boolean {
  return verdictBytes(a) === verdictBytes(b);
}

/** 判决的全部 issue 是否都落在目标键位前缀 `[...plan.prefix, key]` 上（等价集自洽判据）。 */
export function issuesConfinedToTargetKey(verdict: Verdict, plan: MutationBoundaryPlan): boolean {
  const target = [...plan.prefix, targetKeyOf(plan)];
  return verdict.ok || verdict.issues.every((issue) => target.every((seg, i) => issue.path[i] === seg));
}

export function planFor(derived: DerivedSchema, path: readonly (string | number)[], op: 'set' | 'delete'): MutationBoundaryPlan {
  const planned = planMutationBoundary(derived, [...path], op);
  if (!planned.ok) {
    const failure = planned.result;
    throw new Error(`夹具 planMutationBoundary 失败: ${JSON.stringify(failure.ok ? [] : failure.issues)}`);
  }
  return planned.plan;
}

/** union map 位的 plan（永久 legacy 轨）——fast path 闸门负例。 */
export function unionMapPlan(derived: DerivedSchema): MutationBoundaryPlan {
  return planFor(derived, [...UNION_MAP_PATH, 'm1'], 'set');
}

/** 用例的边界计划：目标绝对路径 = 容器路径 + 目标键位（record/parent 计划 relPath 恒为 [key]）。 */
export function planForCase(derived: DerivedSchema, c: EntryCase): MutationBoundaryPlan {
  return planFor(derived, [...c.path, c.key], c.payload.op);
}

// ── 用例生成 ────────────────────────────────────────────────────────────────

function pickIndex(rnd: () => number, pool: readonly unknown[]): number {
  return Math.floor(rnd() * pool.length);
}

/** map 值（Record 用例基线）：n 条合法 entry（键合法、值合法）。 */
function cleanRecordBase(rnd: () => number, spec: RecordPathSpec, n: number): Record<string, unknown> {
  const pools = poolsFor(spec.valueKind);
  const base: Record<string, unknown> = {};
  for (let j = 0; j < n; j++) base[legalKey(spec, j)] = pools.legal[pickIndex(rnd, pools.legal)];
  return base;
}

/** 等价集：合法基线（或污染仅落在目标键位内）上的 set/delete——全量 oracle 与目标接缝必须逐字节一致。 */
export function buildEquivalenceCases(): EntryCase[] {
  const out: EntryCase[] = [];
  for (const spec of RECORD_PATH_SPECS) {
    const pools = poolsFor(spec.valueKind);
    const legal0 = pools.legal[0]!;
    const legal1 = pools.legal[1]!;
    const illegal0 = pools.illegal[0]!;
    const otherKey = spec.badKey;
    const existingKey = legalKey(spec, 0);
    const base: Record<string, unknown> = { [existingKey]: legal0 };
    const tag = String(spec.path[spec.path.length - 1]);

    out.push({
      id: `P-${tag}-set-new-key-legal`,
      path: spec.path,
      key: spec.keyPrefix === 'id-' ? 'id-9' : 'zz9',
      base: { ...base },
      payload: { op: 'set', value: legal1 },
      expectTarget: 'accept',
      note: '新键 + 合法新值：键过 Pattern、值过值 schema',
    });
    out.push({
      id: `P-${tag}-set-existing-key-legal`,
      path: spec.path,
      key: existingKey,
      base: { ...base },
      payload: { op: 'set', value: legal1 },
      expectTarget: 'accept',
      note: '既有键整值替换（旧值不读）',
    });
    out.push({
      id: `P-${tag}-set-new-key-illegal-value`,
      path: spec.path,
      key: spec.keyPrefix === 'id-' ? 'id-9' : 'zz9',
      base: { ...base },
      payload: { op: 'set', value: illegal0 },
      expectTarget: 'reject',
      note: '新值非法 → 写入前拒绝（issue 指向 [...mapPath, key, ...值内路径]）',
    });
    out.push({
      id: `P-${tag}-set-existing-key-illegal-value`,
      path: spec.path,
      key: existingKey,
      base: { ...base },
      payload: { op: 'set', value: illegal0 },
      expectTarget: 'reject',
      note: '既有键 + 非法新值 → 拒绝（旧值不读、不阻断新值判定）',
    });
    out.push({
      id: `P-${tag}-delete-existing`,
      path: spec.path,
      key: existingKey,
      base: { ...base },
      payload: { op: 'delete' },
      expectTarget: 'accept',
      note: 'delete 在场键：空对象合法 ⇒ 删除永不使 Record 变非法（仅域规则）',
    });
    out.push({
      id: `P-${tag}-delete-absent-noop`,
      path: spec.path,
      key: otherKey,
      base: { ...base },
      payload: { op: 'delete' },
      expectTarget: 'reject',
      note: 'delete 缺席键：拒 no-op（不查键 Pattern——域规则先于 schema 判定）',
    });

    if (spec.keyPattern !== undefined) {
      out.push({
        id: `P-${tag}-set-bad-key-legal-value`,
        path: spec.path,
        key: otherKey,
        base: { ...base },
        payload: { op: 'set', value: legal1 },
        expectTarget: 'reject',
        note: '键 Pattern 违规 + 合法值 → 仅键 issue（键违规不阻断值校验，无值 issue）',
      });
      out.push({
        id: `P-${tag}-set-bad-key-illegal-value`,
        path: spec.path,
        key: otherKey,
        base: { ...base },
        payload: { op: 'set', value: illegal0 },
        expectTarget: 'reject',
        note: '键 Pattern 违规 + 非法值 → 两 issue，序 = 键先值后（全收集语义）',
      });
    }
  }

  // 污染仅落在**目标键位之内** → 旧新同判（整值替换修复旧值 / 删除非法键位本身）。
  const pollutedItem = { name: 'a', qty: 999 };
  out.push({
    id: 'E-tasks-set-overwrite-polluted-target',
    path: ['tasks'],
    key: 't1',
    base: { t1: pollutedItem },
    payload: { op: 'set', value: { name: 'z', qty: 1 } },
    expectTarget: 'accept',
    note: 'set 整值替换：目标键位旧值非法不阻断（旧值不读，与 kind=target 的 R6 同款）',
  });
  out.push({
    id: 'E-tasks-delete-polluted-target',
    path: ['tasks'],
    key: 't1',
    base: { t1: pollutedItem },
    payload: { op: 'delete' },
    expectTarget: 'accept',
    note: 'delete 目标键位本身非法：删除使 map 更合法 → 照常成功',
  });
  out.push({
    id: 'E-codes-set-polluted-target-key',
    path: ['codes'],
    key: 'nope',
    base: { nope: { name: 'a', qty: 1 } },
    payload: { op: 'set', value: { name: 'z', qty: 1 } },
    expectTarget: 'reject',
    note: '目标键位本身违反 Pattern：仅目标键 issue（旧值不读）',
  });

  // 封闭对象 parent delete：静态必填判定全矩阵（干净基线）。
  for (const spec of PARENT_PATH_SPECS) {
    const tag = String(spec.path[spec.path.length - 1]);
    for (const field of spec.fields) {
      const base = spec.base();
      if (field.kind === 'required') {
        out.push({
          id: `P-${tag}-delete-required-${field.name}`,
          path: spec.path,
          key: field.name,
          base,
          payload: { op: 'delete' },
          expectTarget: 'reject',
          note: `必填字段（非 unknown 标量）delete → 静态拒绝：缺少必填字段 "${field.name}"`,
        });
      } else {
        out.push({
          id: `P-${tag}-delete-${field.kind}-${field.name}`,
          path: spec.path,
          key: field.name,
          base,
          payload: { op: 'delete' },
          expectTarget: 'accept',
          note: `${field.kind === 'optional' ? 'optional' : 'unknown 标量必填'}字段 delete → 静态允许（不读父值）`,
        });
      }
      out.push({
        id: `P-${tag}-delete-absent-noop-${field.name}`,
        path: spec.path,
        key: field.name,
        base: withoutField(base, field.name),
        payload: { op: 'delete' },
        expectTarget: 'reject',
        note: `字段缺席（has=false）→ 拒 no-op，与必填性无关`,
      });
    }
  }
  // 污染落在目标键位内（字段值非法）→ 静态判定与数据无关。
  out.push({
    id: 'E-obj-delete-polluted-target-required',
    path: ['obj'],
    key: 'req',
    base: { ...objBase(), req: 42 },
    payload: { op: 'delete' },
    expectTarget: 'reject',
    note: '目标字段必填：值形态非法不影响静态拒绝（同一 issue）',
  });
  out.push({
    id: 'E-obj-delete-polluted-target-optional',
    path: ['obj'],
    key: 'opt',
    base: { ...objBase(), opt: 'x' },
    payload: { op: 'delete' },
    expectTarget: 'accept',
    note: '目标字段 optional：删除其非法值照常成功',
  });

  // 随机组（确定性）：基线合法、键/值/在场性随机，覆盖接受与拒绝两支。
  const rnd = mulberry32(440);
  for (let i = 0; i < 60; i++) {
    if (i % 3 !== 2) {
      // Record 组
      const spec = RECORD_PATH_SPECS[i % RECORD_PATH_SPECS.length]!;
      const pools = poolsFor(spec.valueKind);
      const n = Math.floor(rnd() * 4); // 0..3 条
      const base = cleanRecordBase(rnd, spec, n);
      const tag = `${String(spec.path[spec.path.length - 1])}-${i}`;
      if (rnd() < 0.6) {
        const existingKeys = Object.keys(base);
        const useExisting = existingKeys.length > 0 && rnd() < 0.35;
        const key = useExisting
          ? existingKeys[Math.floor(rnd() * existingKeys.length)]!
          : rnd() < 0.25
            ? spec.badKey
            : legalKey(spec, n + Math.floor(rnd() * 3));
        const legalBranch = rnd() < 0.6;
        const valuePool = legalBranch ? pools.legal : pools.illegal;
        const chosen = valuePool[Math.floor(rnd() * valuePool.length)]!;
        const keyOk = spec.keyPattern === undefined || new RegExp(spec.keyPattern).test(key);
        const valueIsLegal = legalBranch;
        out.push({
          id: `R-${tag}-set`,
          path: spec.path,
          key,
          base,
          payload: { op: 'set', value: chosen },
          expectTarget: keyOk && valueIsLegal ? 'accept' : 'reject',
          note: `随机 set（entries=${n}, key=${JSON.stringify(key)}, keyOk=${keyOk}, valueLegal=${valueIsLegal}）`,
        });
      } else {
        const existingKeys = Object.keys(base);
        const useExisting = existingKeys.length > 0 && rnd() < 0.7;
        const key = useExisting
          ? existingKeys[Math.floor(rnd() * existingKeys.length)]!
          : rnd() < 0.4
            ? spec.badKey
            : legalKey(spec, n + Math.floor(rnd() * 3));
        out.push({
          id: `R-${tag}-delete`,
          path: spec.path,
          key,
          base,
          payload: { op: 'delete' },
          expectTarget: Object.hasOwn(base, key) ? 'accept' : 'reject',
          note: `随机 delete（entries=${n}, key=${JSON.stringify(key)}, has=${Object.hasOwn(base, key)}）`,
        });
      }
    } else {
      // parent 组：静态必填矩阵 + 在场性随机。
      const spec = PARENT_PATH_SPECS[i % PARENT_PATH_SPECS.length]!;
      const field = spec.fields[Math.floor(rnd() * spec.fields.length)]!;
      const present = field.kind === 'required' ? true : rnd() < 0.6;
      const base = present ? spec.base() : withoutField(spec.base(), field.name);
      const tag = `${String(spec.path[spec.path.length - 1])}-${i}`;
      out.push({
        id: `R-${tag}-delete`,
        path: spec.path,
        key: field.name,
        base,
        payload: { op: 'delete' },
        expectTarget: !Object.hasOwn(base, field.name) ? 'reject' : field.kind === 'required' ? 'reject' : 'accept',
        note: `随机 parent delete（field=${field.name}, kind=${field.kind}, has=${Object.hasOwn(base, field.name)}）`,
      });
    }
  }
  return out;
}

/**
 * 触达面组（ADR 0034 决策 4）：污染位于**目标键位之外**。全量 oracle 因触达整个
 * map/父值而连带拒绝；目标行为是「目标键位合法即成功」（accept 支）或「只报目标键位
 * 的静态 issue」（reject 支）——两组逐字节可分，是等价集比较非空转的敏感性证据。
 */
export function buildTouchSurfaceCases(): EntryCase[] {
  const item = { name: 'a', qty: 1 };
  const pollutedItem = { name: 'b', qty: 999 };
  const pollutedUnion = { label: 'l', n: 99 };
  return [
    {
      id: 'X-tasks-set-polluted-sibling',
      path: ['tasks'],
      key: 't3',
      base: { t1: item, t2: pollutedItem },
      payload: { op: 'set', value: { name: 'z', qty: 2 } },
      expectTarget: 'accept',
      note: 'map 触达面 = map 载体 + 目标键位：邻位污染不阻断合法新键写入',
    },
    {
      id: 'X-tasks-delete-polluted-sibling',
      path: ['tasks'],
      key: 't1',
      base: { t1: item, t2: pollutedItem },
      payload: { op: 'delete' },
      expectTarget: 'accept',
      note: 'delete 只判在场：邻位污染不阻断（旧语义为连带拒绝）',
    },
    {
      id: 'X-blobs-set-polluted-sibling',
      path: ['blobs'],
      key: 'b3',
      base: { b1: item, b2: pollutedUnion },
      payload: { op: 'set', value: { label: 'm', n: 3 } },
      expectTarget: 'accept',
      note: '值位 union 的 Record：邻位污染不阻断（entry 整值替换，不读旧值）',
    },
    {
      id: 'X-outer-inner-delete-polluted-sibling',
      path: ['outer', 'inner'],
      key: 'n1',
      base: { n1: item, n2: pollutedItem },
      payload: { op: 'delete' },
      expectTarget: 'accept',
      note: '嵌套 Record：邻位污染不阻断 delete（issue 路径前缀 = [...mapPath, key]）',
    },
    {
      id: 'X-codes-set-legal-key-polluted-key',
      path: ['codes'],
      key: 'id-9',
      base: { 'bad key': item, 'id-1': item },
      payload: { op: 'set', value: { name: 'z', qty: 2 } },
      expectTarget: 'accept',
      note: '键 Pattern 污染（键位之外）不阻断合法新键写入',
    },
    {
      id: 'X-codes-delete-legal-key-polluted-key',
      path: ['codes'],
      key: 'id-1',
      base: { 'bad key': item, 'id-1': item },
      payload: { op: 'delete' },
      expectTarget: 'accept',
      note: 'delete 只判在场：其他键的 Pattern 违规不阻断',
    },
    {
      id: 'X-codes-set-bad-key-on-polluted',
      path: ['codes'],
      key: 'nope',
      base: { 'bad key': item },
      payload: { op: 'set', value: { name: 'z', qty: 2 } },
      expectTarget: 'reject',
      note: '目标键 Pattern 违规照常拒绝，但只报目标键位（不连带邻位污染）',
    },
    {
      id: 'X-obj-opt-delete-polluted-sibling',
      path: ['obj'],
      key: 'opt',
      base: { ...objBase(), child: { deep: 5 } },
      payload: { op: 'delete' },
      expectTarget: 'accept',
      note: '封闭对象 delete 触达面 = 父载体 + 目标键位：同胞字段值不重验',
    },
    {
      id: 'X-obj-req-delete-polluted-sibling',
      path: ['obj'],
      key: 'req',
      base: { ...objBase(), child: { deep: 5 } },
      payload: { op: 'delete' },
      expectTarget: 'reject',
      note: '静态必填拒绝照常，但 issue 只落在目标键位（不连带同胞污染）',
    },
    {
      id: 'X-panel-unk-delete-polluted-sibling',
      path: ['panel', 'node'],
      key: 'unk',
      base: { ...panelBase(), opt: 'x' },
      payload: { op: 'delete' },
      expectTarget: 'accept',
      note: '嵌套封闭对象：optional/unknown delete 静态允许，同胞污染不阻断',
    },
  ];
}
