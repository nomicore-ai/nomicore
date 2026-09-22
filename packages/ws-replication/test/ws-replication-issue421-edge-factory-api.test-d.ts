/**
 * SA6 红灯验收契约（类型面）— issue #421（spec #415 T4）：Edge 公共工厂出面。
 *
 * 契约锚点：ADR 0032 决策 1–5（两半边拆分 / 缝纪律 / authorize 在 edge / 路由键与 ERROR
 * mini-decode / 观测纪律）+ `wiki/raw/task_issue-421_sa6_contract.md` §12.1（EF-C1/EF-C2）
 * 与 §12.0/§13（交付路径与红/绿证据）+ 设计 §7-D7（连接句柄公共面与 `channels` 显式裁决）、
 * §8.1（工厂、配置与双入口签名）、§7-D2（sink/egress 缝与类型来源声明）。
 *
 * 覆盖条目：
 * - **EF-C1**：`createHubReplicationEdge` 从包公共入口（`src/index.ts`）解析为
 *   `(options: HubReplicationEdgeOptions) => HubReplicationEdgeFactory`；负控 = 既有
 *   `createHubReplication` / `createPeerReplication` / `createHubReplicationPlugin` /
 *   `requirePeerReplication` 仍在且既有类型不变（append-only，只增不减）。
 * - **EF-C2**：工厂 `accept(transport, request?)` / `acceptTrusted(transport, identity)`
 *   参数与返回句柄签名；`HubReplicationEdgeOptions` 九成员（`verifyToken` 可选性经
 *   **无该键的对象字面量** `satisfies` 证明）；`HubSessionSinkResolver` /
 *   `NamespaceAuthorizationGrant` / `HubOpenNamespaceMessage`（来源 = 协议包 Extract）；
 *   `HubNamespaceSessionSink` 四成员、`HubReplicationEdgeConnection` 十成员 + D7 裁决
 *   （句柄**不**暴露 `channels`，替代观测面 = `namespaces`）、`HubReplicationEdgeEgress`
 *   五成员——全部逐成员 `expectTypeOf` 精确锁定，零 cast。
 *
 * 红灯条件（实现前必须失败）：HEAD 上 `@nomicore/ws-replication` 无
 * `createHubReplicationEdge` 导出 → `vitest --typecheck` 报 `TypeCheckError`（TS2724，
 * `Did you mean 'createHubReplication'?`）+ `tsc -p packages/ws-replication/tsconfig.json`
 * 同一条错误（SA6 §14 §4/§4c 实测红）。本文件是**纯编译期契约**：vitest 经
 * `typecheck.include`（各 package 的 `test` 目录下 `*.test-d.ts`）收集，不做运行期断言。
 *
 * 转绿条件：工厂与八个公共类型经 `src/index.ts` append-only 导出，且成员面与 SA6 §12.1 /
 * 设计 §7-D7、§8.1 一致——本文件一字不改即绿。
 */
import { describe, expectTypeOf, it } from 'vitest';
import {
  createHubReplication,
  createHubReplicationEdge,
  createHubReplicationPlugin,
  createPeerReplication,
  requirePeerReplication,
} from '@nomicore/ws-replication';
import type {
  DuplexTransport,
  HubConnectionState,
  HubNamespaceSessionSink,
  HubOpenNamespaceMessage,
  HubReplication,
  HubReplicationEdgeConnection,
  HubReplicationEdgeEgress,
  HubReplicationEdgeFactory,
  HubReplicationEdgeOptions,
  HubReplicationOptions,
  HubReplicationPluginConfig,
  HubReplicationPluginOverrides,
  HubSessionSinkResolver,
  HubUpgradeRequest,
  NamespaceAuthorization,
  NamespaceAuthorizationGrant,
  NamespaceAuthorizer,
  PeerReplication,
  PeerReplicationOptions,
  PeerReplicationService,
  PeerTokenVerifier,
  ReplicationClock,
  ReplicationLimits,
  ReplicationObserver,
  ReplicationObserverEvent,
  ReplicationTimer,
  ReplicationTimeouts,
  UpgradeIdentity,
} from '@nomicore/ws-replication';
// 类型来源声明（设计 §7-D2 / SA2 N1）：`ReplicationMessage` 属协议包冻结面，
// `@nomicore/ws-replication` 刻意不转出口——公共 sink 成员直接以协议消息联合表达。
import type { ReplicationMessage } from '@nomicore/replication-protocol';

