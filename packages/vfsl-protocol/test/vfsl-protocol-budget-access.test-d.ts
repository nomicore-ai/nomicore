/**
 * SA3 红灯契约测试（issue #337 / ADR-0024 决策 7「T4: DeepOptional 预算读类型面」）——
 * 预算读**类型接缝**锚：`VfslTypedAccess<Map>.readBudgeted`（G3 访问面变体 + G2.3 差分 + G4 接缝）。
 *
 * 契约来源：
 * - SA6 契约 §12.2 文件 2（G3.1/G3.3/G3.4/G3.6 在访问器接缝的镜像断言；§12.3 备选落点行）、
 *   §12.4 红灯机制 3、§12.5 变异矩阵 D2/D4/D6。
 * - SA1 设计 §7 D-2（落点 pin：`read` 之后、`kindOf` 之前的第 7 方法 `readBudgeted`；签名
 *   `DeepOptional<PathValue<PathAt<Map, NoInfer<P>>>>` + 内联封闭 options 形状 + `FailClosedRest`
 *   复用）、D-3（无 options 基线零降级 = 零改动）、D-7（未知路径 fail-closed 不放松）。
 * - ADR-0024 L91/L92（无 options 保持 `PathAt` 完整子树承诺 ↔ 带 options 返回 DeepOptional）、
 *   L127（类型面验收）、L95（预算读非写前完整快照）。
 *
 * HEAD 红灯归因（实现前实跑捕获）：`readBudgeted` 尚不存在 → 本文件方法调用处 TS2339
 * （`Property 'readBudgeted' does not exist on type 'VfslTypedAccess<LocalMap>'`）。
 * 实现落位后本文件转绿。
 *
 * 断言纪律（ADR-0004 D4 + SA1 D-5）：
 * - 正例 = 调用点类型经 `expectTypeOf(...).toEqualTypeOf<手写 oracle>()` 或手写表赋值双向；
 * - 负例 = `@ts-expect-error` 自我反转（未知路径 rest 门 TS2554 / options 形状外键 TS2353 /
 *   必填误用 TS2322）；
 * - 泛型方法取型纪律：只经 `typeof <调用表达式>` 取型，**不得**经 `ReturnType`（泛型签名会
 *   擦除到约束，见 SA1 §12.2 G3.3 注）；
 * - 本地 `interface LocalMap` 作根（非 `declare module` 增广：程序级零泄漏，SA1 §2 B9）；
 *   顶层键与既有增广键清单（name/portraitResourceId/tree/entityList/assets/attachments/
 *   audit/notes/keywords）零碰撞。
 */
import { describe, expectTypeOf, it } from 'vitest';
import type { PathAt, PathElementValue, PathSchema, VfslTypedAccess } from '@nomicore/vfsl-protocol';

/** 判别联合实体（`ents` 成员表；map 节点 → 整值读发射判别联合，ADR-0004 D2）。 */
type EntityNode =
  | { kind: PathSchema<'image', 'leaf'>; url: PathSchema<string, 'leaf'> }
  | { kind: PathSchema<'text', 'leaf'>; body: PathSchema<string, 'xml-fragment'> };

/**
 * 本地预算读测试表（零 `declare module` 增广）：
 * - `box`：map 节点（对象全字段可选递归锚）；
 * - `kw`：array 节点 → 读值域为 `Record<`${number}`, E>` 索引形（数组载体投影）；
 * - `plainArr`：plain 终态 → 读值域为真 TS 数组（数组分支锚：元素递归、无多余 `| undefined`）；
 * - `kind`/`label`：标量（字面量联合 / string 精确锚）。
 */
interface LocalMap {
  label: PathSchema<string, 'leaf'>;
  kind: PathSchema<'image' | 'text', 'leaf'>;
  box: PathSchema<{ n: PathSchema<number, 'leaf'> }, 'map'>;
  ents: PathSchema<Record<string, PathSchema<EntityNode, 'map'>>, 'map'>;
  kw: PathSchema<Record<`${number}`, PathSchema<{ v: PathSchema<string, 'leaf'> }, 'map'>>, 'array'>;
  plainArr: PathSchema<{ a: string }[], 'plain'>;
}

