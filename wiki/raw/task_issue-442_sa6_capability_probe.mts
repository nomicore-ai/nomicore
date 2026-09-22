/**
 * issue #442 SA6 能力/契约探针 — lease `mutateData` 端到端 Record/parent 行为（ADR 0034）
 *
 * 任务类型：feature（能力缺口 = 验证覆盖面缺口；本票「不改实现，只把新语义在最高 seam
 * 上立法成回归测试」）。本探针把 #442 AC1–AC6 的每一条目标断言先在**最高 seam**
 * （真实 Registry testing seam → 生产 Runtime 装配 → `registry.open` → `lease.mutateData`）
 * 上实测为可观察事实，产出：
 *   - HEAD（≥ 61778bc，#441 已合入）目标行为逐条命中（AC1 行为变化 + AC2 不变量 +
 *     AC3 union map 永久 legacy + AC4 值位 union fast path + AC5 诊断记录形态 +
 *     AC6 复制收敛）；
 *   - `--baseline`（pre-#441 `3fd6aa8`：doc-runtime 未接线）判别组按**旧语义**命中
 *     （触达面外污染连带拒绝），不变量组与目标修订逐字相同 ⇒ 交付契约 AC1 组具备
 *     判别力（旧实现必在目标断言处失败），AC2–AC6 组为恒绿回归锚。
 *
 * 运行：
 *   NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx \
 *     wiki/raw/task_issue-442_sa6_capability_probe.mts [--baseline]
 *
 * 纪律：零生产改动；污染只经 `session.applyRemoteUpdate`（trusted raw replication，同
 * ADR 0010）；断言只观察运行时行为（lease 判别联合结果、issue message/path、readData
 * 逻辑值、Y.Map entry 读计数、Yjs update 事件与状态字节、诊断 attempt record/carrier、
 * 复制 owned update 收敛）；零源码字符串断言、零真实时钟、零网络、零随机源。
 */
// 探针位于 wiki/raw（非包内），故走相对源码导入（同 #441/#421 探针先例）；
// `@nomicore/*` 包内依赖各自经包 node_modules 解析，yjs 实例经 realpath 单例共享。
import * as Y from '../../packages/namespace-registry/node_modules/yjs/dist/yjs.mjs';
import type { DocHandle, DocPersistence, User } from '../../packages/persistence/src/index.js';
import type {
  NamespaceLease,
  NamespaceRegistry,
  RegistryRandomBytes,
  ReplicationSession,
} from '../../packages/namespace-registry/src/index.js';
import {
  createNamespaceRegistryForTesting,
  createRegistryTestScheduler,
} from '../../packages/namespace-registry/src/testing.js';
import {
  createBoundedMemoryDiagnosticLog,
  type AttemptRecord,
  type BoundedMemoryDiagnosticLog,
  type UpdateCarrier,
} from '../../packages/namespace-diagnostic-log/src/index.js';

// ═══════════════════════════ 修订 / 模式 ═══════════════════════════

const BASELINE = process.argv.includes('--baseline');
const REVISION = BASELINE ? 'baseline(pre-#441 3fd6aa8)' : 'target(HEAD>=61778bc)';

// ═══════════════════════════ 常量（冻结夹具）═══════════════════════════

const NS = 'ns-442-lease-record';
const OWNER: User = Object.freeze({ userId: 'u-442' });
const NOW_MS = 1_700_442_000_000;
const HUB_CLIENT_ID = 4242;
const REMOTE_CLIENT_ID = 999_999;
const HUB_INSTANCE_ID = 'hub-442';
const PEER_INSTANCE_ID = 'peer-442';

const SCHEMA_TEXT = [
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
].join('\n');

const SCHEMA = Object.freeze({
  lang: 'vfsl',
  version: 1,
  id: 'issue-442-lease-record',
  text: SCHEMA_TEXT,
});

// ═══════════════════════════ 断言 / 报告 ═══════════════════════════

let passed = 0;
const failures: string[] = [];

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** 结构化证据行（供报告冻结逐字 message/path/计数）。 */
function evidence(id: string, payload: unknown): void {
  log(`EVIDENCE ${id} ${JSON.stringify(payload)}`);
}

async function scenario(id: string, group: string, desc: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    log(`PASS ${id} [${group}] ${desc}`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    failures.push(`${id}: ${detail}`);
    log(`FAIL ${id} [${group}] ${desc}\n     ${detail.split('\n').join('\n     ')}`);
  }
}

interface SimpleIssue {
  readonly message: string;
  readonly path: readonly unknown[];
}

function resultOf(result: unknown): { ok: boolean; issues: SimpleIssue[] } {
  const candidate = result as { ok?: unknown; issues?: unknown };
  const ok = candidate.ok === true;
  const raw = Array.isArray(candidate.issues) ? (candidate.issues as Array<{ message?: unknown; path?: unknown }>) : [];
  return {
    ok,
    issues: raw.map((issue) => ({ message: String(issue.message ?? ''), path: Array.isArray(issue.path) ? issue.path : [] })),
  };
}

function expectOk(result: unknown, label: string): void {
  const normalized = resultOf(result);
  check(normalized.ok, `${label}：期望 ok:true，实际 ${JSON.stringify(result)}`);
  log(`EVIDENCE OK ${label}`);
}

function expectIssue(
  result: unknown,
  expected: { readonly messageIncludes?: string; readonly messageEquals?: string; readonly path?: readonly unknown[] },
  label: string,
): SimpleIssue {
  const normalized = resultOf(result);
  check(!normalized.ok, `${label}：期望 ok:false，实际 ${JSON.stringify(result)}`);
  check(normalized.issues.length > 0, `${label}：ok:false 但 issues 为空`);
  const first = normalized.issues[0]!;
  if (expected.messageIncludes !== undefined) {
    check(
      first.message.includes(expected.messageIncludes),
      `${label}：期望 message 含 ${JSON.stringify(expected.messageIncludes)}，实际 ${JSON.stringify(first.message)}`,
    );
  }
  if (expected.messageEquals !== undefined) {
    check(
      first.message === expected.messageEquals,
      `${label}：期望 message 逐字 ${JSON.stringify(expected.messageEquals)}，实际 ${JSON.stringify(first.message)}`,
    );
  }
  if (expected.path !== undefined) {
    check(
      JSON.stringify(first.path) === JSON.stringify(expected.path),
      `${label}：期望 path ${JSON.stringify(expected.path)}，实际 ${JSON.stringify(first.path)}`,
    );
  }
  log(`EVIDENCE ISSUE ${label} ${JSON.stringify(normalized.issues)}`);
  return first;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

async function settle(read: () => boolean, message: string, rounds = 400): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    if (read()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  check(read(), `沉降 ${rounds} 轮后仍未满足：${message}`);
}

// ═══════════════════════════ 文档 / 持久化 stub ═══════════════════════════

function itemEntry(title: string, qty: unknown): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  map.set('title', title);
  map.set('qty', qty);
  return map;
}

