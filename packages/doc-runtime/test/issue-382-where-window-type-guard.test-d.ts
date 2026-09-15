/**
 * SA6 验收契约（类型面，红灯）— issue #382 P2：`@nomicore/doc-runtime` 窗口原语 `where`
 * 过滤词表与 `total` 值域加宽（ADR 0029 缝 1；SA6 §12.3.8 用例组 Y1–Y4）。
 *
 * 契约来源：
 * - SA6 验收契约 `wiki/raw/task_issue-382_sa6_contract.md` §12.3.8 Y1–Y4、§12.1 B-10；
 * - `docs/adr/0029-filtered-window-read.md` §1（`where?: readonly WhereTerm[]`）、§2
 *   （WhereTerm v1 = `{field: string, equals: string|number|boolean|null}`；形状永不再变）、
 *   §5（成功结算 `total: number | undefined`，键恒在）；
 * - `packages/doc-runtime/AGENTS.md`（新公共类型经 `src/index.ts` 导出并纳入守卫记账）。
 *
 * 红灯机理（HEAD `1b639e0`，SA6 §5/E4 类型探针实证）：`WhereTerm` 不存在（TS2305）、两面
 * options 无 `where` 键（TS2353/TS2339）、成功面 `total` 仍为 `number`（TS2344）——本文件
 * 实现前整组红。
 *
 * 断言纪律：纯编译期（`vitest --typecheck` 采集 `.test-d.ts`）；正例用无指令投影断言锚定
 * 可导入与形状，负例用 `@ts-expect-error` 锚定 fail-closed（指令未消费即 TS2578 红）；
 * 零运行时执行、零 skip/only、零 env override。
 */
import { describe, expectTypeOf, it } from 'vitest';
import type {
  ReadArrayWindowOptions,
  ReadArrayWindowResult,
  ReadMapWindowOptions,
  ReadMapWindowResult,
  WhereTerm,
} from '../src/index.js';

// 正例类型占位声明（纯类型层；仅用于投影断言，不生成运行时产物）。
declare const whereTerm: WhereTerm;
declare const arrayWindowOptions: ReadArrayWindowOptions;
declare const mapWindowOptions: ReadMapWindowOptions;

describe('issue #382 窗口 where 类型面（ADR 0029 缝 1，类型层）', () => {
  it('Y1/Y2 WhereTerm 可经公共入口导入；两面 options 收 where 且投影为 readonly WhereTerm[] | undefined', () => {
    expectTypeOf(whereTerm.field).toEqualTypeOf<string>();
    expectTypeOf(whereTerm.equals).toEqualTypeOf<string | number | boolean | null>();
    expectTypeOf(arrayWindowOptions.where).toEqualTypeOf<readonly WhereTerm[] | undefined>();
    expectTypeOf(mapWindowOptions.where).toEqualTypeOf<readonly WhereTerm[] | undefined>();
    // 对象字面量直传（TS2353 消失）：两面均接受 where 项数组。
    const arrayLiteral: ReadArrayWindowOptions = { n: 5, where: [{ field: 'state', equals: 'claimed' }] };
    const mapLiteral: ReadMapWindowOptions = {
      n: 5,
      orderBy: { field: 'priority', dir: 'desc' },
      where: [{ field: 'state', equals: 'claimed' }, { field: 'priority', equals: 5 }],
    };
    expectTypeOf(arrayLiteral).toEqualTypeOf<ReadArrayWindowOptions>();
    expectTypeOf(mapLiteral).toEqualTypeOf<ReadMapWindowOptions>();
    // 闭集四成员字面量直传（falsy 合法：'' / 0 / false / null）。
    const falsyLiterals: readonly WhereTerm[] = [
      { field: 'state', equals: '' },
      { field: 'count', equals: 0 },
      { field: 'flag', equals: false },
      { field: 'state', equals: null },
    ];
    expectTypeOf(falsyLiterals).toEqualTypeOf<readonly WhereTerm[]>();
    // null 原型链 WhereTerm 仍是 WhereTerm（runtime 侧 C10 反向边界）。
    const nullProto = Object.assign(Object.create(null) as object, { field: 'state', equals: 'claimed' });
    expectTypeOf(nullProto).toMatchTypeOf<WhereTerm>();
  });

  it('Y3 成功面 total 加宽为 number | undefined；成功面 own 键集仍恰三键（#381 键集锁不变）', () => {
    expectTypeOf<Extract<ReadArrayWindowResult, { ok: true }>['total']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<Extract<ReadMapWindowResult, { ok: true }>['total']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<keyof Extract<ReadArrayWindowResult, { ok: true }>>().toEqualTypeOf<'ok' | 'value' | 'total'>();
    expectTypeOf<keyof Extract<ReadMapWindowResult, { ok: true }>>().toEqualTypeOf<'ok' | 'value' | 'total'>();
    // 失败面零变化（增键不回渗失败成员）。
    expectTypeOf<keyof Extract<ReadArrayWindowResult, { ok: false }>>()
      .toEqualTypeOf<'ok' | 'code' | 'path' | 'message'>();
    expectTypeOf<keyof Extract<ReadMapWindowResult, { ok: false }>>()
      .toEqualTypeOf<'ok' | 'code' | 'path' | 'message'>();
  });

  it('Y4 编译期负例 fail-closed：equals 闭集外 / WhereTerm 未知键 / where 非数组 / 语境外 orderBy', () => {
    // @ts-expect-error equals 闭集外（对象不是 string|number|boolean|null）
    const objectEquals: WhereTerm = { field: 'state', equals: {} };
    // @ts-expect-error equals 闭集外（数组同上）
    const arrayEquals: WhereTerm = { field: 'state', equals: [1] };
    // @ts-expect-error equals 闭集外（bigint 不在 v1 标量闭集）
    const bigintEquals: WhereTerm = { field: 'state', equals: 1n };
    // @ts-expect-error WhereTerm 未知键（恰 field/equals 两键，封闭形状）
    const unknownKey: WhereTerm = { field: 'state', equals: 'claimed', extra: 1 };
    // @ts-expect-error field 必须单段字符串（段数组非法）
    const multiSegment: WhereTerm = { field: ['a', 'b'], equals: 'v' };
    // @ts-expect-error where 必须是 WhereTerm 数组（非数组非法）
    const notAnArray: ReadArrayWindowOptions = { n: 1, where: { field: 'state', equals: 'claimed' } };
    // @ts-expect-error 语境外 orderBy 不因 where 放宽（readArray 仅 by:'index'）
    const outOfVocabulary: ReadArrayWindowOptions = { n: 1, where: [{ field: 'state', equals: 'claimed' }], orderBy: { field: 'state' } };
    expectTypeOf(objectEquals).toEqualTypeOf<WhereTerm>();
    expectTypeOf(arrayEquals).toEqualTypeOf<WhereTerm>();
    expectTypeOf(bigintEquals).toEqualTypeOf<WhereTerm>();
    expectTypeOf(unknownKey).toEqualTypeOf<WhereTerm>();
    expectTypeOf(multiSegment).toEqualTypeOf<WhereTerm>();
    expectTypeOf(notAnArray).toEqualTypeOf<ReadArrayWindowOptions>();
    expectTypeOf(outOfVocabulary).toEqualTypeOf<ReadArrayWindowOptions>();
  });
});
