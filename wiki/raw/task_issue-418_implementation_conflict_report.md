# SA8 实现后冲突复查 — issue #418：`HubConnectionImpl` 拆分 Edge/SessionHost + 单体进程内组合（ADR 0032 决策 1）

- Dispatch：`sa-e37c726a-39e1-438e-bb39-720f63b566ff`（mabf-sa8 / conflict-gate / iteration 0 of this report type）
- 复查对象：worktree `/home/wangjian/nomicore-fix-issue-418`（分支 `mabf/issue-418`，HEAD `27e012b6606e48797842a79e11e3505819c34cc6`）内的**当前实现 diff**（SA3 iteration 2 产物：`hub-split.ts`/`hub-edge.ts`/`hub-session.ts` 新增，`frame-io.ts`/`backpressure.ts`/`hub-connection.ts` 改写，两测试文件 + codec 守卫测试新增）及其实现证据 `wiki/raw/task_issue-418_sa3_impl.md`
- 裁决：**`clear`**；`requiresConflictRecheck: false`（本报告即实现后复查，SA8 设计报告 §8-R9' 六项逐项闭合——见 §3/§5/§8）
- 触发条件（skill 口径三选一均成立）：设计明示要求复查（设计 §15/SA8 设计报告 §10 `requiresConflictRecheck: true` + §8-R9'）；实际 diff 触碰状态机/生命周期/失败语义三类决策面；新缝面（`openAdmission`）落地。
- 本报告为 issue #418 的**首份 implementation 复查报告**（无同类前版可原位更新；设计期两份报告——iteration 1 与 iteration 2——均已被 `task_issue-418_design_conflict_report.md`（iteration 2, clear）原位收编，其裁决为本报告的对照基准）。

---

## 1. Reviewed subject: implementation

被审对象 = 实际 diff（本轮逐文件亲读）+ SA3 实现报告（iteration 2，原位版）宣称的证据链。核心核对项：

1. **异步 admission 缝（async-admission seam）实现**：`HubSessionEdgePort.openAdmission(namespaceId): Promise<HubOpenAdmission>`（hub-split.ts:65）+ edge 侧 `beginAdmission`/`openAdmission`（hub-edge.ts:338-369）+ session 侧拉取 shim `pullAuthorization`（hub-session.ts:105-111）——与设计 §7 D1/D5.2/D5.3 及 SA8 设计报告 §3 行 4/5（注 C'）裁决的形态逐项一致（§3 行 3/4）。
2. **冻结面（frozen surfaces）**：§5 逐项核对实际 diff——DENY 面全部零 diff、公共 API/配置/wire/observer/既有测试面全部保持。
3. **SA8 设计报告 §8-R9' 六项落地核对**：(i) 缝落地一致性、(ii) 路由与 drain 读台账、(iii) R4' 登记面维持、(iv) R7 消除（M1-revoke 对 HEAD 基线）、(v) R6' 泵预算（两锚 + M1）、(vi) 全量门禁——逐项闭合（§3 各行 + §8-R''）。

SA4/SA9 未运行（`wiki/raw/task_issue-418_sa4*`/`*sa9*` 不存在）——非阻塞：本复查由设计明示要求 + diff 触碰面触发；SA4/SA7 的动态面/实现质量复核不属 SA8 裁决面（SA3 §7 已如实列为 deferred）。

## 2. Inputs and decision set

