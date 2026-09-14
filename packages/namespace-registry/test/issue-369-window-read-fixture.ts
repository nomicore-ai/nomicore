/**
 * issue #369（ADR 0028 W2）窗口读契约共享 fixture —— lease 面与组合层面两套契约测试
 * 共用（非测试文件，vitest 不收集；设计 §11 ALLOW：`issue-369-window-read-fixture.ts`）。
 *
 * 构造形态沿既有先例：
 * - 文档装载 = `createMemoryPersistence` + `createNamespaceRuntimeWithSeam`（镜像
 *   `runtime-readdata-shape-budget-fixture.ts`）；
 * - registry 面 = `createNamespaceRegistryForTesting` + 返回**同一** DocHandle 的
 *   StubPersistence（镜像 `registry-readdata-projection-text-red.test.ts`——同一 doc
 *   引用是 F1「与直调 W1 结果 toStrictEqual」对比锚的前提）。
 *
 * 数据设计（SA6 §12.3 最小 fixture，断言全部可判定）：
 * - `workRecords`（Y.Array<number> = [30, 10, 20]）：数组面基×方向与组合等价锚；
 * - `tasks`（Y.Map，t1/t2/t3，priority 2/9/5）：Record 键空间元素口径 + field 基；
 * - `assets`（Y.Map，a1/b2）：Record + keyPattern 元素口径；
 * - `emptyAssets` / `emptyTasks` / `emptyTags`：空容器（数据无关性锚）；
 * - `meta`（Y.Map，content/extra）：封闭对象形 —— `[...path,'<key>']` 锚不可解析的
 *   承重反证（B-6 容器口径回退）；
 * - `taskList`（Y.Array，两个 Y.Map 任务）：元素口径 depth 截断标记锚（`Task‡`）；
 * - `poison` 变体：`workRecords` = [30, 10, NaN ×1998] —— 零物化哨兵（E3）与入选毒项
 *   fail-fast（E4）；
 * - `probe` 变体（raw 数据，ROOT 容器级）：计数镜像边界矩阵的载体样本（Y.Map 显式
 *   undefined 值键 / plain object 的 accessor 与 non-enumerable 键 / 稀疏 plain 数组 /
 *   空载体 / ROOT 面）。
 */
import * as Y from 'yjs';
import { expect } from 'vitest';
import { createMemoryPersistence } from '@nomicore/persistence';
import type { DocHandle, DocPersistence, User } from '@nomicore/persistence';
import type { NamespaceRuntime } from '@nomicore/namespace-runtime';
import type { NamespaceLease } from '@nomicore/namespace-registry';
import {
  createNamespaceRegistryForTesting,
  createRegistryTestScheduler,
} from '@nomicore/namespace-registry/testing';
import { realPersistenceScheduler } from '../../namespace-runtime/test/real-persistence-scheduler.js';
import { createNamespaceRuntimeWithSeam } from '../../namespace-runtime/src/runtime.js';

/** 窗口读契约 schema（SA6 §12.3 逐字；docs 覆盖 Task 字段口径与 Asset 字段口径）。 */
export const TXT_369 = `
type AssetId = string & Pattern<"^[A-Za-z0-9_\\\\-]{1,64}$">;
type Task = YMap<{
  /** 任务标题 */
  title: YLeaf<string>;
  /** 优先级（数值越大越优先） */
  priority: YLeaf<number>;
}>;
type Asset = YMap<{
  /** 资源名 */
  name: YLeaf<string>;
}>;
type ROOT = YMap<{
  /** 工作记录（append 日志） */
  workRecords: YLeaf<number>[];
  /** 任务表（Record 键空间） */
  tasks: Record<string, Task>;
  /** 资源索引（Record + keyPattern） */
  assets: Record<AssetId, Asset>;
  /** 空 Record */
  emptyAssets: Record<string, Asset>;
  /** 封闭对象 map */
  meta: YMap<{
    /** 备注内容 */
    content: YLeaf<string>;
    /** 附加计数 */
    extra: YLeaf<number>;
  }>;
  /** 任务数组 */
  taskList: Task[];
  /** 空任务数组 */
  emptyTasks: Task[];
  /** 空标量数组 */
  emptyTags: YLeaf<string>[];
}>;
`.trim();

export const WINDOW_DOC_ID = 'ns-369';
export const WINDOW_OWNER: User = { userId: 'u-369' };

