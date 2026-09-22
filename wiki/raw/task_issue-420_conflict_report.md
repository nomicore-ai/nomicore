# SA8 Conflict Report — issue #420（task 前置门禁 + SA6 验收契约冲突裁决）

Iteration 0 · dispatch `sa-a967a179-2cd6-499b-8253-f3e285c8f51a`（role mabf-sa8，phase conflict-gate）· HEAD `7039f6dae8e7d29f0c929492f0ca2119bc63afaa`。

## 1. Reviewed subject: task

任务简报 `wiki/raw/task_issue-420.md`（ADR 0032 决策 2/3 的 namespace 半边出面；AC1~AC5；Blocked by #418 已解除）+ **已批准 SA6 验收契约** `wiki/raw/task_issue-420_sa6_contract.md`（§12 冻结公共面/测试路径/断言矩阵/红绿期望/变异敏感性 + `artifacts/sa6-issue420-*` 证据）。派工明文：Owner feedback requirements = none；REST Issue comments = `[]`。本报告为设计前门禁：只裁决任务要求与 SA6 契约是否与既有决策集冲突；不评价设计优劣、不实现、不调度其他 SA。

## 2. Inputs and decision set

- 决策集（本轮全量读取/识别状态）：`docs/adr/0001`~`0032` 全部 **accepted**，无 superseded；本次相关 = **ADR 0032**（逐条）、ADR 0010、ADR 0012、ADR 0013/0022（分块，仅路由键关联）、`CONTEXT.md:225-235` 三词条、`docs/protocols/instance-replication-v1.md`（§4/§7.1/§8-11/§13/§14/§17/§19/§23.1）、`packages/ws-replication/AGENTS.md`、`docs/AGENTS.md`。
- 跨票义务账：`wiki/raw/task_issue-418_implementation_conflict_report.md` §8（R4''/R5''/R7''/R8''）、`task_issue-418_design_conflict_report.md`（注 A/注 C'/§6 附录要素清单）、`task_issue-418_sa10_spec.md` §5。
- 代码事实（确认用，非决策源）：`hub-split.ts`（17 成员 port + sink 面）、`hub-session.ts`、`hub-edge.ts`、`hub-namespace.ts:76,662,1099`、`index.ts`（11 运行时导出）、SA6 证据 `artifacts/sa6-issue420-*`（10 项日志/探针，本轮抽查关键结论与源码锚一致）。
- 缺失输入：无（本报告即补齐 `task_issue-420_relevant_decisions.md` 与本文件——SA6 §1 已登记该缺失且不阻断）。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（简报/SA6 契约） | Classification | Evidence | Required action |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ADR 0032 决策 1（单份 FSM、两半皆 nomicore、宿主自写连接级半边 = fork 否决） | :14 | shim 装配 = 真 `createHubReplicationEdge` + 公共 `createHubSessionHost` + 真 Registry/Runtime；AC3 要求 7 文件矩阵断言逐字不变重跑 + `hub-namespace.ts` 零 diff | **implements-existing-decision**（公共 session 工厂 = 决策 1 拆分的 namespace 半边出面；无第二份状态机） | ADR 0032:14；契约 §12.2/§12.3「零 fork（必需）」；`hub-split.ts:1-22` | 无（design/impl 复查核对零 diff） |
| 2 | ADR 0032 决策 2（缝只过 `Uint8Array` 帧与纯 JSON；零 worker 依赖/类型） | :18 | AC4/§12.4：C4a 结构门（0 命中，须保持）+ C4b 描述子 `structuredClone` 深等 + C4c 帧即字节 + C4d 无 live 对象过缝 | **implements-existing-decision**（把 #418 的进程内「已解码消息」缝升格为 ADR 字面的字节缝公共面——即 R5'' 所指形态变化的兑现） | ADR 0032:18；CONTEXT.md:229-231；契约 §12.4、`seam-purity-gate-probe.log` | R5'' 门禁由本报告 + 后续 design/impl 复查承接 |
| 3 | ADR 0032 决策 2（缝上只有 namespace 域帧；连接级帧从不上缝） | :18 | A3：`handleFrame` 观察到的 kind 全集 ⊆ namespace 域；无 HELLO/HELLO_ACK/GOAWAY/方向域帧 | **implements-existing-decision** | ADR 0032:18；CONTEXT.md:226；`hub-split.ts:9-11` | 无 |
| 4 | ADR 0032 决策 2（入站 sequence 由 edge 校验 header-only；session 不重检） | :18 | AC5/§12.5：C5a 行为正锚（回退序仍被消费、回帧携带该序）、C5b edge 负控、C5c 结构门（解码不含 `expectedSequence`）、C5d 变异 M5 | **implements-existing-decision**（AC5 = CONTEXT「SessionHost」_Avoid_ 首项的公共面锚定） | ADR 0032:18；CONTEXT.md:231；协议 §4（:23「对端严格按期望值接收」在 edge）；`sequence-discipline-probe.log`；`hub-split.ts:110-112`（wire 序记账需要） | 无 |
| 5 | ADR 0032 决策 2（出站 sequence=0 占位 + edge mux 盖章；缝无接纳信号，fire-and-forget） | :18 + :36（否决「缝携带接纳信号 sent/deferred/rejected」） | `onFrame(listener: (frame, lane) => number)`：出站占位编码；**listener 返回被分配 wire 序（0=未发送/被拒）**，session 侧以之作发送记账（E1 证承重） | **implements-existing-decision**（返回序 = 既有内部缝 `sendControlFrame/sendDataFrame(frame): number`「返回 edge 盖章后的 wire 序；0 = 未发送/被拒」的公共面同构搬运；协议 §23.1 `resync-required{send-failed, reason:send-frame-rejected}` =「发送路径返回非正 sequence」为规范锚——它是盖章结果回执，非被否决的逐帧背压接纳信号；有界性仍由宿主传输 + 1011 兜底） | ADR 0032:18,:36；`hub-split.ts:66-71`；协议 §23.1（:771）；契约 §9 E1、§12.1 onFrame | 同步宿主 pipe 范围限定（U2：真 worker 异步形态另行过 SA8） |
| 6 | ADR 0032 决策 2（**四个控制信号**：edge→session `close`/`terminateUnauthorized`；session→edge `settled`/`closed`） | :18 | §12.1 公共面：close/terminateUnauthorized = 句柄方法 ✓、settled = `onSignal` ✓、closed = `close()` promise ✓；**新增 `HubSessionSignal` 成员 `connection-fatal`（JSON 信号）** | **evolution-required**（`connection-fatal` 是 ADR 枚举之外的 session→edge 控制信号公共面化；行为本身自 HEAD 在场（`hub-namespace.ts:76,662,1099` 通道→连接收口）且 #418 已随 17 成员 port 迁移（`hub-split.ts:80-81`，SA8 #418 裁为逐名迁移面）——方向合法、无 fork、零 wire 变化，但决策 2 的信号枚举文本不再如实描述公共缝词汇，且该面一经 test-d 锁定即 append-only 冻结 ⇒ 须与 R7''/R8'' 附录同变更集正式登记） | ADR 0032:18；`hub-split.ts:80-81`；`hub-namespace.ts:662,1099`；`hub-edge.ts:222`；契约 §12.1「SA6 追加项声明」②、§3 S6 | 见 §6/E1（附录要素扩一项：信号词汇） |
| 7 | ADR 0032 决策 3（authorize 在 edge、OPEN 全解码、投影「仍传入，语义是 edge 授权结果的传递」） | :20-22 + :35（否决备选自文） | `HubSessionOpenInput.authorization: Extract<NamespaceAuthorization,{ok:true}>`——edge 已结算 ok-投影经 `open()` 描述子传入；A4：authorize 恰一次且在 edge（`run.authorizer.calls.length===1`）+ session 结构性无授权器（test-d 负控禁 `authorize`/`transport`/`port` 键） | **implements-existing-decision**（公共带外描述子 = :35「投影仍传入」的字面兑现，语义即「edge 授权结果的传递」） | ADR 0032:20-22,:35；协议 §7.1（:172「先 authorization，再…Registry open」）+ §19；契约 §12.1 open/test-d 2 | 无 |
| 8 | ADR 0032 决策 3 **机制句**（「未授权 OPEN 不过缝，edge 复现 `NAMESPACE_UNAUTHORIZED`…」）+ CONTEXT.md:230（「消费 edge 传入的预授权投影」） | :22；CONTEXT.md:230 | 契约不预决 U3：拒绝路径归属二选一（(i) edge 处置=机制句字面；(ii) session 回放已结算 admission=#418 现状）；两选项下 deny 断言（`NAMESPACE_UNAUTHORIZED` ×1、authorize 恰一次、注册表零打开）必须保持绿 | **evolution-required**（R7''/R8'' 文本调和义务的 deadline 落在本门禁：机制句/词条措辞与「拉取式 + 结局前过缝（内部缝）+ ok-投影描述子（公共面）」的已实现/将实现形态差距，须在本变更集（或先行 documentation-only PR）正式落 ADR 0032 修订/澄清附录 + CONTEXT.md:230 措辞更新；此前任何票不得援引机制句字面迫使回退——契约 S3/U6 同口径，未违反） | ADR 0032:22；CONTEXT.md:230；`task_issue-418_design_conflict_report.md` 注 C'/§6（附录要素清单）、§8-R7'；`task_issue-418_implementation_conflict_report.md` §8-R7''；契约 §3 S3、§15 U3/U6 | 见 §6/E2 |
| 9 | ADR 0032 决策 3（OPEN 准入管线：pending 有界缓冲、并发 OPEN 上界、drain 门——edge 规范职责）+ `ws-replication/AGENTS.md`:14 | :22 | S2：跨缝 pending 窗口定为**宿主桥**职责，有界 + 顺序保真，禁无界缓冲 | **implements-existing-decision**（R4'' 重入条件下的义务兑现承诺；实现后须核对有界性事实） | ADR 0032:22；AGENTS.md:14；契约 §3 S2 | impl 复查核对 |
| 10 | ADR 0032 决策 4（路由键契约：定偏移 + OPEN 全解码 + codec 守卫） | :26 | 本票零触碰 edge demux/路由与 #419 守卫测试；夹具只搬运（E3：14 帧 `encode(decode(frame),{sequence})` 逐字节相等）；OPEN 中继序为桥合成值（协议无消费者，已登记） | **no-conflict** | ADR 0032:26；CONTEXT.md:233-235；契约 §9 E3、§12.3「零 fork」 | 无 |
| 11 | ADR 0032 决策 5（dormant 降级：水位闸门/休眠、`bufferedAmount` 缺席、assembly per-session、observer 发射点=拥有事实的一侧；事件字段集 append-only） | :30 | S4：water gate dormant(true)、`bufferedAmount` 缺席、assembly 槽 per-session、namespace 域 observer 由工厂配置注入 session 侧；U8：与 listen「暂停」语义差须显式登记，7 文件矩阵不含 backpressure/shed 族 | **implements-existing-decision**（U8 的登记要求并入 §6/E1 附录要素；impl 复查确认 backpressure/shed 家族测试不在 shim 臂静默改语义） | ADR 0032:30；协议 §17（:588 缺面纪律）；契约 §3 S4、§15 U8 | 见 §6/E1(c) |
| 12 | ADR 0032 后果节（公开面一经发布按 SA6 纪律冻结，演进只能 append-only） | :43 | AC1：`src/index.ts` 追加值导出恰 `createHubSessionHost` + 7 类型名；#418 `FROZEN_PRODUCTION_EXPORTS` 追加一行（零删除零重排）；§12.6 之外的既有测试文件不得改动 | **implements-existing-decision** | ADR 0032:43；`index.ts`（现 11 运行时名，本轮核对）；契约 §12.1/§12.6 | 无 |
| 13 | ADR 0032 后果节（SessionHost 双轨：工厂 + 免 listen 插件服务 `nomicoreHubSessionHost`） | :41-42 | 本票只做工厂轨；`listen:false` 插件/服务轨为 non-goal（与 #418 SA10 §9 行 4 留白一致） | **no-conflict** | ADR 0032:30,:41-42；契约 §10「调用方影响/非目标」 | 无 |
| 14 | CONTEXT.md「复制 Edge」（:225-227） | 职责清单 + _Avoid_ 三项 | 夹具用真 edge（宿主不自写连接级半边）；`accept/acceptTrusted` 为宿主职责（verifyToken→identity）；edge 不解码 OPEN/ERROR 以外 payload | **no-conflict** | CONTEXT.md:225-227；契约 §12.2 装配 | 无 |
| 15 | CONTEXT.md「SessionHost」（:229-231） | 正向描述 + _Avoid_ 四项 | _Avoid_ 四项逐条被 AC5/AC4/A3/drain-in-edge 承接；「消费 edge 传入的预授权投影」在公共描述子上字面成立、在内部桥仍为拉取式（#418 形态） | **no-conflict**（措辞差距 → 行 8 的 evolution-required，不重复计） | CONTEXT.md:229-231；契约 §12.1/§12.2 | 见 §6/E2 |
| 16 | CONTEXT.md「路由键契约」（:233-235） | 定偏移事实集 | 零触碰 | **no-conflict** | CONTEXT.md:233-235 | 无 |
| 17 | 协议 §4（连接序号：正常帧从 1 严格递增；每方向独立） | :16,:23,:57 | A8：wire 帧 `[8..12]` 自 1 严格 +1、无 0 占位泄漏 | **no-conflict**（断言即规范文；缝上占位 0 只存在于出站 session→edge 段——与 C4c「出=占位 0/入=wire 序」一致） | 协议 §4；契约 §12.2 A8、§12.4 C4c | A8 第二分句措辞修正（§8/RA4） |
| 18 | 协议 §7.1（OPEN：先 authorize → 取 local owner → Registry open；不泄露存在性） | :172-176 | A4：OPEN_OK 恰一；描述子换 `PEER_OWNER` → 无 OPEN_OK 且 `NAMESPACE_UNAUTHORIZED`、注册表零打开 | **no-conflict** | 协议 §7.1；契约 §12.2 A4 | 无 |
| 19 | 协议 §8-§11（bootstrap/reconcile/live/CLOSE 的 ackedSequence 回指） | :200-238 等 | A5（BOOTSTRAP_ACK.ackedSequence=快照帧序）、A6（SYNC_STEP1/2/SYNC_APPLIED + 收敛）、A7（UPDATE_ACK 回指、`update-acked`、零 resync）、A9（CLOSE_OK 回指）——全部为既有 wire 行为，零新帧型 | **no-conflict** | 协议 §8-§11、§23.1；契约 §12.2 | 无 |
| 20 | 协议 §13/§14（错误/close 分类注册表，append-only） | :399-425,:460-463 | 零新错误码/close 码：`SEQUENCE_VIOLATION`→1002（C5b）、`ACK_STATE_VIOLATION`→1002（A12/E1）、`CONNECTION_BACKPRESSURE`→1011、`INTERNAL_ERROR`→1011、`NAMESPACE_UNAUTHORIZED`=ns ERROR/failed | **no-conflict** | 协议 §13/§14；契约 §9/§12 | 无 |
| 21 | 协议 §17（背压：水位依赖 `bufferedAmount`，缺面=退化不可观察；1011 终局） | :586-588 | shim 形态 water gate dormant（决策 5 授权降级）；7 文件矩阵不含 issue137/169 族 → 无静默语义改写面（U8 核对项） | **no-conflict** | 协议 §17；ADR 0032:30；契约 §15 U8 | impl 复查确认 |
| 22 | 协议 §19（授权只在 OPEN 检查；revoke → ns 终止 ERROR + cleanup） | :637-652 | A10：`terminateUnauthorized()` → 该 ns 离开 live、零 connection-fatal；无通道 no-op resolve（`hub-session.ts:278-282` 同构） | **no-conflict** | 协议 §19；契约 §12.2 A10 | 无 |
| 23 | 协议 §23.1（事件词汇 36 型 append-only；`update-acked{sequence}`；`send-frame-rejected` 语义） | :718,:745,:771 | 零新事件型；`onFrame` 返回序语义有规范锚（行 5）；namespace 域事件由 session 侧 observer 发射（决策 5） | **no-conflict** | 协议 §23.1；契约 §12.1/§12.2 A7 | observer 隔离语义单点（`dispatchReplicationObserver`）在公共形态不得分叉——design/impl 复查锚 |
| 24 | ADR 0010（复制架构权威：FSM/ACK/收口） | 全文（状态行/决策） | 零 wire/生命周期变化；ACK = sequenced live apply + dirty（A7 口径）；§21 收口权威（A11 drain 断言） | **no-conflict** | ADR 0010；`ws-replication/AGENTS.md`:13,:17 | 无 |
| 25 | ADR 0012（实例身份；HELLO 自报永不为认证证据） | 相关决策句 | `remoteInstanceId` = `edge.authenticatedInstanceId`（edge 认证后身份）；工厂 `instanceId`/timer/limits 由宿主组合根注入 | **no-conflict** | ADR 0012；CONTEXT.md:237-239；契约 §12.1 config | 无 |
| 26 | `packages/ws-replication/AGENTS.md`（生产 API 只经 `src/index.ts`；注入 seam；testing 面纪律） | :18 | §12.0：公共工厂经 `src/index.ts` 追加；桥/夹具只落 `test/`；`src/testing.ts` 零改动；timer 注入（U10） | **no-conflict** | AGENTS.md:18；契约 §3 S5、§12.0、§10 交付面 | 无 |
| 27 | #418 SA8 R2（票内 DENY：两工厂与缝类型不进 `index.ts`/`testing.ts`） | `task_issue-418_design_conflict_report.md` §8-R2 | #420 向 `index.ts` 追加公共导出 | **no-conflict**（R2 为 #418 票内冻结门、已随 #418 实现闭合，非常设仓库决策；#420 导出为 ADR 0032:41-43 规划的工厂轨 + issue AC1 明文） | #418 SA8 设计/实现报告；ADR 0032:43；`task_issue-420.md` AC1 | 无（登记防误读） |
| 28 | #418 SA8 R5''（worker 形态票前置门禁：入站缝形态 + `openAdmission` 拉取形态 + `channels`/`dataFacetOf` 组合成员重塑重新过 SA8） | `task_issue-418_implementation_conflict_report.md` §8-R5'' | 本票把入站缝改为 `Uint8Array` 公共面 + 描述子式 ok-投影传入 ⇒ 触发条件成立；契约 S1/U5 自认并要求实现合入前 SA8 clear | **no-conflict**（义务被承接：本报告 = task 段裁决；design 复查裁 U3/桥形态；impl 复查核对落地） | #418 SA8 报告 §8-R5''；契约 §3 S1、§15 U5/U2 | §8/RA3 |
| 29 | #418 SA8 R7''/R8''（文本调和 deadline + 重触发面） | 同上 §8-R7''/R8'' | ADR/CONTEXT 文本修订须与本票变更集同落（或先行）；本票 diff 将触碰公共面与（若采重命名）内部模块名——不触碰 `hub-namespace.ts`（契约自设零 diff） | **evolution-required**（与行 6/8 合并为 §6/E1/E2 两条修订线；R8'' 重触发面由 impl 复查承接） | #418 SA8 报告 §8-R7''/R8''；`docs/AGENTS.md`（amend explicitly）；契约 §15 U6 | 见 §6 |
| 30 | 内部重命名（`createHubSessionHost`→`createHubSessionSink`、`HubSessionHostConfig`→`HubSessionSinkConfig`、删别名）+ §12.6 授权的两处 #418 测试文件机械编辑 | 决策文本零引用（本轮 grep：`docs/**`/`CONTEXT.md` 对两名零命中）；「sink」为既有词汇（ADR 0032:26「合法无 sink」、CONTEXT.md:226「sink 路由」）；#418 冻结导出表为该票自有产物且追加遵守 append-only | 模块级内部名重塑 + 公共名让位给 ADR 命名的工厂轨 | **no-conflict**（非决策面；U1 已登记回退路径：若不接受重命名，须以等值论证换取且公共面/test-d 不变） | 契约 §10/§12.6/U1；grep 证据（本报告 §2） | 无（impl 复查确认纯机械 + 全量绿） |
| 31 | 契约内部一致性：§12.2 A8 第二分句「`handleFrame` 收到的帧仍带占位 0」 vs §12.4 C4c「入=wire 序」/C5a（回退序 2 须被消费并回显）/E3（中继保真带 wire 序） | 决策集裁定正确读法：决策 2「入站 sequence 由 edge 校验」+ `hub-split.ts:110-112`（`namespaceFrame(message, sequence)` 记账需要 wire 序） ⇒ **入站缝帧携带 wire 序，占位 0 只在出站方向** | A8 第一分句（wire 严格 +1、无占位泄漏）正确；第二分句按字面实现会与 C4c/C5a/A9/E3 及既有记账冲突 | **no-conflict**（对决策集无冲突——两读法中仅 C4c 读法与决策集相容；属可修正的验收措辞笔误，修正方向由决策集唯一确定） | ADR 0032:18；`hub-split.ts:110-112`；契约 §12.2 A8 vs §12.4 C4c、§12.5 C5a、§9 E3 | §8/RA4（design 前修正措辞） |

