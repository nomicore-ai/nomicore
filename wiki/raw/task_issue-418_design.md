# 设计 — issue #418：`HubConnectionImpl` 拆分 Edge/SessionHost + 单体进程内组合（ADR 0032 决策 1 / spec #415 T2）

- Dispatch：`sa-e45dbd41-f33c-4d46-8c42-c81ae6b22d8d`（mabf-sa1 / design / iteration 2）
- 基线 worktree：`/home/wangjian/nomicore-fix-issue-418`，分支 `mabf/issue-418`，HEAD `27e012b6606e48797842a79e11e3505819c34cc6`（worktree 内含 SA3 iteration 0 的未提交实现——见 §5/附录 B 适配清单）
- 上游输入：`wiki/raw/task_issue-418.md`（Host 简报）、`wiki/raw/task_issue-418_sa6_contract.md`（SA6 契约，approve）、`wiki/raw/task_issue-418_sa2_review.md`（SA2 **approve** + F5 MINOR + N1~N5）、`wiki/raw/task_issue-418_design_conflict_report.md`（SA8 **clear** + 注 A/B/C + §8-R1~R9，针对 iteration 1 形态）、`wiki/raw/task_issue-418_sa3_impl.md`（SA3 实现 + **reject**：§7 设计级 BLOCKER）
- 权威决策：`docs/adr/0032-transport-decoupling-edge-session-split.md`（已接受）；规范 wire 契约：`docs/protocols/instance-replication-v1.md`
- 本版为 **iteration 2 修订**：逐条落实 SA3 §7 BLOCKER（其建议的**方案 A**：到达点建通道 + 异步 edge-owned admission 路由），整体替换 iteration 1 的「pending 窗口日志 + 结算同步段回放」机制（D5.1/D5.2）及其衍生物（二相 OpenEntry、PendingEvent、强制结算、terminate 标记、投影存储、`revoked` 结局）；iteration 1 被 SA2/SA8 认可的其余机制（D1 模块面、D3 出站盖章、D4 定偏移路由、D6 信号映射、D7 组合根、D8 冻结总账）逐字维持或仅受 D5 替换的局部牵连。被证伪的机制不保留任何矛盾残段。

---

## 1. 任务类型、目标与非目标

**任务类型：wide refactor（行为保持型结构重构）**。无用户可见缺陷；SA6 契约已证实基线全绿（72 文件/518 用例 → +契约 73 文件/535 用例；根 `pnpm test` 436 文件/5260 用例 + typecheck 全绿，`artifacts/sa6-issue418-*.log`）。

**目标**：

1. 把 `HubConnectionImpl`（`src/hub-connection.ts:451-1138`，模块私有类）承载的连接级 FSM 与 namespace 级职责沿既有 `HubChannelHost` 内缝劈为**两个可独立实例化的内部模块**：
   - **HubReplicationEdge**（连接级半边）：envelope/sequence 纪律（入站 expectedSeq 校验 + 出站单点盖章）、HELLO 与 capability 协商、liveness、GOAWAY/reauth、连接级背压、OPEN 准入（**真实 authorize 在 edge 单点调用，结算结局经缝以异步拉取交付**，D5.2）、帧路由键提取。
   - **HubSessionHost**（namespace 级半边）：`HubNamespaceChannel` 全部生命周期（**首个 OPEN 到达点即建通道**，= HEAD 时序）、Registry open、session 驱动、出站合并（多通道出站帧在单一 mux 点汇流）。
2. 单体 listen 模式重构为两者的**进程内组合**（缝 = 函数调用）；协议状态机保持单份实现。
3. 出站帧 session 半边以 sequence=0 占位编码、edge 半边在 mux 点重写帧字节 `[8..12]`；入站 sequence 由 edge 半边校验。

**必须保持的行为不变量（硬约束）**：

- 零新公共 API（`src/index.ts` 11 个运行时导出 + `/testing` 5 个冻结，SA6 C5a）；零配置变化（`DEFAULT_*` 三常量冻结，C5b）。
- wire 逐字节不变。等价判据（本版因 D5 替换而**强化**）：**每一帧的字节、每个 namespace 内的帧序与事件序、全部既有测试面**逐点不变——且 authorize 窗口内的帧效应回到**到达点**产出（= HEAD 时序，连 iteration 1 登记的「跨 ns 微任务交错」「窗口效应推迟至结算」两类窄差一并消除）；两处显式登记的残余除外——(i) 非暂停控制帧在「出站序列已耗尽 ∧ 消息不可编码」同时成立时的错误类归属（§7 D3.3 登记的双不可达角落，R4'）；(ii) authorize 结算续体的微任务跳数（HEAD 1 跳 → 设计约 3 跳，§13 R6'）。
- `src/hub-namespace.ts` 零 diff（AC3；authorize 仍经注入的 `HubChannelHost.authorize` 接口调用——shim 在 session 组装，D5.3）。
- 既有全量测试**不改而绿**（AC4，含 SA3 §7 证伪 iteration 1 的两个既有测试：`ws-replication-ac7-faults.test.ts:32-56` 与 `ws-replication-issue171-red.test.ts:177-208`——本版机制下两者由构造保证绿）；包 typecheck + 根 `pnpm typecheck` / `pnpm test` 绿灯（AC5）。

**非目标**（issue 明示 + ADR 0032 后果节）：

- peer 侧对称拆分（`peer-connection.ts` / `peer-namespace.ts` 不动）。
- `listen:false` 表达、`nomicoreHubSessionHost` 服务、`createHubReplicationEdge` 公共导出面（后续票；本票若导出即触发 SA6 U4 冲突信号）。
- worker_threads / MessageChannel 依赖（ADR 决策 2：nomicore 零依赖，传输实现属宿主）。
- wire 格式、`docs/protocols` 文本、观测事件字段集（append-only 不变，本票零新增 observer 面）。

---

## 2. 当前行为与证据锚点（HEAD 27e012b）

### 2.1 入站管线（`hub-connection.ts`）

| # | 事实 | 锚点 |
| --- | --- | --- |
| I1 | `accept`/`acceptTrusted` 完成 5/4 道门 + 有界早到帧 admission（≤16 帧、单帧 ≤ maxFrameBytes、拒绝即 1009/1008 close + `auth-upgrade-rejected` 事件）后，`new HubConnectionImpl(internals, transport, connId, identity, earlyFrames)` 分配连接，构造尾部按序重放早到帧 | `hub-connection.ts:101-145, 254-347, 349-398, 561-569` |
| I2 | `onMessage`：`decodeInbound(bytes, {expectedSequence, maxFrameBytes, selectedCapabilities})` 单点全解码（序列检查先于 payload），失败 → `connectionFatal(code, wsCloseCodeFor(code))`；成功后 `expectedSeq = sequence + 1`，再分派 | `hub-connection.ts:666-695`；`frame-io.ts:63-74`；codec `envelope.ts:125-133`（序列检查）、`payloads.ts:917-920`（UPDATE_CHUNK 协商门控） |
| I3 | handshaking 态：仅 HELLO 合法，其余 → `HELLO_REQUIRED` fatal 1002 | `hub-connection.ts:684-691` |
| I4 | `onHello`：身份绑定（HELLO 自声明 == 认证身份、hub 实例匹配）→ `selectProtocolVersion([1])` → `selectCapabilities`（HUB_SUPPORTED = CAP_CHUNKED_UPDATE）→ 置 ready、捕获 connectionId、武装 liveness（ping/onPong 在场 + clock+observer 延迟探针）、清 hello timer、发 HELLO_ACK | `hub-connection.ts:697-785` |
| I5 | `dispatchReady`：drain 门（GOAWAY 窗口内 OPEN_NAMESPACE/BOOTSTRAP_ACK/SYNC_STEP1/SYNC_STEP2/RESYNC_REQUIRED/UPDATE/UPDATE_CHUNK 静默丢弃；SYNC_APPLIED/UPDATE_ACK/CLOSE_NAMESPACE/CLOSE_OK/ERROR 不在门内——ACK/ERROR 仅结算 drain 前工作、CLOSE 族保留自然握手）→ 方向纪律（HELLO/HELLO_ACK/OPEN_OK/BOOTSTRAP_SNAPSHOT/IDENTITY_CHANGED/GOAWAY → `CONNECTION_POLICY_VIOLATION` 1008）→ OPEN_NAMESPACE → `onOpenNamespace`（**无通道即同步建 + `startOpen`——authorize await 发生在通道 `'opening'` 态内，通道在 OPEN 到达点即在场**；有通道即 `onOpen`）→ 其余经 `withChannel` 分派（未知 ns → 合成 `NAMESPACE_STATE_VIOLATION` + `namespace-error{sent}` 事件；ERROR 帧未知 ns → 静默丢弃；CLOSE_OK 收到即方向异常 → `onErrorFrame(STATE_VIOLATION)`）；UPDATE 先做字段级超限判别（纯函数，limits 常量） | `hub-connection.ts:787-878, 880-894, 896-922`；`frame-io.ts:77-91` |
| I6 | `startOpen`（通道内）：`await host.authorize(peerInstanceId(), nsId)`（throw → `INTERNAL_ERROR`；`!ok ∨ !read` → `NAMESPACE_UNAUTHORIZED`，均 `finishOpenError(code,'open-failed')`，且两分支均先判 `isOpenAborted` → 终态/closing 时**静默收口零 wire 零事件**）→ `registry.open`（**仅在 ok 分支被越过；D-H1：authorize 恢复点不拦截 registry.open，中止判别自 registry.open 恢复点起逐点生效**）→ lease → `openReplicationSession` → 订阅 fanout → `flushOpenWaitersOk` → bootstrap(mode 0)/reconciling(mode 1)；全程中止判别 `isOpenAborted`（终态 ∨ closing） | `hub-namespace.ts:335-459`（authorize :344-359、registry.open :360-372、中止判别注释 :352-354） |
| I7 | re-OPEN 状态矩阵：终态 → `NAMESPACE_REOPEN_REQUIRES_RECONNECT` ERROR（无事件）；closing → 收口链上补发同款；opening → openWaiters 合流（不重复 authorize/Registry open）；已建立（bootstrapping/reconciling/live/needs-resync）→ 立即再答 OPEN_OK | `hub-namespace.ts:289-332` |
| I8 | `finishOpenError`：取走全部 waiter 逐个发 `namespaceErrorFrame(code, nsId)`（N 个 OPEN → N 帧）→ `emitNsErrorSent(code)` 恰一 → `setState(终态)`（`channel-state-changed` 事件；仅 `'opening'` 或非终态时迁移）→ failed 时 `emitNamespaceFailed(cause)` 恰一 → `closeSessionAndRelease` → **尾部无条件 `notifySettled()`**（记忆位幂等） | `hub-namespace.ts:483-503, 1656-1713` |
| I9 | 通道对入站帧的静默门：`isQuietState()`（closing/终态）使 UPDATE/UPDATE_ACK/SYNC_*/RESYNC/UPDATE_CHUNK/BOOTSTRAP_ACK(非 bootstrapping 分支)/CLOSE_NAMESPACE(终态分支)/ERROR(closing/终态分支) 全部静默忽略 | `hub-namespace.ts:650-656, 688-735, 839-874, 1095-1170, 1742-1749` |
| I10 | **authorize 窗口帧矩阵（D5 等价的根证据）**：通道 `'opening'`（authorize 在途）时到达的同 ns 非 OPEN 帧**即时进入通道 FSM 并在到达点产生 wire 帧/事件**——见 §2.2；结算时（无论 ok/deny/throw）若窗口帧已使通道进入 closing/终态，authorize 续体走 `isOpenAborted` → 静默收口（OPEN 本身无任何回复） | §2.2 全表；`hub-namespace.ts:529-531` |
| I11 | **revoke 竞态**：服务层 `revoke(instanceIdentity, nsId)` → `channels.get(nsId)`——authorize 窗口内通道**在场**（`'opening'`）→ `terminateUnauthorized()` 响亮（`NAMESPACE_UNAUTHORIZED` ns ERROR + `namespace-error{sent}` + failed(`protocol-violation`) + settled）；若窗口帧已先收口通道则 `isQuietState` → no-op resolve。之后 authorize 续体 → `isOpenAborted` → 静默（ok 结局时 D-H1 仍会 transient 调 `registry.open` 并在下一恢复点回收 lease——H1 修复点） | `hub-connection.ts:406-427, 620-625`；`hub-namespace.ts:1186-1191, 352-372` |
| I12 | 终态通知：`notifySettled()` 记忆位保证每通道至多一次；`finalize`/`finishOpenError`/`onCloseRequest` 收口链尾部三入口无条件调用 ⇒ **通道进入终态 ⟺ settled 已通知**（同一同步/异步块内完成，无观测空窗）；`closing` 态通道尚未通知（自然收口在 CLOSE_OK 上 wire 后） | `hub-namespace.ts:130, 502, 1130, 1674-1713` |
| I13 | **既有测试在 authorize 窗口到达点的两处观察锚（SA3 §7 BLOCKER 主证，本版等价判据的硬门）**：(a) `test/ws-replication-ac7-faults.test.ts:32-56`——授权门闩悬挂时注入 UPDATE 后 `hubFrames('ERROR')` **必须已含** `NAMESPACE_STATE_VIOLATION`（:53）；(b) `test/ws-replication-issue171-red.test.ts:177-208`（SA6 H1）——`untilMicrotask(() => hub.connections[0].channels.get(nsId)?.state === 'opening')`（:183）为前置锚，且连接静默后放行 authorize 必须释放已交付 lease（:194，D-H1 续体） | 两测试文件（DENY，不改而绿） |

### 2.2 authorize 窗口帧矩阵（'opening' 通道 × 入站 kind；全部由零 diff 通道代码在**到达点**承载）

| 入站 kind（authorize 在途时到达） | HEAD 即时行为（wire + 事件） | 锚点 |
| --- | --- | --- |
| UPDATE（字段合法） | 非 live/needs-resync/reconciling-wasLive → `sendNsError('NAMESPACE_STATE_VIOLATION')`（ns ERROR 帧 + `namespace-error{sent}`）+ `finalize('failed','protocol-violation')`（`channel-state-changed` opening→failed + `namespace-failed`）+ settled | `hub-namespace.ts:839-849` |
| UPDATE（字段超限，连接层判别移交） | `onFieldViolation(code)`：非 quiet → `sendNsError(code)` + failed(`protocol-violation`) | `hub-connection.ts:836-845`；`hub-namespace.ts:832-837` |
| UPDATE_CHUNK kind0 首 chunk | 状态门镜像 onUpdate → STATE_VIOLATION + failed | `hub-namespace.ts:902-910` |
| UPDATE_CHUNK kind1 首 chunk | hub 无合法 kind1 上下文 → STATE_VIOLATION + failed | `hub-namespace.ts:892-896` |
| UPDATE_CHUNK kind2 首 chunk | `admitHubSyncChunk` → 无活跃 round → `SYNC_STATE_VIOLATION` + failed | `hub-namespace.ts:898-900, 924-935` |
| UPDATE_CHUNK chunkIndex>0（idle） | 非 needs-resync/reconciling → `transferViolation`（响亮） | `hub-namespace.ts:884-890` |
| BOOTSTRAP_ACK | 非 bootstrapping ∧ 非终态 → STATE_VIOLATION + failed | `hub-namespace.ts:650-656` |
| UPDATE_ACK | 非 quiet → `channel.onAck` 无在途 → `'violation'` → **`host.connectionFatal('ACK_STATE_VIOLATION', 1002)`（连接级收口：ERROR 帧 + close 1002 + `connection-failed`）** | `hub-namespace.ts:1095-1102` |
| CLOSE_NAMESPACE | 非 closing/终态 → `setState('closing')` + 清 timer + 收口链：drain applies → session close → lease release → **CLOSE_OK{ackedSequence=入站序}** → `setState('closed')` → settled；此后 authorize 续体 `isOpenAborted`（closing/终态）→ 静默 | `hub-namespace.ts:1104-1132` |
| RESYNC_REQUIRED | 非 quiet → `markResyncReceived` + `setState('needs-resync')`（**非终态非 closing**）+ `emitResyncRequired('remote-declared')` 事件；此后 authorize **ok** 结局不被中止（`isOpenAborted` false）→ open 续体完整执行（registry.open/session/OPEN_OK→mode 分支 setState 覆盖） | `hub-namespace.ts:1134-1148, 529-531, 397-457` |
| ERROR（带本 nsId） | 非 closing/终态 → `namespace-error{received}` 事件（含 terminalState）+ `finalize(terminal by code)`（failed → cause `remote-error`） | `hub-namespace.ts:1150-1171` |
| CLOSE_OK（hub 收到 = 方向异常） | `onErrorFrame({code:'NAMESPACE_STATE_VIOLATION'})` → 同 ERROR 行（received 事件 + finalize） | `hub-connection.ts:853-855`；`hub-namespace.ts:1150-1171` |
| SYNC_STEP1 / SYNC_STEP2 | 非 quiet → round 引擎；session 未就绪时 `RoundAborted` 被吞（静默），不收口通道 | `hub-namespace.ts:688-709` |
| 再 OPEN（同 ns） | `'opening'` → openWaiters 合流（零 authorize、零帧）；deny 结算时随 `finishOpenError` 逐 waiter 出 N 帧 | `hub-namespace.ts:309-313, 483-488` |

