/**
 * issue #405（ADR 0031）readData 交付总量收/拒闸 —— **红灯契约主体**（SA6 §12.2/§12.3）。
 *
 * 组：G1 总量 ≤ 预算成功且交付物逐字节一致、G2 恰好等于预算成功（≤ 判定）、G3 超限零交付
 * 五键分支、G4 度量等式 property（成对边界 + 独立 oracle）、G5 options 负控 + C-LIMIT 组级
 * 判据（拒绝锚 ∧ 有效域接受锚）、G6 缺席目标 × 超限、G8 带 `maxBytes` 侧的 schema/头行零
 * 漂移、G10 失败面优先级与敌意 options。
 *
 * HEAD 判定：G1–G6/G8(带预算侧)/G10 红（`maxBytes` 命中 options 键空间白名单 → 未知键
 * 拒绝；SA6 §5 P1/P4）。红因单一且归因能力缺口——本文件不构造任何实现内部耦合断言
 * （反伪绿 §12.5 R10：只观察公共接缝）。
 *
 * 期望来源纪律（§12.5 R1）：§12.0 冻结锚常量 **或** 同运行同参无预算读的独立两通道测量；
 * 禁止从被测 `measuredBytes` 反推期望。
 */
import { describe, expect, it } from 'vitest';
import { expectReadDataOkKeys } from './helpers/readdata-ok-shape.js';
import type { NamespaceRuntimeReadDataOptions } from '../src/index.js';
import {
  anchorById,
  makeRuntime405,
  measureChannels,
  type FrozenBudget,
} from './issue-405-maxbytes-fixture.js';

// ───────────────────────── 前提断言（ok 不符 → loud throw；绝不假绿） ─────────────────────────

interface BudgetOkShape {
  readonly ok: true;
  readonly value: unknown;
  readonly schema: string | null;
  readonly truncated: boolean;
}

interface BudgetFailureShape {
  readonly ok: false;
  readonly code: string;
  readonly path: readonly (string | number)[];
  readonly message: string;
  readonly measuredBytes?: number;
}

function ok(r: unknown, label: string): BudgetOkShape {
  if ((r as { ok?: unknown }).ok !== true) {
    throw new Error(`${label}：契约前提失败（期望 ok:true，实际 ${JSON.stringify(r)}）`);
  }
  return r as BudgetOkShape;
}

function failure(r: unknown, label: string): BudgetFailureShape {
  if ((r as { ok?: unknown }).ok !== false) {
    throw new Error(`${label}：契约前提失败（期望 ok:false，实际 ${JSON.stringify(r)}）`);
  }
  return r as BudgetFailureShape;
}

/** 预算失败断言（code + 恰五键 + measuredBytes 载荷在场）。 */
function budgetFailure(r: unknown, label: string): BudgetFailureShape {
  const f = failure(r, label);
  expect(f.code, `${label}：失败码`).toBe('READ_BUDGET_EXCEEDED');
  expect(Object.keys(f).sort(), `${label}：失败分支恰五键（零交付——绝无 value/schema/truncated）`)
    .toStrictEqual([...BUDGET_FAILURE_KEYS]);
  expect(typeof f.measuredBytes, `${label}：measuredBytes 载荷在场`).toBe('number');
  return f;
}

const BUDGET_FAILURE_KEYS = ['code', 'measuredBytes', 'message', 'ok', 'path'] as const;
const OPTIONS_FAILURE_KEYS = ['code', 'message', 'ok', 'path'] as const;

/** 非封闭形状 options 通道（`maxBytes` 的运行时值域面只在运行时校验层可观测）。 */
const asOptions = (value: unknown): NamespaceRuntimeReadDataOptions =>
  value as NamespaceRuntimeReadDataOptions;

/** 同参无预算读的轴参数（`undefined` = 无 options 读）。 */
function axisOptions(budget: FrozenBudget | undefined, maxBytes: number): NamespaceRuntimeReadDataOptions {
  return { ...(budget ?? {}), maxBytes };
}

