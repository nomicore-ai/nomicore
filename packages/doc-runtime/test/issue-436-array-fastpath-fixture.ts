/**
 * issue #436 SA6 契约夹具（contract + control 两个测试文件共用；非测试入口——
 * 文件名不匹配 vitest include 的 `*.test.ts`，仅为可类型检查的共享模块）。
 *
 * 全部证据经公共入口观察运行时行为：applyValidatedMutation 的判别联合结果 / throw 的
 * branded fatal 事实 / live Y.Array 的元素读计数 / Yjs update 事件与状态字节 /
 * readLogicalValueAtPath 的逻辑值。无源码字符串断言、无 skip/only/todo、无 env override。
 *
 * 夹具纪律：
 * - 确定性：mulberry32 等随机源零使用；`clientID` 显式固定时才传入（字节比较用例）；
 * - 污染注入走 raw Yjs（等价 trusted raw replication 写入），不经 schema 校验路径；
 * - 全程零真实时钟（除诊断探针的软证据，不进契约）、零网络、零并发。
 */
import * as Y from 'yjs';
import { evaluate, parseVfsl } from '@nomicore/vfsl';
import type { DerivedSchema } from '@nomicore/vfsl';
import { DocRuntimeFatalError, applyValidatedMutation, materializeRoot, readLogicalValueAtPath } from '../src/index.js';
import type { ApplyValidatedMutationResult, MutationEnvelope } from '../src/index.js';

/** 契约 schema：非 union 数组（items/rows）、union 数组目标（uarr: A[] | B[]）、
 *  union 穿越的成员内数组（umem.items，plan.kind=union）。 */
export const TEXT = `type ROOT = {
  n: number;
  items: YArray<number>;
  rows: YArray<{ qty: number; tag: string }>;
  uarr: YArray<number> | YArray<string>;
  umem: { items: YArray<number> } | { items: YArray<string> };
};`;

function derivedOf(text: string): DerivedSchema {
  const parsed = parseVfsl(text);
  if (!parsed.ok) throw new Error(`夹具 schema 解析失败：${JSON.stringify(parsed.issues)}`);
  const evaluated = evaluate(parsed.module);
  if (!evaluated.ok) throw new Error(`夹具 schema 求值失败：${JSON.stringify(evaluated.issues)}`);
  return evaluated.derived;
}

export const DERIVED: DerivedSchema = derivedOf(TEXT);

export interface Fx {
  readonly doc: Y.Doc;
  readonly root: Y.Map<unknown>;
  readonly items: Y.Array<number>;
  readonly rows: Y.Array<Y.Map<unknown>>;
  readonly uarr: Y.Array<unknown>;
  readonly umemItems: Y.Array<unknown>;
}

export interface FixtureOptions {
  /** 显式固定 clientID（仅字节 oracle 用例；默认随机，避免跨用例耦合）。 */
  readonly clientID?: number;
  /** items 初始长度（默认 5，内容 = 1..n）。 */
  readonly n?: number;
}

export function fixture(options: FixtureOptions = {}): Fx {
  const n = options.n ?? 5;
  const doc = new Y.Doc();
  if (options.clientID !== undefined) doc.clientID = options.clientID;
  const materialized = materializeRoot(
    DERIVED,
    {
      n: 1,
      items: Array.from({ length: n }, (_, i) => i + 1),
      rows: [
        { qty: 1, tag: 'a' },
        { qty: 2, tag: 'b' },
        { qty: 3, tag: 'c' },
      ],
      uarr: [1, 2, 3],
      umem: { items: [1, 2, 3] },
    },
    doc,
  );
  if (!materialized.ok) throw new Error(`夹具物化失败：${JSON.stringify(materialized.issues)}`);
  const root = doc.getMap('ROOT');
  return {
    doc,
    root,
    items: root.get('items') as Y.Array<number>,
    rows: root.get('rows') as Y.Array<Y.Map<unknown>>,
    uarr: root.get('uarr') as Y.Array<unknown>,
    umemItems: (root.get('umem') as Y.Map<unknown>).get('items') as Y.Array<unknown>,
  };
}

