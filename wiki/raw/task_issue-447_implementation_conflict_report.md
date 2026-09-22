# 冲突门禁报告（实现复审）— issue #447

**被审对象**：SA3 实现（`wiki/raw/task_issue-447_sa3_impl.md` + worktree 实际 diff：10 个修改文件 + 7 个新增文件 + 2 份证据日志）
**门禁类型**：implementation 复查（触发依据：设计 §15 自报需要复查 + SA8 设计后报告 §8-R1/R2/R3/R5 与 §10 `requiresConflictRecheck: true` 的 5 项实现期核对义务 + 实际 diff 触碰共享状态机/公共 API 面）
**门禁轮次**：iteration 0（首份实现复审报告；无同类历史报告需原位更新）
**基线**：worktree HEAD `c86ccbc`；`git status` 证实改动面 = `packages/ws-replication/{AGENTS.md, src/{index,hub-split,hub-session,hub-namespace,round-engine,types,update-channel,bulk-transfer}.ts, src/hub-session-async-host.ts(新), test/*}` + `test/ws-replication-issue418-edge-session-split-contract.test.ts`（SA3 偏差 1，见 §3-#16）；规范文本（ADR 0032 / 协议 / CONTEXT.md）与全部 DENY 面文件零改动（`git diff HEAD --stat -- docs/ CONTEXT.md` 为空）。

---

## 1. Reviewed subject

- subject = **implementation**（SA3 报告全文 + 实际 diff 逐文件审读：`hub-session-async-host.ts`（新，324 行）、`index.ts`、`hub-split.ts`、`hub-session.ts`、`hub-namespace.ts`、`round-engine.ts`、`types.ts`、`update-channel.ts`、`bulk-transfer.ts`、`packages/ws-replication/AGENTS.md`、418 契约测试、4 个新测试文件 + 夹具 `test/issue447-async-seam.ts`）。
- 上游链：简报（AC×6，Comments 空）→ SA6 契约（approve）→ 设计修订版（668 行）→ SA2 第 2 轮（`approve`，F1/F2 闭合）→ SA8 设计后报告（iteration 1，`clear`，5 项实现期义务）→ SA3 实现（含 5 项申报偏差）。SA4/SA9 报告不存在（本复审先行；其发现新决策面时按技能规则可再触发）。
- **Issue 评论 REST 快照为空**（简报 `## Comments` 空 + dispatch 明示）⇒ 无 Owner override 权威；Owner 要求 = 简报正文。
- 核对面（dispatch 指定）：ADR 0032 附录 A4（A4.1–A4.8）、协议 §24（§24.1–§24.8）、相关规范约束（§3/§23.1 事件字段冻结/§17/决策 2）、模块 AGENTS.md 收录决策（含本次 append-only 落盘的 γ 缝词汇句）、CONTEXT.md 词表（SessionHost γ 段 + 序回执词条 `_Avoid_`）、SA8 设计后报告 5 项实现期义务、SA3 申报的 5 项偏差。

## 2. Inputs and decision set

决策集（现行文本为准；与设计后报告 §2 同源，本轮对实现 diff 逐条重核）：

