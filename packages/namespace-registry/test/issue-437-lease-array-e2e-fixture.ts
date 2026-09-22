/**
 * issue #437（lease 端到端：数组逐元素校验行为钉死，ADR 0033）契约共享 fixture
 * —— **非测试入口**（vitest 只收集 `*.test.ts`；本文件供契约/负控两文件与
 * capability probe 消费，故零 `vitest` 依赖：断言为本地 `assert`，沉降为有界
 * `setImmediate` 轮（沿 issue-393 既有时序纪律——零 `setTimeout` 竞猜））。
 *
 * 最高 seam（任务简报「经 lease `mutateData` 的端到端测试」）：
 *   真实 Registry testing seam（`createNamespaceRegistryForTesting`）→ 真实生产
 *   Runtime 装配 → `registry.open` → `lease.mutateData(...)` / `lease.readData(...)`；
 *   raw-replication 污染只经 `lease.openReplicationSession` 的
 *   `session.applyRemoteUpdate(raw update)` 注入（trusted raw 面，同 ADR 0010），
 *   **绝不**在 lease 层直写 live Y.Doc；fixture 持有的 `doc` 引用仅用于
 *   （a）构造对端副本快照、（b）字节形态 oracle 的基态 —— 与既有
 *   `issue-389-change-subscription-t3-fixture.ts` 的 seed 语义一致。
 *
 * 数据设计（最小、确定、可判定）：
 *   - `items`（`YArray<number> = [1,2,3,4,5]`）：fast path 目标（ADR 0033 决策 1
 *     非 union `T[]`）；
 *   - `rows`（`YArray<{qty,tag}>`，3 个 Y.Map 元素）：元素载体/元素字段值非法的
 *     污染面；
 *   - `uarr`（`YArray<number> | YArray<string> = [7,8,9]`）：union 数组目标 ——
 *     永久 legacy 全量边界轨（ADR 0033 决策 1 双轨）；
 *   - `n`（number）：诊断记录形态的标量对照写。
 *
 * 确定性纪律：零随机源（计数 randomBytes）、零真实时钟（固定 Clock）、受控
 * scheduler；Yjs 远端污染一律**插入新元素**（不写既有键/既有元素），避免并发
 * 项按 clientID 决胜的不确定合并；fixture doc 显式固定 clientID。
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

export const NS_437 = 'ns-437-lease-array';
export const OWNER_437: User = Object.freeze({ userId: 'u-437' });
export const NOW_MS = 1_700_437_000_000;
export const HUB_INSTANCE_ID = 'hub-437';
export const PEER_INSTANCE_ID = 'peer-437';
/** fixture live doc 的固定 clientID（字节 oracle 确定性）。 */
export const HUB_CLIENT_ID = 4242;
/** 远端（raw replication 对端）固定 clientID——仅用于构造增量 update。 */
export const REMOTE_CLIENT_ID = 999_999;

export const SCHEMA_437 = Object.freeze({
  lang: 'vfsl',
  version: 1,
  id: 'issue-437-lease-array',
  text: `type ROOT = {
  /** 数值数组（fast path 目标） */
  items: YArray<number>;
  /** 记录数组（元素载体/字段值污染面） */
  rows: YArray<{ qty: number; tag: string }>;
  /** union 数组目标（永久 legacy 全量边界轨） */
  uarr: YArray<number> | YArray<string>;
  /** 诊断形态对照标量 */
  n: number;
};
`,
});

export interface SeedRow {
  readonly qty: number;
  readonly tag: string;
}

export interface LeaseArrayFixtureOptions {
  /** items 初始值（缺省 [1,2,3,4,5]）。 */
  readonly items?: readonly number[];
  /** rows 初始值（缺省 [{qty:1,tag:'a'},{qty:2,tag:'b'},{qty:3,tag:'c'}]）。 */
  readonly rows?: readonly SeedRow[];
  /** uarr 初始值（缺省 [7,8,9]）。 */
  readonly uarr?: readonly (number | string)[];
  /** 装配复制：enableReplication + openReplicationSession + owned update 捕获。 */
  readonly replication?: boolean;
  /** 装配有界内存诊断日志（生产形状 binding：emitter + runtimeEmitterFor）。 */
  readonly diagnostics?: boolean;
  /** 实例静态角色（缺省 'hub'）。 */
  readonly role?: 'hub' | 'peer';
  /** namespaceId（缺省 NS_437）。 */
  readonly namespaceId?: string;
}

// ─────────────────────────── 本地断言 / 沉降 ───────────────────────────

/** lease 面契约前提断言（throw 即红——非 vitest 耦合，probe/vitest 共用）。 */
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`契约前提失败：${message}`);
}

/** 有界 setImmediate 轮沉降（异步扇出/诊断泵投递；零 setTimeout 竞猜）。 */
export async function settleUntil(
  read: () => boolean,
  message: string,
  rounds = 200,
): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    if (read()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  assert(read(), `沉降 ${rounds} 轮后仍未满足：${message}`);
}

// ─────────────────────────── 文档 / 持久化 stub ───────────────────────────

