/**
 * issue #424 —— 分片形态端到端等价性验收夹具（**test-only**；SA6 契约 §12.0、设计 §8.1/§8.2/§8.3）。
 *
 * 拓扑（无 socket、无跨线程面——ADR 0032 决策 2；进程内内存管道即分片载体抽象）：
 *
 *   脚本注入端 / 真 peer（`createPeerReplication`）
 *        │  wire: Uint8Array 帧（20 字节 envelope，[8..12] = 出站序）
 *        ▼
 *   ingress = 公共 `createHubReplicationEdge`（连接级 FSM 单份真身）
 *        │  resolveSessionSink(connectionKey, namespaceId, grant)   ← 缝下行：纯 JSON 描述子
 *        ▼
 *   宿主桥（本文件：字节/JSON 中继 + 信号搬运，**零协议决策**）
 *        │  handleFrame(encodeMessage(msg, { sequence }))            ← 缝：只过字节
 *        ▼
 *   worker 分片 = 公共 `createHubSessionHost`（各持真 Registry/Runtime；pipe 形态 ≥2 实例，
 *   boot 形态单实例且**采纳 boot registry**——§8.3.1）
 *
 * 交付物边界（夹具头注登记；SA6 §10 下游消费者行为）：
 *
 * 1. **非规范宿主样例**：真宿主（nomic-server ingress/worker）的传输、连接登记与生命周期
 *    由宿主自定；本夹具只证明公共面足以装配出与单体 listen 语义等价的分片形态，**不是**
 *    宿主实现规范。桥只做字节/JSON 中继与信号搬运：不合成应答帧、不选错误码、不缓冲/重排/
 *    重试、不复制准入管线、不感知 drain 窗口（全部为 edge/session 半边的既有职责）。
 * 2. **SD-2(a) 单点登记权威**：`ShardedHost.accept/acceptTrusted` 是唯一的
 *    `connectionKey → connection(egress)` 登记点——工厂返回连接后**第一动作**即写入登记表；
 *    `resolveSessionSink` 只从该表取 egress，取不到即抛（无静默兜底）。时序确定性依据：
 *    `acceptTrusted` 为单同步段、早到帧在构造尾部同步重放，而 `resolveSessionSink` 只在
 *    authorize→openAdmission 异步链（≥2 微任务跳）结算后触发 ⟹ 登记恒先于解析是结构事实。
 *    **路径细分（SA2 N7）**：no-sink 终态后的重 OPEN 走缓存 grant 重解析且 resolver 为
 *    **0 跳同步调用**——该路径仅在首个 OPEN 已发生后可达，而首 OPEN 已固定登记状态，
 *    故不破坏上述不变量。
 * 3. **SD-2(b) 退化路径冻结**：登记缺失（早到 OPEN 且登记竞态失败）的失败语义为**响亮
 *    收口**——连接级 `ERROR(INTERNAL_ERROR)` + `close(1011,'protocol-error')` + 零会话
 *    （生产依据：edge「sink 解析失败响亮连接收口」，CONTEXT.md 复制 Edge 职责）。
 *    本夹具不引入 resolver 侧等待/缓冲/重试（那会制造第二套准入管线——ADR 0032 决策 3 禁止）；
 *    该退化路径的可执行负控见 `ws-replication-issue424-lifecycle.test.ts`（SD-2(b) 条目）。
 * 4. **SD-3 每场景一工厂**：`makeShardedHost`/`makeShardedReplicationFacade` 内部各自构造
 *    **恰一个** edge 工厂且 `instanceId` 钉死 `HUB_INSTANCE`（与 boot 传入值同源同值——HELLO
 *    绑定语料的字节前提）；同场景第二条连接复用同一工厂（键后缀 `-conn-0/-conn-1` 天然互异）。
 *    误用（两工厂同键路由进同一 `HubSessionHost` 同 ns）由 `open()` 的重复键响亮 throw 守卫。
 * 5. **boot 形态 registry 同一性约束（设计 §8.3.1）**：boot 的全部 hub 侧观察面
 *    （`run.writeHub` / `run.snapshotDoc('hub')` / `run.rootValue` / `run.bumpHubEpoch`）硬绑
 *    boot 内部 `hubNode`；因此 boot 形态下服务 ROUND namespace 的会话宿主**必须**建于
 *    `options.registry`（≡ `run.hubNode.registry`，同一对象）与 `options.timer` 之上。
 *    `makeShardedReplicationFacade` 把该约束做进签名（`registry` 必填、无 route 参数、内部
 *    只建一个建于其上的 `AdoptedWorker`）——错位装配在夹具签名面**不可表达**。ROUND 套件
 *    每形态 boot 后另有引用同一性前提断言（`worker.registry === run.hubNode.registry`；
 *    该断言假定未包装的 boot registry——`driver.wrapHubRegistry` 故障注入 seam 不在本票面内）。
 * 6. **限值/超时纪律（SA2 N2）**：两半边恒用同一组公共冻结值——
 *    `DEFAULT_REPLICATION_LIMITS`（可直接赋 `ResolvedLimits`，空扩展）与
 *    `DEFAULT_REPLICATION_TIMEOUTS`（值即 resolved 全量形；公共类型把 ping/pong/assembly
 *    三字段标为可选，故此处只做**同一常量**的类型收窄，零取值分叉、零 fallback 复制）。
 *    edge 工厂侧不传 limits/timeouts（工厂内 resolve 缺省 = 同一组 DEFAULT 值）；
 *    session host 侧直接赋常量。harness 的 `CONTRACT_LIMITS` 是缺 5 个分块纪元字段的本地
 *    旧形接口，**不可**赋 `ResolvedLimits`，故不使用。
 * 7. **零深路径 import 生产模块**：载入面 = 公共入口 `@nomicore/ws-replication` +
 *    `@nomicore/replication-protocol` + `@nomicore/namespace-registry/testing` + `./harness.js`；
 *    被测对象（edge 工厂 / session host / 真 Registry+Runtime）恒为真身，stub 只在宿主缝
 *    另一侧（authorize 桩、假 timer）。
 *
 * 探针面（`ShardedProbes`）在 SA6 §12.0 五成员之外补两项（合同条目承重，非新增语义）：
 * `authorizeCalls`（AUTH-C1/C4「authorize 恰一次」的分片侧观察点）与 `handles`（TERM-C2
 * 「`close()` 幂等（同 promise）」的句柄面）。
 */
