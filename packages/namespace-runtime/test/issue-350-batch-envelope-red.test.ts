/**
 * SA6 验收契约（红灯）— issue #350：mutateData 批量原子变更信封（ADR 0026）。
 * 层级：@nomicore/namespace-runtime 端到端（公共面透传 / 写槽 / 零写入 / 诊断单条记录）。
 *
 * 契约来源：
 * - docs/adr/0026-atomic-mutation-envelope.md：双形态互斥、ops ≤16、元素禁 guard、
 *   批内路径互不嵌套、逐操作 prepare → 任一失败整体零写入 → 单事务按序提交 →
 *   逐操作边界验证、操作失败聚合 issues、形状错误无码、一个写槽 = 一次变更尝试 =
 *   一条诊断记录、单事务单条 update bytes；
 * - docs/adr/0008（S1–S7 槽序不可重排；S3 槽起点快照整个信封；R9 issues 同源透传；
 *   commit 后脏登记；close 停接纳）；
 * - docs/adr/0011 / 0014（一次变更尝试一条最终 attempt record；rejected 禁携带 update；
 *   operation 词表仍 root-mutation、无新增 stage/result 词）；
 * - issue #350 AC1–AC8。
 *
 * 红灯现状（HEAD 211c5fa，2026-09-12 实测，见 wiki/raw/task_issue-350_sa6_red_probe.log）：
 * - R1–R4、R7 在「合法批量必须 ok:true / committed」处红（当前 {ops} 被单操作解析拒绝：
 *   `未知操作 "undefined"`，零写入但拒绝理由错误；诊断面呈现 rejected/validation
 *   单条记录，无 update bytes）；
 * - R5（close 停接纳）、R6（S3 快照边界）为负控/回归锚，当前绿，实现后必须保持。
 *
 * 未决边界（SA8 conflict report §4/§8 移交 SA1）：`set([])` 作为批量元素。本文件在
 * doc-runtime 层以 decision-neutral 断言钉住两种闭口公共不变量（见
 * packages/doc-runtime/test/issue-350-batch-envelope-red.test.ts B8）；端到端层不再重复。
 *
 * 纪律：全部断言观察运行时行为（结果联合、readData 值、Y.Doc 字节、update/事务事件、
 * 诊断 record 内容、输入访问 Proxy 计数）；无 skip/only/todo/env override；无源码字符串断言。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { DocHandle, User } from '@nomicore/persistence';
import { createMemoryPersistence } from '@nomicore/persistence';
import { realPersistenceScheduler } from './real-persistence-scheduler.js';
import { createNamespaceRuntimeWithSeam } from '../src/runtime.js';
import type { NamespaceRuntime } from '../src/index.js';
import {
  createBoundedMemoryDiagnosticLog,
  type AttemptRecord,
  type AttemptResult,
  type BoundedMemoryDiagnosticLog,
  type UpdateCarrier,
} from '../../namespace-diagnostic-log/src/index.js';

// ── fixture ──────────────────────────────────────────────────────────────────

const NOW_MS = 1_700_000_000_000;
const OWNER: User = { userId: 'u-alice' };
const TEXT = `type ROOT = {
  n: number;
  a: string;
  tasks: Record<string, { status: string; reviewer?: string }>;
  values: YArray<number>;
};`;
const ENVELOPE = { lang: 'vfsl', version: 1, id: 'ns-1', text: TEXT } as const;

function makeDoc(): Y.Doc {
  const doc = new Y.Doc();
  const schema = doc.getMap('SCHEMA');
  for (const [key, value] of Object.entries(ENVELOPE)) schema.set(key, value);
  const meta = doc.getMap('META');
  meta.set('docId', 'ns-1');
  meta.set('createdAt', NOW_MS);
  const root = doc.getMap('ROOT');
  root.set('n', 1);
  root.set('a', 'x');
  const tasks = new Y.Map<unknown>();
  for (const key of ['t1', 't2']) {
    const entry = new Y.Map<unknown>();
    entry.set('status', 'open');
    entry.set('reviewer', 'r0');
    tasks.set(key, entry);
  }
  root.set('tasks', tasks);
  const values = new Y.Array<number>();
  values.push([1, 2, 3]);
  root.set('values', values);
  return doc;
}

interface Ctx {
  runtime: NamespaceRuntime;
  handle: DocHandle;
  writer: ReturnType<typeof createMemoryPersistence>;
  doc: Y.Doc;
  notifierCalls: () => number;
}

async function setup(opts: {
  log?: BoundedMemoryDiagnosticLog;
  p0Gate?: Promise<void>;
  waitReady?: boolean;
} = {}): Promise<Ctx> {
  const store = new Map<string, Uint8Array>();
  const writer = createMemoryPersistence({
    scheduler: realPersistenceScheduler,
    schedule: { debounceMs: 5, maxDirtyMs: 60 },
    writeSnapshot: async (key, snapshot) => {
      store.set(key, snapshot.slice());
    },
  });
  const handle = await writer.createDoc(OWNER, 'ns-1', makeDoc());
  let notifierCalls = 0;
  const seam: Record<string, unknown> = {
    handle,
    notifyDirty: async () => {
      notifierCalls += 1;
      await writer.saveDoc(handle);
    },
  };
  if (opts.log !== undefined) {
    seam.diagnosticEmitter = opts.log.emitter;
    seam.clock = () => NOW_MS;
  }
  if (opts.p0Gate !== undefined) seam.p0Gate = opts.p0Gate;
  const runtime = createNamespaceRuntimeWithSeam(seam as never) as unknown as NamespaceRuntime;
  if (opts.waitReady !== false) {
    await expect.poll(() => runtime.getStatus().schema.state, { interval: 10, timeout: 5_000 }).toBe('ready');
  }
  return { runtime, handle, writer, doc: handle.doc, notifierCalls: () => notifierCalls };
}

function readOk(runtime: NamespaceRuntime, path: readonly (string | number)[]): unknown {
  const read = runtime.readData(path);
  expect(read.ok, `readData(${JSON.stringify(path)}) 应成功：${JSON.stringify(read)}`).toBe(true);
  return (read as { value: unknown }).value;
}

async function waitAttempts(log: BoundedMemoryDiagnosticLog, expected: number): Promise<AttemptRecord[]> {
  await expect
    .poll(() => log.records().filter((record) => record.recordKind === 'attempt').length, { interval: 5, timeout: 3_000 })
    .toBe(expected);
  return log.records().filter((record): record is AttemptRecord => record.recordKind === 'attempt');
}

function committedUpdateOf(record: AttemptRecord): UpdateCarrier {
  const result = record.result;
  if (result.kind !== 'committed' || result.effect !== 'update') {
    throw new Error(`预期 committed/effect=update；实际 ${JSON.stringify(result)}`);
  }
  return result.update;
}

function inlineBytes(carrier: UpdateCarrier): Uint8Array {
  if (carrier.storage !== 'inline') throw new Error(`预期 inline carrier，实际 ${carrier.storage}`);
  return new Uint8Array(Buffer.from(carrier.base64, 'base64'));
}

/** 同源基态（事务前 pre-state）+ 事务增量重放（ADR 0014 owned bytes 消费形态）。 */
function replay(baseState: Uint8Array, carrier: UpdateCarrier): Y.Doc {
  const fresh = new Y.Doc();
  Y.applyUpdate(fresh, baseState);
  Y.applyUpdate(fresh, inlineBytes(carrier));
  return fresh;
}

