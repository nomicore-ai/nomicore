/**
 * issue #387（ADR 0030 T1）watchMap 无谓词形态垂直通路 —— lease 公共面红灯契约。
 *
 * 契约来源：
 * - issue #387 What-to-build + AC1–AC10（无谓词 tracer bullet）；
 * - `docs/adr/0030-change-subscription.md` §1 公共面 / §3 建立判定 / §4 通知流 /
 *   §5 判定纪律 / §6 分发 / §7 分层；
 * - spec #385（User Stories 6/7/8/13/17/18/19/20/25）；
 * - `wiki/raw/task_issue-387_sa6_contract.md` §12 绑定表 B-1–B-7。
 *
 * 红灯机理（HEAD `6df1c61`）：lease 恰 15 键、runtime 恰 14 键，均无 watchMap ——
 * 能力存在性断言红（`typeof lease.watchMap === 'undefined'` / 调用 TypeError）；
 * 其余用例因方法缺席不可达。负控（readData 恒四键 / 窗口读 / 载体码）同场保持绿。
 *
 * 断言纪律：全部断言锚定 lease 公共面运行时行为；成功形状逐键 toStrictEqual；
 * 建立失败经面中性归一后断言「响亮 + 稳定 code + message」（B-3/B-4）；异步分发以
 * sink 计数 + 屏障（另一订阅/后续事务的通知）等待，零 `setTimeout` 竞猜。
 */
import { describe, expect, it } from 'vitest';
import { expectReadDataOkKeys } from '../../namespace-runtime/test/helpers/readdata-ok-shape.js';
import {
  attemptEstablishWatch,
  establishWatch,
  NotificationSink,
  openSecondLease,
  openWatchLease,
} from './issue-387-watch-map-fixture.js';

// ───────────────────────── 契约常量 ─────────────────────────

/** ADR 0030 §3 逐字稳定码（载体系非键容器拒绝）。 */
const WATCH_MAP_CARRIER_MISMATCH = 'WATCH_MAP_CARRIER_MISMATCH';

/** ADR 0030 三 kind 通知词表（通知流零参数错误：kind 恒在此闭集内）。 */
const NOTIFICATION_KINDS = ['data', 'invalidate-all', 'watch-end'];

/** #369 窗口读后 lease 面既有 15 键（AC10 纯加法：全数保留 + watchMap 为新增）。 */
const LEASE_KEYS_BEFORE_WATCH_MAP = [
  'bumpReplicationEpoch',
  'enableReplication',
  'getActiveSchema',
  'getMetadata',
  'getSchema',
  'getStatus',
  'mutateData',
  'namespaceId',
  'openReplicationSession',
  'owner',
  'readArray',
  'readData',
  'readMap',
  'release',
  'replaceSchema',
];

/** 哨兵值：用于「信号不含值」断言的 payload 标记。 */
const SENTINEL = 'WATCH-SENTINEL-PAYLOAD';

// ───────────────────────── 断言助手 ─────────────────────────

const noop = (): void => {};

interface DataNotification {
  readonly kind: 'data';
  readonly origin: string;
  readonly changes: ReadonlyArray<{ readonly path: readonly (string | number)[]; readonly key: string }>;
}

/** data 通知形状：恰三键 `{kind,origin,changes}`；定位符恰两键 `{path,key}`。 */
function expectDataNotification(notification: unknown): DataNotification {
  expect(typeof notification).toBe('object');
  const record = notification as Record<string, unknown>;
  expect(Object.keys(record).sort()).toStrictEqual(['changes', 'kind', 'origin']);
  expect(record.kind).toBe('data');
  expect(typeof record.origin).toBe('string');
  const changes = record.changes as unknown[];
  expect(Array.isArray(changes)).toBe(true);
  for (const change of changes) {
    expect(Object.keys(change as object).sort()).toStrictEqual(['key', 'path']);
    expect(Array.isArray((change as { path: unknown }).path)).toBe(true);
    expect(typeof (change as { key: unknown }).key).toBe('string');
  }
  return record as unknown as DataNotification;
}

/** 通知流 kind 闭集（AC3「通知流零参数错误」：不存在 error/mismatch 一类参数错误 kind）。 */
function expectNotificationStreamKinds(sink: NotificationSink): void {
  for (const notification of sink.received) {
    const kind = (notification as { kind?: unknown }).kind;
    expect(
      typeof kind === 'string' && NOTIFICATION_KINDS.includes(kind),
      `通知流零参数错误：kind 必须 ∈ ${JSON.stringify(NOTIFICATION_KINDS)}，实际 ${JSON.stringify(kind)}`,
    ).toBe(true);
  }
}

