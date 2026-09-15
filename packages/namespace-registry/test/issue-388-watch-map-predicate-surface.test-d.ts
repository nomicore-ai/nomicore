/**
 * issue #388（ADR 0030 T2）类型层契约 —— lease/runtime 公共面 `watchMap` 第三参
 * （谓词 options）与别名 Equal 锁（`*.test-d.ts` 先例 = #369 窗口读 lease surface）。
 *
 * 契约来源：issue #388 AC1/AC2；ADR 0030 §2 谓词词表（`{field, equals}` |
 * `{field, in}`，值域恒标量）/§3 建立判定；SA6 报告 §12.1 绑定 B-1/B-2/B-4/B-8、
 * §12.4 类型契约；设计 §7.5 F-5（命名公式 `Namespace{Runtime,Lease}WatchMap*`——
 * options 袋 + 标量值别名；`where` 联合为模块内部类型，结构可达不经 index 导出）。
 *
 * 类型纪律：
 * - 两包别名经 `src/index.ts` 公共入口可达（ADR 0008 窄读 + registry AGENTS
 *   「公共 API 仅经 src/index.ts」）；
 * - Equal 锁双源对照（lease 别名 ≡ runtime 别名 ≡ 成员第三参）；
 * - 负例 fail-closed：未知算子 / 缺算子 / `field` 非 string / `equals` 非标量 /
 *   `in` 非数组 / `in` 成员非标量 / options 未知键 / `{where: undefined}`
 *   （exactOptionalPropertyTypes 类型面拒——运行时门⑥-a 剥离接受，分层 fail-closed）。
 *   注：**双算子**（`{field, equals, in}`）在 TS 联合字面量 excess-property 语义下不被
 *   类型面捕获（被任一成员结构吸收），其 fail-closed 由运行时门⑥-b 承担（行为契约
 *   E7「双算子」行）；本文件不写会失真的 `@ts-expect-error`。
 *
 * 红灯机理（HEAD `28faeae`）：两包无 `*WatchMapOptions` / `*WatchMapScalarValue`
 * 导出（TS2305）、`watchMap` 第三参不存在（TS2554/excess property）→ 本文件红；
 * 实现后转绿。
 */
import { describe, it } from 'vitest';
import type {
  NamespaceLease,
  NamespaceLeaseWatchMapOptions,
  NamespaceLeaseWatchMapScalarValue,
} from '@nomicore/namespace-registry';
import type {
  NamespaceRuntime,
  NamespaceRuntimeWatchMapOptions,
  NamespaceRuntimeWatchMapScalarValue,
} from '@nomicore/namespace-runtime';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type AssertTrue<T extends true> = T;

// —— 结构推导（B-1：`watchMap(path, listener, options?)`；第三参可省略） ——
type WatchMap = NamespaceLease['watchMap'];
type WatchPath = Parameters<WatchMap>[0];
type WatchListener = Parameters<WatchMap>[1];
type WatchOptions = Parameters<WatchMap>[2];
type WatchHandle = ReturnType<WatchMap>;

// —— B-1 纯加法：两参调用仍编译（尾可选参数加宽）；第三参类型 = options 袋 | undefined ——
type _twoArgCallAccepted = AssertTrue<Equal<[WatchPath, WatchListener] extends Parameters<WatchMap> ? true : false, true>>;
type _thirdParamIsOptions = AssertTrue<Equal<WatchOptions, NamespaceLeaseWatchMapOptions | undefined>>;
type _handleKeys = AssertTrue<Equal<keyof WatchHandle, 'unsubscribe'>>;

// —— B-8 别名 Equal 锁（公式 `Namespace{Runtime,Lease}WatchMap*`；双源对照） ——
type _leaseOptionsIsRuntimeOptions = AssertTrue<
  Equal<NamespaceLeaseWatchMapOptions, NamespaceRuntimeWatchMapOptions>
>;
type _leaseOptionsMemberAlias = AssertTrue<
  Equal<NamespaceLeaseWatchMapOptions, NonNullable<Parameters<NamespaceLease['watchMap']>[2]>>
>;
type _runtimeOptionsMemberAlias = AssertTrue<
  Equal<NamespaceRuntimeWatchMapOptions, NonNullable<Parameters<NamespaceRuntime['watchMap']>[2]>>
>;
type _leaseScalarIsRuntimeScalar = AssertTrue<
  Equal<NamespaceLeaseWatchMapScalarValue, NamespaceRuntimeWatchMapScalarValue>
>;
type _scalarValueDomain = AssertTrue<Equal<NamespaceLeaseWatchMapScalarValue, string | number | boolean>>;

