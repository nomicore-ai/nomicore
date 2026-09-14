/**
 * @nomicore/namespace-runtime —— 窗口读组合层（ADR 0028 决策 9 第三层；issue #369 W2）。
 *
 * 职责：把 doc-runtime 载体级窗口原语（W1：确定性选窗 + 只物化入选项 + 候选标识计数）与
 * ADR-0027 投影文本渲染器组合成 lease 口径的成功恒四键面
 * `{ ok, value, schema, truncated }`——`value` = W1 条目列表原样直通、`schema` = 元素
 * 口径投影文本（锚链 + B-8 ✂ 窗口事实块）、`truncated === kept < total`（`total` 消费自
 * W1 成功结算单源）。
 *
 * 组合顺序（S3/S5/S6；S1 lifecycle gate 与 S2 W1 直通在 runtime.ts 公共方法层）：
 * - S3 `canonicalWindowBudget`：以 descriptor 纪律重读 options 四键空间
 *   （`{n, orderBy, depth, maxChildrenPerNode}`，零 `[[Get]]`）产新鲜预算对象与归一化
 *   排序项；视图不稳定（键集漂移 / accessor 显形 / 轴值非法 / trap 抛出）→ 重派发 W1
 *   一次：失败则原样返回其失败成员；竟又接受 → 接缝终态 `WINDOW_OPTIONS_INVALID`
 *   （镜像 readData `canonicalReadOptions` 的 A-2b/A-2c 两出口）；
 * - S5 锚链（B-6）：数组面单锚 `[...path, 0]`（无回退）；键面 `[...path, '<key>']` →
 *   不可解析时回退 `[...path]` 容器口径（封闭对象形）；两锚皆不可解析（含无 active
 *   schema / 路径偏离 / 敌意 path）→ `schema: null`（非读失败）。锚与 S6 pathText 共用
 *   同一 `normalizeReadPath` 快照——raw path 在组合层**恰被消费一次**；
 * - S6 结算：`kept = entries.length`、`total` = W1 结算直通（本模块零重算）、
 *   `truncated = kept < total`；`truncated ∧ schema ≠ null` 时追加 B-8 ✂ 窗口事实块
 *   （块恒「头行 + 恰一行事实行」、四插值槽确定性渲染、pathText 取自 S5 已验证快照、
 *   field 名经 `foldSegment` 折叠后再入基槽——纯呈现规则，canonical 归一化项与 S2 值
 *   通道保持 raw），块间 `\n\n`、结尾恰一个 `\n`（与渲染器拼装规则逐字同款）。
 *
 * 单源纪律（ADR 0029 §8；ADR 0028 §13 R2 执行）：候选标识计数权威在 W1（枚举/过滤/计数
 * 同源）——本模块**零计数函数、零导航/载体分类镜像**；`total` 只从 W1 成功结算直通消费，
 * 且 W1 成功已蕴含 options 权威校验通过（非法 options 零 doc 触碰）。
 *
 * 失败面：W1 三码 + `PATH_NOT_ALLOWED` 原样透传（绝不吸收、无半窗）；接缝终态由本模块构造
 * （`WindowReadFailure` 单源类型复用）——全部同步返回、响亮不抛；模块级零可变态、零缓存、
 * 零订阅、零 sequencer（读不进写 sequencer）。敌意输入零外抛：raw path 只经
 * `normalizeReadPath` 单次验证快照消费（段域 string|number），S6 折叠只见该快照——
 * `String(seg)` 对已校验段全域收敛，结构上不存在外抛通道（SA4 F-369-1）。
 *
 * 折叠规则镜像仓内既有行注入防御纪律（B-8 ②）；其出处是 `read-schema-projection.ts`
 * （非 W1 冻结面，保留）。
 */
