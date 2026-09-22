# task_issue-447 设计 —— γ-T1：公共异步会话工厂 + 延迟注入异步 FIFO 管道夹具 + 首个跨缝协议回合

- Issue：#447（Parent = PR #446 `spec/445-gamma-async-seam`）
- 设计基线 HEAD：`c86ccbc`（`Spec #445：γ 真 worker 形态设计工件`）
- 上游输入：Host 简报 `wiki/raw/task_issue-447.md`；SA6 契约 `wiki/raw/task_issue-447_sa6_contract.md`（approve；6 GAP + 4 ORACLE/NC，探针 `task_issue-447_sa6_capability_probe.mts` + `artifacts/sa6-issue447-*.log` 8 份）
- 评审输入（本轮修订依据）：SA2 攻击评审 `wiki/raw/task_issue-447_sa2_review.md`（verdict `reject`：F1 ackTimeout 计时器哑火 + F2 γ 分块机械零可执行覆盖，均 MAJOR；O1–O7 非阻断观察）；SA8 设计后冲突报告 `wiki/raw/task_issue-447_design_conflict_report.md`（iteration 0，verdict `reject`：E1 `chunkedAckT0` t0 口径 + E2 模块 AGENTS.md 词汇登记两项阻塞；E3 A4.1/A4.2 调和裁决非阻塞；§8-R1/R2/R3/R5）。修订映射见 §14。
- 规范权威：ADR 0032 附录 A4（`docs/adr/0032-transport-decoupling-edge-session-split.md:55-99`）；协议 §24（`docs/protocols/instance-replication-v1.md:1091-1154`）；词表 `CONTEXT.md:229-235`
- Issue 评论 REST 快照为空（无 Owner 追加要求）；`task_issue-447_relevant_decisions.md` / `_conflict_report.md`（前置门禁产物）不存在——SA8 决策集盘点以设计后冲突报告 §2 为准，冲突复查义务见 §15

---

## 1. 任务类型、目标与非目标

**任务类型：Feature（能力缺口交付）**。β/α 现行实现自洽且全绿（SA6 §4 基线：420/424 族 271 测试 + 包套件 825 测试 + 根级 typecheck 全绿）；缺的是 γ 异步缝的全部交付物。不虚构 Bug 根因。

**目标（全部来自简报正文，逐条可验收）**：

1. **γ 公共会话工厂/句柄面**：新工厂/句柄类型经 `src/index.ts` append-only 导出；β `createHubSessionHost` 冻结面逐字不动。
2. **缝消息词汇落地**：`frame{tag,bytes,lane}` / `receipt{tag,sequence}` / `frame{bytes}` / `close` / `terminateUnauthorized` / `settled` / `connection-fatal` 闭集合；无拒纳/闸门/信用词汇。
3. **session 侧第三种 port 形态 + pending 两相记账**（控制面先行）；`bootstrapSnapshotSeq` 扩三态（未发 / pending / 已盖章）；BOOTSTRAP_ACK 到达时锚已回填是保序条款的结构事实，非 park 机制。**两相记账的 ackTimeout 兜底必须机械成立**（§8.6.1；SA2-F1）。
4. **延迟可注入异步 FIFO 管道夹具**：每 (connectionKey, namespaceId) 一对专用通道；FIFO/不丢/不重；零 worker_threads；夹具只做字节/JSON 中继与信号搬运、零协议决策。
5. **宿主桥样例（test-only）**：ingress 侧同步调 edge egress 取盖章序、异步投回执到 worker 侧会话。
6. **OPEN→bootstrap→close 完整协议回合穿过显式异步边界**，wire 与 β 形态逐字节等价（控制帧子集逐字节 + skeleton + 数据帧语义，复用 issue424 断言族）；新公共面 test-d 快照。**本票落地的全部 γ 生产分支（含分块 kind=1/kind=2 回执结算）都有可执行红→绿覆盖**（§12 CHUNK-C1/C2/C3；SA2-F2 路线 (a)）。

**非目标**：

- 不引入 worker_threads/MessageChannel/MessagePort 的任何依赖或类型（ADR 0032 决策 2 / A4.1；既有 420 结构门继续锁死）。
- 不改 wire 格式、错误码、事件型（γ 是 host-facing 缝，非 wire 契约，§24 头注）。
- 不改规范文本（ADR 0032 A4 / 协议 §24 / CONTEXT.md）——SA8-E1 经路线 (a)（按登记口径实现推送时刻 t0，§7-D9）在本变更集内闭合，**无需 amendment**；规范文件入 DENY（§11）。
- 不保持跨 session 轮转公平性（A4.4 显式接受公平性损失）。
- 不锁 γ 下 observer 事件集/事件序（§24.8：跨线程无全序；§23 金标适用域 = α/β）。单事件**字段值**断言（如 `ackLatencyMs` 口径，CHUNK-C3）不属事件序断言，允许。
- 不动 peer 侧（peer 不拆分；peer 的 `RoundState` 消费点零改动，见 §8.5/§10）。
- 不做大流量/性能验收（SA6 §7：最小规模 + 最大判别力）。**真实分块覆盖经小限额注入达成**（`maxBootstrapBytes`/`maxSyncDiffBytes` 调小使小载荷即改道，§7-D11），不构造超大载荷。
- 不修 HEAD 既有 421 test-d 的 vitest typecheck 红（独立缺陷，SA6 §15-B1 已归因；另票处理）。

---

## 2. 当前行为与证据锚点（HEAD = c86ccbc）

| # | 事实 | 锚点 |
|---|---|---|
| 1 | 公共运行时导出恰 15 个 = β 冻结集；γ 候选 0 | SA6 GAP-1（运行期导出表）；`src/index.ts:5-26` |
| 2 | β 句柄公共成员恰 5（`close/handleFrame/onFrame/onSignal/terminateUnauthorized`），无回执消费面 | SA6 GAP-2；`hub-session-host.ts:73-84` |
| 3 | β `HubSessionFrameListener = (frame, lane) => number` 同步返回被分配 wire 序（0 = 未发送/被拒）——冻结签名无法 append-only 演进为异步回执 | `hub-session-host.ts:64-66`；ADR 0032 A1:41、A4.1:61 |
| 4 | 盖章单点 = `OutboundQueue.emitOne` 写帧字节 `[8..12]`（大端），`emitRaw(bytes, sequence)` 同步携带序号；`lastSeq` 每连接从 1 严格递增 | `frame-io.ts:184-197`（`:192` 注释「盖章单点（mux）」）、`:125` |
| 5 | edge 半边把 `emitRaw` 接成只发字节（`(bytes) => transport.send(bytes)`）——序号在 edge 内部被丢弃；但 **edge 公共 egress 面把盖章序同步返回给调用方**：`sendControlFrame/sendDataFrame → number`（「返回盖章后 wire 序」） | `hub-edge.ts:195-198`；`hub-edge-host.ts:118-130`、`:691-699`；SA6 GAP-5/H4 |
| 6 | session 半边出站占位编码（sequence=0）经 `sendControlFrame/sendDataFrame` 过内部缝；β 工厂 adapterPort 原样透传 accounting 丢弃（工厂形态 `update-sent.sendQueueMs` 缺面 dormant） | `hub-session.ts:204-262`、`:264-271`；`hub-session-host.ts:183-184`；ADR 0032:113 注记 |
| 7 | `bootstrapSnapshotSeq` 两态：声明 `hub-namespace.ts:128`；写点 `:605`（分块末 chunk 回调）/`:638`（单帧 `seq > 0 ? seq : undefined`）；判别 `:665-671`（`undefined` 或值不等 → `connectionFatal('ACK_STATE_VIOLATION', 1002)`）；复位 `:673` | SA6 GAP-6 |
| 8 | `ownStep2Seq` 两态：`types.ts:1030`（`RoundState`，peer/hub 共享 `RoundEngine`）；写点 `round-engine.ts:244`（分块末 chunk 回调）/`:260`（发送前清锚）/`:263`（单帧回填）；判别 `:191-192`（`undefined`/不等 → `onViolation` → `SYNC_STATE_VIOLATION` + failed，`hub-namespace.ts:231-234`） | 源码逐点 |
| 9 | 数据面窗口：`UpdateChannel.inFlight: Map<seq, entry>` 自 `seq>0` 起占槽；`effectiveInFlightCount() = inFlight.size + (activeTransfer?1:0)`；判据 `deliver`/`pullAndSendOne` 两处 `< maxInFlightUpdates`；槽位于 ACK（`onAck` 删除）或 `abandonInFlight`（ACK 超时，迁 zombie）释放 | `update-channel.ts:118-146`、`:198`、`:224-257`、`:367-394`、`:431`；SA6 §8 步 5 |
| 10 | 分块载体：`BulkTransferSender.pullOne` 末 chunk 出站即 `state.lastChunkSequence = seq` + 同步回调 `onLastChunkSent(seq, settlement)`；kind=2 同步武装自持 ACK timer（kind=1 由宿主 bootstrap timer 覆盖）；`settle(kind)` 于 BOOTSTRAP_ACK/SYNC_APPLIED 收妥时结算 | `bulk-transfer.ts:174-233`（`:212-218`）、`:253-265`；`hub-namespace.ts:603-620`、`:777-793` |
| 11 | **ackTimeout 计时器机械（SA2-F1 事实基础）**：`armAckTimer` 回调守卫 `if (this.inFlight.size > 0) this.abandonInFlight()`——占用判据只看 `inFlight`；`onAck` 的拆除判据 `inFlight.size === 0`（`:229`）+ `wasOldest` 重锚（`:231-235`，disarm+arm 原子）；`abandonInFlight`：inFlight 全迁 `zombieSeqs` + 拆 timer + `needsResync = true` + 清 activeTransfer + `onAckTimeout(abortedTransfer)` 上抛；`teardown` 全清 + transferId 归 1 | `update-channel.ts:571-581`、`:587-594`、`:601-609` |
| 12 | **hub ack-timeout 恢复链（PEND-C3 可观察面）**：UpdateChannel host 接线 `onAckTimeout → onAckTimeoutFired → declareHubResync('ack-timeout')`——单漏斗记忆化（一恢复周期一次）：wire `RESYNC_REQUIRED` 帧发出 + `bulkTransfer.abortForResyncDeclared()` + `setState('needs-resync')` + observer `resync-required{ack-timeout}`（HB7） | `hub-namespace.ts:245-267`（`:256`）、`:1290-1327` |
| 13 | **`chunkedAckT0` β 采样语义（SA8-E1 事实基础）**：采样点 = `onLastChunkSent` 回调内 `sampleAckT0()`（末 chunk 出站同步栈；注释「ackLatencyMs = ACK 处理时刻 − 末 chunk 出站时刻」），kind=1/kind=2 两处写点；消费点 = chunked-{snapshot,sync}-acked 事件 `ackLatencyMs = t1 − chunkedAckT0` | `hub-namespace.ts:603-608`、`:777-780`、`:686-688`、`:734-735`、`:1760` |
| 14 | **小限额分块构型先例（SA2-F2 路线 (a) 注入面）**：`boot({ limits })` 双侧注入（`driver.ts:522/:550`）；既有测试以 `maxBootstrapBytes: 8, maxChunkedBootstrapBytes: 16` 等小值强制小载荷改道 kind=1/kind=2；424 回合以 `bootRound(chunkedUpdate?)` 切换协商位；启动期校验链：`maxBootstrapBytes ≤ maxFrameBytes − PROTOCOL_OVERHEAD_BYTES`、`maxQueuedControlBytes ≥ maxBootstrapBytes + PROTOCOL_OVERHEAD_BYTES`、显式表达时 `maxChunkedBootstrapBytes ≤ maxChunksPerUpdate × maxUpdateBytes` | `ws-replication-issue256-namespace-failed.test.ts:764`；`ws-replication-ac3-bootstrap.test.ts:94`；`ws-replication-issue300/301-*.test.ts`；`ws-replication-issue424-cross-seam-round.test.ts:45-48`；`validate.ts:160-204`、`:238-249` |
| 15 | **模块契约滞后（SA8-E2 事实基础）**：`packages/ws-replication/AGENTS.md:17` 缝词汇枚举句（「the seam carries only namespace-domain frames … plus the `close`/`terminateUnauthorized`/`settled`/`closed` control signals (and the append-only `connection-fatal` signal)」）最后修改于 `feb9ec5`（Spec #415），早于 A4 落入的 `c86ccbc`——γ 交付 `receipt{tag,sequence}` 过缝即被代码逐字突破；docs/AGENTS.md 纪律「当代码行为变化时，更新所有所述契约发生变化的规范文档」 | `git log -- packages/ws-replication/AGENTS.md`；SA8 报告 §3-#19 |
| 16 | β 测试桥（γ 要替换的那条同步缝）：`raw.onFrame((frame, lane) => egress.sendControlFrame/sendDataFrame)` 同步回传盖章序；入站 `sink.namespaceFrame → handle.handleFrame(encodeMessage(msg, {sequence}))` | `test/issue424-sharded-hub.ts:370-398` |
| 17 | 全部现存内存传输 = 单次 `queueMicrotask` 投递，无每会话通道对、无延迟注入参数 | `src/testing.ts:18-31`；`test/issue424-sharded-hub.ts:504-555`；SA6 GAP-4 |
| 18 | β 工厂形态 `HostSessionAdapter.dataFacetOf() → undefined` 且 adapterPort `onDataQueued/requestDataDrain → no-op`：连接级 drain 拉不到 session facet——工厂形态下排队/分块出站依赖直发路径，未被既有测试行使（观察登记，见 §13-R5） | `hub-edge-host.ts:673-677`；`hub-session-host.ts:186-188` |
| 19 | ORACLE-3（β 同步签名不可承载异步中继）：桥改成「异步中继 + 对 session 立即回 0」⇒ `ACK_STATE_VIOLATION`、close 1002、`connection-fatal` 恰发、namespace 不 live——0 = 未发送/被拒的语义判据在既有实现上敏感 | SA6 §6；探针 E2 |
| 20 | parity 口径：控制帧白名单逐字节 + `skeletonOf` 全等 + 数据帧 `docStateOf` 语义等；跨装配比对必须钉死 peer `random`（`connectionNonce` 随机，`peer-connection.ts:409-413`） | SA6 ORACLE-2/NC-1/E1；`test/issue424-sharded-hub.ts:591-697` |

---

## 3. 能力缺口（承接 SA6 §8）

症状：宿主无法把 SessionHost 放到异步字节传输之后。缺口链（全部 SA6 实测）：

