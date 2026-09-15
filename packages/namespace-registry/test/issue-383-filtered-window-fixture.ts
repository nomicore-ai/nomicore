/**
 * issue #383（ADR 0029 缝 2）过滤窗口契约共享 fixture —— runtime 组合面与 registry lease
 * 面两套契约测试共用（非测试文件，vitest 不收集；设计 §7 ALLOW ③ / SA6 §12.3 FIX-383-A）。
 *
 * 构造形态沿 #369 先例（`issue-369-window-read-fixture.ts`）：
 * - runtime 面 = `createMemoryPersistence` + `createNamespaceRuntimeWithSeam`（同一 doc 引用）；
 * - registry 面 = `createNamespaceRegistryForTesting` + 返回**同一** doc 的 StubPersistence
 *   （同一 doc 引用是「lease 结果 ≡ 同 doc 直调 runtime 结果」对比锚的前提）；
 * - 两 `initialize` 入口（`makeFilteredRuntime` / `makeFilteredPair`）共用
 *   `buildFilteredDoc`，JSON 级确定性、零随机、零时钟参与。
 *
 * 数据设计（SA6 §12.3 FIX-383-A 逐项；断言全部可判定）：
 * - `tasks`：t1..t5（claimed 2 / done 9 / claimed 5 / open 7 / claimed 1）——匹配集总序、
 *   装满/扫完双边界、falsy 闭集与管线序的承重样本；
 * - `taskList`：3 项位置序 [claimed(2), done(9), claimed(5)]——数组面身份不重编号锚；
 * - `exactTasks`：20 条、恰 5 条 claimed——「匹配恰 n」不得回落计数（T4/S2）；
 * - `bigTasks`：2000 条、恰 3 条 claimed（`heavy: true` 时装载）——规模 + 扫完边界；
 * - `emptyTasks` / `scalarList`：空容器与标量元素安静不匹配；
 * - `edge`：e0{state:'', flag:false, count:0} / e1{state:'x', flag:true, count:1}——equals
 *   标量闭集含 falsy（Z11）；
 * - `nullState`：n1{state:null} / n2{state 缺席}——null 等值匹配实际 null 而不匹配缺席；
 * - `dirty`：d1{claimed} d2{state 缺席} d3{state:NaN} d4{state:{x:1}} d5=Y.Map{}（不可下钻）
 *   ——安静不匹配不挤掉正常项、不炸读（T13）；
 * - `poisonScored`：2000 条、仅 2 条 claimed、未匹配项埋 `payload: NaN`（`heavy: true`）
 *   ——组合层零重物化/零重过滤（D5/S3）；
 * - `badHit`：h1{claimed, payload:NaN}——命中项物化 fail-fast（F4）；
 * - `rawHidden`：schema 外 raw 键容器（键面窗口可读但 schema 锚不可解析 → X5 `schema:null`）。
 *
 * schema 无关说明（SA6 §12.3）：`dirty`/`nullState`/`badHit`/`poisonScored` 的若干记录含
 * schema 声明域外的值（`state:null`、`state:NaN`、`state:{x:1}`、Y.Map 元素、`payload:NaN`）
 * ——读是 schema 无关的（ADR 0029 §7）；这些值只用于安静不匹配 / 闭集边界 / fail-fast 断言，
 * 故 schema 通道断言只在 in-schema 且无域外值的路径上做。
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

/** 过滤窗口契约 schema（SA6 §12.3 FIX-383-A；docs 覆盖 Task 字段口径）。 */
export const TXT_383 = `
type Task = YMap<{
  /** 任务标题 */
  title: YLeaf<string>;
  /** 任务状态 */
  state: YLeaf<string>;
  /** 优先级（数值越大越优先） */
  priority: YLeaf<number>;
  /** 载荷计数 */
  payload: YLeaf<number>;
  /** 标记位 */
  flag: YLeaf<boolean>;
  /** 计数 */
  count: YLeaf<number>;
}>;
type ROOT = YMap<{
  /** 任务表（Record 键空间） */
  tasks: Record<string, Task>;
  /** 任务数组（位置序） */
  taskList: Task[];
  /** 装满边界任务表（恰 5 条 claimed） */
  exactTasks: Record<string, Task>;
  /** 规模任务表（恰 3 条 claimed） */
  bigTasks: Record<string, Task>;
  /** 空任务表 */
  emptyTasks: Record<string, Task>;
  /** 标量数组 */
  scalarList: YLeaf<number>[];
  /** falsy 闭集边界表 */
  edge: Record<string, Task>;
  /** null 闭集边界表 */
  nullState: Record<string, Task>;
  /** 脏值安静不匹配表 */
  dirty: Record<string, Task>;
  /** 毒埋规模表（未匹配项埋 payload NaN） */
  poisonScored: Record<string, Task>;
  /** 命中项毒埋表 */
  badHit: Record<string, Task>;
}>;
`.trim();

