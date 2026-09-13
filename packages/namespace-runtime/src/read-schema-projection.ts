/**
 * @nomicore/namespace-runtime —— readData 投影文本组合面（issue #273 / ADR-0016；
 * issue #364 / ADR-0027 决策 1/2/3/4 交付形态换代）。
 *
 * 本模块是 `readData` 成功分支的 **schema 附加单点**（ADR-0016 §分层 L75：「namespace-runtime
 * 组合两者」）：D3a 状态守卫（无 active schema → null）+ D3b 敌意 path 规范化守卫 +
 * `resolveSchemaAtPath` 消费（resolver 只见普通数组副本）+ **投影文本组装**（头行前贴
 * → `renderProjectionText` 正文 → ✂ 段，ADR-0027 决策 2/3）。
 *
 * #364 交付形态（ADR-0027 决策 1/2/4）：
 * - 返回**投影文本** `string | null`：`headLine(规范化 path, 有效预算) + '\n\n' +
 *   renderProjectionText(resolved, 值通道 truncations)`；`null` 单义直通（无 active
 *   schema / 路径偏离 / 敌意 path），**绝非空串**；
 * - **detach 深拷贝层退役**（ADR-0027 决策 4）：渲染器进程内直读 resolver ok 产物，
 *   文本是原始值（string），天然 detached——无对象可克隆，隔离不变量由形态保证；
 *   每次读重新 resolve + render（零缓存、零 memo），`replaceSchema` 后同路径读反映新
 *   derived（无陈旧文本）；
 * - 头行事实源 = `normalizeReadPath` 产出的**普通数组快照**（实参 path 段值原样、不做
 *   别名解析）+ 预算分支的组合层 canonical 有效预算（present-undefined 剥离、-0 归一、
 *   仅 own-enumerable——`canonicalReadOptions` 现实现即此）；无预算分支省略预算段。
 *
 * 错误处置双域划界（D4，SA1 设计 §7-D3b/D4；公共契约在 NamespaceRuntime.readData JSDoc
 * 同步记录）：
 * - 敌意/异态 path（非普通数组、Proxy 或重定义 `Symbol.iterator`、长度异型、非
 *   string|number 段、path 属性读取抛出的任意异常）→ `schema: null`（ADR-0016 情形③
 *   收敛；读恒 ok、`value` 语义零影响、绝不外抛——镜像 doc-runtime `safeSpreadPath`/
 *   E100 敌意面纪律）。收编点 = `normalizeReadPath` 的**内层 try**，它只包裹敌意 path
 *   扫描（输入域），**不包裹** `resolveSchemaAtPath` / `renderProjectionText` 调用——
 *   后续维护者不得把该内层 try 误判为「F-1 前遗留的漏改」或误扩大到可信域；
 * - `InternalError`（可信域畸形 derived / 畸形投影入参：ref 目标缺失、值树引用环、
 *   两树分歧、root/ROOT 缺失等——resolver/renderer 无顶层 catch 的刻意 loud 设计）→
 *   throw 逃逸读面，internal-bug-only、生产不可达（`activeTools.derived` 恒为自身
 *   P0/SCHEMA 写槽 `compileSchemaEnvelope` ok 产物）。本模块对 resolver/renderer 调用
 *   不加任何 try/catch：`InternalError` 是唯一逃逸 throw 通道（敌意输入零 throw），
 *   且**无部分输出**（渲染器整体渲染、失败即 throw）。
 *
 * 组合顺序（D2，runtime.ts 落实）：值读先行——失败短路时本模块不可达（失败对象不带
 * schema 键）；成功读的 schema 由本模块产出（状态守卫先于 path 守卫：无 active schema
 * 时不触碰敌意对象；头行只读规范化快照——敌意对象**单读**，不会观察到与 resolver
 * 不同的第二次读视图）。
 *
 * 形状预算（issue #336 / ADR-0024 决策 5/6；#364 交付形态换代后 options 闭合形状零变化）：
 * 预算重载把 `ResolveSchemaBudgetOptions`（canonical）原样交给 `resolveSchemaAtPath`
 * 三参，并把值通道截断清单（`ReadLogicalValueTruncationEntry[]`，结构同构
 * `ProjectionTruncation`——零 cast 透传）交给渲染器第二参；无预算重载渲染器第二参缺席
 * （`undefined` ≡ `[]` 三态逐字节同，T1 已锚）。清单源 = 值通道载体计数（零合成）。
 */