import * as Y from 'yjs';
import type { NamespaceRegistry, RegistryRandomBytes } from '@nomicore/namespace-registry';
import { createNamespaceRegistryForTesting, createRegistryTestScheduler } from '@nomicore/namespace-registry/testing';
import {
  DEFAULT_REPLICATION_LIMITS,
  DEFAULT_REPLICATION_TIMEOUTS,
  createHubReplication,
  createHubReplicationEdge,
  createHubSessionHost,
} from '@nomicore/ws-replication';
import type {
  DuplexTransport,
  HubNamespaceSessionSink,
  HubReplication,
  HubReplicationEdgeConnection,
  HubReplicationEdgeFactory,
  HubSessionHandle,
  HubSessionHost,
  HubUpgradeRequest,
  NamespaceAuthorization,
  NamespaceAuthorizer,
  PeerTokenVerifier,
  ReplicationTimer,
  UpgradeIdentity,
} from '@nomicore/ws-replication';
import { CAP_CHUNKED_UPDATE, decodeMessage, encodeMessage } from '@nomicore/replication-protocol';
import {
  FIXED_MS,
  HUB_INSTANCE,
  HUB_OWNER,
  PEER_INSTANCE,
  StubPersistence,
  makeHubNamespace,
  type ReplicaNode,
  settle,
} from './harness.js';

// ═══════════════════════════ 限值 / 超时（两半边同一组冻结值） ═══════════════════════════

/** 公共冻结 limits（`ResolvedLimits` 为空扩展 ⟹ 可直接赋）。 */
export const LIMITS = DEFAULT_REPLICATION_LIMITS;

/** 公共冻结 timeouts：值即 resolved 全量形（含 ping/pong/assembly）；公共类型标三字段为
 *  可选，故按 session host 工厂的参数面做**同一常量**收窄（无 fallback、无默认值复制）。 */
type SessionHostTimeouts = Parameters<typeof createHubSessionHost>[0]['timeouts'];
export const TIMEOUTS: SessionHostTimeouts = DEFAULT_REPLICATION_TIMEOUTS as SessionHostTimeouts;

// ═══════════════════════════ 假 timer（记账不触发；零真实时间） ═══════════════════════════

export interface AccountingTimer {
  readonly timer: ReplicationTimer;
  /** 未取消的 pending handle 数（close 后不增 = 无泄漏判据）。 */
  pending(): number;
  /** 已触发回调数（本夹具恒 0：无真实时间推进；REAUTH-C1「deadline 未 fire」判据）。 */
  fires(): number;
}

/** 注入式假 timer：`setTimeout` 只记账（永不触发），`clearTimeout` 注销。 */
export function makeAccountingTimer(): AccountingTimer {
  let counter = 0;
  const pending = new Map<number, number>();
  return {
    timer: {
      setTimeout(_callback: () => void, delayMs: number) {
        counter += 1;
        pending.set(counter, delayMs);
        return counter;
      },
      clearTimeout(handle: unknown) {
        pending.delete(handle as number);
      },
    },
    pending: () => pending.size,
    // 本 timer 的结构纪律 = 零触发（不注册任何真实宏任务）——fires 恒 0。
    fires: () => 0,
  };
}

