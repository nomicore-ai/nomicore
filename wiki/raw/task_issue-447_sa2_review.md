# task_issue-447 SA2 设计攻击评审（第 2 轮，对修订版设计）—— γ-T1：公共异步会话工厂 + FIFO 管道夹具 + 首个跨缝协议回合

- 评审对象：`wiki/raw/task_issue-447_design.md`（SA1 设计**修订版**，668 行；基线 HEAD `c86ccbc`）
- 评审人：SA2（独立设计攻击；不修改设计/代码/测试，不运行测试，不派发其他 SA）
- Verdict：**`approve`**（无 BLOCKER / 无 MAJOR。首轮 F1（ack-timeout 占用判据哑火）与 F2（γ 分块机械零可执行覆盖）经源码级核验**均已闭合**；SA8 E1/E2 两项阻塞在设计内闭合、E3 已登记；O1–O7 全部处置。余留 4 条非阻断观察，见 §14）
- 本文件为唯一评审产物；`requiresConflictRecheck = false`（本轮**未发现设计 §15 已申报集合之外的新 ADR 冲突风险**；设计自行申报的复查集合（公共面扩张、§8.6.1 计时器语义实现形态裁定、D9 观测口径实现一致性、D12 模块契约登记）经核实确有必要，按其 §15 与 SA8-R5 执行即可）
- 评审历史：第 1 轮（本文件前一版本）verdict `reject`（F1/F2 两 MAJOR + O1–O7）；本轮为修订版复核，原位更新。F1/F2 的闭合核验见 §5a/§12a。

---

## 1. Reviewed inputs

| 输入 | 位置 | 状态 |
|---|---|---|
| Host 任务简报 | `wiki/raw/task_issue-447.md` | 已读（AC 6 条；Comments 空） |
| SA1 设计（修订版） | `wiki/raw/task_issue-447_design.md`（668 行） | 已读全文（含新增 §7-D9/D10/D11/D12、§8.6.1、§12 CHUNK-C1/C2/C3、PEND-C3、§13-R6、§14 修订映射） |
| 首轮 SA2 评审 | 本文件前一版本（F1/F2 + O1–O7） | 已读；逐条闭合核验见 §5a/§12a/§14 |
| SA6 契约 | `wiki/raw/task_issue-447_sa6_contract.md`（approve；6 GAP + 4 ORACLE/NC；§12 契约条目 PUB/SEAM/PIPE/PEND/ANCHOR/ROUND/TD） | 已读全文 |
| SA6 探针 | `task_issue-447_sa6_capability_probe.mts` + `artifacts/sa6-issue447-*.log`（8 份） | 存在性核验（SA6 §13 证据） |
| SA8 设计后冲突报告 | `wiki/raw/task_issue-447_design_conflict_report.md`（iteration 0，verdict `reject`：E1/E2 阻塞 + E3 裁决 + R1–R5） | 已读全文；闭合核验见 §5 |
| SA8 前置门禁产物 | `task_issue-447_relevant_decisions.md` / `_conflict_report.md` | 不存在（设计与 SA8 报告均已声明；决策集以 SA8 报告 §2 盘点 + SA6 §3 硬约束 + ADR/协议文本补位） |
| 规范权威 | ADR 0032（含附录 A4，`:55-99` 原文复读）、协议 §24（`docs/protocols/instance-replication-v1.md:1091-1154` 原文复读）、`CONTEXT.md` SessionHost γ 段 + 序回执词条（`:229-241`） | 已读原文逐条比对 |
| 模块契约 | `packages/ws-replication/AGENTS.md`（:17 缝词汇枚举句 + Verification 节「Run the focused tests for every changed state-machine path」） | 已读（本轮经系统注入原文核对） |
| 源码核验 | `src/{index,hub-split,hub-session,hub-session-host,hub-namespace,round-engine,update-channel,bulk-transfer,hub-edge,hub-edge-host,frame-io,types,validate}.ts`、`test/{driver,issue424-sharded-hub,issue420-shim-hub}.ts`、`test/ws-replication-issue424-cross-seam-round.test.ts`、`test/ws-replication-{issue256-namespace-failed,issue300-bulk-edge-ac,ac3-bootstrap,issue233-repro}.test.ts`、`vitest.config.ts` | 逐点核验（证据见 §5/§5a/§7-§12 各表） |

缺失输入不阻断：Issue 评论 REST 快照为空（dispatch 明示，两轮一致）；关键事实均可独立核验。

## 2. Verdict

**`approve`**。修订版设计对首轮两 MAJOR 的闭合经源码级攻击核验成立，且修订未引入新的阻断缺口：

- **F1 闭合（§8.6.1/D10）**：`hasUnsettledSends() = inFlight.size + pendingSends.size > 0` 的合并占用判据 + `onAck` 拆除判据扩展 + `abandonInFlight` 清 pending + 产生/消灭点归纳论证——与 `update-channel.ts` 现状机械逐点吻合（见 §5a）。α/β 下 `pendingSends` 结构恒空 ⇒ 谓词逐值退化为既有判据，β 矩阵逐字节保持有结构保证；PEND-C3 断言 + 变异负控 + β 矩阵绿构成可执行验收。
- **F2 闭合（D11/§12 CHUNK-C1/C2/C3）**：真实分块 γ 场景升为硬门；小限额注入路线经 #256（`limits: { maxBootstrapBytes: 8, maxChunkedBootstrapBytes: 16 }`）与 #300（`maxSyncDiffBytes: 32KiB` + 100KB 写放大，`:255-263`）先例核验可行；构型约束链与 `validate.ts:160-204/:246-262` 实文一致（PROTOCOL_OVERHEAD_BYTES=128、64×maxUpdateBytes 上限、双侧 `boot({limits})` 注入点 `driver.ts:522/:550` 均核实）；descope 备选的否决理由（简报 AC「协商位两形态」+ SA6 §12.2 契约本身要求 CAP 位两形态各跑一次 + A4.4 触发点③）成立——descope 反而会违反已批准契约，路线 (a) 是唯一自洽选择。
- **SA8 E1/E2 闭合**：E1 经路线 (a)（`pushedAt` 推送边界采样、append-only 第三参、`chunkedAckT0 = pushedAt ?? sampleAckT0()`），与 §24.8:1152/A4.7:95 登记文本「t0 = 推送时刻（含管道与 edge 等待，口径略宽于 β）」逐字对齐，规范零改动；`onLastChunkSent` 追加尾参与 `bulk-transfer.ts:62-67` 登记的 #300 冻结锚约束（L195 绑定 `number | undefined`）兼容。E2 经 D12：`packages/ws-replication/AGENTS.md` 入 ALLOW，append-only 登记句与 :17 现句及 §24.3 词汇表一致。
- 需求、Owner 要求（= 简报正文）、SA6 契约条目、状态机/并发/恢复、调用方、架构一致性、文件范围、验收设计（§3-§12）经攻击未发现 BLOCKER/MAJOR。