interface SeedOptions {
  readonly tasksN?: number;
  readonly blobsN?: number;
  readonly maybeN?: number;
}

function buildDoc(options: SeedOptions = {}): Y.Doc {
  const doc = new Y.Doc();
  doc.clientID = HUB_CLIENT_ID;
  const sc = doc.getMap('SCHEMA');
  sc.set('lang', SCHEMA.lang);
  sc.set('version', SCHEMA.version);
  sc.set('id', SCHEMA.id);
  sc.set('text', SCHEMA.text);
  const meta = doc.getMap('META');
  meta.set('docId', NS);
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

class ProbeHandle implements DocHandle {
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

interface StoredDoc {
  readonly owner: User;
  readonly docId: string;
  readonly doc: Y.Doc;
  archived: boolean;
}

function docKey(owner: User, docId: string): string {
  return `${owner.userId}\u0000${docId}`;
}

class ProbePersistence implements DocPersistence {
  saveCalls = 0;
  private readonly docs = new Map<string, StoredDoc>();
  constructor(seed?: Readonly<{ owner: User; docId: string; doc: Y.Doc }>) {
    if (seed !== undefined) {
      this.docs.set(docKey(seed.owner, seed.docId), { owner: seed.owner, docId: seed.docId, doc: seed.doc, archived: false });
    }
  }
  private handleOf(stored: StoredDoc): DocHandle {
    return new ProbeHandle(stored.owner, stored.docId, stored.doc);
  }
  async createDoc(owner: User, docId: string, doc: Y.Doc): Promise<DocHandle> {
    const stored: StoredDoc = { owner, docId, doc, archived: false };
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
  async importDoc(owner: User, docId: string, doc: Y.Doc): Promise<DocHandle> {
    const stored: StoredDoc = { owner, docId, doc, archived: false };
    this.docs.set(docKey(owner, docId), stored);
    return this.handleOf(stored);
  }
}

function counterRandomBytes(): RegistryRandomBytes {
  let counter = 0;
  return (length: number): Uint8Array => {
    if (length !== 16) throw new Error(`受控随机源只服务 128-bit 请求，实际 ${length}`);
    counter += 1;
    const hex = counter.toString(16).padStart(32, '0');
    const out = new Uint8Array(16);
    for (let i = 0; i < 16; i += 1) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
  };
}

// ═══════════════════════════ lease fixture ═══════════════════════════

interface Fx {
  readonly registry: NamespaceRegistry;
  readonly lease: NamespaceLease;
  readonly doc: Y.Doc;
  readonly session: ReplicationSession | undefined;
  readonly ownedUpdates: Uint8Array[];
  readonly log: BoundedMemoryDiagnosticLog | undefined;
  readonly updateEvents: Uint8Array[];
}

interface OpenOptions extends SeedOptions {
  readonly replication?: boolean;
  readonly diagnostics?: boolean;
  readonly role?: 'hub' | 'peer';
}

async function openFixture(options: OpenOptions = {}): Promise<Fx> {
  const role = options.role ?? 'hub';
  const doc = buildDoc(options);
  const updateEvents: Uint8Array[] = [];
  doc.on('update', (update: Uint8Array) => updateEvents.push(update.slice()));
  const persistence = new ProbePersistence({ owner: OWNER, docId: NS, doc });
  const log = options.diagnostics === true
    ? createBoundedMemoryDiagnosticLog({ inputPolicy: 'digest', issuesPolicy: 'full', updateCapture: true })
    : undefined;
  const registry = createNamespaceRegistryForTesting(persistence, {
    clock: { now: () => NOW_MS },
    scheduler: createRegistryTestScheduler(),
    randomBytes: counterRandomBytes(),
    role,
    ...(log !== undefined
      ? {
          diagnosticLog: {
            emitter: log.emitter,
            runtimeEmitterFor: (namespace: string) => (namespace === NS ? log.emitter : undefined),
          },
        }
      : {}),
  });
  const opened = await registry.open({ userId: OWNER.userId }, NS);
  check(opened.ok, `registry.open 失败：${JSON.stringify(opened)}`);
  const lease = opened.lease;
  await settle(() => {
    const status = lease.getStatus();
    return status.lease === 'active' && status.runtime.schema.state === 'ready';
  }, 'lease runtime schema 未到 ready');

  const ownedUpdates: Uint8Array[] = [];
  let session: ReplicationSession | undefined;
  if (options.replication === true) {
    const enabled = await lease.enableReplication();
    check(enabled.ok, `enableReplication 失败：${JSON.stringify(enabled)}`);
    const openedSession = await lease.openReplicationSession({
      localRole: role,
      remoteInstanceId: role === 'hub' ? PEER_INSTANCE_ID : HUB_INSTANCE_ID,
    });
    check(openedSession.ok, `openReplicationSession 失败：${JSON.stringify(openedSession)}`);
    session = openedSession.session;
    session.subscribeOwnedUpdates((update) => ownedUpdates.push(update.slice()));
  }
  return { registry, lease, doc, session, ownedUpdates, log, updateEvents };
}

async function openPeerFixture(hub: Fx): Promise<Fx> {
  const status = hub.lease.getStatus();
  check(status.lease === 'active' && status.runtime.replication.state === 'enabled', 'hub 复制身份未启用');
  const identity = status.runtime.replication;
  const snapshot = new Y.Doc();
  snapshot.clientID = HUB_CLIENT_ID + 1;
  Y.applyUpdate(snapshot, Y.encodeStateAsUpdate(hub.doc));
  const persistence = new ProbePersistence();
  const registry = createNamespaceRegistryForTesting(persistence, {
    clock: { now: () => NOW_MS },
    scheduler: createRegistryTestScheduler(),
    randomBytes: counterRandomBytes(),
    role: 'peer',
  });
  const imported = await registry.importReplica({ userId: OWNER.userId }, NS, snapshot, identity);
  check(imported.ok, `peer importReplica 失败：${JSON.stringify(imported)}`);
  const lease = imported.lease;
  await settle(() => {
    const s = lease.getStatus();
    return s.lease === 'active' && s.runtime.schema.state === 'ready';
  }, 'peer runtime schema 未到 ready');
  const openedSession = await lease.openReplicationSession({ localRole: 'peer', remoteInstanceId: HUB_INSTANCE_ID });
  check(openedSession.ok, `peer openReplicationSession 失败：${JSON.stringify(openedSession)}`);
  const updateEvents: Uint8Array[] = [];
  snapshot.on('update', (update: Uint8Array) => updateEvents.push(update.slice()));
  const ownedUpdates: Uint8Array[] = [];
  openedSession.session.subscribeOwnedUpdates((update) => ownedUpdates.push(update.slice()));
  return { registry, lease, doc: snapshot, session: openedSession.session, ownedUpdates, log: undefined, updateEvents };
}

// ═══════════════════════════ lease 读取 / raw 污染 ═══════════════════════════

function readAt(lease: NamespaceLease, path: readonly (string | number)[]): unknown {
  const read = lease.readData(path);
  check(read.ok, `readData(${JSON.stringify(path)}) 失败：${JSON.stringify(read)}`);
  return read.value;
}

function rootMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap('ROOT');
}

function rawMapAt(doc: Y.Doc, path: readonly string[]): Y.Map<unknown> {
  let cursor: unknown = rootMap(doc);
  for (const key of path) {
    check(cursor instanceof Y.Map, `raw 导航 ${JSON.stringify(path)}：${key} 之前不是 Y.Map`);
    cursor = cursor.get(key);
  }
  check(cursor instanceof Y.Map, `raw 导航 ${JSON.stringify(path)}：终点不是 Y.Map`);
  return cursor;
}

async function applyRawRemote(fx: Fx, mutate: (doc: Y.Doc) => void, label: string): Promise<void> {
  check(fx.session !== undefined, `${label}：fixture 未装配 replication session`);
  const remote = new Y.Doc();
  remote.clientID = REMOTE_CLIENT_ID;
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(fx.doc));
  mutate(remote);
  const diff = Y.encodeStateAsUpdate(remote, Y.encodeStateVector(fx.doc));
  const applied = await fx.session!.applyRemoteUpdate(diff);
  check(applied.ok, `${label}：applyRemoteUpdate 失败 ${JSON.stringify(applied)}`);
}

function stateBytes(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc);
}

