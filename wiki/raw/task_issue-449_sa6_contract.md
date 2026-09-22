# SA6 诊断与验收契约 — issue #449（γ-T3）：reconcile 与分块 transfer 跨缝（`ownStep2Seq` 三态、chunked kind 0/1/2 全回合、连接死亡整体 abort、drain 第三触发点）

- Dispatch：`sa-05f67772-14d0-4dd7-a5c1-ffc04c9a9848`（mabf-sa6 / acceptance-contract / iteration 0）。
- 任务类型：**Feature 的反向诊断**（能力已在 HEAD 由前序票 #447 的 T1 变更集整体交付，无剩余生产实现缺口）⇒ 可诚实交付的契约 = **绿色验收 / 回归契约**（可执行锚 + 负控 + 隔离变异敏感性证据），**不伪称红灯**。先例：`task_issue-448_sa6_contract.md`（同型反向诊断 → `approve`）。
- **本 dispatch 的额外纪律（覆盖 SA6 常规动作）**：派工明文「**do not implement or author executable tests**」⇒ 本报告**不落盘任何 `*.test.ts`**；交付物 = 契约规格（条目 / 最小输入 / 可观察断言 / 负控 / 旧实现预期 / 目标实现预期 / 路径），供设计阶段裁定后由实现/验收阶段落盘。诊断证据 = 既有 γ 套件实跑 + **临时探针**（收尾删除，§16）。
- Baseline worktree：`/home/wangjian/nomicore-fix-issue-449`，branch `mabf/issue-449`，HEAD `444c166`（`Merge pull request #455 from nomicore-ai/mabf/issue-448`；γ 生产面来源 = `52e634b` `feat(ws-replication): add gamma async session host`）。
- 结论：**`verdict: approve`** —— 六条 AC 的目标行为在 HEAD 逐条具备（源码符号 + 7 条探针运行时证据 + 既有 γ 套件 43/43 绿 + 包全量 101 文件/897 用例绿），负控/隔离变异证明断言面非恒真；契约可执行（夹具能力经探针实证）。**移交设计阶段的裁定项**：本票为 **verification-only**（零生产改动）——契约矩阵落盘即完成；`drain 第三触发点` 在现态机**结构性在场但非承重**（§9-X4/§15-2），需设计裁定「登记为 dormant 保险丝」而非行为变更。

---

## 1. Task type and inputs

| 输入 | 路径 | 状态 / 关键内容 |
|---|---|---|
| Host 任务简报 | `wiki/raw/task_issue-449.md` | 在场；Issue #449 body：Parent PR #446（spec/445-gamma-async-seam）+ What-to-build + AC1–AC6 + `Blocked by #448`（#448 已随 PR #455 合并）+ Comments 空 |
| Owner comments | 派工明示「Issue comments REST read returned an empty array」；简报 `## Comments` 亦为空 | **无 owner 追加要求**——需求全集 = Issue body 6 条 AC + ADR 0032 附录 A4 / 协议 §24（§2） |
| `task_issue-449_relevant_decisions.md` / `_conflict_report.md` | `wiki/raw/` | **不存在**（本任务未生成；非阻塞，§3 以规范权威替代） |
| SA8 产物（#449） | `wiki/raw/`、`artifacts/` | **不存在**（除简报外无 #449 产物；§3 约束取自规范文本与前序票冻结面） |
| 前序票验收契约 | `wiki/raw/task_issue-447_sa6_contract.md`（T1 全量锚）、`wiki/raw/task_issue-448_sa6_contract.md`（T2 数据面锚 + §12.2 边界登记：T3 = kind=1/2 全回合 / `ownStep2Seq` 三态 / SYNC_APPLIED 保序锚 / **drain 第三触发点**） | 在场；本票与之**零重复**：T2 契约显式收窄 kind=0（`transferKind === 0` 断言在场） |
| 前序票设计/终审 | `wiki/raw/task_issue-447_design.md`（D3/D4/D6/D9/§8.5/§8.9/§9.1）、`task_issue-448_design.md`（§1 非目标、§3 verification-only 先例）、`task_issue-448_sa10_spec.md`（AC4 三触发点超集调和） | 在场；T3 生产机械的**设计出处**（分块 γ 分支、末 chunk 回执结算、三触发点） |
| 规范权威 | `docs/adr/0032-transport-decoupling-edge-session-split.md:55-99`（附录 A4.1–A4.8）、`docs/protocols/instance-replication-v1.md:1091-1154`（§24） | 已读原文；本票六条 AC 的规范依据（§3） |
| 模块规约 | `packages/ws-replication/AGENTS.md`（缝纪律段 + Verification 段）、根 `AGENTS.md` | 已读；γ append-only、β 冻结、验证门 |
| 相邻票（边界） | `wiki/raw/task_issue-448_sa6_contract.md` §12.2：**#450** = 连接账本 1011 / close 冲刷 pending / `terminateUnauthorized` / OPEN 水位；**#451** = `update-sent` 总归属矩阵 / test-d 复核 / 根门禁全量 | 本契约不涉（§12.2） |

**范围（in scope）**：γ 缝（hub 侧异步面）上 reconcile/sync round 与分块 transfer 的**跨缝运行时锚**——`ownStep1Seq`/`ownStep2Seq`/`bootstrapSnapshotSeq` 三态判别、SYNC_APPLIED/BOOTSTRAP_ACK 保序锚与延迟注入编排、kind 0/1/2 全回合（逐 chunk 乐观推送、末 chunk 回执结算、槽位 1→1）、连接死亡整体 abort 与无洞不变量、自驱 drain 第三触发点的可观察边界。
**不在范围（out of scope）**：任何生产实现改动（本票零生产面）；可执行测试的落盘（dispatch 明文禁止，§15-1）；#450/#451 面；`sendQueueMs` 携带（§24.3 闭集合，另票 amendment）。

---

## 2. Owner comment mapping

- 派工明文 + 简报 `## Comments` 双确认：本 Issue comments 经 REST 读取为空数组 ⇒ **无 owner 追加要求可映射**。
- Owner 要求 = 简报正文 6 条 AC（+ Parent PR #446 设计工件语境）。AC → 契约族 → HEAD 状态：