/** 工厂值：类型取自真实公共入口签名（`declare` 无运行时面；本文件不参与运行期执行）。 */
declare const factory: ReturnType<typeof createHubReplicationEdge>;

describe('issue #421 EF-C1 类型面：createHubReplicationEdge 从包入口解析', () => {
  it('工厂为函数：createHubReplicationEdge(options: HubReplicationEdgeOptions) => HubReplicationEdgeFactory', () => {
    expectTypeOf(createHubReplicationEdge).toBeFunction();
    expectTypeOf(createHubReplicationEdge).toEqualTypeOf<
      (options: HubReplicationEdgeOptions) => HubReplicationEdgeFactory
    >();
    expectTypeOf(createHubReplicationEdge).parameters.toEqualTypeOf<[options: HubReplicationEdgeOptions]>();
    expectTypeOf(createHubReplicationEdge).returns.toEqualTypeOf<HubReplicationEdgeFactory>();
  });

  it('负控：既有导出仍在且类型不变（append-only，只增不减）', () => {
    // 单体 hub 工厂：签名逐字保持（`createHubReplication` 是 EF-C1 的「未被改名/删除」锚）
    expectTypeOf(createHubReplication).toEqualTypeOf<(options: HubReplicationOptions) => HubReplication>();
    expectTypeOf(createPeerReplication).toEqualTypeOf<
      (options: PeerReplicationOptions) => PeerReplication
    >();
    // 插件族与服务查询面仍在（参数/返回类型不变）
    expectTypeOf(createHubReplicationPlugin).toBeFunction();
    expectTypeOf(createHubReplicationPlugin).parameters.toEqualTypeOf<
      [config: HubReplicationPluginConfig, overrides?: HubReplicationPluginOverrides]
    >();
    expectTypeOf(requirePeerReplication).toBeFunction();
    expectTypeOf(requirePeerReplication).returns.toEqualTypeOf<PeerReplicationService>();
  });
});

