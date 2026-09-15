/**
 * issue #383（ADR 0029 缝 2）lease 过滤窗口契约 —— `NamespaceLease.readArray` / `readMap`
 * 的 where 透传、released 短路与类型/导出冻结面（SA6 §12.3.7 L 组 + T11/X8/L1 镜像对）。
 *
 * 契约来源：
 * - `wiki/raw/task_issue-383_sa6_contract.md` §12.3.7（L1–L6）、§12.3.3 T11、§12.3.4 X8、
 *   §12.3.9 C4、§12.4 M1（#382 条件不变式继续绿）；
 * - `docs/adr/0009`（lease 代理面）、ADR 0024 决策 6、ADR 0029 §1/§5/§6；
 * - SA1 设计 §5.3（registry 零代码：released 短路先于透传、raw 引用直传、单源别名链）。
 *
 * 红灯机理（HEAD `de2ff55`）：lease 与 runtime 同码 `WINDOW_OPTIONS_INVALID`（缝 1 中间态 +
 * S3 四键白名单）；缝 2 落地后 L1/T11/X8 组转绿，L2–L6/C4 为预绿守卫（实现后必须保持）。
 *
 * 断言纪律：行为断言只观察公共接缝；成功形状经集中化 helper 表达；镜像期望取自**同一次
 * 运行的同 doc 直调 runtime**（公共面 oracle，与 lease 侧独立装配）；零 skip/only/todo、
 * 零 env override、零 fallback、零源码字符串断言。
 */
import { describe, expect, it } from 'vitest';
import type {
  NamespaceLease,
  NamespaceLeaseReadArrayResult,
  NamespaceLeaseReadArrayOptions,
  NamespaceLeaseReadMapResult,
  NamespaceLeaseReadMapOptions,
} from '@nomicore/namespace-registry';
import type { NamespaceRuntime } from '@nomicore/namespace-runtime';
import { expectReadDataOkKeys } from '../../namespace-runtime/test/helpers/readdata-ok-shape.js';
import {
  CLAIMED,
  makeFilteredLease,
  makeFilteredPair,
  type FilteredPairFixture,
} from './issue-383-filtered-window-fixture.js';

const TRUNCATION_HEADER = '✂ 截断事实：';

/** trap 计数 options（released / 停接纳期零 options 读取；target 直建以免构造期自计数）。 */
function trapCountingOptions(target: object): { readonly options: object; readonly calls: () => number } {
  let calls = 0;
  const options = new Proxy(target, {
    get(t, key, receiver) {
      calls += 1;
      return Reflect.get(t, key, receiver);
    },
    getOwnPropertyDescriptor(t, key) {
      calls += 1;
      return Reflect.getOwnPropertyDescriptor(t, key);
    },
    ownKeys(t) {
      calls += 1;
      return Reflect.ownKeys(t);
    },
    has(t, key) {
      calls += 1;
      return Reflect.has(t, key);
    },
  });
  return { options, calls: () => calls };
}

/** 单次捕获公共面调用：显式区分「返回了结果」与「裸抛逃逸」。 */
function capture<T>(call: () => T): { readonly result: T | undefined; readonly escaped: unknown } {
  try {
    return { result: call(), escaped: undefined };
  } catch (error) {
    return { result: undefined, escaped: error };
  }
}

/** 失败面四键形状（W1 失败成员 / 接缝终态）。 */
function expectWindowFailure(actual: unknown): { readonly code: string; readonly message: string } {
  const failure = actual as { ok: boolean; code: string; path: readonly (string | number)[]; message: string };
  expect(failure.ok).toBe(false);
  expect(Object.keys(failure as object).sort()).toEqual(['code', 'message', 'ok', 'path']);
  expect(typeof failure.code).toBe('string');
  expect(Array.isArray(failure.path)).toBe(true);
  expect(typeof failure.message === 'string' && failure.message.length > 0).toBe(true);
  return failure;
}

