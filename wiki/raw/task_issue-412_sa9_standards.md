# SA9 Standards Review — issue #412（iteration 2：最终交付 diff + CI 验证证据终审）

- 任务：issue #412（standards-review，**iteration 2**）；dispatch `sa-083c5a89-aa35-44e7-8c13-efea873b6918`
- 审查对象：**当前最终交付 diff 与 CI 验证证据**——
  1. 分支 `mabf/issue-412` 三提交链：`75bd0ab feat(persistence): add completion drain lifecycle`（#412 主体实现）→ `9094760 fix(codegen): refresh generated vfs3 assets`（CI 修复）→ `5b3ff26 docs(mabf): record CI repair final reviews`（**仅 2 wiki 文件**的留档提交，HEAD）；
  2. iteration 2 的 CI 验证证据：SA3 报告原位更新（`wiki/raw/task_issue-412_sa3_impl.md`，未提交）+ 5 份证据日志（`artifacts/sa3-issue412-iter2-*.log`，未跟踪）+ CI run `35534499992`；
  3. Owner comment `5751613018` 硬契约保持性确认（dispatch 明示要求）。
- 适用 Owner 要求：Issue comment ID `5751613018`，updated `2026-09-20T18:03:36Z`（MEMBER，author `welltop-jim-wang`）——本轮经 `gh api` **独立拉取核对**（id/updated_at/association/author 与 dispatch 逐项一致），全文三件套：①「宿主优雅停机必须先 `await drain()` 再 dispose」写为**硬性契约**（或强制前置条件）；②同步修订 ADR-0006 :86 的 dispose 定义；③dispose 保持 abortive 时保留**分层公开 drain**；另确认 retryDelayMs 解耦（缺省保持现行为）。
- 审查纪律：静态标准审查——不运行测试、不启动服务、不修改代码/设计/测试、不调度其他 SA；所有事实只读独立核对（`gh api`/`gh run view`/`gh pr view` 拉取、git diff/log 谱系、源码锚点 grep/sed 抽验、证据日志通读）。范围 = 仓库/工程标准符合性；Issue 需求完整性属 SA10 面。
- 历史轮次：iteration 0 SA9 approve（#412 主体实现）；iteration 1 SA9 approve（CI-repair diff `9094760`，0 BLOCKER/0 MAJOR/3 MINOR）。前身全文留存于 git 历史（`5b3ff26:wiki/raw/task_issue-412_sa9_standards.md` 及更早）；本文件按原位更新惯例只裁决本轮 dispatch 对象。

## 1. Reviewed inputs

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| 三提交链（`git log`/`git diff` 谱系） | 全量核对 | 最终交付 diff 的组成与边界 |
| Owner comment `5751613018` | `gh api` 本轮独立拉取（元数据 + 全文） | 保持性基准 |
| CI run `35534499992` | `gh run view --json` + 全 16 job 逐条结论 | 权威 CI 验证证据 |
| 失败 run `35532235822`（head `75bd0ab`） | SA3 报告转述 + iteration 1 已核 | 修复前基线 |
| PR #413 | `gh pr view`（headRefOid=`5b3ff26`=HEAD，OPEN） | 交付态一致性 |
| 5 份 iter2 证据日志（generate-check / shard4-node24 / persistence-contract / shutdown-tests / root-typecheck） | 全文通读 | 本机复跑证据的真实性与完备性 |
| `wiki/raw/task_issue-412_sa3_impl.md`（iteration 2 原位更新版，未提交） | 逐节交叉核对 | SA3 申报 vs 独立核验 |
| HEAD 硬契约锚点（ADR 0006 修订节 :242-282、app.ts :559/:624/:630、contract.ts :176、lifecycle.ts :858/:1079、memory.ts :192、file.ts :153） | sed/grep 现读抽验 | Owner 要求保持性确认 |
| `.github/workflows/ci.yml`（test 矩阵 :50-80 shard 命令原文、codegen-freshness :124-147）、`scripts/ci-test-shard.mjs` | 已读 | SA3 复跑命令 = CI 步骤原文的核对 |
| 工作区状态（`git status --porcelain`、`git diff --check HEAD`） | 已执行 | 出口边界与文件范围 |
| iteration 0/1 的 SA4/SA8/SA9/SA10 报告 | 已读（头部与结论节） | 历史裁决闭合状态 |

## 2. Verdict

**approve**（0 × BLOCKER；0 × MAJOR；3 × MINOR 全部非阻断，见 §8）。

核心判定：

