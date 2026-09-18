/**
 * issue #406（ADR 0031 窗口面同轴）registry lease 面契约 fixture（**非测试文件**，vitest
 * 不收集；沿 `issue-383-filtered-window-fixture.ts` 双面装配先例）。
 *
 * 同 doc 双面装配：**同一 Y.Doc** 上分别以两个独立 stub handle 构造直调 runtime 与 registry
 * lease —— 「lease 结果 ≡ 同 doc 直调 runtime 结果」对比锚的前提（本文件住 registry 包，
 * 因 runtime 包不依赖 registry，依赖方向不可倒置）。
 */
import * as Y from 'yjs';
import type { DocHandle, DocPersistence, User } from '@nomicore/persistence';
import type { NamespaceRuntime } from '@nomicore/namespace-runtime';
import type { NamespaceLease } from '@nomicore/namespace-registry';
import { createNamespaceRegistryForTesting, createRegistryTestScheduler } from '@nomicore/namespace-registry/testing';
import {
  buildWindow406Doc,
  createWindow406RuntimeFromHandle,
  waitForWindow406SchemaReady,
  WINDOW406_DOC_ID,
  WINDOW406_OWNER,
} from '../../namespace-runtime/test/issue-406-window-maxbytes-fixture.js';

/** 确定性 DocHandle 投影（getStatus ready；release 恒 resolve）。 */
class Window406StubHandle implements DocHandle {
  constructor(
    readonly owner: User,
    readonly docId: string,
    readonly doc: Y.Doc,
  ) {}

  getStatus(): 'ready' {
    return 'ready';
  }

  release(): Promise<void> {
    return Promise.resolve();
  }
}

class Window406StubPersistence implements DocPersistence {
  constructor(private readonly handle: DocHandle) {}

  async createDoc(): Promise<DocHandle> {
    return this.handle;
  }

  async loadDoc(): Promise<DocHandle | null> {
    return this.handle;
  }

  async saveDoc(): Promise<void> {}
}

export interface Window406PairFixture {
  readonly runtime: NamespaceRuntime;
  readonly lease: NamespaceLease;
  readonly doc: Y.Doc;
  readonly registry: ReturnType<typeof createNamespaceRegistryForTesting>;
}

let randomCounter406 = 0;
function deterministicRandomBytes406(length: number): Uint8Array {
  randomCounter406 += 1;
  const hex = randomCounter406.toString(16).padStart(32, '0');
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    out[i] = Number.parseInt(hex.slice((i % 16) * 2, (i % 16) * 2 + 2), 16);
  }
  return out;
}

/** 同 doc 双面装配（生产 runtimeFactory 路径；stub handle 承载预建 doc）。 */
export async function makeWindow406Pair(): Promise<Window406PairFixture> {
  const doc = buildWindow406Doc();
  const runtime = createWindow406RuntimeFromHandle(
    new Window406StubHandle(WINDOW406_OWNER, WINDOW406_DOC_ID, doc),
  );
  const registry = createNamespaceRegistryForTesting(
    new Window406StubPersistence(new Window406StubHandle(WINDOW406_OWNER, WINDOW406_DOC_ID, doc)),
    {
      clock: { now: () => 1_700_000_123_456 },
      scheduler: createRegistryTestScheduler(),
      randomBytes: deterministicRandomBytes406,
    },
  );
  const opened = await registry.open({ userId: WINDOW406_OWNER.userId }, WINDOW406_DOC_ID);
  if (!opened.ok) {
    throw new Error(`契约前提失败：registry.open 应成功（${JSON.stringify(opened)}）`);
  }
  await waitForWindow406SchemaReady(runtime);
  for (let i = 0; i < 500; i += 1) {
    const status = opened.lease.getStatus();
    if (status.lease === 'active' && status.runtime.schema.state === 'ready') break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return { runtime, lease: opened.lease, doc, registry };
}
