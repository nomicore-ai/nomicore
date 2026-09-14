/**
 * issue #390（ADR 0030 T4「溢出降级与父路径删除」）契约共享 fixture ——
 * `issue-390-watch-invalidation-red.test.ts`（行为契约）与
 * `issue-390-watch-invalidation-surface.test-d.ts`（类型契约）共用；非测试文件，
 * vitest 不收集（`*.test.ts` 采集通配不命中本文件名）。
 *
 * 自包含（不 import #387 fixture——避免触碰冻结契约支撑文件 `issue-387-*`）：
 * - registry 面 = `createNamespaceRegistryForTesting` + 返回固定 DocHandle 的
 *   StubPersistence（确定性随机源 / manual clock / 受控 scheduler）；
 * - **缺省生产 runtimeFactory 通路**（SA8 §8-1 点名的装配点）：本 fixture **不**提供
 *   `runtimeFactory` 覆盖——`watchQueueCapacity` 必须经 testing overrides 加法字段
 *   → internal 装配缝 → `createWatchHub` 第三参真达（AC5：零新接缝，注入只经既有
 *   testing 工厂 overrides）；
 * - schema 按 SA6 契约 §12.3：`tasks` 必填（非法删负控）/ `optionalTasks?`（已物化，
 *   父路径删除正例载体）/ `optionalGroups?` 两级嵌套（祖先删除正例）/
 *   `meta` 封闭对象（无关路径负控）。
 *
 * 绑定单点（SA6 §12.1 B-1）：`watchQueueCapacityOverride` 是容量注入字段的唯一
 * 绑定位置——字段名/形态若另裁，只改本函数（类型契约绑定块同步）。
 */
import * as Y from 'yjs';
import { expect } from 'vitest';
import type { DocHandle, DocPersistence, User } from '@nomicore/persistence';
import type { NamespaceLease } from '@nomicore/namespace-registry';
import {
  createNamespaceRegistryForTesting,
  createRegistryTestScheduler,
} from '@nomicore/namespace-registry/testing';

// ───────────────────────── 契约常量 ─────────────────────────

export const WATCH_DOC_ID = 'ns-390';
export const WATCH_OWNER: User = { userId: 'u-390' };

/** B-1 注入值（契约触发用最小上界：capacity=1 + 同同步段两次写必溢出）。 */
export const WATCH_QUEUE_CAPACITY_INJECTED = 1;

/**
 * B-1 承重绑定单点：testing overrides 容量注入字段。
 * 缺省不调用 = 不注入（runtime 实现默认容量，数值不进公共契约）。
 */
export function watchQueueCapacityOverride(capacity: number): { readonly watchQueueCapacity: number } {
  return { watchQueueCapacity: capacity };
}

/**
 * schema（SA6 §12.3）：
 * - `tasks`：必填任务表（`delete ['tasks']` = 写面拒绝负控 NC4）；
 * - `optionalTasks?`：可选任务表（合法删除 = 父路径删除正例 A3/A3b/A5/A6）；
 * - `optionalGroups?`：两级嵌套（内层订阅 + 外层删除 = 祖先删除正例 A4）；
 * - `meta`：无关路径负控（NC3）与同事务无关写（A3b）。
 */
export const WATCH_SCHEMA_TEXT = `
type Task = YMap<{
  /** 任务标题 */
  title: YLeaf<string>;
  /** 优先级 */
  priority: YLeaf<number>;
}>;
type ROOT = YMap<{
  /** 任务表（必填——非法删负控） */
  tasks: Record<string, Task>;
  /** 可选任务表（合法删除 = 父路径删除正例；已物化 e1/e2） */
  optionalTasks?: Record<string, Task>;
  /** 两级嵌套：内层订阅 + 外层删除（祖先删除正例） */
  optionalGroups?: Record<string, Record<string, Task>>;
  /** 无关路径负控 */
  meta: YMap<{
    /** 备注内容 */
    content: YLeaf<string>;
  }>;
}>;
`.trim();

// ───────────────────────── 载体构造 ─────────────────────────

function taskEntry(title: string, priority: number): Y.Map<unknown> {
  const entry = new Y.Map<unknown>();
  entry.set('title', title);
  entry.set('priority', priority);
  return entry;
}