/** 等待「指定 key 的 data 定位符」（本事务分发的确定性等待；不依赖计数残留）。 */
async function waitForDataKey(sink: NotificationSink, key: string): Promise<DataNotification> {
  await expect
    .poll(
      () => sink.dataNotifications().some((n) => n.changes.some((change) => change.key === key)),
      { interval: 5, timeout: 2_000 },
    )
    .toBe(true);
  const found = sink.dataNotifications().find((n) => n.changes.some((change) => change.key === key));
  expect(found).toBeDefined();
  return found as DataNotification;
}

// ───────────────────────── 用例 ─────────────────────────

describe('T1 能力存在性：lease 公共面 watchMap（ADR 0030 §1）', () => {
  it('lease 暴露 watchMap 公共方法（HEAD 实际 undefined）', async () => {
    const fixture = await openWatchLease();
    const leaseRecord = fixture.lease as unknown as Record<string, unknown>;
    expect(
      typeof leaseRecord.watchMap,
      '能力缺口：lease.watchMap 应为 lease 公共方法（ADR 0030 §1；issue #387 AC1）——HEAD 实际 undefined',
    ).toBe('function');
  });
});

describe('组 E（AC1/AC2/AC3）：建立判定矩阵 —— 全部由 active schema 完成', () => {
  it('E1 AC1：Y.Map 载体键容器建立成功，返回恰 `{unsubscribe}` 幂等句柄', async () => {
    const fixture = await openWatchLease();
    const outcome = attemptEstablishWatch(fixture.lease, ['tasks'], noop);
    expect(
      outcome.ok,
      `AC1：watchMap(['tasks']) 应建立成功（code=${outcome.ok ? '-' : outcome.code}）`,
    ).toBe(true);
    if (!outcome.ok) return;
    expect(Object.keys(outcome.handle).sort()).toStrictEqual(['unsubscribe']);
    expect(typeof outcome.handle.unsubscribe).toBe('function');
  });

  it('E2 AC1：封闭对象 Y.Map（meta）与 plain object 容器（tasks）均建立成功（对齐 readMap 载体面）', async () => {
    const ymapFixture = await openWatchLease();
    const metaRead = ymapFixture.lease.readMap(['meta'], { n: 10 });
    expect(
      metaRead.ok,
      '契约前提失败：封闭对象 Y.Map 应为键容器（readMap oracle 对齐，ADR 0030 §1）',
    ).toBe(true);
    expect(attemptEstablishWatch(ymapFixture.lease, ['meta'], noop).ok).toBe(true);

    const plainFixture = await openWatchLease({ plainTasksCarrier: true });
    const plainRead = plainFixture.lease.readMap(['tasks'], { n: 10 });
    expect(
      plainRead.ok,
      '契约前提失败：plain object 容器应为键容器（readMap oracle 对齐，ADR 0030 §1）',
    ).toBe(true);
    expect(
      attemptEstablishWatch(plainFixture.lease, ['tasks'], noop).ok,
      'AC1：plain object 容器（schema 声明键容器）应建立成功',
    ).toBe(true);
  });

  it('E3 AC1：数据缺席合法——未物化 ghost 与已删除 optionalTasks 均建立成功（订阅宽容等待）', async () => {
    const never = await openWatchLease();
    expect(
      attemptEstablishWatch(never.lease, ['ghost'], noop).ok,
      'AC1：schema 已声明但未物化的容器应建立成功（订阅是机制不是数据快照）',
    ).toBe(true);

    const deleted = await openWatchLease({ seedOptionalTasks: true });
    const before = deleted.lease.readMap(['optionalTasks'], { n: 10 });
    expect(before.ok, '契约前提失败：物化容器应可窗口读').toBe(true);
    const removed = await deleted.lease.mutateData({ op: 'delete', path: ['optionalTasks'] });
    expect(removed.ok, '契约前提失败：可选字段应可合法删除').toBe(true);
    const afterDelete = deleted.lease.readMap(['optionalTasks'], { n: 1 });
    expect(afterDelete.ok, '对偶锚：读对缺席响亮（WINDOW_TARGET_ABSENT）').toBe(false);
    expect(
      attemptEstablishWatch(deleted.lease, ['optionalTasks'], noop).ok,
      'AC1：已删除的 schema 声明容器应建立成功（读对缺席报错、订阅宽容等待）',
    ).toBe(true);
  });

  it('E4 AC2：无 active schema 的 namespace 整体拒绝（含无谓词形态）——schema-ready 同场对照', async () => {
    const control = await openWatchLease();
    expect(
      attemptEstablishWatch(control.lease, ['tasks'], noop).ok,
      '阳性对照：schema-ready namespace 应建立成功（否则拒绝断言不可判）',
    ).toBe(true);

    const fixture = await openWatchLease({ schemaText: null });
    expect(fixture.lease.getActiveSchema()).toBeNull();
    const outcome = attemptEstablishWatch(fixture.lease, ['tasks'], noop);
    expect(
      outcome.ok,
      'AC2：无 active schema 的 namespace 必须整体拒绝 watchMap（禁止静默建立；ADR 0030 §3）',
    ).toBe(false);
    if (outcome.ok) return;
    expect(typeof outcome.code).toBe('string');
    expect(outcome.code.length).toBeGreaterThan(0);
    expect(outcome.message.length).toBeGreaterThan(0);
  });

  it('E5 AC3：数组载体 / 根标量 / 偏离 schema → WATCH_MAP_CARRIER_MISMATCH，message 区分原因', async () => {
    const fixture = await openWatchLease();
    const outcomes = {
      数组载体: attemptEstablishWatch(fixture.lease, ['workRecords'], noop),
      根标量: attemptEstablishWatch(fixture.lease, ['title'], noop),
      偏离schema: attemptEstablishWatch(fixture.lease, ['nope'], noop),
    } as const;
    for (const [label, outcome] of Object.entries(outcomes)) {
      expect(outcome.ok, `AC3：${label} 应响亮拒绝`).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.code, `AC3：${label} 稳定码逐字 = WATCH_MAP_CARRIER_MISMATCH`).toBe(
        WATCH_MAP_CARRIER_MISMATCH,
      );
      expect(outcome.message.length, `AC3：${label} message 非空`).toBeGreaterThan(0);
    }
    if (!outcomes.数组载体.ok && !outcomes.偏离schema.ok) {
      expect(
        outcomes.数组载体.message,
        'AC3：message 区分原因（数组载体 vs 偏离 schema）',
      ).not.toBe(outcomes.偏离schema.message);
    }
  });

  it('E6 AC3：全部参数校验在建立时刻完成——建立后通知流零参数错误（kind 恒在三 kind 闭集）', async () => {
    const fixture = await openWatchLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['tasks'], sink.listener);
    const write = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: `${SENTINEL}-E6`, priority: 5 },
    });
    expect(write.ok).toBe(true);
    await sink.waitForCount(1);
    expectNotificationStreamKinds(sink);
  });
});

