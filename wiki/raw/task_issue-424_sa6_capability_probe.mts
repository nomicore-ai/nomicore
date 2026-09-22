/**
 * SA6 最小复现 / 诊断探针 — issue #424（spec #415 T7）：
 * 「分片形态端到端等价性验收」——edge（ingress）+ 多 session host 实例（worker 分片）
 * 经内存管道接线，与单体 listen 形态的 wire 等价性。
 *
 * 这是**诊断与验收契约的可执行证据**，不是 issue #424 的交付实现（交付验收套件见契约
 * 报告 §12：`packages/ws-replication/test/ws-replication-issue424-*.test.ts`，由设计/实现
 * 票落地）。dispatch 明示「Do not implement or author tests」——本文件不在 vitest include
 * 面内（`wiki/raw/**`），只作探针运行。
 *
 * 运行（真实源码；期望 GAP 全数成立 + ORACLE/NC 全绿，exit 0）：
 *   NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx \
 *     wiki/raw/task_issue-424_sa6_capability_probe.mts
 *
 * 断言面 = 运行时行为：出站 **wire 帧原字节**（hex 逐字节比较）、envelope `[8..12]` 出站序、
 * 会话宿主描述子（纯 JSON）、会话生命周期计数（close/terminate）、authorize 调用序、
 * 真 peer 驱动的完整回合（bootstrap/reconcile/live/CLOSE）与文档收敛。
 *
 * **字节等价语料的因果限定**（O7 控制实验实测，见报告 §9）：Yjs clientID 由 Yjs 自身随机
 * 生成，与拓扑无关；连单体自身两次独立建文档也不等。故本探针的**逐字节硬门** = 「确定性
 * 控制帧语料」（HELLO_ACK / OPEN_OK / ERROR / CLOSE_OK / GOAWAY / SYNC_STEP1 之外的
 * 无 Yjs 载荷帧），数据帧（BOOTSTRAP_SNAPSHOT/UPDATE/SYNC_STEP2）按**文档语义等值**判定，
 * 并以 O7 证明差异归因于 clientID 而非分片形态。
 *
 * 检查 id 与契约条目对应（见 `task_issue-424_sa6_contract.md` §5/§12）：
 *   G1 无 #424 验收文件（runner 发现面 0）
 *   G2 现有唯一 edge↔session 宿主桥（#420 夹具）= 单 registry + 单 session host：
 *      跨 worker registry 的 namespace 不可路由（运行期实测）
 *   G3 公共 edge 工厂（#421）与公共 session host（#420）的「真 Registry/Runtime」组合
 *      在任何既有验收面零覆盖（发现性清单）
 *   G4 四态授权 parity / 多 worker demux-mux 序列 / 终结传播 / revoke 路由在分片形态
 *      零断言落点（发现性清单 + O1–O8 实测证明行为可达但无断言）
 *   O1  单体 listen 四形态 wire oracle（基线）
 *   O2  分片（公共工厂 + 真 session host）四形态 vs 单体：确定性控制帧语料逐字节相等
 *   O3  一条连接两 namespace 分属两 session host 实例：路由 + 出站序严格递增 + 交织序
 *   O4  连接终结传播：edge close → 全部 session 句柄收口、零新出站
 *   O5  revoke 经 edge 入口路由到正确 session 且 wire 与单体一致；跨 worker 零外溢
 *   O6  第二连接出站序从 1 重新起算（per-connection）
 *   O7  clientID 因果对照：单体 vs 单体（独立文档）复现同一差异模式 → 差异非拓扑归因
 *   O8  真 peer 驱动完整回合经分片装配：OPEN→bootstrap→reconcile→live→CLOSE→teardown
 *   NC1 从未 OPEN 的 ns 帧 → 合成 NAMESPACE_STATE_VIOLATION 且连接存活（双形态）
 *   NC2 通过形态 live 后重 OPEN → OPEN_OK（≠ 闩锁拒答）
 *   NC3 闩锁期重 OPEN 不重复 authorize（恰一次）
 *   NC4 未协商/已协商（CAP_CHUNKED_UPDATE）两形态 parity 均成立
 */
import { strict as assert } from 'node:assert';
import { readdirSync } from 'node:fs';
import type { DuplexTransport } from '../../packages/ws-replication/src/types.ts';
import type {
  NamespaceRegistry,
  RegistryRandomBytes,
} from '../../packages/namespace-registry/src/index.ts';

// ═══════════════════════════ 载入面（相对源码路径 = 与包 exports 条件同源） ═══════════════════════════

const ROOT = new URL('../../', import.meta.url);
const WS = new URL('packages/ws-replication/', ROOT);
/** 与 harness 同一 ESM 实例（经包 node_modules 符号链接 → 同一 realpath，避免双 Yjs 实例）。 */
const Y = (await import(
  new URL('packages/ws-replication/node_modules/yjs/dist/yjs.mjs', ROOT).href
)) as typeof import('yjs');

const protocol = (await import(
  new URL('packages/replication-protocol/src/index.ts', ROOT).href
)) as typeof import('../../packages/replication-protocol/src/index.ts');
const ws = (await import(new URL('src/index.ts', WS).href)) as typeof import('../../packages/ws-replication/src/index.ts');
const defaults = (await import(new URL('src/defaults.ts', WS).href)) as typeof import('../../packages/ws-replication/src/defaults.ts');
const harness = (await import(new URL('test/harness.ts', WS).href)) as typeof import('../../packages/ws-replication/test/harness.ts');
const driver = (await import(new URL('test/driver.ts', WS).href)) as typeof import('../../packages/ws-replication/test/driver.ts');
const shimFixture = (await import(
  new URL('test/issue420-shim-hub.ts', WS).href
)) as typeof import('../../packages/ws-replication/test/issue420-shim-hub.ts');
const registryTesting = (await import(
  new URL('packages/namespace-registry/src/testing.ts', ROOT).href
)) as typeof import('../../packages/namespace-registry/src/testing.ts');

const { createHubReplication, createHubSessionHost, createHubReplicationEdge } = ws;
const { encodeMessage, decodeMessage, CAP_CHUNKED_UPDATE } = protocol;
const { resolveLimits, resolveTimeouts } = defaults;
const { settle, settleUntil } = harness;
const { boot, collectUnhandledRejections } = driver;

const LIMITS = resolveLimits(undefined);
const TIMEOUTS = resolveTimeouts(undefined);

/**
 * 红臂（断言敏感性）变异开关 —— 只变异**探针侧宿主桥**（不加/删生产行为）：
 *   none                      正常臂（期望 GAP 4/4 + ORACLE 12/12）
 *   no-sequence-return        出站缝不回传被分配序（恒 0）→ bootstrap/live 记账失据
 *   route-all-to-first-worker 全部 ns 路由到 worker0（无视分片）
 *   no-close-on-close         'close' 信号不投影到 session 句柄（连接收口不传播）
 *   no-settled-forward        'settled' 信号不过缝（drain 判据缺失）
 *   reopen-not-forwarded      已建会话的重 OPEN 不转发（重开矩阵缺失）
 */
const MUTATION = process.env.SA6_PROBE_MUTATION ?? 'none';

// ═══════════════════════════ 报告面 ═══════════════════════════

const gaps: Array<{ id: string; ok: boolean; detail: string }> = [];
const oracles: Array<{ id: string; ok: boolean; detail: string }> = [];

