/**
 * issue #405（ADR 0031）readData 字节预算 —— 类型面锚（SA6 §12.2/§12.3 G5/G9 类型侧）。
 *
 * 锚定机制（vitest --typecheck / `tsc -p tsconfig.typecheck.json`）：
 * - **options 三键闭合形状**：`NamespaceRuntimeReadDataOptions` 精确 `{ depth?, maxChildrenPerNode?,
 *   maxBytes? }`（runtime 自持宿主，D3）；第四键 → 编译红（excess property）；
 * - **预算联合新失败分支**：`Extract<…, { code:'READ_BUDGET_EXCEEDED' }>` 恰五键
 *   `{ ok:false, code, path, measuredBytes: number, message }`，零成功键（无 value/schema/truncated）；
 * - **零泄漏**：legacy 联合不得结构可达 `READ_BUDGET_EXCEEDED` / `measuredBytes`；
 * - **doc-runtime 零改动硬锁**（ADR 0031 决策 4「下传两键」）：`keyof ReadLogicalValueAtPathOptions`
 *   恰两键——若 `maxBytes` 被塞进 doc-runtime 类型即在此编译红；
 * - **EOPT 语义**：显式 `maxBytes: undefined` 对 TS 字面量调用者是编译错误（D1 仅运行时/JS 面）。
 */
import { describe, it } from 'vitest';
import type {
  NamespaceRuntime,
  NamespaceRuntimeReadDataBudgetResult,
  NamespaceRuntimeReadDataOptions,
  NamespaceRuntimeReadDataResult,
} from '@nomicore/namespace-runtime';
import type { ReadLogicalValueAtPathOptions } from '@nomicore/doc-runtime';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type AssertTrue<T extends true> = T;

/** 预算超限失败成员（唯一新码；形状 = ADR 0031 决策 3 五键）。 */
type BudgetExceeded = Extract<NamespaceRuntimeReadDataBudgetResult, { code: 'READ_BUDGET_EXCEEDED' }>;

// —— options 三键闭合形状（runtime 自持宿主；lease 同名别名跟随）——
type _optionsClosedShape = AssertTrue<
  Equal<
    NamespaceRuntimeReadDataOptions,
    { depth?: number; maxChildrenPerNode?: number; maxBytes?: number }
  >
>;
type _optionsKeys = AssertTrue<
  Equal<keyof NamespaceRuntimeReadDataOptions, 'depth' | 'maxChildrenPerNode' | 'maxBytes'>
>;

// —— 新失败分支恰五键（零交付：无成功键）——
type _exceededShape = AssertTrue<
  Equal<
    BudgetExceeded,
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
  Equal<keyof BudgetExceeded, 'ok' | 'code' | 'path' | 'measuredBytes' | 'message'>
>;
type _exceededNoSuccessKeys = AssertTrue<
  Equal<Extract<BudgetExceeded, { value: unknown }>, never>
>;
type _exceededNoSchemaKey = AssertTrue<Equal<Extract<BudgetExceeded, { schema: unknown }>, never>>;
type _exceededNoTruncatedKey = AssertTrue<Equal<Extract<BudgetExceeded, { truncated: unknown }>, never>>;

// —— 零泄漏：legacy 联合结构上不可达预算码与载荷 ——
type _legacyNoBudgetCode = AssertTrue<
  Equal<Extract<NamespaceRuntimeReadDataResult, { code: 'READ_BUDGET_EXCEEDED' }>, never>
>;
type _legacyNoMeasuredBytes = AssertTrue<
  Equal<Extract<NamespaceRuntimeReadDataResult, { measuredBytes: unknown }>, never>
>;

// —— 成功面零变化（恒四键；新分支不污染）——
type _budgetOkKeys = AssertTrue<
  Equal<keyof Extract<NamespaceRuntimeReadDataBudgetResult, { ok: true }>, 'ok' | 'value' | 'schema' | 'truncated'>
>;

// —— 重载序零变化：legacy 恒末签名（`_readAlias`/`_readOverloadOrder` 锚前提）——
type _legacyReturnType = AssertTrue<
  Equal<ReturnType<NamespaceRuntime['readData']>, NamespaceRuntimeReadDataResult>