describe('组 N（AC4）：本地写定位信号 —— {path,key} 列表、不含值、可直接补拉', () => {
  it('N1 AC4：批量两键本地写 → 单条 data 通知（changes 定位符恰两键、origin local、不含值）', async () => {
    const fixture = await openWatchLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['tasks'], sink.listener);

    const write = await fixture.lease.mutateData({
      ops: [
        { op: 'set', path: ['tasks', 't3'], value: { title: `${SENTINEL}-T3`, priority: 5 } },
        { op: 'set', path: ['tasks', 't4'], value: { title: `${SENTINEL}-T4`, priority: 1 } },
      ],
    });
    expect(write.ok, '契约前提失败：批量信封应提交成功').toBe(true);
    await sink.waitForCount(1);
    expect(sink.received.length, 'AC5：一事务一通知——批量两键恰一条通知').toBe(1);

    const notification = expectDataNotification(sink.received[0]);
    expect(notification.origin, 'AC4：本地受控写 origin=local（ADR 0030 §4）').toBe('local');
    expect(notification.changes.length).toBe(2);
    for (const change of notification.changes) {
      expect(change.path, 'AC4：定位符 path = 订阅容器路径').toStrictEqual(['tasks']);
    }
    expect(notification.changes.map((change) => change.key).sort()).toStrictEqual(['t3', 't4']);

    const serialized = JSON.stringify(sink.received[0]);
    expect(serialized.includes(SENTINEL), 'AC4：通知不含值（信号 only——payload 哨兵不得出现在通知里）').toBe(false);
  });

  it('N2 AC4：定位符 [...path, key] 拼路径经 readData / 窗口读精准补拉（身份与窗口读条目同构）', async () => {
    const fixture = await openWatchLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['tasks'], sink.listener);

    const write = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: `${SENTINEL}-N2`, priority: 5 },
    });
    expect(write.ok).toBe(true);
    await sink.waitForCount(1);
    const notification = expectDataNotification(sink.received[0]);
    const change = notification.changes[0];
    expect(change).toBeDefined();
    if (change === undefined) return;

    const read = fixture.lease.readData([...change.path, change.key]);
    expect(read.ok, `AC4：定位符补拉路径 ${JSON.stringify([...change.path, change.key])} 应直接可读`).toBe(true);
    if (!read.ok) return;
    expect(read.value).toStrictEqual({ title: `${SENTINEL}-N2`, priority: 5 });

    const window = fixture.lease.readMap(['tasks'], { n: 10 });
    expect(window.ok).toBe(true);
    if (!window.ok) return;
    const entry = window.value.find((candidate) => candidate.key === change.key);
    expect(entry?.value, 'AC4：定位符身份与窗口读条目同构').toStrictEqual({
      title: `${SENTINEL}-N2`,
      priority: 5,
    });
  });

  it('N3 AC4：嵌套条目字段写 → 定位符归到条目 key，[...path,key] 仍直接可读', async () => {
    const fixture = await openWatchLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['tasks'], sink.listener);

    const write = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't1', 'title'],
      value: `${SENTINEL}-N3`,
    });
    expect(write.ok, '契约前提失败：嵌套字段写应提交成功').toBe(true);
    await sink.waitForCount(1);
    const notification = expectDataNotification(sink.received[0]);
    expect(notification.changes, 'AC4：嵌套字段变更的定位符归到条目 key（[...path,key] 可读）').toStrictEqual([
      { path: ['tasks'], key: 't1' },
    ]);
    const read = fixture.lease.readData(['tasks', 't1']);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect((read.value as { title?: unknown }).title).toBe(`${SENTINEL}-N3`);
  });

  it('N4 AC1/AC4：订阅未物化容器横跨创建——创建后条目写到达条目定位符', async () => {
    const fixture = await openWatchLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['ghost'], sink.listener);

    const created = await fixture.lease.mutateData({
      op: 'set',
      path: ['ghost'],
      value: { g1: { title: 'FIRST', priority: 1 } },
    });
    expect(created.ok, '契约前提失败：声明容器应可创建').toBe(true);
    // 创建事件本身的信号 kind 不钉（data / invalidate-all 属 T3/T4 编排）；
    // 承重断言 = 缺席期订阅在容器出现后仍交付条目定位符（ADR 0030 §4）。

    const appended = await fixture.lease.mutateData({
      op: 'set',
      path: ['ghost', 'g2'],
      value: { title: 'SECOND', priority: 2 },
    });
    expect(appended.ok).toBe(true);
    const notification = await waitForDataKey(sink, 'g2');
    expect(notification.changes).toContainEqual({ path: ['ghost'], key: 'g2' });
    const read = fixture.lease.readData(['ghost', 'g2']);
    expect(read.ok).toBe(true);
    expectNotificationStreamKinds(sink);
  });
});