| Issue AC | 契约族（§12.3） | HEAD 状态 | 依据 |
|---|---|---|---|
| AC1 `ownStep2Seq` 三态；sync round 全回合与 β wire 逐字节等价 | `ROUND3-C1/C2/C3`（+ 既有 ROUND-C1/C2、CHUNK-C1/parity 回归哨兵） | **已满足（绿）** | §5-E1/E2、§8-S3/S4 |
| AC2 SYNC_APPLIED / BOOTSTRAP_ACK 保序锚（延迟注入编排：锚回填恒先于引用帧序的回答帧） | `ANCHOR3-C1/C2`、`ANCHOR3-N1/N2` | **已满足（绿）** | §5-E2/E3、§6-NC1/NC2 |
| AC3 chunked kind 0 全回合：中间 chunk 零 inFlight / 零事件，末 chunk 回执结算（`chunked-update-sent`/`-acked` 语义不变） | `CHUNK3-C0`（补强既有 `LIVE-DRAIN-C1`） | **已满足（绿）** | §5-E4、既有 448 契约 E5 |
| AC4 chunked kind 1/2（bootstrap / sync diff）全回合 | `CHUNK3-C1/C2`（= `ROUND3-C1`） | **已满足（绿）** | §5-E1/E4、§6-NC1 |
| AC5 连接死亡 → transfer 整体 abort；无洞中 transfer 形态锚（连接存活 ⟹ 逐 chunk 已盖章） | `ABORT3-C1/C2/C3`、`ABORT3-N1` | **已满足（绿）** | §5-E5、§6-NC3 |
| AC6 drain 第三触发点（末 chunk 回执）落地 | `DRAIN3-C1`（+ 诊断 `DRAIN3-D1`） | **结构性落地，但行为面非承重**（§8-S5、§9-X4） | §6-NC4、§15-2 |

---

## 3. SA8 constraints

- #449 **无 SA8 产物**（`relevant_decisions` / `conflict_report` / design 均缺席，实查 `wiki/raw/` 与 `artifacts/`）⇒ 约束取自规范权威与前序票冻结面：

| 约束 | 出处 | 本契约落点 |
|---|---|---|
| 保序契约：每会话一对专用通道、每方向 FIFO、回执在盖章点**同步**投递 ⇒「回执恒先于引用该序的 ACK」为结构事实；违契响亮 | §24.2 / A4.2 | `ANCHOR3-C1/C2`、`ANCHOR3-N1/N2`、`ROUND3-C2/C3` |
| 两相记账：pending 自推送占窗、回执 tag→seq **换键不换槽**；两锚中间态为**三值**（未发 / pending / 已盖章）；非法引用（pending 态被引用）走既有响亮判别、禁 park | §24.4 / A4.2 | `ROUND3-C2/C3`、`ANCHOR3-N1/N2`、`CHUNK3-C0` |
| 流控单点 edge、session 乐观发送；**分块 transfer 无「洞中」形态**：连接存活 ⟹ 每只 chunk 已盖章；连接死亡 ⟹ 通道 quiesce 整体 abort | §24.5 / A4.3 | `ABORT3-C1/C2/C3`、`ABORT3-N1` |
| pacing：自驱 drain 触发点 = 入队 / ACK 到达 / transfer 末 chunk 回执；推完即停、禁 busy loop | §24.6 / A4.4 | `DRAIN3-C1`、既有 `LIVE-DRAIN-C2`（禁 busy loop 回归） |
| 生命周期：edge 收口起 session→edge 后到一切静默丢弃；close 沿同道 FIFO 送达；session 收 close ⇒ pending 集整体冲刷 + 通道 quiesce | §24.7 / A4.5 | `ABORT3-C1/C2/C3` |
| 观测口径：chunked 族事件在 session 回执/结算点；`ackLatencyMs` t0 = 推送时刻；跨线程事件**无全序** | §24.8 / A4.7 | 全部条目：单通道 `delivered()` 消费序 + 单事件字段值，**零跨线程事件序断言** |
| 验收纪律：成功路径与 β wire 逐字节等价；延迟可注入显式异步内存管道、零 worker_threads；既有矩阵全绿为硬门 | A4.8 | `CHUNK3-P1`、§4/§13 回归面 |
| 模块验证门：每个状态机路径聚焦测试；缝变更另跑 edge/session 契约与 wire parity | `packages/ws-replication/AGENTS.md`「Verification」 | §12/§14 |

---

## 4. Environment and baseline

- 环境：`node v24.13.0`、`pnpm 10.28.2`、`vitest 3.2.7`、`typescript 5.9.3`；worktree 初始无 `node_modules`，执行 `pnpm install --frozen-lockfile`（65 包，lockfile 零改动）。
- HEAD 基线（`444c166`，本票改动前）实跑：
  - γ 前序票套件（447 round/fixture/api + 448 live data plane）= **43/43 绿**（15 + 7 + 8 + 13），`Type Errors no errors`（`artifacts/sa6-issue449-baseline-gamma-suites.log`）；
  - 包全量（`npx vitest run packages/ws-replication/test`）= **101 文件 / 897 用例绿**、`Type Errors no errors`、exit 0（`artifacts/sa6-issue449-package-suite.log`）；
  - `npx tsc -p packages/ws-replication/tsconfig.json` = exit 0（`artifacts/sa6-issue449-package-tsc.log`）。
- 前序票（T1/T2）已交付的 γ 生产面符号（§10 表）；本票基线在 HEAD 上**全部绿**——契约不是红灯契约，而是 T3 面的验收 + 回归哨兵。

---

## 5. Positive reproduction（目标行为的运行时复现）

既有 γ 套件（全绿，逐条运行时断言）已覆盖的正面行为：

| # | 已锚条目 | 观察到的目标行为 | 证据 |
|---|---|---|---|
| E1 | `CHUNK-C2`（447 套件） | hub Step2 diff 超限 ⇒ 单帧 `SYNC_STEP2` 恒 0 + kind=2 chunk 族过缝；`SYNC_APPLIED.ackedSequence` = 末 chunk 帧序；live + 收敛 | `ws-replication-issue447-async-session-round.test.ts:580-607` |
| E2 | `ROUND-C1` / `ANCHOR-C1`（447） | OPEN_OK×1 + bootstrap 载荷恰一组 + ACK 回指 + SYNC 三段齐备 + live + 收敛 + close/settled | 同文件 `:186-223` |
| E3 | `ROUND-C2` / `CHUNK-C1 parity`（447） | γ（异步缝）vs β（sharded 同步缝）：控制帧逐字节等 + 骨架（含 UPDATE_CHUNK 帧型/帧序）等 + 数据帧文档语义等 | 同文件 `:254-304`、`:547-578` |
| E4 | `LIVE-DRAIN-C1`（448） | kind=0 改道：整只 transfer 占 1 槽逐 chunk 过缝、末 chunk 回执结算、`chunked-update-sent` 恰一次、`chunked-update-acked` 恰一次（无 `sequence` 键）、UPDATE_ACK 回指末 chunk 序 | `ws-replication-issue448-live-data-plane.test.ts:463-542` |
| E5 | `CHUNK-C3`（447） | 末 chunk 回执结算点 + `chunked-snapshot-acked.ackLatencyMs = k + m`（t0 = 推送时刻） | `ws-replication-issue447-async-session-round.test.ts:674-716` |

本票**新增**的未锚定面（临时探针实证；探针收尾删除，断言面移交契约矩阵）——全部在 HEAD **绿**：

