# SA9 Standards Review — issue #412（iteration 7：CI 修复与归一化验证证据终审 head `94b5ee6`）

- 任务：issue #412（standards-review，**iteration 7**）；dispatch `sa-f3d47029-68fc-4cf0-ac31-9405fe6e9d54`（role `mabf-sa9`，phase standards-review）——「Review the final committed issue #412 CI-repair and normalized verification-evidence head. Verify repository standards, evidence integrity, no test suppression, and preservation of drain-before-dispose. Owner requirement: comment 5751613018, updated 2026-09-20T18:03:36Z, requires hard drain-before-dispose and ADR alignment remain intact.」
- 审查对象：**当前 HEAD `94b5ee6`「chore(ci): record issue 412 repair evidence」**（恰 11 文件：8 份归一化验证证据日志入库 + 3 份 wiki 过程产物原位更新）及其未审提交链：`d60760c test(yjs-server): make smoke signal handling deterministic`（CI 修复，iteration 4 SA9 已终审 approve）→ `2c3a486 chore(ci): record issue 412 final repair reviews`（SA10/SA9 评审留档）→ `94b5ee6`（本终审对象）。归一化背景：SA3 iteration 4 将 26 份未跟踪日志裁为「8 保留 + 18 冗余清理」、iteration 5 将保留 8 份的 14 处 `git diff --cached --check` 空白缺陷归零；SA4 Part D/E 与 SA8 iteration 6 完成入库前审查（均 approve / clear）；Controller 以满足前置条件的重 stage 提交为 `94b5ee6`。
- 适用 Owner 要求：Issue comment `5751613018`——本轮经 `gh api repos/nomicore-ai/nomicore/issues/comments/5751613018` **独立拉取核对**：`id=5751613018`、`updated_at=2026-09-20T18:03:36Z`、`author_association=MEMBER`、author `welltop-jim-wang`，与 dispatch 逐项一致，无更新版本覆盖；评论全文要求面：①「宿主优雅停机必须先 `await drain()` 再 dispose」写为**硬性契约**（分层方案可接受：公开 `drain()`、dispose 保持 abort 式）；②**同步修订 ADR-0006 :86** dispose 定义（否则契约与实现脱节）；③dispose 保持 abortive 时保留分层公开 drain；retryDelayMs 解耦、缺省保持现行为。
- 审查纪律：静态标准审查——不运行测试、不启动服务、不修改代码/设计/测试、不调度其他 SA；所有事实只读独立核对（`gh api`/`gh run list`/`gh pr view` 本轮拉取、git diff/log/numstat/--check 字节谱系、源码锚点 sed/grep 现读、证据日志全文/尾部抽读、`.editorconfig`/AGENTS 策略文本现读）。范围 = 仓库/工程标准符合性、证据完整性、测试抑制面；Issue 需求完整性属 SA10 面。
- 历史轮次：iteration 0/1/2/3 SA9 approve（主体实现 / codegen 修复 / 验证证据留档 / 留档提交 `bdb91cb`）；iteration 4 SA9 approve（CI 修复提交 `d60760c` 终审，0B/0M/6 MINOR）。前身全文留存于 git 历史（`2c3a486:wiki/raw/task_issue-412_sa9_standards.md` 及更早）；本文件按原位更新惯例只裁决本轮 dispatch 对象。