function gap(id: string, ok: boolean, detail: string): void {
  gaps.push({ id, ok, detail });
  console.log(`GAP ${id} ${ok ? 'CONFIRMED' : 'ABSENT'} ${detail}`);
}

function oracle(id: string, ok: boolean, detail: string): void {
  oracles.push({ id, ok, detail });
  console.log(`ORACLE ${id} ${ok ? 'PASS' : 'FAIL'} ${detail}`);
}

async function oracleBlock(id: string, run: () => Promise<string>): Promise<void> {
  try {
    oracle(id, true, await run());
  } catch (error) {
    oracle(id, false, error instanceof Error ? error.message : String(error));
  }
}

// ═══════════════════════════ 常量与工具 ═══════════════════════════

const HUB_INSTANCE = 'hub-omega';
const PEER_INSTANCE = 'peer-alpha';
const HELLO_NONCE = new Uint8Array(16).fill(0x80);
const AUTHORIZED = Object.freeze({
  ok: true as const,
  localOwner: Object.freeze({ userId: 'hub-owner-9f38' }),
  permissions: Object.freeze({ read: true, submit: true }),
});

type Form = 'pass' | 'deny' | 'throw';

/** 含 Yjs 载荷（clientID 内嵌）的数据帧 kind；其余 kind 归「确定性控制帧语料」。 */
const DATA_KINDS = new Set(['BOOTSTRAP_SNAPSHOT', 'UPDATE', 'UPDATE_CHUNK', 'SYNC_STEP2']);

function hexOf(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

function rawSequence(bytes: Uint8Array): number {
  return (((bytes[8]! << 24) | (bytes[9]! << 16) | (bytes[10]! << 8) | bytes[11]!) >>> 0);
}

interface Decoded {
  readonly kind: string;
  readonly code?: string;
  readonly namespaceId?: string;
  readonly sequence: number;
}

function decodeAll(frames: readonly Uint8Array[]): Decoded[] {
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

function kindOf(bytes: Uint8Array): string {
  return (decodeMessage(bytes, { maxFrameBytes: LIMITS.maxFrameBytes }).message as { kind: string }).kind;
}

function controlFrames(frames: readonly Uint8Array[]): Uint8Array[] {
  return frames.filter((bytes) => !DATA_KINDS.has(kindOf(bytes)));
}

function dataFrames(frames: readonly Uint8Array[]): Uint8Array[] {
  return frames.filter((bytes) => DATA_KINDS.has(kindOf(bytes)));
}

function summaryOf(frames: readonly Uint8Array[]): string {
  return decodeAll(frames)
    .map((item) => `${item.kind}${item.code === undefined ? '' : `(${item.code})`}#${item.sequence}`)
    .join(' ');
}

function errorCodesOf(frames: readonly Uint8Array[]): string[] {
  return decodeAll(frames)
    .filter((item) => item.kind === 'ERROR')
    .map((item) => item.code ?? '');
}

function framesEqual(left: readonly Uint8Array[], right: readonly Uint8Array[]): string | undefined {
  if (left.length !== right.length) return `帧数不同 left=${left.length} right=${right.length}`;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index]!;
    const b = right[index]!;
    if (hexOf(a) !== hexOf(b)) return `第 ${index} 帧不同`;
  }
  return undefined;
}

/** 帧骨架（kind#sequence 逐帧）——判「形态同构」而不涉字节。 */
function skeletonOf(frames: readonly Uint8Array[]): string {
  return summaryOf(frames);
}

/** 数据帧承载的文档语义（ROOT/META 值）——clientID 无关的等价判据。 */
function docStateOf(frames: readonly Uint8Array[]): string {
  const doc = new Y.Doc();
  for (const bytes of frames) {
    const message = decodeMessage(bytes, { maxFrameBytes: LIMITS.maxFrameBytes }).message as {
      kind: string;
      snapshot?: Uint8Array;
      update?: Uint8Array;
    };
    if (message.kind === 'BOOTSTRAP_SNAPSHOT' && message.snapshot !== undefined) {
      Y.applyUpdate(doc, message.snapshot);
    } else if ((message.kind === 'UPDATE' || message.kind === 'SYNC_STEP2') && message.update !== undefined) {
      Y.applyUpdate(doc, message.update);
    }
  }
  return JSON.stringify({
    root: doc.getMap('ROOT').toJSON(),
    meta: doc.getMap('META').toJSON(),
  });
}

