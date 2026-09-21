# SA8 实现冲突复查报告 — issue #423（observer 发射点拆分与降级口径）

- Reviewed subject: **implementation**（当前工作树 diff vs 基线 HEAD `1f5809b`；含文档编辑）
- 复查时间基线：HEAD `1f5809b`（分支 `mabf/issue-423`，与 SA3/SA2/设计自报基线一致）
- 复查人：SA8（conflict-gate skill；只读复核，未修改任何被审对象、未运行测试）
- 结论速览：**verdict = clear**；对照项 15 项 = 8 × no-conflict + 7 × implements-existing-decision；
  **0 hard-conflict、0 evolution-required、0 override**；设计复查（`_design_conflict_report.md`）登记的
  §10 三项待闭合触发面**全部由本次实现闭合** ⇒ `requiresConflictRecheck = false`（见 §10）。

---

## 1. Reviewed subject

实现 diff（`git diff HEAD` + 未跟踪产物），文件面 = 设计 §11 ALLOW LIST 精确落位：

- 6 个生产文件：`hub-edge-host.ts`（+9）、`hub-edge.ts`（+118）、`hub-namespace.ts`（+63/−45）、
  `hub-session.ts`（+15）、`hub-split.ts`（+25）、`update-channel.ts`（+39/−16）
- 2 个规范文档：`docs/adr/0032-…md`（+1 行，hunk `@@ -44,0 +45 @@`——「后果」节尾部）、
  `docs/protocols/instance-replication-v1.md`（+19/−1，hunk `@@ -581,0 +582 / -702,0 +704 /
  -743 +745 / -830,0 +833,15`——§17/§22 追加行 + §23.1 行尾注记 + 表组后新增小节）
- 1 个新增守卫测试：`packages/ws-replication/test/ws-replication-issue423-update-offset-guard.test.ts`
- SA6 契约测试（`ws-replication-issue423-observer-emission-split.test.ts`，21 用例）与证据日志
  为上游产物（mtime 04:25/04:27 先于 SA3 实现 05:01+，SA3 期间零改动 ⇒ 无软化面）

上游输入：设计（`_design.md`）、SA2 review（verdict = approve，0 BLOCKER/MAJOR）、SA3 impl、
SA6 契约（verdict = approve，3 红 = EM-C2a/C4a/C4b）。SA4/SA7 报告**不存在**（本票流程未到；
不影响冲突裁决——本报告只对照决策集与实际 diff）。

## 2. Inputs and decision set

