/**
 * issue #336（ADR-0024 T3）× issue #364（ADR-0027 决策 1/2/4）readData 形状预算 ——
 * **负控 / 回归锚**（恒绿；设计 §12-T2，#364 文本形态重锚）。
 *
 * 覆盖：
 * 1. 无 options 逐字节回归锚：`readData(path)` 的 value 与 doc-runtime 公共读取直调
 *    逐字段相等；`schema` 为**投影文本**，与 vfsl 公共 oracle（`compileSchemaEnvelope`
 *    → `resolveSchemaAtPath` → `renderProjectionText` + 头行）逐字节相等；
 * 2. 失败分支键集：PATH_NOT_ALLOWED / RUNTIME_READ_DISABLED 恰四键、不带 schema/
 *    truncated；lifecycle 停接纳优先；敌意 path 的 `schema:null` 收敛、ok 恒真、零 throw；
 * 3. **文本隔离**（#364 CT-7 G2 替代退役的 detach 深拷贝断言）：string 原始值无引用
 *    共享/冻结语义——同参连续/交错读逐字节相等；调用方改写 `r.value` 深对象后重读文本
 *    不受污染；每次都从活 derived 重新渲染（零缓存）。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { compileSchemaEnvelope, renderProjectionText, resolveSchemaAtPath } from '@nomicore/vfsl';
import type { DerivedSchema } from '@nomicore/vfsl';
import { readLogicalValueAtPath } from '@nomicore/doc-runtime';
import type { NamespaceRuntime } from '../src/index.js';
import { expectReadDataOkKeys } from './helpers/readdata-ok-shape.js';
import {
  ENV_336,
  makeBudgetRuntime,
  makeBudgetRuntimeWithDoc,
} from './runtime-readdata-shape-budget-fixture.js';

interface OkShape {
  readonly ok: true;
  readonly value: unknown;
  readonly schema: string | null;
  readonly truncated: boolean;
}

function ok(r: unknown, label: string): OkShape {
  if ((r as { ok?: unknown }).ok !== true) {
    throw new Error(`${label}：契约前提失败（期望 ok:true，实际 ${JSON.stringify(r)}）`);
  }
  return r as OkShape;
}

const FAILURE_KEYS = ['code', 'message', 'ok', 'path'] as const;

const compiled = compileSchemaEnvelope(ENV_336);
if (!compiled.ok) throw new Error(`oracle 前提失败：${JSON.stringify(compiled.issues)}`);
const DERIVED: DerivedSchema = compiled.derived;

/** 组合层头行（SA6 附录 A / 设计 §7-D2 冻结格式；无预算读省略预算段）。 */
function headLine(path: readonly (string | number)[]): string {
  const pathText = path.length === 0 ? '' : path.map((seg) => String(seg)).join('.');
  return `# readData [${pathText}]`;
}

/** 独立预言机（vfsl 公共 resolver + 公共渲染器；期望串绝不从 `r.schema` 反推）。 */
function oracleText(path: readonly (string | number)[]): string {
  const resolved = resolveSchemaAtPath(DERIVED, path);
  if (!resolved.ok) throw new Error(`oracle 前提失败：路径 ${JSON.stringify(path)} → ${resolved.code}`);
  return `${headLine(path)}\n\n${renderProjectionText(resolved)}`;
}

describe('无 options 逐字节回归锚：值与投影文本与 oracle 逐字节一致（ADR-0024 L29/L67；#364 文本形态）', () => {
  const PATHS: ReadonlyArray<readonly (string | number)[]> = [
    [],
    ['meta'],
    ['meta', 'content'],
    ['tags'],
    ['tags', 1],
    ['nick'],
    ['count'],
  ];

  it('readData(path) 的 value ≡ readLogicalValueAtPath(doc, path)；schema ≡ 头行 + renderProjectionText(独立编译 derived) 逐字节', async () => {
    const { runtime, doc } = await makeBudgetRuntimeWithDoc();
    for (const path of PATHS) {
      const r = ok(runtime.readData(path), `control/${JSON.stringify(path)}`);
      expectReadDataOkKeys(r);
      expect(r.truncated).toBe(false); // 无预算读结构上无截断
      expect(typeof r.schema).toBe('string');
      // 值通道 oracle = doc-runtime 公共直调（同一 doc）
      const t1 = readLogicalValueAtPath(doc, path);
      if (!t1.ok) throw new Error(`oracle 前提失败：${JSON.stringify(path)} 值读 ${t1.code}`);
      expect(r.value).toStrictEqual(t1.value);
      expect(JSON.stringify(r.value)).toBe(JSON.stringify(t1.value));
      // 投影通道 oracle = vfsl resolver + renderer 公共直调（逐字节，不用深等对象断言）
      expect(r.schema).toBe(oracleText(path));
    }
    await runtime.close();
  });
});