/** 任务子项（Y.Map：title/priority）。 */
function task(title: string, priority: number): Y.Map<unknown> {
  const m = new Y.Map<unknown>();
  m.set('title', title);
  m.set('priority', priority);
  return m;
}

/** schema 声明字段的 ROOT 数据（两载体族：Yjs 载体与原生 plain 值）。 */
export function seedWindowRoot(root: Y.Map<unknown>): void {
  const workRecords = new Y.Array<number>();
  workRecords.push([30, 10, 20]);
  root.set('workRecords', workRecords);

  const tasks = new Y.Map<unknown>();
  tasks.set('t1', task('alpha', 2));
  tasks.set('t2', task('beta', 9));
  tasks.set('t3', task('gamma', 5));
  root.set('tasks', tasks);

  const assets = new Y.Map<unknown>();
  const a1 = new Y.Map<unknown>();
  a1.set('name', 'one');
  const b2 = new Y.Map<unknown>();
  b2.set('name', 'two');
  assets.set('a1', a1);
  assets.set('b2', b2);
  root.set('assets', assets);

  root.set('emptyAssets', new Y.Map<unknown>());

  const meta = new Y.Map<unknown>();
  meta.set('content', 'hi');
  meta.set('extra', 7);
  root.set('meta', meta);

  const taskList = new Y.Array<unknown>();
  taskList.push([task('alpha', 2), task('beta', 9)]);
  root.set('taskList', taskList);

  root.set('emptyTasks', new Y.Array<unknown>());
  root.set('emptyTags', new Y.Array<unknown>());
}

/**
 * 计数镜像边界矩阵的 raw 数据（ROOT 容器级 —— 路径偏离 schema，schema 面为 null；
 * 计数断言只消费 `total` / `truncated` / `value`）。
 */
export function seedWindowProbe(root: Y.Map<unknown>): void {
  const holder = new Y.Map<unknown>();

  // Y.Map：显式 undefined 值键（k2）出条目空间（#368 R3/P4 对账）。
  const ym = new Y.Map<unknown>();
  ym.set('k1', 1);
  ym.set('k2', undefined);
  ym.set('k3', 'x');
  holder.set('ym', ym);

  // plain object：own-enumerable data 键且值非 undefined（b 出空间）。
  holder.set('po', { a: 1, b: undefined, c: 3 });

  // plain object：accessor 键（acc，零执行）与 non-enumerable 键（hidden）出空间。
  const hostile: Record<string, unknown> = { plain: 1 };
  Object.defineProperty(hostile, 'hidden', { value: 2, enumerable: false });
  Object.defineProperty(hostile, 'acc', { get: () => 3, enumerable: true });
  holder.set('hostile', hostile);

  // 稀疏 plain 数组：空洞计入候选空间（length 口径），但入选即 fail-fast。
  const sparse: unknown[] = ['z'];
  sparse[3] = 'y';
  holder.set('sparse', sparse);

  holder.set('emptyPlain', {});
  holder.set('emptyMap', new Y.Map<unknown>());

  root.set('probe', holder);
}

export interface WindowDocOptions {
  /** `workRecords` 毒值变体：`[30, 10, NaN ×1998]`（E3 哨兵 / E4 入选毒项）。 */
  readonly poison?: boolean;
  /** raw 计数矩阵数据（`ROOT.probe`）；缺省在场（`false` 可关——schema 面不受影响）。 */
  readonly probe?: boolean;
  /** schema 键是否写入（缺省 true；false = 无 active schema 通道）。 */
  readonly seedSchema?: boolean;
}

/** 构建窗口读契约文档（不装载持久化）。 */
export function buildWindowDoc(options: WindowDocOptions = {}): Y.Doc {
  const doc = new Y.Doc();
  if (options.seedSchema !== false) {
    const sc = doc.getMap('SCHEMA');
    sc.set('lang', 'vfsl');
    sc.set('version', 1);
    sc.set('id', WINDOW_DOC_ID);
    sc.set('text', TXT_369);
  }
  const meta = doc.getMap('META');
  meta.set('docId', WINDOW_DOC_ID);
  meta.set('createdAt', 1_700_000_000_000);
  const root = doc.getMap('ROOT');
  seedWindowRoot(root);
  if (options.probe !== false) seedWindowProbe(root);
  if (options.poison === true) {
    const poison = new Y.Array<number>();
    const values: number[] = [30, 10];
    for (let i = 2; i < 2000; i += 1) values.push(Number.NaN);
    poison.push(values);
    root.set('workRecords', poison);
  }
  return doc;
}

