# task_issue-421 设计 — Edge 公共工厂：accept 双入口 + OPEN 准入管线 + sequence 盖章（spec #415 T4）

- Issue：#421（state=open；Issue updated at 2026-09-21T18:08:39Z）
- 任务类型：**Feature**（能力缺口 = 连接级半边无公共出面：工厂未导出、无 accept/acceptTrusted 双入口、无宿主 `resolveSessionSink` 回调、OPEN 准入管线四个分支无岗位）
- 基线：HEAD `7039f6dae8e7d29f0c929492f0ca2119bc63afaa`（#418 T2 拆分、#419 T1 路由键守卫均在基线内；git 亲测）
- 上游输入：任务简报 `wiki/raw/task_issue-421.md`；SA6 验收契约 `wiki/raw/task_issue-421_sa6_contract.md`（approve，含探针/变异驱动/4 份日志）；SA8 摘录 `wiki/raw/task_issue-421_relevant_decisions.md`；SA8 冲突报告 `wiki/raw/task_issue-421_conflict_report.md`（task 门禁 verdict=clear）；**SA8 设计后复审 `wiki/raw/task_issue-421_design_conflict_report.md`（verdict=reject，阻断 A1/A2 + 登记 A3/A4/A5）**；**SA2 攻击评审 `wiki/raw/task_issue-421_sa2_review.md`（verdict=reject，2 BLOCKER + 3 MAJOR + 1 MINOR，R1–R6）**
- 本设计为**迭代 1 修订版**：原位重写迭代 0 首版，逐条落实 SA2 R1–R6 与 SA8 A1–A5（映射见 §15）；全文只描述当前一致设计，不含历史版本残留
- 本设计不实现代码、不编写验收测试；实现与测试由后续角色按本文件落地
- 迭代 0 → 迭代 1 的关键结构变化（详情见 §15）：(1) 新增内部模块 `hub-upgrade-admission.ts` 承接早到帧 admission 搬迁（SA8 A1 选项 α，消 L616 冻结冲突）；(2) 既有 #418 契约测试 C5a 冻结清单获得**限定性 append-only 更新**授权（SA2 R1，消 FROZEN_PRODUCTION_EXPORTS 冲突）；(3) pending 冲刷按 kind 分派 + 终局按缓冲 OPEN 数逐帧应答（SA2 R3）；(4) 准入结算续体补 reject 处理与连接收口守卫（SA2 R4）；(5) 宿主 sink 四成员的 throw/reject 纪律定义（SA2 R5）；(6) upgrade 门 6/7 次序对齐单体（SA2 R6）

---

## 1. 目标与非目标

### 目标

1. **AC1**：`createHubReplicationEdge` 以普通工厂从 `@nomicore/ws-replication` 公共入口导出（非 Cordis 插件、无 Registry 依赖；ADR 0032:41），返回带 `accept(transport, { token })` / `acceptTrusted(transport, identity)` 双入口的宿主级工厂对象；签名经 test-d 锁定；公共导出面相对 HEAD 11 个运行时导出 append-only 只增不减。**落地前提（R1）**：既有 #418 契约测试 C5a 以 `toEqual(FROZEN_PRODUCTION_EXPORTS)` 精确冻结 11 名运行时导出清单（「增删均红」，`ws-replication-issue418-edge-session-split-contract.test.ts:144–156,551`）——本设计将该测试文件的**限定性 append-only 更新**（清单追加 `'createHubReplicationEdge'` 一名，零删除）纳入 ALLOW LIST 并登记授权理由（§10/§15-R1）；不更新该清单则 AC1 与 GATE-C1 不可兼得。
2. **AC2**：OPEN 准入管线全分支落地（按序）：HELLO/drain 门 → 全解码（畸形 ingress 收口）→ authorize（拒绝 = ns 级 `NAMESPACE_UNAUTHORIZED` + 拒绝闩锁，重 OPEN 拒答 `NAMESPACE_REOPEN_REQUIRES_RECONNECT`；未授权 OPEN 不过宿主缝）→ pending 有界缓冲（序保冲刷，**按 kind 分派投递面**）→ 并发 OPEN 上界收口 → sink 解析失败响亮连接收口（连接级 `INTERNAL_ERROR` + 1011，零新错误码）→ 已建立会话转发。宿主回调 `resolveSessionSink(connectionKey, namespaceId, authorization)` 在 OPEN 授权通过后调用。pending 期合流的重 OPEN 与迟归/异常结算语义按 §7-D3/§8.2 修订版（R3/R4）。
3. **AC3**：路由键文法校验两分支逐字节复现单体语义（违例 → 连接级 `MALFORMED_FRAME` fatal 1002；合法无 sink → 合成 ns 级 `NAMESPACE_STATE_VIOLATION`，连接存活）。
4. **AC4**：ERROR 帧 mini-decode 有界扫描路由正确（连接级 ERROR 不路由；消费 T1 守卫登记的布局契约 `ERROR_NS_PREFIX_BUDGET = 64`）。
5. **AC5**：出站 sequence 盖章对外可见——多会话（多宿主 sink）并发帧经 mux 后 per-connection 从 1 严格递增；同输入序列下工厂形态与单体出站帧逐字节一致。
6. **AC6**：liveness/GOAWAY/reauth/drain 提前完成观测在工厂形态单测覆盖（settled 信号驱动）。

### 非目标（显式排除）

- `listen: false`、`nomicoreHubSessionHost` 服务面、SessionHost 工厂公共导出（SA8 §3 行 6 / A6：后续票；本票不预留）。
- peer 侧对称拆分（ADR 0032:44：后续迭代）。
- worker_threads/MessageChannel 传输形态、入站缝跨线程形态、`openAdmission` 拉取形态重塑（#418 design §654 / R5''：T5 重新过 SA8；本设计的公共面不得预设跨线程实现，见 §7-D1）。
- 工厂级服务面聚合（`connections` 列表、按身份 `revoke`/`requestReauth` 广播、工厂级 `close()`）：单体 `HubReplication` 的服务面不在本票范围；宿主自行持有 `accept` 返回的句柄并以 `connectionKey` 关联（见 §7-D7）。
- wire 格式、错误注册表、close 分类、消息注册表的任何变化（GATE-C4 零 diff）。
- R7'' 文本调和附录（ADR 0032:22 ↔ CONTEXT.md:230）：deadline 维持 worker 形态票（T5）SA8 前置门禁之前或之中；本设计不援引机制句字面（SA8 A2），亦不主动提前落地该附录。
- **既有 588 测试的语义、条目数、断言强度零变化**；唯一授权触碰 = C5a 冻结清单 append-only 追加一名（§10 ALLOW LIST 限定行；R1）。早到帧 admission 搬迁不触碰 structure.test 任何断言（L616–619 全绿保持，R2/SA8-A1 选项 α）。

---

## 2. 当前行为与证据锚点（HEAD 实况）

### 2.1 连接级半边的现行实现（T2 内部形态，正确且全绿）

| 事实 | 锚点 |
|---|---|
| `createHubReplicationEdge(config)` 仅模块级导出，公共入口无此名（G1；消费者路径 `typeof === 'undefined'`，类型层 TS2724） | `packages/ws-replication/src/hub-edge.ts:788`；`src/index.ts`（11 个运行时导出，无工厂）；SA6 契约 §5/§14 |
| **公共导出面被 #418 契约测试精确冻结**：`FROZEN_PRODUCTION_EXPORTS` 11 名清单 + `toEqual`（增删均红）；经 `import * as productionApi from '@nomicore/ws-replication'`（`nomicore-source` 条件解析到 src/index.ts） | `test/ws-replication-issue418-edge-session-split-contract.test.ts:50`（import）、`:144–156`（清单）、`:551`（断言）；R1 证据（本轮亲核） |
| **`hub-connection.ts` 模块运行时导出面被 structure.test C0c 精确冻结**：`Object.keys(hubConnectionModule).sort()` == `['createHubReplication']`；同 it 块还冻结 edge/session/split 三模块键面（L616–619） | `test/ws-replication-issue418-edge-session-split-structure.test.ts:34`（import）、`:616–619`；R2/SA8-A1 证据（本轮亲核） |
| 内部 edge 配置面：pre-verified `peerInstanceId` + **构造期一次性** `sessionFactory(port)` 装配唯一 sink（G3 结构前提） | `hub-edge.ts:56–78`（`sessionFactory` L75，构造期调用 L173） |
| accept/acceptTrusted 双入口 + upgrade 门只存在于服务层组合根 `HubReplicationImpl`（G2）；门序 = 门 0 停接纳 → 门 1 缺凭据 → 门 2 无认证器 → 门 3 早到帧 admission → auth timer → 门 4 verifyToken（恰一次）→ **微任务让位 + 迟拒兜底复查 → instanceId 文法** → 门 5 世界变化 → 分配（文法检查在让位复查**之后**，`hub-connection.ts:304–315`） | `hub-connection.ts:242–334`（accept）、`336–379`（acceptTrusted） |
| 早到帧有界 admission 是**自包含符号族**：`MAX_EARLY_FRAMES=16`（L54）、`EarlyFrameAdmission` 接口（L76–87）、`installEarlyFrameAdmission`（L89–133）、`closeAdmission` 守卫（L144–151，仅被前者内部调用 2 处）——对 `hub-connection.ts` 其余部分零耦合，可整体搬迁 | `hub-connection.ts:44–151`；R2/SA8-A1 选项 α 可行性证据（本轮亲核） |
| 首个 OPEN 到达点：① 建台账（唯一真实 authorize）→ ② 无条件立即投递 `sink.openNamespace`；再 OPEN 只投递 | `hub-edge.ts:323–328`；台账 `141`；`beginAdmission` `338–360`（入参 = `(authenticatedInstanceId, namespaceId)`，`!ok ∨ !read` 单分支折叠，同步 throw 与异步拒绝同归 `throw` 结局） |
| 准入结局经缝异步拉取；台账缺失 → 响亮 reject（不变量破坏） | `hub-edge.ts:363–369`；`hub-split.ts:57–64`；session 侧 shim `hub-session.ts:105–111` |
| 路由键定偏移（ns 域帧 `[21..56)`、UPDATE_CHUNK `[22..57)`；前缀字节校验 + 解码值一致性断言）；违例 → 连接级 `MALFORMED_FRAME` + 1002；合法无台账 → 合成 ns `NAMESPACE_STATE_VIOLATION` + 连接存活 | `hub-edge.ts:558–567`（`routingKeyOf`）、`533–549`（三案路由）、`570–586`（R-none 合成 + `namespace-error{sent}` 事件；`namespaceErrorFrame` 无 `relatedSequence`——`frame-io.ts:45–53`） |
| ERROR 特例：无 nsId / 未知 ns（无台账）→ 静默丢弃；台账命中 → 投递 | `hub-edge.ts:526–532` |
| 出站盖章单点：session 以 sequence=0 占位编码，`OutboundQueue.emitOne` 在 mux 点重写 `[8..12]`（大端）；序列号在出队时分配、控制恒先 | `frame-io.ts:146–155,178–197,200–205`；`hub-session.ts:257–263`（`encodePlaceholder`） |
| drain 门（REAUTH 窗口丢 OPEN/BOOTSTRAP_ACK/SYNC/RESYNC/UPDATE/UPDATE_CHUNK；CLOSE 族照常路由）+ settled 驱动提前收口（判定式 = 全部台账 ns ∈ settled 集） | `hub-edge.ts:495–512`、`704–710` |
| GOAWAY/reauth：handshaking 直 close(1001)；ready 后 GOAWAY(REAUTH_REQUIRED, drainTimeoutMs=closeTimeoutMs) + deadline 1001；幂等 | `hub-edge.ts:270–296` |
| liveness：ping/onPong 齐备才武装；8 字节凭据逐字节匹配才清超时；缺面 dormant | `hub-edge.ts:443–476`；`liveness.ts` |
| 连接级 fatal 拓扑：直发 ERROR（豁免额度）→ closedFlag → sink quiesce 前缀 → transport.close(wsCloseCode,'protocol-error') → observer `connection-failed` → cleanupAll | `hub-edge.ts:619–645`；close 分类映射 `101–105` |
| 连接收口清理链：`cleanupAll` → `settleTail = requestSinkClose().then(()=>undefined)` → `await settleTail` → `onConnectionDropped()`——**settleTail 若 reject 则 onConnectionDropped 被跳过且产生 unhandled rejection**（`hub-connection.ts:136–141` 注释明示本仓已识别的 unhandledRejection 进程级风险） | `hub-edge.ts:599–617`；R5/ER-3 依据（本轮亲核） |
| 单体 listen 组合根：`createEdge` 注入 authorize/Registry，`sessionFactory = createHubSessionHost` | `hub-connection.ts:429–463` |

### 2.2 会话侧（session 半边 + 通道 FSM，本票零改动面）

| 事实 | 锚点 |
|---|---|
| 到达点建通道（`channels.set` 在返回前完成，锁步不变量） | `hub-session.ts:84–94` |
| **opening 期合流语义**：再 OPEN → `openWaiters.push`（不重复 authorize/Registry open）；授权通过 → `flushOpenWaitersOk` **按 waiter 数逐 OPEN 应答 OPEN_OK**；deny/throw → `finishOpenError` **按 waiter 数逐 OPEN 应答 ERROR** + `namespace-error{sent}` **恰一**（HB2：不按 waiter 数）+ 迁移 failed 时 `namespace-failed{cause}` 恰一 + `notifySettled` | `hub-namespace.ts:289–331`（onOpen 状态矩阵）、`474–481`（flushOpenWaitersOk）、`483–503`（finishOpenError）；R3 单体语义依据（本轮亲核） |
| **open 续体中止判别**：authorize deny/throw/registry 异常各恢复点均先查 `isOpenAborted()`（终态 ∨ closing）→ `finishOpenSilently`（零 wire、零状态迁移、零事件、**零 settled 通知**——仅资源回收）；否则 `finishOpenError`（响亮） | `hub-namespace.ts:347–349,356,505–527,529–534`；R4 守卫语义依据（本轮亲核） |
| 台账缺失（不变量破坏）：shim `pullAuthorization` reject → `startOpen` catch → `finishOpenError('INTERNAL_ERROR')`（响亮、有 wire 分类，连接存活） | `hub-session.ts:105–111`；`hub-namespace.ts:347–349`；R4(a) 依据 |
| 终态闩锁：closed/conflicted/failed 再 OPEN → ns `NAMESPACE_REOPEN_REQUIRES_RECONNECT`（仅 wire 帧，无事件）；opening 再 OPEN → waiter 合流 | `hub-namespace.ts:297–300,317–320`；`sendChecked` 无事件 `1656–1672` |
| 终态/静默态收帧静默忽略（quiet = closing/closed/conflicted/failed）；**opening 收 UPDATE → 即答 ns `NAMESPACE_STATE_VIOLATION` + finalize('failed','protocol-violation')**（到达点即答，不缓冲） | `hub-namespace.ts:1736–1746`（isQuietState）、`839–848`（onUpdate）；§13-1 分歧登记的单体侧依据 |
| session 出站 data 前置：connectionState 门 → dataGateOpen 门 → 占位编码 → 缝 | `hub-session.ts:210–216` |
| **revoke/收口的异常归一**：`terminationSettled()` = `cleanupTail.then(()=>undefined,()=>undefined)`（吞清理异常，revoke 恒 resolve——红灯 #7/#8 断言）；`close()` = `Promise.all(全通道 onConnectionClosed).then(()=>undefined)`（通道侧内部归一，永不 reject） | `hub-namespace.ts:1717–1734`；`hub-session.ts:269–276`；R5/ER-3/ER-4 单体纪律依据（本轮亲核） |

### 2.3 错误注册表（append-only 深冻结，本票零新码）

| 码 | 元数据 | 锚点 |
|---|---|---|
| `CONNECTION_POLICY_VIOLATION` | connection / fatal / config / **1008** | `replication-protocol/src/errors.ts:114` |
| `INTERNAL_ERROR` | connection / fatal / yes / **1011** | `errors.ts:117` |
| `NAMESPACE_REOPEN_REQUIRES_RECONNECT` | namespace / fatal / reconnect / closed | `errors.ts:122` |
| `NAMESPACE_UNAUTHORIZED` | namespace / fatal / config / failed | `errors.ts:123` |
| `NAMESPACE_STATE_VIOLATION` | namespace / fatal / no / failed | `errors.ts:128` |

