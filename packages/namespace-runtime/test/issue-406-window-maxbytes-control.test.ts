/**
 * issue #406（ADR 0031 窗口面同轴）回归 / 负控契约（SA6 §12.2 控制组）。
 *
 * 判定纪律：本文件在 HEAD **即绿**且实现后必须保持绿（SA6 §12.4 C1–C9）。断言只观察公共
 * 接缝（方法结果联合、own 键集、字节、渲染文本、异常观测）；期望值全部取自冻结锚表 /
 * 独立 oracle——绝不从被测 `measuredBytes` 反推（反伪绿 §12.5 R1/R10）。
 *
 * 组：
 * - C1 无预算窗口读 18 锚：恒四键 + 冻结字节 + ✂ 事实行/`schema:null` 逐锚复验；
 * - C2 无预算调用永不返回预算码（零泄漏行为锚）；
 * - C3 G0 定序：非数组 path 先于 options 校验（PATH_NOT_ALLOWED）；
 * - C4 键空间纪律：非 enumerable `maxBytes` ≡ 无预算（杀 `in`/直读实现）；
 * - C5 doc-runtime 零改动行为锁（ADR 0031 §4）：窗口载体原语拒 `maxBytes`（未知键）；
 * - C6 lifecycle 停接纳先于 options 读取（trap 零执行）；
 * - C7 敌意 options 零外抛（descriptor trap → WINDOW_OPTIONS_INVALID；get trap 零执行）；
 * - C8 readData 面既有超限文案锚（三面同文的镜像对象；实现若漂移共享文案即红）；
 * - C9 无预算过滤窗口装满判定锚（kept === n 双态 + ✂ 永不装配）。
 */
import { describe, expect, it } from 'vitest';
import { readArrayWindowAtPath, readMapWindowAtPath } from '@nomicore/doc-runtime';
import type { ReadArrayWindowOptions, ReadMapWindowOptions } from '@nomicore/doc-runtime';
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
  WINDOW_ANCHORS_406,
  windowAnchorById,
  windowFactLines,
  type Window406OkShape,
} from './issue-406-window-maxbytes-fixture.js';

// ── 装置 helper ─────────────────────────────────────────────────────────────────────

/** 单次捕获公共面调用：区分「返回了结果」与「裸抛逃逸」。 */
function capture<T>(call: () => T): { readonly result: T | undefined; readonly escaped: unknown } {
  try {
    return { result: call(), escaped: undefined };
  } catch (error) {
    return { result: undefined, escaped: error };
  }
}

/** 非 enumerable own `maxBytes` 键（键空间外 ≡ 无预算；杀 `in`/直读实现）。 */
function nonEnumerableMaxBytesOptions(base: Record<string, unknown>, maxBytes: number): object {
  const options: Record<string, unknown> = { ...base };
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
      void t;
      void key;
      void receiver;
      throw new Error('probe: get trap');
    },
  });
  return { options, getCalls: () => getCalls };
}

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

// ── C1 无预算窗口读冻结锚（18 锚逐锚复验）────────────────────────────────────────────

describe('C1 无预算窗口读冻结锚（回归锚；HEAD 即绿）', () => {
  it('C1 锚表结构：18 锚、id 唯一、字节合计自洽', () => {
    expect(WINDOW_ANCHORS_406.length, '锚表恰 18 项').toBe(18);
    const ids = WINDOW_ANCHORS_406.map((anchor) => anchor.id);
    expect(new Set(ids).size, '锚 id 唯一').toBe(ids.length);
    for (const anchor of WINDOW_ANCHORS_406) {
      expect(anchor.total, `C1/${anchor.id}：total = valueBytes + schemaBytes`).toBe(anchor.valueBytes + anchor.schemaBytes);
      expect(anchor.truncated && anchor.factsLine !== null, `C1/${anchor.id}：✂ 事实行仅在「无 where ∧ 截断 ∧ schema 非 null」装配`)
        .toBe(anchor.truncated && !anchor.schemaNull && !('where' in anchor.options));
    }
  });

  it('C1 逐锚：恒四键 + 冻结两通道字节 + truncated + ✂ 事实行/`schema:null`', async () => {
    const { runtime } = await makeWindow406Runtime();
    for (const anchor of WINDOW_ANCHORS_406) {
      const read = readWindowAnchor(runtime, anchor);
      expectWindowOkKeys(read as unknown as object);
      const bytes = measureWindowChannels(read.value, read.schema);
      expect(bytes.valueBytes, `C1/${anchor.id}：valueBytes`).toBe(anchor.valueBytes);
      expect(bytes.schemaBytes, `C1/${anchor.id}：schemaBytes`).toBe(anchor.schemaBytes);
      expect(bytes.total, `C1/${anchor.id}：total`).toBe(anchor.total);
      expect(read.truncated, `C1/${anchor.id}：truncated`).toBe(anchor.truncated);
      expect(read.schema === null, `C1/${anchor.id}：schema null 单义`).toBe(anchor.schemaNull);
      const facts = windowFactLines(read.schema);
      if (anchor.factsLine === null) {
        expect(facts, `C1/${anchor.id}：不装配 ✂ 事实行`).toStrictEqual([]);
      } else {
        expect(facts, `C1/${anchor.id}：✂ 事实行逐字节`).toStrictEqual([anchor.factsLine]);
        expect(read.schema, `C1/${anchor.id}：✂ 头行在场`).toContain('✂ 截断事实：');
      }
      // 键集经集中化 helper 表达（形状断言集中化门 #333/#364；本文件零字面键集）。
      expectWindowOkKeys(read as unknown as object);
    }
  });
});

