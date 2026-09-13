/**
 * issue #369（ADR 0028 W2）lease 公共面红灯契约 —— `NamespaceLease.readArray` /
 * `readMap` 全量验收用例（SA6 §12.2 用例组 W2-A/S/T/E/F + §12.6 敏感度防线）。
 *
 * 契约来源：
 * - issue #369 What-to-build + AC1–AC6；
 * - `wiki/raw/task_issue-369_sa6_contract.md` §12.1 绑定表 B-1–B-11（含 §12.3 最小
 *   fixture 与 §12.6 反伪绿防线）；
 * - SA1 设计 §7.1 B-7/B-8（schema 组成 + ✂ 窗口事实四插值槽与单行不变式）、§7.2 B-6
 *   锚链、§7.3 编排、§7.4 计数。
 *
 * 红灯机理（HEAD `ab6e390`）：lease 恰 13 键、无窗口面 —— 能力存在性断言红
 * （`typeof lease.readArray === 'undefined'`）；其余用例因方法缺席不可达；readData
 * 负控（NC1/NC3/NC4）同场保持绿。
 *
 * 断言纪律：成功形状经集中化 helper（`expectReadDataOkKeys` / `expectReadDataOk`）表达
 * （形状断言收敛门 family A/B 扫描域覆盖本目录）；AC2 oracle 由同一次运行的
 * `readData(锚, 同预算)` 公共面产出（非硬编码）；`total` 以独立预言机对账；
 * ✂ 窗口事实段按 B-8 冻结值做 Byte 级断言（测试内单点常量）。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { readArrayWindowAtPath, readMapWindowAtPath } from '@nomicore/doc-runtime';
import type { DocHandle } from '@nomicore/persistence';
import type {
  NamespaceLease,
  NamespaceLeaseReadArrayResult,
  NamespaceLeaseReadMapResult,
} from '@nomicore/namespace-registry';
import type {
  NamespaceRuntime,
  NamespaceRuntimeReadArrayOptions,
  NamespaceRuntimeReadMapOptions,
  NamespaceRuntimeReadArrayResult,
  NamespaceRuntimeReadMapResult,
  RuntimeReadDisabledResult,
} from '@nomicore/namespace-runtime';
import { expectReadDataOk, expectReadDataOkKeys } from '../../namespace-runtime/test/helpers/readdata-ok-shape.js';
import {
  createWindowRuntimeFromHandle,
  makeWindowLease,
  WINDOW_DOC_ID,
  WINDOW_OWNER,
  type WindowLeaseFixture,
} from './issue-369-window-read-fixture.js';

// ───────────────────────── 契约常量：✂ 窗口事实段（B-8 冻结；单点常量） ─────────────────────────

const TRUNCATION_HEADER = '✂ 截断事实：';

/** 数组面 desc（值键总序 [30,20,10]，n=2）——整段 Byte 锚（B-8 四插值槽）。 */
const FACTS_ARRAY_INDEX_DESC = '✂ 截断事实：\n- workRecords · 窗口 · 基 index desc · kept 2/total 3\n';
/** 键面 field:priority desc —— 整段 Byte 锚。 */
const FACTS_MAP_FIELD_DESC = '✂ 截断事实：\n- tasks · 窗口 · 基 field:priority desc · kept 2/total 3\n';

/** 任务元素口径正文（读路径键控，与数据无关）——A2/S/E 组复用期望。 */
const TASK_ELEMENT_BODY =
  'Task\n\ntype Task = {\n  title: string // 任务标题\n  priority: number // 优先级（数值越大越优先）\n}\n';
/** 资源元素口径正文。 */
const ASSET_ELEMENT_BODY = 'Asset\n\ntype Asset = {\n  name: string // 资源名\n}\n';

// ───────────────────────── 双侧剥离对账（AC2 oracle 不漂移） ─────────────────────────

/**
 * 剥掉 ✂ 段（值通道截断 / 窗口事实）并保留正文自身尾换行：✂ 段恒为文末块、
 * 以恰 1 空行分隔（`\n\n✂ 截断事实：`），故按最后一次出现位置整段切除。
 */
function bodyBlocks(text: string): string {
  const index = text.lastIndexOf(`\n\n${TRUNCATION_HEADER}`);
  return index < 0 ? text : text.slice(0, index + 1);
}

/** 剥掉 readData 头行（首行 + 首个空行）。 */
function readDataBody(text: string): string {
  const index = text.indexOf('\n\n');
  if (index < 0) throw new Error(`契约前提失败：投影文本缺头行分隔：${JSON.stringify(text)}`);
  return text.slice(index + 2);
}

/** AC2 oracle：同预算 readData(锚) 的正文 + `‡` 页脚。 */
function oracleBody(
  source: Pick<NamespaceLease, 'readData'>,
  anchor: readonly (string | number)[],
  budget: { readonly depth?: number; readonly maxChildrenPerNode?: number } | undefined,
): string {
  const read = budget === undefined ? source.readData(anchor) : source.readData(anchor, budget);
  if (!read.ok) throw new Error(`契约前提失败：oracle 读应成功（${JSON.stringify(read)}）`);
  if (read.schema === null) throw new Error(`契约前提失败：oracle 投影文本应非 null（锚 ${anchor.join('.')}）`);
  return bodyBlocks(readDataBody(read.schema));
}

/** 失败面形状（W1 四键失败成员）。 */
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

/** 成功分支断言 + ✂ 事实行抽取（窗口事实段恒「头行 + 恰一行事实行」）。 */
function windowFactLines(schema: string | null): string[] {
  if (schema === null) return [];
  return schema.split('\n').filter((line) => line.startsWith('- '));
}

/** 独立预言机：Y.Map / plain object 的条目空间键数（零实现复用）。 */
function mapKeyOracle(target: unknown): number {
  if (target instanceof Y.Map) {
    return [...target.keys()].filter((key) => target.get(key) !== undefined).length;
  }
  const record = target as Record<string, unknown>;
  return Object.keys(record).filter((key) => {
    const desc = Object.getOwnPropertyDescriptor(record, key);
    return desc !== undefined && desc.enumerable === true && desc.get === undefined && desc.value !== undefined;
  }).length;
}

