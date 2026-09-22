# 实现设计 — issue #448（γ-T2）：γ 异步缝 live update 数据面（verification-only 裁定与验收契约落地）

- Dispatch：`sa-b7666cf5-a7dc-4af1-bfbc-b83b3fda0e6d`（mabf-sa1 / design / iteration 0）
- Baseline worktree：`/home/wangjian/nomicore-fix-issue-448`，branch `mabf/issue-448`，HEAD `321d951`（`Merge pull request #453 from nomicore-ai/mabf/issue-447`；T1 实现 commit = `52e634b`）。实查一致（`git branch`/`git log`/`git status`）。
- 上游输入：任务简报 `wiki/raw/task_issue-448.md`（Issue 正文 6 条 AC；Comments 空）；SA6 契约 `wiki/raw/task_issue-448_sa6_contract.md`（`verdict: approve`，反向诊断 + verification-only 裁定项）；前序票设计 `wiki/raw/task_issue-447_design.md`（D4/D6/D9/D10/D11）；规范权威 `docs/adr/0032-transport-decoupling-edge-session-split.md` 附录 A4、`docs/protocols/instance-replication-v1.md` §24；模块规约 `packages/ws-replication/AGENTS.md`。
- 本设计不存在待修订前版（`wiki/raw/task_issue-448_design.md` 此前不存在，本次新建）。

---

## 0. 裁定摘要（先读）

**本票裁定为 verification-only（零生产实现面）**：Issue #448 的 AC1–AC6 目标行为在 baseline HEAD `321d951` 已由前序票 #447 的 T1 变更集（`52e634b`）全部交付；本票的可交付物不是生产代码，而是 **SA6 绿色验收/回归契约（13 条可执行锚 + 负控 + 变异敏感性）的落盘与守门**。SA1 已对 SA6 反向诊断的关键事实做独立只读复核（源码符号锚点逐行比对 + git 事实 + 契约工件在场性），**未发现上游事实与源码的矛盾**，故承接该裁定并在本设计中固化为实现阶段的唯一范围。该裁定的证据链与备选方案的否决理由见 §3/§7-D1。

---

## 1. 任务类型、目标和非目标

**任务类型**：Feature（γ-T2 live update 数据面）——但验收方向为**反向诊断承接**：能力已在 HEAD 整体交付，剩余缺口是「AC 专属场景此前无运行时锚」的 verification gap，已由 SA6 契约闭合（先例：#316「Feature 的验收/回归契约（能力在 HEAD 已整体交付，无剩余能力缺口）」→ `approve`）。

**目标**：

1. 裁定并记录「#448 = verification-only（零生产改动）」（SA6 §15-1 移交的裁定项；本设计 §7-D1）。
2. 交付契约工件：`packages/ws-replication/test/ws-replication-issue448-live-data-plane.test.ts`（13 用例）、`packages/ws-replication/test/issue448-live-seam.ts`（夹具）、`packages/ws-replication/test/issue447-async-seam.ts` 的 append-only +10 行（可选 `edgeObserver` 注入面）、`artifacts/sa6-issue448-*.log`（5 份运行证据）。以上工件已由 SA6 在本 worktree 留存（`git status` 实查），实现阶段的职责是**原样落盘并在评审约束内维护**，不是重新实现。
3. 固化与相邻票（#449/#450/#451）的分工边界与登记缺面（`sendQueueMs` 整键缺席）。

**非目标**：

- 不修改任何生产实现（`packages/ws-replication/src/**` 及一切包/域/应用源码零改动）。
- 不修改规范文本（ADR 0032 / 协议 §24 / 模块 `AGENTS.md` 均零改动——缝词汇闭集合无新增，无需 D12 式文档同步）。
- 不实现 `sendQueueMs` 在 γ `update-sent` 的携带（登记缺面，见 §7-D4；欲携带须先做 §24.3/A4 显式 amendment，另票）。
- 不覆盖 #449（kind=1/2 全回合、`ownStep2Seq` 三态、SYNC_APPLIED 保序锚、drain 第三触发点的 sync/bootstrap 全回合面）、#450（连接账本 1011、close 冲刷 pending、`terminateUnauthorized`、OPEN 水位）、#451（`update-sent` 总归属矩阵、test-d 复核、根门禁全量回归）。
- 不做性能/规模断言（SA6 §7：非目标）。

---

## 2. 当前行为与证据锚点（HEAD `321d951`，SA1 独立复核）

以下锚点 = SA6 契约 §10 影响面，SA1 逐行读回源码复核，**全部命中且语义一致**。这些是契约所锚定的**既有生产行为**（验证对象，非变更对象）：