// ═══════════════════════════ worker 分片（真 Registry/Runtime + 公共 SessionHost） ═══════════════════════════

export interface ShardedWorker {
  readonly index: number;
  readonly registry: NamespaceRegistry;
  readonly scheduler: ReturnType<typeof createRegistryTestScheduler>;
  readonly persistence: StubPersistence;
  readonly host: HubSessionHost;
  readonly namespaceId: string;
}

/** 可路由最小面（桥只消费 `index`/`host`）：`ShardedWorker`（pipe）与 `AdoptedWorker`（boot）均结构满足。 */
export interface RoutableWorker {
  readonly index: number;
  readonly host: HubSessionHost;
}

/** boot 采纳 worker（boot 形态单 worker）：`registry` 必为 boot 传入的 registry（同一对象）。 */
export interface AdoptedWorker extends RoutableWorker {
  readonly registry: NamespaceRegistry;
}

/** 受控随机源（同 harness.makeCounterRandomBytes 纪律：只接受 128-bit 请求；同 seed 同序同值）。 */
export function makeSeededRandomBytes(seed: number): RegistryRandomBytes {
  let counter = seed;
  return (length: number): Uint8Array => {
    if (length !== 16) {
      throw new Error(`issue424 fixture 随机源只支持 128-bit 请求，实际 ${length} 字节`);
    }
    counter += 1;
    const out = new Uint8Array(16);
    let value = counter >>> 0;
    for (let index = 0; index < 16; index += 1) {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      out[index] = (value >>> 24) & 0xff;
    }
    return out;
  };
}

function createSessionHost(registry: NamespaceRegistry, timer: ReplicationTimer): HubSessionHost {
  return createHubSessionHost({
    registry,
    instanceId: HUB_INSTANCE,
    limits: LIMITS,
    timeouts: TIMEOUTS,
    timer,
  });
}

/** worker 分片：真 Registry（testing seam；seeded randomBytes）+ 真 namespace fixture + 公共 SessionHost。 */
export async function makeShardedWorker(
  index: number,
  opts: { readonly seed: number; readonly rootN: number },
): Promise<ShardedWorker> {
  const persistence = new StubPersistence();
  const scheduler = createRegistryTestScheduler();
  const registry = createNamespaceRegistryForTesting(persistence, {
    clock: { now: () => FIXED_MS },
    scheduler,
    idleTimeoutMs: 1_000_000,
    randomBytes: makeSeededRandomBytes(opts.seed),
    role: 'hub',
  });
  const node: ReplicaNode = { role: 'hub', persistence, scheduler, registry };
  const fixture = await makeHubNamespace(node, { owner: HUB_OWNER, root: { n: opts.rootN } });
  return {
    index,
    registry,
    scheduler,
    persistence,
    host: createSessionHost(registry, scheduler),
    namespaceId: fixture.namespaceId,
  };
}

/** 宿主分派决策的测试替身：按 namespaceId 命中 worker 的 home registry（无命中即抛 = 响亮）。 */
export function routeByNamespace(
  workers: readonly ShardedWorker[],
): (namespaceId: string) => RoutableWorker {
  return (namespaceId: string): RoutableWorker => {
    const worker = workers.find((candidate) => candidate.namespaceId === namespaceId);
    if (worker === undefined) throw new Error(`issue424 fixture: 无 worker 承载 ${namespaceId}`);
    return worker;
  };
}

// ═══════════════════════════ 探针面（会话/解析/信号/回传序） ═══════════════════════════

export interface ShardedSessionRecord {
  readonly namespaceId: string;
  readonly workerIndex: number;
  closeCalls: number;
  terminateCalls: number;
}

export interface ShardedOpenRecord {
  readonly connectionKey: string;
  readonly namespaceId: string;
  readonly workerIndex: number;
  readonly selectedCapabilities: number;
  readonly remoteInstanceId: string;
}

export interface ShardedProbes {
  readonly sessions: readonly ShardedSessionRecord[];
  readonly opens: readonly ShardedOpenRecord[];
  /** `${type}:${namespaceId | code}`（settled / connection-fatal）。 */
  readonly signals: readonly string[];
  /** `ns:w${index}`（每次 resolveSessionSink 恰一条）。 */
  readonly resolves: readonly string[];
  /** onFrame 出站 sink 回传的**被分配 wire 序**（0 = 被拒）。 */
  readonly sinkReturns: readonly number[];
  /** 分片侧 authorize 调用序（namespaceId）——AUTH-C1/C4「恰一次」观察点。 */
  readonly authorizeCalls: readonly string[];
  /** 会话计数包裹句柄（TERM-C2 `close()` 幂等（同 promise）观察点）。 */
  readonly handles: readonly HubSessionHandle[];
}