import { renderProjectionText, resolveSchemaAtPath } from '@nomicore/vfsl';
import type {
  BudgetedReadDataSchemaProjection,
  ReadDataSchemaProjection,
  ResolveSchemaBudgetOptions,
} from '@nomicore/vfsl';
import type { ReadLogicalValueTruncationEntry } from '@nomicore/doc-runtime';
import type { RuntimeState } from './p0.js';

/**
 * readData 成功分支的**投影文本**入口（D3a + D3b + resolver + 头行 + renderer；
 * runtime.ts readData ready 分支消费）。返回投影文本，或 null（无 active schema /
 * 敌意或异态 path / resolver 路径偏离收敛——null 单义，不细分原因，不是读的失败）。
 *
 * 两参重载 = 无预算读（头行无预算段、渲染器第二参缺席）；四参重载 = 预算读
 * （canonical options 由组合层保证在 resolver 验收集内；`truncations` = 值通道截断
 * 清单，结构同构 `ProjectionTruncation`，零 cast 透传）。两重载渲染器入参均为可信域：
 * 畸形 derived/投影 → `InternalError` throw 逃逸（无 catch、无部分输出）。
 */
export function projectReadDataSchema(
  state: RuntimeState,
  path: readonly (string | number)[],
): string | null;
export function projectReadDataSchema(
  state: RuntimeState,
  path: readonly (string | number)[],
  options: ResolveSchemaBudgetOptions,
  truncations: readonly ReadLogicalValueTruncationEntry[],
): string | null;
export function projectReadDataSchema(
  state: RuntimeState,
  path: readonly (string | number)[],
  options?: ResolveSchemaBudgetOptions,
  truncations?: readonly ReadLogicalValueTruncationEntry[],
): string | null {
  const shared = resolveSchemaBody(state, path, options);
  if (shared === null) return null;
  const body = shared.budgeted
    ? renderProjectionText(shared.resolved, truncations)
    : renderProjectionText(shared.resolved);
  return `${headLine(shared.normalized, options)}\n\n${body}`;
}

/**
 * 投影文本**正文变体**（issue #369 W2 / ADR 0028 决策 6 元素口径锚；设计 §7.3 S5）：
 * 与 `projectReadDataSchema` 共用同一前奏（D3a 状态守卫 → D3b 敌意 path 规范化 →
 * resolver），但**无头行、无值通道截断清单**——`schema = renderProjectionText(resolved)`
 * 的正文（含 `‡` 页脚与别名块，结尾恰一个 `\n`），或 null（无 active schema / 路径偏离 /
 * 敌意 path；null 单义，绝非空串）。
 *
 * 窗口读组合层（`window-read.ts`）用它渲染元素口径/容器口径锚；renderer 是 T1 冻结面，
 * 本函数零选项、零包装、零 try/catch（可信域畸形 derived/投影 → `InternalError` 逃逸，
 * 与 `projectReadDataSchema` 唯一逃逸 throw 通道一致）。
 */
export function projectSchemaTextBody(
  state: RuntimeState,
  path: readonly (string | number)[],
  options?: ResolveSchemaBudgetOptions,
): string | null {
  const shared = resolveSchemaBody(state, path, options);
  if (shared === null) return null;
  return renderProjectionText(shared.resolved);
}

/**
 * 共享前奏（D3a + D3b + resolver；`projectReadDataSchema` 与 `projectSchemaTextBody`
 * 单点实现，输出逐字节不变是既有 readData 快照测试锚）：
 * - D3a 情形①：无 active schema（preparing/unavailable；fatal 期 schemaState 停留
 *   'preparing' 且 activeTools 未安装——B5 天然覆盖，不读 state.fatal）。状态守卫先于
 *   path 守卫：无 active schema 时不触碰敌意对象（零敌意代码执行面、零无谓扫描）；
 * - D3b 敌意 path 规范化守卫（F-1）：异态/异常 → null（情形③收敛，绝不外抛）；
 * - resolver 只见普通数组副本；可信域畸形 derived 的 InternalError 由此直通逃逸
 *   （D4：不加 catch、不收敛 null、不降级码——唯一逃逸 throw 通道）。两分支显式分流
 *   （无 cast 过重载）：无预算走两参（渲染器第二参缺席）、预算走三参。
 */
