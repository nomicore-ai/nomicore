/**
 * issue #336（ADR-0024 T3）× issue #364（ADR-0027 决策 1/2/3/4）主缝预算契约。
 *
 * #364 交付形态换代（本文件 2024 版 #336 五键契约的原子翻新）：
 * - 成功分支**恒四键** `{ ok, value, schema, truncated }`——结构化 `truncations` 键退役，
 *   截断事实唯一载体 = 投影文本内 `✂ 截断事实：` 段（ADR-0027 决策 1）；
 * - `schema` = 投影文本（头行 + `renderProjectionText` 正文 + ✂ 段）或严格 null；
 * - 值通道（doc-runtime）**零变化**：预算读仍返回 `{ok,value,truncated,truncations}`——
 *   本文件的截断清单断言全部改走**值通道 oracle**（`readLogicalValueAtPath(doc, path,
 *   options)`，经 `makeBudgetRuntimeWithDoc` 暴露同一 doc），文本面断言走 ✂ 段与头行。
 *
 * 用例组（沿用 #336 设计 §12-T1，断言面按 #364 重锚）：
 * A 四键恒形 / B depth 截断（值通道 oracle + ✂ 段）/ C omitted 计数语义（同上）/
 * D 两通道对齐（文本锚 + 敌意 options oracle 一致）/ E width 对投影正文无操作 /
 * F READ_OPTIONS_INVALID 矩阵 + 差分 + 敌意净化面（F-x1～F-x6）/ G 零物化哨兵 /
 * H schema:null 与 always-on。
 *
 * 断言纪律（#364 SA6 §12 头注）：只观察公共接缝运行时输出；预算读结果只用
 * `expectReadDataOkKeys`（恰四键键集）+ 定点断言（`r.value` / `r.truncated` /
 * `r.schema` 文本）；截断清单事实只从值通道 oracle 读取，绝不从 `r.schema` 文本反推。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { readLogicalValueAtPath } from '@nomicore/doc-runtime';
import type { ReadLogicalValueAtPathOptions } from '@nomicore/doc-runtime';
import { compileSchemaEnvelope, renderProjectionText, resolveSchemaAtPath } from '@nomicore/vfsl';
import type { DerivedSchema } from '@nomicore/vfsl';
import type { NamespaceRuntime } from '../src/index.js';
import { expectReadDataOkKeys } from './helpers/readdata-ok-shape.js';
import {
  ENV_336,
  createBudgetRuntimeFromHandle,
  descriptorGetSplitProxy,
  makeBudgetHandle,
  makeBudgetRuntime,
  makeBudgetRuntimeWithDoc,
  nonEnumerableDepthOptions,
  statefulDescriptorProxy,
  throwOnceDescriptorProxy,
  throwingGetProxy,
  waitForSchemaReady,
} from './runtime-readdata-shape-budget-fixture.js';

// ───────────────────────── 形状校准（单点 cast，不改值、不吞错） ─────────────────────────

/** 值通道截断条目（`readLogicalValueAtPath` 预算成功面；doc-runtime 形状冻结）。 */
interface TruncationEntry {
  readonly path: readonly (string | number)[];
  readonly kind: 'depth' | 'width';
  readonly omitted: number;
}

/** readData 成功分支恰四键（#364 形状；schema 为投影文本或严格 null）。 */
interface BudgetOkShape {
  readonly ok: true;
  readonly value: unknown;
  readonly schema: string | null;
  readonly truncated: boolean;
}

interface FailureShape {
  readonly ok: false;
  readonly code: string;
  readonly path: readonly (string | number)[];
  readonly message?: string;
}

/** 成功前提断言（ok:false → loud throw，绝不假绿）。 */
function ok(r: unknown, label: string): BudgetOkShape {
  if ((r as { ok?: unknown }).ok !== true) {
    throw new Error(`${label}：契约前提失败（期望 ok:true，实际 ${JSON.stringify(r)}）`);
  }
  return r as BudgetOkShape;
}

/** 失败前提断言。 */
function failure(r: unknown, label: string): FailureShape {
  if ((r as { ok?: unknown }).ok !== false) {
    throw new Error(`${label}：契约前提失败（期望 ok:false，实际 ${JSON.stringify(r)}）`);
  }
  return r as FailureShape;
}

