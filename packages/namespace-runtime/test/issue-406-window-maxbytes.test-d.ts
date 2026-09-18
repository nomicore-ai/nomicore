/**
 * issue #406（ADR 0031 窗口面同轴）窗口 `maxBytes` 类型面锚 —— runtime 侧
 * （SA6 §12.2/§12.3 G5 类型侧）。
 *
 * 锚定机制（vitest --typecheck / `tsc -p tsconfig.typecheck.json`）：
 * - **options 六键闭合形状**：`NamespaceRuntimeReadArrayOptions` 精确
 *   `{ n, orderBy?, depth?, maxChildrenPerNode?, where?, maxBytes? }`（runtime 自持宿主；
 *   第七键 → 编译红）；键面同款；
 * - **窗口结果联合追加预算失败成员**：`Extract<…, { code:'READ_BUDGET_EXCEEDED' }>` 恰五键
 *   `{ ok:false, code, path, measuredBytes: number, message }`，零成功键，且与 readData 面
 *   成员**同一形状**（三面同载荷形）；
 * - **doc-runtime 零改动硬锁**（ADR 0031 §4）：`keyof ReadArrayWindowOptions` /
 *   `keyof ReadMapWindowOptions` 恰五键——若 `maxBytes` 被塞进 doc-runtime 类型即编译红；
 * - **成功面零变化**：恒四键（value/schema/truncated/ok）；
 * - **EOPT 语义**：显式 `maxBytes: undefined` 对 TS 字面量调用者是编译错误（D1 仅运行时/JS 面）。
 */
import { describe, it } from 'vitest';
import type {
  NamespaceRuntime,
  NamespaceRuntimeReadArrayOptions,
  NamespaceRuntimeReadArrayResult,
  NamespaceRuntimeReadDataBudgetResult,
  NamespaceRuntimeReadMapOptions,
  NamespaceRuntimeReadMapResult,
} from '@nomicore/namespace-runtime';
import type {
  FieldWindowTerm,
  IndexWindowTerm,
  KeyWindowTerm,
  ReadArrayWindowOptions,
  ReadMapWindowOptions,
  WhereTerm,
} from '@nomicore/doc-runtime';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type AssertTrue<T extends true> = T;

/** 预算超限失败成员（唯一新码；形状 = ADR 0031 决策 3 五键）。 */
type ReadDataExceeded = Extract<NamespaceRuntimeReadDataBudgetResult, { code: 'READ_BUDGET_EXCEEDED' }>;
type ArrayExceeded = Extract<NamespaceRuntimeReadArrayResult, { code: 'READ_BUDGET_EXCEEDED' }>;
type MapExceeded = Extract<NamespaceRuntimeReadMapResult, { code: 'READ_BUDGET_EXCEEDED' }>;

// —— options 六键闭合形状（runtime 自持宿主；doc-runtime 五键面经 Omit 中继）——
type _arrayOptionsClosedShape = AssertTrue<
  Equal<
    NamespaceRuntimeReadArrayOptions,
    {
      n: number;
      orderBy?: IndexWindowTerm;
      depth?: number;
      maxChildrenPerNode?: number;
      where?: readonly WhereTerm[];
      maxBytes?: number;
    }
  >
>;
type _mapOptionsClosedShape = AssertTrue<
  Equal<
    NamespaceRuntimeReadMapOptions,
    {
      n: number;
      orderBy?: KeyWindowTerm | FieldWindowTerm;
      depth?: number;
      maxChildrenPerNode?: number;
      where?: readonly WhereTerm[];
      maxBytes?: number;
    }
  >
>;
type _arrayOptionsKeys = AssertTrue<
  Equal<keyof NamespaceRuntimeReadArrayOptions, 'n' | 'orderBy' | 'depth' | 'maxChildrenPerNode' | 'where' | 'maxBytes'>
>;
type _mapOptionsKeys = AssertTrue<
  Equal<keyof NamespaceRuntimeReadMapOptions, 'n' | 'orderBy' | 'depth' | 'maxChildrenPerNode' | 'where' | 'maxBytes'>
