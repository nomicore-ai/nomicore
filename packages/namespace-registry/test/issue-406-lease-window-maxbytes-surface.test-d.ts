/**
 * issue #406（ADR 0031 窗口面同轴）registry `NamespaceLease.readArray` / `readMap` 类型面
 * —— options 六键跟随 + 预算失败分支别名跟随（SA6 §12.2/§12.3 G9 类型侧）。
 *
 * 锚定机制（vitest --typecheck）：
 * - **别名组合锁延续**：`NamespaceLeaseReadArrayResult = NamespaceRuntimeReadArrayResult |
 *   NamespaceLeaseReleasedIssue`（lease 层零第二形状——只改 runtime 不改别名即编译红）；
 * - **options 跟随锁**：lease 窗口 options = `NamespaceRuntimeReadArrayOptions`（含 `maxBytes`）；
 * - 新失败分支别名跟随：`Extract<lease 别名, { code:'READ_BUDGET_EXCEEDED' }>` ≡ runtime
 *   成员（恰五键 + `measuredBytes: number`）且 ≡ lease.readData 预算成员（三面同载荷形）；
 * - 成功面恒四键（决策 7）；unknown 第七键 / string `maxBytes` 编译红。
 */
import { describe, it } from 'vitest';
import type {
  NamespaceLease,
  NamespaceLeaseReadArrayOptions,
  NamespaceLeaseReadArrayResult,
  NamespaceLeaseReadDataBudgetResult,
  NamespaceLeaseReadMapOptions,
  NamespaceLeaseReadMapResult,
  NamespaceLeaseReleasedIssue,
} from '@nomicore/namespace-registry';
import type {
  NamespaceRuntime,
  NamespaceRuntimeReadArrayOptions,
  NamespaceRuntimeReadArrayResult,
  NamespaceRuntimeReadDataBudgetResult,
  NamespaceRuntimeReadMapOptions,
  NamespaceRuntimeReadMapResult,
} from '@nomicore/namespace-runtime';
import type { ReadArrayWindowOptions, ReadMapWindowOptions } from '@nomicore/doc-runtime';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type AssertTrue<T extends true> = T;

// —— 别名组合锁延续（runtime 联合追加成员自动跟随）——
type _arrayAlias = AssertTrue<
  Equal<NamespaceLeaseReadArrayResult, NamespaceRuntimeReadArrayResult | NamespaceLeaseReleasedIssue>
>;
type _mapAlias = AssertTrue<
  Equal<NamespaceLeaseReadMapResult, NamespaceRuntimeReadMapResult | NamespaceLeaseReleasedIssue>
>;
type _arrayHasReleased = AssertTrue<
  Equal<Extract<NamespaceLeaseReadArrayResult, { code: 'NAMESPACE_LEASE_RELEASED' }>, NamespaceLeaseReleasedIssue>
>;

// —— options 跟随锁（lease 单源别名；六键含 maxBytes）——
type _arrayOptionsFollow = AssertTrue<Equal<NamespaceLeaseReadArrayOptions, NamespaceRuntimeReadArrayOptions>>;
type _mapOptionsFollow = AssertTrue<Equal<NamespaceLeaseReadMapOptions, NamespaceRuntimeReadMapOptions>>;
type _arrayOptionsKeys = AssertTrue<
  Equal<keyof NamespaceLeaseReadArrayOptions, 'n' | 'orderBy' | 'depth' | 'maxChildrenPerNode' | 'where' | 'maxBytes'>
>;

// —— 新失败分支别名跟随（恰五键 + measuredBytes: number；三面同载荷形）——
type LeaseArrayExceeded = Extract<NamespaceLeaseReadArrayResult, { code: 'READ_BUDGET_EXCEEDED' }>;
type LeaseMapExceeded = Extract<NamespaceLeaseReadMapResult, { code: 'READ_BUDGET_EXCEEDED' }>;
type RuntimeArrayExceeded = Extract<NamespaceRuntimeReadArrayResult, { code: 'READ_BUDGET_EXCEEDED' }>;
type LeaseDataExceeded = Extract<NamespaceLeaseReadDataBudgetResult, { code: 'READ_BUDGET_EXCEEDED' }>;
type RuntimeDataExceeded = Extract<NamespaceRuntimeReadDataBudgetResult, { code: 'READ_BUDGET_EXCEEDED' }>;

type _arrayExceededFollow = AssertTrue<Equal<LeaseArrayExceeded, RuntimeArrayExceeded>>;
type _mapExceededFollow = AssertTrue<Equal<LeaseMapExceeded, RuntimeArrayExceeded>>;
type _arrayExceededShape = AssertTrue<
  Equal<
    LeaseArrayExceeded,
    {
      readonly ok: false;
      readonly code: 'READ_BUDGET_EXCEEDED';
      readonly path: readonly (string | number)[];
      readonly measuredBytes: number;
      readonly message: string;
    }
  >
>;
type _exceededKeys = AssertTrue<Equal<keyof LeaseArrayExceeded, 'ok' | 'code' | 'path' | 'measuredBytes' | 'message'>>;
type _exceededNoSuccessKeys = AssertTrue<Equal<Extract<LeaseArrayExceeded, { value: unknown }>, never>>;
type _exceededNoTruncatedKey = AssertTrue<Equal<Extract<LeaseArrayExceeded, { truncated: unknown }>, never>>;

// —— 成功面恒四键（决策 7；包装不进口径）——
type _leaseArrayOkKeys = AssertTrue<
  Equal<keyof Extract<NamespaceLeaseReadArrayResult, { ok: true }>, 'ok' | 'value' | 'schema' | 'truncated'>
