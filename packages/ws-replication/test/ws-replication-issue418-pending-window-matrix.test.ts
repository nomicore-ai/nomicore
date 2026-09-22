/**
 * issue #418 M1/M2/M3 —— **pending（慢授权器）窗口行为矩阵** + drain-pending + 状态迁移零新事件。
 *
 * 依据：`wiki/raw/task_issue-418_design.md` §12（M1 必做矩阵 / M2 drain-pending / M3 零新事件）
 * 与 §2.2（authorize 窗口帧矩阵，逐行源码锚）。SA2 F1 裁定：authorize 窗口内的同 ns 非 OPEN
 * 帧**不是**「静默丢弃」面——除 SYNC_STEP1/2 的 RoundAborted 外全部产生 wire 帧与/或观测事件，
 * 其中 UPDATE_ACK 可触发连接级 fatal。因此本文件是 F1「pending 帧行为唯一可判定」的
 * 逐臂特征化锚：**HEAD 上先行采集基线（全绿），拆分实现后必须保持全绿**（设计 §12 方法论）；
 * iteration 2 机制（到达点建通道 + 异步 edge-owned admission 拉取）下窗口效应回到 HEAD
 * 到达点形态，本文件再加**到达点断言**（响亮臂的 wire/事件效应在 `resolve()` 之前已产出
 * ——镜像既有 I13a）。
 *
 * 纪律：
 * - 生产行为断言（经 `createHubReplication` 公共入口 + hub-only fixture + 真实
 *   Registry/Runtime + 手写 duplex transport）——不依赖拆分形态；
 * - deferred authorizer（手动结算的授权器 promise）是窗口的唯一驱动；
 * - 零源码 grep 断言、零 skip/only/todo、零 env override、零真实 sleep
 *   （fake scheduler `advanceBy` 驱动 timer）；
 * - M1 逐臂断言**单 namespace** 的 wire 帧序 + observer 事件序 + authorize 调用数
 *   （窗口效应到达点产出 = HEAD 形态，跨 ns 交错无登记差）。
 */
import { describe, expect, it } from 'vitest';
import { CAP_CHUNKED_UPDATE, decodeMessage, encodeMessage } from '@nomicore/replication-protocol';
import type { ReplicationMessage } from '@nomicore/replication-protocol';
import { createHubReplication } from '@nomicore/ws-replication';
import type {
  HubReplication,
  NamespaceAuthorization,
  NamespaceAuthorizer,
  ReplicationObserverEvent,
} from '@nomicore/ws-replication';
import { DEFAULT_PEER_VERIFIER } from './driver.js';
import {
  HUB_INSTANCE,
  HUB_OWNER,
  PEER_INSTANCE,
  makeHubNamespace,
  makeNode,
  settle,
  settleUntil,
} from './harness.js';
import type { DuplexTransport, ReplicaNode } from './harness.js';

// ═══════════════════════════ 授权策略 / deferred authorizer ═══════════════════════════

type AuthzVerdict = 'deferred' | 'ok' | 'deny' | 'throw';

const AUTHORIZED: NamespaceAuthorization = {
  ok: true,
  localOwner: HUB_OWNER,
  permissions: { read: true, submit: true },
};

// ═══════════════════════════ hub-only duplex transport（含 liveness 面） ═══════════════════════════

interface MatrixTransport {
  /** 交给 hub 实现的端（暴露 ping/onPong → liveness 武装；M3b 依赖）。 */
  readonly hubEnd: DuplexTransport & {
    ping(data?: Uint8Array): void;
    onPong(listener: (payload?: Uint8Array) => void): () => void;
  };
  /** 以 peer 身份投递一帧（微任务投递，与 harness 同款）。 */
  send(bytes: Uint8Array): void;
  frames(): readonly Uint8Array[];
  closeInfo(): Readonly<{ code: number; reason: string }> | undefined;
  pings(): number;
}

