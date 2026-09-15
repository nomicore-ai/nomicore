/**
 * issue #389（ADR 0030 T3「复制来源与订阅终止」）—— lease 公共面行为契约。
 *
 * 契约来源：
 * - issue #389 What-to-build + AC1–AC7；
 * - `wiki/raw/task_issue-389_sa6_contract.md` §12.1 绑定表 B-T3-0–B-T3-6、§12.2 用例映射
 *   C1–C11、§12.3 最小输入与期望、§12.5 断言纪律、§12.6 实现期红线；
 * - `wiki/raw/task_issue-389_design.md`（SA1 iteration 1，SA2 approve）§5 冻结裁定、
 *   §7-D1–D6、§12 验收映射；
 * - `docs/adr/0030-change-subscription.md` §4（三 kind / watch-end 流末条 / origin 两态）、
 *   §5（绝不按 origin 过滤）、§6（槽外异步分发 / 三来源全覆盖）；
 *   `docs/adr/0018-peer-schema-rearm.md` §1–§3（R5.6 re-arm 段位与失败语义）。
 *
 * 红灯机理（HEAD `28faeae`）：`watch-end` 只有类型联合成员、**零产出点** —— 通知流中
 * 恒不存在 `{kind:'watch-end',…}`（SA6 探针 2/3/4：三条路径 watch-end 计数恒 0），故
 * C3–C8 的终止前置屏障 `waitForWatchEnd(...)` 直接红；C1/C2（origin 补锚）、C9 的重建
 * 能力、C11（键集）与 NC 负控在 HEAD 即绿（红面精确落在「终止编排缺席」）。
 *
 * 断言纪律（SA6 §12.5）：通知形状逐键 `toStrictEqual`（data 恰三键 / watch-end 恰两键 /
 * 定位符恰两键）；`reason` 逐字；零 skip/only/todo、零 env override、零吞错、零软化断言、
 * 零源码字符串断言；静默断言用「提交一笔后续写 + 微任务双预算」而非 sleep；readData 成功
 * 形状经集中化 helper（#333/#336/#364 验收门）。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { NamespaceLeaseReleasedError } from '@nomicore/namespace-registry';
import { expectReadDataOkKeys } from '../../namespace-runtime/test/helpers/readdata-ok-shape.js';
import {
  buildT3Doc,
  captureOwnedUpdates,
  microtasks,
  openT3Hub,
  openT3Peer,
  openT3ResetFixture,
  remoteUpdateOf,
  replicationFactsOf,
  schemaEnvelope,
  T3_DOC_ID,
  T3_LEASE_KEYS,
  T3_NOTIFICATION_KINDS,
  T3_OWNER,
  T3_RUNTIME_KEYS,
  T3_SCHEMA_V2,
  T3Sink,
  waitForSchemaReady,
} from './issue-389-change-subscription-t3-fixture.js';

const OWNER = { userId: T3_OWNER.userId };

/** 远端 apply 的新键条目写（Yjs 确定性纪律：只写 live doc 尚不存在的新键）。 */
function scratchAddTask(scratch: Y.Doc, key: string, title: string, priority: number): void {
  const tasks = scratch.getMap('ROOT').get('tasks') as Y.Map<unknown>;
  const entry = new Y.Map<unknown>();
  entry.set('title', title);
  entry.set('priority', priority);
  tasks.set(key, entry);
}

// ═════════════════ C1/C2（AC1 + NC3）：复制来源与本地来源 ═════════════════

