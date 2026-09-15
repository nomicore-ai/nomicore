/**
 * issue #383（ADR 0029 缝 2）组合层过滤窗口红灯契约 —— namespace-runtime 窗口读公共方法
 * `readArray` / `readMap` 的 where 组合不变量（SA6 §12.3 用例组 A/T/X/K/D/Z/S/F/C + §6 负控）。
 *
 * 契约来源：
 * - issue #383 What-to-build + AC1–AC7；
 * - `wiki/raw/task_issue-383_sa6_contract.md` §12.1 绑定表 B-1–B-15、§12.3 用例组、
 *   §12.7 反伪绿防线、§12.8 红绿判定；
 * - `docs/adr/0029-filtered-window-read.md` §1–§8；`docs/adr/0028-window-read.md` §1/§3/§4/§7/§9；
 * - SA1 设计 §5.1（S6 双语义 + ✂ 结构性不装配）、§5.2（S3 五键镜像）、§5.5（失败面）。
 *
 * 红灯机理（HEAD `de2ff55`，SA6 §5 O2–O10 实测）：`where` 经 W1 成功结算 `total:undefined`
 * 后，组合层入口 fail-closed 分支响亮 `WINDOW_OPTIONS_INVALID`（缝 1 中间态）；`where:
 * undefined`（present-undefined ≡ 缺席）另被 S3 恰四键白名单判为「视图不稳定」→ 出口②。
 * 缝 2 落地后本文件全组转绿；无 where 组（A/C/K2/F5）在 HEAD 即绿，实现后必须保持。
 *
 * 断言纪律（SA6 §12.7）：只观察公共接缝（runtime 方法结果联合、own 键集、条目列表与身份、
 * 投影文本字节、异常观测）；期望一律由**独立预言机**派生（Yjs 原生直数、同运行公共面
 * `readData(锚, 同预算)`、字节锚常量）；零 skip/only/todo、零 env override、零 fallback、
 * 零源码字符串断言；成功形状经集中化 helper（`expectReadDataOkKeys`）
 * 表达（readData 形状断言收敛门作用域含本目录）。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { readMapWindowAtPath } from '@nomicore/doc-runtime';
import type {
  NamespaceRuntime,
  NamespaceRuntimeReadArrayOptions,
  NamespaceRuntimeReadMapOptions,
  RuntimeReadDisabledResult,
} from '../src/index.js';
import { expectReadDataOkKeys } from './helpers/readdata-ok-shape.js';
import {
  CLAIMED,
  makeFilteredRuntime,
  type FilteredRuntimeFixture,
} from '../../namespace-registry/test/issue-383-filtered-window-fixture.js';

// ───────────────────────── 契约常量与文本剥离（与实现零共享） ─────────────────────────

/** ✂ 段头行（ADR-0027 决策 1：截断事实唯一载体；窗口事实块同款文法）。 */
const TRUNCATION_HEADER = '✂ 截断事实：';

/** v1 谓词项（本文件只消费公开词表语义）。 */
interface WhereTermLike {
  readonly field: string;
  readonly equals: string | number | boolean | null;
}

/** ✂ 窗口事实行（B-8 冻结文法四插值槽；字节锚常量）。 */
function factsLine(pathText: string, basis: string, dir: 'asc' | 'desc', kept: number, total: number): string {
  return `${TRUNCATION_HEADER}\n- ${pathText} · 窗口 · 基 ${basis} ${dir} · kept ${String(kept)}/total ${String(total)}`;
}

/** 剥掉 ✂ 段并保留正文自身尾换行（✂ 段恒为文末块、以恰 1 空行分隔）。 */
function bodyBlocks(text: string): string {
  const index = text.lastIndexOf(`\n\n${TRUNCATION_HEADER}`);
  return index < 0 ? text : text.slice(0, index + 1);
}

/** 剥掉 readData 头行（首行 + 首个空行），返回渲染器正文。 */
function readDataBody(text: string): string {
  const index = text.indexOf('\n\n');
  if (index < 0) throw new Error(`契约前提失败：投影文本缺头行分隔：${JSON.stringify(text)}`);
  return text.slice(index + 2);
}

/** 独立预言机（同运行公共面）：同预算 `readData(锚)` 正文 + `‡` 页脚（双侧剥离对账）。 */
function oracleBody(
  runtime: NamespaceRuntime,
  anchor: readonly (string | number)[],
  budget: { readonly depth?: number; readonly maxChildrenPerNode?: number } | undefined,
): string {
  const read = budget === undefined ? runtime.readData(anchor) : runtime.readData(anchor, budget);
  if (!read.ok) throw new Error(`契约前提失败：oracle 读应成功（${JSON.stringify(read)}）`);
  if (read.schema === null) throw new Error(`契约前提失败：oracle 投影文本应非 null（锚 ${anchor.join('.')}）`);
  return bodyBlocks(readDataBody(read.schema));
}

/** 同预算 `readData(项路径).value` —— 组合式 depth 等价锚（AC4）的预言机。 */
function oracleValue(
  runtime: NamespaceRuntime,
  path: readonly (string | number)[],
  budget: { readonly depth?: number; readonly maxChildrenPerNode?: number },
): unknown {
  const read = runtime.readData(path, budget);
  if (!read.ok) throw new Error(`契约前提失败：oracle 项读应成功（${JSON.stringify(read)}）`);
  return read.value;
}

/** 失败面形状（W1 四键失败成员：code/ok/path/message；F11）。 */
function expectWindowFailure(actual: unknown): {
  readonly code: string;
  readonly path: readonly (string | number)[];
  readonly message: string;
} {
  const failure = actual as { ok: boolean; code: string; path: readonly (string | number)[]; message: string };
  expect(failure.ok).toBe(false);
  expect(Object.keys(failure as object).sort()).toEqual(['code', 'message', 'ok', 'path']);
  expect(typeof failure.code).toBe('string');
  expect(Array.isArray(failure.path)).toBe(true);
  expect(typeof failure.message === 'string' && failure.message.length > 0).toBe(true);
  return failure;
}

/** 单次捕获公共面调用：显式区分「返回了结果」与「裸抛逃逸」（敌意输入零外抛唯一断言面）。 */
function capture<T>(call: () => T): { readonly result: T | undefined; readonly escaped: unknown } {
  try {
    return { result: call(), escaped: undefined };
  } catch (error) {
    return { result: undefined, escaped: error };
  }
}

/** ✂ 事实行抽取（窗口事实段恒「头行 + 恰一行事实行」）。 */
function windowFactLines(schema: string | null): string[] {
  if (schema === null) return [];
  return schema.split('\n').filter((line) => line.startsWith('- '));
}

// ── 独立预言机：Yjs 原生直数（零实现复用） ───────────────────────────────────────────

/** ROOT 下的原生 Y.Map（规模/键面样本）。 */
function nativeMap(doc: Y.Doc, key: string): Y.Map<unknown> {
  const value = doc.getMap('ROOT').get(key);
  if (!(value instanceof Y.Map)) throw new Error(`契约前提失败：ROOT.${key} 应为 Y.Map`);
  return value;
}

/** 键面匹配键集预言机（Yjs 原生 `get` 直数；零实现复用）。 */
function claimedKeys(doc: Y.Doc, key: string): string[] {
  const map = nativeMap(doc, key);
  return [...map.keys()].filter((k) => {
    const child = map.get(k);
    return child instanceof Y.Map && child.get('state') === 'claimed';
  });
}

