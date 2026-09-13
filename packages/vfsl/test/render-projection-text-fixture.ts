/**
 * issue #363 投影文本渲染器契约共享 fixture（SA6 §12.1 第四行；设计 §11 ALLOW）。
 *
 * 内容：
 * - `F1_PATHS` / `F4_CELLS` / `F6_PATHS`：金标矩阵路径集（与 SA6 §12.3 单元格一致）；
 * - `EXPECTED_CELL_KEYS`：**独立推导**的 86 单元键全集（反空转锚：不得从金标反推）；
 * - `RENDER_GRAMMAR_TEXT`：F6 文法形态 VFSL 文本（evaluate 产物；覆盖 Pattern / 裸 Int /
 *   Int<min,max> / Range<min,max> / 数字 enum / xml / T[] / 超 100 列 enum 折行）；
 * - `RENDER_GOLDENS`：录制区——实现期由 `renderProjectionText` 实际输出录制（录制 HEAD /
 *   日期 / 命令与人工核对清单见下方录制区注释；录制前逐格核对设计 §7.1–§7.4 与附录 A）；
 * - `renderCellInputs()`：金标单元的输入投影（F1/F2/F3/F4/F5/F6 六族）；
 * - `HOSTILE_*`：CT-4 敌意 docs 手造投影与良性孪生（结构同形，仅注释值不同）；
 * - `clueProjection` / `markerlessTwin`：CT-3 线索敏感性手造投影；
 * - `optionalWrappedProjection`：I7 回归（SA8 实现复查）——`optional{value: marker}`
 *   单标记投影（own-line 宿主位；`marker=false` 为 m=0 负控孪生）；
 * - `TRUNCATIONS_*`：CT-5 ✂ 段输入清单（SA6 §12.6 三条 + 空路径/空清单边界）；
 * - `MALFORMED_*`：CT-9 畸形输入抽样字面量（`unknown` 形状，经动态接缝注入）。
 *
 * 本文件是数据/构造器（非 `.test.ts`，不被 vitest 收集；由包 tsconfig 的 test glob
 * 覆盖类型检查）。除 `ProjectionTruncation` 尚未存在而使用结构同形的本地
 * `RenderTruncationEntry` 外，不引用任何新公共名目。
 */
import { evaluate, parseVfsl, resolveSchemaAtPath } from '../src/index.js';
import type { DerivedSchema } from '../src/index.js';
import { FIXTURE_TEXT } from './resolve-schema-at-path-fixture.js';
import { BUDGET_MARKER_MATRIX, budgetFixtureDerived, slotDocsDerived } from './resolve-schema-at-path-budget-fixture.js';
import { M4_CONTRACT_PATHS, M4_TEXT } from './resolve-schema-at-path-member-docs-fixture.js';

// —— ✂ 段条目（与 doc-runtime ReadLogicalValueTruncationEntry 结构同构；设计 §7.0 P5）——

export interface RenderTruncationEntry {
  readonly path: readonly (string | number)[];
  readonly kind: 'depth' | 'width';
  readonly omitted: number;
}

/** 截断标记线索（手造 CT-3 投影用；与 SchemaTruncationClue 结构同形）。 */
export type ProjectionClue =
  | { readonly via: 'ref'; readonly name: string }
  | { readonly via: 'container'; readonly containerKind: 'object' | 'array' };

/** 单个金标单元的输入（key = `EXPECTED_CELL_KEYS` 成员）。 */
export interface RenderCellInput {
  readonly key: string;
  readonly projection: unknown;
  readonly truncations?: readonly RenderTruncationEntry[];
}

// —— 前置辅助（parseVfsl / evaluate / resolveSchemaAtPath 均为既有绿色基线）——

function parseOk(text: string): ReturnType<typeof parseVfsl> & { ok: true } {
  const result = parseVfsl(text);
  if (!result.ok) {
    throw new Error(`前置 parseVfsl 失败（不应发生）：${JSON.stringify(result.issues)}`);
  }
  return result;
}

function evaluateOk(text: string): DerivedSchema {
  const result = evaluate(parseOk(text).module);
  if (!result.ok) {
    throw new Error(`前置 evaluate 失败（不应发生）：${JSON.stringify(result.issues)}`);
  }
  return result.derived;
}

let fixture272Cache: DerivedSchema | undefined;
function fixture272(): DerivedSchema {
  fixture272Cache ??= evaluateOk(FIXTURE_TEXT);
  return fixture272Cache;
}

let m4Cache: DerivedSchema | undefined;
function m4Derived(): DerivedSchema {
  m4Cache ??= evaluateOk(M4_TEXT);
  return m4Cache;
}

let grammarCache: DerivedSchema | undefined;
function grammarDerived(): DerivedSchema {
  grammarCache ??= evaluateOk(RENDER_GRAMMAR_TEXT);
  return grammarCache;
}

let budgetCache: DerivedSchema | undefined;
function budgetDerived(): DerivedSchema {
  budgetCache ??= budgetFixtureDerived();
  return budgetCache;
}

let slotCache: DerivedSchema | undefined;
function slotDerived(): DerivedSchema {
  slotCache ??= slotDocsDerived();
  return slotCache;
}

/** 读投影（ok 前置守卫）：失败即抛（夹具/路径漂移 = 测试基础设施错误）。 */
function projectionAt(
  derived: DerivedSchema,
  path: readonly (string | number)[],
  options?: { readonly depth: number },
): unknown {
  const result =
    options === undefined ? resolveSchemaAtPath(derived, path) : resolveSchemaAtPath(derived, path, options);
  if (!result.ok) {
    throw new Error(
      `前置 resolveSchemaAtPath 失败（不应发生）：path=${JSON.stringify(path)} options=${JSON.stringify(options)} code=${result.code}`,
    );
  }
  return result;
}

