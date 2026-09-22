# 实现设计 — issue #449（γ-T3）：reconcile 与分块 transfer 跨缝（verification-only 裁定与验收契约落盘）

- Dispatch：`sa-646c1138-bf07-4db0-9fd2-dd15bc337d31`（mabf-sa1 / design / iteration 0）。
- Baseline worktree：`/home/wangjian/nomicore-fix-issue-449`，branch `mabf/issue-449`，HEAD `444c166`（`Merge pull request #455 from nomicore-ai/mabf/issue-448`；γ 生产面来源 = T1 `52e634b`，T2 契约 = `0c92b3e`）。实查一致（`git branch` / `git log --oneline` / `git rev-parse HEAD`）。
- 上游输入：任务简报 `wiki/raw/task_issue-449.md`（Issue 正文 6 条 AC + `Blocked by #448`（#448 已随 PR #455 合并）；Comments 空）；SA6 契约 `wiki/raw/task_issue-449_sa6_contract.md`（`verdict: approve`，反向诊断 + 三项设计裁定移交）；前序票设计 `wiki/raw/task_issue-447_design.md`（D3/D4/D6/D9/§8.5/§8.9/§9.1）、`wiki/raw/task_issue-448_design.md`（§0/§3 verification-only 先例）、`wiki/raw/task_issue-448_sa10_spec.md`（AC4 三触发点超集调和 D2）；规范权威 `docs/adr/0032-transport-decoupling-edge-session-split.md` 附录 A4（:55-99）、`docs/protocols/instance-replication-v1.md` §24（:1091-1154）；模块规约 `packages/ws-replication/AGENTS.md`。
- SA8 产物（`task_issue-449_relevant_decisions.md` / `_conflict_report.md`）**不存在**（SA1 实查 `wiki/raw/`）；按 skill 纪律以规范权威原文 + 前序票已过冲突门的冻结面替代（§6）。
- 本设计不存在待修订前版（`wiki/raw/task_issue-449_design.md` 此前不存在，本次新建）。

---

## 0. 裁定摘要（先读）

**本票裁定为 verification-only（零生产实现面）**：Issue #449 的 AC1–AC6 目标行为在 baseline HEAD `444c166` 已由前序票 #447 的 T1 变更集（`52e634b`）整体交付（含 T3 专属机械：`ownStep1Seq`/`ownStep2Seq`/`bootstrapSnapshotSeq` 三态锚、kind=1/2 分块全回合、末 chunk 回执结算、连接死亡整体 abort、drain 三触发点）。SA1 已对 SA6 反向诊断的关键事实做**独立只读复核**（§2 逐行读回源码符号 + git 级事实 + 5 份证据日志读回），**未发现上游事实与源码的矛盾**。

与 #448 的关键差异：**SA6 本票 dispatch 明文禁止落盘可执行测试** ⇒ 契约矩阵（SA6 §12.3，15 条目）**尚未成为物理工件**——本票的可交付物 = 由实现阶段按契约矩阵**新著**测试文件 `packages/ws-replication/test/ws-replication-issue449-gamma-reconcile-chunked.test.ts`（§7-D2），并重建探针已删除的运行时证据（§7-D6）。三项 SA6 移交裁定项的裁定：**裁定项 B（verification-only）= 确认**（§7-D1）；**裁定项 A（drain 第三触发点非承重）= 登记 dormant 保险丝，零行为变更**（§7-D3）；**裁定项 C（ROUND3-C3 编排）= 步进放行 + 交换点在场断言**（§7-D4）。

---

## 1. 任务类型、目标和非目标

**任务类型**：Feature（γ-T3 reconcile 与分块 transfer 跨缝）——验收方向为**反向诊断承接**（先例：#448 同型 → verification-only → `approve`；#316「能力在 HEAD 已整体交付」先例）。能力已在 HEAD 交付，剩余缺口 = **锚覆盖（verification gap）**：本票 AC 专属场景（`ownStep1Seq` pending 面、kind=1 分块保序锚负控、连接死亡整体 abort / 无洞 / 不续传、drain 第三触发点行为边界、kind=2 多 chunk 双向回指、kind=0 中间/末回执步进切片）此前**无运行时锚**——SA6 契约以临时探针（7/7 PASS ×3，收尾已删）实证可执行后把断言面移交为契约矩阵，落盘即闭合。

**目标**：

1. 裁定并记录「#449 = verification-only（零生产改动）」（SA6 §15-3 裁定项 B；本设计 §7-D1）。
2. 交付契约工件：新著 `packages/ws-replication/test/ws-replication-issue449-gamma-reconcile-chunked.test.ts`（ROUND3 / ANCHOR3 / CHUNK3 / ABORT3 / DRAIN3 五族，条目语义以 SA6 §12.3 矩阵为权威规格），全部编排仅用既有夹具面（`issue447-async-seam.ts` 零改动 + `driver.ts`/`harness.ts` 既有 run/wire 助手）。
3. 登记三项移交裁定的设计处置（§7-D1/D3/D4）与相邻票（#450/#451）分工边界。
4. 重建运行时证据：探针日志（`artifacts/sa6-issue449-probe*.log`）是已删除脚本的运行记录，非可执行工件——落盘测试须重建同等证据（§7-D6/R3）。

**非目标**：

- 不修改任何生产实现（`packages/ws-replication/src/**` 及一切包/域/应用源码零改动）。
- 不修改规范文本（ADR 0032 / 协议 §24 / 模块 `AGENTS.md` 零改动——缝词汇闭集合无新增，无文档同步义务）。
- **不使 drain 第三触发点承重**：不为 AC6 制造行为变更（换键不换槽 / facet 仲裁语义不动，§7-D3）。
- 不覆盖 #450（γ-T4：连接账本 1011、close 冲刷 pending、`terminateUnauthorized`、OPEN 水位）、#451（γ-T5：`update-sent` 总归属矩阵、test-d 复核、根门禁全量回归）——SA6 §12.2 边界登记，本设计 §11 DENY 固化。
- 不重复 #448 已锚面（kind=0 窗口/两相记账/保序的 `LIVE-WINDOW/ORD/ACK` 族；`LIVE-DRAIN-C1` 的 kind=0 切片）——本票 `CHUNK3-C0` 只补**中间/末回执步进放行**切片。
- 不做性能/规模断言（SA6 §7：非目标）；不做 `sendQueueMs` γ 携带（§24.3 闭集合，另票 amendment，#448 设计 D4 同款 DENY）。

---

## 2. 当前行为与证据锚点（HEAD `444c166`，SA1 独立复核）

以下锚点 = SA6 契约 §10 影响面，SA1 逐行读回源码复核，**全部命中且语义一致**。这些是契约所锚定的**既有生产行为**（验证对象，非变更对象）：

