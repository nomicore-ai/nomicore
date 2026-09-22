# 冲突门禁报告（设计后复审）— issue #448

**被审对象**：SA1 设计 `wiki/raw/task_issue-448_design.md`（318 行：γ-T2 live update 数据面的 **verification-only 裁定与验收契约落地**——零生产实现面，交付物 = SA6 绿色验收/回归契约工件的落盘与守门）
**门禁类型**：设计后复审（design 复查；SA2 全维度攻击评审不在 SA8 职责内）
**门禁轮次**：iteration 0（dispatch `sa-d74f2e8a-072c-4dca-952d-f338862b17cc`；`task_issue-448_design_conflict_report.md` 此前不存在，本次新建）
**基线**：worktree `/home/wangjian/nomicore-fix-issue-448`，branch `mabf/issue-448`，HEAD `321d951`（`Merge pull request #453 from nomicore-ai/mabf/issue-447`；T1 实现 commit `52e634b`）——git 实查与设计 §Baseline 声明一致；规范文本（ADR 0032 / 协议 §24 / CONTEXT.md / 模块与 docs AGENTS）零改动（`git status --porcelain` 证实改动面 = 1 个测试夹具 append-only（+10 行）+ 2 个新增测试文件 + 5 份 `artifacts/sa6-issue448-*.log` + 3 份 `wiki/raw/task_issue-448*` 文档，生产 `packages/ws-replication/src/**` 与一切包/域/应用源码零 diff）。

---

## 1. Reviewed subject

- subject = **design**（`wiki/raw/task_issue-448_design.md` 全文逐节审读）。核心裁定面 = §0/§7-D1「#448 = verification-only（零生产实现面）」；交付面 = §7-D2/D3/D4/D5（契约工件原样落盘、夹具 append-only +10 行、`sendQueueMs` 整键缺席守门、包级验证门）。
- 上游输入：Host 简报 `wiki/raw/task_issue-448.md`（Issue #448 正文 6 条 AC + `Blocked by #447` + Parent PR #446）；SA6 契约 `wiki/raw/task_issue-448_sa6_contract.md`（`verdict: approve`；反向诊断 + §15-1 移交 verification-only 裁定项）。
- 评审输入：`wiki/raw/task_issue-448_sa2_review.md` **不存在**（设计 §14 声明一致，实查证实）——本轮无 SA2 评审输入可并入。
- 前置门禁产物 `task_issue-448_relevant_decisions.md` / `task_issue-448_conflict_report.md` 不存在（实查；设计 §6 与 SA6 §15-6 同查）——本报告 §2 即本票决策集盘点，design 阶段无回溯生成 task 门的义务。
- **Issue 评论 REST 快照为空**（dispatch 明示「returned an empty array」；简报 `## Comments` 节空）⇒ **无 Owner override 权威可用**；Owner 要求 = 简报正文 6 条 AC。
- **SA8 独立复核义务**（SA6 §15-1/§15-6 移交）：verification-only 裁定所依赖的上游事实是否与源码/git 矛盾。本轮逐行读回设计 §2 锚点表的全部源码符号（见 §3 证据列与下述「事实复核记录」）。

**事实复核记录（SA8 实读，非转抄设计声明）**：