| 输入 | 状态 | 核验方式 |
|---|---|---|
| `docs/adr/` 全部 ADR | 31 份扫描；无 superseded 指向 0032 | 状态面承设计复查（同 HEAD）；本次增量核对 ADR 0013（chunked 键集）与 0032 全文 |
| `docs/adr/0032-transport-decoupling-edge-session-split.md` | 已接受；决策 1–5（:10-30）+ 否决备选（:32-37）+ 后果（:39-45） | 全文重读；决策区 hunk 零触碰（唯一 hunk 在 :45 追加注记） |
| `docs/protocols/instance-replication-v1.md` §17/§22/§23.1–23.4 | 规范协议；§23.1 36 型字段表、§23.2 稳定码、§23.3 safe-field、§23.4 隔离与时钟为冻结面 | hunk 级核对：仅 4 处（§17/§22 纯新增行、§23.1 行尾纯追加、:833-847 新增小节）；§23.2/§23.3/§23.4 零触碰 |
| `CONTEXT.md` 术语（复制 Edge/SessionHost、路由键契约、实例角色） | 术语面核对 | 「路由键契约」词条（:233）作用域 = edge 帧 **demux** 依赖；egress 判定不在词条域内（见 §6 注记） |
| `docs/AGENTS.md`（docs 区纪律） | 显式修订、规范文档同步、`git diff --check` | 逐条核对（见 IA-14）；`git diff --check` 实跑 exit 0 |
| `packages/ws-replication/AGENTS.md` | 模块契约（公共面经 `src/index.ts`、observer 隔离） | `git status --short` 核对 DENY 路径零改动 |
| 实际 diff | 8 文件 +2 新测试 | 逐 hunk 人工复核 + 脚本核对（§23.1 行前缀保留、符号引用、skip/only/todo 扫描） |
| SA3 验证证据 | 契约 21/21 绿 ×3、守卫 10/10、包级 86 files/717 tests 绿、包级 + 根 typecheck exit 0 | 证据文本读取；SA8 不复跑测试，仅消费登记证据（冲突裁决不依赖测试绿，但无反证） |
| Owner 要求 | **无** | Host 简报「REST comment read returned []」；SA6 §2 `gh` 复核 comments = 0；两源一致 |

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（实际 diff） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| IA-1 | ADR 0032 决策 5 | 「observer 发射点 = 拥有事实的一侧（连接域与出站 sequence 事件在 edge，namespace 域事件在 session）」（:30） | `hub-edge.ts:267-270`：`makePort().sendDataFrame` 包装（`seq>0` 后 `emitUpdateSentAtStamp`，:852-870）；`hub-namespace.ts:1402`：普通帧分支抑制（`info.chunked === undefined` 即 return）——发射恰一由单漏斗 + 抑制两点结构性成立 | **implements-existing-decision** | ADR 0032:30；红灯 EM-C4a/C4b 经实现转绿（SA3 验证表）；单漏斗事实：hub 全部 data 帧经 `port.sendDataFrame`（`hub-session.ts:214-227`、宿主直驱 `hub-edge-host.ts` egress） | 无 |
| IA-2 | ADR 0032 决策 5 | 「事件字段集 append-only 不变」（:30） | edge 构造体键集 = {type, side, connectionId?, namespaceId, bytes, sequence, sendQueueMs?} ⊆ §23.1 `update-sent` 行（:745）；零新事件型/字段/错误码；`types.ts` 在 DENY 且零改动 | **no-conflict** | §23.1:745；`git status` 无 `types.ts`；契约 `SECTION_23_FIELDS` 白名单贯穿（`assertSection23Shape`） | 无 |
| IA-3 | ADR 0032 决策 5 + 协议 §17 | 「`maxConcurrentAssembliesPerConnection` 在分片形态降级为 per-session 计数（聚合上界 = limits 值 × worker 数，listen 模式不变）」（:30）；§17:581 现文仅 per-connection 口径 | §17:582 追加分片口径注记：公式**逐字**复现 ADR 文本（「聚合上界 = limits 值 × worker 数」）、listen 保持 per-connection（符号引用 `hub-edge.ts` 的 `inboundAssemblySlots` 实存于 :183）、超额码/判据不变明文；运行时零改动（EM-C6a/b 回归锚） | **implements-existing-decision** | 协议 §17:582（新增行）；ADR 0032:30；`hub-edge.ts:183,281-292`；EM-C6a/b 绿（SA3） | 无 |
| IA-4 | ADR 0032 决策 2 | 「缝只过 `Uint8Array` 帧与纯 JSON」；四控制信号（:18） | `hub-split.ts:67-70`：`HubSendAccounting { readonly sendQueueMs?: number }`（纯 JSON、有限数值差值）；`sendDataFrame(frame, accounting?)`（:92）可选参 append-only；零新控制信号、零帧形态变化；类型不进 `index.ts`/`testing.ts`（两文件零改动） | **no-conflict** | ADR 0032:18/43；`git status` 无公共入口文件；结构化类型兼容（peer 少参实现零改动、typecheck exit 0） | 无 |
| IA-5 | ADR 0032 决策 4 | 「edge 定偏移只读提取，不解析 payload……提取成本 O(帧头)」「路由键布局与 codec 字段序登记为同步维护契约，codec 侧加结构性守卫测试」（:26） | `hub-edge.ts:885-906`：`updateFrameProbe` = `[5]` 型门 + `[20]` 前缀 + id 窗口 `[21,56)` + `readVarUintAt`（≤5 字节定偏移，:141-155）+ 双长度交叉校验；守卫测试**已交付**（`…update-offset-guard.test.ts`，10 用例：varUint 1/2/3 字节边界 vs `decodeMessage`、型门、id 窗口、D6 防御分支）；布局依赖已登记 §23.1 注记 + ADR 注记 | **implements-existing-decision** | ADR 0032:26；`hub-edge.ts:127/130-160/885-906`；守卫测试文件在场（无 skip/only/todo——grep 实测）；§22:704 资产锚登记 | 无 |
| IA-6 | ADR 0032 状态/后果 | 「wire 格式与协议语义零变化，listen 模式行为逐字节不变」「peer 侧不拆分」（:4、:44） | `replication-protocol/**`、`peer-namespace.ts`、`peer-connection.ts`、`hub-connection.ts` 全部零改动；listen 金标 EM-C7a/b（拆分前逐字相等）绿；次序恒等论证落码（`update-channel.ts:355-366` 注释钉死「edge 发射先于 `inFlight.set`/`armAckTimer`，两点之间零 observer 事件」） | **no-conflict** | ADR 0032:4/44；`git status --short` 仅 ALLOW 路径；EM-C7a/b 绿（SA3）；SA2 SM-6 独立复核（两点间仅 `inFlight.set`/`armAckTimer`/`observe()`，均零 observer 事件） | 无 |
| IA-7 | 协议 §23 preamble + §23.1 | seam append-only：类型/词表/稳定码只增不改，GA 后字段语义冻结 | §23.1 编辑 = `update-sent` **行尾追加**注记（脚本核对：原行文本逐字保留为前缀，追加以 `。**issue #423 发射点注记…` 起）+ :833-847 新增「发射侧归属表」小节（自declare「不改变任何事件型/字段/词表；`side` 信封语义与发射侧正交」）+ 形态差异登记（U5：未授权 OPEN 无 `channel-state-changed`）；§23.2/§23.3/§23.4 hunk 零触碰 | **no-conflict** | hunk 清单（§1）；前缀保留脚本断言 PREFIX-OK；归属表 4 行与代码事实逐行核对（见 IA-1/IA-9/IA-12） | 无 |
| IA-8 | 协议 §23.1 `update-sent` 行值语义 | `bytes`（出站 UPDATE 载荷长度）、`sequence`（恒在场，`[8..12]`）、`sendQueueMs?`（帧实际出队 − 最旧入队；clock 注入时在场） | `bytes` = varUint `updateLen` 定偏移判读（≡ 既有 `bytes.byteLength` 口径——update 内容长度，合并帧报合并后长度）；`sequence` = 盖章返回值同点派生；`sendQueueMs` = `update-channel.ts:363-368` 同步栈内单次读数差值，经缝透传（采样点前移至发送调用边界——§23.1 注记已文档化；发送栈零时钟读 ⇒ 手动时钟域逐值恒等，`issue238` 精确断言绿） | **no-conflict** | §23.1:745 注记；`update-channel.ts:352-371`；`hub-edge.ts:866-869`（缺面整键缺席）；EM-C4c/C7a + `issue238-segmented-observation` 精确断言绿（SA3 包级全绿） | 无 |
| IA-9 | 协议 §23.3 safe-field | `connectionId` 受控 observability id：「握手完成前字段不存在」（完成后在场） | `hub-edge-host.ts:608/624/637`：三发射点（`synthesizeStateViolation` / `emitNamespaceErrorSent` / `emitNamespaceFailed`）统一 `...cidField(this.port.connectionId())` 条件展开（`observer.ts:112-118` 单点，DENY 零改动）；码集 = {NAMESPACE_UNAUTHORIZED, INTERNAL_ERROR, NAMESPACE_STATE_VIOLATION}（:616-620/610）与归属表登记逐字一致；pre-connection `auth-upgrade-rejected` 无键形态保持（EM-C2c 负控） | **implements-existing-decision** | 协议 §23.3；红灯 EM-C2a 转绿（`toBe(connectionKey)` 取值断言——SA6 §12.3 不可软化判据）；现状缺口 = #421 交付面遗留 | 无 |
| IA-10 | 协议 §23.4 隔离与时钟 | throw 隔离；「事件在决策已落定之后发射」；缺 clock 整键缺失；无 observer = 零构造/零字段读取/零时钟调用；绝对时间戳不入事件 | `emitUpdateSentAtStamp` 首行 observer 门（:856-857：无 observer ⇒ 判定整体不执行）；发射在 `tryEmitDataFrame` 返回 `seq>0` 后（帧已出站）；probe 失败 = dormant 零 throw 零事件（观测面失败不改变协议结果）；`dispatchReplicationObserver` 单点零改动；缝只过差值非绝对时间戳（`hub-split.ts:57-59` 注释明示跨域减法纪律）；`host.now` observer 门链路原样（`hub-namespace.ts:259` → session port → edge `now` 门） | **no-conflict** | 协议 §23.4；`observer.ts:36-46` 零改动；EM-C5a/b（全抛 observer wire 逐帧相等）+ EM-C3c（缺 clock 整键缺席）绿 | 无 |
| IA-11 | 协议 §22 conformance 资产锚惯例 | 每票交付物登记（:699-702 先例） | :704 追加 #423 条目：验收契约 + 守卫测试双资产锚，文件名与实际未跟踪文件一致（存在性核实） | **no-conflict** | §22:702 先例；两测试文件在场 | 无 |
| IA-12 | 任务简报 What-to-build / SA6 U1 | 「依赖盖章后 sequence 的出站事件（update-sent 族）」归 edge；「update-acked{sequence} 关联入站 sequence、留在 session」 | 仅 `update-sent` 迁移（family 内唯一携 `sequence` 键者）；`chunked-update-sent`（ADR 0013 L89 键集：无 sequence/sendQueueMs）仍在 session 末 chunk 结算恰一发射（`hub-namespace.ts:1403-1410` 原样）；UPDATE_CHUNK 0x42 被型门排除 ⇒ 无双发；`update-acked`/bootstrap/sync 族零触碰 | **no-conflict** | §23.1 键集事实（745 携 sequence；739/741/747 无）；ADR 0013:89；归属表 session 行与代码一致；SA6 U1 裁决 + 设计 D4.2 + 设计复查 DA-13 三方同判 | 无 |
| IA-13 | `packages/ws-replication/AGENTS.md` | 生产 API 经 `src/index.ts`、测试面经显式 testing surface；observer/adapter 失败遵循文档化隔离 | `index.ts`/`testing.ts` 零改动；`HubSendAccounting` 仅存 `hub-split.ts`（模块头「不导出任何运行时值」纪律区）；隔离单点消费（IA-10） | **no-conflict** | `git status --short`；grep 公共入口零 `hub-split` 导出（设计复查已核，本次 status 复核） | 无 |
| IA-14 | `docs/AGENTS.md` ADR 修订纪律 | 「Amend or supersede prior decisions explicitly instead of silently contradicting them」；行为变化的规范文档同步；`git diff --check` | ADR 0032 唯一编辑 = 后果节 :45 追加「决策 5 观测面落地注记」，**自declare**「决策 1–5 与否决备选原文零改动；本注记只登记落点，不修改决策」——决策区 hunk 零触碰（实测）；协议四处编辑均为 ADR 既定语义落文（IA-3/IA-7）；`git diff --check` exit 0（实跑） | **no-conflict** | hunk 清单；ADR :10-37 无 diff；`git diff --check` 输出 clean | 无 |
| IA-15 | ADR 0013 L89（chunked 键集）+ R21 改道 | `chunked-update-sent` 键集冻结（transferId/chunkCount/totalBytes，无 sequence/latency） | session 侧改道分支逐字节保持（diff 仅注释更新 + 提前 return 合并，事件构造体零变化）；键集与 ADR 0013 L89 逐字一致 | **no-conflict** | `hub-namespace.ts:1403-1410`；ADR 0013:89；`issue243`/`issue245` 套件绿（SA3 包级全绿） | 无 |