| 面 | 符号 / 行（HEAD，SA1 实读） | 行为 |
|---|---|---|
| 三态锚载体 | `packages/ws-replication/src/types.ts:1036-1038`（`SendAnchorState = {phase:'pending',tag} ∨ {phase:'stamped',sequence}`）、`:1046/:1048`（`ownStep1Seq`/`ownStep2Seq: SendAnchorState \| undefined`）、`:1041-1052`（`RoundState` 全字段） | 三值判别口径：idle（undefined）∨ pending ∨ stamped；pending 态被引用性 ACK 引用 = 宿主违契（保序条款 §24.2.3） |
| 锚构造 / 判别 / 回填 | `round-engine.ts:135-140`（`anchorOf`：`≤0` ⇒ idle；γ bit ⇒ pending(tag)；否则 stamped）、`:143-145`（`anchorSequenceOf`：idle ∨ pending ⇒ undefined）、`:151-161`（`onSendReceipt`：tag 命中 pending 锚 ⇒ stamped；未命中 = 良性 no-op）、`:224-236`（`onApplied`：`anchorSequenceOf(ownStep2Seq)` undefined ∨ 不等 ⇒ `SYNC_STATE_VIOLATION` 响亮）、`:208-217`（`onStep2` 对 `ownStep1Seq` 同构判别） | AC1 三态判别是承重约束（探针 P-F：pending 被引用 ⇒ 响亮 + failed） |
| Step2 出站清锚 / 分块回填 | `round-engine.ts:293-311`（`sendStep2`：出站前清锚 → 单帧分支 `anchorOf` 回填 / 分块分支由末 chunk 回执结算点回填）、`:281-283`（`noteChunkedStep2Outbound`：锚 = `{phase:'stamped', sequence: 末 chunk 帧序}`） | AC1/AC2：锚回填时点 = 末 chunk 序回执（γ）；α/β 调用点/取值逐字节不变 |
| kind=2 接收端 seam | `round-engine.ts:244-257`（`admitChunkedStep2`：round 归属核对，失败由调用方按既有 SYNC_STATE_VIOLATION 收口）、`:264-275`（`completeChunkedStep2` = `applyStep2Safely` 暴露形态） | AC4 接收端分块回合 |
| 回执 fan-out 单点 | `hub-session.ts:309-315`（`onReceipt` 按通道 fan-out，返回「是否结算末 chunk」）、`hub-namespace.ts:738-746`（`onSendReceipt`：channel rekey + bootstrap 锚回填 + round 锚回填 + bulk 末 chunk 结算） | γ 层据返回值触发 drain 触发点③（AC6） |
| bootstrap 锚（单帧 + kind=1） | `hub-namespace.ts:660-665`（单帧：`seq>0` ⇒ γ pending(tag) / αβ stamped）、`:612-649`（kind=1 enqueue + `onLastChunkSent` 回调：锚 stamped + `chunkedAckT0 = pushedAt` + `chunked-snapshot-sent` 恰一）、`:684-722`（`onBootstrapAck`：idle ∨ 非 stamped ∨ 序不等 ⇒ `connectionFatal('ACK_STATE_VIOLATION', 1002)`；通过 ⇒ `settle(1)` + `chunked-snapshot-acked`） | AC2/AC3/AC4：kind=1 全回合 + 保序锚负控面（探针 P-A） |
| kind=2 发送端（D0 三态裁决） | `hub-namespace.ts:808-859`（`> maxSyncDiffBytes` ∧ 协商 ∧ `≤ maxChunkedSyncDiffBytes` ∧ transferId 域未尽 ⇒ kind=2 enqueue + `noteChunkedStep2Outbound` + `chunked-sync-sent`；未协商 ⇒ `SYNC_DIFF_TOO_LARGE`；超聚合 ⇒ `SYNC_TRANSFER_TOO_LARGE`）、`:775-799`（`onSyncApplied`：`round.onApplied` + `settle(2)` + `chunked-sync-acked`） | AC1/AC4：kind=2 全回合（探针 P-D/P-G：双向回指末 chunk 序） |
| 两相记账 / 槽位 1→1 | `update-channel.ts:135-138`（`pendingSends: Map<tag,…>`）、`:169-173`（`effectiveInFlightCount = inFlight + activeTransfer + pendingSends`）、`:198-209`（`onReceipt`：tag→seq **换键不换槽**；被弃 tag ⇒ zombie + no-op）、`:554-622`（`sendOneChunk`：中间 chunk 零注册/零事件；末 chunk γ 分支 `:585-598`：`activeTransfer → pendingSends`，占用 1→1）、`:692-703`（`teardown`：pending 冲刷 + `nextTransferId` 归 1） | AC3：中间 chunk 零 inFlight/零事件、末回执 1→1、ACK 结算；AC5 重连新作用域 |
| kind=1/2 载体 | `bulk-transfer.ts:232-252`（末 chunk 推送：γ 分支 `pendingLastChunkTag = {tag, pushedAt}` + phase awaiting-ack；kind=2 自持 timer 同点武装）、`:262-275`（`onReceipt`：awaiting-ack ∧ tag 命中 ⇒ `lastChunkSequence = sequence` → 同步 `onLastChunkSent` → 返回 true；中间/弃置 ⇒ false）、`:280-288`（`settle(kind)`）、`:291-298`（resync/teardown 弃置）、`:302-306`（连接压力 shed） | AC3/AC4/AC5：末 chunk 回执结算 + 整体弃置面 |
| facet 三段仲裁 | `hub-namespace.ts:182-208`（`sendFacet.pullAndSendOne`：① kind=0 在途 transfer → ② `bulkTransfer.hasWork()` → ③ live channel 路径）、`bulk-transfer.ts:134`（`hasWork = current !== undefined`）、`:191-199`（`pullOne`：awaiting-ack ⇒ **false**） | §7-D3 dormant 机理的直接证据：末 chunk 回执后载体仍 awaiting-ack ⇒ selfDrain 零进展 |
| 连接死亡收口 | `hub-session.ts:284-290`（`close`：全通道 quiesce + onConnectionClosed 汇流）、`hub-namespace.ts:1241-1249`（`quiesceConnection`：closing + 清 timer + 摘订阅）、`:1264-1272`（`onConnectionClosed`：connection-teardown 收口链） | AC5：整体 abort（探针 P-B/P-E） |
| drain 三触发点 | `hub-session-async-host.ts:221-222`（① `onDataQueued`/`requestDataDrain` = 入队）、`:150-152`（② 每条入站缝消息消费后 =「ACK 到达」保守超集）、`:174-176`（③ transfer 末 chunk 回执结算后）、`:271-277`（`selfDrain`：`while (facet.pullAndSendOne())`，推完即停） | AC6：触发点③结构性在场、现态机非承重（§7-D3）；禁 busy loop |
| 缝句柄纪律 | `hub-session-async-host.ts:96/:98`（`tagCounter` / `unresolvedTags`）、`:161-177`（`handleReceipt`：终态静默 → sequence 域校验 → 未决集命中 → fan-out；伪造序/未知 tag ⇒ `CONNECTION_POLICY_VIOLATION` 响亮）、`:256-264`（`emitSeam`：tag 分配单点 + 未决集登记）、`:197-202`（`close`：未决集整体冲刷） | 全族断言的缝纪律前提（无伪造序/一次性回执） |
| 乐观发送 | `hub-session-async-host.ts:219`（`dataGateOpen: () => true`） | §24.5/A4.3：流控单点 edge，session 闸门 dormant |
| 分块限额校验门 | `validate.ts:238-262`（显式表达时校验 `maxChunkedBootstrapBytes ≤ maxChunksPerUpdate × maxUpdateBytes` / `maxChunkedSyncDiffBytes ≤ maxChunksPerUpdate × maxUpdateBytes`；绝不运行时 clamp） | 测试构型约束链（§13-R6：契约 §7 的构型须过此门） |

**夹具 / 编排面（复用，零改动；SA1 实读）**：

| 面 | 符号 / 行 | 能力 |
|---|---|---|
| γ 夹具 | `packages/ws-replication/test/issue447-async-seam.ts`（899 行）：`withholdEdgeToSession`(:600-602)、`dropReceipts`/`setDropPredicate`(:603-611/:244-246)、`reorderNext`(:612-616；交换语义 :193-198)、`release(n)`(:189-210)、`setHeld`(:235-241)、`pumpUntil`/`pumpSteps`(:658-698)、`probes.stamps/receipts/unsealed/signals/outbound`(:273-294)、`makeManualClock`(:869-882)、`makeAsyncObserver`(:855-866)、能力感知解码 `decodeWire`/`wireFramesOfKind`/`wireSkeleton`/`wireDocState`/`wireFramesHexEqual`(:715-843) | 契约矩阵全部编排所需（SA6 H8 排除夹具 append；SA1 读回 API 面确认） |
| run/wire 助手 | `packages/ws-replication/test/harness.ts:639-640/:729-740`（`wire.closePeerSide(code)` / `closeHubSide`）、`packages/ws-replication/test/driver.ts:618`（`advanceMs(run, ms)`） | SA6 §10 将两者统记为「driver.ts」——SA1 精确化：wire 方法在 `harness.ts`（经 `run.wire` 暴露）、时间推进在 `driver.ts`；属归因细节修正，非事实矛盾 |
| β 对照面 | `issue424-sharded-hub`（既有）+ 447 round 测试 `bootAsyncRound`（`waitFor:'none'` + registry 同一性前提断言，:69-110） | CHUNK3-P1 parity 与本票新测试的 boot 形态先例 |