/** 敌意 options 通道：公共类型面不接受非封闭形状——测试经单点 cast 进入运行时校验面。 */
const asOptions = (value: unknown): ReadLogicalValueAtPathOptions =>
  value as ReadLogicalValueAtPathOptions;

const FAILURE_KEYS = ['code', 'message', 'ok', 'path'] as const;

function expectFailureKeys(r: object, label: string): void {
  expect(Object.keys(r).sort(), `${label}：失败分支键集不得含成功键`).toStrictEqual([...FAILURE_KEYS]);
}

// ───────────────────────── oracle recipe（SA6 §12.0；全公共 API） ─────────────────────────

interface Budget {
  readonly depth?: number;
  readonly maxChildrenPerNode?: number;
}

/** 组合层头行（SA6 附录 A / 设计 §7-D2 冻结格式；空路径 pathText = 空串）。 */
function foldSegment(segment: string | number): string {
  return String(segment).replace(/\r\n|\n|\r/g, ' ').trim();
}

function headLine(path: readonly (string | number)[], options?: Budget): string {
  const pathText = path.length === 0 ? '' : path.map(foldSegment).join('.');
  let suffix = '';
  if (options !== undefined) {
    const depth = options.depth;
    const width = options.maxChildrenPerNode;
    if (depth !== undefined && width !== undefined) {
      suffix = ` {depth:${String(depth)},maxChildrenPerNode:${String(width)}}`;
    } else if (depth !== undefined) {
      suffix = ` {depth:${String(depth)}}`;
    } else if (width !== undefined) {
      suffix = ` {maxChildrenPerNode:${String(width)}}`;
    }
  }
  return `# readData [${pathText}]${suffix}`;
}

const COMPILED_336 = compileSchemaEnvelope(ENV_336);
if (!COMPILED_336.ok) throw new Error('装置前提失败：ENV_336 必须可编译');
const DERIVED_336: DerivedSchema = COMPILED_336.derived;

/** 独立求值 oracle：期望串由独立编译的 derived 渲染（反伪绿——绝不从 `r.schema` 反推）。 */
function oracleText(
  doc: Y.Doc,
  path: readonly (string | number)[],
  options?: Budget,
): string | null {
  const resolved = options === undefined
    ? resolveSchemaAtPath(DERIVED_336, path)
    : resolveSchemaAtPath(DERIVED_336, path, options);
  if (!resolved.ok) return null;
  if (options === undefined) {
    return `${headLine(path)}\n\n${renderProjectionText(resolved)}`;
  }
  const valueOracle = readLogicalValueAtPath(doc, path, options);
  if (!valueOracle.ok) throw new Error('装置前提失败：oracle 值通道预算读必须成功');
  return `${headLine(path, options)}\n\n${renderProjectionText(resolved, valueOracle.truncations)}`;
}

/** 值通道截断清单 oracle（预算读；doc-runtime 单源，绝不从投影文本反推）。 */
function valueEntries(
  doc: Y.Doc,
  path: readonly (string | number)[],
  options: Budget,
): readonly TruncationEntry[] {
  const t1 = readLogicalValueAtPath(doc, path, options);
  if (!t1.ok) throw new Error(`装置前提失败：值通道预算读必须成功（${JSON.stringify(path)}）`);
  return t1.truncations;
}

/** 文本锚：✂ 段在场断言（截断事实唯一载体）。 */
const TRUNCATION_SECTION = '✂ 截断事实：';
/** 文本锚：`‡` 页脚（depth 折叠标记；width 对投影正文无操作 → 缺席）。 */
const MARKER_FOOTER = '‡ 截断标记：';

/** 值通道条目的稳定排序键（集合比较用；顺序无关）。 */
function positionKey(path: readonly (string | number)[]): string {
  return path.map((seg) => (typeof seg === 'number' ? '<item>' : seg)).join('\u0000');
}

/** 头行块（首个 `\n\n` 前）与正文块（头行之后；含 ✂ 段与 `‡` 页脚）。 */
function headBlock(text: string): string {
  const index = text.indexOf('\n\n');
  if (index < 0) throw new Error(`契约前提失败：投影文本缺头行分隔（${JSON.stringify(text.slice(0, 80))}）`);
  return text.slice(0, index);
}

