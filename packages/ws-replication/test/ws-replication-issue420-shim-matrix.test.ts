/**
 * issue #420 AC3 —— 现有 hub-namespace 测试矩阵在 shim 装配上重跑（机制 (a)：`vi.mock` 仅替换
 * `createHubReplication` + 动态 import 七个矩阵文件；SA6 §12.3、设计 §7 D8）。
 *
 * 硬门（AC3）：
 * - 7 个矩阵文件**零编辑**，同一批 describe/it 断言体在 shim 装配下第二次注册/执行；
 * - 反空跑：shim 必须自证真的走了 shim（探针计数 + 缝内非 OPEN 帧序非 0 + 生产信号面在场）；
 * - 零 fork：`hub-namespace.ts`/`hub-edge.ts` 零 diff（由 diff 门与结构测试族承载，本文件
 *   只提供「同一断言体在替换工厂下全绿」的运行时证据）；
 * - 同 run `collectUnhandledRejections()` 为空（覆盖桥路由续体的零无承载 reject 面）。
 *
 * 声明序 = 执行序：七个矩阵文件的 describe 经顶部动态 import 注册，末位 describe（反空跑）
 * 在所有矩阵用例之后运行。
 */
import { afterAll, describe, expect, it, vi } from 'vitest';
import type {
  HubReplication,
  HubReplicationOptions,
} from '@nomicore/ws-replication';
import { createShimHubForTesting, shimHubRuns } from './issue420-shim-hub.js';
import { collectUnhandledRejections } from './driver.js';
import { settle } from './harness.js';

const unhandled = collectUnhandledRejections();

// mock 工厂：仅替换 `createHubReplication`（其余真面经 importOriginal 展开——ac7 值导入
// `createPeerReplication` 保持真值）。夹具只深路径 import ⇒ 工厂内不会递归取到 mock 自身。
vi.mock('@nomicore/ws-replication', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nomicore/ws-replication')>();
  const { createShimHubForTesting: makeShim } = await import('./issue420-shim-hub.js');
  return {
    ...actual,
    createHubReplication: (options: HubReplicationOptions): HubReplication =>
      makeShim(options).replication,
  };
});

// ── 七个矩阵文件（断言体逐字不变；同一 runner/同一 driver，仅 hub 工厂换为 shim） ──
await import('./ws-replication-ac1-ac2-open.test.js');
await import('./ws-replication-ac3-bootstrap.test.js');
await import('./ws-replication-ac4-reconcile.test.js');
await import('./ws-replication-ac5-live.test.js');
await import('./ws-replication-ac6-resync-close.test.js');
await import('./ws-replication-ac7-faults.test.js');
await import('./ws-replication-periodic-reconcile.test.js');

describe('@420 AC3 反空跑：shim 臂必须真的走了 shim 装配（非 listen 空转）', () => {
  it('反空跑：连接/会话/缝帧/拒绝路由计数 + 缝内非 OPEN 序非 0 + 生产信号面在场', () => {
    // M4 负控（交付说明实跑）：关闭替换（指回 listen 工厂）时本用例必红——首个断言即空集合。
    expect(shimHubRuns.length).toBeGreaterThanOrEqual(1);
    const probes = shimHubRuns.map((shim) => shim.probes);
    const sum = (pick: (probe: (typeof probes)[number]) => number): number =>
      probes.reduce((total, probe) => total + pick(probe), 0);
    const connectionsOpened = sum((probe) => probe.connectionsOpened);
    const sessionsOpened = sum((probe) => probe.sessionsOpened);
    const seamIn = probes.flatMap((probe) => probe.seamFramesIn);
    const seamOut = probes.flatMap((probe) => probe.seamFramesOut);
    const signals = probes.flatMap((probe) => probe.signals);

    expect(connectionsOpened).toBeGreaterThanOrEqual(2); // 7 矩阵含重连/多 ns 场景
    expect(sessionsOpened).toBeGreaterThanOrEqual(2);
    expect(seamIn.length).toBeGreaterThanOrEqual(20);
    expect(seamOut.length).toBeGreaterThanOrEqual(20);
    const nonOpenIn = seamIn.filter((frame) => frame.kind !== 'OPEN_NAMESPACE');
    expect(nonOpenIn.length).toBeGreaterThanOrEqual(10);
    for (const frame of nonOpenIn) expect(frame.sequence).toBeGreaterThan(0); // 无 0 占位泄漏
    expect(sum((probe) => probe.denialRouted)).toBeGreaterThanOrEqual(1); // ac1-ac2 deny 族
    expect(sum((probe) => probe.reopenForwarded)).toBeGreaterThanOrEqual(1); // :245 再 OPEN 转发分支
    expect(sum((probe) => probe.pendingFlushed)).toBeGreaterThanOrEqual(1); // :231 在途 OPEN 入窗→冲刷
    expect(sum((probe) => probe.pendingOverflow)).toBe(0);
    // 公共句柄每 (连接, ns) 恰 1：重复 open() 会被工厂前置 throw 并被续体兜底为
    // INTERNAL_ERROR 连接致命——矩阵全程必须零 INTERNAL_ERROR。
    const fatalCodes = signals
      .filter((signal) => signal.type === 'connection-fatal')
      .map((signal) => signal.code);
    expect(fatalCodes).not.toContain('INTERNAL_ERROR');
    // 生产信号面在场：`settled`（edge drain 提前完成判据）必须经 onSignal 到达 edge；
    // 且全 run 零 INTERNAL_ERROR（重复 open()/续体异常的红臂签名——connection-fatal 通路的
    // 正控在回合测试 A12 红臂中锁定）。
    expect(signals.filter((signal) => signal.type === 'settled').length).toBeGreaterThanOrEqual(1);
    expect(fatalCodes).not.toContain('INTERNAL_ERROR');
    expect(sum((probe) => probe.carrierCommitted)).toBeGreaterThanOrEqual(1); // ac7 在途帧载体提交
  });
});

afterAll(async () => {
  await settle();
  const events = [...unhandled.events];
  unhandled.dispose();
  // AC3/RA6'(iii)：同 run 零 unhandled rejection（桥路由续体 E10 面）。
  expect(events).toEqual([]);
});