export const FILTERED_DOC_ID = 'ns-383';
export const FILTERED_OWNER: User = { userId: 'u-383' };

/** `claimed` 谓词（SA6 §12.3 记号 `…claimed`）。 */
export const CLAIMED = [{ field: 'state', equals: 'claimed' }] as const;

/** 任务子项（Y.Map：字段全部显式写入，缺省字段即为「缺席」样本）。 */
function task(fields: Record<string, unknown>): Y.Map<unknown> {
  const m = new Y.Map<unknown>();
  for (const [key, value] of Object.entries(fields)) m.set(key, value);
  return m;
}

export interface FilteredDocOptions {
  /** 规模表装载（`bigTasks` 2000 条 / `poisonScored` 2000 条）；缺省 false = 两表为空容器。 */
  readonly heavy?: boolean;
  /** schema 键是否写入（缺省 true；false = 无 active schema 通道）。 */
  readonly seedSchema?: boolean;
}

/** 构建过滤窗口契约文档（不装载持久化）。 */
export function buildFilteredDoc(options: FilteredDocOptions = {}): Y.Doc {
  const doc = new Y.Doc();
  if (options.seedSchema !== false) {
    const sc = doc.getMap('SCHEMA');
    sc.set('lang', 'vfsl');
    sc.set('version', 1);
    sc.set('id', FILTERED_DOC_ID);
    sc.set('text', TXT_383);
  }
  const meta = doc.getMap('META');
  meta.set('docId', FILTERED_DOC_ID);
  meta.set('createdAt', 1_700_000_000_000);

  const root = doc.getMap('ROOT');

  const tasks = new Y.Map<unknown>();
  tasks.set('t1', task({ title: 'alpha', state: 'claimed', priority: 2, payload: 1, flag: false, count: 0 }));
  tasks.set('t2', task({ title: 'beta', state: 'done', priority: 9, payload: 2, flag: true, count: 1 }));
  tasks.set('t3', task({ title: 'gamma', state: 'claimed', priority: 5, payload: 3, flag: false, count: 2 }));
  tasks.set('t4', task({ title: 'delta', state: 'open', priority: 7, payload: 4, flag: true, count: 3 }));
  tasks.set('t5', task({ title: 'epsilon', state: 'claimed', priority: 1, payload: 5, flag: false, count: 4 }));
  root.set('tasks', tasks);

  const taskList = new Y.Array<unknown>();
  taskList.push([
    task({ title: 'alpha', state: 'claimed', priority: 2, payload: 1, flag: false, count: 0 }),
    task({ title: 'beta', state: 'done', priority: 9, payload: 2, flag: true, count: 1 }),
    task({ title: 'gamma', state: 'claimed', priority: 5, payload: 3, flag: false, count: 2 }),
  ]);
  root.set('taskList', taskList);

  const exactTasks = new Y.Map<unknown>();
  for (let i = 0; i < 20; i += 1) {
    const claimed = i % 4 === 0; // i ∈ {0,4,8,12,16} → 恰 5 条
    exactTasks.set(`e${i}`, task({
      title: `exact-${i}`,
      state: claimed ? 'claimed' : 'done',
      priority: i,
      payload: i,
      flag: claimed,
      count: i,
    }));
  }
  root.set('exactTasks', exactTasks);

  const bigTasks = new Y.Map<unknown>();
  const poisonScored = new Y.Map<unknown>();
  if (options.heavy === true) {
    for (let i = 0; i < 2000; i += 1) {
      const claimed = i < 3; // 恰 3 条
      bigTasks.set(`b${i}`, task({ title: `big-${i}`, state: claimed ? 'claimed' : 'done', priority: i, payload: i }));
    }
    for (let i = 0; i < 2000; i += 1) {
      // 未匹配项埋毒：组合层若重走未匹配项物化，必得 PATH_NOT_ALLOWED（D5/S3）。
      const claimed = i < 2; // 恰 2 条
      poisonScored.set(`p${i}`, task({
        title: `poison-${i}`,
        state: claimed ? 'claimed' : 'done',
        priority: claimed ? 1 : Number.NaN,
        payload: claimed ? i : Number.NaN,
      }));
    }
  }
  root.set('bigTasks', bigTasks);
  root.set('poisonScored', poisonScored);

  root.set('emptyTasks', new Y.Map<unknown>());

  const scalarList = new Y.Array<number>();
  scalarList.push([1, 2, 3]);
  root.set('scalarList', scalarList);

  const edge = new Y.Map<unknown>();
  edge.set('e0', task({ title: 'edge0', state: '', priority: 0, payload: 0, flag: false, count: 0 }));
  edge.set('e1', task({ title: 'edge1', state: 'x', priority: 1, payload: 1, flag: true, count: 1 }));
  root.set('edge', edge);

  const nullState = new Y.Map<unknown>();
  nullState.set('n1', task({ title: 'null-1', state: null, priority: 1, payload: 1, flag: false, count: 1 }));
  nullState.set('n2', task({ title: 'null-2' })); // state field 缺席：null 等值不匹配缺席
  root.set('nullState', nullState);

  const dirty = new Y.Map<unknown>();
  dirty.set('d1', task({ title: 'dirty-1', state: 'claimed', priority: 1, payload: 1, flag: false, count: 1 }));
  dirty.set('d2', task({ title: 'dirty-2' })); // state 缺席
  dirty.set('d3', task({ title: 'dirty-3', state: Number.NaN })); // 非有限 number
  dirty.set('d4', task({ title: 'dirty-4', state: { x: 1 } })); // 非标量
  dirty.set('d5', new Y.Map<unknown>()); // 元素不可下钻
  root.set('dirty', dirty);

  const badHit = new Y.Map<unknown>();
  badHit.set('h1', task({ title: 'bad-hit', state: 'claimed', payload: Number.NaN }));
  root.set('badHit', badHit);

  // schema 外 raw 键容器（ROOT 类型未声明 → 锚链不可解析 → schema:null；键面窗口仍可读）。
  const rawHidden = new Y.Map<unknown>();
  rawHidden.set('r1', task({ title: 'raw-1', state: 'claimed' }));
  rawHidden.set('r2', task({ title: 'raw-2', state: 'claimed' }));
  rawHidden.set('r3', task({ title: 'raw-3', state: 'done' }));
  root.set('rawHidden', rawHidden);

  return doc;
}

