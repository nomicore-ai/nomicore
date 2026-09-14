/**
 * SA6 验收契约（红灯）— issue #381 P1：W1 成功结算三键化 `{ok, value, total}`
 * （ADR 0029 §5/§8；SA6 契约 §12.3 用例组 T1–T9）。
 *
 * 契约来源：
 * - 任务简报 `wiki/raw/task_issue-381.md` AC1（两面成功恰三键；`total` = 候选标识计数；
 *   失败结算形状不变）与 AC4（窗口测试家族两键 → 三键迁移）；
 * - `wiki/raw/task_issue-381_sa6_contract.md` §12.1 绑定表 B-2/B-3/B-4/B-5、§12.3 T1–T9、
 *   §12.8 反伪绿防线；
 * - `docs/adr/0029-filtered-window-read.md` §5（成功结算 `{ok:true, value, total}`，
 *   `total` 键恒在；本票无 where ⟹ 恒为数值）与 §8（计数下沉进 W1：枚举/过滤/计数同源）。
 *
 * 红灯机理（HEAD `8a4fa40`，SA6 §5/§13 探针实证）：两面成功结算 own 键集 = `['ok','value']`、
 * `total === undefined` ⟹ T1（键集恰三键）红、T2（数值性）红、T3–T5/T8（预言机对账）红；
 * 失败面（T9）在 HEAD 即绿（负控，本票不得改其形状）。
 *
 * 断言纪律（SA6 §12.3/§12.8 契约继承）：
 * - 全部锚定运行时行为（结果联合、own 键集、条目列表、Y.Doc 值）；
 * - `total` 期望一律由**独立预言机**（Yjs/native 直数，零实现复用）派生——禁把期望对象
 *   与实际从同一构造器/同一函数派生；
 * - 零 skip/only/todo、零 env override、零 fallback、零吞错、零源码字符串断言。
 * 非目标（SA6 §12.9）：不写 `where`、不写 E4 对抗场景一致性断言、不引入新读路径。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { readArrayWindowAtPath, readMapWindowAtPath } from '../src/index.js';
import type { ReadArrayWindowOptions, ReadMapWindowOptions } from '../src/index.js';

type Path = readonly (string | number)[];

// ── fixture（最小载体矩阵；形状沿 #369 S4/T7 边界矩阵）───────────────────────────────

/** 候选容器构造：ROOT 下挂载 9 个可数键（数组/键两载体族 + 边界载体样本）。 */
function buildMatrixDoc(): Y.Doc {
  const doc = new Y.Doc();
  const root = doc.getMap('ROOT');

  const workRecords = new Y.Array<number>();
  workRecords.push([30, 10, 20]);
  root.set('workRecords', workRecords);

  root.set('emptyTags', new Y.Array<unknown>());

  const ym = new Y.Map<unknown>();
  ym.set('k1', 1);
  ym.set('k2', undefined); // 显式 undefined 值键：出条目空间
  ym.set('k3', 'x');
  root.set('ym', ym);

  root.set('po', { a: 1, b: undefined, c: 3 }); // b 出条目空间

  const hostile: Record<string, unknown> = { plain: 1 };
  Object.defineProperty(hostile, 'hidden', { value: 2, enumerable: false }); // non-enumerable 出空间
  Object.defineProperty(hostile, 'acc', { get: () => 3, enumerable: true }); // accessor 出空间（零执行）
  root.set('hostile', hostile);

  root.set('emptyPlain', {});
  root.set('emptyMap', new Y.Map<unknown>());

  const sparse: unknown[] = ['z'];
  sparse[3] = 'y'; // 空洞计入 length 口径
  root.set('sparse', sparse);

  root.set('tags', ['a', 'b']); // plain array（ROOT 第 9 键）

  return doc;
}

