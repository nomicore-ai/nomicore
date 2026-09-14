# SA3 Implementation Report — issue #381：[ADR 0029] P1 W1 冻结解除与 total 下沉（prefactor）

- 任务：`nomicore` issue #381（Parent PR #380 `adr-0029-filtered-window-read`）
- Worktree：`/home/wangjian/nomicore-fix-issue-381`（branch `mabf/issue-381`；基线 HEAD `8a4fa40` = 设计输入基线）
- dispatch：`sa-589479a6-4d7a-482a-b8d9-ecb8963a34d3`（role `mabf-sa3`，iteration 0，implementation）
- 结论：实现与设计 §5 D1–D6 逐条一致；SA6 §12.3 T1–T9 由红转绿；AC3 回归面零 diff 全绿；全仓门见 §Verification。

## Inputs consumed

| 输入 | 状态 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-381.md`（Host 简报；What to build + AC1–AC5；Comments 空） | 在场，已读 | 验收面承接 |
| `wiki/raw/task_issue-381_sa6_contract.md`（verdict approve；§12 契约 + §13–§16 证据） | 在场，已读 | 红灯契约与验收面（T1–T9 / M1–M4 / R1–R6 / X1–X5 / G1–G2） |
| `wiki/raw/task_issue-381_design.md`（SA1 iteration 0 设计） | 在场，已读 | 实现权威（D1–D6、ALLOW/DENY、§8 验收映射） |
| `wiki/raw/task_issue-381_sa2_review.md`（verdict approve；0 BLOCKER/0 MAJOR；O-1–O-4） | 在场，已读 | 非阻断观察落实（O-1/O-2/O-3） |
| `wiki/raw/task_issue-381_design_conflict_report.md`（verdict clear；`requiresConflictRecheck: true`） | 在场，已读 | override 范围与冻结面核对输入 |
| `wiki/raw/task_issue-381_relevant_decisions.md` / `_conflict_report.md` | 不存在（SA6 §1 / SA8 §2 同款结论） | 以 ADR 0028/0029 + 包 AGENTS 替代约束面 |
| Owner comment | 无（简报 Comments 空 + dispatch 明示 REST 读回零评论） | 无额外 owner 口径 |

**实施前检查结论**：设计内部一致、ALLOW/DENY 明确、SA2 无 BLOCKER/MAJOR、SA8 两项 override 在设计范围内可兑现、红灯契约（SA6 §12.3 T1–T9 + §12.4 M1/M2）清晰且与设计不矛盾 ⟹ 具备实施条件，未触发 `reject`。

## Existing worktree reconciliation

- 实施前 worktree 无 `wiki/raw/task_issue-381_sa3_impl.md`、无未提交实现（`git status --short` 仅 Host 简报等 5 份未跟踪 wiki 输入 + 本票后续产物）；实施起点 = 干净 HEAD `8a4fa40`。
- 实施前聚焦基线实跑：窗口家族 5 文件 **114/114 绿**（与 SA6 §4 基线逐位一致），确认无遗留变异/探针。

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/doc-runtime/src/window.ts` | §5 D1/D2、§10 ALLOW 行 1 | 两结果联合成功成员加必填 `total: number`（D1.1）；`WindowCoreResult` 成功成员加 `total`（D1.2）；`windowCore` 成功返回 `total: candidates.length`（D1.2/D2 单源）；两公共入口成功字面量 `{ok,value,total}`（D1.3，字面序 `ok,value,total`）；头注 A 装配段两键 → 三键 + ADR 0029 §5/§8 依据（D1.4）。失败面零改动。`read.ts` 复制纪律段保持不动（H7）。 |
| `packages/namespace-runtime/src/window-read.ts` | §5 D3、§10 ALLOW 行 2 | 删 S4 调用点与 `countWindowCandidatesAtPath`/`countMapEntries`/`countingDefectFailure`；删 W1 出处标记镜像整块（15 名目 + 2 类型别名）仅保留本地防御件 `safePathCopy`（注文重述为「非镜像纪律存续」，`copied from` 标记归零）；`WindowComposeInput` 删 `doc` 增 `total`；`composeArray/MapWindowRead` 追加 `total` 末参；编排收缩为 S3 → S5 → S6 且 `const total = input.total;`；头注重写（删 S4/冻结/镜像纪律段）。742 → 427 行。 |
| `packages/namespace-runtime/src/runtime.ts` | §5 D4/D5、§10 ALLOW 行 3 | `readArray`/`readMap` 传 `windowResult.total`；JSDoc 删「S4 O(N) 计数」、改述 W1 单源消费。S1 lifecycle gate 与 S2 失败透传零改动。 |
| `packages/doc-runtime/test/issue-368-window-read-design-pins.test.ts` | §5 D6-M1 | P7 成功半 `['ok','value']` → `['ok','value','total']`（+ 标题措辞同步）；失败半两处四键断言零改动。 |
| `packages/doc-runtime/test/public-surface-type-guard.test-d.ts` | §5 D6-M2 | 新增三键类型锁 `it`：两联合成功成员 `keyof` = `'ok'\|'value'\|'total'`、`total` 成员类型 `number`、失败成员恰四键（SA2 O-2：按目标文件 `expectTypeOf` idiom 落锁）。 |
| `packages/doc-runtime/test/issue-368-window-read-contract-red.test.ts` | §5 D6-M3 | 仅头注 B-5 措辞（注释级，零断言改动）。 |
| `packages/doc-runtime/test/issue-381-window-total-red.test.ts`（新，414 行） | §5 D6-P3 | T1–T9 值断言增量：三键 own 键集、`total` 数值性、独立预言机对账（四载体 + 9 项边界矩阵 + ROOT 面 9 键）、`min(n,total)` 双向、排序基/预算轴不变性、N=2000 零物化哨兵、失败面四键 + 三码 + `PATH_NOT_ALLOWED` 透传。 |
| `artifacts/sa3-issue381-structural-audit.log` | §5 D6-P5 / SA6 §12.6 | X1–X5 结构审计原始输出（含 SA2 O-1 作用域钉定与诚实注解）。 |
| `artifacts/sa3-issue381-t-group-head-red.log` | SA6 §12.10 | T 组在 HEAD 的红基线实跑（反伪绿证据）。 |
| `artifacts/sa3-issue381-focused-window-family.log` | SA6 §14 | 聚焦 8 文件（含 .test-d）+ 三包 typecheck 输出。 |
| `artifacts/sa3-issue381-sensitivity-mutations.log` | SA6 §12.8 | 变异 A/B/C 敏感度实验（击穿面 + 还原复绿）。 |
| `artifacts/sa3-issue381-full-gate.log` | SA6 §12.10 G1/G2 | 全仓 `pnpm typecheck` + `pnpm test` 原始输出。 |

