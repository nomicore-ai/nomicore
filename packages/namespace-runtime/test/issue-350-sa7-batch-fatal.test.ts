/**
 * SA7 动态验证补充测试 — issue #350（批量信封真实偏离 fatal 的端到端生命周期）。
 *
 * 来源：SA4 实现审查 §11 后续动态验证项 2 的端到端半边
 * （`wiki/raw/task_issue-350_sa4_review.md`）；ADR 0008 L85–93 / 设计 §7.6：
 * 批量逐操作验证的真实提交后偏离（E201-C）经写槽既有 fatal 通道 → `markWriteFatal`
 * 永久禁写（后续 `mutateData` 经 S1 fatal gate 结算 `RUNTIME_WRITE_DISABLED`）而
 * **读取保留**；doc 保持 observer 留下的实际状态（不回滚、不补偿）。
 *
 * namespace-runtime src 零改动（SA8 冻结面）——本用例证明批量 throw 自然流入既有
 * D5 fatal 分类（branded committed/phase 透传）与 fatal 后果链，无第二通道。
 *
 * 确定性触发：`afterTransaction` observer 在批量提交事务 cleanup 窗口覆写已安装边界值
 * （与 doc-runtime 侧 `issue-350-sa7-batch-divergence.test.ts` 同款机制）。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { DocHandle, User } from '@nomicore/persistence';
import { createMemoryPersistence } from '@nomicore/persistence';
import { realPersistenceScheduler } from './real-persistence-scheduler.js';
import { createNamespaceRuntimeWithSeam } from '../src/runtime.js';
import { RuntimeWriteFatalError } from '../src/index.js';
import type { NamespaceRuntime } from '../src/index.js';

// ── fixture（与 issue-350-batch-shared-boundary.test.ts 同款 harness，最小裁剪）──────

const OWNER: User = { userId: 'u-alice' };
const TEXT = `type ROOT = {
  n: number;
  a: string;
  tasks: Record<string, { status: string; reviewer?: string; notes: YArray<string> }>;
  values: YArray<number>;
};`;

function makeDoc(): Y.Doc {
  const doc = new Y.Doc();
  const schema = doc.getMap('SCHEMA');
  for (const [key, value] of Object.entries({ lang: 'vfsl', version: 1, id: 'ns-1', text: TEXT })) {
    schema.set(key, value);
  }
  const meta = doc.getMap('META');
  meta.set('docId', 'ns-1');
  meta.set('createdAt', 1_700_000_000_000);
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

async function setup(): Promise<Ctx> {
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
  const runtime = createNamespaceRuntimeWithSeam({
    handle,
    notifyDirty: async () => {
      notifierCalls += 1;
      await writer.saveDoc(handle);
    },
  } as never) as unknown as NamespaceRuntime;
  await expect.poll(() => runtime.getStatus().schema.state, { interval: 10, timeout: 5_000 }).toBe('ready');
  return { runtime, handle, writer, doc: handle.doc, notifierCalls: () => notifierCalls };
}

// ── NF-1：批量真实偏离 → RuntimeWriteFatalError → 永久禁写 / 读保留 ───────────────

describe('SA7 NF-1 — 批量真实偏离经公共面：E201-C throw → RuntimeWriteFatalError（committed:true）→ 永久禁写、读保留', () => {
  it('observer 覆写已安装边界 → rejection（phase=post-commit-verification）→ 后续 mutateData RUNTIME_WRITE_DISABLED 而 readData 照常', async () => {
    const { runtime, handle, writer, doc, notifierCalls } = await setup();

    // 确定性真实偏离：批量提交事务 cleanup 窗口内覆写 t1.status（one-shot）
    let tampered = false;
    doc.on('afterTransaction', (transaction: Y.Transaction) => {
      if (!transaction.local || tampered) return;
      tampered = true;
      ((doc.getMap('ROOT').get('tasks') as Y.Map<unknown>).get('t1') as Y.Map<unknown>).set('status', 'tampered');
    });

    const rejection = await runtime.mutateData({
      ops: [
        { op: 'delete', path: ['tasks', 't1', 'reviewer'] },
        { op: 'set', path: ['tasks', 't1', 'status'], value: 'reviewing' },
      ],
    }).then(
      () => undefined,
      (err: unknown) => err,
    );

    // 写槽唯一 fatal 通道：RuntimeWriteFatalError rejection（不出 ok:false 后门）
    expect(rejection).toBeInstanceOf(RuntimeWriteFatalError);
    const fatal = rejection as RuntimeWriteFatalError;
    expect(fatal.phase).toBe('post-commit-verification'); // doc-runtime branded phase 透传
    expect(fatal.committed).toBe(true);
    expect(fatal.message).toContain('NSRT-WRITE-FATAL');
    expect(fatal.message).toContain('phase=post-commit-verification');
    expect(fatal.message).toContain('committed=true');

    // markWriteFatal 已置位：后续写经 S1 fatal gate 结算 disabled（零输入访问面）
    const after = await runtime.mutateData({ op: 'set', path: ['n'], value: 9 });
    expect(after.ok).toBe(false);
    if (!after.ok) {
      expect(JSON.stringify(after.issues)).toContain('RUNTIME_WRITE_DISABLED');
    }

    // 读取保留：readData 照常观察 live Y.Doc（含批量提交 + observer 留下的实际状态）
    const readStatus = runtime.readData(['tasks', 't1', 'status']);
    expect(readStatus.ok).toBe(true);
    if (readStatus.ok) expect(readStatus.value).toBe('tampered');
    const readReviewer = runtime.readData(['tasks', 't1', 'reviewer']);
    expect(readReviewer.ok).toBe(true);
    if (readReviewer.ok) expect(readReviewer.value).toBeUndefined(); // delete 足迹未被虚假回滚

    // committed:true → 槽内 best-effort dirty 登记恰一次（fatal 前 batch 一次；fatal 后
    // 后续写经 gate 拒绝、不再触 notifier）
    expect(notifierCalls()).toBe(1);

    await handle.release();
    await writer.dispose();
  });
});
