# SA4 Implementation Review — issue #412

- 任务：issue #412（persistence 公开完成式排空 `drain()` + `retryDelayMs` 解耦 + 停机硬契约）
- Worktree：`/home/wangjian/nomicore-fix-issue-412`（分支 `mabf/issue-412`，HEAD `2c3a486`，领先 `origin/main` 7 提交；修复 `d60760c`、iteration-2 证据 `bdb91cb`、评审留档 `f3b13ee`/`2c3a486` 均在其历史）
- 本轮 dispatch：`sa-77c6a88d-7626-4df7-b22a-69f3ccba1cb0`（phase **implementation-review**，iteration 6）
- 本轮审查对象（Part E）：**已批准保留的 iteration-3 CI 修复验证证据日志的空白归零（whitespace normalization）入库前审查**——Controller 已 stage 的 8 份日志的工作区清整增量（`git diff --cached --check` 报出的 14 处：8 处行尾空白 + 6 处 EOF 空行）+ SA3 报告 iteration-5 清整记录；三问：仅格式缺陷、证据仍真实必要、产品/测试行为零改动；Owner comment `5751613018`（updated `2026-09-20T18:03:36Z`）的硬 drain-before-dispose 与 ADR 对齐保持
- Part D dispatch：`sa-81d27538-450e-41cc-80d1-13a766f97d4c`（phase **implementation-review**，iteration 5；review group `review-412-cirepair-evidence-5`）
- Part D 审查对象：**SA3 选定的 iteration-3 CI 修复验证证据产物的入库前审查**——8 份未跟踪具名闸门日志（`artifacts/sa3-issue412-iter3-{ci-failure-evidence,smoke-red-proof,shard6-node24,persistence-contract,shutdown-tests,root-typecheck,generate-check,app-suite}.log`）+ iteration-4 收纳轮对 26→8 的裁决（18 份清理）+ SA3 报告原位更新；四问：必要、真实、范围、不藏抑制/不改已评审修复
- Part C dispatch：`sa-b0e509f7-f0db-4278-900d-207cbb627480`（phase **implementation-review**，iteration 4）
- Part C 审查对象：**`test (24, 6)` smoke SIGTERM 修复轮**（SA3 iteration 3，dispatch `sa-98b9e976-b530-4227-ae2e-1dfa5cfa40d7`）——`f3b13ee` 之上的未提交增量，覆盖三面：①direct-node launcher（`spawnApp` 由 `.bin/tsx` CLI 改 `node --import tsx` 直跑）；②新增忙窗 drain-before-dispose 回归锚；③无测试弱化 / 无范围回退
- 适用 Owner 要求：Issue comment ID `5751613018`，updated `2026-09-20T18:03:36Z`——**硬性优雅停机 drain-before-dispose 契约与 ADR 对齐必须保持**（本轮以「保持性」维度复核，见 §E2-5；comment id/时间戳/作者已由 SA8 `gh api` 独立拉取核对并在其报告引用）
- 审查纪律：静态实现审查。未运行测试/未启动服务/未修改实现；本轮新证据 = 只读 Git（diff/status/numstat/两 head 对照）+ tsx `cli.mjs`/`preflight.cjs` 信号转达机制源码通读 + 被改测试全文/产品源码/CI 分片器/AGENTS 通读 + SA3 证据日志（`artifacts/sa3-issue412-iter3-*.log`）交叉核对
- 历史轮次：**Part E**（iteration 6）= 空白归零入库前审查（本轮，结论 **approve**）；**Part D**（iteration 5）= 证据收纳面审查（结论 **approve** 保持，本轮 Part E 复核其保留集 8 份逐份未被增删/替换）；**Part C**（iteration 4）= smoke SIGTERM 修复轮审查（对象已提交为 `d60760c`，结论 **approve** 保持，本轮 Part E 复核其逐字节未改）；**Part A**（iteration 1）= codegen-freshness 修复轮（对象已提交为 `9094760`，结论 **approve** 保持）；**Part B**（iteration 0）= #412 主体实现审查（已提交为 `75bd0ab`，27 文件核对无漂移，结论 **approve** 保持，关键锚本轮抽验仍在）

---

# Part E — 空白归零后证据入库前审查（SA3 iteration-5 清整轮对象，本轮 dispatch）

## E1. Reviewed inputs

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| 本轮 dispatch 指令（审查 whitespace-normalized 保留的 iteration-3 CI-repair 证据产物 commit 前：仅格式缺陷、证据仍真实必要、产品/测试行为零改动；Owner comment 5751613018 updated 2026-09-20T18:03:36Z 硬 drain-before-dispose + ADR 对齐保持） | 已读 | 审查授权范围 + 四问验收面 |
| 8 份已 stage 日志的**索引 blob ↔ 工作区版**逐份对照（`git diff -- artifacts/` 全量 hunk、`cat -A` 可见空白、行/字节计数、`tr -d '[:space:]' \| sha256sum` 双侧复算） | 逐份执行 | 「仅格式缺陷」判定本体 |
| `git diff --cached --check`（索引态）与 `git diff --no-index --check /dev/null <逐份>`（工作区态）双态运行 | 只读 | 被报 14 处缺陷 ↔ 清整后归零的独立复核 |
| `git status --porcelain -uall`、`git diff HEAD --stat/--name-only`（含 `-- packages apps docs domains scripts .github` 排除面）、`git diff HEAD --check`、`git diff d60760c -- apps/yjs-server/test/smoke-skeleton-red.test.ts`、`git diff --cached --numstat -- artifacts/`、`git show --stat d60760c -- artifacts/` | 只读 | 零产品/测试改动、纯新增、已入库 3 份边界 |
| `wiki/raw/task_issue-412_sa3_impl.md` 工作区版 §iteration 5 清整记录（14 处缺陷表、计数/字节/哈希表、验证表、范围申报） | 全量逐行 | 清整申报与实测的逐项对账 |
| 真实性锚独立重验：`apps/yjs-server/test/smoke-skeleton-red.test.ts` HEAD 版 `:153/:419` 现读、`git show f3b13ee:…` `:267` 现读、各日志 `Start at`/`Duration`/计数轴（66/746、35/183、21/221、3/3、5 tests 1 failed 4 skipped、745 CI 基线）、`ci-failure-evidence.log` 头部摘录披露、`smoke-red-proof.log` `RED-EXIT=1`、提交时间线（f3b13ee 04:24 +08 → CI 失败 20:25Z → 本地复跑 11:33-11:47 → d60760c 11:59 → 2c3a486 12:10 → 清整 mtime 12:26） | 现读/复算 | 证据真实性（不采信自述，锚点重验） |
| Owner 载体现读：`docs/adr/0006-server-persistence-docstore.md:242/:270/:276`、`apps/yjs-server/src/app.ts:624→:630→:632`、`smoke-skeleton-red.test.ts:427-429` 尾序锚、`persistence-drain-shutdown.test.ts`（S-5） | 逐行 | Owner 5751613018 硬契约保持性 |
| 保留集引用面：`grep -rln sa3-issue412-iter3`（= 仅 5 份 wiki 记录）、wiki 内 sha256 钉值扫描（= 仅 SA3 报告 iteration-5 节的去空白哈希） | 只读 | 归零是否破坏任何既有引用/钉值 |
| Part D（iteration 5）审查记录 + SA8 iteration-5 conflict report（staged 版，`gh api` 独立拉取的 comment id/时间戳/作者事实） | 已读 | 前轮四轴真实性结论的可承继性与独立旁证 |

## E2. Verdict

**approve**（0 × BLOCKER；0 × MAJOR；0 × MINOR 阻断项；观察项见 §E12）。空白归零后的 8 份保留日志**准予入库**——前置条件：Controller 提交前**必须重新 `git add` 这 8 份日志 + 工作区版 SA3 报告**（索引当前仍持清整前 blob，见 E-O1；重 add 后的提交内容面已由本审查 `git diff HEAD --check` 静默独立验证）。

核心判定（对应 dispatch 三问 + Owner 保持）：

1. **仅格式缺陷（数学级闭合，非目测）**：工作区 vs 索引的全部 hunk 恰为两类——①6 份文件（app-suite/generate-check/persistence-contract/root-typecheck/shard6-node24/shutdown-tests）各删 1 个 EOF 空行（`…\n\n`→`…\n`）；②`ci-failure-evidence.log` 7 行删行尾空格（`401/403/406/423/424/429/430-…Z␠`→`…Z`）+ `smoke-red-proof.log` 1 行删行尾空格（vitest 代码帧空源码行 `155|␠`→`155|`）。合计 14 处 = `git diff --cached --check` 被报数，**无第三类 hunk**。独立证明：8 份 `tr -d '[:space:]'` 后 sha256[:16] 索引↔工作区逐份相同且与 SA3 报告申报值逐字一致；行/字节差逐份 = 索引↔工作区实测（6 份 −1 行/−1 byte；ci-failure 0 行/−7 byte；smoke-red-proof 0 行/−1 byte ⟹ 合计 −14 bytes 守恒）；无 CR 字符；`grep -nP '[ \t]+$'` 对 11 份 iter3 日志零命中；工作区 8 份 `git diff --no-index --check` 全静默。语义面：被删空白均为空内容行的行尾填充或 EOF 冗余换行——时间戳前缀（`432-` 等未被报行原样保留）、代码帧行号、一切计数/时序/退出码/判定文字逐字未动。
2. **证据仍真实（内容 = 前轮已四轴验真的同一字节，锚点本轮重验）**：归零不改变任何日志内容字节（仅空白），Part D 行号/时间/计数/旁证四轴结论全部承继；本轮独立重验三处硬锚——red 证明栈帧 `:153:37`（`expect(code,…).toBe(expectedCode)` 现位 :153）/`:419:7`（`signalAndExpectExit(hubProc,'SIGTERM',30_000,0,…)` 现位 :419）与 HEAD 文件逐字吻合；CI 失败观测点 `:267`（f3b13ee 版 `signalAndExpectExit(peerProc,…)`）吻合且该版恰 4 tests（与摘录 `(4 tests | 1 failed)` 互证）；计数轴 CI 745（1 failed|744 passed）↔ 本地 746（+1 新用例）↔ HEAD 5 tests、shard6 66 files/746、apps 35/183、契约 21/221+typecheck、S-5 3/3 自洽；时间线（CI 失败 2026-09-20T20:25Z = f3b13ee 推送后即时；本地复跑早于 d60760c 11:59 提交）无矛盾。
3. **证据仍必要（保留集零增删，必要性判断面未变）**：文件集仍 = Part D 批准的 8 份 + 已入库 3 份（d60760c：probe-memory/relay-redgreen/smoke-stability）= 11 份，`git status` 无新增/删除/重命名；`git diff --cached --numstat -- artifacts/` 8 份均纯新增（N/0）；每份仍承载互斥闸门主张（CI 失败外证 / 仓内红证明 / shard-6 步骤原文 / 契约切片+typecheck / S-5 / generate --check / root typecheck / apps 全套），无重复主张引入、无闸门缺口产生；18 份冗余物维持已清理状态（其事实固化于 SA3 报告 §Evidence reconciliation，未因本轮被触碰）。
4. **产品/测试行为零改动**：`git diff HEAD` 全树 = 恰 8 份 artifacts + 3 份 wiki；`git diff HEAD -- packages apps docs domains scripts .github` = 空；无未跟踪文件；被修复测试文件相对 `d60760c` 零 diff（`git diff d60760c -- apps/yjs-server/test/smoke-skeleton-red.test.ts` = 空）、无 `.skip/.only/.todo`、`143` 零容忍维持。CI 复跑权威性仍留待 Controller push 后判定（沿 §D11）。
5. **Owner comment 5751613018（2026-09-20T18:03:36Z）保持且未被清整稀释**：ADR-0006 `:242`（修订节，明文引用该 comment）、`:270`（无条件硬契约：`dispose()` 前必须先 await `drain()`）、`:276`（dispose 对齐条款，dispose 保持 abortive、分层公开 drain）逐行现读在位；`app.ts:624`（`awaitDrainWithBudget(adapter.drain(), budgetMs)`）结构性先于 `:630`（全仓唯一 `persistenceFiber.dispose()`）→ `:632 persistence-disposed` → `:635 app-stopped`；`smoke-skeleton-red.test.ts:427-429` 忙窗尾序锚 `toEqual(['persistence-disposed','app-stopped'])` 在位；保留的 `shutdown-tests.log`（S-5 3/3 绿）与 `shard6/app-suite`（含 S-5 与忙窗锚）恰是该契约的绿灯记录——清整对契约**只动证据排版、不动任何载体**。

## E3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
| --- | --- | --- |
| dispatch：confirm only formatting defects changed | §E2-1：hunk 全枚举两类 14 处 + 去空白 sha256 8/8 相同 + 行/字节差守恒 + 无 CR | **落实** |
| dispatch：confirm evidence remains authentic | §E2-2：内容字节不变 + 三处行号锚/计数轴/时间线本轮独立重验闭合 | **落实** |
| dispatch：confirm evidence remains necessary | §E2-3：文件集零增删、8 份主张互斥如故、18 份冗余维持清理 | **落实** |
| dispatch：confirm no product/test behavior changed | §E2-4：非 artifacts/wiki 面对 HEAD 零 diff、测试文件对 d60760c 零 diff、无抑制面 | **落实** |
| Owner 5751613018（updated 2026-09-20T18:03:36Z）：hard drain-before-dispose + ADR alignment remain intact | §E2-5 四方载体（ADR :242/:270/:276、app.ts :624→:630、smoke :429 尾序锚、S-5）逐行现读在位 | **保持** |
| SA3 iteration-5 报告申报诚实性 | 报告全部可复核申报（14 处缺陷清单、8 份计数/字节/哈希、验证命令结果、索引未重写披露）与实测逐项一致；唯一出入见 E-O3（计数措辞） | **落实** |

## E4. 清整规则落实审查（SA3 iteration-5 自设规则 vs 实际执行）

