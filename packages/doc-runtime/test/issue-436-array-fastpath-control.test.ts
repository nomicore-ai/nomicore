/**
 * issue #436 SA6 负控 / 回归锚（恒绿面）— 数组 mutation 双轨的 legacy 轨、安装事实核、
 * 域规则逐字、零写入与 commit 字节形态。
 *
 * 本文件在 HEAD 全绿，实现落地后必须保持全绿：
 *   NA 组：union 数组目标 / union 穿越的数组写**永久回退 legacy**（ADR 0033 决策 1 双轨）——
 *          污染照旧响亮拒绝、区间外篡改照旧 E201-C（⇒ 闸门不得过度接管）；
 *   NB 组：S9 安装事实核（长度算术 + 插入项同一性）在两条轨上都保留（ADR 0033 决策 3）；
 *   NC 组：域规则逐字（不 clamp / 拒越界 no-op / 批量一次判定 / index===length 接受）+
 *          一切拒绝零写入零 update（ADR 0033 决策 2 零写入纪律）；
 *   ND 组：commit 形态 = Y.Array 区间最小 edit（终态/update 字节 ≡ 手写最小 edit）+
 *          复制面收敛（update 事件形态不变，ADR 0033 决策 2）。
 */
import { describe, expect, it } from 'vitest';
import { applyUpdate, encodeStateAsUpdate, Doc as YDoc } from 'yjs';
import {
  capture,
  fixture,
  logicalValueAt,
  run,
  sameBytes,
  stateBytes,
  summarizeThrown,
  tamperOnNextLocalCommit,
  withUpdates,
} from './issue-436-array-fastpath-fixture.js';

function expectE201(thrown: unknown): void {
  const summary = summarizeThrown(thrown);
  expect(summary.fatal, `期望 DOCRT-E201 fatal，实际 ${summary.message.slice(0, 200)}`).toBe(true);
  expect(summary.phase).toBe('post-commit-verification');
  expect(summary.committed).toBe(true);
  expect(summary.message).toMatch(/DOCRT-E201/);
}

// ═══════════════════════════════════════════════════════════════════════════
// NA：永久 legacy 轨（union 数组目标 / union 穿越）——闸门不得接管
// ═══════════════════════════════════════════════════════════════════════════

