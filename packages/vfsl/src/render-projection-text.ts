/**
 * 投影文本渲染器（ADR 0027 决策 2/3；issue #363 T1；SA1 设计 §7/§12）。
 *
 * `renderProjectionText(projection, truncations?)`：把 resolver ok 产物（语义 schema
 * 投影四件套 `ReadDataSchemaProjection` 系）渲染为**确定性投影文本**——零选项、同步、
 * 纯函数、逐字节确定、可快照锚定。本票纯加法：不触碰 readData / resolver / 既有导出。
 *
 * 文法（规范性：设计 §7.1–§7.4，与本文件实现一一对应）：
 * - 顶层布局：正文 → 别名块（`aliases` 键序 = 闭包发现序）→ `‡` 页脚（标记数 m>0）→
 *   ✂ 段（truncations 非空）；相邻段落间恰 1 空行、每级缩进 2 空格、输出以恰一个 `\n` 结尾；
 * - 类型表达式：标量域照源文法（`Pattern<"…">` / `Int` / `Int<min, max>` /
 *   `Range<min, max>` / enum ` | ` 分隔且超 100 列折行 / ref 直写别名名 / `T[]` /
 *   `Record<string, T>` / `{}`）、union 恒展开（`| { … }`，不特判判别式）、对象恒块、
 *   截断标记 `<名>‡` / `[...]‡`、环重入 `…`（U+2026）；
 * - optional 合成：字段位吸收为 `名?:`（链任意深度解包单 `?`）；非字段位按内层形态
 *   四款落点（inline 后缀 / 块开行 `{?` / 展开闭行 `[]?`·`>?` / union·enum 首成员行）；
 * - docs 归位：别名锚定优先（`<别名>.<相对路径>`；不回流正文）、正文树尾缀匹配
 *   （多候选字典序最小胜出）、无宿主键静默丢弃（P1：不为归位伪造位置）；
 * - 行尾注释：first-line 口径（多条目 `…`）、换行折叠、多条目 ` · ` 连接、
 *   keyPattern 后缀；注释只出现在完整结构前缀之后（敌意文本不破坏文法）；
 * - 失败语义：projection/truncations 属 trusted-domain——畸形 `throw InternalError`
 *   （沿 `resolve.ts` 唯一定义 import；不进结果联合、无顶层 catch、无部分输出）。
 *
 * 纪律：零模块级可变状态、零 memo、零 I/O/时钟/随机；不冻结/不变异输入；每调用全新
 * 局部状态；对象图环以**栈语义**（进行中集）防御——重入位渲染 `…`、不抛（环投影是
 * resolver 预算游走的合法产物）。
 */
import type { ValueSchema } from './derived.js';
import { InternalError } from './resolve.js';
import { isSchemaTruncationMarker } from './resolve-schema-at-path.js';
import type {
  BudgetedReadDataSchemaProjection,
  BudgetedValueSchema,
  ReadDataSchemaProjection,
  SchemaTruncationMarker,
} from './resolve-schema-at-path.js';

/**
 * ✂ 段条目（ADR 0027 决策 2/3；设计 §7.0 P5）。
 *
 * 与 doc-runtime `ReadLogicalValueTruncationEntry` **结构同构**——vfsl 是叶包（不引
 * doc-runtime），以结构类型保证 T2 组合层原样透传零转换。
 */
export interface ProjectionTruncation {
  /** 截断发生路径（逐段 `.` 连接渲染；数字段 `String(n)`）。 */
  readonly path: readonly (string | number)[];
  /** 裁因：depth（深度耗尽）/ width（宽度裁剪）。 */
  readonly kind: 'depth' | 'width';
  /** 被省略项数。 */
  readonly omitted: number;
}

/** 渲染节点 = 十一 kind 值 schema ∪ 投影层截断标记。 */
type RenderNode = BudgetedValueSchema;

/** inline 形态叶子节点（对象/数组/union/optional 之外的形态）。 */
type InlineLeaf = Exclude<RenderNode, { kind: 'object' | 'array' | 'union' | 'optional' }>;

/** `‡` 页脚（恰一行；m>0 时位于正文与全部别名块之后、✂ 段之前）。 */
const TRUNCATION_FOOTER = '‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。';

/** ✂ 段头行（文末块）。 */
const TRUNCATION_HEADER = '✂ 截断事实：';

/** 十一 kind 封闭集（+ 投影层标记 `truncated`）。 */
const VALUE_KINDS: ReadonlySet<string> = new Set([
  'object',
  'array',
  'xml',
  'union',
  'enum',
  'pattern',
  'int',
  'range',
  'scalar',
  'optional',
  'ref',
]);

const SCALAR_TYPES: ReadonlySet<string> = new Set(['string', 'number', 'boolean', 'null', 'unknown']);

/** 行尾注释条目（归位到该行的 docs / aliasDocs 条目）。 */
interface CommentEntry {
  /** `alias` = aliasDocs 条目（恒排在前）；`docs` = docs 条目（按键字典序后排）。 */
  readonly source: 'alias' | 'docs';
  readonly key: string;
  readonly entries: readonly string[];
}

