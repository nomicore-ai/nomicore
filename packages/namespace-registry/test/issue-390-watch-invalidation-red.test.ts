/**
 * issue #390（ADR 0030 T4）溢出降级与父路径删除 —— lease 公共面行为红灯契约。
 *
 * 契约来源：
 * - issue #390 What-to-build + AC1–AC6；
 * - `docs/adr/0030-change-subscription.md` §4（三 kind 冻结形状 / `invalidate-all` 触发源
 *   与订阅存活）/ §6（有界队列 + 数值治理 + 事务级原子 + 槽外分发）/ 验收缝（L94
 *   testing 工厂注入小上限）；
 * - `wiki/raw/task_issue-390_sa6_contract.md` §12 绑定表 B-1–B-7 与用例映射 A1–A9/NC1–NC6；
 * - `wiki/raw/task_issue-390_design.md` §7-D3/D4/D7、§12。
 *
 * 红灯机理（HEAD `28faeae`）：
 * ① 父路径删除 / 祖先删除 / 容器整替 / 同事务批量删 = 零失效信号（raw 事件在场但编排
 *    缺席——SA6 G-1..G-4；本文件 A3/A3b/A4/A5 红）；
 * ② `watchQueueCapacity` 注入位缺席（类型面 TS2353 + 运行面字段被忽略）⇒ 溢出验收不可达
 *    （SA6 G-5；本文件 A2/A7 红，NC1 反伪绿对照）。
 * AC4（A6）与 A8/A9/NC1–NC6 属基线绿回归边界，实现后必须保持绿（不得伪称红灯）。
 *
 * 断言纪律（SA6 §12.5）：零 skip/only/todo、零源码字符串断言、零通知断言带同订阅后续写
 * 屏障、精确 `toStrictEqual` 形状、注入只经既有 testing 工厂 overrides（本文件只
 * import `@nomicore/namespace-registry` 与 `@nomicore/namespace-registry/testing`）。
 */
import { describe, expect, it } from 'vitest';
import {
  establishWatch,
  NotificationSink,
  openWatchLease,
  WATCH_QUEUE_CAPACITY_INJECTED,
  writeAndAwaitData,
} from './issue-390-watch-invalidation-fixture.js';

// ───────────────────────── 契约常量 ─────────────────────────

/** ADR 0030 §4 三 kind 通知词表（通知流零参数错误：kind 恒在此闭集内）。 */
const NOTIFICATION_KINDS = ['data', 'invalidate-all', 'watch-end'];

/** AC2/AC3 逐字形状：`invalidate-all` 恰两键、origin 两态。 */
const INVALIDATE_ALL_LOCAL = { kind: 'invalidate-all', origin: 'local' };

/** AC1/A8：lease 公共面 16 键（#387 T1 纯加法后；容量数值不在其中）。 */
const LEASE_KEYS = [
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
  'watchMap',
];

// ───────────────────────── 断言助手 ─────────────────────────

function task(title: string, priority: number): { readonly title: string; readonly priority: number } {
  return { title, priority };
}

/** 通知流 kind 闭集（零参数错误 kind）。 */
function expectNotificationKindsClosed(sink: NotificationSink): void {
  for (const kind of sink.kinds()) {
    expect(
      NOTIFICATION_KINDS.includes(kind),
      `通知流零参数错误：kind 必须 ∈ ${JSON.stringify(NOTIFICATION_KINDS)}，实际 ${JSON.stringify(kind)}`,
    ).toBe(true);
  }
}

/** data 通知形状：恰三键 `{kind,origin,changes}`；定位符恰两键 `{path,key}`。 */
function expectDataShape(notification: unknown): void {
  const record = notification as Record<string, unknown>;
  expect(Object.keys(record).sort(), 'A9：data 恰三键 {kind,origin,changes}').toStrictEqual([
    'changes',
    'kind',
    'origin',
  ]);
  expect(record.kind).toBe('data');
  const changes = record.changes as unknown[];
  expect(Array.isArray(changes)).toBe(true);
  for (const change of changes) {
    expect(Object.keys(change as object).sort(), 'A9：定位符恰两键 {path,key}').toStrictEqual([
      'key',
      'path',
    ]);
  }
}

// ───────────────────────── A 组：容量注入与溢出降级（AC1/AC2/AC5/AC6） ─────────────────────────