## 1. Reviewed inputs

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| HEAD `94b5ee6` 与链上 `2c3a486` 全量 diff（`git show --stat`、`git diff d60760c..HEAD --name-only/--check` 逐路径核对） | 全量核对 | 被审对象组成与边界、空白纪律 |
| 产品树漂移面（`git diff d60760c..HEAD -- packages apps/yjs-server/src docs domains CONTEXT.md .github scripts tests` 及根配置） | 全量核对（输出为空） | 零产品漂移证明 |
| Owner comment `5751613018`（元数据 + 全文） | `gh api` 本轮独立拉取 | 保持性基准（要求①②③逐字核对） |
| CI 事实面 | `gh api runs/35535478371` + `/jobs`、`gh run list --branch mabf/issue-412`、`gh pr view 413 --json state,headRefOid,mergeable,statusCheckRollup` 本轮拉取 | CI 失败证据独立对账、推送/复跑状态 |
| 8 份新入库日志（`artifacts/sa3-issue412-iter3-{app-suite,ci-failure-evidence,generate-check,persistence-contract,root-typecheck,shard6-node24,shutdown-tests,smoke-red-proof}.log`） | 全文/头尾抽读 + 计数抽核 + `grep -nP '[ \t]+$'`（全 11 份 iter3 日志零命中）+ `tail -c 1`（均单 `\n`） | 归一化 fidelity 与证据真实性 |
| 被修复测试 `apps/yjs-server/test/smoke-skeleton-red.test.ts` | `git diff d60760c..HEAD` 零 diff 实测 + 词边界抑制 grep + `:153/:419/:429` 锚现读 + `143`/`bin/tsx` 命中点逐处分类 | 测试抑制面与断言强度保持 |
| 硬契约锚点（ADR 0006 :240-282 修订节、app.ts :618-640、hub-peer-deployment.md :36-42、apps/yjs-server/AGENTS.md :21-25） | sed/grep 现读 | Owner 要求保持性 |
| SA3 iteration 4/5 报告、SA4 Part D/E 报告、SA8 iteration 6 conflict 报告（均随 HEAD/链上入库） | 已读 + 关键申报独立重测 | 上游审查结论交叉核对（不采信自述） |
| `.editorconfig`（`[*]` trim_trailing_whitespace/insert_final_newline/lf）、`.gitignore` | 现读 | 归一化后形态的交付面策略符合性 |
| SA6 两契约文件 git log、`git ls-files artifacts/`、工作区 `git status --porcelain`（空） | 已执行 | 冻结面零触碰、入库清单、出口边界 |

## 2. Verdict

**approve**（0 × BLOCKER；0 × MAJOR；6 × MINOR 全部非阻断，见 §9；iteration 4 的 M-1「26 份证据日志未入库」由本 head 闭合）。

核心判定：

