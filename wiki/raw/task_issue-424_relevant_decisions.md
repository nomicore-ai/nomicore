# task_issue-424 相关决策摘录（relevant decisions）— 分片形态端到端等价性验收

- 任务：Issue #424「分片形态端到端等价性验收（spec #415 T7）」（Parent = PR #416）
- 被审对象：已接受 SA6 契约 `wiki/raw/task_issue-424_sa6_contract.md`（含 §12.8 四个未决范围决策 SD-1~SD-4）
- 阶段：前置冲突门禁（SA1 设计派发前）；本文件只摘录相关决策、条款与关联点，不重写原义、不作业务设计
- Worktree / HEAD：`/home/wangjian/nomicore-fix-issue-424` / `cab3e8c245ef189da1d823719370a68459939316`（与 SA6 §1 基线声明一致，亲验）
- 冲突基准：`docs/adr/` 全集（31 文件：0001–0030 + 0032，**无 0031**；除 0015 为「提议」外全部 accepted；复制域无 superseded）+ 根 `CONTEXT.md` + `docs/protocols/instance-replication-v1.md`（规范 wire 契约）+ `packages/ws-replication/AGENTS.md`（模块收录决策）

## 1. ADR 盘点（相关性一览）

| 编号 | 主题 | 状态 | 与本任务相关 | 关联点 |
|---|---|---|---|---|
| ADR 0032 | 传输解耦 Edge/SessionHost 拆分 | 已接受（2026-09-21） | **核心** | 全部五项决策 + 澄清附录 A1–A3 + 后果节冻结条款 |
| 协议 instance-replication-v1 | 规范 wire 契约 | 已接受（规范文档） | **核心** | §3/§5/§6/§7/§12/§13/§14/§17/§21/§22/§23.1 |
| ADR 0010 | Hub/Peer WebSocket Y.Doc 复制 | 已接受 | 是 | L147 sequence 纪律；L179 §21 权威指针；L321 停机编排 |
| ADR 0012 | 实例身份与 WS plugin 所有权 | 已接受 | 是 | listen:false 服务面（免 listen 形态归属/不提供 nomicoreHubReplication） |
| ADR 0013 / 0022 | 分块 live update / 分块 sync 传输 | 已接受 | 是 | SD-4 / NC4 / ROUND-C4 的分块语义与冻结值权威 |
| ADR 0023 | Proxy 可消费冻结服务表面 | 已接受 | 否（邻接） | 测试不触碰服务表面；getter 纪律不受影响 |
| ADR 0001–0009, 0011, 0014–0030 | VFSL/Runtime/Registry/读面/订阅等 | 已接受（0016/0024 经 0027 修订） | 否 | 任务 test-only 于 ws-replication，不触及读面/schema 面 |
| ADR 0015 | 纵向 REST namespace create | **提议** | 否 | 非约束（未接受） |

## 2. ADR 0032 条款摘录（核心母法）

### 决策 1（L14）——协议状态机单份
单体 listen 模式 = Edge 与 SessionHost 的**进程内组合**；「协议状态机保持单份实现，只允许分布式实例化」；「宿主自写连接级半边等于 fork 协议实现……否决」。
→ 契约关联：SA6 §3.1 / §12.0（harness 只许装配公共工厂，不自写协议行为）；§10 放大因素 (a)。

### 决策 2（L18）——缝只过字节与纯 JSON，出站占位 + mux 点盖章
缝上只有 namespace 域帧 + 四控制信号；「入站 sequence 由 edge 校验（header-only）；出站帧 session 以 sequence=0 占位编码、edge 在 mux 点重写帧字节 `[8..12]`——wire 逐字节不变」；「缝无接纳信号（fire-and-forget）」。
→ 契约关联：SA6 §3.2、SEQ-C1、§12.1 硬门定义；ROUND-C3 的 `settled` 过缝。