| 规则 | 实际执行 | Assessment | Finding |
| --- | --- | --- | --- |
| 只归零被 `git diff --cached --check` 报出的精确缺陷，不触碰其他字节 | 14 处逐份对上（6 EOF + 8 行尾空白）；无任何未被报行被改 | 忠实 | 无 |
| 保持日志内容与已评审修复不变 | 去空白哈希 8/8 相同（= Part D 已审内容）；测试文件对 d60760c 零 diff | 忠实 | 无 |
| 不执行 `git add`/`commit`（角色边界），索引留 Controller 重写 | `git status` 8 份 `AM`、报告 `MM`——索引持清整前 blob，已如实披露（§Deferred verification） | 忠实（E-O1 前置条件） | 无 |

## E5. 架构一致性与惯例

- **相似能力对照**：仓库 whitespace 卫生惯例由 `git diff --check` 门（预提交检查的通用事实源）承载；本次清整 = 让被入库产物满足该门，非新造格式标准。
- **单一事实源**：缺陷判定事实源 = `git diff --cached --check` 输出（本审查独立复跑同款 14 处）；SA3 报告的去空白哈希表是**派生记录**且与实测一致，无第二事实源冲突。
- **生命周期对称性**：日志为终态证据，无运行时生命周期；stage→清整→重 stage→commit 的所有权链清晰（SA3 清整、Controller 提交），无越权 stage。

## E6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
| --- | --- | --- | --- |
| `artifacts/sa3-issue412-iter3-{app-suite,generate-check,persistence-contract,root-typecheck,shard6-node24,shutdown-tests}.log`（6 份，索引 A + 工作区清整） | dispatch 明示「whitespace-normalized retained iteration-3 CI-repair evidence artifacts」 | EOF 空行归零 | 仅格式，合规 |
| `artifacts/sa3-issue412-iter3-{ci-failure-evidence,smoke-red-proof}.log`（2 份，同上） | 同上 | 行尾空白归零（7+1 处） | 仅格式，合规 |
| `wiki/raw/task_issue-412_sa3_impl.md`（MM：staged iteration-4 版 + 工作区 iteration-5 增量） | SA3 固定产物（skill §实现报告） | 清整记录原位追加 | 合规（增量全为追加，未改既往结论/计数/判定） |
| `wiki/raw/task_issue-412_sa4_review.md`（本文件）、`wiki/raw/task_issue-412_implementation_conflict_report.md`（12:34 SA8 iteration-6 conflict-gate 并行原位更新，其独立重测事实与本报文一致：14 处/−14 bytes/6 份 −1 行） | SA4/SA8 各自固定产物 | 评审留档 | 不归入本轮被审对象（留档防误归因）；清整对象仅 artifacts+SA3 报告 |

DENY 面（`packages/**`、`apps/**`、`docs/**`、`.github/**`、`domains/**`、`scripts/**`、其余 `artifacts/**` 含已入库 3 份 iter3 日志、其他 SA wiki 产物）：本轮零写入（`git diff HEAD` 双核对；已入库 3 份 mtime/内容未动）。

## E7. 契约连锁审查（归零的消费者面）

| Contract | Caller | Actual handling | Risk | Finding |
| --- | --- | --- | --- | --- |
| 日志文件名引用 | 5 份 wiki 记录（SA3/SA4/SA8/SA9/SA10） | 引用按文件名，不依赖行内空白 | 无 | 无 |
| 既有字节钉值 | 仅 SA3 报告 iteration-5 节的去空白 sha256（tr -d '[:space:]'） | 该口径归零前后同值（实测 8/8 与申报一致）；仓内无 raw-sha256 钉值被破坏 | 无 | 无 |
| `git diff --cached --check` 门 | Controller 提交流程 | 重 add 后静默（`git diff HEAD --check` 已由本审查独立验证为空） | 不重 add 则门仍红（E-O1） | 无（前置条件） |
| 程序化日志消费者 | 无（grep 全仓：零产品/测试代码引用 artifacts/sa3-issue412-iter3-*） | 不存在依赖行内空白的消费者 | 无 | 无 |

## E8. 错误、恢复与并发（清整动作面）

- **失败留痕不被抹除**：`RED-EXIT=1`、`##[error]AssertionError`、CI `1 failed | 744 passed` 总结数逐字保留；被删空白均在空内容行上，无任何失败证据被弱化或删除。
- **可逆性**：索引 blob 保留清整前全文（`git show :<path>` 可完整取回），归零动作完全可逆、可审计。
- **无隐藏写入**：`git status -uall` 无未跟踪残留；mtime 变化（8 份 12:26 重写）与清整动作一一对应，无未申报文件被触碰。

## E9. 测试质量审查（本轮=零测试改动复核）

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
| --- | --- | --- | --- | --- |
| `smoke-skeleton-red.test.ts`（5 用例，含忙窗锚） | exit 0、四事件序、锁守卫、durable 回读、`['persistence-disposed','app-stopped']` 尾序 | CI `test (20\|24, 6)` 分片；证据 = shard6 66/746 | 本轮零改动（对 d60760c 零 diff、无 skip/only/todo、143 零容忍） | 无 |
| S-5a/b/c | drain 完成式/预算诚实事件先于 dispose/统一路径 | SA6 §12 runner `--typecheck`；证据 = shutdown-tests 3/3 | 本轮零改动 | 无 |
| 保留证据的有效性 | — | — | 归零不改任何断言/计数/退出码面（§E2-1） | 无 |

## E10. Required revisions（本轮）

无 BLOCKER / MAJOR / MINOR finding。一项**前置条件**（非返工）：Controller 提交前重新 `git add` 8 份日志 + 工作区版 SA3 报告，使 `git diff --cached --check` 静默（内容侧等价性已由本审查独立证明）。

## E11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
| --- | --- | --- | --- |
| 重 add 后提交面完整性 | Controller `git add` 后复跑 `git diff --cached --check` | 静默（本审查 `git diff HEAD --check` 已空） | 仍报缺陷 ⟹ add 未覆盖工作区版 |
| 新 head CI 权威复跑（沿 §D11） | Controller push 后 CI | `test (24,6)`/`test (20,6)` 绿 | 复现 143 或忙窗锚超时 ⟹ 回流 SA3 |
| （承接 §D11/§C11 其余各项） | 见各 Part | — | — |

## E12. Non-blocking observations（本轮新增）

| # | 严重度 | 观察 | 建议处置 |
| --- | --- | --- | --- |
| E-O1 | 前置条件 | 索引仍持清整前 blob（8 份 `AM`）：直接 commit 会把 14 处空白缺陷带入仓库。SA3 因角色边界未 stage（已披露），非缺陷 | Controller 重 add 后提交；勿以索引现状直接 commit |
| E-O2 | 观察 | 8 份文件 mtime 被清整重写（12:26），Part D 的 mtime 真实性轴对工作区副本不再可直接复跑 | 已由「去空白哈希与索引 blob 相同（Part D 审的正是该内容）」闭合，无证据损失；留档说明 |
| E-O3 | 观察 | SA3 报告 iteration-5 节表述「8 处行尾空白 + 6 处 EOF 空行」与逐行清单（7+1 行尾空白、6 EOF）口径一致，但「行尾空白」计数按被报行数（8）而非文件数（2）——纯措辞，无实质出入 | 无需返工 |
| E-O4 | 观察 | 沿 D-O2：`generate-check.log`/`root-typecheck.log` 仍为成功静默型命令头，无显式退出码锚 | 后续闸门日志模板统一追加 `EXIT=0` 尾行（不适用本轮——追加内容即违反「仅空白」边界） |

## E13. 复查标记（本轮）

本轮为证据格式清整面审查：零实现/测试/文档触碰，无新 ADR 冲突维度；Owner 5751613018 硬契约四方载体原样在位（§E2-5）。`requiresConflictRecheck` 本轮提交 **false**。

---

# Part D — iteration-3 验证证据产物入库前审查（SA3 iteration-4 收纳轮对象）

## D1. Reviewed inputs

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| 本轮 dispatch 指令（审查 SA3 选定的 iteration-3 CI 修复验证证据；验证必要/真实/范围/不藏抑制/不改已评审修复；Owner comment 5751613018 updated 2026-09-20T18:03:36Z 保持） | 已读 | 审查授权范围 + 四问验收面 |
| 8 份未跟踪保留日志全文（`ci-failure-evidence` / `smoke-red-proof` / `shard6-node24` / `persistence-contract` / `shutdown-tests` / `root-typecheck` / `generate-check` / `app-suite`） | 逐份通读 + 交叉核对 | 被审对象本体 |
| `wiki/raw/task_issue-412_sa3_impl.md` 工作区版本 + `git diff HEAD`（相对 `2c3a486` 已入库版本） | 全量逐行 | 收纳轮报告增量的诚实性（是否改动 iteration-3 结论/计数/判定） |
| **Controller 在案 iteration-3 SA3 结果记录**（`~/.dsh/nomicore/mabf-peer-jim-dev/users/mabf-center/ns-a14c373c98ddc2dbbc99f7ca244e82f8.snapshot` 内 `sa-98b9e976-…-completion-…` 的 `saVerdict`/`artifactPaths`） | 只读独立拉取 | 「声明集」权威判据的**独立复核**（不采信 SA3 报告的自述） |
| Git 事实：`git status --porcelain -uall`（= 8 未跟踪 + 1 报告修改）、`git diff d60760c HEAD -- apps/yjs-server/test/smoke-skeleton-red.test.ts`（空）、`git diff HEAD -- packages apps docs domains scripts .github`（空）、`git show --stat d60760c/bdb91cb/2c3a486`、`git diff --name-only f3b13ee HEAD` | 只读 | 已评审修复零改动、入库先例、提交面纯净 |
| `apps/yjs-server/test/smoke-skeleton-red.test.ts`（HEAD 版）与 `git show d60760c^:` 版 | 现读 | 红证明日志行号（:153/:419）与 CI 失败行号（:267）双向核对 |
| `docs/adr/0006-server-persistence-docstore.md`（:242/:270/:276）、`apps/yjs-server/src/app.ts`（:624/:625/:630/:632） | 现读 | Owner 5751613018 硬契约四方载体保持性 |
| `wiki/raw/task_issue-412_sa9_standards.md`（M-1/M-6、26 份未跟踪清点）、`wiki/raw/task_issue-412_sa10_spec.md`（§第 9 条证据入库残余） | 已读 | 收纳前状态的独立旁证 + M-1 分歧披露核对 |
| 8 份日志的 `stat`（mtime）与日志内 `Start at`/`Duration` | 算术核对 | 时间轴自洽性（真实性） |
| `git ls-files artifacts/`（215 项；iter3 已入库 3 份） | 只读 | `artifacts/**` 入库惯例与「已入库 3 份」申报核对 |

## D2. Verdict

**approve**（0 × BLOCKER；0 × MAJOR；0 × MINOR 阻断项；观察项见 §D12）。8 份保留日志可以按 SA3 建议的 `chore(ci): record issue 412 iter3 verification evidence` 入库。

核心判定（对应 dispatch 四问）：

1. **必要（不冗余、不缺失）**：保留集 = Controller 在案 iteration-3 SA3 `structured_output.artifactPaths` 声明集（12 路径 = 报告 + 被修复测试文件 + 10 份证据日志）减去已随 `d60760c` 入库的 `relay-redgreen`/`smoke-stability` 与已入库的报告/测试文件——**本审查从 mabf-center 快照独立拉取该记录核对，逐项吻合**。8 份各自承载互不重复的闸门主张（CI 失败外证 / 仓内敏感性红证明 / CI shard-6 步骤原文复跑 66 files/746 tests / SA6 契约切片 21 files/221 tests+typecheck / S-5 停机锚 3 tests / `generate --check` / root typecheck / apps 全套 35 files/183 tests），恰好覆盖 SA6 §12 与设计 §12 对修复范围声明的全部验证门，无互相重复、无门缺口。已清理的 18 份（`smoke-run1`、`smoke-load1..3`、`smoke-load-run1..14`）**均不在声明集内**（独立复核确认），属同一命令的逐次 stdout 转储。
2. **真实（多轴独立交叉，非单一自述）**：①行号轴——红证明日志栈帧 `smoke-skeleton-red.test.ts:153:37`（`expect(code,…).toBe` 现位 :153）与 `:419:7`（忙窗用例 `signalAndExpectExit` 调用现位 :419）与 HEAD 文件逐字吻合；CI 失败证据的观测点 `:267` 与 `d60760c^`（修复前 4-test 版）`:267` 的 `signalAndExpectExit(peerProc,…)` 逐字吻合——伪造日志需同时伪造三处行号锚。②时间轴——5 份 vitest 日志的 `Start at + Duration` 与文件 mtime 全部在 <1s 内闭合（如 shard6：11:46:09+40.94s ↔ mtime 11:46:50.72；app-suite：11:34:57+195.67s ↔ 11:38:13.29；red-proof：11:46:04+1.98s ↔ 11:46:06.63）。③计数轴——CI 基线 745（1 failed|744 passed）↔ 本地 746（+1 新用例）自洽；shard6 日志实测恰 66 个 `.test.` 文件、与 CI 失败日志的 66-file 分片一致；S-5 3、契约 21/221、apps 35/183、smoke 5 tests 与报告全量一致。④旁证轴——SA8/SA9 同轮独立 `gh run list`/`gh api` 拉取的 run/job 事实一致；SA9（收纳前）抽读 `smoke-load-run{1..14}` 判「形态真实、计数互洽」。「忙窗锚 1361ms」在 app-suite 与 shard6 两份独立日志中同值系**机制必然**（时间线锚在 app 进程自身定时器：+900ms 广播→窗内 SIGTERM→+400ms 阻塞收尾→排空链，与 boot 抖动无关），不构成造假信号。
3. **范围（scoped）**：8 份日志无任何凭据/令牌类内容（`ghp_`/`github_pat_`/`AKIA`/`authorization:`/`bearer`/`token=` 扫描零命中）；仅含 worktree 路径 `/home/wangjian/nomicore-fix-issue-412`（报告已公开的既有事实）；体量克制（43–189 行）；CI 失败证据为头部披露的过滤摘录（`ANSI stripped, filtered`），保留失败原文、错误标记 `##[error]` 与总结数，无矛盾性删削。
4. **不藏抑制 / 不改已评审修复**：全部绿日志 skipped=0（746/746、221/221、183/183、3/3、5/5）；唯一「4 skipped」在红证明（`-t "busy event loop"` 名称过滤的证据运行形态，Part C 已裁定非抑制）；修复文件精确 grep `(it|test|describe)\.(skip|only|todo)|fit\(|fdescribe\(` 零命中；143 零容忍（仅注释）。**已评审修复逐字节保持**：`git diff d60760c HEAD -- apps/yjs-server/test/smoke-skeleton-red.test.ts` = 空，工作区 vs HEAD 产品/测试树 diff = 空（唯一变更 = SA3 报告）；`f3b13ee..HEAD` 全部变更 = 该测试文件 + 3 份已入库 iter3 日志 + wiki 记录，无 `packages/**`/`docs/**`/`.github/**` 触碰。
5. **Owner comment 5751613018（2026-09-20T18:03:36Z）保持且未被证据收纳稀释**：ADR-0006 :242（修订节，明文引用该 comment）、:270（无条件硬契约：dispose 前必须先 await drain）、:276（「修订并扩展 :86」dispose 对齐条款，dispose 保持 abortive）原样在位；`app.ts:624 awaitDrainWithBudget(adapter.drain(), budgetMs)` → :625 预算尽诚实事件 → :630 全仓唯一 `persistenceFiber.dispose()` → :632 `persistence-disposed` 结构在位；保留证据中 `shutdown-tests.log`（S-5 3/3 绿）与 `shard6/app-suite`（含 S-5 与 smoke 忙窗锚）恰是该契约的绿灯记录；已入库忙窗锚把契约钉成 `toEqual(['persistence-disposed','app-stopped'])` 尾序断言——证据收纳对该契约**只留证、不动载体**。