// —— F1 无预算整读（#272 夹具，12 路径）——

export const F1_PATHS: ReadonlyArray<readonly (string | number)[]> = [
  [],
  ['notes'],
  ['audit'],
  ['audit', 'createdBy'],
  ['config'],
  ['keywords'],
  ['assets'],
  ['assets', 'img1'],
  ['assets', 'img1', 'url'],
  ['assets', 'img1', 'body'],
  ['u', 'x'],
  ['attachments'],
];

// —— F4 M4 × 预算交叉（9 格）——

export const F4_CELLS: ReadonlyArray<{ readonly path: readonly (string | number)[]; readonly depth: number }> = [
  { path: [], depth: 0 },
  { path: [], depth: 1 },
  { path: [], depth: 2 },
  { path: ['pair'], depth: 0 },
  { path: ['pair'], depth: 1 },
  { path: ['mode'], depth: 0 },
  { path: ['mode'], depth: 1 },
  { path: ['items'], depth: 0 },
  { path: ['items'], depth: 1 },
];

// —— F6 文法形态文本（evaluate 产物；覆盖 ADR 0027 决策 3 标量域/容器拼写）——

/**
 * F6 文法形态 VFSL 文本：`code`（`string & Pattern<"…">`）、`bare`（裸 `Int`）、
 * `amount`（`Int<1, 9999999999>`）、`ratio`（`Range<0, 100>`）、`level`（数字 enum
 * `1 | 2`）、`body`（`YXmlFragment` → 值侧 `{kind:'xml'}`）、`plain`（`T[]`）、`long`
 * （枚举内联超 100 列 → 折行缩进续行）。
 */
export const RENDER_GRAMMAR_TEXT = [
  'type ROOT = YMap<{',
  '  /** 编码 */',
  '  code: string & Pattern<"^[a-z]{2}-[0-9]{2}$">;',
  '  /** 裸整数 */',
  '  bare: number & Int;',
  '  /** 金额 */',
  '  amount: number & Int<1, 9999999999>;',
  '  /** 比例 */',
  '  ratio: number & Range<0, 100>;',
  '  /** 层级 */',
  '  level: 1 | 2;',
  '  /** 正文 */',
  '  body: YXmlFragment<{ paragraphs: YArray<YLeaf<string>> }>;',
  '  /** 明细 */',
  '  plain: YLeaf<string>[];',
  '  /** 长枚举 */',
  '  long: "projection-alpha-0001" | "projection-beta-0002" | "projection-gamma-0003" | "projection-delta-0004" | "projection-epsilon-0005";',
  '}>;',
].join('\n');

/** F6 读取路径（`[]` + 逐字段；9 格）。 */
export const F6_PATHS: ReadonlyArray<readonly (string | number)[]> = [
  [],
  ['code'],
  ['bare'],
  ['amount'],
  ['ratio'],
  ['level'],
  ['body'],
  ['plain'],
  ['long'],
];

// —— 金标单元键全集（独立推导；不得从 RENDER_GOLDENS 反推）——

function cellKey(family: 'F1' | 'F3' | 'F6', path: readonly (string | number)[]): string {
  return `${family} ${JSON.stringify(path)}`;
}

function budgetCellKey(family: 'F2' | 'F4' | 'F5', path: readonly (string | number)[], depth: number): string {
  return `${family} ${JSON.stringify(path)} d${depth}`;
}

/** 86 单元键全集：F1 12 + F2 37 + F3 16 + F4 9 + F5 3 + F6 9。 */
export const EXPECTED_CELL_KEYS: readonly string[] = [
  ...F1_PATHS.map((p) => cellKey('F1', p)),
  ...BUDGET_MARKER_MATRIX.flatMap((c) =>
    Object.keys(c.byDepth)
      .map(Number)
      .sort((a, b) => a - b)
      .map((depth) => budgetCellKey('F2', c.path, depth)),
  ),
  ...M4_CONTRACT_PATHS.map((p) => cellKey('F3', p)),
  ...F4_CELLS.map((c) => budgetCellKey('F4', c.path, c.depth)),
  ...[0, 1, 2].map((depth) => budgetCellKey('F5', [], depth)),
  ...F6_PATHS.map((p) => cellKey('F6', p)),
];

