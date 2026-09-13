/**
 * issue #364（ADR-0027 决策 1/2/3/4）主缝红灯契约 —— readData 投影文本化原子切换。
 *
 * 契约来源：`wiki/raw/task_issue-364_sa6_contract.md`（CT-1..CT-7 + 附录 A/B oracle
 * recipe）；SA1 设计 `wiki/raw/task_issue-364_design.md` §7-D1/D2/D3/D4/D5/D7。
 *
 * 红灯机理（HEAD `f8a06fe` 未改生产代码时）：成功分支仍是恒五键
 * `{ ok, value, schema(object), truncated, truncations }`——本文件 A1/A2 的恰四键断言、
 * B1 的文本逐字节一致性锚（`schema` 为 string）、C1–C7 的头行事实、D2 的 ✂ 载体断言
 * 全部红；红点可归因到目标形状/文本面本身，不是装置/入口/oracle 前置失败（oracle 只用
 * 公共 API：`compileSchemaEnvelope` → `resolveSchemaAtPath` → `renderProjectionText`；
 * 值通道直调 `readLogicalValueAtPath`）。
 *
 * 断言纪律（SA6 §12 头注）：只观察公共接缝运行时输出；不 skip/only/todo/env override/
 * fallback；不吞错；不做源码字符串断言代替行为验证；装置前提失败 fail loud（okOrThrow）。
 * oracle 期望串由**独立编译**的 derived 渲染（反伪绿：expected 与 actual 两条独立构造
 * 路径，不得从 `r.schema` 反推期望）。
 *
 * 组映射：A=CT-1 恒四键 / B=CT-2 一致性锚 / C=CT-3 头行 / D=CT-4 截断事实 /
 * E=CT-5 null 单义与失败面 / F=CT-6 options 零变化 / G=CT-7 文本隔离。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { readLogicalValueAtPath } from '@nomicore/doc-runtime';
import type { ReadLogicalValueAtPathOptions } from '@nomicore/doc-runtime';
import { compileSchemaEnvelope, renderProjectionText, resolveSchemaAtPath } from '@nomicore/vfsl';
import type { CompileSchemaEnvelopeResult, DerivedSchema } from '@nomicore/vfsl';
import type {
  NamespaceRuntime,
  NamespaceRuntimeReadDataBudgetResult,
  NamespaceRuntimeReadDataResult,
} from '../src/index.js';
import { createNamespaceRuntimeWithSeam } from '../src/runtime.js';
import type { NamespaceRuntimeSeamInput } from '../src/runtime.js';
import { ENV_336, createBudgetRuntimeFromHandle, makeBudgetHandle, makeBudgetRuntime, makeBudgetRuntimeWithDoc, nonEnumerableDepthOptions, waitForSchemaReady } from './runtime-readdata-shape-budget-fixture.js';
import { expectReadDataOkKeys } from './helpers/readdata-ok-shape.js';

// ───────────────────────── oracle recipe（SA6 §12.0；全公共 API） ─────────────────────────

interface Budget {
  readonly depth?: number;
  readonly maxChildrenPerNode?: number;
}

/** 组合层头行（SA6 附录 A / 设计 §7-D2 冻结格式；W1 对齐：空路径 pathText = 空串）。 */
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

interface OracleResult {
  /** 期望投影文本；resolver 失败（路径偏离）→ null。 */
  readonly text: string | null;
  /** 值通道机器信号（无预算读 = false）。 */
  readonly truncated: boolean;
  readonly resolvedOk: boolean;
}

/** 独立求值 oracle：期望串不得从 `r.schema` 反推（反伪绿 B5）。 */
function oracle(
  doc: Y.Doc,
  path: readonly (string | number)[],
  options?: Budget,
): OracleResult {
  if (options === undefined) {
    const resolved = resolveSchemaAtPath(DERIVED_336, path);
    const value = readLogicalValueAtPath(doc, path);
    if (!value.ok) throw new Error('装置前提失败：oracle 值通道必须成功（失败面由调用方分流）');
    if (!resolved.ok) return { text: null, truncated: false, resolvedOk: false };
    return {
      text: `${headLine(path)}\n\n${renderProjectionText(resolved)}`,
      truncated: false, // 无预算读结构上无截断
      resolvedOk: true,
    };
  }
  const resolved = resolveSchemaAtPath(DERIVED_336, path, options);
  const value = readLogicalValueAtPath(doc, path, options);
  if (!value.ok) throw new Error('装置前提失败：oracle 值通道必须成功（失败面由调用方分流）');
  if (!resolved.ok) return { text: null, truncated: value.truncated, resolvedOk: false };
  return {
    text: `${headLine(path, options)}\n\n${renderProjectionText(resolved, value.truncations)}`,
    truncated: value.truncated,
    resolvedOk: true,
  };
}

// ───────────────────────── 局部形状校准（不改值、不吞错） ─────────────────────────

interface ProjectionTextOk {
  readonly ok: true;
  readonly value: unknown;
  readonly schema: string | null;
  readonly truncated: boolean;
}

