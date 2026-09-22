/**
 * issue #441 SA6 验收契约（红灯面）— doc-runtime Record/parent mutation fast path 接线与
 * S9 收窄（ADR 0034 决策 1/2/3/4；issue #441 AC1/AC2/AC3/AC5/AC6 的运行时落点）。
 *
 * 本文件在 HEAD（#440 已合入、doc-runtime 未接线）**全红**，红因恒为能力缺口：
 *   FA 组：非 union Record 位（`tasks`/`codes`/`blobs`/`outer.inner`）与封闭对象 delete
 *          仍走 legacy 全量边界路径（S5 整 map / 父值提取 + S6 全量重建 + S9 重投影），
 *          触达面外污染照旧连带阻断写（ADR 0034 决策 4 的触达面收窄无载体）；
 *   FB 组：单键写的 live entry 读计数 ∝ n（Record）或 ∝ 父字段数（封闭对象）；O(n)→O(k)
 *          未接线；
 *   FC 组：S9 边界重投影核对所有 record/parent 提交（触达面外 observer 篡改 → E201-C），
 *          「fast-path 提交省略重投影核」无载体。
 *
 * 判据纪律：只观察运行时行为（判别联合结果、issue path、live Y.Map entry 读计数、update
 * 事件、最终逻辑值、branded fatal 事实）；无 skip/only/todo、无 env override、无 fallback、
 * 无源码字符串断言。
 * 恒绿对照面（union 永久 legacy、安装事实核、域规则逐字、零写入、commit 字节形态、复制面）
 * 见 `issue-441-record-fastpath-control.test.ts`。
 */
import { describe, expect, it } from 'vitest';
import {
  capture,
  countMapReads,
  fixture,
  item,
  logicalValueAt,
  rawItemEntry,
  rawSet,
  run,
  summarizeThrown,
  tamperOnNextLocalCommit,
  taskKey,
  withUpdates,
} from './issue-441-record-fastpath-fixture.js';

// ═══════════════════════════════════════════════════════════════════════════
// FA：闸门 —— 非 union Record 位与封闭对象 delete 走 fast path（触达面 = 载体 + 目标键位）
// ═══════════════════════════════════════════════════════════════════════════