/** 数组面匹配下标预言机（位置序）。 */
function claimedIndexes(doc: Y.Doc, key: string): number[] {
  const value = doc.getMap('ROOT').get(key);
  if (!(value instanceof Y.Array)) throw new Error(`契约前提失败：ROOT.${key} 应为 Y.Array`);
  const out: number[] = [];
  value.forEach((child: unknown, index: number) => {
    if (child instanceof Y.Map && child.get('state') === 'claimed') out.push(index);
  });
  return out;
}

// ── 敌意装置（SA6 §12.3.2 Z 组） ────────────────────────────────────────────────────

/** 抛错 `get` trap 的**合法谓词项**（descriptor 诚实；零 `[[Get]]` 纪律锚；Z1）。 */
function throwingGetTerm(): { readonly term: WhereTermLike; readonly getCalls: () => number } {
  let getCalls = 0;
  const term = new Proxy(
    { field: 'state', equals: 'claimed' },
    {
      get(target, key, receiver) {
        getCalls += 1;
        void target;
        void key;
        void receiver;
        throw new Error('probe: hostile where term get trap');
      },
    },
  );
  return { term: term as unknown as WhereTermLike, getCalls: () => getCalls };
}

/** 抛错 `get` trap 的**合法 where 数组**（`length`/索引 descriptor 诚实；Z2）。 */
function throwingGetWhereArray(): { readonly where: readonly WhereTermLike[]; readonly getCalls: () => number } {
  let getCalls = 0;
  const where = new Proxy([{ field: 'state', equals: 'claimed' }], {
    get(target, key, receiver) {
      getCalls += 1;
      void target;
      void key;
      void receiver;
      throw new Error('probe: hostile where array get trap');
    },
  });
  return { where: where as unknown as readonly WhereTermLike[], getCalls: () => getCalls };
}

/** own accessor 的 where 项（getter 计数；零 accessor 执行纪律；Z3）。 */
function accessorTerm(): { readonly term: WhereTermLike; readonly accessorCalls: () => number } {
  let accessorCalls = 0;
  const item: Record<string, unknown> = { field: 'state' };
  Object.defineProperty(item, 'equals', {
    enumerable: true,
    configurable: true,
    get() {
      accessorCalls += 1;
      return 'claimed';
    },
  });
  return { term: item as unknown as WhereTermLike, accessorCalls: () => accessorCalls };
}

/** 抛错 trap 的谓词项（trap 名可换：ownKeys / getPrototypeOf / getOwnPropertyDescriptor；Z5）。 */
function throwingTrapTerm(
  trap: 'ownKeys' | 'getPrototypeOf' | 'getOwnPropertyDescriptor',
): WhereTermLike {
  const handler: ProxyHandler<{ field: string; equals: string }> = {
    [trap]() {
      throw new Error(`probe: hostile where term ${trap} trap`);
    },
  };
  return new Proxy({ field: 'state', equals: 'claimed' }, handler) as unknown as WhereTermLike;
}

/** 抛错 `getOwnPropertyDescriptor` trap 的 where 数组（length descriptor 读即响；Z5）。 */
function throwingDescriptorWhereArray(): readonly WhereTermLike[] {
  return new Proxy([{ field: 'state', equals: 'claimed' }], {
    getOwnPropertyDescriptor() {
      throw new Error('probe: hostile where array getOwnPropertyDescriptor trap');
    },
  }) as unknown as readonly WhereTermLike[];
}

/** 抛错 `ownKeys` trap 的 where 数组（W1 索引 descriptor 纪律从不触达——零执行锚）。 */
function throwingOwnKeysWhereArray(): { readonly where: readonly WhereTermLike[]; readonly ownKeysCalls: () => number } {
  let ownKeysCalls = 0;
  const where = new Proxy([{ field: 'state', equals: 'claimed' }], {
    ownKeys(target) {
      ownKeysCalls += 1;
      void target;
      throw new Error('probe: hostile where array ownKeys trap');
    },
  });
  return { where: where as unknown as readonly WhereTermLike[], ownKeysCalls: () => ownKeysCalls };
}

/**
 * 状态化 options Proxy（SA6 §12.3.2 Z7/Z8、§12.3.10 S1）：每次 `ownKeys` 前进到下一
 * 「视图」；descriptor 值取自当次视图。视图序与实现调用序一一对应：
 * ① W1 权威校验 → ② S3 canonical 净化 → ③（仅当净化失败）出口①重派发 W1。
 */
function statefulOptionsProxy(views: ReadonlyArray<Record<string, unknown>>): {
  readonly options: object;
  readonly viewCount: () => number;
} {
  let view = 0;
  const sourceOf = (): Record<string, unknown> => views[Math.min(Math.max(view - 1, 0), views.length - 1)]!;
  const proxy = new Proxy({} as Record<string, unknown>, {
    ownKeys() {
      if (view < views.length) view += 1;
      return Object.keys(sourceOf());
    },
    getOwnPropertyDescriptor(_target, key) {
      const source = sourceOf();
      if (typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(source, key)) return undefined;
      return { configurable: true, enumerable: true, writable: true, value: source[key] };
    },
  });
  return { options: proxy as object, viewCount: () => view };
}

