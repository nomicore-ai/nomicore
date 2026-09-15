/**
 * issue #388（ADR 0030 T2「谓词订阅与宁多勿漏判定」）契约共享 fixture ——
 * 行为红灯契约（`issue-388-watch-map-predicate-red.test.ts`）与类型面契约
 * （`issue-388-watch-map-predicate-surface.test-d.ts`）共用；非测试文件，vitest 不收集。
 *
 * 构造形态沿 issue #387 T1 fixture（`issue-387-watch-map-fixture.ts`，DENY：零改动）：
 * - registry 面 = `createNamespaceRegistryForTesting` + 返回固定 DocHandle 的
 *   StubPersistence（确定性随机源 / manual clock / 受控 scheduler）；
 * - runtimeFactory 保留 runtime 引用；schema ready 以 poll 等待；
 * - `NotificationSink` / `openSecondLease` 从 T1 fixture **import 复用**（不复制）。
 *
 * 与 T1 的差异（本文件自持 options 位单点——T1 三件套零改动，NC1 锚稳定）：
 * - `watchMapOf` / `attemptEstablishWatch` / `establishWatch` 增加**第三参 options 位**
 *   （SA6 §12.4；T1 已预留单点）；
 * - 数据面按设计 §10.2（F-6 修正）：plain 条目面 = **Y.Map 容器 + plain 条目值**
 *   （raw 构造期 `container.set(key, plainValue)` 保 plain——受控写会物化 Y.Map）；
 *   受控写面（`tasks`）与 plain 条目面（`plainTasks`）**物理分离**：受控写校验会整体
 *   拒绝含 plain 条目的目标容器（实测「Yjs 载体错位：期望 Y.Map，实际 plain value」），
 *   故两载体各持独立容器（同为 Y.Map 载体形态；容器整替属 T4 #390 边界）。
 * - raw 驱动 helper（`rawTransact`）标注「非受控来源」：plain 快照 `oldValue` 仅在
 *   raw `Y.Doc` 事务 / 复制 apply 下出现（SA6 §15-6）。
 *
 * schema 冻结（设计 §10.2 + SA2 O3 落点）：
 * - `Task.title`（标量叶）/ `status?: Status`（别名 + optional 透明）/ `note?: YLeaf<string>`
 *   （可选标量）/ `state: "open"|"done"`（字面量域 enum）/ `priority`（number）/
 *   `sub?`（object 域 = 非标量拒绝面）/ `tags?`（array 域 = 非标量拒绝面）；
 * - ROOT：`tasks`（Record 键空间）/ `ghost?`（未物化 = 数据缺席合法）/
 *   `workRecords`（数组载体 = 载体门负控）/ `title`（根标量）/ `meta`（封闭对象 map
 *   = 条目无统一值域拒绝面）/ `counters: Record<string, YLeaf<number>>`（标量条目容器
 *   = 条目无统一值域拒绝面，E5b）。
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
import { NotificationSink, openSecondLease } from './issue-387-watch-map-fixture.js';

// T1 fixture 的复用面（NotificationSink 单点；openSecondLease 结构兼容）。
export { NotificationSink, openSecondLease };

// ───────────────────────── 契约常量 ─────────────────────────

export const PREDICATE_DOC_ID = 'ns-388';
export const PREDICATE_OWNER: User = { userId: 'u-388' };

/** 谓词契约稳定码（ADR 0030 §3；SA8 action 2 append-only 注册）。 */
export const WATCH_MAP_OPTIONS_INVALID = 'WATCH_MAP_OPTIONS_INVALID';

/** ADR 0030 三 kind 通知词表（含谓词订阅：通知流零参数错误）。 */
export const NOTIFICATION_KINDS = ['data', 'invalidate-all', 'watch-end'] as const;

/**
 * 谓词契约 schema（设计 §10.2；字段域经 `-probe-schema-facts.log` 同构实测）。
 */