## D3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
| --- | --- | --- |
| dispatch：保留日志「必要」 | §D2-1：8 份 ↔ Controller 在案声明集（独立拉取核对）逐项吻合、主张互斥、门覆盖完整；18 份清理物均未声明且事实固化于报告 | **落实** |
| dispatch：保留日志「真实」 | §D2-2 四轴交叉（行号/时间/计数/旁证）全部闭合 | **落实** |
| dispatch：保留日志「scoped」 | §D2-3：零凭据、路径面已公开、体量克制、摘录有披露 | **落实** |
| dispatch：不藏测试抑制 | §D2-4：绿日志零 skipped、修复文件零 skip/only/todo、143 零容忍、断言面较修复前加严 | **落实** |
| dispatch：不改动已批准修复 | `git diff d60760c HEAD` 测试文件 = 空；工作区产品/测试树零 diff；`f3b13ee..HEAD` 提交面纯净 | **落实** |
| Owner 5751613018：硬 drain-before-dispose + ADR 对齐保持 | §D2-5 四方载体（ADR :242/:270/:276、app.ts :624→:630、S-5 锚、忙窗尾序锚）现读在位 | **保持** |
| iteration-4 收纳轮报告诚实性（不覆盖 iteration-3 结论） | `git diff HEAD` 报告增量全为追加/注记：负载行证据指针改指 §Evidence reconciliation（结论「14/14 绿」原样）、Deferred「1 次未复现失败」原文保留仅追加收纳注、无任何计数/判定改动 | **落实** |

## D4. 证据收纳设计落实审查（iteration-4 裁决规则 vs 实际执行）

| 裁决规则（SA3 自设） | 实际执行 | Assessment | Finding |
| --- | --- | --- | --- |
| 声明面：以 Controller 在案 `artifactPaths` 为权威清单 | 本审查独立拉取快照记录：12 路径，8 份保留未跟踪 + 4 份已入库（报告/测试文件/relay-redgreen/smoke-stability）全部对账，无一声明物被删 | 规则成立且执行忠实 | 无 |
| 必要性：互不重复主张才保留 | 8 份主张互斥（见 §D2-1）；唯一交叉（S-5 同时现于 shutdown-tests/shard6/app-suite）中 shutdown-tests 是唯一 `--typecheck` 形态（Type Errors: no errors 为其独有主张） | 成立 | 无 |
| 可复现性：被清理物命令/计数/时序固化 | 报告 §Evidence reconciliation 固化 18 份的 bytes/sha256[:12]/逐次 Start/忙窗用时/总时长 + 重放命令；但文件本体已不可恢复（见 D-O5） | 成立（事实保全）/ 本体不可复核（披露） | 无（观察 D-O5） |
| DENY 面零触碰 | `git diff HEAD` = 仅报告；`artifacts/**` 为 SA3 证据惯例目录（215 项 tracked），非设计 §11 产品/测试面 | 成立 | 无 |

## D5. 架构一致性与惯例（证据入库面）

- **相似能力对照**：iteration-2 先例 `bdb91cb chore(ci): record issue 412 verification evidence` = 恰 5 份具名闸门日志 + 3 份 wiki——本轮建议提交（8 份日志 + 报告）与之同构、规模相当（多出的 3 份对应本轮修复新增的失败外证/红证明/shard 复跑主张）。
- **单一事实源**：CI 失败事实的仓内载体 = `ci-failure-evidence.log`（外部账本受 GitHub 日志保留期约束，无法由本仓再生成——保留必要性最高的一份）；机制/敏感性事实载体 = 已入库 `relay-redgreen` + 未入库 `smoke-red-proof`，两者主张不同（探针机制 vs 仓内文件级红证明），非重复事实源。
- **生命周期对称性**：日志为终态产物，无 register/dispose 面；未跟踪→入库转化由 Controller 执行（SA3 未自行 commit，符合角色边界）。

## D6. 文件范围审查（本轮未跟踪面）

| Changed path（未跟踪，待入库） | ALLOW entry | Purpose | Assessment |
| --- | --- | --- | --- |
| `artifacts/sa3-issue412-iter3-ci-failure-evidence.log` | dispatch「preserving any necessary reproducible verification evidence」+ 声明集 | run 35535478371/job 106143620539 失败原文（唯一不可再生成外证） | 必要、真实（§D2-2③④） |
| `artifacts/sa3-issue412-iter3-smoke-red-proof.log` | 同上 | 仓内敏感性红证明（CI 签名逐字复现 + RED-EXIT=1） | 必要、真实（行号锚闭合） |
| `artifacts/sa3-issue412-iter3-shard6-node24.log` | 同上 | CI `test (…,6)` 步骤原文复跑 66/746 绿 | 必要、真实（时间轴闭合） |
| `artifacts/sa3-issue412-iter3-persistence-contract.log` | 同上 | SA6 契约切片 21/221 + typecheck 无错 | 必要、真实 |
| `artifacts/sa3-issue412-iter3-shutdown-tests.log` | 同上 | S-5a/b/c 3 tests（Owner 硬契约语义时序锚） | 必要、真实 |
| `artifacts/sa3-issue412-iter3-root-typecheck.log` | 同上 | root `pnpm typecheck`（15 段 tsconfig） | 必要；证据形态弱（D-O2） |
| `artifacts/sa3-issue412-iter3-generate-check.log` | 同上 | `pnpm generate --check`（CI `codegen-freshness` 步骤原文） | 必要；证据形态弱（D-O2） |
| `artifacts/sa3-issue412-iter3-app-suite.log` | 同上 | apps 全套 35/183 绿（apps AGENTS.md 门） | 必要、真实 |
| `wiki/raw/task_issue-412_sa3_impl.md`（已跟踪，修改） | SA3 固定产物（skill §实现报告） | iteration-4 收纳裁决 + 保持性复核记录 | 增量诚实（§D3 末行） |

DENY 面（`packages/**`、`apps/**`、`docs/**`、`.github/**`、`domains/**`、`scripts/**`、其余 `artifacts/**`、其他 SA wiki 产物）：本轮零写入（`git status` + `git diff HEAD` 双核对）。

## D7. 契约连锁审查（证据消费者）

| Contract | Caller | Actual handling | Risk | Finding |
| --- | --- | --- | --- | --- |
| 保留日志被三份已入库 SA 报告（SA3/SA9/SA10 iteration-3 版）引用 | 后续追溯读者 | 入库后引用链闭合（M-1 的「untracked 被引用」缺口由本次提交消除） | 无 | 无 |
| SA9 M-1 建议（含 14 份负载复跑补入库） | Controller/SA9 | SA3 报告明文披露分歧并交裁定，未自裁 | 分歧未决前入库 8 份不与 M-1 冲突（M-1 的核心是关键闸门日志，8 份全覆盖） | 无（观察 D-O5） |
| CI 复跑权威性 | Controller push 后 CI | 报告如实登记「本机无法触发」；本地证据不冒充 CI 结论 | 无 | 无 |

## D8. 错误、恢复与并发（证据链视角）

- **失败留痕**：`probe-memory.log`（已入库）保留失败中间探针（×3 TIMEOUT）；`ci-failure-evidence.log` 保留 CI 失败原文；红证明保留确定红——负结果链完整，无「只留绿」筛选。
- **唯一失败数据点**（4× 超订负载下 1 次 `1 failed | 4 passed`，无 143 字样）：从未形成文件（原始即只留命令行过滤输出），报告 Deferred 原文 + 收纳注双留，未被清理动作触及——**不存在「删除失败证据」**。
- **不可恢复面**：18 份清理物删除后 sha256 不可复核（D-O5）；缓解 = 声明集独立核对证明其非交付物 + SA9 收纳前抽读旁证 + 报告固化计数/时序。

## D9. 测试质量审查（保留日志所证面的触发入口）

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
| --- | --- | --- | --- | --- |
| smoke 5 用例（含忙窗锚） | exit 0、四事件序、锁守卫、durable 回读、`['persistence-disposed','app-stopped']` 尾序 | `ci-test-shard.mjs 6 6` 分片枚举（CI `test (20\|24, 6)` 真实入口）；`shard6-node24.log` 66/746 | 无弱化（Part C §C9 沿用） | 无 |
| S-5a/b/c | drain 完成式/预算诚实事件先于 dispose/统一路径 | SA6 §12 runner `--typecheck`；`shutdown-tests.log` 3/3 | 无 | 无 |
| SA6 契约切片 | C1–C14 + drain-red/surface/semantics | `persistence-contract.log` 21/221 + no type errors | 无 | 无 |
| 敏感性反证 | 旧 spawn 形态 → CI 签名红 | `smoke-red-proof.log`（RED-EXIT=1 显式退出码） | 还原核验未回显于日志内（D-O4） | 无 |

## D10. Required revisions（本轮）

无 BLOCKER / MAJOR / MINOR finding。8 份保留日志准予入库；M-1 分歧裁定与范围追认属 Controller 记录动作，不构成返工项。

## D11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
| --- | --- | --- | --- |
| 新 head（含 `d60760c` 修复 + 本次证据提交）CI 权威复跑 `test (24, 6)`/`test (20, 6)` | Controller push 后 CI | 两 job 绿（本地步骤原文 66/746 为前置证据） | 复现 143 或忙窗锚超时 ⟹ 回流 SA3 |
| 已清理 14 份负载证据若 Controller 裁定须入库 | 重放报告 §Verification 负载命令（人工 6 路忙循环） | 重生成逐次日志后入库 | 无法重放出门限内绿 ⟹ 重开稳定性问题 |
| `generate --check`/root typecheck 的 CI 面复核 | 同一 CI run（`codegen-freshness` + 各 typecheck 门） | 绿 | 红 ⟹ 回流 SA3 |
| （承接 Part C §C11 其余各项） | 见 Part C | — | — |

## D12. Non-blocking observations（本轮新增）

| # | 严重度 | 观察 | 建议处置 |
| --- | --- | --- | --- |
| D-O1 | 观察 | SA3 报告 Inputs 行记声明集为「9 份具名证据日志」，Controller 在案记录实为 **10 份**（8 保留 + `relay-redgreen` + `smoke-stability`）——纯计数笔误，保留集↔声明集映射本身逐项精确 | 入库提交信息以 10 为准；无需返工 |
| D-O2 | 观察 | `generate-check.log`/`root-typecheck.log` 仅含命令头（成功静默型命令），未回显退出码（对照红证明的 `RED-EXIT=1` 显式锚） | 后续闸门日志统一追加 `EXIT=0` 尾行；本轮以 CI 同门复跑为旁证放行 |
| D-O3 | 观察 | `ci-failure-evidence.log` 为披露的过滤摘录（原文仅存 GitHub 保留期窗内） | 无需处置（头部已声明 filter；失败原文/总结数/错误标记俱在） |
| D-O4 | 观察 | 红证明的「还原核验 RESTORED-OK」仅见于报告表格、未回显于日志内 | 终态可由 Git 独立证明（`d60760c`↔HEAD↔工作区三重零 diff，本审查已核），无证据损失；后续红证明模板建议内嵌还原核验回显 |
| D-O5 | 观察 | 18 份清理物本体不可恢复，sha256[:12]/bytes 只余报告自述；与 SA9 M-1「含 14 份负载复跑补入库」建议存在已披露分歧 | 维持交 Controller/SA9 裁定（SA3 已披露且固化计数/时序；声明集核对确认其非交付物）；若裁定须入库即重放命令再生 |
| D-O6 | 观察 | iteration-4「复核运行」（2 files/8 tests、tsc、21/221）无日志产物；忙窗锚 1361ms 与 app-suite/shard6 同值 | 机制上系必然同值（§D2-2④），不作为独立稳定性数据采信；后续复核运行建议同样落日志 |

## D13. 复查标记（本轮）