/** 状态化 `getOwnPropertyDescriptor` trap 的合法窗口 options（视图不稳定两出口；S1b）。 */
function statefulDescriptorOptions(throwFromCall: number): { readonly options: object; readonly calls: () => number } {
  let calls = 0;
  const options = new Proxy(
    { n: 2 },
    {
      getOwnPropertyDescriptor(target, key) {
        calls += 1;
        if (calls >= throwFromCall) throw new Error('probe: stateful window descriptor trap');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    },
  );
  return { options, calls: () => calls };
}

/** 交替 `getOwnPropertyDescriptor` trap（仅第 `throwOnCall` 次抛错 → 重派发竟又接受；出口②）。 */
function alternatingDescriptorOptions(throwOnCall: number): { readonly options: object; readonly calls: () => number } {
  let calls = 0;
  const options = new Proxy(
    { n: 2 },
    {
      getOwnPropertyDescriptor(target, key) {
        calls += 1;
        if (calls === throwOnCall) throw new Error('probe: alternating window descriptor trap');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    },
  );
  return { options, calls: () => calls };
}

/** trap 计数 options（lifecycle≠ready 期零 options 读取；C3；target 直建以免构造期自计数）。 */
function trapCountingOptions(target: object): { readonly options: object; readonly calls: () => number } {
  let calls = 0;
  const options = new Proxy(
    target,
    {
      get(target, key, receiver) {
        calls += 1;
        return Reflect.get(target, key, receiver);
      },
      getOwnPropertyDescriptor(target, key) {
        calls += 1;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
      ownKeys(target) {
        calls += 1;
        return Reflect.ownKeys(target);
      },
      has(target, key) {
        calls += 1;
        return Reflect.has(target, key);
      },
    },
  );
  return { options, calls: () => calls };
}

/** 每用例独立装配（close/release 用例会消耗自己的实例——不得共享）。 */
async function fixture(options: { readonly heavy?: boolean } = {}): Promise<FilteredRuntimeFixture> {
  return makeFilteredRuntime(options);
}

// ══════════════════════════ A 组（AC1）：无 where 零漂移 ══════════════════════════

describe('A 组（AC1）：无 where 结算与 ADR 0028 快照逐字节一致', () => {
  it('A1 键面 n=2：恒四键、keys [t1,t2]、truncated === kept < 独立预言机 total、✂ 事实行逐字节', async () => {
    const { runtime, doc } = await fixture();
    const result = runtime.readMap(['tasks'], { n: 2 });
    expectReadDataOkKeys(result);
    if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(result)}`);
    const map = nativeMap(doc, 'tasks');
    const total = [...map.keys()].filter((k) => map.get(k) !== undefined).length;
    expect(total).toBe(5); // 独立预言机：标识计数
    expect(result.value.map((entry) => entry.key)).toStrictEqual(['t1', 't2']);
    expect(result.truncated).toBe(2 < total);
    const body = oracleBody(runtime, ['tasks', '<key>'], undefined).replace(/\n$/u, '');
    expect(result.schema).toBe(`${body}\n\n${factsLine('tasks', 'key', 'asc', 2, total)}\n`);
    expect(windowFactLines(result.schema)).toHaveLength(1);
    await runtime.close();
  });

  it('A2 键面 n=5：无截断、schema 逐字节 = 元素口径正文、无 ✂', async () => {
    const { runtime } = await fixture();
    const result = runtime.readMap(['tasks'], { n: 5 });
    expectReadDataOkKeys(result);
    if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(result)}`);
    expect(result.value.map((entry) => entry.key)).toStrictEqual(['t1', 't2', 't3', 't4', 't5']);
    expect(result.truncated).toBe(false);
    expect(result.schema).toBe(oracleBody(runtime, ['tasks', '<key>'], undefined));
    expect(result.schema).not.toContain(TRUNCATION_HEADER);
    await runtime.close();
  });

  it('A3 数组面 desc depth=1：自尾取窗、✂ 事实行逐字节、schema = 元素口径 oracle', async () => {
    const { runtime, doc } = await fixture();
    const budget = { depth: 1 } as const;
    const result = runtime.readArray(['taskList'], { n: 1, orderBy: { by: 'index', dir: 'desc' }, ...budget });
    expectReadDataOkKeys(result);
    if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(result)}`);
    const total = (doc.getMap('ROOT').get('taskList') as Y.Array<unknown>).length;
    expect(total).toBe(3); // 独立预言机：数组元素空间
    expect(result.value.map((entry) => entry.index)).toStrictEqual([2]);
    expect(result.truncated).toBe(1 < total);
    const body = oracleBody(runtime, ['taskList', 0], budget).replace(/\n$/u, '');
    expect(result.schema).toBe(`${body}\n\n${factsLine('taskList', 'index', 'desc', 1, total)}\n`);
    await runtime.close();
  });

  it('A4 空容器与满窗对照：空 Record → value:[]、truncated:false、无 ✂；标量数组 n=全量 → 无 ✂', async () => {
    const { runtime, doc } = await fixture();
    const emptyRecord = runtime.readMap(['emptyTasks'], { n: 2 });
    expectReadDataOkKeys(emptyRecord);
    if (!emptyRecord.ok) throw new Error(`契约前提失败：${JSON.stringify(emptyRecord)}`);
    expect(emptyRecord.value).toStrictEqual([]);
    expect(emptyRecord.truncated).toBe(false);
    expect(emptyRecord.schema).not.toContain(TRUNCATION_HEADER);

    // 标量数组全量窗（独立预言机 total = 元素空间）：kept === total → 无截断 ⟹ 无 ✂。
    const scalar = doc.getMap('ROOT').get('scalarList');
    if (!(scalar instanceof Y.Array)) throw new Error('契约前提失败：ROOT.scalarList 应为 Y.Array');
    const fullWindow = runtime.readArray(['scalarList'], { n: scalar.length });
    expectReadDataOkKeys(fullWindow);
    if (!fullWindow.ok) throw new Error(`契约前提失败：${JSON.stringify(fullWindow)}`);
    expect(fullWindow.value.map((entry) => entry.index)).toStrictEqual([0, 1, 2]);
    expect(fullWindow.truncated).toBe(3 < scalar.length);
    expect(fullWindow.schema).not.toContain(TRUNCATION_HEADER);
    await runtime.close();
  });

  it('A6 幂等零漂移：同参两次调用结果逐字段相同（无缓存、无隐藏状态）', async () => {
    const { runtime } = await fixture();
    const first = runtime.readMap(['tasks'], { n: 2 });
    const second = runtime.readMap(['tasks'], { n: 2 });
    expect(second).toStrictEqual(first);
    const firstArray = runtime.readArray(['taskList'], { n: 2, orderBy: { by: 'index', dir: 'desc' } });
    const secondArray = runtime.readArray(['taskList'], { n: 2, orderBy: { by: 'index', dir: 'desc' } });
    expect(secondArray).toStrictEqual(firstArray);
    await runtime.close();
  });
});

// ══════════════════════ T 组（AC2）：truncated 双语义 ══════════════════════════

describe('T 组（AC2）：where 在场 truncated === (kept === n)；离场 === kept < total', () => {
  it('T1–T3 键面装满/扫完：n=5 → false（3<5）；n=3 → true（恰 n）；n=2 → true', async () => {
    const { runtime } = await fixture();
    for (const [n, keys, truncated] of [
      [5, ['t1', 't3', 't5'], false],
      [3, ['t1', 't3', 't5'], true],
      [2, ['t1', 't3'], true],
    ] as const) {
      const result = runtime.readMap(['tasks'], { n, where: [...CLAIMED] });
      expectReadDataOkKeys(result);
      if (!result.ok) throw new Error(`契约前提失败：n=${n}（${JSON.stringify(result)}）`);
      expect(result.value.map((entry) => entry.key), `n=${n} 匹配集`).toStrictEqual([...keys]);
      expect(result.truncated, `n=${n} 装满判定`).toBe(truncated);
    }
    await runtime.close();
  });

  it('T4 恰 n 匹配（exactTasks 恰 5 条 claimed）：kept 5 === n 5 → true（计数型实现必红）', async () => {
    const { runtime, doc } = await fixture();
    const oracle = claimedKeys(doc, 'exactTasks');
    expect(oracle).toHaveLength(5); // 独立预言机：恰 5 条
    const result = runtime.readMap(['exactTasks'], { n: 5, where: [...CLAIMED] });
    if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(result)}`);
    // 匹配集按码点序入窗（与 Yjs 键插入序无关）：集合等价对账。
    expect([...result.value.map((entry) => entry.key)].sort()).toStrictEqual([...oracle].sort());
    expect(result.truncated).toBe(true);
    await runtime.close();
  });

  it('T5/T6 规模 2000 条（恰 3 条 claimed）：n=5 → false（扫完了）；n=3 → true（装满）', async () => {
    const { runtime, doc } = await fixture({ heavy: true });
    const oracle = claimedKeys(doc, 'bigTasks');
    expect(oracle).toHaveLength(3);
    const wide = runtime.readMap(['bigTasks'], { n: 5, where: [...CLAIMED] });
    if (!wide.ok) throw new Error(`契约前提失败：${JSON.stringify(wide)}`);
    expect(wide.value.map((entry) => entry.key)).toStrictEqual(oracle);
    expect(wide.truncated).toBe(false); // kept 3 < n 5：扫完了，确定没有更多

    const exact = runtime.readMap(['bigTasks'], { n: 3, where: [...CLAIMED] });
    if (!exact.ok) throw new Error(`契约前提失败：${JSON.stringify(exact)}`);
    expect(exact.value.map((entry) => entry.key)).toStrictEqual(oracle);
    expect(exact.truncated).toBe(true); // kept 3 === n 3：可能还有
    await runtime.close();
  });

  it('T7/T8 标量元素（数组面）与空容器（键面）：全安静不匹配 → value:[]、0 !== n → false', async () => {
    const { runtime } = await fixture();
    const scalar = runtime.readArray(['scalarList'], { n: 5, where: [...CLAIMED] });
    const empty = runtime.readMap(['emptyTasks'], { n: 5, where: [...CLAIMED] });
    for (const [name, result] of [['scalarList', scalar], ['emptyTasks', empty]] as const) {
      if (!result.ok) throw new Error(`契约前提失败：${name}（${JSON.stringify(result)}）`);
      expect(result.value, name).toStrictEqual([]);
      expect(result.truncated, name).toBe(false);
      expect(result.schema, name).not.toContain(TRUNCATION_HEADER);
    }
    await runtime.close();
  });

  it('T9 数组面位置序：n=1 → [0] true；n=2 → [0,2] true；n=3 → [0,2] false（2 < 3）', async () => {
    const { runtime, doc } = await fixture();
    const oracle = claimedIndexes(doc, 'taskList');
    expect(oracle).toStrictEqual([0, 2]); // 独立预言机：位置序
    for (const [n, indexes, truncated] of [
      [1, [0], true],
      [2, [0, 2], true],
      [3, [0, 2], false],
    ] as const) {
      const result = runtime.readArray(['taskList'], { n, where: [...CLAIMED] });
      if (!result.ok) throw new Error(`契约前提失败：n=${n}（${JSON.stringify(result)}）`);
      expect(result.value.map((entry) => entry.index), `n=${n}`).toStrictEqual([...indexes]);
      expect(result.truncated, `n=${n} 装满判定`).toBe(truncated);
    }
    await runtime.close();
  });

  it('T10 present-undefined ≡ 缺席（B-12）：走无 where 精确语义（2 < 5 → true、✂ 在场）', async () => {
    const { runtime } = await fixture();
    const result = runtime.readMap(['tasks'], { n: 2, where: undefined } as never);
    expectReadDataOkKeys(result);
    if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(result)}`);
    expect(result.value.map((entry) => entry.key)).toStrictEqual(['t1', 't2']);
    expect(result.truncated).toBe(true); // 无 where 精确语义：kept 2 < total 5
    expect(result.schema).toContain(TRUNCATION_HEADER);
    await runtime.close();
  });

  it('T12 管线序 where → orderBy → n：键面 desc/asc 与数组面 desc', async () => {
    const { runtime } = await fixture();
    const desc = runtime.readMap(['tasks'], { n: 2, where: [...CLAIMED], orderBy: { field: 'priority', dir: 'desc' } });
    if (!desc.ok) throw new Error(`契约前提失败：${JSON.stringify(desc)}`);
    expect(desc.value.map((entry) => entry.key)).toStrictEqual(['t3', 't1']); // 5,2

    const asc = runtime.readMap(['tasks'], { n: 2, where: [...CLAIMED], orderBy: { field: 'priority', dir: 'asc' } });
    if (!asc.ok) throw new Error(`契约前提失败：${JSON.stringify(asc)}`);
    expect(asc.value.map((entry) => entry.key)).toStrictEqual(['t5', 't1']); // 1,2

    const arr = runtime.readArray(['taskList'], { n: 1, where: [...CLAIMED], orderBy: { by: 'index', dir: 'desc' } });
    if (!arr.ok) throw new Error(`契约前提失败：${JSON.stringify(arr)}`);
    expect(arr.value.map((entry) => entry.index)).toStrictEqual([2]);
    await runtime.close();
  });

  it('T13 脏值安静不匹配：dirty {n:5, …claimed} → 恰 d1、truncated false、不炸读', async () => {
    const { runtime } = await fixture();
    const result = runtime.readMap(['dirty'], { n: 5, where: [...CLAIMED] });
    if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(result)}`);
    expect(result.value.map((entry) => entry.key)).toStrictEqual(['d1']);
    expect(result.truncated).toBe(false);
    await runtime.close();
  });

  it('T14 无 where 同场对照：tasks {n:2} → true（2 < 5）——与 T3 同 kept 不同语义', async () => {
    const { runtime } = await fixture();
    const noWhere = runtime.readMap(['tasks'], { n: 2 });
    const withWhere = runtime.readMap(['tasks'], { n: 2, where: [...CLAIMED] });
    if (!noWhere.ok || !withWhere.ok) throw new Error('契约前提失败：两次读应成功');
    expect(noWhere.value).toHaveLength(2);
    expect(withWhere.value).toHaveLength(2);
    expect(noWhere.truncated).toBe(true);
    expect(withWhere.truncated).toBe(true);
    // 语义分界锚：无 where 的 truncated 由独立预言机 total 派生，where 面由 canonical n 派生。
    expect(noWhere.schema).toContain(TRUNCATION_HEADER);
    expect(withWhere.schema).not.toContain(TRUNCATION_HEADER);
    await runtime.close();
  });
});

