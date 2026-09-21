# SA8 实现后冲突复审 — issue #412（iteration-3 CI-repair 证据集空白归零后的 commit 前门禁）

- 复审对象：**implementation**——**已空白归零（whitespace-normalized）的保留 iteration-3 CI-repair 验证证据产物**（commit 前）：8 份工作区日志 `artifacts/sa3-issue412-iter3-{ci-failure-evidence,smoke-red-proof,shard6-node24,persistence-contract,shutdown-tests,root-typecheck,generate-check,app-suite}.log` 的清整后形态 + 披露该清整的 SA3 报告原位更新（iteration 5 清整记录）+ Controller 已 staged 的 2 份 SA 记录——对照 ADR 全集、CONTEXT.md、规范协议/集成文档、模块 AGENTS、CI 门禁定义、交付面惯例（.gitignore / .editorconfig / artifacts 入库先例 / Controller 在案声明集）与 issue #412 停机耐久约束
- 仓库 / worktree：`/home/wangjian/nomicore-fix-issue-412`（分支 `mabf/issue-412`，HEAD = `2c3a486`；`git status` = 8 份 `AM`（索引自 HEAD 新增 + 工作区空白归零）+ 本报告与 SA3 报告的原位更新 + Controller staged 的 SA4 记录，产品/测试/文档树对 HEAD 零 diff）
- SA8 dispatch：`sa-f55b3c61-ec2c-41af-9be5-2df646cf0478`（phase: conflict-gate，iteration 6）；dispatch 问题域 = 「已空白归零的保留 iteration-3 CI-repair 证据产物 commit 前的 ADR / 规范 / 交付策略冲突核查 + 确认 issue #412 停机耐久约束保持」+ Owner comment `5751613018`（updated `2026-09-20T18:03:36Z`）的硬 drain-before-dispose 与 ADR 对齐须保持
- **原位更新说明**：本文件前身各轮（iteration 0 #412 主体实现 / iteration 1 codegen / iteration 4 收纳裁决 → 均已 clear 闭合）结论不在此堆叠；本报告只裁决**当前被审对象** = iteration-5 清整轮（SA3 dispatch `sa-dd43d106`，只归零 `git diff --cached --check` 报出的 14 处空白缺陷）之后的出口态。本轮 SA8 全部事实为独立只读复核，不采信 SA3 报告自述（去空白哈希、行数、`--check` 结果、锚点行均自行重测）。

---

## 1. Reviewed subject

**implementation（commit 前证据集门禁——空白归零后形态）**——iteration-5 清整轮对 Controller 已 `git add` 的 8 份保留日志做的**仅空白**修改（14 处被报缺陷：8 处行尾空白〔`ci-failure-evidence.log` 7 处 CI 摘录空行时间戳行 + `smoke-red-proof.log` 1 处 vitest 代码帧空源码行〕+ 6 处 EOF 空行），以及披露该清整的 SA3 报告 iteration-5 记录：

| 类别 | 内容 | 状态 |
| --- | --- | --- |
| 清整·工作区 | 8 份保留日志的归零后形态（合计 −14 bytes；6 份 −1 行、2 份行数不变） | 逐份独立重测（见 §3 R5） |
| 披露·报告 | `wiki/raw/task_issue-412_sa3_impl.md` 迭代 5 清整记录（被报缺陷逐处表、索引/工作区哈希对照表、清整后验证表、Controller 侧重 stage 指引） | 工作区 `MM`（staged 半 = iteration-4 记录） |
| 并行·SA 记录 | Controller 已 staged 的 `..._sa4_review.md`（Part D 收纳面审查 approve）+ 本轮并行落位的 Part E 空白归零审查（dispatch `sa-77c6a88d`，12:34 落盘，结论 approve，其 E-O1 与本报告行动 1 同判：提交前须重新 stage） | 非 SA8 被审对象本体；其结论与本报告独立复核互洽 |
| 不变 | 产品/测试/文档树（`packages/**`、`apps/**`、`docs/**`、`.github/**`、`domains/**`、`scripts/**`）对 HEAD 零 diff；#412 全部冻结锚对 `d60760c` 逐字节一致 | `git diff` 实测为空 |

