/**
 * SA6 红灯锚定 — issue #412（persistence：请求公开完成式排空 API（drain）——
 * dispose 语义为 abort+clearTimers+doc.destroy，宿主只能定时睡眠猜排空窗口；
 * retryDelayMs 与 debounceMs 耦合）。
 *
 * 契约来源（issue #412 正文 + ADR 0006 既有条款）：
 * - 缺口 1（issue 正文「问题 1」+「请求」节）：`PersistenceLifecycle` 的公开面
 *   （loadDoc/createDoc/importDoc/archiveDoc/deleteDoc/saveDoc/getStatus/dispose）
 *   没有任何完成式排空入口。`dispose()`（lifecycle.ts:801）同步段
 *   `abortController.abort()`（:808）+ `clearTimers`（:812）+ `doc.destroy()`（:821）
 *   + `cells.clear()`（:824），只 await 已 track 的在途操作——**dispose 时刻未落盘的
 *   已 ACK 写全部丢失**。宿主的固定睡眠窗口（apps/yjs-server/src/app.ts:566-571
 *   `maxDirtyMs + DRAIN_MARGIN_MS`；消费方 nomic-server 的固定 5500ms）在两类
 *   现实条件下被击穿：(i) 跨 key 并发在途 flush（慢盘，§0b/§1g 的动态构造）；
 *   (ii) schedule 调长（debounceMs 60s / maxDirtyMs 300s，§0a/§1d）。
 *   请求 = 把归档路径的强制排空（`settleEntryForArchive`，:690）一般化为公开
 *   `drain()`：对所有 live 脏 entry（含零 handle）立即 startFlush（跳过 debounce）
 *   并 await 全部 settle；不 abort、不 destroy；drain 返回后 dispose 可安全立即执行；
 *   可选参数只 drain 指定 key 集合。
 * - 缺口 2（issue 正文「问题 2」）：`retryDelayMs: this.schedule.debounceMs || 1`
 *   （lifecycle.ts:1030 初始化 + :1088 flush 成功回落）把重试节奏绑死在防抖节奏上：
 *   debounceMs 调到 60s 后，一次瞬时 `io.write` 失败会让 entry 以
 *   `persistence-degraded` 持续 60s 才首次重试。请求 = 独立 `retryDelayMs` 配置，
 *   缺省保持现行为（= debounceMs）。
 *
 * 红灯机制（基线 = 公开面 / 配置面无 drain、无 retryDelayMs）：
 * - 【红】`drain()` 调用在基线上抛 `TypeError: ...drain is not a function`——
 *   特征缺失的红（与 persistence-phase5-archive-red.test.ts 同款锚定纪律）；
 * - 【红】`schedule.retryDelayMs` 在基线上被解析面静默忽略 → 重试基准恒为
 *   debounceMs → 行为断言（推进 retryDelayMs 窗口后必须有重试落盘）在目标断言处
 *   失败（不是环境/超时/入口错误；2a/2c 的失败断言先于任何 I/O 结算屏障）。
 * - 【绿（基线已满足，预期保持）】§0 固定睡眠缺口正复现（dispose 语义 = 有损，
 *   本 issue 不改变 dispose 语义；ADR-0006 §228-5「dispose() 语义不变」）；§2b
 *   缺省 retry 基准 = debounceMs 的现行为；§3 缺省 schedule 常量（500/5000）与
 *   既有解析形状不变（既有冻结审计 persistence-contract.test.ts:32-36 的 toEqual
 *   由设计自行裁定键面演进——本文件不重复其断言，避免制造伪冲突）。
 *
 * 锚定纪律：真实 yjs / 真实 MemoryPersistence·FilePersistence（真实 tmpdir、真实
 * fs rename），零 mock 本地服务、零源码 grep/字符串断言；故障注入仅经既有
 * createPersistenceIoFaultSeam（wrapIo around-seam）与本地 io 探针（write 计数 +
 * 有界失败注入，均满足 PersistenceIO 契约：reject 于提交段前、禁同步 throw）；
 * fake scheduler 脚本化驱动（零 real sleep），竞态用例一律 withTimeout（挂起即失败），
 * 真实 fs 结算用探针结算屏障（whenSettled）而非微任务计数。
 *
 * 临时形状声明（显式标记，待设计冻结；仅调用点形状，不改语义）：
 * - `drain(targets?: readonly { owner: User; docId: string }[]): Promise<void>`——
 *   issue 只冻结「零参全量排空 + 可选参数只 drain 指定 key 集合」语义，未冻结
 *   指定集合的入参形状（公开面 key 是 (owner, docId)，内部 `toKey` 的
 *   `${userId}\u0000${docId}` 不是公开词汇）。本文件以最小提案形状锚定
 *   （`{owner, docId}` 目标列表；与 archiveDoc 的 `expectedReplicationIdentity`
 *   对象包装同款先例）；设计冻结更精确形状时只改调用点。
 * - `retryDelayMs` 的承载位置 = `PersistenceSchedule`（issue 把它描述为
 *   `this.schedule.debounceMs` 的正交兄弟配置；resolvePersistenceSchedule 是唯一
 *   调度解析点）。**解析结果的键面形状不做断言**：无论「解析面落实缺省值」还是
 *   「生命周期侧回退 debounceMs」，只要 2a/2b 行为成立即满足契约。
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  FilePersistence,
  createMemoryPersistence,
  resolvePersistenceSchedule,
  type DocPersistence,
  type MemoryPersistenceOptions,
  type PersistenceIO,
  type PersistenceSchedule,
  type User,
} from '@nomicore/persistence';
import {
  createPersistenceIoFaultSeam,
  createTestScheduler,
  withTimeout,
  type PersistenceIoFaults,
  type TestScheduler,
} from '@nomicore/persistence/testing';

// ═══════════════════════ 契约面本地声明（临时形状，待设计冻结） ═══════════════════════

/** drain 的可选参数目标（issue：「只 drain 指定 key 集合」；公开 key = (owner, docId)）。 */
interface PersistenceDrainTarget {
  readonly owner: User;
  readonly docId: string;
}