export const PREDICATE_SCHEMA_TEXT = `
type Status = YLeaf<string>;
type Detail =
  | { kind: "image"; url: YLeaf<string> }
  | { kind: "text"; body: YLeaf<string> };
type Task = YMap<{
  /** 任务标题 */
  title: YLeaf<string>;
  /** 任务状态（可选：缺失/null 恒不匹配） */
  status?: Status;
  /** 可选备注（optional 标量域） */
  note?: YLeaf<string>;
  /** 字面量域（enum） */
  state: "open" | "done";
  /** 优先级 */
  priority: YLeaf<number>;
  /** 嵌套子容器（object 域 = 非标量拒绝面） */
  sub?: YMap<{
    /** 子值 */
    x: YLeaf<string>;
  }>;
  /** 标签数组（array 域 = 非标量拒绝面） */
  tags?: YLeaf<string>[];
  /** 联合域（union = 非标量拒绝面） */
  detail?: Detail;
  /** XML 片段（xml = 非标量拒绝面） */
  blob?: YXmlFragment<{
    /** 段落 */
    paragraphs: YArray<YLeaf<string>>;
  }>;
}>;
type ROOT = YMap<{
  /** 任务表（Record 键空间；t1/t2/t4 为 live Y.Map——受控写面） */
  tasks: Record<string, Task>;
  /** plain 条目表（Record 键空间；t3/t5 为 raw 构造的 plain 条目——raw 驱动面） */
  plainTasks: Record<string, Task>;
  /** 声明但未物化的任务表（数据缺席合法） */
  ghost?: Record<string, Task>;
  /** 数组载体（非键容器） */
  workRecords: YLeaf<number>[];
  /** 根标量（非容器） */
  title: YLeaf<string>;
  /** 封闭对象 map（条目无统一值域） */
  meta: YMap<{
    /** 备注内容 */
    content: YLeaf<string>;
    /** 附加计数 */
    extra: YLeaf<number>;
  }>;
  /** 标量条目容器（条目无成员语义） */
  counters: Record<string, YLeaf<number>>;
}>;
`.trim();

// ───────────────────────── 载体构造 ─────────────────────────

interface TaskSeed {
  readonly title: string;
  /** `undefined` = 字段缺席（缺失恒不匹配）；null = 显式 null（恒不匹配）。 */
  readonly status?: string | null;
  readonly state: 'open' | 'done';
  readonly priority: number;
}

/** live Y.Map 条目（受控写可 in-place 变更 → C-2 嵌套事件面）。 */
function liveTask(seed: TaskSeed): Y.Map<unknown> {
  const entry = new Y.Map<unknown>();
  entry.set('title', seed.title);
  if (seed.status !== undefined) entry.set('status', seed.status);
  entry.set('state', seed.state);
  entry.set('priority', seed.priority);
  return entry;
}

/** plain 条目（raw 构造保 plain；整值替换 → 容器级 update + plain 快照 oldValue）。 */
function plainTask(seed: TaskSeed): Record<string, unknown> {
  const entry: Record<string, unknown> = { title: seed.title, state: seed.state, priority: seed.priority };
  if (seed.status !== undefined) entry.status = seed.status;
  return entry;
}

