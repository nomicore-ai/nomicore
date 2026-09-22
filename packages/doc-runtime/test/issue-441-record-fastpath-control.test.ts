/**
 * issue #441 SA6 负控 / 回归锚（恒绿面）— Record/parent 双轨的 legacy 轨、安装事实核、
 * 域规则逐字、零写入与 commit 字节形态。
 *
 * 本文件在 HEAD 全绿，实现落地后必须保持全绿：
 *   NA 组：union map 位（`maybe`）与 union 穿越（`umem.inner`）的写**永久回退 legacy**
 *          （ADR 0034 决策 1 双轨）——union map 位污染照旧响亮拒绝、两形态触达面外
 *          篡改照旧 E201-C（⇒ 闸门不得过度接管）；
 *   NB 组：S9 安装事实核（`get`/`has` 同一性）在两条轨上都保留（ADR 0034 决策 3）——
 *          目标键位被同事务覆写/重插（含同逻辑值不同实例）一律 E201-C；
 *   NC 组：域规则逐字（no-op 拒 / 键 Pattern / 值 schema / 静态必填 / unknown 缺席语义）+
 *          一切拒绝零写入零 update（ADR 0034 决策 1/2 零写入纪律）；
 *   ND 组：commit 形态 = Y.Map 单键最小 edit（终态/update 字节 ≡ 手写最小 edit，同 clientID）
 *          + 复制面收敛（update 事件形态不变，ADR 0034 决策 1）。
 */
import { describe, expect, it } from 'vitest';
import { applyUpdate, encodeStateAsUpdate, Doc as YDoc } from 'yjs';
import {
  alt,
  capture,
  fixture,
  item,
  logicalValueAt,
  rawItemEntry,
  rawSet,
  run,
  sameBytes,
  stateBytes,
  summarizeThrown,
  tamperOnNextLocalCommit,
  taskKey,
  withUpdates,
} from './issue-441-record-fastpath-fixture.js';

function expectE201(thrown: unknown): void {
  const summary = summarizeThrown(thrown);
  expect(summary.fatal, `期望 DOCRT-E201 fatal，实际 ${summary.message.slice(0, 200)}`).toBe(true);
  expect(summary.phase).toBe('post-commit-verification');
  expect(summary.committed).toBe(true);
  expect(summary.message).toMatch(/DOCRT-E201/);
}

// ═══════════════════════════════════════════════════════════════════════════
// NA：永久 legacy 轨（union map 位 / union 穿越）——闸门不得接管
// ═══════════════════════════════════════════════════════════════════════════