---

## 3. 能力缺口（承接 SA6 §8，G1–G9）

| id | 缺口 | 设计响应 |
|---|---|---|
| G1 | 公共入口未导出 `createHubReplicationEdge` | §7-D1 新公共工厂模块 + `src/index.ts` append-only 导出（§10 文件范围，**含 C5a 冻结清单限定性同步**） |
| G2 | 连接级半边无 accept/acceptTrusted 双入口 | §7-D4 双入口复刻（upgrade 门序逐点继承 `hub-connection.ts`，含门 6/7 次序修正——R6） |
| G3 | 无宿主回调 `resolveSessionSink`（构造期单点 `sessionFactory`） | §7-D2 宿主缝：回调 + 每 (连接, ns) sink + egress 出站面（含四成员异常纪律——R5） |
| G4 | 未授权 OPEN 直达 session 半边 | §7-D3 准入管线：authorize 拒绝在宿主缝之前收口（回调零调用、不建会话、edge 侧合成 deny 帧 + 闩锁） |
| G5 | 无 pending 有界缓冲/序保冲刷 | §7-D3 阶段 4（连接级共享有界 FIFO，溢出响亮收刷；**冲刷按 kind 分派**——R3） |
| G6 | 无并发 OPEN 上界 | §7-D3 阶段 5（`MAX_CONCURRENT_OPEN_ADMISSIONS = 4`，超额 `CONNECTION_POLICY_VIOLATION`/1008） |
| G7 | sink 解析失败无响亮连接收口（hub 半边连接级 `INTERNAL_ERROR`(1011) 零发射点） | §7-D3 阶段 6（`resolveSessionSink` throw/reject → `connectionFatal('INTERNAL_ERROR', 1011)`） |
| G8 | 目标语义只在内部半边/单体被验证，公共工厂形态零覆盖 | §12 验收映射（7 个新测试文件 + test-d + 新增交错/守卫/异常用例） |
| G9 | 本票测试入口不存在 | §10 ALLOW LIST（SA6 §12.0 路径原样采用 + §12 增补行） |

**排除项**（SA6 §8 已证）：现行协议语义缺陷（O1–O8 全绿）、wire/注册表缺陷（T1 守卫 + ER 组绿）、环境缺失（基线 588 测试绿）——均不在本票修复面。

---

## 4. Owner 要求落实

Issue 评论 REST 快照为空（dispatch 明示 `[]`）——无评论级要求，无 override 来源。Owner 要求 = Issue 正文，逐项映射：

| Issue 正文条目 | 设计章节 |
|---|---|
| 导出 `createHubReplicationEdge` 普通工厂（非 Cordis 插件、无 Registry 依赖） | §7-D1、§8.1、§10（含 C5a 同步） |
| `accept(transport, { token })`（内部跑注入的 verifyToken） | §7-D4、§8.3 |
| `acceptTrusted(transport, identity)` | §7-D4、§8.3 |
| 出站 sequence 盖章对外可见（多会话并发帧经 mux 后 per-connection 严格递增） | §7-D2（egress 面）、§8.4 |
| OPEN 准入管线全分支 | §7-D3、§8.2 |
| 路由键提取与无 sink 帧两分支 | §8.5（内部 edge 零改动复用 + no-sink 分支落点） |
| ERROR mini-decode（消费 T1 守卫的布局契约） | §8.5（内部 edge 零改动复用） |
| 宿主回调 `resolveSessionSink(connectionKey, namespaceId, authorization)` 在 OPEN 授权通过后调用 | §7-D2、§8.2 阶段 4/7 |
| AC1–AC6 | §12 验收与验证映射 |

---

## 5. 复现和根因承接

| 上游事实 | 证据位置 | 设计响应 |
|---|---|---|
| 能力缺口 7/7 运行期实测（G1–G7）+ 类型层/消费者路径双观察面 | SA6 契约 §5；`artifacts/sa6-issue421-probe-green.log`（5 轮一致）；探针 `wiki/raw/task_issue-421_sa6_capability_probe.mts` | 缺口即设计目标（§3）；断言面按 SA6 §12 原样承接 + 本迭代增补（§12） |
| 目标语义 oracle O1–O8 + 负控 NC1–NC4 全绿（内部半边/单体） | 同上 | 工厂形态落地后必须直接绿（GATE-C3）；设计保证语义载体为同一份内部 edge 实现（§7-D1） |
| 变异敏感 7/7 ×2 轮（M1–M5 点亮、NM1/NM2 全绿） | `artifacts/sa6-issue421-mutation-sensitivity.log` | 断言面不锁实现写法；设计的伪代码不构成断言依据 |
| 缺口是前序票显式推迟的结构性结果（导出面 + 跨线程 pending 义务重新进入 + 入站缝形态重新过 SA8） | #418 design §654 Follow-up 行；#418 SA6 §28/§351 U4 | 本票 = 该后续票；范围与 #418 留白逐项对齐（§1 非目标） |
| `ERROR_NS_PREFIX_BUDGET = 64`（实测最坏 46）已由 T1 守卫登记 | `packages/replication-protocol/test/codec-route-key-guard.test.ts:67,322` | 工厂复用内部 edge 的 ERROR 路由（零改动）；ER-C1 消费该预算（§12） |
| spec #415 全文不在库（分支 tip == HEAD、全树无 `*415*` 文件） | SA8 冲突报告 §2 | 简报「What to build」是 T4 唯一规范文本；T4/T5 边界取 #418 design §654 + ADR 0032 后果节 |
| **SA8 设计后复审 reject（A1/A2 阻断）**：`hub-connection.ts` 可见性导出计划击穿 structure.test L616；证据链四处失真 | `task_issue-421_design_conflict_report.md` §3 行 16、§8-A1/A2 | 本迭代采**选项 α**（搬迁至新内部模块 `hub-upgrade-admission.ts`，模块键面不变）；§7-D1/§10/§11/§13-8 全部按修订后方案重写（§15-SA8 映射） |
| **SA2 攻击评审 reject（R1/R2 阻断）**：index.ts 新增导出击穿 C5a 冻结清单；「588 测试零改动全绿」自相矛盾 | `task_issue-421_sa2_review.md` §13 R1/R2 | C5a 冻结清单 append-only 限定更新纳入 ALLOW LIST + 授权理由登记；DENY/GATE/调用方矩阵/回滚面四处一致化（§15-R1） |

## 6. SA8 约束落实

| 决议或义务 | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|
| ADR 0032 决策 1：协议状态机单份；宿主自写连接级半边 = fork，否决 | §7-D1 | 公共工厂 = 内部 `HubReplicationEdgeImpl` 的宿主化包装（每 accept 一个内部 edge 实例）；连接级 FSM（HELLO/sequence/路由/drain/liveness）零复现 | 否（实现既有决策；发布后由设计后复审核对） |
| ADR 0032 决策 2：wire 逐字节不变；缝只过 Uint8Array 帧 + 纯 JSON + 4 控制信号；出站 sequence=0 占位 + mux 点重写 `[8..12]` | §7-D2、§8.4 | egress 面字节形态（占位编码帧 → 盖章）；RK-C3/WS-C2 双形态逐字节对比锁定（§12） | 见 §14（发布面核对） |
| ADR 0032 决策 3：authorize 在 edge 单点；未授权 OPEN 不过缝 + 拒绝闩锁；OPEN 准入管线（pending 有界缓冲、并发 OPEN 上界、sink 失败响亮连接收口、drain 门、session 随连接存活）全为 edge 规范职责 | §7-D3 | 管线全分支落地为公共 edge 产品的岗位；「不过缝」按 SA6 H4 读法 = 不调用宿主回调/不建会话（不援引机制句字面） | 见 §14 |
| ADR 0032 决策 4：路由键定偏移 + 两分支逐字节复现单体 + ERROR 有界 mini-decode + 布局同步维护契约 | §8.5 | 内部 edge 现行实现零改动复用；T1 守卫持续背书 | 否 |
| ADR 0032 决策 5：观测纪律（连接域事件在 edge；缺面 dormant） | §8.2/§8.6 | deny/throw 观测面在工厂内逐事件复刻；wheel/facet 缺省降级登记 | 否 |
| ADR 0032 后果节：edge 以普通工厂导出；公开面发布即冻结、演进 append-only | §7-D1、§10、§13 | index.ts 仅 append-only 新增；公共类型面最小化（§7-D2 备注）；**C5a 冻结清单同步更新 = 该冻结纪律的测试侧表达**（append-only 一名，§10 限定行） | 是（公共 API 面首发布） |
| 协议 §13/§14：注册表 append-only；close 粗分类；本票零新错误码 | §7-D3 阶段 5/6、§8.6 | 全部复用既有注册表码（§2.3）；GATE-C4 | 否 |
| 协议 §2：Upgrade 受信身份；HELLO 自述不采信；缺受信身份响亮拒绝（**含「同步 TypeError」括注**） | §7-D4（门 2 读法登记） | 硬核兑现（fail-closed、绝不匿名/不采信自述）；「同步 TypeError」形态在工厂面**不可达且不应达**——`verifyToken` 为双入口条件依赖（`acceptTrusted` 零消费，EF-C2），构造期无法判别入口；「accept 永不 reject」是冻结不变量（异步面 sync TypeError = rejected promise 即违之）；单体对同一 JS 层条件的运行期形态恰为 1008 + `undefined`（`hub-connection.ts:263–267`），工厂逐字节复刻（SA8 设计报告 §3 行 10 裁决原样采纳） | 否（读法已登记） |
| 协议 §19：adapter 形状；授权只在 OPEN 检查；`authorization` = ok 投影 | §7-D2 | 回调第三参 = `Extract<NamespaceAuthorization, { ok: true }>`（localOwner/permissions，非摘要） | 否 |
| R4''（pending 缓冲义务重新进入） | §7-D3 阶段 4 | `resolveSessionSink` 造成真实解析在途窗口 ⟹ 有界缓冲就地兑现 | 否 |
| R5''（worker 形态重新过 SA8） | §1 非目标 | 本票公共面不预设跨线程实现 | 否 |
| R7''（不得援引 ADR 0032:22 机制句字面；文本调和 deadline = T5 门禁前/中） | §7-D3、§1 | 宿主缝语义以 wire 可观察行为 + 回调门控定义；附录不提前、不推迟 | 否 |
| R8''（触碰 port 成员集/结局词汇/reject 面/事实源/DENY 面 → 重触发 SA8 implementation 复查） | §7-D1、§10 DENY LIST | `hub-split.ts`/`hub-edge.ts`/`hub-session.ts`/`hub-namespace.ts` 零 diff；`hub-connection.ts` 仅**符号搬迁的导入路径迁移**（模块键面、行为、单体 wire 输出零变化，§15-SA8/A1）——不落入 R8'' 清单任何条目，但列入 §14 复核面 | 见 §14 |
| SA8 A1（SD-1~SD-6 落定） | §7 D1–D6 | 逐项落定并登记理由 | 见 §14 |
| SA8 A5（docs-sync：`resolveSessionSink`/`connectionKey` 域术语 → CONTEXT.md） | §10 ALLOW LIST | 实现票同步「复制 Edge」词条（追加宿主出面句）；**改动限于该词条**，不触 SessionHost 词条（:229–231）机制措辞、不复述 ADR 0032:22 机制句 | 否 |

---

## 7. 设计决策与主要备选方案

### D1（SD-1）装配形态：公共工厂 = 新模块包装**未改动**的内部 edge（Architecture-C）

**决策**：新增模块 `packages/ws-replication/src/hub-edge-host.ts`，导出公共工厂 `createHubReplicationEdge(options: HubReplicationEdgeOptions): HubReplicationEdgeFactory`。每次 `accept`/`acceptTrusted` 成功分配**一个**内部连接实例：工厂以 `sessionFactory: (port) => new HostSessionAdapter(port, …)` 调用 `hub-edge.ts` 模块级的每连接构造器（新模块内 `import { createHubReplicationEdge as createEdgeConnection } from './hub-edge.js'` 消歧）。`HostSessionAdapter` 实现 `HubSessionSink`（缝类型零改动），承载 T4 准入管线状态（§8.2），并把 `HubSessionEdgePort` 的出站/控制成员重暴露为公共 egress 面（§7-D2）。

**理由**：

1. **协议状态机单份**（ADR 0032 决策 1 + 否决备选「单体与拆分双实现并存」）：HELLO/协商/sequence/路由键/drain/liveness/收口拓扑全部复用 `HubReplicationEdgeImpl`，连接级 FSM 零复现。RK/ER/WS/LC 组语义「落地后直接绿」由同一份实现结构性保证。
2. **冻结面触碰收敛到两处显式授权点（R8'' + SA8-A1/A2 修订版表述）**：`hub-split.ts`（port 成员集、`HubOpenAdmission` 结局词汇）、`hub-edge.ts`、`hub-session.ts`、`hub-namespace.ts`（DENY 面）全部零 diff；`hub-connection.ts` 仅做**早到帧 admission 符号族的搬迁消费**（§7-D4 门 3 + §10，模块运行时导出面保持 `['createHubReplication']` 单键——structure.test L616 保持绿，零断言改动）；#418 的 C0a–C0d 结构/契约/窗口矩阵测试中，**C0c 的 L616–619 四条模块键面断言全部保持绿**（本轮逐条核对：hubConnection/edge/session/split 四模块键面均不变），C5a 冻结清单获 append-only 一名追加（§10 限定行）；单体 `createHubReplication` 的 wire 行为零变化（GATE-C3：导入路径迁移不改行为，早到帧 admission 符号族逐字搬迁）。
3. **SA6 SD-1 建议原样采纳**：「公共工厂 = 连接级半边的宿主出面（accept 双入口 + 每次 accept 分配一个 edge 实例 + 注入 authorize/verifyToken）；T2 内部工厂可作为其实现细节保留」；两条装配路径（工厂形态 vs 单体 listen）并存，等价由 RK-C3/WS-C2 双形态逐字节对比锁死（§12）。
4. **准入结局拉取机制复用**：`HostSessionAdapter` 经 `port.openAdmission(nsId)` 拉取内部 edge 的唯一真实 authorize 结局（`hub-edge.ts:363–369`）——authorize 每 (连接, ns) 恰一次、台账先于投递、迟归结算照常传播（D5.6）全部继承；`openAdmission` 的 reject 面（台账缺失 = 锁步不变量破坏）在本设计有分类结局（§8.2 `settleAdmission` catch——R4a，对齐单体 shim reject → `startOpen` catch → ns `INTERNAL_ERROR`）。

**备选否决**：

- **Architecture-A（扩展 `HubReplicationEdgeImpl` 支持双模式）**：内部 edge 需增配置联合与路由事实源分叉（台账 vs 已解析 sink 表），dual-mode 复杂度侵入已冻结的单体路径；`hub-edge.ts` diff 触碰 #418 白盒锚与 R8'' 复查面。收益（少一层包装）不抵风险。
- **Architecture-B（新连接类复用叶子件、复写连接级 FSM）**：HELLO/协商/sequence/drain/liveness 在第二处实现 = 协议状态机实质两份，正是 ADR 0032 否决的「双实现并存」形态。否决。
- **Architecture-重构（改 T2 工厂签名/缝类型）**：SA8 §6 条件性演进——需完整契约修订计划 + R7'' 附录提前；#418 C0a/C0b 返工。收益为零（包装形态已满足全部 AC）。否决。
- **（迭代 0 已否决、迭代 1 复核维持）`hub-connection.ts` 模块级导出 `installEarlyFrameAdmission`**：函数值导出使 `Object.keys(hubConnectionModule)` 变 2 键 → structure.test L616 必红（SA8 设计报告 §3 行 16 / SA2 R2）。已改为搬迁方案（下条）。

