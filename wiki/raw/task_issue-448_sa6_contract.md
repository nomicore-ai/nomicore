# SA6 诊断与验收契约 — issue #448（γ-T2）：γ 异步缝的 live update 数据面（pending 窗口记账、ACK 结算与保序契约锚）

- Dispatch：`sa-8df459cc-efac-424d-8f5b-87f1fbb2c096`（mabf-sa6 / acceptance-contract / iteration 0）
- 任务类型：**Feature 的反向诊断**（能力已在 HEAD 由前序票 #447 整体交付，无剩余生产实现缺口）⇒ 本票可诚实交付的契约 = **绿色验收 / 回归契约**（可执行锚 + 负控 + 变异敏感性证据），**不伪称红灯**。先例：`wiki/raw/task_issue-316_sa6_contract.md`（「Feature 的验收/回归契约（能力在 HEAD 已整体交付，无剩余能力缺口）」→ `approve`）。
- Baseline worktree：`/home/wangjian/nomicore-fix-issue-448`，branch `mabf/issue-448`，HEAD `321d951`（`Merge pull request #453 from nomicore-ai/mabf/issue-447`；T1 实现 commit = `52e634b` `feat(ws-replication): add gamma async session host`）。
- 结论：**`verdict: approve`** —— 诊断稳定（六条 AC 的行为面逐条核码 + 13 条运行时断言全绿）、契约可执行、测试入口真实、负控六条全绿且变异敏感性已证；但**诊断方向是反向的**：#448 的 AC1–AC6 目标行为在 HEAD 已全部落地（由 #447 的变更集交付，非本票待实现面），因此移交设计阶段的裁定项 = **本票为 verification-only（零生产实现面）**（§15-1）。

---

## 1. Task type and inputs

| 输入 | 路径 | 状态 / 关键内容 |
|---|---|---|
| Host 任务简报 | `wiki/raw/task_issue-448.md` | 在场；Issue #448 body：What-to-build + AC1–AC6 + `Blocked by #447` + Parent PR #446；Comments 空 |
| Owner comments | 派工明示「current Issue comments … returned an empty array」；简报 §Comments 亦为空 | **无 owner 追加要求**——需求全集 = Issue body 6 条 AC + ADR 0032 附录 A4 / 协议 §24（§2） |
| `task_issue-448_relevant_decisions.md` | `wiki/raw/` | **不存在**（本任务未生成；非阻塞） |
| `task_issue-448_conflict_report.md` | `wiki/raw/` | **不存在**（本任务未生成；非阻塞） |
| SA8 产物（#448） | `wiki/raw/`、`artifacts/` | **不存在**（除简报外无任何 #448 产物；§3 以规范权威 + 前序票设计/评审为可执行约束） |
| 前序票设计（唯一实现出处） | `wiki/raw/task_issue-447_design.md`（D4/D6/D9/D10/D11、§8.5–§8.9） | 在场；γ 数据面（`pendingSends` 两相记账 / selfDrain 三触发点 / t0 推送时刻 / ackTimeout 有界性）已列入 #447 变更集 |
| 前序票验收契约（红灯出处） | `wiki/raw/task_issue-447_sa6_contract.md`（ROUND/PEND/ANCHOR/CHUNK/TD 族） | 在场；#447 的绿灯沿革 |
| 前序票 spec 终审 | `wiki/raw/task_issue-447_sa10_spec.md` §2/§3 | 在场；AC3（pending 两相记账）/AC4（FIFO 夹具）/§24.4/§24.6/§24.8 判定 MET 的独立复核 |
| 规范权威 | `docs/adr/0032-transport-decoupling-edge-session-split.md:55-99`（附录 A4）、`docs/protocols/instance-replication-v1.md:1091-1154`（§24） | 已读原文；本票六条 AC 的规范依据 |
| 模块规约 | `packages/ws-replication/AGENTS.md`（缝纪律段 + Verification 段）、根 `AGENTS.md` | 已读；γ append-only 纪律与验证门 |
| 相邻票（边界） | `git`/`gh` 实读： #449（γ-T3 reconcile + 分块 transfer；`Blocked by #448`）、#450（γ-T4 流控/生命周期）、#451（γ-T5 观测面 + 全量回归） | 本票与 T3/T5 的分工见 §12.2 边界登记 |

**范围界定（in scope）**：γ 缝上 **live update 数据面**的六条 AC 的运行时锚——data 帧 pending/receipt 两相记账、`maxInFlightUpdates` 上界（延迟注入）、回执先于 live `UPDATE_ACK` 的保序与 `onAck` 三类判别、自驱 drain 触发点与禁 busy loop、`update-acked` 发射点与 `ackLatencyMs` t0、live update 成功路径与 β wire 等价。
**不在范围（out of scope）**：分块 kind=1/2 全回合与 drain 第三触发点（#449）、连接账本 1011 / close 冲刷 / revoke（#450）、`update-sent` 总归属与根门禁全量回归（#451）、任何生产实现改动（本票零生产面，§15-1）。

