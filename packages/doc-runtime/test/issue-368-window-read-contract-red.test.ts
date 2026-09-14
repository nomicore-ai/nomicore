/**
 * SA6 验收契约（红灯）— issue #368 W1：@nomicore/doc-runtime 载体级窗口原语
 * （确定性选窗 / 统一条目列表 / 零物化 / 组合式 depth / 三失败码 / 敌意 options 封闭校验）。
 *
 * 契约来源：
 * - 任务简报 `wiki/raw/task_issue-368.md`（What to build + AC1–AC6）；
 * - `docs/adr/0028-window-read.md` 决策 2（WindowTerm 三形、dir 缺省 asc、v1 词表）、
 *   决策 3（条目列表 `{index|key,value}`、身份随行、呈现序 = 有序基之序、空容器 → `[]`、
 *   敌意键免疫、值不含容器壳）、决策 4（每入选项 ≡ 同预算逐项读；`maxChildrenPerNode`
 *   只治理项内部嵌套容器，终点宽度由 `n` 治理）、决策 5（类型组序 number → string →
 *   不可比组恒居序列尾、组间序恒定、dir 只翻转组内序、平局锚 key/下标 asc 恒定）、
 *   决策 7（三稳定码响亮不抛 + 敌意 options/orderBy 封闭数据形状校验、零外抛、零 accessor
 *   执行）、决策 8（O(N) 枚举 + field 基每 child 一次单段下钻 + 只物化入选项）、
 *   决策 9-子弹 1（doc-runtime 载体级原语 = `readLogicalValueAtPath` 姊妹、schema 无关）；
 * - `docs/adr/0024-readdata-shape-budget.md` 决策 1（depth/maxChildrenPerNode 轴语义、
 *   封闭 options 形状与 `READ_OPTIONS_INVALID` 先例——W1 零改动，只复用轴语义）；
 * - `docs/adr/0016` L82 + `docs/adr/0008` L20/L229（姊妹签名与语义冻结）；
 * - Owner comment 5652697060（2026-09-13T10:24:57Z，`author_association: OWNER`）：仅
 *   seam-1（本票 W1 全部验收面：载体级选窗原语 / 条目列表 / 排序总序 / 零物化哨兵 /
 *   三失败码 / 敌意 options 校验）豁免 ADR-0027 T1/T2 时序；W2（#369）/W3（#370）不覆盖。
 *
 * 契约绑定表（见 `wiki/raw/task_issue-368_sa6_contract.md` §12.1；名字/调用形状由 SA1 冻结，
 * 本表只承载绑定，语义断言不随绑定变化）：
 * - B-1 数组窗口公共值导出 = `readArrayWindowAtPath`（Y.Array + plain array）；
 * - B-2 键容器窗口公共值导出 = `readMapWindowAtPath`（Y.Map + plain object）；
 * - B-3 调用形状 = `(doc, path, options?)`；options = `{ n, orderBy?, depth?, maxChildrenPerNode? }`，
 *   `n` 必填 ≥1 整数（ADR 0028 决策 1 词表的载体层同形）；
 * - B-4 `orderBy` = 单个 WindowTerm（ADR 0028 决策 2）：`{by:'index'|'key',dir?}` / `{field,dir?}`；
 * - B-5 结算 = 判别联合：成功 `{ok:true, value:<条目列表>, total}`（本 helper 允许额外字段、
 *   **不锁键集**——B-5 曾在 #368 期不锁键集；成功面恰三键锁现由 pins P7 + 公共入口类型锁
 *   `public-surface-type-guard.test-d.ts` 承载，ADR 0029 §5/§8）；
 *   失败 `{ok:false, code:'WINDOW_*' 三码之一}`（只锁 ok/code；失败面恰四键由 P7 承载）。
 * 若 SA1 冻结不同名字/调用形状：只改本文件 §绑定 常量与适配器，语义断言逐条不变。
 *
 * 红灯现状（HEAD 36a73bb，能力缺口）：`src/index.ts` 公共面零 `window|Window` 命中，
 * 两个绑定名均为 `undefined`（见契约报告 §5 探针）。本文件「W1 红灯契约」组在
 * `typeof entry === 'function'` 处红（能力缺口 = 载体级窗口原语整体不存在）；
 * 「W1 负控（当前绿，实现后必须保持绿）」组不调用未实现入口，锚定姊妹
 * `readLogicalValueAtPath` 的冻结语义、options 封闭形状、fixture 健全性与「毒值哨兵有牙」
 * （同一毒值经全量物化确实响亮失败）——负控证明红灯不来自 fixture/环境/入口错误。
 *
 * 断言纪律：全部锚定运行时行为（结果联合、条目列表、Y.Doc 值、异常观测），无源码 grep、
 * 无 skip/only/todo、无 env override/fallback。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import * as docRuntime from '../src/index.js';
import { readLogicalValueAtPath } from '../src/index.js';
import type { ReadLogicalValueAtPathOptions } from '../src/index.js';

type Path = readonly (string | number)[];

// ── §绑定（B-1/B-2/B-3）：名字/调用形状绑定点；SA1 冻结后若改名只动这里 ──────────────
const ARRAY_WINDOW_EXPORT = 'readArrayWindowAtPath';
const MAP_WINDOW_EXPORT = 'readMapWindowAtPath';

type WindowOptions = Record<string, unknown>;
interface WindowResult {
  ok: boolean;
  value?: unknown;
  code?: unknown;
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

/** 成功结算：ok:true 且携带 value（允许额外字段——结果形状不锁键集）。 */
function expectWindowOk(result: unknown): unknown {
  expect(result !== null && typeof result === 'object', `期望窗口读结果为对象，实际 ${String(result)}`).toBe(true);
  const r = result as WindowResult;
  expect(r.ok, `期望窗口读 ok:true，实际 ${JSON.stringify(r)}`).toBe(true);
  expect(Object.prototype.hasOwnProperty.call(r, 'value'), '窗口成功结算必须携带 value 键').toBe(true);
  return r.value;
}