**早到帧 admission 单点复用（R2/SA8-A1 选项 α，本轮采纳）**：`installEarlyFrameAdmission` / `EarlyFrameAdmission`（类型）/ `MAX_EARLY_FRAMES` / `closeAdmission` 四符号是自包含符号族（`hub-connection.ts:44–151`，`closeAdmission` 仅被前者内部调用），**逐字搬迁**至新内部模块 `packages/ws-replication/src/hub-upgrade-admission.ts`（模块级导出，供包内消费；**不进 `index.ts`**——零新公共 API）。`hub-connection.ts` 与 `hub-edge-host.ts` 均从该模块导入——#190「同一机制单点」纪律保持（三个消费点共享同一实现）；`hub-connection.ts` 的模块运行时导出面不变（L616 绿）。备选：(β) `hub-connection.ts` 零 diff + 工厂自实现早到帧 admission——放弃机制单点，需补等价性守卫测试，侵入性反而更高，否决；(γ) 显式修订 L616 期望集——触碰 #418 合并冻结测试且违反本设计自设零改动纪律，最不优选，否决（SA8 设计报告 §8-A1 同判）。

**命名冲突处置**：`hub-edge.ts` 模块级 `createHubReplicationEdge`（每连接构造器，#418 测试锚 `Object.keys(edgeModule) == ['createHubReplicationEdge']`，structure.test L617）保持原名不动；公共名字归 `index.ts` 导出的宿主工厂。两同名函数以模块路径 + 导入别名区分，两个模块头注释互指。

### D2（SD-1/EF-C2）宿主缝形态：`resolveSessionSink` 三参回调 + 每命名空间 sink + 连接级 egress

**决策**：公共缝由三件构成（全部经 `index.ts` 导出、发布即冻结 append-only）：

```ts
/** 每 (连接, namespace) 的会话侧消费面（宿主实现；进程内测试可作记录桩）。
 *
 *  异常纪律（发布即冻结的契约条款，SA2 R5）：
 *  - openNamespace / namespaceFrame 的同步 throw = 宿主缺陷 → 适配器投递点防御 catch
 *    → connectionFatal('INTERNAL_ERROR', 1011)（连接终局；无静默 fallback）；
 *  - onConnectionClosed 的 reject 由适配器归一吞没（close()/settle() 恒 resolve；
 *    内部 edge 的 onConnectionDropped 通知与 unhandledRejection 面不受宿主影响）；
 *  - terminateUnauthorized 的 reject 由适配器归一（revokeNamespace 恒 resolve——
 *    与单体 terminationSettled「吞清理异常」纪律同形，hub-namespace.ts:1730–1734）。
 *  边界声明：OPEN 投递（openNamespace）不携带 wire 序——与缝契约「非 OPEN 帧才带
 *  sequence」同源（hub-split.ts:110–112）；适配器合成 ERROR 帧不带 relatedSequence
 *  （frame-io.ts:45–53 调用点同形）。 */
export interface HubNamespaceSessionSink {
  /** 首个 OPEN（授权+解析通过后投递）与后续重 OPEN（重开应答矩阵归宿主 sink，
   *  经 egress 出站——单体 onOpen established 分支的宿主形态）。 */
  openNamespace(message: HubOpenNamespaceMessage): void;
  /** 非 OPEN 的 namespace 域帧（已解码消息 + wire 序号）。 */
  namespaceFrame(message: ReplicationMessage, sequence: number): void;
  /** 'terminateUnauthorized' 信号（revoke 链）。幂等；无副作用 resolve。 */
  terminateUnauthorized(): Promise<void>;
  /** 'close' 信号的 per-ns 投影（连接收口通知；清理责任在宿主 sink）。 */
  onConnectionClosed(): Promise<void>;
}

export type NamespaceAuthorizationGrant = Extract<NamespaceAuthorization, { ok: true }>;

/** 宿主回调（Issue 正文签名）：OPEN 授权通过后调用。
 *  返回 sink = 建立会话；返回 undefined = 合法无 sink（SD-5，≠ 失败）；
 *  throw / reject = 解析失败（OAP-C6 响亮连接收口）。同步 throw 与异步拒绝同归。 */
export type HubSessionSinkResolver = (
  connectionKey: string,
  namespaceId: string,
  authorization: NamespaceAuthorizationGrant,
) => HubNamespaceSessionSink | undefined | Promise<HubNamespaceSessionSink | undefined>;

/** 连接级出站缝（ADR 0032 决策 2 的宿主形态）：sink 以 sequence=0 占位编码帧注入，
 *  edge 在 mux 点盖章 [8..12] 后出站。 */
export interface HubReplicationEdgeEgress {
  /** 控制帧（保留额度判据在既有 sendControlFrame 单点）。返回盖章后 wire 序；0 = 未发送/被拒。 */
  sendControlFrame(frame: Uint8Array): number;
  /** data 帧（前置门 + 单帧守卫 + 连接账本 admission，次序 = hub-session.ts:210–216 等价）。
   *  返回盖章后 wire 序；0 = 拒纳。 */
  sendDataFrame(frame: Uint8Array): number;
  /** ns 终态一次性通知（drain 提前完成观测输入；每 ns 至多一次）。 */
  namespaceSettled(namespaceId: string): void;
  /** 通道级致命条件 → 连接收口（缺省 1002；观测折叠沿用 stableConnectionCode 单点）。 */
  connectionFatal(code: string, wsCloseCode?: number): void;
  /** HELLO 协商位（会话期恒定；UPDATE_CHUNK 出站判据的唯一事实源）。 */
  chunkedUpdateNegotiated(): boolean;
}
```

**类型来源声明（SA2 N1）**：`ReplicationMessage` 源出 `@nomicore/replication-protocol`、`HubOpenNamespaceMessage = Extract<ReplicationMessage, {kind:'OPEN_NAMESPACE'}>` 同源、`ReplicationTimer`/`NamespaceAuthorization` 等源出本包 `types.ts`（已导出）。宿主实现 sink 接口经结构化推导无需点名 `ReplicationMessage`；test-d 声明其来源包。**本包不转出口 `ReplicationMessage`**——转出口反而扩大冻结面（当前 index 无此名）。

egress 挂在**连接句柄**上（`connection.egress`），不作为回调第四参：Issue 正文钉死回调三参（`connectionKey, namespaceId, authorization`，SA6 OAP-C8 同读法）；宿主在 `accept` 返回时已持有句柄，其 sink 闭包经 `connectionKey` 关联并使用 `connection.egress`（T5 worker 形态下同键回程路由）。`HostSessionAdapter` 持有内部 `HubSessionEdgePort`，egress 即其成员的等价重暴露：

| egress 成员 | 内部落点 | 等价性依据 |
|---|---|---|
| `sendControlFrame(frame)` | `port.sendControlFrame`（= `ConnectionSender.sendControlFrame`，`backpressure.ts:149–163`） | 与 `hub-session.ts:204–206` sendControl 同一单点（额度判据 + 控制队列出队盖章） |
| `sendDataFrame(frame)` | 前置 `port.connectionState()!=='closed'` + `port.dataGateOpen()` → `port.sendDataFrame`（= `sender.tryEmitDataFrame`，`backpressure.ts:165–178`） | 判定次序 = `hub-session.ts:210–216` sendData 逐点（门前置 → 守卫 → 账本 → 出队盖章）；门在内做 vs 外做，wire 结果（0 或盖章帧）逐字节等价 |
| `namespaceSettled(ns)` | `port.onChannelSettled`（`hub-edge.ts:689–692`） | settled 单调、每 ns 至多一次（内部 edge Set 吸收重复） |
| `connectionFatal(code, ws?)` | `port.connectionFatal`（缺省 1002 映射 `hub-edge.ts:222`） | 五路收口同拓扑 |
| `chunkedUpdateNegotiated()` | `port.chunkedUpdateNegotiated` | `hub-edge.ts:733–735` 单点 |

**最小面纪律**：T2 port 的 `dataFacetOf`/`onDataQueued`/wheel/shed、`observerPresent`/`emitObserver`/`connectionId`/`bufferedAmount`/`now` 属 listen 形态进程内组合成员（ADR 0032 决策 5 的降级面），不入公共 egress——worker 形态按「缺面 = dormant」降级（#418 design §654 已把跨线程形态划归 T5 重新过 SA8）。追加这些成员属 append-only 演进（发布后仍可加），现在不加是为避免冻结一个未经 SA8 复审的观测面。

**备选否决**：

- 回调带第四参（egress/context）：偏离 Issue 正文钉定的三参签名（最高优先级输入）。
- sink 上可变 egress 槽 / `attach(egress)` 生命周期方法：冻结公共面上的可变绑定 + bind-before-deliver 隐式协议；不如句柄成员直白。
- egress 传「已解码消息」而非字节：违反决策 2「缝只过 Uint8Array 帧 + 纯 JSON」的既定形态，且迫使 edge 侧为宿主编码（跨线程形态下编码落错线程）。
- （R5 备选登记）sink 异常**显式透传**（`revokeNamespace` 把 sink reject 原样返回）：违反单体「revoke 恒 resolve」红灯纪律（#7/#8 断言）且把宿主缺陷升级为公共面调用方必须处理的 reject——否决，采归一吞没 + 契约条款文档化。

### D3（SD-2/SD-3/SD-5/SD-6）OPEN 准入管线（按 AC2 序）

每连接维护一张**准入状态表**（`HostSessionAdapter` 内，键 = namespaceId；与内部 edge 台账锁步：OPEN 到达投递 ⟺ 记录在场——`hub-edge.ts:323–328` 到达点次序保证）：

```ts
type HostAdmission =
  | { phase: 'pending';   buffer: PendingItem[]; grant?: NamespaceAuthorizationGrant } // OPEN 已到、authorize/解析在途
  | { phase: 'denied' }    // 终态闩锁：拒绝
  | { phase: 'failed' }    // 终态闩锁：authorize throw / openAdmission reject（ns INTERNAL_ERROR 已发）
  | { phase: 'established'; sink: HubNamespaceSessionSink }
  | { phase: 'no-sink' };  // 终态记录：宿主返回 undefined（合法无 sink；非协议终态，见 SD-5）
// PendingItem 按 kind 分派（R3）：open 变体无 sequence（openNamespace 投递面不带 wire 序）
type PendingItem =
  | { kind: 'open';   message: OpenNamespaceInbound }
  | { kind: 'frame';  message: ReplicationMessage; sequence: number };
```

阶段序（单同步段可判定，OAP-C8 断言面）：

1. **HELLO/drain 门**（内部 edge 现行，零改动）：handshaking 期 OPEN → 连接级 `HELLO_REQUIRED` + 1002（`hub-edge.ts:391–397`）；drain 窗口 OPEN → 丢弃，零 authorize、零回调、零新会话（`495–499`）。
2. **全解码**（内部 edge 现行）：坏 magic/截断/seq gap/未协商 kind → 连接级注册表码（`BAD_MAGIC`/`MALFORMED_FRAME`/`SEQUENCE_VIOLATION`/`UNSUPPORTED_MESSAGE_TYPE` 之一）+ 1002，零 authorize、零回调、零会话（`hub-edge.ts:373–388`）。OPEN 全解码（决策 3）固定小帧、无 Yjs 载荷。
3. **authorize**（内部 edge 单点，零改动）：到达点建台账 + 唯一真实 `authorize(authenticatedInstanceId, nsId)`（`338–360`）。结局三分：
   - `denied` → **宿主回调零调用**（未授权 OPEN 不过宿主缝 = SA6 H4 读法）、不建会话；适配器结算 **`finishTerminal(ns, 'NAMESPACE_UNAUTHORIZED')`**：**按缓冲中 `{kind:'open'}` 项数逐 OPEN 应答** ns 级 `NAMESPACE_UNAUTHORIZED`（单体 `finishOpenError` waiter 语义，`hub-namespace.ts:483–488`：N 个合流 OPEN → N 帧）+ 观测面复刻（`namespace-error{sent}` **恰一**——HB2 不按 waiter 数；`namespace-failed{cause:'open-failed'}` 恰一，`hub-namespace.ts:489–503` 形状）；置 `denied` 闩锁；`settled` 通知（单体 `notifySettled` 同款，`1709–1713`）；缓冲**非 OPEN 项**静默丢弃（§13-1 登记交错，单体终态收帧静默同构）。
   - `throw` → **SD-6 维持 T2 登记**（`hub-split.ts:42–43`）：`finishTerminal(ns, 'INTERNAL_ERROR')` 同款语义（逐 OPEN 应答 + 恰一事件族），连接存活，`failed` 闩锁 + settled。
   - `authorized` → 缓存 ok 投影（grant）→ 阶段 4。
   - 重 OPEN（闩锁后）：`denied`/`failed` → 拒答 ns 级 `NAMESPACE_REOPEN_REQUIRES_RECONNECT`（仅 wire 帧，无事件——单体 `onOpen` 终态分支 `hub-namespace.ts:297–300` + `sendChecked` 无事件 `1656–1672` 逐点）；`pending` 期重 OPEN → 合流进缓冲为 `{kind:'open'}` 项（不新增解析调用，OAP-C8 负控；单体 opening waiter 合流同构 `317–320`）；`established` → 直投 `sink.openNamespace`（重开应答矩阵归宿主 sink，经 egress 出站——单体 onOpen established 分支即答 OPEN_OK 的宿主形态）；`no-sink` → 见 SD-5。
4. **pending 有界缓冲 + 宿主解析**：authorize `authorized` 后调用 `resolveSessionSink(connectionKey, nsId, grant)`（`Promise.resolve(...)` 包裹，同步 throw 同归拒绝面——`beginAdmission` 同款纪律）。**在途窗口**（自 OPEN 到达始、至解析结算止——SA6 G5 将「authorize 在途」与「sink 未解析」同窗）该 ns 到达的帧按到达序进缓冲；连接级共享上界 `MAX_PENDING_FRAMES_PER_CONNECTION = 16`（含 OPEN 自身占位）；溢出（第 17 项）→ 响亮连接收口（下条）。解析成功 → 状态置 `established`，**按 kind 分派冲刷（R3）**：`{kind:'open'}` 项经 `sink.openNamespace(item.message)`（OPEN 投递面——含 pending 期合流的重 OPEN，重开应答归 sink）、`{kind:'frame'}` 项经 `sink.namespaceFrame(item.message, item.sequence)`（含 wire 序）；投递顺序 = 到达序。
5. **并发 OPEN 上界**：`MAX_CONCURRENT_OPEN_ADMISSIONS = 4`（每连接，in-flight = `pending` 记录数，覆盖 authorize 在途 + 解析在途）。新 OPEN 到达且 in-flight 已达上界 → 恰一帧连接级 ERROR + transport close + 已建立会话按既有 quiesce 路径终结 + 不为被拒 OPEN 建立会话：经 `port.connectionFatal('CONNECTION_POLICY_VIOLATION', 1008)`（内部 edge 五路收口拓扑 `619–645` 原样提供全部分量）。**SD-2 选码理由**：超额并发 OPEN 是**对端**对 hub 入站接纳政策的违例（hub 无故障）→ 注册表内 `CONNECTION_POLICY_VIOLATION`（fatal/config/no-retry/1008，§14「身份或连接 policy 错误」）语义精确匹配；与早到帧条数界同族（第 17 帧 → 1008，`hub-connection.ts:116–121` 先例）分类一致。否决 `INTERNAL_ERROR`(1011)（误将对端行为归类内部故障 + 1011 的 backoff-继续语义不适配 blocked 分类）与 `CONNECTION_BACKPRESSURE`(1011)（该码是决策 2 名义的**出站**控制额度终局，`errors.ts` + 协议 L414；本面是**入站**准入，不同面不同码，登记理由后分立）。
6. **sink 解析失败响亮收口**：`resolveSessionSink` throw/reject → `port.connectionFatal('INTERNAL_ERROR', 1011)`——恰一帧连接级 `INTERNAL_ERROR`（fatal/yes/1011，`errors.ts:117` 注册表映射）+ `transport.close(1011, 'protocol-error')` + 不建该 ns 会话 + 无静默 fallback（连接停止服务，宿主可重连重建；这是「诚实结果」而非重试面）。
7. **已建立会话转发**：解析成功后该 ns 的帧（含缓冲冲刷项与其后直投项）投递到该 ns sink；其他 ns 的 sink 零污染（按 ns 键隔离）。解析成功后到达的帧**直投不经过缓冲**（序仍单调——入站单线程到达序）。

