/**
 * issue #412 / DD-7 端到端停机链验收（设计 §12 S-5a/S-5b/S-5c）——
 * 「dispose 之前必须先 await drain」停机硬契约（Owner 评论 5751613018，ADR 0006 修订节）：
 *
 * - **S-5a**（健康 store，file 配置）：停机前排空步把固定睡眠替换为**完成式排空**——
 *   停机前写入的 dirty 已在 step 3 由 `adapter.drain()` 强制 flush 落盘；`stop()` 远小于
 *   排空预算返回（固定睡眠已消失）；四事件序保持、无预算事件；
 * - **S-5b**（degraded store，file 配置）：以确定性持续写失败注入（`{rootDir}/users/
 *   {owner}/{nsId}.snapshot.tmp` 预置**目录** → 每次写尝试 EISDIR，非瞬态）制造 degraded；
 *   `stop()` 在预算内收口（withTimeout 包裹，挂起即失败）→ `persistence-drain-budget-
 *   exceeded{budgetMs}` 诚实事件先于 `persistence-disposed` → 四事件序完整、无
 *   `app-stop-failed`；有损事实诚实（新实例见旧 committed 快照 = dispose abortive 冻结
 *   语义；事件已预告）；
 * - **S-5c**（memory 配置，SA2-7 统一路径验收）：`MemoryPersistence.prototype.drain` 经
 *   barrel 公共类原型面 spy → drain 恰被调用一次（单一停机链）且严格先于
 *   `persistence-disposed`（硬契约时序锚）、无预算事件、`stop()` 正常 resolve。
 *
 * 纪律：真实 `createNomicoreApp` 组合根 + 真实 File/Memory adapter + 真实 fs；零 mock 被
 * 测对象（唯一包装面 = memory 路径的公共类原型 spy 与既有 emitter seam）；零源码字符串
 * 断言；全部有界等待（`withTimeout` / 既有 10ms 步进轮询）。
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { FilePersistence, MemoryPersistence, type PersistenceDrainTarget } from '@nomicore/persistence';
import { createTestScheduler, withTimeout } from '@nomicore/persistence/testing';
import { HUB_OWNER, startHubApp, type HubHarness } from './issue270-contract-support.ts';

/** 停机四事件冻结序（ADR 0006 / hub-peer-deployment.md；issue #270 回归锚同款）。 */
const TEARDOWN_SEQUENCE = [
  'replication-drained',
  'registry-stopped',
  'persistence-disposed',
  'app-stopped',
] as const;

const BUDGET_EXCEEDED = 'persistence-drain-budget-exceeded';

function assertTeardownOrder(hub: HubHarness): void {
  const indexes = TEARDOWN_SEQUENCE.map((event) => hub.sink.indexOf(event));
  expect(indexes.every((index) => index >= 0), `四事件齐全：${JSON.stringify(hub.sink.names())}`).toBe(true);
  const [iReplication = -1, iRegistry = -1, iPersistence = -1, iApp = -1] = indexes;
  expect(
    iReplication < iRegistry && iRegistry < iPersistence && iPersistence < iApp,
    `拆卸链事件序严格递增：${JSON.stringify(indexes)}（${JSON.stringify(hub.sink.names())}）`,
  ).toBe(true);
}

/** 经**新实例**读 committed snapshot（落盘事实唯一权威面；不读 live cache）。 */
async function readPersistedN(rootDir: string, namespaceId: string): Promise<unknown> {
  const fresh = new FilePersistence({ rootDir, scheduler: createTestScheduler() });
  try {
    const handle = await withTimeout(
      fresh.loadDoc({ userId: HUB_OWNER }, namespaceId),
      5_000,
      'fresh FilePersistence instance loadDoc',
    );
    if (handle === null) throw new Error('fresh instance: committed snapshot missing');
    const value = handle.doc.getMap('ROOT').get('n');
    await handle.release();
    return value;
  } finally {
    await fresh.dispose();
  }
}

