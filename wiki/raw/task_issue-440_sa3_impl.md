# SA3 Implementation Report — issue #440：vfsl 逐 entry 校验扩展（Record + 封闭对象 delete）与一致性 fixture 扩展（ADR 0034）

- 角色：SA3（TDD 实现执行者）｜iteration 0｜worktree `mabf/issue-440` @ HEAD `0a91f14`
- 输入契约：`wiki/raw/task_issue-440_sa6_contract.md`（approve：26 红契约 + 19 负控 + test-d + 117 例夹具）
- 设计：`wiki/raw/task_issue-440_design.md`（SA2 verdict = approve，无 BLOCKER/MAJOR）
- 冲突门：`wiki/raw/task_issue-440_design_conflict_report.md`（SA8 verdict = clear；R1/R2/R3/R4，R1 doc-only 归立法路径）
- 状态：**实现完成，红灯契约 26/26 转绿、负控 19/19 保持绿、test-d 类型红转绿；无阻塞项、无越界改动**

---

## Inputs consumed

| 输入 | 状态 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-440.md` | 在场 | 任务简报：What to build + AC1–AC6 + Blocked by #437；REST comments 空（无 owner 追加需求） |
| `wiki/raw/task_issue-440_design.md` | 在场 | 实施依据：§7.2 D1–D7、§8.1 判定管线、§8.2 全矩阵、§10 ALLOW/DENY、§12 验收映射 |
| `wiki/raw/task_issue-440_sa2_review.md` | 在场 | verdict approve；无 BLOCKER/MAJOR；3 条 MINOR（§「SA2 Finding 落实」） |
| `wiki/raw/task_issue-440_sa6_contract.md` | 在场 | 冻结验收面：§12.1 B-1…B-6、§12.2 A–F 组 26 例、§13 绿判据、§16 冻结产物 md5 |
| `wiki/raw/task_issue-440_sa6_capability_probe.mts` | 在场 | G1–G5 / REF / O1–O3 / NC1–NC2 诊断（只读，未修改） |
| `wiki/raw/task_issue-440_design_conflict_report.md` | 在场 | SA8 verdict clear；R2 = 仅 `validate-patch.ts` #440 节 + `index.ts` 导出 + 证据日志；R3 = 探针 G1 翻红口径；R4 = 实现期复查清单 |
| `packages/vfsl/test/issue-440-elementwise-entry-{contract,control}.test.ts`、`-fixture.ts`、`.test-d.ts` | 在场（冻结，md5 复核一致） | 红灯契约 / 恒绿负控 / 一致性夹具 / 类型契约 |
| `packages/vfsl/src/validate-patch.ts`、`validate.ts`、`derived.ts`、`resolve.ts`、`index.ts`、`packages/vfsl/AGENTS.md` | 在场 | 实现落点与包纪律（公共 API 只经 `src/index.ts`；同步/纯函数/不抛错；message/path/序是兼容行为） |

`task_issue-440_relevant_decisions.md` / `task_issue-440_conflict_report.md` 不存在（iteration 0）；SA8 预检职能由
`_design_conflict_report.md` §2/§3 兼采——不构成阻塞（SA6 §3 / 设计 §6 同口径）。

## Existing worktree reconciliation

- 起始态无 `wiki/raw/task_issue-440_sa3_impl.md`、无未提交实现改动；`git status` 仅含 SA6 落位的测试/fixture/探针/wiki 工件（untracked）与 `artifacts/sa6-issue440-*.log`。
- 由此**无待修订的旧实现**：本次为首次实现，纯加法落点。
- 冻结产物指纹在实现前后各复核一次，均与 SA6 §16 登记恒同：

| 冻结产物 | md5（实现后复算） | SA6 §16 登记 | 结果 |
|---|---|---|---|
| `issue-440-elementwise-entry-fixture.ts` | `ce86199a85f7787dcca529a87ff72408` | `ce86199a…` | 一致（未改） |
| `issue-440-elementwise-entry-contract.test.ts` | `a595c8ae4a2bd02cfcd1ed95375c514b` | `a595c8ae…` | 一致（未改） |
| `issue-440-elementwise-entry-control.test.ts` | `46829054dc02ff6e9d1f2b760b84bea6` | `46829054…` | 一致（未改） |
| `issue-440-elementwise-entry.test-d.ts` | `0fe31a97f9207ef183b4e5a04305b9d9` | `0fe31a97…` | 一致（未改） |
| `wiki/raw/task_issue-440_sa6_capability_probe.mts` | `0b5980411662eab9b8964f0f1283ad33` | `0b598041…` | 一致（未改） |

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/vfsl/src/validate-patch.ts` | §7.1 总形状、§7.2 D1–D4、§8.1、§10 ALLOW 行 1 | 文件头追加 issue #440 一句；在 #435 节后追加 #440 节（约 140 行）：类型导出 `EntryCarrierFacts` / `ElementwiseEntryMutationPayload`，私有助手 `judgeClosedObjectDelete`，公共接缝 `applyElementwiseEntryMutation`（闸门 ①–⑥ → 载体域事实守卫 → 载荷词表守卫 → record set / record delete / parent delete 分派；复用既有 `singleIssue` / `wrapElementwise` / `valueLens` / `walkRefChain` / `validateSubtree`） |
| `packages/vfsl/src/index.ts` | §7.2 D7、§10 ALLOW 行 2 | `validate-patch.js` 值导出块追加 `applyElementwiseEntryMutation`；类型导出块追加 `EntryCarrierFacts`、`ElementwiseEntryMutationPayload`；#435 注释块后追加 #440 注释行 |
| `artifacts/sa3-issue440-focused.log` | §10 ALLOW 行 3 | 聚焦门证据（契约 + 负控） |
| `artifacts/sa3-issue440-vfsl-typecheck.log` | §10 ALLOW 行 3 | 包 tsc 证据 |
| `artifacts/sa3-issue440-root-typecheck.log` | §10 ALLOW 行 3 | 根 `pnpm typecheck` 证据 |
| `artifacts/sa3-issue440-root-test.log` | §10 ALLOW 行 3 | 根 `pnpm test` 证据 |
| `artifacts/sa3-issue440-probe-post.log` | §10 ALLOW 行 3 | 探针实现后复跑留档（G1 翻红口径，见「Deferred verification」） |
| `wiki/raw/task_issue-440_sa3_impl.md` | 技能规定的角色产物 | 本报告 |