describe('组 B（AC5）：一事务一通知与同 key 合并', () => {
  it('B1 AC5：同事务同 key 多次变更 → 合并为一条定位符', async () => {
    const fixture = await openWatchLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['tasks'], sink.listener);

    const write = await fixture.lease.mutateData({
      ops: [
        { op: 'set', path: ['tasks', 't1', 'title'], value: `${SENTINEL}-B1` },
        { op: 'set', path: ['tasks', 't1', 'priority'], value: 42 },
      ],
    });
    expect(write.ok, '契约前提失败：同条目兄弟路径批量应合法').toBe(true);
    await sink.waitForCount(1);
    expect(sink.received.length, 'AC5：同事务同 key 恰一条通知').toBe(1);
    const notification = expectDataNotification(sink.received[0]);
    expect(notification.changes, 'AC5：同事务同 key 合并为一条定位符').toStrictEqual([
      { path: ['tasks'], key: 't1' },
    ]);
  });

  it('B2 AC5：两次写 = 两事务 = 两条通知（FIFO、事务级原子）', async () => {
    const fixture = await openWatchLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['tasks'], sink.listener);

    const first = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: 'B2-FIRST', priority: 3 },
    });
    expect(first.ok).toBe(true);
    const second = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't4'],
      value: { title: 'B2-SECOND', priority: 4 },
    });
    expect(second.ok).toBe(true);
    await sink.waitForCount(2);
    expect(sink.received.length, 'AC5：两事务恰两条通知（不得跨事务合并）').toBe(2);
    const keys = sink.received.map((notification) =>
      expectDataNotification(notification)
        .changes.map((change) => change.key)
        .join(','),
    );
    expect(keys, 'AC5：通知 FIFO 与事务提交序一致').toStrictEqual(['t3', 't4']);
  });
});