**git 级事实**（SA6 S1/S2；SA1 复跑验证）：pre-T1 `c86ccbc` 的 `src/index.ts` 零 `createHubAsyncSessionHost` 导出（`git show c86ccbc:… | grep -c` = 0）、仓库零 `issue447-async-seam`/`issue448-live-seam` 文件（`git ls-tree -r c86ccbc | grep -c` = 0）⇒ 契约「旧实现（pre-T1）预期红 = 不可装配」的历史依据成立；HEAD `src/index.ts:9` 导出在場。

**证据日志读回**（SA1 逐份读回）：`artifacts/sa6-issue449-baseline-gamma-suites.log`（γ 四文件 43/43、Type Errors no errors）、`-package-suite.log`（**101 文件 / 897 用例** passed、exit 0）、`-package-tsc.log`（exit 0）、`-probe.log`（P-A…P-G 7/7 PASS，逐条输出与本设计 §2/§12 断言面一致）、`-probe-repeat3.log`（3 次运行 exit 0 / pass=7 / fail=0）。工作树状态（`git status --porcelain`）= 5 份证据日志 + 简报 + SA6 契约（untracked），**零测试工件、零生产 diff**——与 SA6 §16 纪律声明一致。

---

## 3. 能力缺口 / 根因（承接 SA6 §8，反向诊断）

**结论：本票不存在剩余生产能力缺口。** AC1–AC6 的目标行为已由 #447 的 T1 变更集交付——#447 设计明文把 T3 机械列入 T1 变更集（SA1 实读原文）：D4（三态锚载体 + pending 独立键空间）、D6（selfDrain 三触发点，含「transfer 末 chunk 回执」）、D9（t0 = 推送时刻）、§8.5（三态锚判别）、§8.9（分块形态：末 chunk 回执结算、锚回填时点迁移）、§9.1（kind=2 自持 timer 与回执交互的角落登记）；#448 SA10 终审 D2 亦登记「第三触发点的 kind=1/2 全回合编排显式归 #449」。

- **症状**：「#449 的 AC 看似待实现」（票面 What-to-build 以实现语气书写）。
- **直接事实**：T1 的实现面**已含** T3 机械（共享载体：`RoundEngine` 三态锚 + `BulkTransferSender.onReceipt` 末 chunk 结算 + `hub-session-async-host` 三触发点 + `update-channel` 分块分支）。
- **触发条件**：`/to-tickets` 切片规划时 T1 的 AC 只写「控制面先行」，实现却按设计 D4/D6/§8.5/§8.9 连带落地分块数据面与三态锚。
- **最深根因**：**票切片与实现面重叠**（T1 超额覆盖 T3 生产面）——流程性事实，非代码缺陷；本设计不虚构 Bug 根因。
- **剩余缺口 = 锚覆盖（verification gap）**：本票 AC 专属场景此前无运行时锚。**与 #448 的差异**：SA6 契约只以临时探针实证（收尾已删），矩阵**尚未物理落盘**——缺口在测试工件落盘前不闭合，落盘即本票唯一交付面（§7-D2）。

---

## 4. Owner 要求落实

派工明示「Issue comments REST read returned an empty array」+ 简报 `## Comments` 空 ⇒ **无 owner 评论要求可映射**。需求全集 = Issue 正文 6 条 AC（+ Parent PR #446 设计工件语境）。

| Comment ID | Updated at | Requirement | Design section |
|---|---|---|---|
| （无评论） | — | — | — |

| Issue AC | 设计落点 | 契约条目（探针已证绿） | HEAD 状态 |
|---|---|---|---|
| AC1 `ownStep2Seq` 三态；sync round 全回合与 β wire 逐字节等价 | §2 锚点表（三态载体/判别/回填）、§7-D2 | `ROUND3-C1/C2/C3` + 既有 ROUND-C1/C2/C3、CHUNK-C1/C2 回归 | 已满足（P-G/P-D/P-F；探针 7/7） |
| AC2 SYNC_APPLIED / BOOTSTRAP_ACK 保序锚（延迟注入编排） | §2（`onBootstrapAck`/`onApplied` 判别）、§7-D4（编排裁定） | `ANCHOR3-C1/N1`、`ROUND3-C3` + 既有 ANCHOR-C2/CHUNK-C2 NC 互补 | 已满足（P-A/P-F） |
| AC3 chunked kind 0 全回合：中间 chunk 零 inFlight / 零事件，末 chunk 回执结算（事件语义不变） | §2（`sendOneChunk` 分块分支 / `pendingSends` / rekey） | `CHUNK3-C0` + 既有 `LIVE-DRAIN-C1` | 已满足（448 E4 + P-C 基线） |
| AC4 chunked kind 1/2（bootstrap / sync diff）全回合 | §2（kind=1 enqueue/结算、D0 裁决、kind=2 回合） | `CHUNK3-C1/C2`（= ROUND3-C1）+ `CHUNK3-P1` parity | 已满足（P-A/P-D/P-G） |
| AC5 连接死亡 → transfer 整体 abort；无洞中 transfer 形态锚 | §2（close/quiesce/teardown/pending 冲刷） | `ABORT3-C1/C2/C3/N1` | 已满足（P-B/P-E/P-C 基线） |
| AC6 drain 第三触发点（末 chunk 回执）落地 | §2（触发点③ + facet 仲裁）、§7-D3（dormant 裁定） | `DRAIN3-C1` + 诊断条目 `DRAIN3-D1` | **结构性落地、行为面非承重**（P-C 隔离变异轨迹逐值不变）——按 dormant 保险丝登记满足（规范超集调和，#448 SA10 D2 先例：SA8 裁 no-conflict） |

---

## 5. 复现和根因承接

| 上游事实（SA6 契约） | 证据位置 | 设计响应 |
|---|---|---|
| S1 baseline = HEAD `444c166`（含 T1 `52e634b`、T2 `0c92b3e`） | `git log --oneline`；SA1 复跑一致 | §0/§2 采纳为基线事实 |
| S2 pre-T1 `c86ccbc` 零 γ 公共面/夹具（历史红的事实基础） | SA6 git 级实查；SA1 复跑 `git show`/`git ls-tree` 双零 | §3 根因链采纳；契约「旧实现预期红」列的历史依据 |
| S3 T1 变更集按设计落地 T3 机械（D3/D4/D6/D9/§8.5/§8.9/§9.1） | `task_issue-447_design.md`（SA1 实读 :152-208/:329/:359/:470/:489/:550/:597-598）；`task_issue-448_sa10_spec.md` D2 | §3 采纳；verification-only 裁定的主干证据 |
| S4 HEAD 生产面逐符号具备（SA6 §10 行号表） | SA1 逐行读回复核（§2 表，含 SA6 未列的 `sendFacet`/`pullOne`/`validate` 锚点补强），全部命中 | **无上游事实与源码矛盾**；裁定可成立 |
| S5 未锚定面探针全绿（P-A…P-G）+ 负控 NC1–NC4 有牙 + 稳定性 3× | `artifacts/sa6-issue449-probe.log`、`-probe-repeat3.log`（SA1 逐份读回） | §12 验收映射采纳；探针临时性 ⇒ 落盘须重建证据（R3） |
| S6 剩余缺口 = 锚覆盖；夹具能力充分（H8） | SA6 §8-S6/§11-H8；SA1 读回夹具 API 面（§2 夹具表） | §7-D2/D5 固化：新著测试 + 夹具零改动 |
| 套件回归面：γ 43/43 + 包全量 101 文件/897 用例 + 包 tsc exit 0 | `artifacts/sa6-issue449-*.log`（SA1 读回计数行） | §7-D6/§12 验证门采纳 |
| 裁定项 A/B/C（§15-2/3/4） | SA6 契约 §15 | 分别裁定于 §7-D3/D1/D4 |