describe('组 C1/C2（AC1 + NC3）：复制 apply 与本地写同流——origin 两态、零过滤、零 watch-end', () => {
  it('C1/C2：本地写 origin=local、复制 apply origin=replication、同流 FIFO、零 watch-end', async () => {
    const hub = await openT3Hub({ replication: true });
    const sink = new T3Sink();
    hub.lease.watchMap(['tasks'], sink.listener);

    const local = await hub.lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: 'local-write', priority: 3 },
    });
    expect(local.ok, `AC1 前提：本地写应提交成功（${JSON.stringify(local)}）`).toBe(true);
    await sink.waitForCount(1);

    // 远端 update：live doc 全量状态 bootstrap 后只写**新键** t4（无同键并发项）
    const remoteBytes = remoteUpdateOf(hub.doc, (scratch) => {
      scratchAddTask(scratch, 't4', 'remote-apply', 4);
    });
    const applied = await hub.session!.applyRemoteUpdate(remoteBytes);
    expect(applied.ok, `AC1：复制 apply 应成功（${JSON.stringify(applied)}）`).toBe(true);
    await sink.waitForCount(2);

    expect(
      sink.kinds(),
      'AC1/NC3：本地写与复制 apply 同流 FIFO（绝不按 origin 过滤）',
    ).toStrictEqual(['data', 'data']);
    expect(sink.received[0], 'AC1：本地写 origin 逐字 local（恰三键形状）').toStrictEqual({
      kind: 'data',
      origin: 'local',
      changes: [{ path: ['tasks'], key: 't3' }],
    });
    expect(sink.received[1], 'AC1：复制 apply origin 逐字 replication（恰三键形状）').toStrictEqual({
      kind: 'data',
      origin: 'replication',
      changes: [{ path: ['tasks'], key: 't4' }],
    });
    expect(sink.watchEnds(), 'NC3：数据面变更从不产生 watch-end').toStrictEqual([]);
  });
});

// ═════════════════ C3（AC2-A）：Hub 本地 schema 变更 ═════════════════

describe('组 C3（AC2-A）：Hub 本地 replaceSchema → watch-end schema-changed', () => {
  it('C3：替换 schema ok（oracle 绿）→ 滞留 data 先达、流末条 watch-end schema-changed', async () => {
    const hub = await openT3Hub();
    const sink = new T3Sink();
    hub.lease.watchMap(['tasks'], sink.listener);

    const write = await hub.lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: 'before-schema-change', priority: 3 },
    });
    expect(write.ok, '契约前提失败：schema 变更前的本地写应提交成功').toBe(true);
    await sink.waitForCount(1); // 屏障：该事务的 data 已送达

    const replaced = await hub.lease.replaceSchema({ schema: schemaEnvelope(T3_SCHEMA_V2) });
    expect(replaced.ok, `AC2 oracle 前置：replaceSchema 应 ok（${JSON.stringify(replaced)}）`).toBe(true);
    const active = hub.lease.getSchema();
    expect(typeof active?.text, 'AC2 oracle：active schema 文本已切换').toBe('string');
    expect(active?.text, 'AC2 oracle：active schema 已是 V2（note 字段在场）').toContain('note?: YLeaf<string>');

    await sink.waitForWatchEnd('schema-changed'); // 终止前置屏障（HEAD 红：流中无 watch-end）
    expect(
      sink.kinds(),
      'AC2/AC5：终止前 data 先达，watch-end 为流末条',
    ).toStrictEqual(['data', 'watch-end']);
    expect(sink.last(), 'AC2：流末条形状恰 `{kind,reason}`、reason 逐字 schema-changed').toStrictEqual({
      kind: 'watch-end',
      reason: 'schema-changed',
    });
    expect(hub.lease.getStatus().lease, 'AC6 前置：schema-changed 不释放 lease（订阅生命周期只与 lease/schema 耦合）').toBe(
      'active',
    );
  });
});

// ═════════════════ C4（AC2-B）：Peer 复制 apply 槽 schema re-arm ═════════════════