**矩阵的推论（D5 机制选择依据）**：窗口帧行为不是「静默丢弃」——除 SYNC_STEP1/2 的 RoundAborted 外全部在**到达点**产生 wire 帧和/或观测事件，其中 UPDATE_ACK 可触发**连接级** fatal、CLOSE_NAMESPACE 触发 CLOSE_OK 收口链。任何「edge 侧手工复现」该矩阵的方案都是在 edge 重建 `'opening'` 行的通道 FSM（fork，违反 ADR 决策 1 单份 FSM）；任何「缓冲后延迟」方案都把到达点效应推迟（iteration 1 的结算段回放即为此类——被 I13(a) 证伪）；任何「缓冲后丢弃」方案都丢失这些帧/事件（违反 wire 逐字节不变）。**唯一同时满足三者的形态是本版 D5：通道在到达点在场、窗口帧即时进入零 diff 通道 FSM、authorize 结局经缝异步交付**。

### 2.3 出站管线（单点序列 + 判定/编码次序事实，F4 依据）

| # | 事实 | 锚点 |
| --- | --- | --- |
| O1 | `OutboundQueue.emitOne` 是唯一序列分配点：`lastSeq >= 0xffffffff` → `onSequenceExhausted()` + `OutboundExhaustedError`（**该检查先于 `encodeMessage`**）；否则 `sequence = lastSeq+1` → `encodeMessage` → `emitRaw` → `onEmitted({kind, byteLength})`；控制帧 FIFO 恒先（`sendControl` = push + drain，返回本帧序） | `frame-io.ts:110-175`（耗尽 :158-163、编码 :165-169） |
| O2 | `ConnectionSender.sendControl(message)`：`observeWater()` → **暂停态**先 `measureFrame(message)`（**探针编码**）→ 配额 `controlUnflushed + frameBytes > maxQueuedControlBytes` → 越界即 `onBackpressureExhausted()`（1011 收口）+ 返回 0 → 否则 `emitControl`。**非暂停态控制帧无探针、无配额**，直接 `emitControl` → `emitOne`（耗尽检查 → 编码） | `backpressure.ts:110-121` |
| O3 | `ConnectionSender.tryEmitData(message)`：`isEmitAllowed()`（= `!closedFlag`）→ `dataGateOpen()`（内含 observeWater）→ `measureFrame(message)`（**探针编码先于一切额度判定**）→ 单帧守卫 → 统一账本投影 admission → `emitData` → `emitOne`（耗尽 → 编码） | `backpressure.ts:124-136` |
| O4 | `measureFrame` = sequence=0 探针编码：envelope sequence 固定 4 字节大端 ⟹ 探针长度与出站序列取值无关、与真实编码**逐字节同长**；探针对不可编码消息与真实编码**同点抛出**（同 codec、同 limits） | `backpressure.ts:423-436` |
| O5 | 通道发送面：`sendChecked(msg)`（控制）→ `host.sendControl` → `sender.sendControl` → `outbound.sendControl`；data → `host.sendData/ns`（包装 UPDATE 消息）→ `sender.tryEmitData` → `outbound.emit`；UPDATE_CHUNK 消息组装（negotiated 纵深防御 + kind≠0 绑定块）在连接层 `sendUpdateChunk` | `hub-namespace.ts:1656-1672, 1085-1093`；`hub-connection.ts:1002-1054` |
| O6 | 通道消费出站序号：`bootstrapSnapshotSeq = sendChecked(...)`（BOOTSTRAP_ACK 校验 `ackedSequence !== bootstrapSnapshotSeq` → `connectionFatal('ACK_STATE_VIOLATION',1002)`）；`sendChecked` 的 catch 按 `.code` 折叠（编码面失败族 → ns ERROR + failed('send-failed')；`OutboundExhaustedError` 无 `.code` → 静默 0） | `hub-namespace.ts:624-666, 1095-1102, 1656-1672` |
| O7 | 收口路径直发豁免：`connectionFatal` 的 ERROR 绕过 sender 额度直发 outbound；GOAWAY 同族豁免 | `hub-connection.ts:604-612, 954-982` |

**次序结论（D3 依据）**：HEAD 的判定/编码次序按路径分三类——(i) **data 全路径**：`isEmitAllowed → 闸门 → 探针编码 → 单帧守卫 → admission → 耗尽 → 真实编码`（不可编码消息在探针点抛出，即**先于**守卫/admission/耗尽）；(ii) **暂停态控制**：`observeWater → 探针编码 → 配额 → 耗尽 → 真实编码`（不可编码在探针点抛出，先于配额）；(iii) **非暂停态控制**：`耗尽检查 → 真实编码`（无探针——唯一「判定严格先于编码」的路径）。

### 2.4 连接生命周期（F3 修正后的证据表）

| # | 事实 | 锚点 |
| --- | --- | --- |
| L1 | 连接 FSM：`handshaking → ready →(beginReauth) draining → closed`。**`setConnState` 是「带事件的迁移点」**（H10，`connection-state-changed` 事件、同态早退），覆盖 close/onTransportClosed/connectionFatal/onSequenceExhausted 四路。**两处有意的无事件直赋迁移**：`beginReauth` 的 `this.state = 'draining'`（**不发射** connection-state-changed）与 `onLivenessLost` 的 `this.state = 'closed'`（同不发射）。拆分实现**必须逐点保留这两处直赋**——把它们「规范化」进 setConnState 会新增事件，违反 D8 | `hub-connection.ts:1103-1118`（setConnState）、`:602`（draining 直赋）、`:994`（closed 直赋） |
| L2 | 五条收口入口：`close`（572-583）、`onTransportClosed`（924-931）、`connectionFatal`（954-982，+ best-effort ERROR + `connection-failed` 事件）、`onLivenessLost`（990-1000，pong 超时 → close(1001,'pong-timeout')，**零 ERROR 帧、不调 clearDrainHandles**——reauth deadline 句柄由 `cleanupAll` :936-939 清、drainActive 残值由 closedFlag 闸门吸收）、`onSequenceExhausted`（1082-1101，close(1008,'sequence-exhausted')，零出站帧）。除 onLivenessLost 外四路调 `clearDrainHandles`；全部经 `sender.teardown → 通道 quiesce → transport.close → cleanupAll`（reauth timer 清 → quiesce → stopLiveness → 摘监听 → 全通道 `onConnectionClosed` → `settleTail` → `hub.dropConnection`）。`drainDeadline`（:466 声明、:660-663 清理）是**从未赋值的死字段**——真实句柄为 `reauthDeadlineHandle`（:476、:613 武装、cleanupAll 清理）；死字段无需迁移（无可观察面） | `hub-connection.ts:466, 476, 572-583, 590-664, 924-1000, 1082-1101, 933-952` |
| L3 | reauth：`beginReauth`（幂等闩锁 reauthRequested；handshaking 直接 close(1001)；否则 GOAWAY{REAUTH_REQUIRED, drainTimeoutMs=closeTimeoutMs} + deadline(1001)）；**drain 提前完成单点触发 = `onChannelSettled`（:529）→ `maybeFinishDrainEarly`：迭代全部通道，任一通道 ∉ {closed, conflicted, failed}（含 `'opening'`——authorize 在途、`'closing'`、live 等）即 return**；deadline fire 不检查任何通道状态 | `hub-connection.ts:529, 585-664`（判定 :640-647） |
| L4 | 服务面：`connections` 列表、`revoke(instanceIdentity, nsId)`（→ `channel.terminateUnauthorized`）、`requestReauth(instanceIdentity)`（→ `beginReauth`）、`close()`（全部连接 close(1001) + `settle()` 汇流）、`dropConnection` | `hub-connection.ts:406-448` |
| L5 | 连接级入站 assembly 槽：`inboundAssemblySlots`（每连接上限 `maxConcurrentAssembliesPerConnection`，缺省 4；幂等占/还） | `hub-connection.ts:477-545` |
| L6 | `HubChannelHost` 内联实现（连接对象提供给通道的 **24 成员**注入面：5 只读配置 + 19 方法/可选方法，含可选 `now?`；`authorize` 为其第 7 位成员——`(instanceIdentity, namespaceId) => Promise<NamespaceAuthorization>`）由 `HubConnectionImpl` 构造期一次性组装；`channels` Map 只增不减（`onOpenNamespace` 唯一写入点，无 delete） | `hub-connection.ts:512-555`；`hub-namespace.ts:52-100` |

### 2.5 帧路由键字节事实（ADR 决策 4 的前提）

envelope 固定 20 字节：magic[0..4)/version[4]/kind[5]/flags[6..8)/sequence[8..12)/payloadLength[12..16)/reserved[16..20)（codec `constants.ts`、`envelope.ts:181-183`）。namespaceId 文法 `^ns-[0-9a-f]{32}$`（35 ASCII）⟹ varString 长度前缀恒 1 字节（0x23）：标准 namespace 域帧 id 在 `[21,56)`、前缀 `[20]`；UPDATE_CHUNK（0x42，kind 首字段 transferKind 在 payload 首字节）id 在 `[22,57)`、前缀 `[21]`。kind 字节注册表 `MESSAGE_TYPES`/`MESSAGE_REGISTRY`（含 scope 分类）为 codec 公共导出（`messages.ts:45-100`）。SA6 C4a/C4b 已在真实 wire 上钉死该布局。

---

## 3. 能力缺口（Refactor：目标形态缺失，非缺陷）

| # | 缺口 | 证据 |
| --- | --- | --- |
| G1 | 连接级 FSM 与 namespace 级职责同处一个模块私有类，无任何导出面能独立构造连接级半边 | SA6 GAP1；`hub-connection.ts:451-1138` |
| G2 | 两半之间仅有类型缝：`HubChannelHost` 由 `HubConnectionImpl` 内联对象实现——namespace 半边要独立实例化必须手写整套连接级语义（GAP2：authorize/limits/timeouts/peerInstanceId/observerPresent 被读取）＝ fork 协议实现（ADR 明示否决） | SA6 GAP2；`hub-namespace.ts:52-100` vs `hub-connection.ts:512-555` |
| G3 | 公共缝只有整连接粒度 `accept`/`acceptTrusted`——ADR 背景的 worker 分片诉求不可达 | `types.ts:161-180` |
| G4 | 出站序列单点分配（`OutboundQueue.emitOne`）与入站 expectedSeq 收口（`onMessage`）已在 HEAD 成立——属「保持」而非「修复」；拆分后必须保持同一可观察事实且归属 edge 半边 | SA6 C1/C2 全绿；§11 排除假设表 |
| G5 | SA2 证实的**验收缺口**：既有 73 文件测试对 authorize 窗口的覆盖仅两处到达点锚（I13）；窗口行为等价不能仅由 AC4 证明，需矩阵测试钉死（§12 M1，iteration 1 已升必做，本版再加到达点强化） | SA2 §12；`test/ws-replication-issue171-dynamic.test.ts`；SA3 §7 |

---

## 4. Owner 要求落实

REST comments snapshot 返回 `[]`（派工单明示）；简报 §Comments 为空 ⇒ **无超出 Issue body 的 owner 追加要求**。需求全集 = Issue body 5 条 AC + ADR 0032 决策 1~5（与 SA6 §2、SA8 §2 口径一致）。

| 来源 | 要求 | 设计响应 |
| --- | --- | --- |
| Issue body What-to-build | 沿 `HubChannelHost` 内缝劈为 Edge/SessionHost，单体 = 进程内组合 | §7 D1/D2/D7 |
| Issue body | 零新公共 API、零配置变化 | §7 D1/D8；§12 验收映射 AC 门 |
| Issue body | 入站 sequence 由 edge 校验；出站 session 以 sequence=0 占位编码、edge 定偏移盖章 | §7 D3/D4；§8 数据流路线 1/4/5 |
| AC1 | 两个可独立实例化内部模块 + 单体组合 | §7 D1（`createHubReplicationEdge` / `createHubSessionHost`）；§12 C0a/C0b/C0c |
| AC2 | 出站 sequence 单点分配在 edge（盖章语义）、入站 expectedSeq 校验在 edge | §7 D3（emitOne 单分配 + `[8..12]` 盖章）；§8 路线 1 |
| AC3 | 通道实现零改动（authorize 仍经注入 host 接口） | §7 D5.3（port 拉取 shim）；DENY LIST `hub-namespace.ts` |
| AC4 | 既有全量测试逐字节绿灯（**不改而绿**，含 I13 两锚） | §12（73 文件套件 + C3 金标 + 零 diff 门禁 + M1 窗口矩阵补测与到达点强化） |
| AC5 | 包 typecheck + 根 `pnpm typecheck`/`pnpm test` 绿灯 | §12 |

## 5. 复现和根因承接

| 上游事实 | 证据位置 | 设计响应 |
| --- | --- | --- |
| 基线 72 文件/518 用例全绿；+契约 73 文件/535 用例全绿；根 436 文件/5260 用例 + `Type Errors: no errors` | `artifacts/sa6-issue418-baseline-ws-replication.log`、`-final-package-suite.log`、`-root-test.log` | 重构语义等价目标 = 两态均须全绿；本设计行为面变更收敛至 §1 登记的两处残余窄差（§7 D8） |
| 能力缺口 GAP1/GAP2（无独立实例化入口；namespace 半边依赖连接级成员） | SA6 §5/§9 E1/E2 | §7 D1/D2 模块面 + 工厂签名直接闭合缺口；§12 C0a/C0b 白盒测试 |
| 单点出站序列、分派前收口、wire 字节、导出面已在 HEAD 成立（C1~C6 全绿） | SA6 §12.2 | §7 D3/D4 保持单点与收口位置；§12 映射 |
| C0a~C0d 可执行形态依赖设计期命名（SA6 U1） | SA6 §12.1/§15 U1 | §7 D1 给出模块名、工厂签名、缝类型；§12 给出 C0 白盒测试判据 |
| Yjs 载荷帧 payload 跨进程不可逐字节冻结（clientID 随机）（SA6 U2） | SA6 §7/§9 E3 | 本设计不改变任何编码路径——`hub-namespace.ts` 零 diff + session 半边复用同一 `encodeMessage`，envelope/序列面被 C1/C3 锚定（SA2 N2 修正后的论据：**编码路径零改动是根论据**；C5c 是同实现两次 boot 的一致性对照，不是「拆分前后」差分——如实表述，不夸大） |
| `hub-namespace.ts`「零改动」属结构命题（SA6 U3） | SA6 §15 U3 | DENY LIST + 实现期 `git diff --stat` 零变更门禁 + C0b |
| 若实现提前导出 edge/session 面即 C5a 红（SA6 U4） | SA6 §15 U4 | §7 D1：两工厂仅模块级导出，绝不进 `index.ts`/`testing.ts` |
| SA2 F1~F4（iteration 0 reject）已由 iteration 1 解决；F5（revoked shim 形态文本矛盾，MINOR） | `task_issue-418_sa2_review.md` §13/§14 | F1~F4 的解决机制中与本版无关者（D3/D4/证据表）逐字维持；**F5 随 `revoked` 结局整体删除而消解**（本版 D5.2 无 revoked 词汇——revoke 由在场通道的 `terminateUnauthorized` 承载，shim 形态唯一化，§14） |
| **SA3 实现 reject：D5.1/D5.2 结算段回放 vs AC4「不改而绿」不可同时满足**——2/569 既有测试红（ac7-faults:53 到达点零 ERROR；issue171-red:183 通道在场性谓词永不成立）；三条修复路（edge 合成/通道前移/改测试）分别被 F1 复现禁令、D1 缝面口径 + SA8 R9、DENY LIST 排除 | `task_issue-418_sa3_impl.md` §7 + `artifacts/sa3-issue418-{package-suite,root-test,blocker-focus}.log` | **本版核心修订**：采纳 SA3 方案 A——D5 整体重写为「到达点建通道 + 异步 edge-owned admission」（§7 D5）：首个 OPEN 全解码后**立即**投递 session（同步建通道 + `startOpen` = HEAD 时序，I13 两锚由构造保证绿）；shim 经新 port 成员 `openAdmission(nsId)` await edge 结算；真实 authorize 仍 edge 单点恰一次；失败面/闩锁/静默门仍全部由零 diff 通道承载 |
| SA3 A1~A6 登记项（channels 投影 / F5 调和 / routingKeyOf 一致性 / requestSinkClose / R4' 角落 / R2·R5·R7 义务） | `task_issue-418_sa3_impl.md` §8 | A1 formalize（D1/D6：观测类投影，路由事实源为 edge 投递台账，D4b）；A2 随 revoked 删除消解；A3/A4/A5 逐项保留（D4a/§9/§13 R4'）；A6 义务账更新（§13：R2 就地了结、R5 扩面、R7 消除） |
| SA8 冲突报告（针对 iteration 1）：clear + 注 C + §8-R1~R9 | `task_issue-418_design_conflict_report.md` | §6 逐行承接并更新到本版形态；R9 口径（新缝面成员须重过 SA8）由本版 `openAdmission` 触发——§15 裁决简报备好，`requiresConflictRecheck: true` |

