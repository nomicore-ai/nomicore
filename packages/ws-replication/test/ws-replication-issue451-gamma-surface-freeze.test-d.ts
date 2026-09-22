/**
 * SA6 验收契约（类型面）— issue #451（γ-T5）：「新公共面 test-d append-only 复核」的编译期冻结。
 *
 * 本文件是 #451 AC2 的可执行面：**复核结论 = 通过** 的判据不是文字，而是下列逐项
 * `expectTypeOf` 与 `@ts-expect-error` 负控在 `vitest --typecheck` +
 * `tsc -p packages/ws-replication/tsconfig.json` 双入口零错误。
 *
 * 复核范围（相对 PR #446 / spec #445 的公共面增量；既有 #447 TD-C1/TD-C2、#420/#421/#422
 * 各 test-d 不动，本文件只补**尚未冻结/复核的增量**）：
 *
 * - ① γ 新公共宿主面 `HubAsyncSessionHost` = **恰一成员 `open`**（发布即冻结；#447 test-d
 *   只锁 `open` 签名，未锁成员集——本文件补 `keyof` 面）；
 * - ② β 冻结面非回退（一阶复核）：`createHubSessionHost` 返回 `HubSessionHost`、
 *   `HubSessionFrameListener` 仍**同步返回 wire 序**（number）——γ 异步面未回灌 β 签名；
 * - ③ #450 追加的 `HubReplicationEdgeOptions.asyncDataAdmissionFatal` = 精确 `true`
 *   （append-only 第 10 可选成员；装配期事实、无运行时布尔语义）；
 * - ④ 负控：γ fire-and-forget 监听者不得冒充 β 同步监听者；`asyncDataAdmissionFatal`
 *   取 `false` 不得通过。负控未被触发即 TS2578 报错（不会静默通过）。
 *
 * 非断言面（属运行期契约，见 `ws-replication-issue451-gamma-observability-anchor.test.ts`）：
 * 观测面发射侧归属与跨线程事件无全序纪律。
 */
import { describe, expectTypeOf, it } from 'vitest';
import {
  NOMICORE_HUB_SESSION_HOST_SERVICE,
  createHubAsyncSessionHost,
  createHubReplicationEdge,
  createHubSessionHost,
} from '@nomicore/ws-replication';
import type {
  HubAsyncSessionFrameListener,
  HubAsyncSessionHost,
  HubReplicationEdgeOptions,
  HubSessionFrameListener,
  HubSessionHost,
  HubSessionHostConfig,
} from '@nomicore/ws-replication';

describe('issue #451 SURFACE — γ 公共面 append-only 复核（类型面）', () => {
  it('① γ 宿主面恰一成员 open；工厂签名逐字冻结', () => {
    expectTypeOf<keyof HubAsyncSessionHost>().toEqualTypeOf<'open'>();
    expectTypeOf(createHubAsyncSessionHost).parameter(0).toEqualTypeOf<HubSessionHostConfig>();
    expectTypeOf(createHubAsyncSessionHost).returns.toEqualTypeOf<HubAsyncSessionHost>();
  });

  it('② β 冻结面非回退：同步返回序签名逐字不变（γ 未回灌 β 面）', () => {
    expectTypeOf(createHubSessionHost).returns.toEqualTypeOf<HubSessionHost>();
    expectTypeOf<HubSessionFrameListener>().returns.toEqualTypeOf<number>();
    expectTypeOf(createHubReplicationEdge).toBeFunction();
    expectTypeOf(NOMICORE_HUB_SESSION_HOST_SERVICE).toEqualTypeOf<'nomicoreHubSessionHost'>();
  });

  it('③ #450 增量成员：asyncDataAdmissionFatal = 精确 true（append-only 可选）', () => {
    expectTypeOf<HubReplicationEdgeOptions['asyncDataAdmissionFatal']>().toEqualTypeOf<
      true | undefined
    >();
  });
});

// ═══════════════════════════ 负控（未被触发即 TS2578 红） ═══════════════════════════

declare const baseEdgeOptions: HubReplicationEdgeOptions;

// ④-a γ fire-and-forget 监听者（void 返回）不得冒充 β 同步返回序监听者。
const gammaListener: HubAsyncSessionFrameListener = (_frame) => undefined;
// @ts-expect-error γ 异步监听者不得赋给 β 同步 listener（void ≠ number）
const betaFromGamma: HubSessionFrameListener = gammaListener;
void betaFromGamma;

// ④-b 装配标记取 `false` 不得通过（非布尔开关——精确 true）。
const falseMarker = { ...baseEdgeOptions, asyncDataAdmissionFatal: false };
// @ts-expect-error asyncDataAdmissionFatal 只接受精确 true（false 不是合法装配标记）
const wrongMarker: HubReplicationEdgeOptions = falseMarker;
void wrongMarker;