## SA2 Finding落实

SA2 verdict = approve，**0 BLOCKER / 0 MAJOR**；§13「无 Required revisions」。四条 MINOR 观察落实如下：

| Finding ID | Implementation | Result |
|---|---|---|
| O-1（X3 作用域未钉） | 结构审计日志同时记录 **X3a**（SA2 钉定域 `packages/namespace-runtime/src/*.ts` 全量原始输出）与 **X3b**（镜像承载文件 `window-read.ts`）。X3b = 0 命中（15 名目全消失）；X3a 的 10 行命中全部位于 `projection.ts`（7 行）/`plain-data.ts`（3 行）——经 `git log -S` 证实为 Phase 3（#85，`5db6f83`）既有的**同名独立实现**子系统，非 #369 镜像件，且本变更集对其零 diff（DENY「不扩大范围 / 不修改无关面」）。未伪报 X3a = 0 命中。 |
| O-2（M2 锁形态与文件 idiom 不匹配） | 未引入 `AssertTrue`/`Equal` helper；按目标文件既有 `expectTypeOf<…>().toEqualTypeOf<…>()` idiom 落锁（`public-surface-type-guard.test-d.ts` 新增 `it`）。 | 锁语义不变（成功恰三键 + 失败恰四键），HEAD 红 → 实现后绿；`vitest --typecheck` no errors。 |
| O-3（§8.3「删除不缩小任何可达失败面」措辞在对抗域不精确） | 已在 §「对抗性 S4 移除边界」中按建议精确化登记（含 `countingDefectFailure` 的失败→成功跃迁），边界处置维持「不判负、不写断言、不引新读路径」。 | 边界记录精确，零越界动作（未写 E4 断言、未新增读路径）。 |
| O-4（设计 §6/§14 对 SA8 产物在场性陈述过时） | 无需设计修订；本实现以 SA8 报告 §8 五项核对清单为输入：其中 (a)(b)(c)(d)(e) 逐项在 §「SA8 required action 1 自查」中给出证据。 | 自查通过（见下节）。 |