// —— 金标录制区（实现期由 renderProjectionText 实际输出录制）——
//
// 录制纪律（设计 §12 / SA8 §7.3）：录制 HEAD `1267454`（2026-09-13）；命令
//   NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/tsx /tmp/record-363-goldens.ts
// 录制前人工核对清单（录制后逐格抽查复核）：
//   ① 每个投影的 Object.keys(aliases) 全部有别名块、块序 = 闭包发现序；
//   ② 每个有宿主的 docs 键文本在正文/别名块出现（含裸宿主行 inlPair / type AssetEntity =）；
//   ③ ‡ 覆盖全部标记（计数 = m，页脚恰 1 行）；
//   ④ optional `?` 不丢失（['notes'] = string?；['config'] = {? 块）；
//   ⑤ 与设计附录 A.1/A.2/A.5/A.6/A.7 样张逐字对齐。
// —— RENDER_GOLDENS 录制区开始 ——
export const RENDER_GOLDENS: Readonly<Record<string, string>> = {
  "F1 []": "{\n  audit: Audit // 根级审计字段\n  assets: Record<string, AssetEntity> // keyPattern: \"^[A-Za-z0-9_\\\\-]{1,64}$\"\n  notes?: string // 可选备注\n  keywords: string[] // 关键字\n  u: U\n  config?: { // 可选配置\n    retries: number\n  }\n  attachments: string[]\n}\n\ntype Audit = { // 审计子文档\n  createdBy: string // 谁创建的\n}\n\ntype AssetEntity = // 资产实体：封闭联合\n  | {\n      kind: \"image\"\n      url: string\n      audit: Audit\n    }\n  | {\n      kind: \"text\"\n      body: YXmlFragment\n      audit: Audit\n    }\n\ntype U =\n  | {\n      kind: \"a\"\n      x: string\n    }\n  | {\n      kind: \"b\"\n      x: number[]\n    }\n",
  "F1 [\"notes\"]": "string?\n",
  "F1 [\"audit\"]": "Audit\n\ntype Audit = { // 审计子文档\n  createdBy: string // 谁创建的\n}\n",
  "F1 [\"audit\",\"createdBy\"]": "string\n",
  "F1 [\"config\"]": "{?\n  retries: number\n}\n",
  "F1 [\"keywords\"]": "string[]\n",
  "F1 [\"assets\"]": "Record<string, AssetEntity> // keyPattern: \"^[A-Za-z0-9_\\\\-]{1,64}$\"\n\ntype AssetEntity = // 资产实体：封闭联合\n  | {\n      kind: \"image\"\n      url: string\n      audit: Audit\n    }\n  | {\n      kind: \"text\"\n      body: YXmlFragment\n      audit: Audit\n    }\n\ntype Audit = { // 审计子文档\n  createdBy: string // 谁创建的\n}\n",
  "F1 [\"assets\",\"img1\"]": "AssetEntity\n\ntype AssetEntity = // 资产实体：封闭联合\n  | {\n      kind: \"image\"\n      url: string\n      audit: Audit\n    }\n  | {\n      kind: \"text\"\n      body: YXmlFragment\n      audit: Audit\n    }\n\ntype Audit = { // 审计子文档\n  createdBy: string // 谁创建的\n}\n",
  "F1 [\"assets\",\"img1\",\"url\"]": "string\n",
  "F1 [\"assets\",\"img1\",\"body\"]": "YXmlFragment\n",
  "F1 [\"u\",\"x\"]": "| string\n| number[]\n",
  "F1 [\"attachments\"]": "string[]\n",
  "F2 [] d0": "[...]‡\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F2 [] d1": "{\n  shallow: Ledger‡ // 浅引用位\n  deep: [...]‡ // 深链位\n  pair: Pair‡ // 联合位\n  inlPair: // 内联联合位\n    | [...]‡\n    | [...]‡\n  plain: [...]‡ // 孪生位\n  opt?: [...]‡ // 可选位\n  req: [...]‡ // 必填位\n  mode: Mode‡ // 模式\n  modes: [...]‡ // 模式表\n  modeMap: [...]‡ // 模式字典\n}\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F2 [] d2": "{\n  shallow: Ledger // 浅引用位\n  deep: { // 深链位\n    mid: [...]‡\n  }\n  pair: Pair // 联合位\n  inlPair: // 内联联合位\n    | {\n        kind: \"a\"\n        name: string\n      }\n    | {\n        kind: \"b\"\n        count: number\n      }\n  plain: { // 孪生位\n    kind: \"a\"\n    name: string\n  }\n  opt?: { // 可选位\n    retries: number\n  }\n  req: { // 必填位\n    retries: number\n  }\n  mode: Mode // 模式\n  modes: Mode‡[] // 模式表\n  modeMap: Record<string, Mode‡> // 模式字典\n}\n\ntype Ledger = { // 账本\n  title: string // 账本名\n  audit: Audit‡ // 审计引用\n}\n\ntype Pair =\n  | {\n      kind: \"a\"\n      name: string // 甲名\n    }\n  | {\n      kind: \"b\"\n      count: number // 乙量\n    }\n\ntype Mode = \"on\" | \"off\" // 开 · 关\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F2 [] d3": "{\n  shallow: Ledger // 浅引用位\n  deep: { // 深链位\n    mid: {\n      leaf: Ledger‡\n    }\n  }\n  pair: Pair // 联合位\n  inlPair: // 内联联合位\n    | {\n        kind: \"a\"\n        name: string\n      }\n    | {\n        kind: \"b\"\n        count: number\n      }\n  plain: { // 孪生位\n    kind: \"a\"\n    name: string\n  }\n  opt?: { // 可选位\n    retries: number\n  }\n  req: { // 必填位\n    retries: number\n  }\n  mode: Mode // 模式\n  modes: Mode[] // 模式表\n  modeMap: Record<string, Mode> // 模式字典\n}\n\ntype Ledger = { // 账本\n  title: string // 账本名\n  audit: Audit // 审计引用\n}\n\ntype Audit = { // 审计\n  by: string // 审计员\n  notes: [...]‡ // 备注行\n}\n\ntype Pair =\n  | {\n      kind: \"a\"\n      name: string // 甲名\n    }\n  | {\n      kind: \"b\"\n      count: number // 乙量\n    }\n\ntype Mode = \"on\" | \"off\" // 开 · 关\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F2 [] d4": "{\n  shallow: Ledger // 浅引用位\n  deep: { // 深链位\n    mid: {\n      leaf: Ledger\n    }\n  }\n  pair: Pair // 联合位\n  inlPair: // 内联联合位\n    | {\n        kind: \"a\"\n        name: string\n      }\n    | {\n        kind: \"b\"\n        count: number\n      }\n  plain: { // 孪生位\n    kind: \"a\"\n    name: string\n  }\n  opt?: { // 可选位\n    retries: number\n  }\n  req: { // 必填位\n    retries: number\n  }\n  mode: Mode // 模式\n  modes: Mode[] // 模式表\n  modeMap: Record<string, Mode> // 模式字典\n}\n\ntype Ledger = { // 账本\n  title: string // 账本名\n  audit: Audit // 审计引用\n}\n\ntype Audit = { // 审计\n  by: string // 审计员\n  notes: string[] // 备注行\n}\n\ntype Pair =\n  | {\n      kind: \"a\"\n      name: string // 甲名\n    }\n  | {\n      kind: \"b\"\n      count: number // 乙量\n    }\n\ntype Mode = \"on\" | \"off\" // 开 · 关\n",
  "F2 [] d9": "{\n  shallow: Ledger // 浅引用位\n  deep: { // 深链位\n    mid: {\n      leaf: Ledger\n    }\n  }\n  pair: Pair // 联合位\n  inlPair: // 内联联合位\n    | {\n        kind: \"a\"\n        name: string\n      }\n    | {\n        kind: \"b\"\n        count: number\n      }\n  plain: { // 孪生位\n    kind: \"a\"\n    name: string\n  }\n  opt?: { // 可选位\n    retries: number\n  }\n  req: { // 必填位\n    retries: number\n  }\n  mode: Mode // 模式\n  modes: Mode[] // 模式表\n  modeMap: Record<string, Mode> // 模式字典\n}\n\ntype Ledger = { // 账本\n  title: string // 账本名\n  audit: Audit // 审计引用\n}\n\ntype Audit = { // 审计\n  by: string // 审计员\n  notes: string[] // 备注行\n}\n\ntype Pair =\n  | {\n      kind: \"a\"\n      name: string // 甲名\n    }\n  | {\n      kind: \"b\"\n      count: number // 乙量\n    }\n\ntype Mode = \"on\" | \"off\" // 开 · 关\n",
  "F2 [\"shallow\"] d0": "Ledger‡\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F2 [\"shallow\"] d1": "Ledger\n\ntype Ledger = { // 账本\n  title: string // 账本名\n  audit: Audit‡ // 审计引用\n}\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F2 [\"shallow\"] d2": "Ledger\n\ntype Ledger = { // 账本\n  title: string // 账本名\n  audit: Audit // 审计引用\n}\n\ntype Audit = { // 审计\n  by: string // 审计员\n  notes: [...]‡ // 备注行\n}\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F2 [\"shallow\"] d3": "Ledger\n\ntype Ledger = { // 账本\n  title: string // 账本名\n  audit: Audit // 审计引用\n}\n\ntype Audit = { // 审计\n  by: string // 审计员\n  notes: string[] // 备注行\n}\n",
  "F2 [\"shallow\"] d4": "Ledger\n\ntype Ledger = { // 账本\n  title: string // 账本名\n  audit: Audit // 审计引用\n}\n\ntype Audit = { // 审计\n  by: string // 审计员\n  notes: string[] // 备注行\n}\n",
  "F2 [\"deep\",\"mid\",\"leaf\"] d0": "Ledger‡\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F2 [\"deep\",\"mid\",\"leaf\"] d1": "Ledger\n\ntype Ledger = { // 账本\n  title: string // 账本名\n  audit: Audit‡ // 审计引用\n}\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F2 [\"deep\",\"mid\",\"leaf\"] d2": "Ledger\n\ntype Ledger = { // 账本\n  title: string // 账本名\n  audit: Audit // 审计引用\n}\n\ntype Audit = { // 审计\n  by: string // 审计员\n  notes: [...]‡ // 备注行\n}\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F2 [\"deep\",\"mid\",\"leaf\"] d3": "Ledger\n\ntype Ledger = { // 账本\n  title: string // 账本名\n  audit: Audit // 审计引用\n}\n\ntype Audit = { // 审计\n  by: string // 审计员\n  notes: string[] // 备注行\n}\n",
  "F2 [\"shallow\",\"audit\"] d0": "Audit‡\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F2 [\"shallow\",\"audit\"] d1": "Audit\n\ntype Audit = { // 审计\n  by: string // 审计员\n  notes: [...]‡ // 备注行\n}\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F2 [\"shallow\",\"audit\"] d2": "Audit\n\ntype Audit = { // 审计\n  by: string // 审计员\n  notes: string[] // 备注行\n}\n",
  "F2 [\"req\"] d0": "[...]‡\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F2 [\"req\"] d1": "{\n  retries: number\n}\n",
  "F2 [\"plain\"] d0": "[...]‡\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F2 [\"plain\"] d1": "{\n  kind: \"a\"\n  name: string\n}\n",
  "F2 [\"pair\"] d0": "Pair‡\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F2 [\"pair\"] d1": "Pair\n\ntype Pair =\n  | {\n      kind: \"a\"\n      name: string // 甲名\n    }\n  | {\n      kind: \"b\"\n      count: number // 乙量\n    }\n",
  "F2 [\"inlPair\"] d0": "| [...]‡\n| [...]‡\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F2 [\"inlPair\"] d1": "| {\n    kind: \"a\"\n    name: string\n  }\n| {\n    kind: \"b\"\n    count: number\n  }\n",
  "F2 [\"mode\"] d0": "Mode‡\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F2 [\"mode\"] d1": "Mode\n\ntype Mode = \"on\" | \"off\" // 开 · 关\n",
  "F2 [\"mode\"] d9": "Mode\n\ntype Mode = \"on\" | \"off\" // 开 · 关\n",
  "F2 [\"modes\"] d0": "[...]‡\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F2 [\"modes\"] d1": "Mode‡[]\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F2 [\"modes\"] d2": "Mode[]\n\ntype Mode = \"on\" | \"off\" // 开 · 关\n",
  "F2 [\"modeMap\",\"k\"] d0": "Mode‡\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F2 [\"modeMap\",\"k\"] d1": "Mode\n\ntype Mode = \"on\" | \"off\" // 开 · 关\n",
  "F2 [\"shallow\",\"title\"] d0": "string\n",
  "F2 [\"shallow\",\"title\"] d1": "string\n",
  "F2 [\"shallow\",\"title\"] d3": "string\n",
  "F3 []": "{\n  s: Status\n  u: U\n  m: Mixed\n  items: Choice[]\n  pair:\n    | { // 内联甲\n        kind: \"a\"\n        n: string\n      }\n    | { // 内联乙\n        kind: \"b\"\n        m: number\n      }\n  mode: \"on\" | \"off\" // 开 · 关\n  inlineItems:\n    \"p\" | \"q\" // 元素甲 · 元素乙\n    []\n  recInline: Record<string, \"x\" | \"y\"> // 记录甲 · 记录乙\n  inl: Inl\n  inlEnum: InlEnum\n  inlItems: InlItem\n  inlRec: InlRec\n}\n\ntype Status = \"draft\" | \"submitted\" | \"archived\" // 订单生命周期状态 · 草稿：可继续编辑 · 已提交：只可追加备注\n\ntype U =\n  | { // 变体甲\n      kind: \"a\"\n      x: string\n    }\n  | { // 变体乙\n      kind: \"b\"\n      y: number\n    }\n\ntype Mixed =\n  | string // 载体甲…\n  | number\n\ntype Choice = \"p\" | \"q\" // 选项甲 · 选项乙\n\ntype Inl =\n  | { // 别名内联甲\n      kind: \"a\"\n      n: string\n    }\n  | { // 别名内联乙\n      kind: \"b\"\n      m: number\n    }\n\ntype InlEnum = \"on\" | \"off\" // 别名开 · 别名关\n\ntype InlItem =\n  \"p\" | \"q\" // 别名元素甲 · 别名元素乙\n  []\n\ntype InlRec = Record<string, \"x\" | \"y\"> // 别名记录甲 · 别名记录乙\n",
  "F3 [\"s\"]": "Status\n\ntype Status = \"draft\" | \"submitted\" | \"archived\" // 订单生命周期状态 · 草稿：可继续编辑 · 已提交：只可追加备注\n",
  "F3 [\"u\"]": "U\n\ntype U =\n  | { // 变体甲\n      kind: \"a\"\n      x: string\n    }\n  | { // 变体乙\n      kind: \"b\"\n      y: number\n    }\n",
  "F3 [\"m\"]": "Mixed\n\ntype Mixed =\n  | string // 载体甲…\n  | number\n",
  "F3 [\"items\"]": "Choice[]\n\ntype Choice = \"p\" | \"q\" // 选项甲 · 选项乙\n",
  "F3 [\"items\",0]": "Choice\n\ntype Choice = \"p\" | \"q\" // 选项甲 · 选项乙\n",
  "F3 [\"pair\"]": "| { // 内联甲\n    kind: \"a\"\n    n: string\n  }\n| { // 内联乙\n    kind: \"b\"\n    m: number\n  }\n",
  "F3 [\"mode\"]": "\"on\" | \"off\" // 开 · 关\n",
  "F3 [\"inlineItems\"]": "\"p\" | \"q\" // 元素甲 · 元素乙\n[]\n",
  "F3 [\"inlineItems\",0]": "\"p\" | \"q\" // 元素甲 · 元素乙\n",
  "F3 [\"recInline\",\"k1\"]": "\"x\" | \"y\" // 记录甲 · 记录乙\n",
  "F3 [\"inl\"]": "Inl\n\ntype Inl =\n  | { // 别名内联甲\n      kind: \"a\"\n      n: string\n    }\n  | { // 别名内联乙\n      kind: \"b\"\n      m: number\n    }\n",
  "F3 [\"inlEnum\"]": "InlEnum\n\ntype InlEnum = \"on\" | \"off\" // 别名开 · 别名关\n",
  "F3 [\"inlItems\"]": "InlItem\n\ntype InlItem =\n  \"p\" | \"q\" // 别名元素甲 · 别名元素乙\n  []\n",
  "F3 [\"inlItems\",0]": "\"p\" | \"q\" // 别名元素甲 · 别名元素乙\n",
  "F3 [\"inlRec\",\"k1\"]": "\"x\" | \"y\" // 别名记录甲 · 别名记录乙\n",
  "F4 [] d0": "[...]‡\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F4 [] d1": "{\n  s: Status‡\n  u: U‡\n  m: Mixed‡\n  items: [...]‡\n  pair:\n    | [...]‡ // 内联甲\n    | [...]‡ // 内联乙\n  mode: \"on\" | \"off\" // 开 · 关\n  inlineItems: [...]‡\n  recInline: [...]‡\n  inl: Inl‡\n  inlEnum: InlEnum‡\n  inlItems: InlItem‡\n  inlRec: InlRec‡\n}\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F4 [] d2": "{\n  s: Status\n  u: U\n  m: Mixed\n  items: Choice‡[]\n  pair:\n    | { // 内联甲\n        kind: \"a\"\n        n: string\n      }\n    | { // 内联乙\n        kind: \"b\"\n        m: number\n      }\n  mode: \"on\" | \"off\" // 开 · 关\n  inlineItems:\n    \"p\" | \"q\" // 元素甲 · 元素乙\n    []\n  recInline: Record<string, \"x\" | \"y\"> // 记录甲 · 记录乙\n  inl: Inl\n  inlEnum: InlEnum\n  inlItems: InlItem\n  inlRec: InlRec\n}\n\ntype Status = \"draft\" | \"submitted\" | \"archived\" // 订单生命周期状态 · 草稿：可继续编辑 · 已提交：只可追加备注\n\ntype U =\n  | { // 变体甲\n      kind: \"a\"\n      x: string\n    }\n  | { // 变体乙\n      kind: \"b\"\n      y: number\n    }\n\ntype Mixed =\n  | string // 载体甲…\n  | number\n\ntype Inl =\n  | { // 别名内联甲\n      kind: \"a\"\n      n: string\n    }\n  | { // 别名内联乙\n      kind: \"b\"\n      m: number\n    }\n\ntype InlEnum = \"on\" | \"off\" // 别名开 · 别名关\n\ntype InlItem =\n  \"p\" | \"q\" // 别名元素甲 · 别名元素乙\n  []\n\ntype InlRec = Record<string, \"x\" | \"y\"> // 别名记录甲 · 别名记录乙\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F4 [\"pair\"] d0": "| [...]‡ // 内联甲\n| [...]‡ // 内联乙\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F4 [\"pair\"] d1": "| { // 内联甲\n    kind: \"a\"\n    n: string\n  }\n| { // 内联乙\n    kind: \"b\"\n    m: number\n  }\n",
  "F4 [\"mode\"] d0": "\"on\" | \"off\" // 开 · 关\n",
  "F4 [\"mode\"] d1": "\"on\" | \"off\" // 开 · 关\n",
  "F4 [\"items\"] d0": "[...]‡\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F4 [\"items\"] d1": "Choice‡[]\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F5 [] d0": "[...]‡\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F5 [] d1": "{\n  name: string // 名称行\n  state: IssueState‡ // 最新观察状态\n  pausedFrom?: IssueState‡ // 暂停前状态，仅在暂停期在场\n  workRecords: [...]‡ // 有序执行事实\n  byKey: [...]‡ // 按键索引\n  stop: // 停止结果\n    | [...]‡ // 正常结束\n    | [...]‡ // 中途取消\n}\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F5 [] d2": "{\n  name: string // 名称行\n  state: IssueState // 最新观察状态\n  pausedFrom?: IssueState // 暂停前状态，仅在暂停期在场\n  workRecords: WorkRecord‡[] // 有序执行事实 · 单条执行事实\n  byKey: Record<string, WorkRecord‡> // 按键索引 · 键槽执行事实\n  stop: // 停止结果\n    | { // 正常结束\n        kind: string\n      }\n    | { // 中途取消\n        kind: string\n      }\n}\n\ntype IssueState = \"open\" | \"closed\" // 议题观察状态枚举 · 议题开着 · 议题关了\n\n‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。\n",
  "F6 []": "{\n  code: Pattern<\"^[a-z]{2}-[0-9]{2}$\"> // 编码\n  bare: Int // 裸整数\n  amount: Int<1, 9999999999> // 金额\n  ratio: Range<0, 100> // 比例\n  level: 1 | 2 // 层级\n  body: YXmlFragment // 正文\n  plain: string[] // 明细\n  long: \"projection-alpha-0001\" // 长枚举\n    | \"projection-beta-0002\"\n    | \"projection-gamma-0003\"\n    | \"projection-delta-0004\"\n    | \"projection-epsilon-0005\"\n}\n",
  "F6 [\"code\"]": "Pattern<\"^[a-z]{2}-[0-9]{2}$\">\n",
  "F6 [\"bare\"]": "Int\n",
  "F6 [\"amount\"]": "Int<1, 9999999999>\n",
  "F6 [\"ratio\"]": "Range<0, 100>\n",
  "F6 [\"level\"]": "1 | 2\n",
  "F6 [\"body\"]": "YXmlFragment\n",
  "F6 [\"plain\"]": "string[]\n",
  "F6 [\"long\"]": "\"projection-alpha-0001\"\n  | \"projection-beta-0002\"\n  | \"projection-gamma-0003\"\n  | \"projection-delta-0004\"\n  | \"projection-epsilon-0005\"\n",
};
// —— RENDER_GOLDENS 录制区结束 ——

