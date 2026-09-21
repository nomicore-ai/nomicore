# SA8 Conflict Report — issue #420（implementation 复查：SA3 实现 + 登记的设计字面偏差 vs 决策集冲突裁决）

Iteration 0 · dispatch `sa-844a1efb-5dde-468b-8c60-14605e8f1515`（role mabf-sa8，phase conflict-gate）· 基线 HEAD `7039f6dae8e7d29f0c929492f0ca2119bc63afaa`（= PR #426 merge；实施期零 commit，工作树 diff = 被审对象，本轮 `git status`/`git diff` 亲验）。

## 1. Reviewed subject: implementation

被审对象 = SA3 实现报告 `wiki/raw/task_issue-420_sa3_impl.md` + 工作树实际 diff（13 个 ALLOW 路径：新生产模块 `src/hub-session-host.ts`、`src/index.ts` 追加导出、内部 splice 机械重命名三文件、夹具 `test/issue420-shim-hub.ts`、三个新验收测试文件、#418 两处授权编辑、**ADR 0032 澄清附录 +23 行、CONTEXT.md「SessionHost」词条更新**），**含 SA3 登记的设计字面偏差（Deviations §1「载体提交」）**——本报告按派工对该偏差一并裁决。触发条件三合一成立（design 复查明文要求；diff 触碰 ADR 0032/CONTEXT 决策文本；新公共 API 面落地）。上游输入：任务简报、SA6 冻结契约 §12、设计 iteration 1、SA2 评审（iteration 1，verdict **approve**，本轮复核其 §2 结论）、SA8 前置门禁（clear，RA1–RA5）与 design 复查（clear，RA1'–RA6'）。派工明文：Owner feedback requirements = none；REST Issue comments = `[]`。本报告不评价测试充分性（SA4/SA7）、不修改任何被审对象。

## 2. Inputs and decision set

- 决策集（本轮全量识别状态维持）：`docs/adr/0001`~`0032` 全部 accepted、无 superseded；本轮相关 = **ADR 0032**（原文 :4/:14/:18/:20-22/:26/:30/:35/:41-43 + **本轮新增澄清附录 A1/A2/A3**）、ADR 0010、ADR 0012、`CONTEXT.md:225-235`（含本轮更新后的「SessionHost」词条——diff 亲读）、`docs/protocols/instance-replication-v1.md`（§4 :16-26、§7.1 :174-176、§13 :401-426、§14、§17、§19、§23.1 :745/:771，本轮重读）、`packages/ws-replication/AGENTS.md`（Contract/Boundaries：单份 FSM、admission 有界、§21 收口权威、`src/index.ts` 导出纪律）、`docs/AGENTS.md`（显式修订纪律）。
- 跨票义务账：`task_issue-418_implementation_conflict_report.md` §8（R4''/R5''/R7''/R8''）。
- 实现事实（本轮逐一亲验，非采信自述）：
  - **DENY 面零 diff**：`git diff --stat` 对 `hub-namespace.ts`/`hub-edge.ts`/`src/testing.ts`/`package.json`/`packages/replication-protocol`/`docs/protocols`/`apps`/`domains` 全空；7 个矩阵文件零编辑（仅经 `vi.mock` 二次执行）。
  - **公共面**：`hub-session-host.ts` 280 行与 SA6 §12.1 冻结声明逐字段一致（config 7 成员/描述子 6 字段/`HubSessionSignal` 两态/句柄 5 方法/工厂签名；本轮逐成员比对）；`index.ts` 恰 +1 值导出（`createHubSessionHost` 插入 `createHubReplicationPlugin` 与 `createPeerReplication` 之间，字母序保持）+7 类型导出；`FROZEN_PRODUCTION_EXPORTS` 仅插 1 行零删除零重排；grep `worker_threads|MessageChannel|MessagePort` 于 `src/**`+`package.json` = **0 命中**。
  - **偏差事实链（Deviations §1 裁决依据）**：夹具 `issue420-shim-hub.ts:311-327`（`namespaceFrame` 相位 `routing` 的非 OPEN 帧 → `commitToProduction`：相位置吸收态、清空 pending、`denial.openNamespace(firstOpen)` + `denial.namespaceFrame(frame, sequence)`）；`routeAdmission:362`（载体已提交 → 续体放弃，不 `open()` 公共句柄）；`artifacts/sa3-issue420-design-letter-divergence.log`（按设计 §7 D7 字面实现的变体 = `Tests 2 failed | 51 passed`，失败项 = `ac7-faults`「OPEN_OK 之前的 UPDATE → NAMESPACE_STATE_VIOLATION」+ 反空跑 `carrierCommitted` 锚）。
  - **isomorphism 亲验（偏差的关键论据）**：`hub-namespace.ts:839-849`（`onUpdate` 于 'opening' 等非接纳态 → `sendNsError('NAMESPACE_STATE_VIOLATION')` + `finalize('failed','protocol-violation')`——**即 ac7 用例的生产出处**）；`finalize:1676-1693`（**不触碰 openWaiters**——被合流的再 OPEN 于此路径无应答）；`finishOpenSilently:505-508`（`openWaiters = []` 静默丢弃——abort 路径）；`finishOpenError:483-488`（每 waiter 恰一封 ERROR——OPEN 自身失败路径）。⇒ listen 形态下「在途 re-OPEN 合流 + 早到违例帧」的再 OPEN 同样被静默丢弃，夹具提交时丢弃入窗 OPEN 条目与生产 abort 语义**逐点同构**；偏差未引入任何 listen 所无的丢答面。
  - 其余核对：`hub-session.ts`/`hub-connection.ts`/`hub-split.ts` diff 纯机械（本轮 diff 亲读；`hub-split.ts` 仅头注 4 行、成员/类型零变化）；round 测试 A8（wire 严格 +1 无 0 泄漏 + W1 修正读法：出站缝帧占位 0/入站非 OPEN 带 wire 序/OPEN 中继序合成 0）、A4-W2（`NAMESPACE_NOT_FOUND` 负控）、C5a（`CLOSE_OK{ackedSequence:2}`）、C5c（源码无 `expectedSequence`）、A10–A12（含 `suppressSequenceReturn` 红臂）本轮逐条在场；矩阵测试反空跑（`sessionsOpened≥2`/`reopenForwarded≥1`/`pendingFlushed≥1`/`settled≥1`/零 `INTERNAL_ERROR`/`carrierCommitted≥1`）+ 同 run `collectUnhandledRejections` 空；绿证据 `green-contract 63/63`、`package-suite 80 files/651 tests`、`root-test 443 files/5381 tests`、`root-typecheck` exit 0；变异 M1–M7/M7b 日志在场（M4 = 仅反空跑红、52 listen 用例仍绿——非恒真证明；M5 = 9 failed 含 C5a/C5c；M7/M7b = `:212`/`:240` 两用例红）。