// ═══════════════════════════ 宿主桥（ingress + 分片路由；SD-2(a) 登记权威） ═══════════════════════════

export interface ShardedHost {
  /** 公共 edge 工厂真身（SD-2(b) 退化负控经其直连 accept 构造）。 */
  readonly factory: HubReplicationEdgeFactory;
  /** SD-2(a) 登记权威（`connectionKey → connection`）；resolver 唯一读取点。 */
  readonly connections: ReadonlyMap<string, HubReplicationEdgeConnection>;
  readonly probes: ShardedProbes;
  accept(
    transport: DuplexTransport,
    request?: HubUpgradeRequest,
  ): Promise<HubReplicationEdgeConnection | undefined>;
  acceptTrusted(
    transport: DuplexTransport,
    identity: UpgradeIdentity,
  ): Promise<HubReplicationEdgeConnection | undefined>;
}

export interface ShardedHostConfig {
  /** 授权桩（真实调用单点在 edge；桩只在此侧）。 */
  readonly authorize: NamespaceAuthorizer;
  /** `accept` 路径认证器（boot 的 wrappedVerifier 透传；`acceptTrusted` 零消费）。 */
  readonly verifyToken?: PeerTokenVerifier;
  /** 注入假 timer/scheduler（零原生 timer）。 */
  readonly timer: ReplicationTimer;
}

/**
 * 宿主桥：公共 edge 工厂（ingress）↔ 按 namespace 分派的公共 SessionHost（worker 分片）。
 * 只做字节/JSON 中继与信号搬运（头注 1 的纪律；零协议决策、零应答合成）。
 */
export function makeShardedHost(
  route: (namespaceId: string) => RoutableWorker,
  config: ShardedHostConfig,
): ShardedHost {
  const connections = new Map<string, HubReplicationEdgeConnection>();
  const sessions: ShardedSessionRecord[] = [];
  const opens: ShardedOpenRecord[] = [];
  const signals: string[] = [];
  const resolves: string[] = [];
  const sinkReturns: number[] = [];
  const authorizeCalls: string[] = [];
  const handles: HubSessionHandle[] = [];
  const probes: ShardedProbes = {
    sessions,
    opens,
    signals,
    resolves,
    sinkReturns,
    authorizeCalls,
    handles,
  };

  const factory = createHubReplicationEdge({
    instanceId: HUB_INSTANCE,
    timer: config.timer,
    authorize: (instanceIdentity, namespaceId) => {
      authorizeCalls.push(namespaceId);
      return config.authorize(instanceIdentity, namespaceId);
    },
    ...(config.verifyToken === undefined ? {} : { verifyToken: config.verifyToken }),
    resolveSessionSink: (connectionKey, namespaceId, authorization) => {
      // SD-2(a)：登记权威是唯一写点（accept/acceptTrusted 返回后第一动作）；取不到即抛。
      const connection = connections.get(connectionKey);
      if (connection === undefined) {
        throw new Error(`issue424 fixture: resolver 无登记连接 ${connectionKey}`);
      }
      const worker = route(namespaceId);
      // 描述子 `selectedCapabilities` 的唯一事实源 = edge 协商位（决策 2/5）。
      const selectedCapabilities = connection.egress.chunkedUpdateNegotiated() ? CAP_CHUNKED_UPDATE : 0;
      const raw = worker.host.open({
        connectionKey,
        remoteInstanceId: connection.authenticatedInstanceId,
        namespaceId,
        authorization,
        selectedCapabilities,
        connectionId: connectionKey,
      });
      opens.push({
        connectionKey,
        namespaceId,
        workerIndex: worker.index,
        selectedCapabilities,
        remoteInstanceId: connection.authenticatedInstanceId,
      });
      resolves.push(`${namespaceId}:w${worker.index}`);
      const record: ShardedSessionRecord = {
        namespaceId,
        workerIndex: worker.index,
        closeCalls: 0,
        terminateCalls: 0,
      };
      sessions.push(record);
      // 会话句柄投影：计数包裹只加探针，零改写生产返回值（A1 承重面）。
      const handle: HubSessionHandle = {
        handleFrame: (frame) => raw.handleFrame(frame),
        onFrame: (listener) => raw.onFrame(listener),
        onSignal: (listener) => raw.onSignal(listener),
        terminateUnauthorized: () => {
          record.terminateCalls += 1;
          return raw.terminateUnauthorized();
        },
        close: () => {
          record.closeCalls += 1;
          return raw.close();
        },
      };
      handles.push(handle);
      raw.onFrame((frame, lane) => {
        const assigned =
          lane === 'control'
            ? connection.egress.sendControlFrame(frame)
            : connection.egress.sendDataFrame(frame);
        sinkReturns.push(assigned);
        return assigned;
      });
      raw.onSignal((signal) => {
        signals.push(
          `${signal.type}:${'namespaceId' in signal ? signal.namespaceId : signal.code}`,
        );
        if (signal.type === 'settled') {
          connection.egress.namespaceSettled(signal.namespaceId);
        } else {
          connection.egress.connectionFatal(signal.code);
        }
      });
      const sink: HubNamespaceSessionSink = {
        openNamespace: (message) => {
          // OPEN 投递不带 wire 序（缝契约；占位编码由 edge mux 点盖章）。
          handle.handleFrame(encodeMessage(message, { sequence: 0 }));
        },
        namespaceFrame: (message, sequence) => {
          handle.handleFrame(encodeMessage(message, { sequence }));
        },
        terminateUnauthorized: () => handle.terminateUnauthorized(),
        onConnectionClosed: () => handle.close(),
      };
      return sink;
    },
  });

  const register = (
    connection: HubReplicationEdgeConnection | undefined,
  ): HubReplicationEdgeConnection | undefined => {
    if (connection === undefined) return undefined;
    connections.set(connection.connectionKey, connection);
    return connection;
  };

  return {
    factory,
    connections,
    probes,
    async accept(transport, request) {
      return register(await factory.accept(transport, request));
    },
    async acceptTrusted(transport, identity) {
      return register(await factory.acceptTrusted(transport, identity));
    },
  };
}