// ───────────────────────── 敌意 options 构造器（三键面 G10） ─────────────────────────

/** 状态化 descriptor trap：第 `throwFromCall` 次（含）起 `getOwnPropertyDescriptor` 抛错。 */
function statefulDescriptorProxy(
  target: object,
  throwFromCall: number,
): { readonly options: object; readonly descriptorCalls: () => number } {
  let descriptorCalls = 0;
  const options = new Proxy(target, {
    getOwnPropertyDescriptor(t, key) {
      descriptorCalls += 1;
      if (descriptorCalls >= throwFromCall) throw new Error('probe: stateful descriptor trap');
      return Reflect.getOwnPropertyDescriptor(t, key);
    },
  });
  return { options, descriptorCalls: () => descriptorCalls };
}

/** 交替 descriptor trap：仅第 `throwOnCall` 次`getOwnPropertyDescriptor` 抛错（出口② 面）。 */
function throwOnceDescriptorProxy(
  target: object,
  throwOnCall: number,
): { readonly options: object; readonly descriptorCalls: () => number } {
  let descriptorCalls = 0;
  const options = new Proxy(target, {
    getOwnPropertyDescriptor(t, key) {
      descriptorCalls += 1;
      if (descriptorCalls === throwOnCall) throw new Error('probe: alternating descriptor trap');
      return Reflect.getOwnPropertyDescriptor(t, key);
    },
  });
  return { options, descriptorCalls: () => descriptorCalls };
}

/** accessor `maxBytes`（getter 恒不执行——零 `[[Get]]` 纪律）。 */
function accessorMaxBytesOptions(): { readonly options: object; readonly getterCalls: () => number } {
  let getterCalls = 0;
  const options = {
    get maxBytes(): number {
      getterCalls += 1;
      return 1;
    },
  };
  return { options, getterCalls: () => getterCalls };
}

/** 非 enumerable own `maxBytes` 键（键空间外 ≡ 无预算；杀 `in`/直读实现）。 */
function nonEnumerableMaxBytesOptions(maxBytes: number): object {
  const options: Record<string, unknown> = {};
  Object.defineProperty(options, 'maxBytes', {
    value: maxBytes,
    enumerable: false,
    configurable: true,
    writable: true,
  });
  return options;
}

/** 抛错 get trap Proxy（descriptor 诚实；get trap 恒抛且计数）。 */
function throwingGetProxy(target: object): { readonly options: object; readonly getCalls: () => number } {
  let getCalls = 0;
  const options = new Proxy(target, {
    get(t, key, receiver) {
      getCalls += 1;
      void key;
      void receiver;
      throw new Error('probe: hostile get trap');
    },
  });
  return { options, getCalls: () => getCalls };
}

// ═════════════════════════════ G1：总量 ≤ 预算成功 + 逐字节一致（AC①） ═════════════════════════════

describe('G1 总量 ≤ 预算：原样成功且交付物与同参无 maxBytes 读逐字节相同', () => {
  it('G1 R0 主锚：{maxBytes:358} 与宽预算 100000 均与 readData([]) 四键全等（schema 逐字节）', async () => {
    const runtime = await makeRuntime405();
    const r0 = anchorById('R0');
    const plain = ok(runtime.readData([]), 'G1/plain');
    expectReadDataOkKeys(plain);
    const atBoundary = ok(runtime.readData([], { maxBytes: r0.total }), 'G1/total');
    expectReadDataOkKeys(atBoundary);
    expect(atBoundary, 'G1/total：恰等于预算 → 交付物逐字节相同').toStrictEqual(plain);
    expect(atBoundary.schema).toBe(plain.schema);
    const wide = ok(runtime.readData([], { maxBytes: 100000 }), 'G1/wide');
    expect(wide).toStrictEqual(plain);
    expect(wide.schema).toBe(plain.schema);
    await runtime.close();
  });

  it('G1 复合三键：{depth:1,maxBytes:415} 与 {depth:1} 四键全等（塑形后计量，R6 反伪绿）', async () => {
    const runtime = await makeRuntime405();
    const r1 = anchorById('R1');
    const plain = ok(runtime.readData([], { depth: 1 }), 'G1/plain-depth');
    const budgeted = ok(
      runtime.readData([], { depth: 1, maxBytes: r1.total }),
      'G1/depth+maxBytes',
    );
    expectReadDataOkKeys(budgeted);
    expect(budgeted).toStrictEqual(plain);
    expect(budgeted.schema).toBe(plain.schema);
    // 塑形后交付物（415）而非预塑形（358）被计量：{depth:1,maxBytes:414} 必须拒（R6）。
    const rejected = budgetFailure(
      runtime.readData([], { depth: 1, maxBytes: r1.total - 1 }),
      'G1/塑形后计量',
    );
    expect(rejected.measuredBytes).toBe(415);
    await runtime.close();
  });
});