## 6. SA8 约束落实

#449 **无 SA8 产物**（`relevant_decisions`/`conflict_report` 缺席，SA1 实查）——本设计按 skill 纪律读取规范权威原文（ADR 0032 A4.1–A4.8 / 协议 §24.1–§24.8，SA1 逐条实读）替代，逐条落实如下。本设计零生产改动，故各约束的「处理方式」= **验证对象锚定**，非实现落点。

| 决议或义务 | 出处（SA1 实读原文） | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|---|
| 保序契约：每会话一对专用通道、每方向 FIFO、回执在盖章点同步投递 ⇒「回执恒先于引用该序的 ACK」为结构事实；违契响亮 | §24.2 / A4.2（protocol :1099-1105、ADR :67-75） | §2 锚点表；`ANCHOR3-C1/N1`、`ROUND3-C2/C3` | 既有行为，契约锚定（消费序 strict 先行断言 + 乱序/扣回执注入 ⇒ 响亮） | 否 |
| 两相记账：pending 自推送占窗、回执 tag→seq 换键不换槽；两锚中间态三值；非法引用（pending 被引用）走既有响亮判别、禁 park | §24.4 / A4.2（protocol :1129-1140） | §2（`pendingSends`/`onReceipt`/三态锚）；`ROUND3-C2/C3`、`ANCHOR3-N1`、`CHUNK3-C0` | 既有行为，契约锚定 | 否 |
| 流控单点 edge、session 乐观发送；分块 transfer 无「洞中」形态：连接存活 ⟹ 每 chunk 已盖章；连接死亡 ⟹ 通道 quiesce 整体 abort | §24.5 / A4.3（protocol :1141-1148） | §2（`dataGateOpen ≡ true`、close/quiesce/teardown）；`ABORT3-C1/C2/C3/N1` | 既有行为，契约锚定（死亡 ⇒ 零续推/零 settled/`unsealed===0`；存活对照 ⇒ 结算恰一次） | 否 |
| pacing：自驱 drain 触发点 = 入队 / ACK 到达 / transfer 末 chunk 回执；推完即停、禁 busy loop | §24.6 / A4.4（protocol :1149-1151） | §2（selfDrain 三触发点 + 终止性）；`DRAIN3-C1` + 既有 `LIVE-DRAIN-C2` 回归 | 既有行为，契约锚定；触发点③非承重按 dormant 登记（§7-D3，不修订 §24.4/A4.4 任何条款） | 否 |
| 生命周期：edge 收口起 session→edge 后到一切静默丢弃；close 沿同道 FIFO；session 收 close ⇒ pending 整体冲刷 + quiesce | §24.7 / A4.5（protocol :1152-1154） | §2（`handleFrame`/`handleReceipt` 终态门、`close` 冲刷）；`ABORT3-C1/C2/C3` | 既有行为，契约锚定 | 否 |
| 观测口径：chunked 族事件在 session 回执/结算点；`ackLatencyMs` t0 = 推送时刻；跨线程事件无全序 | §24.8 / A4.7（protocol :1155-1160 附近） | §12 全部条目 | 契约纪律：单通道 `delivered()` 消费序 + 单事件字段值断言，**零跨线程事件序断言** | 否 |
| 验收纪律：成功路径与 β wire 逐字节等价；延迟可注入显式异步内存管道、零 worker_threads；既有矩阵全绿为硬门 | A4.8（ADR :97-99） | §7-D2/D6；`CHUNK3-P1` + γ 四文件回归 | 夹具即显式释放内存管道（零真实 timer/零 worker_threads，SA1 读回头注确认）；β parity 判据 = 控制帧逐字节 + 骨架 + 数据帧文档语义 | 否 |
| 模块验证门：每条改动状态机路径聚焦测试；缝变更另跑 edge/session 契约与 wire parity | `packages/ws-replication/AGENTS.md`（Verification 段） | §7-D6 | 零生产改动 ⇒ 触发条件不满足；仍按包级全量 + tsc 交付证据（超出最低要求） | 否 |
| γ append-only 缝纪律 / β 同步冻结逐字不动 / 缝词汇闭集合 | `packages/ws-replication/AGENTS.md`（Boundary 段） | §11 DENY LIST | 零触碰（生产零改动；夹具零改动；不新增缝词汇） | 否 |
| 前序票 SA8 冲突门（可执行约束的筛查出处） | `task_issue-447_design_conflict_report.md`（在场）；#448 SA10 终审两轮 no-conflict（含三触发点超集调和 D2） | §15 | 本票约束全部继承自 #447 已筛查冻结面 + 规范原文；dormant 裁定延续 #448 SA10 已裁的「规范超集」读法，无新增协议决策 | 否 |

---

## 7. 设计决策与主要备选方案

### D1 裁定：verification-only（零生产实现面）——确认 SA6 §15-3 裁定项 B

SA6 把「#449 是否还有生产实现面」移交设计裁定。本设计裁定：**无**。依据（三路独立收敛，SA1 全部亲手复核）：

1. **规范→代码**：AC1–AC6 要求的每条行为（§6 约束表）在 HEAD 均有生产符号实现且语义与 §24/A4 逐条对上（§2 锚点表，SA1 逐行实读，含 SA6 未列的 `sendFacet` 三段仲裁 / `bulk-transfer.ts:191-199 pullOne` / `validate.ts:238-262` 构型门补强）。
2. **git→历史**：能力缺口历史上真实存在（pre-T1 `c86ccbc` 零导出/零夹具，SA1 复跑双零），由 `52e634b` 闭合（S2/S3）；「票切片与实现面重叠」是流程事实，不是待修复缺陷。
3. **运行时→断言**：P-A…P-G 七条探针在 HEAD 全绿 ×3 次重复（SA1 读回日志逐条比对断言面），负控 NC1–NC4 证明判别力（丢回执 ⇒ 响亮；断链 ⇒ 零续推；隔离变异 ⇒ 轨迹不变；时间推进 ⇒ 零帧）。

**备选否决**：
- **(a) 重新实现 T3 机械**：无缺口可填；任何「再实现」制造第二份机械，违反单份实现纪律（#447 D4/D5 否决理由同源），且必然与既有符号冲突。
- **(b) 以票面 What-to-build 实现语气为由重开生产范围**：6 条 AC 的验收动词（「锚」「等价」「落地」）指向可执行验证物；AC6 的「落地」按 §24.6 明文三触发点判读 = 触发点结构性在场即落地（dormant 承重性是另一维度，见 D3），#448 SA10 D2 已对同款措辞裁「规范内满足、非欠交付」。
- **(c) 等待反证**：若后续证据（某场景在 HEAD 真红）推翻反向诊断，正确路径 = 按 Controller 流程重开 SA6 类诊断 + 设计修订（§13-R4），不在本票预写投机性生产面。

### D2 交付物 = 按契约矩阵**新著**测试文件（与 #448「原样落盘」的差异面）

SA6 本票 dispatch 明文「do not implement or author executable tests」⇒ 契约工件不在 worktree（`git status` 实查：零 `*.test.ts` 新增）。实现阶段的职责因此与 #448 不同——不是守门既有工件，而是**按 SA6 §12.3 矩阵逐条新著**：

