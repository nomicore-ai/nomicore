/**
 * issue #440 类型面验收契约（红：TS2305 能力缺口）——`@nomicore/vfsl` Record / 封闭对象
 * delete 的逐 entry 判定接缝。
 *
 * 契约来源：SA6 `wiki/raw/task_issue-440_sa6_contract.md` §12.1 绑定表 B-1（导出名
 * `applyElementwiseEntryMutation`）、B-2（载体域事实 `{ readonly has: boolean }`——目标键位
 * 在场性，O(1)，与 live `Y.Map.has(key)` 同义）、B-3（载荷词表恰 `set | delete`，字段与
 * `BoundaryMutationPayload` 同名支逐字一致；array-* 仍走数组接缝
 * `applyElementwiseArrayMutation`）、B-4（返回 `ValidateResult`，无 `proposedBoundary`——
 * ADR 0034 决策 3：fast-path 提交省略边界重投影）；母法 ADR 0034 决策 1/2。
 *
 * 红灯机理（HEAD）：公共入口无该导出 ⟹ 静态 import TS2305；负面 `@ts-expect-error`
 * 未命中（TS2578）；实现公共面后翻绿。类型断言只经包公共入口（`../src/index.js`），
 * 不 import 内部件；负面夹具必须 fail closed（签名若放宽为超集，`@ts-expect-error`
 * 未使用即红）。
 */
import { expectTypeOf } from 'vitest';
import { applyElementwiseEntryMutation } from '../src/index.js';
import type { DerivedSchema, MutationBoundaryPlan, ValidateResult } from '../src/index.js';
import type { ElementwiseEntryMutationPayload, EntryCarrierFacts } from '../src/index.js';

declare const derived: DerivedSchema;
declare const plan: MutationBoundaryPlan;

// B-1/B-4：导出为函数，返回 ValidateResult（ok 支 / issues 支直出，非 result 包装）
expectTypeOf(applyElementwiseEntryMutation).toBeFunction();
expectTypeOf(applyElementwiseEntryMutation).parameter(0).toEqualTypeOf<DerivedSchema>();
expectTypeOf(applyElementwiseEntryMutation).parameter(1).toEqualTypeOf<MutationBoundaryPlan>();
expectTypeOf(applyElementwiseEntryMutation).parameter(2).toEqualTypeOf<EntryCarrierFacts>();
expectTypeOf(applyElementwiseEntryMutation).parameter(3).toEqualTypeOf<ElementwiseEntryMutationPayload>();
expectTypeOf(applyElementwiseEntryMutation).returns.toEqualTypeOf<ValidateResult>();

// B-2：载体域事实只有 has（O(1) 在场性读；不含其他 entry / 父值）
expectTypeOf<EntryCarrierFacts>().toEqualTypeOf<{ readonly has: boolean }>();

// B-3：载荷词表恰两支，字段与现行 BoundaryMutationPayload 同名支逐字一致
const setResult: ValidateResult = applyElementwiseEntryMutation(derived, plan, { has: true }, { op: 'set', value: { name: 'a', qty: 1 } });
expectTypeOf(setResult).toEqualTypeOf<ValidateResult>();
const deleteResult: ValidateResult = applyElementwiseEntryMutation(derived, plan, { has: false }, { op: 'delete' });
expectTypeOf(deleteResult).toEqualTypeOf<ValidateResult>();
const unknownValue: ValidateResult = applyElementwiseEntryMutation(derived, plan, { has: false }, { op: 'set', value: undefined });
expectTypeOf(unknownValue).toEqualTypeOf<ValidateResult>();

// —— 负面夹具（fail closed）——
// @ts-expect-error 载体域事实必填 has（键位在场判定的唯一输入；省略即无法判定 no-op）
applyElementwiseEntryMutation(derived, plan, {}, { op: 'delete' });
// @ts-expect-error 载荷词表恰 set | delete（array-insert/array-delete 走数组接缝 applyElementwiseArrayMutation）
applyElementwiseEntryMutation(derived, plan, { has: true }, { op: 'array-insert', index: 0, values: [] });
// @ts-expect-error fast path 不经 result 包装（返回 ValidateResult 直出）
const wrapped: { ok: false; result: ValidateResult } = applyElementwiseEntryMutation(derived, plan, { has: true }, { op: 'delete' });
void wrapped;