// ───────────────────────── 敌意 path 装置（SA4 F-369-1：单次快照纪律） ─────────────────────────

/**
 * 敌意 path：真数组 Proxy + stateful `get` trap（SA4 F-369-1 可达性构造的确定性版本）。
 *
 * `iterationsAllowed` = 允许的**迭代协议读**（`path[Symbol.iterator]` 访问）次数：W1
 * 材料化逐入选项各 `[...path, id]` 消费一次（doc-runtime 冻结面事实，由 `w1IterationReads`
 * 实测），组合层只允许再消费**恰一次**（S5 `normalizeReadPath` 单快照）。第
 * `iterationsAllowed + 1` 次迭代协议读返回**投毒迭代器**（产出 throwing-`toString` 段）：
 * - 修复前（S6 `windowPathText` 对 raw path 二次 spread）：投毒迭代器被调用 → 投毒段进入
 *   折叠槽 → `String(seg)` 经 `ToPrimitive` 直接外抛（F-369-1 原始症状）；
 * - 修复后（pathText 取 `normalizeReadPath` 快照）：投毒迭代器**永不触达** → 零外抛，
 *   事实行只可能取自单次已验证快照。
 */
function hostilePathProxy(
  iterationsAllowed: number,
  target: readonly (string | number)[] = ['workRecords'],
): {
  readonly path: readonly (string | number)[];
  readonly iterations: () => number;
} {
  const poisonSegment = {
    toString(): string {
      throw new Error('probe: hostile path segment（F-369-1 二次 spread 投毒）');
    },
  };
  let iterations = 0;
  const proxy = new Proxy([...target] as unknown[], {
    get(target, key, receiver) {
      if (key === Symbol.iterator) {
        iterations += 1;
        if (iterations > iterationsAllowed) {
          // 超预算的迭代协议读：投毒迭代器（值 = throwing-toString 段）。
          return function* poisonIterator(): Generator<unknown> {
            yield poisonSegment;
          };
        }
      }
      return Reflect.get(target, key, receiver);
    },
  });
  return { path: proxy as unknown as readonly (string | number)[], iterations: () => iterations };
}

/**
 * 参照系（与被测组合层无关）：直调 W1 冻结面对同一 path 的迭代协议读次数（逐入选项
 * 材料化 `[...path, id]`）。组合层的允许额度 = 本值 + 1（唯一快照）。
 */
function w1IterationReads(
  doc: Y.Doc,
  path: readonly (string | number)[],
  options: { readonly n: number },
): number {
  const measured = hostilePathProxy(Number.MAX_SAFE_INTEGER, path); // 零投毒：仅计数
  const direct = readArrayWindowAtPath(doc, measured.path, options);
  if (!direct.ok) throw new Error(`契约前提失败：直调 W1 应成功（${JSON.stringify(direct)}）`);
  return measured.iterations();
}

/** 单次捕获公共面调用：显式区分「返回了结果」与「裸抛逃逸」（F-369-1 唯一断言面）。 */
function captureArrayRead(
  call: () => NamespaceLeaseReadArrayResult,
): { readonly result: NamespaceLeaseReadArrayResult | undefined; readonly escaped: unknown } {
  try {
    return { result: call(), escaped: undefined };
  } catch (error) {
    return { result: undefined, escaped: error };
  }
}

/** 每用例独立装配（release 用例会释放自己的 lease——不得共享实例）。 */
async function leaseFixture(): Promise<WindowLeaseFixture> {
  return makeWindowLease();
}

// ═════════════════════════════ 能力存在性（红灯首因） ═════════════════════════════

describe('W2 能力存在性：lease 窗口读公共方法（ADR 0028 决策 1）', () => {
  it('lease.readArray / lease.readMap 为公共 function（13 键面 → 15 键面）', async () => {
    const { lease } = await leaseFixture();
    const surface = lease as unknown as Record<string, unknown>;
    expect(surface.readArray, 'W2 能力缺口：lease.readArray 应为公共方法（ADR 0028 决策 1）').toBeTypeOf('function');
    expect(surface.readMap, 'W2 能力缺口：lease.readMap 应为公共方法（ADR 0028 决策 1）').toBeTypeOf('function');
  });
});

// ═════════════════════════════ 组 A：恒四键 / 条目列表 / 空容器 / 基矩阵 ═════════════════════════════