/** 失败结算：ok:false 且 code 严格等于稳定码（失败面只锁 ok/code）。 */
function expectWindowErr(result: unknown, code: string): void {
  expect(result !== null && typeof result === 'object', `期望窗口读失败结算对象，实际 ${String(result)}`).toBe(true);
  const r = result as WindowResult;
  expect(r.ok === true, `期望窗口读 ok:false，实际 ${JSON.stringify(r)}`).toBe(false);
  expect(r.code, `期望稳定码 ${code}，实际 ${String(r.code)}`).toBe(code);
}

interface SiblingReadResult {
  ok: boolean;
  value?: unknown;
  code?: unknown;
  truncated?: boolean;
  truncations?: readonly unknown[];
}

function siblingRead(
  doc: Y.Doc,
  path: Path,
  options?: Record<string, unknown>,
): SiblingReadResult {
  if (options === undefined) return readLogicalValueAtPath(doc, path);
  return readLogicalValueAtPath(doc, path, options as unknown as ReadLogicalValueAtPathOptions);
}

// ── fixture ─────────────────────────────────────────────────────────────────────────

function freshDoc(build: (root: Y.Map<unknown>) => void): Y.Doc {
  const doc = new Y.Doc();
  build(doc.getMap('ROOT'));
  return doc;
}

/** 窗口结果 → 下标列表（issue #376 位置序断言用）。 */
function indicesOfWindow(result: unknown): number[] {
  const entries = expectWindowOk(result) as Array<{ index: number }>;
  return entries.map((e) => e.index);
}

/** 排序矩阵条目（ADR 0028 决策 5，map 面值基承载）：number → string → 不可比组。
 *  array 面 index 基 = 位置序（issue #376）：排序键 = 下标本身，值序纪律不介入——
 *  ORDER_*_INDICES 期望自位置序推导。 */
const ORDER_VALUES: unknown[] = [5, 1, 30, 'b', 'A', true, null, { z: 1 }, [7]];
const ORDER_ASC_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const ORDER_DESC_INDICES = [8, 7, 6, 5, 4, 3, 2, 1, 0];

function arrayEntries(indices: readonly number[], values: readonly unknown[]): Array<{ index: number; value: unknown }> {
  return indices.map((i) => ({ index: i, value: values[i] }));
}

function keyEntries(keys: readonly string[], values: Record<string, unknown>): Array<{ key: string; value: unknown }> {
  return keys.map((k) => ({ key: k, value: values[k] }));
}

function makeOrderDoc(carrier: 'yjs' | 'plain'): Y.Doc {
  return freshDoc((root) => {
    if (carrier === 'yjs') {
      const arr = new Y.Array<unknown>();
      arr.insert(0, ORDER_VALUES);
      root.set('arr', arr);
    } else {
      root.set('arr', [...ORDER_VALUES]);
    }
  });
}

const MAP_VALUES: Record<string, unknown> = { b: 2, a: 1, A: 3 };
const MAP_ASC = ['A', 'a', 'b'];
const MAP_DESC = ['b', 'a', 'A'];

function makeKeyDoc(carrier: 'yjs' | 'plain'): Y.Doc {
  return freshDoc((root) => {
    if (carrier === 'yjs') {
      const m = new Y.Map<unknown>();
      for (const k of ['b', 'a', 'A']) m.set(k, MAP_VALUES[k]);
      root.set('obj', m);
    } else {
      root.set('obj', { b: 2, a: 1, A: 3 });
    }
  });
}

/** field 基排序矩阵：t3 缺字段 / t4 null / t5 布尔 / t6 容器 → 不可比组（key 序恒 asc）。 */
const FIELD_CHILDREN: Record<string, unknown> = {
  t1: { score: 3 },
  t2: { score: 10 },
  t3: {},
  t4: { score: null },
  t5: { score: true },
  t6: { score: { nested: 1 } },
  t7: { score: 3 },
  t8: { score: 'x' },
  t9: { score: 'aa' },
};
const FIELD_ASC_KEYS = ['t1', 't7', 't2', 't9', 't8', 't3', 't4', 't5', 't6'];
const FIELD_DESC_KEYS = ['t2', 't1', 't7', 't8', 't9', 't3', 't4', 't5', 't6'];

function makeFieldDoc(): Y.Doc {
  return freshDoc((root) => {
    const m = new Y.Map<unknown>();
    for (const k of Object.keys(FIELD_CHILDREN)) m.set(k, FIELD_CHILDREN[k]);
    root.set('tasks', m);
  });
}

/** 毒值哨兵 fixture：未入选子项内埋投影不可表示值（non-finite / 稀疏空洞）。 */
function poisonObject(): { deep: number } {
  return { deep: Number.NaN };
}

function sparseArray(): unknown[] {
  const a: unknown[] = new Array(3);
  a[0] = 1;
  a[2] = 3;
  return a; // 下标 1 = 稀疏空洞（projection 不可表示）
}

function makeSentinelDoc(): Y.Doc {
  return freshDoc((root) => {
    const arr = new Y.Array<unknown>();
    arr.insert(0, [10, 20, 30, 40, poisonObject()]);
    root.set('arr', arr);
    root.set('plainArr', [10, 20, sparseArray()]);
    const field = new Y.Map<unknown>();
    field.set('f1', { s: 1 });
    field.set('f2', { s: 2 });
    field.set('f3', { s: 3, bad: Number.NaN }); // 毒值在非排序字段：field 基单段下钻不得整项物化
    root.set('field', field);
    const keys = new Y.Map<unknown>();
    keys.set('a', { v: 1 });
    keys.set('z', { v: Number.NaN }); // 未入选键子树内毒值
    root.set('keys', keys);
  });
}

/** 组合式 depth 等价 fixture：标量 / Y.Map / Y.Array / plain object / plain array 五形。 */
function makeDepthDoc(): { doc: Y.Doc; children: unknown[] } {
  const children: unknown[] = [];
  const doc = freshDoc((root) => {
    const arr = new Y.Array<unknown>();
    children.push(7);
    arr.insert(0, [7]);
    const inner = new Y.Map<unknown>();
    inner.set('a', 1);
    const b = new Y.Map<unknown>();
    b.set('c', 2);
    inner.set('b', b);
    const d = new Y.Array<unknown>();
    d.insert(0, [1, 2, 3]);
    inner.set('d', d);
    children.push(inner);
    arr.insert(1, [inner]);
    const nestedArr = new Y.Array<unknown>();
    nestedArr.insert(0, [1, 2, 3]);
    children.push(nestedArr);
    arr.insert(2, [nestedArr]);
    children.push({ p: { q: 1 } });
    arr.insert(3, [{ p: { q: 1 } }]);
    children.push([1, 2, 3]);
    arr.insert(4, [[1, 2, 3]]);
    root.set('arr', arr);
  });
  return { doc, children };
}