| 面 | 符号 / 行（HEAD，SA1 实读） | 行为 |
|---|---|---|
| tag 分配单点 | `packages/ws-replication/src/hub-session-async-host.ts:96`（`tagCounter`）、`:256-264`（`emitSeam`：`tag = ++tagCounter` → 登记未决集 → 同步调用监听者） | 会话域 tag 单调唯一；无监听者 ⇒ 返回 0（未发送，不登记） |
| 回执消费单点 | `hub-session-async-host.ts:161-177`（`handleReceipt`：终态静默 → sequence 域校验（伪造序 ⇒ `CONNECTION_POLICY_VIOLATION` 响亮）→ 未决集命中（未知/重复 tag ⇒ 响亮）→ fan-out） | 违契响亮收口，绝不静默 |
| 自驱 drain 三触发点 | `hub-session-async-host.ts:152`（每条入站缝消息消费后 =「ACK 到达」保守超集）、`:221-222`（`onDataQueued`/`requestDataDrain` = 入队）、`:176`（transfer 末 chunk 回执结算后，T3 全回合面共享）、`:271-277`（`selfDrain`：`while (facet.pullAndSendOne())`，推完即停） | §24.6/A4.4 推-FIFO pacing；禁 busy loop（每次 pull 消费队列项或发一 chunk，循环必然终止） |
| 乐观发送 | `hub-session-async-host.ts:219`（`dataGateOpen: () => true`） | 流控单点在 edge（§24.5/A4.3）；session 侧闸门 dormant |
| 两相记账 | `packages/ws-replication/src/update-channel.ts:135-138`（`pendingSends: Map<tag, {bytes, sentAt?, chunked?}>`）、`:450-461`（`sendAndRegister` γ async 分支：tag 入 pendingSends，**不入 inFlight**）、`:585-598`（末 chunk γ async 分支） | pending 自**推送时刻**占窗（`sentAt` 在推送同步段采样） |
| 窗口双判据 | `update-channel.ts:169-173`（`effectiveInFlightCount = inFlight + activeTransfer + pendingSends`）、`:261`（`deliver` 直发判据）、`:513`（`pullAndSendOne` 窗口判据） | pending 计入 `maxInFlightUpdates`；tag 与 wire 序**分键空间**（值域重叠但错位，混键即碰撞——#447 设计 D4） |
| 回执 rekey | `update-channel.ts:198-209`（`onReceipt`：`pendingSends.delete(tag)` → `inFlight.set(sequence, entry)`，**换键不换槽**，占用守恒；被弃 tag 迟到回执 ⇒ zombie 序登记 + `'no-op'`） | 回执是序号事实回传（A4.6），非接纳信号 |
| ACK 三类判别 | `update-channel.ts:287-323`（`onAck`：`inFlight` 命中 ⇒ `'ok'`（结算 + 拆/重挂计时器）⇒ `zombieSeqs` ⇒ `'zombie'`（良性）⇒ 否则 `'violation'`）、`:292-301`（拆除判据 = 合并占用 `hasUnsettledSends`，D10） | 与单体内核**同一份实现**，γ 零分叉 |
| ackLatencyMs t0 | `update-channel.ts:303-305`（`latencyMs = t1 − entry.sentAt`，`sentAt` = 推送时刻采样） | §24.8：t0 = 推送时刻（含管道与 edge 等待） |
| violation 漏斗 | `packages/ws-replication/src/hub-namespace.ts:1162-1169`（`onUpdateAck` → `channel.onAck`；`violation` ⇒ `connectionFatal('ACK_STATE_VIOLATION', 1002)`） | 响亮连接收口 |
| `update-acked` 发射点 | `hub-namespace.ts:1416-1429`（`onUpdateAcked`：session 结算点；`chunked` 在场 ⇒ 改道 `chunked-update-acked` 无 `sequence` 键） | §24.8：`update-acked`/chunked 族在 session 回执/结算点 |
| 回执 fan-out | `packages/ws-replication/src/hub-session.ts:309-315`（`onReceipt` 按通道 fan-out）、`hub-namespace.ts:738-746`（`onSendReceipt`：UpdateChannel rekey + bootstrap 锚 + round 锚 + bulk transfer 末 chunk 结算，返回是否结算末 chunk） | γ 层据返回值触发 drain 触发点③ |
| edge 盖章点观测 | `packages/ws-replication/src/hub-edge.ts:852-868`（`emitUpdateSentAtStamp`：`sequence = [8..12]` 盖章返回值、`bytes` = UPDATE 载荷长、`sendQueueMs` 仅记账投影在场时携带） | §24.8：`update-sent` 发射点 = edge 盖章点；γ 下 accounting 不在场 ⇒ 整键缺席 |
| 夹具 append | `packages/ws-replication/test/issue447-async-seam.ts`（+10 行：`AsyncFacadeOptions.edgeObserver?` 可选成员 + 条件展开传给 edge 工厂；缺省零传） | test-only；缺省 = #447 行为逐字不变（SA6 §13：T1 三套件 30/30 复跑绿） |

**git 级事实**（SA6 S1/S2，SA1 复核 `git log` 一致）：T1 之前（`c86ccbc`）γ 公共面与夹具均不存在（`createHubAsyncSessionHost` 零导出、零 `issue447-async-seam` 文件）；`52e634b` 落地 T1；本票 baseline 含全部上述符号。工作树状态 = SA6 契约工件（2 新测试文件 + 夹具 +10 行 + 5 证据日志 + 简报/契约），生产 `src/**` 零改动（`git status --porcelain` 实查）。

---

## 3. 能力缺口 / 根因（承接 SA6 §8，反向诊断）

**结论：本票不存在剩余生产能力缺口。** AC1–AC6 的目标行为已由 #447 的 T1 变更集交付（§2 锚点即生产面证据；#447 设计 D4/D6/D9/D10 把数据面机械——`pendingSends` 两相记账、selfDrain 三触发点、t0 推送时刻、ackTimeout 合并占用判据——明确列入 T1 变更集）。

