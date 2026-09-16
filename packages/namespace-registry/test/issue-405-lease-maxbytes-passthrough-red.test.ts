/**
 * issue #405（ADR 0031）registry `lease.readData` 的 `maxBytes` 面 —— lease 透传 + 别名跟随
 * 行为契约（SA6 §12.2/§12.3 G9 行为侧；红灯契约：HEAD 上 lease 与 runtime 同因未知键拒绝）。
 *
 * 契约面：
 * 1. 真实装配（production runtime factory 路径）：lease 预算读与 runtime 直调**逐字段相等**
 *    （收 / 拒两侧同载荷；`measuredBytes` 逐字相同）；
 * 2. active 期 options **原样直传**（raw 引用直传 runtime 接缝；lease 层零解释、零 budget
 *    触达——`maxBytes` 在场亦然）；
 * 3. released 短路先于一切透传（`NAMESPACE_LEASE_RELEASED` 冻结三键；零 runtime 触达）；
 * 4. lifecycle：runtime 关闭后 lease 读同走 `RUNTIME_READ_DISABLED`（lease 零第二解释）；
 * 5. 单参 `lease.readData(path)` 仍走 legacy 通道（末签名锁）。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { DocHandle, DocPersistence, User } from '@nomicore/persistence';
import type {
  NamespaceRuntime,
  NamespaceRuntimeReadDataResult,
  NamespaceRuntimeStatus,
} from '@nomicore/namespace-runtime';
import type { NamespaceLease, NamespaceLeaseReadDataBudgetResult } from '@nomicore/namespace-registry';
import { createNamespaceRegistryForTesting, createRegistryTestScheduler } from '@nomicore/namespace-registry/testing';
import { readDataOk, expectReadDataOkKeys } from '../../namespace-runtime/test/helpers/readdata-ok-shape.js';
import {
  ENV_405,
  anchorById,
  createRuntime405FromHandle,
  seedStrictRoot405,
  waitForSchemaReady405,
} from '../../namespace-runtime/test/issue-405-maxbytes-fixture.js';

// ── 确定性装配（沿 registry-readdata-budget-passthrough 先例：manual clock + test scheduler）──

function manualClock(): { now: () => number } {
  return { now: () => 1_700_000_123_456 };
}

let randomCounter = 0;
function deterministicRandomBytes(length: number): Uint8Array {
  randomCounter += 1;
  const hex = randomCounter.toString(16).padStart(32, '0');
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    out[i] = Number.parseInt(hex.slice((i % 16) * 2, (i % 16) * 2 + 2), 16);
  }
  return out;
}

class StubHandle implements DocHandle {
  readonly doc: Y.Doc;

  constructor(readonly owner: User, readonly docId: string) {
    const doc = new Y.Doc();
    doc.getMap('SCHEMA').set('lang', ENV_405.lang);
    doc.getMap('SCHEMA').set('version', ENV_405.version);
    doc.getMap('SCHEMA').set('id', ENV_405.id);
    doc.getMap('SCHEMA').set('text', ENV_405.text);
    doc.getMap('META').set('docId', docId);
    doc.getMap('META').set('createdAt', 1_700_000_000_000);
    seedStrictRoot405(doc.getMap('ROOT'));
    this.doc = doc;
  }

  getStatus(): 'ready' {
    return 'ready';
  }

  release(): Promise<void> {
    return Promise.resolve();
  }
}

class StubPersistence implements DocPersistence {
  async loadDoc(owner: User, docId: string): Promise<DocHandle | null> {
    return new StubHandle(owner, docId);
  }

  async saveDoc(): Promise<void> {}

  async createDoc(owner: User, docId: string): Promise<DocHandle> {
    return new StubHandle(owner, docId);
  }
}

const READY_STATUS: NamespaceRuntimeStatus = {
  lifecycle: 'ready',
  read: { enabled: true },
  rootWrite: { enabled: true },
  schemaWrite: { enabled: true },
  schema: { state: 'ready' },
  fatal: null,
  close: null,
  replication: { state: 'disabled' },
};

interface ReadCall {
  readonly path: unknown;
  readonly options: unknown;
  readonly argc: number;
}

/** 记录型 fake runtime：捕获 readData 实参（引用同一性锚）+ 固定成功面。 */
function makeRecordingRuntime(): {
  readonly runtime: NamespaceRuntime;
  readonly calls: ReadCall[];
  readonly result: NamespaceRuntimeReadDataResult;
} {
  const calls: ReadCall[] = [];
  const result: NamespaceRuntimeReadDataResult = readDataOk('runtime-value', null);
  const runtime: NamespaceRuntime = {
    owner: { userId: 'runtime-owner' },
    namespaceId: 'runtime-ns',
    readData: (...args: unknown[]): NamespaceRuntimeReadDataResult => {
      calls.push({ path: args[0], options: args[1], argc: args.length });
      return result;
    },
    readArray: () => ({ ok: false, code: 'PATH_NOT_ALLOWED', path: [], message: 'stub: 窗口读未接线' }),
    readMap: () => ({ ok: false, code: 'PATH_NOT_ALLOWED', path: [], message: 'stub: 窗口读未接线' }),
    watchMap: () => {
      throw new Error('stub: watch 订阅未接线');
    },
    getSchema: () => null,
    getMetadata: () => ({ marker: 'meta' }),
    getActiveSchema: () => null,
    getStatus: () => READY_STATUS,
    mutateData: async () => ({ ok: true }),
    replaceSchema: async () => ({ ok: true }),
    enableReplication: async () => ({ ok: true }),
    bumpReplicationEpoch: async () => ({ ok: true }),
    close: async () => {},
  };
  return { runtime, calls, result };
}