| 设计 §2 声明的锚点 | 实读结果 |
|---|---|
| `hub-session-async-host.ts:96`（tagCounter）、`:256-264`（emitSeam：`tag = ++tagCounter` → 未决集 → 同步调监听者；无监听者返回 0 不登记） | **命中**（`:95-97` 注释 + `:256-264` 逐行一致） |
| `:161-177`（handleReceipt：终态静默 → sequence 域校验 → 未决集命中 → fan-out；伪造序/未知/重复 tag ⇒ `CONNECTION_POLICY_VIOLATION`） | **命中**（`:161-177` 逐行一致，含 `:165`/`:170` 两处响亮收口） |
| `:128-131`（缝字节不可解码 ⇒ `MALFORMED_FRAME` 收口） | **命中** |
| `:152`（每条入站缝消息消费后 selfDrain）、`:176`（末 chunk 回执结算后 drain）、`:221-222`（onDataQueued/requestDataDrain → selfDrain）、`:271-277`（`while (pullAndSendOne())` 推完即停） | **命中**（`:150-152` 注释明示「保守超集、无工作即 no-op」；`:274-276` 循环终止性同构） |
| `:219`（`dataGateOpen: () => true`） | **命中** |
| `update-channel.ts:135-138`（`pendingSends: Map<tag,…>`）、`:169-173`（`effectiveInFlightCount = inFlight + activeTransfer + pendingSends`）、`:261`（deliver 直发判据）、`:513`（pullAndSendOne 窗口判据） | **命中**（四处逐行一致；`:167-168` 注释明示「pending 自推送时刻占窗、回执换键不换槽」） |
| `:198-209`（onReceipt rekey：`pendingSends.delete(tag)` → `inFlight.set(sequence, entry)`；被弃 tag 迟到回执 ⇒ zombie 序登记 + no-op） | **命中** |
| `:287-323`（onAck：inFlight 命中 ⇒ ok（`:295-296` 合并占用拆除判据）⇒ zombieSeqs ⇒ zombie ⇒ violation）、`:303-305`（`latencyMs = t1 − entry.sentAt`） | **命中** |
| `:450-461`（sendAndRegister γ async 分支：tag 入 pendingSends **不入 inFlight**，`sentAt` 推送同步段采样）、`:585-598`（末 chunk γ async 分支：`chunked: true` 入 pendingSends） | **命中** |
| `hub-namespace.ts:1162-1169`（onUpdateAck 漏斗；violation ⇒ `connectionFatal('ACK_STATE_VIOLATION', 1002)`）、`:1416-1429`（onUpdateAcked：session 结算点发射；chunked 在场 ⇒ 改道 chunked-update-acked 无 sequence 键） | **命中** |
| `hub-session.ts:309-315`（onReceipt 按通道 fan-out）、`hub-namespace.ts:738-746`（onSendReceipt：rekey + bootstrap 锚 + round 锚 + bulk 末 chunk 结算，返回是否结算末 chunk） | **命中** |
| `hub-edge.ts:852-868`（emitUpdateSentAtStamp：sequence = `[8..12]` 盖章返回值、`sendQueueMs` 仅 `accounting?.sendQueueMs` 在场时携带） | **命中**（`:850` 注释明示「缺面 = 整键缺席，非 0」） |

git 级事实复核：`git log` 证实 `c86ccbc`（Spec #445）→ `52e634b`（T1）→ `321d951`（Merge PR #453）序列与设计 §2/S1/S2 声明一致；`git diff packages/ws-replication/test/issue447-async-seam.ts` = **恰 +10 行纯新增**（`AsyncFacadeOptions.edgeObserver?` 可选成员 + doc-comment + `makeAsyncReplicationFacade` 内条件展开 `observer` 键；既有行零改写，缺省零传语义由条件展开结构保证）。运行时证据复核：`artifacts/sa6-issue448-contract-run.log` 尾部 = `Tests 13 passed (13)` + `Type Errors no errors`；`-repeat5.log` 尾部 = `run 5: exit 0`；`-package-suite.log` = `Test Files 101 passed (101)` / `Tests 897 passed (897)` / `Type Errors no errors`；`-package-tsc.log` = 0 字节（exit 0 无输出）。契约文件实查：恰 13 个 `it(`、零 `skip/only/todo`（仅头注提及）、LIVE-OBS-C1 含 `not.toHaveProperty('sendQueueMs')`（`:388-389`）、两条变异负控（NC-4 `:139-168`、NC-5 `:307-359`）均以 `finally` 恢复生产原型。**结论：未发现任何上游事实与源码/git 的矛盾——verification-only 裁定的事实基础成立。**

## 2. Inputs and decision set

决策集读取（全部现行为准，非转抄设计声明）：

