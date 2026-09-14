/**
 * issue #389（ADR 0030 T3「复制来源与订阅终止」）契约共享 fixture ——
 * 行为契约 `issue-389-change-subscription-termination-red.test.ts` 专用；
 * 非测试文件，vitest 不收集（沿 #369/#387 先例：fixture 无 describe/it）。
 *
 * 契约来源：
 * - issue #389 What-to-build + AC1–AC7（复制来源 / 两路径 schema-changed /
 *   doc-replaced / 流末条静默 / FIFO / 终止后重建 / 零新接缝）；
 * - `wiki/raw/task_issue-389_sa6_contract.md` §12.1 绑定表 B-T3-0–B-T3-6（全部
 *   取值 = SA6 默认；SA1 冻结裁定与默认一致）与 §12.3 最小输入；
 * - `wiki/raw/task_issue-389_design.md` §7-D1–D6、§12（SA1 iteration 1 批准版）；
 * - `docs/adr/0030-change-subscription.md` §4/§5/§6/§7；`docs/adr/0018-peer-schema-rearm.md`。
 *
 * 装置纪律（SA6 §12.5）：
 * - 真实 Registry（`createNamespaceRegistryForTesting`）+ 真实 Runtime
 *   （`createNamespaceRuntimeWithSeam`——runtimeFactory 包装以保留 runtime 引用，
 *   C11 键集守卫的观测面）+ 真实 Yjs；stub 仅作持久化 seam（受控随机源 / manual
 *   clock / fake scheduler），零 mock 本地服务、零网络、零墙钟；
 * - 远端 update 构造一律「live doc 全量状态 bootstrap → 只写新键 / 只改 SCHEMA
 *   text」（Yjs 确定性纪律：新键无并发项，clientID 决胜不可确定面不参与）；
 * - 异步分发等待 = sink 计数 + `expect.poll`（5ms/2s），静默断言用微任务预算而非
 *   sleep；
 * - 全部断言锚 lease 公共面（零 runtime 内部/Y.Doc 读数——fixture 内部编排除外）。
 *
 * schema 族（SA6 §12.3 逐字）：`tasks: Record<string,Task>`（Y.Map 载体，物化
 * t1/t2）+ 封闭对象 `meta`；`Task = {title, priority}`；V2 = Task 追加可选
 * `note?: YLeaf<string>`（**文本真变**——触发 re-arm / schema-changed）。
 */
import * as Y from 'yjs';
import { expect } from 'vitest';
import { DocDuplicateError } from '@nomicore/persistence';
import type { DocHandle, DocPersistence, User } from '@nomicore/persistence';
import type {
  NamespaceLease,
  NamespaceLeaseWatchMapNotification,
  NamespaceRegistry,
  ReplicationIdentityRef,
  ReplicationSession,
} from '@nomicore/namespace-registry';
import {
  createNamespaceRegistryForTesting,
  createRegistryTestScheduler,
} from '@nomicore/namespace-registry/testing';
import { createNamespaceRuntimeWithSeam } from '../../namespace-runtime/src/runtime.js';

// ───────────────────────── 契约常量 ─────────────────────────

export const T3_DOC_ID = 'ns-389';
export const T3_OWNER: User = { userId: 'u-389' };
export const T3_HUB_INSTANCE_ID = 'hub-a';
export const T3_PEER_INSTANCE_ID = 'peer-a';
export const T3_FIXED_MS = 1_700_000_123_456;
/** reset fixture 的种子复制身份（探针 4 同款：'a'*32 / epoch 1）。 */
export const T3_SEED_REPLICATION_ID = 'a'.repeat(32);
export const T3_SEED_REPLICATION_EPOCH = 1;

/** lease 公共面 16 键（#387 的 15 键 + watchMap；ADR 0030 T1 冻结面）。 */
export const T3_LEASE_KEYS = [
  'bumpReplicationEpoch',
  'enableReplication',
  'getActiveSchema',
  'getMetadata',
  'getSchema',
  'getStatus',
  'mutateData',
  'namespaceId',
  'openReplicationSession',
  'owner',
  'readArray',
  'readData',
  'readMap',
  'release',
  'replaceSchema',
  'watchMap',
].sort();