裁决分布：**no-conflict ×18、implements-existing-decision ×10、evolution-required ×3（行 6/8/29，归并为 §6/E1/E2 两条修订线）、hard-conflict ×0**。

## 4. Overrides

**无。**

| Old decision | Override authority | Scope | New obligation |
| --- | --- | --- | --- |

- 无 Owner 评论（派工明文 none；REST comments `[]`）⇒ 无 Owner 覆盖通道被援引。
- 无新 ADR、无协议版本升级、无决策自含演进条款被触发。
- #418 注 A/注 C′ 为 SA8 解释性裁决（同 ADR 内部位阶 + 进程内范围限定），不是 override；本报告行 5/6/7/8 的裁决同样不创建 override——`connection-fatal` 公共化与机制句措辞差不以 override 消解，而以 **evolution-required**（正式 ADR 修订/澄清附录）消解。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（本票契约对面的态度） |
| --- | --- | --- | --- |
| wire 格式/帧头/消息码/capability | envelope 布局（sequence @ `[8..12]`、正常帧自 1 严格 +1）、`0x01`-`0x42`、`CAP_CHUNKED_UPDATE` | 协议 §4/§5/§6 | 零变化（A8 断言既有不变量；非目标明文排除 wire 变更）——符合 |
| 错误码/close 码注册表 | §13.1 17 码 + §14 映射（SEQUENCE_VIOLATION/ACK_STATE_VIOLATION→1002、CONNECTION_BACKPRESSURE/INTERNAL_ERROR→1011、NAMESPACE_UNAUTHORIZED=ns ERROR/failed） | 协议 §13/§14 | 零新增/零改号——符合 |
| 事件词汇（36 型 + 字段集） | append-only；`update-acked{sequence}`、`resync-required{cause,reason}` 语义 | 协议 §23.1；ADR 0032:30 | 零新事件型——符合 |
| 路由键布局 + codec 字段序 | 同步维护契约 + 结构性守卫测试 | ADR 0032:26；#419 守卫 | 零触碰——符合 |
| `packages/ws-replication/src/hub-namespace.ts` | 逐字节零 diff（R8'' DENY 面） | #418 SA8 §8-R8''；契约 §10「零 diff 要求」 | 契约自设硬门——符合（impl 复查核对） |
| 公共导出面 | #418 `FROZEN_PRODUCTION_EXPORTS`/`FROZEN_TESTING_EXPORTS` append-only；`src/testing.ts` 零改动 | `…issue418-edge-session-split-contract.test.ts:144-156,:551`；AGENTS.md:18 | 恰追加 `createHubSessionHost` 一名 + 7 类型；testing 零改——符合 |
| listen 模式行为 | 逐字节不变（ADR 0032 状态行） | ADR 0032:4 | AC3 listen 臂 52 tests 断言逐字不变重跑——符合 |
| `HubOpenAdmission` 三态/promise 语义、port 17 成员集 | R8'' 重触发面（增删即重过 SA8） | `hub-split.ts:48-99`；#418 SA8 §8-R8'' | 契约复用而非增删（桥为搬运）——符合（impl 复查核对） |
| 决策/规范文本 | `docs/adr/**`、`docs/protocols/**`、`CONTEXT.md` | `docs/AGENTS.md` | **本票须按 §6/E1/E2 落修订/澄清附录**（唯一授权的文本变更，非静默） |

