/**
 * issue #435 类型面验收契约（红：TS2305 能力缺口）——`@nomicore/vfsl` 数组逐元素校验 seam。
 *
 * 契约来源：SA6 `wiki/raw/task_issue-435_sa6_contract.md` §12.1 绑定表 B-1（导出名
 * `applyElementwiseArrayMutation`）、B-2（载体域事实 `{ readonly length: number }`）、
 * B-3（载荷词表恰 `array-insert | array-delete`，字段与 `BoundaryMutationPayload` 同名支
 * 逐字一致）、B-4（返回 `ValidateResult`，无 `proposedBoundary`——ADR 0033 决策 3：
 * fast-path 提交省略边界重投影）；母法 ADR 0033 决策 1/2。
 *
 * 红灯机理（HEAD）：公共入口无该导出 ⟹ 静态 import TS2305 / 负面 `@ts-expect-error`
 * 未命中（TS2578）；SA9 实现公共面后翻绿。类型断言只经包公共入口（`../src/index.js`），
 * 不 import 内部件；负面夹具必须 fail closed（签名若放宽为超集，`@ts-expect-error`
 * 未使用即红）。
 */
import { expectTypeOf } from 'vitest';
import { applyElementwiseArrayMutation } from '../src/index.js';
import type { DerivedSchema, MutationBoundaryPlan, ValidateResult } from '../src/index.js';
import type { ArrayCarrierFacts, ElementwiseArrayMutationPayload } from '../src/index.js';

declare const derived: DerivedSchema;
declare const plan: MutationBoundaryPlan;

// B-1/B-4：导出为函数，返回 ValidateResult（ok 支 / issues 支直出，非 result 包装）
expectTypeOf(applyElementwiseArrayMutation).toBeFunction();
expectTypeOf(applyElementwiseArrayMutation).parameter(0).toEqualTypeOf<DerivedSchema>();
expectTypeOf(applyElementwiseArrayMutation).parameter(1).toEqualTypeOf<MutationBoundaryPlan>();
expectTypeOf(applyElementwiseArrayMutation).parameter(2).toEqualTypeOf<ArrayCarrierFacts>();
expectTypeOf(applyElementwiseArrayMutation).parameter(3).toEqualTypeOf<ElementwiseArrayMutationPayload>();
expectTypeOf(applyElementwiseArrayMutation).returns.toEqualTypeOf<ValidateResult>();

// B-2：载体域事实只有 length（O(1) 读；不含元素值）
expectTypeOf<ArrayCarrierFacts>().toEqualTypeOf<{ readonly length: number }>();

// B-3：载荷词表恰两支，字段与现行 BoundaryMutationPayload 同名支逐字一致
const insertResult: ValidateResult = applyElementwiseArrayMutation(derived, plan, { length: 3 }, {
  op: 'array-insert',
  index: 1,
  values: [{ name: 'a', qty: 1 }],
});
expectTypeOf(insertResult).toEqualTypeOf<ValidateResult>();
const deleteResult: ValidateResult = applyElementwiseArrayMutation(derived, plan, { length: 3 }, { op: 'array-delete', index: 0, count: 2 });
expectTypeOf(deleteResult).toEqualTypeOf<ValidateResult>();
const readonlyValues: ValidateResult = applyElementwiseArrayMutation(derived, plan, { length: 3 }, {
  op: 'array-insert',
  index: 0,
  values: [] as readonly unknown[],
});
expectTypeOf(readonlyValues).toEqualTypeOf<ValidateResult>();

// —— 负面夹具（fail closed）——
// @ts-expect-error 载体域事实必填 length（域规则的唯一输入；省略即无法判定越界）
applyElementwiseArrayMutation(derived, plan, {}, { op: 'array-delete', index: 0, count: 1 });
// @ts-expect-error 载荷词表恰 array-insert | array-delete（set/delete 走 legacy 边界路径）
applyElementwiseArrayMutation(derived, plan, { length: 0 }, { op: 'set', value: 1 });
// @ts-expect-error fast path 不经 result 包装（返回 ValidateResult 直出）
const wrapped: { ok: false; result: ValidateResult } = applyElementwiseArrayMutation(derived, plan, { length: 0 }, {
  op: 'array-delete',
  index: 0,
  count: 1,
});
void wrapped;
