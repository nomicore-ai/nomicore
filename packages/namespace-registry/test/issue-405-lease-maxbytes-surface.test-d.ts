/**
 * issue #405（ADR 0031）registry `NamespaceLease.readData` 类型面 —— options 三键跟随 +
 * 预算失败分支别名跟随（SA6 §12.2/§12.3 G9 类型侧）。
 *
 * 锚定机制（vitest --typecheck）：
 * - 别名组合锁**延续**：`NamespaceLeaseReadDataBudgetResult = NamespaceRuntimeReadDataBudgetResult
 *   | NamespaceLeaseReleasedIssue`（lease 层零第二形状——只改 runtime 不改别名即编译红）；
 * - **options 跟随锁**：lease 预算重载第二参接受 `NamespaceRuntimeReadDataOptions`（含
 *   `maxBytes`）——runtime 单源类型经参数位结构性跟随；
 * - 新失败分支别名跟随：`Extract<lease 别名, { code:'READ_BUDGET_EXCEEDED' }>` ≡ runtime
 *   成员（恰五键 + `measuredBytes: number`）；
 * - legacy 别名零泄漏 + 末签名锁延续（`ReturnType` 取 legacy）。
 */
import { describe, it } from 'vitest';
import type {
  NamespaceLease,
  NamespaceLeaseReadDataBudgetResult,
  NamespaceLeaseReadDataResult,
  NamespaceLeaseReleasedIssue,
} from '@nomicore/namespace-registry';
import type {
  NamespaceRuntimeReadDataBudgetResult,
  NamespaceRuntimeReadDataOptions,
} from '@nomicore/namespace-runtime';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type AssertTrue<T extends true> = T;

// —— 别名组合锁延续（runtime 联合追加成员自动跟随）——
type _budgetAlias = AssertTrue<
  Equal<NamespaceLeaseReadDataBudgetResult, NamespaceRuntimeReadDataBudgetResult | NamespaceLeaseReleasedIssue>
>;
type _budgetHasReleased = AssertTrue<
  Equal<Extract<NamespaceLeaseReadDataBudgetResult, { code: 'NAMESPACE_LEASE_RELEASED' }>, NamespaceLeaseReleasedIssue>
>;

// —— 新失败分支别名跟随（恰五键 + measuredBytes: number）——
type LeaseBudgetExceeded = Extract<NamespaceLeaseReadDataBudgetResult, { code: 'READ_BUDGET_EXCEEDED' }>;
type _exceededFollow = AssertTrue<
  Equal<LeaseBudgetExceeded, Extract<NamespaceRuntimeReadDataBudgetResult, { code: 'READ_BUDGET_EXCEEDED' }>>
>;
type _exceededShape = AssertTrue<
  Equal<
    LeaseBudgetExceeded,
    {
      readonly ok: false;
      readonly code: 'READ_BUDGET_EXCEEDED';
      readonly path: readonly (string | number)[];
      readonly measuredBytes: number;
      readonly message: string;
    }
  >
>;
type _exceededKeys = AssertTrue<
  Equal<keyof LeaseBudgetExceeded, 'ok' | 'code' | 'path' | 'measuredBytes' | 'message'>
>;
type _exceededNoSuccessKeys = AssertTrue<Equal<Extract<LeaseBudgetExceeded, { value: unknown }>, never>>;
type _exceededNoSchemaKey = AssertTrue<Equal<Extract<LeaseBudgetExceeded, { schema: unknown }>, never>>;
type _exceededNoTruncatedKey = AssertTrue<Equal<Extract<LeaseBudgetExceeded, { truncated: unknown }>, never>>;

// —— legacy 别名零泄漏（预算码/载荷在无 options 面结构不可达）——
type _legacyNoBudgetCode = AssertTrue<
  Equal<Extract<NamespaceLeaseReadDataResult, { code: 'READ_BUDGET_EXCEEDED' }>, never>
>;
type _legacyNoMeasuredBytes = AssertTrue<
  Equal<Extract<NamespaceLeaseReadDataResult, { measuredBytes: unknown }>, never>
>;

// —— 末签名锁延续：legacy 恒最后（`_readAlias`/`_readOverloadOrder` 锚前提）——
type _legacyReturnType = AssertTrue<
  Equal<ReturnType<NamespaceLease['readData']>, NamespaceLeaseReadDataResult>
>;

// 声明期证明（仅 typecheck 用，零运行时值）。
export type Issue405LeaseMaxBytesAssertions = {
  readonly budgetAlias: _budgetAlias;
  readonly budgetHasReleased: _budgetHasReleased;
  readonly exceededFollow: _exceededFollow;
  readonly exceededShape: _exceededShape;
  readonly exceededKeys: _exceededKeys;
  readonly exceededNoSuccessKeys: _exceededNoSuccessKeys;
  readonly exceededNoSchemaKey: _exceededNoSchemaKey;
  readonly exceededNoTruncatedKey: _exceededNoTruncatedKey;
  readonly legacyNoBudgetCode: _legacyNoBudgetCode;
  readonly legacyNoMeasuredBytes: _legacyNoMeasuredBytes;
  readonly legacyReturnType: _legacyReturnType;
};

declare const lease: NamespaceLease;

describe('类型面：lease.readData 预算重载三键 options 跟随 + READ_BUDGET_EXCEEDED 别名跟随', () => {
  it('options 跟随：runtime 单源 options（含 maxBytes）可直传 lease 预算重载；第四键/错误值型编译红', () => {
    const runtimeOptions: NamespaceRuntimeReadDataOptions = { maxBytes: 1 };
    const viaRuntimeOptions: NamespaceLeaseReadDataBudgetResult = lease.readData([], runtimeOptions);
    const inline: NamespaceLeaseReadDataBudgetResult = lease.readData([], {
      depth: 1,
      maxChildrenPerNode: 2,
      maxBytes: 1024,
    });
    void viaRuntimeOptions;
    void inline;
    // @ts-expect-error 闭合形状：未知第四键（excess property）编译红
    lease.readData([], { depth: 1, nope: 1 });
    // @ts-expect-error maxBytes 值域静态面 = number（string 编译红）
    lease.readData([], { maxBytes: '100' });
  });

  it('载荷可达：EXCEEDED 分支 measuredBytes/message/path 可消费；成功键不可达', () => {
    const r = lease.readData([], { maxBytes: 1 });
    if (!r.ok && r.code === 'READ_BUDGET_EXCEEDED') {
      const measured: number = r.measuredBytes;
      const message: string = r.message;
      const path: readonly (string | number)[] = r.path;
      void measured;
      void message;
      void path;
      // @ts-expect-error 超限零交付：无 value 成功键
      void r.value;
      // @ts-expect-error 超限零交付：无 schema 成功键
      void r.schema;
    } else {
      throw new Error('前提失败：lease 预算重载结果联合应含 READ_BUDGET_EXCEEDED 成员');
    }
  });

  it('EOPT：显式 maxBytes: undefined 对 TS 字面量调用者编译红（D1 仅运行时/JS 面）', () => {
    // @ts-expect-error exactOptionalPropertyTypes：undefined 不可赋给 maxBytes?: number
    lease.readData([], { maxBytes: undefined });
  });
});