// ── C2 零泄漏：无预算调用永不返回预算码/载荷 ─────────────────────────────────────────

describe('C2 无预算调用零泄漏（行为锚）', () => {
  it('C2 18 锚无预算读：恒 ok:true 且结构不可达 READ_BUDGET_EXCEEDED / measuredBytes', async () => {
    const { runtime } = await makeWindow406Runtime();
    for (const anchor of WINDOW_ANCHORS_406) {
      const read = readWindowAnchor(runtime, anchor);
      expect(read.ok, `C2/${anchor.id}：无预算读成功`).toBe(true);
      expect(read, `C2/${anchor.id}：不得携带 measuredBytes`).not.toHaveProperty('measuredBytes');
      expect(read, `C2/${anchor.id}：不得携带预算码`).not.toHaveProperty('code');
    }
  });
});

// ── C3 G0 定序：非数组 path 先于 options 校验 ────────────────────────────────────────

describe('C3 G0 定序：非数组 path 拒绝先于 options 校验（含 maxBytes 域）', () => {
  it('C3 非数组 path + 非法/合法 maxBytes → PATH_NOT_ALLOWED（零 options 判据）', async () => {
    const { runtime } = await makeWindow406Runtime();
    for (const options of [{ n: 1, maxBytes: 0 }, { n: 1, maxBytes: 1 }]) {
      const arrayFailure = expectWindowFailure(runtime.readArray('not-an-array' as never, options as never), `C3/array ${JSON.stringify(options)}`);
      expect(arrayFailure.code, 'C3/array：码').toBe('PATH_NOT_ALLOWED');
      const mapFailure = expectWindowFailure(runtime.readMap('not-an-array' as never, options as never), `C3/map ${JSON.stringify(options)}`);
      expect(mapFailure.code, 'C3/map：码').toBe('PATH_NOT_ALLOWED');
    }
  });
});

// ── C4 键空间纪律：非 enumerable `maxBytes` ≡ 无预算 ─────────────────────────────────

describe('C4 键空间纪律（杀 `in`/直读实现）', () => {
  it('C4 非 enumerable maxBytes ≡ 无预算（逐字节一致）', async () => {
    const { runtime } = await makeWindow406Runtime();
    for (const id of ['WA0', 'WA1', 'WM0', 'WM1'] as const) {
      const anchor = windowAnchorById(id);
      const oracle = readWindowAnchor(runtime, anchor);
      const keyspace = nonEnumerableMaxBytesOptions(anchor.options, 1);
      const read = anchor.face === 'array'
        ? runtime.readArray(anchor.path, keyspace as never)
        : runtime.readMap(anchor.path, keyspace as never);
      expect(read, `C4/${id}：非 enumerable 键 ≡ 缺席`).toStrictEqual<Window406OkShape>(oracle);
    }
  });
});

// ── C5 doc-runtime 零改动行为锁（ADR 0031 §4）────────────────────────────────────────