import * as Y from 'yjs';
import { renderProjectionText, resolveSchemaAtPath } from '@nomicore/vfsl';
import type { ResolveSchemaBudgetOptions } from '@nomicore/vfsl';
import { readArrayWindowAtPath, readMapWindowAtPath } from '@nomicore/doc-runtime';
import type {
  ArrayWindowEntry,
  MapWindowEntry,
  ReadArrayWindowOptions,
  ReadMapWindowOptions,
  WindowFailureCode,
  WindowReadFailure,
} from '@nomicore/doc-runtime';
import type { RuntimeReadDisabledResult } from './runtime.js';
import type { RuntimeState } from './p0.js';
import { normalizeReadPath, projectSchemaTextBody } from './read-schema-projection.js';

// ── 公共类型面（设计 §8.1；verbatimModuleSyntax 下经 `export type` 导出）──────────────

/** 数组面窗口 options（doc-runtime 单源 type-only 别名；`n` 必填 ≥1 由 W1 单权威校验）。 */
export type NamespaceRuntimeReadArrayOptions = ReadArrayWindowOptions;
/** 键面窗口 options（同上）。 */
export type NamespaceRuntimeReadMapOptions = ReadMapWindowOptions;

/** 窗口读成功成员：恒四键（ADR 0028 决策 7）；`value` = 条目列表（W1 原样直通）。 */
export interface NamespaceRuntimeWindowReadOk<Entry> {
  readonly ok: true;
  readonly value: Entry[];
  /** 元素口径投影文本（锚链正文 + ✂ 窗口事实块）或严格 null（锚不可解析）。 */
  readonly schema: string | null;
  /** `kept < total`（窗口截断机器信号；total=0 恒 false）。 */
  readonly truncated: boolean;
}

/** 数组面窗口读结果联合：成功四键 | W1 失败成员 | lifecycle 停接纳成员。 */
export type NamespaceRuntimeReadArrayResult =
  | NamespaceRuntimeWindowReadOk<ArrayWindowEntry>
  | WindowReadFailure
  | RuntimeReadDisabledResult;

/** 键面窗口读结果联合：同款（条目身份为 key）。 */
export type NamespaceRuntimeReadMapResult =
  | NamespaceRuntimeWindowReadOk<MapWindowEntry>
  | WindowReadFailure
  | RuntimeReadDisabledResult;

// ── 组合入口（runtime.ts 公共方法层消费；S3/S5/S6）───────────────────────────────────

/** 窗口面符（面符决定锚链与条目身份字段）。 */
export type WindowFace = 'array' | 'map';

/** ✂ 窗口事实块头行（与渲染器 ✂ 段同款文法；ADR-0027 决策 1 唯一事实载体的窗口对偶）。 */
const WINDOW_TRUNCATION_HEADER = '✂ 截断事实：';

interface WindowComposeInput<Entry> {
  readonly state: RuntimeState;
  readonly path: readonly (string | number)[];
  /** 实参 options（raw 引用；canonical 只读不写、不复制进值通道）。 */
  readonly options: unknown;
  readonly face: WindowFace;
  /** W1 入选项物化产物（原样直通）。 */
  readonly entries: Entry[];
  /** W1 成功结算的候选标识计数（单源直通；本模块零重算、零兜底）。 */
  readonly total: number;
  /** S3 出口①重派发（W1 权威再校验；零 doc 触碰先于 N0）。 */
  readonly redispatch: () => { readonly ok: true; readonly value: unknown[] } | WindowReadFailure;
}

/**
 * 数组面组合入口：W1 成功后的 S3/S5/S6（runtime.ts 在 S1/S2 之后调用）。
 */
export function composeArrayWindowRead(
  state: RuntimeState,
  doc: Y.Doc,
  path: readonly (string | number)[],
  options: NamespaceRuntimeReadArrayOptions,
  entries: ArrayWindowEntry[],
  total: number,
): NamespaceRuntimeReadArrayResult {
  return composeWindowRead<ArrayWindowEntry>({
    state,
    path,
    options,
    face: 'array',
    entries,
    total,
    redispatch: () => readArrayWindowAtPath(doc, path, options),
  });
}