**生产代码净变化**：`git diff --stat` = 2 files changed, 151 insertions(+), 0 deletions（纯加法：既有 23 运行时导出、
`applyElementwiseArrayMutation` 签名面、`planMutationBoundary` / `applyMutationAtBoundary` / `validateSubtree` /
`validate.ts` 全部零改动）。

## SA2 Finding 落实

SA2 verdict = **approve**，§13 Required revisions = **无 BLOCKER / 无 MAJOR**；3 条 Non-blocking observations 处理如下：

| Finding ID | 类型 | Implementation | Result |
|---|---|---|---|
| MINOR 1：探针 G1.1/G1.2 实现后必然翻红 vs SA6 §13 字面「探针 exit 0」 | 口径 | 不修改冻结探针；实现后复跑留档（`artifacts/sa3-issue440-probe-post.log`），在「Deferred verification」按设计 §12 末行 + §13 残余 1 + SA8 §8 R3 口径登记：G1 翻红 = 缺口正向闭合，权威绿判据 = 契约 26/26 + 负控 19/19 + test-d 转绿 + 根 gates | 已落实（探针 25/27 ok，唯 G1.1/G1.2 红，其余 G2–G5/REF/O1–O3/NC1–NC2 全绿） |
| MINOR 2：两处域规则文案（no-op / 必填缺失）字面复用；可选优化 = 提取模块级常量供新旧两支共用 | 可选优化 | **未采纳**。理由：设计 §7.2 D3/D4 只要求「逐字同源」；提取常量须改动 legacy `applyMutationAtBoundary` 两支（`validate-patch.ts:941-981`）——属行为中性的重构，却在冻结面（负控 NC1 锚定的 legacy 轨）上扩大 diff；漂移风险已由双锚覆盖（NC1.3/NC1.4 常量锚 + E1 oracle 逐字节比较），且本实现两条新面文案与 `validate-patch.ts:974`、`validate.ts:680` 逐字节一致 | 已记录理由；实现后 NC1 19/19 保持绿、E1 107/107 逐字节一致 |
| MINOR 3：闸门 message①–⑥ 为新面文案（SA6 §15.3 明示不冻结） | 文案 | 原样采用设计 §8.1 给出的建议文案（家族风格对齐数组接缝）；仅受「`ok:false` ∧ 带 issue ∧ 不抛」约束 | 已落实（F1–F3 全绿） |

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/vfsl/src/validate-patch.ts` | 设计 §10 ALLOW 行 1（「在 #435 节后追加 #440 节：类型 + 接缝实现（复用 `singleIssue`/`wrapElementwise`/`valueLens`）；文件头注释追加 issue #440 一句」） | 接缝本体 |
| `packages/vfsl/src/index.ts` | 设计 §10 ALLOW 行 2（「既有 `validate-patch.js` 导出块追加 3 名 + 注释」） | 公共入口（AC5） |
| `artifacts/sa3-issue440-*.log`（5 件） | 设计 §10 ALLOW 行 3（「实现角色的聚焦/根 gates 证据日志」） | 验证证据 |
| `wiki/raw/task_issue-440_sa3_impl.md` | SA3 技能规定的角色产物（不在 DENY LIST） | 本报告 |

**DENY LIST 核对（逐项零改动）**：四个 SA6 冻结测试文件 + 探针 + SA6 报告（md5 恒同，上表）；
`packages/vfsl/src/validate.ts`、`derived.ts`、`resolve.ts`、`pattern.ts`（`git diff` 空）；
`packages/vfsl/test/issue-435-*`（`git status` 无条目）；`packages/doc-runtime/**`、`packages/namespace-runtime/**`；
`docs/adr/**`、`CONTEXT.md`、`docs/vfsl/**`。ALLOW LIST 未被自行扩大。

## Verification

| Command | Result | Evidence |
|---|---|---|
| 红契约基线（实现前）：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/vfsl/test/issue-440-elementwise-entry-{contract,control}.test.ts` | **26 failed / 19 passed**（26 条全为 `Error: 能力缺口：@nomicore/vfsl 公共入口未导出 applyElementwiseEntryMutation`，零其它错误类型） | 本会话实现前运行；与 SA6 §13 登记逐字一致 |
| 红契约转绿（实现后，同一命令） | **2 files passed / 45 tests passed（契约 26 + 负控 19）/ Type Errors: no errors / exit 0** | `artifacts/sa3-issue440-focused.log`（`FOCUSED_EXIT:0`） |
| 受影响包 typecheck：`pnpm exec tsc -p packages/vfsl/tsconfig.json --noEmit` | **exit 0**（零报错）。实现前红面由 SA6 登记于 `artifacts/sa6-issue440-post-vfsl-typecheck.log`（test-d：TS2724×3 缺导出 + 下游 TS2349 + TS2578×3 负面夹具未命中；该日志另含 1 条 control 行号态 TS2345，未复现于 §16 登记 md5 的冻结修订）——本命令实现后零报错 | `artifacts/sa3-issue440-vfsl-typecheck.log`（`VFSL_TSC_EXIT:0`，仅一行 exit 标记 = 无任何 `error TS`） |
| 根 `pnpm typecheck`（15 包 `&&` 链） | **exit 0**（不再停在 vfsl 包） | `artifacts/sa3-issue440-root-typecheck.log`（`ROOT_TYPECHECK_EXIT:0`） |
| 根 `pnpm test`（`vitest run --typecheck`） | **469 files passed / 5712 tests passed / Type Errors: no errors / exit 0**（零 skip/only/todo；基线 466/5667 + 本票 45 tests = 469 files / 5712 tests，零第 4 方回归；L623 契约 26 tests ✓、L637 负控 19 tests ✓、L10 test-d 经 `--typecheck` 收集） | `artifacts/sa3-issue440-root-test.log`（`ROOT_TEST_EXIT:0`） |
| 探针实现后复跑：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-440_sa6_capability_probe.mts` | **exit 1**：25/27 ok；唯 G1.1/G1.2 红（该两项断言导出**缺席**——缺口正向闭合的预期结果，设计 §12 末行 + §13 残余 1 + SA8 R3 口径）；`/elementwise/i` 命中由 1 → 2、运行时导出由 23 → 24、NC2.2（23 既有导出超集）仍绿 | `artifacts/sa3-issue440-probe-post.log` |

**红灯 → 绿灯判据**：SA6 §13「绿色判据」逐条命中——契约 26/26、负控 19/19、test-d 类型红转绿、
根 `pnpm typecheck` exit 0、根 `pnpm test` 全绿；唯一字面例外（探针 exit 0）按设计/SA8 已立法的口径解释（见上）。

## Deferred verification

1. **探针 G1.1/G1.2 的翻红口径（MINOR 1 / SA8 R3）**：探针断言的是 HEAD 态**缺口缺席**，实现后必然翻红；
   按设计 §12 末行 + §13 残余 1 + SA8 §8 R3，权威绿判据 = 契约 + 负控 + test-d + 根 gates。冻结探针未修改。
2. **SA8 R1（`docs/adr/0007` 「ADR 0034 修订注记」）**：doc-only、归属立法路径（SA3 无权改 ADR/DENY LIST），
   硬性时点 = 随 #441 行为翻转前落地。本票实现不改变任何管线运行时行为（doc-runtime record/parent 仍走 legacy
   全量轨），故本票落地后代码与 ADR 0007 现行措辞仍逐字一致——不构成本票阻塞。
3. **#441 / #442 范围**：doc-runtime 按闸门分流接线、S9/E201/charge 收窄、10⁵ entry 基准（#441）；
   lease 端到端用户可见行为钉正（#442）。本票只钉 vfsl 接缝语义面 + 输入面（只收 `{has}`）。
4. **性能软验收**（ADR 0034 决策 6）：本票只提供结构面证据（接缝输入不含其他 entry / 父值），绝对耗时基准归 #441。

## Deviations or blockers

- **无阻塞项**，无设计冲突，无红灯契约矛盾。
- 实现严格遵循设计 §8.1 管线次序与 §7.2 D1–D4 判定语义；SA6 §12.1 B-1…B-4 名目/形状/返回逐字一致
  （`applyElementwiseEntryMutation` / `EntryCarrierFacts = { readonly has: boolean }` /
  `ElementwiseEntryMutationPayload = { op:'set'; value } | { op:'delete' }` / 返回 `ValidateResult` 直出）。
- **设计未强制、实现自决的一处细节**：载体域事实与载荷经**敌意通道**语义读取
  （`(facts as { has?: unknown } | null | undefined)?.has` / `(payload as {...} | null | undefined)?.op`），
  使 `{}` / `null` / 畸形 facts 与 array-* 载荷经由设计 §8.1 ②③ 的守卫**响亮拒绝**（而非落 E100）。
  与包纪律「畸形输入走判别联合」一致，行为面与设计 §8.1 ②③ 完全相容；冻结断言未覆盖该形状，无契约影响。
- **SA2 MINOR 2（可选常量提取）未采纳**，理由见「SA2 Finding 落实」。
- 未运行 git add/commit/push，未创建 PR，未修改任何 SA6 冻结产物。

## Suggested commit message

```
feat(vfsl): Record 与封闭对象 delete 逐 entry 校验接缝（#440 / ADR 0034）

新增 `applyElementwiseEntryMutation(derived, plan, facts, payload)` 公共接缝：
在「schema 静态事实 + 目标键位在场性 O(1) 事实（{has}）+ 新值」上结算非 union
Record 位 set/delete 与封闭对象字段 delete，不消费整 map / 父对象提取值。

- Record set：键 Pattern + 新值过值 schema（单 entry 视图过共享解释器；旧值不读），
  issue 路径 rebase 为 [...mapPath, key, ...值内路径]（与全量路径逐字节兼容）
- Record delete：仅在场/no-op 域规则；不查键 Pattern、不触碰其他 entry
- 封闭对象 delete：静态必填判定（optional ∨ unknown 标量 → 允；否则
  `缺少必填字段 "<key>"`；has=false → no-op 拒绝），不读父值
- 闸门四条件 + 事实/载荷守卫 fail closed；union map 位永久走 legacy 轨
- 返回 ValidateResult 直出（无 proposedBoundary，ADR 0034 决策 3）

新增导出：applyElementwiseEntryMutation（值）、EntryCarrierFacts /
ElementwiseEntryMutationPayload（类型）。既有 23 运行时导出与 #435 数组接缝
签名面逐字节不变。

验证：SA6 契约 26/26、负控 19/19、test-d 转绿、包 tsc exit 0、根 typecheck
exit 0、根 test 全绿。
```
