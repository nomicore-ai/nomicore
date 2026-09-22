# task_issue-424 设计（SA1）— 分片形态端到端等价性验收（spec #415 T7）

- Issue：#424「分片形态端到端等价性验收（spec #415 T7）」（Parent = PR #416 `spec/415-replication-transport-decoupling`；Blocked by #420/#421/#422 —— 三票已全部在基线内交付）
- Worktree / HEAD：`/home/wangjian/nomicore-fix-issue-424` / `cab3e8c245ef189da1d823719370a68459939316`（与 SA6 契约 §1、SA8 两报告一致）
- 上游输入：SA6 契约 `wiki/raw/task_issue-424_sa6_contract.md`（approve）+ 探针 `wiki/raw/task_issue-424_sa6_capability_probe.mts`（gaps 4/4、oracles 14/14、红臂 5/5）+ SA8 前置门禁 `wiki/raw/task_issue-424_conflict_report.md`（clear、requiresConflictRecheck=true）+ SA8 相关决策摘录 `wiki/raw/task_issue-424_relevant_decisions.md` + SA8 设计复审 `wiki/raw/task_issue-424_design_conflict_report.md`（clear；§8-2 两处行锚精度修正）
- **本设计为迭代 1**：评审输入 = `wiki/raw/task_issue-424_sa2_review.md`（verdict=`reject`，1 项 MAJOR：F-R1 boot 形态 ROUND 装配路径不闭合；非阻断观察 N1–N7）。本轮逐条落实 F-R1 并吸收全部可吸收的 N 项（§14 修订映射）；Issue 评论 REST 快照为空（`[]`）——无 Owner 评论要求可映射（§4）
- 产物位：本文件（`wiki/raw/task_issue-424_design.md`），原位整体修订（不追加式保留失效内容）

---

## 1. 任务类型、目标和非目标

**任务类型：Feature / 阶段收官验收（test-only）**。能力缺口 = 验收装配与等价性证据缺位（SA6 §5 G1–G4），**不是**生产行为缺陷（SA6 §O 14/14 在 HEAD 实测全绿；H1/H9 排除生产半边缺能力与本票为 Bug 型）。

**目标**（全部为 test-only 交付）：

1. **T-1 分片 harness**：`packages/ws-replication/test/issue424-sharded-hub.ts` —— 用内存管道把公共 `createHubReplicationEdge`（ingress/edge）与 ≥2 个公共 `createHubSessionHost` 实例（worker 分片，各持真 Registry/Runtime）按「一条连接、多 namespace、多会话宿主」拓扑接线，并提供 `HubReplication` facade 供 `boot({ createHub })` 注入（模拟 nomic-server ingress/worker 分片；ADR 0032 背景 L8）。facade 为 **adopt 形态**（§8.3）：在 facade 内把会话宿主建于 `options.registry`/`options.timer` 之上（O8 已验证装配），使 boot 形态的 hub 侧观察面与复制会话同源。
2. **T-2 授权等价性矩阵套件**（AC1）：同一 `Uint8Array` 脚本驱动单体 listen 形态与分片形态，四态（pass / `NAMESPACE_UNAUTHORIZED` deny / authorizer throw `INTERNAL_ERROR` / 闩锁期重 OPEN）wire 输出按契约硬门逐字节/逐语义一致。
3. **T-3 跨缝完整协议回合套件**（AC2）：真 peer（`createPeerReplication`）经分片装配完成 OPEN→bootstrap→reconcile→live→CLOSE，含 `UPDATE_CHUNK` 协商与非协商两形态。
4. **T-4 多 worker 套件**（AC3）：1 连接 × 多 namespace × 多 worker 的 demux/mux 与出站 sequence per-connection 严格递增。
5. **T-5 生命周期套件**（AC4/AC5）：连接终结传播与资源释放（无泄漏）、revoke/reauth 经 edge 入口路由且 wire 与单体一致。
6. **T-6 收官门禁证据**（AC6）：既有 listen 全量套件 + 根 `pnpm typecheck`/`pnpm test` + 新套件同轮全绿，证据落 `artifacts/`（GATE-C3 证据面覆盖全 DENY，§12.6）。

**非目标**（与 SA6 §12.0 DENY、SA8 §5 冻结面一致）：

- 零生产改动：不改 `packages/ws-replication/src/**`、`packages/replication-protocol/**`、`packages/namespace-registry/**`、`apps/**`、`domains/**`；零公共面变更（前序票 #420/#421/#422 冻结面 append-only 保持）。
- 零规范文档改动：`docs/**`（含 ADR 0032、协议 v1、CONTEXT.md）零 diff。
- 不实现 peer 侧拆分、跨 worker 运维扇出（ADR 0032 后果 L67 non-goal）。
- 不做 `UPDATE_CHUNK` 深度矩阵（超限分块端到端）——归既有资产锚（#243/#246/#300/#301，SD-4 裁决见 §7.5）。
- 不做确定性 clientID 注入方案（全轨迹逐字节硬门不成立，协议 §22 纪律；SA6 §15-4）。
- 不修改既有 455 个测试文件中的任何断言以就范（SA6 §12.0 纪律）。
- harness 不引入 worker_threads/MessageChannel 依赖或类型（ADR 0032 决策 2；进程内内存管道即分片拓扑的载体抽象）。
- 夹具不提供 limits/timeouts 覆盖面：两半边（edge/session host）恒用公共 `DEFAULT_REPLICATION_LIMITS/TIMEOUTS` 同一组冻结值（§8.1）；无任何契约条目需要限值变化场景，出现即属新需求（follow-up 扩夹具）。

---

## 2. 当前行为与证据锚点

### 2.1 公共面与测试基建（全部已在库、发布即冻结）

| 面 | 锚点 | 关键事实 |
|---|---|---|
| edge 公共工厂 | `packages/ws-replication/src/index.ts:10`；`hub-edge-host.ts:958-962` | `createHubReplicationEdge(options)`：`{instanceId, timer, authorize, resolveSessionSink, verifyToken?, limits?, timeouts?, observer?, clock?}`（limits/timeouts 为 Partial，工厂内 resolve，`hub-edge-host.ts:166-167`）；双入口 `accept`/`acceptTrusted`，每次分配独立内部 edge 实例 |
| 连接句柄 | `hub-edge-host.ts:133-149` | `HubReplicationEdgeConnection`：`state`/`peerInstanceId`/`authenticatedInstanceId`/`connectionKey`/`namespaces`/`egress`/`close`/`settle`/`beginReauth`/`revokeNamespace` |
| egress 出站缝 | `hub-edge-host.ts:118-130` | `sendControlFrame`/`sendDataFrame`（返回盖章后 wire 序；0=拒）/`namespaceSettled`/`connectionFatal`/`chunkedUpdateNegotiated` |
| 宿主 sink 缝 | `hub-edge-host.ts:91-100,110-114` | `HubNamespaceSessionSink` 四成员（`openNamespace`/`namespaceFrame`/`terminateUnauthorized`/`onConnectionClosed`）；`HubSessionSinkResolver(connectionKey, namespaceId, grant)` → sink \| undefined \| Promise；仅授权通过后调用 |
| session host 公共工厂 | `hub-session-host.ts:261-263`；`index.ts:6` | `createHubSessionHost({registry, instanceId, limits, timeouts, timer, observer?, clock?})`——**`limits: ResolvedLimits`/`timeouts: ResolvedTimeouts` 必填全量形**（`hub-session-host.ts:47-48`）；`open(input)` 描述子纯 JSON |
| 会话句柄 | `hub-session-host.ts:73-84` | `handleFrame`（入站字节）/`onFrame(listener): (frame, lane) => number`（出站 sink，同步回传被分配序）/`onSignal`（`settled`/`connection-fatal`）/`terminateUnauthorized`/`close`（幂等同 promise） |
| 重复开启响亮拒绝 | `hub-session-host.ts:247-253` | 同 `(connectionKey, namespaceId)` 重复 `open()` → throw（SD-3 撞键的失败语义 = 响亮，无静默复用） |
| connectionKey 生成 | `hub-edge-host.ts:749,914-916` | 工厂**实例**计数器（初值 0）：`${instanceId}-conn-${n}`；与 observability `connectionId` 同串（单一键系统） |
| 单体组合根 | `hub-connection.ts`（`createHubReplication`）；ADR 0032 决策 1 | 单体 listen = Edge + SessionHost 进程内组合，协议状态机单份 |
| 早到帧重放 | `hub-edge.ts:228-232` | 构造尾部**同步**重放 earlyFrames（≤16 帧）；handshaking 纪律不绕过 |
| 授权链时序 | `hub-edge-host.ts:402-448` | `resolveSessionSink` 仅在 authorize→`openAdmission` 异步链结算后调用；denied/throw 终态闩锁（L211-216/L416-425）零缝调用；解析失败 → 连接级 `INTERNAL_ERROR` + `close(1011,'protocol-error')`（L440-450/L515/L523） |
| 公共冻结限值/超时常量 | `index.ts:22-26`；`defaults.ts:16-51,61-69` | `DEFAULT_REPLICATION_LIMITS/TIMEOUTS`（公共导出，全量冻结值，含 5 个分块纪元字段）；`ResolvedLimits extends ReplicationLimits {}` 空扩展（`types.ts:1009-1010`）⟹ 常量可直接赋 `ResolvedLimits`；resolve 模式 = `{...DEFAULT, ...(partial ?? {})}` |
| 测试基建 | `test/harness.ts`（`makeNode`/`makeHubNamespace`/`StubPersistence`/`settle`/`settleUntil`/`makeWire`/常量）；`test/driver.ts`（`boot({createHub})` L489-526、`collectUnhandledRejections` L625、`advanceMs` L618） | 真 Registry/Runtime（`createNamespaceRegistryForTesting` + 受控 clock/scheduler/randomBytes）；`CONTRACT_LIMITS` 为 harness 本地旧形接口（`harness.ts:43-57,129-141`，**缺 5 个分块字段**，不可赋 `ResolvedLimits`——夹具限值必须用公共 DEFAULT 常量） |
| **boot 观察面绑定（F-R1 证据基座）** | `driver.ts:409-417`（`writeHub` 经 `hubFixture.lease`）、`driver.ts:419-425`（`doc('hub')`/`snapshotDoc('hub')`/`rootValue`/`metaValue` 经 `hubNode.persistence.peek`）、`driver.ts:463-470`（`bumpHubEpoch` 经 fixture lease）、`driver.ts:498-505`（`makeHubNamespace(hubNode)`——hub fixture 建于 `hubNode.registry`）、`driver.ts:516-526`（`createHub` 注入缝收 `{instanceId, registry: hubNode.registry, authorize, timer: hubNode.scheduler, verifyToken, limits?, timeouts?, observer?, clock?}`）、`driver.ts:512-521`（wrappedVerifier）、`driver.ts:535`（dial = `hub.accept(wire.hubEnd, {token})`）、`driver.ts:217`（`Run.hubNode` 公有只读） | boot 的**全部** hub 侧观察成员硬绑定 boot 内部 `hubNode`；`boot` 恒把 `registry: hubNode.registry` 与 `timer: hubNode.scheduler` 交给 `createHub` —— 这是 §8.3 boot 形态约束的源码事实 |
| runner | `vitest.config.ts` | include `packages/*/test/**/*.test.ts`；typecheck `**/*.test-d.ts`；maxWorkers 1；alias `@nomicore/*` → `src/index.ts`（`nomicore-source`）；`@nomicore/*/testing` → `src/testing.ts` |
| 类型检查面 | `packages/ws-replication/tsconfig.json` include `["src/**/*.ts","test/**/*.ts"]` | 新夹具与 4 个 `.test.ts` 自动入包 typecheck（GATE-C2）；本票零新公共类型面 → 无新 `*.test-d.ts`（SA6 §12.0） |

### 2.2 目标行为已绿的运行期证据（SA6 探针，HEAD 实测）