---

## 2. Owner comment mapping

- 派工明文：本 Issue 的 comments 经 REST endpoint 读取为空数组；简报 `## Comments` 亦为空 ⇒ **无 owner 追加要求可映射**。
- Owner 要求 = 简报正文 6 条 AC（+ Parent PR #446 的设计工件）。AC → 契约条目 → HEAD 状态：

| Issue AC | 契约条目（§12.3） | HEAD 状态 | 依据 |
|---|---|---|---|
| AC1 data 面 pending/receipt 全链；在途记账精确（无伪造序号、无 pending 泄漏） | LIVE-WINDOW-C1/C2、LIVE-DRAIN-C1、LIVE-ORD-C1 | **已满足**（绿） | §5、§8 |
| AC2 pending 计入 `maxInFlightUpdates`；乐观发送不击穿上界（延迟注入锚） | LIVE-WINDOW-C1/C2（+ C3 变异负控） | **已满足**（绿） | §5-E1、§6 |
| AC3 保序锚：回执恒先于对应 `UPDATE_ACK`；`onAck` 三类判别与单体同构 | LIVE-ORD-C1/C2、LIVE-ACK-C1/C2/C3 | **已满足**（绿） | §5-E3/E4 |
| AC4 自驱 drain 两触发点（入队 / ACK）；无 busy loop（不新增轮询定时器） | LIVE-WINDOW-C1/C2、LIVE-DRAIN-C1/C2 | **已满足**（绿） | §5-E5 |
| AC5 `update-acked` 发射点与 `ackLatencyMs` t0 口径锚（= 协议 §24.8） | LIVE-ACK-C1（+ 变异负控）、LIVE-OBS-C1 | **已满足**（绿） | §5-E2/E6 |
| AC6 live update 成功路径与 β wire 逐字节等价 | LIVE-PARITY-C1、LIVE-PARITY-NC1 | **已满足**（绿） | §5-E7 |

---

## 3. SA8 constraints

- #448 **无 SA8 产物**（`relevant_decisions` / `conflict_report` / design 均缺席，实查 `wiki/raw/` 与 `artifacts/`）⇒ 可执行约束取自规范权威与前序票冻结面，逐条如下：

| 约束 | 出处 | 本契约落点 |
|---|---|---|
| 宿主传输义务：每会话一对专用通道；每方向 FIFO；**回执在盖章点同步投递**；违契响亮收口 | 协议 §24.2 / ADR A4.2 | LIVE-ORD-C1（消费序配对）、LIVE-ORD-C2（乱序 = 违契⇒响亮） |
| 两相记账：pending 自推送占窗；回执 tag→seq **换键不换槽**；三态锚 | 协议 §24.4 / ADR A4.2 | LIVE-WINDOW-C1/C2（rekey 中间态）、LIVE-ACK-C1 |
| 流控单点 edge、session 乐观发送（`dataGateOpen ≡ true`） | 协议 §24.5 / ADR A4.3 | LIVE-WINDOW-C1/C2（乐观发送不越上界）、LIVE-DRAIN-C2 |
| pacing：自驱 drain 触发点 = 入队 / ACK（+ transfer 末 chunk 回执）；推完即停、禁 busy loop | 协议 §24.6 / ADR A4.4 | LIVE-DRAIN-C1/C2（含时间推进零驱动、计时器面不增） |
| 观测口径：`update-sent` 在 edge 盖章点；`update-acked`/chunked 族在 session 结算点；`ackLatencyMs` t0 = 推送时刻；跨线程事件无全序 | 协议 §24.8 / ADR A4.7 | LIVE-ACK-C1、LIVE-OBS-C1（单事件字段值；**零事件序断言**） |
| 成功路径与 β wire 等价；数据帧内容判据 = #424 ORACLE-2（Yjs clientID/clock 随机 ⇒ 文档语义） | ADR A4.8 / #424 先例 | LIVE-PARITY-C1 / NC1 |
| γ 缝词汇闭集合**无 accounting 字段**（`sendQueueMs` 整键缺席为登记缺面） | 协议 §24.3 + T1 设计 D9 | LIVE-OBS-C1（`not.toHaveProperty('sendQueueMs')`）；§15-3 登记 |
| 模块验证门：每个改动的状态机路径要有聚焦测试；缝变更另跑 edge/session 契约与 wire parity | `packages/ws-replication/AGENTS.md`「Verification」 | §14（runner 采集 + 包全量 101 文件 / 897 用例绿） |

---

## 4. Environment and baseline

