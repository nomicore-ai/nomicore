/**
 * @nomicore/doc-runtime — 载体级窗口原语（ADR 0028 缝 1 / issue #368 W1）：
 * `readArrayWindowAtPath` / `readMapWindowAtPath` —— `readLogicalValueAtPath` 的姊妹读，
 * schema-independent：对 path 终点容器做**确定性选窗**并只物化入选项。
 *
 * 规范权威：ADR 0028（窗口读——readArray/readMap 的确定性选窗；决策 1–9）；
 * 落地设计（非规范，历史证据）：`wiki/raw/task_issue-368_design.md`（D1–D12）与
 * 验收契约 `packages/doc-runtime/test/issue-368-window-read-contract-red.test.ts`。
 *
 * 编排（镜像姊妹 G0 → OPT → N0 → N1 → P1；设计 §8.1）：
 * - G0 path 形态守卫：非数组 → `PATH_NOT_ALLOWED`（DOCRT-E100 前缀，与姊妹逐字同款）；
 * - OPT options/orderBy/where 封闭形状校验（D9 + ADR 0029 §2/§6）：非法 →
 *   `WINDOW_OPTIONS_INVALID`，零 doc 触碰、零 `[[Get]]`、零 accessor 执行、trap 异常收编；
 * - N0 `probeRoot`（只碰 'ROOT'）；ROOT 非 Y.Map → `PATH_NOT_ALLOWED`；
 * - N1 导航循环：段纪律/载体分类/失败分类沿用姊妹（read.ts 逐条镜像），**唯一分歧** =
 *   姊妹的缺席吸收位（缺键/数组越界）改判 `WINDOW_TARGET_ABSENT`（响亮，不吸收——决策 7）；
 * - C 目标载体面检查：数组面收 attached Y.Array / plain array，键面收 attached Y.Map /
 *   plain object；detached → `PATH_NOT_ALLOWED`；其余 → `WINDOW_CARRIER_MISMATCH`；
 * - E/S+W 候选枚举 + 原始排序键分类 + 全序排序（决策 5；D3 值键语义、D4 `Number.isFinite`
 *   门、D10 码点比较器）：O(N) 枚举 + field 基每 child 恰一次单段下钻，
 *   未入选子树零物化（决策 8）；
 * - W 内联过滤（ADR 0029 §2–§4；issue #382 P2）：`where` 在场时在候选枚举循环内逐候选评估
 *   合取谓词（每 child 每 term 恰一次单段原始读 `drillField`）：field 缺席 / 条目不可下钻 /
 *   值非标量 / 值 non-finite / 稀疏空洞 → **安静不匹配**（脏项不挤掉正常项、不炸读、
 *   未匹配候选零物化）——管线序 **where（候选筛选）→ orderBy（匹配集总序）→ n（窗口前缀）**；
 *   `where` 缺席时 E 阶段逐字节不变（array 面零元素读）；
 * - M 逐入选项物化：`entry.value := readLogicalValueAtPath(doc, [...path, 身份], 同预算)`
 *   （决策 4 组合式 depth；两轴均缺席 → 两参 legacy 调用）——任一项失败即整窗失败
 *   （D8 透传 `PATH_NOT_ALLOWED`：fail-fast、无半窗、无静默跳项、无补位）；
 * - A 装配：成功 `{ok:true, value:[{index|key, value}…], total}` 恰三键
 *   （ADR 0029 §5/§8：`total` 键恒在——无 `where` = 候选标识计数，由 C/E 段同一次枚举
 *   顺带产出，零额外遍历、零额外物化；有 `where` = `undefined`，匹配总数恒不承诺）；
 *   顶层 try/catch（E100 镜像）→ `PATH_NOT_ALLOWED`，绝不二次抛。
 *
 * 复制纪律（设计 D2 / SA2-F4）：`read.ts` **零 diff**（冻结面）；本模块按需复制其模块私有
 * 助手（下方每个复制件头注释带 `copied from read.ts@36a73bb (<原名>)` 出处标记），
 * read.ts 冻结解除时逐函数对账并可评估抽共享模块。
 *
 * 失败词表：三枚窗口域稳定码 `WINDOW_TARGET_ABSENT` / `WINDOW_CARRIER_MISMATCH` /
 * `WINDOW_OPTIONS_INVALID` + 投影域透传成员 `PATH_NOT_ALLOWED`（D8：入选项物化失败 /
 * 导航纪律位 / E100）。全部同步返回、响亮不抛；模块级零可变态、零 memo、零订阅。
 */
import * as Y from 'yjs';
import { carrierOf, probeRoot } from './carrier.js';
import { readLogicalValueAtPath } from './read.js';
import type { ReadLogicalValueAtPathOptions } from './read.js';

// ── 公共类型面（设计 D11；`verbatimModuleSyntax` 下经 `export type` 导出）──────────────

/** 排序方向；缺省 `'asc'`（ADR 0028 决策 2）。 */
export type WindowDir = 'asc' | 'desc';

/** 数组面排序项（`readArrayWindowAtPath` 专属）：按项值总序排序，平局锚 = 下标 asc。 */
export type IndexWindowTerm = { by: 'index'; dir?: WindowDir };
/** 键面键基排序项（`readMapWindowAtPath` 缺省）：键码点序。 */
export type KeyWindowTerm = { by: 'key'; dir?: WindowDir };
/** 键面值属性基排序项：v1 恰单段字面键（点号不拆分）。 */
export type FieldWindowTerm = { field: string; dir?: WindowDir };
/** ADR 0028 决策 2 的 WindowTerm 闭合联合（v1 单对象；多字段演进 = 变项列表）。 */
export type WindowTerm = IndexWindowTerm | KeyWindowTerm | FieldWindowTerm;

/**
 * ADR 0029 §2 谓词项 v1（issue #382 P2）：单段**字面**键（点号不拆分）+ 标量闭集等值
 * （`string | number | boolean | null`；number 须 `Number.isFinite`，运行时校验）。
 * `where` 数组 = **合取**（全部满足）；形状永不再变——演进只走「数组项形态加法」
 * （`in` / 范围 / OR / NOT / 多段 field / 容器深相等一律 v1 词表外响亮拒绝）。
 */
export type WhereTerm = {
  field: string;
  equals: string | number | boolean | null;
};

/** v1 `where` 数组长度上限（ADR 0029 §2 哨兵值；恰 16 合法、17 非法）。 */
const WHERE_TERM_LIMIT = 16;

/** 数组面窗口 options（B-3）：`n` 必填 ≥1 有限整数；预算两轴语义同 ADR-0024。 */
export interface ReadArrayWindowOptions {
  n: number;
  orderBy?: IndexWindowTerm;
  depth?: number;
  maxChildrenPerNode?: number;
  where?: readonly WhereTerm[];
}