function countUpdates(fx: Fx): number {
  return fx.updateEvents.length;
}

// ═══════════════════════════ 读计数（Y.Map entry 结构性成本代理）═══════════════════════════

interface MapReadCounts {
  readonly valueReads: number;
  readonly presenceReads: number;
}

async function countMapReadsAsync(
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
  const originalForEach = map.forEach.bind(map) as (f: (value: unknown, key: string, map: Y.Map<unknown>) => void) => void;
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
  for (const [name, original] of [
    ['keys', originalKeys],
    ['values', originalValues],
    ['entries', originalEntries],
    ['toJSON', originalToJSON],
    [Symbol.iterator, originalIterator],
  ] as const) {
    target[name as PropertyKey] = () => {
      valueReads += sizeOf();
      return (original as () => unknown)();
    };
  }
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
    delete target.forEach;
    delete target.toJSON;
    delete target[Symbol.iterator];
  }
}

// ═══════════════════════════ 诊断记录助手 ═══════════════════════════

function attemptRecords(log: BoundedMemoryDiagnosticLog): AttemptRecord[] {
  return log.records().filter((record): record is AttemptRecord => record.recordKind === 'attempt');
}

function rootMutationRecords(log: BoundedMemoryDiagnosticLog): AttemptRecord[] {
  return attemptRecords(log).filter((record) => record.operation === 'root-mutation');
}

function updateCarrierOf(record: AttemptRecord): UpdateCarrier {
  const result = record.result;
  check(
    result.kind === 'committed' && result.effect === 'update',
    `预期 committed effect:update，实际 ${JSON.stringify(result)}`,
  );
  return (result as { kind: 'committed'; effect: 'update'; update: UpdateCarrier }).update;
}

function carrierBytes(carrier: UpdateCarrier): Uint8Array {
  check(carrier.storage === 'inline', `预期 inline carrier，实际 ${JSON.stringify(carrier)}`);
  const inline = carrier as Extract<UpdateCarrier, { storage: 'inline' }>;
  const bytes = new Uint8Array(Buffer.from(inline.base64, 'base64'));
  check(bytes.length === inline.payloadLength, `carrier payloadLength 不符（${bytes.length}/${inline.payloadLength}）`);
  return bytes;
}

// ═══════════════════════════ 场景 ═══════════════════════════