describe('组 C4（AC2-B）：Peer re-arm 路径 → watch-end schema-changed（ADR 0018）', () => {
  it('C4：re-arm applied（指纹双侧一致 oracle 绿）→ peer 流末条 watch-end schema-changed', async () => {
    const hub = await openT3Hub({ replication: true });
    const peer = await openT3Peer(hub);
    const sink = new T3Sink();
    peer.lease.watchMap(['tasks'], sink.listener);

    const localWrite = await peer.lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: 'peer-local', priority: 3 },
    });
    expect(localWrite.ok, '契约前提失败：peer 本地写应提交成功').toBe(true);
    await sink.waitForCount(1);

    const owned = captureOwnedUpdates(hub.session!);
    const replaced = await hub.lease.replaceSchema({ schema: schemaEnvelope(T3_SCHEMA_V2) });
    expect(replaced.ok, '契约前提失败：hub replaceSchema 应 ok').toBe(true);
    await owned.waitForCount(1);

    const applied = await peer.session.applyRemoteUpdate(owned.updates[0]!);
    expect(applied.ok, `AC2-B：peer apply 应成功（${JSON.stringify(applied)}）`).toBe(true);
    if (!applied.ok) return;
    expect(
      applied.schemaRearm?.kind,
      'AC2-B oracle 前置：R5.6 re-arm 必须已 applied（红灯不得误归因于 re-arm 未发生）',
    ).toBe('applied');
    const hubActive = hub.lease.getActiveSchema();
    const peerActive = peer.lease.getActiveSchema();
    expect(peerActive?.semanticFingerprint, 'AC2-B oracle：peer 指纹与 hub V2 逐字节一致').toBe(
      hubActive?.semanticFingerprint,
    );

    await sink.waitForWatchEnd('schema-changed');
    expect(sink.kinds(), 'AC2-B：peer 流 = [data(local), watch-end]（schema 变更零 data）').toStrictEqual([
      'data',
      'watch-end',
    ]);
    expect(sink.last()).toStrictEqual({ kind: 'watch-end', reason: 'schema-changed' });
  });

  it('C4b（B-T3-2 冻结：失败也发）：re-arm failed（fatal INVALID）仍发 watch-end schema-changed', async () => {
    const hub = await openT3Hub({ replication: true });
    const peer = await openT3Peer(hub);
    const sink = new T3Sink();
    peer.lease.watchMap(['tasks'], sink.listener);

    // 损坏 text 的远端 update（peer 角色对 SCHEMA 无保护门——ADR 0018 §3 fatal 分支构造）
    const corrupt = remoteUpdateOf(peer.doc, (scratch) => {
      scratch.getMap('SCHEMA').set('text', 'type ROOT = ;;;;');
    });
    const applied = await peer.session.applyRemoteUpdate(corrupt);
    expect(applied.ok, 'ADR 0018 §3：re-arm fatal 不失败 apply 槽本身（apply 仍 ok）').toBe(true);
    if (!applied.ok) return;
    expect(
      applied.schemaRearm?.kind,
      'B-T3-2 oracle：损坏 text 必须走 re-arm failed 分支（否则本用例不可判）',
    ).toBe('failed');

    await sink.waitForWatchEnd('schema-changed');
    expect(sink.last(), 'B-T3-2：终止因 = 已提交的 schema text 变更（与 re-arm 成败正交）').toStrictEqual({
      kind: 'watch-end',
      reason: 'schema-changed',
    });
  });
});

// ═════════════════ C5/C7/C10（AC3/AC4/AC6）：doc 替换（reset） ═════════════════