**SD-3 上界来源 = 模块常数**（不新增 limits 键）：

| 常数 | 值 | 内存上界推导（比照 `MAX_EARLY_FRAMES` 账法，`hub-upgrade-admission.ts` 搬迁后同文） |
|---|---|---|
| `MAX_PENDING_FRAMES_PER_CONNECTION` | 16 | 保留上界 = 16 × `limits.maxFrameBytes`（缺省 8 MiB → 128 MiB）+ 常数数组开销；**与早到帧窗口同账**（同一对抗面：升级窗口/解析窗口内的对端灌帧；溢出即收口、内存随连接释放） |
| `MAX_CONCURRENT_OPEN_ADMISSIONS` | 4 | in-flight 准入记录数（不含帧字节）；4 与 `maxConcurrentAssembliesPerConnection` 缺省同值但**是另一个面**（入站 OPEN 准入 vs 分块 assembly 槽位，`types.ts:44–52` 判然两分，SA8 §3 行 14 确认互不重定义） |

理由：(a) 简报未要求可配置；(b) 公共配置面一经发布即冻结，现在冻结 knob 名是过早承诺；模块常数 → limits 键是 append-only 可升级路径（反向不可），升级时按 SA8 §6 第二条补 `validateLimits` 响亮校验 + 推导登记；(c) 契约测试以显式小上界驱动（SA6 §15-6），常数即显式。**溢出语义**：pending 缓冲溢出与并发 OPEN 超限同面（对端灌入站窗口）→ 同码 `CONNECTION_POLICY_VIOLATION` + 1008（恰一帧连接级 ERROR + 收口，不静默丢帧——OAP-C4 溢出义务）。

**SD-5（`undefined` 二分）**：`undefined` = 合法无 sink ≠ 失败。落点：置 `no-sink` 终态记录 + `settled` 通知 + 缓冲静默丢弃（**含 pending 期合流的重 OPEN 项——无 wire 应答**，§13-1 家族 (b) 登记选择：首个 OPEN 与合流 OPEN 同一待遇 = 均无应答；`undefined` ≠ 失败故不发 ERROR 帧，且 OPEN 本身非「无 sink 帧」不触发 STATE_VIOLATION 合成；单体无对应态，收敛回退方案登记于 §13-1）；此后该 ns 的非 OPEN 帧逐帧合成 ns 级 `NAMESPACE_STATE_VIOLATION` + 连接存活（RK-C2「宿主返回 undefined」语料；合成形状复刻 `hub-edge.ts:570–586`：帧 + `namespace-error{sent}` 事件）；**ERROR 帧例外**：no-sink（及 denied/failed/pending 之外的任何无会话态）ns 级 ERROR → 静默丢弃（单体 I5 双层形状：edge 侧未知 ns 静默 `hub-edge.ts:526–532` + session 侧无通道静默 `hub-session.ts:158–163`；ERROR 永不触发合成）。**重 OPEN**：`no-sink` 非协议终态（无会话生命周期曾开始）→ 重 OPEN 重新解析（缓存 grant 复用，authorize 不重复——T2 台账每 (连接, ns) 恰一次已冻结；SA8 设计报告 §3 行 8 裁决：协议 §1 不变量 4 的重开禁令明文限定 closed/conflicted/failed 生命周期终态，no-sink 不落入）；放大面与单体「顺序开新 ns」同界（单体本无每连接 ns 数上界，`channels` 只增不减），并发重解析受阶段 5 上界约束。**pending 期重 OPEN 不新增解析调用**（合流，OAP-C8 负控）。

**设计性分歧登记（评审关注点，非静默；SA8 设计报告 §8-A4 已裁决决策文本层 no-conflict，SA2 行为面攻击由本节 + §13-1 完整应答）**：单体对「OPEN 后、OPEN_OK 前到达的 ns 帧」按通道 opening 态判真违例（UPDATE → 即答 ns `NAMESPACE_STATE_VIOLATION` + finalize failed，`hub-namespace.ts:839–848`）；本设计的在途窗口（W1 authorize 在途 + W2 解析在途）统一**缓冲**而非即答违例（SA6 G5/OAP-C4 将 authorize 在途纳入未解析窗口；ADR 决策 3 列举 pending 缓冲为 edge 职责）。完整分歧族见 §13-1（三态逐项：established 投递面已收敛；deny/throw 应答数已收敛；no-sink 应答面显式登记）。

### D4（SD-1/EF-C2/EF-C3）双入口与 upgrade 门序（复刻 `hub-connection.ts`，去服务面）

`accept(transport, request?)`（`request: HubUpgradeRequest`，即 Issue 正文 `{ token }`）：

1. 门 1 缺凭据（request 缺失/无 token/非字符串/空串）→ `transport.close(1008, 'upgrade-unauthorized')` + `auth-upgrade-rejected{missing-token}` → `undefined`。
2. 门 2 无认证器（`verifyToken` 未注入）→ 1008 + `verifier-missing` → `undefined`（fail-closed；协议 §2「宿主 accept 未提供受信身份即接线缺陷」——**读法登记（SA8-A3）**：§2 的「同步 TypeError」形态在工厂面不可达且不应达：`verifyToken` 为双入口条件依赖（`acceptTrusted` 零消费），构造期无法判别入口；「accept 永不 reject」是冻结不变量，异步入口的 sync TypeError = rejected promise 即违之；单体对同一 JS 层条件的运行期形态恰为 1008 + `undefined`（`hub-connection.ts:263–267`：构造期 TypeError 是第一层、运行期 1008 是纵深防御），工厂逐字节复刻纵深防御层）。`verifyToken` 在 `HubReplicationEdgeOptions` 为**可选成员**：**类型可选 ≠ 运行时容错——`accept` 路径缺认证器仍 fail-closed 1008（SA2 N2 措辞补全）**；仅 `acceptTrusted` 路径零消费（EF-C2）。
3. 门 3 共享有界早到帧 admission（**复用搬迁后的 `hub-upgrade-admission.ts` 单点**——`hub-connection.ts` 与工厂两消费方 import 同一实现，行为零变化，#190 纪律保持）：注册后同步收口段（拒绝/早断 → 摘句柄 → `undefined`）。
4. auth timer 封顶（`timeouts.helloTimeoutMs` 复用，零新 knob）：超时 → markRejected + detach + `close(1008, 'upgrade-timeout')` + `auth-timeout`。
5. 门 4 验证：`await verifyToken(token)`（恰一次，入参 = token）→ 清 timer → 迟拒复查 → 裁决 `null`/畸形/`ok!==true`/throw → `rejectUpgrade`（1008 + `invalid-credentials`）。**accept 永不 reject**（promise 恒 resolve——单体 §8.2 不变量继承）。
6. **微任务让位 + 迟拒兜底复查**（A2-d 零宽窗口面，`hub-connection.ts:304–310` 同款；**次序对齐单体——R6 修订**：让位复查先于文法检查）。
7. `isValidInstanceId` 文法 → 违例 → 1008 + `invalid-instance-id`（`hub-connection.ts:311–315` 同款次序）。
8. 门 5 世界变化：detach → `isEarlyClosed() || transport.closed` → `peer-disconnected` → `undefined`（零 close 副作用）。
9. 分配：`createEdgeConnection(…)`（注入早到帧构造尾重放）→ 返回连接句柄。

`acceptTrusted(transport, identity)`：身份文法 → 1008 + `invalid-instance-id`；早到帧 admission（同门 3）→ 拒绝/早断/对端断 → `undefined`；分配。无验证器、无 auth timer（单同步段）。`identity.peerInstanceId` 即认证身份（HELLO 自报不得覆盖——内部 edge `onHello` 一致性门 `hub-edge.ts:417–424` 继承）。

与单体差异（显式）：无「门 0 hub-shutdown」（工厂无服务级 close 面，§1 非目标；宿主停接纳 = 停止调用 accept，存量连接经句柄 `close`）。其余门序（含修订后的 6/7 次序）、close code/reason、observer reason 闭集逐点复刻。

### D5（SD-4）`connectionKey` 形态

`connectionKey = ${instanceId}-conn-${n}`（`n` = 工厂级单调计数器，连接构造时分配）。性质：同连接内恒定（构造即定，先于 HELLO）；跨连接互异（工厂内单调）；与既有 observability `connectionId` **同串**（内部 edge HELLO 时以同一 `connectionCounter` 赋值，`hub-edge.ts:441,479`）——单一键系统，宿主可用它关联 observer 事件与 sink 归属；时序满足回调需要（OPEN 必在 HELLO 后）。SA8 A1 建议原样采纳，避免第二套键。

### D6（SD-6）authorize 抛错映射

维持 T2 登记（`hub-split.ts:42–43`）：throw → ns 级 `INTERNAL_ERROR` + 连接存活（不建会话、`failed` 闩锁 + settled）。不改为连接级收口（那会翻转 OAP-C3④ 存活期望 → 须重过 SA8，SA8 A1 明示）。**`openAdmission` reject（台账缺失 = 锁步不变量破坏）同归本面（R4a）**：`settleAdmission` catch → `finishTerminal(ns, 'INTERNAL_ERROR')`——对齐单体 shim reject → `startOpen` catch → ns `INTERNAL_ERROR`（`hub-session.ts:105–111` + `hub-namespace.ts:347–349`），响亮、有 wire 分类、连接存活。

### D7 连接句柄公共面（EF-C2 落实 + `channels` 显式裁决）

```ts
export interface HubReplicationEdgeConnection {
  readonly state: HubConnectionState;                 // 内部 edge 投影（handshaking/ready/draining/closed）
  readonly peerInstanceId: string | undefined;        // HELLO 前 undefined（事件可选字段语义保持）
  readonly authenticatedInstanceId: string;           // Upgrade 受信身份
  readonly connectionKey: string;                     // D5
  readonly namespaces: ReadonlySet<string>;           // 已解析 sink 的 ns 集（快照语义，防御性拷贝）
  readonly egress: HubReplicationEdgeEgress;          // D2
  close(code?: number, reason?: string): void;        // 内部 edge close 委托
  settle(): Promise<void>;                            // 全部会话清理结算（恒 resolve——R5 纪律）
  beginReauth(): void;                                // GOAWAY + drain + deadline 1001（幂等）
  revokeNamespace(namespaceId: string): Promise<void>; // → established sink.terminateUnauthorized()（归一，恒 resolve）；其余无副作用 resolve
}
```

**`channels` 显式裁决（SA6 §15-8 授权）**：句柄**不**暴露 `channels: ReadonlyMap<string, HubNamespaceChannel>`。理由：`HubNamespaceChannel` 是进程内 session 半边的组合成员（依赖 Registry 注入面）；工厂形态无进程内 session host，任何 `channels` 投影都只能是恒空谎言成员——冻结公共面上的不诚实成员比缺员更糟。替代观测面 = `namespaces`（路由表已解析键集）。**#418 既有测试零同步**：其白盒锚（`hub.connections[0].channels.get(nsId)`）全部落在单体路径（`HubReplicationImpl` 持有的内部 edge + 真实 session host），本票对该路径零改动。EF-C2 的 test-d 锁定面相应以 `namespaces` 落实（§12 映射中登记此偏差及授权依据）。

---

## 8. 接口、状态机和数据流

### 8.1 公共工厂与配置

```ts
export interface HubReplicationEdgeOptions {
  readonly instanceId: string;            // HELLO 绑定（validateInstanceId 响亮）
  readonly timer: ReplicationTimer;       // 注入延迟 seam（零 native timer）
  readonly authorize: NamespaceAuthorizer; // 决策 3：宿主注入授权器（真实调用单点在内部 edge）
  readonly resolveSessionSink: HubSessionSinkResolver; // D2 宿主缝
  readonly verifyToken?: PeerTokenVerifier; // accept 路径认证器（缺失 → accept 全拒 1008；acceptTrusted 不消费）
  readonly limits?: Readonly<Partial<ReplicationLimits>>;
  readonly timeouts?: Readonly<Partial<ReplicationTimeouts>>;
  readonly observer?: ReplicationObserver;
  readonly clock?: ReplicationClock;
}

export interface HubReplicationEdgeFactory {
  accept(transport: DuplexTransport, request?: HubUpgradeRequest): Promise<HubReplicationEdgeConnection | undefined>;
  acceptTrusted(transport: DuplexTransport, identity: UpgradeIdentity): Promise<HubReplicationEdgeConnection | undefined>;
}

export function createHubReplicationEdge(options: HubReplicationEdgeOptions): HubReplicationEdgeFactory;
```

构造期校验（响亮、同步 TypeError；协议 §2 接线缺陷纪律——**对 `instanceId`/`timer`/`authorize`/`resolveSessionSink` 等无条件必填成员成立**；`verifyToken` 的可选性读法见 §7-D4 门 2）：`instanceId` 文法（`validateInstanceId`）、`timer`/`authorize`/`resolveSessionSink` 函数性、`limits`/`timeouts` 经 `resolveLimits`/`resolveTimeouts` + `validateLimits`/`validateTimeouts`，并按单体同款条件链（显式表达分块族键时）跑 `validateChunkedTransferChain`/`validateChunkedBootstrapChain`/`validateChunkedSyncDiffChain`（`validate.ts:140–284`、先例 `hub-connection.ts:179–205`）。

### 8.2 准入状态机（`HostSessionAdapter` 伪码，R3/R4/R5 修订版）