1. **最终交付 diff 干净收敛**：HEAD `5b3ff26` 相对 `9094760` 仅含 2 个 wiki 过程文件（SA10/SA9 iteration 1 报告原位更新），相对 `75bd0ab` 在全部 #412 契约面（`packages/persistence/**`、`apps/yjs-server/**`、`docs/adr/**`、`CONTEXT.md`、`docs/integration/**`、`packages/dsh-persistence/**`、`packages/namespace-registry/**`、`docs/protocols/**`、`packages/ws-replication/**`、`.github/**`、`domains/**`、`packages/vfsl*/**`）**diff 为空**（本审查逐路径核对）。
2. **CI 验证证据真实闭合**：CI run `35534499992`（headSha = `5b3ff26` = HEAD = PR #413 headRefOid）**conclusion `success`，16/16 job 全绿**——dispatch 具名的 `codegen-freshness`、`test (20, 4)`、`test (24, 4)` 均在列；5 份本机证据日志形态真实（vitest/tsc 输出 + EXIT=0），测试计数与 SA3 申报逐项一致，复跑命令与 ci.yml 步骤原文逐字一致。
3. **Owner comment 5751613018 硬契约保持完好**：成文面（ADR 0006 修订节第 3 条无条件硬契约 + 第 4 条「修订并扩展 :86」）、实现面（app.ts:624 `awaitDrainWithBudget(adapter.drain(), budgetMs)` 结构性先于全仓唯一 dispose 调用点 :630；contract.ts:176 分层 `drain?` optional；lifecycle.ts:858）、验收面（SA6 契约 27+5、semantics 9、shutdown 3 全部在证据日志中绿）三层锚点全部在位、本轮零触碰。
4. **iteration 2 零产品改动是正确裁决**：dispatch 具名的三个失败检查根因同一（发布提交 `abbb89a` 版本 bump 未重生成），已由 iteration 1 提交修复并经 CI 转绿；本轮新增任何产品改动都构成 scope creep。SA3 以「CI 原文命令复跑 + 契约切片重跑」替代无谓改动，符合最小改动与 TDD 纪律的实质（验证而非制造变更）。

## 3. 最终交付 diff 的标准符合性（iteration 2 增量核对）

| 维度 | 核对结果 |
| --- | --- |
| 提交链组成 | `75bd0ab`（主体，iteration 0 approve）→ `9094760`（CI 修复，iteration 1 approve）→ `5b3ff26`（wiki 留档）。`git diff 9094760..5b3ff26 --name-only` = 恰 `task_issue-412_sa10_spec.md` + `task_issue-412_sa9_standards.md` 两 wiki 文件——**纯过程产物提交**，零代码/零规范文本 |
| 契约面零漂移 | `git diff 9094760..HEAD` 与 `git diff 75bd0ab..HEAD` 对 §1 列出的全部契约面路径输出均为空——iteration 1 批准的内容（含 Owner 硬契约全部载体）逐字节保持 |
| 文件范围（ALLOW/DENY） | iteration 2 **零产品改动**，不存在越出设计 §11 ALLOW 的新面；DENY 清单（persistence `service.ts`/`testing.ts`、namespace-registry、dsh 四件、既有测试与冻结审计、SA6 两契约文件、apps 既有测试、`docs/protocols/**`、`packages/ws-replication/**`、`packages/vfsl-codegen/**`、`.github/**`、`schema.vfsl`）经 `git status --porcelain` 出口核对**零触碰**（产品树无 M/? 条目） |
| 工作区出口 | 恰 1 修改（SA3 自身报告原位更新）+ 5 未跟踪（证据日志）；`git diff --check HEAD` 干净；SA3 未 commit/push/建 PR——符合 SA 纪律（提交权属 Controller） |
| commit message | HEAD 三提交均符合仓内 conventional-commit 惯例（`feat(persistence):`/`fix(codegen):`/`docs(mabf):`） |
| 历史产物只读 | iteration 0/1 各 SA 报告经原位更新机制演进，前身全文在 git 历史可溯；无改写历史行为 |

## 4. CI 验证证据审查

