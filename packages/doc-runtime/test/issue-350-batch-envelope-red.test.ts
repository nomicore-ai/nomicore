/**
 * SA6 验收契约（红灯）— issue #350：mutateData 批量原子变更信封（ADR 0026）。
 * 层级：@nomicore/doc-runtime 信封解析 / 逐操作 prepare / 单事务提交 / 逐操作边界验证。
 *
 * 契约来源：
 * - docs/adr/0026-atomic-mutation-envelope.md「信封形态」「槽内次序与原子性」「错误域」
 *   （双形态互斥；ops 非空 ≤16；元素为完整合法单操作信封且不得携带 guard；批内路径
 *   互不嵌套；逐操作 prepare → 任一失败整体零写入 → 全部成功单事务按序提交 → 逐操作
 *   边界验证；操作失败聚合全部失败操作的 issues；形状错误无码不可重试；最小 edit 不降级）；
 * - docs/adr/0007（applyValidatedMutation 四动词；零写入承诺；单次 Yjs transaction；
 *   set([]) 唯一全量 legacy 管线）；
 * - docs/adr/0008 L47（空路径整体替换是唯一清空并重装完整 ROOT 的 mutation）；
 * - docs/adr/0025 L72–74（批内元素永远不得携带 guard——本票即拒，guard 顶层叠加属
 *   #347–#349）；
 * - issue #350 brief「What to build」与 AC1–AC8。
 *
 * 红灯现状（HEAD 211c5fa，2026-09-12 实测，见 wiki/raw/task_issue-350_sa6_red_probe.log）：
 * - `{ ops: [...] }` 尚未实现：parseMutation 先读 env.op → undefined → 单操作路径拒绝
 *   `未知操作 "undefined"`（零写入但拒绝理由错误）；
 * - 因此 B1–B7 全部在「批量必须被识别并通过/按批量语义拒绝」处红；
 * - N1–N4 为负控（单操作形态现役契约），当前全绿，AD-0026 落地后必须保持全绿
 *   （单操作形态逐字节不变）。
 *
 * 未决边界（SA8 conflict report §4/§8 移交 SA1 封口）：`set([])` 作为批量元素的语义。
 * 本文件**不**替设计做选择：B5/B6 之外单独以 B7 的 decision-neutral 断言钉住两种合法
 * 闭口的公共不变量（要么形状错误零写入、要么 legacy 等价原子全量重装），不得静默
 * fallback、不得部分写。SA1 封口后由 SA6 下一轮把它升级为单向断言。
 *
 * 纪律：全部断言观察运行时行为（返回值、活动 Y.Doc 值、事务/update 事件、字节快照），
 * 无 skip/only/todo/env override，无以源码字符串断言代替行为验证。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { evaluate, parseVfsl } from '@nomicore/vfsl';
import type { DerivedSchema } from '@nomicore/vfsl';
import { applyValidatedMutation, materializeRoot } from '../src/index.js';
import type { ApplyValidatedMutationResult, MutationIssue } from '../src/index.js';

// ── fixture ──────────────────────────────────────────────────────────────────

const TEXT = `type ROOT = {
  n: number;
  a: string;
  tasks: Record<string, { status: string; reviewer?: string }>;
  values: YArray<number>;
  more: YArray<string>;
  big: string;
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

function baseSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    n: 1,
    a: 'x',
    tasks: {
      t1: { status: 'open', reviewer: 'r0' },
      t2: { status: 'open', reviewer: 'r0' },
    },
    values: [1, 2, 3],
    more: ['m'],
    big: 'small',
    ...overrides,
  };
}

function fixture(snapshot: Record<string, unknown> = baseSnapshot()): Fx {
  const derived = derivedOf(TEXT);
  const doc = new Y.Doc();
  const materialized = materializeRoot(derived, snapshot, doc);
  if (!materialized.ok) throw new Error(JSON.stringify(materialized.issues));
  return { derived, doc, root: doc.getMap('ROOT') };
}

/** 单一 Y.Doc 写入口；第三参公共类型为 `ValidatedMutation | unknown`，批量信封原样传入。 */
function run(fx: Fx, mutation: unknown): ApplyValidatedMutationResult {
  return applyValidatedMutation(fx.derived, fx.doc, mutation);
}