| # | 探针 | 编排（最小输入 / 延迟注入） | 观察到的目标行为 |
|---|---|---|---|
| P-A | kind=1 锚 pending + ACK（负控可执行性） | 小限额改道（`maxBootstrapBytes=8`、`maxUpdateBytes=64`）；扣留 edge→session，只放 OPEN 帧；丢弃全部 kind=1 chunk 回执（锚停留 pending）后放行 ACK | `connection-fatal{ACK_STATE_VIOLATION}` + hub `ERROR{ACK_STATE_VIOLATION}` + 非 live —— **零静默接受** |
| P-B | kind=1 transfer 在途 + 连接死亡 | 同上扣留；chunk 族 7 帧过缝后 `wire.closePeerSide(1006)` | 死亡后 hub→peer 帧 / 缝出站帧**零增长**、`unsealed === 0`、零 `settled` 信号、零 `chunked-snapshot-sent`、非 live —— **整体 abort、无未盖章洞** |
| P-C | drain 第三触发点隔离变异 | 基线：kind=1 正常回合；变异：`BulkTransferSender.prototype.onReceipt` 照常结算但 `return false`（隔离「结算了末 chunk ⇒ selfDrain」返回值） | 两侧轨迹**逐值不变**（chunks=7、live、`chunked-snapshot-sent/-acked` 各 1、BOOTSTRAP_ACK 回指同一序）⇒ 第三触发点在现态机**非承重**（§9-X4） |
| P-D | kind=2 sync round 双向回指 | `{maxSyncDiffBytes:1, maxChunkedSyncDiffBytes:4096, maxUpdateBytes:64}`；kind=2 族过缝 | hub SYNC_APPLIED → peer 末 chunk 序；peer SYNC_APPLIED → hub 末 chunk 序；`chunked-sync-sent/-applied/-acked` 各 1；live |
| P-E | 死亡后不续传 / 重连新作用域 | kind=1 在途 + `closePeerSide(1006)`；`advanceMs` 推 backoff 重连 | 死连接 session 出站零增长；新连接 kind=1 零续传；新作用域 kind=2 transfer `transferId === 1`、`chunkIndex=[0]`，收敛到 live |
| P-F | `ownStep1Seq` 三态（pending） | 只扣 hub `SYNC_STEP1` 回执（动态按 tag 识别）；对端 SYNC_STEP2 引用其序 | hub `ERROR{SYNC_STATE_VIOLATION}` + namespace `failed` —— **pending 态被引用即响亮** |
| P-G | kind=2 多 chunk 全回合 | `{maxSyncDiffBytes:1, maxChunkedSyncDiffBytes:64, maxUpdateBytes:1, maxBootstrapBytes:4096}` | 两方向 kind=2 `chunkIndex=[0,1]`、`chunkCount=[2]`、单帧 SYNC_STEP2 = 0、双向 SYNC_APPLIED 各回指对端末 chunk、`chunked-sync-sent/-acked` 各 1、live |

证据日志：`artifacts/sa6-issue449-probe.log`（7/7 PASS）、`artifacts/sa6-issue449-probe-repeat3.log`（连续 3 次 7/7 PASS / 0 FAIL，exit 0）。

---

## 6. Negative control

| # | 负控 | 断言 | 结果 |
|---|---|---|---|
| NC1 | P-A：kind=1 chunk 回执丢失（锚 pending）+ 直投 BOOTSTRAP_ACK | 响亮 `ACK_STATE_VIOLATION`（connection-fatal + ERROR）；零静默接受 | 绿（**证明保序锚承重**） |
| NC2 | P-F：hub SYNC_STEP1 回执丢失 + 对端 SYNC_STEP2 引用 | 响亮 `SYNC_STATE_VIOLATION` + namespace failed；零 park | 绿（**`ownStep1Seq` pending 态判别承重**） |
| NC3 | P-B/P-E：连接在途死亡 | 零续推、零 settled、`unsealed === 0`；重连新作用域（`transferId=1`、`chunkIndex` 从 0），旧 transfer 不续传 | 绿（**整体 abort / 无洞不变量**） |
| NC4 | P-C：第三触发点隔离变异（结算但 `return false`） | 轨迹逐值不变 ⇒ 触发点在现态机非承重 | 绿（**诊断性发现**，§15-2；不是「断言有牙」而是「触发点无行为差」的诚实登记） |
| NC5 | 既有 `ANCHOR-C2`（447）：单帧 bootstrap 锚 pending + BOOTSTRAP_ACK | 响亮 `ACK_STATE_VIOLATION` + ERROR + close 1002 | 绿（保序锚同族既有对照） |
| NC6 | 既有 `CHUNK-C2 负控`（447）：扣末 chunk 回执 + 自持 timer 到期（载体已弃置）后直投 SYNC_APPLIED | `RESYNC_REQUIRED` 恰一次 + 响亮 `SYNC_STATE_VIOLATION`（零 park） | 绿（`ownStep2Seq` **超时弃置**面；与 NC2/契约 `ROUND3-C3` 的 **pending 面**互补） |
| NC7 | 既有 `LIVE-ORD-C2`（448）：`reorderNext` 使 ACK 先于回执 | 响亮 `ACK_STATE_VIOLATION` | 绿（乱序注入先例；本票 `ANCHOR3-N2/ROUND3-C3` 复用同款注入） |
| NC8 | 既有 448 `LIVE-DRAIN-C2`：`advanceBy(100)` + 重复泵 | 零新帧、`scheduler.pending()` 不增、结算后推完即停 | 绿（禁 busy loop 回归哨兵） |

零负控失败；无伪红/伪绿（无 skip/only/todo/env override/fallback；P-C 变异在 `finally` 恢复原型）。

---

## 7. Stability, scale and timing

- **确定性**：延迟注入 = 夹具显式 `release()`/`withholdEdgeToSession`/`setDropPredicate`/`reorderNext`（零真实 timer、零 wall-clock、零 sleep）；时源 = `makeManualClock`（`clock.advance` 精确决定 t0/t1）；异步性 = 微任务泵（`pumpUntil`/`pumpSteps`/`settle`），无竞态窗口。
- **重复性**：探针连续 3 次运行 **3/3 全绿（每次 7/7 探针、0 FAIL、exit 0）**（`artifacts/sa6-issue449-probe-repeat3.log`）；既有 γ 套件基线 43/43 绿（§4）。
- **规模/时序条件**：构型用小限额注入真实改道——kind=1：`maxBootstrapBytes=8` / `maxUpdateBytes=64` ⇒ 7 chunk；kind=2 多 chunk：`maxSyncDiffBytes=1` / `maxChunkedSyncDiffBytes=64` / `maxUpdateBytes=1` ⇒ 2 chunk/方向（且 `maxChunkedSyncDiffBytes ≤ 64 × maxUpdateBytes` 的限额校验门满足）；kind=1 单 chunk 对照：`maxUpdateBytes=64`（P-D）。
- **无性能断言**（本票非目标）；内存安全链 / 1011 收口属 #450。
- **存活时序**：死亡场景用 `wire.closePeerSide(1006)`（异常断链，覆盖 A4.3「连接死亡」形态）；重连用 `advanceMs(run, 5000)` 推 backoff（确定性假调度器）；`pumpSteps` 的有界推进用于「不该发生的事」断言前的确定性排空。

