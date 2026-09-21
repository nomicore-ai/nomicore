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
- **γ 真 worker 形态**：后续票（入站缝已是字节面；异步序回传与跨线程 pending 仍需按 R4''/R5'' 重新过 SA8）。

### A3 决策 5 降级面的公共登记（U8）

公共 byte-seam 工厂形态下，宿主传输缺面按决策 5 降级并成为**对外可观察契约**：`dataGateOpen` 恒 true（水位闸门休眠；连接级总量保护收敛 edge + 1011 终局）、`bufferedAmount` 恒缺席（`undefined`）、入站 assembly 槽降级为 per-session 计数、namespace 域 observer 事件由工厂配置注入（发射点 = 拥有事实的一侧，隔离单点 `dispatchReplicationObserver` 不分叉）。shim 形态无 listen 的「暂停」可观察面——该语义差已在此登记，不再作为行为差异主张。

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