- 缺失输入：无（SA4/SA9 尚未运行——非本复查前置；skill 触发条件不要求它们在场）。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（实现 diff） | Classification | Evidence | Required action |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ADR 0032 决策 2（缝只过 `Uint8Array` 帧与纯 JSON；零 worker 依赖/类型） | :18 | 描述子纯 JSON（C4b `structuredClone` 深等 + 掺函数 `DataCloneError` 负控）；`handleFrame` 字节入帧；出站字节 + lane；C4a 结构门 0 命中（本轮 grep 复核）；`package.json` 零新依赖 | **implements-existing-decision** | ADR 0032:18；`hub-session-host.ts:119-148,215-219`；round 测试 C4a–C4d；V8 | 无 |
| 2 | ADR 0032 决策 2（入站 sequence 由 edge 校验；session 不重检） | :18 | `decodeMessage` 调用不含 `expectedSequence`（codec 可选项缺省不检查）；`namespaceFrame(message, header.sequence)` wire 序进记账；C5a 回退序仍消费 + `CLOSE_OK{ackedSequence:2}`；C5c 源扫描锚；M5 变异红（9 failed） | **implements-existing-decision** | ADR 0032:18；`hub-session-host.ts:122-125,145`；round 测试 :429-438；M5 日志 | 无 |
| 3 | ADR 0032 决策 2（出站 sequence=0 占位 + edge mux 盖章；缝无接纳信号）+ 附录 A1 同步 pipe 边界 | :18 + 附录 A1（本轮新增文本） | 占位编码留在内部 sink；listener 返回被分配 wire 序（未注册 ⇒ 0、throw 同步传播）；桥原样回传 `port.send*Frame` 返回值；A8 wire 严格 +1 无 0 泄漏；A12 红臂（`suppressSequenceReturn` → bootstrap ACK 处 `ACK_STATE_VIOLATION` 收口）证明回传承重 | **implements-existing-decision** | ADR 0032:18；附录 A1；`hub-session-host.ts:214-219`；夹具 `deliverOutbound:431-443`；round 测试 A8/A12 | 无 |
| 4 | ADR 0032 决策 2 四信号枚举 + `connection-fatal` 公共化（task/design 门禁裁 **evolution-required**，修订线 E1） | :18 + 附录 A1（**本轮已落**） | `HubSessionSignal` = `{settled,namespaceId}\|{connection-fatal,code}`（逐字 = SA6 §12.1 冻结）；close/terminateUnauthorized = 句柄方法；closed = close() promise；`connection-fatal` 自 HEAD 通道收口路径公共化、code→close code 映射单点留 edge（桥 `onSignal` → `realPort.connectionFatal(code)`）；附录 A1 与实现语义一致（本轮逐句比对） | **implements-existing-decision**（E1 修订义务在本变更集闭合：docs 与代码同变更集、语义一致） | ADR 0032 附录 A1 diff；`hub-session-host.ts:68-71,190,221-235`；夹具 :380-384；A12/A9 断言 | 无（R7'' 闭合登记见行 20） |
| 5 | ADR 0032 决策 3 机制句 + CONTEXT.md:230 措辞（task/design 门禁裁 **evolution-required**，修订线 E2 = R7''/R8'' 本体） | :22,:35 + 附录 A2（**本轮已落**） | 附录 A2 三载体陈述（α 进程内拉取 / β 公共描述子传入 + edge 侧处置 / γ 真 worker 另票）+「未授权 OPEN 不过公共字节缝」+ 重 OPEN 语义（至多一承载机械、路由相位单调、每请求收答、authorize 恒恰一次）；CONTEXT.md 词条同步更新（公共工厂轨 + 内部 splice 拉取式 + _Avoid_ 增「把公共描述子喂入 authorize/transport 面」）；与 D6 裁决及实现形态一致 | **implements-existing-decision**（E2 修订义务在本变更集闭合） | ADR 0032 附录 A2 diff；CONTEXT.md diff；`hub-session-host.ts:177-182`（闭包回放）；夹具 :357-399 | 无（行 20） |
| 6 | ADR 0032 决策 3（authorize 在 edge、OPEN 全解码、投影「仍传入」；OPEN 准入管线有界） | :20-22 | authorize 恰一次于 edge 台账（`beginAdmission` 仅台账首建；桥 `routeAdmission` 拉取一次、denied/committed 承载机械经同一多播 promise——authorize 调用数恒 1，`:212` 用例锚）；桥 pending 窗口每 ns ≤16 帧 + 单帧 ≤ maxFrameBytes + 溢出 `CONNECTION_POLICY_VIOLATION`(1008) 响亮（无静默丢弃）；载体提交路径为同步交接（零缓冲，有界性平凡成立） | **implements-existing-decision**（R4''/S2 兑现：有界 + 顺序保真 + 溢出响亮三要素在场） | ADR 0032:20-22；夹具 :464-476（enqueue 界 + 1008）；`:212` 矩阵锚绿（V3/V4） | 无 |
| 7 | ADR 0032 决策 1（协议状态机单份实现；分布式实例化许可；宿主自写连接级半边 = fork 否决） | :14 | 公共工厂内部复用重命名后的 splice（`createHubSessionSink`，一条组装代码两种 port 形态）；denialSink/载体提交承载 = **生产** sink 直连真 port；夹具零应答合成/零错误码选择/零 FSM 解释；`hub-namespace.ts` 零 diff（本轮 git diff 空） | **implements-existing-decision** | ADR 0032:14；`hub-session-host.ts:106-115`；夹具 :217-226；DENY 面 diff 空 | 无 |
| 8 | ADR 0032 决策 5（dormant 降级 + observer 发射点 = 拥有事实的一侧）+ 附录 A3（**本轮已落**） | :30 + 附录 A3 | adapterPort：`dataGateOpen` 恒 true、`bufferedAmount` 恒 undefined、assembly per-session 单槽（size≥1 拒绝）、namespace 域 observer 经工厂配置注入、`emitObserver` = `dispatchReplicationObserver` 单点复用（不分叉）；附录 A3 把 U8 语义差登记为对外可观察契约 | **implements-existing-decision** | ADR 0032:30 + 附录 A3；`hub-session-host.ts:185-208`；`observer.ts:36` | 无 |
| 9 | ADR 0032 决策 4（路由键契约）+ 状态行（listen 逐字节不变） | :26,:4 | edge demux/路由/#419 守卫零触碰；listen 组合根仅机械重命名（3 行 diff 本轮亲读）；listen 臂 52 用例断言逐字重跑绿（包全量 651 内） | **no-conflict** | ADR 0032:4,:26；`hub-connection.ts` diff；V4 | 无 |
| 10 | ADR 0032 后果节（公开面 append-only 冻结；工厂轨兑现） | :41-43 | 恰 +1 值 +7 类型；`FROZEN_PRODUCTION_EXPORTS` 插入位字母序正确、既有 11 名零变化零重排；`src/testing.ts` 零 diff；test-d 正控全集 + 6 项负控（超出 SA6 §12.1 要求的 4 项下限，无弱化） | **implements-existing-decision** | ADR 0032:41-43；`index.ts` diff；契约测试 :151-153；V3/V5 | 无 |
| 11 | **设计字面偏差（Deviations §1）：载体提交替换「routing 相位非 OPEN 帧入 pending 窗口」** | 决策集对照：ADR 0032 决策 1（:14）/决策 2（:18）/决策 3（:22）+ 协议 §7.1:176 + 附录 A2 β | 夹具内装配路由变化：routing 相位非 OPEN ns 域帧 → 立即提交 `denialSink`（生产 splice + 真 port），相位吸收、入窗 OPEN 条目随提交放弃；设计字面变体实测红（ac7 用例 + 反空跑 2 failed，日志在场）。裁决：(a) 承载机械 = 生产代码（决策 1「分布式实例化」），夹具决策面 = 「帧到达形态 → 选既有承载机械」，与 D6 结局路由同类装配决策，非协议决策；(b) 违例 ERROR/终态/后续帧吸收/重 OPEN 应答全部由零 diff 通道自身状态机产出（`onUpdate:839-849` 即 ac7 断言的生产出处）；(c) 入窗 OPEN 的放弃与 listen 生产 abort 语义逐点同构（`finalize` 不应答 waiters + `finishOpenSilently` 丢弃——本轮源码亲验，见 §2），不引入 listen 所无的丢答面；(d) authorize 恒恰一次、承载机械至多一、相位单调、有界性保持；(e) 不触公共冻结签名/DENY 面/port 成员集/验收语义；(f) 设计 §7 D7 的「实践不可达」前提被冻结矩阵 `ac7-faults`（须逐字重跑且绿的硬门）证伪——**按决策集唯一相容读法，字面机制与 AC3 硬门不相容，偏差是修复而非新决策面** | **implements-existing-decision**（AC3「矩阵断言逐字不变 + 绿」+ 决策 1 单份 FSM 的兑现路径；设计 wiki 文本滞后一行，见 §8/RA1''） | ADR 0032:14,:22；协议 §7.1:176；`hub-namespace.ts:839-849,1676-1693,505-508,483-488`；夹具 :311-327,362 + 头注 :27-36；`sa3-issue420-design-letter-divergence.log`；V3/V4（含 ac7 shim 臂绿） | §8/RA1''（设计文本补正登记） |
| 12 | 协议 §7.1:174-176（重复 OPEN 合流、每请求收答、终态后 REOPEN 错误） | :174-176 | 三分支路由落地：① authorized 转发（`reopenForwarded`）/② routing 入窗按序冲刷（`pendingFlushed`）/③ denied → 生产 `onOpen` 重开矩阵；`:212`（OPEN_OK×2 + authorize 恰一次）与 `:240`（`NAMESPACE_REOPEN_REQUIRES_RECONNECT`）shim 臂断言逐字不变绿；M7（重入 `open()` → 重复前置 throw）/M7b（丢弃在途 OPEN）变异红证明敏感性；「每请求收答」的边界 = 生产机械自身语义（abort 角落两侧同丢，行 11(c)）——公共形态未收窄该边界 | **implements-existing-decision** | 协议 :174-176；夹具 :248-283,445-462；M7/M7b 日志；V3/V4 | 无 |
| 13 | 协议 §4（连接序号自 1 严格 +1；每方向独立）+ W1/RA4' 修正读法 | :16-26 | A8 断言两方向 `seqs == 1..N`；出站缝帧恒占位 0（`placeholderSequence===0` + 解码复核）；入站非 OPEN 帧 wire 序 >0 且逐帧回指 wire 原帧；OPEN 中继序 = 合成 0（登记例外，协议无消费者） | **no-conflict**（修正读法按裁决落地） | 协议 §4；round 测试 A8 段；夹具 `forwardOpen/forwardFrame` | 无 |
| 14 | 协议 §7.1:174（先 authorize → Registry open；零存在性泄露）+ W2/RA4' 修正读法 | :174 | A4：OPEN_OK 恰一 + `run.authorizer.calls.length===1`；A4-W2 负控：localOwner 换 `PEER_OWNER` → 无 OPEN_OK + ns 域 ERROR `NAMESPACE_NOT_FOUND` + 注册表零打开（与零 diff 通道/Registry 单点一致） | **no-conflict** | 协议 :174；round 测试 :254-288；`hub-namespace.ts:355-375`（零 diff） | 无 |
| 15 | 协议 §13/§14（错误/close 分类注册表 append-only） | :401-426 | 全部用既有码：`MALFORMED_FRAME`（解码失败兜底）/`CONNECTION_POLICY_VIOLATION`→1008（pending 溢出 + 早到帧界）/`ACK_STATE_VIOLATION`→1002（A12）/`INTERNAL_ERROR`→1011（E10 兜底 + 防御分支）/`NAMESPACE_REOPEN_REQUIRES_RECONNECT`/deny 族 ns ERROR failed；零新码零改号 | **no-conflict** | 协议 §13/§14；夹具 :290,396,472；round 测试 A12 | 无 |
| 16 | 协议 §17（背压：水位依赖 `bufferedAmount`）+ §19（revoke → ns 终止 ERROR） | §17/§19 | water gate dormant + `bufferedAmount` undefined（决策 5 授权，附录 A3 登记）；backpressure/shed 族不在 shim 重跑面；A10：`handle.terminateUnauthorized()` → 双方终态 + `NAMESPACE_UNAUTHORIZED` + 零 connection-fatal；R11（在途 revoke 时序观测边界）随夹具头注登记 | **no-conflict** | 协议 §17/§19；附录 A3；round 测试 A10；夹具头注 :42-44 | 无 |
| 17 | 协议 §23.1（事件词汇 36 型 append-only；`send-frame-rejected` 规范锚） | :745,:771 | 零新事件型；observer 隔离单点复用（`dispatchReplicationObserver`）；`onSignal` 分发同款 try/catch 隔离（监听者 throw 不改变协议状态）；`onFrame` 返回序语义有 :771 锚 | **no-conflict** | 协议 §23.1；`hub-session-host.ts:202,227-235` | 无 |
| 18 | ADR 0010（复制架构权威）+ ADR 0012（实例身份） | 状态行/决策句 | 零 wire/生命周期变化；ACK = sequenced live apply（A7 口径）；`remoteInstanceId` = verifyToken 结算身份（构造 edge 前闭包捕获，夹具 :709）；§21 收口权威（A11 drain 断言 + close 幂等单 promise） | **no-conflict** | ADR 0010/0012；round 测试 A7/A9/A11 | 无 |
| 19 | `packages/ws-replication/AGENTS.md`（生产 API 只经 `src/index.ts`；夹具只落 `test/`；admission 有界；注入 seam） | Contract/Boundaries | 公共工厂经 `src/index.ts`；夹具/桥只落 `test/`（深路径 import，mock 安全）；timer/scheduler 注入；`/testing` 零改 | **no-conflict** | AGENTS.md；`index.ts` diff；夹具 import 段 :50-91 | 无 |
| 20 | `docs/AGENTS.md`（显式修订，不静默矛盾）+ #418 SA8 R7''/R8''（文本调和 deadline + 重触发面） | docs/AGENTS.md Editing 节；#418 SA8 §8 | ADR 0032 附录 + CONTEXT.md 词条与实现**同变更集**落地（E1/E2 闭合）；附录文本与 D4/D5/D6/实现形态一致（本轮逐句比对）；R8'' 重触发面逐项：port 17 成员零增删（`hub-split.ts` 仅头注）、`HubOpenAdmission` 三态不动、DENY 面零 diff、决策文本变更仅经附录；`hub-split.ts` 头注「绝不进 index.ts」旧陈述同步更新（旧引用已更新） | **implements-existing-decision** | `docs/AGENTS.md`；ADR 0032/CONTEXT diff；`hub-split.ts` 头注 diff；#418 SA8 §8-R7''/R8'' | 无（R5''/R8'' 对 **γ worker 形态后续票**存续，见 §8/RA3''） |
| 21 | 内部重命名 + §12.6 两处授权编辑（SA8 行 27/30：非决策面、纯机械） | 决策文本零引用 | `hub-session.ts`（重命名 + 别名删除 + 头注）、`hub-connection.ts`（3 行跟随）、`hub-split.ts`（仅头注）、结构测试 7 处机械跟随、契约测试插 1 行——本轮 diff 逐一亲读确认纯机械；`docs/**`/`CONTEXT.md` 对旧公共名零残留引用（头注已改指新名） | **no-conflict** | 本轮各文件 diff；grep 复核 | 无 |
| 22 | **Deviations §3（反空跑锚替换：`ACK_STATE_VIOLATION` ac5-live 指针 → `settled` + 零 `INTERNAL_ERROR` + 计数阈值）** | 决策集对照：协议 §23.1（事件词汇）/SA6 §12.3 举例措辞 | SA6 §12.1/§12.3 所指「ac5-live `ACK_STATE_VIOLATION` 必经 onSignal 到 wire」与代码事实不符：该用例 `injectHub(UPDATE_ACK{ackedSequence:99999})` 触发的是 **peer 侧** fatal（`run.peerFrames('ERROR')` 含该码——peer FSM 发出，hub 会话缝不在路径上，本轮开卷亲验 `ac5-live.test.ts:132-145`）；`connection-fatal` 通路的正控由 round 测试 A12 红臂承载（hub 侧强制 0 回传 → `ACK_STATE_VIOLATION` 经 `onSignal` 到 wire + close(1002)——公共信号面的正控在场且更强）；M4 变异（关 shim）仅反空跑红证明判据非恒真；断言族未弱化（阈值 + 零 INTERNAL_ERROR + `carrierCommitted≥1`） | **no-conflict**（与 W1/W2 同类：决策集/代码事实唯一确定读法下的验收锚更正；冻结面与失败语义零变化） | `ac5-live.test.ts:132-145`（零 diff）；round 测试 A12 :361-381；矩阵测试 :47-90；M4 日志 | 无 |
| 23 | **Deviations §2（SA6 三个诊断探针 `.mts` 因授权重命名陈旧）** | 非决策面（诊断资产） | `artifacts/sa6-issue420-*.mts` 仍 import 旧名；重命名由 SA6 §12.6/U1 明文授权；探针不在任何 tsconfig/vitest/脚本 include 面（SA3 grep + 本轮抽查）；`artifacts/**` 不在 ALLOW LIST ⇒ SA3 依边界未改——登记给 SA6/Controller | **no-conflict** | SA6 §12.6/U1；SA3 Deviations §2；tsconfig/vitest include 面 | §8/RA4''（登记） |

