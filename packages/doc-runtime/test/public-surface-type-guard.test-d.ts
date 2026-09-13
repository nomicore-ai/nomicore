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
import type {
  ApplyValidatedMutationResult,
  BatchedMutation,
  DocRuntimeFatalPhase,
  ExtractIssue,
  ExtractResult,
  MaterializeIssue,
  MaterializeResult,
  MutationEnvelope,
  MutationIssue,
  ReadLogicalValueAtPathBudgetResult,
  ReadLogicalValueAtPathOptions,
  ReadLogicalValueResult,
  ReadLogicalValueTruncationEntry,
  ReplaceIssue,
  ReplaceResult,
  ValidatedMutation,
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