/** 同一 doc 双面 fixture（lease 与直调 runtime 同 doc；读结果逐字段对账）。 */
async function pair(options: { readonly heavy?: boolean } = {}): Promise<FilteredPairFixture> {
  return makeFilteredPair(options);
}

/** 泄漏探测：lease 与 runtime 公共面均不得暴露裸 runtime / live Y.Doc 成员（L4）。 */
function assertNoRuntimeLeak(lease: NamespaceLease, runtime: NamespaceRuntime): void {
  expect('doc' in lease).toBe(false);
  expect('runtime' in lease).toBe(false);
  expect('doc' in runtime).toBe(false);
  expect('runtime' in (lease as unknown as Record<string, unknown>)).toBe(false);
}

// ══════════════════ L1 / A5 / T11 / X8：lease 透传组合面 ══════════════════

describe('L1：lease 公共面 where 成功面 ≡ 同 doc 直调 runtime（透传即代理）', () => {
  it('键面：entry 列表、schema 字节、truncated、ok 逐字段一致（含装满判定）', async () => {
    const { lease, runtime } = await pair();
    const cases: ReadonlyArray<NamespaceLeaseReadMapOptions> = [
      { n: 5, where: [...CLAIMED] },
      { n: 3, where: [...CLAIMED] },
      { n: 2, where: [...CLAIMED] },
      { n: 2, where: [...CLAIMED], orderBy: { field: 'priority', dir: 'desc' } },
      { n: 2, where: [...CLAIMED], depth: 1, maxChildrenPerNode: 2 },
    ];
    for (const options of cases) {
      const viaLease = lease.readMap(['tasks'], options);
      const viaRuntime = runtime.readMap(['tasks'], options);
      expectReadDataOkKeys(viaLease);
      expect(viaLease, JSON.stringify(options)).toStrictEqual(viaRuntime);
      if (!viaLease.ok) throw new Error(`契约前提失败：${JSON.stringify(viaLease)}`);
      expect(viaLease.schema).not.toContain(TRUNCATION_HEADER); // 有 where：✂ 永不装配
    }
    await lease.release();
  });

  it('数组面：位置序身份与 schema 通道一致（X8 镜像）', async () => {
    const { lease, runtime } = await pair();
    const cases: ReadonlyArray<NamespaceLeaseReadArrayOptions> = [
      { n: 1, where: [...CLAIMED] },
      { n: 2, where: [...CLAIMED] },
      { n: 1, where: [...CLAIMED], orderBy: { by: 'index', dir: 'desc' }, depth: 1 },
    ];
    for (const options of cases) {
      const viaLease = lease.readArray(['taskList'], options);
      const viaRuntime = runtime.readArray(['taskList'], options);
      expectReadDataOkKeys(viaLease);
      expect(viaLease, JSON.stringify(options)).toStrictEqual(viaRuntime);
    }
    await lease.release();
  });

  it('T11 双语义镜像：n=5 → false（扫完）/ n=2 → true（装满），与 runtime 同参一致', async () => {
    const { lease, runtime } = await pair();
    const wide = lease.readMap(['tasks'], { n: 5, where: [...CLAIMED] });
    const narrow = lease.readMap(['tasks'], { n: 2, where: [...CLAIMED] });
    if (!wide.ok || !narrow.ok) throw new Error('契约前提失败：lease where 读应成功');
    expect(wide.value.map((entry) => entry.key)).toStrictEqual(['t1', 't3', 't5']);
    expect(wide.truncated).toBe(false);
    expect(narrow.value.map((entry) => entry.key)).toStrictEqual(['t1', 't3']);
    expect(narrow.truncated).toBe(true);
    expect(wide).toStrictEqual(runtime.readMap(['tasks'], { n: 5, where: [...CLAIMED] }));
    expect(narrow).toStrictEqual(runtime.readMap(['tasks'], { n: 2, where: [...CLAIMED] }));
    await lease.release();
  });

  it('透传即代理：lease 侧与 runtime 侧**同一 options 引用**语义（无复制、无预处理）', async () => {
    const { lease, runtime } = await pair();
    const options = { n: 2, where: [...CLAIMED] } as const;
    expect(lease.readMap(['tasks'], options)).toStrictEqual(runtime.readMap(['tasks'], options));
    await lease.release();
  });
  it('D3 组合式 depth 等价锚（lease 侧 oracle）：每条目 ≡ 同预算 lease.readData(项路径)', async () => {
    const { lease, registry } = await makeFilteredLease();
    const budget = { depth: 1, maxChildrenPerNode: 2 } as const;
    const map = lease.readMap(['tasks'], { n: 5, where: [...CLAIMED], ...budget });
    if (!map.ok) throw new Error(`契约前提失败：${JSON.stringify(map)}`);
    for (const entry of map.value) {
      const oracle = lease.readData(['tasks', entry.key], budget);
      if (!oracle.ok) throw new Error('契约前提失败：lease 项读应成功');
      expect(entry.value, entry.key).toStrictEqual(oracle.value);
    }
    const array = lease.readArray(['taskList'], { n: 2, where: [...CLAIMED], depth: 1 });
    if (!array.ok) throw new Error(`契约前提失败：${JSON.stringify(array)}`);
    for (const entry of array.value) {
      const oracle = lease.readData(['taskList', entry.index], { depth: 1 });
      if (!oracle.ok) throw new Error('契约前提失败：lease 项读应成功');
      expect(entry.value, String(entry.index)).toStrictEqual(oracle.value);
    }
    await lease.release();
    await registry.shutdown();
  });
});