与前一轮（iteration 5 复审）的对象差异：新一轮引入的**唯一**事实增量 = 8 份日志的空白归零 + 其披露记录；文件集合成员零变化（无增删）。

## 2. Inputs and decision set

| 输入 | 状态 | 说明 |
| --- | --- | --- |
| 被审对象（工作区出口态） | 已全量独立核对 | `git status --porcelain -uall`（8 `AM` + 3 wiki）；8 份日志逐份做索引 blob ↔ 工作区的去空白哈希对照（8/8 MATCH，值与 SA3 披露表逐份相同）；行尾空白 grep 零命中；`tail -c 2` 均「非换行字符 + `\n`」 |
| **清整的触发面（Controller 卫生门）** | 已独立复现 | `git diff --cached --check` 对**索引现存 blob**（清整前）报出恰 14 处（6 EOF 空行 + 8 行尾空白），逐行与 SA3 报告被报缺陷表一致；对**工作区归零后内容**同规则 `git diff --no-index --check /dev/null <逐份>` 8/8 静默 |
| `.editorconfig`（交付面策略文本） | 已现读 | `[*]`：`trim_trailing_whitespace = true`、`insert_final_newline = true`、`end_of_line = lf`——归零后形态**符合**该策略（清整前 staged blob 违反之）；CI（`.github/workflows/ci.yml`）无空白门，清整目标是本地卫生门而非 CI 门 |
| **Issue #412 + Owner comment 5751613018** | 已独立重拉（`gh api repos/nomicore-ai/nomicore/issues/comments/5751613018`；id=5751613018、user=welltop-jim-wang、MEMBER、created=updated=`2026-09-20T18:03:36Z`——与 dispatch 所引 updated 时间戳一致） | 硬契约三件套原文在案：①「宿主优雅停机必须先 `await drain()` 再 dispose」写为**硬性契约**；②同步修订 ADR-0006 :86 dispose 定义（契约与实现不得脱节）；③dispose 保持 abortive 时保留分层公开 drain（另支持 retryDelayMs 解耦、缺省保持现行为） |
| ADR 0006（含 #412 修订节） | 已现读（:242-:282） | :242 修订节标题（引 comment 5751613018）、**:270** 停机硬契约（无条件）、**:276** dispose 对齐条款（修订并扩展 :86；dispose 保持 abortive/有损；分层 drain 不并入 dispose）逐字在位 |
| ADR 全集（0001–0030） | 状态核对 | 全部 accepted、无 ADR 级 superseded；**无任何 ADR 条款治理验证日志的空白形态或证据日志加工方式** |
| CONTEXT.md「完成式排空（drain）」词条 | 已现读 | 硬契约句式 + `_Avoid_`（flush-all/force-sync/定时排空窗/把 drain 并进 dispose）零触碰 |
| 实现强制面（事实核对源） | 只读 | `apps/yjs-server/src/app.ts:624` `awaitDrainWithBudget(adapter.drain(), budgetMs)` 结构性先于 :630 全仓唯一 `persistenceFiber.dispose()`；:625 预算尽诚实事件——在位，与 HEAD/d60760c 逐字节一致 |
| 验收锚（证据集所指称对象） | 已现读 | `smoke-skeleton-red.test.ts:429` `expect(tailOrder).toEqual(['persistence-disposed', 'app-stopped'])`（:427 过滤、注释引 Owner 评论）+ 忙窗用例；`persistence-drain-shutdown.test.ts` S-5a/b/c；`ordered-shutdown-red.test.ts` 四事件序——全部对 HEAD 零 diff、对 `d60760c` 逐字节一致 |
| **Controller 在案声明集（权威判据）** | 已独立重提取 | mabf-center 快照（11.8MB，本轮重读）内 iteration-3 SA3 `artifactPaths` 的 10 份具名日志串（ci-failure-evidence、relay-redgreen、smoke-red-proof、shard6-node24、persistence-contract、shutdown-tests、root-typecheck、generate-check、app-suite、smoke-stability）逐项在位：8 份保留于工作区（归零后）+ 2 份已随 `d60760c` 入库；**清整未改变集合成员** |
| 交付面惯例 | 已核对 | `.gitignore` 仅忽略 `artifacts/local-packages/*.tgz`（`git check-ignore` exit 1）；`git ls-files artifacts/` 索引面 223 项入库惯例；iteration-2 先例 `bdb91cb`、评审留档先例 `f3b13ee`/`2c3a486`；机密扫描零命中（仅测试用例名中的 bearer 字样） |
| SA3 报告（iteration 5 版）§iteration 5 清整记录 | 已读并交叉验证 | 被报缺陷表 / 哈希对照表 / 验证表的关键数值（哈希、行数、缺陷位置、`--check` 结果）本轮全部独立重测吻合 |

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（清整后证据集） | Classification | Evidence | Required action |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | **Owner comment 5751613018 要求① + ADR 0006:270（停机硬契约）** | 「宿主优雅停机在调用 dispose() 之前必须先 await drain()——硬性契约，非参考建议；至 drain 完成或宿主显式预算耗尽且该事实可观察」 | 清整为证据日志的仅空白操作；契约全部载体（ADR 0006:270、CONTEXT 词条、`app.ts:624→:630`、集成文档）对 HEAD 与 `d60760c` 逐字节保持（产品/测试/文档树 diff 为空）；保留集在**归零后形态**下仍完整保有契约的全部验收证据锚：S-5a/b/c（`shutdown-tests.log`，含 S-5b「persistence-drain-budget-exceeded 先于 dispose、四事件序完整」）、忙窗尾序锚（`shard6-node24.log` 5 用例绿 + `app-suite.log` busy-window 用例绿）、`ordered-shutdown-red.test.ts (2 tests)` 绿（app-suite :105）、red 证明（`smoke-red-proof.log` `1 failed \| 4 skipped` + `RED-EXIT=1`）——逐行 grep 在位 | no-conflict（契约载体与契约证据面在归零后双重保持） | ADR 0006:270 / app.ts:624/:630 / 各日志关键行本轮重测 | 无 |
| R2 | Owner comment 5751613018 要求② + ADR 0006:276（ADR 对齐条款） | 「:86 dispose 定义修订并扩展；dispose 语义不变且保持 abortive/有损；分层公开 drain 不与 dispose 合并」 | 零触碰：清整集不含 `docs/adr/**`、`CONTEXT.md`、`packages/**`；已入库 `relay-redgreen.log`（A/B 双形态 SUMMARY）未被清整改动（不在 8 份之列，tracked 零 diff） | no-conflict | `git diff HEAD --stat`（产品/文档面为空）；ADR 0006:276 现读 | 无 |
| R3 | Owner comment 5751613018 要求③（分层公开 drain + retryDelayMs 缺省形状） | `contract.ts` `readonly drain?`；`lifecycle.ts` 公共 `drain(targets?)`；`retryDelayMs?` 缺省动态回退不物化 | 零触碰（清整集不含 `packages/persistence/**`）；`persistence-contract.log` 归零后保有 21 files/221 tests + `Type Errors: no errors`（含 drain-red 27 / drain-surface 5 / drain-semantics 9 行） | no-conflict | `git status`；persistence-contract.log 关键行重测 | 无 |
| R4 | **Controller 在案声明集（交付声明的权威性）** | iteration-3 SA3 `structured_output.artifactPaths`（mabf-center 快照）= SA3 报告 + 被修复测试文件 + 10 份具名日志 | 清整**只改内容空白、不改集合成员**：声明 10 份日志 = 8 份保留（归零后）+ relay-redgreen + smoke-stability（tracked）；报告与测试文件在位 ⟹ 12/12 全部在位。SA3 报告 :32 仍写「9 份具名证据日志」的**计数不精确**从前轮原样带过（声明∩删除 = ∅ 不受影响） | no-conflict（计数瑕疵为前轮已登记行动 2） | mabf-center 快照本轮重提取；`git ls-files`/工作区对照 | 行动 2（非阻断，承前） |
| R5 | **清整的「仅空白」性质（本轮核心新事实）** | 证据诚实性谱系：证据产物的加工不得改变其指称事实（申报须与被引事实一致） | 独立复核成立：①索引 blob ↔ 工作区**去空白 sha256[:16] 8/8 MATCH**（`a3665288…`/`d2082a32…`/`d7d3ff9b…`/`a6ef2ba3…`/`5d37cf4f…`/`d954341f…`/`719925b2…`/`5f9a6ea1…`，与 SA3 披露表逐份相同）⟹ 除空白外**零字节变化**；②行尾空白 grep 零命中、EOF 无 `\n\n`；③行数差逐份符合预期（6 份 −1 行、2 份持平）；④被 `--check` 点名的 14 处与实际 diff 逐处对应（7 处 `4xx-…Z ` 行尾空格 + 1 处 `155| ` + 6 处 EOF 空行）；⑤全部计数/退出码/时序/判定文字（`expected 143 to be +0`、`Test Files 1 failed \| 65 passed (66)`、`##[error]`、`RED-EXIT=1`、`Start at`/`Duration`/`Tests` 行、S-5b 用例名）在归零后逐字在位 | no-conflict（仅空白、事实面零变） | 本轮哈希/grep/`--check`/od 重测（§2） | 无 |
| R6 | **交付面策略（.editorconfig / .gitignore / 入库惯例）** | `.editorconfig [*] trim_trailing_whitespace=true、insert_final_newline=true、end_of_line=lf`；`.gitignore` 仅忽略 local-packages tgz；artifacts 入库惯例 | 归零后形态**符合** `.editorconfig` 全部三条适用规则（清整前 staged blob 违反 trim 规则——14 处被 `git diff --cached --check` 点名）；8 份日志不被 .gitignore 忽略，循 `bdb91cb` 同款 `chore(ci)` 先例入库；清整未引入调度器工作区文件；机密扫描零命中；**披露完备性**：清整的事实、位置、哈希对照与 Controller 侧指引固化于 SA3 报告 §iteration 5 清整记录（将随同一提交入库——前提见行动 1） | no-conflict（清整使交付面向仓库空白策略**收敛**而非偏离） | `.editorconfig` 现读；`git check-ignore` rc=1；`git ls-files artifacts/` 223 项；SA3 报告披露段 | 行动 1（commit 保真，非决策冲突） |
| R7 | **issue #412 停机耐久约束的证据完备性**（dispatch 具名核查项） | 耐久证据链 = 红证明 → 机制隔离 → 契约绿 → 停机链绿 → 闸门绿，五环逐环有锚 | 归零后五环锚完整：`ci-failure-evidence.log`（run 35535478371 失败原文：`expected 143 to be +0`、exit 1——唯一不可再生外证，自述「ANSI stripped, filtered」加工形态）、`smoke-red-proof.log`（RED-EXIT=1）、`relay-redgreen.log`（tracked，未触碰）、`persistence-contract.log`（21/221 + 无类型错）、`shutdown-tests.log`（S-5 3 绿 + Type Errors: no errors）、`shard6-node24.log`（66/746）、`app-suite.log`（35/183 + 四事件序锚 + 忙窗锚）、`root-typecheck.log`/`generate-check.log`（命令回显静默成功形态） | no-conflict（耐久证据链无缺口，且全部锚在归零后形态下重验） | 各日志关键行本轮重测；SA3 报告清理表（18 份清理物计数固化，承前轮） | 行动 3（非阻断，形态观察承前） |
| R8 | 决策集全谱核对（ADR 0001–0030 + CONTEXT 词条 + 根/模块 AGENTS 决策面 + CI 门禁定义） | 全部 ADR accepted、无 superseded；CONTEXT 术语面；`.github/workflows/ci.yml` 门禁 | 无任何决策文本治理验证日志的空白形态/加工方式——清整不落入任何决策文本管辖面；产品/测试/文档/CI 门禁面（`packages/**`、`apps/**`、`docs/**`、`.github/**`、`domains/**`、`scripts/**`）对 HEAD 零 diff；typed-access 义务面未触及 | no-conflict | ADR 状态核对；`git diff HEAD --stat` | 无 |

