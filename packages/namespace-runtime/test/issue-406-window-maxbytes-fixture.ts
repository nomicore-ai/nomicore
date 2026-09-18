/**
 * issue #406（ADR 0031 窗口面同轴：`readArray`/`readMap` 的 `maxBytes`）契约 fixture
 * （**非测试文件**，vitest 不收集；沿 `issue-383-filtered-window-fixture.ts` 构造纪律）。
 *
 * 承载（SA6 §12.0）：
 * 1. **冻结 schema 文本**（CJK 种子：`utf8 ≠ utf16`，度量单位敏感）；
 * 2. **冻结锚表**（`total = valueBytes + schemaBytes`；无预算窗口读 HEAD 实测），
 *    边界锚成对 `total` 收 / `total − 1` 拒的使用方见红灯契约与控制组；
 * 3. **同参无预算读 oracle** 的独立两通道测量（`measureWindowChannels`——绝不消费被测
 *    `measuredBytes`）；
 * 4. runtime / lease / 同 doc 双面装配 helper（零 vitest 依赖：本文件可被探针直接 import）。
 *
 * 夹具纪律：锚常量与文本**同变更集**冻结；任何种子/schema 改动必须同步改锚，否则控制组
 * 回归锚即红（预期红，非伪绿）。
 */
import * as Y from 'yjs';
import { createMemoryPersistence } from '@nomicore/persistence';
import type { DocHandle, User } from '@nomicore/persistence';
import type { NamespaceRuntime } from '../src/index.js';
import type { NamespaceRuntimeReadArrayOptions, NamespaceRuntimeReadMapOptions } from '../src/index.js';
import { createNamespaceRuntimeWithSeam } from '../src/runtime.js';
import { realPersistenceScheduler } from './real-persistence-scheduler.js';

/** 冻结 schema 文本（SA6 §12.0 逐字；投影文本锚定的唯一来源）。 */
export const TXT_406 = `
type Item = YMap<{
  /** 名称 */
  name: YLeaf<string>;
  /** 状态 */
  state: YLeaf<string>;
  /** 权重 */
  weight: YLeaf<number>;
}>;
type ROOT = YMap<{
  /** 条目数组（位置序） */
  items: Item[];
  /** 条目表（键空间） */
  itemMap: Record<string, Item>;
  /** 分数数组 */
  scores: YLeaf<number>[];
  /** 空条目表 */
  emptyMap: Record<string, Item>;
  /** 恰五条就绪表 */
  exactMap: Record<string, Item>;
}>;
`.trim();

export const WINDOW406_DOC_ID = 'ns-406';
export const WINDOW406_OWNER: User = { userId: 'u-406' };

/** `claimed` 谓词（where 锚）。 */
export const CLAIMED_406 = [{ field: 'state', equals: 'claimed' }] as const;

/** 条目子项（Y.Map：字段全部显式写入）。 */
function item(fields: Record<string, unknown>): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  for (const [key, value] of Object.entries(fields)) map.set(key, value);
  return map;
}

/**
 * 冻结文档（确定性、零随机、零时钟参与）：
 * - `items`：3 条位置序（2 claimed / 1 done）——数组面截断/装入/where 装满；
 * - `itemMap`：a1..a5 键序（claimed 3 / done 1 / open 1）——键面截断/where 扫完；
 * - `exactMap`：恰 5 条全 claimed——「匹配恰 n」装满判定边界；
 * - `scores`：标量数组（截断 + 折叠标量口径）；
 * - `emptyMap`：空容器（`value: []`、schema 照常）；
 * - `rawItems` / `rawMap`：schema 外 raw 容器（锚不可解析 → `schema: null` 单义锚；
 *   CJK 值使价值通道 utf8 ≠ utf16）。
 */