- 环境：`node v24.13.0`、`pnpm 10.28.2`、`vitest 3.2.7`、`typescript 5.9.3`；worktree 初始**无 `node_modules`**，执行 `pnpm install --frozen-lockfile`（65 包，lockfile 零改动）。
- HEAD 基线（本票改动前）实跑：
  - γ 前序票套件（`ws-replication-issue447-async-session-round|async-seam-fixture|async-session-api`）= **30/30 绿**（含 PEND-C1/C2/C3 数据面窗口族、ANCHOR-C1/C2）；
  - 包全量（排除本契约：`npx vitest run packages/ws-replication/test --exclude '**/ws-replication-issue448-live-data-plane.test.ts'`）= **100 文件 / 884 用例绿**；含本契约 = **101 文件 / 897 用例**（884 + 13），两条口径均 `Type Errors no errors`（`artifacts/sa6-issue448-package-suite-precontract.log` / `-package-suite.log`）。

---

## 5. Positive reproduction（目标行为的运行时复现；13 条全绿）

所有断言均为**运行时行为**（wire 帧 kind/序 / `[8..12]` 原始字节 / `ackedSequence` 回指 / 缝消息**消费序** / observer 单事件字段值 / 文档收敛值）；零源码 grep、零 skip/only/todo、零 env override。契约文件：`packages/ws-replication/test/ws-replication-issue448-live-data-plane.test.ts`（夹具 `packages/ws-replication/test/issue448-live-seam.ts`，装配面复用 #447 `issue447-async-seam.ts`）。

| 实验 | 编排（最小输入 / 延迟注入） | 观察到的目标行为 |
|---|---|---|
| E1 `LIVE-WINDOW-C1/C2` | `maxInFlightUpdates=2` + 扣留 `edgeToSession`；hub 本地写 ×3（43/44/45） | 恰 **2** 帧过缝（pending 自推送占窗）；只放回执 ⇒ **换键不换槽**（仍 2 帧、零 `update-acked`）；放 ACK ⇒ 自驱 drain 推出第 3 帧；4 笔全结算后第 4 笔直推（**无 pending 泄漏**）；每笔 receipt.sequence === 该 tag 帧的盖章序（**无伪造序**） |
| E2 `LIVE-ACK-C1` | 推送 → 推进 `k=7` → 只放回执（登记）→ 推进 `m=5` → 放 ACK | `update-acked` 恰一次、`sequence` = wire 序、**`ackLatencyMs = k+m = 12`**（t0 = 推送时刻，含管道 + edge 等待）；回执登记点零事件 |
| E3 `LIVE-ORD-C1` | 同 E2 的步进放行 | 入站通道 `delivered()` 消费序中：`receipt{sequence=s}` 的序位 **strict 先于** 解码为 `UPDATE_ACK{ackedSequence=s}` 的帧序位；零响亮信号 |
| E4 `LIVE-ACK-C2/C3` | C2：丢弃回执 + 直投 ACK；C3：ackTimeout 弃置后放迟到回执 + 迟到 ACK | C2：`connection-fatal{ACK_STATE_VIOLATION}` 响亮收口、零结算（violation 判别）；C3：`RESYNC_REQUIRED` 恰一次、迟到 ACK 落 **zombie**（零 fatal、零该序 `update-acked`） |
| E5 `LIVE-DRAIN-C1` | kind=0 分块 live update（`chunkedUpdate:true`、`maxUpdateBytes=16`）+ 扣留；`maxInFlightUpdates=1` | 入队触发点：整只 transfer 逐 chunk 过缝（≥2 chunk、单一 transferId、chunkIndex 0..n-1）**只占 1 个窗口槽**；第 2 笔不推进；末 chunk 回执结算 + ACK ⇒ `chunked-update-sent`/`chunked-update-acked` 各恰一次、无 `sequence` 键、**`ackLatencyMs = k+m = 10`**；`UPDATE_ACK` 回指末 chunk 帧序 |
| E5′ `LIVE-DRAIN-C2` | 扣留 + `scheduler.advanceBy(100)`（< ackTimeoutMs）+ 重复泵 ×4 + 窗口满再入队 | 时间推进**零**新数据帧、`scheduler.pending()` **不增**（不新增轮询定时器）；重复泵不越窗口上界；结算后推完即停（额外泵零新增帧） |
| E6 `LIVE-OBS-C1` | session + edge 双侧 observer（同一 recorder） | `update-sent` 恰一次，`sequence` = edge 盖章 wire 序、`bytes` = UPDATE 载荷长、**无 `sendQueueMs`**（§24.3 闭集合登记）；`update-acked` 恰一次、`sequence` = 同一 wire 序 |
| E7 `LIVE-PARITY-C1` | 同场 β（`issue424` sharded 同步缝）vs γ：同为 live 后写 `{n:43}` | 两方向**控制帧逐字节等**；**全轨迹骨架 `kind#sequence` 逐方向全等**（含 live UPDATE / UPDATE_ACK 的序位）；数据帧**文档语义等**；双 hub ROOT 快照逐值等、peer 收敛 43 |