/** 键面窗口 options（B-3）：`orderBy` 为 `by:'key'` 或单段 `field`。 */
export interface ReadMapWindowOptions {
  n: number;
  orderBy?: KeyWindowTerm | FieldWindowTerm;
  depth?: number;
  maxChildrenPerNode?: number;
  where?: readonly WhereTerm[];
}

/** 数组面条目（ADR 0028 决策 3）：身份随行、值不含容器壳。 */
export interface ArrayWindowEntry {
  index: number;
  value: unknown;
}

/** 键面条目（ADR 0028 决策 3）：键是条目字段值而非属性名（敌意键免疫）。 */
export interface MapWindowEntry {
  key: string;
  value: unknown;
}

/** 窗口失败码：三枚窗口域稳定码 + 投影域透传成员（D8）。 */
export type WindowFailureCode =
  | 'WINDOW_TARGET_ABSENT'
  | 'WINDOW_CARRIER_MISMATCH'
  | 'WINDOW_OPTIONS_INVALID'
  | 'PATH_NOT_ALLOWED';

/** 窗口失败结算：path 为实参/项路径的新鲜副本；message 恒非空（D9/B-5）。 */
export interface WindowReadFailure {
  ok: false;
  code: WindowFailureCode;
  path: readonly (string | number)[];
  message: string;
}

/**
 * 数组面结算联合：成功恰三键 `{ok,value,total}`（ADR 0029 §5；`total` **键恒在**：
 * 无 `where` = 候选标识计数（与 `value` 同一次枚举产出）；有 `where` = `undefined`
 * ——匹配总数恒不承诺）。失败成员形状不变（B-5 恰四键）。
 */
export type ReadArrayWindowResult =
  | { ok: true; value: ArrayWindowEntry[]; total: number | undefined }
  | WindowReadFailure;
/** 键面结算联合：成功恰三键 `{ok,value,total}`（同上：键面 `total` = 非 undefined 值键数）。 */
export type ReadMapWindowResult =
  | { ok: true; value: MapWindowEntry[]; total: number | undefined }
  | WindowReadFailure;

// ── 公共入口（B-1/B-2/B-3；仅经 src/index.ts 对外）────────────────────────────────────

/**
 * 数组面窗口读：对 `path` 终点序列容器（attached Y.Array / plain array）确定性选窗。
 * 排序键 = 项值本身（D3 钉死：类型组总序 + 下标 asc 恒定平局锚），窗口 = 有序基前
 * `min(n, 候选数)` 项；每项物化 ≡ `readLogicalValueAtPath(doc, [...path, index], 同预算)`。
 * `where` 在场时管线序 = **where（候选筛选）→ orderBy（匹配集总序）→ n（前缀）**，
 * 结算 `total` 为 `undefined`（匹配总数恒不承诺，ADR 0029 §4/§5）。
 */
export function readArrayWindowAtPath(
  doc: Y.Doc,
  path: readonly (string | number)[],
  options: ReadArrayWindowOptions,
): ReadArrayWindowResult {
  const core = windowCore(doc, path, options, 'array');
  if (!core.ok) return core;
  return { ok: true, value: core.value as ArrayWindowEntry[], total: core.total };
}

/**
 * 键面容窗口读：对 `path` 终点键容器（attached Y.Map / plain object）确定性选窗。
 * 排序基 = 键码点序（缺省）或单段值属性（D5 字面键）；不可比组恒居尾、身份锚恒 asc。
 * `where` 语义同数组面（对称获得；ADR 0029 §4）。
 */
export function readMapWindowAtPath(
  doc: Y.Doc,
  path: readonly (string | number)[],
  options: ReadMapWindowOptions,
): ReadMapWindowResult {
  const core = windowCore(doc, path, options, 'map');
  if (!core.ok) return core;
  return { ok: true, value: core.value as MapWindowEntry[], total: core.total };
}

// ── 内部类型 ─────────────────────────────────────────────────────────────────────────

type Path = readonly (string | number)[];
type WindowFace = 'array' | 'map';

/** 内核结算：成功条目列表 + 候选/匹配计数 → 结算值域（面专属字段由公共入口包装）+ 失败联合。 */
type WindowCoreResult = { ok: true; value: unknown[]; total: number | undefined } | WindowReadFailure;

/** 归一化排序项：`index` 基（数组面值键）/ `key` 基 / `field` 基（单段字面键）。 */
type NormalizedTerm =
  | { kind: 'index'; field: ''; dir: WindowDir }
  | { kind: 'key'; field: ''; dir: WindowDir }
  | { kind: 'field'; field: string; dir: WindowDir };

/** 校验后的谓词项（防御性浅拷贝产物；与调用方对象零别名）。 */
type NormalizedWhereTerm = { field: string; equals: string | number | boolean | null };

/** 校验后的窗口 options（`undefined` 轴 = 缺席；`-0` 已归一 0；`where` 缺席 = 不过滤）。 */
interface ValidatedWindowOptions {
  n: number;
  depth: number | undefined;
  maxChildrenPerNode: number | undefined;
  term: NormalizedTerm;
  where: readonly NormalizedWhereTerm[] | undefined;
}

/** 排序键分类（决策 5 + D4）：组 0 有限 number → 组 1 string → 组 2 不可比（恒居尾）。 */
type SortKey = { group: 0; value: number } | { group: 1; value: string } | { group: 2 };

/** 候选子项：id = 数组下标 / 键串；sort = 原始排序键分类（零物化）。 */
interface Candidate {
  id: number | string;
  sort: SortKey;
}

// ── 内核（两入口共用骨架）────────────────────────────────────────────────────────────

