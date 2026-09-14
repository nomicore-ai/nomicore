/**
 * SA6 红灯测试（类型面）— @nomicore/doc-runtime 公共入口恢复导出 mutation 类型名目
 * （issue #90 / 任务简报「关键上下文 3」）。
 *
 * 契约来源（任务简报 关键上下文 3）：
 * - #76 已 CLOSED（随 #87 PR #96 以 set-only 最小落地收口）→ set-only
 *   `applyValidatedMutation` 及其类型名目 `MutationIssue` /
 *   `ApplyValidatedMutationResult` 恢复为公共入口正名目；
 * - 安全保留的正名目不变：`ExtractIssue` / `ExtractResult` /
 *   `ReadLogicalValueResult` / `MaterializeIssue` / `MaterializeResult` /
 *   `DocRuntimeFatalPhase` / `ReplaceIssue` / `ReplaceResult`。
 *
 * 锚定机制（在 vitest --typecheck 配置下红/绿翻转）：
 * - 正例（必须可导入的名目）用无指令 import 锚定：任一缺失 → TS2305 → **红**；
 * - 当前基线（入口未导出 three 名目）→ import 报 TS2305 → **红**；
 *   修绿（SA3 恢复导出）→ TS2305 消失 → **绿**。
 *
 * 红灯现状（当前基线，index.ts 未导出）：
 * - 本文件两个正例 import 均报 TS2305 → 红。
 */
import { describe, expectTypeOf, it } from 'vitest';
import type * as Y from 'yjs';
import type { DerivedSchema } from '@nomicore/vfsl';
import { applyValidatedMutation } from '../src/index.js';
import type {
  ApplyValidatedMutationResult,
  ArrayWindowEntry,
  BatchedMutation,
  DocRuntimeFatalPhase,
  ExtractIssue,
  ExtractResult,
  FieldWindowTerm,
  GuardedMutation,
  IndexWindowTerm,
  KeyWindowTerm,
  MapWindowEntry,
  MaterializeIssue,
  MaterializeResult,
  MutationEnvelope,
  MutationGuard,
  MutationIssue,
  ReadArrayWindowOptions,
  ReadArrayWindowResult,
  ReadLogicalValueAtPathBudgetResult,
  ReadLogicalValueAtPathOptions,
  ReadLogicalValueResult,
  ReadLogicalValueTruncationEntry,
  ReadMapWindowOptions,
  ReadMapWindowResult,
  ReplaceIssue,
  ReplaceResult,
  ValidatedMutation,
  WindowDir,
  WindowFailureCode,
  WindowReadFailure,
  WindowTerm,
} from '../src/index.js';

// 正例名目的类型占位声明（纯类型层；仅用于 expectTypeOf 投影，不生成运行时产物）
declare const extractIssue: ExtractIssue;
declare const extractResult: ExtractResult;
declare const readResult: ReadLogicalValueResult;
declare const materializeIssue: MaterializeIssue;
declare const materializeResult: MaterializeResult;
declare const replaceIssue: ReplaceIssue;
declare const replaceResult: ReplaceResult;
declare const phase: DocRuntimeFatalPhase;
declare const mutationIssue: MutationIssue;
declare const mutationResult: ApplyValidatedMutationResult;
// 形状预算（issue #334 / ADR-0024）新名目：任一缺失 → import TS2305 → 红
declare const readOptions: ReadLogicalValueAtPathOptions;
declare const readTruncationEntry: ReadLogicalValueTruncationEntry;
declare const readBudgetResult: ReadLogicalValueAtPathBudgetResult;
// ADR 0026 批量信封名目：任一缺失 → import TS2305 → 红
declare const batchedMutation: BatchedMutation;
declare const mutationEnvelope: MutationEnvelope;
// ADR 0028 缝 1 窗口原语名目（issue #368 W1）：任一缺失 → import TS2305 → 红
declare const windowDir: WindowDir;
declare const indexWindowTerm: IndexWindowTerm;
declare const keyWindowTerm: KeyWindowTerm;
declare const fieldWindowTerm: FieldWindowTerm;
declare const windowTerm: WindowTerm;
declare const arrayWindowOptions: ReadArrayWindowOptions;
declare const mapWindowOptions: ReadMapWindowOptions;
declare const arrayWindowEntry: ArrayWindowEntry;
declare const mapWindowEntry: MapWindowEntry;
declare const windowFailureCode: WindowFailureCode;
declare const windowFailure: WindowReadFailure;
declare const arrayWindowResult: ReadArrayWindowResult;
declare const mapWindowResult: ReadMapWindowResult;
// applyValidatedMutation 参数面锚（纯类型层；调用全部包在箭头函数内，不产生运行时执行）
declare const derived: DerivedSchema;
declare const doc: Y.Doc;
declare const dynamicEnvelope: unknown;

