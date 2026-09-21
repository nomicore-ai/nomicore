# SA8 Conflict Report — issue #420（design 复查：SA1 修订设计 vs 决策集冲突裁决）

Iteration 1 · dispatch `sa-c974fd46-78f0-4300-97e6-96271fca193f`（role mabf-sa8，phase conflict-gate）· HEAD `7039f6dae8e7d29f0c929492f0ca2119bc63afaa`（本轮 `git log` 核对）。

> 原位更新说明：本报告取代 iteration 0 版本（dispatch `sa-02f8eeb3…`，481 行设计文本的裁决），只反映**当前被审对象** = SA1 修订设计 `wiki/raw/task_issue-420_design.md`（iteration 1，525 行，SA2-F1 修订轮）。历史 iteration 结论不堆叠为本轮结论；受修订触面的对照项按新文本重新裁决，未触面经本轮抽查复核后维持。

## 1. Reviewed subject: design

被审对象 = SA1 修订设计 `wiki/raw/task_issue-420_design.md`（iteration 1：§7 D1–D10 决策——其中 **D7 宿主桥按 SA2-F1 重写为「每 (connectionKey, ns) 路由相位 + `openNamespace` 三分支路由 + 路由续体 E10 容错 + 桥 closed 在途守卫 + `terminateNamespace` 相位挂起」**；§2 新增 B16 事实锚；§8.2 新增 R3b 数据流；§9 新增 E10；§12 新增 SA2-F1 验收行与 M7 变异；§13 新增 R11/R12）。上游输入：任务简报 `wiki/raw/task_issue-420.md`、已批准 SA6 验收契约 `wiki/raw/task_issue-420_sa6_contract.md`（§12.1 冻结声明本轮逐字符复核 = 设计 D1 逐字一致——**修订未触碰公共冻结签名**）、SA8 前置门禁 `wiki/raw/task_issue-420_conflict_report.md`（verdict clear，RA1–RA5）+ `wiki/raw/task_issue-420_relevant_decisions.md`、**SA2 设计攻击评审 `wiki/raw/task_issue-420_sa2_review.md`（本轮存在：iteration 0 评审，verdict reject，1 × MAJOR = SA2-F1——本修订的对象；其 §13 Required revisions 三项 required change 与 §14「F1 不触决策面」结论本轮亲读）**。派工明文：Owner feedback requirements = none；REST Issue comments = `[]`。本报告只裁决修订设计与既有决策集的一致性；不评价设计优劣（SA2）、不实现、不运行测试、不调度其他 SA。

## 2. Inputs and decision set

- 决策集（本轮全量识别状态）：`docs/adr/0001`~`0032` 全部 accepted、无 superseded（前置门禁口径维持，本轮复核 ADR 0032 全文 44 行亲读）；本次相关 = **ADR 0032**（:4 状态行 / :14 决策 1 / :18 决策 2 / :20-22 决策 3 / :26 决策 4 / :30 决策 5 / :35 否决备选 / :41-43 后果节）、ADR 0010、ADR 0012、`CONTEXT.md:225-235`（复制 Edge / SessionHost / 路由键契约三词条本轮重读）、`docs/protocols/instance-replication-v1.md`（§4 :16/:23、**§7.1 :174/:176（同连接重复 OPEN 合流、每请求收答、终态后 `NAMESPACE_REOPEN_REQUIRES_RECONNECT`——SA2-F1 裁决的直接规范锚）**、§13 :401/:412/:413/:415/:424-426、§14、§17、§19 :637-652、§23.1 :745/:771）、`packages/ws-replication/AGENTS.md`（Contract/Boundaries：单份 FSM、admission 有界、§21 收口权威、`src/index.ts` 导出纪律）、`docs/AGENTS.md`（显式修订纪律）。
- 跨票义务账：`wiki/raw/task_issue-418_implementation_conflict_report.md` §8（R4'' :98 / R5'' :99 / R7'' :100 / R8'' :101 原文本轮重读核对）。
- 代码事实（本轮针对修订新增面亲验，未验证项沿用前置门禁/iteration 0 已验锚点并抽查）：
  - **B16 全链（SA2-F1 的事实核心）**：`hub-edge.ts:316-328`（`onOpenNamespace`：台账缺失才 `beginAdmission`；**已投递（台账命中）的再 OPEN 仍无条件 `sink.openNamespace`**，头注 :321 明文「再 OPEN 只投递 → 通道 `onOpen` 重开矩阵（零 authorize）」）；`hub-edge.ts:330-369`（`beginAdmission` 唯一真 authorize、台账先写、`openAdmission` 返回同一 promise 多播安全、台账缺失响亮 reject）；`hub-session.ts:84-94`（sink `openNamespace`：通道在场 → `channel.onOpen`；缺席 → 到达点建通道 + `startOpen` 同步前缀）；`hub-namespace.ts:289-332`（重开矩阵：终态（closed/conflicted/failed）→ `NAMESPACE_REOPEN_REQUIRES_RECONNECT`；'closing' → openWaiters 收口后再答；'opening' → openWaiters 合流；已建立（bootstrapping/reconciling/live/needs-resync）→ 立即再答 OPEN_OK）；`hub-namespace.ts:474-481`（`flushOpenWaitersOk`：**每个 waiter 恰一封 OPEN_OK**——再 OPEN 合流应答的产生机械）；grep `channels.delete` 全仓零命中（通道表永不删除）。
  - 矩阵锚：`test/ws-replication-ac1-ac2-open.test.ts:229`（authorize 恰一次前置断言）、`:231`（authorize 门闩在途注入第二 OPEN → `OPEN_OK`×2 + 合流）、`:245`（conflicted 后同连接再 OPEN → `NAMESPACE_REOPEN_REQUIRES_RECONNECT`）、`injectPeerFrame` :45-47；7 个矩阵文件 grep 零 `terminateUnauthorized`/`revoke`/`requestReauth`（R11 声明成立）、零 `createHub`/`run.hub.`（B10 成立）。
  - 失败语义注册表：协议 :412 `CONNECTION_POLICY_VIOLATION`→1008、:415 `INTERNAL_ERROR`→1011、:424 `NAMESPACE_REOPEN_REQUIRES_RECONNECT` = ns ERROR/reconnect/closed；`hub-edge.ts:99-105` `wsCloseCodeFor` 三分类（1009/1008/默认 1002）。
  - 拒绝/收口路径：`hub-namespace.ts:344-376`（authorize throw → `INTERNAL_ERROR`；`!authz.ok ∨ !read` → `NAMESPACE_UNAUTHORIZED` 短路；`registry.open` 拒绝 → `opened.code==='NAMESPACE_NOT_FOUND' ? 'NAMESPACE_NOT_FOUND' : 'INTERNAL_ERROR'` :375）；`hub-namespace.ts:1186-1191`（`terminateUnauthorized`：quiet/终态 no-op；非 quiet → 立即 ns ERROR + `finalize('failed',…)`——R11 锚）；`hub-namespace.ts:662,1099`（通道→host `connectionFatal` 全仓仅两点、恒 `('ACK_STATE_VIOLATION', 1002)`）；`hub-edge.ts:689-710`（`onChannelSettled` → `settledNames` + `maybeFinishDrainEarly` 遍历 `admissions.keys()`——denied ns 必须发射 settled 否则 drain 阻塞到 deadline）。
  - 缝形态：`hub-split.ts` 全文重读（port **17 成员逐一清点** = 设计 D5 表 17 行全覆盖零增删；sink 面 6 成员；`HubOpenAdmission` 三态 :48-51；头注 :4-5「绝不进 src/index.ts」陈述——D9 头注更新的对象）；`envelope.ts:127-128` + `limits.ts:24`（`expectedSequence` codec 可选、缺省不检查）。
  - 组合根/机械：`hub-connection.ts:54`（`MAX_EARLY_FRAMES = 16`，第 17 帧 → policy 拒绝 1008——D7 pending 界的镜像先例）、`:294-334`（accept 门链：单微任务让位/门 5 次序/rejectUpgrade 事件面——R12/N1 登记锚）；`hub-session.ts:203-293`（占位编码 `encodePlaceholder`、`sendData` 前置仅判 `connectionState()==='closed'`、close 幂等单 promise `closeTail`、`terminateNamespace` 无通道 resolve）；`hub-edge.ts:733-735`（capability 位判据）；`index.ts` 11 运行时导出 + 契约测试 `FROZEN_PRODUCTION_EXPORTS` :144-156/:551 + 结构测试 C0c :614-619（本轮重读）；`vitest.config.ts:7-24`（别名/include/typecheck）；`driver.ts:8/:196`（`opts.createHub ?? createHubReplication`）；`package.json` + `src/*.ts` grep 零 worker_threads/MessageChannel/MessagePort。