## 6. SA8 约束落实（SA8 设计后冲突报告已存在；本表为 iteration 2 形态对其裁决与义务的承接）

| 决议或义务 | SA8 裁决（iteration 1 形态） | 本版设计位置与处理方式 | 是否需要设计后冲突复查 |
| --- | --- | --- | --- |
| ADR 0032 决策 1：沿内缝拆分、两半皆 nomicore、单体 = 进程内组合、状态机单份 | implements-existing-decision（行 1） | §7 D1/D2/D7 维持；本版**更强**——iteration 1 的二相 OpenEntry + 窗口日志 + 结算回放（通道存在性的中间态机械件）整体删除，`'opening'` 行唯一实现在零 diff `hub-namespace.ts`、连接 FSM 唯一在 `hub-edge.ts` | 否 |
| 决策 2（出站）：占位编码 + `[8..12]` 重写、单点分配、wire 逐字节 | implements-existing-decision（行 2） | §7 D3 逐字维持（本版未触碰出站机制） | 否 |
| 决策 2（入站缝形态）：已解码消息 + wire 序号过缝（注 A 目的读法，限定本票进程内 listen） | no-conflict（行 3） | §7 D4a 维持；worker 形态票重新过 SA8（§8-R5 义务存续，见下 R5 行） | 否（worker 形态票为前置门禁） |
| 决策 2（4 控制信号 / 无接纳信号）：port 面 = `HubChannelHost` 注入面逐名迁移 + 发送面字节化，无越出新缝面 | no-conflict（行 4） | §7 D6 信号映射维持；**本版新增 1 个行为面 port 成员 `openAdmission`**（`HubChannelHost.authorize` 成员的跨半边载体，异步拉取形态）——超出「逐名迁移 + 字节化」口径，按 SA8 §8-R9 明示规则属**新缝面、须重过 SA8**；裁决简报见 §15.1 | **是**（本条为本版唯一新增门禁面） |
| 决策 3（authorize/OPEN 管线）：authorize 在 edge、OPEN 全解码、拒绝闩锁、shim 回放投影、通道零改动 | implements-existing-decision（行 5，**注 C** 目的读法——失败 admission 过缝 + 零资源唤起 + 单份 FSM 产失败面） | §7 D5 重写为拉取形态，注 C 五点目的逐点保全且**更强**：(i) 真实 authorize 单点在 edge、恰一次、session 结构性不可达（shim 只能拉取已结算结局，无法注入或影响授权）；(ii) 被拒 ns 零会话资源唤起——shim 回放 `{ok:false}` 后走 HEAD 自己的 `!authz.ok` 短路（`hub-namespace.ts:355-359`，零 diff 通道的既有代码路径）；(iii) `NAMESPACE_UNAUTHORIZED` wire 行为与闩锁由单份零 diff 通道原生产出；(iv) 准入结算管线（authorize 调用、结局映射、台账）在 edge；(v) `HubNamespaceChannel` 零 diff。**形态变化**：OPEN 在 authorize 结局产出**之前**即过缝（iteration 1 为失败结局随 OPEN 参数推送；HEAD 为单体内部先后）——注 C 第 1 点的论证（字面读法迫使决策集自相矛盾）在本版同样成立且更直接：通道在场性本身（I13b）已是既有测试面 | **是**（过缝时序前移 + 拉取形态为 SA8 未裁决过的新形态；§15.1） |
| 决策 3（pending 有界缓冲、并发 OPEN 上界）+ 模块 AGENTS「Keep admission bounded across handshake, ready, backpressure, and drain windows」 | 部分兑现 + 登记延期（行 6 注 B / §8-R4） | **本版就地了结**：pending 全帧窗口日志不存在（窗口帧到达点即投递，零缓冲）；本票新增的唯一 admission 台账是 per-ns 一次性的 `{promise, resolve}` 记录（≤ 通道数，与 `channels` Map 同阶——HEAD 既有增长面）；窗口内再 OPEN 的合流走 HEAD 既有 openWaiters（OPEN-only、先存面）。**义务对「本票新增面」关闭**；worker 形态票若引入真实跨线程 pending 状态则义务重新进入（§13 R2） | 是（随 §15 一并确认义务了结口径） |
| 决策 4（路由键契约）：定偏移只读提取、OPEN 全解码、ERROR 特例、路由点两分支复现、codec 守卫测试 | implements-existing-decision（行 7） | §7 D4 维持；**D4b 路由表由四案减为三案**（R-pending 删除——pending 期通道在场，帧按 R-delivered 即时投递）；R-none/R-violation/ERROR 特例逐字维持；守卫测试入 ALLOW | 否 |
| CONTEXT.md「复制 Edge」/「SessionHost」术语（行 8/9） | no-conflict（注 C 范围内） | 维持；「SessionHost：authorize 不在此调用，消费 edge 传入的预授权投影」——本版形态为**拉取式消费**（port.openAdmission 取回 edge 结算的投影）；§8-R7 文本调和义务存续且描述差扩至拉取形态与时序（§13 R8'） | 是（随 §15） |
| 决策 5（观测纪律） | no-conflict（行 10） | §7 D2/D5：连接域/出站序列事件在 edge；namespace 域事件由零 diff 通道经 port 发射（到达点即时，不再有结算段时序）；零新增事件型/字段 | 否 |
| 协议 §6.3/§21（GOAWAY drain） | no-conflict（行 12） | §7 D5.4：判定式收敛为「全部已投递 ns 均 settled」（`'opening'` 通道——authorize 在途——天然未 settled，pending 案被包含式覆盖）；同构论证见 D5.4 | 否 |
| 协议 §7.1/§13/§14/§15.2/§17/§19/§23、ADR 0010/0012/0013/0022/0023、模块 AGENTS、CI | 全表 no-conflict（行 11-23，R7 例外见行 16） | 全部维持（§7 D8/DENY/§12）；§8-R16 的 R7 微差（revoked 续体 registry 短路）**随 revoked 机制删除而消除**——本版 revoke 走 HEAD 原生路径（含 D-H1 transient registry.open + 回收，H1 锚） | 否（R9 复查项中 R7 部分撤销，§15.4 请确认） |

---

## 7. 设计决策与主要备选方案

### D1 模块命名、文件布局与工厂签名（闭合 SA6 U1）

新增三个内部模块 + 改写一个既有模块；两工厂仅**模块级导出**（既有先例：测试直接相对导入 `../src/frame-io.js` 等，及 `hub-namespace.ts` 模块导出 `HubNamespaceChannel` 不进 index 的先例），不进 `src/index.ts` / `src/testing.ts`（C5a 冻结面零变化）：

```
packages/ws-replication/src/
  hub-split.ts      [新增] 缝契约：HubSessionEdgePort（session→edge，含 openAdmission）+ HubSessionSink（edge→session）+ HubOpenAdmission
  hub-edge.ts       [新增] HubReplicationEdge + createHubReplicationEdge(config)
  hub-session.ts    [新增] HubSessionHost + createHubSessionHost(config)
  hub-connection.ts [改写] HubReplicationImpl（服务面原样）+ 组合根；HubConnectionImpl 解体
  frame-io.ts       [改写] OutboundQueue 字节形态成员 + [8..12] 盖章（见 D3）
  backpressure.ts   [改写] ConnectionSender 字节形态成员 + 可选宿主成员（见 D3）
```

**缝契约（`hub-split.ts`）**——两半各自依赖缝类型与 `types.ts`，半间零 import；文件头注释固化同步不变量：**delivered ⇒ session `channels` 在场（到达点同步——`openNamespace` 返回前已写入）**、**listen 形态通道只增不减**、**settled 单调且每通道至多一次**、**admission 台账 ⟺ 首个 OPEN 已投递（⟺ 通道在场——锁步不变量，C0d 断言）**、**每 (连接, ns) 至多一条 admission 记录 ⟹ 恰一次真实 authorize**：

```ts
/** OPEN 准入结局（edge 真实 authorize 的结算投影；纯 JSON 可过缝，决策 2 词法类）。
 *  denied 覆盖 {ok:false} 与 ok-但-无 read 两种 HEAD 等价拒绝（edge 结算时单分支折叠
 *  `!authz.ok || !permissions.read`，hub-namespace.ts:355-359——shim 一律回放 {ok:false}）；
 *  throw 对应 authorize 抛出（shim reject，startOpen catch → INTERNAL_ERROR；错误值被
 *  catch 丢弃，仅「抛出」这一事实上 wire）。无 revoked 结局——revoke 由在场通道的
 *  terminateUnauthorized 原生承载（D5.5），authorize 结局按真实值流动。 */
export type HubOpenAdmission =
  | { readonly outcome: 'authorized'; readonly authorization: Extract<NamespaceAuthorization, { ok: true }> }
  | { readonly outcome: 'denied' }
  | { readonly outcome: 'throw' };

export interface HubSessionEdgePort {
  /** ★ 本版新增行为面成员（SA8 §8-R9 口径——须重过 SA8，§15.1）：OPEN 准入结局的
   *  异步取得。返回 edge 侧该 (连接, ns) 唯一在途真实 authorize 的结算投影；promise
   *  至多结算一次、永不 reject（throw 结局以值承载）。无台账记录（不变量破坏——
   *  通道存在 ⟺ 台账存在）→ reject（响亮 fail-loud，startOpen catch → INTERNAL_ERROR）。
   *  调用时机：仅 channelHost.authorize shim 在 startOpen 首 await 处调用（通道必处于
   *  'opening'）。连接已收口后结算照常传播（D5.6/H1：迟归续体的 lease 回收依赖此）。 */
  openAdmission(namespaceId: string): Promise<HubOpenAdmission>;
  /** 出站控制帧（sequence=0 占位编码）。返回 edge 盖章后的 wire 序；0 = 未发送/被拒（与既有 sendControl 契约同形）。 */
  sendControlFrame(frame: Uint8Array): number;
  /** 出站数据帧（UPDATE / UPDATE_CHUNK 占位编码）。返回盖章后 wire 序；0 = 准入拒绝。 */
  sendDataFrame(frame: Uint8Array): number;
  dataGateOpen(): boolean;                       // §4.2 连接级 data 水位闸门（D3.1 data 闸门前置判据）
  onDataQueued(namespaceId: string): void;       // §4.4 wheel 登记 + 总压检查
  requestDataDrain(): void;                      // §4.5 请求 drain
  chunkedUpdateNegotiated(): boolean;            // HELLO 协商位（会话期恒定）
  connectionFatal(code: string, wsCloseCode?: number): void;  // ACK_STATE_VIOLATION 族通道→连接收口
  onChannelSettled(namespaceId: string): void;   // 'settled' 信号（drain 提前完成观测）
  tryBeginInboundAssembly(namespaceId: string): boolean;       // 连接级并发 assembly 槽
  endInboundAssembly(namespaceId: string): void;
  observerPresent(): boolean;
  emitObserver(event: ReplicationObserverEvent): void;         // 隔离语义仍在 dispatchReplicationObserver 单点（edge 侧执行）
  connectionId(): string | undefined;
  connectionState(): HubConnectionState;         // D3.1 data isEmitAllowed 前置判据（'closed' ⟺ closedFlag，等价论证见 D3.1 末注）
  bufferedAmount(): number | undefined;
  now?(): number | undefined;
}

export interface HubSessionSink {
  /** OPEN 投递（= HEAD onOpenNamespace：无通道即**同步建 + startOpen**；有通道即 onOpen
   *  重开矩阵）。到达点立即调用（authorize 结局产出之前）；准入结局不经此参数传递——
   *  session 侧通道经 port.openAdmission 异步取得（D5.2/D5.3）。 */
  openNamespace(message: OpenNamespaceInbound): void;
  /** 非 OPEN 的 namespace 域帧（已确认该 ns 已投递）。sequence = wire 序（SYNC_STEP1/2、CLOSE_NAMESPACE 记账需要）。 */
  namespaceFrame(message: ReplicationMessage, sequence: number): void;
  /** 'close' 信号：同步前缀（全通道 quiesceConnection）+ 异步尾（全通道 onConnectionClosed 汇流）；幂等。 */
  close(): Promise<void>;
  /** 'terminateUnauthorized' 信号（revoke 链；= HEAD channels.get(nsId)?.terminateUnauthorized()：
   *  无通道/quiet 态 → 无副作用 resolve；响亮时返回 terminationSettled）。 */
  terminateNamespace(namespaceId: string): Promise<void>;
  /** listen 形态 drain/wheel/shed 的通道 facet 查询（进程内组合成员；见 D6 边界注记）。 */
  dataFacetOf(namespaceId: string): DataSenderFacet | undefined;
  /** listen 形态通道表的**只读观测投影**（进程内组合成员；SA3 A1 形态化）：唯一事实源是
   *  session 的 `channels` Map；edge 持同一引用仅用于组合根 face（AC4 既有白盒锚
   *  `hub.connections[0].channels.get(nsId)` 只读模式，13 个既有测试文件）。**非路由
   *  判据、非第二事实源**——edge 路由与 drain 判定使用自身 admission 台账（D4b/D5.4，
   *  worker 形态可迁移性的结构前提）。 */
  readonly channels: ReadonlyMap<string, HubNamespaceChannel>;
}
```

**工厂签名**：

```ts
// hub-edge.ts
export interface HubReplicationEdgeConfig {
  readonly transport: DuplexTransport;
  readonly timer: ReplicationTimer;
  readonly limits: ResolvedLimits;          // 服务层 resolve+validate 后注入（校验留在组合根）
  readonly timeouts: ResolvedTimeouts;
  readonly observer?: ReplicationObserver;
  readonly clock?: ReplicationClock;
  readonly instanceId: string;              // hub 实例（HELLO 绑定）
  readonly peerInstanceId: string;          // 认证身份（authorize 键 + HELLO 恒等）
  readonly connectionCounter: number;       // connectionId 后缀（${instanceId}-conn-${n}）
  readonly authorize: NamespaceAuthorizer;  // 决策 3：宿主注入的授权器（C0a 测试注入桩）
  readonly earlyFrames: readonly Uint8Array[];  // §3.3 构造尾部重放
  readonly sessionFactory: (port: HubSessionEdgePort) => HubSessionSink;  // session 对象生命周期归 edge（决策 3）
  readonly onConnectionDropped: () => void; // cleanupAll 尾部回调（服务层 dropConnection）
}
export function createHubReplicationEdge(config: HubReplicationEdgeConfig): HubReplicationEdge;

// hub-session.ts
export interface HubSessionHostConfig {
  readonly port: HubSessionEdgePort;
  readonly registry: NamespaceRegistry;     // SessionHost 拥有 Registry open
  readonly instanceId: string;
  readonly peerInstanceId: string;
  readonly timer: ReplicationTimer;
  readonly limits: ResolvedLimits;
  readonly timeouts: ResolvedTimeouts;
}
export function createHubSessionHost(config: HubSessionHostConfig): HubSessionHost;
```