1. **HEAD 是纯证据归一化入库 + 评审留档提交，产品树零 diff**：`94b5ee6` 恰 11 文件（8 份 iter3 闸门证据日志新增 + SA3 impl / SA4 review / SA8 conflict 报告原位更新）；`2c3a486` 恰 2 文件（SA10 spec、SA9 standards 的 iteration-4 评审版）。对全部产品树路径 `git diff d60760c..HEAD --name-only -- packages apps/yjs-server/src docs domains CONTEXT.md .github scripts tests …` 输出**为空**；`git diff --check` 全链净。#412 主体实现（`75bd0ab`）、codegen 修复（`9094760`）、CI 修复（`d60760c`）逐字节保持。
2. **归一化 fidelity 经独立重测闭合，入库前置条件被满足**：committed 8 份日志 `grep -nP '[ \t]+$'` 零命中（含行尾空白曾被报的 `ci-failure-evidence.log` 7 处时间戳行与 `smoke-red-proof.log` 1 处代码帧行）、逐份 `tail -c 1` 均单 `\n`（6 处 EOF 空行已归零）；`git show 94b5ee6 --check` 静默。即 SA4 E-O1 与 SA8 iteration 6 行动 1 的前置条件（Controller 提交前重 stage 归零后形态）**已落实**——入库 blob = 经 SA4/SA8 逐份钉哈希核验的归一化形态，14 处缺陷未随提交进入历史；归一化后形态符合 `.editorconfig`（trim_trailing_whitespace=true、insert_final_newline=true、eol=lf）。
3. **证据真实、与本轮独立拉取值互洽**：`ci-failure-evidence.log` 头部（run `35535478371`、job `106143620539`、`test (24, 6)`、head `f3b13ee`）与 `gh api` 本轮拉取逐项一致（run conclusion=failure、created `2026-09-20T20:25:06Z`、唯一失败 job id/name 吻合）；失败签名 `peer exit code: expected 143 to be +0` 与 PR #413 `statusCheckRollup` 中 `test (24, 6)` FAILURE 互证。计数轴自洽：CI 基线 66 files/745（1 failed）↔ 本地复跑 66/746（+1 新忙窗用例）、apps 全套 35/183、persistence 契约 21/221 + Type Errors: no errors、shutdown 3/3。红证明日志头部如实披露「临时还原 spawn 形态的仓内反证」且 `RED-EXIT=1` 保留。
4. **无测试抑制、无证据遮羞**：被修复测试对 `d60760c` **零 diff**；词边界 grep（`.skip`/`.only`/`.todo`/`xit(`/`xdescribe(`）零命中；`143` 全文件 5 处均在注释；`bin/tsx` 2 处均在注释；尾序锚 `:429 expect(tailOrder).toEqual(['persistence-disposed','app-stopped'])` 在位；红证明日志的「4 skipped」系 `-t` 名称过滤的一次性运行形态（`↓` 标记），非文件内抑制。18 份冗余负载日志的清理经过 SA3 iteration 4 申报 → SA4 Part D / SA8 复核的权责链，逐次计数/时序固化于 SA3 报告 §Evidence reconciliation（含 1 次未复现负载失败的诚实登记），声明集 12/12 保全——删除面不藏任何失败/抑制事实。
5. **Owner comment 5751613018 硬契约与 ADR 对齐保持完好**：成文面（ADR 0006 :242 修订节明文引用该 comment、:270 无条件停机硬契约、:276「修订并扩展 :86」dispose 对齐条款）、实现面（app.ts:624 `awaitDrainWithBudget(adapter.drain(), budgetMs)` 结构性先于 :630 全仓唯一 `persistenceFiber.dispose()` → :632 `persistence-disposed` → :635 `app-stopped`）、词条/指引面（CONTEXT.md:139-141、hub-peer-deployment.md:36-42 事件词表含该尾序、cordis-plugin-hosting.md 同款）全部本轮现读在位，且两个 head 提交对全部载体路径 **diff 为空**。
6. **流程纪律符合**：conventional-commit（`chore(ci):`，仓内同款先例 `bdb91cb`/`f3b13ee`）；wiki/raw 为证据层非规范（docs/AGENTS.md 明文）；SA3 iteration 4/5（收纳 + 清整申报）→ SA8 iteration 6（clear / requiresConflictRecheck **false**）→ SA4 Part D/E（approve，附 E-O1 前置条件）→ Controller 满足前置条件后提交的权责链完整；本审查未 commit/push/调度其他 SA。

## 3. HEAD 链组成与「零产品漂移」证明

| 维度 | 核对结果 |
| --- | --- |
| `94b5ee6` 文件清单 | 恰 11 文件：8 × `artifacts/sa3-issue412-iter3-*.log`（新增，+489 行）+ 3 × wiki 原位更新（SA3 impl +201 含 iteration 4 收纳裁决与 iteration 5 清整记录、SA4 review +253 含 Part D/E、SA8 conflict 报告重写为 iteration 6 门禁版）——**零产品代码、零规范文本、零生成物、零 CI 配置** |
| `2c3a486` 文件清单 | 恰 2 文件：SA10 spec / SA9 standards 的 iteration-4 评审版（评审留档） |
| 产品树零漂移 | `git diff d60760c..HEAD --name-only -- packages apps/yjs-server/src docs domains CONTEXT.md .github scripts tests package.json pnpm-lock.yaml tsconfig*.json vitest.config.ts AGENTS.md` → **空**（exit 0） |
| 空白纪律 | `git diff d60760c..HEAD --check` 净；`git show 94b5ee6 --check` 静默；11 份 iter3 日志行尾空白 grep 零命中、EOF 单 `\n` |
| DENY 面零触碰 | 设计 §11 DENY 全表（persistence `service.ts`/`testing.ts`、namespace-registry、dsh 四件、persistence 既有测试与冻结审计、**SA6 两契约文件**（git log 仅 `75bd0ab` 一条，本轮实测）、其余 apps 既有测试、`docs/protocols/**`、`packages/ws-replication/**`、`packages/vfsl-codegen/**`、`.github/**`、`schema.vfsl`）不在两个 head 提交名单内 |
| commit message | `chore(ci): record issue 412 repair evidence` / `chore(ci): record issue 412 final repair reviews`——内容与对象相符，符合仓内 conventional-commit 惯例（`chore(ci): record …` 先例 `bdb91cb`/`f3b13ee`/`2c3a486`） |
| 工作区出口 | `git status --porcelain` 空（iteration 4 的 26 份未跟踪日志已按裁决出清：8 入库 + 18 删除）；分支领先 `origin/main` 8 提交（推送权属 Controller，见 M-1） |

