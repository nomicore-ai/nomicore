/**
 * issue #436 SA6 验收契约（红灯面）— doc-runtime 数组 mutation fast path 接线与 S9 收窄
 * （ADR 0033 决策 1/2/3/4；issue #436 AC1/AC2/AC3/AC6 的运行时落点）。
 *
 * 本文件在 HEAD（#435 已合入、doc-runtime 未接线）**全红**，红因恒为能力缺口：
 *   FA 组：非 union `T[]` 目标仍走 legacy 全量边界路径（S5 整数组提取 + S6 全量重建），
 *          区间外污染照旧阻断写（ADR 0033 决策 4 的触达面收窄无载体）；
 *   FB 组：单元素写的 live 元素读计数 ∝ n（O(n) 未解耦）；越界拒绝前先整数组提取
 *          （O(1) live 长度检查未接线）；
 *   FC 组：S9 边界重投影核对所有数组提交（区间外 observer 篡改 → E201-C），
 *          「fast-path 提交省略重投影核」无载体。
 *
 * 判据纪律：只观察运行时行为（判别联合结果、issue path、live 元素读计数、update 事件、
 * 最终逻辑值）；无 skip/only/todo、无 env override、无 fallback、无源码字符串断言。
 * 恒绿对照面（union 双轨、安装事实核、域规则逐字、零写入、commit 字节形态）见
 * `issue-436-array-fastpath-control.test.ts`。
 */
import { describe, expect, it } from 'vitest';
import {
  capture,
  countElementReads,
  fixture,
  run,
  summarizeThrown,
  tamperOnNextLocalCommit,
  withUpdates,
} from './issue-436-array-fastpath-fixture.js';

// ═══════════════════════════════════════════════════════════════════════════
// FA：闸门 —— 非 union `T[]` 目标走 fast path（触达面 = 载体 + 变更区间）
// ═══════════════════════════════════════════════════════════════════════════