/** 公开完成式排空入口（issue 冻结名 `drain`；参数形状为 SA6 最小提案，待设计冻结）。 */
interface DrainCapable {
  drain(targets?: readonly PersistenceDrainTarget[]): Promise<void>;
}

function asDrain(persistence: DocPersistence): DocPersistence & DrainCapable {
  return persistence as unknown as DocPersistence & DrainCapable;
}

const ALICE: User = Object.freeze({ userId: 'u-alice' });
const DOC_A = 'ns-drain-a';
const DOC_B = 'ns-drain-b';
const DOC_C = 'ns-drain-c';

/** 消费方「schedule 调长」场景（issue 问题 1 条件 2）：debounceMs=60s / maxDirtyMs=300s。 */
const LONG_SCHEDULE: Partial<PersistenceSchedule> = { debounceMs: 60_000, maxDirtyMs: 300_000 };

/** io 探针：write 尝试计数 + 有界失败注入 + 并发在途 hold（均满足 PersistenceIO 契约）。 */
interface WriteProbe {
  readonly attempts: number;
  failNextWrites(count: number, reason: unknown): void;
  /**
   * 确定性异步屏障：等待第 `count` 次 write 尝试结算（resolve/reject 双路）。
   * Memory 侧微任务排空即可，File 侧是真实 fs I/O（mkdir/writeFile/rename）——
   * 微任务计数无法覆盖，必须用结算屏障（零 real sleep、零轮询）。
   */
  whenSettled(count: number): Promise<void>;
  /**
   * 下一 `count` 次 write 在提交段前挂起（issue 问题 1 条件 1「跨 key flush 并发
   * 无上界」的确定性构造面）；`entered` 在全部 count 次进入后结算，
   * `release()` 一次性放行全部。挂起期间 signal 的 abort 由内层 io 入口门裁决
   * （hold 层不吞 signal）。
   */
  holdNextWrites(count: number): { readonly entered: Promise<void>; release(): void };
  wrap(io: PersistenceIO): PersistenceIO;
}

