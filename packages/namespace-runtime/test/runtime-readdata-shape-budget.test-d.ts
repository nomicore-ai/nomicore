/**
 * issue #336（ADR-0024 T3）× issue #364（ADR-0027 决策 1/4）类型面锚 —— runtime
 * `readData` 双结果联合 + 双重载（设计 §12-T3；#364 四键/文本形态翻新）。
 *
 * 锚定机制（vitest --typecheck / `tsc -p tsconfig.typecheck.json`）：
 * - **单一四键成功形**：两联合（legacy / 预算）成功成员的 `keyof` 精确集合都是
 *   `'ok' | 'value' | 'schema' | 'truncated'`，且两成员**同型**（原双投影 schema 类型
 *   分支消失）——`schema` 精确 `string | null`（投影文本，无 undefined 第三态）、
 *   `truncated` 精确 `boolean`；
 * - **零泄漏**：`READ_OPTIONS_INVALID` 只属于预算联合（doc-runtime T1 双联合注记预期的
 *   Extract 派生零泄漏点），legacy 联合不得含该码；
 * - **truncations 退役**：两联合都不存在携带 `truncations` 键的成员（结构化截断清单
 *   不再是 readData 交付面；截断事实唯一载体 = 投影文本 ✂ 段）；
 * - **失败面无新键**：两联合的失败成员都不得携带 truncated/schema/truncations；
 * - **重载序**：legacy 重载排最后（`ReturnType` 取末签名 → `_readAlias` 锚原文保持）；
 *   预算调用结果含 READ_OPTIONS_INVALID 成员 → 不得赋给 legacy 联合（反向锁）；
 * - **消费负例**：`r.truncations` 与 `r.schema.valueSchema` 必须编译失败。
 */
import { describe, it } from 'vitest';
import type {
  NamespaceRuntime,
  NamespaceRuntimeReadDataBudgetResult,
  NamespaceRuntimeReadDataOptions,
  NamespaceRuntimeReadDataResult,
} from '@nomicore/namespace-runtime';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type AssertTrue<T extends true> = T;

type LegacyOk = Extract<NamespaceRuntimeReadDataResult, { ok: true }>;
type BudgetOk = Extract<NamespaceRuntimeReadDataBudgetResult, { ok: true }>;

// —— 恒四键：keyof 精确集合（多一键/少一键即红）；两联合成功成员同型（单一四键形）——
type _legacyFourKeys = AssertTrue<
  Equal<keyof LegacyOk, 'ok' | 'value' | 'schema' | 'truncated'>
>;
type _budgetFourKeys = AssertTrue<
  Equal<keyof BudgetOk, 'ok' | 'value' | 'schema' | 'truncated'>
>;
type _singleOkShape = AssertTrue<Equal<LegacyOk, BudgetOk>>;
type _legacySchema = AssertTrue<Equal<LegacyOk['schema'], string | null>>;
type _budgetSchema = AssertTrue<Equal<BudgetOk['schema'], string | null>>;
type _legacyTruncated = AssertTrue<Equal<LegacyOk['truncated'], boolean>>;
type _budgetTruncated = AssertTrue<Equal<BudgetOk['truncated'], boolean>>;

// —— truncations 退役：两联合均无携带该键的成员 ——
type _legacyNoTruncations = AssertTrue<
  Equal<Extract<NamespaceRuntimeReadDataResult, { truncations: unknown }>, never>
>;
type _budgetNoTruncations = AssertTrue<
  Equal<Extract<NamespaceRuntimeReadDataBudgetResult, { truncations: unknown }>, never>
>;

// —— 零泄漏：READ_OPTIONS_INVALID 只属于预算联合 ——
type _legacyNoOptionsCode = AssertTrue<
  Equal<Extract<NamespaceRuntimeReadDataResult, { code: 'READ_OPTIONS_INVALID' }>, never>
>;
type _budgetHasOptionsCode = AssertTrue<
  Equal<
    Extract<NamespaceRuntimeReadDataBudgetResult, { ok: false; code: 'READ_OPTIONS_INVALID' }> extends never
      ? never
      : true,
    true
  >
>;

// —— 失败面无新键（既有失败分支形状不动）——
type _legacyFailureNoNewKeys = AssertTrue<
  Equal<Extract<NamespaceRuntimeReadDataResult, { ok: false; truncated: unknown }>, never>
>;
type _budgetFailureNoNewKeys = AssertTrue<
  Equal<Extract<NamespaceRuntimeReadDataBudgetResult, { ok: false; truncated: unknown }>, never>