describe('@nomicore/doc-runtime 公共入口 — mutation 类型名目恢复导出（issue #90 范围，类型层）', () => {
  it('恢复的名目可经公共入口导入：MutationIssue / ApplyValidatedMutationResult（任意缺失即 TS2305 红）', () => {
    expectTypeOf(mutationIssue.message).toEqualTypeOf<string>();
    expectTypeOf(mutationIssue.path).toEqualTypeOf<Array<string | number>>();
    expectTypeOf(mutationResult.ok).toEqualTypeOf<boolean>();
  });

  it('保留的公共类型名目仍可经公共入口导入（任一缺失即 TS2305 红）', () => {
    // 仅锚"可导入"本身；基本投影证明导入有效（不锁字段形状细节——属既有交付范围）。
    expectTypeOf(extractIssue.message).toEqualTypeOf<string>();
    expectTypeOf(readResult.ok).toEqualTypeOf<boolean>();
    expectTypeOf(materializeResult.ok).toEqualTypeOf<boolean>();
    expectTypeOf(replaceResult.ok).toEqualTypeOf<boolean>();
    expectTypeOf(phase).toEqualTypeOf<
      'observer-cleanup-throw' | 'post-commit-verification' | 'pre-commit-internal'
    >();
    expectTypeOf(extractResult).toMatchTypeOf<{ ok: boolean }>();
  });

  it('形状预算新名目可经公共入口导入（issue #334 / ADR-0024：options / 截断条目 / 预算结果联合）', () => {
    // 仅锚"可导入 + 基本投影"（详细类型契约见 read-logical-value-at-path-shape-budget.test-d.ts）。
    expectTypeOf(readOptions.depth).toEqualTypeOf<number | undefined>();
    expectTypeOf(readTruncationEntry.kind).toEqualTypeOf<'depth' | 'width'>();
    expectTypeOf(readTruncationEntry.omitted).toEqualTypeOf<number>();
    expectTypeOf(readBudgetResult.ok).toEqualTypeOf<boolean>();
  });
});

// ── ADR 0026 批量信封公共类型名目（值面守卫不动；本面登记正例 + 三类编译期负例）──────

describe('@nomicore/doc-runtime 公共入口 — 批量信封类型名目（ADR 0026，类型层）', () => {
  it('BatchedMutation / MutationEnvelope 可经公共入口导入；元素类型为 ValidatedMutation', () => {
    expectTypeOf(batchedMutation.ops).toEqualTypeOf<readonly ValidatedMutation[]>();
    expectTypeOf(batchedMutation.ops[0]).toEqualTypeOf<ValidatedMutation | undefined>();
    expectTypeOf(mutationEnvelope).toMatchTypeOf<ValidatedMutation | BatchedMutation>();
  });

  it('编译期负例 fail-closed：双形态同现 / 元素携带 guard / 非信封值', () => {
    // @ts-expect-error 双形态同现：单操作字段组超出 BatchedMutation 属性集（TS2353）
    const dualShape: BatchedMutation = { op: 'set', path: [], value: 1, ops: [{ op: 'set', path: ['n'], value: 2 }] };
    // @ts-expect-error 元素不得携带 guard 键（批级前提属 ADR 0025 顶层；TS2353）
    const elementWithGuard: BatchedMutation = { ops: [{ op: 'set', path: ['n'], value: 2, guard: { kind: 'exists', path: ['n'] } }] };
    // @ts-expect-error 字符串不是合法信封（TS2322）
    const notAnEnvelope: MutationEnvelope = 'not-an-envelope';
    expectTypeOf(dualShape).toEqualTypeOf<BatchedMutation>();
    expectTypeOf(elementWithGuard).toEqualTypeOf<BatchedMutation>();
    expectTypeOf(notAnEnvelope).toEqualTypeOf<MutationEnvelope>();
  });
});

// ── ADR 0025 条件写类型名目（issue #347 AC7；值面守卫见 public-surface-guard.test.ts P4）──