function bytes(doc: Y.Doc): number[] {
  return [...Y.encodeStateAsUpdate(doc)];
}

function taskEntry(fx: Fx, key: string): Y.Map<unknown> {
  const tasks = fx.root.get('tasks') as Y.Map<unknown>;
  return tasks.get(key) as Y.Map<unknown>;
}

function issuePaths(result: ApplyValidatedMutationResult): Array<Array<string | number>> {
  return result.ok ? [] : (result.issues as MutationIssue[]).map((issue) => [...issue.path]);
}

/** 形状错误断言：ok:false 且文档逐字节不变。 */
function expectShapeReject(fx: Fx, mutation: unknown, label: string): void {
  const before = bytes(fx.doc);
  const result = run(fx, mutation);
  expect(result.ok, `${label}：必须被信封校验拒绝；实际 ${JSON.stringify(result)}`).toBe(false);
  expect(bytes(fx.doc), `${label}：必须零写入（文档逐字节不变）`).toEqual(before);
}

/** 构造前置：证明每个元素单独作为单操作信封是合法的（防「嵌套拒绝」因元素本身非法而空转）。 */
function expectEachOpLegalAlone(ops: readonly unknown[]): void {
  for (const op of ops) {
    const scratch = fixture();
    const result = run(scratch, op);
    expect(result.ok, `构造前置失败：元素单独必须合法（${JSON.stringify(op)}）；实际 ${JSON.stringify(result)}`).toBe(true);
  }
}

/** 本地事务计数（ADR 0026 L34：全部成功 → 单事务按序提交）。 */
function countLocalTransactions(doc: Y.Doc): { count: number } {
  const counter = { count: 0 };
  doc.on('afterTransaction', (transaction) => {
    if (transaction.local && transaction.changed.size > 0) counter.count += 1;
  });
  return counter;
}

// ── B1–B7：批量信封正例与形状错误（当前 HEAD 红灯）────────────────────────────

