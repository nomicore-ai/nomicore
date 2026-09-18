/**
 * issue #406（ADR 0031 窗口面同轴）`readArray`/`readMap` 的 `maxBytes` 交付总量收/拒闸
 * —— **红灯契约主体**（SA6 §12.2/§12.3 G1–G6、G8、G10 预算法定序侧）。
 *
 * HEAD 判定：G1–G6、G8(带预算侧)、G10(缺席/载体 × 合法预算) 全红，红因单一——
 * `maxBytes` 命中 W1 options 键空间白名单 → `WINDOW_OPTIONS_INVALID`（未知键；SA6 §5 P1）。
 * 本文件不构造任何实现内部耦合断言（只观察公共接缝：方法结果联合、own 键集、字节、
 * 投影文本、异常观测）。
 *
 * 期望来源纪律（SA6 §12.5 R1）：§12.0 冻结锚常量 **或** 同运行同参无预算读的独立两通道
 * 测量；禁止从被测 `measuredBytes` 反推期望。
 */
import { describe, expect, it } from 'vitest';
import type { NamespaceRuntime } from '../src/index.js';
import {
  BUDGET_FAILURE_KEYS,
  budgetMessageTemplate,
  expectBudgetFailure,
  expectWindowFailure,
  expectWindowOkKeys,
  makeWindow406Runtime,
  measureWindowChannels,
  readWindowAnchor,
  readWindowAnchorWithBudget,
  utf16,
  utf8,
  WINDOW_ANCHORS_406,
  windowAnchorById,
  windowFactLines,
  type Window406Anchor,
  type Window406OkShape,
} from './issue-406-window-maxbytes-fixture.js';

// ── 装置 helper（只观察公共接缝）─────────────────────────────────────────────────────

/** 单次捕获公共面调用：显式区分「返回了结果」与「裸抛逃逸」。 */
function capture<T>(call: () => T): { readonly result: T | undefined; readonly escaped: unknown } {
  try {
    return { result: call(), escaped: undefined };
  } catch (error) {
    return { result: undefined, escaped: error };
  }
}

/** 失败成员形状读数（供三面一致性比较；不改写断言语义）。 */
function failureOf(actual: unknown, label: string): { code: string; keys: string[]; message: string; measuredBytes?: number } {
  const failure = actual as { ok: boolean; code: string; message: string; measuredBytes?: number };
  expect(failure.ok, `${label}：应为失败分支`).toBe(false);
  return {
    code: failure.code,
    keys: Object.keys(failure).sort(),
    message: failure.message,
    ...(failure.measuredBytes !== undefined ? { measuredBytes: failure.measuredBytes } : {}),
  };
}

/** 数组面/键面锚上的预算读（窄化失败断言前的 raw 通道）。 */
function budgetRead(runtime: NamespaceRuntime, anchor: Window406Anchor, maxBytes: number): unknown {
  return readWindowAnchorWithBudget(runtime, anchor, maxBytes);
}

// ── G1 总量 ≤ 预算成功且交付物逐字节一致（AC1/AC3）────────────────────────────────────

