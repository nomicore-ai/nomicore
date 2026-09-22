/**
 * issue #442（lease 端到端：Record/parent 逐 entry 校验行为钉死，ADR 0034）契约共享 fixture
 * —— **非测试入口**（vitest 只收集 `*.test.ts`；本文件供契约/负控两文件消费，故零 `vitest`
 * 依赖：断言为本地 `assert`，沉降为有界 `setImmediate` 轮，沿 #437/#393 既有时序纪律——
 * 零 `setTimeout` 竞猜）。
 *
 * 最高 seam（任务简报「经 lease `mutateData` 的端到端测试」）：
 *   真实 Registry testing seam（`createNamespaceRegistryForTesting`）→ 真实生产 Runtime
 *   装配 → `registry.open` → `lease.mutateData(...)` / `lease.readData(...)`；
 *   raw-replication 污染只经 `lease.openReplicationSession` 的
 *   `session.applyRemoteUpdate(raw update)` 注入（trusted raw 面，同 ADR 0010），**绝不**在
 *   lease 层直写 live Y.Doc；fixture 持有的 `doc` 引用仅用于（a）构造对端副本快照、
 *   （b）字节形态 oracle 的基态、（c）读计数导航 —— 契约断言一律经 lease 面取值。
 *
 * 数据设计（最小、确定、可判定；SA6 契约 §12.2 schema 逐字冻结）：
 *   - `n`（number）：诊断记录键集同构的标量对照；
 *   - `tasks`（`Record<string, Item>`）：非 union Record —— fast path 主面；
 *   - `codes`（`Record<string & Pattern<...>, Item>`）：键 Pattern 面；
 *   - `blobs`（`Record<string, Item | Alt>`）：值位 union（仍 fast path）；
 *   - `maybe`（`Record<string, Item> | { fixed: string }`）：union map 位 —— 永久 legacy；
 *   - `outer.inner`（`Record<string, Item>`）：深层 Record（path rebase）；
 *   - `obj`（`{ req; opt?; unk: unknown; deep }`）：封闭对象 delete 三态 + 深层污染位。
 *
 * 确定性纪律：零随机源（计数 randomBytes）、零真实时钟（固定 Clock）、受控 scheduler、
 * 零网络、零真实并发；clientID 全显式固定（hub 4242 / remote 999999 / peer 快照 4243 /
 * 重放对照 doc 987654）。raw 污染一律**插入新键**，唯一同键覆盖 = `obj.deep`（Yjs 并发
 * 同键按 clientID 决胜，确定性）。
 */
import * as Y from 'yjs';
import type { DocHandle, DocPersistence, User } from '@nomicore/persistence';
import type {
  NamespaceLease,
  NamespaceRegistry,
  RegistryRandomBytes,
  ReplicationSession,
} from '@nomicore/namespace-registry';
import {
  createNamespaceRegistryForTesting,
  createRegistryTestScheduler,
} from '@nomicore/namespace-registry/testing';
import {
  createBoundedMemoryDiagnosticLog,
  type AttemptRecord,
  type BoundedMemoryDiagnosticLog,
  type UpdateCarrier,
} from '../../namespace-diagnostic-log/src/index.js';

// ─────────────────────────── 常量（冻结夹具）───────────────────────────

export const NS_442 = 'ns-442-lease-record';
export const OWNER_442: User = Object.freeze({ userId: 'u-442' });
export const NOW_MS = 1_700_442_000_000;
export const HUB_INSTANCE_ID = 'hub-442';
export const PEER_INSTANCE_ID = 'peer-442';
/** fixture live doc 的固定 clientID（字节 oracle / 同键决胜确定性）。 */
export const HUB_CLIENT_ID = 4242;
/** 远端（raw replication 对端）固定 clientID——仅用于构造增量 update。 */
export const REMOTE_CLIENT_ID = 999_999;
/** peer bootstrap 快照的固定 clientID（与 hub 不同）。 */
export const PEER_CLIENT_ID = HUB_CLIENT_ID + 1;
/** owned update 重放对照纯 Y.Doc 的固定 clientID。 */
export const REPLAY_CLIENT_ID = 987_654;

