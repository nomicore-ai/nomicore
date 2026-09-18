/**
 * @nomicore/namespace-runtime —— 窗口读组合层（ADR 0028 决策 9 第三层；issue #369 W2）。
 *
 * 职责：把 doc-runtime 载体级窗口原语（W1：确定性选窗 + 只物化入选项 + 候选标识计数）与
 * ADR-0027 投影文本渲染器组合成 lease 口径的成功恒四键面
 * `{ ok, value, schema, truncated }`——`value` = W1 条目列表原样直通、`schema` = 元素
 * 口径投影文本（锚链 + B-8 ✂ 窗口事实块）、`truncated` 双语义（ADR 0029 §5）：
 * 无 `where` = `kept < total`（`total` 消费自 W1 成功结算单源）；有 `where` = 装满判定
 * `kept === n`（`n` = S3 canonical 预算；匹配总数恒不承诺、✂ 段永不装配）。
 *
 * 组合顺序（S3/S5/S6/S6.5；S1 lifecycle gate 与 S2 W1 直通在 runtime.ts 公共方法层）：
 * - S3 `canonicalWindowBudget`：以 descriptor 纪律重读 options 六键空间
 *   （`{n, orderBy, depth, maxChildrenPerNode, where, maxBytes}`，零 `[[Get]]`）产新鲜预算对象、
 *   归一化排序项与 canonical `n`；`maxBytes` 只做**域镜像**并原样回传（闸门权威 = canonical
 *   复读值，与 `#405` readData 面同构——`{maxBytes: undefined}` ≡ 缺席；域外 / accessor /
 *   探测期异常 → `{ok:false}` 两出口）；`where` 只做**判据镜像**（数组形态 / length descriptor /
 *   非空 / ≤16 / 逐下标 descriptor 无空洞 / 零 accessor / plain 原型链 / 恰 `field`·`equals`
 *   两键 / field 字符串 / equals 标量闭集 finite number），既不产出归一化值也不参与过滤
 *   语义（合法性单权威在 W1；S3 是接缝净化镜像而非第三套校验权威）；视图不稳定
 *   （键集漂移 / accessor 显形 / 轴值非法 / where 判据违例 / trap 抛出）→ 重派发 W1
 *   一次：失败则原样返回其失败成员；竟又接受 → 接缝终态 `WINDOW_OPTIONS_INVALID`
 *   （镜像 readData `canonicalReadOptions` 的 A-2b/A-2c 两出口）；
 * - S5 锚链（B-6）：数组面单锚 `[...path, 0]`（无回退）；键面 `[...path, '<key>']` →
 *   不可解析时回退 `[...path]` 容器口径（封闭对象形）；两锚皆不可解析（含无 active
 *   schema / 路径偏离 / 敌意 path）→ `schema: null`（非读失败）。锚与 S6 pathText 共用
 *   同一 `normalizeReadPath` 快照——raw path 在组合层**恰被消费一次**；
 * - S6 结算：`kept = entries.length`；`where` 在场判据**键于 W1 结算单源**
 *   `total === undefined`（B-4/B-8 单源不变量；绝不重读 options 判定）——无 `where`：
 *   `truncated = kept < total`，`truncated ∧ schema ≠ null` 时追加 B-8 ✂ 窗口事实块
 *   （既有快照逐字节不变）；有 `where`：`truncated = kept === canonical.n`（装满判定：
 *   `kept === n` → true 可能还有匹配未入窗；`kept < n` → false 匹配集已扫完），✂ 段
 *   **永不装配**——由分支结构保证（`appendWindowFacts` 只出现在 `total !== undefined`
 *   分支内），非布尔开关；两分支 schema 同源（元素口径锚链正文，where 不影响）。
 *   块恒「头行 + 恰一行事实行」、四插值槽确定性渲染、pathText 取自 S5 已验证快照、
 *   field 名经 `foldSegment` 折叠后再入基槽——纯呈现规则，canonical 归一化项与 S2 值
 *   通道保持 raw；块间 `\n\n`、结尾恰一个 `\n`（与渲染器拼装规则逐字同款）。
 *
 * 单源纪律（ADR 0029 §8；ADR 0028 §13 R2 执行）：候选标识计数权威在 W1（枚举/过滤/计数
 * 同源）——本模块**零计数函数、零导航/载体分类镜像、零谓词求值镜像**（`where` 镜像只做
 * 形状判据，不做匹配求值）；无 `where` 时 `total` 只从 W1 成功结算直通消费，有 `where`
 * 时满载判定只消费 S3 canonical `n`（`total` 恒不参与），且 W1 成功已蕴含 options 权威
 * 校验通过（非法 options 零 doc 触碰）。
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
import { renderProjectionText, resolveSchemaAtPath } from '@nomicore/vfsl';
import type { ResolveSchemaBudgetOptions } from '@nomicore/vfsl';
import type {
  ArrayWindowEntry,
  FieldWindowTerm,
  IndexWindowTerm,
  KeyWindowTerm,
  MapWindowEntry,
  WhereTerm,
  WindowFailureCode,
  WindowReadFailure,
} from '@nomicore/doc-runtime';
import type { ReadDataBudgetExceededResult, RuntimeReadDisabledResult } from './runtime.js';
import type { RuntimeState } from './p0.js';
import { deliveryBytes, readBudgetExceeded } from './read-budget.js';
import { normalizeReadPath, projectSchemaTextBody } from './read-schema-projection.js';

// ── 公共类型面（设计 §8.1；verbatimModuleSyntax 下经 `export type` 导出）──────────────

/**
 * 数组面窗口 options（ADR 0031 决策 1/4 经 **#406 修订**）：runtime 自持**六键闭合形状**
 * `{ n, orderBy?, depth?, maxChildrenPerNode?, where?, maxBytes? }`。
 *
 * #369 时曾为 doc-runtime 五键单源**纯别名**（零复制）；ADR 0031 把 `maxBytes` 的
 * **校验与度量**收回本组合层（唯一同时见到条目列表与元素口径投影文本两通道的层），而
 * doc-runtime 面**零改动**（下传 options 仍五键——`splitWindowOptions` 在拆分读处剥离
 * `maxBytes`）。故此宿主形态必须自持（纯别名形态不再成立）；doc-runtime 五键面由
 * `Omit<…,'maxBytes'>` 中继锁与 `keyof` 硬锁独立锚定。
 *
 *  - `maxBytes` 域（ADR-0031 决策 1）：**≥1 的有限整数（≤ 2^53−1）**——等价
 *    `Number.isSafeInteger(v) && v >= 1`；`0`/负数/非整数/非有限数/域外值 → 窗口面既有
 *    校验码 `WINDOW_OPTIONS_INVALID`（不新增校验码）；缺席 ≡ 不设预算（现行为逐字节不变，
 *    无魔法默认）；
 *  - EOPT 语义与五键一致：显式 `undefined` 字面量对 TS 调用者是编译错误；运行时「键在场、
 *    值 undefined ≡ 缺席」（D1，沿五键 R1 纪律）；
 *  - `n` 必填 ≥1 及其余五键判据由 W1（doc-runtime `validateWindowOptions`）单权威校验。
 */