// ══════════════════ L2 / L3：released 短路与 lease 零解释 ══════════════════

describe('L2/L3/C4：released 短路先于透传；lease 层零解释/零校验', () => {
  it('L2/C4 released 后 where 读：两方法均 NAMESPACE_LEASE_RELEASED、三键、零 options 触达', async () => {
    const { lease, registry } = await makeFilteredLease();
    await lease.release();
    for (const [name, call] of [
      ['readMap', (options: object) => lease.readMap(['tasks'], options as NamespaceLeaseReadMapOptions)],
      ['readArray', (options: object) => lease.readArray(['taskList'], options as NamespaceLeaseReadArrayOptions)],
    ] as const) {
      const probe = trapCountingOptions({ n: 2, where: [...CLAIMED] });
      const result = call(probe.options);
      expect(result.ok, name).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.code, name).toBe('NAMESPACE_LEASE_RELEASED');
      expect(Object.keys(result as object).sort(), name).toEqual(['code', 'message', 'ok']);
      expect(probe.calls(), `${name}：released 短路不得触达 options`).toBe(0);
    }
    await registry.shutdown();
  });

  it('L3 options 顶层 own accessor where：WINDOW_OPTIONS_INVALID 且 getter 计数 === 0（lease 不读 options）', async () => {
    const { lease, registry } = await makeFilteredLease();
    let getterCalls = 0;
    const options: Record<string, unknown> = { n: 2 };
    Object.defineProperty(options, 'where', {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1;
        return [{ field: 'state', equals: 'claimed' }];
      },
    });
    const call = capture(() => lease.readMap(['tasks'], options as never));
    expect(call.escaped).toBeUndefined();
    const failure = expectWindowFailure(call.result);
    expect(failure.code).toBe('WINDOW_OPTIONS_INVALID');
    expect(getterCalls).toBe(0);
    await lease.release();
    await registry.shutdown();
  });
});

// ══════════════════ L4 / L5 / L6：冻结面 ══════════════════