// ═══════════════════════════ boot 形态 facade（adopt：结构化采纳 options.registry） ═══════════════════════════

export interface ShardedFacadeOptions {
  /** 必填：boot 恒传 `hubNode.registry`（≡ `run.hubNode.registry`，同一对象）——头注 5。 */
  readonly registry: NamespaceRegistry;
  readonly authorize: NamespaceAuthorizer;
  /** boot 的 wrappedVerifier 透传（dial = token 路径）。 */
  readonly verifyToken?: PeerTokenVerifier;
  /** boot 传入 `hubNode.scheduler`（= 被采纳 timer）。 */
  readonly timer: ReplicationTimer;
}

export interface ShardedFacade {
  /** `boot({ createHub })` 返回值（HubReplication 面）。 */
  readonly replication: HubReplication;
  /** 探针/信号/登记权威（与 pipe 形态共享同一实现路径）。 */
  readonly host: ShardedHost;
  /** 被采纳 worker（`registry === options.registry`——ROUND 装配前提断言用）。 */
  readonly worker: AdoptedWorker;
}

/**
 * adopt 形态 facade：内部建**恰一个** `AdoptedWorker`（会话宿主建于 `options.registry`/
 * `options.timer` 之上）并把全部 `resolveSessionSink` 路由到它；桥/登记/探针与 pipe 形态
 * 共享同一路径（`makeShardedHost(() => worker, config)`）。错位装配（路由到自建 registry
 * worker）在此签名面**不可表达**（设计 §8.3.1）。
 */
export function makeShardedReplicationFacade(options: ShardedFacadeOptions): ShardedFacade {
  const worker: AdoptedWorker = {
    index: 0,
    registry: options.registry,
    host: createSessionHost(options.registry, options.timer),
  };
  const host = makeShardedHost(() => worker, {
    authorize: options.authorize,
    ...(options.verifyToken === undefined ? {} : { verifyToken: options.verifyToken }),
    timer: options.timer,
  });
  let closeTail: Promise<void> | undefined;
  const replication: HubReplication = {
    accept: (transport, request) => host.accept(transport, request),
    acceptTrusted: (transport, identity) => host.acceptTrusted(transport, identity),
    get connections() {
      return [...host.connections.values()];
    },
    async revoke(instanceIdentity: string, namespaceId: string) {
      const tails: Promise<void>[] = [];
      for (const connection of host.connections.values()) {
        if (connection.authenticatedInstanceId !== instanceIdentity) continue;
        tails.push(connection.revokeNamespace(namespaceId));
      }
      await Promise.all(tails);
    },
    async requestReauth(instanceIdentity: string) {
      for (const connection of host.connections.values()) {
        if (connection.authenticatedInstanceId !== instanceIdentity) continue;
        connection.beginReauth();
      }
    },
    close(): Promise<void> {
      if (closeTail !== undefined) return closeTail;
      const list = [...host.connections.values()];
      for (const connection of list) connection.close(1001, 'hub-shutdown');
      closeTail = Promise.all(list.map((connection) => connection.settle())).then(() => undefined);
      return closeTail;
    },
  };
  return { replication, host, worker };
}

