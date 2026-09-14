/**
 * issue #369（ADR 0028 W2）类型层红灯契约 —— lease/runtime 窗口读公共签名与别名锁
 * （SA6 §12.2 用例组 W2-Y1 / 设计 §8.1 类型面）。
 *
 * 契约（绑定 B-1/B-3/B-5）：
 * - `NamespaceRuntime.readArray/readMap` 与 `NamespaceLease.readArray/readMap` 签名
 *   `(path, options)`，**第二参必填**（ADR 0028 决策 1；`n` 必填 ≥1 由 W1 单权威校验）；
 * - options 类型为 doc-runtime 单源 type-only 别名（零复制）；
 * - lease 结果别名 = runtime 结果别名 | `NamespaceLeaseReleasedIssue`（Equal 锁）；
 * - 成功成员 `keyof` 恰 `'ok'|'value'|'schema'|'truncated'`；`schema: string | null`；
 * - 负例：缺 options、词表外排序项（readArray 传 field / by:'key'；readMap 传 by:'index'）。
 *
 * 红灯机理（HEAD `ab6e390`）：两接口无窗口成员、两包无窗口别名 —— 上方类型引用
 * TS2339/TS2305 报错；实现后本文件转绿。
 */
import { describe, it } from 'vitest';
import type { ArrayWindowEntry, MapWindowEntry, ReadArrayWindowOptions, ReadMapWindowOptions } from '@nomicore/doc-runtime';
import type {
  NamespaceLease,
  NamespaceLeaseReadArrayOptions,
  NamespaceLeaseReadArrayResult,
  NamespaceLeaseReadMapOptions,
  NamespaceLeaseReadMapResult,
  NamespaceLeaseReleasedIssue,
} from '@nomicore/namespace-registry';
import type {
  NamespaceRuntime,
  NamespaceRuntimeReadArrayOptions,
  NamespaceRuntimeReadArrayResult,
  NamespaceRuntimeReadMapOptions,
  NamespaceRuntimeReadMapResult,
} from '@nomicore/namespace-runtime';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type AssertTrue<T extends true> = T;

type ReadArrayOk = Extract<NamespaceRuntimeReadArrayResult, { ok: true }>;
type ReadMapOk = Extract<NamespaceRuntimeReadMapResult, { ok: true }>;
type LeaseReadArrayOk = Extract<NamespaceLeaseReadArrayResult, { ok: true }>;
type LeaseReadMapOk = Extract<NamespaceLeaseReadMapResult, { ok: true }>;

// —— options 单源（doc-runtime type-only 别名；决策 1/2）——
type _runtimeArrayOptionsSingleSource = AssertTrue<Equal<NamespaceRuntimeReadArrayOptions, ReadArrayWindowOptions>>;
type _runtimeMapOptionsSingleSource = AssertTrue<Equal<NamespaceRuntimeReadMapOptions, ReadMapWindowOptions>>;
type _leaseArrayOptionsSingleSource = AssertTrue<Equal<NamespaceLeaseReadArrayOptions, NamespaceRuntimeReadArrayOptions>>;
type _leaseMapOptionsSingleSource = AssertTrue<Equal<NamespaceLeaseReadMapOptions, NamespaceRuntimeReadMapOptions>>;

// —— 成功成员恒四键（决策 7；包装不进口径）——
type _runtimeArraySuccessKeys = AssertTrue<Equal<keyof ReadArrayOk, 'ok' | 'value' | 'schema' | 'truncated'>>;
type _runtimeMapSuccessKeys = AssertTrue<Equal<keyof ReadMapOk, 'ok' | 'value' | 'schema' | 'truncated'>>;
type _leaseArraySuccessKeys = AssertTrue<Equal<keyof LeaseReadArrayOk, 'ok' | 'value' | 'schema' | 'truncated'>>;
type _leaseMapSuccessKeys = AssertTrue<Equal<keyof LeaseReadMapOk, 'ok' | 'value' | 'schema' | 'truncated'>>;
type _runtimeArrayValue = AssertTrue<Equal<ReadArrayOk['value'], ArrayWindowEntry[]>>;
type _runtimeMapValue = AssertTrue<Equal<ReadMapOk['value'], MapWindowEntry[]>>;
type _runtimeArraySchema = AssertTrue<Equal<ReadArrayOk['schema'], string | null>>;
type _runtimeMapSchema = AssertTrue<Equal<ReadMapOk['schema'], string | null>>;
type _runtimeArrayTruncated = AssertTrue<Equal<ReadArrayOk['truncated'], boolean>>;

// —— 别名跟随（Equal 锁；镜像 `_readAlias` 先例）——
type _leaseArrayAlias = AssertTrue<
  Equal<NamespaceLeaseReadArrayResult, NamespaceRuntimeReadArrayResult | NamespaceLeaseReleasedIssue>
