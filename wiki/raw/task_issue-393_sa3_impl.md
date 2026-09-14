# SA3 Implementation Report

- 任务：issue #393 — `FileDiagnosticLog` 在 registry 接缝静默半工作（自然组合零 runtime 记录）
- 角色：SA3（implementation）；worktree：`/home/wangjian/nomicore-fix-issue-393`；HEAD：`dcb3766`（基线，未 commit）
- 交付：P0（自绑定）/ P1（manager 泛化导出）/ P2（skill 文档）+ 版本 bump + 规定验证
- 状态：**完成，无 blocker**。SA6 契约 15 红 → 全绿（4 文件 / 22 tests）；守卫锚保持绿；受影响包与根 typecheck、根全量套件全绿。
- 本轮为 retry dispatch `sa-e57ec977`：上轮 SA3 的 terminal fact 仅为 Host execution-observer
  失败（非业务 verdict）。本轮先核对 worktree，确认实现已按 approved SA1/SA2 设计与 SA6 契约完整落盘，
  随后**从零独立复跑全部规定验证并额外做因果反转核验**；实现内容无需增补或修正，报告原位更新为本轮事实。

---

## Inputs consumed

| 输入 | 位置 | 状态 / 要点 |
|---|---|---|
| 任务简报（issue 正文 + Owner comment 5664521867 裁决 + AC） | `wiki/raw/task_issue-393.md` | 已读；主修复方向 = 自然组合（`createFileDiagnosticLog(...)` 产物直传）必须工作（P0 自绑定），`registry` 探测零改动，类型收紧 fail-fast 作废 |
| SA1 设计（approved） | `wiki/raw/task_issue-393_design.md` | 已读（505 行）；§7.1-D1…D5、§7.2-1…7、§7.3、§11 ALLOW/DENY、§12 验收映射为实施依据 |
| SA2 设计评审 | `wiki/raw/task_issue-393_sa2_review.md` | 已读；verdict **approve**，无 BLOCKER/MAJOR；4 条 MINOR（O1–O4），处置见下 |
| SA6 诊断与验收契约 | `wiki/raw/task_issue-393_sa6_contract.md` | 已读；4 个契约文件 + 10 份 `artifacts/sa6-issue393-*.log` 在 worktree |
| SA8 设计后冲突复查 | `wiki/raw/task_issue-393_design_conflict_report.md` | 已读；verdict **clear**，`requiresConflictRecheck: true`（实现 diff 核对）；§8-b 六项清单逐项核对见下 |
| SA6 红灯契约（4 文件，DENY——只读不改） | `packages/namespace-registry/test/issue-393-ndcl-self-binding-red.test.ts`、`packages/namespace-diagnostic-log/test/issue-393-file-log-runtime-emitter-for-red.test.ts`、`…-surface.test-d.ts`、`apps/yjs-server/test/issue-393-manager-export-and-skill-docs-red.test.ts` | 逐行读取；断言面 = 运行时落盘/事件 + 类型面 + 文档内容契约（P2 交付物本体即文档）；契约文件 mtime 21:19–21:21 早于实现 22:11–22:22，red-first 时序保持 |
| 固定位置缺失项 | `_relevant_decisions.md` / `_conflict_report.md` / `_sa1_review` 等 | 不存在（SA2/SA6/SA8 三方一致确认）；SA8 设计后报告收编决策摘录职能，不阻塞 |

## Existing worktree reconciliation

- 本轮核对前 `git status`：实现 diff 已存在于 9 个 ALLOW 路径；SA6 的 4 个契约文件与 10 份证据
  log 为未跟踪原样；**无过时、不完整或冲突实现**（逐 diff 抽查与设计 §7.1/§7.2/§7.3 一致，见下）。
- 实现 diff 与本报告描述完全一致，本轮**未对实现做任何内容修改**：唯一触及实现文件的是
  因果反转核验（临时 `git stash` P0 hunk 后 `git stash pop`），恢复经 `diff -q` 证明**逐字节一致**。
