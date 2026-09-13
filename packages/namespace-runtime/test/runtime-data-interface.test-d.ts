import { describe, it } from 'vitest';
import type {
  DataMutationIssue,
  MutateDataResult,
  NamespaceRuntime,
  NamespaceRuntimeReadArrayResult,
  NamespaceRuntimeReadDataResult,
  NamespaceRuntimeReadMapResult,
} from '@nomicore/namespace-runtime';

// Breaking public interface: ROOT carrier terminology does not cross the Runtime seam.
// @ts-expect-error removed public type
import type { RootMutationIssue } from '@nomicore/namespace-runtime';
// @ts-expect-error removed public type
import type { MutateRootResult } from '@nomicore/namespace-runtime';

declare const runtime: NamespaceRuntime;

describe('NamespaceRuntime exposes Data, Schema, and Metadata concepts', () => {
  it('uses readData/mutateData/getSchema and removes ROOT-oriented names', () => {
    const read: NamespaceRuntimeReadDataResult = runtime.readData(['items', 'a', 'quantity']);
    const write: Promise<MutateDataResult> = runtime.mutateData({
      op: 'set',
      path: ['items', 'a', 'quantity'],
      value: 2,
    });
    const schema = runtime.getSchema();
    const metadata = runtime.getMetadata();
    void read;
    void write;
    void schema;
    void metadata;

    // @ts-expect-error old ambiguous read interface removed
    runtime.read(['items']);
    // @ts-expect-error ROOT is an implementation carrier, not the public data interface
    runtime.mutateRoot({ op: 'set', path: ['items'], value: {} });
    // @ts-expect-error envelope is an implementation projection term
    runtime.getSchemaEnvelope();
  });

  it('exports Data-named mutation issue and result types', () => {
    const issue = null as unknown as DataMutationIssue;
    const result = null as unknown as MutateDataResult;
    void issue;
    void result;
  });

  it('#369（ADR 0028 W2）：readArray/readMap 为公共窗口读成员（第二参必填、面词表 fail closed）', () => {
    const array: NamespaceRuntimeReadArrayResult = runtime.readArray(['items'], { n: 1 });
    const map: NamespaceRuntimeReadMapResult = runtime.readMap(['items'], { n: 1, orderBy: { by: 'key' } });
    void array;
    void map;

    // @ts-expect-error 第二参必填（ADR 0028 决策 1：n 必填且无重载）
    runtime.readArray(['items']);
    // @ts-expect-error readArray 不收 field（决策 2 v1 词表）
    runtime.readArray(['items'], { n: 1, orderBy: { field: 'x' } });
    // @ts-expect-error readMap 不收 by:'index'
    runtime.readMap(['items'], { n: 1, orderBy: { by: 'index' } });
  });

  it('#364：readData 成功分支为恰四键的投影文本形态（truncations/valueSchema 编译失败）', () => {
    const read = runtime.readData(['items', 'a', 'quantity']);
    if (!read.ok) throw new Error('前提失败：readData 应成功');
    // @ts-expect-error truncations 键退役（截断事实唯一载体 = 投影文本 ✂ 段）
    void read.truncations;
    if (read.schema === null) throw new Error('前提失败：投影文本应非 null');
    // @ts-expect-error schema 为投影文本 string——不再有 valueSchema 成员
    void read.schema.valueSchema;

    const budgeted = runtime.readData(['items'], { depth: 1 });
    if (!budgeted.ok) throw new Error('前提失败：预算 readData 应成功');
    // @ts-expect-error 预算成功成员与 legacy 同型：truncations 同样退役
    void budgeted.truncations;
    if (budgeted.schema === null) throw new Error('前提失败：预算投影文本应非 null');
    // @ts-expect-error 预算成功成员 schema 同为 string——无 valueSchema 成员
    void budgeted.schema.valueSchema;
  });
});