/** 排序基/预算矩阵容器：tasks = Y.Map<Y.Map<{priority}>>（field 基底座）。 */
function buildTermDoc(): Y.Doc {
  const doc = new Y.Doc();
  const root = doc.getMap('ROOT');
  const arr = new Y.Array<number>();
  arr.push([30, 10, 20]);
  root.set('arr', arr);
  const tasks = new Y.Map<unknown>();
  for (const [key, priority] of [['t1', 2], ['t2', 9], ['t3', 5]] as const) {
    const child = new Y.Map<unknown>();
    child.set('title', key);
    child.set('priority', priority);
    tasks.set(key, child);
  }
  root.set('tasks', tasks);
  return doc;
}

/** 零物化哨兵容器：`[30, 10, NaN ×1998]`（N=2000；入选 2 项）。 */
function buildPoisonDoc(): Y.Doc {
  const doc = new Y.Doc();
  const root = doc.getMap('ROOT');
  const poison = new Y.Array<number>();
  const values: number[] = [30, 10];
  for (let i = 2; i < 2000; i += 1) values.push(Number.NaN);
  poison.push(values);
  root.set('poison', poison);
  return doc;
}

/** 物化失败载体：plain array 内的 detached Y.Map（入选项 fail-fast 透传 PATH_NOT_ALLOWED）。 */
function buildDetachedDoc(): Y.Doc {
  const doc = new Y.Doc();
  doc.getMap('ROOT').set('arr', [new Y.Map()]);
  return doc;
}

// ── 独立预言机（native/Yjs 直数，零实现复用）─────────────────────────────────────────

/** 路径终点解析（只经原生 `get`，不消费任何实现导出）。 */
function resolveTarget(doc: Y.Doc, path: Path): unknown {
  let cur: unknown = doc.getMap('ROOT');
  for (const seg of path) cur = (cur as Y.Map<unknown>).get(seg as string);
  return cur;
}

/** 数组面候选标识计数预言机：宿主 `length`（Y.Array / plain array 同式；稀疏空洞计入）。 */
function arrayOracle(doc: Y.Doc, path: Path): number {
  return (resolveTarget(doc, path) as unknown[] | Y.Array<unknown>).length;
}

/** 键面候选标识计数预言机：Y.Map = keys() 中 `get(k) !== undefined`；plain object =
 *  own-enumerable data 键且值非 undefined（accessor/non-enumerable/undefined 出空间）。 */
function mapOracle(doc: Y.Doc, path: Path): number {
  const target = resolveTarget(doc, path);
  if (target instanceof Y.Map) {
    return [...target.keys()].filter((key) => target.get(key) !== undefined).length;
  }
  const record = target as Record<string, unknown>;
  return Object.keys(record).filter((key) => {
    const desc = Object.getOwnPropertyDescriptor(record, key);
    return desc !== undefined
      && desc.enumerable === true
      && desc.get === undefined
      && desc.set === undefined
      && desc.value !== undefined;
  }).length;
}

// ── 断言助手（形状助手不复用实现路径；失败面 own 键集恰四键）─────────────────────────

/** 成功结算前提：`ok:true`（否则响亮抛，绝不静默跳过）。 */
function expectOk<T extends { ok: boolean }>(actual: T, label: string): Extract<T, { ok: true }> {
  if (!actual.ok) {
    throw new Error(`契约前提失败（${label}）：期望 ok:true，实际 ${JSON.stringify(actual)}`);
  }
  return actual as Extract<T, { ok: true }>;
}

/** 失败结算形状：own 键集恰四键 `{code,ok,path,message}`、无 `value`/`total`（B-5）。 */
function expectFailure(
  actual: unknown,
  label: string,
): { readonly code: string; readonly path: readonly (string | number)[]; readonly message: string } {
  const failure = actual as { ok: boolean; code: string; path: readonly (string | number)[]; message: string };
  expect(failure.ok, `${label}: ok`).toBe(false);
  expect(Object.keys(failure as object).sort(), `${label}: 失败 own 键集`).toStrictEqual(['code', 'message', 'ok', 'path']);
  expect('value' in (failure as object), `${label}: 失败成员无 value`).toBe(false);
  expect('total' in (failure as object), `${label}: 失败成员无 total`).toBe(false);
  expect(typeof failure.code, `${label}: code 类型`).toBe('string');
  expect(Array.isArray(failure.path), `${label}: path 形态`).toBe(true);
  expect(typeof failure.message === 'string' && failure.message.length > 0, `${label}: message 非空`).toBe(true);
  return failure;
}

