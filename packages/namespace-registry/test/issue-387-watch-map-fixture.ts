/**
 * issue #387（ADR 0030 T1「变更订阅 tracer bullet」）契约共享 fixture ——
 * 行为红灯契约（`issue-387-watch-map-tracer-red.test.ts`）与 lease 类型面契约
 * （`issue-387-watch-map-lease-surface.test-d.ts`）共用；非测试文件，vitest 不收集。
 *
 * 构造形态沿 issue #369 窗口读 lease 契约家族先例：
 * - registry 面 = `createNamespaceRegistryForTesting` + 返回固定 DocHandle 的
 *   StubPersistence（确定性随机源 / manual clock / 受控 scheduler）；
 * - runtimeFactory 保留 runtime 引用（垂直通路「lease → runtime 分发」证据锚）；
 * - schema ready 以 poll 等待（fixture 前提失败在断言前显式暴露）。
 *
 * 绑定冻结（SA6 报告 §12.1；SA1 必裁项）：
 * - **B-2（承重）**：订阅回调为位置参数 —— `watchMap(path, listener, options?)`
 *   → `{ unsubscribe }`。依据：ADR 0030 §6「回调 throw 静默隔离」+ spec #385 US20
 *   「订阅回调的异常被静默隔离」+ 本仓 `subscribeOwnedUpdates(listener)` 先例。
 *   ADR/CONTEXT/issue 的 `watchMap(path, { where? })` 简写未写回调位。若 SA1 冻结
 *   其它绑定（如 `(path, { onNotification })`），改 **本文件 `WATCH_MAP_BINDING` 单点**
 *   与类型契约签名块，行为断言不变。
 * - **B-3（面自由度）**：建立失败的**面**（同步 throw 携带 `code` / 失败信封
 *   `{ok:false, code}`）未由 ADR 冻结；`attemptEstablishWatch` 做面中性归一（响亮
 *   拒绝 + 稳定 `code` + message 是承重断言，面本身不是）。
 * - **B-4**：无 active schema 的稳定码未由 ADR/issue 命名（只有载体码逐字）——
 *   契约断「响亮拒绝 + 非空稳定 code」，码字交 SA1 冻结。
 */
import * as Y from 'yjs';
import { expect } from 'vitest';
import type { DocHandle, DocPersistence, User } from '@nomicore/persistence';
import type { NamespaceRuntime } from '@nomicore/namespace-runtime';
import type { NamespaceLease } from '@nomicore/namespace-registry';
import {
  createNamespaceRegistryForTesting,
  createRegistryTestScheduler,
} from '@nomicore/namespace-registry/testing';
import { createNamespaceRuntimeWithSeam } from '../../namespace-runtime/src/runtime.js';

// ───────────────────────── 契约常量 ─────────────────────────

export const WATCH_DOC_ID = 'ns-387';
export const WATCH_OWNER: User = { userId: 'u-387' };

/**
 * tracer fixture schema（SA6 报告 §12.3）：
 * - `tasks`：Record 键空间（Y.Map 载体，物化 t1/t2）——主正例；
 * - `ghost?`：schema 已声明但未物化——「数据缺席合法」正例（可选形态：缺席即合法
 *   快照；既有可选容器先例 = #387 探针 B `optional.delete` 通道）；
 * - `optionalTasks?`：可选容器——「已删除同样建立」正例（可合法 delete）；
 * - `workRecords`：数组载体——`WATCH_MAP_CARRIER_MISMATCH` 正例（ADR 0030 §3）；
 * - `title`：根标量——非容器正例；
 * - `meta`：封闭对象 Y.Map——键容器（与 readMap 定义对齐）正例。
 */