---

## 8. Root-cause chain / capability gap（反向诊断）

**结论：本票不存在剩余生产能力缺口；AC1–AC6 的目标行为在 HEAD 已由前序票 #447（T1 `52e634b`）交付，剩余缺口 = 锚覆盖（verification gap），已由本契约矩阵闭合。**

| Step | 事实 | Evidence | Confidence |
|---|---|---|---|
| S1 | 本票 baseline = HEAD `444c166`（含已合并 T1 `52e634b`、T2 `0c92b3e`） | `git log --oneline`；`git log -1 52e634b` | 高 |
| S2 | **T1 之前**（`c86ccbc`，spec #445 基线）γ 公共面与夹具均不存在：`src/index.ts` 零 `createHubAsyncSessionHost` 导出、仓库零 `issue447-async-seam`/`issue448-live-seam` 文件 | `git show c86ccbc:packages/ws-replication/src/index.ts \| grep -c` = 0；`git ls-tree -r c86ccbc \| grep -c` = 0 | 高 |
| S3 | T1 变更集**按设计**落地了 T3 的分块 γ 机械与锚三态（§24.4/§24.6 明文列入 #447 设计 D3/D4/D6/D9/§8.5/§8.9） | `task_issue-447_design.md` D6（selfDrain 三触发点，含「transfer 末 chunk 回执」）、§8.5（三态锚）、§8.9（分块形态）；`task_issue-448_sa10_spec.md` AC4 调和段 | 高 |
| S4 | HEAD 生产面逐符号具备：`SendAnchorState` 三态载体、`onSendReceipt` 回填、pending→stamped 判别、bulk 末 chunk 回执结算、连接死亡 teardown、drain 三触发点 | §10 表（符号/行号） | 高 |
| S5 | 六条 AC 的**未锚定面**在探针下全绿：P-A/P-B/P-C/P-D/P-E/P-F/P-G（§5）；负控 NC1–NC4 响亮/隔离成立（§6） | `artifacts/sa6-issue449-probe.log`、`-probe-repeat3.log` | 高 |
| S6 | 剩余缺口 = 本票 AC 专属场景此前**无运行时锚**：`ownStep1Seq` pending 面、kind=1 chunked 的保序锚负控、连接死亡整体 abort / 无洞 / 不续传、`drain 第三触发点` 的行为边界、kind=2 多 chunk 双向回指、kind=0 中间 chunk 零占位/零事件的**步进放行**编排 | 既有 γ 套件实读（`grep ownStep1/SYNC_STATE_VIOLATION/closePeerSide` 命中面）+ 契约矩阵 `ROUND3/ANCHOR3/CHUNK3/ABORT3/DRAIN3` | 中-高 |

**症状 → 直接事实 → 触发条件 → 最深根因**（反向读法，与 #448 同型）：症状 = 「T3 的 AC 看似待实现」；直接事实 = T1 的实现面**已含** T3 机械（共享载体：`RoundEngine` 三态锚 + `BulkTransferSender.onReceipt` + `hub-session-async-host` 三触发点）；触发条件 = `/to-tickets` 切片时 T1 的 AC 只写「控制面先行」，实现却按设计连带落地数据面/分块分支；最深根因 = **票切片与实现面重叠**（流程性事实，非代码缺陷）。**不虚构 Bug 根因**。

---

## 9. Causal experiments（控制变量）

| 实验 | 变量 | 对照 | 结论 |
|---|---|---|---|
| X1 锚三态判别（`ownStep1Seq`） | SYNC_STEP1 回执投递 / 丢弃 | P-F vs ROUND-C1 正路 | 丢弃 ⇒ pending 态被 Step2 引用 ⇒ 响亮 `SYNC_STATE_VIOLATION`（namespace failed）；投递 ⇒ stamped ⇒ 回合推进 ⇒ **三态判别是承重约束，非恒真** |
| X2 锚三态判别（bootstrap 单帧/分块同族） | chunk 回执投递 / 丢弃后直投 ACK | P-A vs CHUNK-C1 正路（+既有 ANCHOR-C2） | 丢弃 ⇒ 响亮 `ACK_STATE_VIOLATION`；投递 ⇒ 结算 ⇒ 推进 —— **保序条款在 kind=1 分块形态同构成立** |
| X3 连接死亡的整体性 | 连接死亡 / 存活 | P-B/P-E vs `ABORT3-N1`（存活对照） | 死亡 ⇒ 零续推 + 零 settled + `unsealed === 0` + 重连新作用域；存活 ⇒ 同编排结算一次并 live ⇒ **abort 断言非空** |
| X4 drain 第三触发点承重性 | 是否触发「末 chunk 回执结算后的 selfDrain」 | P-C 基线 vs 隔离变异 | 轨迹逐值不变 ⇒ **该触发点在现态机无行为差**（末 chunk 回执不释放槽位：`pendingLastChunkTag` 清除后载体仍 awaiting-ack，facet 仲裁 `bulkTransfer.hasWork()` 挡住 channel 路径） |
| X5 kind=2 多 chunk 回指 | chunk 数（1 / 2） | P-D vs P-G | 1 chunk 与 2 chunk 均：双向 SYNC_APPLIED 回指对端末 chunk 序、事件恰一次 —— **锚回填对 chunk 数不敏感（结构性）** |
| X6 kind=0 槽位转换 | 回执投递粒度（中间 / 末） | P-C 基线 + 既有 LIVE-DRAIN-C1 | 中间 chunk 回执 no-op（不入 `pendingSends`）；末 chunk 推送同同步段 `activeTransfer → pendingSends`（占用 1→1）——由既有 E4 断言面覆盖（本契约 `CHUNK3-C0` 细化步进放行） |

**控制变量纪律**：全部实验仅改「缝投递序列 / 连接存活 / 原型单方法返回值」三类变量；业务语义、限额、随机源（`random: () => 0.5`）、装配形态（adopt 单宿主单 edge）恒定。

---

## 10. Impact surface（本契约的证据触点，HEAD `444c166`）