describe('L4/L5/L6：公共面键集与 readData 冻结（零新增）', () => {
  it('L4 lease 恰十六键 / runtime 恰十五键（既有键集断言保持——含 base 变更订阅 watchMap；where 零新方法）', async () => {
    const { lease, runtime } = await pair();
    expect(Object.keys(lease)).toHaveLength(16);
    expect(Object.keys(runtime)).toHaveLength(15);
    expect('total' in (lease as object)).toBe(false);
    await lease.release();
  });

  it('L5 readData 冻结：where 不进 readData options（READ_OPTIONS_INVALID）；预算读行为不变', async () => {
    const { lease, runtime } = await pair();
    const rejected = lease.readData(['tasks'], { where: [...CLAIMED] } as never);
    expect(rejected.ok).toBe(false);
    if (rejected.ok) throw new Error('unreachable');
    expect(rejected.code).toBe('READ_OPTIONS_INVALID');
    expect(lease.readData(['tasks'], { where: [...CLAIMED] } as never)).toStrictEqual(
      runtime.readData(['tasks'], { where: [...CLAIMED] } as never),
    );
    const budgeted = lease.readData(['tasks', 't1'], { depth: 1 });
    if (!budgeted.ok) throw new Error('契约前提失败：预算 readData 应成功');
    expectReadDataOkKeys(budgeted);
    await lease.release();
  });

  it('L6 值导出面零新增：窗口类型名不得成为公共 value 导出（WhereTerm 为 type-only）', async () => {
    const registryMain = await import('@nomicore/namespace-registry');
    const runtimeMain = await import('@nomicore/namespace-runtime');
    for (const name of ['WhereTerm', 'WindowTerm', 'ReadArrayWindowOptions', 'ReadMapWindowOptions']) {
      expect(Object.keys(registryMain), `registry 不得新增 value 导出 ${name}`).not.toContain(name);
      expect(Object.keys(runtimeMain), `runtime 不得新增 value 导出 ${name}`).not.toContain(name);
    }
  });
});

// ══════════════════ Z 镜像：敌意 where 经 lease 零外抛 ══════════════════

describe('Z 镜像（Z1/Z2）：敌意 where 经 lease 零外抛、零 [[Get]]', () => {
  it('抛错 get trap 的合法 where 项/数组：lease 成功、trap 零调用', async () => {
    const { lease, registry } = await makeFilteredLease();
    let termGetCalls = 0;
    const term = new Proxy(
      { field: 'state', equals: 'claimed' },
      {
        get(target, key, receiver) {
          termGetCalls += 1;
          void target;
          void key;
          void receiver;
          throw new Error('probe: hostile where term get trap');
        },
      },
    );
    let arrayGetCalls = 0;
    const where = new Proxy([{ field: 'state', equals: 'claimed' }], {
      get(target, key, receiver) {
        arrayGetCalls += 1;
        void target;
        void key;
        void receiver;
        throw new Error('probe: hostile where array get trap');
      },
    });
    const viaTerm = capture(() => lease.readMap(['tasks'], { n: 5, where: [term] } as never));
    expect(viaTerm.escaped).toBeUndefined();
    if (!viaTerm.result!.ok) throw new Error(`契约前提失败：${JSON.stringify(viaTerm.result)}`);
    expect(viaTerm.result!.value.map((entry) => entry.key)).toStrictEqual(['t1', 't3', 't5']);
    expect(termGetCalls).toBe(0);

    const viaArray = capture(() => lease.readMap(['tasks'], { n: 2, where } as never));
    expect(viaArray.escaped).toBeUndefined();
    if (!viaArray.result!.ok) throw new Error(`契约前提失败：${JSON.stringify(viaArray.result)}`);
    expect(viaArray.result!.value.map((entry) => entry.key)).toStrictEqual(['t1', 't3']);
    expect(arrayGetCalls).toBe(0);
    await lease.release();
    await registry.shutdown();
  });

  it('非法 where（非数组 / 未知键 / equals NaN）：lease 面响亮 WINDOW_OPTIONS_INVALID、四键', async () => {
    const { lease, registry } = await makeFilteredLease();
    for (const where of ['claimed', [{ field: 'state', equals: 'claimed', extra: 1 }], [{ field: 'state', equals: Number.NaN }]]) {
      const call = capture(() => lease.readMap(['tasks'], { n: 2, where } as never));
      expect(call.escaped).toBeUndefined();
      expect(expectWindowFailure(call.result).code).toBe('WINDOW_OPTIONS_INVALID');
    }
    await lease.release();
    await registry.shutdown();
  });
});

