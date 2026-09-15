/**
 * SA1 设计钉死项可执行锚（issue #368 W1 / ADR 0028 缝 1）——P1–P8。
 *
 * 产物归属：本文件是 SA1 设计 `wiki/raw/task_issue-368_design.md` §7-D12 的**必选**锚点集
 * （SA2-F1 MAJOR 阻断最小集 = P1/P2；P2b–P8 同文件必选承载）。与 SA6 验收契约
 * `issue-368-window-read-contract-red.test.ts` 分离：**不 import 契约文件**、fixture 全部内联
 * （P1 fixture 与契约 `makeSentinelDoc` 的 field 部分同构复制并注明出处），契约断言零改动。
 *
 * 设计锚定：
 * - P1 = D8（投影域失败透传 `PATH_NOT_ALLOWED`：fail-fast、无半窗、无静默跳项、无补位、
 *   path 精确到项、message 非空；姊妹同款负控证明毒值有牙——NC5 同源）；
 * - P2 = D4（`Number.isFinite` 门：NaN / -Infinity / +Infinity 排序键一律归不可比尾组，
 *   组内身份键 asc 恒定，组位不随 dir 改变；插入序刻意打乱使「锚用插入序」实现必红）；
 * - P2b = D4 × D3（数组面值键同款归尾）；
 * - P3 = D5（`field` 单段字面键：点号不拆分、空串合法）；P4 = D6（undefined 值键出条目空间）；
 *   P5 = D7（空路径 `[]` = ROOT）；P6 = D7 detached 目标/项；P7 = D9/B-5 own 键集；
 *   P8 = D10 / SA2-F2（身份锚码点比较器，astral 平局键）。
 *
 * 红灯纪律（与契约同款）：入口经 §绑定 常量 + `windowEntry` 存在性断言解析——实现前全组红于
 * `typeof ns[export] === 'function'`（能力缺失），实现后全绿；被 root `vitest.config.ts` 的
 * packages 内 test 文件 include 采集、被包级 tsconfig（include 含 test 目录）类型检查。
 *
 * 观察面纪律（两处 D12 期望值在本文件的可观察实现，语义断言与 D12 逐条一致）：
 * 1. P2 以 `depth: 0` 观察完整键序：D12 的期望键序不变，但「无预算折叠」时尾组首项 q1
 *    （`{score: NaN}`）入选即被 D8 fail-fast 拦下（同测试内实证）——`depth: 0` 的同形空壳
 *    折叠不参与排序键分类（分类在折叠前完成），故键序观察等价且可物化；
 * 2. P2b 以「可物化前缀 + 尾组首项 fail-fast 身份」观察：数组面排序键 = 项值本身，非有限
 *    标量入选后物化必响（D8/NC5 同源），完整序列不可作为 `ok:true` 观察——升/降序首位与
 *    尾组首个 fail-fast 项身份即 D12 杀伤面（±Inf 归 number 组 → asc 首位变 3 / desc 首位变 4）。
 *
 * 断言纪律：全部锚定运行时行为（结果联合、条目列表、Y.Doc 值、异常观测），无源码 grep、
 * 无 skip/only/todo、无 env override/fallback。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import * as docRuntime from '../src/index.js';
import { readLogicalValueAtPath } from '../src/index.js';

// ── §绑定（B-1/B-2/B-3）：入口名/调用形状；SA1 冻结后若改名只动这里 ──────────────────
const ARRAY_WINDOW_EXPORT = 'readArrayWindowAtPath';
const MAP_WINDOW_EXPORT = 'readMapWindowAtPath';

type Path = readonly (string | number)[];
type WindowOptions = Record<string, unknown>;
interface WindowResult {
  ok: boolean;
  value?: unknown;
  code?: unknown;
  path?: unknown;
  message?: unknown;
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

/** 成功结算：ok:true 且携带 value（结果形状不锁键集——own 键集自诺见 P7）。 */
function expectOk(result: unknown): unknown {
  expect(result !== null && typeof result === 'object', `期望窗口读结果为对象，实际 ${String(result)}`).toBe(true);
  const r = result as WindowResult;
  expect(r.ok, `期望窗口读 ok:true，实际 ${JSON.stringify(r)}`).toBe(true);
  expect(Object.prototype.hasOwnProperty.call(r, 'value'), '窗口成功结算必须携带 value 键').toBe(true);
  return r.value;
}

