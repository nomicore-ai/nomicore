# SA10 Spec Review — issue #412（iteration 3：最终提交 `bdb91cb`「CI 验证证据留档」终审）

- 任务：issue #412（persistence 公开完成式排空 `drain()` + `retryDelayMs` 解耦 + 停机硬契约）
- 本轮 dispatch：`sa-e873710b-03de-4c0b-a485-d22612d7a8de`（phase **spec-review**，**iteration 3**）——「Review the current final commit, which records CI-verification logs and final review evidence, against issue #412 and acceptance specifications. Confirm no semantic delivery change and that owner comment 5751613018 (updated 2026-09-20T18:03:36Z; MEMBER) hard drain-before-dispose contract and ADR alignment remain intact.」
- **审查对象：当前最终提交 `bdb91cb chore(ci): record issue 412 verification evidence`（HEAD，工作树干净）**。提交内容 = 8 文件：5 份 CI 验证日志（`artifacts/sa3-issue412-iter2-{generate-check,persistence-contract,root-typecheck,shard4-node24,shutdown-tests}.log`，即 iteration 2 SA10 §5 N-1 登记的未提交过程产物，本轮已随集入库）+ 3 份 wiki 评审记录原位更新（SA10 iteration 2 报告、SA3 iteration 2 报告、SA9 iteration 2 报告）。**零产品代码、零规范文本**
- 适用 Owner 要求：Issue comment ID `5751613018`——本轮再次经 `gh api repos/nomicore-ai/nomicore/issues/comments/5751613018` **独立拉取全文核对**：`id=5751613018`、`updated_at=2026-09-20T18:03:36Z`、`author_association=MEMBER`，与 dispatch 逐项一致，**无更新版本覆盖**。要求面 = ①「宿主优雅停机必须先 `await drain()` 再 dispose」写为**硬性契约**（分层方案可接受：公开 `drain()`、dispose 保持 abort 式）；②**同步修订 ADR-0006 :86** dispose 定义（否则契约与实现继续脱节）；③第三击穿窗口（degraded retry 回退窗）确认；④问题 2 解耦确认（缺省保持现行为）
- 审查纪律：spec 审查。未修改任何代码/设计/测试、未运行测试套件、未启动服务、未调度其他 SA。本轮证据 = 只读核验：git 考古/diff/grep 锚点、`gh run list`/`gh pr view`/`gh api` 只读拉取、上游 SA 产物交叉核对
- 历史轮次：iteration 0（主体实现 `75bd0ab`，**approve**）、iteration 1（CI-repair `9094760`，**approve**）、iteration 2（最终交付 diff + CI 证据，`5b3ff26` 时点，**approve**）结论经本轮复核**全部保持**；存档见文末附录

## Verdict

**approve**（0 × BLOCKER / 0 × MAJOR / 0 × 新增 MINOR；承接披露项见 §6，非阻断观察见 §5）。

核心判定：

1. **无语义交付变化（本轮核心问题一，零交集证明）**：`git diff 5b3ff26..bdb91cb --name-only` = 恰 8 文件（5 日志 + 3 wiki）；对 `packages/`、`apps/`、`docs/`、`CONTEXT.md` 及全部仓库根的触碰**为零**（实证见 §3）。⟹ HEAD 的语义交付与 iteration 2 终审对象、CI 权威验证对象（PR head `5b3ff26`，run `35534499992` success）**逐字节同一**——本提交是证据留档，不是交付变更。
2. **Owner 评论 5751613018 硬契约与 ADR 对齐保持完好（本轮核心问题二，HEAD 现读逐项在位）**：ADR 0006 修订节（:242-282）七条款完整——修订节头明文引用 comment 5751613018 三要求；**第 3 条无条件停机硬契约**（「宿主优雅停机在调用 `dispose()` 之前必须先 await `drain()`」；预算尽 = 显式可观察退出非违约；未经 drain 直接 dispose = 接受静默丢失；适用面不以 adapter 类型特判、与 :34 不冲突申明、yjs-server 实施注记）；**第 4 条「本节修订并扩展 :86 的 dispose 定义边界」**（dispose 不变且保持 abortive/有损、从来不是持久性屏障、持久性唯一经分层公开 drain 表达、「dispose 内部先 drain」否决论证在文）。自家实现结构性强制：app.ts 停机链 :624 `await this.awaitDrainWithBudget(adapter.drain(), budgetMs)`（file/memory 统一，`kind` 仅用于预算推导）→ :625 预算尽 `persistence-drain-budget-exceeded` 诚实事件 → :630 全仓**唯一** `persistenceFiber.dispose()`。对外指引 cordis-plugin-hosting.md :64 停机句硬契约 + :458 第 5 步指引 + :468-474 示例代码块含 bounded drain 步。CONTEXT.md:139 词条在位。
3. **Issue #412 验收规格在 HEAD 保持全绿且证据随集入库**：`bdb91cb` 收录的 5 份日志均为 **EXIT=0**——`generate --check`（CI codegen-freshness 唯一步骤原文）；persistence 包 21 files / **221 tests** 全绿 + Type Errors: no errors（含 SA6 契约 drain-red 27 + drain-surface 5 + 补充锚 drain-semantics 9）；停机链 S-5a/S-5b/S-5c **3 tests** 全绿；root typecheck 15 段；CI 分片 4 原文复跑 65 files / **767 tests** 全绿。与 CI run `35534499992`（16 job 全 SUCCESS，本轮 `gh run list`/`gh pr view 413` 再证实）同源一致。
4. **无 scope creep 新增**：全 PR diff（`c3f7bd9..bdb91cb`，35 文件）= 设计 §11 ALLOW 12 产品文件 + SA6 两契约文件（零触碰提交，`git log` 实证仅 `75bd0ab`）+ 2 个 #412 新增测试文件 + 3 个 dispatch 明示授权的 codegen 修复文件（iteration 1 已披露）+ 5 份证据日志 + 13 份 wiki 过程产物；DENY 面逐项零触碰（§4）。