| 决策源 | 状态 | 相关条款 |
|---|---|---|
| `docs/adr/0032-transport-decoupling-edge-session-split.md` | 已接受 | 决策 2（:18 零 worker_threads）、决策 5（:30 观测纪律）、A1（:41 β 同步签名冻结）、后果 :112（公共面发布即冻结、append-only）、A4.1–A4.8（:59-99） |
| `docs/protocols/instance-replication-v1.md` §24 | 规范文本 | §24.1（:1097）、§24.2（:1101-1106）、§24.3（:1108-1120）、§24.4（:1126-1128）、§24.5（:1130-1139）、§24.6（:1143）、§24.7（:1147）、§24.8（:1149-1154） |
| 同上 §3（:16/:23）、§17、§18、§21、§23.1（:741-757，含 :751「ACK timeout 弃置后 zombie 迟到 ACK 零事件」） | 已接受 | 序号纪律；账本；生命周期参数；事件字段冻结 |
| `CONTEXT.md` | 现行词表 | 「SessionHost」γ 段与 `_Avoid_`、「序回执」词条与 `_Avoid_`（本轮原文复读） |
| `packages/ws-replication/AGENTS.md` | 模块契约（含本轮落盘的 append-only γ 登记句——已入决策集） | :17 缝纪律（含新登记句）、:20 工厂 append-only、:22 生产 API 经 `src/index.ts`、Verification 节 |
| `docs/AGENTS.md` | 文档纪律 | 「当代码行为变化时，更新所有所述契约发生变化的规范文档」 |
| 其余 ADR（0010/0012/0013/0022/0023 等） | 无 superseded 影响本票 | wire/分块/abort 语义零变化面 |

代码事实独立核实（本轮逐点；代码只作当前事实确认，不替代决策文本）：