describe('C5 doc-runtime 零改动行为锁：窗口载体原语拒 maxBytes（未知键）', () => {
  it('C5 readArrayWindowAtPath / readMapWindowAtPath 携 maxBytes → WINDOW_OPTIONS_INVALID（未知键）', async () => {
    const { doc } = await makeWindow406Runtime();
    const arrayFailure = expectWindowFailure(
      readArrayWindowAtPath(doc, ['items'], { n: 2, maxBytes: 1 } as unknown as ReadArrayWindowOptions),
      'C5/array 载体原语',
    );
    expect(arrayFailure.code, 'C5/array：码').toBe('WINDOW_OPTIONS_INVALID');
    expect(arrayFailure.message, 'C5/array：maxBytes 在 doc-runtime 面仍是未知键').toContain('maxBytes');
    const mapFailure = expectWindowFailure(
      readMapWindowAtPath(doc, ['itemMap'], { n: 2, maxBytes: 1 } as unknown as ReadMapWindowOptions),
      'C5/map 载体原语',
    );
    expect(mapFailure.code, 'C5/map：码').toBe('WINDOW_OPTIONS_INVALID');
    expect(mapFailure.message, 'C5/map：maxBytes 在 doc-runtime 面仍是未知键').toContain('maxBytes');
    // 无预算载体原语健康（既有五键面零漂移）
    const healthy = readArrayWindowAtPath(doc, ['items'], { n: 2 });
    expect(healthy.ok, 'C5：无预算载体原语成功').toBe(true);
  });
});

// ── C6 lifecycle 停接纳先于 options 读取 ─────────────────────────────────────────────

describe('C6 lifecycle 停接纳先于一切 options 触达', () => {
  it('C6 closed 期携敌意 maxBytes options → RUNTIME_READ_DISABLED 且 trap 零执行', async () => {
    const { runtime } = await makeWindow406Runtime();
    await runtime.close();
    const arrayProxy = throwingGetProxy({ n: 1, maxBytes: 1 });
    const arrayResult = capture(() => runtime.readArray(['items'], arrayProxy.options as never));
    expect(arrayResult.escaped, 'C6/array：零外抛').toBeUndefined();
    const arrayFailure = expectWindowFailure(arrayResult.result, 'C6/array');
    expect(arrayFailure.code, 'C6/array：停接纳码').toBe('RUNTIME_READ_DISABLED');
    expect(arrayProxy.getCalls(), 'C6/array：get trap 零执行（零 options 读取）').toBe(0);
    const mapProxy = throwingGetProxy({ n: 1, maxBytes: 1 });
    const mapResult = capture(() => runtime.readMap(['itemMap'], mapProxy.options as never));
    expect(mapResult.escaped, 'C6/map：零外抛').toBeUndefined();
    const mapFailure = expectWindowFailure(mapResult.result, 'C6/map');
    expect(mapFailure.code, 'C6/map：停接纳码').toBe('RUNTIME_READ_DISABLED');
    expect(mapProxy.getCalls(), 'C6/map：get trap 零执行').toBe(0);
  });
});

// ── C7 敌意 options 零外抛 ───────────────────────────────────────────────────────────

describe('C7 敌意 options：探测期异常收编、零 [[Get]]、零外抛', () => {
  it('C7 descriptor trap 抛出 → WINDOW_OPTIONS_INVALID（绝不上抛）', async () => {
    const { runtime } = await makeWindow406Runtime();
    const arrayProxy = statefulDescriptorProxy({ n: 2, maxBytes: 1 }, 1);
    const arrayResult = capture(() => runtime.readArray(['items'], arrayProxy.options as never));
    expect(arrayResult.escaped, 'C7/array：零外抛').toBeUndefined();
    expect(expectWindowFailure(arrayResult.result, 'C7/array').code, 'C7/array：码').toBe('WINDOW_OPTIONS_INVALID');
    const mapProxy = statefulDescriptorProxy({ n: 2, maxBytes: 1 }, 1);
    const mapResult = capture(() => runtime.readMap(['itemMap'], mapProxy.options as never));
    expect(mapResult.escaped, 'C7/map：零外抛').toBeUndefined();
    expect(expectWindowFailure(mapResult.result, 'C7/map').code, 'C7/map：码').toBe('WINDOW_OPTIONS_INVALID');
  });

  it('C7 抛错 get trap Proxy（descriptor 诚实）→ WINDOW_OPTIONS_INVALID 且 get trap 零执行', async () => {
    const { runtime } = await makeWindow406Runtime();
    // 装置原位修订（SA3 / #406，理由记录在案）：本用例原实参 `maxBytes: 1` —— 该值在
    // ADR-0031 域内（≥1 有限整数），按同契约 G5「有效域接受锚」**必须**走
    // `READ_BUDGET_EXCEEDED`（G5 明文「不是 options 码」）；故 `{n:2, maxBytes:1}` 在任何
    // 满足 G 组的实现上都不可能是四键 `WINDOW_OPTIONS_INVALID`（HEAD 上它只因「未知键」而
    // 巧合落该码）。用例意图 =「敌意宿主 + 零 [[Get]] → 响亮 options 码」，与预算分支无关，
    // 故以**域外** `maxBytes: 0` 承载同一意图（options 违约面），判据/语义零弱化。
    const proxy = throwingGetProxy({ n: 2, maxBytes: 0 });
    const result = capture(() => runtime.readMap(['itemMap'], proxy.options as never));
    expect(result.escaped, 'C7：零外抛').toBeUndefined();
    const failure = expectWindowFailure(result.result, 'C7/get trap');
    expect(failure.code, 'C7：码').toBe('WINDOW_OPTIONS_INVALID');
    expect(failure.message, 'C7：message 区分 maxBytes 域').toContain('maxBytes');
    expect(proxy.getCalls(), 'C7：零 [[Get]] 纪律（get trap 零执行）').toBe(0);
  });
});