`pass` 仅表示设计通过审查；实现期 SA4/SA7 仍须对活链路验证（含 SA8-R5 重跑与 §15 各项）。

## 3. 需求覆盖

| Requirement（简报 What to build / AC） | Design section | Assessment |
|---|---|---|
| γ 公共工厂/句柄面，`src/index.ts` append-only；β 冻结面逐字不动 | §8.1、§11（PUB-C1/C2、TD-C1/C2）、DENY `hub-session-host.ts` | 覆盖。6 个新导出（1 值 + 5 类型，值导出 15→16）全篇口径一致（O1 已修，grep 证实无「7」残留）；β 复用纯 JSON 描述子可行（`HubSessionHostConfig`/`HubSessionOpenInput`/`HubSessionSignal` 均不跨缝、改动零触碰 β 文件） |
| 出站帧携 tag fire-and-forget；入站 `handleReceipt(tag, sequence)` | §8.2、§8.3 | 覆盖。签名逐字按简报；tag 句柄域自 1 单调（§24.2.4）；`handleReceipt` 入口域检查 + 未决集判别单点在 port 层；`emitSeam` 未注册 sink ⇒ 0 且零登记（β `deliverFrame` `hub-session-host.ts:214-219` 逐字同构，已核验） |
| 第三种 port 形态 + pending 两相记账（控制面先行） | §8.4、§8.6、**§8.6.1**、§8.10 | 覆盖。两相记账 + **ackTimeout 有界性机械成立（F1 闭合，§5a）**；γ port 形态镜像 β adapterPort（`hub-session-host.ts:180-213` 逐成员比对：dormant 面/闭包回放/装配槽守卫均同形，仅 `onDataQueued/requestDataDrain → selfDrain` 为 γ 差量，D6 授权） |
| `bootstrapSnapshotSeq` 三态；BOOTSTRAP_ACK 到达时锚已回填（保序结构性保证，非 park） | §8.5、§9.3（D7） | 覆盖。`SendAnchorState` 三态 + pending-at-ACK 响亮违例；判别点现状（`hub-namespace.ts:665-671`、`round-engine.ts:175-176,191-192`）与设计锚点引用一致（已核验）；分块锚 pending 相位由 `pendingLastChunkTag` 载体承载、回执结算点回填——与 `round-engine.ts:241-245` 现注释（「清锚必须在调用之前」/因果依据改判保序条款）自洽 |
| 每 (连接, namespace) 一对专用 FIFO 通道；延迟可注入显式异步内存管道；零 worker_threads；夹具零协议决策 | §8.8（D8） | 覆盖。显式 release / 零自动投递 / reorder/dropReceipts/withhold 旋钮满足 PIPE-C1/C2 与负控敏感性；零线程由既有 420 结构门自动覆盖新 src 文件 |
| 宿主桥样例（test-only：ingress 同步取盖章序、异步投回执） | §8.7（D3） | 覆盖。桥 sink 形状与 `HubNamespaceSessionSink`（`hub-edge-host.ts:91-106`）成员集逐一吻合（已核验）；egress 返回值契约（`:119-123`「返回盖章后 wire 序；0 = 未发送/被拒」）逐字核实；§24.2.3「盖章点同步投回执」经「同一同步段入队 + 同通道 FIFO」兑现 |
| OPEN→bootstrap→close 回合与 β wire 逐字节等价（复用 issue424 断言族） | §8.9、§12（ROUND-C1/C2/C3） | 覆盖。三层判据 + nonce 钉死；断言族实存（`issue424-sharded-hub.ts:594 rawSequence / :651 skeletonOf / :658 docStateOf / :686 framesHexEqual`，已核验）；**单帧与真实分块两构型各跑（F2 闭合）** |
| 新公共面 test-d 快照（#420 先例） | §12（TD-C1/C2） | 覆盖。4 条负控 ≥3；`vitest.config.ts:16-20` include 覆盖新 `*.test.ts` 与 `*.test-d.ts`（已核验） |

目标/非目标无静默扩大：421 test-d 既有红（B1）另票、β facet dormant（R5）、sessions Map 累积（R10）、回执序单调加固（R11）均登记 follow-up，未混入本票，也未以 follow-up 掩盖本票必要项（对照 §11 末列逐行核验）。

## 4. Owner评论覆盖

