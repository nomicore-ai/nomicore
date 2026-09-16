/**
 * issue #405（ADR 0031 readData 字节预算——交付总量收/拒闸）契约 fixture（**非测试文件**，
 * vitest 不收集；沿 `runtime-readdata-shape-budget-fixture.ts` 构造纪律）。
 *
 * 承载（SA6 §12.0）：
 * 1. **冻结 schema 文本**（CJK 种子：`utf8 ≠ utf16`，度量单位敏感锚 §12.5 R4）；
 * 2. **冻结锚表 R0–R12**（`total = valueBytes + schemaBytes`，边界锚成对 `total` 收 /
 *    `total − 1` 拒的使用方见红灯契约与回归锚）；
 * 3. **同参无预算读 oracle** 的独立两通道测量（`measureChannels`——绝不消费被测
 *    `measuredBytes`，反伪绿 §12.5 R1）；
 * 4. runtime 装配 helper（MemoryPersistence + seam + poll ready）。
 *
 * 夹具纪律（SA6 §12.0）：锚常量与文本**同变更集**冻结；任何种子/文本改动必须同步改锚，
 * 否则回归锚即红（预期红，非伪绿）。
 */
import * as Y from 'yjs';
import { expect } from 'vitest';
import { createMemoryPersistence } from '@nomicore/persistence';
import type { DocHandle, User } from '@nomicore/persistence';
import { realPersistenceScheduler } from './real-persistence-scheduler.js';
import { createNamespaceRuntimeWithSeam } from '../src/runtime.js';
import type { NamespaceRuntime } from '../src/index.js';

/** 冻结 schema 文本（SA6 §12.0 逐字；投影文本 / 头行 / ✂ 段锚定的唯一来源）。 */
export const TXT_405 = `
type Meta = YMap<{
  /** 备注内容 */
  content: YLeaf<string>;
  /** 附加计数 */
  extra: YLeaf<number>;
}>;
type ROOT = YMap<{
  /** 页面标题 */
  title: YLeaf<string>;
  count: YLeaf<number>;
  /** 元数据 */
  meta: Meta;
  /** 标签组 */
  tags: YLeaf<string>[];
  /** 可选昵称 */
  nick?: YLeaf<string>;
}>;
`.trim();

export const ENV_405 = { lang: 'vfsl', version: 1, id: 'ns-405', text: TXT_405 } as const;

export const OWNER_405: User = { userId: 'u-405' };

/** raw 变体额外值（schema 外键；`utf8(JSON.stringify('x'.repeat(100))) === 102`）。 */
export const ROGUE_TEXT = 'x'.repeat(100);

/** 严格 ROOT 种子（CJK 文本 = 度量单位敏感锚；`nick` 刻意缺席 = 缺席目标锚）。 */
export function seedStrictRoot405(root: Y.Map<unknown>): void {
  root.set('title', '你好，世界');
  root.set('count', 3);
  const meta = new Y.Map<unknown>();
  meta.set('content', '备注说明');
  meta.set('extra', 7);
  root.set('meta', meta);
  const tags = new Y.Array<string>();
  tags.push(['甲', '乙', '丙', '丁', '戊']);
  root.set('tags', tags);
  // 'nick'（optional）刻意缺席：缺席目标读（值侧 0、投影文本照常计量——ADR 0031 决策 5）。
}

/** raw ROOT 种子：严格字段 + schema 外 `rogue`（路径偏离 → `schema: null` 单义锚）。 */
export function seedRawRoot405(root: Y.Map<unknown>): void {
  seedStrictRoot405(root);
  root.set('rogue', ROGUE_TEXT);
}

/** 冻结预算轴（与 `maxBytes` 无关的两轴；`undefined` = 无 options 读）。 */
export interface FrozenBudget {
  readonly depth?: number;
  readonly maxChildrenPerNode?: number;
}

/** 冻结锚条目（SA6 §12.0 锚表逐行同构；`total = valueBytes + schemaBytes`）。 */
export interface MaxBytesAnchor {
  readonly id: string;
  readonly path: readonly (string | number)[];
  /** `undefined` = 无 options 读；`{}` = 空预算 options（头行无预算段，与无 options 逐字节同）。 */
  readonly budget: FrozenBudget | undefined;
  readonly raw: boolean;
  readonly valueBytes: number;
  readonly schemaBytes: number;
  readonly total: number;
  readonly truncated: boolean;
}

