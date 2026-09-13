/**
 * issue #364（ADR-0027 决策 1/2/4）registry lease 类型面锚 —— SA6 CT-8 H4 镜像
 * （`registry-readdata-projection-text-red.test.ts` 的行为面锚的类型面对偶）。
 *
 * 锚定机制（vitest --typecheck / `tsc -p tsconfig.typecheck.json`）：
 * - `NamespaceLeaseReadDataResult` 成功成员**恰四键** `{ ok, value, schema, truncated }`，
 *   `schema` 精确 `string | null`（投影文本；无 undefined 第三态）、`truncated: boolean`；
 * - 预算别名组合锁 `NamespaceLeaseReadDataBudgetResult = NamespaceRuntimeReadDataBudgetResult
 *   | NamespaceLeaseReleasedIssue` 与 legacy 组合锁保持（lease 层零预算解释、零第二形状）；
 * - 重载序锁：legacy 恒最后（`ReturnType<NamespaceLease['readData']>` 取末签名）；
 * - 零泄漏锁：结构化 `truncations` 键退役后不属任何成功成员（`Extract<…, {truncations:
 *   unknown}> === never`，legacy 与预算双联合同锁），`r.truncations` 直读编译失败；
 * - released issue 形状零变化（`{ok:false,code:'NAMESPACE_LEASE_RELEASED',message}` 恰三键，
 *   ADR-0027 决策 1「失败分支形状与语义不动」）。
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
  NamespaceRuntimeReadDataResult,
} from '@nomicore/namespace-runtime';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type AssertTrue<T extends true> = T;

type LeaseLegacyOk = Extract<NamespaceLeaseReadDataResult, { ok: true }>;
type LeaseBudgetOk = Extract<NamespaceLeaseReadDataBudgetResult, { ok: true }>;

// —— 成功成员恒四键 + 键型精确（H1/H2 镜像）——
type _legacyFourKeys = AssertTrue<
  Equal<keyof LeaseLegacyOk, 'ok' | 'value' | 'schema' | 'truncated'>
>;
type _budgetFourKeys = AssertTrue<
  Equal<keyof LeaseBudgetOk, 'ok' | 'value' | 'schema' | 'truncated'>
>;
type _legacyOkLiteral = AssertTrue<Equal<LeaseLegacyOk['ok'], true>>;
type _legacySchema = AssertTrue<Equal<LeaseLegacyOk['schema'], string | null>>;
type _legacyTruncated = AssertTrue<Equal<LeaseLegacyOk['truncated'], boolean>>;
type _budgetSchema = AssertTrue<Equal<LeaseBudgetOk['schema'], string | null>>;
type _budgetTruncated = AssertTrue<Equal<LeaseBudgetOk['truncated'], boolean>>;
// 两联合成功成员同型（单一四键形坍缩；联合名与失败面各自保留——CT-8 解释）。
type _sameOkShape = AssertTrue<Equal<LeaseLegacyOk, LeaseBudgetOk>>;

// —— 零泄漏锁：truncations 键不属于任何成功成员（H3 镜像）——
type _legacyNoTruncationsKey = AssertTrue<
  Equal<Extract<NamespaceLeaseReadDataResult, { truncations: unknown }>, never>
>;
type _budgetNoTruncationsKey = AssertTrue<
  Equal<Extract<NamespaceLeaseReadDataBudgetResult, { truncations: unknown }>, never>
>;

// —— 别名组合锁（H4）——
type _legacyAliasComposition = AssertTrue<
  Equal<NamespaceLeaseReadDataResult, NamespaceRuntimeReadDataResult | NamespaceLeaseReleasedIssue>
>;
type _budgetAliasComposition = AssertTrue<
  Equal<NamespaceLeaseReadDataBudgetResult, NamespaceRuntimeReadDataBudgetResult | NamespaceLeaseReleasedIssue>
>;
type _legacyHasReleased = AssertTrue<
  Equal<Extract<NamespaceLeaseReadDataResult, { code: 'NAMESPACE_LEASE_RELEASED' }>, NamespaceLeaseReleasedIssue>
>;
type _budgetHasReleased = AssertTrue<
  Equal<Extract<NamespaceLeaseReadDataBudgetResult, { code: 'NAMESPACE_LEASE_RELEASED' }>, NamespaceLeaseReleasedIssue>
>;

// —— 重载序锁：legacy 恒最后（ReturnType 取末签名）——
type _overloadOrderLegacyLast = AssertTrue<
  Equal<ReturnType<NamespaceLease['readData']>, NamespaceLeaseReadDataResult>
>;

// —— released issue 形状零变化（恰三键；失败分支不含成功键）——
type _releasedIssueCode = AssertTrue<Equal<NamespaceLeaseReleasedIssue['code'], 'NAMESPACE_LEASE_RELEASED'>>;
type _releasedIssueOk = AssertTrue<Equal<NamespaceLeaseReleasedIssue['ok'], false>>;
type _releasedIssueThreeKeys = AssertTrue<
  Equal<keyof NamespaceLeaseReleasedIssue, 'ok' | 'code' | 'message'>
>;
type _releasedNoSuccessKeys = AssertTrue<
  Equal<Extract<NamespaceLeaseReleasedIssue, { schema: unknown }>, never>
>;

export type LeaseReadDataProjectionTextAssertions = {
  readonly legacyFourKeys: _legacyFourKeys;
  readonly budgetFourKeys: _budgetFourKeys;
  readonly legacyOkLiteral: _legacyOkLiteral;
  readonly legacySchema: _legacySchema;
  readonly legacyTruncated: _legacyTruncated;
  readonly budgetSchema: _budgetSchema;
  readonly budgetTruncated: _budgetTruncated;
  readonly sameOkShape: _sameOkShape;
  readonly legacyNoTruncationsKey: _legacyNoTruncationsKey;
  readonly budgetNoTruncationsKey: _budgetNoTruncationsKey;
  readonly legacyAliasComposition: _legacyAliasComposition;
  readonly budgetAliasComposition: _budgetAliasComposition;
  readonly legacyHasReleased: _legacyHasReleased;
  readonly budgetHasReleased: _budgetHasReleased;
  readonly overloadOrderLegacyLast: _overloadOrderLegacyLast;
  readonly releasedIssueCode: _releasedIssueCode;
  readonly releasedIssueOk: _releasedIssueOk;
  readonly releasedIssueThreeKeys: _releasedIssueThreeKeys;
  readonly releasedNoSuccessKeys: _releasedNoSuccessKeys;
};

declare const lease: NamespaceLease;
declare const released: NamespaceLeaseReleasedIssue;

describe('类型面（CT-8 H4 镜像）：lease 成功面四键投影文本 + released issue 形状不动', () => {
  it('legacy/预算成功成员同型四键；truncations 直读 fail closed；released 短路形状零变化', () => {
    const legacy = lease.readData(['title']);
    const budget = lease.readData(['title'], { depth: 1 });
    void legacy;
    void budget;
    if (legacy.ok) {
      const text: string | null = legacy.schema;
      const flag: boolean = legacy.truncated;
      void text;
      void flag;
      // @ts-expect-error 结构化 truncations 键退役（ADR-0027 决策 1）——成功成员零泄漏
      void legacy.truncations;
      // @ts-expect-error schema 为投影文本——不再是四件套投影对象
      void legacy.schema.valueSchema;
    }
    if (budget.ok) {
      const text: string | null = budget.schema;
      void text;
      // @ts-expect-error 预算成功成员同型四键：truncations 同样不可达
      void budget.truncations;
    }
    void released;
  });
});
