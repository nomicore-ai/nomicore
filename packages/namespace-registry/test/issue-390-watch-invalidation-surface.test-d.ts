/**
 * issue #390（ADR 0030 T4）类型层契约 —— testing 容量注入字段在场、`invalidate-all`
 * 两键形状、公共面零容量泄漏负锚。
 *
 * 契约来源：issue #390 AC1/AC2/AC5；ADR 0030 §4（`invalidate-all` 恰两键 `{kind,origin}`）
 * / §6（有界队列：数值不进公共契约——语义进契约，数值是构造参数 + 实现默认）/ 验收缝
 * L94（testing 工厂注入小上限）；`wiki/raw/task_issue-390_sa6_contract.md` §12.1 B-1/B-3、
 * §12.5-8（字段在场断言 + 负例敏感度）。
 *
 * 红灯机理（HEAD `28faeae`）：`NamespaceRegistryTestingOverrides` 无 `watchQueueCapacity`
 * 成员 → 索引访问 TS2339、正例对象字面量 TS2353（SA6 类型探针同构）；实现后本文件转绿。
 *
 * 类型纪律：注入字段名 = B-1 冻结绑定（`watchQueueCapacity`，唯一在场断言），其余类型
 * 全部结构推导（不引用未冻结别名名）；公共面负锚证明数值不泄漏进主入口/lease 面。
 */
import { describe, it } from 'vitest';
import type { CreateNamespaceRegistryOptions, NamespaceLease } from '@nomicore/namespace-registry';
import type * as MainEntry from '@nomicore/namespace-registry';
import type { NamespaceRegistryTestingOverrides } from '@nomicore/namespace-registry/testing';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type AssertTrue<T extends true> = T;

// ── 绑定 B-1（承重）：testing overrides 加法字段在场、类型为 number ──
type WatchQueueCapacity = NamespaceRegistryTestingOverrides['watchQueueCapacity'];
type _injectionFieldPresent = AssertTrue<Equal<WatchQueueCapacity, number | undefined>>;
type _injectionFieldIsNumber = AssertTrue<Equal<NonNullable<WatchQueueCapacity>, number>>;

// ── AC1：数值不进公共契约——生产入口构造选项零容量成员 ──
type _productionEntryNoCapacity = AssertTrue<
  Equal<'watchQueueCapacity' extends keyof CreateNamespaceRegistryOptions ? true : false, false>
>;
// ── AC1/A8：lease 公共面零容量成员（16 键面） ──
type _leaseNoCapacity = AssertTrue<
  Equal<'watchQueueCapacity' extends keyof NamespaceLease ? true : false, false>
>;
// ── AC5：注入控件只在显式 testing 子路径——主入口零 re-export ──
type _testingOverridesNotOnMainEntry = AssertTrue<
  Equal<
    'NamespaceRegistryTestingOverrides' extends keyof typeof MainEntry ? true : false,
    false
  >
>;

// ── 绑定 B-3：`invalidate-all` 恰两键 `{kind,origin}`；无 reason/changes/version/rev ──
type WatchNotification = Parameters<Parameters<NamespaceLease['watchMap']>[1]>[0];
type InvalidateAll = Extract<WatchNotification, { kind: 'invalidate-all' }>;
type _invalidateAllKeys = AssertTrue<Equal<keyof InvalidateAll, 'kind' | 'origin'>>;
type _invalidateAllKind = AssertTrue<Equal<InvalidateAll['kind'], 'invalidate-all'>>;
type _invalidateAllOrigin = AssertTrue<Equal<InvalidateAll['origin'], 'local' | 'replication'>>;
type _invalidateAllNoReason = AssertTrue<
  Equal<'reason' extends keyof InvalidateAll ? true : false, false>
>;
type _invalidateAllNoChanges = AssertTrue<
  Equal<'changes' extends keyof InvalidateAll ? true : false, false>
>;
type _invalidateAllNoVersion = AssertTrue<
  Equal<'version' extends keyof InvalidateAll ? true : false, false>
>;
type _invalidateAllNoRev = AssertTrue<Equal<'rev' extends keyof InvalidateAll ? true : false, false>>;

export type WatchInvalidationSurfaceAssertions = {
  readonly injectionFieldPresent: _injectionFieldPresent;
  readonly injectionFieldIsNumber: _injectionFieldIsNumber;
  readonly productionEntryNoCapacity: _productionEntryNoCapacity;
  readonly leaseNoCapacity: _leaseNoCapacity;
  readonly testingOverridesNotOnMainEntry: _testingOverridesNotOnMainEntry;
  readonly invalidateAllKeys: _invalidateAllKeys;
  readonly invalidateAllKind: _invalidateAllKind;
  readonly invalidateAllOrigin: _invalidateAllOrigin;
  readonly invalidateAllNoReason: _invalidateAllNoReason;
  readonly invalidateAllNoChanges: _invalidateAllNoChanges;
  readonly invalidateAllNoVersion: _invalidateAllNoVersion;
  readonly invalidateAllNoRev: _invalidateAllNoRev;
};

declare const overrides: NamespaceRegistryTestingOverrides;
declare const lease: NamespaceLease;

describe('testing overrides 容量注入字段（B-1；AC1/AC5）', () => {
  it('正例：容量字段在场、正整数注入被类型系统接受、既有必需字段共存', () => {
    const accepted: NamespaceRegistryTestingOverrides = {
      ...overrides,
      watchQueueCapacity: 1,
    };
    void accepted;
  });

  it('负例 fail closed：非 number 注入被类型系统拒绝', () => {
    // @ts-expect-error 容量必须是 number（string 注入 fail closed；D5 构造期门）
    const wrongType: NamespaceRegistryTestingOverrides = { ...overrides, watchQueueCapacity: '1' };
    void wrongType;
  });
});

describe('invalidate-all 形状与公共面零泄漏（B-3/A8）', () => {
  it('正例：三 kind 窄化后 invalidate-all 只读两键 {kind,origin}', () => {
    lease.watchMap(['tasks'], (notification) => {
      if (notification.kind === 'invalidate-all') {
        const kind: 'invalidate-all' = notification.kind;
        const origin: 'local' | 'replication' = notification.origin;
        void kind;
        void origin;
      }
    });
  });
});