```
openNamespace(msg):                                    // 内部 edge 到达点投递（台账已在）
  rec = table.get(ns)
  if rec == null:                                      // 首个 OPEN
    if pendingOpenCount >= 4:  port.connectionFatal('CONNECTION_POLICY_VIOLATION', 1008); return
    table.set(ns, rec = { phase:'pending', buffer:[{kind:'open', message:msg}] })
    pendingOpenCount++; pendingFrameCount++
    runSettle(ns)                                      // settleAdmission（内含全守卫，见下）
  else switch rec.phase:
    'pending':     pushPending(ns, {kind:'open', message:msg})                    // 合流：不新增解析调用
    'established': deliverOpen(rec.sink, msg)                                     // 投递点防御 catch（R5）
    'denied'|'failed': sendNsReply('NAMESPACE_REOPEN_REQUIRES_RECONNECT', ns)     // 仅 wire 帧
    'no-sink':     table.set(ns, rec = { phase:'pending', buffer:[{kind:'open', message:msg}], grant:rec.grant })
                    pendingOpenCount++; pendingFrameCount++; runResolve(ns, rec)  // 重解析（SD-5）

namespaceFrame(msg, seq):                              // 内部 edge 路由投递（台账命中）
  rec = table.get(ns); if rec == null: synthesizeStateViolation(ns); return   // 防御分支（不可达；hub-session withChannel 同形）
  switch rec.phase:
    'pending':     pushPending(ns, {kind:'frame', message:msg, sequence:seq})
    'established': deliverFrame(rec.sink, msg, seq)                               // 投递点防御 catch（R5）
    'denied'|'failed': return                          // 静默（单体 quiet 态同构）
    'no-sink':     if msg.kind === 'ERROR': return     // ER 例外：ERROR 永不合成
                    synthesizeStateViolation(ns)        // RK-C2「宿主返回 undefined」语料

pushPending(ns, item):
  if pendingFrameCount >= 16: port.connectionFatal('CONNECTION_POLICY_VIOLATION', 1008); return   // 溢出：响亮、不静默丢帧
  rec.buffer.push(item); pendingFrameCount++

runSettle(ns):                                         // fire-and-forget 入口：内部全路径自兜底，零 unhandled rejection（R4）
  settleAdmission(ns).catch(() => { /* 不可达兜底：settleAdmission 全路径已分类（见函数体） */ })

async settleAdmission(ns):                             // 结算续体（迟归照常传播——D5.6 继承）
  rec = table.get(ns)
  let adm
  try { adm = await port.openAdmission(ns) }           // 台账必在（锁步）；reject = 不变量破坏
  catch { finishTerminal(ns, 'INTERNAL_ERROR'); return }                              // R4a：单体 shim reject → ns INTERNAL_ERROR 同归
  if connectionClosed: finishTerminalSilently(ns, adm.outcome === 'denied' ? 'NAMESPACE_UNAUTHORIZED' : 'INTERNAL_ERROR'); return   // R4b：迟归于死连接 → 静默（isOpenAborted 同构）
  if adm.outcome === 'denied':  finishTerminal(ns, 'NAMESPACE_UNAUTHORIZED')          // 帧×缓冲OPEN数+事件恰一+闩锁+settled
  elif adm.outcome === 'throw': finishTerminal(ns, 'INTERNAL_ERROR')                  // SD-6；连接存活
  else: rec.grant = adm.authorization; await runResolveInner(ns, rec)

runResolve(ns, rec):                                   // no-sink 重解析入口（fire-and-forget，同款自兜底）
  runResolveInner(ns, rec).catch(() => { /* 不可达兜底 */ })

async runResolveInner(ns, rec):
  try { sink = await Promise.resolve(resolveSessionSink(connectionKey, ns, rec.grant)) }   // 同步 throw 同归
  catch { port.connectionFatal('INTERNAL_ERROR', 1011); return }                        // OAP-C6
  if connectionClosed:
    if (sink) void sink.onConnectionClosed().catch(() => undefined)                     // 迟归卫生通知（归一，R5）
    discardBuffer(ns); return
  if sink == null:                                                                     // SD-5：合法无 sink
    rec.phase = 'no-sink'; discardBuffer(ns); pendingOpenCount--; port.onChannelSettled(ns); return   // 缓冲（含合流 OPEN）静默丢弃——§13-1(b) 登记选择
  rec.phase = 'established'; rec.sink = sink; pendingOpenCount--
  flushPending(ns, rec)                                                                // 按 kind 分派冲刷（R3）+ 单点账目

flushPending(ns, rec):                                 // 冲刷 + 账目单点（SA2 N4）
  const items = rec.buffer; rec.buffer = []
  for (item of items):
    if item.kind === 'open':   deliverOpen(rec.sink, item.message)                     // OPEN 投递面（不带 wire 序）
    else:                      deliverFrame(rec.sink, item.message, item.sequence)     // 非 OPEN 投递面（带 wire 序）
  pendingFrameCount -= items.length                                                    // 单点递减（含 open 项——其占位计入）

discardBuffer(ns):                                     // 丢弃 + 账目单点（SA2 N4）
  const rec = table.get(ns); if (rec == null || rec.buffer.length === 0) return
  pendingFrameCount -= rec.buffer.length; rec.buffer = []

deliverOpen(sink, msg):                                // 宿主投递点（R5/ER-2）：同步 throw = 宿主缺陷 → 连接终局
  try { sink.openNamespace(msg) } catch { port.connectionFatal('INTERNAL_ERROR', 1011) }

deliverFrame(sink, msg, seq):                          // 同上（R5/ER-2）
  try { sink.namespaceFrame(msg, seq) } catch { port.connectionFatal('INTERNAL_ERROR', 1011) }

finishTerminal(ns, code):                              // deny/throw/reject 结算（单体 finishOpenError 形状——R3/R4）
  if connectionClosed: finishTerminalSilently(ns, code); return                        // R4b 守卫（迟归/竞态）
  rec = table.get(ns)
  const openCount = rec.buffer.filter(item => item.kind === 'open').length
  rec.phase = (code === 'NAMESPACE_UNAUTHORIZED') ? 'denied' : 'failed'
  for (i = 0; i < openCount; i++):                                                    // 按 waiter 数逐 OPEN 应答（单体 483–488）
    port.sendControlFrame(encodePlaceholder(namespaceErrorFrame(code, ns)))           // 与单体逐字节同路径
  emitObserver(namespace-error{sent, code})                                           // 恰一（HB2：不按 waiter 数）
  emitObserver(namespace-failed{cause:'open-failed'})                                 // 迁移 failed 时恰一
  discardBuffer(ns); pendingOpenCount--; port.onChannelSettled(ns)

finishTerminalSilently(ns, code):                      // 连接已收口的迟归结算（R4b；单体 finishOpenSilently 同构）；code = 正在结算的终局码
  rec = table.get(ns); if (rec == null) return
  rec.phase = (rec.phase === 'pending') ? ((code === 'NAMESPACE_UNAUTHORIZED') ? 'denied' : 'failed') : rec.phase   // 闩锁防重入
  discardBuffer(ns); pendingOpenCount--                                                // 缓冲丢弃 + 账目
  // 零 wire、零 observer 事件、零 settled 通知（单体 finishOpenSilently 不发事件不通知 settled——
  // 观测等价：内部 edge maybeFinishDrainEarly 在 closedFlag 上早退，通知与否皆无外溢）

close():                                               // 'close' 信号（幂等 closeTail）
  connectionClosed = true
  return Promise.all([...established sinks].map(s =>
      s.onConnectionClosed().then(() => undefined, () => undefined)                    // R5/ER-3：逐 sink 归一——close()/settle() 恒 resolve；
    ))                                                                                 //   内部 edge cleanupAll 的 await settleTail 永不 reject、
  .then(() => undefined)                                                               //   onConnectionDropped 必达、零 unhandled rejection
terminateNamespace(ns):
  rec = table.get(ns)
  if rec?.phase !== 'established': return Promise.resolve()
  return rec.sink.terminateUnauthorized().then(() => undefined, () => undefined)       // R5/ER-4：归一——revokeNamespace 恒 resolve（单体 terminationSettled 同形）
dataFacetOf(): undefined                              // 决策 5 降级（wheel/shed/facet = listen 形态进程内成员）
channels: EMPTY_CHANNELS                               // 缝类型满足；非事实源（D7 裁决）
```

`synthesizeStateViolation(ns)`：`sendControlChecked` 形状复刻 `hub-edge.ts:570–586`（ns `NAMESPACE_STATE_VIOLATION` 帧 + `namespace-error{sent}` 事件 + 连接存活）。`sendNsReply`：仅 `namespaceErrorFrame` 帧（无事件，单体 `sendChecked` 形状）。

**伪码与单体的语义映射（R3/R4 收口核对）**：

| 交错/失败 | 单体行为（锚点） | 本设计伪码 | 一致性 |
|---|---|---|---|
| pending 期合流 OPEN → established | waiter 合流 → 每 waiter 一帧 OPEN_OK（`flushOpenWaitersOk` `474–481`） | 合流项经 `flushPending → deliverOpen(sink)` 投递；OPEN_OK 出站归宿主 sink（经 egress，`sendControlFrame` 同一单点） | 投递面收敛（R3-1）；应答由 sink 决定 = 单体通道 onOpen established 分支的宿主形态 |
| pending 期合流 OPEN → denied/throw | 每 waiter 一帧 ERROR + `namespace-error{sent}` 恰一（`finishOpenError` `483–503`） | `finishTerminal` 按缓冲 open 项数逐帧应答 + 事件族恰一 | **逐项收敛**（R3-2） |
| pending 期合流 OPEN → no-sink | （单体无对应态） | 缓冲（含合流 OPEN）静默丢弃、零应答 | 显式登记（§13-1(b)，R3-3） |
| `openAdmission` reject（台账缺失） | shim reject → `startOpen` catch → ns `INTERNAL_ERROR`（`hub-session.ts:105–111`/`hub-namespace.ts:347–349`） | `settleAdmission` catch → `finishTerminal(ns,'INTERNAL_ERROR')` | **逐项收敛**（R4a） |
| 迟归终局于已收口连接 | `isOpenAborted` → `finishOpenSilently`：零 wire 零事件零 settled（`hub-namespace.ts:348,356,505–527`） | `finishTerminal`/`settleAdmission` 前置 `connectionClosed` 守卫 → `finishTerminalSilently` | **逐项收敛**（R4b） |
| 迟归解析 sink 于已收口连接 | 迟归续体卫生吸收（D5.6/H1） | `runResolveInner` 卫生分支：归一 `onConnectionClosed` 通知 + 缓冲丢弃 | 收敛（归一差异 = R5 纪律） |
| sink 投递同步 throw | 单体不面对（sink 为库内实现） | `deliverOpen/deliverFrame` 防御 catch → `connectionFatal('INTERNAL_ERROR',1011)` | 新定义（R5/ER-2，发布即冻结条款） |
| sink `onConnectionClosed` reject | 单体通道内部归一（`close()` 恒 resolve） | 逐 sink `then(undefined→, reject→undefined)` | 收敛到单体纪律（R5/ER-3） |
| sink `terminateUnauthorized` reject | `terminationSettled` 吞异常（`1730–1734`） | `.then(()=>undefined,()=>undefined)` | 收敛到单体纪律（R5/ER-4） |

**settled 账目**（drain 提前完成的唯一输入，LC-C2）：`denied`/`failed`/`no-sink` 于结算时通知；`established` 由宿主 sink 经 `egress.namespaceSettled(ns)` 通知（适配器转发 `port.onChannelSettled`，未知 ns 忽略）；`pending` 永不通知（内部 edge 判定式 `∀ 台账 ns ∈ settled` 自动阻塞提前收口——`hub-edge.ts:704–710` 零改动继承）；**连接已收口的静默结算不通知**（单体 `finishOpenSilently` 同构；观测等价——closedFlag 早退）。

### 8.3 数据流路线

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| R1 入站 ns 帧 | peer socket → transport.onMessage | —（无持久化） | 内部 edge decodeInbound（expectedSeq 单点）→ drain 门 → 方向纪律 → OPEN/路由键/ERROR 三案 | 进程内同步分发 | `HostSessionAdapter` 准入表 → 宿主 sink | sink 侧到达序 = wire 序；无 sink → 合成 ns ERROR；违例 → 连接级 MALFORMED_FRAME + 1002 | decode/门失败 → `connectionFatal`（五路收口）；缓冲溢出/并发超额 → 1008 收口 | OAP-C1/C2/C7、RK-C1/C2、ER-C1..C3 |
| R2 OPEN 准入 | 首个 OPEN_NAMESPACE（全解码） | 准入表记录 + 内部 edge 台账（先于投递，同一同步段） | authorize（内部 edge 单点）→ 结局拉取（reject 有分类——R4a）→ `resolveSessionSink`（跨模块边界：包 → 宿主） | pending 缓冲（连接级 ≤16 帧，纯内存，随连接释放） | 宿主回调（恰在授权通过后） | deny/throw → 按（缓冲 OPEN 数）逐帧 ns ERROR + 事件族恰一；undefined → no-sink 零应答；sink → 按 kind 分派冲刷 | 回调 throw/reject → `connectionFatal(INTERNAL_ERROR,1011)`；openAdmission reject → ns INTERNAL_ERROR；迟归续体 → 静默结算/归一卫生通知 | OAP-C3..C8（含 C4b 交错组） |
| R3 出站盖章 | 宿主 sink → `connection.egress.sendControlFrame/sendDataFrame`（占位编码帧） | — | 门前置 → 守卫/账本 → `OutboundQueue.emitOne` mux 点重写 `[8..12]`（单点） | transport.send | wire 帧（含 envelope 序号） | per-connection 从 1 严格递增、多 sink 交织 = 出队序；帧字节 == `encodeMessage(同消息,{sequence:k})` | 拒纳 → 返回 0；额度耗尽 → `CONNECTION_BACKPRESSURE`(1011) 既有终局；收口后零新出站 | WS-C1..C3 |
| R4 适配器合成帧 | deny/throw/REOPEN/STATE_VIOLATION 结算点 | — | `namespaceErrorFrame`（同源构造）→ 占位编码 → `port.sendControlFrame` → 盖章 | transport.send | wire + observer 事件 | deny/throw = N 帧（N = 缓冲 OPEN 数）+ 恰一事件族；REOPEN/STATE_VIOLATION 与单体同形状 | 编码异常 → sendChecked catch 形状（防御；理论不可达） | OAP-C3、RK-C2/C3、WS-C2、OAP-C4b |
| R5 升级接纳 | HTTP Upgrade 后 accept/acceptTrusted | 早到帧缓冲（≤16 帧，`hub-upgrade-admission.ts` 单点） | verifyToken（accept 恰一次）→ 让位复查 → 身份文法 → 分配（次序 = `hub-connection.ts:242–334` 逐点，含 6/7 修正） | 纯内存 | 连接句柄（含 connectionKey） | 拒绝 → 1008/1009 + 'upgrade-frame-limit'/'upgrade-unauthorized' + `auth-upgrade-rejected` 闭集；接纳 → 句柄 + 早到帧构造尾重放 | accept 永不 reject；transport close 异常由 `closeAdmission` 守卫吞（残局归所有者） | EF-C2/C3 |
| R6 生命周期 | 句柄 close/beginReauth/revokeNamespace；sink 终态；liveness | — | GOAWAY(REAUTH_REQUIRED, closeTimeoutMs) + drain 窗口 + settled 判定 | transport.close(1001,...) | 句柄 state 投影 + observer | 全部已解析会话终态齐备 → 立即 1001（deadline 已清）；任一 pending → 不提前 | 迟到/竞态零副作用（closedFlag/reauthRequested 幂等守卫继承）；sink 清理异常全部归一（close/revoke 恒 resolve——R5） | LC-C1..C4 |

每跳数据形态：帧 = `Uint8Array`（20B envelope）；缝上（内部缝与公共 egress）只有占位编码字节 + 纯 JSON 投影（grant）；无缓存、无最终一致性面；失败后的可见性 = wire 帧 + close code/reason + observer 事件 + 宿主回调计数，清理责任 = 连接收口路径单点（适配器缓冲随连接释放、sink 清理归 `onConnectionClosed`）。

### 8.4 出站盖章等价论证（WS-C2 根基）

「占位编码 + mux 点重写」≡「按真实序列单次编码」：envelope sequence 是固定 4 字节大端字段（协议 §3），`writeBe32At(bytes, 8, seq)`（`frame-io.ts:200–205`）与 codec `writeBe32` 同构——该等价性是 T2 已冻结的代码事实（`frame-io.ts:110–117` 注释 + O1b/O2b/O5b 实测）。工厂形态下多宿主 sink 的帧经**同一** `OutboundQueue`（同一内部 edge 实例）出队 → per-connection 严格递增、交织序 = 出队序由单点结构性保证；连接隔离 = 每连接独立内部 edge 实例（NC2）。

### 8.5 路由键与 ERROR mini-decode（零改动复用）

`routingKeyOf`（`hub-edge.ts:558–567`）与 ERROR 特例（`526–532`）在内部 edge 现行实现中已满足 RK-C1..C3/ER-C1..C3（SA6 O1–O4/NC3/NC4 + M1/M2/M4 变异背书）。工厂形态经同一实现继承；T1 守卫（`codec-route-key-guard.test.ts`）持续锁死布局 ↔ 字段序同步。本设计**不重新实现**任何路由/解码逻辑（D1 单份纪律）；no-sink 分支的合成落点在适配器（D3/SD-5），形状复刻 edge 侧 R-none（`570–586`）。

### 8.6 观测面

| 事件 | 发射点 | 形状依据 |
|---|---|---|
| `auth-upgrade-rejected{reason}`（闭集：missing-token/verifier-missing/frame-too-large/early-frame-limit/auth-timeout/invalid-credentials/invalid-instance-id/peer-disconnected） | 工厂 upgrade 门（复刻 `hub-connection.ts:222–240`） | pre-connection 无 connectionId 可挂（文档化形态） |
| `namespace-error{sent}` + `namespace-failed{cause:'open-failed'}` | 适配器 deny/throw/reject 结算（`finishTerminal`） | `hub-namespace.ts:483–503,1696–1706,1820` 逐事件复刻（HB2 恰一纪律：`namespace-error{sent}` 不按应答帧数）；应答帧数按缓冲 OPEN 数（waiter 语义） |
| `namespace-error{sent}`（合成 STATE_VIOLATION） | 适配器 no-sink 合成 | `hub-edge.ts:570–586` 形状 |
| `connection-failed{code, wsCloseCode}` | 内部 edge 五路收口（含新 OAP-C5/C6 路径与 R5 sink-throw 路径经 `connectionFatal`） | 未知 string 折叠 `INTERNAL_ERROR`（`observer.ts` 稳定码单点，零新码） |
| `connection-state-changed`/水位事件/liveness 采样 | 内部 edge（零改动） | 既有语义 |
| **（零事件面）连接已收口的迟归结算** | `finishTerminalSilently` | 单体 `finishOpenSilently` 同构：零 wire 零事件零 settled（死连接零噪声，R4b） |