1. 公共面无 γ 工厂/句柄（GAP-1/2）→ 本设计 §8.1 新公共面。
2. 缝上无回执机械：盖章点已同步携带序（`emitRaw(bytes, sequence)`），但 edge 内部接线丢弃序号、公共 egress 返回值无人消费成回执、session 侧无 `handleReceipt` 消费面（GAP-5 + GAP-2）→ 本设计 §8.3 回执流。
3. 控制面锚两态、无 pending 中间态（GAP-6）→ 本设计 §8.5 三态锚。
4. 数据面窗口槽位只在 `seq>0` 后建立、无 tag 键空间（SA6 §8 步 5）→ 本设计 §8.6 pending 两相记账（含 §8.6.1 ackTimeout 有界性机械）。
5. 夹具缺位：无「每 (连接, namespace) 一对专用 FIFO 通道 + 延迟可注入」（GAP-4）→ 本设计 §8.8 夹具。
6. 跨缝 parity 证据缺位（无 γ 装配）；真实分块 γ 场景零覆盖 → 本设计 §8.9/§12 回合与 parity 策略 + CHUNK-C1/C2/C3。

最深根因：规范（A4/§24）已冻结、实现为零。β 的同步回执模型在异步载体上**语义不可表达**（ORACLE-3：回 0 = 被拒 ⇒ 响亮 `ACK_STATE_VIOLATION`；ADR A4.1 同判）——故 γ 必须是独立新工厂/句柄类型 + 第三种 port 形态，而非 β 面演进。

---

## 4. Owner 要求落实

Issue 评论 REST 快照为空（简报 `## Comments` 节空；dispatch 明示无 owner requirements）——**无评论 id/时间戳可映射**。Owner 要求 = 简报正文（`wiki/raw/task_issue-447.md:15-28`）：

| 简报条目 | 设计章节 | 承接方式 |
|---|---|---|
| 新 γ 公共工厂/句柄面（append-only）；β 冻结面逐字不动 | §8.1、§11、§12（PUB-C1/C2、TD-C1/C2） | 新模块 `hub-session-async-host.ts` + `src/index.ts` append-only；β 文件零改动 |
| 出站帧携 tag fire-and-forget 过缝；入站以 `handleReceipt(tag, sequence)` 消费序回执 | §8.2、§8.3 | `HubAsyncSessionFrame{tag,bytes,lane}` + `handleReceipt(tag, sequence)`（签名逐字按简报） |
| session 侧第三种 port 形态与 pending 两相记账（控制面先行） | §8.4、§8.6、§8.6.1、§8.10 | γ adapterPort（含 dormant 流控面）+ `UpdateChannel.pendingSends`（tag 键空间，占窗自推送时刻）+ ackTimeout 有界性机械 |
| `bootstrapSnapshotSeq` 三态（未发/pending/已盖章）；BOOTSTRAP_ACK 到达时锚已回填（保序结构性保证，非 park） | §8.5、§9.3 | `SendAnchorState` 三态载体；pending-at-ACK = 响亮 `ACK_STATE_VIOLATION`（禁 park） |
| 每 (连接, namespace) 一对专用 FIFO 通道、延迟可注入显式异步内存管道（零 worker_threads；夹具零协议决策） | §8.8 | `test/issue447-async-seam.ts`：通道对 + 显式 release + 故障注入旋钮；零线程/零真实 timer |
| 宿主桥样例（test-only：ingress 同步取盖章序、异步投回执） | §8.7 | `makeAsyncReplicationFacade`（registry 采纳形态，镜像 #424 §8.3.1 纪律） |
| OPEN→bootstrap→close 回合与 β wire 逐字节等价（复用 issue424 断言族） | §8.9、§12（ROUND-C1/C2/C3 + CHUNK-C1/C2） | 同场 β/γ 双装配 + peer `random` 钉死 + 三层判据（单帧与真实分块两形态） |
| 新公共面 test-d 快照（#420 先例） | §12（TD-C1/C2） | `ws-replication-issue447-async-session-api.test-d.ts` |

## 5. 复现和根因承接

| 上游事实 | 证据位置 | 设计响应 |
|---|---|---|
| GAP-1 导出面 15 = β 冻结集 | SA6 §5；探针 | §8.1 新增 6 个 append-only 导出（1 值 + 5 类型；计数修订见 §14-O1） |
| GAP-2 β 句柄 5 成员、无回执面 | 同上 | §8.1 γ 句柄 6 成员（含 `handleReceipt`） |
| GAP-3 `src/**` γ 词汇零命中 | 同上 | 本设计落地词汇即 §24.3 闭集合（§8.2），不新增词 |
| GAP-4 无管道/延迟夹具、#447 测试文件 0 | 同上 | §8.8 夹具 + §11 四个测试文件 |
| GAP-5 mux 钩子同步携带序、edge 接线丢弃、无回执生产点 | SA6 §5/E3 | **不改 `hub-edge.ts` 内部接线**：回执生产点 = 宿主桥在 egress 调用返回值的同一同步段内投 `receipt`（§8.3/§8.7；H4 已排除「需要新 mux 钩子」假设） |
| GAP-6 锚两态、`undefined` 判别仅 1 处 | SA6 §5 | §8.5 三态载体；判别语义保持（pending ⇒ 违例） |
| ORACLE-3 异步桥回 0 ⇒ 响亮 `ACK_STATE_VIOLATION` | SA6 §6/E2 | γ 面不返回 0 充当「异步已发送」；回执是唯一序号事实通道（§8.3） |
| ORACLE-2/NC-1/E1 parity 判据与 nonce 钉死 | SA6 §6/§7/§9 | §8.9/§12：控制帧子集逐字节 + skeleton + docState；`boot({ random: () => 0.5 })` |
| 基线：β 矩阵 271 + 包套件 825 + 根级 tsc 全绿 | SA6 §4 | §12 硬门：既有矩阵全绿为验收前置 |
| B1：421 test-d 在 vitest typecheck 下 4 条既有红（tsc 同文件干净） | SA6 §4/§9-E5/§15-B1 | §12/§13：#447 类型门以 `tsc -p packages/ws-replication/tsconfig.json` 为主面；vitest typecheck 面新增文件自身必须零错误 |

## 6. SA8 约束落实

SA8 设计后冲突报告已存在（`wiki/raw/task_issue-447_design_conflict_report.md`，iteration 0）——下表「SA8」列引用其条目；前置门禁产物（`_relevant_decisions.md`/`_conflict_report.md`）仍不存在，决策集以该报告 §2 盘点 + SA6 §3 硬约束 + ADR/协议规范文本为准。

| 决议或义务 | 设计位置 | 处理方式 | 需设计后冲突复查 |
|---|---|---|---|
| β 冻结面逐字不动（append-only） | §8.1、§11 DENY | `hub-session-host.ts` 零改动；`src/index.ts` 只增不改 | 否 |
| 缝只过 `Uint8Array` + 纯 JSON；零 worker_threads/MessageChannel/MessagePort | §8.2、§8.8 | 词汇消息 = 纯 JSON 标量 + `Uint8Array`；夹具纯内存；PIPE-C3 结构门保持 | 否 |
| 盖章单点 = edge 出站 mux；session 恒 sequence=0 占位 | §8.3 | γ port 占位编码透传、tag 非序号；盖章仍单点（edge egress/`OutboundQueue.emitOne`） | 否 |
| 保序条款（§24.2.3）：盖章点同步投回执、先于后续 socket 数据；违契响亮收口 | §8.3、§8.7、§9.3 | 桥在 egress 返回值同一同步段 enqueue receipt；同通道 FIFO ⇒ 回执先于 ACK；违契（未知/重复 tag、pending-at-ACK）⇒ 响亮收口，零 park | 否 |
| 三锚零改动语义（A4.2） | §8.5 | 判别代码语义不变（undefined/不等/pending ⇒ 违例）；「合法 ACK 在锚回填前结构性不可达」依据改写为保序条款。**A4.1「channel 零改动」vs A4.2 载体落点的措辞张力：SA8 §3-#9/E3 已裁决本设计读法成立（「零改动」= 判别逻辑/因果不变量保持；载体扩三态为 A4.2 明文命令；无需 ADR 修订）——本设计按该裁决登记执行**（§8.5 注） | 否（裁决已登记；如团队欲措辞调和走显式 amendment，SA8-R3） |
| 两相记账（§24.4）：pending 自推送占窗；回执换键不换槽；窗口口径 = `effectiveInFlightCount`；**「ACK 结算、ackTimeout 锚定与单体内核同构」** | §8.6、**§8.6.1** | `pendingSends` 键空间 + 计入 `effectiveInFlightCount`；回执 rekey 不增占用；**ackTimeout 锚定同构经 §8.6.1 机械兑现（SA2-F1 修订：计时器回调判据与拆除判据 γ 下计入 pendingSends，β 退化同构）** | 是（§15-4，随整体复查） |
| 流控单点 + 无拒纳词汇（A4.3/§24.5） | §8.4 | γ adapterPort `dataGateOpen: () => true`、`bufferedAmount: () => undefined`（A3 dormant 先例——共享闸门代码零改动即成 no-op）；缝上无 sent/deferred/rejected/credit/gate | 否 |
| A4.6 回执 ≠ 接纳信号 | §8.2/§8.6 | `receipt` 只含 `{tag, sequence}` 事实键；session 不据此做发送决策（回执仅 rekey/回填/触发既定 drain） | 否 |
| 观测口径（A4.7/§24.8：`ackLatencyMs` t0 = 推送时刻，口径略宽于 β） | D9、§9.5 | **SA8-E1 已闭合（路线 a）**：分块 snapshot/sync 族 t0 = 末 chunk 推送时刻，经 `pendingLastChunkTag` 条目携带 `pushedAt`、结算回调 append-only 第三参回传（§8.6/D9）——**按 §24.8 登记口径实现，零规范文本改动、零 follow-up 让渡** | 否（按登记口径实现；随 §15 复核确认代码路径与文本一致） |
| 包边界：生产 API 经 `src/index.ts`；测试入口真实、行为判据优先 | §11/§12 | 结构门只作补充（PIPE-C3）；断言全为运行期行为 | 否 |
| **模块 AGENTS.md 缝词汇登记（SA8-E2/R2，阻塞）** | §11 ALLOW（`packages/ws-replication/AGENTS.md`） | **已闭合**：ALLOW 清单加入该文件，append-only 补一句 γ 缝词汇登记（出站帧携 `tag`/`lane`、edge→session 增 `receipt{tag,sequence}`；引 ADR 0032 A4 + 协议 §24；冻结面零触碰）——γ 交付与模块契约文档同变更集落盘 | 否（随 §15 复核落盘） |
| 前序票公共面只增不改（#420/#421/#422/#423） | §11 DENY | 零改动 | 否 |
| SA8-R5 复核义务：设计修订后重跑门禁 / 并入实现期复查 | §15 | 本轮修订已按 R1/R2/R3 落实；`requiresConflictRecheck: true` | 是（§15） |

---

## 7. 设计决策与主要备选方案

### D1 γ 公共面 = 独立新工厂/句柄（复用 β 的描述子/信号/配置类型）

`createHubAsyncSessionHost`（新模块 `src/hub-session-async-host.ts`），配置复用 `HubSessionHostConfig`（worker 侧事实：registry/instanceId/limits/timeouts/timer/observer/clock，`hub-session-host.ts:44-52`），`open()` 描述子复用 `HubSessionOpenInput`（纯 JSON），信号复用 `HubSessionSignal`。γ 独有新增类型：句柄、出站帧消息、监听者、回执消息。

- 依据：ADR A4.1「公共面为独立的新工厂/句柄类型」；β 同步签名冻结不可演进（ORACLE-3 运行期证明）。复用而非复制纯 JSON 类型：描述子语义同一（授权投影回放纪律）、避免重复冻结面（#421 D2「不转出口反而扩大冻结面」同款最小化纪律）。
- 备选（否决）：给 β `HubSessionFrameListener` 加可选异步形态——违反 append-only 冻结面（签名已是 `(frame, lane) => number`）；备选「γ 句柄继承 β 句柄类型」——成员集不同步（β `onFrame` 返回 `() => void` 但监听者必须返回 number；γ 监听者无返回契约），继承只会制造假兼容。

### D2 tag = 句柄域内自 1 单调递增的正整数；分配与校验归 γ port 层

- §24.2.4「tag 由 session 侧分配，会话域内单调唯一，纯 JSON」。每句柄（= 每 (connectionKey, namespaceId) 会话）一个计数器；`handleReceipt` 的 tag 校验（未决集命中、sequence ∈ [1, 0xffffffff]）在 γ port 层单点完成，语义 fan-out 在其下（§8.3）。
- 备选（否决）：tag 由宿主分配——违反 §24.2.4 字面；备选 tag 复用 wire 序号空间——session 不知道连接级序号偏移（HELLO_ACK 等连接级帧不出缝），且会造成 pending/inFlight 键碰撞（见 D4）。

### D3 回执生产点 = 宿主桥对 edge egress 同步返回值的消费；edge 生产代码零改动

- 事实链：盖章单点在 `OutboundQueue.emitOne`（`frame-io.ts:192`）→ `ConnectionSender` 字节路径返回盖章序 → edge 公共 egress `sendControlFrame/sendDataFrame → number`（`hub-edge-host.ts:118-123`）。宿主桥（ingress 侧）收到 `frame{tag,bytes,lane}` 后同步调 egress，**在返回值的同一同步段内**把 `receipt{tag, sequence}` enqueue 进该会话的 edge→session 通道——满足 §24.2.3「在盖章点同步投回执、先于处理后续 socket 数据」（对端回 ACK 因果上晚于帧落线，而 receipt 在落线同一同步段已入队；同通道 FIFO ⇒ session 先消费回执后消费 ACK）。
- GAP-5 的化解方式因此**不是**改 `hub-edge.ts:195-198` 的 `emitRaw` 接线（SA6 H4 已证明「不需要新 mux 钩子」——钩子早就在，缺的是接线与配对），而是把「egress 返回值 = 盖章事实」这一既有公共契约用宿主桥兑现为回执。生产 edge/`frame-io` 零改动。
- 备选（否决）：edge 内部感知 tag 并自发回执——要求 edge 持有会话路由表与宿主传输句柄，把宿主传输职责拉进 nomicore，违反「传输实现完全属宿主」（§24.1）。

### D4 异步性 = 「一张异步 bit + 三态锚载体 + pending 独立键空间」，全部 γ 门控

核心难题：`sendControl/sendData/sendUpdateChunk` 的 `number` 返回值在 γ 下是 **tag**（尚未盖章）而 α/β/peer 下是 **已盖章 seq**，消费者（锚写入、窗口记账、末 chunk 结算）必须区分 pending/stamped。方案：