- **症状**：「#448 的 AC 看似待实现」（票面 What-to-build 以实现语气书写）。
- **直接事实**：T1 的实现面**已含**数据面（共享机械：`UpdateChannel` 单份实现 + `asyncSendTickets` 单点置位）。
- **触发条件**：`/to-tickets` 切片规划时 T1 的 AC 只写「控制面先行」，实现却按设计 D4/D6 连带落地数据面分支。
- **最深根因**：**票切片与实现面重叠**（T1 过度交付 / T2 生产面被前序吸收）——流程性事实，非代码缺陷；本设计不虚构 Bug 根因。
- **剩余缺口 = 锚覆盖（verification gap）**：本票 AC 专属场景（live `UPDATE_ACK` 的保序编排、live `update-acked` 的 k+m 时延锚、live 成功路径的 β parity、edge 观测归属）此前无运行时锚——该缺口已由 SA6 契约的 13 条用例闭合，本设计将其固化为交付物（§7-D2）。

---

## 4. Owner 要求落实

派工明示 + 简报 `## Comments` 双确认：**Issue comments 经 REST 读取为空数组，无 owner 评论要求可映射**。需求全集 = Issue 正文 6 条 AC（+ Parent PR #446 的设计工件语境）。

| Comment ID | Updated at | Requirement | Design section |
|---|---|---|---|
| （无评论） | — | — | — |

| Issue AC | 设计落点 | 契约条目（已绿） | HEAD 状态 |
|---|---|---|---|
| AC1 data 面 pending/receipt 全链；在途记账精确（无伪造序号、无 pending 泄漏） | §2 锚点表（tag 分配/rekey/窗口）、§8 数据流 | LIVE-WINDOW-C1/C2、LIVE-DRAIN-C1、LIVE-ORD-C1 | 已满足（`sa6-issue448-contract-run.log` 13/13） |
| AC2 pending 计入 `maxInFlightUpdates`；乐观发送不击穿上界（延迟注入锚） | §2（`effectiveInFlightCount` 双判据 + `dataGateOpen ≡ true`） | LIVE-WINDOW-C1/C2 + C3 变异负控 | 已满足 |
| AC3 保序锚：回执恒先于对应 `UPDATE_ACK`；`onAck` 三类判别与单体同构 | §2（`handleReceipt`/`onAck`/`onUpdateAck` 漏斗）、§9 | LIVE-ORD-C1/C2、LIVE-ACK-C1/C2/C3 | 已满足 |
| AC4 自驱 drain 两触发点（入队 / ACK）；无 busy loop | §2（selfDrain 三触发点 + while 循环终止性） | LIVE-WINDOW-C1/C2、LIVE-DRAIN-C1/C2 | 已满足 |
| AC5 `update-acked` 发射点与 `ackLatencyMs` t0 口径锚（= 协议 §24.8） | §2（`onUpdateAcked` 发射点 + `latencyMs` 采样） | LIVE-ACK-C1（+变异负控）、LIVE-OBS-C1 | 已满足 |
| AC6 live update 成功路径与 β wire 逐字节等价 | §2（edge 盖章点 `[8..12]`）、§12 | LIVE-PARITY-C1、LIVE-PARITY-NC1 | 已满足 |

---

## 5. 复现和根因承接

| 上游事实（SA6 契约） | 证据位置 | 设计响应 |
|---|---|---|
| S1 baseline = HEAD `321d951`（含 T1 `52e634b`） | `git log`；SA1 复核一致 | §0/§2 采纳为基线事实 |
| S2 pre-T1 `c86ccbc` 零 γ 公共面/夹具（历史红的事实基础） | SA6 §8-S2 git 级实查 | §3 根因链采纳；契约「旧实现预期红」列的历史依据 |
| S3 T1 变更集按设计落地数据面机械（D4/D6/D9/D10） | `task_issue-447_design.md:152-199`（SA1 实读） | §3 采纳；verification-only 裁定的主干证据 |
| S4 HEAD 生产面逐符号具备（SA6 §10 行号表） | SA1 逐行读回复核（§2），全部命中 | **无上游事实与源码矛盾**；裁定可成立 |
| S5 目标断言 HEAD 全绿（13/13）+ 负控/变异有牙（NC-1…NC-7） | `artifacts/sa6-issue448-contract-run.log`、`-repeat5.log`（SA1 读回：13 passed、run 5 exit 0） | §12 验收映射采纳 |
| S6 剩余缺口 = 锚覆盖，已由契约闭合 | SA6 §8-S6；`git status` 无此前 `issue448-*` 工件 | §3/§7-D2 固化为交付物 |
| 套件回归面：T1 三套件 30/30 + 包全量 101 文件 / 897 用例绿、包 tsc exit 0 | `artifacts/sa6-issue448-package-suite.log`（101/897 passed, Type Errors no errors，SA1 读回） | §12 验证门采纳 |

## 6. SA8 约束落实

#448 **无 SA8 产物**（`relevant_decisions`/`conflict_report` 缺席，SA6 §15-6 同查）——本设计按 skill 纪律读取规范权威原文替代，逐条落实如下。注意本设计零生产改动，故各约束的「处理方式」= 验证对象锚定，非实现落点。