export interface NamespaceRuntimeReadArrayOptions {
  n: number;
  orderBy?: IndexWindowTerm;
  depth?: number;
  maxChildrenPerNode?: number;
  where?: readonly WhereTerm[];
  maxBytes?: number;
}

/** 键面窗口 options（同上；`orderBy` 为 `by:'key'` 或单段 `field`）。 */
export interface NamespaceRuntimeReadMapOptions {
  n: number;
  orderBy?: KeyWindowTerm | FieldWindowTerm;
  depth?: number;
  maxChildrenPerNode?: number;
  where?: readonly WhereTerm[];
  maxBytes?: number;
}

/** 窗口读成功成员：恒四键（ADR 0028 决策 7）；`value` = 条目列表（W1 原样直通）。 */
export interface NamespaceRuntimeWindowReadOk<Entry> {
  readonly ok: true;
  readonly value: Entry[];
  /** 元素口径投影文本（锚链正文 + ✂ 窗口事实块）或严格 null（锚不可解析）。 */
  readonly schema: string | null;
  /**
   * 截断机器信号（ADR 0029 §5 双语义）：无 `where` = `kept < total`（精确；total=0 恒
   * false）；有 `where` = **装满判定** `kept === n`（`kept === n` → true 可能还有匹配未入
   * 窗；`kept < n` → false 匹配集已扫完、确定没有更多）。有 `where` 时不装配 ✂ 段。
   */
  readonly truncated: boolean;
}

