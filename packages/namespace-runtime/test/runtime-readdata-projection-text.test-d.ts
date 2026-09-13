/**
 * issue #364（ADR-0027 决策 1/2/4）类型面锚 —— readData 投影文本化的编译期锁
 * （SA6 契约 §12 CT-8 H1–H6；设计 §7-D3/D6/D9）。
 *
 * 契约解释（CT-8 头注）：两结果**联合名**（`NamespaceRuntimeReadDataResult` /
 * `NamespaceRuntimeReadDataBudgetResult`）与双重载签名保留（失败面结构不同，
 * `READ_OPTIONS_INVALID` 零泄漏）；**成功成员坍缩为同一个四键类型**
 * `{ ok: true; value: unknown; schema: string | null; truncated: boolean }`
 * ——原 `ReadDataSchemaProjection | null` / `BudgetedReadDataSchemaProjection | null`
 * 两支消失，`truncations` 键退役。
 *
 * 锚定机制（vitest --typecheck / `tsc -p tsconfig.typecheck.json`）：
 * - H1 四键 `keyof` Equal（两联合）；
 * - H2 `schema` 精确 `string | null`（无 undefined 第三态）、`truncated` 精确 boolean；
 * - H3 `Extract<…, { truncations: unknown }> === never`（两联合）+ 消费负例
 *   `@ts-expect-error`（`r.truncations` / `r.schema.valueSchema`）；
 * - H5 doc-runtime 值通道保持性守卫（`ReadLogicalValueResult` ok 恰 `{ok,value}`、
 *   `ReadLogicalValueTruncationEntry` 形状不变——零 readData 反向污染）；
 * - H6 渲染器入参结构兼容**零 cast**：`readonly ReadLogicalValueTruncationEntry[]`
 *   可赋值给 `renderProjectionText` 第二参（`ProjectionTruncation` 同构）。
 *
 * H4（lease 别名组合锁镜像）由 registry 类型面文件承担（registry-readdata-*.test-d.ts）；
 * 本文件只管 runtime 缝 + 值通道/渲染器物候。
 */
import { describe, it } from 'vitest';
import { renderProjectionText } from '@nomicore/vfsl';
import type { ProjectionTruncation } from '@nomicore/vfsl';
import type {
  NamespaceRuntime,
  NamespaceRuntimeReadDataBudgetResult,
  NamespaceRuntimeReadDataResult,
} from '@nomicore/namespace-runtime';
import type {
  ReadLogicalValueResult,
  ReadLogicalValueTruncationEntry,
} from '@nomicore/doc-runtime';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type AssertTrue<T extends true> = T;

type LegacyOk = Extract<NamespaceRuntimeReadDataResult, { ok: true }>;
type BudgetOk = Extract<NamespaceRuntimeReadDataBudgetResult, { ok: true }>;

// —— H1：成功成员坍缩为单一四键形（两联合） ——
type _h1LegacyFourKeys = AssertTrue<
  Equal<keyof LegacyOk, 'ok' | 'value' | 'schema' | 'truncated'>
>;
type _h1BudgetFourKeys = AssertTrue<
  Equal<keyof BudgetOk, 'ok' | 'value' | 'schema' | 'truncated'>
>;
type _h1SingleOkShape = AssertTrue<Equal<LegacyOk, BudgetOk>>;

// —— H2：schema 精确可空（无 undefined 第三态）；truncated 精确 boolean ——
type _h2LegacySchema = AssertTrue<Equal<LegacyOk['schema'], string | null>>;
type _h2BudgetSchema = AssertTrue<Equal<BudgetOk['schema'], string | null>>;
type _h2LegacyTruncated = AssertTrue<Equal<LegacyOk['truncated'], boolean>>;
type _h2BudgetTruncated = AssertTrue<Equal<BudgetOk['truncated'], boolean>>;

// —— H3：truncations 键退役（两联合无携带该键的成员） ——
type _h3LegacyNoTruncations = AssertTrue<
  Equal<Extract<NamespaceRuntimeReadDataResult, { truncations: unknown }>, never>
>;
type _h3BudgetNoTruncations = AssertTrue<
  Equal<Extract<NamespaceRuntimeReadDataBudgetResult, { truncations: unknown }>, never>
>;