| 输入 | 路径 | 状态 |
| --- | --- | --- |
| 任务简报 | `wiki/raw/task_issue-418.md` | Issue #418 body 5 AC；§Comments 空、REST comments `[]`（派工单明示）⇒ 无 owner 追加要求、**无 override 通道** |
| 被审实现 diff | `packages/ws-replication/src/{hub-split,hub-edge,hub-session,frame-io,backpressure,hub-connection}.ts` + `packages/ws-replication/test/{…structure,…matrix}.test.ts` + `packages/replication-protocol/test/codec-namespace-routing-key-offset.test.ts` | 本轮逐文件亲读（§3 Evidence 列）；`git status`：3 改写 + 6 新增（含 SA6 契约测试为 iteration 0 产物未改） |
| SA3 实现报告 | `wiki/raw/task_issue-418_sa3_impl.md` | iteration 2 原位版；其 §3/§5/§6/§8 宣称逐项与 diff/日志核对 |
| 批准设计 | `wiki/raw/task_issue-418_design.md` | SA1 iteration 2（736 行）——实现对照基准 |
| SA2 评审 | `wiki/raw/task_issue-418_sa2_review.md` | iteration 2：approve；F1~F5 闭合、N1'~N5' 观察——N1'/N2'/N3' 随实现落地核验（§3 行 4 注） |
| SA8 设计后复查 | `wiki/raw/task_issue-418_design_conflict_report.md` | iteration 2：clear + 注 C' + §8-R1~R9'——本报告对其 §10/requiresConflictRecheck 与 R9' 逐项收口 |
| SA6 契约 | `wiki/raw/task_issue-418_sa6_contract.md` | approve；C0a~C0d 判据 + C1~C6（17 用例，DENY 面未改：mtime 2026-09-21 22:31 保持） |
| 权威决策 | `docs/adr/0032-transport-decoupling-edge-session-split.md` | 已接受；决策 1~5 + 否决备选（:34-37）+ 后果节；状态行「listen 模式行为逐字节不变」 |
| 规范 wire 契约 | `docs/protocols/instance-replication-v1.md` | §1/§3/§6.3/§7.1/§13/§14/§15.2/§17/§19/§21/§23（设计报告 §3 已逐条裁决；本报告按实现证据复核） |
| 术语决策 | `CONTEXT.md` | 「复制 Edge」（:225-227）、「SessionHost」（:229-231）、「路由键契约」（:233-235）——本轮重读 |
| 模块规约 | `packages/ws-replication/AGENTS.md`（:14 admission bounded、Boundaries/Verification 全节）、`packages/replication-protocol/AGENTS.md`、`docs/AGENTS.md`（「Amend or supersede prior decisions explicitly」） | 明确收录的决策与验证门 |
| 关联 ADR | 0010/0012/0013/0022/0023 | 已接受；无 superseded 决策触及本 diff |
| 验证日志 | `artifacts/sa3-issue418-{m1-head-baseline,acceptance-tests,package-suite,typechecks,root-test}-iter2.log` | 本轮 tail/head 复核：25/25、56/56、75/75 文件 569/569 用例、三 typecheck EXIT=0、根 439/439 文件 5299/5299 用例 `Type Errors no errors` |

