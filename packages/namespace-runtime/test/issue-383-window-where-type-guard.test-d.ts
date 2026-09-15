/**
 * issue #383（ADR 0029 缝 2）类型层契约 —— runtime 窗口 options `where` 的收/拒边界与
 * 冻结面（SA6 §12.3.7 Y1/Y2/Y3/Y6；SA8 A4 单源别名链 + Equal 锁不动）。
 *
 * 契约（绑定 B-2/B-14；ADR 0029 §2 词表 + §1 恒四键）：
 * - `NamespaceRuntimeReadArrayOptions` / `NamespaceRuntimeReadMapOptions` 仍是 doc-runtime
 *   单源 type-only 别名（零复制）；
 * - `where?: readonly WhereTerm[]` 经既有别名链到达 runtime 公共面；正向：`{n, where:[…]}`
 *   与 `as const` 只读数组编译通过（Y1）；
 * - 负向 fail-closed（Y2）：`where` 非数组、项未知键、`equals` 非标量闭集 / 缺失、
 *   `field` 缺失、跨面 `orderBy`、`dir` 词表外、`readData` 带 `where` 全部真报错；
 * - **不得**写成编译期负例（Y3；否则 TS2578 伪红）：同面 `{by:'key', field:'x'}`
 *   （联合 excess 不报错 → 运行时 `WINDOW_OPTIONS_INVALID`）、`equals: NaN`、`where: []`
 *   ——三者的运行时行为由 `issue-383-window-where-composition-red.test.ts` Z 组承载；
 * - 冻结面（Y6）：`WindowFailureCode` 恰四枚；`RuntimeReadDisabledResult` 恰四键。
 *
 * 类型面在 HEAD 即绿（单源别名链已透传 `where`，SA6 §6 N5 探针 exit 0）——本票类型面义务是
 * **锁边界**而非造红。
 */
import { describe, it } from 'vitest';
import type {
  ReadArrayWindowOptions,
  ReadMapWindowOptions,
  WindowFailureCode,
  WhereTerm,
} from '@nomicore/doc-runtime';
import type {
  NamespaceRuntime,
  NamespaceRuntimeReadArrayOptions,
  NamespaceRuntimeReadArrayResult,
  NamespaceRuntimeReadMapOptions,
  NamespaceRuntimeReadMapResult,
  RuntimeReadDisabledResult,
} from '@nomicore/namespace-runtime';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type AssertTrue<T extends true> = T;

type ReadArrayOk = Extract<NamespaceRuntimeReadArrayResult, { ok: true }>;
type ReadMapOk = Extract<NamespaceRuntimeReadMapResult, { ok: true }>;

// —— Y1 options 单源别名（doc-runtime type-only；零复制第二份） ——
type _arrayOptionsSingleSource = AssertTrue<Equal<NamespaceRuntimeReadArrayOptions, ReadArrayWindowOptions>>;
type _mapOptionsSingleSource = AssertTrue<Equal<NamespaceRuntimeReadMapOptions, ReadMapWindowOptions>>;
type _arrayWhereAxis = AssertTrue<Equal<NamespaceRuntimeReadArrayOptions['where'], readonly WhereTerm[] | undefined>>;
type _mapWhereAxis = AssertTrue<Equal<NamespaceRuntimeReadMapOptions['where'], readonly WhereTerm[] | undefined>>;
// WhereTerm v1 形状（ADR 0029 §2；string | number(finite 由运行时判) | boolean | null）——
// 类型面锁形状、运行时锁 finite（Z6 equals NaN/±Infinity）。
type _whereTermShape = AssertTrue<Equal<WhereTerm, { field: string; equals: string | number | boolean | null }>>;

// —— Y4/Y6 成功与失败形状冻结（无第五键、无新码） ——
type _arraySuccessKeys = AssertTrue<Equal<keyof ReadArrayOk, 'ok' | 'value' | 'schema' | 'truncated'>>;
type _mapSuccessKeys = AssertTrue<Equal<keyof ReadMapOk, 'ok' | 'value' | 'schema' | 'truncated'>>;
type _failureCodes = AssertTrue<
  Equal<WindowFailureCode, 'WINDOW_TARGET_ABSENT' | 'WINDOW_CARRIER_MISMATCH' | 'WINDOW_OPTIONS_INVALID' | 'PATH_NOT_ALLOWED'>
>;
type _readDisabledKeys = AssertTrue<Equal<keyof RuntimeReadDisabledResult, 'ok' | 'code' | 'path' | 'message'>>;

export type WindowWhereTypeGuardAssertions = {
  readonly arrayOptionsSingleSource: _arrayOptionsSingleSource;
  readonly mapOptionsSingleSource: _mapOptionsSingleSource;
  readonly arrayWhereAxis: _arrayWhereAxis;
  readonly mapWhereAxis: _mapWhereAxis;
  readonly whereTermShape: _whereTermShape;
  readonly arraySuccessKeys: _arraySuccessKeys;
  readonly mapSuccessKeys: _mapSuccessKeys;
  readonly failureCodes: _failureCodes;
  readonly readDisabledKeys: _readDisabledKeys;
};