function windowCore(doc: Y.Doc, path: unknown, options: unknown, face: WindowFace): WindowCoreResult {
  try {
    // G0 — path 形态守卫（姊妹镜像；message 带 DOCRT-E100 前缀）。
    if (!Array.isArray(path)) {
      return windowFailure('PATH_NOT_ALLOWED', [], 'DOCRT-E100: path 必须是段数组（readonly (string | number)[]）');
    }
    const segments = path as Path; // G0 后必为数组；段类型由导航逐段校验（姊妹同款）

    // OPT — options/orderBy 封闭形状校验（D9；V2 镜像：非法 options 在 N0 前短路 → 零 doc 触碰）。
    const validated = validateWindowOptions(options, face);
    if (!validated.ok) return windowFailure('WINDOW_OPTIONS_INVALID', segments, validated.msg);

    // N0 — ROOT 探针（唯一 doc 触碰入口；C4 镜像）。
    const probe = probeRoot(doc);
    if (probe.carrier !== 'Y.Map') {
      return windowFailure('PATH_NOT_ALLOWED', segments, `ROOT 载体非 Y.Map（实际 ${probe.carrier}）`);
    }

    // N1 — 导航循环（段纪律/载体分类/失败分类沿用姊妹；缺席位改判 WINDOW_TARGET_ABSENT）。
    const nav = navigate(probe.map, segments);
    if (!nav.ok) return windowFailure(nav.code, segments, nav.message);

    // C/E+W — 目标载体面检查（face 词表 + detached 前置）+ 候选枚举/内联过滤（原始键，零物化）。
    const collected = collectCandidates(nav.target, face, validated.value.term, validated.value.where);
    if (!collected.ok) return windowFailure(collected.code, segments, collected.message);
    const candidates = collected.candidates;

    // S — 全序排序（组序恒定 → 组内值序 dir 敏感 → 身份 asc 恒定锚）；窗口 = 前 min(n, N)。
    const dirMul: 1 | -1 = validated.value.term.dir === 'desc' ? -1 : 1;
    candidates.sort((a, b) => compareCandidates(a, b, face, dirMul));
    const kept = Math.min(validated.value.n, candidates.length);

    // M/A — 逐入选项物化（fail-fast 透传）+ 条目列表装配（字面量构造，身份随行）。
    const entries: unknown[] = [];
    for (let i = 0; i < kept; i++) {
      const candidate = candidates[i] as Candidate;
      const itemPath: Path = [...segments, candidate.id];
      const materialized = materializeItem(doc, itemPath, validated.value);
      if (!materialized.ok) return windowFailure('PATH_NOT_ALLOWED', itemPath, materialized.message);
      if (face === 'array') entries.push({ index: candidate.id as number, value: materialized.value });
      else entries.push({ key: candidate.id as string, value: materialized.value });
    }
    // A 装配：`total` 键恒在——无 where = 候选标识计数（E 段同一次枚举产出，零额外遍历）；
    // 有 where = `undefined`（匹配总数恒不承诺；过滤后 candidates.length 恰为匹配数但有意不报告，
    // ADR 0029 §5：total 可见性不得依赖实现路径）。
    return { ok: true, value: entries, total: validated.value.where === undefined ? candidates.length : undefined };
  } catch (err) {
    // 崩溃边界 E100 镜像（safeDetail 收编敌意抛出物；绝不二次抛）。
    return windowFailure('PATH_NOT_ALLOWED', path, `DOCRT-E100: 内部错误（意外异常）: ${safeDetail(err)}`);
  }
}

// ── 失败构造（D8/D9：path 新鲜副本；message 恒非空；own 键集 = {code,ok,path,message}）──

function windowFailure(code: WindowFailureCode, path: unknown, message: string): WindowReadFailure {
  return { code, ok: false, path: safeSpreadPath(path), message };
}

/** copied from read.ts@36a73bb (safeSpreadPath) —— read.ts 零 diff 红线下复制；read.ts 冻结解除时逐函数对账。 */
function safeSpreadPath(path: unknown): Array<string | number> {
  if (!Array.isArray(path)) return [];
  try {
    return [...path];
  } catch {
    return [];
  }
}

/** copied from read.ts@36a73bb (safeDetail) —— read.ts 零 diff 红线下复制；read.ts 冻结解除时逐函数对账。 */
function safeDetail(err: unknown): string {
  try {
    const raw = err instanceof Error ? err.message : String(err);
    return typeof raw === 'string' ? raw : 'unstringifiable';
  } catch {
    return 'unstringifiable';
  }
}

/** 诊断词汇（message 非契约字段）：非法 options 的实际类型。 */
function describeOptions(raw: unknown): string {
  if (raw === null) return 'null';
  if (Array.isArray(raw)) return 'array';
  return typeof raw;
}

// ── OPT 阶段：options / orderBy / where 封闭形状校验（D9 + ADR 0029 §2/§6 判据）──────────

function validateWindowOptions(
  raw: unknown,
  face: WindowFace,
): { ok: true; value: ValidatedWindowOptions } | { ok: false; msg: string } {
  try {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return { ok: false, msg: `window options 必须是封闭形状的 plain 对象（实际 ${describeOptions(raw)}）` };
    }
    const proto = Object.getPrototypeOf(raw);
    if (proto !== Object.prototype && proto !== null) {
      return { ok: false, msg: 'window options 宿主必须是 Object.prototype 或 null 原型的 plain 对象' };
    }
    let n: number | undefined;
    let depth: number | undefined;
    let maxChildrenPerNode: number | undefined;
    let rawOrderBy: unknown;
    let hasOrderBy = false;
    let rawWhere: unknown;
    let hasWhere = false;
    for (const key of Object.keys(raw)) {
      // W-1 键集门：白名单恰五键（ADR 0029 §1 加法；未知键在场即拒，含 present-undefined）。
      if (key !== 'n' && key !== 'orderBy' && key !== 'depth' && key !== 'maxChildrenPerNode' && key !== 'where') {
        return { ok: false, msg: `window options 含未知键（封闭形状）：${key}` };
      }
      const desc = Object.getOwnPropertyDescriptor(raw, key);
      if (desc === undefined) continue; // 敌意 ownKeys 谎报的键：无 descriptor ≡ 非 own 属性，忽略
      if (desc.get !== undefined || desc.set !== undefined) {
        return { ok: false, msg: `window options.${key} 不得为 accessor（零 accessor 执行纪律）` };
      }
      const value = desc.value;
      if (value === undefined) continue; // W-3 键在场、值 undefined ≡ 缺席（顶层已知轴豁免）
      if (key === 'n') {
        // 窗口 n 必填且 ≥1（异于预算轴 ≥0）：0/-0/-1/非整数/非有限/非 number 一律非法（G3）。
        if (typeof value !== 'number' || !Number.isInteger(value) || !Number.isFinite(value) || value < 1) {
          return { ok: false, msg: 'window options.n 必须是 ≥1 的有限整数（n:0 非法，计数请走正常读）' };
        }
        n = value;
      } else if (key === 'depth' || key === 'maxChildrenPerNode') {
        if (typeof value !== 'number' || !Number.isInteger(value) || !Number.isFinite(value) || value < 0) {
          return { ok: false, msg: `window options.${key} 必须是 ≥0 的有限整数` };
        }
        const normalized = value === 0 ? 0 : value; // -0 ≡ 0
        if (key === 'depth') depth = normalized;
        else maxChildrenPerNode = normalized;
      } else if (key === 'where') {
        rawWhere = value;
        hasWhere = true;
      } else {
        rawOrderBy = value;
        hasOrderBy = true;
      }
    }
    if (n === undefined) return { ok: false, msg: 'window options.n 缺失（窗口读必填 ≥1 有限整数）' };
    const term = validateOrderBy(hasOrderBy ? rawOrderBy : undefined, face);
    if (!term.ok) return term;
    const where = validateWhere(hasWhere ? rawWhere : undefined);
    if (!where.ok) return where;
    return { ok: true, value: { n, depth, maxChildrenPerNode, term: term.term, where: where.where } };
  } catch {
    return { ok: false, msg: 'window options 探测期异常（敌意对象）——已收编为 WINDOW_OPTIONS_INVALID' };
  }
}