Issue 评论 REST 快照为空（简报 `## Comments` 空；dispatch 明示 no owner requirements）——**无评论 ID/updated_at 可映射**，与 SA6 §2、SA8 报告 §1 一致。Owner 要求 = 简报正文，逐条覆盖见 §3。无缺口。

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| GAP-1/2/3（导出面 15 = β 集；β 句柄 5 成员；γ 词汇零命中） | §8.1 新公共面 + §8.2 词汇闭集合 | 成立 |
| GAP-5 + H4（盖章点同步携序、edge 接线丢弃、无需新 mux 钩子） | D3：回执生产 = 桥消费 egress 返回值，edge 零改动 | 成立。`frame-io.ts:184-198`（`emitOne` 写 `[8..12]` + `emitRaw(bytes, sequence)` + 返回序）与 `hub-edge-host.ts:118-130/:691-699` 逐点核实 |
| GAP-6（锚两态）+ ORACLE-3（回 0 ⇒ `ACK_STATE_VIOLATION`） | §8.5 三态锚 + D7 pending-at-ACK 响亮违例 | 成立 |
| β 冻结面 append-only（SA6 §3-1） | §8.1/§11 DENY | 成立 |
| 零 worker_threads/MessageChannel/MessagePort（SA6 §3-2） | §8.2/§8.8 + PIPE-C3 | 成立 |
| 盖章单点 + session 恒占位（SA6 §3-3） | §8.3 | 成立 |
| 保序条款 + 违契响亮收口（SA6 §3-4 / §24.2.3/§24.2.6） | §8.3/§8.7/§9.1 | 成立。CONTEXT 序回执 `_Avoid_` 五条逐条不触碰（不重检入站序、不伪造序、不迁移分配权、同道 FIFO、无拒纳词汇） |
| 两相记账 + 窗口唯一口径（SA6 §3-6 / §24.4） | §8.6 + **§8.6.1** | 成立（F1 已闭合，见 §5a）；`takeItems` 裸口径例外注记（O3）已补 |
| 流控单点 + 无拒纳词汇（SA6 §3-7 / A4.3/§24.5） | D5 dormant 面 | 成立。γ port `dataGateOpen:()=>true`/`bufferedAmount:()=>undefined` 与 β 工厂 port（`hub-session-host.ts:184,210`）同形；`hub-session.ts:210-262` 共享闸门前置在 γ 下自然 no-op（已读源码确认两条 send 路径的门前置形状） |
| A4.6 回执 ≠ 接纳信号 | §8.2/§8.6 | 成立。receipt 键集恰 `{tag,sequence}`；selfDrain 触发点③为 A4.4 明文授权 |
| 观测口径（A4.7/§24.8） | D9、§9.5 | 成立。**E1 已按路线 (a) 闭合**：`chunkedAckT0 = pushedAt ?? sampleAckT0()`（`hub-namespace.ts:608/:780` 两写点）实现「t0 = 推送时刻、口径略宽于 β」的登记文本；α/β `pushedAt` 缺省 ⇒ `sampleAckT0()` 原值原点、逐字节不变；`update-sent` 留 edge 盖章点（`hub-edge.ts:269/:852 emitUpdateSentAtStamp` 实存核实）、`sendQueueMs` 整键缺席 = #423 已登记 dormant 形态 |
| 包边界 + 行为判据优先（SA6 §3-9） | §11/§12 | 成立 |
| **SA8-E1/R1（阻塞）** | D9 路线 (a)、§13-R4 闭合登记、CHUNK-C3 | **已闭合**。SA8 合格路径 (a) 的字面要求（「在 `pendingLastChunkTag` 结算条目携带推送时刻——设计自身的 `sentAt` 机制同构」）逐字兑现；无 follow-up 让渡、无规范改动 |
| **SA8-E2/R2（阻塞）** | D12、§11 ALLOW 新行 | **已闭合**。`packages/ws-replication/AGENTS.md` 入 ALLOW，append-only 登记句（引 A4 + §24、无拒纳词汇、冻结面零触碰）与 :17 现句兼容；与代码同变更集落盘 |
| **SA8-E3/R3（非阻塞）** | §8.5 末注、§6、§13-R1 | 已登记（按 SA8 裁决读法执行；amendment 留后续 docs 票） |
| A4.1「channel 零改动」vs A4.2/§24.4 载体落点张力 | §8.5 注（SA8-E3 裁决读法） | 维持首轮判：读法可辩护、处置正确（不静默改 ADR、交 SA8 已裁决、§15 复查登记） |
| SA8-R5 复核义务 | §15（requiresConflictRecheck: true，5 项理由） | 恰当——本轮核验其申报集合完整覆盖修订新增面（§8.6.1 计时器语义、D9 代码路径一致性、D12 落盘），无漏报 |

### 5a. F1 闭合核验（SA2 首轮 MAJOR；源码级）

首轮 F1：γ 下「全部在途仍 pending（`inFlight` 空、`pendingSends` 非空）」时 `armAckTimer` 回调守卫 `if (this.inFlight.size > 0)`（`update-channel.ts:607`）使计时器哑火拆除；且其后 rekey 进 `inFlight` 时计时器已拆 ⇒ 在途条目永失超时锚。

修订核验（对照 `update-channel.ts` 全文 622 行逐点）：