- `createHubSessionSink` 配置新增 append-only 可选成员 `asyncSendTickets: true`（γ sink 组装层唯一设置点），线程化为四个内部 host 面的 append-only 可选成员 `asyncSendTickets?: true`（`HubChannelHost`/`UpdateChannelHost`/`BulkTransferHost`/RoundEngine host）；
- 锚载体统一为 `SendAnchorState`（§8.5）；数据面新增 `pendingSends: Map<tag, entry>` 独立键空间（§8.6）——**tag 与 seq 值域重叠，必须分键空间**：同一会话内 tag 序与 wire 序序同构但值错位（HELLO_ACK 等连接级帧消耗序号），单帧 BOOTSTRAP 的 tag=2 对应 seq=3 时，tag=3 的 pending 项会与另一帧回执 rekey 出的 seq=3 碰撞；
- 回执消费链：γ 句柄 `handleReceipt` → `sink.onReceipt(tag, sequence)`（`HubSessionSink` append-only 可选方法，α/β 实现不定义）→ `HubNamespaceChannel.onSendReceipt` fan-out（UpdateChannel rekey / BulkTransferSender 末 chunk 结算 / RoundEngine 锚回填 / bootstrap 单帧锚回填）→（若结算了 transfer 末 chunk）session 自驱 drain。

备选否决：

- **负数 tag / 值域编码**（正 = seq、负 = tag）：污染冻结的「0 = 未发送/被拒」语义，`seq <= 0` 拒绝判据全部要改共享代码，peer 面共担风险。
- **返回值改 `number | SendTicket` 联合**：`UpdateChannelHost.sendUpdateFrame` 与 peer 实现结构兼容，但窄化代码散布四处热路径，diff 面更大。
- **γ 层镜像锚状态**（句柄里复制一份 bootstrap/step2 锚）：第二事实源，FSM 状态分叉，违反单份实现。

### D5 流控单点化经 dormant 面实现（零共享代码改动）

γ adapterPort 提供 `dataGateOpen: () => true`、`bufferedAmount: () => undefined`、`connectionState: () => 本地两态投影`——`hub-session.ts:210-262` 既有前置闸门在 γ 下自然成为 no-op（A3「缺面 = dormant」先例），A4.3「session 乐观发送、删除前置检查」无需删除任何共享代码即成立。edge 侧账本（`tryEmitDataFrame` 单帧守卫 + 账本投影）保持唯一流控点，越界即既有 1011 收口。

### D6 session 自驱 drain（A4.4 推-FIFO pacing 的 T1 落地）

γ port 持有 `selfDrain()`：循环 `channel.sendFacet.pullAndSendOne()` 直至返回 false（推完即停、禁 busy loop——每次 pull 消费队列项或发送一 chunk，循环必然终止）。触发点：① `onDataQueued`/`requestDataDrain`（= 入队）；② 每条入站缝消息消费之后（= 「ACK 到达」的保守超集：UPDATE_ACK/BOOTSTRAP_ACK/SYNC_APPLIED 等释放窗口或结算载体的消息都被覆盖；drain 无工作即 no-op，幂等）；③ 回执结算了 transfer 末 chunk 之后。γ 不保持跨 session 轮转公平（A4.4 显式接受；连接级 wheel 是拉取机械，跨线程物理不成立）。

### D7 三态锚的「pending-at-ACK = 响亮违例」语义（非 park）

保序条款 ⇒ 合法 ACK 到达 session 时对应回执已消费、锚已 stamped。因此锚处于 idle 或 pending 时收到引用性 ACK = 宿主违契 ⇒ 直接走既有违例判别（`ACK_STATE_VIOLATION` / round `onViolation`），**不等待、不缓冲、不重排**。这是 ANCHOR-C2「扣住回执直接投 BOOTSTRAP_ACK ⇒ 响亮收口」的机制；判别机械与 β 同一套（ORACLE-3 证明该机械在既有实现上敏感）。

### D8 夹具 = 显式 release 的通道对 + 故障注入旋钮（零自动投递）

每会话一对 `SeamChannel`；`enqueue` 同步入队零投递；`release()` 才按 FIFO 同步搬运到消费者（PIPE-C2：不调用释放 ⇒ 零投递；投递数 = 释放步数的函数）。故障注入（负控敏感性，#420 `suppressSequenceReturn` 先例）：`reorder`（下一次 release 交换前两条）、`dropReceipts: n`（丢弃前 n 条 receipt）。夹具只做字节/JSON 中继与信号搬运、零协议决策（沿用 #420/#424 夹具纪律）。

### D9 观测口径：t0 = 推送时刻（SA8-E1 路线 a，本变更集实现）

- `update-sent`：edge 盖章点（宿主桥经 egress 调用触发，既有 `emitUpdateSentAtStamp` 单点）；`sendQueueMs` 整键缺席（γ 缝词汇无 accounting 字段——与 β 工厂形态 adapterPort 丢弃 accounting 的 dormant 形态一致；§24.6「口径 = 仅 session 队内等待」在字段在场时适用）。
- **update/chunked-update 族**：pending 项在 `sendAndRegister` 采样 `sentAt`（推送同步段），回执 rekey 时携带 ⇒ `ackLatencyMs` t0 = 推送时刻，自动符合 §24.8。
- **分块 snapshot/sync 族（SA8-E1 修订落点）**：`BulkTransferSender` 末 chunk 推送（γ async 分支）时在**推送调用边界**采样 `pushedAt`（镜像 `sendAndRegister` 的 `sentAt` 机制，`update-channel.ts:355-363` 先例）并携带于 `pendingLastChunkTag` 条目；末 chunk 回执结算时经 `onLastChunkSent(sequence, settlement, pushedAt?)`（append-only 可选第三参）回传，`hub-namespace.ts` 两处回调写 `chunkedAckT0 = pushedAt ?? this.sampleAckT0()`（`:608`/`:780`）——γ 下 t0 = 末 chunk 推送时刻（含管道与 edge 等待，口径略宽于 β，逐字符合 §24.8:1152 / A4.7:95 / §23.1:751/754/757 登记）；α/β 下回调仍在末 chunk 出站同步栈触发、`pushedAt` 缺省 ⇒ `sampleAckT0()` 原值原点，逐字节不变（既有 301 族测试背书）。
- **不再有「已知精化点/follow-up」**：上一版设计把 t0 迁至回执时刻并推迟精化，被 SA8 裁定 evolution-required（E1：无 override、无落点、无文档修订计划）；本版按登记口径在变更集内实现，规范文本零改动。
- namespace 域 sent 类事件（HB3 `bootstrap-snapshot-sent`/HB10 `sync-step2-sent` 等）：γ 下仍在 session 发送调用点发射（`tag > 0` 门通过即发射）——与 §24.8「t0 = 推送时刻」同口径（session 拥有的最早发送事实）；分块族 sent 事件（`chunked-snapshot-sent`/`chunked-sync-sent`）按 A4.7「chunked 族事件在 session 回执/结算点」于回执结算回调发射。wire 级 sent 事实（`update-sent`）在 edge，两口径分属两侧已登记。γ 测试不写事件序断言（§12.5 DENY；单事件字段值断言除外）。
- **tag 值不得进入任何 observer 事件字段**（固化约束）：hub 侧 `onUpdateSent` 消费面普通帧早退、chunked 族只携 `transferId/chunkCount/totalBytes`（`hub-namespace.ts:1393-1410`；`update-channel.ts:389-393,512-516`）——γ 下作为「sequence」传给 `noteUpdateSent` 的 tag 只用于内部记账判别，任何公共事件键集不出现 tag（TD-C1 键集锁定 + CHUNK 断言背书）。

### D10 ackTimeout 有界性 = 占用判据统一口径（SA2-F1 修订）

γ 下「全部在途仍 pending（`inFlight` 空、`pendingSends` 非空）」正是 PEND 扣留场景；β 判据 `inFlight.size > 0` 在该场景使计时器哑火拆除，违反 §24.4「ackTimeout 锚定与单体内核同构」。修订（机械见 §8.6.1）：

- 计时器回调判据、`onAck` 拆除判据统一为**合并占用** `inFlight.size + pendingSends.size`（不引入 `effectiveInFlightCount` 的 activeTransfer 项——transfer 槽位不属 ACK 超时锚的管辖面；kind=1/kind=2 载体各有自己的超时锚，见 §9.1）；
- 谓词不 γ 门控分支化：`pendingSends` 是无条件私有字段，α/β 下结构恒空 ⇒ 谓词逐值退化为既有判据——单份实现、FSM 零分叉（与 `effectiveInFlightCount` 计入 pending 的既有设计形状一致）；
- 不变量「占用非零 ⇒ 计时器武装」由占用产生/消灭点归纳保证（§8.6.1 论证），消除「回执 rekey 后计时器已拆 ⇒ 在途条目永失超时锚」的中间态（SM-1-②③）。
- 备选（否决）：γ 层另设 watchdog——第二计时器事实源，与 channel 内部记账漂移，违反单份实现；备选「回执到达时重挂」单独补丁——不覆盖 pending-only 场景（回执未到），且引入 armed 状态镜像。

### D11 真实分块覆盖 = 小限额注入（SA2-F2 路线 a；否决 descope）

本票落地的 γ 分块生产分支（末 chunk 回执结算、分块锚回填时点迁移、kind=2 自持 timer 与回执交互）必须有可执行红→绿证据（包 AGENTS.md「Run the focused tests for every changed state-machine path」；SA6 §15-2「γ 需兼容 chunked 族」）。设计采路线 (a)：round 套件增加真实分块 γ 场景，`limits` 为注入面（`boot({ limits })` 双侧生效，`driver.ts:522/:550`），按 #256/#300/#301 小限额先例调小 `maxBootstrapBytes`/`maxSyncDiffBytes`（辅以 `maxUpdateBytes` 控 chunk 尺寸、`maxChunkedBootstrapBytes`/`maxChunkedSyncDiffBytes` 控聚合上限）使**小载荷即走 kind=1 与 kind=2 改道**——不构造超大载荷（非目标「不做大流量」保持；构型约束链见 §13-R6）。断言：末 chunk 回执结算锚、`BOOTSTRAP_ACK`/`SYNC_APPLIED` 回指、ANCHOR-C1 全量断言在分块形态成立、ROUND-C2 parity 含分块形态、t0 口径行为断言（CHUNK-C3，兼为 SA8-E1 所选语义的断言落点——SA2-F2 与 SA8-R1 协同，避免二次返工）。

- 备选（否决）：路线 (b) descope 分块 γ 生产分支（`bulk-transfer.ts` 零改动、另票）——与简报 AC「协商位两形态」+ A4.4 触发点③「transfer 末 chunk 回执」直接冲突；γ 数据面若不支持分块族，chunked 协商连接下 PEND/drain 机械不可判，属能力面残缺而非范围收敛。
- 备选（否决）：超大载荷实测（R6 旧案）——构型成本高且判别力不增（改道判据是字节阈值比较，与载荷绝对大小无关）；小限额注入同构且确定性强。

### D12 模块契约文档同步 = `packages/ws-replication/AGENTS.md` append-only 词汇登记（SA8-E2/R2）

`packages/ws-replication/AGENTS.md:17` 的缝词汇枚举句是模块收录决策（该文件 Boundary 节）；γ 交付（`receipt{tag,sequence}` 过缝、出站帧携 `tag/lane` 元数据）使其被代码逐字突破，而该文件此前不在任何 ALLOW/DENY（默认不可改）。处置：ALLOW 清单加入该文件，**append-only** 补登记——在 seam 纪律条款后追加 γ 形态句（γ 异步缝：session→edge 出站帧以 `frame{tag, bytes, lane}` 携会话域 tag；edge→session 除既有字节帧与控制信号外增 `receipt{tag, sequence}` 序回执——ADR 0032 A4 / 协议 §24；仍无拒纳/闸门/信用词汇），既有枚举句零改写、冻结面零触碰。与 γ 代码**同变更集**落盘（docs/AGENTS.md「当代码行为变化时，更新所有所述契约发生变化的规范文档」）。

- 备选（否决）：改写既有枚举句把 receipt 并入——非 append-only，且 `closed`/`connection-fatal` 的既有表述是前序票冻结口径；备选「另立 spec 票登记」——SA8-E2 明确要求同变更集，滞后即再现同一门禁红。

---

## 8. 接口、状态机和数据流

### 8.1 γ 公共面（`src/index.ts` append-only；命名冻结）

```ts
// src/hub-session-async-host.ts（新模块；头注引用 ADR 0032 A4 + 协议 §24 + issue #447）

/** 出站缝消息（§24.3 session→edge `frame`）：tag 由 session 分配（句柄域内自 1 单调唯一）。 */
export interface HubAsyncSessionFrame {
  readonly tag: number;
  readonly bytes: Uint8Array;          // sequence=0 占位编码；edge 在 mux 点重写 [8..12]
  readonly lane: HubSessionFrameLane;  // 复用 β 类型：'control' | 'data'
}

/** 出站 sink（fire-and-forget）：无同步序号契约——wire 序经 receipt 回传（A4.6）。 */
export type HubAsyncSessionFrameListener = (frame: HubAsyncSessionFrame) => void;

/** 序回执（§24.3 edge→session `receipt`）：序号事实回传，非接纳信号——键集恰 {tag, sequence}。 */
export interface HubAsyncSessionReceipt {
  readonly tag: number;
  readonly sequence: number;           // = 该帧 wire 字节 [8..12] 盖章值
}

export interface HubAsyncSessionHandle {
  /** 入站 namespace 域 wire 帧（fire-and-forget）：sequence 已由 edge 校验，本半边不得再检。 */
  handleFrame(frame: Uint8Array): void;
  /** 序回执消费（签名按简报逐字）：tag = 本句柄已分配且未结算的 tag；sequence = 盖章序。 */
  handleReceipt(tag: number, sequence: number): void;
  /** 出站 sink 注册（fire-and-forget）；至多一个 sink 生效（后注册者替换）；返回退订函数。 */
  onFrame(listener: HubAsyncSessionFrameListener): () => void;
  /** 会话→edge 控制信号观察（settled / connection-fatal；复用 β 信号联合）。 */
  onSignal(listener: (signal: HubSessionSignal) => void): () => void;
  /** 'terminateUnauthorized'（revoke 链；幂等；不溯及已推帧）。 */
  terminateUnauthorized(): Promise<void>;
  /** 'close'（幂等，重复返回同一 promise）：pending 集整体冲刷 + 通道 quiesce。 */
  close(): Promise<void>;
}

export interface HubAsyncSessionHost {
  /** 同步开启一个 (连接, namespace) 会话；描述子纯 JSON（复用 β `HubSessionOpenInput`）。 */
  open(input: HubSessionOpenInput): HubAsyncSessionHandle;
}

/** 工厂配置复用 β `HubSessionHostConfig`（worker 侧事实，不跨缝）。 */
export function createHubAsyncSessionHost(config: HubSessionHostConfig): HubAsyncSessionHost;
```