- 冻结面零改动：`git status` 证实 `hub-session-host.ts`、`hub-edge*.ts`/`frame-io.ts`/`backpressure.ts`、`hub-connection.ts`/`plugin.ts`、`peer-*.ts`、`src/testing.ts`、规范文本、其余包/域/应用全不在改动面。
- 零 worker_threads/MessageChannel/MessagePort：`grep -rEc` 对 `packages/ws-replication/src/*.ts` + `package.json` 全部 0 命中（PIPE-C3 结构门面重申）。
- γ 门控形状：`asyncSendTickets` 唯一设置点 = γ 工厂（`hub-session-async-host.ts:114`）；`hub-session.ts`/`hub-namespace.ts`/`round-engine.ts`/`update-channel.ts`/`bulk-transfer.ts` 全部经可选成员条件透传，α/β 缺省 ⇒ γ 分支结构性不可达。
- 事件键集：hub 侧 `onUpdateSent`（`hub-namespace.ts:1453-1473`）普通帧早退（#423 发射点 = edge）、chunked 族只携 `transferId/chunkCount/totalBytes`——tag 作 `sequence` 实参传入但**不进任何公共事件键集**（§23.1 DD1 冻结键集保持）。
- 418 冻结表断言形态：`:560` `expect(Object.keys(productionApi).sort()).toEqual(FROZEN_PRODUCTION_EXPORTS)`——全等断言（偏差 1 的事实基础核实）。
- SA3 证据日志存在且结论与其报告一致（`artifacts/sa3-issue447-gamma-suites.log`：3 files/30 tests 绿 + Type Errors no errors；`…package-suite-and-typecheck.log`：94 files/855 tests 绿 + 包/根 tsc exit 0）。SA8 不运行测试，日志作证据采信。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（实际 diff） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0032 A4.1 + 后果 :112 | 新工厂/句柄类型；`src/index.ts` append-only；发布即冻结 | 新模块 `hub-session-async-host.ts`（`createHubAsyncSessionHost` + 5 类型）；`index.ts` 追加 1 值 + 5 类型（值导出 15 → 16），既有名零改名零删除；β `hub-session-host.ts` 零改动（git status） | implements-existing-decision | `src/index.ts` diff；`src/hub-session-async-host.ts:322`；SA3 日志 PUB-C1/TD-C2 绿 | — |
| 2 | 协议 §24.3 + A4.1 | 七消息闭集合；无拒纳/闸门/信用词汇 | 生产面：`HubAsyncSessionFrame{tag,bytes,lane}`/`HubAsyncSessionReceipt{tag,sequence}`（键集恰二键）/句柄方法承载 `close`/`terminateUnauthorized`/`settled`/`connection-fatal`（复用 β `HubSessionSignal`）；夹具 `SessionToEdgeMessage`/`EdgeToSessionMessage` 联合恰为闭集合；src diff 全文无 sent/deferred/rejected/credit/gate/paused 词汇 | implements-existing-decision | `hub-session-async-host.ts:47-84`；`test/issue447-async-seam.ts:107-140`；SEAM-C1/C3 绿（SA3 日志） | — |
| 3 | 协议 §24.2.3 + A4.2 | 盖章点**同步**投回执、先于后续 socket 数据 | test-only 宿主桥：`sessionToEdge.onDeliver` 内同步调 `egress.sendControlFrame/sendDataFrame`，**返回值同一同步段** `edgeToSession.enqueue({tag, sequence})`（同通道 FIFO ⇒ 回执先于 ACK）；`sequence ≤ 0` ⇒ 不投回执（receipt 只承载盖章事实；tag 停留 pending，ackTimeout 有界兜底，§24.4 机械）。生产代码不实现传输（§24.1 传输完全属宿主）——桥样例为范式，符合决策边界 | implements-existing-decision | `test/issue447-async-seam.ts:492-508`（★回执条款注释在点）；ROUND-C3/ANCHOR-C2 绿 | — |
| 4 | 协议 §24.2.4 + A4.1 | tag 由 session 分配、会话域内单调唯一、纯 JSON | `emitSeam`：每句柄 `tagCounter += 1`（自 1 严格递增）；`unresolvedTags` 一次性成员资格；tag 校验单点在 γ port 层；tag 与 wire 序分键空间（`pendingSends` tag 键 vs `inFlight` seq 键） | implements-existing-decision | `hub-session-async-host.ts:256-264`；`update-channel.ts:127-147` | — |
| 5 | 协议 §24.2.6 | 违契响亮收口、无静默降级 | `handleReceipt`：非法 sequence（非整数/<1/>0xffffffff）⇒ `connection-fatal{CONNECTION_POLICY_VIOLATION}`；未知/重复 tag ⇒ 同码响亮（既有错误码复用，code→close code 映射单点留 edge）；终态门（closed ⇒ 静默）= A4.5 收口后防御，非降级 | implements-existing-decision | `hub-session-async-host.ts:161-177`；PUB-C3 绿 | — |
| 6 | 协议 §24.4 + A4.2 | 两相记账 + 三态锚 + 「ackTimeout 锚定与单体内核同构」 | `pendingSends: Map<tag,…>` 计入 `effectiveInFlightCount`（占窗自推送时刻；rekey 换键不换槽——`onReceipt` 只 `delete+set`，不触碰计时器）；三态锚 `SendAnchorState`（types.ts）落 `bootstrapSnapshotSeq`/`ownStep1/2Seq`，判别语义逐字保持（`anchor.phase !== 'stamped'` ∨ 不等 ⇒ 既有响亮违例；禁 park）；`hasUnsettledSends() = inFlight.size + pendingSends.size > 0` 统一计时器回调判据（`update-channel.ts:713-719`）与 `onAck` 拆除判据（`:292`）；`abandonInFlight` 清 pending（`:677-681`）——SA2-F1 修订逐点落地，α/β 谓词逐值退化（`pendingSends` 无条件字段、结构性恒空） | implements-existing-decision | `update-channel.ts` diff（§8.6/§8.6.1 全落点）；`round-engine.ts:128-157`；`hub-namespace.ts:689-700`；PEND-C1/C2/C3（含变异负控）绿 | — |
| 7 | 协议 §24.5 + A4.3 | 流控单点 edge；session 乐观发送、删前置检查；无逐帧拒纳 | γ port `dataGateOpen: () => true`、`bufferedAmount: () => undefined`（A3 dormant 先例——共享闸门代码零改动即 no-op）；`sendDataFrame` 丢弃 accounting（缝词汇无此字段）；`egress ≤ 0` 不投回执（§9.1 登记规则）；pending 占窗经 §8.6.1 ackTimeout 释放 = 内存安全链 γ 读法机械成立 | implements-existing-decision | `hub-session-async-host.ts:216-222`；`hub-split.ts` doc 追加 | — |
| 8 | 协议 §24.6 + A4.4 | 自驱 drain 三触发点；推完即停；公平性显式放弃 | `selfDrain()`：① `onDataQueued`/`requestDataDrain`；② 每条入站缝消息消费后（`handleFrame` 尾）；③ transfer 末 chunk 回执结算后（`handleReceipt` 返回 true 时）；`while (facet.pullAndSendOne())` 推完即停、无 busy loop；无任何轮转公平机械 | implements-existing-decision | `hub-session-async-host.ts:150-152,174-176,220-222,271-277` | — |
| 9 | 协议 §24.7 + A4.5 | 生命周期单规则 | `close()` 幂等（终态门 + `unresolvedTags.clear()` + `sink.close()`）；close 后迟到 receipt/frame 静默；`terminateUnauthorized` 不溯及（透传既有链）；`teardown` 清 pending/abandonedTags（按未发送清算） | implements-existing-decision | `hub-session-async-host.ts:197-202`；`update-channel.ts:693-699` | — |
| 10 | A4.6 + §24.3 | receipt = 序号事实回传，非接纳信号 | 回执消费面恰：rekey/锚回填/既定 drain 触发（`onSendReceipt` fan-out 三支 + bulk 末 chunk 结算）；无任何「据回执决定发不发」的路径；receipt 键集恰 `{tag, sequence}` | implements-existing-decision | `hub-namespace.ts:726-744`；`hub-session.ts:303-313` | — |
| 11 | **A4.7 + §24.8 + §23.1（E1/R1 实现期核对——SA8 设计后报告 §8-R1）** | `ackLatencyMs` t0 = 推送时刻（:95/:1152）；§23.1 事件字段冻结 | `bulk-transfer.ts`：γ 分支在**推送调用边界**采样 `pushedAt`（`asyncSendTickets === true ? host.now?.() : undefined`——α/β 零新增时钟读）；`pendingLastChunkTag = {tag, pushedAt}`；`onLastChunkSent(sequence, settlement, pushedAt?)` append-only 可选第三参；`hub-namespace.ts` 两写点（kind=1 `:616-636` / kind=2 `:831-843`）`chunkedAckT0 = pushedAt ?? this.sampleAckT0()`——γ t0 = 末 chunk 推送时刻（含管道/edge 等待），逐字符合 §24.8:1152 登记；α/β `pushedAt` 缺省 ⇒ 采样点/取值逐字不变（301 族全绿背书）；普通族经 `pendingSends` 条目 `sentAt` 推送同步段采样；tag 不入事件键集（§2 代码核实） | **implements-existing-decision（E1 代码闭合，与登记文本一致）** | `bulk-transfer.ts:199-249`；`hub-namespace.ts:616-636,831-843`；CHUNK-C3（k+m 断言 + 变异红）绿 | — |
| 12 | A4.8 + 模块 AGENTS Verification | 与 β wire 逐字节等价；既有矩阵全绿硬门 | ROUND-C2 parity（单帧 = β sharded 同场；分块 = β 单体同限额，见 #17）+ 控制帧逐字节/skeleton/docState 三层判据；94 files/855 tests 绿 + 包/根 tsc exit 0（SA3 日志采信）；偏差 3/4 的判据等价物不弱化判据（单帧构型两套判据同结论互证） | implements-existing-decision | SA3 日志；`issue447-async-seam.ts` parity 助手 | — |
| 13 | ADR 0032 决策 2 + A4.1 | 零 worker_threads/MessageChannel 依赖或类型 | 结构门 grep 零命中（src + package.json，本轮独立重申）；夹具纯内存显式 release、零真实 timer | no-conflict | 本轮 grep；PIPE-C3 绿 | — |
| 14 | **`packages/ws-replication/AGENTS.md:17` + docs/AGENTS.md 纪律（E2/R2 实现期核对——SA8 设计后报告 §8-R2）** | 缝词汇枚举句；文档同步纪律 | 登记句**已随 γ 代码同变更集落盘**：diff 证实既有枚举句原文逐字保留（「the seam carries only … byte-identical.」零改写），其后 append-only 追加 γ 句（`frame{tag, bytes, lane}` 出站 + `receipt{tag, sequence}` 回执；引 ADR 0032 A4/协议 §24；「still no rejection/gate/credit vocabulary」；β 冻结面「byte-for-byte untouched」）——与 #422 时代 `connection-fatal` append-only 先例同形，登记内容与实现一致 | **implements-existing-decision（E2 落盘闭合）** | `AGENTS.md` diff（:17 单行内追加，无删改）；系统注入的模块 AGENTS 原文核对 | — |
| 15 | A4.1 与 A4.2 措辞张力（SA8-E3 裁决读法） | A4.1「channel 零改动」 vs A4.2 三态锚载体 | 实现按裁决读法执行：`hub-namespace.ts` 改动 = 载体类型替换（`SendAnchorState`）+ 判别逻辑语义保持（`anchor.phase !== 'stamped'` 与既有 `undefined`/不等判别逐值同构）+ FSM 零分叉（单份 `HubNamespaceChannel`/`RoundEngine`/`UpdateChannel`）；γ 门控全经可选成员；α/β 逐字节不变由 855 绿背书 | no-conflict（裁决读法维持，零 ADR 文本改动） | `types.ts:1024-1047`；`round-engine.ts:128-157`；设计 §8.5 注 | —（措辞调和仍留后续 docs 票，非本票义务） |
| 16 | **418 契约测试冻结表（SA3 偏差 1 裁决）** | `:560` 运行时导出名集 `toEqual` 全等断言；ADR 0032 :112 append-only 纪律；A4.8 既有矩阵全绿硬门 | `FROZEN_PRODUCTION_EXPORTS` 排序插入 `'createHubAsyncSessionHost'`（1 行 + 2 行出处注释）——A4.1 命令 append-only 新导出与该全等断言**在设计侧不可同时字面成立**，编辑是其机械必然；断言语义零改（仍全等）、既有名单项零改、按该文件自有 #422 §12.8「一次性授权编辑」先例形态（注释在点）；该文件是代码非决策文本，不构成冲突基准，但越设计 ALLOW 已由 SA3 如实申报 | implements-existing-decision（A4.1 append-only 扩张的机械必然 + A4.8 硬门共同要求；非决策冲突） | 418 测试 diff（`:152-154`）；`:560` 断言形态核实；#422 先例注释 `:149/:159` | 登记（非阻塞）：ALLOW 面扩张由 SA1/总控追认入设计记录（SA3 报告「Deviations-1」已为该追认提供依据）；无需任何决策文本修订 |
| 17 | **SA3 偏差 2：`abandonedTags` zombie 序登记** | §24.4 两相记账；**§23.1:751「ACK timeout 弃置后 zombie 迟到 ACK 零事件」（规范 zombie 纪律）**；设计 §8.6.1/§9.1 已声明「abandon 后迟至 ACK = zombie 良性、与 β 同构」 | 字面设计（回执 miss ⇒ no-op）会使 γ 下被弃 pending 条目的迟到 `UPDATE_ACK`（wire 序在弃置时未知、回执才揭示）落 `onAck` 'violation' ⇒ 响亮 `ACK_STATE_VIOLATION`——与 §23.1:751 zombie 纪律和设计自报语义**直接相悖**（SA3 实测复现）。实现补全：`onReceipt` miss 分支对 `abandonedTags` 成员把回执揭示的 wire 序登记进 `zombieSeqs`（保序条款保证回执先于该 ACK 消费）⇒ 迟到 ACK 落既有 'zombie' 良性分支、零事件——β zombie 语义在 γ 下**逐值成立**；非 abandoned 序的「未知序 ACK = 响亮违例」判别范围零变化；α/β 无 `onReceipt` 调用面 ⇒ 零行为变化 | **implements-existing-decision（兑现 §23.1:751 规范 zombie 纪律 + 设计声明语义的实现级补全；契约面零变化）** | `update-channel.ts:196-210,674-681`；`onAck` zombie 分支 `:318-321`；PEND-C3 ② 绿 | —（偏差申报合规；属实现使声明语义成立，非设计变更面） |
| 18 | SA3 偏差 3/4：parity 判据能力感知等价物 + 分块 β 参照 = 单体 | A4.8「与 β 形态 wire 逐字节等价」 | 均为 test-only 判据选择：#424 断言族原样用于单帧构型（DENY 文件零改动）；分块构型用同判据的协商位感知等价物（重组 `transferId` 载荷）+ β 单体同限额参照（sharded 夹具不采纳 `boot({limits})` 是该夹具既有事实）；wire 逐字节等价性经等价判据判定且单帧构型两套判据同结论互证 | no-conflict（验收判据选择，不触决策面；等价性论证成立） | SA3 报告 Deviations-3/4；`issue447-async-seam.ts` parity 助手 | — |
| 19 | CONTEXT.md SessionHost γ 段 + 序回执 `_Avoid_` | 不重检 sequence、不伪造序号、盖章单点、回执同道、无拒纳词汇、不引入 worker_threads 类型 | `handleFrame` decode 仅作分派（β 逐字同构，`hub-session-host.ts` 原文对照），sequence 不再校验；回执只消费不伪造；盖章仍在 edge mux 单点；回执与入站帧同 `edgeToSession` 通道（同道 FIFO）；`handleReceipt` 域校验拒绝伪造序（响亮）；零线程类型 | no-conflict | `hub-session-async-host.ts:120-153` vs `hub-session-host.ts`（β 同构对照）；CONTEXT.md:229-241 | — |
| 20 | §24 头注 + A1:40 | γ 是 host-facing 缝，非 wire 契约；不新增 wire 面/错误码/事件型 | wire 格式/错误码/事件型零变化（占位 + mux 盖章原样；`CONNECTION_POLICY_VIOLATION` 既有码复用；事件键集零增——tag 不入键集）；新触发面（tag 违例）= 设计 §15-3 已登记的实现形态 | no-conflict | `hub-session-async-host.ts`；§2 事件键集核实 | — |
| 21 | peer 不拆分（ADR 状态行/后果 :113） | peer 侧零改动 | `peer-*.ts` 零改动（git status）；`RoundState.ownStep1/2Seq` 载体替换后 peer 写点经 `anchorOf` 缺省走 stamped 分支、判别逐值同构；`noteChunkedStep2Outbound` 包装 stamped 同语义 | no-conflict | `types.ts`/`round-engine.ts` diff；855 绿（含 peer 全族） | — |
| 22 | SA8 设计后报告 §8-R3（冻结面逐项） | β 矩阵全绿、TD-C2、peer 零改动、wire parity、谓词退化、导出面 15→16 | 逐项核对通过：855/855 绿 + tsc 双面 exit 0（日志）；TD-C2 β 非回退块在 test-d（10 条 `@ts-expect-error`）；peer 零改动；ROUND-C2 单帧 + 分块两构型 parity 绿；`pendingSends` 无条件字段 + γ 分支全经可选 bit 门控（α/β 结构性恒空 ⇒ 谓词逐值退化，PEND-C3 ④ 变异负控背书）；`index.ts` 15→16 + 5 类型 append-only | implements-existing-decision | 本报告 §5 表；SA3 日志；各 diff | — |

