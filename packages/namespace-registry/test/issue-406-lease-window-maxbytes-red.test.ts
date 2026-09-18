/**
 * issue #406（ADR 0031 窗口面同轴）registry `lease.readArray` / `lease.readMap` 的
 * `maxBytes` 面 —— lease 透传 + 别名跟随行为契约（SA6 §12.2/§12.3 G9 行为侧）。
 *
 * 红灯机理（HEAD）：lease 与 runtime 同因 `maxBytes` 未知键拒绝（`WINDOW_OPTIONS_INVALID`），
 * 收侧断言与 `READ_BUDGET_EXCEEDED` 拒侧断言全红；released 短路与无预算回归锚在 HEAD 即绿
 * 且实现后必须保持。
 *
 * 契约面：
 * 1. 真实装配（生产 runtimeFactory 路径）：lease 预算读与同 doc 直调 runtime **逐字段相等**
 *    （收 / 拒两侧同载荷；`measuredBytes` 逐字相同）——含 where 与 `schema:null` 锚；
 * 2. released 短路先于一切透传（冻结三键；敌意 options 零触达）；
 * 3. 无预算窗口读 lease ≡ runtime（回归锚；HEAD 即绿）。
 */
import { describe, expect, it } from 'vitest';
import type { NamespaceLease } from '@nomicore/namespace-registry';
import type { NamespaceRuntime } from '@nomicore/namespace-runtime';
import {
  asArrayOptions,
  asMapOptions,
  budgetMessageTemplate,
  expectBudgetFailure,
  expectWindowOkKeys,
  measureWindowChannels,
  readWindowAnchor,
  WINDOW_ANCHORS_406,
  windowAnchorById,
  type Window406Anchor,
  type Window406OkShape,
} from '../../namespace-runtime/test/issue-406-window-maxbytes-fixture.js';
import { makeWindow406Pair } from './issue-406-window-maxbytes-lease-fixture.js';

// ── 装置 helper ─────────────────────────────────────────────────────────────────────

/** 保底选项引用（released 面 options 触达计数的载体）。 */
function optionsFor(anchor: Window406Anchor, maxBytes: number): Record<string, unknown> {
  return { ...anchor.options, maxBytes };
}

function leaseReadArray(lease: NamespaceLease, anchor: Window406Anchor, maxBytes: number): unknown {
  return lease.readArray(anchor.path, asArrayOptions(optionsFor(anchor, maxBytes)));
}

function leaseReadMap(lease: NamespaceLease, anchor: Window406Anchor, maxBytes: number): unknown {
  return lease.readMap(anchor.path, asMapOptions(optionsFor(anchor, maxBytes)));
}

function runtimeReadArray(runtime: NamespaceRuntime, anchor: Window406Anchor, maxBytes: number): unknown {
  return runtime.readArray(anchor.path, asArrayOptions(optionsFor(anchor, maxBytes)));
}

function runtimeReadMap(runtime: NamespaceRuntime, anchor: Window406Anchor, maxBytes: number): unknown {
  return runtime.readMap(anchor.path, asMapOptions(optionsFor(anchor, maxBytes)));
}

// ── G9 行为：lease ≡ runtime（真装配、同 doc）────────────────────────────────────────