### 决策 3（L22）——authorize 在 edge，未授权 OPEN 不过缝
「edge 对 OPEN_NAMESPACE 全解码……后即调用宿主注入的 `NamespaceAuthorizer`：**未授权 OPEN 不过缝**，edge 复现 `NAMESPACE_UNAUTHORIZED` wire 行为并持拒绝闩锁」；「authorize 每 (连接, namespace) 仅在首次 OPEN 调用一次，重 OPEN 经 openWaiters 合流不重复 authorize」；「OPEN 准入管线（pending 有界缓冲、并发 OPEN 上界、sink 失败响亮连接收口、drain 门、session 对象随连接存活）全部为 edge 规范职责」。
→ 契约关联：AUTH-C2/C3/C4、NC2/NC3；**SD-2 的 (b) 处置直接锚定「sink 失败响亮连接收口」**。

### 决策 4（L26）——路由键定偏移
「合法无 sink → 合成 `NAMESPACE_STATE_VIOLATION`；违例 → `MALFORMED_FRAME` fatal」；namespaceId 定偏移只读提取（`[21..56]`，UPDATE_CHUNK `[22..57]`）。
→ 契约关联：SHARD-C3、NC1；CONTEXT.md「路由键契约」（L233–235）同款。

### 决策 5（L30）——降级与观测纪律平移
observer 发射点 = 拥有事实的一侧；缺面 = dormant；`maxConcurrentAssembliesPerConnection` 分片形态降级 per-session 计数（listen 形态不变）。
→ 契约关联：H8（契约只锁 wire 不锁 observer 事件集）；§10 观测面。

### 澄清附录 A1（L38–41）——缝词汇公共载体
`close`/`terminateUnauthorized`（edge→session，幂等）；`settled`/`closed`（session→edge）；append-only 新信号 `connection-fatal`；同步 pipe `onFrame` 回传被分配 wire 序（0 = 被拒，即 `resync-required{send-failed, send-frame-rejected}` 判据）。
→ 契约关联：TERM-C1~C3、REVOKE-C1、ROUND-C3、红臂 `no-sequence-return`。

### 澄清附录 A2（L47–49）——决策 3 三载体
β 公共字节缝：「**未授权 OPEN 不过公共字节缝**——`HubSessionOpenInput.authorization` 只接受 edge 已结算的 ok-投影；denied/throw 的 wire 行为由 edge 侧处置……拒绝帧/终态/事件/settled 全部由零 diff 生产代码产出」；「同一 (连接, namespace) 至多一个承载机械、路由相位单调；**重 OPEN**……⇒ 每请求收答、authorize 恒恰一次」。
→ 契约关联：AUTH-C2「分片侧零 session 建立」的裁决基准；CONTEXT.md「SessionHost」（L229–231）「denied/throw 不过公共缝，由 edge 侧处置」同款。

### 澄清附录 A3（L53）——降级面公共登记
`dataGateOpen` 恒 true / `bufferedAmount` 恒缺席 / assembly 槽 per-session / namespace 域 observer 由工厂配置注入。
→ 契约关联：H8、§10 观测面（不把 observer 纳入 parity 硬门）。

### 后果节（L64–67）——公共面冻结
「公开面（edge/session 工厂与服务签名）一经发布即按 SA6 纪律冻结，演进只能 append-only」；「免 listen 模式……不提供 `nomicoreHubReplication` 服务」；peer 侧拆分、跨 worker 运维扇出为 non-goal。
→ 契约关联：§12.0「本票零公共面变更」DENY LIST；**SD-3 若走向生产侧改键格式/加工厂选项 = 公共面 append-only 演进**。

## 3. 协议规范条款摘录（docs/protocols/instance-replication-v1.md）