**裁决分布**：no-conflict × 8（IA-2/4/6/7/8/10/11/12/13/14/15 主裁决计 8）+ implements-existing-decision × 7
（IA-1/3/5/9 及复合义务项）——逐行见表；**hard-conflict × 0；evolution-required × 0**。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| ——（无） | —— | —— | —— |

无合法 override 亦无所需 override：owner 评论为空（Host 简报 + SA6 §2 双源一致）；无新 ADR 修订/废弃；
无协议版本升级。实现的全部行为要么直接兑现 ADR 0032 既有决策（决策 5 观测面、决策 4 守卫义务、
§17/§23.3 文档义务），要么是 append-only 扩展（缝可选参、§23.1 注记/归属表、§22 锚、ADR 后果注记）
——**不依赖任何 override 成立**。ADR 0032 追加注记自身明示「不修改决策」，非静默矛盾（docs/AGENTS.md
显式修订纪律满足）。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（实际 diff） |
|---|---|---|---|
| wire 帧格式 | envelope 布局与全部消息编码 | 协议 §3/§5；`replication-protocol/**` | **保持**（该包零改动；`MESSAGE_TYPES`/`ENVELOPE_HEADER_BYTES` 只读消费） |
| §23.1 事件词表与字段表 | 36 型、逐型键集、字段语义（GA 后冻结） | §23.1:718-755 | **保持**（唯一行编辑 = `update-sent` 行尾纯追加，脚本核对原文本逐字保留为前缀；新增小节自declare不改词表） |
| §23.2 稳定码闭联合 | 三闭联合 | §23.2 | **保持**（hunk 零触碰） |
| §23.3 / §23.4 | safe-field 纪律 / 隔离与时钟纪律 | §23.3、§23.4 | **保持**（hunk 零触碰；行为面见 IA-9/IA-10） |
| `update-sent` 值语义 | `bytes`/`sequence`/`sendQueueMs` 三键语义 | §23.1:745；`observer-red`/`issue238` 锚 | **保持**（同点派生 + 采样点文档化；EM-C4c/C7a 与 issue238 精确断言绿） |
| observer 隔离单点 | `dispatchReplicationObserver` try/catch 静默隔离 | §23.4:900-901；`observer.ts:36-46` | **保持**（文件零改动；新发射点经同一单点，EM-C5a/b 绿） |
| 缝四控制信号 | `close`/`terminateUnauthorized`/`settled`/`closed` 不增不改 | ADR 0032:18；`hub-split.ts` | **保持**（仅 `sendDataFrame` 追加可选纯 JSON 参数） |
| 公共 API 面 | `src/index.ts`/`src/testing.ts`、edge/session 工厂签名 | ADR 0032:43；模块 AGENTS | **保持**（两文件零改动；`HubSendAccounting` 内部纯类型） |
| listen 模式行为 | 事件序列与拆分前逐字一致 | ADR 0032:4；EM-C7a/b 金标 | **保持**（代码面次序论证落码 + 金标绿；SA3 包级 717 tests 全绿） |
| peer 侧发射面 | peer `update-sent{side:'peer'}` / chunked 族发射点原样 | ADR 0032:4/44 | **保持**（`peer-namespace.ts`/`peer-connection.ts` 零改动；共享 UpdateChannel 的采样点前移对 peer 同栈恒等——见 §6 注记 2） |
| listen 计数口径 | `maxConcurrentAssembliesPerConnection` = per-connection | 协议 §17:581；EM-C6a/b | **保持**（运行时零改动；:581 原行零触碰，注记为 :582 新增行） |
| ADR 0032 决策区文本 | 决策 1–5 与否决备选原文 | ADR 0032:10-37 | **保持**（唯一 hunk `@@ -44,0 +45 @@` 在后果节尾部） |

