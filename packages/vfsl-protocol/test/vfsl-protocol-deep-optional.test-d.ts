/**
 * SA3 红灯契约测试（issue #337 / ADR-0024 决策 7「T4: DeepOptional 预算读类型面」）——
 * `@nomicore/vfsl-protocol` 第 13 名导出 `DeepOptional` 的**语义面**锚（G1.1–G1.6 + G4）。
 *
 * 契约来源：
 * - SA6 契约 §12.2 文件 1（G1.1–G1.6 + G4）；§12.4 红灯机制 1/2；§12.5 变异矩阵 D2–D6。
 * - SA1 设计 §7 D-1（读值域定义 + 三分支表示 pin：变长数组同态映射不加 `?`、元组元素可选、
 *   对象全字段可选、索引签名值位 `| undefined`、标量原样）、D-5（相等 + 赋值双向判据）、
 *   D-6（判别字段不豁免；narrowing 由本 test-d 锚定；「判别字段保持必选」退路未触发）。
 * - ADR-0024 L92（`DeepOptional` 与 `PathAt` 并列进协议类型面、零 per-schema 生成）、
 *   L94（判别联合附注）、L127（类型面验收：全字段可选 / 在场标量精确 / 数组元素递归）。
 *
 * HEAD 红灯归因（实现前实跑捕获）：`DeepOptional` 尚不存在 → 本文件 import 处 TS2305
 * （SA6 P4 在真实 vitest typecheck 入口同型实证：`has no exported member 'DeepOptional'`）。
 * 实现落位后本文件转绿。
 *
 * 断言纪律（ADR-0004 D4 + SA6 §12.5）：
 * - 正例 = 手写独立 oracle 的 `expectTypeOf(...).toEqualTypeOf<...>()`（不引用被测类型自证）；
 * - 负例 = `@ts-expect-error` 自我反转（错误被误放行时本测试反而失败）；
 * - EOPT 精确性叠加赋值负例（SA6 E7 实测经典 Equal 无法区分 `{a?: string}` 与
 *   `{a?: string | undefined}`——`{a: undefined}` 负例是必需判据，即变异 D2 探针）；
 * - 零 `declare module` 增广（本地手写类型；module augmentation 是 typecheck program 级
 *   全局，见 SA1 §2 B9 隔离先例）。
 */
import { describe, expectTypeOf, it } from 'vitest';
import type { DeepOptional, PathAt, PathSchema, PathValue } from '@nomicore/vfsl-protocol';

/** 判别联合实体（读值域形态：ADR-0004 D2 整值读发射判别联合，成员独有字段）。 */
type Entity =
  | { kind: 'image'; url: string }
  | { kind: 'text'; body: string };

/** 本地迷你表（非 `declare module` 增广：程序级零泄漏；仅用于 G1.6 载体桥接锚）。 */
type MiniMap = {
  label: PathSchema<string, 'leaf'>;
  box: PathSchema<{ n: PathSchema<number, 'leaf'> }, 'map'>;
};

describe('G1.2 对象：全字段可选并递归（EOPT 精确）', () => {
  it('相等：嵌套对象逐层可选化', () => {
    expectTypeOf<DeepOptional<{ a: string; n: { b: number } }>>().toEqualTypeOf<{
      a?: string;
      n?: { b?: number };
    }>();
  });

  it('正例：{} 与部分赋值均可编译（字段确实可选）', () => {
    const empty: DeepOptional<{ a: string; n: { b: number } }> = {};
    const partial: DeepOptional<{ a: string; n: { b: number } }> = { n: {} };
    const full: DeepOptional<{ a: string; n: { b: number } }> = { a: 'x', n: { b: 1 } };
    void empty;
    void partial;
    void full;
  });

  it('EOPT 负例：显式 undefined 不得被接受（自反转；变异 D2 探针）', () => {
    // @ts-expect-error exactOptionalPropertyTypes：`{a?: string}` 不接受显式 `a: undefined`（非 EOPT 实现会放行 → 本行反转失败）
    const bad: DeepOptional<{ a: string }> = { a: undefined };
    void bad;
  });

  it('负例：预算值不得当必填形状使用（CONTEXT L47 Avoid 的断言化）', () => {
    const budgeted: DeepOptional<{ a: string; n: { b: number } }> = {};
    // @ts-expect-error n 可选 → 不可直接以 number 读取 n.b（可选属性访问链编译错误）
    const requiredUse: number = budgeted.n.b;
    void requiredUse;
  });
});

describe('G1.3 标量 / null / 字面量联合：原样保留（不宽化、不产壳）', () => {
  it('string / number / boolean / 可空 / 字面量联合原样', () => {
    expectTypeOf<DeepOptional<string>>().toEqualTypeOf<string>();
    expectTypeOf<DeepOptional<number>>().toEqualTypeOf<number>();
    expectTypeOf<DeepOptional<boolean>>().toEqualTypeOf<boolean>();
    expectTypeOf<DeepOptional<string | null>>().toEqualTypeOf<string | null>();
    expectTypeOf<DeepOptional<'image' | 'text'>>().toEqualTypeOf<'image' | 'text'>();
  });

  it('unknown 兜底原样（无任何分支前件命中，不产壳）', () => {
    expectTypeOf<DeepOptional<unknown>>().toEqualTypeOf<unknown>();
  });

  it('联合逐成员分发：`T | undefined` 透传位分布（成员独有字段读域）', () => {
    expectTypeOf<DeepOptional<{ a: string } | undefined>>().toEqualTypeOf<{ a?: string } | undefined>();
  });
});

