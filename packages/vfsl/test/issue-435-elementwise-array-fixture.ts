/**
 * issue #435 SA6 一致性夹具（参数化 + 确定性随机）——ADR 0033 决策 5「数组约束逐元素
 * 可组合」的兜底执行面。
 *
 * 立法：「VFSL 数组的合法性 ⟺ 逐元素合法」是规范性承诺。本夹具生成合法基线数组上的
 * array-insert / array-delete 用例，并把**逐元素判定**（issue #435 目标接缝）与**全量
 * 整体验证**（现行 `applyMutationAtBoundary` = 整数组重建 + `validateSubtree` 整体判定，
 * issue #237 路径）的接受/拒绝结论与 issue 内容做逐字节比较。未来若有人以校验器特判引入
 * 数组级约束（长度 / 唯一性 / 有序性），全量侧会多出数组级 issue 或相反判决，本夹具红灯。
 *
 * 纪律：
 * - 只经包公共入口（`../src/index.js`）观察运行时行为；不 grep 生产源码、不 import 内部件。
 * - 用例生成确定性（mulberry32 定种子）：同输入恒同用例集，便于红/绿证据逐轮复现；
 *   同时覆盖参数化边界组（P）与随机组（R），并显式登记接受/拒绝两支，防「比较面空转」。
 * - `legacyVerdict` 是**全量整体验证 oracle**（既有公共导出，非本票实现）；`targetVerdict`
 *   由契约测试注入目标接缝（本文件不引用新名目，改名只动契约测试的绑定块）。
 * - 污染基线（polluted）用例**不进等价集**：ADR 0033 决策 4 有意把数组写触达面收窄到
 *   「载体 + 变更区间」，污染数组的 delete 由响亮拒绝变为照常成功——该差异是目标行为，
 *   由契约测试单列；此处只提供用例与判据。
 */
import { applyMutationAtBoundary, evaluate, parseVfsl, planMutationBoundary } from '../src/index.js';
import type { DerivedSchema, MutationBoundaryPlan } from '../src/index.js';

// ── schema 与夹具域 ──────────────────────────────────────────────────────────

export const ELEMENTWISE_SCHEMA_TEXT = [
  'type Item = { name: string; qty: number & Int<0, 100> };',
  'type Alt = { label: string; n: number & Int<0, 10> };',
  'type ROOT = {',
  '  items: YArray<Item>;',
  '  tags: YArray<string>;',
  '  nums: YArray<number>;',
  '  variants: YArray<Item | Alt>;',
  '  scalars: YArray<string | number>;',
  '  nested: { inner: YArray<Item> };',
  '  uarr: YArray<Item> | YArray<string>;',
  '};',
  '',
].join('\n');

let cachedDerived: DerivedSchema | undefined;

export function elementwiseDerived(): DerivedSchema {
  if (cachedDerived !== undefined) return cachedDerived;
  const parsed = parseVfsl(ELEMENTWISE_SCHEMA_TEXT);
  if (!parsed.ok) throw new Error(`夹具 schema parseVfsl 失败: ${JSON.stringify(parsed.issues)}`);
  const evaluated = evaluate(parsed.module);
  if (!evaluated.ok) throw new Error(`夹具 schema evaluate 失败: ${JSON.stringify(evaluated.issues)}`);
  cachedDerived = evaluated.derived;
  return cachedDerived;
}

/** 非 union 数组目标（fast path 候选）：路径 + 元素值域类别。 */
export type ElementKind = 'item' | 'string' | 'number' | 'variant' | 'scalar-union';

export interface ArrayPathSpec {
  readonly path: readonly (string | number)[];
  readonly elementKind: ElementKind;
}

export const ARRAY_PATH_SPECS: readonly ArrayPathSpec[] = [
  { path: ['items'], elementKind: 'item' },
  { path: ['tags'], elementKind: 'string' },
  { path: ['nums'], elementKind: 'number' },
  { path: ['variants'], elementKind: 'variant' },
  { path: ['scalars'], elementKind: 'scalar-union' },
  { path: ['nested', 'inner'], elementKind: 'item' },
];

/** union 数组目标（`YArray<Item> | YArray<string>`）——永久 legacy 轨，不进等价集。 */
export const UNION_ARRAY_PATH: readonly (string | number)[] = ['uarr'];

// ── 值池（合法 / 非法，均取自 JSON 值域）─────────────────────────────────────

const ITEM_LEGAL: readonly unknown[] = [
  { name: 'a', qty: 0 },
  { name: 'b', qty: 1 },
  { name: 'c', qty: 100 },
  { name: '', qty: 50 },
];