function makeMatrixTransport(): MatrixTransport {
  const messageListeners = new Set<(bytes: Uint8Array) => void>();
  const closeListeners = new Set<(info: Readonly<{ code: number; reason: string }>) => void>();
  const pongListeners = new Set<(payload?: Uint8Array) => void>();
  const frames: Uint8Array[] = [];
  let closed = false;
  let closeInfo: Readonly<{ code: number; reason: string }> | undefined;
  let pings = 0;

  const hubEnd = {
    send(bytes: Uint8Array): void {
      if (closed) return;
      frames.push(bytes.slice());
    },
    close(code = 1000, reason = ''): void {
      if (closed) return;
      closed = true;
      closeInfo = { code, reason };
    },
    get closed(): boolean {
      return closed;
    },
    onMessage(listener: (bytes: Uint8Array) => void): () => void {
      messageListeners.add(listener);
      return () => messageListeners.delete(listener);
    },
    onClose(listener: (info: Readonly<{ code: number; reason: string }>) => void): () => void {
      closeListeners.add(listener);
      return () => closeListeners.delete(listener);
    },
    ping(): void {
      pings += 1;
    },
    onPong(listener: (payload?: Uint8Array) => void): () => void {
      pongListeners.add(listener);
      return () => pongListeners.delete(listener);
    },
  };

  return {
    hubEnd,
    send(bytes: Uint8Array): void {
      if (closed) return;
      const copy = bytes.slice();
      queueMicrotask(() => {
        for (const listener of [...messageListeners]) listener(copy);
      });
    },
    frames: () => frames,
    closeInfo: () => closeInfo,
    pings: () => pings,
  };
}

// ═══════════════════════════ fixture ═══════════════════════════

const HELLO_NONCE = new Uint8Array(16).fill(0x80);

/** HELLO 开启 CAP_CHUNKED_UPDATE 协商（UPDATE_CHUNK 矩阵臂的 decode 门控前提；
 *  其余臂零影响——协商位只改 HELLO_ACK.selectedCapabilities 与 0x42 门控）。 */
function helloMessage(): ReplicationMessage {
  return {
    kind: 'HELLO',
    peerInstanceId: PEER_INSTANCE,
    expectedHubInstanceId: HUB_INSTANCE,
    protocolVersions: [1],
    requiredCapabilities: 0,
    optionalCapabilities: CAP_CHUNKED_UPDATE,
    connectionNonce: HELLO_NONCE,
  };
}

interface MatrixHub {
  readonly hub: HubReplication;
  readonly node: ReplicaNode;
  readonly nsId: string;
  readonly transport: MatrixTransport;
  readonly events: ReplicationObserverEvent[];
  readonly calls: Array<Readonly<{ instanceIdentity: string; namespaceId: string }>>;
  /** 通道状态只读对象图投影（既有白盒模式：`hub.connections[0].channels`）。 */
  channelState(namespaceId: string): string | undefined;
  /** registry.open 调用计数（资源面锚；仅 observeResources 时有效）。 */
  registryOpenCalls(): number;
  /** registry observer 的 `lease-released.remainingLeases` 序列（资源面锚）。 */
  readonly leaseReleasedSeq: number[];
  addNamespace(): Promise<string>;
  resolveNext(verdict: 'ok' | 'deny'): void;
  send(message: ReplicationMessage, sequence: number): Promise<void>;
  close(): Promise<void>;
}