/** 构建 #390 契约文档（仅内存；不装载持久化）。 */
export function buildWatchDoc(): Y.Doc {
  const doc = new Y.Doc();
  const sc = doc.getMap('SCHEMA');
  sc.set('lang', 'vfsl');
  sc.set('version', 1);
  sc.set('id', WATCH_DOC_ID);
  sc.set('text', WATCH_SCHEMA_TEXT);
  const meta = doc.getMap('META');
  meta.set('docId', WATCH_DOC_ID);
  meta.set('createdAt', 1_700_000_000_000);

  const root = doc.getMap('ROOT');
  const tasks = new Y.Map<unknown>();
  tasks.set('t1', taskEntry('alpha', 2));
  tasks.set('t2', taskEntry('beta', 9));
  root.set('tasks', tasks);

  const optionalTasks = new Y.Map<unknown>();
  optionalTasks.set('e1', taskEntry('first', 1));
  optionalTasks.set('e2', taskEntry('second', 2));
  root.set('optionalTasks', optionalTasks);

  const optionalGroups = new Y.Map<unknown>();
  const og1 = new Y.Map<unknown>();
  og1.set('g1', taskEntry('nested', 1));
  optionalGroups.set('og1', og1);
  root.set('optionalGroups', optionalGroups);

  const closed = new Y.Map<unknown>();
  closed.set('content', 'initial');
  root.set('meta', closed);
  return doc;
}

// ───────────────────────── registry 装配（缺省 factory 通路） ─────────────────────────

class WatchStubHandle implements DocHandle {
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

class WatchStubPersistence implements DocPersistence {
  constructor(private readonly handle: DocHandle) {}

  async createDoc(): Promise<DocHandle> {
    return this.handle;
  }

  async loadDoc(): Promise<DocHandle | null> {
    return this.handle;
  }

  async saveDoc(): Promise<void> {}
}

let randomCounter = 0;
function deterministicRandomBytes(length: number): Uint8Array {
  randomCounter += 1;
  const hex = randomCounter.toString(32).padStart(32, '0');
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    out[i] = Number.parseInt(hex.slice((i % 16) * 2, (i % 16) * 2 + 2), 16);
  }
  return out;
}

export interface WatchFixture {
  readonly lease: NamespaceLease;
  readonly registry: ReturnType<typeof createNamespaceRegistryForTesting>;
  readonly doc: Y.Doc;
  readonly handle: DocHandle;
}

export interface OpenWatchLeaseOptions {
  /** B-1：>0 时经 testing overrides 注入容量（缺省 = 不注入，runtime 实现默认）。 */
  readonly watchQueueCapacity?: number;
}

/** 等待 schema 结算（ready——fixture 前提失败在断言前显式暴露）。 */
async function waitForSchemaReady(lease: NamespaceLease): Promise<void> {
  await expect
    .poll(
      () => {
        const status = lease.getStatus();
        return status.lease === 'active' ? status.runtime.schema.state : 'released';
      },
      { interval: 10, timeout: 5_000 },
    )
    .not.toBe('preparing');
}

/**
 * 经真实 Registry 装配打开 lease（**缺省生产 runtimeFactory 通路**——不提供
 * `runtimeFactory` 覆盖，容量必须经 testing overrides 加法字段真达 watch hub）。
 */
export async function openWatchLease(options: OpenWatchLeaseOptions = {}): Promise<WatchFixture> {
  const doc = buildWatchDoc();
  const handle = new WatchStubHandle(WATCH_OWNER, WATCH_DOC_ID, doc);
  const registry = createNamespaceRegistryForTesting(new WatchStubPersistence(handle), {
    clock: { now: () => 1_700_000_123_456 },
    scheduler: createRegistryTestScheduler(),
    randomBytes: deterministicRandomBytes,
    ...(options.watchQueueCapacity !== undefined
      ? watchQueueCapacityOverride(options.watchQueueCapacity)
      : {}),
  });
  const opened = await registry.open({ userId: WATCH_OWNER.userId }, WATCH_DOC_ID);
  expect(opened.ok, `契约前提失败：registry.open 应成功（${JSON.stringify(opened)}）`).toBe(true);
  if (!opened.ok) throw new Error('unreachable: registry.open 失败');
  const fixture: WatchFixture = { lease: opened.lease, registry, doc, handle };
  await waitForSchemaReady(opened.lease);
  return fixture;
}