## 6. Evolution requirements

**E1 — ADR 0032 决策 2 缝词汇 + 决策 5 公共面降级登记（修订线一）。**
公共 `HubSessionSignal` 把 `connection-fatal` 正式化为 session→edge JSON 信号（超出决策 2 四信号枚举）；决策 5 的 dormant 降级（water gate true、`bufferedAmount` 缺席、assembly per-session）在公共工厂形态成为对外可观察契约（U8）。修订计划要素核对：

| 要素 | 内容 | 状态 |
| --- | --- | --- |
| 修订文件 | `docs/adr/0032-transport-decoupling-edge-session-split.md`（决策 2 信号枚举句 + 决策 5 补注）+ `CONTEXT.md`「SessionHost」词条（:229-231） | 已指名（#418 SA8 §6 + SA6 U6/U8） |
| 新旧语义 | 旧：四信号枚举（close/terminateUnauthorized/settled/closed）；新：公共面载体映射（方法 ×2 + `onSignal`{settled, connection-fatal} + close() promise）+ `connection-fatal` 自 HEAD 的通道→连接收口路径公共化；dormant 降级词汇 | 已登记（SA6 §12.1 追加项声明 + S4）；**附录文本未落** |
| 兼容与迁移 | wire 逐字节不变；listen 形态零变化；内部 17 成员 port 不增删；公共面 append-only | 已锚（ADR 0032:4,:43） |
| 失败语义 | `connection-fatal{code}` → edge 侧 code→close code 映射（1002/1011 既有注册表）；`onFrame` 返回 0 → 既有 `resync-required{send-failed, send-frame-rejected}`/收口路径 | 已锚（协议 §13/§14/§23.1；契约 §12.1） |
| 版本 | 无协议版本变化（documentation-only 澄清/append） | 明确（U6「documentation-only 先行」） |
| 验证锚 | AC2 A12（ACK_STATE_VIOLATION 可经 `onSignal` 到 wire）、AC3 ac5-live 臂、C5b、`update-acked`/零 resync 断言 | 已锚（契约 §12） |
| 保持不变的冻结面 | §5 全表 | 已列 |