// ── Yjs 原生预言机（零实现复用；native 直数）──────────────────────────────────────────

/** ROOT 下的原生容器（Y.Map / Y.Array；零导航复用）。 */
export function nativeRootMember(doc: Y.Doc, key: string): unknown {
  return doc.getMap('ROOT').get(key);
}

/** 键面子项的原生单段字段读（Y.Map child）。 */
export function nativeFieldOf(child: unknown, field: string): unknown {
  return child instanceof Y.Map ? child.get(field) : undefined;
}

// ── 装配入口（runtime 面 / lease 面 / 同 doc 双面）─────────────────────────────────────

/** 经 MemoryPersistence 构造带 SCHEMA/ROOT 的 DocHandle + 同一 doc 引用。 */
export async function makeFilteredHandle(
  options: FilteredDocOptions = {},
): Promise<{ readonly handle: DocHandle; readonly doc: Y.Doc }> {
  const doc = buildFilteredDoc(options);
  const persistence = createMemoryPersistence({ scheduler: realPersistenceScheduler });
  const handle = await persistence.createDoc(FILTERED_OWNER, FILTERED_DOC_ID, doc);
  return { handle, doc };
}

/** 以既有 handle 构造 runtime（seam 通道；registry runtimeFactory 复用同一入口）。 */
export function createFilteredRuntimeFromHandle(handle: DocHandle): NamespaceRuntime {
  return createNamespaceRuntimeWithSeam({ handle });
}