const ITEM_ILLEGAL: readonly unknown[] = [
  { name: 'a', qty: 101 }, // Int<0,100> 上溢
  { name: 'a', qty: -1 }, // Int<0,100> 下溢
  { name: 'a' }, // 缺必填 qty
  { qty: 1 }, // 缺必填 name
  { name: 'a', qty: 1, extra: true }, // 封闭对象未知键
  { name: 1, qty: 1 }, // name 型错
  { name: 'a', qty: '1' }, // qty 型错
  'nope', // 非对象
  null,
  3,
  [],
  {},
];

const NUMBER_LEGAL: readonly unknown[] = [0, 1, -1.5, 1000];
const NUMBER_ILLEGAL: readonly unknown[] = ['1', null, true, {}, [], { n: 1 }];

const STRING_LEGAL: readonly unknown[] = ['', 'a', 'hello'];
const STRING_ILLEGAL: readonly unknown[] = [1, null, true, {}, [], -1.5];

const ALT_LEGAL: readonly unknown[] = [
  { label: 'l', n: 0 },
  { label: 'm', n: 10 },
];

/** `YArray<Item | Alt>`（全容器形联合 → 元素级多态物化）。 */
const VARIANT_LEGAL: readonly unknown[] = [...ITEM_LEGAL, ...ALT_LEGAL];
const VARIANT_ILLEGAL: readonly unknown[] = [
  { label: 'l', n: 11 }, // Alt 上溢
  { label: 'l' }, // Alt 缺必填
  { name: 'a', qty: 101 }, // Item 上溢（Alt 无此键）
  { name: 'a', qty: 1, extra: true }, // 两成员封闭对象均拒
  { label: 'l', n: '0' }, // 型错
  'x',
  null,
  {},
  5,
];

/** `YArray<string | number>`（全标量形联合 → 原生叶子元素）。 */
const SCALAR_UNION_LEGAL: readonly unknown[] = ['a', '', 'z', 0, 1.5, -2, 1000];
const SCALAR_UNION_ILLEGAL: readonly unknown[] = [null, true, {}, [], { s: 'a' }];

interface Pools {
  readonly legal: readonly unknown[];
  readonly illegal: readonly unknown[];
}

function poolsFor(kind: ElementKind): Pools {
  switch (kind) {
    case 'item':
      return { legal: ITEM_LEGAL, illegal: ITEM_ILLEGAL };
    case 'number':
      return { legal: NUMBER_LEGAL, illegal: NUMBER_ILLEGAL };
    case 'string':
      return { legal: STRING_LEGAL, illegal: STRING_ILLEGAL };
    case 'variant':
      return { legal: VARIANT_LEGAL, illegal: VARIANT_ILLEGAL };
    case 'scalar-union':
      return { legal: SCALAR_UNION_LEGAL, illegal: SCALAR_UNION_ILLEGAL };
  }
}

/** 该元素类别的规范合法值（poolsFor 首位；契约测试构造期望锚用）。 */
export function ivLegal(kind: ElementKind): unknown {
  return poolsFor(kind).legal[0];
}

/** 该元素类别的规范非法值（poolsFor 首位；契约测试构造期望锚用）。 */
export function ivIllegal(kind: ElementKind): unknown {
  return poolsFor(kind).illegal[0];
}

// ── 确定性随机（mulberry32；种子冻结为 435）────────────────────────────────────

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

export type ArrayInsertPayload = { op: 'array-insert'; index: number; values: readonly unknown[] };
export type ArrayDeletePayload = { op: 'array-delete'; index: number; count: number };
export type ArrayMutationPayload = ArrayInsertPayload | ArrayDeletePayload;

