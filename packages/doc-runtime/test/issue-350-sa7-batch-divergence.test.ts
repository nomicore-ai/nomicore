/**
 * SA7 动态验证补充测试 — issue #350（批量信封「真实提交后偏离」→ E201-C）。
 *
 * 来源：SA4 实现审查 §11 后续动态验证项 2（`wiki/raw/task_issue-350_sa4_review.md`）——
 * 「批量 E201-C 真实偏离路径（observer 干扰）——无确定性触发点，契约未覆盖批量形态」；
 * 设计 `wiki/raw/task_issue-350_design.md` §7.5.2/§8.3 路线 5：组合期望边界使 E201-C
 * **只对真实提交后偏离触发**（ADR 0007 #237 §5 冻结语义），合法共享边界兄弟足迹不得
 * 伪触发（S1–S7/NS-1 锚），而 observer 对已安装边界的真实干扰必须被检出（验证不空转）。
 *
 * 确定性触发机制：`afterTransaction` observer 在批量提交事务的 cleanup 窗口内篡改已安装
 * 边界（与既有 `create-initial-document.test.ts` §observer 篡改面同款机制——yjs 实证：
 * 事件在 `doc.transact` 返回前派发，先于 `verifyBoundaryIntact`）。
 *
 * 断言纪律：全部观察运行时行为（返回值/throw 的 branded 事实、活动 Y.Doc 值、update
 * 事件计数）；无 skip/only/todo/env override；无源码字符串断言。每例先以 TD-0 无篡改
 * 对照证明同一批量在无干扰下 ok:true（因果实验——篡改是唯一变量）。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { evaluate, parseVfsl } from '@nomicore/vfsl';
import type { DerivedSchema } from '@nomicore/vfsl';
import type { MutationEnvelope } from '../src/index.js';
import { applyValidatedMutation, materializeRoot, DocRuntimeFatalError } from '../src/index.js';

// ── fixture（与 issue-350-batch-shared-boundary.test.ts 同款 schema/基态）──────────

const TEXT = `type ROOT = {
  n: number;
  a: string;
  values: YArray<number>;
  tasks: Record<string, { status: string; reviewer?: string; notes: YArray<string> }>;
  point: { kind: "a"; x: number; y: number } | { kind: "b"; label: string };
  u: { x?: number; label?: number } | { label?: string; x?: string };
};`;

function derivedOf(text: string): DerivedSchema {
  const parsed = parseVfsl(text);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  const evaluated = evaluate(parsed.module);
  if (!evaluated.ok) throw new Error(JSON.stringify(evaluated.issues));
  return evaluated.derived;
}

interface Fx {
  derived: DerivedSchema;
  doc: Y.Doc;
  root: Y.Map<unknown>;
}

function fixture(): Fx {
  const derived = derivedOf(TEXT);
  const doc = new Y.Doc();
  const materialized = materializeRoot(derived, {
    n: 1,
    a: 'x',
    values: [1, 2, 3],
    tasks: {
      t1: { status: 'open', reviewer: 'r0', notes: ['n0'] },
      t2: { status: 'open', reviewer: 'r0', notes: ['n0'] },
    },
    point: { kind: 'a', x: 1, y: 1 },
    u: {},
  }, doc);
  if (!materialized.ok) throw new Error(JSON.stringify(materialized.issues));
  return { derived, doc, root: doc.getMap('ROOT') };
}

function taskEntry(fx: Fx, key: string): Y.Map<unknown> {
  return (fx.root.get('tasks') as Y.Map<unknown>).get(key) as Y.Map<unknown>;
}

function notesArray(fx: Fx, key: string): Y.Array<string> {
  return taskEntry(fx, key).get('notes') as Y.Array<string>;
}

function run(fx: Fx, mutation: unknown): unknown {
  return applyValidatedMutation(fx.derived, fx.doc, mutation as MutationEnvelope);
}

/** 在批量提交事务的 cleanup 窗口内一次性篡改（one-shot——G8 纪律）。 */
function tamperOnNextLocalCommit(doc: Y.Doc, tamper: () => void): void {
  let done = false;
  doc.on('afterTransaction', (transaction: Y.Transaction) => {
    if (!transaction.local || done) return;
    done = true;
    tamper();
  });
}

function capture(fn: () => unknown): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  return undefined;
}

const S1_OPS = [
  { op: 'delete', path: ['tasks', 't1', 'reviewer'] },
  { op: 'set', path: ['tasks', 't1', 'status'], value: 'reviewing' },
];

const S7_OPS = [
  { op: 'delete', path: ['tasks', 't1', 'reviewer'] },
  { op: 'array-insert', path: ['tasks', 't1', 'notes'], index: 1, values: ['n1'] },
];