/** 输出行（结构前缀 + 行尾注释 + 承载位置 + keyPattern 后缀）。 */
interface OutLine {
  text: string;
  /** 行尾注释条目（注释定稿前为待归位集合）。 */
  readonly comment: CommentEntry[];
  /** 该行承载的语法位置（相对路径段序列；段锚根位 = `[]`）。 */
  readonly positions: string[][];
  /** 对象开行的 keyPattern 后缀（Record 形或手造对象；按出现序）。 */
  readonly keyPatterns: string[];
}

/** 段落（正文或某别名块）：行序 + 位置索引 + 标记计数。 */
interface Section {
  readonly lines: OutLine[];
  /** 位置键（段序列 `.` 连接）→ 承载行（首见胜出）。 */
  readonly positions: Map<string, OutLine>;
  /** 别名块名（正文段 = undefined）。 */
  name: string | undefined;
  /** 本段渲染出的截断标记数（= `‡` 位标数）。 */
  markers: number;
}

/** 宿主位（设计 §7.1.2/§7.1.3 的四宿主位 + 字段位/别名头位）。 */
type Host =
  | { readonly kind: 'root' }
  | { readonly kind: 'bare'; readonly indent: number }
  | { readonly kind: 'field'; readonly indent: number; readonly name: string }
  | { readonly kind: 'member'; readonly indent: number }
  | { readonly kind: 'alias'; readonly name: string };

/** 渲染上下文（每调用局部；栈语义 + 当前段落）。 */
interface Ctx {
  section: Section;
  readonly stack: Set<object>;
}

// —— 公共入口 ——

/**
 * 投影 → 确定性文本（ADR 0027 决策 2/3）。
 *
 * 零选项（无第三参、无选项对象）；`truncations` 缺席 / `undefined` / `[]` 三态输出
 * 逐字节相同（无 ✂ 段）；非空清单按输入序逐条渲染。projection/truncations 畸形
 * `throw InternalError`（可归因、无部分输出）。
 */
export function renderProjectionText(
  projection: ReadDataSchemaProjection | BudgetedReadDataSchemaProjection,
  truncations?: readonly ProjectionTruncation[],
): string {
  validateProjectionShape(projection);
  const entries = validateTruncations(truncations);
  validateProjectionTree(projection);

  const body = renderSection(projection.valueSchema as RenderNode, { kind: 'root' });
  const aliases = projection.aliases as Record<string, RenderNode>;
  const aliasSections: Section[] = [];
  for (const name of Object.keys(aliases)) {
    const section = renderSection(aliases[name]!, { kind: 'alias', name });
    section.name = name;
    aliasSections.push(section);
  }

  assignComments(projection, body, aliasSections);
  for (const section of [body, ...aliasSections]) {
    for (const line of section.lines) {
      const comment = renderComment(line);
      if (comment !== undefined) line.text = `${line.text} // ${comment}`;
    }
  }

  const blocks: string[] = [renderLines(body.lines)];
  for (const section of aliasSections) blocks.push(renderLines(section.lines));

  const markerCount =
    body.markers + aliasSections.reduce((sum, section) => sum + section.markers, 0);
  if (markerCount > 0) blocks.push(TRUNCATION_FOOTER);
  if (entries.length > 0) blocks.push(renderTruncations(entries));

  return `${blocks.join('\n\n')}\n`;
}

// —— 浅层形状守卫 + 游走期节点守卫（trusted-domain，fail loud）——

function validateProjectionShape(projection: unknown): void {
  if (projection === null || typeof projection !== 'object' || Array.isArray(projection)) {
    throw new InternalError('投影畸形：projection 须为对象（resolver ok 产物四件套）');
  }
  const record = projection as Record<string, unknown>;
  for (const key of ['valueSchema', 'aliases', 'docs', 'aliasDocs']) {
    if (!(key in record)) throw new InternalError(`投影畸形：projection 缺 ${key}`);
  }
  for (const key of ['aliases', 'docs', 'aliasDocs']) {
    const value = record[key];
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new InternalError(`投影畸形：projection.${key} 须为 plain 对象`);
    }
  }
  for (const key of ['docs', 'aliasDocs']) {
    for (const [docKey, value] of Object.entries(record[key] as Record<string, unknown>)) {
      if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
        throw new InternalError(`投影畸形：projection.${key}["${docKey}"] 须为 string 数组`);
      }
    }
  }
}

/** 全树节点形状守卫（一次遍历、栈防环）：畸形 → InternalError（含位置与 kind）。 */
function validateProjectionTree(
  projection: ReadDataSchemaProjection | BudgetedReadDataSchemaProjection,
): void {
  const stack = new Set<object>();
  validateNode(projection.valueSchema, 'valueSchema', stack);
  for (const [name, body] of Object.entries(projection.aliases)) {
    validateNode(body, `aliases["${name}"]`, stack);
  }
}