// ═════════════════ X 组（AC2）：✂ 永不装配 + schema 通道 ═══════════════════════

describe('X 组（AC2）：有 where 时 ✂ 永不装配、schema 通道仍为元素口径', () => {
  it('X1/X7 where 与无 where 对照 schema 字节相等、无 ✂、无过滤槽', async () => {
    const { runtime } = await fixture();
    const where = runtime.readMap(['tasks'], { n: 2, where: [...CLAIMED] });
    const control = runtime.readMap(['tasks'], { n: 5 });
    if (!where.ok || !control.ok) throw new Error('契约前提失败：两次读应成功');
    expect(where.schema).toBe(control.schema);
    expect(where.schema).not.toContain(TRUNCATION_HEADER);
    expect(where.schema?.includes('✂')).toBe(false);
    expect(where.schema).not.toContain('where');
    expect(where.schema).not.toContain('过滤');
    await runtime.close();
  });

  it('X2 canonical 预算两轴在 where 在场时仍被完整消费（schema 与对照字节相等）', async () => {
    const { runtime } = await fixture();
    const budget = { depth: 1, maxChildrenPerNode: 1 } as const;
    const where = runtime.readMap(['tasks'], { n: 2, where: [...CLAIMED], ...budget });
    const control = runtime.readMap(['tasks'], { n: 5, ...budget });
    if (!where.ok || !control.ok) throw new Error('契约前提失败：两次读应成功');
    expect(where.schema).toBe(control.schema);
    expect(where.schema).toBe(oracleBody(runtime, ['tasks', '<key>'], budget));
    expect(where.schema).not.toContain(TRUNCATION_HEADER);
    await runtime.close();
  });

  it('X3 数组面 where depth=1：schema 与无 where 对照字节相等、无 ✂', async () => {
    const { runtime } = await fixture();
    const budget = { depth: 1 } as const;
    const where = runtime.readArray(['taskList'], { n: 1, where: [...CLAIMED], ...budget });
    const control = runtime.readArray(['taskList'], { n: 3, ...budget }); // 全量窗（无截断 ⟹ 正文无 ✂）
    if (!where.ok || !control.ok) throw new Error('契约前提失败：两次读应成功');
    expect(where.schema).toBe(control.schema);
    expect(where.schema).not.toContain(TRUNCATION_HEADER);
    await runtime.close();
  });

  it('X4 标量数组 where：schema 非 null（元素口径 number）、无 ✂', async () => {
    const { runtime } = await fixture();
    const result = runtime.readArray(['scalarList'], { n: 5, where: [...CLAIMED] });
    if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(result)}`);
    expect(result.schema).not.toBeNull();
    expect(result.schema).toContain('number');
    expect(result.schema).not.toContain(TRUNCATION_HEADER);
    await runtime.close();
  });

  it('X5 路径偏离 schema（rawHidden）：schema === null（锚失败非读失败）、四键仍然、truncated 照 B-5', async () => {
    const { runtime, doc } = await fixture();
    const oracle = claimedKeys(doc, 'rawHidden');
    expect(oracle).toHaveLength(2);
    const result = runtime.readMap(['rawHidden'], { n: 2, where: [...CLAIMED] });
    expectReadDataOkKeys(result);
    if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(result)}`);
    expect(result.value.map((entry) => entry.key)).toStrictEqual(oracle);
    expect(result.schema).toBeNull();
    expect(result.truncated).toBe(true); // kept 2 === n 2（装满判定与 schema 通道正交）
    await runtime.close();
  });

  it('X6 无 where 截断对照：✂ 事实行逐字节（F8 冻结：有 where 不装配 ≠ 无 where 不装配）', async () => {
    const { runtime } = await fixture();
    const result = runtime.readMap(['tasks'], { n: 2 });
    if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(result)}`);
    expect(result.schema).toContain(factsLine('tasks', 'key', 'asc', 2, 5));
    expect(windowFactLines(result.schema)).toHaveLength(1);
    await runtime.close();
  });
});

// ═══════════════ K 组（AC3）：恒四键 own 键集 + 条目身份随行 ═══════════════

describe('K 组（AC3）：成功恒四键（无 total 键）、条目身份可拼下一轮路径', () => {
  it('K1 where 成功面（键面 + 数组面）恰 {ok,value,schema,truncated}、无第五键', async () => {
    const { runtime } = await fixture();
    for (const result of [
      runtime.readMap(['tasks'], { n: 2, where: [...CLAIMED] }),
      runtime.readArray(['taskList'], { n: 2, where: [...CLAIMED] }),
    ]) {
      expectReadDataOkKeys(result);
      expect('total' in (result as object)).toBe(false);
      if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(result)}`);
      expect(result.truncated).toBe(true);
    }
    await runtime.close();
  });

  it('K3 身份回环：入口身份拼深层路径的同预算读 ≡ entry.value', async () => {
    const { runtime } = await fixture();
    const budget = { depth: 1 } as const;
    const map = runtime.readMap(['tasks'], { n: 5, where: [...CLAIMED], ...budget });
    if (!map.ok) throw new Error(`契约前提失败：${JSON.stringify(map)}`);
    for (const entry of map.value) {
      expect(entry.value, `键面 ${entry.key}`).toStrictEqual(oracleValue(runtime, ['tasks', entry.key], budget));
    }
    const array = runtime.readArray(['taskList'], { n: 2, where: [...CLAIMED], ...budget });
    if (!array.ok) throw new Error(`契约前提失败：${JSON.stringify(array)}`);
    for (const entry of array.value) {
      expect(entry.value, `数组面 ${entry.index}`).toStrictEqual(
        oracleValue(runtime, ['taskList', entry.index], budget),
      );
    }
    await runtime.close();
  });

  it('K4 数组面身份 = 原容器位置（过滤后不重编号）：[0,2]，且 index 2 深读命中第三项', async () => {
    const { runtime } = await fixture();
    const result = runtime.readArray(['taskList'], { n: 2, where: [...CLAIMED] });
    if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(result)}`);
    expect(result.value.map((entry) => entry.index)).toStrictEqual([0, 2]);
    const third = runtime.readData(['taskList', 2]);
    if (!third.ok) throw new Error('契约前提失败：项路径深读应成功');
    expect(result.value[1]?.value).toStrictEqual(third.value);
    await runtime.close();
  });

  it('K5 键面匹配集总序（field desc）：keys [t3,t1,t5]，身份可回读', async () => {
    const { runtime } = await fixture();
    const result = runtime.readMap(['tasks'], { n: 5, where: [...CLAIMED], orderBy: { field: 'priority', dir: 'desc' } });
    if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(result)}`);
    expect(result.value.map((entry) => entry.key)).toStrictEqual(['t3', 't1', 't5']);
    for (const entry of result.value) {
      const again = runtime.readData(['tasks', entry.key]);
      if (!again.ok) throw new Error('契约前提失败：身份回读应成功');
      expect(again.value).toStrictEqual(entry.value);
    }
    await runtime.close();
  });
});