function okOrThrow(r: unknown, label: string): ProjectionTextOk {
  if ((r as { ok?: unknown }).ok !== true) {
    throw new Error(`${label}：契约前提失败（期望 ok:true，实际 ${JSON.stringify(r)}）`);
  }
  return r as ProjectionTextOk;
}

const FAILURE_KEYS = ['code', 'message', 'ok', 'path'] as const;

function expectFailureKeys(r: object, label: string): void {
  expect(Object.keys(r).sort(), `${label}：失败分支键集不得含成功键`).toStrictEqual([...FAILURE_KEYS]);
}

const asOptions = (value: unknown): ReadLogicalValueAtPathOptions =>
  value as ReadLogicalValueAtPathOptions;

type ReadResult = NamespaceRuntimeReadDataResult | NamespaceRuntimeReadDataBudgetResult;

function read(
  runtime: NamespaceRuntime,
  path: readonly (string | number)[],
  options?: Budget,
): ReadResult {
  return options === undefined ? runtime.readData(path) : runtime.readData(path, options);
}

/** 头行块（首个 `\n\n` 前）与正文块（头行之后；含 ✂ 段与页脚）。 */
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

/** 渲染器**正文**（剥离 ✂ 段与尾随空行）——width 无操作对偶（CT-4 D4/E1）的比较面。 */
function projectionBodyOnly(text: string): string {
  const body = bodyBlock(text);
  const cut = body.indexOf(TRUNCATION_SECTION);
  const withoutSection = cut < 0 ? body : body.slice(0, cut);
  return withoutSection.replace(/\n+$/u, '');
}

const TRUNCATION_SECTION = '✂ 截断事实：';

// ═════════════════════════════ 组 A：恒四键 / truncations 退役（CT-1） ═════════════════════════════

describe('组 A：成功分支恒四键 {ok,value,schema,truncated}，truncations 键退役（CT-1/AC1）', () => {
  it('A1 无预算成功读：恰四键（own 键集 + 无 symbol）、truncations 不在场、JSON 无该词汇', async () => {
    const runtime = await makeBudgetRuntime();
    const r = okOrThrow(runtime.readData([]), 'A1');
    expectReadDataOkKeys(r);
    expect(Reflect.ownKeys(r).every((key) => typeof key === 'string')).toBe(true);
    expect('truncations' in r).toBe(false);
    expect(JSON.stringify(r)).not.toContain('"truncations"');
    await runtime.close();
  });

  it('A2 预算成功读（触发/不触发截断两态）：同恰四键', async () => {
    const runtime = await makeBudgetRuntime();
    for (const options of [
      { depth: 1 },
      { depth: 9 },
      { maxChildrenPerNode: 3 },
      { depth: 1, maxChildrenPerNode: 3 },
    ] as const) {
      const r = okOrThrow(runtime.readData([], options), `A2/${JSON.stringify(options)}`);
      expectReadDataOkKeys(r);
      expect('truncations' in r).toBe(false);
      expect(JSON.stringify(r)).not.toContain('"truncations"');
    }
    await runtime.close();
  });

  it('A3 ok 恒真、value 键恒在场（缺席为显式 undefined）、truncated 恒为 boolean', async () => {
    const runtime = await makeBudgetRuntime();
    const present = okOrThrow(runtime.readData(['meta', 'content']), 'A3-present');
    expect(present.ok).toBe(true);
    expect(present.value).toBe('hi');
    expect(Object.prototype.hasOwnProperty.call(present, 'value')).toBe(true);
    expect(typeof present.truncated).toBe('boolean');
    const absent = okOrThrow(runtime.readData(['nick']), 'A3-absent');
    expect(Object.prototype.hasOwnProperty.call(absent, 'value')).toBe(true);
    expect(absent.value).toBeUndefined();
    expect(typeof absent.truncated).toBe('boolean');
    await runtime.close();
  });

  it('A4 失败分支键集严格 {ok,code,path,message}：PATH_NOT_ALLOWED / READ_OPTIONS_INVALID / RUNTIME_READ_DISABLED 均不含 schema/truncated/truncations', async () => {
    const runtime = await makeBudgetRuntime();
    const pathFailure = runtime.readData('not-an-array' as unknown as readonly (string | number)[]);
    expect(pathFailure.ok).toBe(false);
    expectFailureKeys(pathFailure as object, 'A4/PATH_NOT_ALLOWED');
    const optionsFailure = runtime.readData(['meta'], asOptions({ depth: -1, extra: true }));
    expect(optionsFailure.ok).toBe(false);
    expectFailureKeys(optionsFailure as object, 'A4/READ_OPTIONS_INVALID');
    await runtime.close();
    const disabled = runtime.readData(['meta']);
    expect(disabled.ok).toBe(false);
    expectFailureKeys(disabled as object, 'A4/RUNTIME_READ_DISABLED');
    for (const r of [pathFailure, optionsFailure, disabled]) {
      expect((r as Record<string, unknown>)['schema']).toBeUndefined();
      expect((r as Record<string, unknown>)['truncated']).toBeUndefined();
      expect((r as Record<string, unknown>)['truncations']).toBeUndefined();
    }
  });
});