另核（无独立冲突点）：§3 序号纪律（占位 + `[8..12]` mux 单点重写，edge 文件零改动）；§17/§18/§21（limits/水位/closeTimeoutMs 参数零变化——`FROZEN_LIMITS` 表零改动）；ADR 0013/0022 分块 abort 语义（`BulkTransferSender` γ 分支只迁结算时点，`settle`/`disposeCurrent`/自持 timer 既有机械保留，CHUNK-C2 负控覆盖）；ADR 0023（γ 工厂为普通工厂非服务表面，两服务入口互斥纪律未触碰）。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| （无） | — | — | — |

无任何合法 override 且无需 override：Issue 评论空（无 Owner 评论）；无新 ADR/协议版本。全部实现落在既有决策的 implements-existing-decision 区间——E1 按登记口径实现（零规范改动）、E2 文档同步落盘、偏差 1/2 均为既有决策的机械必然/语义兑现，无一项主张改写决策。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（实际 diff） |
|---|---|---|---|
| β 公共工厂/句柄面 | `createHubSessionHost` 族签名与行为逐字 | A4.1:61；A1:41 | 保持（`hub-session-host.ts` 零改动；γ 独立新类型；γ `handleFrame` 分派壳与 β 逐字同构——本轮原文对照） |
| 公共导出面 | `src/index.ts` 只增不改 | 后果 :112；A4.1 | 保持（+1 值 +5 类型；PUB-C1 16 值导出绿；418 冻结表同步插入且断言语义零改） |
| wire 格式与序号纪律 | envelope/帧型/`[8..12]` mux 单点盖章/每连接从 1 严格递增 | §24:1093；决策 2；§3 | 保持（edge/frame-io 零改动；ROUND-C2 逐字节 parity 两构型绿；γ 帧以 sequence=0 占位过缝） |
| 缝词汇闭集合 | §24.3 七消息 + 无拒纳/闸门/信用词 | §24.3:1108-1120 | 保持（生产 + 夹具联合恰闭集合；SEAM-C1/C3 绿；AGENTS.md 登记句与实现一致） |
| α/β/peer 行为 | 与 HEAD 逐字节等价；既有矩阵全绿 | A4.8:99 | 保持（γ 门控全经可选成员；`pendingSends`/`abandonedTags` 结构性恒空；`pushedAt` 缺省路径原点采样；94/855 绿 + PEND-C3 ④ 变异负控） |
| peer 侧 | 不拆分、消费点零改动 | 后果 :113 | 保持（peer 文件零改动；round-engine 载体替换后 peer 写点 stamped 同语义） |
| 错误码注册表与映射单点 | 不新增错误码；code→close code 单点 `wsCloseCodeFor` | A1:40 | 保持（复用 `CONNECTION_POLICY_VIOLATION`/`ACK_STATE_VIOLATION`/`SYNC_STATE_VIOLATION`；映射单点留 edge 未触碰） |
| observer 事件字段集 | append-only 不变；tag 不得入键集 | 决策 5:30；§23.1 | 保持（hub `onUpdateSent` 普通帧早退、chunked 族键集恰 `transferId/chunkCount/totalBytes`——本轮代码核实；DD1 键集冻结未破） |
| §18/§21 生命周期参数 | `closeTimeoutMs` 等/停机语义不动 | §24.7:1147 | 保持（参数面零改动；`FROZEN_LIMITS`/`FROZEN_TIMEOUTS` 类表零改动） |
| 规范文本 | ADR 0032 / 协议 / CONTEXT.md 零改动 | §24 为 A4 规范文本 | 保持（`git diff` 空） |
| 前序票冻结面（#418-#424） | 各公共面与验收族只增不改/全绿 | 模块 AGENTS:20 | 保持（DENY 全部零改动；唯一触碰 = 418 冻结表 append-only 插入，见 §3-#16；全族绿） |

