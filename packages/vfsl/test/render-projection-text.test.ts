/**
 * issue #363 红灯验收契约（运行时）— 投影文本渲染器 `renderProjectionText`。
 *
 * 契约来源：SA6 `wiki/raw/task_issue-363_sa6_contract.md` §12.2–§12.8（CT-1…CT-7）+
 * 设计 `wiki/raw/task_issue-363_design.md` §7/§12/§12.1（CT-8 环组、CT-9 畸形组、
 * R4 环安全零变异审计）、母法 ADR 0027 决策 2/3。
 *
 * 红灯纪律（SA6 §12.1）：本文件顶层**不静态 import 新名目**——经 `import * as vfsl`
 * + 动态属性读取接缝；接缝缺失时 loud 抛「能力缺口」错误（不得裸 TypeError），且每个
 * 测试**第一条语句**先取接缝，保证红因始终归因于能力缺口而非金标缺失。环夹具/
 * `resolveSchemaAtPath` 为既有导出，可静态 import。断言只经公共入口运行时可观察输出，
 * 不 grep 生产源码；无 skip/only/todo/env override/fallback/软化断言。
 */
import { describe, expect, it } from 'vitest';
import * as vfsl from '../src/index.js';
import { resolveSchemaAtPath } from '../src/index.js';
import type { DerivedSchema } from '../src/index.js';
import { InternalError } from '../src/resolve.js';
import {
  BUDGET_OPTIONAL_TWIN_PATHS,
  budgetFixtureDerived,
  containerRingDerived,
  optionalRingDerived,
  unionRingDerived,
} from './resolve-schema-at-path-budget-fixture.js';
import { EXPECTED_DOCS } from './resolve-schema-at-path-member-docs-fixture.js';
import {
  BENIGN_DOCS,
  EXPECTED_CELL_KEYS,
  HOSTILE_DOCS,
  MALFORMED_ALIAS_BODY,
  MALFORMED_BAD_KIND,
  MALFORMED_DOCS_VALUE,
  MALFORMED_INT_HALF,
  MALFORMED_MISSING_KEYS,
  MALFORMED_NODE,
  MALFORMED_TRUNCATION_KIND,
  MALFORMED_TRUNCATIONS_SHAPE,
  RENDER_GOLDENS,
  TRUNCATIONS_EMPTY_PATH,
  TRUNCATIONS_INDEXED,
  TRUNCATIONS_MULTI,
  TRUNCATIONS_SHUFFLED,
  TRUNCATIONS_SINGLE,
  benignDocsProjection,
  cellInput,
  clearedDocsProjection,
  clueProjection,
  hostileDocsProjection,
  markerlessTwin,
  multiEntryDocsProjection,
  optionalWrappedProjection,
  renderCellInputs,
  twoMarkerProjection,
  unreferencedAliasProjection,
} from './render-projection-text-fixture.js';
import type { OptionalMarkerHost, RenderTruncationEntry } from './render-projection-text-fixture.js';

// —— 动态接缝（HEAD 上非 function → loud 能力缺口）——

type Renderer = (projection: unknown, truncations?: readonly RenderTruncationEntry[]) => string;

const CAPABILITY_GAP =
  '能力缺口：renderProjectionText 未经 @nomicore/vfsl 公共入口导出（ADR 0027 决策 2）';

function seamRenderer(): Renderer {
  const candidate = (vfsl as unknown as Record<string, unknown>)['renderProjectionText'];
  if (typeof candidate !== 'function') {
    throw new Error(CAPABILITY_GAP);
  }
  return candidate as Renderer;
}

// —— 观察辅助（只读，不触生产实现）——

