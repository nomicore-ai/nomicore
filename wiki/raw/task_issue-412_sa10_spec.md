# SA10 Spec Review — issue #412（iteration 2：最终交付 diff + CI 验证证据终审）

- 任务：issue #412（persistence 公开完成式排空 `drain()` + `retryDelayMs` 解耦 + 停机硬契约）
- 本轮 dispatch：`sa-8c3fcd5b-83f2-492f-a65b-19b134667e9a`（phase **spec-review**，**iteration 2**）——「Review the current final delivered diff and CI-verification evidence against issue #412, acceptance evidence, and normative specifications. Owner comment 5751613018 … requires a hard graceful-shutdown drain-before-dispose contract (or mandatory precondition) and ADR alignment; confirm it remains intact.」
- **审查对象：最终交付 diff = PR #413 全量（base `c3f7bd9` → HEAD `5b3ff263f900f7e475e49424f366b0aeffaa555f`），三提交**：`75bd0ab feat(persistence): add completion drain lifecycle`（#412 主体，27 文件）+ `9094760 fix(codegen): refresh generated vfs3 assets`（CI 修复，3 产品 + 3 wiki）+ `5b3ff26 docs(mabf): record CI repair final reviews`（2 wiki 评审记录）。工作区另有未提交过程产物：SA3 报告原位更新（`M`，314 行改写）+ 5 份未跟踪 iteration 2 证据日志（`artifacts/sa3-issue412-iter2-*.log`）——零产品代码
- 适用 Owner 要求：Issue comment ID `5751613018`——本轮经 `gh api repos/nomicore-ai/nomicore/issues/comments/5751613018` **独立拉取全文核对**：`id=5751613018`、`updated_at=2026-09-20T18:03:36Z`、`author_association=MEMBER`，与 dispatch 逐项一致，无更新版本覆盖。要求面 = ①「宿主优雅停机必须先 `await drain()` 再 dispose」写为**硬性契约**（分层方案可接受：公开 `drain()`、dispose 保持 abort 式）；②**同步修订 ADR-0006 :86** dispose 定义（否则契约与实现继续脱节）；③第三击穿窗口（degraded retry 回退窗）确认；④问题 2 解耦确认（缺省保持现行为）
- 审查纪律：spec 审查。未修改任何代码/设计/测试、未运行测试套件、未启动服务、未调度其他 SA。本轮证据 = 只读核验：git 考古/diff/grep 锚点、`gh run view`/`gh pr view`/`gh api` 只读拉取、SA3/SA4/SA8/SA9 申报交叉核对
- 历史轮次：iteration 0（主体实现 `75bd0ab`，**approve**）与 iteration 1（CI-repair `9094760`，**approve**）结论经本轮复核**保持**（见 §3/§4：两对象逐字节未被后续触碰）；存档见文末附录

## Verdict

**approve**（0 × BLOCKER / 0 × MAJOR / 0 × 新增 MINOR；承接披露项见 §6，非阻断观察见 §5）。

核心判定：

1. **Issue #412 全部请求面落地且保持**：公开完成式排空 `drain()`（`DocPersistence.drain?` optional 成员 contract.ts:176 + lifecycle 状态机单点 lifecycle.ts:858 + 双 adapter 委派 memory.ts:192/file.ts:153 + barrel 导出 index.ts:37 + 可选 `targets` 参数）、`retryDelayMs` 独立配置且缺省动态回退 `debounceMs`（contract.ts:523/:551 条件展开 + lifecycle.ts:1078 单源 getter 两落点 :1094/:1152 + DSH 探针镜像锁步 probe.ts:446）、宿主固定睡眠替换为**有预算完成式排空**（app.ts:624 `awaitDrainWithBudget(adapter.drain(), budgetMs)`，file/memory 统一无 kind 特判——SA2-7 路径 (b)）。
2. **Owner 评论 5751613018 硬契约与 ADR 对齐保持完好（本轮核心问题，逐项在位核验）**：ADR 0006 修订节 :242-282 七条款完整——:270 **无条件停机硬契约条款**（明文引用 comment 5751613018；「预算尽后继续 dispose 是显式可观察退出，不是违约」；「未经 drain 直接 dispose 的宿主接受静默丢失」代价申明）；:276 **「本节修订并扩展 :86 的 dispose 定义边界」**对齐条款（dispose 保持 abortive/有损、从来不是持久性屏障、持久性唯一经分层公开 drain 表达）；app.ts 结构性强制——停机链第 3 步 drain（:624）**先于**全仓唯一 `persistenceFiber.dispose()`（:630），预算尽先发 `persistence-drain-budget-exceeded`（:625）再继续；对外指引 cordis-plugin-hosting.md :64/:458 硬契约句 + :468-474 示例代码块含 bounded drain 步；CONTEXT.md:139「完成式排空（drain）」词条（含 `_Avoid_` 行）。修复轮两提交（`9094760`/`5b3ff26`）对全部 #412 契约面 **diff 为空**（§3 零交集证明）。
3. **验收证据链闭合且权威**：SA6 契约 C1–C14（27 运行期 + 5 类型）+ 补充锚 S-1~S-4（9 tests）+ S-5a/S-5b/S-5c（3 tests）在 iteration 2 重跑中全绿（本机日志 exit 0）；**CI run `35534499992`（headSha = `5b3ff26` = PR #413 `headRefOid`）conclusion = `success`，16 个 job（typecheck / contract-gates / codegen-freshness / packaging / 12 测试分片，Node 20+24 双矩阵）全部 SUCCESS**——本轮以 `gh run view` 与 `gh pr view` 独立证实，非仅 SA3 申报。
4. **无 scope creep 新增**：全 PR diff = 设计 §11 ALLOW 12 产品文件 + SA6 两契约文件（零触碰提交）+ 3 个 dispatch 明示授权的 codegen 修复文件（iteration 1 已披露）+ 10 份 wiki 过程产物；DENY 面逐项零触碰（§4）。