describe('组 D（AC6）：分发在写序列器槽之外异步进行', () => {
  it('D1 AC6：事务提交后异步分发——mutateData 同步段内零回调', async () => {
    const fixture = await openWatchLease();
    let callbacksInSyncSegment = 0;
    establishWatch(fixture.lease, ['tasks'], () => {
      callbacksInSyncSegment += 1;
    });

    const pending = fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: 'D1', priority: 3 },
    });
    expect(
      callbacksInSyncSegment,
      'AC6：分发必须在写序列器槽之外异步进行——mutateData 同步段内零回调',
    ).toBe(0);
    const write = await pending;
    expect(write.ok).toBe(true);
  });

  it('D2 AC6：不阻塞后续写、回调内重入写可完成（槽内分发会死锁/拒绝）', async () => {
    const fixture = await openWatchLease();
    const sink = new NotificationSink();
    let reentrant: Promise<unknown> | undefined;
    establishWatch(fixture.lease, ['tasks'], (notification) => {
      sink.listener(notification);
      if (reentrant === undefined) {
        reentrant = fixture.lease.mutateData({
          op: 'set',
          path: ['tasks', 't8'],
          value: { title: 'D2-REENTRANT', priority: 8 },
        });
      }
    });

    const first = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't7'],
      value: { title: 'D2-FIRST', priority: 7 },
    });
    expect(first.ok).toBe(true);
    const second = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't6'],
      value: { title: 'D2-SECOND', priority: 6 },
    });
    expect(second.ok, 'AC6：分发不阻塞后续写').toBe(true);

    await expect
      .poll(() => sink.received.length, { interval: 5, timeout: 5_000 })
      .toBeGreaterThanOrEqual(3);
    expect(reentrant, 'AC6：回调内重入写应被接纳（分发在槽之外）').toBeDefined();
    if (reentrant !== undefined) {
      const reentrantResult = (await reentrant) as { ok?: unknown };
      expect(reentrantResult.ok).toBe(true);
    }
    await sink.waitForCount(3);
    expectNotificationStreamKinds(sink);
  });
});

describe('组 X（AC7）：订阅回调 throw 静默隔离', () => {
  it('X1 AC7：坏消费者不影响写结果、sequencer 行为与其他订阅', async () => {
    const fixture = await openWatchLease();
    const healthy = new NotificationSink();
    let throwingCalls = 0;
    establishWatch(fixture.lease, ['tasks'], () => {
      throwingCalls += 1;
      throw new Error(`${SENTINEL}-CALLBACK-BOOM`);
    });
    establishWatch(fixture.lease, ['tasks'], healthy.listener);

    const first = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: 'X1-FIRST', priority: 3 },
    });
    expect(first.ok, 'AC7：坏消费者不得改变写结果').toBe(true);
    await healthy.waitForCount(1);
    expect(throwingCalls, 'AC7：坏消费者被调用（隔离而非跳过）').toBeGreaterThanOrEqual(1);

    const second = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't4'],
      value: { title: 'X1-SECOND', priority: 4 },
    });
    expect(second.ok, 'AC7：坏消费者不得影响 sequencer 后续写').toBe(true);
    await healthy.waitForCount(2);
    expectNotificationStreamKinds(healthy);
  });
});