export function buildWindow406Doc(): Y.Doc {
  const doc = new Y.Doc();
  const schema = doc.getMap('SCHEMA');
  schema.set('lang', 'vfsl');
  schema.set('version', 1);
  schema.set('id', WINDOW406_DOC_ID);
  schema.set('text', TXT_406);
  const meta = doc.getMap('META');
  meta.set('docId', WINDOW406_DOC_ID);
  meta.set('createdAt', 1_700_000_000_000);
  const root = doc.getMap('ROOT');

  const items = new Y.Array<unknown>();
  items.push([
    item({ name: '甲一', state: 'claimed', weight: 1 }),
    item({ name: '乙二', state: 'done', weight: 3 }),
    item({ name: '丙三', state: 'claimed', weight: 2 }),
  ]);
  root.set('items', items);

  const itemMap = new Y.Map<unknown>();
  itemMap.set('a1', item({ name: '阿一', state: 'claimed', weight: 1 }));
  itemMap.set('a2', item({ name: '阿二', state: 'done', weight: 9 }));
  itemMap.set('a3', item({ name: '阿三', state: 'claimed', weight: 5 }));
  itemMap.set('a4', item({ name: '阿四', state: 'open', weight: 7 }));
  itemMap.set('a5', item({ name: '阿五', state: 'claimed', weight: 3 }));
  root.set('itemMap', itemMap);

  const scores = new Y.Array<number>();
  scores.push([7, 8, 9]);
  root.set('scores', scores);

  root.set('emptyMap', new Y.Map<unknown>());

  const exactMap = new Y.Map<unknown>();
  for (let i = 0; i < 5; i += 1) {
    exactMap.set(`e${i}`, item({ name: `就绪${i}`, state: 'claimed', weight: i }));
  }
  root.set('exactMap', exactMap);

  // schema 外 raw 容器（锚不可解析 → schema:null；窗口读照常——读是 schema 无关的）。
  const rawItems = new Y.Array<string>();
  rawItems.push(['你好，世界', '甲乙丙丁戊']);
  root.set('rawItems', rawItems);
  const rawMap = new Y.Map<unknown>();
  rawMap.set('r1', '子一');
  rawMap.set('r2', '丑二');
  root.set('rawMap', rawMap);

  return doc;
}

// ── 装配入口（runtime / lease / 同 doc 双面）────────────────────────────────────────────

/** 经 MemoryPersistence 构造带 SCHEMA/ROOT 的 DocHandle + 同一 doc 引用。 */
export async function makeWindow406Handle(): Promise<{ readonly handle: DocHandle; readonly doc: Y.Doc }> {
  const doc = buildWindow406Doc();
  const persistence = createMemoryPersistence({ scheduler: realPersistenceScheduler });
  const handle = await persistence.createDoc(WINDOW406_OWNER, WINDOW406_DOC_ID, doc);
  return { handle, doc };
}

/** 以既有 handle 构造 runtime（seam 通道；registry runtimeFactory 复用同一入口）。 */
export function createWindow406RuntimeFromHandle(handle: DocHandle): NamespaceRuntime {
  return createNamespaceRuntimeWithSeam({ handle });
}