/** Runtime 公共面 15 键（`runtime-phase5-reset-fence-r2.test.ts` T0 同一冻结面）。 */
export const T3_RUNTIME_KEYS = [
  'bumpReplicationEpoch',
  'close',
  'enableReplication',
  'getActiveSchema',
  'getMetadata',
  'getSchema',
  'getStatus',
  'mutateData',
  'namespaceId',
  'owner',
  'readArray',
  'readData',
  'readMap',
  'replaceSchema',
  'watchMap',
].sort();

/** ADR 0030 §4 三 kind 闭集（通知流零参数错误——C11）。 */
export const T3_NOTIFICATION_KINDS = ['data', 'invalidate-all', 'watch-end'];

/**
 * V1 schema（SA6 §12.3 最小输入族；#387 tracer fixture 同族 + `note?` 差异留 V2）。
 */
export const T3_SCHEMA_V1 = `
type Task = YMap<{
  /** 任务标题 */
  title: YLeaf<string>;
  /** 优先级（数值越大越优先） */
  priority: YLeaf<number>;
}>;
type ROOT = YMap<{
  /** 任务表（Record 键空间，Y.Map 载体） */
  tasks: Record<string, Task>;
  /** 声明但未物化的任务表（数据缺席合法） */
  ghost?: Record<string, Task>;
  /** 可选任务表（可删除：订阅横跨缺席期） */
  optionalTasks?: Record<string, Task>;
  /** 数组载体（非键容器） */
  workRecords: YLeaf<number>[];
  /** 根标量（非容器） */
  title: YLeaf<string>;
  /** 封闭对象 map */
  meta: YMap<{
    /** 备注内容 */
    content: YLeaf<string>;
    /** 附加计数 */
    extra: YLeaf<number>;
  }>;
}>;
`.trim();

/** V2 schema = V1 + Task 追加可选 `note`（**文本真变**——schema-changed 触发面）。 */
export const T3_SCHEMA_V2 = T3_SCHEMA_V1.replace(
  '  /** 优先级（数值越大越优先） */\n  priority: YLeaf<number>;\n}>;',
  '  /** 优先级（数值越大越优先） */\n  priority: YLeaf<number>;\n  /** 备注（V2 新增；文本真变面） */\n  note?: YLeaf<string>;\n}>;',
);

/** replaceSchema 信封（SCHEMA 四键标准形状；id = namespaceId）。 */
export function schemaEnvelope(text: string): Readonly<{
  lang: 'vfsl';
  version: 1;
  id: string;
  text: string;
}> {
  return Object.freeze({ lang: 'vfsl' as const, version: 1 as const, id: T3_DOC_ID, text });
}

// ───────────────────────── 载体构造 ─────────────────────────

function taskEntry(title: string, priority: number): Y.Map<unknown> {
  const entry = new Y.Map<unknown>();
  entry.set('title', title);
  entry.set('priority', priority);
  return entry;
}

export interface T3DocOptions {
  /** schema 文本（缺省 V1）。 */
  readonly schemaText?: string;
  /** 复制身份（缺省缺席 = disabled；reset fixture 用种子身份）。 */
  readonly replication?: ReplicationIdentityRef;
  /** `optionalTasks` 是否物化（缺省 false；NC5 删除锚用 true）。 */
  readonly seedOptionalTasks?: boolean;
}

/** 构建 T3 契约文档（仅内存；装载经 stub 持久化 seam）。 */
export function buildT3Doc(options: T3DocOptions = {}): Y.Doc {
  const doc = new Y.Doc();
  const sc = doc.getMap('SCHEMA');
  const envelope = schemaEnvelope(options.schemaText ?? T3_SCHEMA_V1);
  for (const [key, value] of Object.entries(envelope)) sc.set(key, value);
  const meta = doc.getMap('META');
  meta.set('docId', T3_DOC_ID);
  meta.set('createdAt', T3_FIXED_MS);
  if (options.replication !== undefined) {
    meta.set('replicationId', options.replication.replicationId);
    meta.set('replicationEpoch', options.replication.replicationEpoch);
  }
  const root = doc.getMap('ROOT');
  const tasks = new Y.Map<unknown>();
  tasks.set('t1', taskEntry('alpha', 2));
  tasks.set('t2', taskEntry('beta', 9));
  root.set('tasks', tasks);
  if (options.seedOptionalTasks === true) {
    const optionalTasks = new Y.Map<unknown>();
    optionalTasks.set('t9', taskEntry('revived', 1));
    root.set('optionalTasks', optionalTasks);
  }
  const closed = new Y.Map<unknown>();
  closed.set('content', 'hi');
  closed.set('extra', 7);
  root.set('meta', closed);
  const workRecords = new Y.Array<number>();
  workRecords.push([30, 10, 20]);
  root.set('workRecords', workRecords);
  root.set('title', 'root-title');
  return doc;
}