| 修订声称 | 源码核验 | 结论 |
|---|---|---|
| 占用产生点全部武装：`sendAndRegister`（`:382 inFlight.set` → `:394 armAckTimer`）与 `sendOneChunk` 末 chunk（`:500` → `:517`） | grep 证实 `inFlight.set` 全文件恰两处（:382/:500），两处均同点 `armAckTimer`（:394/:517）；γ async 分支声明在「既有 seq<=0 拒绝判据之后」同点 `pendingSends.set + armAckTimer` | 成立——产生点封闭 |
| 占用消灭点仅三处：`onAck` delete（:228）、`abandonInFlight`（:576 clear）、`teardown`（:589 clear） | grep 证实 `inFlight.delete/clear` 恰此三处；`discardQueued`/`markResyncReceived`/`discardForConnectionPressure` 只清队列与 activeTransfer，不触 inFlight | 成立——消灭点封闭 ⇒ 归纳前提为真 |
| `onAck` 拆除判据扩合并占用（:229）+ `wasOldest` 重锚 disarm+arm 原子（:231-235） | 现码 :229 `if (this.inFlight.size === 0) disarm`、:233-234 原子重锚——扩展点定位准确；重锚分支占用非零 ⇒ 重挂后仍武装 | 成立 |
| rekey 不触碰计时器（占用守恒）⇒「占用非零而计时器已拆」不可达 | 推演核验：tag 在 pendingSends 期间，计时器只能经三消灭点拆除，而三处均要求合并占用归零或整体清空（清空后该 tag 已不在 pendingSends，回执落 no-op）——中间态确实结构性排除 | 成立（SM-1-②③ 消除） |
| pending-only 下回调触发 abandon：`hasUnsettledSends()` 真 ⇒ `abandonInFlight`（清 pending + needsResync + `onAckTimeout` → `declareHubResync('ack-timeout')`） | `abandonInFlight`（:571-581）现状 + γ 扩展（入口清 pendingSends）与 hub 接线（`:245-267` → `:1290-1327` 记忆化漏斗）链路成立 | 成立——§24.4「ackTimeout 锚定与单体内核同构」机械兑现 |
| activeTransfer 槽不计入判据的理由 | `update-channel.ts` 现状：kind=0 中间 chunk 零注册零计时器（:468-469/:518-520）、末 chunk 出站即注册；kind=1 由宿主 bootstrap timer 覆盖（`hub-namespace.ts:624-625` 注释「覆盖排队等待+逐帧传输+ACK 等待」实存）、kind=2 自持 timer（`bulk-transfer.ts:217/:253-265`） | 成立——管辖面划分与三类载体超时锚一一对应，无无锚占用 |
| α/β 退化同构 | `pendingSends` 为无条件私有字段、async 分支全部经 `asyncSendTickets` 位门控；位缺省 ⇒ 恒空 ⇒ 谓词逐值 ≡ 既有判据 | 成立——β 矩阵逐字节保持有结构保证（PEND-C3-④ 硬门复核） |

**结论：F1 闭合成立。** 验收面 PEND-C3（扣留 + 虚拟推进 ⇒ RESYNC_REQUIRED×1 + needs-resync + 槽位释放 + 迟到回执良性 no-op + 变异红 + β 矩阵绿）与首轮 acceptance 要求逐项对应。

## 6. 设计内部一致性

- 导出计数：全篇统一 6（1 值 + 5 类型；15→16）；grep 证实无「7 个新导出」残留。✓（O1 闭合）
- 词汇表（§8.2）↔ §24.3 原文逐消息比对一致；receipt 键集 `{tag,sequence}` 在 §8.1/§8.2/§8.3/§12 SEAM-C3 间一致。
- §8.6.1 伪码 ↔ §9.1 违例表 ↔ §12 PEND-C3 ↔ 数据流路线表（窗口记账行）四方一致；「被弃 tag 迟到回执 = 良性 no-op（zombie 同构）」在 §8.6.1 注释/§9.1/§9.3 三处口径一致，且与 β 现状（`zombieSeqs` 消费后第二次 ⇒ 'violation' 响亮，:252-256）同构——γ 的对应形态（unresolvedTags 删除后第二次投递 ⇒ 入口响亮）由 §8.3 入口判别自然给出，一致。
- D9 的 `pushedAt` 机制 ↔ §8.6 bulk 段 ↔ §8.5 表（分块锚回填时点）↔ §9.5 ↔ CHUNK-C3 五处一致；`onLastChunkSent` 追加尾参与 `bulk-transfer.ts:62-67` 的 #300 冻结锚登记（尾参可省略、既有绑定不变）兼容。
- §8.9 回合数据流（含分块形态段）与 β golden trace（SA6 §13）一致；`receipt{1,2}` 先于 `receipt{2,3}`、ACK 前回执已消费的推导与 FIFO 机械一致。
- §10 调用方矩阵：生产调用点（`hub-connection.ts:344`、`hub-session-host.ts:106`）与 `hub-edge-host.ts:931-938` 装配段标注均核实正确（O2 闭合）；测试调用点枚举仍不全（见 O-1，非阻断）。
- §14 修订映射表逐条与正文落点核对无伪修订（「只在附录承认、正文未改」形态不存在：F1/F2/E1/E2 均有正文机械 + §12 测试行实体）。
- §13-R6 构型约束链与 `validate.ts` 实文一致：`maxBootstrapBytes ≤ maxFrameBytes − 128`（:160-165）、`maxQueuedControlBytes ≥ maxBootstrapBytes + 128`（:183-187/:201-205）、显式 `maxChunkedBootstrapBytes/SyncDiffBytes ≤ 64 × maxUpdateBytes`（:246-262，激活门=显式表达）；可行带（8–256 / 64–512 / 4096 级）数学自洽（4096 ≤ 64×64）。