## 1. Reviewed inputs

| 输入 | 状态 |
| --- | --- |
| Issue #412 正文快照（`wiki/raw/task_issue-412.md`） | 已读 |
| Owner comment 5751613018 全文（`gh api` 本轮独立拉取） | 已读核对（id/updated_at/association 逐项一致） |
| 最终交付 diff：`git diff c3f7bd9..HEAD --name-only`（30 文件全量）+ 三提交 `git show --stat` | 已读 |
| DENY 面 diff（namespace-registry / docs/protocols / ws-replication / persistence service.ts+testing.ts / dsh 四件 / .github / 既有测试与冻结审计） | 全部为空（实证） |
| CI 证据：`gh run view 35534499992`（status completed / conclusion success / headSha=5b3ff26）+ `gh pr view 413`（OPEN / MERGEABLE / 16 checks 全 SUCCESS） | 已独立证实 |
| 本机 iteration 2 证据日志 5 份（`artifacts/sa3-issue412-iter2-*.log`） | 已读（见 §2） |
| SA3 iteration 2 报告（工作区原位更新版）、SA4（Part A+B approve）、SA9（approve）、SA8 实现后复审（clear / requiresConflictRecheck false）、SA2（iteration 1 verdict approve） | 已读并交叉核对 |
| 设计 iteration 2（§11 ALLOW/DENY、§12 验收映射、DD-1~DD-8） | 已读（范围核对用） |
| HEAD 锚点：ADR 0006 :242-282 全文、app.ts :540-640 停机链、lifecycle.ts :840-879 drain 实现、contract.ts、memory/file/index、probe.ts:444-447、config.ts/main.ts 注释、CONTEXT.md:137-146、hub-peer-deployment.md:38-42/:282-287、cordis-plugin-hosting.md:64/:458/:468-474 | HEAD 现读抽验全部在位 |

## 2. CI 验证证据与验收证据交叉核对