工作区核验：HEAD `27e012b`、分支 `mabf/issue-418`、`git stash list` 为空（HEAD 基线采集后已复原）；**DENY 面 `git diff --stat HEAD` 全部为空**（`hub-namespace.ts`、`index.ts`、`testing.ts`、`types.ts`、`defaults.ts`、`validate.ts`、`plugin.ts`、`peer-*.ts`、session 机械件 9 文件、`packages/replication-protocol/src/**`、`docs/**`、`CONTEXT.md`、`apps/**`、根配置含 `package.json`）；`git diff --name-only HEAD -- packages/ws-replication/test` = 0（既有测试零修改，含 SA6 契约与两锚）。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（实际 diff） | Classification | Evidence | Required action |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ADR 0032 决策 1 | 沿 `HubChannelHost` 内缝拆分、两半皆 nomicore、listen = 进程内组合、**协议状态机单份**（:12-14）；否决「单体与拆分双实现并存」（:37） | `hub-edge.ts`（连接 FSM/liveness/reauth/五路收口/mux）+ `hub-session.ts`（通道容器 + channelHost 组装 + 分派壳 + shim）+ `hub-connection.ts` 组合根 `createEdge`（sessionFactory 装配，:423-471）。**结构核验**：连接 FSM 唯一在 hub-edge；通道 FSM 唯一在零 diff `hub-namespace.ts`；session 无 FSM 复现——被删机制（二相 `OpenEntry`/`PendingEvent`/`settlePending`/`sunkNames`/`pendingNames`/`dropPendingEntries`/`authorizeFirstOpen`/`replayAuthorization`/投影存储）`grep` 全源码**零残段**；「revoked」仅存于 hub-split.ts:45 注释（说明其不存在）。C0c 断言模块导出面：`hub-connection` = `['createHubReplication']`、edge/session 各单工厂、缝模块零运行时导出——绿 | **implements-existing-decision** | ADR 0032:12-14, :37；本轮亲读三新模块 + 组合根 diff；`grep -rn "OpenEntry\|PendingEvent\|settlePending\|sunkNames\|pendingNames\|dropPendingEntries\|authorizeFirstOpen\|replayAuthorization\|projections" packages/ws-replication/src/` = 零命中；`artifacts/sa3-issue418-acceptance-tests-iter2.log`（C0c 绿） | 无（义务闭合） |
| 2 | ADR 0032 决策 2（出站）+ 协议 §1/§3 | 出站 session 以 sequence=0 占位编码、edge mux 重写 `[8..12]`、单点分配、wire 逐字节不变（:18）；envelope sequence 固定 4 字节大端 `[8..12]` | `frame-io.ts`：`emitOne` = 耗尽检查 → `sequence = lastSeq+1` → **`writeBe32At(bytes, 8, sequence)` 盖章**（单点，连接级与 ns 域帧共用）→ emitRaw；message 形态（`sendControl`/`emit`）为占位编码薄包装（peer 侧零改动）；`hub-session.ts:257-263` `encodePlaceholder`（sequence=0）+ D3.1 闸门前置（`sendData`/`sendUpdateChunk`：connectionState → dataGateOpen → 占位编码 → 缝）。C1a~C1d/C3 金标（SA6 契约 17 用例未改）全绿 = 字节等价的行为证据 | **implements-existing-decision** | ADR 0032:18；`git diff HEAD -- frame-io.ts backpressure.ts`（本轮亲读：+54/+57 行均为字节形态成员 + 可选宿主成员，签名面零破坏）；协议 §3；`package-suite-iter2.log` 569/569 | 无 |
| 3 | ADR 0032 决策 2（缝形态：4 控制信号 / 无接纳信号 / 纯 JSON）——**async-admission 缝实现核对（R9'(i)）** | 「四个控制信号（close/terminateUnauthorized/settled/closed）」+「缝无接纳信号（fire-and-forget）」（:18）；否决备选「缝携带接纳信号（sent/deferred/rejected）」（:36） | 实现与 SA8 设计报告 §3 行 4 裁准的形态逐项一致：**(a)** 四信号在位（`sink.close()`/`sink.terminateNamespace()`/`port.onChannelSettled`/`sink.close()` promise 汇入 settleTail）且语义未动；**(b)** `openAdmission` 为每 (连接, ns) **恰一次**拉取（台账 `Map<string, AdmissionRecord>` 一相、只增不减、`beginAdmission` 仅在首 OPEN 无记录时调用一次——hub-edge.ts:323-328），非逐帧出站接纳回执，否决理由（:36）不附着；**(c)** `HubOpenAdmission` 纯 JSON 三态（authorized/denied/throw），**promise 除台账缺失外永不 reject**（`beginAdmission` try/双回调全吸收，含同步 throw 与非 thenable（`Promise.resolve` 包裹，SA2 N1' 落地）；唯一 reject 面 = 台账缺失 → `INTERNAL_ERROR` 响亮，hub-edge.ts:363-369）；**(d)** port 成员集 = 设计 D1 的 17 成员逐一对应，**无任何新增行为面成员**（无 R4' 消差预检成员之类） | **implements-existing-decision**（决策 3 载体义务；注 C' 范围内） | ADR 0032:18, :36；hub-split.ts:54-99（port 17 成员）、:48-51（三态）；hub-edge.ts:338-369；hub-session.ts:105-111；SA8 设计报告 §3 行 4 四层裁决 | 无（worker 形态重裁决 → §8-R5''） |
| 4 | ADR 0032 决策 3（authorize/OPEN 管线）——**注 C' 形态的落地核对（R9'(i)）** | authorize 在 edge 端调用、OPEN 全解码、被拒 ns 零会话资源、`HubNamespaceChannel` 零改动、准入管线为 edge 职责（:20-22）；机制句「未授权 OPEN 不过缝」经注 C' 目的读法在本票进程内范围不具规范力（设计报告 §3 行 5/§6） | 实现逐点落地注 C' 五点目的：**(i)** 真实 authorize 单点在 edge、恰一次、入参 `{authenticatedInstanceId, nsId}`（hub-edge.ts:345 = HEAD `host.authorize(host.peerInstanceId(), nsId)` 逐值；M1 每臂 `fixture.calls` 恰一次断言绿；C2c/C2d 绿）；shim 仅拉取已结算结局（hub-session.ts:105-111）——session 结构性不可达真实授权器；**(ii)** 到达点建通道：`openNamespace` = HEAD `onOpenNamespace` :880-894 原样（`new` + `channels.set` + `startOpen` 同步前缀，hub-session.ts:84-94）——`onOpenNamespace` ① 台账先建 ② 无条件投递（hub-edge.ts:323-328），①→② 次序约束在位（注释固化，SA2 N3' 落地）；**(iii)** 被拒 ns 零会话资源：denied → shim `{ok:false}` → 零 diff `startOpen` 自身 `!authz.ok` 短路（`registry.open` 之前）——C0b denied/throw 臂 `registry.open` 零调用断言绿；**(iv)** 失败面/闩锁由零 diff 通道原生产出（`finishOpenError`/`isQuietState` 全在零 diff 文件）；**(v)** `hub-namespace.ts` 零 diff（git 核验）。两锚（ac7-faults 12/12、issue171-red 5/5）在包全量日志中绿 = I13 到达点效应与通道在场性的行为证据 | **implements-existing-decision**（注 C' 目的读法；R9'(i) 闭合） | ADR 0032:20-22, :35；hub-namespace.ts:344-372（本轮确认 = HEAD）；hub-session.ts:84-111；`package-suite-iter2.log` 两锚行 + 569/569；`acceptance-tests-iter2.log` C0b 三臂 | 无 |
| 5 | ADR 0032 决策 3（pending 有界缓冲）+ `ws-replication/AGENTS.md`:14 | 「pending 有界缓冲、并发 OPEN 上界……全部为 edge 规范职责」（:22）；「Keep admission bounded across handshake, ready, backpressure, and drain windows」 | 设计报告 §3 行 6 的「就地了结」口径在代码中成立：ready 窗口**零缓冲**（窗口帧到达点即时投递，无窗口日志——M1 到达点断言绿）；唯一新增 admission 面 = per-ns 一次性 `{promise}` 台账（≤ 通道数、与 `channels` Map 同阶锁步、连接生命周期内只增）；handshake（早到帧 ≤16，组合根原样）/backpressure（额度账本）/drain（drain 门）三窗口零变化 | **implements-existing-decision**（义务对「本票新增面」关闭；SA3 收尾措辞 = 「决策 3 pending 有界缓冲条款在本票无新增适用面」，符合设计报告 R4' 措辞门） | ADR 0032:22；AGENTS.md:14；hub-edge.ts:141（台账声明）+ 323-328；`m1-head-baseline-iter2.log`/`package-suite`（M1 到达点断言） | §8-R4''（worker 重入条件登记） |
| 6 | ADR 0032 决策 4（路由键契约）——**路由事实源核对（R9'(ii)）** | 定偏移只读提取 `[21..56]`/`[22..57]`、OPEN 全解码、ERROR 特例、路由点逐字节复现单体两分支、codec 守卫测试（:24-26） | `routingKeyOf`（hub-edge.ts:558-567）：kind 查表定偏移（chunk `[22,57)`/前缀 `[21]`，标准 `[21,56)`/前缀 `[20]`）+ 读数 vs 解码值一致性断言（不等 → `MALFORMED_FRAME` 响亮）；路由三案全部读 **edge 自身 `admissions` 台账**（:529 ERROR 特例 / :541 R-none / :547 R-delivered）——`grep` 核验 hub-edge 全文件 `channels` 仅 :207-208 只读投影 accessor（服务面），**路由与 drain 零读取投影**；R-none 合成（:570-586）= HEAD withChannel 未知 ns 分支逐符号（ns ERROR + `namespace-error{sent}` 事件 + try/catch）；ERROR 无 nsId/未知 ns 静默（:528-529）；守卫测试 5/5 绿（iteration 0 产物未改） | **implements-existing-decision**（R9'(ii) 闭合） | ADR 0032:24-26；hub-edge.ts:526-586, 207-208；`codec-namespace-routing-key-offset.test.ts`（5 用例）；C0d/C4 锚绿 | 无 |
| 7 | ADR 0032 决策 5（观测纪律）（:28-30）+ 协议 §23 | 发射点 = 拥有事实的一侧；字段 append-only；缺面 dormant | 零新事件型/字段（diff 内全部 `dispatchReplicationObserver` 调用均为既有 36 型；连接域事件在 edge、namespace 域事件经 port 由零 diff 通道原生次序产出——无结算段时序面）；隔离语义单点留 edge（port.emitObserver → dispatchReplicationObserver）；L1 两处**无事件直赋逐点保留**（`beginReauth` `this.state='draining'` :280、`onLivenessLost` `this.state='closed'` :656，均不经过 setConnState）；onLivenessLost 不调 clearDrainHandles；`drainDeadline` 死字段未迁移（仅 `reauthDeadlineHandle`）——M3a/M3b 零 `connection-state-changed` 断言绿 | **no-conflict** | ADR 0032:28-30；协议 §23；hub-edge.ts:280, 652-662, 755-768；`acceptance-tests-iter2.log`（M3 绿） | 无 |
| 8 | 协议 §1/§3（不变量与固定 envelope）+ §6.3/§21（GOAWAY drain）——**drain 判定核对（R9'(ii)）** | 单向严格 sequence、HELLO 门、20 字节头纪律；drain 全通道终态才提前完成 | 入站：edge `onMessage` 单点 `decodeInbound`（expectedSeq 先行，hub-edge.ts:373-402）→ handshaking 门 → drain 门（先于路由，被门丢弃帧到不了通道）→ 方向纪律 → OPEN 管线/定偏移路由——全序 = HEAD；出站单点盖章（行 2）。drain 判定两量化 `∀ nsId ∈ admissions.keys(): nsId ∈ settledNames`（hub-edge.ts:704-710），**仅在 settled 信号上执行**（单触发点 :689-692 = HEAD :529 同构），drainActive/closedFlag 守卫在位；不读 channels 投影——M2（pending nsA 阻塞提前 1001）绿 = 包含式收编的行为锚 | **no-conflict** | 协议 §1:22-33、§3:47-63、§6.3:159、§21:683；hub-edge.ts:373-402, 689-710；C2a/C2b/M2 绿（package-suite） | 无 |
| 9 | 协议 §7.1（OPEN 语义）+ §19（Authorization/revoke）——**R7 消除核对（R9'(iv)）** | 授权先于 Registry open；未授权不泄露存在性；revoke → ns 终止 ERROR + cleanup | 授权→registry.open 次序由零 diff 通道承载（shim authorized 才达 registry.open）；M1-revoke 臂**重定基为 HEAD 原生 D-H1**：窗口期 revoke → 到达点 `NAMESPACE_UNAUTHORIZED` + `protocol-violation` + settled 且 `registry.open` 零调用；迟归 ok → `registry.open` **恰一次 transient + lease 恰一次释放（remainingLeases 终值 1）+ 零新帧零新事件**（matrix 测试 :623-660 亲读）；该重定基版测试在 **HEAD（stash 采集）25/25 绿**（`m1-head-baseline-iter2.log`）= 资源断言钉的是 HEAD 真值非拆分形态——iteration 1 的 R7 微差（registry 短路）确实消除；`revokeNamespace` 无条件 `sink.terminateNamespace`（hub-edge.ts:300-302；无通道 no-op resolve，hub-session.ts:278-282） | **no-conflict**（微差消除证实；R9'(iv) 闭合） | 协议 §7.1:163-176、§19:637-652；hub-edge.ts:300-302；hub-session.ts:278-282；matrix :623-660；`m1-head-baseline-iter2.log` + `package-suite-iter2.log` | 无 |
| 10 | 协议 §13/§14（错误与 close 分类注册表）+ §17（背压/次序）——**R4' 登记面核对（R9'(iii)）** | 注册表值 + WS close 码映射冻结；控制保留额度、水位、单帧守卫、统一账本 | 零新错误码/close 码（shim throw 与台账缺失 reject 均映射既有 `INTERNAL_ERROR`；`wsCloseCodeFor` 三分类原样迁移）；D3.3 次序逐路径等价（`sendControlFrame` observeWater → 暂停态配额（byteLength 判据）→ 盖章；`tryEmitDataFrame` 单帧守卫 + 统一账本（byteLength）——backpressure.ts diff 亲读）；**R4' 双不可达角落维持登记、未为消差引入任何行为预检 port 成员**（port 17 成员核对无此类）；既有 6 直构测试 + issue169/231 族全绿（包全量） | **no-conflict**（登记差维持在接受范围内） | 协议 §13:379-454、§14:456-465、§17:564-616；hub-split.ts:54-99（成员集）；backpressure.ts diff；package-suite 569/569 | §8-R4''（登记面存续） |
| 11 | 协议 §15.2/§21（停机/收口）+ ADR 0010/0012/0023 | Hub close 直接 1001、排空 apply、release lease、不 await 于槽内；服务表面冻结 | 五路收口同构（close/onTransportClosed/connectionFatal/onLivenessLost/onSequenceExhausted——hub-edge.ts:255-266, 590-684）；`requestSinkClose` 单点幂等（`??=`，:201-204；C0d 断言 sink.close 恰一次）；`sink.close()` 同步 quiesce 前缀 + 异步尾（hub-session.ts:269-275）；迟归 admission 结算无条件传播（`beginAdmission` `.then` 闭包独立于连接状态 + cleanupAll 注释明示「台账不摘除」:610）——H1 lease 回收路径保全（issue171-red:194 锚绿）；`plugin.ts`/`peer-*.ts` 零 diff | **no-conflict** | 协议 §15.2/§21:670-685；hub-edge.ts:199-204, 599-617；C0d/H1 锚绿 | 无 |
| 12 | CONTEXT.md「复制 Edge」/「SessionHost」/「路由键契约」（:225-235） | Edge：OPEN 准入（全解码 + authorize + sink 路由）；SessionHost：「authorize 不在此调用，消费 edge 传入的预授权投影」；`_Avoid_` 四项（重检 sequence/连接级帧入 session/感知 drain/worker 类型） | `_Avoid_` 逐项零触碰（session 收已校验消息仅记账不重检（hub-session 分派壳）；连接级帧不上缝（C0d FORBIDDEN_SEAM_KINDS 断言绿）；drain 门与判定全在 edge——session 不感知；零 worker_threads/MessagePort 类型）。正向描述的表述差（「传入」→ 实现为**拉取式消费** + 结局前过缝）与 ADR 0032:22 机制句的差距维持在设计报告裁定的 R7'/R8' 义务状态：**本票未触碰 CONTEXT.md/ADR（DENY 零 diff，符合裁决「不在本票强制」）**，deadline 不变（worker 形态票 SA8 前置门禁之前或之中） | **no-conflict**（注 C' 范围内；表述差 → 义务存续） | CONTEXT.md:225-235（本轮重读）；hub-session.ts/hub-edge.ts 实现形态；git diff docs/CONTEXT 为空 | §8-R7''（跨票义务） |
| 13 | Issue #418 硬约束（AC1-AC5：零新公共 API / 零配置 / wire 逐字节 / 通道零改动 / 全量不改而绿） | 任务冻结面 | AC1：C0a/C0b 独立实例化绿（stub sink 拉取形态 + stub port 四形态臂含 reject 响亮臂）；AC2：出站盖章单点 + 入站收口在 edge（C1/C2 绿）；AC3：`git diff --stat -- hub-namespace.ts` 为空（本轮核验）；AC4：既有测试零修改（git 核验 0 文件）+ 包全量 75/75 文件 569/569 用例（对照 iteration 0 的 73/75、567/569——两锚转绿）+ 根 439/439 文件 5299/5299 用例 `Type Errors no errors`；AC5：包 tsc/protocol tsc/根 typecheck 三 EXIT=0。SA3 §8 偏差登记逐项核验：D1（结构断言以行为证明交付）在设计 §12 C0d 明文「源文本扫描或行为证明——二选一」范围内且 SA2 N2' 建议优先行为证明——非设计偏离；D2（hub-connection 仅头注释）= ALLOW 行 4 明文；D3（`Promise.resolve` 包裹）= SA2 N1' 建议项且语义向 HEAD 收敛——无决策面变化 | **implements-existing-decision** | `wiki/raw/task_issue-418.md`；五个 `-iter2` 日志本轮 tail/head 复核；git 核验命令（§2 工作区核验） | 无 |
| 14 | `docs/AGENTS.md`（「Amend or supersede prior decisions explicitly instead of silently contradicting them」）+ 决策文本面 DENY | 不得静默矛盾既有决策；`docs/adr/**`、`docs/protocols/**`、`CONTEXT.md` 本票零变更 | 本 diff 零决策文本变更（git 核验）；注 C' 为**解释性裁决**（同 ADR 内部位阶 + 进程内范围限定），非静默修订——ADR 0032:22 机制句与 CONTEXT.md:230 的表述差按 R7'/R8' 登记、deadline 在机制句重新 load-bearing（worker 形态票）之前——实现未援引机制句字面、未产生新的静默矛盾面；Host 自愿先行 documentation-only 附录**未被采**（可选非阻断，义务存续） | **no-conflict**（义务按期存续） | docs/AGENTS.md；SA8 设计报告 §6/§8-R7'；git diff docs/CONTEXT 为空 | §8-R7'' |
| 15 | `packages/ws-replication/AGENTS.md`（模块规约：生产 API 只经 `src/index.ts`、注入 seam、testing 面纪律）+ `packages/replication-protocol/AGENTS.md` | 模块边界与验证门 | 两工厂 + 缝类型仅模块级导出（C0c 断言 + index/testing 零 diff）；codec 生产码 `replication-protocol/src/**` 零 diff（守卫测试仅进 `test/`）；验证门：SA3 已跑「changed state-machine path 聚焦测试 + 包 typecheck + 根 typecheck/test」（AGENTS Verification 节） | **no-conflict** | AGENTS.md 两份；git 核验；typechecks/root-test 日志 | 无 |