// ═════════════════════════════ G2：恰好等于预算成功（≤ 判定）（AC②） ═════════════════════════════

describe('G2 恰好等于 maxBytes → 成功（≤ 判定）；total-1 必须拒（边界成对）', () => {
  it('G2 R0/R6/R7/R8/R11 五锚：{maxBytes: total} 全等同参无预算读；{maxBytes: total-1} 全拒', async () => {
    const runtime = await makeRuntime405();
    for (const id of ['R0', 'R6', 'R7', 'R11', 'R8']) {
      const anchor = anchorById(id);
      const plain = ok(
        anchor.budget === undefined
          ? runtime.readData(anchor.path)
          : runtime.readData(anchor.path, anchor.budget),
        `G2/${id}-plain`,
      );
      if (anchor.total === 0) {
        // R8 零总量锚（total = 0）：`maxBytes: 1` 必须收——零总量 ≠ 超限（ADR 0031 决策 5）；
        // `total − 1 = −1` 落在 `maxBytes` 域外（非法值，非超限），故不参与成对边界。
        const zero = ok(runtime.readData(anchor.path, { maxBytes: 1 }), `G2/${id}-零总量`);
        expect(zero, `G2/${id}：零总量成功且与无预算读逐字节相同`).toStrictEqual(plain);
        continue;
      }
      const accepted = ok(
        runtime.readData(anchor.path, axisOptions(anchor.budget, anchor.total)),
        `G2/${id}-accept`,
      );
      expect(accepted, `G2/${id}：≤ 判定（恰等于预算）成功且逐字节相同`).toStrictEqual(plain);
      const rejected = budgetFailure(
        runtime.readData(anchor.path, axisOptions(anchor.budget, anchor.total - 1)),
        `G2/${id}-reject`,
      );
      expect(rejected.measuredBytes, `G2/${id}：超限报合计`).toBe(anchor.total);
    }
    await runtime.close();
  });
});

// ═════════════════════════════ G3：超限零交付 + 失败分支形状（AC③） ═════════════════════════════

