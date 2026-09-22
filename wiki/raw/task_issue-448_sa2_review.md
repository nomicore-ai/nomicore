# SA2 设计攻击评审 — issue #448（γ-T2 live update 数据面）

- Dispatch：`sa-3bb1bc62-ae40-46e5-acb4-c20dce126fd1`（mabf-sa2 / design-review / iteration 0）
- 评审对象：`wiki/raw/task_issue-448_design.md`（iteration 0，新建，无前版）
- 评审方式：独立攻击视角。SA2 逐行读回设计引用的全部生产源码锚点、规范原文（协议 §24 / ADR 0032 附录 A4）、前序票设计（#447 D4/D6/D9/D10/D11）、SA6 契约工件本体（13 用例逐条阅读）、git 事实与证据日志；未运行测试、未启动服务、未修改任何设计/生产/测试文件。

---

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-448.md`（任务简报：Issue 正文 6 AC + `Blocked by #447` + Parent PR #446；Comments 空） | 在场，已读 |
| `wiki/raw/task_issue-448_design.md`（SA1 设计，iteration 0） | 在场，全文已读 |
| `wiki/raw/task_issue-448_sa6_contract.md`（SA6 反向诊断 + 验收契约，`verdict: approve`） | 在场，全文已读 |
| `wiki/raw/task_issue-447_design.md`（前序票设计；D4/D6/D9/D10/D11、§8.5–§8.9） | 在场，关键节已读 |
| `wiki/raw/task_issue-447_design_conflict_report.md`（#447 SA8 冲突门产物） | 在场（设计 §15-3 引用属实） |
| `docs/protocols/instance-replication-v1.md` §24（:1091–1154） | 原文已读，逐条对照设计 §6 约束表 |
| `docs/adr/0032-transport-decoupling-edge-session-split.md` 附录 A4（:55–99） | 原文已读 |
| `packages/ws-replication/AGENTS.md`（缝纪律 + Verification 门） | 已读（dispatch 附载） |
| 契约工件：`packages/ws-replication/test/ws-replication-issue448-live-data-plane.test.ts`（686 行，实数 13 个 `it`）、`packages/ws-replication/test/issue448-live-seam.ts`（133 行）、`issue447-async-seam.ts` diff（+10 行）、`artifacts/sa6-issue448-*.log` ×5 | 全部在场，已读 |
| `wiki/raw/task_issue-316_sa6_contract.md`（verification-only 先例） | 在场（设计 §1 引用属实） |
| #448 的 SA8 产物（`relevant_decisions`/`conflict_report`） | 确认缺席（与设计 §6 声明一致） |
| Owner comments | 简报 `## Comments` 空数组 + 派工明示 REST 读取为空 ⇒ 无可映射评论 |

---

## 2. Verdict

**`approve`**

无 BLOCKER、无 MAJOR。核心裁定（#448 = verification-only，零生产实现面）经 SA2 独立三路复核成立；设计的范围、证据链、边界登记、验收映射与文件清单内部一致且与仓库事实逐点吻合。3 条 MINOR 观察见 §14（不阻断）。

---

## 3. 需求覆盖