| oracle | 行为 | 设计承接 |
|---|---|---|
| O1/O2/O2-latch | 四态授权：单体 vs 分片控制帧语料逐字节相等（pass 形态含 OPEN_OK×2 重开矩阵）；闩锁期重 OPEN 恰一帧 `NAMESPACE_REOPEN_REQUIRES_RECONNECT` | AUTH-C1~C4 |
| NC2/NC3 | pass 形态重 OPEN → OPEN_OK×2（非闩锁拒答）；deny 形态分片侧零会话（未授权 OPEN 不过缝）、pass 恰一会话 | AUTH-C4/NC 嵌入 |
| O3/O6 | 1 连接 × 2 ns × 2 worker：路由恰一次/worker、出站序 `[1..5]` 严格递增；第二连接首帧序 = 1 | SHARD-C1/C2、SEQ-C1 |
| O4 | close → 2/2 会话 `closeCalls≥1`、`state=closed`、零新出站 | TERM-C1 |
| O5 | revoke 末帧与单体逐字节相等 + `terminateCalls=1` + 跨 worker 零外溢 | REVOKE-C1/C2 |
| O7 | 单体 vs 单体（独立建文档）：控制帧逐字节等、全轨迹不等（Yjs clientID 随机性）→ 硬门必须限定控制帧语料 | AUTH-C5(a)、§7.2 硬门 |
| **O8** | 真 peer 完整回合经分片装配：OPEN_OK/BOOTSTRAP/SYNC_STEP1-2-APPLIED/live/双向 UPDATE+ACK/CLOSE_OK 回指/settled×1/close 幂等/timer 无泄漏/零 unhandled；**其唯一 green 的 boot 装配 = worker 会话宿主建于 `options.registry`/`options.timer` 之上（探针 L971-1003，worker 采纳 boot registry——§8.3 把该形态结构化为 facade adopt 模式）** | ROUND-C1~C3、TERM-C2 |
| O9 | GOAWAY×1 → CLOSE_NAMESPACE → settled×1 → drain 提前完成 `close(1001)`（零 deadline timer 推进）；阴性对照无 reauth 不关连接 | REAUTH-C1/C2 |
| O10 | 宿主登记缺失（早到 OPEN 形态）：`HELLO_ACK#1` + 连接级 `ERROR(INTERNAL_ERROR)#2` + `close(1011)`、零会话（响亮收口） | SD-2(b) 退化路径锚（§7.3） |
| NC1 | 从未 OPEN 的 ns 帧 → 合成 `NAMESPACE_STATE_VIOLATION`、连接存活、双形态逐字节等 | SHARD-C3 |
| NC4 | 已协商（`CAP_CHUNKED_UPDATE`）形态 parity 成立 + 描述子 `selectedCapabilities` 携带协商位 | ROUND-C4、SD-4 |

探针确定性 3/3 逐行一致（SA6 §7）；红臂 5/5 点亮预期 ORACLE（§9 实验 2）——契约断言敏感性已证，交付套件无需携带变异开关（§7.8）。

### 2.3 现有装配面为何不够（G2/G3 的源码事实）

- `test/issue420-shim-hub.ts`（#420 夹具）：装配面 = 单 `HubReplicationOptions.registry` + 单 `createHubSessionHost`（L227-235 一带）+ **内部** edge 模块 `../src/hub-edge.js`（L56/L692）——跨 worker registry 的 ns 只能落 `ERROR(NAMESPACE_NOT_FOUND)`（探针 G2 实测）。
- `ws-replication-issue421-*.test.ts`：宿主 sink 全为记录桩（无真 Registry/Runtime）；「公共 edge 工厂 + 多公共 SessionHost + 真 Registry」组合零覆盖（探针 G3 清单）。
- 因此分片 harness 必须新建（T-1），且只许装配公共工厂（ADR 0032 决策 1：不得自写协议行为、不得 fork 状态机）。

---

## 3. 根因 / 能力缺口链（承接 SA6 §8）

| id | 缺口 | 证据 | 本设计响应 |
|---|---|---|---|
| G1 | #424 验收套件不存在（`packages/ws-replication/test/` 零 `*424*`） | 探针 G1；SA6 runner-trigger 占位实测后删除 | §11 ALLOW LIST 5 个新文件（发现面与 `vitest.config.ts` include 同构，SA6 §14 已实测可发现） |
| G2 | 无「一条连接 → ≥2 session host 实例」装配 harness | G2 运行期实证；`issue420-shim-hub.ts` 装配头注 | §8 夹具：worker 分片 + `resolveSessionSink` 按 ns 路由 + facade |
| G3 | 公共工厂 × 真 Registry/Runtime 组合零运行时证据 | G3 清单 | §8 夹具全部用真身（公共 edge 工厂/公共 SessionHost/`createNamespaceRegistryForTesting`/真 peer）；stub 只在宿主缝另一侧（authorize 桩、假 timer） |
| G4 | 四态 parity / 多 worker 序列 / 终结传播 / revoke 路由零断言落点 | G4 + O1–O9 | §12 验收映射：四套件逐一落点 |

**放大因素**（SA6 §8，设计直接吸收）：(a) `HubNamespaceSessionSink` 四成员 → `HubSessionHandle` 的投影装配此前只存在于 #420 夹具（内部 edge 形态）——本设计把公共工厂形态的投影表显式化（§8.2），同时按 SA6 §10 下游消费者行为在夹具头注登记「非规范宿主样例」边界；(b) `connectionKey` 登记时序（SD-2，§7.3）；(c) 观测面差异（未授权 OPEN 无 `channel-state-changed`、dormant 面）已由 ADR 0032 A3 + 协议 §23.1 登记——验收语料必须是 **wire 面**（H8）。

---

## 4. Owner 要求落实

Issue 评论 REST 快照为空（`[]`）——**无 Owner 评论要求、无评论 id/时间戳可映射，不存在被忽略的 Owner override**（SA8 前置门禁 §4、SA8 设计复审 §1、SA2 评审 §4 三方同款结论）。Owner 要求 = Issue 正文（简报）。逐项映射：

| 简报条目 | 设计承接章节 | 契约承接 |
|---|---|---|
| AC1 四态授权等价矩阵逐帧一致 | §7.2 硬门、§12.1 | AUTH-C1~C5 |
| AC2 跨缝完整协议回合（含 UPDATE_CHUNK 两形态） | §8.3（boot 形态约束）、§8.4 R7/R8、§12.2、§7.5 SD-4 | ROUND-C1~C4 |
| AC3 一条连接多 ns 多 host：demux/mux + 出站序严格递增 | §8.2/§8.4 R4、§12.3 | SHARD-C1~C3 + SEQ-C1 |
| AC4 连接终结传播 + 无泄漏 | §8.4 R6、§9、§12.4 | TERM-C1~C3 |
| AC5 revoke/reauth 经 edge 路由 + wire 与单体一致 | §8.4 R5/R6、§12.5 | REVOKE-C1~C3 + REAUTH-C1~C2 |
| AC6 全量套件 + 根 typecheck/test 绿灯 | §12.6、§11 | GATE-C1~C3 |
| 「内存管道 + 一条连接、多 namespace、多会话宿主拓扑」 | §8.1 | 交付路径 §12.0 |
| 「证明 ADR 0032 语义等价承诺」 | §2.2 O1–O10、§6 | 全部六组 |

---

## 5. 复现和根因承接

| 上游事实 | 证据位置 | 设计响应 |
|---|---|---|
| 能力缺口 4/4 可运行证据化（G1–G4） | 契约 §5；`artifacts/sa6-issue424-probe-green.log` | §3 缺口链逐项响应；交付物 = 验收套件而非生产修复 |
| 目标行为 14/14 在 HEAD 可达（真 Registry/Runtime + 真 peer） | 契约 §13-2；探针 §O | §2.2 全部承接为套件断言（§12 映射） |
| 断言敏感性 5/5 红臂 | 契约 §13-3；`artifacts/sa6-issue424-mutation-sensitivity.log` | 交付套件保留负控（NC1–NC4 + AUTH-C5），不携带变异开关（§7.8） |
| O7：全轨迹逐字节连单体自身都不成立（clientID 随机性，非拓扑归因） | 契约 §9 实验 1；协议 §22 L701 三层确定性断言 | §7.2 硬门三层判据（控制帧字节 / 数据帧语义 / 全轨迹骨架）+ AUTH-C5(a) 负控 |
| O10：宿主登记缺失 → 响亮收口（连接级 INTERNAL_ERROR + 1011 + 零会话） | 契约 §9 实验 3；`hub-edge-host.ts:440-450` | §7.3 SD-2(b) 退化路径文档化 + 可执行负控 |
| SD-3 撞键场景探针开发期实测命中重复开启拒绝 | 契约 §12.8 SD-3；`hub-session-host.ts:247-253` | §7.4 每场景一工厂约定 |
| **O8 的 boot 装配形态唯一性：唯一 green 的 boot 装配 = worker 会话宿主建于 `options.registry`（= boot `hubNode.registry`）；「预建自建 registry worker + boot 观察」组合不可绿（F-R1 的运行期依据）** | 探针 L971-1003（O8 唯一 green 装配）；`driver.ts:409-445`（hub 侧观察全绑 boot 节点）、`driver.ts:516-526`（注入缝恒传 boot registry） | §8.3 boot 形态 registry 同一性约束 + facade adopt 模式（结构化采纳）+ §12.2 装配前提断言 |
| 上游事实与源码矛盾 | 未发现（SA8 两报告辅助核验亲验 connectionKey 生成/重复开启拒绝/收口路径/boot 注入缝绑定属实；SA2 §5/§6 独立复核一致） | — |

---

## 6. SA8 约束落实

SA8 前置门禁 verdict = **clear**（19 项对照：no-conflict 8 + implements-existing-decision 11；hard-conflict/override/evolution-required 均 0），携带 4 个未决范围决策（SD-1~SD-4）交本设计裁决并要求设计后复审（其 §8-4）。SA8 设计复审 `task_issue-424_design_conflict_report.md` 已对迭代 0 作出 **clear**（16 项对照：no-conflict 7 + implements-existing-decision 9；SD-1~SD-4 全部落在其 adjudication 边界内；§8-2 提出两处行锚精度修正——本轮已回写，见 §12.0/§14-N1）。本轮 F-R1 修订只改 harness 装配形态（test-only、零新决策面、零公共面触碰），四项 SD 裁决不变；修订增量仍属 SA8 §8-4 复核面（§15）。

