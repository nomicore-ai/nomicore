/**
 * issue #447 — γ 异步缝公共面**类型冻结**（TD-C1）与 β 冻结面非回退证明（TD-C2）。
 *
 * TD-C1（append-only 新公共面）：工厂签名 / 句柄六成员 / 消息键集（`frame{tag,bytes,lane}`、
 * `receipt{tag,sequence}`）逐项锁定；负控（`@ts-expect-error` 四项，未被触发即 TS2578 红）：
 *   ① γ 异步出站监听者（void 返回）赋给 β `HubSessionFrameListener`（number 返回）不得通过；
 *   ② γ 工厂配置缺必填 `registry` 不得通过；
 *   ③ `lane` 非法字面量不得通过；
 *   ④ `handleReceipt` 缺参调用不得通过。
 *
 * TD-C2（β 非回退）：既有 15 值导出与 `HubSessionHost`/`HubSessionHandle`/`HubSessionSignal`/
 * `HubSessionFrameListener` 逐字类型不变（append-only 证明；与 #420/#421/#422 test-d 同款负控）。
 *
 * 本文件由 `vitest --typecheck`（`tsconfig.typecheck.json`）与
 * `tsc -p packages/ws-replication/tsconfig.json` 双面发现。
 */
import { expectTypeOf } from 'vitest';
import type { NamespaceAuthorization } from '@nomicore/ws-replication';
import {
  DEFAULT_REPLICATION_BACKOFF,
  DEFAULT_REPLICATION_LIMITS,
  DEFAULT_REPLICATION_TIMEOUTS,
  NOMICORE_HUB_REPLICATION_SERVICE,
  NOMICORE_HUB_SESSION_HOST_SERVICE,
  NOMICORE_PEER_REPLICATION_SERVICE,
  createHubAsyncSessionHost,
  createHubReplication,
  createHubReplicationEdge,
  createHubReplicationPlugin,
  createHubSessionHost,
  createPeerReplication,
  createPeerReplicationPlugin,
  requireHubReplication,
  requireHubSessionHost,
  requirePeerReplication,
  type HubAsyncSessionFrame,
  type HubAsyncSessionFrameListener,
  type HubAsyncSessionHandle,
  type HubAsyncSessionHost,
  type HubAsyncSessionReceipt,
  type HubSessionFrameLane,
  type HubSessionFrameListener,
  type HubSessionHandle,
  type HubSessionHost,
  type HubSessionHostConfig,
  type HubSessionOpenInput,
  type HubSessionSignal,
} from '@nomicore/ws-replication';

// ═══════════════════════════ TD-C1：γ 工厂 / 句柄 / 消息键集 ═══════════════════════════

expectTypeOf(createHubAsyncSessionHost).toEqualTypeOf<
  (config: HubSessionHostConfig) => HubAsyncSessionHost
>();
expectTypeOf(createHubAsyncSessionHost).parameter(0).toMatchTypeOf<HubSessionHostConfig>();
expectTypeOf(createHubAsyncSessionHost).returns.toEqualTypeOf<HubAsyncSessionHost>();

expectTypeOf<HubAsyncSessionHost['open']>().parameter(0).toEqualTypeOf<HubSessionOpenInput>();
expectTypeOf<HubAsyncSessionHost['open']>().returns.toEqualTypeOf<HubAsyncSessionHandle>();

// 句柄成员逐项（六成员：控制/回执/出站 sink/信号/终止/关闭）。
expectTypeOf<keyof HubAsyncSessionHandle>().toEqualTypeOf<
  'handleFrame' | 'handleReceipt' | 'onFrame' | 'onSignal' | 'terminateUnauthorized' | 'close'
>();
expectTypeOf<HubAsyncSessionHandle['handleFrame']>().parameter(0).toEqualTypeOf<Uint8Array>();
expectTypeOf<HubAsyncSessionHandle['handleFrame']>().returns.toEqualTypeOf<void>();
expectTypeOf<HubAsyncSessionHandle['handleReceipt']>()
  .parameter(0)
  .toEqualTypeOf<number>();
expectTypeOf<HubAsyncSessionHandle['handleReceipt']>()
  .parameter(1)
  .toEqualTypeOf<number>();
expectTypeOf<HubAsyncSessionHandle['handleReceipt']>().returns.toEqualTypeOf<void>();
expectTypeOf<HubAsyncSessionHandle['onFrame']>()
  .parameter(0)
  .toEqualTypeOf<HubAsyncSessionFrameListener>();
expectTypeOf<HubAsyncSessionHandle['onFrame']>().returns.toEqualTypeOf<() => void>();
expectTypeOf<HubAsyncSessionHandle['onSignal']>()
  .parameter(0)
  .toEqualTypeOf<(signal: HubSessionSignal) => void>();
expectTypeOf<HubAsyncSessionHandle['close']>().returns.toEqualTypeOf<Promise<void>>();
expectTypeOf<HubAsyncSessionHandle['terminateUnauthorized']>().returns.toEqualTypeOf<Promise<void>>();

// 缝消息键集（§24.3 逐字）：frame{tag,bytes,lane} / receipt{tag,sequence}。
expectTypeOf<HubAsyncSessionFrame>().toEqualTypeOf<{
  readonly tag: number;
  readonly bytes: Uint8Array;
  readonly lane: HubSessionFrameLane;
}>();
expectTypeOf<HubAsyncSessionReceipt>().toEqualTypeOf<{
  readonly tag: number;
  readonly sequence: number;
}>();
// 出站 sink = fire-and-forget（**无同步序号契约**——与 β 的 number 返回签名结构性不同）。
expectTypeOf<HubAsyncSessionFrameListener>().parameters.toEqualTypeOf<[HubAsyncSessionFrame]>();
expectTypeOf<HubAsyncSessionFrameListener>().returns.toEqualTypeOf<void>();