| 决议或义务 | 出处（SA1 实读原文） | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|---|
| 宿主传输义务：每会话一对专用通道；每方向 FIFO；回执在盖章点同步投递；违契响亮收口 | 协议 §24.2 / ADR A4.2（`docs/protocols/instance-replication-v1.md:1091-1105`、`docs/adr/0032-*.md:61-68`） | §2 锚点表；LIVE-ORD-C1/C2 | 既有行为，契约锚定（消费序配对 + 乱序注入 ⇒ 响亮） | 否 |
| 两相记账：pending 自推送占窗；回执 tag→seq 换键不换槽；三态锚 | 协议 §24.4 / ADR A4.2 | §2（`pendingSends`/`onReceipt`）；LIVE-WINDOW-C1/C2、LIVE-ACK-C1 | 既有行为，契约锚定 | 否 |
| 流控单点 edge、session 乐观发送（`dataGateOpen ≡ true`） | 协议 §24.5 / ADR A4.3 | §2（`:219`）；LIVE-WINDOW-C1/C2、LIVE-DRAIN-C2 | 既有行为，契约锚定（乐观发送不越上界） | 否 |
| pacing：自驱 drain 触发点 = 入队 / ACK / 末 chunk 回执；推完即停、禁 busy loop | 协议 §24.6 / ADR A4.4 | §2（selfDrain）；LIVE-DRAIN-C1/C2 | 既有行为，契约锚定（时间推进零驱动、计时器面不增） | 否 |
| 观测口径：`update-sent` 在 edge 盖章点；`update-acked`/chunked 族在 session 结算点；`ackLatencyMs` t0 = 推送时刻；跨线程事件无全序 | 协议 §24.8 / ADR A4.7 | §2（`emitUpdateSentAtStamp`/`onUpdateAcked`/`latencyMs`）；LIVE-ACK-C1、LIVE-OBS-C1 | 既有行为，契约锚定（单事件字段值断言；**零事件序断言**） | 否 |
| 成功路径与 β wire 等价；数据帧内容判据 = 文档语义（Yjs clientID/clock 随机） | ADR A4.8 / #424 ORACLE-2 先例 | §12；LIVE-PARITY-C1/NC1 | 既有行为，契约锚定 | 否 |
| γ 缝词汇闭集合**无 accounting 字段**（`sendQueueMs` 整键缺席 = 登记缺面） | 协议 §24.3 + #447 设计 D9 | §7-D4；LIVE-OBS-C1 `not.toHaveProperty('sendQueueMs')` | 固化登记缺面；不主张实现 | 否（欲增补须先显式 amendment，另票） |
| 模块验证门：每条改动状态机路径聚焦测试；缝变更另跑 edge/session 契约与 wire parity；wire/生命周期变更加跑根门禁 | `packages/ws-replication/AGENTS.md`（Verification 段） | §12 | 本票零生产改动 ⇒ 触发条件不满足；仍按包级全量 + tsc 交付证据（超出最低要求） | 否 |
| γ append-only 缝纪律 / β 同步冻结逐字不动 / tag-lane 载体 / 无拒纳闸门信用词汇 | `packages/ws-replication/AGENTS.md:17`（Boundary 段） | §7-D3、§11 DENY LIST | 零触碰（生产面零改动；夹具 append-only 不新增缝词汇） | 否 |
| 前序票 SA8 冲突门（可执行约束的筛查出处） | `wiki/raw/task_issue-447_design_conflict_report.md`（在场） | §15 | 本票约束全部继承自 #447 已筛查面 + 规范原文，无新增协议决策 | 否 |

---

## 7. 设计决策与主要备选方案

### D1 裁定：verification-only（零生产实现面）——承接并确认 SA6 §15-1

SA6 把「#448 是否还有生产实现面」作为裁定项移交设计阶段。本设计裁定：**无**。依据（三路独立收敛）：

1. **规范→代码**：AC1–AC6 要求的每条行为（§6 约束表）在 HEAD 均有生产符号实现且语义与 §24/A4 逐条对上（§2 锚点表，SA1 逐行实读）。
2. **git→历史**：能力缺口历史上真实存在（pre-T1 `c86ccbc` 零 γ 公共面/夹具），由 `52e634b` 闭合（S2/S3）；「票切片与实现面重叠」是流程事实，不是待修复缺陷。
3. **运行时→断言**：13 条目标断言在 HEAD 全绿且负控/变异证明有判别力（S5；NC-4 窗口、NC-5 t0、NC-1/2 保序、NC-6 parity）。

**备选否决**：
- **(a) 重新实现数据面**：无缺口可填；任何「再实现」只会制造第二份机械，违反单份实现纪律（#447 设计 D4/D5 的否决理由同源），且必然与既有符号冲突。
- **(b) 以「票面写着 What to build」为由退票/要求重开生产范围**：票面 6 条 AC 的验收动词（「锚」「口径锚」「等价」）本身指向可执行验证物；#316 先例（同类反向诊断 → `approve` → 契约交付）成立；退票不产生任何增量价值。
- **(c) 等待新的反证**：若后续证据（例如某场景在 HEAD 真红）推翻反向诊断，正确路径是按 Controller 流程重开 SA6 类诊断 + 设计修订，而不是在本票预写投机性生产面。触发条件登记于 §13-R4。

### D2 交付物 = 契约工件原样落盘（SA3 实施面 = 守门，不重写）

SA6 已把契约工件留在本 worktree（`git status`：2 新测试文件 + 夹具 +10 行 + 5 证据日志）。实现阶段的职责边界：

- **原样保留**契约的 13 条用例语义（LIVE-WINDOW/ORD/ACK/OBS/DRAIN/PARITY 族 + 变异负控）；SA2/SA4 评审修订若要求调整，改动必须落在 ALLOW LIST（§11）内且不削弱负控与变异敏感性（`finally` 恢复生产原型、零 `skip/only/todo`、零 env override 的纪律保持）。
- 不修改既有断言的判据口径（恰 N 帧、`k+m` 时延、消费序 strict 先行、`not.toHaveProperty`、逐字节控制帧等）——这些口径即本票 AC 的可执行形态。
- 证据日志随工件保留（`artifacts/sa6-issue448-*.log`），作为 SA6 阶段运行证据；实现/评审阶段如重跑，新证据可追加但不替换基线。