- **路径**：`packages/ws-replication/test/ws-replication-issue449-gamma-reconcile-chunked.test.ts`（单文件承载五族；采集面 = 根 `vitest.config.ts` `include = ['packages/*/test/**/*.test.ts', …]` 逐字命中，SA1 实读）。
- **条目权威规格 = SA6 §12.3**（15 行矩阵：最小输入 / 可观察断言 / 负控 / 旧实现预期 / 目标实现预期）。实现记录须给出**逐条目 → 测试用例**的映射；`CHUNK3-C2` 与 `ROUND3-C1` 同构（kind=2 全回合），可在同用例内断言或拆分，但判据不得合并削弱。
- **著写纪律**（承接 #447/#448 契约先例 + A4.8）：零 `skip/only/todo`、零 env override、零真实 timer/网络/wall-clock（显式 `release`/`withhold`/`setDropPredicate`/`reorderNext` + `makeManualClock` + `pumpUntil`/`pumpSteps` 微任务泵）；隔离变异（`DRAIN3-D1` 的 `BulkTransferSender.prototype.onReceipt` 返回值变异）必须在 `finally` 恢复原型；跨线程事件零序断言（单通道 `delivered()` 消费序 + 单事件字段值）。
- **断言口径不削弱**：恰 N 帧/恰一事件、`k+m` 时延、消费序 strict 先行、`unsealed === 0`、`transferId === 1`、无 `sequence` 键（chunked 族）等判据即 AC 的可执行形态。
- 证据日志（`artifacts/sa6-issue449-*.log`）保留为 SA6 阶段证据；落盘后新运行证据可追加（建议 `artifacts/` 下本票前缀新日志），不替换基线。

**备选否决**：等待 SA6 重开落盘——dispatch 分工已定（本票 SA6 禁写测试），重开违反流水线纪律且无增益；矩阵 + 探针日志已使新著工作有完整规格与预期值。

### D3 裁定：drain 第三触发点 = dormant 保险丝登记（零行为变更）——处置 SA6 §15-2 裁定项 A

SA6 发现（P-C 隔离变异）：`hub-session-async-host.ts:176` 的触发点③**结构性在场但现态机非承重**——隔离「结算了末 chunk ⇒ selfDrain」返回值后轨迹逐值不变。SA1 机理复核（独立读源确认，非转述）：

- **kind=1/2 侧**：末 chunk 回执只回填锚/清 `pendingLastChunkTag`，载体仍 `awaiting-ack`（`bulk-transfer.ts:235`）⇒ `hasWork()` 仍 true（`:134`，`current !== undefined`）⇒ facet 仲裁（`hub-namespace.ts:189`）路由到 `pullOne()` ⇒ **awaiting-ack ⇒ false**（`:193`）⇒ `selfDrain` 的 while 循环零进展退出；且窗口占用在回执点守恒（§24.4 换键不换槽），无空位可续推。
- **kind=0 侧**：末 chunk 回执 = `pendingSends → inFlight` rekey（`update-channel.ts:585-598` 注册 + `:198-209` rekey），不释放槽位；`onSendReceipt` 忽略 `channel.onReceipt` 返回值（`hub-namespace.ts:739`）；槽位由 ACK 释放，而 ACK 是入站缝帧 ⇒ 触发点②（`:150-152`）本就覆盖其后的 drain。

**裁定**：登记为 **dormant 保险丝（规范超集）**——触发点③满足 §24.6 的明文命令（在场、可触发、到达即调用 `selfDrain`），其对「未来若 §24.4 语义演化（如回执释放槽位）」是前置接线；本票**不做任何使其承重的行为变更**（那必须改 §24.4 换键不换槽条款或 facet 仲裁语义 = 规范 amendment，另票另裁）。契约以 `DRAIN3-C1`（行为边界：末回执后零新增帧/零 busy loop，ACK 后第 2 笔恰一次推出）+ `DRAIN3-D1`（诊断条目：隔离变异轨迹逐值不变的诚实登记）锚定现态边界。此读法延续 #448 SA10 终审 D2 已裁的「实现提供规范命令的超集 ⇒ 规范内满足」先例（SA8 两轮 no-conflict），非新决策。

**备选否决**：
- **(a) 使触发点③承重**（改回执语义释放槽位）：直接违反 §24.4 明文（占用守恒是 `maxInFlightUpdates` 窗口口径的归纳前提，447 设计 D10/SA2-F1 已裁）；破坏 PEND-C2/LIVE-WINDOW 判据族；属规范变更，本票 DENY。
- **(b) 删除触发点③**（消除「死代码」观感）：违反 §24.6 明文三触发点命令（删除 = 欠交付规范）；且它是 T1 已合并生产面，删除属生产行为变更，违反 verification-only 裁定。
- **(c) 不做任何登记**：AC6 要求「落地」有可执行锚——`DRAIN3-C1/D1` 即锚；不登记则 AC6 无验收物。

### D4 裁定：`ROUND3-C3` 编排 = 步进放行 + 交换点在场断言——处置 SA6 §15-4 裁定项 C

`ownStep2Seq` pending 面负控（AC2）的编排裁定：

1. **构型**：kind=2 多 chunk（`{maxSyncDiffBytes:1, maxChunkedSyncDiffBytes:64, maxUpdateBytes:1, maxBootstrapBytes:4096}`，须过 `validate.ts:255-262` 校验门）+ `withholdEdgeToSession` 扣留。
2. **步进**：`release(n)` 逐条放行至「**队列头 = 末 kind=2 chunk 回执**」——此处必须**在场断言** `edgeToSession.pending()[0]` 是该回执（`isReceipt` ∧ tag = 末 chunk tag，tag 经 `probes.outbound`/`stamps` 配对确定）且 `pending()[1]` 是对端 `SYNC_APPLIED` 入站帧（`isInboundFrame` ∧ kind 判别）。
3. **交换**：`reorderNext()`（语义 = 下一次 release 交换缓冲前两条，`issue447-async-seam.ts:193-198`，SA1 实读）后 `release(1)` ⇒ session 先消费 `SYNC_APPLIED`（其 `ackedSequence` 引用的序尚未经回执回填 ⇒ `ownStep2Seq` 仍 pending）。
4. **断言**：hub `ERROR{SYNC_STATE_VIOLATION}` 响亮 + 零静默接受/零结算（与既有 CHUNK-C2 NC 的**超时弃置**面互补——本条锚 **pending 面**）。
5. **反假绿**：交换点在场断言（步骤 2）防编排漂移——若队列头不是预期消息（构型/限额漂移），用例必须红而不是碰巧绿。`LIVE-ORD-C2` 先例同款纪律。

**备选否决**：用 `setDropPredicate` 丢回执替代 reorder——丢回执走的是「锚永远 pending + ACK 直投」路径，与 `ANCHOR3-N1`/既有 CHUNK-C2 NC 重叠，且不能锚「乱序投递破坏保序条款」这一 §24.2.6 违契形态；两者都要（本条 + 既有族互补）。

### D5 夹具冻结：`issue447-async-seam.ts` 零改动 + 新测试自带局部 boot

SA6 H8（探针全部编排仅用既有 API ⇒ 夹具零改动）经 SA1 读回夹具 API 面确认（§2 夹具表：`withholdEdgeToSession`/`dropReceipts`/`setDropPredicate`/`release(n)`/`setHeld`/`reorderNext`/`pumpUntil`/`pumpSteps`/`probes`/`makeManualClock`/`makeAsyncObserver`/能力感知解码族全覆盖矩阵所需）。裁定：

- **既有测试文件与夹具全部零改动**（`issue447-async-seam.ts`、`issue448-live-seam.ts`、4 个 γ `*.test.ts`、`harness.ts`、`driver.ts`——后两者只读使用）。
- 新测试文件的 boot 形态：**文件内局部 boot 助手**（447 round 测试 `bootAsyncRound` 先例：`waitFor:'none'` + `random: () => 0.5` 钉死 + registry 同一性前提断言 + 唯一 connectionKey 断言）——本票场景大量需要 bootstrap/reconcile 相位的扣留编排，`waitFor:'none'` 是正确形态。允许（可选、只读）复用 `issue448-live-seam.ts` 的 `bootLiveRound`（其 namespace 推进同样由 `pumpUntil` 驱动），但 live 导向的返回面不是本票主形态，局部 boot 为基准。

**备选否决**：append 夹具新旋钮——H8 已证不需要；任何 append 都扩大冻结面触碰风险并触发 #447 夹具自测（`issue447-async-seam-fixture.test.ts` 7 用例）回归义务。

### D6 验证门与证据重建

