# SA4 实现静态审查 — issue #423（spec #415 T6）：observer 发射点拆分与降级口径

- 审查对象：当前工作树实现 diff（基线 HEAD `1f5809b`，分支 `mabf/issue-423`）+ 新增测试 + 文档编辑
- 审查人：SA4（实现静态审查；未修改实现/设计/测试，未运行测试或服务，只读命令复核）
- 审查时间基线：HEAD `1f5809b`；SA6 契约测试 mtime `09-22 04:25`、证据日志 `04:27`、SA3 守卫测试 `05:01`、SA3 报告 `05:04`、SA8 实现复查报告 `05:10`（会话中途到达，已纳入输入）

---

## 1. Reviewed inputs

| 输入 | 状态 | 消费方式 |
|---|---|---|
| `wiki/raw/task_issue-423.md`（任务简报） | 在场 | What-to-build + 6 条 AC 逐条对照 |
| `wiki/raw/task_issue-423_design.md`（SA1 批准设计） | 在场 | §D1–§D6、§11 ALLOW/DENY、§12 验收映射逐项对照实际 diff |
| `wiki/raw/task_issue-423_sa6_contract.md` + `artifacts/sa6-issue423-contract-evidence.log` | 在场 | 契约判据（§12.3 不可软化）与 S0–S6 证据核对 |
| `packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts`（SA6 契约，21 用例） | 在场 | 全文读取（fixture/注册表/断言/金标）；mtime 04:25 先于 SA3 实现 05:01+ ⇒ 零改动无软化 |
| `wiki/raw/task_issue-423_sa2_review.md`（verdict = approve） | 在场 | §13 无必需修订；§14 O1–O5 落实核对 |
| `wiki/raw/task_issue-423_design_conflict_report.md`（SA8 设计复查，clear） | 在场 | §8 Required actions 1–4 + §10 三项待闭合面核对 |
| `wiki/raw/task_issue-423_implementation_conflict_report.md`（SA8 实现复查，clear，`requiresConflictRecheck=false`） | 在场（会话中途到达） | 逐项交叉验证本审查独立结论 |
| `wiki/raw/task_issue-423_sa3_impl.md`（SA3 实现报告） | 在场 | 改动清单/验证证据/偏离声明核对 |
| Owner 要求 | **无** | 简报明文「No owner requirements apply: REST comment read returned []」；SA6 §2 `gh` 复核 comments = 0 |
| `_relevant_decisions.md` / `_conflict_report.md` / 旧 `_sa4_review.md` | 不存在（iteration 0） | 约束面由 ADR 0032 + 协议 §23 + 两份 SA8 冲突报告承接 |
| 源码/协议/ADR 独立复核 | —— | `git diff` 逐 hunk、`git status`、`grep` 单漏斗/发射点/公共面、codec（`envelope.ts`/`messages.ts`/`payloads.ts`/`canonical.ts`）、`backpressure.ts`/`frame-io.ts` 发送栈、`defaults.ts`、根 `vitest.config.ts` include |

## 2. Verdict