/**
 * 数组面窗口读结果联合：成功四键 | W1 失败成员 | **预算超限零交付成员**（#406 共享，
 * 与 `readData` 面同形——`Extract<…, {code:'READ_BUDGET_EXCEEDED'}>` 双面相等） |
 * lifecycle 停接纳成员。
 */
export type NamespaceRuntimeReadArrayResult =
  | NamespaceRuntimeWindowReadOk<ArrayWindowEntry>
  | WindowReadFailure
  | ReadDataBudgetExceededResult
  | RuntimeReadDisabledResult;

/** 键面窗口读结果联合：同款（条目身份为 key）。 */
export type NamespaceRuntimeReadMapResult =
  | NamespaceRuntimeWindowReadOk<MapWindowEntry>
  | WindowReadFailure
  | ReadDataBudgetExceededResult
  | RuntimeReadDisabledResult;

// ── 组合入口（runtime.ts 公共方法层消费；S3/S5/S6）───────────────────────────────────

/** 窗口面符（面符决定锚链与条目身份字段）。 */
export type WindowFace = 'array' | 'map';

/**
 * S3 出口①重派发闭包（W1 权威再校验；零 doc 触碰先于 N0）——由 `runtime.ts` 构造
 * （#406 DD-5/DD-9：**re-split（raw 现场）+ re-W1(relay₂)**；探针计数锚 parity 的结构
 * 前提——重派发只读 relay，raw 上不再发生第二次 W1 直读）。失败成员为 W1 单源
 * `WindowReadFailure`（含 split 前置拒成员——同为窗口面 options 码单源类型）。
 */
type WindowRedispatch = () => { readonly ok: true; readonly value: unknown[] } | WindowReadFailure;

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
  /**
   * W1 成功结算的候选/匹配计数（单源直通；本模块零重算、零兜底）。值域 `number | undefined`
   * 与 W1 结算同步加宽（ADR 0029 §5）：`undefined` ⟺ W1 已应用 `where` 过滤（B-8 单源
   * 不变量）——由 `composeWindowRead` 的 S6 结算消费：有 `where` 走装满判定
   * `kept === canonical.n`（本值恒不参与），无 `where` 走精确 `kept < total`。
   */
  readonly total: number | undefined;
  /**
   * S3 出口①重派发（W1 权威再校验；零 doc 触碰先于 N0）——由 `runtime.ts` 提供
   * （#406 DD-5/DD-9：**re-split（raw 现场）+ re-W1(relay₂)**；探针计数锚 parity 的
   * 结构前提——重派发只读 relay，raw 上不再发生第二次 W1 直读）。
   */
  readonly redispatch: WindowRedispatch;
}

/**
 * 数组面组合入口：W1 成功后的 S3/S5/S6/S6.5（runtime.ts 在 S1/S2 之后调用；
 * 重派发闭包由 runtime.ts 提供——本模块不触碰 doc/W1）。
 */
export function composeArrayWindowRead(
  state: RuntimeState,
  path: readonly (string | number)[],
  options: NamespaceRuntimeReadArrayOptions,
  entries: ArrayWindowEntry[],
  total: number | undefined,
  redispatch: WindowRedispatch,
): NamespaceRuntimeReadArrayResult {
  return composeWindowRead<ArrayWindowEntry>({
    state,
    path,
    options,
    face: 'array',
    entries,
    total,
    redispatch,
  });
}

/**
 * 键面组合入口：W1 成功后的 S3/S5/S6/S6.5（锚链为 `'<key>'` → 容器口径两级）。
 */
export function composeMapWindowRead(
  state: RuntimeState,
  path: readonly (string | number)[],
  options: NamespaceRuntimeReadMapOptions,
  entries: MapWindowEntry[],
  total: number | undefined,
  redispatch: WindowRedispatch,
): NamespaceRuntimeReadMapResult {
  return composeWindowRead<MapWindowEntry>({
    state,
    path,
    options,
    face: 'map',
    entries,
    total,
    redispatch,
  });
}