describe('G9 lease 预算读 ≡ 同 doc 直调 runtime（真装配）', () => {
  it('G9 收侧：lease 与 runtime 逐字段相等（含 where / desc / schema:null 锚）+ 恒四键', async () => {
    const { runtime, lease } = await makeWindow406Pair();
    for (const id of ['WA0', 'WA1', 'WA4', 'WA7', 'WM1', 'WM2', 'WM5', 'WM8'] as const) {
      const anchor = windowAnchorById(id);
      const oracle = readWindowAnchor(runtime, anchor);
      const viaLease = anchor.face === 'array'
        ? leaseReadArray(lease, anchor, anchor.total)
        : leaseReadMap(lease, anchor, anchor.total);
      const direct = anchor.face === 'array'
        ? runtimeReadArray(runtime, anchor, anchor.total)
        : runtimeReadMap(runtime, anchor, anchor.total);
      expect(viaLease, `G9/${id}：lease ≡ runtime 直调`).toStrictEqual(direct);
      expect(viaLease, `G9/${id}：≤ 预算交付物 ≡ 无预算读`).toStrictEqual<Window406OkShape>(oracle);
      expectWindowOkKeys(viaLease as object);
    }
    await lease.release();
  });

  it('G9 拒侧：lease 与 runtime 同载荷（READ_BUDGET_EXCEEDED + measuredBytes 逐字相同）', async () => {
    const { runtime, lease } = await makeWindow406Pair();
    for (const id of ['WA1', 'WA4', 'WA7', 'WM1', 'WM5', 'WM8'] as const) {
      const anchor = windowAnchorById(id);
      const oracle = readWindowAnchor(runtime, anchor);
      const oracleBytes = measureWindowChannels(oracle.value, oracle.schema);
      const viaLease = anchor.face === 'array'
        ? leaseReadArray(lease, anchor, anchor.total - 1)
        : leaseReadMap(lease, anchor, anchor.total - 1);
      const direct = anchor.face === 'array'
        ? runtimeReadArray(runtime, anchor, anchor.total - 1)
        : runtimeReadMap(runtime, anchor, anchor.total - 1);
      expect(viaLease, `G9/${id}：lease ≡ runtime 同载荷`).toStrictEqual(direct);
      const failure = expectBudgetFailure(viaLease, oracleBytes.total, `G9/${id}`);
      expect(failure.message, `G9/${id}：三面同文模板`).toBe(budgetMessageTemplate(oracleBytes.total, anchor.total - 1));
    }
    await lease.release();
  });

  it('G9 released 短路先于一切透传：敌意 options 零触达、冻结三键', async () => {
    const { lease } = await makeWindow406Pair();
    await lease.release();
    let getCalls = 0;
    const hostile = new Proxy({ n: 3, maxBytes: 1 }, {
      get() {
        getCalls += 1;
        throw new Error('probe: get trap');
      },
    });
    const arrayResult = lease.readArray(windowAnchorById('WA1').path, hostile as never);
    expect(arrayResult.ok, 'G9/released：失败分支').toBe(false);
    expect((arrayResult as { code: string }).code, 'G9/released：冻结码').toBe('NAMESPACE_LEASE_RELEASED');
    expect(Object.keys(arrayResult).sort(), 'G9/released：冻结三键').toStrictEqual(['code', 'message', 'ok']);
    const mapResult = lease.readMap(windowAnchorById('WM1').path, hostile as never);
    expect((mapResult as { code: string }).code, 'G9/released：键面同款').toBe('NAMESPACE_LEASE_RELEASED');
    expect(getCalls, 'G9/released：options 零 [[Get]]（短路先于透传）').toBe(0);
  });

  it('G9 无预算回归：lease 与 runtime 全 18 锚逐字段相等（HEAD 即绿）', async () => {
    const { runtime, lease } = await makeWindow406Pair();
    for (const anchor of WINDOW_ANCHORS_406) {
      const viaLease = anchor.face === 'array'
        ? lease.readArray(anchor.path, asArrayOptions(anchor.options))
        : lease.readMap(anchor.path, asMapOptions(anchor.options));
      const direct = anchor.face === 'array'
        ? runtime.readArray(anchor.path, asArrayOptions(anchor.options))
        : runtime.readMap(anchor.path, asMapOptions(anchor.options));
      expect(viaLease, `G9/回归 ${anchor.id}：lease ≡ runtime`).toStrictEqual(direct);
      expect(viaLease, `G9/回归 ${anchor.id}：≡ 冻结锚 oracle`).toStrictEqual<Window406OkShape>(readWindowAnchor(runtime, anchor));
    }
    await lease.release();
  });
});