## 4. 归一化 fidelity 与入库前置条件落实（本轮独立重测）

| 申报（SA3 iteration 5 / SA4 Part E / SA8 iteration 6） | 本轮独立核验 | 判定 |
| --- | --- | --- |
| 14 处被报缺陷（8 行尾空白 + 6 EOF 空行）归零，其余字节不动 | committed 形态：全 11 份 iter3 日志 `grep -nP '[ \t]+$'` 零命中；8 份新入库日志 `tail -c 1` 均 `0a`；`git show 94b5ee6 --check` 静默（若 14 处缺陷随提交入库则此处必报） | **属实** |
| 前置条件：Controller 提交前重 stage 归零后形态（SA4 E-O1 / SA8 行动 1） | 入库 blob 即归一化形态（上行实测）；SA3 报告 committed 版含 §iteration 5 清整记录（`git show 94b5ee6:…sa3_impl.md` grep 6 处命中「iteration 5 清整记录」） | **已落实** |
| 归零后形态符合 `.editorconfig` | 现读 `[*]`：`trim_trailing_whitespace = true`、`insert_final_newline = true`、`end_of_line = lf`——committed 形态满足 | **符合** |
| 删除面（18 份）不藏事实 | 逐次计数/时序固化于 SA3 报告 §Evidence reconciliation；1 次未复现负载失败（无 143 字样、疑等待超时/端口竞态）如实登记于 :307；声明集（Controller 在案 artifactPaths 10 份具名日志 + 报告 + 测试文件）12/12 在位 | **属实** |
| 保留集 = 已声明 ∩ 互不重复闸门主张 | 8 份各承载互斥主张（CI 失败外证 / 仓内红证明 / shard-6 步骤原文 / 契约切片+typecheck / S-5 / generate --check / root typecheck / apps 全套）+ `d60760c` 已入库 3 份（机制 red/green、稳定性 5 连、失败探针轨迹） | **闭合** |

## 5. 证据完整性审查

| 证据 | 本轮独立核验 | 判定 |
| --- | --- | --- |
| `ci-failure-evidence.log`（新入库） | `gh api runs/35535478371`：head_sha=`f3b13eef…`、conclusion=failure、created=`2026-09-20T20:25:06Z`；`/jobs`：唯一失败 job id=`106143620539`、name=`test (24, 6)`——与日志头行逐项一致；摘录内 `1 failed | 744 passed (745)`、`peer exit code: expected 143 to be +0` 与 PR #413 statusCheckRollup（`test (24, 6)` FAILURE，余 15/16 SUCCESS）互证 | ✅ 真实 |
| `shard6-node24.log`（新入库） | CI 步骤原文复跑（`ci-test-shard.mjs 6 6` + vitest 双防假绿旗标）；**66 files / 746 tests 全绿**——CI 基线 745 + 新增 1 忙窗用例 = 746，计数自洽 | ✅ 真实互洽 |
| `persistence-contract.log` / `shutdown-tests.log`（新入库） | 21 files/221 tests + Type Errors: no errors；S-5 3/3 绿 | ✅ 契约面闭合 |
| `generate-check.log` / `root-typecheck.log`（新入库） | `pnpm generate --check`（ci.yml :147 步骤原文）静默成功形态；root typecheck 15 段 tsconfig（含 apps/yjs-server） | ✅ 静态门闭合（形态观察见 M-4） |
| `app-suite.log`（新入库） | apps AGENTS 全套门：35 files/183 tests 全绿 | ✅ 模块门闭合 |
| `smoke-red-proof.log`（新入库） | 头注如实披露「临时把 spawnApp 还原为 tsx CLI 形态」的仓内反证；`1 failed | 4 skipped (5)` 系 `-t` 名称过滤运行形态（4 个 `↓` 标记），失败签名 `hub (busy window) exit code: expected 143 to be +0` 与 CI 签名逐字同款；`RED-EXIT=1` 保留 | ✅ 真实（非文件内抑制） |
| `relay-redgreen.log` / `smoke-stability.log` / `probe-memory.log`（`d60760c` 已入库） | 机制 A/B 3×3、5 连跑全绿、失败探针取证轨迹——iteration 4 已核，本轮抽读一致 | ✅ 真实 |
| 上游评审留档 | SA8 iteration 6（8 项 no-conflict / clear / requiresConflictRecheck **false**，行动 1 已落实）、SA4 Part D/E（approve，E-O1 已落实）、SA3 iteration 4/5（收纳裁决 + 清整记录，关键数值本轮重测吻合）随 HEAD/链上入库 | ✅ 留档属实 |