describe('G1 ≤ 预算成功：交付物与同参无预算窗口读逐字节一致', () => {
  it('G1 数组面 8 锚：恰好等于预算与宽预算均成功且四键全等', async () => {
    const { runtime } = await makeWindow406Runtime();
    const arrayAnchors = WINDOW_ANCHORS_406.filter((anchor) => anchor.face === 'array');
    expect(arrayAnchors.length, '装置前提：数组面锚在场').toBeGreaterThan(0);
    for (const anchor of arrayAnchors) {
      const oracle = readWindowAnchor(runtime, anchor);
      const exact = budgetRead(runtime, anchor, anchor.total);
      expectWindowOkKeys(exact as object);
      expect(exact, `G1/${anchor.id}：maxBytes = total 成功且逐字节一致`).toStrictEqual<Window406OkShape>(oracle);
      const wide = budgetRead(runtime, anchor, 2 ** 53 - 1);
      expect(wide, `G1/${anchor.id}：宽预算（域顶）成功且逐字节一致`).toStrictEqual<Window406OkShape>(oracle);
    }
  });

  it('G1 键面 10 锚：同款（含 desc / field 基 / where / schema:null）', async () => {
    const { runtime } = await makeWindow406Runtime();
    const mapAnchors = WINDOW_ANCHORS_406.filter((anchor) => anchor.face === 'map');
    expect(mapAnchors.length, '装置前提：键面锚在场').toBeGreaterThan(0);
    for (const anchor of mapAnchors) {
      const oracle = readWindowAnchor(runtime, anchor);
      const exact = budgetRead(runtime, anchor, anchor.total);
      expectWindowOkKeys(exact as object);
      expect(exact, `G1/${anchor.id}：maxBytes = total 成功且逐字节一致`).toStrictEqual<Window406OkShape>(oracle);
      const wide = budgetRead(runtime, anchor, 2 ** 53 - 1);
      expect(wide, `G1/${anchor.id}：宽预算（域顶）成功且逐字节一致`).toStrictEqual<Window406OkShape>(oracle);
    }
  });
});

// ── G2 边界对：total 收 / total − 1 拒（AC2/AC5）──────────────────────────────────────

describe('G2 边界对：≤ 判定精确（total 收、total − 1 拒）', () => {
  it('G2 18 锚全组：拒侧 measuredBytes = 同运行无预算读的独立两通道合计', async () => {
    const { runtime } = await makeWindow406Runtime();
    expect(WINDOW_ANCHORS_406.length, '装置前提：锚表在场').toBe(18);
    for (const anchor of WINDOW_ANCHORS_406) {
      const oracle = readWindowAnchor(runtime, anchor);
      const oracleBytes = measureWindowChannels(oracle.value, oracle.schema);
      const accept = budgetRead(runtime, anchor, anchor.total);
      expect(accept, `G2/${anchor.id}：total=${String(anchor.total)} 收`).toStrictEqual<Window406OkShape>(oracle);
      const reject = budgetRead(runtime, anchor, anchor.total - 1);
      const failure = expectBudgetFailure(reject, anchor.total, `G2/${anchor.id}`);
      expect(failure.measuredBytes, `G2/${anchor.id}：冻结锚与独立 oracle 一致`).toBe(oracleBytes.total);
      expect(failure.measuredBytes, `G2/${anchor.id}：measuredBytes = 两通道合计`).toBe(oracleBytes.valueBytes + oracleBytes.schemaBytes);
    }
  });
});

// ── G3 超限零交付形状 + 三面同码同文同载荷（AC2）───────────────────────────────────────