## 对抗性 S4 移除边界（O-3 精确化登记；非阻断，不判负、不写断言、不引新读路径）

- **场景类**：`runtime.ts` S1/S2 → 组合层 S3 canonical 重读 options 之间无 await/yield；唯一可在两次导航间运行的用户代码是 options 的 Proxy/descriptor trap（SA6 §7 同款结论）。
- **边界 ①（叙述修正，SA6 §9-E4）**：HEAD 在该类下 `truncated`/✂ 按第二次导航的 4 项快照叙述而 `value` 取自 3 项快照（`kept 3/total 4`）；下沉后 `total` 与 `value` 同一次枚举产出 ⟹ `total=3`、`truncated:false`、无 ✂ 块。
- **边界 ②（失败→成功跃迁，SA2 O-3 补记）**：被删的 `countingDefectFailure`（`PATH_NOT_ALLOWED` 计数防御位）触发条件是「W1 成功后第二次导航失败」；S4 删除后该触发条件**结构性不存在**。因此在该对抗类内，若 trap 在 S3 重读窗内删除/移走容器，HEAD 可能以计数防御失败收尾，而实现后按 W1 快照成功返回——即该类存在**失败 → 成功**的可观察跃迁。
- 处置（与 SA6 §12.9/O4、SA8 §3-17、设计 R-381-1 四方一致）：既有契约零覆盖（既有测试零语义改动仍全绿，114/114 与 50/50 实证）；属 ADR 0029 §8 指令要消除的接缝漂移本身；**不判负、不写断言、不引入新读路径**。确定性输入域下 lease 可观察行为逐字节不变（零 diff 回归面 50/50 全绿 + 变异 C 16 红实证 `total` 承重）。
- 删除的可达失败面核对：`countingDefectFailure` 不是 ADR 0028 §7 失败词表成员（三码 + `PATH_NOT_ALLOWED` 的 `PATH_NOT_ALLOWED` 语义位分别为导航纪律位与 E100/物化透传，均保留）；接缝终态 `seamWindowOptionsInvalid` 保留（S3 两出口零改动，composition S3 用例零 diff 全绿）。

## SA8 required action 1 自查（实现后冲突复查输入；`requiresConflictRecheck: true` 兑现）