async function makeMatrixHub(
  policy: (namespaceId: string) => AuthzVerdict,
  opts: { observeResources?: boolean } = {},
): Promise<MatrixHub> {
  const leaseReleasedSeq: number[] = [];
  const registryObserver = (event: unknown): void => {
    const e = event as { type?: string; remainingLeases?: number };
    if (e.type === 'lease-released' && typeof e.remainingLeases === 'number') {
      leaseReleasedSeq.push(e.remainingLeases);
    }
  };
  const node = opts.observeResources === true ? makeNode('hub', registryObserver) : makeNode('hub');
  const fixture = await makeHubNamespace(node);
  let registryOpenCalls = 0;
  // 资源面 spy：仅在 fixture 建好之后包 Proxy（建 ns 走 create，不经 open）
  const registry =
    opts.observeResources === true
      ? new Proxy(node.registry, {
          get(target, property, receiver) {
            if (property === 'open') {
              return (...args: unknown[]) => {
                registryOpenCalls += 1;
                return (target.open as (...inner: unknown[]) => unknown)(...args);
              };
            }
            const value = Reflect.get(target, property, receiver) as unknown;
            return typeof value === 'function'
              ? (value as (...inner: unknown[]) => unknown).bind(target)
              : value;
          },
        })
      : node.registry;
  const events: ReplicationObserverEvent[] = [];
  const calls: Array<Readonly<{ instanceIdentity: string; namespaceId: string }>> = [];
  const pendingSettlers: Array<(authorization: NamespaceAuthorization) => void> = [];
  const authorize: NamespaceAuthorizer = (instanceIdentity, namespaceId) => {
    calls.push({ instanceIdentity, namespaceId });
    const verdict = policy(namespaceId);
    if (verdict === 'ok') return Promise.resolve(AUTHORIZED);
    if (verdict === 'deny') return Promise.resolve({ ok: false });
    if (verdict === 'throw') return Promise.reject(new Error('matrix: authorizer threw'));
    return new Promise<NamespaceAuthorization>((resolve) => {
      pendingSettlers.push(resolve);
    });
  };
  const transport = makeMatrixTransport();
  const hub = createHubReplication({
    instanceId: HUB_INSTANCE,
    registry,
    authorize,
    timer: node.scheduler,
    verifyToken: DEFAULT_PEER_VERIFIER,
    observer: (event) => {
      events.push(event);
    },
  });
  const connection = await hub.acceptTrusted!(transport.hubEnd, { peerInstanceId: PEER_INSTANCE });
  expect(connection).toBeDefined();
  return {
    hub,
    node,
    nsId: fixture.namespaceId,
    transport,
    events,
    calls,
    channelState(namespaceId: string): string | undefined {
      const projection = hub.connections[0] as unknown as {
        channels: Map<string, { state: string }>;
      };
      return projection?.channels.get(namespaceId)?.state;
    },
    registryOpenCalls: () => registryOpenCalls,
    leaseReleasedSeq,
    async addNamespace(): Promise<string> {
      return (await makeHubNamespace(node)).namespaceId;
    },
    resolveNext(verdict: 'ok' | 'deny'): void {
      const settler = pendingSettlers.shift();
      if (settler === undefined) throw new Error('matrix: 无在途 authorize 待结算');
      settler(verdict === 'ok' ? AUTHORIZED : { ok: false });
    },
    async send(message: ReplicationMessage, sequence: number): Promise<void> {
      transport.send(encodeMessage(message, { sequence }));
      await settle();
    },
    async close(): Promise<void> {
      await hub.close();
      await settle();
    },
  };
}

// ═══════════════════════════ 帧 / 事件描述子 ═══════════════════════════

/** 出站帧描述子：namespace 域 ERROR 与连接级 ERROR 区分；CLOSE_OK 带 ackedSequence。 */
function describeFrame(bytes: Uint8Array): string {
  const message = decodeMessage(bytes).message;
  if (message.kind === 'ERROR') {
    return `ERROR:${message.code}:${message.namespaceId === undefined ? 'conn' : 'ns'}`;
  }
  if (message.kind === 'CLOSE_OK') return `CLOSE_OK:${message.ackedSequence}`;
  return message.kind;
}

function describeFrames(frames: readonly Uint8Array[]): string[] {
  return frames.map(describeFrame);
}

/** observer 事件描述子（只列矩阵断言需要的域）。 */
function describeEvent(event: ReplicationObserverEvent): string {
  switch (event.type) {
    case 'namespace-error':
      return `namespace-error:${event.direction}:${event.code}`;
    case 'channel-state-changed':
      return `channel-state-changed:${event.from}->${event.to}`;
    case 'connection-state-changed':
      return `connection-state-changed:${event.from}->${event.to}`;
    case 'namespace-failed':
      return `namespace-failed:${event.cause}`;
    case 'connection-failed':
      return `connection-failed:${event.code}`;
    case 'resync-required':
      return `resync-required:${event.cause}`;
    default:
      return event.type;
  }
}

function describeEvents(events: readonly ReplicationObserverEvent[]): string[] {
  return events.map(describeEvent);
}

function kindsOf(frames: readonly Uint8Array[]): string[] {
  return frames.map((bytes) => decodeMessage(bytes).message.kind);
}

// ═══════════════════════════ M1 臂定义 ═══════════════════════════

/**
 * 逐臂期望 = **窗口帧到达点产出 + authorize 结算续体**的合计可观察序列（单 ns）。
 *
 * 等价判据（设计 §1/§2.2/§12 + SA8 注 C'）：窗口帧在**到达点**即时进入在场 `'opening'`
 * 通道（= HEAD 时序；通道在首个 OPEN 到达点同步建立），其 wire/事件效应**先于** authorize
 * 结局产出；`arrival` 即该时点锚（镜像既有 I13a：`resolve()` 之前效应已在 wire 上），
 * `ok`/`deny` 为合计序列。静默丢弃/edge 复现/结算段回放/提前收口等失败形态都会在此变红。
 */