/** 远端 update 构造（Yjs 确定性纪律）：bootstrap live 全量状态 → 只写新键/只改 SCHEMA。 */
export function remoteUpdateOf(
  liveDoc: Y.Doc,
  mutate: (scratch: Y.Doc) => void,
): Uint8Array {
  const scratch = new Y.Doc();
  Y.applyUpdate(scratch, Y.encodeStateAsUpdate(liveDoc));
  mutate(scratch);
  const update = Y.encodeStateAsUpdate(scratch, Y.encodeStateVector(liveDoc));
  scratch.destroy();
  return update;
}

// ───────────────────────── stub 持久化 seam ─────────────────────────

/**
 * Replica-capable stub 持久化（单一 docs map = 持久化真相源；stub 只做编排观测，
 * 真实调用面全部经 Registry/Runtime）：
 * - `loadDoc` / `createDoc` / `importDoc` / `archiveDoc` /
 *   `readPersistedReplicationIdentity` / `saveDoc`；
 * - 复制导入排他创建（docId 已存在 → DocDuplicateError → NAMESPACE_ALREADY_EXISTS）；
 * - 归档守卫按 expected 复制身份核对（探针 4 reset 装置同款）。
 */
export class T3StubPersistence implements DocPersistence {
  readonly importCalls: Array<{ owner: User; docId: string }> = [];
  readonly archiveCalls: Array<{ owner: User; docId: string; expected: unknown }> = [];
  private readonly docs = new Map<string, Y.Doc>();

  private static key(owner: User, docId: string): string {
    return `${owner.userId}\u0000${docId}`;
  }

  seedDocument(owner: User, docId: string, doc: Y.Doc): void {
    this.docs.set(T3StubPersistence.key(owner, docId), doc);
  }

  hasDocument(owner: User, docId: string): boolean {
    return this.docs.has(T3StubPersistence.key(owner, docId));
  }

  async createDoc(owner: User, docId: string, doc: Y.Doc): Promise<DocHandle> {
    if (this.hasDocument(owner, docId)) throw new DocDuplicateError();
    this.docs.set(T3StubPersistence.key(owner, docId), doc);
    return this.makeHandle(owner, docId, doc);
  }

  async importDoc(owner: User, docId: string, doc: Y.Doc): Promise<DocHandle> {
    this.importCalls.push({ owner, docId });
    if (this.hasDocument(owner, docId)) throw new DocDuplicateError();
    if (doc.getMap('META').get('docId') !== docId) {
      throw Object.assign(new Error('import identity mismatch'), {
        code: 'DOC_IMPORT_IDENTITY_MISMATCH',
      });
    }
    this.docs.set(T3StubPersistence.key(owner, docId), doc);
    return this.makeHandle(owner, docId, doc);
  }

  async archiveDoc(owner: User, docId: string, expected: unknown): Promise<{ ok: true }> {
    this.archiveCalls.push({ owner, docId, expected });
    const key = T3StubPersistence.key(owner, docId);
    const doc = this.docs.get(key);
    if (doc === undefined) {
      throw Object.assign(new Error('nothing to archive'), { code: 'DOC_ARCHIVE_DUPLICATE' });
    }
    const ref = expected as ReplicationIdentityRef | undefined;
    const gotId = doc.getMap('META').get('replicationId');
    const gotEpoch = doc.getMap('META').get('replicationEpoch');
    if (
      ref === undefined ||
      gotId !== ref.replicationId ||
      gotEpoch !== ref.replicationEpoch
    ) {
      throw Object.assign(new Error('archive identity mismatch'), {
        code: 'DOC_ARCHIVE_IDENTITY_MISMATCH',
      });
    }
    this.docs.delete(key);
    return { ok: true };
  }

  async loadDoc(owner: User, docId: string): Promise<DocHandle | null> {
    const doc = this.docs.get(T3StubPersistence.key(owner, docId));
    return doc === undefined ? null : this.makeHandle(owner, docId, doc);
  }