**备选否决**：由实现阶段重写一套等价测试——无增益且引入「两套锚」漂移风险；SA6 契约已经 5 次复跑稳定性验证（`-repeat5.log` run 5 exit 0）。

### D3 夹具 append-only 纪律（`issue447-async-seam.ts` +10 行）

唯一触碰既有文件的改动：`AsyncFacadeOptions` 增可选成员 `edgeObserver?: ReplicationObserver`（doc-comment 登记 issue #448 + 缺省零传语义），`makeAsyncReplicationFacade` 内条件展开 `...(options.edgeObserver === undefined ? {} : { observer: options.edgeObserver })` 传给 edge 工厂。约束：

- **append-only**：不改写任何既有行/签名/缺省行为；缺省（不传 `edgeObserver`）= #447 行为逐字不变（SA6 §13：T1 三套件 30/30 复跑绿为证）。
- **test-only 面**：该注入面只服务于 `update-sent` 发射点（edge 盖章点，§24.8）的可观察性——生产 `createHubReplicationEdge` 本就接受 `observer`（`hub-edge-host.ts:165/924`，SA6 H9），夹具只是补接线，零协议决策。
- 评审若需重构，保持「缺省零传 = 逐字不变」不变量与 #447 用例复跑绿。

**备选否决**：为 #448 另造独立夹具不复用 #447 装配面——重复宿主桥/通道/泵机械，违背夹具纪律（#447 D8「零自动投递、显式 release」先例）且抬维护成本。

### D4 `sendQueueMs` 整键缺席 = 登记缺面固化（非待实现面）

γ 缝词汇（协议 §24.3）是 append-only 闭集合，**无 accounting 字段**；#447 设计 D9 已登记「整键缺席」。契约以 `update-sent` 断言 `not.toHaveProperty('sendQueueMs')` 把该登记固化为可执行锚。本设计明确：这是**登记缺面的守门断言**，不是缺口；任何「让 γ 携带 sendQueueMs」的诉求 = 规范变更（§24.3 + A4 文本显式 amendment）先行，另票处理，本票 DENY（§11）。

### D5 验证门 = 包级全量 + 类型门（超出零改动所需的最低要求）

零生产改动下模块门禁的触发条件（「changed state-machine path」「wire or lifecycle change」）不满足；但契约新增了测试文件，故设计指定验证门为（与 SA6 §14 实跑口径一致）：

1. 契约单文件：`npx vitest run packages/ws-replication/test/ws-replication-issue448-live-data-plane.test.ts` = 13/13 绿、Type Errors no errors；
2. γ 族四文件（契约 + T1 三套件）= 43/43 绿（回归面：夹具 append 不伤 #447）；
3. 包全量：`npx vitest run packages/ws-replication/test` = 101 文件 / 897 用例绿（采集面：根 `vitest.config.ts:15` `include = ['packages/*/test/**/*.test.ts', …]` 逐字命中，SA1 实读）；
4. 类型门：`npx tsc -p packages/ws-replication/tsconfig.json` exit 0（含新增两文件）；
5. 环境条件：`NODE_OPTIONS=--conditions=nomicore-source`（仓库既有测试脚本同款条件导出选择，非伪造开关）。

根 `pnpm typecheck`/`pnpm test` 全量回归属 CI/Host 收尾门与 #451（T5）的登记范围（§12 边界），本票不重复主张。

---

## 8. 接口、状态机和数据流

**接口变更：无（生产面零改动）。** 唯一接口面触碰 = 测试夹具的可选 `edgeObserver`（append-only，缺省零传，§7-D3）；公共 API（`src/index.ts`）、wire 帧、缝词汇、schema、持久化均零变化。

**状态机变更：无。** 契约验证的既有两相状态机（verification 对象，锚定供实现/评审对照）：

```
出站 data 帧：queued → (窗口空位 ∧ 闸门开[γ恒true] ∧ !chunkable) 直发
  → sendAndRegister：sentAt 采样(推送时刻) → asyncSendTickets ⇒ pendingSends[tag]
  --receipt{tag,seq}--> onReceipt rekey：pendingSends[tag] → inFlight[seq]（换键不换槽）
  --UPDATE_ACK{ackedSequence=seq}--> onAck：
      inFlight 命中 ⇒ 'ok'（结算：update-acked{sequence, ackLatencyMs = t1 − sentAt}；合并占用归零 ⇒ 拆计时器）
      zombieSeqs 命中 ⇒ 'zombie'（良性零结算）
      未命中 ⇒ 'violation' ⇒ connectionFatal('ACK_STATE_VIOLATION', 1002)
弃置路径：abandonInFlight ⇒ abandonedTags[tag]；迟到回执 ⇒ zombieSeqs[seq]（'no-op'）
```