## 7. 状态机与并发攻击

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| SM-1（首轮 F1 场景） | γ 数据面：仅 pendingSends 占窗（inFlight 空），ackTimer 已武装 | 记账 timer 推进 `ackTimeoutMs`（缝扣留） | `abandonInFlight`：弃置 + needsResync + `declareHubResync('ack-timeout')`；迟到回执良性 no-op | **无（已闭合）**——回调判据合并占用（§8.6.1），产生/消灭点归纳排除哑火与失锚中间态（§5a） | — |
| SM-1b | pending 项在途，回执到达（rekey）后 timer 又到期前 ACK 到达 | onAck 释放末槽 | 合并归零才 disarm；期间武装保持 | 无（判据扩展覆盖混合态；「inFlight 空而 pending 非空」时保持旧锚武装 = 保守有界，行为方向安全） | — |
| SM-2 | bootstrap 单帧锚 `{pending,tag}` | BOOTSTRAP_ACK 先于回执（宿主违契注入） | 响亮 `ACK_STATE_VIOLATION` + close 1002，零 park | 无（D7 + 判别 `:665-671`） | — |
| SM-3 | 锚 idle（复位后） | 重复/unsolicited BOOTSTRAP_ACK | 响亮违例 | 无（ANCHOR-C1 已含） | — |
| SM-4 | 回执消费 | 未知 tag / 非法 sequence / 重复投递 | `CONNECTION_POLICY_VIOLATION` 响亮（重复投递 = tag 已出未决集） | 无（§8.3 入口单点；被弃 tag 首次投递例外 = zombie 同构，§9.3 显式登记） | — |
| SM-5 | close/fatal 后 | 迟到回执/帧 | 静默 no-op（A4.5 防御面；SA8 #7 已裁决不冲突） | 无（§8.3/§9.2） | — |
| SM-6 | 会话开启 | 重复 `(connectionKey, namespaceId)` | 响亮 throw | 无（β 先例 `hub-session-host.ts:243-257` 同形，已核验） | — |
| SM-7 | selfDrain 运行中 | 再入（onDataQueued / 入站消息后 / 末 chunk 回执结算后） | 有界终止（每 pull 消费队列项或一 chunk） | 无（D6；显式 release 夹具下无同步递归路径——出站只入缓冲，结构上排除重入环） | — |
| SM-8 | kind=2 awaiting-ack（末 chunk 已推、回执在途） | 自持 ACK timer 先于回执触发 | 载体弃置 + resync；迟到回执 no-op；迟到 SYNC_APPLIED ⇒ 响亮 `SYNC_STATE_VIOLATION` | 无（**首轮 O5 已闭合**：§9.1 专行登记 + CHUNK-C2 负控覆盖；武装点 = 末 chunk 推送，β 同点 `bulk-transfer.ts:217`） | — |
| SM-9 | egress 返回 ≤ 0 | 桥不投回执，tag 停留未决 | 连接终局冲刷 / ackTimeout 有界兜底 | 无（与 SM-1 同根，随 F1 闭合；§9.1 专行登记 0 值来源分析） | — |
| SM-10 | kind=1 awaiting-ack，末 chunk 回执被扣 | bootstrap timer 推进 `bootstrapTimeoutMs` | `finalize('failed','bootstrap-timeout')` 有界终局 | 无（`hub-namespace.ts:624-625` 武装点前移至 enqueue 已覆盖回执等待——BOOTSTRAP_ACK 因果上不早于回执，FIFO 下 ACK 等待 ⊇ 回执等待） | — |
| SM-11 | γ async 下 `sendStep2` 返回 chunked 形态 | ownStep2Seq 清锚后、回执结算前收到 SYNC_APPLIED | `ownStep2Seq === undefined` ⇒ onViolation 响亮 | 无（`round-engine.ts:188-200` 判别现状 + §8.5 分块锚 pending 由载体承载；「合法 ACK 结构性不可达」依据改判保序条款与 :267-269 现注释自洽） | — |

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| ER-1 | 缝扣留（宿主停止泵送 edgeToSession） | §8.6.1 有界行为链：timer 推进 ⇒ abandon ⇒ RESYNC_REQUIRED×1（记忆化）+ 槽位释放 + 迟到回执 no-op | 无（PEND-C3 断言；首轮缺口已闭合） | — |
| ER-2 | 缝上帧不可解码 | `handleFrame` decode catch ⇒ connection-fatal（β 同款） | 无 | — |
| ER-3 | 回执伪造（非法序/未知 tag） | 入口域检查 + 未决集 ⇒ `CONNECTION_POLICY_VIOLATION`（1008） | 无（新触发面已列 §15-2 复查） | — |
| ER-4 | 错配/重复回执 sequence（合法域内） | 下游锚/ACK 判别响亮收口（间接错误码） | 低（SEAM-C2/ROUND-C3 配对断言锁死） | 无强制（R11 follow-up 登记恰当——入口加固无规范依据，新增触发面反而需冲突复查） |
| ER-5 | egress 抛出（如 `OutboundExhaustedError`） | 桥同步传播；edge 侧已先触发连接 ERROR + 1008 | 极低 | — |
| ER-6 | 发送被拒（seq/tag ≤ 0：未注册 sink / 出站超限 / 账本越界） | 既有 0 值语义路径（discardQueued + needsResync + send-failed 声明）；γ `emitSeam` 未注册 sink ⇒ 0 且零登记 | 无（β `deliverFrame` 同构；`hub-session.ts` 两条 send 路径门前置形状已核验） | — |
| ER-7 | β 基线回归 | PUB-C2 硬门（271 + 825 + tsc）+ PEND-C3-④（谓词变异红 = 判据真实接入的证明） | 无 | — |

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| `src/index.ts` 既有 15 值导出 + 类型集 | 无——append-only，PUB-C1/TD-C2 断言非回退 | `src/index.ts:5-26`；GAP-1 | — |
| `createHubSessionSink(config)` 可选 `asyncSendTickets` | 无——缺省 ⇒ 新分支全死 | 生产调用点 `hub-connection.ts:344`、`hub-session-host.ts:106`（已核实）；测试调用点见 O-1 注 | 无（O-1 建议补全枚举，非阻断） |
| `HubSessionSink` 新可选 `onReceipt?` | 无——α/β 实现不定义即不受影响 | `hub-split.ts:126-151`（接口现状已读，append-only 可行） | — |
| `RoundState.ownStep1/2Seq` 类型替换 | 无——消费点全在 round-engine，peer 写点走 stamped | `types.ts:1029-1030`；`round-engine.ts:175-176,191-192,243-245,260-263`（已读核验） | — |
| `bootstrapSnapshotSeq` 载体替换 | 无——仅 hub-namespace 内部 | `hub-namespace.ts:128,605,638,665-673` | — |
| `onLastChunkSent` 追加第三参 `pushedAt?` | 无——尾参可省略，#300 冻结锚 L195 绑定不变 | `bulk-transfer.ts:62-71`（SA3 偏差登记原文） | — |
| edge 公共面（egress/stamp/frame-io） | 无——D3 零改动路线成立 | `hub-edge-host.ts:118-130,691-699`；`frame-io.ts:184-198`；`hub-edge.ts:269,852` | — |
| 既有测试族/夹具 | 无——零行为变更 + 全绿硬门 | SA6 §4 基线 | — |
| `noteUpdateSent({sequence: tag})` γ 下值域 | 无——tag 不入任何公共事件字段（D9 末条固化 + TD-C1/CHUNK 断言背书） | `hub-namespace.ts:1393-1410`；`update-channel.ts:389-393,512-516` | — |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| tag 分配/校验/未决集 | γ session 侧（§24.2.4） | γ port 单点 | 正确 |
| 序号盖章 | edge 出站 mux 单点 | 不动（`frame-io.ts`） | 正确 |
| 回执生产 | 宿主（§24.1 传输义务） | test-only 桥样例 | 正确（生产零侵入；§24.2 标题即「宿主传输义务」） |
| pending 记账/窗口/ackTimeout | `UpdateChannel`（事实所有者） | §8.6/§8.6.1（含计时器判据，不 γ 门控分支化） | 正确——单份实现保持，无 γ 层镜像/watchdog（D10 否决理由成立：第二计时器 = 漂移事实源） |
| 三锚 | channel/engine/transfer 载体内部 | §8.5 append-only 载体扩展 | 正确（A4.1 张力按 SA8-E3 裁决登记） |
| 流控 | edge 单点 | D5 dormant | 正确 |
| pacing | session 自驱（A4.4） | D6 selfDrain | 正确（触发点①②③与 A4.4/§24.6 枚举对齐；②为「ACK 到达」保守超集，幂等 no-op，SA8 #11 已裁决不冲突） |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| β 公共工厂/句柄 | `hub-session-host.ts` | γ 镜像 + 回执面 | 一致 | A4.1 明文；port 形状逐成员同形（已比对 `:180-213`） |
| 宿主桥/facade | #424 `makeShardedReplicationFacade`（`boot({createHub})` 注入，`driver.ts:196/:516` 已核验） | `makeAsyncReplicationFacade` 同一集成点 | 一致 | 镜像 #424 §8.3.1 纪律 |
| test-d 快照 | #420/#421/#422 `*.test-d.ts` | 新 test-d 双面门 | 一致 | |
| 内存管道 | `src/testing.ts:18-31` 单次 queueMicrotask、#424 RecordingPipe | 显式 release 通道对（test-only） | 一致（有意分叉已声明） | 简报明示 test-only；DENY `src/testing.ts` 理由成立 |
| drain 机械 | edge 拉取（listen/β） | γ selfDrain 推-FIFO | 一致（规范授权分叉） | A4.4 明文 |
| 小限额分块构型 | #256（`maxBootstrapBytes:8/maxChunkedBootstrapBytes:16`）、#300（`maxSyncDiffBytes:32KiB` + 100KB 写）、#301（chunked 族事件断言） | D11/R6 同构注入 | 一致 | 注入面（`boot({limits})` 双侧，`driver.ts:522/:550` 已核验）与先例同构 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| wire 序 | edge mux 盖章 | receipt（事实回传） | 无 |
| tag | γ port 计数器 | — | 无 |
| 窗口占用 | `effectiveInFlightCount()`（pending 并入） | — | 低（`takeItems` avail 裸口径例外已注记，仅合并宽度） |
| 锚 | channel/engine/transfer 载体 | — | 无 |
| ackTimeout 武装状态 | `ackTimerArmed` 单字段（现状保持） | — | 无（D10 否决「armed 镜像」备选正确） |
| 生命周期 | 通道终态 + close 信号 | 本地两态投影（行为面仅判 `=== 'closed'`） | 无（β 同款） |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| `open()`（重复键响亮 throw） | `close()`（幂等同 promise；pending 冲刷 + unresolvedTags 清空 + quiesce） | 迟到回执 no-op；`closeTimeoutMs` 不动 | 对称（γ close 冲刷面 §9.2 显式含 pendingSends/unresolvedTags——比首轮更完整） |
| `onFrame`/`onSignal` 注册 | 退订函数 | 监听者 throw：onFrame 原样传播（β `deliverFrame` 镜像）、onSignal 隔离（β `emitSignal` 镜像） | 对称（O7 闭合，两面均已声明） |
| 夹具 `enqueue` | `release`（显式） | 零投递 = 不调用释放 | 对称 |
| γ host `sessions` Map | 无终态移除 | — | β 同形先例（R10 follow-up 登记，不阻断） |

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 第二 cleanup/重试循环 | 无 | 无（回执消费单点 + selfDrain 幂等 + 记忆化 resync 漏斗复用） | 无平行 |
| 第二状态机 | channel/engine 单份 | γ 门控分支 + 载体扩展，FSM 零分叉 | 无平行 |
| 第二计时器体系 | UpdateChannel/BulkTransferSender/bootstrap timer 三锚各司其职 | §8.6.1 判据统一而非新增计时器 | 无平行（D10 显式否决 watchdog 备选） |
| 仅服务单 Issue 的通用抽象 | 无过度泛化迹象 | — | 无 |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW 与正文一致性 | §8.1-§8.9 涉及的全部生产/测试路径均在 ALLOW；F1 落点 `update-channel.ts`、F2 落点 round 测试文件、E1 落点 `bulk-transfer.ts`/`hub-namespace.ts`、E2 落点 `packages/ws-replication/AGENTS.md` 均已入表 | 无 |
| 新 ALLOW 行（vs 首轮）唯一 = `packages/ws-replication/AGENTS.md` | 有原因列（SA8-E2/R2 + docs/AGENTS.md 纪律；D12）；append-only + 冻结面零触碰的约束写明 | 无（扩张有据） |
| DENY 与正文冲突 | 无——γ 复用 β 类型不改 `hub-session-host.ts`；edge 零改动（D3）与 DENY edge 文件一致；规范文本零改动（E1 路线 a）与 DENY 规范文件一致；CHUNK limits 注入走 `boot({limits})` 既有参数面、不改 driver（DENY 行已注明） | 无 |
| ALLOW 无理由扩张 | 每行有原因；新测试文件名匹配 vitest include（`vitest.config.ts:16-20` 已核验） | 无 |
| follow-up 掩盖必要项 | R5/R10/R11 均为真实前置/对称/follow-up 性质；旧 R6「增强项」降格已删除（grep 证实），真实分块现为硬门 | 无（首轮 F2 的范围问题已纠正） |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| PUB-C1/C2/C3、SEAM-C1/C2/C3 | api + seam-fixture 测试（导出表 16、句柄 6 成员、词汇键集、tag 纪律、receipt↔rawSequence 配对 + reorder/drop 负控） | 无 | — |
| PEND-C1/C2 | round 测试（`maxInFlightUpdates=1` + 扣留；占窗自推送、rekey 不换槽、ACK 释放） | 无——§24.4 语义澄清（回执不释放槽位、槽位于 ACK 释放；可观察实现 = 同道 FIFO 使 receipt→ACK 依序消费）正确且比 SA6 字面措辞更强（能抓「rekey 释放槽位」缺陷） | — |
| **PEND-C3（F1 验收）** | 扣留 + timer 虚拟推进 ⇒ RESYNC_REQUIRED×1 + needs-resync + 槽位释放（恢复 round 后新帧可推）+ 迟到回执 no-op（不 fatal/不结算/不重复声明）+ 变异红（判据去 pending ⇒ 哑火 ⇒ ①全组红）+ β 矩阵绿 | 无（与首轮 F1 acceptance 逐项对应） | — |
| ANCHOR-C1/C2 | 三段齐备、live、回指、unsolicited 违例；**单帧 + 真实分块各 ≥1 次**；dropReceipts + 直投 ACK ⇒ 1002 响亮 | 无 | — |
| PIPE-C1/C2/C3 | FIFO/不丢/不重/零串道/零投递-显式释放/结构门重申 | 无 | — |
| ROUND-C1/C2/C3 | 真 peer + Registry/Runtime；β/γ 同场；控制帧逐字节 + skeleton + docState；nonce 钉死；NC-1 变异；**单帧与 CHUNK 小限额两构型各跑** | 无 | — |
| **CHUNK-C1（F2 验收，kind=1）** | 小限额注入（`maxBootstrapBytes` 8-256 + `maxUpdateBytes` 控 chunk + 聚合上限 + `chunkedUpdate:true`；构型链 R6 与 `validate.ts` 实文一致）⇒ 真实 kind=1 改道：BOOTSTRAP_SNAPSHOT 单帧 0 条、UPDATE_CHUNK ≥2、每 chunk 独立 tag 独立回执、末 chunk 回执结算锚、BOOTSTRAP_ACK 回指末 chunk 帧序、ANCHOR-C1 全量、β 同限额同场 parity、变异红 | 无（注入面 + 先例可行：#256 同参数面实测先例；成功分块回合先例 = #301 族） | — |
| **CHUNK-C2（F2 验收，kind=2）** | `maxSyncDiffBytes` 调小强制 Step2 diff 超限改道；末 chunk 回执 ⇒ ownStep2Seq 回填；SYNC_APPLIED 回指；kind=2 timer 角落负控（扣回执 + 虚拟推进 ⇒ 弃置 + RESYNC_REQUIRED；直投 SYNC_APPLIED ⇒ 响亮 SYNC_STATE_VIOLATION） | 无（可行：#300 `:255-263` 恢复 diff 超 `maxSyncDiffBytes:32KiB` 构型先例——diff 放大靠 hub 侧写，R6 窗口注记已涵盖；见 O-3 构型提示） | — |
| **CHUNK-C3（E1 验收，t0 口径）** | γ 分块 bootstrap + observer/clock：扣末 chunk 回执 k 虚拟 ms 后释放 ⇒ `ackLatencyMs` 按推送 t0 计（含管道/edge 跨度）；变异（t0 改回执时刻）⇒ 少 k ⇒ 红；β 同场景逐字节不变（301 族背书）；单事件字段值断言不违 §12.5 | 无（SA8-R1 所选语义的行为落点；与 F2 协同避免二次返工——首轮 §13 衔接要求满足） | — |
| TD-C1/C2 | 类型锁定 + 4 负控 + β 非回退块；双面门 + B1 归因（tsc 为主面） | 无 | — |
| 旧实现真红 | GAP-1..6 运行期证据（非编译失败假红） | 无 | — |
| 包 AGENTS 验证纪律（every changed state-machine path 有聚焦测试） | 改动路径 ↔ 测试行映射：γ port（PUB-C3/SEAM）、三态锚（ANCHOR-C1/C2 + CHUNK）、pendingSends（PEND-C1/C2）、计时器判据（PEND-C3）、selfDrain（PEND/ROUND）、回执 fan-out（SEAM-C2/ROUND-C3）、bulk 回执结算（CHUNK-C1/C2）、t0（CHUNK-C3）、onAck 判据扩展（β 矩阵 + PEND-C3-④） | 逐路径核对均有落点；唯一无专行断言的次级路径 = γ `emitSeam` 未注册 sink ⇒ 0（见 O-2，非状态机主路径、β 同义路径已有既有覆盖形态） | 无强制 |