describe('issue #421 EF-C2 类型面：accept 双入口与公共句柄冻结面', () => {
  it('双入口：accept(transport, request?) 与 acceptTrusted(transport, identity) → Promise<句柄 | undefined>', () => {
    expectTypeOf<HubReplicationEdgeFactory>().toMatchTypeOf<{
      accept(
        transport: DuplexTransport,
        request?: HubUpgradeRequest,
      ): Promise<HubReplicationEdgeConnection | undefined>;
      acceptTrusted(
        transport: DuplexTransport,
        identity: UpgradeIdentity,
      ): Promise<HubReplicationEdgeConnection | undefined>;
    }>();

    expectTypeOf(factory.accept).parameters.toEqualTypeOf<[DuplexTransport, HubUpgradeRequest?]>();
    expectTypeOf(factory.accept).returns.toEqualTypeOf<Promise<HubReplicationEdgeConnection | undefined>>();
    expectTypeOf(factory.acceptTrusted).parameters.toEqualTypeOf<[DuplexTransport, UpgradeIdentity]>();
    expectTypeOf(factory.acceptTrusted).returns.toEqualTypeOf<
      Promise<HubReplicationEdgeConnection | undefined>
    >();
  });

  it('HubReplicationEdgeOptions 九成员；无 verifyToken 的对象字面量必须通过（可选性证明，零 cast）', () => {
    expectTypeOf<HubReplicationEdgeOptions['instanceId']>().toEqualTypeOf<string>();
    expectTypeOf<HubReplicationEdgeOptions['timer']>().toEqualTypeOf<ReplicationTimer>();
    expectTypeOf<HubReplicationEdgeOptions['authorize']>().toEqualTypeOf<NamespaceAuthorizer>();
    expectTypeOf<HubReplicationEdgeOptions['resolveSessionSink']>().toEqualTypeOf<HubSessionSinkResolver>();
    // 类型可选 ≠ 运行时容错（SA2 N2）：`accept` 缺认证器仍 fail-closed 1008；`acceptTrusted` 零消费
    expectTypeOf<HubReplicationEdgeOptions['verifyToken']>().toEqualTypeOf<PeerTokenVerifier | undefined>();
    expectTypeOf<NonNullable<HubReplicationEdgeOptions['verifyToken']>>().toEqualTypeOf<PeerTokenVerifier>();
    expectTypeOf<HubReplicationEdgeOptions['limits']>().toEqualTypeOf<
      Readonly<Partial<ReplicationLimits>> | undefined
    >();
    expectTypeOf<HubReplicationEdgeOptions['timeouts']>().toEqualTypeOf<
      Readonly<Partial<ReplicationTimeouts>> | undefined
    >();
    expectTypeOf<HubReplicationEdgeOptions['observer']>().toEqualTypeOf<ReplicationObserver | undefined>();
    expectTypeOf<HubReplicationEdgeOptions['clock']>().toEqualTypeOf<ReplicationClock | undefined>();

    const observerEvents: ReplicationObserverEvent[] = [];
    // 最小合法配置：**不含** `verifyToken`（可选成员——字面量仍满足配置面）
    const minimalOptions = {
      instanceId: 'edge-host-a',
      timer: { setTimeout: () => 0, clearTimeout: () => undefined },
      authorize: async () => ({ ok: false }),
      resolveSessionSink: () => undefined,
    } satisfies HubReplicationEdgeOptions;
    // 全成员配置：显式表达每个可选 seam（含 limits/timeouts/observer/clock/verifyToken）
    const fullOptions = {
      instanceId: 'edge-host-b',
      timer: { setTimeout: () => 0, clearTimeout: () => undefined },
      authorize: async (instanceIdentity: string, namespaceId: string) => {
        void instanceIdentity;
        void namespaceId;
        return { ok: false };
      },
      resolveSessionSink: (
        connectionKey: string,
        namespaceId: string,
        authorization: NamespaceAuthorizationGrant,
      ) => {
        void connectionKey;
        void namespaceId;
        void authorization;
        return undefined;
      },
      verifyToken: async (token) =>
        token.length > 0 ? { ok: true, instanceId: 'peer-a' } : { ok: false },
      limits: { maxFrameBytes: 1024 },
      timeouts: { helloTimeoutMs: 1000 },
      observer: (event) => {
        observerEvents.push(event);
      },
      clock: { now: () => 0 },
    } satisfies HubReplicationEdgeOptions;

    expectTypeOf(minimalOptions).toMatchTypeOf<HubReplicationEdgeOptions>();
    expectTypeOf(minimalOptions).not.toHaveProperty('verifyToken');
    expectTypeOf(fullOptions).toMatchTypeOf<HubReplicationEdgeOptions>();
    expectTypeOf(fullOptions).toHaveProperty('verifyToken');
    expectTypeOf(fullOptions).toHaveProperty('limits');
    expectTypeOf(fullOptions).toHaveProperty('timeouts');
    expectTypeOf(fullOptions).toHaveProperty('observer');
    expectTypeOf(fullOptions).toHaveProperty('clock');
  });

  it('HubSessionSinkResolver 三参签名；NamespaceAuthorizationGrant = authorize ok 投影；HubOpenNamespaceMessage = 协议 Extract', () => {
    expectTypeOf<HubSessionSinkResolver>().toEqualTypeOf<
      (
        connectionKey: string,
        namespaceId: string,
        authorization: NamespaceAuthorizationGrant,
      ) => HubNamespaceSessionSink | undefined | Promise<HubNamespaceSessionSink | undefined>
    >();
    expectTypeOf<Parameters<HubSessionSinkResolver>[0]>().toEqualTypeOf<string>();
    expectTypeOf<Parameters<HubSessionSinkResolver>[1]>().toEqualTypeOf<string>();
    // authorization 参数 = `Extract<NamespaceAuthorization, { ok: true }>`（localOwner/permissions，
    // 非摘要——协议 §19）；`{ ok: false }` 分支必须被排除
    expectTypeOf<HubSessionSinkResolver>().parameters.toEqualTypeOf<
      [connectionKey: string, namespaceId: string, authorization: NamespaceAuthorizationGrant]
    >();
    expectTypeOf<NamespaceAuthorizationGrant>().toEqualTypeOf<
      Extract<NamespaceAuthorization, { ok: true }>
    >();
    expectTypeOf<NamespaceAuthorizationGrant['ok']>().toEqualTypeOf<true>();
    expectTypeOf<HubSessionSinkResolver>().returns.toEqualTypeOf<
      HubNamespaceSessionSink | undefined | Promise<HubNamespaceSessionSink | undefined>
    >();

    // 消息来源：`HubOpenNamespaceMessage` ≡ 协议 `Extract<ReplicationMessage, { kind: 'OPEN_NAMESPACE' }>`；
    // 且 sink 的 `openNamespace` 参数类型即该协议 Extract（包不转出口 `ReplicationMessage`）
    expectTypeOf<HubOpenNamespaceMessage>().toEqualTypeOf<
      Extract<ReplicationMessage, { kind: 'OPEN_NAMESPACE' }>
    >();
    expectTypeOf<Parameters<HubNamespaceSessionSink['openNamespace']>[0]>().toEqualTypeOf<
      Extract<ReplicationMessage, { kind: 'OPEN_NAMESPACE' }>
    >();
    // 负控：`ReplicationMessage` 不经 `@nomicore/ws-replication` 转出口（设计 §7-D2 类型来源声明）
    // @ts-expect-error `ReplicationMessage` 只属 `@nomicore/replication-protocol` 冻结面
    type NotReExportedFromPackageEntry = import('@nomicore/ws-replication').ReplicationMessage;
  });

  it('HubNamespaceSessionSink 四成员精确签名（宿主消费面；OPEN 不带 wire 序、非 OPEN 带 wire 序）', () => {
    expectTypeOf<HubNamespaceSessionSink>().toMatchTypeOf<{
      openNamespace(message: HubOpenNamespaceMessage): void;
      namespaceFrame(message: ReplicationMessage, sequence: number): void;
      terminateUnauthorized(): Promise<void>;
      onConnectionClosed(): Promise<void>;
    }>();

    expectTypeOf<HubNamespaceSessionSink['openNamespace']>().parameters.toEqualTypeOf<
      [message: HubOpenNamespaceMessage]
    >();
    expectTypeOf<HubNamespaceSessionSink['openNamespace']>().returns.toEqualTypeOf<void>();
    expectTypeOf<HubNamespaceSessionSink['namespaceFrame']>().parameters.toEqualTypeOf<
      [message: ReplicationMessage, sequence: number]
    >();
    expectTypeOf<HubNamespaceSessionSink['namespaceFrame']>().returns.toEqualTypeOf<void>();
    expectTypeOf<HubNamespaceSessionSink['terminateUnauthorized']>().parameters.toEqualTypeOf<[]>();
    expectTypeOf<HubNamespaceSessionSink['terminateUnauthorized']>().returns.toEqualTypeOf<Promise<void>>();
    expectTypeOf<HubNamespaceSessionSink['onConnectionClosed']>().parameters.toEqualTypeOf<[]>();
    expectTypeOf<HubNamespaceSessionSink['onConnectionClosed']>().returns.toEqualTypeOf<Promise<void>>();

    // 记录桩：四成员的字面量实现必须无 cast 通过（成员名/形参/返回类型即公共面）
    const sink: HubNamespaceSessionSink = {
      openNamespace(message) {
        void message;
      },
      namespaceFrame(message, sequence) {
        void message;
        void sequence;
      },
      async terminateUnauthorized() {
        return undefined;
      },
      async onConnectionClosed() {
        return undefined;
      },
    };
    expectTypeOf(sink).toMatchTypeOf<HubNamespaceSessionSink>();
  });

  it('HubReplicationEdgeConnection 十成员 + D7 裁决：句柄不暴露 channels（替代观测面 = namespaces）', () => {
    expectTypeOf<HubReplicationEdgeConnection>().toMatchTypeOf<{
      readonly state: HubConnectionState;
      readonly peerInstanceId: string | undefined;
      readonly authenticatedInstanceId: string;
      readonly connectionKey: string;
      readonly namespaces: ReadonlySet<string>;
      readonly egress: HubReplicationEdgeEgress;
      close(code?: number, reason?: string): void;
      settle(): Promise<void>;
      beginReauth(): void;
      revokeNamespace(namespaceId: string): Promise<void>;
    }>();

    expectTypeOf<HubReplicationEdgeConnection['state']>().toEqualTypeOf<HubConnectionState>();
    expectTypeOf<HubReplicationEdgeConnection['peerInstanceId']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<HubReplicationEdgeConnection['authenticatedInstanceId']>().toEqualTypeOf<string>();
    expectTypeOf<HubReplicationEdgeConnection['connectionKey']>().toEqualTypeOf<string>();
    expectTypeOf<HubReplicationEdgeConnection['namespaces']>().toEqualTypeOf<ReadonlySet<string>>();
    expectTypeOf<HubReplicationEdgeConnection['egress']>().toEqualTypeOf<HubReplicationEdgeEgress>();

    expectTypeOf<HubReplicationEdgeConnection['close']>().parameters.toEqualTypeOf<
      [code?: number, reason?: string]
    >();
    expectTypeOf<HubReplicationEdgeConnection['close']>().returns.toEqualTypeOf<void>();
    expectTypeOf<HubReplicationEdgeConnection['settle']>().parameters.toEqualTypeOf<[]>();
    expectTypeOf<HubReplicationEdgeConnection['settle']>().returns.toEqualTypeOf<Promise<void>>();
    expectTypeOf<HubReplicationEdgeConnection['beginReauth']>().parameters.toEqualTypeOf<[]>();
    expectTypeOf<HubReplicationEdgeConnection['beginReauth']>().returns.toEqualTypeOf<void>();
    expectTypeOf<HubReplicationEdgeConnection['revokeNamespace']>().parameters.toEqualTypeOf<
      [namespaceId: string]
    >();
    expectTypeOf<HubReplicationEdgeConnection['revokeNamespace']>().returns.toEqualTypeOf<Promise<void>>();

    // D7 裁决（设计 §7-D7）：`channels` 是进程内 session 半边组合成员，冻结公共面上不得出现
    // 恒空谎言成员——句柄不暴露 `channels`。'channels' ∉ keyof 句柄（负断言，编译期可判别）
    expectTypeOf<HubReplicationEdgeConnection>().not.toHaveProperty('channels');
    expectTypeOf<'channels' extends keyof HubReplicationEdgeConnection ? true : false>().toEqualTypeOf<false>();
  });

  it('HubReplicationEdgeEgress 五成员精确签名（占位编码入、mux 点盖章出）', () => {
    expectTypeOf<HubReplicationEdgeEgress>().toMatchTypeOf<{
      sendControlFrame(frame: Uint8Array): number;
      sendDataFrame(frame: Uint8Array): number;
      namespaceSettled(namespaceId: string): void;
      connectionFatal(code: string, wsCloseCode?: number): void;
      chunkedUpdateNegotiated(): boolean;
    }>();

    expectTypeOf<HubReplicationEdgeEgress['sendControlFrame']>().parameters.toEqualTypeOf<
      [frame: Uint8Array]
    >();
    expectTypeOf<HubReplicationEdgeEgress['sendControlFrame']>().returns.toEqualTypeOf<number>();
    expectTypeOf<HubReplicationEdgeEgress['sendDataFrame']>().parameters.toEqualTypeOf<[frame: Uint8Array]>();
    expectTypeOf<HubReplicationEdgeEgress['sendDataFrame']>().returns.toEqualTypeOf<number>();
    expectTypeOf<HubReplicationEdgeEgress['namespaceSettled']>().parameters.toEqualTypeOf<
      [namespaceId: string]
    >();
    expectTypeOf<HubReplicationEdgeEgress['namespaceSettled']>().returns.toEqualTypeOf<void>();
    expectTypeOf<HubReplicationEdgeEgress['connectionFatal']>().parameters.toEqualTypeOf<
      [code: string, wsCloseCode?: number]
    >();
    expectTypeOf<HubReplicationEdgeEgress['connectionFatal']>().returns.toEqualTypeOf<void>();
    expectTypeOf<HubReplicationEdgeEgress['chunkedUpdateNegotiated']>().parameters.toEqualTypeOf<[]>();
    expectTypeOf<HubReplicationEdgeEgress['chunkedUpdateNegotiated']>().returns.toEqualTypeOf<boolean>();
  });
});