describe('组 C5/C7/C10（AC3 + AC4 + AC6）：doc 替换 → watch-end doc-replaced', () => {
  it('C5：reset ok（归档 1 次）→ 结算即已含已投递末条 watch-end doc-replaced（免 poll）', async () => {
    const fixture = await openT3ResetFixture();
    const sink = new T3Sink();
    const handle = fixture.lease.watchMap(['tasks'], sink.listener);

    const write = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: 'before-reset', priority: 3 },
    });
    expect(write.ok, '契约前提失败：reset 前本地写应提交成功').toBe(true);
    await sink.waitForCount(1); // 屏障：滞留 data 已投递（FIFO 前置）

    const reset = await fixture.registry.resetReplica(OWNER, T3_DOC_ID, fixture.identity);
    expect(reset.ok, `AC3：resetReplica 应 ok（${JSON.stringify(reset)}）`).toBe(true);
    expect(fixture.persistence.archiveCalls.length, 'AC3 装置 oracle：归档恰 1 次').toBe(1);

    expect(
      sink.kinds(),
      'AC3/B-T3-3：reset 结算时订阅流已含已投递末条 watch-end（投递结算并入 close 承诺）',
    ).toStrictEqual(['data', 'watch-end']);
    expect(sink.last(), 'AC3：reason 逐字 doc-replaced（恰两键形状）').toStrictEqual({
      kind: 'watch-end',
      reason: 'doc-replaced',
    });
    expect(fixture.lease.getStatus().lease, 'AC6：doc 替换后 lease 走既有 released 通道').toBe('released');

    // C7（AC4）：终止后 unsubscribe 幂等 no-op——×2 零 throw、零新增通知
    handle.unsubscribe();
    handle.unsubscribe();
    expect(sink.kinds()).toStrictEqual(['data', 'watch-end']);
  });

  it('C10（AC6）：doc-replaced 后重建——released 通道 + 重新 open 后新订阅可用且无终止信号', async () => {
    const fixture = await openT3ResetFixture();
    const sink = new T3Sink();
    fixture.lease.watchMap(['tasks'], sink.listener);
    const write = await fixture.lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: 'before-reset', priority: 3 },
    });
    expect(write.ok).toBe(true);
    await sink.waitForCount(1);

    const reset = await fixture.registry.resetReplica(OWNER, T3_DOC_ID, fixture.identity);
    expect(reset.ok).toBe(true);
    await sink.waitForWatchEnd('doc-replaced');

    // 旧 lease：released 通道（零新接缝）
    expect(
      () => fixture.lease.watchMap(['tasks'], () => {}),
      'AC6/B-T3-5：doc-replaced 后 lease 已 released——重建经既有 NamespaceLeaseReleasedError 通道',
    ).toThrow(NamespaceLeaseReleasedError);

    // 重建：归档后 key 缺席 = bootstrap 资格（Registry 编排），重新 open 后订阅生命周期重新开始
    fixture.persistence.seedDocument(T3_OWNER, T3_DOC_ID, buildT3Doc());
    const reopened = await fixture.registry.open(OWNER, T3_DOC_ID);
    expect(reopened.ok, `AC6：重建 open 应成功（${JSON.stringify(reopened)}）`).toBe(true);
    if (!reopened.ok) return;
    await waitForSchemaReady(reopened.lease);
    const reborn = new T3Sink();
    reopened.lease.watchMap(['tasks'], reborn.listener);
    const rebornWrite = await reopened.lease.mutateData({
      op: 'set',
      path: ['tasks', 't4'],
      value: { title: 'reborn', priority: 4 },
    });
    expect(rebornWrite.ok, 'AC6：重建后的 lease 应可写').toBe(true);
    await reborn.waitForCount(1);
    expect(reborn.received[0]).toStrictEqual({
      kind: 'data',
      origin: 'local',
      changes: [{ path: ['tasks'], key: 't4' }],
    });
    expect(reborn.watchEnds(), 'AC6：新订阅零终止信号（生命周期只与 lease 和 schema 耦合）').toStrictEqual([]);
  });
});

// ═════════════════ C6/C8（AC4 + AC5）：流末条静默与 FIFO 必达 ═════════════════