/** 「成功恰三键 + total 数值性」共断言（T1/T2）。 */
function expectTriple(actual: unknown, label: string): number {
  const ok = expectOk(actual as { ok: boolean }, label);
  expect(Object.keys(ok as object), `${label}: 成功 own 键集（ADR 0029 §5 字面序）`).toStrictEqual(['ok', 'value', 'total']);
  const total = (ok as { total: number }).total;
  expect(typeof total, `${label}: typeof total`).toBe('number');
  expect(Number.isInteger(total), `${label}: total 整数`).toBe(true);
  expect(total >= 0, `${label}: total ≥ 0`).toBe(true);
  return total;
}

// ═════════════════════════════ T1/T2：三键形状 + total 数值性 ═════════════════════════════

describe('W1 三键结算（issue #381 / ADR 0029 §5）：T1 own 键集 + T2 total 数值性', () => {
  it('T1/T2 四载体（Y.Array / plain array / Y.Map / plain object）成功结算恰三键且 total 恒为 ≥0 整数', () => {
    const doc = buildMatrixDoc();
    let total = expectTriple(readArrayWindowAtPath(doc, ['workRecords'], { n: 2 }), 'Y.Array');
    expect(total).toBe(3);
    total = expectTriple(readArrayWindowAtPath(doc, ['tags'], { n: 1 }), 'plain array');
    expect(total).toBe(2);
    total = expectTriple(readMapWindowAtPath(doc, ['ym'], { n: 1 }), 'Y.Map');
    expect(total).toBe(2);
    total = expectTriple(readMapWindowAtPath(doc, ['po'], { n: 1 }), 'plain object');
    expect(total).toBe(2);
  });
});

// ═════════════════════════════ T3/T5：独立预言机对账（含边界矩阵） ═════════════════════════════

