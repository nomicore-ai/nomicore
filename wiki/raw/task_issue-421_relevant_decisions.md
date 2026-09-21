# task_issue-421 前置门禁相关决策摘录（SA8）

- Issue：#421「Edge 公共工厂：accept 双入口 + OPEN 准入管线 + sequence 盖章（spec #415 T4）」（state=open）
- 被审对象：任务简报 `wiki/raw/task_issue-421.md` + SA6 验收契约 `wiki/raw/task_issue-421_sa6_contract.md`（含探针/变异驱动/4 份日志）
- 基线：HEAD `7039f6dae8e7d29f0c929492f0ca2119bc63afaa`（#418 T2、#419 T1 均已在基线内）
- 本文件只摘录与被审对象相关的决策、条款与关联点，不重写原义、不作业务设计。冲突裁决见 `task_issue-421_conflict_report.md`。

## 0. 决策集盘点（本轮全量扫描）

- `docs/adr/` 现存 0001–0030 + 0032，均无整体 superseded 标记。与复制传输相关的修订均为**条款级且文内自记**（如 ADR 0027 对 0016/0024 的条款取代，属 readData 域，与本票无关）。
- 编号 0031 不存在：commit `27e012b`「改号 0031→0032（0031 已由 PR #403 占用）」——纯改名，无语义更替；ADR 0032 是本票唯一治理决策。
- `docs/protocols/instance-replication-v1.md` 为规范 wire 契约；`CONTEXT.md` 为共享词表（docs/AGENTS.md 授权）；两包 `AGENTS.md` 收录模块级决策。
- Owner 评论 REST 快照为空（dispatch 明示 `[]`）——无评论级 override 来源。

## 1. ADR 0032（已接受，2026-09-21）——本票直接治理决策

| 条款 | 位置 | 与本票的关联点 |
|---|---|---|
| 决策 1：沿 `HubChannelHost` 内缝拆为 Edge/SessionHost 两可独立实例化模块；协议状态机单份实现；**宿主自写连接级半边 = fork 协议实现，否决** | L12–14 | EF 组「工厂 = 连接级半边的宿主出面」正落在该决策的授权面；SD-1 的「T2 内部工厂保留为实现细节」同源 |
| 决策 2：缝只过 namespace 域帧 + 纯 JSON + 4 控制信号；入站 sequence 由 edge 校验（header-only）；出站帧 session 以 sequence=0 占位、edge 在 mux 点重写 `[8..12]`——**wire 逐字节不变**；nomicore 零 worker_threads/MessageChannel 依赖 | L16–18 | WS-C1..C3（per-connection 严格递增 + 盖章字节等价）、RK-C3/WS-C2（同输入序列与单体逐字节相等）、GATE-C3/C4（replication-protocol 零 diff、零传输依赖） |
| 决策 3：edge 对 OPEN 全解码后即调用宿主注入 `NamespaceAuthorizer`；**未授权 OPEN 不过缝**，复现 `NAMESPACE_UNAUTHORIZED` wire 行为并持拒绝闩锁；**OPEN 准入管线（pending 有界缓冲、并发 OPEN 上界、sink 失败响亮连接收口、drain 门、session 对象随连接存活）全部为 edge 规范职责** | L20–22 | OAP-C1..C8 全组；G3–G7 即这些职责在「宿主缝（resolveSessionSink）」形态下的岗位缺口；机制句与 CONTEXT.md:230 的表述差 = #418 SA8 R7'' 存续义务（见 §5） |
| 决策 4：路由键 O(帧头) 定偏移提取（namespace 域帧 `[21..56)`、UPDATE_CHUNK `[22..57)`）；OPEN 走全解码；ERROR 特例有界 mini-decode；路由点文法校验并逐字节复现单体两分支（违例 → `MALFORMED_FRAME` fatal；合法无 sink → 合成 `NAMESPACE_STATE_VIOLATION`）；**路由键布局与 codec 字段序登记为同步维护契约 + 结构性守卫测试** | L24–26 | RK-C1..C3、ER-C1..C3；T1 守卫（#419 已落地）`codec-route-key-guard.test.ts` 登记 `ERROR_NS_PREFIX_BUDGET = 64`（实测最坏 46） |
| 决策 5：observer 发射点 = 拥有事实的一侧（连接域与出站 sequence 事件在 edge）；缺面 = dormant；`listen: false` 显式表达；SessionHost 服务（`nomicoreHubSessionHost`）仅免 listen 模式提供；`maxConcurrentAssembliesPerConnection` 分片形态降级 per-session 计数 | L28–30 | LC-C1..C4（settled 信号、dormant、ping/pong 凭据）；**listen:false / SessionHost 服务面不在本票范围**（简报未要求；#418 SA6 §28 明示属后续票） |
| 后果节：**edge 以普通工厂（`createHubReplicationEdge`）导出而非 Cordis 插件（无 Registry 依赖）**；免 listen worker 侧插件不消费 tokens/authorization/verifyToken/authorize；**公开面一经发布即按 SA6 纪律冻结，演进只能 append-only**；peer 侧对称拆分留待后续 | L39–44 | EF-C1（公共入口导出 + append-only 只增不减）、GATE-C4、§10 零改动面（peer/plugin.ts/replication-protocol） |
| 状态行：wire 格式与协议语义零变化、**listen 模式行为逐字节不变**、peer 侧不拆分 | L4 | GATE-C3（单体入站→出站逐字节不变） |