// ───────────────────────── 订阅面与写助手 ─────────────────────────

export type WatchListener = Parameters<NamespaceLease['watchMap']>[1];
export type WatchHandle = ReturnType<NamespaceLease['watchMap']>;

/** 建立订阅（lease 公共面；fixture 前提失败即显式抛错）。 */
export function establishWatch(
  lease: NamespaceLease,
  path: readonly (string | number)[],
  listener: WatchListener,
): WatchHandle {
  const handle = lease.watchMap(path, listener);
  expect(typeof handle.unsubscribe, `契约前提失败：watchMap(${JSON.stringify(path)}) 未建立`).toBe(
    'function',
  );
  return handle;
}

type Mutation = Parameters<NamespaceLease['mutateData']>[0];

/**
 * 同订阅后续合法写 + 等到其 data（零通知断言的确定性屏障；SA6 §12.5-4：禁止只
 * sleep）——同时构成「订阅存活」证据（同一订阅在后续事务照常交付）。
 */
export async function writeAndAwaitData(
  lease: NamespaceLease,
  sink: NotificationSink,
  mutation: Mutation,
  expectedKey: string,
): Promise<WatchDataNotification> {
  const result = await lease.mutateData(mutation);
  expect(result.ok, `契约前提失败：后续写应被受理（${JSON.stringify(result)}）`).toBe(true);
  return sink.waitForDataKey(expectedKey);
}

// ───────────────────────── 通知收集 ─────────────────────────

export interface WatchChangeLocator {
  readonly path: readonly (string | number)[];
  readonly key: string;
}

export interface WatchDataNotification {
  readonly kind: 'data';
  readonly origin: string;
  readonly changes: ReadonlyArray<WatchChangeLocator>;
}

export interface WatchInvalidateAllNotification {
  readonly kind: 'invalidate-all';
  readonly origin: string;
}

/** 通知收集器：listener 直接挂到订阅；等待均经 `expect.poll`（零墙钟竞猜）。 */
export class NotificationSink {
  readonly received: unknown[] = [];

  readonly listener: WatchListener = (notification): void => {
    this.received.push(notification);
  };

  kinds(): string[] {
    return this.received.map((notification) => String((notification as { kind?: unknown }).kind));
  }

  dataNotifications(): WatchDataNotification[] {
    return this.received.filter(
      (notification): notification is WatchDataNotification =>
        typeof notification === 'object'
        && notification !== null
        && (notification as { kind?: unknown }).kind === 'data',
    );
  }

  invalidateAllNotifications(): WatchInvalidateAllNotification[] {
    return this.received.filter(
      (notification): notification is WatchInvalidateAllNotification =>
        typeof notification === 'object'
        && notification !== null
        && (notification as { kind?: unknown }).kind === 'invalidate-all',
    );
  }

  /** 指定条目 key 的 data 通知（定位符列表中含该 key）。 */
  dataFor(key: string): WatchDataNotification[] {
    return this.dataNotifications().filter((notification) =>
      notification.changes.some((change) => change.key === key),
    );
  }

  async waitForCount(count: number, timeoutMs = 2_000): Promise<void> {
    await expect
      .poll(() => this.received.length, { interval: 5, timeout: timeoutMs })
      .toBeGreaterThanOrEqual(count);
  }

  async waitForInvalidateAll(timeoutMs = 2_000): Promise<WatchInvalidateAllNotification> {
    await expect
      .poll(() => this.invalidateAllNotifications().length, { interval: 5, timeout: timeoutMs })
      .toBeGreaterThanOrEqual(1);
    const found = this.invalidateAllNotifications()[0];
    if (found === undefined) throw new Error('unreachable: waitForInvalidateAll');
    return found;
  }

  async waitForDataKey(key: string, timeoutMs = 2_000): Promise<WatchDataNotification> {
    await expect
      .poll(() => this.dataFor(key).length, { interval: 5, timeout: timeoutMs })
      .toBeGreaterThanOrEqual(1);
    const found = this.dataFor(key)[0];
    if (found === undefined) throw new Error('unreachable: waitForDataKey');
    return found;
  }
}