export interface ElementwiseCase {
  readonly id: string;
  /** 数组绝对路径（plan.prefix 的冻结副本）。 */
  readonly path: readonly (string | number)[];
  /** 合法基线数组（全量 oracle 的边界提取值；进等价集前必须整体合法）。 */
  readonly base: readonly unknown[];
  readonly payload: ArrayMutationPayload;
  /** 目标接缝期望结论（自检用；等价集内与全量 oracle 恒同——polluted 组除外）。 */
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

/** 全量整体验证 oracle（既有公共导出）：整数组重建 + `validateSubtree` 整体判定。 */
export function legacyVerdict(
  derived: DerivedSchema,
  plan: MutationBoundaryPlan,
  base: readonly unknown[],
  payload: ArrayMutationPayload,
): Verdict {
  const applied = applyMutationAtBoundary(derived, plan, base, payload);
  if (applied.ok) return { ok: true, issues: [] };
  const failure = applied.result;
  if (failure.ok) return { ok: true, issues: [] }; // 形状上不可达（ok:false 支恒带 result.ok:false）
  return { ok: false, issues: failure.issues.map((issue) => ({ message: issue.message, path: [...issue.path] })) };
}

/** 目标接缝（issue #435 新导出）判决规整——接缝以参数注入，夹具不引用新名目。 */
export function targetVerdict(
  seam: (
    derived: DerivedSchema,
    plan: MutationBoundaryPlan,
    facts: { readonly length: number },
    payload: ArrayMutationPayload,
  ) => { ok: true } | { ok: false; issues: ReadonlyArray<VerdictIssue> },
  derived: DerivedSchema,
  plan: MutationBoundaryPlan,
  base: readonly unknown[],
  payload: ArrayMutationPayload,
): Verdict {
  const result = seam(derived, plan, { length: base.length }, payload);
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

export function planFor(derived: DerivedSchema, path: readonly (string | number)[], op: 'array-insert' | 'array-delete'): MutationBoundaryPlan {
  const planned = planMutationBoundary(derived, [...path], op);
  if (!planned.ok) {
    const failure = planned.result;
    throw new Error(`夹具 planMutationBoundary 失败: ${JSON.stringify(failure.ok ? [] : failure.issues)}`);
  }
  return planned.plan;
}

// ── 用例生成 ────────────────────────────────────────────────────────────────

function pick(rnd: () => number, pool: readonly unknown[]): unknown {
  return pool[Math.floor(rnd() * pool.length)]!;
}

function legalArray(rnd: () => number, kind: ElementKind, length: number): unknown[] {
  const pools = poolsFor(kind);
  const out: unknown[] = [];
  for (let i = 0; i < length; i++) out.push(pick(rnd, pools.legal));
  return out;
}

/** 等价集：合法基线上 insert/delete（含域规则越界支），全量 oracle 与目标接缝必须逐字节一致。 */
export function buildEquivalenceCases(): ElementwiseCase[] {
  const out: ElementwiseCase[] = [];
  for (const spec of ARRAY_PATH_SPECS) {
    const pools = poolsFor(spec.elementKind);
    const legal0 = pools.legal[0]!;
    const legal1 = pools.legal[1]!;
    const illegal0 = pools.illegal[0]!;
    const illegal1 = pools.illegal[1]!;
    const tag = String(spec.path[spec.path.length - 1]);
    const base2 = [legal0, legal1];

    out.push({
      id: `P-${tag}-insert-legal-at-0`,
      path: spec.path,
      base: base2,
      payload: { op: 'array-insert', index: 0, values: [legal1] },
      expectTarget: 'accept',
      note: '合法单值插入头部',
    });
    out.push({
      id: `P-${tag}-insert-legal-append`,
      path: spec.path,
      base: base2,
      payload: { op: 'array-insert', index: 2, values: [legal0] },
      expectTarget: 'accept',
      note: 'index === length（append 位）合法',
    });
    out.push({
      id: `P-${tag}-insert-empty-batch`,
      path: spec.path,
      base: base2,
      payload: { op: 'array-insert', index: 1, values: [] },
      expectTarget: 'accept',
      note: '空批量 = 恒等（无新元素可非法）',
    });
    out.push({
      id: `P-${tag}-insert-illegal-first`,
      path: spec.path,
      base: base2,
      payload: { op: 'array-insert', index: 0, values: [illegal0] },
      expectTarget: 'reject',
      note: '非法新元素在插入后位置 index+0',
    });
    out.push({
      id: `P-${tag}-insert-illegal-second`,
      path: spec.path,
      base: base2,
      payload: { op: 'array-insert', index: 1, values: [legal0, illegal0] },
      expectTarget: 'reject',
      note: '批量中第 2 个新值非法 → 整批拒绝，路径 index+1',
    });
    out.push({
      id: `P-${tag}-insert-batch-two-illegal`,
      path: spec.path,
      base: base2,
      payload: { op: 'array-insert', index: 1, values: [illegal0, legal0, illegal1] },
      expectTarget: 'reject',
      note: '批量两处非法 → 两 issue，序 = 插入位置升序（中间态不参与）',
    });
    out.push({
      id: `P-${tag}-insert-domain-overflow`,
      path: spec.path,
      base: base2,
      payload: { op: 'array-insert', index: 3, values: [legal0] },
      expectTarget: 'reject',
      note: 'index > length：不 clamp，域拒绝',
    });
    out.push({
      id: `P-${tag}-delete-legal-single`,
      path: spec.path,
      base: base2,
      payload: { op: 'array-delete', index: 0, count: 1 },
      expectTarget: 'accept',
      note: '删除合法元素（其余元素保持合法）',
    });
    out.push({
      id: `P-${tag}-delete-legal-whole`,
      path: spec.path,
      base: base2,
      payload: { op: 'array-delete', index: 0, count: 2 },
      expectTarget: 'accept',
      note: '整数组删除',
    });
    out.push({
      id: `P-${tag}-delete-domain-index-eq-len`,
      path: spec.path,
      base: base2,
      payload: { op: 'array-delete', index: 2, count: 1 },
      expectTarget: 'reject',
      note: 'index === length：越界 no-op 拒绝（不 clamp）',
    });
    out.push({
      id: `P-${tag}-delete-domain-overflow`,
      path: spec.path,
      base: base2,
      payload: { op: 'array-delete', index: 1, count: 2 },
      expectTarget: 'reject',
      note: 'index + count > length：范围越界拒绝',
    });
    out.push({
      id: `P-${tag}-delete-domain-empty-array`,
      path: spec.path,
      base: [],
      payload: { op: 'array-delete', index: 0, count: 1 },
      expectTarget: 'reject',
      note: '空数组 delete：index >= length 拒绝',
    });
  }

  // 随机组（确定性）：基线合法、值/位置/批量随机，覆盖接受与拒绝两支。
  const rnd = mulberry32(435);
  for (let i = 0; i < 60; i++) {
    const spec = ARRAY_PATH_SPECS[i % ARRAY_PATH_SPECS.length]!;
    const pools = poolsFor(spec.elementKind);
    const base = legalArray(rnd, spec.elementKind, Math.floor(rnd() * 4)); // 0..3
    const tag = `${String(spec.path[spec.path.length - 1])}-${i}`;
    if (rnd() < 0.65) {
      const index = Math.floor(rnd() * (base.length + 2)); // 越界支（len+1）亦在域内生成
      const count = Math.floor(rnd() * 3); // 0..2（空批量 = 恒等支）
      const values: unknown[] = [];
      for (let j = 0; j < count; j++) values.push(rnd() < 0.6 ? pick(rnd, pools.legal) : pick(rnd, pools.illegal));
      const illegalPresent = values.some((v) => pools.illegal.includes(v));
      out.push({
        id: `R-${tag}-insert`,
        path: spec.path,
        base,
        payload: { op: 'array-insert', index, values },
        expectTarget: index > base.length || illegalPresent ? 'reject' : 'accept',
        note: `随机 insert（len=${base.length}, index=${index}, k=${count}）`,
      });
    } else {
      // count 恒 ≥ 1：doc-runtime E3 解析层保证 array-delete count 是严格正整数，
      // 故等价集只覆盖真实调用域（index ≥ 0、count ≥ 1）；count = 0 的 legacy 行为
      // 由控制组单列锚定，不进目标契约。
      const index = base.length === 0 ? 0 : Math.floor(rnd() * (base.length + 1));
      const count = base.length === 0 ? 1 : 1 + Math.floor(rnd() * (base.length + 1));
      const inRange = base.length > 0 && index < base.length && index + count <= base.length;
      out.push({
        id: `R-${tag}-delete`,
        path: spec.path,
        base,
        payload: { op: 'array-delete', index, count },
        expectTarget: inRange ? 'accept' : 'reject',
        note: `随机 delete（len=${base.length}, index=${index}, count=${count}）`,
      });
    }
  }
  return out;
}

/**
 * 污染基线 delete 用例（**不进等价集**）：基数组含一个变更区间外的非法元素。
 * 全量 oracle 因触达「整个数组」而响亮拒绝；ADR 0033 决策 4 的目标行为是照常成功
 * （触达面 = 载体 + 变更区间）。两条用例同时充当比较判据的敏感性证明。
 */
export function buildPollutedDeleteCases(): ElementwiseCase[] {
  const out: ElementwiseCase[] = [];
  for (const spec of ARRAY_PATH_SPECS) {
    const pools = poolsFor(spec.elementKind);
    const legal = pools.legal[0]!;
    const polluted = [legal, pools.illegal[0]!, pools.legal[1]!];
    out.push({
      id: `X-${String(spec.path[spec.path.length - 1])}-delete-polluted-outside-range`,
      path: spec.path,
      base: polluted,
      payload: { op: 'array-delete', index: 0, count: 1 },
      expectTarget: 'accept',
      note: '删除区间外的元素非法：目标行为 = 照常成功（ADR 0033 决策 4）',
    });
  }
  return out;
}

/** union 数组目标的 plan（永久 legacy 轨）——fast path 闸门负例。 */
export function unionArrayPlan(derived: DerivedSchema): MutationBoundaryPlan {
  return planFor(derived, UNION_ARRAY_PATH, 'array-insert');
}