export const SCHEMA_442 = Object.freeze({
  lang: 'vfsl',
  version: 1,
  id: 'issue-442-lease-record',
  text: [
    'type Item = { title: string; qty: number & Int<0, 100> };',
    'type Alt = { label: string; n: number & Int<0, 10> };',
    'type ROOT = {',
    '  n: number;',
    '  tasks: Record<string, Item>;',
    '  codes: Record<string & Pattern<"^(id-[0-9]+)$">, Item>;',
    '  blobs: Record<string, Item | Alt>;',
    '  maybe: Record<string, Item> | { fixed: string };',
    '  outer: { inner: Record<string, Item> };',
    '  obj: { req: string; opt?: number; unk: unknown; deep: { d: string } };',
    '};',
    '',
  ].join('\n'),
});

export interface LeaseRecordSeedOptions {
  /** tasks 初始 entry 数（缺省 3：t0..t2）。 */
  readonly tasksN?: number;
  /** blobs 初始 entry 数（缺省 1：b0）。 */
  readonly blobsN?: number;
  /** maybe 初始 entry 数（缺省 1：m0）。 */
  readonly maybeN?: number;
}

export interface LeaseRecordFixtureOptions extends LeaseRecordSeedOptions {
  /** 装配复制：enableReplication + openReplicationSession + owned update 捕获。 */
  readonly replication?: boolean;
  /** 装配有界内存诊断日志（生产形状 binding：emitter + runtimeEmitterFor）。 */
  readonly diagnostics?: boolean;
  /** 实例静态角色（缺省 'hub'）。 */
  readonly role?: 'hub' | 'peer';
  /** namespaceId（缺省 NS_442）。 */
  readonly namespaceId?: string;
}

// ─────────────────────────── 本地断言 / 沉降 ───────────────────────────

/** lease 面契约前提断言（throw 即红——非 vitest 耦合）。 */
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`契约前提失败：${message}`);
}

/** 有界 setImmediate 轮沉降（异步扇出/诊断泵投递；零 setTimeout 竞猜）。 */
export async function settleUntil(
  read: () => boolean,
  message: string,
  rounds = 400,
): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    if (read()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  assert(read(), `沉降 ${rounds} 轮后仍未满足：${message}`);
}

// ─────────────────────────── 文档 / 持久化 stub ───────────────────────────

/** Item entry 载体（seed 与 raw 污染构造共用）。 */
export function itemEntry(title: string, qty: unknown): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  map.set('title', title);
  map.set('qty', qty);
  return map;
}

/** 构建 lease 契约文档（SCHEMA/META/ROOT；显式固定 clientID）。 */
export function buildLeaseRecordDoc(options: LeaseRecordSeedOptions = {}): Y.Doc {
  const doc = new Y.Doc();
  doc.clientID = HUB_CLIENT_ID;
  const sc = doc.getMap('SCHEMA');
  sc.set('lang', SCHEMA_442.lang);
  sc.set('version', SCHEMA_442.version);
  sc.set('id', SCHEMA_442.id);
  sc.set('text', SCHEMA_442.text);
  const meta = doc.getMap('META');
  meta.set('docId', NS_442);
  meta.set('createdAt', NOW_MS);

  const root = doc.getMap('ROOT');
  root.set('n', 1);
  const tasks = new Y.Map<unknown>();
  const tasksN = options.tasksN ?? 3;
  for (let i = 0; i < tasksN; i += 1) tasks.set(`t${i}`, itemEntry(`t${i}`, (i % 100) + 1));
  root.set('tasks', tasks);
  const codes = new Y.Map<unknown>();
  codes.set('id-1', itemEntry('c1', 1));
  root.set('codes', codes);
  const blobs = new Y.Map<unknown>();
  const blobsN = options.blobsN ?? 1;
  for (let i = 0; i < blobsN; i += 1) blobs.set(`b${i}`, itemEntry(`b${i}`, (i % 100) + 1));
  root.set('blobs', blobs);
  const maybe = new Y.Map<unknown>();
  const maybeN = options.maybeN ?? 1;
  for (let i = 0; i < maybeN; i += 1) maybe.set(`m${i}`, itemEntry(`m${i}`, (i % 100) + 3));
  root.set('maybe', maybe);
  const outer = new Y.Map<unknown>();
  const inner = new Y.Map<unknown>();
  inner.set('n1', itemEntry('n1', 4));
  outer.set('inner', inner);
  root.set('outer', outer);
  const obj = new Y.Map<unknown>();
  obj.set('req', 'r');
  obj.set('opt', 1);
  obj.set('unk', { k: 1 });
  const deep = new Y.Map<unknown>();
  deep.set('d', 'd');
  obj.set('deep', deep);
  root.set('obj', obj);
  return doc;
}