裁决分布：**no-conflict 8（R1–R8）/ implements-existing-decision 0 / evolution-required 0 / hard-conflict 0**（R5 为本轮新事实的核心裁决；R4/R6/R7 各附一项非阻断行动/观察，均承前轮或在 Controller 侧闭合）。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
| --- | --- | --- | --- |

**无。** 清整未主张、也未需要任何决策 override：

- 无 ADR/CONTEXT/协议条款被规避——没有任何决策文本管辖证据日志的空白形态（R8）；清整方向反而向 `.editorconfig` 交付策略收敛（R6）；
- iteration-5 dispatch（「只归零 `git diff --cached --check` 报出的精确缺陷、保持日志内容与已评审修复不变」）是 Controller 的任务授权文书，SA3 据此行使裁量且未越界（R5 独立复核为零内容变化）；
- CI 源日志的行尾空格移除属证据加工精度问题，不构成对任何决策的规避——该日志自述已是加工形态（「ANSI stripped, filtered」），且清整由 SA3 报告同集披露、哈希可验（R5/R6）。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
| --- | --- | --- | --- |
| Owner 硬契约成文载体：ADR 0006 修订节（:242 标题引 5751613018、:270 无条件硬契约、:276 修订并扩展 :86） | 逐字保持 | HEAD 现读；`git diff HEAD -- docs/` 为空 | **保持** |
| 实现强制面：`app.ts:624 awaitDrainWithBudget(adapter.drain())` → `:630 persistenceFiber.dispose()`、`:625` 预算尽诚实事件 | 结构性先序保持 | 现读；`git diff d60760c HEAD --` 该文件为空 | **保持** |
| CONTEXT.md「完成式排空（drain）」词条（含 `_Avoid_`） | 逐字保持 | 现读；diff 为空 | **保持** |
| 被修复测试文件 `smoke-skeleton-red.test.ts`（5 用例、无 skip/only/todo、:429 尾序锚）与既有 #412 验收锚（S-5a/b/c、四事件序、SA6 契约文件、persistence 源码与既有测试） | 与 `d60760c` 提交态逐字节一致、本轮零触碰 | `git diff d60760c HEAD --` 上述路径为空 | **保持** |
| **本轮新增：8 份日志的证据事实面**（计数、退出码、事件序、用例名、时间戳行） | 除空白外逐字节不变 | 去空白 sha256[:16] 索引↔工作区 8/8 MATCH（本轮独立重测） | **保持** |
| Controller 在案声明集（iteration-3 SA3 `artifactPaths` 12 路径） | 每一已声明交付物在工作区/HEAD 在位；集合成员不被清整改变 | mabf-center 快照重提取 ∩ 工作区实测 | **12/12 在位、成员零变化** |
| CI 门禁定义（`.github/workflows/ci.yml`、`scripts/ci-test-shard.mjs`、test-durations.json）与 tsx 钉版 | 零触碰 | `git status`/`git diff HEAD` | **保持** |

