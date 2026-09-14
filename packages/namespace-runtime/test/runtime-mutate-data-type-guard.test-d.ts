/**
 * 红灯测试（类型面）— NamespaceRuntime.mutateData 类型化信封重载（ADR 0008 第八键 +
 * ADR 0025/0026 双形态信封；使用方体验优化：字面量调用获得补全与编译期 fail-closed）。
 *
 * 契约来源：
 * - docs/adr/0008 L43：mutateData 接受路径化领域 mutation（四操作）；
 * - docs/adr/0025 L21–27：单操作信封可选顶层 guard（equals/absent 判别联合）；
 * - docs/adr/0026 L25–33：批量信封 { ops: [...] } 双形态互斥、元素不得携带 guard；
 * - @nomicore/doc-runtime 公共类型 MutationEnvelope（GuardedMutation | BatchedMutation）。
 *
 * 锚定机制（在 vitest --typecheck 配置下红/绿翻转）：
 * - 正例：合法双形态字面量可直接调用；动态信封经 `as MutationEnvelope` 显式断言
 *   （回归锚——签名收紧不得破坏任一路径）；
 * - 负例：当前基线签名为 `(mutation: unknown)`——字面量错形状不报错 → @ts-expect-error
 *   指令未使用（TS2578）→ **红**；修绿（参数收窄为 MutationEnvelope，判别联合 +
 *   excess property 检查）→ 负例真实报错 → 指令生效 → **绿**。
 *
 * 红灯现状（当前基线，签名 unknown）：
 * - 全部负例 @ts-expect-error 未使用 → TS2578 → 红。
 */
import { describe, expectTypeOf, it } from 'vitest';
import type { MutationEnvelope } from '@nomicore/doc-runtime';
import type { MutateDataResult, NamespaceRuntime } from '../src/index.js';

declare const runtime: NamespaceRuntime;
declare const dynamicEnvelope: unknown;

describe('namespace-runtime 公共面 — mutateData 类型化信封重载（类型层）', () => {
  it('正例：ADR 0025/0026 双形态字面量均可直接调用（补全面；签名收紧的回归锚）', () => {
    const setLeaf = () => runtime.mutateData({ op: 'set', path: ['tasks', 't1', 'status'], value: 'draft' });
    const deleteKey = () => runtime.mutateData({ op: 'delete', path: ['tasks', 't1'] });
    const arrayInsert = () =>
      runtime.mutateData({ op: 'array-insert', path: ['values'], index: 0, values: [1, 2] });
    const arrayDelete = () => runtime.mutateData({ op: 'array-delete', path: ['values'], index: 0, count: 1 });
    const guardedEquals = () =>
      runtime.mutateData({
        op: 'set', path: ['tasks', 't1', 'status'], value: 'reviewing',
        guard: { path: ['tasks', 't1', 'status'], equals: 'draft' },
      });
    const guardedAbsent = () =>
      runtime.mutateData({
        op: 'set', path: ['tasks', 't2'], value: { status: 'draft' },
        guard: { path: ['tasks', 't2'], absent: true },
      });
    const batched = () =>
      runtime.mutateData({
        ops: [
          { op: 'set', path: ['tasks', 't1', 'status'], value: 'reviewing' },
          { op: 'set', path: ['tasks', 't1', 'reviewer'], value: 'r1' },
        ],
      });
    const batchedGuarded = () =>
      runtime.mutateData({
        ops: [{ op: 'set', path: ['tasks', 't1', 'status'], value: 'reviewing' }],
        guard: { path: ['tasks', 't1', 'status'], equals: 'draft' },
      });
    expectTypeOf(setLeaf).returns.toEqualTypeOf<Promise<MutateDataResult>>();
    expectTypeOf(deleteKey).returns.toEqualTypeOf<Promise<MutateDataResult>>();
    expectTypeOf(arrayInsert).returns.toEqualTypeOf<Promise<MutateDataResult>>();
    expectTypeOf(arrayDelete).returns.toEqualTypeOf<Promise<MutateDataResult>>();
    expectTypeOf(guardedEquals).returns.toEqualTypeOf<Promise<MutateDataResult>>();
    expectTypeOf(guardedAbsent).returns.toEqualTypeOf<Promise<MutateDataResult>>();
    expectTypeOf(batched).returns.toEqualTypeOf<Promise<MutateDataResult>>();
    expectTypeOf(batchedGuarded).returns.toEqualTypeOf<Promise<MutateDataResult>>();
  });

  it('正例：动态构造信封经显式断言调用（信封纯数据 + 运行时校验仍为事实源，ADR 0008 现役契约）', () => {
    // `as MutationEnvelope` 是显式退出静态检查的标记；运行时信封校验（doc-runtime
    // 解析）仍拒绝一切不合格形状——静态收紧零运行时语义变化。
    const dynamic = () => runtime.mutateData(dynamicEnvelope as MutationEnvelope);
    const fromJson = () => runtime.mutateData(JSON.parse('{"op":"set","path":["n"],"value":1}') as MutationEnvelope);
    expectTypeOf(dynamic).returns.toEqualTypeOf<Promise<MutateDataResult>>();
    expectTypeOf(fromJson).returns.toEqualTypeOf<Promise<MutateDataResult>>();
  });

  it('负例 fail-closed：未知 op / 拼错 guard 键 / 双形态同现（TS2322/TS2353 → 指令生效绿）', () => {
    const unknownOp = () =>
      // @ts-expect-error 未知 op 判别值：不属四操作任一分支（TS2322）
      runtime.mutateData({ op: 'nope', path: ['n'], value: 1 });
    const typoGuardKey = () =>
      // @ts-expect-error 拼错 guard 键：联合成员均无 gaurd 属性（TS2353）
      runtime.mutateData({ op: 'set', path: ['n'], value: 1, gaurd: { path: ['n'], equals: 1 } });
    const dualShape = () =>
      // @ts-expect-error 双形态同现：单操作字段组 + ops 互斥（TS2353）
      runtime.mutateData({ op: 'set', path: ['n'], value: 1, ops: [{ op: 'set', path: ['m'], value: 2 }] });
    expectTypeOf(unknownOp).toBeFunction();
    expectTypeOf(typoGuardKey).toBeFunction();
    expectTypeOf(dualShape).toBeFunction();
  });

  it('负例 fail-closed：guard 双谓词同现 / 缺 path / ops 元素携带 guard（ADR 0025 L72–74、ADR 0026 L29）', () => {
    const bothPredicates = () =>
      // @ts-expect-error guard equals 与 absent 不得同现（?: never fail-closed，TS2322）
      runtime.mutateData({ op: 'set', path: ['n'], value: 1, guard: { path: ['n'], equals: 1, absent: true } });
    const missingPath = () =>
      // @ts-expect-error 缺 path：四操作分支均缺必需属性（TS2322）
      runtime.mutateData({ op: 'delete' });
    const elementGuard = () =>
      // @ts-expect-error 批内元素不得携带 guard（guard 只允许顶层；TS2353）
      runtime.mutateData({ ops: [{ op: 'set', path: ['n'], value: 1, guard: { path: ['n'], equals: 1 } }] });
    const arrayInsertMissingIndex = () =>
      // @ts-expect-error array-insert 缺 index（TS2322）
      runtime.mutateData({ op: 'array-insert', path: ['values'], values: [1] });
    expectTypeOf(bothPredicates).toBeFunction();
    expectTypeOf(missingPath).toBeFunction();
    expectTypeOf(elementGuard).toBeFunction();
    expectTypeOf(arrayInsertMissingIndex).toBeFunction();
  });
});