describe('A 组（AC1/AC2/AC5/AC6）：有界队列溢出 → 显式降级 invalidate-all 且订阅存活', () => {
  it('A1/A2 AC1/AC2/AC5：注入 capacity=1 + 同同步段两次未 await 写 → 恰一条两键 invalidate-all、订阅存活自愈', async () => {
    const fixture = await openWatchLease({ watchQueueCapacity: WATCH_QUEUE_CAPACITY_INJECTED });
    const sink = new NotificationSink();
    let syncCallbacks = 0;
    establishWatch(fixture.lease, ['tasks'], (notification) => {
      syncCallbacks += 1;
      sink.listener(notification);
    });

    // B-2 触发模式：同一同步段两次 un-awaited 合法条目写（两次提交必先于首次投递）。
    const pendingA = fixture.lease.mutateData({ op: 'set', path: ['tasks', 'x1'], value: task('x1', 1) });
    const pendingB = fixture.lease.mutateData({ op: 'set', path: ['tasks', 'x2'], value: task('x2', 2) });
    expect(syncCallbacks, 'AC6：同步段零回调（B-2 前提——分发不在写序列器槽内）').toBe(0);
    const [first, second] = await Promise.all([pendingA, pendingB]);
    expect(first.ok, 'AC6：溢出触发写不得被通知面阻塞').toBe(true);
    expect(second.ok, 'AC6：溢出触发写不得被通知面阻塞').toBe(true);

    await sink.waitForInvalidateAll(5_000);
    expect(
      sink.invalidateAllNotifications().length,
      'AC2：注入 capacity=1 时第二次入队必见满 → 溢出降级恰一条',
    ).toBe(1);
    expect(
      sink.invalidateAllNotifications()[0],
      'AC2/AC5：降级信号恰两键 {kind,origin}、origin=触发事务 origin=local（注入位被真正消费）',
    ).toStrictEqual(INVALIDATE_ALL_LOCAL);
    expect(
      sink.dataNotifications().length,
      'AC2：溢出前在队未投递 data 被降级信号清队（B-7），恰零条 data 越过降级信号',
    ).toBe(0);

    // AC2 自愈：订阅存活（零重建）——后续写照常以 data 到达。
    await writeAndAwaitData(
      fixture.lease,
      sink,
      { op: 'set', path: ['tasks', 'x3'], value: task('x3', 3) },
      'x3',
    );
    expect(sink.invalidateAllNotifications().length, 'AC2：自愈后不再叠加失效信号').toBe(1);
    expect(sink.kinds(), 'AC2/AC3：订阅存活——零 watch-end').not.toContain('watch-end');
    expectNotificationKindsClosed(sink);
  });

  it('A7 AC6：溢出降级不阻塞写路径——写均 ok:true、后续写照常完成、kind 闭集', async () => {
    const fixture = await openWatchLease({ watchQueueCapacity: WATCH_QUEUE_CAPACITY_INJECTED });
    const sink = new NotificationSink();
    let syncCallbacks = 0;
    establishWatch(fixture.lease, ['tasks'], (notification) => {
      syncCallbacks += 1;
      sink.listener(notification);
    });

    const pendingA = fixture.lease.mutateData({ op: 'set', path: ['tasks', 'y1'], value: task('y1', 1) });
    const pendingB = fixture.lease.mutateData({ op: 'set', path: ['tasks', 'y2'], value: task('y2', 2) });
    expect(
      syncCallbacks,
      'AC6：同步段零回调（降级信号的分发同样在写序列器槽之外——不阻塞写路径）',
    ).toBe(0);
    const [first, second] = await Promise.all([pendingA, pendingB]);
    expect([first.ok, second.ok], 'AC6：降级不改变写结果（两写均受理）').toStrictEqual([true, true]);

    await sink.waitForInvalidateAll(5_000);
    const healed = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 'y3'],
      value: task('y3', 3),
    });
    expect(healed.ok, 'AC6：降级后写路径照常接纳（溢出零阻塞）').toBe(true);
    await sink.waitForDataKey('y3');

    expect(sink.invalidateAllNotifications().length).toBe(1);
    expectNotificationKindsClosed(sink);
    expect(sink.kinds()).not.toContain('watch-end');
  });

  it('NC1 反伪绿：同一触发模式但不注入容量 → 两条 data、零失效信号（断言对注入敏感）', async () => {
    const fixture = await openWatchLease(); // 缺省 = runtime 实现常量（数值不进契约）
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['tasks'], sink.listener);

    const pendingA = fixture.lease.mutateData({ op: 'set', path: ['tasks', 'x1'], value: task('x1', 1) });
    const pendingB = fixture.lease.mutateData({ op: 'set', path: ['tasks', 'x2'], value: task('x2', 2) });
    const [first, second] = await Promise.all([pendingA, pendingB]);
    expect(first.ok && second.ok).toBe(true);
    await sink.waitForCount(2);

    // 屏障：同订阅后续写并等到其 data，再断言此前零失效信号。
    await writeAndAwaitData(
      fixture.lease,
      sink,
      { op: 'set', path: ['tasks', 'x3'], value: task('x3', 3) },
      'x3',
    );
    expect(
      sink.invalidateAllNotifications().length,
      'NC1：缺省容量下两次同步受体写不溢出（实现若恒发失效信号，本负控必红）',
    ).toBe(0);
    expect(
      sink.dataNotifications()
        .flatMap((notification) => notification.changes.map((change) => change.key))
        .sort(),
      'NC1：两写各一条 data（缺省上界未被注入值污染）',
    ).toStrictEqual(['x1', 'x2', 'x3']);
  });
});