## 6. Evolution requirements

**无。** 本变更集零规范文本改动；两项历史 evolution-required（E1 时序契约 / E2 词汇登记）经本轮实现复审确认按合格路径**代码闭合**：

- **E1 → 闭合（§3-#11）**：`pushedAt` 推送边界采样 + `onLastChunkSent` 第三参 + 两写点 `?? sampleAckT0()` 回退——γ t0 = 推送时刻与 §24.8:1152/A4.7:95 登记文本一致；CHUNK-C3（k+m 断言 + t0 变异红）为行为背书。
- **E2 → 闭合（§3-#14）**：`packages/ws-replication/AGENTS.md` 登记句随 γ 代码同变更集 append-only 落盘，既有枚举句逐字保留，docs/AGENTS.md 文档同步义务兑现。
- A4.1/A4.2 措辞调和（E3）维持「后续 docs 票显式 amendment、不得静默改」的非义务登记；偏差 1 的 ALLOW 追认是任务记录动作，非决策演进。

## 7. Hard conflicts

无。22 项对照全部落在 no-conflict / implements-existing-decision；SA3 的 5 项申报偏差经逐项裁决（§3-#16/#17/#18）：偏差 1 为 A4.1+A4.8 的机械必然（418 冻结表插入，断言语义保持）、偏差 2 为 §23.1:751 规范 zombie 纪律的实现级兑现（γ-only 路径，α/β 零变化）、偏差 3/4 为 test-only 判据选择——均无决策冲突；偏差 5（无阻塞）属实。