function resolveSchemaBody(
  state: RuntimeState,
  path: readonly (string | number)[],
  options: ResolveSchemaBudgetOptions | undefined,
): ResolvedSchemaBody | null {
  const tools = state.activeTools;
  if (state.schemaState !== 'ready' || tools === undefined) return null;
  const normalized = normalizeReadPath(path);
  if (normalized === null) return null;
  if (options === undefined) {
    const resolved = resolveSchemaAtPath(tools.derived, normalized);
    if (!resolved.ok) return null; // 情形②/③：路径偏离 schema / 静态解析失败（两码同收敛）
    return { normalized, resolved, budgeted: false };
  }
  const resolved = resolveSchemaAtPath(tools.derived, normalized, options);
  if (!resolved.ok) return null; // 对 canonical 结构性不可达（防御纵深保留给直接调用方）
  return { normalized, resolved, budgeted: true };
}

/** 共享前奏产物：规范化 path 快照 + resolver ok 产物（预算分支判别用于渲染器第二参）。 */
type ResolvedSchemaBody =
  | {
      readonly normalized: Array<string | number>;
      readonly resolved: ReadDataSchemaProjection;
      readonly budgeted: false;
    }
  | {
      readonly normalized: Array<string | number>;
      readonly resolved: BudgetedReadDataSchemaProjection;
      readonly budgeted: true;
    };

/**
 * 头行（ADR-0027 决策 3 文法 `# readData [<path>] {depth:N}`；SA6 附录 A / 设计
 * §7-D2 字节冻结）：
 *
 * ```
 * headLine(path, options) = "# readData [" + pathText + "]" + budgetSuffix
 * pathText     = path.length === 0 ? "" : path.map(foldSegment).join(".")
 * foldSegment  = String(seg).replace(/\r\n|\n|\r/g, " ").trim()   // 行注入防御
 * budgetSuffix = "" | " {depth:N}" | " {maxChildrenPerNode:K}"
 *              | " {depth:N,maxChildrenPerNode:K}"                 // 键序固定、逗号无空格
 * ```
 *
 * - `options` = 组合层 canonical 净化后的有效预算（present-undefined 已剥离、-0 已归一、
 *   仅 own-enumerable）；两键皆缺席 → 无预算段（无预算读/空预算/canonical 等价面）；
 * - path 段取自 `normalizeReadPath` 的普通数组快照（实参段值原样，不做别名解析）；
 *   `foldSegment` 与渲染器 ✂ 段 path 记法同规则（`foldText`）——头行**恒不含换行**；
 * - 空路径 → `# readData []`（SA6 C1/附录 B 操作性口径；ADR 决策 3 `[<path>]` 文法）；
 * - 段含 `.`/空白等歧义字符如实呈现（呈现形态，不承诺 round-trip；程序化结构需求走
 *   resolver 直达——ADR-0027 已知限制 1）。
 */
function headLine(
  path: readonly (string | number)[],
  options: ResolveSchemaBudgetOptions | undefined,
): string {
  const pathText = path.length === 0 ? '' : path.map(foldSegment).join('.');
  let budgetSuffix = '';
  if (options !== undefined) {
    // 轴值只读 **own** 属性（canonical 净化产物只含有效 own 键）：继承键污染
    // （Object.prototype.depth 等）不得泄露进头行——canonical 等价面（空预算 ≡ 无预算）
    // 由「own 读取 + present-undefined 剥离」共同保证。
    const depth = ownAxis(options, 'depth');
    const maxChildrenPerNode = ownAxis(options, 'maxChildrenPerNode');
    if (depth !== undefined && maxChildrenPerNode !== undefined) {
      budgetSuffix = ` {depth:${String(depth)},maxChildrenPerNode:${String(maxChildrenPerNode)}}`;
    } else if (depth !== undefined) {
      budgetSuffix = ` {depth:${String(depth)}}`;
    } else if (maxChildrenPerNode !== undefined) {
      budgetSuffix = ` {maxChildrenPerNode:${String(maxChildrenPerNode)}}`;
    }
  }
  return `# readData [${pathText}]${budgetSuffix}`;
}

