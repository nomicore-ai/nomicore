/**
 * SA6 验收契约（红灯）— issue #382 P2：`@nomicore/doc-runtime` 载体级窗口原语的 `where`
 * 过滤词表（ADR 0029 缝 1：doc-runtime 原语公共入口）。
 *
 * 契约来源：
 * - 任务简报 `wiki/raw/task_issue-382.md`（What to build + AC1–AC8）；
 * - SA6 验收契约 `wiki/raw/task_issue-382_sa6_contract.md` §12.1 绑定表 B-1–B-11、
 *   §12.3.1–§12.3.7 用例组 C1–C11 / D1–D12 / V1–V21 / P1–P5 / T1–T6 / Z1–Z8 / F1–F6、
 *   §12.6 结构契约（S1–S4 属审计证据，不在本文件）、§12.7 敏感度防线；
 * - `docs/adr/0029-filtered-window-read.md` §1（公共面：options 增可选 `where`；不改
 *   readData、不新增第四读方法）、§2（WhereTerm v1 = `{field: 单段字面键, equals:
 *   string|number|boolean|null}`；number 须 `Number.isFinite`；合取；空数组非法；
 *   上限 16；同 field 重复合法；形状永不再变）、§3（数据侧安静不匹配 × 入参侧响亮）、
 *   §4（管线 where → orderBy → n；readArray 对称获得，不触碰 orderBy 面词表）、
 *   §5（`total` 键恒在：无 where = 标识计数、有 where = `undefined`）、§6（敌意校验：
 *   两键白名单 / plain 原型链 / 零 `[[Get]]` / 零 accessor 执行 / trap 收编）、
 *   §7（谓词比较实际数据值，schema 无关）；
 * - `docs/adr/0028-window-read.md` §7（三稳定码 + `PATH_NOT_ALLOWED` 透传）、§8（零物化
 *   成本纪律）。
 *
 * 红灯机理（HEAD `1b639e0`，SA6 §5 探针 A/C 组实证）：W1 options 封闭形状白名单恰四键
 * `{n,orderBy,depth,maxChildrenPerNode}`，任何合法 `where` 在 OPT 阶段以「未知键」被拒
 * （`WINDOW_OPTIONS_INVALID`，零 doc 触碰）⟹ C/D/P/T/Z 组全红（能力缺口 = 词表位未实现）。
 * V 组（除 V3/V20 反向边界）在 HEAD 因「未知键」得同码，属**伪绿**——只作实现后变异守卫，
 * 不充当红证据（SA6 §12.3.3 伪绿登记）；负控组（NC）在 HEAD 全绿，实现后必须保持绿。
 *
 * 断言纪律（SA6 §12 契约纪律）：
 * - 全部锚定运行时行为（结果联合、own 键集、条目列表与身份、Y.Doc 值、异常观测），
 *   无源码 grep/字符串断言；
 * - 期望由**独立预言机**（原生 `get`/descriptor 直数，零实现复用）或 SA6 §12.3 表格的
 *   可判定常量派生；`total` 判定一律用 `Object.prototype.hasOwnProperty`（禁 JSON 快照——
 *   `JSON.stringify` 丢 undefined 键）；
 * - 零 skip/only/todo、零 env override、零 fallback、零吞错。
 *
 * 非目标（SA6 §12.5 边界）：不写 lease/组合层断言（F7 属实现期审计 + registry P4 条件
 * 不变式）；不改 read.ts / readData / lease 四键 / truncated / ✂；不实现缝 2。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import * as docRuntime from '../src/index.js';
import { readLogicalValueAtPath } from '../src/index.js';
import type { ReadLogicalValueAtPathOptions } from '../src/index.js';

type Path = readonly (string | number)[];

// ── §绑定（B-1/B-2/B-3）：入口名/调用形状绑定点；冻结后若改名只动这里 ──────────────────

const ARRAY_WINDOW_EXPORT = 'readArrayWindowAtPath';
const MAP_WINDOW_EXPORT = 'readMapWindowAtPath';

type WindowOptions = Record<string, unknown>;
interface WindowResult {
  ok: boolean;
  value?: unknown;
  code?: unknown;
  path?: unknown;
  message?: unknown;
  total?: unknown;
  [key: string]: unknown;
}
type WindowFn = (doc: Y.Doc, path: Path, options?: WindowOptions) => WindowResult;

const ns = docRuntime as unknown as Record<string, unknown>;

function windowEntry(exportName: string, label: string): WindowFn {
  const candidate = ns[exportName];
  expect(
    typeof candidate,
    `W1 能力缺口：@nomicore/doc-runtime 公共入口未导出 ${exportName}（${label}；ADR 0028 决策 9-子弹 1）——实际 ${typeof candidate}`,
  ).toBe('function');
  return candidate as WindowFn;
}

function arrayWindow(): WindowFn {
  return windowEntry(ARRAY_WINDOW_EXPORT, '数组窗口原语');
}

function mapWindow(): WindowFn {
  return windowEntry(MAP_WINDOW_EXPORT, '键容器窗口原语');
}

/** 成功结算：`ok:true` 且携带 `value`（键集锁由本文件的显式断言与类型守卫承载）。 */
function expectWindowOk(result: unknown): unknown {
  expect(result !== null && typeof result === 'object', `期望窗口读结果为对象，实际 ${String(result)}`).toBe(true);
  const r = result as WindowResult;
  expect(r.ok, `期望窗口读 ok:true，实际 ${JSON.stringify(r)}`).toBe(true);
  expect(Object.prototype.hasOwnProperty.call(r, 'value'), '窗口成功结算必须携带 value 键').toBe(true);
  return r.value;
}

/** 失败结算：`ok:false` 且 `code` 严格等于稳定码。 */
function expectWindowErr(result: unknown, code: string): WindowResult {
  expect(result !== null && typeof result === 'object', `期望窗口读失败结算对象，实际 ${String(result)}`).toBe(true);
  const r = result as WindowResult;
  expect(r.ok === true, `期望窗口读 ok:false，实际 ${JSON.stringify(r)}`).toBe(false);
  expect(r.code, `期望稳定码 ${code}，实际 ${String(r.code)}`).toBe(code);
  return r;
}

/** 条目记录列表（成功面 value 数组）。 */
function entriesOf(result: unknown): Array<Record<string, unknown>> {
  const value = expectWindowOk(result);
  expect(Array.isArray(value), `期望条目列表为数组，实际 ${String(value)}`).toBe(true);
  return value as Array<Record<string, unknown>>;
}

/** 键面条目身份（key 序）。 */
function keysOf(result: unknown): string[] {
  return entriesOf(result).map((entry) => entry.key as string);
}

/** 数组面条目身份（index 序）。 */
function indicesOf(result: unknown): number[] {
  return entriesOf(result).map((entry) => entry.index as number);
}

/** 成功面 own 键集（升序）。 */
function ownKeysOf(result: unknown): string[] {
  return Object.keys(result as object).sort();
}

/** `total` own 键在场断言（B-8；禁 JSON 判定）。 */
function totalOf(result: unknown): unknown {
  const r = result as WindowResult;
  expect(Object.prototype.hasOwnProperty.call(r, 'total'), 'B-8：成功结算 total 键恒在（own 键）').toBe(true);
  return r.total;
}

const CLAIMED = { field: 'state', equals: 'claimed' };

// ── fixture `FIX-382-A`（SA6 §12.3 逐字）─────────────────────────────────────────────

interface AccessorProbe {
  count: number;
}

const accProbe: AccessorProbe = { count: 0 };

/** `dirty.accField`：own accessor `state`（getter 计数并返回 'claimed'）+ non-enumerable `state2`。 */
function buildAccField(): Record<string, unknown> {
  const obj: Record<string, unknown> = { title: 'acc' };
  Object.defineProperty(obj, 'state', {
    enumerable: true,
    configurable: true,
    get() {
      accProbe.count += 1;
      return 'claimed';
    },
  });
  Object.defineProperty(obj, 'state2', { value: 'claimed', enumerable: false, configurable: true });
  return obj;
}