| 决策源 | 状态 | 相关条款 |
|---|---|---|
| `docs/adr/0032-transport-decoupling-edge-session-split.md` | 已接受（含附录 A1–A4） | 决策 2（`:18` 零 worker_threads）、决策 5（`:30` 观测纪律 + 观测面落地注记 `:113`：`sendQueueMs` 经 append-only 记账投影携带；**无 session 记账 ⇒ 整键缺席（缺面 dormant）**）、A1（`:41` β 同步签名冻结）、A3（`:53` 缺面 dormant 公共登记）、A4.1（`:61-65` 载体/词汇）、A4.2（`:69-75` 保序契约 + 两相记账/三态锚）、A4.3（`:79` 流控单点/乐观发送）、A4.4（`:83` 推-FIFO pacing 三触发点/禁 busy loop）、A4.5（`:87` 生命周期）、A4.6（`:91` 回执≠接纳）、A4.7（`:95` 观测口径：`update-sent` 在 edge 盖章点、chunked 族在 session 结算点、t0 = 推送时刻、跨线程事件无全序）、A4.8（`:99` 验收纪律：成功路径与 β wire 逐字节等价；**验收测试用延迟可注入的显式异步内存管道**；既有矩阵全绿硬门）、后果（`:112` 公开面发布即冻结 append-only、`:113` peer 不拆分） |
| `docs/protocols/instance-replication-v1.md` §24（`:1091-1154`） | 规范文本（§24 头注 `:1093`：host-facing 契约，**非 wire 契约**；wire 零变化） | §24.1（`:1097`）、§24.2 义务 6 条（`:1101-1106`，`:1103` 回执盖章点同步投递）、§24.3 词汇闭集合（`:1108-1120`，**:1120** 无拒纳/闸门/信用词汇）、§24.4（`:1122-1128`：pending 自推送占窗、tag→seq 换键不换槽、三态锚、ackTimeout 锚定与单体同构）、§24.5（`:1130-1139`）、§24.6（`:1141-1143`：自驱 drain 三触发点、禁 busy loop、`sendQueueMs` 口径 = 仅 session 队内等待）、§24.7（`:1145-1147`）、§24.8（`:1149-1154`：发射点归属、t0 = 推送时刻、跨线程事件无全序） |
| 同上 §3/§17/§18/§21/§23.1 | 已接受 | 序号纪律（`[8..12]` mux 单点盖章）、账本/轮转、`closeTimeoutMs`、事件字段表（update-sent/update-acked/chunked 族在场纪律） |
| `CONTEXT.md` | 现行词表 | 「SessionHost（复制会话宿主）」`:229-231`（γ 段 + `_Avoid_`：不加拒纳/闸门/信用词汇）、「序回执（sequence receipt）」`:233-235`（`_Avoid_`：不伪造序号、不当接纳信号、不分道）——本轮重核原文，与设计的词汇用法逐字相容 |
| `packages/ws-replication/AGENTS.md` | 模块契约 | `:17` 缝纪律（含 **γ append-only 登记句已由 #447 D12 落地**：`frame{tag,bytes,lane}` + `receipt{tag,sequence}`、仍无拒纳/闸门/信用词汇、β 同步冻结逐字不动）、`:20` 工厂 append-only、`:22` 生产 API 经 `src/index.ts` / 测试控件留在 testing surface、`:24-26` Verification（changed state-machine path 聚焦测试；seam change 另跑 edge/session 契约；wire/lifecycle change 加跑根门禁） |
| `docs/AGENTS.md` | 文档纪律 | 「When code behavior changes, update every normative document whose stated contract changed」 |
| 其余 ADR 全集 | 无 superseded 影响本票 | 全仓 31 份 ADR 状态行扫描：仅 0027 正文提及 superseded 语义（namespace 读域，与本票无关）；ADR 0010/0012/0013/0022/0023 经模块 AGENTS 引入为背景权威，本票零触碰 |
| 前序票冻结面（#447） | SA8 双门禁已过 | `wiki/raw/task_issue-447_design_conflict_report.md`（iteration 1，verdict `clear`）+ `task_issue-447_implementation_conflict_report.md`（verdict `clear`，R1/R2/R3 实现期义务核验闭合）——设计 §15-3 的「约束继承自已过门禁的 #447 冻结面」主张经实查成立 |

## 3. Decision analysis

| # | Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | **ADR 0032 A4.8（验收纪律）+ 模块 AGENTS:24-26** | `:99`「验收测试用延迟可注入的显式异步内存管道，不引入 worker_threads；既有 listen 与 β 公共工厂测试矩阵全绿为硬门」 | 交付物本体 = 13 条可执行验收锚（延迟注入 `k`/`m` 虚拟毫秒 + 显式 `release()` 扣留/放行 + `makeManualClock`，零真实 timer/wall-clock/线程）；回归面 = T1 三套件 30/30 + 包全量 101 文件/897 用例 + 包 tsc exit 0（既有矩阵全绿硬门兑现）；夹具复用 #447 装配面零线程 | **implements-existing-decision**（兑现 A4.8 验收纪律中「AC 专属场景运行时锚」的剩余义务——本票 AC 的保序编排/k+m 时延/β parity/观测归属此前无锚，SA6 §8-S6） | 设计 §7-D2/§12；契约文件 `ws-replication-issue448-live-data-plane.test.ts`（13 `it(` 实数）+ `issue448-live-seam.ts`（`bootLiveRound` 手动时源/显式 release）；`artifacts/sa6-issue448-contract-run.log`/-`repeat5.log`/-`package-suite.log`（SA8 读回：13/13、run 5 exit 0、101/897） | — |
| 2 | 协议 §24.4 + ADR 0032 A4.2（两相记账） | `:1126-1128`/`:75`：pending 自推送占窗；回执 tag→seq 换键不换槽；三态锚；ackTimeout 锚定与单体同构 | 设计 §2 锚定既有行为（非变更）：LIVE-WINDOW-C1/C2 锚 rekey 中间态/恰 N 帧/无泄漏，C3 变异负控证判据对 pending 占窗敏感。源码锚点 `update-channel.ts:135-138/:169-173/:198-209/:261/:450-461/:513` + `:295-296`（合并占用拆除）经 SA8 实读全部命中、语义一致 | no-conflict（既有行为的验证锚定；该机械的**实现义务已由 #447 T1 变更集兑现并通过其 SA8 双门禁——#447 报告 #8/#9 裁 implements-existing-decision） | 设计 §2/§8 状态机图/§12；`update-channel.ts` 实读（§1 事实复核记录）；#447 设计 D4（`task_issue-447_design.md:152-158`）/D10（`:191-198`） | — |
| 3 | 协议 §24.2.3 + ADR 0032 A4.2（保序契约） | `:1103` 盖章点同步投回执、先于后续 socket 数据；`:1106` 违契响亮收口无静默降级 | LIVE-ORD-C1（消费序 strict 先行锚）/C2（`reorderNext` 乱序注入 ⇒ `ACK_STATE_VIOLATION` 响亮负控）；锚定的 `handleReceipt` 伪造序/未知 tag ⇒ `CONNECTION_POLICY_VIOLATION` 为 #447 已裁定之既有码新触发面（#447 报告 #7） | no-conflict | 设计 §2/§9；`hub-session-async-host.ts:161-177` 实读；契约 LIVE-ORD-C1/C2 用例名实查 | — |
| 4 | 协议 §24.5 + ADR 0032 A4.3（流控单点） | `:1132`/`:79`：流控只由 edge 单点负责；session 乐观发送（`dataGateOpen ≡ true`，A3 dormant 先例） | LIVE-WINDOW-C1/C2 锚「乐观发送不越 `maxInFlightUpdates` 上界」；锚点 `hub-session-async-host.ts:219` 实读命中 | no-conflict | 设计 §2/§7-D5；`hub-session-async-host.ts:216-219`（`:216` 注释「缝词汇无 accounting 字段」同款 dormant）；契约 C1/C2 | — |
| 5 | 协议 §24.6 + ADR 0032 A4.4（pacing） | `:1141-1143`/`:83`：自驱 drain 触发点 = 入队 / ACK 到达 / transfer 末 chunk 回执；推完即停、禁 busy loop | LIVE-DRAIN-C1/C2 锚 kind=0 数据面切片（逐 chunk 过缝占 1 槽、`advanceBy(100)` 零新帧、`scheduler.pending()` 不增、重复泵零越界）；锚点 `:152/:176/:221-222/:271-277` 实读命中。**AC4 措辞「两触发点（入队 / ACK）」vs 实现三触发点**：§24.6/A4.4 明文命令三触发点（第三点 = transfer 末 chunk 回执）；实现提供规范要求的超集，触发点②为「ACK 到达」保守超集（#447 报告 #11 已裁 implements-existing-decision，幂等 no-op 不引入 busy loop）；设计并把第三触发点的全回合编排显式划归 #449（LIVE-DRAIN-C1 收窄至 kind=0）——AC 满足方式为规范内的超集，非欠交付 | no-conflict（含 AC4 二触发点措辞与 §24.6 三触发点的调和：以规范文本为准，设计 §2/§1 非目标已显式登记边界） | 设计 §2/§7/§12；`hub-session-async-host.ts:150-176/:271-277` 实读；#447 设计 D6（`:170-172`）；#447 报告 #11 | — |
| 6 | 协议 §24.8 + ADR 0032 A4.7（观测口径） | `:1149-1154`/`:95`：`update-sent` 发射点 = edge 盖章点；`update-acked`/chunked 族在 session 回执/结算点；`ackLatencyMs` t0 = 推送时刻；跨线程事件无全序 | LIVE-ACK-C1（`k+m` 时延锚 + NC-5 t0 变异负控）、LIVE-OBS-C1（`update-sent` 在 edge：wire 序/载荷长/无 `sendQueueMs`；`update-acked` 在 session 同序；**零事件序断言**——设计 §6 明示单事件字段值断言）。锚点 `hub-namespace.ts:1416-1429`（session 结算点 + chunked 改道）、`update-channel.ts:303-305`（t1 − sentAt）、`hub-edge.ts:852-868`（edge 盖章点）实读全部命中 | no-conflict | 设计 §2/§6/§12；三处源码实读；契约 LIVE-ACK-C1/LIVE-OBS-C1 用例名实查 | — |
| 7 | **协议 §24.3 + ADR 0032 决策 5 注记/后果 `:113`（γ `sendQueueMs` 整键缺席）** | `:1108-1120` 词汇 append-only 闭集合**无 accounting 字段**；`:113`「工厂/宿主直驱 data 帧无 session 记账 ⇒ 该键整键缺席（缺面 dormant）」；§24.6 `:1143`「`sendQueueMs` 口径 = 仅 session 队内等待」为**字段在场时**的口径登记（γ 无载体 ⇒ dormant） | 设计 D4 把「整键缺席」固化为登记缺面 + 契约守门断言 `not.toHaveProperty('sendQueueMs')`（`:388-389` 实查在场）；明确**不主张实现**，任何增补诉求 = §24.3/A4 显式 amendment 另票（DENY）。与 #447 报告「另核」段的既有裁决（dormant 形态）同源同向 | no-conflict（守门断言锚定既有 dormant 登记；无 override 主张、无闭集合触碰） | 设计 §7-D4/§11 DENY/§13-R5；`hub-edge.ts:850/:867`（accounting 缺席 ⇒ 键缺席）；契约 `:388-395`；#447 设计 D9（`:184`）；#447 报告 §3 另核段 | — |
| 8 | 协议 §24 头注 `:1093` + ADR 0032 A1 `:41`/A4.1 `:61`（β 冻结与 wire 零变化） | host-facing 非 wire 契约；β 同步签名冻结逐字；wire 逐字节不变 | AC6 以 LIVE-PARITY-C1/NC1 锚「live 成功路径与 β wire 等价」为**验证对象**（对照基准非变更对象）：控制帧逐字节等 + 全轨迹骨架 `kind#sequence` 全等 + 数据帧文档语义等（#424 ORACLE-2：Yjs clientID/clock 随机 ⇒ 数据载荷跨装配逐字节比对无意义，β/γ 各自独立 Y.Doc）；DENY 列 `packages/replication-protocol/**` 与 `src/**` 保对照事实源零污染；git 实查生产零 diff ⇒ wire/β 面零触碰 | no-conflict（等价为被锚定的既有行为；判据口径承 #424 先例，非对 A4.8「逐字节等价」的弱化——A4.8 约束的是 wire 形态等价，控制帧+骨架判据即其可执行形态，数据帧语义判据处理的是不可消除的随机性） | 设计 §2/§11 DENY/§12；契约 LIVE-PARITY-C1/NC1；`git diff --stat`（仅夹具 +10）；#447 报告 #15（ROUND-C2 parity 先例） | — |
| 9 | 模块 AGENTS:17/:20/:22（缝纪律/工厂冻结/导出面） | γ 缝词汇 append-only；`createHubReplicationEdge`/`createHubSessionHost` 发布即冻结；生产 API 经 `src/index.ts`、测试控件留 testing surface | 零生产触碰（git 实查 `src/**` 零 diff、`src/index.ts` 未改）；夹具 +10 行 = test 目录内的 testing surface（条件展开注入既有生产 `observer` 选项 `hub-edge-host.ts:165/924`，SA6 H9），**不新增缝词汇**（`edgeObserver` 是 #447 测试夹具 `AsyncFacadeOptions` 的可选成员，非 seam 消息、非公共 API——不经 `src/index.ts` 导出）；既有 γ 登记句（#447 D12 已落地的 AGENTS:17 后半句）零改写 | no-conflict | `git status --porcelain`/`git diff` 实查（+10 行纯新增，既有行零改写）；`issue448-live-seam.ts:18`（仅 type-only 公共导入）；AGENTS.md:17 实读（γ 句在场） | — |
| 10 | 模块 AGENTS:24-26（验证门触发条件）+ 根采集面 | 「changed state-machine path」聚焦测试 / seam change 另跑契约 / 「wire or lifecycle change」加跑根 `pnpm typecheck`+`pnpm test` | 本票零生产改动 ⇒ 三个触发条件均不满足（设计 §6 第 8 行同读）；设计仍指定**超出最低要求**的包级门（契约单文件 13/13 + γ 族四文件 43/43 + 包全量 101/897 + 包 tsc exit 0）；根门禁归 #451（T5 根门禁全量回归）与 CI 收尾——新测试文件经根 `vitest.config.ts:15` `include` 逐字命中（SA8 实读 `packages/*/test/**/*.test.ts`），由 #451 的登记范围自然覆盖 | no-conflict（触发条件文义不满足即无义务；根门禁属 #451 已登记分工，非让渡——SA6 §12.2/设计 §11 DENY 边界一致） | 设计 §7-D5/§12；`vitest.config.ts:15` 实读；`artifacts/sa6-issue448-package-suite.log`/`-package-tsc.log` | — |
| 11 | docs/AGENTS.md（文档同步纪律） | 「When code behavior changes, update every normative document whose stated contract changed」 | 零代码行为变化（git 实查）⇒ 无文档同步义务；设计据此把 ADR 0032/协议 §24/模块 AGENTS 全列入 DENY 并声明「缝词汇闭集合无新增，无需 D12 式同步」——SA8 复核：夹具改动确无新缝词汇/新事件型/新错误码，规范文本所述契约无一发生变化 | no-conflict | 设计 §1 非目标/§11 DENY；`git status`（docs/ 零改动）；§1 事实复核记录 | — |
| 12 | ADR 0032 决策 2（`:18`）+ A4.8（零 worker_threads） | nomicore 零 worker_threads/MessageChannel 依赖或类型；验收管道不引入线程 | 契约/夹具纯内存（显式 release 通道对 + 微任务泵 + 手动时源），零线程零真实 timer；生产依赖面零触碰 | no-conflict | 设计 §7-D5-5/§9；`issue448-live-seam.ts` 实读（boot/pumpUntil 装配）；#447 报告 #16 同源 | — |
| 13 | CONTEXT.md SessionHost/序回执词条（`:229-235`） | γ 段：无拒纳/闸门/信用词汇、流控 edge 单点；序回执 `_Avoid_`：不伪造序号、不当接纳信号、不回执分道 | 设计与契约的全部词汇/断言面向均在该词表内：receipt 单通道 FIFO 配对、伪造序 ⇒ 响亮、tag 不入事件键集（`update-acked` 断 `not.toHaveProperty` 含 tag 面）、流控判据锚 edge 单点语义；无任何词条增改主张 | no-conflict | 设计 §2/§8/§12；CONTEXT.md `:229-235` 实读；契约 LIVE-OBS-C1 | — |
| 14 | **设计 §7-D1 裁定本身（verification-only）** | 判例依据：任务类型反向诊断先例 #316（`task_issue-316_sa6_contract.md`：能力在 HEAD 已整体交付 ⇒ 绿色验收/回归契约 → `approve`，实查在场）；#447 设计 D4/D6/D9/D10 把数据面机械明示列入 T1 变更集（`task_issue-447_design.md:152-198`，SA8 实读） | 裁定 = 范围判断，**确认而非修订任何既有决策**：三路证据（规范→代码锚点全命中 / git 历史 / 运行时 13 全绿 + 负控有牙）经 SA8 独立复核无矛盾（§1 事实复核记录）；备选否决（重实现制造第二机械 / 退票 / 投机预写）均不触碰决策集 | no-conflict（裁定与决策集零对撞；「零生产改动」恰为对全部冻结面的最大遵守） | 设计 §0/§3/§7-D1；本报告 §1 事实复核记录；#316 契约实查 | — |
| 15 | 相邻票分工（#449/#450/#451）——流程边界非决策面（登记核对项） | SA6 §12.2 边界登记 | 设计 §1 非目标 + §11 DENY 显式排除 #449（kind=1/2 全回合、drain 第三触发点全回合）、#450（1011/close 冲刷/OPEN 水位）、#451（观测总归属/根门禁）范围面；LIVE-DRAIN-C1 收窄至 kind=0 数据面切片，不与 #449 的 SYNC_APPLIED 保序锚重复 | no-conflict（无决策面触碰；越界风险由 DENY + 契约收窄双重控制） | 设计 §1/§11/§13-R3；SA6 §12.2；契约 LIVE-DRAIN-C1 用例名（kind=0 明示） | — |

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| （无） | — | — | — |

