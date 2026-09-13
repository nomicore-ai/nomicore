/**
 * issue #364（ADR-0027 决策 1/2/4）负控/回归锚 —— readData 投影文本化切换**不得**触碰的
 * 冻结面（SA6 §6 三层负控 + 附录 C：`runtime-readdata-projection-text-control.test.ts`）。
 *
 * 三层负控（旧实现与目标实现下都必须绿）：
 * 1. **值通道零变化**（doc-runtime 边界）：`readLogicalValueAtPath` 成功分支仍恰两键
 *    `{ok,value}`；预算值读的折叠/省略语义不变（值通道结果仍携 `truncated`/`truncations`
 *    两键——载体不动）；缺席吸收纪律不变（值缺席显式 undefined、键恒在场）；runtime 的
 *    `value` 位逐字节透传值通道。
 * 2. **失败分支与生命周期不变**：`PATH_NOT_ALLOWED` / `READ_OPTIONS_INVALID` /
 *    `RUNTIME_READ_DISABLED` 键集与语义不变；released lease 短路（registry 面见
 *    `registry-readdata-projection-text-red.test.ts` B′）；`getSchema` / `getMetadata` /
 *    `getActiveSchema` 与读写能力面不受本票影响。
 * 3. **渲染器（T1）冻结**：`packages/vfsl/test/render-projection-text.test.ts` 144 tests
 *    是独立冻结基线（本文件不重复断言渲染器内部文法，只以公共 API oracle 对照）。
 */
import { describe, expect, it } from 'vitest';
import { readLogicalValueAtPath } from '@nomicore/doc-runtime';
import type { ReadLogicalValueAtPathOptions } from '@nomicore/doc-runtime';
import { makeBudgetRuntimeWithDoc, makeBudgetRuntime } from './runtime-readdata-shape-budget-fixture.js';
import { expectReadDataOkKeys } from './helpers/readdata-ok-shape.js';

const asOptions = (value: unknown): ReadLogicalValueAtPathOptions =>
  value as ReadLogicalValueAtPathOptions;

const FAILURE_KEYS = ['code', 'message', 'ok', 'path'] as const;

function expectFailureKeys(r: object, label: string): void {
  expect(Object.keys(r).sort(), `${label}：失败分支键集不变`).toStrictEqual([...FAILURE_KEYS]);
}

describe('负控层 1：值通道（doc-runtime）零变化——成功恰两键、截断两形态、缺席吸收', () => {
  it('无预算值读成功分支仍恰 {ok,value}（后端不因投影文本化换形）', async () => {
    const { doc } = await makeBudgetRuntimeWithDoc();
    const hit = readLogicalValueAtPath(doc, ['meta', 'content']);
    expect(Object.keys(hit).sort()).toStrictEqual(['ok', 'value']);
    if (!hit.ok) throw new Error('装置前提失败：值通道必须成功');
    expect(hit.value).toBe('hi');
    expect('schema' in hit).toBe(false);
    expect('truncations' in hit).toBe(false);
  });

  it('预算值读仍携 truncated/truncations 两键（值通道载体不动；depth 折叠壳 + 条目）', async () => {
    const { doc } = await makeBudgetRuntimeWithDoc();
    const hit = readLogicalValueAtPath(doc, [], { depth: 1 });
    expect(Object.keys(hit).sort()).toStrictEqual(['ok', 'truncated', 'truncations', 'value']);
    if (!hit.ok) throw new Error('装置前提失败：值通道预算读必须成功');
    expect(hit.truncated).toBe(true);
    expect(hit.value).toStrictEqual({ title: 'hello', count: 3, meta: {}, tags: [] });
    expect([...hit.truncations].sort((a, b) => String(a.path[0]).localeCompare(String(b.path[0])))).toStrictEqual([
      { path: ['meta'], kind: 'depth', omitted: 2 },
      { path: ['tags'], kind: 'depth', omitted: 5 },
    ]);
  });

  it('width 超限仍为键省略（不出空壳/undefined 键）；E1 吸收纪律不变', async () => {
    const { doc } = await makeBudgetRuntimeWithDoc();
    const hit = readLogicalValueAtPath(doc, ['tags'], { maxChildrenPerNode: 3 });
    if (!hit.ok) throw new Error('装置前提失败：值通道 width 读必须成功');
    expect(hit.value).toStrictEqual(['a', 'b', 'c']);
    expect(hit.truncations).toStrictEqual([{ path: ['tags'], kind: 'width', omitted: 2 }]);
  });

  it('缺席吸收纪律不变：值缺席为显式 undefined、value 键恒在场', async () => {
    const { doc } = await makeBudgetRuntimeWithDoc();
    const absent = readLogicalValueAtPath(doc, ['nick']);
    expect(Object.keys(absent).sort()).toStrictEqual(['ok', 'value']);
    if (!absent.ok) throw new Error('装置前提失败：值缺席是合法读');
    expect(absent.value).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(absent, 'value')).toBe(true);
  });

  it('runtime.value 位逐字节透传值通道（无包装/无改写）', async () => {
    const { runtime, doc } = await makeBudgetRuntimeWithDoc();
    const direct = readLogicalValueAtPath(doc, ['meta']);
    const viaRuntime = runtime.readData(['meta']);
    if (!direct.ok || !viaRuntime.ok) throw new Error('装置前提失败：两通道必须成功');
    expect(viaRuntime.value).toStrictEqual(direct.value);
    const directBudget = readLogicalValueAtPath(doc, [], { depth: 1 });
    const viaRuntimeBudget = runtime.readData([], { depth: 1 });
    if (!directBudget.ok || !viaRuntimeBudget.ok) throw new Error('装置前提失败：两通道预算读必须成功');
    expect(viaRuntimeBudget.value).toStrictEqual(directBudget.value);
    await runtime.close();
  });
});

