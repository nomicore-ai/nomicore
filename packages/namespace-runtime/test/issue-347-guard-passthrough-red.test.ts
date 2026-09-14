/**
 * SA6 验收契约（红灯）— issue #347 条件写核心（guard I）：namespace-runtime 端到端
 * `mutateData` 透传 / 零写入 / 诊断单条记录（ADR 0025 L58/L60 + ADR 0026 L29/L53–55）。
 *
 * 契约来源（用例 ID 与可观察断言按 `wiki/raw/task_issue-347_sa6_contract.md` §12.8 落地）：
 * - ADR 0025 L48–51/L72–74：评估在写槽内、先于 schema 校验与逐操作 prepare；两种形态
 *   顶层 guard；批内元素不得携带 guard；
 * - ADR 0025 L58：评估不满足 → 零写入单 issue、稳定码 `MUTATION_GUARD_MISMATCH`、
 *   `issue.path` = guard 条件路径；
 * - ADR 0025 L60 + ADR 0011/0014：guard 拒绝经写槽 R9 同源透传（stage=validation、
 *   result=rejected），namespace-runtime 写槽零改动；record 级无顶层 code，码落
 *   `issues.items[].code`；
 * - issue #347 AC6/AC8。
 *
 * 红灯现状（HEAD 1b55d5c，SA6 §5 probe 实测）：任何携带 guard 的信封在 doc-runtime 信封
 * 解析期按「未知信封键」拒绝（零写入 + 无码 + 一条 rejected/validation 记录）——E2–E5 在
 * 「合法 guard 必须提交 / 不满足必须带稳定码」处红；E1/E6/E7 为负控与分层回归锚，当前绿，
 * 实现后必须保持绿（E6 证明 S3 快照层对非有限数/undefined 值键的先行拒绝语义不被改变）。
 *
 * 纪律：全部断言观察运行时行为（结果联合、readData 值、Y.Doc 字节、update 事件、notifier
 * 计数、诊断 record 内容）；无 skip/only/todo/env override；无源码字符串断言。
 */
import type { MutationEnvelope } from '@nomicore/doc-runtime';
import type { GuardedMutation, ValidatedMutation } from '@nomicore/doc-runtime';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { DocHandle, User } from '@nomicore/persistence';
import { createMemoryPersistence } from '@nomicore/persistence';
import * as docRuntime from '@nomicore/doc-runtime';
import { realPersistenceScheduler } from './real-persistence-scheduler.js';
import { createNamespaceRuntimeWithSeam } from '../src/runtime.js';
import type { NamespaceRuntime } from '../src/index.js';
import {
  createBoundedMemoryDiagnosticLog,
  type AttemptRecord,
  type BoundedMemoryDiagnosticLog,
} from '../../namespace-diagnostic-log/src/index.js';

/** 公共入口值导出（HEAD 为 undefined → E2–E5 红；实现后 === 冻结字面量稳定码）。 */
const GUARD_MISMATCH_EXPORT = (docRuntime as Record<string, unknown>).MUTATION_GUARD_MISMATCH;
const MUTATION_GUARD_MISMATCH = 'MUTATION_GUARD_MISMATCH';

// ── fixture（SA6 §12.8：n:1, a:'x', tasks.t1/t2.status='open', values:[1,2,3]）──────────

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

async function setup(opts: { log?: BoundedMemoryDiagnosticLog } = {}): Promise<Ctx> {
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
  const runtime = createNamespaceRuntimeWithSeam(seam as never) as unknown as NamespaceRuntime;
  await expect.poll(() => runtime.getStatus().schema.state, { interval: 10, timeout: 5_000 }).toBe('ready');
  return { runtime, handle, writer, doc: handle.doc, notifierCalls: () => notifierCalls };
}

async function teardown(ctx: Ctx): Promise<void> {
  await ctx.handle.release();
  await ctx.writer.dispose();
}

function readOk(runtime: NamespaceRuntime, path: readonly (string | number)[]): unknown {
  const read = runtime.readData(path);
  expect(read.ok, `readData(${JSON.stringify(path)}) 应成功：${JSON.stringify(read)}`).toBe(true);
  return (read as { value: unknown }).value;
}

function bytesOf(doc: Y.Doc): number[] {
  return [...Y.encodeStateAsUpdate(doc)];
}

interface MutateFailure {
  ok: false;
  issues: Array<{ message: string; path: Array<string | number>; code?: string }>;
}

function failureOf(result: Awaited<ReturnType<NamespaceRuntime['mutateData']>>): MutateFailure {
  expect(result.ok, `必须领域拒绝；实际 ${JSON.stringify(result)}`).toBe(false);
  return result as MutateFailure;
}

async function waitAttempts(log: BoundedMemoryDiagnosticLog, expected: number): Promise<AttemptRecord[]> {
  await expect
    .poll(() => log.records().filter((record) => record.recordKind === 'attempt').length, { interval: 5, timeout: 3_000 })
    .toBe(expected);
  return log.records().filter((record): record is AttemptRecord => record.recordKind === 'attempt');
}