describe('组 C6/C8（AC4 + AC5）：watch-end 流末条——此后静默、滞留 data 必达', () => {
  it('C6：终止后「写 + 双预算屏障」零新增通知（含 invalidate-all 不后置）', async () => {
    const hub = await openT3Hub();
    const sink = new T3Sink();
    hub.lease.watchMap(['tasks'], sink.listener);
    const write = await hub.lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: 'before', priority: 3 },
    });
    expect(write.ok).toBe(true);
    await sink.waitForCount(1);

    const replaced = await hub.lease.replaceSchema({ schema: schemaEnvelope(T3_SCHEMA_V2) });
    expect(replaced.ok).toBe(true);
    await sink.waitForWatchEnd('schema-changed');
    const before = sink.received.length;

    const afterFirst = await hub.lease.mutateData({
      op: 'set',
      path: ['tasks', 't6'],
      value: { title: 'after-termination', priority: 6, note: 'v2-field' },
    });
    expect(afterFirst.ok, 'AC6 前置：终止后 lease 仍 active，新 schema 下写合法').toBe(true);
    await microtasks(400); // 预算 1（> 20 微任务/项 × 队列上界）
    const afterSecond = await hub.lease.mutateData({
      op: 'set',
      path: ['tasks', 't7'],
      value: { title: 'after-termination-2', priority: 7, note: 'v2-field-2' },
    });
    expect(afterSecond.ok).toBe(true);
    await microtasks(400); // 预算 2

    expect(sink.received.length, 'AC4：终止后零新增通知（订阅已注销、零入队点）').toBe(before);
    expect(sink.last()).toStrictEqual({ kind: 'watch-end', reason: 'schema-changed' });
  });

  it('C8（B-T3-6 必达）：多笔快连事务后立即 replaceSchema——data 全部先于 watch-end、末条恒终止项', async () => {
    const hub = await openT3Hub();
    const sink = new T3Sink();
    hub.lease.watchMap(['tasks'], sink.listener);

    // 确定性配方（SA6 §12.3 C8）：不等泵投递连续提交 3 笔事务，随后立即 replaceSchema
    const first = hub.lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: 'fifo-1', priority: 3 },
    });
    const second = hub.lease.mutateData({
      op: 'set',
      path: ['tasks', 't4'],
      value: { title: 'fifo-2', priority: 4 },
    });
    const third = hub.lease.mutateData({
      op: 'set',
      path: ['tasks', 't5'],
      value: { title: 'fifo-3', priority: 5 },
    });
    const replaced = hub.lease.replaceSchema({ schema: schemaEnvelope(T3_SCHEMA_V2) });
    const settled = await Promise.all([first, second, third, replaced]);
    for (const result of settled) {
      expect(result.ok, `C8 前提：${JSON.stringify(result)}`).toBe(true);
    }

    await sink.waitForWatchEnd('schema-changed');
    expect(sink.last(), 'C8(i)：watch-end 为流末条（绕过队列的实现先到终止项即红）').toStrictEqual({
      kind: 'watch-end',
      reason: 'schema-changed',
    });
    expect(
      sink.dataKeys(),
      'C8(ii)/B-T3-6：终止前已提交事务的 data 全部先于 watch-end 到达（清队丢滞留 data 即红）',
    ).toStrictEqual(['t3', 't4', 't5']);
    expect(sink.kinds(), 'C8(iii)：终止后零通知').toStrictEqual([
      'data',
      'data',
      'data',
      'watch-end',
    ]);
  });

  it('CAP（容量豁免不变量）：>16 笔快连事务溢出降级后 watch-end 仍恒入队且为末条', async () => {
    const hub = await openT3Hub();
    const sink = new T3Sink();
    hub.lease.watchMap(['tasks'], sink.listener);

    const writes: Array<Promise<unknown>> = [];
    for (let index = 0; index < 64; index += 1) {
      writes.push(
        hub.lease.mutateData({
          op: 'set',
          path: ['tasks', `k${index}`],
          value: { title: `k${index}`, priority: index },
        }),
      );
    }
    const replaced = hub.lease.replaceSchema({ schema: schemaEnvelope(T3_SCHEMA_V2) });
    const settled = await Promise.all([...writes, replaced]);
    for (const result of settled as Array<{ ok?: boolean }>) {
      expect(result.ok).toBe(true);
    }

    await sink.waitForWatchEnd('schema-changed');
    expect(
      sink.invalidateAllCount(),
      'CAP：溢出语义不变（data 入队路径降级——T4 #390 前置锚）',
    ).toBeGreaterThanOrEqual(1);
    expect(sink.last(), 'CAP：终止项不因容量上限被丢弃（容量豁免）——恒为流末条').toStrictEqual({
      kind: 'watch-end',
      reason: 'schema-changed',
    });
  });
});

// ═════════════════ C9（AC6）：终止后重建订阅 ═════════════════