零生产改动下模块门禁触发条件不满足；但新增测试文件 ⇒ 设计指定验证门（与 SA6 §14 实跑口径一致，且**必须重跑**——探针证据已随脚本删除，R3）：

1. 契约单文件：`NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication/test/ws-replication-issue449-gamma-reconcile-chunked.test.ts` = 全绿、Type Errors no errors；
2. γ 族五文件（新文件 + 447 三套件 + 448 套件）= 全绿（回归面：夹具零改动不伤前序票；#448 时为 43/43，本票后基线 = 43 + 新增用例数）；
3. 包全量：`npx vitest run packages/ws-replication/test` = 全绿（新文件自动入采集）；
4. 类型门：`npx tsc -p packages/ws-replication/tsconfig.json` exit 0；
5. 稳定性：契约单文件连续 ≥3 次全绿（对齐 SA6 探针 3× 纪律）。

根 `pnpm typecheck`/`pnpm test` 全量回归属 CI/Host 收尾门与 #451（T5）登记范围，本票不重复主张。环境条件 `--conditions=nomicore-source` = 仓库既有测试脚本同款条件导出选择，非伪造开关。

---

## 8. 接口、状态机和数据流

**生产接口 / 状态机：零变化**（D1）。本节描述的接口面 = 新测试工件的内部结构与它观察的既有状态机。

### 8.1 新测试工件结构（实现阶段的著写规格）

| 族 | 用例（条目） | 编排要点（最小输入） | 关键断言面 |
|---|---|---|---|
| ROUND3 | `ROUND3-C1`（含 `CHUNK3-C2`）、`ROUND3-C2`、`ROUND3-C3` | C1：kind=2 多 chunk 构型（D4 步骤 1 的限额）+ `chunkedUpdate:true` + 显式泵；C2：扣留 + 按 tag 丢 hub `SYNC_STEP1` 回执后放行；C3：D4 全编排 | C1：单帧 `SYNC_STEP2` 恒 0、双向 `chunkIndex 0..k-1`/`chunkCount=k`/单一 transferId、双向 `SYNC_APPLIED.ackedSequence` = 对端末 chunk 序、`chunked-sync-sent/-applied/-acked` 各恰一（无 `sequence` 键、`ackLatencyMs` 在场）、live + 双向文档语义等；C2：`ERROR{SYNC_STATE_VIOLATION}` + namespace `failed` + 零 park；C3：D4 步骤 4 |
| ANCHOR3 | `ANCHOR3-C1`、`ANCHOR3-N1` | kind=1 小限额（`maxBootstrapBytes=8`/`maxUpdateBytes=64` ⇒ 7 chunk）+ 扣留 + 三步步进：① 除末 chunk 外回执 ② 末 chunk 回执 ③ `BOOTSTRAP_ACK` 帧；N1：同构型 + `dropReceipts` 丢全部 kind=1 chunk 回执后放 ACK | C1：① 期间仍 awaiting-ack + 零 `chunked-snapshot-sent`；② 锚 stamped + sent 恰一（t0 = 推送时刻）+ 零 acked；③ `BOOTSTRAP_ACK.ackedSequence` = 末 chunk 序 + acked 恰一 + **`edgeToSession.delivered()` 消费序中末 chunk 回执 strict 先于 BOOTSTRAP_ACK 帧** + live；N1：`connection-fatal{ACK_STATE_VIOLATION}` + `ERROR` + 非 live |
| CHUNK3 | `CHUNK3-C0`、`CHUNK3-C1`、`CHUNK3-P1` | C0：`{maxUpdateBytes:16, maxChunkedUpdateBytes:1024, maxInFlightUpdates:1}` + 队列第 2 笔 + 步进：中间回执 → 末回执 → ACK；C1：kind=1 逐 chunk tag/回执配对（中间 no-op）；P1：γ vs β（`issue424-sharded-hub` 同场同限额）parity | C0：中间回执 ⇒ 窗口仍占（第 2 笔不过缝）+ 零 `chunked-update-*`；末回执 ⇒ 仍 1 槽 + 零 acked；ACK ⇒ acked 恰一 + `UPDATE_ACK` 回指末 chunk 序 + 第 2 笔由 drain 续推；C1：每 chunk 独立 tag ∧ 每 tag 恰一 receipt ∧ `receipt.sequence` = 帧 wire `[8..12]`；P1：控制帧逐字节等 + 骨架（含 UPDATE_CHUNK 帧型/帧序）等 + 数据帧文档语义等（**T3 多 chunk 构型**，既有 parity 只覆盖单帧/kind=1） |
| ABORT3 | `ABORT3-C1`、`C2`、`C3`、`N1` | C1：kind=1 在途（chunk 族 ≥2 过缝、回执扣留）+ `run.wire.closePeerSide(1006)`；C2：kind=2 在途 + 断链；C3：死亡后 `advanceMs(run, 5000)` 推 backoff 重连；N1：同 C1 编排但连接存活、回执/ACK 放行 | C1/C2：死 session `sessionToEdge.delivered()` 与 `probes.outbound` 零增长、零 `settled`、`unsealed === 0`、零 chunked-sent/acked、非 live；C2 另加零 `chunked-sync-*`；C3：新会话独立完成 bootstrap/reconcile 至 live、新作用域 `transferId === 1` ∧ `chunkIndex` 从 0 严格递增、旧 transfer 零续传；N1：结算恰一次 + live（证明 abort 断言非空） |
| DRAIN3 | `DRAIN3-C1`、`DRAIN3-D1` | C1：kind=1/2 在途 + ACK 扣留 + 队列有第 2 笔（窗口/载体占位）；D1：隔离变异 `BulkTransferSender.prototype.onReceipt` 照常结算但 `return false`（`finally` 恢复） | C1：末回执结算后零新增 data 帧、`scheduler.pending()` 不增、载体仍 awaiting-ack（零 acked）；ACK 放行 ⇒ 第 2 笔恰一次推出；D1：轨迹/事件/收敛与基线**逐值相同**（dormant 登记，§7-D3） |

### 8.2 数据流路线

**无运行时数据创建/写入/转换/存储/传输路径变化**——依据：D1 零生产改动（`git status` 基线 + 本设计 ALLOW LIST 不含任何 `src/**`）。新测试工件**观察**的既有数据流（γ 异步缝单回合，验证面）：

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| γ 出站帧 | session 发送（round/bootstrap/update/bulk） | `emitSeam`（tag 分配 + 未决集登记，`hub-session-async-host.ts:256-264`） | session→edge 缝（`frame{tag,bytes,lane}`，`sequence=0` 占位） | edge 出站 mux 盖章 `[8..12]` → wire | `probes.outbound`/`stamps`；peer 收帧 | wire 帧可解码、回执 `receipt{tag,sequence}` 同步入队 edgeToSession | 监听者 throw 原样传播；未盖章（≤0）不投回执、`unsealed` 计数 | ROUND3-C1、CHUNK3-C1/P1 |
| 序回执消费 | edge 盖章点（宿主桥同步段） | `edgeToSession` 入队 | 显式 `release` 投递 → `handleReceipt`（域校验/未决集） | 进程内通道（无持久化） | 锚回填 / rekey / 末 chunk 结算三消费面（`hub-namespace.ts:738-746`） | 锚 stamped、槽位守恒、`chunked-*-sent` 恰一、drain 触发点③（dormant） | 伪造序/未知 tag ⇒ `CONNECTION_POLICY_VIOLATION` 响亮 | ANCHOR3-C1、CHUNK3-C0、DRAIN3-C1/D1、ROUND3-C3 |
| 引用性 ACK | peer 回 `BOOTSTRAP_ACK`/`SYNC_APPLIED`/`UPDATE_ACK` | peer 出站 | edge→session 入站帧（保序条款：回执恒先于） | 同上 | `onBootstrapAck`/`onApplied`/`onAck` 判别 | 结算 + 状态推进 + `chunked-*-acked` 恰一 | pending/不等 ⇒ `ACK_STATE_VIOLATION`/`SYNC_STATE_VIOLATION` 响亮（禁 park） | ANCHOR3-N1、ROUND3-C2/C3、CHUNK3-C0 |
| 连接死亡 | `wire.closePeerSide(1006)` | edge 收口 | `close` 沿同道 FIFO → session | 同上 | `close()`：未决集冲刷 + 全通道 quiesce + teardown | 零续推/零 settled/`unsealed===0`/transferId 归 1（重连新作用域） | 后到一切静默丢弃（A4.5） | ABORT3-C1/C2/C3/N1 |