describe('G3 超限：零交付五键分支（measuredBytes = 两通道合计）', () => {
  it('G3 R0 超限：恰五键、measuredBytes=358 且 ≠ 单通道、message 非空、path 新鲜回显 + 变异隔离', async () => {
    const runtime = await makeRuntime405();
    const r0 = anchorById('R0');
    const rejected = budgetFailure(runtime.readData([], { maxBytes: r0.total - 1 }), 'G3/R0');
    expect(rejected.measuredBytes, 'G3/R0：合计 = 值通道 + schema 通道').toBe(358);
    expect(rejected.measuredBytes, 'G3/R0：合计 ≠ 值侧 120').not.toBe(r0.valueBytes);
    expect(rejected.measuredBytes, 'G3/R0：合计 ≠ schema 侧 238').not.toBe(r0.schemaBytes);
    expect(typeof rejected.message === 'string' && rejected.message.length > 0, 'G3/R0：message 恒非空').toBe(true);
    expect(rejected.path, 'G3/R0：path 深等于实参').toStrictEqual([]);
    // path 新鲜回显：返回结果不是实参数组同一引用；实参事后变异不污染已返回结果。
    const actualPath: (string | number)[] = ['meta'];
    const metaRejected = budgetFailure(runtime.readData(actualPath, { maxBytes: 1 }), 'G3/path');
    expect(metaRejected.path).toStrictEqual(['meta']);
    expect(metaRejected.path, 'G3/path：新鲜副本（不别名实参）').not.toBe(actualPath);
    actualPath[0] = 'mutated';
    expect(metaRejected.path, 'G3/path：实参事后变异不污染结果').toStrictEqual(['meta']);
    await runtime.close();
  });

  it('G3 单通道锚：R7（值侧 0 → measuredBytes === utf8(schema)）与 raw R9（schema:null → 值侧单通道）', async () => {
    const strict = await makeRuntime405();
    const r7 = anchorById('R7');
    const nickRejected = budgetFailure(
      strict.readData(['nick'], axisOptions(r7.budget, r7.total - 1)),
      'G3/R7',
    );
    expect(nickRejected.measuredBytes, 'G3/R7：缺席目标 → 值侧 0').toBe(r7.schemaBytes);
    await strict.close();

    const raw = await makeRuntime405({ raw: true });
    const r9 = anchorById('R9');
    const rogueRejected = budgetFailure(
      raw.readData(['rogue'], axisOptions(r9.budget, r9.total - 1)),
      'G3/R9',
    );
    expect(rogueRejected.measuredBytes, 'G3/R9：schema:null → schema 侧 0').toBe(r9.valueBytes);
    await raw.close();
  });
});

// ═════════════════════════════ G4：度量等式 property（AC④） ═════════════════════════════

describe('G4 度量等式 property：r_reject.measuredBytes === utf8(JSON.stringify(value)) + utf8(schema)', () => {
  it('G4 严格档 R0–R7/R11 + raw 档 R9/R10：九+二锚成对（total 收 / total-1 拒）+ 独立 oracle', async () => {
    const strict = await makeRuntime405();
    const raw = await makeRuntime405({ raw: true });
    const ids = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R11', 'R9', 'R10'];
    for (const id of ids) {
      const anchor = anchorById(id);
      const runtime = anchor.raw ? raw : strict;
      const oracle = ok(
        anchor.budget === undefined
          ? runtime.readData(anchor.path)
          : runtime.readData(anchor.path, anchor.budget),
        `G4/oracle/${id}`,
      );
      const measured = measureChannels(oracle.value, oracle.schema);
      expect(measured.total, `G4/${id}：锚与独立 oracle 一致（装置前提 fail loud）`).toBe(anchor.total);
      const accepted = ok(
        runtime.readData(anchor.path, axisOptions(anchor.budget, anchor.total)),
        `G4/accept/${id}`,
      );
      expect(accepted, `G4/accept/${id}：≤ 判定成功且逐字节相同`).toStrictEqual(oracle);
      const rejected = budgetFailure(
        runtime.readData(anchor.path, axisOptions(anchor.budget, anchor.total - 1)),
        `G4/reject/${id}`,
      );
      expect(rejected.measuredBytes, `G4/${id}：度量等式`).toBe(measured.total);
      if (measured.valueBytes > 0 && measured.schemaBytes > 0) {
        expect(rejected.measuredBytes, `G4/${id}：双通道合计 ≠ 值侧单通道`).not.toBe(measured.valueBytes);
        expect(rejected.measuredBytes, `G4/${id}：双通道合计 ≠ schema 侧单通道`).not.toBe(measured.schemaBytes);
      }
      if (measured.valueBytes === 0) {
        expect(rejected.measuredBytes, `G4/${id}：值侧 0（缺席目标）→ 合计 = schema 侧`)
          .toBe(measured.schemaBytes);
      }
      if (measured.schemaBytes === 0) {
        expect(rejected.measuredBytes, `G4/${id}：schema:null → 合计 = 值侧`)
          .toBe(measured.valueBytes);
      }
    }
    await strict.close();
    await raw.close();
  });
});

// ═════════════════════════════ G5：options 负控 + 域区分 + C-LIMIT（AC⑤） ═════════════════════════════