**数据流路线：本设计无运行时数据流变化**（依据：零生产改动——`git status` 生产 `src/**` 零 diff；契约只**读取**既有数据流的运行时观察面）。为评审与实现对照，登记契约所验证的既有跨线程数据流（每跳一行的观察锚）：

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| live UPDATE 出站（γ） | hub 本地写 → `deliver(bytes,'live')` | `update-channel.ts:261` 直发判据 → `:450` pendingSends[tag] | session→edge 缝 `frame{tag,bytes,lane}`（sequence=0 占位） | 宿主异步通道（FIFO，测试 = 显式 release 扣留/放行） | edge mux 盖章 `[8..12]` + 同步投递 `receipt{tag,seq}`；`update-sent` 在盖章点 | wire UPDATE 帧 + 回执 | 发送拒绝（seq≤0）⇒ discardQueued + send-failed resync（既有） | LIVE-WINDOW-C1/C2、LIVE-OBS-C1 |
| 回执登记 | edge→session `receipt` | `hub-session.ts:309` fan-out → `update-channel.ts:198` rekey | tag→seq 换键不换槽（占用守恒） | 内存账本（inFlight/pendingSends） | `effectiveInFlightCount` 窗口判据 | 占用不变、零事件 | 未知/重复 tag ⇒ `CONNECTION_POLICY_VIOLATION` 响亮 | LIVE-WINDOW-C1、LIVE-ORD-C1 |
| ACK 结算 | peer→hub `UPDATE_ACK` | `hub-namespace.ts:1162` → `update-channel.ts:287` | ok/zombie/violation 三态（单份实现） | 内存账本 | `hub-namespace.ts:1416` `update-acked`（session 结算点） | `ackLatencyMs = t1 − 推送时刻` | violation ⇒ `ACK_STATE_VIOLATION` 连接收口 | LIVE-ACK-C1/C2/C3 |
| kind=0 分块 live update | chunkable 项入队 → `pullAndSendOne` | `:530` startTransfer（占 1 槽）→ `:585` 末 chunk pendingSends[tag]（chunked:true） | 逐 chunk 过缝（中间 chunk 零占位零事件） | 同上通道 | 末 chunk 回执结算 → `chunked-update-acked`（无 sequence 键） | transfer 恰占 1 窗口槽 | 同上三态 | LIVE-DRAIN-C1 |
| β/γ parity 对照 | 同一业务写双侧同场 | β 同步缝 vs γ 异步缝 | 控制帧字节 + 全轨迹骨架 `kind#sequence` + 数据帧文档语义 | wire 双向 | 双 hub ROOT 快照逐值 + peer 收敛 | 逐字节/逐值等 | — | LIVE-PARITY-C1/NC1 |

---

## 9. 错误、恢复、并发和幂等

**本设计零新增错误/恢复/并发/幂等语义**（零生产改动）。契约锚定的**既有**语义（验证对象，供评审判别契约是否忠实）：

- **响亮失败（无静默降级）**：伪造回执序 / 未知或重复 tag ⇒ `CONNECTION_POLICY_VIOLATION`（经 `connection-fatal` 信号，`hub-session-async-host.ts:161-171`）；ACK 引用未登记序 ⇒ `ACK_STATE_VIOLATION`(1002) 连接收口（`hub-namespace.ts:1165-1167`）；缝字节不可解码 ⇒ `MALFORMED_FRAME` 收口（`:128-131`）。契约以 NC-1/NC-2 注入违契证明「响亮而非恒真」。
- **良性路径**：弃置 tag 迟到回执 ⇒ zombie 登记 no-op；zombie 序迟到 ACK ⇒ `'zombie'` 零结算零 fatal + `RESYNC_REQUIRED` 恰一次（LIVE-ACK-C3）。
- **幂等/终止性**：`selfDrain` 无工作即 no-op、每次 pull 消费即进展、循环必然终止（禁 busy loop，LIVE-DRAIN-C2：`advanceBy(100)` 零新帧、`scheduler.pending()` 不增、重复泵零越界）；`handleReceipt`/`handleFrame` 终态静默门（A4.5）。
- **并发口径**：γ 单会话单句柄；测试以显式 release + 手动时源消除竞态窗口（SA6 §7），不依赖真实 timer/wall-clock。

---

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| 生产调用方（Registry/SessionHost 组装、edge mux、peer 面、Cordis 插件） | 消费 §2 既有符号 | **逐字节不变**（零生产改动） | 无 | `git status` 生产 `src/**` 零 diff；§11 DENY |
| `makeAsyncReplicationFacade` 既有消费方（#447 三测试套件） | 不传 `edgeObserver` | 缺省零传 = 行为逐字不变；T1 三套件 30/30 复跑绿 | 无 | SA6 §13；`artifacts/sa6-issue448-package-suite.log`（含三套件） |
| 新消费方（`issue448-live-seam.ts` → 契约 13 用例） | 不存在 | 经可选 `edgeObserver`/`hubObserver`/`hubClock` 注入面组装观测投影 | 无生产改动；仅新增 test-only 文件 | `issue448-live-seam.ts:73-99`（SA1 实读） |
| CI/根门禁（`pnpm test`/`pnpm typecheck`） | 采集 `packages/*/test/**/*.test.ts` | 新增 1 个采集文件（+13 用例）；无配置改动 | 无 | `vitest.config.ts:15`；SA6 §14 实跑 101 文件/897 用例 |

未覆盖调用方：无（生产面零改动 ⇒ 生产调用方集合不受影响；测试面唯一被触碰文件的消费方已列）。