## 3. Decision analysis

> 30 项核心对照沿用 iteration 0 框架、按 iteration 1 文本重新裁决（受触面更新描述）；**31–35 为本轮新增**，针对 SA2-F1 修订引入/扩大的面。修订未触碰的面（公共冻结签名 D1、DENY 面、port 17 成员集、U3 裁决方向、RA1 附录要素）经本轮逐点复核确认原样。

| # | Decision | Clause | Subject behavior（修订设计） | Classification | Evidence | Required action |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ADR 0032 决策 1（单份 FSM、两半皆 nomicore、宿主自写连接级半边 = fork 否决） | :14 | shim 装配 = 真 `createHubReplicationEdge` + 公共工厂**内部复用**重命名后的 splice（D1）；D6 denialSink = **生产** `createHubSessionSink` 实例（分布式实例化）；夹具零协议决策（D6 论证 2——修订后仍成立：三分支路由只决定「OPEN 帧字节进哪份既有机械」，不解释通道状态、不合成应答，§8.1 明文重申重开矩阵唯一在通道内） | **implements-existing-decision** | ADR 0032:14；设计 §7 D1/D6/D7、§8.1；`hub-split.ts:2` | impl 复查核对 `hub-namespace.ts` 零 diff + 夹具无 FSM |
| 2 | ADR 0032 决策 2（缝只过 `Uint8Array` 帧与纯 JSON；零 worker 依赖/类型） | :18 | D1 描述子纯 JSON；D2/D7 字节入帧 + `encodeMessage` 中继；AC4 四判据；DENY LIST `package.json` 零新依赖（本轮 grep 基线 0 命中复核）。修订新增的 pending 窗口条目 = 已解码消息的**字节重编码形态**（冲刷时 `handleFrame(encodeMessage(…))`），不引入新跨缝载体 | **implements-existing-decision** | ADR 0032:18；设计 §7 D1/D2/D7、§11、§12 AC4 | impl 复查核对 C4a 0 命中保持 |
| 3 | ADR 0032 决策 2（缝上只有 namespace 域帧） | :18 | A3 断言 kind ⊆ namespace 域；D2 连接级/方向域/未知静默（与 `hub-session.ts` 分派壳 default 分支同构） | **implements-existing-decision** | ADR 0032:18；CONTEXT.md:226；设计 §7 D2；`hub-session.ts:115-172` | 无 |
| 4 | ADR 0032 决策 2（入站 sequence 由 edge 校验 header-only；session 不重检） | :18 | D2 `decodeMessage` 不传 `expectedSequence`（`envelope.ts:127-128` 可选缺省不检查，本轮重验）；`namespaceFrame(message, header.sequence)` wire 序进记账；C5a–C5d + M5 | **implements-existing-decision** | ADR 0032:18；CONTEXT.md:230-231；设计 §7 D2、§12 AC5 | impl 复查核对 C5c 结构门 |
| 5 | ADR 0032 决策 2（出站 sequence=0 占位 + edge mux 盖章；缝无接纳信号）+ 否决备选「缝携带接纳信号」 | :18,:36 | D3 `onFrame(listener:(frame,lane)=>number)`：占位编码留在内部 sink（`encodePlaceholder` 本轮重验）；listener 返回被分配 wire 序（无 sink ⇒ 0、throw 同步传播）；桥原样回传 `port.send*Frame` 返回值。修订未触 D3 | **implements-existing-decision**（返回序 = 内部 port「0 = 未发送/被拒」的公共面同构搬运；规范锚 §23.1:771） | ADR 0032:18,:36；协议 §23.1:771；`hub-split.ts:66-71`；`hub-session.ts:257-263`；设计 §7 D3 | U2 边界维持（同步宿主 pipe） |
| 6 | ADR 0032 决策 2（**四信号**枚举）vs 设计新增公共 JSON 信号 `connection-fatal` | :18 | D4 把 `connection-fatal` 正式化为 `onSignal` 事件；行为自 HEAD 在场（`hub-namespace.ts:662,1099` 本轮重验仅两点且恒 `('ACK_STATE_VIOLATION',1002)`）；等价性论据成立（adapterPort 丢 `wsCloseCode` 只发 `code`、桥调 `realPort.connectionFatal(code)` 无可观察差异）。修订未触 D4 | **evolution-required**（信号枚举文本不再如实描述公共缝词汇；修订计划见 §6/E1——D10 附录要素齐备，ALLOW LIST 已含两文件） | ADR 0032:18；设计 §7 D4/D10、§11；`hub-namespace.ts:662,1099`；`hub-edge.ts:99-105` | §6/E1 + §8/RA1' |
| 7 | ADR 0032 决策 3 机制句 + CONTEXT.md:230 措辞 | :22；CONTEXT.md:230 | **D6 裁 U3 = (i) edge 侧处置**（修订未改裁决方向）：denied/throw 经宿主桥按准入结局路由到 denialSink（生产 sink 直连真 port），wire 行为由零 diff 生产代码产出；附录 E2 按 D6 形态定稿三载体陈述。修订在 D6 资源账**补句**「OPEN 帧可多次到达；承载机械按 (connectionKey, ns) 至多一个且路由相位单调；再 OPEN 经既有机械转发——零二次授权语义」（SA2-F1 required change 第三项），与机制句无新增冲突面 | **evolution-required**（R7''/R8'' 文本调和义务；修订计划见 §6/E2） | ADR 0032:22,:35；CONTEXT.md:230；设计 §7 D6/D7/D10、§11；`hub-namespace.ts:346-376` | §6/E2 + §8/RA1'/RA2' |
| 8 | ADR 0032 决策 3（authorize 在 edge、OPEN 全解码、投影「仍传入」） | :20-22,:35 | D1 adapterPort.`openAdmission` 恒 resolve ok-投影（闭包回放）；test-d 负控；A4 authorize 恰一次。**修订强化**：三分支路由下再 OPEN 不重入路由（相位单调）⇒ `beginAdmission` 结构性只在台账首建调用一次（`hub-edge.ts:323-328` 本轮重验）——「authorize 每 (连接, ns) 仅首次 OPEN 调用一次」的 ADR 自文（:22）在公共形态下字面保持 | **implements-existing-decision** | ADR 0032:20-22,:35；协议 §7.1:174；设计 §7 D1/D6/D7；`hub-edge.ts:323-369` | 无 |
| 9 | ADR 0032 决策 3（OPEN 准入管线：pending 有界缓冲、并发 OPEN 上界、drain 门、session 随连接存活）+ `ws-replication/AGENTS.md` 有界纪律 | :22 | D7 桥 pending 窗口每 ns ≤16 帧 + 单帧 ≤ maxFrameBytes（镜像 `hub-connection.ts:54` `MAX_EARLY_FRAMES=16` 先例本轮重验）+ 溢出响亮收口 `CONNECTION_POLICY_VIOLATION`(1008)。**修订扩大窗口承载面**：`routing` 相位期间到达的**全部** ns 域帧（含在途 OPEN，D7 ②）入同一有界窗口、按到达序冲刷——有界性/顺序保真/溢出响亮三要素不因扩面而变；drain 簿记保真论证（denied 通道终态 → 真 port.`onChannelSettled` → edge `settledNames`）经 `hub-edge.ts:689-710` 本轮重验 | **implements-existing-decision**（R4''/S2 在跨缝 pending（含在途 OPEN）条件下的兑现设计） | ADR 0032:22；AGENTS.md「Keep admission bounded…」；设计 §7 D7、§9 E4；`hub-connection.ts:44-60`；`hub-edge.ts:685-712` | impl 复查核对有界性事实与溢出路径 |
| 10 | ADR 0032 决策 4（路由键契约：定偏移 + OPEN 全解码 + codec 守卫） | :26 | 零触碰 edge demux/路由与 #419 守卫；桥 = 已解码消息↔字节中继；OPEN 中继序 = 合成 `0`（登记例外：通道 OPEN 路径不读 seq、协议无消费者——修订对再 OPEN/在途 OPEN 转发沿用同例外，无新消费者） | **no-conflict** | ADR 0032:26；CONTEXT.md:233-235；设计 §7 D7、§5 W1 注 | 无 |
| 11 | ADR 0032 决策 5（dormant 降级 + observer 发射点 = 拥有事实的一侧；事件字段集 append-only） | :30 | D5 17 成员映射表逐一兑现（本轮与 `hub-split.ts:54-99` 重新逐一清点对齐：water gate 恒 true、`bufferedAmount` 恒 undefined、assembly per-session 单槽、namespace 域 observer 经工厂配置注入、`emitObserver` = `dispatchReplicationObserver` 单点复用）；U8 语义差入附录。修订未触 D5 | **implements-existing-decision** | ADR 0032:30；协议 §17；设计 §7 D5/D7、§13 R9 | impl 复查确认 backpressure/shed 族不在 shim 臂 |
| 12 | ADR 0032 后果节（公开面 append-only 冻结；SessionHost 双轨） | :41-43 | 工厂轨兑现：`src/index.ts` 追加恰 1 值 + 7 类型；`FROZEN_PRODUCTION_EXPORTS` 插入位置字母序正确（本轮重验 `createHubReplicationPlugin` < `createHubSessionHost` < `createPeerReplication`）；服务轨 = non-goal | **implements-existing-decision** | ADR 0032:41-43；`index.ts`；契约测试 :144-156,:551；设计 §7 D9、§11 | impl 复查核对导出恰增 |
| 13 | CONTEXT.md「复制 Edge」（:225-227） | 职责清单 + _Avoid_ | 夹具用真 edge；accept 为宿主职责（保真度差异清单已按 SA2 N1 登记于夹具头注——R12）；edge 解码面不动 | **no-conflict** | CONTEXT.md:225-227；设计 §7 D7、§13 R12；`hub-connection.ts:294-334` | 无 |
| 14 | CONTEXT.md「SessionHost」（:229-231） | 正向描述 + _Avoid_ 四项 | _Avoid_ 四项逐条承接（零重检/连接级帧不入/drain 感知留 edge/零 worker 类型）；「传入」措辞差距 → 行 7 E2 线（不重复计） | **no-conflict** | CONTEXT.md:229-231；设计 §7 D1/D2、§6 | 见 §6/E2 |
| 15 | 协议 §4（连接序号严格 +1）+ W1/RA4 修正读法 | :16,:23 | §12 A8 按修正读法落：wire 严格 +1 无 0 泄漏；**出站缝帧占位 0、入站非 OPEN 帧带 wire 序**；OPEN 中继序 = 合成值（行 10 登记）。iteration 0 裁定维持（RA4' 已确认，W2 一并，见行 16） | **no-conflict** | 协议 §4；`hub-split.ts:110-112`；设计 §5 W1、§7 D2、§12 A8 | impl 复查以修正读法核对断言 |
| 16 | 协议 §7.1/:650 + Registry 零存在性泄露（**W2 裁决维持**） | :174,:176,:650 | 设计 §5 W2 行已消除悬置（「SA8 design 复查已确认（行 16/RA4'）」——即 iteration 0 本报告前身行 16，本轮维持该裁决）：PEER_OWNER 臂正确断言 = 无 OPEN_OK + ns 域 ERROR `NAMESPACE_NOT_FOUND` + 注册表零打开 + authorize 恰一次（三重锚本轮重验：registry `types.ts` 零存在性泄露 + 协议 :650 + 通道 :375 映射） | **no-conflict**（验收措辞修正 = 决策集唯一确定读法，不触冻结面） | 协议 :174,:176,:650；`hub-namespace.ts:355-375`；`namespace-registry/src/types.ts`；设计 §5 W2、§12 A4、§13 R10 | §8/RA4'（落测试时执行） |
| 17 | 协议 §13/§14（错误与 close 分类注册表，append-only） | :401,:412,:413,:415,:424-426 | 全部失败语义用**既有**码：`MALFORMED_FRAME`→1002、桥溢出 `CONNECTION_POLICY_VIOLATION`→1008（:412 + `wsCloseCodeFor` 本轮重验）、`ACK_STATE_VIOLATION`→1002、**修订新增 E10 续体兜底 `INTERNAL_ERROR`→1011（:415 在册）**、deny 族 ns 级 failed、`NAMESPACE_REOPEN_REQUIRES_RECONNECT`（:424 在册）。零新码零改号 | **no-conflict** | 协议 §13/§14；`hub-edge.ts:99-105`；设计 §9 E1–E10 | 无 |
| 18 | 协议 §17（背压：水位依赖 `bufferedAmount`；1011 终局） | :586-588 | water gate dormant（决策 5 授权）；7 文件矩阵不含 backpressure/shed 族（本轮 grep 复核）；U8 语义差入 D10 附录 | **no-conflict** | 协议 §17；ADR 0032:30；设计 §7 D5、§13 R9 | impl 复查确认该族不在 shim 臂 |
| 19 | 协议 §19（授权只在 OPEN 检查；revoke → ns 终止 ERROR + cleanup） | :637-652 | A10：`handle.terminateUnauthorized()` → 内部 `terminateNamespace`（无通道 no-op resolve 同构）；**修订新增 R11 登记**（在途路由期 revoke 只能挂起至路由完成——见行 34 专项裁决） | **no-conflict** | 协议 §19；设计 §7 D4/D7、§12 A10、§13 R11 | 见行 34/RA6' |
| 20 | 协议 §23.1（事件词汇 36 型 append-only） | :745,:771 | 零新事件型；observer 隔离单点复用；`onSignal` 分发同款隔离（§9 E6）；`onFrame` 返回序语义有 :771 规范锚 | **no-conflict** | 协议 §23.1；`observer.ts:36`；设计 §7 D4/D5、§9 E6 | impl 复查锚：隔离单点不分叉 |
| 21 | ADR 0010（复制架构权威） | 状态行/决策 | 零 wire/生命周期变化；A7 ACK 口径、A11 drain 断言走 §21 收口权威 | **no-conflict** | ADR 0010；AGENTS.md §21 条；设计 §8/§12 | 无 |
| 22 | ADR 0012（实例身份） | 相关决策句 | `remoteInstanceId` = verifyToken 结算身份（构造 edge 前闭包捕获）；工厂 `instanceId` 宿主注入 | **no-conflict** | ADR 0012；CONTEXT.md:237-239；设计 §7 D1/D7 | 无 |
| 23 | `packages/ws-replication/AGENTS.md` | Contract/Boundaries | ALLOW LIST 遵守（公共工厂经 `index.ts`；夹具只落 `test/`；`testing.ts` 零改 DENY；timer 注入） | **no-conflict** | AGENTS.md；设计 §7 D7、§11 | impl 复查核对 |
| 24 | #418 SA8 R2（票内 DENY，已闭合） | #418 SA8 报告 §8-R2 | #420 向 `index.ts` 追加导出 | **no-conflict**（票内门已闭合；导出 = ADR 0032:41-43 工厂轨 + AC1 明文） | #418 SA8 报告；ADR 0032:43；AC1 | 无（登记防误读） |
| 25 | #418 SA8 R5''（入站缝形态 + `openAdmission` 拉取 + `channels`/`dataFacetOf` 组合成员重塑重新过 SA8） | #418 SA8 报告 §8-R5'' :99 | 本报告 = 该门禁 design 段的**修订后重裁**：入站缝改公共字节面（决策 2 字面）；`openAdmission` 拉取形态在内部保留（adapterPort 闭包回放 / 桥拉真台账恰一次）；组合成员零重塑——修订后桥代理仍实现 `HubSessionSink` 既有 6 成员面（`openNamespace`/`namespaceFrame`/`close`/`terminateNamespace`/`dataFacetOf`/`channels`），路由相位是**夹具内部实现细节**而非 sink 面重塑；authorized ns 不投影 `channels`（R7 登记维持） | **implements-existing-decision**（三项触发面逐项裁决完毕；impl 复查承接） | #418 SA8 报告 §8-R5''；`hub-split.ts:101-127`；设计 §7 D1/D6/D7、§13 R7 | §8/RA3' |
| 26 | #418 SA8 R8''（重触发面：port 成员增删/结局词汇/reject 面/事实源/DENY 面/决策文本） | #418 SA8 报告 §8-R8'' :101 | adapterPort 实现既有 17 成员（本轮重新清点零增零删）；`HubOpenAdmission` 三态词汇不动（denied/throw 经桥路由不进公共描述子——修订后仍如此：三分支路由消费结局但不改变结局词汇）；DENY 面 `hub-namespace.ts`/`hub-edge.ts` 零 diff 维持；决策文本变更仅经 RA1 附录 | **no-conflict** | #418 SA8 报告 §8-R8''；`hub-split.ts:48-99`；设计 §7 D5、§11 DENY | impl 复查按 R8'' 逐项 |
| 27 | 内部重命名 + §12.6 两处授权编辑 + `hub-split.ts` 头注更新 | 决策文本零引用 | 纯机械（D9 表 5 文件；`docs/**`/`CONTEXT.md` 对两名零引用——前置门禁 grep 维持）；头注更新 = 注释真实性（:4-5「绝不进 src/index.ts」陈述被本票推翻），非决策文本 | **no-conflict** | 设计 §7 D9、§11；契约测试 :144-156；结构测试 :614-619；`hub-split.ts:4-5` | impl 复查确认纯机械 |
| 28 | 设计内部一致性（iteration 1 全文） | 设计 §5/§7/§8/§9/§12/§13 | W1/W2 修正读法贯穿（§5/§7 D2/§12 A8 与 §12 A4 三处一致）；**SA2-F1 修订自身一致**：三分支路由在 D6 资源账补句/D7 相位表与代理行/§8.1 相位投影/§8.2 R3b/§9 E4·E5·E8·E10/§12 验收行（`:231`/`:245` shim 臂 + 零 unhandled rejection + `sessionsOpened` 每 (连接,ns) 恰 1 + M7）/§13 R11·R12 各处表述互不自矛盾；设计 §14 修订映射与 SA2 §13 required change 三项逐条对得上（① 句柄转发不重调 `open()`、② 在途入窗按序冲刷、③ denied 投递明示 + D6 补句 + AC3 登记） | **no-conflict** | 设计 §5/§7/§8/§9/§12/§13/§14；SA2 §13；本报告行 15/16 | 无 |
| 29 | D8 测试机制（`vi.mock` + 动态 import 矩阵） | 非决策面（测试机制） | 矩阵 7 文件零编辑（AC3 硬门）；反空跑 + M4 负控；夹具仅深路径 import；本轮复核 `vitest.config.ts` 别名与 `driver.ts:196` 默认吃 mock 成立 | **no-conflict** | 设计 §7 D8；`vitest.config.ts:7-24`；`driver.ts:8/:196` | impl 复查核对反空跑 + M4 实跑 |
| 30 | `docs/AGENTS.md`（显式修订，不静默矛盾） | Authority/Editing 节 | ADR 0032 附录 + CONTEXT.md 词条更新列入 ALLOW LIST 且与实现同变更集（D10/§11/§12 RA1 行）；机制句差距以修订消解 | **implements-existing-decision** | `docs/AGENTS.md`；设计 §7 D10、§11 | §8/RA1' |
| **31** | **协议 §7.1:176（同连接重复 OPEN 合流：底层操作合流、每请求收到 OPEN_OK 或 ERROR；终态后 `NAMESPACE_REOPEN_REQUIRES_RECONNECT`）vs 修订 D7 三分支路由** | :176 | 修订把再 OPEN 从「重入 authorized 路由再调 `open()`（iteration 0 缺陷：命中 D1 重复前置 throw + 异步续体内无承载 reject，重开矩阵断裂）」改为：① 相位 `authorized` → 不再调 `open()`，OPEN 帧字节经既有句柄 `handleFrame` 转发 → **零 diff 通道 `onOpen` 重开矩阵**产出应答；② 相位 `routing` → 入有界 pending 按到达序冲刷；③ 相位 `denied` → `denialSink.openNamespace` → 通道在场 `onOpen` 自然承接。应答（OPEN_OK×N / ERROR / REOPEN 错误）全部由生产通道产出（`flushOpenWaitersOk` 每 waiter 恰一封 OPEN_OK、终态分支 REOPEN 错误——本轮亲验）——协议 :176 的每请求收答义务由零 diff 机械兑现，夹具不合成任何应答 | **implements-existing-decision**（iteration 0 缺陷形态与协议 :176 不相容——peer 的再 OPEN 请求将收不到应答（throw 吞没）；修订恢复相容） | 协议 :176；`hub-namespace.ts:289-332,:474-481`；设计 §7 D7、§12 SA2-F1 行；SA2 §13 | §8/RA6'（shim 臂 `:231`/`:245` 逐字不变绿落地核对） |
| **32** | **ADR 0032 决策 3（「重 OPEN 经 openWaiters 合流不重复 authorize」自文 :22 + 并发 OPEN 上界）vs 修订的在途 OPEN 入窗** | :22 | 在途 OPEN 入 pending 窗口（与 `namespaceFrame` 同窗、≤16 帧、溢出 1008 响亮）+ authorized 续体完成（`open()` + 注册 + 首 OPEN 转发）后按到达序冲刷 → OPEN 条目经句柄转发落 `sink.openNamespace` → 通道在场（首 OPEN 已建）→ `onOpen` → **openWaiters 合流**——与 ADR 自文的合流机械同一条；authorize 恒恰一次（edge 台账单点，桥不重入路由：相位互斥单调不可逆，`routing` 只在台账首建的首 OPEN 进入）；资源账补句（D6）与代码事实（`beginAdmission` 仅台账首建调用、promise 多播）一致 | **implements-existing-decision** | ADR 0032:22；`hub-edge.ts:323-369`；`hub-namespace.ts:309-313,:474-481`；设计 §7 D6 补句/D7 ② | §8/RA3'/RA6'（`sessionsOpened` 每 (连接,ns) 恰 1 断言落地核对） |
| **33** | **ADR 0032 决策 3（「sink 失败响亮连接收口」条款）+ 协议 §13:415（`INTERNAL_ERROR`→1011）vs 修订 E10 续体容错** | :22；协议 :415 | 修订给桥路由续体整段 try/catch：非预期 throw → `realPort.connectionFatal('INTERNAL_ERROR', 1011)` 响亮收口——用既有在册码与既有 edge 收口面（SA2-F1 故障面 ER7 的兜底：edge 对 `sink.openNamespace` 返回 void，续体 throw 无人承载 ⇒ 无承载 reject）；验收锚 = 同 run `collectUnhandledRejections()` 空。这与决策 3「sink 失败响亮连接收口」同向（消除静默无承载失败），非新失败语义 | **implements-existing-decision** | ADR 0032:22；协议 :415；`hub-edge.ts:619-645`（connectionFatal 出 ERROR + close）；设计 §7 D7 E10、§9 E10 | §8/RA6'（零 unhandled rejection 落地核对） |
| **34** | **协议 §19（revoke → ns 终止 ERROR + cleanup）vs 修订 R11 在途路由期 terminate 挂起** | :637-652 | 相位 `routing` 期 `terminateNamespace(ns)` 挂起至路由完成再按结局投递（authorized → 句柄；denied → denialSink）——ns ERROR + failed 终局仍由生产 `terminateUnauthorized` 路径产出（`hub-namespace.ts:1186-1191` 本轮重验：非 quiet 即发 + finalize('failed')），语义保持、仅 wire 时序相对 listen 可能偏移（listen 形态下 'opening' 通道立即发；shim 在途期通道尚未建于任何 sink——OPEN 帧尚在窗内，结构性无通道可终止）。设计如实登记为 shim 观测边界（R11）：AC3 七矩阵零 revoke 用例（本轮 grep 证实）、A10 为 live 后直调，验收面不触及；未来加该场景须先扩设计 | **no-conflict**（§19 的 wire 语义经生产代码保持；时序偏移是缝形态固有的观测边界且已登记——协议不治理测试夹具内时序；listen 形态行为逐字节不变不受影响） | 协议 §19；`hub-namespace.ts:1186-1191`；设计 §7 D7 `terminateNamespace` 行、§13 R11 | §8/RA6'（登记维持；未来场景扩展先过设计） |
| **35** | **ADR 0032 状态行（listen 模式行为逐字节不变）vs 修订验收面（矩阵 shim 臂二次执行 + M7 变异）** | :4 | listen 臂 52 tests 断言逐字不变重跑（D8 机制下矩阵文件零编辑）；shim 臂 = 同一断言体在替换工厂下的**追加**执行（vi.mock 仅替换 `createHubReplication`，listen 组合根与生产导出零改动）；M7 变异（桥退化为无条件 `host.open()` 路由 = iteration 0 缺陷本身）登记为交付实跑项——变异红证明验收对 F1 缺陷敏感；反空跑防 shim 臂空转 | **no-conflict**（listen 形态零触碰；shim 臂是新增测试执行不是生产行为变化） | ADR 0032:4；设计 §7 D8、§12 AC3/M7；`vitest.config.ts`；`driver.ts:196` | §8/RA3'/RA6'（M1–M7 实跑登记） |

