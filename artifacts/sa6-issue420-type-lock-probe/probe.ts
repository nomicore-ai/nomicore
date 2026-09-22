/**
 * SA6 issue #420 —— AC1 类型层冻结契约的**红灯证据**（当前实现必须在此失败）。
 *
 * 该片段就是「SessionHost 公共工厂」test-d 锁定的目标形态（逐字契约见 SA6 报告 §12.1）。
 * 现在：`createHubSessionHost` 未从包公共入口导出 ⟹ tsc 必然报 TS2305/TS2724。
 * 实现票落地后：同一片段必须零错误通过（= 目标绿灯）。
 */
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
import type { NamespaceRegistry } from '@nomicore/namespace-registry';

declare const registry: NamespaceRegistry;

const config: HubSessionHostConfig = {
  registry,
  instanceId: 'hub-omega',
  limits: {} as HubSessionHostConfig['limits'],
  timeouts: {} as HubSessionHostConfig['timeouts'],
  timer: { setTimeout: () => undefined, clearTimeout: () => undefined },
};

const host: HubSessionHost = createHubSessionHost(config);

const input: HubSessionOpenInput = {
  connectionKey: 'conn-key-1',
  remoteInstanceId: 'peer-omega',
  namespaceId: `ns-${'0'.repeat(31)}a`,
  authorization: {
    ok: true,
    localOwner: { userId: 'hub-owner-9f38' },
    permissions: { read: true, submit: true },
  },
  selectedCapabilities: 0,
  connectionId: 'hub-omega-conn-0',
};

const handle: HubSessionHandle = host.open(input);
handle.handleFrame(new Uint8Array([1, 2, 3]));
const lane: HubSessionFrameLane = 'data';
const listener: HubSessionFrameListener = (frame, frameLane) => (frame.byteLength > 0 ? 1 : 0);
void listener;
void lane;
const unsubscribe: () => void = handle.onFrame((frame) => frame.byteLength);
void unsubscribe;
const signalSink = (signal: HubSessionSignal): void => {
  if (signal.type === 'settled') void signal.namespaceId;
  else void signal.code;
};
void signalSink;
void handle.close();

// ── 负控（目标形态必须编译失败；实现后这些 @ts-expect-error 必须被真正触发） ──
// @ts-expect-error  deny 投影不得进入描述子（未授权 OPEN 不过缝：ADR 0032 决策 3）
const deniedInput: HubSessionOpenInput = { ...input, authorization: { ok: false } };
void deniedInput;
// @ts-expect-error  工厂配置不得携带授权器/传输/缝 port（authorize 不在 session 侧调用）
createHubSessionHost({ ...config, authorize: () => undefined });
// @ts-expect-error  句柄无 namespaceFrame（已解码消息面不属于公共字节缝）
handle.namespaceFrame({}, 1);
// @ts-expect-error  onFrame 监听器必须返回被分配的 wire 序（number）
handle.onFrame(() => undefined);