interface ArmExpectation {
  /** hub→peer 出站帧（不含 HELLO_ACK），按序。 */
  readonly frames: readonly string[];
  /** observer 事件（不含 `connection-state-changed:handshaking->ready`），按序。 */
  readonly events: readonly string[];
  /** Yjs 载荷帧数不稳定时只断言前缀。 */
  readonly prefixOnly?: boolean;
}

interface ArmSpec {
  readonly name: string;
  /** authorize 在途时到达的同 ns 帧（入站 seq 3）。 */
  readonly frame: (nsId: string) => ReplicationMessage;
  /** 到达点（authorize 结局产出**之前**）的即时效应——必须与 HEAD 逐点一致（D5.1）。 */
  readonly arrival: ArmExpectation;
  /** resolve-ok 结算后的合计序列。 */
  readonly ok: ArmExpectation;
  /** resolve-deny 结算后的合计序列。 */
  readonly deny: ArmExpectation;
  /** 窗口帧引发的连接级 fatal 的 close 观测。 */
  readonly fatalClose?: Readonly<{ code: number; reason: string }>;
}

const WINDOW_UPDATE = new Uint8Array([1, 2, 3, 4]);
const OVERSIZE_UPDATE = new Uint8Array(512 * 1024 + 1).fill(0x5a);

const FAILED_BY_STATE_VIOLATION: ArmExpectation = {
  frames: ['ERROR:NAMESPACE_STATE_VIOLATION:ns'],
  events: [
    'namespace-error:sent:NAMESPACE_STATE_VIOLATION',
    'channel-state-changed:opening->failed',
    'namespace-failed:protocol-violation',
  ],
};

const OVERSIZE_AT_ARRIVAL: ArmExpectation = {
  frames: ['ERROR:UPDATE_TOO_LARGE:ns'],
  events: [
    'namespace-error:sent:UPDATE_TOO_LARGE',
    'channel-state-changed:opening->failed',
    'namespace-failed:protocol-violation',
  ],
};

const SYNC_STATE_VIOLATION: ArmExpectation = {
  frames: ['ERROR:SYNC_STATE_VIOLATION:ns'],
  events: [
    'namespace-error:sent:SYNC_STATE_VIOLATION',
    'channel-state-changed:opening->failed',
    'namespace-failed:protocol-violation',
  ],
};

const CLOSED_AT_ARRIVAL: ArmExpectation = {
  frames: ['CLOSE_OK:3'],
  events: ['channel-state-changed:opening->closing', 'channel-state-changed:closing->closed'],
};

/** 窗口 UPDATE_ACK → 连接级 fatal（到达点即收口；§2.2 矩阵行）。 */
const ACK_FATAL: ArmExpectation = {
  frames: ['ERROR:ACK_STATE_VIOLATION:conn'],
  events: [
    'connection-state-changed:ready->closed',
    'channel-state-changed:opening->closing',
    'connection-failed:ACK_STATE_VIOLATION',
    // 连接收口链的异步尾（cleanupAll → onConnectionClosed）
    'channel-state-changed:closing->closed',
  ],
};

const RESYNC_DECLARED: ArmExpectation = {
  frames: [],
  events: [
    'channel-state-changed:opening->needs-resync',
    'resync-required:remote-declared',
  ],
};