// ═══════════════════════════ TD-C2：β 冻结面非回退（append-only 证明） ═══════════════════════════

expectTypeOf(createHubSessionHost).toEqualTypeOf<
  (config: HubSessionHostConfig) => HubSessionHost
>();
expectTypeOf<HubSessionHost['open']>().parameter(0).toEqualTypeOf<HubSessionOpenInput>();
expectTypeOf<HubSessionHost['open']>().returns.toEqualTypeOf<HubSessionHandle>();
expectTypeOf<keyof HubSessionHandle>().toEqualTypeOf<
  'handleFrame' | 'onFrame' | 'onSignal' | 'terminateUnauthorized' | 'close'
>();
// β 同步签名逐字冻结：监听者**同步返回 wire 序**（A1/A4.1；γ 不得回灌此面）。
expectTypeOf<HubSessionFrameListener>().parameters.toEqualTypeOf<
  [frame: Uint8Array, lane: HubSessionFrameLane]
>();
expectTypeOf<HubSessionFrameListener>().returns.toEqualTypeOf<number>();
expectTypeOf<HubSessionFrameLane>().toEqualTypeOf<'control' | 'data'>();
expectTypeOf<HubSessionSignal>().toEqualTypeOf<
  | { readonly type: 'settled'; readonly namespaceId: string }
  | { readonly type: 'connection-fatal'; readonly code: string }
>();
// 既有 15 值导出逐项仍在（typeof 面）。
expectTypeOf(createHubReplication).toBeFunction();
expectTypeOf(createHubReplicationEdge).toBeFunction();
expectTypeOf(createHubReplicationPlugin).toBeFunction();
expectTypeOf(createPeerReplication).toBeFunction();
expectTypeOf(createPeerReplicationPlugin).toBeFunction();
expectTypeOf(requireHubReplication).toBeFunction();
expectTypeOf(requireHubSessionHost).toBeFunction();
expectTypeOf(requirePeerReplication).toBeFunction();
expectTypeOf(NOMICORE_HUB_REPLICATION_SERVICE).toEqualTypeOf<'nomicoreHubReplication'>();
expectTypeOf(NOMICORE_HUB_SESSION_HOST_SERVICE).toEqualTypeOf<'nomicoreHubSessionHost'>();
expectTypeOf(NOMICORE_PEER_REPLICATION_SERVICE).toEqualTypeOf<'nomicorePeerReplication'>();
expectTypeOf(DEFAULT_REPLICATION_LIMITS).toMatchTypeOf<import('@nomicore/ws-replication').ReplicationLimits>();
expectTypeOf(DEFAULT_REPLICATION_TIMEOUTS).toMatchTypeOf<
  import('@nomicore/ws-replication').ReplicationTimeouts
>();
expectTypeOf(DEFAULT_REPLICATION_BACKOFF).toMatchTypeOf<
  import('@nomicore/ws-replication').ReplicationBackoff
>();

// ═══════════════════════════ 负控（@ts-expect-error 必填；未被触发即红） ═══════════════════════════

declare const registry: HubSessionHostConfig['registry'];
declare const limits: HubSessionHostConfig['limits'];
declare const timeouts: HubSessionHostConfig['timeouts'];
declare const timer: HubSessionHostConfig['timer'];
declare const asyncHandle: HubAsyncSessionHandle;
declare const betaListener: HubSessionFrameListener;

// ① γ 异步监听者（void 返回）不得赋给 β 同步监听者（number 返回）——两态载体结构性不可互换。
const asyncListener: HubAsyncSessionFrameListener = (_frame) => undefined;
// @ts-expect-error γ fire-and-forget 监听者不得冒充 β 同步返回序的监听者（void ≠ number）
const wrongDirection: HubSessionFrameListener = asyncListener;
void wrongDirection;

// 反向亦然：β 同步监听者（缺序返回）不得赋给 γ 监听者（返回 void 的签名不接受 number 返回？）。
const betaArrow: HubSessionFrameListener = (_frame, _lane) => 0;
// @ts-expect-error β 同步监听者的签名（多参 + number 返回）不得赋给 γ 单参 void 监听者
const wrongDirection2: HubAsyncSessionFrameListener = betaArrow;
void wrongDirection2;

// ② γ 工厂配置缺必填 registry 不得通过。
// @ts-expect-error registry 必填（宿主本进程内事实）
const missingRegistry: HubSessionHostConfig = {
  instanceId: 'hub-1',
  limits,
  timeouts,
  timer,
};
void missingRegistry;

// ③ lane 只能取 §24.3 词汇表允许的两个形态。
const badLane: HubAsyncSessionFrame = {
  tag: 1,
  bytes: new Uint8Array(),
  // @ts-expect-error lane 非法字面量（闭集合 'control' | 'data'）
  lane: 'data-plane',
};
void badLane;

// ④ handleReceipt 缺参调用不得通过（签名按简报逐字双参）。
// @ts-expect-error 缺 sequence 实参
asyncHandle.handleReceipt(1);
// @ts-expect-error sequence 必须为 number
asyncHandle.handleReceipt(1, '2');

// ⑤ γ 句柄不得出现 accepting/rejection 面（A4.6：回执 ≠ 接纳信号）。
// @ts-expect-error 句柄无 handleAccept/onAccepted 成员
void asyncHandle.handleAccepted;
// @ts-expect-error 句柄无 sendControlFrame 成员（发送面只在 port/sink 内部）
void asyncHandle.sendControlFrame;

declare const grant: Extract<NamespaceAuthorization, { ok: true }>;
void grant;
void registry;
void betaListener;