// —— 金标单元输入构造（六族）——

/** 全部 86 金标单元的输入投影（键序 = EXPECTED_CELL_KEYS 推导序）。 */
export function renderCellInputs(): readonly RenderCellInput[] {
  const out: RenderCellInput[] = [];
  for (const path of F1_PATHS) {
    out.push({ key: cellKey('F1', path), projection: projectionAt(fixture272(), path) });
  }
  for (const matrixCase of BUDGET_MARKER_MATRIX) {
    for (const depthText of Object.keys(matrixCase.byDepth)) {
      const depth = Number(depthText);
      out.push({
        key: budgetCellKey('F2', matrixCase.path, depth),
        projection: projectionAt(budgetDerived(), matrixCase.path, { depth }),
      });
    }
  }
  for (const path of M4_CONTRACT_PATHS) {
    out.push({ key: cellKey('F3', path), projection: projectionAt(m4Derived(), path) });
  }
  for (const cell of F4_CELLS) {
    out.push({
      key: budgetCellKey('F4', cell.path, cell.depth),
      projection: projectionAt(m4Derived(), cell.path, { depth: cell.depth }),
    });
  }
  for (const depth of [0, 1, 2]) {
    out.push({ key: budgetCellKey('F5', [], depth), projection: projectionAt(slotDerived(), [], { depth }) });
  }
  for (const path of F6_PATHS) {
    out.push({ key: cellKey('F6', path), projection: projectionAt(grammarDerived(), path) });
  }
  return out;
}