function bodyBlock(text: string): string {
  const index = text.indexOf('\n\n');
  if (index < 0) throw new Error('契约前提失败：投影文本缺头行分隔');
  return text.slice(index + 2);
}

/** 渲染器**正文**（剥离头行、✂ 段与尾随空行）——width 无操作对偶（组 E）。 */
function projectionBodyOnly(text: string): string {
  const body = bodyBlock(text);
  const cut = body.indexOf(TRUNCATION_SECTION);
  const withoutSection = cut < 0 ? body : body.slice(0, cut);
  return withoutSection.replace(/\n+$/u, '');
}

/** 全文本一致性锚：`r.schema` 逐字节等于独立 oracle（含 null）。 */
function expectTextOracle(
  r: BudgetOkShape,
  doc: Y.Doc,
  path: readonly (string | number)[],
  options: Budget | undefined,
  label: string,
): void {
  expect(r.schema, `${label}：schema 必须逐字节等于 oracle（含 null）`).toBe(
    oracleText(doc, path, options),
  );
}

// ═════════════════════════════ 组 A：恒四键 ═════════════════════════════

describe('组 A：成功分支恒四键 {ok,value,schema,truncated}（ADR-0027 决策 1；truncations 键退役）', () => {
  it('A1 无 options 读：恰四键、truncated=false、schema 为投影文本（头行无预算段 + 正文）', async () => {
    const { runtime, doc } = await makeBudgetRuntimeWithDoc();
    const r = ok(runtime.readData([]), 'A1');
    expectReadDataOkKeys(r);
    expect(r.truncated).toBe(false);
    expect('truncations' in r).toBe(false);
    expect(typeof r.schema).toBe('string');
    expect(headBlock(r.schema!)).toBe('# readData []');
    expect(r.schema!.includes(TRUNCATION_SECTION)).toBe(false);
    expect(r.value).toStrictEqual({ title: 'hello', count: 3, meta: { content: 'hi', extra: 7 }, tags: ['a', 'b', 'c', 'd', 'e'] });
    expectTextOracle(r, doc, [], undefined, 'A1');
    await runtime.close();
  });

  it('A2 触发截断的预算读：恰四键、truncated === 值通道截断布尔、✂ 段在场（B14 重锚）', async () => {
    const { runtime, doc } = await makeBudgetRuntimeWithDoc();
    const r = ok(runtime.readData(['meta'], { depth: 0 }), 'A2');
    expectReadDataOkKeys(r);
    const entries = valueEntries(doc, ['meta'], { depth: 0 });
    expect(entries.length).toBeGreaterThan(0);
    expect(r.truncated).toBe(entries.length > 0);
    expect(r.schema!.includes(TRUNCATION_SECTION)).toBe(true);
    expectTextOracle(r, doc, ['meta'], { depth: 0 }, 'A2');
    await runtime.close();
  });

  it('A3 未触发截断的预算读（充足 depth）：恰四键、truncated=false、值通道清单空、文本无 ✂', async () => {
    const { runtime, doc } = await makeBudgetRuntimeWithDoc();
    const r = ok(runtime.readData(['meta'], { depth: 9 }), 'A3');
    expectReadDataOkKeys(r);
    expect(r.truncated).toBe(false);
    expect(valueEntries(doc, ['meta'], { depth: 9 })).toStrictEqual([]);
    expect(r.schema!.includes(TRUNCATION_SECTION)).toBe(false);
    expectTextOracle(r, doc, ['meta'], { depth: 9 }, 'A3');
    await runtime.close();
  });
});

// ═════════════════════════════ 组 B：depth 截断（值通道 oracle + ✂ 段） ═════════════════════════════