function validateNode(node: unknown, where: string, stack: Set<object>): void {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    throw new InternalError(`投影畸形：${where} 须为对象节点（十一 kind 或截断标记）`);
  }
  if (stack.has(node)) return; // 环/DAG：仅首次校验
  const record = node as Record<string, unknown>;
  const kind = record['kind'];
  if (typeof kind !== 'string') throw new InternalError(`投影畸形：${where} 缺 string kind`);
  if (kind === 'truncated') {
    if (!isSchemaTruncationMarker(node)) {
      throw new InternalError(`投影畸形：${where} 截断标记 clue 形状非法`);
    }
    return;
  }
  if (!VALUE_KINDS.has(kind)) throw new InternalError(`投影畸形：${where} kind 非法 "${kind}"`);
  stack.add(node);
  try {
    switch (kind) {
      case 'object': {
        const fields = record['fields'];
        if (!Array.isArray(fields)) throw new InternalError(`投影畸形：${where} object.fields 须为数组`);
        const keyPattern = record['keyPattern'];
        if (keyPattern !== undefined && typeof keyPattern !== 'string') {
          throw new InternalError(`投影畸形：${where} object.keyPattern 须为 string`);
        }
        fields.forEach((field, index) => {
          if (field === null || typeof field !== 'object' || Array.isArray(field)) {
            throw new InternalError(`投影畸形：${where}.fields[${index}] 须为对象`);
          }
          const fieldRecord = field as Record<string, unknown>;
          const name = fieldRecord['name'];
          if (typeof name !== 'string') {
            throw new InternalError(`投影畸形：${where}.fields[${index}].name 须为 string`);
          }
          validateNode(fieldRecord['value'], `${where}.${name}`, stack);
        });
        return;
      }
      case 'array': {
        if (!('element' in record)) throw new InternalError(`投影畸形：${where} array 缺 element`);
        validateNode(record['element'], `${where}.<item>`, stack);
        return;
      }
      case 'union': {
        const members = record['members'];
        if (!Array.isArray(members)) throw new InternalError(`投影畸形：${where} union.members 须为数组`);
        members.forEach((member, index) => validateNode(member, `${where}.<member ${index}>`, stack));
        return;
      }
      case 'enum': {
        const values = record['values'];
        if (
          !Array.isArray(values) ||
          !values.every((value) => typeof value === 'string' || typeof value === 'number')
        ) {
          throw new InternalError(`投影畸形：${where} enum.values 须为 (string|number) 数组`);
        }
        return;
      }
      case 'pattern': {
        if (typeof record['regex'] !== 'string') {
          throw new InternalError(`投影畸形：${where} pattern.regex 须为 string`);
        }
        return;
      }
      case 'int': {
        const hasMin = record['min'] !== undefined;
        const hasMax = record['max'] !== undefined;
        if (hasMin !== hasMax) {
          throw new InternalError(
            `投影畸形：${where} int 带参形态 min/max 须 both-or-neither（实际 min=${String(record['min'])} max=${String(record['max'])}）`,
          );
        }
        if (hasMin && (typeof record['min'] !== 'number' || typeof record['max'] !== 'number')) {
          throw new InternalError(`投影畸形：${where} int.min/max 须为 number`);
        }
        return;
      }
      case 'range': {
        if (typeof record['min'] !== 'number' || typeof record['max'] !== 'number') {
          throw new InternalError(`投影畸形：${where} range.min/max 须为 number`);
        }
        return;
      }
      case 'scalar': {
        const type = record['type'];
        if (typeof type !== 'string' || !SCALAR_TYPES.has(type)) {
          throw new InternalError(`投影畸形：${where} scalar.type 非法 "${String(type)}"`);
        }
        return;
      }
      case 'optional': {
        if (!('value' in record)) throw new InternalError(`投影畸形：${where} optional 缺 value`);
        validateNode(record['value'], where, stack);
        return;
      }
      case 'ref': {
        if (typeof record['name'] !== 'string') {
          throw new InternalError(`投影畸形：${where} ref.name 须为 string`);
        }
        return;
      }
      default:
        return;
    }
  } finally {
    stack.delete(node);
  }
}

function validateTruncations(truncations: unknown): readonly ProjectionTruncation[] {
  if (truncations === undefined) return [];
  if (!Array.isArray(truncations)) throw new InternalError('✂ 段畸形：truncations 须为数组');
  truncations.forEach((entry, index) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new InternalError(`✂ 段畸形：truncations[${index}] 须为对象`);
    }
    const record = entry as Record<string, unknown>;
    const path = record['path'];
    if (
      !Array.isArray(path) ||
      !path.every((segment) => typeof segment === 'string' || typeof segment === 'number')
    ) {
      throw new InternalError(`✂ 段畸形：truncations[${index}].path 须为 (string|number) 数组`);
    }
    if (record['kind'] !== 'depth' && record['kind'] !== 'width') {
      throw new InternalError(`✂ 段畸形：truncations[${index}].kind 非法 "${String(record['kind'])}"`);
    }
    if (typeof record['omitted'] !== 'number') {
      throw new InternalError(`✂ 段畸形：truncations[${index}].omitted 须为 number`);
    }
  });
  return truncations as readonly ProjectionTruncation[];
}