**E2 — ADR 0032 决策 3 机制句 + CONTEXT.md:230 措辞调和（修订线二，即 R7''/R8'' 义务本体）。**
差距三元组：机制句字面（未授权 OPEN 不过缝 + edge 复现）↔ #418 已实现内部形态（结局产出前过缝 + `openAdmission` 拉取）↔ #420 公共形态（ok-投影描述子传入 + U3 拒绝路径归属待设计二选一）。修订计划要素：修订文件（ADR 0032 决策 3 + CONTEXT.md:230）/新旧语义（三种载体的并存与各自适用面 + U3 选定形态）/兼容（wire 逐字节、authorize 恰一次在 edge、被拒 ns 零会话资源）/失败语义（denied/throw → `NAMESPACE_UNAUTHORIZED`/`INTERNAL_ERROR` 既有映射）/验证锚（A4 deny 断言族 + `ac1-ac2-open` 三锚）/冻结面（§5）——要素清单由 #418 SA8 设计报告 §6 列全、SA6 U6 承接，**附录文本未落，deadline = 本门禁之内（本票变更集或先行 documentation-only PR）**。

**计划完整性判定**：两线要素齐备、验证锚与冻结面明确、无版本迁移需求 ⇒ 计划完整 ⇒ 允许 `clear`，以 `requiresConflictRecheck: true` 与 §8 行动强制附录与实现同变更集落地核对。U3 的二选一不阻断计划完整性（附录可按选定形态定稿；两形态均不触碰 §5 冻结面）。