declare const runtime: NamespaceRuntime;

describe('issue #383 runtime 窗口 options where 类型边界（ADR 0029 §2/§6）', () => {
  it('Y1 正例：where 直传 + as const 只读数组 + 与其他轴共存编译通过', () => {
    const array = runtime.readArray(['taskList'], { n: 2, where: [{ field: 'state', equals: 'claimed' }] });
    void array;
    const map = runtime.readMap(['tasks'], {
      n: 2,
      where: [{ field: 'state', equals: 'claimed' }, { field: 'priority', equals: 5 }],
      orderBy: { field: 'priority', dir: 'desc' },
      depth: 1,
      maxChildrenPerNode: 2,
    });
    void map;

    const readonlyTerms = [{ field: 'state', equals: 'claimed' }] as const;
    const viaReadonly: NamespaceRuntimeReadMapResult = runtime.readMap(['tasks'], { n: 1, where: readonlyTerms });
    void viaReadonly;
    // 闭集含 falsy 标量（string '' / boolean false / number 0 / null）与空串 field。
    const falsy: NamespaceRuntimeReadArrayOptions = {
      n: 1,
      where: [{ field: '', equals: '' }, { field: 'flag', equals: false }, { field: 'count', equals: 0 }, { field: 'state', equals: null }],
    };
    void falsy;
  });

  it('Y3 非负例（编译期接受、运行时响亮拒绝）：同面 excess 联合 / equals NaN / 空数组', () => {
    // 同面 `{by:'key', field:'x'}`：联合 excess 不报错（写成编译期负例即 TS2578 伪红）——
    // 运行时由 Z/S 组以 `WINDOW_OPTIONS_INVALID` 拒绝（S3 镜像 + W1 权威同判据）。
    const sameFaceExcess = { n: 1, orderBy: { by: 'key' as const, field: 'x' } };
    const viaExcess: NamespaceRuntimeReadMapResult = runtime.readMap(['tasks'], sameFaceExcess);
    void viaExcess;
    // equals NaN / ±Infinity：类型面 number，finite 门在运行时（ADR 0029 §2）。
    const viaNaN: NamespaceRuntimeReadMapResult = runtime.readMap(['tasks'], {
      n: 1,
      where: [{ field: 'state', equals: Number.NaN }],
    });
    void viaNaN;
    // 空数组：类型面 readonly WhereTerm[]，非空判据在运行时。
    const viaEmpty: NamespaceRuntimeReadMapResult = runtime.readMap(['tasks'], { n: 1, where: [] });
    void viaEmpty;
  });

  it('Y2 负例 fail closed：where 形状、equals/field 闭集、跨面 orderBy、dir 词表、readData 边界', () => {
    // @ts-expect-error where 必须是 WhereTerm 数组（非数组）
    runtime.readMap(['tasks'], { n: 1, where: 'claimed' });
    // @ts-expect-error where 元素不得含未知键（封闭形状恰 field/equals）
    runtime.readMap(['tasks'], { n: 1, where: [{ field: 'state', equals: 'claimed', extra: 1 }] });
    // @ts-expect-error equals 非标量闭集（对象）
    runtime.readMap(['tasks'], { n: 1, where: [{ field: 'state', equals: { x: 1 } }] });
    // @ts-expect-error equals 非标量闭集（数组）
    runtime.readMap(['tasks'], { n: 1, where: [{ field: 'state', equals: [] }] });
    // @ts-expect-error equals 非标量闭集（undefined）
    runtime.readMap(['tasks'], { n: 1, where: [{ field: 'state', equals: undefined }] });
    // @ts-expect-error equals 必填（缺失）
    runtime.readMap(['tasks'], { n: 1, where: [{ field: 'state' }] });
    // @ts-expect-error field 必填（缺失）
    runtime.readMap(['tasks'], { n: 1, where: [{ equals: 'claimed' }] });
    // @ts-expect-error field 必须为 string（零强制转换）
    runtime.readMap(['tasks'], { n: 1, where: [{ field: 7, equals: 'claimed' }] });
    // @ts-expect-error readArray 不收 by:'key'（面词表）
    runtime.readArray(['taskList'], { n: 1, orderBy: { by: 'key' } });
    // @ts-expect-error readArray 不收 field（面词表）
    runtime.readArray(['taskList'], { n: 1, orderBy: { field: 'x' } });
    // @ts-expect-error readMap 不收 by:'index'（面词表）
    runtime.readMap(['tasks'], { n: 1, orderBy: { by: 'index' } });
    // @ts-expect-error dir 词表恰 asc|desc
    runtime.readMap(['tasks'], { n: 1, orderBy: { field: 'priority', dir: 'up' } });
    // @ts-expect-error readData options 闭合形状不含 where（F1 冻结面）
    runtime.readData(['tasks'], { where: [{ field: 'state', equals: 'claimed' }] });
    // @ts-expect-error 第二参必填（窗口读无重载）
    runtime.readMap(['tasks']);
  });
});