function taskChild(state: string, priority: number, title: string): Y.Map<unknown> {
  const m = new Y.Map<unknown>();
  m.set('state', state);
  m.set('priority', priority);
  m.set('title', title);
  return m;
}

function taskRecord(state: string, priority: number, title: string): Record<string, unknown> {
  return { state, priority, title };
}

/** `tasks` / `plainTasks` 的五行（key、state、priority）。 */
const TASK_ROWS: ReadonlyArray<readonly [string, string, number]> = [
  ['t1', 'claimed', 2],
  ['t2', 'done', 9],
  ['t3', 'claimed', 5],
  ['t4', 'open', 7],
  ['t5', 'claimed', 1],
];

/** `dirty` 的 claimed 命中项（唯一正常命中；其余脏条目覆盖安静不匹配矩阵）。 */
const DIRTY_CLAIMED_KEY = 'd2';

function buildWhereDoc(): Y.Doc {
  const doc = new Y.Doc();
  const root = doc.getMap('ROOT');
  accProbe.count = 0;

  // tasks（Y.Map，child 均 Y.Map；默认 orderBy = key asc）。
  const tasks = new Y.Map<unknown>();
  for (const [key, state, priority] of TASK_ROWS) tasks.set(key, taskChild(state, priority, `${key}-title`));
  root.set('tasks', tasks);

  // plainTasks（plain object 载体族同构）。
  const plainTasks: Record<string, unknown> = {};
  for (const [key, state, priority] of TASK_ROWS) plainTasks[key] = taskRecord(state, priority, `${key}-title`);
  root.set('plainTasks', plainTasks);

  // list（Y.Array，child Y.Map；index 基位置序）与 plainList。
  const list = new Y.Array<unknown>();
  list.push([taskChild('claimed', 2, 'l0'), taskChild('done', 9, 'l1'), taskChild('claimed', 5, 'l2')]);
  root.set('list', list);
  root.set('plainList', [taskRecord('claimed', 2, 'l0'), taskRecord('done', 9, 'l1'), taskRecord('claimed', 5, 'l2')]);

  // 标量元素数组面（条目值不可下钻 ⇒ 全安静不匹配）。
  const scalarArray = new Y.Array<unknown>();
  scalarArray.push([1, 2, 3]);
  root.set('scalarArray', scalarArray);
  root.set('scalarPlain', [1, 2, 3]);

  // edge：falsy 合法标量（''、false、0）。
  const edge = new Y.Map<unknown>();
  edge.set('e0', { state: '', flag: false, count: 0 });
  edge.set('e1', { state: 'x', flag: true, count: 1 });
  root.set('edge', edge);

  // dotted：点号不拆分（字面键 'a.b' vs 嵌套 a.b）。
  const dotted = new Y.Map<unknown>();
  dotted.set('c1', { 'a.b': 'v' });
  dotted.set('c2', { a: { b: 'v' } });
  root.set('dotted', dotted);

  // emptyKey：字段名空串合法字面键。
  const emptyKey = new Y.Map<unknown>();
  emptyKey.set('k', { '': 'v' });
  root.set('emptyKey', emptyKey);

  // dirty：安静不匹配矩阵（SA6 §12.3.2）。
  const dirty = new Y.Map<unknown>();
  dirty.set('d1', { state: 'done' });
  dirty.set(DIRTY_CLAIMED_KEY, { state: 'claimed' });
  dirty.set('sNum', 42);
  dirty.set('sStr', 'claimed');
  dirty.set('sNull', null);
  dirty.set('sBool', true);
  dirty.set('sArr', [1, 2]);
  dirty.set('nanState', { state: Number.NaN });
  dirty.set('infState', { state: Number.POSITIVE_INFINITY });
  dirty.set('nInfState', { state: Number.NEGATIVE_INFINITY });
  const cymInner = new Y.Map<unknown>();
  cymInner.set('k', 'v');
  const cym = new Y.Map<unknown>();
  cym.set('state', cymInner);
  dirty.set('cym', cym);
  dirty.set('cpo', { state: { x: 1 } });
  dirty.set('carr', { state: [1, 2] });
  dirty.set('nullState', { state: null });
  dirty.set('nullState2', { state: null });
  dirty.set('absentState', { title: 'x' });
  dirty.set('undefState', { state: undefined });
  dirty.set('accField', buildAccField());
  root.set('dirty', dirty);

  // 零物化哨兵（AC5）：未匹配条目内埋毒值 / 稀疏空洞。
  const poisonArr = new Y.Array<unknown>();
  {
    const values: unknown[] = [];
    for (let i = 0; i < 1998; i += 1) values.push(Number.NaN);
    values.push({ state: 'claimed', priority: 1 });
    values.push({ state: 'claimed', priority: 2 });
    poisonArr.push(values);
  }
  root.set('poisonArr', poisonArr);

  const poisonMap = new Y.Map<unknown>();
  for (let i = 0; i < 1998; i += 1) poisonMap.set(`p${i}`, Number.NaN);
  poisonMap.set('p1998', { state: 'claimed', priority: 1 });
  poisonMap.set('p1999', { state: 'claimed', priority: 2 });
  root.set('poisonMap', poisonMap);

  const sparseArr: unknown[] = [];
  sparseArr.length = 1998;
  sparseArr[1998] = { state: 'claimed', priority: 1 };
  sparseArr[1999] = { state: 'claimed', priority: 2 };
  root.set('sparseArr', sparseArr);

  const poisonRecArr: unknown[] = [];
  for (let i = 0; i < 1998; i += 1) poisonRecArr.push({ state: 'done', payload: Number.NaN });
  poisonRecArr.push({ state: 'claimed', priority: 1 });
  poisonRecArr.push({ state: 'claimed', priority: 2 });
  root.set('poisonRecArr', poisonRecArr);

  const poisonPayloadMap: Record<string, unknown> = {};
  for (let i = 0; i < 1998; i += 1) poisonPayloadMap[`p${i}`] = { state: 'done', payload: Number.NaN };
  poisonPayloadMap.m1 = { state: 'claimed', priority: 1 };
  poisonPayloadMap.m2 = { state: 'claimed', priority: 2 };
  root.set('poisonPayloadMap', poisonPayloadMap);

  const poisonHoleArr: unknown[] = [];
  for (let i = 0; i < 1998; i += 1) {
    const inner: unknown[] = [];
    inner[1] = 1; // 嵌套稀疏空洞（谓词只下钻 state 单段，绝不整项物化/递归）
    poisonHoleArr.push({ state: 'done', inner });
  }
  poisonHoleArr.push({ state: 'claimed', priority: 1 });
  poisonHoleArr.push({ state: 'claimed', priority: 2 });
  root.set('poisonHoleArr', poisonHoleArr);

  const poisonScored = new Y.Array<unknown>();
  {
    const values: unknown[] = [30, 10];
    for (let i = 2; i < 2000; i += 1) values.push(Number.NaN);
    poisonScored.push(values);
  }
  root.set('poisonScored', poisonScored);

  // 空容器与条目空间回归锚。
  root.set('emptyMap', new Y.Map<unknown>());
  root.set('emptyPlain', {});
  const undefKey = new Y.Map<unknown>();
  const u1 = new Y.Map<unknown>();
  u1.set('state', undefined); // 显式 undefined ≡ 缺席 ⇒ 安静不匹配
  const u2 = new Y.Map<unknown>();
  u2.set('state', 'claimed');
  undefKey.set('u1', u1);
  undefKey.set('u2', u2);
  root.set('undefKey', undefKey);

  // F4：命中项物化失败（命中项内嵌 detached 载体）——filter 位命中、物化位 fail-fast。
  const fatalArr: unknown[] = [
    { state: 'claimed', title: 'fatal', inner: new Y.Map<unknown>() },
    { state: 'claimed', priority: 1 },
  ];
  root.set('fatalArr', fatalArr);

  return doc;
}