**契约的全部条目在 HEAD 即为绿**（§13）：这不是红灯契约，而是本票 AC 的**验收 + 回归哨兵**。

---

## 6. Negative control

| # | 负控 | 断言 | 结果 |
|---|---|---|---|
| NC-1 | `LIVE-ORD-C2`：宿主违契注入 `reorderNext()`（ACK 先于回执投递） | 响亮 `connection-fatal{ACK_STATE_VIOLATION}`；零静默接受、零结算 | 绿（证明保序条款是承重约束而非恒真断言） |
| NC-2 | `LIVE-ACK-C2`：`dropReceipts(1)` + 直投 ACK（序未登记即被引用） | 响亮 `ACK_STATE_VIOLATION`；零 `update-acked` | 绿 |
| NC-3 | `LIVE-ACK-C3`：ackTimeout 弃置后迟到回执 + 迟到 ACK | zombie 良性：零 fatal、零该序结算、`RESYNC_REQUIRED` 恰一次 | 绿 |
| NC-4 | `LIVE-WINDOW-C3 变异负控`：`UpdateChannel.effectiveInFlightCount` 退回 **β 裸占用口径**（不计 `pendingSends`） | 变异下第 3 帧越过 `maxInFlightUpdates=2` 上界（= 3 帧过缝）⇒ 正测试「恰 2 帧」必红 | 绿（**断言对 pending 占窗敏感**；`finally` 恢复生产代码，零残留） |
| NC-5 | `LIVE-ACK-C1 变异负控`：`UpdateChannel.onReceipt` 在 rekey 时以当前钟重采样 `sentAt`（=「t0 = 回执时刻」等价实现） | 变异下 `ackLatencyMs = m = 5`（应得 `k+m = 12`）⇒ 正测试必红 | 绿（**断言对 t0 推送边界采样敏感**） |
| NC-6 | `LIVE-PARITY-NC1`：γ 侧写值变异（43 → 44） | 控制帧仍逐字节等（不承载数据内容 = 正确判据），**文档语义比对必报差异** | 绿（**parity 判据非恒真**） |
| NC-7 | `LIVE-DRAIN-C2`（兼作边界负控） | 时间推进 / 重复泵零新帧、计时器面不增 | 绿（**无 busy loop / 无轮询定时器**） |

零负控失败；无伪红/伪绿（无 skip/only/todo/env override/fallback；变异负控只改内存中的 prototype 并在 `finally` 恢复）。

---

## 7. Stability, scale and timing

- **确定性**：延迟注入 = 夹具显式 `release()`（零真实 timer、零 wall-clock、零 `sleep`）；时源 = `makeManualClock`（`clock.advance` 精确决定 t0/t1）；跨线程异步性 = 微任务泵（`pumpUntil`/`settleUntil`），无竞态窗口。
- **重复性**：契约文件连续 5 次运行 **5/5 绿（13 用例/次）**，见 `artifacts/sa6-issue448-repeat5.log`。
- **规模/时序条件**：窗口上界取小值（1/2）以在最小步数内到达边界；分块构型以小限额注入（`maxUpdateBytes=16`、`maxChunkedUpdateBytes=1024`）使小载荷真实走 kind=0 改道；扣留窗口时长由 `k`/`m` 两个虚拟毫秒量精确控制（不依赖真实时间）。
- **性能/规模面**：本票无性能断言（非目标）；内存安全链与 1011 收口属 #450 范围（§15-4）。

---

## 8. Capability gap / root-cause chain（反向诊断）

**结论：本票不存在剩余生产能力缺口；AC1–AC6 的目标行为在 HEAD 已由前序票 #447 交付，剩余缺口是"锚覆盖"（verification gap），已由本契约闭合。**