// ═════════════════════════════ 组 B：一致性锚（CT-2） ═════════════════════════════

const MATRIX_PATHS: readonly (readonly (string | number)[])[] = [
  [],
  ['title'],
  ['count'],
  ['meta'],
  ['meta', 'content'],
  ['meta', 'extra'],
  ['tags'],
  ['tags', 0],
  ['tags', 4],
  ['nick'],
];

const RAW_MATRIX_PATHS: readonly (readonly (string | number)[])[] = [
  ...MATRIX_PATHS,
  ['rogue'],
  ['blob'],
  ['blob', 'p'],
  ['sentinel'],
  ['sentinel', 'deep'],
];

const MATRIX_BUDGETS: readonly (Budget | undefined)[] = [
  undefined,
  {},
  { depth: 0 },
  { depth: 1 },
  { depth: 2 },
  { depth: 9 },
  { maxChildrenPerNode: 3 },
  { depth: 1, maxChildrenPerNode: 3 },
  { depth: 3, maxChildrenPerNode: 1 },
];

describe('组 B：schema ≡ 头行 + renderProjectionText(独立编译 derived, 值通道截断清单)（CT-2/AC2）', () => {
  it('B1/B3 严格夹具矩阵（10 路径 × 9 预算）：逐字节 `===`；resolver 失败 ⇔ 严格 null；truncated 与值通道一致', async () => {
    const { runtime, doc } = await makeBudgetRuntimeWithDoc();
    for (const path of MATRIX_PATHS) {
      for (const options of MATRIX_BUDGETS) {
        const label = `B1/${JSON.stringify(path)}/${JSON.stringify(options)}`;
        const value = options === undefined
          ? readLogicalValueAtPath(doc, path)
          : readLogicalValueAtPath(doc, path, options);
        const r = read(runtime, path, options);
        if (!value.ok) {
          expect(r.ok, `${label}：值通道失败必须短路`).toBe(false);
          continue;
        }
        const actual = okOrThrow(r, label);
        expectReadDataOkKeys(actual);
        const expected = oracle(doc, path, options);
        expect(actual.schema, `${label}：schema 必须逐字节等于 oracle（含 null）`).toBe(expected.text);
        expect(actual.truncated, `${label}：truncated === 值通道布尔`).toBe(expected.truncated);
        if (actual.schema !== null) {
          expect(actual.truncated, `${label}：truncated ⟺ ✂ 段在场`).toBe(
            actual.schema.includes(TRUNCATION_SECTION),
          );
        }
      }
    }
    await runtime.close();
  });

  it('B1/B3 raw 夹具矩阵（14 路径 × 9 预算）：schema:null 与路径偏离同基、truncated 独立透传', async () => {
    const { runtime, doc } = await makeBudgetRuntimeWithDoc({ raw: true });
    for (const path of RAW_MATRIX_PATHS) {
      for (const options of MATRIX_BUDGETS) {
        const label = `B1-raw/${JSON.stringify(path)}/${JSON.stringify(options)}`;
        const value = options === undefined
          ? readLogicalValueAtPath(doc, path)
          : readLogicalValueAtPath(doc, path, options);
        const r = read(runtime, path, options);
        if (!value.ok) {
          expect(r.ok, `${label}：值通道失败必须短路`).toBe(false);
          continue;
        }
        const actual = okOrThrow(r, label);
        const expected = oracle(doc, path, options);
        expect(actual.schema, `${label}：schema 必须逐字节等于 oracle（含 null）`).toBe(expected.text);
        expect(actual.truncated, `${label}：truncated === 值通道布尔`).toBe(expected.truncated);
      }
    }
    await runtime.close();
  });

  it('B2 无预算格：渲染器第二参缺席（组合层不合成清单）——文本与无预算 oracle 逐字节同', async () => {
    const { runtime, doc } = await makeBudgetRuntimeWithDoc();
    const r = okOrThrow(runtime.readData([]), 'B2');
    const resolved = resolveSchemaAtPath(DERIVED_336, []);
    if (!resolved.ok) throw new Error('装置前提失败：[] 必须可解析');
    expect(r.schema).toBe(`${headLine([])}\n\n${renderProjectionText(resolved)}`);
    expect(r.schema).toBe(oracle(doc, []).text);
    await runtime.close();
  });

  it('B4 每次读重新求值：同参连续读逐字节相等；replaceSchema 后同路径读反映新 derived（无陈旧缓存）', async () => {
    const { handle } = await makeBudgetHandle();
    // replaceSchema 是写入口：构造方必须绑定 notifyDirty（ADR-0008 窄接缝）——本用例
    // 的持久化登记以 no-op 替身满足，读面断言不受影响。
    const runtime = createNamespaceRuntimeWithSeam({ handle, notifyDirty: async () => {} });
    await waitForSchemaReady(runtime);
    const first = okOrThrow(runtime.readData([]), 'B4-first');
    const second = okOrThrow(runtime.readData([]), 'B4-second');
    expect(second.schema).toBe(first.schema);
    const replaced = { ...ENV_336, text: ENV_336.text.replace('/** 元数据 */', '/** 元数据（新代） */') };
    expect(replaced.text).not.toBe(ENV_336.text);
    const res = await runtime.replaceSchema({ schema: replaced });
    expect(res).toStrictEqual({ ok: true });
    await waitForSchemaReady(runtime);
    const after = okOrThrow(runtime.readData([]), 'B4-after');
    expect(after.schema).not.toBe(first.schema);
    expect(after.schema).toContain('元数据（新代）');
    await runtime.close();
  });

  it('B5 oracle 独立性（测试结构不变量）：期望串由独立编译的 derived 渲染，绝不从 r.schema 反推', async () => {
    const { runtime, doc } = await makeBudgetRuntimeWithDoc();
    const r = okOrThrow(runtime.readData(['meta'], { depth: 0 }), 'B5');
    const expected = oracle(doc, ['meta'], { depth: 0 });
    // 独立构造路径：expected 来自 DERIVED_336（模块级独立编译），actual 来自 runtime 内部编译。
    expect(expected.text).not.toBeNull();
    expect(r.schema).toBe(expected.text);
    // 反向锚：若期望串从 actual 派生，下面这行不可能成立（改写 derived 的注释应改变期望）。
    const mutated = ENV_336.text.replace('/** 元数据 */', '/** 改名 */');
    const mutatedCompiled = compileSchemaEnvelope({ ...ENV_336, text: mutated });
    if (!mutatedCompiled.ok) throw new Error('装置前提失败：改写信封必须可编译');
    const mutatedResolved = resolveSchemaAtPath(mutatedCompiled.derived, ['meta'], { depth: 0 });
    if (!mutatedResolved.ok) throw new Error('装置前提失败：改写 derived 必须可解析');
    expect(r.schema).not.toBe(`${headLine(['meta'], { depth: 0 })}\n\n${renderProjectionText(mutatedResolved)}`);
    await runtime.close();
  });
});