describe('issue #436 FA — 非 union T[] 目标走 fast path（跳过整数组提取；ADR 0033 决策 1/4）', () => {
  it('FA1 区间外污染不阻断 array-delete：ok:true + 单 update + 污染保留（legacy 现状为响亮拒绝）', () => {
    const fx = fixture({ n: 5 });
    fx.items.insert(0, ['oops' as unknown as number]); // raw replication 污染（变更区间外）
    const captured = withUpdates(fx.doc, () => run(fx, { op: 'array-delete', path: ['items'], index: 2, count: 1 }));
    expect(captured.result).toEqual({ ok: true });
    expect(captured.count).toBe(1);
    expect(fx.items.toJSON()).toEqual(['oops', 1, 3, 4, 5]);
  });

  it('FA2 区间外污染不阻断 array-insert（合法新值逐元素过 schema；污染元素不被读取/修复）', () => {
    const fx = fixture({ n: 3 });
    fx.rows.get(0)!.set('qty', 'x'); // 区间外污染（元素 is Y.Map，字段非法）
    const captured = withUpdates(fx.doc, () =>
      run(fx, { op: 'array-insert', path: ['rows'], index: 1, values: [{ qty: 9, tag: 'z' }] }));
    expect(captured.result).toEqual({ ok: true });
    expect(captured.count).toBe(1);
    expect(fx.rows.length).toBe(4);
    expect(fx.rows.get(1)!.toJSON()).toEqual({ qty: 9, tag: 'z' });
    expect(fx.rows.get(0)!.get('qty')).toBe('x'); // 未触达元素保持原样（不修复、不阻断）
  });

  it('FA3 批量信封内的数组分支同样按闸门分流：污染数组 delete 在批内 ok:true', () => {
    const fx = fixture({ n: 5 });
    fx.items.insert(0, ['oops' as unknown as number]);
    const result = run(fx, { ops: [{ op: 'array-delete', path: ['items'], index: 2, count: 1 }] });
    expect(result).toEqual({ ok: true });
    expect(fx.items.toJSON()).toEqual(['oops', 1, 3, 4, 5]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FB：O(n) → O(k) —— live 元素读计数与 n 解耦（结构性证据，非计时阈值）
// ═══════════════════════════════════════════════════════════════════════════

describe('issue #436 FB — 单元素写不再整数组提取/重投影（ADR 0033 决策 2/6）', () => {
  function appendReads(n: number): number {
    const fx = fixture({ n });
    const instrumented = countElementReads(fx.items, () =>
      run(fx, { op: 'array-insert', path: ['items'], index: n, values: [777] }));
    expect(instrumented.result).toEqual({ ok: true });
    return instrumented.reads;
  }

  function deleteReads(n: number): number {
    const fx = fixture({ n });
    const instrumented = countElementReads(fx.items, () =>
      run(fx, { op: 'array-delete', path: ['items'], index: 0, count: 1 }));
    expect(instrumented.result).toEqual({ ok: true });
    return instrumented.reads;
  }

  it('FB1 单元素 append 的元素读计数 ≤ k+余量 且与 n 解耦（legacy 现状 n=512→1026 / n=4096→8194）', () => {
    const at512 = appendReads(512);
    const at4096 = appendReads(4096);
    expect(at512, `n=512 读计数应 ≈ k（≤8），实际 ${at512}`).toBeLessThanOrEqual(8);
    expect(at4096, `n=4096 读计数应 ≈ k（≤8），实际 ${at4096}`).toBeLessThanOrEqual(8);
    expect(at4096, `读计数应由变更量决定而非 n：n=512→${at512} vs n=4096→${at4096}`).toBe(at512);
  });

  it('FB2 单元素 delete 的元素读计数 ≤ 余量 且与 n 解耦（legacy 现状 n=512→1023 / n=4096→8191）', () => {
    const at512 = deleteReads(512);
    const at4096 = deleteReads(4096);
    expect(at512, `n=512 读计数应 ≈ 0（≤8），实际 ${at512}`).toBeLessThanOrEqual(8);
    expect(at4096, `n=4096 读计数应 ≈ 0（≤8），实际 ${at4096}`).toBeLessThanOrEqual(8);
    expect(at4096, `读计数应由变更量决定而非 n：n=512→${at512} vs n=4096→${at4096}`).toBe(at512);
  });

  it('FB3 越界拒绝基于 live 长度（O(1) 元素读）且逐字域规则不变（legacy 现状先 walk 全数组）', () => {
    const fxDelete = fixture({ n: 512 });
    const del = countElementReads(fxDelete.items, () =>
      run(fxDelete, { op: 'array-delete', path: ['items'], index: 512, count: 1 }));
    expect(del.result).toEqual({
      ok: false,
      issues: [{ message: 'array-delete 范围越界（不 clamp、不接受越界 no-op）', path: ['items', 512] }],
    });
    expect(del.reads, `越界 delete 读计数应 O(1)（≤4），实际 ${del.reads}`).toBeLessThanOrEqual(4);

    const fxInsert = fixture({ n: 512 });
    const ins = countElementReads(fxInsert.items, () =>
      run(fxInsert, { op: 'array-insert', path: ['items'], index: 513, values: [1] }));
    expect(ins.result).toEqual({
      ok: false,
      issues: [{ message: 'array-insert index 越界（不 clamp）', path: ['items', 513] }],
    });
    expect(ins.reads, `越界 insert 读计数应 O(1)（≤4），实际 ${ins.reads}`).toBeLessThanOrEqual(4);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FC：S9 收窄 —— fast-path 提交省略边界重投影核（ADR 0033 决策 3）
// ═══════════════════════════════════════════════════════════════════════════

describe('issue #436 FC — fast-path 提交仅安装事实核（区间外 observer 篡改不再 E201；已确认取舍）', () => {
  it('FC1 fast-path insert：区间外元素被 observer 篡改 → 不抛 fatal、ok:true、doc 保持篡改状态', () => {
    const fx = fixture({ n: 5 });
    tamperOnNextLocalCommit(fx.doc, () => {
      fx.items.delete(0, 1);
      fx.items.insert(0, [99]); // 长度不变、位于变更区间 [3,4) 之外
    });
    const thrown = capture(() => run(fx, { op: 'array-insert', path: ['items'], index: 3, values: [22] }));
    const summary = summarizeThrown(thrown);
    expect(thrown, `区间外篡改不应触发 fatal（实际 ${summary.message.slice(0, 160)}）`).toBeUndefined();
    expect(fx.items.toJSON()).toEqual([99, 2, 3, 22, 4, 5]);
  });

  it('FC2 fast-path delete：区间外元素被 observer 篡改（长度不变）→ 不抛 fatal、ok:true', () => {
    const fx = fixture({ n: 5 });
    tamperOnNextLocalCommit(fx.doc, () => {
      fx.items.delete(0, 1);
      fx.items.insert(0, [99]); // 位于被删区间 [3,4) 之外
    });
    const thrown = capture(() => run(fx, { op: 'array-delete', path: ['items'], index: 3, count: 1 }));
    const summary = summarizeThrown(thrown);
    expect(thrown, `区间外篡改不应触发 fatal（实际 ${summary.message.slice(0, 160)}）`).toBeUndefined();
    expect(fx.items.toJSON()).toEqual([99, 2, 3, 5]);
  });
});