| 决议或义务 | 锚点 | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|---|
| ADR 0032 决策 1：协议状态机单份，只许分布式实例化；宿主自写连接级半边 = fork，否决 | `0032` L14 | §8.1/§8.3 | harness 只装配公共工厂（真 `createHubReplicationEdge`/`createHubSessionHost`/Registry/Runtime）；桥只做字节/JSON 中继与信号搬运，零协议决策、零应答合成；facade adopt 模式只是**装配位置**变化（会话宿主建于 boot registry 之上），被装配对象仍是公共工厂真身 | 否（兑现型） |
| 决策 2：缝只过字节与纯 JSON；入站序 edge 校验；出站 `sequence=0` 占位 + mux 点重写 `[8..12]`；wire 逐字节不变 | `0032` L18；协议 §3 L57 | §8.2 投影表、§8.4 R3/R4、§7.2 硬门 | 桥经 `encodeMessage(message, {sequence})`/`{sequence:0}` 重组入站字节；出站原样透传占位帧并回传被分配序；断言读 `[8..12]` 原字节 | 否 |
| 决策 3 + A2-β：authorize 在 edge 单点；未授权 OPEN 不过缝（denied/throw 由 edge 侧处置）；OPEN 准入管线全为 edge 规范职责 | `0032` L22/L47-48；CONTEXT.md L226/L230 | §8.2、§7.3 | harness 不建第二准入管线、不复制拒绝帧；AUTH-C2/C3「零会话」断言直接观察；SD-2 裁决吸收「响亮收口」 | 是（SD-2 落点核对；迭代 0 已核 clear，修订未触碰） |
| 决策 4：路由键定偏移；合法无 sink → 合成 `NAMESPACE_STATE_VIOLATION`；违例 → `MALFORMED_FRAME` fatal | `0032` L26；CONTEXT.md L233-235 | §12.3 SHARD-C3 | 套件只观察合成帧与连接存活；路由由公共 edge 内部完成，harness 零实现 | 否 |
| 决策 5 + A1/A3：观测发射点归属、dormant 降级、`settled`/`closed`/`connection-fatal` 公共载体、`onFrame` 同步回传被分配序（0=被拒） | `0032` L30/L38-41/L53 | §8.2、§8.4 R4/R5 | 桥按 A1 载体映射信号；回传序零改写（红臂 `no-sequence-return` 已证其为承重面） | 否 |
| 协议 §3/§5/§6/§7.1/§12/§13/§14/§17/§21/§22/§23.1 各条款（envelope/序纪律/OPEN 矩阵/错误注册表/close code/drain/conformance 三层断言/观测差异登记） | 协议对应节（SA8 relevant_decisions §3 行锚；行锚精度按 SA8 设计复审 §8-2 修正为 L375/L425） | §7.2、§12 全组 | 断言判据逐条引用协议条款（见 §12 表） | 否 |
| 模块 AGENTS：测试纪律（注入 seam、真实入口、无 skip/only）+ 验证门 | `packages/ws-replication/AGENTS.md` | §9、§12.6 | 时间纪律与门禁命令直接采纳 | 否 |
| 前序票冻结面 append-only（#420 `createHubSessionHost`、#421 `createHubReplicationEdge`、#422 `listen:false`） | 契约 §3-8；`0032` L64-66 | §11 DENY | 本票零公共面变更；harness 只消费（facade adopt 模式消费 `options.registry`，不新增任何公共成员） | 否 |
| SA8 前置 §8-1：设计必须显式裁决 SD-1~SD-4 且落点在报告 §3 边界内 | 冲突报告 §8-1 | §7.1/§7.3/§7.4/§7.5 | 四项裁决 + 边界核对表（§7.6）；迭代 0 经设计复审核 clear，本轮未改裁决 | 是（修订增量按 §8-4 复核，§15） |
| SA8 前置 §8-2 / 设计复审 §8-2：硬门纪律不得放宽或加严；两处行锚精度 | 冲突报告 §8-2；设计复审 §8-2 | §7.2、§12.0/§12.1 | 逐字节只落控制帧、数据帧语义等值、observer 不入 parity；行锚已按 L375/L425 回写（§14-N1） | 否（兑现型） |
| SA8 §8-3：任何生产/规范文档改动不得本票就地发生 | 冲突报告 §8-3 | §7.1（SD-1 停手协议）、§11 | ALLOW/DENY 严格执行；触发条件登记 | 是（若 SD-1 触发） |

---

## 7. 设计决策与主要备选方案

### 7.0 总体架构（D-A：进程内内存管道 = 分片拓扑的载体抽象）

```
真 peer（createPeerReplication）或脚本注入端（pipe/wire）
        │  wire: Uint8Array 帧（20 字节 envelope，[8..12] = 出站序）
        ▼
┌─ ingress（本进程）──────────────────────────────────────────┐
│ 公共 createHubReplicationEdge（ingress shim）                │
│  · accept/acceptTrusted、HELLO/协商、authorize 单点          │
│  · resolveSessionSink(connectionKey, ns, grant)  ────────────┼──┐
│  · egress（mux 点盖章 [8..12]；namespaceSettled/connectionFatal）│ │ 纯 JSON + Uint8Array
└──────────────────────────────────────────────────────────────┘ │ （缝：只过字节与四控制信号）
        ▼ 桥（harness 宿主桥：只搬运，零协议决策）                 ▼
┌─ worker-0 ──────────────┐   ┌─ worker-1 ──────────────┐
│ 真 Registry/Runtime      │   │ 真 Registry/Runtime      │
│ 公共 createHubSessionHost│   │ 公共 createHubSessionHost│
│ （namespace 级 FSM 单份） │   │ （namespace 级 FSM 单份） │
└─────────────────────────┘   └─────────────────────────┘
```

- **pipe 形态**（AUTH/SHARD/TERM/REVOKE/REAUTH 套件）：每 worker = 真 `createNamespaceRegistryForTesting`（StubPersistence + 受控 clock/scheduler/seeded randomBytes）+ 公共 `createHubSessionHost`；worker 间零共享（模拟 worker_threads 分片的隔离事实，但不引入其类型——ADR 0032 决策 2）。观察面 = `pipe.frames()`/`probes.*`。
- **boot 形态**（ROUND 套件）：拓扑塌缩为单 worker，但其会话宿主**采纳 boot registry**（`options.registry` ≡ `run.hubNode.registry`）与 `options.timer`——缝形态（edge ↔ 桥 ↔ session host）与 pipe 形态完全一致，仅 worker 的 registry 归属不同（§8.3 约束；O8 已验证）。
- **备选 A'**：真 worker_threads + MessageChannel —— 否决：ADR 0032 明令 nomicore 零 worker_threads 依赖；缝契约在进程内已完整可观察（探针 O1–O10 证明）；真 worker 形态（γ 载体）为后续票。
- **备选 A''**：复用 #420 shim 夹具并扩展 —— 否决：其装配面绑内部 edge 模块 + 单 registry（G2 实测不可路由），且会把「内部缝形态」混入「公共工厂形态」的等价性证据，稀释验收主张。

### 7.1 SD-1 裁决：套件暴露真实生产偏差 → **停手报 SA8/设计，不就地修生产**

- **裁决**：采纳 SA6 立场与 SA8 边界（前置门禁 §3 SD-1 行、§8-3）。本票 ALLOW LIST 为 test-only；若任一断言发现真实偏差（parity 不等 / 序列异常 / 收口失败），实现者**不得**修改 `packages/**/src/**` 或软化断言，而是：
  1. 保留失败现场（复现命令 + 失败断言 + wire 语料），落 `artifacts/issue424-deviation-*.log`；
  2. 在交付说明中登记偏差与证据，按 SA6 契约 §12.8/SA8 §6-1 分类上报：「实现向 ADR 对齐」= implements-existing-decision（新修复票）；「改 wire/协议语义」= evolution-required（须同变更集修订协议/ADR 并重过门禁）。
- **理由**：偏差 = 实现偏离 ADR 0032「wire 逐字节不变」承诺；生产改动超出本票冻结面（ADR 0032 L64-66），就地修会绕过 SA6 契约验收与 SA8 门禁。
- **偏差前置甄别（F-R1 修订追加）**：ROUND 套件红灯时**先核装配前提**（§12.2 引用同一性断言 `facade.worker.registry === run.hubNode.registry` 已在场景前置执行并通过），再按 SD-1 分类——防止把「装配错位」（伪偏差）误报为生产偏差浪费停手上报轮次（SA2 E7 的处置）。
- **备选（否决）**：就地修生产——违反 DENY LIST 与 append-only 冻结纪律。

### 7.2 硬门判据（D-B：三层确定性断言；协议 §22 L701 纪律的直接套用，不得放宽或加严）

| 层 | 适用帧 kind（**枚举白名单**） | 判据 |
|---|---|---|
| L1 控制帧逐字节 | `HELLO_ACK`、`OPEN_OK`、`ERROR`、`CLOSE_OK`、`GOAWAY` | 出站帧 `Uint8Array` → hex 逐帧全等且顺序全等 |
| L2 数据帧文档语义 | `BOOTSTRAP_SNAPSHOT`、`UPDATE`、`UPDATE_CHUNK`、`SYNC_STEP2` | 帧 kind+seq 骨架相等 ∧ `Y.applyUpdate` 后 `ROOT`/`META` 语义相等 |
| L3 全轨迹骨架 | 全部帧（含 `SYNC_STEP1`、`SYNC_APPLIED`、`BOOTSTRAP_ACK`、`UPDATE_ACK`、`CLOSE_NAMESPACE`…） | `kind(code?)#sequence` 逐帧序列相等 |

- **禁止**把 L2 帧的字节相等写成断言（O7：Yjs clientID 随机性使连单体自身两次运行都不等，非拓扑归因）；AUTH-C5(a) 把这一语料属性作为负控冻结。
- `SYNC_STEP1`（携带 hub 状态向量，内嵌 clientID）**不入 L1**——探针头注已登记该排除；本设计把探针的「数据帧黑名单」判定改为**枚举白名单**（L1/L2 各自枚举，其余自动落 L3），对契约全部语料行为等价且对新出现的 kind 保守偏安全（不会误入字节层）。SA2 §12-N6 已独立验证该等价性（白名单对全部契约语料与黑名单逐字节同判；SYNC_STEP1/UPDATE_ACK/BOOTSTRAP_ACK/SYNC_APPLIED 从不出现在 parity 语料）。
- 观测面（observer 事件集）**不入 parity**（H8；协议 §23.1 形态差异为文档化差异）；assembly 计数口径差异（协议 §17 L582）同理不纳入断言。
- 硬门定义必须原文写进 `ws-replication-issue424-auth-parity.test.ts` 头注（契约 §12.1「必须写进测试注释」）。

### 7.3 SD-2 裁决：早到 OPEN / 宿主登记时序 → **(a) 单点登记权威为主 + (b) 响亮收口冻结为退化路径**

**裁决（a）——harness 装配纪律**：`ShardedHost`/facade 是唯一的 `connectionKey → 连接（egress）` 登记权威：

1. 登记点唯一：`factory.accept/acceptTrusted` 返回连接后**第一动作**即写入登记表（探针 `store()` 模式，probe L542-547）；`resolveSessionSink` 只从该表取 egress，取不到即抛（无静默兜底）。
2. 时序确定性论证（源码锚点）：`acceptTrusted` 为单同步段（`hub-edge-host.ts:872-899`，`allocate` 前零 await）；早到帧在构造尾部**同步**重放（`hub-edge.ts:230-232`）；而 `resolveSessionSink` 只在 authorize→`openAdmission` **异步链**结算后触发（`hub-edge-host.ts:402-448`，≥2 个微任务跳：authorize 恒经 `Promise.resolve(...).then`（`hub-edge.ts:399`）+ `settleAdmission` 的 `await openAdmission` 续体）。因此「登记（allocation 后 ≤1 跳且微任务队列序在前）恒先于 resolveSessionSink（≥2 跳）」是微任务深度的结构事实，不依赖运气；实证 = 探针 O8 绿 ×3 次重复逐行一致。
3. 防"修复性漂移"：不引入 resolver 侧等待/缓冲/重试（那会制造 harness 私有准入管线，违反决策 3 的职责归属）。
4. 路径细分登记（SA2 §7-SC2/N7）：no-sink 终态后的重 OPEN 走**缓存 grant 重解析**且 resolver 为 **0 跳同步调用**（`hub-edge-host.ts:345,396-398`）——该路径仅在首个 OPEN 已发生后可达，而首 OPEN 已固定登记状态，故不破坏 (a) 的登记不变量；此说明写入夹具头注（§8.1 尾）。

**裁决（b）——退化路径处置冻结**：登记缺失（如对端抢发 HELLO+OPEN 且宿主登记竞态失败）的失败语义已实测为响亮收口：连接级 `ERROR(INTERNAL_ERROR)` + `transport.close(1011,'protocol-error')` + 零会话（O10；生产依据 `hub-edge-host.ts:440-450`「sink 解析失败响亮连接收口」= CONTEXT.md L226 Edge 规范职责）。本设计将其**冻结在测试文档层**：

- 夹具头注登记该退化路径与正常路径的分界（登记权威 + 微任务深度论证 + 上条 0 跳细分）；
- `ws-replication-issue424-lifecycle.test.ts` 增设一条**设计追加的负控**（标记 `SD-2(b) degenerate`，超出契约 §12.0 最小清单、不削弱任何契约条目）：故意不登记 → 断言 `HELLO_ACK`×1、连接级 `ERROR(INTERNAL_ERROR)`（namespaceId 缺席）×1、`close` code 1011、零会话建立。价值 = 防止未来有人把该路径"修"成静默 fallback（那将违反 ADR 0032 决策 3），并把 SA8「(b) 限测试文档冻结」的裁决落成可执行事实。
- 边界遵守：不把早到 OPEN 收口或宿主登记义务写入 `docs/**`（DENY；SA8 §6-3——如需规范化须新票扩 ALLOW）。

