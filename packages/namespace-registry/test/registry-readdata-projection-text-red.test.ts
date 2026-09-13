/**
 * issue #364（ADR-0027 决策 1/2/4）registry lease/生产装配面红灯契约 —— readData 投影
 * 文本化（SA6 附录 C：CT-1/CT-4/CT-6 的 lease 与真实装配面）。
 *
 * 契约来源：`wiki/raw/task_issue-364_sa6_contract.md` CT-1 A5/A6、CT-4 D1/D2/D4、
 * CT-6 F4；SA1 设计 §8.3 R4（lease 透传零语义变化、别名跟随）。
 *
 * 红灯机理（HEAD `f8a06fe`）：真实装配（production factory 路径）的 lease 成功读仍是
 * 恒五键 + JSON 四件套投影体（`truncations` 键在场）——本文件 A'/B' 的恰四键与
 * 投影文本断言红；released 短路与透传引用锚在旧实现下也绿（负控，不得被本票破坏）。
 *
 * 断言纪律：只观察公共接缝（lease/runtime 结果）；装置前提失败 fail loud。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { DocHandle, DocPersistence, User } from '@nomicore/persistence';
import type { NamespaceRuntime, NamespaceRuntimeReadDataResult } from '@nomicore/namespace-runtime';
import type { NamespaceLease, NamespaceLeaseReadDataBudgetResult } from '@nomicore/namespace-registry';
import { createNamespaceRegistryForTesting, createRegistryTestScheduler } from '@nomicore/namespace-registry/testing';
import { expectReadDataOkKeys, readDataOk } from '../../namespace-runtime/test/helpers/readdata-ok-shape.js';
import {
  TXT_336,
  createBudgetRuntimeFromHandle,
  seedStrictRoot,
  waitForSchemaReady,
} from '../../namespace-runtime/test/runtime-readdata-shape-budget-fixture.js';

// ── 确定性装配（沿既有 passthrough 测试先例）──

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
    doc.getMap('SCHEMA').set('lang', 'vfsl');
    doc.getMap('SCHEMA').set('version', 1);
    doc.getMap('SCHEMA').set('id', 'ns-336');
    doc.getMap('SCHEMA').set('text', TXT_336);
    doc.getMap('META').set('docId', docId);
    doc.getMap('META').set('createdAt', 1_700_000_000_000);
    seedStrictRoot(doc.getMap('ROOT'));
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

async function openLease(runtimeFactory?: (handle: DocHandle) => NamespaceRuntime): Promise<NamespaceLease> {
  const registry = createNamespaceRegistryForTesting(new StubPersistence(), {
    clock: manualClock(),
    scheduler: createRegistryTestScheduler(),
    randomBytes: deterministicRandomBytes,
    ...(runtimeFactory !== undefined ? { runtimeFactory } : {}),
  });
  const opened = await registry.open({ userId: 'u-336' }, 'ns-336');
  expect(opened.ok, `open 应成功：${JSON.stringify(opened)}`).toBe(true);
  if (!opened.ok) throw new Error('unreachable');
  return opened.lease;
}

/** 记录型 fake runtime：捕获 readData 实参（引用同一性锚）+ 固定四键返回面。 */
function makeRecordingRuntime(): {
  readonly runtime: NamespaceRuntime;
  readonly calls: ReadonlyArray<{ readonly path: unknown; readonly options: unknown; readonly argc: number }>;
  readonly result: NamespaceRuntimeReadDataResult;
} {
  const calls: Array<{ path: unknown; options: unknown; argc: number }> = [];
  const result: NamespaceRuntimeReadDataResult = readDataOk('runtime-value', null);
  const runtime: NamespaceRuntime = {
    owner: { userId: 'runtime-owner' },
    namespaceId: 'runtime-ns',
    readData: (...args: unknown[]): NamespaceRuntimeReadDataResult => {
      calls.push({ path: args[0], options: args[1], argc: args.length });
      return result;
    },
    getSchema: () => null,
    getMetadata: () => ({ marker: 'meta' }),
    getActiveSchema: () => null,
    getStatus: () => ({
      lifecycle: 'ready',
      read: { enabled: true },
      rootWrite: { enabled: true },
      schemaWrite: { enabled: true },
      schema: { state: 'ready' },
      fatal: null,
      close: null,
      replication: { state: 'disabled' },
    }),
    mutateData: async () => ({ ok: true }),
    replaceSchema: async () => ({ ok: true }),
    enableReplication: async () => ({ ok: true }),
    bumpReplicationEpoch: async () => ({ ok: true }),
    close: async () => {},
  };
  return { runtime, calls, result };
}

const TRUNCATION_SECTION = '✂ 截断事实：';

function headBlock(text: string): string {
  const index = text.indexOf('\n\n');
  if (index < 0) throw new Error('契约前提失败：投影文本缺头行分隔');
  return text.slice(0, index);
}

// ═════════════════════════════ A'：lease 恒四键 / 投影文本（CT-1/CT-4） ═════════════════════════════