| 节 | 行锚 | 条款要点 | 契约关联 |
|---|---|---|---|
| §3 固定 envelope | L49–61（L57） | 20 字节固定头；`sequence` uint32 BE 于 `[8..12]`，「正常 frame 从 `1` 严格递增」；magic/flags/reserved 恒定 | SEQ-C1、硬门定义 |
| §5 消息注册表 | L91–116（L114） | 消息码 append-only；`UPDATE_CHUNK(0x42)` 仅经 HELLO 协商 `CAP_CHUNKED_UPDATE` 后可用，未协商端 connection fatal | NC4、ROUND-C4、SD-4 |
| §6.1 HELLO | L133–139（L137） | capability bitset 词表；`CAP_CHUNKED_UPDATE = 0x00000001`；optional 取交集 | NC4（协商位断言） |
| §6.2 HELLO_ACK | L141–149 | `selectedCapabilities` = required 满足后的交集；`connectionId` 仅 observability | AUTH-C1 语料、ROUND-C4 |
| §6.3 GOAWAY | L151–159 | drain 纪律：停止新工作、只结算存量；「全部 channel 终态时发送方可提前完成 drain；否则 deadline 到达后以 WS 1001 关闭」；REAUTH_REQUIRED 窗口内 OPEN 静默丢弃 | REAUTH-C1/C2 |
| §7.1 OPEN 矩阵 | L161–176（L176） | 「同一连接内 opening/open 的重复 OPEN 合流底层操作，但每个请求都收到 OPEN_OK 或 ERROR；closed/conflicted/failed 后返回 `NAMESPACE_REOPEN_REQUIRES_RECONNECT`」；先 authorization 后 Registry open | AUTH-C1/C4、NC2/NC3 |
| §12 Namespace close | L359–377（L371） | `CLOSE_OK.ackedSequence` 回指 CLOSE_NAMESPACE sequence；终止性 ERROR 不再追加 CLOSE 握手 | ROUND-C3、REVOKE-C3 |
| §13.1 连接错误注册表 | L397–417（L415） | `INTERNAL_ERROR`：fatal yes / WS close **1011**（append-only 稳定码） | AUTH-C3、SD-2(b) 实测形态 |
| §13.2 namespace 错误注册表 | L421–448（L424/L425/L430/L442） | `NAMESPACE_REOPEN_REQUIRES_RECONNECT`→closed；`NAMESPACE_UNAUTHORIZED`→failed；`NAMESPACE_STATE_VIOLATION`→failed；namespace `INTERNAL_ERROR`→failed | AUTH-C2/C3/C4、SHARD-C3、REVOKE-C1 |
| §14 WS close code | L456–465 | 1001 = GOAWAY/计划重启；1011 = 内部错误/control backpressure | REAUTH-C1、SD-2(b) |
| §17 背压与上限 | L564–616（L582） | `maxConcurrentAssembliesPerConnection` 计数口径：listen = per-connection（edge 单点）/ `listen:false` 分片 = per-session（聚合上界 = 值 × worker 数）——已登记口径差异 | §3.5、H8（不把口径差异当违约） |
| §21 停机/reauth | L671–686（L684） | GOAWAY drain 为网络域硬 deadline：全部 channel 终态提前完成，否则 1001；#229 临时偏离 = 无 GOAWAY 直接 1001 | REAUTH-C1/C2、TERM 组、ADR 0010 L179 权威指针 |
| §22 Conformance | L688–710（L701） | 互通矩阵等同性纪律：「**跨会话字节/长度全等因 Yjs 随机 doc client id 不适用**」——三层确定性断言（kind#sequence 全等、确定性字段帧逐字段、Yjs 承载帧按 kind+计数）；分块深度/全矩阵资产锚已登记（codec golden、issue246 interop、issue300、issue301） | **§12.1 硬门定义的直接依据**、O7、SD-4 |
| §23.1 观测 | L736–845（L838–844） | 发射侧归属表（edge 拒绝路径复刻 `namespace-error{sent}`/`namespace-failed{open-failed}`）；「**工厂/分片形态下未授权 OPEN 不产生 `channel-state-changed`**……属文档化差异，非事件缺失」 | H8（契约不锁 observer 事件集的正当下） |

## 4. CONTEXT.md 术语（决策集组成部分）

