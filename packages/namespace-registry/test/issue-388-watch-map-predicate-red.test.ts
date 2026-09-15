/**
 * issue #388（ADR 0030 T2「谓词订阅与宁多勿漏判定」）—— lease 公共面行为红灯契约。
 *
 * 契约来源：
 * - issue #388 What-to-build + AC1–AC8；
 * - `docs/adr/0030-change-subscription.md` §2 谓词词表 / §3 建立判定 / §4 通知流 /
 *   §5 宁多勿漏 / §6 分发 / §7 分层；
 * - `wiki/raw/task_issue-388_sa6_contract.md` §12.1 绑定 B-1–B-10、§12.2 判定矩阵
 *   N1–N15 / E1–E11、§12.5 断言纪律；
 * - `wiki/raw/task_issue-388_design.md` §7 冻结裁定 F-1–F-6、§8.2 门⑥、§8.3 判定算法、
 *   §9 矩阵分档、§10 测试结构。
 *
 * 分档（反伪绿：红证据只取「必须静默」与「建立拒绝」面，保守面 HEAD 行为已等于目标）：
 * - **必须通知 / 保守（F-1：AC7 逐字保守）**：C-2 嵌套部分更新（N1/N2）、live Y.Map
 *   整替/删除旧态不可判（N6）、退出/进入匹配集（N3/N4/N10）；
 * - **必须静默（首红行）**：不匹配新增（N7）、混合事务非匹配 key 剔除（N8）、
 *   plain 快照旧态可判（N9/N9b）；
 * - **建立拒绝（首红行）**：E4–E7/E5b（`WATCH_MAP_OPTIONS_INVALID`）、E11（码与 message
 *   纪律）；
 * - **必须不变（T1 冻结面）**：E10（无谓词形态逐字不变）、N5（同值写零通知）、
 *   N13（载荷三键/两键）、N14（生命周期）、N15（槽外零 throw）、NC（读面/键集）。
 *
 * 断言纪律（SA6 §12.5）：只观察 lease 公共面运行时行为（零 grep/源码文本断言）；
 * 精确形状（通知恰三键、定位符恰两键、句柄恰 `{unsubscribe}`、code 逐字相等）；
 * 异步确定性 = `expect.poll` + **屏障**（后续事务），禁 sleep；逐 key 断言用排序后
 * `toStrictEqual`；`readData` 成功形状一律经 `expectReadDataOkKeys` 集中化 helper。
 */
import { describe, expect, it } from 'vitest';
import { expectReadDataOkKeys } from '../../namespace-runtime/test/helpers/readdata-ok-shape.js';
import {
  attemptEstablishWatch,
  establishWatch,
  NOTIFICATION_KINDS,
  NotificationSink,
  openPredicateLease,
  openSecondLease,
  plainTasksOf,
  PREDICATE_OWNER,
  rawTransact,
  tasksOf,
  WATCH_MAP_OPTIONS_INVALID,
  type PredicateFixture,
} from './issue-388-watch-map-predicate-fixture.js';

// ───────────────────────── 契约常量与助手 ─────────────────────────

/** T1 冻结两码（ADR 0030 §3 逐字；谓词门插入不得回退既有门）。 */
const WATCH_MAP_CARRIER_MISMATCH = 'WATCH_MAP_CARRIER_MISMATCH';
const WATCH_MAP_SCHEMA_UNAVAILABLE = 'WATCH_MAP_SCHEMA_UNAVAILABLE';
const NAMESPACE_LEASE_RELEASED = 'NAMESPACE_LEASE_RELEASED';

/** T1 后 lease 面既有 15 键（AC10 纯加法：谓词不改键集——lease 恰 16 键不变）。 */
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

/** 谓词字段值（信号不含值）：payload 哨兵。 */
const SENTINEL = 'WATCH-PREDICATE-SENTINEL-VALUE';

const noop = (): void => {};

/** `{ where: { field, equals } }` 词形（值面动态——形态负例经同一构造器可达）。 */
function equalsWhere(field: string, value: unknown): unknown {
  return { where: { field, equals: value } };
}

/** `{ where: { field, in } }` 词形（`values` 动态——非数组/空数组/成员非法负例可达）。 */
function inWhere(field: string, values: unknown): unknown {
  return { where: { field, in: values } };
}

/** 谓词契约主谓词（`task.status === 'open'`）。 */
function openStatusPredicate(): unknown {
  return equalsWhere('status', 'open');
}

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

/** 通知流 kind 闭集（含谓词订阅：通知流零参数错误）。 */
function expectNotificationStreamKinds(sink: NotificationSink): void {
  for (const notification of sink.received) {
    const kind = (notification as { kind?: unknown }).kind;
    expect(
      typeof kind === 'string' && (NOTIFICATION_KINDS as readonly string[]).includes(kind),
      `通知流零参数错误：kind 必须 ∈ ${JSON.stringify(NOTIFICATION_KINDS)}，实际 ${JSON.stringify(kind)}`,
    ).toBe(true);
  }
}

/** 全部 data 通知的 key 序列（每条通知内按首见序——混合事务行排序后比较）。 */
function keySequence(sink: NotificationSink): string[][] {
  return sink.dataNotifications().map((notification) => notification.changes.map((change) => change.key));
}

let barrierCounter = 0;