零新事件类型、零新错误码（字段集 append-only 不变，ADR 决策 5）。

---

## 9. 错误、恢复、并发和幂等

### 9.1 错误分类与失败语义（全部既有注册表码，零新码）

| 失败源 | 错误码 / scope | ws close | 连接后果 | 会话后果 | 调用方可观察 |
|---|---|---|---|---|---|
| 畸形 ingress（坏 magic/截断/seq gap/未协商 kind） | `BAD_MAGIC`/`MALFORMED_FRAME`/`SEQUENCE_VIOLATION`/`UNSUPPORTED_MESSAGE_TYPE`（连接级，注册表映射） | 1002 | fatal 收口（五路拓扑） | 全部 quiesce | ERROR 帧 + close + `connection-failed` 事件 |
| authorize 拒绝 | `NAMESPACE_UNAUTHORIZED`（ns 级） | —（连接存活） | 存活 | 不建立；闩锁 | **按缓冲 OPEN 数**逐帧 ns ERROR（waiter 语义）+ `namespace-error{sent}` 恰一 + `namespace-failed`；宿主回调零调用 |
| authorize 抛错（SD-6 = T2 登记） | `INTERNAL_ERROR`（ns 级） | —（连接存活） | 存活 | 不建立；`failed` 闩锁 | 同上族；错误值不上 wire（仅「抛出」事实） |
| `openAdmission` reject（台账缺失 = 锁步不变量破坏，R4a） | `INTERNAL_ERROR`（ns 级） | —（连接存活） | 存活 | 不建立；`failed` 闩锁 | 同上族（对齐单体 shim reject 路径）；无 unhandled rejection |
| 迟归终局于已收口连接（R4b） | —（零 wire 零事件） | —（已收口） | 已收口 | 闩锁 + 缓冲丢弃 | 零 wire、零 observer 事件、零 settled（单体静默纪律） |
| 重 OPEN（denied/failed 闩锁） | `NAMESPACE_REOPEN_REQUIRES_RECONNECT`（ns 级） | — | 存活 | 不建立 | ns ERROR 帧（无事件）；authorize 累计仍恰一次 |
| 合法帧无 sink（从未 OPEN / 宿主 undefined） | `NAMESPACE_STATE_VIOLATION`（ns 级，合成） | — | 存活（后续帧继续处理） | 不建立 | ns ERROR 帧 + `namespace-error{sent}`，逐帧 |
| 路由键违例 | `MALFORMED_FRAME`（连接级） | 1002 | fatal 收口 | 全部 quiesce | ERROR 帧 + close；零投递零回调 |
| 并发 OPEN 超上界 / pending 缓冲溢出（SD-2/SD-3） | `CONNECTION_POLICY_VIOLATION`（连接级） | 1008 | fatal 收口 | 已建会话按既有 quiesce 终结；被拒 OPEN 不建会话 | 恰一帧 ERROR + close + `connection-failed`；不静默丢帧 |
| `resolveSessionSink` throw/reject（OAP-C6） | `INTERNAL_ERROR`（连接级，fatal/yes） | 1011 | fatal 收口 | 不建立该 ns 会话；已建会话 quiesce | 恰一帧 ERROR + `transport.close(1011,'protocol-error')`；无静默 fallback |
| **宿主 sink `openNamespace`/`namespaceFrame` 同步 throw（R5/ER-2）** | `INTERNAL_ERROR`（连接级，fatal/yes） | 1011 | fatal 收口（投递点防御 catch） | 该 ns 无会话/已建会话 quiesce | 恰一帧 ERROR + close；异常不展开进 transport 回调；契约条款「sink throw = 宿主缺陷、连接终局」 |
| **宿主 sink `onConnectionClosed` reject（R5/ER-3）** | —（归一吞没） | —（收口照常） | 收口继续 | 清理照常发起 | `close()`/`settle()` 恒 resolve；`connection-dropped` 必达；零 unhandled rejection |
| **宿主 sink `terminateUnauthorized` reject（R5/ER-4）** | —（归一吞没） | — | 存活 | revoke 语义照常（终止帧/终局由 sink 自理） | `revokeNamespace` 恒 resolve（单体 terminationSettled 纪律） |
| 升级期各门（缺凭据/无认证器/裁决失败/文法违例/帧限/超时） | —（无 ERROR 帧；`auth-upgrade-rejected` reason 闭集） | 1008/1009 | 升级拒绝（零连接分配） | — | close code/reason + observer 事件 |

正常路径不变量缺失一律 fail-loud（台账缺失 → `openAdmission` 响亮 reject → **分类收口**（R4a，非 unhandled）；sink 未装配 → 构造 throw；egress 字节路径宿主成员缺失 → 响亮 throw——既有纪律继承，`hub-edge.ts:190–197`、`backpressure.ts:180–190`）；异常路径无静默 fallback、无吞错（升级拒绝的 transport.close 异常守卫是既有 #190 纪律，残局归 transport 所有者；**sink 清理异常的归一吞没是契约条款而非静默 fallback**——吞没的是宿主缺陷的善后，可观察面是「连接终局/恒 resolve」而非错误消失，R5）。

### 9.2 恢复与重试

- **对端可恢复**：连接级 fatal 后由 peer 按协议 §14 分类决定重连（1002/1008 blocked；1011 继续 backoff）；hub 侧无自动重试面（拓扑静态，ADR 0010）。
- **宿主可恢复**：`resolveSessionSink` 失败与 sink 投递 throw 均是连接终局而非重试点（诚实结果：连接停止服务，宿主修复后由 peer 重连重建）——不设计「换 sink 重试」静默路径（会在冻结公共面上埋入未定义重试语义）。
- **迟归续体**：连接收口后 authorize/解析照常结算传播（D5.6 继承）；deny/throw 迟归 → `finishTerminalSilently`（零 wire 零事件，R4b）；迟归 sink 仅得归一化 `onConnectionClosed` 卫生通知，零投递零 wire（§8.2）。
- **timer 纪律**：hello timer/auth timer/reauth deadline/poll timer 全部可清（收口路径单点清理，`hub-edge.ts:599–617` 纪律继承）。

### 9.3 并发与有界性

- **入站**：单线程全序分发（transport 回调序 = wire 序）；expectedSeq 单点校验；并发面 = in-flight OPEN 准入（≤4）与 pending 缓冲（≤16 帧，连接级共享）——两者溢出均响亮收口（§7-D3）。
- **出站**：单 `OutboundQueue` 单点分配序列（控制恒先；序列在出队时分配）；data 走单帧守卫 + 连接账本 admission（`backpressure.ts:165–178`）；控制走暂停态保留额度（耗尽 = 既有 `CONNECTION_BACKPRESSURE`(1011) 终局，不因本票变化）。
- **内存账**：pending ≤ 16 × maxFrameBytes（= 早到帧窗口同账，SD-3 推导）；适配器状态表每 (连接, ns) 至多一条记录；全部随连接释放（收口路径单点；`flushPending`/`discardBuffer` 单点递减 `pendingFrameCount`——SA2 N4）。
- **跨连接**：工厂级计数器单调（connectionKey 互异）；连接间零共享可变状态（每连接独立内部 edge + 适配器）。
- **fire-and-forget 续体**：`runSettle`/`runResolve` 入口 `.catch` 兜底 + 函数体内全路径分类（openAdmission reject → 分类；resolveSink throw → 分类；投递 throw → 防御 catch）→ 零 unhandled rejection（`hub-connection.ts:136–141` 识别的进程级风险面不引入新实例）。

### 9.4 幂等

| 操作 | 幂等性 | 锚点 |
|---|---|---|
| authorize | 每 (连接, ns) 恰一次（台账 + 闩锁）；重 OPEN/迟归不重复 | `hub-edge.ts:323–328,338–360`（零改动继承） |
| `resolveSessionSink` | pending 期重 OPEN 合流不重复；no-sink 重 OPEN 显式重解析（SD-5 裁决，§13-2 风险登记） | §8.2 伪码 |
| `settled` 通知 | 每 ns 至多一次（内部 edge Set + 适配器单点；已收口静默路径不通知——观测等价） | `hub-edge.ts:689–692` |
| `close`/`requestSinkClose` | 首次调用执行、重复零副作用（closedFlag + closeTail 缓存） | `hub-edge.ts:199–204,255–266` |
| `beginReauth` | `reauthRequested` 守卫；迟到/竞态零副作用 | `hub-edge.ts:270–296` |
| `terminateNamespace`/revoke | 无会话态无副作用 resolve；established 委托 sink 后**归一恒 resolve**（R5） | `hub-namespace.ts:1730–1734` 同形 |
| 升级拒绝 | `state.rejected` 标志幂等早退；`detach` no-op 句柄任意时刻安全 | `hub-upgrade-admission.ts`（搬迁后同文） |
| egress 发送 | 非幂等（每次调用 = 一帧出站 attempt）；拒纳返回 0 = 调用方可观察的诚实结果 | §7-D2 |

---

## 10. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/ws-replication/src/hub-edge-host.ts`（新增） | 公共工厂 `createHubReplicationEdge` + `HubReplicationEdgeFactory`/`HubReplicationEdgeOptions`/`HubReplicationEdgeConnection`/`HubNamespaceSessionSink`/`HubReplicationEdgeEgress`/`HubSessionSinkResolver`/`NamespaceAuthorizationGrant`/`HubOpenNamespaceMessage` 类型 + `HostSessionAdapter`（内部类）+ `MAX_CONCURRENT_OPEN_ADMISSIONS`/`MAX_PENDING_FRAMES_PER_CONNECTION` 常数 | D1–D7 全部新岗位的唯一落点；§8 全部伪码的载体 |
| `packages/ws-replication/src/hub-upgrade-admission.ts`（新增） | **逐字搬迁** `hub-connection.ts:44–151` 的自包含符号族：`MAX_EARLY_FRAMES`、`EarlyFrameAdmission`、`installEarlyFrameAdmission`、`closeAdmission`（含注释），模块级导出供包内消费；**不进 index.ts** | R2/SA8-A1 选项 α：`hub-connection.ts` 模块运行时导出面保持 `['createHubReplication']` 单键 → structure.test L616 零改动保持绿；#190「同一机制单点」保持（hub-connection + hub-edge-host 两消费方共享） |
| `packages/ws-replication/src/index.ts` | append-only：`export { createHubReplicationEdge } from './hub-edge-host.js'`（运行时导出 11 → 12，只增不减）+ 上述公共类型的 `export type` | EF-C1/GATE-C4；ADR 0032:41 后果节 |
| `packages/ws-replication/src/hub-connection.ts` | **最小 diff = 导入路径迁移**：删除 `hub-upgrade-admission.ts` 搬走的四符号定义，改为 `import { installEarlyFrameAdmission } from './hub-upgrade-admission.js'`（类型随值推导/类型导入）；accept/acceptTrusted 逻辑与模块运行时导出面零变化 | R2/SA8-A1 选项 α 落地（行为零变化；L616 保持绿）；SA8-A2 证据链修正后的准确表述（不再声称「组合根零 diff」） |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts` | **限定性 append-only 更新（R1）**：`FROZEN_PRODUCTION_EXPORTS` 数组追加 `'createHubReplicationEdge'` 一名（断言侧 `Object.keys(productionApi).sort()` 已排序比较，追加位置按字典序）；**零删除、零其他断言触碰、零测试条目增删** | #418 冻结的范围边界 = 该票「零新公共 API」；本票 = ADR 0032:41 后果节授权的公共导出面**首发布票**——C5a 的语义是「公共面增删均红」，首发布必然要求清单同步（不同步则 AC1 与 GATE-C1 不可兼得）；SA2 §9 行 1 同判；§14 复核面显式列入该 diff |
| `packages/ws-replication/test/ws-replication-issue421-edge-factory-api.test-d.ts`（新增） | EF-C1/EF-C2 类型层锁定（工厂/双入口/句柄/配置/sink/egress 签名 `expectTypeOf`；`namespaces` 替代 `channels` 的 D7 裁决落实；`ReplicationMessage` 来源包声明） | SA6 §12.0 路径 1 + SA2 N1 |
| `packages/ws-replication/test/ws-replication-issue421-edge-accept.test.ts`（新增） | EF-C2/EF-C3：双入口门序（含 6/7 次序）、verifyToken 恰一次/零调用、早到帧 admission parity | SA6 §12.0 路径 2 |
| `packages/ws-replication/test/ws-replication-issue421-open-admission-pipeline.test.ts`（新增） | OAP-C1..C8 + **C4b 交错组**（pending 期合流 OPEN 三结局投递面/应答帧数）、**迟归守卫组**（authorize 迟归于已收口连接 → 零 wire 零事件；openAdmission reject → ns INTERNAL_ERROR）、**sink 异常组**（投递 throw → 1011；onConnectionClosed reject → close 恒 resolve + onConnectionDropped 必达；terminateUnauthorized reject → revoke 恒 resolve）、**锁步断言**（准入表 ⟺ authorize 调用计数一致性） | SA6 §12.0 路径 3 + R3/R4/R5 验收增补 + SA2 N3 |
| `packages/ws-replication/test/ws-replication-issue421-route-key-parity.test.ts`（新增） | RK-C1/C2/C3：违例/无 sink 两分支 + 工厂 vs 单体 `createHubReplication.acceptTrusted` 同输入序列 hex 逐字节对比 | SA6 §12.0 路径 4 |
| `packages/ws-replication/test/ws-replication-issue421-error-routing.test.ts`（新增） | ER-C1/C2/C3：已建 ns 路由（解码回读值相等 + ≤64 字节预算见证）、连接级不路由、未知 ns 静默 | SA6 §12.0 路径 5 |
| `packages/ws-replication/test/ws-replication-issue421-wire-parity.test.ts`（新增） | WS-C1/C2/C3：多宿主 sink 交织 mux 严格递增、帧字节 == `encodeMessage(同占位消息,{sequence:k})`、连接隔离、收口后零新出站 | SA6 §12.0 路径 6 |
| `packages/ws-replication/test/ws-replication-issue421-edge-lifecycle.test.ts`（新增） | LC-C1..C4：GOAWAY/deadline/幂等、settled 驱动提前收口（含 pending 阻塞负控 + 已收口静默结算零事件）、drain 门、ping/pong 凭据与 dormant | SA6 §12.0 路径 7 + R4b 用例 |
| `CONTEXT.md` | 「复制 Edge」词条（:225–227）追加宿主出面句：公共工厂 `createHubReplicationEdge` 双入口、`resolveSessionSink`/`connectionKey` 宿主缝、pending 有界缓冲与并发 OPEN 上界为 edge 准入职责的公共面表达；_Avoid_ 增补「不得在宿主缝外自建连接级协议」。**改动限于该词条**（不触 SessionHost 词条 :229–231 机制措辞、不复述 ADR 0032:22 机制句——SA8 设计报告 §8-A5 边界） | SA8 A5（`docs/AGENTS.md` 域术语义务；`resolveSessionSink`/`connectionKey` 构成域术语） |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/replication-protocol/**` | 错误注册表/消息注册表/codec/wire | GATE-C4 零 diff（冻结面；零新错误码、零 wire 变更）；T1 守卫在此 |
| `packages/ws-replication/src/hub-edge.ts` | 连接级半边实现（被包装复用） | Architecture-C 核心：零 diff 保 #418 白盒锚（structure.test L617 模块面断言）+ R8'' 不触发 + 单体路径逐字节不变 |
| `packages/ws-replication/src/hub-split.ts` | 内缝契约 | R8'' 冻结面（port 成员集、`HubOpenAdmission` 词汇、锁步不变量） |
| `packages/ws-replication/src/hub-session.ts`、`hub-namespace.ts` | session 半边 + 通道 FSM（DENY 面） | R8''；协议状态机单份；工厂形态不经由它们 |
| `packages/ws-replication/src/frame-io.ts`、`backpressure.ts`、`liveness.ts`、`observer.ts`、`defaults.ts`、`validate.ts`、`types.ts` | 叶子件（盖章/发送/活性/观测/校验/类型） | 只消费不改：改 `types.ts` 公共类型即改冻结面；constants/validator 的 append-only 演进（若未来升级 limits 键）另票处理 |
| `packages/ws-replication/src/plugin.ts`、`peer-connection.ts`、`peer-namespace.ts` | Cordis 服务面 / peer 侧 | ADR 0032:4/44 零改动面（SA6 §10） |
| `packages/ws-replication/src/testing.ts` | 测试控制面 | 现有 `createMemoryDuplexTransport` 等已足够；扩 testing 面非本票义务（C5a 的 `FROZEN_TESTING_EXPORTS` 同步不受扰） |
| `packages/ws-replication/test/`（全部既有测试文件，**唯 ALLOW LIST 限定的 contract.test C5a 一处除外**） | 既有回归网 | GATE-C1/C3：588 测试语义/条目数/断言强度零变化；structure.test L616–619 **零改动**（选项 α 下模块键面不变）；C5a 的 append-only 一名是 R1 授权的唯一例外（理由与边界见 ALLOW LIST 该行） |
| `docs/adr/**`、`docs/protocols/instance-replication-v1.md` | 决策文本 / wire 契约 | 本票兑现已有决策，零决策文本变更（SA8 §6/§7）；R7'' 附录 deadline = T5，不提前不推迟 |
| `apps/yjs-server/**` | 下游消费者 | 现有消费面（`createHubReplication` 路径）零变化（GATE-C3） |
| `wiki/raw/task_issue-421_sa6_*`、`artifacts/sa6-issue421-*.log` | SA6 证据资产 | 只读输入 |