| 面 | 符号 / 行 | 与本票 AC 的关系 |
|---|---|---|
| 三态锚载体 | `src/types.ts:1036-1038`（`SendAnchorState`）、`:1046/:1048`（`ownStep1Seq`/`ownStep2Seq` 类型） | AC1 |
| 锚构造 / 判别 / 回填 | `src/round-engine.ts:135-140`（`anchorOf`：`<=0` idle、γ pending、否则 stamped）、`:143-145`（`anchorSequenceOf`：idle ∨ pending ⇒ undefined）、`:151-161`（`onSendReceipt` tag 命中 ⇒ stamped）、`:224-236`（`onApplied` 判别）、`:293-311`（`sendStep2`：清锚 → 单帧回填 / 分块待回执） | AC1/AC2 |
| kind=2 接收端 round seam | `src/round-engine.ts:244-257`（`admitChunkedStep2`）、`:264-275`（`completeChunkedStep2`）、`:281-283`（`noteChunkedStep2Outbound`） | AC1/AC4 |
| 回执 fan-out | `src/hub-session.ts:309-315`（按通道 fan-out 并回传「是否结算末 chunk」）、`src/hub-namespace.ts:738-746`（`onSendReceipt`：UpdateChannel rekey + bootstrap 锚 + round 锚 + bulk 末 chunk 结算） | AC1/AC2/AC6 |
| bootstrap 锚（单帧+分块） | `src/hub-namespace.ts:660-665`（单帧 pending/stamped）、`:694-702`（`onBootstrapAck` 三态判别 ⇒ `ACK_STATE_VIOLATION`）、`:612-649`（kind=1 enqueue + `onLastChunkSent` 锚回填/`chunkedAckT0`/`chunked-snapshot-sent`）、`:706`（`settle(1)`） | AC2/AC4 |
| kind=2 发送端 | `src/hub-namespace.ts:808-859`（D0 三态裁决 + kind=2 enqueue + `noteChunkedStep2Outbound` + `chunked-sync-sent`）、`:775-799`（`onSyncApplied` + `settle(2)` + `chunked-sync-acked`） | AC1/AC4 |
| 两相记账 / 槽位 1→1 | `src/update-channel.ts:135-138`（`pendingSends`）、`:169-173`（`effectiveInFlightCount` 三项合并）、`:198-209`（`onReceipt` 换键不换槽 + 被弃 tag zombie）、`:450-461`（单帧 async 分支）、`:585-599`（**末 chunk async 分支：`activeTransfer → pendingSends`，占用 1→1**）、`:554-622`（`sendOneChunk`：中间 chunk 零注册/零事件） | AC3 |
| kind=1/2 载体 | `src/bulk-transfer.ts:239-246`（末 chunk 推送＝awaiting-ack + `pendingLastChunkTag`）、`:262-275`（`onReceipt` 结算 ⇒ `onLastChunkSent` + 返回 true）、`:280-288`（`settle(kind)`）、`:291-298`（resync/teardown 弃置）、`:302-306`（连接压力 shed） | AC3/AC4/AC5 |
| 连接死亡收口 | `src/hub-session.ts:284-290`（close：全通道 quiesce + onConnectionClosed）、`src/hub-namespace.ts:1241-1266`（`quiesceConnection`/`onConnectionClosed`）、`:1828-1848`（`closeSessionAndRelease`：`round/channel/bulkTransfer.teardown`）、`src/update-channel.ts:692-703`（teardown：pending 冲刷 + transferId 归 1） | AC5 |
| drain 三触发点 | `src/hub-session-async-host.ts:150-152`（② 每条入站缝消息后）、`:221-222`（① 入队/请求）、`:176`（**③ 末 chunk 回执结算后**）、`:271-277`（`selfDrain`：`while(pullAndSendOne())` 推完即停） | AC6 |
| 缝句柄纪律 | `src/hub-session-async-host.ts:96`（tagCounter）、`:161-177`（`handleReceipt`：序域校验/未决集 ⇒ 违契响亮）、`:256-264`（`emitSeam`）、`:219`（`dataGateOpen ≡ true`） | 全族（保序/无伪造序） |
| 既有契约工件（不重复落盘） | `test/ws-replication-issue447-async-session-round.test.ts`（15）、`-async-seam-fixture.test.ts`（7）、`-async-session-api.test.ts`（8）、`test/ws-replication-issue448-live-data-plane.test.ts`（13） | AC1–AC6 的已锚面 |
| 夹具（复用，零改动） | `test/issue447-async-seam.ts`（`withholdEdgeToSession`/`setDropPredicate`/`reorderNext`/`release(n)`/`setHeld`/`probes.stamps|receipts|unsealed|signals`）、`test/driver.ts`（`wire.closePeerSide`/`closeHubSide`、`advanceMs`） | 契约矩阵编排面（探针实证充分，**无需 append**） |
| 探针证据（临时，已删） | `artifacts/sa6-issue449-probe.log`、`-probe-repeat3.log`（P-A…P-G 7/7 ×3） | §5/§6 运行时证据 |

---

## 11. Ruled-out hypotheses

| # | 假设 | 判定 | 证据 |
|---|---|---|---|
| H1 | T3 目标行为（三态锚 / kind=1/2 全回合 / 整体 abort / 第三触发点）在本票 baseline 未实现 | **排除** | S3/S4 + P-A…P-G 全绿；CHUNK-C1/C2 既有绿 |
| H2 | `ownStep1Seq`/`ownStep2Seq` 的 pending 相位被静默接受（引用性 ACK 落 park/等待） | **排除** | P-F（`SYNC_STATE_VIOLATION` + failed）、P-A（`ACK_STATE_VIOLATION`）、既有 CHUNK-C2 NC |
| H3 | 连接死亡会留下「洞中 transfer」（部分 chunk 已盖章/部分未，且不可整体废止） | **排除** | P-B：零续推 + `unsealed === 0` + 零 settled；P-E：重连新作用域、旧 transfer 不续传 |
| H4 | 末 chunk 回执结算会越过 ACK 释放槽位（击穿窗口/提前发 acked 事件） | **排除** | 既有 E4（回执登记零事件、ACK 才结算）+ P-C（结算不改变轨迹） |
| H5 | kind=2 锚回填对 chunk 数为 1 的构型才成立（多 chunk 下回指失败） | **排除** | P-G：2 chunk/方向、双向回指末 chunk 序、事件恰一次 |
| H6 | γ 的 sync round 成功路径与 β wire 不等价（多帧/丢帧/序位漂移） | **排除** | 既有 ROUND-C2 + CHUNK-C1 parity（控制帧逐字节 + 骨架 + 文档语义） |
| H7 | `drain 第三触发点` 是承重的窗口释放路径（其缺失会卡死队列） | **排除（反向）** | P-C：隔离该触发点轨迹逐值不变 ⇒ 非承重（§15-2 登记） |
| H8 | 契约矩阵需要新增夹具能力（append-only 触碰 #447 夹具） | **排除** | 探针全部编排仅用既有 API（`withholdEdgeToSession`/`setDropPredicate`/`release(n)`/`reorderNext`/`closePeerSide`/`advanceMs`）⇒ 夹具零改动 |