| Step | 事实 | Evidence | Confidence |
|---|---|---|---|
| S1 | 本票 baseline = HEAD `321d951`（含已合并的 T1：`52e634b` `feat(ws-replication): add gamma async session host`） | `git log`；`hub-session-async-host.ts` 唯一来源 commit = `52e634b` | 高 |
| S2 | **T1 之前**（`c86ccbc`，spec 分支基线）γ 公共面与夹具均不存在：`src/index.ts` 零 `createHubAsyncSessionHost`、仓库零 `issue447-async-seam` 文件 | `git show c86ccbc:packages/ws-replication/src/index.ts \| grep -c` = 0；`git show c86ccbc --name-only \| grep -c` = 0 | 高 |
| S3 | T1 变更集**按设计**落地了本票的数据面机械（数据面两相记账、`selfDrain` 三触发点、t0 推送时刻、ackTimeout 合并占用判据） | `wiki/raw/task_issue-447_design.md` D4（`pendingSends`）/D6（selfDrain）/D9（t0）/D10（占用判据）/§8.6；T1 SA6 契约 PEND 族；SA10 §2 AC3/AC4、§3 §24.4/§24.6/§24.8 判定 MET | 高 |
| S4 | HEAD 生产面逐符号具备：tag 分配/校验（`hub-session-async-host.ts:96,161,256`）、两相记账（`update-channel.ts:135,169,198,450`）、窗口双判据（`:261,:513`）、`onAck` 三类判别（`:287`）、自驱 drain（`hub-session-async-host.ts:152,176,221-222,271`）、`update-acked` 发射点（`hub-namespace.ts:1416`） | §10 表（源码符号行号） | 高 |
| S5 | 目标断言在 HEAD 全绿（13/13；E1–E7），且负控/变异证明断言有牙（NC-1…NC-7） | §5/§6；`artifacts/sa6-issue448-contract-run.log`、`artifacts/sa6-issue448-repeat5.log` | 高 |
| S6 | 剩余缺口 = 本票 AC 专属场景此前**无运行时锚**（T1 的 PEND 族只覆盖窗口/超时；live `UPDATE_ACK` 的保序编排、live `update-acked` 的 k+m 锚、live 成功路径的 β parity、边缘观测归属皆缺） | 本契约文件新增 13 条；`git status` 显示此前无 `issue448-*` 工件 | 中-高 |

**症状 → 直接故障点 → 触发条件 → 最深根因**（反向读法）：症状 = 「#448 的 AC 看似待实现」；直接事实 = T1 的实现面**已含**数据面（共享机械：`UpdateChannel` 单份实现 + `asyncSendTickets` 单点置位）；触发条件 = `/to-tickets` 切片规划时 T1 的 AC 只写「控制面先行」，实现却按设计 D4/D6 连带落地数据面分支；最深根因 = **票切片与实现面重叠**（T1 过度交付 / T2 生产面被前序吸收），非代码缺陷。**本报告不虚构 Bug 根因**。

---

## 9. Causal experiments（控制变量）

| 实验 | 变量 | 对照 | 结论 |
|---|---|---|---|
| X1 窗口上界 | 扣留/放行回执与 ACK（时间与顺序） | `maxInFlightUpdates=2`，写 3 笔 | 过缝帧数 = 已结算槽位数 + 上界（step function）：推送占窗、rekey 不释放、ACK 释放 ⇒ **上界是结算释放的函数，不是时间/泵次数的函数** |
| X2 t0 语义 | `k`（推送→回执）与 `m`（回执→ACK）两段虚拟延迟 | 正实现 vs NC-5 变异（回执时刻重采样） | 正实现 `= k+m`（含管道等待），变异 `= m` ⇒ **t0 = 推送时刻**，断言对该采样点敏感 |
| X3 保序 | 投递顺序（FIFO vs `reorderNext`） | 正序 vs 乱序注入 | 正序：回执先消费 ⇒ 结算 `ok`；乱序：`onAck` 见未登记序 ⇒ **响亮 violation**（不回退、不 park） |
| X4 三类判别 | ACK 前置条件（已登记 / 已弃置 / 未登记） | E2 / NC-3 / NC-2 | `ok` / `zombie` / `violation` 三态与单体内核**同一份** `UpdateChannel.onAck` 实现（零分叉） |
| X5 drain 归因 | 触发源（入队 / ACK / 时间 / 泵次数） | E1 的第 3 帧、E5 的 transfer、E5′ 的时间推进与重复泵 | 只有「入队 / ACK（/ 末 chunk 回执）」推进发送；**时间与额外泵不产生任何帧** ⇒ 推完即停、无 busy loop |
| X6 观测归属 | observer 注入位置（仅 session / session+edge） | E6 | `update-sent` 只在 edge（sequence = wire 序、无 `sendQueueMs`）；`update-acked` 只在 session ⇒ §24.8 双侧归属可执行锚定（跨线程事件序零断言） |
| X7 β/γ 等价 | 同一业务写（live `{n:43}`） | β sharded 同步缝 vs γ 异步缝；NC-6 内容变异 | 控制帧字节等 + 骨架等 + 文档语义等；NC-6 证明判据对内容敏感 ⇒ **live update 成功路径 wire 等价** |

---

## 10. Impact surface（本契约的证据触点）