## 6. 测试质量与抑制面审查

| 检查项 | 结果 |
| --- | --- |
| skip/only/todo/xit/xdescribe | 词边界 grep **零命中** |
| 被修复测试文件稳定性 | `git diff d60760c..HEAD -- apps/yjs-server/test/smoke-skeleton-red.test.ts` = **0 行**（自 CI 修复提交后零触碰；git log 仅 `d60760c` 一条修复记录） |
| 既有断言面 | iteration 4 已逐行核对（4 用例断言行与超时预算逐字冻结），本轮文件零 diff 故结论沿用；`:153 expect(code, …).toBe(expectedCode)`、`:419 signalAndExpectExit(hubProc,'SIGTERM',30_000,0,'hub (busy window)')` 现读在位（SA4 红证明栈帧锚吻合） |
| 143 容忍面 | `143` 全文件 5 处命中**均在注释**（根因记录）；无任何断言容忍 143 |
| `bin/tsx` 残留面 | 2 处命中**均在注释**（:14/:67 根因记录）；spawn 形态为 `node --import tsx` 直跑 |
| 新忙窗锚强度 | `:429 expect(tailOrder).toEqual(['persistence-disposed','app-stopped'])`（全序列比对）在位；与 hub-peer-deployment.md :36-42 成文词表序及 app.ts :632→:635 实现序一致 |
| SA6 契约冻结面 | `persistence-issue-412-*.test.ts`、`persistence-drain-shutdown.test.ts` git log 仅 `75bd0ab` 一条——CI 修复与证据链全程零触碰 |
| 同类暴露面（非本对象） | 其余 **14** 个 apps 测试文件仍 `spawn(TSX_BIN, …)`（`.bin/tsx` 包装形态，同一 30ms 转达窗 flake 风险）——SA3 §Deferred、SA4 §C11/O-2、SA8 §8 行动 3 已登记交 SA1/Controller 决策（M-2） |

## 7. Owner comment 5751613018 硬契约保持确认（本轮独立抽验）

| Owner 要求 | HEAD 证据（本审查现读） | 判定 |
| --- | --- | --- |
| ① drain-before-dispose **硬契约**（分层方案可接受） | ADR 0006 :270（明文引用 comment 5751613018）：「宿主优雅停机在调用 `dispose()` 之前必须先 await `drain()`」+ 预算尽 = `persistence-drain-budget-exceeded` 可观察事件后的显式可观察退出而非违约 + 不以 adapter 类型特判；实现：app.ts:624 `awaitDrainWithBudget(adapter.drain(), budgetMs)` → :630 全仓唯一 `persistenceFiber.dispose()` → :632 `persistence-disposed` → :635 `app-stopped` | **保持** |
| ② 同步修订 ADR-0006 :86 dispose 定义 | ADR 0006 :276：「本节修订并扩展 :86 的 dispose 定义边界」——dispose 语义不变保持 abortive/有损、从来不是持久性屏障、持久性唯一经分层公开 drain 表达、否决「dispose 内部先 drain」论证在文 | **保持** |
| ③ dispose 保持 abortive + 分层公开 drain；retryDelayMs 解耦缺省保持现行为 | `75bd0ab` 提交态逐字节保持（两个 head 提交对其零 diff）；ADR §5 retryDelayMs 动态回退不物化条款在文 | **保持** |
| 硬契约载体在 CI 修复/证据链中零削弱 | 全部载体路径（ADR 0006、app.ts、CONTEXT.md、hub-peer-deployment.md、cordis-plugin-hosting.md、smoke 尾序锚 :429、S-5 文件）在两个 head 提交中 **diff 为空**；纯证据/留档型提交在物理上不可能削弱契约面 | **保持** |