| Requirement（Issue AC） | Design section | Assessment |
|---|---|---|
| AC1 data 面 pending/receipt 全链；在途记账精确（无伪造序号、无 pending 泄漏） | §2 锚点表（tag 分配 `hub-session-async-host.ts:96/:256-264`、rekey `update-channel.ts:198-209`、窗口双判据 `:169-173/:261/:513`）、§8 数据流、§12 | **满足**。源码锚点 SA2 逐行复核全部命中；契约 LIVE-WINDOW-C1/C2 断言「receipt.sequence ≡ 盖章序」「第 4 笔直推（槽位全释放）」正是无伪造序/无泄漏的可执行形态 |
| AC2 pending 计入 `maxInFlightUpdates`；乐观发送不击穿上界（延迟注入锚） | §2（`effectiveInFlightCount = inFlight + activeTransfer + pendingSends`、`dataGateOpen ≡ true` @ `hub-session-async-host.ts:219`）、§12 | **满足**。延迟注入 = 扣留 + 步进放行；NC-4 变异负控证明「恰 2 帧」断言对 pending 占窗敏感（SA2 读回变异代码：剥掉 `pendingSends` 项，正断言必红） |
| AC3 保序锚：回执恒先于对应 UPDATE_ACK；`onAck` 三类判别与单体同构 | §2（`handleReceipt` :161-177、`onAck` :287-323、`onUpdateAck` 漏斗 `hub-namespace.ts:1162-1169`）、§8 状态机、§9 | **满足**。LIVE-ORD-C1 以单通道消费序（`delivered()` 下标比较）断言 strict 先行——单通道 FIFO 序断言不违反 §24.8「跨线程无全序」约束；NC-1 乱序注入 ⇒ 响亮 `ACK_STATE_VIOLATION`；「与单体同构」由**同一份** `UpdateChannel.onAck` 单实现结构性成立（SA2 读码确认 γ/α/β 共享该函数，仅 `pendingSends` 无条件字段在 γ 下非空） |
| AC4 自驱 drain 两触发点（入队 / ACK）；无 busy loop | §2（三触发点 :152/:221-222/:176、`selfDrain` :271-277）、§12 | **满足**。入队触发 = LIVE-DRAIN-C1（transfer 逐 chunk 过缝）、ACK 触发 = LIVE-WINDOW-C1 第 3 帧；LIVE-DRAIN-C2 以 `advanceBy(100)` 零新帧 + `scheduler.pending()` 不增锚定禁 busy loop/禁轮询定时器 |
| AC5 `update-acked` 发射点与 `ackLatencyMs` t0 口径锚（= §24.8） | §2（`onUpdateAcked` @ `hub-namespace.ts:1416-1429`、`latencyMs = t1 − entry.sentAt` @ `update-channel.ts:303-305`、`sentAt` 推送时刻采样 @ `:450-461`）、§12 | **满足**。k=7/m=5 步进 ⇒ `ackLatencyMs = k+m = 12`；NC-5 变异（rekey 时重采样）下退化为 m ⇒ 正断言必红。发射点双侧归属由 LIVE-OBS-C1 锚定 |
| AC6 live update 成功路径与 β wire 逐字节等价 | §2（edge 盖章 `[8..12]`）、§12 | **满足**。控制帧逐字节 + 全轨迹骨架 `kind#sequence` 逐方向全等 + 数据帧文档语义等（#424 ORACLE-2：Yjs clientID/clock 随机 ⇒ 语义判据，A4.8 等价验收的既有先例口径）；NC-6 内容变异必报差异 |

非目标未被静默扩大：§1 明确排除 #449/#450/#451 范围、`sendQueueMs` 增补、性能断言；ALLOW/DENY（§11）与之一致。

## 4. Owner评论覆盖

