# SA9 Standards Review — issue #412（iteration 3：最终留档提交 `bdb91cb` 终审）

- 任务：issue #412（standards-review，**iteration 3**）；dispatch `sa-c96f1b5b-c620-40bf-a57d-7f8fce7f1a23`（role `mabf-sa9`，phase standards-review）——「Review the current final commit, which records CI-verification logs and final review evidence, for repository and engineering standards. Confirm no semantic delivery change and that owner comment 5751613018 (updated 2026-09-20T18:03:36Z; MEMBER) hard drain-before-dispose contract and ADR alignment remain intact.」
- 审查对象：**当前最终提交 `bdb91cb`「chore(ci): record issue 412 verification evidence」**（HEAD）及其四提交链谱系：`75bd0ab feat(persistence): add completion drain lifecycle`（#412 主体）→ `9094760 fix(codegen): refresh generated vfs3 assets`（CI 修复）→ `5b3ff26 docs(mabf): record CI repair final reviews`（评审留档）→ `bdb91cb`（验证证据留档）。
- 适用 Owner 要求：Issue comment ID `5751613018`——本轮经 `gh api repos/nomicore-ai/nomicore/issues/comments/5751613018` **独立拉取核对**：`id=5751613018`、`updated_at=2026-09-20T18:03:36Z`、`author_association=MEMBER`、author `welltop-jim-wang`，与 dispatch 逐项一致，无更新版本覆盖。要求面（全文三件套+确认件）：①「宿主优雅停机必须先 `await drain()` 再 dispose」写为**硬性契约**（或强制前置条件；分层方案可接受：公开 `drain()`、dispose 保持 abort 式）；②**同步修订 ADR-0006 :86** dispose 定义；③dispose 保持 abortive 时保留**分层公开 drain**；④retryDelayMs 解耦（缺省保持现行为）。
- 审查纪律：静态标准审查——不运行测试、不启动服务、不修改代码/设计/测试、不调度其他 SA；所有事实只读独立核对（`gh api`/`gh run view`/`gh pr view` 本轮拉取、git diff/log 字节谱系、源码锚点 grep/sed 现读抽验、5 份证据日志全文通读）。范围 = 仓库/工程标准符合性；Issue 需求完整性属 SA10 面。
- 历史轮次：iteration 0 SA9 approve（#412 主体实现）；iteration 1 SA9 approve（CI-repair `9094760`）；iteration 2 SA9 approve（最终交付 diff + CI 验证证据，0 BLOCKER/0 MAJOR/3 MINOR）。前身全文留存于 git 历史（`bdb91cb:wiki/raw/task_issue-412_sa9_standards.md` 及更早）；本文件按原位更新惯例只裁决本轮 dispatch 对象。

## 1. Reviewed inputs

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| HEAD 提交 `bdb91cb` 全量 diff（`git show --stat` + 逐文件核对） | 全量核对 | 被审对象的组成与边界 |
| 四提交链谱系（`git log`/`git diff` 各段） | 全量核对 | 语义交付零变更证明 |
| Owner comment `5751613018` | `gh api` 本轮独立拉取（元数据 + 全文） | 保持性基准 |
| CI run `35534499992` | `gh run view --json status,conclusion,headSha,jobs` 本轮拉取 | 权威 CI 验证证据 |
| PR #413 | `gh pr view --json state,headRefOid,mergeable,statusCheckRollup` 本轮拉取 | 交付态一致性 |
| 5 份新增证据日志（`artifacts/sa3-issue412-iter2-*.log`） | 全文通读 | 证据真实性与内部一致性 |
| HEAD 更新的 3 份 wiki 过程产物（SA3 impl / SA9 iteration 2 / SA10 iteration 2） | 逐节阅读 + diff 核对 | 留档内容与独立核验的一致性 |
| HEAD 硬契约锚点（ADR 0006 修订节 :242-282、app.ts :559/:624/:625/:630、contract.ts :176/:523、lifecycle.ts :858/:1079、memory.ts :192、file.ts :153、config.ts :42/:275-278、main.ts :97-99） | sed/grep 现读抽验 | Owner 要求保持性确认 |
| `.github/workflows/ci.yml`（test 分片步骤 :74-77、codegen-freshness 步骤 :146-147） | 已读 | 日志复跑命令 = CI 步骤原文的核对 |
| SA6 两契约文件谱系（`git log -- <两文件>`） | 已执行 | 零触碰核对 |
| 工作区状态（`git status --porcelain`、`git status -sb`、`git diff --check HEAD`） | 已执行 | 出口边界 |
| `docs/AGENTS.md`（wiki/raw = 证据层非规范条款） | 已读 | 留档面性质核对 |

## 2. Verdict

**approve**（0 × BLOCKER；0 × MAJOR；4 × MINOR 全部非阻断，见 §7）。