本轮为证据收纳面审查：零实现/测试/文档触碰，无新 ADR 冲突维度；Owner 5751613018 硬契约四方载体原样在位（§D2-5）。`requiresConflictRecheck` 本轮提交 **false**（与同轮 SA8 conflict-gate 并行结论互不依赖）。

---

# Part C — `test (24, 6)` smoke SIGTERM 修复轮（SA3 iteration 3 实现审查，本轮 dispatch 对象）

## C1. Reviewed inputs

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| 本轮 dispatch 指令（独立审查 SA3 修复：direct-node launcher + drain-before-dispose 回归锚 + 无测试弱化/无范围回退；Owner 5751613018 保持） | 已读 | 审查授权范围 + 验收面 |
| SA3 iteration 3 增量 diff：`apps/yjs-server/test/smoke-skeleton-red.test.ts`（+98/−5）+ `wiki/raw/task_issue-412_sa3_impl.md` | `git diff HEAD` 全量逐行核对 | 被审对象 |
| `wiki/raw/task_issue-412_sa3_impl.md`（iteration 3 版） | 已读 | 根因诊断、修复裁决、范围申报、验证申报的交叉核对 |
| `wiki/raw/task_issue-412_implementation_conflict_report.md`（SA8 同轮 conflict-gate 产物，本审查期间 11:56 原位更新） | 已读（全文） | SA8 独立拉取的 Owner comment 5751613018 事实（id/created=updated=2026-09-20T18:03:36Z/作者 welltop-jim-wang）+ 冲突门结论（clear / requiresConflictRecheck false）交叉印证 |
| `node_modules/tsx/dist/cli.mjs`（tsx 4.23.12，lock 固定）+ `preflight.cjs` | 机制源码通读 | 30ms 回执窗 + `SIGKILL` + `process.exit(128+15)`=143 机理独立复核 |
| `apps/yjs-server/src/main.ts`（:214-216 注册点、全 `process.exit` 面）、`app.ts`（:620-637 停机链）、`apps/yjs-server/test/root-lock-atomic-reclaim-red.test.ts:34`（`--import tsx` 先例）、`ordered-shutdown-red.test.ts`（四事件序冻结锚）、`persistence-drain-shutdown.test.ts`（S-5a/b/c） | 已读 | app 无 143 路径、drain→dispose→事件序结构、先例与锚面 |
| `docs/adr/0006-server-persistence-docstore.md`（:242-282 修订节） | 已读 | Owner 硬契约 :270 + dispose 对齐 :276 保持性 |
| `scripts/ci-test-shard.mjs`、`.github/workflows/ci.yml`（:57 shard 矩阵、:76-78 步骤） | 已读 + 本地只读枚举 `node scripts/ci-test-shard.mjs 6 6` | 新用例的 CI 真实触发入口 |
| SA3 证据日志 29 份（`artifacts/sa3-issue412-iter3-*.log`） | 抽读关键 9 份 | CI 失败原文、机制 red/green、仓内红证明、shard 6、稳定性、契约切片、S-5、typecheck、generate --check |
| Git 事实：`git diff --name-only 5b3ff26 f3b13ee`（= 仅 wiki/artifacts）、`git status --porcelain`、两冻结锚文件 status 核对 | 只读 | flaky 判定 + 冻结锚零触碰 |
| `wiki/raw/task_issue-412_design.md` §11 ALLOW/DENY、§12 S-5 | 已读 | 范围裁定依据 |
| `apps/AGENTS.md`、`apps/yjs-server/AGENTS.md` | 已读 | 单一拆卸链纪律、验证门 |

## C2. Verdict

**approve**（0 × BLOCKER；0 × MAJOR；0 × MINOR 阻断项，观察项见 §C12）。

核心判定：

1. **根因诊断成立（本审查静态独立复核）**：tsx CLI 包装进程 `relaySignals` → `waitForSignalFromChild` 的 **30ms** 回执窗（`cli.mjs`：`setTimeout(()=>i(void 0),30)`），超时即 `t.kill("SIGKILL")` + 包装进程 `process.exit(128+ft.signals[r])` = **143**；回执依赖子进程 `preflight.cjs` hidden handler 经内部 pipe 上报，子进程事件循环忙即迟到。app 侧全树 `process.exit` 仅 0/1/注入缝三型（`main.ts:64/82/85/105/175/188/198/221`），**无 143 路径**；`main.ts:214-216` 为仓内唯一 SIGTERM/SIGINT/SIGHUP 注册点（同步注册、无移除点）。同一产品/测试树（`git diff --name-only 5b3ff26 f3b13ee` = 仅 5 份 artifacts + 3 份 wiki）下 run `35534499992` 绿 / `35535478371` 红 ⟹ flaky（非产品缺陷）判定成立。修复对象正确：**修测量仪器（harness 信号送达），不修被测契约**。
2. **direct-node launcher 正确且非第二机制**：`spawn(process.execPath, ['--import','tsx', MAIN_TS, …], { cwd: REPO_ROOT, … })` 与仓内既有先例 `root-lock-atomic-reclaim-red.test.ts:34`（`fork(..., { execArgv: ['--import','tsx'] })`）同款、与发布产物 `bin` node 直跑 `dist/main.js` 同形；信号直达应用 handler，消除包装窗。敏感性双证：机制复现 A 形态 143×3（`app-stopped=false`）vs B 形态 0×3（`app-stopped=true`，`relay-redgreen.log`）；仓内反证——仅还原 spawn 形态、其余逐字节不动，新增用例即以 CI 签名红（`hub (busy window) exit code: expected 143 to be +0`，`smoke-red-proof.log`）。
3. **无测试弱化**：全文件无 `.skip`/`.only`/`.todo`；既有 4 用例断言面**逐字不变**（diff 中断言行零增删，退出码期望保持硬 `toBe(0)`/`toBe(1)`）；`143` 仅出现于注释。新用例反向**加严**：exit 0 + `app-stopped` 存在 + 尾序恰为 `['persistence-disposed','app-stopped']`（`toEqual` 全序列比对——缺事件、乱序、双拆卸链均红）。
4. **Owner 5751613018 硬契约与 ADR 对齐保持且被强化**：本轮产品树零 diff（`git diff HEAD --stat` 中 `packages/**`、`apps/yjs-server/src/**`、`docs/**`、`.github/**`、`domains/**` 全空）；ADR-0006 :270 无条件停机硬契约 + :276 dispose 对齐条款（均明文引用 comment 5751613018）原样在位；`app.ts:624 awaitDrainWithBudget(adapter.drain(), budgetMs)` → `:630` 全仓唯一 `persistenceFiber.dispose()` → `:632/:635` 事件序；S-5a/b/c 重跑 3/3 绿（含 typecheck）、persistence 契约切片 21 files/221 tests 绿；冻结锚（SA6 两契约文件、`ordered-shutdown-red`、persistence 既有测试）`git status` 零触碰。新增忙窗锚把硬契约在「信号送达时事件循环忙」不利条件下钉成可执行红/绿。
5. **范围裁定（唯一 DENY 交叉，裁定不构成违规）**：被改文件落在设计 §11 DENY「`apps/yjs-server/test/` 既有测试（冻结锚）」类目内——但 iteration-3 dispatch **直接指名该文件为 CI 失败面**（「修复 `test (24,6)` 中 `apps/yjs-server/test/smoke-skeleton-red.test.ts` 的 `peer exit code: expected 143 to be +0`」），Controller 后发指令构成对该文件此用途的显式授权，且 SA3 按 skill §实施前检查申报而非自裁。DENY 立法意图（冻结锚零改动即绿、S-5 以新增文件承载）经逐项核实保持：断言面零改动、全部冻结锚零触碰、S-5 承载文件零触碰。SA8 同轮裁决无决策文本抵触（其 §8 行动 1 交 Controller 追认）。**范围追认建议随提交一并完成**（见 §C12 O-1）。

## C3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
| --- | --- | --- |
| 本轮 dispatch：审查 direct-node launcher | §C2-2：spawn 形态、先例同款、red/green 双证、`cwd: REPO_ROOT` 固定解析面 | **落实** |
| 本轮 dispatch：审查新 drain-before-dispose 回归覆盖 | 新用例三重断言（exit 0 / `app-stopped` / `persistence-disposed`→`app-stopped` 尾序）；blocker 运行时注入 + `busy-window-start` 广播把 SIGTERM 精确送进忙窗；与既有 S-5a/b/c（脏写排空/预算/统一路径）互补分工 | **落实**（锚定面见 §C9） |
| 本轮 dispatch：验证无测试抑制 | 无 skip/only/todo；断言面逐字不变；143 零容忍；新用例在旧形态下确定红（敏感性反证） | **落实**（无抑制，门禁净强化） |
| 本轮 dispatch：验证无范围回退 | 产品树零 diff；唯一改动 = dispatch 指名文件 + SA3 固定产物 + 证据日志；DENY 其余面零触碰 | **落实**（唯一 DENY 交叉已裁定，§C2-5/§C6） |
| Owner 5751613018（2026-09-20T18:03:36Z）：dispose 前 await drain **硬契约**保持 | 工作区零触碰 `packages/**`/`apps/**/src/**`；`app.ts:624→:630` 结构在位；新增锚把该时序在忙窗下钉成断言 | **保持且强化** |
| Owner 5751613018：ADR-0006 对齐保持 | `docs/adr/0006` 零 diff；:270 无条件硬契约 + :276 dispose 对齐条款原样在位（均引用该 comment） | **保持** |
| Owner 5751613018：dispose 保持 abortive + 分层公开 drain / retryDelayMs 缺省现行为 | `75bd0ab` 提交态逐字节保持（本轮零触碰）；Part B §3 逐条结论沿用 | **保持** |

## C4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
| --- | --- | --- | --- |
| dispatch 具名失败面修复（`test (24, 6)` 143） | `spawnApp`：`process.execPath + ['--import','tsx',MAIN_TS,…]`，`cwd: REPO_ROOT`，env 副本构造 | 信号直达 app handler；模块解析钉到仓根（pnpm symlink 面）；与发布形态同构 | 无 |
| 「建立可执行 red→green 覆盖」 | 新用例 + `BUSY_WINDOW_BLOCKER_SOURCE`（运行时 tmp 物化，零仓内 fixture）+ `appNodeOptions` 注入缝（3 行可选参数，复用同一 `spawnApp`） | 反证链完整：机制 A/B 双形态 3×3 + 仓内还原红证明（CI 签名逐字复现） | 无 |
| 设计 §12 S-5 承载边界 | S-5a/b/c 仍由 `persistence-drain-shutdown.test.ts`（新增文件）承载，本轮零触碰；新忙窗锚归入 dispatch 指名文件 | DENY 立法理由「S-5 以新增文件承载」未被绕开 | 无 |
| 断言面冻结 | diff 中既有 4 用例断言/事件序/锁守卫/durable 回读行零增删（本审查逐行核对） | 逐字保持 | 无 |

## C5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
| --- | --- | --- | --- |
| SIGTERM 语义/停机链 | app（`main.ts`/`app.ts`） | 零改动，唯一注册点保持 | 正确（产品未被拉进 harness 修复） |
| 信号送达形态（测试装配） | 测试 harness | `spawnApp`（测试内） | 正确（修复位于问题拥有层） |
| 忙窗注入 | 测试 fixture | 运行时 tmp blocker + `NODE_OPTIONS`（仅子 spawn env 副本） | 正确（不污染 `process.env`、零产品缝） |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
| --- | --- | --- | --- | --- |
| TS 进程测试启动 | `root-lock-atomic-reclaim-red.test.ts:34` `fork` + `execArgv: ['--import','tsx']` | `spawn(process.execPath, ['--import','tsx', …])` | 一致（同款） | 直跑形态复用仓内先例，非新造 |
| 发布进程启动 | `bin` node 直跑 `dist/main.js` | 同为 node 直跑（无包装层） | 一致 | 测试形态与生产形态同构，反而消除了旧形态的失配 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
| --- | --- | --- | --- |
| app 生命周期事件 | app stdout NDJSON（`this.sink`） | `proc.events` 累积缓冲（既有机制，未改） | 无新增 |
| 退出码语义 | 进程 exit code（`waitForExit` 直读） | 无第二推断 | 无 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
| --- | --- | --- | --- |
| `spawnApp` 注册 `liveProcs` + `makeTmpDir` 注册 `tmpDirs` | `afterEach` SIGKILL 兜底 + `rmSync` 递归清理（既有机制覆盖新用例的 blockerDir/hubRoot） | 用例内超时 throw 带 stderr；CI 步骤原文可复跑 | 对称（沿用既有清理链，无泄漏路径） |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
| --- | --- | --- | --- |
| 第二 spawn 助手/launcher 抽象 | `spawnApp` 单一函数 | 扩展同一函数（可选参数） | 非平行机制（未新建） |
| 仓内 blocker fixture | 无（避免仓内 fixture） | 运行时 tmp 物化 + 内联常量 | 合理（零仓内面） |

## C6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
| --- | --- | --- | --- |
| `apps/yjs-server/test/smoke-skeleton-red.test.ts`（+98/−5，tracked） | 设计 §11 DENY「`apps/yjs-server/test/` 既有测试」× **iteration-3 dispatch 具名豁免**（该文件为指名失败面） | launcher 修复 + red→green 回归锚 + 根因注释 | **裁定 in-scope**（§C2-5：SA3 已申报、SA8 裁决无决策抵触、DENY 立法意图保持；追认建议见 O-1） |
| `wiki/raw/task_issue-412_sa3_impl.md`（tracked，SA3 固定产物） | 非 DENY 名单内 wiki 文件（DENY 仅列 Host/SA6/SA2/SA8 四产物） | iteration 3 报告原位更新 | 合规 |
| `artifacts/sa3-issue412-iter3-*.log` × 29（未跟踪） | 仓内 SA3 证据惯例（`git ls-files artifacts/` 既有 200+ 项） | 验证留档 | 合规（不触产品/测试树） |
| `wiki/raw/task_issue-412_implementation_conflict_report.md`（+70/−67，**非 SA3 改动**） | SA8 自身固定产物（conflict-gate iteration 4，本审查期间 11:56 原位更新，文内含 dispatch `sa-bf993d19`） | SA8 同轮冲突门复审 | **不归入 SA3 范围**（本行留档防误归因；SA3 申报的 2 文件与其出口状态一致） |