describe('issue #350 批量信封（ADR 0026）— doc-runtime 解析 / 逐操作 prepare / 单事务（SA6 红灯契约）', () => {
  it('B1 批量全部合法：ok:true、全部值落盘、恰一次本地事务与一次 update（观察者无中间态可见）', () => {
    const fx = fixture();
    const txs = countLocalTransactions(fx.doc);
    const updates: Uint8Array[] = [];
    fx.doc.on('update', (update: Uint8Array) => updates.push(update));
    // 观察者：每个 update 事件时刻读取全部受影响值——要么见全部要么不见
    const observed: Array<{ status: unknown; reviewer: unknown; values: unknown }> = [];
    fx.doc.on('update', () => {
      observed.push({
        status: taskEntry(fx, 't1').get('status'),
        reviewer: taskEntry(fx, 't1').get('reviewer'),
        values: (fx.root.get('values') as Y.Array<number>).toJSON(),
      });
    });

    const result = run(fx, {
      ops: [
        { op: 'set', path: ['tasks', 't1', 'status'], value: 'reviewing' },
        { op: 'set', path: ['tasks', 't1', 'reviewer'], value: 'u9' },
        { op: 'array-insert', path: ['values'], index: 1, values: [9] },
      ],
    });

    expect(result.ok, `批量全部合法必须 ok:true；实际 ${JSON.stringify(result)}（能力缺口：批量形态未实现——{ops} 落单操作解析拒绝）`).toBe(true);
    expect(taskEntry(fx, 't1').toJSON()).toEqual({ status: 'reviewing', reviewer: 'u9' });
    expect((fx.root.get('values') as Y.Array<number>).toJSON()).toEqual([1, 9, 2, 3]);
    expect(txs.count, '单事务：不得逐操作各开一个事务').toBe(1);
    expect(updates, '单事务产出一条 update').toHaveLength(1);
    expect(observed, '观察者所见每一态都必须是全部操作生效后的态').toEqual([
      { status: 'reviewing', reviewer: 'u9', values: [1, 9, 2, 3] },
    ]);
  });

  it('B2 跨实体路径批量（不同 Record 条目 / 不同集合的四动词）同样单事务原子', () => {
    const fx = fixture();
    const txs = countLocalTransactions(fx.doc);
    const updates: Uint8Array[] = [];
    fx.doc.on('update', (update: Uint8Array) => updates.push(update));

    const result = run(fx, {
      ops: [
        { op: 'set', path: ['n'], value: 2 },
        { op: 'set', path: ['tasks', 't1', 'status'], value: 'reviewing' },
        { op: 'delete', path: ['tasks', 't2', 'reviewer'] },
        { op: 'array-insert', path: ['values'], index: 3, values: [4] },
        { op: 'array-delete', path: ['more'], index: 0, count: 1 },
      ],
    });

    expect(result.ok, `跨实体批量必须 ok:true；实际 ${JSON.stringify(result)}`).toBe(true);
    expect(fx.root.get('n')).toBe(2);
    expect(taskEntry(fx, 't1').toJSON()).toEqual({ status: 'reviewing', reviewer: 'r0' });
    expect(taskEntry(fx, 't2').toJSON()).toEqual({ status: 'open' });
    expect((fx.root.get('values') as Y.Array<number>).toJSON()).toEqual([1, 2, 3, 4]);
    expect((fx.root.get('more') as Y.Array<string>).toJSON()).toEqual([]);
    expect(txs.count).toBe(1);
    expect(updates).toHaveLength(1);
  });

  it('B3 任一操作失败：零写入 + 聚合全部失败操作的 issues（非 fail-fast 单错，按 ops 顺序）', () => {
    const fx = fixture();
    const before = bytes(fx.doc);
    const txs = countLocalTransactions(fx.doc);
    const updates: Uint8Array[] = [];
    fx.doc.on('update', (update: Uint8Array) => updates.push(update));

    const result = run(fx, {
      ops: [
        { op: 'set', path: ['n'], value: 'bad' }, // 失败 1：number 位置写 string
        { op: 'set', path: ['tasks', 't1', 'status'], value: 'reviewing' }, // 合法：证明整体回滚零写入
        { op: 'set', path: ['a'], value: 5 }, // 失败 2：string 位置写 number
      ],
    });

    expect(result.ok, `批量含失败操作必须 ok:false；实际 ${JSON.stringify(result)}`).toBe(false);
    const paths = issuePaths(result);
    const atN = paths.findIndex((path) => JSON.stringify(path) === JSON.stringify(['n']));
    const atA = paths.findIndex((path) => JSON.stringify(path) === JSON.stringify(['a']));
    expect(paths.length, `必须聚合两个失败操作的全部 issues（非 fail-fast 单错）；实际 issues=${JSON.stringify(result.ok ? [] : result.issues)}`).toBeGreaterThanOrEqual(2);
    expect(atN, '失败操作 1 的 issue（path=[n]）必须存在').toBeGreaterThanOrEqual(0);
    expect(atA, '失败操作 2 的 issue（path=[a]）必须存在').toBeGreaterThanOrEqual(0);
    expect(atN, '聚合按 ops 顺序拼接：op1 的 issue 先于 op2').toBeLessThan(atA);
    expect(bytes(fx.doc), '任一操作失败 → 整体零写入（文档逐字节不变）').toEqual(before);
    expect(txs.count, '失败批量不得开事务').toBe(0);
    expect(updates, '失败批量不得产生 update').toHaveLength(0);
  });

  it('B4 批量保持最小 edit：不整父替换、不重建容器（unrelated Y 载体身份 + update 体量）', () => {
    const fx = fixture(baseSnapshot({ big: 'x'.repeat(700_000) }));
    const tasksBefore = fx.root.get('tasks');
    const valuesBefore = fx.root.get('values');
    const bigBefore = fx.root.get('big');
    const updates: Uint8Array[] = [];
    fx.doc.on('update', (update: Uint8Array) => updates.push(update));

    const result = run(fx, {
      ops: [
        { op: 'set', path: ['tasks', 't1', 'status'], value: 'reviewing' },
        { op: 'set', path: ['n'], value: 2 },
      ],
    });

    expect(result.ok, `最小 edit 批量必须 ok:true；实际 ${JSON.stringify(result)}`).toBe(true);
    expect(fx.root.get('tasks'), 'tasks 容器身份必须保持（不得整父替换）').toBe(tasksBefore);
    expect(fx.root.get('values'), 'unrelated Y.Array 身份必须保持').toBe(valuesBefore);
    expect(fx.root.get('big'), 'unrelated 大字段值必须保持').toBe(bigBefore);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.byteLength ?? Number.POSITIVE_INFINITY, 'update 必须随最小 edit 缩放（整父/整根替换会携带 700k 字段）').toBeLessThan(1_000);
  });

  it('B5 ops 元素上限：16 个合法元素接受；空数组 / 17 个元素为形状错误零写入', () => {
    const tasks: Record<string, unknown> = {};
    for (let i = 1; i <= 17; i++) tasks[`t${i}`] = { status: 'open', reviewer: 'r0' };
    const fx = fixture(baseSnapshot({ tasks }));
    const txs = countLocalTransactions(fx.doc);

    const sixteen = Array.from({ length: 16 }, (_, index) => ({
      op: 'set',
      path: ['tasks', `t${index + 1}`, 'status'],
      value: 'reviewing',
    }));
    const accepted = run(fx, { ops: sixteen });
    expect(accepted.ok, `16 个元素（冻结上限）必须接受；实际 ${JSON.stringify(accepted)}`).toBe(true);
    for (let i = 1; i <= 16; i++) expect(taskEntry(fx, `t${i}`).get('status')).toBe('reviewing');
    expect(txs.count).toBe(1);

    // 17 个元素：全部元素单独合法，唯一拒绝理由只能是超上限
    expectShapeReject(
      fx,
      { ops: [...sixteen, { op: 'set', path: ['tasks', 't17', 'status'], value: 'reviewing' }] },
      'ops 超上限 16',
    );
    expectShapeReject(fx, { ops: [] }, 'ops 空数组');
  });

  it('B6 形状错误矩阵：双形态同现 / ops 非数组 / 元素非完整单操作信封（缺键、非对象、未知键）/ 元素携带 guard', () => {
    const fx = fixture();
    // 先证明批量形态已被识别（否则后续「拒绝」断言与当前未实现状态同义反复）
    const anchor = run(fx, { ops: [{ op: 'set', path: ['n'], value: 2 }] });
    expect(anchor.ok, `批量形态必须已被识别并接受合法单元素批量；实际 ${JSON.stringify(anchor)}`).toBe(true);

    const cases: Array<[string, unknown]> = [
      ['双形态同现（op 字段组 + ops）', {
        op: 'set', path: ['a'], value: 'y',
        ops: [{ op: 'set', path: ['n'], value: 3 }],
      }],
      ['ops 非数组', { ops: 'not-an-array' }],
      ['ops 为 null', { ops: null }],
      ['元素缺必需键（set 缺 value）', { ops: [{ op: 'set', path: ['n'] }] }],
      ['元素为未知操作', { ops: [{ op: 'bogus', path: ['n'], value: 3 }] }],
      ['元素为非对象', { ops: [42] }],
      ['元素携带未知键', { ops: [{ op: 'set', path: ['n'], value: 3, zzz: 1 }] }],
      ['元素携带 guard 键（批级前提属 ADR 0025 顶层，0025 L72–74）', {
        ops: [{ op: 'set', path: ['n'], value: 3, guard: { kind: 'exists', path: ['n'] } }],
      }],
      ['批量顶层未知键', { ops: [{ op: 'set', path: ['n'], value: 3 }], zzz: 1 }],
    ];
    for (const [label, mutation] of cases) expectShapeReject(fx, mutation, label);
  });

  it('B7 批内路径互不嵌套：祖先-后代或相同路径形状错误；兄弟路径仍合法', () => {
    const fx = fixture();

    // 负控（同测试内）：兄弟路径（不同叶子/不同容器）不得被过度拒绝
    const siblings = run(fx, {
      ops: [
        { op: 'set', path: ['n'], value: 2 },
        { op: 'set', path: ['a'], value: 'y' },
      ],
    });
    expect(siblings.ok, `兄弟路径批量必须接受（防过度拒绝）；实际 ${JSON.stringify(siblings)}`).toBe(true);
    expect(fx.root.get('n')).toBe(2);
    expect(fx.root.get('a')).toBe('y');

    const ancestorDescendant = [
      { op: 'set', path: ['tasks', 't1'], value: { status: 'held', reviewer: 'r1' } },
      { op: 'set', path: ['tasks', 't1', 'status'], value: 'reviewing' },
    ];
    expectEachOpLegalAlone(ancestorDescendant);
    expectShapeReject(fx, { ops: ancestorDescendant }, '批内路径祖先-后代');

    const identical = [
      { op: 'set', path: ['n'], value: 3 },
      { op: 'set', path: ['n'], value: 4 },
    ];
    expectEachOpLegalAlone(identical);
    expectShapeReject(fx, { ops: identical }, '批内两条相同路径');

    const containerAncestor = [
      {
        op: 'set',
        path: ['tasks'],
        value: { t1: { status: 'held', reviewer: 'r1' }, t2: { status: 'open', reviewer: 'r0' } },
      },
      { op: 'set', path: ['tasks', 't1', 'status'], value: 'reviewing' },
    ];
    expectEachOpLegalAlone(containerAncestor);
    expectShapeReject(fx, { ops: containerAncestor }, '批内容器路径祖先-后代（整容器替换 + 子键写）');
  });

  it('B8 set([]) 元素未决边界（SA8 移交 SA1）：闭口必须是「形状错误零写入」或「legacy 等价原子全量重装」二者之一，不得 fallback / 部分写', () => {
    // 构造前提：单操作 set([])（现役唯一全量形态，ADR 0008 L47）合法——批量元素的合法
    // 性因此不能靠「值非法」解释；本断言只在批量形态被识别（下面 anchor 通过）后才有意义。
    const fx = fixture();
    const fullRoot = {
      n: 5,
      a: 'z',
      tasks: { t1: { status: 'open', reviewer: 'r0' }, t2: { status: 'open', reviewer: 'r0' } },
      values: [1, 2, 3],
      more: ['m'],
      big: 'small',
    };
    const singleOpAnchor = run(fx, { op: 'set', path: [], value: fullRoot });
    expect(singleOpAnchor.ok, '构造前提：单操作 set([]) 必须合法（现役 legacy 全量形态）').toBe(true);

    const fxBatch = fixture();
    const anchor = run(fxBatch, { ops: [{ op: 'set', path: ['n'], value: 2 }] });
    expect(anchor.ok, `批量形态必须已被识别；实际 ${JSON.stringify(anchor)}`).toBe(true);

    const before = bytes(fxBatch.doc);
    const txs = countLocalTransactions(fxBatch.doc);
    const updates: Uint8Array[] = [];
    fxBatch.doc.on('update', (update: Uint8Array) => updates.push(update));
    const result = run(fxBatch, { ops: [{ op: 'set', path: [], value: fullRoot }] });

    if (result.ok) {
      // 闭口 A：允许为 legacy 等价（必须原子全量重装：单事务、单 update、ROOT 全等）
      expect(fxBatch.root.toJSON()).toEqual(fullRoot);
      expect(txs.count).toBe(1);
      expect(updates).toHaveLength(1);
    } else {
      // 闭口 B：形状错误拒绝（必须零写入；不得部分写或 fallback 单操作解析后落盘）
      expect(bytes(fxBatch.doc), 'set([]) 元素若被拒绝必须整体零写入').toEqual(before);
      expect(txs.count).toBe(0);
      expect(updates).toHaveLength(0);
    }
    // 两种闭口共同的不变量：结果确定性（重复调用同一输入给同一分类，无状态漂移）
    const again = run(fixture(), { ops: [{ op: 'set', path: [], value: fullRoot }] });
    expect(again.ok, 'set([]) 元素边界必须确定性闭口（重复调用同分类）').toBe(result.ok);
  });
});