---

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/ws-replication/test/ws-replication-issue448-live-data-plane.test.ts` | 新增（已在 worktree，686 行 / 13 用例）；评审修订仅限不削弱判据口径与负控/变异敏感性的调整 | 本票交付物本体：AC1–AC6 的可执行验收锚（§7-D2） |
| `packages/ws-replication/test/issue448-live-seam.ts` | 新增（已在 worktree，133 行，test-only 夹具） | 契约装配面（boot adopt + 观测投影 + 双侧 observer，零协议决策） |
| `packages/ws-replication/test/issue447-async-seam.ts` | **append-only** +10 行（可选 `edgeObserver`，缺省零传）；不得改写既有行 | `update-sent` 发射点（edge 盖章点）可观察性所需的最小注入面（§7-D3） |
| `artifacts/sa6-issue448-contract-run.log`、`-repeat5.log`、`-package-suite.log`、`-package-suite-precontract.log`、`-package-tsc.log` | 新增（证据日志，保留；可追加新运行证据） | SA6 运行证据链（§5/S5、§12） |
| `wiki/raw/task_issue-448_design.md` | 本设计（新建） | 设计产物固定位置 |

（下游流水线产物——SA2 评审、SA3 实施记录、SA4 复核、SA7 报告等——由各自 dispatch 授权，不在本设计 ALLOW/DENY 之列。）

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/ws-replication/src/**`（含 `hub-session-async-host.ts`、`update-channel.ts`、`hub-namespace.ts`、`hub-session.ts`、`hub-edge.ts`、`hub-edge-host.ts`、`index.ts` 等） | AC1–AC6 目标行为的实现载体（§2） | verification-only 裁定（§7-D1）：能力已在 HEAD 交付，零生产缺口；任何改动制造第二机械或破坏 β 逐字节冻结 |
| `docs/adr/0032-transport-decoupling-edge-session-split.md`、`docs/protocols/instance-replication-v1.md` | 本票约束的规范权威（A4/§24） | 零语义变化 ⇒ 无文档同步义务；`sendQueueMs` 增补须显式 amendment 另票（§7-D4） |
| `packages/ws-replication/AGENTS.md` | 模块契约（缝纪律词汇枚举） | 缝词汇闭集合零新增（receipt/tag-lane 已由 #447 D12 登记）；无代码行为变化 |
| `packages/replication-protocol/**`（wire codec） | AC6 逐字节等价的对照基准 | wire 格式零变化；改 codec 即破坏 parity 判据的事实源 |
| `packages/ws-replication/test/issue447-*.test.ts` 之外的既有 #447 套件语义 | 回归面（30 用例） | 回归证据依赖其原样；仅允许因生产/夹具行为变化而必要的同步（本票无） |
| 根 `vitest.config.ts`、`tsconfig*.json`、`package.json` | 运行器/类型门配置 | 新文件已逐字命中既有采集/类型规则（§7-D5），零配置改动 |
| #449/#450/#451 范围面（kind=1/2 全回合、drain 第三触发点全回合编排、1011 账本、close 冲刷、OPEN 水位、`update-sent` 总归属矩阵、根门禁全量回归） | 相邻票分工（SA6 §12.2） | 越界即与相邻票冲突；本票契约的 LIVE-DRAIN-C1 已显式收窄到 kind=0 数据面切片 |
| 其他包/域/应用（`packages/*`（除上 ALLOW）、`domains/**`、`apps/**`） | 无关 | 本票零触及 |

---

## 12. 验收与验证映射

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1 无伪造序/无 pending 泄漏 | LIVE-WINDOW-C1/C2（绿） | `maxInFlightUpdates=2` + 扣留 + 写 ×3 + 步进放行回执/ACK | 恰 2 帧过缝；回执不释放槽；ACK 后第 3 帧；4 笔全结算后第 4 笔直推；`receipt.sequence` ≡ 盖章序 |
| AC2 pending 占窗、乐观发送不越界 | LIVE-WINDOW-C1/C2 + C3 变异（绿） | 同上 + NC-4 变异（占用判据去 `pendingSends`） | 变异下第 3 帧越界 ⇒ 正断言必红（判据对 pending 占窗敏感） |
| AC3 保序 + 三类判别 | LIVE-ORD-C1/C2、LIVE-ACK-C2/C3（绿） | 步进放行消费序配对；乱序注入（`reorderNext`）；丢回执直投 ACK；ackTimeout 弃置 + 迟到回执/ACK | 回执 strict 先于引用其序的 `UPDATE_ACK`；乱序 ⇒ 响亮 `ACK_STATE_VIOLATION`；violation 响亮 / zombie 良性（`RESYNC_REQUIRED` 恰一次）零结算 |
| AC4 drain 两触发点 + 禁 busy loop | LIVE-WINDOW-C1/C2、LIVE-DRAIN-C1/C2（绿） | 入队触发（分块 transfer）+ ACK 触发（第 3 帧）+ `advanceBy(100)` + 重复泵 ×4 | 整只 transfer 占 1 槽逐 chunk 过缝；时间推进零新帧、`scheduler.pending()` 不增；推完即停 |
| AC5 发射点 + t0 口径 | LIVE-ACK-C1 + 变异、LIVE-OBS-C1（绿） | `k=7`/`m=5` 虚拟延迟；session+edge 双侧 observer | `update-acked` 恰一次、`ackLatencyMs = k+m = 12`（变异下 `m` ⇒ 必红）；`update-sent` 在 edge（wire 序、载荷长、无 `sendQueueMs`）；`update-acked` 在 session 同序 |
| AC6 β wire 逐字节等价 | LIVE-PARITY-C1/NC1（绿） | 同场 β vs γ live 写 `{n:43}` + NC-6 内容变异（43→44） | 控制帧逐字节等 + 全轨迹骨架 `kind#sequence` 全等 + 文档语义等；变异下语义比对必报差异（判据非恒真） |
| 风险：契约腐化（重构移动锚点） | 变异敏感性矩阵 NC-4/5/6 + 负控 NC-1/2/7（绿） | 每次触及 ws-replication 的后续变更复跑本契约（包全量自然含之） | 任何 pending 占窗 / t0 采样 / 保序 / 数据内容漂移 ⇒ 红 |
| 风险：夹具 append 伤 #447 | T1 三套件 30/30 复跑（绿） | γ 族四文件连跑 | 43/43 绿 |
| 采集/类型门 | §14 实跑证据（101 文件/897 用例、tsc exit 0） | §7-D5 命令 1–4 | 全绿、exit 0 |