describe('组 A（AC1）：恒四键 own 键集、条目列表身份随行、空容器元素口径、基×方向矩阵', () => {
  it('A1 数组面：恰四键、条目 own 键恰 [index,value]、desc 窗口条目列表 + Byte 级 schema', async () => {
    const { lease } = await leaseFixture();
    const result = lease.readArray(['workRecords'], { n: 2, orderBy: { by: 'index', dir: 'desc' }, depth: 1 });
    expectReadDataOkKeys(result);
    if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(result)}`);
    expect(Object.keys(result.value[0] as object).sort()).toEqual(['index', 'value']);
    expectReadDataOk(result, {
      value: [
        { index: 0, value: 30 },
        { index: 2, value: 20 },
      ],
      schema: `number\n\n${FACTS_ARRAY_INDEX_DESC}`,
      truncated: true,
    });
  });

  it('A2 键面：恰四键、条目 own 键恰 [key,value]、field 基 desc 条目列表 + oracle 正文 + Byte 级事实行', async () => {
    const { lease } = await leaseFixture();
    const budget = { depth: 1 } as const;
    const result = lease.readMap(['tasks'], { n: 2, orderBy: { field: 'priority', dir: 'desc' }, ...budget });
    expectReadDataOkKeys(result);
    if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(result)}`);
    expect(Object.keys(result.value[0] as object).sort()).toEqual(['key', 'value']);
    expect(result.value).toStrictEqual([
      { key: 't2', value: { title: 'beta', priority: 9 } },
      { key: 't3', value: { title: 'gamma', priority: 5 } },
    ]);
    // B-7/B-8 拼装规则：正文（渲染器恒以恰一个 `\n` 收尾）+ 恰 1 空行 + ✂ 窗口事实块 + 结尾 `\n`。
    const elementBody = oracleBody(lease, ['tasks', '<key>'], budget).replace(/\n$/u, '');
    expect(result.schema).toBe(`${elementBody}\n\n${FACTS_MAP_FIELD_DESC}`);
    expect(result.truncated).toBe(true);
  });

  it('A3 空容器四类：value:[] + 元素口径 schema + 无 ✂ + truncated:false', async () => {
    const { lease } = await leaseFixture();
    const emptyScalarArray = lease.readArray(['emptyTags'], { n: 2, depth: 1 });
    expectReadDataOk(emptyScalarArray, { value: [], schema: 'string\n', truncated: false });

    const emptyObjectArray = lease.readArray(['emptyTasks'], { n: 2, depth: 1 });
    expectReadDataOk(emptyObjectArray, { value: [], schema: TASK_ELEMENT_BODY, truncated: false });

    const emptyRecord = lease.readMap(['emptyAssets'], { n: 2, depth: 1 });
    expectReadDataOk(emptyRecord, { value: [], schema: ASSET_ELEMENT_BODY, truncated: false });

    const emptyYMap = lease.readMap(['probe', 'emptyMap'], { n: 2 });
    expectReadDataOk(emptyYMap, { value: [], schema: null, truncated: false });

    for (const result of [emptyScalarArray, emptyObjectArray, emptyRecord]) {
      if (!result.ok) throw new Error(`契约前提失败：空容器窗口读应成功（${JSON.stringify(result)}）`);
      expect(result.schema).not.toContain(TRUNCATION_HEADER);
    }
    // raw 路径（`probe.emptyMap` 偏离 schema）：锚不可解析 → schema:null（无 ✂ 载体可言）。
    if (!emptyYMap.ok) throw new Error('契约前提失败：空 Y.Map 窗口读应成功');
    expect(emptyYMap.schema).toBeNull();
  });

  it('A4 基×方向矩阵：index asc/desc、key asc/desc、field asc/desc 的序列与事实行 token 一致', async () => {
    const { lease } = await leaseFixture();
    const cases: ReadonlyArray<{
      readonly name: string;
      readonly call: () => NamespaceLeaseReadArrayResult | NamespaceLeaseReadMapResult;
      readonly keys: readonly unknown[];
      readonly basisToken: string;
    }> = [
      {
        name: 'array index asc',
        call: () => lease.readArray(['workRecords'], { n: 2 }),
        keys: [{ index: 1, value: 10 }, { index: 2, value: 20 }],
        basisToken: '基 index asc',
      },
      {
        name: 'array index desc',
        call: () => lease.readArray(['workRecords'], { n: 2, orderBy: { by: 'index', dir: 'desc' } }),
        keys: [{ index: 0, value: 30 }, { index: 2, value: 20 }],
        basisToken: '基 index desc',
      },
      {
        name: 'map key asc',
        call: () => lease.readMap(['tasks'], { n: 2, orderBy: { by: 'key' } }),
        keys: [{ key: 't1', value: { title: 'alpha', priority: 2 } }, { key: 't2', value: { title: 'beta', priority: 9 } }],
        basisToken: '基 key asc',
      },
      {
        name: 'map field asc',
        call: () => lease.readMap(['tasks'], { n: 2, orderBy: { field: 'priority' } }),
        keys: [{ key: 't1', value: { title: 'alpha', priority: 2 } }, { key: 't3', value: { title: 'gamma', priority: 5 } }],
        basisToken: '基 field:priority asc',
      },
      {
        name: 'map field desc',
        call: () => lease.readMap(['tasks'], { n: 2, orderBy: { field: 'priority', dir: 'desc' } }),
        keys: [{ key: 't2', value: { title: 'beta', priority: 9 } }, { key: 't3', value: { title: 'gamma', priority: 5 } }],
        basisToken: '基 field:priority desc',
      },
    ];
    for (const entry of cases) {
      const result = entry.call();
      if (!result.ok) throw new Error(`契约前提失败：${entry.name}（${JSON.stringify(result)}）`);
      expect(result.value, `${entry.name}: 有序基之序`).toStrictEqual(entry.keys);
      expect(result.schema, `${entry.name}: ✂ 事实行含基与方向`).toContain(entry.basisToken);
      expect(windowFactLines(result.schema), `${entry.name}: 块恒头行 + 恰一行事实行`).toHaveLength(1);
    }
  });

  it('A5 身份回环：条目身份拼 [...path, 身份] 深读 ≡ 同预算 readData(项路径).value', async () => {
    const { lease } = await leaseFixture();
    const array = lease.readArray(['workRecords'], { n: 2, orderBy: { by: 'index', dir: 'desc' }, depth: 1 });
    if (!array.ok) throw new Error('契约前提失败：数组窗口读应成功');
    for (const entry of array.value) {
      const again = lease.readData(['workRecords', entry.index], { depth: 1 });
      if (!again.ok) throw new Error('契约前提失败：项路径深读应成功');
      expect(again.value).toStrictEqual(entry.value);
    }

    const map = lease.readMap(['tasks'], { n: 2, orderBy: { field: 'priority', dir: 'desc' }, depth: 1 });
    if (!map.ok) throw new Error('契约前提失败：键面窗口读应成功');
    for (const entry of map.value) {
      const again = lease.readData(['tasks', entry.key], { depth: 1 });
      if (!again.ok) throw new Error('契约前提失败：项路径深读应成功');
      expect(again.value).toStrictEqual(entry.value);
    }
  });

  it('A6 包装不进口径：schema ≡ 元素口径正文（不含 index/key 包装键）', async () => {
    const { lease } = await leaseFixture();
    const result = lease.readArray(['workRecords'], { n: 3, depth: 1 });
    if (!result.ok) throw new Error('契约前提失败：窗口读应成功');
    expect(result.schema).toBe(`${oracleBody(lease, ['workRecords', 0], { depth: 1 })}`);
    expect(result.schema).not.toContain('index:');
    expect(result.schema).not.toContain('key:');
  });
});

// ═════════════════════════════ 组 S：元素口径 oracle（AC2 / B-6 / B-7） ═════════════════════════════