export function run(fx: Fx, mutation: unknown): ApplyValidatedMutationResult {
  return applyValidatedMutation(DERIVED, fx.doc, mutation as MutationEnvelope);
}

/** 捕获 throw（返回 undefined 表示未抛）。 */
export function capture(fn: () => unknown): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  return undefined;
}

/** 在提交事务的 afterTransaction cleanup 窗口内一次性篡改（与 issue #350 SA7 同款机制；
 *  yjs 事件先于 verifyBoundaryIntact 派发 ⇒ 篡改对 S9 可见）。 */
export function tamperOnNextLocalCommit(doc: Y.Doc, tamper: () => void): void {
  let done = false;
  doc.on('afterTransaction', (transaction: Y.Transaction) => {
    if (!transaction.local || done) return;
    done = true;
    tamper();
  });
}

/** live 元素读计数（实例级 `get`/`toArray`/`forEach` 覆盖，仅覆盖该 Y.Array 实例；
 *  调用窗口内计数，窗口外恢复原型方法）。读计数 = 「整数组提取 / 重投影」的结构性成本
 *  代理：逐元素 `get(i)` 计 1；整数组批量出口 `toArray()`/`forEach()` 按其元素数计
 *  （防「换用批量出口的整数组提取」逃逸计数）。O(n) ⇒ 计数 ∝ n；O(k) ⇒ 计数与 n 解耦。 */
export function countElementReads<TA, T>(arr: Y.Array<TA>, fn: () => T): { result: T; reads: number } {
  let reads = 0;
  const originalGet = arr.get.bind(arr) as (index: number) => unknown;
  const originalToArray = arr.toArray.bind(arr) as () => unknown[];
  const originalForEach = arr.forEach.bind(arr) as (f: (value: unknown, index: number, array: unknown) => void) => void;
  const target = arr as unknown as {
    get?: (index: number) => unknown;
    toArray?: () => unknown[];
    forEach?: (f: (value: unknown, index: number, array: unknown) => void) => void;
  };
  target.get = (index: number) => {
    reads += 1;
    return originalGet(index);
  };
  target.toArray = () => {
    reads += arr.length;
    return originalToArray();
  };
  target.forEach = (f: (value: unknown, index: number, array: unknown) => void) => {
    reads += arr.length;
    originalForEach(f);
  };
  try {
    return { result: fn(), reads };
  } finally {
    delete target.get;
    delete target.toArray;
    delete target.forEach;
  }
}

export function logicalValueAt(doc: Y.Doc, path: Array<string | number>): unknown {
  const read = readLogicalValueAtPath(doc, path);
  if (!read.ok) throw new Error(`readLogicalValueAtPath(${JSON.stringify(path)}) 失败：${JSON.stringify(read)}`);
  return read.value;
}

export function stateBytes(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc);
}

export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export interface UpdateCapture<T> {
  readonly result: T;
  readonly events: Uint8Array[];
  readonly count: number;
}

/** 捕获调用窗口内的 Yjs update 事件（复制/诊断捕获的上游事件流）。 */
export function withUpdates<T>(doc: Y.Doc, fn: () => T): UpdateCapture<T> {
  const events: Uint8Array[] = [];
  const listener = (update: Uint8Array): void => {
    events.push(update);
  };
  doc.on('update', listener);
  try {
    const result = fn();
    return { result, events, count: events.length };
  } finally {
    doc.off('update', listener);
  }
}

export interface FatalSummary {
  readonly fatal: boolean;
  readonly phase: string | null;
  readonly committed: boolean | null;
  readonly message: string;
}

/** throw 值的 branded 事实摘要（非 DocRuntimeFatalError ⇒ fatal:false 便于断言可读）。 */
export function summarizeThrown(thrown: unknown): FatalSummary {
  if (thrown instanceof DocRuntimeFatalError) {
    return { fatal: true, phase: thrown.phase, committed: thrown.committed, message: thrown.message };
  }
  return {
    fatal: false,
    phase: null,
    committed: null,
    message: thrown instanceof Error ? thrown.message : String(thrown),
  };
}
