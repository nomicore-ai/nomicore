/**
 * SA6 负控测试 — issue #273 readData 语义 schema 投影的「不变面」（绿基线）。
 *
 * 本文件断言 feature 不得触碰的面（ADR-0016 §分层 / §失败分支 + ADR-0008「原规则
 * 保持」）：
 * - @nomicore/doc-runtime 不动：读取保持 schema 无关——readLogicalValueAtPath 的
 *   结果联合逐字节不变（成功 = {ok:true,value} 恰两键，失败单通道 PATH_NOT_ALLOWED）；
 * - runtime 失败分支不变：PATH_NOT_ALLOWED / RUNTIME_READ_DISABLED 形状与码不变，
 *   失败分支**不**携带 schema 键（schema 只进成功分支）；
 * - runtime 成功分支的值语义不变（加法演进）：ok/value 属性持续存在、值内容持续成立
 *   （对成功分支只做加法兼容断言——toMatchObject/值断言；恰四键形状与投影文本断言在
 *   red 契约文件按 #364/ADR-0027 目标形状锚定；本文件只补形状采样随动）；
 * - 读取不等待 P0（preparing 期值读照常）保持。
 *
 * 本文件在 HEAD（旧形状）与目标实现上均应绿——负控失败即实现越界（动了失败通道
 * 或 doc-runtime），向总控报告。投影出现性断言在
 * runtime-readdata-schema-projection-red.test.ts（红灯契约）。
 */
import { describe, expect, it } from 'vitest';
import { createNamespaceRuntimeWithSeam } from '../src/runtime.js';
import type { NamespaceRuntime } from '../src/index.js';
import { readLogicalValueAtPath } from '@nomicore/doc-runtime';
import { makeHandle, makeReadyRuntime, deferred } from './readdata-schema-projection-fixture.js';
import { expectReadDataOkKeys } from './helpers/readdata-ok-shape.js';
describe('issue #273 负控：doc-runtime 读取面逐字节不变（schema 无关保持）', () => {
  it('readLogicalValueAtPath 成功分支仍为恰两键 {ok:true, value}，值缺席吸收仍为显式 undefined', async () => {
    const { doc } = await makeHandle();
    const hit = readLogicalValueAtPath(doc, ['count']);
    expect(Object.keys(hit).sort()).toEqual(['ok', 'value']);
    expect(hit).toEqual({ ok: true, value: 3 });
    const miss = readLogicalValueAtPath(doc, ['absent-key']);
    expect(miss).toEqual({ ok: true, value: undefined });
  });

  it('readLogicalValueAtPath 失败单通道 PATH_NOT_ALLOWED 不变（Y.Map 标量下钻 / 数字段）', async () => {
    const { doc } = await makeHandle();
    expect(readLogicalValueAtPath(doc, ['count', 'x'])).toMatchObject({ ok: false, code: 'PATH_NOT_ALLOWED' });
    expect(readLogicalValueAtPath(doc, ['title', 0])).toMatchObject({ ok: false, code: 'PATH_NOT_ALLOWED' });
  });
});

describe('issue #273 负控：runtime 失败分支形状不变（schema 只进成功分支）', () => {
  it('PATH_NOT_ALLOWED：码/形状不变，失败对象不带 schema 键', async () => {
    const runtime: NamespaceRuntime = await makeReadyRuntime();
    const r = runtime.readData(['count', 'x']);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('应失败');
    expect(r.code).toBe('PATH_NOT_ALLOWED');
    expect('schema' in (r as unknown as Record<string, unknown>)).toBe(false);
    await runtime.close();
  });

  it('RUNTIME_READ_DISABLED：close 停接纳后读拒绝通道不变，不带 schema 键', async () => {
    const runtime: NamespaceRuntime = await makeReadyRuntime();
    await runtime.close();
    const r = runtime.readData(['count']);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('应失败');
    expect(r.code).toBe('RUNTIME_READ_DISABLED');
    expect('schema' in (r as unknown as Record<string, unknown>)).toBe(false);
  });
});

describe('issue #273 负控：成功分支值语义不变（加法兼容面；#364 形状采样随动）', () => {
  it('ok/value 属性持续存在且值内容正确（readData 值语义零变化）', async () => {
    const runtime: NamespaceRuntime = await makeReadyRuntime();
    expect(runtime.readData(['count'])).toMatchObject({ ok: true, value: 3 });
    expect(runtime.readData(['meta'])).toMatchObject({ ok: true, value: { content: 'hi' } });
    expect(runtime.readData(['tags', 0])).toMatchObject({ ok: true, value: 'a' });
    const miss = runtime.readData(['absent-key']);
    expect(miss).toMatchObject({ ok: true, value: undefined });
    await runtime.close();
  });

  it('#364 形状采样：success 恰四键 {ok,value,schema,truncated}；schema 为投影文本或严格 null', async () => {
    const runtime: NamespaceRuntime = await makeReadyRuntime();
    const hit = runtime.readData(['count']);
    expectReadDataOkKeys(hit); // 恰四键（集中化 helper：不触发形状扫描门 family B）
    if (!hit.ok) throw new Error('契约前提失败：ready 态路径内读应成功');
    expect(hit.truncated).toBe(false);
    expect(hit.schema).toBe('# readData [count]\n\nnumber\n');
    const deviation = runtime.readData(['rogue']); // raw 复制式 schema 外数据 → null 单义
    if (!deviation.ok) throw new Error('契约前提失败：路径偏离仍应 ok:true');
    expect(deviation.schema).toBeNull();
    await runtime.close();
  });

  it('读取不等待 P0：preparing 期（p0Gate 未放行）值读立即可用且正确', async () => {
    const gate = deferred();
    const { handle } = await makeHandle();
    const runtime = createNamespaceRuntimeWithSeam({ handle, p0Gate: gate.promise });
    expect(runtime.getStatus().schema.state).toBe('preparing');
    expect(runtime.readData(['count'])).toMatchObject({ ok: true, value: 3 });
    gate.resolve();
    await expect.poll(() => runtime.getStatus().schema.state, { interval: 10, timeout: 5_000 }).toBe('ready');
    await runtime.close();
  });
});