// ═══════════════ D 组（AC4）：组合式 depth 等价锚 ═══════════════

describe('D 组（AC4）：过滤入选项 ≡ 同预算 readData(项路径)', () => {
  it('D1 键面 depth/maxChildrenPerNode：每条目 ≡ 同预算 readData 值', async () => {
    const { runtime } = await fixture();
    const budget = { depth: 1, maxChildrenPerNode: 2 } as const;
    const result = runtime.readMap(['tasks'], { n: 5, where: [...CLAIMED], ...budget });
    if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(result)}`);
    expect(result.value).toHaveLength(3);
    for (const entry of result.value) {
      expect(entry.value, entry.key).toStrictEqual(oracleValue(runtime, ['tasks', entry.key], budget));
    }
    await runtime.close();
  });

  it('D2 数组面 depth=1：每条目 ≡ 同预算 readData（未匹配项零物化）', async () => {
    const { runtime } = await fixture();
    const budget = { depth: 1 } as const;
    const result = runtime.readArray(['taskList'], { n: 2, where: [...CLAIMED], ...budget });
    if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(result)}`);
    expect(result.value.map((entry) => entry.index)).toStrictEqual([0, 2]);
    for (const entry of result.value) {
      expect(entry.value, String(entry.index)).toStrictEqual(oracleValue(runtime, ['taskList', entry.index], budget));
    }
    await runtime.close();
  });

  it('D4 depth:0 + maxChildrenPerNode:0（where 在场）：折叠壳与同预算 readData 一致', async () => {
    const { runtime } = await fixture();
    const budget = { depth: 0, maxChildrenPerNode: 0 } as const;
    const result = runtime.readMap(['tasks'], { n: 2, where: [...CLAIMED], ...budget });
    if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(result)}`);
    for (const entry of result.value) {
      expect(entry.value, entry.key).toStrictEqual(oracleValue(runtime, ['tasks', entry.key], budget));
    }
    await runtime.close();
  });

  it('D5 未匹配项埋毒（poisonScored 1998 条 payload NaN）：零重物化/零重过滤', async () => {
    const { runtime, doc } = await fixture({ heavy: true });
    const oracle = claimedKeys(doc, 'poisonScored');
    expect(oracle).toHaveLength(2);
    const budget = { depth: 1 } as const;
    const result = runtime.readMap(['poisonScored'], { n: 2, where: [...CLAIMED], ...budget });
    if (!result.ok) throw new Error(`契约前提失败（重走未匹配项会得 PATH_NOT_ALLOWED）：${JSON.stringify(result)}`);
    expect(result.value.map((entry) => entry.key)).toStrictEqual(oracle);
    expect(result.truncated).toBe(true);
    for (const entry of result.value) {
      expect(entry.value).toStrictEqual(oracleValue(runtime, ['poisonScored', entry.key], budget));
    }
    await runtime.close();
  });
});

// ═══════════════ Z 组（AC5）：S3 两出口对 where 判据同步 ═══════════════
//
// 已登记暴露类（SA1 设计 §8 表后注 / SA2 观察 3，非本票新风险）：W1 视图与 S3 视图**各自
// 合法但轴值漂移**（如 `n`：W1 视图 3、S3 视图 5）时，装满判定取 S3 canonical `n`——敌意
// 调用方可得 false-negative `truncated`。与既有 `canonical.term`（✂ 基槽）/`canonical.budget`
// （锚链预算）同族：#369 已接受「两出口纪律只覆盖判据违例、不覆盖双合法值漂移」，组合层
// 结构上无 W1 视图 `n` 可比对（无更优解）。故不新增用例、不开新出口。

describe('Z 组（AC5）：敌意 where 零外抛；S3 镜像判据与 W1 一致（两出口同步）', () => {
  it('Z1 where 项挂抛错 get trap（descriptor 诚实）：成功、条目恰匹配、getCalls === 0', async () => {
    const { runtime } = await fixture();
    const probe = throwingGetTerm();
    const call = capture(() => runtime.readMap(['tasks'], { n: 5, where: [probe.term] } as never));
    expect(call.escaped, '敌意 where 不得外抛').toBeUndefined();
    const result = call.result!;
    if (!result.ok) throw new Error(`契约前提失败：应成功（${JSON.stringify(result)}）`);
    expect(result.value.map((entry) => entry.key)).toStrictEqual(['t1', 't3', 't5']);
    expect(result.truncated).toBe(false);
    expect(probe.getCalls(), '零 [[Get]] 纪律').toBe(0);
    await runtime.close();
  });

  it('Z2 where 数组挂抛错 get trap（length/索引 descriptor 诚实）：成功、getCalls === 0、零外抛', async () => {
    const { runtime } = await fixture();
    const probe = throwingGetWhereArray();
    const call = capture(() => runtime.readMap(['tasks'], { n: 2, where: probe.where } as never));
    expect(call.escaped).toBeUndefined();
    const result = call.result!;
    if (!result.ok) throw new Error(`契约前提失败：应成功（${JSON.stringify(result)}）`);
    expect(result.value.map((entry) => entry.key)).toStrictEqual(['t1', 't3']);
    expect(probe.getCalls()).toBe(0);
    await runtime.close();
  });

  it('Z3 where 元素为 own accessor：WINDOW_OPTIONS_INVALID、accessor 计数 === 0、零外抛', async () => {
    const { runtime } = await fixture();
    const probe = accessorTerm();
    const call = capture(() => runtime.readMap(['tasks'], { n: 2, where: [probe.term] } as never));
    expect(call.escaped).toBeUndefined();
    const failure = expectWindowFailure(call.result);
    expect(failure.code).toBe('WINDOW_OPTIONS_INVALID');
    expect(failure.path).toStrictEqual(['tasks']);
    expect(probe.accessorCalls()).toBe(0);
    await runtime.close();
  });

  it('Z4 where 项含未知键（含 present-undefined 未知键）：WINDOW_OPTIONS_INVALID', async () => {
    const { runtime } = await fixture();
    for (const term of [
      { field: 'state', equals: 'claimed', extra: 1 },
      { field: 'state', equals: 'claimed', extra: undefined },
    ]) {
      const failure = expectWindowFailure(runtime.readMap(['tasks'], { n: 2, where: [term] } as never));
      expect(failure.code).toBe('WINDOW_OPTIONS_INVALID');
    }
    await runtime.close();
  });

  it('Z5 敌意 trap（ownKeys/getPrototypeOf/getOwnPropertyDescriptor）：响亮收编、零外抛', async () => {
    const { runtime } = await fixture();
    const cases: ReadonlyArray<readonly [string, readonly WhereTermLike[]]> = [
      ['项 ownKeys trap', [throwingTrapTerm('ownKeys')]],
      ['项 getPrototypeOf trap', [throwingTrapTerm('getPrototypeOf')]],
      ['项 getOwnPropertyDescriptor trap', [throwingTrapTerm('getOwnPropertyDescriptor')]],
      ['数组 getOwnPropertyDescriptor trap', throwingDescriptorWhereArray()],
    ];
    for (const [name, where] of cases) {
      const call = capture(() => runtime.readMap(['tasks'], { n: 2, where } as never));
      expect(call.escaped, `${name}：不得外抛`).toBeUndefined();
      expect(expectWindowFailure(call.result).code, name).toBe('WINDOW_OPTIONS_INVALID');
    }
    // 数组 ownKeys trap：W1 的索引 descriptor 纪律从不触达（零执行 ⟹ 合法视图照常成功）。
    const ownKeys = throwingOwnKeysWhereArray();
    const call = capture(() => runtime.readMap(['tasks'], { n: 5, where: ownKeys.where } as never));
    expect(call.escaped).toBeUndefined();
    if (!call.result!.ok) throw new Error(`契约前提失败：${JSON.stringify(call.result)}`);
    expect(ownKeys.ownKeysCalls()).toBe(0);
    await runtime.close();
  });

  it('Z6 词表外/非法形状矩阵：全部 WINDOW_OPTIONS_INVALID、零外抛', async () => {
    const { runtime } = await fixture();
    const sparse: unknown[] = [];
    sparse.length = 1; // 稀疏空洞
    const seventeen = Array.from({ length: 17 }, (_, i) => ({ field: `f${i}`, equals: i }));
    const nonPlain = new (class {
      readonly field = 'state';
      readonly equals = 'claimed';
    })();
    const cases: ReadonlyArray<readonly [string, unknown]> = [
      ['非数组（字符串）', 'claimed'],
      ['非数组（对象）', {}],
      ['非数组（null）', null],
      ['非数组（数字）', 42],
      ['非数组（Y.Array）', new Y.Array()],
      ['数组空洞', sparse],
      ['空数组', []],
      ['17 项（超上限）', seventeen],
      ['equals NaN', [{ field: 'state', equals: Number.NaN }]],
      ['equals Infinity', [{ field: 'state', equals: Number.POSITIVE_INFINITY }]],
      ['equals -Infinity', [{ field: 'state', equals: Number.NEGATIVE_INFINITY }]],
      ['equals 对象', [{ field: 'state', equals: { x: 1 } }]],
      ['equals 数组', [{ field: 'state', equals: [] }]],
      ['equals symbol', [{ field: 'state', equals: Symbol('s') }]],
      ['equals 函数', [{ field: 'state', equals: () => 'claimed' }]],
      ['非 plain 原型项', [nonPlain]],
      ['field 缺失', [{ equals: 'claimed' }]],
      ['equals 缺失', [{ field: 'state' }]],
    ];
    for (const [name, where] of cases) {
      const call = capture(() => runtime.readMap(['tasks'], { n: 2, where } as never));
      expect(call.escaped, `${name}：不得外抛`).toBeUndefined();
      expect(expectWindowFailure(call.result).code, name).toBe('WINDOW_OPTIONS_INVALID');
    }
    await runtime.close();
  });

  it('Z6b Y3 注册项：同面 excess orderBy `{by:\'key\', field:\'x\'}` 运行时响亮拒绝（编译期接受）', async () => {
    const { runtime } = await fixture();
    const call = capture(() =>
      runtime.readMap(['tasks'], { n: 2, orderBy: { by: 'key', field: 'x' } } as NamespaceRuntimeReadMapOptions),
    );
    expect(call.escaped).toBeUndefined();
    expect(expectWindowFailure(call.result).code).toBe('WINDOW_OPTIONS_INVALID');
    await runtime.close();
  });

  it('Z7 出口①：视图②违规 where + 视图③仍违规 → W1 失败成员原样透传（四键）', async () => {
    const { runtime } = await fixture();
    const bad = accessorTerm().term;
    const probe = statefulOptionsProxy([
      { n: 2, where: [{ field: 'state', equals: 'claimed' }] },
      { n: 2, where: [bad] },
      { n: 2, where: [bad] },
    ]);
    const call = capture(() =>
      runtime.readMap(['tasks'], probe.options as unknown as NamespaceRuntimeReadMapOptions),
    );
    expect(call.escaped).toBeUndefined();
    const failure = expectWindowFailure(call.result);
    expect(failure.code).toBe('WINDOW_OPTIONS_INVALID');
    expect(failure.path).toStrictEqual(['tasks']);
    expect(probe.viewCount()).toBe(3); // W1 → S3 → 重派发 W1
    await runtime.close();
  });

  it('Z8 出口②：交替视图（视图③合法）→ 接缝终态 WINDOW_OPTIONS_INVALID（绝不 ok:true 静默通过）', async () => {
    const { runtime } = await fixture();
    const bad = accessorTerm().term;
    const probe = statefulOptionsProxy([
      { n: 2, where: [{ field: 'state', equals: 'claimed' }] },
      { n: 2, where: [bad] },
      { n: 2, where: [{ field: 'state', equals: 'claimed' }] },
    ]);
    const call = capture(() =>
      runtime.readMap(['tasks'], probe.options as unknown as NamespaceRuntimeReadMapOptions),
    );
    expect(call.escaped).toBeUndefined();
    const result = call.result!;
    expect(result.ok, '交替视图不得静默通过').toBe(false);
    const failure = expectWindowFailure(result);
    expect(failure.code).toBe('WINDOW_OPTIONS_INVALID');
    expect(failure.message).toContain('视图不稳定');
    await runtime.close();
  });

  it('Z9 恰 16 项（全不匹配）合法：ok:true、value:[]、truncated false（不是「见 where 即拒」）', async () => {
    const { runtime } = await fixture();
    const where = Array.from({ length: 16 }, (_, i) => ({ field: `f${i}`, equals: 'nope' }));
    const result = runtime.readMap(['tasks'], { n: 2, where });
    if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(result)}`);
    expect(result.value).toStrictEqual([]);
    expect(result.truncated).toBe(false);
    await runtime.close();
  });

  it('Z10 同 field 重复项：合取语义、匹配集恰 claimed 集合', async () => {
    const { runtime } = await fixture();
    const result = runtime.readMap(['tasks'], {
      n: 5,
      where: [
        { field: 'state', equals: 'claimed' },
        { field: 'state', equals: 'claimed' },
      ],
    });
    if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(result)}`);
    expect(result.value.map((entry) => entry.key)).toStrictEqual(['t1', 't3', 't5']);
    await runtime.close();
  });

  it('Z11 equals falsy 闭集：\'\' / false / 0 / null 各自命中（null 不匹配 field 缺席）', async () => {
    const { runtime } = await fixture();
    const cases: ReadonlyArray<readonly [string, readonly WhereTermLike[], readonly string[], readonly string[]]> = [
      ['state=""', [{ field: 'state', equals: '' }], ['edge'], ['e0']],
      ['flag=false', [{ field: 'flag', equals: false }], ['edge'], ['e0']],
      ['count=0', [{ field: 'count', equals: 0 }], ['edge'], ['e0']],
      ['state=null', [{ field: 'state', equals: null }], ['nullState'], ['n1']],
    ];
    for (const [name, where, path, keys] of cases) {
      const result = runtime.readMap(path, { n: 5, where });
      if (!result.ok) throw new Error(`契约前提失败：${name}（${JSON.stringify(result)}）`);
      expect(result.value.map((entry) => entry.key), name).toStrictEqual([...keys]);
    }
    await runtime.close();
  });
});