/** 等待 runtime schemaState 到 ready（沿既有 fixture 的 poll 纪律）。 */
export async function waitForFilteredSchemaReady(runtime: NamespaceRuntime): Promise<void> {
  await expect
    .poll(() => runtime.getStatus().schema.state, { interval: 10, timeout: 5_000 })
    .toBe('ready');
}

export interface FilteredRuntimeFixture {
  readonly runtime: NamespaceRuntime;
  readonly doc: Y.Doc;
  readonly handle: DocHandle;
}

/** 构造 runtime 并等待 P0 结算到 schema ready。 */
export async function makeFilteredRuntime(options: FilteredDocOptions = {}): Promise<FilteredRuntimeFixture> {
  const { handle, doc } = await makeFilteredHandle(options);
  const runtime = createFilteredRuntimeFromHandle(handle);
  await waitForFilteredSchemaReady(runtime);
  return { runtime, doc, handle };
}

/** 返回同一预建 handle 的 StubPersistence（稳定 doc 引用 = 双面对比锚的前提）。 */
class FilteredStubPersistence implements DocPersistence {
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
class FilteredStubHandle implements DocHandle {
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

export interface FilteredLeaseFixture {
  readonly lease: NamespaceLease;
  readonly doc: Y.Doc;
  readonly handle: DocHandle;
  readonly registry: ReturnType<typeof createNamespaceRegistryForTesting>;
}

/** 经真实 Registry 装配打开 lease（生产 runtimeFactory；stub handle 承载预建 doc）。 */
export async function makeFilteredLease(options: FilteredDocOptions = {}): Promise<FilteredLeaseFixture> {
  const doc = buildFilteredDoc(options);
  const handle = new FilteredStubHandle(FILTERED_OWNER, FILTERED_DOC_ID, doc);
  const registry = createNamespaceRegistryForTesting(new FilteredStubPersistence(handle), {
    clock: manualClock(),
    scheduler: createRegistryTestScheduler(),
    randomBytes: deterministicRandomBytes,
  });
  const opened = await registry.open({ userId: FILTERED_OWNER.userId }, FILTERED_DOC_ID);
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

export interface FilteredPairFixture {
  readonly runtime: NamespaceRuntime;
  readonly lease: NamespaceLease;
  readonly doc: Y.Doc;
  readonly registry: ReturnType<typeof createNamespaceRegistryForTesting>;
}

/**
 * 同 doc 双面装配：**同一 Y.Doc** 上分别以两个独立 stub handle 构造直调 runtime 与
 * registry lease —— 「lease 结果 ≡ 同 doc 直调 runtime 结果」对比锚（AC6/L1/T11/X8）。
 * 两 runtime 只读该 doc，互不干扰（零写路径，无 persistence 副作用）。
 */
export async function makeFilteredPair(options: FilteredDocOptions = {}): Promise<FilteredPairFixture> {
  const doc = buildFilteredDoc(options);
  const runtime = createFilteredRuntimeFromHandle(
    new FilteredStubHandle(FILTERED_OWNER, FILTERED_DOC_ID, doc),
  );
  const registry = createNamespaceRegistryForTesting(
    new FilteredStubPersistence(new FilteredStubHandle(FILTERED_OWNER, FILTERED_DOC_ID, doc)),
    {
      clock: manualClock(),
      scheduler: createRegistryTestScheduler(),
      randomBytes: deterministicRandomBytes,
    },
  );
  const opened = await registry.open({ userId: FILTERED_OWNER.userId }, FILTERED_DOC_ID);
  expect(opened.ok, `契约前提失败：registry.open 应成功（${JSON.stringify(opened)}）`).toBe(true);
  if (!opened.ok) throw new Error('unreachable');
  await waitForFilteredSchemaReady(runtime);
  await expect
    .poll(
      () => {
        const status = opened.lease.getStatus();
        return status.lease === 'active' ? status.runtime.schema.state : 'released';
      },
      { interval: 10, timeout: 5_000 },
    )
    .toBe('ready');
  return { runtime, lease: opened.lease, doc, registry };
}