describe('组 B：depth 截断省略 + 条目三字段（值通道 oracle）+ ✂ 段事实', () => {
  it('B1 readData([], {depth:1})：折叠空壳 + 值通道两条 depth 条目（path 尾段即被裁键名）；文本 ✂ 段逐条在场', async () => {
    const { runtime, doc } = await makeBudgetRuntimeWithDoc();
    const r = ok(runtime.readData([], { depth: 1 }), 'B1');
    expect(r.value).toStrictEqual({ title: 'hello', count: 3, meta: {}, tags: [] });
    const entries = [...valueEntries(doc, [], { depth: 1 })].sort((a, b) =>
      positionKey(a.path).localeCompare(positionKey(b.path)),
    );
    expect(entries).toStrictEqual([
      { path: ['meta'], kind: 'depth', omitted: 2 },
      { path: ['tags'], kind: 'depth', omitted: 5 },
    ]);
    // 被折容器键以折叠空壳在场；清单条目尾段 = 被折容器键名（「空壳 = 被裁」的辨识）
    expect(entries.map((e) => e.path[e.path.length - 1])).toStrictEqual(['meta', 'tags']);
    // 文本面：✂ 段在场且逐条列出同一事实（截断事实唯一载体）
    expect(r.truncated).toBe(true);
    expect(r.schema).not.toBeNull();
    expect(r.schema!.includes(TRUNCATION_SECTION)).toBe(true);
    expect(r.schema!).toContain('- meta · depth · 省略 2 项');
    expect(r.schema!).toContain('- tags · depth · 省略 5 项');
    expectTextOracle(r, doc, [], { depth: 1 }, 'B1');
    await runtime.close();
  });

  it('B2 depth:0 目标容器骨架读：同形空容器 + 值通道单条 depth 条目 + 文本 ✂ 条目；value 键恒在场（ADR-0024 L26）', async () => {
    const { runtime, doc } = await makeBudgetRuntimeWithDoc();
    const r = ok(runtime.readData(['meta'], { depth: 0 }), 'B2');
    expect(Object.prototype.hasOwnProperty.call(r, 'value')).toBe(true);
    expect(r.value).toStrictEqual({});
    expect(valueEntries(doc, ['meta'], { depth: 0 })).toStrictEqual([
      { path: ['meta'], kind: 'depth', omitted: 2 },
    ]);
    expect(r.truncated).toBe(true);
    expect(r.schema!).toContain('- meta · depth · 省略 2 项');
    await runtime.close();
  });

  it('B3 数组目标 depth:0：同形空数组 + 值通道单条 depth 条目（omitted = 元素数）+ 文本 ✂ 条目', async () => {
    const { runtime, doc } = await makeBudgetRuntimeWithDoc();
    const r = ok(runtime.readData(['tags'], { depth: 0 }), 'B3');
    expect(r.value).toStrictEqual([]);
    expect(valueEntries(doc, ['tags'], { depth: 0 })).toStrictEqual([
      { path: ['tags'], kind: 'depth', omitted: 5 },
    ]);
    expect(r.truncated).toBe(true);
    expect(r.schema!).toContain('- tags · depth · 省略 5 项');
    await runtime.close();
  });
});

// ═════════════════════════════ 组 C：omitted 计数语义 ═════════════════════════════

describe('组 C：omitted = 被截容器直接子项数（非后代总数）+ width 父路径单条', () => {
  it('C1 depth 条目 omitted = 直接子项数：blob 直接子项 2、每子项 3 后代（后代总数 6）→ omitted === 2；schema:null 诚实共存', async () => {
    const { runtime, doc } = await makeBudgetRuntimeWithDoc({ raw: true });
    const r = ok(runtime.readData(['blob'], { depth: 0 }), 'C1');
    const entries = valueEntries(doc, ['blob'], { depth: 0 });
    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry.kind).toBe('depth');
    expect(entry.omitted).toBe(2); // 直接子项数（p、q）
    expect(entry.omitted).not.toBe(6); // 显式排除「后代总数」口径（6 = 3 + 3）
    expect(r.value).toStrictEqual({});
    // schema 外键（raw 复制）→ 投影文本不可达：截断事实仅剩 truncated 布尔 + 值通道清单
    expect(r.truncated).toBe(true);
    expect(r.schema).toBeNull();
    await runtime.close();
  });

  it('C2 width 条目：rawTotal 5 保留 3 → 父路径单条 {kind:width, omitted:2}，被裁子键零罗列；文本 ✂ 段条目在场、正文无 ‡', async () => {
    const { runtime, doc } = await makeBudgetRuntimeWithDoc();
    const r = ok(runtime.readData(['tags'], { maxChildrenPerNode: 3 }), 'C2');
    expect(r.value).toStrictEqual(['a', 'b', 'c']);
    expect(valueEntries(doc, ['tags'], { maxChildrenPerNode: 3 })).toStrictEqual([
      { path: ['tags'], kind: 'width', omitted: 2 },
    ]);
    expect(r.truncated).toBe(true);
    expect(r.schema!).toContain('- tags · width · 省略 2 项');
    expect(r.schema!.includes(MARKER_FOOTER)).toBe(false);
    expectTextOracle(r, doc, ['tags'], { maxChildrenPerNode: 3 }, 'C2');
    await runtime.close();
  });
});