// ── OPT/W 阶段：`where` 谓词列表封闭形状校验（ADR 0029 §2/§6 判据 W-4–W-13）──────────────
//
// 全部探测在 descriptor 纪律下进行（零 `[[Get]]`、零 accessor 执行），任何 trap 抛出由本函数
// 的 try 与 `validateWindowOptions` 外层 try 双重收编 → 响亮 `WINDOW_OPTIONS_INVALID`，零外抛。
// 校验产物为**新鲜 plain 对象数组**（防御性浅拷贝：与调用方对象/数组零别名，调用后改写原实参
// 不影响已生效的过滤语义——OPT 之后 E+W 只消费该快照）。

function validateWhere(
  raw: unknown,
): { ok: true; where: readonly NormalizedWhereTerm[] | undefined } | { ok: false; msg: string } {
  if (raw === undefined) return { ok: true, where: undefined }; // 缺席 ≡ 不过滤（要全集 = 不传 where）
  try {
    // W-4 数组性门：仅普通数组（Y.Array / 类数组 / 标量一律拒）。
    if (!Array.isArray(raw)) {
      return { ok: false, msg: `window options.where 必须是 WhereTerm 数组（实际 ${describeOptions(raw)}）` };
    }
    // W-5 长度门：经 descriptor 读 `length`（与元素读同纪律，杜绝 Proxy `length` get trap）。
    const lenDesc = Object.getOwnPropertyDescriptor(raw, 'length');
    if (lenDesc === undefined || lenDesc.get !== undefined || lenDesc.set !== undefined) {
      return { ok: false, msg: 'window options.where.length 必须是 data 属性（零 accessor 执行纪律）' };
    }
    const len = lenDesc.value;
    if (typeof len !== 'number' || !Number.isInteger(len) || len < 0) {
      return { ok: false, msg: 'window options.where.length 必须是非负整数' };
    }
    if (len === 0) {
      return { ok: false, msg: 'window options.where 不得为空数组（「要全集」的唯一写法是不传 where）' };
    }
    if (len > WHERE_TERM_LIMIT) {
      return { ok: false, msg: `window options.where 最多 ${WHERE_TERM_LIMIT} 项（实际 ${len} 项）` };
    }
    const out: NormalizedWhereTerm[] = [];
    for (let i = 0; i < len; i++) {
      // W-6 元素读纪律：逐下标 descriptor 读（仅索引空间 0..len-1；非索引 own 属性不参与语义）。
      const itemDesc = Object.getOwnPropertyDescriptor(raw, String(i));
      if (itemDesc === undefined) {
        return { ok: false, msg: `window options.where[${i}] 缺失（稀疏空洞非法）` };
      }
      if (itemDesc.get !== undefined || itemDesc.set !== undefined) {
        return { ok: false, msg: `window options.where[${i}] 不得为 accessor（零 accessor 执行纪律）` };
      }
      const term = validateWhereTerm(itemDesc.value, i);
      if (!term.ok) return term;
      out.push(term.term);
    }
    return { ok: true, where: out };
  } catch {
    return { ok: false, msg: 'window options.where 探测期异常（敌意数组）——已收编为 WINDOW_OPTIONS_INVALID' };
  }
}

/** 单项 WhereTerm 校验（W-7–W-12）：恰 `field`/`equals` 两键、plain 原型链、零强制转换。 */
function validateWhereTerm(
  raw: unknown,
  index: number,
): { ok: true; term: NormalizedWhereTerm } | { ok: false; msg: string } {
  // W-7 元素值：WhereTerm 层无 present-undefined 豁免（与顶层 W-3 的豁免边界相反）。
  if (raw === undefined || raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, msg: `window options.where[${index}] 必须是 plain 对象（实际 ${describeWhereItem(raw)}）` };
  }
  try {
    // W-8 元素宿主：Object.prototype 或 null 原型链（class 实例 / 数组 / Map / 函数 → 拒）。
    const proto = Object.getPrototypeOf(raw);
    if (proto !== Object.prototype && proto !== null) {
      return { ok: false, msg: `window options.where[${index}] 宿主必须是 Object.prototype 或 null 原型的 plain 对象` };
    }
    let field: unknown;
    let hasField = false;
    let equals: unknown;
    let hasEquals = false;
    for (const key of Object.keys(raw)) {
      // W-9 元素键集：白名单恰两键（未知键在场即拒，含 present-undefined 未知键）。
      if (key !== 'field' && key !== 'equals') {
        return { ok: false, msg: `window options.where[${index}] 含未知键（封闭形状）：${key}` };
      }
      const desc = Object.getOwnPropertyDescriptor(raw, key);
      if (desc === undefined) continue; // 敌意 ownKeys 谎报的键：无 descriptor ≡ 非 own 属性
      if (desc.get !== undefined || desc.set !== undefined) {
        return { ok: false, msg: `window options.where[${index}].${key} 不得为 accessor（零 accessor 执行纪律）` };
      }
      if (key === 'field') {
        field = desc.value;
        hasField = true;
      } else {
        equals = desc.value;
        hasEquals = true;
      }
    }
    // W-12 必填闭环：两键皆必填（无可选键、无判别互斥）。
    if (!hasField || !hasEquals) {
      return { ok: false, msg: `window options.where[${index}] 必须恰含 field 与 equals 两键（皆必填）` };
    }
    // W-10 `field`：恰 string（空串合法；零强制转换——绝不调 toString）。
    if (typeof field !== 'string') {
      return { ok: false, msg: `window options.where[${index}].field 必须是字符串（v1 单段字面键，零强制转换）` };
    }
    // W-11 `equals`：标量闭集 + finite 门；**禁 truthiness 校验**（''/0/false/null 全合法）。
    const checked = validateWhereEquals(equals);
    if (!checked.ok) {
      return { ok: false, msg: `window options.where[${index}].equals 必须是 string | number(finite) | boolean | null` };
    }
    return { ok: true, term: { field, equals: checked.value } };
  } catch {
    return { ok: false, msg: `window options.where[${index}] 探测期异常（敌意对象）——已收编为 WINDOW_OPTIONS_INVALID` };
  }
}

/** `equals` 闭集校验（W-11）：string/boolean 直收；number 须 `Number.isFinite`；null 收；其余拒。 */
function validateWhereEquals(
  raw: unknown,
): { ok: true; value: string | number | boolean | null } | { ok: false } {
  if (raw === null) return { ok: true, value: null };
  const kind = typeof raw;
  if (kind === 'string' || kind === 'boolean') return { ok: true, value: raw as string | boolean };
  if (kind === 'number') {
    if (!Number.isFinite(raw as number)) return { ok: false }; // NaN / ±Infinity → 响亮
    return { ok: true, value: raw as number };
  }
  return { ok: false }; // undefined / object / array / bigint / symbol / function / Date / Map …
}