/** 锚表 R0–R12（SA6 §12.0；HEAD 实测冻结，控制组逐锚复验）。 */
export const ANCHORS_405: readonly MaxBytesAnchor[] = [
  { id: 'R0', path: [], budget: undefined, raw: false, valueBytes: 120, schemaBytes: 238, total: 358, truncated: false },
  { id: 'R1', path: [], budget: { depth: 1 }, raw: false, valueBytes: 57, schemaBytes: 358, total: 415, truncated: true },
  { id: 'R2', path: [], budget: { depth: 0 }, raw: false, valueBytes: 2, schemaBytes: 190, total: 192, truncated: true },
  { id: 'R3', path: [], budget: { maxChildrenPerNode: 2 }, raw: false, valueBytes: 37, schemaBytes: 312, total: 349, truncated: true },
  { id: 'R4', path: ['title'], budget: undefined, raw: false, valueBytes: 17, schemaBytes: 27, total: 44, truncated: false },
  { id: 'R5', path: ['meta'], budget: undefined, raw: false, valueBytes: 36, schemaBytes: 107, total: 143, truncated: false },
  { id: 'R6', path: ['tags'], budget: undefined, raw: false, valueBytes: 31, schemaBytes: 28, total: 59, truncated: false },
  { id: 'R7', path: ['nick'], budget: undefined, raw: false, valueBytes: 0, schemaBytes: 27, total: 27, truncated: false },
  { id: 'R8', path: ['rogue'], budget: undefined, raw: false, valueBytes: 0, schemaBytes: 0, total: 0, truncated: false },
  { id: 'R9', path: ['rogue'], budget: undefined, raw: true, valueBytes: 102, schemaBytes: 0, total: 102, truncated: false },
  { id: 'R10', path: [], budget: undefined, raw: true, valueBytes: 231, schemaBytes: 238, total: 469, truncated: false },
  { id: 'R11', path: [], budget: { depth: 1, maxChildrenPerNode: 2 }, raw: false, valueBytes: 37, schemaBytes: 345, total: 382, truncated: true },
  { id: 'R12', path: [], budget: {}, raw: false, valueBytes: 120, schemaBytes: 238, total: 358, truncated: false },
];

/** 锚查询（缺席 loud throw，绝不静默降级——反伪绿 §12.5 R9）。 */
export function anchorById(id: string): MaxBytesAnchor {
  const found = ANCHORS_405.find((a) => a.id === id);
  if (found === undefined) throw new Error(`契约装置失败：锚 ${id} 不在 SA6 §12.0 锚表中`);
  return found;
}

/** 精确 UTF-8 字节长度（度量单位锚：CJK 下 ≠ `.length`——反伪绿 §12.5 R4）。 */
export function utf8(text: string): number {
  return Buffer.byteLength(text, 'utf8');
}

/** 交付总量 oracle（**独立**两通道测量：同参无预算读的 `value`/`schema` 各自度量；
 *  绝不消费被测结果——反伪绿 §12.5 R1）。 */
export function measureChannels(value: unknown, schema: string | null): {
  readonly valueBytes: number;
  readonly schemaBytes: number;
  readonly total: number;
} {
  const valueBytes = value === undefined ? 0 : utf8(JSON.stringify(value));
  const schemaBytes = schema === null ? 0 : utf8(schema);
  return { valueBytes, schemaBytes, total: valueBytes + schemaBytes };
}

export interface MaxBytesFixture {
  readonly handle: DocHandle;
  readonly doc: Y.Doc;
  readonly persistence: ReturnType<typeof createMemoryPersistence>;
}

/** 经 MemoryPersistence 构造带 SCHEMA/ROOT 的 DocHandle（读取面测试零写、零 notifier）。 */
export async function makeHandle405(opts: { raw?: boolean; seedSchema?: boolean } = {}): Promise<MaxBytesFixture> {
  const persistence = createMemoryPersistence({ scheduler: realPersistenceScheduler });
  const doc = new Y.Doc();
  if (opts.seedSchema !== false) {
    const sc = doc.getMap('SCHEMA');
    for (const [k, v] of Object.entries(ENV_405)) sc.set(k, v);
  }
  const meta = doc.getMap('META');
  meta.set('docId', ENV_405.id);
  meta.set('createdAt', 1_700_000_000_000);
  if (opts.raw === true) seedRawRoot405(doc.getMap('ROOT'));
  else seedStrictRoot405(doc.getMap('ROOT'));
  const handle = await persistence.createDoc(OWNER_405, ENV_405.id, doc);
  return { handle, doc, persistence };
}

/** 以既有 handle 构造 runtime（registry 侧 runtimeFactory 复用同一入口）。 */
export function createRuntime405FromHandle(
  handle: DocHandle,
  opts: { p0Gate?: Promise<void> } = {},
): NamespaceRuntime {
  return createNamespaceRuntimeWithSeam({
    handle,
    ...(opts.p0Gate !== undefined ? { p0Gate: opts.p0Gate } : {}),
  });
}

/** 等待 schemaState 到 'ready'（沿既有 fixture 的 poll 纪律）。 */
export async function waitForSchemaReady405(runtime: NamespaceRuntime): Promise<void> {
  await expect.poll(() => runtime.getStatus().schema.state, { interval: 10, timeout: 5_000 }).toBe('ready');
}

/** 构造 runtime 并等待 ready。 */
export async function makeRuntime405(opts: { raw?: boolean; p0Gate?: Promise<void> } = {}): Promise<NamespaceRuntime> {
  const { handle } = await makeHandle405(opts);
  const runtime = createRuntime405FromHandle(handle, {
    ...(opts.p0Gate !== undefined ? { p0Gate: opts.p0Gate } : {}),
  });
  await waitForSchemaReady405(runtime);
  return runtime;
}

/** 构造 runtime + 暴露 handle/doc（oracle 需独立消费同一 doc）。 */
export async function makeRuntime405WithDoc(opts: { raw?: boolean } = {}): Promise<{
  readonly runtime: NamespaceRuntime;
  readonly doc: Y.Doc;
  readonly handle: DocHandle;
}> {
  const { handle, doc } = await makeHandle405(opts);
  const runtime = createRuntime405FromHandle(handle);
  await waitForSchemaReady405(runtime);
  return { runtime, doc, handle };
}