/** 单格输入查询（敏感性测试复用）。 */
export function cellInput(key: string): RenderCellInput {
  const found = renderCellInputs().find((c) => c.key === key);
  if (found === undefined) throw new Error(`未知金标单元键：${key}`);
  return found;
}

// —— CT-3 线索敏感性手造投影（结构同形：一 marker 位 + 一标量位）——

/** 单 marker 投影（`cut` 位为标记；`clue` 决定 `<名>‡` 或 `[...]‡`）。 */
export function clueProjection(clue: ProjectionClue): unknown {
  return {
    valueSchema: {
      kind: 'object',
      fields: [
        { name: 'solid', value: { kind: 'scalar', type: 'string' } },
        { name: 'cut', value: { kind: 'truncated', clue } },
      ],
    },
    aliases: {},
    docs: {},
    aliasDocs: {},
  };
}

/** 双 marker 投影（CT-3 删除一个标记 → ‡ 计数恰减 1）。 */
export function twoMarkerProjection(): unknown {
  return {
    valueSchema: {
      kind: 'object',
      fields: [
        { name: 'first', value: { kind: 'truncated', clue: { via: 'ref', name: 'Alpha' } } },
        { name: 'second', value: { kind: 'truncated', clue: { via: 'container', containerKind: 'array' } } },
      ],
    },
    aliases: {},
    docs: {},
    aliasDocs: {},
  };
}