### 12a. F2 闭合核验（SA2 首轮 MAJOR）

- **硬门化**：D11 + §12 CHUNK-C1/C2/C3 + ANCHOR-C1/ROUND-C2 分块形态扩展 + §8.10 sequencing ④；旧 R6「增强项而非硬门」表述已删除（grep 证实仅存于修订映射的引述）。
- **可行性**：`boot({limits})` 双侧注入实存（`driver.ts:522/:550`）；小限额先例实测存在（#256 `limits:{maxBootstrapBytes:8,maxChunkedBootstrapBytes:16}` + `chunkedUpdate:true`；#233 `maxSyncDiffBytes:32_768` + 100KB 写；#300 恢复 diff 构型）；成功分块回合断言先例存在（#301 chunked 族事件）。构型约束链与 `validate.ts` 启动期校验逐条一致（PROTOCOL_OVERHEAD_BYTES=128 常量核实；64×maxUpdateBytes 上限核实）。
- **判别力**：CHUNK-C1 断言「BOOTSTRAP_SNAPSHOT 单帧 0 条 + UPDATE_CHUNK ≥2 + transferKind=1 帧头」使「假分块」（仅切 CAP 位）必红；变异负控（末 chunk 结算改单帧锚/不结算 ⇒ BOOTSTRAP_ACK 判别红）补齐红→绿方向。
- **路线选择**：descope 备选否决理由经独立核验成立——SA6 §12.2 契约明文「`selectedCapabilities` ∈ {0, CAP_CHUNKED_UPDATE} 两形态至少各跑一次」，CAP-on 形态在无 γ 分块支持下无法完成回合 ⇒ descope 违反已批准契约；路线 (a) 是唯一自洽选择。
- **结论：F2 闭合成立**，且与 SA8-E1 的协同要求（CHUNK-C3 兼作 t0 语义断言落点）已满足。