| 证据 | 独立核验 | 判定 |
| --- | --- | --- |
| CI run `35534499992` | `gh run view --json status,conclusion,headSha` → `success`/`5b3ff26…`=HEAD；`--json jobs` 16 条结论逐条为 `success`（codegen-freshness / typecheck / contract-gates / packaging / test (20,1-6) / test (24,1-6)） | ✅ 权威闭合 |
| dispatch 具名三检查 | `codegen-freshness` ✓、`test (20, 4)` ✓、`test (24, 4)` ✓ 均在 run 内且绿 | ✅ 修复目标达成 |
| `sa3-issue412-iter2-generate-check.log` | `pnpm generate --check`（ci.yml:147 步骤原文）EXIT=0 | ✅ 与 CI 同锚 |
| `sa3-issue412-iter2-shard4-node24.log` | 命令 = ci.yml :74-77 shard 步骤原文（`node scripts/ci-test-shard.mjs 4 6` + vitest 显式文件列表 + `--typecheck.enabled=false --passWithNoTests=false`）；**65 files / 767 tests 全绿**，含修复前红的 `generate-union-member-docs.test.ts` 33 tests 与 #412 `drain-semantics` 9 tests；与 CI `test (24, 4)` 的 65 文件数一致 | ✅ 真实复跑 |
| `sa3-issue412-iter2-persistence-contract.log` | **21 files / 221 tests 全绿 + Type Errors: no errors**，含 SA6 契约 `drain-red` 27 + `drain-surface.test-d` 5 + `drain-semantics` 9 | ✅ 契约面闭合 |
| `sa3-issue412-iter2-shutdown-tests.log` | `persistence-drain-shutdown.test.ts` **3 tests 全绿**（S-5a/S-5b/S-5c），no type errors | ✅ 停机硬契约锚闭合 |
| `sa3-issue412-iter2-root-typecheck.log` | root `pnpm typecheck` 15 个 tsconfig 段 EXIT=0 | ✅ root 门闭合 |
| Node 版本面 | 本机 v24.13.0（本审查实测）；Node 20 面以 CI 为权威证据并在 SA3 报告 Deferred 节透明申报——分工合理 | ✅ 透明 |
| 证据留档惯例 | `artifacts/*.log` = 仓内既有 SA3 证据惯例（`git ls-files artifacts/` = **207** 项，与 SA3 申报一致） | ✅ 惯例一致 |

## 5. Owner comment 5751613018 硬契约保持确认（本轮独立抽验）

| Owner 要求 | HEAD 证据（本审查现读） | 判定 |
| --- | --- | --- |
| ① drain-before-dispose **硬契约**（或强制前置；非建议） | ADR 0006 修订节第 3 条（:270 起）：「**停机硬契约（无条件；owner 要求 comment 5751613018）**：宿主优雅停机在调用 `dispose()` 之前必须先 await `drain()`」+ 预算尽 = `persistence-drain-budget-exceeded` 可观察事件后的**显式可观察退出而非违约** + 未 drain 直接 dispose 的静默丢失代价申明；适用面不以 adapter 类型特判（file/memory 同一排空步）。实现：app.ts:624 `awaitDrainWithBudget(adapter.drain(), budgetMs)` → :625 预算事件 → :630 全仓唯一 `persistenceFiber.dispose()`（grep 核实唯一调用点；:554 命中为 doc-comment） | **保持** |
| ② 同步修订 ADR-0006 :86 dispose 定义 | ADR 0006 修订节第 4 条（:276 起）：「本节**修订并扩展** :86 的 dispose 定义边界」——dispose 语义不变保持 abortive/有损（abort→clearTimers→doc.destroy→cells.clear→allSettled；§228-5 重申）、**从来不是持久性屏障**、持久性唯一经分层公开 drain 表达、「dispose 内部先 drain」否决论证在文 | **保持** |
| ③ dispose 保持 abortive + 分层公开 drain | contract.ts:176 `readonly drain?:` optional 分层成员（与 importDoc/archiveDoc 同款放置先例）；lifecycle.ts:858 `async drain(targets?)`；memory.ts:192 / file.ts:153 委派（File 入口 `validateIdentity`）；SA6 契约 27 运行期 + 5 类型面锚在本轮证据日志中全绿 | **保持** |
| ④ retryDelayMs 解耦（缺省保持现行为） | contract.ts:523 `readonly retryDelayMs?: number` + :551 条件展开（键缺席不物化）；lifecycle.ts:1079 动态回退 `(retryDelayMs ?? debounceMs) \|\| 1`；ADR 第 5 条解析形状红线 | **保持** |

三提交链对上述全部载体路径 diff 为空（§3）——iteration 2 零触碰，Owner 要求**确认保持完好**。

## 6. SA3 iteration 2 报告交叉核对