| Comment ID | Updated at | Design section | Assessment |
|---|---|---|---|
| （无评论） | — | — | 简报 Comments 空数组 + 派工明示 REST 读取为空数组；设计 §4 双确认。无遗漏 |

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| S1 baseline = HEAD `321d951`（含 T1 `52e634b`） | §0/§2 采纳 | **复核一致**：`git log` HEAD = `321d951`（Merge PR #453），`52e634b` 在第二父链 |
| S2 pre-T1 `c86ccbc` 零 γ 公共面/夹具 | §3 采纳为历史红依据 | 接受（SA6 git 级实查；`c86ccbc` 为 spec 提交，在 log 中可见） |
| S3 T1 变更集按设计落地数据面机械 | §3 采纳 | **复核一致**：`task_issue-447_design.md` D4（`pendingSends` 独立键空间，:152-164）、D6（selfDrain 三触发点，:170-172）、D9（t0=推送时刻，:182-189）、D10（合并占用判据，:191-198）、D11（小限额真实分块）均明确列入 #447 变更集——T2 生产面被前序吸收是设计文本可证的事实 |
| S4 HEAD 生产面逐符号具备 | §2 锚点表 | **SA2 逐行复核 14/14 行全部命中**（tagCounter:96 / handleReceipt:161-177 / emitSeam:256-264 / selfDrain:271-277 / dataGateOpen:219 / onDataQueued+requestDataDrain:221-222 / 触发点③:176 / pendingSends:135-138 / effectiveInFlightCount:169-173 / onReceipt:198-209 / deliver 判据:261 / onAck:287-323 / 拆除判据:292-301 / latencyMs:303-305 / sendAndRegister γ 分支:450-461 / pullAndSendOne 判据:513 / 末 chunk γ 分支:585-598 / onSendReceipt:738-746 / onUpdateAck:1162-1169 / onUpdateAcked:1416-1429 / onReceipt fan-out hub-session.ts:309-315 / emitUpdateSentAtStamp hub-edge.ts:852-868）。「无上游事实与源码矛盾」成立 |
| S5 13/13 全绿 + 负控有牙 | §12 采纳 | **复核一致**：`contract-run.log`（13 passed, Type Errors no errors）、`-repeat5.log`（run 5: exit 0）、`-package-suite.log`（101 文件/897 用例 passed）、`-package-suite-precontract.log`（100 文件/884 用例，含 #447 三套件 15+7+8=30 全绿）。tsc 证据日志为空文件（见 §14-O1） |
| S6 剩余缺口 = 锚覆盖 | §3/§7-D2 固化为交付物 | 接受；`git status` 确认此前无 `issue448-*` 工件 |
| §24.2/A4.2 宿主传输义务（专用通道/FIFO/回执同步投递/违契响亮） | §6 表；LIVE-ORD-C1/C2 | 与协议/ADR 原文逐条对上（SA2 读回 §24.2.1-6、A4.2.1-3 原文） |
| §24.4/A4.2 两相记账（pending 自推送占窗、rekey 换键不换槽） | §2；LIVE-WINDOW-C1/C2 | 原文一致 |
| §24.5/A4.3 流控单点 edge、session 乐观发送 | §2（:219）；LIVE-WINDOW/DRAIN | 原文一致 |
| §24.6/A4.4 pacing（三触发点、推完即停、禁 busy loop） | §2（selfDrain）；LIVE-DRAIN-C1/C2 | 原文一致；AC4 只点名两触发点，第三触发点的 kind=0 数据面切片由 LIVE-DRAIN-C1 覆盖、sync/bootstrap 全回合面归 #449（边界显式登记，无静默缺口） |
| §24.8/A4.7 观测口径（update-sent@edge、update-acked@session、t0=推送时刻、跨线程无全序） | §2；LIVE-ACK-C1、LIVE-OBS-C1 | 原文一致；契约零跨线程事件序断言（仅单事件字段值 + 单通道消费序）符合「无全序」约束 |
| §24.3 缝词汇闭集合无 accounting 字段（`sendQueueMs` 整键缺席） | §7-D4；LIVE-OBS-C1 `not.toHaveProperty` | 原文一致（§24.3 表 + 「无拒纳/闸门/信用词汇」句）；登记缺面而非待实现面的定性正确 |
| A4.8 成功路径 β wire 等价（数据帧文档语义判据 = #424 ORACLE-2 先例） | §12；LIVE-PARITY-C1/NC1 | 一致；`issue424-sharded-hub.ts` 导出的 `framesHexEqual/controlFramesOf/dataFramesOf/skeletonOf/docStateOf/makeShardedReplicationFacade` 全部实存（SA2 逐一 grep 确认） |
| 模块 AGENTS 验证门 / γ append-only 缝纪律 / β 冻结 | §6、§7-D3、§11 DENY | 零生产改动 ⇒ 触发条件不满足；设计仍指定包级全量 + tsc（超最低要求）。DENY 与 AGENTS 边界一致 |
| #448 无 SA8 产物 | §6 以规范原文替代 | 属实（SA2 确认两文件缺席）；约束集全部继承自 #447 已过冲突门冻结面 + 规范原文，无新增协议决策 ⇒ 设计 §15 `requiresConflictRecheck: false` 的论证成立 |

---

## 6. 设计内部一致性

- **§0/§3/§7-D1 三处对 verification-only 的表述一致**，三路证据（规范→代码、git→历史、运行时→断言）在 §2/§5/§12 各自兑现，无前后矛盾。
- **§2 锚点表 ↔ 源码**：14 行锚点全部命中（见 §5-S4），无死引用、无行号漂移、无旧 API。
- **§2 ↔ §8 状态机**：`queued → 直发 → pendingSends[tag] --receipt--> inFlight[seq] --ACK--> ok/zombie/violation` 及弃置路径（`abandonInFlight` @ `update-channel.ts:671-680` → `abandonedTags` → 迟到回执 `zombieSeqs.add` @ `:203`）与源码逐点一致。
- **§7-D5 ↔ §12 ↔ 证据日志**：43/43 = 13+30、101 文件/897 用例 = 100+1 文件/884+13 用例，数字自洽；`vitest.config.ts:15` include 逐字命中（SA2 实读确认恰在第 15 行）；包 `tsconfig.json` `include = ["src/**/*.ts", "test/**/*.ts"]` 覆盖两新文件。
- **§7-D3 ↔ diff**：`issue447-async-seam.ts` 改动恰 +10 行（7 行 doc-comment + 成员、3 行条件展开），append-only、缺省零传，与描述逐字一致；`createHubReplicationEdge` 的 `observer` 选项为真实生产面（`hub-edge-host.ts:165` 声明、`:924` 透传）。
- **§10 调用方矩阵 ↔ git status**：生产 `src/**` 零 diff；唯一被触碰既有文件的消费方（#447 三套件）已列并给出复跑证据。
- **无「附录承认但正文未改」的伪修订**：本设计无前版，iteration 0 全新建。