## 6. Evolution requirements

**无 evolution-required 项**。全部规范文档触碰均为已接受 ADR 0032 既定语义的**落文**（决策 5 明文），
非契约变更；内部缝签名为 append-only 可选参数（结构化类型兼容）。故无修订文件/新旧语义/迁移/失败
语义/版本计划要求。

登记性注记（非阻塞，承接设计复查 §6 并增补一条）：

1. **CONTEXT.md「路由键契约」词条作用域**（承设计复查同款登记）：本次 egress 面定偏移判定扩展了
   UPDATE 载荷 varUint 长度前缀的布局依赖；词条本身界定为「edge 帧 demux 依赖」，egress 判定不在
   其域内，词条无需演进。ADR 决策 4 的「同步维护契约 + 结构性守卫测试」机制已承接（守卫测试交付），
   且 §23.1 注记 + ADR 后果注记已登记布局依赖。若后续评审认为应并入词条，属 CONTEXT.md 一行
   append（新票可办，非本票义务）。
2. **共享 `UpdateChannel` 的采样点前移对 peer 侧同样生效**：`sentAt` 采样点（发送调用边界）位于
   hub/peer 共用的 `sendAndRegister`；§23.1 注记仅以 hub 拆分语境文档化该采样点。peer 侧
   `update-sent{sendQueueMs}` 值语义不变（同一同步栈、同一差值公式、`issue238` 精确断言绿），
   冻结文本（§23.1:745「帧实际出队」）仍满足——不构成语义变更；如后续希望 §23.1 注记显式覆盖
   peer 侧采样点表述，属文档措辞 append（新票可办）。