const ARMS: readonly ArmSpec[] = [
  {
    name: 'UPDATE（字段合法）',
    frame: (nsId) => ({ kind: 'UPDATE', namespaceId: nsId, update: WINDOW_UPDATE }),
    arrival: FAILED_BY_STATE_VIOLATION,
    ok: FAILED_BY_STATE_VIOLATION,
    deny: FAILED_BY_STATE_VIOLATION,
  },
  {
    name: 'UPDATE（字段超限 UPDATE_TOO_LARGE）',
    frame: (nsId) => ({ kind: 'UPDATE', namespaceId: nsId, update: OVERSIZE_UPDATE }),
    arrival: OVERSIZE_AT_ARRIVAL,
    ok: OVERSIZE_AT_ARRIVAL,
    deny: OVERSIZE_AT_ARRIVAL,
  },
  {
    name: 'UPDATE_CHUNK（kind=0 首 chunk）',
    frame: (nsId) => ({
      kind: 'UPDATE_CHUNK',
      transferKind: 0,
      namespaceId: nsId,
      transferId: 1,
      chunkIndex: 0,
      chunkCount: 1,
      totalBytes: 4,
      bytes: WINDOW_UPDATE,
    }),
    arrival: FAILED_BY_STATE_VIOLATION,
    ok: FAILED_BY_STATE_VIOLATION,
    deny: FAILED_BY_STATE_VIOLATION,
  },
  {
    name: 'UPDATE_CHUNK（kind=2 首 chunk，无活跃 round）',
    frame: (nsId) => ({
      kind: 'UPDATE_CHUNK',
      transferKind: 2,
      namespaceId: nsId,
      transferId: 1,
      chunkIndex: 0,
      chunkCount: 1,
      totalBytes: 4,
      bytes: WINDOW_UPDATE,
      syncRoundId: 1,
    }),
    arrival: SYNC_STATE_VIOLATION,
    ok: SYNC_STATE_VIOLATION,
    deny: SYNC_STATE_VIOLATION,
  },
  {
    name: 'CLOSE_NAMESPACE（窗口内自然收口）',
    frame: (nsId) => ({ kind: 'CLOSE_NAMESPACE', namespaceId: nsId, reasonCode: 'peer-close' }),
    arrival: CLOSED_AT_ARRIVAL,
    ok: CLOSED_AT_ARRIVAL,
    deny: CLOSED_AT_ARRIVAL,
  },
  {
    name: 'ERROR（带本 nsId）',
    frame: (nsId) => ({
      kind: 'ERROR',
      code: 'NAMESPACE_STATE_VIOLATION',
      safeMessage: 'protocol error: NAMESPACE_STATE_VIOLATION',
      namespaceId: nsId,
    }),
    arrival: {
      frames: [],
      events: [
        'namespace-error:received:NAMESPACE_STATE_VIOLATION',
        'channel-state-changed:opening->failed',
        'namespace-failed:remote-error',
      ],
    },
    ok: {
      frames: [],
      events: [
        'namespace-error:received:NAMESPACE_STATE_VIOLATION',
        'channel-state-changed:opening->failed',
        'namespace-failed:remote-error',
      ],
    },
    deny: {
      frames: [],
      events: [
        'namespace-error:received:NAMESPACE_STATE_VIOLATION',
        'channel-state-changed:opening->failed',
        'namespace-failed:remote-error',
      ],
    },
  },
  {
    name: 'BOOTSTRAP_ACK（非 bootstrapping）',
    frame: (nsId) => ({ kind: 'BOOTSTRAP_ACK', namespaceId: nsId, ackedSequence: 999 }),
    arrival: FAILED_BY_STATE_VIOLATION,
    ok: FAILED_BY_STATE_VIOLATION,
    deny: FAILED_BY_STATE_VIOLATION,
  },
  {
    name: 'UPDATE_ACK（无在途 → 连接级 fatal）',
    frame: (nsId) => ({ kind: 'UPDATE_ACK', namespaceId: nsId, ackedSequence: 4242 }),
    arrival: ACK_FATAL,
    ok: ACK_FATAL,
    deny: ACK_FATAL,
    fatalClose: { code: 1002, reason: 'protocol-error' },
  },
  {
    name: 'RESYNC_REQUIRED（needs-resync 非终态 → 结算不被中止）',
    frame: (nsId) => ({ kind: 'RESYNC_REQUIRED', namespaceId: nsId, reasonCode: 'STATE_DIVERGED' }),
    arrival: RESYNC_DECLARED,
    ok: {
      frames: ['OPEN_OK'],
      events: [
        'channel-state-changed:opening->needs-resync',
        'resync-required:remote-declared',
        'channel-state-changed:needs-resync->bootstrapping',
      ],
      prefixOnly: true,
    },
    deny: {
      frames: ['ERROR:NAMESPACE_UNAUTHORIZED:ns'],
      events: [
        'channel-state-changed:opening->needs-resync',
        'resync-required:remote-declared',
        'namespace-error:sent:NAMESPACE_UNAUTHORIZED',
        'channel-state-changed:needs-resync->failed',
        'namespace-failed:open-failed',
      ],
    },
  },
  {
    name: '再 OPEN（同 ns 合流）',
    frame: (nsId) => ({ kind: 'OPEN_NAMESPACE', namespaceId: nsId, hasLocalReplica: false }),
    arrival: { frames: [], events: [] }, // 'opening' 合流：零 authorize、零帧（openWaiters）
    ok: {
      frames: ['OPEN_OK'],
      events: [],
      prefixOnly: true,
    },
    deny: {
      // 两个 waiter（首 OPEN + 窗口内再 OPEN）各得一帧 ns ERROR（§2.2「N 个 OPEN → N 帧」）
      frames: ['ERROR:NAMESPACE_UNAUTHORIZED:ns', 'ERROR:NAMESPACE_UNAUTHORIZED:ns'],
      events: [
        'namespace-error:sent:NAMESPACE_UNAUTHORIZED',
        'channel-state-changed:opening->failed',
        'namespace-failed:open-failed',
      ],
    },
  },
];