/**
 * 键面组合入口：W1 成功后的 S3/S5/S6（锚链为 `'<key>'` → 容器口径两级）。
 */
export function composeMapWindowRead(
  state: RuntimeState,
  doc: Y.Doc,
  path: readonly (string | number)[],
  options: NamespaceRuntimeReadMapOptions,
  entries: MapWindowEntry[],
  total: number,
): NamespaceRuntimeReadMapResult {
  return composeWindowRead<MapWindowEntry>({
    state,
    path,
    options,
    face: 'map',
    entries,
    total,
    redispatch: () => readMapWindowAtPath(doc, path, options),
  });
}

/** 两面共用骨架（S3 → S5 → S6；顺序不可换——options 合法性由 W1 单权威裁定）。 */
function composeWindowRead<Entry>(
  input: WindowComposeInput<Entry>,
): NamespaceRuntimeWindowReadOk<Entry> | WindowReadFailure {
  const { state, path, options, face, entries, total, redispatch } = input;

  // S3 canonical 接缝净化（零 [[Get]]；T1 权威已成功 ⟹ 与此判据不一致即视图不稳定）。
  const canonical = canonicalWindowBudget(options, face);
  if (!canonical.ok) {
    const reDispatch = redispatch();
    if (!reDispatch.ok) return reDispatch; // 出口①：重派发失败成员原样透传
    return seamWindowOptionsInvalid(path); // 出口②：交替视图终态（响亮失败，绝不静默）
  }

  // S5/S6 共用：raw path 的**单次**已验证快照（`normalizeReadPath`：普通数组 + 段域
  // string|number + 迭代纯度校验；敌意/异态 → null）。锚链与 ✂ 事实行 pathText 只消费本
  // 快照——绝不对实参 path 做第二次 spread（SA4 F-369-1：二次 spread 既开敌意外抛通道，
  // 又允许 pathText 描述与读取路径漂移）；快照缺席（null）⟺ 正文 null（诚实 null）。
  const segments = normalizeReadPath(path);

  // S5 schema 正文（锚链只消费 schema；锚失败 → null，非读失败）。
  const anchor = segments === null ? null : anchorSchemaBody(state, segments, face, canonical.budget);

  // S6 结算：truncated === kept < total；`total` 为 W1 结算单源直通（ADR 0029 §8 下沉——
  // 与 entries 同一次枚举产出，本模块零计数）。✂ 窗口事实块仅在截断 ∧ 正文非 null ∧
  // 快照在场的交集装配（快照缺席时正文必 null，故二者同界）。
  const kept = entries.length;
  const truncated = kept < total;
  const schema = truncated && anchor !== null && segments !== null
    ? appendWindowFacts(anchor, windowFactsBlock(segments, canonical.term, kept, total))
    : anchor;
  return { ok: true, value: entries, schema, truncated };
}

// ── S3 canonical 接缝净化（镜像 readData canonicalReadOptions 读纪律）──────────────────

/** 归一化排序项（basis = 值键/键/单段 field；dir 已归一 asc|desc）。 */
type CanonicalTerm =
  | { readonly basis: 'index'; readonly dir: 'asc' | 'desc' }
  | { readonly basis: 'key'; readonly dir: 'asc' | 'desc' }
  | { readonly basis: 'field'; readonly field: string; readonly dir: 'asc' | 'desc' };

type CanonicalWindowBudget =
  | { readonly ok: true; readonly budget: ResolveSchemaBudgetOptions; readonly term: CanonicalTerm }
  | { readonly ok: false };