describe('issue #441 FA — 非 union Record 位走 fast path（跳过整 map 提取/重建/重投影；ADR 0034 决策 1/4）', () => {
  it('FA1 Record set：触达面外（兄弟 entry）载体污染不阻断，ok:true + 单 update + 污染保留', () => {
    const fx = fixture();
    rawSet(fx.tasks, 't2', 'oops'); // raw replication 污染（触达面外）
    const captured = withUpdates(fx.doc, () =>
      run(fx, { op: 'set', path: ['tasks', 't1'], value: item('ok', 1) }));
    expect(captured.result).toEqual({ ok: true });
    expect(captured.count).toBe(1);
    expect(fx.tasks.get('t2')).toBe('oops'); // 未触达 entry 保持原样（不修复、不阻断）
    expect(logicalValueAt(fx.doc, ['tasks', 't1'])).toEqual(item('ok', 1));
  });

  it('FA2 Record delete（目标键干净）：触达面外污染不阻断，ok:true + 单 update + 污染保留', () => {
    const fx = fixture();
    rawSet(fx.tasks, 't2', 'oops');
    const captured = withUpdates(fx.doc, () => run(fx, { op: 'delete', path: ['tasks', 't1'] }));
    expect(captured.result).toEqual({ ok: true });
    expect(captured.count).toBe(1);
    expect(fx.tasks.has('t1')).toBe(false);
    expect(fx.tasks.get('t2')).toBe('oops');
  });

  it('FA3 Record delete（目标键自身即污染位）：删除照常成功（delete 不读该 entry 旧值）', () => {
    const fx = fixture();
    rawSet(fx.tasks, 't2', 'oops');
    const captured = withUpdates(fx.doc, () => run(fx, { op: 'delete', path: ['tasks', 't2'] }));
    expect(captured.result).toEqual({ ok: true });
    expect(captured.count).toBe(1);
    expect(fx.tasks.has('t2')).toBe(false);
  });

  it('FA4 Record set：兄弟 entry 载体正确但值非法（S6 全量重校验面）→ 不阻断', () => {
    const fx = fixture();
    rawSet(fx.tasks, 't2', rawItemEntry('bad', 'x')); // 载体正确、值 schema 非法
    const captured = withUpdates(fx.doc, () =>
      run(fx, { op: 'set', path: ['tasks', 't1'], value: item('ok', 1) }));
    expect(captured.result).toEqual({ ok: true });
    expect(captured.count).toBe(1);
    expect((fx.tasks.get('t2') as { get(k: string): unknown }).get('qty')).toBe('x'); // 污染未被修复
  });

  it('FA5 带 keyPattern 的 Record：兄弟键违约（键 Pattern 面）→ 不阻断目标键写入', () => {
    const fx = fixture();
    rawSet(fx.codes, 'nope', rawItemEntry('n', 1));
    const captured = withUpdates(fx.doc, () =>
      run(fx, { op: 'set', path: ['codes', 'id-2'], value: item('c2', 2) }));
    expect(captured.result).toEqual({ ok: true });
    expect(captured.count).toBe(1);
    expect(fx.codes.has('nope')).toBe(true);
    expect(logicalValueAt(fx.doc, ['codes', 'id-2'])).toEqual(item('c2', 2));
  });

  it('FA6 Record 值位为 union（blobs）：值位 union 不阻断 fast path（兄弟污染不连坐）', () => {
    const fx = fixture();
    rawSet(fx.blobs, 'b1', 'oops');
    const captured = withUpdates(fx.doc, () =>
      run(fx, { op: 'set', path: ['blobs', 'b2'], value: item('v', 5) }));
    expect(captured.result).toEqual({ ok: true });
    expect(captured.count).toBe(1);
    expect(fx.blobs.get('b1')).toBe('oops');
  });

  it('FA7 深层 Record（outer.inner）：兄弟污染不阻断，路径语义不变', () => {
    const fx = fixture();
    rawSet(fx.inner, 'n1', 'oops');
    const captured = withUpdates(fx.doc, () =>
      run(fx, { op: 'set', path: ['outer', 'inner', 'n2'], value: item('n2', 2) }));
    expect(captured.result).toEqual({ ok: true });
    expect(captured.count).toBe(1);
    expect(fx.inner.get('n1')).toBe('oops');
    expect(logicalValueAt(fx.doc, ['outer', 'inner', 'n2'])).toEqual(item('n2', 2));
  });

  it('FA8 批量信封：同一 Record map 的兄弟键写（触达面外污染）批内 ok:true + 单事务单 update', () => {
    const fx = fixture();
    rawSet(fx.tasks, 't2', 'oops');
    const captured = withUpdates(fx.doc, () =>
      run(fx, {
        ops: [
          { op: 'set', path: ['tasks', taskKey(8)], value: item('eight', 8) },
          { op: 'set', path: ['tasks', taskKey(9)], value: item('nine', 9) },
        ],
      }));
    expect(captured.result).toEqual({ ok: true });
    expect(captured.count).toBe(1);
    expect(fx.tasks.get('t2')).toBe('oops');
    expect(logicalValueAt(fx.doc, ['tasks', taskKey(8)])).toEqual(item('eight', 8));
    expect(logicalValueAt(fx.doc, ['tasks', taskKey(9)])).toEqual(item('nine', 9));
  });
});