/**
 * 屏障事务（后续事务）：`t1.title` in-place 写 —— C-2 嵌套事件，无谓词与任意谓词下
 * 均**必须通知**（保守面）。用于表达「零通知」：屏障通知到达 ⇒ 更早事务的投递已完成
 * （每订阅 FIFO 队列）。
 */
async function barrierTransaction(fixture: PredicateFixture): Promise<void> {
  barrierCounter += 1;
  const write = await fixture.lease.mutateData({
    op: 'set',
    path: ['tasks', 't1', 'title'],
    value: `barrier-${barrierCounter}`,
  });
  expect(write.ok, '契约前提失败：屏障写应成功').toBe(true);
}

// ───────────────────────── 组 E（AC1/AC2）：建立判定 ─────────────────────────

describe('组 E（AC1/AC2）：谓词建立判定 —— 全部由 active schema 完成', () => {
  it('E1 AC1：标量叶 field（title）建立成功，返回恰 `{unsubscribe}` 句柄', async () => {
    const fixture = await openPredicateLease();
    const outcome = attemptEstablishWatch(fixture.lease, ['tasks'], noop, equalsWhere('title', 'alpha'));
    expect(outcome.ok, `AC1：字段存在且标量域应建立成功（code=${outcome.ok ? '-' : outcome.code}）`).toBe(true);
    if (!outcome.ok) return;
    expect(Object.keys(outcome.handle).sort()).toStrictEqual(['unsubscribe']);
    expect(typeof outcome.handle.unsubscribe).toBe('function');
  });

  it('E2 AC1：number 域 `in`（乱序非空）建立成功', async () => {
    const fixture = await openPredicateLease();
    const outcome = attemptEstablishWatch(fixture.lease, ['tasks'], noop, inWhere('priority', [9, 2]));
    expect(outcome.ok, `AC1：in 算子应建立成功（code=${outcome.ok ? '-' : outcome.code}）`).toBe(true);
  });

  it('E3 AC1：别名域（status→Status）/ 字面量域（state enum）/ 可选标量（note?）三形态均建立成功', async () => {
    const fixture = await openPredicateLease();
    const outcomes = {
      别名域: attemptEstablishWatch(fixture.lease, ['tasks'], noop, equalsWhere('status', 'open')),
      字面量域: attemptEstablishWatch(fixture.lease, ['tasks'], noop, equalsWhere('state', 'open')),
      可选标量: attemptEstablishWatch(fixture.lease, ['tasks'], noop, equalsWhere('note', 'x')),
    } as const;
    for (const [label, outcome] of Object.entries(outcomes)) {
      expect(
        outcome.ok,
        `AC1：${label} 应建立成功（ref 追尽 + optional 透明 + enum ∈ 标量域；code=${outcome.ok ? '-' : outcome.code}）`,
      ).toBe(true);
    }
  });

  it('E4 AC2：field 不存在 → WATCH_MAP_OPTIONS_INVALID，且失败零订阅登记', async () => {
    const fixture = await openPredicateLease();
    const leaked = new NotificationSink();
    const control = new NotificationSink();
    const outcome = attemptEstablishWatch(fixture.lease, ['tasks'], leaked.listener, equalsWhere('missing', 'x'));
    expect(outcome.ok, 'AC2：field 不存在必须响亮拒绝（禁止静默建立恒不匹配死订阅）').toBe(false);
    if (outcome.ok) return;
    expect(outcome.code, 'AC2：稳定码逐字 = WATCH_MAP_OPTIONS_INVALID').toBe(WATCH_MAP_OPTIONS_INVALID);
    expect(outcome.message.length).toBeGreaterThan(0);

    establishWatch(fixture.lease, ['tasks'], control.listener); // 无谓词对照订阅（屏障）
    await barrierTransaction(fixture);
    await control.waitForCount(1);
    expect(leaked.received.length, 'AC2：失败路径零订阅登记（后续变更零通知佐证）').toBe(0);
  });

  it('E5 AC2：非标量域同族（object / array / union / xml）→ 同码拒绝（非标量域 message）', async () => {
    const fixture = await openPredicateLease();
    const outcomes = {
      嵌套对象域: attemptEstablishWatch(fixture.lease, ['tasks'], noop, equalsWhere('sub', 'n')),
      数组域: attemptEstablishWatch(fixture.lease, ['tasks'], noop, equalsWhere('tags', 'n')),
      联合域: attemptEstablishWatch(fixture.lease, ['tasks'], noop, equalsWhere('detail', 'n')),
      XML域: attemptEstablishWatch(fixture.lease, ['tasks'], noop, equalsWhere('blob', 'n')),
    } as const;
    const messages = new Set<string>();
    for (const [label, outcome] of Object.entries(outcomes)) {
      expect(outcome.ok, `AC2：${label} 非标量域必须拒绝（值域恒标量；容器/联合/XML 拒绝）`).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.code).toBe(WATCH_MAP_OPTIONS_INVALID);
      expect(outcome.message.length).toBeGreaterThan(0);
      messages.add(outcome.message);
    }
    expect(messages.size, 'AC2：同族拒绝 message 单点（非标量域）').toBe(1);
  });

  it('E5b AC2：封闭对象 map（meta）与标量条目容器（counters）→ 同码拒绝（条目无统一值域）', async () => {
    const fixture = await openPredicateLease();
    const closedMap = attemptEstablishWatch(fixture.lease, ['meta'], noop, equalsWhere('content', 'hi'));
    const scalarEntries = attemptEstablishWatch(
      fixture.lease,
      ['counters'],
      noop,
      equalsWhere('counterTotal', 'x'),
    );
    for (const [label, outcome] of Object.entries({ 封闭对象map: closedMap, 标量条目容器: scalarEntries })) {
      expect(
        outcome.ok,
        `AC2：${label} 条目无统一值域（条目无成员语义）必须拒绝（禁止静默建立部分恒不匹配面）`,
      ).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.code).toBe(WATCH_MAP_OPTIONS_INVALID);
    }
    if (!closedMap.ok && !scalarEntries.ok) {
      expect(closedMap.message, 'AC2：条目无统一值域 message 单点').toBe(scalarEntries.message);
    }
  });

  it('E6 AC1：`in: []` → 同码拒绝（恒不匹配的订阅是配置错误）且零登记', async () => {
    const fixture = await openPredicateLease();
    const leaked = new NotificationSink();
    const control = new NotificationSink();
    const outcome = attemptEstablishWatch(fixture.lease, ['tasks'], leaked.listener, inWhere('status', []));
    expect(outcome.ok, 'AC1：in 空数组必须响亮拒绝').toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe(WATCH_MAP_OPTIONS_INVALID);

    establishWatch(fixture.lease, ['tasks'], control.listener);
    await barrierTransaction(fixture);
    await control.waitForCount(1);
    expect(leaked.received.length, 'AC1：失败路径零订阅登记').toBe(0);
  });

  it('E7 AC2：词形错误族 fail-closed（缺算子/双算子/未知键/非标量算子/options 形状/敌意通道）', async () => {
    const fixture = await openPredicateLease();
    const whereShapeCases: Record<string, unknown> = {
      缺算子: { where: { field: 'status' } },
      双算子: { where: { field: 'status', equals: 'open', in: ['open'] } },
      未知算子: { where: { field: 'status', notEquals: 'open' } },
      field非string: { where: { field: 1, equals: 'open' } },
      equals值对象: { where: { field: 'status', equals: { bad: true } } },
      in非数组: { where: { field: 'status', in: 'open' } },
      in成员含对象: { where: { field: 'status', in: [{}] } },
      where非对象: { where: 'status' },
      where访问器: {
        where: Object.defineProperty({}, 'field', {
          enumerable: true,
          get: () => 'status',
        }),
      },
    };
    const whereShapeMessages = new Set<string>();
    for (const [label, options] of Object.entries(whereShapeCases)) {
      const outcome = attemptEstablishWatch(fixture.lease, ['tasks'], noop, options);
      expect(outcome.ok, `AC2：${label} 必须 fail-closed 拒绝（禁止静默建立语义未定义死订阅）`).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.code, `AC2：${label} 稳定码`).toBe(WATCH_MAP_OPTIONS_INVALID);
      whereShapeMessages.add(outcome.message);
    }
    expect(whereShapeMessages.size, 'AC2：where 词形错误 message 单点（同 cause 同 message）').toBe(1);

    const optionsShapeMessages = new Set<string>();
    const optionsShapeCases: Record<string, unknown> = {
      options非对象: 'bad-options',
      options数组: [],
      options未知键: { where: { field: 'status', equals: 'open' }, extra: 1 },
      options访问器: Object.defineProperty({}, 'where', {
        enumerable: true,
        get: () => ({ field: 'status', equals: 'open' }),
      }),
    };
    for (const [label, options] of Object.entries(optionsShapeCases)) {
      const outcome = attemptEstablishWatch(fixture.lease, ['tasks'], noop, options);
      expect(outcome.ok, `AC2：${label} 必须 fail-closed 拒绝`).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.code, `AC2：${label} 稳定码`).toBe(WATCH_MAP_OPTIONS_INVALID);
      optionsShapeMessages.add(outcome.message);
    }
    expect(optionsShapeMessages.size, 'AC2：options 形状错误 message 单点').toBe(1);
    expect(
      [...optionsShapeMessages][0],
      'AC2：门内子序——options 形状 message 与 where 词形 message 可区分',
    ).not.toBe([...whereShapeMessages][0]);

    // 门内子序冻结：形态错误优先于 schema 侧错误（同码异 message）。
    const missingWithEmptyIn = attemptEstablishWatch(fixture.lease, ['tasks'], noop, inWhere('missing', []));
    expect(missingWithEmptyIn.ok).toBe(false);
    if (!missingWithEmptyIn.ok) {
      expect(missingWithEmptyIn.code).toBe(WATCH_MAP_OPTIONS_INVALID);
      expect(missingWithEmptyIn.message, 'AC2：in 空数组先于 field 不存在（门内子序冻结）').not.toBe(
        [...whereShapeMessages][0],
      );
      const fieldMissing = attemptEstablishWatch(fixture.lease, ['tasks'], noop, equalsWhere('missing', 'x'));
      expect(fieldMissing.ok).toBe(false);
      if (!fieldMissing.ok) {
        expect(missingWithEmptyIn.message).not.toBe(fieldMissing.message);
      }
    }
  });

  it('E8 AC2（负控 NC3）：门次序不回退——released / 无 active schema / 非法 path 先于谓词门', async () => {
    const released = await openPredicateLease();
    await released.lease.release();
    const releasedOutcome = attemptEstablishWatch(
      released.lease,
      ['tasks'],
      noop,
      equalsWhere('missing', 'x'),
    );
    expect(releasedOutcome.ok, 'NC3：released lease 必须先于谓词门拒绝').toBe(false);
    if (!releasedOutcome.ok) {
      expect(releasedOutcome.code, 'NC3：released 短路先于谓词门').toBe(NAMESPACE_LEASE_RELEASED);
    }

    const legacy = await openPredicateLease({ schemaText: null });
    expect(legacy.lease.getActiveSchema()).toBeNull();
    const legacyOutcome = attemptEstablishWatch(legacy.lease, ['tasks'], noop, equalsWhere('missing', 'x'));
    expect(legacyOutcome.ok, 'NC3：无 active schema 必须先于谓词门拒绝').toBe(false);
    if (!legacyOutcome.ok) {
      expect(legacyOutcome.code, 'NC3：schema 门先于谓词门').toBe(WATCH_MAP_SCHEMA_UNAVAILABLE);
    }

    const carrier = await openPredicateLease();
    for (const path of [['workRecords'], ['title'], ['nope']] as const) {
      const outcome = attemptEstablishWatch(carrier.lease, path, noop, equalsWhere('missing', 'x'));
      expect(outcome.ok, `NC3：载体门（${JSON.stringify(path)}）必须先于谓词门拒绝`).toBe(false);
      if (!outcome.ok) {
        expect(outcome.code, `NC3：载体门（${JSON.stringify(path)}）既有码不回退`).toBe(
          WATCH_MAP_CARRIER_MISMATCH,
        );
      }
    }
  });

  it('E9 AC1（负控 NC6）：数据缺席容器（未物化 ghost）+ 合法谓词建立成功（纯 schema 侧）', async () => {
    const fixture = await openPredicateLease();
    const outcome = attemptEstablishWatch(fixture.lease, ['ghost'], noop, equalsWhere('status', 'open'));
    expect(
      outcome.ok,
      `AC1/NC6：schema 已声明但未物化的容器应建立成功（零 live 载体探测；code=${outcome.ok ? '-' : outcome.code}）`,
    ).toBe(true);
  });

  it('E10（负控 NC1）：省略 options / undefined / {} / {where: undefined} → T1 无谓词行为逐字不变', async () => {
    const forms: Array<readonly [string, unknown[]]> = [
      ['省略', []],
      ['undefined', [undefined]],
      ['空对象', [{}]],
      ['present-undefined', [{ where: undefined }]],
    ];
    for (const [label, args] of forms) {
      const fixture = await openPredicateLease();
      const sink = new NotificationSink();
      establishWatch(fixture.lease, ['tasks'], sink.listener, ...args);
      const write = await fixture.lease.mutateData({
        op: 'set',
        path: ['tasks', 't9'],
        value: { title: 'E10', status: 'done', state: 'done', priority: 1 },
      });
      expect(write.ok, `NC1（${label}）：契约前提失败——新增条目写应成功`).toBe(true);
      await sink.waitForCount(1);
      expect(
        keySequence(sink),
        `NC1（${label}）：无谓词形态 = T1 全通知（非匹配条目照常通知——纯加法零行为漂移）`,
      ).toStrictEqual([['t9']]);
    }
  });

  it('E11 AC2（SA8 action 2）：新码 append-only 注册 + message 纪律（前缀/非空/六 cause 可区分/零回显）', async () => {
    const fixture = await openPredicateLease();
    const causes: Record<string, { path: readonly (string | number)[]; options: unknown; probes: string[] }> = {
      options形状: { path: ['tasks'], options: 'bad-options', probes: [] },
      where词形: { path: ['tasks'], options: equalsWhere('status', { bad: true }), probes: ['status'] },
      in空数组: { path: ['tasks'], options: inWhere('status', []), probes: ['status'] },
      field不存在: { path: ['tasks'], options: equalsWhere('missingFieldProbe', 'x'), probes: ['missingFieldProbe'] },
      条目无统一值域: { path: ['meta'], options: equalsWhere('content', 'hi'), probes: ['content'] },
      非标量域: { path: ['tasks'], options: equalsWhere('sub', 'x'), probes: ['sub'] },
    };
    const messages = new Map<string, string>();
    for (const [cause, spec] of Object.entries(causes)) {
      const outcome = attemptEstablishWatch(fixture.lease, spec.path, noop, spec.options);
      expect(outcome.ok, `AC2（${cause}）：应拒绝`).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.code, `AC2（${cause}）：码逐字相等`).toBe(WATCH_MAP_OPTIONS_INVALID);
      const prefix = `${WATCH_MAP_OPTIONS_INVALID}: `;
      expect(outcome.message.startsWith(prefix), `AC2（${cause}）：message 恒含码前缀`).toBe(true);
      expect(
        outcome.message.slice(prefix.length).length,
        `AC2（${cause}）：message 非空（前缀之外有要义）`,
      ).toBeGreaterThan(0);
      for (const probe of [...spec.probes, 'tasks', 'meta', 'counters']) {
        expect(
          outcome.message.includes(probe),
          `AC2（${cause}）：message 零 path/field 回显（不得含 ${probe}）`,
        ).toBe(false);
      }
      messages.set(cause, outcome.message);
    }
    const distinct = new Set(messages.values());
    expect(
      distinct.size,
      `AC2：六 cause message 互相可区分（实际 ${JSON.stringify([...messages.entries()])}）`,
    ).toBe(messages.size);
    expect(messages.size).toBe(6);
  });
});