  async readPersistedReplicationIdentity(
    owner: User,
    docId: string,
  ): Promise<
    | { readonly kind: 'missing' }
    | {
        readonly kind: 'found';
        readonly identity:
          | { readonly ok: true; readonly value: ReplicationIdentityRef }
          | { readonly ok: false };
      }
  > {
    const doc = this.docs.get(T3StubPersistence.key(owner, docId));
    if (doc === undefined) return { kind: 'missing' };
    const id = doc.getMap('META').get('replicationId');
    const epoch = doc.getMap('META').get('replicationEpoch');
    const ok =
      typeof id === 'string'
      && /^[0-9a-f]{32}$/.test(id)
      && typeof epoch === 'number'
      && Number.isSafeInteger(epoch)
      && epoch >= 1;
    return {
      kind: 'found',
      identity: ok
        ? { ok: true, value: { replicationId: id, replicationEpoch: epoch } }
        : { ok: false },
    };
  }

  async saveDoc(_handle: DocHandle): Promise<void> {}

  private makeHandle(owner: User, docId: string, doc: Y.Doc): DocHandle {
    return {
      owner,
      docId,
      doc,
      getStatus: () => 'ready' as const,
      release: async () => {},
    };
  }
}

/** 受控随机源（128-bit 请求；计数器确定性）。 */
function counterRandomBytes(): (length: number) => Uint8Array {
  let counter = 0;
  return (length: number): Uint8Array => {
    if (length !== 16) {
      throw new Error(`受控随机源必须按 128-bit（16 字节）请求，实际请求 ${length} 字节`);
    }
    counter += 1;
    const hex = counter.toString(16).padStart(32, '0');
    const out = new Uint8Array(16);
    for (let i = 0; i < 16; i += 1) {
      out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  };
}

export interface T3RegistryFixture {
  readonly registry: NamespaceRegistry;
  /** runtimeFactory 观察位（open/import 结算后填值——C11 键集守卫的观测面）。 */
  readonly runtimeRef: { current: unknown };
}

/** 真实 Registry 装配（testing seam 受控依赖；runtimeFactory 保留 runtime 引用——C11）。 */
export function createT3Registry(
  persistence: DocPersistence,
  role: 'hub' | 'peer',
): T3RegistryFixture {
  const runtimeRef: { current: unknown } = { current: undefined };
  const registry = createNamespaceRegistryForTesting(persistence, {
    clock: { now: () => T3_FIXED_MS },
    scheduler: createRegistryTestScheduler(),
    idleTimeoutMs: 25,
    randomBytes: counterRandomBytes(),
    role,
    runtimeFactory: (handle: DocHandle, notifyDirty: () => Promise<void>) => {
      const created = createNamespaceRuntimeWithSeam({ handle, notifyDirty });
      runtimeRef.current = created;
      return created;
    },
  });
  return { registry, runtimeRef };
}

// ───────────────────────── 微任务预算与等待 ─────────────────────────

/** 微任务预算（确定性让步；零墙钟）。 */
export async function microtasks(count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) await Promise.resolve();
}

/** 等待 schema 结算（ready；P0 全微任务链的确定性栅栏——探针/先例同款）。 */
export async function waitForSchemaReady(lease: NamespaceLease): Promise<void> {
  await expect
    .poll(
      () => {
        const status = lease.getStatus();
        return status.lease === 'active' ? status.runtime.schema.state : 'released';
      },
      { interval: 5, timeout: 5_000 },
    )
    .not.toBe('preparing');
  const status = lease.getStatus();
  if (status.lease !== 'active' || status.runtime.schema.state !== 'ready') {
    throw new Error(`契约前提失败：schema 未 ready（${JSON.stringify(status)}）`);
  }
}

/** lease 复制身份投影（public getStatus；失败即契约前提 loud）。 */
export function replicationFactsOf(lease: NamespaceLease): ReplicationIdentityRef {
  const status = lease.getStatus() as unknown as {
    lease: string;
    runtime: {
      replication?: {
        state?: string;
        replicationId?: string;
        replicationEpoch?: number;
      };
    } | null;
  };
  const facts = status.runtime?.replication;
  if (
    status.lease !== 'active'
    || facts?.state !== 'enabled'
    || typeof facts.replicationId !== 'string'
    || typeof facts.replicationEpoch !== 'number'
  ) {
    throw new Error(`契约前提失败：复制身份未启用（${JSON.stringify(status)}）`);
  }
  return { replicationId: facts.replicationId, replicationEpoch: facts.replicationEpoch };
}