其余 DENY 面（`packages/persistence/src/{service,testing}.ts`、`namespace-registry/**`、`dsh-persistence/{record,events,profile,cli}.ts`、persistence 既有测试、SA6 两契约文件、其余 apps 既有测试、`docs/protocols/**`、`packages/ws-replication/**`、Host/SA2/SA6/SA8 wiki 产物、`packages/vfsl-codegen/**`、`.github/**`、`domains/**`）本轮 `git diff`/`git status` 零触碰。

## C7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
| --- | --- | --- | --- | --- |
| spawn 参数面 `['--config', <abs path>]` | app `main.ts` argv 解析 | 不变（仅 argv[0] 由 shim 脚本变 node 二进制、前置 `--import tsx` 标志） | 无 | 无 |
| stdin/stdout NDJSON 控制面 | `sendOp`/`waitForEvent` | 逐字节不变；新用例仅**读** stdout 事件 | 无 | 无 |
| 事件词表 | `hub-peer-deployment.md` 词表 + 四事件序冻结锚 | 零新增产品事件（`busy-window-start` 是测试注入物，不经产品 `sink`） | 无 | 无 |
| vitest/CI 装配 | 根 `vitest.config.ts`、`ci.yml`、分片器 | 零改动；文件由分片器磁盘枚举落入 shard 6（本审查本地枚举复核） | 无 | 无 |
| `process.env.NODE_OPTIONS` 传递 | CI 步骤 `NODE_OPTIONS=--conditions=nomicore-source` | 子 spawn 继承 + 追加（仅注入用例）；`--import` 在 NODE_OPTIONS 白名单内（Node ≥20.6） | 无 | 无 |

## C8. 错误、恢复与并发

| 维度 | 证据 | Assessment |
| --- | --- | --- |
| 143 机理与竞态窗 | `cli.mjs` `waitForSignalFromChild` 30ms + `SIGKILL` + `process.exit(128+15)`；`preflight.cjs` pipe 回执依赖子进程事件循环调度（本审查源码复核，与 SA3 引用一致） | 诊断成立；修复消除该窗而非放宽断言 |
| flaky 双态判定 | `git diff --name-only 5b3ff26 f3b13ee` = 仅 wiki/artifacts（产品/测试树逐字节相同），run `35534499992` 全绿 vs `35535478371` 单 job 红 | 同因零差异双态 ⟹ 非产品缺陷，论证闭合 |
| 新用例时序鲁棒性 | blocker 起播 900ms 晚于实测 ready（~350-550ms）；announce→50ms→SIGTERM 落 400ms 忙窗内；退出等待 30s ≫ 400ms 阻塞；即使 boot 慢于 900ms，415ms 周期留 ~15ms 空隙推进，`waitForEvent` 60s 窗兜底 | 忙窗命中确定性充分；`waitForEvent(hub ready)` 先于 `busy-window-start` 且事件缓冲累积，无顺序死锁 |
| 失败语义 loud | `waitForEvent`（进程提前退出/超时 throw 带 stderr）、`waitForExit`（超时 SIGKILL + throw）、`signalAndExpectExit`（硬 `toBe`）均保持 | 无吞错、无软化 |
| 资源清理 | `liveProcs` SIGKILL + `tmpDirs` rmSync 于 `afterEach`（blockerDir/hubRoot 均经 `makeTmpDir` 登记） | 无泄漏；blocker 不写仓内 |
| 注入隔离 | `appNodeOptions` 仅写入该次 spawn 的 env 副本；blocker `isAppProcess` 守卫（argv[1] 尾缀 `main.ts`）防止未来包装形态继承时度量错对象 | 隔离正确 |

静态无法确认项列入 §C11（CI 真实 runner 剖面、负载下偶发等待超时）。

## C9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
| --- | --- | --- | --- | --- |
| 既有 4 用例（认证 401/403/101；启动序 + verify-write 收敛 + SIGTERM exit 0；锁释放重启 durable 回读；共享 root loud 拒绝 exit 1） | 逐字不变（本审查 diff 逐行核对：断言行零增删） | CI `test (20\|24, 6)`：`node scripts/ci-test-shard.mjs 6 6` 磁盘枚举含本文件（本地只读复核）→ `vitest run $files`；SA3 以步骤原文复跑 66 files/746 tests 绿（`shard6-node24.log`） | 无弱化 | 无 |
| 新增「SIGTERM 直达 app 进程：忙窗内送达仍完成排空链 → exit 0」 | exit `toBe(0)`；`app-stopped` 存在；尾序 `toEqual(['persistence-disposed','app-stopped'])`（Owner 5751613018 硬契约忙窗锚，兼钉双拆卸链） | 同上（shard 6）；Node 24 五连跑 + 14 次负载复跑 + Node 20 替身均绿 | 敏感性已由反证锚定（还原 spawn 形态→CI 签名红，`smoke-red-proof.log`）；gap 见 O-3/O-4（非阻断） | 无 |
| S-5a/b/c（`persistence-drain-shutdown.test.ts`，已提交） | drain 完成式/预算诚实事件先于 dispose/memory 统一路径 drain 恰一次先于事件 | SA6 §12 runner：`vitest run --typecheck`；本轮 3/3 绿 | 本轮零触碰 | 无 |
| persistence 契约切片（21 files/221 tests 含 SA6 两文件） | #412 契约面零回退 | `persistence-contract.log` 全绿 + typecheck no errors | 零触碰零回退 | 无 |

抑制面核查：全文件无 `.skip`/`.only`/`.todo`/`xit`；`grep 143` 仅命中注释；红证明日志中的「4 skipped」系 `-t` 名称过滤的证据运行形态，非文件内抑制。

## C10. Required revisions（本轮）

无 BLOCKER / MAJOR / MINOR finding。范围追认（O-1）属 Controller 记录动作，不构成实现返工项。

## C11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
| --- | --- | --- | --- |
| CI 真实 runner（4 vCPU 并行剖面）下 `test (24, 6)`/`test (20, 6)` 复跑 | Controller push 后 CI | 两 job 绿（本机 Node 24 步骤原文 66/746 绿、Node 20 替身绿为前置证据） | 复现 143 或忙窗用例超时 ⟹ 回流 SA3（本审查静态判定修复充分，未运行测试） |
| 其余 14 个仍用 `TSX_BIN` 包装形态的 apps 测试（实测 grep 计数；SA3/SA8 报告计 13）暴露同一 30ms 转达窗 | 后续变更集 / CI 长尾观测 | 无新 143 形态 flake；统一迁移后消失 | 任一文件再现 `expected 143` ⟹ 按同根因处理（SA3 已留机理与修复模板） |
| SA3 登记的 1 次未复现负载失败（4× 超订下 `1 failed \| 4 passed`，无 143 字样，疑等待超时/端口竞态；后续 17 次负载 + shard + 9 常规未复现，原始轮未留档） | CI 复跑与负载剖面 | 持续不出现 | 规律性再现非 143 失败 ⟹ 独立诊断（勿与转达窗混同） |
| 忙窗锚在真实 CI 慢机的落窗精度（stdout 传播延迟 >400ms 时 SIGTERM 落入间隙） | CI 复跑 | 仍绿（锚保底度量「信号直达 + 链完成」，落窗偏差只弱化单次覆盖面，不产生假红） | 出现假红 ⟹ 调整 announce→sleep 间隔 |
| （承接 Part A §A11 / Part B §B11 各项——generate --check CI 复核、慢盘预算充分性、nomic-server 采纳、S-5a 墙钟余量） | 见各 Part | — | — |

## C12. Non-blocking observations（本轮新增）

| # | 严重度 | 观察 | 建议处置 |
| --- | --- | --- | --- |
| O-1 | 观察 | 设计 §11 DENY「apps/yjs-server/test/ 既有测试」与 iteration-3 dispatch 指名修复面存在文字层冲突；SA3 已按 skill 申报、SA8 裁决无决策抵触、本审查裁定 in-scope——但设计记录本身未留痕，后续轮次可能误读为「DENY 可自由触碰」 | 建议 Controller/SA1 在提交追认时于设计记录或 dispatch 记录补一行「iteration-3 具名豁免仅限该文件该用途」 |
| O-2 | 观察 | 修复未消除同类暴露面：其余 14 个 apps 测试仍用 `.bin/tsx` 包装形态（`grep -l TSX_BIN`），同一 30ms 窗 flake 风险仍在；SA3 已如实申报并交决策 | 后续变更集统一迁移 `node --import tsx` 或抽公共 spawn 助手（SA3/SA8 均已建议） |
| O-3 | 观察 | 忙窗锚只起 hub 进程；CI 失败观测点在 peer 退出码。`spawnApp` 为 hub/peer 共享缝（第 2 用例的 peer SIGTERM 断言未动），机制面已覆盖，但 peer 忙窗变体未单独锚定 | 可选后续加固（非必需） |
| O-4 | 观察 | 忙窗用例 SIGTERM 时 hub 无脏写（drain 对干净面即时结算）——锚定「信号送达 + 链完成 + 尾序」而非「忙窗下脏数据耐久」；后者由 S-5a durable 回读承载 | 无需处置（分工明确） |
| O-5 | 观察 | 计数/行数出入两处：SA3/SA8 报告记 smoke diff「+92/−5」，实测 `git diff HEAD --numstat` = +98/−5（内容与本审查逐行核对一致，出入系报告引用旧计数）；「13 个其余文件」实测 14 | 提交信息以实测数为准，无需返工 |

## C13. 复查标记（本轮）

本轮未发现新的 ADR 冲突维度：修复仅触测试 harness spawn 机制与新增测试锚；ADR 0006 :270/:276 硬契约载体零触碰且被新锚强化；无公共 API/wire/schema/生命周期/失败语义变化。与 SA8 同轮 conflict-gate 结论（clear / requiresConflictRecheck **false**）一致。`requiresConflictRecheck` 本轮提交 **false**。

---

# Part A — codegen-freshness CI 修复轮（iteration 1；已提交为 `9094760`，结论保持）

## A1. Reviewed inputs

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| 本轮 dispatch 指令（修复失败的 `codegen-freshness` 检查，最小安全改动，保持 #412 语义） | 已读 | 审查授权范围 + 验收面 |
| Owner comment `5751613018`（updated `2026-09-20T18:03:36Z`） | dispatch 传入 + Part B §3 `gh api` 全文核对沿用 | drain-before-dispose 硬契约 + ADR 对齐的保持性基准 |
| 当前 diff：`domains/vfs3-assets/generated.ts`、`packages/vfsl/test/{int-range,number-literals}-fixture-drift.test.ts`、`wiki/raw/task_issue-412_sa3_impl.md` | 逐行核对（`git diff` 全量） | 最小性/正确性 |
| `wiki/raw/task_issue-412_sa3_impl.md`（本轮更新版） | 已读 | 诊断根因、修复裁决、验证申报的交叉核对 |
| `.github/workflows/ci.yml:128-147`（`codegen-freshness` job） | 已读 | CI 触发面：唯一步骤 `pnpm generate --check`（:147） |
| `domains/AGENTS.md` §Workflow 1-4 | 已读 | 生成物刷新规定动作（2/3：重生成而非手改） |
| `packages/vfsl-codegen/src/header.ts`、`emitter.ts`、`protocol-surface.ts`、`packages/vfsl-codegen/package.json` | 已读 | 横幅版本自同步机制 + 发射器输入面 |
| `packages/vfsl-codegen/test/generate-union-member-docs.test.ts:523-544` | 已读 | 仓内新鲜度负控（字节比对 + spawn `--check`） |
| Git 考古：`git log -- domains/vfs3-assets/{generated.ts,schema.vfsl}`、`git show abbb89a -- packages/vfsl-codegen/package.json`、`git show --stat abbb89a -- domains/`、`git log 2fdac1b..HEAD -- packages/vfsl-codegen/src` | 只读核对 | 根因归属 + 重生成输出确定性 |
| `sha256sum` 独立复算（worktree/HEAD/schema.vfsl） | 已执行（只读） | 钉值逐字节核验 |
| HEAD `75bd0ab` 提交内容抽验（`packages/persistence/src/lifecycle.ts`、`apps/yjs-server/src/app.ts`、`docs/adr/0006-server-persistence-docstore.md`） | grep 定位核对 | #412 硬契约保持性 |
| `wiki/raw/task_issue-412_implementation_conflict_report.md`（SA8 实现后复审） | 已读（头部） | 冲突门闭合状态 |

## A2. Verdict

**approve**（0 × BLOCKER；0 × MAJOR；本轮新增 0 × MINOR 阻断项，观察项见 §A12）。

核心判定：

1. **最小**：生成物改动 = 头注横幅**恰 1 行**（`@nomicore/vfsl-codegen@0.1.3 → 0.2.0`）；两哨兵各 = `GENERATED_SHA256` 1 行 + 重钉原因注释 2 行，断言与语义指纹常量零改动；`git status` 全工作区恰 4 文件。
2. **正确**：新钉值 `a934f62d…d65b` = 本审查独立 `sha256sum` 复算值（逐字节一致）；横幅版本 = 当前 `packages/vfsl-codegen/package.json` `0.2.0`；`Source hash` 未变且 = `sha256sum schema.vfsl`（schema 自 `2fdac1b` 零改动）⟹ 除横幅外生成物 = 既有已验证字节，语义零漂移。
3. **不改变 #412 语义**：本轮 4 文件与 #412 设计 §11 全部 15 行 ALLOW 路径**零交集**；`75bd0ab` 提交体内的 drain-before-dispose 硬契约（lifecycle.ts:858 `drain()`、app.ts:559/624 `awaitDrainWithBudget`、:625 预算尽诚实事件、ADR 0006 :242/:270 无条件硬契约条款）逐项抽验在位、逐字节未被触碰。
4. **根因归属成立**：漂移源自发布提交 `abbb89a`（版本 0.1.3→0.2.0，`git show --stat … -- domains/` 为空 = 未同步重生成），生成物自 `2fdac1b` 起未再重生成——仓库级历史遗留，非 #412 变更集引入（`75bd0ab` 零触碰 `domains/**`、`packages/vfsl*/**`）。