// ── N1–N4：负控（当前 HEAD 全绿；单操作形态逐字节不变，ADR 0026 L17/L65）────────

describe('issue #350 负控 — 单操作形态逐字节不变（当前 HEAD 绿灯，实现后必须保持）', () => {
  it('N1 单操作四动词幸福路径：各自恰一次事务与一次 update，值正确落盘', () => {
    const fx = fixture();
    const txs = countLocalTransactions(fx.doc);
    const updates: Uint8Array[] = [];
    fx.doc.on('update', (update: Uint8Array) => updates.push(update));

    expect(run(fx, { op: 'set', path: ['n'], value: 2 }).ok).toBe(true);
    expect(run(fx, { op: 'delete', path: ['tasks', 't2', 'reviewer'] }).ok).toBe(true);
    expect(run(fx, { op: 'array-insert', path: ['values'], index: 3, values: [4] }).ok).toBe(true);
    expect(run(fx, { op: 'array-delete', path: ['more'], index: 0, count: 1 }).ok).toBe(true);

    expect(fx.root.get('n')).toBe(2);
    expect(taskEntry(fx, 't2').toJSON()).toEqual({ status: 'open' });
    expect((fx.root.get('values') as Y.Array<number>).toJSON()).toEqual([1, 2, 3, 4]);
    expect((fx.root.get('more') as Y.Array<string>).toJSON()).toEqual([]);
    expect(txs.count).toBe(4);
    expect(updates).toHaveLength(4);
  });

  it('N2 单操作失败：零写入且恰一条 issue（聚合语义不得外溢到单操作形态）', () => {
    const fx = fixture();
    const before = bytes(fx.doc);
    const result = run(fx, { op: 'set', path: ['n'], value: 'bad' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(issuePaths(result)).toEqual([['n']]);
      expect(result.issues[0]?.message).toContain('类型不匹配');
    }
    expect(bytes(fx.doc)).toEqual(before);
  });

  it('N3 单操作未知信封键 loud 拒绝：文案路径与零写入不变', () => {
    const fx = fixture();
    const before = bytes(fx.doc);
    const result = run(fx, { op: 'set', path: ['n'], value: 2, zzz: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.message).toContain('未知信封键 "zzz"');
      expect(result.issues[0]?.message).toContain('操作 set');
    }
    expect(bytes(fx.doc)).toEqual(before);
  });

  it('N4 单操作 set([]) legacy 全量重装仍合法（ADR 0008 L47 唯一全量形态）', () => {
    const fx = fixture();
    const fullRoot = {
      n: 5,
      a: 'z',
      tasks: { t1: { status: 'open', reviewer: 'r0' }, t2: { status: 'open', reviewer: 'r0' } },
      values: [1, 2, 3],
      more: ['m'],
      big: 'small',
    };
    const txs = countLocalTransactions(fx.doc);
    const result = run(fx, { op: 'set', path: [], value: fullRoot });
    expect(result.ok).toBe(true);
    expect(fx.root.toJSON()).toEqual(fullRoot);
    expect(txs.count).toBe(1);
  });
});