export const WATCH_SCHEMA_TEXT = `
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

// ───────────────────────── 载体构造 ─────────────────────────

function taskEntry(title: string, priority: number): Y.Map<unknown> {
  const entry = new Y.Map<unknown>();
  entry.set('title', title);
  entry.set('priority', priority);
  return entry;
}

export interface WatchDocOptions {
  /** schema 文本；`null` = 无 SCHEMA 载体（legacy：无 active schema 通道）。 */
  readonly schemaText?: string | null;
  /** `tasks` 以 plain object 物化（plain object 容器正例；缺省 Y.Map 载体）。 */
  readonly plainTasksCarrier?: boolean;
  /** `tasks` 是否物化（缺省 true；false 用于纯缺席场景）。 */
  readonly seedTasks?: boolean;
  /** `optionalTasks` 是否物化（缺省 false）。 */
  readonly seedOptionalTasks?: boolean;
}

/** 构建 tracer 契约文档（仅内存；不装载持久化）。 */
export function buildWatchDoc(options: WatchDocOptions = {}): Y.Doc {
  const doc = new Y.Doc();
  if (options.schemaText !== null) {
    const sc = doc.getMap('SCHEMA');
    sc.set('lang', 'vfsl');
    sc.set('version', 1);
    sc.set('id', WATCH_DOC_ID);
    sc.set('text', options.schemaText ?? WATCH_SCHEMA_TEXT);
  }
  const meta = doc.getMap('META');
  meta.set('docId', WATCH_DOC_ID);
  meta.set('createdAt', 1_700_000_000_000);

  const root = doc.getMap('ROOT');
  if (options.seedTasks !== false) {
    if (options.plainTasksCarrier === true) {
      root.set('tasks', { t1: { title: 'alpha', priority: 2 } });
    } else {
      const tasks = new Y.Map<unknown>();
      tasks.set('t1', taskEntry('alpha', 2));
      tasks.set('t2', taskEntry('beta', 9));
      root.set('tasks', tasks);
    }
  }
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

// ───────────────────────── registry 装配 ─────────────────────────

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
  readonly runtime: NamespaceRuntime;
  readonly doc: Y.Doc;
  readonly handle: DocHandle;
  readonly registry: ReturnType<typeof createNamespaceRegistryForTesting>;
  /** runtimeFactory 观察到的 notifyDirty（脏通知）调用数（仅诊断锚，非契约断言面）。 */
  readonly notifyDirtyCalls: { count: number };
}

/** 等待 schema 结算（ready 或 unavailable——legacy 通道停在 unavailable）。 */
async function waitForSchemaSettled(lease: NamespaceLease): Promise<void> {
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

/** 经真实 Registry 装配打开 lease（runtimeFactory 包装以保留 runtime 引用）。 */
export async function openWatchLease(
  options: WatchDocOptions = {},
): Promise<WatchFixture> {
  const doc = buildWatchDoc(options);
  const handle = new WatchStubHandle(WATCH_OWNER, WATCH_DOC_ID, doc);
  const notifyDirtyCalls = { count: 0 };
  let runtimeRef: NamespaceRuntime | undefined;
  const registry = createNamespaceRegistryForTesting(new WatchStubPersistence(handle), {
    clock: { now: () => 1_700_000_123_456 },
    scheduler: createRegistryTestScheduler(),
    randomBytes: deterministicRandomBytes,
    runtimeFactory: (h: DocHandle, notifyDirty: () => Promise<void>) => {
      const runtime = createNamespaceRuntimeWithSeam({
        handle: h,
        notifyDirty: async () => {
          notifyDirtyCalls.count += 1;
          await notifyDirty();
        },
      });
      runtimeRef = runtime;
      return runtime;
    },
  });
  const opened = await registry.open({ userId: WATCH_OWNER.userId }, WATCH_DOC_ID);
  expect(opened.ok, `契约前提失败：registry.open 应成功（${JSON.stringify(opened)}）`).toBe(true);
  if (!opened.ok) throw new Error('unreachable: registry.open 失败');
  if (runtimeRef === undefined) throw new Error('契约前提失败：runtimeFactory 未被调用');
  const fixture = { lease: opened.lease, runtime: runtimeRef, doc, handle, registry, notifyDirtyCalls };
  await waitForSchemaSettled(opened.lease);
  return fixture;
}

/** 同 namespace 第二 lease（lease 释放自动清理测试的写方；先例 = 探针 D 双 lease）。 */
export async function openSecondLease(fixture: WatchFixture): Promise<NamespaceLease> {
  const opened = await fixture.registry.open({ userId: WATCH_OWNER.userId }, WATCH_DOC_ID);
  expect(opened.ok, `契约前提失败：第二 lease open 应成功（${JSON.stringify(opened)}）`).toBe(true);
  if (!opened.ok) throw new Error('unreachable: 第二 lease open 失败');
  await expect
    .poll(
      () => {
        const status = opened.lease.getStatus();
        return status.lease === 'active' ? status.runtime.schema.state : 'released';
      },
      { interval: 10, timeout: 5_000 },
    )
    .not.toBe('preparing');
  return opened.lease;
}

// ───────────────────────── 订阅面适配（绑定单点） ─────────────────────────

export interface WatchHandleLike {
  readonly unsubscribe: () => void;
}

export type WatchListener = (notification: unknown) => void;

/**
 * 冻结绑定 B-2（单点）：`watchMap(path, listener, options?)`。
 * 类型面在 HEAD 不存在 → 契约测试经显式结构断言调用（行为验证不依赖类型系统；
 * 类型契约由 `*.test-d.ts` 承担）。
 */
function watchMapOf(
  lease: NamespaceLease,
): (path: readonly (string | number)[], listener: WatchListener, options?: unknown) => unknown {
  return (lease as unknown as {
    watchMap: (path: readonly (string | number)[], listener: WatchListener, options?: unknown) => unknown;
  }).watchMap;
}

/**
 * 建立结果（面中性归一；B-3）：
 * - 成功 = 返回 handle（`unsubscribe` 为 function）；
 * - 失败 = 同步 throw 携带 string `code`，或返回失败信封 `{ok:false, code}`。
 */
export type EstablishOutcome =
  | { readonly ok: true; readonly handle: WatchHandleLike }
  | { readonly ok: false; readonly code: string; readonly message: string };

function normalizeFailure(value: unknown): EstablishOutcome | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as { ok?: unknown; code?: unknown; message?: unknown };
  if (record.ok !== false || typeof record.code !== 'string') return undefined;
  return {
    ok: false,
    code: record.code,
    message: typeof record.message === 'string' ? record.message : '',
  };
}

/** 尝试建立订阅（面中性）。 */
export function attemptEstablishWatch(
  lease: NamespaceLease,
  path: readonly (string | number)[],
  listener: WatchListener,
): EstablishOutcome {
  const watchMap = watchMapOf(lease);
  if (typeof watchMap !== 'function') {
    return {
      ok: false,
      code: 'WATCH_MAP_MISSING',
      message:
        'lease.watchMap is not a function（ADR 0030 §1 能力缺席——HEAD 15 键 lease 面零订阅方法）',
    };
  }
  let returned: unknown;
  try {
    returned = watchMap(path, listener);
  } catch (error) {
    const record = error as { code?: unknown; message?: unknown };
    return {
      ok: false,
      code: typeof record?.code === 'string' ? record.code : '',
      message: typeof record?.message === 'string' ? record.message : String(error),
    };
  }
  const failure = normalizeFailure(returned);
  if (failure !== undefined) return failure;
  if (typeof returned === 'object' && returned !== null && typeof (returned as WatchHandleLike).unsubscribe === 'function') {
    return { ok: true, handle: returned as WatchHandleLike };
  }
  return {
    ok: false,
    code: '',
    message: `watchMap 未返回 handle（unsubscribe 缺席）：${String(returned)}`,
  };
}

/** 建立订阅（成功面必需；失败以断言信息暴露）。 */
export function establishWatch(
  lease: NamespaceLease,
  path: readonly (string | number)[],
  listener: WatchListener,
): WatchHandleLike {
  const outcome = attemptEstablishWatch(lease, path, listener);
  if (!outcome.ok) {
    throw new Error(
      `契约前提失败/能力缺口：watchMap(${JSON.stringify(path)}) 未建立（ADR 0030 §1/§3：键容器 + 数据缺席合法）` +
        `——code=${JSON.stringify(outcome.code)} message=${JSON.stringify(outcome.message)}`,
    );
  }
  return outcome.handle;
}

// ───────────────────────── 通知收集 ─────────────────────────

/** 通知收集器：listener 直接挂到订阅；`waitForCount` 为异步分发提供确定性等待。 */
export class NotificationSink {
  readonly received: unknown[] = [];

  readonly listener: WatchListener = (notification: unknown): void => {
    this.received.push(notification);
  };

  async waitForCount(count: number, timeoutMs = 2_000): Promise<void> {
    await expect
      .poll(() => this.received.length, { interval: 5, timeout: timeoutMs })
      .toBeGreaterThanOrEqual(count);
  }

  /** 收集到的 data 通知（形状未窄化，断言在测试内逐字段进行）。 */
  dataNotifications(): Array<{
    readonly kind: string;
    readonly origin: string;
    readonly changes: ReadonlyArray<{ readonly path: readonly (string | number)[]; readonly key: string }>;
  }> {
    return this.received.filter(
      (n): n is {
        kind: string;
        origin: string;
        changes: ReadonlyArray<{ path: readonly (string | number)[]; key: string }>;
      } => typeof n === 'object' && n !== null && (n as { kind?: unknown }).kind === 'data',
    );
  }
}