裁决分布：**no-conflict ×21、implements-existing-decision ×12、evolution-required ×2（行 6/7——与 iteration 0 相同两条修订线，修订未扩大其范围）、hard-conflict ×0**。

## 4. Overrides

**无。**

| Old decision | Override authority | Scope | New obligation |
| --- | --- | --- | --- |

- 无 Owner 评论（派工明文 none；REST Issue comments = `[]`）⇒ 无 Owner 覆盖通道被援引。
- 无新 ADR、无协议版本升级、无决策自含演进条款被触发。
- 修订的两处验收措辞修正（W1/RA4、W2）是决策集唯一确定读法的采纳（非改写）；`connection-fatal` 公共化与机制句措辞差以 evolution-required（正式附录）消解；**SA2-F1 修订不援引任何 override**——三分支路由、pending 窗口、E10 兜底全部落在「装配路由 + 既有机械复用 + 既有失败码」范围内，其正当性来自决策 1「分布式实例化」与决策 3 合流条款的字面，无需覆盖任何旧决策。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（修订设计态度） |
| --- | --- | --- | --- |
| wire 格式/帧头/消息码/capability | envelope 布局（sequence @ `[8..12]`、自 1 严格 +1）、消息码集、`CAP_CHUNKED_UPDATE` | 协议 §4/§5/§6 | 零变化（DENY LIST 含协议文档；修订的转发/冲刷仅重编码既有消息）——符合 |
| 错误码/close 码注册表 | §13.1 + §14 映射（`MALFORMED_FRAME`→1002、`CONNECTION_POLICY_VIOLATION`→1008、`ACK_STATE_VIOLATION`→1002、`INTERNAL_ERROR`→1011、`NAMESPACE_REOPEN_REQUIRES_RECONNECT`、deny 族 ns ERROR/failed） | 协议 §13:401-426、§14；`hub-edge.ts:99-105` | 零新码零改号（含修订新增的 E4/E10 两失败面均用既有码，本轮逐一在册核验）——符合 |
| 事件词汇（36 型 + 字段集） | append-only | 协议 §23.1；ADR 0032:30 | 零新事件型；observer 单点复用——符合 |
| 路由键布局 + codec 字段序 | 同步维护契约 + 结构性守卫 | ADR 0032:26；#419 守卫 | 零触碰——符合 |
| `packages/ws-replication/src/hub-namespace.ts` | 逐字节零 diff（R8'' DENY 面） | #418 SA8 §8-R8''；设计 §11 DENY | 修订的核心依赖恰是**零 diff 通道的重开矩阵**（D7 ① 转发后由 `onOpen` 产出应答）——设计有最强动机保持零 diff——符合（impl 复查核对） |
| `packages/ws-replication/src/hub-edge.ts` | 设计自设零改动 | 设计 §11 DENY；D6 备选否决 (i') | 修订未新增任何 edge 改动诉求（三分支路由全在夹具）——符合 |
| port 17 成员集 / `HubOpenAdmission` 三态 / promise reject 面 / sink 面 6 成员 | R8'' 重触发面（增删即重过 SA8） | `hub-split.ts:48-127`；#418 SA8 §8-R8'' | adapterPort 17 行逐一对应零增删；桥代理实现既有 sink 面（路由相位为夹具内部细节，非面重塑）——符合 |
| 公共导出面 | #418 冻结表 append-only；`testing.ts` 零改 | 契约测试 :144-156,:551；AGENTS.md | 恰追加 1 值 + 7 类型；插入位保字母序——符合 |
| listen 模式行为 | 逐字节不变 | ADR 0032:4 | listen 组合根仅机械重命名；矩阵断言逐字重跑（行 35）——符合 |
| SA6 §12.1 冻结公共声明 | 逐字（test-d 锁定后 append-only，S6） | SA6 契约 §12.1 | **修订前后逐字符一致（本轮比对）**——SA2-F1 修订完全落在内部/夹具面——符合 |
| 决策/规范文本 | `docs/adr/**`、`docs/protocols/**`、`CONTEXT.md` | `docs/AGENTS.md` | 仅 RA1 授权的两文件附录/词条更新（ALLOW LIST 内，非静默）——符合 |

## 6. Evolution requirements

**E1 — ADR 0032 决策 2 缝词汇 + 决策 5 公共面降级登记**（与 iteration 0 相同，修订未触）。要素核对：修订文件（`docs/adr/0032` 决策 2 信号枚举句 + 决策 5 补注 + `CONTEXT.md:229-231`，ALLOW LIST 已指名）/ 新旧语义（载体映射 + `connection-fatal` 既有收口路径公共化 + dormant 词汇/U8）/ 兼容（wire 逐字节、listen 零变化、port 17 成员、公共面 append-only）/ 失败语义（code→close 映射单点留 edge；`onFrame` 0 值既有路径）/ 版本（无）/ 验证锚（A12/AC3 ac5-live 臂/C5b）/ 冻结面（§5 全表）——**要素齐备**（D10 定稿文本句在场）。

**E2 — ADR 0032 决策 3 机制句 + CONTEXT.md:230 措辞调和**（R7''/R8'' 义务本体；U3 = D6 形态）。三载体陈述（α 进程内拉取 / β 公共描述子传入 + edge 侧处置 / γ 真 worker 另裁）+「未授权 OPEN 不过**公共字节缝**」。要素同 iteration 0 齐备；**修订补充的 D6 资源账句（OPEN 可多次到达、承载机械至多一、路由相位单调、零二次授权）与附录 E2 定稿形态一致**——附录描述的 β 载体语义把再 OPEN 的处置也涵盖在内（经既有机械转发），无文字缺口新增。

**计划完整性判定**：两线要素齐备、验证锚与冻结面明确、无版本迁移 ⇒ 计划完整 ⇒ 允许 `clear`，以 `requiresConflictRecheck: true` 与 §8 行动强制附录与实现同变更集落地核对。

## 7. Hard conflicts

**无。** 特别核对并排除（含修订新增面）：(a) 三分支路由 ≠ 第二 FSM/夹具协议决策（行 1/31——应答全部由零 diff 通道产出，决策 1 允许分布式实例化）；(b) 在途 OPEN 入 pending 窗口 ≠ 无界缓冲或静默丢弃（行 9/32——≤16 帧 + 溢出 1008 响亮，镜像既有先例）；(c) E10 `INTERNAL_ERROR`(1011) / E4 `CONNECTION_POLICY_VIOLATION`(1008) ≠ 新错误码（行 17/:412/:415 在册亲验）；(d) iteration 0 缺陷形态（再 OPEN 重入路由 → 重复前置 throw → 无承载 reject → 重开矩阵断裂）**曾与协议 §7.1:176「每个请求都收到 OPEN_OK 或 ERROR」不相容**——修订（三分支路由）正是消除该不相容的修复，非引入新冲突（行 31）；(e) R11 terminate 挂起 ≠ §19 语义改写（行 34——ns ERROR + failed 仍由生产路径产出，时序偏移登记为夹具观测边界，验收面不触及）；(f) 修订未触碰公共冻结签名/DENY 面/port 成员集/U3 方向/RA1 附录要素（本轮逐点复核）。

## 8. Required actions

| # | 行动 | 责任面 | 门禁 |
| --- | --- | --- | --- |
| RA1' | 附录与实现同变更集落地：ADR 0032 澄清附录（E1 信号词汇 + dormant/U8；E2 三载体 + D6 形态含再 OPEN 经既有机械转发的语义）+ `CONTEXT.md:229-231` 词条更新；附录文本与 D4/D5/D6/D10 一致 | 实现变更集 + Host | impl 复查逐项核对 |
| RA2' | deny 断言族落地核对：`NAMESPACE_UNAUTHORIZED`×1（零 diff 通道产出）、authorize 恰一次、注册表零打开、`ac1-ac2-open` shim 臂绿；W2 修正负控（PEER_OWNER → `NAMESPACE_NOT_FOUND`）按行 16 裁决落测试 | SA10/SA3 实现 | impl 复查 |
| RA3' | R5''/R8'' 落地核对清单：`hub-namespace.ts`/`hub-edge.ts` 零 diff；导出恰增 1 值 + 7 类型（`testing.ts` 零改）；零 worker 依赖/类型（C4a 0 命中）；S2 有界 pending（≤16/ns 含在途 OPEN + 溢出 1008 在场）；observer 隔离单点不分叉；AC3 反空跑 + M1–M7 实跑登记；重命名纯机械 + 全量绿 | SA8 impl 复查 | 本报告置 recheck |
| RA4' | 契约措辞修正执行（design 段已裁定，落测试时生效）：A8 第二分句（出站占位 0 / 入站非 OPEN 带 wire 序）+ A4 末句（`NAMESPACE_NOT_FOUND`）；C5a/A9/C4c/deny 三臂不动 | SA6 契约消费方（SA10/SA3 落测试时） | impl 复查 |
| RA5' | U2 边界维持：只冻结同步宿主 pipe；真 worker 形态后续票重新过 SA8（R5''/R8'' 存续）；公共面 append-only；R6 多 bit capability 同宗 | 后续票 | 跨票登记 |
| **RA6'** | **SA2-F1 修订落地核对（本轮新增）**：(i) 三分支路由 + 相位单调 + E10 try/catch + 桥 closed 在途守卫在夹具中按 D7 落地；(ii) `ac1-ac2-open.test.ts` `:231`（OPEN_OK×2 + authorize 恰一次）与 `:245`（`NAMESPACE_REOPEN_REQUIRES_RECONNECT`）两用例 shim 臂**断言逐字不变**全绿；(iii) 同 run `collectUnhandledRejections()` 为空（AC3 与 AC2 两处采集）；(iv) `sessionsOpened` 每 (连接, ns) 恰 1（再 OPEN 不重开公共句柄）+ `reopenForwarded`/`pendingFlushed` 探针计数与用例吻合；(v) M7 变异实跑登记（退化为无条件 `host.open()` 路由 ⇒ 矩阵两用例红 + unhandled rejection 非空）；(vi) R11/R12 登记随夹具头注落地（revoke 时序观测边界 + accept 门链差异清单），未来矩阵加 revoke 场景前须先扩设计 | SA3/SA10 实现 + SA8 impl 复查 | impl 复查 |

## 9. Verdict

**`clear`**。

- 35 项对照：21 no-conflict、12 implements-existing-decision、2 evolution-required（行 6/7——与 iteration 0 相同两条修订线，修订未扩大范围）、0 hard-conflict、0 override。
- SA2-F1 修订裁决：iteration 0 设计的桥路由缺陷**确与协议 §7.1:176 不相容**（再 OPEN 请求无应答 + 无承载 reject），但该不相容已被本修订消除——三分支路由使重复 OPEN 的合流应答、`NAMESPACE_REOPEN_REQUIRES_RECONNECT`、authorize 恰一次全部经零 diff 生产机械兑现（行 31/32），修订方向 = 向决策集靠拢，无新决策面。修订附带防御（E10 兜底、closed 守卫、terminate 挂起）均用既有码与既有收口面，与决策 3「sink 失败响亮连接收口」同向（行 33/34）。
- 两条 evolution-required 线修订计划要素齐备（§6），按 skill「计划完整 ⇒ clear + 后续复查」放行。
- 前置门禁 RA1–RA5 逐项被修订设计承接（设计 §6 映射表口径成立）：RA1 → D10/ALLOW LIST；RA2 → D6（方向未变 + 修订补强资源账）；RA3 → D7（桥形态冻结含三分支）+ impl 清单；RA4 → W1/W2 修正读法落 §12（design 段已确认）；RA5 → 非目标 + R1/R8。
- W1/W2 维持 iteration 0 裁定读法（行 15/16），不构成阻断。
- 设计可进入实现，条件 = §8 RA1'–RA6'；实现 diff 后按 R8'' 触发条件运行 implementation 复查。设计 §15 自称「修订不触发新 design 段复查输入」——本复查按派工执行且结论与其 delta 自评一致（修订确未触碰任何已裁决策面），该自评与本报告不冲突。

## 10. requiresConflictRecheck

**true**。依据：(1) 新公共 API 面（工厂 + 句柄 + 信号类型）尚待实现核对，一经 test-d 锁定即 append-only 冻结；(2) 生命周期/失败语义面（`close`/`terminateUnauthorized`/`connection-fatal`/序回传 0 值/桥溢出收口 + **修订新增的路由相位/E10 兜底/closed 守卫/terminate 挂起**）待落地核对；(3) E1/E2 的 ADR/CONTEXT 正式修订文本尚待落入实现变更集并核对与 D4/D5/D6/D10 一致（RA1'）；(4) R5''/R8'' 重触发面（入站缝形态已改、DENY 面、决策文本）在实现 diff 后须 implementation 复查（RA3'）+ **SA2-F1 修订专项落地核对（RA6'：三分支路由、再 OPEN 两用例 shim 臂绿、零 unhandled rejection、M7 实跑）**。产物 = `task_issue-420_implementation_conflict_report.md`（触发条件三合一将在实现后成立）。