/** 诊断词汇（message 非契约字段）：where 项的实际类型。 */
function describeWhereItem(raw: unknown): string {
  if (raw === null) return 'null';
  if (Array.isArray(raw)) return 'array';
  return typeof raw;
}

/** orderBy 单 WindowTerm 封闭校验（D9 face 词表 + G4/G5/G7）；缺省项：数组 `index` / 键面 `key`。 */
function validateOrderBy(raw: unknown, face: WindowFace): { ok: true; term: NormalizedTerm } | { ok: false; msg: string } {
  if (raw === undefined) {
    return face === 'array'
      ? { ok: true, term: { kind: 'index', field: '', dir: 'asc' } }
      : { ok: true, term: { kind: 'key', field: '', dir: 'asc' } };
  }
  try {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return { ok: false, msg: `orderBy 必须是单个 WindowTerm 对象（v1 单对象、非列表；实际 ${describeOptions(raw)}）` };
    }
    const proto = Object.getPrototypeOf(raw);
    if (proto !== Object.prototype && proto !== null) {
      return { ok: false, msg: 'orderBy 宿主必须是 Object.prototype 或 null 原型的 plain 对象' };
    }
    let by: unknown;
    let hasBy = false;
    let field: unknown;
    let hasField = false;
    let dir: WindowDir = 'asc';
    for (const key of Object.keys(raw)) {
      if (key !== 'by' && key !== 'field' && key !== 'dir') {
        return { ok: false, msg: `orderBy 含未知键（封闭形状）：${key}` };
      }
      const desc = Object.getOwnPropertyDescriptor(raw, key);
      if (desc === undefined) continue;
      if (desc.get !== undefined || desc.set !== undefined) {
        return { ok: false, msg: `orderBy.${key} 不得为 accessor（零 accessor 执行纪律）` };
      }
      const value = desc.value;
      if (value === undefined) continue;
      if (key === 'by') {
        by = value;
        hasBy = true;
      } else if (key === 'field') {
        field = value;
        hasField = true;
      } else {
        if (value !== 'asc' && value !== 'desc') {
          return { ok: false, msg: `orderBy.dir 必须是 'asc' 或 'desc'（实际 ${String(value)}）` };
        }
        dir = value;
      }
    }
    if (hasBy === hasField) {
      return { ok: false, msg: 'orderBy 判别键必须恰现其一（by 与 field 互斥且不可全缺）' };
    }
    if (hasBy) {
      if (by !== 'index' && by !== 'key') {
        return { ok: false, msg: `orderBy.by 必须是 'index' 或 'key'（实际 ${String(by)}）` };
      }
      if (by === 'index') {
        if (face !== 'array') return { ok: false, msg: "语境外排序项：readMap 不接受 by:'index'（决策 2 v1 词表）" };
        return { ok: true, term: { kind: 'index', field: '', dir } };
      }
      if (face !== 'map') return { ok: false, msg: "语境外排序项：readArray 不接受 by:'key'（决策 2 v1 词表）" };
      return { ok: true, term: { kind: 'key', field: '', dir } };
    }
    if (typeof field !== 'string') {
      return { ok: false, msg: 'orderBy.field 必须是单段字符串（v1 恰单段，段数组非法）' };
    }
    if (face !== 'map') return { ok: false, msg: '语境外排序项：readArray 不接受 field（决策 2 v1 词表）' };
    return { ok: true, term: { kind: 'field', field, dir } };
  } catch {
    return { ok: false, msg: 'orderBy 探测期异常（敌意对象）——已收编为 WINDOW_OPTIONS_INVALID' };
  }
}

// ── N1 导航（姊妹逐条镜像；唯一分歧 = 缺席位改判 WINDOW_TARGET_ABSENT）────────────────

type NavResult =
  | { ok: true; target: unknown }
  | { ok: false; code: 'WINDOW_TARGET_ABSENT' | 'PATH_NOT_ALLOWED'; message: string };

function navigate(root: Y.Map<unknown>, path: Path): NavResult {
  let cur: unknown = root;
  for (let i = 0; i < path.length; i++) {
    const seg = path[i] as unknown; // 运行时野段（symbol 等）由下游 typeof 判拒，零抛点
    const c = navClassify(cur);
    switch (c.k) {
      case 'ymap': {
        if (typeof seg !== 'string') return notAllowedNav(segMsg(i, seg, 'Y.Map', 'string'));
        const v = c.v.get(seg);
        if (v === undefined) return absentNav(); // 姊妹吸收位 → 窗口响亮（决策 7）
        cur = v;
        break;
      }
      case 'yarray': {
        if (!isNonNegInt(seg)) return notAllowedNav(segMsg(i, seg, 'Y.Array', '非负整数'));
        if (seg >= c.v.length) return absentNav(); // 姊妹越界吸收位 → 窗口响亮
        const v = c.v.get(seg);
        if (v === undefined) return notAllowedNav('数组位置 undefined 不可导航');
        cur = v;
        break;
      }
      case 'plainObject': {
        if (typeof seg !== 'string') return notAllowedNav(segMsg(i, seg, 'plain object', 'string'));
        const hit = readableOwnDataValue(c.v, seg); // D5 键空间助手（descriptor 读，零 accessor 执行）
        if (!hit.hit) return absentNav(); // 键空间外 ≡ 缺席（姊妹吸收位 → 窗口响亮）
        cur = hit.value;
        break;
      }
      case 'plainArray': {
        if (!isNonNegInt(seg)) return notAllowedNav(segMsg(i, seg, 'plain array', '非负整数'));
        const hit = readableArrayElement(c.v, seg);
        if (hit.kind === 'none') return absentNav(); // 越界吸收位 → 窗口响亮
        if (hit.kind === 'violation') return notAllowedNav(hit.msg); // 空洞/undefined/accessor 下标 → 纪律位
        cur = hit.value;
        break;
      }
      case 'xml':
        return notAllowedNav('Y.XmlFragment 是不可下钻终态（语义字符串）');
      case 'text':
        return notAllowedNav('未知 Yjs shared type（Y.Text 家族）不可下钻——无 toJSON fallback');
      case 'unknownShared':
        return notAllowedNav(`未知 Yjs shared type（${c.word}）不可下钻——无 toJSON fallback`);
      case 'detached':
        return notAllowedNav(`detached Yjs 载体（${c.word}，未集成 doc）不可读——拒绝静默空投影`);
      case 'scalar':
        return notAllowedNav('标量不可作为容器');
      case 'nonPlainObject':
        return notAllowedNav('非 plain 原型对象不可下钻');
      case 'violation':
        return notAllowedNav(c.msg);
    }
  }
  return { ok: true, target: cur };
}