**汇总**：15 行——`implements-existing-decision` 6 行（1/2/3/4/5/6/13 中前 6 项 + AC 行）、`no-conflict` 8 行；**0 evolution-required、0 hard-conflict**。SA8 设计报告 §8-R9' 六项：(i) 行 3/4 闭合、(ii) 行 6/8 闭合、(iii) 行 10 闭合、(iv) 行 9 闭合、(v) 行 4/13 闭合（两锚 + M1 在 569/569 内）、(vi) 行 13 闭合。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
| --- | --- | --- | --- |

**无。** 实现未主张任何 override；Owner 评论集为空（REST `[]` + 简报 §Comments 空，派工单明示）——无 Owner 覆盖通道；无新 ADR、无协议版本升级、无决策自含演进条款被触发。设计报告注 C' 的性质（同 ADR 内部位阶的解释性裁决，范围限定进程内 listen）在本实现上延用，非 override。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
| --- | --- | --- | --- |
| wire 帧字节 | 非 Yjs 载荷帧全帧 hex 金标；envelope 纪律（magic/version/flags/`[8..12]`/payloadLength/reserved） | 协议 §3；SA6 C3a-C3c/C5c/C6a（17 用例未改） | 占位编码 + `writeBe32At` 盖章 ≡ 单次编码；C1/C3/C6 绿；authorize 窗口效应回到到达点（两锚绿）——**符合** |
| 消息码/capability/错误码/close 码注册表 | `0x01`-`0x42`、`CAP_CHUNKED_UPDATE`、§13.1 17 码、§13.2 全量、§14 映射 | 协议 §5/§6.1/§13/§14 | 零新增/零改号（diff 内零新码字面；shim throw/台账缺失 → 既有 `INTERNAL_ERROR`）；R4' 角落两侧既有分类——**符合** |
| observer 事件面 | 36 型 + 键集 + safe-field 清单 + 隔离/时钟纪律 | 协议 §23.1-§23.7 | 零新事件型/字段；L1 两处直赋保留（M3 零新事件断言绿）——**符合** |
| 公共 API/配置面 | `index.ts` 11 运行时导出、`/testing` 5、`DEFAULT_*` 三常量、`types.ts`/`validate.ts` | SA6 C5a/C5b；ws-replication AGENTS | `git diff` 零变更（本轮核验）；C5a/C5b 绿（SA6 契约未改）；两工厂/缝类型仅模块级导出（C0c）——**符合** |
| 服务表面构造 | `nomicoreHubReplication`/`nomicorePeerReplication` getter 化构造 + freeze | ADR 0023 | `plugin.ts` 零 diff——**符合** |
| 通道实现 | `hub-namespace.ts`（`HubNamespaceChannel` + `HubChannelHost` 24 成员注入面） | Issue AC3；ADR 0032 决策 3 | `git diff --stat` 为空（本轮核验）；注入面形状不变（channelHost 组装逐名迁移，authorize 成员签名不变）——**符合** |
| 既有测试面 | 73 个既有测试文件不改而绿（含两锚 ac7-faults:53 / issue171-red:183+:194、SA6 契约 17 用例） | AC4；DENY LIST | `git diff --name-only -- packages/ws-replication/test` = 0（本轮核验）；包全量 569/569 含两锚与契约——**符合**（M1-revoke 资源断言重定基发生在**本票 ALLOW 内自有测试文件**且对 HEAD 基线采集 25/25 绿——非既有面弱化） |
| peer 侧 | `peer-connection.ts`/`peer-namespace.ts`（message 形态队列/调度） | ADR 0032 后果节 | 零 diff；message 形态原签名保留（薄包装）——**符合** |
| 决策/规范文本 | `docs/adr/**`、`docs/protocols/**`、`CONTEXT.md`、`docs/**` | docs/AGENTS.md | 零 diff（本轮核验）——**符合**（R7'/R8' 文本调和义务按期存续，非本票面） |
| 术语 | 「复制 Edge」「SessionHost」「路由键契约」词条义 | CONTEXT.md:225-235 | `_Avoid_` 零触碰（行 12 核验）——**符合**（注 C' 范围内） |