/** 失败结算：ok:false 且 code 严格等于期望稳定码；返回结算对象供 path/message 继续断言。 */
function expectErr(result: unknown, code: string): WindowResult {
  expect(result !== null && typeof result === 'object', `期望窗口读失败结算对象，实际 ${String(result)}`).toBe(true);
  const r = result as WindowResult;
  expect(r.ok === true, `期望窗口读 ok:false，实际 ${JSON.stringify(r)}`).toBe(false);
  expect(r.code, `期望稳定码 ${code}，实际 ${String(r.code)}`).toBe(code);
  return r;
}

function freshDoc(build: (root: Y.Map<unknown>) => void): Y.Doc {
  const doc = new Y.Doc();
  build(doc.getMap('ROOT'));
  return doc;
}

function keysOf(entries: unknown): string[] {
  return (entries as Array<{ key: string }>).map((e) => e.key);
}

function indicesOf(entries: unknown): number[] {
  return (entries as Array<{ index: number }>).map((e) => e.index);
}

// ═════════════════════════════════════════════════════════════════════════════════════
// P1（SA2-F1 阻断最小集之一）：D8 —— 投影失败透传 + fail-fast，绝不静默跳项
// ═════════════════════════════════════════════════════════════════════════════════════

/** P1 fixture（与 SA6 契约 `makeSentinelDoc` 的 field 部分同构复制）：f3 内埋 non-finite 毒值。 */
function makeP1Doc(): Y.Doc {
  return freshDoc((root) => {
    const field = new Y.Map<unknown>();
    field.set('f1', { s: 1 });
    field.set('f2', { s: 2 });
    field.set('f3', { s: 3, bad: Number.NaN }); // 毒值在非排序字段：field 基单段下钻不得整项物化
    root.set('field', field);
  });
}

