/**
 * issue #405（ADR 0031）readData 交付总量收/拒闸 —— 回归 / 负控契约（SA6 §12.2 控制组）。
 *
 * 组：G7 无 options / 空预算 / 两键回归（**锚表 R0–R12 逐锚复验**）、G8 成功面恒四键 +
 * ✂/头行零漂移（无预算侧；带 `maxBytes` 侧在红灯契约）、G11 作用域负控（窗口面 /
 * doc-runtime 面携 `maxBytes` 各走其码）。
 *
 * 判定纪律：本文件在 HEAD **即绿**且实现后必须保持绿（SA6 §12.4 G7/G11；G8 无预算侧）。
 * 断言只观察公共接缝（方法结果联合、own 键集、字节、渲染文本），期望值全部取自
 * 冻结锚 / 独立 oracle——绝不从被测 `measuredBytes` 反推（反伪绿 §12.5 R1/R10）。
 */
import { describe, expect, it } from 'vitest';
import { readLogicalValueAtPath } from '@nomicore/doc-runtime';
import type { ReadLogicalValueAtPathOptions } from '@nomicore/doc-runtime';
import type {
  NamespaceRuntimeReadArrayOptions,
  NamespaceRuntimeReadDataOptions,
  NamespaceRuntimeReadMapOptions,
} from '../src/index.js';
import { expectReadDataOkKeys } from './helpers/readdata-ok-shape.js';
import {
  ENV_405,
  TXT_405,
  anchorById,
  makeRuntime405,
  makeRuntime405WithDoc,
  utf8,
} from './issue-405-maxbytes-fixture.js';

// ───────────────────────── 前提断言（ok:false → loud throw，绝不假绿） ─────────────────────────

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

function ok(r: unknown, label: string): BudgetOkShape {
  if ((r as { ok?: unknown }).ok !== true) {
    throw new Error(`${label}：契约前提失败（期望 ok:true，实际 ${JSON.stringify(r)}）`);
  }
  return r as BudgetOkShape;
}

function failure(r: unknown, label: string): FailureShape {
  if ((r as { ok?: unknown }).ok !== false) {
    throw new Error(`${label}：契约前提失败（期望 ok:false，实际 ${JSON.stringify(r)}）`);
  }
  return r as FailureShape;
}

/** 非封闭形状（`maxBytes` 在 HEAD 类型面尚不存在）——单点 cast 进入运行时校验面。 */
const asOptions = (value: unknown): NamespaceRuntimeReadDataOptions =>
  value as NamespaceRuntimeReadDataOptions;
const asArrayOptions = (value: unknown): NamespaceRuntimeReadArrayOptions =>
  value as NamespaceRuntimeReadArrayOptions;
const asMapOptions = (value: unknown): NamespaceRuntimeReadMapOptions =>
  value as NamespaceRuntimeReadMapOptions;
const asDocRuntimeOptions = (value: unknown): ReadLogicalValueAtPathOptions =>
  value as ReadLogicalValueAtPathOptions;

const FAILURE_KEYS = ['code', 'message', 'ok', 'path'] as const;

/** 头行块（首个空行之前）。 */
function headBlock(schema: string): string {
  const idx = schema.indexOf('\n\n');
  return idx === -1 ? schema : schema.slice(0, idx);
}

// ═════════════════════════════ G7：无 options / 空预算 / 两键回归（AC⑦） ═════════════════════════════