// ═══════════════ S 组：单源纪律变异守卫 ═══════════════

describe('S 组：where 在场判据键于 W1 结算单源（total === undefined）', () => {
  it('S1 视图②隐藏 where：仍按 W1 已过滤结果结算（[t1,t3]、装满判定 true、无 ✂）', async () => {
    const { runtime } = await fixture();
    const probe = statefulOptionsProxy([
      { n: 2, where: [{ field: 'state', equals: 'claimed' }] },
      { n: 2 },
    ]);
    const call = capture(() =>
      runtime.readMap(['tasks'], probe.options as unknown as NamespaceRuntimeReadMapOptions),
    );
    expect(call.escaped).toBeUndefined();
    const result = call.result!;
    if (!result.ok) throw new Error(`契约前提失败（重读 options 判在场会得 false）：${JSON.stringify(result)}`);
    expect(result.value.map((entry) => entry.key)).toStrictEqual(['t1', 't3']);
    expect(result.truncated).toBe(true); // kept 2 === canonical n 2
    expect(result.schema).not.toContain(TRUNCATION_HEADER);
    expect(probe.viewCount()).toBe(2);
    await runtime.close();
  });

  it('S2 恰 n 匹配（exactTasks n=5）→ true：反「计数后比较」', async () => {
    const { runtime } = await fixture();
    const result = runtime.readMap(['exactTasks'], { n: 5, where: [...CLAIMED] });
    if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(result)}`);
    expect(result.value).toHaveLength(5);
    expect(result.truncated).toBe(true);
    await runtime.close();
  });

  it('S3 毒埋未匹配项：命中 2 条、零重物化/零重过滤（重走即 PATH_NOT_ALLOWED）', async () => {
    const { runtime } = await fixture({ heavy: true });
    const result = runtime.readMap(['poisonScored'], { n: 2, where: [...CLAIMED], depth: 1 });
    if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(result)}`);
    expect(result.value.map((entry) => entry.key)).toStrictEqual(['p0', 'p1']);
    expect(result.truncated).toBe(true);
    await runtime.close();
  });

  it('S1b 视图不稳定两出口：出口①透传 W1 失败成员 / 出口②接缝终态，均响亮零外抛', async () => {
    const { runtime } = await fixture();
    const stateful = statefulDescriptorOptions(3); // 净化 #3 抛 → 重派发 #4 亦抛 → 出口①
    const one = capture(() =>
      runtime.readMap(['tasks'], stateful.options as unknown as NamespaceRuntimeReadMapOptions),
    );
    expect(one.escaped).toBeUndefined();
    const failure = expectWindowFailure(one.result);
    expect(failure.code).toBe('WINDOW_OPTIONS_INVALID');
    expect(failure.path).toStrictEqual(['tasks']);
    expect(stateful.calls()).toBe(4);

    const alternating = alternatingDescriptorOptions(3); // 仅净化 #3 抛 → 重派发 #4/#5 通过 → 出口②
    const two = capture(() =>
      runtime.readMap(['tasks'], alternating.options as unknown as NamespaceRuntimeReadMapOptions),
    );
    expect(two.escaped).toBeUndefined();
    const terminal = expectWindowFailure(two.result);
    expect(terminal.code).toBe('WINDOW_OPTIONS_INVALID');
    expect(terminal.message).toContain('视图不稳定');
    expect(alternating.calls()).toBe(5);
    await runtime.close();
  });
});