## A3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
| --- | --- | --- |
| 本轮 dispatch：「review the CI-repair implementation…confirm the generated output and fixture sentinel updates are minimal, correct, and do not alter issue #412 semantics」 | 见 §A4/§A5/§A6/§A8：最小性（1+1+1 行级改动）、正确性（钉值/横幅/Source hash 三重复算）、语义保持（零交集 + 提交体抽验） | **落实** |
| 本轮 dispatch：「repair the failed codegen-freshness CI check…smallest safe change」（SA3 侧执行指令） | 修复 = 规定动作 `pnpm generate`（`domains/AGENTS.md` §Workflow 2/3）而非手改生成文本/削弱门禁；备选（改 `header.ts` 钉死/去版本横幅）被正确否决——会削弱 ADR 0005 §4 生成器漂移警报且触碰 `packages/vfsl-codegen/**`，非最小 | **落实**（工程裁决正确） |
| Owner comment `5751613018`（2026-09-20T18:03:36Z）：dispose 前 await drain 的**硬契约**保持 | 工作区 diff 零触碰 `packages/persistence/**`、`apps/yjs-server/**`；提交体锚在位：`lifecycle.ts:858 async drain`、`app.ts:624 await this.awaitDrainWithBudget(adapter.drain(), budgetMs)`（唯一 `persistenceFiber.dispose()` 之前）、`:625 persistence-drain-budget-exceeded` | **保持**（本轮改动在物理上不可能影响该契约——不同文件） |
| Owner comment `5751613018`：ADR 对齐（ADR 0006 修订节）保持 | 工作区 diff 零触碰 `docs/adr/**`；`docs/adr/0006-server-persistence-docstore.md:242` 修订节 + `:270` 无条件硬契约条款（明文引用 comment 5751613018）在提交体中原样在位 | **保持** |
| Owner comment `5751613018`：dispose 保持 abortive、分层公开 drain | `75bd0ab` 提交体未变（本轮零触碰）；Part B §3 逐条核对结论沿用 | **保持** |

## A4. 设计落实审查（修复裁决 vs 规范动作）

| Design decision / 规范 | Implementation location | Assessment | Finding |
| --- | --- | --- | --- |
| ADR 0005 §4 / CI 注释（ci.yml:124-127）：新鲜度 = 全量重生成 → 与仓内生成物**逐字节 diff**（双抓源漂移与生成器漂移） | 修复采用「重生成刷新横幅」——正是该机制设计上要求的动作：横幅版本 = 生成时运行时读 `package.json`（header.ts:5-8 doc-comment 明示「版本 bump 后头注自动随之变化，regen-diff 自动报警」） | 忠实——版本 bump 后横幅必须随 regen 更新，保持旧横幅的任何方案都是对门禁的削弱 | — |
| `domains/AGENTS.md` §Workflow 2/3：「Run root `pnpm generate` to refresh generated projections」「change generator code rather than hand-editing generated output」 | 生成物差异恰 = 横幅一行；投影类型体/TSDoc/`declare module` 增广逐字节未变（`git diff` 1 insertion/1 deletion + 双向 sha256 复算） | 忠实。注：静态无法区分「真跑 regen」与「手改同一行」，但两者**字节结果等价**且等价性有三重独立锚（见 §A8），新鲜度闭环由 CI 步骤本身终判 | — |
| 根因诊断：漂移始于 `abbb89a` 而非 #412 变更集 | `git show abbb89a -- packages/vfsl-codegen/package.json` = `0.1.3→0.2.0`；`git show --stat abbb89a -- domains/` = **空**；`git log --oneline -- domains/vfs3-assets/generated.ts` 末次 = `2fdac1b` | 属实。#412 提交 `75bd0ab` 与 `domains/**`、`packages/vfsl*/**` 零交集 | — |
| 哨兵重钉裁决：重钉而非回滚重生成 | 回滚 ⟹ `codegen-freshness` 永久红（版本不可能回退）；两哨兵 doc-comment 自述「重新生成即此处先红」（number-literals:48 / int-range:66）= 设计上预期 regen 先红、人工确认语义中性后重钉——#314/#315 既定工作流 | 裁决正确，且为使 root `pnpm test` 与 CI 同时转绿的**唯一**语义中性路径 | — |

## A5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
| --- | --- | --- | --- |
| 生成器身份横幅 | 生成器（header.ts 运行时读 package.json，单一事实源） | 未引入 `GENERATOR_VERSION` 手工常量（header.ts:7-8 明示消除该漏报失败模式） | 正确——无第二版本事实源 |
| 生成物字节 | `pnpm generate`（唯一写者） | 修复走 regen 通道；无手改投影文本 | 正确 |
| 字节钉值哨兵 | 各任务域测试（#314/#315） | 仅重钉 `GENERATED_SHA256` + 注释；指纹常量与断言不动 | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
| --- | --- | --- | --- | --- |
| 版本 bump 后生成物刷新 | `domains/AGENTS.md` §Workflow 规定动作；历史上 `8d6edf1`（six packages bump）等发布提交均伴随重生成 | 本轮同款（regen + 哨兵随动） | 一致 | 复用规定通道，无旁路 |
| 新鲜度门禁 | CI `codegen-freshness`（ci.yml:128-147）+ 仓内负控 `generate-union-member-docs.test.ts:529/:538` | 修复目标是这两道门的同一事实（盘上字节 == regen 输出） | 一致 | 双门同锚，修复不选择性满足其一 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
| --- | --- | --- | --- |
| 生成器版本 | `packages/vfsl-codegen/package.json` | 生成物横幅（生成时快照） | 低——regen-diff 门禁使横幅滞后即红（这正是本次抓到的漂移） |
| 生成物字节 | `pnpm generate` 输出 | 两哨兵 `GENERATED_SHA256` 钉值 | 低——钉值随审定的语义中性 regen 重钉，fail-loud 对后续改写保持 |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
| --- | --- | --- | --- |
| 绕开 regen 的「横幅同步」脚本/常量 | 无 | 未引入（备选被否决） | 无平行 |
| 第二套新鲜度判定（纯哈希比对） | 无（CI 注释明言纯哈希抓不到生成器漂移） | 未引入 | 无平行 |

## A6. 文件范围审查

`git status --porcelain` 恰 4 条（无 untracked 实现文件）：

| Changed path | ALLOW entry | Purpose | Assessment |
| --- | --- | --- | --- |
| `domains/vfs3-assets/generated.ts` | 不在 #412 设计 §11 ALLOW/DENY 两表内——**本轮 dispatch 明示扩权**（repair codegen-freshness）+ `domains/AGENTS.md` §Workflow 2/3 规定动作 | 刷新生成器身份横幅 1 行 | **贴合扩权范围**。非 DENY；`schema.vfsl`、`packages/vfsl-codegen/**` 零触碰 |
| `packages/vfsl/test/int-range-fixture-drift.test.ts` | 同上（dispatch 扩权的必然后果：哨兵钉死旧字节，不重钉则 `pnpm test` 必红、CI 不绿） | `GENERATED_SHA256` 重钉 + 2 行注释 | 贴合（issue #315 哨兵；断言/语义指纹零改动） |
| `packages/vfsl/test/number-literals-fixture-drift.test.ts` | 同上 | 同上（issue #314 哨兵） | 贴合 |
| `wiki/raw/task_issue-412_sa3_impl.md` | SA3 自有过程产物（非实现） | 本轮修复报告 | 不属实现范围 |

DENY 零触碰复核：设计 §11 DENY 全表（service.ts/testing.ts/namespace-registry/dsh 四文件/persistence 冻结审计/**SA6 两契约文件**/yjs-server 既有测试/docs:protocols/ws-replication/上游 wiki）+ `packages/vfsl-codegen/**` —— `git status` 全部干净。范围申报与 SA3 报告「本轮范围申报」节一致，无瞒报。

## A7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
| --- | --- | --- | --- | --- |
| 生成物字节变化（横幅行） | ① `domains/vfs3-assets/index.ts`（`export * from './generated.js'`）+ 域内 3 测试（2 `.test-d.ts` 类型面 + tsdoc 挂载面） | 投影类型/TSDoc 体逐字节未变 ⟹ 类型面与 tsdoc 断言零影响（SA3 申报 3 files/31 tests 绿） | 无 | — |
| | ② 两字节哨兵（#314/#315） | 恰为本轮重钉对象——唯一的受影响 caller，已同步 | 无 | — |
| | ③ 新鲜度负控 `generate-union-member-docs.test.ts:529`（regen 输出 vs 盘上逐字节比对，含横幅）/`:538`（spawn `pnpm generate --check` 期待 exit 0） | 修复前两者红（横幅 0.1.3 vs 包 0.2.0——即 iteration 0 报告的「2 个既有失败」的机械构成）；修复后转绿的充要条件 = 盘上文件 **全字节** 等于 regen 输出 | 无——该负控使「只改横幅但投影体漂移」的伪造修复必然在此红 | — |
| | ④ CI `codegen-freshness`（:147 `pnpm generate --check`） | 同③ | 无 | — |
| 哨兵重钉 | 后续任何 `domains/vfs3-assets/**` 改写 | 哨兵继续 fail-loud（钉值 = 新字节，任何再改写即红）；内联注释记录重钉缘由与语义中性证据 | 无 | — |
| #412 契约面（drain API/事件/ADR 条款/SA6 契约文件） | 全部 caller | 本轮零触碰（不同文件） | 无 | — |

## A8. 错误、恢复与并发

- **确定性/幂等**：`header.ts:4`「同（输入, 包版本）→ 逐字节同输出」；`schema.vfsl` 未变 + 包版本未再变 ⟹ 重复 regen 收敛到当前盘上字节，`--check` 稳定 exit 0（非偶然通过）。
- **掩蔽风险（本轮重点攻击面）——结论：无掩蔽**。重钉可能掩盖「生成物真实语义漂移」的路径全部排除：
  1. `schema.vfsl` 工作区零改动（git status）且 `sha256sum schema.vfsl` = `82e98fa…b93c69` = 生成物头注 `Source hash` ⟹ 无源漂移；
  2. 生成物除横幅行外与 HEAD 逐字节相同（`git diff` 单 hunk；HEAD sha256 = 旧钉值 `342d8c1f…e6707`，worktree sha256 = 新钉值 `a934f62d…d65b`，均独立复算）⟹ 投影体零漂移；
  3. 生成器源码自末次 regen（`2fdac1b`）起的三次变更均不改本域输出：`b158f98`（ADR 0019 成员 doc——本域无成员 doc 派生物，负控 :529 的前提）、`9742a28`（ADR 0020 Int/Range——`schema.vfsl` 零 Int/Range 记号，grep 0 命中）、`0860870`（ADR 0024——仅 `protocol-surface.ts` 碰撞守卫名单 +`DeepOptional`，该名单仅作 fail-loud 断言输入（emitter.ts:143-145），本域别名 `AssetId/Audit/AssetEntity/Attachments/ROOT` 与 13 名协议导出零碰撞 ⟹ 发射字节不变；#314/#315/#316 冻结门禁历史记录亦证 ADR 0020 集成后字节仍为 `342d8c1f…`）。
- **失败模式**：若上述任一排除不成立（即 regen 输出不止横幅一行），CI :147 与负控 :529 必红——修复不可静默半成立。静态无法运行的动态终判列入 §A11。
- **域全集**：`FileSchemaSource.list()` 恰为 `[vfs3-assets@1]`（哨兵断言）⟹ 不存在第二个陈旧域生成物使 `--check`（全量）失败。

## A9. 测试质量审查（本轮触面）

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
| --- | --- | --- | --- | --- |
| `packages/vfsl/test/number-literals-fixture-drift.test.ts`（#314 哨兵，3 tests） | ① `list()` == `[vfs3-assets@1]`；② envelope/semantic 指纹逐字节 == 基线 + `sha256:v1:` 前缀；③ `generated.ts` sha256 == 钉值 | root `pnpm test` 分片（`packages/*/test/**/*.test.ts`；iteration 0 曾实测触发，发现性已证） | **零弱化**：改动仅钉值 1 行 + 注释 2 行；②的指纹源自 `schema.vfsl`（未触碰）经 `compileSchemaEnvelope`，与横幅正交——保持不变是正确而非遗漏；无 skip/only/todo（全文通读） | — |
| `packages/vfsl/test/int-range-fixture-drift.test.ts`（#315 哨兵，5 tests） | 同上 ③ + 新 fixture 编译/指纹稳定/IR JSON 往返 | 同上 | 同上（同款重钉，断言面零改动） | — |
| `packages/vfsl-codegen/test/generate-union-member-docs.test.ts` 负控（:529/:538，**零触碰**） | regen 输出 vs 盘上全字节相等；spawn `pnpm generate --check` exit 0 | root `pnpm test` 分片 + CI typecheck 作业 | 无——本修复的行内验收器；对「横幅外漂移」敏感（全字节比对） | — |
| CI `codegen-freshness`（ci.yml:128-147） | `pnpm generate --check` exit 0（全量重生成 diff 为空；零域集 exit 2 响亮失败） | push/PR CI | 无——本轮修复的直接目标门禁 | — |
| SA6 两契约文件（#412） | 27 运行期 + 5 类型 | root `pnpm test`/typecheck | 零触碰（git status 干净）——红灯契约保持 | — |