// ═══════════════════════════ 内存管道（记录出站 + 可注入入站；微任务投递） ═══════════════════════════

export interface RecordingPipe {
  readonly hubTransport: DuplexTransport;
  sendInbound(bytes: Uint8Array): void;
  /** 出站原字节（断言面）。 */
  frames(): readonly Uint8Array[];
  hubCloseInfo(): Readonly<{ code: number; reason: string }> | undefined;
}

export function makeRecordingPipe(): RecordingPipe {
  const hubMessages = new Set<(bytes: Uint8Array) => void>();
  const peerMessages = new Set<(bytes: Uint8Array) => void>();
  const peerCloseListeners = new Set<(info: Readonly<{ code: number; reason: string }>) => void>();
  const frames: Uint8Array[] = [];
  const state = {
    hubClosed: false,
    peerClosed: false,
    hubClose: undefined as Readonly<{ code: number; reason: string }> | undefined,
  };
  const hubTransport: DuplexTransport = {
    send(bytes: Uint8Array) {
      if (state.hubClosed) return;
      frames.push(bytes.slice());
      const copy = bytes.slice();
      queueMicrotask(() => {
        for (const listener of [...peerMessages]) listener(copy);
      });
    },
    close(code = 1000, reason = '') {
      if (state.hubClosed) return;
      state.hubClosed = true;
      state.hubClose = { code, reason };
      queueMicrotask(() => {
        for (const listener of [...peerCloseListeners]) listener(state.hubClose!);
      });
    },
    get closed() {
      return state.hubClosed;
    },
    onMessage(listener: (bytes: Uint8Array) => void) {
      hubMessages.add(listener);
      return () => hubMessages.delete(listener);
    },
    onClose(listener: (info: Readonly<{ code: number; reason: string }>) => void) {
      peerCloseListeners.add(listener);
      return () => peerCloseListeners.delete(listener);
    },
  };
  return {
    hubTransport,
    sendInbound(bytes: Uint8Array) {
      if (state.peerClosed) return;
      const copy = bytes.slice();
      queueMicrotask(() => {
        for (const listener of [...hubMessages]) listener(copy);
      });
    },
    frames: () => frames,
    hubCloseInfo: () => state.hubClose,
  };
}

// ═══════════════════════════ 语料构造（两形态共用同一 Uint8Array 脚本） ═══════════════════════════

/** 固定 16 字节 nonce（HELLO 语料确定性；同源字节前提）。 */
export const HELLO_NONCE = new Uint8Array(16).fill(0x80);

export function helloFrame(sequence: number, optionalCapabilities = 0): Uint8Array {
  return encodeMessage(
    {
      kind: 'HELLO',
      peerInstanceId: PEER_INSTANCE,
      expectedHubInstanceId: HUB_INSTANCE,
      protocolVersions: [1],
      requiredCapabilities: 0,
      optionalCapabilities,
      connectionNonce: HELLO_NONCE,
    },
    { sequence },
  );
}

export function openFrame(namespaceId: string, sequence: number): Uint8Array {
  return encodeMessage(
    { kind: 'OPEN_NAMESPACE', namespaceId, hasLocalReplica: false },
    { sequence },
  );
}

export function closeNsFrame(namespaceId: string, sequence: number): Uint8Array {
  return encodeMessage(
    { kind: 'CLOSE_NAMESPACE', namespaceId, reasonCode: 'peer-close' },
    { sequence },
  );
}

// ═══════════════════════════ 判据助手（三层硬门——设计 §7.2） ═══════════════════════════

/** envelope `[8..12]` 大端序出站序（wire 原字节读取）。 */
export function rawSequence(bytes: Uint8Array): number {
  return ((bytes[8]! << 24) | (bytes[9]! << 16) | (bytes[10]! << 8) | bytes[11]!) >>> 0;
}

export interface DecodedFrame {
  readonly kind: string;
  readonly code?: string;
  readonly namespaceId?: string;
  readonly sequence: number;
}

export function decodeAll(frames: readonly Uint8Array[]): DecodedFrame[] {
  return frames.map((bytes) => {
    const decoded = decodeMessage(bytes, { maxFrameBytes: LIMITS.maxFrameBytes });
    const message = decoded.message as { kind: string; code?: string; namespaceId?: string };
    return {
      kind: message.kind,
      ...(message.code === undefined ? {} : { code: message.code }),
      ...(message.namespaceId === undefined ? {} : { namespaceId: message.namespaceId }),
      sequence: decoded.header.sequence,
    };
  });
}

