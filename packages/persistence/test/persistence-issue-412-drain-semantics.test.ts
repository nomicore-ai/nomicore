/**
 * issue #412（设计 §12 D-5 语义缺口锚定）——公开完成式排空 `drain()` 的补充语义：
 *
 * - **S-1** drain-after-dispose：`dispose()` 之后调用 `drain()` 为 vacuous 完成
 *   （立即 resolve、零 write——dispose 后无 live 脏状态可排空；与 dispose 幂等第二
 *   调用同族语义）；
 * - **S-2** drain 等待期内的再脏：等待屏障期间 `saveDoc` 再次登记脏状态 → drain
 *   重扫并强制 flush 后才 resolve（settle 语义不被早退击穿）；
 * - **S-3** drain 等待「degraded 回退窗」时并发 `deleteDoc`（零 handle）→ 驱逐路径
 *   释放 settle waiter（DD-5b 不变量「任何移除 live entry 的路径必须释放其 settle
 *   waiters」）→ drain resolve、不挂起、零热循环；
 * - **S-4** 目标集合边界（File）：不安全 target 沿既有 `validateIdentity` loud 拒绝
 *   （输入校验通道，非 store 失败面）；`targets: []` = no-op（零 write、脏状态保持）。
 *
 * 锚定纪律与 SA6 契约同源：真实 yjs / 真实 Memory·File adapter（真实 tmpdir、真实 fs
 * rename）、零 mock 本地服务、零源码 grep；fake scheduler 脚本化（零 real sleep）；
 * 竞态一律 `withTimeout`（挂起即失败）；故障注入仅经既有 `createPersistenceIoFaultSeam`
 * （around-seam，满足 PersistenceIO 契约）。
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  FilePersistence,
  createMemoryPersistence,
  type DocHandle,
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

const ALICE: User = Object.freeze({ userId: 'u-alice' });
const DOC_A = 'ns-drain-a';
const DOC_B = 'ns-drain-b';

/** 消费方「schedule 调长」场景（issue 问题 1 条件 2）——drain 必须跳过 debounce。 */
const LONG_SCHEDULE: Partial<PersistenceSchedule> = { debounceMs: 60_000, maxDirtyMs: 300_000 };

interface CountedIo {
  /** 经 `wrapIo` 观测到的 write 尝试计数（含 create 初始提交与每次 flush）。 */
  readonly attempts: number;
}