## 7. Hard conflicts

**无。** 逐项复核（含四个最可能候选，实测 diff 证据）：

1. 「§23.1 行被编辑是否违反 append-only」——否：脚本核对原行文本逐字保留为前缀，编辑 = 行尾追加
   注记（设计 §D5 明文「行尾注记」形态；设计复查 DA-7 已裁决该形态为追加注记非字段表编辑）。
2. 「采样点前移是否改写 `sendQueueMs`/`ackLatencyMs` 冻结语义」——否：§23.4:939「帧实际出队发送时刻」
   语义内（发送调用即出队），同一同步栈、发送栈零时钟读（SA2 逐栈核对）⇒ 手动时钟域逐值恒等
   （issue238 精确断言绿佐证）；真实时钟域残差无绝对值断言；采样点已在 §23.1 注记文档化。
3. 「拒帧路径新增时钟读是否违反 §23.4『无 observer = 零时钟调用』」——否：时钟门在 `host.now`
   本身（observer 门折叠链路原样，`hub-namespace.ts:259`/edge `now` 门），无 observer ⇒ `now` 为
   undefined ⇒ 零时钟调用；有 observer 时拒帧路径的额外读数不产生事件、无绝对时间戳入事件。
4. 「edge 与 session 均可发 `namespace-error{sent}` 是否双发」——否：两行归属判据 disjoint（edge =
   未过缝的拒绝/合成路径——无 session 通道；session = 通道 FSM 内协议事实），代码面 EM-C1b/C1c
   锚定恰一，归属表分行列示。