/** 两面共用骨架（S3 → S5 → S6 → S6.5；顺序不可换——options 合法性由 W1 单权威裁定）。 */
function composeWindowRead<Entry>(
  input: WindowComposeInput<Entry>,
): NamespaceRuntimeWindowReadOk<Entry> | WindowReadFailure | ReadDataBudgetExceededResult {
  const { state, path, options, face, entries, redispatch } = input;
  const total = input.total;

  // S3 canonical 接缝净化（零 [[Get]]；W1 权威已成功 ⟹ 与此判据不一致即视图不稳定）。
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

  // S6 结算（ADR 0029 §5 双语义；在场判据键于 W1 结算单源 `total === undefined`——
  // 绝不重读 options 判定，故 S3 的 canonical 视图是否隐藏 `where` 不影响结算语义）：
  // - 无 where：`truncated === kept < total`（`total` = W1 结算单源直通，与 entries 同一次
  //   枚举产出，本模块零计数）；✂ 窗口事实块仅在截断 ∧ 正文非 null ∧ 快照在场的交集装配
  //   （快照缺席时正文必 null，故二者同界）——既有快照逐字节不变（AC1/F7/F8）；
  // - 有 where：`truncated === kept === canonical.n`（装满判定：匹配恰 n 亦为 true，计数型
  //   实现必被击穿）；**✂ 段永不装配**——本分支结构上不出现 `appendWindowFacts`，schema
  //   原样为元素口径锚链正文（where 不改变 schema 通道；AC2/X 组字节相等锚）。
  const kept = entries.length;
  const truncated = total === undefined ? kept === canonical.n : kept < total;
  const schema = total === undefined
    ? anchor
    : truncated && anchor !== null && segments !== null
      ? appendWindowFacts(anchor, windowFactsBlock(segments, canonical.term, kept, total))
      : anchor;

  // S6.5 预算闸（#406 / ADR 0031 决策 2/3；闸门权威 = canonical 复读值——组合层接缝单源
  // 事实）：值通道 = 条目列表（含 key/index 包装）紧凑 JSON UTF-8（`entries` 恒数组，
  // undefined 分支结构不可达）；schema 通道 = **最终装配文本**（✂ 窗口事实块 / `‡` 折叠
  // 页脚自然计入；`schema:null` 计 0）。`≤` 收（含恰等、零总量），`>` 零交付（不裁剪、
  // 不降深度、不拟合）。闸门只读不写：`truncated` 双语义与「`where` 时 ✂ 永不装配」的
  // 分支结构**已先行结算**（ADR 0029 §5/§8；预算不驱动截断信号、不产生静默条目丢弃）。
  if (canonical.maxBytes !== undefined) {
    const measuredBytes = deliveryBytes(entries, schema);
    if (measuredBytes > canonical.maxBytes) {
      return readBudgetExceeded(path, measuredBytes, canonical.maxBytes);
    }
  }
  return { ok: true, value: entries, schema, truncated };
}

// ── S3 canonical 接缝净化（镜像 readData canonicalReadOptions 读纪律）──────────────────

/** 归一化排序项（basis = 值键/键/单段 field；dir 已归一 asc|desc）。 */
type CanonicalTerm =
  | { readonly basis: 'index'; readonly dir: 'asc' | 'desc' }
  | { readonly basis: 'key'; readonly dir: 'asc' | 'desc' }
  | { readonly basis: 'field'; readonly field: string; readonly dir: 'asc' | 'desc' };

/**
 * v1 `where` 数组长度上限（ADR 0029 §2 哨兵值；恰 16 合法、17 非法）。
 *
 * 出处镜像：`packages/doc-runtime/src/window.ts` 的模块私有 `WHERE_TERM_LIMIT`（`#398` P2
 * 交付）。该常量**不导出**（导出即扩 doc-runtime 公共面，违反本票 F9 零 diff 纪律），故
 * S3 以具名模块私有常量 + 本出处注释镜像（与 doc-runtime 形态对称、单点定位，便于 Z9
 * 边界与结构审计锚定；不散落字面量）。判据漂移风险由「恰 16 合法 / 17 非法」行为锚与
 * §12.6 S4 结构审计守住。
 */
const WHERE_TERM_LIMIT = 16;

type CanonicalWindowBudget =
  | {
      readonly ok: true;
      readonly budget: ResolveSchemaBudgetOptions;
      readonly term: CanonicalTerm;
      /** S3 判定通过的 canonical `n`（原样携带、零新判据；S6 装满判定 `kept === n` 的承载）。 */
      readonly n: number;
      /** #406 闸门权威（ADR-0031 决策 2）：canonical 复读的 `maxBytes`（缺席 ≡ 不设预算）。 */
      readonly maxBytes: number | undefined;
    }
  | { readonly ok: false };