- 上轮 SA3 的 4 份证据 log 保留（同一实现的等值证据）；本轮追加
  `artifacts/sa3-issue393-rerun-red-and-typecheck.log` 与 `artifacts/sa3-issue393-rerun-full-suite.log`
  作为本轮 dispatch 的权威证据。
- SA6 证据 log（mtime 21:18–21:34）与 4 个契约文件零改动（未被本轮或上轮写入）；DENY 路径
  （`packages/namespace-registry/src/**`、`packages/namespace-runtime/src/**`、replication 包、
  NDCL `src/index.ts`、schema/record/health/pipeline/emission/reader/retention/read-session、
  memory adapter、`docs/adr/**`、`CONTEXT.md`、`config.ts`、`lifecycle.ts`）零 diff。

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/namespace-diagnostic-log/src/adapters/file.ts` | §7.1-D1/D2（§8.1 接口 diff） | `FileDiagnosticLog` 接口 + required 成员 `runtimeEmitterFor(namespaceId): NamespaceDiagnosticChangeEmitter \| undefined` + JSDoc；构造产物字面量（唯一构造点）增 identity 闭包 `ns === namespaceId ? emitter : undefined`（一切模式同一实现，不查 mode） |
| `packages/namespace-diagnostic-log/package.json` | §11 ALLOW；AC 版本 bump | `version` `0.1.8` → `0.1.9` |
| `apps/yjs-server/src/diagnostics.ts` | §7.2-1/2/3/4 | 增 `HostDiagnosticsManagerConfig`（去 `enabled`；`retention` 引用 NDCL 公共 `FileRetentionConfig`）、`HostDiagnosticsManagerEvent`（三成员类型化既有事件形状，词表零变更）、`HostDiagnosticsManagerDeps`（`onEvent?` + 必需 `now`）；工厂签名泛化；`sink` 直呼收口为单一 `notify`（onEvent 缺席静默、throw 吞没）；binding/close/retire 语义零改动 |
| `apps/yjs-server/src/index.ts` | §7.2-5 | `export { createHostDiagnosticsManager } from './diagnostics.js'` + 类型导出 `HostDiagnosticsManager` / `…Config` / `…Deps` / `…Event` / `DiagnosticEmissionDropReason`（按 SA2 O2 的列名清单 5 个） |
| `apps/yjs-server/src/app.ts` | §7.2-6 | manager 调用点 deps 键名适配 `{ sink }` → `{ onEvent: this.sink }`（仍从 `./diagnostics.js` 导入同一模块符号——全仓单份实现，不从 `./index.js` 回导，无 app↔index 循环） |
| `apps/yjs-server/test/diagnostic-replay-host-lifecycle-sa7.test.ts` | §7.2-7（ALLOW 机械适配） | `makeHost` 1 处调用形状：`{ enabled: true, rootDir, … }, { sink, now }` → `{ rootDir, … }, { onEvent, now }`；零断言改动 |
| `apps/yjs-server/test/host-diagnostics-retirement-sa7-228.test.ts` | §7.2-7（ALLOW 机械适配） | 2 处调用形状同上；零断言改动 |
| `.agents/skills/nomicore/cordis-host.md` | §7.3（P2-R1） | 新增二级节「Diagnostic change log (诊断日志)」（Process 与 Guardrails 之间）：单 ns 直传正路（含 `namespaceId` 必须即目标 ns 的 SA2-O1 补句 + 升级/重启零代码改动说明）、多 ns `createHostDiagnosticsManager` 正路与 retire/close 生命周期、裸 `{emitter}` = #150 legacy 陷阱与两种无归属语义边界、Hub/Peer 组合根示例；Process 第 5 步补交叉引用 |
| `.agents/skills/nomicore/SKILL.md` | §7.3（P2-R2） | 路由行扩「namespace diagnostic change log (diagnostic log / observability) wiring for single- or multi-namespace hosts」；frontmatter `description` 同步 |

证据产物（非实现面）：`artifacts/sa3-issue393-rerun-red-and-typecheck.log`（本轮权威：契约 +
4 项 typecheck）、`artifacts/sa3-issue393-rerun-full-suite.log`（本轮权威：根全量套件），
以及上轮等值证据 `artifacts/sa3-issue393-{red-contracts-green,typecheck,affected-suites,full-suite}.log`
（仓内 SA3 证据惯例，见 `git ls-files artifacts/sa3-issue*.log` 先例；SA6 证据 log 零触碰）。
本报告 `wiki/raw/task_issue-393_sa3_impl.md` 原位更新。

## SA2 Finding落实

| Finding ID | Implementation | Result |
|---|---|---|
| §13 Required revisions（无 BLOCKER/MAJOR） | 无需修订，按设计与契约落位 | ✅ 无待落实项 |
| O1（P2 文档补 `namespaceId` 一致性陷阱，建议） | `cordis-host.md` 单 ns 段写入：「`namespaceId` must be the namespace this log belongs to: a single-namespace log records only its own namespace, and every other namespace resolves to `undefined` and is silently dropped inside the Registry pump」 | ✅ 已落实（文档完备性，非阻断项） |
| O2（§7.2-5 计数笔误：称 4 个类型导出实列 5 名） | `index.ts` 按**列名清单**导出 5 个类型（`HostDiagnosticsManager` / `…Config` / `…Deps` / `…Event` / `DiagnosticEmissionDropReason`） | ✅ 已落实（P1-R1 只锁运行时 factory 导出） |
| O3（版本策略：严格 semver 下属 implementor-breaking；仓内惯例 patch；建议发布评审考虑 0.2.0） | 落 `0.1.9`（设计 §11 + AC 明文）；升 0.2.0 与否留发布评审（设计 §13-R7） | ✅ 已落实并按设计留发布评审裁决 |
| O4（若 `onEvent: this.sink` tsc 不满足，机械兜底 `(e) => this.sink(e)`） | **未触发兜底**：`tsc -p apps/yjs-server/tsconfig.json` EXIT 0 直接通过（type-alias 联合的隐式索引签名成立），保持设计原样 | ✅ 无需兜底 |

## SA8 §8-b 实现期核对清单

| # | 核对项 | 结果 |
|---|---|---|
| 1 | `file.ts` 改动不越出「接口 + 构造产物字面量 + JSDoc」 | ✅ 仅接口成员（+JSDoc）与构造产物闭包成员（+注释）；未触碰 emit/建流/schema/manifest/reader/retention 面（`git diff` 逐行核对） |
| 2 | manager binding/close/retire 语义 diff 零漂移 | ✅ `binding` / `unattributedEmitter` / `dropStub` / `ensureAdapter` / `retireNamespace` / `close` 逻辑逐字未动（唯一变化 = `deps.sink(...)` → `notify(...)` 收口）；P1-R2/R3/R4 转绿且 `host-diagnostics-retirement-sa7-228`、`diagnostic-replay-host-lifecycle-sa7` 既有套件零回归（全量套件绿） |
| 3 | registry / runtime / replication 包零 diff | ✅ `git status`：`packages/namespace-registry/src/**`、`packages/namespace-runtime/src/**`、`packages/replication-protocol/**`、`packages/ws-replication/**` 零改动（DENY 保持） |
| 4 | 4 契约文件与 SA6 证据 log 零改动 | ✅ 契约文件 mtime 21:19–21:21（早于实现）、SA6 log mtime 21:18–21:34，全部保持未跟踪原样、零写入（未 `git add`） |
| 5 | NDCL 版本 0.1.8→0.1.9 落盘 | ✅ `packages/namespace-diagnostic-log/package.json:3` |
| 6 | P2 文档把两种无归属语义写为供应方范围限定 | ✅ 「The two unattributed semantics are deliberately different and not interchangeable: a self-bound per-namespace log persists unattributed public-entry rejections into its own stream (single-namespace semantics), while the manager's shared channel always drops them.」 |

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/namespace-diagnostic-log/src/adapters/file.ts` | ALLOW 行 1 | P0 主修复唯一实现面（接口 + 产物闭包） |
| `packages/namespace-diagnostic-log/package.json` | ALLOW 行 2 | 公共面变化的版本 bump（AC） |
| `apps/yjs-server/src/diagnostics.ts` | ALLOW 行 3 | P1 泛化签名 + 事件/deps 类型 + notify 收口 |
| `apps/yjs-server/src/index.ts` | ALLOW 行 4 | P1 公共入口导出（P1-R1） |
| `apps/yjs-server/src/app.ts` | ALLOW 行 5 | P1 app 内部消费同一实现（deps 键名适配） |
| `apps/yjs-server/test/diagnostic-replay-host-lifecycle-sa7.test.ts` | ALLOW 行 6 | 签名泛化的机械适配（零断言改动） |
| `apps/yjs-server/test/host-diagnostics-retirement-sa7-228.test.ts` | ALLOW 行 7 | 同上（两处调用） |
| `.agents/skills/nomicore/cordis-host.md` | ALLOW 行 8 | P2-R1 配置节 + Process 交叉引用 |
| `.agents/skills/nomicore/SKILL.md` | ALLOW 行 9 | P2-R2 路由行 + description |
| `artifacts/sa3-issue393-rerun-{red-and-typecheck,full-suite}.log`（+ 上轮 4 份 `sa3-issue393-*.log`） | 证据产物（非实现路径；DENY 仅列 `artifacts/sa6-issue393-*.log`，零触碰） | 本轮/上轮验证的不可变证据（仓内 SA3 证据惯例） |
| `wiki/raw/task_issue-393_sa3_impl.md` | 本报告（skill 固定 SA3 输出路径；DENY 表保护的既有 Host/SA6/SA1/SA2/SA8 输入零改动） | 实现报告（原位更新） |

DENY 核查：registry/runtime/replication 包、4 个契约测试文件、NDCL `src/index.ts`、
schema/record/health/pipeline/emission/reader/retention/read-session、memory adapter、`docs/adr/**`、
`CONTEXT.md`、`config.ts`、`lifecycle.ts`、`artifacts/sa6-issue393-*.log`、既有
`wiki/raw/task_issue-393*.md`（SA1/SA2/SA6/SA8 与 Host 简报）——**全部零改动**。

## Verification

本轮（retry dispatch）独立复跑结果：

| Command | Result | Evidence |
|---|---|---|
| `NODE_OPTIONS=--conditions=nomicore-source npx vitest run --typecheck <4 SA6 契约文件>` | **4/4 文件通过；22 tests passed；`Type Errors no errors`；EXIT 0**（红灯 15 → 0：registry R0–R4、NDCL R1–R3 + 类型面 R、P1-R1…R4、P2-R1/R2；守卫 6/6 + 类型守卫保持绿） | `artifacts/sa3-issue393-rerun-red-and-typecheck.log` |
| 因果反转核验（临时 `git stash` P0 hunk 后复跑 registry 契约，再 `git stash pop`） | **5 failed / 4 passed**：R0–R4 全红（`runtimeEmitterFor` 为 `"undefined"`），G1–G4 全绿；恢复经 `diff -q` **逐字节一致**。证明绿灯由 P0 变更本身引起，断言未被弱化/跳过（无 skip/only/todo） | 本轮命令输出（stash 前已备份并校验恢复） |
| `NODE_OPTIONS=--conditions=nomicore-source npx tsc -p packages/namespace-diagnostic-log/tsconfig.json` | EXIT 0（零诊断——含 `.test-d.ts` 类型面） | `artifacts/sa3-issue393-rerun-red-and-typecheck.log` |
| `NODE_OPTIONS=--conditions=nomicore-source npx tsc -p apps/yjs-server/tsconfig.json` | EXIT 0（含 `test/**/*.ts`，覆盖 O4 适配面） | 同上 |
| `NODE_OPTIONS=--conditions=nomicore-source npx tsc -p packages/namespace-registry/tsconfig.json` | EXIT 0 | 同上 |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm typecheck`（根 14 包链） | EXIT 0（零错误） | 同上 |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm test`（根全量套件，设计 §12.5 完成门禁） | **396 files passed / 4752 tests passed；`Type Errors no errors`；EXIT 0**。对照 SA6 修复前基线（`artifacts/sa6-issue393-full-suite.log`）：`4 failed / 392 passed`、`15 failed / 4737 passed`、`Type Errors 1 failed` → 全部转绿且既有 392 文件零回归 | `artifacts/sa3-issue393-rerun-full-suite.log` |
| 版本 bump 核验 | `packages/namespace-diagnostic-log/package.json` `0.1.9`（`git diff` 可见） | `git diff packages/namespace-diagnostic-log/package.json` |

上轮 SA3 的等值证据保留在 `artifacts/sa3-issue393-{red-contracts-green,typecheck,affected-suites,full-suite}.log`
（其中受影响包定向复跑为 115 files / 1163 tests 全绿；同一批文件已被本轮全量套件逐字覆盖）。
设计未指定任何静态生成/check 命令（无 schema/codegen 面变更），故本轮无额外生成物核对项。

本轮未新增任何 `skip`/`only`/`todo`、env override、fallback 或吞错；未修改任何契约断言与验收语义；
P0 未借助 registry/runtime 侧改动（DENY 保持）。

## Deferred verification

- **DSH 两个部署的仓外恢复**（设计 §13-R6）：Hub `nomicore-host` / Peer `mabf-runner` 零代码改动 +
  新 tarball + 重启后 `segments/` 恢复记录——仓外事实，不在本 worktree 可证范围。
- **真实环境验收 / 最终动态验证**：归 SA4/SA7（本报告只承载 SA6 契约、受影响包与根门禁结果）。
- **发布评审项**（设计 §12/§13-R7）：yjs-server 是否随公共导出 bump 版本（本票仅强制 NDCL）；
  NDCL 严格 semver 下 0.1.9 与 0.2.0 的取舍（SA2 O3）。
- **显式非目标残余**（issue 明文裁定，不伪装解决）：`diag-pump-drop` 生产观测管道缺口（R4，独立票）；
  memory adapter 无自绑定（R5）；已构造 Runtime 不被回溯补挂（R6 同源）。

## Deviations or blockers

- **无偏离、无 blocker**。设计与契约可实施，ALLOW 范围充分，未发明任何新架构、成员名或旁路机制；
  AC5「接受落盘」按定案以零行为漂移落地（R4 绿）。
- 超出 SA3 最低验证范围的动作（均为证明目的，未修改任何测试或语义）：(1) 根 `pnpm test` 全量套件
  ——设计 §12.5 完成门禁；(2) 一次性因果反转核验（stash/pop，逐字节恢复）——证明绿灯归因于 P0 变更。
- 上轮 terminal fact 为 Host execution-observer 失败：本轮已确认 worktree 业务状态完整（实现 +
  契约 + 证据齐备）并重新取得全部门禁结果，无业务遗留。

## Suggested commit message

```
fix(#393): FileDiagnosticLog 自绑定 runtimeEmitterFor——自然组合恢复 runtime 级诊断

P0：FileDiagnosticLog 增 identity 匹配成员 runtimeEmitterFor(namespaceId)
（ns === 本 ns → 本流 emitter；其它 ns → undefined，泵内静默丢弃，杜绝跨 ns 写入）；
registry 探测逻辑零改动即入 #226 泵路径；无归属公共入口拒绝按 AC5 定案落本流
（现状语义零漂移）。NDCL 0.1.8 → 0.1.9。
P1：createHostDiagnosticsManager 签名泛化（config 去 enabled；deps { onEvent?, now }，
notify 吞没 onEvent throw）并从 apps/yjs-server 公共入口导出；app 内部消费同一实现，
两个既有测试调用点机械适配（零断言改动）。
P2：.agents/skills/nomicore/cordis-host.md 增「诊断日志」配置节（单 ns 直传 / 多 ns
manager / 裸 {emitter} legacy 陷阱 / 无归属语义边界 / Hub·Peer 示例）+ SKILL.md 路由。
验证：SA6 契约 4 文件 22 tests 全绿（15 红 → 0，守卫全绿；反转核验 5 红/4 绿归因证明）；
NDCL/app/registry tsc 与根 pnpm typecheck EXIT 0；根 pnpm test 396 files/4752 tests 全绿。
```