## 8. Required actions

对后续阶段（SA8 不调度、仅登记约束）：

1. **无阻断动作**。本票冲突面全部闭合。
2. 登记性（非本票义务）：§6 注记 1/2 的两处文档措辞 append 留待后续票酌情处理；分片形态运行时锚
   （真正的 worker 进程 / `listen:false` 端到端 + per-session 计数实测）依 SA6 U4 留待 T3(#420)/
   T5(#422)——该两票落地时若引入新决策面，按流程走各自的前置门禁。
3. 根 `pnpm test` 全仓门禁由 Host 按流程执行（SA6 U6；SA3 已跑包级全量 + 根 typecheck）。

## 9. Verdict

**clear**

- 全部对照项为 no-conflict 或 implements-existing-decision（ADR 0032 决策 5 观测面、决策 4 守卫义务、
  §17/§22/§23.1/§23.3 文档义务的兑现）；
- 无 hard-conflict、无 override 依赖、无缺失修订计划的 evolution-required；
- 设计复查 §8 四项 Required actions 与 §10 三项待闭合触发面经逐项实测核对**全部落实**（SA3 §「SA8
  约束落实」自报与本次独立复核结论一致，未见失实）；
- SA6 契约三红（EM-C2a/C4a/C4b）经实现转绿且契约文件零改动（mtime 序 + skip/only/todo 扫描 +
  §12.3 不可软化判据保持）。

## 10. requiresConflictRecheck

**false**。设计复查登记的三项触发面闭合情况：

1. 规范文档编辑纯追加 + 与 ADR 决策 5 逐字一致 —— **已闭合**（§5/§7 hunk 级 + 前缀脚本核对；
   聚合上界公式逐字、缺面口径、发射侧归属表含 U5 形态差异登记全部落地）。
2. 内部缝签名 append（`sendDataFrame` 可选参 + `HubSendAccounting`）—— **已闭合**（append-only、
   公共面零导出、结构化兼容、typecheck exit 0）。
3. 冻结事件形状构造点迁移（`update-sent` 由 edge 构造）—— **已闭合**（键集 ⊆ §23.1、值恒等同点
   派生、EM-C7 金标与 issue238 精确断言绿）。

无公共 API、wire、schema、持久化、状态机、生命周期、失败语义变更，无正式 override；§6 两条登记性
注记与 §8-2 后续票事项均不构成本票的待核对冲突面。