// ═════════════════════════════ 组 D：两通道对齐（文本锚） ═════════════════════════════

describe('组 D：同一预算下值截断位置与投影文本截断事实一一对应（ADR-0024 L81；#364 文本锚）', () => {
  it('D1 readData([], {depth:1})：正文含 ‡ 页脚、头行印预算段、✂ 段列 {meta, tags} 两条', async () => {
    const { runtime, doc } = await makeBudgetRuntimeWithDoc();
    const r = ok(runtime.readData([], { depth: 1 }), 'D1');
    expect(headBlock(r.schema!)).toBe('# readData [] {depth:1}');
    const body = bodyBlock(r.schema!);
    expect(body).toContain(MARKER_FOOTER);
    expect(r.schema!).toContain('- meta · depth · 省略 2 项');
    expect(r.schema!).toContain('- tags · depth · 省略 5 项');
    expectTextOracle(r, doc, [], { depth: 1 }, 'D1');
    await runtime.close();
  });

  it('D2 readData(["meta"], {depth:0})：头行印 depth:0、正文标记位 Meta‡ + ‡ 页脚、✂ 段同基', async () => {
    const { runtime, doc } = await makeBudgetRuntimeWithDoc();
    const r = ok(runtime.readData(['meta'], { depth: 0 }), 'D2');
    expect(headBlock(r.schema!)).toBe('# readData [meta] {depth:0}');
    const body = bodyBlock(r.schema!);
    expect(body).toContain('Meta‡');
    expect(body).toContain(MARKER_FOOTER);
    expect(r.schema!).toContain('- meta · depth · 省略 2 项');
    expectTextOracle(r, doc, ['meta'], { depth: 0 }, 'D2');
    await runtime.close();
  });

  it('D3 F-x1 非 enumerable own depth：两通道同盲 → 四键 ok、零截断、全文与无预算读逐字节相等', async () => {
    const runtime = await makeBudgetRuntime();
    const plain = ok(runtime.readData([]), 'D3-plain');
    const r = ok(runtime.readData([], asOptions(nonEnumerableDepthOptions(7))), 'D3');
    expectReadDataOkKeys(r);
    expect(r.truncated).toBe(false);
    expect(r.schema).not.toBeNull();
    expect(r.schema!.includes(TRUNCATION_SECTION)).toBe(false);
    expect(r.schema).toBe(plain.schema);
    await runtime.close();
  });

  it('D4 F-x2 继承键污染（Object.prototype.depth）：own-enumerable 键空间对继承键双盲 → 同 D3（try/finally 还原）', async () => {
    const runtime = await makeBudgetRuntime();
    const plain = ok(runtime.readData([]), 'D4-plain');
    let polluted: BudgetOkShape | undefined;
    try {
      Object.defineProperty(Object.prototype, 'depth', {
        value: 7,
        enumerable: true,
        configurable: true,
        writable: true,
      });
      polluted = ok(runtime.readData([], asOptions({})), 'D4');
    } finally {
      delete (Object.prototype as Record<string, unknown>)['depth'];
    }
    const r = polluted!;
    expectReadDataOkKeys(r);
    expect(r.truncated).toBe(false);
    expect(r.schema!.includes(TRUNCATION_SECTION)).toBe(false);
    expect(r.schema).toBe(plain.schema);
    await runtime.close();
  });

  it('D5 F-x3 descriptor/get 分叉 Proxy（desc depth=1 / get 1.5）：文本按 descriptor 视图（1）对齐 oracle，get trap 零调用，无 schema:null 静默组合', async () => {
    const { runtime, doc } = await makeBudgetRuntimeWithDoc();
    const probe = descriptorGetSplitProxy(1, 1.5);
    const r = ok(runtime.readData([], asOptions(probe.options)), 'D5');
    expectReadDataOkKeys(r);
    expect(probe.getCalls()).toBe(0); // 零 [[Get]] 执行锚
    expect(r.truncated).toBe(true);
    expect(r.schema).not.toBeNull(); // ER-1 静默形态（ok ∧ schema:null ∧ truncated）不得出现
    expect(headBlock(r.schema!)).toBe('# readData [] {depth:1}');
    expectTextOracle(r, doc, [], { depth: 1 }, 'D5');
    await runtime.close();
  });

  it('D6 F-x4 抛错 get trap Proxy（descriptor 诚实 depth=1）：四键 ok、get trap 零调用、绝不 throw、文本与 oracle 逐字节一致', async () => {
    const { runtime, doc } = await makeBudgetRuntimeWithDoc();
    const probe = throwingGetProxy(1);
    const r = ok(runtime.readData([], asOptions(probe.options)), 'D6');
    expectReadDataOkKeys(r);
    expect(probe.getCalls()).toBe(0);
    expect(r.truncated).toBe(true);
    expectTextOracle(r, doc, [], { depth: 1 }, 'D6');
    await runtime.close();
  });
});