/** 构建谓词契约文档（仅内存；不装载持久化）。`withSchema=false` = legacy 无 SCHEMA 载体。 */
export function buildPredicateDoc(withSchema = true): Y.Doc {
  const doc = new Y.Doc();
  if (withSchema) {
    const sc = doc.getMap('SCHEMA');
    sc.set('lang', 'vfsl');
    sc.set('version', 1);
    sc.set('id', PREDICATE_DOC_ID);
    sc.set('text', PREDICATE_SCHEMA_TEXT);
  }
  const meta = doc.getMap('META');
  meta.set('docId', PREDICATE_DOC_ID);
  meta.set('createdAt', 1_700_000_000_000);

  const root = doc.getMap('ROOT');
  const tasks = new Y.Map<unknown>();
  // t1/t2：live Y.Map（匹配态 open / 非匹配态 done）——N1–N8 受控写主行。
  tasks.set('t1', liveTask({ title: 'alpha', status: 'open', state: 'open', priority: 1 }));
  tasks.set('t2', liveTask({ title: 'beta', status: 'done', state: 'done', priority: 9 }));
  // t4：live Y.Map、status 字段缺席（N11 缺失恒不匹配面）。
  tasks.set('t4', liveTask({ title: 'delta', state: 'open', priority: 4 }));
  root.set('tasks', tasks);

  // plain 条目面（raw 构造保 plain）：**独立容器**——条目值偏离 schema 的 plain 形态会被
  // 受控写校验整体拒绝（「Yjs 载体错位：期望 Y.Map，实际 plain value」），故 plain 条目
  // 与受控写面物理分离（同一 Y.Map 载体形态 + raw 驱动，容器整替仍属 T4 边界）。
  const plainTasks = new Y.Map<unknown>();
  // t3：plain 条目、非匹配态（N9/N9b 精确静默面 + N10 进入匹配集面）。
  plainTasks.set('t3', plainTask({ title: 'gamma', status: 'done', state: 'done', priority: 3 }));
  // t5：plain 条目、status 显式 null（N11 null 恒不匹配面）。
  plainTasks.set('t5', plainTask({ title: 'epsilon', status: null, state: 'done', priority: 5 }));
  root.set('plainTasks', plainTasks);

  const workRecords = new Y.Array<number>();
  workRecords.push([30, 10, 20]);
  root.set('workRecords', workRecords);
  root.set('title', 'root-title');

  const closed = new Y.Map<unknown>();
  closed.set('content', 'hi');
  closed.set('extra', 7);
  root.set('meta', closed);

  const counters = new Y.Map<unknown>();
  counters.set('c1', 1);
  counters.set('c2', 2);
  root.set('counters', counters);
  return doc;
}

// ───────────────────────── registry 装配 ─────────────────────────