/** L1 白名单（**枚举**；无 Yjs 载荷的确定性控制帧）。 */
const CONTROL_KINDS: ReadonlySet<string> = new Set([
  'HELLO_ACK',
  'OPEN_OK',
  'ERROR',
  'CLOSE_OK',
  'GOAWAY',
]);

/** L2 白名单（**枚举**；Yjs 载荷帧按文档语义等值判定）。 */
const DATA_KINDS: ReadonlySet<string> = new Set([
  'BOOTSTRAP_SNAPSHOT',
  'UPDATE',
  'UPDATE_CHUNK',
  'SYNC_STEP2',
]);

function kindOf(bytes: Uint8Array): string {
  return (decodeMessage(bytes, { maxFrameBytes: LIMITS.maxFrameBytes }).message as { kind: string })
    .kind;
}

/** L1：控制帧白名单子序列（原字节）。 */
export function controlFramesOf(frames: readonly Uint8Array[]): Uint8Array[] {
  return frames.filter((bytes) => CONTROL_KINDS.has(kindOf(bytes)));
}

/** L2：数据帧白名单子序列（原字节）。 */
export function dataFramesOf(frames: readonly Uint8Array[]): Uint8Array[] {
  return frames.filter((bytes) => DATA_KINDS.has(kindOf(bytes)));
}

/** L3：全轨迹骨架 `kind(code?)#sequence` 逐帧。 */
export function skeletonOf(frames: readonly Uint8Array[]): string {
  return decodeAll(frames)
    .map((item) => `${item.kind}${item.code === undefined ? '' : `(${item.code})`}#${item.sequence}`)
    .join(' ');
}

/** L2：数据帧承载的文档语义（ROOT/META JSON——clientID 无关的等价判据）。 */
export function docStateOf(frames: readonly Uint8Array[]): string {
  const doc = new Y.Doc();
  for (const bytes of frames) {
    const message = decodeMessage(bytes, { maxFrameBytes: LIMITS.maxFrameBytes }).message as {
      kind: string;
      snapshot?: Uint8Array;
      update?: Uint8Array;
    };
    if (message.kind === 'BOOTSTRAP_SNAPSHOT' && message.snapshot !== undefined) {
      Y.applyUpdate(doc, message.snapshot);
    } else if (
      (message.kind === 'UPDATE' || message.kind === 'SYNC_STEP2') &&
      message.update !== undefined
    ) {
      Y.applyUpdate(doc, message.update);
    }
  }
  return JSON.stringify({
    root: doc.getMap('ROOT').toJSON(),
    meta: doc.getMap('META').toJSON(),
  });
}