**验证命令**（实现/评审阶段照跑；环境 `node v24.13.0`/`pnpm 10.28.2`/`vitest 3.2.7`/`typescript 5.9.3`，`NODE_OPTIONS=--conditions=nomicore-source`）：

```bash
pnpm install --frozen-lockfile
NODE_OPTIONS=--conditions=nomicore-source npx vitest run \
  packages/ws-replication/test/ws-replication-issue448-live-data-plane.test.ts \
  packages/ws-replication/test/ws-replication-issue447-async-session-round.test.ts \
  packages/ws-replication/test/ws-replication-issue447-async-seam-fixture.test.ts \
  packages/ws-replication/test/ws-replication-issue447-async-session-api.test.ts   # 43/43
NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication/test  # 101 文件 / 897 用例
npx tsc -p packages/ws-replication/tsconfig.json                                       # exit 0
```

---

## 13. 风险、回滚和残余问题

| # | 风险/事项 | 评估 | 缓解/条件 |
|---|---|---|---|
| R1 | 契约腐化：后续重构移动 §2 锚点使 13 条锚静默过期 | 低-中 | 变异负控（NC-4/5/6）+ 违契注入（NC-1/2/7）证明判据有牙；包全量把契约纳入每次回归 |
| R2 | 夹具 append 漂移：`edgeObserver` 被改写为缺省行为变化 | 低 | §7-D3 约束（append-only、缺省零传）+ T1 三套件复跑门；评审对照 +10 行 diff |
| R3 | 与相邻票越界/重叠（#449 drain 第三触发点、#450 生命周期、#451 观测总归属） | 低 | §1 非目标 + §11 DENY + SA6 §12.2 边界登记（LIVE-DRAIN-C1 已收窄至 kind=0 数据面切片） |
| R4 | 反向诊断被推翻（某 AC 场景在 HEAD 真红） | 低（三路证据收敛 + SA1 复核无矛盾） | 触发即按 Controller 流程重开诊断与本设计修订（§7-D1 备选 c）；本设计不预写投机生产面 |
| R5 | `sendQueueMs` 缺席被误读为待实现缺口 | 中（语义易混） | §7-D4 显式登记缺面 + 契约 `not.toHaveProperty` 守门；增补须 §24.3/A4 amendment 另票 |
| R6 | 票切片与实现面重叠的流程根因（T1 过度交付）复发 | 中（流程性） | follow-up（非本票任务内必要条件）：切片规划时以「实现面清单 × AC 映射」核对重叠；本设计 §3 已留档事实 |
| R7 | #449 落地时复用/扩展本契约夹具 | 低 | `issue448-live-seam.ts` 复用 #447 装配面的同款纪律可延续；T3 自行决定复用或旁路 |

**回滚**：交付物 = 3 个测试文件（2 新增 + 1 append-only）+ 证据日志；回滚 = 删除新增文件、还原 +10 行（`git checkout -- packages/ws-replication/test/issue447-async-seam.ts`）。零生产耦合，无数据/状态迁移，无需协调。

**残余问题（follow-up，非本票必要条件）**：R6 流程改进；`sendQueueMs` γ 携带诉求（若有）走规范 amendment 票；#451 将 LIVE-OBS-C1 并入观测归属总矩阵。

---

## 14. 评审修订映射

iteration 0：`wiki/raw/task_issue-448_sa2_review.md` 不存在（尚无评审输入）。无适用 finding。后续评审到达时按 skill 纪律逐条映射并原位修订本设计。

---

## 15. 是否需要设计后 ADR 冲突复查

**结论：不需要（`requiresConflictRecheck: false`）。** 理由：

1. 本设计**零生产实现面**：不改公共 API、wire、schema、持久化、状态机语义——`structured_output` 冲突复查的常规触发条件（协议/wire/schema/持久化/状态机语义变化、触碰 ADR 冻结面、修订既有决策、新增生命周期所有权或失败语义）一项都不满足。
2. ADR 0032 A4 与协议 §24 是**被满足与被锚定**的规范权威，不是被修订对象；本设计对它们的全部引用为「既有行为验证」（§6 表，逐条「否」）。
3. verification-only 裁定是 SA6 显式移交设计阶段的范围判断（SA6 §15-1），且由三路独立证据支撑（§7-D1）；它确认而非修订任何既有决策。#448 虽无 SA8 产物，但本票约束集全部继承自 #447 已过 SA8 冲突门的冻结面（`task_issue-447_design_conflict_report.md` 在场）+ 规范原文，无新增协议决策需要筛查。
4. 条件触发项（登记，非本轮激活）：若 (a) SA2/SA8 后续评审对 verification-only 裁定提出异议证据并主张重开生产面；(b) 后续变更欲为 γ 增补 `sendQueueMs`（触碰 §24.3 闭集合）——届时按 conflict gate 重开 ADR 冲突检查（§13-R4/R5）。