// ── 独立预言机（native/Yjs 直数，零实现复用）────────────────────────────────────────

/** 路径终点解析（只经原生 `get`，不消费任何实现导出）。 */
function resolveTarget(doc: Y.Doc, path: Path): unknown {
  let cur: unknown = doc.getMap('ROOT');
  for (const seg of path) cur = (cur as Y.Map<unknown>).get(seg as string);
  return cur;
}

/** 数组面标识计数预言机：宿主 `length`（Y.Array / plain array 同式；空洞计入）。 */
function arrayOracle(doc: Y.Doc, path: Path): number {
  return (resolveTarget(doc, path) as { length: number }).length;
}

/** 键面标识计数预言机：Y.Map = 非 undefined 值键数；plain object = own-enumerable data 且值非 undefined。 */
function mapOracle(doc: Y.Doc, path: Path): number {
  const target = resolveTarget(doc, path);
  if (target instanceof Y.Map) {
    return [...target.keys()].filter((key) => target.get(key) !== undefined).length;
  }
  const record = target as Record<string, unknown>;
  return Object.keys(record).filter((key) => {
    const desc = Object.getOwnPropertyDescriptor(record, key);
    return desc !== undefined && desc.enumerable === true && desc.get === undefined && desc.value !== undefined;
  }).length;
}

/** 单段字面键原生下钻（Y.Map `get` / plain own-enumerable data descriptor）。 */
function readFieldNative(child: unknown, field: string): unknown {
  if (child instanceof Y.Map) return child.get(field);
  if (child !== null && typeof child === 'object' && !(child instanceof Y.AbstractType) && !Array.isArray(child)) {
    const desc = Object.getOwnPropertyDescriptor(child as Record<string, unknown>, field);
    if (desc === undefined || desc.enumerable !== true) return undefined;
    if (desc.get !== undefined || desc.set !== undefined) return undefined;
    return desc.value;
  }
  return undefined;
}

/** 标量闭集严格等值（`undefined` 恒不匹配；`Number.isFinite` 门；类型门 `true ≠ 1`）。 */
function equalsNative(value: unknown, equals: unknown): boolean {
  if (value === undefined) return false;
  if (equals === null) return value === null;
  if (typeof value !== typeof equals) return false;
  if (typeof value === 'number') return Number.isFinite(value) && value === equals;
  if (typeof value === 'string' || typeof value === 'boolean') return value === equals;
  return false;
}

/** plain array / Y.Array 下标原生读（descriptor；空洞/undefined/accessor → 不可读）。 */
function readElementNative(target: unknown, index: number): { ok: boolean; value?: unknown } {
  if (target instanceof Y.Array) {
    if (index >= target.length) return { ok: false };
    const value = target.get(index);
    return value === undefined ? { ok: false } : { ok: true, value };
  }
  const arr = target as unknown[];
  if (index >= arr.length) return { ok: false };
  const desc = Object.getOwnPropertyDescriptor(arr, index);
  if (desc === undefined || desc.get !== undefined || desc.value === undefined) return { ok: false };
  return { ok: true, value: desc.value };
}

/** 数组面匹配预言机：位置序（下标 asc），零实现复用。 */
function arrayMatchesOracle(doc: Y.Doc, path: Path, field: string, equals: unknown): number[] {
  const target = resolveTarget(doc, path);
  const total = (target as { length: number }).length;
  const out: number[] = [];
  for (let i = 0; i < total; i += 1) {
    const hit = readElementNative(target, i);
    if (!hit.ok) continue;
    if (equalsNative(readFieldNative(hit.value, field), equals)) out.push(i);
  }
  return out;
}

/** 键面匹配预言机：候选为标识计数口径键集（与实现同源的是**数据**，非实现代码）。 */
function mapMatchesOracle(doc: Y.Doc, path: Path, field: string, equals: unknown): string[] {
  const target = resolveTarget(doc, path);
  const out: string[] = [];
  if (target instanceof Y.Map) {
    for (const key of target.keys()) {
      const child = target.get(key);
      if (child === undefined) continue;
      if (equalsNative(readFieldNative(child, field), equals)) out.push(key);
    }
    return out;
  }
  const record = target as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const desc = Object.getOwnPropertyDescriptor(record, key);
    if (desc === undefined || desc.enumerable !== true || desc.get !== undefined || desc.value === undefined) continue;
    if (equalsNative(readFieldNative(desc.value, field), equals)) out.push(key);
  }
  return out;
}

// ═════════════════════ C 组合正确性矩阵（AC1；HEAD 红 → 目标绿） ═════════════════════

describe('C 合取正确性矩阵（AC1；ADR 0029 §2/§4）', () => {
  it('C1 键面 where：Y.Map 载体按 state=claimed 过滤，键序 t1,t3,t5，total own 键在场且 undefined', () => {
    const doc = buildWhereDoc();
    const result = mapWindow()(doc, ['tasks'], { n: 5, where: [CLAIMED] });
    expect(keysOf(result)).toEqual(['t1', 't3', 't5']);
    // 独立预言机对账（native/Yjs 直数派生期望）
    expect(keysOf(result)).toEqual(mapMatchesOracle(doc, ['tasks'], 'state', 'claimed'));
    for (const entry of entriesOf(result)) {
      expect((entry.value as { state?: unknown }).state).toBe('claimed');
    }
    expect(totalOf(result)).toBeUndefined();
    expect(ownKeysOf(result)).toEqual(['ok', 'total', 'value']);
  });

  it('C2 plain object 载体族同构（state=claimed 过滤同 C1）', () => {
    const doc = buildWhereDoc();
    const result = mapWindow()(doc, ['plainTasks'], { n: 5, where: [CLAIMED] });
    expect(keysOf(result)).toEqual(['t1', 't3', 't5']);
    expect(keysOf(result)).toEqual(mapMatchesOracle(doc, ['plainTasks'], 'state', 'claimed'));
    expect(totalOf(result)).toBeUndefined();
  });

  it('C3 数组面 where：Y.Array 载体位置序过滤（index 0,2）', () => {
    const doc = buildWhereDoc();
    const result = arrayWindow()(doc, ['list'], { n: 5, where: [CLAIMED] });
    expect(indicesOf(result)).toEqual([0, 2]);
    expect(indicesOf(result)).toEqual(arrayMatchesOracle(doc, ['list'], 'state', 'claimed'));
    expect(totalOf(result)).toBeUndefined();
    expect(ownKeysOf(result)).toEqual(['ok', 'total', 'value']);
  });

  it('C4 plain array 载体族同构（index 0,2）', () => {
    const doc = buildWhereDoc();
    const result = arrayWindow()(doc, ['plainList'], { n: 5, where: [CLAIMED] });
    expect(indicesOf(result)).toEqual([0, 2]);
    expect(totalOf(result)).toBeUndefined();
  });

  it('C5 falsy 合法标量：equals \'\' / false / 0 均合法且命中 e0（零 truthiness 校验）', () => {
    const doc = buildWhereDoc();
    expect(keysOf(mapWindow()(doc, ['edge'], { n: 5, where: [{ field: 'state', equals: '' }] }))).toEqual(['e0']);
    expect(keysOf(mapWindow()(doc, ['edge'], { n: 5, where: [{ field: 'flag', equals: false }] }))).toEqual(['e0']);
    expect(keysOf(mapWindow()(doc, ['edge'], { n: 5, where: [{ field: 'count', equals: 0 }] }))).toEqual(['e0']);
  });

  it('C6 标量类型门：equals true 命中 e1；类型不符（true ≠ 1）不命中', () => {
    const doc = buildWhereDoc();
    expect(keysOf(mapWindow()(doc, ['edge'], { n: 5, where: [{ field: 'flag', equals: true }] }))).toEqual(['e1']);
    expect(keysOf(mapWindow()(doc, ['edge'], { n: 5, where: [{ field: 'count', equals: 1 }] }))).toEqual(['e1']);
    // 严格 === 零强制转换：字段 flag 的真值为 boolean true，equals 1（number）不匹配。
    expect(keysOf(mapWindow()(doc, ['edge'], { n: 5, where: [{ field: 'flag', equals: 1 }] }))).toEqual([]);
  });

  it("C7 单段字面键：点号不拆分（field 'a.b' 命中 c1；field 'b' 零命中）", () => {
    const doc = buildWhereDoc();
    expect(keysOf(mapWindow()(doc, ['dotted'], { n: 5, where: [{ field: 'a.b', equals: 'v' }] }))).toEqual(['c1']);
    expect(keysOf(mapWindow()(doc, ['dotted'], { n: 5, where: [{ field: 'b', equals: 'v' }] }))).toEqual([]);
  });

  it('C8 where 不触碰 orderBy 面词表：三向语境外排序项仍 WINDOW_OPTIONS_INVALID（F4）', () => {
    const doc = buildWhereDoc();
    expectWindowErr(
      arrayWindow()(doc, ['list'], { n: 2, where: [CLAIMED], orderBy: { field: 'state' } }),
      'WINDOW_OPTIONS_INVALID',
    );
    expectWindowErr(
      arrayWindow()(doc, ['list'], { n: 2, where: [CLAIMED], orderBy: { by: 'key' } }),
      'WINDOW_OPTIONS_INVALID',
    );
    expectWindowErr(
      mapWindow()(doc, ['tasks'], { n: 2, where: [CLAIMED], orderBy: { by: 'index' } }),
      'WINDOW_OPTIONS_INVALID',
    );
  });

  it('C9 空串字段名合法字面键（emptyKey：field \'\' 命中 k）', () => {
    const doc = buildWhereDoc();
    expect(keysOf(mapWindow()(doc, ['emptyKey'], { n: 5, where: [{ field: '', equals: 'v' }] }))).toEqual(['k']);
  });

  it('C10 null 原型链 WhereTerm 合法（plain 链含 null 原型）', () => {
    const doc = buildWhereDoc();
    const term = Object.assign(Object.create(null) as Record<string, unknown>, { field: 'state', equals: 'claimed' });
    expect(keysOf(mapWindow()(doc, ['tasks'], { n: 5, where: [term] }))).toEqual(['t1', 't3', 't5']);
  });

  it('C11 显式 undefined 字段值 ≡ 缺席（undefKey 恰 u2）', () => {
    const doc = buildWhereDoc();
    expect(keysOf(mapWindow()(doc, ['undefKey'], { n: 5, where: [CLAIMED] }))).toEqual(['u2']);
  });
});

