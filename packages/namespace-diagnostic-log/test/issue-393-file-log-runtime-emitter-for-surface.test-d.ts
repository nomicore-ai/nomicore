/**
 * SA6 验收契约（类型面）— issue #393 P0：`FileDiagnosticLog` 公共声明必须携带
 * 自绑定成员 `runtimeEmitterFor`（identity 匹配本 namespace 的数据键控解析）。
 *
 * 锚定机制（`vitest --typecheck` / 包 tsconfig 编译期判定）：
 * - 【红】`FileDiagnosticLog` 必须满足结构 `{ runtimeEmitterFor?: (namespaceId: string)
 *   => NamespaceDiagnosticChangeEmitter | undefined }`——当前声明缺席 → 条件类型求值
 *   `false` → `expectTypeOf<false>().toEqualTypeOf<true>()` 编译期红；SA3 落位 → 绿。
 *   （条件目标用可选成员形态：required/optional 声明均满足存在性 + 形状锚，避免对
 *   SA1 形态选择过度约束；运行时在场性由同目录 runtime 契约的 typeof 探测锚定。）
 * - 【绿（保持性守卫）】`emitter` 成员形状不变（#150 冻结 seam）；
 *   `namespaceId` / `rootDir` / `streamId` 公共成员保持只读 string。
 *
 * 公共面变化 → `namespace-diagnostic-log` 版本 bump（发布门禁，非本文件断言面）。
 */
import { describe, expectTypeOf, it } from 'vitest';
import type { FileDiagnosticLog, NamespaceDiagnosticChangeEmitter } from '../src/index.js';

type ResolverShape = (namespaceId: string) => NamespaceDiagnosticChangeEmitter | undefined;
type HasSelfBinding = FileDiagnosticLog extends { runtimeEmitterFor?: ResolverShape } ? true : false;
type KeepsEmitter = FileDiagnosticLog extends { emitter: NamespaceDiagnosticChangeEmitter } ? true : false;
type KeepsReadonlyNames = FileDiagnosticLog extends {
  readonly namespaceId: string;
  readonly rootDir: string;
  readonly streamId: string;
} ? true
  : false;

describe('#393 P0 类型面 — FileDiagnosticLog.runtimeEmitterFor', () => {
  it('R (RED): 声明必须存在 runtimeEmitterFor(namespaceId) → emitter | undefined', () => {
    expectTypeOf<HasSelfBinding>().toEqualTypeOf<true>();
  });

  it('G (GREEN): emitter / namespaceId / rootDir / streamId 公共成员零漂移', () => {
    expectTypeOf<KeepsEmitter>().toEqualTypeOf<true>();
    expectTypeOf<KeepsReadonlyNames>().toEqualTypeOf<true>();
  });
});