// ── TD-0：无篡改对照（因果实验——篡改是后续各例唯一变量）────────────────────────

describe('SA7 TD-0 — 同一批量无 observer 干扰时 ok:true（真实偏离检出的因果对照）', () => {
  it('TD-0 S1/S7 批量无篡改：ok:true 且值落盘（E201-C 只应由真实偏离触发）', () => {
    const s1 = fixture();
    expect(run(s1, { ops: S1_OPS })).toEqual({ ok: true });
    expect(taskEntry(s1, 't1').toJSON()).toEqual({ status: 'reviewing', notes: ['n0'] });

    const s7 = fixture();
    expect(run(s7, { ops: S7_OPS })).toEqual({ ok: true });
    expect(taskEntry(s7, 't1').toJSON()).toEqual({ status: 'open', notes: ['n0', 'n1'] });
  });
});

// ── TD-1..TD-3：真实提交后偏离 → E201-C（committed:true、不回滚、doc 保持实际状态）──

describe('SA7 TD-1 — observer 覆写已安装边界值：批量逐操作边界验证检出 → E201-C committed:true', () => {
  it('TD-1 afterTransaction 内覆写 t1.status：throw E201-C（post-commit-verification/committed:true），doc 保持覆写值（不回滚）', () => {
    const fx = fixture();
    let updates = 0;
    fx.doc.on('update', () => { updates += 1; });
    tamperOnNextLocalCommit(fx.doc, () => {
      taskEntry(fx, 't1').set('status', 'tampered');
    });

    const thrown = capture(() => run(fx, { ops: S1_OPS }));

    expect(thrown).toBeInstanceOf(DocRuntimeFatalError);
    if (thrown instanceof DocRuntimeFatalError) {
      expect(thrown.phase).toBe('post-commit-verification');
      expect(thrown.committed).toBe(true); // 批量事务已提交（保守事实，不得降格）
      expect(thrown.message).toMatch(/DOCRT-E201/);
      expect(thrown.message).toContain('边界安装后一致性校验偏离');
    }
    // 提交事实保留：批量提交 + 篡改各产生 update；doc 保持 observer 留下的实际状态
    expect(updates).toBeGreaterThanOrEqual(1);
    expect(taskEntry(fx, 't1').get('status')).toBe('tampered');
    expect(taskEntry(fx, 't1').has('reviewer')).toBe(false); // delete 足迹未被虚假回滚
  });
});

describe('SA7 TD-2 — observer 重插已删除键：安装事实核检出 → E201-C committed:true', () => {
  it('TD-2 afterTransaction 内重插 t1.reviewer：throw E201-C（事实核「疑似 observer 重插」），doc 保持重插值', () => {
    const fx = fixture();
    tamperOnNextLocalCommit(fx.doc, () => {
      taskEntry(fx, 't1').set('reviewer', 'r9');
    });

    const thrown = capture(() => run(fx, { ops: S1_OPS }));

    expect(thrown).toBeInstanceOf(DocRuntimeFatalError);
    if (thrown instanceof DocRuntimeFatalError) {
      expect(thrown.phase).toBe('post-commit-verification');
      expect(thrown.committed).toBe(true);
      expect(thrown.message).toMatch(/DOCRT-E201/);
      expect(thrown.message).toContain('疑似 observer 重插');
    }
    expect(taskEntry(fx, 't1').get('reviewer')).toBe('r9'); // observer 留下的实际状态
    expect(taskEntry(fx, 't1').get('status')).toBe('reviewing'); // set 足迹保留
  });
});

describe('SA7 TD-3 — observer 干扰 array 载荷边界：重投影核检出 → E201-C committed:true', () => {
  it('TD-3 afterTransaction 内向 t1.notes 追加元素：throw E201-C（array 足迹折入后验证不空转），notes 保持干扰结果', () => {
    const fx = fixture();
    tamperOnNextLocalCommit(fx.doc, () => {
      notesArray(fx, 't1').push(['EXTRA']);
    });

    const thrown = capture(() => run(fx, { ops: S7_OPS }));

    expect(thrown).toBeInstanceOf(DocRuntimeFatalError);
    if (thrown instanceof DocRuntimeFatalError) {
      expect(thrown.phase).toBe('post-commit-verification');
      expect(thrown.committed).toBe(true);
      expect(thrown.message).toMatch(/DOCRT-E201/);
    }
    // 组合期望边界（含 array-insert 足迹 ['n0','n1']）≠ 干扰后实际 ['n0','n1','EXTRA']
    // —— 验证未被组合值吸收成空转；doc 保持 observer 留下的实际状态（不回滚）
    expect(notesArray(fx, 't1').toJSON()).toEqual(['n0', 'n1', 'EXTRA']);
    expect(taskEntry(fx, 't1').has('reviewer')).toBe(false);
  });
});
