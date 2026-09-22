# ADR 0032：复制传输层解耦——Edge/SessionHost 拆分与 namespace 会话级接入缝

日期：2026-09-21（设计敲定：本仓 grill 会话；需求 issue #414，spec 见 issue #415）
状态：已接受（影响包 `@nomicore/ws-replication`；wire 格式与协议语义零变化，listen 模式行为逐字节不变；peer 侧不拆分）

## 背景

nomic-server 要把 namespace 的 registry/runtime/persistence 按 `hash(namespaceId)` 分片到 worker_threads：ingress 线程持有全部 socket 并做帧 demux，一条复制连接复用的多个 namespace 分散在不同 worker。复制负载下最重的 CPU（session 的 `encodeStateVector`/`encodeDiff`/`applyRemoteUpdate`）必须落在 namespace 的 home worker，而现有 `HubConnectionImpl` 把连接级状态机与 per-namespace 通道钉在同一对象里，仅有的公共缝（`accept`/`acceptTrusted`）是整条连接粒度——交给任何单个 worker 都会让其他 namespace 的会话 CPU 落错线程。

## 决策

### 1. 沿既有内缝拆分，两半都是 nomicore 代码（D1/D10）

沿 `HubConnectionImpl` 与 `HubNamespaceChannel` 之间已存在的内部接口 `HubChannelHost` 拆为两个可独立实例化的模块：**HubReplicationEdge**（连接级：envelope/sequence、HELLO 与 capability 协商、liveness、GOAWAY/reauth、连接级背压）与 **HubSessionHost**（namespace 级：`HubNamespaceChannel` 全部）。单体 listen 模式重构为两者的进程内组合——协议状态机保持单份实现，只允许分布式实例化；宿主自写连接级半边等于 fork 协议实现（HELLO_ACK/capability 交集/sequence 纪律全是规范性行为），否决。

### 2. 缝只过 `Uint8Array` 帧与纯 JSON（D2/D6/D12）

缝上只有 namespace 域帧（连接级帧 HELLO/HELLO_ACK/GOAWAY/连接级 ERROR 从不上缝）加四个控制信号（edge→session：`close`/`terminateUnauthorized`；session→edge：`settled`/`closed`）。入站 sequence 由 edge 校验（header-only）；出站帧 session 以 sequence=0 占位编码、edge 在 mux 点重写帧字节 `[8..12]`——wire 逐字节不变。缝无接纳信号（fire-and-forget），有界性由宿主传输实现与既有 `CONNECTION_BACKPRESSURE`(1011) 终局兜底。nomicore 不引入 worker_threads/MessageChannel 的任何依赖或类型——传输实现完全属宿主。

### 3. authorize 在 edge 端调用，OPEN 全解码（D4′/D9）

edge 对 OPEN_NAMESPACE 全解码（固定小帧，无 Yjs 载荷）后即调用宿主注入的 `NamespaceAuthorizer`：**未授权 OPEN 不过缝**，edge 复现 `NAMESPACE_UNAUTHORIZED` wire 行为并持拒绝闩锁。session shim 以闭包回放 edge 传入的预授权投影（`localOwner`/`read`/`submit`），`HubNamespaceChannel` 零改动——语义等价依据是代码事实：authorize 每 (连接, namespace) 仅在首次 OPEN 调用一次，重 OPEN 经 openWaiters 合流不重复 authorize。OPEN 准入管线（pending 有界缓冲、并发 OPEN 上界、sink 失败响亮连接收口、drain 门、session 对象随连接存活）全部为 edge 规范职责。

### 4. 帧路由键契约：O(帧头)，wire 不变（D7/D11）