## 7. 状态机与并发攻击

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| SM-1 | pendingSends[tag] 已登记 | 同一 tag 的回执**重复**投递（宿主 FIFO 违约） | 第二次投递 tag 已出未决集 ⇒ `CONNECTION_POLICY_VIOLATION` 响亮（`hub-session-async-host.ts:168-171`） | 无（既有行为，代码锚定；#448 契约未显式注入重复回执——非 AC 要求，NC-1/NC-2 已锚同族违契响亮语义） | 无 |
| SM-2 | 回执消费中 | 回执携带伪造序（非 [1, 0xffffffff] 整数） | 响亮 `CONNECTION_POLICY_VIOLATION`（`:163-167`） | 无（同上；夹具回执由 edge egress 返回值生成，伪造需新注入旋钮，非本票 AC） | 无 |
| SM-3 | pending-only 占用（inFlight 空、pendingSends 非空） | ackTimeout 到期 | `hasUnsettledSends()` 合并判据 ⇒ 计时器不哑火 ⇒ `abandonInFlight` + `RESYNC_REQUIRED` 恰一次（LIVE-ACK-C3 锚定） | 无 | 无 |
| SM-4 | 回执被扣留、ACK 已缓冲 | 宿主乱序投递（ACK 先行） | `onAck` 见未登记序 ⇒ violation ⇒ `connectionFatal('ACK_STATE_VIOLATION', 1002)` 响亮、零结算（NC-1 锚定；零 park/零静默） | 无 | 无 |
| SM-5 | 窗口满（2 pending） | 只放回执（rekey） | 占用守恒：第 3 帧仍不过缝、零 `update-acked`（LIVE-WINDOW-C1 中间态锚定） | 无 | 无 |
| SM-6 | 弃置后（abandonedTags） | 迟到回执 + 迟到 ACK | 回执揭示序 ⇒ zombie 登记 no-op；ACK ⇒ `'zombie'` 良性零结算零 fatal（LIVE-ACK-C3） | 无 | 无 |
| SM-7 | transfer 进行中（kind=0） | 中间 chunk 回执 / 末 chunk 回执 | 中间 chunk 零占位零事件；末 chunk tag 入 pendingSends（chunked:true）、回执结算触发 drain（LIVE-DRAIN-C1） | 无 | 无 |
| SM-8 | 连接终态（closed） | 迟到回执 / 迟到帧 | 终态静默门（`handleReceipt:162`/`handleFrame:121`，A4.5）；close 冲刷 pending 属 #450（边界登记于 §1/§11） | 无 | 无 |
| SM-9 | 任意 | 进程重启 / 持久化恢复 | N/A——本票零生产改动、零持久化面；γ 账本为内存态且随连接收口清空（`teardown` 清 `abandonedTags`/`pendingSends` 既有） | 无 | 无 |

**并发口径**：γ 单会话单句柄；契约以显式 release + 手动时源消除竞态（设计 §9 与 SA6 §7 一致）。变异负控均在 `finally` 恢复生产原型（SA2 读回两个变异用例确认），无跨用例污染。

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| ER-1 | 缝字节不可解码 | `MALFORMED_FRAME` 响亮收口（`hub-session-async-host.ts:128-131`），设计 §9 锚定 | 无静默降级 | 无 |
| ER-2 | ACK 引用未登记序 | `ACK_STATE_VIOLATION`(1002) 连接收口（`hub-namespace.ts:1165-1167`）；NC-2 注入证明响亮 | 违契绝不被吸收 | 无 |
| ER-3 | 发送拒绝（seq≤0） | 采样失败明细 → `discardQueued` + `send-failed` resync（`update-channel.ts:437-445`，§8 数据流表登记） | 既有语义，#448 不改 | 无 |
| ER-4 | 契约断言失效（未来重构漂移） | 变异敏感性矩阵（NC-4 窗口 / NC-5 t0 / NC-6 内容）+ 违契注入（NC-1/2/7）证明判据有牙；包全量把契约纳入每次回归（§13-R1） | 契约腐化风险已缓解 | 无 |
| ER-5 | 反向诊断被推翻（某 AC 场景真红） | §7-D1 备选 (c) + §13-R4 登记触发条件：按 Controller 流程重开诊断，不预写投机生产面 | 处置路径明确 | 无 |

