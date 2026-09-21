# SA8 设计冲突复查报告 — issue #423（observer 发射点拆分与降级口径）

- Reviewed subject: **design**（`wiki/raw/task_issue-423_design.md`，iteration 0 首版）
- 复查时间基线：HEAD `1f5809b`（与设计自报基线一致；工作树仅含本票未跟踪产物）
- 复查人：SA8（conflict-gate skill，2026-09-22）
- 结论速览：**verdict = clear**；对照项 15 项 = 8 × no-conflict + 7 × implements-existing-decision；
  **0 hard-conflict、0 evolution-required、0 override**；`requiresConflictRecheck = true`（见 §10）。

---

## 1. Reviewed subject

`wiki/raw/task_issue-423_design.md`（SA1 实现设计）。两缺口：A = 工厂形态拒绝路径两事件缺
`connectionId`（Bug）；B = `update-sent` hub 侧发射点由 session 迁 edge（Feature，ADR 0032 决策 5
观测面）。本报告只裁决设计行为与既有决策集的一致性，不评设计优劣（SA2 域）、不判实现质量。

SA2 review：**不存在**（`task_issue-423_sa2_review.md` 无；设计 §14 自报一致）。前置门禁 SA8 产物
（`_relevant_decisions.md` / `_conflict_report.md`）：**不存在**——本次设计复查以全量决策集直接对照
（skill「缺 SA8 ⇒ 读取相关 ADR 并标记设计后冲突复查」纪律；设计 §6 已自行登记同一约束面）。

## 2. Inputs and decision set

| 输入 | 状态 |
|---|---|
| `docs/adr/` 全部 31 份 ADR | 逐一扫描状态；无 superseded 指向 0032；编号 0031 缺位（历史空号，无影响） |
| `docs/adr/0032-transport-decoupling-edge-session-split.md` | **已接受**（2026-09-21；wire 零变化、listen 逐字节不变、peer 不拆分）——本设计的目标 ADR |
| `docs/adr/0010-hub-peer-websocket-ydoc-replication.md` | 架构权威；未对 `update-sent` 规定发射侧（grep 零命中），无预先指派冲突 |
| `docs/protocols/instance-replication-v1.md` §17 / §22 / §23（23.1–23.7） | 规范协议；§23.1 36 型字段表、§23.2 稳定码、§23.3 safe-field、§23.4 隔离与时钟为冻结面 |
| `CONTEXT.md` 术语：复制 Edge / SessionHost / 路由键契约 / 实现代际 | 术语面核对（见 DA-5 注记） |
| `packages/ws-replication/AGENTS.md` | 模块契约（observer 隔离、公共面经 `src/index.ts`、FSM 不变量） |
| `wiki/raw/task_issue-423_sa6_contract.md` + `artifacts/sa6-issue423-contract-evidence.log` | 上游诊断与验收契约（verdict = approve；3 红 = EM-C2a/C4a/C4b） |
| Owner 要求 | **无**（issue #423 comments = 0；Host 简报明文 + SA6 §2 `gh` 复核一致） |
| 源码事实核对 | 设计 §2 全部锚点逐条复核为真（`hub-edge-host.ts:597-635/684-693/775-790/898-910`、`hub-edge.ts:213-249/430-445/553-567`、`hub-split.ts:69-96`、`frame-io.ts:183-197`、`observer.ts:36-46/110-117`、`update-channel.ts:319-371`、`hub-namespace.ts:1324-1405`、`hub-session.ts:205-258`、`peer-namespace.ts:1541-1577`、`replication-protocol` envelope/messages 布局）——未发现设计与 HEAD 源码矛盾 |

## 3. Decision analysis

| # | Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| DA-1 | ADR 0032 决策 5 | 「observer 发射点 = 拥有事实的一侧（连接域与出站 sequence 事件在 edge，namespace 域事件在 session）」（:30） | §D2：`update-sent` hub 侧发射点迁至 edge 连接级 data 帧出面（`port.sendDataFrame` 包装，`seq>0` 门 + 型门）；§D4.1：session 非 chunked 分支抑制；恰一由单漏斗结构保证 | **implements-existing-decision** | ADR 0032:30；现状偏离 = `hub-namespace.ts:1375-1405`（session 发射）+ SA6 实测 A1（工厂形态 edge 零事件）；单漏斗事实核verified：hub 全部 data 帧经 `port.sendDataFrame`（`hub-session.ts:210-216/220-254`、`hub-edge-host.ts:684-693`；消息形态 `tryEmitData` 仅 peer） | 无（本票即兑现义务） |
| DA-2 | ADR 0032 决策 5 | 「事件字段集 append-only 不变」（:30） | 零新事件型/字段/错误码；`types.ts` 在 DENY LIST；edge 构造体键集 = {type, side, connectionId?, namespaceId, bytes, sequence, sendQueueMs?} ⊆ §23.1 `update-sent` 行 | **no-conflict** | 协议 §23.1:743；§23 preamble「只增不改；GA 后字段语义冻结」；设计 §8 接口变化全集核对（零公共 API、零 wire、零词表变化） | 无 |
| DA-3 | ADR 0032 决策 5 | 缺面 dormant 纪律平移 + `maxConcurrentAssembliesPerConnection` 分片 per-session（聚合上界 = limits × worker 数）、listen 不变（:30） | §D5：协议 §17 + ADR 后果注记登记口径；运行时零改动（EM-C6 回归锚既有）；session shim 缺面字段缺席语义不动（EM-C3 锚既有） | **implements-existing-decision** | ADR 0032:30 已决策、协议 §17:581 现文只登记 per-connection 口径 ⇒ 文档面义务未兑现；本设计补齐（追加注记，不改 581 行语义） | 实现期核对 §17 注记为纯追加 |
| DA-4 | ADR 0032 决策 2 | 「缝只过 `Uint8Array` 帧与纯 JSON」；四控制信号；连接级帧不上缝（:18） | §D3：`HubSessionEdgePort.sendDataFrame` 追加可选参数 `accounting?: {sendQueueMs?: number}`——纯 JSON、有限数值差值、append-only、内部缝不上公共面；零新控制信号、零帧形态变化 | **no-conflict** | ADR 0032:18（缝内容物 = 帧 + 纯 JSON，accounting 属后者）；ADR 0032:43「公开面……演进只能 append-only」（`hub-split.ts` 不进 `index.ts`/`testing.ts`——grep 核实零导出）；可选参数结构化类型兼容（`update-channel.ts:25`、`hub-namespace.ts:64`、peer 实现 `peer-namespace.ts:294` 少参兼容） | 无（缝签名 append 已列入实现复查清单，见 §10） |
| DA-5 | ADR 0032 决策 4 | 「edge 定偏移只读提取，不解析 payload……提取成本 O(帧头)」「路由键布局与 codec 字段序登记为同步维护契约，codec 侧加结构性守卫测试」（:26） | §D2.3：`bytes`/`namespaceId`/型判定 = 定偏移只读（`[5]` 型、`[21,56)` id 窗口、`[56..61)` varUint 长度前缀 ≤5 字节）+ 长度交叉校验 + 新增守卫测试（ALLOW LIST） | **no-conflict**（附登记义务） | 读取成本与 payload 大小无关（≤5 字节定偏移，零分配零解码——弱于同条款已接纳的 ERROR「几十字节有界 mini-decode」例外）；同步维护契约按其注册机制扩展（新守卫测试锚定 varUint 1/2/3 字节边界 vs `decodeMessage`）；§23.1/ADR 后果注记登记（D5） | 实现期确认守卫测试落位 + 布局依赖在 §23.1 注记中文档化 |
| DA-6 | ADR 0032 状态/后果 | 「wire 格式与协议语义零变化，listen 模式行为逐字节不变」「peer 侧不拆分」（:4、:44） | 非目标明示：peer 发射点原样（`peer-namespace.ts:1541-1577` 零改动）；listen 组合形态事件键集与次序逐字不变（§D2.5 同步栈论证 + §D3.4 键集论证 + EM-C7 金标）；`replication-protocol/**` 在 DENY LIST | **no-conflict** | ADR 0032:4/44；`sendQueueMs` 值恒等论证核verified（发送栈 `hub-session.sendData → port.sendDataFrame → tryEmitDataFrame → emitOne → transport.send` 零时钟读；`issue238-segmented-observation:244-245` 精确断言 `[0, 4_000]` 在手动时钟域逐值保持） | 无 |
| DA-7 | 协议 §23 preamble + §23.1 | seam append-only：类型/词表/稳定码只增不改，GA 后字段语义冻结 | §D5 对 §23.1 只**追加注记**（`update-sent` 行尾发射点/缺面注记 + 表组后「发射侧归属表」小节）与 §22 资产锚；字段表零编辑；「发射侧归属表」描述内部分工（edge/session），不触碰 `side`（hub/peer）语义 | **no-conflict** | 协议 §23:713-716；§23.1 表（722-755）；设计 §11 ALLOW LIST（文档三处均为追加） | 实现期逐字核对为纯追加 |
| DA-8 | 协议 §23.1 `update-sent` 行 | `bytes`（出站 UPDATE 载荷长度；合并帧报合并后长度）、`sequence`（出站帧 envelope sequence，恒在场）、`sendQueueMs?`（帧实际出队 − 帧内最旧业务项入队；clock 注入时在场） | §D2.1：`bytes` = 帧内 varUint `updateLen`（≡ 既有实现的 update 内容长度）、`sequence` = `[8..12]`、`sendQueueMs` 仅 accounting 在场时携带；宿主直驱帧整键缺席（缺面） | **no-conflict** | 冻结值语义三方一致核verified：现实现 `update-channel.ts:346-371` 发射 `bytes: bytes.byteLength`（`bytes` = `update` 内容，经 `hub-namespace.sendUpdateFrame → host.sendData(nsId, bytes) → encodePlaceholder({kind:'UPDATE', update: bytes})`）；conformance 锚 `observer-red.test.ts:365-380`（`frameBytes` = `decoded.message.update.byteLength`）与 `issue238-segmented-observation:238-243` 同口径；§23.1 同族姊妹行（快照长度/diff 载荷长度）同为内容语义。宿主直驱帧 `sendQueueMs` 缺席 = 记账事实缺面（§23.1「帧内最旧业务项入队」不存在），与 AC2 同纪律并在 §23.1 注记中登记——非字段语义变更 | 无（值恒等已在设计中论证并在实现复查复验） |
| DA-9 | 协议 §23.3 safe-field | `connectionId` 为 §6.2 受控 observability id：「握手完成前字段不存在」（反向 = 完成后在场）；事件树禁二进制/Error/异常原文 | §D1：三发射点（`emitNamespaceErrorSent`/`emitNamespaceFailed`/`synthesizeStateViolation`，均在 HELLO 门后）统一 `cidField(port.connectionId())` 条件展开——补齐工厂形态在场纪律；值 = `connectionIdValue` = `connectionKey` 同串 | **implements-existing-decision** | 协议 §23.3:849-850；缺口实测 = `hub-edge-host.ts:597-635` 三构造点无 `connectionId` 成员（本次源码复核确认）；单体同协议路径已在场（`hub-namespace.ts:483-503` 经 `cidField`）；edge 自身 R-none 合成已在场（`hub-edge.ts:570-586`）——host 适配器复刻面是唯一漏点，即 #421 已交付面的字段缺口；pre-connection `auth-upgrade-rejected` 无该键是 §23.1/§23.3 文档化形态（:770），设计明确不动（EM-C2c 负控） | 无 |
| DA-10 | 协议 §23.4 隔离与时钟 | 回调同步投递；throw 隔离；「事件在决策已落定之后发射」；缺 clock = latency 整键缺失；无 observer = 零事件构造/零字段读取/零时钟调用；绝对时间戳不入事件；跨侧减法仅近似 | §D2.1 首行 observer 门（判定亦不执行）；发射在 `tryEmitDataFrame` 返回 `seq>0` 后（帧已实际出站）；`dispatchReplicationObserver` 单点零改动（DENY）；§D3.2 缝传**差值**非绝对时间戳、session 时钟域纯净（`port.now` observer 门折叠）；clock-throw 折叠链路原样 | **no-conflict** | 协议 §23.4:900-953；`observer.ts:36-46`（单点）/`110-117`（cidField）；`hub-edge.ts:245-249`（`now` 门）；`sentAt` 采样点前移仍在同一同步栈（§23.1「帧实际出队」语义内，手动时钟域逐值恒等、真实域微秒残差无绝对值断言）——不构成语义变更，采样点变化在 §23.1 注记中文档化 | 无 |
| DA-11 | 协议 §17 `maxConcurrentAssembliesPerConnection` 条目 | 连接级每入站方向并发 assembly 上界（:581，现文仅 per-connection 口径） | §D5：条目追加分片形态注记（per-session 计数、聚合上界 = 本值 × worker 数、listen 保持 per-connection、口径差异源自缝跨进程化）；运行时与 EM-C6a/b 回归锚零改动 | **implements-existing-decision** | ADR 0032 决策 5 已定该口径（:30），协议文本尚未对齐 ⇒ 兑现文档义务；`docs/AGENTS.md`「行为变化的规范文档同步」纪律（此处运行时零变化，注记为 ADR 既定语义落文） | 实现期核对注记与 ADR 文本一致（聚合上界公式逐字） |
| DA-12 | 协议 §22 conformance 资产锚 | 每票交付物登记惯例（:699-702 先例） | §D5：追加 #423 契约文件资产锚 | **no-conflict** | §22:702 先例（#301 同款登记） | 无 |
| DA-13 | 任务简报 What-to-build / SA6 U1 | 「依赖盖章后 sequence 的出站事件（update-sent 族）」由 edge 发射；「update-acked{sequence} 关联入站 sequence、留在 session」 | §D4.2 作用域裁决 = 仅 `update-sent`：family 内唯一携 `sequence` 键者；`chunked-update-sent`（DD1 键集冻结：无 sequence/sendQueueMs）、`bootstrap-snapshot-sent`、`sync-step2-sent`（均无 sequence 键）不迁，结算事实在 session | **no-conflict** | §23.1 键集事实核verified（739/741/747 三行均无 sequence 键；743 唯一携带）；归属判据与 ADR 决策 5「出站 sequence 事件在 edge / namespace 域事件在 session」同读；`update-acked` 留 session 与简报明文一致；R21 改道保持（chunked 族仍由 session 在末 chunk 结算恰一发射，UPDATE_CHUNK 0x42 被 edge 型门排除 ⇒ 无双发） | 无（若后续裁决全域搬迁属 append-only 新票——设计同判） |
| DA-14 | `packages/ws-replication/AGENTS.md` | observer/adapter 失败遵循文档化隔离与关闭分类；生产 API 经 `src/index.ts`、测试面经显式 testing surface | 隔离单点零改动；`index.ts`/`testing.ts` 在 DENY LIST；`HubSendAccounting` 纯内部类型（`hub-split.ts`，模块头明示「不导出任何运行时值/绝不进 src/index.ts」） | **no-conflict** | 模块 AGENTS「Boundaries」；grep 核实 `index.ts`/`testing.ts` 零 `hub-split` 导出 | 无 |
| DA-15 | `docs/AGENTS.md` ADR 修订纪律 | 「Amend or supersede prior decisions explicitly instead of silently contradicting them」 | §D5 对 ADR 0032 只在「后果」节**追加实现注记**（决策 5 观测面已落地 + 口径登记指针），决策 1–5 与否决备选原文零改动、无静默矛盾 | **no-conflict** | ADR 0032 全文（决策区 :10-37 与注记区 :39-44 分离）；设计 §11 ALLOW LIST（「后果」节实现注记） | 实现期核对 ADR 编辑不触决策区 |