describe('G7 回归锚：冻结锚表 R0–R12 逐锚复验（无 options / 空预算 / 两键选项逐字节现行为）', () => {
  it('G7 严格档 R0–R8/R11/R12：恒四键 + 两通道字节 = 锚 + total = 锚 + truncated = 锚 + 头行不含 maxBytes', async () => {
    const runtime = await makeRuntime405();
    for (const anchor of [
      anchorById('R0'),
      anchorById('R1'),
      anchorById('R2'),
      anchorById('R3'),
      anchorById('R4'),
      anchorById('R5'),
      anchorById('R6'),
      anchorById('R7'),
      anchorById('R8'),
      anchorById('R11'),
      anchorById('R12'),
    ]) {
      const label = `G7/${anchor.id}`;
      const r = ok(
        anchor.budget === undefined
          ? runtime.readData(anchor.path)
          : runtime.readData(anchor.path, anchor.budget),
        label,
      );
      expectReadDataOkKeys(r);
      const valueBytes = r.value === undefined ? 0 : utf8(JSON.stringify(r.value));
      const schemaBytes = r.schema === null ? 0 : utf8(r.schema);
      expect(valueBytes, `${label}：值通道字节`).toBe(anchor.valueBytes);
      expect(schemaBytes, `${label}：schema 通道字节`).toBe(anchor.schemaBytes);
      expect(valueBytes + schemaBytes, `${label}：交付总量`).toBe(anchor.total);
      expect(r.truncated, `${label}：truncated 锚`).toBe(anchor.truncated);
      expect(r.schema === null, `${label}：schema:null 单义 ⇔ 锚 0 字节`).toBe(anchor.schemaBytes === 0);
      if (r.schema !== null) {
        expect(r.schema.includes('maxBytes'), `${label}：头行不记 maxBytes（ADR 0031 决策 4）`).toBe(false);
      }
    }
    await runtime.close();
  });

  it('G7 raw 档 R9/R10：schema:null 值侧单通道 / raw 全量逐字节 = 锚', async () => {
    const runtime = await makeRuntime405({ raw: true });
    for (const anchor of [anchorById('R9'), anchorById('R10')]) {
      const label = `G7/${anchor.id}`;
      const r = ok(runtime.readData(anchor.path), label);
      expectReadDataOkKeys(r);
      const valueBytes = r.value === undefined ? 0 : utf8(JSON.stringify(r.value));
      const schemaBytes = r.schema === null ? 0 : utf8(r.schema);
      expect(valueBytes, `${label}：值通道字节`).toBe(anchor.valueBytes);
      expect(schemaBytes, `${label}：schema 通道字节`).toBe(anchor.schemaBytes);
      expect(valueBytes + schemaBytes, `${label}：交付总量`).toBe(anchor.total);
    }
    await runtime.close();
  });

  it('G7 头行文法锚：path + 预算段（depth/width 两轴）逐字节冻结；✂ 段字面在场', async () => {
    const runtime = await makeRuntime405();
    const cases: ReadonlyArray<{ id: string; head: string }> = [
      { id: 'R0', head: '# readData []' },
      { id: 'R1', head: '# readData [] {depth:1}' },
      { id: 'R2', head: '# readData [] {depth:0}' },
      { id: 'R3', head: '# readData [] {maxChildrenPerNode:2}' },
      { id: 'R4', head: '# readData [title]' },
      { id: 'R7', head: '# readData [nick]' },
      { id: 'R11', head: '# readData [] {depth:1,maxChildrenPerNode:2}' },
      { id: 'R12', head: '# readData []' },
    ];
    for (const c of cases) {
      const anchor = anchorById(c.id);
      const r = ok(
        anchor.budget === undefined
          ? runtime.readData(anchor.path)
          : runtime.readData(anchor.path, anchor.budget),
        `G7-head/${c.id}`,
      );
      if (r.schema === null) throw new Error(`G7-head/${c.id}：契约前提失败（期望文本非 null）`);
      expect(headBlock(r.schema), `G7-head/${c.id}`).toBe(c.head);
      expect(r.schema.includes('✂ 截断事实：'), `G7-head/${c.id}：✂ 段在场 ⇔ 锚 truncated`).toBe(anchor.truncated);
    }
    await runtime.close();
  });

  it('G7 缺席目标（R7）与零总量（R8）：值通道 0、投影文本照常在场 / schema:null 单义', async () => {
    const runtime = await makeRuntime405();
    const nick = ok(runtime.readData(['nick']), 'G7/R7');
    expect(nick.value).toBeUndefined();
    expect(nick.schema).not.toBeNull();
    expect(nick.truncated).toBe(false);
    const rogue = ok(runtime.readData(['rogue']), 'G7/R8');
    expect(rogue.value).toBeUndefined();
    expect(rogue.schema).toBeNull();
    await runtime.close();
  });
});

// ═════════════════════════════ G8：成功面恒四键 + ✂/头行零漂移（无预算侧） ═════════════════════════════