**备选（否决）**：预登记可预测键（`${instanceId}-conn-${n}`）作为主机制——键虽可预测，但 egress 对象在连接返回前不存在，"预登记"仍需占位/回填机制，等价于在 harness 内引入第二套登记状态；单点登记权威 + 微任务深度论证更简单且已被探针验证。协议合规 peer 的 OPEN 恒在 `HELLO_ACK` 之后，正常回合路径不触该退化面。

### 7.4 SD-3 裁决：connectionKey 工厂实例计数器撞键 → **每场景一工厂（harness 侧约定，零生产改动）**

- **裁决**：harness 约定「**每个 `ShardedHost`/facade 场景实例恰一个 edge 工厂**」：夹具内部构造工厂（不作为参数外注），`instanceId` 钉死 `HUB_INSTANCE`（harness 常量；与 boot 传入值同源同值——HELLO 绑定 `expectedHubInstanceId = HUB_INSTANCE`，语料字节前提）；同场景的第二条连接复用同一工厂（键后缀 `-conn-0/-conn-1` 天然互异）；跨场景各自建工厂且各自建 SessionHost/Registry（worker 随场景创建），键空间不交叉。
- **不得**用「每工厂换 instanceId」规避：parity 语料要求 wire 上 `expectedHubInstanceId = HUB_INSTANCE`，换 id 会改脚本字节、破坏同源语料前提。
- **误用守卫**：若宿主真把两个工厂的连接路由进同一 `HubSessionHost` 且同 ns，`open()` 的重复键检查响亮 throw（`hub-session-host.ts:247-253`）——无静默别名，测试直接红。
- **边界**：不改生产键格式、不加工厂选项（那属公共面 append-only 演进，ADR 0032 L66，须新票重过 SA8）；是否把该约定写入宿主指引文档 = follow-up（`docs/**` 现为 DENY）。

### 7.5 SD-4 裁决：ROUND-C4 协商形态深度 → **最小读法（回合完整 + 协商位可见）**

- **裁决**：协商形态（`chunkedUpdate: true`）只断言：① ROUND-C1~C3 全回合在协商形态下逐条复跑成立（OPEN_OK/BOOTSTRAP/SYNC/收敛/双向 live/CLOSE_OK/settled）；② `HELLO_ACK.selectedCapabilities & CAP_CHUNKED_UPDATE ≠ 0`；③ 会话描述子 `selectedCapabilities` 携带该位（NC4 断言原样保留，SA8 §3 SD-4 行明示不得删）。
- **理由**：分块 conformance（超限 UPDATE → `UPDATE_CHUNK` 端到端、全字段 golden、未协商 fatal 等）的资产锚已由协议 §22 登记到既有套件（#243 codec golden / #246 interop / #300 chunked sync / #301 completeness）——深读法只会重复冻结既有资产且扩大本票断言面；本票的等价性主张只需要「协商形态不破坏回合完整性 + 协商位真实可见」。
- **备选（否决）**：深读法（含超限 UPDATE 端到端分块）——不违约但重复冻结，且把 ADR 0013/0022 的验收面拉进 ADR 0032 的等价性票，混淆验收主张。

### 7.6 SD 裁决与 SA8 边界核对表