>;
type _arrayOptionsRelay = AssertTrue<Equal<Omit<NamespaceRuntimeReadArrayOptions, 'maxBytes'>, ReadArrayWindowOptions>>;
type _mapOptionsRelay = AssertTrue<Equal<Omit<NamespaceRuntimeReadMapOptions, 'maxBytes'>, ReadMapWindowOptions>>;

// —— 窗口结果联合：预算失败成员恰五键 + 与 readData 面同形 ——
type _arrayExceededFollow = AssertTrue<Equal<ArrayExceeded, ReadDataExceeded>>;
type _mapExceededFollow = AssertTrue<Equal<MapExceeded, ReadDataExceeded>>;
type _exceededShape = AssertTrue<
  Equal<
    ArrayExceeded,
    {
      readonly ok: false;
      readonly code: 'READ_BUDGET_EXCEEDED';
      readonly path: readonly (string | number)[];
      readonly measuredBytes: number;
      readonly message: string;
    }
  >
>;
type _exceededKeys = AssertTrue<Equal<keyof ArrayExceeded, 'ok' | 'code' | 'path' | 'measuredBytes' | 'message'>>;
type _exceededNoSuccessKeys = AssertTrue<Equal<Extract<ArrayExceeded, { value: unknown }>, never>>;
type _exceededNoSchemaKey = AssertTrue<Equal<Extract<ArrayExceeded, { schema: unknown }>, never>>;
type _exceededNoTruncatedKey = AssertTrue<Equal<Extract<ArrayExceeded, { truncated: unknown }>, never>>;

// —— 成功面零变化（恒四键；新分支不污染）——
type _arrayOkKeys = AssertTrue<
  Equal<keyof Extract<NamespaceRuntimeReadArrayResult, { ok: true }>, 'ok' | 'value' | 'schema' | 'truncated'>
>;
type _mapOkKeys = AssertTrue<
  Equal<keyof Extract<NamespaceRuntimeReadMapResult, { ok: true }>, 'ok' | 'value' | 'schema' | 'truncated'>
>;
type _windowFailureCodes = AssertTrue<
  Equal<
    Extract<NamespaceRuntimeReadArrayResult, { ok: false }>['code'],
    'WINDOW_TARGET_ABSENT' | 'WINDOW_CARRIER_MISMATCH' | 'WINDOW_OPTIONS_INVALID' | 'PATH_NOT_ALLOWED' | 'READ_BUDGET_EXCEEDED' | 'RUNTIME_READ_DISABLED'
  >
>;

// —— 方法签名：第二参恒 window options（必填；`maxBytes` 经类型单源跟随）——
type _arrayOptionsParam = AssertTrue<
  Equal<Parameters<NamespaceRuntime['readArray']>[1], NamespaceRuntimeReadArrayOptions>
>;
type _mapOptionsParam = AssertTrue<Equal<Parameters<NamespaceRuntime['readMap']>[1], NamespaceRuntimeReadMapOptions>>;
type _arrayReturn = AssertTrue<Equal<ReturnType<NamespaceRuntime['readArray']>, NamespaceRuntimeReadArrayResult>>;
type _mapReturn = AssertTrue<Equal<ReturnType<NamespaceRuntime['readMap']>, NamespaceRuntimeReadMapResult>>;

// —— doc-runtime 零改动硬锁（ADR 0031 §4）——
type _docRuntimeArrayFiveKeys = AssertTrue<
  Equal<keyof ReadArrayWindowOptions, 'n' | 'orderBy' | 'depth' | 'maxChildrenPerNode' | 'where'>
>;
type _docRuntimeMapFiveKeys = AssertTrue<
  Equal<keyof ReadMapWindowOptions, 'n' | 'orderBy' | 'depth' | 'maxChildrenPerNode' | 'where'>
>;
type _docRuntimeArrayNoMaxBytes = AssertTrue<Equal<Extract<ReadArrayWindowOptions, { maxBytes: unknown }>, never>>;
type _docRuntimeMapNoMaxBytes = AssertTrue<Equal<Extract<ReadMapWindowOptions, { maxBytes: unknown }>, never>>;