// ═════════════════════════════ 组 C：头行事实性（CT-3） ═════════════════════════════

describe('组 C：头行 = "# readData [<实参 path 点分>]" + 有效预算段（CT-3/AC3）', () => {
  it('C1 空路径无预算：文本以 "# readData []\\n\\n" 开头', async () => {
    const runtime = await makeBudgetRuntime();
    const r = okOrThrow(runtime.readData([]), 'C1');
    expect(r.schema).not.toBeNull();
    expect(r.schema!.startsWith('# readData []\n\n')).toBe(true);
    expect(headBlock(r.schema!)).toBe('# readData []');
    await runtime.close();
  });

  it('C2 多段路径（含数字段）：meta.content / tags.1 点分呈现', async () => {
    const runtime = await makeBudgetRuntime();
    const nested = okOrThrow(runtime.readData(['meta', 'content']), 'C2-nested');
    expect(headBlock(nested.schema!)).toBe('# readData [meta.content]');
    const numeric = okOrThrow(runtime.readData(['tags', 1]), 'C2-numeric');
    expect(headBlock(numeric.schema!)).toBe('# readData [tags.1]');
    await runtime.close();
  });

  it('C3 头行反映实参 path 而非解析路径/别名名：["meta"] → meta（不是 Meta），ref 命中时同样如实', async () => {
    const runtime = await makeBudgetRuntime();
    const r = okOrThrow(runtime.readData(['meta']), 'C3');
    expect(headBlock(r.schema!)).toBe('# readData [meta]');
    expect(headBlock(r.schema!)).not.toContain('Meta');
    const alias = okOrThrow(runtime.readData(['meta', 'extra']), 'C3-alias');
    expect(headBlock(alias.schema!)).toBe('# readData [meta.extra]');
    await runtime.close();
  });

  it('C4 预算段三形（键序 depth → maxChildrenPerNode、逗号无空格）', async () => {
    const runtime = await makeBudgetRuntime();
    const depthOnly = okOrThrow(runtime.readData([], { depth: 1 }), 'C4-depth');
    expect(headBlock(depthOnly.schema!)).toBe('# readData [] {depth:1}');
    const widthOnly = okOrThrow(runtime.readData([], { maxChildrenPerNode: 3 }), 'C4-width');
    expect(headBlock(widthOnly.schema!)).toBe('# readData [] {maxChildrenPerNode:3}');
    const both = okOrThrow(runtime.readData([], { depth: 1, maxChildrenPerNode: 3 }), 'C4-both');
    expect(headBlock(both.schema!)).toBe('# readData [] {depth:1,maxChildrenPerNode:3}');
    await runtime.close();
  });

  it('C5 无预算省略预算段：无 options / {} / {depth:undefined} / 非 enumerable / 继承键污染 → 全文与无 options 读逐字节相等', async () => {
    const runtime = await makeBudgetRuntime();
    const plain = okOrThrow(runtime.readData([]), 'C5-plain');
    const empty = okOrThrow(runtime.readData([], asOptions({})), 'C5-empty');
    expect(empty.schema).toBe(plain.schema);
    const undefinedAxis = okOrThrow(runtime.readData([], asOptions({ depth: undefined })), 'C5-undefined');
    expect(undefinedAxis.schema).toBe(plain.schema);
    const nonEnumerable = okOrThrow(runtime.readData([], asOptions(nonEnumerableDepthOptions(7))), 'C5-non-enum');
    expect(nonEnumerable.schema).toBe(plain.schema);
    let polluted: ProjectionTextOk | undefined;
    try {
      Object.defineProperty(Object.prototype, 'depth', {
        value: 7,
        enumerable: true,
        configurable: true,
        writable: true,
      });
      polluted = okOrThrow(runtime.readData([], asOptions({})), 'C5-inherited');
    } finally {
      delete (Object.prototype as Record<string, unknown>)['depth'];
    }
    expect(polluted!.schema).toBe(plain.schema);
    expect(headBlock(plain.schema!)).toBe('# readData []');
    await runtime.close();
  });

  it('C6 行注入防御：path 段含 \\n / \\r\\n → 头行内折叠为空格、文本行数不增', async () => {
    const text = `
type ROOT = YMap<{
  rec: Record<string, YLeaf<number>>;
}>;
`.trim();
    const { handle, doc } = await makeBudgetHandle({ text });
    const rec = new Y.Map<unknown>();
    rec.set('a\nb', 1);
    rec.set('c\r\nd', 2);
    doc.getMap('ROOT').set('rec', rec);
    const runtime = createBudgetRuntimeFromHandle(handle);
    await waitForSchemaReady(runtime);
    const lf = okOrThrow(runtime.readData(['rec', 'a\nb']), 'C6-lf');
    expect(headBlock(lf.schema!)).toBe('# readData [rec.a b]');
    expect(lf.schema!.split('\n\n')[0]!.includes('\n')).toBe(false);
    const crlf = okOrThrow(runtime.readData(['rec', 'c\r\nd']), 'C6-crlf');
    expect(headBlock(crlf.schema!)).toBe('# readData [rec.c d]');
    expect(headBlock(crlf.schema!)).not.toContain('\r');
    await runtime.close();
  });

  it('C7 schema === null 时无头行（# readData 不可达；严格 null、非空串）', async () => {
    const runtime = await makeBudgetRuntime({ raw: true });
    const r = okOrThrow(runtime.readData(['rogue'], { depth: 1 }), 'C7');
    expect(r.schema).toBeNull();
    expect(r.schema).not.toBe('');
    await runtime.close();
  });
});