## 8. 仓库 AGENTS / 工程惯例总核对（本轮触面）

| 条款 | 结果 |
| --- | --- |
| root AGENTS（模块 AGENTS 先读、worktrees 位置、issue tracker） | 本轮零模块源码改动；SA3/SA4/SA8 留档证实已读 `apps/AGENTS.md`/`apps/yjs-server/AGENTS.md`；worktree 由 Host 固定 |
| apps/yjs-server AGENTS 验证门 | SA3 验证表两门均执行（app tsconfig 段含于 root typecheck 15 段日志；app-suite 35/183 绿）；graceful shutdown 契约测试门因修复恢复绿，未被绕开 |
| apps/yjs-server AGENTS 边界（单一拆卸链、stdout 严格 NDJSON） | 新忙窗用例单发一次 SIGTERM 走唯一 handler，尾序断言兼钉「双拆卸链」反模式；产品事件发射零 diff（单一拆卸链摘要行的文档债见 M-5） |
| docs/AGENTS：wiki/raw = 证据层非规范 | 两个 head 提交的 5 份 wiki 更新均为证据层过程产物，无规范文本冒充 |
| 交付面策略（`.editorconfig`/`.gitignore`/入库先例） | 归一化后形态符合 `.editorconfig`；`.gitignore` 仅忽略 `artifacts/local-packages/*.tgz`，8 份日志不在忽略面；`git ls-files artifacts/` 223 项入库惯例与 iteration-2 先例 `bdb91cb` 沿用 |
| 单一事实源 | 未引入新事实源：事件序唯一权威 = 产品 stdout（hub-peer-deployment.md 词表），退出码唯一权威 = 进程 exit code；CI 失败事实唯一权威 = GitHub Actions（本轮 `gh api` 对账一致） |
| 生命周期对称性 | CI 失败（红）→ 根因修复 → 本地绿证据 → 归一化入库的应答链完整；CI 权威复跑为已登记 Deferred 项（M-1），非缺口隐瞒；18 份冗余日志的清理经申报-复核-固化的对称留痕 |
| 测试质量标准 | 真实 runner 发现（显式文件列表 + `--passWithNoTests=false`）；无 skip/only/todo；红证明锚定敏感性；SA6 契约文件零触碰 |
| 流程纪律 | SA 产出 → SA8/SA4 门禁 → Controller 满足前置条件后提交的分工保持；本审查未 commit/push/建 PR/调度其他 SA |

## 9. Findings（全部 MINOR，非阻断）