/**
 * options 四键空间重读（W1 `validateWindowOptions`/`validateOrderBy` 判据镜像）：
 * `Object.keys` 键空间 + `Object.getOwnPropertyDescriptor` 取值（全程零 `[[Get]]`，
 * 零 accessor 执行）+ 整体 try 收编 trap 异常；任何判据不一致 → `{ok:false}`
 * （交出口①/②响亮处置），绝不静默、绝不外抛。预算对象为**新鲜 plain 字面量**
 * （present-undefined 剥离、-0 归一）。
 */
function canonicalWindowBudget(raw: unknown, face: WindowFace): CanonicalWindowBudget {
  try {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false };
    const proto = Object.getPrototypeOf(raw);
    if (proto !== Object.prototype && proto !== null) return { ok: false };
    let n: number | undefined;
    let depth: number | undefined;
    let maxChildrenPerNode: number | undefined;
    let rawOrderBy: unknown;
    let hasOrderBy = false;
    for (const key of Object.keys(raw)) {
      if (key !== 'n' && key !== 'orderBy' && key !== 'depth' && key !== 'maxChildrenPerNode') {
        return { ok: false }; // 键集漂移：W1 视角本应拒绝 → 视图不稳定
      }
      const desc = Object.getOwnPropertyDescriptor(raw, key);
      if (desc === undefined) continue; // ownKeys 谎报键 ≡ 非 own（与 W1 同处置）
      if (desc.get !== undefined || desc.set !== undefined) return { ok: false }; // accessor 显形
      const value = desc.value;
      if (value === undefined) continue; // present-undefined ≡ 缺席（剥离）
      if (key === 'n') {
        if (typeof value !== 'number' || !Number.isInteger(value) || !Number.isFinite(value) || value < 1) {
          return { ok: false }; // 值非法化：绝不把非法值喂给下游
        }
        n = value;
      } else if (key === 'depth' || key === 'maxChildrenPerNode') {
        if (typeof value !== 'number' || !Number.isInteger(value) || !Number.isFinite(value) || value < 0) {
          return { ok: false };
        }
        if (key === 'depth') depth = value === 0 ? 0 : value; // H10 镜像：-0 归一
        else maxChildrenPerNode = value === 0 ? 0 : value;
      } else {
        rawOrderBy = value;
        hasOrderBy = true;
      }
    }
    if (n === undefined) return { ok: false }; // W1 必填判据
    const term = canonicalOrderBy(hasOrderBy ? rawOrderBy : undefined, face);
    if (!term.ok) return { ok: false };
    const budget: { depth?: number; maxChildrenPerNode?: number } = {};
    if (depth !== undefined) budget.depth = depth;
    if (maxChildrenPerNode !== undefined) budget.maxChildrenPerNode = maxChildrenPerNode;
    return { ok: true, budget, term: term.term };
  } catch {
    return { ok: false }; // 探测期 trap 异常——收编，绝不外抛
  }
}

/** orderBy 封闭形状重读（面词表 + by/field 互斥 + dir 闭集；缺省面符基 asc）。 */
function canonicalOrderBy(
  raw: unknown,
  face: WindowFace,
): { readonly ok: true; readonly term: CanonicalTerm } | { readonly ok: false } {
  if (raw === undefined) {
    return {
      ok: true,
      term: face === 'array' ? { basis: 'index', dir: 'asc' } : { basis: 'key', dir: 'asc' },
    };
  }
  try {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false };
    const proto = Object.getPrototypeOf(raw);
    if (proto !== Object.prototype && proto !== null) return { ok: false };
    let by: unknown;
    let hasBy = false;
    let field: unknown;
    let hasField = false;
    let dir: 'asc' | 'desc' = 'asc';
    for (const key of Object.keys(raw)) {
      if (key !== 'by' && key !== 'field' && key !== 'dir') return { ok: false };
      const desc = Object.getOwnPropertyDescriptor(raw, key);
      if (desc === undefined) continue;
      if (desc.get !== undefined || desc.set !== undefined) return { ok: false };
      const value = desc.value;
      if (value === undefined) continue;
      if (key === 'by') {
        by = value;
        hasBy = true;
      } else if (key === 'field') {
        field = value;
        hasField = true;
      } else {
        if (value !== 'asc' && value !== 'desc') return { ok: false };
        dir = value;
      }
    }
    if (hasBy === hasField) return { ok: false }; // 判别键必须恰现其一
    if (hasBy) {
      if (by === 'index') {
        if (face !== 'array') return { ok: false };
        return { ok: true, term: { basis: 'index', dir } };
      }
      if (by === 'key') {
        if (face !== 'map') return { ok: false };
        return { ok: true, term: { basis: 'key', dir } };
      }
      return { ok: false };
    }
    if (typeof field !== 'string') return { ok: false };
    if (face !== 'map') return { ok: false };
    return { ok: true, term: { basis: 'field', field, dir } }; // raw field 名（折叠只在呈现层）
  } catch {
    return { ok: false };
  }
}

