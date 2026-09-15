/**
 * issue #383（ADR 0029 缝 2）类型层契约 —— lease 窗口 options `where` 透传与结果别名锁
 * （SA6 §12.3.7 Y1/Y4/Y5；SA8 A4 单源别名链 + Equal 锁不动、`WhereTerm` 不作具名再导出）。
 *
 * 契约：
 * - lease options 别名 ≡ runtime options 别名（单源链 lease → runtime → doc-runtime；零复制）；
 * - lease 结果别名 = runtime 结果别名 | `NamespaceLeaseReleasedIssue`（Equal 锁保持）；
 * - 成功成员 `keyof` 恰 `'ok'|'value'|'schema'|'truncated'`（恒四键、无第五键）；
 * - Y5 事实：`WhereTerm` **未**自 runtime / registry 公共面具名再导出（实现票不补；调用方
 *   需要具名类型时直依 `@nomicore/doc-runtime`——本文件以 `@ts-expect-error` + TS2694 锁定）。
 *
 * 类型面在 HEAD 即绿（缺口不在类型面，SA6 §6 N5）——本票义务是锁边界而非造红。
 */
import { describe, it } from 'vitest';
import type { WhereTerm } from '@nomicore/doc-runtime';
import type {
  NamespaceLease,
  NamespaceLeaseReadArrayOptions,
  NamespaceLeaseReadArrayResult,
  NamespaceLeaseReadMapOptions,
  NamespaceLeaseReadMapResult,
  NamespaceLeaseReleasedIssue,
} from '@nomicore/namespace-registry';
import type {
  NamespaceRuntimeReadArrayOptions,
  NamespaceRuntimeReadArrayResult,
  NamespaceRuntimeReadMapOptions,
  NamespaceRuntimeReadMapResult,
} from '@nomicore/namespace-runtime';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type AssertTrue<T extends true> = T;

type LeaseReadArrayOk = Extract<NamespaceLeaseReadArrayResult, { ok: true }>;
type LeaseReadMapOk = Extract<NamespaceLeaseReadMapResult, { ok: true }>;

// —— Y1 lease options 单源别名（零复制第二份） ——
type _leaseArrayOptionsSingleSource = AssertTrue<Equal<NamespaceLeaseReadArrayOptions, NamespaceRuntimeReadArrayOptions>>;
type _leaseMapOptionsSingleSource = AssertTrue<Equal<NamespaceLeaseReadMapOptions, NamespaceRuntimeReadMapOptions>>;
type _leaseArrayWhereAxis = AssertTrue<Equal<NamespaceLeaseReadArrayOptions['where'], readonly WhereTerm[] | undefined>>;
type _leaseMapWhereAxis = AssertTrue<Equal<NamespaceLeaseReadMapOptions['where'], readonly WhereTerm[] | undefined>>;

// —— Y4 结果别名跟随 + 成功恒四键 ——
type _leaseArrayAlias = AssertTrue<
  Equal<NamespaceLeaseReadArrayResult, NamespaceRuntimeReadArrayResult | NamespaceLeaseReleasedIssue>
>;
type _leaseMapAlias = AssertTrue<
  Equal<NamespaceLeaseReadMapResult, NamespaceRuntimeReadMapResult | NamespaceLeaseReleasedIssue>
>;
type _leaseArraySuccessKeys = AssertTrue<Equal<keyof LeaseReadArrayOk, 'ok' | 'value' | 'schema' | 'truncated'>>;
type _leaseMapSuccessKeys = AssertTrue<Equal<keyof LeaseReadMapOk, 'ok' | 'value' | 'schema' | 'truncated'>>;

// —— 签名形状（第二参必填、无重载；options 面 raw 直传） ——
type _leaseArraySignature = AssertTrue<
  Equal<
    NamespaceLease['readArray'],
    (path: readonly (string | number)[], options: NamespaceLeaseReadArrayOptions) => NamespaceLeaseReadArrayResult
  >
>;
type _leaseMapSignature = AssertTrue<
  Equal<
    NamespaceLease['readMap'],
    (path: readonly (string | number)[], options: NamespaceLeaseReadMapOptions) => NamespaceLeaseReadMapResult
  >