// —— B-2 options 袋封闭形状：键集恰 `['where']`；where 两成员结构可达（窄化） ——
type _optionsKeys = AssertTrue<Equal<keyof NamespaceLeaseWatchMapOptions, 'where'>>;
type _whereNarrowing = AssertTrue<Equal<
  NonNullable<NamespaceLeaseWatchMapOptions['where']> extends infer W
    ? W extends { readonly field: string }
      ? true
      : false
    : false,
  true
>>;

export type WatchMapPredicateSurfaceAssertions = {
  readonly twoArgCallAccepted: _twoArgCallAccepted;
  readonly thirdParamIsOptions: _thirdParamIsOptions;
  readonly handleKeys: _handleKeys;
  readonly leaseOptionsIsRuntimeOptions: _leaseOptionsIsRuntimeOptions;
  readonly leaseOptionsMemberAlias: _leaseOptionsMemberAlias;
  readonly runtimeOptionsMemberAlias: _runtimeOptionsMemberAlias;
  readonly leaseScalarIsRuntimeScalar: _leaseScalarIsRuntimeScalar;
  readonly scalarValueDomain: _scalarValueDomain;
  readonly optionsKeys: _optionsKeys;
  readonly whereNarrowing: _whereNarrowing;
};

declare const lease: NamespaceLease;
declare const runtime: NamespaceRuntime;
declare const where: NonNullable<NamespaceLeaseWatchMapOptions['where']>;

describe('NamespaceLease / NamespaceRuntime 暴露 watchMap 谓词公共面（ADR 0030 §2/§3；B-1/B-2/B-8）', () => {
  it('正例：三参调用（equals / in）编译通过、两参调用兼容、where 两成员判别窄化、句柄恰 {unsubscribe}', () => {
    const equalsHandle = lease.watchMap(
      ['tasks'],
      (notification) => {
        void notification;
      },
      { where: { field: 'status', equals: 'open' } },
    );
    const inHandle = lease.watchMap(
      ['tasks'],
      (notification) => {
        void notification;
      },
      { where: { field: 'status', in: ['open', 'blocked'] } },
    );
    const scalarDomainHandle = runtime.watchMap(
      ['tasks'],
      (notification) => {
        void notification;
      },
      { where: { field: 'priority', in: [1, true, 'x'] } },
    );
    const twoArgHandle = lease.watchMap(['tasks'], () => {});
    const optionsOmitted: NamespaceLeaseWatchMapOptions = {};
    const withOptionsBag = lease.watchMap(['tasks'], () => {}, optionsOmitted);

    const unsubscribe: () => void = equalsHandle.unsubscribe;
    unsubscribe();
    unsubscribe(); // 幂等退订的静态面：重复调用合法
    void inHandle;
    void scalarDomainHandle;
    void twoArgHandle;
    void withOptionsBag;
  });

  it('正例：where 两成员判别窄化（equals / in 各自类型可达）', () => {
    if ('equals' in where) {
      const value: NamespaceLeaseWatchMapScalarValue = where.equals;
      const field: string = where.field;
      void value;
      void field;
    }
    if ('in' in where) {
      const values: readonly NamespaceLeaseWatchMapScalarValue[] = where.in;
      void values;
    }
  });

  it('负例 fail closed：未知算子 / 缺算子 / 非标量算子 / field 非 string / in 非数组 / in 成员非标量 / options 未知键 / present-undefined', () => {
    // @ts-expect-error 未知算子（封闭词表：notEquals 不在 ADR 0030 §2）
    lease.watchMap(['tasks'], () => {}, { where: { field: 'status', notEquals: 'open' } });
    // @ts-expect-error 缺算子（恰一算子必居其一）
    lease.watchMap(['tasks'], () => {}, { where: { field: 'status' } });
    // @ts-expect-error equals 值非标量（值域恒标量 string/number/boolean/字面量）
    lease.watchMap(['tasks'], () => {}, { where: { field: 'status', equals: { bad: true } } });
    // @ts-expect-error field 非 string
    lease.watchMap(['tasks'], () => {}, { where: { field: 1, equals: 'open' } });
    // @ts-expect-error in 非数组
    lease.watchMap(['tasks'], () => {}, { where: { field: 'status', in: 'open' } });
    // @ts-expect-error in 成员非标量
    lease.watchMap(['tasks'], () => {}, { where: { field: 'status', in: [{}] } });
    // @ts-expect-error options 未知键（封闭形状恰 {where?}）
    lease.watchMap(['tasks'], () => {}, { where: { field: 'status', equals: 'open' }, extra: 1 });
    // @ts-expect-error present-undefined 类型面拒（运行时门⑥-a 剥离 ≡ 缺席——分层 fail-closed）
    lease.watchMap(['tasks'], () => {}, { where: undefined });
    // @ts-expect-error options 非对象
    lease.watchMap(['tasks'], () => {}, 'bad-options');
  });
});