describe('G3 超限零交付与三面报错形态一致性', () => {
  it('G3 恰五键 / 零成功键 / path 新鲜回显 / message 模板 / 同步零外抛', async () => {
    const { runtime } = await makeWindow406Runtime();
    for (const id of ['WA1', 'WM1', 'WA4', 'WM8'] as const) {
      const anchor = windowAnchorById(id);
      const path = [...anchor.path];
      const options = { ...anchor.options, maxBytes: 1 };
      const escapedCall = capture(() => (anchor.face === 'array'
        ? runtime.readArray(path, options as never)
        : runtime.readMap(path, options as never)));
      expect(escapedCall.escaped, `G3/${id}：同步返回、绝不外抛`).toBeUndefined();
      const failure = expectBudgetFailure(escapedCall.result, anchor.total, `G3/${id}`);
      expect(Object.keys(failure).sort(), `G3/${id}：恰五键（零交付）`).toStrictEqual([...BUDGET_FAILURE_KEYS]);
      expect(failure, `G3/${id}：不得携带成功键`).not.toHaveProperty('value');
      expect(failure, `G3/${id}：不得携带成功键`).not.toHaveProperty('schema');
      expect(failure, `G3/${id}：不得携带成功键`).not.toHaveProperty('truncated');
      expect(failure.path, `G3/${id}：path 深等实参`).toStrictEqual([...anchor.path]);
      expect(failure.path, `G3/${id}：path 是新鲜副本（非同一引用）`).not.toBe(path);
      expect(failure.message, `G3/${id}：message = 三面同文模板`).toBe(budgetMessageTemplate(failure.measuredBytes, 1));
      path.push('mutated-after-call');
      expect(failure.path, `G3/${id}：实参事后变异不影响已返回结果`).toStrictEqual([...anchor.path]);
    }
  });

  it('G3 三面（readData / readArray / readMap）同码同文同载荷形', async () => {
    const { runtime } = await makeWindow406Runtime();
    const dataFailure = failureOf(runtime.readData(['items'], { maxBytes: 1 }), 'readData');
    const arrayFailure = failureOf(runtime.readArray(['items'], { n: 3, maxBytes: 1 } as never), 'readArray');
    const mapFailure = failureOf(runtime.readMap(['itemMap'], { n: 5, maxBytes: 1 } as never), 'readMap');
    expect(dataFailure.code, '三面同码：readData').toBe('READ_BUDGET_EXCEEDED');
    expect(arrayFailure.code, '三面同码：readArray').toBe('READ_BUDGET_EXCEEDED');
    expect(mapFailure.code, '三面同码：readMap').toBe('READ_BUDGET_EXCEEDED');
    expect(arrayFailure.keys, '三面同载荷形：数组面 ≡ readData 面键集').toStrictEqual(dataFailure.keys);
    expect(mapFailure.keys, '三面同载荷形：键面 ≡ readData 面键集').toStrictEqual(dataFailure.keys);
    expect(dataFailure.keys, '三面同载荷形：恰五键').toStrictEqual([...BUDGET_FAILURE_KEYS]);
    for (const [label, failure] of [['readData', dataFailure], ['readArray', arrayFailure], ['readMap', mapFailure]] as const) {
      expect(failure.message, `三面同文：${label} message 模板`).toBe(budgetMessageTemplate(failure.measuredBytes as number, 1));
    }
  });
});

// ── G4 度量等式 property（AC5）────────────────────────────────────────────────────────

describe('G4 度量等式：measuredBytes = 条目列表 JSON UTF-8 + 元素口径投影文本 UTF-8', () => {
  it('G4 18 锚构造性等式（含 ✂ 块自然计入、schema:null 计 0）', async () => {
    const { runtime } = await makeWindow406Runtime();
    for (const anchor of WINDOW_ANCHORS_406) {
      const oracle = readWindowAnchor(runtime, anchor);
      const valueBytes = utf8(JSON.stringify(oracle.value));
      const schemaBytes = oracle.schema === null ? 0 : utf8(oracle.schema);
      expect(anchor.valueBytes, `G4/${anchor.id}：冻结 valueBytes`).toBe(valueBytes);
      expect(anchor.schemaBytes, `G4/${anchor.id}：冻结 schemaBytes`).toBe(schemaBytes);
      expect(anchor.total, `G4/${anchor.id}：冻结 total = 两通道之和`).toBe(valueBytes + schemaBytes);
      const failure = expectBudgetFailure(budgetRead(runtime, anchor, anchor.total - 1), anchor.total, `G4/${anchor.id}`);
      expect(failure.measuredBytes, `G4/${anchor.id}：measuredBytes = 构造性合计`).toBe(valueBytes + schemaBytes);
      expect(Buffer.byteLength(JSON.stringify(oracle.value), 'utf8'), `G4/${anchor.id}：value 通道单位`).toBe(valueBytes);
    }
  });

  it('G4 单位敏感 + 单通道锚：CJK 锚 utf8 ≠ utf16；schema:null 计 0', async () => {
    const { runtime } = await makeWindow406Runtime();
    const cjk = windowAnchorById('WA3');
    const oracle = readWindowAnchor(runtime, cjk);
    const valueJson = JSON.stringify(oracle.value);
    expect(cjk.schemaNull, '装置前提：WA3 投影文本缺席（schema:null）').toBe(true);
    expect(cjk.valueBytes, 'G4/WA3：valueBytes = UTF-8 字节').toBe(utf8(valueJson));
    expect(utf8(valueJson), 'G4/WA3：CJK 下 utf8 ≠ utf16（单位敏感锚）').not.toBe(utf16(valueJson));
    const failure = expectBudgetFailure(budgetRead(runtime, cjk, cjk.total - 1), cjk.total, 'G4/WA3');
    expect(failure.measuredBytes, 'G4/WA3：schema:null 计 0（仅价值通道）').toBe(utf8(valueJson));
    const rawMap = windowAnchorById('WM8');
    const rawMapFailure = expectBudgetFailure(budgetRead(runtime, rawMap, rawMap.total - 1), rawMap.total, 'G4/WM8');
    expect(rawMapFailure.measuredBytes, 'G4/WM8：schema:null 计 0（仅价值通道）').toBe(utf8(JSON.stringify(readWindowAnchor(runtime, rawMap).value)));
  });

  it('G4 双通道锚：measuredBytes 严格大于任一单通道（杀单通道/漏计 ✂ 实现）', async () => {
    const { runtime } = await makeWindow406Runtime();
    for (const id of ['WA1', 'WA2', 'WA5', 'WM1', 'WM2', 'WM3', 'WM9'] as const) {
      const anchor = windowAnchorById(id);
      const failure = expectBudgetFailure(budgetRead(runtime, anchor, anchor.total - 1), anchor.total, `G4/${id}`);
      expect(anchor.valueBytes, `装置前提：${id} 双通道非零`).toBeGreaterThan(0);
      expect(anchor.schemaBytes, `装置前提：${id} 双通道非零`).toBeGreaterThan(0);
      expect(failure.measuredBytes, `G4/${id}：合计 ≠ 价值通道`).not.toBe(anchor.valueBytes);
      expect(failure.measuredBytes, `G4/${id}：合计 ≠ schema 通道`).not.toBe(anchor.schemaBytes);
    }
  });
});