| SD | 本设计裁决 | SA8 允许的分支 | 越界项 |
|---|---|---|---|
| SD-1 | 停手报 SA8/设计；登记触发条件与上报路径；ROUND 红灯先核装配前提再分类（§7.1） | 「停手报 SA8」为冲突报告 §3 SD-1 行认可立场 | 无（未采「就地修」） |
| SD-2 | (a) 单点登记权威 + 微任务深度论证；(b) 冻结为退化路径（夹具头注 + 一条负控测试） | (a) no-conflict；(b) implements-existing-decision，限测试文档冻结 | 无（未写入 docs/**；未把 (b) 当正常路径） |
| SD-3 | 每场景一工厂；instanceId 钉死 HUB_INSTANCE；零生产改动；误用守卫靠既有响亮拒绝 | 处置必须留 harness 侧；生产侧改键/加工厂选项 = 新票 | 无 |
| SD-4 | 最小读法；NC4/ROUND-C4 协商位断言保留 | 两读法均不违约；择一并记录理由 | 无 |

### 7.7 语料与身份确定性（D-C）

- **同源字节脚本**：两形态共用同一 `Uint8Array` 脚本（HELLO#1 固定 16 字节 nonce → OPEN#2 → 重 OPEN#3；`encodeMessage(message, {sequence})` 一次构造、两形态重放），保证「同输入」前提逐字节成立。
- **namespace 身份确定性**：worker registry 用 seeded `randomBytes`（探针 `seededRandomBytes` 纪律：只接受 128-bit 请求）——同 seed 两次建 registry 产出同 namespaceId（探针 O1 断言验证）。单体侧 registry 与分片侧各建一次、seed 相同 → 同 ns 身份 → 脚本字节可完全一致。
- **Yjs clientID**：不控制（O7 已证其为 L1 排除的充分理由）；hub/peer 文档收敛断言用 `encodeStateAsUpdate` 字节相等（同一文档实例克隆路径，`snapshotDoc`），clientID 一致成立。
- **时间**：全虚拟——worker scheduler = `createRegistryTestScheduler`；edge/session timer = 注入假 timer（`setTimeout/clearTimeout` 记账不触发）或测试 scheduler；驱动只 `settle()/settleUntil()`（有界微任务轮转）+ 显式时间推进。**推进面精确化（SA2 N5）**：`driver.advanceMs(run, ms)` 只推进 `run.peerNode.scheduler`（`driver.ts:618-621`）——boot 形态（ROUND 套件）的 hub 侧 scheduler 即 `run.hubNode.scheduler`（= 被采纳 timer），其 `pending()` 断言直接调 `run.hubNode.scheduler.pending()`（O8 同款）；pipe 形态（lifecycle 套件）的 worker 侧推进直接调 `ShardedWorker.scheduler.advanceBy(ms)`（`ShardedWorker.scheduler` 已暴露），不借道 `advanceMs`。**禁**真实 `setTimeout`/sleep/网络/文件 IO。

### 7.8 套件不含变异开关（D-D）

探针红臂（`SA6_PROBE_MUTATION`）是 SA6 的敏感性证据，**不进入交付套件**——交付断言固定观察行为；契约 §12.7 的敏感性义务由负控（NC1–NC4 + AUTH-C5）与保留的探针/日志（`wiki/raw/task_issue-424_sa6_capability_probe.mts` + `artifacts/sa6-issue424-mutation-sensitivity.log`）承载。交付套件零 env 读取、零条件跳过。

---

## 8. 接口、状态机和数据流

### 8.1 夹具文件 `packages/ws-replication/test/issue424-sharded-hub.ts`（test-only，非 `.test.ts` → 不入 runner 面，入包 typecheck）

```ts
// —— 载入面：公共入口 + 测试基建（零深路径 import 生产模块；被测对象恒为真身）——
import {
  createHubReplication, createHubReplicationEdge, createHubSessionHost,
  DEFAULT_REPLICATION_LIMITS, DEFAULT_REPLICATION_TIMEOUTS,   // 公共冻结常量（index.ts:22-26）
} from '@nomicore/ws-replication';
import { createNamespaceRegistryForTesting } from '@nomicore/namespace-registry/testing';
import { encodeMessage, decodeMessage, CAP_CHUNKED_UPDATE } from '@nomicore/replication-protocol';
import { StubPersistence, HUB_INSTANCE, PEER_INSTANCE, HUB_OWNER, settle, settleUntil,
         makeHubNamespace, FIXED_MS } from './harness.js';
// （yjs 经 'yjs' 包入口——vitest alias 与包 node_modules 同源，无双实例问题；探针的 URL import 仅为
//   wiki/raw 运行所需，套件内不必要。）
//
// —— 限值/超时纪律（SA2 N2）：两半边同一组冻结值 ——
// LIMITS  = DEFAULT_REPLICATION_LIMITS；TIMEOUTS = DEFAULT_REPLICATION_TIMEOUTS
// （ResolvedLimits/ResolvedTimeouts 为空扩展（types.ts:1009-1010），常量可直接赋；
//   harness CONTRACT_LIMITS 是本地旧形接口（harness.ts:43-57），缺 5 个分块纪元字段，
//   不可赋 ResolvedLimits —— 禁用。edge 工厂侧不传 limits/timeouts（工厂内 resolve 缺省
//   = 同一组 DEFAULT 值，defaults.ts:61-69），session host 侧直接赋常量 —— 两半边恒一致，
//   与 #420 shim「resolve 单点 + 两半边同值」纪律同构，但不深路径 import。）

// —— worker 分片（pipe 形态：自建 registry —— 多 worker 路由/隔离的载体）——
export interface ShardedWorker {
  readonly index: number;
  readonly registry: NamespaceRegistry;            // 真 Registry（testing seam；worker 自有）
  readonly scheduler: ReturnType<typeof createRegistryTestScheduler>;
  readonly persistence: StubPersistence;
  readonly host: HubSessionHost;                    // 公共工厂真身（LIMITS/TIMEOUTS/instanceId=HUB_INSTANCE）
  readonly namespaceId: string;                     // seeded → 同 seed 同 id
}
export async function makeShardedWorker(index: number, opts: {
  readonly seed: number;                            // randomBytes 种子（namespace 身份确定性）
  readonly rootN: number;                           // 建档 ROOT.n（多 worker 语料差异化）
}): Promise<ShardedWorker>;

// —— 可路由最小面（桥对 worker 只消费这两成员；ShardedWorker/AdoptedWorker 均结构满足）——
export interface RoutableWorker {
  readonly index: number;
  readonly host: HubSessionHost;
}

// —— boot 采纳 worker（boot 形态：会话宿主建于 boot registry/timer 之上 —— O8 已验证装配）——
export interface AdoptedWorker {
  readonly index: number;                           // 恒 0（boot 形态单 worker）
  readonly registry: NamespaceRegistry;             // === options.registry === run.hubNode.registry（同一对象）
  readonly host: HubSessionHost;                    // createHubSessionHost({registry, instanceId: HUB_INSTANCE, LIMITS, TIMEOUTS, timer})
}

// —— 会话/解析探针（SA6 §12.0「探针面」）——
export interface ShardedSessionRecord {
  readonly namespaceId: string; readonly workerIndex: number;
  closeCalls: number; terminateCalls: number;
}
export interface ShardedOpenRecord {
  readonly connectionKey: string; readonly namespaceId: string;
  readonly workerIndex: number; readonly selectedCapabilities: number;
  readonly remoteInstanceId: string;
}
export interface ShardedProbes {
  readonly sessions: readonly ShardedSessionRecord[];
  readonly opens: readonly ShardedOpenRecord[];     // open() 描述子镜像（纯 JSON）
  readonly signals: readonly string[];              // `${type}:${namespaceId|code}`
  readonly resolves: readonly string[];             // `ns:w${index}`
  readonly sinkReturns: readonly number[];          // onFrame 回传的被分配 wire 序
}

// —— 分片宿主（ingress + 桥；SD-3：恰一个工厂，夹具内部构造，instanceId 钉死 HUB_INSTANCE）——
export interface ShardedHost {
  readonly factory: HubReplicationEdgeFactory;       // 公共工厂真身
  readonly connections: ReadonlyMap<string, HubReplicationEdgeConnection>; // SD-2(a) 登记权威
  readonly probes: ShardedProbes;
  acceptTrusted(transport: DuplexTransport, identity: { peerInstanceId: string }):
    Promise<HubReplicationEdgeConnection | undefined>;   // 登记权威封装（返回即登记）
}
export function makeShardedHost(
  route: (namespaceId: string) => RoutableWorker,    // 宿主分派决策（hash/映射的测试替身）
  config: {
    readonly authorize: NamespaceAuthorizer;          // 桩只在此侧（缝另一侧）
    readonly verifyToken?: PeerTokenVerifier;
    readonly timer: ReplicationTimer;                 // 注入假 timer/scheduler
  },
): ShardedHost;

// —— HubReplication facade（供 boot({ createHub }) 注入；adopt 形态——F-R1 修订）——
// registry 必填：boot 恒传 hubNode.registry（driver.ts:518），facade 结构性采纳之——
// 在 facade 内建恰一个 AdoptedWorker（会话宿主建于 options.registry/options.timer 之上）
// 并把全部 resolveSessionSink 路由到它。boot 形态约束由此不可被丢弃（§8.3）。
export interface ShardedFacadeOptions {
  readonly registry: NamespaceRegistry;              // 必填（≡ run.hubNode.registry）
  readonly authorize: NamespaceAuthorizer;
  readonly verifyToken?: PeerTokenVerifier;          // boot 的 wrappedVerifier 透传（driver.ts:512-521）
  readonly timer: ReplicationTimer;                  // boot 传入 hubNode.scheduler
}
export function makeShardedReplicationFacade(options: ShardedFacadeOptions): {
  readonly replication: HubReplication;              // boot({createHub}) 返回值
  readonly host: ShardedHost;                        // probes/signals/登记权威（同一路由）
  readonly worker: AdoptedWorker;                    // registry === options.registry（§12.2 前提断言用）
};

// —— 内存管道（记录出站 + 可注入入站；微任务投递）——
export interface RecordingPipe {
  readonly hubTransport: DuplexTransport;
  sendInbound(bytes: Uint8Array): void;
  frames(): readonly Uint8Array[];                   // 出站原字节（断言面）
  hubCloseInfo(): Readonly<{ code: number; reason: string }> | undefined;
}
export function makeRecordingPipe(): RecordingPipe;

// —— 语料构造 + 判据助手（三层硬门 §7.2 的实现）——
export function helloFrame(sequence: number, optionalCapabilities?: number): Uint8Array;
export function openFrame(namespaceId: string, sequence: number): Uint8Array;
export function closeNsFrame(namespaceId: string, sequence: number): Uint8Array;
export function rawSequence(bytes: Uint8Array): number;        // [8..12] BE
export function decodeAll(frames): Array<{ kind; code?; namespaceId?; sequence }>;
export function controlFramesOf(frames): Uint8Array[];         // L1 白名单 {HELLO_ACK,OPEN_OK,ERROR,CLOSE_OK,GOAWAY}
export function dataFramesOf(frames): Uint8Array[];            // L2 白名单 {BOOTSTRAP_SNAPSHOT,UPDATE,UPDATE_CHUNK,SYNC_STEP2}
export function skeletonOf(frames): string;                    // L3 kind(code)#seq
export function docStateOf(frames): string;                    // Y.applyUpdate 后 ROOT/META JSON
export function framesHexEqual(a, b): string | undefined;      // 逐帧 hex 全等（undefined = 等）

// —— 两形态轨迹驱动（parity 语料共用；pipe 形态，不经 boot）——
export interface TraceOptions { readonly revoke?: readonly string[]; readonly closeAtEnd?: boolean;
  readonly reauthClose?: Readonly<{ namespaceId: string; sequence: number }> }
export interface Trace { readonly frames; readonly state; readonly authorizeCalls; readonly sessions;
  readonly opens; readonly signals; readonly hubClose }
export async function runMonolithTrace(form: 'pass'|'deny'|'throw', registry: NamespaceRegistry,
  script: readonly Uint8Array[], options?: TraceOptions): Promise<Trace>;   // createHubReplication + acceptTrusted + hub.revoke
export async function runShardTrace(form: 'pass'|'deny'|'throw', workers: readonly ShardedWorker[],
  script: readonly Uint8Array[], options?: TraceOptions): Promise<Trace>;   // makeShardedHost + acceptTrusted（登记权威）
export function parityOf(mono: Trace, shard: Trace): { ok: boolean; detail: string }; // L1∧L2∧L3
```

**迭代 1 签名变更说明（F-R1）**：

1. `makeShardedReplicationFacade` 由「`(options 无 registry, route)` 路由形态」改为「`(options 含必填 registry)` adopt 形态」：facade 在内部构造恰一个 `AdoptedWorker`（其 `host` 建于 `options.registry`/`options.timer` 之上）并把全部 `resolveSessionSink` 调用路由到它（内部经 `makeShardedHost(() => worker, config)`——桥/登记/探针代码路径与 pipe 形态完全共享，仅 worker 归属不同）。
2. 迭代 0 的路由形态 facade（`route` 指向预建自建 registry worker）**删除**：其在设计内零消费方（pipe 套件经 `makeShardedHost` 直驱；facade 的唯一消费面就是 `boot({createHub})` 注入缝），且正是 F-R1 的载体——保留它意味着「facade 丢弃 boot registry、路由到自建 registry worker」的错位装配仍然可表达。删除后该错位装配**不可表达**（比运行时守卫更强的关闭方式）。
3. `makeShardedHost` 的 route 返回类型放宽为最小结构面 `RoutableWorker`（桥只消费 `index`/`host`，§8.2）：`ShardedWorker`（pipe 形态）与 `AdoptedWorker`（boot 形态）均结构满足；签名其余不变。
4. 若未来出现「boot 形态 + 多会话宿主」需求（多 host 仍须共享同一被采纳 registry，见 §8.3 约束），须扩夹具（新路由参数）——本票无此场景，列为 follow-up（§13）。

夹具头注必须登记（同 #420 夹具纪律，SA6 §10 下游消费者行为）：**非规范宿主样例**——真宿主（nomic-server ingress/worker）的传输、登记与生命周期由宿主自定；本夹具只证明公共面足以装配出语义等价的分片形态；SD-2 退化路径与 SD-3 单工厂约定的分界（§7.3/§7.4，含 no-sink 重 OPEN 的 0 跳 resolver 细分说明，§7.3-4）；**boot 形态 registry 同一性约束**（§8.3——采纳 registry 是 hub 侧观察面成立的前提）。

### 8.2 宿主桥投影表（`HubNamespaceSessionSink` ↔ `HubSessionHandle`；决策 2/A1 的公共面兑现，探针已验证）

| 缝方向 | 生产接口成员 | 桥实现 | 备注 |
|---|---|---|---|
| edge→session（首 OPEN） | `sink.openNamespace(message)` | `handle.handleFrame(encodeMessage(message, { sequence: 0 }))` | OPEN 投递不带 wire 序（缝契约；`hub-edge-host.ts:87-89`） |
| edge→session（非 OPEN） | `sink.namespaceFrame(message, sequence)` | `handle.handleFrame(encodeMessage(message, { sequence }))` | 顺序保真；序列已由 edge 校验，session 不复检 |
| edge→session（revoke） | `sink.terminateUnauthorized()` | `handle.terminateUnauthorized()`（幂等；计数探针包裹） | reject 由 edge 适配器归一（生产纪律） |
| edge→session（收口） | `sink.onConnectionClosed()` | `handle.close()`（幂等同 promise；计数探针包裹） | reject 归一吞没（生产纪律） |
| session→edge（出站控制帧） | `handle.onFrame((frame, 'control') => n)` | `connection.egress.sendControlFrame(frame)` 原样回传返回值 | 返回值 = 被分配 wire 序（A1 承重面，零改写） |
| session→edge（出站数据帧） | `handle.onFrame((frame, 'data') => n)` | `connection.egress.sendDataFrame(frame)` 原样回传 | 同上；0 = 被拒（`resync-required` 判据） |
| session→edge（settled） | `handle.onSignal({type:'settled', namespaceId})` | `connection.egress.namespaceSettled(namespaceId)` | drain 提前完成的判据输入 |
| session→edge（connection-fatal） | `handle.onSignal({type:'connection-fatal', code})` | `connection.egress.connectionFatal(code)` | code→WS close 映射单点留 edge |
| edge→session（会话开启） | `resolveSessionSink(connectionKey, ns, grant)` | 查登记权威（SD-2(a)）→ `route(ns)`（返回 `RoutableWorker`）→ `worker.host.open({ connectionKey, remoteInstanceId: connection.authenticatedInstanceId, namespaceId, authorization: grant, selectedCapabilities: connection.egress.chunkedUpdateNegotiated() ? CAP_CHUNKED_UPDATE : 0, connectionId: connectionKey })` → 返回四成员 sink | 描述子纯 JSON；`selectedCapabilities` 唯一事实源 = edge 协商位；记录 opens/resolves/sessions 探针 |

桥的**非目标**（纪律）：不合成任何应答帧、不选错误码、不缓冲/重排/重试、不复制准入管线、不感知 drain 窗口——这些全是 edge/session 半边与宿主传输的既有职责（ADR 0032 决策 2/3；CONTEXT.md L226/L230 Avoid 项）。

### 8.3 facade（`HubReplication` 面；`boot({ createHub })` 消费）与 **boot 形态 registry 同一性约束**

#### 8.3.1 boot 形态 registry 同一性约束（F-R1 落实；O8 已验证装配 = 唯一 green 形态）

> **约束**：boot 形态下，服务 ROUND namespace 的会话宿主必须建于 `options.registry`（≡ `run.hubNode.registry`，同一对象）与 `options.timer` 之上。任何把该 ns 路由到「自建 registry 的预建 worker」的装配都会割裂文档同一性，使 ROUND-C1/C2 的 hub 侧断言必然红。

**依据链（源码锚点）**：

1. `boot` 的 hub 侧观察面**全部**硬绑定 boot 内部 `hubNode`：`writeHub` 经 `hubFixture.lease`（fixture 由 `makeHubNamespace(hubNode, …)` 建于 `hubNode.registry`，`driver.ts:498-505`；写路径 `driver.ts:409-417`）；`snapshotDoc('hub')`/`rootValue`/`metaValue`/`doc('hub')` 经 `hubNode.persistence.peek`（`driver.ts:419-425`）；`bumpHubEpoch` 经 fixture lease（`driver.ts:463-470`）；hub 侧 scheduler = `run.hubNode.scheduler`（`driver.ts:217` 公有只读）。
2. `boot` 恒把 `{instanceId, registry: hubNode.registry, authorize, timer: hubNode.scheduler, verifyToken(wrapped), …}` 交给 `createHub` 注入缝（`driver.ts:516-526`；wrappedVerifier `driver.ts:512-521`；dial = `hub.accept(wire.hubEnd, {token})` `driver.ts:535`）。
3. 因此 hub fixture 文档（`hubFixture.lease` 所在）与复制会话驱动的文档**同源，当且仅当**会话宿主的 `registry` 就是 `hubNode.registry`：`writeHub` 的 fixture-lease 写经同一 Registry 的复制会话订阅出站为 hub→peer UPDATE；`snapshotDoc('hub')` peek 到的正是该会话驱动的 live doc。反之（F-R1 错位装配）：复制会话驱动 worker 自建 registry 的文档，`run.writeHub` 写 boot registry、`snapshotDoc('hub')` 观察 boot registry——两侧文档永不同源，ROUND-C1 收敛断言（hub/peer `encodeStateAsUpdate` 相等）与 ROUND-C2 hub→peer UPDATE 断言无条件红，且红灯形似「生产偏差」，会误触 SD-1 停手协议（SA2 E7）。
4. 该约束的运行期实证 = 探针 O8（唯一 green 的 boot 装配，probe L971-1003：worker 会话宿主建于 `options.registry`/`options.timer`，L979-984），绿 ×3 次重复逐行一致。

**结构性落实**：facade adopt 模式把约束做进签名——`registry` 必填、facade 内建恰一个 `AdoptedWorker` 于其上、无 route 参数（错位装配不可表达，§8.1 变更说明 2）。**可观察兜底**：ROUND 套件每形态 boot 后执行引用同一性前提断言（§12.2），装配错位在场景前置即红（信息指向装配而非生产）。

#### 8.3.2 adopt 形态构造序（facade 内部；全部进程内直调，零新传输）

1. `makeShardedReplicationFacade(options)` 进入即建 `AdoptedWorker`：`createHubSessionHost({ registry: options.registry, instanceId: HUB_INSTANCE, limits: LIMITS, timeouts: TIMEOUTS, timer: options.timer })`（LIMITS/TIMEOUTS = 公共 DEFAULT 常量，§8.1 纪律；`hub-session-host.ts:44-52` 要求全量 resolved 形）。
2. `makeShardedHost(() => worker, { authorize: options.authorize, verifyToken: options.verifyToken, timer: options.timer })`——桥/登记权威/探针与 pipe 形态共享同一路径（§8.2）；工厂为夹具内部构造（SD-3），`instanceId = HUB_INSTANCE`。
3. facade 包 `accept`/`acceptTrusted`（登记权威写入 = 返回后第一动作，SD-2(a)）与 `HubReplication` 服务面（下表）。
4. 测试侧消费形态（ROUND 套件；与探针 O8 的闭包捕获同构）：

```ts
let sharded: ReturnType<typeof makeShardedReplicationFacade> | undefined;
const run = await boot({
  createHub: (options) => {
    sharded = makeShardedReplicationFacade(options);   // registry 必填 → 结构性采纳
    return sharded.replication;
  },
});
// 场景前置断言（§12.2）：sharded.worker.registry === run.hubNode.registry（同一对象）
```

#### 8.3.3 facade 成员表（`HubReplication` 面；`types.ts:161-180`）

| 成员 | 实现 | 锚点 |
|---|---|---|
| `accept(transport, {token})` | `factory.accept(transport, request)` → 成功即写入登记权威 → 返回连接 | driver `dial()` 调用形态（`driver.ts:531-537`） |
| `acceptTrusted(transport, identity)` | 同上（`factory.acceptTrusted`） | `HubReplication.acceptTrusted?` 可选面 |
| `connections` | 登记权威的快照数组 | `types.ts:172` |
| `revoke(instanceIdentity, nsId)` | 遍历登记表，对 `authenticatedInstanceId === instanceIdentity` 的连接逐个 `revokeNamespace(nsId)`，`Promise.all` 归一 | 单体 `revoke` 语义镜像（REVOKE-C1 的单体侧对照经 `runMonolithTrace` 的 `hub.revoke`） |
| `requestReauth(instanceIdentity)` | 同过滤 → `beginReauth()` | `types.ts:178` |
| `close()` | 幂等 tail：全部连接 `close(1001,'hub-shutdown')` + `settle()` 汇流 | §21/TERM-C2 |

### 8.4 数据流路线

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| R1 入站握手 | 脚本/peer 发 `HELLO` 字节 | — | `pipe.sendInbound` →（微任务）→ transport listener → 公共 edge `onMessage` 全解码/协商 | 内存管道 | edge 产出 `HELLO_ACK`（mux 盖章#1）→ `pipe.frames()` | HELLO_ACK 字节 + `[8..12]=1` | HELLO 违例 → 既有 edge fatal 纪律（本票不触发） | AUTH-C1、SEQ-C1 |
| R2 授权 + 会话解析（跨缝·纯 JSON） | edge 收 `OPEN_NAMESPACE`（全解码） | edge 调 `authorize`（单点）→ 结算 ok-投影 → `resolveSessionSink(connectionKey, ns, grant)` | 跨缝下行：描述子纯 JSON；桥查登记权威 → route（pipe 形态 `ShardedWorker`/boot 形态 `AdoptedWorker`）→ `worker.host.open()` 创建会话句柄 | worker 进程内会话表（`hub-session-host.ts:239-257`） | probes.opens/sessions；`connection.namespaces` | 恰一次 authorize、denied/throw **零** resolveSessionSink 调用、分片零会话 | 登记缺失/解析 throw → 连接级 INTERNAL_ERROR + 1011（生产收口，O10 镜像负控） | AUTH-C2/C3/C4、SHARD-C1 |
| R3 入站 ns 域帧（跨缝·字节） | edge 定偏移路由 | edge 台账命中 → `sink.openNamespace/namespaceFrame` | 桥 `encodeMessage(msg, {seq})` 重组 → `handle.handleFrame(bytes)`（session 不复检序） | 真 Registry/Runtime（ReplicationSession 驱动；boot 形态 = `options.registry`） | 通道 FSM；registry 持久化（StubPersistence） | BOOTSTRAP/UPDATE 应用、ROOT/META 变化 | 解码失败 → `connection-fatal`（R5）；无 sink → 合成 `NAMESPACE_STATE_VIOLATION`（SHARD-C3） | ROUND-C1/C2、SHARD-C3 |
| R4 出站 ns 域帧（跨缝·字节 + 盖章） | session FSM 出帧（`sequence=0` 占位） | `handle.onFrame(frame, lane)` | 桥透传 → `egress.sendControlFrame/sendDataFrame` → edge `OutboundQueue` mux 单点重写 `[8..12]`（per-connection 1..N） | `transport.send` → 管道 | `pipe.frames()` / `run.wire.hubToPeer` 原字节；`sinkReturns` 探针 | 盖章序严格递增；回传序供 session 记账（0 = 被拒） | 回传序缺失 → bootstrap/live 记账失据（红臂 `no-sequence-return`→O8 已证敏感） | SEQ-C1、ROUND-C2、AUTH-C1 |
| R5 session→edge 信号（跨缝·纯 JSON） | 通道终态 / 通道级致命 | `handle.onSignal` | 桥映射（§8.2）：`settled` → `namespaceSettled`；`connection-fatal{code}` → `connectionFatal` | edge 内部 drain/收口状态 | `probes.signals`；`hubCloseInfo()` | settled 恰一次/ns；drain 提前完成 `close(1001)`；fatal → close(映射码) | deadline 未 fire（假 scheduler 零推进判据） | ROUND-C3、REAUTH-C1、TERM-C1 |
| R6 edge→session 控制信号 | `connection.close()` / `revokeNamespace(ns)` | edge 适配器逐 established sink 投影 | 桥 `onConnectionClosed → handle.close()`；`terminateUnauthorized → handle.terminateUnauthorized()` | worker 会话清理（幂等 promise） | `probes.sessions.closeCalls/terminateCalls` | 全会话收口、close 幂等、revoke 恰一次 + ns ERROR 帧 | reject 归一（生产纪律）；未知 ns 无副作用 resolve | TERM-C1/C2/C3、REVOKE-C1/C3 |
| R7 facade 服务流（boot 形态；adopt 装配） | `dial()` → `facade.accept`；测试调 `revoke/requestReauth/close` | **facade 进入即建 `AdoptedWorker`（会话宿主于 `options.registry`/`options.timer`）**；`accept` 成功即写登记权威 | 进程内直调（零新传输）；route 恒指向被采纳 worker（§8.3.1 约束——hub 侧观察面成立的前提） | — | `run.*` 观察面（全绑 `run.hubNode`）+ `sharded.worker.registry === run.hubNode.registry`（前提断言） | peer 拨号被公共 edge 接纳；服务语义与单体 facade 同形 | accept 拒绝 → undefined（零分配）；装配错位在场景前置断言即红（不进回合断言） | ROUND-C1~C4 |
| R8 文档数据流（round 收敛；同一性前提 = §8.3.1） | peer 业务写（`run.writePeer`）/ hub fixture 写（`run.writeHub`） | peer doc / hub doc（真 Y.Doc；**hub doc = boot `hubNode.persistence` 中的 live doc，其与复制会话的同源由 adopt 装配保证**） | peer UPDATE →（R3）→ hub registry session apply → UPDATE_ACK 回指入站序；hub 写 → session 订阅 →（R4）UPDATE → peer apply | StubPersistence 两侧 | `run.snapshotDoc('hub'/'peer')`、`rootValue` | 双向 ROOT 更新、`encodeStateAsUpdate` 收敛相等、零 `resync-required` | ACK = 序列化 live apply + dirty 登记（非 flush/quorum，模块 AGENTS） | ROUND-C1/C2 |

无生产运行时数据路径变化（本票 test-only；以上路线全部为既有生产路径在新验收装配下的观察面）。事实源：wire 序唯一事实源 = edge mux 单点；会话事实源 = session 半边；连接登记事实源 = harness 登记权威（仅测试装配态）；boot 形态 hub 文档事实源 = boot `hubNode.registry`（adopt 装配使复制会话与之同源）。

### 8.5 状态机与生命周期（全部复用，零新状态机）

- 连接级（edge）：`handshaking → ready → draining → closed`（`beginReauth` 入 draining；drain 全 settled 提前完成或 deadline 1001）。
- 会话/通道级（session host）：OPEN 矩阵（opening/open 合流、每请求收答、closed/conflicted/failed 后 `NAMESPACE_REOPEN_REQUIRES_RECONNECT`）。
- 准入台账（edge）：`pending → denied | failed | established | no-sink`（`hub-edge-host.ts:196-238`）——harness 只经授权表与脚本驱动观察，不实现。

---

## 9. 错误、恢复、并发和幂等

- **失败语义全继承生产**：桥与套件零新增吞没点。sink 同步 throw → edge 适配器防御 catch → `connectionFatal('INTERNAL_ERROR', 1011)`（`hub-edge-host.ts:80-85,515,523`）；`onConnectionClosed`/`terminateUnauthorized` reject 由适配器归一；observer/信号监听 throw 隔离（`hub-session-host.ts:227-235`）。异常路径断言 = 明确失败类型 + 调用方可观察结果（wire 帧 + close code/reason + 会话计数）。
- **无静默 fallback**：路由无 worker（route 返回 undefined/throw）→ 登记缺失路径响亮收口或测试直接红；不设计「跳过该 ns」「换 worker 重试」等正常路径兜底。boot 形态的装配错位由签名（registry 必填 + 无 route）与前提断言双重关闭——错位不可表达，可表达即前置红（§8.3.1）。
- **幂等**：`handle.close()` 同 promise；`terminateUnauthorized` 幂等；`facade.close()` 幂等 tail；revoke 未知/已终态 ns → 无副作用 resolve（REVOKE-C3）；重 OPEN 经 openWaiters 合流、authorize 恰一次（AUTH-C4）。
- **并发**：runner `maxWorkers: 1` 串行；单测试内多连接经同一工厂分配（连接隔离：独立内部 edge 实例 + 独立出站计数，SEQ-C1/TERM-C3）；无真实并行面需要锁——断言面是确定性状态机 + 字节级（SA6 §7）。
- **时间纪律**（§7.7）：`settle()`/`settleUntil()` 有界轮转；时间推进显式且**按侧精确**——boot 形态 `driver.advanceMs(run, ms)` 只推进 peer 侧 scheduler（hub 侧断言直接用 `run.hubNode.scheduler`），pipe 形态直接 `ShardedWorker.scheduler.advanceBy(ms)`；REAUTH-C1 的「deadline 未 fire」判据 = 断言 close(1001) 发生在零 scheduler 推进下。
- **资源释放**（TERM-C2）：close 后各 worker `scheduler.pending()` 不增（boot 形态看 `run.hubNode.scheduler.pending()`，pipe 形态看各 `ShardedWorker.scheduler.pending()`）；`collectUnhandledRejections()` 空；close 后零新出站（推进 30s 后帧数不变——按上条推进对应侧）。

---

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| `packages/ws-replication/test/` 既有 455 文件 | 不感知 #424 | 不受影响（新文件独立命名空间；不共享可变全局态；`registerDeferPump` 等既有 seam 不触碰） | 零 | SA6 §4 基线全绿；vitest include 面新增不改旧面 |
| `test/harness.ts` / `test/driver.ts` / `test/issue420-shim-hub.ts` | 既有基建 | 仅被 import（零修改）；`boot({createHub})` 注入缝按既有契约消费（`driver.ts:196,516-526`） | 零 | DENY LIST §11 |
| `boot({ createHub })` 注入缝 | 消费 `HubReplication` 面 | facade 满足该面（accept/acceptTrusted?/connections/revoke/requestReauth/close）；**`options.registry`/`options.timer` 被结构性采纳为 worker 的 registry/timer（不再被丢弃——F-R1 修正）**；`verifyToken`（wrappedVerifier）透传给 `factory.accept`（boot dial = token 路径）；`instanceId`/`observer`/`clock`/`limits`/`timeouts` 不消费（钉死 `HUB_INSTANCE`、DEFAULT 限值、零 observer——套件无该面断言，H8） | 零（缝既有） | `driver.ts:196,489-537`；§8.3 |
| `@nomicore/ws-replication` 公共入口 | 冻结面 | 零变更（只消费：三工厂 + DEFAULT 两常量） | 零 | `src/index.ts`；ADR 0032 L64-66 |
| 生产运行时（listen/`listen:false`/edge/session host） | 既有行为 | 零改动、零行为变化 | 零 | GATE-C3 全 DENY 面零 diff（§12.6） |
| 新增：4 个 `.test.ts` | — | 消费夹具 + 契约断言 | 新文件 | §11/§12 |
| 下游消费者（nomic-server ingress/worker 宿主） | 无参照装配 | 获得可参照的**验收形态**宿主桥（非规范样例，头注登记边界；boot 形态采纳 registry 的约束一并登记——宿主若自建 hub 侧观察面须自知同源前提） | 无（宿主侧自理） | SA6 §10；#420 同款纪律 |

---

## 11. 文件范围

### ALLOW LIST（实现票新增/写入；全部 test-only + 流水线证据；与迭代 0 相同——F-R1 修订不扩范围）

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/ws-replication/test/issue424-sharded-hub.ts` | 新增（test-only 夹具） | T-1：worker 分片 + 宿主桥 + **adopt 形态 facade（§8.3）** + 探针面 + 语料/判据助手（§8.1/§8.2） |
| `packages/ws-replication/test/ws-replication-issue424-auth-parity.test.ts` | 新增 | AC1：AUTH-C1~C5（§12.1）；硬门定义头注（§7.2） |
| `packages/ws-replication/test/ws-replication-issue424-cross-seam-round.test.ts` | 新增 | AC2：ROUND-C1~C4（§12.2、SD-4；boot adopt 装配 + 前提断言） |
| `packages/ws-replication/test/ws-replication-issue424-multi-worker.test.ts` | 新增 | AC3：SHARD-C1~C3 + SEQ-C1（§12.3） |
| `packages/ws-replication/test/ws-replication-issue424-lifecycle.test.ts` | 新增 | AC4/AC5：TERM-C1~C3 + REVOKE-C1~C3 + REAUTH-C1~C2 + SD-2(b) 退化负控（§12.4/§12.5/§7.3） |
| `artifacts/issue424-*.log` | 新增（门禁/运行证据日志） | GATE-C1~C3 同轮证据（含全 DENY 面零 diff 证据，§12.6）+ 可能的 SD-1 偏差现场（§7.1） |
| `wiki/raw/task_issue-424_*.md` | 流水线产物（本设计、评审映射等） | 设计/评审/复审落位 |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/ws-replication/src/**` | 被测公共面/生产实现 | test-only 票（SA6 §12.0、SA8 §5 冻结面；公共面 append-only） |
| `packages/replication-protocol/**` | wire codec/注册表 | 协议冻结（协议 §5 append-only；本票只观察） |
| `packages/namespace-registry/**`（含 `src/testing.ts`） | 真 Registry/Runtime 来源 | 只消费 testing seam；改动会动摇全部既有套件 |
| `packages/ws-replication/test/` 既有全部文件（含 `harness.ts`、`driver.ts`、`issue420-shim-hub.ts`、455 个测试） | 共享基建/既有断言 | 不得修改既有断言以就范（SA6 §12.0 纪律）；夹具自足（含 DEFAULT 常量替代 CONTRACT_* 的选择——不改 harness） |
| `apps/**`、`domains/**` | 邻接面 | 与本票无交付关系 |
| `docs/**`（含 ADR 0032、协议 v1、CONTEXT.md） | 决策/规范权威 | 零决策文本变更（SA8 §6/§7）；SD-2(b)/SD-3 规范化如需 → 新票 |
| `vitest.config.ts`、`tsconfig*.json`、根/包 `package.json`、`pnpm-*` | runner/构建配置 | 发现规则已实测可发现新文件（SA6 §14）；零配置漂移 |
| `wiki/raw/task_issue-42{0,1,2,3}*`、`wiki/raw/*415*`、其余历史产物 | 前序票证据 | 只读上游输入 |
| `wiki/raw/task_issue-424_sa6_*`、`artifacts/sa6-issue424-*` | SA6 证据 | 保留件（敏感性/基线证据），不覆写 |

评审修订需要改变范围时显式更新本表并记录理由，不得静默扩大。**本轮（F-R1）零范围变化**：修订全部落在既有 ALLOW 文件的装配设计内。

---

## 12. 验收与验证映射

### 12.0 总表（契约条目 → 套件落点 → 预期观察）

| 契约组 | 文件 | 断言要点（判据引用） | 预期观察 |
|---|---|---|---|
| AUTH-C1（pass parity） | auth-parity | L1 控制帧 hex 逐帧相等（`HELLO_ACK#1`/`OPEN_OK#2`/`OPEN_OK#4`）；L3 骨架相等；L2 `BOOTSTRAP_SNAPSHOT#3` 文档语义相等；协议 §7.1 重开矩阵（每请求收答） | 绿；shard 侧 authorize 恰一次、会话恰一 |
| AUTH-C2（deny） | auth-parity | 全轨迹 hex 逐帧相等（`ERROR(NAMESPACE_UNAUTHORIZED)#2` + `ERROR(NAMESPACE_REOPEN_REQUIRES_RECONNECT)#3`）；分片零 session 建立（协议 §13.2 **L425**：UNAUTHORIZED→failed；ADR A2-β：denied 不过缝） | 绿；零 resolveSessionSink 调用 |
| AUTH-C3（throw） | auth-parity | 全轨迹 hex 逐帧相等（`ERROR(INTERNAL_ERROR)#2` + 重开拒答#3）；零 session；连接存活（协议 §13.1 L415：namespace 域 INTERNAL_ERROR 非连接 fatal） | 绿 |
| AUTH-C4（闩锁重 OPEN） | auth-parity | 恰一帧 `NAMESPACE_REOPEN_REQUIRES_RECONNECT` 逐字节等；authorize 恰一次（ADR 决策 3 合流条款） | 绿 |
| AUTH-C5（负控组） | auth-parity | (a) 单体 vs 单体独立文档：控制帧等、全轨迹**不等**（clientID 语料属性，O7/协议 §22）；(b) pass-单体 vs deny-分片：控制帧**不等**（非恒真）；(c) deny 分片零会话（NC3） | 绿 |
| **ROUND 装配前提**（F-R1 修订追加；设计追加断言，不削弱任何契约条目） | cross-seam-round | 每形态 boot 后：`sharded.worker.registry === run.hubNode.registry`（**引用同一性**；boot 形态约束 §8.3.1 的可执行形态） | 绿（装配错位在场景前置即红，错误信息指向装配而非生产——SD-1 前置甄别，§7.1） |
| ROUND-C1 | cross-seam-round | 真 peer 经 `boot({createHub: (options) => makeShardedReplicationFacade(options).replication})`（adopt 装配）：OPEN_OK×1、BOOTSTRAP_SNAPSHOT×1、peer BOOTSTRAP_ACK×1（`ackedSequence` 回指快照帧序）、SYNC_STEP1/2/APPLIED 各≥1、`getNamespaceState()==='live'`、hub/peer `encodeStateAsUpdate` 相等（收敛——hub doc 同源性由前提断言保证） | 绿 |
| ROUND-C2 | cross-seam-round | 双向 live：peer 写 → UPDATE×1 + UPDATE_ACK（回指入站序）+ hub ROOT 更新；hub 写（`run.writeHub` → fixture lease → boot registry）→ UPDATE×1 + peer ROOT 更新；零 `resync-required` | 绿 |
| ROUND-C3 | cross-seam-round | CLOSE_NAMESPACE×1 → CLOSE_OK×1（`ackedSequence` 回指，协议 §12 **L375**）+ `settled` 信号恰一次（经缝转发，probes.signals） | 绿 |
| ROUND-C4（两形态；SD-4 最小读法） | cross-seam-round | 非协商（缺省）与协商（`chunkedUpdate:true`）各复跑 C1~C3（各自独立 boot + 前提断言）；协商形态额外断言 `HELLO_ACK.selectedCapabilities & CAP_CHUNKED_UPDATE ≠ 0`（协议 §6.1 L137：`0x00000001`）∧ 描述子 `selectedCapabilities` 携带该位（NC4 断言不得删） | 绿 |
| SHARD-C1 | multi-worker | 1 连接 × 2 ns × 2 worker（pipe 形态）：`resolveSessionSink` 对 A/B 各恰一次（probes.resolves）；A 会话只在 w0、B 只在 w1（probes.opens/workerIndex）；描述子 `connectionKey` 相同 = 同一连接 | 绿 |
| SHARD-C2 | multi-worker | demux/mux：出站帧 namespaceId 覆盖 A/B；每 ns OPEN_OK 恰一；A/B 帧按协议序出现 | 绿 |
| SHARD-C3（负控） | multi-worker | 从未 OPEN 的第三 ns 帧 → 合成 `NAMESPACE_STATE_VIOLATION`、零会话、连接存活、不落任一 worker（ADR 决策 4；NC1） | 绿 |
| SEQ-C1 | multi-worker | 出站 `[8..12]` BE = 1..N 严格递增（无跳/重/回退）；每 ns 首帧出现序 = OPEN 注入序；per-ns 子序列 = 协议序；**第二连接 = 同一 `ShardedHost` 场景实例上第二次 `acceptTrusted`（同工厂双 pipe 双连接——构图要求，SA2 N4：探针 O6 实证形态为新工厂首连接，弱于本断言；机制上成立：每连接独立内部 edge + OutboundQueue，`hub-edge-host.ts:909-948`）**首帧序 = 1（per-connection，非全局计数） | 绿 |
| TERM-C1 | lifecycle | `connection.close()` → `state==='closed'`；两 worker 句柄 `closeCalls≥1`（经 `onConnectionClosed` 投影）；此后零新出站（worker scheduler 显式推进 30s 后帧数不变） | 绿 |
| TERM-C2 | lifecycle | 无泄漏：worker scheduler `pending()` 不增（pipe 形态逐 worker；boot 形态 = `run.hubNode.scheduler.pending()`）；`collectUnhandledRejections()` 空；`close()` 幂等（同 promise） | 绿 |
| TERM-C3（负控） | lifecycle | 同一 host 上两条连接各自持 ns；关闭其一 → 另一连接会话零 close、零新出站 | 绿 |
| REVOKE-C1 | lifecycle | `revokeNamespace(ns)` → terminate 恰一次；wire 出现 ns `ERROR(NAMESPACE_UNAUTHORIZED)`；**与单体 `revoke(instanceIdentity, ns)` 末帧逐字节相等**（L1 判据；单体侧经 `runMonolithTrace`/`createHubReplication` 的 `hub.revoke`） | 绿 |
| REVOKE-C2 | lifecycle | revoke B → A 的会话 `terminateCalls===0`、wire 零 A 的 ERROR 帧（跨 worker 零外溢） | 绿 |
| REVOKE-C3 | lifecycle | 未知/已终态 ns revoke → 无副作用 resolve；重复 revoke 恒 resolve | 绿 |
| REAUTH-C1 | lifecycle | `beginReauth()` → GOAWAY 恰一帧且 `drainTimeoutMs>0`；drain 窗口内 CLOSE_NAMESPACE → settled → drain 提前完成 `close(1001)`（协议 §6.3/§21 L684；判据 = 假 scheduler 零推进） | 绿 |
| REAUTH-C2（阴性对照） | lifecycle | 同脚本不发起 reauth → 连接不关闭（1001 归因于 drain 收口） | 绿 |
| SD-2(b) 退化负控（设计追加） | lifecycle | 不登记 connectionKey → `HELLO_ACK`×1 + 连接级 `ERROR(INTERNAL_ERROR)`（无 namespaceId）×1 + `close(1011,'protocol-error')` + 零会话（O10 镜像；ADR 决策 3「sink 失败响亮连接收口」；经 `host.factory` 直连 accept 构造） | 绿（响亮，非静默） |
| GATE-C1 | 全部 | `NODE_OPTIONS=--conditions=nomicore-source pnpm test`：455 文件/5559 测试基线 → 只增全绿 | exit 0；日志落 `artifacts/issue424-*.log` |
| GATE-C2 | — | 根 `pnpm typecheck` exit 0；`pnpm exec tsc -p packages/ws-replication/tsconfig.json` exit 0（新夹具+套件入 include） | exit 0 |
| GATE-C3 | — | 新旧套件同轮全绿；生产/规范面零 diff：`git diff --stat -- packages/ws-replication/src packages/replication-protocol/src` 为空 **且** `git status --short -- packages/replication-protocol packages/namespace-registry apps domains docs vitest.config.ts` 为空（全 DENY 面零触碰证据，SA2 N3） | 空 diff / 空状态 |

### 12.1–12.5 判据的规范引用（写进各测试注释；行锚按 SA8 设计复审 §8-2 精确化）

- OPEN 矩阵/重开：协议 §7.1 L176；错误终局：§13.2 L424/L425/L430/L442（REOPEN→closed = L424；UNAUTHORIZED→failed = **L425**）；连接错误/收口号：§13.1 L415、§14；序纪律：§3 L57、ADR 0010 L147；CLOSE_OK.ackedSequence：§12 **L375**；drain：§6.3 L159、§21 L684；conformance 三层：§22 L701；观测差异：§23.1 L838-845（不入 parity）；UPDATE_CHUNK 协商：§5 L114、§6.1 L137。

### 12.6 验证命令（实现票交付证据形态）

```bash
# 聚焦（迭代期）
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/ws-replication/test/ws-replication-issue424-*.test.ts
# 门禁（交付轮，GATE-C1~C3 同轮）
NODE_OPTIONS=--conditions=nomicore-source pnpm test
pnpm typecheck
pnpm exec tsc -p packages/ws-replication/tsconfig.json
# GATE-C3 双段证据（契约原命令 + 全 DENY 面零触碰补充，SA2 N3）
git diff --stat -- packages/ws-replication/src packages/replication-protocol/src        # 期望空
git status --short -- packages/replication-protocol packages/namespace-registry apps domains docs vitest.config.ts  # 期望空
```

---

## 13. 风险、回滚和残余问题

| 风险 | 等级 | 缓解 | 回滚 |
|---|---|---|---|
| SD-2(a) 的微任务深度论证是装配不变量而非类型不变量（未来生产改动可能改变跳数） | 中 | 单点登记权威 + O10 镜像负控（若竞态真发生 → 响亮收口测试红，绝不静默）+ 源码锚点登记（§7.3）；SA8 复审核对 | test-only：删 5 文件即回滚，无生产回滚面 |
| 硬门误扩到 Yjs 载荷帧（假红）或误缩（假绿） | 中 | §7.2 枚举白名单三层判据 + AUTH-C5(a) 负控 + NC4 双形态；SA8 §8-2 禁令写进头注；SA2 N6 独立佐证白名单等价性 | 同上 |
| observer/口径差异被误纳入 parity（假红） | 低 | H8 纪律：契约只锁 wire；§12 判据表显式排除 observer 集与 assembly 口径 | 同上 |
| 套件暴露真实生产偏差 | 低（O1–O9 全绿为前置证据） | SD-1 停手协议：不就地修、不软化断言；偏差现场 + 分类上报（§7.1）；ROUND 红灯先核装配前提断言再分类（防伪偏差，SA2 E7 关闭） | 不适用（停手而非回滚） |
| ~~boot 形态 ROUND 装配错位（F-R1/SA2 E7：hub 侧观察绑 boot registry 而夹具路由到自建 registry worker → 伪偏差/临场改夹具）~~ | ~~中~~ **已关闭（迭代 1）** | 三重关闭：facade 签名 registry 必填 + 无 route 参数（错位**不可表达**，§8.1/§8.3）；场景前置引用同一性断言（错位**前置即红**，§12.0）；约束正文明文 + 夹具头注登记（§8.3.1） | — |
| 多 worker 语料的 registry 身份/随机性不确定 | 低 | seeded randomBytes（同 seed 同 ns id，探针 O1 断言验证）；registry 测试 seam 受控 clock/scheduler | 同上 |
| vitest 与 tsx 探针的模块图差异（双 Yjs 实例等） | 低 | 套件走包入口 + vitest alias（与既有 455 文件同图）；探针的 URL import 不进入套件 | 同上 |
| 夹具限值/超时与生产 resolve 语义漂移（两半边配置分叉） | 低 | 两半边恒用同一组公共 `DEFAULT_REPLICATION_LIMITS/TIMEOUTS` 冻结值（§8.1 纪律；`CONTRACT_*` 旧形不可用已登记）；无覆盖面即无分叉面 | 同上 |
| 套件耗时回归（AC6 全量门禁） | 低 | 包内新套件预计 <10s（同 #420 回合量级，SA6 §7）；根全量 424s 基线内 | 同上 |

**任务内必要条件**（不可伪装为 follow-up）：G1–G4 的四套件 + 夹具交付（含 adopt 形态 facade 与 ROUND 装配前提断言）；GATE 同轮证据（含全 DENY 面零 diff）；负控保留（AUTH-C5/NC1–NC4/REAUTH-C2/TERM-C3/SD-2(b)/ROUND 装配前提）。

**明确的 follow-up（本票不做）**：

1. SD-2 早起 OPEN 收口/宿主登记义务的规范化（docs/**）与 SD-3 单工厂/键前缀约定的宿主指引——如需，新票扩 ALLOW 并重过 SA8（SA8 §6-2/§6-3）。
2. γ 真 worker（worker_threads/异步序回传）形态——ADR 0032 A2-γ 另票另裁。
3. SD-1 若触发：生产偏差修复票（按 §7.1 分类重过门禁）。
4. 确定性 clientID 注入（若未来要全轨迹逐字节硬门）——SA6 §15-4 登记的新票。
5. 「boot 形态 + 多会话宿主」夹具形态（多 host 共享同一被采纳 registry 的路由参数化）——本票无场景（ROUND 单 ns/单 worker 足证跨缝回合）；出现需求时扩夹具并保持 §8.3.1 约束不变。

---

## 14. 评审修订映射（迭代 1：`task_issue-424_sa2_review.md`）

评审 verdict = `reject`（1 MAJOR：F-R1）；无 BLOCKER。逐条落实如下（非阻断观察 N1–N7 一并处置；全部处置均为设计层修订，无范围扩大、无生产/公共面触碰）：

| Finding | 修订位置 | 处理结果 |
|---|---|---|
| **F-R1（MAJOR）**：boot 形态 ROUND 套件装配路径不闭合——迭代 0 §8.1 夹具把会话路由到预建 worker 自有 registry，而 boot 的 hub 侧观察面（`run.writeHub`/`run.snapshotDoc('hub')`/`run.rootValue('hub')`）硬绑定 boot 内部 `hubNode.registry`；按 §8.1 逐字实现将使 ROUND-C1~C4 无法绿（且伪偏差会误触 SD-1 或诱发临场改夹具） | §8.1（`ShardedFacadeOptions` 必填 `registry` + `AdoptedWorker` + `RoutableWorker` + 删除路由形态 facade 及理由）、§8.3（§8.3.1 **boot 形态 registry 同一性约束**全文：依据链四点 + 失败模式分析；§8.3.2 adopt 构造序 + 测试消费形态；§8.3.3 成员表）、§8.4 R2/R3/R7/R8（adopt 装配与同一性前提入数据流）、§10（boot 缝行：registry 结构性采纳，不再丢弃）、§12.0（新增「ROUND 装配前提」断言行 + ROUND-C1/C2 判据补同源性说明）、§13（风险行关闭登记）、§0/§2.1/§5（证据锚点补 `driver.ts:409-470/498-526` 与探针 O8 L971-1003） | **已落实**：采纳 SA2 建议的第二分支（facade 在 registry 在场时内建单 worker）并加严——registry **必填**且 route 参数**删除**（错位装配不可表达，强于「忽略外部 route」）；约束在 §8.3.1/§8.4 R7/R8/§12.2（12.0 表）明文；ROUND 四条契约条目在所述观察面上按图施工可绿（adopt 装配 = O8 唯一 green 形态的结构化）；SA2 建议的第一分支（独立 `adoptShardedWorker` 导出）不采用——理由：boot 形态单 worker、facade 已内建同一构造，独立导出会成为可被遗忘绕过的第二入口（`AdoptedWorker` 形态与构造序已在 §8.1/§8.3.2 全量规定，实现即采纳变体的设计沉淀） |
| N1：SA8 设计复审 §8-2 两处行锚精度未回写 | §12.0 AUTH-C2 行（L424→**L425**）、ROUND-C3 行（L371→**L375**）、§12.1 引用组（CLOSE_OK→L375；错误终局组注明 L424=REOPEN/L425=UNAUTHORIZED）、§6（协议条款行） | 已更正（SA8 §8-2 裁定按精确行落锚） |
| N2：夹具签名未钉 instanceId 与 resolved limits/timeouts | §7.4（instanceId 钉死 `HUB_INSTANCE` 明文）、§8.1（LIMITS/TIMEOUTS = 公共 `DEFAULT_REPLICATION_LIMITS/TIMEOUTS` 冻结常量；`ResolvedLimits` 空扩展可直接赋；harness `CONTRACT_*` 缺 5 个分块字段不可用的理由；两半边同值纪律）、§1 非目标（夹具不提供限值覆盖面） | 已落实（一句话登记 + 常量选型依据） |
| N3：GATE-C3 证据命令只核两处 src，DENY 面更宽 | §12.0 GATE-C3 行、§12.6（双段证据命令：契约原命令 + 全 DENY 面 `git status --short` 空输出）、§11（ALLOW 行注明） | 已落实 |
| N4：SEQ-C1 断言强于探针 O6 证据形态（O6 为新工厂首连接） | §12.0 SEQ-C1 行（构图要求明文：同一 `ShardedHost` 场景实例双 pipe 双连接；机制依据 `hub-edge-host.ts:909-948` 每连接独立内部 edge + OutboundQueue） | 已落实（测试构图要求入判据） |
| N5：`advanceMs` 只推进 peer 侧 scheduler | §7.7（推进面精确化）、§9（时间纪律按侧精确；TERM-C2 分 pipe/boot 两形态写明观察面） | 已落实 |
| N6：白名单 vs 黑名单等价性（SA2 独立验证与 SA8 复审同向） | §7.2（吸收独立佐证陈述） | 无需改动（登记佐证；白名单维持） |
| N7：no-sink 重 OPEN 路径 resolver 为 0 跳同步调用（不破坏登记不变量） | §7.3-4（路径细分登记）、§8.1 尾（夹具头注要求补一句） | 已落实 |

评审其余核对性结论（≥20 处源码锚点属实、SD-2(a) 微任务论证成立、SC1–SC8/E1–E6 无缺口、N6 等价性独立佐证）与本设计一致，未触发修订。SA2 评审判定 F-R1 修订 `requiresConflictRecheck = false`（无新决策面）；SA8 两侧报告的既有复查义务不受影响（§15）。

---

## 15. 是否需要设计后 ADR 冲突复查及理由

**需要（`requiresConflictRecheck: true`）**。理由：

1. SA8 前置门禁 §8-4 与设计复审 §10 的既有义务链条：设计复审已对迭代 0 核 clear（SD-1~SD-4 全部落界）；**本轮迭代 1 改变了 harness 装配形态**（facade adopt 模式、删除路由形态 facade、新增 `AdoptedWorker`/`RoutableWorker` 面）——装配面属 SA8 设计复审的指定核对对象（「harness 装配是否仍在其 adjudication 内」），修订增量应按 §8-4 复核一次（预期落点：决策 1「只装配公共工厂」的兑现型——被装配对象与缝纪律均未变，仅 worker 的 registry 归属显式化；无新决策面）。
2. 本设计的两处范围裁量（迭代 0 已登记、复审已核）保持不变：(a) SD-2(b) 设计追加负控；(b) §7.2 枚举白名单。本轮新增第三处裁量：**删除路由形态 facade**（对 SA2 F-R1 建议分支的加严采纳）——属 test-only 夹具面收窄，不触任何冻结面，但按同一纪律交复审过目。
3. 本任务生命周期语义断言面宽（AUTH/SEQ/ROUND/TERM/REVOKE/REAUTH 六组锁 wire 与状态机行为），SA8 前置 §10-2 要求实现票交付后核对套件未 fork 状态机、未越 DENY 面、硬门口径未漂移——设计阶段先登记此义务。
4. 非机械触发：本设计（含迭代 1 修订）零公共 API/wire/schema/持久化变更、零决策文本修订、零新生命周期所有权（全部复用生产语义；boot 形态约束是对既有 `boot`/`driver` 事实的承接而非新语义）；复查必要性来自修订增量与上述裁量，而非冻结面触碰。