| 证据 | 内容 | 本轮核验 |
| --- | --- | --- |
| **CI run `35534499992`**（权威） | conclusion `success`；headSha = `5b3ff26…` = 当前 HEAD = PR #413 `headRefOid`；16 job 全绿：`typecheck`、`contract-gates`、`codegen-freshness`、`packaging`、`test (20,1..6)`、`test (24,1..6)` | `gh run view` / `gh pr view 413` 独立拉取一致；PR `state: OPEN`、`mergeable: MERGEABLE` |
| `iter2-generate-check.log` | `pnpm generate --check`（CI codegen-freshness job 唯一步骤原文）**EXIT=0** | 与 CI `codegen-freshness` ✓ 13s 互洽 |
| `iter2-shard4-node24.log` | CI test 分片 4 步骤原文复跑：**65 files / 767 tests 全绿，EXIT=0**（含修复前红的 `generate-union-member-docs.test.ts` 与 `persistence-issue-412-drain-semantics.test.ts` 9 tests） | 与 CI `test (20,4)`/`test (24,4)` ✓（各 65 files）互洽 |
| `iter2-persistence-contract.log` | SA6 §12 runner 触发：**21 files / 221 tests 全绿，Type Errors: no errors，EXIT=0**——含 `drain-red.test.ts` 27、`drain-surface.test-d.ts` 5（TS）、`drain-semantics.test.ts` 9 | 逐行读：三契约/锚文件全部 ✓ 列出 |
| `iter2-shutdown-tests.log` | S-5a/S-5b/S-5c **3 tests 全绿，EXIT=0**（S-5b：预算内收口 + `persistence-drain-budget-exceeded` 先于 dispose + 有损事实诚实） | 与 app.ts :624/:625/:630 链互洽 |
| `iter2-root-typecheck.log` | root `pnpm typecheck` 15 段 **EXIT=0** | 与 CI typecheck ✓ 互洽 |
| SA6 契约两文件零触碰 | `git log -- <两文件>` 仅 `75bd0ab`（引入提交）；SA2/SA4/SA9 各轮均复核 | 本轮实证 |
| 既有冻结审计（persistence-contract.test.ts:32-37、两 TEST_SCHEDULE 字面量、ordered-shutdown-red 等） | 不在全 PR diff 名单内（零改动即绿——DD-2「键形状不变」路径的设计裁决兑现） | 名单核对实证 |

结论：验收证据（SA3 申报 + 本机日志）与 CI 权威结论**同源一致**，无「本机绿 CI 红」或反向裂口；iteration 1 SA10 §8-4 登记的「动态终判留 CI」**已关闭**（CI 实测 success）。

## 3. Owner 评论 5751613018 保持性（逐项在位 + 零交集证明）

| Owner 要求（gh 全文核对） | HEAD 锚点（本轮现读） | 判定 |
| --- | --- | --- |
| 硬契约：dispose 前必须 await drain（成文，非建议） | ADR 0006 :242 修订节头（owner 三要求成文）+ **:270 第 3 条无条件条款**（含适用面申明「不以 adapter 类型特判——契约边界 = 配置的 store 面」与 :34 不冲突申明）；条款头明文引用 comment 5751613018 | **保持** |
| 同上（自家实现结构性强制） | app.ts 停机链：plugin 句柄两 kind 统一保留（:302-311）；:618 取 adapter → :624 `await this.awaitDrainWithBudget(adapter.drain(), budgetMs)` → :625 预算尽诚实事件 → :630 全仓**唯一** `persistenceFiber.dispose()`；`kind === 'file'` 仅用于预算推导（schedule 查找），**不守卫是否 drain**（SA2-7 统一）；`awaitDrainWithBudget`（:559-568）= tagged-outcome race + timer 早清（镜像 rest-hosting 先例） | **保持** |
| ADR-0006 :86 对齐（同步修订 dispose 定义） | **:276 第 4 条「本节修订并扩展 :86 的 dispose 定义边界」**——dispose 语义不变且保持 abortive/有损（§228-5 重申）、从来不是持久性屏障、持久性唯一经分层公开 drain 表达、「dispose 内部先 drain」否决论证在文 | **保持** |
| 分层公开 drain + dispose 保持 abortive | contract.ts:176 `readonly drain?:` optional 分层成员（三成员字面量绿守卫不破）；dispose 路径不在全 PR diff 内（`git diff c3f7bd9..HEAD -- packages/persistence/src/lifecycle.ts` 不含 dispose 段语义改动——仅 `releaseSettleWaiters` 抽取，SA4 核验逐字节等价）；S-1/0a/0b 保持性锚绿 | **保持** |
| 第三击穿窗口（degraded retry 回退窗） | drain 对 `retryTimer` 武装仅注册 waiter 被动等待（lifecycle.ts:866-869，零热循环，1f attempts 恒 1 锚定）；宿主预算覆盖回退窗（S-5b：520ms 预算内收口 + 事件可见） | **保持** |
| 问题 2 解耦（缺省保持现行为） | `PersistenceSchedule.retryDelayMs?`（contract.ts:523）+ 条件展开（:551，缺省不物化键——冻结审计零迁移）+ `retryBaseMs` 单源（lifecycle.ts:1078）改引两落点（:1094/:1152）；2b 缺省基准锚绿 | **保持** |