| 面 | 符号 / 行（HEAD） | 与本票 AC 的关系 |
|---|---|---|
| 缝句柄：tag 分配 / 回执入口 / 信号 | `src/hub-session-async-host.ts:96`（`tagCounter`）、`:161`（`handleReceipt`：非法序/未知 tag ⇒ 响亮）、`:256`（`emitSeam`） | AC1（无伪造序） |
| 自驱 drain（三触发点） | `src/hub-session-async-host.ts:152`（入站消息后 = ACK 超集）、`:221-222`（入队 / requestDrain）、`:176`（末 chunk 回执，T3 范围）、`:271`（`while(pullAndSendOne())`） | AC4 |
| 两相记账 / rekey / 窗口 | `src/update-channel.ts:135`（`pendingSends`）、`:169`（`effectiveInFlightCount` 含 pending）、`:198`（`onReceipt` rekey）、`:261`（deliver 窗口判据）、`:450`（`sendAndRegister` async 分支）、`:513`（`pullAndSendOne` 窗口判据）、`:585`（末 chunk async 分支） | AC1/AC2 |
| ACK 结算 / 判别 / 时延 | `src/update-channel.ts:287`（`onAck` ok/zombie/violation）、`:303-312`（`latencyMs = t1 - sentAt`）、`src/hub-namespace.ts:1162`（`onUpdateAck` 漏斗）、`:1416`（`update-acked` 发射点） | AC3/AC5 |
| 回执 fan-out | `src/hub-session.ts:309-315`（`onReceipt` 按通道键 fan-out）、`src/hub-namespace.ts:738-746`（`onSendReceipt`：UpdateChannel rekey + bootstrap 锚 + round 锚 + bulk transfer 结算，返回是否结算末 chunk） | AC1 |
| edge 盖章点观测 | `src/hub-edge.ts:852-868`（`emitUpdateSentAtStamp`：sequence = `[8..12]`、`sendQueueMs` 仅记账投影在场时携带） | AC5/§24.8（T5 共享锚） |
| 契约工件（本票新增） | `packages/ws-replication/test/ws-replication-issue448-live-data-plane.test.ts`（13 用例）、`packages/ws-replication/test/issue448-live-seam.ts`（夹具）、`packages/ws-replication/test/issue447-async-seam.ts`（**append-only 10 行**：可选 `edgeObserver` 注入面，缺省零传） | AC1–AC6 |

---

## 11. Ruled-out hypotheses

| # | 假设 | 判定 | 证据 |
|---|---|---|---|
| H1 | live update 数据面（pending/回执/rekey）在本票 baseline 未实现 | **排除** | E1 全绿；符号 S4；T1 设计 D4/§8.6 |
| H2 | `ackLatencyMs` 的 t0 被采在回执/结算时刻（口径漂移） | **排除** | E2 = `k+m`；NC-5 变异下才退化为 `m` |
| H3 | 乐观发送（γ `dataGateOpen ≡ true`）可击穿 `maxInFlightUpdates` | **排除** | E1 恰 2 帧；NC-4 变异下才越界 |
| H4 | session 可能在回执登记前消费 `UPDATE_ACK`（静默接受/失败恢复） | **排除** | E3 消费序配对；NC-1 乱序注入 ⇒ 响亮 `ACK_STATE_VIOLATION`（零 park） |
| H5 | 自驱 drain 存在 busy loop 或新增轮询定时器 | **排除** | E5′：`advanceBy(100)` 零新帧、`scheduler.pending()` 不增；重复泵零新帧 |
| H6 | live update 成功路径与 β wire 不等价（多帧/丢帧/序位漂移） | **排除** | E7：控制帧字节等 + 全轨迹骨架等 + 文档语义等；NC-6 判据有牙 |
| H7 | γ 的 kind=0 分块 live update（`sendOneChunk` async 分支）不可用 | **排除** | E5 全绿（≥2 chunk、每 chunk 独立 tag/回执、末 chunk 结算、事件语义不变） |
| H8 | `update-acked` 事件泄漏 session 域 tag（当作 sequence） | **排除** | E6：`update-acked.sequence` === wire 序（与 edge 盖章值一致） |
| H9 | `update-sent` 在 γ 下不可观察（edge 无 observer 注入面） | **排除（生产面）** | `createHubReplicationEdge` 接受 `observer`（`hub-edge-host.ts:165/924`）；夹具此前未接（本票 append-only 补 `edgeObserver` 注入面）⇒ E6 绿 |

---

## 12. Acceptance contract and test paths

### 12.1 契约工件（worktree-relative）

| 工件 | 作用 |
|---|---|
| `packages/ws-replication/test/ws-replication-issue448-live-data-plane.test.ts` | **验收契约本体**：13 条（LIVE-WINDOW-C1/C2/C3、LIVE-ORD-C1/C2、LIVE-ACK-C1(+变异负控)/C2/C3、LIVE-OBS-C1、LIVE-DRAIN-C1/C2、LIVE-PARITY-C1/NC1） |
| `packages/ws-replication/test/issue448-live-seam.ts` | #448 夹具：boot adopt 装配 + 观测投影 + 双侧 observer 装配（零协议决策，#447 纪律） |
| `packages/ws-replication/test/issue447-async-seam.ts`（**+10 行，append-only**） | 可选 `edgeObserver` 注入面（缺省零传 = #447 行为逐字不变）；T1 30 用例复跑全绿 |
| `artifacts/sa6-issue448-contract-run.log` / `-repeat5.log` / `-package-suite.log` / `-package-suite-precontract.log` / `-package-tsc.log` | 运行证据 |