`HubReplicationEdge` 对服务层面（原 `HubConnectionImpl` 公共面）暴露：`state`、`peerInstanceId`（HELLO 前 undefined——事件可选字段语义保持）、`authenticatedInstanceId`、`channels`（→ session Map 同引用只读投影，SA3 A1）、`close(code?, reason?)`、`settle(): Promise<void>`、`beginReauth(): void`、`revokeNamespace(namespaceId): Promise<void>`（→ D5.5）。

### D2 职责分配表（劈分总账）

| 现状符号（hub-connection.ts） | 归属 | 迁移形态 |
| --- | --- | --- |
| `installEarlyFrameAdmission` / `closeAdmission` / accept/acceptTrusted 门 0-5 / `rejectUpgrade` / `emitUpgradeRejected` | **组合根（服务层，不动）** | 原样保留于 `hub-connection.ts` |
| `expectedSeq` + `onMessage` 解码准入 + handshaking 分派 + `onHello`（身份/版本/capability/HELLO_ACK/liveness 武装/hello timer） | **edge** | 逐行迁移（`hub-edge.ts`） |
| `dispatchReady` 的 drain 门、方向纪律六类、GOAWAY fatal | **edge** | 逐行迁移（门次序在 OPEN 管线/路由之前——被门丢弃的帧到不了通道，与 HEAD 同构） |
| `dispatchReady` 的 OPEN_NAMESPACE → `onOpenNamespace` | **edge**（首个 OPEN 的 admission 台账 + 真实 authorize 发起 + 无条件立即投递）+ **session**（通道建立与重开矩阵） | 拆为 D5 OPEN 管线；`onOpenNamespace` 主体迁 session（`openNamespace`，= :880-894 原样——**到达点建通道**） |
| `dispatchReady` 其余 withChannel 分派 + UPDATE 字段超限判别（纯函数） | **session** | 迁 `namespaceFrame` 内部分派壳（防御性未知 ns 分支保留；判别次序与 HEAD `onMessage→dispatchReady` 全序一致） |
| `withChannel` 未知 ns 合成 `NAMESPACE_STATE_VIOLATION` | **edge 路由点**（决策 4：合法无 entry 分支）+ session 防御性保留 | edge 逐字节复现（sendControlChecked try/catch + `namespace-error{sent}` 事件） |
| OPEN 准入管线（HEAD：`onOpenNamespace` 同步建通道 + `startOpen` 内 await authorize；终态闩锁 = 通道 `onOpen`/`isQuietState`） | **edge**（admission 台账 + authorize 单点 + 结算映射，D5.1/D5.2）；**闩锁 = session 终态通道**（零 diff） | ~~iteration 1 的二相 OpenEntry（pending/sunk）+ PendingEvent 窗口日志 + 结算同步段回放 + D5.5 强制结算/terminate 标记~~ **已整体删除**（SA3 §7：与 AC4 不可同时满足）；HEAD 时序原样保留——到达点建通道，窗口帧行为由在场通道即时承载 |
| `OutboundQueue`/`ConnectionSender` 实例、`sendControlChecked`/`sendData` 的 UPDATE 包装、`sendUpdateChunk` 消息组装、`isChunkedNegotiated`、`readBufferedAmount`/`observableBufferedAmount` | **edge**（调度与额度）+ **session**（消息组装与占位编码） | 队列/调度器归 edge 实例化；UPDATE/UPDATE_CHUNK 消息组装 + 闸门前置 + 占位编码迁 session 的 channelHost 实现（D3.1） |
| `inboundAssemblySlots` | **edge**（listen 形态连接级；决策 5：分片形态才降级 per-session） | 经 port 透传 |
| liveness、`beginReauth`/drain 状态/`maybeFinishDrainEarly`/`finishDrain`/`clearDrainHandles`、五条收口路径、`cleanupAll`、`onSequenceExhausted`、`setConnState`、水位事件、`connection-failed` 事件 | **edge** | 逐行迁移（**含 L1 两处无事件直赋的逐点保留**、L2 onLivenessLost 不调 clearDrainHandles 的形态、`drainDeadline` 死字段不迁移）；通道扇出段经 `sink.close()`；drain 判定见 D5.4 |
| `channels` Map、`revokeNamespace`、`maybeFinishDrainEarly` 的通道迭代 | **session**（channels 持有；唯一事实源）+ **edge**（admission 台账 = 投递台账，路由/drain 判定输入，D4b/D5.4） | revoke 经 D5.5（无条件 `sink.terminateNamespace`）；drain 判定见 D5.4 |
| `HubChannelHost` 内联对象（512-555，24 成员） | **session** | 迁 `hub-session.ts`：配置成员（limits/timeouts/timer/registry/instanceId/peerInstanceId 闭包）+ authorize shim（D5.3，port 拉取）+ 字节包装发送（D3.1）+ port 透传成员 |
| `HubReplicationImpl`（internals/connections/revoke/requestReauth/close/dropConnection） | **组合根** | 原样；连接对象换为 `HubReplicationEdge` |

### D3 出站机制：session 占位编码 + edge mux 盖章（AC2 盖章语义 + F4 次序等价）

**（本节与 iteration 1 逐字一致——本版未触碰出站机制；摘要保留，完整论证维持原口径。）**

**字节等价根基**：envelope sequence 是固定 4 字节大端字段，帧长与序列取值无关（`backpressure.ts:423-436` 既有事实）⟹ `encodeMessage(msg, {sequence:0})` 后重写 `[8..12]` ≡ `encodeMessage(msg, {sequence:n})`，逐字节相等。

#### D3.1 session 半边（消息组装 + 闸门前置 + 占位编码）

channelHost 的 `sendControl(message)` / `sendData(nsId, bytes)` / `sendUpdateChunk(nsId, chunk)` 在 session 内完成消息组装（UPDATE 包装、UPDATE_CHUNK negotiated 纵深防御与绑定块——自 `hub-connection.ts:1011-1054` 逐行迁移）后，**按 HEAD 各路径的判定/编码次序**（§2.3 O2/O3）执行：

- **控制帧**：`encodeMessage(message, {sequence: 0, maxFrameBytes, limits})` 占位编码（**编码异常在 session 同步抛出**，经函数调用缝同步传播回 `HubNamespaceChannel.sendChecked` 的 catch——与现状 `host.sendControl` 内抛出的折叠路径逐符号一致，O6）→ `port.sendControlFrame(bytes)`。
- **数据帧**：先**闸门前置**（对应 HEAD `tryEmitData` 的 `isEmitAllowed → dataGateOpen` 先于探针）：`port.connectionState() === 'closed'` → 返回 0；`!port.dataGateOpen()` → 返回 0；**然后**占位编码（对应 HEAD 探针位置——不可编码消息在此抛出，先于一切额度判定）→ `port.tryEmitDataFrame(bytes)`。
- **末注（前置判据的等价性）**：`connectionState() === 'closed'` ⟺ HEAD 的 `isEmitAllowed()`（`!closedFlag`）——五条收口路径（L2）全部在**同一同步块**内先置 `closedFlag` 再迁移状态（close :573-575、onTransportClosed :925-927、connectionFatal :966-967、onLivenessLost :992-994、onSequenceExhausted :1088-1090），缝是同步函数调用、无法在块中插入读取，故 session 读取时点的取值与 HEAD 同点读取恒一致；`dataGateOpen()` 即既有 `ConnectionSender.dataGateOpen()` 的 port 透传（内含 observeWater，与 HEAD 调用点同构）。

#### D3.2 edge 半边（mux：字节队列 + 盖章，单一分配点不变）

- `emitOne(bytes, kind)`：耗尽检查（`onSequenceExhausted()` + `OutboundExhaustedError`，经缝同步上抛）→ `sequence = lastSeq+1` → **大端写入 `bytes[8..12]`**（盖章）→ `emitRaw(bytes, sequence)` → `onEmitted({kind, byteLength})` → 返回 sequence。编码职责移出队列。
- 新增 `sendControlFrame(bytes): number`（控制 FIFO push + drain，返回本帧序）与 `emitFrame(bytes): number`（data 立即出队）。
- 既有 message 形态成员**原签名保留**：`sendControl(message)`/`emit(message)` 内部改为「sequence=0 占位编码（入队时）→ 复用字节路径」。peer 侧（`peer-connection.ts`）继续使用 message 形态，零改动。
- `ConnectionSender` 新增 `sendControlFrame(bytes)`（暂停态额度判据用 `bytes.byteLength`——与 `measureFrame` 探针编码同值，O4）与 `tryEmitDataFrame(bytes)`（单帧守卫与统一账本 admission 全部以 `byteLength` 为确定判据；`isEmitAllowed`/闸门已由 session 前置）；宿主接口新增**可选**成员 `emitControlFrame?(bytes): number` / `emitDataFrame?(bytes): number`（字节路径必持，缺失即响亮 throw——正常路径不变量缺失 fail-loud）。既有 message 形态方法与宿主必选成员零变化。
- edge 的 `sendControlFrame(bytes)` 判定次序 = HEAD `sendControl`：`observeWater()` → 暂停态配额（`controlUnflushed + byteLength > maxQueuedControlBytes` → `onBackpressureExhausted()` + 返回 0）→ 控制队列出队盖章。
- edge 自有帧（HELLO_ACK、GOAWAY、连接级 ERROR、无 entry 合成的 ns ERROR）：沿用 message 形态管线（`sendControlChecked(message)` → `sender.sendControl(message)`），与 session 字节路径汇流于同一 `emitOne`——**单一序列分配点跨「连接级帧 + namespace 域帧」**（C1a/C1c 结构保证）；收口路径直发豁免（L2/O7）原样保留。
- **序号回传**：缝的出站调用同步返回盖章序（进程内函数返回值；非「接纳信号」——决策 2 的 fire-and-forget 指无异步接纳回执）。通道的 `bootstrapSnapshotSeq`/`sendStep2` 关联序/onUpdateAcked 记账因此逐值保持（O6）。

#### D3.3 次序等价账（F4 落实）

对「配额/耗尽判定 × 编码必败」的每个组合，按 §2.3 三类路径逐一对照：

| 路径 | HEAD 次序 | 设计次序 | 双失败（判定拒纳 ∧ 编码必败）时的等价性 |
| --- | --- | --- | --- |
| data（UPDATE/UPDATE_CHUNK） | isEmitAllowed → 闸门 → 探针编码 → 守卫 → admission → 耗尽 → 真实编码 | connectionState 前置 → dataGateOpen 前置 → 占位编码 → （缝）守卫 → admission → 耗尽 → 盖章 | **等价**：HEAD 探针与设计占位编码同点抛出（同 codec/limits，O4）——闸门拒绝时两侧都**不**编码；admission 拒纳 + 编码必败时两侧都在编码/探针点抛 MALFORMED；耗尽 + 编码必败时同在编码/探针点抛 MALFORMED |
| 暂停态控制 | observeWater → 探针编码 → 配额 → 耗尽 → 真实编码 | 占位编码 → （缝）observeWater → 配额（byteLength）→ 耗尽 → 盖章 | **等价**：探针/占位同点抛出，均先于配额；配额判据同值；observeWater 位移由「失败帧错误面重入（ns ERROR 发送自身先过 observeWater）+ 已暂停态 enterPause 无操作 + 台账增量收敛」吸收（SA2 N1 论证采纳） |
| 非暂停态控制 | （无探针）耗尽检查 → 真实编码 | 占位编码 → （缝，无配额）耗尽 → 盖章 | **唯一残余差（R4'）**：耗尽 ∧ 编码必败同时成立时，HEAD 先耗尽（`OutboundExhaustedError` + close 1008、通道静默 0），设计先编码（MALFORMED → ns ERROR + failed('send-failed')、连接不收口）。登记为已知窄差（§13 R4'）：双不可达角落（`lastSeq ≥ 0xffffffff`〔`frame-io.ts:93` 自注「实践不可达」的防御面〕∧ 消息违反 codec 字段上限〔不变量破坏面〕）；次序差是 issue 明文机制（session 必须占位编码、edge 盖章）的结构性后果——session 在编码前无法触达 edge 耗尽态，除非新增承载行为的预检 port 成员（SA8 R9 口径的新缝面，不值） |

**备选（否决）**：
- *port 新增 `failIfSequenceExhausted()` 行为预检成员以消掉 R4' 残余角落*：承载收口行为的新缝面，为双不可达角落引入新契约面；不值（同 iteration 1）。
- *新建独立字节 mux 类与 `OutboundQueue` 并存*：两个序列分配器 → 违反 C0c「无重复 FSM 符号」。
- *直接改 `OutboundQueue`/`ConnectionSender` 既有签名为字节形态*：6 个既有测试文件直构这两个生产类（编译红，违反 AC4）。
- *缝传 `ReplicationMessage` 由 edge 统一编码*：违背 issue 明文「session 半边以 sequence=0 占位编码」，且 worker 形态将被迫返工。

### D4 入站机制：edge 单点解码准入 + 定偏移路由（AC2 收口语义 + 决策 4）

**D4a 准入（保持现状分类次序）**：edge 保留对每条入站帧的 `decodeInbound`（expectedSequence 严格校验 + maxFrameBytes + capability 门控 + codec 全量结构校验）——序列检查先于 payload（codec `envelope.ts:127`）、失败分类与 close code（`wsCloseCodeFor`）逐字节保持。**全解码保持在 edge 是行为等价的必要条件**（SA8 注 A 已裁）：若改为 session 侧解码，结构坏帧的 `MALFORMED_FRAME` 连接 fatal 将需要经缝回传致命信号，而决策 2 的缝只有 4 个控制信号。路由键定偏移读数与解码值不等（codec 字段序漂移）→ `connectionFatal('MALFORMED_FRAME', 1002)` 响亮（SA3 A3，守卫测试 `codec-namespace-routing-key-offset.test.ts` 为字节前提锚）。

**D4b 路由（决策 4 机制；**三案**唯一确定——iteration 1 的 R-pending 案随窗口日志删除）**：入站管线全序与 HEAD 一致：解码准入 → handshaking 门 → **drain 门（先于一切 ns 路由——drain 窗口内被门丢弃的帧到不了通道，与 HEAD 同构）** → 方向纪律 → OPEN 管线 / 定偏移路由。对非 OPEN/非 ERROR 的 namespace 域帧，路由键按**定偏移表**只读提取（解码 kind 查表 + 从帧字节定偏移读取 id，不从解码对象取）：

| 帧族 | id 字节窗口 | 前缀字节 |
| --- | --- | --- |
| 标准 namespace 域帧（BOOTSTRAP_ACK/SYNC_STEP1/2/SYNC_APPLIED/RESYNC_REQUIRED/UPDATE/UPDATE_ACK/CLOSE_NAMESPACE/CLOSE_OK/OPEN_OK） | `[21,56)` | `[20] == 0x23` |
| UPDATE_CHUNK | `[22,57)` | `[21] == 0x23` |
| OPEN_NAMESPACE | 全解码（决策 3），入 OPEN 管线（D5） | — |
| ERROR | 解码值取 `namespaceId`（进程内有界 mini-decode 的等价形态；其无 nsId/未知 ns → 静默丢弃，I5 原样） | — |

路由点对每个（kind, nsId）**唯一确定**：