// ═════════════════════════════ 组 E：width 对投影无操作 ═════════════════════════════

describe('组 E：仅 width 触发的预算读——渲染器正文与同路径无预算读逐字节相等（ADR-0024 L125；#364 正文口径）', () => {
  it('E1 readData(["tags"], {maxChildrenPerNode:3})：truncated=true、✂ 段在场、正文无 ‡、渲染器正文逐字节相等；全文必不等（头行预算段 + ✂ 段）', async () => {
    const runtime = await makeBudgetRuntime();
    const budgeted = ok(runtime.readData(['tags'], { maxChildrenPerNode: 3 }), 'E1-budget');
    const plain = ok(runtime.readData(['tags']), 'E1-plain');
    expect(budgeted.truncated).toBe(true); // 证明 width 确实触发
    expect(plain.truncated).toBe(false);
    expect(budgeted.schema).not.toBeNull();
    expect(plain.schema).not.toBeNull();
    expect(budgeted.schema!.includes(TRUNCATION_SECTION)).toBe(true);
    expect(budgeted.schema!.includes('‡')).toBe(false); // width 对投影正文无操作
    expect(projectionBodyOnly(budgeted.schema!)).toBe(projectionBodyOnly(plain.schema!));
    expect(budgeted.schema).not.toBe(plain.schema); // 头行预算段 + ✂ 段两处事实差
    expect(headBlock(budgeted.schema!)).toBe('# readData [tags] {maxChildrenPerNode:3}');
    expect(headBlock(plain.schema!)).toBe('# readData [tags]');
    await runtime.close();
  });
});

// ═════════════════════════════ 组 F：READ_OPTIONS_INVALID 矩阵 + 差分 + 敌意净化面 ═════════════════════════════