>;
type _legacyFailureNoSchemaKey = AssertTrue<
  Equal<Extract<NamespaceRuntimeReadDataResult, { ok: false; schema: unknown }>, never>
>;
type _budgetFailureNoSchemaKey = AssertTrue<
  Equal<Extract<NamespaceRuntimeReadDataBudgetResult, { ok: false; schema: unknown }>, never>
>;

// —— 重载序：legacy 排最后（ReturnType 取末签名；registry `_readAlias` 锚原文保持的前提）——
type _legacyReturnType = AssertTrue<
  Equal<ReturnType<NamespaceRuntime['readData']>, NamespaceRuntimeReadDataResult>
>;

/** 预算 options：runtime **自持三键闭合形状**（ADR 0031 决策 1 对 ADR 0024 决策 1 的再修订：
 *  两轴 + `maxBytes`；#364 时曾是 doc-runtime 两键单源别名——三键化后该别名形态不再成立，
 *  本锁随修订链原位演进）。doc-runtime 两键面零改动由 `issue-405-maxbytes.test-d.ts` 的
 *  `keyof ReadLogicalValueAtPathOptions` 硬锁独立锚定（ADR 0031 决策 4）。 */
type _optionsClosedShape = AssertTrue<
  Equal<
    NamespaceRuntimeReadDataOptions,
    { depth?: number; maxChildrenPerNode?: number; maxBytes?: number }
  >
>;

// 声明期证明（仅 typecheck 用，零运行时值）。
export type RuntimeReadDataShapeAssertions = {
  readonly legacyFourKeys: _legacyFourKeys;
  readonly budgetFourKeys: _budgetFourKeys;
  readonly singleOkShape: _singleOkShape;
  readonly legacySchema: _legacySchema;
  readonly budgetSchema: _budgetSchema;
  readonly legacyTruncated: _legacyTruncated;
  readonly budgetTruncated: _budgetTruncated;
  readonly legacyNoTruncations: _legacyNoTruncations;
  readonly budgetNoTruncations: _budgetNoTruncations;
  readonly legacyNoOptionsCode: _legacyNoOptionsCode;
  readonly budgetHasOptionsCode: _budgetHasOptionsCode;
  readonly legacyFailureNoNewKeys: _legacyFailureNoNewKeys;
  readonly budgetFailureNoNewKeys: _budgetFailureNoNewKeys;
  readonly legacyFailureNoSchemaKey: _legacyFailureNoSchemaKey;
  readonly budgetFailureNoSchemaKey: _budgetFailureNoSchemaKey;
  readonly legacyReturnType: _legacyReturnType;
  readonly optionsClosedShape: _optionsClosedShape;
};

declare const runtime: NamespaceRuntime;

describe('类型面：readData 双重载（单参 → legacy 联合；双参 → 预算联合）', () => {
  it('单参调用命中 legacy 联合、双参调用命中预算联合；预算联合不得赋给 legacy 联合（反向零泄漏锁）', () => {
    const legacyCall: NamespaceRuntimeReadDataResult = runtime.readData([]);
    const budgetCall: NamespaceRuntimeReadDataBudgetResult = runtime.readData([], { depth: 1 });
    void legacyCall;
    void budgetCall;
    // @ts-expect-error 预算联合含 READ_OPTIONS_INVALID 成员——不得赋给 legacy 联合（零泄漏反向锁）
    const leak: NamespaceRuntimeReadDataResult = runtime.readData([], { depth: 1 });
    void leak;
  });

  it('#364 负例：r.truncations / r.schema.valueSchema 均编译失败（文本形态零泄漏）', () => {
    const r = runtime.readData([]);
    if (!r.ok) throw new Error('前提失败：readData([]) 应成功');
    // @ts-expect-error truncations 键退役——成功成员不再携带结构化截断清单
    void r.truncations;
    if (r.schema === null) throw new Error('前提失败：ROOT 投影文本应非 null');
    // @ts-expect-error schema 为投影文本 string——不再有 valueSchema 成员
    void r.schema.valueSchema;

    const b = runtime.readData([], { depth: 1 });
    if (!b.ok) throw new Error('前提失败：readData([], {depth:1}) 应成功');
    // @ts-expect-error 预算成功成员与 legacy 同型：truncations 同样退役
    void b.truncations;
    if (b.schema === null) throw new Error('前提失败：预算 ROOT 投影文本应非 null');
    // @ts-expect-error 预算成功成员 schema 同为 string——无 valueSchema 成员
    void b.schema.valueSchema;
  });
});