// ═══════════════ F 组：失败码与冻结面 ═══════════════

describe('F 组：合法 where 不吸收 W1 失败码；失败形恒四键', () => {
  it('F1 目标缺席：WINDOW_TARGET_ABSENT（不得先报 options 错）', async () => {
    const { runtime } = await fixture();
    for (const path of [['nope'], ['tasks', 't1', 'deep']] as const) {
      const failure = expectWindowFailure(runtime.readMap(path as unknown as readonly string[], { n: 1, where: [...CLAIMED] }));
      expect(failure.code, path.join('.')).toBe('WINDOW_TARGET_ABSENT');
      expect(failure.path).toStrictEqual([...path]);
    }
    await runtime.close();
  });

  it('F2 载体不符：WINDOW_CARRIER_MISMATCH（载体码优先于过滤）', async () => {
    const { runtime } = await fixture();
    const arrayOnMap = expectWindowFailure(runtime.readArray(['tasks'], { n: 1, where: [...CLAIMED] }));
    expect(arrayOnMap.code).toBe('WINDOW_CARRIER_MISMATCH');
    const mapOnArray = expectWindowFailure(runtime.readMap(['taskList'], { n: 1, where: [...CLAIMED] }));
    expect(mapOnArray.code).toBe('WINDOW_CARRIER_MISMATCH');
    await runtime.close();
  });

  it('F4 命中项物化失败：PATH_NOT_ALLOWED 精确到项、无半窗', async () => {
    const { runtime } = await fixture();
    const result = runtime.readMap(['badHit'], { n: 2, where: [...CLAIMED], depth: 1 });
    const failure = expectWindowFailure(result);
    expect(failure.code).toBe('PATH_NOT_ALLOWED');
    expect(failure.path).toStrictEqual(['badHit', 'h1']);
    expect('value' in (result as object)).toBe(false);
    expect('schema' in (result as object)).toBe(false);
    expect('truncated' in (result as object)).toBe(false);
    await runtime.close();
  });

  it('F6 无 where 变体同码（回归锚）', async () => {
    const { runtime } = await fixture();
    expect(expectWindowFailure(runtime.readMap(['nope'], { n: 1 })).code).toBe('WINDOW_TARGET_ABSENT');
    expect(expectWindowFailure(runtime.readArray(['tasks'], { n: 1 })).code).toBe('WINDOW_CARRIER_MISMATCH');
    const bad = expectWindowFailure(runtime.readMap(['badHit'], { n: 2, depth: 1 }));
    expect(bad.code).toBe('PATH_NOT_ALLOWED');
    await runtime.close();
  });

  it('F7 三码互异、各就各位（无新增码、无语义漂移）', async () => {
    const { runtime } = await fixture();
    const codes = new Set([
      expectWindowFailure(runtime.readMap(['nope'], { n: 1, where: [...CLAIMED] })).code,
      expectWindowFailure(runtime.readArray(['tasks'], { n: 1, where: [...CLAIMED] })).code,
      expectWindowFailure(runtime.readMap(['tasks'], { n: 1, where: 42 } as never)).code,
    ]);
    expect([...codes].sort()).toStrictEqual([
      'WINDOW_CARRIER_MISMATCH',
      'WINDOW_OPTIONS_INVALID',
      'WINDOW_TARGET_ABSENT',
    ]);
    await runtime.close();
  });
});