| 术语 | 行锚 | 要点 | 契约关联 |
|---|---|---|---|
| 复制 Edge（replication edge） | L225–227 | 公共出面 `createHubReplicationEdge`；「OPEN 准入管线（pending 有界缓冲、并发 OPEN 上界、**sink 解析失败响亮连接收口**）是 Edge 的规范职责」；授权通过后经 `resolveSessionSink(connectionKey, namespaceId, authorization)` 解析 | SD-2 裁决基准；AUTH 组 |
| SessionHost（复制会话宿主） | L229–231 | `createHubSessionHost` 的 `open()` 描述子纯 JSON；「denied/throw 不过公共缝，由 edge 侧处置」；`createHubReplicationPlugin({listen:false})` 仅精确 `false`；两服务入口并存属非法形态 | AUTH-C2 零会话断言；§12.0 两形态构造 |
| 路由键契约（routing-key contract） | L233–235 | 定偏移事实集 + 结构性守卫测试锁死 | SHARD-C3、NC1 |
| 分块复制传输 / UPDATE_CHUNK / CAP_CHUNKED_UPDATE | L205–215 | kind 三态；`0x42` 仅协商后；未协商 fatal | NC4、ROUND-C4、SD-4 |
| 同版本部署假设 / 实现代际 | L217–223 | sync 段分块恒用启用（无新协商面）；代际差异仅见 capability 位 | SD-4 深度边界 |
| Hub / Peer / ReplicationSession / 实例身份 / 服务表面 | L169–199 | 拓扑静态、身份单一真相 | 两形态语料构造、TERM 组 |

## 5. 模块 AGENTS 收录决策（packages/ws-replication/AGENTS.md）

- 「Export production APIs through `src/index.ts`」——工厂消费面唯一入口。
- 「Keep admission bounded across handshake, ready, backpressure, and drain windows」——准入有界为可观察并发契约。
- 「Use injected transport, scheduler, randomness, and optional observer/clock seams」——SA6 §7 时间纪律（注入 timer/scheduler + 微任务 settle、禁真实 timer/网络）的直接依据。
- 「Preserve shutdown safety and follow §21 as the authority for Hub close……reauthentication drain behavior」。
- 验证门：changed state-machine path → 焦点测试 + 包 typecheck + 根 `pnpm typecheck`/`pnpm test`——GATE-C1~C3 同款。
- 根 AGENTS.md「Instance replication」节：改 Hub/Peer 复制须以 ADR 0010 为架构、协议 v1 为规范契约；chunked 变更另遵 ADR 0013/0022——本任务不改复制行为，测试套件为这些契约的验收面。

## 6. SD-1~SD-4 的决策面锚点汇总

| SD | 决策点 | 锚定的决策条款 | 裁决去向（详见 conflict report） |
|---|---|---|---|
| SD-1 | 套件暴露真实生产偏差时是否就地修 | ADR 0032 后果 L66（公共面冻结 append-only）+ 协议全文（wire 冻结）+ SA6 §12.0 DENY | 停手报 SA8/设计 = 与冻结纪律一致 |
| SD-2 | 早到 OPEN（宿主登记先于 `accept*()` resolve 缺位）时 egress 取法 | ADR 0032 决策 3 L22「sink 失败响亮连接收口」+ CONTEXT.md 复制 Edge L226 + 协议 §13.1 L415（INTERNAL_ERROR→1011） | (a)/(b) 双处置均合规 |
| SD-3 | `connectionKey` 工厂实例计数器撞键（同进程多工厂同 instanceId） | ADR 0032 A2-β L48「同一 (连接, namespace) 至多一个承载机械」+ 后果 L66（公共面冻结）；键格式 `${instanceId}-conn-${n}` 为实现内部事实（hub-edge-host.ts `allocate()`），非 ADR 冻结面 | harness 约定合规；生产侧改动 = 演进面 |
| SD-4 | ROUND-C4 协商形态深度 | 协议 §22 L701（互通矩阵资产锚已登记：#243/#246/#300/#301）+ §5/§6.1（协商纪律）+ CONTEXT.md 同版本部署假设 | 两读法均不违约；深度矩阵已有资产锚 |