无任何合法 override：Issue 评论 REST 快照为空（无 Owner 评论可作覆盖权威）；无新 ADR 修订/废弃；无协议版本升级。设计亦未主张 override——`sendQueueMs` 增补被显式登记为「须先 §24.3/A4 显式 amendment，另票」（§7-D4），verification-only 裁定不依赖任何 override。处置正确。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（worktree 实查） |
|---|---|---|---|
| β 公共工厂/句柄面（`createHubSessionHost` 等） | 签名与行为逐字 | A4.1:61；A1:41；AGENTS.md:17/`:20` | 保持（`git diff --stat` 仅 `issue447-async-seam.ts` +10；`src/**` 零 diff） |
| 公共导出面（`src/index.ts`） | 值导出与类型只增不改（本票零增亦零改） | 后果`:112`；AGENTS.md:22 | 保持（文件未触碰） |
| wire 格式与序号纪律 | envelope/帧型/错误码/事件型；`[8..12]` mux 单点盖章 | §24 头注:1093；决策 2:18；§3 | 保持（零生产 diff；parity 为验证对象） |
| γ 缝词汇闭集合 | §24.3 七消息 + 无拒纳/闸门/信用词 | §24.3:1108-1120；A4.6；AGENTS.md:17 γ 登记句 | 保持（夹具 `edgeObserver` 非 seam 消息；γ 登记句零改写） |
| α/β/peer 行为 | 与 HEAD 逐字节等价 | A4.8:99；§24 头注 | 保持（生产零改动；T1 三套件 30/30 复跑绿为夹具 append 无伤证据） |
| observer 事件字段集 | append-only；`ackLatencyMs?`/`sendQueueMs?` 在场纪律；tag 不入事件键集 | 决策 5:30；§23.1；#447 TD-C1 | 保持（契约只断言不改字段；LIVE-OBS-C1 双侧归属 + 无 tag/无 sendQueueMs 断言） |
| 错误码注册表与映射单点 | 不新增错误码；code→WS close code 单点 `wsCloseCodeFor` | A1:40；§24:1114 | 保持（`CONNECTION_POLICY_VIOLATION`/`ACK_STATE_VIOLATION` 均既有码既有触发面复用） |
| §18/§21 生命周期参数与停机语义 | `closeTimeoutMs` 等不动 | §24.7:1147 | 保持（零触碰；#450 范围面显式排除） |
| 规范文本 | ADR 0032 / 协议 §24 / CONTEXT.md / 模块 AGENTS.md 本票零改动 | §24 为 A4 规范文本；docs/AGENTS.md 纪律 | 保持（`git status`：docs/ 与 CONTEXT.md 零改动） |
| 前序票冻结面（#420/#421/#422/#423/#447） | 各公共面只增不改；#447 夹具 append-only + 缺省零传 | AGENTS.md:20；#447 两份 SA8 报告 | 保持（唯一触碰 = `issue447-async-seam.ts` +10 纯新增、条件展开缺省零传，`git diff` 逐行核过） |