## 6. Evolution requirements

**无 `evolution-required` 项。** 论证延用设计报告 §6 的四点并按实现复核：(1) diff 零 wire/schema/持久化/公共 API/协议文本变更；(2) `openAdmission` 落在新建**内部模块** `hub-split.ts` 的缝类型上（模块级导出，C0c 断言零运行时导出）——非既有公共/规范契约面；(3) 决策 3 机制句字面经注 C' 在本票范围不具规范力（实现未触碰其载体，且以到达点建通道 + 恰一次 authorize + 零资源唤起 + 单份 FSM 保全其全部目的）；(4) 决策 2 三类缝约束（四信号/fire-and-forget/纯 JSON）经行 3 代码级核验未被触碰。实现相对批准设计的全部偏差（SA3 §8 D1-D5）均在该设计或 SA2 观察明文允许的形态内（行为证明二选一 / ALLOW 行 4 头注释 / N1' `Promise.resolve` 建议），不构成需要同变更集修订的契约改变。文本调和义务（R7'/R8'）状态不变：存续、差为拉取 + 结局前过缝、deadline = worker 形态票 SA8 前置门禁之前或之中；Host documentation-only 先行附录仍为可选推荐（本票未采，不阻断）。

## 7. Hard conflicts

**无。** 未发现实际 diff 与 ADR 全集、CONTEXT.md、协议或模块规约不兼容且无合法解决路径的条款。被整体删除的 iteration 1 机制（二相 entry/窗口日志/结算回放/强制结算/revoked/投影存储）在源码零残段（本轮 grep）；其「删除」本身即批准设计 §7 D5 的明文要求（删除线清单），非对任何现行决策的静默矛盾。

