/**
 * issue #350 验收（F1 端到端 + F4/F5 落点）— 批量信封端到端与诊断记录面
 * （设计 `wiki/raw/task_issue-350_design.md` §12.1 文件 B；SA2 iteration 2 §12 AC1″/AC2 行）。
 *
 * 契约来源：
 * - ADR 0026 L30/L34/L35：共享边界兄弟路径合法；全部成功 → 单事务按序提交 → 逐操作边界
 *   验证；跨实体路径同样原子；一个写槽 = 一次变更尝试 = 一条诊断记录；
 * - ADR 0008 L49–51 / ADR 0011 / ADR 0014：槽起点快照、issues 同源透传、rejected 禁携带
 *   update、operation 词表仍 `root-mutation`、聚合 issues 进入同一 record 的 issues 载荷；
 * - 设计 §7.7（namespace-runtime 与诊断包零改动）+ §12.1（NS-1 含 array-* 载荷折入共享
 *   parent 边界；NS-2 记录面聚合 issues ≥2 且顺序 = ops 序）。
 *
 * NS-1 断言**后续单操作仍 ok:true**（写能力保持）——合法共享边界批量不得伪触发 E201-C
 * （fatal 为 throw 通道 + `markWriteFatal` 永久禁写）；NS-2 断言聚合 issues 同源进入同一
 * rejected record（memory log `issuesPolicy` 默认 `'full'`）。
 *
 * 纪律：全部断言观察运行时行为（结果联合、readData 值、Y.Doc 字节、update 事件、诊断
 * record 内容）；无 skip/only/todo/env override；无源码字符串断言。
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
  type BoundedMemoryDiagnosticLog,
  type UpdateCarrier,
} from '../../namespace-diagnostic-log/src/index.js';

// ── fixture（自有 fixture：schema 扩 notes 字段，不动 SA6 契约文件）────────────────

const NOW_MS = 1_700_000_000_000;
const OWNER: User = { userId: 'u-alice' };
const TEXT = `type ROOT = {
  n: number;
  a: string;
  tasks: Record<string, { status: string; reviewer?: string; notes: YArray<string> }>;
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
    const notes = new Y.Array<string>();
    notes.push(['n0']);
    entry.set('notes', notes);
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

// ── NS-1 / NS-2 ──────────────────────────────────────────────────────────────

describe('issue #350 批量信封端到端 — 共享边界单事务原子 + 一条 committed 记录（设计 §12.1 文件 B）', () => {
  it('NS-1 array-* 载荷折入共享 parent 边界经公共面 ok:true：readData 见全部、1 update、1 notifier、写能力保持、恰一条 committed/update record', async () => {
    const log = createBoundedMemoryDiagnosticLog({ inputPolicy: 'digest', updateCapture: true });
    const { runtime, handle, writer, doc, notifierCalls } = await setup({ log });
    const updates: Uint8Array[] = [];
    doc.on('update', (update: Uint8Array) => updates.push(update));

    const baseState = Y.encodeStateAsUpdate(doc);
    const result = await runtime.mutateData({
      ops: [
        { op: 'delete', path: ['tasks', 't1', 'reviewer'] },
        { op: 'set', path: ['tasks', 't1', 'status'], value: 'reviewing' },
        { op: 'array-insert', path: ['tasks', 't1', 'notes'], index: 1, values: ['n1'] },
      ],
    });

    expect(result, `共享边界批量经公共面必须透传为 ok:true（伪 E201-C 为 throw 通道）；实际 ${JSON.stringify(result)}`).toEqual({ ok: true });
    expect(readOk(runtime, ['tasks', 't1', 'status'])).toBe('reviewing');
    expect(readOk(runtime, ['tasks', 't1', 'reviewer']), 'delete 生效：reviewer 缺席').toBeUndefined();
    expect(readOk(runtime, ['tasks', 't1', 'notes'])).toEqual(['n0', 'n1']);
    expect(updates, '单事务恰好一条 owned update').toHaveLength(1);
    expect(notifierCalls(), '成功批量恰一次 dirty 登记（一槽一尝试）').toBe(1);

    // 写能力保持：合法批量不得 markWriteFatal（后续单操作仍可写）
    const after = await runtime.mutateData({ op: 'set', path: ['n'], value: 9 });
    expect(after, '共享边界批量后单操作必须仍 ok:true（证明无永久禁写）').toEqual({ ok: true });
    expect(readOk(runtime, ['n'])).toBe(9);

    const recs = await waitAttempts(log, 2);
    expect(recs, '批量恰好一条记录 + 后续单操作一条记录').toHaveLength(2);
    expect(recs[0]!.operation).toBe('root-mutation');
    expect(recs[0]!.stage).toBe('transaction');
    expect(recs[0]!.input.capture).toBe('digest');
    const carrier = committedUpdateOf(recs[0]!);
    const fresh = replay(baseState, carrier);
    const freshRoot = fresh.getMap('ROOT');
    const freshT1 = (freshRoot.get('tasks') as Y.Map<unknown>).get('t1') as Y.Map<unknown>;
    expect(freshT1.get('status'), '批量单条 owned update bytes 重放见全部值').toBe('reviewing');
    expect(freshT1.get('reviewer')).toBeUndefined();
    expect((freshT1.get('notes') as Y.Array<string>).toJSON()).toEqual(['n0', 'n1']);
    expect(recs[1]!.result.kind, '后续单操作为第二条记录（一槽一尝试）').toBe('committed');
    await handle.release();
    await writer.dispose();
  });
});

describe('issue #350 批量失败诊断记录面 — 聚合 issues 同源进入同一 rejected record（F4/NS-2）', () => {
  it('NS-2 失败批量：rejected/validation、无稳定码、issues 载荷 ≥2 且顺序 = ops 序；零写入/0 update/notifier 0', async () => {
    const log = createBoundedMemoryDiagnosticLog({ inputPolicy: 'digest', updateCapture: true });
    const { runtime, handle, writer, doc, notifierCalls } = await setup({ log });
    const before = bytesOf(doc);
    const updates: Uint8Array[] = [];
    doc.on('update', (update: Uint8Array) => updates.push(update));

    const result = await runtime.mutateData({
      ops: [
        { op: 'set', path: ['n'], value: 'bad' }, // 失败 1
        { op: 'set', path: ['a'], value: 'y' }, // 合法——证明整体零写入
        { op: 'set', path: ['tasks', 't1', 'status'], value: 5 }, // 失败 2
      ],
    });

    expect(result.ok, `批量含失败操作必须 ok:false；实际 ${JSON.stringify(result)}`).toBe(false);
    const paths = issuePathsOf(result);
    expect(paths.length, `result 必须聚合全部失败操作的 issues；实际 ${JSON.stringify(result)}`).toBeGreaterThanOrEqual(2);
    expect(paths.some((path) => JSON.stringify(path) === JSON.stringify(['n']))).toBe(true);
    expect(paths.some((path) => JSON.stringify(path) === JSON.stringify(['tasks', 't1', 'status']))).toBe(true);
    expect(bytesOf(doc), '整体零写入（文档字节不变）').toEqual(before);
    expect(updates).toHaveLength(0);
    expect(notifierCalls(), '失败批量不得调用 dirty notifier').toBe(0);

    const recs = await waitAttempts(log, 1);
    const rec = recs[0]!;
    expect(rec.operation).toBe('root-mutation');
    expect(rec.stage).toBe('validation');
    expect(rec.result).toEqual({ kind: 'rejected' });
    expect(Object.keys(rec.result), 'rejected 禁止携带 update effect').toEqual(['kind']);
    expect(rec.code, '操作失败无稳定码').toBeUndefined();
    expect(rec.input.capture).toBe('digest');
    const issues = rec.issues;
    expect(issues, 'rejected record 必须携带聚合 issues 载荷（memory log issuesPolicy 默认 full）').toBeDefined();
    expect(issues!.policy).toBe('full');
    expect(issues!.items.length, '记录面 issues 载荷 ≥2（同源透传，非 fail-fast 单错）').toBeGreaterThanOrEqual(2);
    expect(
      issues!.items.map((issue) => [...issue.path]),
      '记录面 issues 顺序 = ops 顺序',
    ).toEqual([['n'], ['tasks', 't1', 'status']]);
    await handle.release();
    await writer.dispose();
  });
});