describe('组 C9（AC6）：schema-changed 后重建订阅', () => {
  it('C9：lease 仍 active——重新 watchMap 按新 schema 建立并投递；旧句柄静默/幂等', async () => {
    const hub = await openT3Hub();
    const oldSink = new T3Sink();
    const oldHandle = hub.lease.watchMap(['tasks'], oldSink.listener);
    const write = await hub.lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: 'old-generation', priority: 3 },
    });
    expect(write.ok).toBe(true);
    await oldSink.waitForCount(1);

    const replaced = await hub.lease.replaceSchema({ schema: schemaEnvelope(T3_SCHEMA_V2) });
    expect(replaced.ok).toBe(true);
    await oldSink.waitForWatchEnd('schema-changed');
    expect(hub.lease.getStatus().lease, 'AC6：schema-changed 只有订阅终止，lease 不释放').toBe('active');

    const reborn = new T3Sink();
    hub.lease.watchMap(['tasks'], reborn.listener);
    const rebornWrite = await hub.lease.mutateData({
      op: 'set',
      path: ['tasks', 't5'],
      value: { title: 'rebuilt-under-v2', priority: 5, note: 'v2-note' },
    });
    expect(rebornWrite.ok, 'AC6：重建订阅后新 schema 下写合法（V2 note 字段）').toBe(true);
    await reborn.waitForCount(1);
    expect(reborn.received[0]).toStrictEqual({
      kind: 'data',
      origin: 'local',
      changes: [{ path: ['tasks'], key: 't5' }],
    });
    expect(reborn.watchEnds(), 'AC6：新订阅零终止信号').toStrictEqual([]);

    const oldCount = oldSink.received.length;
    await microtasks(400);
    expect(oldSink.received.length, 'AC4：旧（已终止）订阅静默——终止后零通知').toBe(oldCount);
    oldHandle.unsubscribe();
    oldHandle.unsubscribe(); // AC4：终止后退订幂等 no-op（零 throw）
    expect(oldSink.received.length).toBe(oldCount);
  });
});

// ═════════════════ C11（AC7）：零新接缝 ═════════════════

describe('组 C11（AC7）：零新接缝——键集与通知闭集', () => {
  it('C11：lease 恰 16 键、runtime 恰 15 键、通知 kind ⊆ 三 kind 闭集、读面冻结', async () => {
    const hub = await openT3Hub();
    expect(Object.keys(hub.lease).sort(), 'AC7：lease 16 键冻结（T3 零新增公共成员）').toStrictEqual(
      T3_LEASE_KEYS,
    );
    expect(Object.keys(hub.runtime as object).sort(), 'AC7：runtime 15 键冻结').toStrictEqual(
      T3_RUNTIME_KEYS,
    );
    const read = hub.lease.readData(['tasks']);
    expect(read.ok).toBe(true);
    if (read.ok) expectReadDataOkKeys(read); // #333/#336/#364 集中化形状门

    const sink = new T3Sink();
    hub.lease.watchMap(['tasks'], sink.listener);
    const write = await hub.lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: 'closure', priority: 3 },
    });
    expect(write.ok).toBe(true);
    const replaced = await hub.lease.replaceSchema({ schema: schemaEnvelope(T3_SCHEMA_V2) });
    expect(replaced.ok).toBe(true);
    await sink.waitForWatchEnd('schema-changed');

    for (const notification of sink.received) {
      expect(
        T3_NOTIFICATION_KINDS,
        `AC7：通知流零参数错误——kind 必须 ∈ 三 kind 闭集，实际 ${JSON.stringify(notification)}`,
      ).toContain(notification.kind);
    }
    expect(hub.lease.getStatus().lease).toBe('active');
  });
});

// ═════════════════ 负控（NC3–NC6）：实现后必须保持全绿 ═════════════════