## 6. Evolution requirements

**无。** 清整是证据层的空白归零：不改任何决策文本、协议、公共 API、schema、持久化格式、状态机、生命周期或失败语义——不存在需要修订计划的事项。CI 原文的行尾空格移除不改变其指称事实（失败签名、exit code、计数逐字保持，R5），不需要任何文档演进。

## 7. Hard conflicts

**无。** 特别核对：

- **不是证据篡改面**：去空白哈希 8/8 MATCH 证明除 14 处具名空白外零字节变化；被 `--check` 点名处与实际 diff 逐处对应；全部指称事实（143 签名、exit code、计数、事件序、用例名）逐字保持（R5）；
- **不是耐久约束证据缺口**：五环证据链在归零后形态下逐环重验在位（R7）；唯一不可再生项（CI 失败原文）仍在保留集且其加工形态自述在案；
- **不是交付策略违例**：归零后形态符合 `.editorconfig`，不被 .gitignore 阻断，循入库先例，无调度器文件混入，无机密（R6）；
- **不是已声明交付物损失**：声明集 12/12 在位，清整不触碰集合成员（R4）。

## 8. Required actions

1. **（非阻断决策面，但为 commit 保真必做——Controller 侧）重新 stage 后再提交**：索引当前仍持**清整前** blob——本轮实测 `git diff --cached --check` 仍报原 14 处缺陷。若按现索引直接 commit，归零不会落库（14 处缺陷随提交进入历史）且披露缺位。提交前须对 8 份日志 + `task_issue-412_sa3_impl.md`（`MM` 的未 staged 半，含 §iteration 5 清整记录）+ 本报告执行 `git add`，再复跑 `git diff --cached --check`（预期静默；内容侧等价证据 = 本轮 8/8 静默重测）。重 stage 的内容即本报告逐份核验过的归零后形态（哈希已钉）。
2. **（非阻断，承前轮行动 2）SA3 报告 :32 计数不精确**：仍写「9 份具名证据日志」，Controller 在案 `artifactPaths` 实为 10 份。不影响任何裁决（声明∩删除=∅、成员零变化）；建议入库提交时顺带修正或接受现状。
3. **（非阻断，可选，证据形态）**：`ci-failure-evidence.log` 头注自述「(ANSI stripped, filtered)」，本轮清整后实际加工面多一项 whitespace 归零——披露目前由 SA3 报告哈希对照表承载（可验），建议后续版本头注补「whitespace-normalized」一词更精确；`generate-check.log`/`root-typecheck.log` 仍为静默成功形态、无 `EXIT=N` 尾标（承前轮行动 3）。
4. **（非阻断，动态面既有登记）**：CI 权威复跑（推送后 `test (20, 6)`/`test (24, 6)` 真实 runner）与 PR #413 推送属 Controller 动作，沿用 SA3 §Deferred / SA10 §6-1 登记，非冲突门禁事项。