// ═════════════════════ D 安静不匹配矩阵（AC2；ADR 0029 §3） ═════════════════════

describe('D 安静不匹配矩阵（AC2；ADR 0029 §3：脏项不炸读、不挤掉正常项）', () => {
  it('D1 脏矩阵 n=50：恰 d2 命中（脏条目零挤出、零响亮失败）', () => {
    const doc = buildWhereDoc();
    const result = mapWindow()(doc, ['dirty'], { n: 50, where: [CLAIMED] });
    expect(keysOf(result)).toEqual([DIRTY_CLAIMED_KEY]);
    expect(totalOf(result)).toBeUndefined();
  });

  it("D2 equals 'done'：恰 d1；标量条目（sStr='claimed'）不匹配任何 equals", () => {
    const doc = buildWhereDoc();
    const result = mapWindow()(doc, ['dirty'], { n: 50, where: [{ field: 'state', equals: 'done' }] });
    expect(keysOf(result)).toEqual(['d1']);
    expect(keysOf(result)).not.toContain('sStr');
  });

  it('D3 equals null：恰 nullState/nullState2（在场 null 匹配；缺席/显式 undefined 不匹配）', () => {
    const doc = buildWhereDoc();
    const result = mapWindow()(doc, ['dirty'], { n: 50, where: [{ field: 'state', equals: null }] });
    expect(keysOf(result)).toEqual(['nullState', 'nullState2']);
    expect(keysOf(result)).toEqual(mapMatchesOracle(doc, ['dirty'], 'state', null));
    expect(keysOf(result)).not.toContain('absentState');
    expect(keysOf(result)).not.toContain('undefState');
    expect(keysOf(result)).not.toContain('sNull');
  });

  it('D4 field 值 non-finite（NaN/+∞/-∞）一律安静不匹配', () => {
    const doc = buildWhereDoc();
    const keys = keysOf(mapWindow()(doc, ['dirty'], { n: 50, where: [CLAIMED] }));
    for (const poison of ['nanState', 'infState', 'nInfState']) expect(keys).not.toContain(poison);
  });

  it('D5 field 值非标量（Y.Map / plain object / array）一律安静不匹配', () => {
    const doc = buildWhereDoc();
    const keys = keysOf(mapWindow()(doc, ['dirty'], { n: 50, where: [CLAIMED] }));
    for (const poison of ['cym', 'cpo', 'carr']) expect(keys).not.toContain(poison);
  });

  it('D6 条目值非可下钻对象（标量条目：number/string/null/boolean/array）一律安静不匹配', () => {
    const doc = buildWhereDoc();
    const keys = keysOf(mapWindow()(doc, ['dirty'], { n: 50, where: [CLAIMED] }));
    for (const poison of ['sNum', 'sStr', 'sNull', 'sBool', 'sArr']) expect(keys).not.toContain(poison);
  });

  it('D7 accessor 字段安静不匹配且零执行（计数器 === 0）；non-enumerable 字段不参与', () => {
    const doc = buildWhereDoc();
    expect(accProbe.count, '契约前提：装配期零 accessor 执行').toBe(0);
    const keys = keysOf(mapWindow()(doc, ['dirty'], { n: 50, where: [CLAIMED] }));
    expect(keys).not.toContain('accField');
    expect(accProbe.count, '零 accessor 执行纪律（ADR 0029 §6）').toBe(0);
    // non-enumerable `state2` 出字段空间（descriptor 读不查 non-enumerable）。
    expect(keysOf(mapWindow()(doc, ['dirty'], { n: 50, where: [{ field: 'state2', equals: 'claimed' }] }))).toEqual([]);
    expect(accProbe.count).toBe(0);
  });

  it('D8 标量元素数组面：全安静不匹配（ok:true, value: []），不响亮失败', () => {
    const doc = buildWhereDoc();
    const result = arrayWindow()(doc, ['scalarArray'], { n: 5, where: [CLAIMED] });
    expect(expectWindowOk(result)).toStrictEqual([]);
    expect(totalOf(result)).toBeUndefined();
  });

  it('D9 稀疏 plain array：空洞安静跳过、不物化，恰 1998/1999 命中', () => {
    const doc = buildWhereDoc();
    const result = arrayWindow()(doc, ['sparseArr'], { n: 5, where: [CLAIMED] });
    expect(indicesOf(result)).toEqual([1998, 1999]);
    expect(indicesOf(result)).toEqual(arrayMatchesOracle(doc, ['sparseArr'], 'state', 'claimed'));
  });

  it('D10 空容器（Y.Map / plain object）：ok:true + value []', () => {
    const doc = buildWhereDoc();
    expect(expectWindowOk(mapWindow()(doc, ['emptyMap'], { n: 5, where: [CLAIMED] }))).toStrictEqual([]);
    expect(expectWindowOk(mapWindow()(doc, ['emptyPlain'], { n: 5, where: [CLAIMED] }))).toStrictEqual([]);
  });

  it('D11 同 field 重复项 AND 自然收敛（claimed ∧ done → 空，不响亮）', () => {
    const doc = buildWhereDoc();
    const result = mapWindow()(doc, ['dirty'], {
      n: 50,
      where: [CLAIMED, { field: 'state', equals: 'done' }],
    });
    expect(expectWindowOk(result)).toStrictEqual([]);
    expect(totalOf(result)).toBeUndefined();
  });

  it('D12 四载体 × 零匹配：全 ok:true + value [] + total undefined', () => {
    const doc = buildWhereDoc();
    const results: unknown[] = [
      arrayWindow()(doc, ['scalarArray'], { n: 5, where: [CLAIMED] }),
      arrayWindow()(doc, ['scalarPlain'], { n: 5, where: [CLAIMED] }),
      mapWindow()(doc, ['dirty'], { n: 50, where: [{ field: 'state', equals: 'nonexistent' }] }),
      mapWindow()(doc, ['emptyMap'], { n: 5, where: [CLAIMED] }),
      mapWindow()(doc, ['emptyPlain'], { n: 5, where: [CLAIMED] }),
    ];
    for (const result of results) {
      expect(expectWindowOk(result)).toStrictEqual([]);
      expect(totalOf(result)).toBeUndefined();
    }
  });
});

