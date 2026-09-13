/**
 * issue #333（T0）+ issue #336（T3 形状修订）+ issue #364（T2 投影文本化）：readData
 * 成功分支形状的统一断言/构造面。
 *
 * 形状权威（#364/ADR-0027 决策 1 落位后）：ADR-0024 决策 4 的恒五键再修订为**恒四键**
 * `{ ok: true, value, schema, truncated }`：value 键恒在场（缺席为显式 undefined）、
 * `schema` 为**投影文本**（`string | null`——头行 + 渲染正文 + ✂ 段；null 单义直通，
 * 非空串）、`truncated` 为本次读发生过截断的布尔机器信号（无预算读 = false）、结构化
 * `truncations` 键退役（截断事实唯一载体 = 文本内 ✂ 段）。恰三键 → 五键 → 四键两次
 * 破坏性修订都在本模块单点完成（T0 的交付目的：消费文件零形状源码改动）。
 *
 * 两联合（legacy / 预算）成功成员**同型**（#364 CT-8 解释）：本 helper 的
 * `ReadDataOkShape` 对两重载通用，typed stub（`() => readDataOk(...)` 赋给 runtime 替身
 * 的 readData）的可赋值性由「同一四键成员 ⊆ 两联合」结构性保证。
 *
 * ★ 反伪绿不变量（SA6 契约 C2.3 的结构前提）：`expectReadDataOk` 不得以任何方式
 *   从 `readDataOk` 派生其期望对象（反之亦然）。二者必须各自独立内联构造形状：
 *   替身/生产任一侧的形状突变（M1/M2/M3）只应改变 actual 一侧，才能被断言面击穿。
 *   把两者合并为单一构造函数会让突变同时改写 actual 与 expected → 伪绿。
 */
import { expect } from 'vitest';

/** 成功分支恰四键键集（字母序——与既有键集断言的 .sort() 语义一致；#364 修订点）。 */
export const READDATA_OK_KEYS = ['ok', 'schema', 'truncated', 'value'] as const;

/** 成功分支恰四键形状——`NamespaceRuntimeReadDataResult` / `…BudgetResult` 成功成员的
 *  精确同构（保持 typed stub 的 TS2322 类型锁：接口键集漂移时 stub 在此编译失败）。 */
export interface ReadDataOkShape {
  readonly ok: true;
  readonly value: unknown;
  /** 投影文本（头行 + 渲染正文 + ✂ 段）或严格 null（无 active schema / 路径偏离 / 敌意 path）。 */
  readonly schema: string | null;
  /** 本次读发生过截断的机器信号（无预算读恒 false）。 */
  readonly truncated: boolean;
}

/** 生产者侧：测试替身/工厂构造 readData 成功返回值（每次新鲜普通对象）。缺省参数 =
 *  无截断（既有双参调用点零改动编译通过）。 */
export function readDataOk(
  value: unknown,
  schema: string | null,
  truncated = false,
): ReadDataOkShape {
  const shape: ReadDataOkShape = { ok: true, value, schema, truncated };
  return shape;
}

/** 断言侧（family A 替换）：恰四键全等断言——多一键/少一键/ok 非真/value 或 schema
 *  不深等即失败；期望值独立内联构造（见文件头反伪绿不变量）。truncated 缺省 false。 */
export function expectReadDataOk(
  actual: unknown,
  expected: {
    value: unknown;
    schema: string | null;
    truncated?: boolean;
  },
): void {
  const expectedShape: ReadDataOkShape = {
    ok: true,
    value: expected.value,
    schema: expected.schema,
    truncated: expected.truncated ?? false,
  };
  expect(actual).toStrictEqual(expectedShape);
}

/** 键集侧（family B 替换）：恰四键整键集断言（只断键集，不比较值）。 */
export function expectReadDataOkKeys(actual: object): void {
  expect(Object.keys(actual).sort()).toStrictEqual(READDATA_OK_KEYS);
}