/** 冻结 DocHandle 投影（getStatus ready；release 恒 resolve）。 */
class LeaseRecordHandle implements DocHandle {
  constructor(
    readonly owner: User,
    readonly docId: string,
    readonly doc: Y.Doc,
  ) {}
  getStatus(): 'ready' {
    return 'ready';
  }
  release(): Promise<void> {
    return Promise.resolve();
  }
}

interface StoredLeaseDoc {
  readonly owner: User;
  readonly docId: string;
  readonly doc: Y.Doc;
  archived: boolean;
}

function docKey(owner: User, docId: string): string {
  return `${owner.userId}\u0000${docId}`;
}

/**
 * 最小 stub Persistence：同一 doc 引用的 open 恢复面（loadDoc）+ 复制导入面
 * （importDoc——`registry.importReplica` 的 ReplicaPersistence 级能力）+ saveDoc 计数。
 */
export class LeaseRecordPersistence implements DocPersistence {
  saveCalls = 0;
  private readonly docs = new Map<string, StoredLeaseDoc>();

  constructor(seed?: Readonly<{ owner: User; docId: string; doc: Y.Doc }>) {
    if (seed !== undefined) {
      this.docs.set(docKey(seed.owner, seed.docId), {
        owner: seed.owner,
        docId: seed.docId,
        doc: seed.doc,
        archived: false,
      });
    }
  }

  private handleOf(stored: StoredLeaseDoc): DocHandle {
    return new LeaseRecordHandle(stored.owner, stored.docId, stored.doc);
  }

  async createDoc(owner: User, docId: string, doc: Y.Doc): Promise<DocHandle> {
    const stored: StoredLeaseDoc = { owner, docId, doc, archived: false };
    this.docs.set(docKey(owner, docId), stored);
    return this.handleOf(stored);
  }

  async loadDoc(owner: User, docId: string): Promise<DocHandle | null> {
    const stored = this.docs.get(docKey(owner, docId));
    return stored === undefined || stored.archived ? null : this.handleOf(stored);
  }

  async saveDoc(): Promise<void> {
    this.saveCalls += 1;
  }

  /** 复制导入面（`registry.importReplica` 唯一必需的 ReplicaPersistence 能力）。 */
  async importDoc(owner: User, docId: string, doc: Y.Doc): Promise<DocHandle> {
    const stored: StoredLeaseDoc = { owner, docId, doc, archived: false };
    this.docs.set(docKey(owner, docId), stored);
    return this.handleOf(stored);
  }
}

