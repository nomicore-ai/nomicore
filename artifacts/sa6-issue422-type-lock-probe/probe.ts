/**
 * SA6 issue #422 —— AC1 类型层冻结契约的**红灯证据**（当前实现必须在此失败）。
 *
 * 本片段就是「`listen: false` 免 listen 模式 + `nomicoreHubSessionHost` 服务」test-d 锁定的
 * 目标形态（逐字契约见 SA6 报告 §12.1/§12.2）。HEAD 上：
 *   - `HubReplicationPluginConfig['listen']` 不含 `false` ⇒ `{ listen: false }` 类型错；
 *   - 包公共入口无 `NOMICORE_HUB_SESSION_HOST_SERVICE` / `requireHubSessionHost` /
 *     `HubSessionHostService` / `HubSessionHostStatus` ⇒ TS2305/TS2724。
 * 实现票落地后：同一片段必须零错误通过（= 目标绿灯），且三处 `@ts-expect-error`
 * 负控全部被触发（未被触发即 TS2578 报错）。
 */
import {
  createHubReplicationPlugin,
  requireHubSessionHost,
  NOMICORE_HUB_SESSION_HOST_SERVICE,
  type HubSessionHandle,
  type HubSessionHost,
  type HubReplicationPluginConfig,
  type HubSessionHostService,
  type HubSessionHostStatus,
} from '@nomicore/ws-replication';

declare const ctx: Parameters<typeof requireHubSessionHost>[0];

// ── 正向：配置联合接受显式 false（免 listen 模式）与既有 listen 设置（listen 模式） ──
const noListenConfig: HubReplicationPluginConfig = { listen: false };
const listenConfig: HubReplicationPluginConfig = { listen: { host: '127.0.0.1', port: 0 } };
const noListenPlugin = createHubReplicationPlugin(noListenConfig, {});
const listenPlugin = createHubReplicationPlugin(listenConfig, {
  listen: { listen: async () => ({ close: async () => undefined }) },
  tokens: [],
  authorization: [],
});
void noListenPlugin;
void listenPlugin;

// ── 正向：服务名常量 + require 助手 + 服务面（含 #420 冻结的 HubSessionHost 面） ──
const serviceName: 'nomicoreHubSessionHost' = NOMICORE_HUB_SESSION_HOST_SERVICE;
void serviceName;
const service: HubSessionHostService = requireHubSessionHost(ctx);
const factoryFace: HubSessionHost = service;
void factoryFace;
const status: HubSessionHostStatus = service.status;
const state: 'ready' | 'stopped' = status.state;
const sessions: number = status.sessions;
void state;
void sessions;
const stopResult: Promise<void> = service.stop();
void stopResult;
const handle: HubSessionHandle = service.open({
  connectionKey: 'conn-1',
  remoteInstanceId: 'peer-one',
  namespaceId: `ns-${'1'.repeat(32)}`,
  authorization: { ok: true, localOwner: { userId: 'owner' }, permissions: { read: true, submit: true } },
  selectedCapabilities: 0,
});
void handle;
// 模块增强：ctx.get 也解析为服务（Cordis 服务面）。
const viaGet = ctx.get('nomicoreHubSessionHost');
const viaGetTyped: HubSessionHostService | undefined = viaGet;
void viaGetTyped;

// ── 负控 1：listen 只接受对象设置或精确布尔 false（伪值/拼写变体必须类型错） ──
// @ts-expect-error listen 不接受字符串形式的伪值
const badString: HubReplicationPluginConfig = { listen: 'false' };
void badString;
// @ts-expect-error listen 不接受数字 0（falsy 陷阱）
const badZero: HubReplicationPluginConfig = { listen: 0 };
void badZero;
// @ts-expect-error listen 不接受 null
const badNull: HubReplicationPluginConfig = { listen: null };
void badNull;
// @ts-expect-error listen 不接受 undefined（缺省 ≠ 免 listen）
const badUndefined: HubReplicationPluginConfig = { listen: undefined };
void badUndefined;
// @ts-expect-error listen 设置对象不含拼写变体键
const badNested: HubReplicationPluginConfig = { listen: { host: '127.0.0.1', port: 0, lisen: false } };
void badNested;

// ── 负控 2：服务面不得混入 nomicoreHubReplication 的成员（两入口并存属非法形态） ──
// @ts-expect-error HubSessionHostService 无 requestReauth（连接级半边职责）
service.requestReauth('peer-one');
// @ts-expect-error status.state 是 'ready' | 'stopped' 闭联合（不接受任意字符串）
const badState: HubSessionHostStatus['state'] = 'running';
void badState;