// ───────────────────────── 组 N（AC3–AC8）：判定矩阵 ─────────────────────────

describe('组 N（AC5/AC6/AC7）：谓词判定矩阵 —— 宁多勿漏', () => {
  it('N1/N2 AC7：C-2 嵌套部分更新 → 保守通知（匹配条目 t1 与非匹配条目 t2 均必须通知）', async () => {
    const fixture = await openPredicateLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['tasks'], sink.listener, openStatusPredicate());

    const t1Write = await fixture.lease.mutateData({ op: 'set', path: ['tasks', 't1', 'title'], value: 'alpha-2' });
    expect(t1Write.ok).toBe(true);
    const t2Write = await fixture.lease.mutateData({ op: 'set', path: ['tasks', 't2', 'title'], value: 'beta-2' });
    expect(t2Write.ok).toBe(true);

    await sink.waitForCount(2);
    expect(keySequence(sink), 'F-1：旧态不可判（嵌套部分更新）→ 逐条目保守通知').toStrictEqual([
      ['t1'],
      ['t2'],
    ]);
    expectNotificationStreamKinds(sink);
  });

  it('N3 AC6：t1 退出匹配集（open→done）→ 必须通知（消费方拉终态自辨删除视图项）', async () => {
    const fixture = await openPredicateLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['tasks'], sink.listener, openStatusPredicate());
    const write = await fixture.lease.mutateData({ op: 'set', path: ['tasks', 't1', 'status'], value: 'done' });
    expect(write.ok).toBe(true);
    await sink.waitForCount(1);
    expect(keySequence(sink)).toStrictEqual([['t1']]);
  });

  it('N4 AC5：t2 进入匹配集（done→open）→ 必须通知', async () => {
    const fixture = await openPredicateLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['tasks'], sink.listener, openStatusPredicate());
    const write = await fixture.lease.mutateData({ op: 'set', path: ['tasks', 't2', 'status'], value: 'open' });
    expect(write.ok).toBe(true);
    await sink.waitForCount(1);
    expect(keySequence(sink)).toStrictEqual([['t2']]);
  });

  it('N5 AC4（负控 NC5）：谓词字段同值写 → 真变判定前置过滤，零通知', async () => {
    const fixture = await openPredicateLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['tasks'], sink.listener, openStatusPredicate());

    const enter = await fixture.lease.mutateData({ op: 'set', path: ['tasks', 't2', 'status'], value: 'open' });
    expect(enter.ok).toBe(true);
    await sink.waitForCount(1);
    const sameValue = await fixture.lease.mutateData({ op: 'set', path: ['tasks', 't2', 'status'], value: 'open' });
    expect(sameValue.ok, 'AC4：同值写是合法写（语义过滤，不是写拒绝）').toBe(true);

    await barrierTransaction(fixture);
    await sink.waitForCount(2);
    expect(sink.received.length, 'AC4：同值写零通知（载体 delta 存在但投影值未变）').toBe(2);
    expect(keySequence(sink), 'AC4：两条通知 = 进入匹配集 + 屏障，同值写零贡献').toStrictEqual([
      ['t2'],
      ['t1'],
    ]);
  });

  it('N6 AC7：live Y.Map 条目整值替换（oldValue 内容被 Yjs 清空）→ 保守通知', async () => {
    const fixture = await openPredicateLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['tasks'], sink.listener, openStatusPredicate());
    const write = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't2'],
      value: { title: 'beta-2', status: 'closed', state: 'done', priority: 9 },
    });
    expect(write.ok).toBe(true);
    await sink.waitForCount(1);
    expect(keySequence(sink), 'F-1/Yjs-3：旧态不可判 → 保守通知').toStrictEqual([['t2']]);
  });

  it('N7 AC5（首红行）：新增非匹配条目（status done）→ 零通知（旧态=缺席可判）', async () => {
    const fixture = await openPredicateLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['tasks'], sink.listener, openStatusPredicate());
    const write = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't9'],
      value: { title: 'gamma-9', status: 'done', state: 'done', priority: 1 },
    });
    expect(write.ok).toBe(true);

    await barrierTransaction(fixture);
    await sink.waitForCount(1);
    expect(sink.received.length, 'AC5：非匹配新增零通知（降噪是谓词的存在理由）').toBe(1);
    expect(keySequence(sink), 'AC5：唯一通知来自屏障（t9 被精确剔除）').toStrictEqual([['t1']]);
  });

  it('N8 AC5（首红行）：同事务批量新增 t9（匹配）+ t10（非匹配）→ changes 恰 [t9]', async () => {
    const fixture = await openPredicateLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['tasks'], sink.listener, openStatusPredicate());
    const write = await fixture.lease.mutateData({
      ops: [
        { op: 'set', path: ['tasks', 't9'], value: { title: 'gamma-9', status: 'open', state: 'open', priority: 1 } },
        { op: 'set', path: ['tasks', 't10'], value: { title: 'gamma-10', status: 'done', state: 'done', priority: 2 } },
      ],
    });
    expect(write.ok).toBe(true);
    await sink.waitForCount(1);
    expect(sink.received.length, 'AC5：一事务一通知 + 逐 key 精确过滤').toBe(1);
    expect(keySequence(sink), 'AC5：混合事务非匹配 key（t10）被剔除').toStrictEqual([['t9']]);
  });

  it('N9 AC7（首红行）：plain 条目整值替换、旧态为 plain 快照 → 两态可读 → 精确静默', async () => {
    const fixture = await openPredicateLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['plainTasks'], sink.listener, openStatusPredicate());

    expect(
      () =>
        rawTransact(fixture, () => {
          plainTasksOf(fixture).set('t3', { title: 'gamma-2', status: 'closed', state: 'done', priority: 3 });
        }),
      'AC7：raw 替换 plain 条目不得抛错',
    ).not.toThrow();

    // 屏障：同容器 raw 新增一个**匹配**条目（plain 快照可判 ∧ newMatch）→ 必通知。
    expect(() =>
      rawTransact(fixture, () => {
        plainTasksOf(fixture).set('p9', { title: 'barrier', status: 'open', state: 'open', priority: 9 });
      }),
    ).not.toThrow();
    await sink.waitForCount(1);
    expect(sink.received.length, 'AC7：oldValue 为 plain 快照（done→closed 均不匹配）→ 零通知').toBe(1);
    expect(keySequence(sink), 'AC7：唯一通知来自屏障（t3 被精确剔除）').toStrictEqual([['p9']]);
  });

  it('N9b AC7：plain 条目（非匹配）raw delete → oldValue 可判 ∧ 新态缺席 → 零通知', async () => {
    const fixture = await openPredicateLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['plainTasks'], sink.listener, openStatusPredicate());
    expect(
      () =>
        rawTransact(fixture, () => {
          plainTasksOf(fixture).delete('t3');
        }),
      'AC7：raw delete plain 条目不得抛错',
    ).not.toThrow();

    expect(() =>
      rawTransact(fixture, () => {
        plainTasksOf(fixture).set('p9', { title: 'barrier', status: 'open', state: 'open', priority: 9 });
      }),
    ).not.toThrow();
    await sink.waitForCount(1);
    expect(sink.received.length, 'AC7：非匹配 plain 快照 delete → 零通知').toBe(1);
    expect(keySequence(sink)).toStrictEqual([['p9']]);
  });

  it('N10/N10b AC7：plain 快照两态可读 → 进入匹配集通知；delete（旧态匹配）通知', async () => {
    const fixture = await openPredicateLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['plainTasks'], sink.listener, openStatusPredicate());

    expect(() =>
      rawTransact(fixture, () => {
        plainTasksOf(fixture).set('t3', { title: 'gamma-2', status: 'open', state: 'open', priority: 3 });
      }),
    ).not.toThrow();
    await sink.waitForCount(1);
    expect(keySequence(sink), 'AC7：plain 快照 done→open（newMatch）必须通知').toStrictEqual([['t3']]);

    expect(() =>
      rawTransact(fixture, () => {
        plainTasksOf(fixture).delete('t3');
      }),
    ).not.toThrow();
    await sink.waitForCount(2);
    expect(keySequence(sink), 'AC6：plain delete（oldMatch）必须通知（退出/删除面不静默）').toStrictEqual([
      ['t3'],
      ['t3'],
    ]);
  });

  it('N11 AC3：缺失 / null 恒不匹配——不抛、零参数错误；通知按载体分档', async () => {
    const fixture = await openPredicateLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['tasks'], sink.listener, openStatusPredicate());

    // (a) 缺失字段 + in-place 兄弟字段写（C-2）→ 保守通知
    const missingInPlace = await fixture.lease.mutateData({ op: 'set', path: ['tasks', 't4', 'title'], value: 'delta-2' });
    expect(missingInPlace.ok).toBe(true);
    await sink.waitForCount(1);
    expect(keySequence(sink), 'AC3：缺失字段恒不匹配但不抛；嵌套更新保守通知').toStrictEqual([['t4']]);

    // (b) 缺失字段 + live Y.Map 整值替换（旧态被清空）→ 保守通知
    const missingReplace = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't4'],
      value: { title: 'delta-3', status: 'closed', state: 'open', priority: 4 },
    });
    expect(missingReplace.ok).toBe(true);
    await sink.waitForCount(2);
    expect(keySequence(sink)[1], 'AC3：缺失字段整值替换保守通知').toStrictEqual(['t4']);

    // (c) 缺失字段 + 新增（旧态=缺席可判）→ 精确静默（屏障验证）
    const missingAdd = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't11'],
      value: { title: 'eta', state: 'open', priority: 6 },
    });
    expect(missingAdd.ok).toBe(true);
    await barrierTransaction(fixture);
    await sink.waitForCount(3);
    expect(sink.received.length, 'AC3：缺失字段新增 → 不匹配（精确静默）').toBe(3);
    expect(keySequence(sink)[2], 'AC3：唯一新增通知来自屏障').toStrictEqual(['t1']);

    // (d) null 值（plain 条目 raw 替换 null→open）→ 旧态 null 不匹配、新态匹配 → 通知
    const plainFixture = await openPredicateLease();
    const plainSink = new NotificationSink();
    establishWatch(plainFixture.lease, ['plainTasks'], plainSink.listener, openStatusPredicate());
    expect(() =>
      rawTransact(plainFixture, () => {
        plainTasksOf(plainFixture).set('t5', { title: 'epsilon-2', status: 'open', state: 'open', priority: 5 });
      }),
    ).not.toThrow();
    await plainSink.waitForCount(1);
    expect(keySequence(plainSink), 'AC3：null 恒不匹配（旧态）但新态匹配 → 通知').toStrictEqual([['t5']]);

    expectNotificationStreamKinds(sink);
    expectNotificationStreamKinds(plainSink);
  });

  it('N12 AC1：`in` 集合语义——乱序/重复两形态行为逐字节同构；空数组建立拒绝', async () => {
    const duplicated = await openPredicateLease();
    const reordered = await openPredicateLease();
    const duplicatedSink = new NotificationSink();
    const reorderedSink = new NotificationSink();
    establishWatch(duplicated.lease, ['tasks'], duplicatedSink.listener, inWhere('status', ['open', 'open', 'blocked']));
    establishWatch(reordered.lease, ['tasks'], reorderedSink.listener, inWhere('status', ['blocked', 'open']));

    for (const [fixture, sink] of [
      [duplicated, duplicatedSink],
      [reordered, reorderedSink],
    ] as const) {
      const match = await fixture.lease.mutateData({
        op: 'set',
        path: ['tasks', 't9'],
        value: { title: 'gamma-9', status: 'open', state: 'open', priority: 1 },
      });
      expect(match.ok).toBe(true);
      const nonMatch = await fixture.lease.mutateData({
        op: 'set',
        path: ['tasks', 't10'],
        value: { title: 'gamma-10', status: 'done', state: 'done', priority: 2 },
      });
      expect(nonMatch.ok).toBe(true);
      await barrierTransaction(fixture);
      await sink.waitForCount(2);
      expect(keySequence(sink), 'AC1：集合语义（顺序无关、去重）→ 匹配通知 + 非匹配静默 + 屏障').toStrictEqual([
        ['t9'],
        ['t1'],
      ]);
    }
    expect(keySequence(duplicatedSink), 'AC1：两形态行为逐字节同构').toStrictEqual(keySequence(reorderedSink));
  });

  it('N12b（非承重文档行）：标量相等 = SameValue——NaN 匹配 NaN；±0 互不匹配', async () => {
    const nanFixture = await openPredicateLease();
    const nanSink = new NotificationSink();
    establishWatch(nanFixture.lease, ['plainTasks'], nanSink.listener, equalsWhere('priority', Number.NaN));
    expect(() =>
      rawTransact(nanFixture, () => {
        plainTasksOf(nanFixture).set('n1', { title: 'nan', state: 'open', priority: Number.NaN });
      }),
    ).not.toThrow();
    await nanSink.waitForCount(1);
    expect(keySequence(nanSink), 'F-4：NaN = NaN（Object.is 单源比较）匹配').toStrictEqual([['n1']]);

    const zeroFixture = await openPredicateLease();
    const zeroSink = new NotificationSink();
    establishWatch(zeroFixture.lease, ['plainTasks'], zeroSink.listener, equalsWhere('priority', 0));
    expect(() =>
      rawTransact(zeroFixture, () => {
        plainTasksOf(zeroFixture).set('z1', { title: 'neg-zero', state: 'open', priority: -0 });
      }),
    ).not.toThrow();
    // 屏障：同容器 raw 新增 priority = +0（匹配）→ 必通知。
    expect(() =>
      rawTransact(zeroFixture, () => {
        plainTasksOf(zeroFixture).set('p9', { title: 'zero', state: 'open', priority: 0 });
      }),
    ).not.toThrow();
    await zeroSink.waitForCount(1);
    expect(zeroSink.received.length, 'F-4：-0 ≠ +0（SameValue，非 SameValueZero）→ 精确静默').toBe(1);
    expect(keySequence(zeroSink), 'F-4：唯一通知来自屏障（-0 被精确剔除）').toStrictEqual([['p9']]);
  });

  it('N13（负控 NC7）：通知载荷零改动——三键/两键/不含值/kind 闭集', async () => {
    const fixture = await openPredicateLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['tasks'], sink.listener, openStatusPredicate());
    const write = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't9'],
      value: { title: `${SENTINEL}-N13`, status: 'open', state: 'open', priority: 1 },
    });
    expect(write.ok).toBe(true);
    await sink.waitForCount(1);
    expect(sink.received.length).toBe(1);
    const notification = expectDataNotification(sink.received[0]);
    expect(notification.origin, 'NC7：本地写 origin=local').toBe('local');
    expect(notification.changes, 'NC7：定位符 = 订阅容器路径 + 条目 key').toStrictEqual([
      { path: ['tasks'], key: 't9' },
    ]);
    expect(
      JSON.stringify(sink.received[0]).includes(SENTINEL),
      'NC7：通知不含值（payload 哨兵不得出现）',
    ).toBe(false);
    expectNotificationStreamKinds(sink);
  });

  it('N14（负控 NC1）：谓词订阅退订幂等零回声；lease 释放清理谓词订阅', async () => {
    const idempotent = await openPredicateLease();
    const removed = new NotificationSink();
    const alive = new NotificationSink();
    const handle = establishWatch(idempotent.lease, ['tasks'], removed.listener, openStatusPredicate());
    establishWatch(idempotent.lease, ['tasks'], alive.listener, openStatusPredicate());
    const first = await idempotent.lease.mutateData({
      op: 'set',
      path: ['tasks', 't9'],
      value: { title: 'gamma-9', status: 'open', state: 'open', priority: 1 },
    });
    expect(first.ok).toBe(true);
    await removed.waitForCount(1);
    await alive.waitForCount(1);

    handle.unsubscribe();
    handle.unsubscribe(); // 幂等：重复退订零 throw、零回声

    const second = await idempotent.lease.mutateData({
      op: 'set',
      path: ['tasks', 't10'],
      value: { title: 'gamma-10', status: 'open', state: 'open', priority: 2 },
    });
    expect(second.ok).toBe(true);
    await alive.waitForCount(2); // 屏障
    expect(removed.received.length, 'NC1：退订后零通知').toBe(1);

    const released = await openPredicateLease();
    const releasedSink = new NotificationSink();
    establishWatch(released.lease, ['tasks'], releasedSink.listener, openStatusPredicate());
    const survivorLease = await openSecondLease(released);
    const survivorSink = new NotificationSink();
    establishWatch(survivorLease, ['tasks'], survivorSink.listener, openStatusPredicate());
    const crossLease = await survivorLease.mutateData({
      op: 'set',
      path: ['tasks', 't9'],
      value: { title: 'cross', status: 'open', state: 'open', priority: 1 },
    });
    expect(crossLease.ok).toBe(true);
    await releasedSink.waitForCount(1);
    await survivorSink.waitForCount(1);

    await released.lease.release();
    expect(released.lease.getStatus().lease).toBe('released');
    const afterRelease = await survivorLease.mutateData({
      op: 'set',
      path: ['tasks', 't10'],
      value: { title: 'after-release', status: 'open', state: 'open', priority: 2 },
    });
    expect(afterRelease.ok).toBe(true);
    await survivorSink.waitForCount(2); // 屏障
    expect(releasedSink.received.length, 'NC1：lease 释放清理谓词订阅（零悬空回调）').toBe(1);
  });

  it('N15（SA8 action 5）：谓词求值期数据异常不抛、写不变、通知流零 error kind、订阅存活', async () => {
    const fixture = await openPredicateLease();
    const sink = new NotificationSink();
    establishWatch(fixture.lease, ['tasks'], sink.listener, openStatusPredicate());

    // ① raw 标量条目值（数据偏离 schema）；② status 字段值为对象；③ 深层嵌套数据。
    expect(() =>
      rawTransact(fixture, () => {
        tasksOf(fixture).set('s1', 42);
        tasksOf(fixture).set('o1', { title: 'obj', status: { deep: true }, state: 'open', priority: 1 });
        tasksOf(fixture).set('n1', { title: 'deep', status: { a: { b: { c: [1, 2, 3] } } }, state: 'open', priority: 2 });
      }),
    ).not.toThrow();

    // 后续合法写（匹配态退出匹配集 → C-2 必通知）→ 写结果不变 + 订阅存活。
    const write = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't1', 'status'],
      value: 'done',
    });
    expect(write.ok, 'SA8 action 5：求值异常不得改变写结果').toBe(true);
    await sink.waitForCount(1);
    expect(
      keySequence(sink).some((keys) => keys.includes('t1')),
      'SA8 action 5：订阅存活——后续匹配变更照常通知',
    ).toBe(true);
    expectNotificationStreamKinds(sink); // 零 error kind（三 kind 闭集）
  });
});