// —— 段落渲染（正文 / 别名块共用）——

function renderSection(node: RenderNode, host: Host): Section {
  const section: Section = { lines: [], positions: new Map(), name: undefined, markers: 0 };
  const ctx: Ctx = { section, stack: new Set<object>() };
  emitValue(ctx, node, host, []);
  return section;
}

function newLine(section: Section, text: string, keyPattern?: string): OutLine {
  const line: OutLine = {
    text,
    comment: [],
    positions: [],
    keyPatterns: keyPattern === undefined ? [] : [keyPattern],
  };
  section.lines.push(line);
  return line;
}

function registerPosition(ctx: Ctx, line: OutLine, segments: readonly string[]): void {
  line.positions.push([...segments]);
  const key = segments.join('.');
  if (!ctx.section.positions.has(key)) ctx.section.positions.set(key, line);
}

function pad(indent: number): string {
  return '  '.repeat(indent);
}

// —— 宿主前缀（结构前缀；字段位吸收 `?`，其余位 `?` 为内容后缀）——

function inlinePrefix(host: Host, optional: boolean): string {
  switch (host.kind) {
    case 'root':
      return '';
    case 'bare':
      return pad(host.indent);
    case 'field':
      return `${pad(host.indent)}${host.name}${optional ? '?' : ''}: `;
    case 'member':
      return `${pad(host.indent)}| `;
    case 'alias':
      return `type ${host.name} = `;
  }
}

function inlineAttach(host: Host, optional: boolean): string {
  return optional && host.kind !== 'field' ? '?' : '';
}

/**
 * 块形态的逻辑缩进（设计 §7.1.2/§7.1.3）：
 * root/alias 头部 = 0；字段位 = 字段缩进（开行在字段行上）；成员位 = +1（`| ` 前缀占一级）；
 * 裸宿主位（数组元素 / Record 值 / 展开内层）= 该位缩进。
 */
function blockIndentOf(host: Host): number {
  switch (host.kind) {
    case 'root':
    case 'alias':
      return 0;
    case 'bare':
    case 'field':
      return host.indent;
    case 'member':
      return host.indent + 1;
  }
}

/** 数组/Record 展开的「宿主行 → 内层区域」缩进（展开形态开行属宿主或内层元素/值）。 */
function regionIndentOf(host: Host): number {
  switch (host.kind) {
    case 'root':
      return 0;
    case 'bare':
      return host.indent;
    case 'field':
    case 'member':
      return host.indent + 1;
    case 'alias':
      return 1;
  }
}

function emitInlineLine(
  ctx: Ctx,
  host: Host,
  content: string,
  optional: boolean,
  rel: string[],
  suffixFirst = '',
): void {
  const text = `${inlinePrefix(host, optional)}${content}${inlineAttach(host, optional)}${suffixFirst}`;
  const line = newLine(ctx.section, text);
  registerPosition(ctx, line, rel);
}

// —— 节点渲染主分派（optional 链解包 → 形态分派）——

function emitValue(ctx: Ctx, node: RenderNode, host: Host, rel: string[], suffixFirst = ''): void {
  if (isSchemaTruncationMarker(node)) {
    ctx.section.markers += 1;
    emitInlineLine(ctx, host, markerText(node), false, rel, suffixFirst);
    return;
  }
  if (ctx.stack.has(node)) {
    emitInlineLine(ctx, host, '…', false, rel, suffixFirst);
    return;
  }

  let inner: RenderNode = node;
  let optional = false;
  if (node.kind === 'optional') {
    optional = true;
    const seen = new Set<object>([node]);
    inner = node.value;
    while (inner.kind === 'optional' && !ctx.stack.has(inner) && !seen.has(inner)) {
      seen.add(inner);
      inner = inner.value;
    }
    if (inner.kind === 'optional') {
      // 链重入（optional 自环 / 2-环）：内层不可再解包 → `…`
      emitInlineLine(ctx, host, '…', optional, rel, suffixFirst);
      return;
    }
  }
  if (ctx.stack.has(inner)) {
    emitInlineLine(ctx, host, '…', optional, rel, suffixFirst);
    return;
  }

  switch (inner.kind) {
    case 'object': {
      if (inner.fields.length === 0) {
        emitInlineLine(ctx, host, '{}', optional, rel, suffixFirst);
        return;
      }
      if (isRecordShape(inner)) {
        emitRecord(ctx, inner, host, optional, rel, suffixFirst);
        return;
      }
      emitObjectBlock(ctx, inner, host, optional, rel, suffixFirst);
      return;
    }
    case 'array': {
      emitArray(ctx, inner, host, optional, rel, suffixFirst);
      return;
    }
    case 'union': {
      emitUnion(ctx, inner, host, optional, rel, suffixFirst);
      return;
    }
    case 'enum': {
      emitEnum(ctx, inner, host, optional, rel, suffixFirst);
      return;
    }
    default: {
      if (inner.kind === 'optional') {
        // 不可达（解包已保证非 optional）；防御性放行 inline 占位
        emitInlineLine(ctx, host, '…', optional, rel, suffixFirst);
        return;
      }
      // optional 链解包后的标记同样计入段标记数（每个被渲染的 ‡ 位标 = 1；设计 §7.4 点 2
      // 计数不变量）——该路径经 inlineLeafText 渲染，不经上方两个计数点（SA8 I7 修复）。
      if (isSchemaTruncationMarker(inner)) ctx.section.markers += 1;
      emitInlineLine(ctx, host, inlineLeafText(inner), optional, rel, suffixFirst);
      return;
    }
  }
}