>;

// —— Y5 事实：WhereTerm 未自 runtime / registry 公共面具名再导出（TS2694） ——
// @ts-expect-error WhereTerm 未自 @nomicore/namespace-runtime 具名再导出（需具名时直依 doc-runtime）
import type { WhereTerm as WhereTermFromRuntime } from '@nomicore/namespace-runtime';
// @ts-expect-error WhereTerm 未自 @nomicore/namespace-registry 具名再导出
import type { WhereTerm as WhereTermFromRegistry } from '@nomicore/namespace-registry';

export type LeaseWhereTypeGuardAssertions = {
  readonly leaseArrayOptionsSingleSource: _leaseArrayOptionsSingleSource;
  readonly leaseMapOptionsSingleSource: _leaseMapOptionsSingleSource;
  readonly leaseArrayWhereAxis: _leaseArrayWhereAxis;
  readonly leaseMapWhereAxis: _leaseMapWhereAxis;
  readonly leaseArrayAlias: _leaseArrayAlias;
  readonly leaseMapAlias: _leaseMapAlias;
  readonly leaseArraySuccessKeys: _leaseArraySuccessKeys;
  readonly leaseMapSuccessKeys: _leaseMapSuccessKeys;
  readonly leaseArraySignature: _leaseArraySignature;
  readonly leaseMapSignature: _leaseMapSignature;
};

declare const lease: NamespaceLease;

describe('issue #383 lease 窗口 options where 类型透传与冻结面（ADR 0029 §2；ADR 0009 代理面）', () => {
  it('Y1 正例：lease 两方法直传 where（含 as const 只读数组）编译通过', () => {
    const map = lease.readMap(['tasks'], { n: 2, where: [{ field: 'state', equals: 'claimed' }] });
    void map;
    const array = lease.readArray(['taskList'], {
      n: 1,
      where: [{ field: 'title', equals: 'alpha' }],
      orderBy: { by: 'index', dir: 'desc' },
    });
    void array;
    const readonlyTerms = [{ field: 'priority', equals: 5 }] as const;
    const viaReadonly: NamespaceLeaseReadMapResult = lease.readMap(['tasks'], { n: 1, where: readonlyTerms });
    void viaReadonly;
    // 闭集 falsy 标量（'' / false / 0 / null）与 release 后短路面同型 options。
    const falsy: NamespaceLeaseReadMapOptions = { n: 1, where: [{ field: 'state', equals: null }] };
    void falsy;
  });

  it('Y2/Y4 负例 fail closed：缺第二参、跨面 orderBy、where 形状、readData 边界', () => {
    // @ts-expect-error 第二参必填（窗口读无重载）
    lease.readMap(['tasks']);
    // @ts-expect-error readArray 不收 by:'key'
    lease.readArray(['taskList'], { n: 1, orderBy: { by: 'key' } });
    // @ts-expect-error readMap 不收 by:'index'
    lease.readMap(['tasks'], { n: 1, orderBy: { by: 'index' } });
    // @ts-expect-error where 必须是 WhereTerm 数组
    lease.readMap(['tasks'], { n: 1, where: { field: 'state', equals: 'claimed' } });
    // @ts-expect-error where 元素未知键
    lease.readMap(['tasks'], { n: 1, where: [{ field: 'state', equals: 'claimed', extra: 1 }] });
    // @ts-expect-error equals 非标量闭集
    lease.readMap(['tasks'], { n: 1, where: [{ field: 'state', equals: {} }] });
    // @ts-expect-error readData options 闭合形状不含 where（F1 冻结面）
    lease.readData(['tasks'], { where: [{ field: 'state', equals: 'claimed' }] });
  });

  it('Y5 事实：WhereTerm 具名导入两侧均不可得（上方 @ts-expect-error 即断言）', () => {
    // 具名类型通道 = 直依 doc-runtime 公共面（既有且冻结）。
    const term: WhereTerm = { field: 'state', equals: 'claimed' };
    void term;
    void (null as unknown as WhereTermFromRuntime | undefined);
    void (null as unknown as WhereTermFromRegistry | undefined);
  });
});
