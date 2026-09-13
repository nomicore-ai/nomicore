/**
 * SA6 验收契约（绿基线冻结）— issue #349 条件写端到端（guard III）：
 * `mutateData` 透传 / 诊断 rejected / 写序列器竞争与 FIFO 独占证明面。
 *
 * 契约来源（用例 ID K1–K6 / L1–L4 / N1 / D1–D2 / NC1–NC4 与可观察断言按
 * `wiki/raw/task_issue-349_sa6_contract.md` §12.2–§12.6 逐条落地；落位与 fixture 规格按
 * `wiki/raw/task_issue-349_design.md` §7 D1/D2/D5）：
 * - ADR 0025 L49/L51：原子性来自写序列器 FIFO 独占（不来自 Yjs 事务）；本槽独占期间无
 *   其他受控写，guard 读到的 committed 值在本槽提交前不会改变——K1/K3/K4/K5 是
 *   「评估位置 + 原子性」的槽级与槽间竞争证明面（TOCTOU 消除）；
 * - ADR 0025 L58：评估不满足 → 零写入单 issue、稳定码 `MUTATION_GUARD_MISMATCH`、
 *   `issue.path` = guard 条件路径；
 * - ADR 0025 L60 + ADR 0011/0014：guard 拒绝经写槽 R9 同源透传（stage=validation、
 *   result=rejected）；namespace-runtime 写槽零改动；record 级无顶层 code，码落
 *   `issues.items[].code`；
 * - ADR 0025 L74 + ADR 0026 L28–29/L34–36/L46/L55：guard 适用于两种形态顶层（批内元素
 *   禁 guard）；批量原子性 = 单事务单条 update bytes；一个写槽 = 一次变更尝试 = 一条记录；
 * - ADR 0008 L40–51（唯一严格 FIFO 与槽序）/L99（close 同步停接纳、已接纳任务无条件
 *   排空）/L97/L101（包内 seam 观测合法，K4 不新增公共面）；
 * - issue #349 AC1–AC8。
 *
 * 绿基线声明（SA6 §13，诚实留档）：本票无红灯相——guard 核由 #347 落地，SA6 probe
 * P-A…P-F 在 HEAD `61e2daa` 实测全部目标断言成立。本文件把该证明面固化为可回归的
 * 可执行语料；任何 K/L/N/D 断言变红 = 回归或阻断性偏差（设计 §7 D3 升级路径），
 * 不得就地放宽断言。
 *
 * 纪律：全部断言观察运行时行为（结果联合、readData 值、Y.Doc 字节、update 事件、
 * notifier 计数、诊断 record 内容、seam 槽样本）；无 skip/only/todo/env override；
 * 无源码字符串断言；无 sleep 阈值断言。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { DocHandle, User } from '@nomicore/persistence';
import { createMemoryPersistence } from '@nomicore/persistence';
import * as docRuntime from '@nomicore/doc-runtime';
import { realPersistenceScheduler } from './real-persistence-scheduler.js';
import { createNamespaceRuntimeWithSeam } from '../src/runtime.js';
import type { NamespaceRuntime } from '../src/index.js';
import type { SequencerSlotSample } from '../src/sequencer.js';
import {
  createBoundedMemoryDiagnosticLog,
  type AttemptRecord,
  type BoundedMemoryDiagnosticLog,
} from '../../namespace-diagnostic-log/src/index.js';

/** 稳定码单源：与 doc-runtime 公共入口导出同源（SA6 §12.0 码载体口径）。 */
const GUARD_MISMATCH_EXPORT: string = docRuntime.MUTATION_GUARD_MISMATCH;
const MUTATION_GUARD_MISMATCH = 'MUTATION_GUARD_MISMATCH';
/** 停接纳/写禁用统一码族（ADR 0008 L125；message 区分域）。 */
const RUNTIME_WRITE_DISABLED = 'RUNTIME_WRITE_DISABLED';
/** S3 快照层非 plain data 稳定码（record 级顶层码；ADR 0008 槽序 S3 冻结）。 */
const MUTATION_INPUT_NOT_PLAIN_DATA = 'MUTATION_INPUT_NOT_PLAIN_DATA';
/** K 组统一 guard 条件路径（ADR 0025 L58：issue.path = guard 条件路径）。 */
const GUARD_PATH = ['tasks', 't1', 'status'] as const;

// ── fixture（沿用 #347 E2E 形态：memory persistence + 包内 seam + poll ready）──────────

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

interface SetupOptions {
  /** 诊断 log（一律用例调用点构造：`{ inputPolicy: 'digest', updateCapture: true }`）。 */
  readonly log?: BoundedMemoryDiagnosticLog;
  /** K4 槽级 seam 观测 sink（非空即注入 `replicationObservability`）。 */
  readonly samples?: SequencerSlotSample[];
  /** L4 可控 notifier 门：已在 S6 提交的写挂住于 dirty 登记之前。 */
  readonly notifyGate?: Promise<void>;
}