---

## 12. Acceptance contract and test paths

### 12.1 契约工件（**规划**；本 dispatch 不落盘）

| 工件 | 作用 | 状态 |
|---|---|---|
| `packages/ws-replication/test/ws-replication-issue449-gamma-reconcile-chunked.test.ts` | **契约本体**：`ROUND3`/`ANCHOR3`/`CHUNK3`/`ABORT3`/`DRAIN3` 五族（§12.3） | 规划（需设计裁定后由实现/验收阶段落盘） |
| `packages/ws-replication/test/issue447-async-seam.ts` | 夹具：**复用、零改动**（探针实证能力充分，§10/§11-H8） | 冻结面，不动 |
| `artifacts/sa6-issue449-*.log` | 诊断证据（本报告引用） | 在场 |
| `wiki/raw/task_issue-449_sa6_contract.md` | 本报告 | 在场 |

> 纪律声明：本报告**未**创建/修改任何 `*.test.ts`、`*.test-d.ts`、fixture 或生产源码（`git status --porcelain` 实查，§16）。

### 12.2 边界登记（与相邻票的分工）

- **#450（γ-T4）**：连接账本 1011、close 冲刷 pending、`terminateUnauthorized`、OPEN 水位。本契约的 `ABORT3` 只锚 **A4.3/§24.5 的分块 transfer 整体 abort 语义**（异常断链 `closePeerSide(1006)` 形态 + 重连新作用域），**不锚** revoke/close 冲刷/1011 收口的编排（避免越界）。
- **#451（γ-T5）**：`update-sent` 总归属矩阵、test-d 复核、根门禁全量回归。本契约不主张 `update-sent` 归属面（只用其单事件字段的既有断言）。
- **#448（T2）已锚面不重复**：kind=0 的窗口/两相记账/保序已由 `LIVE-WINDOW`/`LIVE-ORD`/`LIVE-ACK`/`LIVE-DRAIN` 族覆盖；本契约 `CHUNK3-C0` 只补**中间 chunk 零占位/零事件的步进放行**切片。
- **#447（T1）已锚面作为回归哨兵**：`ROUND-C1/C2/C3`、`ANCHOR-C1/C2`、`PEND-C1..C3`、`CHUNK-C1..C3` 继续作为本票交付的硬门（§14）。

### 12.3 契约清单（最小输入 / 可观察断言 / 负控 / 旧实现预期 / 目标实现预期 / 现状）