| # | 严重度 | Finding | 处置建议 |
| --- | --- | --- | --- |
| M-1 | MINOR（验证时序，carry-forward） | CI 权威复跑仍待推送：PR #413 `headRefOid` 仍 `f3b13ee`（本轮 `gh pr view` 实证），其 `test (24, 6)` FAILURE 即本修复对象；分支领先 `origin/main` **8** 提交，`d60760c`/`2c3a486`/`94b5ee6` 均无对应 CI run。属 SA3 §Deferred、SA4 §E11、SA8 行动 4、SA10 §6-1 四方已登记 Deferred 项 | Controller 推送后以 `test (20, 6)`/`test (24, 6)` 真实 runner 复跑闭合；不阻断 |
| M-2 | MINOR（同类暴露面，carry-forward） | 其余 **14** 个 apps 测试文件仍用 `.bin/tsx` 包装 spawn（`spawn(TSX_BIN,…)` 实测 14 文件），共享同一 30ms 转达窗 flake 风险；SA3 §Deferred、SA4 §C11/O-2、SA8 §8 行动 3 已登记交 SA1/Controller 决策 | 后续变更集统一迁移 `node --import tsx` 或抽公共 spawn 助手；不阻断 |
| M-3 | MINOR（留档计数，本轮新增） | SA3 报告 :32 仍写「声明集 = … + **9** 份具名证据日志」，Controller 在案 artifactPaths 实为 **10** 份（SA8 iteration 6 行动 2 同款指出并建议入库时顺带修正；`94b5ee6` 未修正）——不影响任何裁决（声明∩删除=∅、成员零变化） | 后续留档轮顺带修正或接受现状；不阻断 |
| M-4 | MINOR（证据形态，本轮新增） | `generate-check.log`/`root-typecheck.log` 为静默成功形态、无 `EXIT=N` 尾标（SA8 iteration 6 行动 3 同款观察；同批 `ci-failure-evidence.log`/`smoke-red-proof.log` 有显式退出标记） | 后续证据留档统一显式退出码尾标；不阻断 |
| M-5 | MINOR（文档债，carry-forward） | `apps/yjs-server/AGENTS.md` :21-25 单一拆卸链摘要行未逐字反映新增 drain 等待步（现写「registry shutdown → diagnostics O(1) close → persistence dispose」）；规范载体（ADR 0006 :270、integration 文档）完整，iteration 0 起登记的残余文档债，本轮未触碰亦未加重 | 后续文档变更集补一行；不阻断 |
| M-6 | MINOR（流程覆盖，本轮新增） | **committed** SA10 spec 停于 iteration 4（对象 `d60760c`）；证据归一化入库 head `94b5ee6` 有 SA3/SA4/SA8 三方覆盖，committed 面无 SA10 终面确认——因该 head 对产品/规范树零 diff，Issue 需求交付面未变，不构成缺口。（本轮审查收尾时观察到 SA10 iteration 7（dispatch `sa-09e14e1d`）正在工作区并行落盘其对该 head 的终审，未提交；该文件属 SA10 权责面，本审查未触碰。） | Controller 收取 SA10 终面确认后循例入库；不阻断 |
| （闭合项） | — | iteration 4 M-1「26 份 iter3 日志未跟踪」由本 head **闭合**（8 份本轮入库 + 3 份已随 `d60760c` 入库 + 18 份经裁决删除，事实固化于 SA3 §Evidence reconciliation，工作区净）；iteration 4 M-6（`probe-memory.log` 失败探针轨迹）维持原判（诚实留痕，无需动作） | — |

## 10. 结论

- **HEAD `94b5ee6`（及链上 `2c3a486`）在仓库/工程标准全部维度符合**：纯证据归一化入库 + 评审留档，产品树零 diff、DENY 面零触碰、空白纪律净（归一化后形态符合 `.editorconfig`）、conventional-commit 与工作区出口纪律保持；SA4 E-O1 / SA8 行动 1 的入库前置条件（重 stage 归零后形态）经本轮独立重测**已落实**。
- **证据真实互洽**：CI 失败证据与 `gh api` 本轮拉取值逐项一致；各验证日志计数轴自洽并与 CI 基线咬合；18 份冗余生成物的清理经权责链且事实固化，声明集 12/12 保全，1 次未复现负载失败诚实登记——无遮羞、无伪造、无断链。
- **无测试抑制**：被修复测试自 `d60760c` 零 diff、零 skip/only/todo、143 零容忍（仅注释）、忙窗尾序锚在位；SA6 契约文件全程零触碰；CI 门禁净强化结论沿用 iteration 4。
- **Owner comment `5751613018`（updated 2026-09-20T18:03:36Z，MEMBER，本轮 `gh api` 独立核对）要求的 hard drain-before-dispose 与 ADR 对齐确认保持完好**：ADR 成文面（:242 修订节、:270 无条件条款、:276「修订并扩展 :86」）、实现强制面（app.ts:624 drain 结构性先于 :630 唯一 dispose）、验收锚（smoke :429 尾序、S-5a/b/c）全部在位且两个 head 提交对其 diff 为空。
- **Verdict: approve**（0 BLOCKER / 0 MAJOR / 6 MINOR 非阻断；iteration 4 M-1 留档缺口由本 head 闭合）。