const LEGAL_OPS: readonly ValidatedMutation[] = [
  { op: 'set', path: ['tasks', 't1', 'status'], value: 'reviewing' },
  { op: 'set', path: ['tasks', 't1', 'reviewer'], value: 'u9' },
  { op: 'array-insert', path: ['values'], index: 1, values: [9] },
];

// ── E1–E7：端到端透传（AC6/AC8）────────────────────────────────────────────────────

describe('issue #347 E 组 — mutateData 携带 guard 的端到端透传（AC6/AC8，HEAD 红）', () => {
  it('E1 负控：无 guard 单操作 set 仍 ok:true、值可见、notifier 1、1 update（现役不变）', async () => {
    const ctx = await setup();
    const updates: Uint8Array[] = [];
    ctx.doc.on('update', (update: Uint8Array) => updates.push(update));

    const result = await ctx.runtime.mutateData({ op: 'set', path: ['n'], value: 2 });

    expect(result).toEqual({ ok: true });
    expect(readOk(ctx.runtime, ['n'])).toBe(2);
    expect(ctx.notifierCalls(), '成功写恰一次 dirty 登记').toBe(1);
    expect(updates).toHaveLength(1);
    await teardown(ctx);
  });

  it('E2 单操作 guard 满足：ok:true、readData 见新值、notifier 1、恰 1 update', async () => {
    const ctx = await setup();
    const updates: Uint8Array[] = [];
    ctx.doc.on('update', (update: Uint8Array) => updates.push(update));

    const result = await ctx.runtime.mutateData({
      op: 'set',
      path: ['tasks', 't1', 'status'],
      value: 'reviewing',
      guard: { path: ['tasks', 't1', 'status'], equals: 'open' },
    });

    expect(result, `合法 guard 满足必须经公共面透传为 ok:true；实际 ${JSON.stringify(result)}`).toEqual({ ok: true });
    expect(readOk(ctx.runtime, ['tasks', 't1', 'status'])).toBe('reviewing');
    expect(ctx.notifierCalls()).toBe(1);
    expect(updates).toHaveLength(1);
    await teardown(ctx);
  });

  it('E3 单操作 guard 不满足：稳定码经 R9 透传至 issues 与诊断 issues.items[].code，record 级无码、零写入、notifier 0', async () => {
    const log = createBoundedMemoryDiagnosticLog({ inputPolicy: 'digest', updateCapture: true });
    const ctx = await setup({ log });
    const before = bytesOf(ctx.doc);
    const updates: Uint8Array[] = [];
    ctx.doc.on('update', (update: Uint8Array) => updates.push(update));

    const result = await ctx.runtime.mutateData({
      op: 'set',
      path: ['tasks', 't1', 'status'],
      value: 'reviewing',
      guard: { path: ['tasks', 't1', 'status'], equals: 'draft' },
    });

    const failure = failureOf(result);
    expect(failure.issues, 'E3：恰一条 issue').toHaveLength(1);
    const issue = failure.issues[0]!;
    expect(issue.code, 'E3：issues[0].code 必须为稳定码').toBe(MUTATION_GUARD_MISMATCH);
    expect(issue.code, 'E3：必须与 doc-runtime 公共入口导出同源').toBe(GUARD_MISMATCH_EXPORT);
    expect(issue.path, 'E3：issue.path = guard 条件路径').toEqual(['tasks', 't1', 'status']);
    expect(bytesOf(ctx.doc), 'E3：零写入（文档字节不变）').toEqual(before);
    expect(updates, 'E3：拒绝不得产生 update').toHaveLength(0);
    expect(ctx.notifierCalls(), 'E3：拒绝不得 dirty 登记').toBe(0);

    const records = await waitAttempts(log, 1);
    const record = records[0]!;
    expect(record.operation).toBe('root-mutation');
    expect(record.stage).toBe('validation');
    expect(record.result).toEqual({ kind: 'rejected' });
    expect(record.code, 'E3：diagValidation 无顶层 code（SA8 明令）').toBeUndefined();
    expect(record.issues?.policy).toBe('full');
    expect(record.issues?.items, 'E3：诊断恰一条 issue 条目').toHaveLength(1);
    expect(record.issues?.items[0]?.code, 'E3：稳定码落 issues.items[].code').toBe(MUTATION_GUARD_MISMATCH);
    await teardown(ctx);
  });

  it('E4 批量顶层 guard 满足：整批落盘、notifier 1、恰 1 update（单事务原子）', async () => {
    const ctx = await setup();
    const updates: Uint8Array[] = [];
    ctx.doc.on('update', (update: Uint8Array) => updates.push(update));

    const result = await ctx.runtime.mutateData({
      ops: LEGAL_OPS,
      guard: { path: ['tasks', 't1', 'status'], equals: 'open' },
    });

    expect(result, `批量顶层 guard 满足必须 ok:true；实际 ${JSON.stringify(result)}`).toEqual({ ok: true });
    expect(readOk(ctx.runtime, ['tasks', 't1', 'status'])).toBe('reviewing');
    expect(readOk(ctx.runtime, ['tasks', 't1', 'reviewer'])).toBe('u9');
    expect(readOk(ctx.runtime, ['values'])).toEqual([1, 9, 2, 3]);
    expect(ctx.notifierCalls()).toBe(1);
    expect(updates).toHaveLength(1);
    await teardown(ctx);
  });

  it('E5 批量顶层 guard 不满足：恰 1 issue + 稳定码 + 零写入 + notifier 0 + 诊断 rejected/validation 带码', async () => {
    const log = createBoundedMemoryDiagnosticLog({ inputPolicy: 'digest', updateCapture: true });
    const ctx = await setup({ log });
    const before = bytesOf(ctx.doc);
    const updates: Uint8Array[] = [];
    ctx.doc.on('update', (update: Uint8Array) => updates.push(update));

    const result = await ctx.runtime.mutateData({
      ops: [
        { op: 'set', path: ['n'], value: 5252 },
        { op: 'set', path: ['a'], value: 'y' },
      ],
      guard: { path: ['n'], equals: 4242 },
    });

    const failure = failureOf(result);
    expect(failure.issues, 'E5：guard 先于逐操作 prepare → 恰一条 issue（无聚合）').toHaveLength(1);
    expect(failure.issues[0]?.code).toBe(MUTATION_GUARD_MISMATCH);
    expect(failure.issues[0]?.path).toEqual(['n']);
    expect(bytesOf(ctx.doc), 'E5：整体零写入').toEqual(before);
    expect(updates).toHaveLength(0);
    expect(ctx.notifierCalls()).toBe(0);

    const records = await waitAttempts(log, 1);
    const record = records[0]!;
    expect(record.stage).toBe('validation');
    expect(record.result).toEqual({ kind: 'rejected' });
    expect(record.code).toBeUndefined();
    expect(record.issues?.items[0]?.code).toBe(MUTATION_GUARD_MISMATCH);
    await teardown(ctx);
  });

  it('E6 分层负控（绿）：guard.equals 含 NaN / undefined 值键仍由 S3 快照层以 MUTATION_INPUT_NOT_PLAIN_DATA 先拒', async () => {
    const log = createBoundedMemoryDiagnosticLog({ inputPolicy: 'digest', updateCapture: true });
    const ctx = await setup({ log });
    const before = bytesOf(ctx.doc);
    const updates: Uint8Array[] = [];
    ctx.doc.on('update', (update: Uint8Array) => updates.push(update));

    const nanResult = await ctx.runtime.mutateData({
      op: 'set',
      path: ['n'],
      value: 2,
      guard: { path: ['n'], equals: NaN },
    });
    const nanFailure = failureOf(nanResult);
    expect(nanFailure.issues[0]?.message, 'E6：S3 层非有限数拒绝语义不变').toContain('MUTATION_INPUT_NOT_PLAIN_DATA');

    const undefinedKeyResult = await ctx.runtime.mutateData({
      op: 'set',
      path: ['n'],
      value: 2,
      guard: { path: ['n'], equals: { gone: undefined } },
    });
    const undefinedKeyFailure = failureOf(undefinedKeyResult);
    expect(undefinedKeyFailure.issues[0]?.message, 'E6：S3 层 undefined 值键拒绝语义不变').toContain(
      'MUTATION_INPUT_NOT_PLAIN_DATA',
    );

    expect(bytesOf(ctx.doc), 'E6：S3 先拒同样零写入').toEqual(before);
    expect(updates).toHaveLength(0);
    expect(ctx.notifierCalls()).toBe(0);

    const records = await waitAttempts(log, 2);
    for (const record of records) {
      expect(record.stage, 'E6：拒绝发生在槽起点快照阶段').toBe('input-snapshot');
      expect(record.result).toEqual({ kind: 'rejected' });
      expect(record.code, 'E6：S3 层稳定码在 record 级').toBe('MUTATION_INPUT_NOT_PLAIN_DATA');
    }
    await teardown(ctx);
  });

  it('E7 元素携带 guard（形状错误）：无码拒绝、零写入、notifier 0（ADR 0026 L29 冻结面）', async () => {
    const ctx = await setup();
    const before = bytesOf(ctx.doc);
    const updates: Uint8Array[] = [];
    ctx.doc.on('update', (update: Uint8Array) => updates.push(update));

    const result = await ctx.runtime.mutateData({
      ops: [{ op: 'set', path: ['n'], value: 5252, guard: { path: ['n'], equals: 1 } }],
    } as MutationEnvelope);

    const failure = failureOf(result);
    expect(failure.issues[0]?.code, 'E7：批内元素 guard = 形状错误（无码、不可重试）').toBeUndefined();
    expect(bytesOf(ctx.doc), 'E7：零写入').toEqual(before);
    expect(updates).toHaveLength(0);
    expect(ctx.notifierCalls()).toBe(0);
    await teardown(ctx);
  });
});