describe('组 S（AC2）：schema 文本 ≡ 投影文本渲染器对元素口径的输出（双侧剥离逐字节）', () => {
  it('S1 数组元素 oracle：标量 / 对象（depth 0/1/2）与 readData(锚, 同预算) 正文逐字节相等', async () => {
    const { lease } = await leaseFixture();
    for (const budget of [{ depth: 0 }, { depth: 1 }, { depth: 2 }] as const) {
      const scalar = lease.readArray(['workRecords'], { n: 3, ...budget });
      if (!scalar.ok) throw new Error('契约前提失败：数组窗口读应成功');
      expect(bodyBlocks(scalar.schema as string), `workRecords depth:${budget.depth}`).toBe(
        oracleBody(lease, ['workRecords', 0], budget),
      );

      const objectArray = lease.readArray(['taskList'], { n: 3, ...budget });
      if (!objectArray.ok) throw new Error('契约前提失败：任务数组窗口读应成功');
      expect(bodyBlocks(objectArray.schema as string), `taskList depth:${budget.depth}`).toBe(
        oracleBody(lease, ['taskList', 0], budget),
      );
    }
  });

  it('S2 Record 元素 oracle：普通 Record / keyPattern / 空 Record 逐字节相等；S5 docs 在场', async () => {
    const { lease } = await leaseFixture();
    for (const [name, path] of [['tasks', ['tasks']], ['assets', ['assets']], ['emptyAssets', ['emptyAssets']]] as const) {
      const result = lease.readMap(path, { n: 5, depth: 1 });
      if (!result.ok) throw new Error(`契约前提失败：${name} 窗口读应成功`);
      const anchor: readonly (string | number)[] = [name, '<key>'];
      expect(bodyBlocks(result.schema as string), `${name} oracle`).toBe(oracleBody(lease, anchor, { depth: 1 }));
    }
    const tasks = lease.readMap(['tasks'], { n: 5, depth: 1 });
    if (!tasks.ok) throw new Error('契约前提失败');
    expect(tasks.schema).toContain('type Task = {');
    expect(tasks.schema).toContain('// 任务标题');
    expect(tasks.schema).toContain('// 优先级（数值越大越优先）');
  });

  it('S3 数据无关性：空 vs 满容器 schema 逐字节相等；不同 n 不改变正文；两次调用幂等', async () => {
    const { lease } = await leaseFixture();
    const full = lease.readArray(['taskList'], { n: 2, depth: 1 });
    const empty = lease.readArray(['emptyTasks'], { n: 2, depth: 1 });
    if (!full.ok || !empty.ok) throw new Error('契约前提失败：空/满容器窗口读应成功');
    expect(bodyBlocks(empty.schema as string)).toBe(bodyBlocks(full.schema as string));

    const assetsFull = lease.readMap(['assets'], { n: 5, depth: 1 });
    const assetsEmpty = lease.readMap(['emptyAssets'], { n: 5, depth: 1 });
    if (!assetsFull.ok || !assetsEmpty.ok) throw new Error('契约前提失败：Record 空/满窗口读应成功');
    expect(assetsEmpty.schema).toBe(assetsFull.schema);

    const first = lease.readArray(['workRecords'], { n: 2, orderBy: { by: 'index', dir: 'desc' } });
    const second = lease.readArray(['workRecords'], { n: 2, orderBy: { by: 'index', dir: 'desc' } });
    expect(second).toStrictEqual(first);
  });

  it('S4 封闭对象形（B-6 回退）：\'<key>\' 锚不可解析 → 容器路径口径（depth 自容器起算）', async () => {
    const { lease } = await leaseFixture();
    const depth1 = lease.readMap(['meta'], { n: 1, depth: 1 });
    if (!depth1.ok) throw new Error('契约前提失败：封闭对象窗口读应成功');
    expect(bodyBlocks(depth1.schema as string)).toBe(oracleBody(lease, ['meta'], { depth: 1 }));
    expect(depth1.schema).toContain('content: string // 备注内容');
    expect(depth1.schema).toContain('extra: number // 附加计数');

    const depth0 = lease.readMap(['meta'], { n: 1, depth: 0 });
    if (!depth0.ok) throw new Error('契约前提失败：封闭对象 depth:0 窗口读应成功');
    expect(bodyBlocks(depth0.schema as string)).toBe(oracleBody(lease, ['meta'], { depth: 0 }));
    expect(bodyBlocks(depth0.schema as string)).toContain('[...]‡');
  });
});

// ═════════════════════════════ 组 T：✂ 窗口事实 + truncated + 边界 ═════════════════════════════