describe('W1 total 语义（B-3）：T3 独立预言机逐位对账 + T5 边界矩阵', () => {
  it('T3 四载体 total ≡ 原生/Yjs 直数预言机（稀疏空洞、undefined 值键、accessor/non-enumerable 全覆盖）', () => {
    const doc = buildMatrixDoc();
    const cases: ReadonlyArray<{ readonly label: string; readonly face: 'array' | 'map'; readonly path: Path }> = [
      { label: 'Y.Array', face: 'array', path: ['workRecords'] },
      { label: 'plain array', face: 'array', path: ['tags'] },
      { label: 'Y.Map（显式 undefined 值键）', face: 'map', path: ['ym'] },
      { label: 'plain object（undefined 值键）', face: 'map', path: ['po'] },
      { label: 'plain object（accessor/non-enumerable）', face: 'map', path: ['hostile'] },
      { label: '稀疏 plain array（空洞计入 length）', face: 'array', path: ['sparse'] },
      { label: '空 Y.Array', face: 'array', path: ['emptyTags'] },
      { label: '空 Y.Map', face: 'map', path: ['emptyMap'] },
      { label: '空 plain object', face: 'map', path: ['emptyPlain'] },
    ];
    for (const entry of cases) {
      const result = entry.face === 'array'
        ? readArrayWindowAtPath(doc, entry.path, { n: 1 })
        : readMapWindowAtPath(doc, entry.path, { n: 1 });
      const total = expectTriple(result, entry.label);
      const oracle = entry.face === 'array' ? arrayOracle(doc, entry.path) : mapOracle(doc, entry.path);
      expect(total, `${entry.label}: total ≡ 独立预言机`).toBe(oracle);
    }
  });

  it('T5 边界矩阵预言机逐位对账（含 ROOT 面 9 键；断言值非巧合）', () => {
    const doc = buildMatrixDoc();
    // 预言机自身先自证（防空载体恒等式伪绿）
    expect(arrayOracle(doc, ['sparse'])).toBe(4);
    expect(mapOracle(doc, ['ym'])).toBe(2);
    expect(mapOracle(doc, ['po'])).toBe(2);
    expect(mapOracle(doc, ['hostile'])).toBe(1);
    expect(mapOracle(doc, [])).toBe(9);
    expect(mapOracle(doc, ['emptyMap'])).toBe(0);
    expect(mapOracle(doc, ['emptyPlain'])).toBe(0);
    expect(arrayOracle(doc, ['emptyTags'])).toBe(0);

    const cases: ReadonlyArray<{
      readonly label: string;
      readonly face: 'array' | 'map';
      readonly path: Path;
      readonly options: ReadArrayWindowOptions | ReadMapWindowOptions;
      readonly expected: number;
      readonly kept: number;
    }> = [
      { label: 'Y.Array 全量', face: 'array', path: ['workRecords'], options: { n: 9 }, expected: arrayOracle(doc, ['workRecords']), kept: 3 },
      { label: '空 Y.Array', face: 'array', path: ['emptyTags'], options: { n: 9 }, expected: 0, kept: 0 },
      { label: 'Y.Map 显式 undefined 值键出空间', face: 'map', path: ['ym'], options: { n: 9 }, expected: 2, kept: 2 },
      { label: 'plain object undefined 值键出空间', face: 'map', path: ['po'], options: { n: 9 }, expected: 2, kept: 2 },
      { label: 'plain object accessor/non-enumerable 出空间', face: 'map', path: ['hostile'], options: { n: 9 }, expected: 1, kept: 1 },
      { label: '空 plain object', face: 'map', path: ['emptyPlain'], options: { n: 9 }, expected: 0, kept: 0 },
      { label: '空 Y.Map', face: 'map', path: ['emptyMap'], options: { n: 9 }, expected: 0, kept: 0 },
      { label: '稀疏 plain array（n=1 避开空洞物化）', face: 'array', path: ['sparse'], options: { n: 1 }, expected: 4, kept: 1 },
      { label: 'ROOT 面（[]，9 键）', face: 'map', path: [], options: { n: 2 }, expected: 9, kept: 2 },
    ];

    for (const entry of cases) {
      const result = entry.face === 'array'
        ? readArrayWindowAtPath(doc, entry.path, entry.options as ReadArrayWindowOptions)
        : readMapWindowAtPath(doc, entry.path, entry.options as ReadMapWindowOptions);
      const ok = expectOk(result, entry.label);
      const total = expectTriple(result, entry.label);
      expect(total, `${entry.label}: total ≡ 预言机常量`).toBe(entry.expected);
      expect(ok.value.length, `${entry.label}: kept`).toBe(entry.kept);
    }
  });
});

// ═════════════════════════════ T4：min(n, total) 双向 ═════════════════════════════

describe('W1 total 与 value 关系（B-4）：T4 `value.length === min(n, total)`', () => {
  it('T4a n ≥ total：窗口取满候选空间（value.length === total）', () => {
    const doc = buildMatrixDoc();
    const ok = expectOk(readArrayWindowAtPath(doc, ['workRecords'], { n: 9 }), 'n≥total');
    const total = expectTriple(readArrayWindowAtPath(doc, ['workRecords'], { n: 9 }), 'n≥total');
    expect(total).toBe(arrayOracle(doc, ['workRecords']));
    expect(ok.value.length).toBe(Math.min(9, total));
    expect(ok.value.length).toBe(total);
  });

  it('T4b n < total：窗口只取前 n 项（value.length === n < total）', () => {
    const doc = buildMatrixDoc();
    const ok = expectOk(readMapWindowAtPath(doc, [], { n: 2 }), 'n<total');
    const total = expectTriple(readMapWindowAtPath(doc, [], { n: 2 }), 'n<total');
    expect(total).toBe(mapOracle(doc, []));
    expect(ok.value.length).toBe(Math.min(2, total));
    expect(ok.value.length).toBeLessThan(total);
  });

  it('T4c 空载体：n 任意 ⟹ value=[] ∧ total=0（min 恒 0）', () => {
    const doc = buildMatrixDoc();
    const ok = expectOk(readMapWindowAtPath(doc, ['emptyMap'], { n: 9 }), '空 Y.Map');
    expect(expectTriple(readMapWindowAtPath(doc, ['emptyMap'], { n: 9 }), '空 Y.Map')).toBe(0);
    expect(ok.value.length).toBe(0);
  });
});