function makeCarriersDoc(): Y.Doc {
  return freshDoc((root) => {
    const arr = new Y.Array<unknown>();
    arr.insert(0, [1, 2]);
    root.set('arr', arr);
    root.set('plainArr', [1, 2]);
    const m = new Y.Map<unknown>();
    m.set('k', 1);
    root.set('obj', m);
    root.set('plainObj', { k: 1 });
    root.set('num', 7);
    root.set('str', 'x');
    root.set('none', null);
    root.set('bool', true);
    root.set('xml', new Y.XmlFragment());
    root.set('txt', new Y.Text());
    root.set('emptyArr', new Y.Array<unknown>());
    root.set('emptyPlainArr', []);
    root.set('emptyMap', new Y.Map<unknown>());
    root.set('emptyPlainObj', {});
  });
}

// ═════════════════════════════════════════════════════════════════════════════════════
// W1 红灯契约（当前红 = 载体级窗口原语整体不存在；实现后全绿）
// ═════════════════════════════════════════════════════════════════════════════════════

describe('W1-A 选窗正确性矩阵：基 × dir × 位置序（array index 基，issue #376）× 值序纪律（map 值基承载）', () => {
  it('W1-A1 数组下标基缺省 asc：位置序自 [0] 取（ADR 0028 决策 2），身份随行、呈现序 = 位置序', () => {
    const doc = makeOrderDoc('yjs');
    const r = arrayWindow()(doc, ['arr'], { n: 9 });
    expect(expectWindowOk(r)).toStrictEqual(arrayEntries(ORDER_ASC_INDICES, ORDER_VALUES));
  });

  it('W1-A2 数组下标基 desc：位置倒序自尾部取（组序纪律对位置基无适用对象——值序承载见 W1-B/C）', () => {
    const doc = makeOrderDoc('yjs');
    const r = arrayWindow()(doc, ['arr'], { n: 9, orderBy: { by: 'index', dir: 'desc' } });
    expect(expectWindowOk(r)).toStrictEqual(arrayEntries(ORDER_DESC_INDICES, ORDER_VALUES));
  });

  it('W1-A3 窗口 = 位置序前 n 前缀：asc = 头 n 条、desc = 尾 n 条（含不可比元素亦按位置就位）', () => {
    const doc = makeOrderDoc('yjs');
    const asc = arrayWindow()(doc, ['arr'], { n: 5 }) as WindowResult;
    const desc = arrayWindow()(doc, ['arr'], { n: 5, orderBy: { by: 'index', dir: 'desc' } }) as WindowResult;
    expect((expectWindowOk(asc) as Array<{ index: number }>).map((e) => e.index)).toEqual([0, 1, 2, 3, 4]);
    expect((expectWindowOk(desc) as Array<{ index: number }>).map((e) => e.index)).toEqual([8, 7, 6, 5, 4]);
    // n=6：asc 头 6 / desc 尾 6
    const asc6 = arrayWindow()(doc, ['arr'], { n: 6 }) as WindowResult;
    const desc6 = arrayWindow()(doc, ['arr'], { n: 6, orderBy: { by: 'index', dir: 'desc' } }) as WindowResult;
    expect((expectWindowOk(asc6) as Array<{ index: number }>).map((e) => e.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect((expectWindowOk(desc6) as Array<{ index: number }>).map((e) => e.index)).toEqual([8, 7, 6, 5, 4, 3]);
  });

  it('W1-A4 不可比元素（null/布尔/容器）按位置就位不重排：全量窗口两方向均为纯位置序', () => {
    const doc = makeOrderDoc('yjs');
    const asc = arrayWindow()(doc, ['arr'], { n: 9 }) as WindowResult;
    const desc = arrayWindow()(doc, ['arr'], { n: 9, orderBy: { by: 'index', dir: 'desc' } }) as WindowResult;
    expect((expectWindowOk(asc) as Array<{ index: number }>).map((e) => e.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect((expectWindowOk(desc) as Array<{ index: number }>).map((e) => e.index)).toEqual([8, 7, 6, 5, 4, 3, 2, 1, 0]);
  });

  it('W1-A5 头/尾端前缀稳定可复现：asc n=3 = 头三条、desc n=3 = 尾三条（下标唯一无平局）', () => {
    const doc = makeOrderDoc('yjs');
    const asc = (expectWindowOk(arrayWindow()(doc, ['arr'], { n: 3 })) as Array<{ index: number }>).map((e) => e.index);
    const desc = (
      expectWindowOk(arrayWindow()(doc, ['arr'], { n: 3, orderBy: { by: 'index', dir: 'desc' } })) as Array<{ index: number }>
    ).map((e) => e.index);
    expect(asc).toEqual([0, 1, 2]);
    expect(desc).toEqual([8, 7, 6]);
  });

  it('W1-A6 plain array 载体同构：同数据同窗口（载体面 Y.Array + plain array）', () => {
    const doc = makeOrderDoc('plain');
    const r = arrayWindow()(doc, ['arr'], { n: 9 });
    expect(expectWindowOk(r)).toStrictEqual(arrayEntries(ORDER_ASC_INDICES, ORDER_VALUES));
  });

  it('W1-A7 字符串数组同为位置序（值码点序纪律由 W1-B1/B2 键基承载）', () => {
    const values: unknown[] = ['\u{1F600}', '\uFFFD', 'z'];
    const doc = freshDoc((root) => {
      const arr = new Y.Array<unknown>();
      arr.insert(0, values);
      root.set('arr', arr);
    });
    // 位置序：asc = [0,1,2]（原序）、desc = [2,1,0]（尾部起）——与元素码点大小无关
    const asc = arrayWindow()(doc, ['arr'], { n: 3 }) as WindowResult;
    const desc = arrayWindow()(doc, ['arr'], { n: 3, orderBy: { by: 'index', dir: 'desc' } }) as WindowResult;
    expect((expectWindowOk(asc) as Array<{ index: number }>).map((e) => e.index)).toEqual([0, 1, 2]);
    expect((expectWindowOk(desc) as Array<{ index: number }>).map((e) => e.index)).toEqual([2, 1, 0]);
  });

  it('W1-A8 n ≥ 子项数：全量窗口（min(n,total) 语义），n=99 与 n=total 同形', () => {
    const doc = makeOrderDoc('yjs');
    const all = arrayWindow()(doc, ['arr'], { n: 99 });
    const exact = arrayWindow()(doc, ['arr'], { n: 9 });
    expect(expectWindowOk(all)).toStrictEqual(arrayEntries(ORDER_ASC_INDICES, ORDER_VALUES));
    expect(expectWindowOk(all)).toStrictEqual(expectWindowOk(exact));
  });

  // ── issue #376：index 基 = 位置序（ADR 0028 决策 2「asc = 自 [0] 取」；desc 自尾部取）──
  // 基线红：排序键误用元素值 → 容器元素全落不可比组 → 平局锚吞掉 dir；标量数组则为值序非位置序。

  it('W1-A9 记录数组（容器元素）dir 生效：asc = 头 n 条、desc = 尾 n 条（issue #376 回归）', () => {
    const values: unknown[] = [
      { at: 'd1', note: 'oldest' },
      { at: 'd2', note: 'mid' },
      { at: 'd3', note: 'x' },
      { at: 'd4', note: 'newest' },
    ];
    const doc = freshDoc((root) => {
      const arr = new Y.Array<unknown>();
      arr.insert(0, values);
      root.set('arr', arr);
    });
    const asc = indicesOfWindow(arrayWindow()(doc, ['arr'], { n: 2 }));
    const desc = indicesOfWindow(arrayWindow()(doc, ['arr'], { n: 2, orderBy: { by: 'index', dir: 'desc' } }));
    expect(asc, 'asc = 自 [0] 取（头两条）').toEqual([0, 1]);
    expect(desc, 'desc = 自尾部取（最新两条）——基线红：平局锚吞 dir 返回 [0,1]').toEqual([3, 2]);
  });

  it('W1-A10 标量数组同为位置序：值序不介入（[3,1,2] asc n=2 = 头两条、desc n=2 = 尾两条）', () => {
    const doc = freshDoc((root) => {
      const arr = new Y.Array<unknown>();
      arr.insert(0, [3, 1, 2]);
      root.set('arr', arr);
    });
    const asc = expectWindowOk(arrayWindow()(doc, ['arr'], { n: 2 })) as Array<{ index: number; value: unknown }>;
    const desc = expectWindowOk(arrayWindow()(doc, ['arr'], { n: 2, orderBy: { by: 'index', dir: 'desc' } })) as Array<{ index: number; value: unknown }>;
    expect(asc, 'asc 头两条（非值序最小两项——基线红）').toStrictEqual([
      { index: 0, value: 3 },
      { index: 1, value: 1 },
    ]);
    expect(desc, 'desc 尾两条').toStrictEqual([
      { index: 2, value: 2 },
      { index: 1, value: 1 },
    ]);
  });

  it('W1-B1 键容器键基缺省 asc：键码点序，条目 = {key,value}', () => {
    const doc = makeKeyDoc('yjs');
    const r = mapWindow()(doc, ['obj'], { n: 3 });
    expect(expectWindowOk(r)).toStrictEqual(keyEntries(MAP_ASC, MAP_VALUES));
  });

  it('W1-B2 键容器键基 desc：组内序翻转（键全为可比项，无尾组）', () => {
    const doc = makeKeyDoc('yjs');
    const r = mapWindow()(doc, ['obj'], { n: 3, orderBy: { by: 'key', dir: 'desc' } });
    expect(expectWindowOk(r)).toStrictEqual(keyEntries(MAP_DESC, MAP_VALUES));
  });

  it('W1-B3 plain object 载体同构：同数据同窗口', () => {
    const doc = makeKeyDoc('plain');
    const asc = mapWindow()(doc, ['obj'], { n: 3 });
    const desc = mapWindow()(doc, ['obj'], { n: 3, orderBy: { by: 'key', dir: 'desc' } });
    expect(expectWindowOk(asc)).toStrictEqual(keyEntries(MAP_ASC, MAP_VALUES));
    expect(expectWindowOk(desc)).toStrictEqual(keyEntries(MAP_DESC, MAP_VALUES));
  });

  it('W1-C1 field 基缺省 asc：number 数值序（平局键 asc）→ string 码点序 → 不可比组（缺字段/null/布尔/容器）恒居尾', () => {
    const doc = makeFieldDoc();
    const r = mapWindow()(doc, ['tasks'], { n: 9, orderBy: { field: 'score' } });
    expect(expectWindowOk(r)).toStrictEqual(keyEntries(FIELD_ASC_KEYS, FIELD_CHILDREN));
  });

  it('W1-C2 field 基 desc：组间序恒定、dir 只翻转组内序；平局锚 = 键 asc 恒定（t1 先于 t7，两方向一致）', () => {
    const doc = makeFieldDoc();
    const r = mapWindow()(doc, ['tasks'], { n: 9, orderBy: { field: 'score', dir: 'desc' } });
    expect(expectWindowOk(r)).toStrictEqual(keyEntries(FIELD_DESC_KEYS, FIELD_CHILDREN));
  });

  it('W1-C3 不可比组恒居尾：n=5 恰装满全部可比项（3 number + 2 string），缺席/null/布尔/容器零入选', () => {
    const doc = makeFieldDoc();
    const asc = mapWindow()(doc, ['tasks'], { n: 5, orderBy: { field: 'score' } }) as WindowResult;
    expect((expectWindowOk(asc) as Array<{ key: string }>).map((e) => e.key)).toEqual(['t1', 't7', 't2', 't9', 't8']);
    const desc = mapWindow()(doc, ['tasks'], { n: 5, orderBy: { field: 'score', dir: 'desc' } }) as WindowResult;
    expect((expectWindowOk(desc) as Array<{ key: string }>).map((e) => e.key)).toEqual(['t2', 't1', 't7', 't8', 't9']);
  });

  it('W1-C4 field 基单段下钻覆盖 Y.Map 与 plain object 两种 child 载体（比较的是实际数据值，schema 无关）', () => {
    const doc = freshDoc((root) => {
      const m = new Y.Map<unknown>();
      const yChild = new Y.Map<unknown>();
      yChild.set('score', 5);
      m.set('y1', yChild);
      m.set('p1', { score: 1 });
      root.set('tasks', m);
    });
    const r = mapWindow()(doc, ['tasks'], { n: 2, orderBy: { field: 'score' } });
    expect(expectWindowOk(r)).toStrictEqual([
      { key: 'p1', value: { score: 1 } },
      { key: 'y1', value: { score: 5 } },
    ]);
  });

  it('W1-H1 确定性/稳定性：同一 doc 重复调用与孪生 doc 同数据 → 逐字节一致', () => {
    const docA = makeFieldDoc();
    const docB = makeFieldDoc();
    const first = mapWindow()(docA, ['tasks'], { n: 9, orderBy: { field: 'score', dir: 'desc' } });
    const second = mapWindow()(docA, ['tasks'], { n: 9, orderBy: { field: 'score', dir: 'desc' } });
    const twin = mapWindow()(docB, ['tasks'], { n: 9, orderBy: { field: 'score', dir: 'desc' } });
    expect(expectWindowOk(first)).toStrictEqual(expectWindowOk(second));
    expect(expectWindowOk(first)).toStrictEqual(expectWindowOk(twin));
  });
});

describe('W1-D 条目列表形态：身份随行 / 值不含容器壳 / 空容器 → []（ADR 0028 决策 3）', () => {
  it('W1-D1 数组条目 own 键集恰 {index,value}，index = 原容器下标且指向同值', () => {
    const doc = makeSentinelDoc();
    const r = arrayWindow()(doc, ['arr'], { n: 2 }) as WindowResult;
    const entries = expectWindowOk(r) as Array<Record<string, unknown>>;
    expect(entries).toStrictEqual([
      { index: 0, value: 10 },
      { index: 1, value: 20 },
    ]);
    for (const e of entries) expect(Object.keys(e).sort()).toEqual(['index', 'value']);
  });

  it('W1-D2 键容器条目 own 键集恰 {key,value}，key = 原容器键且指向同值', () => {
    const doc = makeKeyDoc('yjs');
    const r = mapWindow()(doc, ['obj'], { n: 2 }) as WindowResult;
    const entries = expectWindowOk(r) as Array<Record<string, unknown>>;
    expect(entries).toStrictEqual(keyEntries(['A', 'a'], MAP_VALUES));
    for (const e of entries) expect(Object.keys(e).sort()).toEqual(['key', 'value']);
  });

  it('W1-D3 值不含容器壳：容器项 value 是项自身投影，不是外层容器的单元素包裹', () => {
    const doc = freshDoc((root) => {
      const arr = new Y.Array<unknown>();
      arr.insert(0, [[1, 2], { a: 1 }]);
      root.set('arr', arr);
    });
    const r = arrayWindow()(doc, ['arr'], { n: 2, depth: 1 }) as WindowResult;
    const entries = expectWindowOk(r) as Array<{ index: number; value: unknown }>;
    expect(entries[0]?.value).toStrictEqual([1, 2]);
    expect(Array.isArray(entries[0]?.value)).toBe(true);
    expect(entries[1]?.value).toStrictEqual({ a: 1 });
  });

  it('W1-D4 空容器 → ok:true 且 value: []（两 API 同形，Y.Array / plain array / Y.Map / plain object）', () => {
    const doc = makeCarriersDoc();
    for (const path of [['emptyArr'], ['emptyPlainArr']] as const) {
      const r = arrayWindow()(doc, path, { n: 3 }) as WindowResult;
      expect(expectWindowOk(r)).toStrictEqual([]);
    }
    for (const path of [['emptyMap'], ['emptyPlainObj']] as const) {
      const r = mapWindow()(doc, path, { n: 3 }) as WindowResult;
      expect(expectWindowOk(r)).toStrictEqual([]);
    }
  });

  it('W1-D5 敌意键免疫：plain object 的 own __proto__ 数据键是条目字段值而非属性名（零原型污染）', () => {
    const hostile: Record<string, unknown> = { z: 1 };
    Object.defineProperty(hostile, '__proto__', {
      value: 'x',
      enumerable: true,
      writable: true,
      configurable: true,
    });
    const doc = freshDoc((root) => {
      root.set('obj', hostile);
    });
    const r = mapWindow()(doc, ['obj'], { n: 2 }) as WindowResult;
    const entries = expectWindowOk(r) as Array<Record<string, unknown>>;
    expect(entries).toStrictEqual([
      { key: '__proto__', value: 'x' }, // '_'(0x5F) < 'z'(0x7A)
      { key: 'z', value: 1 },
    ]);
    for (const e of entries) {
      expect(Object.getPrototypeOf(e)).toBe(Object.prototype);
      expect(Object.keys(e).sort()).toEqual(['key', 'value']);
    }
    expect(Object.prototype.hasOwnProperty.call({}, 'x')).toBe(false);
    expect(({} as Record<string, unknown>)['x']).toBeUndefined();
  });
});

describe('W1-E 组合式 depth 等价：入选项物化 ≡ 同预算逐项读（ADR 0028 决策 4）', () => {
  function expectEquivalence(
    doc: Y.Doc,
    path: Path,
    options: Record<string, unknown>,
    kind: 'array' | 'map',
  ): Array<{ index?: number; key?: string; value: unknown }> {
    const fn = kind === 'array' ? arrayWindow() : mapWindow();
    const r = fn(doc, path, options) as WindowResult;
    const entries = expectWindowOk(r) as Array<{ index?: number; key?: string; value: unknown }>;
    const budget: Record<string, unknown> = {};
    if (options['depth'] !== undefined) budget['depth'] = options['depth'];
    if (options['maxChildrenPerNode'] !== undefined) budget['maxChildrenPerNode'] = options['maxChildrenPerNode'];
    const hasBudget = Object.keys(budget).length > 0;
    for (const e of entries) {
      const itemPath: Path = kind === 'array' ? [...path, e.index as number] : [...path, e.key as string];
      const baseline = hasBudget ? siblingRead(doc, itemPath, budget) : siblingRead(doc, itemPath);
      expect(baseline.ok, `等价锚基准读必须成功：${JSON.stringify(itemPath)}`).toBe(true);
      expect(e.value, `入选项 ${JSON.stringify(itemPath)} 物化必须与同预算逐项读逐字节一致`).toStrictEqual(
        baseline.value,
      );
    }
    return entries;
  }

  it('W1-E1 无预算 options：每项 value ≡ readLogicalValueAtPath(项路径)（legacy 两参）', () => {
    const { doc } = makeDepthDoc();
    expectEquivalence(doc, ['arr'], { n: 5 }, 'array');
  });

  it('W1-E2 depth:0：容器项 = 同形空壳（{} / []），标量项原样（且终端条数仍由 n 治理）', () => {
    const { doc } = makeDepthDoc();
    const entries = expectEquivalence(doc, ['arr'], { n: 5, depth: 0 }, 'array');
    expect(entries.length).toBe(5); // 终端宽度不被 depth 影响
    expect(entries[0]?.value).toBe(7); // 标量原样
    expect(entries[1]?.value).toStrictEqual({});
    expect(entries[2]?.value).toStrictEqual([]);
    expect(entries[3]?.value).toStrictEqual({});
    expect(entries[4]?.value).toStrictEqual([]);
  });

  it('W1-E3 depth:1 + maxChildrenPerNode:1：maxChildrenPerNode 只治理入选项内部嵌套容器，终点宽度由 n 治理', () => {
    const { doc } = makeDepthDoc();
    const entries = expectEquivalence(doc, ['arr'], { n: 3, depth: 1, maxChildrenPerNode: 1 }, 'array');
    expect(entries.length).toBe(3); // n=3 决定终点条数
    if (!entries[1]) throw new Error('缺少下标 1 条目的等价锚');
    expect(entries[1].value).toStrictEqual({ a: 1 }); // 项内部 width 受 K=1 约束（与逐项同预算读一致）
    // 对照：姊妹读同 K 在终点上确实只保留 1 个子项——证明「护栏下移一层」的方向性
    const terminal = siblingRead(doc, ['arr'], { maxChildrenPerNode: 1 });
    expect(terminal.ok).toBe(true);
    expect((terminal.value as unknown[]).length).toBe(1);
  });

  it('W1-E4 键容器项路径 = [...path, key]：field 基下的逐项等价锚同样成立', () => {
    const doc = makeFieldDoc();
    expectEquivalence(doc, ['tasks'], { n: 9, orderBy: { field: 'score' }, depth: 1 }, 'map');
  });

  it('W1-E5 标量项在 depth:0 原样（n 个标量仍是 n 个标量）', () => {
    const doc = freshDoc((root) => {
      const arr = new Y.Array<unknown>();
      arr.insert(0, [1, 'a', null]);
      root.set('arr', arr);
    });
    const entries = expectEquivalence(doc, ['arr'], { n: 3, depth: 0 }, 'array');
    expect(entries.map((e) => e.value)).toStrictEqual([1, 'a', null]);
  });
});

describe('W1-F 零物化哨兵：未入选子项零递归零物化（ADR 0028 决策 8）', () => {
  it('W1-F1 数组窗口（Y.Array 载体）：未入选子项内埋 non-finite 必须 ok:true，仅物化入选 2 项', () => {
    const doc = makeSentinelDoc();
    const r = arrayWindow()(doc, ['arr'], { n: 2 }) as WindowResult;
    expect(expectWindowOk(r)).toStrictEqual([
      { index: 0, value: 10 },
      { index: 1, value: 20 },
    ]);
  });

  it('W1-F2 数组窗口（plain array 载体）：未入选子项内埋稀疏空洞必须 ok:true', () => {
    const doc = makeSentinelDoc();
    const r = arrayWindow()(doc, ['plainArr'], { n: 2 }) as WindowResult;
    expect(expectWindowOk(r)).toStrictEqual([
      { index: 0, value: 10 },
      { index: 1, value: 20 },
    ]);
  });

  it('W1-F3 field 基：只对每 child 做一次单段下钻（毒值在非排序字段），未入选项零物化', () => {
    const doc = makeSentinelDoc();
    const r = mapWindow()(doc, ['field'], { n: 2, orderBy: { field: 's' } }) as WindowResult;
    expect(expectWindowOk(r)).toStrictEqual([
      { key: 'f1', value: { s: 1 } },
      { key: 'f2', value: { s: 2 } },
    ]);
  });

  it('W1-F4 键基：未入选键子树内埋 non-finite 必须 ok:true（按键选窗零值读取）', () => {
    const doc = makeSentinelDoc();
    const r = mapWindow()(doc, ['keys'], { n: 1 }) as WindowResult;
    expect(expectWindowOk(r)).toStrictEqual([{ key: 'a', value: { v: 1 } }]);
  });

  it('W1-F5 规模哨兵：N=2000，未入选 1995 项全埋毒值 + n=5 → ok:true 且恰 5 条（O(n) 物化边界）', () => {
    const doc = freshDoc((root) => {
      const arr = new Y.Array<unknown>();
      const values: unknown[] = [];
      for (let i = 0; i < 2000; i++) values.push(i < 5 ? i : poisonObject());
      arr.insert(0, values);
      root.set('arr', arr);
    });
    const r = arrayWindow()(doc, ['arr'], { n: 5 }) as WindowResult;
    const entries = expectWindowOk(r) as Array<{ index: number; value: unknown }>;
    expect(entries.map((e) => e.index)).toEqual([0, 1, 2, 3, 4]);
    expect(entries.map((e) => e.value)).toStrictEqual([0, 1, 2, 3, 4]);
  });
});

describe('W1-G 三失败码各就各位：缺席 / 载体不符 / 规则非法，响亮不抛（ADR 0028 决策 7）', () => {
  it('W1-G1 WINDOW_TARGET_ABSENT：终点缺键 / 中间缺键 / 数组中段越界一律响亮（不做缺席吸收）', () => {
    const doc = makeCarriersDoc();
    const absentPaths: Path[] = [['missing'], ['obj', 'missing'], ['plainObj', 'missing'], ['arr', 99, 'x']];
    for (const path of absentPaths) {
      expectWindowErr(arrayWindow()(doc, path, { n: 1 }), 'WINDOW_TARGET_ABSENT');
      expectWindowErr(mapWindow()(doc, path, { n: 1 }), 'WINDOW_TARGET_ABSENT');
    }
  });

  it('W1-G2 WINDOW_CARRIER_MISMATCH：数组面收 Y.Map/plain object/标量/XmlFragment/Y.Text；键面收 Y.Array/plain array/标量', () => {
    const doc = makeCarriersDoc();
    for (const path of [['obj'], ['plainObj'], ['num'], ['str'], ['none'], ['bool'], ['xml'], ['txt']] as const) {
      expectWindowErr(arrayWindow()(doc, path, { n: 1 }), 'WINDOW_CARRIER_MISMATCH');
    }
    for (const path of [['arr'], ['plainArr'], ['num'], ['str'], ['none'], ['bool']] as const) {
      expectWindowErr(mapWindow()(doc, path, { n: 1 }), 'WINDOW_CARRIER_MISMATCH');
    }
  });

  it('W1-G3 WINDOW_OPTIONS_INVALID：n 缺失/0/-0/-1/非整数/非有限/非 number', () => {
    const doc = makeCarriersDoc();
    for (const n of [undefined, 0, -0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '2', null]) {
      const options: Record<string, unknown> = {};
      if (n !== undefined) options['n'] = n;
      expectWindowErr(arrayWindow()(doc, ['arr'], options), 'WINDOW_OPTIONS_INVALID');
      expectWindowErr(mapWindow()(doc, ['obj'], options), 'WINDOW_OPTIONS_INVALID');
    }
  });

  it('W1-G4 WINDOW_OPTIONS_INVALID：非法枚举 / 语境外排序项（readArray 传 field 或 key、readMap 传 index）/ field 非单段字符串', () => {
    const doc = makeCarriersDoc();
    expectWindowErr(arrayWindow()(doc, ['arr'], { n: 1, orderBy: { by: 'index', dir: 'up' } }), 'WINDOW_OPTIONS_INVALID');
    expectWindowErr(mapWindow()(doc, ['obj'], { n: 1, orderBy: { by: 'key', dir: 'up' } }), 'WINDOW_OPTIONS_INVALID');
    expectWindowErr(arrayWindow()(doc, ['arr'], { n: 1, orderBy: { field: 'score' } }), 'WINDOW_OPTIONS_INVALID');
    expectWindowErr(arrayWindow()(doc, ['arr'], { n: 1, orderBy: { by: 'key' } }), 'WINDOW_OPTIONS_INVALID');
    expectWindowErr(mapWindow()(doc, ['obj'], { n: 1, orderBy: { by: 'index' } }), 'WINDOW_OPTIONS_INVALID');
    expectWindowErr(mapWindow()(doc, ['obj'], { n: 1, orderBy: { field: ['a', 'b'] } }), 'WINDOW_OPTIONS_INVALID');
  });

  it('W1-G5 WINDOW_OPTIONS_INVALID：orderBy 非法形状（列表/字符串/null/unknown by）+ options 未知键（封闭形状）', () => {
    const doc = makeCarriersDoc();
    for (const orderBy of [[{ by: 'key' }], 'key', null, 42, { by: 'nope' }, {}]) {
      expectWindowErr(arrayWindow()(doc, ['arr'], { n: 1, orderBy }), 'WINDOW_OPTIONS_INVALID');
    }
    expectWindowErr(arrayWindow()(doc, ['arr'], { n: 1, unknownAxis: 2 }), 'WINDOW_OPTIONS_INVALID');
    expectWindowErr(mapWindow()(doc, ['obj'], { n: 1, nope: true }), 'WINDOW_OPTIONS_INVALID');
  });

  it('W1-G6 敌意 options：非 plain 宿主 / Proxy trap → WINDOW_OPTIONS_INVALID，零外抛、零 accessor 执行', () => {
    const doc = makeCarriersDoc();
    const fn = arrayWindow();
    let accessorRuns = 0;
    const accessorOptions: Record<string, unknown> = {};
    Object.defineProperty(accessorOptions, 'n', {
      enumerable: true,
      configurable: true,
      get() {
        accessorRuns++;
        throw new Error('options.n getter 不得执行');
      },
    });
    class OptionsHost {
      n = 2;
    }
    const hostile: unknown[] = [
      null,
      [],
      'x',
      42,
      new OptionsHost(),
      Object.create({ n: 2 }),
      accessorOptions,
      new Proxy({ n: 2 }, { ownKeys: () => { throw new Error('ownKeys trap'); } }),
      new Proxy({ n: 2 }, { getOwnPropertyDescriptor: () => { throw new Error('gopd trap'); } }),
      new Proxy({ n: 2 }, { getPrototypeOf: () => { throw new Error('proto trap'); } }),
    ];
    for (const options of hostile) {
      let result: unknown;
      expect(() => {
        result = fn(doc, ['arr'], options as WindowOptions);
      }, `敌意 options ${String(options)} 必须零外抛`).not.toThrow();
      expectWindowErr(result, 'WINDOW_OPTIONS_INVALID');
    }
    expect(accessorRuns).toBe(0);
  });

  it('W1-G7 敌意 orderBy：Proxy trap / accessor（by、dir）→ WINDOW_OPTIONS_INVALID，零外抛、零 accessor 执行', () => {
    const doc = makeCarriersDoc();
    const fn = arrayWindow();
    let accessorRuns = 0;
    const byAccessor: Record<string, unknown> = {};
    Object.defineProperty(byAccessor, 'by', {
      enumerable: true,
      configurable: true,
      get() {
        accessorRuns++;
        throw new Error('orderBy.by getter 不得执行');
      },
    });
    const dirAccessor: Record<string, unknown> = { by: 'index' };
    Object.defineProperty(dirAccessor, 'dir', {
      enumerable: true,
      configurable: true,
      get() {
        accessorRuns++;
        throw new Error('orderBy.dir getter 不得执行');
      },
    });
    const hostileOrderBy: unknown[] = [
      byAccessor,
      dirAccessor,
      new Proxy({ by: 'index' }, { ownKeys: () => { throw new Error('orderBy ownKeys trap'); } }),
      new Proxy({ by: 'index' }, { getOwnPropertyDescriptor: () => { throw new Error('orderBy gopd trap'); } }),
    ];
    for (const orderBy of hostileOrderBy) {
      let result: unknown;
      expect(() => {
        result = fn(doc, ['arr'], { n: 1, orderBy });
      }, `敌意 orderBy ${String(orderBy)} 必须零外抛`).not.toThrow();
      expectWindowErr(result, 'WINDOW_OPTIONS_INVALID');
    }
    expect(accessorRuns).toBe(0);
  });

  it('W1-G8 三码各就各位且互异：同一调用位置恰得对应稳定码（不在场 ≠ 载体不符 ≠ 规则非法）', () => {
    const doc = makeCarriersDoc();
    const absent = arrayWindow()(doc, ['missing'], { n: 1 }) as WindowResult;
    const mismatch = arrayWindow()(doc, ['obj'], { n: 1 }) as WindowResult;
    const invalid = arrayWindow()(doc, ['arr'], { n: 0 }) as WindowResult;
    expectWindowErr(absent, 'WINDOW_TARGET_ABSENT');
    expectWindowErr(mismatch, 'WINDOW_CARRIER_MISMATCH');
    expectWindowErr(invalid, 'WINDOW_OPTIONS_INVALID');
    expect(new Set([absent.code, mismatch.code, invalid.code]).size).toBe(3);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════
// W1 负控（当前绿；实现后必须保持绿）：不调用未实现入口
// ═════════════════════════════════════════════════════════════════════════════════════

describe('W1-NC 负控与冻结面：姊妹语义不变、options 封闭、fixture 健全、毒值哨兵有牙', () => {
  it('W1-NC1 姊妹无 options 语义冻结：两键成功面 + 缺键缺席吸收（WINDOW_TARGET_ABSENT 不得回渗）', () => {
    const doc = makeCarriersDoc();
    const absent = siblingRead(doc, ['missing']);
    expect(absent.ok).toBe(true);
    expect(absent.value).toBeUndefined();
    expect(Object.keys(absent).sort()).toEqual(['ok', 'value']);
    const midAbsent = siblingRead(doc, ['obj', 'missing']);
    expect(midAbsent.ok).toBe(true);
    expect(midAbsent.value).toBeUndefined();
  });

  it('W1-NC2 姊妹 options 闭合形状冻结：窗口专属键（n/orderBy）与未知键一律 READ_OPTIONS_INVALID（W1 不得拓宽姊妹 options）', () => {
    const doc = makeCarriersDoc();
    for (const options of [{ n: 1 }, { orderBy: { by: 'key' } }, { depth: 1, n: 2 }, { nope: 1 }]) {
      const r = siblingRead(doc, ['arr'], options);
      expect(r.ok).toBe(false);
      expect(r.code).toBe('READ_OPTIONS_INVALID');
    }
  });

  it('W1-NC3 姊妹预算成功面冻结：四键 {ok,value,truncated,truncations} + 截断事实恒在场', () => {
    const doc = makeCarriersDoc();
    const r = siblingRead(doc, ['arr'], { maxChildrenPerNode: 1 });
    expect(r.ok).toBe(true);
    expect(Object.keys(r).sort()).toEqual(['ok', 'truncated', 'truncations', 'value']);
    expect(r.truncated).toBe(true);
    expect(Array.isArray(r.truncations)).toBe(true);
  });

  it('W1-NC4 fixture 健全性：矩阵 fixture 经姊妹全量读得到预期普通值（红不是 fixture 坏）', () => {
    const order = siblingRead(makeOrderDoc('yjs'), ['arr']);
    expect(order.ok).toBe(true);
    expect(order.value).toStrictEqual(ORDER_VALUES);
    const keys = siblingRead(makeKeyDoc('yjs'), ['obj']);
    expect(keys.ok).toBe(true);
    expect(keys.value).toStrictEqual(MAP_VALUES);
    const field = siblingRead(makeFieldDoc(), ['tasks']);
    expect(field.ok).toBe(true);
    expect(field.value).toStrictEqual(FIELD_CHILDREN);
  });

  it('W1-NC5 毒值哨兵有牙：同一毒值经姊妹全量物化确实响亮失败（F 组 ok:true 具备零物化敏感性）', () => {
    const doc = makeSentinelDoc();
    const nonFinite = siblingRead(doc, ['arr']);
    expect(nonFinite.ok).toBe(false);
    expect(nonFinite.code).toBe('PATH_NOT_ALLOWED');
    const sparse = siblingRead(doc, ['plainArr']);
    expect(sparse.ok).toBe(false);
    expect(sparse.code).toBe('PATH_NOT_ALLOWED');
    const fieldPoison = siblingRead(doc, ['field', 'f3']);
    expect(fieldPoison.ok).toBe(false); // {s:3,bad:NaN} 全量读必响
  });

  it('W1-NC6 公共值导出纯加法回归锚：既有读/写/构建入口仍在位且为函数', () => {
    for (const name of [
      'readLogicalValueAtPath',
      'extractYjsSnapshot',
      'materializeRoot',
      'replaceRootContent',
      'applyValidatedMutation',
      'replaceSchemaAndRoot',
      'createInitialDocument',
      'DocRuntimeFatalError',
    ]) {
      expect(typeof ns[name], `既有公共值导出 ${name} 必须保持`).toBe('function');
    }
    expect(ns['MUTATION_GUARD_MISMATCH']).toBe('MUTATION_GUARD_MISMATCH');
  });
});