核心判定：

1. **HEAD 提交零语义交付变更**：`bdb91cb` 相对 `5b3ff26` 恰含 8 个文件——5 份新增证据日志（`artifacts/sa3-issue412-iter2-*.log`）+ 3 份 wiki 过程产物原位更新（SA3 impl / SA9 / SA10 的 iteration 2 版）；对全部产品树路径（`packages/**`、`apps/**`、`docs/**`、`domains/**`、`CONTEXT.md`、`.github/**`、`scripts/**`、`tests/**` 及根配置）`git diff 9094760..bdb91cb` 与 `git diff 5b3ff26..bdb91cb` 输出**均为空**（本审查逐路径核对，文件计数 = 0）。
2. **留档内容真实、与独立核验一致**：5 份日志形态真实（vitest v3.2.7 / tsc 输出 + EXIT=0），测试计数内部一致且与 CI run `35534499992`（conclusion `success`，16/16 job 绿，headSha = `5b3ff26`——其产品树与 `bdb91cb` 逐字节相同）互洽；SA3/SA9/SA10 iteration 2 报告的关键申报（CI 结论、锚点位置、零触碰面）经本轮独立复核逐项成立。
3. **Owner comment 5751613018 硬契约与 ADR 对齐保持完好**：成文面（ADR 0006 修订节第 3 条无条件停机硬契约 + 第 4 条「修订并扩展 :86」对齐条款 + 第 5 条 retryDelayMs 解析形状）、实现面（app.ts:624 `awaitDrainWithBudget(adapter.drain(), budgetMs)` 结构性先于全仓唯一 `persistenceFiber.dispose()` 调用点 :630；contract.ts:176 分层 `drain?` optional；lifecycle.ts:858；双 adapter 委派 memory.ts:192/file.ts:153）、验收面（SA6 契约 27+5、semantics 9、shutdown 3 在证据日志中全绿）三层锚点全部在位；HEAD 提交对其**零触碰**（物理上不可能削弱——diff 为空）。
4. **留档提交本身符合仓库惯例**：conventional-commit（`chore(ci):`）与仓内历史同款；`artifacts/*.log` 是既有 SA3 证据惯例（tracked 数 207 → 212，恰 +5）；wiki/raw 为证据层非规范（docs/AGENTS.md 明文），过程产物原位更新、前身可溯；工作区出口干净（`git status --porcelain` 空、`git diff --check HEAD` 净）。

## 3. HEAD 提交组成与「零语义变更」证明

| 维度 | 核对结果 |
| --- | --- |
| 文件清单 | `git show bdb91cb --stat` = 恰 8 文件：5 × `artifacts/sa3-issue412-iter2-*.log`（新增，+184 行）+ `wiki/raw/task_issue-412_sa3_impl.md`（原位更新）+ `..._sa9_standards.md`（原位更新）+ `..._sa10_spec.md`（原位更新）——**纯证据/过程产物，零代码、零规范文本、零生成物** |
| 产品树零漂移 | `git diff 5b3ff26..bdb91cb -- packages apps docs domains CONTEXT.md .github scripts tests package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.typecheck.json vitest.config.ts` → **空**；`--name-only` 计数 = **0** |
| 相对 iteration 1 批准态 | `git diff 9094760..bdb91cb` 同样对产品树为空——iteration 1 批准的 CI 修复与 iteration 0 批准的主体实现逐字节保持 |
| DENY 面零触碰 | 设计 §11 DENY 清单（persistence `service.ts`/`testing.ts`、namespace-registry、dsh 四件、既有测试与冻结审计、SA6 两契约文件、apps 既有测试、`docs/protocols/**`、`packages/ws-replication/**`、`packages/vfsl-codegen/**`、`.github/**`、`schema.vfsl`）不在 HEAD diff 名单内；SA6 两契约文件 `git log` 仅 `75bd0ab`（引入提交）一条 |
| commit message | `chore(ci): record issue 412 verification evidence`——内容相符（验证日志 + 终审评审留档），符合仓内 conventional-commit 惯例（`feat(persistence):`/`fix(codegen):`/`docs(mabf):`/`chore(ci):` 同款谱系） |
| 历史只读 | 3 份 wiki 报告按原位更新机制演进，前身全文在 git 历史可溯（`5b3ff26`/`9094760`/`75bd0ab` 各版）；无改写历史行为 |
| 工作区出口 | `git status --porcelain` 空；`git diff --check HEAD` 干净；分支 `mabf/issue-412` 领先 `origin/main` 4 提交（推送权属 Controller，非 SA 面） |

## 4. CI 验证证据与留档日志审查