describe('issue #441 NA — union map 位与 union 穿越保持 legacy 全量边界路径', () => {
  it('NA1 union map 位 set：触达面外污染照旧拒绝、零写入零 update', () => {
    const fx = fixture();
    rawSet(fx.maybe, 'm1', 'oops');
    const before = stateBytes(fx.doc);
    const captured = withUpdates(fx.doc, () => run(fx, { op: 'set', path: ['maybe', 'm2'], value: item('mm', 6) }));
    expect(captured.result.ok).toBe(false);
    if (!captured.result.ok) {
      expect(captured.result.issues[0]?.path).toEqual(['m1']); // 边界相对路径（legacy 逐字）
    }
    expect(captured.count).toBe(0);
    expect(sameBytes(before, stateBytes(fx.doc))).toBe(true);
  });

  it('NA2 union map 位 delete（目标键即污染位）：照旧拒绝、零写入', () => {
    const fx = fixture();
    rawSet(fx.maybe, 'm1', 'oops');
    const before = stateBytes(fx.doc);
    const captured = withUpdates(fx.doc, () => run(fx, { op: 'delete', path: ['maybe', 'm1'] }));
    expect(captured.result.ok).toBe(false);
    expect(captured.count).toBe(0);
    expect(sameBytes(before, stateBytes(fx.doc))).toBe(true);
  });

  it('NA3 union map 位 + 触达面外 observer 篡改：照旧 E201-C（legacy 双核不变）', () => {
    const fx = fixture();
    tamperOnNextLocalCommit(fx.doc, () => {
      fx.maybe.delete('m1');
    });
    const thrown = capture(() => run(fx, { op: 'set', path: ['maybe', 'm2'], value: item('mm', 6) }));
    expectE201(thrown);
    expect(fx.maybe.has('m1')).toBe(false); // 写入已提交、doc 保持 observer 实际状态
  });

  it('NA4 union 穿越（umem.inner，plan.kind=union）：触达面外 observer 篡改照旧 E201-C', () => {
    const fx = fixture();
    tamperOnNextLocalCommit(fx.doc, () => {
      fx.umemInner.delete('u1');
    });
    const thrown = capture(() => run(fx, { op: 'set', path: ['umem', 'inner', 'u2'], value: item('u2', 2) }));
    expectE201(thrown);
  });

  it('NA5 union map 位 / union 穿越干净写照常成功（legacy 轨行为正确）', () => {
    const mapFx = fixture();
    expect(run(mapFx, { op: 'set', path: ['maybe', 'm2'], value: item('mm', 6) })).toEqual({ ok: true });
    expect(run(mapFx, { op: 'delete', path: ['maybe', 'm1'] })).toEqual({ ok: true });
    expect(logicalValueAt(mapFx.doc, ['maybe', 'm2'])).toEqual(item('mm', 6));

    const crossFx = fixture();
    expect(run(crossFx, { op: 'set', path: ['umem', 'inner', 'u2'], value: item('u2', 2) })).toEqual({ ok: true });
    expect(logicalValueAt(crossFx.doc, ['umem', 'inner', 'u2'])).toEqual(item('u2', 2));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// NB：S9 安装事实核（两轨都保留；ADR 0034 决策 3）
// ═══════════════════════════════════════════════════════════════════════════

describe('issue #441 NB — S9 安装事实核保留（get/has 同一性）', () => {
  it('NB1 Record set 目标键被同事务覆写（异实例异值）→ E201-C', () => {
    const fx = fixture();
    tamperOnNextLocalCommit(fx.doc, () => {
      fx.tasks.set('t1', rawItemEntry('z', 9));
    });
    const thrown = capture(() => run(fx, { op: 'set', path: ['tasks', 't1'], value: item('x', 1) }));
    expectE201(thrown);
  });

  it('NB2 Record set 目标键被同事务覆写（同逻辑值不同实例）→ 同一性 E201-C', () => {
    const fx = fixture();
    tamperOnNextLocalCommit(fx.doc, () => {
      fx.tasks.set('t1', rawItemEntry('t1', 2)); // 与基线逻辑等值、实例不同
    });
    const thrown = capture(() => run(fx, { op: 'set', path: ['tasks', 't1'], value: item('x', 1) }));
    expectE201(thrown);
  });

  it('NB3 Record delete 目标键被同事务重插 → E201-C', () => {
    const fx = fixture();
    tamperOnNextLocalCommit(fx.doc, () => {
      fx.tasks.set('t1', rawItemEntry('z', 9));
    });
    const thrown = capture(() => run(fx, { op: 'delete', path: ['tasks', 't1'] }));
    expectE201(thrown);
  });

  it('NB4 封闭对象 delete 目标字段被同事务重插 → E201-C', () => {
    const fx = fixture();
    tamperOnNextLocalCommit(fx.doc, () => {
      fx.obj.set('opt', 42);
    });
    const thrown = capture(() => run(fx, { op: 'delete', path: ['obj', 'opt'] }));
    expectE201(thrown);
  });

  it('NB5 union map 位 set 目标键被同事务覆写 → E201-C（legacy 事实核不变）', () => {
    const fx = fixture();
    tamperOnNextLocalCommit(fx.doc, () => {
      fx.maybe.set('m1', rawItemEntry('z', 9));
    });
    const thrown = capture(() => run(fx, { op: 'set', path: ['maybe', 'm1'], value: item('x', 1) }));
    expectE201(thrown);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// NC：域规则逐字 + 零写入（ADR 0034 决策 1/2）
// ═══════════════════════════════════════════════════════════════════════════

describe('issue #441 NC — 域规则逐字不变 + 一切拒绝零写入零 update', () => {
  it('NC1 Record delete no-op（键不存在）：逐字消息/path、零写入、零 update', () => {
    const fx = fixture();
    const before = stateBytes(fx.doc);
    const captured = withUpdates(fx.doc, () => run(fx, { op: 'delete', path: ['tasks', 't99'] }));
    expect(captured.result).toEqual({
      ok: false,
      issues: [{ message: 'delete 目标键不存在（拒绝 no-op）', path: ['tasks', 't99'] }],
    });
    expect(captured.count).toBe(0);
    expect(sameBytes(before, stateBytes(fx.doc))).toBe(true);
  });

  it('NC2 Record set 键 Pattern 违约：逐字消息/path、零写入、零 update', () => {
    const fx = fixture();
    const before = stateBytes(fx.doc);
    const captured = withUpdates(fx.doc, () => run(fx, { op: 'set', path: ['codes', 'nope'], value: item('n', 1) }));
    expect(captured.result).toEqual({
      ok: false,
      issues: [{ message: 'Record 键 "nope" 不满足 Pattern 正则 /^(id-[0-9]+)$/', path: ['codes', 'nope'] }],
    });
    expect(captured.count).toBe(0);
    expect(sameBytes(before, stateBytes(fx.doc))).toBe(true);
  });

  it('NC3 Record set 新值违约：逐字消息/path（rebase 到目标键位）、零写入、零 update', () => {
    const fx = fixture();
    const before = stateBytes(fx.doc);
    const captured = withUpdates(fx.doc, () =>
      run(fx, { op: 'set', path: ['tasks', 't9'], value: { title: 'x', qty: 'y' } }));
    expect(captured.result).toEqual({
      ok: false,
      issues: [{ message: '类型不匹配：期望 number，实际 string', path: ['tasks', 't9', 'qty'] }],
    });
    expect(captured.count).toBe(0);
    expect(sameBytes(before, stateBytes(fx.doc))).toBe(true);
  });

  it('NC4 封闭对象 delete 必填字段：逐字消息/path、零写入、零 update', () => {
    const fx = fixture();
    const before = stateBytes(fx.doc);
    const captured = withUpdates(fx.doc, () => run(fx, { op: 'delete', path: ['obj', 'req'] }));
    expect(captured.result).toEqual({
      ok: false,
      issues: [{ message: '缺少必填字段 "req"', path: ['obj', 'req'] }],
    });
    expect(captured.count).toBe(0);
    expect(sameBytes(before, stateBytes(fx.doc))).toBe(true);
  });

  it('NC5 封闭对象 delete optional / unknown 字段允许；缺席 no-op 拒绝（现行语义保留）', () => {
    const fx = fixture();
    expect(run(fx, { op: 'delete', path: ['obj', 'opt'] })).toEqual({ ok: true });
    expect(fx.obj.has('opt')).toBe(false);
    expect(run(fx, { op: 'delete', path: ['obj', 'opt'] })).toEqual({
      ok: false,
      issues: [{ message: 'delete 目标键不存在（拒绝 no-op）', path: ['obj', 'opt'] }],
    });
    expect(run(fx, { op: 'delete', path: ['obj', 'unk'] })).toEqual({ ok: true });
    expect(fx.obj.has('unk')).toBe(false);
  });

  it('NC6 Record delete 不查键 Pattern：现键违约仍可删（delete 语义与现状一致）', () => {
    const fx = fixture();
    rawSet(fx.codes, 'nope', rawItemEntry('n', 1));
    const captured = withUpdates(fx.doc, () => run(fx, { op: 'delete', path: ['codes', 'nope'] }));
    expect(captured.result).toEqual({ ok: true });
    expect(captured.count).toBe(1);
    expect(fx.codes.has('nope')).toBe(false);
  });

  it('NC7 Record set 越界键位不合法之外的现行接受面：新键、现键覆写均 ok:true（不 clamp 语义无关）', () => {
    const fx = fixture();
    expect(run(fx, { op: 'set', path: ['tasks', taskKey(9)], value: item('nine', 9) })).toEqual({ ok: true });
    expect(run(fx, { op: 'set', path: ['tasks', taskKey(9)], value: item('nine2', 10) })).toEqual({ ok: true });
    expect(logicalValueAt(fx.doc, ['tasks', taskKey(9)])).toEqual(item('nine2', 10));
  });

  it('NC8 Record 值位 union（blobs）：两支成员新值均接受、非法值拒绝且零写入', () => {
    const itemFx = fixture();
    expect(run(itemFx, { op: 'set', path: ['blobs', 'b2'], value: item('i', 5) })).toEqual({ ok: true });
    const altFx = fixture();
    expect(run(altFx, { op: 'set', path: ['blobs', 'b2'], value: alt('a', 5) })).toEqual({ ok: true });
    const badFx = fixture();
    const before = stateBytes(badFx.doc);
    const captured = withUpdates(badFx.doc, () =>
      run(badFx, { op: 'set', path: ['blobs', 'b2'], value: { title: 'x', n: 5 } }));
    expect(captured.result.ok).toBe(false);
    expect(captured.count).toBe(0);
    expect(sameBytes(before, stateBytes(badFx.doc))).toBe(true);
  });

  it('NC9 批量信封内干净 Record 写：ok:true + 终态正确（批量原子语义不变）', () => {
    const fx = fixture();
    expect(run(fx, {
      ops: [
        { op: 'set', path: ['tasks', taskKey(8)], value: item('eight', 8) },
        { op: 'delete', path: ['tasks', taskKey(0)] },
      ],
    })).toEqual({ ok: true });
    expect(fx.tasks.has(taskKey(0))).toBe(false);
    expect(logicalValueAt(fx.doc, ['tasks', taskKey(8)])).toEqual(item('eight', 8));
  });

  it('NC10 触达面内载体位：Record map 本身非 Y.Map → 响亮拒绝（同文案同 path、零写入零 update）', () => {
    const fx = fixture();
    rawSet(fx.root, 'tasks', 'oops');
    const before = stateBytes(fx.doc);
    const captured = withUpdates(fx.doc, () =>
      run(fx, { op: 'set', path: ['tasks', 't9'], value: item('nine', 9) }));
    expect(captured.result).toEqual({
      ok: false,
      issues: [{ message: 'Yjs 载体错位（ROOT）：期望 Y.Map，实际 plain value', path: [] }],
    });
    expect(captured.count).toBe(0);
    expect(sameBytes(before, stateBytes(fx.doc))).toBe(true);
  });

  it('NC11 触达面内载体位：封闭对象父载体本身非 Y.Map → 响亮拒绝（同文案同 path、零写入）', () => {
    const fx = fixture();
    rawSet(fx.root, 'obj', 'oops');
    const before = stateBytes(fx.doc);
    const captured = withUpdates(fx.doc, () => run(fx, { op: 'delete', path: ['obj', 'opt'] }));
    expect(captured.result).toEqual({
      ok: false,
      issues: [{ message: 'Yjs 载体错位（ROOT）：期望 Y.Map，实际 plain value', path: [] }],
    });
    expect(captured.count).toBe(0);
    expect(sameBytes(before, stateBytes(fx.doc))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ND：commit 形态 = Y.Map 单键最小 edit（复制/诊断捕获上游事件形态不变）
// ═══════════════════════════════════════════════════════════════════════════

describe('issue #441 ND — commit 最小 edit 字节形态与复制面', () => {
  it('ND1 Record delete：API 终态/增量字节 ≡ 手写 Y.Map.delete（同 clientID）', () => {
    const viaApi = fixture({ clientID: 4242 });
    const apiCapture = withUpdates(viaApi.doc, () => run(viaApi, { op: 'delete', path: ['tasks', 't0'] }));
    const viaManual = fixture({ clientID: 4242 });
    const manualCapture = withUpdates(viaManual.doc, () => {
      viaManual.doc.transact(() => {
        viaManual.tasks.delete('t0');
      });
    });
    expect(apiCapture.count).toBe(1);
    expect(manualCapture.count).toBe(1);
    expect(sameBytes(stateBytes(viaApi.doc), stateBytes(viaManual.doc))).toBe(true);
    expect(sameBytes(apiCapture.events[0]!, manualCapture.events[0]!)).toBe(true);
  });

  it('ND2 Record set：API 终态/增量字节 ≡ 手写最小 edit（raw Y.Map 逐字段构造，同 clientID）', () => {
    const viaApi = fixture({ tasksN: 5, clientID: 991 });
    const apiCapture = withUpdates(viaApi.doc, () =>
      run(viaApi, { op: 'set', path: ['tasks', 't9'], value: item('nine', 9) }));
    const viaManual = fixture({ tasksN: 5, clientID: 991 });
    const manualCapture = withUpdates(viaManual.doc, () => {
      viaManual.doc.transact(() => {
        viaManual.tasks.set('t9', rawItemEntry('nine', 9)); // 声明序逐字段 raw 构造
      });
    });
    expect(apiCapture.count).toBe(1);
    expect(manualCapture.count).toBe(1);
    expect(sameBytes(stateBytes(viaApi.doc), stateBytes(viaManual.doc))).toBe(true);
    expect(sameBytes(apiCapture.events[0]!, manualCapture.events[0]!)).toBe(true);
  });

  it('ND3 封闭对象 delete：API 终态/增量字节 ≡ 手写 Y.Map.delete（同 clientID）', () => {
    const viaApi = fixture({ clientID: 5150 });
    const apiCapture = withUpdates(viaApi.doc, () => run(viaApi, { op: 'delete', path: ['obj', 'opt'] }));
    const viaManual = fixture({ clientID: 5150 });
    const manualCapture = withUpdates(viaManual.doc, () => {
      viaManual.doc.transact(() => {
        viaManual.obj.delete('opt');
      });
    });
    expect(apiCapture.count).toBe(1);
    expect(manualCapture.count).toBe(1);
    expect(sameBytes(stateBytes(viaApi.doc), stateBytes(viaManual.doc))).toBe(true);
    expect(sameBytes(apiCapture.events[0]!, manualCapture.events[0]!)).toBe(true);
  });

  it('ND4 Record set：单 update 且增量字节长度与 n 解耦（最小 edit；时钟 varint 余量内）', () => {
    const small = fixture({ tasksN: 3, clientID: 7 });
    const big = fixture({ tasksN: 512, clientID: 7 });
    const smallCapture = withUpdates(small.doc, () =>
      run(small, { op: 'set', path: ['tasks', 't9'], value: item('nine', 9) }));
    const bigCapture = withUpdates(big.doc, () =>
      run(big, { op: 'set', path: ['tasks', 't9'], value: item('nine', 9) }));
    expect(smallCapture.count).toBe(1);
    expect(bigCapture.count).toBe(1);
    expect(Math.abs(smallCapture.events[0]!.length - bigCapture.events[0]!.length)).toBeLessThanOrEqual(8);
  });

  it('ND5 复制面：增量 update 应用到同基态对端后逻辑值一致（Record set/delete + 封闭对象 delete）', () => {
    const fx = fixture({ clientID: 777 });
    const replica = new YDoc();
    applyUpdate(replica, encodeStateAsUpdate(fx.doc));
    const setCapture = withUpdates(fx.doc, () =>
      run(fx, { op: 'set', path: ['tasks', 't9'], value: item('nine', 9) }));
    expect(setCapture.count).toBe(1);
    applyUpdate(replica, setCapture.events[0]!);
    expect(logicalValueAt(replica, ['tasks', 't9'])).toEqual(item('nine', 9));

    const deleteCapture = withUpdates(fx.doc, () => run(fx, { op: 'delete', path: ['tasks', 't0'] }));
    expect(deleteCapture.count).toBe(1);
    applyUpdate(replica, deleteCapture.events[0]!);
    expect(logicalValueAt(replica, ['tasks', 't0'])).toBeUndefined();

    const objCapture = withUpdates(fx.doc, () => run(fx, { op: 'delete', path: ['obj', 'opt'] }));
    expect(objCapture.count).toBe(1);
    applyUpdate(replica, objCapture.events[0]!);
    expect(logicalValueAt(replica, ['obj', 'opt'])).toBeUndefined();
    expect(logicalValueAt(replica, ['obj', 'req'])).toBe('r');
  });

  it('ND6 批量双 Record 键写 = 单事务单 update（owned update bytes 形态不变）', () => {
    const fx = fixture();
    const captured = withUpdates(fx.doc, () =>
      run(fx, {
        ops: [
          { op: 'set', path: ['tasks', taskKey(8)], value: item('eight', 8) },
          { op: 'set', path: ['tasks', taskKey(9)], value: item('nine', 9) },
        ],
      }));
    expect(captured.result).toEqual({ ok: true });
    expect(captured.count).toBe(1);
  });
});
