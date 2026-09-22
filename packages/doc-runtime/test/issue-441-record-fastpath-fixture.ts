/**
 * issue #441 SA6 契约夹具（contract + control 两个测试文件共用；探针亦复用；非测试入口——
 * 文件名不匹配 vitest include 的 `*.test.ts`，仅为可类型检查的共享模块）。
 *
 * 全部证据经公共入口观察运行时行为：`applyValidatedMutation` 的判别联合结果 / throw 的
 * branded fatal 事实 / live `Y.Map` 的 entry 读计数 / Yjs update 事件与状态字节 /
 * `readLogicalValueAtPath` 的逻辑值。无源码字符串断言、无 skip/only/todo、无 env override。
 *
 * 夹具纪律（与 issue #436 同款）：
 * - 确定性：零随机源、零真实时钟、零网络、零并发；`clientID` 仅在字节比较用例显式固定；
 * - 污染注入走 raw Yjs（等价 trusted raw replication 写入），不经 schema 校验路径；
 * - 读计数 = 「整 map 提取 / 重投影」的结构性成本代理（entry 级 `get`/`has` 逐次计真，
 *   整 map 批量出口 `keys`/`values`/`entries`/`forEach`/`toJSON`/`Symbol.iterator` 按其
 *   `size` 计入——换批量出口逃逸计数不成立）。
 */
import * as Y from 'yjs';
import { evaluate, parseVfsl } from '@nomicore/vfsl';
import type { DerivedSchema } from '@nomicore/vfsl';
import { DocRuntimeFatalError, applyValidatedMutation, materializeRoot, readLogicalValueAtPath } from '../src/index.js';
import type { ApplyValidatedMutationResult, MutationEnvelope } from '../src/index.js';

/**
 * 契约 schema（ADR 0034 闸门三形态 + 永久 legacy 负例 + 封闭对象 delete 面）：
 * - `tasks` 非 union Record 位（fast path 候选；深 1 层）；
 * - `codes` 带 keyPattern 的 Record 位（键 Pattern 判定面）；
 * - `blobs` Record 值位为 union（ADR 0034 决策 1：值位 union **不**阻断 fast path）；
 * - `maybe` union map 位（永久 legacy 负例）；
 * - `umem.inner` union 穿越的成员内 Record（plan.kind=union，永久 legacy 负例）；
 * - `outer.inner` 嵌套 Record（深路径 fast path 候选）；
 * - `obj` 封闭对象（4 字段；optional/required/unknown 三类字段 delete 面）；
 * - `narrow`/`wide` 封闭对象（字段数 4 / 14——成本与父值字段数解耦的结构性证据面）。
 */
export const TEXT = [
  'type Item = { title: string; qty: number & Int<0, 100> };',
  'type Alt = { label: string; n: number & Int<0, 10> };',
  'type ROOT = {',
  '  n: number;',
  '  tasks: Record<string, Item>;',
  '  codes: Record<string & Pattern<"^(id-[0-9]+)$">, Item>;',
  '  blobs: Record<string, Item | Alt>;',
  '  maybe: Record<string, Item> | { fixed: string };',
  '  umem: { inner: Record<string, Item> } | { inner: { fixed: string } };',
  '  outer: { inner: Record<string, Item> };',
  '  obj: { req: string; opt?: number; unk: unknown; deep: { d: string } };',
  '  narrow: { a: string; b: string; target?: number; spare?: string };',
  '  wide: {',
  '    f0: string; f1: string; f2: string; f3: string; f4: string; f5: string; f6: string;',
  '    f7: string; f8: string; f9: string; f10: string; f11: string; target?: number; spare?: string;',
  '  };',
  '};',
  '',
].join('\n');

export const WIDE_FIELDS: readonly string[] = [
  'f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11',
];

function derivedOf(text: string): DerivedSchema {
  const parsed = parseVfsl(text);
  if (!parsed.ok) throw new Error(`夹具 schema parseVfsl 失败：${JSON.stringify(parsed.issues)}`);
  const evaluated = evaluate(parsed.module);
  if (!evaluated.ok) throw new Error(`夹具 schema evaluate 失败：${JSON.stringify(evaluated.issues)}`);
  return evaluated.derived;
}

export const DERIVED: DerivedSchema = derivedOf(TEXT);

export function item(title: string, qty: number): { title: string; qty: number } {
  return { title, qty };
}

export function alt(label: string, n: number): { label: string; n: number } {
  return { label, n };
}

export interface Fx {
  readonly doc: Y.Doc;
  readonly root: Y.Map<unknown>;
  readonly tasks: Y.Map<unknown>;
  readonly codes: Y.Map<unknown>;
  readonly blobs: Y.Map<unknown>;
  readonly maybe: Y.Map<unknown>;
  readonly umemInner: Y.Map<unknown>;
  readonly inner: Y.Map<unknown>;
  readonly obj: Y.Map<unknown>;
  readonly narrow: Y.Map<unknown>;
  readonly wide: Y.Map<unknown>;
}

export interface FixtureOptions {
  /** `tasks` entry 数（默认 3：t0/t1/t2；内容 = item(`t<i>`, i+1)）。 */
  readonly tasksN?: number;
  /** 显式固定 clientID（仅字节 oracle 用例；默认随机，避免跨用例耦合）。 */
  readonly clientID?: number;
}

/** tasks 的 entry 键（`t<i>`）。 */
export function taskKey(i: number): string {
  return `t${i}`;
}