**裁决分布**：no-conflict × 8（DA-2/4/5/6/7/8/10/12/13/14/15 中计 8 项主裁决）+ implements-existing-decision × 7（DA-1/3/9/11 及其复合项）——逐行见表；**hard-conflict × 0；evolution-required × 0**。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| ——（无） | —— | —— | —— |

无合法 override 亦无所需 override：owner 评论为空（issue #423 comments = 0）；无新 ADR 修订/废弃旧 ADR；
无协议版本升级。设计的全部行为要么直接实现 ADR 0032 既有决策，要么是 append-only 扩展——**不依赖任何
override 成立**。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（设计面） |
|---|---|---|---|
| wire 帧格式 | envelope 布局（magic/version/type/[8..12] sequence/[12..16] payloadLength/头 20B）与全部消息编码 | 协议 §3/§5；`envelope.ts:172-186`、`constants.ts:14-18` | 保持（`replication-protocol/**` DENY；`MESSAGE_TYPES` 只读消费） |
| §23.1 事件词表与字段表 | 36 型、逐型 required/optional 键集、字段语义（GA 后冻结、append-only） | 协议 §23.1:718-755、§23 preamble | 保持（零编辑；仅行尾/表组后追加注记——待实现逐字核对） |
| §23.2 稳定码闭联合 | 连接域/namespace 域/schema-rearm 三闭联合 | 协议 §23.2 | 保持（零触碰） |
| `update-sent` 值语义 | `bytes` = UPDATE 载荷（update 内容）长度、`sequence` = `[8..12]`、`sendQueueMs?` 差值语义 | §23.1:743；`observer-red.test.ts:365-380,477-497`；`issue238-segmented-observation:238-245` | 设计逐项保持（D2.1/D3.4 值恒等论证成立） |
| observer 隔离单点 | `dispatchReplicationObserver` try/catch 静默隔离、绝不改变协议结果 | §23.4:900-901；`observer.ts:36-46` | 保持（DENY LIST；EM-C5 锚） |
| 缝四控制信号 | `close`/`terminateUnauthorized`/`settled`/`closed` 不增不改 | ADR 0032:18；`hub-split.ts:7-22` | 保持（仅既有调用追加可选纯 JSON 参数） |
| 公共 API 面 | `src/index.ts`/`src/testing.ts`、edge/session 工厂与服务签名 | ADR 0032:43；模块 AGENTS | 保持（DENY LIST；`HubSendAccounting` 内部） |
| listen 模式行为 | 事件序列与拆分前逐字一致（键集/次序/无重复） | ADR 0032:4；EM-C7 金标；AC6 | 设计承诺保持（D2.5/D3.4；实现后由 EM-C7 复验） |
| peer 侧发射面 | peer `update-sent{side:'peer'}` / chunked 族发射点原样 | ADR 0032:4/44 | 保持（`peer-namespace.ts`/`peer-connection.ts` DENY） |
| listen 计数口径 | `maxConcurrentAssembliesPerConnection` = per-connection（limits 键驱动） | 协议 §17:581；EM-C6a/b | 保持（运行时零改动；仅文档追加分片注记） |
| ADR 0032 决策区文本 | 决策 1–5 与否决备选原文 | ADR 0032:10-37 | 保持（仅「后果」节追加注记——待实现核对） |