describe('W1-P1 D8 透传：入选项物化失败 → fail-fast PATH_NOT_ALLOWED（SA2-F1 阻断最小集）', () => {
  it('P1 排序键 1/2/3 全选（n:3）→ f3 物化失败即整窗失败：同步不抛 / ok:false / code 严格 / 无 value 半窗 / path 精确到项 / message 非空', () => {
    const doc = makeP1Doc();

    // 负控（NC5 同款）：同一毒项经姊妹全量物化确实响亮失败——fail-fast 断言有牙，红不是 fixture 坏。
    const siblingFailure = readLogicalValueAtPath(doc, ['field', 'f3']);
    expect(siblingFailure.ok).toBe(false);
    if (siblingFailure.ok) throw new Error('P1 前置负控：毒项必须响亮失败');
    expect(siblingFailure.code).toBe('PATH_NOT_ALLOWED');

    // 排序键 s = 1/2/3 全为有限 number → 有序基 f1,f2,f3 → n:3 全选 → 第三项 f3 必败。
    const fn = mapWindow(); // 入口存在性断言在包装外（红灯红因统一为能力缺口）
    let result: WindowResult | undefined;
    expect(() => {
      result = fn(doc, ['field'], { n: 3, orderBy: { field: 's' } }) as WindowResult;
    }, '窗口读必须同步返回、绝不外抛').not.toThrow();

    const r = result as WindowResult;
    expect(r.ok).toBe(false);
    expect(r.code).toBe('PATH_NOT_ALLOWED');
    // 无半窗：失败联合不得携带部分条目（跳项实现会返回 f1/f2 两条 ok:true）。
    expect(Object.prototype.hasOwnProperty.call(r, 'value')).toBe(false);
    expect(r.path).toStrictEqual(['field', 'f3']); // fail-fast 精确到违规项（不补位、不错位）
    expect(typeof r.message).toBe('string');
    expect((r.message as string).length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════
// P2（SA2-F1 阻断最小集之二）：D4 —— NaN / ±Infinity 排序键归不可比尾组
// ═════════════════════════════════════════════════════════════════════════════════════

/** P2 插入序刻意打乱（契约 C 组插入序 = 键序，锚不可区分；本 pin 补此盲区）。 */
const P2_INSERTION = ['q5', 'q3', 'q1', 's1', 'n2', 'q2', 'q4', 'n1'] as const;
const P2_VALUES: Record<string, unknown> = {
  n1: { score: 2 },
  n2: { score: 10 },
  s1: { score: 'a' },
  q1: { score: Number.NaN },
  q2: { score: Number.NEGATIVE_INFINITY },
  q3: { score: Number.POSITIVE_INFINITY },
  q4: {},
  q5: { score: true },
};

function makeNonFiniteFieldDoc(): Y.Doc {
  return freshDoc((root) => {
    const tasks = new Y.Map<unknown>();
    for (const k of P2_INSERTION) tasks.set(k, P2_VALUES[k]);
    root.set('tasks', tasks);
  });
}

describe('W1-P2 D4 non-finite 排序键归不可比尾组（SA2-F1 阻断最小集）', () => {
  it('P2 field 基：NaN / -Infinity / +Infinity 全落尾组，组内键 asc 恒定，两方向组位不变，插入序打乱下锚稳定', () => {
    const doc = makeNonFiniteFieldDoc();

    // 毒值真实 + D8 交叉锚：无预算折叠时，尾组首项 q1（NaN）入选即 fail-fast（不跳项、不补位）。
    // 本 pin 以 depth:0 观察完整键序（同形空壳折叠不读取值、不参与排序键分类，键序观察等价）。
    const unfolded = expectErr(
      mapWindow()(doc, ['tasks'], { n: 9, orderBy: { field: 'score' } }),
      'PATH_NOT_ALLOWED',
    );
    expect(unfolded.path).toStrictEqual(['tasks', 'q1']);

    // asc：number 组数值序 → string 组 → 尾组（q1..q5 键 asc，插入序为 q5,q3,q1,q2,q4）。
    const asc = mapWindow()(doc, ['tasks'], { n: 9, orderBy: { field: 'score' }, depth: 0 });
    expect(keysOf(expectOk(asc))).toStrictEqual(['n1', 'n2', 's1', 'q1', 'q2', 'q3', 'q4', 'q5']);

    // desc：只翻转组内序；组间序与尾组锚（键 asc）恒定——±Inf 归 number 组会挤占首位。
    const desc = mapWindow()(doc, ['tasks'], { n: 9, orderBy: { field: 'score', dir: 'desc' }, depth: 0 });
    expect(keysOf(expectOk(desc))).toStrictEqual(['n2', 'n1', 's1', 'q1', 'q2', 'q3', 'q4', 'q5']);

    // 边界 n=5：两方向都恰装满 3 number + 2 string，尾组零入选；n=5 前缀的第 4/5 位 = q1,q2。
    const asc5 = mapWindow()(doc, ['tasks'], { n: 5, orderBy: { field: 'score' }, depth: 0 });
    expect(keysOf(expectOk(asc5))).toStrictEqual(['n1', 'n2', 's1', 'q1', 'q2']);
    const desc5 = mapWindow()(doc, ['tasks'], { n: 5, orderBy: { field: 'score', dir: 'desc' }, depth: 0 });
    expect(keysOf(expectOk(desc5))).toStrictEqual(['n2', 'n1', 's1', 'q1', 'q2']);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════
// P2b：D4 × D3 —— 数组面值键 non-finite 归尾
// ═════════════════════════════════════════════════════════════════════════════════════

function makeNonFiniteArrayDoc(): Y.Doc {
  return freshDoc((root) => {
    const arr = new Y.Array<unknown>();
    arr.insert(0, [5, Number.NaN, 1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, 'a']);
    root.set('arr', arr);
  });
}

describe('W1-P2b D4 × D3 数组面 non-finite 物化 fail-fast（位置序选窗，issue #376）', () => {
  it('P2b asc 首位 = 下标 0（值 5）、desc 首位 = 下标 5（值 a）；入选即含 non-finite 处 fail-fast（身份 = 位置序端点）', () => {
    const doc = makeNonFiniteArrayDoc();

    // index 基 = 位置序（issue #376）：排序键 = 下标，元素值（含 non-finite）不参与选窗；
    // 非有限标量入选后物化必响（D8）——fail-fast 身份锚定位置序端点，不静默跳项、不以未选项补位。
    const asc1 = expectOk(arrayWindow()(doc, ['arr'], { n: 1 }));
    expect(asc1).toStrictEqual([{ index: 0, value: 5 }]);
    const desc1 = expectOk(arrayWindow()(doc, ['arr'], { n: 1, orderBy: { by: 'index', dir: 'desc' } }));
    expect(desc1).toStrictEqual([{ index: 5, value: 'a' }]);

    // asc 窗口含下标 1（NaN）→ 在该处响；desc 窗口含下标 4（+Inf）→ 在该处响
    for (const n of [2, 3, 4, 6]) {
      const ascN = expectErr(arrayWindow()(doc, ['arr'], { n }), 'PATH_NOT_ALLOWED');
      expect(ascN.path).toStrictEqual(['arr', 1]);
    }
    for (const n of [2, 3, 4, 6]) {
      const descN = expectErr(
        arrayWindow()(doc, ['arr'], { n, orderBy: { by: 'index', dir: 'desc' } }),
        'PATH_NOT_ALLOWED',
      );
      expect(descN.path).toStrictEqual(['arr', 4]);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════
// P3/P4/P5/P6/P7/P8：其余钉死项（同文件必选承载）
// ═════════════════════════════════════════════════════════════════════════════════════

describe('W1-P3 D5 field 单段字面键（点号不拆分、空串合法）', () => {
  it('P3a 含点号的 field 寻址 child 自身字面键：拆分实现会把 c2 钻到 7 → 首位差异（红）', () => {
    const doc = freshDoc((root) => {
      const tasks = new Y.Map<unknown>();
      tasks.set('c2', { a: { b: 7 } });
      tasks.set('c1', { 'a.b': 3 });
      tasks.set('c3', { 'a.b': 'x' });
      root.set('tasks', tasks);
    });
    const r = mapWindow()(doc, ['tasks'], { n: 3, orderBy: { field: 'a.b' } });
    // c1 命中字面键 = 3（number）→ c3 = 'x'（string）→ c2 无 'a.b' 字面键（缺失 → 尾组）。
    expect(keysOf(expectOk(r))).toStrictEqual(['c1', 'c3', 'c2']);
  });

  it('P3b 空串 field 是合法字面键名', () => {
    const doc = freshDoc((root) => {
      const tasks = new Y.Map<unknown>();
      tasks.set('e2', { a: 1 });
      tasks.set('e1', { '': 5 });
      root.set('tasks', tasks);
    });
    const r = mapWindow()(doc, ['tasks'], { n: 2, orderBy: { field: '' } });
    expect(keysOf(expectOk(r))).toStrictEqual(['e1', 'e2']);
  });
});

describe('W1-P4 D6 条目空间：undefined 值键出条目空间', () => {
  it("P4 Y.Map 显式 set('u', undefined) 与 plain object {u: undefined} 的 'u' 均不在条目空间（n 全量窗口，排除恰被截掉）", () => {
    const ymap = new Y.Map<unknown>();
    ymap.set('u', undefined); // 显式 undefined 值键（D12 探针：keys() 含 'u'、get === undefined）
    ymap.set('a', 1);
    const plainObj: Record<string, unknown> = { u: undefined, q: 1 };
    const doc = freshDoc((root) => {
      root.set('ymap', ymap);
      root.set('plainObj', plainObj);
    });

    // fixture 健全性：'u' 确实在原始键空间内（值 undefined）——不是「键不存在」的侥幸通过。
    expect([...ymap.keys()]).toContain('u');
    expect(ymap.get('u')).toBeUndefined();
    expect(Object.keys(plainObj)).toContain('u');

    expect(expectOk(mapWindow()(doc, ['ymap'], { n: 5 }))).toStrictEqual([{ key: 'a', value: 1 }]);
    expect(expectOk(mapWindow()(doc, ['plainObj'], { n: 5 }))).toStrictEqual([{ key: 'q', value: 1 }]);
  });
});

describe('W1-P5 D7 空路径 [] = ROOT 自身', () => {
  it('P5 fresh doc 键面 → []；含键 ROOT → 键窗口；数组面 → WINDOW_CARRIER_MISMATCH', () => {
    const empty = new Y.Doc();
    expect(expectOk(mapWindow()(empty, [], { n: 5 }))).toStrictEqual([]);

    const doc = freshDoc((root) => {
      root.set('b', 2);
      root.set('a', 1);
    });
    expect(expectOk(mapWindow()(doc, [], { n: 5 }))).toStrictEqual([
      { key: 'a', value: 1 },
      { key: 'b', value: 2 },
    ]);
    expectErr(arrayWindow()(doc, [], { n: 1 }), 'WINDOW_CARRIER_MISMATCH'); // ROOT 是 Y.Map
  });
});

describe('W1-P6 D7 detached 目标/项', () => {
  it('P6a 经 plain holder 到达 detached Y.Map → PATH_NOT_ALLOWED（面符但不可读，非 MISMATCH / 非 ABSENT）', () => {
    const doc = freshDoc((root) => {
      root.set('holder', { inner: new Y.Map() });
    });
    expectErr(mapWindow()(doc, ['holder', 'inner'], { n: 1 }), 'PATH_NOT_ALLOWED');
  });

  it('P6b plain array 内 detached Y.Map 项入选 → 物化期同通道 PATH_NOT_ALLOWED（path 精确到项）', () => {
    const doc = freshDoc((root) => {
      root.set('arr', [new Y.Map()]);
    });
    const r = expectErr(arrayWindow()(doc, ['arr'], { n: 1 }), 'PATH_NOT_ALLOWED');
    expect(r.path).toStrictEqual(['arr', 0]);
  });
});

describe('W1-P7 D9/B-5 own 键集自诺', () => {
  it('P7 成功恰三键 {ok,value,total}（ADR 0029 §5/§8 迁移）；失败恰四键 {code,ok,path,message}（含 P1 失败结算）', () => {
    const doc = freshDoc((root) => {
      root.set('arr', [1]);
    });
    const ok = arrayWindow()(doc, ['arr'], { n: 1 }) as WindowResult;
    expect(Object.keys(ok)).toStrictEqual(['ok', 'value', 'total']);

    const absent = mapWindow()(doc, ['missing'], { n: 1 }) as WindowResult;
    expect(Object.keys(absent)).toStrictEqual(['code', 'ok', 'path', 'message']);

    const p1Failure = mapWindow()(makeP1Doc(), ['field'], { n: 3, orderBy: { field: 's' } }) as WindowResult;
    expect(Object.keys(p1Failure)).toStrictEqual(['code', 'ok', 'path', 'message']);
  });
});

describe('W1-P8 D10 / SA2-F2 身份锚码点比较器', () => {
  it('P8 astral 与 BMP 平局键：码点序锚两方向均 [\\uFFFD, \\u{1F600}]（码元序实现反序 → 红）', () => {
    const doc = freshDoc((root) => {
      const tasks = new Y.Map<unknown>();
      tasks.set('\uFFFD', { score: 5 });
      tasks.set('\u{1F600}', { score: 5 });
      root.set('tasks', tasks);
    });
    const asc = mapWindow()(doc, ['tasks'], { n: 2, orderBy: { field: 'score' } });
    expect(keysOf(expectOk(asc))).toStrictEqual(['\uFFFD', '\u{1F600}']); // 0xFFFD < 0x1F600
    const desc = mapWindow()(doc, ['tasks'], { n: 2, orderBy: { field: 'score', dir: 'desc' } });
    expect(keysOf(expectOk(desc))).toStrictEqual(['\uFFFD', '\u{1F600}']); // 组内平局 → 身份锚恒 asc
  });
});