裁决分布：**no-conflict ×11、implements-existing-decision ×12（含 E1/E2 两条 evolution-required 修订线在本变更集闭合）、evolution-required ×0（未新增）、hard-conflict ×0**。

## 4. Overrides

**无。**

| Old decision | Override authority | Scope | New obligation |
| --- | --- | --- | --- |

- 无 Owner 评论（派工明文 none；REST comments `[]`）⇒ 无 Owner 覆盖通道被援引。
- 无新 ADR（附录为澄清性登记，决策文本明文「不修改决策 1~5 的机制要求」——本轮逐句比对与实现一致，附录描述未超出实现事实）、无协议版本升级、无决策自含演进条款被触发。
- 载体提交偏差与反空跑锚更正均不以 override 消解：前者 = 决策集唯一相容读法下的夹具装配路由（行 11），后者 = 事实确定的读法更正（行 22）。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（本轮 diff 亲验） |
| --- | --- | --- | --- |
| wire 格式/帧头/消息码/capability | envelope 布局（sequence @ `[8..12]`、自 1 严格 +1）、消息码集、`CAP_CHUNKED_UPDATE` | 协议 §4-§6 | 零变化（A8 断言既有不变量；diff 不触 codec）——符合 |
| 错误码/close 码注册表 | §13.1 + §14 映射 | 协议 §13/§14 | 零新增/零改号（全部失败面用在册码，行 15）——符合 |
| 事件词汇（36 型 + 字段集） | append-only | 协议 §23.1；ADR 0032:30 | 零新事件型；observer 单点复用——符合 |
| 路由键布局 + codec 字段序 | 同步维护契约 + #419 守卫 | ADR 0032:26 | 零触碰——符合 |
| `hub-namespace.ts` / `hub-edge.ts` | 逐字节零 diff（R8'' DENY 面） | #418 SA8 §8-R8''；设计 §11 | `git diff --stat` 空——符合 |
| `src/testing.ts`、`package.json`、7 矩阵文件、上游包/apps/domains | 零改动 | 设计 §11 DENY | diff 空——符合 |
| 公共导出面 | #418 冻结表 append-only | 契约测试 :144-156 | 恰插 `'createHubSessionHost'` 1 行，字母序、零删除零重排——符合 |
| SA6 §12.1 冻结公共声明 | 逐字（test-d 锁定） | SA6 契约 §12.1 | 与 `hub-session-host.ts` 逐字段一致（本轮比对）；test-d 6 负控全触发——符合 |
| port 17 成员集 / `HubOpenAdmission` 三态 / sink 面 6 成员 | R8'' 重触发面 | `hub-split.ts:48-127` | `hub-split.ts` 仅头注（成员/类型零变化）；adapterPort 经接口类型检查对齐——符合 |
| listen 模式行为 | 逐字节不变 | ADR 0032:4 | 组合根仅机械重命名；listen 臂 52 用例绿——符合 |
| 决策/规范文本 | `docs/adr/**`、`docs/protocols/**`、`CONTEXT.md` | `docs/AGENTS.md` | 仅附录 + 词条更新（RA1 授权面内，非静默；协议文本零 diff）——符合 |