// ═════════════════════ V 入参侧响亮（AC3/AC4；HEAD 伪绿 → 实现后变异守卫） ═════════════════════

describe('V 入参侧响亮（AC3/AC4；一律 WINDOW_OPTIONS_INVALID、零外抛）', () => {
  it('V1 空数组非法（「要全集」= 不传 where）', () => {
    const doc = buildWhereDoc();
    expectWindowErr(mapWindow()(doc, ['tasks'], { n: 5, where: [] }), 'WINDOW_OPTIONS_INVALID');
  });

  it('V2 17 项超上限 16 非法', () => {
    const doc = buildWhereDoc();
    const terms = Array.from({ length: 17 }, (_, i) => ({ field: `f${i}`, equals: 'x' }));
    expectWindowErr(mapWindow()(doc, ['tasks'], { n: 5, where: terms }), 'WINDOW_OPTIONS_INVALID');
  });

  it('V3 反向边界：恰 16 项合法（校验器不是「见 where 即拒」）→ ok:true, value []', () => {
    const doc = buildWhereDoc();
    const terms = Array.from({ length: 16 }, (_, i) => ({ field: `f${i}`, equals: 'x' }));
    const result = mapWindow()(doc, ['tasks'], { n: 5, where: terms });
    expect(expectWindowOk(result)).toStrictEqual([]);
    expect(totalOf(result)).toBeUndefined();
  });

  it('V4 equals number 非 finite（NaN / +∞ / -∞）一律非法', () => {
    const doc = buildWhereDoc();
    for (const equals of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expectWindowErr(mapWindow()(doc, ['tasks'], { n: 5, where: [{ field: 'state', equals }] }), 'WINDOW_OPTIONS_INVALID');
    }
  });

  it('V5 equals 闭集外类型（object/array/bigint/symbol/function/Date/Map）一律非法', () => {
    const doc = buildWhereDoc();
    const outOfSet: unknown[] = [{}, [1], 1n, Symbol('s'), () => 1, new Date(0), new Map()];
    for (const equals of outOfSet) {
      expectWindowErr(
        mapWindow()(doc, ['tasks'], { n: 5, where: [{ field: 'state', equals }] }),
        'WINDOW_OPTIONS_INVALID',
      );
    }
  });

  it('V6 equals 缺失 / 显式 undefined 非法（形状漂移，无 present-undefined 豁免）', () => {
    const doc = buildWhereDoc();
    expectWindowErr(mapWindow()(doc, ['tasks'], { n: 5, where: [{ field: 'state' }] }), 'WINDOW_OPTIONS_INVALID');
    expectWindowErr(
      mapWindow()(doc, ['tasks'], { n: 5, where: [{ field: 'state', equals: undefined }] }),
      'WINDOW_OPTIONS_INVALID',
    );
  });

  it('V7 field 缺失 / 显式 undefined 非法', () => {
    const doc = buildWhereDoc();
    expectWindowErr(mapWindow()(doc, ['tasks'], { n: 5, where: [{ equals: 'claimed' }] }), 'WINDOW_OPTIONS_INVALID');
    expectWindowErr(
      mapWindow()(doc, ['tasks'], { n: 5, where: [{ field: undefined, equals: 'claimed' }] }),
      'WINDOW_OPTIONS_INVALID',
    );
  });

  it('V8 field 非 string 非法且零强制转换（不得调 toString）', () => {
    const doc = buildWhereDoc();
    const coercible = {
      calls: 0,
      toString() {
        this.calls += 1;
        return 'state';
      },
    };
    expectWindowErr(mapWindow()(doc, ['tasks'], { n: 5, where: [{ field: 1, equals: 'claimed' }] }), 'WINDOW_OPTIONS_INVALID');
    expectWindowErr(
      mapWindow()(doc, ['tasks'], { n: 5, where: [{ field: Symbol('state'), equals: 'claimed' }] }),
      'WINDOW_OPTIONS_INVALID',
    );
    expectWindowErr(
      mapWindow()(doc, ['tasks'], { n: 5, where: [{ field: coercible, equals: 'claimed' }] }),
      'WINDOW_OPTIONS_INVALID',
    );
    expect(coercible.calls, '零强制转换纪律：绝不调 toString').toBe(0);
  });

  it('V9 WhereTerm 未知键非法（含 present-undefined 未知键）', () => {
    const doc = buildWhereDoc();
    expectWindowErr(
      mapWindow()(doc, ['tasks'], { n: 5, where: [{ field: 'state', equals: 'claimed', extra: 1 }] }),
      'WINDOW_OPTIONS_INVALID',
    );
    expectWindowErr(
      mapWindow()(doc, ['tasks'], { n: 5, where: [{ field: 'state', equals: 'claimed', extra: undefined }] }),
      'WINDOW_OPTIONS_INVALID',
    );
  });

  it('V10 WhereTerm 非 plain 原型（class 实例 / 数组 / Map / 函数）非法', () => {
    const doc = buildWhereDoc();
    class Term {
      field = 'state';
      equals = 'claimed';
    }
    const terms: unknown[] = [new Term(), ['state', 'claimed'], new Map([['field', 'state']]), () => 1];
    for (const term of terms) {
      expectWindowErr(mapWindow()(doc, ['tasks'], { n: 5, where: [term] }), 'WINDOW_OPTIONS_INVALID');
    }
  });

  it('V11 where 数组下标 accessor 非法且零执行（计数器 === 0）', () => {
    const doc = buildWhereDoc();
    const probe = { count: 0 };
    const terms: unknown[] = [];
    terms.length = 1;
    Object.defineProperty(terms, 0, {
      enumerable: true,
      configurable: true,
      get() {
        probe.count += 1;
        return { field: 'state', equals: 'claimed' };
      },
    });
    expectWindowErr(mapWindow()(doc, ['tasks'], { n: 5, where: terms }), 'WINDOW_OPTIONS_INVALID');
    expect(probe.count, '零 accessor 执行纪律（ADR 0029 §6）').toBe(0);
  });

  it('V12 where 数组含空洞非法（非 undefined continue）', () => {
    const doc = buildWhereDoc();
    const terms: unknown[] = [];
    terms.length = 1;
    expectWindowErr(mapWindow()(doc, ['tasks'], { n: 5, where: terms }), 'WINDOW_OPTIONS_INVALID');
  });

  it('V13 WhereTerm Proxy 四 trap 抛异常：响亮 ∧ 零外抛', () => {
    const doc = buildWhereDoc();
    const target = { field: 'state', equals: 'claimed' };
    const hostile = new Proxy(target, {
      get() {
        throw new Error('hostile get');
      },
      ownKeys() {
        throw new Error('hostile ownKeys');
      },
      getOwnPropertyDescriptor() {
        throw new Error('hostile getOwnPropertyDescriptor');
      },
      getPrototypeOf() {
        throw new Error('hostile getPrototypeOf');
      },
    });
    let result: unknown;
    let escaped: unknown;
    try {
      result = mapWindow()(doc, ['tasks'], { n: 5, where: [hostile] });
    } catch (error) {
      escaped = error;
    }
    expect(escaped, 'trap 异常必须收编，绝不外抛').toBeUndefined();
    expectWindowErr(result, 'WINDOW_OPTIONS_INVALID');
  });

  it('V14 options Proxy 四 trap 抛异常：响亮 ∧ 零外抛', () => {
    const doc = buildWhereDoc();
    const hostile = new Proxy(
      { n: 5, where: [CLAIMED] },
      {
        get() {
          throw new Error('hostile get');
        },
        ownKeys() {
          throw new Error('hostile ownKeys');
        },
        getOwnPropertyDescriptor() {
          throw new Error('hostile getOwnPropertyDescriptor');
        },
        getPrototypeOf() {
          throw new Error('hostile getPrototypeOf');
        },
      },
    );
    let result: unknown;
    let escaped: unknown;
    try {
      result = mapWindow()(doc, ['tasks'], hostile as WindowOptions);
    } catch (error) {
      escaped = error;
    }
    expect(escaped, 'trap 异常必须收编，绝不外抛').toBeUndefined();
    expectWindowErr(result, 'WINDOW_OPTIONS_INVALID');
  });

  it('V15 options.where 为 own accessor：非法且零 [[Get]]（计数器 === 0）', () => {
    const doc = buildWhereDoc();
    const probe = { count: 0 };
    const options: Record<string, unknown> = { n: 5 };
    Object.defineProperty(options, 'where', {
      enumerable: true,
      configurable: true,
      get() {
        probe.count += 1;
        return [CLAIMED];
      },
    });
    expectWindowErr(mapWindow()(doc, ['tasks'], options), 'WINDOW_OPTIONS_INVALID');
    expect(probe.count, '零 [[Get]]/零 accessor 执行纪律').toBe(0);
  });

  it('V16 where 非数组（string/object/null/number/[undefined]/[null]/Y.Array）非法', () => {
    const doc = buildWhereDoc();
    const notArrays: unknown[] = ['claimed', { field: 'state', equals: 'claimed' }, null, 42, [undefined], [null], new Y.Array<unknown>()];
    for (const where of notArrays) {
      expectWindowErr(mapWindow()(doc, ['tasks'], { n: 5, where }), 'WINDOW_OPTIONS_INVALID');
    }
  });

  it('V17 n 非法 + 合法 where：一律 WINDOW_OPTIONS_INVALID（n 纪律不因 where 放宽）', () => {
    const doc = buildWhereDoc();
    const badN: unknown[] = [undefined, 0, -0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '1'];
    for (const n of badN) {
      expectWindowErr(mapWindow()(doc, ['tasks'], { n, where: [CLAIMED] }), 'WINDOW_OPTIONS_INVALID');
    }
  });

  it('V18 where + 语境外 orderBy：三向 WINDOW_OPTIONS_INVALID（F4；过滤与排序正交）', () => {
    const doc = buildWhereDoc();
    expectWindowErr(
      arrayWindow()(doc, ['list'], { n: 1, where: [CLAIMED], orderBy: { field: 'state' } }),
      'WINDOW_OPTIONS_INVALID',
    );
    expectWindowErr(
      arrayWindow()(doc, ['list'], { n: 1, where: [CLAIMED], orderBy: { by: 'key' } }),
      'WINDOW_OPTIONS_INVALID',
    );
    expectWindowErr(
      mapWindow()(doc, ['tasks'], { n: 1, where: [CLAIMED], orderBy: { by: 'index' } }),
      'WINDOW_OPTIONS_INVALID',
    );
  });

  it('V19 顶层未知键 + 合法 where：WINDOW_OPTIONS_INVALID（options 封闭形状不回退）', () => {
    const doc = buildWhereDoc();
    expectWindowErr(mapWindow()(doc, ['tasks'], { n: 5, where: [CLAIMED], bogus: 1 }), 'WINDOW_OPTIONS_INVALID');
  });

  it('V20 反向边界：where: undefined（own 键、值 undefined）≡ 缺席 → ok:true、不过滤、total 数值', () => {
    const doc = buildWhereDoc();
    const result = mapWindow()(doc, ['tasks'], { n: 2, where: undefined });
    expect(keysOf(result)).toEqual(['t1', 't2']);
    expect(totalOf(result)).toBe(5);
    expect(ownKeysOf(result)).toEqual(['ok', 'total', 'value']);
  });

  it('V21 非法 where + 缺席路径：OPT 先于 N0/N1 → WINDOW_OPTIONS_INVALID（不报 WINDOW_TARGET_ABSENT）', () => {
    const doc = buildWhereDoc();
    expectWindowErr(mapWindow()(doc, ['nope'], { n: 1, where: [] }), 'WINDOW_OPTIONS_INVALID');
  });
});