**零交集证明（iteration 2 增量）**：`git show --stat 9094760` = `domains/vfs3-assets/generated.ts` + 两哨兵 + 3 wiki；`git show --stat 5b3ff26` = 2 wiki（SA9/SA10 评审记录）。两提交对 `packages/persistence/**`、`apps/yjs-server/**`、`docs/adr/**`、`CONTEXT.md`、`docs/integration/**`、`packages/dsh-persistence/**` 的触碰**为零**。工作区未提交改动 = SA3 报告 + 5 证据日志，同为零产品代码。⟹ 硬契约与 ADR 对齐在本轮（及全部后续轮）物理上不可能被削弱。

## 4. 范围与规范符合性

- **设计 §11 ALLOW**：15 行全部兑现（contract/lifecycle/memory/file/index、probe、app/config/main、ADR 0006、CONTEXT、hub-peer、cordis-hosting、两新增测试文件 + SA6 两契约文件随集提交）。
- **设计 §11 DENY 逐项零触碰（本轮实证）**：`git diff c3f7bd9..HEAD --name-only -- packages/namespace-registry docs/protocols packages/ws-replication packages/persistence/src/service.ts packages/persistence/src/testing.ts packages/dsh-persistence/src/{record,events,profile,cli}.ts .github` → **空**；persistence 既有测试与冻结审计、apps 既有测试（ordered-shutdown-red / app-config-red / lifecycle-watchdog-red / issue270-*）、上游 wiki 产物均不在 diff 名单。
- **规范文档同步（DD-8 四面）**：ADR 0006 修订节 7 条（:242-282）；CONTEXT.md:139 词条（含 `_Avoid_`：flush-all / force-sync / 定时排空窗 / 把 drain 并进 dispose）；hub-peer-deployment.md 词表 :38-42（`persistence-drain-budget-exceeded` 带条件性注记，SA2-8）+ 停机序段 :282-287（file/memory 统一有界排空句）；cordis-plugin-hosting.md :64 停机句 + :458 第 5 步硬契约指引 + :468-474 示例代码块 bounded drain 步（SA2-9）——规范条款、对外指引、自家实现、验收证据四方对「memory 路径同样 drain-before-dispose」给同一答案（SA2-7 MAJOR 闭合）。
- **SA8 冲突门**：设计后复查 clear（requiresConflictRecheck true → 实现后复审承担）；实现后复审 **clear / requiresConflictRecheck false**（13 项 = 12 no-conflict + 1 implements-existing-decision）；SA2 iteration 1 **approve**；SA4 双 Part **approve**；SA9 **approve**。全门禁链无悬而未决项。
- **流程产物**：10 份 wiki/raw 文件随集入库属 MABF 证据链惯例（SA10 iteration 1 §9 同款认定）。

## 5. Findings（非阻断观察）

| # | 严重度 | 观察 | 处置 |
| --- | --- | --- | --- |
| N-1 | 观察（流程） | 工作区未提交：SA3 报告原位更新（`M`）+ 5 份 iteration 2 证据日志（`??`）——零产品代码，属过程产物留档，待 Controller 随集提交 | 不阻断；随 PR 入库即闭合 |
| N-2 | 观察 | 承接 SA4 N-1：`apps/yjs-server/AGENTS.md` 单一拆卸链摘要行未逐字列新增排空等待步（陈述仍真；文档债） | 后续文档变更集顺带补一行（SA3 已记录） |
| N-3 | 观察 | 承接 SA4 N-2/N-3：`awaitDrainWithBudget` 败者 timer 在 drain-reject（结构性不可达）路径残留至自然到点；S-5a `elapsedMs < 450` 墙钟断言在极慢 CI 的理论余量 | CI 16 job 实测全绿，未观察到击穿；保持观察 |
| N-4 | 观察（流程建议，承接 SA9 N-1 / SA10 iter1 O4） | 后续凡 bump `@nomicore/vfsl-codegen` 版本的发布变更集应同集执行 `pnpm generate`（避免重造本类 `--check` 恒红态） | 发布流程建议，非本变更集内容 |

无 BLOCKER / MAJOR。本轮独立复核未发现上游 SA 记录之外的新缺口。

## 6. PR 必须披露项（终审清单）