## 6. Evolution requirements

**无新增。** 前置门禁与 design 复查裁定的两条修订线已在本次被审变更集内闭合，逐要素核对：

- **E1（信号词汇 + 决策 5 降级登记）**：修订文件（ADR 0032 附录 A1/A3 + CONTEXT.md 词条）✓ 落地；新旧语义（四信号载体映射 + `connection-fatal` 公共化 + dormant/U8 词汇）✓ 与 `hub-session-host.ts`/夹具实现一致；兼容（wire 逐字节、listen 零变化、port 17 成员、公共面 append-only）✓；失败语义（code→close 映射单点留 edge；0 值回传既有路径）✓；版本（无协议版本变化）✓；验证锚（A12/AC3/C5b 绿）✓；冻结面（§5）✓。
- **E2（决策 3 机制句三载体调和）**：附录 A2 三载体（α/β/γ）+「未授权 OPEN 不过公共字节缝」+ 重 OPEN 语义 ✓；与 D6 裁决（edge 侧处置 = 宿主桥按结局路由到生产 sink）及实现一致 ✓；γ 载体的 R4''/R5'' 重入条款在附录明文保留 ✓。

**实现后复查结论**：文档与代码同变更集、语义一致、override 未扩大（无 override）、旧引用已更新（`hub-split.ts` 头注、`hub-connection.ts` 头注/调用点、结构测试期望）。两条修订线的义务账清偿。