/** 等待 schemaState 到 'ready'（零 vitest 依赖的有界轮询；超时 loud throw）。 */
export async function waitForWindow406SchemaReady(runtime: NamespaceRuntime): Promise<void> {
  for (let i = 0; i < 500; i += 1) {
    if (runtime.getStatus().schema.state === 'ready') return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('契约前提失败：schema 未在 5s 内 ready（装置或 P0 异常）');
}

export interface Window406RuntimeFixture {
  readonly runtime: NamespaceRuntime;
  readonly doc: Y.Doc;
  readonly handle: DocHandle;
}

/** 构造 runtime 并等待 P0 结算到 schema ready。 */
export async function makeWindow406Runtime(): Promise<Window406RuntimeFixture> {
  const { handle, doc } = await makeWindow406Handle();
  const runtime = createWindow406RuntimeFromHandle(handle);
  await waitForWindow406SchemaReady(runtime);
  return { runtime, doc, handle };
}

// ── 度量与形状 helper（期望来源纪律：冻结锚 ∨ 同运行同参无预算读的独立测量）─────────────

/** 精确 UTF-8 字节长度（度量单位锚：CJK 下 ≠ `.length`/UTF-16）。 */
export function utf8(text: string): number {
  return Buffer.byteLength(text, 'utf8');
}

/** UTF-16 码元长度（`.length`——单位敏感对照，绝不作为度量判据）。 */
export function utf16(text: string): number {
  return text.length;
}

/** 交付总量 oracle（**独立**两通道测量：同参无预算读的 `value`/`schema` 各自度量；
 *  绝不消费被测 `measuredBytes`）。 */
export function measureWindowChannels(value: unknown, schema: string | null): {
  readonly valueBytes: number;
  readonly schemaBytes: number;
  readonly total: number;
} {
  const valueBytes = value === undefined ? 0 : utf8(JSON.stringify(value));
  const schemaBytes = schema === null ? 0 : utf8(schema);
  return { valueBytes, schemaBytes, total: valueBytes + schemaBytes };
}

/** ✂ 截断事实块头行（窗口事实块同款文法）。 */
export const WINDOW_FACT_HEADER = '✂ 截断事实：';

/** 窗口失败成员恰四键（W1 失败形状；字母序）。 */
export const WINDOW_FAILURE_KEYS = ['code', 'message', 'ok', 'path'] as const;

/** 超限失败成员恰五键（零交付；字母序）。 */
export const BUDGET_FAILURE_KEYS = ['code', 'measuredBytes', 'message', 'ok', 'path'] as const;

/** 窗口成功成员恰四键（恒四键；字母序）。 */
export const WINDOW_OK_KEYS = ['ok', 'schema', 'truncated', 'value'] as const;

/**
 * 超限文案模板（三面同文义务：readData 面既有文案为镜像对象；窗口面必须逐字相同，
 * 面区分靠调用现场而非 message——ADR 0031 决策 3）。
 */
export function budgetMessageTemplate(measuredBytes: number, maxBytes: number): string {
  return `READ_BUDGET_EXCEEDED: 读交付总量 ${String(measuredBytes)} 字节超出 maxBytes ${String(maxBytes)}——零交付拒绝（不裁剪、不降深度；ADR 0031）`;
}

/** 非封闭形状 options 通道（`maxBytes` 运行时值域面只在运行时校验层可观测；HEAD 类型面
 *  尚无该键——单点 cast 进入运行时校验面，不制造编译噪声）。 */
export function asArrayOptions(value: unknown): NamespaceRuntimeReadArrayOptions {
  return value as NamespaceRuntimeReadArrayOptions;
}
export function asMapOptions(value: unknown): NamespaceRuntimeReadMapOptions {
  return value as NamespaceRuntimeReadMapOptions;
}

/** 锚 options + `maxBytes`（同参无预算读 = 锚 options 原样）。 */
export function arrayOptionsWithBudget(anchor: Window406Anchor, maxBytes: number): NamespaceRuntimeReadArrayOptions {
  return asArrayOptions({ ...anchor.options, maxBytes });
}
export function mapOptionsWithBudget(anchor: Window406Anchor, maxBytes: number): NamespaceRuntimeReadMapOptions {
  return asMapOptions({ ...anchor.options, maxBytes });
}

// ── 冻结锚表（无预算窗口读；HEAD 实测，`artifacts/sa6-issue406-probe-anchors.log`）────────

export interface Window406Anchor {
  readonly id: string;
  readonly face: 'array' | 'map';
  readonly path: readonly (string | number)[];
  /** 无预算 options（`maxBytes` 不在此处：锚 = 同参无预算读）。 */
  readonly options: Record<string, unknown>;
  readonly valueBytes: number;
  readonly schemaBytes: number;
  readonly total: number;
  readonly truncated: boolean;
  /** `schema === null`（锚不可解析）单义锚。 */
  readonly schemaNull: boolean;
  /** ✂ 事实行（truncated ∧ schema 非 null ∧ 非 where）；null = 不装配。 */
  readonly factsLine: string | null;
}

export const WINDOW_ANCHORS_406: readonly Window406Anchor[] = [
  { id: 'WA0', face: 'array', path: ['items'], options: { n: 3 }, valueBytes: 199, schemaBytes: 100, total: 299, truncated: false, schemaNull: false, factsLine: null },
  { id: 'WA1', face: 'array', path: ['items'], options: { n: 2 }, valueBytes: 132, schemaBytes: 174, total: 306, truncated: true, schemaNull: false, factsLine: '- items · 窗口 · 基 index asc · kept 2/total 3' },
  { id: 'WA2', face: 'array', path: ['scores'], options: { n: 2 }, valueBytes: 45, schemaBytes: 82, total: 127, truncated: true, schemaNull: false, factsLine: '- scores · 窗口 · 基 index asc · kept 2/total 3' },
  { id: 'WA3', face: 'array', path: ['rawItems'], options: { n: 2 }, valueBytes: 77, schemaBytes: 0, total: 77, truncated: false, schemaNull: true, factsLine: null },
  { id: 'WA4', face: 'array', path: ['rawItems'], options: { n: 1 }, valueBytes: 39, schemaBytes: 0, total: 39, truncated: true, schemaNull: true, factsLine: null },
  { id: 'WA5', face: 'array', path: ['items'], options: { n: 2, depth: 0 }, valueBytes: 47, schemaBytes: 187, total: 234, truncated: true, schemaNull: false, factsLine: '- items · 窗口 · 基 index asc · kept 2/total 3' },
  { id: 'WA6', face: 'array', path: ['items'], options: { n: 3, maxChildrenPerNode: 1 }, valueBytes: 115, schemaBytes: 100, total: 215, truncated: false, schemaNull: false, factsLine: null },
  { id: 'WA7', face: 'array', path: ['items'], options: { n: 1, where: CLAIMED_406 }, valueBytes: 68, schemaBytes: 100, total: 168, truncated: true, schemaNull: false, factsLine: null },
  { id: 'WM0', face: 'map', path: ['itemMap'], options: { n: 5 }, valueBytes: 335, schemaBytes: 100, total: 435, truncated: false, schemaNull: false, factsLine: null },
  { id: 'WM1', face: 'map', path: ['itemMap'], options: { n: 2 }, valueBytes: 134, schemaBytes: 174, total: 308, truncated: true, schemaNull: false, factsLine: '- itemMap · 窗口 · 基 key asc · kept 2/total 5' },
  { id: 'WM2', face: 'map', path: ['itemMap'], options: { n: 3, orderBy: { by: 'key', dir: 'desc' } }, valueBytes: 202, schemaBytes: 175, total: 377, truncated: true, schemaNull: false, factsLine: '- itemMap · 窗口 · 基 key desc · kept 3/total 5' },
  { id: 'WM3', face: 'map', path: ['itemMap'], options: { n: 2, orderBy: { field: 'weight', dir: 'desc' } }, valueBytes: 131, schemaBytes: 184, total: 315, truncated: true, schemaNull: false, factsLine: '- itemMap · 窗口 · 基 field:weight desc · kept 2/total 5' },
  { id: 'WM4', face: 'map', path: ['itemMap'], options: { n: 3, where: CLAIMED_406 }, valueBytes: 205, schemaBytes: 100, total: 305, truncated: true, schemaNull: false, factsLine: null },
  { id: 'WM5', face: 'map', path: ['itemMap'], options: { n: 5, where: CLAIMED_406 }, valueBytes: 205, schemaBytes: 100, total: 305, truncated: false, schemaNull: false, factsLine: null },
  { id: 'WM6', face: 'map', path: ['exactMap'], options: { n: 5, where: CLAIMED_406 }, valueBytes: 346, schemaBytes: 100, total: 446, truncated: true, schemaNull: false, factsLine: null },
  { id: 'WM7', face: 'map', path: ['emptyMap'], options: { n: 1 }, valueBytes: 2, schemaBytes: 100, total: 102, truncated: false, schemaNull: false, factsLine: null },
  { id: 'WM8', face: 'map', path: ['rawMap'], options: { n: 1 }, valueBytes: 31, schemaBytes: 0, total: 31, truncated: true, schemaNull: true, factsLine: null },
  { id: 'WM9', face: 'map', path: ['itemMap'], options: { n: 2, depth: 0 }, valueBytes: 49, schemaBytes: 187, total: 236, truncated: true, schemaNull: false, factsLine: '- itemMap · 窗口 · 基 key asc · kept 2/total 5' },
];

/** 锚查询（缺席 loud throw，绝不静默降级）。 */
export function windowAnchorById(id: string): Window406Anchor {
  const found = WINDOW_ANCHORS_406.find((anchor) => anchor.id === id);
  if (found === undefined) throw new Error(`契约装置失败：锚 ${id} 不在 SA6 §12.0 锚表中`);
  return found;
}

/** 面向锚的无预算窗口读（前提失败 loud throw；oracle 面）。 */
export function readWindowAnchor(runtime: NamespaceRuntime, anchor: Window406Anchor): Window406OkShape {
  const result: unknown = anchor.face === 'array'
    ? runtime.readArray(anchor.path, asArrayOptions(anchor.options))
    : runtime.readMap(anchor.path, asMapOptions(anchor.options));
  return windowOk(result, `锚 ${anchor.id} 无预算读`);
}

/** 面向锚的预算读（raw 联合；失败面原样返回）。 */
export function readWindowAnchorWithBudget(
  runtime: NamespaceRuntime,
  anchor: Window406Anchor,
  maxBytes: number,
): unknown {
  return anchor.face === 'array'
    ? runtime.readArray(anchor.path, arrayOptionsWithBudget(anchor, maxBytes))
    : runtime.readMap(anchor.path, mapOptionsWithBudget(anchor, maxBytes));
}

// ── 形状断言（集中化；只观察公共接缝）────────────────────────────────────────────────

export interface Window406OkShape {
  readonly ok: true;
  readonly value: unknown[];
  readonly schema: string | null;
  readonly truncated: boolean;
}

export interface Window406FailureShape {
  readonly ok: false;
  readonly code: string;
  readonly path: readonly (string | number)[];
  readonly message: string;
  readonly measuredBytes?: number;
}

/** 成功分支恰四键（键集断言，不比较值）。 */
export function expectWindowOkKeys(actual: object): void {
  const keys = Object.keys(actual).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...WINDOW_OK_KEYS])) {
    throw new Error(`契约失败：窗口成功分支应恰四键 ${JSON.stringify(WINDOW_OK_KEYS)}，实际 ${JSON.stringify(keys)}`);
  }
}