## 13. Required revisions

无（无 BLOCKER / 无 MAJOR）。

前轮 finding 闭合状态（稳定 ID 保留用于修订映射）：

| Finding ID | 首轮 severity | 闭合状态 | 核验位置 |
|---|---|---|---|
| F1 | MAJOR | **已闭合** | §5a（源码级逐点核验）+ §12 PEND-C3 |
| F2 | MAJOR | **已闭合** | §12a（可行性/判别力/路线核验）+ §12 CHUNK 行 |
| （SA8-E1/R1） | 阻塞（SA8） | 设计内闭合（路线 a） | §5（D9 核验）；SA8 门禁重跑按 SA8-R5/设计 §15 |
| （SA8-E2/R2） | 阻塞（SA8） | 设计内闭合（D12） | §5、§11 |
| （SA8-E3/R3） | 非阻塞（SA8） | 已登记 | §5、§6 |

## 14. Non-blocking observations

| ID | Observation | Evidence | Suggested disposition |
|---|---|---|---|
| O-1 | §10 调用方矩阵的测试调用点枚举仍不全：除 `test/issue420-shim-hub.ts:218` 外，`ws-replication-issue418-edge-session-split-structure.test.ts`（:421/:528/:571/:594）、`ws-replication-issue423-observer-emission-split.test.ts`（:465）、`ws-replication-issue423-sa7-dynamic.test.ts`（:194）亦直接调用 `createHubSessionSink`。结论不受影响（全部测试调用点均不传 `asyncSendTickets` ⇒ 新分支全死） | grep 全仓调用点 | 实现票随手补全证据列；不影响安全性 |
| O-2 | γ `emitSeam` 未注册 sink 路径（返回 0 + 不登记未决 tag + 不发 seam 消息）无 §12 专行断言；该路径是 β `deliverFrame`（`hub-session-host.ts:214-219`）逐字同构的退化输入面，非状态机主路径 | §8.3 vs §12 | 建议在 PUB-C3 或 SEAM 行补一条行为断言（open 后未注册 onFrame 即 send ⇒ sendXxx 返回 0、缝上零消息、后续注册不受污染）；一行成本 |
| O-3 | CHUNK-C2 构型提示：bootstrap 后 hub/peer 文档收敛 ⇒ Step2 diff 天然很小；测试须按 #300 先例（`:255-263`，大写放大 diff）确保 diff 落在 `maxSyncDiffBytes < diff ≤ maxChunkedSyncDiffBytes` 窗口，且注意 `maxUpdateBytes` 过小时 1-chunk kind=2 仍成立但判别力弱（建议 diff ≥ 2×maxUpdateBytes 使 chunkCount ≥ 2） | R6 窗口注记 + #300 先例 | 实现票构型注意项；设计 R6 已含约束方向，无需改文 |
| O-4 | PEND-C1 的 §24.4 语义澄清（回执不释放槽位）正确且强于 SA6 原字面措辞；建议测试把「只放回执、未放 ACK」的中间态做成显式断言步（该步下第 2 帧仍不得过缝），把「rekey 释放槽位」缺陷钉死在缝消息日志层 | §12 PEND-C1 vs SA6 §12.1 | 可选增强；设计现文已可执行 |

---

### 收尾说明

- 本轮复核结论：修订版设计对首轮 F1/F2 与 SA8 E1/E2 的闭合**全部成立**，修订未引入新的阻断缺口；`approve`。
- 设计 §15 的 `requiresConflictRecheck: true`（5 项申报）经核实集合完整、无漏报；本评审未发现其外的新冲突风险，故本产物 `requiresConflictRecheck = false`——SA8 门禁重跑按 SA8-R5 与设计 §15 执行，不因本评审追加。
- 实现期须保持的硬门（设计 §12 已列，SA4/SA7 复核锚点）：β 矩阵 271 + 包套件 825 + 双面类型门全绿；PEND-C3 变异红；CHUNK-C1/C2/C3 全绿；TD-C2 非回退；PIPE-C3 结构门零命中；`packages/ws-replication/AGENTS.md` 登记句与 γ 代码同变更集落盘。