**SA6 红灯保持（跨轮）**：#412 两契约文件与冻结审计零触碰。**哨兵敏感性**：重钉后钉值 = 当前真实字节，任何后续改写（含手改横幅以外的任何行）即红——敏感性经构造保持。

## A10. Required revisions（本轮）

无 BLOCKER / MAJOR / MINOR finding。

## A11. 后续动态验证项（本轮新增）

| Risk | Driver | Expected observation | Failure condition |
| --- | --- | --- | --- |
| `pnpm generate --check` 在 CI 环境实际 exit 0（本审查静态推断修复充分，未运行） | CI push 后 `codegen-freshness` job | job 绿 | 仍红 ⟹ regen 输出存在横幅外差异（§A8 排除链有漏），回流 SA3 |
| root `pnpm test` 全绿申报（5242 tests，含两重钉哨兵与 :529/:538 负控）复现 | 后续验证角色 | 全绿 exit 0 | 两哨兵或负控任一红 |
| （承接 Part B §11 各项——慢盘预算充分性、nomic-server 采纳、S-5a 墙钟余量、claim 环交错） | 见 Part B | — | — |

## A12. Non-blocking observations（本轮新增）

| # | 严重度 | 观察 | 建议处置 |
| --- | --- | --- | --- |
| R-1 | 观察 | 已关闭任务 #314/#315/#316 的冻结 wiki 记录（如 `task_issue-316_sa6_contract.md` C2b）仍以 `342d8c1f…` 描述当时钉值——现为历史值。属冻结过程产物，非活门禁，无漂移风险 | 不处置（上游产物只读；本行留档说明差异缘由） |
| R-2 | 观察 | iteration 0 报告把「2 个既有失败」归因于 `generate-union-member-docs` 新鲜度断言，本轮报告归因于两字节哨兵——两说不矛盾（修复前红 = :529/:538 两测；重生成后红 = 两哨兵），机械构成已在本审查复核闭合 | 无需处置；本轮报告已含完整诊断 |
| R-3 | 观察 | 两哨兵重钉注释中「生成物 Source hash 未变」等三重语义中性证据内联在测试处——优于仅改钉值无说明的惯例 | 保持（后续同类重钉建议沿用此注释纪律） |

## A13. 复查标记（本轮）

本轮未发现新的 ADR 冲突维度：横幅刷新是 ADR 0005 §4 门禁的**规定动作**而非对齐例外；哨兵重钉遵循 #314/#315 既有工作流。`requiresConflictRecheck` 本轮提交 **false**（Part B 轮次的实现后冲突复查已由 SA8 产物 `task_issue-412_implementation_conflict_report.md` 承担）。

---

# Part B — #412 主体实现审查（iteration 0；已提交为 `75bd0ab`，结论保持）

> 本轮复核：`git show --stat 75bd0ab`（27 文件）与设计 ALLOW 对齐；提交后 `packages/persistence/**`、`apps/yjs-server/**`、`docs/adr/0006/**`、`CONTEXT.md`、`docs/integration/**`、SA6 两契约文件均零后续触碰（`git status` 仅 Part A 的 4 文件）；关键锚 grep 在位（`lifecycle.ts:858 drain`、四移除点 `releaseSettleWaiters` :679/:709/:831/:1195、`app.ts:559/624/625`、ADR 0006 :242/:270）。iteration 0 审查结论 **approve** 无需修订，原文保持如下。

- 审查对象（当时）：SA3 实际实现 + 测试（13 文件修改 + 2 新增测试文件；diff 全量核对）
- 适用 Owner 要求：Issue comment ID `5751613018`，updated `2026-09-20T18:03:36Z`（MEMBER）——`gh api` 独立拉取全文核对
- 审查纪律：静态实现审查（未运行测试/未启动服务/未修改实现；`npx vitest list` 仅做 runner 发现枚举，不执行用例）

## B1. Reviewed inputs

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| `wiki/raw/task_issue-412.md` | 已读 | Issue 正文（缺口 1/2、请求面、消费方证据） |
| Issue #412 正文 + comment 5751613018（`gh` 只读拉取） | 已读 | Owner 硬契约 + ADR-0006 对齐 + 分层 drain + 第三击穿窗口 + 问题 2 解耦确认；评论 updated_at 与 dispatch 一致（2026-09-20T18:03:36Z，MEMBER），无更新版本 |
| `wiki/raw/task_issue-412_design.md`（iteration 2，558 行） | 已读 | 批准设计：DD-1~DD-8、§8 状态机、§11 ALLOW/DENY、§12 验收映射 |
| `wiki/raw/task_issue-412_sa2_review.md` | 已读（§2 verdict approve / §13 修订映射） | SA2-1~SA2-13 落实核对基准 |
| `wiki/raw/task_issue-412_sa6_contract.md` | 已读（§5/§8/§13/§15） | 契约项 C1–C14、红灯归因、D-5 语义缺口（S-1~S-4）、冻结审计裁决 |
| `wiki/raw/task_issue-412_design_conflict_report.md` | 已读（O1–O3 + D1–D19 + 行动 1–7） | SA8 约束：同变更集、缺省不物化、注释诚实性、liveness 不变量 |
| `wiki/raw/task_issue-412_sa3_impl.md` | 已读 | 实现报告（changed paths / 验证命令 / deviations） |
| 源码 diff：`packages/persistence/src/{contract,lifecycle,memory,file,index}.ts`、`packages/dsh-persistence/src/probe.ts`、`apps/yjs-server/src/{app,config,main}.ts`、四份文档 | 逐行核对 | 实现保真 |
| 测试：SA6 两契约文件 + 新增 `persistence-issue-412-drain-semantics.test.ts`（9 tests）+ `persistence-drain-shutdown.test.ts`（3 tests）+ 既有锚 | 逐行核对 | 测试质量与触发面 |
| `vitest.config.ts`、`.github/workflows/ci.yml`、`packages/persistence/AGENTS.md`、`apps/yjs-server/AGENTS.md` | 已读 | runner/CI 触发与模块验证门 |

## B2. Verdict（iteration 0）

**approve**（0 × BLOCKER；0 × MAJOR；4 × MINOR 全部非阻断，见 §B10/§B12）。

核心判定：实现与 iteration 2 批准设计**逐条忠实**；Owner 三项硬要求（硬契约成文且 app 结构性强制、ADR-0006 :86 修订对齐、分层公开 drain 且 dispose 保持 abortive）全部落地并有行为级测试锚定；SA2-1/SA2-7 两个 MAJOR 修订的验收行（S-5a/S-5b/S-5c）真实存在、断言敏感、被真实 runner 触发；文件范围严格贴合 ALLOW 15 行，DENY 零触碰。

## B3. 上游要求落实

Owner 评论按 Comment ID + updated_at 核对（5751613018，2026-09-20T18:03:36Z，MEMBER——`gh api repos/nomicore-ai/nomicore/issues/comments/5751613018` 全文拉取；该 issue 仅有此一条评论，无更新版本覆盖）。

| Requirement or finding | Implementation evidence | Assessment |
| --- | --- | --- |
| 「把『宿主优雅停机必须先 await drain() 再 dispose』写为**硬性契约**而非参考建议」 | ① ADR 0006 修订节第 3 条（docs/adr/0006-server-persistence-docstore.md:270 起）：无条件条款 + 「预算尽后继续 dispose 是显式可观察退出，不是违约」+ 「未经 drain 直接 dispose 的宿主接受静默丢失」代价申明；② app.ts:604-627：`performStop` 第 3 步在**唯一**的 `persistenceFiber.dispose()`（:630）之前 `await this.awaitDrainWithBudget(adapter.drain(), budgetMs)`，预算尽先发 `persistence-drain-budget-exceeded` 再继续——结构性强制（全仓唯一 dispose 调用点在 drain 之后；main.ts 停机/换装全部经 `app.stop()`）；③ cordis-plugin-hosting.md:64/:455-478 对仓库外宿主的同款硬契约指引 + 示例代码块 | **落实**。条款、对外指引、自家实现三方同答案；S-5c 以原型 spy 锚定 drain 恰一次且严格先于 `persistence-disposed` |
| 「同步修订 ADR-0006 :86 对 dispose 的现有定义——否则契约与实现继续脱节」 | ADR 修订节第 4 条：「本节**修订并扩展** :86 的 dispose 定义边界」（:86 原文经 `sed -n '80,92p'` 核实）——dispose 保持 abortive/有损、从来不是持久性屏障、「dispose 前的持久性」唯一经分层 drain 表达；约束性修订语气（SA8 O2 要求） | **落实**（SA2-10 措辞采纳） |
| 「可以接受分层方案（公开 drain()，dispose 保持 abortive），但至少需要硬契约 + ADR 对齐」 | `DocPersistence.drain?` optional 分层成员（contract.ts:149-176）；dispose 路径零改动（仅把内联 waiter 通知抽为 `releaseSettleWaiters`，行为逐字节等价）；DD-7 备选 (iii) 否决论证入 ADR 第 4 条 | **落实**（分层保持） |
| 第三个击穿窗口：degraded entry 的 retry 回退窗（backoff 上限 maxDirtyMs） | drain 对 `retryTimer` 武装只注册 waiter 被动等待（lifecycle.ts:866-869），零热循环（1f：attempts 恒 1 锚定）；宿主预算覆盖回退窗（S-5b：预算 520ms 内收口 + 事件） | **落实** |
| 问题 2 解耦属实、独立 `retryDelayMs` 配置（缺省保持现行为） | `PersistenceSchedule.retryDelayMs?`（contract.ts:513-523）+ `resolvePersistenceSchedule` 条件展开（:548-552，校验环自动覆盖新键 → 非法值 RangeError）+ `retryBaseMs` getter 单源（lifecycle.ts:1077-1082）改引 createEntry（:1094）与 flush 成功回落（:1152）两落点；DSH 探针镜像锁步（probe.ts:444-447） | **落实**。缺省 `(undefined ?? debounceMs) \|\| 1` ≡ 旧 `debounceMs \|\| 1`（静态等价）；缺省不物化键（SA8 action 2 红线遵守，冻结审计零迁移） |
| Issue 正文请求面（drain 语义 6 条 + 可选 targets + 宿主替换固定睡眠） | 见 §B4 | **落实** |

SA6 契约承接：C1–C14 全部由 SA6 两份契约文件（27 运行期 + 5 类型）锚定，实现后转绿；S-1~S-4/S-5a/S-5b/S-5c 补充锚全部新增。

## B4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
| --- | --- | --- | --- |
| DD-1 drain 放置面：`DocPersistence.drain?` optional + 两 adapter 具体类方法 + barrel 导出 + 不进 `ReplicaPersistence` | contract.ts:68-73/:149-176；memory.ts:189-194；file.ts:149-159；index.ts:37；ReplicaPersistence 零改动 | 忠实。File 入口 targets 逐个 `validateIdentity`（`targets === undefined` 无校验路径），错误文案与 assertSafePathSegment 一致（file.ts:257-262） | — |
| DD-2 retryDelayMs 键形状不变（缺省回退在 lifecycle 内） | contract.ts:545-552 条件展开；lifecycle.ts:1077-1082 getter | 忠实。`persistence-contract.test.ts:32-37` 两键 `toEqual` 零改动即绿；probe 默认时间线逐字节不变 | — |
| DD-3 optional 类型建模 | contract.ts:513 | 忠实；`TEST_SCHEDULE` 两键字面量零迁移 | — |
| DD-4 目标集合形状 `targets?: readonly PersistenceDrainTarget[]`；`[]`=no-op；缺席 target=no-op | lifecycle.ts:841-843 scope Set；S-4 双锚 | 忠实，与 SA6 契约临时形状逐字段一致 | — |
| DD-5 drain 语义与状态机（§8 骨架逐行） | lifecycle.ts:840-879——`closed` 早退（vacuous）/ 非 live 跳过 / 回退窗+在途被动等待（仅注册 waiter）/ idle-脏强制 `startFlush` / 干净跳过 / `Promise.all` 屏障后重扫 | **逐行一致**（含注释）。扫描段同步完成 waiter 注册（单线程内 check-then-push 原子）；`startFlush` 同步置 `flushing=true` 后才遇首个 await ⟹ 注册的 waiter 必被该 flush finally 释放 | — |
| DD-5b 驱逐路径通知面补全（4 处移除点） | `releaseSettleWaiters`（lifecycle.ts:1227-1230）+ 四调用点：settleEntryForDelete 驱逐腿（:679）/ settleEntryForArchive 干净驱逐腿（:709）/ dispose 同步段（:831）/ maybeEvict（:1195） | 忠实。live-entry 移除点全集枚举核对：其余 `cells.delete` 均作用于非 live claim cell——drain waiter 只注册在 live entry 上，不可达 ⟹ 枚举完备 | — |
| DD-6 DSH 探针锁步 + 记录头冻结 | probe.ts:444-447 一行镜像 + 注释；record.ts/events.ts/profile.ts/cli.ts 零改动 | 忠实 | — |
| DD-7(1) app 停机第 3 步预算组合 drain，file/memory 统一 | app.ts:297-312（两分支统一保留 plugin 句柄）、:618-627（`kind==='file'` 守卫删除；file 预算 = `schedule?.maxDirtyMs ?? DEFAULT_MAX_DIRTY_MS` + 边距，memory = 缺省 5_500）、:547-568（`awaitDrainWithBudget` tagged-outcome race + timer 早清，镜像 rest-hosting 先例） | 忠实。boot 窗口 `instance === undefined` 跳过（F2）；工厂 `instance` 在 `apply` 内赋值——`ctx.plugin()` 同步调 apply ⟹ 停机时句柄可达 | — |
| DD-7(2)(3)(4) config/main 注释刷新 + 停机时序 | config.ts:13-44/:278（拒绝文案 parenthetical 更新，路径段保持——app-config-red:299 与 lifecycle-watchdog-red:122 只钉路径段，零破坏）；main.ts:96-103 仅注释 | 忠实，行为零变化 | — |
| DD-8(1) ADR 0006 修订节 7 条 | docs/adr/0006...md:242-282：接口契约 / drain 语义 / 停机硬契约（无条件 + 适用面 + :34 关系 + 实施注记）/ dispose 对齐（修订并扩展 :86）/ retryDelayMs 解析形状 / 排空通知面不变量 / 非 live cell 排除存档 | 忠实——Owner O1/O2、SA8 D1/D8/D15/O3 全部落入成文条款 | — |
| DD-8(2)(3)(4) CONTEXT 词条（含 `_Avoid_`）/ hub-peer 词表+停机序 / cordis-plugin-hosting 硬契约+示例 | CONTEXT.md:139-142；hub-peer-deployment.md:36-46/:277-289（条件性注记 SA2-8 + memory 缺省预算括注 SA2-13）；cordis-plugin-hosting.md:64/:98-133/:455-478 | 忠实 | — |
| 备选实现核对（SA3 deviations 1-3） | S-5a/S-5b 夹具参数替换（确定性构造）、S-5b `elapsedMs>=500`/tmpPath 强化断言、`releaseSettleWaiters` 抽方法 | 均为等价实现选择，非语义偏离；设计 §12 S-5b 明文允许机制等价替换 | — |

