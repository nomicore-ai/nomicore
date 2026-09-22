# SA8 Relevant Decisions — issue #420（SessionHost 公共工厂 + 内存管道完整协议回合）

任务前置门禁的决策摘录（只摘录相关决策、条款与关联点；不重写原义、不作业务设计）。
被审对象 = 任务简报 `wiki/raw/task_issue-420.md` + 已批准 SA6 验收契约 `wiki/raw/task_issue-420_sa6_contract.md`。
HEAD = `7039f6d`（= PR #426 merge，含 #418 拆分）。

## 1. ADR 0032（`docs/adr/0032-transport-decoupling-edge-session-split.md`，已接受）

| 条款 | 摘录（原义锚点） | 与本票的关联点 |
| --- | --- | --- |
| 状态行 | 「wire 格式与协议语义零变化，listen 模式行为逐字节不变；peer 侧不拆分」 | 本票全部验收在「缝两侧只过字节/JSON + 通道零 diff」下展开；任何 wire 变化即违约 |
| 决策 1 | 沿 `HubConnectionImpl`/`HubNamespaceChannel` 内缝拆为 **HubReplicationEdge**（连接级）与 **HubSessionHost**（namespace 级）；「协议状态机保持单份实现，只允许分布式实例化」；宿主自写连接级半边 = fork，否决 | SA6 契约的 shim 夹具用**真 edge** + 公共 session 工厂 + 零 diff 通道（AC3）；公共工厂属 nomicore 代码 |
| 决策 2 | 「缝只过 `Uint8Array` 帧与纯 JSON」；缝上只有 namespace 域帧 + **四个控制信号**（edge→session：`close`/`terminateUnauthorized`；session→edge：`settled`/`closed`）；「入站 sequence 由 edge 校验（header-only）；出站帧 session 以 sequence=0 占位编码、edge 在 mux 点重写帧字节 `[8..12]`」；「缝无接纳信号（fire-and-forget），有界性由宿主传输实现与既有 `CONNECTION_BACKPRESSURE`(1011) 终局兜底」；「nomicore 不引入 worker_threads/MessageChannel 的任何依赖或类型」 | AC4（字节/纯 JSON + 零 worker 依赖）、AC5（session 零重检）、A8（占位/盖章）、§12.1 公共面信号载体（close/terminateUnauthorized = 句柄方法、settled = `onSignal`、closed = `close()` promise）与**新增 `connection-fatal` JSON 信号**的裁决面 |
| 决策 3 | 「authorize 在 edge 端调用，OPEN 全解码」；机制句「**未授权 OPEN 不过缝**，edge 复现 `NAMESPACE_UNAUTHORIZED` wire 行为并持拒绝闩锁」；「session shim 以闭包回放 edge 传入的预授权投影（`localOwner`/`read`/`submit`），`HubNamespaceChannel` 零改动」；「OPEN 准入管线（pending 有界缓冲、并发 OPEN 上界、sink 失败响亮连接收口、drain 门、session 对象随连接存活）全部为 edge 规范职责」 | §12.1 `HubSessionOpenInput.authorization`（ok-投影描述子）；否决备选自文「投影仍传入，但**语义是 edge 授权结果的传递**」（:35）；A4（authorize 恰一次在 edge）；S2（宿主桥有界 pending）；U3（拒绝路径归属二选一） |
| 决策 4 | 路由键契约：namespaceId 定偏移只读提取；OPEN 走全解码；ERROR 特例有界 mini-decode；「路由键布局与 codec 字段序登记为同步维护契约，codec 侧加结构性守卫测试」 | 本票不动 edge demux/路由；#419 已落守卫测试；E3 边界注记（OPEN 中继序为桥合成值，协议无消费者） |
| 决策 5 | worker 侧 shim 无 `bufferedAmount`/ping/onPong → 「缺面 = dormant」降级（水位闸门、liveness 休眠）；`maxConcurrentAssembliesPerConnection` 降级为 per-session 计数；「observer 发射点 = 拥有事实的一侧（连接域与出站 sequence 事件在 edge，namespace 域事件在 session），事件字段集 append-only 不变」；「SessionHost 服务（`nomicoreHubSessionHost`）仅免 listen 模式提供」 | S4/U8（water gate dormant true、`bufferedAmount` 缺席、assembly per-session、namespace 域 observer 注入 session 工厂配置）；服务轨（`nomicoreHubSessionHost`、`listen:false` 插件）为本票 non-goal |
| 后果节 | 「SessionHost 双轨（工厂 + 免 listen 插件服务）」；「公开面（edge/session 工厂与服务签名）一经发布即按 SA6 纪律冻结，演进只能 append-only」 | AC1（test-d 锁定 + 公共导出恰增 `createHubSessionHost`）＝工厂轨兑现；S6 append-only 纪律 |

