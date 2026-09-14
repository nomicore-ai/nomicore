/**
 * issue #369（ADR 0028 W2）组合层红灯契约 —— namespace-runtime 窗口读公共方法
 * `readArray` / `readMap` 的组合不变量（设计 §7.3 编排 S1–S6 / §7.4 计数 / §11 ALLOW）。
 *
 * 契约来源：
 * - issue #369 What-to-build + AC1–AC6；
 * - `wiki/raw/task_issue-369_sa6_contract.md` §12.2 用例组 W2-A/S/T/E/F（组合层本地面）
 *   与 §12.6 敏感度防线；
 * - SA1 设计 §7.1 绑定表 B-1–B-11、§7.2 B-6 锚链、§7.3 编排、§7.4 计数路径。
 *
 * 红灯机理（HEAD `ab6e390`）：`NamespaceRuntime` 恰 12 键、无 `readArray`/`readMap`
 * ——能力存在性断言红（`typeof === 'undefined'`），其余用例因方法缺席而不可达；
 * readData / W1 原语负控同场保持绿（装置健康）。
 *
 * 断言纪律：只观察公共接缝（runtime 方法结果）；形状经集中化 helper
 * （`expectReadDataOkKeys`）表达；`total` 一律以**独立预言机**（Yjs/native 直数）
 * 对账；零 skip/only、零源码文本断言。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { readArrayWindowAtPath, readMapWindowAtPath } from '@nomicore/doc-runtime';
import type {
  NamespaceRuntime,
  NamespaceRuntimeReadArrayOptions,
  NamespaceRuntimeReadMapOptions,
  RuntimeReadDisabledResult,
} from '../src/index.js';
import { expectReadDataOkKeys } from './helpers/readdata-ok-shape.js';
import {
  createWindowRuntimeFromHandle,
  makeWindowHandle,
  makeWindowRuntime,
  WINDOW_DOC_ID,
  WINDOW_OWNER,
} from '../../namespace-registry/test/issue-369-window-read-fixture.js';
// ───────────────────────── 契约常量与文本剥离（双侧对账共用） ─────────────────────────

/** ✂ 段头行（ADR-0027 决策 1：截断事实唯一载体；窗口事实块同款文法）。 */
const TRUNCATION_HEADER = '✂ 截断事实：';

/**
 * 剥掉 ✂ 段（值通道截断 / 窗口事实）并保留正文自身尾换行：✂ 段恒为文末块、
 * 以恰 1 空行分隔（`\n\n✂ 截断事实：`），故按最后一次出现位置整段切除。
 */
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

/** AC2 oracle：同预算 readData(锚) 的正文 + `‡` 页脚（双侧剥离对账）。 */
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