async function openLease(runtimeFactory?: (handle: DocHandle) => NamespaceRuntime): Promise<NamespaceLease> {
  const registry = createNamespaceRegistryForTesting(new StubPersistence(), {
    clock: manualClock(),
    scheduler: createRegistryTestScheduler(),
    randomBytes: deterministicRandomBytes,
    ...(runtimeFactory !== undefined ? { runtimeFactory } : {}),
  });
  const opened = await registry.open({ userId: 'u-405' }, ENV_405.id);
  expect(opened.ok, `open 应成功：${JSON.stringify(opened)}`).toBe(true);
  if (!opened.ok) throw new Error('unreachable');
  return opened.lease;
}

describe('G9 行为：lease.readData 携 maxBytes ≡ runtime 直调（真实装配）', () => {
  it('G9 收侧：lease ≡ runtime 逐字段相等（总量 ≤ 预算）+ 恒四键', async () => {
    const r0 = anchorById('R0');
    let realRuntime: NamespaceRuntime | undefined;
    const lease = await openLease((handle) => {
      realRuntime = createRuntime405FromHandle(handle);
      return realRuntime;
    });
    if (realRuntime === undefined) throw new Error('契约前提失败：runtimeFactory 未被调用');
    await waitForSchemaReady405(realRuntime);

    const viaLease = lease.readData([], { maxBytes: r0.total }) as NamespaceLeaseReadDataBudgetResult;
    const direct = realRuntime.readData([], { maxBytes: r0.total });
    expect(viaLease, 'G9/收侧：lease 结果 ≡ runtime 直调').toStrictEqual(direct);
    expectReadDataOkKeys(viaLease);
    if (!viaLease.ok) throw new Error(`G9/收侧：契约前提失败（${JSON.stringify(viaLease)}）`);
    expect(viaLease.schema).not.toBeNull();
    await lease.release();
  });

  it('G9 拒侧：lease ≡ runtime 同载荷（READ_BUDGET_EXCEEDED + measuredBytes 逐字相同）', async () => {
    const r0 = anchorById('R0');
    let realRuntime: NamespaceRuntime | undefined;
    const lease = await openLease((handle) => {
      realRuntime = createRuntime405FromHandle(handle);
      return realRuntime;
    });
    if (realRuntime === undefined) throw new Error('契约前提失败：runtimeFactory 未被调用');
    await waitForSchemaReady405(realRuntime);

    const viaLease = lease.readData([], { maxBytes: r0.total - 1 }) as NamespaceLeaseReadDataBudgetResult;
    const direct = realRuntime.readData([], { maxBytes: r0.total - 1 });
    expect(viaLease, 'G9/拒侧：lease 结果 ≡ runtime 直调（同载荷）').toStrictEqual(direct);
    if (viaLease.ok) throw new Error(`G9/拒侧：契约前提失败（期望 READ_BUDGET_EXCEEDED，实际 ${JSON.stringify(viaLease)}）`);
    expect(viaLease.code).toBe('READ_BUDGET_EXCEEDED');
    expect((viaLease as { measuredBytes: number }).measuredBytes).toBe(r0.total);
    await lease.release();
  });

  it('G9 原样透传：lease 层零解释（含 maxBytes 的 options 走到 runtime 的是同一引用）', async () => {
    const recording = makeRecordingRuntime();
    const lease = await openLease(() => recording.runtime);
    const path = ['meta'];
    const options = { depth: 1, maxBytes: 143 };
    const r = lease.readData(path, options);
    expect(r).toBe(recording.result);
    expect(recording.calls).toHaveLength(1);
    expect(recording.calls[0]!.argc).toBe(2);
    expect(recording.calls[0]!.path).toBe(path);
    expect(recording.calls[0]!.options, 'G9：lease 层零复制/零预算解释（同一引用）').toBe(options);
    await lease.release();
  });

  it('G9 released 短路先于一切透传：带 maxBytes 调用同样返回冻结 released issue（三键、零 runtime 触达）', async () => {
    const recording = makeRecordingRuntime();
    const lease = await openLease(() => recording.runtime);
    await lease.release();
    const r = lease.readData(['meta'], { maxBytes: 1 });
    expect(r.ok).toBe(false);
    expect((r as { code: string }).code).toBe('NAMESPACE_LEASE_RELEASED');
    expect(Object.keys(r).sort()).toStrictEqual(['code', 'message', 'ok']);
    expect(recording.calls).toHaveLength(0);
    await lease.release();
  });

  it('G9 lifecycle：runtime 关闭后 lease 预算读同走 RUNTIME_READ_DISABLED（lease 零第二解释）', async () => {
    let realRuntime: NamespaceRuntime | undefined;
    const lease = await openLease((handle) => {
      realRuntime = createRuntime405FromHandle(handle);
      return realRuntime;
    });
    if (realRuntime === undefined) throw new Error('契约前提失败：runtimeFactory 未被调用');
    await waitForSchemaReady405(realRuntime);
    await realRuntime.close();
    const viaLease = lease.readData([], { maxBytes: 1 });
    const direct = realRuntime.readData([], { maxBytes: 1 });
    expect(viaLease).toStrictEqual(direct);
    expect(viaLease.ok).toBe(false);
    expect((viaLease as { code: string }).code).toBe('RUNTIME_READ_DISABLED');
    await lease.release();
  });

  it('G9 legacy 通道：单参 lease.readData(path) 仍恒四键（末签名锁）', async () => {
    let realRuntime: NamespaceRuntime | undefined;
    const lease = await openLease((handle) => {
      realRuntime = createRuntime405FromHandle(handle);
      return realRuntime;
    });
    if (realRuntime === undefined) throw new Error('契约前提失败：runtimeFactory 未被调用');
    await waitForSchemaReady405(realRuntime);
    const legacy = lease.readData(['title']);
    expectReadDataOkKeys(legacy);
    expect(legacy).toStrictEqual(realRuntime.readData(['title']));
    await lease.release();
  });
});