function makeWriteProbe(): WriteProbe {
  let attempts = 0;
  let settledCount = 0;
  let failRemaining = 0;
  let failReason: unknown = undefined;
  const waiters: Array<{ readonly at: number; readonly resolve: () => void }> = [];
  let holdSlots = 0;
  let holdExpected = 0;
  let holdEnteredCount = 0;
  let holdGate: Promise<void> = Promise.resolve();
  let holdReleaseFn: (() => void) | undefined;
  let holdEnteredResolve: (() => void) | undefined;
  function markSettled(): void {
    settledCount += 1;
    for (const waiter of waiters.splice(0)) {
      if (settledCount >= waiter.at) waiter.resolve();
      else waiters.push(waiter);
    }
  }
  return {
    get attempts() { return attempts; },
    failNextWrites(count, reason) {
      failRemaining = count;
      failReason = reason;
    },
    whenSettled(count) {
      if (settledCount >= count) return Promise.resolve();
      return new Promise<void>((resolve) => { waiters.push({ at: count, resolve }); });
    },
    holdNextWrites(count) {
      holdSlots = count;
      holdExpected = count;
      holdEnteredCount = 0;
      holdGate = new Promise<void>((resolve) => { holdReleaseFn = resolve; });
      const entered = new Promise<void>((resolve) => { holdEnteredResolve = resolve; });
      return { entered, release: () => holdReleaseFn?.() };
    },
    // 归档/删除/探针路径不参与本契约，但包装必须透传既有可选能力（不发明、不谎报能力）。
    wrap(io) {
      const wrapped: PersistenceIO = {
        read: (key, signal) => io.read(key, signal),
        write: async (key, snapshot, signal) => {
          attempts += 1;
          try {
            if (failRemaining > 0) {
              failRemaining -= 1;
              throw failReason;
            }
            if (holdSlots > 0) {
              holdSlots -= 1;
              holdEnteredCount += 1;
              if (holdEnteredCount >= holdExpected) holdEnteredResolve?.();
              await holdGate;
            }
            await io.write(key, snapshot, signal);
          } finally {
            markSettled();
          }
        },
        ...(io.writeArchive !== undefined
          ? { writeArchive: (key: string, snapshot: Uint8Array, signal: AbortSignal) => io.writeArchive!(key, snapshot, signal) }
          : {}),
        ...(io.remove !== undefined
          ? { remove: (key: string, signal: AbortSignal) => io.remove!(key, signal) }
          : {}),
        ...(io.removeKey !== undefined
          ? { removeKey: (key: string, signal: AbortSignal) => io.removeKey!(key, signal) }
          : {}),
      };
      return wrapped;
    },
  };
}

async function drainMicrotasks(depth = 60): Promise<void> {
  for (let index = 0; index < depth; index += 1) await Promise.resolve();
}

function makeDoc(docId: string, n: number): Y.Doc {
  const doc = new Y.Doc();
  doc.getMap('META').set('docId', docId);
  doc.getMap('ROOT').set('n', n);
  return doc;
}

/** 持久面观测：经**新实例**读 committed snapshot（不读 live cache——落盘事实的唯一权威面）。 */
async function committedN(persistence: DocPersistence, owner: User, docId: string): Promise<unknown> {
  const handle = await persistence.loadDoc(owner, docId);
  if (handle === null) return null;
  const value = handle.doc.getMap('ROOT').get('n');
  await handle.release();
  return value;
}

async function disposeOf(persistence: DocPersistence): Promise<void> {
  await (persistence as unknown as { dispose(): Promise<void> }).dispose();
}

// ═══════════════════════════════ 双 adapter 夹具 ═══════════════════════════════

interface DrainFixture {
  readonly adapterName: string;
  readonly persistence: DocPersistence;
  readonly scheduler: TestScheduler;
  readonly probe: WriteProbe;
  readonly faults: PersistenceIoFaults;
  /** 同 store 的新实例（committed 事实观测面；零调度依赖）。 */
  makeFresh(): DocPersistence;
  dispose(): Promise<void>;
}

function makeMemoryDrainFixture(schedule: Partial<PersistenceSchedule>): DrainFixture {
  const store = new Map<string, Uint8Array>();
  const scheduler = createTestScheduler();
  const probe = makeWriteProbe();
  const seam = createPersistenceIoFaultSeam();
  const writeSnapshot = async (key: string, snapshot: Uint8Array): Promise<void> => {
    store.set(key, snapshot.slice());
  };
  const readSnapshot = async (key: string): Promise<Uint8Array | undefined> => store.get(key);
  const persistence = createMemoryPersistence({
    scheduler,
    schedule,
    writeSnapshot,
    readSnapshot,
    wrapIo: (io) => probe.wrap(seam.wrap(io)),
  } as MemoryPersistenceOptions);
  return {
    adapterName: 'MemoryPersistence',
    persistence,
    scheduler,
    probe,
    faults: seam.faults,
    makeFresh: () => createMemoryPersistence({
      scheduler: createTestScheduler(),
      schedule,
      writeSnapshot,
      readSnapshot,
    } as MemoryPersistenceOptions),
    dispose: () => disposeOf(persistence),
  };
}

// File 夹具每个用例独立 tmpdir（afterEach 统一清理）。
const fileRootDirs: string[] = [];