// ═════════════════════════════ 组 D：截断事实一致性（CT-4） ═════════════════════════════

describe('组 D：truncated === 本次读发生过截断；文本 ✂ 段为唯一截断载体（CT-4/AC4）', () => {
  it('D1/D5 无预算读与充足预算读：truncated=false、文本无 ✂、无 ‡', async () => {
    const runtime = await makeBudgetRuntime();
    for (const [path, options] of [
      [[], undefined],
      [['meta', 'content'], undefined],
      [['meta'], { depth: 9 }],
      [['count'], { depth: 1 }],
    ] as ReadonlyArray<readonly [readonly (string | number)[], Budget | undefined]>) {
      const label = `D1/${JSON.stringify(path)}/${JSON.stringify(options)}`;
      const r = okOrThrow(read(runtime, path, options), label);
      expect(r.truncated, label).toBe(false);
      expect(r.schema, label).not.toBeNull();
      expect(r.schema!.includes(TRUNCATION_SECTION), `${label}：无截断不得渲染 ✂ 段`).toBe(false);
      expect(r.schema!.includes('‡'), `${label}：无截断不得有标记`).toBe(false);
    }
    await runtime.close();
  });

  it('D3 depth 截断（[] + depth:1）：truncated=true、✂ 段在场、正文含 ‡ 且页脚在场', async () => {
    const runtime = await makeBudgetRuntime();
    const r = okOrThrow(runtime.readData([], { depth: 1 }), 'D3');
    expect(r.truncated).toBe(true);
    expect(r.schema!.includes(TRUNCATION_SECTION)).toBe(true);
    const body = bodyBlock(r.schema!);
    expect(body).toContain('‡');
    expect(body).toContain('‡ 截断标记：');
    await runtime.close();
  });

  it('D4 width-only 截断（["tags"] + maxChildrenPerNode:3）：truncated=true、✂ 段在场、正文无 ‡；正文与无预算读逐字节相等（全文因头行预算段+✂段必不等）', async () => {
    const runtime = await makeBudgetRuntime();
    const budgeted = okOrThrow(runtime.readData(['tags'], { maxChildrenPerNode: 3 }), 'D4-budget');
    const plain = okOrThrow(runtime.readData(['tags']), 'D4-plain');
    expect(budgeted.truncated).toBe(true);
    expect(budgeted.schema!.includes(TRUNCATION_SECTION)).toBe(true);
    const body = bodyBlock(budgeted.schema!);
    expect(body.includes('‡')).toBe(false);
    expect(projectionBodyOnly(budgeted.schema!)).toBe(projectionBodyOnly(plain.schema!));
    expect(budgeted.schema).not.toBe(plain.schema);
    expect(headBlock(budgeted.schema!)).toBe('# readData [tags] {maxChildrenPerNode:3}');
    expect(headBlock(plain.schema!)).toBe('# readData [tags]');
    await runtime.close();
  });

  it('D6 schema:null × 预算截断（raw 键 blob + depth:0）：严格 null 且 truncated === true（诚实共存）', async () => {
    const runtime = await makeBudgetRuntime({ raw: true });
    const r = okOrThrow(runtime.readData(['blob'], { depth: 0 }), 'D6');
    expect(r.schema).toBeNull();
    expect(r.truncated).toBe(true);
    expect(r.value).toStrictEqual({});
    // 空串不得作为 null 的替身；文本载体不可达是这个组合的诚实形态。
    expect(r.schema).not.toBe('');
    await runtime.close();
  });

  it('D7 值通道折叠/省略语义零变化：depth 空壳 + 条目、width 键省略、omitted = 直接子项数（oracle 直调对照）', async () => {
    const { runtime, doc } = await makeBudgetRuntimeWithDoc({ raw: true });
    const depthRead = okOrThrow(runtime.readData(['blob'], { depth: 0 }), 'D7-depth');
    const depthOracle = readLogicalValueAtPath(doc, ['blob'], { depth: 0 });
    if (!depthOracle.ok) throw new Error('装置前提失败：值通道预算读必须成功');
    expect(depthRead.value).toStrictEqual(depthOracle.value);
    expect(depthRead.truncated).toBe(depthOracle.truncated);
    expect(depthOracle.truncations).toStrictEqual([{ path: ['blob'], kind: 'depth', omitted: 2 }]);
    expect(depthOracle.truncations[0]!.omitted).not.toBe(6); // 直接子项数 ≠ 后代总数
    const widthRead = okOrThrow(runtime.readData(['tags'], { maxChildrenPerNode: 3 }), 'D7-width');
    const widthOracle = readLogicalValueAtPath(doc, ['tags'], { maxChildrenPerNode: 3 });
    if (!widthOracle.ok) throw new Error('装置前提失败：值通道 width 预算读必须成功');
    expect(widthRead.value).toStrictEqual(['a', 'b', 'c']);
    expect(widthOracle.truncations).toStrictEqual([{ path: ['tags'], kind: 'width', omitted: 2 }]);
    // 零物化哨兵：折叠读保持 ok（值通道未递归展开 non-finite 子树）。
    const sentinel = okOrThrow(runtime.readData(['sentinel'], { depth: 0 }), 'D7-sentinel');
    expect(sentinel.truncated).toBe(true);
    await runtime.close();
  });
});