namespaceId 文法固定 35 字节 ASCII（`ns-`+32 hex）⟹ varString 长度前缀恒 1 字节：namespace 域帧的 namespaceId 恒在帧字节 `[21..56]`（`UPDATE_CHUNK` 因 kind 首字段在 `[22..57]`），edge 定偏移只读提取，不解析 payload。例外两类：OPEN 走全解码（决策 3）；ERROR 的 namespaceId 在变长字段后，edge 对其特例跑几十字节的有界 mini-decode——否决广播（放大面）与 wire 变更（动互通矩阵）。路由点做文法校验并逐字节复现单体两分支（违例 → `MALFORMED_FRAME` fatal；合法无 sink → 合成 `NAMESPACE_STATE_VIOLATION`）。路由键布局与 codec 字段序登记为同步维护契约，codec 侧加结构性守卫测试。

### 5. 降级与观测纪律平移（D5/D8/D14）

worker 侧 transport shim 无 `bufferedAmount`/ping/onPong → 按既有「缺面 = dormant」纪律降级（水位闸门、liveness 休眠，真实活性与连接级总量保护收敛 edge）；`maxConcurrentAssembliesPerConnection` 在分片形态降级为 per-session 计数（聚合上界 = limits 值 × worker 数，listen 模式不变）。observer 发射点 = 拥有事实的一侧（连接域与出站 sequence 事件在 edge，namespace 域事件在 session），事件字段集 append-only 不变。免 listen 表达为显式 `listen: false`；SessionHost 服务（`nomicoreHubSessionHost`）仅免 listen 模式提供。

## 澄清附录（#420 公共 byte-seam 工厂轨；决策文本不变，登记公共面与三载体）

本条不修改决策 1~5 的机制要求，只把**公共面**（issue #420 交付的 `createHubSessionHost` 工厂轨）的载体形态、信号词汇与降级面显式登记，消除决策 2/3 措辞与「进程内内部缝 + 公共字节缝」两种并存形态之间的表述差（#418 SA8 R7''/R8'' 义务）。

### A1 缝词汇：决策 2 四信号的公共面载体映射（信号枚举的公共化登记）

- edge→session：`close` = 句柄 `close(): Promise<void>`（同步前缀 quiesce + 异步尾 cleanup，幂等）；`terminateUnauthorized` = 句柄 `terminateUnauthorized(): Promise<void>`（revoke 链，幂等，无通道 resolve）。
- session→edge：`settled` = `onSignal` 事件 `{ type: 'settled', namespaceId }`（通道终态恰一次，edge 的 drain 提前完成判据）；`closed` = `close()` 的 promise resolve。
- **新增公共化信号（append-only 登记）**：`connection-fatal` = `onSignal` 事件 `{ type: 'connection-fatal', code }`。该收口路径自本 ADR 实现起即为通道→连接的既有内部信号（`hub-namespace.ts` 的 `ACK_STATE_VIOLATION` 收口），公共化只把 `code` 过缝，**code→WS close code 映射仍单点留在 edge**（`wsCloseCodeFor`）；不新增 wire 面、不新增错误码、不新增事件型。
- 同步宿主 pipe 边界（#420 冻结、真 worker 形态另票另裁）：`onFrame(listener: (frame: Uint8Array, lane: 'control' | 'data') => number)` 同步返回**被分配的 wire 序**（0 = 未发送/被拒）——该回执是 session 侧发送记账的承重输入（bootstrap/live ACK 结算；0 值即既有 `resync-required{cause: 'send-failed', reason: 'send-frame-rejected'}` 判据），非被否决的「缝携带接纳信号」；异步 pipe 形态的回传机制留后续票并重新过 SA8。

### A2 决策 3 机制句的三载体调和（R7''/R8'' 本体）

「未授权 OPEN 不过缝，edge 复现 `NAMESPACE_UNAUTHORIZED` wire 行为」按载体分述：