/** 经 MemoryPersistence 构造带 SCHEMA/ROOT 的 DocHandle + 同一 doc 引用。 */
export async function makeWindowHandle(
  options: WindowDocOptions = {},
): Promise<{ readonly handle: DocHandle; readonly doc: Y.Doc }> {
  const doc = buildWindowDoc(options);
  const persistence = createMemoryPersistence({ scheduler: realPersistenceScheduler });
  const handle = await persistence.createDoc(WINDOW_OWNER, WINDOW_DOC_ID, doc);
  return { handle, doc };
}

/** 以既有 handle 构造 runtime（seam 通道；registry runtimeFactory 复用同一入口）。 */
export function createWindowRuntimeFromHandle(handle: DocHandle): NamespaceRuntime {
  return createNamespaceRuntimeWithSeam({ handle });
}

/** 构造 runtime 并等待 P0 结算到 schema ready。 */
export async function makeWindowRuntime(
  options: WindowDocOptions = {},
): Promise<{ readonly runtime: NamespaceRuntime; readonly doc: Y.Doc; readonly handle: DocHandle }> {
  const { handle, doc } = await makeWindowHandle(options);
  const runtime = createWindowRuntimeFromHandle(handle);
  await waitForRuntimeSchemaReady(runtime);
  return { runtime, doc, handle };
}

/** 等待 runtime schemaState 到 ready（沿既有 fixture 的 poll 纪律）。 */
export async function waitForRuntimeSchemaReady(runtime: NamespaceRuntime): Promise<void> {
  await expect
    .poll(() => runtime.getStatus().schema.state, { interval: 10, timeout: 5_000 })
    .toBe('ready');
}

/** 返回同一预建 handle 的 StubPersistence（稳定 doc 引用 = 直调 W1 对比锚的前提）。 */
class WindowStubPersistence implements DocPersistence {
  constructor(private readonly handle: DocHandle) {}

  async createDoc(): Promise<DocHandle> {
    return this.handle;
  }

  async loadDoc(): Promise<DocHandle | null> {
    return this.handle;
  }

  async saveDoc(): Promise<void> {}
}

/** 确定性 DocHandle 投影（getStatus ready；release 恒 resolve）。 */
class WindowStubHandle implements DocHandle {
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

function manualClock(): { now: () => number } {
  return { now: () => 1_700_000_123_456 };
}

let randomCounter = 0;
function deterministicRandomBytes(length: number): Uint8Array {
  randomCounter += 1;
  const hex = randomCounter.toString(16).padStart(32, '0');
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    out[i] = Number.parseInt(hex.slice((i % 16) * 2, (i % 16) * 2 + 2), 16);
  }
  return out;
}

export interface WindowLeaseOptions extends WindowDocOptions {
  /** 可选 runtimeFactory（缺省 = Registry 生产装配路径）。 */
  readonly runtimeFactory?: (handle: DocHandle, notifyDirty: () => Promise<void>) => NamespaceRuntime;
}

export interface WindowLeaseFixture {
  readonly lease: NamespaceLease;
  readonly doc: Y.Doc;
  readonly handle: DocHandle;
  readonly registry: ReturnType<typeof createNamespaceRegistryForTesting>;
}

/** 经真实 Registry 装配打开 lease（默认生产 runtimeFactory；可选替换）。 */
export async function makeWindowLease(options: WindowLeaseOptions = {}): Promise<WindowLeaseFixture> {
  const doc = buildWindowDoc(options);
  const handle = new WindowStubHandle(WINDOW_OWNER, WINDOW_DOC_ID, doc);
  const registry = createNamespaceRegistryForTesting(new WindowStubPersistence(handle), {
    clock: manualClock(),
    scheduler: createRegistryTestScheduler(),
    randomBytes: deterministicRandomBytes,
    ...(options.runtimeFactory !== undefined ? { runtimeFactory: options.runtimeFactory } : {}),
  });
  const opened = await registry.open({ userId: WINDOW_OWNER.userId }, WINDOW_DOC_ID);
  expect(opened.ok, `契约前提失败：registry.open 应成功（${JSON.stringify(opened)}）`).toBe(true);
  if (!opened.ok) throw new Error('unreachable');
  const lease = opened.lease;
  await expect
    .poll(
      () => {
        const status = lease.getStatus();
        return status.lease === 'active' ? status.runtime.schema.state : 'released';
      },
      { interval: 10, timeout: 5_000 },
    )
    .toBe('ready');
  return { lease, doc, handle, registry };
}