## 1. Reviewed inputs

| 输入 | 状态 |
| --- | --- |
| Issue #412 正文快照（`wiki/raw/task_issue-412.md`） | 已读 |
| Owner comment 5751613018 全文（`gh api` 本轮独立拉取，含「至少需要…硬性契约…同步修订 ADR-0006 :86…否则契约与实现继续脱节」原文段） | 已读核对（id/updated_at/association 逐项一致） |
| 审查对象：`git show --stat bdb91cb`（8 文件）+ `git log --oneline -6` + `git status`（干净） | 已读 |
| 零交集 diff：`git diff 5b3ff26..bdb91cb -- packages apps docs CONTEXT.md`（**空**） | 已实证 |
| 全 PR diff：`git diff c3f7bd9..HEAD --name-only`（35 文件全量名单） | 已读核对 |
| CI 证据：`gh run list --branch mabf/issue-412`（run `35534499992` success）+ `gh pr view 413`（OPEN / MERGEABLE / headRefOid `5b3ff26` / 16 checks 全 SUCCESS） | 已独立证实 |
| `bdb91cb` 收录的 5 份验证日志 | 已读（全 EXIT=0，见 §2） |
| HEAD 锚点现读：ADR 0006 :240-282 修订节全文、app.ts :554-640 停机链、lifecycle.ts :855-879 drain 实现、contract.ts :176/:523/:545-551、memory.ts :189-193、file.ts :149-158（含 targets validateIdentity）、index.ts :37、probe.ts :446、CONTEXT.md :139、hub-peer-deployment.md :39/:42/:285、cordis-plugin-hosting.md :64/:458/:468-474 | 全部在位 |
| 设计 iteration 2（§11 ALLOW/DENY、§12 验收映射）、SA3 iteration 2 报告、SA4（Part A+B approve）、SA9（approve）、SA8 实现后复审（clear / requiresConflictRecheck false） | 已读并交叉核对 |

## 2. `bdb91cb` 收录证据与验收规格交叉核对

| 日志（本提交新增） | 内容 | 对应验收面 | 判定 |
| --- | --- | --- | --- |
| `iter2-generate-check.log` | `pnpm generate --check` **EXIT=0** | CI `codegen-freshness` job 唯一步骤原文复跑 | 与 CI ✓ 互洽 |
| `iter2-persistence-contract.log` | **21 files / 221 tests 全绿，Type Errors: no errors，EXIT=0** | SA6 契约 C1–C14（drain-red 27 运行期 + drain-surface 5 类型）+ 补充锚 S-1~S-4（drain-semantics 9）+ 既有 180 基线 | 闭合 |
| `iter2-shutdown-tests.log` | **3 tests 全绿，EXIT=0** | S-5a（健康 file：完成式停机、固定睡眠已消失、内容耐久、四事件序保持）、S-5b（degraded file：预算内收口 + `persistence-drain-budget-exceeded` 先于 dispose + 有损事实诚实）、S-5c（memory 统一路径：`MemoryPersistence.prototype.drain` 恰 1 次且严格先于 `persistence-disposed`、无预算事件） | 闭合（硬契约时序锚） |
| `iter2-root-typecheck.log` | root `pnpm typecheck` 15 段 **EXIT=0** | 全仓类型面（含 app 消费方） | 闭合 |
| `iter2-shard4-node24.log` | CI test 分片 4 步骤原文复跑：**65 files / 767 tests 全绿，EXIT=0** | CI `test (20,4)`/`test (24,4)` 曾红分片的本机复跑 | 与 CI ✓ 互洽 |