---

## 9. 错误、恢复、并发和幂等

**被锚定的既有失败语义（验证对象，零变更）**：

| 失败形态 | 生产语义（§2 锚点） | 契约锚 |
|---|---|---|
| pending 锚被引用性 ACK 引用 | `ACK_STATE_VIOLATION`（connection-fatal 1002）/ `SYNC_STATE_VIOLATION`（namespace failed）——响亮、禁 park/等待/缓冲 | ANCHOR3-N1、ROUND3-C2/C3 |
| kind=2 自持 timer 超时（末 chunk 回执不可达） | 载体弃置 + `RESYNC_REQUIRED` + 迟到 `SYNC_APPLIED` ⇒ 响亮（既有 CHUNK-C2 NC = 超时弃置面，与本票 pending 面互补） | 回归哨兵（447 套件） |
| 连接死亡 | 整体 abort：pending 冲刷、通道 quiesce、transfer 弃置、transferId 归 1；重连 = 全新作用域零续传 | ABORT3-C1/C2/C3 |
| 缝违契（伪造序/未知 tag/乱序） | `CONNECTION_POLICY_VIOLATION` 响亮（`handleReceipt`）；乱序注入先例 `LIVE-ORD-C2` | ROUND3-C3 编排复用同款注入 |
| 帧不可解码 | `connection-fatal{MALFORMED_FRAME}`（`handleFrame` catch） | 既有面（不在本票矩阵，不新增） |

**测试工件的失败纪律**：断言失败即红（不吞、不降级）；负控必须证明「响亮」而非「恰好没断言到静默」（零 `skip/only/todo`、零 env override）；隔离变异必须在 `finally` 恢复生产原型（进程内单测无跨用例污染，但纪律保持）；不可重试逻辑（无 flaky 容忍——确定性编排：显式释放 + 手动时钟 + 微任务泵，零真实 timer/网络/wall-clock）。

**并发与幂等（既有面，被锚定）**：`close()` 幂等（重复调用返回同一 promise，`hub-session.ts:285`）；`terminateUnauthorized`/quiesce 对 quiet 态零副作用；`settle(kind)` 对无载体/非 awaiting-ack 返回 undefined（零事件）；回执一次性消费（未决集 delete 后重复投递 ⇒ 响亮）。

---

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| 生产代码全部调用方（edge/session/namespace/channel/bulk 内部链） | HEAD 行为（§2） | **逐字节不变**（零生产 diff） | 无 | §7-D1；`git status` 基线 |
| 根 vitest runner / CI | 采集 `packages/*/test/**/*.test.ts`（101 文件） | 新文件自动入采集（102 文件）；`maxWorkers: 1` 串行保持 | 无配置改动 | `vitest.config.ts:15-17`（SA1 实读） |
| 既有 γ 四套件（447×3 + 448，43 用例） | 绿（SA6 基线日志） | 保持绿（夹具零改动 ⇒ 无回归源） | 无 | `-baseline-gamma-suites.log` |
| `issue447-async-seam-fixture.test.ts`（夹具自测 7 用例） | 绿 | 保持绿（夹具零改动） | 无 | 同上 |
| 实现阶段（按 Host 路由；#448 先例为流水实施角色） | 无 #449 测试工件 | 按 §7-D2/§8.1 新著测试 + §7-D6 重跑证据 | 新增 1 文件 | SA6 §15-1 移交 |
| SA6/SA7 复跑（验收/标准复核） | 探针证据（临时，已删） | 以落盘测试为可复跑证据面 | 无（重跑既有门） | SA6 §16；R3 |
| #450/#451（相邻票） | 边界登记（SA6 §12.2） | 不受影响（本票不触碰其面） | 无 | §11 DENY |

---

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/ws-replication/test/ws-replication-issue449-gamma-reconcile-chunked.test.ts` | **新增**（本票唯一可执行交付物；五族用例著写规格 = §8.1，条目权威规格 = SA6 §12.3） | AC1–AC6 的可执行验收锚（§7-D2） |
| `artifacts/sa6-issue449-baseline-gamma-suites.log`、`-package-suite.log`、`-package-tsc.log`、`-probe.log`、`-probe-repeat3.log` | 已在场（SA6 证据，保留；不改动内容） | SA6 运行证据链（§5/S5） |
| `artifacts/`（本票前缀新日志，如 `sa6-issue449-contract-run.log` / 复跑稳定性日志） | 新增（可选；落盘后重跑证据） | §7-D6 证据重建（R3） |
| `wiki/raw/task_issue-449_design.md` | 本设计（新建） | 设计产物固定位置 |

（下游流水线产物——SA2 评审、实施记录、复核、标准报告等——由各自 dispatch 授权，不在本 ALLOW/DENY 之列。）

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/ws-replication/src/**`（含 `hub-session-async-host.ts`、`round-engine.ts`、`hub-namespace.ts`、`hub-session.ts`、`update-channel.ts`、`bulk-transfer.ts`、`types.ts`、`index.ts` 等） | AC1–AC6 目标行为的实现载体（§2） | verification-only（§7-D1）：零生产缺口；改动制造第二机械或破坏 β 逐字节冻结；**dormant 裁定（D3）明文禁止使触发点③承重** |
| `packages/ws-replication/test/issue447-async-seam.ts`、`issue448-live-seam.ts`、`harness.ts`、`driver.ts` | 夹具与 run/wire 助手 | H8：能力充分 ⇒ 零 append；冻结面保持（§7-D5） |
| `packages/ws-replication/test/ws-replication-issue447-*.test.ts`、`ws-replication-issue448-*.test.ts` 及其余既有 `*.test.ts`/`*.test-d.ts` | 回归面（43 用例 + 包全量 897） | 回归证据依赖其原样；本票无生产/夹具变化 ⇒ 无同步义务 |
| `docs/adr/0032-transport-decoupling-edge-session-split.md`、`docs/protocols/instance-replication-v1.md` | 规范权威（A4/§24） | 零语义变化 ⇒ 无文档同步义务；dormant 裁定不改任何条款（欲改须显式 amendment 另票） |
| `packages/ws-replication/AGENTS.md`、根 `CONTEXT.md` | 模块契约 / 共享词表 | 缝词汇零新增、零领域术语变化（零生产改动） |
| `packages/replication-protocol/**`（wire codec） | parity 判据的事实源 | wire 格式零变化；改 codec 即破坏 CHUNK3-P1 判据 |
| 根 `vitest.config.ts`、`tsconfig*.json`、`package.json`、`pnpm-lock.yaml` | 运行器/类型门配置 | 新文件逐字命中既有采集/类型规则（§7-D6），零配置改动 |
| #450/#451 范围面（连接账本 1011、close 冲刷 pending、`terminateUnauthorized`、OPEN 水位、`update-sent` 总归属矩阵、test-d 复核、根门禁全量回归） | 相邻票分工（SA6 §12.2） | 越界即与相邻票冲突；`ABORT3-*` 只锚异常断链形态（`closePeerSide(1006)`）+ 重连新作用域 |
| 其他包/域/应用（`packages/*`（除上 ALLOW）、`domains/**`、`apps/**`） | 无关 | 本票零触及 |

---