describe('A′ 真实装配：lease 成功读恒四键 + schema 为投影文本（CT-1 A6 / CT-4）', () => {
  it('A′1 无预算 lease 读：恰四键、schema 为 string、truncations 不在场、头行反映实参 path', async () => {
    let realRuntime: NamespaceRuntime | undefined;
    const lease = await openLease((handle) => {
      realRuntime = createBudgetRuntimeFromHandle(handle);
      return realRuntime;
    });
    if (realRuntime === undefined) throw new Error('契约前提失败：runtimeFactory 未被调用');
    await waitForSchemaReady(realRuntime);

    const viaLease = lease.readData(['meta']);
    expectReadDataOkKeys(viaLease);
    expect('truncations' in viaLease).toBe(false);
    expect(JSON.stringify(viaLease)).not.toContain('"truncations"');
    if (!viaLease.ok) throw new Error(`契约前提失败：${JSON.stringify(viaLease)}`);
    expect(typeof viaLease.schema).toBe('string');
    expect(headBlock(viaLease.schema!)).toBe('# readData [meta]');
    expect(viaLease.truncated).toBe(false);
    // lease ≡ runtime 逐字段（含文本逐字节）
    const direct = realRuntime.readData(['meta']);
    expect(viaLease).toStrictEqual(direct);
    await lease.release();
  });

  it('A′2 预算 lease 读：恰四键、truncated=true、✂ 段在场（截断事实唯一载体）、头行含预算段', async () => {
    let realRuntime: NamespaceRuntime | undefined;
    const lease = await openLease((handle) => {
      realRuntime = createBudgetRuntimeFromHandle(handle);
      return realRuntime;
    });
    if (realRuntime === undefined) throw new Error('契约前提失败：runtimeFactory 未被调用');
    await waitForSchemaReady(realRuntime);

    const viaLease = lease.readData([], { depth: 1 }) as NamespaceLeaseReadDataBudgetResult;
    expectReadDataOkKeys(viaLease);
    if (!viaLease.ok) throw new Error(`契约前提失败：${JSON.stringify(viaLease)}`);
    expect(typeof viaLease.schema).toBe('string');
    expect(headBlock(viaLease.schema!)).toBe('# readData [] {depth:1}');
    expect(viaLease.truncated).toBe(true);
    expect(viaLease.schema!.includes(TRUNCATION_SECTION)).toBe(true);
    const direct = realRuntime.readData([], { depth: 1 }) as NamespaceLeaseReadDataBudgetResult;
    expect(viaLease).toStrictEqual(direct);
    await lease.release();
  });

  it('A′3 width-only lease 读：truncated=true、✂ 段在场、正文无 ‡（预算段事实 + 投影无操作对偶）', async () => {
    let realRuntime: NamespaceRuntime | undefined;
    const lease = await openLease((handle) => {
      realRuntime = createBudgetRuntimeFromHandle(handle);
      return realRuntime;
    });
    if (realRuntime === undefined) throw new Error('契约前提失败：runtimeFactory 未被调用');
    await waitForSchemaReady(realRuntime);

    const viaLease = lease.readData(['tags'], { maxChildrenPerNode: 3 });
    if (!viaLease.ok) throw new Error(`契约前提失败：${JSON.stringify(viaLease)}`);
    expect(viaLease.truncated).toBe(true);
    expect(viaLease.schema!.includes(TRUNCATION_SECTION)).toBe(true);
    const index = viaLease.schema!.indexOf('\n\n');
    expect(viaLease.schema!.slice(index + 2).includes('‡')).toBe(false);
    expect(headBlock(viaLease.schema!)).toBe('# readData [tags] {maxChildrenPerNode:3}');
    await lease.release();
  });

  it('A′4 lease schema:null 单义（路径偏离）：严格 null、ok 恒真、value 照常', async () => {
    let realRuntime: NamespaceRuntime | undefined;
    const lease = await openLease((handle) => {
      realRuntime = createBudgetRuntimeFromHandle(handle);
      return realRuntime;
    });
    if (realRuntime === undefined) throw new Error('契约前提失败：runtimeFactory 未被调用');
    await waitForSchemaReady(realRuntime);

    const viaLease = lease.readData(['rogue']);
    expect(viaLease.ok).toBe(true);
    if (!viaLease.ok) throw new Error('unreachable');
    expect(viaLease.schema).toBeNull();
    expect(viaLease.schema).not.toBe('');
    await lease.release();
  });
});

// ═════════════════════════════ B'：released 短路与透传零语义变化（CT-1 A5 / CT-6 F4） ═════════════════════════════

describe('B′ released 短路先于一切透传 + options 引用直传（CT-1 A5 / CT-6 F4，零语义变化）', () => {
  it('B′1 released 带 options 调用：冻结 released issue 恰 {ok,code,message}，零 runtime 触达、同参稳定单例', async () => {
    const recording = makeRecordingRuntime();
    const lease = await openLease(() => recording.runtime);
    await lease.release();
    const r = lease.readData(['meta'], { depth: 1 });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('B′1：released 必须拒绝');
    expect(r.code).toBe('NAMESPACE_LEASE_RELEASED');
    expect(Object.keys(r).sort()).toStrictEqual(['code', 'message', 'ok']);
    expect(recording.calls).toHaveLength(0);
    const again = lease.readData(['meta'], { depth: 1 });
    expect(again).toBe(r);
  });

  it('B′2 active 期 raw options 同一引用抵达 runtime（零复制/零校验/零触达）；单参调用走 legacy 通道', async () => {
    const recording = makeRecordingRuntime();
    const lease = await openLease(() => recording.runtime);
    const path = ['meta'];
    const opts = { depth: 1 };
    const r = lease.readData(path, opts);
    expect(r).toBe(recording.result);
    expect(recording.calls).toHaveLength(1);
    expect(recording.calls[0]!.path).toBe(path);
    expect(recording.calls[0]!.options).toBe(opts);
    expect(recording.calls[0]!.argc).toBe(2);
    lease.readData(['meta']);
    expect(recording.calls[1]!.argc).toBe(1);
    expect(recording.calls[1]!.options).toBeUndefined();
    let trapCalls = 0;
    const hostile = new Proxy(
      { depth: 1 },
      {
        get(target, key, receiver) {
          trapCalls += 1;
          return Reflect.get(target, key, receiver);
        },
      },
    );
    lease.readData(['meta'], hostile);
    expect(trapCalls).toBe(0);
    expect(recording.calls[2]!.options).toBe(hostile);
    await lease.release();
  });
});