- **α 进程内内部缝（#418 听形态现状）**：OPEN 到达点先建准入台账、再无条件投递；session 以 `openAdmission` **拉取**已发起/已结算的结局（`denied`/`throw` 以值过内部缝），通道在 `registry.open` 之前短路。
- **β 公共字节缝（#420，`createHubSessionHost`）**：**未授权 OPEN 不过公共字节缝**——`HubSessionOpenInput.authorization` 只接受 edge 已结算的 ok-投影；denied/throw 的 wire 行为由 **edge 侧处置**（宿主桥按准入结局把该 ns 交给生产 sink 承载，拒绝帧/终态/事件/settled 全部由零 diff 生产代码产出）。`open()` 描述子为纯 JSON（`connectionKey`/`remoteInstanceId`/`namespaceId`/投影/`selectedCapabilities`/可选 `connectionId`），authorize 不在 session 侧调用（`openAdmission` 端口以闭包回放投影）。同一 (连接, namespace) 至多一个承载机械、路由相位单调；**重 OPEN**（含准入在途到达的 OPEN）经既有生产机械转发/入队冲刷 ⇒ 每请求收答、authorize 恒恰一次（决策 3 自文「重 OPEN 经 openWaiters 合流不重复 authorize」的公共面保持）。
- **γ 真 worker 形态**：后续票（入站缝已是字节面；异步序回传与跨线程 pending 仍需按 R4''/R5'' 重新过 SA8）。**（已落地：见附录 A4——issue #443，spec #445。）**

### A3 决策 5 降级面的公共登记（U8）

公共 byte-seam 工厂形态下，宿主传输缺面按决策 5 降级并成为**对外可观察契约**：`dataGateOpen` 恒 true（水位闸门休眠；连接级总量保护收敛 edge + 1011 终局）、`bufferedAmount` 恒缺席（`undefined`）、入站 assembly 槽降级为 per-session 计数、namespace 域 observer 事件由工厂配置注入（发射点 = 拥有事实的一侧，隔离单点 `dispatchReplicationObserver` 不分叉）。shim 形态无 listen 的「暂停」可观察面——该语义差已在此登记，不再作为行为差异主张。

### A4 γ 真 worker 形态落地（issue #443，spec #445）：异步序回传、单点流控与推-FIFO pacing

本条落地 A2-γ 登记的「后续票」义务。决策 1~5、附录 A1–A3 与否决备选原文零改动；A1 同步宿主 pipe 边界冻结条款不受影响（β 冻结签名逐字保留）；A4.6 对「缝携带接纳信号」否决备选做边界澄清，不构成推翻。缝契约的规范文本 = 协议文档 §24（本条只登记决策）。

#### A4.1 载体与公共面

γ = session↔edge 缝的**显式异步形态**：SessionHost 可运行在与 edge 不同的线程，中间由宿主异步字节传输（如 MessageChannel）承载。公共面为**新工厂/句柄类型**（`src/index.ts` 导出 append-only）——β 的 `HubSessionFrameListener` 同步返回序号的冻结签名无法 append-only 演进为异步回执模型，故 γ 不修改 β 面。`HubNamespaceChannel` 零改动原则保持：全部变化在 port 实现、session sink 组装层与 edge。缝消息词汇（纯 JSON + `Uint8Array`；nomicore 零 worker_threads/MessageChannel 依赖或类型——原约束不变）：

- session→edge：`frame{tag, bytes, lane}`、`settled`、`connection-fatal{code}`（后两者既有）；
- edge→session：`frame{bytes}`、`receipt{tag, sequence}`、`close`、`terminateUnauthorized`（后两者既有）；
- **无拒纳/闸门/信用词汇**（A4.3）。tag 由 session 分配、会话域内单调唯一、纯 JSON。

#### A4.2 保序契约（异步序回传的承重条款）

edge 同时是盖章点与 ACK 路由点，回执与入站帧同在 edge→session 方向；对端须先收帧才回 ACK，故 ACK 到达 edge 在因果上必晚于对应帧盖章。据此缝契约要求：