结论：`bdb91cb` 收录的验证证据与 iteration 2 SA10 §2 的申报**逐项一致**，CI 权威结论（run `35534499992` success、16 job 全绿、headSha = PR head `5b3ff26`）本轮经 `gh` 再次独立证实，无裂口。

## 3. 无语义交付变化（零交集证明）与 Owner 要求保持性

**零交集证明**：`git diff 5b3ff26..bdb91cb --name-only` = 恰 `artifacts/sa3-issue412-iter2-*.log` ×5 + `wiki/raw/task_issue-412_sa{10_spec,3_impl,9_standards}.md` ×3；对 `packages/`、`apps/`、`docs/`、`CONTEXT.md`、`.github/`、`domains/`、全部既有测试与冻结审计的触碰**为零**（`git diff 5b3ff26..bdb91cb -- packages apps docs CONTEXT.md` 输出为空，实证）。3 份 wiki 改动为评审记录原位更新（SA3 iteration 2「无需新增产品代码改动，三 CI 检查在当前 HEAD 全部转绿」、SA9 iteration 2 approve、SA10 iteration 2 approve），不引入新承诺、不改验收契约文本。⟹ HEAD 语义交付 ≡ `5b3ff26`（CI 验证对象）语义交付。

**Owner 评论 5751613018 逐项保持（HEAD 现读）**：

| Owner 要求（gh 全文核对） | HEAD 锚点 | 判定 |
| --- | --- | --- |
| 硬契约：dispose 前必须 await drain（成文，非建议） | ADR 0006 :242 修订节头（owner 三要求成文）+ :270 区**第 3 条无条件条款**（含适用面申明「不以 adapter 类型特判——契约边界 = 配置的 store 面」、预算尽 = 显式可观察退出、与 :34 不冲突申明）；条款头明文引用 comment 5751613018 | **保持** |
| 同上（自家实现结构性强制） | app.ts：:618 取 adapter（`persistencePlugin` 句柄两 kind 统一保留）→ :624 `awaitDrainWithBudget(adapter.drain(), budgetMs)` → :625 预算尽诚实事件 → :630 全仓唯一 `persistenceFiber.dispose()`；`kind==='file'` 仅用于预算推导，不守卫是否 drain（SA2-7 路径 (b) 统一） | **保持** |
| ADR-0006 :86 对齐（同步修订 dispose 定义） | **第 4 条「本节修订并扩展 :86 的 dispose 定义边界」**——dispose 语义不变且保持 abortive/有损（§228-5 重申）、从来不是持久性屏障、持久性唯一经分层公开 drain 表达、「dispose 内部先 drain」否决论证在文 | **保持** |
| 分层公开 drain + dispose 保持 abortive | contract.ts:176 `readonly drain?:` optional 分层成员 + memory.ts:192/file.ts:153 具体类方法委派；dispose 段不在全 PR diff 语义改动面（仅 `releaseSettleWaiters` 抽取，SA4 核验逐字节等价）；S-1/0a/0b 保持性锚绿 | **保持** |
| 第三击穿窗口（degraded retry 回退窗） | lifecycle.ts :866-869 drain 对 `retryTimer` 武装仅注册 waiter 被动等待（零热循环，1f attempts 恒 1）；宿主预算覆盖回退窗（S-5b 预算内收口 + 事件可见） | **保持** |
| 问题 2 解耦（缺省保持现行为） | `retryDelayMs?`（contract.ts:523）+ 条件展开（:551，缺省不物化键）+ `retryBaseMs` 单源（lifecycle.ts:1079）两落点 + DSH 探针镜像锁步（probe.ts:446）；2b 缺省基准锚绿 | **保持** |

## 4. 范围与规范符合性（全 PR 维度复核）