// 声明期证明（仅 typecheck 用，零运行时值）。
export type Issue406WindowMaxBytesTypeAssertions = {
  readonly arrayOptionsClosedShape: _arrayOptionsClosedShape;
  readonly mapOptionsClosedShape: _mapOptionsClosedShape;
  readonly arrayOptionsKeys: _arrayOptionsKeys;
  readonly mapOptionsKeys: _mapOptionsKeys;
  readonly arrayOptionsRelay: _arrayOptionsRelay;
  readonly mapOptionsRelay: _mapOptionsRelay;
  readonly arrayExceededFollow: _arrayExceededFollow;
  readonly mapExceededFollow: _mapExceededFollow;
  readonly exceededShape: _exceededShape;
  readonly exceededKeys: _exceededKeys;
  readonly exceededNoSuccessKeys: _exceededNoSuccessKeys;
  readonly exceededNoSchemaKey: _exceededNoSchemaKey;
  readonly exceededNoTruncatedKey: _exceededNoTruncatedKey;
  readonly arrayOkKeys: _arrayOkKeys;
  readonly mapOkKeys: _mapOkKeys;
  readonly windowFailureCodes: _windowFailureCodes;
  readonly arrayOptionsParam: _arrayOptionsParam;
  readonly mapOptionsParam: _mapOptionsParam;
  readonly arrayReturn: _arrayReturn;
  readonly mapReturn: _mapReturn;
  readonly docRuntimeArrayFiveKeys: _docRuntimeArrayFiveKeys;
  readonly docRuntimeMapFiveKeys: _docRuntimeMapFiveKeys;
  readonly docRuntimeArrayNoMaxBytes: _docRuntimeArrayNoMaxBytes;
  readonly docRuntimeMapNoMaxBytes: _docRuntimeMapNoMaxBytes;
};

declare const runtime: NamespaceRuntime;

describe('类型面：窗口 options 六键闭合形状 + 预算失败分支五键', () => {
  it('六键（含 maxBytes）编译通过；未知第七键与错误值型编译红；预算载荷 measuredBytes 可达', () => {
    const arrayBase = runtime.readArray(['items'], { n: 3 });
    const arrayBudgeted = runtime.readArray(['items'], { n: 3, orderBy: { by: 'index', dir: 'desc' }, maxBytes: 1024 });
    const mapBudgeted = runtime.readMap(['itemMap'], {
      n: 2,
      orderBy: { field: 'weight', dir: 'desc' },
      depth: 1,
      maxChildrenPerNode: 2,
      where: [{ field: 'state', equals: 'claimed' }],
      maxBytes: 1024,
    });
    void arrayBase;
    void arrayBudgeted;
    void mapBudgeted;
    // @ts-expect-error 闭合形状：窗口 options 未知第七键（excess property）编译红
    runtime.readArray(['items'], { n: 1, nope: 1 });
    // @ts-expect-error maxBytes 值域静态面 = number（string 编译红）
    runtime.readArray(['items'], { n: 1, maxBytes: '100' });
    // @ts-expect-error n 必填（窗口 options 无缺省）
    runtime.readArray(['items'], { maxBytes: 1024 });
    // @ts-expect-error 键面 where 项形状封闭（未知项键编译红）
    runtime.readMap(['itemMap'], { n: 1, where: [{ field: 'state', nope: 1 }] });
    const exceeded: NamespaceRuntimeReadArrayResult = runtime.readArray(['items'], { n: 3, maxBytes: 1 });
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
      throw new Error('前提失败：{n:3,maxBytes:1} 的静态结果联合应含 READ_BUDGET_EXCEEDED 成员');
    }
  });

  it('EOPT：显式 maxBytes: undefined 对 TS 字面量调用者编译红（D1 仅运行时/JS 调用者可观测）', () => {
    // @ts-expect-error exactOptionalPropertyTypes：undefined 不可赋给 maxBytes?: number
    runtime.readArray(['items'], { n: 3, maxBytes: undefined });
    // @ts-expect-error exactOptionalPropertyTypes：键面同款
    runtime.readMap(['itemMap'], { n: 3, maxBytes: undefined });
  });
});