1. 每 (connectionKey, namespaceId) 会话一对专用通道，每方向 FIFO、不丢、不重、不乱序；
2. edge 在 `OutboundQueue` 盖章点**同步**把回执投入该会话的入站通道（先于处理后续 socket 数据）；
3. 违契 = 宿主 bug → 响亮收口，不允许静默降级。

效果：「回执恒先于引用该序的 ACK」成为结构事实——`UpdateChannel.onAck` 的 violation 判别、`bootstrapSnapshotSeq`、`ownStep2Seq` 三处同步序号锚零改动；round-engine「合法 SYNC_APPLIED 在锚回填前结构性不可达」的因果论证在 γ 下继续成立，依据从进程内同步改写为本条款。session 侧发送记账改两相：pending(tag) → 回执登记(seq)；pending 计入 `maxInFlightUpdates` 窗口（回执时 tag→seq 换键不换槽）；两锚的 undefined 二值语义扩为三态（未发 / pending / 已盖章）。

#### A4.3 流控单点化与拒纳语义（与 β 的显式行为差）

拒纳的实质是流控；**流控只由 edge 单点负责**，缝的其余环节不参与。session 乐观发送，删除 `dataGateOpen`/`connectionState`/`bufferedAmount` 前置检查（A3 缺面 dormant 先例）；edge 及时消费管道（管道不成为蓄水池），连接账本投影越界即 `CONNECTION_BACKPRESSURE`(1011) 收口整条连接——**无逐帧拒纳、无 deferred、无 ns 级 send-failed resync**。单帧超连接级上限（与拥塞无关）= 配置错误 → 响亮收口 + 诊断。内存安全链逐跳有界：session 队列（queue-overflow 既有纪律）→ 管道（edge 及时消费）→ edge 账本（`maxQueuedBytesPerConnection`）。**与 β 的可观察行为差（登记）**：β 的 data 账本溢出 = ns 级 `send-failed` resync、连接存活；γ = 连接级死亡——用恢复粒度换内存安全的单点可论证性；β 行为不变。「洞中 transfer」结构性不存在：连接存活 ⟹ 每只 chunk 已盖章；连接死亡 ⟹ 通道 quiesce 整体 abort。OPEN/pending 水位（≤16 帧/连接、≤4 并发 OPEN）原值保留并**定性为故障参数**：打穿 = 宿主传输异常 = 响亮收口，不作流控调参。

#### A4.4 pacing：推-FIFO（显式接受公平性损失）

连接级 round-robin wheel 是拉取机械，跨线程物理不成立。γ 下 session 自驱 drain（触发点 = 入队 / ACK 到达 / transfer 末 chunk 回执；推完即停、禁 busy loop——pacing 非流控，不管「该不该推」）；edge 按到达序盖章，**不保持**协议 §17 的跨 session 轮转公平性。显式接受并登记：重 namespace 的分块突发可排在轻 namespace 的小 update 之前并瞬时压占共享预算。备选「edge intake 队列 + 调度器」（可恢复公平性且与单点流控兼容）经评审**否决**：复杂度不为当前负载画像付费；负载画像变化时可另票复活。`sendQueueMs` 口径 = 仅 session 队内等待。

#### A4.5 生命周期单规则

回执在盖章点同步投递 ⟹ edge 无「已盖章未回执」悬置。edge 决定收口（close/1011/fatal）时刻起，session→edge 方向后到的一切（帧、settled、任何消息）静默丢弃；close 沿同道 FIFO 送达；session 收 close 即 pending 集整体冲刷（按未发送清算）+ 通道 quiesce（既有机械不变）。`terminateUnauthorized` 不溯及已推帧（revoke 与单体语义一致）。`settled` 晚到只使 drain 多等，`closeTimeoutMs` 强制逃生舱不动。

#### A4.6 否决备选边界澄清