describe('组 L（AC8）：退订幂等与 lease 释放清理', () => {
  it('L1 AC8：主动 unsubscribe 幂等、不产生任何通知', async () => {
    const fixture = await openWatchLease();
    const removed = new NotificationSink();
    const alive = new NotificationSink();
    const handle = establishWatch(fixture.lease, ['tasks'], removed.listener);
    establishWatch(fixture.lease, ['tasks'], alive.listener);

    const first = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: 'L1-FIRST', priority: 3 },
    });
    expect(first.ok).toBe(true);
    await removed.waitForCount(1);
    await alive.waitForCount(1);

    handle.unsubscribe();
    handle.unsubscribe(); // 幂等：重复退订零 throw

    const second = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't4'],
      value: { title: 'L1-SECOND', priority: 4 },
    });
    expect(second.ok).toBe(true);
    await alive.waitForCount(2); // 屏障：该事务分发已完成
    expect(removed.received.length, 'AC8：退订后零通知').toBe(1);

    const third = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't5'],
      value: { title: 'L1-THIRD', priority: 5 },
    });
    expect(third.ok).toBe(true);
    await alive.waitForCount(3); // 第二屏障
    expect(removed.received.length).toBe(1);
  });

  it('L2 AC8：lease 释放自动清理全部订阅（零悬空回调）', async () => {
    const fixture = await openWatchLease();
    const releasedSink = new NotificationSink();
    const survivorSink = new NotificationSink();
    establishWatch(fixture.lease, ['tasks'], releasedSink.listener);
    const survivorLease = await openSecondLease(fixture);
    establishWatch(survivorLease, ['tasks'], survivorSink.listener);

    const crossLease = await survivorLease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: 'L2-CROSS', priority: 3 },
    });
    expect(crossLease.ok).toBe(true);
    await releasedSink.waitForCount(1); // 正控：同 namespace 本地写送达
    await survivorSink.waitForCount(1);

    await fixture.lease.release();
    expect(fixture.lease.getStatus().lease).toBe('released');

    const afterRelease = await survivorLease.mutateData({
      op: 'set',
      path: ['tasks', 't4'],
      value: { title: 'L2-AFTER-RELEASE', priority: 4 },
    });
    expect(afterRelease.ok).toBe(true);
    await survivorSink.waitForCount(2); // 屏障：该事务分发已完成
    expect(releasedSink.received.length, 'AC8：lease 释放后订阅零通知').toBe(1);

    const secondAfterRelease = await survivorLease.mutateData({
      op: 'set',
      path: ['tasks', 't5'],
      value: { title: 'L2-SECOND-AFTER-RELEASE', priority: 5 },
    });
    expect(secondAfterRelease.ok).toBe(true);
    await survivorSink.waitForCount(3); // 第二屏障
    expect(releasedSink.received.length).toBe(1);
  });
});

describe('公共面纯加法（AC10，旧实现红）与负控（NC，必须常绿）', () => {
  it('P1 AC10：lease 面纯加法——既有 15 键全数保留 + watchMap 为唯一新增键', async () => {
    const fixture = await openWatchLease();
    const keys = Object.keys(fixture.lease).sort();
    expect(keys).toStrictEqual([...LEASE_KEYS_BEFORE_WATCH_MAP, 'watchMap'].sort());
    const leaseRecord = fixture.lease as unknown as Record<string, unknown>;
    for (const legacy of LEASE_KEYS_BEFORE_WATCH_MAP) {
      expect(legacy in leaseRecord, `AC10：既有键 ${legacy} 必须保留`).toBe(true);
    }
    expect(typeof leaseRecord.readData).toBe('function');
    expect(typeof leaseRecord.readMap).toBe('function');
    expect(typeof leaseRecord.readArray).toBe('function');
    expect(typeof leaseRecord.release).toBe('function');
  });

  it('NC1：既有读面 / 窗口读 / 复制面零改动（冻结面健康；HEAD 即绿）', async () => {
    const fixture = await openWatchLease();
    const read = fixture.lease.readData(['tasks']);
    expect(read.ok).toBe(true);
    if (read.ok) {
      // 形状断言集中化（issue #333 T0 / #336 T3 / #364 验收门）——不得内联四键字面量。
      expectReadDataOkKeys(read);
      expect(typeof read.schema).toBe('string');
      expect(read.truncated).toBe(false);
    }
    const window = fixture.lease.readMap(['tasks'], { n: 2, orderBy: { by: 'key' } });
    expect(window.ok).toBe(true);
    const mismatch = fixture.lease.readMap(['workRecords'], { n: 1 });
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) {
      expect(mismatch.code, '窗口读载体码零改动').toBe('WINDOW_CARRIER_MISMATCH');
    }
    expect(fixture.lease.getStatus().lease).toBe('active');
  });

  it('P2：写失败零通知（无效写不产生悬空信号）', async () => {
    const fixture = await openWatchLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['tasks'], sink.listener);
    const invalid = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 'bad'],
      value: { title: 1 },
    });
    expect(invalid.ok).toBe(false);
    // 屏障：之后一次合法写仍到达 → 若无效写曾派发通知，计数已可见
    const valid = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: 'NC3-VALID', priority: 3 },
    });
    expect(valid.ok).toBe(true);
    await sink.waitForCount(1);
    expect(sink.received.length, '无效写零通知（一事务一通知的反面）').toBe(1);
    const notification = expectDataNotification(sink.received[0]);
    expect(notification.changes.map((change) => change.key)).toStrictEqual(['t3']);
  });
});