// —— I7 回归（SA8 实现复查）：optional 包装截断标记（`optional{value: marker}`）——

/**
 * optional 包装标记的 own-line 宿主位（设计 §7.4 点 1 枚举的复合上下文）。
 * `bare` 位对 `optional{marker}` 不可达——容器展开谓词对标记恒 false，故按可达宿主位列。
 */
export type OptionalMarkerHost = 'root' | 'field' | 'member' | 'alias';

/** 手造 twin 线索（与冻结 resolver `['opt']` d0 同形：container 线索 → 字面 `[...]‡`）。 */
const OPTIONAL_MARKER_CLUE: ProjectionClue = { via: 'container', containerKind: 'object' };

/**
 * `optional{value: marker}` 单标记投影（m=1）——冻结 resolver 真实产物
 * `resolveSchemaAtPath(budgetFixtureDerived(), ['opt'], {depth:0})` 的孪生形状
 * （optional 透明游走 + 终点包装保留，`resolve-schema-at-path.ts`）。
 * `marker=false` 得到同形无标记孪生（m=0 负控：不得输出 `‡`/页脚）。
 */
export function optionalWrappedProjection(host: OptionalMarkerHost, marker = true): unknown {
  const inner = marker
    ? { kind: 'truncated', clue: OPTIONAL_MARKER_CLUE }
    : { kind: 'scalar', type: 'string' };
  const wrapped = { kind: 'optional', value: inner };
  switch (host) {
    case 'root':
      return { valueSchema: wrapped, aliases: {}, docs: {}, aliasDocs: {} };
    case 'field':
      return {
        valueSchema: { kind: 'object', fields: [{ name: 'cut', value: wrapped }] },
        aliases: {},
        docs: {},
        aliasDocs: {},
      };
    case 'member':
      return {
        valueSchema: {
          kind: 'union',
          members: [wrapped, { kind: 'scalar', type: 'number' }],
        },
        aliases: {},
        docs: {},
        aliasDocs: {},
      };
    case 'alias':
      return {
        valueSchema: { kind: 'scalar', type: 'string' },
        aliases: { OptAlias: wrapped },
        docs: {},
        aliasDocs: {},
      };
  }
}