describe('@nomicore/doc-runtime 公共入口 — 条件写类型名目（ADR 0025 / issue #347，类型层）', () => {
  it('T1a MutationGuard 判别联合：equals / absent 两成员正例合法，path 投影为 readonly (string|number)[]', () => {
    const equalsGuard: MutationGuard = { path: ['tasks', 't1', 'status'], equals: 'draft' };
    const numericEqualsGuard: MutationGuard = { path: ['values', 0], equals: 1717 };
    const absentGuard: MutationGuard = { path: ['tasks', 't1'], absent: true };
    expectTypeOf(equalsGuard.path).toEqualTypeOf<readonly (string | number)[]>();
    expectTypeOf(absentGuard.path).toEqualTypeOf<readonly (string | number)[]>();
    expectTypeOf(equalsGuard.equals).toEqualTypeOf<unknown>();
    expectTypeOf(numericEqualsGuard).toMatchTypeOf<MutationGuard>();
  });

  it('T1b 编译期负例 fail-closed：absent 非字面 true / equals+absent 同现 / 缺 path / 缺判别键', () => {
    // @ts-expect-error absent 必须是字面 true（false 不满足成员二；成员一无 absent 位置）
    const absentFalse: MutationGuard = { path: ['n'], absent: false };
    // @ts-expect-error equals 与 absent 不得同时出现（两成员各自 excess property）
    const bothPredicates: MutationGuard = { path: ['n'], equals: 1, absent: true };
    // @ts-expect-error 缺 path（两成员均缺必需属性）
    const missingPath: MutationGuard = { equals: 1 };
    // @ts-expect-error 缺判别键（equals 与 absent 必须恰现其一）
    const missingDiscriminator: MutationGuard = { path: ['n'] };
    expectTypeOf(absentFalse).toEqualTypeOf<MutationGuard>();
    expectTypeOf(bothPredicates).toEqualTypeOf<MutationGuard>();
    expectTypeOf(missingPath).toEqualTypeOf<MutationGuard>();
    expectTypeOf(missingDiscriminator).toEqualTypeOf<MutationGuard>();
  });

  it('T1c GuardedMutation 顶层可选 guard（缺席即现役无 guard 契约）', () => {
    const guarded: GuardedMutation = { op: 'set', path: ['n'], value: 2, guard: { path: ['n'], equals: 1 } };
    const unguarded: GuardedMutation = { op: 'delete', path: ['n'] };
    expectTypeOf(guarded.guard).toEqualTypeOf<MutationGuard | undefined>();
    expectTypeOf(unguarded).toMatchTypeOf<ValidatedMutation>();
    expectTypeOf(guarded).toMatchTypeOf<MutationEnvelope>();
  });
});

// ── ADR 0028 缝 1 窗口原语类型名目（issue #368 W1；值面守卫见 public-surface-guard.test.ts P-W1/P-W2）──

describe('@nomicore/doc-runtime 公共入口 — 窗口原语类型名目（ADR 0028 / issue #368，类型层）', () => {
  it('B-4 单 WindowTerm 闭合联合三成员 + dir 枚举投影', () => {
    expectTypeOf(indexWindowTerm.by).toEqualTypeOf<'index'>();
    expectTypeOf(keyWindowTerm.by).toEqualTypeOf<'key'>();
    expectTypeOf(fieldWindowTerm.field).toEqualTypeOf<string>();
    expectTypeOf(windowDir).toEqualTypeOf<'asc' | 'desc'>();
    expectTypeOf(windowTerm).toMatchTypeOf<IndexWindowTerm | KeyWindowTerm | FieldWindowTerm>();
  });

  it('B-3 options 面专属词表 + B-5 条目/失败结算联合投影', () => {
    expectTypeOf(arrayWindowOptions.n).toEqualTypeOf<number>();
    expectTypeOf(arrayWindowOptions.orderBy).toEqualTypeOf<IndexWindowTerm | undefined>();
    expectTypeOf(mapWindowOptions.orderBy).toEqualTypeOf<KeyWindowTerm | FieldWindowTerm | undefined>();
    expectTypeOf(arrayWindowEntry.index).toEqualTypeOf<number>();
    expectTypeOf(arrayWindowEntry.value).toEqualTypeOf<unknown>();
    expectTypeOf(mapWindowEntry.key).toEqualTypeOf<string>();
    expectTypeOf(windowFailure.code).toEqualTypeOf<WindowFailureCode>();
    expectTypeOf(windowFailure.path).toEqualTypeOf<readonly (string | number)[]>();
    expectTypeOf(windowFailure.message).toEqualTypeOf<string>();
    expectTypeOf(arrayWindowResult.ok).toEqualTypeOf<boolean>();
    expectTypeOf(mapWindowResult.ok).toEqualTypeOf<boolean>();
  });

  it('编译期负例 fail-closed：语境外排序项被面专属 options 类型拒绝（v1 词表编译期编码）', () => {
    // @ts-expect-error 数组面 orderBy 仅接受 IndexWindowTerm（field 属键面）
    const arrayFieldTerm: ReadArrayWindowOptions = { n: 1, orderBy: { field: 'score' } };
    // @ts-expect-error 数组面不接受 by:'key'（ADR 0028 决策 2 v1 词表）
    const arrayKeyTerm: ReadArrayWindowOptions = { n: 1, orderBy: { by: 'key' } };
    // @ts-expect-error 键面不接受 by:'index'（readArray 专属）
    const mapIndexTerm: ReadMapWindowOptions = { n: 1, orderBy: { by: 'index' } };
    // @ts-expect-error 多段 field（段数组）非法——v1 恰单段字符串
    const mapMultiSegment: ReadMapWindowOptions = { n: 1, orderBy: { field: ['a', 'b'] } };
    expectTypeOf(arrayFieldTerm).toEqualTypeOf<ReadArrayWindowOptions>();
    expectTypeOf(arrayKeyTerm).toEqualTypeOf<ReadArrayWindowOptions>();
    expectTypeOf(mapIndexTerm).toEqualTypeOf<ReadMapWindowOptions>();
    expectTypeOf(mapMultiSegment).toEqualTypeOf<ReadMapWindowOptions>();
  });
});