/** 每 fixture 独立计数随机源（128-bit 请求；幂等序列 ⇒ id 确定）。 */
function makeCounterRandomBytes(): RegistryRandomBytes {
  let counter = 0;
  return (length: number): Uint8Array => {
    if (length !== 16) throw new Error(`受控随机源只服务 128-bit 请求，实际 ${length}`);
    counter += 1;
    const hex = counter.toString(16).padStart(32, '0');
    const out = new Uint8Array(16);
    for (let i = 0; i < 16; i += 1) {
      out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  };
}

// ─────────────────────────── fixture 形状 ───────────────────────────

export interface LeaseRecordFixture {
  readonly registry: NamespaceRegistry;
  readonly lease: NamespaceLease;
  /** seed/live doc 引用（仅基态快照、字节 oracle 与读计数导航；断言只经 lease 面取值）。 */
  readonly doc: Y.Doc;
  readonly persistence: LeaseRecordPersistence;
  readonly namespaceId: string;
  readonly session: ReplicationSession | undefined;
  /** session owned update 捕获（复制的协议面输入）。 */
  readonly ownedUpdates: Uint8Array[];
  readonly log: BoundedMemoryDiagnosticLog | undefined;
  /** live doc 'update' 事件捕获（在 `registry.open` 前挂上；零写入锚的 update 面）。 */
  readonly updateEvents: Uint8Array[];
}

/** 等待 lease 的 runtime schema ready（既有有界沉降纪律）。 */
export async function waitForSchemaReady(lease: NamespaceLease): Promise<void> {
  await settleUntil(() => {
    const status = lease.getStatus();
    return status.lease === 'active' && status.runtime.schema.state === 'ready';
  }, 'lease runtime schema 未到 ready');
}

/** 打开 hub（或 peer-role）lease fixture（生产 Runtime 装配；可选复制/诊断接线）。 */
export async function openLeaseFixture(
  options: LeaseRecordFixtureOptions = {},
): Promise<LeaseRecordFixture> {
  const namespaceId = options.namespaceId ?? NS_442;
  const role = options.role ?? 'hub';
  const doc = buildLeaseRecordDoc(options);
  const updateEvents: Uint8Array[] = [];
  doc.on('update', (update: Uint8Array) => {
    updateEvents.push(update.slice());
  });
  const persistence = new LeaseRecordPersistence({ owner: OWNER_442, docId: namespaceId, doc });
  const log =
    options.diagnostics === true
      ? createBoundedMemoryDiagnosticLog({ inputPolicy: 'digest', issuesPolicy: 'full', updateCapture: true })
      : undefined;
  const registry = createNamespaceRegistryForTesting(persistence, {
    clock: { now: () => NOW_MS },
    scheduler: createRegistryTestScheduler(),
    randomBytes: makeCounterRandomBytes(),
    role,
    ...(log !== undefined
      ? {
          diagnosticLog: {
            emitter: log.emitter,
            runtimeEmitterFor: (namespace: string) =>
              namespace === namespaceId ? log.emitter : undefined,
          },
        }
      : {}),
  });
  const opened = await registry.open({ userId: OWNER_442.userId }, namespaceId);
  assert(opened.ok, `registry.open → ${JSON.stringify(opened)}`);
  const lease = opened.lease;
  await waitForSchemaReady(lease);

  const ownedUpdates: Uint8Array[] = [];
  let session: ReplicationSession | undefined;
  if (options.replication === true) {
    const enabled = await lease.enableReplication();
    assert(enabled.ok, `enableReplication → ${JSON.stringify(enabled)}`);
    const openedSession = await lease.openReplicationSession({
      localRole: role,
      remoteInstanceId: role === 'hub' ? PEER_INSTANCE_ID : HUB_INSTANCE_ID,
    });
    assert(openedSession.ok, `openReplicationSession → ${JSON.stringify(openedSession)}`);
    session = openedSession.session;
    session.subscribeOwnedUpdates((update) => {
      ownedUpdates.push(update.slice());
    });
  }
  return {
    registry,
    lease,
    doc,
    persistence,
    namespaceId,
    session,
    ownedUpdates,
    log,
    updateEvents,
  };
}

/** hub lease 的复制身份事实（enabled 两键）。 */
function replicationIdentityOf(lease: NamespaceLease): {
  readonly replicationId: string;
  readonly replicationEpoch: number;
} {
  const status = lease.getStatus();
  const facts = status.lease === 'active' ? status.runtime.replication : undefined;
  assert(
    facts !== undefined && facts.state === 'enabled',
    `hub 复制身份未启用 → ${JSON.stringify(status)}`,
  );
  return { replicationId: facts.replicationId, replicationEpoch: facts.replicationEpoch };
}

/**
 * 从 hub 快照 bootstrap 的 peer lease fixture（ADR 0010 peer 复制面）。
 * `updateEvents` 在 import **之后**挂上，故 bootstrap 增量不计入。
 */
export async function openPeerFixture(hub: LeaseRecordFixture): Promise<LeaseRecordFixture> {
  const identity = replicationIdentityOf(hub.lease);
  const snapshot = new Y.Doc();
  snapshot.clientID = PEER_CLIENT_ID;
  Y.applyUpdate(snapshot, Y.encodeStateAsUpdate(hub.doc));
  const namespaceId = hub.namespaceId;
  const persistence = new LeaseRecordPersistence(); // 导入前 key 缺席（bootstrap 资格）
  const registry = createNamespaceRegistryForTesting(persistence, {
    clock: { now: () => NOW_MS },
    scheduler: createRegistryTestScheduler(),
    randomBytes: makeCounterRandomBytes(),
    role: 'peer',
  });
  const imported = await registry.importReplica(
    { userId: OWNER_442.userId },
    namespaceId,
    snapshot,
    identity,
  );
  assert(imported.ok, `peer importReplica → ${JSON.stringify(imported)}`);
  const lease = imported.lease;
  await waitForSchemaReady(lease);
  const openedSession = await lease.openReplicationSession({
    localRole: 'peer',
    remoteInstanceId: HUB_INSTANCE_ID,
  });
  assert(openedSession.ok, `peer openReplicationSession → ${JSON.stringify(openedSession)}`);
  const updateEvents: Uint8Array[] = [];
  snapshot.on('update', (update: Uint8Array) => {
    updateEvents.push(update.slice());
  });
  const ownedUpdates: Uint8Array[] = [];
  openedSession.session.subscribeOwnedUpdates((update) => {
    ownedUpdates.push(update.slice());
  });
  return {
    registry,
    lease,
    doc: snapshot,
    persistence,
    namespaceId,
    session: openedSession.session,
    ownedUpdates,
    log: undefined,
    updateEvents,
  };
}

// ─────────────────────────── lease 读取 / 字节 oracle ───────────────────────────

/** lease.readData 成功值（失败即 throw——契约前提）。 */
export function readValue(lease: NamespaceLease, path: readonly (string | number)[]): unknown {
  const read = lease.readData(path);
  assert(read.ok, `readData(${JSON.stringify(path)}) → ${JSON.stringify(read)}`);
  return read.value;
}

/** lease.readData 成功值（要求投影为普通记录——Record/封闭对象读取面）。 */
export function readRecord(
  lease: NamespaceLease,
  path: readonly (string | number)[],
): Record<string, unknown> {
  const value = readValue(lease, path);
  assert(
    typeof value === 'object' && value !== null && !Array.isArray(value),
    `readData(${JSON.stringify(path)}) 应投影为记录，实际 ${JSON.stringify(value)}`,
  );
  return value as Record<string, unknown>;
}

/** 文档 ROOT 载体（**仅测试装置面**：raw 污染构造与读计数导航）。 */
export function rootMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap('ROOT');
}