无「fallback 掩盖正常路径不变量」形态：验证对象全部响亮收口或良性 no-op（zombie），后者是 β 同构的登记语义而非伪成功。

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| 生产公共面（`src/index.ts`、wire 帧、缝词汇、schema、持久化） | 无——零生产改动 | `git status --porcelain`：`src/**` 零 diff | 无 |
| `makeAsyncReplicationFacade` 既有消费方（#447 三套件） | 无——`edgeObserver` 缺省零传 = 行为逐字不变 | diff 仅条件展开；precontract 日志 15+7+8=30 全绿（含 append 后实跑） | 无 |
| 新消费方（`issue448-live-seam.ts`） | 无——经 boot adopt 装配 + registry 同一性前提断言（`:100-108`，错位装配场景前置即红） | SA2 读回夹具全文；imports（`driver.boot`/`harness.settle`/`issue447-async-seam.*`/`issue424-sharded-hub.*`）逐一实存 | 无 |
| CI/根门禁采集面 | 无——新增 1 文件逐字命中 `vitest.config.ts:15`；无配置改动 | 包全量 101/897 实跑证据 | 无 |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| tag 分配/校验、回执入口、自驱 drain | γ session 句柄（`hub-session-async-host.ts`） | §2 锚点（验证对象） | 正确Owner，无复制 |
| 两相记账/窗口/onAck 判别 | `UpdateChannel` 单份实现 | §2（α/β/γ 共享，`pendingSends` 无条件字段退化） | 正确；无第二状态机 |
| wire 序盖章 + `update-sent` | edge mux（`hub-edge.ts`） | §2 | 正确（§24.5/§24.8 单点） |
| 违契收口 | edge `connection-fatal` 映射 / namespace 漏斗 | §2/§9 | 正确 |

应用层（测试夹具）只做编排与观测投影，零协议决策——符合「应用层可编排、不复制底层状态机」。

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| γ 数据面窗口/超时锚 | #447 PEND 族（`task_issue-447_sa6_contract.md`） | 复用同一夹具与装配面（`makeAsyncReplicationFacade`） | 一致 | LIVE-* 是 PEND 族的 AC 专属场景扩展，非平行机制 |
| β parity 判据 | #424 ORACLE-2（`issue424-sharded-hub.ts` helpers） | 直接 import 复用 | 一致 | 不重写等价性判据 |
| verification-only 先例 | #316（能力在 HEAD 已交付 → 契约交付 → approve） | 同构裁定 | 一致 | 先例文件在场 |
| `update-sent` 可观察性 | 生产 `createHubReplicationEdge` 的 `observer` 选项（`hub-edge-host.ts:165/:924`） | 夹具 append-only 接线 | 一致 | 补接线而非新观测通道 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| wire 序 | edge 盖章返回值 | 回执、事件 `sequence`、测试断言全部回读该事实 | 无第二事实源 |
| 窗口占用 | `effectiveInFlightCount`（单点） | 契约以帧数/事件数外部观察，不镜像内部账本 | 无 |
| tag↔序配对 | `probes.stamps`（夹具记录的盖章事实） | 断言回读，不推导 | 无 |

### 生命周期对称性