「缝携带接纳信号」（#234 方向）的否决**继续成立**：γ 的 `receipt` 是**序号事实回传**（盖章结果的配对通知），不是接纳控制信号——它不承载 sent/deferred/rejected 判别，session 也不据此做发送决策（决策已在盖章点同步完成）。#234 的 deferred 层定位随之收敛为**单体 listen 形态的内部改进**；三态词汇不上缝。

#### A4.7 观测口径登记

`update-sent` 发射点留 edge 盖章点（决策 5 / issue #423 登记不变）；`update-acked`/chunked 族事件在 session 回执/结算点。`ackLatencyMs` 的 t0 = 推送时刻（含管道与 edge 等待，口径略宽于 β）；跨线程 observer 事件无全序，AC6 型事件序金标的适用域 = α/β，不适用 γ。`maxConcurrentAssembliesPerConnection` 的 per-session 计数口径沿用 A3 / 协议 §17 登记，不随 γ 变化。

#### A4.8 验收纪律

成功路径（OPEN→bootstrap→live→reconcile→close）与 β 形态 wire 逐字节等价；拒纳路径按 A4.3 显式分叉并登记（不等价、属有意行为差）。验收测试用延迟可注入的显式异步内存管道，不引入 worker_threads；既有 listen 与 β 公共工厂测试矩阵全绿为硬门。

## 否决的备选

- **宿主自实现 edge**（nomicore 只出 SessionHost）：要求宿主重写 HELLO_ACK/capability 交集/sequence/GOAWAY 纪律——fork 协议连接级实现，违反 #414 自身约束。
- **open() 预授权投影（#414 原草图）**：授权决策的触发源是 peer 的 OPEN 帧，预授权会把授权知识拉进 ingress demux 路径且拒绝/重开语义需重新定义；被 D4′ 取代（投影仍传入，但语义是 edge 授权结果的传递）。
- **缝携带接纳信号**（#234 方向的 sent/deferred/rejected）：跨线程信号本身异步，回到 ingress 时队列已又积一批，相对 fire-and-forget 无实际收益却多一套契约。
- **单体与拆分双实现并存**：listen 模式零风险但协议状态机实质两份，每次协议演进改两处——漂移风险高于重构的回归风险（回归由既有全量测试背书）。

## 后果

- edge 以普通工厂（`createHubReplicationEdge`）导出而非 Cordis 插件（无 Registry 依赖）；SessionHost 双轨（工厂 + 免 listen 插件服务）。
- 免 listen 模式的 worker 侧插件不再消费 tokens/authorization/verifyToken/authorize 配置（认证授权全部在 edge），也不提供 `nomicoreHubReplication` 服务。
- 公开面（edge/session 工厂与服务签名）一经发布即按 SA6 纪律冻结，演进只能 append-only。
- peer 侧对称拆分、跨 worker 运维扇出均留待后续迭代（本期 non-goal）。
- **决策 5 观测面落地注记（issue #423）**：hub 侧 `update-sent` 的发射点 = edge 连接级 data 帧出面（`port.sendDataFrame` 单漏斗，盖章 `sequence` 事实所有者），`bytes`/`namespaceId` 由帧字节定偏移判定，`sendQueueMs` 经缝上 **append-only 发送记账投影**（纯 JSON `{sendQueueMs?}`，只过差值；ADR 决策 2）自 session 侧携带；工厂/宿主直驱 data 帧无 session 记账 ⇒ 该键**整键缺席**（缺面 dormant）。edge 复刻的授权拒绝路径（`namespace-error{sent}` / `namespace-failed{open-failed}`）按协议 §23.3 在场纪律携带 `connectionId`。`maxConcurrentAssembliesPerConnection` 分片形态 per-session 计数口径已登记协议 §17；发射侧归属表（含「未授权 OPEN 无 `channel-state-changed`」形态差异）已登记协议 §23.1。**决策 1–5 与否决备选原文零改动；peer 侧发射点不变**（本注记只登记落点，不修改决策）。