---

## 11. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| `apps/yjs-server`（`createHubReplication` listen 路径） | 服务层组合根装配 edge+session | 完全不变（wire 行为零变化；组合根仅早到帧 admission 导入路径迁移，行为零变化） | 无 | `hub-connection.ts:429–463`；GATE-C3 |
| `packages/ws-replication/src/hub-connection.ts`（单体组合根） | 自有私有 `installEarlyFrameAdmission` 等 | 消费 `hub-upgrade-admission.ts` 搬迁后的同一实现；**模块运行时导出面不变（`['createHubReplication']`）** | 导入路径迁移（删本地定义 + import；行为/导出面零变化） | `hub-connection.ts:44–151,268,353`（两消费点）；structure.test L616（本轮亲核保持绿） |
| `packages/ws-replication/src/index.ts` 消费者（含 `apps/yjs-server/src/index.ts:32`、`app.ts:58`、`transport/ws-server.ts:25`） | 11 个运行时导出 | +1（`createHubReplicationEdge`）+ 公共类型；既有成员零改名零删除 | 无（append-only） | `src/index.ts`；EF-C1 |
| **`packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts`（C5a 测试消费者，迭代 0 漏列——R1 修正）** | `import * as productionApi from '@nomicore/ws-replication'` + `toEqual(FROZEN_PRODUCTION_EXPORTS)` 11 名精确清单（「增删均红」） | 清单 append-only 追加 `'createHubReplicationEdge'` 一名后全绿；断言语义（精确等值 + 排序比较）零变化 | ALLOW LIST 限定行（一名追加，零删除） | contract.test `:50`（import）、`:144–156`（清单）、`:551`（断言）——本轮逐行亲核 |
| `#418` C0a–C0d 白盒/结构/契约测试 | 相对导入 `hub-edge.js`/`hub-split.js`/`hub-session.js`/`hub-connection.js` | structure.test **L616–619 全块**保持绿（四模块键面均不变——本轮逐条核对，迭代 0 的「仅引 L617」选择性取证已修正）；C5a 经授权追加；其余零改动 | 仅 contract.test C5a（见上行） | structure.test `:34,616–619`；contract.test `:551` |
| 内部 edge（`hub-edge.ts`，被包装） | 单体/listen 形态消费 | 工厂形态经 `sessionFactory` 注入 `HostSessionAdapter` 消费；两路径互不感知 | 无（该文件零 diff） | `hub-edge.ts:75,148–188` |
| nomic-server ingress 线程（目标宿主，库外） | 无公共入口可消费（G1） | `createHubReplicationEdge` 双入口 + `resolveSessionSink` 分片回调 + `connectionKey` 路由 | 宿主侧接入（库外，非本票交付物） | Issue 正文「What to build」 |
| 其余既有 77 测试文件 | 锚定零 diff 面 | 语义不变，直接保持绿 | 无 | GATE-C1/C3 |

返回值/抛错/nullable/异步时序语义变化面（审计）：既有面的返回值、抛错、时序零变化（`hub-connection.ts` 导入迁移无行为差；C5a 清单追加是测试期望同步不是产品面变化）。新面（工厂/回调/句柄/sink/egress）的语义即 SA6 契约目标行为 + 本设计 R3/R4/R5 修订（按 kind 冲刷、逐 OPEN 应答、结算守卫、sink 异常纪律），无未覆盖调用方。

---

## 12. 验收与验证映射

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1/EF-C1 公共导出 append-only | G1 红（TS2724 + `undefined`） | `edge-factory-api.test-d.ts`：import + `expectTypeOf` 锁签名；运行期 `typeof === 'function'` + `Object.keys` 相对 HEAD 只增；**C5a 同步后全绿为 GATE 前置（R1）** | 类型层绿；12 个运行时导出；负控：`createHubReplication`/插件族仍在；contract.test C5a 绿（清单含新名） |
| AC1/EF-C2 双入口 | G2 红 | `edge-accept.test.ts`：`accept` 恰一次 verifyToken（入参=token）；`acceptTrusted` 零调用 + 身份绑定（HELLO 自报 ≠ 受信身份 → `INSTANCE_IDENTITY_MISMATCH` 1008）；句柄面（state/peerInstanceId/authenticatedInstanceId/connectionKey/namespaces/egress/close/settle/beginReauth/revokeNamespace；`channels` 以 D7 裁决替代）；**门 6/7 次序语料（R6）**：即时 verifyToken + 升级期超界帧交错 → 观测事件集/close 行为与单体一致 | 缺 token/非串/裁决 null/畸形/throw/文法违例 → 1008 'upgrade-unauthorized' + reason 闭集；成功 → 句柄 + HELLO_ACK 正常 |
| EF-C3 早到帧 parity | 服务层已有（`hub-upgrade-admission.ts` 搬迁源） | 同文件：≤16 帧按序重放；第 17 帧 → 1008；单帧超界 → 1009；合规 HELLO 早到成功；**单体（迁移后）与工厂同输入同 close code/reason**（机制单点验证） | 与单体同输入同 close code/reason；structure.test L616 保持绿（搬迁不扩键面） |
| AC2/OAP-C1 HELLO/drain 门 | O6/O7 绿（内部半边） | `open-admission-pipeline.test.ts`：pre-HELLO OPEN → `HELLO_REQUIRED`+1002、零 authorize/回调；drain 窗口 OPEN → 零 authorize/回调/新会话 | wire + 回调计数 |
| AC2/OAP-C2 全解码 | O7 绿 | 坏 magic/截断/seq gap → 连接级注册表码 + 1002、零 authorize/回调/会话；合法 OPEN 进 authorize | wire + 计数 |
| AC2/OAP-C3 authorize 三分 | G4 红（deny 直达 session） | deny → ns 级 `NAMESPACE_UNAUTHORIZED` + 回调零调用 + 不建会话 + 连接存活；重 OPEN → ns 级 `NAMESPACE_REOPEN_REQUIRES_RECONNECT` 且 authorize 累计恰一次；throw → ns `INTERNAL_ERROR` + 连接存活；跨 ns 拒绝不互相影响 | wire 帧（点名 ns）+ 回调计数 + 存活性 |
| AC2/OAP-C4 pending 缓冲 + **C4b 合流交错（R3）** | G5 红 | 解析在途帧按到达序缓冲、成功后同序冲刷（**记录桩断言投递面分派**：OPEN 项 → `openNamespace`、非 OPEN 项 → `namespaceFrame(msg, seq)`）；成功后到达直投；有界性：第 17 项 → 恰一帧 `CONNECTION_POLICY_VIOLATION` + close(1008)；**C4b**：pending 期合流 N 个 OPEN × 三结局——established → N 项经 `openNamespace` 投递 + wire 由 sink 应答；denied/throw → **N 帧 ns ERROR**（应答帧数 = 合流 OPEN 数）+ `namespace-error{sent}` 恰一 + `namespace-failed` 恰一；no-sink → 零应答（§13-1(b)） | sink 到达序 + 投递面断言 + wire 应答计数 + 事件族恰一 |
| AC2/OAP-C5 并发上界 | G6 红（8/8 全到达） | 4 个并发 in-flight 全部正常解析零收口（负控）；第 5 个 → 恰一帧连接级 `CONNECTION_POLICY_VIOLATION` + close(1008) + 已建会话 quiesce + 不建会话；被拒 OPEN 的 authorize 已发起属登记行为（§13-3） | wire + close code + 回调计数 |
| AC2/OAP-C6 解析失败 | G7 红（零帧零 close） | `resolveSessionSink` throw 与 reject 两形态 → 恰一帧连接级 `INTERNAL_ERROR`（fatal/yes）+ `transport.close(1011)` + 不建会话 + 零静默 fallback；注册表零 diff 复核 | wire + close 1011 |
| AC2/OAP-C7 转发隔离 | NC4 绿（内部半边） | 解析成功后该 ns 帧投递（含 wire 序）；他 ns sink 零污染；未 OPEN ns 零投递 | sink 记录 |
| AC2/OAP-C8 调用序 + **锁步断言（SA2 N3）** | G3 红 | 记录桩断言 `authorize → resolveSessionSink → 首帧投递`；`authorization` = ok 投影（localOwner/permissions）；`connectionKey` 同连接恒定/跨连接互异；拒绝案回调零调用；pending 期重 OPEN 不新增解析调用；**锁步**：同一连接上适配器 `namespaces` 集与 authorize 调用计数/台账一致性（防未来实现漂移，比照 #418 C0d 先例） | 回调记录序 + 集合/计数一致 |
| **OAP-C9 迟归/守卫组（R4，新增）** | 单体纪律在档（`hub-namespace.ts:348,356,505–527`） | (a) authorize 迟归于已收口连接（并发他 ns fatal 先行）→ **零 wire、零 observer 事件**（denied/throw/authorized 三形态；authorized 形态下迟归 sink 仅得归一 `onConnectionClosed`）；(b) `port.openAdmission` reject 注入（台账缺失模拟）→ ns 级 `INTERNAL_ERROR` 分类收口 + 连接存活 + 零 unhandled rejection | wire 零帧 + 事件零发射（a）；ns ERROR 帧 + `namespace-failed`（b）；进程无 unhandledRejection |
| **OAP-C10 sink 异常纪律组（R5，新增）** | 单体不面对（sink 为库内实现） | (a) sink `openNamespace`/`namespaceFrame` 同步 throw → 恰一帧连接级 `INTERNAL_ERROR` + close(1011)，异常不展开进 transport 回调；(b) sink `onConnectionClosed` reject → `close()`/`settle()` 恒 resolve + `connection-dropped` 事件必达 + 零 unhandled rejection；(c) sink `terminateUnauthorized` reject → `revokeNamespace` 恒 resolve | wire + close + 事件 + promise 结局 |
| AC3/RK-C1..C3 路由两分支 + parity | O1/O2/NC1/NC4 + M1/M4 绿 | `route-key-parity.test.ts`：违例 → 连接级 `MALFORMED_FRAME`+1002+零投递+零回调；合法无 sink（含「从未 OPEN」「宿主 undefined」）→ 合成 ns `NAMESPACE_STATE_VIOLATION` + 存活；工厂 vs 单体同输入序列 hex 逐字节相等（差异容忍度 0） | wire hex + close code/reason |
| AC4/ER-C1..C3 ERROR 路由 | O3/O4/NC3 绿 | `error-routing.test.ts`：已建 ns ERROR 路由目标 = `decodeMessage` 回读 nsId、预算 ≤64 字节见证、连接存活；连接级 ERROR 零投递零回显；未知 ns 静默 | sink 记录 + wire + 存活 |
| AC5/WS-C1..C3 盖章 | O5/O5b/NC2 + M3 绿（内部） | `wire-parity.test.ts`：多宿主 sink 并发帧交织 → `[8..12]` 从 1 严格递增、交织序=出队序、入站 expectedSeq 不受影响；每帧 == `encodeMessage(同占位消息,{sequence:k})` hex；两连接各自从 1；收口后零新出站 | 出站帧字节 |
| AC6/LC-C1..C4 生命周期 | O6/O8 绿 | `edge-lifecycle.test.ts`：GOAWAY{REAUTH_REQUIRED, drain>0} + 'draining' + deadline 1001 + 幂等 + handshaking 直 close；settled 齐备 → 立即 1001 且 deadline 未 fire（timer 句柄复核）；任一 pending → 不提前；drain 门（OPEN 零回调、CLOSE 族照常）；ping 武装 + 凭据匹配/不匹配 pong + 缺面 dormant；**已收口连接的迟归结算零事件**（R4b 观测面） | wire + timer 驱动 + 存活 |
| GATE-C1..C4 门禁 | 基线 77 文件/588 测试绿 | 全量 `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/ws-replication`；`pnpm exec tsc -p packages/ws-replication/tsconfig.json`；`git diff --stat -- packages/replication-protocol/src` 为空；`src/index.ts` 只增不减；**structure.test L616–619 零改动保持绿**；**contract.test C5a 在 append-only 一名后全绿**；测试纪律（无 skip/only/todo/env override/源码字符串断言） | 全绿 / exit 0 / 空 diff / 588 条目数不变 |
| docs-sync | — | CONTEXT.md 词条复核（§10 ALLOW LIST；改动限「复制 Edge」词条） | 域术语与实现一致 |

旧/新实现期望（防「红在错误原因」）：EF 组 + OAP-C3/C4/C5/C6/C8 旧实现红 = 能力缺失（SA6 §5 实测）；RK/ER/WS/LC 组语义已绿（内部半边/单体），工厂落地后必须**直接绿**——落地后仍红即实现引入语义漂移，不得以「转绿」充数；NC1–NC4 恒绿。**OAP-C4b/C9/C10 为本迭代新增用例**：对迭代 0 伪码会红（合流 OPEN 投递面/应答数、守卫、异常纪律缺失），对修订后伪码必须绿——红因 = 实现未按本设计落地，非断言过宽。测试设施：内存双工 transport 可复用 `@nomicore/ws-replication/testing` 的 `createMemoryDuplexTransport` + 注入 timer（假 timer 手工推进，探针同款确定性形态）；parity 基线的单体侧需 Registry——复用既有 `test/harness.ts` 夹具。

---

## 13. 风险、回滚和残余问题