function makeCountingIo(): { counted: CountedIo; wrap(io: PersistenceIO): PersistenceIO } {
  let attempts = 0;
  return {
    counted: {
      get attempts() { return attempts; },
    },
    wrap(io) {
      return {
        read: (key, signal) => io.read(key, signal),
        write: (key, snapshot, signal) => {
          attempts += 1;
          return io.write(key, snapshot, signal);
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

/** drain 的可选参数目标（公开 key 词汇，设计 DD-4 冻结形状）。 */
type DrainTarget = Readonly<{ owner: User; docId: string }>;

interface DrainCapable {
  drain(targets?: readonly DrainTarget[]): Promise<void>;
}

function asDrain(persistence: DocPersistence): DocPersistence & DrainCapable {
  return persistence as unknown as DocPersistence & DrainCapable;
}

async function committedN(persistence: DocPersistence, owner: User, docId: string): Promise<unknown> {
  const handle = await persistence.loadDoc(owner, docId);
  if (handle === null) return null;
  const value = handle.doc.getMap('ROOT').get('n');
  await handle.release();
  return value;
}

interface SemanticsFixture {
  readonly adapterName: string;
  readonly persistence: DocPersistence;
  readonly scheduler: TestScheduler;
  readonly counted: CountedIo;
  readonly faults: PersistenceIoFaults;
  makeFresh(): DocPersistence;
  dispose(): Promise<void>;
}

function makeMemoryFixture(schedule: Partial<PersistenceSchedule>): SemanticsFixture {
  const store = new Map<string, Uint8Array>();
  const scheduler = createTestScheduler();
  const counting = makeCountingIo();
  const seam = createPersistenceIoFaultSeam();
  const writeSnapshot = async (key: string, snapshot: Uint8Array): Promise<void> => {
    store.set(key, snapshot.slice());
  };
  const readSnapshot = async (key: string): Promise<Uint8Array | undefined> => store.get(key);
  const deleteSnapshot = async (key: string): Promise<void> => { store.delete(key); };
  const persistence = createMemoryPersistence({
    scheduler,
    schedule,
    writeSnapshot,
    readSnapshot,
    deleteSnapshot,
    wrapIo: (io) => counting.wrap(seam.wrap(io)),
  } as MemoryPersistenceOptions);
  return {
    adapterName: 'MemoryPersistence',
    persistence,
    scheduler,
    counted: counting.counted,
    faults: seam.faults,
    makeFresh: () => createMemoryPersistence({
      scheduler: createTestScheduler(),
      schedule,
      writeSnapshot,
      readSnapshot,
    } as MemoryPersistenceOptions),    dispose: () => (persistence as unknown as { dispose(): Promise<void> }).dispose(),
  };
}

const fileRootDirs: string[] = [];

function makeFileFixture(schedule: Partial<PersistenceSchedule>): SemanticsFixture {
  const rootDir = path.join(
    os.tmpdir(),
    `nomicore-drain-sem-412-${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
  );
  fileRootDirs.push(rootDir);
  const scheduler = createTestScheduler();
  const counting = makeCountingIo();
  const seam = createPersistenceIoFaultSeam();
  const persistence = new FilePersistence({
    rootDir,
    scheduler,
    schedule,
    wrapIo: (io) => counting.wrap(seam.wrap(io)),
  });
  return {
    adapterName: 'FilePersistence',
    persistence,
    scheduler,
    counted: counting.counted,
    faults: seam.faults,
    makeFresh: () => new FilePersistence({ rootDir, scheduler: createTestScheduler() }),
    dispose: () => (persistence as unknown as { dispose(): Promise<void> }).dispose(),
  };
}

afterEach(async () => {
  await Promise.all(
    fileRootDirs.splice(0).map((root) => fsp.rm(root, { recursive: true, force: true })),
  );
});

const adapterMatrix: Record<string, (schedule: Partial<PersistenceSchedule>) => SemanticsFixture> = {
  MemoryPersistence: makeMemoryFixture,
  FilePersistence: makeFileFixture,
};

for (const [adapterName, makeFixture] of Object.entries(adapterMatrix)) {
  describe(`issue #412 drain 补充语义（${adapterName}）`, () => {
    it('S-1 drain-after-dispose 为 vacuous 完成：立即 resolve、零 write（dispose 后无 live 脏状态）', async () => {
      const fx = makeFixture(LONG_SCHEDULE);
      const handle = await fx.persistence.createDoc(ALICE, DOC_A, makeDoc(DOC_A, 1));
      handle.doc.getMap('ROOT').set('n', 77);
      await fx.persistence.saveDoc(handle); // 脏状态已登记（未落盘）
      await fx.dispose();
      const base = fx.counted.attempts;

      await withTimeout(asDrain(fx.persistence).drain(), 2_000, 'drain after dispose');
      await drainMicrotasks();
      expect(fx.counted.attempts - base).toBe(0); // vacuous：零 write
      expect(await committedN(fx.makeFresh(), ALICE, DOC_A)).toBe(1); // dispose 有损语义不变（未排空）
    });

    it('S-2 drain 等待期内的再脏被重扫吸收：第二次 saveDoc 的内容在 drain resolve 前落盘', async () => {
      const fx = makeFixture(LONG_SCHEDULE);
      const handle = await fx.persistence.createDoc(ALICE, DOC_A, makeDoc(DOC_A, 1));
      handle.doc.getMap('ROOT').set('n', 77);
      await fx.persistence.saveDoc(handle);
      const base = fx.counted.attempts;

      const hold = fx.faults.holdNextWriteBeforeCommit();
      let drainSettled = false;
      const draining = asDrain(fx.persistence).drain().then(() => { drainSettled = true; });
      await withTimeout(hold.entered, 2_000, 'forced flush to enter pre-commit hold');
      await drainMicrotasks();
      expect(drainSettled).toBe(false);

      // 等待屏障期间再脏（终扫观察之前）：新代际必须被重扫捕获并强制 flush。
      handle.doc.getMap('ROOT').set('n', 99);
      await fx.persistence.saveDoc(handle);
      hold.release();
      await withTimeout(draining, 2_000, 'drain after re-dirty during wait');

      expect(drainSettled).toBe(true);
      expect(fx.counted.attempts - base).toBe(2); // 第一代（被 hold 的）+ 重扫强制 flush 的第二代
      expect(await committedN(fx.makeFresh(), ALICE, DOC_A)).toBe(99);
      await fx.dispose();
    });

    it('S-3 drain 等待 degraded 回退窗时并发 deleteDoc：驱逐释放 settle waiter，drain resolve 不挂起', async () => {
      // 长回退窗：删除必须先于 retry 到点发生（确定性构造，无真实等待）。
      const fx = makeFixture({ debounceMs: 60_000, maxDirtyMs: 300_000, retryDelayMs: 50_000 });
      const handle: DocHandle = await fx.persistence.createDoc(ALICE, DOC_A, makeDoc(DOC_A, 1));
      handle.doc.getMap('ROOT').set('n', 77);
      await fx.persistence.saveDoc(handle);
      await handle.release(); // 零 handle：deleteDoc 前置条件
      const base = fx.counted.attempts;

      fx.faults.failNextWrite(new Error('store down (bounded window)'));
      let drainSettled = false;
      const draining = asDrain(fx.persistence).drain().then(() => { drainSettled = true; });
      await withTimeout(fx.scheduler.advanceBy(0), 2_000, 'scheduler flush tick');
      await drainMicrotasks();
      expect(fx.counted.attempts - base).toBe(1); // 强制 flush 恰一次（失败）→ retryTimer 武装
      expect(drainSettled).toBe(false); // 回退窗内 drain 被动等待

      const deleted = await fx.persistence.deleteDoc!(ALICE, DOC_A);
      expect(deleted).toEqual({ ok: true });
      await withTimeout(draining, 2_000, 'drain after concurrent deleteDoc evicts the live entry');
      expect(drainSettled).toBe(true);
      expect(fx.counted.attempts - base).toBe(1); // 回退窗内零热循环、删除零 write

      // 回退定时器已被删除路径取消：大幅推进零新尝试（无复活向量）。
      await fx.scheduler.advanceBy(1_000_000);
      await drainMicrotasks();
      expect(fx.counted.attempts - base).toBe(1);
      await fx.dispose();
    });

    it('S-4 targets 边界：`targets: []` = no-op（零 write、脏状态保持），零参形式排空全部', async () => {
      const fx = makeFixture(LONG_SCHEDULE);
      const handleA = await fx.persistence.createDoc(ALICE, DOC_A, makeDoc(DOC_A, 1));
      const handleB = await fx.persistence.createDoc(ALICE, DOC_B, makeDoc(DOC_B, 1));
      handleA.doc.getMap('ROOT').set('n', 77);
      handleB.doc.getMap('ROOT').set('n', 88);
      await fx.persistence.saveDoc(handleA);
      await fx.persistence.saveDoc(handleB);
      const base = fx.counted.attempts;

      await withTimeout(asDrain(fx.persistence).drain([]), 2_000, 'empty targets drain');
      expect(fx.counted.attempts - base).toBe(0); // 空目标集 = 无可排空对象
      expect(await committedN(fx.makeFresh(), ALICE, DOC_A)).toBe(1);
      expect(await committedN(fx.makeFresh(), ALICE, DOC_B)).toBe(1);

      // 缺席 target（无对应 live cell）亦为 no-op：缺席即完成。
      await withTimeout(
        asDrain(fx.persistence).drain([{ owner: ALICE, docId: 'ns-never-created' }]),
        2_000,
        'absent target drain',
      );
      expect(fx.counted.attempts - base).toBe(0);

      await withTimeout(asDrain(fx.persistence).drain(), 2_000, 'full drain');
      expect(fx.counted.attempts - base).toBe(2);
      expect(await committedN(fx.makeFresh(), ALICE, DOC_A)).toBe(77);
      expect(await committedN(fx.makeFresh(), ALICE, DOC_B)).toBe(88);
      await fx.dispose();
    });
  });
}

describe('issue #412 S-4 File target 输入校验（loud 通道，非 store 失败面）', () => {
  it('不安全 target（userId/namespaceId 违反 SAFE_PATH_SEGMENT）经 validateIdentity loud 拒绝', async () => {
    const rootDir = path.join(os.tmpdir(), `nomicore-drain-sem-412-unsafe-${process.pid}-${Date.now()}`);
    fileRootDirs.push(rootDir);
    const persistence = new FilePersistence({ rootDir, scheduler: createTestScheduler() });

    await expect(
      asDrain(persistence).drain([{ owner: { userId: 'U-Alice' }, docId: DOC_A }]),
    ).rejects.toThrow(/unsafe userId/);
    await expect(
      asDrain(persistence).drain([{ owner: ALICE, docId: 'NS_UPPER' }]),
    ).rejects.toThrow(/unsafe namespaceId/);

    // 合法 target 与零参形式零行为差异（校验纯为 loud 防御）。
    await withTimeout(asDrain(persistence).drain([{ owner: ALICE, docId: DOC_A }]), 2_000, 'safe target drain');
    await withTimeout(asDrain(persistence).drain(), 2_000, 'zero-arg drain');
    await persistence.dispose();
  });
});