## 6. Evolution requirements

**无 evolution-required 项**。理由：设计的全部规范文档触碰（协议 §17/§22/§23.1、ADR 0032 后果节）
均为**已接受 ADR 0032 既定语义的落文**（决策 5 明文），非契约变更；内部缝签名为 append-only 可选参数，
不改变既有调用契约（结构化类型兼容，peer/测试桩零改动）。故无「修订文件/新旧语义/迁移/失败语义/版本」
计划要求。

登记性注记（非阻塞）：DA-5 的定偏移判定将布局依赖从「路由键契约」已登记的 id 窗口扩展到 UPDATE 载荷
varUint 长度前缀。CONTEXT.md「路由键契约」词条的作用域是 **edge 帧 demux** 依赖（本次判定在 egress 面、
非 demux），词条本身无需演进；ADR 决策 4 的「布局与 codec 字段序同步维护契约」按其注册机制（守卫测试）
承接扩展，且设计已计划在 §23.1 注记 + ADR 后果注记中文档化——该登记动作列入实现复查清单。若评审后续
认为 egress 判定应并入「路由键契约」词条，属 CONTEXT.md 一行 append（新票可办，非本票义务）。

## 7. Hard conflicts

**无。** 逐项复核（含四个最可能的候选）：

1. 「发射点迁移是否违反 §23.1 现行字段/发射语义」——否：§23.1 只定义事件与字段，发射侧归属由
   ADR 0032 决策 5 规定为 edge；现状 session 发射才是偏离。