## 2. CONTEXT.md 词条（:225-235）

| 词条 | 关键句 | 关联点 |
| --- | --- | --- |
| 复制 Edge（:225-227） | 「OPEN 准入（全解码 + authorize + sink 路由）」「连接级帧从不上缝」；_Avoid_：把 edge 当薄 socket adapter / 宿主自实现连接级协议（= fork）/ edge 解码 OPEN/ERROR 以外 payload | shim 夹具必须用真 edge（非宿主自写）；A3 连接级帧不上缝 |
| SessionHost（:229-231） | 「入站帧已被 edge 校验 sequence、出站帧以 sequence=0 占位由 edge 盖章；authorize 不在此调用，消费 edge 传入的预授权投影。session 对象随连接存活（终态不拆）」；_Avoid_：session 侧重检入站 sequence / 把连接级帧推入 session / session 感知 drain 窗口 / 引入 worker_threads/MessagePort 类型 | AC5 + C5c；AC4；§12.1 `open()` 描述子 = 「传入」字面的公共面兑现；「传入」措辞与 #418 实现的拉取式消费差距 → R7''/R8'' 文本调和义务 |
| 路由键契约（:233-235） | 定偏移事实集 + 结构性守卫测试锁死 | 本票零触碰 |

## 3. 规范协议（`docs/protocols/instance-replication-v1.md`）

| 节 | 条款 | 关联点 |
| --- | --- | --- |
| §4（帧头/连接序号） | 「sequence \| uint32，正常 frame 从 `1` 严格递增」；单连接每发送方向独立、不跨重连持久化 | A8（wire 序自 1 严格 +1、无 0 占位泄漏）；A5/A7/A9 的 ackedSequence 回指语义 |
| §7.1（OPEN_NAMESPACE） | 「Hub 必须先 authorization，再从 authorization 结果取得 local owner 并调用 Registry open」；「未授权不得泄露 namespace 是否存在」 | A4（authorize 恰一次在 edge；`registry.open(authorization.localOwner, nsId)`；deny → `NAMESPACE_UNAUTHORIZED`、注册表零打开） |
| §8/§9/§10/§11（bootstrap/reconcile/live/CLOSE） | BOOTSTRAP_ACK.ackedSequence = snapshot 帧序；SYNC_STEP1/2 → SYNC_APPLIED；UPDATE_ACK.ackedSequence 回指入站帧序；CLOSE_OK 同构 | A5/A6/A7/A9 断言全部为既有协议行为 |
| §13/§14（错误与 close 分类注册表） | `SEQUENCE_VIOLATION`→1002、`ACK_STATE_VIOLATION`→1002、`CONNECTION_BACKPRESSURE`→1011、`INTERNAL_ERROR`→1011；`NAMESPACE_UNAUTHORIZED` = ns 级 ERROR、terminal failed；注册表 append-only | C5b（edge 单点负控）、A12（红臂）、E1/E2 探针的失败面；本票零新码 |
| §17（背压/公平调度） | 水位闸门依赖 adapter `bufferedAmount`（缺面 = 退化为不可观察）；control 保留额度；1011 终局 | 决策 5 dormant 降级（U8：shim 形态 water gate 休眠与 listen「暂停」语义差须显式登记） |
| §19（Authorization/revoke） | 「授权只在 OPEN 时检查」；revoke → namespace 终止 ERROR + cleanup | A10（`terminateUnauthorized`）；`hub-session.ts:278-282` 既有无通道 no-op resolve |
| §23.1（事件词汇 36 型，append-only） | `update-acked{sequence}` = wire `UPDATE_ACK.ackedSequence`；`resync-required{cause:send-failed}` 子因 `send-frame-rejected` = 「未超限但**发送路径返回非正 sequence**」 | **`onFrame` 返回被分配 wire 序（0=未发送/被拒）的规范锚**：发送路径回传序是协议事件面的既有事实，不是新接纳信号；本票零新事件型 |