// —— H5：doc-runtime 值通道保持性守卫（值通道冻结面） ——
type DocOk = Extract<ReadLogicalValueResult, { ok: true }>;
type _h5DocOkExactTwoKeys = AssertTrue<Equal<keyof DocOk, 'ok' | 'value'>>;
type _h5DocOkShape = AssertTrue<Equal<DocOk, { ok: true; value: unknown }>>;
type _h5EntryKeys = AssertTrue<
  Equal<keyof ReadLogicalValueTruncationEntry, 'path' | 'kind' | 'omitted'>
>;
type _h5EntryPath = AssertTrue<
  Equal<ReadLogicalValueTruncationEntry['path'], readonly (string | number)[]>
>;
type _h5EntryKind = AssertTrue<Equal<ReadLogicalValueTruncationEntry['kind'], 'depth' | 'width'>>;
type _h5EntryOmitted = AssertTrue<Equal<ReadLogicalValueTruncationEntry['omitted'], number>>;

// —— H6：渲染器入参结构兼容零 cast ——
/** `renderProjectionText` 第二参类型（T1 冻结签名：`readonly ProjectionTruncation[] | undefined`）。 */
type RendererTruncations = Parameters<typeof renderProjectionText>[1];
/** 零 cast 可赋值：值通道截断清单原样喂渲染器（组合层不得引入 `as`）。 */
const feedRendererTruncations = (
  truncations: readonly ReadLogicalValueTruncationEntry[],
): RendererTruncations => truncations;
/** 双向结构同构抽检（值通道条目 ↔ 渲染器条目）。 */
const projectionTruncations: readonly ProjectionTruncation[] = [] as readonly ReadLogicalValueTruncationEntry[];
void feedRendererTruncations;
void projectionTruncations;

// 声明期证明（仅 typecheck 用，零运行时值）。
export type RuntimeReadDataProjectionTextAssertions = {
  readonly h1LegacyFourKeys: _h1LegacyFourKeys;
  readonly h1BudgetFourKeys: _h1BudgetFourKeys;
  readonly h1SingleOkShape: _h1SingleOkShape;
  readonly h2LegacySchema: _h2LegacySchema;
  readonly h2BudgetSchema: _h2BudgetSchema;
  readonly h2LegacyTruncated: _h2LegacyTruncated;
  readonly h2BudgetTruncated: _h2BudgetTruncated;
  readonly h3LegacyNoTruncations: _h3LegacyNoTruncations;
  readonly h3BudgetNoTruncations: _h3BudgetNoTruncations;
  readonly h5DocOkExactTwoKeys: _h5DocOkExactTwoKeys;
  readonly h5DocOkShape: _h5DocOkShape;
  readonly h5EntryKeys: _h5EntryKeys;
  readonly h5EntryPath: _h5EntryPath;
  readonly h5EntryKind: _h5EntryKind;
  readonly h5EntryOmitted: _h5EntryOmitted;
};

declare const runtime: NamespaceRuntime;

describe('类型面 H1–H3：readData 成功面恒四键 + schema 投影文本 + truncations 退役', () => {
  it('两联合成功成员同型四键；消费负例：r.truncations / r.schema.valueSchema 编译失败', () => {
    const legacy = runtime.readData([]);
    if (!legacy.ok) throw new Error('前提失败：readData([]) 应成功');
    // @ts-expect-error H3：truncations 键退役（结构化清单不再是成功成员）
    void legacy.truncations;
    if (legacy.schema === null) throw new Error('前提失败：ROOT 投影文本应非 null');
    // @ts-expect-error H3：schema 为投影文本 string——不再有 valueSchema 成员
    void legacy.schema.valueSchema;

    const budgeted = runtime.readData([], { depth: 1 });
    if (!budgeted.ok) throw new Error('前提失败：预算 readData 应成功');
    // @ts-expect-error H3：预算成功成员与 legacy 同型——truncations 同样退役
    void budgeted.truncations;
    if (budgeted.schema === null) throw new Error('前提失败：预算 ROOT 投影文本应非 null');
    // @ts-expect-error H3：预算成功成员 schema 同为 string——无 valueSchema 成员
    void budgeted.schema.valueSchema;
  });
});

describe('类型面 H5/H6：值通道与渲染器物候零漂移', () => {
  it('doc-runtime 截断条目形状不变且零 cast 可赋值给 renderProjectionText 第二参', () => {
    // H6 编译期可赋值证明在声明期已完成（feedRendererTruncations）；此处只做消费抽查。
    const entries: readonly ReadLogicalValueTruncationEntry[] = [];
    const accepted: RendererTruncations = feedRendererTruncations(entries);
    void accepted;
  });
});