function rowMap(row: SeedRow): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  map.set('qty', row.qty);
  map.set('tag', row.tag);
  return map;
}

/** 构建 lease 契约文档（SCHEMA/META/ROOT；显式固定 clientID）。 */
export function buildLeaseArrayDoc(options: LeaseArrayFixtureOptions = {}): Y.Doc {
  const doc = new Y.Doc();
  doc.clientID = HUB_CLIENT_ID;
  const sc = doc.getMap('SCHEMA');
  sc.set('lang', SCHEMA_437.lang);
  sc.set('version', SCHEMA_437.version);
  sc.set('id', SCHEMA_437.id);
  sc.set('text', SCHEMA_437.text);
  const meta = doc.getMap('META');
  meta.set('docId', options.namespaceId ?? NS_437);
  meta.set('createdAt', NOW_MS);
  const root = doc.getMap('ROOT');
  const items = new Y.Array<number>();
  items.push([...(options.items ?? [1, 2, 3, 4, 5])]);
  root.set('items', items);
  const rows = new Y.Array<Y.Map<unknown>>();
  for (const row of options.rows ?? [
    { qty: 1, tag: 'a' },
    { qty: 2, tag: 'b' },
    { qty: 3, tag: 'c' },
  ]) {
    rows.push([rowMap(row)]);
  }
  root.set('rows', rows);
  const uarr = new Y.Array<unknown>();
  uarr.push([...(options.uarr ?? [7, 8, 9])]);
  root.set('uarr', uarr);
  root.set('n', 1);
  return doc;
}