| 证据 | 本轮独立核验 | 判定 |
| --- | --- | --- |
| CI run `35534499992` | `gh run view`：`status=completed`、`conclusion=success`、`headSha=5b3ff26…`；16 job 逐条 `success`（codegen-freshness / typecheck / contract-gates / packaging / test (20,1-6) / test (24,1-6)） | ✅ 权威闭合；head 产品树与 `bdb91cb` 逐字节相同（§3），证据对 HEAD 有效 |
| PR #413 | `state=OPEN`、`mergeable=MERGEABLE`、statusCheckRollup 无非 SUCCESS 项 | ✅ 交付态一致 |
| `iter2-generate-check.log` | `pnpm generate --check`（ci.yml:147 步骤原文）EXIT=0 | ✅ 与 CI `codegen-freshness` ✓ 互洽 |
| `iter2-shard4-node24.log` | 命令 = ci.yml :74-77 分片步骤原文（`node scripts/ci-test-shard.mjs 4 6` + vitest `--typecheck.enabled=false --passWithNoTests=false`）；**65 files / 767 tests 全绿 EXIT=0**，含修复前红的 `generate-union-member-docs.test.ts` 33 tests 与 `drain-semantics` 9 tests；文件数与 CI `test (24,4)`/`test (20,4)` 各 65 吻合 | ✅ 真实复跑 |
| `iter2-persistence-contract.log` | **21 files / 221 tests 全绿 + Type Errors: no errors EXIT=0**，含 SA6 契约 `drain-red` 27 + `drain-surface.test-d` 5（TS）+ `drain-semantics` 9 | ✅ 契约面闭合 |
| `iter2-shutdown-tests.log` | `persistence-drain-shutdown.test.ts` **3 tests 全绿 EXIT=0**（S-5b 明文：预算内收口 + `persistence-drain-budget-exceeded` 先于 dispose + 有损可观察） | ✅ 停机硬契约锚闭合 |
| `iter2-root-typecheck.log` | root `pnpm typecheck` 15 个 tsconfig 段 EXIT=0 | ✅ root 门闭合 |
| 日志留档惯例 | `git ls-files artifacts/` = **212**（207 + 恰 5 份新增）——与 SA3 申报的既有惯例一致 | ✅ 惯例一致 |
| SA3/SA9/SA10 iteration 2 报告 | 关键申报（CI 结论、三提交链零触碰、锚点位置、测试计数）经本轮独立复核逐项成立；SA10 承接披露项（范围扩权、哨兵重钉、根因归属、CI 终判已关闭）维持有效 | ✅ 留档属实 |

## 5. Owner comment 5751613018 硬契约保持确认（本轮独立抽验）

| Owner 要求 | HEAD 证据（本审查现读） | 判定 |
| --- | --- | --- |
| ① drain-before-dispose **硬契约**（或强制前置；非建议） | ADR 0006 修订节第 3 条（:270 起）：「**停机硬契约（无条件；owner 要求 comment 5751613018）**：宿主优雅停机在调用 `dispose()` 之前必须先 await `drain()`」+ 预算尽 = `persistence-drain-budget-exceeded{budgetMs}` 可观察事件后的**显式可观察退出而非违约** + 未 drain 直接 dispose 的静默丢失代价申明；适用面不以 adapter 类型特判（file/memory 同一排空步）。实现：app.ts:624 `awaitDrainWithBudget(adapter.drain(), budgetMs)` → :625 预算事件 → :630 全仓唯一 `persistenceFiber.dispose()`（grep 核实唯一调用点；:554 为 doc-comment、:634 为 cordis `ctx.fiber` 另一对象）；预算立法链 config.ts:42 `MAX_MAX_DIRTY_MS = 30_000` + :275-278 校验 + app.ts:92 `DRAIN_MARGIN_MS = 500` + main.ts:97-99 注释 | **保持** |
| ② 同步修订 ADR-0006 :86 dispose 定义 | ADR 0006 修订节第 4 条（:276 起）：「本节**修订并扩展** :86 的 dispose 定义边界」——dispose 语义**不变保持 abortive/有损**（abort→clearTimers→doc.destroy→cells.clear→allSettled；§228-5 重申）、**从来不是持久性屏障**、持久性唯一经分层公开 drain 表达、「dispose 内部先 drain」否决论证在文 | **保持** |
| ③ dispose 保持 abortive + 分层公开 drain | contract.ts:176 `readonly drain?:` optional 分层成员（与 importDoc/archiveDoc 同款放置先例）；lifecycle.ts:858 `async drain(targets?)`；memory.ts:192 / file.ts:153 委派（File 入口 `validateIdentity`）；SA6 契约 27 运行期 + 5 类型面锚在本轮证据日志中全绿 | **保持** |
| ④ retryDelayMs 解耦（缺省保持现行为） | contract.ts:523 `readonly retryDelayMs?: number` + 条件展开（键缺席不物化）；lifecycle.ts:1079 单源 getter `(retryDelayMs ?? debounceMs) \|\| 1` 动态回退；ADR 第 5 条解析形状红线；冻结审计零改动即绿 | **保持** |