## 12. 验收与验证映射

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1 三态锚 + kind=2 全回合 | 探针 P-G/P-D（7/7 ×3）；既有 ROUND-C1/C2/C3、CHUNK-C2 | `ROUND3-C1`（多 chunk 构型）落盘 | 双向回指末 chunk 序、事件恰一、live、收敛 |
| AC1 pending 判别（`ownStep1Seq`） | 探针 P-F | `ROUND3-C2` 落盘 | `SYNC_STATE_VIOLATION` + failed + 零 park |
| AC1/AC2 β parity（T3 构型） | 既有 ROUND-C2/CHUNK-C1 parity（单帧/kind=1） | `CHUNK3-P1`（多 chunk 构型 γ vs β 同场）落盘 | 控制帧逐字节等 + 骨架等 + 文档语义等；内容变异必报差异（既有 NC-1 先例判据保持） |
| AC2 保序锚（kind=1 分块） | 探针 P-A 负控侧 + CHUNK-C1/C3 正路 | `ANCHOR3-C1`（三步步进 + 消费序 strict 先行断言）落盘 | 末 chunk 回执 strict 先于 BOOTSTRAP_ACK；sent/acked 各恰一；t0 = 推送时刻 |
| AC2 保序锚负控 | 探针 P-A | `ANCHOR3-N1` 落盘 | `connection-fatal{ACK_STATE_VIOLATION}` + ERROR + 非 live |
| AC2 `ownStep2Seq` pending 面负控 | 机制先例 `LIVE-ORD-C2` + P-A/P-F 判别面；**编排未落盘** | `ROUND3-C3`（D4 编排：步进 + 交换点在场断言 + reorder + release(1)）落盘 | `SYNC_STATE_VIOLATION` 响亮；编排漂移时用例红（反假绿） |
| AC3 kind=0 步进切片 | 448 E4（`LIVE-DRAIN-C1`）+ P-C 机制 | `CHUNK3-C0`（中间/末回执步进放行）落盘 | 中间回执零占位变化/零事件；末回执 1→1；ACK 结算恰一 |
| AC4 kind=1 全回合 | 既有 CHUNK-C1 + P-A/P-B 编排 | `CHUNK3-C1`（中间回执 no-op 切片补强）落盘 | 每 tag 恰一 receipt、`receipt.sequence` = wire `[8..12]`、末回执结算 |
| AC5 整体 abort / 无洞 | 探针 P-B/P-E | `ABORT3-C1/C2/C3` 落盘 | 死后零增长/零 settled/`unsealed===0`；重连 `transferId===1`、零续传；存活对照（N1）结算恰一 |
| AC6 drain 第三触发点边界 | 探针 P-C（基线 + 隔离变异） | `DRAIN3-C1` + `DRAIN3-D1` 落盘 | 末回执后零新增帧/零 busy loop；ACK 后第 2 笔恰一次；D1 轨迹逐值不变（dormant 诚实登记） |
| 回归面不伤 | γ 43/43 + 包 101/897 + tsc exit 0（SA6 基线） | §7-D6 门 2–5 重跑 | γ 五文件全绿 + 包全量全绿 + tsc exit 0 + 单文件 ≥3 次稳定 |
| 确定性纪律 | 夹具头注 + SA6 §7 | 落盘工件评审检查项 | 零真实 timer/网络/sleep；零 skip/only/todo/env override；变异 `finally` 恢复 |

---

## 13. 风险、回滚和残余问题

| # | 风险 / 残余项 | 处置 |
|---|---|---|
| R1 | **编排漂移假绿**（`ROUND3-C3`/`ANCHOR3-C1` 的步进脚本若队列头不是预期消息，可能碰巧绿） | D4 步骤 2 的交换点在场断言为强制项；评审检查「每步 release 前断言 `pending()` 头部身份」 |
| R2 | **著写漂移**（新著测试偏离 SA6 §12.3 判据，如合并/削弱负控） | 实现记录必须给逐条目 → 用例映射；§8.1 为著写规格；评审对照矩阵核判据口径（恰 N/恰一/k+m/strict 先行/无键断言） |
| R3 | **证据临时性**：P-A…P-G 来自已删除的探针脚本，日志只是运行记录 | §7-D6 强制重跑（单文件 + γ 族 + 包全量 + tsc + ≥3 次稳定）；新证据可追加不替换基线 |
| R4 | **反证路径**：若落盘/重跑中发现某场景在 HEAD 真红（推翻反向诊断） | 停止著写，按 Controller 流程重开 SA6 类诊断 + 本设计修订（§7-D1 备选 c）；**禁止**在新测试里就地改生产代码或放宽断言迁就 |
| R5 | **相邻票越界**：`ABORT3` 误锚 revoke/close 冲刷/1011（#450 面） | §11 DENY + §8.1 编排只允许 `closePeerSide(1006)` 异常断链形态 |
| R6 | **构型约束链**：小限额注入须过 `validate.ts:238-262` 显式校验门（`maxChunkedBootstrapBytes/maxChunkedSyncDiffBytes ≤ maxChunksPerUpdate × maxUpdateBytes`）且不误触 `BOOTSTRAP_TOO_LARGE`/`SYNC_TRANSFER_TOO_LARGE` 终局 | 沿用 SA6 §7 已验证构型常量（kind=1：`maxBootstrapBytes=8`/`maxUpdateBytes=64`；kind=2 多 chunk：`maxSyncDiffBytes=1`/`maxChunkedSyncDiffBytes=64`/`maxUpdateBytes=1`/`maxBootstrapBytes=4096`；kind=0：`maxUpdateBytes=16`/`maxChunkedUpdateBytes=1024`/`maxInFlightUpdates=1`）；变更构型须先过校验门推演 |
| R7 | **dormant 误读**：后人把 `DRAIN3-D1` 的「轨迹不变」误读为「触发点③可删」 | D3 备选 (b) 已否决并写入设计；触发点③ = §24.6 明文命令 + 规范超集；删除 = 欠交付 |
| R8 | **follow-up（明确非本票义务）**：γ `sendQueueMs` 携带（§24.3 闭集合 amendment）；触发点③若欲承重（§24.4 amendment）；根门禁全量回归登记（#451） | 均另票；本设计不预留任何钩子 |

**回滚**：交付物为单新增测试文件 + 可选证据日志——回滚 = 删除该文件（生产与既有测试零影响；`git status` 即验证）。

---

## 14. 评审修订映射

iteration 0：`wiki/raw/task_issue-449_sa2_review.md` 不存在（尚无评审输入）。无适用 finding。后续评审到达时按 skill 纪律逐条映射并原位修订本设计（含 §8.1 著写规格与 §11 文件范围的联动更新）。

---

## 15. 是否需要设计后 ADR 冲突复查

**结论：不需要（`requiresConflictRecheck: false`）。** 理由：

1. 本设计**零生产实现面**：不改公共 API、wire、schema、持久化、状态机语义——冲突复查的常规触发条件（协议/wire/schema/持久化/状态机语义变化、触碰 ADR 冻结面、修订既有决策、新增生命周期所有权或失败语义）一项都不满足。
2. ADR 0032 A4 与协议 §24 是**被满足与被锚定**的规范权威，不是被修订对象（§6 表逐条「否」）。dormant 裁定（D3）不改 §24.4/§24.6 任何条款——它延续 #448 SA10 终审对同款问题的已裁读法（「规范命令的超集 ⇒ 规范内满足」，SA8 两轮 no-conflict），属范围判断而非决策修订。
3. verification-only 裁定（D1）由三路独立证据支撑且确认而非修订既有决策。#449 虽无 SA8 产物，但约束集全部继承自 #447 已过 SA8 冲突门的冻结面（`task_issue-447_design_conflict_report.md` 在场）+ 规范原文 + #448 SA10 终审，无新增协议决策需要筛查。
4. 条件触发项（登记，非本轮激活）：(a) 若重跑中出现推翻反向诊断的真红证据并主张重开生产面（R4）；(b) 若后续变更欲使触发点③承重（触碰 §24.4 占用守恒条款）；(c) 若欲为 γ 增补缝词汇（如 `sendQueueMs` 携带，触碰 §24.3 闭集合）——届时按 conflict gate 重开 ADR 冲突检查。