## 6. Evolution requirements

**无。** 设计未提出任何改变既有契约的主张：

- verification-only 裁定确认而非修订决策（§3 #14）；
- `sendQueueMs` γ 携带被显式 DENY 并指向显式 amendment 路径（§3 #7）——若未来启动该 amendment，届时须按 evolution-required 全清单（修订文件/新旧语义/兼容迁移/失败语义/版本/验证/冻结面保持）重过本门；
- 根门禁全量回归归 #451 登记范围，非本票让渡的义务（§3 #10）；
- 设计 §15-4 登记的两个条件触发项（(a) 反向诊断被推翻重开生产面；(b) γ 增补 `sendQueueMs`）均为**未来条件**，本轮未激活，不构成当前 evolution-required。

## 7. Hard conflicts

无。15 项对照全部落在 no-conflict / implements-existing-decision；verification-only 裁定的事实基础经 SA8 三路独立复核（源码锚点逐行 / git 历史 / 运行时证据日志）成立；工作树实查与设计的零生产改动声明一致；无 override 主张；无规范文本触碰；无冻结面回退；无缝词汇越界；无静默降级路径。

## 8. Required actions

| # | 级别 | 行动 | 归属 |
|---|---|---|---|
| R1 | 复核义务（落盘期，轻量） | SA3/评审阶段落盘契约工件时保持 ALLOW LIST 约束：13 条用例判据口径与负控/变异敏感性不削弱（`finally` 恢复、零 `skip/only/todo`、零 env override）；`issue447-async-seam.ts` 保持 append-only + 缺省零传（既有 +10 行不得改写为缺省行为变化）；基线证据日志保留不替换。以上任一被突破（尤其夹具缺省语义漂移或生产 `src/**` 出现 diff）即触发本门禁重开 | SA3 / SA4 / 总控 |
| R2 | 条件触发（登记，非本轮激活） | (a) 若后续证据推翻反向诊断（某 AC 场景在 HEAD 真红）⇒ 重开 SA6 诊断 + 设计修订 + 本门禁；(b) 若启动 γ `sendQueueMs` 增补 ⇒ 先做 §24.3/A4 显式 amendment 并重过冲突门（对应设计 §13-R4/R5、§15-4） | 总控 / 后续票 |
| R3 | 非阻塞（提示） | 根 `pnpm typecheck`/`pnpm test` 全量回归在本票零改动下无触发义务；#451 收尾时自然覆盖新增采集文件（根 `vitest.config.ts:15` 已逐字命中）——无需本票补跑 | #451 / CI |