function hexOf(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

/** 逐帧 hex 全等（undefined = 等；否则返回首个差异说明）。 */
export function framesHexEqual(
  left: readonly Uint8Array[],
  right: readonly Uint8Array[],
): string | undefined {
  if (left.length !== right.length) {
    return `帧数不同 left=${left.length} right=${right.length}`;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (hexOf(left[index]!) !== hexOf(right[index]!)) return `第 ${index} 帧字节不同`;
  }
  return undefined;
}

// ═══════════════════════════ 轨迹驱动（parity 语料共用；pipe 形态，不经 boot） ═══════════════════════════

export interface TraceOptions {
  /** `revoke` 链路：逐 ns revoke（单体 `hub.revoke` / 分片 `connection.revokeNamespace`）。 */
  readonly revoke?: readonly string[];
  readonly closeAtEnd?: boolean;
  /** reauth drain 回合：`beginReauth()`（GOAWAY）→ 入站 CLOSE_NAMESPACE（通道 settled → 提前完成）。 */
  readonly reauthClose?: Readonly<{ namespaceId: string; sequence: number }>;
}

export interface Trace {
  readonly frames: readonly Uint8Array[];
  readonly state: string;
  readonly authorizeCalls: readonly string[];
  readonly sessions: readonly ShardedSessionRecord[];
  readonly opens: readonly ShardedOpenRecord[];
  /** `ns:w${index}`（`resolveSessionSink` 调用面；单体形态恒空）。 */
  readonly resolves: readonly string[];
  readonly signals: readonly string[];
  readonly handles: readonly HubSessionHandle[];
  readonly hubClose: Readonly<{ code: number; reason: string }> | undefined;
}

export type Form = 'pass' | 'deny' | 'throw';

/** 授权桩：三种形态 + 调用序记录（桩只在宿主缝另一侧；真实调用单点在 edge/session 半边）。 */
export function makeAuthorizer(form: Form, calls: string[] = []): NamespaceAuthorizer {
  return async (_instanceIdentity: string, namespaceId: string): Promise<NamespaceAuthorization> => {
    calls.push(namespaceId);
    if (form === 'deny') return { ok: false };
    if (form === 'throw') throw new Error('issue424 fixture: authorizer boom');
    return {
      ok: true,
      localOwner: HUB_OWNER,
      permissions: { read: true, submit: true },
    };
  };
}

/** 单体 listen 形态轨迹（`createHubReplication` = ADR 0032 决策 1 的进程内组合根）。 */
export async function runMonolithTrace(
  form: Form,
  registry: NamespaceRegistry,
  script: readonly Uint8Array[],
  options: TraceOptions = {},
): Promise<Trace> {
  const pipe = makeRecordingPipe();
  const authorizeCalls: string[] = [];
  const hub = createHubReplication({
    instanceId: HUB_INSTANCE,
    registry,
    authorize: makeAuthorizer(form, authorizeCalls),
    timer: makeAccountingTimer().timer,
    verifyToken: async () => ({ ok: true as const, instanceId: PEER_INSTANCE }),
    limits: LIMITS,
    timeouts: TIMEOUTS,
  });
  const connection = await hub.acceptTrusted?.(pipe.hubTransport, { peerInstanceId: PEER_INSTANCE });
  if (connection === undefined) throw new Error('issue424 fixture: 单体 acceptTrusted 拒绝');
  for (const frame of script) {
    pipe.sendInbound(frame);
    await settle();
  }
  for (const namespaceId of options.revoke ?? []) {
    await hub.revoke(PEER_INSTANCE, namespaceId);
    await settle();
  }
  if (options.closeAtEnd === true) {
    connection.close(1001, 'fixture-close');
    await settle();
  }
  return {
    frames: pipe.frames(),
    state: connection.state,
    authorizeCalls,
    sessions: [],
    opens: [],
    resolves: [],
    signals: [],
    handles: [],
    hubClose: pipe.hubCloseInfo(),
  };
}

/** 分片形态轨迹（公共 edge 工厂 + 真 Registry/Runtime 的公共 SessionHost 实例）。 */
export async function runShardTrace(
  form: Form,
  workers: readonly ShardedWorker[],
  script: readonly Uint8Array[],
  options: TraceOptions = {},
): Promise<Trace> {
  const pipe = makeRecordingPipe();
  const host = makeShardedHost(routeByNamespace(workers), {
    authorize: makeAuthorizer(form),
    timer: makeAccountingTimer().timer,
  });
  const connection = await host.acceptTrusted(pipe.hubTransport, { peerInstanceId: PEER_INSTANCE });
  if (connection === undefined) throw new Error('issue424 fixture: 分片 acceptTrusted 拒绝');
  for (const frame of script) {
    pipe.sendInbound(frame);
    await settle();
  }
  for (const namespaceId of options.revoke ?? []) {
    await connection.revokeNamespace(namespaceId);
    await settle();
  }
  if (options.reauthClose !== undefined) {
    connection.beginReauth();
    await settle();
    pipe.sendInbound(closeNsFrame(options.reauthClose.namespaceId, options.reauthClose.sequence));
    await settle();
  }
  if (options.closeAtEnd === true) {
    connection.close(1001, 'fixture-close');
    await settle();
  }
  return {
    frames: pipe.frames(),
    state: connection.state,
    authorizeCalls: host.probes.authorizeCalls,
    sessions: host.probes.sessions,
    opens: host.probes.opens,
    resolves: host.probes.resolves,
    signals: host.probes.signals,
    handles: host.probes.handles,
    hubClose: pipe.hubCloseInfo(),
  };
}

/** 两形态等价性判定 = L1（控制帧逐字节）∧ L2（数据帧文档语义）∧ L3（全轨迹骨架）。 */
export function parityOf(mono: Trace, shard: Trace): { ok: boolean; detail: string } {
  const controlDiff = framesHexEqual(controlFramesOf(mono.frames), controlFramesOf(shard.frames));
  const skeletonEqual = skeletonOf(mono.frames) === skeletonOf(shard.frames);
  const docEqual = docStateOf(dataFramesOf(mono.frames)) === docStateOf(dataFramesOf(shard.frames));
  const ok = controlDiff === undefined && skeletonEqual && docEqual;
  const detail = [
    `控制帧逐字节=${controlDiff === undefined ? '等' : `不等(${controlDiff})`}`,
    `骨架=${skeletonEqual ? '等' : `不等(mono=${skeletonOf(mono.frames)} | shard=${skeletonOf(shard.frames)})`}`,
    `数据帧文档语义=${docEqual ? '等' : '不等'}`,
    `控制帧=${controlFramesOf(shard.frames).length} 数据帧=${dataFramesOf(shard.frames).length}`,
  ].join('；');
  return { ok, detail };
}