## 7. Hard conflicts

**无。** 未发现与 ADR 全集、CONTEXT.md、规范协议或模块规约不兼容且无合法解决路径的条款。特别核对并排除：(a) `onFrame` 返回序 ≠ 被否决的接纳信号（行 5）；(b) `connection-fatal` 公共化 ≠ fork/新 wire 面（行 6，evolution-required 有正式路径）；(c) 公共导出追加 ≠ 违反 #418 冻结（行 27）；(d) 内部重命名 ≠ 决策文本面变更（行 30）。

## 8. Required actions

| # | 行动 | 责任面 | 门禁 |
| --- | --- | --- | --- |
| RA1 | **ADR 0032 修订/澄清附录 + CONTEXT.md:229-231 词条更新须与 #420 实现同变更集落地**（或先行 documentation-only PR），覆盖 E1（信号词汇 + 公共面降级登记）+ E2（机制句/投影载体措辞 + U3 选定形态）；在此之前不得援引机制句字面迫使任何形态回退 | 设计/实现变更集 + Host | impl 复查逐项核对（R7''/R8''） |
| RA2 | 设计必须裁 U3（edge 处置 vs session 回放）并给证据；`ac1-ac2-open` 的 deny/readDeny/submitDeny 断言（`NAMESPACE_UNAUTHORIZED` ×1、authorize 恰一次、注册表零打开）保持绿；选定形态须与 RA1 附录文本一致 | SA1/SA10 设计 | design 复查 |
| RA3 | R5'' 门禁继续承接：design 复查裁桥形态/组合成员重塑；impl 复查核对 `hub-namespace.ts` 零 diff、公共导出恰增一名、零 worker 依赖/类型、S2 有界 pending 事实、observer 隔离单点不分叉、AC3 反空跑 + M1-M6 变异 | SA8 design/impl 复查 | 本报告置 recheck |
| RA4 | **契约措辞修正（design 冻结前）**：§12.2 A8 第二分句「`handleFrame` 收到的帧仍带占位 0」与 C4c/C5a/E3 矛盾——按决策集裁定的读法修正为「出站（`onFrame` 方向）缝帧带占位 0；入站（`handleFrame`）携带 wire 序」（或删除该分句）；C5a/A9/C4c 不动 | SA6 契约消费方（SA10/design 落测试时以修正读法为准） | design 复查 |
| RA5 | U2 边界维持：本票只冻结同步宿主 pipe；真 worker（异步序回传）形态留后续票并重新过 SA8（R5''/R8'' 存续）；公共面一经 test-d 锁定即 append-only，不得在后续票改签名 | 后续票 | 跨票登记 |