// ───────────────────────── B 组：父路径删除 / 祖先删除 / 整替 / 同事务原子（AC3） ─────────────────────────

describe('B 组（AC3）：结构性失效——父删除/祖先删除/整替 → invalidate-all 且订阅存活', () => {
  it('A3 AC3：订阅容器被删（父路径删除）→ 恰一条两键 invalidate-all、订阅存活', async () => {
    const fixture = await openWatchLease();
    const sink = new NotificationSink();
    const handle = establishWatch(fixture.lease, ['optionalTasks'], sink.listener);

    await writeAndAwaitData(
      fixture.lease,
      sink,
      { op: 'set', path: ['optionalTasks', 'e3'], value: task('e3', 3) },
      'e3',
    );

    const deleted = await fixture.lease.mutateData({ op: 'delete', path: ['optionalTasks'] });
    expect(deleted.ok, '契约前提失败：可选容器删除应合法').toBe(true);
    await sink.waitForInvalidateAll(5_000);
    expect(
      sink.invalidateAllNotifications(),
      'AC3：父路径删除 → 恰一条两键 invalidate-all（origin=触发的本地事务）',
    ).toStrictEqual([INVALIDATE_ALL_LOCAL]);
    expect(
      sink.dataNotifications().map((notification) => notification.kind),
      'AC3：父删事务对该订阅至多一条通知（事务级原子）',
    ).toStrictEqual(['data']);

    // AC3 订阅存活：零 watch-end、句柄仍为未退订订阅；重建后条目写照常到达。
    expect(sink.kinds(), 'AC3：数据缺席从不终结订阅——零 watch-end').not.toContain('watch-end');
    expect(typeof handle.unsubscribe).toBe('function');
    const recreated = await fixture.lease.mutateData({
      op: 'set',
      path: ['optionalTasks'],
      value: { e4: task('e4', 4) },
    });
    expect(recreated.ok, '契约前提失败：删除后重建可选容器应合法').toBe(true);
    await writeAndAwaitData(
      fixture.lease,
      sink,
      { op: 'set', path: ['optionalTasks', 'e5'], value: task('e5', 5) },
      'e5',
    );
    expect(sink.invalidateAllNotifications().length, 'AC3：失效信号不重复叠加').toBe(1);
  });

  it('A3b AC3：同事务批量（删容器 + 无关写）→ 事务级原子：恰一条 invalidate-all、零无关通知', async () => {
    const fixture = await openWatchLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['optionalTasks'], sink.listener);

    await writeAndAwaitData(
      fixture.lease,
      sink,
      { op: 'set', path: ['optionalTasks', 'e3'], value: task('e3', 3) },
      'e3',
    );

    const batch = await fixture.lease.mutateData({
      ops: [
        { op: 'delete', path: ['optionalTasks'] },
        { op: 'set', path: ['meta', 'content'], value: 'changed-in-batch' },
      ],
    });
    expect(batch.ok, '契约前提失败：同事务删可选容器 + 无关写应合法').toBe(true);
    await sink.waitForInvalidateAll(5_000);
    expect(
      sink.invalidateAllNotifications(),
      'AC3：含结构性删除的事务该条 = invalidate-all（恰一条）',
    ).toStrictEqual([INVALIDATE_ALL_LOCAL]);
    expect(
      sink.dataNotifications().filter((notification) =>
        notification.changes.some((change) => change.path[0] === 'meta'),
      ).length,
      'AC3：同事务无关路径写不产生额外通知（事务级原子）',
    ).toBe(0);

    // 屏障 + 存活：重建 + 条目写到达 data，失效信号仍恰一条。
    const recreated = await fixture.lease.mutateData({
      op: 'set',
      path: ['optionalTasks'],
      value: { e4: task('e4', 4) },
    });
    expect(recreated.ok).toBe(true);
    await writeAndAwaitData(
      fixture.lease,
      sink,
      { op: 'set', path: ['optionalTasks', 'e5'], value: task('e5', 5) },
      'e5',
    );
    expect(sink.invalidateAllNotifications().length).toBe(1);
    expectNotificationKindsClosed(sink);
  });

  it('A4 AC3：两级嵌套：外层祖先删除 → 恰一条 invalidate-all、订阅横跨重建', async () => {
    const fixture = await openWatchLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['optionalGroups', 'og1'], sink.listener);

    await writeAndAwaitData(
      fixture.lease,
      sink,
      { op: 'set', path: ['optionalGroups', 'og1', 'g2'], value: task('g2', 2) },
      'g2',
    );

    const deleted = await fixture.lease.mutateData({ op: 'delete', path: ['optionalGroups'] });
    expect(deleted.ok, '契约前提失败：可选外层容器删除应合法').toBe(true);
    await sink.waitForInvalidateAll(5_000);
    expect(
      sink.invalidateAllNotifications(),
      'AC3：祖先删除（Yjs 只产 ROOT 级单事件）→ 该订阅恰一条两键 invalidate-all',
    ).toStrictEqual([INVALIDATE_ALL_LOCAL]);
    expect(sink.kinds()).not.toContain('watch-end');

    const recreated = await fixture.lease.mutateData({
      op: 'set',
      path: ['optionalGroups'],
      value: { og1: { g3: task('g3', 3) } },
    });
    expect(recreated.ok, '契约前提失败：外层删除后重建应合法').toBe(true);
    await writeAndAwaitData(
      fixture.lease,
      sink,
      { op: 'set', path: ['optionalGroups', 'og1', 'g4'], value: task('g4', 4) },
      'g4',
    );
    expect(sink.invalidateAllNotifications().length).toBe(1);
    expect(
      sink.dataFor('g4')[0]?.changes,
      'AC4：重建后内层条目变更以定位符形态到达（零重新订阅）',
    ).toStrictEqual([{ path: ['optionalGroups', 'og1'], key: 'g4' }]);
  });

  it('A5 AC3：容器整替（旧子树消失）→ 恰一条 invalidate-all', async () => {
    const fixture = await openWatchLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['optionalTasks'], sink.listener);

    await writeAndAwaitData(
      fixture.lease,
      sink,
      { op: 'set', path: ['optionalTasks', 'e3'], value: task('e3', 3) },
      'e3',
    );

    const replaced = await fixture.lease.mutateData({
      op: 'set',
      path: ['optionalTasks'],
      value: { z1: task('z1', 1) },
    });
    expect(replaced.ok, '契约前提失败：容器整替应合法').toBe(true);
    const read = fixture.lease.readMap(['optionalTasks'], { n: 10 });
    expect(read.ok, '契约前提失败：整替后容器应可读（内容已替换）').toBe(true);
    if (read.ok) {
      expect(
        read.value.map((entry) => entry.key),
        '契约前提：整替后旧条目全部消失（漏不可接受）',
      ).toStrictEqual(['z1']);
    }
    await sink.waitForInvalidateAll(5_000);
    expect(
      sink.invalidateAllNotifications(),
      'AC3：整替（旧子树消失）→ 恰一条两键 invalidate-all',
    ).toStrictEqual([INVALIDATE_ALL_LOCAL]);
    expect(sink.kinds()).not.toContain('watch-end');

    await writeAndAwaitData(
      fixture.lease,
      sink,
      { op: 'set', path: ['optionalTasks', 'z2'], value: task('z2', 2) },
      'z2',
    );
    expect(sink.invalidateAllNotifications().length, 'AC3：整替后订阅存活（后续 data 恢复）').toBe(1);
  });

  it('NC2 反伪绿：条目级删除仍为 data（不噪声化——真变过滤零漂移）', async () => {
    const fixture = await openWatchLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['optionalTasks'], sink.listener);

    const deleted = await fixture.lease.mutateData({ op: 'delete', path: ['optionalTasks', 'e2'] });
    expect(deleted.ok, '契约前提失败：条目级删除应合法').toBe(true);
    const notification = await sink.waitForDataKey('e2');
    expect(
      notification.changes,
      'NC2：条目级删除 = data（不得被父删编排升级为 invalidate-all）',
    ).toStrictEqual([{ path: ['optionalTasks'], key: 'e2' }]);

    await writeAndAwaitData(
      fixture.lease,
      sink,
      { op: 'set', path: ['optionalTasks', 'e3'], value: task('e3', 3) },
      'e3',
    );
    expect(sink.invalidateAllNotifications().length, 'NC2：条目级事务零失效信号').toBe(0);
    expectNotificationKindsClosed(sink);
  });
});