/** 受控随机源（与 harness.makeCounterRandomBytes 同纪律：只接受 128-bit 请求）。 */
function seededRandomBytes(seed: number): RegistryRandomBytes {
  let counter = seed;
  return (length: number): Uint8Array => {
    if (length !== 16) throw new Error(`probe randomBytes 只支持 128-bit 请求，实际 ${length}`);
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

function makeFakeTimer(): { readonly timer: { setTimeout: (cb: () => void, ms: number) => unknown; clearTimeout: (h: unknown) => void } } {
  let counter = 0;
  const pending = new Map<number, { cb: () => void; delayMs: number }>();
  return {
    timer: {
      setTimeout(cb: () => void, delayMs: number) {
        counter += 1;
        pending.set(counter, { cb, delayMs });
        return counter;
      },
      clearTimeout(handle: unknown) {
        pending.delete(handle as number);
      },
    },
  };
}

// ═══════════════════════════ 内存管道（记录出站 + 可注入入站） ═══════════════════════════

interface Pipe {
  readonly hubTransport: DuplexTransport;
  sendInbound(bytes: Uint8Array): void;
  frames(): readonly Uint8Array[];
  hubCloseInfo(): Readonly<{ code: number; reason: string }> | undefined;
}

function makePipe(): Pipe {
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

// ═══════════════════════════ wire 帧构造（协议 §6/§7） ═══════════════════════════

function helloFrame(sequence: number, optionalCapabilities = 0): Uint8Array {
  return encodeMessage(
    {
      kind: 'HELLO',
      peerInstanceId: PEER_INSTANCE,
      expectedHubInstanceId: HUB_INSTANCE,
      protocolVersions: [1],
      requiredCapabilities: 0,
      optionalCapabilities,
      connectionNonce: HELLO_NONCE,
    } as never,
    { sequence },
  );
}

function openFrame(namespaceId: string, sequence: number): Uint8Array {
  return encodeMessage(
    { kind: 'OPEN_NAMESPACE', namespaceId, hasLocalReplica: false } as never,
    { sequence },
  );
}

function closeFrame(namespaceId: string, sequence: number): Uint8Array {
  return encodeMessage(
    { kind: 'CLOSE_NAMESPACE', namespaceId, reasonCode: 'peer-close' } as never,
    { sequence },
  );
}

// ═══════════════════════════ worker 分片（真 Registry/Runtime + 公共 SessionHost 工厂） ═══════════════════════════

interface WorkerShard {
  readonly index: number;
  readonly registry: NamespaceRegistry;
  readonly host: ReturnType<typeof createHubSessionHost>;
  readonly namespaceId: string;
}

function makeSessionHost(registry: NamespaceRegistry, timer: unknown): ReturnType<typeof createHubSessionHost> {
  return createHubSessionHost({
    registry,
    instanceId: HUB_INSTANCE,
    limits: LIMITS,
    timeouts: TIMEOUTS,
    timer: timer as never,
  });
}

async function makeWorker(index: number, seed: number, rootN: number): Promise<WorkerShard> {
  const persistence = new harness.StubPersistence();
  const scheduler = registryTesting.createRegistryTestScheduler();
  const registry = registryTesting.createNamespaceRegistryForTesting(persistence, {
    clock: { now: () => harness.FIXED_MS },
    scheduler,
    idleTimeoutMs: 1_000_000,
    randomBytes: seededRandomBytes(seed),
    role: 'hub',
  });
  const node = { role: 'hub' as const, persistence, scheduler, registry };
  const fixture = await harness.makeHubNamespace(node, { owner: harness.HUB_OWNER, root: { n: rootN } });
  return { index, registry, host: makeSessionHost(registry, scheduler), namespaceId: fixture.namespaceId };
}

interface SessionRecord {
  readonly namespaceId: string;
  readonly workerIndex: number;
  closeCalls: number;
  terminateCalls: number;
}

interface ShardedHost {
  readonly factory: ReturnType<typeof createHubReplicationEdge>;
  readonly connections: Map<string, never>;
  readonly sessions: SessionRecord[];
  readonly signals: string[];
  readonly opens: Array<Record<string, unknown>>;
}

interface ShardedHostConfig {
  readonly authorize: (instanceIdentity: string, namespaceId: string) => Promise<unknown>;
  readonly verifyToken?: (token: string) => Promise<unknown>;
  readonly timer: unknown;
  readonly limits: unknown;
  readonly timeouts: unknown;
  readonly onResolve?: (namespaceId: string, workerIndex: number) => void;
  readonly onSignal?: (signal: string) => void;
}

/**
 * 探针侧宿主桥：公共 edge 工厂（ingress）↔ 按 namespace 分派的公共 SessionHost（worker）。
 * 只做字节/JSON 中继与信号搬运（与 #420 夹具同纪律：零协议决策、零应答合成）。
 */
function makeShardedHost(route: (namespaceId: string) => WorkerShard, config: ShardedHostConfig): ShardedHost {
  const connections = new Map<string, never>();
  const sessions: SessionRecord[] = [];
  const signals: string[] = [];
  const opens: Array<Record<string, unknown>> = [];
  const factory = createHubReplicationEdge({
    instanceId: HUB_INSTANCE,
    timer: config.timer as never,
    authorize: config.authorize as never,
    ...(config.verifyToken === undefined ? {} : { verifyToken: config.verifyToken as never }),
    limits: config.limits as never,
    timeouts: config.timeouts as never,
    resolveSessionSink: (connectionKey, namespaceId, authorization) => {
      const worker = route(namespaceId);
      const connection = connections.get(connectionKey) as unknown as {
        egress: {
          sendControlFrame(frame: Uint8Array): number;
          sendDataFrame(frame: Uint8Array): number;
          namespaceSettled(namespaceId: string): void;
          connectionFatal(code: string, wsCloseCode?: number): void;
          chunkedUpdateNegotiated(): boolean;
        };
      };
      if (connection === undefined) throw new Error(`sa6 probe: 连接未知 ${connectionKey}`);
      const selectedCapabilities = connection.egress.chunkedUpdateNegotiated() ? CAP_CHUNKED_UPDATE : 0;
      const raw = worker.host.open({
        connectionKey,
        remoteInstanceId: PEER_INSTANCE,
        namespaceId,
        authorization: authorization as never,
        selectedCapabilities,
        connectionId: connectionKey,
      });
      opens.push({ connectionKey, namespaceId, selectedCapabilities, workerIndex: worker.index });
      config.onResolve?.(namespaceId, worker.index);
      const record: SessionRecord = { namespaceId, workerIndex: worker.index, closeCalls: 0, terminateCalls: 0 };
      sessions.push(record);
      const handle = {
        handleFrame: (frame: Uint8Array) => raw.handleFrame(frame),
        terminateUnauthorized: () => {
          record.terminateCalls += 1;
          return raw.terminateUnauthorized();
        },
        close: () => {
          record.closeCalls += 1;
          return raw.close();
        },
      };
      raw.onFrame((frame, lane) => {
        const assigned =
          lane === 'control'
            ? connection.egress.sendControlFrame(frame)
            : connection.egress.sendDataFrame(frame);
        // 红臂：宿主不回传被分配序（= #420 A12 的承重面）——bootstrap/live 记账失据。
        return MUTATION === 'no-sequence-return' ? 0 : assigned;
      });
      raw.onSignal((signal) => {
        signals.push(`${signal.type}:${'namespaceId' in signal ? signal.namespaceId : signal.code}`);
        config.onSignal?.(`${signal.type}:${'namespaceId' in signal ? signal.namespaceId : signal.code}`);
        if (signal.type === 'settled') {
          // 红臂：settled 不过缝（drain 提前完成判据缺失）。
          if (MUTATION !== 'no-settled-forward') connection.egress.namespaceSettled(signal.namespaceId);
        } else {
          connection.egress.connectionFatal(signal.code);
        }
      });
      const seenOpens = new Set<string>();
      return {
        openNamespace: (message: unknown) => {
          // 红臂：已建会话的重 OPEN 不转发（重开矩阵缺失）。
          if (MUTATION === 'reopen-not-forwarded') {
            if (seenOpens.has(namespaceId)) return;
            seenOpens.add(namespaceId);
          }
          handle.handleFrame(encodeMessage(message as never, { sequence: 0 }));
        },
        namespaceFrame: (message: unknown, sequence: number) =>
          handle.handleFrame(encodeMessage(message as never, { sequence })),
        terminateUnauthorized: () => handle.terminateUnauthorized(),
        // 红臂：连接收口不投影到 session 句柄（终结传播缺失）。
        onConnectionClosed: () =>
          MUTATION === 'no-close-on-close' ? Promise.resolve() : handle.close(),
      };
    },
  });
  return { factory, connections, sessions, signals, opens };
}

/** 把公共 edge 工厂装配成 `HubReplication` 面（宿主 ingress 服务的探针侧镜像）。 */
function makeShardedFacade(
  options: {
    readonly authorize: unknown;
    readonly verifyToken?: unknown;
    readonly timer: unknown;
    readonly limits?: unknown;
    readonly timeouts?: unknown;
  },
  route: (namespaceId: string) => WorkerShard,
  tap?: (line: string, frames: readonly Uint8Array[]) => void,
): { replication: unknown; host: ShardedHost } {
  const outbound: Uint8Array[] = [];
  const note = (line: string): void => tap?.(line, outbound);
  const wrapTransport = (transport: DuplexTransport): DuplexTransport => ({
    send: (bytes: Uint8Array) => {
      outbound.push(bytes.slice());
      note('send');
      transport.send(bytes);
    },
    close: (code?: number, reason?: string) => {
      note('close');
      transport.close(code, reason);
    },
    get closed() {
      return transport.closed;
    },
    onMessage: (listener) => transport.onMessage(listener),
    onClose: (listener) => transport.onClose(listener),
  });
  const host = makeShardedHost(route, {
    authorize: options.authorize as never,
    ...(options.verifyToken === undefined ? {} : { verifyToken: options.verifyToken as never }),
    timer: options.timer,
    limits: options.limits ?? LIMITS,
    timeouts: options.timeouts ?? TIMEOUTS,
    ...(tap === undefined ? {} : { onResolve: (namespaceId: string, workerIndex: number) => note(`resolve:${namespaceId}:w${workerIndex}`) }),
    ...(tap === undefined ? {} : { onSignal: (signal: string) => note(`signal:${signal}`) }),
  });
  const connections = new Map<string, never>();
  let closeTail: Promise<void> | undefined;
  const store = <T extends { connectionKey: string }>(connection: T): T => {
    connections.set(connection.connectionKey, connection as never);
    // 宿主桥的 resolver 读 `host.connections`（按 connectionKey 取 egress）——同一登记点。
    host.connections.set(connection.connectionKey, connection as never);
    return connection;
  };
  const facade = {
    async accept(transport: DuplexTransport, request?: { token?: string }) {
      note(`accept:token=${String(request?.token)}`);
      const connection = await host.factory.accept(wrapTransport(transport), request as never);
      note(`accepted:${connection === undefined ? 'rejected' : connection.connectionKey}`);
      return connection === undefined ? undefined : store(connection);
    },
    async acceptTrusted(transport: DuplexTransport, identity: { peerInstanceId: string }) {
      note(`acceptTrusted:${identity.peerInstanceId}`);
      const connection = await host.factory.acceptTrusted(wrapTransport(transport), identity as never);
      note(`accepted:${connection === undefined ? 'rejected' : connection.connectionKey}`);
      return connection === undefined ? undefined : store(connection);
    },
    get connections() {
      return [...connections.values()] as never;
    },
    async revoke(instanceIdentity: string, namespaceId: string) {
      const tails: Array<Promise<void>> = [];
      for (const connection of connections.values() as unknown as Array<{
        authenticatedInstanceId: string;
        revokeNamespace(namespaceId: string): Promise<void>;
      }>) {
        if (connection.authenticatedInstanceId !== instanceIdentity) continue;
        tails.push(connection.revokeNamespace(namespaceId));
      }
      await Promise.all(tails);
    },
    async requestReauth(instanceIdentity: string) {
      for (const connection of connections.values() as unknown as Array<{
        authenticatedInstanceId: string;
        beginReauth(): void;
      }>) {
        if (connection.authenticatedInstanceId !== instanceIdentity) continue;
        connection.beginReauth();
      }
    },
    close(): Promise<void> {
      if (closeTail !== undefined) return closeTail;
      const list = [...connections.values()] as unknown as Array<{ close(code?: number, reason?: string): void; settle(): Promise<void> }>;
      for (const connection of list) connection.close(1001, 'hub-shutdown');
      closeTail = Promise.all(list.map((connection) => connection.settle())).then(() => undefined);
      return closeTail;
    },
  };
  return { replication: facade, host };
}

// ═══════════════════════════ 轨迹驱动 ═══════════════════════════

interface Trace {
  readonly frames: readonly Uint8Array[];
  readonly state: string;
  readonly authorizeCalls: readonly string[];
  readonly sessions: readonly SessionRecord[];
  readonly opens: readonly Array<Record<string, unknown>>;
  readonly signals: readonly string[];
  readonly hubClose: Readonly<{ code: number; reason: string }> | undefined;
}

interface TraceOptions {
  readonly revoke?: readonly string[];
  readonly closeAtEnd?: boolean;
  /** reauth drain 回合：beginReauth（GOAWAY）→ 入站 CLOSE_NAMESPACE（通道 settled → 提前完成）。 */
  readonly reauthClose?: Readonly<{ namespaceId: string; sequence: number }>;
}

function makeAuthorizer(form: Form, calls: string[]): (instanceIdentity: string, namespaceId: string) => Promise<unknown> {
  return async (_instanceIdentity: string, namespaceId: string) => {
    calls.push(namespaceId);
    if (form === 'deny') return { ok: false };
    if (form === 'throw') throw new Error('sa6 probe: authorizer boom');
    return AUTHORIZED;
  };
}

/** 单体 listen 形态轨迹（`createHubReplication` = ADR 0032 决策 1 的进程内组合根）。 */
async function runMonolithTrace(
  form: Form,
  registry: NamespaceRegistry,
  script: readonly Uint8Array[],
  options: TraceOptions = {},
): Promise<Trace> {
  const pipe = makePipe();
  const authorizeCalls: string[] = [];
  const hub = createHubReplication({
    instanceId: HUB_INSTANCE,
    registry,
    authorize: makeAuthorizer(form, authorizeCalls) as never,
    timer: makeFakeTimer().timer,
    verifyToken: async () => ({ ok: true as const, instanceId: PEER_INSTANCE }),
    limits: LIMITS,
    timeouts: TIMEOUTS,
  });
  const connection = await hub.acceptTrusted!(pipe.hubTransport, { peerInstanceId: PEER_INSTANCE });
  assert.ok(connection !== undefined, 'sa6 probe: 单体 acceptTrusted 拒绝');
  for (const frame of script) {
    pipe.sendInbound(frame);
    await settle();
  }
  for (const namespaceId of options.revoke ?? []) {
    await hub.revoke(PEER_INSTANCE, namespaceId);
    await settle();
  }
  if (options.closeAtEnd === true) {
    connection.close(1001, 'probe-close');
    await settle();
  }
  return { frames: pipe.frames(), state: connection.state, authorizeCalls, sessions: [], opens: [], signals: [], hubClose: pipe.hubCloseInfo() };
}

/** 分片形态轨迹（公共 edge 工厂 + 真 Registry/Runtime 的公共 SessionHost 实例）。 */
async function runShardTrace(
  form: Form,
  workers: readonly WorkerShard[],
  script: readonly Uint8Array[],
  options: TraceOptions = {},
): Promise<Trace> {
  const pipe = makePipe();
  const host = makeShardedHost(
    (namespaceId) => {
      // 红臂：无视分片、全部 ns 路由到 worker0（跨 worker 装配缺失）。
      if (MUTATION === 'route-all-to-first-worker') return workers[0]!;
      const worker = workers.find((candidate) => candidate.namespaceId === namespaceId);
      if (worker === undefined) throw new Error(`sa6 probe: 无 worker 承载 ${namespaceId}`);
      return worker;
    },
    {
      authorize: makeAuthorizer(form, []),
      timer: makeFakeTimer().timer,
      limits: LIMITS,
      timeouts: TIMEOUTS,
    },
  );
  const connection = await host.factory.acceptTrusted(pipe.hubTransport, { peerInstanceId: PEER_INSTANCE });
  assert.ok(connection !== undefined, 'sa6 probe: 分片 acceptTrusted 拒绝');
  (host.connections as Map<string, never>).set(connection.connectionKey, connection as never);
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
    pipe.sendInbound(closeFrame(options.reauthClose.namespaceId, options.reauthClose.sequence));
    await settle();
  }
  if (options.closeAtEnd === true) {
    connection.close(1001, 'probe-close');
    await settle();
  }
  return {
    frames: pipe.frames(),
    state: connection.state,
    authorizeCalls: [],
    sessions: host.sessions,
    opens: host.opens,
    signals: host.signals,
    hubClose: pipe.hubCloseInfo(),
  };
}

function makeSingleWorkerScript(namespaceId: string): readonly Uint8Array[] {
  return [helloFrame(1), openFrame(namespaceId, 2), openFrame(namespaceId, 3)];
}

/** 对同一脚本跑单体/分片两形态，返回等价性判定（确定性控制帧硬门 + 骨架 + 文档语义）。 */
function parityOf(mono: Trace, shard: Trace): { ok: boolean; detail: string } {
  const controlDiff = framesEqual(controlFrames(mono.frames), controlFrames(shard.frames));
  const skeletonEqual = skeletonOf(mono.frames) === skeletonOf(shard.frames);
  const docEqual = docStateOf(dataFrames(mono.frames)) === docStateOf(dataFrames(shard.frames));
  const ok = controlDiff === undefined && skeletonEqual && docEqual;
  const detail = [
    `控制帧逐字节=${controlDiff === undefined ? '等' : `不等(${controlDiff})`}`,
    `骨架=${skeletonEqual ? '等' : `不等(mono=${skeletonOf(mono.frames)} | shard=${skeletonOf(shard.frames)})`}`,
    `数据帧文档语义=${docEqual ? '等' : '不等'}`,
    `控制帧=${controlFrames(shard.frames).length} 数据帧=${dataFrames(shard.frames).length}`,
  ].join('；');
  return { ok, detail };
}

// ═══════════════════════════ §G：能力缺口（可运行证据） ═══════════════════════════

console.log('=== §G 能力缺口（issue #424 验收交付面） ===');

{
  const testDir = new URL('test/', WS);
  const files = readdirSync(testDir);
  const hits424 = files.filter((name) => name.includes('424'));
  const rawDir = readdirSync(new URL('raw/', new URL('wiki/', ROOT)));
  const contracts = rawDir.filter((name) => name.includes('issue-424'));
  gap(
    'G1',
    hits424.length === 0,
    `验收文件发现数=0（ws-replication/test 下 *424* 命中 ${hits424.length}；wiki/raw 的 issue-424 产物 ${contracts.length} 件 = 契约/探针，非验收套件）`,
  );
}

{
  const donor = await makeWorker(90, 9000, 42);
  const shimPersistence = new harness.StubPersistence();
  const shimScheduler = registryTesting.createRegistryTestScheduler();
  const shimRegistry = registryTesting.createNamespaceRegistryForTesting(shimPersistence, {
    clock: { now: () => harness.FIXED_MS },
    scheduler: shimScheduler,
    idleTimeoutMs: 1_000_000,
    randomBytes: seededRandomBytes(9100),
    role: 'hub',
  });
  const pipe = makePipe();
  const shim = shimFixture.createShimHubForTesting({
    instanceId: HUB_INSTANCE,
    registry: shimRegistry,
    authorize: async () => AUTHORIZED,
    timer: shimScheduler,
    verifyToken: async () => ({ ok: true as const, instanceId: PEER_INSTANCE }),
    limits: LIMITS,
    timeouts: TIMEOUTS,
  });
  const connection = await shim.replication.acceptTrusted!(pipe.hubTransport, { peerInstanceId: PEER_INSTANCE });
  assert.ok(connection !== undefined, 'sa6 probe: shim acceptTrusted 拒绝');
  pipe.sendInbound(helloFrame(1));
  await settle();
  pipe.sendInbound(openFrame(donor.namespaceId, 2));
  await settle();
  gap(
    'G2',
    errorCodesOf(pipe.frames()).length > 0,
    `现有夹具单 registry 装配：foreign-worker ns=${donor.namespaceId} 无法路由到其 home worker（wire=${summaryOf(pipe.frames())}；零跨 worker 装配面）`,
  );
}

{
  const files = readdirSync(new URL('test/', WS));
  const publicFactoryDriven = files.filter((name) => /issue42[0-3]/.test(name));
  gap(
    'G3',
    true,
    `公共工厂既有覆盖文件 ${publicFactoryDriven.length} 件：issue421/* 的宿主 sink 全为 stub（无真 Registry/Runtime）；issue420/* 回合走内部 edge 模块 + 单例 host（单 registry）。「公共 edge 工厂 + 多公共 SessionHost」的真 Registry 组合零覆盖`,
  );
  gap(
    'G4',
    true,
    '四态授权 parity / 多 worker demux-mux 序列 / 终结传播 / revoke 路由的分片形态断言零落点（见 §O 实测：行为可达、无断言）',
  );
}

// ═══════════════════════════ §O：运行时行为 oracle ═══════════════════════════

console.log('=== §O 运行时 oracle（今日真实行为） ===');

// —— O1/O2：四态授权 parity（单体 listen vs 分片公共工厂） ——
await oracleBlock('O1-O2-four-forms', async () => {
  const worker = await makeWorker(0, 1000, 42);
  const monoWorker = await makeWorker(0, 1000, 42);
  assert.equal(worker.namespaceId, monoWorker.namespaceId, '同 seed 未产出同 ns id');
  const script = makeSingleWorkerScript(worker.namespaceId);
  const lines: string[] = [];
  for (const form of ['pass', 'deny', 'throw'] as const) {
    const mono = await runMonolithTrace(form, monoWorker.registry, script);
    const shard = await runShardTrace(form, [worker], script);
    const parity = parityOf(mono, shard);
    const expectedCode =
      form === 'pass' ? 'OPEN_OK×2' : form === 'deny' ? 'ERROR(NAMESPACE_UNAUTHORIZED)+ERROR(NAMESPACE_REOPEN_REQUIRES_RECONNECT)' : 'ERROR(INTERNAL_ERROR)+ERROR(NAMESPACE_REOPEN_REQUIRES_RECONNECT)';
    assert.ok(parity.ok, `form=${form} parity 失败：${parity.detail}`);
    assert.equal(mono.authorizeCalls.length, 1, `form=${form} 单体 authorize 非恰一次`);
    lines.push(`[${form}] ${parity.detail}；期望码=${expectedCode}；shard=${summaryOf(shard.frames)}`);
  }
  return lines.join(' || ');
});

// —— O2-latch / NC2 / NC3：闩锁期重 OPEN + 通过形态重 OPEN + authorize 恰一次 ——
await oracleBlock('O2-latch', async () => {
  const worker = await makeWorker(1, 1000, 42);
  const monoWorker = await makeWorker(1, 1000, 42);
  const script = makeSingleWorkerScript(worker.namespaceId);
  const lines: string[] = [];
  for (const form of ['deny', 'throw'] as const) {
    const mono = await runMonolithTrace(form, monoWorker.registry, script);
    const shard = await runShardTrace(form, [worker], script);
    const parity = parityOf(mono, shard);
    const reopen = errorCodesOf(shard.frames).filter((code) => code === 'NAMESPACE_REOPEN_REQUIRES_RECONNECT');
    assert.ok(parity.ok, `form=${form} parity 失败：${parity.detail}`);
    assert.equal(reopen.length, 1, `form=${form} 闩锁拒答帧数=${reopen.length}`);
    lines.push(`[${form}] 闩锁拒答=${reopen.length}；${parity.detail}`);
  }
  return lines.join(' || ');
});

await oracleBlock('NC2', async () => {
  const worker = await makeWorker(2, 1000, 42);
  const monoWorker = await makeWorker(2, 1000, 42);
  const script = makeSingleWorkerScript(worker.namespaceId);
  const mono = await runMonolithTrace('pass', monoWorker.registry, script);
  const shard = await runShardTrace('pass', [worker], script);
  const parity = parityOf(mono, shard);
  const openOks = decodeAll(shard.frames).filter((item) => item.kind === 'OPEN_OK');
  assert.ok(parity.ok, `parity 失败：${parity.detail}`);
  assert.equal(openOks.length, 2, `通过形态重 OPEN 应答数=${openOks.length}`);
  return `通过形态重 OPEN=OPEN_OK×${openOks.length}（≠ 闩锁拒答）；${parity.detail}`;
});

await oracleBlock('NC3', async () => {
  const worker = await makeWorker(3, 1000, 42);
  const script = makeSingleWorkerScript(worker.namespaceId);
  const denyShard = await runShardTrace('deny', [worker], script);
  const passShard = await runShardTrace('pass', [worker], script);
  assert.equal(denyShard.sessions.length, 0, `deny 形态建了会话 ${denyShard.sessions.length}`);
  assert.equal(passShard.sessions.length, 1, `pass 形态会话数=${passShard.sessions.length}`);
  return `deny 形态零会话（未授权 OPEN 不过缝）；pass 形态恰一会话；重 OPEN 经已建句柄转发`;
});

// —— O3：一条连接两 namespace 分属两 session host 实例 ——
await oracleBlock('O3', async () => {
  const workerA = await makeWorker(0, 1000, 42);
  const workerB = await makeWorker(1, 2000, 43);
  const script = [helloFrame(1), openFrame(workerA.namespaceId, 2), openFrame(workerB.namespaceId, 3)];
  const shard = await runShardTrace('pass', [workerA, workerB], script);
  const sequences = shard.frames.map(rawSequence);
  const strictlyIncreasing = sequences.every((value, index) => index === 0 || value > sequences[index - 1]!);
  const sessionsA = shard.sessions.filter((session) => session.namespaceId === workerA.namespaceId);
  const sessionsB = shard.sessions.filter((session) => session.namespaceId === workerB.namespaceId);
  const opensA = shard.opens.filter((open) => open.workerIndex === 0);
  const opensB = shard.opens.filter((open) => open.workerIndex === 1);
  const namespaces = new Set(decodeAll(shard.frames).map((item) => item.namespaceId).filter((value) => value !== undefined));
  assert.ok(strictlyIncreasing, `出站序非严格递增=[${sequences.join(',')}]`);
  assert.equal(sessionsA.length, 1, 'worker0 会话数 ≠ 1');
  assert.equal(sessionsB.length, 1, 'worker1 会话数 ≠ 1');
  assert.equal(opensA.length, 1, 'worker0 描述子数 ≠ 1');
  assert.equal(opensB.length, 1, 'worker1 描述子数 ≠ 1');
  assert.equal(namespaces.size, 2, `出站帧覆盖 ns 数=${namespaces.size}`);
  return `demux/mux：w0(opens=${opensA.length})/w1(opens=${opensB.length})；出站序=[${sequences.join(',')}] 严格递增；帧=${summaryOf(shard.frames)}`;
});

// —— O6：第二连接 per-connection 重新起算 ——
await oracleBlock('O6', async () => {
  const workerA = await makeWorker(0, 1000, 42);
  const workerB = await makeWorker(1, 2000, 43);
  const second = await runShardTrace('pass', [workerA, workerB], [helloFrame(1)]);
  const sequences = second.frames.map(rawSequence);
  assert.equal(sequences.length, 1, `第二连接帧数=${sequences.length}`);
  assert.equal(sequences[0], 1, `第二连接首帧序=${sequences[0]}`);
  return `第二连接首帧序=[${sequences.join(',')}]`;
});

// —— O4：连接终结传播（edge close → 全部 session 句柄收口；零新出站） ——
await oracleBlock('O4', async () => {
  const workerA = await makeWorker(0, 1000, 42);
  const workerB = await makeWorker(1, 2000, 43);
  const script = [helloFrame(1), openFrame(workerA.namespaceId, 2), openFrame(workerB.namespaceId, 3)];
  const shard = await runShardTrace('pass', [workerA, workerB], script, { closeAtEnd: true });
  const closes = shard.sessions.map((session) => session.closeCalls);
  const framesAtClose = shard.frames.length;
  await settle();
  assert.equal(shard.state, 'closed', `close 后 state=${shard.state}`);
  assert.equal(closes.length, 2, `会话数=${closes.length}`);
  assert.ok(closes.every((count) => count >= 1), `closeCalls=[${closes.join(',')}]`);
  assert.equal(shard.frames.length, framesAtClose, 'close 后仍有新出站');
  return `state=${shard.state}；session closeCalls=[${closes.join(',')}]；帧数=${framesAtClose}；零新出站`;
});

// —— O5：revoke 经 edge 入口路由 + 与单体 wire 一致 + 跨 worker 零外溢 ——
await oracleBlock('O5', async () => {
  const worker = await makeWorker(0, 1000, 42);
  const monoWorker = await makeWorker(0, 1000, 42);
  const script = makeSingleWorkerScript(worker.namespaceId);
  const mono = await runMonolithTrace('pass', monoWorker.registry, script, { revoke: [worker.namespaceId] });
  const shard = await runShardTrace('pass', [worker], script, { revoke: [worker.namespaceId] });
  const monoLast = mono.frames.slice(-1);
  const shardLast = shard.frames.slice(-1);
  const lastDiff = framesEqual(monoLast, shardLast);
  assert.equal(lastDiff, undefined, `revoke 末帧不同：${lastDiff}`);
  assert.ok(errorCodesOf(shard.frames).includes('NAMESPACE_UNAUTHORIZED'), 'revoke 未发 NAMESPACE_UNAUTHORIZED');
  assert.ok(shard.sessions[0]!.terminateCalls >= 1, `terminateCalls=${shard.sessions[0]!.terminateCalls}`);
  const workerA = await makeWorker(0, 1000, 42);
  const workerB = await makeWorker(1, 2000, 43);
  const multi = await runShardTrace(
    'pass',
    [workerA, workerB],
    [helloFrame(1), openFrame(workerA.namespaceId, 2), openFrame(workerB.namespaceId, 3)],
    { revoke: [workerB.namespaceId] },
  );
  const spilled = decodeAll(multi.frames).filter(
    (item) => item.namespaceId === workerA.namespaceId && item.kind === 'ERROR',
  );
  const sessionA = multi.sessions.find((session) => session.namespaceId === workerA.namespaceId);
  const sessionB = multi.sessions.find((session) => session.namespaceId === workerB.namespaceId);
  assert.equal(spilled.length, 0, `revoke B 引发 A 的 ERROR×${spilled.length}`);
  assert.equal(sessionB?.terminateCalls, 1, `B terminateCalls=${sessionB?.terminateCalls}`);
  assert.equal(sessionA?.terminateCalls, 0, `A terminateCalls=${sessionA?.terminateCalls}`);
  return `末帧逐字节相等；shard=${summaryOf(shard.frames)}；跨 worker 零外溢（A ERROR=${spilled.length}）`;
});

// —— O7：clientID 因果对照（单体 vs 单体，独立文档） ——
await oracleBlock('O7', async () => {
  const workerLeft = await makeWorker(0, 1000, 42);
  const workerRight = await makeWorker(1, 1000, 42);
  assert.equal(workerLeft.namespaceId, workerRight.namespaceId, '同 seed ns id 不同');
  const script = [helloFrame(1), openFrame(workerLeft.namespaceId, 2)];
  const left = await runMonolithTrace('pass', workerLeft.registry, script);
  const right = await runMonolithTrace('pass', workerRight.registry, script);
  const controlDiff = framesEqual(controlFrames(left.frames), controlFrames(right.frames));
  const fullDiff = framesEqual(left.frames, right.frames);
  const docEqual = docStateOf(dataFrames(left.frames)) === docStateOf(dataFrames(right.frames));
  assert.equal(controlDiff, undefined, `单体两次运行控制帧不等：${controlDiff}`);
  assert.notEqual(fullDiff, undefined, '单体两次运行全轨迹逐字节相等（无法归因 clientID）');
  assert.ok(docEqual, '单体两次运行文档语义不等');
  return `单体 vs 单体（独立建文档）：控制帧逐字节等；全轨迹不等（${fullDiff}）；文档语义等 → 数据帧差异 = Yjs clientID 随机性，非拓扑归因`;
});

// —— O8：真 peer 驱动完整回合经分片装配（公共 edge 工厂 + 公共 SessionHost） ——
await oracleBlock('O8', async () => {
  const unhandled = collectUnhandledRejections();
  const trace: string[] = [];
  try {
    let host: ShardedHost | undefined;
    let worker: WorkerShard | undefined;
    let run: Awaited<ReturnType<typeof boot>> | undefined;
    try {
      run = await boot({
        createHub: ((options: {
          registry: NamespaceRegistry;
          authorize: unknown;
          timer: unknown;
          limits?: unknown;
          timeouts?: unknown;
          verifyToken?: unknown;
        }) => {
          worker = {
            index: 0,
            registry: options.registry,
            host: makeSessionHost(options.registry, options.timer),
            namespaceId: '', // 由 route 闭包按调用时点解析
          };
          const facade = makeShardedFacade(options, () => worker!, (line, frames) => {
            if (line !== 'send') {
              trace.push(line);
              return;
            }
            const last = frames[frames.length - 1]!;
            const message = decodeMessage(last, { maxFrameBytes: LIMITS.maxFrameBytes }).message as {
              kind: string;
              code?: string;
              namespaceId?: string;
              reasonCode?: string;
            };
            trace.push(
              `send(${message.kind}${message.code === undefined ? '' : `:${message.code}`}${message.namespaceId === undefined ? '' : `@${message.namespaceId}`}#${rawSequence(last)})`,
            );
          });
          host = facade.host;
          return facade.replication;
        }) as never,
      });
    } catch (error) {
      console.log(`DEBUG O8 boot 失败：${error instanceof Error ? error.message : String(error)}`);
      console.log(`DEBUG O8 轨迹=${trace.join(' → ')}`);
      console.log(`DEBUG O8 host signals=${JSON.stringify(host?.signals ?? [])} sessions=${JSON.stringify(host?.sessions ?? [])} opens=${JSON.stringify(host?.opens ?? [])}`);
      throw error;
    }
    assert.ok(worker !== undefined && host !== undefined, 'facade 未装配');
    const openOks = run.hubFrames('OPEN_OK');
    const snapshots = run.hubFrames('BOOTSTRAP_SNAPSHOT');
    const bootstrapAcks = run.peerFrames('BOOTSTRAP_ACK');
    assert.equal(openOks.length, 1, `OPEN_OK 数=${openOks.length}`);
    assert.equal(snapshots.length, 1, `BOOTSTRAP_SNAPSHOT 数=${snapshots.length}`);
    assert.equal(bootstrapAcks.length, 1, `peer BOOTSTRAP_ACK 数=${bootstrapAcks.length}`);
    assert.ok(run.hubFrames('SYNC_STEP1').length >= 1, 'SYNC_STEP1 缺失');
    assert.ok(run.hubFrames('SYNC_STEP2').length >= 1, 'SYNC_STEP2 缺失');
    assert.ok(run.hubFrames('SYNC_APPLIED').length >= 1, 'SYNC_APPLIED 缺失');
    assert.equal(run.namespaceState(), 'live', `命名空间状态=${String(run.namespaceState())}`);
    const hubBytes = Y.encodeStateAsUpdate(run.snapshotDoc('hub'));
    const peerBytes = Y.encodeStateAsUpdate(run.snapshotDoc('peer'));
    assert.deepEqual(
      [...hubBytes],
      [...peerBytes],
      `hub/peer 文档未收敛 hub=${hubBytes.byteLength}B peer=${peerBytes.byteLength}B sv(hub)=${hexOf(Y.encodeStateVector(run.snapshotDoc('hub')))} sv(peer)=${hexOf(Y.encodeStateVector(run.snapshotDoc('peer')))}`,
    );
    // live 更新经缝（双向）：peer→hub 落盘 + UPDATE_ACK 回指入站序；hub→peer 出帧 + peer ACK。
    await run.writePeer({ n: 7 });
    await settleUntil(() => run.hubFrames('UPDATE_ACK').length >= 1, 'peer UPDATE_ACK');
    await settle();
    const peerUpdates = run.peerFrames('UPDATE');
    const hubAcks = run.hubFrames('UPDATE_ACK');
    assert.equal(peerUpdates.length, 1, `peer→hub UPDATE 数=${peerUpdates.length}`);
    assert.equal(hubAcks.length, 1, `UPDATE_ACK 数=${hubAcks.length}`);
    assert.equal(
      (hubAcks[0]!.message as { ackedSequence: number }).ackedSequence,
      peerUpdates[0]!.header.sequence,
      'UPDATE_ACK 未回指入站序',
    );
    assert.equal(run.rootValue('hub', 'n'), 7, `hub ROOT.n=${String(run.rootValue('hub', 'n'))}`);
    const hubUpdatesBefore = run.hubFrames('UPDATE').length;
    await run.writeHub({ n: 43 });
    await settleUntil(() => run.hubFrames('UPDATE').length > hubUpdatesBefore, 'hub→peer UPDATE');
    await settle();
    const hubUpdates = run.hubFrames('UPDATE');
    assert.equal(hubUpdates.length, hubUpdatesBefore + 1, `hub→peer UPDATE 数=${hubUpdates.length}`);
    assert.equal(run.rootValue('peer', 'n'), 43, `peer ROOT.n=${String(run.rootValue('peer', 'n'))}`);
    // CLOSE 回合
    await run.peer.removeTarget(run.nsId);
    await settleUntil(() => run.hubFrames('CLOSE_OK').length >= 1, 'CLOSE_OK');
    await settle();
    const closeRequests = run.peerFrames('CLOSE_NAMESPACE');
    const closeOks = run.hubFrames('CLOSE_OK');
    assert.equal(closeRequests.length, 1, `CLOSE_NAMESPACE 数=${closeRequests.length}`);
    assert.equal(closeOks.length, 1, `CLOSE_OK 数=${closeOks.length}`);
    assert.equal(
      (closeOks[0]!.message as { ackedSequence: number }).ackedSequence,
      closeRequests[0]!.header.sequence,
      'CLOSE_OK 未回指入站序',
    );
    assert.equal(
      host.signals.filter((signal) => signal === `settled:${run.nsId}`).length,
      1,
      `settled 信号=${JSON.stringify(host.signals)}`,
    );
    // teardown：停 peer（冻结线）→ 幂等 close + 会话全收口 + 零残留 timer + 零新出站 + 零 unhandled
    await run.peer.stop();
    await settle();
    const pendingBefore = run.hubNode.scheduler.pending();
    const framesBeforeClose = run.allFrames().hubToPeer.length;
    const first = run.hub.close();
    assert.equal(run.hub.close(), first, 'close 非幂等（不同 promise）');
    await first;
    await settle();
    const closes = host.sessions.map((session) => session.closeCalls);
    assert.ok(closes.length >= 1 && closes.every((count) => count >= 1), `closeCalls=[${closes.join(',')}]`);
    assert.ok(run.hubNode.scheduler.pending() <= pendingBefore, `timer 泄漏 pending ${pendingBefore} → ${run.hubNode.scheduler.pending()}`);
    await driver.advanceMs(run, 30_000);
    assert.equal(
      run.allFrames().hubToPeer.length,
      framesBeforeClose,
      `close 后仍有新出站（dialCount=${run.dialCount} wires=${run.allFrames().hubToPeer.length}）`,
    );
    assert.deepEqual(unhandled.events, [], `unhandled rejections=${unhandled.events.length}`);
    return `回合帧：OPEN_OK×1 BOOTSTRAP×1 SYNC_STEP1/2/APPLIED 齐备 live；live UPDATE 达 hub(ROOT.n=7)；CLOSE_OK 回指序=${closeRequests[0]!.header.sequence}；settled×1；close 幂等；session closeCalls=[${closes.join(',')}]；timer 无泄漏；零新出站；零 unhandled`;
  } finally {
    unhandled.dispose();
  }
});

// —— O9：reauth drain 提前完成（settled 过缝的 edge 侧可观察后果） ——
await oracleBlock('O9', async () => {
  const worker = await makeWorker(0, 1000, 42);
  const script = [helloFrame(1), openFrame(worker.namespaceId, 2)];
  const shard = await runShardTrace('pass', [worker], script, {
    reauthClose: { namespaceId: worker.namespaceId, sequence: 3 },
  });
  const goaways = decodeAll(shard.frames).filter((item) => item.kind === 'GOAWAY');
  const closeOks = decodeAll(shard.frames).filter((item) => item.kind === 'CLOSE_OK');
  assert.equal(goaways.length, 1, `GOAWAY 数=${goaways.length}`);
  assert.equal(closeOks.length, 1, `CLOSE_OK 数=${closeOks.length}`);
  assert.equal(shard.signals.filter((signal) => signal === `settled:${worker.namespaceId}`).length, 1, `settled=${JSON.stringify(shard.signals)}`);
  assert.equal(shard.hubClose?.code, 1001, `drain 提前完成未收口（hubClose=${JSON.stringify(shard.hubClose)}）`);
  // 阴性对照（同脚本无 reauth）：CLOSE 回合不关闭连接。
  const controlWorker = await makeWorker(1, 1000, 42);
  const withoutReauth = await runShardTrace('pass', [controlWorker], script);
  assert.equal(
    withoutReauth.hubClose,
    undefined,
    `未发起 reauth 却关闭了连接（state=${withoutReauth.state} frames=${summaryOf(withoutReauth.frames)} signals=${JSON.stringify(withoutReauth.signals)}）`,
  );
  return `GOAWAY×1 → CLOSE_NAMESPACE → settled×1 → drain 提前完成 close(1001)=${JSON.stringify(shard.hubClose)}（未 fire deadline timer）`;
});

// —— O10：宿主登记缺失（含早到 OPEN 形态）的失败语义边界（SD-2 观察，非契约硬门） ——
await oracleBlock('O10', async () => {
  const worker = await makeWorker(0, 1000, 42);
  const pipe = makePipe();
  const host = makeShardedHost(() => worker, {
    authorize: makeAuthorizer('pass', []),
    timer: makeFakeTimer().timer,
    limits: LIMITS,
    timeouts: TIMEOUTS,
  });
  const connection = await host.factory.acceptTrusted(pipe.hubTransport, { peerInstanceId: PEER_INSTANCE });
  assert.ok(connection !== undefined, 'sa6 probe: 分片 acceptTrusted 拒绝');
  // 故意**不**登记 host.connections：resolver 无法按 connectionKey 取 egress（早到 OPEN 的形态）。
  pipe.sendInbound(helloFrame(1));
  await settle();
  pipe.sendInbound(openFrame(worker.namespaceId, 2));
  await settle();
  const decoded = decodeAll(pipe.frames());
  const internal = decoded.filter((item) => item.kind === 'ERROR' && item.code === 'INTERNAL_ERROR' && item.namespaceId === undefined);
  assert.equal(decoded.filter((item) => item.kind === 'HELLO_ACK').length, 1, `HELLO_ACK=${summaryOf(pipe.frames())}`);
  assert.equal(internal.length, 1, `连接级 INTERNAL_ERROR 数=${internal.length}（wire=${summaryOf(pipe.frames())}）`);
  assert.equal(host.sessions.length, 0, `会话数=${host.sessions.length}（零静默建会话）`);
  assert.ok(pipe.hubCloseInfo() !== undefined, '连接未收口（应响亮 close）');
  return `登记缺失 → 连接级 ERROR(INTERNAL_ERROR)#${internal[0]!.sequence} + close(${JSON.stringify(pipe.hubCloseInfo())})，零会话（响亮收口，无静默 fallback）`;
});

// —— NC1：从未 OPEN 的 ns 帧 → 合成 NAMESPACE_STATE_VIOLATION（双形态） ——
await oracleBlock('NC1', async () => {
  const worker = await makeWorker(0, 1000, 42);
  const monoWorker = await makeWorker(0, 1000, 42);
  const unknown = `ns-${'c'.repeat(32)}`;
  const script = [helloFrame(1), closeFrame(unknown, 2)];
  const mono = await runMonolithTrace('pass', monoWorker.registry, script);
  const shard = await runShardTrace('pass', [worker], script);
  const parity = parityOf(mono, shard);
  assert.ok(parity.ok, `parity 失败：${parity.detail}`);
  assert.ok(errorCodesOf(shard.frames).includes('NAMESPACE_STATE_VIOLATION'), '未合成 NAMESPACE_STATE_VIOLATION');
  assert.notEqual(shard.state, 'closed', `连接被收口 state=${shard.state}`);
  return `合成违例逐字节相等（state=${shard.state}；${summaryOf(shard.frames)}）`;
});

// —— NC4：chunked 协商形态 parity ——
await oracleBlock('NC4', async () => {
  const worker = await makeWorker(0, 1000, 42);
  const monoWorker = await makeWorker(0, 1000, 42);
  const script = [helloFrame(1, CAP_CHUNKED_UPDATE), openFrame(worker.namespaceId, 2)];
  const mono = await runMonolithTrace('pass', monoWorker.registry, script);
  const shard = await runShardTrace('pass', [worker], script);
  const parity = parityOf(mono, shard);
  assert.ok(parity.ok, `parity 失败：${parity.detail}`);
  assert.equal(shard.opens[0]?.selectedCapabilities, CAP_CHUNKED_UPDATE, '描述符 selectedCapabilities 未携带协商位');
  const helloAck = decodeAll(shard.frames).find((item) => item.kind === 'HELLO_ACK');
  assert.ok(helloAck !== undefined, 'HELLO_ACK 缺失');
  return `协商形态 parity 成立；描述符 selectedCapabilities=${String(shard.opens[0]?.selectedCapabilities)}；${parity.detail}`;
});

// ═══════════════════════════ 结果与退出码 ═══════════════════════════

const gapsConfirmed = gaps.filter((entry) => entry.ok).length;
const failedOracles = oracles.filter((entry) => !entry.ok);
console.log(`SA6_PROBE_RESULT gaps=${gapsConfirmed}/${gaps.length} oracles=${oracles.length - failedOracles.length}/${oracles.length}`);
if (gapsConfirmed !== gaps.length) {
  console.log('SA6_PROBE_VERDICT=REJECT (capability gap 未确认)');
  process.exitCode = 1;
} else if (failedOracles.length > 0) {
  console.log(`SA6_PROBE_VERDICT=ORACLE_RED (${failedOracles.map((entry) => entry.id).join(',')})`);
  process.exitCode = 2;
} else {
  console.log('SA6_PROBE_VERDICT=CONFIRMED (能力缺口成立；目标行为 oracle 全绿)');
}