// ═════════════════════ P 管线序 where → orderBy → n（ADR 0029 §4） ═════════════════════

describe('P 管线序 where → orderBy → n（匹配子集上选窗）', () => {
  it('P1 field desc n=2：匹配集总序前缀 t3(5), t1(2)（「排序→取 n→过滤」变异必红）', () => {
    const doc = buildWhereDoc();
    const result = mapWindow()(doc, ['tasks'], {
      n: 2,
      where: [CLAIMED],
      orderBy: { field: 'priority', dir: 'desc' },
    });
    expect(entriesOf(result).map((entry) => `${entry.key}(${(entry.value as { priority: number }).priority})`))
      .toEqual(['t3(5)', 't1(2)']);
    expect(totalOf(result)).toBeUndefined();
  });

  it('P2 field asc n=3：t5(1), t1(2), t3(5)（dir 只翻组内序、平局锚 key asc 恒定）', () => {
    const doc = buildWhereDoc();
    const result = mapWindow()(doc, ['tasks'], {
      n: 3,
      where: [CLAIMED],
      orderBy: { field: 'priority', dir: 'asc' },
    });
    expect(keysOf(result)).toEqual(['t5', 't1', 't3']);
  });

  it('P3 位置序 desc n=1：恰 index 2（自尾部取匹配前缀）', () => {
    const doc = buildWhereDoc();
    const result = arrayWindow()(doc, ['list'], {
      n: 1,
      where: [CLAIMED],
      orderBy: { by: 'index', dir: 'desc' },
    });
    expect(indicesOf(result)).toEqual([2]);
  });

  it('P4 合取跨字段（state=claimed ∧ priority=5）：恰 t3', () => {
    const doc = buildWhereDoc();
    const result = mapWindow()(doc, ['tasks'], {
      n: 5,
      where: [CLAIMED, { field: 'priority', equals: 5 }],
    });
    expect(keysOf(result)).toEqual(['t3']);
  });

  it('P5 n 三向：匹配集恒定、前缀长度 = min(n, matches)、total 恒 undefined', () => {
    const doc = buildWhereDoc();
    const lengths: number[] = [];
    for (const n of [5, 1, 99]) {
      const result = mapWindow()(doc, ['tasks'], { n, where: [CLAIMED] });
      lengths.push(entriesOf(result).length);
      expect(totalOf(result)).toBeUndefined();
    }
    expect(lengths).toEqual([3, 1, 3]);
  });
});

// ═════════════════════ T total 双形态（AC6；ADR 0029 §5） ═════════════════════