## 8. Required actions

| # | 级别 | 行动 | 归属 |
|---|---|---|---|
| R1 | 记录追认（非阻塞） | 偏差 1 的 ALLOW 面扩张（`ws-replication-issue418-edge-session-split-contract.test.ts` 冻结表 1 行插入）由 SA1/总控在设计记录追认（SA3 报告 Deviations-1 已是依据；#422 §12.8 先例形态完整——注释、最小性、断言语义保持三要件齐备）；无需决策文本修订 | 总控 / SA1 |
| R2 | 非阻塞（维持登记） | 偏差 2（`abandonedTags`）在 SA4 实现评审中作为已裁决语义接收（本报告 §3-#17 为其与 §23.1:751/zombie 纪律一致性的冲突面结论）；后续如固化进设计文本，引用本报告即可 | SA4 / 总控 |
| R3 | 非阻塞（可选，维持设计后报告 R4/R5） | CONTEXT.md γ 段登记厂名（规范未锁名，非义务）；A4.1 措辞调和走显式 amendment | 后续票 |
| R4 | 流程提示（非阻塞） | SA4/SA7 尚未产出；其对质量/验收的核验不属 SA8 职责（本报告只裁决策冲突面） | 总控 |

## 9. Verdict

**`clear`**

依据：技能 verdict 规则——「clear：全部为 no-conflict 或 implements-existing-decision」。本轮 22 项对照全部落在该区间；设计后报告（iteration 1）登记的实现期义务 R1/R2/R3（E1 代码路径、E2 落盘、冻结面核对）逐项核验闭合；SA3 的 5 项申报偏差无一项构成与决策集的不兼容：无 override 主张、无规范文本触碰、无冻结面回退、无词汇越界、无静默降级路径。修订既有决策登记（t0 口径）与代码路径一致性（§24.8/A4.7/§23.1）经逐写点核实成立。

## 10. requiresConflictRecheck

**false**。设计后报告置 true 的 5 项实现期核对全部闭合（对照其 §10 编号）：

1. 公共 API append-only 扩张（15→16 + 5 类型）——`index.ts` diff + PUB-C1/TD-C2 绿，闭合；
2. 新生命周期/失败语义触发面（tag 违例响亮收口、egress ≤0 不投回执、§8.6.1 合并占用判据）——代码逐点核实 + PEND-C3（含变异负控）绿，闭合；
3. 三态锚/两相记账/自驱 drain 的 γ 门控与 α/β 逐字节不变——结构性核实（可选成员 + 无条件空集字段）+ 855 绿，闭合；
4. E1 代码路径与登记文本一致（CHUNK-C3）——两写点 + 推送边界采样核实，闭合；
5. E2 登记句同变更集落盘——AGENTS.md diff 核实，闭合。

剩余事项（§8-R1 追认、R2 语义接收、R3 可选登记）均为记录/流程动作，不产生新的待核对决策面；无公共 API、wire、schema、持久化、状态机、生命周期、失败语义或 override 面尚待实现核对。