>;
type _leaseMapOkKeys = AssertTrue<
  Equal<keyof Extract<NamespaceLeaseReadMapResult, { ok: true }>, 'ok' | 'value' | 'schema' | 'truncated'>
>;
type _runtimeLeaseShapeParity = AssertTrue<
  Equal<
    keyof Extract<NamespaceLeaseReadArrayResult, { ok: true }>,
    keyof Extract<NamespaceRuntimeReadArrayResult, { ok: true }>
  >
>;
type _threeFaceParity = AssertTrue<Equal<LeaseArrayExceeded, LeaseDataExceeded>>;
type _leaseRuntimeDataParity = AssertTrue<Equal<LeaseDataExceeded, RuntimeDataExceeded>>;

// —— 方法签名（第二参恒 lease options；返回 lease 联合）——
type _arraySignature = AssertTrue<
  Equal<
    NamespaceLease['readArray'],
    (path: readonly (string | number)[], options: NamespaceLeaseReadArrayOptions) => NamespaceLeaseReadArrayResult
  >
>;
type _mapSignature = AssertTrue<
  Equal<
    NamespaceLease['readMap'],
    (path: readonly (string | number)[], options: NamespaceLeaseReadMapOptions) => NamespaceLeaseReadMapResult
  >
>;

// —— doc-runtime 零改动硬锁（ADR 0031 §4；lease/runtime 面均不得倒灌）——
type _docRuntimeArrayFiveKeys = AssertTrue<
  Equal<keyof ReadArrayWindowOptions, 'n' | 'orderBy' | 'depth' | 'maxChildrenPerNode' | 'where'>
>;
type _docRuntimeMapFiveKeys = AssertTrue<
  Equal<keyof ReadMapWindowOptions, 'n' | 'orderBy' | 'depth' | 'maxChildrenPerNode' | 'where'>
>;

// 声明期证明（仅 typecheck 用，零运行时值）。
export type Issue406LeaseWindowMaxBytesAssertions = {
  readonly arrayAlias: _arrayAlias;
  readonly mapAlias: _mapAlias;
  readonly arrayHasReleased: _arrayHasReleased;
  readonly arrayOptionsFollow: _arrayOptionsFollow;
  readonly mapOptionsFollow: _mapOptionsFollow;
  readonly arrayOptionsKeys: _arrayOptionsKeys;
  readonly arrayExceededFollow: _arrayExceededFollow;
  readonly mapExceededFollow: _mapExceededFollow;
  readonly arrayExceededShape: _arrayExceededShape;
  readonly exceededKeys: _exceededKeys;
  readonly exceededNoSuccessKeys: _exceededNoSuccessKeys;
  readonly exceededNoTruncatedKey: _exceededNoTruncatedKey;
  readonly leaseArrayOkKeys: _leaseArrayOkKeys;
  readonly leaseMapOkKeys: _leaseMapOkKeys;
  readonly runtimeLeaseShapeParity: _runtimeLeaseShapeParity;
  readonly threeFaceParity: _threeFaceParity;
  readonly leaseRuntimeDataParity: _leaseRuntimeDataParity;
  readonly arraySignature: _arraySignature;
  readonly mapSignature: _mapSignature;
  readonly docRuntimeArrayFiveKeys: _docRuntimeArrayFiveKeys;
  readonly docRuntimeMapFiveKeys: _docRuntimeMapFiveKeys;
};

declare const lease: NamespaceLease;
declare const runtime: NamespaceRuntime;

describe('类型面：lease 窗口 options 六键跟随 + 预算失败分支别名跟随', () => {
  it('lease 窗口读接受 maxBytes；未知第七键与错误值型编译红；measuredBytes 载荷可达', () => {
    const arrayBudgeted = lease.readArray(['items'], { n: 3, maxBytes: 1024 });
    const mapBudgeted = lease.readMap(['itemMap'], { n: 2, where: [{ field: 'state', equals: 'claimed' }], maxBytes: 1024 });
    void arrayBudgeted;
    void mapBudgeted;
    const direct: NamespaceRuntimeReadArrayResult = runtime.readArray(['items'], { n: 3, maxBytes: 1024 });
    void direct;
    // @ts-expect-error 闭合形状：lease 窗口 options 未知第七键（excess property）编译红
    lease.readArray(['items'], { n: 1, nope: 1 });
    // @ts-expect-error maxBytes 值域静态面 = number（string 编译红）
    lease.readArray(['items'], { n: 1, maxBytes: '100' });
    // @ts-expect-error n 必填（窗口 options 无缺省）
    lease.readMap(['itemMap'], { maxBytes: 1024 });
    const exceeded: NamespaceLeaseReadArrayResult = lease.readArray(['items'], { n: 3, maxBytes: 1 });
    if (!exceeded.ok && exceeded.code === 'READ_BUDGET_EXCEEDED') {
      const measured: number = exceeded.measuredBytes;
      void measured;
      // @ts-expect-error 超限零交付：失败分支不得携带成功键 value
      void exceeded.value;
    } else {
      throw new Error('前提失败：{n:3,maxBytes:1} 的 lease 结果联合应含 READ_BUDGET_EXCEEDED 成员');
    }
  });

  it('released 短路面仍在联合内（窄化后码可选且零成功键泄漏）', () => {
    const released: NamespaceLeaseReadArrayResult = lease.readArray(['items'], { n: 1 });
    if (!released.ok && released.code === 'NAMESPACE_LEASE_RELEASED') {
      const message: typeof released.message = released.message;
      void message;
      // @ts-expect-error released issue 冻结三键：无 measuredBytes
      void released.measuredBytes;
    }
  });
});