/** ROOT 下嵌套 Y.Map 导航（**仅测试装置面**；断言一律经 lease 面取值）。 */
export function rawMapAt(doc: Y.Doc, path: readonly string[]): Y.Map<unknown> {
  let cursor: unknown = rootMap(doc);
  for (const key of path) {
    assert(cursor instanceof Y.Map, `raw 导航 ${JSON.stringify(path)}：${key} 之前不是 Y.Map`);
    cursor = cursor.get(key);
  }
  assert(cursor instanceof Y.Map, `raw 导航 ${JSON.stringify(path)}：终点不是 Y.Map`);
  return cursor;
}

/** live doc 全量状态字节（拒绝分支的零写入锚）。 */
export function stateBytes(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc);
}

/** 字节逐位相等（零写入锚）。 */
export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/** live doc 累计 'update' 事件数（用例以「前后差值」断言，污染 apply 亦各计 1）。 */
export function updateCount(fixture: LeaseRecordFixture): number {
  return fixture.updateEvents.length;
}

/**
 * 有界排空异步扇出（owned update / 诊断泵投递；零 `setTimeout` 竞猜）。用于**零扇出**
 * 断言：先让在途投递跑完，再断言差值恒 0（否则「当刻为 0」不构成锚）。
 */
export async function flushAsyncFanout(rounds = 24): Promise<void> {
  for (let i = 0; i < rounds; i += 1) await new Promise<void>((resolve) => setImmediate(resolve));
}

// ─────────────────────────── 读计数（Y.Map entry 结构性成本代理）───────────────────────────

export interface MapReadCounts {
  readonly valueReads: number;
  readonly presenceReads: number;
}

/**
 * entry 读计数（结构性成本代理；`get`/`has` 逐次计真，`keys`/`values`/`entries`/
 * `toJSON`/`Symbol.iterator`/`forEach` 各按 `map.size` 计入）。`mutateData` 的实际判定在
 * sequencer 槽内（await 之后）执行，故包装覆盖整个 `await run()` 窗口；结算后删除全部
 * 包装（零残留）。**纪律**：读计数只作结构性成本代理，行为断言承担判定。
 */
export async function countMapReadsAsync(
  map: Y.Map<unknown>,
  run: () => Promise<unknown>,
): Promise<MapReadCounts> {
  let valueReads = 0;
  let presenceReads = 0;
  const target = map as unknown as Record<PropertyKey, unknown>;
  const originalGet = map.get.bind(map) as (key: string) => unknown;
  const originalHas = map.has.bind(map) as (key: string) => boolean;
  const originalKeys = map.keys.bind(map) as () => IterableIterator<string>;
  const originalValues = map.values.bind(map) as () => IterableIterator<unknown>;
  const originalEntries = map.entries.bind(map) as () => IterableIterator<[string, unknown]>;
  const originalForEach = map.forEach.bind(map) as (
    f: (value: unknown, key: string, map: Y.Map<unknown>) => void,
  ) => void;
  const originalToJSON = map.toJSON.bind(map) as () => Record<string, unknown>;
  const originalIterator = map[Symbol.iterator].bind(map) as () => IterableIterator<[string, unknown]>;
  const sizeOf = (): number => map.size;
  target.get = (key: string) => {
    valueReads += 1;
    return originalGet(key);
  };
  target.has = (key: string) => {
    presenceReads += 1;
    return originalHas(key);
  };
  target.keys = () => {
    valueReads += sizeOf();
    return originalKeys();
  };
  target.values = () => {
    valueReads += sizeOf();
    return originalValues();
  };
  target.entries = () => {
    valueReads += sizeOf();
    return originalEntries();
  };
  target.toJSON = () => {
    valueReads += sizeOf();
    return originalToJSON();
  };
  target[Symbol.iterator] = () => {
    valueReads += sizeOf();
    return originalIterator();
  };
  target.forEach = (f: (value: unknown, key: string, map: Y.Map<unknown>) => void) => {
    valueReads += sizeOf();
    originalForEach(f);
  };
  try {
    await run();
    return { valueReads, presenceReads };
  } finally {
    delete target.get;
    delete target.has;
    delete target.keys;
    delete target.values;
    delete target.entries;
    delete target.toJSON;
    delete target[Symbol.iterator];
    delete target.forEach;
  }
}