/**
 * options 六键空间重读（W1 `validateWindowOptions`/`validateOrderBy`/`validateWhere` 判据镜像
 * + #406 `maxBytes` 域镜像）：
 * `Object.keys` 键空间 + `Object.getOwnPropertyDescriptor` 取值（全程零 `[[Get]]`，
 * 零 accessor 执行）+ 整体 try 收编 trap 异常；任何判据不一致 → `{ok:false}`
 * （交出口①/②响亮处置），绝不静默、绝不外抛。预算对象为**新鲜 plain 字面量**
 * （present-undefined 剥离、-0 归一）；`where` 只做判据镜像（`canonicalWhere`），不产出
 * 归一化值、不参与过滤语义（合法性单权威在 W1）；`maxBytes` **不进** `budget`（下传
 * resolver 的 options 面恒两轴），只单独回传为闸门权威。
 *
 * `maxBytes` 判据与 `splitWindowOptions`（runtime.ts）**双点同判据**（镜像 `#405`
 * `canonicalReadOptions` × `splitReadDataOptions` 的既定形态）：非法/accessor/present-undefined
 * 处置逐字一致——`split` 演进的唯一需同步复查点即此处（注释互指锚定）。
 */
function canonicalWindowBudget(raw: unknown, face: WindowFace): CanonicalWindowBudget {
  try {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false };
    const proto = Object.getPrototypeOf(raw);
    if (proto !== Object.prototype && proto !== null) return { ok: false };
    let n: number | undefined;
    let depth: number | undefined;
    let maxChildrenPerNode: number | undefined;
    let maxBytes: number | undefined;
    let rawOrderBy: unknown;
    let hasOrderBy = false;
    let rawWhere: unknown;
    let hasWhere = false;
    for (const key of Object.keys(raw)) {
      // W-1 键集门镜像：白名单恰六键（ADR 0029 §1 + ADR 0031 决策 1 `maxBytes` 加法；
      // 未知键在场即拒，含 present-undefined）。
      if (
        key !== 'n'
        && key !== 'orderBy'
        && key !== 'depth'
        && key !== 'maxChildrenPerNode'
        && key !== 'where'
        && key !== 'maxBytes'
      ) {
        return { ok: false }; // 键集漂移：W1 视角本应拒绝 → 视图不稳定
      }
      const desc = Object.getOwnPropertyDescriptor(raw, key);
      if (desc === undefined) continue; // ownKeys 谎报键 ≡ 非 own（与 W1 同处置）
      if (desc.get !== undefined || desc.set !== undefined) return { ok: false }; // accessor 显形
      const value = desc.value;
      if (value === undefined) continue; // present-undefined ≡ 缺席（剥离；顶层已知轴豁免，B-12）
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
      } else if (key === 'where') {
        rawWhere = value;
        hasWhere = true;
      } else if (key === 'maxBytes') {
        // #406 预算域复读（与 split 同判据）：非法值 = 视图已变异 → 响亮失败（出口①/②）。
        if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
          return { ok: false };
        }
        maxBytes = value;
      } else {
        rawOrderBy = value;
        hasOrderBy = true;
      }
    }
    if (n === undefined) return { ok: false }; // W1 必填判据
    const term = canonicalOrderBy(hasOrderBy ? rawOrderBy : undefined, face);
    if (!term.ok) return { ok: false };
    // where 判据镜像（W1 同款定序：键循环 → n → orderBy → where；S3 内部单一 {ok:false}
    // 出口使序列不产生行为差异，此处只为与 W1 审计对齐）。不产出归一化值。
    if (hasWhere && !canonicalWhere(rawWhere)) return { ok: false };
    const budget: { depth?: number; maxChildrenPerNode?: number } = {};
    if (depth !== undefined) budget.depth = depth;
    if (maxChildrenPerNode !== undefined) budget.maxChildrenPerNode = maxChildrenPerNode;
    return { ok: true, budget, term: term.term, n, maxBytes };
  } catch {
    return { ok: false }; // 探测期 trap 异常——收编，绝不外抛
  }
}