### 12.2 边界登记（与相邻票的分工）

- **#449（T3）**：kind=1/2 全回合、`ownStep2Seq` 三态、SYNC_APPLIED 保序锚、**drain 第三触发点**。本契约的 `LIVE-DRAIN-C1` 只锚定 kind=0 live update 的**数据面切片**（窗口占位 + 末 chunk 结算 + 事件语义），不重复 T3 的 sync/bootstrap 全回合。
- **#450（T4）**：账本 1011、close 冲刷 pending、`terminateUnauthorized`、OPEN 水位。本契约不涉。
- **#451（T5）**：`update-sent` 总归属 + test-d 复核 + 根门禁全量回归。本契约的 `LIVE-OBS-C1` 是 live 数据面切片（T5 共享），不替代 T5 的归属矩阵。
- **登记缺面（非缺口）**：γ `update-sent` 无 `sendQueueMs`（协议 §24.3 闭集合无 accounting 字段；T1 设计 D9 登记「整键缺席」）——契约以 `not.toHaveProperty` 固化该登记，不主张其为待实现面。

### 12.3 契约清单（最小输入 / 可观察断言 / 负控 / 旧实现预期 / 目标实现预期）

| 条目 | 最小输入 | 可观察断言 | 负控 | 旧实现（pre-T1 `c86ccbc`） | 目标实现（HEAD） |
|---|---|---|---|---|---|
| C1 `LIVE-WINDOW-C1/C2` | `maxInFlightUpdates=2`；扣留；写 ×3 | 恰 2 帧过缝；放回执不释放槽（仍 2）；放 ACK 后第 3 帧；第 4 笔直推；receipt≡盖章序 | NC-4 变异（裸占用 ⇒ 3 帧） | **红**（无 γ 公共面/夹具，不可装配） | 绿 |
| C2 `LIVE-ORD-C1` | 步进放行（回执→ACK） | 回执消费序 strict 先于引用其序的 `UPDATE_ACK`；登记点零结算 | NC-1（乱序 ⇒ 响亮） | **红**（同上） | 绿 |
| C3 `LIVE-ACK-C1` | `k=7`、`m=5` | `update-acked` 恰一次；`sequence`=wire 序；`ackLatencyMs=k+m` | NC-5 变异（回执时刻 ⇒ `m`） | **红**（同上） | 绿 |
| C4 `LIVE-ACK-C2/C3` | 丢回执直投 ACK / ackTimeout 弃置 + 迟到 | violation 响亮；zombie 良性零结算 | 互为正负对照 | **红**（同上） | 绿 |
| C5 `LIVE-OBS-C1` | session+edge 双侧 observer | `update-sent`（edge，wire 序，无 `sendQueueMs`）/ `update-acked`（session，同序） | —（与 E7 交叉） | **红**（edge 工厂不存在） | 绿 |
| C6 `LIVE-DRAIN-C1/C2` | kind=0 改道（16B 限额）+ 扣留；`advanceBy(100)` | 逐 chunk 过缝（占 1 槽）；`chunked-update-*(sent/acked)` 恰一次；时间推进零帧、计时器面不增 | NC-7（时间/重复泵） | **红**（同上） | 绿 |
| C7 `LIVE-PARITY-C1/NC1` | β vs γ 同场写 `{n:43}` | 控制帧字节等 + 骨架等 + 文档语义等；NC 内容变异必报差异 | NC-6 | **红**（同上） | 绿 |

> 「旧实现预期」列的历史红取自 T1 的既有证据（`task_issue-447_sa6_contract.md` 红灯契约 + `task_issue-447_design.md`），并由 git 级事实复核（S2：`c86ccbc` 零 γ 公共面/夹具）；本契约在**本票 baseline（HEAD）** 上是绿 —— 不伪称红灯。

---

## 13. Red/green or baseline evidence

- **本票 baseline（HEAD `321d951`）**：契约 13/13 绿（`artifacts/sa6-issue448-contract-run.log`）；连续 5 次复跑 5/5 绿（`-repeat5.log`）。
- **回归面**：T1 三文件 30/30 绿 + 本契约 13 = 43/43（`npx vitest run <4 files>`）；**包全量 101 文件 / 897 用例全绿、`Type Errors no errors`、exit 0**（`-package-suite.log`）；包 tsc exit 0（`-package-tsc.log`）。
- **红灯的诚实替代（敏感性证据）**：NC-4/NC-5 以变异把正断言逼红（窗口上界、t0 采样点），NC-1/NC-2 以宿主违契注入逼出响亮收口，NC-6 以内容变异逼出 parity 差异 —— 证明本契约对「pending 占窗」「t0 推送边界」「保序」「数据内容」四类核心行为**有判别力**（不是恒真断言）。
- **历史能力缺口**：pre-T1 `c86ccbc` 无 `createHubAsyncSessionHost`、无 γ 夹具（S2）；T1 `52e634b` 交付后本契约方可装配 ⇒ 本票 AC 的「能力缺口」在历史上存在、在 baseline 上已被前序票闭合。

