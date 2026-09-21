/**
 * `@nomicore/ws-replication` 公共入口（公共契约面：值 + 类型，零逻辑；规范权威
 * protocol §17/§18 + ADR-0010 #161/#172 修订节）。
 */
export { createHubReplication } from './hub-connection.js';
export { createHubSessionHost } from './hub-session-host.js';
export { createPeerReplication } from './peer-connection.js';
// issue #421（spec #415 T4；ADR 0032:41 后果节）：连接级半边的宿主公共工厂——普通工厂、
// 非 Cordis 插件、无 Registry 依赖（append-only 新增；既有 11 个运行时导出零改名零删除）。
export { createHubReplicationEdge } from './hub-edge-host.js';
export {
  NOMICORE_HUB_REPLICATION_SERVICE,
  NOMICORE_PEER_REPLICATION_SERVICE,
  createHubReplicationPlugin,
  createPeerReplicationPlugin,
  requireHubReplication,
  requirePeerReplication,
} from './plugin.js';
export {
  DEFAULT_REPLICATION_BACKOFF,
  DEFAULT_REPLICATION_LIMITS,
  DEFAULT_REPLICATION_TIMEOUTS,
} from './defaults.js';

export type {
  HubListenAdapter,
  HubListener,
  HubReplicationPluginConfig,
  HubReplicationPluginOverrides,
  HubReplicationService,
  HubReplicationStatus,
  HubStaticAuthorization,
  HubStaticToken,
  PeerDialAdapterFactory,
  PeerDialAdapterFactoryOptions,
  PeerReplicationPluginConfig,
  PeerReplicationPluginOverrides,
  PeerReplicationService,
  PeerReplicationStatus,
} from './plugin.js';

export type {
  ChunkedUpdateAbortReason,
  DuplexTransport,
  HubConnection,
  HubConnectionState,
  HubNamespaceState,
  HubReplication,
  HubReplicationOptions,
  HubUpgradeRequest,
  NamespaceAuthorization,
  NamespaceAuthorizer,
  PeerConnectionState,
  PeerNamespaceState,
  PeerReplication,
  PeerReplicationOptions,
  PeerTokenVerifier,
  ReplicationBackoff,
  ReplicationClock,
  ReplicationLimits,
  ReplicationNamespaceFailedCause,
  ReplicationObserver,
  ReplicationObserverConnectionCode,
  ReplicationObserverEvent,
  ReplicationObserverNamespaceCode,
  ReplicationObserverSchemaRearmCode,
  ReplicationObserverSide,
  ReplicationSendFailureReason,
  ReplicationTarget,
  ReplicationTimer,
  ReplicationTimeouts,
  UpgradeIdentity,
} from './types.js';

// issue #421：edge 公共工厂的类型面（发布即冻结 append-only；`ReplicationMessage` 不转出口
// ——宿主 sink 实现可结构化推导，转出口反而扩大冻结面，设计 §7-D2 类型来源声明）。
export type {
  HubNamespaceSessionSink,
  HubOpenNamespaceMessage,
  HubReplicationEdgeConnection,
  HubReplicationEdgeEgress,
  HubReplicationEdgeFactory,
  HubReplicationEdgeOptions,
  HubSessionSinkResolver,
  NamespaceAuthorizationGrant,
} from './hub-edge-host.js';
export type {
  HubSessionFrameLane,
  HubSessionFrameListener,
  HubSessionHandle,
  HubSessionHost,
  HubSessionHostConfig,
  HubSessionOpenInput,
  HubSessionSignal,
} from './hub-session-host.js';
