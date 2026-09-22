# SA3 Implementation Report

- Task: issue #441 — doc-runtime：Record/parent fast path 接线与 S9 收窄（ADR 0034）
- Branch / HEAD: `mabf/issue-441` @ `3fd6aa8b659420fd63d07b051139fe5f279556b8`（= 设计/SA6/SA2/SA8 声明 HEAD；`git rev-parse` 核对一致）
- Status: 实现完成，聚焦契约 18 红 → 18 绿；负控 27/27 保持绿；包 tsc / 根 `pnpm typecheck` / 根 `pnpm test` 全绿。
- 无 Owner 评论要求（Host 明文 REST comment read 为空；与设计 §4 / SA6 §2 / SA2 §4 / SA8 报告一致）。

## Inputs consumed

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-441.md`（任务简报，AC1–AC6，comments 空） | 已读 |
| `wiki/raw/task_issue-441_design.md`（SA1 **iteration 1**，683 行；含 §7.6 ADR-0007 注记计划、§11 ALLOW/DENY、§12 判据 1–6、§12.1 探针 12+37 分类） | 已读（全文） |
| `wiki/raw/task_issue-441_sa6_contract.md`（approved 验收契约：18 红 + 27 负控 + 49 项探针；§12.1 绑定点 B-1..B-6） | 已读（全文） |
| `wiki/raw/task_issue-441_sa2_review.md`（**approve**；F-SA2-1/F-SA2-2 关闭；§14 N1–N4/O-1..O-3） | 已读（全文） |
| `wiki/raw/task_issue-441_design_conflict_report.md`（SA8 **clear**，唯一 evolution-required 项 = ADR-0007 注记；§8 Required actions 1–3；`requiresConflictRecheck: true`） | 已读（全文） |
| 冻结验收面：`issue-441-record-fastpath-{contract,control,fixture}` + `task_issue-441_sa6_capability_probe.mts` | 已读（只读消费，零修改） |
| 源码锚点：`mutation-local.ts`（record/parent 分支 + #436 数组闸门先例）、`mutation.ts`（模块头 / `composeBatchVerify` / `commitPrepared`）、`install-verify.ts`（`VerifyPlan` / `verifyBoundaryInstallFacts`）、`validate-patch.ts`（`planMutationBoundary` L742–825 + 接缝 `applyElementwiseEntryMutation` L1219–1289 + `judgeClosedObjectDelete` L1178–1195）、`extract.ts`（`carrierMismatchIssue`）、`resolve.ts`、`detached-build.ts` 消费面 | 已读（逐锚点对齐） |
| `docs/adr/0007-*.md`（issue #237 节 L62–124 + 0033 注记 L126–140）、`docs/adr/0034-*.md`、`docs/AGENTS.md` 义务句 | 已读 |
| `_relevant_decisions.md` / 前置 `_conflict_report.md` | 不存在（与设计 §6 声明一致；SA8 约束面由设计后冲突报告承担） |

## Existing worktree reconciliation

- 本票**无既有** `wiki/raw/task_issue-441_sa3_impl.md`、无未提交实现改动可继承：实施前 `git status` 仅 SA6 未跟踪证据工件（契约三件套 / 探针 / 报告 / `artifacts/sa6-*`），`packages/*/src` 与 `docs/**` 零改动 ⇒ 本轮为**全新实现**，无过时/冲突改动需修正或删除。
- 实施后变更面恰 3 个 tracked 文件（全部命中设计 §11 ALLOW）；冻结 SA6 面（契约/负控/夹具/探针）mtime 18:04–18:10 早于本轮源码改动 mtime 19:08–19:09，证明零触碰。

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/doc-runtime/src/mutation-local.ts` | §7.1–§7.3（闸门 + F1–F5）、§7.5（S9 收窄）、§8（import 面）、模块头注释 | `case 'parent': case 'record':` 内 `navigateHops` 之后插入闸门 `plan.node.kind === 'object' ∧ resolve(boundaryNode).kind === 'map'`；命中走 fast path：F1 `carrierMismatchIssue([], 'Y.Map', boundaryLive)`（逐字复刻 legacy S5 首错）→ F2 `parentMap.has(key)`（O(1)）→ F3 `applyElementwiseEntryMutation(derived, plan, {has}, payload)`（接缝，零写入）→ F4 `descendStructureNode` + `buildDetachedValue`（仅 set）→ F5 返回 `verify: { kind: 'install-facts', facts }`；未命中的 legacy 代码逐字保留。新增 import `applyElementwiseEntryMutation` + 类型 `EntryCarrierFacts` / `ElementwiseEntryMutationPayload`；模块头追加 issue #441 / ADR 0034 双轨段（镜像 #436 段） |
| `packages/doc-runtime/src/mutation.ts` | §7.5 批量面、§10 调用方影响矩阵、§11 ALLOW（**注释-only**） | 模块头 S9 描述句补记 record/parent fast path（ADR 0034 决策 3）；`composeBatchVerify` 折迭跳过注释由「install-facts 仅数组项」泛化为「数组项 + record/parent 项」，并补记 record/parent fast 项 prefix 可为 map 位时的正确性依据（E5 批内非嵌套 ⇒ 兄弟写不同键，不破坏该项自身安装事实）。**零语句变化**（`git diff` 仅注释行） |
| `docs/adr/0007-logical-validation-and-yjs-runtime-bridge.md` | §7.6（F-SA2-2 / SA8 evolution-required）、§11 ALLOW（有界追加式） | 在 issue #237 修订节末尾、紧随既有「ADR 0033 修订注记（2026-09-22）」之后追加同级 `### ADR 0034 修订注记（2026-09-22）`：授权链段落 + 引用块（条款 1 投影/重建句、条款 4(ii)「Record 位」「delete 的父 map 位」字面 → 逐 entry/静态校验 + 触达面「map/父载体本身 + 目标键位」；条款 7 成本句 → O(新值)/O(1)；union 容器目标/union 穿越/其余边界种类逐字保持；条款 4(i) 不受影响；ADR-0010 后备句同步处置）。**追加式，既有 140 行零改写**（`git diff` 纯 `+19`） |

## SA2 Finding落实

| Finding ID | Implementation | Result |
|---|---|---|
| F-SA2-1（MAJOR，探针判据） | 实现后判据严格采用设计 §12 枚举 1–5（聚焦 45/45、包 tsc、根 typecheck、根 test、注记同变更集），**探针不参与绿判据**；复跑探针仅作 §12.1 一次性确认信号：`exit 1` 且失败集合经脚本比对**恰为** 12 项命名子集（`G1a/G1a2/G1b/G1c/G1d/G1e/G1f/G1g/G1i/G4a/G4b/G4c`，`diff` 为空）；探针文件零修改（sha256 `6030e0b8a31a45cdea781fb108218cb613c69e3fd9f7002d3153d6f8e597c1f9`，mtime 18:08 早于本轮改动） | 落实（不修改探针、不据探针保绿） |
| F-SA2-2（MAJOR，规范文档矛盾） | 采选项 (a)：ADR-0007 有界追加式注记与 fast path 实现在**同一未提交变更集**内（`git status` 三文件同批；注记 diff 与源码 diff 均在 `git diff` 面内可核） | 落实 |
| SA8 evolution-required（ADR-0007 #237 节条款 1/4(ii)/7 Record/父位字面） | 按设计 §7.6 建议文案落地注记（授权链 / 新旧语义 / 不变面明示 / 同变更集） | 落实（文本一致性复查移交 SA8——见 Deferred） |
| SA8 Required action 1（同变更集纪律） | 注记与实现同批未提交，无次序分离（同一 worktree 变更集） | 落实 |
| SA8 Required action 2（实现后复查清单 ①②） | §12 判据 1–5 全过；注记最终文案 = 设计 §7.6 建议文案逐字；ADR-0010 零改动、ADR 0033 注记零改写 | 移交 SA8（`requiresConflictRecheck: true`） |
| SA8 Required action 3（ADR 0026 引文更正） | 实现不依赖该引文；批量正确性论证改引 ADR 0026 实条款面（批内路径互不嵌套 / 单键最小 edit），注释仅陈述机制 | 落实（无代码影响） |
| SA2 §14 N1（注记落地文本核对） | 注记 = §7.6 建议文案逐字（含日期 2026-09-22 与授权链） | 移交 SA8 |
| SA2 §14 N2（0033 注记作用域层层叠） | 0033 注记 L137–139 未改写（追加式纪律）；新注记明示的保持面 = union 容器目标 + union 穿越 + 其余边界种类 = 0033 枚举差额恰为本次修订的两类边界 | 落实（复核移交 SA8） |
| SA2 §14 N3（G1h 证据语义变化） | 探针 G1h 实现后保持 PASS（断言面仅 `ok===false`，经 F3 静态必填判定 `缺少必填字段 "req"`）。本轮探针失败集**不含 G1h**，与 §12.1 更正一致 | 落实 |
| SA2 §14 N4（行号微漂移） | 实现按符号名定位（`applyElementwiseEntryMutation` / `carrierMismatchIssue` / `descendStructureNode`），未依赖行号 | 落实 |
| SA2 O-1 / O-2 / O-3（非阻塞残余观察） | 无实现变更需求：O-1 采用 ADR 决策字面谓词 `Y.Map.has`（忠实母法）；O-2 与 #436 数组轨同形的已确认收窄面；O-3 接缝（#440 冻结面）fail-closed 行为不变 | 按设计 §13 登记，非本票义务 |

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/doc-runtime/src/mutation-local.ts` | §11 ALLOW 第 1 行 | 本票唯一行为改造点：闸门 + fast path F1–F5 + 模块头 ADR 0034 段 + 接缝 import |
| `packages/doc-runtime/src/mutation.ts` | §11 ALLOW 第 2 行（**注释-only**） | 消除实现后失实的规范性注释（L7 / `composeBatchVerify` 折迭跳过注释）；`git diff` 证实零语句变化 |
| `docs/adr/0007-logical-validation-and-yjs-runtime-bridge.md` | §11 ALLOW 第 3 行（有界、追加式） | 规范契约变化的唯一文档落点（SA8 §2 扫描）；`+19` 行、既有条款零改写 |
| `wiki/raw/task_issue-441_sa3_impl.md` | §11 ALLOW 第 4 行 / 技能固定产物 | 本实现报告 |
| `artifacts/sa3-issue441-*.{log,txt}` | 证据工件（非源码/非规范面；与 SA6 `artifacts/sa6-*` 同类） | 命令原始输出与比对证据 |

**DENY 核对（零改动，`git status --short -- <DENY paths>` 为空）**：`packages/vfsl/**`（含 `validate-patch.ts`）、`packages/doc-runtime/src/install-verify.ts`、`packages/doc-runtime/src/index.ts`、契约三件套与探针、`packages/doc-runtime/test/**` 其余既有测试、`docs/adr/0033-*.md`、`docs/adr/0034-*.md`、`docs/adr/0010-*.md`、`CONTEXT.md`、其余 `docs/**`、`packages/**` 其余、`apps/**`、`domains/**`。零新增公共导出（`public-surface-guard.test.ts` 绿）。

## Verification

| Command | Result | Evidence |
|---|---|---|
| `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/doc-runtime/test/issue-441-record-fastpath-contract.test.ts packages/doc-runtime/test/issue-441-record-fastpath-control.test.ts`（**实现前红灯基线**） | **18 failed / 27 passed（45）**，Type Errors: no errors，exit 1（与 SA6 §13 冻结红灯面一致） | 本报告 §TDD 步骤；SA6 `artifacts/sa6-issue441-focused.log` 同值 |
| 同命令（**实现后**，§12 判据 1） | **45/45 passed**（契约 18 + 负控 27），Type Errors: no errors，exit 0 | `artifacts/sa3-issue441-focused.log`（末行 `FOCUSED_EXIT=0`） |
| `npx tsc -p packages/doc-runtime/tsconfig.json`（判据 2） | exit 0 | 命令输出 `PKG_TSC_EXIT=0` |
| `pnpm typecheck`（判据 3） | exit 0（15 包 tsconfig 全过） | `artifacts/sa3-issue441-root-typecheck.log`（`ROOT_TYPECHECK_EXIT=0`） |
| `pnpm test`（判据 4） | **471 files passed (471) / 5757 tests passed (5757)**，Type Errors: no errors，exit 0 | `artifacts/sa3-issue441-root-test.log`（`ROOT_TEST_EXIT=0`；含 `issue-441-record-fastpath-contract.test.ts (18 tests)` 与 `-control.test.ts (27 tests)` 双绿行） |
| 判据 5：注记与实现同变更集 | 通过：`git status --short` 同批 3 个 tracked 文件（src ×2 + ADR-0007）；`artifacts/sa3-issue441-changed-paths.txt` / `-adr0007-diff.txt` / `-mutation-local-diff.txt` | `git diff --check` 无输出（无空白错误） |
| 判据 6（非绿判据，§12.1 一次性确认信号）：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-441_sa6_capability_probe.mts` | **exit 1；`checks=49 failures=12`**，失败集经比对**恰为** §12.1 命名 12 项（`diff` 为空 ⇒ `EXACT_MATCH`） | `artifacts/sa3-issue441-probe-post-impl.log` / `-probe-flipset-check.txt` |
| 冻结面零修改核对 | 探针 sha256 `6030e0b8…97c1f9`；契约/负控/夹具 mtime 18:04–18:10 早于本轮 src 改动 19:08–19:09 | `git status --short`（4 文件仍为 SA6 原始 untracked）+ 上文 hash/mtime |

TDD 步骤与红→绿：① 读冻结契约 → ② 跑红灯基线（18F/27P，确认红因 = 能力缺口）→ ③ 实现闸门 + F1–F5 → ④ 跑聚焦对（45/45 绿）→ ⑤ 注释刷新 + 注记追加 → ⑥ 复跑聚焦对（45/45 绿，`FOCUSED_EXIT=0`）→ ⑦ 包 tsc / 根 typecheck / 根 test / 探针确认信号。

**AC2 观察确认（探针报告值，非判据；`artifacts/sa3-issue441-probe-post-impl.log`）**：

| 探针 check | 实现前（SA6 §5.3） | 实现后（本轮） | 判定 |
|---|---|---|---|
| G3 Record set 值读/在场性读 | n=512 → 2049/0；n=4096 → 16385/0 | n=512 → **1/1**；n=4096 → **1/1** | O(1) 且与 n 解耦 |
| G3 Record delete 值读/在场性读 | n=512 → 2046/1；n=4096 → 16382/1 | n=512 → **0/2**；n=4096 → **0/2** | O(1) 且与 n 解耦 |
| G3 封闭对象 delete 父值读/在场性读 | 4 字段 → 8/1；14 字段 → 28/1 | 4 字段 → **0/2**；14 字段 → **0/2** | O(1) 且与字段数解耦 |
| G3c 软时序（单键 Record set） | n=10³ 12 ms vs n=10⁵ 1115 ms | n=10³ **0 ms** vs n=10⁵ **1 ms** | 与 n 解耦（软证据，无阈值断言语义） |
| G1k/G1l 触达面内载体位 | 响亮拒绝、path `[]`、0 update | **PASS（逐字同文案同 path）** | F1 复刻成立 |
| G4d union map 位 touch-面外篡改 | E201-C（legacy 双核） | **PASS E201-C** | legacy 轨不变 |
| G4e/G4f/G4g 目标键位篡改 | E201-C（安装事实核） | **PASS E201-C** | 事实核保留（两轨共享） |
| G5a–G5k 域规则/零写入/字节 oracle/复制面/批量单 update | 全绿 | **全绿（逐字同值）** | AC3/AC4 无回归 |

## Deferred verification

- **SA4 / SA7 的最终动态验证与全量与真实环境裁决**：非 SA3 职责（技能边界）。本报告只提供 SA6 指定红灯契约、受影响包 typecheck 与设计指定静态 check 的结果。
- **ADR-0007 注记文本一致性 + 同变更集 git diff 的规范面复查**：设计 §15 ①② / SA8 §8 action 2 / SA2 §14 N1 已登记为 `requiresConflictRecheck: true`，由 SA8 实现后复查承担。SA3 已保证落地文本 = 设计 §7.6 建议文案逐字、追加式零改写、与实现同批。
- **实现后目标行为探针（如需）**：设计 §12.1 要求**另行命名**的新探针文件并经 Controller/SA6 路由；SA3 未创建、未修改旧探针。
- **G1h 证据语义变化**（拒绝理由由 S5 父值载体错位变为 F3 静态必填判定，断言面不变）：设计 §12.1 / SA2 §14 N3 明示 SA4/SA7 不应计入预期失败集——本报告复述该口径。
- SA2 O-1/O-2/O-3 残余观察、ADR 0034 后果节 follow-up（触达面外污染异步审计、被删 entry 前像捕获、union 穿越 E204 观察 E8）：均非本票义务，未实现。

## Deviations or blockers

- **无 blocker、无 DENY 越界、无验收语义改动**：未修改 SA6 契约三件套/探针，未添加 skip/only/todo，未引入 env override / fallback / 吞错 / 伪成功，未新增公共导出，未改 `install-verify.ts` / vfsl / `index.ts`。
- **无实质设计偏离**。实现按设计 §7.2 闸门双条件合取与 §7.3 F1–F5 逐步落地；`mutation.ts` 严格注释-only；注记 = §7.6 建议文案逐字（未增删语义句）。
- 实现细节澄清（设计内自由形，非偏离）：
  1. F3 载体域事实以显式类型 `const entryFacts: EntryCarrierFacts = { has }` 传入接缝（对应设计 §8「新增 import 类型 `EntryCarrierFacts`」），语义与字面量 `{has}` 等价；
  2. 闸门处 `resolve(boundaryNode)` 与 legacy `walk` 内 resolve 处于同一 `prepareLocalMutation` 调用栈、同一顶层 catch（`prepareMutation` → E204），与设计 §7.2「同 try/同 catch/同分类」一致；
  3. `mutation.ts` 折迭跳过注释补记了 record/parent fast 项 prefix 可为 map 位时的正确性依据（设计 §7.5 要求「仅刷新注释」，此处为注释内容按 E5 非嵌套论证的具体化，零代码变化）。
- 环境：全部命令用本仓既有 runner（vitest 3.2.7 / tsc 5.9.3 / tsx，`NODE_OPTIONS=--conditions=nomicore-source`），零网络、零新增依赖。

## Suggested commit message

```
feat(doc-runtime): wire Record/parent elementwise fast path and narrow S9 (#441)

ADR 0034 decision 1/2/3/4 consumption: split the mutation-local
`case 'parent' | 'record'` branch into a permanent dual track. Non-union
Record positions and closed-object deletes take the fast path — F1 carrier
check (O(1), byte-identical copy of the legacy S5 first error), F2 target-key
presence via `Y.Map.has` (O(1)), F3 domain rules through the #440 vfsl seam
`applyElementwiseEntryMutation` (key Pattern + new-value schema, old value
never read; delete = no-op guard / static required-field judgement), F4
detached construction reused from S7, F5 narrowed `install-facts` verify plan
(no boundary reprojection). union map positions, union crossings and
hand-built two-tree divergence keep the legacy full boundary path verbatim
(dual track is permanent); commit shape stays a single-key minimal edit.

Also refresh the now-stale `composeBatchVerify` comments (comment-only) and
append the bounded ADR 0034 revision note to the ADR-0007 issue #237 section
in the same change set (amend prior decisions explicitly; same-PR discipline
per docs/AGENTS.md).

Verification: focused SA6 contract 18/18 green + negative controls 27/27
(45/45); `tsc -p packages/doc-runtime/tsconfig.json` exit 0; root
`pnpm typecheck` exit 0; root `pnpm test` 471 files / 5757 tests green,
Type Errors: no errors.
```
