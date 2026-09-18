/**
 * issue #336（ADR-0024 T3）类型面锚 + issue #364（ADR-0027 决策 1/4）四键化翻新 ——
 * registry `NamespaceLease.readData` 预算别名与双重载（设计 §12-T6；SA6 CT-8 H1–H4）。
 *
 * 锚定机制（vitest --typecheck）：
 * - 别名组合锁：`NamespaceLeaseReadDataBudgetResult = NamespaceRuntimeReadDataBudgetResult
 *   | NamespaceLeaseReleasedIssue`（沿 legacy 别名先例；lease 层零预算解释）；
 * - 成功成员**单一四键形**（ADR-0027 决策 1/4；两联合成功成员同型）：
 *   `Equal<keyof Extract<…, {ok:true}>, 'ok'|'value'|'schema'|'truncated'>`、`schema` 精确
 *   `string | null`（无 undefined 第三态）、`truncated: boolean`；
 * - 零泄漏：released/legacy 面不得混入 `READ_OPTIONS_INVALID`（只在预算联合）；结构化
 *   `truncations` 键退役后不得从任何成功成员结构可达（`Extract<…,{truncations:unknown}>
 *   === never` + `@ts-expect-error` 直读负例）；
 * - 重载序镜像 runtime：legacy 排最后（`ReturnType` 取末签名 → `_readAlias` 锚原文保持）。
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

type LeaseLegacyOk = Extract<NamespaceLeaseReadDataResult, { ok: true }>;
type LeaseBudgetOk = Extract<NamespaceLeaseReadDataBudgetResult, { ok: true }>;

// —— 别名组合锁（lease 预算结果 = runtime 预算联合 | released issue）——
type _budgetAlias = AssertTrue<
  Equal<NamespaceLeaseReadDataBudgetResult, NamespaceRuntimeReadDataBudgetResult | NamespaceLeaseReleasedIssue>
>;
type _budgetHasReleased = AssertTrue<
  Equal<Extract<NamespaceLeaseReadDataBudgetResult, { code: 'NAMESPACE_LEASE_RELEASED' }>, NamespaceLeaseReleasedIssue>
>;

// —— 恒四键（镜像 runtime 成功面；ADR-0027 决策 1 破坏性修订：恒五键 → 恒四键）——
type _legacyFourKeys = AssertTrue<
  Equal<keyof LeaseLegacyOk, 'ok' | 'value' | 'schema' | 'truncated'>
>;
type _budgetFourKeys = AssertTrue<
  Equal<keyof LeaseBudgetOk, 'ok' | 'value' | 'schema' | 'truncated'>
>;
type _legacyOkLiteral = AssertTrue<Equal<LeaseLegacyOk['ok'], true>>;
type _budgetOkLiteral = AssertTrue<Equal<LeaseBudgetOk['ok'], true>>;
// 两联合成功成员**同型**（单一四键形坍缩；联合名与失败面各自保留）。
type _sameOkShape = AssertTrue<Equal<LeaseLegacyOk, LeaseBudgetOk>>;
// schema = 投影文本（精确 string | null；无 undefined 第三态）；truncated = 布尔机器信号。
type _legacySchema = AssertTrue<Equal<LeaseLegacyOk['schema'], string | null>>;
type _budgetSchema = AssertTrue<Equal<LeaseBudgetOk['schema'], string | null>>;
type _legacyTruncated = AssertTrue<Equal<LeaseLegacyOk['truncated'], boolean>>;
type _budgetTruncated = AssertTrue<Equal<LeaseBudgetOk['truncated'], boolean>>;

// —— 零泄漏：结构化 truncations 键退役后不属任何成功成员 ——
type _legacyNoTruncationsKey = AssertTrue<
  Equal<Extract<NamespaceLeaseReadDataResult, { truncations: unknown }>, never>
>;
type _budgetNoTruncationsKey = AssertTrue<
  Equal<Extract<NamespaceLeaseReadDataBudgetResult, { truncations: unknown }>, never>
>;

// —— 零泄漏：READ_OPTIONS_INVALID 只属于预算别名 ——
type _legacyNoOptionsCode = AssertTrue<
  Equal<Extract<NamespaceLeaseReadDataResult, { code: 'READ_OPTIONS_INVALID' }>, never>
>;
type _budgetHasOptionsCode = AssertTrue<
  Equal<
    Extract<NamespaceLeaseReadDataBudgetResult, { ok: false; code: 'READ_OPTIONS_INVALID' }> extends never
      ? never
      : true,
    true
  >
>;

// —— 失败面无新键（既有失败分支形状不动）——
type _legacyFailureNoNewKeys = AssertTrue<
  Equal<Extract<NamespaceLeaseReadDataResult, { ok: false; truncated: unknown }>, never>
>;
type _budgetFailureNoNewKeys = AssertTrue<
  Equal<Extract<NamespaceLeaseReadDataBudgetResult, { ok: false; truncated: unknown }>, never>
>;

// —— 重载序：legacy 排最后（ReturnType 取末签名）——
type _legacyReturnType = AssertTrue<
  Equal<ReturnType<NamespaceLease['readData']>, NamespaceLeaseReadDataResult>
>;

// —— issue #405（ADR 0031）：预算 options 三键跟随（runtime 单源宿主）+ 新失败分支别名跟随 ——
// options 跟随锁：runtime 单源 options 闭合形状含 `maxBytes`（lease 预算重载第二参按名
// 引用该类型——调用点锁见下方 `lease.readData([], { maxBytes })`）。
type _runtimeOptionsClosedShape = AssertTrue<
  Equal<
    NamespaceRuntimeReadDataOptions,
    { depth?: number; maxChildrenPerNode?: number; maxBytes?: number }
  >
>;
type _budgetExceededAliasFollow = AssertTrue<
  Equal<
    Extract<NamespaceLeaseReadDataBudgetResult, { code: 'READ_BUDGET_EXCEEDED' }>,
    Extract<NamespaceRuntimeReadDataBudgetResult, { code: 'READ_BUDGET_EXCEEDED' }>
  >
>;
type _budgetExceededShape = AssertTrue<
  Equal<
    Extract<NamespaceLeaseReadDataBudgetResult, { code: 'READ_BUDGET_EXCEEDED' }>,
    {
      readonly ok: false;
      readonly code: 'READ_BUDGET_EXCEEDED';
      readonly path: readonly (string | number)[];
      readonly measuredBytes: number;
      readonly message: string;
    }
  >
>;
type _budgetExceededNoSuccessKeys = AssertTrue<
  Equal<Extract<NamespaceLeaseReadDataBudgetResult, { code: 'READ_BUDGET_EXCEEDED'; value: unknown }>, never>
>;

// 声明期证明（仅 typecheck 用，零运行时值）。
export type LeaseReadDataBudgetAssertions = {
  readonly budgetAlias: _budgetAlias;
  readonly budgetHasReleased: _budgetHasReleased;
  readonly legacyFourKeys: _legacyFourKeys;
  readonly budgetFourKeys: _budgetFourKeys;
  readonly legacyOkLiteral: _legacyOkLiteral;
  readonly budgetOkLiteral: _budgetOkLiteral;
  readonly sameOkShape: _sameOkShape;
  readonly legacySchema: _legacySchema;
  readonly budgetSchema: _budgetSchema;
  readonly legacyTruncated: _legacyTruncated;
  readonly budgetTruncated: _budgetTruncated;
  readonly legacyNoTruncationsKey: _legacyNoTruncationsKey;
  readonly budgetNoTruncationsKey: _budgetNoTruncationsKey;
  readonly legacyNoOptionsCode: _legacyNoOptionsCode;
  readonly budgetHasOptionsCode: _budgetHasOptionsCode;
  readonly legacyFailureNoNewKeys: _legacyFailureNoNewKeys;
  readonly budgetFailureNoNewKeys: _budgetFailureNoNewKeys;
  readonly legacyReturnType: _legacyReturnType;
  readonly runtimeOptionsClosedShape: _runtimeOptionsClosedShape;
  readonly budgetExceededAliasFollow: _budgetExceededAliasFollow;
  readonly budgetExceededShape: _budgetExceededShape;
  readonly budgetExceededNoSuccessKeys: _budgetExceededNoSuccessKeys;
};

declare const lease: NamespaceLease;

describe('类型面：lease.readData 双重载（单参 → legacy 别名；双参 → 预算别名）', () => {
  it('单参命中 legacy 别名、双参命中预算别名；预算别名不得赋给 legacy 别名（反向零泄漏锁）', () => {
    const legacyCall: NamespaceLeaseReadDataResult = lease.readData([]);
    const budgetCall: NamespaceLeaseReadDataBudgetResult = lease.readData([], { depth: 1 });
    // issue #405（ADR 0031）：options 三键跟随——lease 预算重载接受含 maxBytes 的 runtime 单源 options。
    const maxBytesCall: NamespaceLeaseReadDataBudgetResult = lease.readData([], { maxBytes: 1 });
    void legacyCall;
    void budgetCall;
    void maxBytesCall;
    // @ts-expect-error 闭合形状：未知第四键（excess property）编译红
    lease.readData([], { maxBytes: 1, nope: 2 });
    // @ts-expect-error 预算别名含 READ_OPTIONS_INVALID 成员——不得赋给 legacy 别名（零泄漏反向锁）
    const leak: NamespaceLeaseReadDataResult = lease.readData([], { depth: 1 });
    void leak;
  });

  it('成功成员零泄漏：truncations 键与 schema.valueSchema 双通道均不可达（ADR-0027 决策 1）', () => {
    const legacy = lease.readData(['title']);
    if (legacy.ok) {
      // @ts-expect-error 结构化 truncations 键已退役——成功成员不得携带（截断事实唯一载体 = ✂ 段）
      void legacy.truncations;
      // @ts-expect-error schema 为投影文本 string | null——不再是 JSON 四件套对象
      void legacy.schema.valueSchema;
    }
    const budget = lease.readData(['title'], { depth: 1 });
    if (budget.ok) {
      // @ts-expect-error 预算成功成员同型四键：truncations 同样不可达
      void budget.truncations;
      // @ts-expect-error 预算成功成员 schema 同样为 string | null
      void budget.schema.valueSchema;
    }
  });
});