## 7. Hard conflicts

**无。** 特别核对并排除：(a) 载体提交偏差 ≠ 夹具协议决策/第二 FSM（行 11——承载机械为生产 splice，违例应答由零 diff 通道状态机产出；入窗 OPEN 的放弃与生产 abort 语义逐点同构，`finalize`/`finishOpenSilently` 源码亲验）；(b) 偏差 ≠ 破坏有界性/顺序保真（提交为同步交接，pending 界与溢出 1008 收口仍在场）；(c) authorized ns 在故障角落由内部 splice 承载（不走公共句柄）≠ 违反任何决策（公共工厂是宿主可选项；listen 形态本身即内部 splice 承载；AC2 回合仍由公共面驱动完整协议回合）；(d) 反空跑锚替换 ≠ 契约软化（SA6 指针与代码事实不符——ac5-live 该用例为 peer 侧 fatal；`connection-fatal` 正控由 A12 红臂以更强形式承载；M4 证非恒真）；(e) 附录 ≠ 决策机制变更（自文「不修改决策 1~5 的机制要求」，登记内容与实现事实一致）。设计 §7 D7 字面机制被冻结矩阵证伪（2 failed 日志在场）——若按字面实现反而与 AC3 硬门（矩阵断言逐字不变且绿）不相容，偏差方向 = 向决策集靠拢。