describe('G5 options 负控：域外值矩阵 + 域可区分 + C-LIMIT 组级判据（拒绝锚 ∧ 接受锚）', () => {
  it('G5 组级判据：域外 matrix + message 域区分 + 有效域接受锚（2^53-1 / 1）', async () => {
    const runtime = await makeRuntime405();
    const r0 = anchorById('R0');
    const unknownKeyMessage = failure(runtime.readData([], asOptions({ nope: 1 })), 'G5/unknown-key').message;

    // (1) 域外值矩阵：全部 READ_OPTIONS_INVALID、恰四键、message 含 maxBytes 域标识且与未知键 message 不同。
    const domainCases: ReadonlyArray<{ name: string; value: unknown }> = [
      { name: '0', value: 0 },
      { name: '负数', value: -1 },
      { name: '非整数', value: 1.5 },
      { name: 'NaN', value: Number.NaN },
      { name: 'Infinity', value: Number.POSITIVE_INFINITY },
      { name: 'string', value: '100' },
      { name: '2^53（域外边界）', value: 2 ** 53 },
      { name: '2^53+2（域外上邻）', value: 2 ** 53 + 2 },
    ];
    for (const c of domainCases) {
      const label = `G5/${c.name}`;
      const r = failure(runtime.readData([], asOptions({ maxBytes: c.value })), label);
      expect(r.code, label).toBe('READ_OPTIONS_INVALID');
      expect(Object.keys(r).sort(), `${label}：恰四键`).toStrictEqual([...OPTIONS_FAILURE_KEYS]);
      expect(typeof r.message === 'string' && r.message.length > 0, `${label}：message 恒非空`).toBe(true);
      expect(r.message.includes('maxBytes'), `${label}：message 域标识（maxBytes 域可区分）`).toBe(true);
      expect(r.message, `${label}：与未知键 message 不同`).not.toBe(unknownKeyMessage);
      expect(r.path, `${label}：path 新鲜回显`).toStrictEqual([]);
    }

    // (2) 第四键矩阵：`{maxBytes:1, nope:1}` 仍由未知键单源拒绝（tracer 不吞未知键——
    //     拒绝权威仍是 doc-runtime T1；message 命名的键必须是 `nope` 而非 `maxBytes`）。
    const nopeOnly = failure(runtime.readData([], asOptions({ nope: 1 })), 'G5/nope');
    const fourthKey = failure(runtime.readData([], asOptions({ maxBytes: 1, nope: 1 })), 'G5/第四键');
    expect(fourthKey.code).toBe('READ_OPTIONS_INVALID');
    expect(Object.keys(fourthKey).sort()).toStrictEqual([...OPTIONS_FAILURE_KEYS]);
    expect(fourthKey.message.includes('nope'), 'G5/第四键：未知键名的单源 message').toBe(true);
    expect(fourthKey.message, 'G5/第四键：与 {nope:1} 同源（T1 单源 message 不复制）')
      .toBe(nopeOnly.message);

    // (3) 有效域接受锚（反伪绿：拒绝锚单项在 HEAD 上巧合绿——组级判据必须含接受侧）。
    const plain = ok(runtime.readData([]), 'G5/accept/plain');
    const top = ok(runtime.readData([], { maxBytes: 2 ** 53 - 1 }), 'G5/accept/域顶');
    expect(top, 'G5/accept/域顶：2^53-1 必须成功且逐字节相同').toStrictEqual(plain);
    const bottom = failure(runtime.readData([], { maxBytes: 1 }), 'G5/accept/域底');
    expect(bottom.code, 'G5/accept/域底：{maxBytes:1} 不得是 READ_OPTIONS_INVALID（R0 超限应报预算码）')
      .toBe('READ_BUDGET_EXCEEDED');
    expect(bottom.measuredBytes).toBe(r0.total);

    // (4) 未知键对照仍走 T1 单源。
    expect(nopeOnly.code, 'G5/nope：未知键码').toBe('READ_OPTIONS_INVALID');
    await runtime.close();
  });
});