// ── S3 `where` 判据镜像（非第三套权威；只回答「与 W1 已接受视图是否判据一致」）──────────
//
// 判据逐条镜像 `packages/doc-runtime/src/window.ts` `validateWhere`/`validateWhereTerm`
// （ADR 0029 §2/§6；W-4–W-13）：数组性、`length` 经 own data descriptor 的非负整数门、
// 非空、≤ `WHERE_TERM_LIMIT`、逐下标 descriptor（空洞非法）、零 accessor、元素非
// undefined/null/数组、plain 原型链、恰 `field`/`equals` 两键（皆必填）、`field` 为 string
// （空串合法）、`equals` 标量闭集（string/boolean/null 直收，number 须 `Number.isFinite`；
// 禁 truthiness 校验）。全程 `Object.keys` + `Object.getOwnPropertyDescriptor`（零 `[[Get]]`、
// 零 accessor 执行），任何 trap 抛出由本地 try 收编为「不稳定」→ 既有两出口，绝不外抛。
//
// 不产出：镜像只返回稳定/不稳定布尔——不构造归一化数组、不向下游传递、不做谓词求值
// （组合层零过滤语义参与；在场判据在 S6 单点键于 W1 结算 `total`）。

/** `where` 视图稳定性镜像（W-4–W-13；true = 与 W1 判据一致）。 */
function canonicalWhere(raw: unknown): boolean {
  try {
    // W-4 数组性门（Y.Array / 类数组 / 标量一律不稳定）。
    if (!Array.isArray(raw)) return false;
    // W-5 长度门：经 own data descriptor 读 `length`（杜绝 Proxy `length` get trap）。
    const lenDesc = Object.getOwnPropertyDescriptor(raw, 'length');
    if (lenDesc === undefined || lenDesc.get !== undefined || lenDesc.set !== undefined) return false;
    const len = lenDesc.value;
    if (typeof len !== 'number' || !Number.isInteger(len) || len < 0) return false;
    if (len === 0) return false; // 非空（要全集的唯一写法是不传 where）
    if (len > WHERE_TERM_LIMIT) return false; // ≤16（ADR 0029 §2 哨兵）
    for (let i = 0; i < len; i += 1) {
      // W-6 逐下标 descriptor 读（仅索引空间；稀疏空洞与下标 accessor 皆不稳定）。
      const itemDesc = Object.getOwnPropertyDescriptor(raw, String(i));
      if (itemDesc === undefined) return false;
      if (itemDesc.get !== undefined || itemDesc.set !== undefined) return false;
      if (!canonicalWhereTerm(itemDesc.value)) return false;
    }
    return true;
  } catch {
    return false; // 敌意数组 trap 异常——收编为不稳定
  }
}

/** 单项 `WhereTerm` 判据镜像（W-7–W-12；true = 与 W1 判据一致）。 */
function canonicalWhereTerm(raw: unknown): boolean {
  // W-7 元素值（WhereTerm 层无 present-undefined 豁免，与顶层 W-3 边界相反）。
  if (raw === undefined || raw === null || typeof raw !== 'object' || Array.isArray(raw)) return false;
  try {
    // W-8 元素宿主：Object.prototype 或 null 原型链。
    const proto = Object.getPrototypeOf(raw);
    if (proto !== Object.prototype && proto !== null) return false;
    let field: unknown;
    let hasField = false;
    let equals: unknown;
    let hasEquals = false;
    for (const key of Object.keys(raw)) {
      // W-9 元素键集：白名单恰两键（未知键在场即拒，含 present-undefined 未知键）。
      if (key !== 'field' && key !== 'equals') return false;
      const desc = Object.getOwnPropertyDescriptor(raw, key);
      if (desc === undefined) continue; // ownKeys 谎报键 ≡ 非 own
      if (desc.get !== undefined || desc.set !== undefined) return false;
      if (key === 'field') {
        field = desc.value;
        hasField = true;
      } else {
        equals = desc.value;
        hasEquals = true;
      }
    }
    if (!hasField || !hasEquals) return false; // W-12 必填闭环
    if (typeof field !== 'string') return false; // W-10 恰 string（空串合法、零强制转换）
    return isScalarEquals(equals); // W-11 标量闭集 + finite 门（禁 truthiness 校验）
  } catch {
    return false;
  }
}

/** `equals` 闭集镜像（W-11）：string/boolean 直收；number 须 `Number.isFinite`；null 收；其余拒。 */
function isScalarEquals(raw: unknown): boolean {
  if (raw === null) return true;
  const kind = typeof raw;
  if (kind === 'string' || kind === 'boolean') return true;
  if (kind === 'number') return Number.isFinite(raw as number);
  return false; // undefined / object / array / bigint / symbol / function / Date / Map …
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