// ─────────────────────── raw replication 污染注入 ───────────────────────

/**
 * 经 replication apply 注入 raw 污染：对端（固定 clientID）以 live doc 当刻状态为基态、
 * 施加 `mutate` 后求增量，再经 `session.applyRemoteUpdate` 应用（trusted raw 面零 VFSL
 * 预校验）。
 */
export async function applyRawRemote(
  fixture: LeaseRecordFixture,
  mutate: (doc: Y.Doc) => void,
  label = 'raw 污染',
): Promise<void> {
  assert(fixture.session !== undefined, `${label}：fixture 未装配 replication session`);
  const remote = new Y.Doc();
  remote.clientID = REMOTE_CLIENT_ID;
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(fixture.doc));
  mutate(remote);
  const diff = Y.encodeStateAsUpdate(remote, Y.encodeStateVector(fixture.doc));
  const applied = await fixture.session.applyRemoteUpdate(diff);
  assert(applied.ok, `${label}：applyRemoteUpdate → ${JSON.stringify(applied)}`);
}

/** 等待 session owned updates 至少 count 条（异步扇出）。 */
export async function waitForOwnedUpdates(
  fixture: LeaseRecordFixture,
  count: number,
): Promise<void> {
  await settleUntil(
    () => fixture.ownedUpdates.length >= count,
    `owned updates < ${count}（现有 ${fixture.ownedUpdates.length}）`,
  );
}

// ─────────────────────────── 诊断记录助手 ───────────────────────────

/** 该 log 中全部 attempt record（诊断泵 setImmediate 异步投递，读前先沉降）。 */
export function attemptRecords(log: BoundedMemoryDiagnosticLog): AttemptRecord[] {
  return log.records().filter((record): record is AttemptRecord => record.recordKind === 'attempt');
}

/** 该 log 中 operation=root-mutation 的 attempt record（按接纳顺序）。 */
export function rootMutationRecords(log: BoundedMemoryDiagnosticLog): AttemptRecord[] {
  return attemptRecords(log).filter((record) => record.operation === 'root-mutation');
}

/** 等待诊断日志接纳至少 count 条 root-mutation attempt record（泵路径沉降）。 */
export async function waitForRootMutationRecords(
  log: BoundedMemoryDiagnosticLog,
  count: number,
): Promise<AttemptRecord[]> {
  await settleUntil(
    () => rootMutationRecords(log).length >= count,
    `root-mutation records < ${count}（现有 ${rootMutationRecords(log).length}）`,
  );
  return rootMutationRecords(log);
}

/** committed effect:update 的 update carrier（形态断言前提）。 */
export function updateCarrierOf(record: AttemptRecord): UpdateCarrier {
  const result = record.result;
  assert(
    result.kind === 'committed' && result.effect === 'update',
    `预期 committed effect:update，实际 ${JSON.stringify(result)}`,
  );
  return (result as { kind: 'committed'; effect: 'update'; update: UpdateCarrier }).update;
}

/** inline carrier → bytes（载体重放 oracle）。 */
export function carrierBytes(carrier: UpdateCarrier): Uint8Array {
  assert(carrier.storage === 'inline', `预期 inline carrier，实际 ${JSON.stringify(carrier)}`);
  const inline = carrier as Extract<UpdateCarrier, { storage: 'inline' }>;
  const bytes = new Uint8Array(Buffer.from(inline.base64, 'base64'));
  assert(
    bytes.length === inline.payloadLength,
    `carrier payloadLength 不符（${bytes.length}/${inline.payloadLength}）`,
  );
  return bytes;
}