## 9. Verdict

**`clear`**。

- 31 项对照：18 no-conflict、10 implements-existing-decision、3 evolution-required（归并 E1/E2 两条修订线）、0 hard-conflict、0 override。
- 两条 evolution-required 线的修订计划要素齐备（#418 SA8 §6 清单 + SA6 S3/S4/U3/U6/U8 承接），按 skill「计划完整 ⇒ clear + 后续复查」放行。
- 任务可进入设计，条件 = §8 RA1-RA4；SA6 契约作为设计输入可用（RA4 措辞修正除外——以决策集裁定读法为准）。

## 10. requiresConflictRecheck

**true**。依据：(1) 新公共 API 面（工厂 + 句柄 + 信号）尚待实现核对，且一经发布 append-only 冻结；(2) 生命周期/失败语义面（`close`/`terminateUnauthorized`/`connection-fatal`/序回传 0 值）待落地核对；(3) E1/E2 的 ADR/CONTEXT 正式修订尚待落文本票变更集并核对（RA1）；(4) R5''/R8'' 重触发面（port 成员、DENY 面、决策文本）在实现 diff 后须 implementation 复查。design 复查与 implementation 复查按 skill 触发条件执行，产物分别为 `task_issue-420_design_conflict_report.md` / `task_issue-420_implementation_conflict_report.md`。