describe('T total 双形态（无 where = 标识计数；有 where = own 键在场且 undefined）', () => {
  it('T1 无 where：own 键集恰三键、total = 独立预言机计数、value.length = min(n,total)', () => {
    const doc = buildWhereDoc();
    for (const n of [5, 2]) {
      const result = mapWindow()(doc, ['tasks'], { n });
      expect(totalOf(result)).toBe(mapOracle(doc, ['tasks']));
      expect(totalOf(result)).toBe(5);
      expect(entriesOf(result).length).toBe(Math.min(n, 5));
      expect(ownKeysOf(result)).toEqual(['ok', 'total', 'value']);
    }
  });

  it('T2 无 where 数组面：total = length 预言机；desc 位置序条目 2,1', () => {
    const doc = buildWhereDoc();
    const result = arrayWindow()(doc, ['list'], { n: 5 });
    expect(totalOf(result)).toBe(arrayOracle(doc, ['list']));
    expect(totalOf(result)).toBe(3);
    const desc = arrayWindow()(doc, ['list'], { n: 2, orderBy: { by: 'index', dir: 'desc' } });
    expect(indicesOf(desc)).toEqual([2, 1]);
    expect(totalOf(desc)).toBe(3);
  });

  it('T3 无 where 零物化哨兵：poisonScored n=2 → ok:true, total = 2000', () => {
    const doc = buildWhereDoc();
    const result = arrayWindow()(doc, ['poisonScored'], { n: 2 });
    expect(indicesOf(result)).toEqual([0, 1]);
    expect(totalOf(result)).toBe(2000);
  });

  it('T4/T6 有 where（matches ≥ n）：total own 键在场且 undefined；成功面 own 键集恰三键', () => {
    const doc = buildWhereDoc();
    const result = mapWindow()(doc, ['tasks'], { n: 2, where: [CLAIMED] });
    expect(Object.prototype.hasOwnProperty.call(result as object, 'total')).toBe(true);
    expect(totalOf(result)).toBeUndefined();
    expect(ownKeysOf(result)).toEqual(['ok', 'total', 'value']);
  });

  it('T5 有 where（matches < n 与 0 匹配）：total 同样 own 键在场且 undefined（恒不承诺）', () => {
    const doc = buildWhereDoc();
    const few = mapWindow()(doc, ['tasks'], { n: 5, where: [CLAIMED] });
    expect(entriesOf(few).length).toBe(3);
    expect(totalOf(few)).toBeUndefined();
    const none = mapWindow()(doc, ['emptyMap'], { n: 5, where: [CLAIMED] });
    expect(entriesOf(none).length).toBe(0);
    expect(totalOf(none)).toBeUndefined();
  });
});

// ═════════════════════ Z 零物化哨兵（AC5；ADR 0028 §8 × ADR 0029 §3） ═════════════════════

describe('Z 零物化哨兵（未匹配条目内埋毒值/空洞必须 ok:true）', () => {
  it('Z1 Y.Array：1998 个 NaN 标量 + 尾部 2 命中 → 恰 1998,1999', () => {
    const doc = buildWhereDoc();
    const result = arrayWindow()(doc, ['poisonArr'], { n: 5, where: [CLAIMED] });
    expect(indicesOf(result)).toEqual([1998, 1999]);
    expect(totalOf(result)).toBeUndefined();
  });

  it('Z2 Y.Map：1998 个 NaN 值键 + p1998/p1999 命中 → 恰两条', () => {
    const doc = buildWhereDoc();
    const result = mapWindow()(doc, ['poisonMap'], { n: 5, where: [CLAIMED] });
    expect(keysOf(result)).toEqual(['p1998', 'p1999']);
  });

  it('Z3 稀疏 plain array：1998 空洞 + 尾部 2 命中 → 恰 1998,1999（空洞未触）', () => {
    const doc = buildWhereDoc();
    const result = arrayWindow()(doc, ['sparseArr'], { n: 5, where: [CLAIMED] });
    expect(indicesOf(result)).toEqual([1998, 1999]);
  });

  it('Z4 Y.Map 全不匹配（equals done）：ok:true, value []（NaN 值键不炸读）', () => {
    const doc = buildWhereDoc();
    const result = mapWindow()(doc, ['poisonMap'], { n: 5, where: [{ field: 'state', equals: 'done' }] });
    expect(expectWindowOk(result)).toStrictEqual([]);
  });

  it('Z5 规模 N=2000 两向（n=2/5）：命中数正确、total undefined（计数不可短路）', () => {
    const doc = buildWhereDoc();
    for (const n of [2, 5]) {
      const result = arrayWindow()(doc, ['poisonArr'], { n, where: [CLAIMED] });
      expect(indicesOf(result)).toEqual([1998, 1999]);
      expect(totalOf(result)).toBeUndefined();
    }
  });

  it('Z6 未匹配条目内埋 non-finite（payload:NaN）：恰 1998,1999（全量物化/整项深读必红）', () => {
    const doc = buildWhereDoc();
    const result = arrayWindow()(doc, ['poisonRecArr'], { n: 5, where: [CLAIMED] });
    expect(indicesOf(result)).toEqual([1998, 1999]);
  });

  it('Z7 键面同款「未匹配条目内埋毒值」：恰 m1,m2', () => {
    const doc = buildWhereDoc();
    const result = mapWindow()(doc, ['poisonPayloadMap'], { n: 5, where: [CLAIMED] });
    expect(keysOf(result)).toEqual(['m1', 'm2']);
  });

  it('Z8 未匹配条目递归内埋稀疏空洞：恰 1998,1999（谓词只下钻单段，绝不递归）', () => {
    const doc = buildWhereDoc();
    const result = arrayWindow()(doc, ['poisonHoleArr'], { n: 5, where: [CLAIMED] });
    expect(indicesOf(result)).toEqual([1998, 1999]);
  });
});

// ═════════════════════ F 失败码与冻结面（AC7；必须保持绿） ═════════════════════

describe('F 失败码与冻结面（AC7；三码语义不回归、where 不吸收缺口）', () => {
  it('F1 WINDOW_TARGET_ABSENT：终点缺键 / 中间缺键 / 数组越界（带合法 where 时同样响亮）', () => {
    const doc = buildWhereDoc();
    expectWindowErr(mapWindow()(doc, ['nope'], { n: 1, where: [CLAIMED] }), 'WINDOW_TARGET_ABSENT');
    expectWindowErr(mapWindow()(doc, ['tasks', 't1', 'nope'], { n: 1, where: [CLAIMED] }), 'WINDOW_TARGET_ABSENT');
    expectWindowErr(arrayWindow()(doc, ['list', 99], { n: 1, where: [CLAIMED] }), 'WINDOW_TARGET_ABSENT');
  });

  it('F2 WINDOW_CARRIER_MISMATCH：载体与面符不符（where 在场仍优先于过滤）', () => {
    const doc = buildWhereDoc();
    expectWindowErr(arrayWindow()(doc, ['tasks'], { n: 1, where: [CLAIMED] }), 'WINDOW_CARRIER_MISMATCH');
    expectWindowErr(mapWindow()(doc, ['list'], { n: 1, where: [CLAIMED] }), 'WINDOW_CARRIER_MISMATCH');
    expectWindowErr(mapWindow()(doc, ['tasks', 't1', 'state'], { n: 1, where: [CLAIMED] }), 'WINDOW_CARRIER_MISMATCH');
  });

  it('F3 WINDOW_OPTIONS_INVALID：where 形状非法与 n/orderBy 既有非法面同码', () => {
    const doc = buildWhereDoc();
    expectWindowErr(mapWindow()(doc, ['tasks'], { n: 1, where: [] }), 'WINDOW_OPTIONS_INVALID');
    expectWindowErr(mapWindow()(doc, ['tasks'], { n: 0, where: [CLAIMED] }), 'WINDOW_OPTIONS_INVALID');
    expectWindowErr(mapWindow()(doc, ['tasks'], { n: 1, orderBy: { field: 'x', by: 'key' } }), 'WINDOW_OPTIONS_INVALID');
  });

  it('F4 PATH_NOT_ALLOWED 透传：命中项物化失败仍 fail-fast、path 精确到项、无半窗', () => {
    const doc = buildWhereDoc();
    const failure = expectWindowErr(arrayWindow()(doc, ['fatalArr'], { n: 5, where: [CLAIMED] }), 'PATH_NOT_ALLOWED');
    expect(failure.path).toStrictEqual(['fatalArr', 0]);
    expect('value' in (failure as object)).toBe(false);
    expect('total' in (failure as object)).toBe(false);
  });

  it('F5 失败面形状：恰四键 {code,ok,path,message}，无 value/total/truncated', () => {
    const doc = buildWhereDoc();
    const failures: WindowResult[] = [
      expectWindowErr(mapWindow()(doc, ['nope'], { n: 1, where: [CLAIMED] }), 'WINDOW_TARGET_ABSENT'),
      expectWindowErr(arrayWindow()(doc, ['tasks'], { n: 1, where: [CLAIMED] }), 'WINDOW_CARRIER_MISMATCH'),
      expectWindowErr(mapWindow()(doc, ['tasks'], { n: 1, where: [] }), 'WINDOW_OPTIONS_INVALID'),
      expectWindowErr(arrayWindow()(doc, ['fatalArr'], { n: 5, where: [CLAIMED] }), 'PATH_NOT_ALLOWED'),
    ];
    for (const failure of failures) {
      expect(Object.keys(failure).sort()).toEqual(['code', 'message', 'ok', 'path']);
      expect(typeof failure.message === 'string' && failure.message.length > 0).toBe(true);
    }
  });

  it('F6 三码互异、各就各位（缺席 / 载体不符 / 规则非法）', () => {
    const doc = buildWhereDoc();
    const codes = [
      expectWindowErr(mapWindow()(doc, ['nope'], { n: 1, where: [CLAIMED] }), 'WINDOW_TARGET_ABSENT').code,
      expectWindowErr(arrayWindow()(doc, ['tasks'], { n: 1, where: [CLAIMED] }), 'WINDOW_CARRIER_MISMATCH').code,
      expectWindowErr(mapWindow()(doc, ['tasks'], { n: 1, where: [] }), 'WINDOW_OPTIONS_INVALID').code,
    ];
    expect(new Set(codes).size).toBe(3);
  });
});