describe('组 F：READ_OPTIONS_INVALID 公共失败分支（同步、不抛、不借码；ADR-0024 L30）', () => {
  const HOSTILE_CASES: ReadonlyArray<{ name: string; value: unknown }> = [
    { name: '未知键', value: { depth: 1, extra: true } },
    { name: '负数', value: { depth: -1 } },
    { name: '非整数', value: { depth: 1.5 } },
    { name: 'NaN', value: { depth: Number.NaN } },
    { name: 'Infinity', value: { depth: Number.POSITIVE_INFINITY } },
    { name: '-Infinity', value: { depth: Number.NEGATIVE_INFINITY } },
    { name: 'string', value: 'depth' },
    { name: 'number', value: 42 },
    { name: 'null', value: null },
    { name: '数组', value: [1] },
    { name: '类实例', value: new Date() },
    { name: '自定义原型对象', value: Object.assign(Object.create({ inherited: true }), { depth: 1 }) },
    { name: 'accessor 键', value: { get depth() { return 1; } } },
    { name: 'width 未知键', value: { maxChildrenPerNode: 2, bogus: 1 } },
  ];

  it('F1 基础矩阵：非法 options → 恰四键 {ok,code,path,message}，path 新鲜回显、message 非空、绝不含成功键', async () => {
    const runtime = await makeBudgetRuntime();
    for (const c of HOSTILE_CASES) {
      const r = failure(runtime.readData(['meta'], asOptions(c.value)), `F1/${c.name}`);
      expect(r.code, `F1/${c.name}`).toBe('READ_OPTIONS_INVALID');
      expectFailureKeys(r as object, `F1/${c.name}`);
      expect(r.path, `F1/${c.name}：path 新鲜回显`).toStrictEqual(['meta']);
      expect(typeof r.message === 'string' && r.message.length > 0, `F1/${c.name}：message 恒非空`).toBe(true);
      expect((r as { truncated?: unknown }).truncated, `F1/${c.name}：失败分支不得带截断键`).toBeUndefined();
      expect((r as { schema?: unknown }).schema, `F1/${c.name}：失败分支不得带 schema 键`).toBeUndefined();
    }
    await runtime.close();
  });

  it('F2 无 options 调用恒不产生该码（结构不可达）+ 恰四键成功面', async () => {
    const runtime = await makeBudgetRuntime();
    const r = ok(runtime.readData(['meta']), 'F2');
    expectReadDataOkKeys(r);
    expect((r as { code?: unknown }).code).toBeUndefined();
    await runtime.close();
  });

  it('F3 差分矩阵：接受集/码 ≡ readLogicalValueAtPath 权威；成功格 truncated 与值通道一致、✂ 在场 ⇔ 值通道清单非空（零泄漏单源）', async () => {
    const { runtime, doc } = await makeBudgetRuntimeWithDoc();
    for (const c of HOSTILE_CASES) {
      const r = runtime.readData(['meta'], asOptions(c.value));
      const t1 = readLogicalValueAtPath(doc, ['meta'], asOptions(c.value));
      expect(r.ok, `F3/${c.name}：接受集必须与值通道权威一致`).toBe(t1.ok);
      if (!r.ok && !t1.ok) {
        expect(r.code, `F3/${c.name}`).toBe(t1.code);
      } else if (r.ok && t1.ok) {
        expect(r.value, `F3/${c.name}`).toStrictEqual(t1.value);
        expect(r.truncated, `F3/${c.name}：truncated 逐字段透传值通道`).toBe(t1.truncated);
        expect(r.schema, `F3/${c.name}：schema 非 null`).not.toBeNull();
        expect(r.schema!.includes(TRUNCATION_SECTION), `F3/${c.name}：✂ 在场 ⇔ 值通道清单非空`).toBe(
          t1.truncations.length > 0,
        );
      }
    }
    await runtime.close();
  });

  it('F4 净化证明：{depth: undefined}（≡ 缺席）→ 恰四键 ok、零截断、全文与无 options 读逐字节相等', async () => {
    const runtime = await makeBudgetRuntime();
    const plain = ok(runtime.readData([]), 'F4-plain');
    const r = ok(runtime.readData([], asOptions({ depth: undefined })), 'F4');
    expectReadDataOkKeys(r);
    expect(r.truncated).toBe(false);
    expect(r.schema!.includes(TRUNCATION_SECTION)).toBe(false);
    expect(r.schema).toBe(plain.schema);
    await runtime.close();
  });

  it('F5 空 options {}：恰四键 ok、零截断、全文与无 options 读逐字节相等（无预算等价）', async () => {
    const runtime = await makeBudgetRuntime();
    const plain = ok(runtime.readData([]), 'F5-plain');
    const r = ok(runtime.readData([], asOptions({})), 'F5');
    expectReadDataOkKeys(r);
    expect(r.truncated).toBe(false);
    expect(r.schema).toBe(plain.schema);
    await runtime.close();
  });

  it('F6 定序：非法 path + 非法 options → PATH_NOT_ALLOWED（G0 优先于 options 校验）', async () => {
    const runtime = await makeBudgetRuntime();
    const r = failure(
      runtime.readData('not-an-array' as unknown as readonly (string | number)[], asOptions({ depth: -1 })),
      'F6',
    );
    expect(r.code).toBe('PATH_NOT_ALLOWED');
    expectFailureKeys(r as object, 'F6');
    await runtime.close();
  });

  it('F7 定序：closing/closed + 非法 options → RUNTIME_READ_DISABLED（lifecycle gate 先于一切 options 触达）', async () => {
    const runtime = await makeBudgetRuntime();
    await runtime.close();
    const r = failure(runtime.readData(['meta'], asOptions({ depth: -1 })), 'F7');
    expect(r.code).toBe('RUNTIME_READ_DISABLED');
    expectFailureKeys(r as object, 'F7');
  });

  it('F-x5 状态化 descriptor trap（首次校验通过、其后抛错）→ 恰四键 READ_OPTIONS_INVALID（出口① 重派发单源收编）、绝不 throw', async () => {
    const runtime = await makeBudgetRuntime();
    const probe = statefulDescriptorProxy(1, 3); // T1 校验 2 次 descriptor 读；第 3 次起抛错
    const r = failure(runtime.readData(['meta'], asOptions(probe.options)), 'F-x5');
    expect(r.code).toBe('READ_OPTIONS_INVALID');
    expectFailureKeys(r as object, 'F-x5');
    expect(r.path).toStrictEqual(['meta']);
    expect(typeof r.message === 'string' && r.message.length > 0).toBe(true);
    expect(probe.descriptorCalls()).toBe(4); // T1 #1/#2 → 净化 #3 抛（出口①）→ 重派发 #4 抛 → T1 收编
    await runtime.close();
  });

  it('F-x6 交替 descriptor trap（净化失败而重派发又成功）→ 恰四键 READ_OPTIONS_INVALID（出口② 接缝终态成员）、绝不 throw', async () => {
    const runtime = await makeBudgetRuntime();
    const probe = throwOnceDescriptorProxy(1, 3); // 仅第 3 次 descriptor 读抛错
    const r = failure(runtime.readData(['meta'], asOptions(probe.options)), 'F-x6');
    expect(r.code).toBe('READ_OPTIONS_INVALID');
    expectFailureKeys(r as object, 'F-x6');
    expect(r.path).toStrictEqual(['meta']);
    expect(typeof r.message === 'string' && r.message.length > 0).toBe(true);
    expect(probe.descriptorCalls()).toBe(5); // 净化 #3 抛（失败）→ 重派发 #4/#5 通过 → 出口② 构造成员
    await runtime.close();
  });
});