function makeFileDrainFixture(schedule: Partial<PersistenceSchedule>, adapterName = 'FilePersistence'): DrainFixture {
  const rootDir = path.join(
    os.tmpdir(),
    `nomicore-drain-412-${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
  );
  fileRootDirs.push(rootDir);
  const scheduler = createTestScheduler();
  const probe = makeWriteProbe();
  const seam = createPersistenceIoFaultSeam();
  const persistence = new FilePersistence({
    rootDir,
    scheduler,
    schedule,
    wrapIo: (io) => probe.wrap(seam.wrap(io)),
  });
  return {
    adapterName,
    persistence,
    scheduler,
    probe,
    faults: seam.faults,
    makeFresh: () => new FilePersistence({ rootDir, scheduler: createTestScheduler() }),
    dispose: () => disposeOf(persistence),
  };
}

afterEach(async () => {
  await Promise.all(
    fileRootDirs.splice(0).map((root) => fsp.rm(root, { recursive: true, force: true })),
  );
});

const adapterMatrix: Record<string, (schedule: Partial<PersistenceSchedule>) => DrainFixture> = {
  MemoryPersistence: makeMemoryDrainFixture,
  FilePersistence: makeFileDrainFixture,
};

// ═══════════════ §0 缺口正复现（基线行为；预期绿——dispose 语义不变） ═══════════════

for (const [adapterName, makeFixture] of Object.entries(adapterMatrix)) {
  describe(`§0 缺口正复现：固定睡眠 + dispose（${adapterName}；基线行为，dispose 语义不因本 issue 改变）`, () => {
    it('0a schedule 调长（debounceMs=60s）后固定睡眠 5.5s + dispose → 已 ACK 写丢失（新实例见陈旧内容）', async () => {
      const fx = makeFixture(LONG_SCHEDULE);
      const handle = await fx.persistence.createDoc(ALICE, DOC_A, makeDoc(DOC_A, 1)); // 初始提交 n=1
      handle.doc.getMap('ROOT').set('n', 77);
      await fx.persistence.saveDoc(handle); // ACK：脏状态已登记（不承诺落盘）
      await handle.release(); // 消费方 registry.shutdown：全部 lease 释放
      const base = fx.probe.attempts;

      // 消费方固定睡眠 FILE_PERSISTENCE_DRAIN_MS=5500 < debounceMs=60000：窗口内零 flush
      await fx.scheduler.advanceBy(5_500);
      await drainMicrotasks();
      expect(fx.probe.attempts - base).toBe(0);

      await fx.dispose(); // abort + clearTimers + doc.destroy + cells.clear
      // 落盘事实：77 丢失，新实例恢复陈旧 n=1（这就是要替换掉的停机链路损失）
      expect(await committedN(fx.makeFresh(), ALICE, DOC_A)).toBe(1);
    });

    it('0b 跨 key 并发在途 flush（慢盘/风暴条件）：固定睡眠窗与时延无关 → dispose 后三个 key 的已 ACK 写全丢', async () => {
      const fx = makeFixture(LONG_SCHEDULE);
      const docs = [DOC_A, DOC_B, DOC_C];
      for (const docId of docs) {
        const handle = await fx.persistence.createDoc(ALICE, docId, makeDoc(docId, 1));
        handle.doc.getMap('ROOT').set('n', 77);
        await fx.persistence.saveDoc(handle);
      }
      const base = fx.probe.attempts;

      // 三条 debounce 同时到点 → 三个并发 flush；全部在提交段前挂起（慢盘等价：I/O 尚未结算）
      const hold = fx.probe.holdNextWrites(docs.length);
      await fx.scheduler.advanceBy(60_000);
      await withTimeout(hold.entered, 2_000, 'three concurrent flushes to enter pre-commit hold');
      expect(fx.probe.attempts - base).toBe(docs.length);

      // 消费方固定睡眠窗：与在途 I/O 的结算无关（窗口是猜测，不是完成式）
      await fx.scheduler.advanceBy(5_500);
      const disposing = fx.dispose();
      hold.release();
      await withTimeout(disposing, 2_000, 'dispose to settle after held writes release');

      for (const docId of docs) {
        expect(await committedN(fx.makeFresh(), ALICE, docId)).toBe(1); // 三个 key 的 77 全部丢失
      }
    });
  });
}

// ═════════════ §1 公开完成式排空 drain（Memory/File 共享矩阵；基线红） ═════════════

for (const [adapterName, makeFixture] of Object.entries(adapterMatrix)) {
  describe(`§1 drain() 契约（${adapterName}；基线红 = drain 缺失，TypeError）`, () => {
    it('1a live handle + dirty entry：drain 跳过 debounce 立即落盘，零时间推进；handle/doc 仍可用（不 abort/destroy/clear 调度面）', async () => {
      const fx = makeFixture(LONG_SCHEDULE);
      const handle = await fx.persistence.createDoc(ALICE, DOC_A, makeDoc(DOC_A, 1));
      handle.doc.getMap('ROOT').set('n', 77);
      await fx.persistence.saveDoc(handle);
      const base = fx.probe.attempts;
      expect(fx.scheduler.pending()).toBeGreaterThan(0); // debounce/maxDirty 在武装且未推进

      await withTimeout(asDrain(fx.persistence).drain(), 2_000, 'drain over live dirty entry');
      // 强制即时 flush：恰一次 write（零 hot loop）、零 advanceBy 即落盘最新完整状态
      expect(fx.probe.attempts - base).toBe(1);
      expect(await committedN(fx.makeFresh(), ALICE, DOC_A)).toBe(77);

      // 非破坏性证据：lease 仍有效、调度面未被清除——再次 saveDoc + 调度窗仍能落盘
      expect(handle.getStatus()).toBe('ready');
      handle.doc.getMap('ROOT').set('n', 88);
      await fx.persistence.saveDoc(handle);
      await fx.scheduler.advanceBy(60_000);
      await withTimeout(fx.probe.whenSettled(base + 2), 2_000, 'second scheduled flush to settle');
      await drainMicrotasks();
      expect(fx.probe.attempts - base).toBe(2);
      expect(await committedN(fx.makeFresh(), ALICE, DOC_A)).toBe(88);
      await fx.dispose();
    });

    it('1b 在途 flush：drain 等待其结算、不重复发起、不 abort（release 前不提前返回）', async () => {
      const fx = makeFixture({ debounceMs: 1_000, maxDirtyMs: 300_000 });
      const handle = await fx.persistence.createDoc(ALICE, DOC_A, makeDoc(DOC_A, 1));
      handle.doc.getMap('ROOT').set('n', 77);
      await fx.persistence.saveDoc(handle);
      const base = fx.probe.attempts;

      const hold = fx.faults.holdNextWriteBeforeCommit();
      await fx.scheduler.advanceBy(1_000); // debounce → flush 进入 pre-commit hold
      await withTimeout(hold.entered, 2_000, 'in-flight flush to enter pre-commit hold');
      expect(fx.probe.attempts - base).toBe(1);

      let drainSettled = false;
      const draining = asDrain(fx.persistence).drain().then(() => { drainSettled = true; });
      void draining.catch(() => {});
      await drainMicrotasks();
      expect(drainSettled).toBe(false); // 在途 flush 未结算 → drain 不得提前返回
      expect(fx.probe.attempts - base).toBe(1); // single-flight：不重复发起

      hold.release();
      await withTimeout(draining, 2_000, 'drain after in-flight flush settles');
      expect(fx.probe.attempts - base).toBe(1);
      expect(await committedN(fx.makeFresh(), ALICE, DOC_A)).toBe(77); // 未被 abort：提交段真实执行
      await fx.dispose();
    });

    it('1c 负控：空 lifecycle 与干净 live entry → 零 write、立即结算；drain 后调度完好', async () => {
      const fx = makeFixture(LONG_SCHEDULE);
      const base0 = fx.probe.attempts;
      await withTimeout(asDrain(fx.persistence).drain(), 2_000, 'drain on empty lifecycle');
      expect(fx.probe.attempts - base0).toBe(0);

      const handle = await fx.persistence.createDoc(ALICE, DOC_A, makeDoc(DOC_A, 1));
      const base1 = fx.probe.attempts;
      await withTimeout(asDrain(fx.persistence).drain(), 2_000, 'drain on clean live entry');
      expect(fx.probe.attempts - base1).toBe(0); // 干净 entry 不产生 write
      expect(handle.getStatus()).toBe('ready');

      handle.doc.getMap('ROOT').set('n', 42);
      await fx.persistence.saveDoc(handle);
      await fx.scheduler.advanceBy(60_000);
      await withTimeout(fx.probe.whenSettled(base1 + 1), 2_000, 'scheduled flush after drain to settle');
      await drainMicrotasks();
      expect(fx.probe.attempts - base1).toBe(1); // debounce 调度在 drain 后仍然工作
      expect(await committedN(fx.makeFresh(), ALICE, DOC_A)).toBe(42);
      await fx.dispose();
    });

    it('1d 宿主机停机链路（issue 消费方场景）：release 全部 lease → 固定睡眠 → drain → dispose → 最新内容落盘', async () => {
      const fx = makeFixture(LONG_SCHEDULE);
      const handle = await fx.persistence.createDoc(ALICE, DOC_A, makeDoc(DOC_A, 1));
      handle.doc.getMap('ROOT').set('n', 77);
      await fx.persistence.saveDoc(handle);
      await handle.release();
      const base = fx.probe.attempts;

      await fx.scheduler.advanceBy(5_500); // 固定睡眠窗（零落盘）
      await drainMicrotasks();
      expect(fx.probe.attempts - base).toBe(0);

      await withTimeout(asDrain(fx.persistence).drain(), 2_000, 'drain as shutdown replacement');
      await fx.dispose(); // drain 返回后 dispose 可安全立即执行
      expect(await committedN(fx.makeFresh(), ALICE, DOC_A)).toBe(77);
    });

    it('1e 可选参数（临时形状，待设计冻结）：只 drain 指定 (owner, docId) 集合，未指定 key 保持脏', async () => {
      const fx = makeFixture(LONG_SCHEDULE);
      const handleA = await fx.persistence.createDoc(ALICE, DOC_A, makeDoc(DOC_A, 1));
      const handleB = await fx.persistence.createDoc(ALICE, DOC_B, makeDoc(DOC_B, 1));
      handleA.doc.getMap('ROOT').set('n', 77);
      handleB.doc.getMap('ROOT').set('n', 88);
      await fx.persistence.saveDoc(handleA);
      await fx.persistence.saveDoc(handleB);
      const base = fx.probe.attempts;

      await withTimeout(
        asDrain(fx.persistence).drain([{ owner: ALICE, docId: DOC_A }]),
        2_000,
        'subset drain',
      );
      expect(fx.probe.attempts - base).toBe(1); // 仅 A 被强制 flush
      expect(await committedN(fx.makeFresh(), ALICE, DOC_A)).toBe(77);
      expect(await committedN(fx.makeFresh(), ALICE, DOC_B)).toBe(1); // B 未被触碰（仍脏）

      await withTimeout(asDrain(fx.persistence).drain(), 2_000, 'full drain after subset drain');
      expect(fx.probe.attempts - base).toBe(2);
      expect(await committedN(fx.makeFresh(), ALICE, DOC_B)).toBe(88);
      await fx.dispose();
    });

    it('1f degraded 回退窗：drain 不热循环（ADR-0006 §79-2 退避为唯一调度源）→ 重试成功后结算', async () => {
      const fx = makeFixture({ debounceMs: 60_000, maxDirtyMs: 300_000, retryDelayMs: 150 });
      const handle = await fx.persistence.createDoc(ALICE, DOC_A, makeDoc(DOC_A, 1));
      handle.doc.getMap('ROOT').set('n', 77);
      await fx.persistence.saveDoc(handle);
      const base = fx.probe.attempts;

      fx.probe.failNextWrites(1, new Error('store down (one-shot)'));
      let drainSettled = false;
      const draining = asDrain(fx.persistence).drain().then(() => { drainSettled = true; });
      void draining.catch(() => {});
      await drainMicrotasks();
      expect(fx.probe.attempts - base).toBe(1); // 强制 flush 恰一次（失败）
      await withTimeout(fx.probe.whenSettled(base + 1), 2_000, 'drain forced flush to fail');
      await drainMicrotasks();
      expect(drainSettled).toBe(false); // 脏状态未落盘 → drain 不提前返回

      await fx.scheduler.advanceBy(149); // retryDelayMs=150 未到
      await drainMicrotasks();
      expect(fx.probe.attempts - base).toBe(1); // 回退窗内零新尝试（零热循环）
      expect(drainSettled).toBe(false);

      await fx.scheduler.advanceBy(1); // 回退到点 → 重试成功
      await withTimeout(draining, 2_000, 'drain after degraded retry succeeds');
      expect(fx.probe.attempts - base).toBe(2);
      expect(await committedN(fx.makeFresh(), ALICE, DOC_A)).toBe(77);
      await fx.dispose();
    });

    it('1g 跨 key 并发在途 flush：drain 等待全部结算（release 前不提前返回、不 abort、零重复发起）', async () => {
      const fx = makeFixture(LONG_SCHEDULE);
      const docs = [DOC_A, DOC_B, DOC_C];
      for (const docId of docs) {
        const handle = await fx.persistence.createDoc(ALICE, docId, makeDoc(docId, 1));
        handle.doc.getMap('ROOT').set('n', 77);
        await fx.persistence.saveDoc(handle);
      }
      const base = fx.probe.attempts;

      const hold = fx.probe.holdNextWrites(docs.length);
      await fx.scheduler.advanceBy(60_000);
      await withTimeout(hold.entered, 2_000, 'three concurrent flushes to enter pre-commit hold');
      expect(fx.probe.attempts - base).toBe(docs.length);

      let drainSettled = false;
      const draining = asDrain(fx.persistence).drain().then(() => { drainSettled = true; });
      void draining.catch(() => {});
      await drainMicrotasks();
      expect(drainSettled).toBe(false); // 三个在途写未结算 → drain 不得返回
      expect(fx.probe.attempts - base).toBe(docs.length); // single-flight per key：零重复发起

      hold.release();
      await withTimeout(draining, 2_000, 'drain after three in-flight flushes settle');
      for (const docId of docs) {
        expect(await committedN(fx.makeFresh(), ALICE, docId)).toBe(77); // 未被 abort：全部提交
      }
      await fx.dispose();
    });
  });
}

// ══════════ §2 retryDelayMs 解耦（Memory/File 共享矩阵；基线红 = 配置被忽略） ══════════

for (const [adapterName, makeFixture] of Object.entries(adapterMatrix)) {
  describe(`§2 retryDelayMs 解耦契约（${adapterName}；基线红 = retryDelayMs 被静默忽略）`, () => {
    it('2a 显式 retryDelayMs：瞬时 write 失败后重试基准 = retryDelayMs（与 debounceMs 正交）', async () => {
      const fx = makeFixture({ debounceMs: 60_000, maxDirtyMs: 300_000, retryDelayMs: 200 });
      const handle = await fx.persistence.createDoc(ALICE, DOC_A, makeDoc(DOC_A, 1));
      handle.doc.getMap('ROOT').set('n', 77);
      await fx.persistence.saveDoc(handle);
      const base = fx.probe.attempts;

      fx.probe.failNextWrites(1, new Error('transient io.write failure'));
      await fx.scheduler.advanceBy(60_000); // debounce（60s）到点 → 首次 flush 失败
      await withTimeout(fx.probe.whenSettled(base + 1), 2_000, 'first flush to fail');
      await drainMicrotasks();
      expect(fx.probe.attempts - base).toBe(1);
      expect(await committedN(fx.makeFresh(), ALICE, DOC_A)).toBe(1); // 尚未落盘

      await fx.scheduler.advanceBy(199); // retryDelayMs=200 未到（基线 = 需要再等 60000）
      await drainMicrotasks();
      expect(fx.probe.attempts - base).toBe(1);

      await fx.scheduler.advanceBy(1); // 回退到点 → 重试成功落盘
      // 目标断言先行（基线在此处即为清晰断言红：retryDelayMs 被忽略 → 窗口内零重试），
      // 结算屏障仅用于绿路径的真实 I/O 等待（File），不作为红判据。
      expect(fx.probe.attempts - base).toBe(2);
      await withTimeout(fx.probe.whenSettled(base + 2), 2_000, 'retry flush to settle');
      await drainMicrotasks();
      expect(await committedN(fx.makeFresh(), ALICE, DOC_A)).toBe(77);
      await fx.dispose();
    });

    it('2b 负控（缺省保持现行为，预期绿）：未配置 retryDelayMs 时重试基准仍 = debounceMs', async () => {
      const fx = makeFixture({ debounceMs: 40, maxDirtyMs: 1_000 });
      const handle = await fx.persistence.createDoc(ALICE, DOC_A, makeDoc(DOC_A, 1));
      handle.doc.getMap('ROOT').set('n', 77);
      await fx.persistence.saveDoc(handle);
      const base = fx.probe.attempts;

      fx.probe.failNextWrites(1, new Error('transient io.write failure'));
      await fx.scheduler.advanceBy(40); // debounce 到点 → 失败
      await withTimeout(fx.probe.whenSettled(base + 1), 2_000, 'first flush to fail');
      await drainMicrotasks();
      expect(fx.probe.attempts - base).toBe(1);

      await fx.scheduler.advanceBy(39); // 40ms 回退窗未到
      await drainMicrotasks();
      expect(fx.probe.attempts - base).toBe(1);

      await fx.scheduler.advanceBy(1); // 缺省回退基准 = debounceMs=40 → 重试成功
      await withTimeout(fx.probe.whenSettled(base + 2), 2_000, 'default retry flush to settle');
      await drainMicrotasks();
      expect(fx.probe.attempts - base).toBe(2);
      expect(await committedN(fx.makeFresh(), ALICE, DOC_A)).toBe(77);
      await fx.dispose();
    });

    it('2c 退避增长与上限保持：基准 = retryDelayMs、×2 增长、cap = maxDirtyMs（ADR-0006 §79 退避上限）', async () => {
      const fx = makeFixture({ debounceMs: 50, maxDirtyMs: 350, retryDelayMs: 100 });
      const handle = await fx.persistence.createDoc(ALICE, DOC_A, makeDoc(DOC_A, 1));
      handle.doc.getMap('ROOT').set('n', 77);
      await fx.persistence.saveDoc(handle);
      const base = fx.probe.attempts;

      fx.probe.failNextWrites(999, new Error('store down (bounded window)'));
      await fx.scheduler.advanceBy(50); // t=50 debounce → 尝试 #1 失败
      await withTimeout(fx.probe.whenSettled(base + 1), 2_000, 'attempt #1 to settle');
      await drainMicrotasks();
      expect(fx.probe.attempts - base).toBe(1);

      await fx.scheduler.advanceBy(99); // t=149：+100 未到
      await drainMicrotasks();
      expect(fx.probe.attempts - base).toBe(1);

      await fx.scheduler.advanceBy(1); // t=150：+100 → 尝试 #2
      await withTimeout(fx.probe.whenSettled(base + 2), 2_000, 'attempt #2 to settle');
      await drainMicrotasks();
      expect(fx.probe.attempts - base).toBe(2);

      await fx.scheduler.advanceBy(199); // t=349：+200 未到
      await drainMicrotasks();
      expect(fx.probe.attempts - base).toBe(2);

      await fx.scheduler.advanceBy(1); // t=350：+200 → 尝试 #3
      await withTimeout(fx.probe.whenSettled(base + 3), 2_000, 'attempt #3 to settle');
      await drainMicrotasks();
      expect(fx.probe.attempts - base).toBe(3);

      await fx.scheduler.advanceBy(349); // t=699：+400 被 cap 到 maxDirtyMs=350
      await drainMicrotasks();
      expect(fx.probe.attempts - base).toBe(3);

      await fx.scheduler.advanceBy(1); // t=700：+350（cap）→ 尝试 #4
      await withTimeout(fx.probe.whenSettled(base + 4), 2_000, 'attempt #4 to settle');
      await drainMicrotasks();
      expect(fx.probe.attempts - base).toBe(4);
      await fx.dispose();
    });
  });
}

// ═════════════════ §3 保持性守卫（基线已满足，预期保持绿） ═════════════════

describe('§3 保持性守卫（基线已满足，预期绿）', () => {
  it('3a 缺省 schedule 常量与解析结果不变（既有 debounce/maxDirty 纪律零改动；retryDelayMs 为可选配置键）', () => {
    const defaults = resolvePersistenceSchedule({});
    expect(defaults.debounceMs).toBe(500);
    expect(defaults.maxDirtyMs).toBe(5_000);
    expect(resolvePersistenceSchedule({ debounceMs: 40, maxDirtyMs: 100 })).toMatchObject({
      debounceMs: 40,
      maxDirtyMs: 100,
    });
    // 新配置键被解析面接受（不 throw、不污染既有两键语义）；解析对象的键面形状
    // 由既有冻结审计（persistence-contract.test.ts:32-36）自行裁定——本契约只钉行为面。
    expect(() =>
      resolvePersistenceSchedule({ debounceMs: 60_000, maxDirtyMs: 300_000, retryDelayMs: 200 }),
    ).not.toThrow();
  });

  it('3b 缺省 schedule 的调度行为不变：debounce 到点即 flush、单飞 + generation 保序（既有语义零改动）', async () => {
    const fx = makeMemoryDrainFixture({});
    const handle = await fx.persistence.createDoc(ALICE, DOC_A, makeDoc(DOC_A, 1));
    handle.doc.getMap('ROOT').set('n', 7);
    await fx.persistence.saveDoc(handle);
    const base = fx.probe.attempts;

    await fx.scheduler.advanceBy(499); // 默认 debounceMs=500 未到
    await drainMicrotasks();
    expect(fx.probe.attempts - base).toBe(0);

    await fx.scheduler.advanceBy(1); // 到点 → 默认窗口落盘
    await withTimeout(fx.probe.whenSettled(base + 1), 2_000, 'default debounce flush to settle');
    await drainMicrotasks();
    expect(fx.probe.attempts - base).toBe(1);
    expect(await committedN(fx.makeFresh(), ALICE, DOC_A)).toBe(7);
    await fx.dispose();
  });

  it('3c drain 之外无未受协调的新增公开面：既有 createDoc/loadDoc/saveDoc/getStatus/dispose 行为不变', async () => {
    const fx = makeMemoryDrainFixture({ debounceMs: 1, maxDirtyMs: 5 });
    const handle = await fx.persistence.createDoc(ALICE, DOC_A, makeDoc(DOC_A, 1));
    const twin = await fx.persistence.loadDoc(ALICE, DOC_A);
    expect(twin).not.toBeNull();
    expect(twin!.doc).toBe(handle.doc); // 共享 live doc 契约（ADR 0006「共享 doc，独立 handle」）
    await twin!.release();
    const base = fx.probe.attempts;
    handle.doc.getMap('ROOT').set('n', 9);
    await fx.persistence.saveDoc(handle);
    await fx.scheduler.advanceBy(5);
    await withTimeout(fx.probe.whenSettled(base + 1), 2_000, 'flush to settle');
    await drainMicrotasks();
    expect(await committedN(fx.makeFresh(), ALICE, DOC_A)).toBe(9);
    await fx.dispose();
    expect((fx.persistence as unknown as { getStatus(): string }).getStatus()).toBe('disposed'); // dispose 语义不变
  });
});