// ───────────────────────── 通知 sink ─────────────────────────

/** 通知收集器（listener 直挂订阅；`expect.poll` 提供确定性异步分发等待）。 */
export class T3Sink {
  readonly received: NamespaceLeaseWatchMapNotification[] = [];

  readonly listener = (notification: NamespaceLeaseWatchMapNotification): void => {
    this.received.push(notification);
  };

  async waitForCount(count: number, timeoutMs = 2_000): Promise<void> {
    await expect
      .poll(() => this.received.length, { interval: 5, timeout: timeoutMs })
      .toBeGreaterThanOrEqual(count);
  }

  /** 等待「流末条 = 指定 reason 的 watch-end」到达（终止前置屏障；找不到即红）。 */
  async waitForWatchEnd(reason: 'schema-changed' | 'doc-replaced', timeoutMs = 2_000): Promise<void> {
    await expect
      .poll(
        () => this.received.some((n) => n.kind === 'watch-end' && n.reason === reason),
        { interval: 5, timeout: timeoutMs },
      )
      .toBe(true);
  }

  kinds(): string[] {
    return this.received.map((n) => n.kind);
  }

  watchEnds(): Array<{ readonly kind: 'watch-end'; readonly reason: string }> {
    return this.received.filter(
      (n): n is { readonly kind: 'watch-end'; readonly reason: 'schema-changed' | 'doc-replaced' } =>
        n.kind === 'watch-end',
    );
  }

  dataNotifications(): Array<{
    readonly kind: 'data';
    readonly origin: string;
    readonly changes: ReadonlyArray<{ readonly path: readonly (string | number)[]; readonly key: string }>;
  }> {
    return this.received.filter(
      (n): n is {
        readonly kind: 'data';
        readonly origin: 'local' | 'replication';
        readonly changes: ReadonlyArray<{ readonly path: readonly (string | number)[]; readonly key: string }>;
      } => n.kind === 'data',
    );
  }

  dataKeys(): string[] {
    return this.dataNotifications().flatMap((n) => n.changes.map((change) => change.key));
  }

  last(): NamespaceLeaseWatchMapNotification | undefined {
    return this.received[this.received.length - 1];
  }

  invalidateAllCount(): number {
    return this.received.filter((n) => n.kind === 'invalidate-all').length;
  }
}

// ───────────────────────── hub / peer 装配 ─────────────────────────

export interface T3HubFixture {
  readonly registry: NamespaceRegistry;
  readonly runtime: unknown;
  readonly lease: NamespaceLease;
  readonly doc: Y.Doc;
  readonly persistence: T3StubPersistence;
  readonly session: ReplicationSession | undefined;
}

export interface T3HubOptions {
  /** 复制管理编排（enableReplication + hub session）——AC1/AC2-B 装置用。 */
  readonly replication?: boolean;
  readonly seedOptionalTasks?: boolean;
  readonly schemaText?: string;
}

/** 真实 Registry + 真实 Runtime 的 hub 夹具（open → schema ready → 可选复制编排）。 */
export async function openT3Hub(options: T3HubOptions = {}): Promise<T3HubFixture> {
  const doc = buildT3Doc({
    ...(options.schemaText !== undefined ? { schemaText: options.schemaText } : {}),
    ...(options.seedOptionalTasks === true ? { seedOptionalTasks: true } : {}),
  });
  const persistence = new T3StubPersistence();
  persistence.seedDocument(T3_OWNER, T3_DOC_ID, doc);
  const { registry, runtimeRef } = createT3Registry(persistence, 'hub');
  const opened = await registry.open({ userId: T3_OWNER.userId }, T3_DOC_ID);
  if (!opened.ok) throw new Error(`契约前提失败：hub registry.open（${JSON.stringify(opened)}）`);
  const lease = opened.lease;
  await waitForSchemaReady(lease);
  let session: ReplicationSession | undefined;
  if (options.replication === true) {
    const enabled = await lease.enableReplication();
    if (enabled.ok !== true) {
      throw new Error(`契约前提失败：enableReplication（${JSON.stringify(enabled)}）`);
    }
    const openedSession = await lease.openReplicationSession({
      localRole: 'hub',
      remoteInstanceId: T3_PEER_INSTANCE_ID,
    });
    if (!openedSession.ok) {
      throw new Error(`契约前提失败：hub openReplicationSession（${JSON.stringify(openedSession)}）`);
    }
    session = openedSession.session;
  }
  return { registry, runtime: runtimeRef.current, lease, doc, persistence, session };
}