2. 「edge 定偏移读 varUint 是否违反决策 4『不解析 payload』」——否：≤5 字节定偏移只读、零分配零解码、
   成本与 payload 大小无关；严格弱于同条款已接纳的 ERROR 有界 mini-decode 例外；且按注册的同步维护
   契约机制加守卫测试并在规范文档登记。
3. 「缝追加 accounting 参数是否违反决策 2『缝只过 Uint8Array 帧 + 纯 JSON』」——否：`{sendQueueMs?}`
   即纯 JSON；四控制信号与帧形态零变化；公共面零变化（append-only 纪律满足）。
4. 「宿主直驱帧 `sendQueueMs` 缺席是否违反 §23.1『clock 注入时在场』」——否：该行前提是帧经过发送方
   update 队列（「帧内最旧业务项入队」）；宿主直驱帧无此事实，属缺面 dormant（§23.4/AC2 同纪律），
   设计以 §23.1 注记显式登记该降级口径——append-only 文档化，非语义改写。

## 8. Required actions

对实现/后续阶段（SA8 不调度、仅登记约束）：

1. **文档面**：§17/§23.1/§22 与 ADR 0032 后果节的编辑必须严格按 §D5 为**纯追加**——§23.1 字段表逐行
   零改动、ADR 决策区零改动；`git diff` 逐字核对。