// ── C8 readData 面超限文案锚（三面同文镜像对象）─────────────────────────────────────

describe('C8 readData 面既有超限分支锚（镜像对象；实现漂移共享文案即红）', () => {
  it('C8 readData 超限：恰五键 + `measuredBytes` 合计 + 冻结文案模板', async () => {
    const { runtime } = await makeWindow406Runtime();
    // 期望来源（R1）：同参无预算 readData 的独立两通道测量——绝不消费被测 measuredBytes。
    const plain = runtime.readData(['items']);
    if (!plain.ok) throw new Error(`C8：契约前提失败（无预算 readData 应成功，实际 ${JSON.stringify(plain)}）`);
    const expectedTotal = measureWindowChannels(plain.value, plain.schema).total;
    const result = runtime.readData(['items'], { maxBytes: 1 });
    expect(result.ok, 'C8：readData 超限分支在场').toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.code, 'C8：码').toBe('READ_BUDGET_EXCEEDED');
    expect(Object.keys(result).sort(), 'C8：恰五键').toStrictEqual([...BUDGET_FAILURE_KEYS]);
    const failure = expectBudgetFailure(result, expectedTotal, 'C8');
    expect(failure.message, 'C8：冻结文案模板（三面同文镜像对象）').toBe(budgetMessageTemplate(expectedTotal, 1));
  });
});

// ── C9 无预算过滤窗口装满判定锚 ─────────────────────────────────────────────────────

describe('C9 无预算过滤窗口装满判定与 ✂ 不装配（既有语义锚）', () => {
  it('C9 kept === n → true（可能还有）；kept < n → false（扫完）；schema 无 ✂ 段', async () => {
    const { runtime } = await makeWindow406Runtime();
    const cases: ReadonlyArray<readonly [string, boolean]> = [['WM4', true], ['WM5', false], ['WM6', true], ['WA7', true]];
    for (const [id, fill] of cases) {
      const read = readWindowAnchor(runtime, windowAnchorById(id));
      expect(read.truncated, `C9/${id}：装满判定`).toBe(fill);
      expect(read.schema, `C9/${id}：元素口径投影文本在场`).not.toBeNull();
      expect(windowFactLines(read.schema), `C9/${id}：✂ 段永不装配`).toStrictEqual([]);
      expect(read.value.length, `C9/${id}：条目列表在场`).toBeGreaterThan(0);
    }
  });
});

// ── C10 冻结锚与同运行 oracle 自洽（装置健康）────────────────────────────────────────

describe('C10 装置健康：同运行 oracle ≡ 冻结锚（期望来源双通道独立）', () => {
  it('C10 18 锚：同运行无预算读的独立测量 = 冻结锚', async () => {
    const { runtime } = await makeWindow406Runtime();
    for (const anchor of WINDOW_ANCHORS_406) {
      const oracle = readWindowAnchor(runtime, anchor);
      const bytes = measureWindowChannels(oracle.value, oracle.schema);
      expect(bytes, `C10/${anchor.id}：独立测量 ≡ 冻结锚`).toStrictEqual({
        valueBytes: anchor.valueBytes,
        schemaBytes: anchor.schemaBytes,
        total: anchor.total,
      });
    }
  });
});