export interface T3PeerFixture {
  readonly registry: NamespaceRegistry;
  readonly runtime: unknown;
  readonly lease: NamespaceLease;
  readonly doc: Y.Doc;
  readonly persistence: T3StubPersistence;
  readonly session: ReplicationSession;
}

/**
 * Peer 夹具：从 hub 快照 bootstrap import（排他创建）→ peer session——
 * ADR 0018 R5.6 re-arm 路径的订阅承载体。
 */
export async function openT3Peer(hub: T3HubFixture): Promise<T3PeerFixture> {
  const identity = replicationFactsOf(hub.lease);
  const snapshot = new Y.Doc();
  Y.applyUpdate(snapshot, Y.encodeStateAsUpdate(hub.doc));
  const persistence = new T3StubPersistence();
  const { registry, runtimeRef } = createT3Registry(persistence, 'peer');
  const imported = await registry.importReplica(
    { userId: T3_OWNER.userId },
    T3_DOC_ID,
    snapshot,
    identity,
  );
  if (!imported.ok) {
    throw new Error(`契约前提失败：peer importReplica（${JSON.stringify(imported)}）`);
  }
  const lease = imported.lease;
  await waitForSchemaReady(lease);
  const openedSession = await lease.openReplicationSession({
    localRole: 'peer',
    remoteInstanceId: T3_HUB_INSTANCE_ID,
  });
  if (!openedSession.ok) {
    throw new Error(`契约前提失败：peer openReplicationSession（${JSON.stringify(openedSession)}）`);
  }
  return {
    registry,
    runtime: runtimeRef.current,
    lease,
    doc: snapshot,
    persistence,
    session: openedSession.session,
  };
}

/** hub 侧 owned update 捕获（R5/R5.6 的输入；扇出投递含 20 微任务让步——poll 等待）。
 *  **同步订阅**（返回后订阅已在场——调用方可在同一同步段发起 replaceSchema）。 */
export function captureOwnedUpdates(session: ReplicationSession): {
  readonly updates: Uint8Array[];
  waitForCount: (count: number) => Promise<void>;
} {
  const updates: Uint8Array[] = [];
  session.subscribeOwnedUpdates((update) => {
    updates.push(update);
  });
  return {
    updates,
    waitForCount: async (count: number): Promise<void> => {
      await expect
        .poll(() => updates.length, { interval: 5, timeout: 5_000 })
        .toBeGreaterThanOrEqual(count);
    },
  };
}

// ───────────────────────── reset（doc 替换）装置 ─────────────────────────

export interface T3ResetFixture {
  readonly registry: NamespaceRegistry;
  readonly runtime: unknown;
  readonly lease: NamespaceLease;
  readonly doc: Y.Doc;
  readonly persistence: T3StubPersistence;
  readonly identity: ReplicationIdentityRef;
}

/** reset 夹具：种子复制身份（探针 4 装置）→ open → schema ready。 */
export async function openT3ResetFixture(): Promise<T3ResetFixture> {
  const identity: ReplicationIdentityRef = {
    replicationId: T3_SEED_REPLICATION_ID,
    replicationEpoch: T3_SEED_REPLICATION_EPOCH,
  };
  const doc = buildT3Doc({ replication: identity });
  const persistence = new T3StubPersistence();
  persistence.seedDocument(T3_OWNER, T3_DOC_ID, doc);
  const { registry, runtimeRef } = createT3Registry(persistence, 'hub');
  const opened = await registry.open({ userId: T3_OWNER.userId }, T3_DOC_ID);
  if (!opened.ok) throw new Error(`契约前提失败：reset registry.open（${JSON.stringify(opened)}）`);
  await waitForSchemaReady(opened.lease);
  return {
    registry,
    runtime: runtimeRef.current,
    lease: opened.lease,
    doc,
    persistence,
    identity,
  };
}