describe('组 T（AC3）：✂ 段呈现 kept/total + 基与方向；truncated 与之一致', () => {
  it('T1 kept<total：数组 / 键面 / 字段基三类事实行与 truncated 一致', async () => {
    const { lease, doc } = await leaseFixture();
    const cases = [
      {
        name: 'array index',
        result: lease.readArray(['workRecords'], { n: 2, orderBy: { by: 'index', dir: 'desc' } }),
        total: (doc.getMap('ROOT').get('workRecords') as Y.Array<number>).length,
        token: '基 index desc',
      },
      {
        name: 'map field',
        result: lease.readMap(['tasks'], { n: 2, orderBy: { field: 'priority', dir: 'desc' } }),
        total: mapKeyOracle(doc.getMap('ROOT').get('tasks')),
        token: '基 field:priority desc',
      },
      {
        name: 'map key',
        result: lease.readMap(['tasks'], { n: 1, orderBy: { by: 'key', dir: 'desc' } }),
        total: mapKeyOracle(doc.getMap('ROOT').get('tasks')),
        token: '基 key desc',
      },
    ] as const;
    for (const entry of cases) {
      const result = entry.result;
      if (!result.ok) throw new Error(`契约前提失败：${entry.name}（${JSON.stringify(result)}）`);
      expect(result.truncated, `${entry.name}: truncated === kept < 预言机 total`).toBe(result.value.length < entry.total);
      expect(result.truncated).toBe(true);
      expect(result.schema).toContain('窗口');
      expect(result.schema).toContain(entry.token);
      expect(result.schema).toContain(`kept ${result.value.length}/total ${entry.total}`);
      expect(windowFactLines(result.schema)).toHaveLength(1);
    }
  });

  it('T2 kept===total：无 ✂ 段、truncated:false（n 覆盖全量）', async () => {
    const { lease } = await leaseFixture();
    const array = lease.readArray(['workRecords'], { n: 9 });
    expectReadDataOkKeys(array);
    if (!array.ok) throw new Error('契约前提失败');
    expect(array.value).toHaveLength(3);
    expect(array.truncated).toBe(false);
    expect(array.schema).not.toContain(TRUNCATION_HEADER);

    const map = lease.readMap(['tasks'], { n: 3, orderBy: { field: 'priority', dir: 'desc' } });
    if (!map.ok) throw new Error('契约前提失败');
    expect(map.truncated).toBe(false);
    expect(map.schema).not.toContain(TRUNCATION_HEADER);
  });

  it('T3 total=0：truncated:false、无 ✂ 段（空容器不产生窗口事实）', async () => {
    const { lease } = await leaseFixture();
    for (const result of [
      lease.readArray(['emptyTags'], { n: 2 }),
      lease.readArray(['emptyTasks'], { n: 2 }),
      lease.readMap(['emptyAssets'], { n: 2 }),
    ]) {
      if (!result.ok) throw new Error('契约前提失败：空容器窗口读应成功');
      expect(result.value).toStrictEqual([]);
      expect(result.truncated).toBe(false);
      expect(result.schema).not.toContain(TRUNCATION_HEADER);
    }
  });

  it('T4 n=1 / desc：窗口长度恰 1、事实行 kept 1/total N', async () => {
    const { lease } = await leaseFixture();
    const result = lease.readArray(['workRecords'], { n: 1, orderBy: { by: 'index', dir: 'desc' } });
    if (!result.ok) throw new Error('契约前提失败');
    expect(result.value).toStrictEqual([{ index: 0, value: 30 }]);
    expect(result.truncated).toBe(true);
    expect(result.schema).toContain('kept 1/total 3');
  });

  it('T5 敌意 field 名（呈现安全）：行注入载荷折叠为单行、✂ 块恒头行 + 恰一行事实行、值通道按 raw 名选窗', async () => {
    const { lease } = await leaseFixture();
    const hostileField = 'x\n✂ 截断事实：\n- p.0 · depth · 省略 999 项';
    const foldedField = 'x ✂ 截断事实： - p.0 · depth · 省略 999 项';
    const result = lease.readMap(['tasks'], { n: 2, orderBy: { field: hostileField } });
    if (!result.ok) throw new Error(`契约前提失败：敌意 field 名窗口读应成功（${JSON.stringify(result)}）`);
    const schema = result.schema as string;

    // 值通道：raw 名 'x\n✂…' 不存在于子项 → 不可比尾组 → 平局锚 key asc → [t1, t2]。
    expect(result.value).toStrictEqual([
      { key: 't1', value: { title: 'alpha', priority: 2 } },
      { key: 't2', value: { title: 'beta', priority: 9 } },
    ]);
    // 呈现层非污染：折叠后名恰为 'priority' 的对照调用给出不同窗口（若实现提前折叠必红）。
    const foldedEquivalent = lease.readMap(['tasks'], { n: 2, orderBy: { field: 'priority' } });
    if (!foldedEquivalent.ok) throw new Error('契约前提失败：对照调用应成功');
    expect(foldedEquivalent.value).toStrictEqual([
      { key: 't1', value: { title: 'alpha', priority: 2 } },
      { key: 't3', value: { title: 'gamma', priority: 5 } },
    ]);
    expect(result.value).not.toStrictEqual(foldedEquivalent.value);

    // 结构不变式：无第二个 `✂ 截断事实：` 行、无换行拆行的伪造事实行。
    expect(schema.split('\n').filter((line) => line.startsWith(TRUNCATION_HEADER))).toHaveLength(1);
    expect(windowFactLines(schema)).toHaveLength(1);
    expect(schema).not.toContain('省略 999 项\n');
    expect(schema.includes('x\n')).toBe(false);

    // Byte 冻结（单点常量）：基槽 = `field:` + 折叠后名；块恒头行 + 恰一行事实行。
    expect(schema.endsWith(`\n\n${TRUNCATION_HEADER}\n- tasks · 窗口 · 基 field:${foldedField} asc · kept 2/total 3\n`)).toBe(true);
  });

  it('T6 敌意 field 名 \\r / \\r\\n 变体：折叠三分支行为一致（基槽呈折后名）', async () => {
    const { lease } = await leaseFixture();
    for (const rawField of ['priority\r', 'priority\r\n']) {
      const result = lease.readMap(['tasks'], { n: 2, orderBy: { field: rawField } });
      if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(rawField)}（${JSON.stringify(result)}）`);
      expect(result.value).toStrictEqual([
        { key: 't1', value: { title: 'alpha', priority: 2 } },
        { key: 't2', value: { title: 'beta', priority: 9 } },
      ]);
      expect(result.schema).toContain('- tasks · 窗口 · 基 field:priority asc · kept 2/total 3');
      expect(result.schema?.split('\n').filter((line) => line.startsWith('- '))).toHaveLength(1);
    }
  });

  it('T7 边界：显式 undefined 值键出条目空间（Y.Map 与 plain object）、accessor/non-enumerable 出空间、稀疏 plain 数组、readMap([])', async () => {
    const { lease } = await leaseFixture();

    const yMap = lease.readMap(['probe', 'ym'], { n: 9 });
    if (!yMap.ok) throw new Error('契约前提失败：Y.Map 边界窗口读应成功');
    expect(yMap.value).toStrictEqual([
      { key: 'k1', value: 1 },
      { key: 'k3', value: 'x' },
    ]);
    expect(yMap.truncated).toBe(false); // 显式 undefined 值键出条目空间 → kept === total

    const plainObject = lease.readMap(['probe', 'po'], { n: 9 });
    if (!plainObject.ok) throw new Error('契约前提失败：plain object 边界窗口读应成功');
    expect(plainObject.value).toStrictEqual([
      { key: 'a', value: 1 },
      { key: 'c', value: 3 },
    ]);
    expect(plainObject.truncated).toBe(false);

    const hostileShape = lease.readMap(['probe', 'hostile'], { n: 9 });
    if (!hostileShape.ok) throw new Error('契约前提失败：accessor 边界窗口读应成功');
    expect(hostileShape.value).toStrictEqual([{ key: 'plain', value: 1 }]);
    expect(hostileShape.truncated).toBe(false);

    const sparse = lease.readArray(['probe', 'sparse'], { n: 1 });
    if (!sparse.ok) throw new Error('契约前提失败：稀疏数组窗口读应成功');
    expect(sparse.value).toStrictEqual([{ index: 3, value: 'y' }]);
    expect(sparse.truncated).toBe(true); // 空洞计入候选空间（length 口径 = 4）
    // raw 路径偏离 schema → 锚不可解析：schema:null × truncated:true（ADR-0027 已知限制 2
    // 的窗口对偶——窗口事实仅经 schema 文本承载）。
    expect(sparse.schema).toBeNull();

    const rootFace = lease.readMap([], { n: 2, orderBy: { by: 'key' } });
    if (!rootFace.ok) throw new Error('契约前提失败：ROOT 面窗口读应成功');
    expect(rootFace.value).toStrictEqual([
      { key: 'assets', value: { a1: { name: 'one' }, b2: { name: 'two' } } },
      { key: 'emptyAssets', value: {} },
    ]);
    expect(rootFace.truncated).toBe(true);
    expect(rootFace.schema).toContain('- [] · 窗口 · 基 key asc · kept 2/total 9');
  });

  it('T8 敌意 path（F-369-1 主型）：S6 二次迭代协议读被投毒 → 零外抛、事实行取自单次快照（= 读取路径）、值通道不受影响', async () => {
    const { lease, doc } = await leaseFixture();
    const budget = { n: 2 } as const;
    // 参照系 = W1 冻结面自身对 raw path 的迭代协议读次数（材料化逐项 spread）。
    const w1Reads = w1IterationReads(doc, ['workRecords'], budget);
    expect(w1Reads, '约束前提：W1 材料化至少消费一次 raw path 迭代协议').toBeGreaterThan(0);

    // 允许额度 = W1 自身 + 组合层唯一快照；第 (W1+2) 次迭代协议读 = F-369-1 的二次 spread。
    const probe = hostilePathProxy(w1Reads + 1);
    const { result, escaped } = captureArrayRead(() => lease.readArray(probe.path, budget));
    expect(escaped, `敌意 path 不得使 lease 公共面裸抛（F-369-1）：${String(escaped)}`).toBeUndefined();
    if (result === undefined) throw new Error('unreachable：上方断言已拦截外抛');

    // 冻结结果联合不回归：成功恒四键、truncated 机器信号诚实。
    expectReadDataOkKeys(result);
    if (!result.ok) throw new Error(`契约前提失败：可解析读取路径应成功（${JSON.stringify(result)}）`);
    expect(result.value).toHaveLength(2);
    expect(result.truncated).toBe(true);

    // 值通道按实读路径（投毒段未进入值通道）。
    const direct = readArrayWindowAtPath(doc, ['workRecords'], budget);
    if (!direct.ok) throw new Error('契约前提失败：直调 W1 应成功');
    expect(result.value).toStrictEqual(direct.value);

    // 事实行取自读取路径快照：既非投毒段内容、也无二次 spread 漂移视图。
    expect(
      result.schema?.endsWith(`\n\n${TRUNCATION_HEADER}\n- workRecords · 窗口 · 基 index asc · kept 2/total 3\n`),
      `事实行必须描述实际读取路径（F-369-1）：${JSON.stringify(result.schema)}`,
    ).toBe(true);
    expect(windowFactLines(result.schema)).toHaveLength(1);

    // 单快照纪律：组合层对 raw path 的迭代协议读恰为 W1 自身次数 + 1（S5 normalizeReadPath）。
    expect(
      probe.iterations(),
      '组合层不得对 raw path 做第二次迭代协议读（S6 必须消费已验证快照）',
    ).toBe(w1Reads + 1);
  });

  it('T9 敌意 path（诚实 null 型）：快照迭代协议读不可验证 → 零外抛、schema:null、值通道与 truncated 保持', async () => {
    const { lease, doc } = await leaseFixture();
    const budget = { n: 2 } as const;
    const w1Reads = w1IterationReads(doc, ['workRecords'], budget);

    // 允许额度 = W1 自身：第 (W1+1) 次迭代协议读即组合层快照 → 迭代器非标准 → 快照收敛 null。
    const probe = hostilePathProxy(w1Reads);
    const { result, escaped } = captureArrayRead(() => lease.readArray(probe.path, budget));
    expect(escaped, `敌意 path 不得使 lease 公共面裸抛（F-369-1）：${String(escaped)}`).toBeUndefined();
    if (result === undefined) throw new Error('unreachable：上方断言已拦截外抛');

    expectReadDataOkKeys(result);
    if (!result.ok) throw new Error(`契约前提失败：路径快照不可验证不构成读失败（${JSON.stringify(result)}）`);
    const direct = readArrayWindowAtPath(doc, ['workRecords'], budget);
    if (!direct.ok) throw new Error('契约前提失败：直调 W1 应成功');
    expect(result.value).toStrictEqual(direct.value);
    expect(result.truncated).toBe(true);
    // 诚实 null（ADR-0027 null 单义）：绝不用不可验证的 raw path 造事实行。
    expect(result.schema).toBeNull();
    expect(probe.iterations()).toBe(w1Reads + 1);
  });
});

// ═════════════════════════════ 组 E：组合式 depth 等价锚 + 零物化 ═════════════════════════════

describe('组 E（AC4）：入选项物化 ≡ 同预算 readData(项路径) 逐字节；零物化哨兵', () => {
  it('E1 depth 0/1/2 数组 + 键面：每条目 toStrictEqual 同预算 readData(项路径).value', async () => {
    const { lease } = await leaseFixture();
    for (const budget of [{ depth: 0 }, { depth: 1 }, { depth: 2 }] as const) {
      const array = lease.readArray(['taskList'], { n: 2, ...budget });
      if (!array.ok) throw new Error('契约前提失败：数组窗口读应成功');
      for (const entry of array.value) {
        const again = lease.readData(['taskList', entry.index], budget);
        if (!again.ok) throw new Error('契约前提失败：项路径深读应成功');
        expect(entry.value).toStrictEqual(again.value);
      }
      const map = lease.readMap(['tasks'], { n: 3, orderBy: { by: 'key' }, ...budget });
      if (!map.ok) throw new Error('契约前提失败：键面窗口读应成功');
      for (const entry of map.value) {
        const again = lease.readData(['tasks', entry.key], budget);
        if (!again.ok) throw new Error('契约前提失败：项路径深读应成功');
        expect(entry.value).toStrictEqual(again.value);
      }
    }
  });

  it('E2 maxChildrenPerNode 只治项内部：入选项内部宽度受预算、终点宽度由 n 治理', async () => {
    const { lease } = await leaseFixture();
    const budget = { depth: 1, maxChildrenPerNode: 1 } as const;
    const result = lease.readArray(['taskList'], { n: 2, ...budget });
    if (!result.ok) throw new Error('契约前提失败：窗口读应成功');
    expect(result.value).toHaveLength(2);
    for (const entry of result.value) {
      const again = lease.readData(['taskList', entry.index], budget);
      if (!again.ok) throw new Error('契约前提失败：项路径深读应成功');
      expect(entry.value).toStrictEqual(again.value);
    }
    expect(result.value[0]?.value).toStrictEqual({ title: 'alpha' });
  });

  it('E3 N=2000 毒值 + n=2：ok:true、kept 2/total 2000（全量物化实现必红）', async () => {
    const { lease } = await makeWindowLease({ poison: true });
    const result = lease.readArray(['workRecords'], { n: 2 });
    if (!result.ok) throw new Error(`契约前提失败：毒值窗口读应成功（${JSON.stringify(result)}）`);
    expect(result.value).toHaveLength(2);
    expect(result.truncated).toBe(true);
    expect(result.schema).toContain('kept 2/total 2000');
  });

  it('E4 入选毒项：PATH_NOT_ALLOWED fail-fast、无半窗（与直调 W1 逐字段相同）', async () => {
    const { lease, doc } = await makeWindowLease({ poison: true });
    const options = { n: 3, orderBy: { by: 'index' as const, dir: 'desc' as const } };
    const result = lease.readArray(['workRecords'], options);
    const failure = expectWindowFailure(result);
    expect(failure.code).toBe('PATH_NOT_ALLOWED');
    expect(failure.path).toStrictEqual(['workRecords', 2]);
    expect('value' in (result as object)).toBe(false);
    expect(result).toStrictEqual(readArrayWindowAtPath(doc, ['workRecords'], options));
  });
});

// ═════════════════════════════ 组 F：失败面透传 / released / 引用同一性 ═════════════════════════════

describe('组 F（AC5）：三失败码经 lease 透传形状语义不变；released 与 raw 引用通道', () => {
  it('F1 三码逐字：WINDOW_TARGET_ABSENT / WINDOW_CARRIER_MISMATCH / WINDOW_OPTIONS_INVALID 与直调 W1 toStrictEqual', async () => {
    const { lease, doc } = await leaseFixture();
    const cases: ReadonlyArray<{
      readonly name: string;
      readonly viaLease: () => NamespaceLeaseReadArrayResult | NamespaceLeaseReadMapResult;
      readonly direct: () => unknown;
    }> = [
      {
        name: 'WINDOW_TARGET_ABSENT',
        viaLease: () => lease.readArray(['nope'], { n: 1 }),
        direct: () => readArrayWindowAtPath(doc, ['nope'], { n: 1 }),
      },
      {
        name: 'WINDOW_CARRIER_MISMATCH',
        viaLease: () => lease.readArray(['tasks'], { n: 1 }),
        direct: () => readArrayWindowAtPath(doc, ['tasks'], { n: 1 }),
      },
      {
        name: 'WINDOW_OPTIONS_INVALID',
        viaLease: () => lease.readMap(['tasks'], { n: 0 } as unknown as NamespaceRuntimeReadMapOptions),
        direct: () => readMapWindowAtPath(doc, ['tasks'], { n: 0 }),
      },
    ];
    for (const entry of cases) {
      const failure = expectWindowFailure(entry.viaLease());
      expect(failure.code, entry.name).toBe(entry.name);
      expect(entry.viaLease()).toStrictEqual(entry.direct());
    }
  });

  it('F2 PATH_NOT_ALLOWED 透传：入选项物化失败原样（fail-fast 无半窗）', async () => {
    const { lease, doc } = await makeWindowLease({ poison: true });
    const options = { n: 3, orderBy: { by: 'index' as const, dir: 'desc' as const } };
    expect(lease.readArray(['workRecords'], options)).toStrictEqual(
      readArrayWindowAtPath(doc, ['workRecords'], options),
    );
  });

  it('F3 released：两方法同步返回冻结 NAMESPACE_LEASE_RELEASED issue（先于一切透传）', async () => {
    const { lease } = await makeWindowLease();
    await lease.release();
    for (const result of [
      lease.readArray(['workRecords'], { n: 1 }),
      lease.readMap(['tasks'], { n: 1 }),
    ]) {
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(Object.keys(result as object).sort()).toEqual(['code', 'message', 'ok']);
      expect(result.code).toBe('NAMESPACE_LEASE_RELEASED');
      expect(typeof result.message === 'string' && result.message.length > 0).toBe(true);
    }
    // released 后 readData 通道形状不变（NC3）。
    const read = lease.readData(['workRecords']);
    expect(read.ok).toBe(false);
    if (read.ok) throw new Error('unreachable');
    expect(read.code).toBe('NAMESPACE_LEASE_RELEASED');
  });

  it('F4 lifecycle≠ready：runtime 停接纳结果经 lease 原样透传（同一对象、零改写）', async () => {
    const disabled: RuntimeReadDisabledResult = {
      ok: false,
      code: 'RUNTIME_READ_DISABLED',
      path: [],
      message: 'RUNTIME_READ_DISABLED: Runtime lifecycle 为 closed——close 已停止接纳公共读取；本调用不触碰 live Y.Doc',
    };
    const { lease } = await makeWindowLease({ runtimeFactory: () => makeStubRuntime({ disabled }) });
    expect(lease.readArray(['workRecords'], { n: 1 })).toBe(disabled);
    expect(lease.readMap(['tasks'], { n: 1 })).toBe(disabled);
  });

  it('F5 raw 引用透传：active 期 path / options 引用原样直传 runtime（零复制、零 lease 层解释）', async () => {
    const calls: Array<{ readonly method: string; readonly path: unknown; readonly options: unknown; readonly argc: number }> = [];
    const arraySuccess: NamespaceRuntimeReadArrayResult = { ok: true, value: [], schema: null, truncated: false };
    const mapSuccess: NamespaceRuntimeReadMapResult = { ok: true, value: [], schema: null, truncated: false };
    const { lease } = await makeWindowLease({
      runtimeFactory: () =>
        makeStubRuntime({
          readArray: (...args: unknown[]) => {
            calls.push({ method: 'readArray', path: args[0], options: args[1], argc: args.length });
            return arraySuccess;
          },
          readMap: (...args: unknown[]) => {
            calls.push({ method: 'readMap', path: args[0], options: args[1], argc: args.length });
            return mapSuccess;
          },
        }),
    });
    const path = ['workRecords'];
    const options = { n: 2, depth: 1 };
    expect(lease.readArray(path, options)).toBe(arraySuccess);
    expect(lease.readMap(path, options as NamespaceRuntimeReadMapOptions)).toBe(mapSuccess);
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.argc).toBe(2);
      expect(call.path).toBe(path); // 引用同一性（无复制）
      expect(call.options).toBe(options); // 原样透传锚
    }
  });

  it('F6 lease ≡ runtime 逐字段：真实 runtime 装配下两方法结果 toStrictEqual', async () => {
    let realRuntime: NamespaceRuntime | undefined;
    const { lease } = await makeWindowLease({
      runtimeFactory: (handle: DocHandle) => {
        realRuntime = createWindowRuntimeFromHandle(handle);
        return realRuntime;
      },
    });
    if (realRuntime === undefined) throw new Error('契约前提失败：runtimeFactory 未被调用');
    const arrayOptions: NamespaceRuntimeReadArrayOptions = { n: 2, orderBy: { by: 'index', dir: 'desc' }, depth: 1 };
    expect(lease.readArray(['workRecords'], arrayOptions)).toStrictEqual(
      realRuntime.readArray(['workRecords'], arrayOptions),
    );
    const mapOptions: NamespaceRuntimeReadMapOptions = { n: 2, orderBy: { field: 'priority', dir: 'desc' } };
    expect(lease.readMap(['tasks'], mapOptions)).toStrictEqual(realRuntime.readMap(['tasks'], mapOptions));
  });
});

// ═════════════════════════════ 负控（NC1/NC3/NC4） ═════════════════════════════

describe('负控：readData 冻结面与窗口响亮语义互不污染', () => {
  it('NC1 readData 恒四键 + 投影文本；窗口事实不写进 readData 文本', async () => {
    const { lease } = await leaseFixture();
    const read = lease.readData(['tasks']);
    expectReadDataOkKeys(read);
    if (!read.ok) throw new Error('契约前提失败：readData 应成功');
    expect(read.schema).toContain('# readData [tasks]');
    expect(read.schema).not.toContain('窗口');
    expect(read.truncated).toBe(false);
  });

  it('NC4 缺席对偶：readData 吸收（ok:true）vs 窗口响亮（WINDOW_TARGET_ABSENT）', async () => {
    const { lease } = await leaseFixture();
    const absorbed = lease.readData(['nope']);
    expect(absorbed.ok).toBe(true);
    if (!absorbed.ok) throw new Error('unreachable');
    expect(absorbed.value).toBeUndefined();

    const loud = lease.readArray(['nope'], { n: 1 });
    expect(loud.ok).toBe(false);
    if (loud.ok) throw new Error('unreachable');
    expect(loud.code).toBe('WINDOW_TARGET_ABSENT');
  });

  it('装置前提：lease 身份与 fixture 一致（防夹具漂移假红）', async () => {
    const { lease } = await leaseFixture();
    expect(lease.namespaceId).toBe(WINDOW_DOC_ID);
    expect(lease.owner).toStrictEqual({ userId: WINDOW_OWNER.userId });
  });
});

// ───────────────────────── F4/F5 的 record 型 runtime 替身（14 键面） ─────────────────────────

/** 记录型 runtime 替身：窗口两方法可注入；其余面固定返回（不参与断言）。 */
function makeStubRuntime(overrides: {
  readonly disabled?: RuntimeReadDisabledResult;
  readonly readArray?: (...args: unknown[]) => NamespaceRuntimeReadArrayResult;
  readonly readMap?: (...args: unknown[]) => NamespaceRuntimeReadMapResult;
}): NamespaceRuntime {
  return {
    owner: { userId: 'runtime-owner' },
    namespaceId: 'runtime-ns',
    readData: () => ({ ok: true, value: undefined, schema: null, truncated: false }),
    readArray: (path: readonly (string | number)[], options: NamespaceRuntimeReadArrayOptions) => {
      if (overrides.readArray !== undefined) return overrides.readArray(path, options);
      if (overrides.disabled !== undefined) return overrides.disabled;
      return { ok: true, value: [], schema: null, truncated: false };
    },
    readMap: (path: readonly (string | number)[], options: NamespaceRuntimeReadMapOptions) => {
      if (overrides.readMap !== undefined) return overrides.readMap(path, options);
      if (overrides.disabled !== undefined) return overrides.disabled;
      return { ok: true, value: [], schema: null, truncated: false };
    },
    getSchema: () => null,
    getMetadata: () => ({ marker: 'meta' }),
    getActiveSchema: () => null,
    getStatus: () => ({
      lifecycle: 'ready',
      read: { enabled: true },
      rootWrite: { enabled: true },
      schemaWrite: { enabled: true },
      schema: { state: 'ready' },
      fatal: null,
      close: null,
      replication: { state: 'disabled' },
    }),
    mutateData: async () => ({ ok: true }),
    replaceSchema: async () => ({ ok: true }),
    enableReplication: async () => ({ ok: true }),
    bumpReplicationEpoch: async () => ({ ok: true }),
    close: async () => {},
  };
}