`src/index.ts` 追加（append-only，带 issue #447 出处注释）：值导出 `createHubAsyncSessionHost`；类型导出 `HubAsyncSessionHost`、`HubAsyncSessionHandle`、`HubAsyncSessionFrame`、`HubAsyncSessionFrameListener`、`HubAsyncSessionReceipt`。**共 6 个新导出（1 值 + 5 类型）；既有 15 值导出与全部类型零改名零删除（值导出 15 → 16）。**

### 8.2 缝消息词汇（§24.3 闭集合，逐字落地）

| 方向 | 消息 | 载体 |
|---|---|---|
| session→edge | `frame{tag, bytes, lane}` | `HubAsyncSessionFrame`（`onFrame` 监听者实参） |
| session→edge | `settled{namespaceId}` / `connection-fatal{code}` | `HubSessionSignal`（`onSignal`，β 既有词汇） |
| edge→session | `frame{bytes}` | `handleFrame(Uint8Array)`（β 同形） |
| edge→session | `receipt{tag, sequence}` | `handleReceipt(tag, sequence)`（`HubAsyncSessionReceipt` 为宿主桥构造面的类型投影） |
| edge→session | `close` / `terminateUnauthorized` | 句柄方法 `close()` / `terminateUnauthorized()`（幂等；A1 既有映射） |

闭集合外零词汇：无 sent/deferred/rejected/credit/gate/paused（SEAM-C3 判据 = receipt 键集恰 `{tag, sequence}`）。夹具消息日志按此词汇断言（SEAM-C1）。**本词汇的模块契约登记（`packages/ws-replication/AGENTS.md` append-only 补句）随实现落盘（D12/§11）。**

### 8.3 γ adapterPort 与回执路由（生产核心，全在 `hub-session-async-host.ts`）

```ts
// γ adapterPort（实现内部 HubSessionEdgePort；第三种 port 形态）
{
  openAdmission: (ns) => Promise.resolve({ outcome: 'authorized', authorization: input.authorization }), // β 同款闭包回放
  sendControlFrame: (frame) => emitSeam(frame, 'control'),   // 分配 tag → onFrame(frame{tag,bytes,'control'}) → 返回 tag（正数）
  sendDataFrame: (frame, _accounting?) => emitSeam(frame, 'data'), // accounting 丢弃（缝词汇无此字段；β 工厂形态同款 dormant）
  dataGateOpen: () => true,          // D5：A4.3 dormant 面（共享闸门代码零改动）
  bufferedAmount: () => undefined,   // D5
  onDataQueued: () => selfDrain(),   // D6：触发点①
  requestDataDrain: () => selfDrain(),
  chunkedUpdateNegotiated: () => (input.selectedCapabilities & CAP_CHUNKED_UPDATE) !== 0,
  connectionFatal: (code, wsCloseCode?) => { connectionStateValue = 'closed'; emitSignal({ type: 'connection-fatal', code }); },
  onChannelSettled: (ns) => emitSignal({ type: 'settled', namespaceId: ns }),
  tryBeginInboundAssembly / endInboundAssembly / observerPresent / emitObserver / connectionId / now,
  connectionState: () => connectionStateValue,  // 本地两态投影（β 同款；close 后发送 → 0 → 既有 send-failed 语义）
}

// handleReceipt(tag, sequence) —— 回执消费单点
handleReceipt(tag, sequence):
  if (已 close/fatal) return;                          // A4.5：收口后迟到回执静默（防御）
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 0xffffffff)
    → connectionFatal('CONNECTION_POLICY_VIOLATION'); return;   // 伪造序号（CONTEXT.md 序回执 _Avoid_）
  if (!unresolvedTags.has(tag))
    → connectionFatal('CONNECTION_POLICY_VIOLATION'); return;   // 未知/重复 tag = 宿主 bug ⇒ 响亮收口（PUB-C3 负控；§24.2.6）
  unresolvedTags.delete(tag);
  const settledTransferLastChunk = sink.onReceipt(tag, sequence); // fan-out（§8.5/§8.6）；返回是否结算了 transfer 末 chunk
  if (settledTransferLastChunk) selfDrain();            // D6：触发点③
```

`emitSeam`：`tag = ++tagCounter`；`unresolvedTags.add(tag)`；同步调用当前 `onFrame` 监听者；返回 tag。未注册 sink 时：β 语义是「未发送 → 返回 0」；γ 对应「未过缝 → 返回 0 且不登记未决 tag、不发 seam 消息」（0 值语义与 β 逐字同构——`resync-required{cause:'send-failed'}` 判据不变）。**γ `onFrame` 监听者同步 throw 原样传播给 `emitSeam` 调用方**（镜像 β `deliverFrame`，`hub-session-host.ts:214-219`）——γ 监听者无返回契约，throw 不被吞、不触发隐式 fatal（SA2-O7 落实）。

`selfDrain()`（触发点② 挂在 `handleFrame` 分派返回之后）：`while (channel.sendFacet.pullAndSendOne()) {}`。

### 8.4 session sink 组装层的 γ 分支（`hub-session.ts`，append-only）

- `HubSessionSinkConfig` 新增 `readonly asyncSendTickets?: true`（γ 工厂是唯一设置点）。
- 设置时：channelHost 透传 `asyncSendTickets: true`；`sendControl/sendData/sendUpdateChunk` 的返回值语义改为「tag」（正值），其余逻辑（占位编码、异常同步传播）不变。
- `HubSessionSink` 新增可选方法 `onReceipt?(tag, sequence): boolean`：fan-out 到唯一 channel 的 `onSendReceipt`；返回「是否结算了 transfer 末 chunk」。α/β 实现不定义该方法（生产调用点 `hub-connection.ts:344`、`hub-session-host.ts:106` 与测试调用点 `test/issue420-shim-hub.ts:218` 全部零改动；`hub-edge-host.ts` 的 `HostSessionAdapter` 装配段 `:931-938` 亦零改动——证据列修订见 §14-O2）。

### 8.5 控制面三态锚（`hub-namespace.ts` + `round-engine.ts` + `types.ts`）

```ts
// types.ts（内部；RoundState.ownStep2Seq 的类型替换——peer 写点全部在 round-engine.ts 内，peer-namespace 零改动）
export type SendAnchorState =
  | { readonly phase: 'pending'; readonly tag: number }     // 仅 γ：已携 tag 过缝、回执未到
  | { readonly phase: 'stamped'; readonly sequence: number }; // α/β 同步返回即此态；γ 回执回填后
```

| 锚 | 载体 | 写点（γ 下） | 回执回填 | 判别（代码语义不变） |
|---|---|---|---|---|
| bootstrap 单帧 | `bootstrapSnapshotSeq: SendAnchorState \| undefined` | `:638` → tag>0 ? `{phase:'pending',tag}` : undefined | `onSendReceipt` tag 命中 → `{phase:'stamped',sequence}` | `:665-671`：idle ∨ pending ∨ `acked !== stamped.sequence` → `connectionFatal('ACK_STATE_VIOLATION',1002)`；成功 → 复位 undefined（`:673`） |
| bootstrap 分块 | BulkTransferSender 的 `pendingLastChunkTag`（载体状态，§8.6） | `enqueue`（`:596-623`）不变 | 末 chunk 回执 → `lastChunkSequence = sequence` → 同步回调 `onLastChunkSent(sequence, settlement, pushedAt?)` → 锚写 `{phase:'stamped'}` | 同上（回执先于 BOOTSTRAP_ACK ⇒ settle 时锚已 stamped） |
| ownStep2 单帧 | `RoundState.ownStep2Seq: SendAnchorState \| undefined` | `round-engine.ts:263` → async ? `{phase:'pending',tag: outcome.sequence}` : `{phase:'stamped',…}` | `RoundEngine.onSendReceipt` tag 命中 → stamped | `:191-192`：idle ∨ pending ∨ 不等 → `onViolation`（`SYNC_STATE_VIOLATION` + failed，既有矩阵） |
| ownStep2 分块 | 同 bootstrap 分块（`noteChunkedStep2Outbound` 于回执结算点以真实 seq 调用 → 写 stamped，`round-engine.ts:243-245`） | `:244` 回调迁移至回执点 | 同上 | 同上 |
| ownStep1（对称处理） | `RoundState.ownStep1Seq` | 同 ownStep2（peer 侧恒 stamped） | `onSendReceipt` 命中即回填 | `:175-176` 既有判别 |

「合法引用性 ACK 在锚 pending 时结构性不可达」的因果依据从「进程内同步」（`round-engine.ts:241-245` 注释）改判保序条款（A4.2）——**pending-at-ACK = 宿主违契 = 响亮违例（D7），非 park**。

> **A4.1/A4.2 调和读法登记（SA8 §3-#9/E3 裁决，非阻断）**：A4.1「`HubNamespaceChannel` 零改动原则保持：全部变化在 port 实现、session sink 组装层与 edge」与 A4.2/§24.4 明文命令的三态锚/两相记账存在附录内部措辞张力；SA8 裁决「零改动」在 A4.2 段内只能读作**判别逻辑/因果不变量保持**（载体扩三态为同段命令），按此读法实施无需 ADR 修订。本设计全部载体改动 = append-only 可选成员 + γ 门控分支 + 锚载体类型替换；FSM（OPEN 矩阵/bootstrap 流程/close 流程/违例处置）零分叉、单份实现保持；α/β/peer 路径行为逐字节不变（825 + 271 测试为硬门）。如团队欲做 A4.1 措辞调和，走显式 amendment（SA8-R3），本票不改 ADR 文本。

### 8.6 数据面 pending 两相记账（`update-channel.ts` + `bulk-transfer.ts`）

```ts
// UpdateChannel（append-only；host.asyncSendTickets 缺省 ⇒ 新分支全死；pendingSends 为无条件私有字段，α/β 恒空）
private readonly pendingSends = new Map<number /* tag */, { bytes: number; sentAt?: number; chunked?: true }>();

effectiveInFlightCount(): number {
  return this.inFlight.size + (this.activeTransfer !== undefined ? 1 : 0) + this.pendingSends.size; // pending 计入窗口（§24.4）
}

// sendAndRegister / sendOneChunk 的 async 分支（在既有 seq<=0 拒绝判据之后）：
//   tag = host.sendUpdateFrame(...)（正数）→ pendingSends.set(tag, { bytes, sentAt(推送时刻采样), … }) → armAckTimer() → 返回
//   中间 chunk（sendOneChunk 非 last）：tag 不入 pendingSends（transfer 槽位语义：activeTransfer 恒占 1 槽；中间 chunk 零占位——与 α/β「中间 chunk 不注册 inFlight」同构）

onReceipt(tag, sequence): 'rekeyed' | 'no-op':
  entry = pendingSends.get(tag); if (!entry) return 'no-op';       // 中间 chunk 回执 / zombie（abandonInFlight 已清 pendingSends——§8.6.1）
  pendingSends.delete(tag); this.inFlight.set(sequence, entry);    // tag→seq 换键不换槽（占用数不变——PEND-C2 判据）；计时器状态不变（占用守恒）
  return 'rekeyed';
```

- **窗口占用时间线**（`maxInFlightUpdates = W`）：推送 → pending 占 1 槽（自推送时刻起算，PEND-C1）→ 回执 → rekey 仍占 1 槽（不增不计双）→ ACK → `onAck(sequence)` 删除（既有 §10.3 机械，含 zombie/ackTimeout：`abandonInFlight`/`teardown` 同步清 `pendingSends`，被弃 tag 的迟到回执落 no-op）。
- **BulkTransferSender**（`bulk-transfer.ts`，append-only）：async 下末 chunk 推送时在**推送调用边界**采样 `pushedAt`（D9）；`state.lastChunkSequence = 0` + `state.pendingLastChunkTag = { tag, pushedAt }` + phase → `'awaiting-ack'`（transfer 槽位继续占用——单帧路径由 `pendingSends` 承接，占用守恒）；`onReceipt(tag, sequence)`：awaiting-ack 且 tag 命中 → `lastChunkSequence = sequence` → 同步 `request.onLastChunkSent(sequence, settlementOf(state), pushedAt)`（append-only 第三参；→ 锚回填/`chunkedAckT0 = pushedAt`/chunked-sent 事件，D9/§9.5）→ 返回「结算了末 chunk」→ γ 层触发 selfDrain（A4.4「transfer 末 chunk 回执」触发点）。中间 chunk 回执：no-op（非 drain 触发点）。kind=2 自持 ACK timer 的武装点保持在末 chunk 推送（β 同点 `bulk-transfer.ts:217`；其回执前触发的角落登记于 §9.1）。
- 判据口径唯一化：`effectiveInFlightCount()` 是窗口唯一口径（SA6 §3-6），`deliver`/`pullAndSendOne`/`BulkTransferHost.windowHasRoom` 三处判据自动覆盖 pending。**例外注记（SA2-O3）**：`takeItems()` 的 `avail = maxInFlightUpdates - inFlight.size`（`update-channel.ts:526`）用裸口径——只决定贪心合并宽度（一帧一槽），窗口不变量不被其破坏，且与既有 activeTransfer 先例同形；不并入 pendingSends（并入反而使合并宽度受未回执帧抑制，改变 α/β 逐字节面）。
- **tag 值域纪律（SA2-O7 落实）**：γ 下 `noteUpdateSent({sequence: tag, …})` 的 tag 仅作内部记账；hub 侧消费面普通帧早退、chunked 族只携 `transferId/chunkCount/totalBytes`——任何公共 observer 事件键集不出现 tag（D9 末条；TD-C1 键集锁定背书）。

#### 8.6.1 ackTimeout 有界性机械（SA2-F1 修订落点；`update-channel.ts`）