describe('负控层 2：失败分支、生命周期与能力面不受本票影响', () => {
  it('失败三分支键集/码不变；成功分支不得携带 code', async () => {
    const runtime = await makeBudgetRuntime();
    const pathFailure = runtime.readData('nope' as unknown as readonly (string | number)[]);
    if (pathFailure.ok) throw new Error('负控前提失败：非法 path 必须失败');
    expect(pathFailure.code).toBe('PATH_NOT_ALLOWED');
    expectFailureKeys(pathFailure, 'PATH_NOT_ALLOWED');
    const optionsFailure = runtime.readData(['meta'], asOptions({ depth: -1 }));
    if (optionsFailure.ok) throw new Error('负控前提失败：非法 options 必须失败');
    expect(optionsFailure.code).toBe('READ_OPTIONS_INVALID');
    expectFailureKeys(optionsFailure, 'READ_OPTIONS_INVALID');
    const success = runtime.readData(['meta']);
    expectReadDataOkKeys(success);
    expect((success as { code?: unknown }).code).toBeUndefined();
    expect((success as { truncations?: unknown }).truncations).toBeUndefined();
    await runtime.close();
  });

  it('lifecycle≠ready：read 失败面稳定，数据投影 getter 仍拒绝、getStatus 仍可观测', async () => {
    const runtime = await makeBudgetRuntime();
    const before = runtime.getSchema();
    expect(before).not.toBeNull();
    expect(typeof runtime.getMetadata()).toBe('object');
    expect(runtime.getActiveSchema()).not.toBeNull();
    await runtime.close();
    const disabled = runtime.readData(['meta']);
    if (disabled.ok) throw new Error('负控前提失败：closed 期读必须拒绝');
    expect(disabled.code).toBe('RUNTIME_READ_DISABLED');
    expectFailureKeys(disabled, 'RUNTIME_READ_DISABLED');
    expect(() => runtime.getSchema()).toThrowError();
    expect(() => runtime.getMetadata()).toThrowError();
    expect(() => runtime.getActiveSchema()).toThrowError();
    expect(runtime.getStatus().lifecycle).toBe('closed');
  });

  it('敌意 path / 敌意 options 零 throw（读保留；失败与收敛面不变）', async () => {
    const runtime = await makeBudgetRuntime();
    const hostilePath = ['absent-key', Symbol('rogue')] as unknown as readonly (string | number)[];
    expect(() => runtime.readData(hostilePath)).not.toThrow();
    expect(() => runtime.readData(['meta'], asOptions({ get depth() { return 1; } }))).not.toThrow();
    expect(() => runtime.readData(['meta'], asOptions(new Proxy({ depth: 1 }, {})))).not.toThrow();
    await runtime.close();
  });
});

describe('负控层 3：与 T1 冻结渲染器的一致性（组合层零漂移）', () => {
  it('runtime 文本 ≠ 渲染器裸输出（头行是本票组合层职责，T1 不产出头行）', async () => {
    const runtime = await makeBudgetRuntime();
    const r = runtime.readData([]);
    if (!r.ok || r.schema === null) throw new Error('负控前提失败：[] 读必须返回文本');
    expect(r.schema.startsWith('# readData [')).toBe(true);
    // T1 冻结面：渲染器自身输出不得含头行（G1.3 反断言）——组合层负责前贴。
    expect(r.schema.split('\n\n')[0]).toBe('# readData []');
    await runtime.close();
  });
});