- **设计 §11 ALLOW**：15 行全部兑现且 HEAD 逐字节保持（contract/lifecycle/memory/file/index、probe、app/config/main、ADR 0006、CONTEXT、hub-peer、cordis-hosting、两新增测试文件 + SA6 两契约文件随集提交）。
- **设计 §11 DENY 逐项零触碰（本轮对全 PR diff 名单复核）**：namespace-registry、docs/protocols、ws-replication、persistence service.ts/testing.ts、dsh record/events/profile/cli、.github、persistence 与 apps 既有测试与冻结审计、上游 wiki 产物均不在 `c3f7bd9..HEAD` 名单内。
- **规范文档同步四面**：ADR 0006 修订节 7 条；CONTEXT.md:139 词条（含 `_Avoid_`）；hub-peer-deployment.md :39 词表（:42 条件性注记——SA2-8）+ :285 停机序段（file/memory 统一有界排空句）；cordis-plugin-hosting.md :64/:458/:468-474——规范条款、对外指引、自家实现、验收证据四方对「memory 路径同样 drain-before-dispose」给同一答案（SA2-7 MAJOR 闭合保持）。
- **SA6 契约两文件零触碰**：`git log -- <两文件>` 仅 `75bd0ab`（引入提交），本轮实证。
- **门禁链**：SA2 iteration 1 approve、SA4 双 Part approve、SA8 设计后复查 clear → 实现后复审 clear（requiresConflictRecheck false）、SA9 iteration 0/1/2 均 approve、SA10 iteration 0/1/2 均 approve。无悬而未决项。

## 5. Findings（非阻断观察）

| # | 严重度 | 观察 | 处置 |
| --- | --- | --- | --- |
| N-1 | 观察（流程） | `bdb91cb` 为本地提交：PR #413 `headRefOid` 仍为 `5b3ff26`（本轮 `gh pr view` 实证）。推送属 Controller 动作；推送后 CI 将重跑，但本提交 diff 为日志/wiki 纯过程产物，语义覆盖面不受影响 | 不阻断；推送后 CI 重跑即闭合 |
| N-2 | 观察（流程，已闭合项登记） | iteration 2 SA10 §5 N-1（5 份证据日志 + SA3 报告未提交）**已由 `bdb91cb` 闭合**——过程产物全部随集入库，工作树干净 | 已闭合 |
| N-3 | 观察 | 承接 SA4 N-1：`apps/yjs-server/AGENTS.md` 单一拆卸链摘要行未逐字列新增排空等待步（陈述仍真；文档债） | 后续文档变更集顺带补一行 |
| N-4 | 观察（流程建议） | 承接 SA9 N-1 / SA10 iter1 O4：后续凡 bump `@nomicore/vfsl-codegen` 版本的发布变更集应同集执行 `pnpm generate` | 发布流程建议，非本变更集内容 |

无 BLOCKER / MAJOR。本轮独立复核未发现上游 SA 记录之外的新缺口。

## 6. PR 必须披露项（终审清单，承接 iteration 2 §6 并更新）

1. **范围扩权事实**（承接，仍有效）：`domains/vfs3-assets/generated.ts` 与两哨兵测试不在 #412 设计 §11 两表内；权属 = iteration 1 修复 dispatch 明示指令 + `domains/AGENTS.md` §Workflow 规定动作（SA8 R12：范围认定交 Controller；各轮 SA 已透明申报）。
2. **跨任务测试重钉**（承接，仍有效）：issue #314/#315 字节哨兵 `GENERATED_SHA256` 重钉（重生成唯一差异 = 生成器身份横幅 0.1.3→0.2.0；语义指纹与全部断言零改动，哨兵对后续改写继续 fail-loud）。
3. **根因归属**（承接）：三 CI 检查失败的唯一根因 = 发布提交 `abbb89a` 版本 bump 未伴随重生成（仓库级历史遗留，非 #412 引入）；修复走规定动作通道。
4. **库级 drain 无时间预算**（设计非目标，承接未变）：持续失败 store 下库级 drain 不 resolve 是完成式语义的诚实代价（ADR 0006 修订节第 2/3 条成文）；宿主侧总界 = yjs-server 预算 race + 诚实事件 + 有损继续；仓库外宿主经 cordis-plugin-hosting.md 指引。
5. **仓库外消费方采纳**：nomic-server 替换 `FILE_PERSISTENCE_DRAIN_MS` 固定睡眠属其自有变更集（issue「消费方配合」节；硬契约指引已经 cordis-plugin-hosting.md :458/:468-474 传达）。
6. **Follow-up（设计 §13，未变）**：DSH 记录头携带 `retryDelayMs` 的 golden 立法（DD-6 有意冻结）；yjs-server 配置面暴露 `retryDelayMs`；archive×delete 既有理论挂起的专项系统性测试（DD-5b 已修实现面）。
7. **本地提交待推送**（本轮新增登记）：`bdb91cb`（CI 验证证据留档）尚未推入 PR #413（remote head = `5b3ff26`）；推送为 Controller 动作，推送前后语义交付同一（§3 零交集证明）。