function absentNav(): NavResult {
  return { ok: false, code: 'WINDOW_TARGET_ABSENT', message: '目标缺席（中间/终点键不在或数组越界；窗口读不做缺席吸收）' };
}

function notAllowedNav(message: string): NavResult {
  return { ok: false, code: 'PATH_NOT_ALLOWED', message };
}

// ── C/E+W 目标载体面检查 + 候选枚举/内联过滤（决策 8 + ADR 0029 §3/§4：O(N) 原始枚举、
//    field 基每 child 一次单段下钻、where 在场时逐候选一次单段谓词下钻、未匹配零物化）──────

/** 目标分类（face 专属窄化）：`ok` 携带面符容器；detached 面符但不可读；其余载体不符。 */
type TargetClassification<T> =
  | { kind: 'ok'; target: T }
  | { kind: 'detached'; word: string }
  | { kind: 'mismatch'; word: string };

type CandidateCollection =
  | { ok: true; candidates: Candidate[] }
  | { ok: false; code: 'PATH_NOT_ALLOWED' | 'WINDOW_CARRIER_MISMATCH'; message: string };

function collectCandidates(
  rawTarget: unknown,
  face: WindowFace,
  term: NormalizedTerm,
  where: readonly NormalizedWhereTerm[] | undefined,
): CandidateCollection {
  if (face === 'array') {
    const target = classifyArrayTarget(rawTarget);
    if (target.kind === 'detached') {
      return { ok: false, code: 'PATH_NOT_ALLOWED', message: `detached Yjs 载体（${target.word}，未集成 doc）不可读——拒绝静默空窗` };
    }
    if (target.kind === 'mismatch') {
      return { ok: false, code: 'WINDOW_CARRIER_MISMATCH', message: `数组面收 Y.Array / plain array（实际 ${target.word}）` };
    }
    return { ok: true, candidates: enumerateArrayCandidates(target.target, where) };
  }
  const target = classifyMapTarget(rawTarget);
  if (target.kind === 'detached') {
    return { ok: false, code: 'PATH_NOT_ALLOWED', message: `detached Yjs 载体（${target.word}，未集成 doc）不可读——拒绝静默空窗` };
  }
  if (target.kind === 'mismatch') {
    return { ok: false, code: 'WINDOW_CARRIER_MISMATCH', message: `键面收 Y.Map / plain object（实际 ${target.word}）` };
  }
  return { ok: true, candidates: enumerateMapCandidates(target.target, term, where) };
}

function classifyArrayTarget(v: unknown): TargetClassification<Y.Array<unknown> | unknown[]> {
  if (v instanceof Y.AbstractType) {
    if ((v as { doc: unknown }).doc === null) return { kind: 'detached', word: yjsWord(v) };
    if (v instanceof Y.Array) return { kind: 'ok', target: v };
  }
  if (Array.isArray(v)) return { kind: 'ok', target: v };
  return { kind: 'mismatch', word: describeCarrierWord(v) };
}

function classifyMapTarget(v: unknown): TargetClassification<Y.Map<unknown> | Record<string, unknown>> {
  if (v instanceof Y.AbstractType) {
    if ((v as { doc: unknown }).doc === null) return { kind: 'detached', word: yjsWord(v) };
    if (v instanceof Y.Map) return { kind: 'ok', target: v };
  }
  if (v !== null && typeof v === 'object' && !Array.isArray(v) && isPlainRecord(v)) {
    return { kind: 'ok', target: v as Record<string, unknown> };
  }
  return { kind: 'mismatch', word: describeCarrierWord(v) };
}

function describeCarrierWord(v: unknown): string {
  if (v === null) return 'null';
  if (v instanceof Y.AbstractType) return yjsWord(v);
  if (Array.isArray(v)) return 'plain array';
  if (typeof v === 'object') return isPlainRecord(v) ? 'plain object' : 'non-plain object';
  return typeof v;
}

function enumerateArrayCandidates(
  target: Y.Array<unknown> | unknown[],
  where: readonly NormalizedWhereTerm[] | undefined,
): Candidate[] {
  const out: Candidate[] = [];
  // index 基 = 位置序（ADR 0028 决策 2：「asc = 自 [0] 取」，desc 自尾部取；issue #376）：
  // 排序键 = 下标本身（数值组、键唯一 → 无平局、组序纪律自动满足），**不是元素值**——
  // 值序纪律（类型组序/平局锚/码点序，决策 5）属 key/field 值基（map 面），对位置基无适用
  // 对象。按元素值排序会使容器元素（记录数组）全落不可比组 → 平局锚吞掉 dir（desc 与
  // asc 逐位相同），标量数组 asc/desc 亦非「自 [0] 取 / 自尾部取」。元素值的读取纪律
  // （Y.Array 原始读 / plain array descriptor 读）归入选后的姊妹物化（现行 fail-fast 不变）。
  //
  // where 在场（ADR 0029 §3/§4）：枚举位逐下标**原始读一次**评估谓词；不可读下标
  // （越界/空洞/undefined 元素/下标 accessor）与不可下钻元素值 → **安静不匹配**（跳过，
  // 不入选、不物化）——与无 where 路径的「入选后物化判 violation → PATH_NOT_ALLOWED」
  // 有意分界：过滤在选窗前，脏元素不入选即不入物化位。where 缺席时本函数逐字节不变
  // （数组面零元素读）。
  if (target instanceof Y.Array) {
    const len = target.length;
    for (let i = 0; i < len; i++) {
      if (where !== undefined && !whereMatches(target.get(i), where)) continue;
      out.push({ id: i, sort: { group: 0, value: i } });
    }
    return out;
  }
  for (let i = 0; i < target.length; i++) {
    if (where !== undefined) {
      const hit = readableArrayElement(target, i);
      if (hit.kind !== 'ok') continue; // 空洞/undefined/accessor 下标 → 安静不匹配
      if (!whereMatches(hit.value, where)) continue;
    }
    out.push({ id: i, sort: { group: 0, value: i } });
  }
  return out;
}

function enumerateMapCandidates(
  target: Y.Map<unknown> | Record<string, unknown>,
  term: NormalizedTerm,
  where: readonly NormalizedWhereTerm[] | undefined,
): Candidate[] {
  const out: Candidate[] = [];
  if (target instanceof Y.Map) {
    for (const k of target.keys()) {
      const child = target.get(k);
      if (child === undefined) continue; // D6：显式 undefined 值键出条目空间（载体同构）
      if (where !== undefined && !whereMatches(child, where)) continue; // E+W：未匹配候选零物化
      const sort = term.kind === 'field' ? classifySortKey(drillField(child, term.field)) : classifySortKey(k);
      out.push({ id: k, sort });
    }
    return out;
  }
  for (const k of Object.keys(target)) {
    const hit = readableOwnDataValue(target, k); // accessor/non-enumerable/undefined 值 → 键空间外
    if (!hit.hit) continue;
    if (where !== undefined && !whereMatches(hit.value, where)) continue;
    const sort = term.kind === 'field' ? classifySortKey(drillField(hit.value, term.field)) : classifySortKey(k);
    out.push({ id: k, sort });
  }
  return out;
}