// ═════════════════════════════ 组 E：null 单义与失败/生命周期（CT-5） ═════════════════════════════

describe('组 E：schema:null 三情形单义直通 + 失败/生命周期不变（CT-5/AC5）', () => {
  it('E1 三情形（无 active schema / 路径偏离 / 敌意 path）：严格 null、ok 恒真、value 照常、零外抛', async () => {
    // ① preparing（P0 未结算）
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { handle } = await makeBudgetHandle();
    const preparing = createBudgetRuntimeFromHandle(handle, { p0Gate: gate });
    expect(preparing.getStatus().schema.state).toBe('preparing');
    const noSchema = okOrThrow(preparing.readData(['count'], { depth: 1 }), 'E1-preparing');
    expect(noSchema.schema).toBeNull();
    expect(noSchema.value).toBe(3);
    release();
    await waitForSchemaReady(preparing);
    await preparing.close();

    // ② 路径偏离 schema（raw 键）
    const rawRuntime = await makeBudgetRuntime({ raw: true });
    const deviation = okOrThrow(rawRuntime.readData(['rogue']), 'E1-deviation');
    expect(deviation.schema).toBeNull();
    expect(deviation.value).toBe('x');
    await rawRuntime.close();

    // ③ 敌意 path（重定义迭代器的真数组 / Proxy 数组）
    const runtime = await makeBudgetRuntime();
    const hostileArray = ['count'] as (string | number)[];
    let iteratorCalls = 0;
    Object.defineProperty(hostileArray, Symbol.iterator, {
      value() {
        iteratorCalls += 1;
        throw new Error('hostile iterator');
      },
    });
    const hostile = okOrThrow(runtime.readData(hostileArray), 'E1-hostile');
    expect(hostile.schema).toBeNull();
    expect(hostile.value).toBe(3);
    await runtime.close();
  });

  it('E2 敌意 path 的敌意函数/trap 零调用：迭代器零调用、Proxy get trap 对 Symbol.iterator 零触达', async () => {
    const runtime = await makeBudgetRuntime();
    let iteratorCalls = 0;
    const hostileArray = ['count'] as (string | number)[];
    Object.defineProperty(hostileArray, Symbol.iterator, {
      value() {
        iteratorCalls += 1;
        throw new Error('hostile iterator');
      },
    });
    okOrThrow(runtime.readData(hostileArray), 'E2-iterator');
    expect(iteratorCalls).toBe(0);
    let iteratorKeyReads = 0;
    const proxy = new Proxy(['count'], {
      get(target, key) {
        if (key === Symbol.iterator) {
          iteratorKeyReads += 1;
          throw new Error('hostile get');
        }
        return Reflect.get(target, key);
      },
    });
    const proxied = okOrThrow(runtime.readData(proxy as unknown as readonly (string | number)[]), 'E2-proxy');
    expect(proxied.schema).toBeNull();
    expect(iteratorKeyReads).toBeGreaterThan(0); // 守卫做同一性比较（属性读），但不调用迭代器
    expect(iteratorCalls).toBe(0);
    await runtime.close();
  });

  it('E3 生命周期：closing/closed → RUNTIME_READ_DISABLED 恰四键失败形，先于一切 options 读取（敌意 trap 零执行）', async () => {
    const runtime = await makeBudgetRuntime();
    await runtime.close();
    let descriptorReads = 0;
    const hostileOptions = new Proxy(
      { depth: 1 },
      {
        getOwnPropertyDescriptor(target, key) {
          descriptorReads += 1;
          throw new Error('must not be touched');
        },
      },
    );
    const r = runtime.readData(['meta'], asOptions(hostileOptions));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('E3：closed 期必须拒绝');
    expect(r.code).toBe('RUNTIME_READ_DISABLED');
    expectFailureKeys(r, 'E3');
    expect(descriptorReads).toBe(0);
  });

  it('E4 定序：非法 path + 非法 options → PATH_NOT_ALLOWED；closed + 非法 options → RUNTIME_READ_DISABLED', async () => {
    const runtime = await makeBudgetRuntime();
    const both = runtime.readData('nope' as unknown as readonly (string | number)[], asOptions({ depth: -1 }));
    expect(both.ok).toBe(false);
    if (both.ok) throw new Error('E4：双重非法必须失败');
    expect(both.code).toBe('PATH_NOT_ALLOWED');
    await runtime.close();
    const closed = runtime.readData(['meta'], asOptions({ depth: -1 }));
    expect(closed.ok).toBe(false);
    if (closed.ok) throw new Error('E4：closed 期必须失败');
    expect(closed.code).toBe('RUNTIME_READ_DISABLED');
  });

  it('E5 可信域 InternalError 逃逸通道保持唯一：注入畸形 derived → readData throw（构造名 InternalError），不得被组合层收敛为 schema:null', async () => {
    const { handle } = await makeBudgetHandle();
    const real = compileSchemaEnvelope(ENV_336);
    if (!real.ok) throw new Error('装置前提失败：ENV_336 必须可编译');
    const broken = {
      ...real,
      derived: { ...real.derived, structure: { kind: 'array', element: { kind: 'leaf' } } },
    } as unknown as CompileSchemaEnvelopeResult;
    const runtime = createNamespaceRuntimeWithSeam({
      handle,
      compile: () => broken,
    } as NamespaceRuntimeSeamInput);
    await waitForSchemaReady(runtime);
    let error: unknown = '(no throw)';
    try {
      runtime.readData(['count']);
    } catch (caught) {
      error = caught;
    }
    expect((error as { constructor?: { name?: string } }).constructor?.name).toBe('InternalError');
    await runtime.close();
  });

  it('E6 敌意输入零 throw：敌意 path / 敌意 options 下 readData 均不抛、成功面照常', async () => {
    const runtime = await makeBudgetRuntime();
    expect(() => runtime.readData(['absent-key', Symbol('rogue')] as unknown as readonly (string | number)[])).not.toThrow();
    expect(() => runtime.readData(['meta'], asOptions({ get depth() { return 1; } }))).not.toThrow();
    expect(() => runtime.readData(['meta'], asOptions(Object.create({ depth: 1 })))).not.toThrow();
    await runtime.close();
  });
});