// ═════════════════════════════ G6：缺席目标 × 超限（AC⑥） ═════════════════════════════

describe('G6 缺席目标 × 超限：值侧 0、投影文本照常计量（ADR 0031 决策 5）', () => {
  it('G6 readData(["nick"])：maxBytes 26 拒（measuredBytes=27） / 27 收（value undefined、文本非 null）', async () => {
    const runtime = await makeRuntime405();
    const r7 = anchorById('R7');
    const rejected = budgetFailure(runtime.readData(['nick'], { maxBytes: r7.total - 1 }), 'G6/reject');
    expect(rejected.measuredBytes, 'G6：合计 = 投影文本单通道（值侧 0）').toBe(27);
    const accepted = ok(runtime.readData(['nick'], { maxBytes: r7.total }), 'G6/accept');
    expect(accepted.value, 'G6：值键恒在场、缺席为显式 undefined').toBeUndefined();
    expect(accepted.schema, 'G6：缺席目标投影文本照常在场').not.toBeNull();
    expect(accepted.truncated).toBe(false);
    await runtime.close();
  });
});

// ═════════════════════════════ G8（带 maxBytes 侧）：✂/头行零漂移 ═════════════════════════════

describe('G8 成功面恒四键 + ✂/头行文法零漂移（带 maxBytes 侧）', () => {
  it('G8 {depth:1,maxBytes:415}.schema 逐字节 === {depth:1}.schema；头行不记 maxBytes', async () => {
    const runtime = await makeRuntime405();
    const r1 = anchorById('R1');
    const plain = ok(runtime.readData([], { depth: 1 }), 'G8/plain');
    const budgeted = ok(runtime.readData([], { depth: 1, maxBytes: r1.total }), 'G8/budgeted');
    expectReadDataOkKeys(budgeted);
    expect(budgeted.schema).toBe(plain.schema);
    if (budgeted.schema === null) throw new Error('G8：契约前提失败（期望文本非 null）');
    expect(budgeted.schema.includes('maxBytes'), 'G8：头行不记 maxBytes（ADR 0031 决策 4）').toBe(false);
    expect(budgeted.schema.startsWith('# readData [] {depth:1}\n\n'), 'G8：头行文法冻结').toBe(true);
    expect(budgeted.schema.includes('✂ 截断事实：'), 'G8：✂ 段在场').toBe(true);
    await runtime.close();
  });
});

// ═════════════════════════════ G10：失败面优先级 + 敌意 options ═════════════════════════════