N/A（零生产改动；测试内 boot/teardown 由 driver 既有机械承担；变异负控 `finally` 恢复对称）。

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 第二套 γ 夹具 | `issue447-async-seam.ts` | `issue448-live-seam.ts` 复用之 | 非重复（仅 thin 装配层，registry 同一性断言防漂移） |
| 第二套 parity 判据 | #424 helpers | import 复用 | 非重复 |
| 第二观测通道 | edge `observer` 生产选项 | 夹具注入 | 非重复（§7-D3 否决独立夹具的理由成立） |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW LIST 5 项 ↔ worktree 实状 | `git status`：2 新测试文件、夹具 M（+10）、5 日志、设计文件——逐一对应，无未列改动 | 无 |
| DENY `src/**`、规范文档、AGENTS、`replication-protocol/**`、根配置 | 与「零生产改动/零语义变化」裁定一致；`sendQueueMs` 增补显式另票 | 无 |
| 相邻票边界（#449/#450/#451） | §1 非目标 + §11 DENY + LIVE-DRAIN-C1 收窄至 kind=0 切片，三处一致 | 无 |
| DENY 行措辞「`issue447-*.test.ts` **之外的**既有 #447 套件语义」 | 意图可辨（= #447 三个 .test.ts 文件本体不许改，ALLOW 内夹具 append 除外），但字面可误读为「除这些文件外的一切」 | 见 §14-O2（措辞级，不阻断） |
| `artifacts/` 日志入库 | 仓库既有惯例（375 个已跟踪 artifacts 文件）；.gitignore 不排除该目录 | 无 |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1–AC6 → 13 条运行时锚 | 契约文件（SA2 逐条读回）：全部为行为断言（wire 帧 kind/序、`[8..12]` 配对、消费序下标、observer 单事件字段值、文档快照逐值）；零源码 grep、零 skip/only/todo、零 env override | 无 | 无 |
| 断言非恒真 | NC-1/2（违契注入响亮）、NC-4/5（变异逼红正断言：SA2 读回变异代码确认其确实改变被测判据）、NC-6（内容变异）、NC-7（时间/泵零驱动） | 无 | 无 |
| 「旧实现真红」的诚实性 | 不伪称红灯：历史红依据 = pre-T1 `c86ccbc` 零 γ 面（S2）+ #447 红灯契约沿革；基线绿 + 变异敏感性为替代证据 | 处置诚实（verification-only 票的正确姿态） | 无 |
| 测试入口真实 | 根 `vitest.config.ts:15` 逐字命中；包 tsconfig `include` 覆盖两新文件；实跑日志 13/13、101/897 | 类型门的日志证据偏薄（空文件、未记录 exit code） | 见 §14-O1 |
| 回归面 | #447 三套件 30/30（precontract 日志实含）+ γ 族四文件 43/43 命令 + 包全量 | 无 | 无 |
| 验证命令可复现 | §12 四条命令 + 环境条件（node/pnpm/vitest/tsc 版本 + `NODE_OPTIONS=--conditions=nomicore-source`，与仓库脚本同款） | 无 | 无 |

## 13. Required revisions

无 BLOCKER / MAJOR finding。

## 14. Non-blocking observations

- **O1（MINOR，证据卫生）**：`artifacts/sa6-issue448-package-tsc.log` 为 0 字节空文件，未记录 exit code；且根 `vitest.config.ts` 的 `typecheck.include` 仅覆盖 `**/*.test-d.ts`，故运行日志中的「Type Errors no errors」**不**覆盖两个新文件（`ws-replication-issue448-live-data-plane.test.ts` / `issue448-live-seam.ts`）的类型检查。SA2 已逐 import 静态核验两文件引用的导出全部实存（`driver.boot`/`harness.settle`/`FIXED_MS`/`issue447-async-seam` 十余个导出/`issue424-sharded-hub` 六个 helper），类型风险低；建议实现/验证阶段重跑 `npx tsc -p packages/ws-replication/tsconfig.json` 并把 exit code 显式追加进证据日志（如 `echo exit=$?` 行）。
- **O2（MINOR，措辞）**：§11 DENY 行「`packages/ws-replication/test/issue447-*.test.ts` 之外的既有 #447 套件语义」字面可误读；建议改为「既有 #447 套件三个 `.test.ts` 文件本体（ALLOW 所列夹具 append-only 除外）不得修改」。意图与 ALLOW/正文一致，不影响实施。
- **O3（TRIVIAL）**：两份新工件文件权限为 0600（其余测试文件 0664）；git 仅记录可执行位，无实际影响，落盘时随仓库惯例归一即可。
- **O4（登记，非缺口）**：重复 tag 回执 / 伪造序回执两类宿主违契在源码有响亮收口（§7 SM-1/SM-2），#448 契约未为其新增注入旋钮——非本票 AC 要求，同族响亮语义已由 NC-1/NC-2 锚定；如 #450（生命周期/账本面）需要可顺势补锚。

---

## 15. 复核结论

- verification-only 裁定（§7-D1）：**维持**。三路证据 SA2 独立复核全部成立，且 SA2 未发现任何「AC 要求而 HEAD 缺失」的行为面。
- `requiresConflictRecheck: false`：**同意**。零生产语义变化；约束全部继承自已过 #447 冲突门的冻结面与规范原文；本评审未发现新增协议决策或 ADR 冲突风险。
- 后续路由建议：SA3 按 §7-D2/§12 落盘与守门（重点补 O1 的类型门 exit code 证据）；SA7 活链路复核时以 §12 命令为准。