// ══════════════════ N 负控：无 where 面 lease ≡ runtime ══════════════════

describe('N 负控：无 where 面零漂移（lease ≡ runtime；total 不上 lease 结算）', () => {
  it('N2 键面/数组面无 where 同参 toStrictEqual；恒四键、无 total 键', async () => {
    const { lease, runtime } = await pair();
    for (const options of [
      { n: 2 },
      { n: 5 },
      { n: 3, orderBy: { field: 'priority', dir: 'desc' as const } },
    ]) {
      const viaLease = lease.readMap(['tasks'], options);
      expectReadDataOkKeys(viaLease);
      expect(viaLease).toStrictEqual(runtime.readMap(['tasks'], options));
      expect('total' in (viaLease as object)).toBe(false);
    }
    const array = lease.readArray(['taskList'], { n: 2, orderBy: { by: 'index', dir: 'desc' } });
    expectReadDataOkKeys(array);
    expect(array).toStrictEqual(runtime.readArray(['taskList'], { n: 2, orderBy: { by: 'index', dir: 'desc' } }));
    await lease.release();
  });

  it('M1 #382 条件不变式在缝 2 态继续成立：ok:true ⟹ 条目全满足谓词；ok:false ⟹ WINDOW_OPTIONS_INVALID', async () => {
    const { lease, registry } = await makeFilteredLease();
    const cases: ReadonlyArray<
      readonly [NamespaceLeaseReadMapResult | NamespaceLeaseReadArrayResult, string, unknown]
    > = [
      [lease.readMap(['tasks'], { n: 2, where: [{ field: 'priority', equals: 5 }] }), 'priority', 5],
      [lease.readArray(['taskList'], { n: 2, where: [{ field: 'state', equals: 'claimed' }] }), 'state', 'claimed'],
    ];
    for (const [result, field, expected] of cases) {
      if (result.ok === true) {
        for (const entry of result.value) {
          const value = (entry.value as Record<string, unknown>)[field];
          expect(value, 'ok:true ⟹ 条目必须满足谓词（禁止静默未过滤通过）').toBe(expected);
        }
      } else {
        expect(result.code).toBe('WINDOW_OPTIONS_INVALID');
      }
    }
    await lease.release();
    await registry.shutdown();
  });
});

// ══════════════════ 冻结面负控：lease 面无 where 语义零回归（Byte 锚）══════════════════

describe('AC1 负控：lease 无 where ✂ 事实行逐字节（ADR 0028 快照零漂移）', () => {
  it('tasks {n:2} 事实行 = 基 key asc · kept 2/total 5；正文 = 元素口径 oracle', async () => {
    const { lease } = await pair();
    const result = lease.readMap(['tasks'], { n: 2 });
    if (!result.ok) throw new Error(`契约前提失败：${JSON.stringify(result)}`);
    expect(result.truncated).toBe(true);
    if (result.schema === null) throw new Error('契约前提失败：schema 应非 null');
    expect(result.schema).toContain(`${TRUNCATION_HEADER}\n- tasks · 窗口 · 基 key asc · kept 2/total 5\n`);
    await lease.release();
  });

  it('runtime 面负控：readArray/readMap 十五键面（无第十六方法——watchMap 属 base）', async () => {
    const { runtime, lease } = await pair();
    const surface = runtime as unknown as Record<string, unknown>;
    expect(typeof surface.readArray).toBe('function');
    expect(typeof surface.readMap).toBe('function');
    expect(surface.readWindow).toBeUndefined();
    expect(Object.keys(lease)).toHaveLength(16);
    assertNoRuntimeLeak(lease, runtime);
    await lease.release();
  });
});
