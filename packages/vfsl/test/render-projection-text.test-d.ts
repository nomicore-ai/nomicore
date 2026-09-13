/**
 * issue #363 类型面契约（SA6 §12.2 G1.5–G1.9；设计 §7.0 P5）。
 *
 * 红灯机制（HEAD）：`../src/index.js` 无 `renderProjectionText` / `ProjectionTruncation`
 * → 本文件在 `vitest --typecheck` 与 `tsc -p packages/vfsl/tsconfig.json` 双入口红
 * （TS2305）；SA3 实现公共面后翻绿。仅类型断言（`expectTypeOf` / `@ts-expect-error`），
 * 无运行时产物。
 */
import { describe, expectTypeOf, it } from 'vitest';
import { renderProjectionText } from '../src/index.js';
import type {
  BudgetedReadDataSchemaProjection,
  ProjectionTruncation,
  ReadDataSchemaProjection,
} from '../src/index.js';

declare const noBudgetProjection: ReadDataSchemaProjection;
declare const budgetedProjection: BudgetedReadDataSchemaProjection;

/** 与 doc-runtime `ReadLogicalValueTruncationEntry` 结构同形（跨票透传锚）。 */
interface TruncationEntryLike {
  readonly path: readonly (string | number)[];
  readonly kind: 'depth' | 'width';
  readonly omitted: number;
}

declare const entries: readonly TruncationEntryLike[];

describe('#363 G1 CT-1 类型面：公共导出 / 零选项签名 / truncations 结构兼容', () => {
  it('G1.5 导出在场且为返回 string 的函数', () => {
    expectTypeOf(renderProjectionText).toBeFunction();
    expectTypeOf(renderProjectionText).returns.toEqualTypeOf<string>();
  });

  it('G1.6 无预算投影入参编译，结果为 string', () => {
    const text = renderProjectionText(noBudgetProjection);
    expectTypeOf(text).toEqualTypeOf<string>();
  });

  it('G1.7 预算投影入参编译；显式 undefined 第二参合法，结果为 string', () => {
    const text = renderProjectionText(budgetedProjection);
    const withUndefined = renderProjectionText(budgetedProjection, undefined);
    expectTypeOf(text).toEqualTypeOf<string>();
    expectTypeOf(withUndefined).toEqualTypeOf<string>();
  });

  it('G1.8 零选项：第三参与「选项对象作第二参」均在类型面拒绝', () => {
    // @ts-expect-error 零选项签名——不接受第三参
    renderProjectionText(noBudgetProjection, [], { depth: 1 });
    // @ts-expect-error 第二参 = truncations 清单，不接受呈现选项对象
    renderProjectionText(noBudgetProjection, { depth: 1 });
  });

  it('G1.9 truncations 元素与 doc-runtime 条目结构同构；封闭判别反例静态拒绝', () => {
    const text: string = renderProjectionText(budgetedProjection, entries);
    expectTypeOf(text).toEqualTypeOf<string>();
    expectTypeOf<ProjectionTruncation>().toMatchTypeOf<TruncationEntryLike>();
    expectTypeOf<TruncationEntryLike>().toMatchTypeOf<ProjectionTruncation>();
    // @ts-expect-error kind 封闭两值：'height' 非法
    renderProjectionText(budgetedProjection, [{ path: ['a'], kind: 'height', omitted: 1 }]);
    // @ts-expect-error omitted 为 number
    renderProjectionText(budgetedProjection, [{ path: ['a'], kind: 'depth', omitted: '2' }]);
    // @ts-expect-error path 为 (string | number)[]（非 string）
    renderProjectionText(budgetedProjection, [{ path: 'x', kind: 'depth', omitted: 1 }]);
  });
});