## 8. Required actions

| # | 行动 | 责任落点 |
| --- | --- | --- |
| R1'' | 本票冲突面**无遗留行动**：SA8 设计报告 §8-R1/R2/R3（实现证据/冻结门/必做测试）与 R9' 六项经本报告逐项闭合（§3/§5）；实现可按 Controller 流程推进后续质量门（SA4/SA7 动态面、SA6 契约复审、CI 分片、真实传输长跑——均非 SA8 裁决面，SA3 §7 已如实登记） | Controller / SA4 / SA7 / SA6 |
| R4'' | **有界缓冲义务重入条件（登记存续）**：本票新增面 = per-ns 一次性 admission 台账（≤ 通道数，零窗口缓冲）——义务对「本票新增面」关闭；worker 形态票（或任何引入真实跨线程 pending 状态的票）该义务**重新进入**并走正式裁决；收尾措辞门（「无新增适用面」而非「全部兑现」）已由 SA3 满足 | 后续票 + Host 追踪 |
| R5'' | **worker 形态票前置裁决项（存续）**：入站「已解码消息 + 序号」缝形态（注 A）+ `openAdmission` 拉取形态与 OPEN 结局前过缝（注 C' 第 5 点）+ `channels`/`dataFacetOf` 组合成员重塑一并重新过 SA8 前置门禁 | worker 形态票的 SA8 前置门禁 |
| R7'' | **文本调和义务（存续，deadline 不变）**：ADR 0032:22 决策 3 机制句与 CONTEXT.md:230 词条须在 worker 形态票 SA8 前置门禁**之前或之中**正式落 ADR 修订/澄清附录（要素：修订文件/新旧语义/兼容/失败语义/验证锚/不变冻结面）；在此之前任何票不得援引机制句字面迫使回到「缓冲丢弃/edge 复现/结算回放」形态；Host documentation-only 先行附录仍为可选推荐 | worker 形态票 + Host（先行可选） |
| R8'' | **若后续实现轮次触碰以下任一面，重新触发 SA8**：port 成员集增删（含 R4' 消差预检成员）、`HubOpenAdmission` 结局词汇变化、promise reject 面扩大、路由/drain 事实源改读 channels 投影、DENY 面（含 `hub-namespace.ts`）出现 diff、ADR/CONTEXT/协议文本变更 | 后续任一实现轮次 |