// ═════════════════════════════ 组 F：options 闭合形状零变化（CT-6） ═════════════════════════════

describe('组 F：options 闭合形状 {depth?,maxChildrenPerNode?} 零变化（CT-6/AC6）', () => {
  const HOSTILE_CASES: ReadonlyArray<{ name: string; value: unknown }> = [
    { name: '未知键', value: { depth: 1, extra: true } },
    { name: '负数', value: { depth: -1 } },
    { name: '非整数', value: { depth: 1.5 } },
    { name: 'NaN', value: { depth: Number.NaN } },
    { name: 'Infinity', value: { depth: Number.POSITIVE_INFINITY } },
    { name: 'string', value: 'depth' },
    { name: 'number', value: 42 },
    { name: 'null', value: null },
    { name: '数组', value: [1] },
    { name: '类实例', value: new Date() },
    { name: '自定义原型对象', value: Object.assign(Object.create({ inherited: true }), { depth: 1 }) },
    { name: 'accessor 键', value: { get depth() { return 1; } } },
    { name: 'width 未知键', value: { maxChildrenPerNode: 2, bogus: 1 } },
  ];

  it('F1 非法 options 矩阵 → READ_OPTIONS_INVALID 恰 {ok,code,path,message}，path 新鲜回显、message 非空、绝不静默 schema:null', async () => {
    const runtime = await makeBudgetRuntime();
    for (const testCase of HOSTILE_CASES) {
      const r = runtime.readData(['meta'], asOptions(testCase.value));
      expect(r.ok, `F1/${testCase.name}`).toBe(false);
      if (r.ok) continue;
      expect(r.code, `F1/${testCase.name}`).toBe('READ_OPTIONS_INVALID');
      expectFailureKeys(r, `F1/${testCase.name}`);
      expect(r.path, `F1/${testCase.name}：path 新鲜回显`).toStrictEqual(['meta']);
      expect(typeof r.message === 'string' && r.message.length > 0, `F1/${testCase.name}：message 恒非空`).toBe(true);
    }
    await runtime.close();
  });

  it('F2 差分矩阵：runtime 接受集/拒绝码 ≡ readLogicalValueAtPath 权威（零泄漏单源）', async () => {
    const { runtime, doc } = await makeBudgetRuntimeWithDoc();
    for (const testCase of HOSTILE_CASES) {
      const r = runtime.readData(['meta'], asOptions(testCase.value));
      const authority = readLogicalValueAtPath(doc, ['meta'], asOptions(testCase.value));
      expect(r.ok, `F2/${testCase.name}：接受集必须与值通道权威一致`).toBe(authority.ok);
      if (!r.ok && !authority.ok) expect(r.code, `F2/${testCase.name}`).toBe(authority.code);
    }
    await runtime.close();
  });

  it('F3 canonical 等价：{} / {depth:undefined} / 非 enumerable / 继承键污染 → 全文逐字节等于无 options 读（含头行无预算段）', async () => {
    const runtime = await makeBudgetRuntime();
    const plain = okOrThrow(runtime.readData(['meta']), 'F3-plain');
    const candidates = [
      okOrThrow(runtime.readData(['meta'], asOptions({})), 'F3-empty'),
      okOrThrow(runtime.readData(['meta'], asOptions({ depth: undefined })), 'F3-present-undefined'),
      okOrThrow(runtime.readData(['meta'], asOptions(nonEnumerableDepthOptions(5))), 'F3-non-enum'),
    ];
    let polluted: ProjectionTextOk | undefined;
    try {
      Object.defineProperty(Object.prototype, 'maxChildrenPerNode', {
        value: 2,
        enumerable: true,
        configurable: true,
        writable: true,
      });
      polluted = okOrThrow(runtime.readData(['meta'], asOptions({})), 'F3-inherited');
    } finally {
      delete (Object.prototype as Record<string, unknown>)['maxChildrenPerNode'];
    }
    candidates.push(polluted!);
    for (const candidate of candidates) {
      expect(candidate.schema).toBe(plain.schema);
      expect(candidate.truncated).toBe(false);
    }
    await runtime.close();
  });
});