| 核对项 | 证据 | 结果 |
|---|---|---|
| (a) 文档-代码同变更集：三处头注/JSDoc 清账 | X5 输出（structural-audit.log）：`window-read.ts` 头注重写、`runtime.ts` JSDoc 删「S4 O(N) 计数」、contract-red B-5 措辞同步 | 通过 |
| (b) override 范围未扩大 | `git diff --stat -- …` 对 `read.ts`/`carrier.ts`/`doc-runtime/src/index.ts`/`registry/src`/`registry+namespace-runtime test`/`docs`/`CONTEXT.md`/`vitest.config.ts`/`tsconfig*`/`package.json` 全为空；X2 = 0 命中（`copied from window.ts@ab6e390` ≤1 达成、`copied from carrier.ts` 归零）；零新公共值导出（`index.ts` 两文件零 diff） | 通过 |
| (c) P7/类型锁迁移与 ADR 0029 §5 三键语义一致（失败半四键不动） | pins P7 成功半三键、失败半两处四键零改动；类型锁新增 `it` 绿；T1 锁字面序 `['ok','value','total']` | 通过 |
| (d) lease 四键 + ✂ byte 级断言零 diff 全绿 | registry lease 33/33 + composition 17/17（两目录 `git diff --stat` 空） | 通过 |
| (e) 结构审计 X1/X3/X4 落 artifacts | `artifacts/sa3-issue381-structural-audit.log`（X1 = 0、X3b = 0、X4 行数 742→427） | 通过 |

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/doc-runtime/src/window.ts` | §10 ALLOW「`packages/doc-runtime/src/window.ts`」 | D1/D2 三键化 + 单源 total |
| `packages/namespace-runtime/src/window-read.ts` | §10 ALLOW「`packages/namespace-runtime/src/window-read.ts`」 | D3 组合层收缩 + total 单源消费 |
| `packages/namespace-runtime/src/runtime.ts` | §10 ALLOW「`packages/namespace-runtime/src/runtime.ts`」 | D4 消费点 + D5 JSDoc |
| `packages/doc-runtime/test/issue-368-window-read-design-pins.test.ts` | §10 ALLOW「…design-pins.test.ts」 | D6-M1 迁移 |
| `packages/doc-runtime/test/public-surface-type-guard.test-d.ts` | §10 ALLOW「…type-guard.test-d.ts」 | D6-M2 类型锁 |
| `packages/doc-runtime/test/issue-368-window-read-contract-red.test.ts` | §10 ALLOW「…contract-red.test.ts（仅头注 B-5）」 | D6-M3 注释清账 |
| `packages/doc-runtime/test/issue-381-window-total-red.test.ts`（新） | §10 ALLOW「`packages/doc-runtime/test/issue-381-window-total-red.test.ts`（新）」 | AC1/AC4 值断言增量 |
| `artifacts/sa3-issue381-*.log`（5 份） | §10 ALLOW「`artifacts/sa3-issue381-*.log`（模式）」 | 结构审计 / 红绿 / 变异 / 全仓门证据 |

**DENY 核对（逐项零 diff）**：`doc-runtime/src/read.ts`、`doc-runtime/src/carrier.ts`、`doc-runtime/src/index.ts`、`doc-runtime/test/public-surface-guard.test.ts`、`namespace-runtime/src/index.ts`、`namespace-runtime/src/read-schema-projection.ts`、`namespace-runtime/test/**`、`namespace-registry/test/**`、`namespace-registry/src/**`、`docs/adr/0028`、`docs/adr/0029`、`CONTEXT.md`、`vitest.config.ts`、`tsconfig.*`、`package.json`、`wiki/raw/task_issue-381*.md`（输入只读）——全部未触碰。未新增测试基础设施/fixture（新测试文件自含 fixture 与独立预言机）。

## Verification

| Command | Result | Evidence |
|---|---|---|
| 聚焦窗口家族 5 文件（实现前基线） | **114/114 绿** | 实跑（与 SA6 §4 逐位一致） |
| 聚焦 8 文件（契约/pins/新 T 组/守卫/type-guard.test-d/composition/lease/lease-surface.test-d）`--typecheck` | **8 文件 / 144 用例全绿；Type Errors: no errors**；exit 0 | `artifacts/sa3-issue381-focused-window-family.log` |
| `npx tsc -p packages/doc-runtime/tsconfig.json` | exit 0 | 同上日志 |
| `npx tsc -p packages/namespace-runtime/tsconfig.json` | exit 0 | 同上日志 |
| `npx tsc -p packages/namespace-registry/tsconfig.json` | exit 0 | 同上日志 |
| **SA6 T 组红基线**：HEAD `8a4fa40`（临时 worktree `.worktrees/sa3-red-head`）跑新 T 组 | **9 failed / 5 passed**，红因 = 成功结算 own 键集 `['ok','value']` 缺 `total`（T1/T2/T3/T4/T5/T6/T7/T8 红；T9 失败面负控绿 = 契约预期） | `artifacts/sa3-issue381-t-group-head-red.log` |
| **SA6 T 组绿**（当前实现） | **14/14 绿** | focused 日志 + T 组日志 |
| M1 P7 迁移 | pins 11/11 绿（迁移前唯一红 = P7，红因 = 新增键——与 SA6 E3 逐字一致） | focused 日志 |
| M2 类型锁 | `public-surface-type-guard.test-d.ts` 14 用例（`✓ TS`）绿；no type errors | focused 日志 |
| M4 零 diff 回归面 | `namespace-runtime/test` + `namespace-registry/test` + `namespace-registry/src` `git diff --stat` 空；composition 17/17 + lease 33/33 零改动全绿 | focused 日志 + `git diff` |
| 结构审计 X1 | `grep … packages/namespace-runtime/src/*.ts` = **0 命中** | structural-audit.log |
| 结构审计 X2 | `copied from window.ts@ab6e390` = **0**（≤1 达成）、`copied from carrier.ts@ab6e390` = **0**；`copied from` 在 window-read.ts 仅余 `read-schema-projection.ts@ab6e390 (foldSegment)` 合法出处 | structural-audit.log |
| 结构审计 X3（O-1 钉定作用域） | X3a 全目录 10 行命中（全部 `projection.ts`/`plain-data.ts`，Phase 3 #85 既有同名独立实现，本变更集零 diff）；X3b 镜像承载文件 = **0 命中** | structural-audit.log |
| 结构审计 X4 | `window-read.ts` 742 → **427 行**（−315；`+40/−355`）；无「保留但注释掉」；唯一保留件 `safePathCopy` 注文重述 | structural-audit.log |
| 结构审计 X5 | 现行契约描述无「W1 冻结纪律 / 镜像纪律 / S4 计数」存续陈述（宽口径命中逐行注解为否认句与 B-8 文法名） | structural-audit.log |
| 变异 A：`total := entries.length`（少算截断） | **5 failed / 9 passed**（T1/T3/T5/T4b/T8 红） | sensitivity-mutations.log |
| 变异 B：`total := candidates.length + 1`（错值） | **9 failed / 5 passed**（T1/T3/T4/T5/T6/T7/T8 红） | sensitivity-mutations.log |
| 变异 C：组合层 `truncated := kept < kept`（total 顶替） | **16 failed / 50**（lease A1/A2/A4、T 组、composition S3/S4/S5、E3）——与 SA6 §9-E2 逐位一致 | sensitivity-mutations.log |
| 变异还原 | 两文件还原后 `git diff --numstat` 与实现态一致；聚焦 T 组 14/14、回归面 50/50 复绿 | sensitivity-mutations.log |
| **全仓门 G1**：`pnpm typecheck` | **exit 0**（14 个 tsconfig 串行全过） | `artifacts/sa3-issue381-full-gate.log` |
| **全仓门 G2**：`pnpm test`（`vitest run --typecheck`） | 见下方「G2 结果」 | `artifacts/sa3-issue381-full-gate.log` |

### G2 结果

- `pnpm test`（`NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`）**exit 0**：
  **393 文件 / 4745 用例全绿**、`Type Errors: no errors`、耗时 626.05s。
- 与 SA6 §4 基线（392 文件 / 4730 用例）逐位对账：**+1 文件**（新 `issue-381-window-total-red.test.ts`）、
  **+15 用例**（新 T 组 14 + 类型锁新增 1 `it`）；无既有用例被删改计数（P7/B-5 为原位迁移）。
- 证据：`artifacts/sa3-issue381-full-gate.log`（G1 + G2 原始输出）。

## Deferred verification

- SA3 职责边界外、需 SA4/SA7 或后续票处理的验证：
  1. **SA4 活链路动态验证**：lease 面端到端（registry 装配 + 真实 persistence）逐字节不变的独立复核；本票仅以既有零 diff 契约测试族（50 用例）证明。
  2. **SA8 实现后冲突复查**：`requiresConflictRecheck: true`，输入 = 本报告 §「SA8 required action 1 自查」+ `artifacts/sa3-issue381-structural-audit.log`。
  3. **E4 对抗场景**：按契约登记为不判负边界（无断言、无新读路径）；若未来 Owner 要求立约需新契约票（设计 R-381-1 / SA8 §3-17）。
  4. **P2（where）票义务**：`total` 类型加宽 `number → number | undefined` + W1/S3 两层校验同步扩 + `truncated` 双语义 + ✂ 永不装配（ADR 0029 §5/§6；本票不预占，设计 §12 已登记）。
- 全文仓 `pnpm test`（G2）覆盖 AC5，不属 SA3 扩展职责，但本票按设计 G1/G2 明确指定执行（见上）。

## Deviations or blockers

- **无阻断项，无设计越界**。以下为实现期记录的非阻断事实（均已按 SA2 观察处置或如实注解）：
  1. **X3a 作用域含非镜像同名命中**（SA2 O-1 未预见）：`projection.ts`/`plain-data.ts` 自带 `isPlainRecord`/`readableOwnDataValue`/`readableArrayElement`（Phase 3 #85 既有，早于 W1 镜像）。处置：审计日志如实记录 X3a 原始输出 + X3b 镜像面 0 命中 + 两文件零 diff 证据；**未修改无关文件**（否则违反 DENY 与「不扩大范围」纪律）。
  2. **`window-read.ts` 保留了既有的未使用 import**（`renderProjectionText, resolveSchemaAtPath`，HEAD 即未使用）：非本票设计动作，保留以最小化 diff；删除属无关面 churn，留给后续清洁票。
  3. **`window-read.ts` 头注仍含「镜像」二字**（S3 `canonicalReadOptions` 纪律镜像、`read-schema-projection.ts` 折叠纪律镜像、保留件否认句）：均非 W1 冻结/镜像纪律面（设计 §5-D3 保留集与 X5 范围），已在审计日志逐行注解；未删除合法出处描述。
  4. **断言纪律自查**：新测试文件零 skip/only/todo、零 env override/fallback/吞错；`total` 期望全部由独立预言机（Yjs/native 直数）派生，无同构造器派生；未以源码字符串断言替代行为验证；未新建测试基础设施或 fixture 文件。

## Suggested commit message

```
refactor(#381): W1 冻结解除与 total 下沉——窗口原语三键结算，组合层收缩为纯组合（ADR 0029 §5/§8 P1）

- doc-runtime 窗口原语两面成功结算恰三键 {ok,value,total}；total = 候选标识计数
  （与 value 同一次 collectCandidates 枚举，零额外遍历/物化；本票无 where ⟹ 恒数值）
- namespace-runtime 组合层删 S4 计数与全部 W1 出处标记镜像（15 名目），
  收缩为 S3/S5/S6 且 total 单源直通消费；runtime 消费点传 windowResult.total
- 测试迁移：P7 两键→三键、公共入口三键类型锁、B-5 头注清账；
  新增 issue-381 T1–T9 独立预言机契约（边界矩阵/不变性/N=2000 零物化哨兵/失败面）
- 结构审计 X1–X5、红基线、变异敏感度与全仓门证据落 artifacts/sa3-issue381-*.log
- 冻结面保持：lease 恒四键与 ✂ 文法、read.ts 零 diff、零新公共值导出
```

（SA3 未执行 `git add` / `commit` / `push` / PR；提交与否由 Controller 裁决。）