```ts
// UpdateChannel —— 占用判据统一口径（不 γ 门控：pendingSends 为无条件字段，α/β 恒空 ⇒ 谓词逐值退化为既有判据）
/** ACK 超时锚的管辖面 = 已注册发送（inFlight）∪ 已过缝未回执发送（pendingSends）。
 *  不含 activeTransfer 槽：kind=0 transfer 的末 chunk 出站即注册 inFlight/pendingSends（已覆盖）；
 *  kind=1/kind=2 载体的超时锚 = 宿主 bootstrap timer / BulkTransferSender 自持 timer（§9.1）。 */
private hasUnsettledSends(): boolean {
  return this.inFlight.size + this.pendingSends.size > 0;
}

private armAckTimer(): void {
  if (this.ackTimerArmed) return;
  this.ackTimerArmed = true;
  this.ackTimerHandle = this.host.armTimer(() => {
    this.ackTimerArmed = false;
    this.ackTimerHandle = undefined;
    if (this.hasUnsettledSends()) this.abandonInFlight();   // F1 修订：γ 下 pending-only 占用同样弃置（β 判据 inFlight.size > 0 为本谓词的退化形态）
  }, this.host.ackTimeoutMs);
}

// onAck（:229-235 两处拆除点，γ 下判据扩为合并占用）：
//   满槽释放分支：inFlight.size === 0 && pendingSends.size === 0 才 disarm（存在 pending ⇒ 保持武装）；
//   wasOldest 重锚分支：disarm + arm 原子重锚原样（占用非零时重锚后仍武装）。

// abandonInFlight（:571-581，γ 扩）：
//   入口新增 pendingSends 全清（zombieSeqs 只收 inFlight 键——seq 域；被弃 tag 保留于 unresolvedTags，
//   其迟到回执消费时 fan-out miss pendingSends ⇒ 'no-op'——与 β「abandon 后迟至 ACK = zombie 良性」同构，
//   不落入 handleReceipt 的未知 tag 响亮分支）；其余（拆 timer、needsResync、清 activeTransfer、
//   onAckTimeout 上抛）原样。
```

- **不变量「合并占用非零 ⇒ 计时器武装」的结构论证**（消除 SA2 SM-1-②③ 的「占用非零而计时器已拆」中间态）：
  - 占用产生点全部武装：`sendAndRegister`（既有 `:394`；γ async 分支 `pendingSends.set` 后同一 `armAckTimer()`）、`sendOneChunk` 末 chunk（既有 `:517`；γ async 分支同点 `pendingSends.set` + `armAckTimer`）；
  - 占用消灭点仅三处，全部在合并占用归零或整体清空后才允许计时器闲置：`onAck` 删除（判据已扩为合并归零）、`abandonInFlight`（清空后拆）、`teardown`（清空后拆）；
  - 回执 rekey（`onReceipt`）不触碰计时器状态：占用自 pending 侧迁 inFlight 侧，合并占用守恒 ⇒ 归纳成立——「回执 rekey 进 inFlight 时计时器已拆」的状态不可达。
- **有界行为**：缝扣留（宿主停止泵送 edgeToSession）或 egress 返回 ≤ 0（不投回执）⇒ tag 停留 pending 占窗 ⇒ 记账 timer 推进 `ackTimeoutMs` ⇒ `abandonInFlight` ⇒ 窗口槽位释放 + `needsResync` 停发 + `onAckTimeout → declareHubResync('ack-timeout')`（wire `RESYNC_REQUIRED`×1（记忆化）+ state `needs-resync` + bulk 载体弃置 + observer `resync-required{ack-timeout}`，`hub-namespace.ts:1290-1327`）——**有限步内必达，无槽位永久滞留、无第二套重试循环**（§24.5 内存安全链的 γ 读法）。行为断言 = PEND-C3（§12）。
- β/α 影响：`pendingSends` 恒空 ⇒ 三个谓词逐值等价于既有判据，行为逐字节不变（既有 825 + 271 测试背书；变异负控见 PEND-C3）。

### 8.7 宿主桥样例（test-only，`test/issue447-async-seam.ts`）

镜像 #424 夹具纪律（头注 1–7：零协议决策、SD-2(a) 单点登记权威、SD-3 每场景一工厂、§8.3.1 registry 同一性采纳、公共入口 import）：

```ts
// ingress 侧（与 edge 同域；「worker」侧 = 同进程 γ SessionHost 实例——夹具抽象，非宿主规范）
resolveSessionSink(connectionKey, namespaceId, authorization):
  connection = connections.get(connectionKey) ?? throw（响亮，无静默兜底）
  handle = asyncHost.open({ connectionKey, remoteInstanceId: connection.authenticatedInstanceId,
                            namespaceId, authorization,
                            selectedCapabilities: egress.chunkedUpdateNegotiated() ? CAP_CHUNKED_UPDATE : 0,
                            connectionId: connectionKey })
  seam = seamHub.channel(connectionKey, namespaceId)          // 每会话一对专用通道（§24.1）
  handle.onFrame((msg) => seam.sessionToEdge.enqueue(msg))     // 纯中继：seam 消息对象入队
  handle.onSignal((s) => seam.sessionToEdge.enqueue(s))        // settled / connection-fatal 同道过缝
  return sink = {
    openNamespace: (m) => seam.edgeToSession.enqueue({ type: 'frame', bytes: encodeMessage(m, { sequence: 0 }) }),
    namespaceFrame: (m, seq) => seam.edgeToSession.enqueue({ type: 'frame', bytes: encodeMessage(m, { sequence: seq }) }),
    terminateUnauthorized: () => seam.edgeToSession.enqueue({ type: 'terminateUnauthorized' }),
    onConnectionClosed: () => seam.edgeToSession.enqueue({ type: 'close' }),
  }

// sessionToEdge 消费（release 驱动；每消息顺序处理）：
//   frame{tag,bytes,lane} → seq = lane==='control' ? egress.sendControlFrame(bytes) : egress.sendDataFrame(bytes)
//                           if (seq > 0) seam.edgeToSession.enqueue({ type:'receipt', tag, sequence: seq })   // ★回执条款：盖章返回值同一同步段入队
//                           else 不投回执（帧未盖章；见 §9.1 登记规则——tag 停留 pending，ackTimeout 有界兜底 §8.6.1）
//   settled{ns} → egress.namespaceSettled(ns)；connection-fatal{code} → egress.connectionFatal(code)
// edgeToSession 消费（release 驱动）：
//   frame → handle.handleFrame(bytes)；receipt → handle.handleReceipt(tag, sequence)；
//   close → handle.close()；terminateUnauthorized → handle.terminateUnauthorized()
```

`makeAsyncReplicationFacade(options)`：registry 采纳形态（`registry`/`timer` 必填、内部恰一个建于其上的 γ 宿主、`accept/acceptTrusted/close/revoke/requestReauth` 组装 `HubReplication` 面）——`boot({ createHub })` 直接注入（与 #424 `makeShardedReplicationFacade` 同一集成点，`test/driver.ts:196/516`）。`limits` 透传（CHUNK 场景的小限额注入经 `boot({ limits })` 双侧生效）。

### 8.8 异步 FIFO 管道夹具（`test/issue447-async-seam.ts`）

```ts
interface SeamChannel<Message> {
  enqueue(message: Message): void;        // FIFO 追加；同步；零投递
  release(): number;                      // 按 FIFO 顺序同步投递全部缓冲给消费者；返回投递数（确定性）
  pending(): readonly Message[];          // 未投递缓冲（断言面：「不释放 ⇒ 零投递」）
  delivered(): readonly Message[];        // 已投递日志（FIFO/不丢/不重断言面）
}
interface AsyncSessionSeam {              // 每 (connectionKey, namespaceId) 一对专用通道
  readonly sessionToEdge: SeamChannel<HubAsyncSessionFrame | HubSessionSignal>;
  readonly edgeToSession: SeamChannel<EdgeToSessionMessage>;   // frame{bytes} | receipt{tag,sequence} | close | terminateUnauthorized
}
// SeamHub：(connectionKey, namespaceId) → AsyncSessionSeam 注册表（跨会话零串道的结构前提）；
// 故障注入旋钮（负控敏感性；#420 suppressSequenceReturn 先例）：
//   reorderNext(connectionKey, namespaceId)   —— 下一次 release 交换前两条（PIPE-C1/SEAM-C2 负控）
//   dropReceipts(connectionKey, namespaceId, n) —— 丢弃前 n 条 receipt（SEAM-C2 负控；ANCHOR-C2 的「扣回执」即其组合）
// 零 worker_threads / 零 MessageChannel / 零真实 timer / 零 wall-clock：投递只发生在显式 release 同步段。
// pumpAll()：确定性定点泵 —— 循环 { 释放全部会话双向通道 → await settle()（微任务冲刷，harness.settle）} 直至无新消息且谓词满足；
//   ROUND 场景用 pumpAll/settleUntil 驱动到 live/close；扣留场景直接不 release 或用旋钮。
// withholdEdgeToSession(connectionKey, namespaceId)：扣留 edge→session 通道投递（PEND-C1/C3 与 CHUNK-C3 的延迟注入面）。
```

### 8.9 回合数据流（OPEN→bootstrap→reconcile→live→close，γ 装配；单帧形态）

以 β golden trace（SA6 §13：hub→peer 7 帧 `HELLO_ACK#1 OPEN_OK#2 BOOTSTRAP_SNAPSHOT#3 SYNC_STEP1#4 SYNC_STEP2#5 SYNC_APPLIED#6 CLOSE_OK#7`；控制帧子集 sha256 `d14774a62139f504…`）为期望序：

1. peer 拨号 → edge acceptTrusted/accept → HELLO → **HELLO_ACK#1**（edge 直发，不出缝）→ peer OPEN_NAMESPACE。
2. edge 全解码 + authorize → resolveSessionSink → 桥 open γ 会话 + 建通道对 → sink.openNamespace → `edgeToSession.enqueue(frame{bytes(OPEN,seq0)})` → release → `handle.handleFrame` → 通道 startOpen（`openAdmission` 闭包回放投影）→ OPEN_OK：`sendControl` → γ port tag=1 → `sessionToEdge.enqueue(frame{tag:1,'control'})` → release → 桥调 `egress.sendControlFrame` → **盖章 seq2** → 同步段 `edgeToSession.enqueue(receipt{1,2})`。
3. bootstrap：快照 ≤ maxBootstrapBytes → 单帧路径，锚写 `{pending,tag:2}`；`frame{tag:2}` 过缝 → 盖章 **seq3** → `receipt{2,3}` 入队。
4. release(edgeToSession)：FIFO 先 `receipt{1,2}`（无锚命中，rekey 无 pending 项 → no-op，tag 出未决集）后 `receipt{2,3}`（锚 → `{stamped,3}`）。
5. peer（微任务）回 `BOOTSTRAP_ACK{acked:3}` → edge 校验序 → 桥 enqueue `frame{bytes(ACK, inboundSeq)}` → release → `onBootstrapAck`：锚 stamped 3 === acked 3 ✓ → reconciling（锚复位 undefined）→ Step1（tag=3 → seq4 → receipt{3,4}）→ peer Step2（`relatedStep1Sequence:4`；回执已先到 ⇒ `ownStep1Seq` 已 stamped）→ Step2（tag=4 → seq5 → receipt{4,5} → `ownStep2Seq` stamped）→ peer SYNC_APPLIED{acked:5} ✓ → live。
6. peer CLOSE_NAMESPACE（inbound seq N）→ `onCloseRequest` → CLOSE_OK（tag=k → seq7；`ackedSequence` 回指 N）→ closed → `settled{ns}` 信号过缝 → `egress.namespaceSettled`。每步 ACK/回指帧到达 session 前其回执必已在同通道先被消费（§8.3 回执条款 + FIFO）——ANCHOR-C1 的结构保证。

**真实分块形态（CHUNK-C1/C2 场景，同一数据流的改道形态）**：小限额下步骤 3 的快照 > `maxBootstrapBytes` → kind=1 改道：`bulkTransfer.enqueue` → selfDrain 逐 chunk `frame{tag_i,'data'}` 过缝（中间 chunk 回执 no-op；每 chunk 各携独立 tag、各恰一条 receipt）→ 末 chunk 推送时 `pendingLastChunkTag = {tag_k, pushedAt}` + phase awaiting-ack → 末 chunk 回执结算 `onLastChunkSent(seq(末 chunk), settlement, pushedAt)` → 锚 stamped（= 末 chunk UPDATE_CHUNK 帧序）+ `chunkedAckT0 = pushedAt`（D9）→ peer 组装收齐后回 `BOOTSTRAP_ACK{acked: 末 chunk 帧序}` ✓。步骤 5 的 hub Step2 diff > `maxSyncDiffBytes` 时同构走 kind=2（`SYNC_APPLIED.ackedSequence` 回指末 chunk 帧序；`ownStep2Seq` 经 `noteChunkedStep2Outbound` 于回执结算点回填）。

### 8.10 交付 sequencing（控制面先行）

实现票内落地顺序（均为同一验收面服务，非独立切片）：① γ 公共面 + 三态锚 + 回执路由（控制面）→ ② 数据面 pending 两相记账 + ackTimeout 有界性机械（§8.6.1）+ 自驱 drain → ③ FIFO 夹具 + 宿主桥 → ④ 回合/parity/pend/anchor 测试族 + **真实分块场景（CHUNK-C1/C2/C3）** + test-d + **模块 AGENTS.md 词汇登记（D12）**。每步之后既有 β 矩阵必须保持绿（硬门）。

---

## 9. 错误、恢复、并发和幂等

### 9.1 缝完整性违例与超时（响亮收口，零静默降级；全部有界）