// ═════════════════════════════ 组 G：detach 退役与文本隔离（CT-7） ═════════════════════════════

describe('组 G：投影 detach 深拷贝层退役——文本天然 detached（CT-7/AC7）', () => {
  it('G1 schema 非 null 时为 string；结果对象图内无投影对象（JSON 不出现 "valueSchema"）', async () => {
    const runtime = await makeBudgetRuntime();
    const r = okOrThrow(runtime.readData(['meta'], { depth: 1 }), 'G1');
    expect(typeof r.schema).toBe('string');
    expect(JSON.stringify(r)).not.toContain('"valueSchema"');
    expect(JSON.stringify(r)).not.toContain('"aliasDocs"');
    await runtime.close();
  });

  it('G2 文本与 runtime 活 schema 零交叉污染：同参连续/交错读逐字节相等；改写 r.value 后重读文本不变', async () => {
    const runtime = await makeBudgetRuntime();
    const first = okOrThrow(runtime.readData(['meta'], { depth: 1 }), 'G2-first');
    const other = okOrThrow(runtime.readData(['tags'], { depth: 0 }), 'G2-other');
    const second = okOrThrow(runtime.readData(['meta'], { depth: 1 }), 'G2-second');
    expect(second.schema).toBe(first.schema);
    // 调用方改写值深对象（r.value 是普通快照）——不得影响后续文本。
    (first.value as Record<string, unknown>)['content'] = 'tampered';
    const third = okOrThrow(runtime.readData(['meta'], { depth: 1 }), 'G2-third');
    expect(third.schema).toBe(first.schema);
    expect(other.schema).not.toBe(first.schema);
    await runtime.close();
  });
});