// ── S5 schema 锚链（B-6）────────────────────────────────────────────────────────────

/**
 * 锚链（只消费 schema，与数据无关）：
 * - 数组面：单锚 `[...segments, 0]`（无回退——off-schema 数据下容器口径会描述与值通道
 *   不符的形状，故有意不对称）；
 * - 键面：`[...segments, '<key>']`（Record 形：值树含动态键槽）→ 回退 `[...segments]`
 *   （封闭对象形：容器类型块静态枚举全部条目键与值类型）。
 * 两锚皆不可解析 → null（ADR-0027 null 单义直通；锚失败不构成读失败）。
 *
 * `segments` = S5 单点取得的 `normalizeReadPath` 快照（已验证普通数组 + 段域 string|number）；
 * 锚路径只由该快照构造（新鲜普通数组），绝不再读实参 path（SA4 F-369-1）。
 */
function anchorSchemaBody(
  state: RuntimeState,
  segments: readonly (string | number)[],
  face: WindowFace,
  budget: ResolveSchemaBudgetOptions,
): string | null {
  if (face === 'array') {
    return projectSchemaTextBody(state, [...segments, 0], budget);
  }
  const element = projectSchemaTextBody(state, [...segments, '<key>'], budget);
  if (element !== null) return element;
  return projectSchemaTextBody(state, segments, budget);
}

// ── S6 ✂ 窗口事实块（B-8 四插值槽 + 单行不变式）──────────────────────────────────────

/**
 * B-8 冻结文法（块恒「头行 + 恰一行事实行」）：
 *
 * ```
 * ✂ 截断事实：
 * - <pathText> · 窗口 · 基 <basis> <dir> · kept <n>/total <N>
 * ```
 *
 * - 槽① `pathText` = S5 单次取得的 `normalizeReadPath` 快照（已验证普通数组、段域
 *   string|number）逐段 `foldSegment` `.` 连接；空路径取渲染器 ✂ 行约定字面 `[]`。
 *   **快照缺席（敌意/异态 path）⟹ 正文 null ⟹ 本块不装配**——绝不对实参 path 做第二次
 *   spread/迭代（SA4 F-369-1：二次 spread 的 throwing-`toString` 段可在折叠处裸抛，且
 *   使 pathText 与读取路径漂移）；
 * - 槽② `basis` = 字面 `index` / `key`，或 `field:` + `foldSegment(field 名)`——field
 *   名是消费方可控任意字符串（W1 仅校验 `typeof === 'string'`），必须先经与 pathText
 *   同款折叠再拼入；折叠施加于基槽字符串全程（`index`/`key` 为 W1 校验闭合字面、
 *   前缀为常量，对 field 名全程折叠 ≡ 对全槽折叠）；
 * - 槽③ `dir` ∈ `asc` | `desc`（W1 校验闭集，缺省 asc）；
 * - 槽④ `kept <n>/total <N>` = 非负整数 `String()` 呈现（`total` = W1 结算单源直通）。
 *
 * 不变式：不可经任何插值槽注入换行——敌意 field 名不可伪造第二个 `✂ 截断事实：` 头
 * 或伪造事实行（ADR-0027 决策 1：✂ 段是截断事实唯一载体）。槽①入参恒为已验证快照的
 * string|number 段，故 `String(seg)` 全域收敛，本装配结构上零外抛。
 */