/** CT-3 负断言孪生（无标记：无 ‡、无页脚）。 */
export function markerlessTwin(): unknown {
  return {
    valueSchema: {
      kind: 'object',
      fields: [
        { name: 'solid', value: { kind: 'scalar', type: 'string' } },
        { name: 'cut', value: { kind: 'scalar', type: 'string' } },
      ],
    },
    aliases: {},
    docs: {},
    aliasDocs: {},
  };
}

// —— CT-4 敌意 docs 手造投影（结构与良性孪生同形；仅注释文本不同）——

/** 敌意文本族（SA6 §12.5：闭合括号、注释闭合符、反引号、双引号、注释分隔符、井号、换行、超长行）。 */
export const HOSTILE_DOCS: Readonly<Record<string, readonly string[]>> = {
  'ROOT.alpha': ['} // # ` " */ first-line\nsecond-line \\ raw'],
  'ROOT.beta': ['hostile-b // 注释里再出现分隔符 } | > ?'],
  'ROOT.beta.gamma': ['gamma\nline2\r\nline3'],
  'ROOT.beta.delta.<member 0>': ['x'.repeat(180)],
  'ROOT.beta.leaf': ['无宿主脊柱类键（P1：静默丢弃，零输出贡献）'],
};

/** 良性孪生 docs（键集与 HOSTILE_DOCS 逐一相同）。 */
export const BENIGN_DOCS: Readonly<Record<string, readonly string[]>> = {
  'ROOT.alpha': ['alpha 口径首行'],
  'ROOT.beta': ['beta 口径首行'],
  'ROOT.beta.gamma': ['gamma 口径首行'],
  'ROOT.beta.delta.<member 0>': ['delta 首值口径'],
  'ROOT.beta.leaf': ['无宿主脊柱类键（P1：静默丢弃，零输出贡献）'],
};