// ═════════════════════════════ T6/T7：排序基与预算轴不变性 ═════════════════════════════

describe('W1 total 不变性：T6 排序基/方向 + T7 预算轴', () => {
  it('T6 数组面 index 基 asc/desc、键面 key 基 asc/desc、键面 field 基 asc/desc ⟹ total 恒定', () => {
    const doc = buildTermDoc();
    const arrayTotal = arrayOracle(doc, ['arr']);
    expect(arrayTotal).toBe(3);
    for (const dir of ['asc', 'desc'] as const) {
      const total = expectTriple(
        readArrayWindowAtPath(doc, ['arr'], { n: 9, orderBy: { by: 'index', dir } }),
        `array index ${dir}`,
      );
      expect(total, `array index ${dir}: total 不随排序/方向变化`).toBe(arrayTotal);
    }
    const keyTotal = mapOracle(doc, ['tasks']);
    expect(keyTotal).toBe(3);
    for (const dir of ['asc', 'desc'] as const) {
      const keyBasis = expectTriple(
        readMapWindowAtPath(doc, ['tasks'], { n: 9, orderBy: { by: 'key', dir } }),
        `map key ${dir}`,
      );
      expect(keyBasis, `map key ${dir}: total 恒定`).toBe(keyTotal);
      const fieldBasis = expectTriple(
        readMapWindowAtPath(doc, ['tasks'], { n: 9, orderBy: { field: 'priority', dir } }),
        `map field ${dir}`,
      );
      expect(fieldBasis, `map field ${dir}: total 恒定`).toBe(keyTotal);
    }
  });

  it('T7 depth / maxChildrenPerNode 在场或缺席 ⟹ total 恒定（预算只影响物化）', () => {
    const doc = buildTermDoc();
    const arrayTotal = arrayOracle(doc, ['arr']);
    const mapTotal = mapOracle(doc, ['tasks']);
    const arrayBudgets: ReadArrayWindowOptions[] = [
      { n: 9 },
      { n: 9, depth: 0 },
      { n: 9, depth: 1, maxChildrenPerNode: 0 },
      { n: 9, depth: 2, maxChildrenPerNode: 3 },
    ];
    for (const options of arrayBudgets) {
      const total = expectTriple(readArrayWindowAtPath(doc, ['arr'], options), `array budget ${JSON.stringify(options)}`);
      expect(total, `array budget ${JSON.stringify(options)}: total 恒定`).toBe(arrayTotal);
    }
    const mapBudgets: ReadMapWindowOptions[] = [
      { n: 9 },
      { n: 9, depth: 0 },
      { n: 9, depth: 1, maxChildrenPerNode: 0 },
      { n: 9, depth: 2, maxChildrenPerNode: 3 },
    ];
    for (const options of mapBudgets) {
      const total = expectTriple(readMapWindowAtPath(doc, ['tasks'], options), `map budget ${JSON.stringify(options)}`);
      expect(total, `map budget ${JSON.stringify(options)}: total 恒定`).toBe(mapTotal);
    }
  });
});

// ═════════════════════════════ T8：零物化哨兵 ═════════════════════════════