/**
 * 合取谓词评估（ADR 0029 §2–§4；E+W 内联过滤位）：数组序短路，任一 term 不匹配即整体不匹配。
 * 下钻复用 `drillField` 单段原始读（与 orderBy field 基同源，绝不整项物化/递归）；
 * `undefined`（field 缺席 / 显式 undefined / detached / 条目不可下钻）⇒ **安静不匹配**
 * （`equals: null` 亦不匹配缺席——`undefined` 不是 `null`）。
 */
function whereMatches(child: unknown, where: readonly NormalizedWhereTerm[]): boolean {
  for (const term of where) {
    const value = drillField(child, term.field);
    if (value === undefined) return false;
    if (!matchesWhereTerm(value, term.equals)) return false;
  }
  return true;
}

/**
 * 单 term 标量等值判定（ADR 0029 §2/§3）：typeof 标量闭集门（`true ≠ 1`、`'5' ≠ 5`）
 * + `Number.isFinite` 门（NaN/±Infinity 安静不匹配）+ 严格 `===`（`-0 ≡ 0`）；
 * 非标量值（容器/载体/数组/函数）恒不匹配——绝不 `[[Get]]` 下钻、绝不深相等。
 */
function matchesWhereTerm(value: unknown, equals: string | number | boolean | null): boolean {
  if (equals === null) return value === null;
  if (typeof value !== typeof equals) return false;
  if (typeof value === 'number') return Number.isFinite(value) && value === equals;
  if (typeof value === 'string' || typeof value === 'boolean') return value === equals;
  return false;
}

/**
 * field 基单段下钻（D5）：每 child **恰一次**原始读，绝不整项物化。orderBy field 基与
 * `where` 谓词（ADR 0029 §4）共用本件（同 child 同 field 的两次单段读不去重——成本上界
 * N×16 次原始读即 where 项数上限的存在理由；调用全程同步、doc 无并发写）。
 * - Y.Map child：`get(field)`（原始值）；
 * - plain object child：`readableOwnDataValue` 同款 descriptor 读（零 accessor 执行）；
 * - detached Yjs child：零触碰归尾组（budgetFold B16 先例）——`where` 语义下 `undefined`
 *   即安静不匹配；Y.Array/XmlFragment/Text/未知 shared、标量、plain array、非 plain 对象：
 *   字段不可解析 ≡ 缺失 → 尾组 / 安静不匹配。
 */
function drillField(child: unknown, field: string): unknown {
  if (child instanceof Y.AbstractType) {
    if ((child as { doc: unknown }).doc === null) return undefined;
    if (child instanceof Y.Map) return child.get(field);
    return undefined;
  }
  if (child !== null && typeof child === 'object' && isPlainRecord(child)) {
    const hit = readableOwnDataValue(child as Record<string, unknown>, field);
    return hit.hit ? hit.value : undefined;
  }
  return undefined;
}

/** 排序键分类（决策 5 + D4）：number 组成员资格用 `Number.isFinite`；其余不可比归尾组。 */
function classifySortKey(v: unknown): SortKey {
  if (typeof v === 'number' && Number.isFinite(v)) return { group: 0, value: v };
  if (typeof v === 'string') return { group: 1, value: v };
  return { group: 2 };
}

// ── S 全序比较器（组序恒定 → 组内值序 dir 敏感 → 身份 asc 恒定锚）──────────────────────

function compareCandidates(a: Candidate, b: Candidate, face: WindowFace, dirMul: 1 | -1): number {
  const byGroup = compareSortKeys(a.sort, b.sort, dirMul);
  if (byGroup !== 0) return byGroup;
  // 平局锚恒 asc（不随 dir 翻转）；身份唯一 → 比较器为全序，不依赖 sort 稳定性。
  if (face === 'array') return (a.id as number) - (b.id as number);
  return compareCodePoints(a.id as string, b.id as string);
}

function compareSortKeys(a: SortKey, b: SortKey, dirMul: 1 | -1): number {
  if (a.group !== b.group) return a.group - b.group; // 组间序恒定（dir 只翻转组内序）
  if (a.group === 0 && b.group === 0) {
    if (a.value === b.value) return 0;
    return (a.value < b.value ? -1 : 1) * dirMul;
  }
  if (a.group === 1 && b.group === 1) {
    const c = compareCodePoints(a.value, b.value);
    return c === 0 ? 0 : c * dirMul;
  }
  return 0; // 组 2：不可比组内全部平局 → 身份锚恒定
}

/**
 * 码点迭代比较器（D10 / SA2-F2；read.ts 无此件——本模块新建）：
 * JS 关系运算符按 UTF-16 码元序（`\uFFFD` 会排在代理对之后），string 组排序键与
 * 键面身份锚共用本比较器（逐码点字典序，短前缀者小）；禁 `localeCompare`（locale 依赖）。
 */
function compareCodePoints(a: string, b: string): number {
  let ia = 0;
  let ib = 0;
  while (ia < a.length && ib < b.length) {
    const ca = a.codePointAt(ia);
    const cb = b.codePointAt(ib);
    if (ca === undefined || cb === undefined) break; // 不可达防御
    if (ca !== cb) return ca < cb ? -1 : 1;
    ia += ca > 0xffff ? 2 : 1;
    ib += cb > 0xffff ? 2 : 1;
  }
  return (a.length - ia) - (b.length - ib);
}

// ── M 逐项物化（决策 4 组合式 depth；D8 透传 fail-fast）───────────────────────────────

function materializeItem(
  doc: Y.Doc,
  itemPath: Path,
  options: ValidatedWindowOptions,
): { ok: true; value: unknown } | { ok: false; message: string } {
  if (options.depth === undefined && options.maxChildrenPerNode === undefined) {
    // 两轴均缺席 → 两参 legacy 调用（姊妹无 options 语义逐字）。
    const r = readLogicalValueAtPath(doc, itemPath);
    return r.ok ? { ok: true, value: r.value } : { ok: false, message: failureMessage(r.message) };
  }
  const budget: ReadLogicalValueAtPathOptions = {};
  if (options.depth !== undefined) budget.depth = options.depth;
  if (options.maxChildrenPerNode !== undefined) budget.maxChildrenPerNode = options.maxChildrenPerNode;
  const r = readLogicalValueAtPath(doc, itemPath, budget);
  return r.ok ? { ok: true, value: r.value } : { ok: false, message: failureMessage(r.message) };
}