| 违例/超时 | 判别点 | 可观察结果 |
|---|---|---|
| 未知/重复 tag 回执；sequence 非法（<1、>0xffffffff、非整数） | `handleReceipt` 入口（γ port 层） | `connection-fatal{code:'CONNECTION_POLICY_VIOLATION'}` 信号 → 桥 `egress.connectionFatal` → 连接 ERROR + close 1008（`wsCloseCodeFor`，既有映射单点） |
| 回执被扣、引用性 ACK 先到（ANCHOR-C2） | 锚 pending/idle + ACK 判别（`hub-namespace.ts:665-671` / `round-engine.ts:191-192`） | `ACK_STATE_VIOLATION`（close 1002）或 `SYNC_STATE_VIOLATION` + failed——**有限冲刷内必达结局，零 park**（ORACLE-3 敏感性已证） |
| UPDATE_ACK 引用未 rekey 的 seq（数据面同型违例） | `UpdateChannel.onAck` → 'violation' | `connectionFatal('ACK_STATE_VIOLATION', 1002)`（既有机械） |
| **缝扣留（宿主停止泵送 edgeToSession；SA2 SM-1/ER-1）** | 记账 timer 推进 `ackTimeoutMs` + 合并占用判据（§8.6.1） | `abandonInFlight`：pending/inFlight 全弃（窗口槽位释放）+ `needsResync` + wire `RESYNC_REQUIRED`×1（记忆化）+ state `needs-resync` + bulk 载体弃置 + observer `resync-required{ack-timeout}`；迟到回执 = 良性 no-op（不 fatal）；恢复 round 修复——**ackTimeout 为有界兜底，机械成立（PEND-C3 断言）** |
| **egress 返回 ≤ 0（帧未盖章）** | 桥 | **不投回执**（receipt 只承载盖章事实）；该 tag 停留 pending 占窗。γ 装配下 egress 的 0 仅来自单帧超限（配置错误 → 响亮收口 + 诊断，A4.3）或账本越界（→ 1011 连接级死亡），水位暂停路径在无 `bufferedAmount` 传输上 dormant（§9.4）——非终局形态下由 §8.6.1 ackTimeout 有界兜底（同上一行）；终局形态下未决 tag 随 close 整体冲刷（§9.2） |
| **kind=2 自持 ACK timer 先于末 chunk 回执触发（SA2 SM-8/O5；γ 特有时序差：β 锚在发送时已置，γ 锚在回执时回填）** | `BulkTransferSender.armAckTimer` 回调（`bulk-transfer.ts:253-265`；γ 下武装点 = 末 chunk 推送） | 载体弃置（`disposeCurrent`）+ `onAckTimeout → onBulkTransferAckTimeout → declareHubResync('ack-timeout')`（`hub-namespace.ts:795/:836`）；迟到末 chunk 回执 = no-op（载体已弃）；迟到 `SYNC_APPLIED` ⇒ 锚未回填（`ownStep2Seq` 仍 pending/undefined）⇒ 既有判别响亮 `SYNC_STATE_VIOLATION` + failed——结局同为响亮失败，零 park（CHUNK-C2 负控覆盖） |
| 缝上帧不可解码 | γ `handleFrame` decode catch（β 同款） | `connection-fatal{code}`（MALFORMED_FRAME 族） |

### 9.2 生命周期（A4.5 单规则）

- edge 决定收口时刻起，session→edge 后到一切静默丢弃（桥/edge 既有行为）；`close` 沿同道 FIFO 送达（`edgeToSession.enqueue({type:'close'})`，天然排在先前 receipt/frame 之后）。
- session 收 close：`handle.close()`（幂等，同一 promise）→ `sink.close()` 同步 quiesce 前缀 + 异步尾 → `pendingSends` 整体冲刷（按未发送清算，`teardown` 既有纪律 + pending 清空）→ `unresolvedTags.clear()` → 其后 `handleReceipt` 静默 no-op（防御）。
- `terminateUnauthorized`：幂等、不溯及已推帧（β 语义原样）。
- `settled` 晚到只使 drain 多等；`closeTimeoutMs` 逃生舱不动（§18/§24.7）。

### 9.3 并发与幂等

- 回执消费幂等基线：tag 一次性（未决集成员资格）；重复投递 ⇒ 响亮（非静默忽略）——与「FIFO 不重」义务配套的防御面。**被弃 tag（abandon 后）例外**：`unresolvedTags` 保留、`pendingSends` 已清 ⇒ 迟到回执消费为良性 no-op（zombie 同构，§8.6.1）。
- `selfDrain` 可重入安全：每次 pull 消费队列项或返回 false；无 busy loop；触发点均在同步消息处理边界。
- tag 分配单点（γ port 计数器）；盖章单点（edge mux）；锚/窗口事实源单点（channel/engine 内部）——无第二事实源。
- 会话键唯一：`open()` 对重复 `(connectionKey, namespaceId)` 响亮 throw（β 同款，`hub-session-host.ts:243-257` 先例）。

### 9.4 内存安全链（逐跳有界，γ 读法）

session 队列（`maxQueuedUpdateCount/Bytes` 既有纪律）→ 管道（宿主及时消费 = 测试泵/宿主传输义务，§24.2）→ edge 账本（`maxQueuedBytesPerConnection`/`maxQueuedControlBytes`，越界 1011）。未决 tag 集合有界：≤ 窗口内 pending 帧 + 管道深度内控制帧；**宿主停止泵送时 pending 占窗经 ackTimeout 释放（§8.6.1），`unresolvedTags` 中被弃 tag 随 close/teardown 清空**。OPEN/pending 水位（16 帧/4 并发）原值保留、定性为故障参数（A4.3）。

### 9.5 观测与计时（§24.8 登记；SA8-E1 已按登记口径闭合）

`update-sent` = edge 盖章点（`sendQueueMs` 缺席）；`update-acked`/chunked 族 = session 结算点；**`ackLatencyMs` t0 = 推送时刻——单帧/普通帧经 pendingSends 条目 `sentAt` 携带，分块 snapshot/sync 族经 `pendingLastChunkTag` 条目 `pushedAt` 携带、结算回调回传（D9；β 逐字节不变由既有 301 族背书；γ 口径断言 = CHUNK-C3）**；跨线程事件无全序——γ 测试零事件序断言（单事件字段值断言除外）。

---

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| `src/index.ts` 消费者（宿主/测试 import 公共面） | 15 值导出 + 类型集 | 同 + 6 个 append-only 新导出（1 值 + 5 类型）；既有名零变化 | 零（PUB-C1/TD-C2 断言非回退） | `src/index.ts:5-99`；SA6 GAP-1 |
| `createHubSessionSink` 的两个生产调用点 + 一个测试调用点 | 不传 `asyncSendTickets` | 行为逐字节不变（可选成员缺省 ⇒ 新分支全死） | 零 | 生产：`hub-connection.ts:344`、`hub-session-host.ts:106`；测试：`test/issue420-shim-hub.ts:218`（`hub-edge-host.ts:931-938` 为 `HostSessionAdapter` 装配段、非调用点——证据列修订见 §14-O2） |
| `HubSessionSink` 的实现者（α splice/β HostSessionAdapter） | 不定义 `onReceipt` | 可选方法，不定义即不受影响 | 零 | `hub-split.ts:126-151`；`hub-edge-host.ts:262` |
| `HubNamespaceChannel`/`RoundEngine`/`UpdateChannel`/`BulkTransferSender` 的 α/β/peer 路径 | `asyncSendTickets` 缺省 | 新分支（pending 写入/rekey/回执 fan-out/计时器合并占用判据）全部 γ 门控或退化同构；锚载体替换后 α/β 写点仍产生 `{phase:'stamped'}` 同值语义 | 生产内部改动（§8.5/§8.6/§8.6.1），行为零变化由既有 825 测试背书 | `hub-namespace.ts:128,638,665-673`；`round-engine.ts:244,260-263`；`update-channel.ts:118-146,229-235,601-609`；`bulk-transfer.ts:174-220` |
| peer 侧（`peer-connection.ts`/`peer-namespace.ts`） | `RoundState.ownStep1/2Seq` 消费点全在 `round-engine.ts` | 类型替换后 peer 写点仍走 stamped 分支 | 零（grep 证明 `ownStep1/2Seq` 仅 round-engine/types 两文件出现） | `types.ts:1029-1030`；round-engine 全部写点 |
| edge（`hub-edge.ts`/`hub-edge-host.ts`/`frame-io.ts`/`backpressure.ts`） | egress 返回盖章序 | **零改动**（D3：回执生产 = 桥消费返回值） | 零 | `hub-edge-host.ts:118-130` |
| 既有测试/夹具（418/420/421/422/423/424 族、`test/{driver,harness,issue420-shim-hub,issue424-sharded-hub}.ts`） | — | 零行为变更，全绿为硬门 | 零 | SA6 §4 基线 |
| 新宿主（真实 γ 装配方，nomic-server） | 不可表达 | 按 §8.7 桥样例模式装配（test-only 样例为范式、非宿主规范——#424 头注 1 纪律） | 宿主自定 | ADR 0032 背景 |

---

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/ws-replication/src/hub-session-async-host.ts` | **新建**：γ 工厂/句柄/adapterPort/tag 分配与校验/回执入口/selfDrain | γ 公共面与第三种 port 形态（D1/D2/D3/D6） |
| `packages/ws-replication/src/index.ts` | append-only 导出 1 值 + 5 类型（带 issue #447 注释；共 6 个新导出） | PUB-C1 |
| `packages/ws-replication/src/hub-split.ts` | `HubSessionSink` 增可选 `onReceipt?`；`HubSessionEdgePort` 返回值语义 doc 注释 append（tag 形态） | 回执 fan-out 载体（D4） |
| `packages/ws-replication/src/hub-session.ts` | `HubSessionSinkConfig` 增可选 `asyncSendTickets`；channelHost 透传；`onReceipt` 实现 | sink 组装层 γ 分支（D4） |
| `packages/ws-replication/src/hub-namespace.ts` | `bootstrapSnapshotSeq` 载体三态化（`:128/:605/:638/:665-673` 写读点）；新增 `onSendReceipt` fan-out；`HubChannelHost` 增可选 `asyncSendTickets`；构造器向 UpdateChannel/BulkTransferSender/RoundEngine 透传 bit；`chunkedAckT0` 写点改 `pushedAt ?? sampleAckT0()`（`:608/:780`，D9） | 三态锚 + 回填 + t0 口径（§8.5/D9） |
| `packages/ws-replication/src/round-engine.ts` | `ownStep1/2Seq` 三态化写点 + `onSendReceipt` 回填 + host 增可选 bit | 三态锚（§8.5） |
| `packages/ws-replication/src/types.ts` | 新增 `SendAnchorState`；`RoundState.ownStep1Seq/ownStep2Seq` 类型替换 | 锚载体（§8.5） |
| `packages/ws-replication/src/update-channel.ts` | `pendingSends` 键空间 + `onReceipt` rekey + `effectiveInFlightCount` 计入 + async 分支（`sendAndRegister`/`sendOneChunk`）+ **§8.6.1：`hasUnsettledSends()` 合并占用判据（`armAckTimer` 回调 `:607`）、`onAck` 拆除判据 `:229` 扩合并占用、`abandonInFlight` 清 pendingSends** + host 增可选 bit | pending 两相记账 + ackTimeout 有界性（§8.6/§8.6.1，SA2-F1） |
| `packages/ws-replication/src/bulk-transfer.ts` | `pendingLastChunkTag = {tag, pushedAt}`（推送边界采样）+ `onReceipt` 末 chunk 结算 + `onLastChunkSent` append-only 第三参 `pushedAt?` + host 增可选 bit | 分块族回执 + t0 口径（§8.6/D9，SA2-F2/SA8-E1） |
| `packages/ws-replication/AGENTS.md` | **append-only**：seam 纪律条款（:17）后补一句 γ 缝词汇登记（出站帧携 `tag`/`lane`、edge→session 增 `receipt{tag,sequence}` 序回执；引 ADR 0032 A4 + 协议 §24；无拒纳/闸门/信用词汇）；既有枚举句与冻结面零改写 | 模块收录决策随代码行为变化同步（SA8-E2/R2、docs/AGENTS.md 纪律；D12） |
| `packages/ws-replication/test/issue447-async-seam.ts` | **新建**：FIFO 通道对夹具 + 故障旋钮 + `withholdEdgeToSession` 扣留面 + 宿主桥样例 + γ facade + 探针 | AC4/AC5 基建（§8.7/§8.8） |
| `packages/ws-replication/test/ws-replication-issue447-async-session-api.test.ts` | **新建**：PUB-C1（运行时导出表 ⊇ β15 ∪ {γ 工厂} = 16 值导出 + typeof）、PUB-C3（句柄成员/幂等/响亮负控）、SEAM-C3（receipt 键集） | AC1/AC2 运行期面 |
| `packages/ws-replication/test/ws-replication-issue447-async-seam-fixture.test.ts` | **新建**：PIPE-C1/C2（FIFO/不丢/不重/零串道/零投递-显式释放）、SEAM-C1/C2（词汇闭集合/tag 纪律/回执配对 + reorder/drop 负控）、PIPE-C3 补充结构门 | AC2/AC4 |
| `packages/ws-replication/test/ws-replication-issue447-async-session-round.test.ts` | **新建**：ROUND-C1/C2/C3（真 peer + 真 Registry/Runtime + β/γ 同场 parity，peer random 钉死）、ANCHOR-C1/C2、PEND-C1/C2（`maxInFlightUpdates=1`）、**PEND-C3（ackTimeout 有界性：扣留 + timer 推进 ⇒ RESYNC_REQUIRED + 槽位释放 + 迟到回执 no-op + 变异红）**、**CHUNK-C1/C2/C3（真实分块 γ 场景：小限额注入 kind=1/kind=2 改道、末 chunk 回执结算锚、parity 含分块形态、t0=推送口径断言）** | AC3/AC5 + SA2-F1/F2/SA8-E1 验收落点 |
| `packages/ws-replication/test/ws-replication-issue447-async-session-api.test-d.ts` | **新建**：TD-C1（γ 工厂/句柄/消息键集类型锁定 + ≥3 条 `@ts-expect-error` 负控）、TD-C2（β 冻结面非回退块） | AC6 |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/ws-replication/src/hub-session-host.ts` | β 冻结工厂 | AC1「β 冻结签名与行为逐字不动」；420 test-d 锁死 |
| `packages/ws-replication/src/hub-edge.ts`、`hub-edge-host.ts`、`frame-io.ts`、`backpressure.ts`、`hub-upgrade-admission.ts` | edge 半边 | D3：回执生产点在宿主桥；edge 公共面零改动（#421 冻结面 + 盖章单点不动） |
| `packages/ws-replication/src/hub-connection.ts`、`plugin.ts` | α 单体组合根 / 插件轨 | γ 不触碰 α/服务面（#422 冻结面） |
| `packages/ws-replication/src/peer-connection.ts`、`peer-namespace.ts` | peer 侧 | peer 不拆分（ADR 0032）；γ 仅 hub 侧 |
| `packages/ws-replication/src/testing.ts` | 生产测试面 | γ 夹具属 test-only（简报明示；SA6 §15-5），不入 `src/testing.ts` |
| `packages/ws-replication/test/{driver,harness,issue420-shim-hub,issue424-sharded-hub}.ts` 与全部既有 `*.test{,d}.ts` | 既有验收族 | 既有矩阵全绿是硬门；γ 夹具独立成文件，β 桥零行为变更（CHUNK 场景的 limits 注入经 `boot({ limits })` 既有参数面，不改 driver） |
| `docs/adr/0032-*.md`、`docs/protocols/instance-replication-v1.md`、`CONTEXT.md` | 规范权威 | **SA8-E1 经路线 (a) 按登记口径实现（D9），零规范文本改动**；A4.1 措辞张力经 SA8-E3 裁决登记（§8.5 注），如需调和走显式 amendment（SA8-R3），本票不改 |
| `packages/` 其余包、`domains/`、`apps/`、根配置 | 无关 | 越界 |