## 9. Verdict

**`clear`**

依据：技能 verdict 规则——「clear：全部为 no-conflict 或 implements-existing-decision」。本轮 15 项对照全部落在该区间：

1. **implements-existing-decision（#1）**：交付物 = A4.8 验收纪律（延迟可注入显式异步内存管道 + 既有矩阵全绿硬门）在本票 AC 专属场景上的剩余锚覆盖义务兑现——13 条用例 + 负控 + 变异敏感性 + 包级全量/tsc 证据均已在 worktree 落地且绿。
2. **no-conflict（#2–#15）**：verification-only 裁定锚定的每条生产行为与 §24.2/§24.3/§24.4/§24.5/§24.6/§24.8 及 ADR 0032 A4 逐条对上（源码锚点 SA8 实读全命中）；零生产改动 = 全部冻结面保持；`sendQueueMs` 整键缺席为既有 dormant 登记的守门锚定；AC4「两触发点」措辞与 §24.6 三触发点以规范文本为准的超集调和成立且边界划归 #449；模块验证门触发条件文义不满足，根门禁归 #451 已登记分工。

无 hard-conflict、无 evolution-required、无待决 override；SA6 移交的裁定项（§15-1）经独立复核可承接。

## 10. requiresConflictRecheck

**false**。依据：技能规则——「纯 no-conflict、无新决策面的 existing-decision 兑现…为 false」。本设计**零生产实现面**：公共 API、wire、schema、持久化、状态机、生命周期、失败语义均无尚待实现核对的变更（git 实查生产 `src/**` 零 diff；交付物 = 已在本 worktree 落地且全绿的测试工件，SA3 职责为 ALLOW LIST 内的落盘守门，不产生新决策面）；无正式 override 待核对。§8-R2 的两个条件触发项若激活，届时按 conflict gate 重开（非本轮置位的理由）。