1. **范围扩权事实**（承接 iteration 1 §8-1，仍有效）：`domains/vfs3-assets/generated.ts` 与两哨兵测试不在 #412 设计 §11 两表内；权属 = iteration 1 修复 dispatch 明示指令 + `domains/AGENTS.md` §Workflow 规定动作（SA8 R12：范围认定交 Controller；SA3/SA4/SA9/SA10 各轮已透明申报）。
2. **跨任务测试重钉**（承接 §8-2，仍有效）：issue #314/#315 字节哨兵 `GENERATED_SHA256` 由 `342d8c1f…e6707` 重钉为 `a934f62d…d65b`（重生成唯一差异 = 生成器身份横幅 0.1.3→0.2.0；语义指纹与全部断言零改动，哨兵对后续改写继续 fail-loud）。
3. **根因归属**（承接 §8-3）：三 CI 检查失败的唯一根因 = 发布提交 `abbb89a` 版本 bump 未伴随重生成（仓库级历史遗留，非 #412 引入）；修复走规定动作通道。
4. **库级 drain 无时间预算**（设计非目标，承接未变）：持续失败 store 下库级 drain 不 resolve 是完成式语义的诚实代价（ADR 0006 修订节第 2/3 条成文）；宿主侧总界 = yjs-server 预算 race + 诚实事件 + 有损继续；仓库外宿主经 cordis-plugin-hosting.md 指引。
5. **仓库外消费方采纳**：nomic-server 替换 `FILE_PERSISTENCE_DRAIN_MS` 固定睡眠属其自有变更集（issue「消费方配合」节；硬契约指引已经 cordis-plugin-hosting.md :458/:468-474 传达）。
6. **Follow-up（设计 §13，未变）**：DSH 记录头携带 `retryDelayMs` 的 golden 立法（DD-6 有意冻结）；yjs-server 配置面暴露 `retryDelayMs`；archive×delete 既有理论挂起的专项系统性测试（DD-5b 已修实现面）。
7. ~~动态终判留 CI~~（iteration 1 §8-4）：**已关闭**——CI run `35534499992`（head `5b3ff26`）conclusion `success`、16 job 全绿，本轮 `gh` 独立证实。

## 7. 结论

最终交付 diff（PR #413，`c3f7bd9..5b3ff26`）忠实达成其 spec：issue #412 全部请求面（公开完成式 drain、retryDelayMs 解耦缺省兼容、宿主固定睡眠替换为有界完成式排空）逐项落地；**Owner 评论 5751613018（2026-09-20T18:03:36Z，MEMBER，gh 全文核对）要求的 drain-before-dispose 硬契约与 ADR-0006 对齐保持完好**——成文载体（ADR 0006 :242-282，含 :270 无条件条款与 :276「修订并扩展 :86」）、实现载体（app.ts :618-630 file/memory 统一有界排空先于唯一 dispose）、对外指引（cordis-plugin-hosting.md）、验收锚（S-5a/S-5b/S-5c）四方同答案，且后续两提交对其零触碰；CI 验证证据权威闭合（run `35534499992` success，16 job 全绿，head = 当前 HEAD）；SA6 契约 C1–C14 与全部补充锚绿、契约文件零触碰、DENY 面零触碰、无 scope creep 新增。iteration 0/1 的 approve 结论经本轮复核保持。**approve**。

---

## 附：历史轮次结论存档

### iteration 1（dispatch `sa-75015d57-e8fe-40dc-a29b-b05d24a47b2e`，审查对象 HEAD `9094760`「fix(codegen): refresh generated vfs3 assets」）

**approve**（0 BLOCKER / 0 MAJOR；4 × 非阻断观察）。核心判定：`pnpm generate --check` 由 exit 1 恢复为 exit 0（SA10 亲自复跑实证）；修复 = 生成物横幅恰 1 行 + 两哨兵各 1 行重钉 + 注释，字节谱系三重独立复算闭合；根因归属 `abbb89a` 成立；Owner 硬契约与 ADR 对齐零改动（修复提交对全部 #412 契约面 diff 为空）。本轮复核：该对象（`9094760` 提交态）经 `5b3ff26`（纯 wiki 提交）逐字节保持，结论无需修订。

### iteration 0（dispatch `sa-2cf05a4a-8931-4f38-a72e-35048838f4b6`，审查对象 `c3f7bd9..1fef434`，后由 Controller 提交为 `75bd0ab`）

**approve**（0 BLOCKER / 0 MAJOR；5 × MINOR 非阻断）。核心判定：issue 正文全部请求面、Owner 评论全部要求、SA6 验收契约 C1–C14 与补充锚 S-1~S-4/S-5a/S-5b/S-5c 逐项忠实落地；ADR-0006 对齐与停机硬契约四方同答案；文件范围贴合设计 ALLOW、DENY 零触碰。本轮复核：该对象（`75bd0ab` 提交态）经两轮后续提交逐字节保持（`git log` 实证 #412 契约面零后续触碰），结论无需修订。
