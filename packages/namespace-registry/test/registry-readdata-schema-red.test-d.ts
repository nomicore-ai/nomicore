/**
 * SA6 类型锚（issue #273 / ADR-0016；#364 / ADR-0027 决策 1/4 翻新）— lease 层 readData
 * 结果别名必须跟随 runtime 交付形态（AC1「runtime 与 lease 两层类型一致」类型面）。
 *
 * 锚定机制（vitest --typecheck / `tsc -p tsconfig.typecheck.json`）：
 * - lease 别名组合：`NamespaceLeaseReadDataResult = NamespaceRuntimeReadDataResult
 *   | NamespaceLeaseReleasedIssue`——成功成员携带 `schema: string | null`（投影文本）
 *   与 `truncated: boolean`，恒四键；
 * - 组合锁：`NamespaceLeaseReadDataBudgetResult = NamespaceRuntimeReadDataBudgetResult
 *   | NamespaceLeaseReleasedIssue`（具名组合锁在 lease.ts）；重载序 legacy 最后
 *   （`ReturnType` 取末签名）。
 * - 【绿（保持性守卫）】leased/released/disabled 失败面不得混入 ok:true 形状——ok
 *   判别与失败通道保持（本锚只认 ok:true + schema + truncated 的成员存在性，不误报
 *   失败成员）。
 *
 * 行为面：lease.readData 为 entry.runtime.readData 直透传（lease.ts），runtime 契约
 * 即 lease 行为契约；registry 侧本锚锁类型跟随。
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

/** ok 分支形状探针：联合中须存在携带 `schema: string | null` + `truncated: boolean` 的
 *  ok:true 成员（ADR-0027 决策 1 投影文本交付形态）。 */
type HasSchemaOnLeaseOk<T> =
  Extract<T, { ok: true; value: unknown; schema: string | null; truncated: boolean }> extends never
    ? never
    : true;

// —— lease 别名组合锁（#364 交付形态换代后组合关系零变化）——
type _legacyAliasComposition = AssertTrue<
  Equal<NamespaceLeaseReadDataResult, NamespaceRuntimeReadDataResult | NamespaceLeaseReleasedIssue>
>;
type _budgetAliasComposition = AssertTrue<
  Equal<NamespaceLeaseReadDataBudgetResult, NamespaceRuntimeReadDataBudgetResult | NamespaceLeaseReleasedIssue>
>;
type _budgetHasReleased = AssertTrue<
  Equal<Extract<NamespaceLeaseReadDataBudgetResult, { code: 'NAMESPACE_LEASE_RELEASED' }>, NamespaceLeaseReleasedIssue>
>;
// 重载序：legacy 排最后（`ReturnType` 取末签名）。
type _legacyLast = AssertTrue<
  Equal<ReturnType<NamespaceLease['readData']>, NamespaceLeaseReadDataResult>
>;

// —— 成功成员恒四键 + 精确可空 schema（AC1 类型面）——
type _legacyFourKeys = AssertTrue<
  Equal<keyof Extract<NamespaceLeaseReadDataResult, { ok: true }>, 'ok' | 'value' | 'schema' | 'truncated'>
>;
type _legacySchemaExact = AssertTrue<
  Equal<Extract<NamespaceLeaseReadDataResult, { ok: true }>['schema'], string | null>
>;

export type LeaseReadDataSchemaAssertions = {
  readonly legacyAliasComposition: _legacyAliasComposition;
  readonly budgetAliasComposition: _budgetAliasComposition;
  readonly budgetHasReleased: _budgetHasReleased;
  readonly legacyLast: _legacyLast;
  readonly legacyFourKeys: _legacyFourKeys;
  readonly legacySchemaExact: _legacySchemaExact;
};

describe('类型面：NamespaceLeaseReadDataResult 别名跟随 runtime 交付形态（AC1）', () => {
  it('lease readData 成功分支携带可空投影文本 schema + truncated 布尔（恒四键）', () => {
    const anchored: HasSchemaOnLeaseOk<NamespaceLeaseReadDataResult> = true;
    void anchored;
  });
});