// ═════════════════════════════ 组 G：零物化哨兵 ═════════════════════════════

describe('组 G：零物化——被截子树内含不可表示值时预算读仍 ok（ADR-0024 L124）', () => {
  it('G1 readData(["sentinel"], {depth:0}) 折叠含有 non-finite 的子树 → ok:true、值通道单条 depth 条目（零递归）；无预算读同路径响亮失败（哨兵真实）', async () => {
    const { runtime, doc } = await makeBudgetRuntimeWithDoc({ raw: true });
    const folded = ok(runtime.readData(['sentinel'], { depth: 0 }), 'G1-budget');
    expect(folded.value).toStrictEqual({});
    expect(valueEntries(doc, ['sentinel'], { depth: 0 })).toStrictEqual([
      { path: ['sentinel'], kind: 'depth', omitted: 2 },
    ]);
    // schema 外键（raw 复制）→ 文本不可达：截断事实由 truncated 布尔 + 值通道清单承载
    expect(folded.truncated).toBe(true);
    expect(folded.schema).toBeNull();
    const plain = failure(runtime.readData(['sentinel']), 'G1-plain');
    expect(plain.code).toBe('PATH_NOT_ALLOWED');
    await runtime.close();
  });
});

// ═════════════════════════════ 组 H：schema:null 与 always-on ═════════════════════════════

describe('组 H：schema:null 单义 + 预算参数不是 schema 开关（ADR-0016 L22 / ADR-0024 L75）', () => {
  it('H1 preparing 期（P0 前）预算读：值通道照常、恰四键共存、schema 为 null', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { handle } = await makeBudgetHandle();
    const runtime = createBudgetRuntimeFromHandle(handle, { p0Gate: gate });
    expect(runtime.getStatus().schema.state).toBe('preparing');
    const r = ok(runtime.readData(['count'], { depth: 1 }), 'H1');
    expectReadDataOkKeys(r);
    expect(r.value).toBe(3);
    expect(r.schema).toBeNull();
    release();
    await waitForSchemaReady(runtime);
    await runtime.close();
  });

  it('H2 路径偏离 schema（raw 键）+ 预算：值通道照常、恰四键共存、schema 为 null', async () => {
    const runtime = await makeBudgetRuntime({ raw: true });
    const r = ok(runtime.readData(['rogue'], { depth: 1 }), 'H2');
    expectReadDataOkKeys(r);
    expect(r.value).toBe('x');
    expect(r.schema).toBeNull();
    await runtime.close();
  });
});