// ── applyValidatedMutation 参数面类型化信封（使用方体验：字面量获得判别联合检查）──────
// 契约来源：ADR 0025 L21–27（顶层 guard）、ADR 0026 L25–33（批量 {ops} 双形态互斥、
// 元素不得携带 guard）；公共类型 MutationEnvelope（GuardedMutation | BatchedMutation）。
// 红绿翻转：当前基线第三参 `ValidatedMutation | unknown` 规约为 unknown——字面量错形状
// 不报错 → @ts-expect-error 未使用（TS2578）→ 红；参数收窄为 MutationEnvelope 后
// 负例真实报错 → 指令生效 → 绿。动态构造信封经 `as MutationEnvelope` 显式断言。

describe('@nomicore/doc-runtime 公共入口 — applyValidatedMutation 类型化信封（类型层）', () => {
  it('正例：双形态信封字面量 / 显式断言动态信封均可直接调用（回归锚）', () => {
    const applySet = () => applyValidatedMutation(derived, doc, { op: 'set', path: ['n'], value: 1 });
    const applyGuarded = () =>
      applyValidatedMutation(derived, doc, {
        op: 'set', path: ['n'], value: 2,
        guard: { path: ['n'], equals: 1 },
      });
    const applyBatched = () =>
      applyValidatedMutation(derived, doc, {
        ops: [{ op: 'delete', path: ['m'] }],
        guard: { path: ['n'], absent: true },
      });
    const applyDynamic = () => applyValidatedMutation(derived, doc, dynamicEnvelope as MutationEnvelope);
    expectTypeOf(applySet).returns.toEqualTypeOf<ApplyValidatedMutationResult>();
    expectTypeOf(applyGuarded).returns.toEqualTypeOf<ApplyValidatedMutationResult>();
    expectTypeOf(applyBatched).returns.toEqualTypeOf<ApplyValidatedMutationResult>();
    expectTypeOf(applyDynamic).returns.toEqualTypeOf<ApplyValidatedMutationResult>();
  });

  it('负例 fail-closed：拼错 guard 键 / 双形态同现 / 未知 op（TS2353/TS2322 → 指令生效绿）', () => {
    const applyTypo = () =>
      // @ts-expect-error 拼错 guard 键：联合成员均无 gaurd 属性（TS2353）
      applyValidatedMutation(derived, doc, { op: 'set', path: ['n'], value: 1, gaurd: { path: ['n'], equals: 1 } });
    const applyDual = () =>
      // @ts-expect-error 双形态同现：单操作字段组 + ops 互斥（TS2353）
      applyValidatedMutation(derived, doc, { op: 'set', path: ['n'], value: 1, ops: [{ op: 'set', path: ['m'], value: 2 }] });
    const applyUnknownOp = () =>
      // @ts-expect-error 未知 op 判别值：不属四操作任一分支（TS2322）
      applyValidatedMutation(derived, doc, { op: 'nope', path: ['n'], value: 1 });
    expectTypeOf(applyTypo).toBeFunction();
    expectTypeOf(applyDual).toBeFunction();
    expectTypeOf(applyUnknownOp).toBeFunction();
  });
});