// ───────────────────────── C 组：订阅横跨缺席期（AC4，基线绿回归边界） ─────────────────────────

describe('C 组（AC4）：数据在场性从不终结订阅——删除 → 重建 → 条目 data', () => {
  it('A6 AC4：删除 → invalidate-all → 重建 → 条目写到达 data、零重新订阅', async () => {
    const fixture = await openWatchLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['optionalTasks'], sink.listener);

    await writeAndAwaitData(
      fixture.lease,
      sink,
      { op: 'set', path: ['optionalTasks', 'e3'], value: task('e3', 3) },
      'e3',
    );

    const deleted = await fixture.lease.mutateData({ op: 'delete', path: ['optionalTasks'] });
    expect(deleted.ok).toBe(true);
    await sink.waitForInvalidateAll(5_000);

    const recreated = await fixture.lease.mutateData({
      op: 'set',
      path: ['optionalTasks'],
      value: { seed: task('seed', 0) },
    });
    expect(recreated.ok, '契约前提失败：删除后重建应合法').toBe(true);

    await writeAndAwaitData(
      fixture.lease,
      sink,
      { op: 'set', path: ['optionalTasks', 'r1'], value: task('revived', 1) },
      'r1',
    );
    expect(
      sink.dataFor('r1')[0]?.changes,
      'AC4：重建后条目变更照常以 data 到达（定位符 {path:[optionalTasks],key:r1}）',
    ).toStrictEqual([{ path: ['optionalTasks'], key: 'r1' }]);
    expect(
      sink.invalidateAllNotifications().length,
      'AC4：整段缺席期只一条失效信号、零重新订阅副作用',
    ).toBe(1);
    expect(sink.kinds(), 'AC4：数据到场恢复——零 watch-end').not.toContain('watch-end');
    expectNotificationKindsClosed(sink);
  });
});