/** 纯类型访问器：typecheck 编译单元永不求值，故可用 `declare const` 获得值而无运行时实现。 */
declare const access: VfslTypedAccess<LocalMap>;

/** 根路径读值的手写独立 oracle（全字段完整形；经赋值双向锚定 `[]> → PathAt → PathValue` 组合）。 */
type RootValue = {
  label: string;
  kind: 'image' | 'text';
  box: { n: number };
  ents: Record<string, { kind: 'image'; url: string } | { kind: 'text'; body: string }>;
  kw: Record<`${number}`, { v: string }>;
  plainArr: { a: string }[];
};

describe('G3.1 字面量路径预算调用：价值列 = DeepOptional<PathValue<PathAt<…>>>', () => {
  it('box（map 节点）→ 对象全字段可选递归', () => {
    expectTypeOf(access.readBudgeted(['box'], { depth: 0 })).toEqualTypeOf<{ n?: number }>();
  });

  it('label（leaf 标量）→ 原样精确类型', () => {
    expectTypeOf(access.readBudgeted(['label'], { depth: 0 })).toEqualTypeOf<string>();
  });

  it('kind（字面量联合标量）→ 不宽化', () => {
    expectTypeOf(access.readBudgeted(['kind'], { depth: 0 })).toEqualTypeOf<'image' | 'text'>();
  });

  it('ents.<key>（判别联合 map 节点）→ 判别联合可选形（不豁免）', () => {
    expectTypeOf(access.readBudgeted(['ents', 'e1'], { depth: 0 })).toEqualTypeOf<
      { kind?: 'image'; url?: string } | { kind?: 'text'; body?: string }
    >();
  });

  it('kw（array 载体 → `Record<`${number}`, E>` 索引形）→ 值位递归 + 缺席 | undefined', () => {
    expectTypeOf(access.readBudgeted(['kw'], { depth: 0 })).toEqualTypeOf<
      Record<`${number}`, { v?: string } | undefined>
    >();
  });

  it('plainArr（plain 终态纯值数组）→ 数组元素递归、无多余 | undefined', () => {
    expectTypeOf(access.readBudgeted(['plainArr'], { depth: 0 })).toEqualTypeOf<{ a?: string }[]>();
  });

  it('根路径 []（D5：[] = 根节点自身）→ 全表递归可选；完整根值可赋入、反向不可', () => {
    const rootBudgeted = access.readBudgeted([], { depth: 1 });
    const empty: typeof rootBudgeted = {};
    const full: RootValue = {
      label: 'x',
      kind: 'image',
      box: { n: 1 },
      ents: {},
      kw: {},
      plainArr: [],
    };
    // 正例：无预算完整值 → 预算可选形（可选化单调方向）
    const widened: typeof rootBudgeted = full;
    // @ts-expect-error 反向：预算可选形不可赋给完整根值（预算读非写前完整快照，ADR-0024 L95）
    const narrowed: RootValue = rootBudgeted;
    const ownKey: string | undefined = rootBudgeted.label;
    void empty;
    void widened;
    void narrowed;
    void ownKey;
  });
});

describe('G3.2 差分锁：同一路径无 options 读仍完整、预算读可选（AC1 零降级）', () => {
  it('read([box]) 仍 Equal 完整形 `{n: number}`（无可选化泄漏）', () => {
    expectTypeOf(access.read(['box'])).toEqualTypeOf<{ n: number }>();
  });

  it('read([plainArr]) / read([kw]) 读值形态分叉：完整形不回退为可选形', () => {
    expectTypeOf(access.read(['plainArr'])).toEqualTypeOf<{ a: string }[]>();
    expectTypeOf(access.read(['kw'])).toEqualTypeOf<Record<`${number}`, { v: string }>>();
  });

  it('完整值可赋给预算形；反向不可（自反转）', () => {
    const full = access.read(['box']);
    const budgeted = access.readBudgeted(['box'], { depth: 0 });
    const widened: typeof budgeted = full;
    void widened;
    // @ts-expect-error 可选形不可赋给完整形（预算读承诺弱化只在预算面成立）
    const narrowed: typeof full = budgeted;
    void narrowed;
  });
});