/** 单臂单结算模式的完整驱动 + 断言。 */
async function runArm(arm: ArmSpec, mode: 'ok' | 'deny'): Promise<void> {
  const fixture = await makeMatrixHub(() => 'deferred');
  try {
    await fixture.send(helloMessage(), 1);
    expect(kindsOf(fixture.transport.frames())).toEqual(['HELLO_ACK']);
    const baseFrames = fixture.transport.frames().length;
    const baseEvents = fixture.events.length;
    await fixture.send({ kind: 'OPEN_NAMESPACE', namespaceId: fixture.nsId, hasLocalReplica: false }, 2);
    // authorize 在途：零出站、恰好一次真实调用；通道已在场（到达点建通道 = HEAD 时序）
    expect(kindsOf(fixture.transport.frames())).toEqual(['HELLO_ACK']);
    expect(fixture.channelState(fixture.nsId)).toBe('opening');
    expect(fixture.calls).toEqual([{ instanceIdentity: PEER_INSTANCE, namespaceId: fixture.nsId }]);

    await fixture.send(arm.frame(fixture.nsId), 3);
    // ── 到达点断言（镜像 I13a）：窗口帧效应在 authorize 结局产出**之前**已上 wire/事件 ──
    expect(describeFrames(fixture.transport.frames().slice(baseFrames))).toEqual([
      ...arm.arrival.frames,
    ]);
    expect(describeEvents(fixture.events.slice(baseEvents))).toEqual([...arm.arrival.events]);

    fixture.resolveNext(mode);
    await settle();
    await settle();

    const expected = mode === 'ok' ? arm.ok : arm.deny;
    const frames = describeFrames(fixture.transport.frames().slice(baseFrames));
    const events = describeEvents(fixture.events.slice(baseEvents));
    if (expected.prefixOnly === true) {
      expect(frames.slice(0, expected.frames.length)).toEqual([...expected.frames]);
      expect(events.slice(0, expected.events.length)).toEqual([...expected.events]);
    } else {
      expect(frames).toEqual([...expected.frames]);
      expect(events).toEqual([...expected.events]);
    }
    // authorize 恰一次：结算经 shim 拉取回放，绝不触达真实授权器（C2c/C2d 语义）
    expect(fixture.calls).toEqual([{ instanceIdentity: PEER_INSTANCE, namespaceId: fixture.nsId }]);
    if (arm.fatalClose !== undefined) {
      expect(fixture.transport.closeInfo()).toEqual(arm.fatalClose);
    } else {
      expect(fixture.transport.closeInfo()).toBeUndefined();
    }
    await fixture.close();
  } finally {
    await fixture.hub.close();
  }
}