function windowFactsBlock(
  segments: readonly (string | number)[],
  term: CanonicalTerm,
  kept: number,
  total: number,
): string {
  const pathText = windowPathText(segments);
  const basis = term.basis === 'field' ? `field:${foldSegment(term.field)}` : term.basis;
  return `${WINDOW_TRUNCATION_HEADER}\n`
    + `- ${pathText} · 窗口 · 基 ${basis} ${term.dir} · kept ${String(kept)}/total ${String(total)}`;
}

/**
 * 事实块装配（B-7/B-8 拼装规则）：渲染器正文恒以恰一个 `\n` 收尾——先剥尾换行再以
 * `\n\n` 接块、结尾补恰一个 `\n`；结果 = 正文 + 恰 1 空行 + `✂ 截断事实：` 头行 +
 * 恰一行事实行 + 结尾恰一个 `\n`（与渲染器 `blocks.join('\n\n') + '\n'` 逐字同款）。
 */
function appendWindowFacts(body: string, block: string): string {
  const base = body.endsWith('\n') ? body.slice(0, -1) : body;
  return `${base}\n\n${block}\n`;
}

/** 槽①：`normalizeReadPath` 快照逐段折叠 `.` 连接；空路径取渲染器 ✂ 行约定字面 `[]`。
 *  入参恒为已验证快照（string|number 段、普通数组）——绝不消费 raw path，故零外抛
 *  （SA4 F-369-1）。 */
function windowPathText(segments: readonly (string | number)[]): string {
  if (segments.length === 0) return '[]';
  return segments.map(foldSegment).join('.');
}

/** 段呈现：`String(seg)` + 换行折叠为空格 + trim。
 *  copied from read-schema-projection.ts@ab6e390 (foldSegment) —— 行注入防御纪律镜像
 *  （B-8 ②；与渲染器 `foldText` 同款三分支正则；出处非 W1 冻结面）。 */
function foldSegment(segment: string | number): string {
  return String(segment).replace(/\r\n|\n|\r/g, ' ').trim();
}

// ── 失败构造（W1 失败成员单源类型复用；path 安全副本、message 恒非空）──────────────────

function windowFailure(code: WindowFailureCode, path: unknown, message: string): WindowReadFailure {
  return { code, ok: false, path: safePathCopy(path), message };
}

/**
 * 接缝终态成员（出口②；设计 §7.3 S3）：唯一构造触发 = 净化视图不稳定 ∧ W1 重派发又接受。
 * 形状以 `WindowReadFailure` 类型注解锁死（W1 未来改形即在此编译红）。
 */
function seamWindowOptionsInvalid(path: unknown): WindowReadFailure {
  return windowFailure(
    'WINDOW_OPTIONS_INVALID',
    path,
    'WINDOW_OPTIONS_INVALID: 视图不稳定（options 视图在读取期间漂移，敌意 descriptor/Proxy）——接缝拒绝组合窗口读',
  );
}

// ── 本地防御件（非镜像；ADR 0029 §8 镜像清账后仅存件）────────────────────────────────

/** 本地防御件（`window.ts` `safeSpreadPath` 同款纪律）：本模块两个失败构造只消费 path 的
 *  新鲜安全副本，与 W1 冻结面无关——**非镜像纪律存续**，随 ADR 0029 §8 出处标记清账归零。 */
function safePathCopy(path: unknown): Array<string | number> {
  if (!Array.isArray(path)) return [];
  try {
    return [...path];
  } catch {
    return [];
  }
}