describe('G3.3 全字段可选：{} 正例与必填误用负例', () => {
  it('{} 可赋给预算读值（字段确实可选；不经 ReturnType 取型）', () => {
    const b = access.readBudgeted(['box'], { depth: 0 });
    const empty: typeof b = {};
    void empty;
  });

  it('必填误用负例：预算值字段不可当必填 number 使用', () => {
    const b = access.readBudgeted(['box'], { depth: 0 });
    // @ts-expect-error 字段可选（number | undefined）→ 不可当必填 number 使用（CONTEXT L47 Avoid）
    const n: number = b.n;
    void n;
  });
});

describe('G3.4 在场标量精确（不宽化为 string/unknown）', () => {
  it('判别字段经预算读仍是精确字面量联合', () => {
    const ent = access.readBudgeted(['ents', 'e1'], { depth: 0 });
    type BudgetEntity = typeof ent;
    expectTypeOf<NonNullable<BudgetEntity['kind']>>().toEqualTypeOf<'image' | 'text'>();
    // 正例：精确字面量可直接使用（窄化前置：在场值不丢类型）
    const discriminating: 'image' | 'text' | undefined = ent.kind;
    void discriminating;
  });

  it('顶层标量字段经预算读仍精确', () => {
    const k = access.readBudgeted(['kind'], { depth: 0 });
    expectTypeOf<NonNullable<typeof k>>().toEqualTypeOf<'image' | 'text'>();
  });
});

describe('G3.6 fail-closed 与 options 形状（不放松）', () => {
  it('未知字面量路径 → rest 门缺参（TS2554，与 read 同机制同文）', () => {
    // @ts-expect-error 未知路径解析为 UnknownPath → FailClosedRest 标缺参
    access.readBudgeted(['noSuchKey'], { depth: 0 });
  });

  it('缺 options 实参 → 编译错误（预算调用必须显式 options）', () => {
    // @ts-expect-error 第二参 options 为必需实参
    access.readBudgeted(['box']);
  });

  it('options 形状外键 → 编译错误（内联封闭形状，比 schema opt-in 更严）', () => {
    // @ts-expect-error schema 不在 {depth?, maxChildrenPerNode?} 形状内（excess property）
    access.readBudgeted(['box'], { depth: 1, schema: true });
  });

  it('既有无 options 读的 fail-closed 语义不放松（本地表未知路径仍编译错误）', () => {
    // @ts-expect-error 未知路径 read 仍缺 rest 实参
    access.read(['noSuchKey']);
    // @ts-expect-error 未知路径 kindOf 仍缺 rest 实参
    access.kindOf(['noSuchKey']);
  });
});

describe('G2.3 既有访问面零降级（方法加法不触既有六方法语义）', () => {
  it('read / patch / kindOf / 序列编辑三件套签名与投影不变', () => {
    const label: string = access.read(['label']);
    void label;
    access.patch(['label'], 'x');
    const kind: 'leaf' = access.kindOf(['label']);
    void kind;
    const arrayKind: 'array' = access.kindOf(['kw']);
    void arrayKind;
    access.appendToArray(['kw'], { v: 'x' });
    access.insertIntoArray(['kw'], 0, { v: 'x' });
    access.deleteFromArray(['kw'], 0);
    const element: PathElementValue<PathAt<LocalMap, ['kw']>> = { v: 'x' };
    void element;
  });
});

describe('G4 接缝镜像：预算读判别联合 narrowing（AC3；退路未触发）', () => {
  it('if / switch 窄化：成员独有字段可访问、类型精确为 T | undefined', () => {
    const v = access.readBudgeted(['ents', 'e1'], { depth: 0 });
    if (v.kind === 'image') {
      const url: string | undefined = v.url;
      void url;
      // @ts-expect-error 窄化后成员独有字段仍是 string | undefined
      const exact: string = v.url;
      void exact;
    }
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