// ───────────────────────── D 组：公共面与形状冻结（AC1/AC6/A8/A9/NC3–NC6） ─────────────────────────

describe('D 组（AC1/A8/A9/NC3–NC6）：公共契约零污染与三 kind 形状冻结', () => {
  it('A8 AC1：容量是构造参数 + 实现默认而非公共契约——lease 面恒 16 键、零容量字段泄漏', async () => {
    const fixture = await openWatchLease({ watchQueueCapacity: WATCH_QUEUE_CAPACITY_INJECTED });
    expect(
      Object.keys(fixture.lease).sort(),
      'A8：容量注入是纯加法 testing 控件——lease 公共面恒 16 键',
    ).toStrictEqual([...LEASE_KEYS].sort());
    expect('watchQueueCapacity' in fixture.lease, 'A8：容量数值不进 lease 公共面').toBe(false);
    const status = fixture.lease.getStatus();
    expect(status.lease).toBe('active');
    if (status.lease === 'active') {
      expect(
        'watchQueueCapacity' in status.runtime,
        'A8：容量数值不进 runtime status 投影',
      ).toBe(false);
    }
  });

  it('A9/NC6：三 kind 形状冻结——invalidate-all 恰两键、data 恰三键、零 watch-end/version/rev', async () => {
    const fixture = await openWatchLease({ watchQueueCapacity: WATCH_QUEUE_CAPACITY_INJECTED });
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['tasks'], sink.listener);

    const pendingA = fixture.lease.mutateData({ op: 'set', path: ['tasks', 'x1'], value: task('x1', 1) });
    const pendingB = fixture.lease.mutateData({ op: 'set', path: ['tasks', 'x2'], value: task('x2', 2) });
    const [first, second] = await Promise.all([pendingA, pendingB]);
    expect(first.ok && second.ok).toBe(true);
    await sink.waitForInvalidateAll(5_000);
    await writeAndAwaitData(
      fixture.lease,
      sink,
      { op: 'set', path: ['tasks', 'x3'], value: task('x3', 3) },
      'x3',
    );

    expect(
      sink.invalidateAllNotifications(),
      'A9：invalidate-all 恰两键 {kind,origin}——不得夹带 reason/changes/version/rev',
    ).toStrictEqual([INVALIDATE_ALL_LOCAL]);
    for (const notification of sink.dataNotifications()) expectDataShape(notification);
    expectNotificationKindsClosed(sink);
    expect(sink.kinds(), 'A9：零 watch-end（本任务范围外）').not.toContain('watch-end');
    for (const notification of sink.received) {
      const keys = Object.keys(notification as object);
      expect(keys, 'A9：零 version/rev 字段').not.toContain('version');
      expect(keys, 'A9：零 version/rev 字段').not.toContain('rev');
    }
  });

  it('NC3：无关路径写零通知（带同订阅后续写屏障）', async () => {
    const fixture = await openWatchLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['optionalTasks'], sink.listener);

    const unrelated = await fixture.lease.mutateData({
      op: 'set',
      path: ['meta', 'content'],
      value: 'unrelated',
    });
    expect(unrelated.ok, '契约前提失败：无关路径写应合法').toBe(true);

    // 屏障：同订阅后续合法写 + 等其 data，再断言无关写零通知。
    await writeAndAwaitData(
      fixture.lease,
      sink,
      { op: 'set', path: ['optionalTasks', 'b1'], value: task('b1', 1) },
      'b1',
    );
    expect(sink.received.length, 'NC3：无关路径写零通知（过宽通知必红）').toBe(1);
    expect(sink.invalidateAllNotifications().length).toBe(0);
  });

  it('NC4：必填字段整删被写面拒绝、零事务零通知（带屏障）', async () => {
    const fixture = await openWatchLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['tasks'], sink.listener);

    const rejected = await fixture.lease.mutateData({ op: 'delete', path: ['tasks'] });
    expect(rejected.ok, 'NC4：必填字段整删应被写面领域校验拒绝').toBe(false);
    if (!rejected.ok) {
      expect(
        'issues' in rejected,
        'NC4：拒绝面应为写面领域校验（issues），而非 lease 释放面',
      ).toBe(true);
      if ('issues' in rejected) {
        expect(rejected.issues.length, 'NC4：拒绝应携带非空 issues（写面校验零改动）').toBeGreaterThan(0);
      }
    }

    await writeAndAwaitData(
      fixture.lease,
      sink,
      { op: 'set', path: ['tasks', 'b1'], value: task('b1', 1) },
      'b1',
    );
    expect(sink.received.length, 'NC4：非法事务不是触发源——此前零通知').toBe(1);
    expect(sink.invalidateAllNotifications().length).toBe(0);
  });

  it('NC5：非法批量被写面拒绝、零通知（带屏障）', async () => {
    const fixture = await openWatchLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['optionalTasks'], sink.listener);

    const rejected = await fixture.lease.mutateData({
      ops: [
        { op: 'set', path: ['optionalTasks', 'q2'], value: task('q2', 2) },
        { op: 'delete', path: ['optionalTasks'] },
      ],
    });
    expect(rejected.ok, 'NC5：同事务对同一路径先写后删应被拒绝').toBe(false);
    if (!rejected.ok) {
      expect('issues' in rejected, 'NC5：拒绝面应为写面领域校验（issues）').toBe(true);
      if ('issues' in rejected) {
        expect(rejected.issues.length, 'NC5：拒绝应携带非空 issues').toBeGreaterThan(0);
      }
    }

    await writeAndAwaitData(
      fixture.lease,
      sink,
      { op: 'set', path: ['optionalTasks', 'b1'], value: task('b1', 1) },
      'b1',
    );
    expect(sink.received.length, 'NC5：非法事务不是触发源——此前零通知').toBe(1);
    expect(sink.invalidateAllNotifications().length).toBe(0);
  });
});