/** 透传 message 恒非空（D8/SA2 非阻断观察 2）；姊妹 message 缺失时回退稳定文本。 */
function failureMessage(message: string | undefined): string {
  return message !== undefined && message.length > 0 ? message : 'PATH_NOT_ALLOWED：入选项物化失败（投影域透传）';
}

// ── 复制件（read.ts@36a73bb；出处标记约定见文件头 D2 段）────────────────────────────────

/** copied from read.ts@36a73bb (isNonNegInt) —— read.ts 零 diff 红线下复制；read.ts 冻结解除时逐函数对账。 */
function isNonNegInt(seg: unknown): seg is number {
  return typeof seg === 'number' && Number.isInteger(seg) && seg >= 0;
}

/** copied from read.ts@36a73bb (segMsg) —— read.ts 零 diff 红线下复制；read.ts 冻结解除时逐函数对账。 */
function segMsg(i: number, seg: unknown, carrier: string, expected: string): string {
  return `第 ${i} 段 ${String(seg)} 与 ${carrier} 载体不符（期望 ${expected}）`;
}

/** copied from read.ts@36a73bb (yjsWord) —— read.ts 零 diff 红线下复制；read.ts 冻结解除时逐函数对账。 */
function yjsWord(v: unknown): string {
  const ctor = (v as { constructor?: { name?: string } } | null | undefined)?.constructor?.name;
  return typeof ctor === 'string' && ctor.length > 0 ? ctor : 'Y.AbstractType';
}

/** copied from read.ts@36a73bb (isPlainRecord) —— read.ts 零 diff 红线下复制；read.ts 冻结解除时逐函数对账。 */
function isPlainRecord(v: object): boolean {
  let cur: object | null = v;
  for (let depth = 0; depth < 32; depth++) {
    const proto = Object.getPrototypeOf(cur);
    if (proto === null) return true; // Object.prototype 或 null-proto 链尾
    if (proto !== Object.prototype) {
      const desc = Object.getOwnPropertyDescriptor(proto, 'constructor');
      if (desc !== undefined) {
        if (desc.get !== undefined || desc.set !== undefined) return false;
        if (typeof desc.value === 'function' && desc.value !== (Object as unknown)) return false;
      }
    }
    cur = proto;
  }
  return false; // 超深/循环链 → 保守 loud
}

/** copied from read.ts@36a73bb (readableOwnDataValue) —— read.ts 零 diff 红线下复制；read.ts 冻结解除时逐函数对账。 */
function readableOwnDataValue(
  obj: Record<string, unknown>,
  key: string,
): { hit: true; value: unknown } | { hit: false } {
  const desc = Object.getOwnPropertyDescriptor(obj, key);
  if (desc === undefined) return { hit: false }; // 缺键 / 原型链（descriptor 不查原型链）
  if (desc.enumerable !== true) return { hit: false }; // non-enumerable 键空间外
  if (desc.get !== undefined || desc.set !== undefined) return { hit: false }; // accessor：不执行、不产出
  if (desc.value === undefined) return { hit: false }; // 吸收（D4）
  return { hit: true, value: desc.value };
}

/** copied from read.ts@36a73bb (readableArrayElement) —— read.ts 零 diff 红线下复制；read.ts 冻结解除时逐函数对账。 */
function readableArrayElement(
  arr: unknown[],
  i: number,
): { kind: 'ok'; value: unknown } | { kind: 'none' } | { kind: 'violation'; msg: string } {
  if (i >= arr.length) return { kind: 'none' }; // 越界吸收（D4）
  const desc = Object.getOwnPropertyDescriptor(arr, i);
  if (desc === undefined) return { kind: 'violation', msg: '数组位置 undefined 不可投影（稀疏空洞）' };
  if (desc.get !== undefined || desc.set !== undefined) {
    return { kind: 'violation', msg: '数组下标 accessor 不可读取（零副作用纪律）' };
  }
  if (desc.value === undefined) return { kind: 'violation', msg: '数组位置 undefined 不可投影' };
  return { kind: 'ok', value: desc.value };
}

/** 导航载体词汇表（D2 表格的机械翻译；Yjs 家族前置 detached 判别）。 */
type NavCarrier =
  | { k: 'ymap'; v: Y.Map<unknown> }
  | { k: 'yarray'; v: Y.Array<unknown> }
  | { k: 'xml'; v: Y.XmlFragment }
  | { k: 'text'; v: Y.Text }
  | { k: 'unknownShared'; v: Y.AbstractType<any>; word: string }
  | { k: 'detached'; v: Y.AbstractType<any>; word: string }
  | { k: 'plainObject'; v: Record<string, unknown> }
  | { k: 'plainArray'; v: unknown[] }
  | { k: 'scalar'; v: unknown }
  | { k: 'nonPlainObject'; v: object }
  | { k: 'violation'; v: unknown; msg: string };

/** copied from read.ts@36a73bb (navClassify) —— read.ts 零 diff 红线下复制；read.ts 冻结解除时逐函数对账。 */
function navClassify(v: unknown): NavCarrier {
  // detached 前置（R2 #2）：Yjs 家族且未集成 doc（v.doc === null，O(1) 属性读）→ 响亮失败。
  if (v instanceof Y.AbstractType) {
    if ((v as { doc: unknown }).doc === null) return { k: 'detached', v, word: yjsWord(v) };
  }
  switch (carrierOf(v)) {
    case 'Y.Map':
      return { k: 'ymap', v: v as Y.Map<unknown> };
    case 'Y.Array':
      return { k: 'yarray', v: v as Y.Array<unknown> };
    case 'Y.XmlFragment':
      return { k: 'xml', v: v as Y.XmlFragment };
    case 'Y.Text':
      return { k: 'text', v: v as Y.Text };
    case 'plain value':
      if (Array.isArray(v)) return { k: 'plainArray', v };
      if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        return { k: 'scalar', v };
      }
      if (typeof v === 'bigint') return { k: 'violation', v, msg: 'bigint 值出现在路径上（值域违规）' };
      if (typeof v === 'object') {
        if (isPlainRecord(v)) {
          return { k: 'plainObject', v: v as Record<string, unknown> };
        }
        return { k: 'nonPlainObject', v };
      }
      return { k: 'violation', v, msg: `值域违规（路径上）：${typeof v}` };
    default: {
      // carrierOf === null：AbstractType 第五类变体（已处理 detached）或 undefined/function/symbol
      if (v instanceof Y.AbstractType) return { k: 'unknownShared', v, word: yjsWord(v) };
      return { k: 'violation', v, msg: `值域违规（路径上）：${typeof v}` };
    }
  }
}