function textLines(text: string): string[] {
  const lines = text.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** 结构前缀 = 行内首个 ` // ` 之前的文本（设计 §7.1 术语）。 */
function structurePrefix(line: string): string {
  const idx = line.indexOf(' // ');
  return idx === -1 ? line : line.slice(0, idx);
}

function structureLines(text: string): string[] {
  return textLines(text).map(structurePrefix);
}

function countOccurrences(text: string, token: string): number {
  return text.split(token).length - 1;
}

/** 投影内 `kind:'truncated'` 节点数（结构递归、栈防环；不改写输入）。 */
function countMarkers(value: unknown): number {
  const stack = new Set<object>();
  const visit = (node: unknown): number => {
    if (node === null || typeof node !== 'object') return 0;
    if (stack.has(node)) return 0;
    stack.add(node);
    let count = 0;
    const n = node as Record<string, unknown>;
    if (n['kind'] === 'truncated') {
      count = 1;
    } else if (n['kind'] === 'object' && Array.isArray(n['fields'])) {
      for (const f of n['fields'] as Array<Record<string, unknown>>) count += visit(f['value']);
    } else if (n['kind'] === 'optional') {
      count += visit(n['value']);
    } else if (n['kind'] === 'array') {
      count += visit(n['element']);
    } else if (n['kind'] === 'union' && Array.isArray(n['members'])) {
      for (const m of n['members'] as unknown[]) count += visit(m);
    }
    stack.delete(node);
    return count;
  };
  const projection = value as Record<string, unknown>;
  let total = visit(projection['valueSchema']);
  const aliases = projection['aliases'];
  if (aliases !== null && typeof aliases === 'object') {
    for (const body of Object.values(aliases as Record<string, unknown>)) total += visit(body);
  }
  return total;
}

/**
 * CT-8⑤ 零变异观测（设计 §12.1 规范性）：环安全输入完整性审计。
 * 禁止对 projection 使用 `JSON.stringify`（循环对象图上抛 TypeError——R4 病灶）。
 */
interface ProjectionAudit {
  nodes: object[];
  digest: string;
}

function auditProjection(projection: unknown): ProjectionAudit {
  const nodes: object[] = [];
  const seen = new Map<object, number>();
  const visit = (v: unknown): string => {
    if (v === null) return 'null';
    if (typeof v !== 'object') {
      if (typeof v === 'string') return `string:${JSON.stringify(v)}`;
      if (typeof v === 'function' || typeof v === 'symbol') return `<${typeof v}>`;
      return `${typeof v}:${String(v)}`;
    }
    const hit = seen.get(v);
    if (hit !== undefined) return `@${hit}`;
    const id = nodes.length;
    seen.set(v, id);
    nodes.push(v);
    if (Array.isArray(v)) return `[${id}|array]:{${v.map((e) => visit(e)).join(',')}}`;
    const tag = Object.prototype.toString.call(v);
    const parts = Object.keys(v).map(
      (k) => `${JSON.stringify(k)}=${visit((v as Record<string, unknown>)[k])}`,
    );
    return `[${id}|${tag}]:{${parts.join(',')}}`;
  };
  return { nodes, digest: visit(projection) };
}

function readAt(derived: DerivedSchema, path: readonly (string | number)[], depth?: number): unknown {
  const result =
    depth === undefined ? resolveSchemaAtPath(derived, path) : resolveSchemaAtPath(derived, path, { depth });
  if (!result.ok) {
    throw new Error(`前置 resolver 失败（不应发生）：path=${JSON.stringify(path)} depth=${String(depth)}`);
  }
  return result;
}

const CELLS = renderCellInputs();

// —— G1 / CT-1 公共导出与零选项签名 ——

describe('#363 G1 CT-1 公共导出与零选项签名', () => {
  it('G1.1 经公共入口取得 function 且返回 string', () => {
    const render = seamRenderer();
    const text = render(cellInput('F1 []').projection);
    expect(typeof text).toBe('string');
  });

  it('G1.2 一参调用 ≡ 二参显式 undefined（逐字节）', () => {
    const render = seamRenderer();
    const projection = cellInput('F2 [] d1').projection;
    expect(render(projection)).toBe(render(projection, undefined));
  });

  it('G1.3 输出不含组合层头行（缝 2 职责，非渲染器）', () => {
    const render = seamRenderer();
    const text = render(cellInput('F1 []').projection);
    expect(text.includes('# readData [')).toBe(false);
  });

  it('G1.4 输出以恰一个 \\n 结尾且无尾随空白', () => {
    const render = seamRenderer();
    const text = render(cellInput('F1 []').projection);
    expect(text.endsWith('\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
    for (const line of textLines(text)) {
      expect(line.endsWith(' ')).toBe(false);
      expect(line.endsWith('\t')).toBe(false);
    }
  });
});

// —— G2 / CT-2 文法快照矩阵（86 单元）——

describe('#363 G2 CT-2 文法快照矩阵', () => {
  it('G2.0 金标完整性：键集 ≡ 独立推导的 86 单元键全集（反空转）', () => {
    const render = seamRenderer();
    expect(render(cellInput('F1 []').projection)).toBeTypeOf('string');
    expect(Object.keys(RENDER_GOLDENS).sort()).toEqual([...EXPECTED_CELL_KEYS].sort());
    expect(EXPECTED_CELL_KEYS).toHaveLength(86);
  });

  for (const cell of CELLS) {
    it(`G2 金标 ${cell.key}`, () => {
      const render = seamRenderer();
      const text = render(cell.projection, cell.truncations);
      expect(text).toBe(RENDER_GOLDENS[cell.key]);
    });
  }

  it('G2.F1 关键形态：ROOT.inlPair 裸字段宿主行承载 docs（R1；预算夹具 A.1 基线）', () => {
    const render = seamRenderer();
    const text = render(cellInput('F2 [] d9').projection);
    expect(text).toContain('inlPair: // 内联联合位');
  });

  it('G2.F1 关键形态：根位 optional（R2）——[config] = {? 块、[notes] = string?', () => {
    const render = seamRenderer();
    expect(render(cellInput('F1 ["config"]').projection)).toContain('{?');
    expect(textLines(render(cellInput('F1 ["notes"]').projection))[0]).toBe('string?');
  });

  it('G2.F1 关键形态：裸别名宿主行承载 aliasDocs（R1）与合成 union 根（A.6/A.7）', () => {
    const render = seamRenderer();
    expect(render(cellInput('F1 ["assets","img1"]').projection)).toContain(
      'type AssetEntity = // 资产实体：封闭联合',
    );
    expect(textLines(render(cellInput('F1 ["u","x"]').projection))).toEqual(['| string', '| number[]']);
  });

  it('G2.F2 关键形态：[] d1 裸宿主行 + ref 位标 + 无别名块（A.2）', () => {
    const render = seamRenderer();
    const text = render(cellInput('F2 [] d1').projection);
    expect(text).toContain('inlPair: // 内联联合位');
    expect(text).toContain('shallow: Ledger‡ // 浅引用位');
    expect(text).not.toContain('type Ledger');
  });

  it('G2.F2 关键形态：[] d0 单标记根行 + 页脚（无字段槽位）', () => {
    const render = seamRenderer();
    const lines = textLines(render(cellInput('F2 [] d0').projection));
    expect(lines[0]).toBe('[...]‡');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe('‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。');
  });

  it('G2.F3 M4 成员注释：EXPECTED_DOCS 全部首行口径文本在场', () => {
    const render = seamRenderer();
    const text = render(cellInput('F3 []').projection);
    for (const [key, entries] of Object.entries(EXPECTED_DOCS)) {
      const first = entries[0];
      if (first === undefined) throw new Error(`夹具 docs 条目为空：${key}`);
      expect(text, `docs 键 ${key} 首行口径缺席`).toContain(first.trim());
    }
  });

  it('G2.F5 槽位 docs 随宿主：数组元素槽位与被截闭包别名（#359 文本面）', () => {
    const render = seamRenderer();
    const text = render(cellInput('F5 [] d2').projection);
    expect(text).toContain('workRecords: WorkRecord‡[] // 有序执行事实 · 单条执行事实');
    expect(text).toContain('byKey: Record<string, WorkRecord‡> // 按键索引 · 键槽执行事实');
    expect(text).toContain('type IssueState = "open" | "closed" // 议题观察状态枚举 · 议题开着 · 议题关了');
  });

  it('G2.F6 文法形态逐字：Pattern / Int 两态 / Range / 数字 enum / xml / T[] / 折行', () => {
    const render = seamRenderer();
    expect(render(cellInput('F6 ["code"]').projection)).toContain('Pattern<"^[a-z]{2}-[0-9]{2}$">');
    expect(textLines(render(cellInput('F6 ["bare"]').projection))[0]).toBe('Int');
    expect(textLines(render(cellInput('F6 ["amount"]').projection))[0]).toBe('Int<1, 9999999999>');
    expect(textLines(render(cellInput('F6 ["ratio"]').projection))[0]).toBe('Range<0, 100>');
    expect(textLines(render(cellInput('F6 ["level"]').projection))[0]).toBe('1 | 2');
    expect(textLines(render(cellInput('F6 ["body"]').projection))[0]).toBe('YXmlFragment');
    expect(textLines(render(cellInput('F6 ["plain"]').projection))[0]).toBe('string[]');
    const longLines = textLines(render(cellInput('F6 ["long"]').projection));
    expect(longLines[0]).toBe('"projection-alpha-0001"');
    expect(longLines.slice(1)).toEqual([
      '  | "projection-beta-0002"',
      '  | "projection-gamma-0003"',
      '  | "projection-delta-0004"',
      '  | "projection-epsilon-0005"',
    ]);
  });
});

// —— G3 / CT-3 `‡` / `[...]‡` / 页脚 ——

describe('#363 G3 CT-3 截断位标与页脚', () => {
  const FOOTER = '‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。';

  it('G3.1 ref 线索：<名>‡ 直写 + 页脚恰一行（m=1 → ‡ 计 2）', () => {
    const render = seamRenderer();
    const text = render(clueProjection({ via: 'ref', name: 'Ring' }));
    expect(text).toContain('cut: Ring‡');
    expect(countOccurrences(text, '‡')).toBe(2);
    expect(textLines(text).filter((l) => l === FOOTER)).toHaveLength(1);
  });

  it('G3.2 container 线索：字面 [...]‡（不编造类型名）', () => {
    const render = seamRenderer();
    const text = render(clueProjection({ via: 'container', containerKind: 'array' }));
    expect(text).toContain('cut: [...]‡');
    expect(text).not.toContain('Ring‡');
    expect(countOccurrences(text, '‡')).toBe(2);
  });

  it('G3.3 无标记：无 ‡、无页脚', () => {
    const render = seamRenderer();
    const text = render(markerlessTwin());
    expect(countOccurrences(text, '‡')).toBe(0);
    expect(text).not.toContain('‡ 截断标记');
  });

  it('G3.4 敏感性：删 1 标记 → ‡ 计数恰减 1；换线索 → 形态随线索改变', () => {
    const render = seamRenderer();
    const two = render(twoMarkerProjection());
    expect(countOccurrences(two, '‡')).toBe(3);
    expect(two).toContain('first: Alpha‡');
    expect(two).toContain('second: [...]‡');
    const one = render(clueProjection({ via: 'ref', name: 'Alpha' }));
    expect(countOccurrences(one, '‡')).toBe(2);
  });

  it('G3.5 页脚位于正文与全部别名块之后（正文 → 别名块 → 页脚）', () => {
    const render = seamRenderer();
    const projection = {
      valueSchema: { kind: 'truncated', clue: { via: 'container', containerKind: 'object' } },
      aliases: {
        Later: { kind: 'object', fields: [{ name: 'x', value: { kind: 'scalar', type: 'string' } }] },
      },
      docs: {},
      aliasDocs: {},
    };
    const text = render(projection);
    expect(text.indexOf('type Later')).toBeGreaterThan(-1);
    expect(text.indexOf(FOOTER)).toBeGreaterThan(text.indexOf('type Later'));
  });

  it('G3.6 计数不变量：全部 86 金标格 ‡ 计 = m（m>0 时 m+1，含页脚）', () => {
    const render = seamRenderer();
    for (const cell of CELLS) {
      const text = render(cell.projection);
      const m = countMarkers(cell.projection);
      expect(countOccurrences(text, '‡'), `cell=${cell.key} m=${m}`).toBe(m === 0 ? 0 : m + 1);
    }
  });

  // —— I7 回归（SA8 实现复查）：optional 包装截断标记在 own-line 宿主位须计数 ——

  it('G3.7a I7 回归：冻结 resolver 真实产物 ["opt"] d0（optional{marker}）→ 位标 + 页脚 + m+1', () => {
    const render = seamRenderer();
    const projection = readAt(budgetFixtureDerived(), BUDGET_OPTIONAL_TWIN_PATHS.optional, 0);
    const text = render(projection);
    expect(countMarkers(projection)).toBe(1);
    // optional 合成不被计数修复破坏：位标带 `?`（设计 §7.1.3 根位 inline `[...]‡?`）。
    expect(textLines(text)[0]).toBe('[...]‡?');
    // 计数不变量（设计 §7.4 点 2）：m=1 → 1 个位标 + 1 行页脚。
    expect(countOccurrences(text, '‡')).toBe(2);
    expect(textLines(text).filter((line) => line === FOOTER)).toHaveLength(1);
    expect(textLines(text)).toEqual(['[...]‡?', '', FOOTER]);
  });

  it('G3.7b I7 回归：optional{marker} 在四类 own-line 宿主位均计数、出页脚、语序为正文→页脚', () => {
    const render = seamRenderer();
    const cases: ReadonlyArray<{ readonly host: OptionalMarkerHost; readonly marker: string }> = [
      { host: 'root', marker: '[...]‡?' },
      { host: 'field', marker: 'cut?: [...]‡' },
      { host: 'member', marker: '| [...]‡?' },
      { host: 'alias', marker: 'type OptAlias = [...]‡?' },
    ];
    for (const { host, marker } of cases) {
      const projection = optionalWrappedProjection(host);
      const text = render(projection);
      expect(countMarkers(projection), `host=${host} 前置 m`).toBe(1);
      expect(text, `host=${host} 位标拼写`).toContain(marker);
      expect(countOccurrences(text, '‡'), `host=${host} ‡ 计数`).toBe(2);
      expect(textLines(text).filter((line) => line === FOOTER), `host=${host} 页脚行数`).toHaveLength(1);
      expect(text.indexOf(FOOTER), `host=${host} 页脚位置`).toBeGreaterThan(text.indexOf(marker));
    }
  });

  it('G3.7c I7 回归负控：optional 包装无标记孪生（m=0）→ 无 ‡、无页脚', () => {
    const render = seamRenderer();
    for (const host of ['root', 'field', 'member', 'alias'] as const) {
      const projection = optionalWrappedProjection(host, false);
      const text = render(projection);
      expect(countMarkers(projection), `host=${host} 前置 m`).toBe(0);
      expect(countOccurrences(text, '‡'), `host=${host} ‡ 计数`).toBe(0);
      expect(text.includes(FOOTER), `host=${host} 页脚`).toBe(false);
      // 无标记侧 `?` 合成不受影响（optional 语义仍在场）。
      expect(text, `host=${host} optional 合成`).toContain('?');
    }
  });

  it('G3.7d I7 回归负控：["opt"] d1 无标记 → 无 ‡、无页脚（计数不误报）', () => {
    const render = seamRenderer();
    const projection = readAt(budgetFixtureDerived(), BUDGET_OPTIONAL_TWIN_PATHS.optional, 1);
    const text = render(projection);
    expect(countMarkers(projection)).toBe(0);
    expect(countOccurrences(text, '‡')).toBe(0);
    expect(text.includes(FOOTER)).toBe(false);
  });
});

// —— G4 / CT-4 first-line 口径与 docs 敌意防御 ——

describe('#363 G4 CT-4 first-line 与 docs 敌意防御', () => {
  it('G4.1 多条目：只取首条 + …（第 2 条及以后不得出现）', () => {
    const render = seamRenderer();
    const text = render(multiEntryDocsProjection());
    expect(text).toContain('alpha: string // 首条目文本…');
    expect(text).not.toContain('第二条不应出现');
    expect(text).not.toContain('第三条不应出现');
  });

  it('G4.2 敌意文本不破坏结构：与良性孪生行数相同、结构前缀逐行相同', () => {
    const render = seamRenderer();
    const hostile = render(hostileDocsProjection());
    const benign = render(benignDocsProjection());
    expect(textLines(hostile)).toHaveLength(textLines(benign).length);
    expect(structureLines(hostile)).toEqual(structureLines(benign));
    expect(hostile).not.toBe(benign);
  });

  it('G4.3 敌意文本仅出现在注释段（注释段内无裸换行、结构行恰为文法形态）', () => {
    const render = seamRenderer();
    const text = render(hostileDocsProjection());
    expect(structureLines(text)).toEqual([
      '{',
      '  alpha: string',
      '  beta: {',
      '    gamma: number',
      '    delta: "x" | "y"',
      '  }',
      '}',
    ]);
    for (const line of textLines(text)) {
      const idx = line.indexOf(' // ');
      if (idx === -1) continue;
      expect(line.slice(idx + 4)).not.toContain('\r');
      expect(line.slice(idx + 4)).not.toContain('\n');
    }
  });

  it('G4.4 删除 1 个 docs 条目：该文本消失、其余结构行不变', () => {
    const render = seamRenderer();
    const full = render(hostileDocsProjection());
    const prunedDocs: Record<string, readonly string[]> = { ...HOSTILE_DOCS };
    delete prunedDocs['ROOT.beta.gamma'];
    const pruned = render({ ...(hostileDocsProjection() as object), docs: prunedDocs });
    expect(full).toContain('gamma line2 line3');
    expect(pruned).not.toContain('gamma line2 line3');
    expect(structureLines(pruned)).toEqual(structureLines(full));
    expect(textLines(pruned)).toHaveLength(textLines(full).length);
  });

  it('G4.5 增加 1 个无宿主 docs 条目（脊柱类）：输出结构行不变且文本不出现', () => {
    const render = seamRenderer();
    const full = render(hostileDocsProjection());
    const added = {
      ...(hostileDocsProjection() as object),
      docs: { ...HOSTILE_DOCS, 'ROOT.absent.deep.leaf': ['未渲染位置的注释'] },
    };
    const text = render(added);
    expect(structureLines(text)).toEqual(structureLines(full));
    expect(textLines(text)).toHaveLength(textLines(full).length);
    expect(text).not.toContain('未渲染位置的注释');
  });

  it('G4.6 docs/aliasDocs 清空：结构行逐行相同（仅注释消失）', () => {
    const render = seamRenderer();
    const full = render(hostileDocsProjection());
    const cleared = render(clearedDocsProjection());
    expect(structureLines(cleared)).toEqual(structureLines(full));
    expect(textLines(cleared)).toHaveLength(textLines(full).length);
    expect(cleared).not.toContain(' // ');
  });

  it('G4.7 未引用的别名照样渲染（呈现输入表，不自作闭包再收窄）', () => {
    const render = seamRenderer();
    const text = render(unreferencedAliasProjection());
    expect(text).toContain('type Extra = { // 额外别名口径');
    expect(text).toContain('inner: number');
  });

  it('G4.8 每个有宿主的 docs 条目文本出现在其位置所在行', () => {
    const render = seamRenderer();
    const text = render(benignDocsProjection());
    for (const [key, entries] of Object.entries(BENIGN_DOCS)) {
      const first = entries[0];
      if (first === undefined) throw new Error(`夹具 docs 条目为空：${key}`);
      if (key === 'ROOT.beta.leaf') {
        expect(text).not.toContain(first.trim());
        continue;
      }
      const line = textLines(text).find((l) => l.includes(first.trim()));
      expect(line, `docs 键 ${key} 未落在任何行`).toBeDefined();
      expect(line).toContain(' // ');
    }
  });
});

// —— G5 / CT-5 ✂ 截断事实段 ——

describe('#363 G5 CT-5 ✂ 截断事实段', () => {
  it('G5.1 缺席 / undefined / [] 三态逐字节相同且无 ✂', () => {
    const render = seamRenderer();
    const projection = cellInput('F1 []').projection;
    const absent = render(projection);
    const explicitUndefined = render(projection, undefined);
    const empty = render(projection, []);
    expect(absent).toBe(explicitUndefined);
    expect(absent).toBe(empty);
    expect(absent).not.toContain('✂');
  });

  it('G5.2 单条目：✂ 段为文末块（路径 / 裁因 / 省略计数）', () => {
    const render = seamRenderer();
    const text = render(cellInput('F1 []').projection, TRUNCATIONS_SINGLE);
    expect(text).toContain('✂ 截断事实：');
    expect(text).toContain('- tags · width · 省略 2 项');
    const lines = textLines(text);
    const headerAt = lines.indexOf('✂ 截断事实：');
    expect(headerAt).toBeGreaterThan(-1);
    for (const line of lines.slice(headerAt + 1)) expect(line.startsWith('- ')).toBe(true);
    expect(text.endsWith('\n')).toBe(true);
  });

  it('G5.3 多条目按输入序逐条渲染（含数字段与空路径拼写）', () => {
    const render = seamRenderer();
    const projection = cellInput('F1 []').projection;
    const multi = render(projection, TRUNCATIONS_MULTI);
    expect(multi.indexOf('- meta · depth · 省略 2 项')).toBeGreaterThan(-1);
    expect(multi.indexOf('- tags · width · 省略 3 项')).toBeGreaterThan(
      multi.indexOf('- meta · depth · 省略 2 项'),
    );
    const indexed = render(projection, TRUNCATIONS_INDEXED);
    expect(indexed).toContain('- items.0 · depth · 省略 1 项');
    const emptyPath = render(projection, TRUNCATIONS_EMPTY_PATH);
    expect(emptyPath).toContain('- [] · depth · 省略 5 项');
  });

  it('G5.4 敏感性：删条目 / 改 kind / 改 omitted 均改变输出', () => {
    const render = seamRenderer();
    const projection = cellInput('F1 []').projection;
    const multi = render(projection, TRUNCATIONS_MULTI);
    const single = render(projection, TRUNCATIONS_SINGLE);
    expect(multi).not.toBe(single);
    expect(single).not.toContain('- meta');
    expect(single).toContain('- tags · width · 省略 2 项');
    const changedKind = render(projection, [{ path: ['tags'], kind: 'depth', omitted: 2 }]);
    const changedOmitted = render(projection, [{ path: ['tags'], kind: 'width', omitted: 9 }]);
    expect(changedKind).not.toBe(single);
    expect(changedOmitted).not.toBe(single);
    expect(changedOmitted).toContain('省略 9 项');
  });

  it('G5.5 与 ‡ 共存：页脚在正文之后、✂ 段在页脚之后（文末块）', () => {
    const render = seamRenderer();
    const text = render(cellInput('F2 [] d1').projection, TRUNCATIONS_SINGLE);
    const footerAt = text.indexOf('‡ 截断标记：');
    const truncationAt = text.indexOf('✂ 截断事实：');
    expect(footerAt).toBeGreaterThan(-1);
    expect(truncationAt).toBeGreaterThan(footerAt);
  });

  it('G5.6 确定性：重复调用逐字节相同；乱序输入亦逐字节确定', () => {
    const render = seamRenderer();
    const projection = cellInput('F1 []').projection;
    expect(render(projection, TRUNCATIONS_MULTI)).toBe(render(projection, TRUNCATIONS_MULTI));
    expect(render(projection, TRUNCATIONS_SHUFFLED)).toBe(render(projection, TRUNCATIONS_SHUFFLED));
    expect(render(projection, TRUNCATIONS_SHUFFLED)).not.toBe(render(projection, TRUNCATIONS_MULTI));
  });
});

// —— G6 / CT-6 确定性与纯函数（辖域 = 无环金标输入）——

describe('#363 G6 CT-6 确定性与纯函数', () => {
  it('G6.1 同输入重复调用逐字节相同（无预算 / 预算 / 带 truncations）', () => {
    const render = seamRenderer();
    const plain = cellInput('F1 []').projection;
    const budgeted = cellInput('F2 [] d1').projection;
    expect(render(plain)).toBe(render(plain));
    expect(render(budgeted)).toBe(render(budgeted));
    expect(render(budgeted, TRUNCATIONS_SINGLE)).toBe(render(budgeted, TRUNCATIONS_SINGLE));
  });

  it('G6.2 与 resolver 无预算读交错：三次渲染逐字节相同', () => {
    const render = seamRenderer();
    const derived = budgetFixtureDerived();
    const projection = readAt(derived, []);
    const first = render(projection);
    readAt(derived, []);
    const second = render(projection);
    const other = render(readAt(derived, ['shallow']));
    const third = render(projection);
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(other).not.toBe(first);
  });

  it('G6.3 零变异：调用前后 JSON.stringify(projection / truncations) 逐字节不变', () => {
    const render = seamRenderer();
    const projection = cellInput('F2 [] d1').projection;
    const truncations = TRUNCATIONS_MULTI;
    const projectionBefore = JSON.stringify(projection);
    const truncationsBefore = JSON.stringify(truncations);
    render(projection, truncations);
    expect(JSON.stringify(projection)).toBe(projectionBefore);
    expect(JSON.stringify(truncations)).toBe(truncationsBefore);
  });
});

// —— G8 / CT-8 环投影终止与确定性（设计新增，强制；⑤观测 = §12.1 环安全审计）——

describe('#363 G8 CT-8 环投影终止与确定性', () => {
  const ringCells: ReadonlyArray<{
    readonly name: string;
    readonly build: () => DerivedSchema;
    readonly depth?: number;
  }> = [
    { name: 'optionalRing [] 无预算', build: optionalRingDerived },
    { name: 'optionalRing [] d1', build: optionalRingDerived, depth: 1 },
    { name: 'optionalRing [] d9', build: optionalRingDerived, depth: 9 },
    { name: 'unionRing [] 无预算', build: unionRingDerived },
    { name: 'unionRing [] d1', build: unionRingDerived, depth: 1 },
    { name: 'unionRing [] d9', build: unionRingDerived, depth: 9 },
    { name: 'containerRing [] 无预算', build: containerRingDerived },
    { name: 'containerRing [] d1', build: containerRingDerived, depth: 1 },
    { name: 'containerRing [] d9', build: containerRingDerived, depth: 9 },
  ];

  for (const cell of ringCells) {
    it(`G8 环格 ${cell.name}：终止 + 逐字节确定 + 零变异审计`, () => {
      const render = seamRenderer();
      const derived = cell.build();
      const projection = readAt(derived, [], cell.depth);
      const before = auditProjection(projection);
      const text = render(projection);
      const after = auditProjection(projection);
      expect(typeof text).toBe('string');
      // ② 同输入重复调用逐字节相同
      expect(render(projection)).toBe(text);
      // ③ 与 resolver 交错重渲逐字节相同
      readAt(cell.build(), [], cell.depth);
      expect(render(projection)).toBe(text);
      // ⑤ 零变异：节点身份保全 + 环安全摘要（禁 stringify）
      expect(after.nodes.length).toBe(before.nodes.length);
      for (let i = 0; i < before.nodes.length; i += 1) expect(after.nodes[i]).toBe(before.nodes[i]);
      expect(after.digest).toBe(before.digest);
      // ④ 环节点透传位含 …
      if (cell.depth === undefined || cell.depth === 9) {
        expect(text).toContain('…');
      }
      if (cell.name === 'optionalRing [] d1') {
        // O4 澄清：optional 透明不耗层，d1 环重入透传同样合法含 …
        expect(text).toContain('…');
      }
    });
  }
});

// —— G9 / CT-9 畸形输入 InternalError（设计新增，强制）——

describe('#363 G9 CT-9 畸形输入失败语义', () => {
  const samples: ReadonlyArray<{ readonly name: string; readonly run: (render: Renderer) => unknown }> = [
    { name: '①缺四键', run: (render) => render(MALFORMED_MISSING_KEYS) },
    {
      name: '②坏 kind 投影',
      run: (render) => render(MALFORMED_BAD_KIND),
    },
    {
      name: '③truncations 条目 kind 非两值',
      run: (render) => render(cellInput('F1 []').projection, MALFORMED_TRUNCATION_KIND as readonly RenderTruncationEntry[]),
    },
    { name: '④docs 值非 string 数组', run: (render) => render(MALFORMED_DOCS_VALUE) },
    { name: '⑤int 半参投影', run: (render) => render(MALFORMED_INT_HALF) },
    { name: '⑥节点非对象', run: (render) => render(MALFORMED_NODE) },
    { name: '⑦别名体坏 kind', run: (render) => render(MALFORMED_ALIAS_BODY) },
    {
      name: '⑧truncations 非数组',
      run: (render) => render(cellInput('F1 []').projection, MALFORMED_TRUNCATIONS_SHAPE as readonly RenderTruncationEntry[]),
    },
  ];

  for (const sample of samples) {
    it(`G9 畸形输入 ${sample.name}：loud InternalError（可归因、无部分输出）`, () => {
      const render = seamRenderer();
      let caught: unknown;
      try {
        sample.run(render);
      } catch (err) {
        caught = err;
      }
      expect(caught, `${sample.name} 未抛错（疑似静默降级）`).toBeDefined();
      expect(caught).toBeInstanceOf(InternalError);
      const error = caught as Error;
      expect(error.name).toBe('InternalError');
      expect(error.message.length).toBeGreaterThan(0);
    });
  }

  it('G9.1 可归因：坏 kind 消息含实际 kind 值；int 半参消息含 min/max 语境', () => {
    const render = seamRenderer();
    let badKind: Error | undefined;
    try {
      render(MALFORMED_BAD_KIND);
    } catch (err) {
      badKind = err as Error;
    }
    expect(badKind?.message).toContain('bogus');

    let intHalf: Error | undefined;
    try {
      render(MALFORMED_INT_HALF);
    } catch (err) {
      intHalf = err as Error;
    }
    expect(intHalf?.message).toMatch(/min|max|int/);
  });
});