---

## 12. 验收与验证映射（SA6 §12 契约条目 → 测试落点）

统一纪律（SA6 §12.0）：断言 = 运行期行为（缝消息对象、wire 原字节、`[8..12]` 序值、`ackedSequence` 回指、`onSignal` 信号、通道计数、窗口计数、文档收敛、单事件字段值）；零源码 grep 断言（PIPE-C3 结构门为唯一补充）；零 skip/only/todo/env override；peer `random: () => 0.5` 钉死；记账 timer（`advanceMs` 式虚拟推进）；延迟 = 显式释放步。运行命令模板（SA6 §14 实测）：

```
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run \
  packages/ws-replication/test/ws-replication-issue447-<name>.test.ts \
  --typecheck.enabled=false --passWithNoTests=false
```

| 契约条目 | 测试文件/场景 | 断言要点（目标实现的预期观察） |
|---|---|---|
| PUB-C1 | api.test.ts | `import * as ns`：运行时导出名集 ⊇ β 冻结 15 名 ∪ {`createHubAsyncSessionHost`}（共 16 值导出）；逐名 `typeof` 不变；γ 工厂为 function |
| PUB-C2 | 既有 418/420/421/422/424 套件 + 包全量 + `tsc -p packages/ws-replication/tsconfig.json` | 271 + 825 全绿；typecheck exit 0（硬门，非新文件） |
| PUB-C3 | api.test.ts | 句柄成员恰 `{handleFrame, handleReceipt, onFrame, onSignal, terminateUnauthorized, close}`；`close()` 二调同 promise；未决集外 tag / 非法 sequence ⇒ `connection-fatal{CONNECTION_POLICY_VIOLATION}` 信号 + 桥侧连接收口（响亮，非静默） |
| SEAM-C1 | seam-fixture.test.ts（γ 回合消息日志） | 缝上消息 type 键集 ⊆ §24.3 闭集合；`lane ∈ {control,data}`；负控：注入集合外消息名 ⇒ 断言红 |
| SEAM-C2 | seam-fixture.test.ts | 每出站帧携 tag；tag 句柄域内严格单调唯一；每 tag 恰一条 receipt；`receipt.sequence === rawSequence(帧字节 [8..12])`（`issue424-sharded-hub.ts:594` 复用）；全连接严格递增；负控：`reorderNext`/`dropReceipts(1)` ⇒ 红 |
| SEAM-C3 | api.test.ts / seam-fixture.test.ts | receipt 消息自有键集恰 `{tag, sequence}`（注入判别键 ⇒ 红） |
| PEND-C1 | round.test.ts（`maxInFlightUpdates: 1`，扣留 edgeToSession 通道） | 扣留期缝上恰 1 条出站 `frame{tag,…}`（第 2 笔 update 在 session 队列，不过缝）；释放后（FIFO：receipt 先于 ACK）ACK 结算释放唯一槽位，session 自驱 drain 推出第 2 帧——**语义澄清（§24.4 权威）**：回执 rekey 不释放槽位，槽位于 ACK 释放；「释放回执后第二帧才过缝」的可观察实现 = 同道 FIFO 释放使 receipt→ACK 依序消费。变异：pending 不占窗 ⇒ 第 2 帧立刻过缝 ⇒ 红 |
| PEND-C2 | round.test.ts（续 PEND-C1） | 回执到达后窗口占用数不变（换键不换槽；`effectiveInFlightCount` 口径）；第 2 帧于 ACK1 结算后由**推送动作**过缝（自驱 drain），无第二次占用；变异：rekey 重复占槽 ⇒ 第 2 帧被无谓阻塞 ⇒ 红 |
| **PEND-C3（SA2-F1 验收）** | round.test.ts（`maxInFlightUpdates: 1`；扣留 edgeToSession 使回执不可达；记账 timer 虚拟推进 `ackTimeoutMs`） | ① timer 推进后：hub 发出 wire `RESYNC_REQUIRED`×1（记忆化恰一次）+ 通道 state `needs-resync` + pending 槽位释放（`effectiveInFlightCount` 归零可观察：恢复 round 后新帧可再推）；② 随后释放被扣通道：迟到 receipt 消费为良性 no-op——**不**触发 `connection-fatal`、**不**结算、**不**重复 RESYNC_REQUIRED；③ 变异负控：计时器回调判据去掉 `pendingSends` 项（恢复 β 裸判据）⇒ 计时器哑火 ⇒ ① 全组断言红；④ β 矩阵（825/271）保持绿（谓词退化同构） |
| ANCHOR-C1 | round.test.ts（单帧 + **真实分块（CHUNK-C1/C2 场景）** 各 ≥1 次） | 全回合如 §8.9：`BOOTSTRAP_ACK.ackedSequence === BOOTSTRAP 载荷帧序`（单帧 = SNAPSHOT 帧序；分块 = 末 chunk UPDATE_CHUNK 帧序）、SYNC 三段齐备、namespace live、hub/peer `encodeStateAsUpdate` 收敛、`CLOSE_OK.ackedSequence` 回指、`settled` 过缝恰一次；收 ACK 后锚复位（再造 unsolicited BOOTSTRAP_ACK ⇒ `ACK_STATE_VIOLATION`）；变异：park 化 ⇒ 有限冲刷内回合不可完成 ⇒ 红 |
| ANCHOR-C2 | round.test.ts（`dropReceipts` 扣 BOOTSTRAP_SNAPSHOT 回执 + 直投 BOOTSTRAP_ACK 语料） | 响亮收口：`connection-fatal{code:'ACK_STATE_VIOLATION'}` + 连接级 ERROR + close 1002；namespace 不 live；有限冲刷内必达（零 park） |
| PIPE-C1 | seam-fixture.test.ts（N 条乱序释放时刻 + 双会话） | 每方向投递序 === 入队序；每条恰一次；计数守恒；A 会话消息绝不出现在 B 通道；变异：`reorderNext` ⇒ 红 |
| PIPE-C2 | seam-fixture.test.ts | 不 release ⇒ `delivered()` 空、`pending()` 恒增（零投递）；`release()` 返回值 = 投递数（确定性函数）；零真实 timer（全测试 `vi.useFakeTimers` 之外无睡眠） |
| PIPE-C3 | seam-fixture.test.ts（补充结构门，复用 420 C4a 模式） | `package.json` + `src/**` 对 `worker_threads\|MessageChannel\|MessagePort` 命中 0（既有 420 门自动覆盖新文件；本套件本地重申） |
| ROUND-C1 | round.test.ts（`boot({ createHub: γ facade, random: () => 0.5, waitFor: 'live' })`；场景同 #424 ROUND-C1/C3；协商位两形态） | `OPEN_OK`×1、bootstrap 载荷恰一组（单帧或分块族）、`BOOTSTRAP_ACK`×1（回指载荷帧序）、SYNC 三段、live、文档收敛、`CLOSE_NAMESPACE`×1 → `CLOSE_OK`×1（回指）、`settled` 经缝恰一次；装配前提断言（γ 宿主 registry === `run.hubNode.registry`，#424 `:56-60` 同款） |
| ROUND-C2 | round.test.ts（同场 β `makeShardedReplicationFacade` vs γ；peer random 钉死；**单帧与 CHUNK 小限额两构型各跑**） | 控制帧子集（HELLO_ACK/OPEN_OK/ERROR/CLOSE_OK/GOAWAY）`framesHexEqual` === undefined；`skeletonOf` 每方向全等（分块构型下含 UPDATE_CHUNK 帧型与帧序序列全等）；数据帧 `docStateOf` 语义等；出站序 1..N 两形态一致；负控：`hubRoot.n` 42→43 ⇒ 全帧比对报差异而控制帧仍等（NC-1 口径） |
| ROUND-C3 | round.test.ts（夹具日志 `(tag, receipt.sequence)` × wire `rawSequence`） | 每 receipt.sequence === 同 tag 帧 `[8..12]`；同会话不重不跳（分块族每 chunk 帧独立 tag 独立回执）；`settled`/`close`/`connection-fatal` 次数与 §24.7 一致；变异：伪造 receipt 序号 ⇒ 红（PUB-C3 响亮路径或 parity 红） |
| **CHUNK-C1（SA2-F2 验收，kind=1）** | round.test.ts（真实分块 γ 回合：小限额注入——`maxBootstrapBytes` 调小（如 8–256 量级，#256 先例）+ `maxUpdateBytes` 控 chunk 尺寸 + `maxChunkedBootstrapBytes` ≥ 快照 + `chunkedUpdate: true`；构型约束链见 R6） | 快照 > `maxBootstrapBytes` ⇒ **真实走 kind=1 改道**：`BOOTSTRAP_SNAPSHOT` 单帧 0 条、`UPDATE_CHUNK` ≥ 2 帧（帧头 `transferKind=1`）；每 chunk 帧携独立 tag、各恰一条 receipt（SEAM-C2 配对）；末 chunk 回执结算锚：`BOOTSTRAP_ACK.ackedSequence === 末 chunk UPDATE_CHUNK 帧序`、ANCHOR-C1 全量断言在分块形态成立（live + 收敛 + close + settled）；β 同限额构型同场 parity（ROUND-C2 分块构型）；变异：末 chunk 结算改单帧锚/不结算 ⇒ BOOTSTRAP_ACK 判别红（pending-at-ACK 或不等） |
| **CHUNK-C2（SA2-F2 验收，kind=2）** | round.test.ts（`maxSyncDiffBytes` 调小强制 hub Step2 diff 超限改道 kind=2） | `SYNC_STEP2` 单帧 0 条、kind=2 chunk 族过缝；末 chunk 回执 ⇒ `ownStep2Seq` 回填（`noteChunkedStep2Outbound` 于回执结算点）；`SYNC_APPLIED.ackedSequence === 末 chunk 帧序`；负控（§9.1 O5 角落）：扣末 chunk 回执 + 虚拟推进自持 timer ⇒ 载体弃置 + `RESYNC_REQUIRED`；随后直投 `SYNC_APPLIED` ⇒ 响亮 `SYNC_STATE_VIOLATION`（零 park，有限冲刷必达） |
| **CHUNK-C3（SA8-E1 验收，t0 口径）** | round.test.ts（γ 分块 bootstrap + observer/clock 注入：扣留末 chunk 回执 k 个虚拟 ms 后释放、再投 BOOTSTRAP_ACK） | `chunked-snapshot-acked.ackLatencyMs` 按推送时刻 t0 计：值 ===（回执等待 k + 后续 m）——含管道/edge 等待跨度；变异：t0 采样点改回执时刻（修订前形态）⇒ `ackLatencyMs` 少 k ⇒ 红；β 同场景不回归（既有 301 族断言背书，t0 = 末 chunk 出站时刻逐字节不变）。非事件序断言（单事件字段值），不违 §12.5 |
| TD-C1 | api.test-d.ts | `createHubAsyncSessionHost` 签型 `(config: HubSessionHostConfig) => HubAsyncSessionHost`；句柄六成员逐项 `toEqualTypeOf`；`HubAsyncSessionFrame` 键集 `{tag,bytes,lane}`、`HubAsyncSessionReceipt` 键集 `{tag,sequence}` 类型锁定；`@ts-expect-error` 负控 ≥3：① γ 异步监听者赋给 β `HubSessionFrameListener`（void 返回 ≠ number）；② γ 配置缺 `registry`；③ `lane` 非法字面量；④ `handleReceipt` 缺参 |
| TD-C2 | api.test-d.ts | β 15 值导出 + `HubSessionHost`/`HubSessionHandle`/`HubSessionSignal`/`HubSessionFrameListener` 逐字类型不变（append-only 证明，与 420/421/422 test-d 同款负控） |

类型门双面（SA6 §14）：新 test-d 必须同时过 `tsc -p packages/ws-replication/tsconfig.json` 与 `vitest run --typecheck`（新增文件自身零错误）；既有 421 test-d 的 vitest typecheck 红 = HEAD 既有（B1），不得据此判 #447 红/绿，修复/豁免属另票。

### 数据流路线

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| 出站帧（session→edge） | channel FSM `sendControl/sendData/sendUpdateChunk`（占位编码帧） | γ port：tag 分配 + `unresolvedTags` 登记 | `frame{tag,bytes,lane}` 纯 JSON+字节消息 | sessionToEdge 通道（显式 release） | 桥 → `egress.sendControlFrame/sendDataFrame` | wire 帧（[8..12] 盖章）+ 探针 seam 日志 | sink 未注册 ⇒ 0（β 同义）；close 后 0 | SEAM-C1/C2、ROUND-C3 |
| 回执（edge→session） | 桥在 egress 返回值同步段 | `receipt{tag,sequence}` 入 edgeToSession | 事实键恰 {tag,sequence} | edgeToSession 通道（FIFO，先于后续入站帧） | γ `handleReceipt` → `sink.onReceipt` fan-out | 锚 pending→stamped；pending 项 rekey（携 `sentAt`）；transfer 末 chunk 结算（携 `pushedAt` → `chunkedAckT0`） | 未知/重复/非法 ⇒ `CONNECTION_POLICY_VIOLATION` 响亮；close 后 no-op；abandon 后 zombie 类 no-op | ANCHOR-C1/C2、PEND-C2/C3、ROUND-C3、CHUNK-C1/C2/C3 |
| 入站帧（edge→session） | peer wire 帧（edge 校验序后 `sink.namespaceFrame`） | 桥 `encodeMessage(msg,{sequence})` → `frame{bytes}` 入队 | 字节面（序列已校验，session 不重检） | edgeToSession 通道 | γ `handleFrame`（decode + 分派壳，β 同款） | 通道 FSM 状态迁移；消费后 selfDrain | decode 失败 ⇒ connection-fatal（β 同款） | ROUND-C1 |
| 控制信号（session→edge） | `onChannelSettled`/`connectionFatal` | γ port `emitSignal` | `settled{ns}` / `connection-fatal{code}` | sessionToEdge 通道 | 桥 → `egress.namespaceSettled/connectionFatal` | drain 提前完成 / 连接收口（code→close code 单点留 edge） | 监听者 throw 隔离（β 同款）；`onFrame` 监听者 throw 原样传播 | ROUND-C1（settled 恰一次） |
| 生命周期（edge→session） | edge `close`/revoke → sink 信号 | 桥 `close`/`terminateUnauthorized` 消息入队（同通道 FIFO） | — | edgeToSession 通道 | `handle.close()/terminateUnauthorized()` | pending 冲刷 + 通道 quiesce；幂等 | 迟到 receipt no-op；`closeTimeoutMs` 逃生舱不动 | §9.2、ROUND-C1 close 段 |
| 窗口记账 | `deliver`/`pullAndSendOne`/回执/ACK/超时 | `pendingSends`/`inFlight`/`activeTransfer` | tag→seq 换键不换槽 | channel 内部（不出缝） | `effectiveInFlightCount`（唯一口径；`takeItems` avail 裸口径例外注记 §8.6） | 占窗自推送；ACK 释放；ackTimeout 弃置（合并占用判据 §8.6.1） | `abandonInFlight`/`teardown` 同步清 pending（被弃 tag 迟到回执 = no-op） | PEND-C1/C2/C3 |
| 分块结算（kind=1/2） | 末 chunk 推送（tag 登记 + `pushedAt` 采样）→ 末 chunk 回执 | `pendingLastChunkTag = {tag, pushedAt}` | awaiting-ack 相位；结算回调 append-only 第三参 | BulkTransferSender 内部（不出缝） | `onLastChunkSent(sequence, settlement, pushedAt)` → 锚回填 + `chunkedAckT0 = pushedAt` | BOOTSTRAP_ACK/SYNC_APPLIED 回指末 chunk 帧序；chunked-sent 事件于结算点 | kind=2 自持 timer 先触发 ⇒ 载体弃置 + RESYNC_REQUIRED（§9.1）；迟到回执 no-op | CHUNK-C1/C2/C3 |

