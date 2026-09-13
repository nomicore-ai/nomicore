import { describe, it } from 'vitest';
import type {
  NamespaceLease,
  NamespaceLeaseMutateDataResult,
  NamespaceLeaseReadArrayResult,
  NamespaceLeaseReadDataResult,
  NamespaceLeaseReadMapResult,
  NamespaceLeaseSchema,
} from '@nomicore/namespace-registry';

// @ts-expect-error removed ROOT-oriented lease result
import type { NamespaceLeaseMutateRootResult } from '@nomicore/namespace-registry';
// @ts-expect-error removed ambiguous read result
import type { NamespaceLeaseReadResult } from '@nomicore/namespace-registry';
// @ts-expect-error removed envelope-oriented schema projection name
import type { NamespaceLeaseSchemaEnvelope } from '@nomicore/namespace-registry';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type AssertTrue<T extends true> = T;

type LeaseReadDataOk = Extract<NamespaceLeaseReadDataResult, { ok: true }>;

/** #364（ADR-0027 决策 1/4）：成功成员恒四键、schema 为投影文本（string | null）、
 *  truncated 为布尔机器信号——赋给 runtime 结果别名的可赋值样例保持。 */
type _readOkFourKeys = AssertTrue<
  Equal<keyof LeaseReadDataOk, 'ok' | 'value' | 'schema' | 'truncated'>
>;
type _readOkSchema = AssertTrue<Equal<LeaseReadDataOk['schema'], string | null>>;
type _readOkTruncated = AssertTrue<Equal<LeaseReadDataOk['truncated'], boolean>>;
type _readOkNoTruncationsKey = AssertTrue<
  Equal<Extract<NamespaceLeaseReadDataResult, { truncations: unknown }>, never>
>;

export type LeaseDataInterfaceAssertions = {
  readonly readOkFourKeys: _readOkFourKeys;
  readonly readOkSchema: _readOkSchema;
  readonly readOkTruncated: _readOkTruncated;
  readonly readOkNoTruncationsKey: _readOkNoTruncationsKey;
};

declare const lease: NamespaceLease;

describe('NamespaceLease exposes Data, Schema, and Metadata concepts', () => {
  it('uses readData/mutateData/getSchema and removes obsolete methods', () => {
    const read: NamespaceLeaseReadDataResult = lease.readData(['items', 'a', 'quantity']);
    const write: Promise<NamespaceLeaseMutateDataResult> = lease.mutateData({
      op: 'set',
      path: ['items', 'a', 'quantity'],
      value: 2,
    });
    const schema: NamespaceLeaseSchema = lease.getSchema();
    const metadata = lease.getMetadata();
    void read;
    void write;
    void schema;
    void metadata;

    // @ts-expect-error old ambiguous read interface removed
    lease.read(['items']);
    // @ts-expect-error ROOT carrier terminology removed from public lease
    lease.mutateRoot({ op: 'set', path: ['items'], value: {} });
    // @ts-expect-error envelope projection terminology removed from public lease
    lease.getSchemaEnvelope();
  });

  it('#369（ADR 0028 W2）：readArray/readMap 为公共窗口读成员（lease 别名跟随 runtime、第二参必填）', () => {
    const array: NamespaceLeaseReadArrayResult = lease.readArray(['items'], { n: 1 });
    const map: NamespaceLeaseReadMapResult = lease.readMap(['items'], { n: 1, orderBy: { field: 'priority' } });
    void array;
    void map;

    // @ts-expect-error 第二参必填（ADR 0028 决策 1）
    lease.readArray(['items']);
    // @ts-expect-error readMap 不收 by:'index'
    lease.readMap(['items'], { n: 1, orderBy: { by: 'index' } });
  });

  it('readData 成功面为四键投影文本：truncations 键与 schema.valueSchema 均 fail closed（#364）', () => {
    const read = lease.readData(['items', 'a', 'quantity']);
    if (read.ok) {
      // @ts-expect-error 结构化 truncations 键已退役（截断事实唯一载体 = 投影文本 ✂ 段）
      void read.truncations;
      // @ts-expect-error schema 为投影文本 string | null——非 JSON 四件套对象
      void read.schema.valueSchema;
      // @ts-expect-error schema 无非空字符串之外的第三态：别名锚精确 string | null
      const third: undefined = read.schema;
      void third;
    }
  });
});
