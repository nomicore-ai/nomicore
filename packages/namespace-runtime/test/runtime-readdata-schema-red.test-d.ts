/**
 * SA6 类型锚（issue #273 / ADR-0016 → issue #364 / ADR-0027 决策 1/4）— runtime 层
 * readData 结果联合 ok 分支必须为**恰四键** `{ ok: true; value: unknown;
 * schema: string | null; truncated: boolean }`（AC1「runtime 层形状」类型面；
 * #364 起 schema 为投影文本，不再是 JSON 投影四件套）。
 *
 * 锚定机制（vitest --typecheck / `tsc -p tsconfig.typecheck.json` 下红/绿翻转）：
 * - `Extract<…, { ok: true; value: unknown; schema: string | null; truncated: boolean }>`
 *   非 never → 存在携带投影文本的成功成员；`keyof` 精确四键（多一键 = 形状漂移即红）；
 * - 【绿（保持性守卫）】doc-runtime `ReadLogicalValueResult` ok 成员必须保持 schema
 *   无关（schema 只进 namespace-runtime 组合边界，doc-runtime 零改动）——若 doc-runtime
 *   读结果被塞入 schema，守卫翻转红。
 *
 * 行为面锚见 runtime-readdata-schema-projection-red.test.ts（文本一致性锚）。
 */
import { describe, it } from 'vitest';
import type { NamespaceRuntimeReadDataResult } from '@nomicore/namespace-runtime';
import type { ReadLogicalValueResult } from '@nomicore/doc-runtime';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type AssertTrue<T extends true> = T;

type OkMember<T> = Extract<T, { ok: true }>;

/**
 * ok 分支形状探针：联合中须存在携带 `schema: string | null`（投影文本）与
 * `truncated: boolean` 的 ok:true 成员（value 同时在场）。
 */
type HasSchemaOnOk<T> =
  Extract<T, { ok: true; value: unknown; schema: string | null; truncated: boolean }> extends never
    ? never
    : true;

/** 成功成员恰四键（多一键/少一键即红）。 */
type _okFourKeys = AssertTrue<
  Equal<keyof OkMember<NamespaceRuntimeReadDataResult>, 'ok' | 'value' | 'schema' | 'truncated'>
>;
type _okSchema = AssertTrue<
  Equal<OkMember<NamespaceRuntimeReadDataResult>['schema'], string | null>
>;
type _okTruncated = AssertTrue<
  Equal<OkMember<NamespaceRuntimeReadDataResult>['truncated'], boolean>
>;

/** 保持性守卫：doc-runtime 读结果 ok 成员不得携带任何 schema 键（schema 无关保持）。 */
type DocReadOkStillSchemaless<T> =
  Extract<T, { ok: true; schema: unknown }> extends never
    ? true
    : never;

describe('类型面：NamespaceRuntimeReadDataResult 成功分支携带可空投影文本（AC1/#364）', () => {
  it('ok:true 成员形状 = { value, schema: string | null, truncated: boolean }（恰四键）', () => {
    const anchored: HasSchemaOnOk<NamespaceRuntimeReadDataResult> = true;
    void anchored;
  });
});

describe('类型面：doc-runtime ReadLogicalValueResult 保持 schema 无关（分层保持守卫）', () => {
  it('ok 成员不得出现 schema 键（doc-runtime 读取面零改动）', () => {
    const guarded: DocReadOkStillSchemaless<ReadLogicalValueResult> = true;
    void guarded;
  });
});