/** 冻结 DocHandle 投影（getStatus ready；release 恒 resolve）。 */
class LeaseArrayHandle implements DocHandle {
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
class LeaseArrayPersistence implements DocPersistence {
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
    return new LeaseArrayHandle(stored.owner, stored.docId, stored.doc);
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

export interface LeaseArrayFixture {
  readonly registry: NamespaceRegistry;
  readonly lease: NamespaceLease;
  /** seed/live doc 引用（仅基态快照与 oracle 用；断言只经 lease 面取值）。 */
  readonly doc: Y.Doc;
  readonly persistence: LeaseArrayPersistence;
  readonly namespaceId: string;
  readonly session: ReplicationSession | undefined;
  /** session owned update 捕获（复制的协议面输入）。 */
  readonly ownedUpdates: Uint8Array[];
  readonly log: BoundedMemoryDiagnosticLog | undefined;
}

/** 等待 lease 的 runtime schema ready（既有有界沉降纪律）。 */
export async function waitForSchemaReady(lease: NamespaceLease): Promise<void> {
  await settleUntil(
    () => {
      const status = lease.getStatus();
      return status.lease === 'active' && status.runtime.schema.state === 'ready';
    },
    'lease runtime schema 未到 ready',
  );
}

/** 打开 hub（或 peer-role）lease fixture（生产 Runtime 装配；可选复制/诊断接线）。 */
export async function openLeaseFixture(
  options: LeaseArrayFixtureOptions = {},
): Promise<LeaseArrayFixture> {
  const namespaceId = options.namespaceId ?? NS_437;
  const role = options.role ?? 'hub';
  const doc = buildLeaseArrayDoc(options);
  const persistence = new LeaseArrayPersistence({ owner: OWNER_437, docId: namespaceId, doc });
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
  const opened = await registry.open({ userId: OWNER_437.userId }, namespaceId);
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
  return { registry, lease, doc, persistence, namespaceId, session, ownedUpdates, log };
}

/** hub lease 的复制身份事实（enabled 两键）。 */
export function replicationIdentityOf(lease: NamespaceLease): {
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

/** 从 hub 快照 bootstrap 的 peer lease fixture（ADR 0010 peer 复制面）。 */
export async function openPeerFixture(hub: LeaseArrayFixture): Promise<LeaseArrayFixture> {
  const identity = replicationIdentityOf(hub.lease);
  const snapshot = new Y.Doc();
  snapshot.clientID = HUB_CLIENT_ID + 1; // peer 本地 clientID（确定性；与 hub 不同）
  Y.applyUpdate(snapshot, Y.encodeStateAsUpdate(hub.doc));
  const namespaceId = hub.namespaceId;
  const persistence = new LeaseArrayPersistence(); // 导入前 key 缺席（bootstrap 资格）
  const registry = createNamespaceRegistryForTesting(persistence, {
    clock: { now: () => NOW_MS },
    scheduler: createRegistryTestScheduler(),
    randomBytes: makeCounterRandomBytes(),
    role: 'peer',
  });
  const imported = await registry.importReplica(
    { userId: OWNER_437.userId },
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
  };
}

// ─────────────────────────── lease 读取助手 ───────────────────────────

/** lease.readData 成功值（失败即 throw——契约前提）。 */
export function readValue(lease: NamespaceLease, path: readonly (string | number)[]): unknown {
  const read = lease.readData(path);
  assert(read.ok, `readData(${JSON.stringify(path)}) → ${JSON.stringify(read)}`);
  return read.value;
}

/** lease.readData 数组值投影。 */
export function readArray(lease: NamespaceLease, path: readonly (string | number)[]): unknown[] {
  const value = readValue(lease, path);
  assert(Array.isArray(value), `readData(${JSON.stringify(path)}) 应投影为数组`);
  return value as unknown[];
}

/**
 * 文档 ROOT 容器下的数组载体（**仅测试装置面**：raw 污染构造与字节 oracle 的导航；
 * 契约断言一律经 lease 面取值）。注意 `doc.getArray('items')` 是顶层类型导航（错），
 * ROOT 内数组必须经 `doc.getMap('ROOT').get(key)`。
 */
export function rootArray(doc: Y.Doc, key: string): Y.Array<unknown> {
  const value = doc.getMap('ROOT').get(key);
  assert(value instanceof Y.Array, `ROOT.${key} 不是 Y.Array 载体`);
  return value as Y.Array<unknown>;
}

/**
 * 元素读计数（结构性成本代理；沿 #436 `countElementReads` 先例：`get`/`toArray`/`forEach`
 * 计真）。`mutateData` 的实际判定在 sequencer 槽内（await 之后）执行，故包装覆盖整个
 * await 窗口；结算后删除包装（零残留——prototype 方法复位）。
 */
export async function countElementReadsAsync(
  array: Y.Array<unknown>,
  run: () => Promise<unknown>,
): Promise<number> {
  let reads = 0;
  const originalGet = array.get.bind(array) as (index: number) => unknown;
  const originalToArray = array.toArray.bind(array) as () => unknown[];
  const originalForEach = array.forEach.bind(array) as (
    f: (value: unknown, index: number, array: unknown) => void,
  ) => void;
  const target = array as unknown as {
    get?: (index: number) => unknown;
    toArray?: () => unknown[];
    forEach?: (f: (value: unknown, index: number, array: unknown) => void) => void;
  };
  target.get = (index: number) => {
    reads += 1;
    return originalGet(index);
  };
  target.toArray = () => {
    reads += array.length;
    return originalToArray();
  };
  target.forEach = (f) => {
    reads += array.length;
    originalForEach(f);
  };
  try {
    await run();
    return reads;
  } finally {
    delete target.get;
    delete target.toArray;
    delete target.forEach;
  }
}

// ─────────────────────── raw replication 污染注入 ───────────────────────

/**
 * 经 replication apply 注入 raw 污染：对端（固定 clientID）以 live doc 当刻状态为
 * 基态、施加 `mutate` 后求增量，再经 session.applyRemoteUpdate 应用（trusted raw
 * 面零 VFSL 预校验；ROOT 载体摘要检查照旧放行）。
 */
export async function applyRawRemote(
  session: ReplicationSession,
  liveDoc: Y.Doc,
  mutate: (doc: Y.Doc) => void,
): Promise<void> {
  const remote = new Y.Doc();
  remote.clientID = REMOTE_CLIENT_ID;
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(liveDoc));
  mutate(remote);
  const diff = Y.encodeStateAsUpdate(remote, Y.encodeStateVector(liveDoc));
  const applied = await session.applyRemoteUpdate(diff);
  assert(applied.ok, `raw remote apply → ${JSON.stringify(applied)}`);
}

/** 等待 session owned updates 至少 count 条（异步扇出）。 */
export async function waitForOwnedUpdates(fixture: LeaseArrayFixture, count: number): Promise<void> {
  await settleUntil(
    () => fixture.ownedUpdates.length >= count,
    `owned updates < ${count}（现有 ${fixture.ownedUpdates.length}）`,
  );
}

// ─────────────────────────── 诊断记录助手 ───────────────────────────

/** 等待诊断日志接纳至少 count 条 attempt record（泵路径 setImmediate 沉降）。 */
export async function waitForAttemptRecords(
  log: BoundedMemoryDiagnosticLog,
  count: number,
): Promise<AttemptRecord[]> {
  await settleUntil(
    () => log.records().filter((record) => record.recordKind === 'attempt').length >= count,
    `attempt records < ${count}`,
  );
  return log.records().filter((record): record is AttemptRecord => record.recordKind === 'attempt');
}

/** 取该 log 中第 sequenceIndex 条 operation=root-mutation 的 attempt record。 */
export function rootMutationRecord(
  log: BoundedMemoryDiagnosticLog,
  sequenceIndex = 0,
): AttemptRecord {
  const records = log
    .records()
    .filter((record): record is AttemptRecord => record.recordKind === 'attempt')
    .filter((record) => record.operation === 'root-mutation');
  const record = records[sequenceIndex];
  assert(record !== undefined, `未找到第 ${sequenceIndex} 条 root-mutation 记录（现有 ${records.length} 条）`);
  return record;
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
  assert(carrier.storage === 'inline', `预期 inline carrier，实际 ${carrier.storage}`);
  const inline = carrier as Extract<UpdateCarrier, { storage: 'inline' }>;
  const bytes = new Uint8Array(Buffer.from(inline.base64, 'base64'));
  assert(bytes.length === inline.payloadLength, `carrier payloadLength 不符（${bytes.length}/${inline.payloadLength}）`);
  return bytes;
}