| # | 风险/决策点 | 等级 | 缓解/回滚 |
|---|---|---|---|
| 1 | **在途窗口行为分歧族（§7-D3 登记 + 本节完整化，R3/SA8-A4）**：单体对 opening 期 ill-timed 非.Open 帧**即答违例**（`hub-namespace.ts:839–848`），本设计缓冲。三态核对：**(i) established**——缓冲帧投递宿主 sink，真实 sink 产出与单体相同应答（时点后移）——非分歧；**(ii) denied/throw/failed 终局**——缓冲非 OPEN 项静默丢弃（单体会曾在到达点即答 STATE_VIOLATION）；**(iii) no-sink 终局**——缓冲 OPEN 项与首 OPEN 同待遇零应答（单体无对应态）。(ii)(iii) 不在任何 parity 语料内（RK-C3 = 违例/无 sink 帧；WS-C2 = 占位字节） | 中 | (ii)(iii) 显式登记为已知行为差（SA8 设计报告 §8-A4 裁决决策文本层 no-conflict）；收敛方案单点落在 `discardBuffer`/`finishTerminal`（结算时按到达序补发合成帧 / no-sink 项触发重解析），不伤结构；若 SA2/SA8 后续裁决贴单体，按该单点收敛 |
| 2 | **no-sink 重 OPEN 重解析**（SD-5 细化）：OAP-C8 负控「重复 OPEN 不新增解析调用」若被读宽（含 no-sink 态），本设计红 | 中 | 设计已把负控读法钉定在 pending 合流 + 拒绝闩锁（与 OAP-C3② 闩锁语义同源；SA8 设计报告 §3 行 8 裁决支持窄读法）；重解析的放大面与单体顺序开 ns 同界、受并发上界约束；若评审否决，回退为 no-sink 亦闩锁（拒答 `NAMESPACE_REOPEN_REQUIRES_RECONNECT`），改动单点 |
| 3 | **被拒 OPEN 的 authorize 已发起**（并发超额案）：内部 edge 到达点先建台账（T2 冻结序），超额拒绝发生在投递后 | 低 | AC2 管线序本身把上界排在 authorize 之后（正文序）；OAP-C5 未断言被拒 OPEN 的 authorize 计数；结局结算照常传播（D5.6）不产生外溢——已收口时经 `finishTerminalSilently` 静默（R4b）；设计显式登记 |
| 4 | **公共面首发布即冻结**：egress/handle/sink/config 八个类型一次定形（含 R5 异常纪律条款），事后只能 append-only | 中 | 最小面纪律（§7-D2）：只收 AC 必需成员；wheel/facet/观测类成员明确留待 T5 按 append-only 追加；命名与单体族（`HubReplicationOptions` 等）对齐 |
| 5 | **适配器复刻 deny/throw 观测面**（按 waiter 数应答 + 恰一事件族）与通道实现并存 | 低 | 帧构造单源（`namespaceErrorFrame`）+ 观测折叠单源（`stableNamespaceCode`/`dispatchReplicationObserver`）；复刻面收敛在准入窗口（会话生命周期开始之前），不触碰 bootstrap/sync/epoch FSM（无状态机分叉）；OAP-C3/C4b 断言 + parity 测试锁死 |
| 6 | **迟归解析/结算续体**：连接收口后 authorize/`resolveSessionSink` 才结算 | 低 | §8.2 显式双守卫：deny/throw/authorized 迟归 → `finishTerminalSilently`（零 wire 零事件零 settled，单体 `finishOpenSilently` 同构）；迟归 sink → 归一 `onConnectionClosed` 卫生通知 + 缓冲丢弃（R4b）；`runSettle`/`runResolve` 入口 `.catch` 兜底零 unhandled rejection |
| 7 | **命名冲突**（两处 `createHubReplicationEdge`） | 低 | 模块路径区分 + 导入别名 + 双模块头注释互指；公共名字唯一归 index.ts 导出面；#418 断言（structure.test L617）不受影响 |
| 8 | **冻结测试期望的授权触碰面（R1/R2 残余风险）**：C5a 清单追加是 #418 合并完成门的期望更新；搬迁虽保持 L616 绿但 `hub-connection.ts` 有真实 diff | 低-中 | 触碰面收敛为：C5a 一名追加（append-only、理由登记 §10）+ `hub-connection.ts` 导入迁移（行为零变化、模块键面不变）；§14 复核面显式列两处 diff 逐项核对；GATE 断言「L616–619 零改动保持绿 + C5a 更新后全绿 + 588 条目数不变」双保险 |
| 9 | 回滚条件：实现后发现单体路径或既有 588 测试任何回归（GATE-C1/C3 红）→ 回滚实现。**回滚 = 删两个新增源文件 + 还原 `hub-connection.ts` 导入迁移（恢复本地符号定义）+ 还原 index.ts 追加 + 还原 C5a 清单一名 + 删 7 个新测试文件**——全部为可逆原子操作，无数据迁移、无持久化面 | — | 结构性可回滚 |

**任务内必要条件**（非 follow-up 伪装）：G1–G9 全部岗位由本设计覆盖；SA6 §12 契约条目全部有设计落点（§12）；SA2 R1–R6 与 SA8 A1–A5 全部有修订落点（§15）。

**Follow-up（明确不属于本票）**：(a) T5 worker 形态（跨线程缝传输、入站缝形态、`openAdmission` 拉取形态重塑——重新过 SA8；R5''/R7'' deadline）；(b) `listen:false`/`nomicoreHubSessionHost` 服务面；(c) egress 观测类成员 append-only 追加（`onDataQueued`/facet/`bufferedAmount`）；(d) 上界常数 → limits 键升级（含 `validateLimits` 链）；(e) 工厂级服务面聚合（connections/revoke 广播/close）；(f) peer 侧对称拆分。

---

## 14. 是否需要设计后 ADR 冲突复查

**是（`requiresConflictRecheck: true`）**。理由：

1. **公共 API 面首发布**：`src/index.ts` append-only 新增 + 8 个公共类型 + 工厂/句柄/egress/sink 面——发布即按 SA6 纪律冻结（ADR 0032:43），需设计后复审逐项核对面形与冻结纪律。**含 R5 新增的 sink 异常纪律契约条款**（throw = 宿主缺陷 → 1011 终局；reject 归一）——这是发布即冻结面上的新失败语义，属复审应显式裁决项。
2. **新增生命周期所有权与失败语义**：宿主 sink 生命周期（`onConnectionClosed`/`terminateUnauthorized`/settled 通知归宿主）与新连接收口路径（OAP-C5 `CONNECTION_POLICY_VIOLATION`/1008、OAP-C6 `INTERNAL_ERROR`/1011、R5 sink-throw 1011 的选码理由登记）——SA8 冲突报告 §10 同判。
3. **SD-1~SD-6 裁决面 + R3/R4 收口读法**：SD-5 的 no-sink 重解析与 §13-1 分歧族（含本迭代补全的 (ii)(iii) 两交错登记 + 按 waiter 数逐 OPEN 应答的收敛）是复审应显式裁决的点；R4a `openAdmission` reject → ns `INTERNAL_ERROR` 与 R4b 静默结算守卫是对单体纪律的对齐实现，一并核对。
4. **Architecture-C 触碰面核验（含 SA2 N5 / SA8-A2 增补）**：`hub-split.ts`/`hub-edge.ts`/`hub-session.ts`/`hub-namespace.ts` 零 diff 核对；**`hub-connection.ts` 导入路径迁移 diff 逐项核对（行为/模块键面零变化）**；**`hub-upgrade-admission.ts` 搬迁逐字性核对（注释随迁、两消费点共享）**；**contract.test C5a 的 append-only 一名 diff 核对（零删除、断言语义不变）**；structure.test L616–619 零改动保持绿——四类 diff 全部显式列入复审范围（SA8 设计报告 §8-A1/A2 落实）。

无需 ADR/协议文本修订：本设计全部兑现已有决策（SA8 §3：implements-existing-decision ×4、no-conflict ×12）；R7'' 附录 deadline 不变（T5）。

---

## 15. 评审修订映射

### SA2 攻击评审（`wiki/raw/task_issue-421_sa2_review.md`，verdict=reject）

| Finding | 修订位置 | 处理结果 |
|---|---|---|
| **R1（BLOCKER）**：index.ts 新增导出击红 C5a `FROZEN_PRODUCTION_EXPORTS`（精确等值「增删均红」）；「588 零改动全绿」四处自相矛盾 | §1 目标 1（落地前提）、§2.1 新证据行、§5 表末行、§10 ALLOW LIST（contract.test 限定行 + DENY 例外化）、§11（C5a 测试消费者行）、§12（EF-C1/GATE 行）、§13-8/9（风险登记 + 回滚含 C5a 还原）、§14-4（diff 核对） | 已收口：C5a 清单 append-only 一名纳入 ALLOW LIST + 授权理由（#418 冻结边界 vs 本票首发布授权）；DENY/GATE/调用方矩阵/回滚/复核五处一致化——「零改动」表述改为「唯授权例外一处」，矛盾消除 |
| **R2（BLOCKER）**：`hub-connection.ts` 模块级导出 `installEarlyFrameAdmission` 击红 structure.test L616（模块键精确等值） | §7-D1（早到帧 admission 单点复用段：选项 α 采纳 + β/γ 否决理由）、§2.1（自包含符号族证据行 + L616 证据行）、§10（`hub-upgrade-admission.ts` 新增行 + hub-connection.ts 行改写）、§11（hub-connection 行 + C0a–C0d 行引 L616–619 全块）、§12 EF-C3、§13-8/8、§14-4 | 已收口：选项 α（SA8-A1 推荐）——四符号逐字搬迁新内部模块，`hub-connection.ts` 改 import 消费；模块键面不变 → L616 零改动保持绿；#190 机制单点保持 |
| **R3（MAJOR）**：pending 冲刷伪码三缺口——OPEN 经 `namespaceFrame` 投递（契约违约 + sequence 缺失）、deny/throw 应答帧数与单体 waiter 语义不符、no-sink 交错未登记 | §7-D3（阶段 3 应答语义 + 阶段 4 按 kind 分派 + SD-5 登记选择）、§8.2（`PendingItem` 按 kind 分型 + `flushPending`/`deliverOpen`/`deliverFrame` + `finishTerminal` 按缓冲 open 项数应答 + 语义映射表）、§12 OAP-C4（投递面断言）+ OAP-C4b（合流交错三态用例）、§13-1（分歧族三态完整化：(i) 非分歧 (ii) 已登记 (iii) 显式登记 + 收敛方案） | 已收口：(1) 冲刷按 kind 分派（open → `openNamespace`、frame → `namespaceFrame(msg, seq)`——类型自洽）；(2) deny/throw/failed 终局按缓冲 OPEN 数逐帧应答 + 事件族恰一（HB2）——**收敛到单体**；(3) no-sink 合流 OPEN 零应答 = 显式登记选择（§13-1(iii)，收敛回退方案在档）；(4) OAP-C4b 用例入 §12 |
| **R4（MAJOR）**：`settleAdmission` 缺 `openAdmission` reject 处理（单体 → ns INTERNAL_ERROR）与连接收口守卫（单体 `isOpenAborted` → 静默） | §8.2（`settleAdmission` try/catch + `finishTerminal`/`settleAdmission` 前置 `connectionClosed` 守卫 + `finishTerminalSilently` + `runSettle`/`runResolve` 入口 `.catch` 兜底 + 语义映射表两行）、§7-D6（reject 同归 ns INTERNAL_ERROR）、§9.1（reject 行 + 迟归行）、§9.3（fire-and-forget 续体纪律）、§12 OAP-C9（两用例）+ LC 行、§13-6、§14-3 | 已收口：(a) reject → `finishTerminal(ns,'INTERNAL_ERROR')`（对齐单体 shim reject → `startOpen` catch，响亮有分类，连接存活）；(b) 迟归终局 → `finishTerminalSilently`（零 wire 零事件零 settled——`finishOpenSilently` 逐点同构，含「不通知 settled」的观测等价论证）；(c) 零 unhandled rejection（入口兜底）；(d) OAP-C9 用例入 §12 |
| **R5（MAJOR）**：公共 sink 缝 throw/reject 纪律未定义（ER-2/3/4：投递 throw 展开、onConnectionClosed reject 跳过 onConnectionDropped、terminateUnauthorized reject 穿透） | §7-D2（接口注释异常纪律条款 + 边界声明 + 否决「显式透传」备选）、§8.2（`deliverOpen`/`deliverFrame` 防御 catch + `close()` 逐 sink 归一 + `terminateNamespace` 归一 + 迟归 sink 归一通知 + 语义映射表三行）、§9.1（三行新失败面）、§9.4（revoke 幂等行更新）、§12 OAP-C10（三用例）、§13-4（冻结面含异常条款）、§14-1 | 已收口：四成员纪律全部定义并写入契约注释——投递 throw → 防御 catch → `connectionFatal('INTERNAL_ERROR',1011)`；`onConnectionClosed` reject → 逐 sink 归一（`close()`/`settle()` 恒 resolve、`onConnectionDropped` 必达、零 unhandled rejection）；`terminateUnauthorized` reject → 归一（`revokeNamespace` 恒 resolve，单体 `terminationSettled` 同形）；OAP-C10 三用例入 §12 |
| **R6（MINOR）**：门 6/7 次序与单体颠倒（让位复查先于文法检查，`hub-connection.ts:304–315`） | §2.1（门序事实行更正）、§7-D4（步骤 6=让位复查、7=文法，标注「次序对齐单体——R6 修订」）、§12 EF-C2（门 6/7 次序语料）、§8.3 R5 路线（次序表述） | 已收口：交换次序对齐单体（微任务让位 + 迟拒兜底复查 → instanceId 文法），不再登记为有意偏差 |
| N1（`ReplicationMessage` 类型来源） | §7-D2 类型来源声明段 + §10 test-d 行 | 已收口：来源包声明（`@nomicore/replication-protocol`）+ 结构化推导说明 + 不转出口决策 |
| N2（verifyToken 可选 ≠ 运行时容错） | §7-D4 门 2 + §8.1 | 已收口：措辞补全「类型可选 ≠ 运行时容错——accept 路径缺认证器仍 fail-closed 1008」 |
| N3（锁步不变量测试表达） | §12 OAP-C8 锁步断言行 | 已收口：`namespaces` 集 ⟺ authorize 计数一致性断言（比照 #418 C0d 先例） |
| N4（pendingFrameCount 账目单点） | §8.2 `flushPending`/`discardBuffer`（单点递减注释）+ §9.3 | 已收口：冲刷与丢弃统一经两 helper 单点记账 |
| N5（§14 复审范围含测试期望 diff） | §14-4（C5a diff + 搬迁逐字性 + L616–619 零改动四类核对显式列出） | 已收口 |
| N6（分歧登记纪律肯定） | §13-1 完整化（吸收其结构） | 已采纳 |

### SA8 设计后复审（`wiki/raw/task_issue-421_design_conflict_report.md`，verdict=reject）

| 行动 | 修订位置 | 处理结果 |
|---|---|---|
| **A1（阻断）**：消除 L616 冻结完成门违规（三选项） | §7-D1（选项 α 采纳 + β/γ 否决登记）、§10（`hub-upgrade-admission.ts` 行 + hub-connection.ts 行改写为「导入路径迁移」）、§11、§13-8/9、§14-4 | 已收口：选项 α 落地——`hub-connection.ts` 运行时导出面保持 `['createHubReplication']` 单键，C0c L616 零改动保持绿；不触碰 #418 合并冻结测试 |
| **A2（阻断，随 A1）**：证据链修正——「组合根零改动」「C0a–C0d 零改动保持绿」「仅引 L617 漏 L616」「清单略 C0c」四处失真 | §7-D1 理由 2（重写为「冻结面触碰收敛到两处显式授权点」+ C0c L616–619 逐条绿声明）、§11（C0a–C0d 行引 L616–619 全块 + C5a 消费者行补列）、§10（hub-connection.ts 行措辞 = 导入迁移非零 diff 声明）、§13-9（回滚故事含迁移还原） | 已收口：四处口径统一——`hub-connection.ts` 有真实 diff（导入迁移）但行为/键面零变化；C5a 有期望更新（append-only 一名）；structure.test 零改动 |
| A3（非阻断）：协议 §2「同步 TypeError」括注读法登记 | §6（协议 §2 行）、§7-D4 门 2（读法登记全文） | 已收口：双入口条件依赖 + 「accept 永不 reject」冻结不变量 ⟹ 工厂面以 1008 + `verifier-missing` 兑现 §2 硬核（单体运行期纵深防御形态逐字节一致，`hub-connection.ts:263–267`） |
| A4（非阻断）：两项自登记分歧裁决落档（no-sink 重解析 vs 不变量 4；缓冲 vs 即答违例） | §7-D3 SD-5（引 §3 行 8 裁决）、§13-1（分歧族三态完整化 + 收敛回退方案维持） | 已落档：维持登记 + 收敛方案；本迭代按 R3 把可收敛部分（established 投递面、deny/throw 应答数）收敛，残余交错 (ii)(iii) 维持登记待后续裁决 |
| A5（实现票义务）：CONTEXT.md 边界 + 冻结面实现 diff 核对 | §10（CONTEXT.md 行：改动限「复制 Edge」词条）、§14-4（四类 diff 核对 + 公共面逐成员核对） | 已落档为实现票验收边界 |