## 9. Verdict

**`clear`**。§3 全表 15 项：8 项 no-conflict、7 项 implements-existing-decision；0 evolution-required、0 hard-conflict；无 override 被援引或需要。**核心核对结论**：

1. **async-admission 缝实现与 SA8 裁准形态逐项一致**（设计报告 §3 行 4/5，注 C'）：`HubOpenAdmission` 三态无 revoked；promise 除台账缺失外永不 reject；`beginAdmission`（台账先写 + 唯一真实 authorize + `Promise.resolve` 包裹吸收同步 throw/非 thenable）先于到达点投递；shim 仅拉取、两态映射唯一；denied 在 `registry.open` 之前短路（C0b 零调用臂绿）。
2. **路由与 drain 判定读 edge 自身台账、不读 channels 投影**（代码级 grep 核验——worker 形态可迁移性的结构前提成立）；`channels` 仅为服务面只读投影。
3. **冻结面全部保持**：DENY 面（含 `hub-namespace.ts`、公共 API/配置、peer 侧、机械件、codec 生产码、决策文本、既有 73 测试文件）`git diff` 逐项为空；wire 金标、错误/close 码、observer 面零变化。
4. **R9' 六项闭合**：(i) 缝落地一致、(ii) 台账事实源、(iii) R4' 登记维持且无新增缝面成员、(iv) R7 消除（M1-revoke 对 HEAD stash 基线 25/25 + 实现下逐点一致）、(v) R6' 泵预算（两锚 17 用例 + M1 全绿）、(vi) 全量门禁（56/56、75/75-569/569、三 typecheck EXIT=0、根 439/439-5299/5299 无类型错误）。
5. 实现相对批准设计的偏差（SA3 §8 D1-D5）全部在设计与 SA2 观察明文允许的形态内，无未裁决的新决策面。

SA8 设计报告的「设计可进入实现，以 §8-R1/R2/R3、R4'/R5/R7'、R9' 为条件」至此**条件全部满足**。

## 10. requiresConflictRecheck

**false**。依据（skill 口径「实现后复查已闭合时为 false」）：(1) 本报告即该实现后复查，SA8 设计报告 §10 置 true 的三项理由——新缝面落地产物核对（R9'(i)-(vi)，本报告 §3 行 3/4/6/8/9/10/13 + §5 逐项闭合）、状态机/生命周期/失败语义迁移的落地核对（行 1/7/8/11 闭合）、跨票义务（R4'/R5/R7'）——前两类已闭合，第三类按其性质登记为**后续票**的前置门禁与义务（§8-R4''/R5''/R7''），不构成本变更集「尚待实现核对」的冲突面；(2) 公共 API、wire、schema、持久化面零变化且零待核对项（§5）；(3) 正式 override 无。若后续实现轮次触碰 §8-R8'' 所列任一面（含 SA4/SA7 复审发现新决策面），按 skill 触发条件重新运行 implementation 复查——那是新触发的门禁，不改变本报告对本变更集的闭合结论。