| 条目 | 最小输入（确定性编排） | 可观察断言（运行时行为） | 负控 | 旧实现（pre-T1 `c86ccbc`） | 目标实现（HEAD） | 现状 |
|---|---|---|---|---|---|---|
| `ROUND3-C1`（AC1/AC4） | `chunkedUpdate:true`；`{maxSyncDiffBytes:1, maxChunkedSyncDiffBytes:64, maxUpdateBytes:1, maxBootstrapBytes:4096}`；显式泵 | 单帧 `SYNC_STEP2` 恒 0；两方向 kind=2 `chunkIndex 0..k-1`（k≥2）、`chunkCount=k`、单 transferId；`peer→hub SYNC_APPLIED.ackedSequence` = hub 末 chunk 序 ∧ hub 侧 `SYNC_APPLIED` = peer 末 chunk 序；`chunked-sync-sent/-applied/-acked` 各恰一次（session 侧、无 `sequence` 键、`ackLatencyMs` 在场）；live + 双向文档语义等 | `ROUND3-C3`；隔离变异：`noteChunkedStep2Outbound` 不调用 ⇒ 回指断言红 | **红**（无 γ 公共面/夹具，不可装配） | 绿（探针 P-G/P-D） | 未锚（新增） |
| `ROUND3-C2`（AC1，NC） | 同上构型；扣留 edge→session，只放 OPEN；按 tag 丢弃 hub `SYNC_STEP1` 回执；放行 | hub `ERROR{SYNC_STATE_VIOLATION}`；namespace `failed`；零 park/等待 | 正路 `ROUND3-C1` 作正对照 | **红**（同左） | 绿（探针 P-F） | 未锚（新增） |
| `ROUND3-C3`（AC2，NC，`ownStep2Seq` **pending 面**） | 步进放行至队列头 = 末 kind=2 chunk 回执；`reorderNext()` 后 `release(1)` 使对端 `SYNC_APPLIED` **先于**其回执消费 | hub `ERROR{SYNC_STATE_VIOLATION}`；零静默接受/零结算 | 既有 CHUNK-C2 NC（超时弃置面）互为正负；正路 `ROUND3-C1` | **红** | 编排待落盘（机制=reorderNext 先例 `LIVE-ORD-C2` + P-A/P-F 判别面） | 未锚（新增；编排需步进释放在场断言） |
| `ANCHOR3-C1`（AC2） | kind=1 小限额（`maxBootstrapBytes=8`/`maxUpdateBytes=64`）；扣留；步进放行：① 除末 chunk 外的回执 ② 末 chunk 回执 ③ BOOTSTRAP_ACK 帧 | ① 期间 transfer 仍 awaiting-ack、零 `chunked-snapshot-sent`；② 末 chunk 回执 ⇒ 锚 stamped + `chunked-snapshot-sent` 恰一次（`ackLatencyMs` t0=推送时刻）、零 acked；③ `BOOTSTRAP_ACK.ackedSequence` = 末 chunk 序 + `chunked-snapshot-acked` 恰一次；`edgeToSession.delivered()` 消费序中**末 chunk 回执 strict 先于** BOOTSTRAP_ACK 帧；live | `ANCHOR3-N1`（丢回执 ⇒ 响亮） | **红** | 绿（探针 P-A 的负控侧 + CHUNK-C1/C3 正路） | 部分已锚（`CHUNK-C1` 正路 + `CHUNK-C3` t0）；**顺序断言与步进结算缺** |
| `ANCHOR3-N1`（AC2，NC） | 同 `ANCHOR3-C1`，仅丢弃 kind=1 chunk 回执（锚停留 pending）后放行 ACK | `connection-fatal{ACK_STATE_VIOLATION}` + `ERROR{ACK_STATE_VIOLATION}` + 非 live | `ANCHOR3-C1` 正对照 | **红** | 绿（探针 P-A） | 未锚（既有 ANCHOR-C2 只覆盖单帧形态） |
| `CHUNK3-C0`（AC3 补强） | `chunkedUpdate:true`；`{maxUpdateBytes:16, maxChunkedUpdateBytes:1024, maxInFlightUpdates:1}`；扣留；只放中间 chunk 回执 → 放末 chunk 回执 → 放 ACK | 中间回执：窗口仍占（第 2 笔不过缝）、零 `chunked-update-*` 事件；末 chunk 回执：换键不换槽（仍 1 槽）、零 acked；ACK：`chunked-update-acked` 恰一次（`ackLatencyMs` 在场、无 `sequence` 键）+ UPDATE_ACK 回指末 chunk 序；第 2 笔由 drain 续推 | 隔离变异：`effectiveInFlightCount` 去 `pendingSends` ⇒ 第 2 帧越界（既有 448 NC-4 先例）；时间推进零帧（既有 `LIVE-DRAIN-C2`） | **红** | 绿（既有 `LIVE-DRAIN-C1` + 探针机制） | 部分已锚（448 E4）；**步进中间/末回执切片缺** |
| `CHUNK3-C1`（AC4） | kind=1 构型；逐 chunk 标签/回执配对；中间回执 no-op；末回执结算 | 每 chunk 独立 tag ∧ 每 tag 恰一条 receipt ∧ `receipt.sequence` = 该帧 wire `[8..12]`；放中间回执 ⇒ 零 sent 事件、仍 awaiting-ack；末回执 ⇒ `chunked-snapshot-sent` 恰一次；BOOTSTRAP_ACK 回指末 chunk 序；live + 收敛 | `ANCHOR3-N1` | **红** | 绿（既有 CHUNK-C1 + 探针 P-A/P-B 的编排） | 部分已锚（CHUNK-C1）；**中间回执 no-op 切片缺** |
| `CHUNK3-C2` | = `ROUND3-C1`（kind=2 全回合） | 同 `ROUND3-C1` | `ROUND3-C3` | **红** | 绿（P-G/P-D + CHUNK-C2） | 部分已锚（CHUNK-C2 单 chunk）；**多 chunk 切片缺** |
| `CHUNK3-P1`（AC1b 回归哨兵） | 同 `ROUND3-C1` 构型 vs β（`issue424-sharded-hub`）同场 | 控制帧逐字节等 + 骨架（含 UPDATE_CHUNK 帧型/帧序）等 + 数据帧文档语义等 | 既有 NC-1 内容变异（控制帧仍等、语义比对必报差异） | **红** | 绿（既有 ROUND-C2 + CHUNK-C1 parity 先例） | 部分已锚（单帧/kind=1 构型）；**T3 多 chunk 构型缺** |
| `ABORT3-C1`（AC5） | kind=1 在途（回执扣留，chunk 族 ≥2 过缝）+ `wire.closePeerSide(1006)` | 死 session `sessionToEdge.delivered()` 与 `probes.outbound` **零增长**；零 `settled` 信号；`unsealed === 0`；零 `chunked-snapshot-sent`；namespace 非 live | `ABORT3-N1`（存活对照） | **红** | 绿（探针 P-B） | 未锚（新增） |
| `ABORT3-C2`（AC5） | kind=2 在途（`maxSyncDiffBytes:1` 构型）+ 断链 | 同上 + 零 `chunked-sync-sent`/`-acked`；死 session quiesce | `ABORT3-N1` | **红** | 绿（机制同 P-B；kind=2 载体验证待落盘） | 未锚（新增） |
| `ABORT3-C3`（AC5） | 死亡后 `advanceMs(run, 5000)` 推 backoff 至新连接 | 新会话独立完成 bootstrap/reconcile 至 live；新作用域 `transferId === 1` ∧ `chunkIndex` 从 0 严格递增；旧 kind=1 transfer 零续传 | — | **红** | 绿（探针 P-E） | 未锚（新增） |
| `ABORT3-N1`（存活对照） | 同 `ABORT3-C1` 编排但连接存活、回执/ACK 放行 | 结算恰一次 + live ⇒ 证明 abort 断言非空 | — | **红** | 绿（探针 P-C 基线） | 未锚（新增） |
| `DRAIN3-C1`（AC6） | kind=1/2 在途 + ACK 扣留 + 队列有第 2 笔（窗口/载体占位） | 末 chunk 回执结算后：零新增 data 帧、`scheduler.pending()` 不增、载体仍 awaiting-ack（零 acked）；ACK 放行 ⇒ 第 2 笔恰一次推出 | `DRAIN3-D1` 隔离变异；既有 `LIVE-DRAIN-C2`（禁 busy loop） | **红** | 绿（探针 P-C 基线 + 既有 `LIVE-DRAIN-C2`；本触发点在现态机无行为差） | 未锚（新增） |
| `DRAIN3-D1`（诊断） | 隔离变异：`BulkTransferSender.prototype.onReceipt` 照常结算但 `return false` | 轨迹/事件/收敛结果与基线**逐值相同** ⇒ 触发点③在现态机非承重（`finally` 恢复原型） | — | **红** | 绿（探针 P-C） | 未锚（新增；设计裁定项 §15-2） |

> 「旧实现预期」列的历史红取自 git 级事实（S2：`c86ccbc` 零 γ 公共面与夹具 ⇒ 全部条目在 pre-T1 不可装配），**不伪称当前红灯**；本契约在 baseline（HEAD）预期**全绿**。

### 12.4 AC → 条目覆盖

| AC | 条目 | 覆盖形态 |
|---|---|---|
| AC1 | `ROUND3-C1/C2/C3`（+ 既有 ROUND-C1/C2/C3 回归） | 三态载体的 pending/stamped 判别面 + 多 chunk 全回合 + β parity 哨兵 |
| AC2 | `ANCHOR3-C1/N1`、`ROUND3-C3`（+ 既有 ANCHOR-C2/CHUNK-C2 NC 互补） | 消费序先行断言 + 延迟注入负控（kind=1 分块面 + kind=2 pending 面） |
| AC3 | `CHUNK3-C0`（+ 既有 `LIVE-DRAIN-C1`） | 步进回执切片：中间零占位/零事件、末回执 1→1、ACK 结算 |
| AC4 | `CHUNK3-C1/C2`（+ `CHUNK3-P1`） | kind=1/2 全回合（逐 chunk 标签/回执、末 chunk 结算、双向回指） |
| AC5 | `ABORT3-C1/C2/C3/N1` | 整体 abort + 无洞 + 不续传 + 存活对照 |
| AC6 | `DRAIN3-C1/D1` | 回执触发点的行为边界（无额外帧/无 busy loop）+ 承重性隔离诊断 |

---

## 13. Red/green or baseline evidence