// ═════════════════════ 负控组（HEAD 绿；实现后必须保持绿） ═════════════════════

describe('NC 负控（冻结面与相邻面零回归；HEAD 绿 → 实现后保持绿）', () => {
  it('NC1 无 where 成功面：own 键集恰三键、total = 标识计数（含空容器 0）', () => {
    const doc = buildWhereDoc();
    const tasks = mapWindow()(doc, ['tasks'], { n: 5 });
    expect(ownKeysOf(tasks)).toEqual(['ok', 'total', 'value']);
    expect(totalOf(tasks)).toBe(5);
    // `dirty` 全量物化必响（内含 non-finite 字段值的不可投影条目），故 n=2 只观察 total 单源：
    // 无 where 的 total 与入选物化互不影响（计数在候选枚举位，不在物化位）。
    expect(totalOf(mapWindow()(doc, ['dirty'], { n: 2 }))).toBe(mapOracle(doc, ['dirty']));
    expect(totalOf(mapWindow()(doc, ['emptyMap'], { n: 5 }))).toBe(0);
    expect(totalOf(mapWindow()(doc, ['emptyPlain'], { n: 5 }))).toBe(0);
    expect(totalOf(mapWindow()(doc, ['undefKey'], { n: 5 }))).toBe(2); // u1/u2 均在条目空间（u1 的 state 只出字段空间）
    expect(totalOf(arrayWindow()(doc, ['list'], { n: 5 }))).toBe(3);
    expect(totalOf(arrayWindow()(doc, ['scalarArray'], { n: 5 }))).toBe(3);
  });

  it('NC2 无 where value.length = min(n,total) 与排序基不变（index desc 位置序）', () => {
    const doc = buildWhereDoc();
    const asc = arrayWindow()(doc, ['list'], { n: 5 });
    expect(indicesOf(asc)).toEqual([0, 1, 2]);
    const desc = arrayWindow()(doc, ['list'], { n: 2, orderBy: { by: 'index', dir: 'desc' } });
    expect(indicesOf(desc)).toEqual([2, 1]);
    const bounded = arrayWindow()(doc, ['list'], { n: 2 });
    expect(indicesOf(bounded).length).toBe(Math.min(2, arrayOracle(doc, ['list'])));
  });

  it('NC3 无 where 零物化哨兵：poisonScored n=2 → ok:true、恰 2 条、total=2000', () => {
    const doc = buildWhereDoc();
    const result = arrayWindow()(doc, ['poisonScored'], { n: 2 });
    expect(entriesOf(result).map((entry) => entry.value)).toStrictEqual([30, 10]);
    expect(totalOf(result)).toBe(2000);
  });

  it('NC4 姊妹 readLogicalValueAtPath 冻结：无 options 恰两键；带 where → READ_OPTIONS_INVALID', () => {
    const doc = buildWhereDoc();
    const plain = readLogicalValueAtPath(doc, ['tasks']);
    expect(plain.ok).toBe(true);
    expect(Object.keys(plain as object).sort()).toEqual(['ok', 'value']);
    const withWhere = readLogicalValueAtPath(doc, ['tasks'], {
      where: [CLAIMED],
    } as unknown as ReadLogicalValueAtPathOptions);
    expect(withWhere.ok).toBe(false);
    expect((withWhere as { code?: unknown }).code).toBe('READ_OPTIONS_INVALID');
  });

  it('NC5 无 where orderBy v1 词表不变（readArray 仅 by:index；readMap 无 by:index）', () => {
    const doc = buildWhereDoc();
    expectWindowErr(arrayWindow()(doc, ['list'], { n: 1, orderBy: { field: 'state' } }), 'WINDOW_OPTIONS_INVALID');
    expectWindowErr(arrayWindow()(doc, ['list'], { n: 1, orderBy: { by: 'key' } }), 'WINDOW_OPTIONS_INVALID');
    expectWindowErr(mapWindow()(doc, ['tasks'], { n: 1, orderBy: { by: 'index' } }), 'WINDOW_OPTIONS_INVALID');
  });

  it('NC6 公共值导出面纯加法：/Window/ 恰两枚；WhereTerm 为 type-only（运行时键空间零新增）', () => {
    const windowExports = Object.keys(ns).filter((key) => /Window/.test(key)).sort();
    expect(windowExports).toEqual([ARRAY_WINDOW_EXPORT, MAP_WINDOW_EXPORT]);
    expect(Object.keys(ns)).not.toContain('WhereTerm');
  });

  it('NC7 确定性：同一 doc 同参数重复调用逐字节一致（含 where 调用）', () => {
    const doc = buildWhereDoc();
    expect(mapWindow()(doc, ['tasks'], { n: 2, where: [CLAIMED] }))
      .toStrictEqual(mapWindow()(doc, ['tasks'], { n: 2, where: [CLAIMED] }));
    expect(arrayWindow()(doc, ['list'], { n: 2 })).toStrictEqual(arrayWindow()(doc, ['list'], { n: 2 }));
  });

  it('NC8 条目空间语义不变：稀疏空洞仍计入候选但在入选物化位 fail-fast；undefined 字段值仍出字段空间', () => {
    const doc = buildWhereDoc();
    const hole = expectWindowErr(arrayWindow()(doc, ['sparseArr'], { n: 1 }), 'PATH_NOT_ALLOWED');
    expect(hole.path).toStrictEqual(['sparseArr', 0]);
    // u1/u2 同在 undefKey 条目空间；u1 的 state 显式 undefined 只出**字段**空间（C11 锚）。
    expect(totalOf(mapWindow()(doc, ['undefKey'], { n: 5 }))).toBe(2);
    // 毒值哨兵有牙：同一毒值经「全量物化」（无 where、n=1 命中未匹配毒项）确实响亮失败
    // ——证明 Z 组的 ok:true 不是假绿。
    const poisoned = readLogicalValueAtPath(doc, ['poisonRecArr', 0]);
    expect(poisoned.ok).toBe(false);
    expect((poisoned as { code?: unknown }).code).toBe('PATH_NOT_ALLOWED');
  });
});