async function main(): Promise<void> {
  log(`# issue #442 SA6 lease-record capability probe — revision=${REVISION}`);
  log('');

  // ─────────── A 组：AC1 行为变化（判别组；旧实现 = 连带拒绝）───────────

  await scenario('A1', 'AC1', 'Record set @ 污染 sibling（载体错位）→ 目标键合法即成功、污染保留、恰 1 update', async () => {
    const fx = await openFixture({ replication: true });
    await applyRawRemote(fx, (doc) => { rawMapAt(doc, ['tasks']).set('t9', 'oops'); }, 'A1');
    const before = stateBytes(fx.doc);
    const pollutionSeen = readAt(fx.lease, ['tasks', 't9']);
    const updatesBefore = countUpdates(fx);
    const result = await fx.lease.mutateData({ op: 'set', path: ['tasks', 't3'], value: { title: 't3', qty: 3 } });
    if (BASELINE) {
      expectIssue(result, { messageIncludes: '载体错位' }, 'A1(baseline)');
      check(sameBytes(before, stateBytes(fx.doc)), 'A1(baseline)：拒绝必须零写入');
      check(countUpdates(fx) === updatesBefore, 'A1(baseline)：拒绝必须零 update');
    } else {
      expectOk(result, 'A1(target)');
      check(JSON.stringify(pollutionSeen) === JSON.stringify('oops'), `A1：污染应可读为 raw 值，实际 ${JSON.stringify(pollutionSeen)}`);
      check(countUpdates(fx) === updatesBefore + 1, `A1：恰 1 个 update 事件，实际 ${countUpdates(fx) - updatesBefore}`);
      check(JSON.stringify(readAt(fx.lease, ['tasks', 't3'])) === JSON.stringify({ title: 't3', qty: 3 }), 'A1：目标键未写入');
      check(readAt(fx.lease, ['tasks', 't9']) === 'oops', 'A1：污染未被修复/删除');
    }
  });

  await scenario('A2', 'AC1', 'Record delete @ 污染 sibling（载体错位）→ ok:true + 恰 1 update', async () => {
    const fx = await openFixture({ replication: true });
    await applyRawRemote(fx, (doc) => { rawMapAt(doc, ['tasks']).set('t9', 'oops'); }, 'A2');
    const before = stateBytes(fx.doc);
    const updatesBefore = countUpdates(fx);
    const result = await fx.lease.mutateData({ op: 'delete', path: ['tasks', 't0'] });
    if (BASELINE) {
      expectIssue(result, { messageIncludes: '载体错位' }, 'A2(baseline)');
      check(sameBytes(before, stateBytes(fx.doc)), 'A2(baseline)：拒绝必须零写入');
      check(countUpdates(fx) === updatesBefore, 'A2(baseline)：拒绝必须零 update');
    } else {
      expectOk(result, 'A2(target)');
      check(countUpdates(fx) === updatesBefore + 1, `A2：恰 1 个 update 事件，实际 ${countUpdates(fx) - updatesBefore}`);
      check(readAt(fx.lease, ['tasks', 't9']) === 'oops', 'A2：污染未被修复');
      check(
        !JSON.stringify(Object.keys(readAt(fx.lease, ['tasks']) as Record<string, unknown>)).includes('"t0"'),
        'A2：目标键 t0 未被删除',
      );
    }
  });

  await scenario('A3', 'AC1', 'Record delete（目标键自身即污染位）→ 删除不读旧值、照常成功', async () => {
    const fx = await openFixture({ replication: true });
    await applyRawRemote(fx, (doc) => { rawMapAt(doc, ['tasks']).set('t9', 'oops'); }, 'A3');
    const before = stateBytes(fx.doc);
    const updatesBefore = countUpdates(fx);
    const result = await fx.lease.mutateData({ op: 'delete', path: ['tasks', 't9'] });
    if (BASELINE) {
      expectIssue(result, { messageIncludes: '载体错位' }, 'A3(baseline)');
      check(sameBytes(before, stateBytes(fx.doc)), 'A3(baseline)：拒绝必须零写入');
      check(countUpdates(fx) === updatesBefore, 'A3(baseline)：拒绝必须零 update');
    } else {
      expectOk(result, 'A3(target)');
      check(countUpdates(fx) === updatesBefore + 1, `A3：恰 1 个 update 事件，实际 ${countUpdates(fx) - updatesBefore}`);
      const keys = Object.keys(readAt(fx.lease, ['tasks']) as Record<string, unknown>);
      check(!keys.includes('t9'), `A3：污染键未被删除（keys=${JSON.stringify(keys)}）`);
    }
  });

  await scenario('A4', 'AC1', 'Record set @ 兄弟 entry 值非法（载体正确）→ 不阻断', async () => {
    const fx = await openFixture({ replication: true });
    await applyRawRemote(fx, (doc) => { rawMapAt(doc, ['tasks']).set('t9', itemEntry('bad', 'x')); }, 'A4');
    const before = stateBytes(fx.doc);
    const updatesBefore = countUpdates(fx);
    const result = await fx.lease.mutateData({ op: 'set', path: ['tasks', 't3'], value: { title: 't3', qty: 3 } });
    if (BASELINE) {
      expectIssue(result, { messageIncludes: '类型不匹配' }, 'A4(baseline)');
      check(sameBytes(before, stateBytes(fx.doc)), 'A4(baseline)：拒绝必须零写入');
      check(countUpdates(fx) === updatesBefore, 'A4(baseline)：拒绝必须零 update');
    } else {
      expectOk(result, 'A4(target)');
      check(countUpdates(fx) === updatesBefore + 1, `A4：恰 1 个 update 事件，实际 ${countUpdates(fx) - updatesBefore}`);
      const polluted = readAt(fx.lease, ['tasks', 't9']) as { qty?: unknown };
      check(polluted.qty === 'x', 'A4：污染未被修复');
    }
  });

  await scenario('A5', 'AC1', 'keyPattern Record set @ 兄弟键违约 → 不阻断目标键', async () => {
    const fx = await openFixture({ replication: true });
    await applyRawRemote(fx, (doc) => { rawMapAt(doc, ['codes']).set('nope', itemEntry('n', 1)); }, 'A5');
    const before = stateBytes(fx.doc);
    const updatesBefore = countUpdates(fx);
    const result = await fx.lease.mutateData({ op: 'set', path: ['codes', 'id-2'], value: { title: 'c2', qty: 2 } });
    if (BASELINE) {
      expectIssue(result, { messageIncludes: '不满足 Pattern' }, 'A5(baseline)');
      check(sameBytes(before, stateBytes(fx.doc)), 'A5(baseline)：拒绝必须零写入');
      check(countUpdates(fx) === updatesBefore, 'A5(baseline)：拒绝必须零 update');
    } else {
      expectOk(result, 'A5(target)');
      check(countUpdates(fx) === updatesBefore + 1, `A5：恰 1 个 update 事件，实际 ${countUpdates(fx) - updatesBefore}`);
      check(JSON.stringify(readAt(fx.lease, ['codes', 'id-2'])) === JSON.stringify({ title: 'c2', qty: 2 }), 'A5：目标键未写入');
      check(readAt(fx.lease, ['codes', 'nope']) !== undefined, 'A5：违约兄弟键被修复/删除');
    }
  });

  await scenario('A6', 'AC1', '封闭对象 delete optional @ 兄弟字段载体错位 → ok:true', async () => {
    const fx = await openFixture({ replication: true });
    await applyRawRemote(fx, (doc) => { rawMapAt(doc, ['obj']).set('deep', 5); }, 'A6');
    const before = stateBytes(fx.doc);
    const updatesBefore = countUpdates(fx);
    const result = await fx.lease.mutateData({ op: 'delete', path: ['obj', 'opt'] });
    if (BASELINE) {
      expectIssue(result, { messageIncludes: '载体错位' }, 'A6(baseline)');
      check(sameBytes(before, stateBytes(fx.doc)), 'A6(baseline)：拒绝必须零写入');
      check(countUpdates(fx) === updatesBefore, 'A6(baseline)：拒绝必须零 update');
    } else {
      expectOk(result, 'A6(target)');
      check(countUpdates(fx) === updatesBefore + 1, `A6：恰 1 个 update 事件，实际 ${countUpdates(fx) - updatesBefore}`);
      const obj = readAt(fx.lease, ['obj']) as Record<string, unknown>;
      check(!('opt' in obj), `A6：opt 未被删除（obj=${JSON.stringify(obj)}）`);
      check(readAt(fx.lease, ['obj', 'deep']) === 5, 'A6：污染字段被修复');
    }
  });

  await scenario('A7', 'AC1', '封闭对象 delete unknown 标量 @ 兄弟字段载体错位 → ok:true', async () => {
    const fx = await openFixture({ replication: true });
    await applyRawRemote(fx, (doc) => { rawMapAt(doc, ['obj']).set('deep', 5); }, 'A7');
    const before = stateBytes(fx.doc);
    const updatesBefore = countUpdates(fx);
    const result = await fx.lease.mutateData({ op: 'delete', path: ['obj', 'unk'] });
    if (BASELINE) {
      expectIssue(result, { messageIncludes: '载体错位' }, 'A7(baseline)');
      check(sameBytes(before, stateBytes(fx.doc)), 'A7(baseline)：拒绝必须零写入');
      check(countUpdates(fx) === updatesBefore, 'A7(baseline)：拒绝必须零 update');
    } else {
      expectOk(result, 'A7(target)');
      check(countUpdates(fx) === updatesBefore + 1, `A7：恰 1 个 update 事件，实际 ${countUpdates(fx) - updatesBefore}`);
      const obj = readAt(fx.lease, ['obj']) as Record<string, unknown>;
      check(!('unk' in obj), `A7：unk 未被删除（obj=${JSON.stringify(obj)}）`);
    }
  });

  await scenario('A8', 'AC1', '封闭对象 delete 必填字段 @ 兄弟字段污染 → 拒绝理由 = 静态必填（旧：父值载体错位）', async () => {
    const fx = await openFixture({ replication: true });
    await applyRawRemote(fx, (doc) => { rawMapAt(doc, ['obj']).set('deep', 5); }, 'A8');
    const before = stateBytes(fx.doc);
    const updatesBefore = countUpdates(fx);
    const result = await fx.lease.mutateData({ op: 'delete', path: ['obj', 'req'] });
    if (BASELINE) {
      expectIssue(result, { messageIncludes: '载体错位' }, 'A8(baseline)');
    } else {
      expectIssue(result, { messageEquals: '缺少必填字段 "req"', path: ['obj', 'req'] }, 'A8(target)');
    }
    check(sameBytes(before, stateBytes(fx.doc)), 'A8：拒绝必须零写入');
    check(countUpdates(fx) === updatesBefore, 'A8：拒绝必须零 update');
  });

  await scenario('A9', 'AC1', 'Record 值位 union（blobs）set @ 兄弟 entry 载体错位 → 不阻断 fast path', async () => {
    const fx = await openFixture({ replication: true });
    await applyRawRemote(fx, (doc) => { rawMapAt(doc, ['blobs']).set('b9', 'oops'); }, 'A9');
    const before = stateBytes(fx.doc);
    const updatesBefore = countUpdates(fx);
    const result = await fx.lease.mutateData({ op: 'set', path: ['blobs', 'b2'], value: { title: 'v', qty: 5 } });
    if (BASELINE) {
      expectIssue(result, { messageIncludes: '载体错位' }, 'A9(baseline)');
      check(sameBytes(before, stateBytes(fx.doc)), 'A9(baseline)：拒绝必须零写入');
      check(countUpdates(fx) === updatesBefore, 'A9(baseline)：拒绝必须零 update');
    } else {
      expectOk(result, 'A9(target)');
      check(countUpdates(fx) === updatesBefore + 1, `A9：恰 1 个 update 事件，实际 ${countUpdates(fx) - updatesBefore}`);
      check(readAt(fx.lease, ['blobs', 'b9']) === 'oops', 'A9：污染未被修复');
      check(JSON.stringify(readAt(fx.lease, ['blobs', 'b2'])) === JSON.stringify({ title: 'v', qty: 5 }), 'A9：目标键未写入');
    }
  });

  await scenario('A10', 'AC1', '深层 Record（outer.inner）set @ 兄弟污染 → 不阻断、路径语义不变', async () => {
    const fx = await openFixture({ replication: true });
    await applyRawRemote(fx, (doc) => { rawMapAt(doc, ['outer', 'inner']).set('n9', 'oops'); }, 'A10');
    const before = stateBytes(fx.doc);
    const updatesBefore = countUpdates(fx);
    const result = await fx.lease.mutateData({ op: 'set', path: ['outer', 'inner', 'n2'], value: { title: 'n2', qty: 2 } });
    if (BASELINE) {
      expectIssue(result, { messageIncludes: '载体错位' }, 'A10(baseline)');
      check(sameBytes(before, stateBytes(fx.doc)), 'A10(baseline)：拒绝必须零写入');
      check(countUpdates(fx) === updatesBefore, 'A10(baseline)：拒绝必须零 update');
    } else {
      expectOk(result, 'A10(target)');
      check(countUpdates(fx) === updatesBefore + 1, `A10：恰 1 个 update 事件，实际 ${countUpdates(fx) - updatesBefore}`);
      check(
        JSON.stringify(readAt(fx.lease, ['outer', 'inner', 'n2'])) === JSON.stringify({ title: 'n2', qty: 2 }),
        'A10：深层目标键未写入',
      );
      check(readAt(fx.lease, ['outer', 'inner', 'n9']) === 'oops', 'A10：污染未被修复');
    }
  });

  await scenario('A11', 'AC1', '批量信封内 Record set @ 兄弟污染 → 批内 ok:true + 单事务单 update', async () => {
    const fx = await openFixture({ replication: true });
    await applyRawRemote(fx, (doc) => { rawMapAt(doc, ['tasks']).set('t9', 'oops'); }, 'A11');
    const before = stateBytes(fx.doc);
    const updatesBefore = countUpdates(fx);
    const result = await fx.lease.mutateData({
      ops: [
        { op: 'set', path: ['tasks', 't7'], value: { title: 'seven', qty: 7 } },
        { op: 'set', path: ['tasks', 't8'], value: { title: 'eight', qty: 8 } },
      ],
    });
    if (BASELINE) {
      expectIssue(result, { messageIncludes: '载体错位' }, 'A11(baseline)');
      check(sameBytes(before, stateBytes(fx.doc)), 'A11(baseline)：拒绝必须零写入');
      check(countUpdates(fx) === updatesBefore, 'A11(baseline)：拒绝必须零 update');
    } else {
      expectOk(result, 'A11(target)');
      check(countUpdates(fx) === updatesBefore + 1, `A11：批量=单事务单 update，实际 ${countUpdates(fx) - updatesBefore}`);
      check(JSON.stringify(readAt(fx.lease, ['tasks', 't7'])) === JSON.stringify({ title: 'seven', qty: 7 }), 'A11：t7 未写入');
      check(JSON.stringify(readAt(fx.lease, ['tasks', 't8'])) === JSON.stringify({ title: 'eight', qty: 8 }), 'A11：t8 未写入');
      check(readAt(fx.lease, ['tasks', 't9']) === 'oops', 'A11：污染未被修复');
    }
  });

  // ─────────── B 组：AC2 不变量（旧新同绿）───────────

  await scenario('B1', 'AC2', 'Record set 新值非法 → 逐字 issue 路径 [...mapPath, key, ...值内路径] + 零写入零 update', async () => {
    const fx = await openFixture({ replication: true });
    const before = stateBytes(fx.doc);
    const updatesBefore = countUpdates(fx);
    const result = await fx.lease.mutateData({ op: 'set', path: ['tasks', 't9'], value: { title: 'x', qty: 'y' } });
    expectIssue(result, { messageEquals: '类型不匹配：期望 number，实际 string', path: ['tasks', 't9', 'qty'] }, 'B1');
    check(sameBytes(before, stateBytes(fx.doc)), 'B1：拒绝必须零写入');
    check(countUpdates(fx) === updatesBefore, 'B1：拒绝必须零 update');
  });

  await scenario('B2', 'AC2', 'Record 键 Pattern 违约 → 逐字 message/path + 零写入零 update', async () => {
    const fx = await openFixture({ replication: true });
    const before = stateBytes(fx.doc);
    const updatesBefore = countUpdates(fx);
    const result = await fx.lease.mutateData({ op: 'set', path: ['codes', 'nope'], value: { title: 'n', qty: 1 } });
    expectIssue(
      result,
      { messageEquals: 'Record 键 "nope" 不满足 Pattern 正则 /^(id-[0-9]+)$/', path: ['codes', 'nope'] },
      'B2',
    );
    check(sameBytes(before, stateBytes(fx.doc)), 'B2：拒绝必须零写入');
    check(countUpdates(fx) === updatesBefore, 'B2：拒绝必须零 update');
  });

  await scenario('B3', 'AC2', 'delete 不存在键 no-op → 逐字拒绝 + 零写入', async () => {
    const fx = await openFixture({ replication: true });
    const before = stateBytes(fx.doc);
    const result = await fx.lease.mutateData({ op: 'delete', path: ['tasks', 'zz'] });
    expectIssue(result, { messageEquals: 'delete 目标键不存在（拒绝 no-op）', path: ['tasks', 'zz'] }, 'B3');
    check(sameBytes(before, stateBytes(fx.doc)), 'B3：拒绝必须零写入');
  });

  await scenario('B4', 'AC2', '封闭对象必填字段 delete → 逐字静态拒绝 + 零写入', async () => {
    const fx = await openFixture({ replication: true });
    const before = stateBytes(fx.doc);
    const result = await fx.lease.mutateData({ op: 'delete', path: ['obj', 'req'] });
    expectIssue(result, { messageEquals: '缺少必填字段 "req"', path: ['obj', 'req'] }, 'B4');
    check(sameBytes(before, stateBytes(fx.doc)), 'B4：拒绝必须零写入');
  });

  await scenario('B5', 'AC2', '封闭对象 unknown 标量字段 delete → 允许（静态规则不变）', async () => {
    const fx = await openFixture({ replication: true });
    expectOk(await fx.lease.mutateData({ op: 'delete', path: ['obj', 'unk'] }), 'B5');
    const obj = readAt(fx.lease, ['obj']) as Record<string, unknown>;
    check(!('unk' in obj), `B5：unk 未被删除（obj=${JSON.stringify(obj)}）`);
  });

  await scenario('B6', 'AC2', '封闭对象 optional 字段 delete 允许、重复 delete 落到 no-op 逐字拒绝', async () => {
    const fx = await openFixture({ replication: true });
    expectOk(await fx.lease.mutateData({ op: 'delete', path: ['obj', 'opt'] }), 'B6(首删)');
    const repeat = await fx.lease.mutateData({ op: 'delete', path: ['obj', 'opt'] });
    expectIssue(repeat, { messageEquals: 'delete 目标键不存在（拒绝 no-op）', path: ['obj', 'opt'] }, 'B6(重复)');
  });

  await scenario('B7', 'AC2', '触达面内载体位（ROOT.tasks 本身非 Y.Map）→ 响亮拒绝、文案 path 不变、零写入', async () => {
    const fx = await openFixture({ replication: true });
    await applyRawRemote(fx, (doc) => { doc.getMap('ROOT').set('tasks', 'oops'); }, 'B7');
    const before = stateBytes(fx.doc);
    const updatesBefore = countUpdates(fx);
    const result = await fx.lease.mutateData({ op: 'set', path: ['tasks', 't3'], value: { title: 't3', qty: 3 } });
    const issue = expectIssue(result, { messageIncludes: '载体错位' }, 'B7');
    // legacy S5 首错文案/路径冻结：触达面内 ROOT 直接子载体位 → path []（与 #441 NC10/NC11 同源）
    check(JSON.stringify(issue.path) === JSON.stringify([]), `B7：期望 path []，实际 ${JSON.stringify(issue.path)}`);
    evidence('B7', { message: issue.message, path: issue.path });
    check(sameBytes(before, stateBytes(fx.doc)), 'B7：拒绝必须零写入');
    check(countUpdates(fx) === updatesBefore, 'B7：拒绝必须零 update');
  });

  await scenario('B8', 'AC2', '深层 Record 非法新值 → issue 路径跨深度 rebase 正确 + 零写入', async () => {
    const fx = await openFixture({ replication: true });
    const before = stateBytes(fx.doc);
    const result = await fx.lease.mutateData({ op: 'set', path: ['outer', 'inner', 'n2'], value: { title: 'x', qty: 'y' } });
    expectIssue(
      result,
      { messageEquals: '类型不匹配：期望 number，实际 string', path: ['outer', 'inner', 'n2', 'qty'] },
      'B8',
    );
    check(sameBytes(before, stateBytes(fx.doc)), 'B8：拒绝必须零写入');
  });

  // ─────────── U 组：AC3 union map 位（永久 legacy 全量边界轨）───────────

  await scenario('U1', 'AC3', 'union map 位（maybe）污染照旧拒绝、零写入零 update', async () => {
    const fx = await openFixture({ replication: true });
    await applyRawRemote(fx, (doc) => { rawMapAt(doc, ['maybe']).set('mz', 'oops'); }, 'U1');
    const before = stateBytes(fx.doc);
    const updatesBefore = countUpdates(fx);
    const result = await fx.lease.mutateData({ op: 'set', path: ['maybe', 'm2'], value: { title: 'mm', qty: 6 } });
    expectIssue(result, { messageIncludes: '载体错位' }, 'U1');
    check(sameBytes(before, stateBytes(fx.doc)), 'U1：拒绝必须零写入');
    check(countUpdates(fx) === updatesBefore, 'U1：拒绝必须零 update');
  });

  await scenario('U2', 'AC3', 'union map 位干净写照常 ok:true（legacy 轨可用性不变）', async () => {
    const fx = await openFixture({ replication: true });
    expectOk(await fx.lease.mutateData({ op: 'set', path: ['maybe', 'm2'], value: { title: 'mm', qty: 6 } }), 'U2');
    expectOk(await fx.lease.mutateData({ op: 'delete', path: ['maybe', 'm0'] }), 'U2(delete)');
  });

  await scenario('U3', 'AC3', '结构性成本：union map 位 ∝ n（全量边界校验仍在）；非 union Record 位与 n 解耦', async () => {
    const n = 64;
    const fx = await openFixture({
      replication: true,
      tasksN: n,
      blobsN: n,
      maybeN: n,
    });
    const tasksReads = await countMapReadsAsync(rawMapAt(fx.doc, ['tasks']), () =>
      fx.lease.mutateData({ op: 'set', path: ['tasks', 'tz'], value: { title: 'tz', qty: 1 } }),
    );
    const maybeReads = await countMapReadsAsync(rawMapAt(fx.doc, ['maybe']), () =>
      fx.lease.mutateData({ op: 'set', path: ['maybe', 'm2'], value: { title: 'mm', qty: 6 } }),
    );
    if (BASELINE) {
      check(
        tasksReads.valueReads >= n,
        `U3(baseline)：旧语义下 tasks 单键写应 ∝ n（≥${n}），实际 ${JSON.stringify(tasksReads)}`,
      );
    } else {
      check(
        tasksReads.valueReads <= 8,
        `U3(target)：fast path 读计数应 O(k)（≤8），实际 ${JSON.stringify(tasksReads)}`,
      );
    }
    check(
      maybeReads.valueReads >= n,
      `U3：union 轨读计数应 ∝ n（≥${n}），实际 ${JSON.stringify(maybeReads)}`,
    );
    evidence('U3', { n, tasksReads, maybeReads });
  });

  await scenario('U4', 'AC3', '结构性成本：fast 轨读计数与 n 解耦（n=64 vs n=256 相等且 ≤8）', async () => {
    const small = await openFixture({ replication: true, tasksN: 64 });
    const big = await openFixture({ replication: true, tasksN: 256 });
    const smallReads = await countMapReadsAsync(rawMapAt(small.doc, ['tasks']), () =>
      small.lease.mutateData({ op: 'set', path: ['tasks', 'tz'], value: { title: 'tz', qty: 1 } }),
    );
    const bigReads = await countMapReadsAsync(rawMapAt(big.doc, ['tasks']), () =>
      big.lease.mutateData({ op: 'set', path: ['tasks', 'tz'], value: { title: 'tz', qty: 1 } }),
    );
    if (BASELINE) {
      check(
        bigReads.valueReads >= 256 && smallReads.valueReads >= 64,
        `U4(baseline)：旧语义读计数应 ∝ n，实际 64→${smallReads.valueReads}、256→${bigReads.valueReads}`,
      );
      check(bigReads.valueReads > smallReads.valueReads, 'U4(baseline)：旧语义 256 规模应显著大于 64');
    } else {
      check(smallReads.valueReads <= 8 && bigReads.valueReads <= 8, `U4(target)：读计数应 ≤8，实际 ${JSON.stringify({ small: smallReads, big: bigReads })}`);
      check(
        smallReads.valueReads === bigReads.valueReads,
        `U4(target)：读计数应与 n 解耦，实际 64→${smallReads.valueReads}、256→${bigReads.valueReads}`,
      );
    }
    evidence('U4', { small: smallReads, big: bigReads });
  });

  // ─────────── V 组：AC4 Record 值位 union（仍走 fast path）───────────

  await scenario('V1', 'AC4', 'Record 值位 union：两支成员新值均接受（clean）', async () => {
    const fx = await openFixture({ replication: true });
    expectOk(await fx.lease.mutateData({ op: 'set', path: ['blobs', 'b2'], value: { title: 'i', qty: 5 } }), 'V1(Item)');
    expectOk(await fx.lease.mutateData({ op: 'set', path: ['blobs', 'b3'], value: { label: 'a', n: 5 } }), 'V1(Alt)');
  });

  await scenario('V2', 'AC4', 'Record 值位 union：非法值拒绝 + 零写入', async () => {
    const fx = await openFixture({ replication: true });
    const before = stateBytes(fx.doc);
    const result = await fx.lease.mutateData({ op: 'set', path: ['blobs', 'b2'], value: { title: 'x', n: 5 } });
    expectIssue(result, {}, 'V2');
    check(sameBytes(before, stateBytes(fx.doc)), 'V2：拒绝必须零写入');
  });

  await scenario('V3', 'AC4', '结构性成本：值位 union 的 Record 写仍与 n 解耦（≤8，n=64/256 相等）', async () => {
    const small = await openFixture({ replication: true, blobsN: 64 });
    const big = await openFixture({ replication: true, blobsN: 256 });
    const smallReads = await countMapReadsAsync(rawMapAt(small.doc, ['blobs']), () =>
      small.lease.mutateData({ op: 'set', path: ['blobs', 'bz'], value: { title: 'bz', qty: 1 } }),
    );
    const bigReads = await countMapReadsAsync(rawMapAt(big.doc, ['blobs']), () =>
      big.lease.mutateData({ op: 'set', path: ['blobs', 'bz'], value: { title: 'bz', qty: 1 } }),
    );
    if (BASELINE) {
      check(
        smallReads.valueReads >= 64 && bigReads.valueReads >= 256,
        `V3(baseline)：旧语义读计数应 ∝ n，实际 64→${smallReads.valueReads}、256→${bigReads.valueReads}`,
      );
    } else {
      check(smallReads.valueReads <= 8 && bigReads.valueReads <= 8, `V3(target)：读计数应 ≤8，实际 ${JSON.stringify({ small: smallReads, big: bigReads })}`);
      check(
        smallReads.valueReads === bigReads.valueReads,
        `V3(target)：读计数应与 n 解耦，实际 64→${smallReads.valueReads}、256→${bigReads.valueReads}`,
      );
    }
    evidence('V3', { small: smallReads, big: bigReads });
  });

  // ─────────── E 组：AC5 诊断烟测（记录形态不变）───────────

  await scenario('E1', 'AC5', 'Record fast-path 提交：root-mutation committed effect:update + inline carrier 重放为真事务增量', async () => {
    const fx = await openFixture({ diagnostics: true });
    const log = fx.log!;
    const baseState = stateBytes(fx.doc);
    expectOk(await fx.lease.mutateData({ op: 'set', path: ['tasks', 't3'], value: { title: 't3', qty: 3 } }), 'E1');
    await settle(() => rootMutationRecords(log).length >= 1, 'E1：root-mutation 记录未接纳');
    const records = rootMutationRecords(log);
    check(records.length === 1, `E1：恰一条最终结局，实际 ${records.length}`);
    const record = records[0]!;
    check(record.stage === 'transaction', `E1：stage=${record.stage}`);
    check(JSON.stringify(record.source) === JSON.stringify({ kind: 'local' }), `E1：source=${JSON.stringify(record.source)}`);
    const carrier = updateCarrierOf(record);
    check(carrier.storage === 'inline', `E1：carrier.storage=${carrier.storage}`);
    check(carrier.format === 'yjs-update-v1', `E1：carrier.format=${carrier.format}`);
    check(carrier.payloadLength > 0, 'E1：payloadLength 应为正');
    check(/^[0-9a-f]{8}$/.test(carrier.crc32c), `E1：crc32c=${carrier.crc32c}`);
    const bytes = carrierBytes(carrier);
    const replayed = new Y.Doc();
    Y.applyUpdate(replayed, baseState);
    Y.applyUpdate(replayed, bytes);
    const replayedTasks = replayed.getMap('ROOT').get('tasks') as Y.Map<unknown>;
    check(replayedTasks.has('t3'), 'E1：carrier 重放后目标键应存在');
    const empty = new Y.Doc();
    Y.applyUpdate(empty, bytes);
    check(empty.getMap('ROOT').size === 0, 'E1：carrier 应为最小增量（对空 doc 不物化 ROOT）');
    evidence('E1', {
      recordKeys: Object.keys(record).sort(),
      carrierKeys: Object.keys(carrier).sort(),
      payloadLength: carrier.payloadLength,
      crc32c: carrier.crc32c,
    });
  });

  await scenario('E2', 'AC5', 'Record 写与标量写的记录/carrier 键集逐键同构', async () => {
    const fx = await openFixture({ diagnostics: true });
    const log = fx.log!;
    expectOk(await fx.lease.mutateData({ op: 'set', path: ['tasks', 't3'], value: { title: 't3', qty: 3 } }), 'E2(record)');
    expectOk(await fx.lease.mutateData({ op: 'set', path: ['n'], value: 2 }), 'E2(scalar)');
    await settle(() => rootMutationRecords(log).length >= 2, 'E2：两条 root-mutation 记录未接纳');
    const [recordWrite, scalarWrite] = rootMutationRecords(log);
    check(recordWrite !== undefined && scalarWrite !== undefined, 'E2：记录不足两条');
    const recordKeys = Object.keys(recordWrite!).sort();
    const scalarKeys = Object.keys(scalarWrite!).sort();
    check(JSON.stringify(recordKeys) === JSON.stringify(scalarKeys), `E2：record 键集不同构 ${JSON.stringify({ recordKeys, scalarKeys })}`);
    const carrierKeys = Object.keys(updateCarrierOf(recordWrite!)).sort();
    const scalarCarrierKeys = Object.keys(updateCarrierOf(scalarWrite!)).sort();
    check(
      JSON.stringify(carrierKeys) === JSON.stringify(scalarCarrierKeys),
      `E2：carrier 键集不同构 ${JSON.stringify({ carrierKeys, scalarCarrierKeys })}`,
    );
    evidence('E2', { recordKeys, carrierKeys, resultKinds: [recordWrite!.result.kind, scalarWrite!.result.kind] });
  });

  // ─────────── R 组：AC6 复制烟测（对端收敛、协议面零变化）───────────

  await scenario('R1', 'AC6', 'Record fast-path 提交 → owned update → peer apply 收敛 + diff 定点 + session 状态不变', async () => {
    const hub = await openFixture({ replication: true });
    const peer = await openPeerFixture(hub);
    const baseState = stateBytes(hub.doc);
    expectOk(await hub.lease.mutateData({ op: 'set', path: ['tasks', 't3'], value: { title: 't3', qty: 3 } }), 'R1');
    await settle(() => hub.ownedUpdates.length >= 1, 'R1：owned update 未扇出');
    const update = hub.ownedUpdates[0]!;
    const plain = new Y.Doc();
    plain.clientID = 987_654;
    Y.applyUpdate(plain, baseState);
    Y.applyUpdate(plain, update);
    const plainTasks = plain.getMap('ROOT').get('tasks') as Y.Map<unknown>;
    check(plainTasks.has('t3'), 'R1：增量应用到同基态纯 Y.Doc 应含目标键');
    const applied = await peer.session!.applyRemoteUpdate(update);
    check(applied.ok, `R1：peer apply 失败 ${JSON.stringify(applied)}`);
    check(
      JSON.stringify(readAt(peer.lease, ['tasks', 't3'])) === JSON.stringify(readAt(hub.lease, ['tasks', 't3'])),
      'R1：peer 与 hub 逻辑值未收敛',
    );
    const rest = hub.session!.encodeDiff(peer.session!.encodeStateVector());
    const fixpoint = await peer.session!.applyRemoteUpdate(rest);
    check(fixpoint.ok, 'R1：diff 定点 apply 失败');
    check(
      JSON.stringify(readAt(peer.lease, ['tasks', 't3'])) === JSON.stringify({ title: 't3', qty: 3 }),
      'R1：diff 定点后逻辑值漂移',
    );
    const status = peer.session!.getStatus();
    check(status.state === 'open', `R1：session.state=${status.state}`);
    check(status.direction === 'hub-to-peer', `R1：session.direction=${status.direction}`);
    check(peer.session!.localRole === 'peer', 'R1：localRole 漂移');
    check(peer.session!.remoteInstanceId === HUB_INSTANCE_ID, 'R1：remoteInstanceId 漂移');
  });

  await scenario('R2', 'AC6', 'owned update 为最小增量形态（空 doc 不物化 ROOT）；一次提交恰一事件', async () => {
    const hub = await openFixture({ replication: true });
    const baseState = stateBytes(hub.doc);
    expectOk(await hub.lease.mutateData({ op: 'set', path: ['tasks', 't3'], value: { title: 't3', qty: 3 } }), 'R2');
    await settle(() => hub.ownedUpdates.length >= 1, 'R2：owned update 未扇出');
    const update = hub.ownedUpdates[0]!;
    const empty = new Y.Doc();
    Y.applyUpdate(empty, update);
    check(empty.getMap('ROOT').size === 0, 'R2：owned update 应为最小增量（对空 doc 不物化 ROOT）');
    const replayed = new Y.Doc();
    Y.applyUpdate(replayed, baseState);
    Y.applyUpdate(replayed, update);
    const replayedTasks = replayed.getMap('ROOT').get('tasks') as Y.Map<unknown>;
    check(replayedTasks.has('t3'), 'R2：同基态重放应含目标键');
    expectOk(await hub.lease.mutateData({ op: 'delete', path: ['tasks', 't0'] }), 'R2(第二笔)');
    await settle(() => hub.ownedUpdates.length >= 2, 'R2：第二笔 owned update 未扇出');
    check(hub.ownedUpdates.length === 2, `R2：两笔提交应恰两事件，实际 ${hub.ownedUpdates.length}`);
  });

  await scenario('R3', 'AC6', '污染在场时 Record 写经复制收敛：对端既得新值又保留污染（旧语义：连带拒绝）', async () => {
    const hub = await openFixture({ replication: true });
    await applyRawRemote(hub, (doc) => { rawMapAt(doc, ['tasks']).set('t9', 'oops'); }, 'R3(污染)');
    const peer = await openPeerFixture(hub); // 对端 bootstrap 自含污染的同基态
    const result = await hub.lease.mutateData({ op: 'set', path: ['tasks', 't3'], value: { title: 't3', qty: 3 } });
    if (BASELINE) {
      expectIssue(result, { messageIncludes: '载体错位' }, 'R3(baseline)');
      check(hub.ownedUpdates.length === 0, `R3(baseline)：拒绝应零 owned update，实际 ${hub.ownedUpdates.length}`);
      check(readAt(peer.lease, ['tasks', 't9']) === 'oops', 'R3(baseline)：对端基态污染应在场');
      return;
    }
    expectOk(result, 'R3');
    await settle(() => hub.ownedUpdates.length >= 1, 'R3：owned update 未扇出');
    const applied = await peer.session!.applyRemoteUpdate(hub.ownedUpdates[0]!);
    check(applied.ok, `R3：peer apply 失败 ${JSON.stringify(applied)}`);
    check(readAt(peer.lease, ['tasks', 't9']) === 'oops', 'R3：对端未保留污染（或污染被整 map 重写抹掉）');
    check(
      JSON.stringify(readAt(peer.lease, ['tasks', 't3'])) === JSON.stringify({ title: 't3', qty: 3 }),
      'R3：对端未收敛到新值',
    );
  });

  // ─────────── 汇总 ───────────

  log('');
  log(`SUMMARY revision=${REVISION} passed=${passed} failures=${failures.length}`);
  for (const failure of failures) log(`  FAILURE ${failure}`);
  if (failures.length > 0) process.exitCode = 1;
}

await main();