/** 陷阱计数 options（B-10：lifecycle≠ready 期零 options 读取）。 */
function trapCountingOptions(n: number): { readonly options: object; readonly calls: () => number } {
  let calls = 0;
  const options = new Proxy(
    { n },
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

/** 抛错 get trap 的**合法窗口 options**（descriptor 诚实；零 `[[Get]]` 纪律锚）。 */
function throwingGetWindowOptions(): { readonly options: object; readonly getCalls: () => number } {
  let getCalls = 0;
  const options = new Proxy(
    { n: 2 },
    {
      get(target, key, receiver) {
        getCalls += 1;
        void target;
        void key;
        void receiver;
        throw new Error('probe: hostile window options get trap');
      },
    },
  );
  return { options, getCalls: () => getCalls };
}

/** 状态化 descriptor trap（窗口 options `{n:2}`）：第 `throwFromCall` 次（含）起抛错。 */
function statefulWindowDescriptorProxy(throwFromCall: number): {
  readonly options: object;
  readonly descriptorCalls: () => number;
} {
  let descriptorCalls = 0;
  const options = new Proxy(
    { n: 2 },
    {
      getOwnPropertyDescriptor(target, key) {
        descriptorCalls += 1;
        if (descriptorCalls >= throwFromCall) throw new Error('probe: stateful window descriptor trap');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    },
  );
  return { options, descriptorCalls: () => descriptorCalls };
}

/** 交替 descriptor trap（窗口 options `{n:2}`）：仅第 `throwOnCall` 次抛错。 */
function alternatingWindowDescriptorProxy(throwOnCall: number): {
  readonly options: object;
  readonly descriptorCalls: () => number;
} {
  let descriptorCalls = 0;
  const options = new Proxy(
    { n: 2 },
    {
      getOwnPropertyDescriptor(target, key) {
        descriptorCalls += 1;
        if (descriptorCalls === throwOnCall) throw new Error('probe: alternating window descriptor trap');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    },
  );
  return { options, descriptorCalls: () => descriptorCalls };
}

/** 失败面形状（W1 四键失败成员：code/ok/path/message）。 */
function expectWindowFailure(actual: unknown): { code: string; path: readonly (string | number)[]; message: string } {
  const failure = actual as { ok: boolean; code: string; path: readonly (string | number)[]; message: string };
  expect(failure.ok).toBe(false);
  expect(Object.keys(failure as object).sort()).toEqual(['code', 'message', 'ok', 'path']);
  expect(typeof failure.code).toBe('string');
  expect(Array.isArray(failure.path)).toBe(true);
  expect(typeof failure.message === 'string' && failure.message.length > 0).toBe(true);
  return failure;
}

// ═════════════════════════════ 能力存在性（红灯首因） ═════════════════════════════

describe('W2 能力存在性：组合层窗口读公共方法（ADR 0028 决策 1/9）', () => {
  it('runtime.readArray / runtime.readMap 为公共 function（12 键面 → 14 键面）', async () => {
    const { runtime } = await makeWindowRuntime();
    const surface = runtime as unknown as Record<string, unknown>;
    expect(surface.readArray, 'W2 能力缺口：runtime.readArray 应为公共方法（ADR 0028 决策 9）').toBeTypeOf('function');
    expect(surface.readMap, 'W2 能力缺口：runtime.readMap 应为公共方法（ADR 0028 决策 9）').toBeTypeOf('function');
    await runtime.close();
  });
});

// ═════════════════════════════ S1 lifecycle gate（B-10） ═════════════════════════════

describe('S1 lifecycle gate：closing/closed 期同步结果联合拒绝、零 options 读取', () => {
  it('close 后 readArray/readMap → RUNTIME_READ_DISABLED（四键失败形、path 回显、零 options 触达）', async () => {
    const { runtime } = await makeWindowRuntime();
    await runtime.close();
    for (const [name, call] of [
      ['readArray', (options: object) => runtime.readArray(['workRecords'], options as NamespaceRuntimeReadArrayOptions)],
      ['readMap', (options: object) => runtime.readMap(['tasks'], options as NamespaceRuntimeReadMapOptions)],
    ] as const) {
      const probe = trapCountingOptions(2);
      const result = call(probe.options) as RuntimeReadDisabledResult;
      expect(result.ok, `${name} 应被 lifecycle gate 拒绝`).toBe(false);
      expect(result.code).toBe('RUNTIME_READ_DISABLED');
      expect(Object.keys(result as object).sort()).toEqual(['code', 'message', 'ok', 'path']);
      expect(Array.isArray(result.path)).toBe(true);
      expect(typeof result.message === 'string' && result.message.length > 0).toBe(true);
      expect(probe.calls(), `${name} 停接纳期不得读取 options 任何属性`).toBe(0);
    }
  });
});

// ═════════════════════════════ S3 canonical 接缝（§7.3） ═════════════════════════════

describe('S3 canonical 接缝：正常零差异；敌意视图稳定性失败响亮收编', () => {
  it('正常 options：canonical 不改变语义（值通道与直调 W1 逐字段相同、schem 非 null、零 get trap）', async () => {
    const { runtime, doc } = await makeWindowRuntime();
    const options = { n: 2, orderBy: { by: 'index' as const, dir: 'desc' as const }, depth: 1 };
    const result = runtime.readArray(['workRecords'], options);
    const direct = readArrayWindowAtPath(doc, ['workRecords'], options);
    expect(direct.ok).toBe(true);
    if (!result.ok) throw new Error(`契约前提失败：应成功（${JSON.stringify(result)}）`);
    expect(result.value).toStrictEqual(direct.ok ? direct.value : []);
    expect(result.truncated).toBe(true);
    expect(result.schema).not.toBeNull();
    await runtime.close();
  });

  it('抛错 get trap 的合法 options（descriptor 诚实）：正常四键成功、get trap 零调用、零外抛', async () => {
    const { runtime, doc } = await makeWindowRuntime();
    const probe = throwingGetWindowOptions();
    const options: NamespaceRuntimeReadMapOptions = { n: 2 };
    const result = runtime.readMap(['tasks'], probe.options as NamespaceRuntimeReadMapOptions);
    if (!result.ok) throw new Error(`契约前提失败：应成功（${JSON.stringify(result)}）`);
    const direct = readMapWindowAtPath(doc, ['tasks'], options);
    if (!direct.ok) throw new Error('契约前提失败：直调 W1 应成功');
    expect(result.value).toStrictEqual(direct.value);
    expect(probe.getCalls()).toBe(0);
    await runtime.close();
  });

  it('状态化 descriptor trap：canonical 重读失败 + W1 重派发失败 → W1 码原样透传、零外抛', async () => {
    const { runtime } = await makeWindowRuntime();
    const probe = statefulWindowDescriptorProxy(3); // W1 校验 #1/#2 通过；第 3 次起抛错
    const result = runtime.readArray(['workRecords'], probe.options as NamespaceRuntimeReadArrayOptions);
    const failure = expectWindowFailure(result);
    expect(failure.code).toBe('WINDOW_OPTIONS_INVALID');
    expect(failure.path).toStrictEqual(['workRecords']);
    expect(probe.descriptorCalls()).toBe(4); // 净化 #3 抛 → 重派发 #4 抛 → T1 收编
    await runtime.close();
  });

  it('交替 descriptor trap：canonical 失败而重派发又接受 → 接缝终态 WINDOW_OPTIONS_INVALID（视图不稳定）、零外抛', async () => {
    const { runtime } = await makeWindowRuntime();
    const probe = alternatingWindowDescriptorProxy(3); // 仅第 3 次 descriptor 读抛错
    const result = runtime.readArray(['workRecords'], probe.options as NamespaceRuntimeReadArrayOptions);
    const failure = expectWindowFailure(result);
    expect(failure.code).toBe('WINDOW_OPTIONS_INVALID');
    expect(failure.path).toStrictEqual(['workRecords']);
    expect(failure.message).toContain('视图不稳定');
    expect(probe.descriptorCalls()).toBe(5); // 净化 #3 抛 → 重派发 #4/#5 通过 → 出口② 构造成员
    await runtime.close();
  });
});

// ═════════════════════════════ S4 total 计数独立预言机（B-9） ═════════════════════════════

describe('S4 total 计数：与 W1 条目空间逐位一致（独立预言机对账）', () => {
  it('边界矩阵：Y.Array / 空数组 / Y.Map 显式 undefined 值键 / plain object accessor 与非枚举键 / 稀疏 plain 数组 / 空载体 / ROOT 面', async () => {
    const { runtime, doc } = await makeWindowRuntime({ probe: true });
    const root = doc.getMap('ROOT');
    const probe = root.get('probe') as Y.Map<unknown>;

    // —— 独立预言机（native/Yjs 直数，零实现复用）——
    const arrayTotal = (p: readonly (string | number)[]): number => {
      let cur: unknown = root;
      for (const seg of p) cur = (cur as Y.Map<unknown>).get(seg as string);
      return (cur as unknown[]).length;
    };
    const mapTotal = (p: readonly (string | number)[]): number => {
      let cur: unknown = root;
      for (const seg of p) cur = (cur as Y.Map<unknown>).get(seg as string);
      if (cur instanceof Y.Map) {
        return [...cur.keys()].filter((key) => cur.get(key) !== undefined).length;
      }
      const record = cur as Record<string, unknown>;
      return Object.keys(record).filter((key) => {
        const desc = Object.getOwnPropertyDescriptor(record, key);
        return desc !== undefined && desc.enumerable === true && desc.get === undefined && desc.value !== undefined;
      }).length;
    };

    const cases: ReadonlyArray<{
      readonly name: string;
      readonly face: 'array' | 'map';
      readonly path: readonly (string | number)[];
      readonly options: NamespaceRuntimeReadArrayOptions | NamespaceRuntimeReadMapOptions;
      readonly total: number;
      readonly kept: number;
    }> = [
      { name: 'Y.Array 全量', face: 'array', path: ['workRecords'], options: { n: 9 }, total: arrayTotal(['workRecords']), kept: 3 },
      { name: '空 Y.Array', face: 'array', path: ['emptyTags'], options: { n: 9 }, total: arrayTotal(['emptyTags']), kept: 0 },
      { name: 'Y.Map 显式 undefined 键出空间', face: 'map', path: ['probe', 'ym'], options: { n: 9 }, total: mapTotal(['probe', 'ym']), kept: 2 },
      { name: 'plain object undefined 值键出空间', face: 'map', path: ['probe', 'po'], options: { n: 9 }, total: mapTotal(['probe', 'po']), kept: 2 },
      { name: 'plain object accessor/non-enumerable 出空间', face: 'map', path: ['probe', 'hostile'], options: { n: 9 }, total: mapTotal(['probe', 'hostile']), kept: 1 },
      { name: '空 plain object', face: 'map', path: ['probe', 'emptyPlain'], options: { n: 9 }, total: mapTotal(['probe', 'emptyPlain']), kept: 0 },
      { name: '空 Y.Map', face: 'map', path: ['probe', 'emptyMap'], options: { n: 9 }, total: mapTotal(['probe', 'emptyMap']), kept: 0 },
      { name: '稀疏 plain 数组（空洞计入 length）', face: 'array', path: ['probe', 'sparse'], options: { n: 1 }, total: arrayTotal(['probe', 'sparse']), kept: 1 },
      { name: 'ROOT 面（readMap([])）', face: 'map', path: [], options: { n: 2 }, total: mapTotal([]), kept: 2 },
    ];

    expect(mapTotal(['probe', 'ym'])).toBe(2);
    expect(mapTotal(['probe', 'po'])).toBe(2);
    expect(mapTotal(['probe', 'hostile'])).toBe(1);
    expect(arrayTotal(['probe', 'sparse'])).toBe(4);
    expect(probe instanceof Y.Map).toBe(true);

    for (const entry of cases) {
      const result = entry.face === 'array'
        ? runtime.readArray(entry.path, entry.options as NamespaceRuntimeReadArrayOptions)
        : runtime.readMap(entry.path, entry.options as NamespaceRuntimeReadMapOptions);
      if (!result.ok) throw new Error(`契约前提失败：${entry.name} 应成功（${JSON.stringify(result)}）`);
      expect(result.value.length, `${entry.name}: kept`).toBe(entry.kept);
      expect(result.truncated, `${entry.name}: truncated === kept < total`).toBe(entry.kept < entry.total);
      if (result.schema !== null) {
        expect(result.schema.includes(TRUNCATION_HEADER), `${entry.name}: ✂ 与 truncated 一致`).toBe(result.truncated);
      }
      if (entry.kept < entry.total) expect(entry.total, `${entry.name}: 预言机 total 应大于 kept`).toBeGreaterThan(entry.kept);
    }
    await runtime.close();
  });

  it('ROOT 面密钥与 ✂ 事实行：空路径取渲染器约定字面 `[]`（B-8 槽①）', async () => {
    const { runtime } = await makeWindowRuntime({ probe: true });
    const result = runtime.readMap([], { n: 2 });
    if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(result)}`);
    expect(result.truncated).toBe(true);
    expect(result.schema).toContain('- [] · 窗口 · 基 key asc · kept 2/total 9');
    await runtime.close();
  });
});

// ═════════════════════════════ S5 schema 锚链 oracle（AC2 / B-6 / B-7） ═════════════════════════════

describe('S5 schema 锚链：正文 + `‡` 页脚 ≡ 同预算 readData(锚) 双侧剥离对账', () => {
  it('数组面单锚 [...path, 0]：depth 0/1 与 oracle 逐字节一致（含 `Task‡` 元素子树标记）', async () => {
    const { runtime } = await makeWindowRuntime();
    const d1 = runtime.readArray(['taskList'], { n: 2, depth: 1 });
    if (!d1.ok) throw new Error(`契约前提失败：${JSON.stringify(d1)}`);
    expect(bodyBlocks(d1.schema as string)).toBe(oracleBody(runtime, ['taskList', 0], { depth: 1 }));

    const d0 = runtime.readArray(['taskList'], { n: 2, depth: 0 });
    if (!d0.ok) throw new Error(`契约前提失败：${JSON.stringify(d0)}`);
    expect(bodyBlocks(d0.schema as string)).toBe(oracleBody(runtime, ['taskList', 0], { depth: 0 }));
    expect(bodyBlocks(d0.schema as string)).toContain('Task‡');
    await runtime.close();
  });

  it('键面 Record 锚 [...path, \'<key>\']：普通 Record / keyPattern / 空 Record 元素口径与 oracle 逐字节一致', async () => {
    const { runtime } = await makeWindowRuntime();
    for (const [name, path, budget] of [
      ['Record', ['tasks'], { depth: 1 }],
      ['keyPattern', ['assets'], { depth: 1 }],
      ['空 Record', ['emptyAssets'], { depth: 1 }],
    ] as const) {
      const result = runtime.readMap(path as unknown as readonly string[], { n: 5, ...budget });
      if (!result.ok) throw new Error(`契约前提失败：${name}（${JSON.stringify(result)}）`);
      expect(bodyBlocks(result.schema as string), `${name} oracle`).toBe(
        oracleBody(runtime, [...path, '<key>'], budget),
      );
    }
    await runtime.close();
  });

  it('封闭对象形（B-6 回退）：\'<key>\' 锚不可解析 → 容器路径口径；depth 自容器起算（已知限制 R1）', async () => {
    const { runtime } = await makeWindowRuntime();
    const depth1 = runtime.readMap(['meta'], { n: 5, depth: 1 });
    if (!depth1.ok) throw new Error(`契约前提失败：${JSON.stringify(depth1)}`);
    expect(bodyBlocks(depth1.schema as string)).toBe(oracleBody(runtime, ['meta'], { depth: 1 }));
    expect(bodyBlocks(depth1.schema as string)).toContain('extra: number // 附加计数');

    const depth0 = runtime.readMap(['meta'], { n: 5, depth: 0 });
    if (!depth0.ok) throw new Error(`契约前提失败：${JSON.stringify(depth0)}`);
    expect(bodyBlocks(depth0.schema as string)).toBe(oracleBody(runtime, ['meta'], { depth: 0 }));
    expect(bodyBlocks(depth0.schema as string)).toContain('[...]‡');
    await runtime.close();
  });

  it('数据无关性：空容器 vs 满容器同预算 schema 逐字节相等；不同 n 不改变正文', async () => {
    const { runtime } = await makeWindowRuntime();
    const full = runtime.readArray(['taskList'], { n: 5, depth: 1 });
    const empty = runtime.readArray(['emptyTasks'], { n: 5, depth: 1 });
    if (!full.ok || !empty.ok) throw new Error('契约前提失败：空/满容器窗口读应成功');
    expect(empty.schema).toBe(full.schema);
    expect(empty.schema).not.toContain(TRUNCATION_HEADER);

    const smallN = runtime.readArray(['taskList'], { n: 1, depth: 1 });
    const bigN = runtime.readArray(['taskList'], { n: 5, depth: 1 });
    if (!smallN.ok || !bigN.ok) throw new Error('契约前提失败：两种 n 应成功');
    expect(bodyBlocks(smallN.schema as string)).toBe(bodyBlocks(bigN.schema as string));
    await runtime.close();
  });

  it('无 active schema：info 通道照常四键、schema:null（锚失败不构成读失败）', async () => {
    const { handle } = await makeWindowHandle({ seedSchema: false });
    const runtime = createWindowRuntimeFromHandle(handle);
    const result = runtime.readArray(['workRecords'], { n: 2 });
    if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(result)}`);
    expectReadDataOkKeys(result);
    expect(result.schema).toBeNull();
    expect(result.truncated).toBe(true);
    await runtime.close();
  });
});

// ═════════════════════════════ E3/E4 零物化哨兵（决策 8） ═════════════════════════════

describe('E3/E4 零物化哨兵：未入选子项零物化；入选毒项 fail-fast 无半窗', () => {
  it('E3：N=2000 毒值 + n=2 → ok:true、kept 2/total 2000（任何全量物化实现必红）', async () => {
    const { runtime } = await makeWindowRuntime({ poison: true });
    const result = runtime.readArray(['workRecords'], { n: 2 });
    if (!result.ok) throw new Error(`契约前提失败：毒值窗口读应成功（${JSON.stringify(result)}）`);
    expect(result.value).toHaveLength(2);
    expect(result.truncated).toBe(true);
    expect(result.schema).toContain('kept 2/total 2000');
    await runtime.close();
  });

  it('E4：入选毒项（desc + n=3 命中 NaN 项）→ PATH_NOT_ALLOWED、无半窗（value 键不在场）', async () => {
    const { runtime, doc } = await makeWindowRuntime({ poison: true });
    const options = { n: 3, orderBy: { by: 'index' as const, dir: 'desc' as const } };
    const result = runtime.readArray(['workRecords'], options);
    const failure = expectWindowFailure(result);
    expect(failure.code).toBe('PATH_NOT_ALLOWED');
    expect(failure.path).toStrictEqual(['workRecords', 2]);
    expect('value' in (result as object)).toBe(false);
    expect(result).toStrictEqual(readArrayWindowAtPath(doc, ['workRecords'], options));
    await runtime.close();
  });
});

// ═════════════════════════════ 负控：readData / W1 冻结面不被污染 ═════════════════════════════

describe('负控：readData 四键面与 W1 原语在组合面落地后保持原样', () => {
  it('readData 恒四键 + 缺席吸收；W1 缺席响亮（方向相反、互不污染）', async () => {
    const { runtime, doc } = await makeWindowRuntime();
    const read = runtime.readData(['workRecords']);
    if (!read.ok) throw new Error('契约前提失败：readData 应成功');
    expectReadDataOkKeys(read);
    expect(read.schema).toContain('# readData [workRecords]');

    const absent = readMapWindowAtPath(doc, ['nope'], { n: 1 });
    expect(absent.ok).toBe(false);
    if (absent.ok) throw new Error('unreachable');
    expect(absent.code).toBe('WINDOW_TARGET_ABSENT');

    const absorbed = runtime.readData(['nope']);
    expect(absorbed.ok).toBe(true);
    await runtime.close();
  });

  it('装置前提：fixture 身份与 runtime 身份一致（防夹具漂移假红）', async () => {
    const { runtime } = await makeWindowRuntime();
    expect(runtime.namespaceId).toBe(WINDOW_DOC_ID);
    expect(runtime.owner).toStrictEqual({ userId: WINDOW_OWNER.userId });
    await runtime.close();
  });
});