function bytesOf(doc: Y.Doc): number[] {
  return [...Y.encodeStateAsUpdate(doc)];
}

function issuePathsOf(result: unknown): Array<Array<string | number>> {
  if (typeof result !== 'object' || result === null) return [];
  const issues = (result as { issues?: unknown }).issues;
  if (!Array.isArray(issues)) return [];
  return issues.map((issue) => {
    const path = (issue as { path?: unknown }).path;
    return Array.isArray(path) ? (path as Array<string | number>) : [];
  });
}

const LEGAL_OPS = [
  { op: 'set', path: ['tasks', 't1', 'status'], value: 'reviewing' },
  { op: 'set', path: ['tasks', 't1', 'reviewer'], value: 'u9' },
  { op: 'array-insert', path: ['values'], index: 1, values: [9] },
];

// ── R1–R4 / R7：批量端到端与诊断（当前 HEAD 红灯）──────────────────────────────

describe('issue #350 批量信封（ADR 0026）— namespace-runtime 端到端 / 零写入 / 诊断（SA6 红灯契约）', () => {
  it('R1 批量端到端：mutateData({ops}) → ok:true；readData 见全部；恰 1 次 notifier、恰 1 次 update（单事务）', async () => {
    const { runtime, handle, writer, doc, notifierCalls } = await setup();
    const updates: Uint8Array[] = [];
    doc.on('update', (update: Uint8Array) => updates.push(update));

    const result = await runtime.mutateData({ ops: LEGAL_OPS });

    expect(result, '批量经公共面必须透传为 ok:true').toEqual({ ok: true });
    expect(readOk(runtime, ['tasks', 't1', 'status'])).toBe('reviewing');
    expect(readOk(runtime, ['tasks', 't1', 'reviewer'])).toBe('u9');
    expect(readOk(runtime, ['values'])).toEqual([1, 9, 2, 3]);
    expect(notifierCalls(), '成功批量恰一次 dirty 登记（一槽一尝试）').toBe(1);
    expect(updates, '单事务恰好一条 owned update').toHaveLength(1);
    await handle.release();
    await writer.dispose();
  });

  it('R2 任一操作失败：整体零写入 ok:false + 聚合全部失败操作的 issues；notifier 零调用', async () => {
    const { runtime, handle, writer, doc, notifierCalls } = await setup();
    const before = bytesOf(doc);
    const updates: Uint8Array[] = [];
    doc.on('update', (update: Uint8Array) => updates.push(update));

    const result = await runtime.mutateData({
      ops: [
        { op: 'set', path: ['n'], value: 'bad' }, // 失败 1
        { op: 'set', path: ['a'], value: 'y' }, // 合法——证明整体回滚
        { op: 'set', path: ['tasks', 't1', 'status'], value: 5 }, // 失败 2
      ],
    });

    expect(result.ok, `批量含失败操作必须 ok:false；实际 ${JSON.stringify(result)}`).toBe(false);
    const paths = issuePathsOf(result);
    expect(paths.length, `必须聚合全部失败操作的 issues；实际 ${JSON.stringify(result)}`).toBeGreaterThanOrEqual(2);
    expect(paths.some((path) => JSON.stringify(path) === JSON.stringify(['n']))).toBe(true);
    expect(paths.some((path) => JSON.stringify(path) === JSON.stringify(['tasks', 't1', 'status']))).toBe(true);
    expect(bytesOf(doc), '整体零写入（文档字节不变）').toEqual(before);
    expect(updates).toHaveLength(0);
    expect(notifierCalls(), '失败批量不得调用 dirty notifier').toBe(0);
    expect(readOk(runtime, ['a'])).toBe('x');
    await handle.release();
    await writer.dispose();
  });

  it('R3 诊断：一次批量尝试恰一条 record + 单条 owned update bytes（对照 N 次顺序写 N 条记录）', async () => {
    const log = createBoundedMemoryDiagnosticLog({ inputPolicy: 'digest', updateCapture: true });
    const { runtime, handle, writer, doc } = await setup({ log });

    // 对照（负控、当前绿）：N 次顺序单操作写 → N 条记录——证明「批量 1 条」断言不是空转
    expect((await runtime.mutateData({ op: 'set', path: ['n'], value: 2 })).ok).toBe(true);
    expect((await runtime.mutateData({ op: 'set', path: ['a'], value: 'y' })).ok).toBe(true);
    expect((await runtime.mutateData({ op: 'set', path: ['tasks', 't2', 'status'], value: 'done' })).ok).toBe(true);
    const sequential = await waitAttempts(log, 3);
    expect(sequential).toHaveLength(3);
    for (const record of sequential) expect(record.result.kind).toBe('committed');

    const baseState = Y.encodeStateAsUpdate(doc); // 批量前基态（同 clientID）
    const result = await runtime.mutateData({
      ops: [
        { op: 'set', path: ['n'], value: 2 },
        { op: 'set', path: ['tasks', 't1', 'status'], value: 'reviewing' },
      ],
    });
    expect(result, '一次批量尝试必须 ok:true（红：当前 {ops} 未实现）').toEqual({ ok: true });

    const recs = await waitAttempts(log, 4);
    expect(recs, '批量整体仍只增一条记录（一个写槽 = 一次变更尝试）').toHaveLength(4);
    const rec = recs[3]!;
    expect(rec.operation).toBe('root-mutation');
    expect(rec.stage).toBe('transaction');
    expect(rec.input.capture).toBe('digest');
    const carrier = committedUpdateOf(rec);
    const fresh = replay(baseState, carrier);
    const freshRoot = fresh.getMap('ROOT');
    const freshT1 = (freshRoot.get('tasks') as Y.Map<unknown>).get('t1') as Y.Map<unknown>;
    expect(freshRoot.get('n')).toBe(2);
    expect(freshT1.get('status')).toBe('reviewing');
    await handle.release();
    await writer.dispose();
  });

  it('R4 诊断边界：形状错误批量 → 恰一条 rejected record、无稳定 code、无 update effect；合法批量仍一条 committed', async () => {
    const log = createBoundedMemoryDiagnosticLog({ inputPolicy: 'digest', updateCapture: true });
    const { runtime, handle, writer, doc } = await setup({ log });

    const legal = await runtime.mutateData({ ops: [{ op: 'set', path: ['n'], value: 2 }] });
    expect(legal).toEqual({ ok: true });
    const afterLegal = bytesOf(doc);

    const shapeErrors: unknown[] = [
      { op: 'set', path: ['a'], value: 'y', ops: [{ op: 'set', path: ['n'], value: 3 }] }, // 双形态同现
      { ops: [{ op: 'set', path: ['n'], value: 3, guard: { kind: 'exists', path: ['n'] } }] }, // 元素携带 guard
    ];
    for (const mutation of shapeErrors) {
      const result = await runtime.mutateData(mutation);
      expect(result.ok, `形状错误必须拒绝；实际 ${JSON.stringify(result)}`).toBe(false);
    }
    expect(bytesOf(doc), '形状错误零写入').toEqual(afterLegal);

    const recs = await waitAttempts(log, 3);
    const [first, second, third] = recs as [AttemptRecord, AttemptRecord, AttemptRecord];
    expect(committedUpdateOf(first), '合法批量必须一条 committed/update 记录（红：当前批量未实现）').toBeDefined();
    const effectKeys = (result: AttemptResult): string[] => Object.keys(result).sort();
    for (const rejected of [second, third]) {
      expect(rejected.operation).toBe('root-mutation');
      expect(rejected.stage).toBe('validation');
      expect(rejected.result).toEqual({ kind: 'rejected' });
      expect(effectKeys(rejected.result), 'rejected 禁止携带 update effect').toEqual(['kind']);
      expect(rejected.code, '形状错误无稳定码').toBeUndefined();
      expect(rejected.input.capture).toBe('digest');
    }
    await handle.release();
    await writer.dispose();
  });

  it('R7 批量走同一写槽：排队期间调用方改动 ops 数组 → 槽起点快照获胜（不是调用时快照）', async () => {
    let release!: () => void;
    const p0Gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { runtime, handle, writer } = await setup({ p0Gate, waitReady: false });

    const batch: { ops: Array<{ op: string; path: Array<string | number>; value: unknown }> } = {
      ops: [{ op: 'set', path: ['n'], value: 2 }],
    };
    const pending = runtime.mutateData(batch);
    batch.ops[0]!.value = 99; // 调用方在排队期间改动输入引用（合法：快照时点 = 槽开始）
    release();
    await expect.poll(() => runtime.getStatus().schema.state, { interval: 10, timeout: 5_000 }).toBe('ready');

    await expect(pending).resolves.toEqual({ ok: true });
    expect(readOk(runtime, ['n']), '槽起点快照必须获胜（99），而非调用时值（2）').toBe(99);
    await handle.release();
    await writer.dispose();
  });
});