// ───────────────────────── 负控（读面 / 键集冻结） ─────────────────────────

describe('负控（NC2/NC5）：冻结面零改动', () => {
  it('NC：readData 恒四键（集中化 helper）、窗口读在产、窗口读载体码零改动、lease 恰 16 键', async () => {
    const fixture = await openPredicateLease();
    const read = fixture.lease.readData(['tasks']);
    expect(read.ok).toBe(true);
    if (read.ok) {
      // 形状断言集中化（#333/#336/#364 验收门）——不得内联四键字面量。
      expectReadDataOkKeys(read);
    }
    const window = fixture.lease.readMap(['tasks'], { n: 10, orderBy: { by: 'key' } });
    expect(window.ok, 'NC2：窗口读在产').toBe(true);
    const mismatch = fixture.lease.readMap(['workRecords'], { n: 1 });
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) {
      expect(mismatch.code, 'NC2：窗口读载体码零改动').toBe('WINDOW_CARRIER_MISMATCH');
    }
    const keys = Object.keys(fixture.lease).sort();
    expect(keys, 'NC2：lease 恰 16 键（谓词 = 原位签名加宽，不新增键）').toStrictEqual(
      [...LEASE_KEYS_BEFORE_WATCH_MAP, 'watchMap'].sort(),
    );
    expect(fixture.lease.owner).toStrictEqual(PREDICATE_OWNER);
  });
});