async function setup(opts: SetupOptions = {}): Promise<Ctx> {
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
      // L4：门在场时写槽挂住于 S6（事务已提交、槽未 settle——close 排空窗口）。
      if (opts.notifyGate !== undefined) await opts.notifyGate;
      await writer.saveDoc(handle);
    },
  };
  if (opts.log !== undefined) {
    seam.diagnosticEmitter = opts.log.emitter;
    seam.clock = () => NOW_MS;
  }
  const samples = opts.samples;
  if (samples !== undefined) {
    // K4：既有 seam 先例同款（`sequencer-slotkind-close-barrier.test.ts`）——stageClock 与
    // slotMetrics 双在场才启用记账；单调计数保证 waitMs/runMs 为可观测 number。
    let tick = 0;
    seam.replicationObservability = {
      stageClock: { now: () => (tick += 1) },
      slotMetrics: (sample: SequencerSlotSample) => {
        samples.push(sample);
      },
    };
  }
  const runtime = createNamespaceRuntimeWithSeam(seam as never) as unknown as NamespaceRuntime;
  await expect.poll(() => runtime.getStatus().schema.state, { interval: 10, timeout: 5_000 }).toBe('ready');
  return { runtime, handle, writer, doc: handle.doc, notifierCalls: () => notifierCalls };
}