| 案 | 条件（edge 本地 admission 台账） | 行为 |
| --- | --- | --- |
| R-delivered | 该 ns 存在台账记录（⟺ 首个 OPEN 已投递 ⟺ session 通道在场——**authorize 在途亦然**） | `sink.namespaceFrame(message, sequence)` **立即投递（到达点）**——session `withChannel` 分派到零 diff 通道（'opening' 行走 §2.2 矩阵、已建立态走协议、closing/终态由通道 `isQuietState` 静默门承载 = I9；被拒 ns 的终态通道同理静默 = 闩锁） |
| R-none | 无台账记录（该连接上从未投递过此 ns 的 OPEN） | edge 合成 `NAMESPACE_STATE_VIOLATION`：message 形态 `sendControlChecked({kind:'ERROR', code, safeMessage, namespaceId})`（try/catch）+ `namespace-error{sent}` 观测事件——`withChannel` 未知 ns 分支（`hub-connection.ts:896-919`）逐符号迁移；**ERROR 帧例外**（无 nsId/未知 ns → 静默丢弃，:857-862） |
| R-violation | 文法违例（codec `NAMESPACE_ID_RE`） | 本票由 D4a 单点全解码承接：违例帧到不了路由表（`MALFORMED_FRAME` fatal，决策 4 分支 1） |

**路由事实源选择（本版决策）**：路由与 drain 判定读 edge 本地 admission 台账（投递台账——edge 自身动作的记录），**不读** `sink.channels` 投影。理由：(i) 路由是 edge 的规范职责（决策 4），依赖对侧内部容器会使 edge 行为耦合 session 内部状态；(ii) worker 形态下 edge 无法跨线程读 session Map——edge 自持台账是该形态的结构前提（ADR 拆分动机）；(iii) 台账 ⟺ channels 的锁步不变量在 `openNamespace` 投递的同一同步语句组内成立（D5.1），C0d 断言钉死。**备选（否决）**：*路由读 `sink.channels` 投影*——单事实源更纯粹，但把 A1 观测投影升格为行为依赖面（SA8 复查面反而扩大）且阻塞 worker 形态。

**备选（否决）**：*edge 仅头部校验 + 原始字节过缝、session 解码*——见 D4a；致命信号无缝可走，且解码错误分类位置迁移引入不可控行为差。

### D5 OPEN 准入管线（决策 3 落地；**本版核心——SA3 §7 方案 A：到达点建通道 + 异步 edge-owned admission**）

edge 持每连接 `Map<namespaceId, AdmissionRecord>`（**一相台账**，listen 形态只增不减——与 `channels` Map 同阶增长）：

```ts
type AdmissionRecord = {
  readonly promise: Promise<HubOpenAdmission>;   // 至多结算一次、永不 reject
  // resolve 由 edge 结算闭包持有（D5.2）
};
```

~~iteration 1 的二相 OpenEntry（pending/sunk）、PendingEvent 窗口日志、结算同步段回放、D5.5 强制结算/terminate 标记/revoked admission、session 投影存储~~ **整体删除**（SA3 §7 证伪：通道存在性与到达点效应被推迟，与 AC4 不可同时满足）。

#### D5.1 到达点投递与通道建立（= HEAD 时序）

首个 OPEN（无台账记录，已过 drain 门与方向纪律、edge 全解码后）在**同一同步段**内执行：

```
onOpenNamespace(message):                    // edge
  if (!admissions.has(nsId)) {               // 首个 OPEN（该连接该 ns）
    beginAdmission(nsId)                     // ① 先建台账记录 + 发起唯一真实 authorize（D5.2）
  }
  sink.openNamespace(message)                // ② 无条件立即投递（admission 结局无关）
```

session 的 `openNamespace(message)` = HEAD `onOpenNamespace`（:880-894）**逐行原样**：无通道即 `new HubNamespaceChannel(...)` + `channels.set(...)` + `channel.startOpen(message)`（**通道在 OPEN 到达点在场且 `'opening'`**——I13b 谓词立即成立）；有通道即 `channel.onOpen(message)`（重开矩阵，I7）。

**次序约束（不变量）**：① 必须先于 ②——`startOpen` 的 async IIFE 同步执行到首个 `await this.host.authorize(...)`，shim（D5.3）在 ② 内**同步**调用 `port.openAdmission(nsId)`，台账必须已存在。窗口内后续帧经 D4b R-delivered 到达点投递，命中在场 `'opening'` 通道——§2.2 矩阵全部由零 diff 通道在**到达点**产出（I13a 锚）。

#### D5.2 edge 侧准入结算（authorize 单点 + 结局映射 + 迟归传播）

```
beginAdmission(nsId):                        // edge，恰一次/（连接, ns）
  创建 promise + 持有 resolve → admissions.set(nsId, record)
  try {
    authorize(authenticatedInstanceId, nsId)          // ★ 唯一真实 authorize 调用点（C2c/C2d：
      .then(                                           //    入参 = HEAD host.authorize(host.peerInstanceId(), nsId) 逐值）
        a => resolve(a.ok && a.permissions.read
          ? { outcome:'authorized', authorization:a }  // authorized：携完整 ok-投影（localOwner/permissions）
          : { outcome:'denied' }),                     // denied：!ok ∨ !read 单分支折叠（:355-359）
        () => resolve({ outcome:'throw' }))            // throw：异步拒绝 → throw 结局
  } catch { resolve({ outcome:'throw' }) }             // 同步 throw 同样吸收（= HEAD async IIFE try 语义）
```

- **结算无条件传播**：连接收口后 authorize 迟归结算**照常 resolve**（D5.6/H1——迟归续体的 lease 回收依赖此；`.then` 闭包独立于连接状态，cleanup 不切断）。
- promise 永不 reject（throw 以值承载）；resolve 至多一次（JS promise 语义 + 每记录只结算一次）。
- 台账记录连接生命周期内不摘除（listen 只增不减；迟归 lookup 与 C0d 锁步断言需要）。

#### D5.3 session 侧 authorize shim（port 拉取；零 diff 通道的唯一授权入口）

session 不持投影存储（~~iteration 1 D5.3 的 `Map<namespaceId, HubOpenAdmission>`~~ 删除）；channelHost 的 `authorize` 成员：

```ts
authorize: (_instanceIdentity, namespaceId) =>
  port.openAdmission(namespaceId).then((admission) => {
    if (admission.outcome === 'authorized') return admission.authorization;
    if (admission.outcome === 'denied') return { ok: false };   // 与被拒同形 → startOpen 单分支短路
    throw new Error('hub-split: authorizer threw');             // 'throw' → startOpen catch → INTERNAL_ERROR
  })
```

- 台账缺失（不变量破坏——通道存在 ⟺ 台账存在）→ `openAdmission` reject → shim promise reject → `startOpen` catch → `INTERNAL_ERROR` + failed：**响亮失败**（fail-loud，无静默 fallback；SA2 ER-2/N4 方向；C0b 拒绝臂断言锚）。组合形态下结构性不可达（D5.1 次序约束保证），仅手工拼装两半可达。
- **shim 形态唯一**（SA2 F5 随 revoked 结局删除而消解）：denied/throw 两态、无第三形态。
- 被拒 ns 会话资源零唤起：shim `{ok:false}` → `startOpen` 的 `!authz.ok ∨ !read` 判别（`hub-namespace.ts:355-359`，零 diff）→ `registry.open`（:360-372）之前短路——**HEAD 自己的代码路径**，决策 3 实质逐字保全。

#### D5.4 drain 提前完成的等价追踪（F2 修订的本版收敛）

HEAD `maybeFinishDrainEarly`（:640-647，唯一触发点 `onChannelSettled` :529）迭代全部通道，任一通道 ∉ {closed, conflicted, failed} 即阻塞。edge 本地追踪两量：`settledNames`（经 `port.onChannelSettled` 通知的集，单调）+ 台账 keys（= 已投递 ns 集，单调）。判定式（仅在 settled 信号上执行，drainActive/closedFlag 守卫原样）：

```
finishDrain() ⟺ ∀ nsId ∈ admissions.keys(): nsId ∈ settledNames
```

**同构论证（全覆盖 + 包含式收编 pending 案）**：
- **pending 案的包含式收编**：admission 在途 ⟺ 通道 `'opening'`（authorize await 在通道内，D5.1）⟺ 非终态 ⟺ 未 settled（I12：终态 ⟺ settled 已通知，无空窗）→ 迭代式天然阻塞。iteration 1 需要独立 `pendingNames` 集的原因是彼时 pending ns **未投递**（不在 sunkNames 内、也无 settled 可言）；本版 pending ns 已投递、其未 settled 事实即阻塞信号——**独立 pending 集成为冗余，删除**（少一个可漂移的派生状态）。
- 已投递 ∧ 未 settled ⟺ HEAD 非终态通道（opening〔含 authorize 在途与 authorize 已结算但 registry/session 工作在途〕/bootstrapping/reconciling/live/needs-resync/closing）→ 两侧都阻塞；
- 已投递 ∧ settled ⟺ HEAD 终态通道 → 两侧都放行；
- 空（无投递）⟺ HEAD 空通道 → 两侧都在 settled 信号/deadline 收口（无投递即无 settled 信号 → 不提前，等 deadline——与 HEAD 唯一触发点 :529 一致；「beginReauth 时已全终态」角落两侧同收敛）。
- 不变量背书：台账 ⟺ 通道在场（D5.1 锁步 + C0d 断言）；listen 只增不减（L6）⇒ 台账 keys 单调；settled 每通道至多一次（I12）⇒ settledNames 单调。

#### D5.5 revoke（无条件终止——HEAD 原生路径）

```
revokeNamespace(nsId):  return sink.terminateNamespace(nsId)     // 无条件；无通道 → no-op resolve
```

~~iteration 1 的 pending 强制结算 + 保序日志回放 + terminate 标记 + revoked admission~~ **删除**——通道在窗口期在场，HEAD 的 revoke 机制原样可用：

- **revoke 到达点（含 authorize 窗口）**：通道 `'opening'` → `terminateUnauthorized()` 响亮（`NAMESPACE_UNAUTHORIZED` ns ERROR + `namespace-error{sent}` + failed(`protocol-violation`) + settled，`hub-namespace.ts:1186-1191` 零 diff）——与 HEAD 逐点一致（I11）；返回 promise = terminationSettled（服务层语义保持）。
- **迟归 authorize 续体**：admission 按真实结局结算（D5.2）→ shim 续体 → `isOpenAborted`（通道已终态）→ 静默收口；ok 结局时经 D-H1 transient 调一次 `registry.open` 并在下一恢复点回收 lease（`:352-372`）——**HEAD 逐点一致，iteration 1 的 R7 微差（registry 短路）消除**；denied/throw 结局同样静默（`!authz.ok`/catch 分支先判 `isOpenAborted`）。
- **已收口/终态通道**：`isQuietState` → no-op resolve（幂等）；**无通道**：no-op resolve（HEAD 无通道同款）。

#### D5.6 窗口期连接收口（通道承载；H1 锚）

~~iteration 1 D5.6 的「丢弃 pending entry」~~ **删除**——通道在场，收口由既有链承载：

- 五路收口（close/onTransportClosed/connectionFatal/onLivenessLost/onSequenceExhausted）→ `sink.close()`（同步 quiesce 前缀 + 异步尾）→ `'opening'` 通道经 `onConnectionClosed` 静默收口（zero-diff 链）——= HEAD。
- **迟归 authorize**：admission 照常结算（D5.2 无条件传播）→ shim 续体在已收口通道上运行 → `isOpenAborted` → 静默 / **H1 路径**：ok 结局 transient `registry.open` → lease 已交付 → `finishOpenSilently(opened.lease)` 显式回收 → `lease-released`（issue171-red:194 锚）。edge 不吞结算、不摘台账。
- 迟归 revoke：`terminateNamespace` 命中已收口通道 → quiet no-op resolve（= HEAD）。

#### D5.7 幂等、单调与 never-settling 授权器

- admission promise 至多结算一次；台账只增不减；同 ns 再 OPEN 不再发起 authorize（台账命中 → 仅投递，通道 openWaiters 合流）——`openInFlight` 闩锁 + onOpen `'opening'` 分支（零 diff）双保险。
- **never-settling 授权器**（SA8 §8-R8(ii) 的极限角落）：授权器永不含结算时，admission promise 永pending、通道 `'opening'` 无限停放——**HEAD 同角落逐点一致**（HEAD 自身无 authorize 超时，`'opening'` 通道同样无限停放；`harness` 的 authorize 桩在测试收尾必须 settle 的既有纪律不变）。本版**无新增无界缓冲**（窗口帧零缓冲；台账 ≤ 通道数）——iteration 1 的 R8(ii) 登记面随之消解。

**备选（否决，SA3 §7 三条路 + 本版补充）**：
- **edge 侧对 pending ns 合成窗口帧行为**：在 edge 重建 `'opening'` 行通道 FSM（含 UPDATE_ACK→连接 fatal、CLOSE_NAMESPACE→closing 收口链、RESYNC→needs-resync）——决策 1 明文否决的 fork；且结算回放时二次产出；否决。
- **修改两个既有测试**（断言点后移）：DENY LIST 明文禁止（AC4「不改而绿」）；SA3 亦不得弱化既有权威断言；否决。
- **iteration 1 形态（窗口日志 + 结算回放）+ 接受 2 测试红**：直接违反 AC4；SA3 已证伪；否决。
- **方案 B（正式接受推迟等价类 + 修订 AC4/DENY）**：触碰 SA6 冻结契约与「不得弱化既有断言」纪律，且与 ADR 0032 状态行「listen 模式行为逐字节不变」强口径相抵；SA3 不推荐，本版同；否决。
- **（本版新增否决）port 成员改为 `openAuthorization(): Promise<NamespaceAuthorization>`（免 outcome 词汇、shim 零映射）**：少一跳微任务，但 throw 结局被迫走 promise reject（缝合流面上多一个可 reject 形态）、结局词汇（authorized/denied/throw）失去显式承载、与 SA8 注 C 已裁的 `HubOpenAdmission` 词汇断层；微任务收益不可观察（R6' 已登记）；否决。

### D6 生命周期信号映射（决策 2 的 4 控制信号 × 进程内形态）

| 决策 2 信号 / 缝交互 | 进程内形态 | 语义 |
| --- | --- | --- |
| edge→session `close` | `sink.close(): Promise<void>` | 同步前缀 = 全通道 `quiesceConnection`（五路收口在 transport.close 前调用）；异步尾 = `Promise.all(channels.onConnectionClosed())`；幂等；edge `cleanupAll` await 之并汇入 `settleTail` → `onConnectionDropped` |
| edge→session `terminateUnauthorized` | `sink.terminateNamespace(nsId): Promise<void>` | revoke 链（L4/D5.5，无条件投递；窗口期由在场通道响亮承载）；无通道/静默态 → 无副作用 resolve |
| session→edge `settled` | `port.onChannelSettled(nsId)` | 通道终态一次性通知（D5.4 判定输入；'opening' 通道不通知 → 天然阻塞） |
| session→edge `closed` | `sink.close()` 的 promise 汇入 edge `settleTail`（服务层 `close()` 等待面） | 连接结算完成 |
| **（本版新增，须 SA8 裁决）session→edge 准入拉取** | `port.openAdmission(nsId): Promise<HubOpenAdmission>` | 决策 3 `HubChannelHost.authorize` 成员的跨半边载体：session 在 `startOpen` 首 await 处拉取 edge 已发起的真实 authorize 结算结局（纯 JSON；至多结算一次）。**不是决策 2 否决的「接纳信号」**——被否决的是逐帧出站 sent/deferred/rejected 回执（背压语义、跨线程下相对 fire-and-forget 无收益）；本成员是每 (连接, ns) 一次性的授权结局载体（决策 3 的既有义务面），频率与背压路径无关 |
| 进程内组合成员（非信号） | `dataFacetOf` / `channels` 只读投影 / 出站调用同步序号回传 | drain/wheel/shed 查询、既有白盒观测锚、既有 sendControl 返回契约（issue #231 族）；worker 形态下由后续票按决策 5 降级纪律重塑（D6 注记，SA2 N5 认可） |

### D7 组合根（单体 listen = 进程内组合）