export function fixture(options: FixtureOptions = {}): Fx {
  const n = options.tasksN ?? 3;
  const tasks: Record<string, unknown> = {};
  for (let i = 0; i < n; i++) tasks[taskKey(i)] = item(taskKey(i), (i % 100) + 1);
  const wide: Record<string, unknown> = {};
  for (const f of WIDE_FIELDS) wide[f] = `${f}-v`;
  wide.target = 7;
  wide.spare = 'spare';
  const doc = new Y.Doc();
  if (options.clientID !== undefined) doc.clientID = options.clientID;
  const materialized = materializeRoot(
    DERIVED,
    {
      n: 1,
      tasks,
      codes: { 'id-1': item('c1', 1) },
      blobs: { b1: item('x', 2) },
      maybe: { m1: item('m', 3) },
      umem: { inner: { u1: item('u', 1) } },
      outer: { inner: { n1: item('i', 4) } },
      obj: { req: 'r', opt: 1, unk: { k: 1 }, deep: { d: 'd' } },
      narrow: { a: 'a', b: 'b', target: 1, spare: 's' },
      wide,
    },
    doc,
  );
  if (!materialized.ok) throw new Error(`夹具物化失败：${JSON.stringify(materialized.issues)}`);
  const root = doc.getMap('ROOT');
  return {
    doc,
    root,
    tasks: root.get('tasks') as Y.Map<unknown>,
    codes: root.get('codes') as Y.Map<unknown>,
    blobs: root.get('blobs') as Y.Map<unknown>,
    maybe: root.get('maybe') as Y.Map<unknown>,
    umemInner: (root.get('umem') as Y.Map<unknown>).get('inner') as Y.Map<unknown>,
    inner: (root.get('outer') as Y.Map<unknown>).get('inner') as Y.Map<unknown>,
    obj: root.get('obj') as Y.Map<unknown>,
    narrow: root.get('narrow') as Y.Map<unknown>,
    wide: root.get('wide') as Y.Map<unknown>,
  };
}

export function run(fx: Fx, mutation: unknown): ApplyValidatedMutationResult {
  return applyValidatedMutation(DERIVED, fx.doc, mutation as MutationEnvelope);
}

/** raw Yjs 写入（等价 trusted raw replication：不经 schema 校验路径）。 */
export function rawSet(map: Y.Map<unknown>, key: string, value: unknown): void {
  map.set(key, value);
}

/** `title`/`qty` 字段齐备的 raw Y.Map entry（载体正确、内容可控——用于把污染与载体错位分离）。 */
export function rawItemEntry(title: string, qty: unknown): Y.Map<unknown> {
  const m = new Y.Map<unknown>();
  m.set('title', title);
  m.set('qty', qty);
  return m;
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

/** 在提交事务的 afterTransaction cleanup 窗口内一次性篡改（与 issue #350/#436 SA7 同款机制；
 *  yjs 事件先于 S9 验证派发 ⇒ 篡改对 S9 可见）。 */
export function tamperOnNextLocalCommit(doc: Y.Doc, tamper: () => void): void {
  let done = false;
  doc.on('afterTransaction', (transaction: Y.Transaction) => {
    if (!transaction.local || done) return;
    done = true;
    tamper();
  });
}

export interface MapReadCounts {
  /** entry 值读取计数：`get` 逐次、整 map 批量出口按 `size` 计入。 */
  readonly valueReads: number;
  /** 在场性读取计数：`has` 逐次。 */
  readonly presenceReads: number;
}

/** live `Y.Map` entry 读计数（实例级方法覆盖，仅覆盖该实例；调用窗口内计数，窗口外恢复
 *  原型方法）。读计数 = 「整 map 提取 / 重投影 / 全量重建输入」的结构性成本代理：
 *  逐 entry `get`/`has` 计 1；整 map 批量出口按其 `size` 计（防「换批量出口的整 map 提取」
 *  逃逸计数）。O(n) ⇒ 计数 ∝ n；O(k) ⇒ 计数与 n 解耦。 */
export function countMapReads<T>(map: Y.Map<unknown>, fn: () => T): { result: T; counts: MapReadCounts } {
  let valueReads = 0;
  let presenceReads = 0;
  const originalGet = map.get.bind(map) as (key: string) => unknown;
  const originalHas = map.has.bind(map) as (key: string) => boolean;
  const originalKeys = map.keys.bind(map) as () => IterableIterator<string>;
  const originalValues = map.values.bind(map) as () => IterableIterator<unknown>;
  const originalEntries = map.entries.bind(map) as () => IterableIterator<[string, unknown]>;
  const originalForEach = map.forEach.bind(map) as (f: (value: unknown, key: string, map: Y.Map<unknown>) => void) => void;
  const originalToJSON = map.toJSON.bind(map) as () => Record<string, unknown>;
  const originalIterator = map[Symbol.iterator].bind(map) as () => IterableIterator<[string, unknown]>;
  const target = map as unknown as Record<PropertyKey, unknown>;
  const sizeOf = (): number => map.size;
  target.get = (key: string) => {
    valueReads += 1;
    return originalGet(key);
  };
  target.has = (key: string) => {
    presenceReads += 1;
    return originalHas(key);
  };
  target.keys = () => {
    valueReads += sizeOf();
    return originalKeys();
  };
  target.values = () => {
    valueReads += sizeOf();
    return originalValues();
  };
  target.entries = () => {
    valueReads += sizeOf();
    return originalEntries();
  };
  target.forEach = (f: (value: unknown, key: string, map: Y.Map<unknown>) => void) => {
    valueReads += sizeOf();
    originalForEach(f);
  };
  target.toJSON = () => {
    valueReads += sizeOf();
    return originalToJSON();
  };
  target[Symbol.iterator] = () => {
    valueReads += sizeOf();
    return originalIterator();
  };
  try {
    return { result: fn(), counts: { valueReads, presenceReads } };
  } finally {
    delete target.get;
    delete target.has;
    delete target.keys;
    delete target.values;
    delete target.entries;
    delete target.forEach;
    delete target.toJSON;
    delete target[Symbol.iterator];
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