// ── R5–R6：负控 / 回归锚（当前 HEAD 绿灯，实现后必须保持）──────────────────────

describe('issue #350 负控 — 写槽边界与快照纪律对批量同样成立（当前 HEAD 绿灯）', () => {
  it('R5 lifecycle 停接纳次序不变：close 后批量信封零入队拒绝（RUNTIME_WRITE_DISABLED / not-accessed / 零输入访问）', async () => {
    const log = createBoundedMemoryDiagnosticLog({ inputPolicy: 'digest', updateCapture: true });
    const { runtime, writer, doc } = await setup({ log });
    const before = bytesOf(doc);
    await runtime.close();

    let accesses = 0;
    const batch = new Proxy({ ops: [{ op: 'set', path: ['n'], value: 2 }] } as Record<string, unknown>, {
      get(target, key, receiver) {
        accesses += 1;
        return Reflect.get(target, key, receiver);
      },
      ownKeys(target) {
        accesses += 1;
        return Reflect.ownKeys(target);
      },
      getOwnPropertyDescriptor(target, key) {
        accesses += 1;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
      has(target, key) {
        accesses += 1;
        return Reflect.has(target, key);
      },
    });
    const result = await runtime.mutateData(batch);

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).toContain('RUNTIME_WRITE_DISABLED');
    expect(accesses, '停接纳拒绝必须先于输入访问（Proxy 零触发）').toBe(0);
    expect(bytesOf(doc)).toEqual(before);

    const recs = await waitAttempts(log, 1);
    const rec = recs[0]!;
    expect(rec.operation).toBe('root-mutation');
    expect(rec.stage).toBe('acceptance');
    expect(rec.result).toEqual({ kind: 'rejected' });
    expect(rec.input.capture).toBe('not-accessed');
    expect(rec.code).toBe('RUNTIME_WRITE_DISABLED');
    await writer.dispose();
  });

  it('R6 S3 快照边界：{ops} 信封内的非 plain data 整体拒绝（MUTATION_INPUT_NOT_PLAIN_DATA、零写入、accessor 零执行）', async () => {
    const { runtime, handle, writer, doc, notifierCalls } = await setup();
    const before = bytesOf(doc);

    class Hostile {}
    const classInstance = await runtime.mutateData({ ops: [{ op: 'set', path: ['n'], value: new Hostile() }] });
    expect(classInstance.ok).toBe(false);
    expect(JSON.stringify(classInstance)).toContain('MUTATION_INPUT_NOT_PLAIN_DATA');

    let fired = 0;
    const element: Record<string, unknown> = { op: 'set', path: ['n'] };
    Object.defineProperty(element, 'value', {
      enumerable: true,
      get: () => {
        fired += 1;
        return 42;
      },
    });
    const accessor = await runtime.mutateData({ ops: [element] });
    expect(accessor.ok).toBe(false);
    expect(JSON.stringify(accessor)).toContain('MUTATION_INPUT_NOT_PLAIN_DATA');
    expect(fired, '快照器拒绝先于任何输入值读取').toBe(0);

    expect(bytesOf(doc)).toEqual(before);
    expect(notifierCalls()).toBe(0);
    await handle.release();
    await writer.dispose();
  });
});