describe('issue #441 FA-b — 封闭对象 delete 走 fast path（静态必填判定；ADR 0034 决策 2/4）', () => {
  it('FA9 delete optional 字段：触达面外（兄弟字段）污染不阻断，ok:true + 单 update', () => {
    const fx = fixture();
    rawSet(fx.obj, 'deep', 5); // 兄弟字段载体错位
    const captured = withUpdates(fx.doc, () => run(fx, { op: 'delete', path: ['obj', 'opt'] }));
    expect(captured.result).toEqual({ ok: true });
    expect(captured.count).toBe(1);
    expect(fx.obj.has('opt')).toBe(false);
    expect(fx.obj.get('deep')).toBe(5); // 污染保留
  });

  it('FA10 delete required 字段（兄弟污染在场）：静态必填判定拒绝（不再读父值转判载体错位）', () => {
    const fx = fixture();
    rawSet(fx.obj, 'deep', 5);
    const captured = withUpdates(fx.doc, () => run(fx, { op: 'delete', path: ['obj', 'req'] }));
    expect(captured.result).toEqual({
      ok: false,
      issues: [{ message: '缺少必填字段 "req"', path: ['obj', 'req'] }],
    });
    expect(captured.count).toBe(0);
    expect(fx.obj.get('req')).toBe('r'); // 未触达字段原样
  });

  it('FA11 delete unknown 字段：静态判定允许（缺席视同接受的现行语义保留）+ 污染不连坐', () => {
    const fx = fixture();
    rawSet(fx.obj, 'deep', 5);
    const captured = withUpdates(fx.doc, () => run(fx, { op: 'delete', path: ['obj', 'unk'] }));
    expect(captured.result).toEqual({ ok: true });
    expect(captured.count).toBe(1);
    expect(fx.obj.has('unk')).toBe(false);
    expect(fx.obj.get('deep')).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FB：O(n) → O(k) —— live entry 读计数与 n / 父字段数解耦（结构性证据，非计时阈值）
// ═══════════════════════════════════════════════════════════════════════════

describe('issue #441 FB — 单键写不再整 map 提取/重建/重投影（ADR 0034 决策 1/5）', () => {
  function recordSetReads(n: number): { value: number; presence: number } {
    const fx = fixture({ tasksN: n });
    const counted = countMapReads(fx.tasks, () =>
      run(fx, { op: 'set', path: ['tasks', taskKey(9)], value: item('nine', 9) }));
    expect(counted.result).toEqual({ ok: true });
    return { value: counted.counts.valueReads, presence: counted.counts.presenceReads };
  }

  function recordDeleteReads(n: number): { value: number; presence: number } {
    const fx = fixture({ tasksN: n });
    const counted = countMapReads(fx.tasks, () => run(fx, { op: 'delete', path: ['tasks', taskKey(0)] }));
    expect(counted.result).toEqual({ ok: true });
    return { value: counted.counts.valueReads, presence: counted.counts.presenceReads };
  }

  it('FB1 Record set：live entry 值读计数 ≤ 2 且与 n 解耦（legacy 现状 n=512→2049 / n=4096→16385）', () => {
    const at512 = recordSetReads(512);
    const at4096 = recordSetReads(4096);
    expect(at512.value, `n=512 值读计数应 ≈ 1（安装同一定位），实际 ${at512.value}`).toBeLessThanOrEqual(2);
    expect(at4096.value, `n=4096 值读计数应 ≈ 1（安装同一定位），实际 ${at4096.value}`).toBeLessThanOrEqual(2);
    expect(at4096.value, `值读计数应由目标键位决定而非 n：n=512→${at512.value} vs n=4096→${at4096.value}`)
      .toBe(at512.value);
  });

  it('FB2 Record delete：live entry 值读计数 ≤ 2（在场性读 ≤ 2）且与 n 解耦（legacy 现状 n=512→2046）', () => {
    const at512 = recordDeleteReads(512);
    const at4096 = recordDeleteReads(4096);
    expect(at512.value, `n=512 值读计数应 ≈ 0，实际 ${at512.value}`).toBeLessThanOrEqual(2);
    expect(at4096.value, `n=4096 值读计数应 ≈ 0，实际 ${at4096.value}`).toBeLessThanOrEqual(2);
    expect(at4096.value, `值读计数应由目标键位决定而非 n：n=512→${at512.value} vs n=4096→${at4096.value}`)
      .toBe(at512.value);
    expect(at512.presence).toBeLessThanOrEqual(2);
    expect(at4096.presence).toBeLessThanOrEqual(2);
  });

  it('FB3 封闭对象 delete：父值读计数 ≤ 2 且与父字段数解耦（legacy 现状 4 字段→8 / 14 字段→28）', () => {
    const narrowFx = fixture();
    const narrowCounted = countMapReads(narrowFx.narrow, () =>
      run(narrowFx, { op: 'delete', path: ['narrow', 'target'] }));
    expect(narrowCounted.result).toEqual({ ok: true });

    const wideFx = fixture();
    const wideCounted = countMapReads(wideFx.wide, () =>
      run(wideFx, { op: 'delete', path: ['wide', 'target'] }));
    expect(wideCounted.result).toEqual({ ok: true });

    expect(narrowCounted.counts.valueReads, '4 字段父对象值读计数应 ≈ 0').toBeLessThanOrEqual(2);
    expect(wideCounted.counts.valueReads, '14 字段父对象值读计数应 ≈ 0').toBeLessThanOrEqual(2);
    expect(wideCounted.counts.valueReads, '父值读计数应由目标键位决定而非字段数')
      .toBe(narrowCounted.counts.valueReads);
    expect(narrowCounted.counts.presenceReads).toBeLessThanOrEqual(2);
    expect(wideCounted.counts.presenceReads).toBeLessThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FC：S9 收窄 —— fast-path 提交省略边界重投影核（ADR 0034 决策 3）
// ═══════════════════════════════════════════════════════════════════════════

describe('issue #441 FC — fast-path 提交仅安装事实核（触达面外 observer 篡改不再 E201；已确认取舍）', () => {
  it('FC1 Record set：兄弟键被 observer 同事务删除 → 不抛 fatal、ok:true、doc 保持篡改状态', () => {
    const fx = fixture();
    tamperOnNextLocalCommit(fx.doc, () => {
      fx.tasks.delete('t2');
    });
    const thrown = capture(() => run(fx, { op: 'set', path: ['tasks', 't1'], value: item('x', 1) }));
    const summary = summarizeThrown(thrown);
    expect(thrown, `触达面外篡改不应触发 fatal（实际 ${summary.message.slice(0, 160)}）`).toBeUndefined();
    expect(fx.tasks.has('t2')).toBe(false);
    expect(logicalValueAt(fx.doc, ['tasks', 't1'])).toEqual(item('x', 1));
  });

  it('FC2 Record delete：兄弟键被 observer 同事务删除 → 不抛 fatal、ok:true', () => {
    const fx = fixture();
    tamperOnNextLocalCommit(fx.doc, () => {
      fx.tasks.delete('t2');
    });
    const thrown = capture(() => run(fx, { op: 'delete', path: ['tasks', 't0'] }));
    const summary = summarizeThrown(thrown);
    expect(thrown, `触达面外篡改不应触发 fatal（实际 ${summary.message.slice(0, 160)}）`).toBeUndefined();
    expect(fx.tasks.has('t0')).toBe(false);
    expect(fx.tasks.has('t2')).toBe(false);
  });

  it('FC3 Record set：兄弟键被 observer 同事务“新增” → 不抛 fatal（键集不参与 fast path 验证）', () => {
    const fx = fixture();
    tamperOnNextLocalCommit(fx.doc, () => {
      fx.tasks.set('t3', rawItemEntry('t3', 3));
    });
    const thrown = capture(() => run(fx, { op: 'set', path: ['tasks', 't1'], value: item('x', 1) }));
    const summary = summarizeThrown(thrown);
    expect(thrown, `触达面外篡改不应触发 fatal（实际 ${summary.message.slice(0, 160)}）`).toBeUndefined();
    expect(fx.tasks.has('t3')).toBe(true);
    expect(logicalValueAt(fx.doc, ['tasks', 't1'])).toEqual(item('x', 1));
  });

  it('FC4 封闭对象 delete：兄弟字段被 observer 同事务篡改 → 不抛 fatal、ok:true', () => {
    const fx = fixture();
    tamperOnNextLocalCommit(fx.doc, () => {
      fx.obj.set('deep', 5);
    });
    const thrown = capture(() => run(fx, { op: 'delete', path: ['obj', 'opt'] }));
    const summary = summarizeThrown(thrown);
    expect(thrown, `触达面外篡改不应触发 fatal（实际 ${summary.message.slice(0, 160)}）`).toBeUndefined();
    expect(fx.obj.has('opt')).toBe(false);
    expect(fx.obj.get('deep')).toBe(5);
  });
});