2. **缝签名**：`HubSendAccounting` 保持内部（`hub-split.ts`），不得进 `index.ts`/`testing.ts`；
   可选参数形状不得收窄为必填（存量单参实现/桩必须继续类型兼容）。
3. **DENY LIST**：`observer.ts`/`frame-io.ts`/`types.ts`/`hub-connection.ts`/peer 面/契约测试文件
   零改动；SA6 契约不得软化（3 红须经实现转绿）。
4. **实现后复查面**（见 §10 清单）：`update-sent` 键集/值恒等、EM-C7 金标、§23.3 在场纪律、公共面零变化。

## 9. Verdict

**clear**

- 全部对照项为 no-conflict 或 implements-existing-decision（ADR 0032 决策 5 观测面义务的兑现）；
- 无 hard-conflict、无 override 依赖、无缺失修订计划的 evolution-required；
- 设计对约束面的自行承接（§6 表）与本次独立复核结论一致；其源码锚点经逐条核对无失实。

## 10. requiresConflictRecheck

**true**。触发面（实现核对完成后闭合）：

1. 规范文档编辑（协议 §17/§22/§23.1、ADR 0032 后果节）尚待落地——须核对为纯追加、与 ADR 决策 5 文本
   逐字一致（聚合上界公式、缺面口径、发射侧归属表含 U5 形态差异登记）。
2. 内部缝签名 append（`sendDataFrame` 可选参数 + `HubSendAccounting`）尚待落地——须核对 append-only
   与公共面零导出。
3. 冻结事件形状的构造点迁移（`update-sent` 由 edge 构造）尚待落地——须核对键集 ⊆ §23.1、值恒等
   （`bytes`/`sequence`/`sendQueueMs` 两态）、listen 金标 EM-C7 与 `issue238` 精确差值断言保持绿。

无 wire/schema/持久化/状态机/生命周期/失败语义变更（D6 防御分支遵循 §23.4 观测面隔离纪律，非新失败
语义）；无公共 API 变更——上述三项闭合后，实现期复查即可将本标记降为 false。