async function teardown(ctx: Ctx): Promise<void> {
  await ctx.handle.release(); // close 排空后二次 release 幂等（persistence/lifecycle.ts L157–161）
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

function collectUpdates(doc: Y.Doc): Uint8Array[] {
  const updates: Uint8Array[] = [];
  doc.on('update', (update: Uint8Array) => updates.push(update));
  return updates;
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

/** committed/update 记录的载体长度（K1⑤/K5④/K6：单事务 bytes 与 record 载体一致）。 */
function payloadLengthOf(record: AttemptRecord): number {
  const result = record.result;
  expect(result.kind, `记录应为 committed；实际 ${JSON.stringify(result)}`).toBe('committed');
  expect(result.kind === 'committed' ? result.effect : null, `记录应为 committed/update；实际 ${JSON.stringify(result)}`).toBe(
    'update',
  );
  if (result.kind === 'committed' && result.effect === 'update') return result.update.payloadLength;
  throw new Error(`unreachable：committed/update 断言已失败——${JSON.stringify(result)}`);
}

/** acceptance 记录冻结口径（SA6 §12.0：gate 拒绝 = acceptance/not-accessed/带稳定码）。 */
function expectAcceptanceRecord(record: AttemptRecord): void {
  expect(record.operation).toBe('root-mutation');
  expect(record.stage).toBe('acceptance');
  expect(record.result).toEqual({ kind: 'rejected' });
  expect(record.code).toBe(RUNTIME_WRITE_DISABLED);
  expect(record.input.capture).toBe('not-accessed');
}

/** L3：hostile Proxy 输入——gate 若在其后（或读取输入）即计数并抛。 */
function hostileInput(): { readonly proxy: unknown; readonly accesses: () => number } {
  let accesses = 0;
  const trap = (): never => {
    accesses += 1;
    throw new Error('lifecycle 接纳门不得访问输入（hostile Proxy trap 已触发）');
  };
  const proxy = new Proxy(
    {},
    { get: trap, has: trap, ownKeys: trap },
  );
  return { proxy, accesses: () => accesses };
}

/** L4：可控门。 */
function deferred(): { readonly promise: Promise<void>; readonly resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** N1⑤：显式 unhandledRejection 探针（沿 registry-idle.test.ts 先例；不用全局忽略兜底）。 */
function collectUnhandledRejections(): { readonly events: unknown[]; dispose(): void } {
  const events: unknown[] = [];
  const onRejection = (reason: unknown): void => {
    events.push(reason);
  };
  process.on('unhandledRejection', onRejection);
  return {
    events,
    dispose() {
      process.off('unhandledRejection', onRejection);
    },
  };
}

/** 释放后用 handle 事实观测（persistence/lifecycle.ts L163 `isReleased`）。 */
function isReleased(handle: DocHandle): boolean {
  return (handle as unknown as { isReleased: boolean }).isReleased;
}

const SINGLE_GUARDED = (value: string, equals: string) => ({
  op: 'set',
  path: [...GUARD_PATH],
  value,
  guard: { path: [...GUARD_PATH], equals },
});

const LEGAL_OPS = [
  { op: 'set', path: ['tasks', 't1', 'status'], value: 'reviewing' },
  { op: 'set', path: ['tasks', 't1', 'reviewer'], value: 'u9' },
  { op: 'array-insert', path: ['values'], index: 1, values: [9] },
];

const BATCH_GUARDED = (value: string) => ({
  ops: [
    { op: 'set', path: ['tasks', 't1', 'status'], value },
    { op: 'set', path: ['n'], value: 7 },
    { op: 'array-insert', path: ['values'], index: 1, values: [9] },
  ],
  guard: { path: [...GUARD_PATH], equals: 'open' },
});

// ── K 组：写序列器竞争与 FIFO 独占（AC4/AC1/AC2/AC3）────────────────────────────────

describe('issue #349 K 组 — 写序列器竞争与 FIFO 独占', () => {
  it('K1 单操作双写竞争：先到者提交、后到者基于已提交新值带码零写入拒绝（ADR 0025 L49/L51/L58/L60）', async () => {
    const log = createBoundedMemoryDiagnosticLog({ inputPolicy: 'digest', updateCapture: true });
    const ctx = await setup({ log });
    const updates = collectUpdates(ctx.doc);

    // 背靠背同步入队（接纳序由调用序唯一决定）——FIFO 独占下第二写必见第一写已提交值。
    const p1 = ctx.runtime.mutateData(SINGLE_GUARDED('reviewing', 'open'));
    const p2 = ctx.runtime.mutateData(SINGLE_GUARDED('blocked', 'open'));
    const [r1, r2] = await Promise.all([p1, p2]);

    // ① 先到者成功
    expect(r1).toEqual({ ok: true });
    // ② 后到者：单 issue、稳定码（与 doc-runtime 导出同源）、path = guard 条件路径
    const failure = failureOf(r2);
    expect(failure.issues, 'K1②：恰一条 issue').toHaveLength(1);
    const issue = failure.issues[0]!;
    expect(GUARD_MISMATCH_EXPORT, 'K1②：稳定码字面量冻结').toBe(MUTATION_GUARD_MISMATCH);
    expect(issue.code, 'K1②：码落 issues[0].code').toBe(MUTATION_GUARD_MISMATCH);
    expect(issue.code, 'K1②：与公共入口导出同源').toBe(GUARD_MISMATCH_EXPORT);
    expect(issue.message).toMatch(/^MUTATION_GUARD_MISMATCH/);
    expect(issue.path, 'K1②：issue.path = guard 条件路径').toEqual([...GUARD_PATH]);
    // ③ 终值 = 胜者（拒绝方零写入）
    expect(readOk(ctx.runtime, GUARD_PATH)).toBe('reviewing');
    // ④ 恰 1 次 update 事件 + 恰 1 次 dirty 登记（第二写零写入）
    expect(updates, 'K1④：拒绝不得产生 update').toHaveLength(1);
    expect(ctx.notifierCalls(), 'K1④：拒绝不得 dirty 登记').toBe(1);
    // ⑤ 诊断恰 2 条：committed/transaction（载体长度与单条 update 一致）+ rejected/validation
    const records = await waitAttempts(log, 2);
    expect(records[0]!.stage).toBe('transaction');
    expect(records[0]!.result).toMatchObject({ kind: 'committed', effect: 'update' });
    expect(payloadLengthOf(records[0]!), 'K1⑤：单事务 bytes 与 record 载体一致').toBe(updates[0]!.length);
    expect(records[1]!.stage).toBe('validation');
    expect(records[1]!.result).toEqual({ kind: 'rejected' });
    expect(records[1]!.code, 'K1⑤：diagValidation 无顶层 code').toBeUndefined();
    expect(records[1]!.issues?.policy).toBe('full');
    expect(records[1]!.issues?.items, 'K1⑤：诊断恰一条 issue 条目').toHaveLength(1);
    expect(records[1]!.issues?.items[0]?.code).toBe(MUTATION_GUARD_MISMATCH);
    expect(records[1]!.issues?.items[0]?.path).toEqual([...GUARD_PATH]);

    await teardown(ctx);
  });

  it('K2 拒绝零写入隔离：同 fixture 再发 stale guard → 字节/事件/notifier 全不变、读值不变（AC2）', async () => {
    const ctx = await setup();
    const updates = collectUpdates(ctx.doc);

    const [r1, r2] = await Promise.all([
      ctx.runtime.mutateData(SINGLE_GUARDED('reviewing', 'open')),
      ctx.runtime.mutateData(SINGLE_GUARDED('blocked', 'open')),
    ]);
    expect(r1).toEqual({ ok: true });
    failureOf(r2);

    const before = bytesOf(ctx.doc);
    const updatesAfterPair = updates.length;
    const notifierAfterPair = ctx.notifierCalls();

    const stale = await ctx.runtime.mutateData(SINGLE_GUARDED('archived', 'open'));
    const failure = failureOf(stale);
    expect(failure.issues, 'K2：恰一条 issue').toHaveLength(1);
    expect(failure.issues[0]!.code).toBe(MUTATION_GUARD_MISMATCH);
    expect(failure.issues[0]!.path).toEqual([...GUARD_PATH]);
    expect(bytesOf(ctx.doc), 'K2：零写入（字节不变）').toEqual(before);
    expect(updates, 'K2：拒绝不得产生 update').toHaveLength(updatesAfterPair);
    expect(ctx.notifierCalls(), 'K2：拒绝不得 dirty 登记').toBe(notifierAfterPair);
    expect(readOk(ctx.runtime, GUARD_PATH), 'K2：后续读取值不变').toBe('reviewing');

    await teardown(ctx);
  });

  it('K3 三写交错：无第三写插入 guard 评估→提交间隙（结果 [ok, ok, 带码拒绝]、终值=中间写）', async () => {
    const ctx = await setup();
    const updates = collectUpdates(ctx.doc);

    const pA = ctx.runtime.mutateData(SINGLE_GUARDED('reviewing', 'open'));
    const pB = ctx.runtime.mutateData({ op: 'set', path: [...GUARD_PATH], value: 'closed' });
    const pC = ctx.runtime.mutateData(SINGLE_GUARDED('archived', 'open'));
    const [rA, rB, rC] = await Promise.all([pA, pB, pC]);

    expect(rA).toEqual({ ok: true });
    expect(rB).toEqual({ ok: true });
    const failure = failureOf(rC);
    expect(failure.issues).toHaveLength(1);
    expect(failure.issues[0]!.code).toBe(MUTATION_GUARD_MISMATCH);
    expect(failure.issues[0]!.path).toEqual([...GUARD_PATH]);
    expect(failure.issues[0]!.message, 'K3：message 含实际值文本').toContain('closed');
    expect(readOk(ctx.runtime, GUARD_PATH), 'K3：终值 = 第二写已提交值').toBe('closed');
    expect(updates, 'K3：两笔成功写恰 2 次 update').toHaveLength(2);
    expect(ctx.notifierCalls(), 'K3：两笔成功写恰 2 次登记').toBe(2);

    await teardown(ctx);
  });

  it('K4 FIFO 槽级证据（seam）：窗口恰 3 个 S 样本、queueDepthAtStart [3,2,1]、序=入队序、无杂槽', async () => {
    const samples: SequencerSlotSample[] = [];
    const ctx = await setup({ samples });
    samples.length = 0; // 只观察三写窗口（P0 启动槽不计；NC6 由 allSlotKinds 兜底）
    const updates = collectUpdates(ctx.doc);

    const pA = ctx.runtime.mutateData(SINGLE_GUARDED('reviewing', 'open'));
    const pB = ctx.runtime.mutateData({ op: 'set', path: [...GUARD_PATH], value: 'closed' });
    const pC = ctx.runtime.mutateData(SINGLE_GUARDED('archived', 'open'));
    const [rA, rB, rC] = await Promise.all([pA, pB, pC]);

    // 业务结果与 K3 同形（槽级证据不改变串行语义观察）
    expect(rA).toEqual({ ok: true });
    expect(rB).toEqual({ ok: true });
    const failure = failureOf(rC);
    expect(failure.issues[0]!.code).toBe(MUTATION_GUARD_MISMATCH);
    expect(readOk(ctx.runtime, GUARD_PATH)).toBe('closed');
    expect(updates).toHaveLength(2);
    expect(ctx.notifierCalls()).toBe(2);

    // 槽级：await Promise.all 返回时样本 sink 已收齐（flush 注册先于调用方 await 恢复）
    expect(samples.map((sample) => sample.slotKind), 'NC6：窗口无 P0/杂槽样本').toEqual(['S', 'S', 'S']);
    const sSlots = samples.filter((sample) => sample.slotKind === 'S');
    expect(sSlots, 'K4：窗口内恰 3 条 S 样本').toHaveLength(3);
    expect(sSlots.map((sample) => sample.queueDepthAtStart), 'K4：深度单调递降 = 严格串行无跳槽').toEqual([3, 2, 1]);
    for (const sample of sSlots) {
      expect(typeof sample.runMs).toBe('number');
      expect(typeof sample.waitMs).toBe('number');
    }

    await teardown(ctx);
  });

  it('K5 批量 {ops,guard} 竞争：胜者批单事务落盘、拒绝批零写入单条 rejected 诊断（AC7/ADR 0026）', async () => {
    const log = createBoundedMemoryDiagnosticLog({ inputPolicy: 'digest', updateCapture: true });
    const ctx = await setup({ log });
    const updates = collectUpdates(ctx.doc);

    const p1 = ctx.runtime.mutateData(BATCH_GUARDED('reviewing'));
    const p2 = ctx.runtime.mutateData(BATCH_GUARDED('blocked'));
    const [r1, r2] = await Promise.all([p1, p2]);

    // ① 先到批成功
    expect(r1).toEqual({ ok: true });
    // ② 后到批：恰 1 issue（guard 先于逐操作 prepare，无聚合）、稳定码、guard 路径
    const failure = failureOf(r2);
    expect(failure.issues, 'K5②：恰一条 issue').toHaveLength(1);
    expect(failure.issues[0]!.code).toBe(MUTATION_GUARD_MISMATCH);
    expect(failure.issues[0]!.message).toMatch(/^MUTATION_GUARD_MISMATCH/);
    expect(failure.issues[0]!.path).toEqual([...GUARD_PATH]);
    // ③ 终态仅含胜者批三项（拒绝批零写入）
    expect(readOk(ctx.runtime, GUARD_PATH)).toBe('reviewing');
    expect(readOk(ctx.runtime, ['n'])).toBe(7);
    expect(readOk(ctx.runtime, ['values'])).toEqual([1, 9, 2, 3]);
    // ④ 单事务：恰 1 次 update 且与 committed 记录载体长度一致
    expect(updates, 'K5④：胜者批单条 update bytes').toHaveLength(1);
    // ⑤ 恰 1 次 dirty 登记
    expect(ctx.notifierCalls()).toBe(1);
    // ⑥ 诊断恰 2 条：1 committed/transaction + 1 rejected/validation（恰 1 issue 条目带码）
    const records = await waitAttempts(log, 2);
    expect(records[0]!.stage).toBe('transaction');
    expect(records[0]!.result).toMatchObject({ kind: 'committed', effect: 'update' });
    expect(payloadLengthOf(records[0]!)).toBe(updates[0]!.length);
    expect(records[1]!.stage).toBe('validation');
    expect(records[1]!.result).toEqual({ kind: 'rejected' });
    expect(records[1]!.code).toBeUndefined();
    expect(records[1]!.issues?.items, 'K5⑥：拒绝批恰 1 issue 条目').toHaveLength(1);
    expect(records[1]!.issues?.items[0]?.code).toBe(MUTATION_GUARD_MISMATCH);

    await teardown(ctx);
  });

  it('K6 批量成功路径单条 update bytes：三项落盘、单事务、载体长度一致（AC7）', async () => {
    const log = createBoundedMemoryDiagnosticLog({ inputPolicy: 'digest', updateCapture: true });
    const ctx = await setup({ log });
    const updates = collectUpdates(ctx.doc);

    const result = await ctx.runtime.mutateData({
      ops: LEGAL_OPS,
      guard: { path: [...GUARD_PATH], equals: 'open' },
    });

    expect(result).toEqual({ ok: true });
    expect(readOk(ctx.runtime, ['tasks', 't1', 'status'])).toBe('reviewing');
    expect(readOk(ctx.runtime, ['tasks', 't1', 'reviewer'])).toBe('u9');
    expect(readOk(ctx.runtime, ['values'])).toEqual([1, 9, 2, 3]);
    expect(updates, 'K6：单事务恰 1 次 update').toHaveLength(1);
    expect(ctx.notifierCalls()).toBe(1);
    const records = await waitAttempts(log, 1);
    expect(records[0]!.stage).toBe('transaction');
    expect(records[0]!.result).toMatchObject({ kind: 'committed', effect: 'update' });
    expect(payloadLengthOf(records[0]!), 'K6：payloadLength === 单条 update 长度').toBe(updates[0]!.length);

    await teardown(ctx);
  });
});

// ── L 组：lifecycle 接纳门次序（AC6；ADR 0008 L99/L125）─────────────────────────────

describe('issue #349 L 组 — lifecycle 接纳门次序（guard 不改变门次序）', () => {
  it('L1 closing 期：close() 同步进 closing，guarded mutateData 经接纳门零写入拒绝', async () => {
    const log = createBoundedMemoryDiagnosticLog({ inputPolicy: 'digest', updateCapture: true });
    const ctx = await setup({ log });
    const before = bytesOf(ctx.doc);
    const updates = collectUpdates(ctx.doc);

    const cp = ctx.runtime.close();
    expect(ctx.runtime.getStatus().lifecycle, 'L1：close() 返回前同步进 closing').toBe('closing');

    const result = await ctx.runtime.mutateData(SINGLE_GUARDED('reviewing', 'open'));
    const failure = failureOf(result);
    expect(failure.issues).toHaveLength(1);
    expect(failure.issues[0]!.message, 'L1：停接纳码族前缀').toMatch(/^RUNTIME_WRITE_DISABLED/);
    expect(failure.issues[0]!.message).toContain('closing');
    expect(bytesOf(ctx.doc), 'L1：零写入').toEqual(before);
    expect(updates).toHaveLength(0);
    expect(ctx.notifierCalls(), 'L1：零 dirty 登记').toBe(0);

    const records = await waitAttempts(log, 1);
    expectAcceptanceRecord(records[0]!);
    expect(
      records.some((record) => record.stage === 'transaction' || record.stage === 'validation'),
      'L1：guard 未被评估（无 validation 记录）、零事务',
    ).toBe(false);

    await cp;
    expect(ctx.runtime.getStatus().lifecycle).toBe('closed');
    await teardown(ctx);
  });

  it('L2 closed 期：await close() 后同一 guarded 信封仍按 RUNTIME_WRITE_DISABLED 拒绝（文案含 closed）', async () => {
    const log = createBoundedMemoryDiagnosticLog({ inputPolicy: 'digest', updateCapture: true });
    const ctx = await setup({ log });
    await ctx.runtime.close();
    expect(ctx.runtime.getStatus().lifecycle).toBe('closed');
    const before = bytesOf(ctx.doc);
    const updates = collectUpdates(ctx.doc);

    const result = await ctx.runtime.mutateData(SINGLE_GUARDED('reviewing', 'open'));
    const failure = failureOf(result);
    expect(failure.issues).toHaveLength(1);
    expect(failure.issues[0]!.message).toMatch(/^RUNTIME_WRITE_DISABLED/);
    expect(failure.issues[0]!.message).toContain('closed');
    expect(bytesOf(ctx.doc)).toEqual(before);
    expect(updates).toHaveLength(0);
    expect(ctx.notifierCalls()).toBe(0);

    const records = await waitAttempts(log, 1);
    expectAcceptanceRecord(records[0]!);
    expect(records.some((record) => record.stage === 'transaction' || record.stage === 'validation')).toBe(false);

    await teardown(ctx);
  });

  it('L3 输入零访问：closing 期 hostile Proxy 输入不抛、访问计数 0，acceptance 记录 not-accessed', async () => {
    const log = createBoundedMemoryDiagnosticLog({ inputPolicy: 'digest', updateCapture: true });
    const ctx = await setup({ log });
    const { proxy, accesses } = hostileInput();
    const before = bytesOf(ctx.doc);
    const updates = collectUpdates(ctx.doc);

    const cp = ctx.runtime.close();
    const result = await ctx.runtime.mutateData(proxy); // 门若在输入读取之后 → Proxy trap 抛/计数 > 0

    const failure = failureOf(result);
    expect(failure.issues).toHaveLength(1);
    expect(failure.issues[0]!.message).toMatch(/^RUNTIME_WRITE_DISABLED/);
    expect(accesses(), 'L3：接纳门先于 guard 解析与输入读取（Proxy 零访问）').toBe(0);
    expect(bytesOf(ctx.doc)).toEqual(before);
    expect(updates).toHaveLength(0);
    expect(ctx.notifierCalls()).toBe(0);

    const records = await waitAttempts(log, 1);
    expectAcceptanceRecord(records[0]!);
    expect(records[0]!.issues?.items[0]?.path).toEqual([]);

    await cp;
    await teardown(ctx);
  });

  it('L4 close 排空窗口：已接纳 guarded 写提交后挂于 S6；closing 新写拒、放行后 ok:true 且终态 closed', async () => {
    const log = createBoundedMemoryDiagnosticLog({ inputPolicy: 'digest', updateCapture: true });
    const gate = deferred();
    const ctx = await setup({ log, notifyGate: gate.promise });
    const updates = collectUpdates(ctx.doc);

    const p = ctx.runtime.mutateData(SINGLE_GUARDED('reviewing', 'open'));
    try {
      // ① 已接纳写已提交（S5 事务结束）但槽挂于 S6：已完成信号未发出、值可读
      await expect.poll(() => ctx.notifierCalls(), { interval: 10, timeout: 5_000 }).toBe(1);
      expect(readOk(ctx.runtime, GUARD_PATH), 'L4①：挂住窗口内已见已提交值').toBe('reviewing');

      // ② closing 期新写走接纳门即时拒绝（不入队、不等待排空）
      const cp = ctx.runtime.close();
      expect(ctx.runtime.getStatus().lifecycle).toBe('closing');
      const blocked = await ctx.runtime.mutateData(SINGLE_GUARDED('archived', 'open'));
      const failure = failureOf(blocked);
      expect(failure.issues[0]!.message, 'L4②：closing 期新写 RUNTIME_WRITE_DISABLED').toMatch(
        /^RUNTIME_WRITE_DISABLED/,
      );

      // ③ 放行门 → 已接纳槽随排空结算 ok:true；④ 终态 closed
      gate.resolve();
      expect(await p, 'L4③：已接纳 guarded 写无条件排空').toEqual({ ok: true });
      await cp;
      expect(ctx.runtime.getStatus().lifecycle, 'L4④').toBe('closed');

      // ⑤ 恰 1 次 update + 恰 1 次 dirty 登记（closing 新写零写入）；release 已发生
      expect(updates, 'L4⑤：仅已接纳写产生一次 update').toHaveLength(1);
      expect(ctx.notifierCalls(), 'L4⑤：closing 新写零登记').toBe(1);
      expect(isReleased(ctx.handle), 'L4：close barrier 已 release handle').toBe(true);

      // ⑥ 记录含 1 条 acceptance 拒绝 + 1 条 transaction committed
      const records = await waitAttempts(log, 2);
      const acceptance = records.filter((record) => record.stage === 'acceptance');
      const committed = records.filter((record) => record.stage === 'transaction');
      expect(acceptance, 'L4⑥：closing 新写恰 1 条 acceptance 拒绝').toHaveLength(1);
      expectAcceptanceRecord(acceptance[0]!);
      expect(committed, 'L4⑥：已接纳写恰 1 条 committed').toHaveLength(1);
      expect(committed[0]!.result).toMatchObject({ kind: 'committed', effect: 'update' });
      expect(payloadLengthOf(committed[0]!)).toBe(updates[0]!.length);
    } finally {
      // R2：门必须放行（恰一次），避免 close Promise 永挂起。
      gate.resolve();
    }

    await teardown(ctx);
  });
});

// ── N 组：非 fatal 与后续写能力（AC5）───────────────────────────────────────────────

describe('issue #349 N 组 — 非 fatal 与后续写能力', () => {
  it('N1 拒绝后能力保留：非 fatal、rootWrite 保持、后续无 guard 写与重读重试均成功（AC5）', async () => {
    const ctx = await setup();
    const probe = collectUnhandledRejections();
    try {
      // ① 先一笔 guard 不满足（K1 的 p2 形态）——拒绝不触发 fatal 通道
      const [r1, r2] = await Promise.all([
        ctx.runtime.mutateData(SINGLE_GUARDED('reviewing', 'open')),
        ctx.runtime.mutateData(SINGLE_GUARDED('blocked', 'open')),
      ]);
      expect(r1).toEqual({ ok: true });
      expect(failureOf(r2).issues[0]!.code).toBe(MUTATION_GUARD_MISMATCH);

      // ② status 观察面：fatal === null、rootWrite.enabled === true
      const afterReject = ctx.runtime.getStatus();
      expect(afterReject.fatal, 'N1②：拒绝不得升级为 fatal').toBeNull();
      expect(afterReject.rootWrite.enabled, 'N1②：写能力保留').toBe(true);

      // ③ 后续无 guard 写照常成功
      expect(await ctx.runtime.mutateData({ op: 'set', path: ['n'], value: 2 })).toEqual({ ok: true });
      expect(readOk(ctx.runtime, ['n'])).toBe(2);

      // ④ 重读旧值后重构造 guard → 成功
      const retry = await ctx.runtime.mutateData(SINGLE_GUARDED('published', 'reviewing'));
      expect(retry).toEqual({ ok: true });
      expect(readOk(ctx.runtime, GUARD_PATH)).toBe('published');
      expect(ctx.runtime.getStatus().fatal).toBeNull();

      // ⑤ 全程无 fatal rejection / 无 unhandled rejection
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
      expect(probe.events, 'N1⑤：零 unhandled rejection').toEqual([]);
    } finally {
      probe.dispose();
      await teardown(ctx);
    }
  });
});

// ── D 组：诊断透传与 emitter 等价（AC3；ADR 0011 L18–27）───────────────────────────

describe('issue #349 D 组 — 诊断透传与 emitter 等价', () => {
  it('D1 装配 emitter：guard 拒绝恰 1 条 rejected/validation 变更尝试（issue 带码、record 无码）', async () => {
    const log = createBoundedMemoryDiagnosticLog({ inputPolicy: 'digest', updateCapture: true });
    const ctx = await setup({ log });
    const before = bytesOf(ctx.doc);
    const updates = collectUpdates(ctx.doc);

    const result = await ctx.runtime.mutateData(SINGLE_GUARDED('reviewing', 'draft'));
    const failure = failureOf(result);
    expect(failure.issues).toHaveLength(1);
    expect(failure.issues[0]!.code).toBe(MUTATION_GUARD_MISMATCH);
    expect(failure.issues[0]!.path).toEqual([...GUARD_PATH]);
    expect(bytesOf(ctx.doc), 'D1③：零写入').toEqual(before);
    expect(updates).toHaveLength(0);
    expect(ctx.notifierCalls()).toBe(0);

    const records = await waitAttempts(log, 1);
    const record = records[0]!;
    expect(record.operation).toBe('root-mutation');
    expect(record.stage).toBe('validation');
    expect(record.result).toEqual({ kind: 'rejected' });
    expect(record.code, 'D1②：diagValidation 无顶层 code').toBeUndefined();
    expect(record.issues?.policy).toBe('full');
    expect(record.issues?.items).toHaveLength(1);
    expect(record.issues?.items[0]?.code).toBe(MUTATION_GUARD_MISMATCH);
    expect(record.issues?.items[0]?.path).toEqual([...GUARD_PATH]);

    await teardown(ctx);
  });

  it('D2 未装配 emitter：同一 mismatch 信封业务结果逐字相等、两侧零写入；成功侧同 ok:true', async () => {
    const log = createBoundedMemoryDiagnosticLog({ inputPolicy: 'digest', updateCapture: true });
    const withLog = await setup({ log });
    const withoutLog = await setup();
    const beforeWith = bytesOf(withLog.doc);
    const beforeWithout = bytesOf(withoutLog.doc);
    const updatesWith = collectUpdates(withLog.doc);
    const updatesWithout = collectUpdates(withoutLog.doc);

    const mismatch = SINGLE_GUARDED('reviewing', 'draft');
    const [rWith, rWithout] = await Promise.all([
      withLog.runtime.mutateData(mismatch),
      withoutLog.runtime.mutateData(mismatch),
    ]);

    // ① 业务结果逐字相等（JSON 深等 + JSON 文本相等）
    failureOf(rWith);
    failureOf(rWithout);
    expect(rWithout).toEqual(rWith);
    expect(JSON.stringify(rWithout)).toBe(JSON.stringify(rWith));
    // ② 两侧零写入：字节不变、0 update、0 notifier、值保持
    expect(bytesOf(withLog.doc)).toEqual(beforeWith);
    expect(bytesOf(withoutLog.doc)).toEqual(beforeWithout);
    expect(updatesWith).toHaveLength(0);
    expect(updatesWithout).toHaveLength(0);
    expect(withLog.notifierCalls()).toBe(0);
    expect(withoutLog.notifierCalls()).toBe(0);
    expect(readOk(withLog.runtime, GUARD_PATH)).toBe('open');
    expect(readOk(withoutLog.runtime, GUARD_PATH)).toBe('open');

    // ③ 成功侧（guard 满足）两侧同为 { ok:true }
    const satisfied = SINGLE_GUARDED('reviewing', 'open');
    const [sWith, sWithout] = await Promise.all([
      withLog.runtime.mutateData(satisfied),
      withoutLog.runtime.mutateData(satisfied),
    ]);
    expect(sWith).toEqual({ ok: true });
    expect(sWithout).toEqual({ ok: true });

    await teardown(withLog);
    await teardown(withoutLog);
  });
});

// ── NC 组：负控锚（HEAD 绿，实现后必须保持）─────────────────────────────────────────

describe('issue #349 NC 组 — 负控锚', () => {
  it('NC1 无 guard 单操作幸福路径：ok:true、值可见、1 update、1 notifier', async () => {
    const ctx = await setup();
    const updates = collectUpdates(ctx.doc);

    const result = await ctx.runtime.mutateData({ op: 'set', path: ['n'], value: 2 });

    expect(result).toEqual({ ok: true });
    expect(readOk(ctx.runtime, ['n'])).toBe(2);
    expect(updates).toHaveLength(1);
    expect(ctx.notifierCalls()).toBe(1);

    await teardown(ctx);
  });

  it('NC2 guard 满足（敏感度锚）：ok:true、值落盘、1 update', async () => {
    const ctx = await setup();
    const updates = collectUpdates(ctx.doc);

    const result = await ctx.runtime.mutateData(SINGLE_GUARDED('reviewing', 'open'));

    expect(result, 'NC2：guard 键本身不得改变幸福路径').toEqual({ ok: true });
    expect(readOk(ctx.runtime, GUARD_PATH)).toBe('reviewing');
    expect(updates).toHaveLength(1);

    await teardown(ctx);
  });

  it('NC3 批量元素携带 guard（形状错误冻结）：ok:false、无码、零写入（ADR 0026 L29）', async () => {
    const ctx = await setup();
    const before = bytesOf(ctx.doc);
    const updates = collectUpdates(ctx.doc);

    const result = await ctx.runtime.mutateData({
      ops: [{ op: 'set', path: ['n'], value: 5252, guard: { path: ['n'], equals: 1 } }],
    });

    const failure = failureOf(result);
    expect(failure.issues[0]?.code, 'NC3：批内元素 guard = 形状错误（无码、不可重试）').toBeUndefined();
    expect(bytesOf(ctx.doc)).toEqual(before);
    expect(updates).toHaveLength(0);
    expect(ctx.notifierCalls()).toBe(0);

    await teardown(ctx);
  });

  it('NC4 guard.equals 非有限数 / undefined 值键：S3 分层先拒（stage=input-snapshot 带顶层码）、零写入', async () => {
    const log = createBoundedMemoryDiagnosticLog({ inputPolicy: 'digest', updateCapture: true });
    const ctx = await setup({ log });
    const before = bytesOf(ctx.doc);
    const updates = collectUpdates(ctx.doc);

    const nanResult = await ctx.runtime.mutateData({
      op: 'set',
      path: ['n'],
      value: 2,
      guard: { path: ['n'], equals: NaN },
    });
    const nanFailure = failureOf(nanResult);
    expect(nanFailure.issues[0]!.message, 'NC4：S3 层非有限数拒绝语义不变').toContain(MUTATION_INPUT_NOT_PLAIN_DATA);
    expect(nanFailure.issues[0]!.code, 'NC4：形状域拒绝不得携带 guard 稳定码').toBeUndefined();

    const undefinedKeyResult = await ctx.runtime.mutateData({
      op: 'set',
      path: ['n'],
      value: 2,
      guard: { path: ['n'], equals: { gone: undefined } },
    });
    const undefinedKeyFailure = failureOf(undefinedKeyResult);
    expect(undefinedKeyFailure.issues[0]!.message, 'NC4：S3 层 undefined 值键拒绝语义不变').toContain(
      MUTATION_INPUT_NOT_PLAIN_DATA,
    );

    expect(bytesOf(ctx.doc), 'NC4：S3 先拒同样零写入').toEqual(before);
    expect(updates).toHaveLength(0);
    expect(ctx.notifierCalls()).toBe(0);

    const records = await waitAttempts(log, 2);
    for (const record of records) {
      expect(record.stage, 'NC4：拒绝发生在槽起点快照阶段').toBe('input-snapshot');
      expect(record.result).toEqual({ kind: 'rejected' });
      expect(record.code, 'NC4：S3 层稳定码在 record 级').toBe(MUTATION_INPUT_NOT_PLAIN_DATA);
      expect(record.issues?.items[0]?.code).toBeUndefined();
    }

    await teardown(ctx);
  });
});