// —— 对象块（非 Record 形、非空；恒为块）——

function emitObjectBlock(
  ctx: Ctx,
  node: Extract<ValueSchema, { kind: 'object' }>,
  host: Host,
  optional: boolean,
  rel: string[],
  suffixFirst: string,
): void {
  const open = ((): string => {
    switch (host.kind) {
      case 'root':
        return `{${optional ? '?' : ''}`;
      case 'bare':
        return `${pad(host.indent)}{${optional ? '?' : ''}`;
      case 'field':
        return `${pad(host.indent)}${host.name}${optional ? '?' : ''}: {`;
      case 'member':
        return `${pad(host.indent)}| {${optional ? '?' : ''}`;
      case 'alias':
        return `type ${host.name} = {${optional ? '?' : ''}`;
    }
  })();
  const blockIndent = blockIndentOf(host);
  const line = newLine(ctx.section, `${open}${suffixFirst}`, node.keyPattern);
  registerPosition(ctx, line, rel);
  ctx.stack.add(node);
  for (const field of node.fields) {
    emitValue(
      ctx,
      field.value,
      { kind: 'field', indent: blockIndent + 1, name: field.name },
      [...rel, field.name],
    );
  }
  ctx.stack.delete(node);
  newLine(ctx.section, `${pad(blockIndent)}}`);
}

// —— Record 形对象（`fields` 恰一个 `<key>`）：inline 或 Record 展开 ——

function emitRecord(
  ctx: Ctx,
  node: Extract<ValueSchema, { kind: 'object' }>,
  host: Host,
  optional: boolean,
  rel: string[],
  suffixFirst: string,
): void {
  const value = node.fields[0]!.value;
  const prefix = inlinePrefix(host, optional);
  const expand = needsExpansion(ctx, value, `${prefix}Record<string, `, false);
  if (!expand) {
    const line = newLine(ctx.section, '', node.keyPattern);
    registerPosition(ctx, line, rel);
    const inner = inlineText(ctx, value, line, [...rel, '<key>']);
    line.text = `${prefix}Record<string, ${inner}>${inlineAttach(host, optional)}${suffixFirst}`;
    return;
  }
  const open = ((): string => {
    switch (host.kind) {
      case 'root':
        return 'Record<string,';
      case 'bare':
        return `${pad(host.indent)}Record<string,`;
      case 'field':
        return `${pad(host.indent)}${host.name}${optional ? '?' : ''}: Record<string,`;
      case 'member':
        return `${pad(host.indent)}| Record<string,`;
      case 'alias':
        return `type ${host.name} = Record<string,`;
    }
  })();
  const blockIndent = blockIndentOf(host);
  const line = newLine(ctx.section, `${open}${suffixFirst}`, node.keyPattern);
  registerPosition(ctx, line, rel);
  ctx.stack.add(node);
  emitValue(ctx, value, { kind: 'bare', indent: blockIndent + 1 }, [...rel, '<key>']);
  ctx.stack.delete(node);
  newLine(ctx.section, `${pad(blockIndent)}>${inlineAttach(host, optional)}`);
}

// —— 数组（inline `T[]` 或展开：宿主行裸、元素区 +1、闭行 `[]`）——