describe('issue #436 NA — union 数组目标与 union 穿越的数组写保持 legacy 全量边界路径', () => {
  it('NA1 union 数组目标（A[] | B[]）：区间外污染照旧拒绝、零写入零 update', () => {
    const fx = fixture({ n: 3 });
    fx.uarr.insert(0, [true]); // 无 union 成员可容的污染
    const before = stateBytes(fx.doc);
    const captured = withUpdates(fx.doc, () => run(fx, { op: 'array-delete', path: ['uarr'], index: 1, count: 1 }));
    expect(captured.result.ok).toBe(false);
    if (!captured.result.ok) {
      expect(captured.result.issues[0]?.path).toEqual(['uarr', 0]);
    }
    expect(captured.count).toBe(0);
    expect(sameBytes(before, stateBytes(fx.doc))).toBe(true);
  });

  it('NA2 union 数组目标：区间外 observer 篡改照旧 E201-C（legacy 双核不变）', () => {
    const fx = fixture({ n: 3 });
    tamperOnNextLocalCommit(fx.doc, () => {
      fx.uarr.delete(0, 1);
      fx.uarr.insert(0, [99]);
    });
    const thrown = capture(() => run(fx, { op: 'array-delete', path: ['uarr'], index: 2, count: 1 }));
    expectE201(thrown);
    expect(fx.uarr.toJSON()).toEqual([99, 2]); // 写入已提交、doc 保持 observer 实际状态
  });

  it('NA3 union 穿越（成员内数组，plan.kind=union）：区间外污染照旧拒绝、零写入', () => {
    const fx = fixture({ n: 3 });
    fx.umemItems.insert(0, [true]);
    const before = stateBytes(fx.doc);
    const captured = withUpdates(fx.doc, () => run(fx, { op: 'array-delete', path: ['umem', 'items'], index: 1, count: 1 }));
    expect(captured.result.ok).toBe(false);
    if (!captured.result.ok) {
      expect(captured.result.issues[0]?.path).toEqual(['umem', 'items', 0]);
    }
    expect(captured.count).toBe(0);
    expect(sameBytes(before, stateBytes(fx.doc))).toBe(true);
  });

  it('NA4 union 数组目标干净写照常成功（legacy 轨行为正确）', () => {
    const insertFx = fixture({ n: 3 });
    expect(run(insertFx, { op: 'array-insert', path: ['uarr'], index: 1, values: [9] })).toEqual({ ok: true });
    expect(insertFx.uarr.toJSON()).toEqual([1, 9, 2, 3]);

    const deleteFx = fixture({ n: 3 });
    expect(run(deleteFx, { op: 'array-delete', path: ['uarr'], index: 1, count: 1 })).toEqual({ ok: true });
    expect(deleteFx.uarr.toJSON()).toEqual([1, 3]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// NB：S9 安装事实核（两轨都保留；ADR 0033 决策 3）
// ═══════════════════════════════════════════════════════════════════════════

describe('issue #436 NB — S9 安装事实核保留（长度算术 + 插入项同一性）', () => {
  it('NB1 非 union T[] append：区间外额外插入 → 长度算术 E201-C（fast-path 也必须保留）', () => {
    const fx = fixture({ n: 5 });
    tamperOnNextLocalCommit(fx.doc, () => {
      fx.items.push([888]);
    });
    const thrown = capture(() => run(fx, { op: 'array-insert', path: ['items'], index: 5, values: [6] }));
    expectE201(thrown);
    expect(fx.items.toJSON()).toEqual([1, 2, 3, 4, 5, 6, 888]);
  });

  it('NB2 非 union T[] insert：插入项被同事务覆写 → 同一性 E201-C', () => {
    const fx = fixture({ n: 5 });
    tamperOnNextLocalCommit(fx.doc, () => {
      fx.items.delete(5, 1);
      fx.items.insert(5, [777]);
    });
    const thrown = capture(() => run(fx, { op: 'array-insert', path: ['items'], index: 5, values: [6] }));
    expectE201(thrown);
    expect(fx.items.toJSON()).toEqual([1, 2, 3, 4, 5, 777]);
  });

  it('NB3 非 union T[] delete：被删区间被同事务补回（长度算术）→ E201-C', () => {
    const fx = fixture({ n: 5 });
    tamperOnNextLocalCommit(fx.doc, () => {
      fx.items.insert(3, [999]);
    });
    const thrown = capture(() => run(fx, { op: 'array-delete', path: ['items'], index: 3, count: 1 }));
    expectE201(thrown);
  });

  it('NB4 union 数组目标 insert：同事务额外插入 → 长度算术 E201-C（legacy 事实核不变）', () => {
    const fx = fixture({ n: 3 });
    tamperOnNextLocalCommit(fx.doc, () => {
      fx.uarr.push([888]);
    });
    const thrown = capture(() => run(fx, { op: 'array-insert', path: ['uarr'], index: 3, values: [4] }));
    expectE201(thrown);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// NC：域规则逐字 + 零写入（ADR 0033 决策 2）
// ═══════════════════════════════════════════════════════════════════════════

describe('issue #436 NC — 域规则逐字不变 + 一切拒绝零写入零 update', () => {
  it('NC1 array-insert index > length：逐字消息/path、零写入、零 update', () => {
    const fx = fixture({ n: 5 });
    const before = stateBytes(fx.doc);
    const captured = withUpdates(fx.doc, () => run(fx, { op: 'array-insert', path: ['items'], index: 6, values: [1] }));
    expect(captured.result).toEqual({
      ok: false,
      issues: [{ message: 'array-insert index 越界（不 clamp）', path: ['items', 6] }],
    });
    expect(captured.count).toBe(0);
    expect(sameBytes(before, stateBytes(fx.doc))).toBe(true);
  });

  it('NC2 array-delete 越界（含 index === length 的越界 no-op）：逐字消息/path、零写入、零 update', () => {
    const fx = fixture({ n: 5 });
    const before = stateBytes(fx.doc);
    const captured = withUpdates(fx.doc, () => run(fx, { op: 'array-delete', path: ['items'], index: 5, count: 1 }));
    expect(captured.result).toEqual({
      ok: false,
      issues: [{ message: 'array-delete 范围越界（不 clamp、不接受越界 no-op）', path: ['items', 5] }],
    });
    expect(captured.count).toBe(0);
    expect(sameBytes(before, stateBytes(fx.doc))).toBe(true);
  });

  it('NC3 批量新值逐个过 element 子 schema：issue 按插入后位置升序、零写入', () => {
    const fx = fixture({ n: 5 });
    const before = stateBytes(fx.doc);
    const captured = withUpdates(fx.doc, () => run(fx, { op: 'array-insert', path: ['items'], index: 1, values: ['a', 'b'] }));
    expect(captured.result).toEqual({
      ok: false,
      issues: [
        { message: '类型不匹配：期望 number，实际 string', path: ['items', 1] },
        { message: '类型不匹配：期望 number，实际 string', path: ['items', 2] },
      ],
    });
    expect(captured.count).toBe(0);
    expect(sameBytes(before, stateBytes(fx.doc))).toBe(true);
  });

  it('NC4 边界接受面：index === length append 与 index + count === length delete 照常成功（不 clamp）', () => {
    const appendFx = fixture({ n: 5 });
    const appendCapture = withUpdates(appendFx.doc, () => run(appendFx, { op: 'array-insert', path: ['items'], index: 5, values: [6] }));
    expect(appendCapture.result).toEqual({ ok: true });
    expect(appendCapture.count).toBe(1);
    expect(appendFx.items.toJSON()).toEqual([1, 2, 3, 4, 5, 6]);

    const deleteFx = fixture({ n: 5 });
    const deleteCapture = withUpdates(deleteFx.doc, () => run(deleteFx, { op: 'array-delete', path: ['items'], index: 3, count: 2 }));
    expect(deleteCapture.result).toEqual({ ok: true });
    expect(deleteCapture.count).toBe(1);
    expect(deleteFx.items.toJSON()).toEqual([1, 2, 3]);
  });

  it('NC5 批量信封内干净数组 op 照常 ok:true（数组分支折入批量管线）', () => {
    const fx = fixture({ n: 5 });
    const result = run(fx, {
      ops: [
        { op: 'array-insert', path: ['items'], index: 2, values: [42] },
        { op: 'set', path: ['n'], value: 2 },
      ],
    });
    expect(result).toEqual({ ok: true });
    expect(fx.items.toJSON()).toEqual([1, 2, 42, 3, 4, 5]);
    expect(logicalValueAt(fx.doc, ['n'])).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ND：commit 形态 = Y.Array 区间最小 edit（复制/诊断捕获上游事件形态不变）
// ═══════════════════════════════════════════════════════════════════════════

describe('issue #436 ND — commit 最小 edit 字节形态与复制面', () => {
  it('ND1 array-insert：API 提交终态字节 ≡ 手写 Y.Array.insert（同 clientID）', () => {
    const viaApi = fixture({ n: 5, clientID: 4242 });
    expect(run(viaApi, { op: 'array-insert', path: ['items'], index: 3, values: [22, 23] })).toEqual({ ok: true });
    const viaManual = fixture({ n: 5, clientID: 4242 });
    viaManual.doc.transact(() => {
      viaManual.items.insert(3, [22, 23]);
    });
    expect(sameBytes(stateBytes(viaApi.doc), stateBytes(viaManual.doc))).toBe(true);
  });

  it('ND2 array-insert：update 事件数 1 且增量字节 ≡ 手写最小 edit', () => {
    const viaApi = fixture({ n: 5, clientID: 4242 });
    const apiCapture = withUpdates(viaApi.doc, () => run(viaApi, { op: 'array-insert', path: ['items'], index: 3, values: [22, 23] }));
    const viaManual = fixture({ n: 5, clientID: 4242 });
    const manualCapture = withUpdates(viaManual.doc, () => {
      viaManual.doc.transact(() => {
        viaManual.items.insert(3, [22, 23]);
      });
    });
    expect(apiCapture.count).toBe(1);
    expect(manualCapture.count).toBe(1);
    expect(sameBytes(apiCapture.events[0]!, manualCapture.events[0]!)).toBe(true);
  });

  it('ND3 array-delete：API 提交终态字节 ≡ 手写 Y.Array.delete（同 clientID）', () => {
    const viaApi = fixture({ n: 5, clientID: 4242 });
    expect(run(viaApi, { op: 'array-delete', path: ['items'], index: 1, count: 2 })).toEqual({ ok: true });
    const viaManual = fixture({ n: 5, clientID: 4242 });
    viaManual.doc.transact(() => {
      viaManual.items.delete(1, 2);
    });
    expect(sameBytes(stateBytes(viaApi.doc), stateBytes(viaManual.doc))).toBe(true);
  });

  it('ND4 复制面：增量 update 应用到同基态对端后逻辑值一致', () => {
    const fx = fixture({ n: 5, clientID: 777 });
    const replica = new YDoc();
    // 对端先同步到同一基态（等价于复制对端已收到此前的全部 update）
    applyUpdate(replica, encodeStateAsUpdate(fx.doc));
    const captured = withUpdates(fx.doc, () => run(fx, { op: 'array-insert', path: ['items'], index: 3, values: [22] }));
    expect(captured.result).toEqual({ ok: true });
    expect(captured.count).toBe(1);
    applyUpdate(replica, captured.events[0]!);
    expect(logicalValueAt(replica, ['items'])).toEqual([1, 2, 3, 22, 4, 5]);
  });
});