**approve** —— 无 BLOCKER、无 MAJOR。实现与批准设计（§D1–§D6）、SA6 契约期望（§12.4 六项）、
SA2 O1–O5、SA8 两轮冲突复查义务逐项吻合；单漏斗恰一性、listen 形态键集/次序/值恒等、
缺面 dormant、公共面冻结、DENY 清单均有静态结构证据 + 既有测试锚。非阻断观察见 §12。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| What-to-build：edge 发连接域 8 型事件 | 既有面零改动（`setConnState`/`emitWaterEvent`/liveness/`emitUpgradeRejected` 均不在 diff）；契约 EM-C1a 锚 | 满足（本票零改动是正确处置） |
| What-to-build：依赖盖章后 sequence 的出站事件（update-sent 族）归 edge | `hub-edge.ts:267-270` port 包装 + `:852-869` `emitUpdateSentAtStamp`；src 内 `type: 'update-sent'` 仅剩 `hub-edge.ts:861`（hub）与 `peer-namespace.ts:1571`（peer，DENY 零改动）——grep 实测 | 满足 |
| What-to-build：授权拒绝事件 edge 复现 + connectionId 在场 | `hub-edge-host.ts:610/626/637` 三发射点统一 `...cidField(this.port.connectionId())`（`observer.ts:112-118` 单点，DENY 文件零改动）；pre-connection `auth-upgrade-rejected` 保持无键（`:782-796`，EM-C2c 负控） | 满足（缺口 A 收口） |
| What-to-build：session 发 namespace 域事件、update-acked 留 session | `hub-namespace.ts onUpdateSent` 仅抑制非 chunked 分支；`update-acked`/bootstrap/sync/resync/chunked 族零触碰（diff 仅该方法重构 + 注释） | 满足 |
| What-to-build：字段集 append-only 不变 | `types.ts` 零改动（git status）；edge 构造体键集 = {type,side,connectionId?,namespaceId,bytes,sequence,sendQueueMs?} ⊆ `types.ts:514-528`；契约 `assertSection23Shape` 贯穿 | 满足 |
| What-to-build：缺面 dormant 纪律平移 | 零触碰（`sendFailureContext`/shim 面不在 diff）；新增面同纪律：宿主直驱帧 `sendQueueMs` 整键缺席（`hub-edge.ts:867` 条件展开；OG-5a/EM-C4a 锚） | 满足 |
| What-to-build：maxConcurrentAssembliesPerConnection 分片口径文档化 | 协议 §17:582 新增子条目（聚合上界公式与 ADR 0032:30 逐字）；ADR 0032:45 后果节注记；运行时零改动（`inboundAssemblySlots` 不在 diff）；EM-C6a/b 回归锚在 §17 注记中显式引用 | 满足（AC5） |
| AC6：单体序列与拆分前逐字一致 | EM-C7 金标（`PRE_SPLIT_LIVE_GOLDEN` 含 `update-sent` 行精确键集 `bytes,connectionId,namespaceId,sendQueueMs,sequence,side,type` + sequence 值）；次序恒等论证独立复核（见 §8） | 满足 |
| SA6 §12.4-2 ①–⑥（恰一/sequence/bytes/namespaceId/listen sendQueueMs 保留/宿主直驱缺面） | ① 单漏斗 grep 实测（§5 平行机制表）；② `sequence` = `tryEmitDataFrame` 返回值（与 `emitOne` 盖章 `[8..12]` 同点，`frame-io.ts:190-197`）；③ `bytes` = varUint 定偏移判读 ≡ update 内容长度（codec 字段序实测 `payloads.ts:634-635`：`varString(nsId)` + `varUint8Array(update)`，长度前缀 = lib0 varUint）；④ `namespaceId` = 帧字节 `[21,56)` ascii（与 `routingKeyOf` 同窗口同 `asciiAt`）；⑤ accounting 透传链四层完整（§7）；⑥ egress 不传 accounting（`hub-edge-host.ts:695` 单参调用） | 全部满足 |
| SA2 §14 O1–O5 | O1 本地 `readBe32At`（`hub-edge.ts:126-134`）；O2 两处绑定箭头显式多参 + 注释（`hub-session.ts:62-64`、`hub-namespace.ts:248`）；O3 三处同形互指注释；O4 采样点/次序两注释钉死（`update-channel.ts:355-362`）；O5 守卫 OG-3/OG-4a/b/c 畸形输入零 throw 零事件返回值不变 | 全部落实 |
| SA8 设计复查 §8-1..4 + §10 三项闭合 | 文档纯追加（hunk 级 + 前缀逐字保留）；缝类型内部（grep `index.ts`/`testing.ts` 零 `HubSendAccounting`）；DENY 零改动；构造点迁移值恒等（本报告 §7/§8 独立复核）；SA8 实现复查（05:10）同判 clear | 全部满足 |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| D1：三发射点 `cidField(port.connectionId())` 条件展开 | `hub-edge-host.ts:610/626/637`（+ import `:33`） | 忠实；条件展开保留握手前防御形状；三路径均 HELLO 门后，运行时恒在场 | 无 |
| D2.1：port 包装 + `emitUpdateSentAtStamp`（observer 门首行 → 型门 → 路由键 → 长度交叉校验 → 单点分发） | `hub-edge.ts:267-271`（包装）、`:852-869`（发射）、`:885-899`（probe） | 忠实；`seq>0` 门、`frame[5]!==MESSAGE_TYPES.UPDATE` 型门（0x40 单源 import）、`[20]===35`、`readBe32At(12)` + `byteLength===20+payloadLength` + `payloadLength===1+35+varUintBytes+updateLen` 双校验逐条落码 | 无 |
| D2.2 单漏斗恰一 | 见 §5 平行机制表（grep 实测三调用方 + 消息形态 peer 专属） | 结构性成立 | 无 |
| D2.3 定偏移判定纪律 | `UPDATE_FRAME_MIN_BYTES=56`（20+1+35）、`readVarUintAt` ≤5 字节/续位 0x80/LSB 先（与 `canonical.ts:233-247` lib0 编码逐位吻合）、`asciiAt` 复用路由键同一读取 | 忠实；边界复核：空 update（57 字节帧，prefix 1 字节 0x00）可正常判出 `bytes:0`；5 字节 varUint 值 >u32 时被长度交叉校验拦下（JS number 无溢出面） | 无 |
| D3.1：`HubSendAccounting` + 可选参线程 | `hub-split.ts:53-70/88-92`、`update-channel.ts:25-37`、`hub-namespace.ts:64-74`、`hub-session.ts:62-64/211-226`、`hub-namespace.ts:248/1331-1345` | 忠实；纯类型零运行时构件；结构化兼容（peer 少参、SA6 `makeStubPort:414-418` 单参桩、issue243/300 通道级桩均不动） | 无 |
| D3.2 采样点前移 + 值恒等 | `update-channel.ts:363-370`；发送栈（`sendUpdateFrame→sendData→port.sendDataFrame→tryEmitDataFrame→emitDataFrameBytes→emitFrame→emitOne→emitRaw→transport.send`）逐层读取复核：零时钟读、零 observer 事件（`observe()` 只读 bufferedAmount；`onEmitted` 仅记账，非暂停控制帧的 retire 走 microtask 不入同步栈） | 值恒等论证成立；`sentAt` 一次读数两用（accounting + inFlight t0），读数次数不变 | 无 |
| D3.3 宿主直驱缺面 | egress 公共签名零变化（`hub-edge-host.ts:123` `[frame: Uint8Array]`；#421 test-d 钉死面不受影响）；`:694-695` 单参调用 | 忠实 | 无 |
| D3.4 键集不变 | edge 构造体恰好产出金标键集；`types.ts` 零改动 | 满足 | 无 |
| D4：session 抑制 + chunked 留 session + peer 原样 | `hub-namespace.ts:1402`（`info.chunked === undefined` 早退）+ `:1403-1410`（chunked 分支事件构造体逐字节保持）；peer 文件零改动（git status） | 忠实；`observerOn` 门保持；peer 经共享 `UpdateChannel` 的 noteUpdateSent 照旧发射（`peer-namespace.ts:1571`） | 无 |
| D5：文档四处 | 协议 §17:582 / §22:704 / §23.1:745 行尾注记 + :833-847 归属表（含 U5 形态差异登记）；ADR 0032:45 | 纯追加（原行文本逐字保留为前缀；§23.2/23.3/23.4 与 ADR 决策区 hunk 零触碰）；聚合上界公式与 ADR 逐字 | 无 |
| D6：防御分支 dormant | `hub-edge.ts:859`（probe undefined ⇒ return，零 throw）；守卫 OG-3/4a/4b/4c 锚定 | 忠实；probe 自身不可 throw（全部定偏移读均有边界检查，`readVarUintAt` 越界返回 undefined） | 无 |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| `update-sent` 发射（盖章事实） | edge（ADR 决策 5） | `hub-edge.ts` port 出面 | 正确 |
| `sendQueueMs` 计算（session 时钟域） | session | `update-channel.ts sendAndRegister`，只差值过缝 | 正确（不混时钟域——否决「edge 采样」的设计裁决落实） |
| `bytes`/`namespaceId` 判定 | edge 帧字节 | `updateFrameProbe`（与 `routingKeyOf` 同 `asciiAt`/同窗口） | 正确（防投影说谎） |
| 拒绝路径 `connectionId` | edge 端口（值所有者） | `cidField(port.connectionId())` 单点复用 | 正确（无第二事实源） |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| 定偏移帧判定 | `routingKeyOf`（ADR 决策 4 先例） | `updateFrameProbe` 同纪律扩展（型门 + varUint + 双交叉校验） | 一致 | 同一布局契约；守卫测试按 issue-scoped 惯例新文件 |
| 条件字段展开 | `observer.ts cidField` | D1/D2 消费同一单点 | 一致 | 零新展开逻辑 |
| 隔离分发 | `dispatchReplicationObserver` | 新发射点经同一单点 | 一致 | `observer.ts` 零改动 |
| 大端读写分层 | `frame-io.ts writeBe32At`（本地私有） | `hub-edge.ts readBe32At`（本地私有，SA2 O1） | 一致 | 同款本地分层，未 import 协议内部函数 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| wire sequence | `OutboundQueue.lastSeq`（`[8..12]` 单点） | 事件 `sequence` = 盖章返回值 | 无（同点派生） |
| `connectionId` | edge `connectionIdValue`（HELLO 置位） | `cidField`/port 投影 | 无（单链） |
| `bytes`/`namespaceId` | 帧字节 | 定偏移判读 | 低（守卫测试 vs `decodeMessage` 跨 varUint 边界锚定，漂移即红） |
| `sendQueueMs` | session 时钟域差值 | 缝投影（调用栈瞬态，零存活） | 无 |