---

## 14. Runner trigger evidence

- **采集面**：根 `vitest.config.ts` `test.include = ['packages/*/test/**/*.test.ts', …]` —— 本契约文件名与路径**逐字命中**；夹具 `issue448-live-seam.ts` 与 #447 夹具同规则不入采集（非 `*.test.ts`），仅作被导入模块。
- **实跑采集**：`npx vitest run packages/ws-replication/test`（全目录）= **101 文件 / 897 用例**，含本契约 13 条；`npx vitest run packages/ws-replication/test/ws-replication-issue448-live-data-plane.test.ts` = 1 文件 / 13 用例。
- **类型门**：`npx tsc -p packages/ws-replication/tsconfig.json`（`include = src/**/*.ts + test/**/*.ts`）exit 0（含新增两文件）。
- 无 `test.only`/`skip`/`todo`；无 env override；无真实 timer/网络/服务（`job` 未启动任何长驻进程）。

---

## 15. Unknowns and blockers

1. **【移交设计阶段的裁定项】本票无剩余生产实现面**：AC1–AC6 的目标行为已由 #447 交付（§8）。SA1/SA8 需在设计记录中明确「#448 = verification-only（零生产改动）」或以新的证据推翻本反向诊断；若裁定仅验收，则本契约即最终验收基线（绿色哨兵），SA3 无需生产实现、只需落地本契约。
2. **与 #449 的覆盖边界**：kind=1/2 全回合与 drain 第三触发点不在本契约；`LIVE-DRAIN-C1` 只锚 kind=0 live update 数据面切片。
3. **`sendQueueMs` 在 γ 的整键缺席**是 T1 设计 D9 的**登记缺面**（§24.3 闭集合无 accounting 字段），非本票缺口；若团队欲让 γ 携带该投影，需先改 §24.3/ADR 文本（显式 amendment），不在本票范围。
4. **#450/#451 面**（1011 收口、close 冲刷 pending、OPEN 水位、`update-sent` 总归属、根 `pnpm typecheck`/`pnpm test` 全量）不在本契约；本报告只给包级证据。
5. **夹具 append-only 改动已登记**：`issue447-async-seam.ts` +10 行（可选 `edgeObserver`，缺省零传）；T1 全量用例复跑绿，无 T1 语义影响。本报告不修改任何生产实现（`git diff --stat`：生产 `src/**` 空格）。
6. **Issue #448 无 SA8 产物**（`relevant_decisions`/`conflict_report`/design 均缺席）：本报告已以 ADR A4/§24/模块 AGENTS 为可执行约束替代；若后续 SA8 产出与本契约冲突，需按 conflict gate 复核。

---

## 16. Temporary diagnostics cleanup

- **生产实现零改动**：`git status --porcelain` 显示改动面 = 新增 2 测试工件 + 1 夹具 append-only（+10 行）+ 5 个 `artifacts/` 证据日志 + 本报告；`git diff --stat` 仅列 `packages/ws-replication/test/issue447-async-seam.ts`（+10），`packages/ws-replication/src/**` 与任何包/域/应用/规范文档零改动。
- **无临时探针残留**：诊断期间的全部探索均在本契约文件内原位收敛（无 `/tmp` 探针、无临时诊断日志、无 `nohup`/PID 文件、无长驻服务、无遗留 job）；变异负控在 `finally` 中恢复原型，无跨用例污染。
- **无环境覆写**：仅使用 `NODE_OPTIONS=--conditions=nomicore-source`（仓库 `package.json` 既有测试脚本同款条件导出选择，非伪造开关）；`pnpm install --frozen-lockfile` 未改 lockfile。
- **收尾状态**：契约文件 5/5 复跑绿、T1 回归绿、包全量绿、包 tsc exit 0（§13/§14）。

---

### 附：本次实跑命令（可复现）

```bash
pnpm install --frozen-lockfile
NODE_OPTIONS=--conditions=nomicore-source npx vitest run \
  packages/ws-replication/test/ws-replication-issue448-live-data-plane.test.ts \
  packages/ws-replication/test/ws-replication-issue447-async-session-round.test.ts \
  packages/ws-replication/test/ws-replication-issue447-async-seam-fixture.test.ts \
  packages/ws-replication/test/ws-replication-issue447-async-session-api.test.ts
NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication/test
npx tsc -p packages/ws-replication/tsconfig.json
```