| SA3 申报 | 本审查独立核验 | 一致性 |
| --- | --- | --- |
| 三个具名 CI 检查在 HEAD 全绿（run `35534499992` success） | `gh run view` 拉取：conclusion/headSha/16 job 逐项一致 | ✅ |
| 失败 run `35532235822`（head `75bd0ab`）三 job 红、同一根因 | 与 iteration 1 SA9/SA10 独立核对结论一致；根因归属（`abbb89a` 版本 bump 未重生成）已经三重字节谱系验证闭合 | ✅ |
| 本轮零产品代码改动 | `git status --porcelain` 产品树全净；`git diff HEAD --stat` 仅 wiki/artifacts 面 | ✅ |
| SA6 契约文件与验收锚零改动 | 三文件已 tracked 且无 diff；证据日志显示 27+5/9/3 全绿 | ✅ |
| `artifacts/` 207 项 tracked 惯例 | 实测 = 207 | ✅ |
| CI 分片命令复跑 | ci.yml :74-77 原文逐字一致；65 files/767 tests 与 CI 分片文件数吻合 | ✅ |
| 「全仓唯一 `persistenceFiber.dispose()`」 | grep 核实：唯一调用点 app.ts:630 | ✅ |

## 7. 仓库 AGENTS / 惯例总核对（本轮触面）

| 条款 | 结果 |
| --- | --- |
| root AGENTS（模块 AGENTS 先读、issue tracker、domain docs） | 本轮零模块文件改动；过程产物证实 SA3 已读相关 AGENTS |
| docs AGENTS：wiki/raw = 证据层非规范 | HEAD wiki-only 提交与本轮 SA3 报告/日志均为证据层产物，无规范文本冒充；规范演进面（ADR 0006 修订节等）在 iteration 0 已同变更集落地且本轮零触碰 |
| 单一事实源 | 本轮未引入任何新事实源；生成器版本唯一源 = `packages/vfsl-codegen/package.json`、字节钉值唯一载体 = 两哨兵（iteration 1 状态保持） |
| 生命周期对称性 | 失败 run（红）→ 根因修复（iteration 1）→ 成功 run（绿）→ 验证留档（本轮）应答链完整；门禁报警面未被削弱 |
| 测试质量标准 | 本轮零测试改动；证据日志显示真实 runner 发现（显式文件列表 + `--passWithNoTests=false`），无 skip/only/todo 引入 |
| 流程纪律 | SA3 未 commit/push/建 PR、未调度其他 SA；未提交产物（SA3 报告 + 5 日志 + 本报告）按惯例留 Controller 收口 |

## 8. Findings（全部 MINOR，非阻断）

| # | 严重度 | Finding | 处置建议 |
| --- | --- | --- | --- |
| M-1 | MINOR（流程，carry-forward） | iteration 1 N-1 的发布流程缺口（bump `@nomicore/vfsl-codegen` 版本未同变更集 `pnpm generate`）仍是仓库级流程风险；SA3 报告 Deferred 节与 SA10 O4 已同款登记 | 维持原建议：后续发布变更集同集重生成；无需本 issue 变更集动作 |
| M-2 | MINOR（留档说明） | iteration 2 产物（SA3 报告修改 + 5 证据日志 + 本 SA9 报告）当前未提交/未跟踪——与历次「SA 产出、Controller 提交」分工一致，非缺陷 | Controller 收口时一并提交即可 |
| M-3 | MINOR（文档债，carry-forward） | `apps/yjs-server/AGENTS.md` 单一拆卸链摘要行未逐字反映新增 drain 等待步（不矛盾，drain 是同一链内等待步）；iteration 0 起登记的残余文档债 | 建议后续文档变更集补一行；不阻断 |

## 9. 结论

- **最终交付 diff**（`75bd0ab`→`9094760`→`5b3ff26`）在仓库/工程标准全部维度符合：主体实现与 CI 修复已经 iteration 0/1 批准且逐字节保持；HEAD 增量为纯 wiki 留档；DENY 面与生成器/协议/工作流文件零触碰；conventional-commit 与历史只读纪律保持。
- **CI 验证证据真实完备**：CI run `35534499992`（head = HEAD = PR #413 head）16/16 job 全绿，dispatch 具名三检查闭合；5 份本机日志与 SA3 申报逐项经独立核验一致。
- **Owner comment `5751613018`（updated 2026-09-20T18:03:36Z，MEMBER，本轮 `gh api` 独立核对）要求的 drain-before-dispose 硬契约与 ADR-0006 :86 对齐确认保持完好**：ADR 成文面、app.ts 结构性强制面、契约/实现/验收三层锚点全部在位，iteration 2 零触碰。
- **Verdict: approve**（0 BLOCKER / 0 MAJOR / 3 MINOR 非阻断）。