## B5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
| --- | --- | --- | --- |
| drain 状态机（扫描/强制 flush/等待/重扫） | `PersistenceLifecycle`（ADR 0006:157-159 lifecycle core 共享） | lifecycle.ts 单点；Memory/File 纯委派 | 正确——无状态机复制 |
| drain 的 targets 输入校验 | File adapter（路径安全事实所有者） | file.ts:151-154 `validateIdentity`（与其余公开入口同款） | 正确 |
| 停机预算与诚实事件 | 宿主组合层（app） | app.ts `awaitDrainWithBudget` + 事件；库级 drain 无预算参数 | 正确（分层与 Owner 评论一致） |
| retry 基准单源 | lifecycle（调度事实所有者） | `retryBaseMs` getter，两落点共用 | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
| --- | --- | --- | --- | --- |
| 有界停机排空 | REST `restHost.drain(REST_DRAIN_BUDGET_MS)`（app.ts:92-96/:591；rest-hosting tagged-outcome race + timer 早清） | `awaitDrainWithBudget` 同款纪律（进程级 setTimeout、早清、败者续体语义文档化） | 一致（有意差异已注释：app 不 abort drain——abort 等价物是随后的 dispose） | 复用既有纪律而非新造机制 |
| 私有强制排空先例 | `settleEntryForArchive`（lifecycle.ts:698-720） | drain 与之同构、去掉归档前置/驱逐腿、去掉 `handles.size>0` 拒绝 | 一致（泛化，非复制） | 同一 waiter 通知面 + 同一 startFlush |
| degraded 回退窗尊重 | `scheduleRetry`/ADR 0006:195 | drain 被动等待（注册 waiter） | 一致 | 退避仍是唯一调度源 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
| --- | --- | --- | --- |
| entry 结算完成 | flush finally 通知点 1 / dispose 通知点 2 / 4 处驱逐释放（`archiveWaiters` 单通知面） | drain/settleEntryForArchive/settleEntryForDelete 共同消费 | 无——未引入第二套 waiter/事件机制 |
| retry 首基准 | `schedule.retryDelayMs ?? debounceMs`（`retryBaseMs` 单 getter） | entry.retryDelayMs（运行态） | 无——两落点均改引单源 |
| 排空预算 | `maxDirtyMs + DRAIN_MARGIN_MS`（配置推导） | 事件载荷 budgetMs | 无——零新增配置键 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
| --- | --- | --- | --- |
| drain 不获取任何资源（无 abort/destroy/清定时器/驱逐） | 无对应释放义务；宿主预算 timer 一次性早清 | 败者 drain 续体由 dispose 通知点 2 收口（vacuous resolve，零 unhandled rejection——store 失败面永不 reject） | 对称（additive 能力，无新资源） |
| plugin 句柄获取（boot 两分支统一赋值） | 句柄随 app 实例生命周期；instance 经 `get instance()` 只读 | boot 窗口 undefined → 停机跳过（F2，与 restHost/diagnostics 同款 optional 纪律） | 对称 |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
| --- | --- | --- | --- |
| 第二套 cleanup/retry loop | lifecycle 内部退避 | drain 复用（不新造重试） | 无平行 |
| 第二拆卸链 | `performStop` 单链 | drain 是链内等待步（diagnostics-closed 与 persistence-disposed 之间），`stop()` single-flight 不变；S-5c 二次 stop 断言 drain 恰一次 | 无平行（apps AGENTS 纪律保持） |
| 第二事件通道 | stdout NDJSON sink | 新事件走同一 sink（`{event, budgetMs}`，脱敏合规——纯数值） | 无平行 |

## B6. 文件范围审查（iteration 0，已提交为 75bd0ab）

15 行 ALLOW 全部兑现（contract/lifecycle/memory/file/index、probe、app/config/main、ADR 0006、CONTEXT、hub-peer、cordis-hosting、两新增测试）；DENY 零触碰（service.ts/testing.ts/namespace-registry/dsh 四文件/persistence 冻结审计/SA6 两契约文件/yjs-server 既有测试/docs:protocols/ws-replication/上游 wiki 产物）。本轮（iteration 1）增量范围见 §A6。

## B7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
| --- | --- | --- | --- | --- |
| `DocPersistence.drain?` 新 optional 成员 | 第三方实现/13 stub/wrapIo 字面量 | optional ⟹ 编译零破坏；surface 测试 `legacyThreeMemberAdapter` 三成员字面量保持绿 | 无 | — |
| `PersistenceSchedule.retryDelayMs?` | `Partial<PersistenceSchedule>` 消费方（两 adapter options、DSH profile） | 自动获得可选键；app 配置面有意不暴露（设计非目标，config 词表两键闭集不变） | 无 | — |
| 新事件 `persistence-drain-budget-exceeded{budgetMs}` | stdout NDJSON 消费方/运维 | additive；hub-peer-deployment 词表已同步（含条件性注记）；既有 findIndex 严格递增锚对词表新增免疫 | 无 | — |
| yjs-server 停机链 callers（SIGTERM/SIGINT/SIGHUP/fatal-exit） | main.ts 全部经 `app.stop()` | 预算内必然返回 ⟹ watchdog 退居兜底；换装注释已刷新 | 无 | — |
| registry shutdown → drain 前置 | `namespace-registry` | 零改动（SA8 D12）；lease 全释放后无并发写者——drain 静息观察点边界由链路前置条件关闭 | 无 | — |
| `MemoryPersistence.prototype.drain` 原型面 | S-5c spy / 仓库外宿主 | barrel 公开导出；vitest alias 同映射 ⟹ 单模块实例 | 无 | — |
| DSH golden 消费方 | determinism/acceptance 测试 | 缺省时间线逐字节不变（静态等价） | 无 | — |

## B8. 错误、恢复与并发

- **drain 失败面**：store 失败沿既有 degraded + 内部退避吸收（flush catch → scheduleRetry），drain 永不因 store 失败 reject（lifecycle.ts:1148-1157 无 rethrow；waiter 由 flush finally 无条件释放）。File unsafe target 的 loud `Error` 是文档化例外通道（S-4 专项锚定）。
- **静默失败检查**：预算尽路径**不静默**——事件先于有损 dispose（S-5b 断言 `budgetIndex < indexOf('persistence-disposed')` 且 `budgetMs === 520`）；app-stop-failed 计数为 0 断言排除伪装。dispose 有损语义保持（S-1/0a/0b 锚定）。
- **并发/竞态静态核验**（重点攻击面，均通过）：扫描-注册原子性（同步块 check-then-push；`startFlush` 同步置 `flushing` ⟹ 注册 waiter 必被释放）；双 flush（双门 + armed 陈旧定时器经 `flushing`/干净守卫早退——1a attempts 恰 2、1g attempts 恒 3 锚定）；驱逐×drain 挂起（4 处移除点全部释放，S-3 行为锚定）；dispose×drain（通知点 2 + `closed` 早退 vacuous，S-1）；等待期再脏（屏障后重扫强制 flush，S-2）；单飞/幂等（多次 drain attempts 精确递增；`stop()` single-flight 下 drain 恰 1 次，S-5c）；终止性（每 waiter 由通知点 1/2 或驱逐释放）。
- **进程重启/事务中断**：drain 不改持久化格式与提交点（复用 `io.write`，rename 提交语义不变）；S-5b「新实例见旧 committed 快照 + tmp 目录仍在」诚实锚定有损边界。
- **静态无法完全确认项**：真实慢盘下 30.5s 预算的充分性、nomic-server（仓库外）采纳——列入 §A11/§B11。

## B9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
| --- | --- | --- | --- | --- |
| SA6 `persistence-issue-412-drain-red.test.ts`（27 tests：§0 4 / §1 14 / §2 6 / §3 3） | 0a/0b 缺口正复现；1a-1g drain 全语义；2a/2b/2c retry 基准/缺省/退避 cap；3a-3c 保持性 | root `pnpm test` 分片 + SA6/设计 §12 显式命令 | 无 skip/only/todo（grep 核实） | — |
| SA6 `persistence-issue-412-drain-surface.test-d.ts`（5） | 类面 drain / schedule 键 / 三成员字面量 / 实现关系 | CI typecheck 作业（`*.test-d.ts` include） | 无 | — |
| 新增 `persistence-issue-412-drain-semantics.test.ts`（9） | S-1 vacuous；S-2 等待期再脏重扫；S-3 驱逐释放 waiter；S-4 `[]`/缺席/全量 + File unsafe target | root 分片 | 双 adapter 矩阵；withTimeout 全覆盖；零源码字符串断言 | — |
| 新增 `apps/yjs-server/test/persistence-drain-shutdown.test.ts`（3） | S-5a 完成式；S-5b 预算内收口 + 有损事实诚实；S-5c drain 恰一次且先于 `persistence-disposed`、二次 stop 幂等 | root 分片（`apps/*/test/**/*.test.ts`）+ app 套件命令 | 真实组合根 + 真实 fs；EISDIR 注入确定性 | MINOR-3（450ms 墙钟上界的 CI 慢机 flake 余量，见 §B12） |
| 既有锚（ordered-shutdown-red / lifecycle-watchdog-red / app-config-red / persistence-contract / dsh determinism） | 四事件序 / 配置边界 / 冻结审计 / golden | 既有入口不变 | 全部零改动即兼容 | — |

**SA6 红灯保持**：契约两文件未被弱化。**Mutation 敏感性**：SA3 三项反证静态核验其可区分性成立；运行级复现列入 §A11 交由后续动态验证。

## B10. Required revisions（iteration 0）

无 BLOCKER / MAJOR finding。（MINOR 项不阻断 approve，见 §B12。）

## B11. 后续动态验证项（iteration 0，承接至 §A11）

| Risk | Driver | Expected observation | Failure condition |
| --- | --- | --- | --- |
| SA3 报告的验证命令与 mutation 反证的可复现性 | 后续验证角色按设计 §12 Runner 命令 + SA3 mutation 清单复跑 | 242/182 切片全绿；三项 mutation 分别使 S-3/S-5c/S-5a-c 变红后恢复 | 任一 mutation 下对应测试仍绿或切片出现新红 |
| 真实慢盘/高并发下 `maxDirtyMs + 500ms` 预算的充分性 | 部署环境停机画像观测 | 健康 store 停机无预算事件；事件出现率可告警 | 健康 store 频繁触发预算事件 |
| 仓库外宿主（nomic-server）按 cordis-plugin-hosting 硬契约替换固定睡眠 | 消费方仓库 | `FILE_PERSISTENCE_DRAIN_MS` 移除、`drain()` + 自有预算上线 | 消费方继续固定睡眠 |
| S-5a `elapsedMs < 450` 在极慢 CI 上的稳定性 | CI 长期运行记录 | 无偶发红 | 偶发超时红 |
| `drain()` 与 `createDoc`/`importDoc` claim 环交错 | 可选补充测试（设计 §13 follow-up 同族） | claim 完成后新 live 脏 entry 由下一次 drain 覆盖 | waiter 挂起或漏排空 |

## B12. Non-blocking observations（iteration 0，仍适用）

| # | 严重度 | 观察 | 建议处置 |
| --- | --- | --- | --- |
| N-1 | MINOR | `apps/yjs-server/AGENTS.md` 单一拆卸链摘要行未列新增排空等待步（陈述仍真；该文件不在设计 ALLOW，SA3 已记录为文档债） | 后续文档变更集顺带补一句 |
| N-2 | MINOR | `awaitDrainWithBudget`：若 drain promise reject（结构性不可达），`clearTimeout` 被跳过，预算 timer 残留至自然到点；fail-loud 路径不受阻 | 可改 try/finally 早清 timer；非本任务必要 |
| N-3 | MINOR | S-5a 的 `elapsedMs < 450` 墙钟断言在极慢 CI 可能偶发击穿（预算/withTimeout 不受影响） | 观察 CI 稳定性后酌情放宽 |
| N-4 | MINOR（design 侧） | SA2-12：设计文档对 SA8 报告的计数/traceability 停留在旧版（SA1 产物，不在 SA3 ALLOW） | 路由 `design`，不影响实现正确性 |
| N-5 | 观察 | `flush()` finally 的通知点 1 保留内联 `splice(0)+call` 而未调用 `releaseSettleWaiters`（行为逐字节等价） | 纯风格项 |

## B13. 复查标记（iteration 0 历史记录）

iteration 0 曾提交 `requiresConflictRecheck: true`（设计 §15 五项理由）；该职责已由 SA8 实现后冲突复审产物 `wiki/raw/task_issue-412_implementation_conflict_report.md` 承担。iteration 1（本轮）无新增冲突维度（见 §A13）。