## 2. 规范协议 `docs/protocols/instance-replication-v1.md`

| 条款 | 位置 | 关联点 |
|---|---|---|
| §1 不变量 2（每方向 sequence 严格递增、uint32、不回绕）、3（每 namespace 帧直携 namespaceId）、4（同连接同 ns 唯一生命周期，终态后不得重开，重开须重建连接）、5（HELLO_ACK 前不得发 namespace 帧） | L15–22 | WS-C1..C3、OAP-C3②（重 OPEN 拒答 `NAMESPACE_REOPEN_REQUIRES_RECONNECT` = 不变量 4 的既有表达）、OAP-C1（`HELLO_REQUIRED`） |
| §2 建连认证：token 在 Upgrade 前验证并产生受信身份；HELLO 自述身份绝不被采信；宿主 accept 未提供受信身份 = 接线缺陷，响亮拒绝 | L35–46 | EF-C2（`acceptTrusted` 绑定 `identity.peerInstanceId`、HELLO 不得覆盖；accept 注入 verifyToken 复刻既有门）、EF-C3（早到帧 admission） |
| §3 固定 envelope：20 字节头、sequence 在 `[8..12]`、从 1 严格递增 | L47–52 | 决策 2 盖章面的字节载体；WS-C2 断言 |
| §13.1/§13.2 错误注册表（append-only）+ §14 WS close 粗分类（1002 协议错 / 1008 policy / 1009 超限 / 1011 内部错或 control backpressure） | L379–465 | OAP-C6（连接级 `INTERNAL_ERROR` fatal/yes/1011）、RK-C1（`MALFORMED_FRAME` 1002）、EF-C3（1008 `upgrade-frame-limit` / 1009 超限）、SD-2 候选码（`CONNECTION_POLICY_VIOLATION` 1008、`INTERNAL_ERROR` 1011 均在册）；**本票零新错误码** |
| §19 Authorization：adapter 形状 `authorizeNamespace → denied | allowed{localOwner, permissions{read,submit}}`；授权只在 OPEN 时检查；revoke 走在场通道终止 | L637–652 | OAP-C3（恰一次 authorize + 闩锁）、OAP-C8（`authorization` 参数 = ok 投影非摘要）、EF-C2 句柄面 `revokeNamespace` |
| §22 Conformance：byte-level golden、互通矩阵等 | L687–710 | 本票不改 wire，conformance 面零新增义务（GATE-C4） |

## 3. CONTEXT.md 词条（ADR 0032 派生）