## 7. 结论

当前最终提交 `bdb91cb` 是**纯证据留档提交**（5 份 CI 验证日志 + 3 份评审记录），对全部产品与规范面零触碰——**无语义交付变化**，HEAD 语义交付与 CI 权威验证对象 `5b3ff26`（run `35534499992` success，16 job 全绿）逐字节同一。Issue #412 全部请求面（公开完成式 `drain()`、`retryDelayMs` 独立配置缺省兼容、宿主固定睡眠替换为有界完成式排空 file/memory 统一）保持逐项落地；**Owner 评论 5751613018（2026-09-20T18:03:36Z，MEMBER，本轮 gh 独立全文核对）的 drain-before-dispose 硬契约与 ADR-0006 对齐保持完好**——成文载体（ADR 0006 :242-282，含第 3 条无条件条款与第 4 条「修订并扩展 :86」）、实现载体（app.ts :618-630 统一有界排空先于唯一 dispose）、对外指引（cordis-plugin-hosting.md :64/:458/:468-474）、验收锚（S-5a/S-5b/S-5c）四方同答案。SA6 契约 C1–C14 与全部补充锚绿、契约文件零触碰、DENY 面零触碰、无 scope creep 新增；iteration 0/1/2 的 approve 结论经本轮复核保持。**approve**。

---

## 附：历史轮次结论存档

### iteration 2（dispatch `sa-8c3fcd5b-83f2-492f-a65b-19b134667e9a`，审查对象 = PR #413 全量 diff `c3f7bd9..5b3ff26` + CI 证据）

**approve**（0 BLOCKER / 0 MAJOR / 0 新增 MINOR；4 × 非阻断观察）。核心判定：issue #412 全部请求面落地且保持；Owner 硬契约与 ADR 对齐逐项在位（ADR :270 无条件条款 / :276「修订并扩展 :86」/ app.ts :624→:630 / cordis-hosting / CONTEXT.md）；CI run `35534499992`（headSha = `5b3ff26` = PR head）success、16 job 全绿经 `gh` 独立证实；SA6 契约 C1–C14 + S-1~S-4 + S-5a/b/c 全绿；修复轮两提交对全部 #412 契约面 diff 为空（零交集证明）。本轮复核：`bdb91cb` 对该对象零语义触碰（§3），结论无需修订；其 §5 N-1（未提交过程产物）已由 `bdb91cb` 闭合。

### iteration 1（dispatch `sa-75015d57-e8fe-40dc-a29b-b05d24a47b2e`，审查对象 HEAD `9094760`「fix(codegen): refresh generated vfs3 assets」）

**approve**（0 BLOCKER / 0 MAJOR；4 × 非阻断观察）。核心判定：`pnpm generate --check` 由 exit 1 恢复为 exit 0（亲自复跑实证）；修复 = 生成物横幅恰 1 行 + 两哨兵各 1 行重钉 + 注释，字节谱系三重独立复算闭合；根因归属 `abbb89a` 成立；Owner 硬契约与 ADR 对齐零改动。本轮复核：该对象（`9094760` 提交态）经两轮后续提交（`5b3ff26` 纯 wiki、`bdb91cb` 日志/wiki）逐字节保持，结论无需修订。

### iteration 0（dispatch `sa-2cf05a4a-8931-4f38-a72e-35048838f4b6`，审查对象 `c3f7bd9..1fef434`，后由 Controller 提交为 `75bd0ab`）

**approve**（0 BLOCKER / 0 MAJOR；5 × MINOR 非阻断）。核心判定：issue 正文全部请求面、Owner 评论全部要求、SA6 验收契约 C1–C14 与补充锚 S-1~S-4/S-5a/S-5b/S-5c 逐项忠实落地；ADR-0006 对齐与停机硬契约四方同答案；文件范围贴合设计 ALLOW、DENY 零触碰。本轮复核：该对象（`75bd0ab` 提交态）经三轮后续提交逐字节保持（`git log` 实证 #412 契约面零后续触碰），结论无需修订。