/** 敌意/良性共享结构（docs 表另注入，保证结构完全同形）。 */
export function hostileStructureValueSchema(): unknown {
  return {
    kind: 'object',
    fields: [
      { name: 'alpha', value: { kind: 'scalar', type: 'string' } },
      {
        name: 'beta',
        value: {
          kind: 'object',
          fields: [
            { name: 'gamma', value: { kind: 'scalar', type: 'number' } },
            { name: 'delta', value: { kind: 'enum', values: ['x', 'y'] } },
          ],
        },
      },
    ],
  };
}

/** 敌意投影（结构 = hostileStructureValueSchema；docs = HOSTILE_DOCS）。 */
export function hostileDocsProjection(): unknown {
  return {
    valueSchema: hostileStructureValueSchema(),
    aliases: {},
    docs: HOSTILE_DOCS,
    aliasDocs: {},
  };
}

/** 良性孪生投影（同结构；docs = BENIGN_DOCS）。 */
export function benignDocsProjection(): unknown {
  return {
    valueSchema: hostileStructureValueSchema(),
    aliases: {},
    docs: BENIGN_DOCS,
    aliasDocs: {},
  };
}

/** 多条目 docs（first-line + `…`；第 2 条不得出现）。 */
export function multiEntryDocsProjection(): unknown {
  return {
    valueSchema: {
      kind: 'object',
      fields: [{ name: 'alpha', value: { kind: 'scalar', type: 'string' } }],
    },
    aliases: {},
    docs: { 'ROOT.alpha': ['首条目文本', '第二条不应出现', '第三条不应出现'] },
    aliasDocs: {},
  };
}

/** 空 docs / aliasDocs 投影（结构行须与全量注释渲染逐行相同）。 */
export function clearedDocsProjection(): unknown {
  return {
    valueSchema: hostileStructureValueSchema(),
    aliases: {},
    docs: {},
    aliasDocs: {},
  };
}

/** 未引用别名照样渲染（渲染器呈现输入表，不自作闭包再收窄）。 */
export function unreferencedAliasProjection(): unknown {
  return {
    valueSchema: { kind: 'scalar', type: 'string' },
    aliases: {
      Extra: {
        kind: 'object',
        fields: [{ name: 'inner', value: { kind: 'scalar', type: 'number' } }],
      },
    },
    docs: {},
    aliasDocs: { Extra: ['额外别名口径'] },
  };
}

// —— CT-5 ✂ 段输入清单（SA6 §12.6）——

export const TRUNCATIONS_SINGLE: readonly RenderTruncationEntry[] = [
  { path: ['tags'], kind: 'width', omitted: 2 },
];

export const TRUNCATIONS_MULTI: readonly RenderTruncationEntry[] = [
  { path: ['meta'], kind: 'depth', omitted: 2 },
  { path: ['tags'], kind: 'width', omitted: 3 },
];

export const TRUNCATIONS_INDEXED: readonly RenderTruncationEntry[] = [
  { path: ['items', 0], kind: 'depth', omitted: 1 },
];

/** 空路径条目（渲染 `- [] · depth · 省略 N 项`；设计 §7.4 N5 钉死）。 */
export const TRUNCATIONS_EMPTY_PATH: readonly RenderTruncationEntry[] = [
  { path: [], kind: 'depth', omitted: 5 },
];

/** 乱序输入（确定性锚：不要求与正序相等，但同序重复调用逐字节相同）。 */
export const TRUNCATIONS_SHUFFLED: readonly RenderTruncationEntry[] = [
  { path: ['tags'], kind: 'width', omitted: 3 },
  { path: ['meta'], kind: 'depth', omitted: 2 },
];

// —— CT-9 畸形输入抽样（`unknown` 形状；经动态接缝注入）——

/** ① 缺四键。 */
export const MALFORMED_MISSING_KEYS: unknown = { ok: true };

/** ② 坏 kind（四键形状完整）。 */
export const MALFORMED_BAD_KIND: unknown = {
  valueSchema: { kind: 'bogus' },
  aliases: {},
  docs: {},
  aliasDocs: {},
};

/** ③ truncations 条目 kind 非两值。 */
export const MALFORMED_TRUNCATION_KIND: readonly unknown[] = [
  { path: ['a'], kind: 'height', omitted: 1 },
];

/** ④ docs 值非 string 数组。 */
export const MALFORMED_DOCS_VALUE: unknown = {
  valueSchema: { kind: 'scalar', type: 'string' },
  aliases: {},
  docs: { 'ROOT.x': 'not-an-array' },
  aliasDocs: {},
};

/** ⑤ int 半参（both-or-neither 契约：`{kind:'int', min:1}`）。 */
export const MALFORMED_INT_HALF: unknown = {
  valueSchema: { kind: 'int', min: 1 },
  aliases: {},
  docs: {},
  aliasDocs: {},
};

/** ⑥ 节点非对象（游走期畸形）。 */
export const MALFORMED_NODE: unknown = {
  valueSchema: null,
  aliases: {},
  docs: {},
  aliasDocs: {},
};

/** ⑦ aliases 体畸形（闭包内层坏 kind）。 */
export const MALFORMED_ALIAS_BODY: unknown = {
  valueSchema: { kind: 'ref', name: 'Bad' },
  aliases: { Bad: { kind: 'not-a-kind' } },
  docs: {},
  aliasDocs: {},
};

/** ⑧ truncations 非数组。 */
export const MALFORMED_TRUNCATIONS_SHAPE: unknown = { path: ['a'], kind: 'width', omitted: 1 };