`createHubReplication(options)` → `HubReplicationImpl`（服务面与校验链原样）→ 分配点 `createEdge`（与 SA3 现状一致，本版**零功能改动**）：

```ts
const edge = createHubReplicationEdge({
  transport, timer, limits, timeouts, observer, clock,
  instanceId: options.instanceId,
  peerInstanceId: identity,                 // 认证身份（门 5 唯一顺序基准后）
  connectionCounter: this.connectionCounter++,
  authorize: options.authorize,
  earlyFrames: admission.frames,
  sessionFactory: (port) => createHubSessionHost({
    port, registry: options.registry,
    instanceId: options.instanceId, peerInstanceId: identity,
    timer, limits, timeouts,
  }),
  onConnectionDropped: () => this.dropConnection(edge),
});
```

edge 构造序（与现状 `HubConnectionImpl` 构造序逐点对应）：内部状态 → sender/outbound → port 对象（含 `openAdmission`）→ `session = sessionFactory(port)` → hello timer → transport 订阅 → 早到帧重放（重放经同一 onMessage 管线——早到 OPEN 同样到达点建通道，= HEAD 构造尾部重放）。**协议 FSM 单份**：连接 FSM 只在 `hub-edge.ts`、通道 FSM 只在 `hub-namespace.ts`（零 diff）、session host 只做通道容器 + channelHost 组装 + 帧分派壳 + authorize shim。

**备选（否决）**：*单体与拆分双实现并存*（ADR 明文否决）；*组合根持有 session 生命周期*（违反决策 3「session 对象随连接存活为 edge 职责」，且 C0a 的 edge 独立可测性要求 session 可注入）。

### D8 行为冻结总账（零 API / 零配置 / wire 逐字节；本版更新）

- `src/index.ts` / `src/testing.ts` / `src/types.ts` / `src/defaults.ts` / `src/validate.ts` / `src/plugin.ts` 零改动（C5a/C5b 冻结；plugin 消费面 `createHubReplication` + `acceptTrusted` 不变——`plugin.ts:392-414`）。
- 出站字节：占位编码 + 盖章 ≡ 现状单次编码（D3 根基）；出站时序（控制恒先、drain 轮转、额度豁免）由同一 sender/queue 实例承载；判定/编码次序按 D3.3 账逐路径等价，唯一登记窄差见 §13 R4'。
- 入站分类次序：解码准入（edge）→ handshaking 门 → drain 门 → 方向纪律 → OPEN 管线 / 路由 → session 分派，与现状 `onMessage`→`dispatchReady` 全序一致；**authorize 窗口帧行为回到到达点**（§2.2 矩阵逐行由零 diff 通道即时承载——iteration 1 登记的「跨 ns 微任务交错」与「窗口效应（含连接级）推迟至结算」两类差**消除**）。
- **连接状态迁移面（F3）**：`setConnState`（带事件）只服务 close/onTransportClosed/connectionFatal/onSequenceExhausted 四路；`beginReauth` 的 `this.state='draining'`（:602）与 `onLivenessLost` 的 `this.state='closed'`（:994）两处**无事件直赋逐点保留**——不得规范化进 setConnState；onLivenessLost 不调 clearDrainHandles（reauthDeadlineHandle 由 cleanupAll 清）的形态随符号迁移；`drainDeadline` 死字段不迁移。
- 观测面：事件型/字段零新增；发射点按 D2/决策 5 迁移（namespace 域事件由零 diff 通道在到达点/续体点原生次序产出）；同步段内事件次序逐点保持（`finishOpenError` 原序由真实通道原生执行）。
- 错误/close 分类、timer 纪律（句柄必清）、幂等闩锁（closedFlag/reauthRequested/settledNotified/openInFlight）全部随符号迁移。
- 等价判据的登记面（本版收敛为两处）：D3.3 非暂停控制双失败角落（§13 R4'）、authorize 结算续体微任务跳数（§13 R6'）——除此之外零行为差声明（revoke 的 D-H1 transient registry 调用、窗口到达点效应、跨 ns 交错均回到 HEAD 原生形态）。

---

## 8. 数据流路线

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1. 入站 namespace 域帧（已投递 ns，**含 authorize 窗口**） | transport.onMessage(bytes) | — | edge `decodeInbound`（单点全解码，序列检查先行）→ drain 门/方向纪律 → 定偏移路由键 → R-delivered/R-none | 无持久化；进程内函数调用缝（已解码 message + sequence） | session `namespaceFrame` → withChannel 分派 → 通道 FSM（零 diff，**到达点**） | 通道状态迁移 / 出站应答帧 / 观测事件（'opening' 行 = §2.2 矩阵逐行） | 解码失败 → edge `connectionFatal`；无 entry → R-none 合成；终态通道 → isQuietState 静默 | C2a/C2b；C4a/C4b；**ac7-faults:32-56（I13a 到达点锚）**；issue169-171 族；M1 矩阵（窗口臂 + 到达点强化） |
| 2. 入站 OPEN（authorize ok） | peer OPEN_NAMESPACE | edge 台账（`{promise, resolve}`）+ session 通道（**到达点**） | edge 全解码 → `beginAdmission`（唯一真实 authorize 发起）→ 立即 `openNamespace` → 通道 `'opening'` + `startOpen` → shim `port.openAdmission` await | authorize 结局以纯 JSON 经 port 拉取过缝（至多一次） | shim 回放 authorized → `registry.open` → lease/session → OPEN_OK（通道内，零 diff） | 通道在场且 'opening'（I13b）；OPEN_OK / bootstrap/sync 帧；authorize spy 恰一次 | throw/拒 → 路线 3；连接收口竞态 → D5.6/H1 lease 回收 | C2c/C2d；auth-lifecycle-red / issue168；**issue171-red H1（I13b + 迟归续体）**；M1 resolve-ok 臂 |
| 3. 入站 OPEN（denied / throw） | 同上 | edge 台账 + session 终态通道（到达点在场） | admission 结算 denied/throw → shim `{ok:false}`/reject → `startOpen` 判别 → `finishOpenError`（**registry.open 之前短路——HEAD :355-359 自身路径**） | 同上（失败结局纯 JSON 过缝） | 零 diff 通道 `finishOpenError`/`finishOpenSilently` | N waiter → N 帧 ns ERROR + `namespace-error{sent}` + `channel-state-changed` + `namespace-failed` + settled（通道原生）；闩锁后 REOPEN 帧/静默 | 窗口帧已收口 → `isOpenAborted` 静默；发送路径异常按 sendChecked 折叠 | issue172 契约锚 / observer-red；M1 resolve-deny 臂；C0b denied/throw 臂 |
| 4. 出站控制帧（session 来源） | 通道 sendControl（OPEN_OK/CLOSE_OK/RESYNC/IDENTITY_CHANGED/ns ERROR/…） | session 占位编码（sequence=0） | 函数调用缝 → edge `sender.sendControlFrame`（observeWater + 暂停态额度，byteLength 确定判据，D3.3 次序） | edge 控制队列（字节） | `emitOne` 盖章 `[8..12]` → transport.send | wire 帧（序号单点、控制恒先）；返回序供通道记账 | 额度耗尽 → 1011 收口；编码 throw 同步回传通道 catch（O6 折叠） | C1a/C1b/C1d；issue169/231 |
| 5. 出站数据帧（drain 轮转） | ACK 空位/恢复/入队通知 | 通道 UpdateChannel/BulkTransfer 队列（session 侧） | edge `sender.drainData` → `sink.dataFacetOf(nsId).pullAndSendOne()` → 通道拉一帧 → session 闸门前置 + 占位编码 → 缝 → edge `tryEmitDataFrame` | edge data 出队（字节） | `emitOne` 盖章 → transport.send；onEmitted 记账 | UPDATE/UPDATE_CHUNK wire 帧；往返序号回传通道记账 | admission 拒 → 0（通道保留队列）；编码 throw 同步回传 | C1c；issue137/169/295/301 族 |
| 6. 连接级出站帧（edge 自有） | HELLO 完成 / reauth / fatal / R-none 合成 | edge 消息形态控制管线 | 与路线 4/5 汇流同一 `emitOne` | 同上 | transport.send | HELLO_ACK/GOAWAY/连接 ERROR/合成 ns ERROR（逐字节金标） | 收口直发豁免原样（O7） | C3a/C3b/C3c；issue174-176/reauth-lifecycle |
| 7. 连接收口 | close()/对端断/fatal/pong 超时/序列耗尽 | edge closedFlag + 状态迁移（L1 两处直赋保留） | 五路同构：清 drain 句柄（onLivenessLost 除外）→ sender.teardown → `sink.close()`（'opening' 通道随全量 quiesce/onConnectionClosed 收口）→ transport.close → `cleanupAll` | settleTail（含 session 清算） | `onConnectionDropped` → 服务层摘除；`settle()` 等待面 | close code/reason 分类 + 事件 + 全通道 closed；迟归 authorize 续体照常运行（H1 lease 回收） | 句柄必清纪律随符号迁移；通道清理异常在通道收口链内部消化（零 diff） | issue171(H1)/174-176/close 族；M3 事件计数；根套件 |
| 8. revoke / reauth | 服务层 `revoke`/`requestReauth` | — | revoke → edge `revokeNamespace` → **无条件** `sink.terminateNamespace`（窗口期通道在场 → `terminateUnauthorized` 响亮；迟归 admission 按真实结局流动 → `isOpenAborted` 吸收 + D-H1 transient registry.open/回收）；reauth → edge `beginReauth`（GOAWAY + deadline + D5.4 判定） | wire GOAWAY / ns ERROR（路线 4/6） | observer / 服务面 | NAMESPACE_UNAUTHORIZED 终结 + 资源收口；GOAWAY → 1001 | 幂等（闩锁/静默态 no-op）；deadline stale fire 零副作用 | C3b；issue175/reauth-lifecycle-red；**M2 drain-pending**；M1-revoke 臂（HEAD 基线） |

跨模块/跨持久化边界：本设计零持久化、零跨进程边界（进程内函数调用缝是唯一新增边界，两侧均为纯数据：字节帧 + 纯 JSON 消息/admission；无 live 对象过缝——`dataFacetOf`/`channels` 投影为进程内组合成员，D6 注记）。Registry/lease/session 资源所有权不变（全部在 session 半边经既有通道收口链；denied/throw 在 `registry.open` 之前短路；revoke-窗口-ok 的 transient 调用与回收 = HEAD 原生 D-H1 路径）。

---

## 9. 错误、恢复、并发和幂等

| 面 | 设计 |
| --- | --- |
| 失败分类 | 全部既有分类原样迁移：解码族（MALFORMED_FRAME/SEQUENCE_VIOLATION/UNSUPPORTED_*→wsCloseCodeFor）、背压族（CONNECTION_BACKPRESSURE 1011）、策略族（CONNECTION_POLICY_VIOLATION 1008）、活性（1001 pong-timeout 零 ERROR）、序列耗尽（1008 零出站帧）。缝上无新错误形态；port 字节路径缺可选宿主成员 → 构造期/首用响亮 throw；D3.3 登记的唯一窄差除外（R4'） |
| authorize 调用面 | 真实 authorize 单点在 edge（恰一次/（连接, ns），首个 OPEN 到达点发起）；**同步 throw 与异步拒绝均由 D5.2 try/双回调吸收为 `throw` 结局**（= HEAD async IIFE try 语义）；shim 只拉取已结算结局，结构性无法触达真实授权器 |
| admission 竞态 | 窗口期连接收口 → 通道经 `sink.close()` 收口，迟归 admission 照常结算 → 续体 `isOpenAborted` 静默 / H1 lease 回收（D5.6）；窗口期 revoke → 在场通道响亮终结，迟归结局按真实值流动被吸收（D5.5）；never-settling 授权器 → 通道 `'opening'` 无限停放（= HEAD，D5.7） |
| 同步重入 | drain→facet→通道→缝→sender 的重入链与现状同栈（现状即经 HubConnectionImpl 同对象重入）；`sink.openNamespace` 投递段内（建通道 + startOpen 同步前缀 + shim 同步调 port.openAdmission）无外部事件可插入——通道在场性与台账锁步的关键结构（D5.1 次序约束） |
| 幂等 | closedFlag / reauthRequested / settledNotified / openInFlight / channel 收口链幂等随符号迁移；`sink.close()` 幂等；terminateNamespace 对无通道/quiet ns 无副作用 resolve；admission promise 至多结算一次、台账只增不减、同 ns 再 OPEN 零 authorize（台账命中 + openWaiters 合流双保险） |
| 回滚 | 纯结构重构、零数据/配置迁移：单提交回滚即恢复单体；无运行态需要转换 |
| 资源账 | Registry lease/session 归 session 半边既有通道收口链；denied/throw admission 在 registry.open 之前短路（被拒 ns 零会话资源）；revoke-窗口-ok 的 transient registry.open + 回收 = HEAD 原生 D-H1 路径（两侧一致，无登记差）；timer 句柄清理点随符号迁移（hello/reauth/poll/通道 timer 全集不变）；早到帧 admission 缓冲仍归服务层；admission 台账 ≤ 通道数（与 `channels` Map 同阶，HEAD 既有增长面，无新增无界面） |

---

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
| --- | --- | --- | --- | --- |
| `src/plugin.ts`（hub 插件装配） | `createHubReplication(options)` + `acceptTrusted` + 服务面 | 完全不变（组合根内部换装） | 零 | `plugin.ts:9,392-414` |
| `src/testing.ts` | `createHubReplication` 包装 | 不变 | 零 | `testing.ts:1,111` |
| `src/index.ts` / `/testing` 导出面 | 11 + 5 运行时导出 | 冻结不动（C5a） | 零 | `index.ts`；SA6 C5a |
| `apps/yjs-server`（`requireHubReplication` 消费方） | 服务面 | 不变 | 零 | SA6 §10 |
| `src/peer-connection.ts`（peer 侧） | message 形态 `OutboundQueue`/`ConnectionSender` | 同签名同字节继续可用（D3.2 message 形态原签名保留） | 零 | `peer-connection.ts`（非目标） |
| 既有 6 个直构 `OutboundQueue`/`ConnectionSender` 的测试 | message 形态构造 + 显式 `ConnectionSenderHost` 标注 | 签名/必选成员不变；新增成员全部可选或独立方法 → 编译与断言双绿 | 零（测试不改） | issue169-red:180-210、observer-red:799-823 等 |
| 其余内部消费（`update-channel`/`bulk-transfer`/`round-engine`/`fence-watchdog`） | 经 `HubChannelHost` 注入面 | 注入面由 session 组装，24 成员形状不变（`authorize` 成员实现换为 D5.3 shim，签名不变） | 零（模块零 diff） | `hub-namespace.ts:52-100` |
| SA6 契约测试文件（17 用例，DENY） | C1~C6 行为断言（经公共入口，缝形态无关） | 必须继续全绿（实现零修改该文件）：C2a/C2b 序列收口在 edge 解码点不变；C2c/C2d authorize 恰一次/入参一致（edge 单点真实调用，首个 OPEN 到达点）；C4 路由键布局不变 | 零 | `test/ws-replication-issue418-edge-session-split-contract.test.ts`（全文无 seam/openNamespace 引用，已核） |
| 既有 13 个读 `hub.connections[0].channels` 的白盒测试 | 连接对象 `channels` Map 只读投影 | edge face `channels` → session Map 同引用（D1）；**窗口期即有值**（到达点建通道——iteration 1 下无值的 1 处〔issue171-red:183〕回到 HEAD 形态） | 零（测试不改） | issue171-red/review-revisions-red/sa6-hardening-g1-g2/g3-g4/sa7-* 族（SA3 A1 清单） |
| 服务层 `revoke`/`requestReauth` 调用方 | promise 语义（terminationSettled / 无副作用 resolve） | 逐点保持（D5.5/D5.4） | 零 | `hub-connection.ts:406-448` |
| C0a/C0b 白盒测试的 stub halves（ALLOW 内测试代码） | iteration 1 形态：stub sink 收 `openNamespace(msg, admission)` / stub port 无 authorize 面 | **stub 适配**（§12）：C0a stub sink 收 `openNamespace(msg)` 并脚本化调用 `port.openAdmission`；C0b stub port 实现 `openAdmission`（脚本化 ok/denied/throw + 拒绝臂） | 测试内 stub 更新（ALLOW） | `ws-replication-issue418-edge-session-split-structure.test.ts` |