HEAD 提交（及前置留档提交 `5b3ff26`）对上述全部载体路径 **diff 为空**（§3）——Owner 要求**确认保持完好**，且纯证据型提交在物理上不可能削弱契约面。

## 6. 仓库 AGENTS / 工程惯例总核对（本轮触面）

| 条款 | 结果 |
| --- | --- |
| root AGENTS（模块 AGENTS 先读、issue tracker、domain docs、worktrees 位置） | 本轮零模块文件改动；留档产物证实上游 SA 已读相关 AGENTS；worktree 位于仓库旁 `.worktrees` 惯例位置（本任务 worktree 由 Host 固定） |
| docs/AGENTS：wiki/raw = 证据层非规范 | HEAD 的 wiki 三文件与 5 份日志均为证据层产物，无规范文本冒充；规范演进面（ADR 0006 修订节等）在 iteration 0 已同变更集落地且本轮零触碰 |
| 单一事实源 | 本轮未引入任何新事实源；生成器版本唯一源 = `packages/vfsl-codegen/package.json`、字节钉值唯一载体 = 两哨兵（iteration 1 状态保持）；ADR 0006 为 drain/dispose 语义唯一规范载体 |
| 生命周期对称性 | 失败 run（红）→ 根因修复（iteration 1）→ 成功 run（绿）→ 验证留档（iteration 2）→ 证据入库（本轮 HEAD）应答链完整闭合；门禁报警面未削弱 |
| 测试质量标准 | 本轮零测试改动；证据日志显示真实 runner 发现（显式文件列表 + `--passWithNoTests=false` 防假绿），无 skip/only/todo 引入；SA6 契约文件零触碰 |
| 流程纪律 | 本审查未 commit/push/建 PR、未调度其他 SA；HEAD 提交本身为 Controller 收口动作（SA 产出、Controller 提交的分工保持） |

## 7. Findings（全部 MINOR，非阻断）

| # | 严重度 | Finding | 处置建议 |
| --- | --- | --- | --- |
| M-1 | MINOR（流程，carry-forward） | 发布流程缺口（bump `@nomicore/vfsl-codegen` 版本未同变更集 `pnpm generate`）仍是仓库级流程风险；SA3 Deferred 节与 SA10 N-4 已同款登记 | 维持原建议：后续发布变更集同集重生成；无需本 issue 变更集动作 |
| M-2 | MINOR（留档时序，本轮新增） | HEAD 内 SA3/SA9/SA10 iteration 2 报告的「当前 HEAD」行均记为 `5b3ff26`——成文早于 Controller 提交 `bdb91cb`，属「SA 产出 → Controller 提交」分工的固有留档时序；证据层文件，无规范影响 | 无需动作；本报告（iteration 3）即为 HEAD 态终审记录 |
| M-3 | MINOR（流程观察，本轮新增） | PR #413 `headRefOid` = `5b3ff26`，本地 HEAD `bdb91cb`（证据留档提交）尚未推送；分支领先 `origin/main` 4 提交 | Controller 推送即闭合；CI 结论不受纯证据提交影响（产品树逐字节相同） |
| M-4 | MINOR（文档债，carry-forward） | `apps/yjs-server/AGENTS.md` 单一拆卸链摘要行未逐字反映新增 drain 等待步（不矛盾，drain 是同一链内等待步）；iteration 0 起登记的残余文档债 | 建议后续文档变更集补一行；不阻断 |

## 8. 结论

- **最终提交 `bdb91cb` 在仓库/工程标准全部维度符合**：恰 8 文件纯证据留档（5 验证日志 + 3 评审报告原位更新），产品树零 diff、DENY 面零触碰、SA6 契约文件零触碰、conventional-commit 与历史只读纪律保持、工作区出口干净。**确认零语义交付变更**——iteration 0/1 批准的主体实现与 CI 修复逐字节保持。
- **CI 验证证据真实完备且与留档一致**：CI run `35534499992`（head 产品树 = HEAD 产品树）16/16 job 全绿本轮独立证实；5 份日志形态真实、计数互洽、复跑命令与 ci.yml 步骤原文逐字一致。
- **Owner comment `5751613018`（updated 2026-09-20T18:03:36Z，MEMBER，本轮 `gh api` 独立核对）要求的 drain-before-dispose 硬契约与 ADR-0006 :86 对齐确认保持完好**：ADR 成文面（:270 无条件条款、:276「修订并扩展 :86」）、app.ts 结构性强制面（drain :624 先于唯一 dispose :630）、契约/实现/验收三层锚点全部在位，HEAD 零触碰。
- **Verdict: approve**（0 BLOCKER / 0 MAJOR / 4 MINOR 非阻断）。