### 生命周期对称性

无新生命周期构件（accounting = 瞬态值；`HubSendAccounting` = 纯类型）；拒帧 ⇒ 记账随帧弃置；无 register/dispose/subscribe 新面——对称性不适用且无新增不对称面。

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 第二发射通道 | `dispatchReplicationObserver` 单点 | 复用 | 非平行 |
| 第二帧解析 | `decodeMessage` O(payload) | 定偏移 ≤5B varUint + O(1) 头读 | 非平行（决策 4 明确豁免；整帧 decode 被设计否决且守卫锚定） |
| 第二 data 发送漏斗 | `port.sendDataFrame` | grep 实测：hub 全部 data 帧调用方 = `hub-session.ts:221`（UPDATE）、`:262`（UPDATE_CHUNK）、`hub-edge-host.ts:695`（egress 直驱）；`tryEmitDataFrame` 直调仅 port 包装自身（`hub-edge.ts:268`）；消息形态 `tryEmitData` 仅 peer | 非平行——单漏斗成立，恰一性结构性保证 |
| 第二布局守卫 | `issue421-route-key-parity`（id 窗口） | 新增 #423 守卫（varUint/型门/防御分支） | 非平行（判定面不同，按仓库 issue-scoped 惯例） |

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/ws-replication/src/hub-edge-host.ts`（M） | ALLOW 1 | 缺口 A 三发射点 | 在范围（+9：三处 cidField + import + 注释） |
| `packages/ws-replication/src/hub-edge.ts`（M） | ALLOW 2 | 缺口 B 发射点 + probe | 在范围（+118：包装/助手/常量/import） |
| `packages/ws-replication/src/hub-namespace.ts`（M） | ALLOW 5 | 透传 + 抑制 | 在范围（+63/−45：接口可选参、绑定箭头、onUpdateSent 重构） |
| `packages/ws-replication/src/hub-session.ts`（M） | ALLOW 4 | accounting 透传 | 在范围（+15） |
| `packages/ws-replication/src/hub-split.ts`（M） | ALLOW 3 | 缝类型 + 可选参 | 在范围（+25） |
| `packages/ws-replication/src/update-channel.ts`（M） | ALLOW 6 | 采样点前移 + accounting | 在范围（+39/−16） |
| `packages/ws-replication/test/ws-replication-issue423-update-offset-guard.test.ts`（??） | ALLOW 7 | 布局守卫（10 用例） | 在范围（新增） |
| `docs/protocols/instance-replication-v1.md`（M） | ALLOW 8 | §17/§22/§23.1 追加 | 在范围（+19/−1，唯一 −1 = §23.1 行尾注记追加） |
| `docs/adr/0032-…md`（M） | ALLOW 9 | 后果节注记 | 在范围（+1，hunk `@@ -44,0 +45 @@` 决策区零触碰） |
| `packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts`（??） | SA6 固定产物（DENY 语义） | 验收契约 | **零改动**（mtime 04:25 < SA3 05:01+；21 用例/断言结构与 SA6 §12.3 描述逐字吻合；无 skip/only/todo——grep 实测） |
| `artifacts/sa6-issue423-contract-evidence.log`（??） | 只读输入 | SA6 证据 | 零改动（mtime 04:27） |
| `wiki/raw/task_issue-423_*.md`（??） | 各角色固定产物 | 报告 | 非实现面 |

**DENY 核对**：`git status --short` 全量比对——`index.ts`/`testing.ts`/`types.ts`/`observer.ts`/`frame-io.ts`/`backpressure.ts`/`hub-connection.ts`/`peer-connection.ts`/`peer-namespace.ts`/`hub-upgrade-admission.ts`/`liveness.ts`/`plugin.ts`/`defaults.ts`/`validate.ts`/`replication-protocol/**`/既有测试文件**全部零改动**。`git diff --check` 实跑 CLEAN。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| `HubSessionEdgePort.sendDataFrame` 可选参 | hub-session（2 处）、hub-edge-host egress（1 处）、SA6 stub、#418/#421 桩 | 结构化兼容（少参恒可赋值）；typecheck exit 0（SA3）+ 本审查静态核对 | 无 | 无 |
| `UpdateChannelHost.sendUpdateFrame` 可选参 | hub-namespace 装配箭头（已改双参）、peer-namespace（少参忽略，行为零变化：peer 照旧自 `noteUpdateSent` 发射）、issue243/300 通道级桩（少参兼容，断言面为 noteUpdateSent 日志非 observer，不受抑制影响） | 兼容 | 无 | 无 |
| `HubChannelHost.sendData` 可选参 | hub-session 绑定箭头（已改三参，SA2 O2 注释在位） | 兼容；透传断链将被 EM-C4c/C7a 拦（红灯即检测器） | 低 | 无 |
| `HubReplicationEdgeEgress.sendDataFrame` 公共签名 | 工厂宿主 / #421 api test-d | 签名零变化；新增副作用 = 每 UPDATE 帧恰一 observer 事件（observer 在场时）= 本票目标 | 无 | 无 |
| `onUpdateSent` hub 侧行为变化 | 唯一消费方 = `UpdateChannel.noteUpdateSent` 链 | 普通帧抑制（edge 接管）、chunked 改道原样；peer 侧消费方零改动 | 无 | 无 |
| 事件面消费者（§23.1 `update-sent` 行） | observer 消费者 / 金标 / `observer-red:477-497,1236` 键集白名单 / `issue238` 精确值断言 | 键集 ⊆ 白名单；值恒等（§8）；金标行键齐 | 无 | 无 |
| 外部包/apps | `UpdateChannelHost`/`HubChannelHost`/`HubSessionEdgePort` 在 ws-replication src/test 之外零引用（SA2 grep；本审查复核公共入口零导出） | 不触达 | 无 | 无 |

## 8. 错误、恢复与并发

- **恰一/幂等**：单漏斗（§5）+ 型门 + `seq>0` 门 + session 抑制四重结构性成立；`sequence` 严格递增 ⇒ 天然幂等键；无跨连接/持久化状态。
- **发送被拒（seq≤0）**：零事件（包装点只在 `seq>0` 后判定）；accounting 随帧弃置；既有 F4/`send-frame-rejected` 分支原样（`update-channel.ts:371-379`，`captureFailureDetail` 先采样后 discard 次序保持）。
- **`OutboundExhaustedError`**（实践不可达）：包装点不拦截，传播路径与改前逐字一致（`hub-namespace.sendUpdateFrame` catch → 0）；事件因 seq 未返回而跳过。
- **observer throw**：`emitUpdateSentAtStamp` 经 `dispatchReplicationObserver` 单点静默隔离（EM-C5a 双跑 wire 逐帧相等锚）；probe 自身零 throw 可能（全边界检查）。
- **次序（AC6 关键论证，独立复核）**：新发射点（port 包装内，`host.sendUpdateFrame` 调用中）与旧发射点（`noteUpdateSent` → `onUpdateSent`）位于同一同步栈；两点之间既有动作仅 `inFlight.set`（Map 写，零事件）⇒ 组合观测面事件序列逐字不变。发送栈逐层核对零时钟读、零 observer 事件（`onEmitted` 的 microtask retire 不入同步栈）。
- **clock/observer 缺面**：`host.now` = `port.now`（observer 门 + safeNow 折叠，`hub-edge.ts:300-303`）⇒ 无 observer ⇒ 无 sentAt ⇒ 无 accounting 构造 ⇒ 键缺席；clock-throw 同折叠（EM-C3c/C4c 两态锚）。
- **TOCTOU/双写/stale**：无新共享状态；accounting 为瞬态；无锁/lease 面。
- **进程重启/事务中断**：不适用（观测面无持久化）。
- 已知微差（SA2 O4①/SA8 §7.3 登记）：拒帧路径新增一次 observer 门后的时钟读（peer 侧为纯时钟读）——§23.4 合规（无 observer ⇒ 零时钟调用），无绝对时间戳入事件，无契约断言受影响。

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| 契约 EM-C2a/b/c | 拒绝路径两事件 `connectionId === connectionKey`（**取值断言**，非键存在）；键集 ⊆ §23 + 零异常原文；pre-connection 负控精确键集 | 根 `vitest.config.ts` include `packages/*/test/**/*.test.ts`；SA6 §13 S3 `vitest list` 21 条 | 无软化（文件零改动，mtime 证）；SA3 报 21/21 ×3 | 无 |
| 契约 EM-C4a/b/c | 工厂直驱恰一 + `sequence == stamped == wire [8..12]` + `bytes == decoded.update.byteLength` + control 负控；session 半边零发射（**非空帧数前置**防恒真）；listen 恰一 + `sendQueueMs` 键在场 | 同上 | 无 | 无 |
| 契约 EM-C7a/b | 拆分前金标逐字相等（型 + 精确键集 + 稳定字面量；`update-sent` 行键集含 `sendQueueMs` ⇒ 双发/丢键/乱序皆红） | 同上 | 数值测量字段有意排除（跨进程 Yjs clientID）——语义面由 wire/§23 锚承载，非弱化 | 无 |
| 契约 EM-C1/C3/C5/C6 | 侧归属双向零越界；缺面/正控成对；隔离双形态；listen 计数锚 `limits` 键 | 同上 | 无 | 无 |
| 守卫 OG-1a/b | 定偏移长度判定 === `decodeMessage(...).update.byteLength`（跨 127/128、16383/16384/16385 + 确定性取样 12 值）；精确键集断言（握手前无 connectionId、无记账无 sendQueueMs）；不同 nsId 判定取自帧字节 | 同上（路径天然匹配 include） | 无；默认额度 8 MiB ≫ 夹具累计 ~124 KB，admission 稳定 | 无 |
| 守卫 OG-2a/b | 型门负控（UPDATE_CHUNK `[20]===0` 结构性差异 / OPEN_OK）零事件且返回值 = wire 序 | 同上 | 无 | 无 |
| 守卫 OG-3/4a/b/c | id 前缀腐蚀 / 短帧 / payloadLength 不自洽 / 非规范 varUint 续位与 5 字节 runaway ⇒ **零 throw + 零事件 + 返回值不受影响**（SA2 O5 落实，D6 从设计主张变回归锚） | 同上 | 无 | 无 |
| 守卫 OG-5a/b | accounting 两态（在场取值透传 7 / 缺省整键缺席）；admission 拒绝（额度 64）⇒ seq=0 + 零事件 + 零出站 | 同上 | 无 | 无 |
| 既有回归面 | `issue238-segmented-observation` 精确 `sendQueueMs [0,4_000]`、`observer-red` 键集白名单、`issue238-repro`/`issue230` 序列关联、`issue243/245` chunked 族、`issue418/421` 拒绝路径、peer 全套件 | 包级 `vitest run packages/ws-replication`（SA3：86 files / 717 tests 全绿） | SA4 未复跑（纪律）；断言面静态核对无弱化迹象 | 无 |

skip/only/todo/env override：两份 #423 测试文件 grep 零命中。契约执行入口 = 根/包级 vitest include（真实发现）。

## 10. Required revisions

无 BLOCKER / MAJOR finding。

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| 根全仓门禁（14 包 + apps/yjs-server） | Host 执行 `pnpm typecheck` / `pnpm test`（SA6 U6；SA3 已跑包级全量 + 根 typecheck exit 0） | 全绿 | 任一包/根套件红 |
| 契约 + 守卫 + 包级复跑独立性 | 后续验证角色（SA7/Host）按 SA6 §13 命令复跑 | 契约 21/21、守卫 10/10、包级 717/717 | 与 SA3 报告不符 |
| 真实时钟域 `sendQueueMs` 残差 | 动态验证（真实 transport） | 差值 ≈ 同步栈时长（微秒级），无绝对值断言 | 出现毫秒级漂移 ⇒ 发送栈被引入新时钟读 |
| 分片（worker）形态运行时锚：per-session 计数端到端 + 正式 session shim 面 + 宿主直驱 sendQueueMs 缺面 | T3(#420)/T5(#422) 落地后（SA6 U4 登记的 follow-up，非本票必要条件） | 聚合上界 = limits × worker 数实测成立 | 实测超出聚合上界 |
| sequence 耗尽边界（`0xffffffff`）与 update-sent 交互 | 可选动态场景（`OutboundExhaustedError` 路径实践不可达） | throw 传播、无事件（seq 未返回） | 出现半发射/重复事件 |
| `maxConcurrentAssembliesPerConnection` listen 计数长期回归 | EM-C6a/b + §17 注记锚 | 保持绿 | 红 |

## 12. Non-blocking observations

| ID | 观察 | 建议 |
|---|---|---|
| N1 | `emitUpdateSentAtStamp` 读 `this.connectionObserver()` 两次（门 + 分发；`setConnState` 同款既有风格） | 可局部变量化；纯风格，零行为差 |
| N2 | §23.1 `update-sent` 行文本被行尾追注（原文本逐字保留为前缀）——SA8 设计复查 §8-1 字面「字段表逐行零改动」与设计 §D5「行尾注记」之间的措辞张力；SA3 已如实披露，SA8 实现复查 IA-7 以脚本核对前缀保留后裁为追加注记 | 无需动作；后续票对冻结表的行尾追注可考虑统一为表外脚注以消歧 |
| N3 | 采样点前移使拒帧路径多一次 observer 门后的时钟读（hub）/纯时钟读（peer）——SA2 O4①、SA8 §7.3 双双登记为合规微差 | 已在实现注释钉死；无契约面影响 |
| N4 | `HubSendAccounting` 形状三处结构化拼写（hub-split 具名 + 两处内联）——append-only 扩成员时类型不强制同步 | 三处互指注释已落（SA2 O3）；若长出第二成员抽中立即类型 |
| N5 | egress 判定将 UPDATE varUint 长度前缀布局纳入「同步维护契约」依赖面；CONTEXT.md「路由键契约」词条作用域仍为 demux——SA8 两轮报告均登记为无需演进 | follow-up 票可做一行 append（非本票义务） |