describe('M1（SA2 F1 必做）：pending authorize 窗口帧矩阵——逐臂对 HEAD 基线（拆分后须保持）', () => {
  it('M1-0：无窗口帧基线——deny 结算 N=1 → 1 帧 ns ERROR + 3 事件；ok 结算 → OPEN_OK', async () => {
    const denyRun = await makeMatrixHub(() => 'deferred');
    await denyRun.send(helloMessage(), 1);
    await denyRun.send({ kind: 'OPEN_NAMESPACE', namespaceId: denyRun.nsId, hasLocalReplica: false }, 2);
    const denyEvents = denyRun.events.length;
    denyRun.resolveNext('deny');
    await settle();
    await settle();
    expect(describeFrames(denyRun.transport.frames())).toEqual([
      'HELLO_ACK',
      'ERROR:NAMESPACE_UNAUTHORIZED:ns',
    ]);
    expect(describeEvents(denyRun.events.slice(denyEvents))).toEqual([
      'namespace-error:sent:NAMESPACE_UNAUTHORIZED',
      'channel-state-changed:opening->failed',
      'namespace-failed:open-failed',
    ]);
    expect(denyRun.calls).toHaveLength(1);
    await denyRun.close();

    const okRun = await makeMatrixHub(() => 'deferred');
    await okRun.send(helloMessage(), 1);
    await okRun.send({ kind: 'OPEN_NAMESPACE', namespaceId: okRun.nsId, hasLocalReplica: false }, 2);
    okRun.resolveNext('ok');
    await settle();
    await settle();
    expect(kindsOf(okRun.transport.frames())[1]).toBe('OPEN_OK');
    expect(okRun.calls).toHaveLength(1);
    await okRun.close();
  }, 60_000);

  for (const arm of ARMS) {
    it(`M1：${arm.name} × resolve-ok（结算被 isOpenAborted 吸收或完整执行）`, async () => {
      await runArm(arm, 'ok');
    }, 60_000);

    it(`M1：${arm.name} × resolve-deny（失败面由零 diff 通道原生承载）`, async () => {
      await runArm(arm, 'deny');
    }, 60_000);
  }

  it('M1-revoke：窗口期 revoke → 到达点 NAMESPACE_UNAUTHORIZED + protocol-violation + settled；迟归 ok = HEAD 原生 D-H1（transient registry.open 恰一次 + lease 释放，零新帧零新事件）', async () => {
    const fixture = await makeMatrixHub(() => 'deferred', { observeResources: true });
    try {
      await fixture.send(helloMessage(), 1);
      await fixture.send({ kind: 'OPEN_NAMESPACE', namespaceId: fixture.nsId, hasLocalReplica: false }, 2);
      // 到达点锁步：authorize 在途时通道已在场 ⟹ revoke 经在场通道原生承载（= HEAD I11）
      expect(fixture.channelState(fixture.nsId)).toBe('opening');
      expect(fixture.registryOpenCalls()).toBe(0); // 窗口期零会话资源唤起（authorize 未结算）
      const eventsBefore = fixture.events.length;
      await fixture.hub.revoke(PEER_INSTANCE, fixture.nsId);
      await settle();
      expect(describeFrames(fixture.transport.frames())).toEqual([
        'HELLO_ACK',
        'ERROR:NAMESPACE_UNAUTHORIZED:ns',
      ]);
      expect(describeEvents(fixture.events.slice(eventsBefore))).toEqual([
        'namespace-error:sent:NAMESPACE_UNAUTHORIZED',
        'channel-state-changed:opening->failed',
        'namespace-failed:protocol-violation',
      ]);
      expect(fixture.registryOpenCalls()).toBe(0); // revoke 本身不唤起会话资源

      // ── 迟归 authorize（ok）：HEAD 原生 D-H1 路径（SILENT 分支）——registry.open 恰一次
      //    transient 调用 + 已交付 lease 显式回收；零新帧零新事件（= HEAD 基线，M1-revoke 重定基） ──
      const framesBeforeLate = fixture.transport.frames().length;
      const eventsBeforeLate = fixture.events.length;
      fixture.resolveNext('ok');
      await settle();
      await settle();
      expect(fixture.registryOpenCalls()).toBe(1);
      expect(fixture.leaseReleasedSeq).toHaveLength(1); // 迟归 lease 恰一次释放（零泄漏）
      expect(fixture.leaseReleasedSeq.at(-1)).toBe(1); // 仅 fixture lease 存活
      expect(fixture.transport.frames().length).toBe(framesBeforeLate);
      expect(fixture.events.length).toBe(eventsBeforeLate);
    } finally {
      await fixture.close();
    }
  }, 60_000);
});

// ═══════════════════════════ M2 drain-pending ═══════════════════════════