describe('G1.4 数组 / 元组 / 索引签名三态（设计 D-1 Q2 pin）', () => {
  it('变长数组：元素递归可选、元素无多余 | undefined、mutable 保留', () => {
    expectTypeOf<DeepOptional<{ a: string }[]>>().toEqualTypeOf<{ a?: string }[]>();
    type ArrElement = DeepOptional<{ a: string }[]>[number];
    expectTypeOf<ArrElement>().toEqualTypeOf<{ a?: string }>();
  });

  it('readonly 变长数组：修饰符保留', () => {
    expectTypeOf<DeepOptional<readonly { a: string }[]>>().toEqualTypeOf<readonly { a?: string }[]>();
  });

  it('元组：元素可选 + 递归（width 可裁定长位置）', () => {
    expectTypeOf<DeepOptional<[string, { a: number }]>>().toEqualTypeOf<[string?, { a?: number }?]>();
  });

  it('嵌套递归：对象字段内的数组', () => {
    expectTypeOf<DeepOptional<{ list: { a: string }[] }>>().toEqualTypeOf<{ list?: { a?: string }[] }>();
  });

  it('索引签名：值位递归可选 + 缺席 | undefined（查找落空口径，与 D2 同源）', () => {
    type Rec = DeepOptional<Record<`${number}`, string>>;
    expectTypeOf<Rec['0']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Rec>().toEqualTypeOf<Record<`${number}`, string | undefined>>();
  });

  it('判别联合数组：元素经递归可选化（不豁免）', () => {
    expectTypeOf<DeepOptional<Entity[]>>().toEqualTypeOf<
      ({ kind?: 'image'; url?: string } | { kind?: 'text'; body?: string })[]
    >();
  });
});

describe('G1.5 判别联合：判别字段一并可选化（ADR-0024 L94 不豁免）', () => {
  it('相等：判别联合逐成员映射、字面量保留', () => {
    expectTypeOf<DeepOptional<Entity>>().toEqualTypeOf<
      { kind?: 'image'; url?: string } | { kind?: 'text'; body?: string }
    >();
  });

  it('在场标量精确：判别字段不宽化为 string', () => {
    type BudgetEntity = DeepOptional<Entity>;
    expectTypeOf<NonNullable<BudgetEntity['kind']>>().toEqualTypeOf<'image' | 'text'>();
  });
});

describe('G1.6 载体桥接：`DeepOptional<PathAt<…>>` 记法 ≡ 值域展开（设计 D-1 Q1 pin）', () => {
  it('值域组合：DeepOptional<PathValue<PathAt<M, P>>> 语义精确', () => {
    expectTypeOf<DeepOptional<PathValue<PathAt<MiniMap, ['box']>>>>().toEqualTypeOf<{ n?: number }>();
    expectTypeOf<DeepOptional<PathValue<PathAt<MiniMap, ['label']>>>>().toEqualTypeOf<string>();
  });

  it('负例：节点载体直套产出载体壳（非读值类型）——域外用法 fail-closed', () => {
    type DirectCarrier = DeepOptional<PathAt<MiniMap, ['label']>>;
    // @ts-expect-error 载体直套产 {readonly __brand?; readonly __value?: string; readonly __kind?: 'leaf'} 壳，不可当 string 读值用（SA6 E6 反证）
    const asString: string = null as unknown as DirectCarrier;
    void asString;
  });
});

describe('G4 判别字段 narrowing（AC3；退路未触发——TS 5.9.3 支持可选判别字段窄化）', () => {
  it('if 窄化：成员独有字段可访问，窄化后类型精确为 T | undefined', () => {
    const v: DeepOptional<Entity> = { kind: 'image', url: 'u' };
    if (v.kind === 'image') {
      // 无 TS2339：成员独有字段在窄化分支可访问（本行无 @ts-expect-error 而编译通过）
      const url: string | undefined = v.url;
      void url;
      // @ts-expect-error 窄化后成员独有字段仍是 string | undefined（「可选但类型不丢」，SA6 E5 唯一 TS2322）
      const exact: string = v.url;
      void exact;
    }
  });

  it('switch 窄化：成员独有字段可访问，类型不丢', () => {
    const v: DeepOptional<Entity> = {};
    switch (v.kind) {
      case 'text': {
        const body: string | undefined = v.body;
        void body;
        // @ts-expect-error 窄化后成员独有字段仍是 string | undefined
        const exact: string = v.body;
        void exact;
        break;
      }
      default:
        break;
    }
  });
});