>;

// —— doc-runtime 零改动硬锁（ADR 0031 决策 4：下传 options 仍两键）——
type _docRuntimeTwoKeys = AssertTrue<
  Equal<keyof ReadLogicalValueAtPathOptions, 'depth' | 'maxChildrenPerNode'>
>;
type _docRuntimeNoMaxBytes = AssertTrue<
  Equal<Extract<ReadLogicalValueAtPathOptions, { maxBytes: unknown }>, never>
>;

// 声明期证明（仅 typecheck 用，零运行时值）。
export type Issue405MaxBytesAssertions = {
  readonly optionsClosedShape: _optionsClosedShape;
  readonly optionsKeys: _optionsKeys;
  readonly exceededShape: _exceededShape;
  readonly exceededKeys: _exceededKeys;
  readonly exceededNoSuccessKeys: _exceededNoSuccessKeys;
  readonly exceededNoSchemaKey: _exceededNoSchemaKey;
  readonly exceededNoTruncatedKey: _exceededNoTruncatedKey;
  readonly legacyNoBudgetCode: _legacyNoBudgetCode;
  readonly legacyNoMeasuredBytes: _legacyNoMeasuredBytes;
  readonly budgetOkKeys: _budgetOkKeys;
  readonly legacyReturnType: _legacyReturnType;
  readonly docRuntimeTwoKeys: _docRuntimeTwoKeys;
  readonly docRuntimeNoMaxBytes: _docRuntimeNoMaxBytes;
};

declare const runtime: NamespaceRuntime;

describe('类型面：readData options 三键闭合形状 + 预算失败分支五键', () => {
  it('三键（含 maxBytes）编译通过；未知第四键与错误值型编译红；预算载荷 measuredBytes 可达', () => {
    const none = runtime.readData([], {});
    const twoAxis = runtime.readData([], { depth: 1, maxChildrenPerNode: 2 });
    const budgeted = runtime.readData([], { depth: 1, maxBytes: 1024 });
    const exceeded: NamespaceRuntimeReadDataBudgetResult = runtime.readData([], { maxBytes: 1 });
    void none;
    void twoAxis;
    void budgeted;
    // @ts-expect-error 闭合形状：未知第四键（excess property）编译红
    runtime.readData([], { depth: 1, nope: 1 });
    // @ts-expect-error maxBytes 值域静态面 = number（string 编译红）
    runtime.readData([], { maxBytes: '100' });
    if (!exceeded.ok && exceeded.code === 'READ_BUDGET_EXCEEDED') {
      const measured: number = exceeded.measuredBytes;
      const message: string = exceeded.message;
      const path: readonly (string | number)[] = exceeded.path;
      void measured;
      void message;
      void path;
      // @ts-expect-error 超限零交付：失败分支不得携带成功键 value
      void exceeded.value;
      // @ts-expect-error 超限零交付：失败分支不得携带成功键 schema
      void exceeded.schema;
    } else {
      throw new Error('前提失败：{maxBytes:1} 的静态结果联合应含 READ_BUDGET_EXCEEDED 成员');
    }
  });

  it('legacy 联合零泄漏：READ_BUDGET_EXCEEDED 与 measuredBytes 在无 options 面结构不可达', () => {
    const legacy: NamespaceRuntimeReadDataResult = runtime.readData([]);
    if (!legacy.ok) {
      // 编译期证明：窄化后的码集不含预算码（Exclude 恒等 ⇒ 码集与预算码不相交）。
      const code: Exclude<typeof legacy.code, 'READ_BUDGET_EXCEEDED'> = legacy.code;
      void code;
      // @ts-expect-error legacy 失败面不得携带预算载荷 measuredBytes
      void legacy.measuredBytes;
    }
  });

  it('EOPT：显式 maxBytes: undefined 对 TS 字面量调用者编译红（D1 仅运行时/JS 调用者可观测）', () => {
    // @ts-expect-error exactOptionalPropertyTypes：undefined 不可赋给 maxBytes?: number
    runtime.readData([], { maxBytes: undefined });
  });
});