// ── G5 options 校验负控 + 有效域接受锚（AC1；组级判据）───────────────────────────────

describe('G5 options 负控与有效域边界（组级红/绿判据）', () => {
  const invalidMatrix: ReadonlyArray<readonly [string, unknown]> = [
    ['0（下界外）', 0],
    ['-1（负）', -1],
    ['1.5（非整数）', 1.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ["'100'（string）", '100'],
    ['true（boolean）', true],
    ['2^53（域外边界）', 2 ** 53],
    ['2^53 + 2（域外上邻）', 2 ** 53 + 2],
    ['1e21（域外）', 1e21],
    ['{}（对象）', {}],
  ];

  it('G5 非法矩阵：WINDOW_OPTIONS_INVALID + maxBytes 域 message + 恰四键（两面）', async () => {
    const { runtime } = await makeWindow406Runtime();
    const unknownKeyMessage2 = expectWindowFailure(runtime.readArray(['items'], { n: 1, nope: 1 } as never), 'G5/未知键 nope').message;
    for (const [label, value] of invalidMatrix) {
      const arrayFailure = expectWindowFailure(runtime.readArray(['items'], { n: 3, maxBytes: value } as never), `G5/array ${label}`);
      expect(arrayFailure.code, `G5/array ${label}：码`).toBe('WINDOW_OPTIONS_INVALID');
      expect(arrayFailure.message, `G5/array ${label}：message 区分 maxBytes 域`).toContain('maxBytes');
      expect(arrayFailure.message, `G5/array ${label}：message ≠ 未知键 message`).not.toBe(unknownKeyMessage2);
      expect(Object.keys(arrayFailure).sort(), `G5/array ${label}：恰四键`).toStrictEqual(['code', 'message', 'ok', 'path']);
      const mapFailure = expectWindowFailure(runtime.readMap(['itemMap'], { n: 2, maxBytes: value } as never), `G5/map ${label}`);
      expect(mapFailure.code, `G5/map ${label}：码`).toBe('WINDOW_OPTIONS_INVALID');
      expect(mapFailure.message, `G5/map ${label}：message 区分 maxBytes 域`).toContain('maxBytes');
    }
  });

  it('G5 有效域接受锚 + C-LIMIT：2^53−1 收、2^53/2^53+2/1e21 拒（反伪绿配平）', async () => {
    const { runtime } = await makeWindow406Runtime();
    const anchor = windowAnchorById('WA1');
    const oracle = readWindowAnchor(runtime, anchor);
    // 域顶接受锚（HEAD 上未知键伪绿陷阱的对侧：域内必须成功）
    const domainTop = budgetRead(runtime, anchor, 2 ** 53 - 1);
    expect(domainTop, 'G5/C-LIMIT：2^53−1 必须成功且逐字节一致').toStrictEqual<Window406OkShape>(oracle);
    // maxBytes:1 是合法域内值 → 必须走超限分支而非选项校验分支
    const tiny = expectBudgetFailure(budgetRead(runtime, anchor, 1), anchor.total, 'G5/maxBytes=1');
    expect(tiny.code, 'G5：域内 maxBytes=1 不得报 options 校验码').toBe('READ_BUDGET_EXCEEDED');
    // 键面同款
    const mapAnchor = windowAnchorById('WM1');
    const mapOracle = readWindowAnchor(runtime, mapAnchor);
    expect(budgetRead(runtime, mapAnchor, 2 ** 53 - 1), 'G5/C-LIMIT：键面域顶成功').toStrictEqual<Window406OkShape>(mapOracle);
    expectBudgetFailure(budgetRead(runtime, mapAnchor, 1), mapAnchor.total, 'G5/键面 maxBytes=1');
  });

  it('G5 present-undefined ≡ 缺席（D1 pin）：maxBytes: undefined 与无预算读逐字节一致', async () => {
    const { runtime } = await makeWindow406Runtime();
    for (const anchor of WINDOW_ANCHORS_406.slice(0, 4)) {
      const oracle = readWindowAnchor(runtime, anchor);
      const withUndefined = anchor.face === 'array'
        ? runtime.readArray(anchor.path, { ...anchor.options, maxBytes: undefined } as never)
        : runtime.readMap(anchor.path, { ...anchor.options, maxBytes: undefined } as never);
      expect(withUndefined, `G5/D1 ${anchor.id}：present-undefined ≡ 缺席`).toStrictEqual<Window406OkShape>(oracle);
    }
  });

  it('G5 accessor maxBytes：WINDOW_OPTIONS_INVALID 且 getter 零执行；frozen 宿主接受', async () => {
    const { runtime } = await makeWindow406Runtime();
    let getterCalls = 0;
    const accessor = { n: 3, get maxBytes(): number { getterCalls += 1; return 1; } };
    const failure = expectWindowFailure(runtime.readArray(['items'], accessor as never), 'G5/accessor');
    expect(failure.code, 'G5/accessor：码').toBe('WINDOW_OPTIONS_INVALID');
    expect(failure.message, 'G5/accessor：message 含 maxBytes 域').toContain('maxBytes');
    expect(getterCalls, 'G5/accessor：零 [[Get]]（getter 零执行）').toBe(0);
    const anchor = windowAnchorById('WA0');
    const oracle = readWindowAnchor(runtime, anchor);
    const frozen = budgetRead(runtime, anchor, anchor.total);
    expect(frozen, 'G5/frozen：冻结 plain 宿主（data descriptor）必须接受').toStrictEqual<Window406OkShape>(oracle);
    const frozenOptions = Object.freeze({ n: 3, maxBytes: anchor.total });
    expect(runtime.readArray(['items'], frozenOptions as never), 'G5/frozen：runtime 显式冻结宿主').toStrictEqual<Window406OkShape>(oracle);
  });
});

// ── G6 where 过滤窗口 × 预算（AC4）───────────────────────────────────────────────────

describe('G6 where 过滤窗口：超限同分支、装满判定与 ✂ 语义不受预算影响', () => {
  it('G6 超限走同一报错分支：零交付、无静默条目丢弃（装满/扫完两态）', async () => {
    const { runtime } = await makeWindow406Runtime();
    for (const id of ['WM4', 'WM5', 'WM6', 'WA7'] as const) {
      const anchor = windowAnchorById(id);
      const oracle = readWindowAnchor(runtime, anchor);
      const failure = expectBudgetFailure(budgetRead(runtime, anchor, 1), anchor.total, `G6/${id}`);
      expect(Object.keys(failure).sort(), `G6/${id}：恰五键（无部分窗口交付）`).toStrictEqual([...BUDGET_FAILURE_KEYS]);
      expect(failure, `G6/${id}：不得静默交付条目子集`).not.toHaveProperty('value');
      expect(failure.measuredBytes, `G6/${id}：合计 = 无预算过滤窗口的独立测量`).toBe(measureWindowChannels(oracle.value, oracle.schema).total);
      const boundary = expectBudgetFailure(budgetRead(runtime, anchor, anchor.total - 1), anchor.total, `G6/${id}/边界`);
      expect(boundary.code, `G6/${id}/边界：同分支`).toBe('READ_BUDGET_EXCEEDED');
    }
  });

  it('G6 ≤ 预算：装满判定 kept === n 保持、✂ 段永不装配、条目逐字节无漂移', async () => {
    const { runtime } = await makeWindow406Runtime();
    const expectations: ReadonlyArray<readonly [string, boolean]> = [
      ['WM4', true], // kept 3 === n 3 → 可能还有匹配未入窗
      ['WM5', false], // kept 3 < n 5 → 匹配集已扫完
      ['WM6', true], // kept 5 === n 5（恰好装满）
      ['WA7', true], // 数组面 kept 1 === n 1
    ];
    for (const [id, fill] of expectations) {
      const anchor = windowAnchorById(id);
      const oracle = readWindowAnchor(runtime, anchor);
      expect(oracle.truncated, `G6/${id}：无预算装满判定`).toBe(fill);
      const budgeted = budgetRead(runtime, anchor, anchor.total);
      expect(budgeted, `G6/${id}：≤ 预算交付物逐字节一致`).toStrictEqual<Window406OkShape>(oracle);
      const ok = budgeted as Window406OkShape;
      expect(ok.truncated, `G6/${id}：预算不影响装满判定`).toBe(fill);
      expect(ok.schema, `G6/${id}：过滤窗口 ✂ 永不装配`).not.toBeNull();
      expect((ok.schema as string).includes('✂ 截断事实：'), `G6/${id}：schema 不含 ✂ 事实块`).toBe(false);
      expect(windowFactLines(ok.schema), `G6/${id}：零事实行`).toStrictEqual([]);
    }
  });

  it('G6 字节相同（305）而装满判定相反的两锚在预算下仍各自保持（预算不驱动 truncated）', async () => {
    const { runtime } = await makeWindow406Runtime();
    const full = windowAnchorById('WM4');
    const exhausted = windowAnchorById('WM5');
    expect(full.total, '装置前提：两锚字节相同（n 差异不改变交付条目）').toBe(exhausted.total);
    expect(readWindowAnchor(runtime, full).truncated, '装置前提：装满锚 truncated=true').toBe(true);
    expect(readWindowAnchor(runtime, exhausted).truncated, '装置前提：扫完锚 truncated=false').toBe(false);
    for (const anchor of [full, exhausted]) {
      const ok = budgetRead(runtime, anchor, anchor.total) as Window406OkShape;
      expect(ok.truncated, `G6/${anchor.id}：预算边界上各自保持`).toBe(readWindowAnchor(runtime, anchor).truncated);
    }
  });
});

// ── G8 maxBytes 不塑形交付（AC3）─────────────────────────────────────────────────────

describe('G8 maxBytes 不塑形交付：投影文本逐字节无漂移、零裁剪', () => {
  it('G8 带预算成功侧 schema 与无预算逐字节相同且不含 maxBytes', async () => {
    const { runtime } = await makeWindow406Runtime();
    for (const id of ['WA1', 'WA5', 'WM1', 'WM2', 'WM3', 'WM9'] as const) {
      const anchor = windowAnchorById(id);
      const oracle = readWindowAnchor(runtime, anchor);
      const ok = budgetRead(runtime, anchor, anchor.total) as Window406OkShape;
      expect(ok.schema, `G8/${id}：schema 逐字节相同`).toBe(oracle.schema);
      expect(ok.schema, `G8/${id}：schema 非 null`).not.toBeNull();
      expect((ok.schema as string).includes('maxBytes'), `G8/${id}：头行/正文不得记录 maxBytes`).toBe(false);
      expect(ok.value, `G8/${id}：条目列表逐字段相同（零裁剪）`).toStrictEqual(oracle.value);
      expect(ok.value.length, `G8/${id}：条目数不因预算变化`).toBe(oracle.value.length);
    }
  });

  it('G8 超限侧不得塑形：预算是收/拒判定而非裁剪（宽预算即原样交付）', async () => {
    const { runtime } = await makeWindow406Runtime();
    const anchor = windowAnchorById('WM2');
    const oracle = readWindowAnchor(runtime, anchor);
    const rejected = budgetRead(runtime, anchor, anchor.total - 1);
    expect(rejected, 'G8：超限零交付（无裁剪交付）').not.toHaveProperty('value');
    const accepted = budgetRead(runtime, anchor, anchor.total + 1000);
    expect(accepted, 'G8：宽预算原样成功（不裁剪、不降深度、不拟合）').toStrictEqual<Window406OkShape>(oracle);
  });
});

// ── G10 失败面优先级（预算法定序侧）──────────────────────────────────────────────────

describe('G10 失败面优先级：合法预算不吸收 W1 载体/缺席码', () => {
  it('G10 目标缺席 + 合法 maxBytes → WINDOW_TARGET_ABSENT（两面）', async () => {
    const { runtime } = await makeWindow406Runtime();
    const arrayFailure = expectWindowFailure(runtime.readArray(['nope'], { n: 1, maxBytes: 1 } as never), 'G10/array 缺席');
    expect(arrayFailure.code, 'G10/array：载体/缺席码原样').toBe('WINDOW_TARGET_ABSENT');
    const mapFailure = expectWindowFailure(runtime.readMap(['nope'], { n: 1, maxBytes: 1 } as never), 'G10/map 缺席');
    expect(mapFailure.code, 'G10/map：载体/缺席码原样').toBe('WINDOW_TARGET_ABSENT');
  });

  it('G10 载体不符 + 合法 maxBytes → WINDOW_CARRIER_MISMATCH（两面）', async () => {
    const { runtime } = await makeWindow406Runtime();
    const arrayFailure = expectWindowFailure(runtime.readArray(['itemMap'], { n: 1, maxBytes: 1 } as never), 'G10/array 载体');
    expect(arrayFailure.code, 'G10/array：载体码原样').toBe('WINDOW_CARRIER_MISMATCH');
    const mapFailure = expectWindowFailure(runtime.readMap(['items'], { n: 1, maxBytes: 1 } as never), 'G10/map 载体');
    expect(mapFailure.code, 'G10/map：载体码原样').toBe('WINDOW_CARRIER_MISMATCH');
  });

  it('G10 非法 options 同现 → WINDOW_OPTIONS_INVALID（不报预算码，校验先于度量）', async () => {
    const { runtime } = await makeWindow406Runtime();
    for (const options of [{ n: 0, maxBytes: 0 }, { n: -1, maxBytes: 5 }, { n: 1, maxBytes: 0, nope: 1 }]) {
      const failure = expectWindowFailure(runtime.readArray(['items'], options as never), `G10/${JSON.stringify(options)}`);
      expect(failure.code, `G10/${JSON.stringify(options)}：校验码`).toBe('WINDOW_OPTIONS_INVALID');
    }
    const mapFailure = expectWindowFailure(runtime.readMap(['itemMap'], { n: 0, maxBytes: 0 } as never), 'G10/map n:0');
    expect(mapFailure.code, 'G10/map：校验码').toBe('WINDOW_OPTIONS_INVALID');
  });
});