describe('G10 失败优先级阶梯（lifecycle > 校验 > 路径 > 预算）与敌意 options 收敛', () => {
  it('G10 值通道失败优先于预算：readData(["title",0], {maxBytes:1}) → PATH_NOT_ALLOWED（恰四键、无预算键）', async () => {
    const runtime = await makeRuntime405();
    const r = failure(runtime.readData(['title', 0], { maxBytes: 1 }), 'G10/path');
    expect(r.code).toBe('PATH_NOT_ALLOWED');
    expect(Object.keys(r).sort()).toStrictEqual([...OPTIONS_FAILURE_KEYS]);
    await runtime.close();
  });

  it('G10 校验先于度量：readData([], {maxBytes:0}) → READ_OPTIONS_INVALID（不得报预算码）', async () => {
    const runtime = await makeRuntime405();
    const r = failure(runtime.readData([], { maxBytes: 0 }), 'G10/validate');
    expect(r.code).toBe('READ_OPTIONS_INVALID');
    expect(Object.keys(r).sort()).toStrictEqual([...OPTIONS_FAILURE_KEYS]);
    await runtime.close();
  });

  it('G10 lifecycle 先于一切 options 读取：closed/closing 期 Proxy{maxBytes} → RUNTIME_READ_DISABLED、trap 0 次', async () => {
    const closingRuntime = await makeRuntime405();
    const proxy = throwingGetProxy({ maxBytes: 1 });
    const descriptorCounting = statefulDescriptorProxy({ maxBytes: 1 }, Number.POSITIVE_INFINITY);
    const closingPromise = closingRuntime.close();
    expect(closingRuntime.getStatus().lifecycle, 'G10/closing 前提：close() 同步迁移').toBe('closing');
    const closingResult = failure(closingRuntime.readData([], asOptions(proxy.options)), 'G10/closing');
    expect(closingResult.code).toBe('RUNTIME_READ_DISABLED');
    expect(proxy.getCalls(), 'G10/closing：get trap 零执行').toBe(0);
    expect(descriptorCounting.descriptorCalls(), 'G10/closing：任何 options 探测零触达').toBe(0);
    await closingPromise;

    const closedRuntime = await makeRuntime405();
    await closedRuntime.close();
    const closedResult = failure(closedRuntime.readData([], asOptions(proxy.options)), 'G10/closed');
    expect(closedResult.code).toBe('RUNTIME_READ_DISABLED');
    expect(proxy.getCalls(), 'G10/closed：get trap 零执行').toBe(0);
  });

  it('G10 accessor maxBytes → READ_OPTIONS_INVALID 且 getter 零执行；非 enumerable ≡ 无预算；present-undefined ≡ 缺席', async () => {
    const runtime = await makeRuntime405();
    const accessor = accessorMaxBytesOptions();
    const accessorResult = failure(runtime.readData([], asOptions(accessor.options)), 'G10/accessor');
    expect(accessorResult.code).toBe('READ_OPTIONS_INVALID');
    expect(Object.keys(accessorResult).sort()).toStrictEqual([...OPTIONS_FAILURE_KEYS]);
    expect(accessor.getterCalls(), 'G10/accessor：getter 零执行（零 [[Get]] 纪律）').toBe(0);

    const plain = ok(runtime.readData([]), 'G10/plain');
    // 非 enumerable 键 = 键空间外 ≡ 无预算（杀 in/直读实现）——成功且与无预算读全等。
    const hidden = ok(runtime.readData([], asOptions(nonEnumerableMaxBytesOptions(1))), 'G10/non-enumerable');
    expect(hidden).toStrictEqual(plain);
    // 键在场、值 undefined ≡ 缺席（D1；EOPT 下仅 JS 调用者可观测）。
    const presentUndefined = ok(runtime.readData([], asOptions({ maxBytes: undefined })), 'G10/present-undefined');
    expect(presentUndefined).toStrictEqual(plain);
    await runtime.close();
  });

  it('G10 敌意 descriptor 视图（状态化/交替）收敛 READ_OPTIONS_INVALID、绝不外抛（出口①/② 延伸三键面）', async () => {
    const statefulRuntime = await makeRuntime405();
    const stateful = statefulDescriptorProxy({ maxBytes: 1 }, 3); // 首读 2 次 descriptor 后第 3 次起抛
    const statefulResult = failure(statefulRuntime.readData([], asOptions(stateful.options)), 'G10/stateful');
    expect(statefulResult.code).toBe('READ_OPTIONS_INVALID');
    expect(Object.keys(statefulResult).sort()).toStrictEqual([...OPTIONS_FAILURE_KEYS]);
    expect(stateful.descriptorCalls(), 'G10/stateful：读次序 parity（split #1/#2 → canonical #3 抛 → re-split #4 抛）').toBe(4);
    await statefulRuntime.close();

    const alternatingRuntime = await makeRuntime405();
    const alternating = throwOnceDescriptorProxy({ maxBytes: 1 }, 3); // 仅第 3 次抛 → 出口②
    const alternatingResult = failure(alternatingRuntime.readData([], asOptions(alternating.options)), 'G10/alternating');
    expect(alternatingResult.code).toBe('READ_OPTIONS_INVALID');
    expect(Object.keys(alternatingResult).sort()).toStrictEqual([...OPTIONS_FAILURE_KEYS]);
    expect(alternating.descriptorCalls(), 'G10/alternating：出口②（re-split #4/#5 过 → 接缝终态）').toBe(5);
    await alternatingRuntime.close();
  });
});