| 词条 | 位置 | 关联点 |
|---|---|---|
| 复制 Edge：OPEN 准入（全解码 + authorize + **sink 路由**）为 edge 职责；不持有 Registry；连接级帧从不上缝；_Avoid_：宿主自实现连接级协议（= fork） | :225–227 | EF/OAP 组的职责边界与 SD-1 的「宿主出面」定性 |
| SessionHost：经 Uint8Array 帧缝对接；authorize 不在此调用、**消费 edge 传入的预授权投影**；session 对象随连接存活；_Avoid_：session 重检 sequence/感知 drain/引入 worker 类型 | :229–231 | 与 ADR 0032:22 机制句的**表述差**（实现为到达点投递 + 拉取式消费）= R7'' 文本调和义务（§5） |
| 路由键契约：定偏移事实集 + 守卫测试锁死；_Avoid_：完整 payload 解析取路由键 / 为路由改 wire | :233–235 | RK/ER 组；T1 守卫即该词条的落地 |

## 4. 模块与包决策（AGENTS 收录）

| 来源 | 条款 | 关联点 |
|---|---|---|
| `packages/ws-replication/AGENTS.md` | 生产 API 经 `src/index.ts`；协议状态机单份；hub 连接绑定 pre-upgrade 可信身份（`acceptTrusted` 收受信身份）；admission 在 handshake/ready/backpressure/drain 四窗口有界；§21 为停机权威 | EF-C1、EF-C2、OAP-C4/C5（有界性）、LC 组 |
| `packages/replication-protocol/AGENTS.md` | 注册表 append-only、不重编号不改义；codec 传输/Registry 无关；公共 API 仅经 `src/index.ts` | GATE-C4（零 diff 面）、零新错误码 |
| 根/`docs/AGENTS.md` | 引入或更改域术语须更新 CONTEXT.md；记录持久决策用 ADR；显式修订而非静默矛盾 | 实现票的 docs-sync 义务（见冲突报告行动 A5） |

## 5. 跨票义务账（#418 SA8 已登记，wiki/raw 证据、流程约束）

| id | 义务 | 状态 × 本票 |
|---|---|---|
| R4'' | pending 有界缓冲义务在 #418 对其新增面就地了结；**引入真实「解析在途」pending 状态时重新进入**（#418 design §13 R2/§654） | **本票重新进入**：`resolveSessionSink` 造成宿主解析在途窗口（AC2 明示 pending 有界缓冲 + 序保冲刷 = ADR 0032:22 的直接兑现） |
| R5'' | worker 形态（跨进程传输、入站缝形态、`openAdmission` 拉取形态）重新过 SA8 前置门禁 | 维持：SA6 §15-4 划归 T5/后续；本票契约不预设跨线程实现 |
| R7'' | ADR 0032:22 机制句 ↔ CONTEXT.md:230 词条的**文本调和附录**须在 worker 形态票 SA8 前置门禁之前或之中落地；在此之前**任何票不得援引机制句字面**迫使回到「缓冲丢弃/edge 复现/结算回放」形态；Host documentation-only 先行附录可选 | 存续、deadline 不变（T5 门禁）；SA6 OAP-C3① 以宿主缝可观察行为落实（wire 帧 + 回调零调用 + 不建会话），未援引字面强制内部形态——合规；若 SD-1 设计重塑内缝则 deadline 提前（见冲突报告行动 A2） |
| R8'' | 触发即重跑 SA8 implementation 复查：port 成员集增删、`HubOpenAdmission` 结局词汇变化、promise reject 面扩大、路由/drain 事实源改读 channels 投影、DENY 面（含 `hub-namespace.ts`）diff、决策文本变更 | 对 SD-1 的两条装配路径构成硬约束：触碰任一条 → 重触发 |

## 6. 支撑性 ADR（上下文，不直接约束本票形态）

- ADR 0010（已接受）：hub/peer 静态拓扑、owner 不上 wire、ACK 语义——本票零触碰其条款；ADR 0032 在其上做结构拆分且声明 wire 语义零变化。
- ADR 0012（已接受）：instanceId+role 单一真相、插件所有权——与「edge 工厂非 Cordis 插件、无 Registry 依赖」（ADR 0032:41）正交兼容。
- ADR 0013/0022（已接受）：分块传输——`UPDATE_CHUNK` kind 首字段（路由键 `[22..57)` 的成因）与 assembly limits（`maxConcurrentAssembliesPerConnection` = 分块 assembly 上界，**与 OPEN 并发上界是两个面**，types.ts:44–52）。