- **本票 baseline（HEAD `444c166`）**：既有 γ 套件 43/43 绿（§4）；探针 7/7 PASS ×3 次（`-probe-repeat3.log`）；包全量 101 文件/897 用例绿、`Type Errors no errors`、exit 0；包 tsc exit 0。**契约矩阵预期全绿**（验收 + 回归哨兵），不伪称红灯。
- **历史能力缺口（诚实红灯出处）**：pre-T1 `c86ccbc` 无 `createHubAsyncSessionHost` 导出、无 `issue447-async-seam`/`issue448-live-seam` 夹具（git 级实查，S2）⇒ 全部条目在历史实现上**不可装配 = 红**；T1 `52e634b` 交付后本契约全部条目具备可装配前提。
- **敏感性证据（替代红灯的判别力证明）**：NC1/NC2（丢回执 ⇒ 响亮 `ACK_STATE_VIOLATION`/`SYNC_STATE_VIOLATION`）证明保序锚有牙；NC3（断链 ⇒ 零续推/零 settled/`unsealed 0`）证明 abort 断言非空；NC4（隔离变异 ⇒ 轨迹不变）证明第三触发点非承重（诚实登记，非伪绿）；NC8（时间推进/重复泵零帧）证明禁 busy loop。
- **零伪红/伪绿**：契约与探针无 skip/only/todo/env override/fallback/吞错；变异只在内存原型上做并在 `finally` 恢复。

---

## 14. Runner trigger evidence

- **采集面**：根 `vitest.config.ts` `test.include = ['packages/*/test/**/*.test.ts', …]` —— 规划路径 `packages/ws-replication/test/ws-replication-issue449-gamma-reconcile-chunked.test.ts` **逐字命中**；夹具 `issue447-async-seam.ts` 同规则不入采集（非 `*.test.ts`），仅作被导入模块。
- **本报告实跑的入口**（证明契约的验证面真实可触发）：
  - `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication/test` ⇒ **101 文件 / 897 用例**、exit 0（`-package-suite.log`）；
  - 四文件 γ 套件 ⇒ 43/43、exit 0（`-baseline-gamma-suites.log`）；
  - `npx tsc -p packages/ws-replication/tsconfig.json` ⇒ exit 0（`-package-tsc.log`）；
  - 探针：`NODE_OPTIONS=--conditions=nomicore-source npx tsx .scratch/sa6-issue449-probe.ts` ⇒ 7/7 PASS、exit 0（收尾删除，§16）。
- 无 `test.only`/`skip`/`todo`；无 env override（`--conditions=nomicore-source` = 仓库 `package.json` 既有测试脚本同款条件导出选择）；探针零真实 timer/网络/长驻服务。

---

## 15. Unknowns and blockers

1. **【派工纪律的后果】本 dispatch 禁止编写可执行测试**：本报告交付「契约规格 + 诊断证据」，§12.3 矩阵的测试工件**尚未落盘**。设计阶段须裁定落盘责任与时机（建议承接 #448 先例：SA3 按本契约落盘测试 + 夹具零改动 + 证据日志，SA6/SA7 复跑）。这**不**构成契约不可信——条目判据、最小输入、负控与预期红/绿均已由探针在 HEAD 实证可执行（§5/§6）。
2. **【移交设计阶段的裁定项 A】`drain 第三触发点` 的行为面非承重**：`hub-session-async-host.ts:176` 的触发点③结构性在场，但在现态机下**无可观察行为差**（P-C 隔离变异轨迹逐值不变；机理：末 chunk 回执只回填锚/清 `pendingLastChunkTag`，载体仍 `awaiting-ack`，`sendFacet` 仲裁 `bulkTransfer.hasWork()` 挡住 channel 路径；kind=0 侧 `channel.onReceipt` 返回值被 `onSendReceipt` 忽略且 rekey 不释放槽位）。若要让触发点③承重，必须改动 §24.4 明文（回执 tag→seq **换键不换槽** = 占用守恒）或 facet 仲裁语义 —— **不建议**在本票做行为变更；建议设计登记为「dormant 保险丝（规范超集）」，契约以 `DRAIN3-C1/D1` 锚定其现态边界。
3. **【裁定项 B】#449 = verification-only（零生产改动）**：AC1–AC6 目标行为已由 T1 交付（§8）。SA1/SA8 需在设计记录中确认或提供反证；若裁定仅验收，则 §12.3 矩阵即最终交付物，SA3 无需生产实现。
4. **【裁定项 C】`ROUND3-C3` 编排细节**：pending 面负控需「步进放行至队列头 = 末 chunk 回执 → `reorderNext()` → `release(1)`」的在场断言（reorderNext 语义 = 下一次 release 交换缓冲前两条，`issue447-async-seam.ts:193-198`）。机制有 `LIVE-ORD-C2` 先例且 P-A/P-F 证明判别面，但**具体步进脚本未落盘**（本 dispatch 禁写测试）——落盘时须断言交换点（队列头/次位）以防编排漂移假绿。
5. `ABORT3-*` 与 #450 的边界（revoke/close 冲刷/1011）已在 §12.2 登记；`DRAIN3-D1` 为诊断条目，不是行为要求。
6. **本报告证据的临时性**：P-A…P-G 的运行时证据来自临时探针（收尾删除）；落盘测试须重新建立同等证据（§16 记录删除）。

---

## 16. Temporary diagnostics cleanup

- **生产实现零改动**：`git status --porcelain` 实查 = 新增 `artifacts/sa6-issue449-*.log`（5 份证据日志）+ 本报告；`packages/ws-replication/src/**`、`docs/**`、`CONTEXT.md`、模块 `AGENTS.md`、`replication-protocol/**`、根配置、lockfile、既有 `*.test.ts`/夹具**零 diff**。
- **零测试工件**：未创建/修改任何 `*.test.ts`/`*.test-d.ts`/fixture（dispatch 纪律）。
- **临时探针已删除**：`.scratch/sa6-issue449-probe.ts` 及 6 个调试脚本（`-debug*.ts`）在收尾前删除；证据以 `artifacts/sa6-issue449-probe.log` / `-probe-repeat3.log` 保留（日志为运行记录，非可执行工件）。
- **无长驻资源**：零 `nohup`/`setsid`/PID 文件/后台服务；全部命令前台有界完成，job 无遗留。
- **变异恢复**：P-C 的 `BulkTransferSender.prototype.onReceipt` 变异在 `finally` 恢复原型（探针进程结束即消失，无跨用例污染）。
- **收尾复跑**：探针 3/3 全绿；γ 套件 43/43 绿；包全量 101/897 绿；包 tsc exit 0（§4/§13/§14）。

---

### 附：本次实跑命令（可复现）

```bash
pnpm install --frozen-lockfile
NODE_OPTIONS=--conditions=nomicore-source npx vitest run \
  packages/ws-replication/test/ws-replication-issue447-async-session-round.test.ts \
  packages/ws-replication/test/ws-replication-issue447-async-seam-fixture.test.ts \
  packages/ws-replication/test/ws-replication-issue447-async-session-api.test.ts \
  packages/ws-replication/test/ws-replication-issue448-live-data-plane.test.ts
NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication/test
npx tsc -p packages/ws-replication/tsconfig.json
# 临时探针（收尾已删除；此处仅记录证据生成方式）
NODE_OPTIONS=--conditions=nomicore-source npx tsx .scratch/sa6-issue449-probe.ts
```