## 9. Verdict

**clear**

- 8 项对照：8 no-conflict + 0 implements-existing-decision + 0 evolution-required + 0 hard-conflict；
- **dispatch 三问均获肯定答案**：①ADR——归零后证据集与 ADR 全集（0001–0030，含 ADR 0006 #412 修订节 :242/:270/:276）零冲突，全部决策载体对 HEAD/`d60760c` 逐字节保持；②规范——与 CONTEXT 词条、集成文档、模块 AGENTS、CI 门禁定义零冲突，清整不落入任何决策文本管辖面；③交付策略——归零后形态**符合** `.editorconfig` 空白策略、不被 .gitignore 阻断、循 artifacts 入库先例、Controller 在案声明集 12/12 保全且成员零变化；
- **issue #412 停机耐久约束在归零后形态下完整保全**：Owner comment 5751613018（2026-09-20T18:03:36Z，MEMBER，本轮 `gh` 独立重拉核对）的硬 drain-before-dispose 契约与 ADR 对齐——载体零触碰，且其全部可执行验收锚（S-5、忙窗尾序锚、四事件序锚、契约切片、CI 闸门）的证据日志均在保留集中以归零后形态重验在位；
- commit 可按 SA3 建议执行，**唯一前提 = 行动 1 的重新 stage**（使提交内容与已裁决的归零后形态一致）。

## 10. requiresConflictRecheck

**false**

- 本次提交内容 = 本报告已逐份独立核验的归零后 8 份日志（去空白哈希已钉）+ 3 份 wiki 记录；无「尚待实现核对」的部分——行动 1 的重新 stage 只是让索引内容与已核验形态对齐，不产生新的待核对决策面；
- 清整不开启任何新决策面（无公共 API/wire/schema/持久化/状态机/生命周期/失败语义变化，无正式 override）；停机耐久约束的全部载体已在 HEAD 现读复核闭合；前数轮（主体实现 / codegen / 证据留档 / harness 修复 / 收纳裁决）复审均已 clear 闭合；
- 唯一开放项 = 行动 1 的 Controller 重新 stage（操作保真）与行动 4 的 CI 权威复跑（SA4/SA7 动态验证面）——两者都不是冲突复查触发器。