function emitArray(
  ctx: Ctx,
  node: Extract<ValueSchema, { kind: 'array' }>,
  host: Host,
  optional: boolean,
  rel: string[],
  suffixFirst: string,
): void {
  const prefix = inlinePrefix(host, optional);
  // precedence 1：元素为 enum 的数组不得写 `T[]`（`"p" | "q"[]` 按源文法读作末成员可选）→ 恒展开
  const expand =
    unwrapKind(ctx, node.element) === 'enum' || needsExpansion(ctx, node.element, prefix, false);
  if (!expand) {
    const line = newLine(ctx.section, '');
    registerPosition(ctx, line, rel);
    const inner = inlineText(ctx, node.element, line, [...rel, '<item>']);
    line.text = `${prefix}${inner}[]${inlineAttach(host, optional)}${suffixFirst}`;
    return;
  }
  const regionIndent = regionIndentOf(host);
  let hostLine: OutLine | undefined;
  if (host.kind === 'field') {
    hostLine = newLine(ctx.section, `${pad(host.indent)}${host.name}${optional ? '?' : ''}:${suffixFirst}`);
  } else if (host.kind === 'member') {
    hostLine = newLine(ctx.section, `${pad(host.indent)}|${suffixFirst}`);
  } else if (host.kind === 'alias') {
    hostLine = newLine(ctx.section, `type ${host.name} =${suffixFirst}`);
  }
  if (hostLine !== undefined) registerPosition(ctx, hostLine, rel);
  ctx.stack.add(node);
  emitValue(ctx, node.element, { kind: 'bare', indent: regionIndent }, [...rel, '<item>']);
  ctx.stack.delete(node);
  const closeSuffix = hostLine === undefined ? suffixFirst : '';
  newLine(ctx.section, `${pad(regionIndent)}[]${inlineAttach(host, optional)}${closeSuffix}`);
}

// —— union（恒展开：每成员一行 `| …`；判别式不渲染）——

function emitUnion(
  ctx: Ctx,
  node: Extract<ValueSchema, { kind: 'union' }>,
  host: Host,
  optional: boolean,
  rel: string[],
  suffixFirst: string,
): void {
  let memberIndent: number;
  let firstSuffix = suffixFirst;
  if (host.kind === 'field') {
    const line = newLine(ctx.section, `${pad(host.indent)}${host.name}${optional ? '?' : ''}:${suffixFirst}`);
    registerPosition(ctx, line, rel);
    memberIndent = host.indent + 1;
  } else if (host.kind === 'member') {
    // 嵌套 union：成员区与宿主位同缩进（首成员行即宿主行）；`?` 落首成员行
    memberIndent = host.indent;
    if (optional) firstSuffix = `${firstSuffix}?`;
  } else if (host.kind === 'alias') {
    const line = newLine(ctx.section, `type ${host.name} =${suffixFirst}`);
    registerPosition(ctx, line, rel);
    memberIndent = 1;
    if (optional) firstSuffix = `${firstSuffix}?`;
  } else if (host.kind === 'bare') {
    memberIndent = host.indent;
    if (optional) firstSuffix = `${firstSuffix}?`;
  } else {
    // root：无宿主行，成员行从缩进 0 起
    memberIndent = 0;
    if (optional) firstSuffix = `${firstSuffix}?`;
  }
  ctx.stack.add(node);
  node.members.forEach((member, index) => {
    emitValue(
      ctx,
      member,
      { kind: 'member', indent: memberIndent },
      [...rel, `<member ${index}>`],
      index === 0 ? firstSuffix : '',
    );
  });
  ctx.stack.delete(node);
}

// —— enum（inline 优先；超 100 列或非字段位 optional 包裹 → 折行）——

function emitEnum(
  ctx: Ctx,
  node: Extract<ValueSchema, { kind: 'enum' }>,
  host: Host,
  optional: boolean,
  rel: string[],
  suffixFirst: string,
): void {
  const inline = enumInlineText(node.values);
  const prefix = inlinePrefix(host, optional);
  const forced = optional && host.kind !== 'field';
  const fold = forced || prefix.length + inline.length > 100;
  if (!fold) {
    const line = newLine(ctx.section, `${prefix}${inline}${suffixFirst}`);
    registerPosition(ctx, line, rel);
    node.values.forEach((_, index) => registerPosition(ctx, line, [...rel, `<member ${index}>`]));
    return;
  }
  const hostText = `${prefix}${valueText(node.values[0])}${forced ? '?' : ''}${suffixFirst}`;
  const line = newLine(ctx.section, hostText);
  registerPosition(ctx, line, rel);
  registerPosition(ctx, line, [...rel, '<member 0>']);
  const restIndent = host.kind === 'root' || host.kind === 'alias' ? 1 : host.indent + 1;
  for (let index = 1; index < node.values.length; index += 1) {
    const restLine = newLine(ctx.section, `${pad(restIndent)}| ${valueText(node.values[index])}`);
    registerPosition(ctx, restLine, [...rel, `<member ${index}>`]);
  }
}

// —— inline 表达式（单行；同时在该行登记全部内层位置）——