describe('W1 total 成本纪律（ADR 0028 §8）：T8 N=2000 毒值 + n=2', () => {
  it('T8 total=2000 且只物化 2 项（「为拿 total 全量物化」的实现必红）', () => {
    const doc = buildPoisonDoc();
    const ok = expectOk(readArrayWindowAtPath(doc, ['poison'], { n: 2 }), 'N=2000 毒值');
    expect(ok.value.length, 'T8: 只物化入选项').toBe(2);
    const total = expectTriple(readArrayWindowAtPath(doc, ['poison'], { n: 2 }), 'N=2000 毒值');
    expect(total, 'T8: total = 候选标识计数（含尾部毒值）').toBe(2000);
    expect(total, 'T8: total ≡ 预言机').toBe(arrayOracle(doc, ['poison']));
    expect(ok.value.length).toBe(Math.min(2, total));
  });
});

// ═════════════════════════════ T9：失败面形状与语义零变化 ═════════════════════════════

describe('W1 失败面（B-5）：T9 三码 + PATH_NOT_ALLOWED 透传；四键形状无 value/total', () => {
  it('T9a WINDOW_TARGET_ABSENT：缺键 / 数组越界', () => {
    const doc = buildMatrixDoc();
    const missing = expectFailure(readMapWindowAtPath(doc, ['nope'], { n: 1 }), '缺键');
    expect(missing.code).toBe('WINDOW_TARGET_ABSENT');
    expect(missing.path).toStrictEqual(['nope']);
    const beyond = expectFailure(readArrayWindowAtPath(doc, ['workRecords', 99], { n: 1 }), '越界');
    expect(beyond.code).toBe('WINDOW_TARGET_ABSENT');
  });

  it('T9b WINDOW_CARRIER_MISMATCH：载体与面符不符（两向）', () => {
    const doc = buildMatrixDoc();
    const arrayFaceOnMap = expectFailure(readArrayWindowAtPath(doc, ['ym'], { n: 1 }), '数组面收 Y.Map');
    expect(arrayFaceOnMap.code).toBe('WINDOW_CARRIER_MISMATCH');
    const mapFaceOnArray = expectFailure(readMapWindowAtPath(doc, ['workRecords'], { n: 1 }), '键面收 Y.Array');
    expect(mapFaceOnArray.code).toBe('WINDOW_CARRIER_MISMATCH');
  });

  it('T9c WINDOW_OPTIONS_INVALID：n=0 / 未知键 / 语境外排序项（零 doc 触碰）', () => {
    const doc = buildMatrixDoc();
    const zeroN = expectFailure(readArrayWindowAtPath(doc, ['workRecords'], { n: 0 } as ReadArrayWindowOptions), 'n=0');
    expect(zeroN.code).toBe('WINDOW_OPTIONS_INVALID');
    const unknownKey = expectFailure(
      readArrayWindowAtPath(doc, ['workRecords'], { n: 1, where: 'x' } as unknown as ReadArrayWindowOptions),
      '未知键',
    );
    expect(unknownKey.code).toBe('WINDOW_OPTIONS_INVALID');
    const outOfVocabulary = expectFailure(
      readMapWindowAtPath(doc, ['ym'], { n: 1, orderBy: { by: 'index' } } as unknown as ReadMapWindowOptions),
      '语境外排序项',
    );
    expect(outOfVocabulary.code).toBe('WINDOW_OPTIONS_INVALID');
  });

  it('T9d 入选项物化失败透传 PATH_NOT_ALLOWED（path 精确到项；无半窗）', () => {
    const doc = buildDetachedDoc();
    const failure = expectFailure(readArrayWindowAtPath(doc, ['arr'], { n: 1 }), 'detached 项物化');
    expect(failure.code).toBe('PATH_NOT_ALLOWED');
    expect(failure.path).toStrictEqual(['arr', 0]);
  });

  it('T9e 失败成员不含 total（增键不回渗失败面）', () => {
    const doc = buildMatrixDoc();
    for (const failure of [
      readMapWindowAtPath(doc, ['nope'], { n: 1 }),
      readArrayWindowAtPath(doc, ['ym'], { n: 1 }),
      readArrayWindowAtPath(doc, ['workRecords'], { n: 0 } as ReadArrayWindowOptions),
    ]) {
      expect('total' in (failure as object)).toBe(false);
      expect('value' in (failure as object)).toBe(false);
    }
  });
});