## 4. 其他 ADR / 模块规约

| 决策 | 关联点 |
| --- | --- |
| ADR 0010（hub-peer 复制架构权威） | 零 wire/生命周期变化；单份 FSM；ACK = sequenced live apply + dirty（A7 断言口径） |
| ADR 0012（实例身份与插件所有权） | `remoteInstanceId` = edge 认证后身份（HELLO 自报永不为认证证据）；工厂 `instanceId` 由宿主组合根注入 |
| `packages/ws-replication/AGENTS.md` | 「Export production APIs through `src/index.ts`」（S5/§12.0）；「Keep admission bounded across handshake, ready, backpressure, and drain windows」（S2/R4''）；注入 timer/scheduler（U10）；§21 收口权威（A11） |
| `docs/AGENTS.md` | 「Amend or supersede prior decisions explicitly instead of silently contradicting them」——ADR 0032 机制句/信号词汇调和必须正式落修订/澄清附录（R7''/R8''），不得静默矛盾 |

## 5. #418 跨票存续义务（SA8 报告账，`task_issue-418_implementation_conflict_report.md` §8）

| # | 义务 | 对本票的含义 |
| --- | --- | --- |
| R4'' | 有界缓冲义务在「引入真实跨线程 pending 状态的票」重新进入 | S2：宿主桥 pending 窗口必须有界 + 顺序保真；实现后核对 |
| R5'' | 「入站『已解码消息 + 序号』缝形态 + `openAdmission` 拉取形态与 OPEN 结局前过缝 + `channels`/`dataFacetOf` 组合成员重塑」随 worker 形态票重新过 SA8 前置门禁 | 本票把入站缝形态改为 `Uint8Array` 公共面 → 触发条件成立，**本次门禁即该复查的 task 段**；design/implementation 复查继续承接 |
| R7''/R8'' | ADR 0032:22 机制句与 CONTEXT.md:230 词条须在 worker 形态票 SA8 前置门禁**之前或之中**正式落 ADR 修订/澄清附录；在此之前任何票不得援引机制句字面迫使回退形态；触碰 port 成员集/DENY 面（含 `hub-namespace.ts`）/ADR/CONTEXT/协议文本 → 重新触发 SA8 | 本票公共面 + U3（拒绝路径归属）落在该 deadline 上；附录修订计划要素已在 #418 SA8 设计报告 §6 列全（修订文件/新旧语义/兼容/失败语义/验证锚/冻结面），SA6 U6 承接 |
| #418 R2（票内 DENY） | 「两工厂与缝类型不得进 `index.ts`/`testing.ts`」为 **#418 票内冻结门**（issue #418「零新公共 API」），已随 #418 实现闭合 | 不构成常设仓库决策；#420 的公共导出为 ADR 0032 后果节规划的工厂轨 + issue AC1 明文要求 |

## 6. 既有代码事实（用于确认，不替代决策文本）

- `packages/ws-replication/src/hub-split.ts`：内部缝 = `HubSessionEdgePort`（session→edge，17 成员，含 `sendControlFrame/sendDataFrame(frame): number`「返回 edge 盖章后的 wire 序；0 = 未发送/被拒」、`connectionFatal(code, wsCloseCode?)`「ACK_STATE_VIOLATION 等通道→连接收口（默认 close code 1002）」、`openAdmission`）+ `HubSessionSink`（edge→session：`openNamespace`/`namespaceFrame(message, sequence)`/`close`/`terminateNamespace`/`dataFacetOf`/`channels`）；头注列 4 生命周期信号 = `sink.close`/`sink.terminateNamespace`/`port.onChannelSettled`/`sink.close()` 的 promise。
- `packages/ws-replication/src/hub-namespace.ts:76,662,1099`：通道→连接 `connectionFatal('ACK_STATE_VIOLATION', 1002)` 既有路径（HEAD 起在场）。
- `packages/ws-replication/src/index.ts`：现公共运行时导出 11 名（SA6 §4 G1 一致）；追加 `createHubSessionHost` + 7 类型名 = append-only。
- `docs/**`、`CONTEXT.md` 对 `createHubSessionHost`/`HubSessionSink` 零引用（本轮 grep 核对）；`nomicoreHubSessionHost` 仅 ADR 0032:30（服务轨，本票 non-goal）。