function inlineText(ctx: Ctx, node: RenderNode, line: OutLine, rel: string[]): string {
  if (isSchemaTruncationMarker(node)) {
    ctx.section.markers += 1;
    registerPosition(ctx, line, rel);
    return markerText(node);
  }
  if (ctx.stack.has(node)) {
    registerPosition(ctx, line, rel);
    return '…';
  }
  switch (node.kind) {
    case 'optional': {
      const seen = new Set<object>([node]);
      let inner: RenderNode = node.value;
      while (inner.kind === 'optional' && !ctx.stack.has(inner) && !seen.has(inner)) {
        seen.add(inner);
        inner = inner.value;
      }
      if (inner.kind === 'optional') {
        registerPosition(ctx, line, rel);
        return '…?';
      }
      return `${inlineText(ctx, inner, line, rel)}?`;
    }
    case 'object': {
      registerPosition(ctx, line, rel);
      if (node.fields.length === 0) return '{}';
      if (!isRecordShape(node)) {
        throw new InternalError('内部不变量违反：非 Record 形对象不可 inline 渲染');
      }
      if (node.keyPattern !== undefined) line.keyPatterns.push(node.keyPattern);
      ctx.stack.add(node);
      const inner = inlineText(ctx, node.fields[0]!.value, line, [...rel, '<key>']);
      ctx.stack.delete(node);
      return `Record<string, ${inner}>`;
    }
    case 'array': {
      registerPosition(ctx, line, rel);
      ctx.stack.add(node);
      const inner = inlineText(ctx, node.element, line, [...rel, '<item>']);
      ctx.stack.delete(node);
      return `${inner}[]`;
    }
    case 'enum': {
      registerPosition(ctx, line, rel);
      node.values.forEach((_, index) => registerPosition(ctx, line, [...rel, `<member ${index}>`]));
      return enumInlineText(node.values);
    }
    case 'union': {
      // 不可达（union 恒展开，调用方已分流）；防御性 fail loud
      throw new InternalError('内部不变量违反：union 不可 inline 渲染');
    }
    default: {
      registerPosition(ctx, line, rel);
      return inlineLeafText(node);
    }
  }
}

function inlineLeafText(node: InlineLeaf): string {
  switch (node.kind) {
    case 'scalar':
      return node.type;
    case 'pattern':
      return `Pattern<${JSON.stringify(node.regex)}>`;
    case 'int':
      return node.min === undefined ? 'Int' : `Int<${node.min}, ${node.max}>`;
    case 'range':
      return `Range<${node.min}, ${node.max}>`;
    case 'xml':
      return 'YXmlFragment';
    case 'ref':
      return node.name;
    case 'truncated':
      return markerText(node);
    default:
      throw new InternalError('内部不变量违反：inline 渲染遇到非 inline 形态');
  }
}

// —— 形态判定 / 拼写 ——

function isRecordShape(node: Extract<ValueSchema, { kind: 'object' }>): boolean {
  return node.fields.length === 1 && node.fields[0]!.name === '<key>';
}

function markerText(node: SchemaTruncationMarker): string {
  return node.clue.via === 'ref' ? `${node.clue.name}‡` : '[...]‡';
}