>;
type _leaseMapAlias = AssertTrue<
  Equal<NamespaceLeaseReadMapResult, NamespaceRuntimeReadMapResult | NamespaceLeaseReleasedIssue>
>;

// —— 签名形状（第二参必填、无重载）——
type _runtimeArraySignature = AssertTrue<
  Equal<NamespaceRuntime['readArray'], (path: readonly (string | number)[], options: NamespaceRuntimeReadArrayOptions) => NamespaceRuntimeReadArrayResult>
>;
type _leaseMapSignature = AssertTrue<
  Equal<NamespaceLease['readMap'], (path: readonly (string | number)[], options: NamespaceRuntimeReadMapOptions) => NamespaceLeaseReadMapResult>
>;
type _runtimeArrayArity = AssertTrue<
  Equal<Parameters<NamespaceRuntime['readArray']>, [readonly (string | number)[], NamespaceRuntimeReadArrayOptions]>
>;
type _leaseArrayArity = AssertTrue<
  Equal<Parameters<NamespaceLease['readArray']>, [readonly (string | number)[], NamespaceLeaseReadArrayOptions]>
>;

export type WindowReadSurfaceAssertions = {
  readonly runtimeArrayOptionsSingleSource: _runtimeArrayOptionsSingleSource;
  readonly runtimeMapOptionsSingleSource: _runtimeMapOptionsSingleSource;
  readonly leaseArrayOptionsSingleSource: _leaseArrayOptionsSingleSource;
  readonly leaseMapOptionsSingleSource: _leaseMapOptionsSingleSource;
  readonly runtimeArraySuccessKeys: _runtimeArraySuccessKeys;
  readonly runtimeMapSuccessKeys: _runtimeMapSuccessKeys;
  readonly leaseArraySuccessKeys: _leaseArraySuccessKeys;
  readonly leaseMapSuccessKeys: _leaseMapSuccessKeys;
  readonly runtimeArrayValue: _runtimeArrayValue;
  readonly runtimeMapValue: _runtimeMapValue;
  readonly runtimeArraySchema: _runtimeArraySchema;
  readonly runtimeMapSchema: _runtimeMapSchema;
  readonly runtimeArrayTruncated: _runtimeArrayTruncated;
  readonly leaseArrayAlias: _leaseArrayAlias;
  readonly leaseMapAlias: _leaseMapAlias;
  readonly runtimeArraySignature: _runtimeArraySignature;
  readonly leaseMapSignature: _leaseMapSignature;
  readonly runtimeArrayArity: _runtimeArrayArity;
  readonly leaseArrayArity: _leaseArrayArity;
};

declare const runtime: NamespaceRuntime;
declare const lease: NamespaceLease;

describe('NamespaceRuntime / NamespaceLease 暴露窗口读公共面（ADR 0028 决策 1/9）', () => {
  it('正例：两族 options 全轴可传；条目列表身份随行；成功恒四键可窄化', () => {
    const array: NamespaceRuntimeReadArrayResult = runtime.readArray(['workRecords'], {
      n: 2,
      orderBy: { by: 'index', dir: 'desc' },
      depth: 1,
      maxChildrenPerNode: 3,
    });
    void array;
    const map: NamespaceLeaseReadMapResult = lease.readMap(['tasks'], {
      n: 2,
      orderBy: { field: 'priority', dir: 'desc' },
    });
    void map;

    const viaLease: NamespaceLeaseReadArrayResult = lease.readArray(['workRecords'], { n: 1 });
    if (!viaLease.ok) throw new Error('前提失败：窗口读应成功');
    const first: ArrayWindowEntry | undefined = viaLease.value[0];
    const index: number | undefined = first?.index;
    const schema: string | null = viaLease.schema;
    const truncated: boolean = viaLease.truncated;
    void index;
    void schema;
    void truncated;

    const mapOk: NamespaceRuntimeReadMapOptions = { n: 1, orderBy: { by: 'key' } };
    const readMap = runtime.readMap(['tasks'], mapOk);
    if (!readMap.ok) throw new Error('前提失败：窗口读应成功');
    const key: string | undefined = readMap.value[0]?.key;
    void key;
  });

  it('负例 fail closed：缺第二参、词表外排序项、跨面排序项', () => {
    // @ts-expect-error 第二参必填（ADR 0028 决策 1：n 必填且无重载）
    runtime.readArray(['workRecords']);
    // @ts-expect-error 第二参必填
    lease.readMap(['tasks']);
    // @ts-expect-error readArray 不收 field（决策 2 v1 词表）
    runtime.readArray(['workRecords'], { n: 1, orderBy: { field: 'x' } });
    // @ts-expect-error readArray 不收 by:'key'
    lease.readArray(['workRecords'], { n: 1, orderBy: { by: 'key' } });
    // @ts-expect-error readMap 不收 by:'index'
    runtime.readMap(['tasks'], { n: 1, orderBy: { by: 'index' } });
  });
});
