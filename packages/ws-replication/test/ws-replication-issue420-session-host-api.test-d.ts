/**
 * issue #420 AC1 —— SessionHost 公共面**类型冻结**（SA6 §12.1 逐字冻结声明；设计 §7 D1）。
 *
 * 正向：工厂签名/句柄成员/描述子字段/信号联合逐项等于冻结声明。
 * 负控（`@ts-expect-error` 四项，未被触发即 TS2578 红——自证敏感性）：
 *   ① `authorization: { ok: false }` 不得通过（denied 不过公共缝）；
 *   ② 工厂配置掺 `authorize`/`transport`/`port` 键不得通过（authorize 不在 session 侧调用）；
 *   ③ 句柄的已解码消息面（`namespaceFrame(...)`）不得存在；
 *   ④ `onFrame(() => undefined)`（无 number 返回）不得通过。
 *
 * 本文件由 `vitest --typecheck`（`tsconfig.typecheck.json`）与
 * `tsc -p packages/ws-replication/tsconfig.json` 双面发现。
 */
import { expectTypeOf } from 'vitest';
import type { NamespaceAuthorization } from '@nomicore/ws-replication';
import {
  createHubSessionHost,
  type HubSessionFrameLane,
  type HubSessionFrameListener,
  type HubSessionHandle,
  type HubSessionHost,
  type HubSessionHostConfig,
  type HubSessionOpenInput,
  type HubSessionSignal,
} from '@nomicore/ws-replication';

// ═══════════════════════════ 正向：冻结签名逐项 ═══════════════════════════

expectTypeOf(createHubSessionHost).parameter(0).toMatchTypeOf<HubSessionHostConfig>();
expectTypeOf(createHubSessionHost).returns.toMatchTypeOf<HubSessionHost>();

expectTypeOf<HubSessionHost['open']>().parameter(0).toMatchTypeOf<HubSessionOpenInput>();
expectTypeOf<HubSessionHost['open']>().returns.toMatchTypeOf<HubSessionHandle>();

expectTypeOf<HubSessionHandle['handleFrame']>().parameter(0).toEqualTypeOf<Uint8Array>();
expectTypeOf<HubSessionHandle['handleFrame']>().returns.toEqualTypeOf<void>();
expectTypeOf<HubSessionHandle['onFrame']>().parameter(0).toEqualTypeOf<HubSessionFrameListener>();
expectTypeOf<HubSessionHandle['onFrame']>().returns.toEqualTypeOf<() => void>();
expectTypeOf<HubSessionHandle['onSignal']>()
  .parameter(0)
  .toEqualTypeOf<(signal: HubSessionSignal) => void>();
expectTypeOf<HubSessionHandle['onSignal']>().returns.toEqualTypeOf<() => void>();
expectTypeOf<HubSessionHandle['close']>().returns.toEqualTypeOf<Promise<void>>();
expectTypeOf<HubSessionHandle['terminateUnauthorized']>().returns.toEqualTypeOf<Promise<void>>();

expectTypeOf<HubSessionFrameListener>().parameter(0).toEqualTypeOf<Uint8Array>();
expectTypeOf<HubSessionFrameListener>().parameter(1).toEqualTypeOf<HubSessionFrameLane>();
expectTypeOf<HubSessionFrameListener>().returns.toEqualTypeOf<number>();
expectTypeOf<HubSessionFrameLane>().toEqualTypeOf<'control' | 'data'>();

expectTypeOf<HubSessionOpenInput['authorization']>().toEqualTypeOf<
  Extract<NamespaceAuthorization, { ok: true }>
>();
expectTypeOf<HubSessionOpenInput['connectionId']>().toEqualTypeOf<string | undefined>();
expectTypeOf<HubSessionOpenInput['connectionKey']>().toEqualTypeOf<string>();
expectTypeOf<HubSessionOpenInput['remoteInstanceId']>().toEqualTypeOf<string>();
expectTypeOf<HubSessionOpenInput['namespaceId']>().toEqualTypeOf<string>();
expectTypeOf<HubSessionOpenInput['selectedCapabilities']>().toEqualTypeOf<number>();

expectTypeOf<HubSessionHostConfig['observer']>().toEqualTypeOf<
  import('@nomicore/ws-replication').ReplicationObserver | undefined
>();
expectTypeOf<HubSessionSignal>().toEqualTypeOf<
  | { readonly type: 'settled'; readonly namespaceId: string }
  | { readonly type: 'connection-fatal'; readonly code: string }
>();

// ═══════════════════════════ 负控（@ts-expect-error 必填） ═══════════════════════════

declare const registry: HubSessionHostConfig['registry'];
declare const limits: HubSessionHostConfig['limits'];
declare const timeouts: HubSessionHostConfig['timeouts'];
declare const timer: HubSessionHostConfig['timer'];
declare const handle: HubSessionHandle;

// ① denied 不过缝：`authorization` 只接受 edge 已结算 ok-投影。
const deniedOpenInput: HubSessionOpenInput = {
  connectionKey: 'conn-1',
  remoteInstanceId: 'peer-1',
  namespaceId: 'ns-1',
  // @ts-expect-error denied 投影不得过公共缝（仅 ok-投影）
  authorization: { ok: false },
  selectedCapabilities: 0,
};
void deniedOpenInput;

// ② 工厂配置不得含 authorize（authorize 不在 session 侧调用）。
const configWithAuthorize: HubSessionHostConfig = {
  registry,
  instanceId: 'hub-1',
  limits,
  timeouts,
  timer,
  // @ts-expect-error 工厂配置不得含 authorize
  authorize: async () => ({ ok: false }),
};
void configWithAuthorize;

// ② 工厂配置不得含 transport（传输面不在 session 侧）。
const configWithTransport: HubSessionHostConfig = {
  registry,
  instanceId: 'hub-1',
  limits,
  timeouts,
  timer,
  // @ts-expect-error 工厂配置不得含 transport
  transport: {},
};
void configWithTransport;

// ② 工厂配置不得含缝 port（缝面整组不出现在公共配置）。
const configWithPort: HubSessionHostConfig = {
  registry,
  instanceId: 'hub-1',
  limits,
  timeouts,
  timer,
  // @ts-expect-error 工厂配置不得含缝 port
  port: {},
};
void configWithPort;

// ③ 句柄的已解码消息面不得存在（公共面只有字节入帧）。
// @ts-expect-error 句柄不得暴露已解码消息面 namespaceFrame
handle.namespaceFrame({ kind: 'OPEN_NAMESPACE', namespaceId: 'ns-1', hasLocalReplica: false }, 1);

// ④ 出站 sink 必须返回被分配 wire 序（number）。
// @ts-expect-error onFrame 监听者必须返回 number
handle.onFrame(() => undefined);

void createHubSessionHost;