function valueText(value: string | number | undefined): string {
  if (value === undefined) return '';
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

function enumInlineText(values: ReadonlyArray<string | number>): string {
  return values.map((value) => valueText(value)).join(' | ');
}

/**
 * 形态判定：该节点（optional 解包后）是否多行展开（设计 §7.1.2 统一裁定；与 docs 在场无关）。
 * `prefixText` = 该节点所在行的结构前缀（enum 折行宽判据）；`seen` = 本次判定链的防环集
 * （手造 Record/array 自环图不发散——重入按 inline 处理，由 `inlineText` 的栈语义输出 `…`）。
 */
function needsExpansion(
  ctx: Ctx,
  node: RenderNode,
  prefixText: string,
  fieldPosition: boolean,
  seen: Set<object> = new Set<object>(),
): boolean {
  if (isSchemaTruncationMarker(node)) return false;
  if (ctx.stack.has(node) || seen.has(node)) return false;
  seen.add(node);
  let inner: RenderNode = node;
  let optional = false;
  if (node.kind === 'optional') {
    optional = true;
    const chain = new Set<object>([node]);
    inner = node.value;
    while (inner.kind === 'optional' && !ctx.stack.has(inner) && !chain.has(inner)) {
      chain.add(inner);
      inner = inner.value;
    }
    if (inner.kind === 'optional') return false; // `…?` inline
  }
  if (ctx.stack.has(inner)) return false; // `…` inline
  switch (inner.kind) {
    case 'object': {
      if (inner.fields.length === 0) return false;
      if (isRecordShape(inner)) {
        return needsExpansion(ctx, inner.fields[0]!.value, `${prefixText}Record<string, `, false, seen);
      }
      return true;
    }
    case 'array': {
      // precedence 1：元素为 enum 的数组不得写 `T[]`（`"p" | "q"[]` 失真）→ 恒展开
      if (unwrapKind(ctx, inner.element) === 'enum') return true;
      return needsExpansion(ctx, inner.element, prefixText, false, seen);
    }
    case 'union':
      return true;
    case 'enum':
      return (optional && !fieldPosition) || prefixText.length + enumInlineText(inner.values).length > 100;
    default:
      return false;
  }
}

/** optional 链解包后的 kind（标记 = `truncated`；栈内/链重入 → undefined）。 */
function unwrapKind(ctx: Ctx, node: RenderNode): string | undefined {
  if (isSchemaTruncationMarker(node)) return 'truncated';
  if (ctx.stack.has(node)) return undefined;
  let inner: RenderNode = node;
  if (node.kind === 'optional') {
    const seen = new Set<object>([node]);
    inner = node.value;
    while (inner.kind === 'optional' && !ctx.stack.has(inner) && !seen.has(inner)) {
      seen.add(inner);
      inner = inner.value;
    }
    if (inner.kind === 'optional') return undefined;
  }
  return ctx.stack.has(inner) ? undefined : inner.kind;
}

// —— docs / aliasDocs 归位（设计 §7.2）——

function assignComments(
  projection: ReadDataSchemaProjection | BudgetedReadDataSchemaProjection,
  body: Section,
  aliasSections: readonly Section[],
): void {
  const aliasByName = new Map<string, Section>();
  for (const section of aliasSections) aliasByName.set(section.name!, section);
  const remaining: string[] = [];

  // 规则 2：docs 键首段 ∈ aliases 键集 → 专属锚定该别名块（不回流正文）
  for (const key of Object.keys(projection.docs)) {
    const segments = key.split('.');
    const first = segments[0]!;
    const section = aliasByName.get(first);
    if (section === undefined) {
      remaining.push(key);
      continue;
    }
    const entries = projection.docs[key]!;
    const target = segments.slice(1);
    if (target.length === 0) {
      addCommentEntries(section.positions.get(''), key, entries, 'docs');
      continue;
    }
    const line = section.positions.get(target.join('.'));
    if (line !== undefined) addCommentEntries(line, key, entries, 'docs');
  }

  // 规则 3：正文树后缀匹配（位置渲染序；多候选字典序最小胜出，其余丢弃）
  const bodyPositions: Array<{ readonly segments: string[]; readonly line: OutLine }> = [];
  for (const line of body.lines) {
    for (const position of line.positions) {
      if (position.length > 0) bodyPositions.push({ segments: position, line });
    }
  }
  for (const position of bodyPositions) {
    const candidates = remaining.filter((key) => tailMatches(key.split('.'), position.segments));
    if (candidates.length === 0) continue;
    candidates.sort(compareCodeUnits);
    const winner = candidates[0]!;
    addCommentEntries(position.line, winner, projection.docs[winner]!, 'docs');
    for (const candidate of candidates) {
      const at = remaining.indexOf(candidate);
      if (at !== -1) remaining.splice(at, 1);
    }
  }

  // 规则 1：aliasDocs → 别名头行（在 docs 条目之前）
  for (const section of aliasSections) {
    const entries = projection.aliasDocs[section.name!];
    if (entries !== undefined && entries.length > 0) {
      addCommentEntries(section.positions.get(''), section.name!, entries, 'alias');
    }
  }
}

function tailMatches(keySegments: readonly string[], positionSegments: readonly string[]): boolean {
  if (keySegments.length < positionSegments.length) return false;
  const offset = keySegments.length - positionSegments.length;
  for (let index = 0; index < positionSegments.length; index += 1) {
    if (keySegments[offset + index] !== positionSegments[index]) return false;
  }
  return true;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function addCommentEntries(
  line: OutLine | undefined,
  key: string,
  entries: readonly string[],
  source: 'alias' | 'docs',
): void {
  if (line === undefined) return;
  line.comment.push({ source, key, entries });
}

/** 行尾注释定稿：aliasDocs 在前，docs 按键字典序；keyPattern 后缀恒在末尾。 */
function renderComment(line: OutLine): string | undefined {
  const aliases = line.comment.filter((entry) => entry.source === 'alias');
  const docs = line.comment
    .filter((entry) => entry.source === 'docs')
    .sort((left, right) => compareCodeUnits(left.key, right.key));
  const parts: string[] = [];
  for (const entry of [...aliases, ...docs]) {
    const text = firstLineText(entry.entries);
    if (text.length > 0) parts.push(text);
  }
  for (const keyPattern of line.keyPatterns) parts.push(`keyPattern: ${JSON.stringify(keyPattern)}`);
  return parts.length === 0 ? undefined : parts.join(' · ');
}

/** 口径 first-line：取首条目 → 换行折叠为空格 → strip；≥2 条目追加 `…`。 */
function firstLineText(entries: readonly string[]): string {
  const first = entries[0];
  if (first === undefined) return '';
  const folded = foldText(first);
  if (folded.length === 0) return '';
  return entries.length >= 2 ? `${folded}…` : folded;
}

function foldText(text: string): string {
  return text.replace(/\r\n|\n|\r/g, ' ').trim();
}

// —— 段落定稿 / 页脚 / ✂ 段 ——

function renderLines(lines: readonly OutLine[]): string {
  return lines.map((line) => line.text).join('\n');
}

function renderTruncations(entries: readonly ProjectionTruncation[]): string {
  const lines = [TRUNCATION_HEADER];
  for (const entry of entries) {
    const pathText =
      entry.path.length === 0 ? '[]' : entry.path.map((segment) => foldText(String(segment))).join('.');
    lines.push(`- ${pathText} · ${entry.kind} · 省略 ${String(entry.omitted)} 项`);
  }
  return lines.join('\n');
}