describe('M2（SA2 F2）：GOAWAY drain 的提前完成不得跨过 pending（authorize 在途）通道', () => {
  it('M2：pending nsA + nsB 自然收口 → 不提前 1001；nsA 结算后才收口', async () => {
    let deferredNamespaceId: string | undefined;
    const fixture = await makeMatrixHub((namespaceId) =>
      namespaceId === deferredNamespaceId ? 'deferred' : 'ok',
    );
    try {
      deferredNamespaceId = fixture.nsId;
      await fixture.send(helloMessage(), 1);
      await fixture.send({ kind: 'OPEN_NAMESPACE', namespaceId: fixture.nsId, hasLocalReplica: false }, 2);
      const nsB = await fixture.addNamespace();
      await fixture.send({ kind: 'OPEN_NAMESPACE', namespaceId: nsB, hasLocalReplica: false }, 3);
      await settleUntil(
        () => kindsOf(fixture.transport.frames()).includes('BOOTSTRAP_SNAPSHOT'),
        'nsB bootstrap 出站',
      );
      expect(fixture.calls).toHaveLength(2); // nsA pending + nsB 即时授权

      // reauth：GOAWAY + drain 窗口（nsA 仍 pending）
      void fixture.hub.requestReauth(PEER_INSTANCE);
      await settle();
      expect(describeFrames(fixture.transport.frames()).at(-1)).toBe('GOAWAY');

      // nsB 自然收口（drain 门放行 CLOSE 族）→ 触发提前完成判定；nsA pending ⇒ 必须阻塞
      await fixture.send({ kind: 'CLOSE_NAMESPACE', namespaceId: nsB, reasonCode: 'peer-close' }, 4);
      await settleUntil(
        () => kindsOf(fixture.transport.frames()).includes('CLOSE_OK'),
        'nsB CLOSE_OK',
      );
      await settle();
      expect(fixture.transport.closeInfo()).toBeUndefined(); // 不得提前收口（iteration 0 式漏 pending → 此处红）
      const framesBeforeSettle = fixture.transport.frames().length;

      // nsA 结算（deny）→ 通道 failed + settled → drain 三态全集放行 → 提前 1001 收口
      fixture.resolveNext('deny');
      await settleUntil(() => fixture.transport.closeInfo() !== undefined, 'drain 提前收口');
      expect(fixture.transport.closeInfo()).toEqual({ code: 1001, reason: 'hub-reauth' });
      const delta = describeFrames(fixture.transport.frames().slice(framesBeforeSettle));
      expect(delta[0]).toBe('ERROR:NAMESPACE_UNAUTHORIZED:ns');
      expect(fixture.calls).toHaveLength(2);
    } finally {
      await fixture.close();
    }
  }, 60_000);
});

// ═══════════════════════════ M3 状态迁移零新事件 ═══════════════════════════

describe('M3（SA2 F3）：beginReauth 与 liveness 失联的直赋迁移零 connection-state-changed', () => {
  it('M3a：ready→draining 直赋零事件；deadline 的 close 路径 closed 恰一事件', async () => {
    const fixture = await makeMatrixHub(() => 'deferred');
    try {
      await fixture.send(helloMessage(), 1);
      expect(
        describeEvents(fixture.events.filter((event) => event.type === 'connection-state-changed')),
      ).toEqual(['connection-state-changed:handshaking->ready']);
      const framesBefore = fixture.transport.frames().length;
      void fixture.hub.requestReauth(PEER_INSTANCE);
      await settle();
      // draining 迁移：直赋、零 connection-state-changed（GOAWAY 同步冲刷）
      expect(
        describeEvents(fixture.events.filter((event) => event.type === 'connection-state-changed')),
      ).toEqual(['connection-state-changed:handshaking->ready']);
      expect(describeFrames(fixture.transport.frames().slice(framesBefore))).toEqual(['GOAWAY']);
      // deadline（closeTimeoutMs 缺省 5000）→ close(1001,'hub-reauth')；该路径经 setConnState
      // 发射恰一 draining->closed
      await fixture.node.scheduler.advanceBy(5_000);
      await settle();
      expect(
        describeEvents(fixture.events.filter((event) => event.type === 'connection-state-changed')),
      ).toEqual([
        'connection-state-changed:handshaking->ready',
        'connection-state-changed:draining->closed',
      ]);
      expect(fixture.transport.closeInfo()).toEqual({ code: 1001, reason: 'hub-reauth' });
    } finally {
      await fixture.hub.close();
    }
  }, 60_000);

  it('M3b：pong 超时 → closed 直赋零事件 + close(1001,\'pong-timeout\')', async () => {
    const fixture = await makeMatrixHub(() => 'deferred');
    try {
      await fixture.send(helloMessage(), 1);
      expect(fixture.transport.pings()).toBe(0);
      await fixture.node.scheduler.advanceBy(30_000); // pingIntervalMs 缺省 30s
      expect(fixture.transport.pings()).toBe(1);
      await fixture.node.scheduler.advanceBy(10_000); // pongTimeoutMs 缺省 10s → 失联
      await settle();
      expect(
        describeEvents(fixture.events.filter((event) => event.type === 'connection-state-changed')),
      ).toEqual(['connection-state-changed:handshaking->ready']);
      expect(fixture.transport.closeInfo()).toEqual({ code: 1001, reason: 'pong-timeout' });
    } finally {
      await fixture.hub.close();
    }
  }, 60_000);
});