/** 前提断言：ok:true（失败 loud throw，绝不假绿）。 */
export function windowOk(actual: unknown, label: string): Window406OkShape {
  if ((actual as { ok?: unknown }).ok !== true) {
    throw new Error(`${label}：契约前提失败（期望 ok:true，实际 ${JSON.stringify(actual)}）`);
  }
  return actual as Window406OkShape;
}

/** 窗口失败成员（恰四键 + 非空 message）。 */
export function expectWindowFailure(actual: unknown, label: string): Window406FailureShape {
  const failure = actual as Window406FailureShape;
  if (failure.ok !== false) throw new Error(`${label}：契约前提失败（期望 ok:false，实际 ${JSON.stringify(actual)}）`);
  const keys = Object.keys(failure).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...WINDOW_FAILURE_KEYS])) {
    throw new Error(`${label}：窗口失败分支应恰四键，实际 ${JSON.stringify(keys)}`);
  }
  if (typeof failure.message !== 'string' || failure.message.length === 0) {
    throw new Error(`${label}：失败 message 必须是非空字符串`);
  }
  return failure;
}

/** 超限零交付失败成员（恰五键 + `measuredBytes === expectedMeasuredBytes`）。 */
export function expectBudgetFailure(
  actual: unknown,
  expectedMeasuredBytes: number,
  label: string,
): Required<Window406FailureShape> {
  const failure = actual as Required<Window406FailureShape>;
  if (failure.ok !== false) throw new Error(`${label}：契约前提失败（期望 ok:false，实际 ${JSON.stringify(actual)}）`);
  if (failure.code !== 'READ_BUDGET_EXCEEDED') {
    throw new Error(`${label}：失败码应为 READ_BUDGET_EXCEEDED，实际 ${JSON.stringify(failure.code)}`);
  }
  const keys = Object.keys(failure).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...BUDGET_FAILURE_KEYS])) {
    throw new Error(`${label}：超限失败分支应恰五键（零交付），实际 ${JSON.stringify(keys)}`);
  }
  if (failure.measuredBytes !== expectedMeasuredBytes) {
    throw new Error(`${label}：measuredBytes 应为 ${String(expectedMeasuredBytes)}（无预算读 oracle 合计），实际 ${String(failure.measuredBytes)}`);
  }
  return failure;
}

/** ✂ 事实行抽取（窗口事实段恒「头行 + 恰一行事实行」）。 */
export function windowFactLines(schema: string | null): string[] {
  if (schema === null) return [];
  return schema.split('\n').filter((line) => line.startsWith('- '));
}