describe('负控 NC3–NC6：数据面与写面纪律零回归', () => {
  it('NC5：数据缺席 / 容器删除**不终结**订阅（终止只与 lease 和 schema 耦合）', async () => {
    const hub = await openT3Hub({ seedOptionalTasks: true });
    const ghostSink = new T3Sink();
    hub.lease.watchMap(['ghost'], ghostSink.listener);
    const optionalSink = new T3Sink();
    hub.lease.watchMap(['optionalTasks'], optionalSink.listener);

    const deleted = await hub.lease.mutateData({ op: 'delete', path: ['optionalTasks'] });
    expect(deleted.ok, 'NC5 前提：可选容器应可合法删除').toBe(true);
    await microtasks(400);
    expect(ghostSink.watchEnds(), 'NC5：未物化容器订阅零终止信号').toStrictEqual([]);
    expect(optionalSink.watchEnds(), 'NC5：容器删除零终止信号（删除 ≠ 替换）').toStrictEqual([]);

    const recreated = await hub.lease.mutateData({
      op: 'set',
      path: ['optionalTasks'],
      value: { t9: { title: 'revived', priority: 1 } },
    });
    expect(recreated.ok, 'NC5：容器重建合法').toBe(true);
    const appended = await hub.lease.mutateData({
      op: 'set',
      path: ['optionalTasks', 't10'],
      value: { title: 'after-recreate', priority: 2 },
    });
    expect(appended.ok).toBe(true);
    // T4 #390（rebase 适配）：严格祖先删除先产生一条 invalidate-all（订阅存活——非
    // watch-end，NC5 的「删除 ≠ 终止」断言不变）；重建后 data(t10) 为第 2 条通知，
    // 屏障须等满 2 条（原「删除零通知」计数假设不再成立）。
    await optionalSink.waitForCount(2);
    expect(optionalSink.dataKeys(), 'NC5：订阅横跨缺席期，重建后条目定位符照常到达').toContain('t10');
    expect(ghostSink.watchEnds()).toStrictEqual([]);
    expect(optionalSink.watchEnds()).toStrictEqual([]);
  });

  it('NC6：无效写（schema 拒绝）零事务零通知（通知面与写结果一致）', async () => {
    const hub = await openT3Hub();
    const sink = new T3Sink();
    hub.lease.watchMap(['tasks'], sink.listener);

    const invalid = await hub.lease.mutateData({
      op: 'set',
      path: ['tasks', 'bad'],
      value: { title: 1 },
    });
    expect(invalid.ok, 'NC6 前提：违反 schema 的写应被拒绝').toBe(false);
    const valid = await hub.lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: 'valid-after-invalid', priority: 3 },
    });
    expect(valid.ok).toBe(true);
    await sink.waitForCount(1);
    expect(sink.kinds(), 'NC6：无效写零通知（一事务一通知的反面）').toStrictEqual(['data']);
    expect(sink.dataKeys()).toStrictEqual(['t3']);
  });

  it('NC3 补充：复制启用后本地写仍 origin=local、远端 apply 恒 replication（无过滤面）', async () => {
    const hub = await openT3Hub({ replication: true });
    const sink = new T3Sink();
    hub.lease.watchMap(['tasks'], sink.listener);
    const first = await hub.lease.mutateData({
      op: 'set',
      path: ['tasks', 't3'],
      value: { title: 'no-filter-1', priority: 3 },
    });
    expect(first.ok).toBe(true);
    const bytes = remoteUpdateOf(hub.doc, (scratch) => {
      scratchAddTask(scratch, 't4', 'no-filter-2', 4);
    });
    const applied = await hub.session!.applyRemoteUpdate(bytes);
    expect(applied.ok).toBe(true);
    await sink.waitForCount(2);
    expect(sink.dataNotifications().map((notification) => notification.origin)).toStrictEqual([
      'local',
      'replication',
    ]);
    expect(sink.watchEnds()).toStrictEqual([]);
  });
});

// ═════════════════ 装置自检（前提 oracle；红不得来自装置） ═════════════════

describe('装置自检：hub/peer/reset 三装置前提为绿（红灯不得误归因于 fixture）', () => {
  it('hub 复制装置：enableReplication + session + 身份投影一致', async () => {
    const hub = await openT3Hub({ replication: true });
    const identity = replicationFactsOf(hub.lease);
    expect(identity.replicationId).toMatch(/^[0-9a-f]{32}$/);
    expect(identity.replicationEpoch).toBeGreaterThanOrEqual(1);
    expect(hub.session?.getStatus().state, 'session 前提：open').toBe('open');
  });

  it('peer 装置：importReplica 排他创建 + peer session 就绪', async () => {
    const hub = await openT3Hub({ replication: true });
    const peer = await openT3Peer(hub);
    expect(peer.persistence.importCalls.length).toBe(1);
    expect(peer.session.getStatus().localRole).toBe('peer');
    expect(peer.lease.getActiveSchema()?.semanticFingerprint).toBe(
      hub.lease.getActiveSchema()?.semanticFingerprint,
    );
  });

  it('reset 装置：种子复制身份在 live 投影与 persisted 双源一致', async () => {
    const fixture = await openT3ResetFixture();
    expect(replicationFactsOf(fixture.lease)).toStrictEqual(fixture.identity);
    const probe = await fixture.persistence.readPersistedReplicationIdentity(T3_OWNER, T3_DOC_ID);
    expect(probe.kind).toBe('found');
  });
});