describe('issue #412 S-5a：健康 store（file）停机链 = 有界完成式排空（固定睡眠已消失）', () => {
  it('step 3 drain 强制 flush 停机前 dirty 写；stop() 远小于预算；四事件序保持；无预算事件', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'sa3-412-s5a-'));
    // 大 schedule 是确定性装置：debounce/maxDirty 定时器都在 +5000ms（远超 stop 时长），
    // 因此落盘只可能来自 step 3 的强制完成式 flush——旧固定睡眠实现（maxDirtyMs+500 =
    // 5500ms）会先被 withTimeout 击穿。预算 = 5500ms < 60s watchdog。
    const hub = await startHubApp({
      fileRootDir: rootDir,
      provision: true,
      schedule: { debounceMs: 5_000, maxDirtyMs: 5_000 },
    });
    try {
      const namespaceId = hub.provisionedNamespaceId;
      expect(namespaceId, 'provision 条目必须创建 namespace').toBeDefined();
      const nsId = namespaceId as string;

      const written = await hub.app.handleControlLine(
        JSON.stringify({ op: 'verify-write', namespaceId: nsId, set: ['n'], value: 77 }),
      );
      expect(written).toMatchObject({ ok: true });

      const started = Date.now();
      await withTimeout(hub.stop(), 3_000, 'bounded completion drain during stop');
      const elapsedMs = Date.now() - started;

      // 完成式：远小于预算（5500ms）——固定睡眠已消失（旧实现 ≥ 5500ms）。
      expect(
        elapsedMs,
        `stop() 必须远小于排空预算返回（完成式 drain），实际 ${elapsedMs}ms`,
      ).toBeLessThan(450);
      // 落盘事实：停机前 ACK 的 77 已在新实例可见（drain 强制 flush，非定时器）。
      expect(await readPersistedN(rootDir, nsId)).toBe(77);
      // 健康 store 排空完成式返回：不发射预算事件。
      expect(hub.sink.countOf(BUDGET_EXCEEDED)).toBe(0);
      expect(hub.sink.countOf('app-stop-failed')).toBe(0);
      assertTeardownOrder(hub);
    } finally {
      await hub.app.stop().catch(() => undefined);
      rmSync(rootDir, { recursive: true, force: true });
    }
  }, 30_000);
});

describe('issue #412 S-5b：degraded store（file）停机链 = 预算内收口 + 诚实降级 + 有损可观察', () => {
  it('持续写失败 → stop() 预算内返回、persistence-drain-budget-exceeded 先于 dispose、四事件序完整、旧快照可见', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'sa3-412-s5b-'));
    // debounceMs=1000 是确定性装置：首次 flush 不可能在预置故障目录之前发生（dirty 登记
    // 到 mkdir 之间 <1ms），且失败后的首重试（基准 = debounceMs）落在预算（520ms）之外
    // → 预算尽路径确定可复现（无 timing 竞争）。
    const hub = await startHubApp({
      fileRootDir: rootDir,
      provision: true,
      schedule: { debounceMs: 1_000, maxDirtyMs: 20 },
    });
    try {
      const namespaceId = hub.provisionedNamespaceId;
      expect(namespaceId, 'provision 条目必须创建 namespace').toBeDefined();
      const nsId = namespaceId as string;

      // 停机前写入（dirty 已 ACK）：open 的 loadDoc 已完成读路径（快照存在）。
      const written = await hub.app.handleControlLine(
        JSON.stringify({ op: 'verify-write', namespaceId: nsId, set: ['n'], value: 77 }),
      );
      expect(written).toMatchObject({ ok: true });

      // 确定性持续写失败注入：tmp 暂存路径预置目录 → 每次 writeFile(tmpPath) EISDIR。
      const tmpPath = join(rootDir, 'users', HUB_OWNER, `${nsId}.snapshot.tmp`);
      mkdirSync(tmpPath, { recursive: true });

      const started = Date.now();
      await withTimeout(hub.stop(), 3_000, 'bounded stop under degraded store (budget 520ms)');
      const elapsedMs = Date.now() - started;

      // 预算内收口（挂起即失败）；且确实消耗了预算（drain 未提前返回——脏状态未提交）。
      expect(elapsedMs, `degraded 停机必须在预算内收口，实际 ${elapsedMs}ms`).toBeGreaterThanOrEqual(500);
      expect(elapsedMs).toBeLessThan(3_000);

      const budgetIndex = hub.sink.indexOf(BUDGET_EXCEEDED);
      expect(budgetIndex, `预算尽必须是可观察事实：${JSON.stringify(hub.sink.names())}`).toBeGreaterThanOrEqual(0);
      const budgetEvent = hub.sink.events[budgetIndex] as { budgetMs?: number };
      expect(budgetEvent.budgetMs).toBe(520); // maxDirtyMs(20) + DRAIN_MARGIN_MS(500)
      expect(budgetIndex).toBeLessThan(hub.sink.indexOf('persistence-disposed')); // 事件先于有损 dispose
      expect(hub.sink.countOf('app-stop-failed')).toBe(0);
      assertTeardownOrder(hub);

      // 有损事实诚实：写从未提交（tmp 路径仍被目录占据）；新实例见旧 committed 快照。
      expect(existsSync(tmpPath)).toBe(true);
      expect(await readPersistedN(rootDir, nsId)).toBeUndefined(); // 77 丢失（事件已预告）
    } finally {
      await hub.app.stop().catch(() => undefined);
      rmSync(rootDir, { recursive: true, force: true });
    }
  }, 30_000);
});