---

## 13. 风险、回滚和残余问题

| # | 风险/残余 | 评估与缓解 |
|---|---|---|
| R1 | A4.1 措辞与 A4.2 落点的表观张力 | **SA8 §3-#9/E3 已裁决**：「零改动」= 判别逻辑/因果不变量保持，载体扩三态为 A4.2 明文命令，无需 ADR 修订；本设计按该读法执行并登记（§8.5 注、§6）。如团队欲措辞调和，走显式 amendment（SA8-R3），不在本票改 ADR |
| R2 | tag/seq 值域碰撞 | 已由独立键空间结构性消除（D4）；PEND-C2 变异负控锁死 |
| R3 | 既有 421 test-d vitest typecheck 红（B1）污染 #447 类型门判读 | 类型门以 `tsc` 为主面 + 新文件 vitest typecheck 自身零错误；421 修复属另票（SA6 §15-B1 建议） |
| R4 | ~~`chunkedAckT0` 采样点迁移的观测口径精化~~ | **已闭合（SA8-E1 路线 a）**：t0 = 末 chunk 推送时刻经 `pendingLastChunkTag.pushedAt` 携带实现（D9/§8.6/§9.5），按 §24.8 登记口径、零规范改动、零 follow-up；行为断言 = CHUNK-C3 |
| R5 | β 工厂形态 facet dormant（`dataFacetOf → undefined`）⇒ β 工厂形态下排队/分块出站无 drain 路径（既有观察，非 γ 引入） | γ 的 selfDrain（D6）正是 γ 形态的对应机制且为 PEND/分块场景承重；β 侧是否补 drain 属独立观察（follow-up 登记，不在本票扩大范围） |
| R6 | CHUNK 小限额构型约束链（取代旧案「超大载荷增强项」——真实分块现为硬门，D11） | 构型须满足启动期响亮校验（`validate.ts:160-204/:238-249`）：`maxBootstrapBytes ≤ maxFrameBytes − PROTOCOL_OVERHEAD_BYTES`（PROTOCOL_OVERHEAD_BYTES 为常量，8 MiB 缺省下小值恒满足）；`maxQueuedControlBytes ≥ maxBootstrapBytes + PROTOCOL_OVERHEAD_BYTES`（8 MiB 缺省恒满足）；显式表达 `maxChunkedBootstrapBytes` 时 `≤ maxChunksPerUpdate(64) × maxUpdateBytes`；双侧同 limits（`boot({ limits })`，`driver.ts:522/:550`）；快照/diff 字节数落在 `maxBootstrapBytes < bytes ≤ maxChunkedBootstrapBytes`（kind=1）/`maxSyncDiffBytes < bytes ≤ maxChunkedSyncDiffBytes`（kind=2）窗口。可行带：`maxBootstrapBytes/maxSyncDiffBytes` 取 8–256、`maxUpdateBytes` 取 chunk 尺寸（如 64–512）、聚合上限取 4096 级（≤ 64 × maxUpdateBytes）——#256/#300/#301 先例同构；违反即构造期 throw（测试红即构型错，非实现缺陷） |
| R7 | 回滚 | 全部生产改动 additive 且 γ 门控：回滚 = 删 `hub-session-async-host.ts` + `src/index.ts` 导出 + 各文件 γ 分支/可选成员 + AGENTS.md 登记句；α/β 无需回归修复（825 测试为回滚后基线） |
| R8 | 命名一经本设计冻结（`createHubAsyncSessionHost` 族），SA6 契约 §15-3 要求原位补可执行 γ 测试文件 | 实现/测试票按本设计命名落地；如评审改名，需同步改 §8.1/§11/§12 全部引用（本文件为唯一事实源） |
| R9 | 未决 tag 集合在宿主停止泵送时增长 | 有界性依赖宿主传输义务（§24.2）+ §8.6.1 ackTimeout 释放（pending 占窗部分）；γ 侧上界 = 窗口 + 控制帧管道深度；`unresolvedTags` 中被弃 tag 随 close/teardown 清空；测试扣留场景有限（登记，不构成生产风险） |
| R10 | γ host `sessions` Map 无终态移除——β `HubSessionHostImpl` 同形（`hub-session-host.ts:238-257`）；长寿命 worker 宿主会累积已关句柄（SA2-O6） | 源码同形先例；follow-up 登记（与 R5 同类；不在本票扩 scope——β/γ 行为对称是「逐字不动/同构」约束的直接推论） |
| R11 | 错配/重复回执 sequence（合法域内）不在 `handleReceipt` 入口拦截，依赖下游锚/ACK 判别响亮收口（错误码间接；SA2-O4） | SEAM-C2/ROUND-C3 已锁 receipt↔wire 配对（夹具日志与 wire `[8..12]` 交叉断言）；可选加固（每会话回执序严格递增检查）登记为 follow-up，不入本票（避免新触发面无规范依据） |

---

## 14. 评审修订映射

评审输入：`wiki/raw/task_issue-447_sa2_review.md`（SA2，verdict reject，F1/F2 + O1–O7）；`wiki/raw/task_issue-447_design_conflict_report.md`（SA8 设计后复审，verdict reject，E1/E2 阻塞 + E3 裁决 + R1–R5）。逐条处置：

| Finding | 修订位置 | 处理结果 |
|---|---|---|
| **SA2-F1**（MAJOR：`armAckTimer` 回调守卫 `inFlight.size > 0` 使 pending-only 占用下 ackTimeout 哑火；§24.4 同构要求失效；rekey 后永失超时锚） | §7-D10、**§8.6.1**（全文新增：`hasUnsettledSends()` 合并占用判据 + `onAck` 拆除判据扩展 + `abandonInFlight` 清 pending + 「占用非零 ⇒ 武装」归纳论证 + 有界行为链）、§9.1（缝扣留行）、§11 ALLOW（update-channel.ts 行）、§12 **PEND-C3**（行为断言 + 变异负控）、数据流路线（窗口记账行） | 已落实：计时器回调判据与拆除判据 γ 下计入 `pendingSends`（不门控分支化——α/β 谓词逐值退化同构，单份实现）；「占用非零而计时器已拆」中间态经产生/消灭点归纳排除；PEND-C3 锁 needs-resync/RESYNC_REQUIRED/槽位释放/迟到回执 no-op 可观察语义与变异红 |
| **SA2-F2**（MAJOR：γ 分块机械零可执行覆盖；R6「增强项」降格违反包 AGENTS 验证纪律） | §7-D11（路线 a 采择 + descope/超大载荷两备选否决）、§8.9（分块形态数据流）、§8.10（sequencing ④）、§11 ALLOW（round.test.ts 行）、§12 **CHUNK-C1/C2/C3** + ANCHOR-C1/ROUND-C2 分块形态扩展、§13-R6（构型约束链，取代旧案） | 已落实：真实分块 γ 场景为硬门——小限额注入使小载荷真实走 kind=1/kind=2 改道；断言末 chunk 回执结算锚、BOOTSTRAP_ACK/SYNC_APPLIED 回指、ANCHOR-C1 全量、ROUND-C2 parity 含分块形态、kind=2 timer 角落负控、t0 口径断言；旧 R6「增强项而非硬门」表述删除 |
| **SA8-E1 / R1**（阻塞：分块族 `chunkedAckT0` t0 = 回执时刻偏离 §24.8/A4.7/§23.1 登记的 t0 = 推送时刻；二择一） | §7-D9（路线 a：`pushedAt` 携带机制，amendment 备选否决）、§8.6（bulk 段 + `pendingLastChunkTag = {tag, pushedAt}` + `onLastChunkSent` 第三参）、§8.9（分块形态）、§9.5、§11 ALLOW（bulk-transfer.ts/hub-namespace.ts 行）、§12 **CHUNK-C3**、§13-R4（闭合登记）、数据流路线（分块结算行） | 已落实（路线 a）：按登记口径在变更集内实现推送时刻 t0，规范文本零改动、无 follow-up 让渡；β 逐字节不变（`pushedAt` 缺省 → `sampleAckT0()` 原点）；CHUNK-C3 为所选语义的行为断言落点（与 F2 协同，SA2 §13 衔接要求满足） |
| **SA8-E2 / R2**（阻塞：γ `receipt` 逐字突破 `packages/ws-replication/AGENTS.md:17` 缝词汇枚举，文件不在范围） | §7-D12、§6（模块登记行）、§8.2 末段、§11 ALLOW（新行：append-only γ 词汇登记句，引 ADR 0032 A4 + §24；冻结面零触碰）、§13-R7（回滚含登记句） | 已落实：ALLOW 加入 `packages/ws-replication/AGENTS.md`，与 γ 代码同变更集 append-only 落盘（改写既有枚举句/另立票两备选否决） |
| **SA8-E3 / R3**（非阻塞：A4.1/A4.2 调和读法登记） | §6（三锚行）、§8.5 末注（裁决读法全文登记）、§13-R1 | 已登记：按 SA8 裁决读法（「零改动」= 判别逻辑/因果不变量）执行；显式 amendment 留给后续 docs 票，不静默改 ADR |
| SA2-O1（导出计数 7 vs 6 不一致） | §8.1 尾段、§5（GAP-1 行）、§10、§11（index.ts 行）、§12（PUB-C1）、§14 本行 | 已修：统一为 6 个新导出（1 值 + 5 类型）；值导出 15 → 16；PUB-C1 断言口径随之定死 |
| SA2-O2（调用点矩阵证据错位） | §8.4、§10（第二行证据列） | 已修：生产调用点 = `hub-connection.ts:344`、`hub-session-host.ts:106`；测试调用点 = `test/issue420-shim-hub.ts:218`；`hub-edge-host.ts:931-938` 标注为装配段 |
| SA2-O3（`takeItems` 裸口径） | §8.6（例外注记） | 已注记：仅合并宽度，窗口不变量不破，activeTransfer 先例同形 |
| SA2-O4（错配回执 sequence 入口不拦截） | §13-R11 | 登记为可选加固 follow-up；SEAM-C2/ROUND-C3 配对断言已覆盖判别 |
| SA2-O5（kind=2 自持 timer 先于末 chunk 回执角落未登记） | §8.6（bulk 段武装点）、§9.1（专行）、§12 CHUNK-C2（负控） | 已登记 + 负控覆盖 |
| SA2-O6（γ sessions Map 终态不移除） | §13-R10 | follow-up 登记（β 同形先例） |
| SA2-O7（`onFrame` throw 传播未声明 + tag 不入事件字段） | §8.3（`emitSeam` 段）、§8.6（tag 值域纪律）、D9 末条 | 已声明：throw 原样传播（β 镜像）；tag 不进任何 observer 事件键集（TD-C1/CHUNK 断言背书） |

SA2 §13 验收列的逐项对照：F1 → §8.6.1 + PEND-C3（扣留 + timer 推进 ⇒ abandon 可观察；变异红；β 矩阵绿）；F2 路线 (a) → §12 CHUNK 行有对应测试行与断言要点，与 SA8-R1 协同设计（CHUNK-C3）；SA8 §9 预期「R1/R2 闭合后转 clear」——本修订即按该预期落盘，重跑门禁按 SA8-R5（§15）。

## 15. 是否需要设计后 ADR 冲突复查

**需要（`requiresConflictRecheck: true`）**，理由：

1. **公共 API 变化**：`src/index.ts` append-only 新增 γ 工厂/句柄/消息类型（发布即冻结的公共面扩张，ADR 0032 后果节纪律）。
2. **新生命周期/失败语义触发面**：缝 tag 违例的响亮收口用既有码 `CONNECTION_POLICY_VIOLATION`（1008）承载（非新错误码、非新 wire 面，但属新的触发面）；「回执 ≤0 不投」的 edge egress 返回值消费规则（§9.1）是 egress 公共面语义的新登记读法；**§8.6.1 的 ackTimeout 合并占用判据是共享 `update-channel.ts` 计时器语义的扩展（α/β 退化同构，仍属「ackTimeout 锚定与单体内核同构」条款（§24.4）的实现形态裁定）**。
3. **锚语义扩面**：`bootstrapSnapshotSeq`/`ownStep1Seq`/`ownStep2Seq` 载体三态化（A4.2 明文授权的实现形态裁定：单帧锚走 `SendAnchorState` pending 相位、分块锚 pending 相位由 transfer 载体承载）；A4.1/A4.2 措辞张力按 SA8-E3 裁决读法登记（§8.5 注）。
4. **SA8-R5 复核义务**：设计后冲突报告（iteration 0）以 E1/E2 为 reject 依据并登记「修订落盘后重跑本门禁」——本轮修订已落实 R1/R2（§14），需重跑确认转 `clear`；实现期逐项核对 §5 冻结面（β 矩阵全绿、TD-C2、peer 零改动、wire parity）与 R1/R2 落盘。
5. **观测口径实现一致性**：D9 路线 (a) 的代码路径须与 §24.8/A4.7/§23.1 登记文本一致（CHUNK-C3 断言背书），属「修订既有决策登记」的核对面。

不构成复查项：wire 格式零变化（占位+盖章机制原样）；协议 §17/§18/§21 语义零变化；β/α/peer 行为零变化（既有矩阵为证）；模块 AGENTS.md 登记句为 append-only 文档同步（SA8-E2 已给出合格路径，重跑核落盘即可）。