## 8. Required actions

| # | 行动 | 责任面 | 门禁 |
| --- | --- | --- | --- |
| RA1'' | **设计文本补正登记（非阻断，wiki 内务）**：把设计 §7 D7 `namespaceFrame` 行的 routing 分支措辞补正为实落形态（「非 OPEN 帧在 routing 相位即时提交生产承载；在途 OPEN 入有界 pending 窗口」——SA3 Deviations §1 建议文案），并随附本报告行 11 的同构性依据；SA3 无权改设计文件 ⇒ 由 Controller/SA1 在任务记录中落（夹具头注 + SA3 报告 + 本报告已三重登记，落地前不得援引 D7 旧字面指责实现） | Controller/SA1（wiki 记录） | 非门禁（决策集已相容） |
| RA2'' | 跨票存续登记：γ 真 worker 形态（异步序回传、跨线程 pending）票须重新过 SA8 前置门禁（R4''/R5''/附录 A2 γ 句明文）；`nomicoreHubSessionHost` 服务轨、peer 侧拆分、nomic-server 宿主接线 = 后续票；R6（多 bit capability → R8'' 重触发 + 公共面 append-only）、R7/R11/R12（shim 观测边界）维持登记 | 后续票 | 跨票账（非本票阻断） |
| RA3'' | 公共面一经 test-d 锁定即 append-only（S6）：后续票不得改 `createHubSessionHost` 签名/信号词汇，只能追加 | 后续票 | 跨票账 |
| RA4'' | SA6 诊断探针陈旧名登记转交：重跑 `artifacts/sa6-issue420-*.mts` 前把 import/调用名换 `createHubSessionSink`（SA3 边界外） | SA6/Controller | 登记（非门禁：探针不在任何 include 面） |