/** 预算轴 own 属性读取（零原型链查找；present-undefined ≡ 缺席——镜像 canonical 纪律）。 */
function ownAxis(
  options: ResolveSchemaBudgetOptions,
  key: 'depth' | 'maxChildrenPerNode',
): number | undefined {
  if (!Object.prototype.hasOwnProperty.call(options, key)) return undefined;
  const value = options[key];
  return value === undefined ? undefined : value;
}

/** 段呈现：`String(seg)` + 换行折叠为空格 + trim（与渲染器 ✂ 段 path 记法同规则）。 */
function foldSegment(segment: string | number): string {
  return String(segment).replace(/\r\n|\n|\r/g, ' ').trim();
}

/**
 * 敌意 path 规范化（D3b，SA2 F-1 修订核心）：仅以普通属性读（length/[i]/
 * `Symbol.iterator` 同一性比较）扫描并拷贝入普通数组，全程包内层 try；任何异常、
 * 迭代器非标准、长度异型或非 string|number 段 → null（schema:null 收敛，绝不外抛）。
 * 绝不调用迭代协议（不 spread、不 for..of、不 Array.from）。
 *
 * 设计要点（SA1 设计 §7-D3b）：
 * 1. 内层 try 只包裹敌意 path 扫描本身，不包裹 resolveSchemaAtPath/renderProjectionText
 *    调用（D4 可信域通道保持零 catch——两域处置在代码结构上物理分离）；
 * 2. 迭代纯度校验使「exotic-but-indexable 但索引读正常」的数组（重定义迭代器的真数组
 *    T1、对 Symbol.iterator 键抛出的 Proxy T2）确定收敛 null——敌意对象的语义不可信
 *    （可非确定、可有副作用），纪律是 fail-closed 收敛（null），与 doc-runtime
 *    `safeSpreadPath` 敌意数组坍缩为 `[]` 同一姿势的 schema 面对偶；
 * 3. 普通数组副本传 resolver（并作为头行段值事实源）——即便未来 resolver 内部消费方式
 *    演变（其 for..of/[...path] 均只见普通数组），防御自包含、不依赖 resolver 实现细节；
 * 4. 段语义不在此重复：本守卫只做句法域检查（普通数组 + string|number），段的语义
 *    合法性仍由 resolver 两码单义收敛（D3 原有「resolver 是段语义唯一裁决者」保持）。
 *
 * 导出（issue #369 W2 / SA4 F-369-1）：窗口读组合层（`window-read.ts` S5/S6）以本函数
 * 作为 raw path 的**唯一**已验证快照来源——锚链与 ✂ 事实行 pathText 共用同一次快照，
 * 绝不对实参 path 做第二次迭代/spread（二次 spread 既开敌意外抛通道，又使 pathText
 * 可与实际读取路径漂移）。快照缺席（null）时窗口面收敛 `schema: null`（ADR-0027 null
 * 单义），与 readData 头行「头行只读规范化快照」同款纪律。
 */
export function normalizeReadPath(path: readonly (string | number)[]): Array<string | number> | null {
  try {
    if (!Array.isArray(path)) return null; // 防御（值通道 G0 已挡非数组；此处为内部直调者兜底）
    // 迭代纯度：重定义/Proxy 陷阱 → null（属性读 + 同一性比较，不调用迭代器——
    // 敌意迭代器函数从头到尾不被调用，T1 以调用计数器锚定）
    if (path[Symbol.iterator] !== Array.prototype[Symbol.iterator]) return null;
    const n = path.length; // 属性读，非迭代
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) return null;
    const out: Array<string | number> = [];
    for (let i = 0; i < n; i++) {
      const seg = path[i]; // 仅索引访问
      if (typeof seg !== 'string' && typeof seg !== 'number') return null; // 段域检查（B15 尾段 Symbol 在此被捕）
      out.push(seg);
    }
    return out; // 普通数组副本（原型 Array.prototype、标准迭代器）
  } catch {
    return null; // 敌意 trap/意外异常 → 收敛 null，绝不外抛
  }
}