// ═══════════════ C 组（AC7）：停接纳不豁免 where ═══════════════

describe('C 组（AC7）：close 后带 where 读 → RUNTIME_READ_DISABLED（四键失败形）', () => {
  it('C1/C3 closed 期：码 + 四键 + path 回显 + 零 options 触达', async () => {
    const { runtime } = await fixture();
    await runtime.close();
    for (const [name, call] of [
      ['readArray', (options: object) => runtime.readArray(['taskList'], options as NamespaceRuntimeReadArrayOptions)],
      ['readMap', (options: object) => runtime.readMap(['tasks'], options as NamespaceRuntimeReadMapOptions)],
    ] as const) {
      const probe = trapCountingOptions({ n: 2, where: [...CLAIMED] });
      const result = call(probe.options) as RuntimeReadDisabledResult;
      expect(result.ok, name).toBe(false);
      expect(result.code).toBe('RUNTIME_READ_DISABLED');
      expect(Object.keys(result as object).sort()).toEqual(['code', 'message', 'ok', 'path']);
      expect(Array.isArray(result.path)).toBe(true);
      expect(typeof result.message === 'string' && result.message.length > 0).toBe(true);
      expect(probe.calls(), `${name}：停接纳期不得读取 options`).toBe(0);
    }
  });

  it('C2 closing 期（close 返回前）同步拒绝；C5 无 where 同款逐字节语义', async () => {
    const { runtime } = await fixture();
    const closing = runtime.close();
    const withWhere = runtime.readMap(['tasks'], { n: 2, where: [...CLAIMED] });
    const noWhere = runtime.readMap(['tasks'], { n: 2 });
    await closing;
    expect(withWhere).toStrictEqual(noWhere);
    expect(['code' in withWhere && withWhere.code]).toStrictEqual(['RUNTIME_READ_DISABLED']);
    expect(Object.keys(withWhere as object).sort()).toEqual(['code', 'message', 'ok', 'path']);
  });
});

// ═══════════════ N 负控：W1 与 readData 冻结面不被污染 ═══════════════

describe('N 负控：W1 同参成功、readData options 闭合形状与无 where 面零漂移', () => {
  it('N3 W1 直调同参 where 成功且过滤正确（证明失败由组合层引入而非数据/载体/词表）', async () => {
    const { runtime, doc } = await fixture();
    const direct = readMapWindowAtPath(doc, ['tasks'], { n: 2, where: [...CLAIMED] });
    expect(direct.ok).toBe(true);
    if (!direct.ok) throw new Error('unreachable');
    expect(direct.value.map((entry) => entry.key)).toStrictEqual(['t1', 't3']);
    expect(direct.total).toBeUndefined(); // B-8 单源：W1 已应用 where
    await runtime.close();
  });

  it('N6/L5 readData 冻结：where 不进 readData options（READ_OPTIONS_INVALID）、预算读行为不变', async () => {
    const { runtime } = await fixture();
    const rejected = runtime.readData(['tasks'], { where: [...CLAIMED] } as never);
    expect(rejected.ok).toBe(false);
    if (rejected.ok) throw new Error('unreachable');
    expect(rejected.code).toBe('READ_OPTIONS_INVALID');
    const budgeted = runtime.readData(['tasks', 't1'], { depth: 1 });
    if (!budgeted.ok) throw new Error('契约前提失败：预算 readData 应成功');
    expectReadDataOkKeys(budgeted);
    await runtime.close();
  });

  it('N1/N2 无 where 三面一致：runtime 四键与 W1 条目列表直通', async () => {
    const { runtime, doc } = await fixture();
    const result = runtime.readMap(['tasks'], { n: 3 });
    const direct = readMapWindowAtPath(doc, ['tasks'], { n: 3 });
    if (!result.ok || !direct.ok) throw new Error('契约前提失败：两次读应成功');
    expectReadDataOkKeys(result);
    expect(result.value).toStrictEqual(direct.value); // 条目列表原样直通
    expect(result.truncated).toBe(true); // kept 3 < total 5
    if (result.schema === null) throw new Error('契约前提失败：schema 应非 null');
    expect(result.schema).toContain(factsLine('tasks', 'key', 'asc', 3, 5));
    await runtime.close();
  });
});