describe('失败分支键集与敌意 path 收敛（预算模式对偶采样；ADR-0024 L67）', () => {
  it('PATH_NOT_ALLOWED（非数组 path / 标量下钻）恰四键、不带 schema/truncated', async () => {
    const runtime = await makeBudgetRuntime();
    const notArray = runtime.readData('nope' as unknown as readonly (string | number)[]);
    expect(notArray.ok).toBe(false);
    expect((notArray as { code: string }).code).toBe('PATH_NOT_ALLOWED');
    expect(Object.keys(notArray).sort()).toStrictEqual([...FAILURE_KEYS]);
    const scalarDrill = runtime.readData(['count', 'x']);
    expect(scalarDrill.ok).toBe(false);
    expect(Object.keys(scalarDrill).sort()).toStrictEqual([...FAILURE_KEYS]);
    await runtime.close();
  });

  it('RUNTIME_READ_DISABLED（closing/closed）恰四键、不带 schema/truncated、零 doc 触碰', async () => {
    const runtime = await makeBudgetRuntime();
    await runtime.close();
    const r = runtime.readData(['meta']);
    expect(r.ok).toBe(false);
    expect((r as { code: string }).code).toBe('RUNTIME_READ_DISABLED');
    expect(Object.keys(r).sort()).toStrictEqual([...FAILURE_KEYS]);
  });

  it('敌意 path（重定义 Symbol.iterator 的真数组）+ 预算：值通道照常、schema:null 收敛、ok 恒真、零 throw、恰四键', async () => {
    const runtime = await makeBudgetRuntime();
    const hostilePath: Array<string | number> = ['count'];
    Object.defineProperty(hostilePath, Symbol.iterator, {
      value: () => {
        throw new Error('probe: hostile iterator');
      },
      configurable: true,
    });
    const r = ok(runtime.readData(hostilePath, { depth: 1 }), 'hostile-path');
    expectReadDataOkKeys(r);
    expect(r.value).toBe(3);
    expect(r.schema).toBeNull();
    await runtime.close();
  });
});

describe('文本隔离（#364 CT-7 G2；string 原始值——无 detach 对象可克隆/冻结/污染）', () => {
  it('连续/交错同参预算读：文本逐字节相等且为 string 原始值；调用方改写 r.value 后重读文本不受污染', async () => {
    const runtime: NamespaceRuntime = await makeBudgetRuntime();
    const pristine = ok(runtime.readData([], { depth: 1 }), 'detach-pristine');
    expect(pristine.schema).not.toBeNull();
    expect(typeof pristine.schema).toBe('string');
    const pristineText = pristine.schema!;

    // 交错读另一路径：不改变后续同参读的文本（零缓存且预期独立渲染）
    ok(runtime.readData(['tags'], { depth: 0 }), 'detach-interleaved');
    const second = ok(runtime.readData([], { depth: 1 }), 'detach-second');
    expect(second.schema).toBe(pristineText); // string 原始值：逐字节相等即隔离（无共享对象可污染）

    // 调用方改写 value 深对象（唯一可变面）后重读：文本仍旧逐字节相等
    (pristine.value as Record<string, unknown>)['tampered'] = true;
    const third = ok(runtime.readData([], { depth: 1 }), 'detach-third');
    expect(third.schema).toBe(pristineText);
    expect(third.schema).toContain('title: string');
    await runtime.close();
  });
});