describe('G8 形状/文法零漂移（ADR 0027 决策 1/3 零变化清单）', () => {
  it('G8 无 options / 两键成功面恰四键；✂ 段头行字面与 facts 行文法不漂移', async () => {
    const runtime = await makeRuntime405();
    const plain = ok(runtime.readData([]), 'G8/plain');
    expectReadDataOkKeys(plain);
    const depth1 = ok(runtime.readData([], { depth: 1 }), 'G8/depth1');
    expectReadDataOkKeys(depth1);
    if (depth1.schema === null) throw new Error('G8/depth1：契约前提失败（期望文本非 null）');
    // ✂ 段文法（facts 行 `- <path> · <kind> · 省略 N 项`）与段头字面冻结。
    expect(depth1.schema).toContain('✂ 截断事实：');
    expect(depth1.schema).toContain('- meta · depth · 省略 2 项');
    expect(depth1.schema).toContain('- tags · depth · 省略 5 项');
    // 渲染器正文（✂ 段之前）与无预算读同源：无预算读不含 ✂ 段。
    expect(plain.schema).not.toBeNull();
    expect(plain.schema!.includes('✂ 截断事实：')).toBe(false);
    await runtime.close();
  });
});

// ═════════════════════════════ G11：作用域负控（tracer 边界） ═════════════════════════════

describe('G11 范围守卫：窗口面 / doc-runtime 面携 maxBytes 各走其码（D6 本票不动）', () => {
  it('G11 窗口面：readArray/readMap 携 maxBytes → WINDOW_OPTIONS_INVALID（恰四键）；无预算窗口读现状不变', async () => {
    const runtime = await makeRuntime405();
    const arrBad = failure(runtime.readArray(['tags'], asArrayOptions({ n: 1, maxBytes: 1 })), 'G11/readArray');
    expect(arrBad.code).toBe('WINDOW_OPTIONS_INVALID');
    expect(Object.keys(arrBad).sort()).toStrictEqual([...FAILURE_KEYS]);
    const mapBad = failure(runtime.readMap(['meta'], asMapOptions({ n: 1, maxBytes: 1 })), 'G11/readMap');
    expect(mapBad.code).toBe('WINDOW_OPTIONS_INVALID');
    expect(Object.keys(mapBad).sort()).toStrictEqual([...FAILURE_KEYS]);
    // 无预算窗口读：现状零回归（恒四键 + 条目列表）。
    const arrOk = ok(runtime.readArray(['tags'], { n: 2 }), 'G11/readArray-ok');
    expectReadDataOkKeys(arrOk);
    expect(arrOk.truncated).toBe(true);
    const mapOk = ok(runtime.readMap(['meta'], { n: 1 }), 'G11/readMap-ok');
    expectReadDataOkKeys(mapOk);
    await runtime.close();
  });

  it('G11 doc-runtime 直调：readLogicalValueAtPath(doc, path, {maxBytes:1}) → READ_OPTIONS_INVALID（零改动、下传两键锚）', async () => {
    const { runtime, doc } = await makeRuntime405WithDoc();
    const r = failure(
      readLogicalValueAtPath(doc, ['title'], asDocRuntimeOptions({ maxBytes: 1 })),
      'G11/doc-runtime',
    );
    expect(r.code).toBe('READ_OPTIONS_INVALID');
    expect(Object.keys(r).sort()).toStrictEqual([...FAILURE_KEYS]);
    // 两键面健康：同 doc 合法两键读成功（doc-runtime 校验器冻结面）。
    const good = readLogicalValueAtPath(doc, ['title'], { depth: 1 });
    expect(good.ok).toBe(true);
    await runtime.close();
  });

  it('G11 装置前提：冻结 schema 文本经 runtime 单源编译（ENV/TXT 一致性 fail loud）', async () => {
    const runtime = await makeRuntime405();
    const active = runtime.getActiveSchema();
    if (active === null) throw new Error('G11 前提失败：active schema 应为非 null（ready 期）');
    const root = ok(runtime.readData([]), 'G11/root');
    if (root.schema === null) throw new Error('G11 前提失败：ROOT 投影文本应非 null');
    // 夹具与锚同变更集纪律：投影文本在场（锚 schemaBytes 的渲染来源）且段值不与种子混淆。
    expect(root.schema.length > 0).toBe(true);
    expect(ENV_405.text).toBe(TXT_405);
    await runtime.close();
  });
});