## 9. Verdict

**`clear`**。

- 23 项对照：11 no-conflict、12 implements-existing-decision、0 新增 evolution-required、0 hard-conflict、0 override。
- **两条历史 evolution-required 修订线（E1/E2）在本变更集闭合**：ADR 0032 澄清附录（A1/A2/A3）与 CONTEXT.md 词条与实现同变更集落地，附录文本与实现事实逐句一致，旧引用已更新（RA1' 清偿；#418 R7''/R8'' 文本调和义务清偿）。
- **设计字面偏差（载体提交）裁决为与决策集相容**：承载机械为生产代码（决策 1 分布式实例化）、违例应答由零 diff 通道状态机产出（ac7 断言的生产出处）、入窗 OPEN 放弃与生产 abort 语义逐点同构（源码亲验）、authorize 恒恰一次、有界性保持、不触任何冻结面；设计字面机制被冻结矩阵 `ac7-faults` 证伪（实测 2 failed），偏差是决策集唯一相容读法的落地，非新决策面。设计 wiki 文本滞后一行 → RA1'' 登记（非阻断）。
- 反空跑锚替换（Deviations §3）为事实确定的读法更正（ac5-live 该用例为 peer 侧 fatal，本轮开卷亲验），`connection-fatal` 公共信号面正控由 A12 红臂更强承载，判据非恒真有 M4 证明——不构成契约软化。
- R5'' 门禁的 implementation 段（本报告）完成：入站缝公共字节面 + 描述子式 ok-投影传入 + 组合成员零重塑（桥代理实现既有 sink 6 成员面）三项落地核对完毕。
- 实现可进入 SA4/SA7 验证与交付流程；本报告不评价测试充分性与验收完成度（SA4/SA7 职责）。

## 10. requiresConflictRecheck

**false**。依据：skill 判据「实现后复查已闭合」成立——(1) 新公共 API 面（工厂 + 句柄 + 信号）已实现核对且与 SA6 §12.1 冻结声明逐字一致（test-d 绿 + 6 负控触发）；(2) 生命周期/失败语义面（close/terminateUnauthorized/connection-fatal/序回传 0 值/溢出 1008/E10 兜底/载体提交）已逐项与决策集和源码事实核对；(3) E1/E2 的 ADR/CONTEXT 修订已落本变更集并核对一致（RA1'/RA1 清偿）；(4) R5''/R8'' 重触发面（port 成员、DENY 面、决策文本）经实际 diff 逐项核对为零触碰/仅授权附录。残余事项（RA1''–RA4''）均为跨票登记或 wiki 内务，不在本变更集内留待实现核对的决策面。后续票（γ worker 形态、服务轨等）按 RA2''/RA3'' 自带重触发条件另行过 SA8。