---

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
| --- | --- | --- |
| `packages/ws-replication/src/hub-split.ts` | 修改（SA3 现状 → 本版）：`HubOpenAdmission` 删 `revoked` 变体；`HubSessionEdgePort` 增 `openAdmission`；`HubSessionSink.openNamespace` 删 admission 参数；`channels` 投影注释定为观测类；契约头不变量重写（delivered ⇒ 在场〔到达点〕/ 台账 ⟺ 通道 / 恰一次 authorize） | D1 缝契约（本版核心 seam 变更） |
| `packages/ws-replication/src/hub-edge.ts` | 修改（SA3 现状 → 本版）：删二相 OpenEntry/PendingEvent/`entries`/`pendingNames`/`sunkNames`/`dropPendingEntries`/`settlePending`/`authorizeFirstOpen`；增 admission 台账 + `beginAdmission` + `openAdmission` 查找（缺失 reject）；`onOpenNamespace` → 到达点投递（D5.1）；路由表三案（R-delivered 命中台账——含窗口期）；`revokeNamespace` 无条件化（D5.5）；drain 判定两量化（D5.4）；其余（FSM/liveness/reauth/收口/mux/L1 直赋）不动 | D2/D4b/D5/D6 |
| `packages/ws-replication/src/hub-session.ts` | 修改（SA3 现状 → 本版）：删投影存储 `projections` 与 `replayAuthorization`；`openNamespace` 删 admission 参数（= HEAD :880-894 原样）；authorize shim → port 拉取 + 两态映射（D5.3）；其余（channelHost 组装/分派壳/占位编码/闸门前置/close/terminate/facet）不动 | D2/D3.1/D5.3 |
| `packages/ws-replication/src/hub-connection.ts` | 本版相对 SA3 现状**零功能改动**（组合根与服务面已就绪；仅头注释口径更新——「到达点建通道 + 异步 admission」） | D7 |
| `packages/ws-replication/src/frame-io.ts` | 维持 SA3 现状（`OutboundQueue` 字节形态 + `[8..12]` 盖章 + message 形态薄包装） | D3（本版未触碰） |
| `packages/ws-replication/src/backpressure.ts` | 维持 SA3 现状（字节形态成员 + 可选宿主成员） | D3（本版未触碰） |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-structure.test.ts` | 修改（§12）：C0a/C0b/C0d 适配新缝（openNamespace 无参 admission；stub port `openAdmission`；锁步断言改为到达点在场；删窗口日志/强制结算结构断言，增「edge 无 OpenEntry/PendingEvent 符号」结构断言） | C0a~C0d 白盒判据（SA6 §12.1 命名落定后由实现交付；ALLOW 内测试可随缝形态更新） |
| `packages/ws-replication/test/ws-replication-issue418-pending-window-matrix.test.ts` | 修改（§12）：M1 各臂期望值不变（== HEAD 基线，SA3 已两态采集 25/25 绿）+ **加到达点断言**（效应在 authorize resolve 之前上 wire——镜像 I13a）；M1-revoke 臂重定基（标题与资源断言改 HEAD 原生语义：transient `registry.open` + lease 回收；wire/事件断言不变）；M2/M3 不动 | M1/M2/M3 验收（SA2 F1~F3）；ALLOW 内测试随设计修订更新，不弱化断言强度 |
| `packages/replication-protocol/test/codec-namespace-routing-key-offset.test.ts` | 维持 SA3 现状（结构性守卫，与 D4 无关变更） | ADR 决策 4 守卫 |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
| --- | --- | --- |
| `packages/ws-replication/src/hub-namespace.ts` | 通道实现（AC3 对象；D5 全部失败面/闩锁/静默门/收口链由其原生承载——本版依赖**进一步加深**：'opening' 行矩阵 + terminateUnauthorized + D-H1 续体全部原生） | 零 diff 门禁（`git diff --stat` 零变更 + C0b + C2c/C2d 语义锚） |
| `packages/ws-replication/src/index.ts` / `src/testing.ts` | 公共契约面 | C5a 冻结；零新公共 API |
| `packages/ws-replication/src/types.ts` | 公共类型面（缝类型一律放 `hub-split.ts`） | 零新公共 API；C5a |
| `packages/ws-replication/src/defaults.ts` / `src/validate.ts` | 配置缺省与校验 | C5b 冻结；零配置变化 |
| `packages/ws-replication/src/plugin.ts` | Cordis 装配 | 零配置/零 API 变化；服务签名冻结（ADR 0023） |
| `packages/ws-replication/src/peer-connection.ts` / `peer-namespace.ts` | peer 侧 | ADR 0032 后果节：peer 拆分留待后续（non-goal） |
| `packages/ws-replication/src/{update-channel,bulk-transfer,round-engine,fence-watchdog,update-transfer,liveness,observer,error-mapping,lifecycle-queue}.ts` | session 侧机械件 | 经注入面协作即可完成拆分；改动徒增回归面 |
| `packages/replication-protocol/src/**` | codec 生产码 | wire 逐字节不变；守卫测试只进 test/ |
| `packages/ws-replication/test/**` 既有 73 个测试文件（含 SA6 契约文件、`ws-replication-ac7-faults.test.ts`、`ws-replication-issue171-red.test.ts`） | 既有回归面（I13 两锚在此） | AC4「逐字节绿灯」＝**不改而绿**；SA3 §7 方案 B 触碰此面已被否决；SA6 产物归 SA6 |
| `docs/protocols/**`、`docs/adr/**`、`CONTEXT.md`、`docs/**` | 规范与决策文本 | wire/协议/决策零变化；ADR 0032 已记录拆分决策；§8-R7 文本调和义务不在本票强制（SA8 §6） |
| `apps/**`、根配置（`vitest.config.ts`/`tsconfig*`/CI） | 消费方与门禁 | 公共 API 不变；收集面自动覆盖新测试文件 |

---

## 12. 验收与验证映射

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
| --- | --- | --- | --- |
| AC1 两半可独立实例化（C0a） | 缺口（SA6 GAP1） | **更新** C0a：`createHubReplicationEdge` + transport 桩 + **stub session sink**（记录 `openNamespace(message)`——无 admission 参数；脚本化调 `port.openAdmission(nsId)` 取结局）+ 注入 authorize 桩（无 Registry/无 hub 服务）；驱动 HELLO→OPEN | HELLO_ACK/OPEN_OK 全帧 hex == `FROZEN_HELLO_ACK_HEX`/`FROZEN_OPEN_OK_HEX`；raw `[8..12]` == 1..N；stub sink 到达点收到 OPEN（authorize 桩未 resolve 之前）；admission 经 port 拉取 `{outcome:'authorized'}`；authorize 恰一次（`{instanceIdentity:'peer-alpha', namespaceId}`） |
| AC1 session 可独立实例化（C0b） | 缺口 | **更新** C0b：`createHubSessionHost` + **stub port**（记录占位帧、回递增序号、gate 恒开、**`openAdmission` 脚本化**——ok/denied/throw/拒绝四形态）+ 真实 Registry/Runtime；`openNamespace(OPEN)` + `namespaceFrame` 驱动全生命周期；denied/throw 臂 + **`openAdmission` reject 臂**（shim 响亮 INTERNAL_ERROR，非静默——N4 方向） | OPEN_OK→BOOTSTRAP_SNAPSHOT→SYNC_STEP2→SYNC_APPLIED→CLOSE_OK 全生命周期；denied/throw 臂 N 帧 + 恰一事件族 + `registry.open` 零调用（denied/throw 臂——短路仍成立）；reject 臂 INTERNAL_ERROR；占位帧解码语义/序号与 C1d/C3a 对齐；`HubNamespaceChannel` 生产码零 diff |
| AC1 单体 = 进程内组合 + 单份 FSM（C0c） | 缺口 | 结构审阅（无「单体分支 vs 拆分分支」双实现；连接 FSM 唯一在 hub-edge、通道 FSM 唯一在 hub-namespace；**edge 无 finishOpenError/闩锁/窗口帧复现/二相 entry/结算回放影子**）+ 全量套件经组合根跑通 | 73 文件/535+ 用例 + 根全量全绿 |
| AC1/C0d 缝纪律 | 缺口 | **更新** C0d：插桩 sink 记录 edge→session 投递序列；hub-only fixture 全生命周期 + reauth/fatal/revoke 场景；**锁步断言升级为到达点**：`openNamespace` 返回后 `sink.channels.has(nsId)` 立即为真（authorize 未 resolve 亦然）；**结构断言**：`hub-edge` 无 `OpenEntry`/`PendingEvent` 符号（源文本扫描或行为证明——窗口帧不缓冲） | 投递序列不含 HELLO/HELLO_ACK/GOAWAY/连接级 ERROR kind；`openNamespace` 必先于该 ns 任何 `namespaceFrame`；台账命中 ⟺ 通道在场；revoke sunk/窗口 → `terminateNamespace`、无通道 → no-op；close 幂等（sink.close + transport.close 各恰一次） |
| AC2 出站单点盖章 | C1a/C1b/C1c/C1d（绿） | 既有契约 + C0a/C0b 白盒 | 两态全绿；占位 0 泄漏/双计数器形态被 C6a 反证拒收 |
| AC2 入站收口在 edge | C2a/C2b（绿） | 既有契约（零 authorize/零 OPEN_OK + close 1002） | 两态全绿 |
| AC3 通道零改动 | C2c/C2d（绿） | `git diff --stat -- packages/ws-replication/src/hub-namespace.ts` 为空 | 零变更；authorize 恰一次经注入 host（shim 在 session 组装） |
| AC4 wire 逐字节 + 全量绿灯（**含 I13 两锚**） | SA3 §6：iteration 1 实现下 2/569 红（`artifacts/sa3-issue418-{package-suite,root-test,blocker-focus}.log`） | 既有全量：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/ws-replication --typecheck.enabled=false`（本版机制下 ac7-faults:53 与 issue171-red:183 由构造转绿——D5.1 到达点建通道 + D4b R-delivered 即时投递 + D5.2 迟归传播） | 包全量 75 文件（既有 72 + SA6 契约 1 + 本票新增 2）全绿 EXIT=0（对照 SA3 §6 的 73/75 + 2 红）；金标逐字节相等；**不改任何既有测试文件** |
| AC5 门禁 | SA6 §13（绿） | `pnpm exec tsc -p packages/ws-replication/tsconfig.json`；根 `pnpm typecheck`；根 `pnpm test` | 三项 EXIT=0 |
| **M1 pending 窗口矩阵（SA2 F1 必做；本版强化）** | SA3 已两态采集：HEAD 基线 25/25 + iteration 1 实现 25/25（`artifacts/sa3-issue418-m1-head-baseline.log`）——期望值即 HEAD 基线，本版机制下天然保持 | 维持 deferred authorize × 10 臂 × {resolve-ok, resolve-deny}（UPDATE 合法/字段超限、UPDATE_CHUNK kind0/kind2、CLOSE_NAMESPACE、ERROR、BOOTSTRAP_ACK、UPDATE_ACK、RESYNC_REQUIRED、再 OPEN）+ **新增到达点断言**：各响亮臂的 wire 帧在 `resolve()` 之前已在 `transport.frames()`（镜像 I13a；iteration 1 下此断言红、HEAD 绿——本版必须绿） | 每臂与 HEAD 基线逐帧/逐事件一致 **且到达点成立**；deny 臂 N OPEN → N ns ERROR + 3 事件；窗口 UPDATE → 到达点 STATE_VIOLATION 帧 + failed，deny 结算静默；UPDATE_ACK 窗口 → 到达点连接 ACK_STATE_VIOLATION fatal；CLOSE_NAMESPACE 窗口 → 到达点 CLOSE_OK；resolve-ok ∧ 窗口 UPDATE → 通道 failed、零 OPEN_OK；re-OPEN 合流臂 waiter 数 == 帧数 |
| **M1-revoke 臂（重定基）** | iteration 1 版本断言「资源零唤起」（`registry.open` 零调用）——本版下 revoke-窗口-ok 走 HEAD 原生 D-H1 路径 | 保留 wire/事件断言（不变：到达点 NAMESPACE_UNAUTHORIZED + protocol-violation + settled；迟归 ok 后零新帧零新事件——两者在 HEAD 与本版同为真）；**资源断言重定基为 HEAD 基线**：迟归 ok 后 `registry.open` 恰一次 transient 调用 + lease 释放（registry spy 断言；先在 HEAD stash 基线采集）；标题更新 | 与 HEAD 基线逐点一致；`registry.open` 调用模式 == HEAD（R7 差消除的直接锚） |
| **M2 drain-pending（SA2 F2）** | SA3 已绿（iteration 1 与 HEAD 同绿） | 同文件维持：deferred authorize + `requestReauth` + 其余 ns 全部终态 → 断言连接**不**在 deadline 前收口；随后 resolve（ok→通道流转至终态 / deny→failed+settled）→ 才允许提前收口（'opening' 通道未 settled ⇒ 阻塞——D5.4 包含式收编的行为锚） | close(1001) 时点不早于 deadline 与该 ns 结算 |
| **M3 状态迁移零新事件（SA2 F3）** | SA3 已绿 | 同文件维持：`beginReauth`（ready→draining）与 pong 超时（→closed）全程 observer 事件计数零 `connection-state-changed` | 与 HEAD 基线一致 |
| 决策 4 路由键布局守卫 | C4a/C4b + SA3 守卫测试（绿） | 维持 codec 侧结构性守卫测试 | 全部 ns 域 kind 定偏移窗口断言绿；codec 字段序变更即红 |
| D3.3 次序等价（F4） | 6 个直构测试 + issue169/231 族（绿） | 既有额度/耗尽测试继续全绿；R4' 角落登记不伪造测试 | 可达面全绿；R4' 由 §15 复查确认 |

---

## 13. 风险、回滚和残余问题（含延迟义务账）

| # | 风险/残余 | 等级 | 处置 |
| --- | --- | --- | --- |
| R1 | ~~慢授权器窗口内跨 ns 出站微任务交错~~ **已消除**：窗口帧到达点即时进入通道、效应到达点产出（= HEAD）——跨 ns 交错回到 HEAD 原生形态；M1 到达点断言钉死 | — | 关闭（本版收益） |
| R2 | ~~pending 全帧窗口日志无界（ADR 决策 3「pending 有界缓冲」延期义务 / SA8 §8-R4 / 模块 AGENTS「admission bounded」）~~ **就地了结**：本版**零新增缓冲面**（窗口帧不缓冲、到达点投递；台账 ≤ 通道数、每 ns 一次性；再 OPEN 合流走 HEAD 既有 openWaiters）。模块 AGENTS 的 admission 有界纪律在 handshake（早到帧 ≤16，既有）/ready（窗口零缓冲）/backpressure（额度账本，既有）/drain（drain 门，既有）四窗口均由既有面承载，无新无界面 | — | **义务对「本票新增面」关闭**；worker 形态票引入真实跨线程 pending 状态时义务重新进入（follow-up 登记）；本票收尾如实陈述「决策 3 的 pending 有界缓冲条款在本票无新增适用面」而非「全部兑现」 |
| R3 | 回放/窗口纪律漂移风险 → 本版转化为「到达点纪律」风险（窗口帧必须即时投递、不得缓冲） | 低 | M1 到达点断言 + C0d 锁步断言 + I13a 既有锚三重钉死 |
| R4 | `OutboundQueue`/`ConnectionSender` 双形态并存（message + bytes）的维护面 | 低 | 单一 `emitOne` 收口；message 形态仅薄包装；peer 侧仅用 message 形态；6 个既有直构测试即回归锚 |
| R4' | **D3.3 登记窄差**：非暂停控制帧「出站序列耗尽（≥0xffffffff）∧ 消息编码必败」同时成立时错误类不同（HEAD：OutboundExhausted + close 1008；设计：MALFORMED → ns ERROR + failed） | 极低（双不可达） | 结构性源于 issue 明文机制；登记不伪造测试；§15 交复查确认 |
| R5 | edge 全解码准入 vs 决策 4「不解析 payload」的口径；**本版扩面**：`openAdmission` 拉取缝与「OPEN 在结局前过缝」对决策 2/3 字面的口径 | 中（门禁性，非行为风险） | 入站缝维持 SA8 注 A 裁决；**新增面交本版 SA8 复查（§15.1 裁决简报）——裁决前实现适配不合入**；worker 形态票为既定前置门禁（SA8 §8-R5） |
| R6' | **authorize 结算续体微任务跳数**：HEAD 1 跳（authorize promise resolve → 续体）；本版约 3 跳（realAuthorize resolve → edge `.then` 结算 → shim `.then` 映射 → await 恢复）——仅影响测试泵预算，不影响 wire/事件序（帧序在到达点已固定） | 低 | harness `settle`/`settleUntil` 显式泵（预算充裕，SA2 N3 实测 <10ms）；M1/H1/C2c 全部经此形态验证；无 wall-clock 依赖 |
| R7 | ~~revoked 强制结算的 registry 短路微差~~ **已消除**：revoked 机制删除，revoke-窗口-ok 走 HEAD 原生 D-H1 transient 调用 + 回收；M1-revoke 臂重定基为 HEAD 基线（registry spy） | — | 关闭（本版收益；§15.4 请 SA8 确认 R9 中 R7 复查项撤销） |
| R8 | ~~窗口效应推迟至结算的等价类登记（SA8 §8-R8(i) 连接级效应 + (ii) never-settling 授权器）~~ **消解**：(i) 推迟类整体不存在（到达点效应）；(ii) never-settling 授权器下通道 `'opening'` 无限停放与 HEAD 逐点一致（D5.7），无新无界缓冲 | — | 关闭（§15.4 请 SA8 确认 R8 义务了结） |
| R8' | **文本调和义务（SA8 §8-R7，存续且描述差扩大）**：ADR 0032:22 机制句（「未授权 OPEN 不过缝，edge 复现…」）与 CONTEXT.md:230 词条（「消费 edge 传入的预授权投影」）描述的形态与本版差距扩大——OPEN 在结局产出前过缝、投影以拉取交付 | 中（跨票义务） | 维持 SA8 §8-R7 口径：worker 形态票 SA8 前置门禁之前或之中正式落 ADR 修订/澄清附录；Host 可在本票实现同变更集自愿先行落 documentation-only 附录（推荐非阻断）；在此之前任何票不得援引机制句字面迫使回到「缓冲丢弃/edge 复现/结算回放」形态 |
| R9' | **新缝面成员 `openAdmission` 的裁决依赖**：实现适配（相对 SA3 现状的 §11 ALLOW 改动）以 SA8 对本版设计的冲突复查通过为前置 | 中（流程） | §15.1 裁决简报备好；`requiresConflictRecheck: true`；SA2 设计评审先行 |
| R10 | C0a/C0b stub 适配与新缝漂移（stub 行为失真——如 stub sink 不调 `openAdmission` 导致挂起） | 低 | C0a 显式断言 stub 收到 OPEN 的时点（authorize 桩 resolve 前）；C0b 四形态臂（ok/denied/throw/reject）全覆盖 |
| 回滚 | 单提交结构重构、零数据迁移 | — | revert 即恢复单体；无运行态转换 |
| Follow-up（非本票） | worker 形态：edge/session 跨进程传输、入站缝形态 + `openAdmission` 拉取形态重新过 SA8（§8-R5）、跨线程 pending 有界缓冲义务重新进入（R2）、`listen:false`/`nomicoreHubSessionHost`/`createHubReplicationEdge` 导出面、peer 侧对称拆分、路由台账本地化形态复核（本版 edge 台账即该形态的结构前提，D4b）、ADR/CONTEXT 文本调和（R8'） | — | 均为 ADR 0032 后果节/后续票明示范围；本票不预留公共面（SA6 U4 冲突信号约束） |

**延迟义务账（SA8 §8-R1~R9 × 本版状态）**：R1（结构证据）→ 测试更新后重跑；R2（冻结门）→ 维持；R3（M1/M2/M3 必做）→ 维持 + 到达点强化 + revoke 臂重定基；R4（pending 有界缓冲延期）→ **就地了结**（§13 R2）；R5（worker 前置门禁）→ 维持且扩面（openAdmission）；R6（推迟等价判据）→ **消解**（R1/R8 同）；R7（文本调和）→ 维持且描述差扩大（R8'）；R8（登记补全）→ **消解**；R9（登记差复查：R4' 维持 / R7 撤销）→ 请 SA8 复核确认。

---

## 14. 评审修订映射

### 14.1 SA3 实现 reject（§7 BLOCKER + §8 登记项）→ 本版修订位置

| Finding | 严重度 | 修订位置 | 处理结果 |
| --- | --- | --- | --- |
| **§7 BLOCKER**：D5.1/D5.2 结算段回放使「通道在结算段才被创建、窗口帧效应推迟」，与 AC4「既有测试不改而绿」在 2 处不可同时满足（ac7-faults:53 到达点零 ERROR / issue171-red:183 通道在场性谓词永不成立）；三条修复路（edge 合成 = F1 否决的 FSM fork；通道前移 = 超出 D1 缝面口径 + SA8 R9 新缝面；改测试 = DENY 禁止）均不在实现权限内 | BLOCKER | **§7 D5 整体重写**（采纳其建议方案 A）：D5.1 到达点投递 + 通道建立（I13 两锚由构造保证绿）；D5.2 edge 结算映射 + 迟归无条件传播（H1）；D5.3 port 拉取 shim；D5.4 drain 两量化（pending 包含式收编）；D5.5 revoke 无条件终止（R7 差消除）；D5.6 通道承载收口；D5.7 never-settling 等价；§1 等价判据强化（到达点效应）；§11 ALLOW（缝与两半的适配清单）；§12（两锚 + M1 强化 + revoke 臂重定基） | 已落实：新缝行为（`openAdmission` 拉取）按 SA8 R9 口径登记为须重过 SA8 的新缝面（§15.1），设计不以实现便利静默扩缝 |
| §7 修复路 2 的判定（「通道前移需要 seam 新增行为面成员——属设计变更，非 SA3 权限」） | — | §7 D1（`openAdmission` 成员及契约注释）+ §15.1 | 已落实：本版即为该设计变更的正规定型；SA3 的判断被采纳为修订触发器 |
| A1（`HubSessionSink.channels` 只读投影，D1 未列） | 登记项 | §7 D1（formalize：观测类投影，组合根 face 承载 13 个既有白盒锚）+ D4b（**路由事实源 = edge 台账**，投影不承载行为——与 A1 的「非第二事实源」口径一致且更强） | 已落实：投影保留但降为纯观测；worker 形态可迁移性论证入 D4b 备选否决记录 |
| A2（F5 调和：revoked → `{ok:false}`） | 登记项 | §7 D5.2/D5.3：`revoked` 结局**删除**（无生产者），shim 两态唯一 | 已落实：F5 矛盾随机制删除消解（比调和更彻底） |
| A3（routingKeyOf 定偏移读数 ≠ 解码值 → 响亮 MALFORMED_FRAME） | 登记项 | §7 D4a 原样保留 + 守卫测试（ALLOW 维持） | 维持 |
| A4（requestSinkClose 单点幂等） | 登记项 | §7 D2/D6（sink.close 幂等 + 四收口路径单点调用）维持 SA3 现状 | 维持 |
| A5（R4' 角落登记不伪造测试） | 登记项 | §7 D3.3 + §13 R4' 维持 | 维持 |
| A6（R2/R5/R7 义务登记） | 登记项 | §13 延迟义务账：R2 就地了结 / R5 扩面 / R7 消除 | 已更新 |

### 14.2 SA2 approve（F1~F4 已解决 + F5）→ 本版承接

| Finding | 状态 | 本版处理 |
| --- | --- | --- |
| F1（窗口帧等价，iteration 0 BLOCKER） | iteration 1 已解决；本版机制更强 | §2.2 矩阵逐行维持为根证据；等价构造从「输入序列重放」升级为「到达点原样」（更弱的前提、更强的结论）；M1 维持必做 + 到达点强化 |
| F2（drain 判定漏 pending，MAJOR） | iteration 1 已解决；本版公式收敛 | §7 D5.4：三量 → 两量（pending 包含式收编论证）；M2 维持 |
| F3（证据表不符，MINOR） | 已解决 | §2.4/D8 逐字维持；M3 维持 |
| F4（次序翻转，MINOR） | 已解决 | §2.3/D3.3 逐字维持（含 N1 observeWater 位移论证采纳）；R4' 维持 |
| F5（revoked shim 形态文本矛盾，MINOR） | **本版消解** | `revoked` 结局删除（D5.2/D5.3）——矛盾载体不复存在；M1-revoke 臂重定基为 HEAD 原生 |
| N1~N5 | 已吸收/维持 | N1（单事实源）→ D4b 台账决策 + C0d 锁步断言；N2/N4 → §5/§12 维持（C0b reject 臂）；N3 → R6' 更新口径；N5 → D6 注记维持 |

---

## 15. 是否需要设计后 ADR 冲突复查及理由

**需要（`requiresConflictRecheck: true`）**。SA8 对 iteration 1 的裁决（clear + 注 C）不覆盖本版的一处新缝面与两处形态变化，须对修订版重跑冲突检查。裁决简报如下：

### 15.1 新缝面成员 `port.openAdmission(namespaceId): Promise<HubOpenAdmission>`（SA8 §8-R9 口径：行为面成员 = 新缝面）

- **是什么**：session→edge 的异步拉取成员；session 的 `HubChannelHost.authorize` shim（决策 3 该成员的 session 侧实现）在 `startOpen` 首 await 处调用，取回 edge 已发起的真实 authorize 的结算结局（`HubOpenAdmission` 纯 JSON，authorized/denied/throw 三态）。
- **为什么需要**：恢复 HEAD 的通道存在性时序（首个 OPEN 到达点建通道 + `startOpen` await 语义）同时保住「真实 authorize 单点在 edge」——SA3 §7 证伪了 push 形态（结算段回放推迟通道存在性与到达点效应，2/569 既有测试红）；不引入任何 edge 侧通道 FSM 复现（决策 1）。
- **与决策 3 目的读法（注 C）的关系**：注 C 五点目的逐点保全且更强——(i) authorize 单点 edge、恰一次、真实授权器对 session 结构性不可达（拉取只能消费已结算结局，无法注入/影响/重试授权）；(ii) 被拒 ns 零会话资源唤起（shim `{ok:false}` → HEAD 自身 `!authz.ok` 短路，:355-359）；(iii) `NAMESPACE_UNAUTHORIZED` wire 面 + 闩锁由单份零 diff 通道原生产出；(iv) 准入结算管线（authorize 发起、结局映射、台账）在 edge；(v) `HubNamespaceChannel` 零 diff。**形态变化**：OPEN 在结局产出**之前**过缝（iteration 1 为失败结局随参数推送）——注 C 第 1 点论证（字面读法迫使「wire 逐字节不变」或「单份 FSM」必破其一）在本版对**通道存在性**（I13b）与**到达点效应**（I13a）同样成立且更直接；ADR 0032:35「投影仍传入，但语义是 edge 授权结果的传递」的语义在本版由参数传递转为拉取交付，语义本体（授权结果的传递）不变。
- **与决策 2「缝无接纳信号（fire-and-forget）」的区分**：被否决的备选是逐帧**出站接纳回执**（sent/deferred/rejected，背压语义，跨线程下无收益多契约）；`openAdmission` 是每 (连接, ns) **一次性授权结局载体**（决策 3 的既有义务面，频率与背压路径无关）；缝词法类不变（纯 JSON 结果）。
- **范围限定**：进程内 listen 组合（函数调用返回 promise，零跨线程）；worker 形态下该成员承载实质通信成本，必须随 §8-R5 前置门禁重新裁决（与注 C 第 5 点同口径）。
- **请 SA8 裁决**：(a) 新成员作为决策 3 authorize 跨半边载体的可接受性；(b) OPEN 过缝时序前移（结局产出前）对「未授权 OPEN 不过缝」机制句目的读法延伸确认；(c) 与 §8-R7 文本调和义务（R8'）的联动。

### 15.2 决策 5 / 观测归属（维持 iteration 1 裁决，无新面）

到达点机制下 namespace 域事件全部由零 diff 通道在到达点/续体点原生次序产出——较 iteration 1 更贴近决策 5 默认归属（无结算段时序面）；请随 15.1 一并复核确认。

### 15.3 义务账复核请求

- **R4（pending 有界缓冲延期）就地了结**的口径确认（§13 R2：本票零新增缓冲面；worker 形态票重新进入）。
- **R6（推迟等价判据）与 R8（登记补全）消解**的确认（到达点机制下推迟类不存在；never-settling 角落与 HEAD 逐点一致）。
- **R9 中 R7（revoked registry 短路）复查项撤销**的确认（机制删除，M1-revoke 臂重定基为 HEAD 原生 D-H1 路径）。
- R4'（双不可达角落）维持登记，接受性确认（同 iteration 1）。
- R6'（结算续体微任务跳数 1→约 3）为新登记项，接受性确认。

### 15.4 维持项

入站「已解码消息 + 序号」缝形态（SA8 注 A 已裁本票 no-conflict；worker 形态票为前置门禁）；`hub-split.ts` 内部生命周期契约面（本版收敛后：admission 台账 + 拉取成员 + 到达点锁步不变量）随实现 diff 一并复审（SA8 §10 置 true 的原有理由仍立）。

---

## 附录 A：实现顺序建议（供实现角色参考，非验收门槛；基线 = worktree 内 SA3 iteration 0 未提交实现）

1. `hub-split.ts` 缝契约适配（D1：删 revoked / 增 openAdmission / openNamespace 去参 / 注释重写）；
2. `hub-session.ts`：删投影存储与 replayAuthorization → openNamespace = HEAD :880-894 原样 → shim 改 port 拉取（D5.3）；
3. `hub-edge.ts`：删二相 entry/窗口日志/结算回放/强制结算/dropPending → admission 台账 + beginAdmission（含同步 throw 吸收）+ openAdmission 查找（缺失 reject）→ onOpenNamespace 到达点投递（D5.1）→ 路由三案（D4b）→ revokeNamespace 无条件化（D5.5）→ drain 两量化（D5.4）；L1 直赋/收口/liveness/mux 不动；
4. `hub-connection.ts`：仅头注释口径（零功能改动）；
5. 测试适配：structure 测试（C0a/C0b/C0d stub 与断言，§12）→ matrix 测试（M1 到达点断言 + M1-revoke 臂重定基——先 stash 实现在 HEAD 采集 revoke 臂资源基线）；
6. 门禁：`git diff --stat` DENY 面零变更 → 包 typecheck → 根 `pnpm typecheck` → 包全量 vitest（**两锚必须绿**）→ 根 `pnpm test`。

## 附录 B：SA3 iteration 0 实现的复用判定（worktree 现状 → 本版适配量）

| 文件 | SA3 现状 | 本版适配 | 复用率 |
| --- | --- | --- | --- |
| `frame-io.ts` / `backpressure.ts` | 字节形态 + 可选宿主成员（iteration 1 D3 全量落地） | 零改动 | 100% |
| `hub-connection.ts` | 服务面 + 组合根 + createEdge | 零功能改动（头注释） | ~100% |
| `hub-session.ts` | channelHost 组装/分派壳/占位编码/闸门前置/close/terminate/facet 就绪；投影存储 + replayAuthorization 为待替换面 | 删投影存储与 replay、openNamespace 去参、shim 改拉取（≈ 30 行净减） | 高 |
| `hub-edge.ts` | FSM/准入/路由/mux/liveness/reauth/收口就绪；二相 entry/窗口日志/结算回放/强制结算为待替换面 | 删机械件（≈ 90 行）、增台账 + beginAdmission + openAdmission + 到达点投递 + 路由/判定简化（≈ 50 行净变动） | 高 |
| 三个 #418 测试文件 | 56/56 绿（对 iteration 1 形态） | §12 更新（stub 适配 + 断言强化/重定基） | 中高 |