describe('issue #412 S-5c：memory 配置统一路径（SA2-7）——drain 恰一次且严格先于 persistence-disposed', () => {
  it('memory 停机链经公共类原型面执行 drain：一次、先于 dispose、无预算事件、stop 正常 resolve', async () => {
    const drainCalls: Array<Readonly<{ eventsBefore: readonly string[]; targets: unknown }>> = [];
    let hub: HubHarness | undefined;
    const original = MemoryPersistence.prototype.drain;
    const spy = vi
      .spyOn(MemoryPersistence.prototype, 'drain')
      .mockImplementation(async function (
        this: MemoryPersistence,
        targets?: readonly PersistenceDrainTarget[],
      ): Promise<void> {
        drainCalls.push({
          // drain 调用时刻的事件面快照（硬契约时序锚：此刻 persistence-disposed 未发射）。
          eventsBefore: hub?.sink.names() ?? [],
          targets,
        });
        return await original.call(this, targets);
      });

    hub = await startHubApp({ provision: true }); // memory 配置（无 fileRootDir）
    try {
      const namespaceId = hub.provisionedNamespaceId as string;
      const written = await hub.app.handleControlLine(
        JSON.stringify({ op: 'verify-write', namespaceId, set: ['n'], value: 7 }),
      );
      expect(written).toMatchObject({ ok: true });

      await withTimeout(hub.stop(), 5_000, 'memory stop with unified drain step');
      await hub.stop(); // 幂等：不得触发第二条拆卸链 / 第二次 drain

      expect(drainCalls.length, 'drain 恰被调用一次（单一停机链）').toBe(1);
      expect(drainCalls[0]?.targets, '零参全量排空（app 不传 targets）').toBeUndefined();
      expect(spy.mock.instances[0]).toBeInstanceOf(MemoryPersistence);

      const eventsBeforeDrain = drainCalls[0]?.eventsBefore ?? [];
      const disposedIndex = hub.sink.indexOf('persistence-disposed');
      expect(disposedIndex).toBeGreaterThanOrEqual(0);
      // 硬契约时序：drain 调用时刻 persistence-disposed 尚未发射。
      expect(eventsBeforeDrain).not.toContain('persistence-disposed');
      expect(eventsBeforeDrain.length).toBeLessThanOrEqual(disposedIndex);
      // memory drain 即时完成：无预算事件；四事件序完整；无停机失败。
      expect(hub.sink.countOf(BUDGET_EXCEEDED)).toBe(0);
      expect(hub.sink.countOf('app-stop-failed')).toBe(0);
      assertTeardownOrder(hub);
    } finally {
      await hub.app.stop().catch(() => undefined);
      spy.mockRestore();
    }
  }, 30_000);
});