class PredicateStubHandle implements DocHandle {
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

class PredicateStubPersistence implements DocPersistence {
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

export interface PredicateFixture {
  readonly lease: NamespaceLease;
  readonly runtime: NamespaceRuntime;
  readonly doc: Y.Doc;
  readonly handle: DocHandle;
  readonly registry: ReturnType<typeof createNamespaceRegistryForTesting>;
  /** runtimeFactory 观察到的 notifyDirty（脏通知）调用数（仅诊断锚，非契约断言面）。 */
  readonly notifyDirtyCalls: { count: number };
}

export interface PredicateDocOptions {
  /** schema 文本；`null` = 无 SCHEMA 载体（legacy：无 active schema 通道）。 */
  readonly schemaText?: string | null;
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
export async function openPredicateLease(
  options: PredicateDocOptions = {},
): Promise<PredicateFixture> {
  const doc = buildPredicateDoc(options.schemaText !== null);
  const handle = new PredicateStubHandle(PREDICATE_OWNER, PREDICATE_DOC_ID, doc);
  const notifyDirtyCalls = { count: 0 };
  let runtimeRef: NamespaceRuntime | undefined;
  const registry = createNamespaceRegistryForTesting(new PredicateStubPersistence(handle), {
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
  const opened = await registry.open({ userId: PREDICATE_OWNER.userId }, PREDICATE_DOC_ID);
  expect(opened.ok, `契约前提失败：registry.open 应成功（${JSON.stringify(opened)}）`).toBe(true);
  if (!opened.ok) throw new Error('unreachable: registry.open 失败');
  if (runtimeRef === undefined) throw new Error('契约前提失败：runtimeFactory 未被调用');
  const fixture = { lease: opened.lease, runtime: runtimeRef, doc, handle, registry, notifyDirtyCalls };
  await waitForSchemaSettled(opened.lease);
  return fixture;
}

// ───────────────────────── raw 驱动（非受控来源） ─────────────────────────

/** live ROOT 载体（raw 驱动面）。 */
export function rootMapOf(fixture: PredicateFixture): Y.Map<unknown> {
  return fixture.doc.getMap('ROOT');
}

/** live `tasks` 容器（raw 驱动面；受控写面）。 */
export function tasksOf(fixture: PredicateFixture): Y.Map<unknown> {
  return containerOf(fixture, 'tasks');
}

/** live `plainTasks` 容器（raw 驱动面；plain 条目面——受控写会因载体错位被拒）。 */
export function plainTasksOf(fixture: PredicateFixture): Y.Map<unknown> {
  return containerOf(fixture, 'plainTasks');
}

function containerOf(fixture: PredicateFixture, name: string): Y.Map<unknown> {
  const container = rootMapOf(fixture).get(name);
  if (!(container instanceof Y.Map)) throw new Error(`契约前提失败：${name} 应为 Y.Map 容器`);
  return container as Y.Map<unknown>;
}

/**
 * raw `Y.Doc` 事务（**非受控来源**——绕过写槽载体纪律）：plain 条目的整值替换/删除
 * 与标量条目、字段值对象等「数据偏离 schema」面仅在此可达（SA6 §15-6；受控写会把
 * 对象物化为 Y.Map）。订阅推导对 raw 来源零过滤（ADR §5 宁多勿漏）。
 */
export function rawTransact(fixture: PredicateFixture, body: () => void): void {
  fixture.doc.transact(body);
}

// ───────────────────────── 订阅面适配（options 位单点） ─────────────────────────

export interface PredicateHandleLike {
  readonly unsubscribe: () => void;
}

export type PredicateListener = (notification: unknown) => void;

/**
 * 冻结绑定（单点）：`watchMap(path, listener, options?)`。
 * 行为契约经显式结构断言调用（行为验证不依赖类型系统；类型面由 `*.test-d.ts` 承担）。
 */
function watchMapOf(
  lease: NamespaceLease,
): (
  path: readonly (string | number)[],
  listener: PredicateListener,
  options?: unknown,
) => unknown {
  return (lease as unknown as {
    watchMap: (
      path: readonly (string | number)[],
      listener: PredicateListener,
      options?: unknown,
    ) => unknown;
  }).watchMap;
}

/**
 * 建立结果（面中性归一；B-3）：
 * - 成功 = 返回 handle（`unsubscribe` 为 function）；
 * - 失败 = 同步 throw 携带 string `code`，或返回失败信封 `{ok:false, code}`。
 */
export type PredicateEstablishOutcome =
  | { readonly ok: true; readonly handle: PredicateHandleLike }
  | { readonly ok: false; readonly code: string; readonly message: string };

function normalizeFailure(value: unknown): PredicateEstablishOutcome | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as { ok?: unknown; code?: unknown; message?: unknown };
  if (record.ok !== false || typeof record.code !== 'string') return undefined;
  return {
    ok: false,
    code: record.code,
    message: typeof record.message === 'string' ? record.message : '',
  };
}

/** 尝试建立谓词订阅（面中性；options 位 = 谓词输入）。 */
export function attemptEstablishWatch(
  lease: NamespaceLease,
  path: readonly (string | number)[],
  listener: PredicateListener,
  options?: unknown,
): PredicateEstablishOutcome {
  const watchMap = watchMapOf(lease);
  if (typeof watchMap !== 'function') {
    return {
      ok: false,
      code: 'WATCH_MAP_MISSING',
      message: 'lease.watchMap is not a function（ADR 0030 §1 能力缺席）',
    };
  }
  let returned: unknown;
  try {
    returned = watchMap(path, listener, options);
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
  if (
    typeof returned === 'object'
    && returned !== null
    && typeof (returned as PredicateHandleLike).unsubscribe === 'function'
  ) {
    return { ok: true, handle: returned as PredicateHandleLike };
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
  listener: PredicateListener,
  options?: unknown,
): PredicateHandleLike {
  const outcome = attemptEstablishWatch(lease, path, listener, options);
  if (!outcome.ok) {
    throw new Error(
      `契约前提失败/能力缺口：watchMap(${JSON.stringify(path)}, options=${JSON.stringify(options)}) 未建立`
        + `（ADR 0030 §2/§3）——code=${JSON.stringify(outcome.code)} message=${JSON.stringify(outcome.message)}`,
    );
  }
  return outcome.handle;
}
