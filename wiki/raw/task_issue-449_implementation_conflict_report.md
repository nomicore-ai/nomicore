# SA8 实现阶段冲突复查报告 — issue #449（γ-T3）：reconcile 与分块 transfer 跨缝

- Dispatch：`sa-7bfbce9c-913a-4e87-a8f5-9f19ac9cb9fc`（mabf-sa8 / conflict-gate / iteration 0）。
- Reviewed subject：**implementation**（交付 diff = 实现测试工件）。
- Worktree：`/home/wangjian/nomicore-fix-issue-449`，branch `mabf/issue-449`，HEAD `444c166`。
- 结论速览：**verdict `clear`，0 hard-conflict / 0 evolution-required**；交付面为纯测试锚（零生产/零夹具/零规范 diff），逐条对照 ADR 0032 附录 A4、协议 §24/§23.1/§13.2/§10.3/§3 与模块规约均「锚定既有行为」；SA3 的 7 项事实性校正（D1–D7）逐条核实为**不构成决策冲突**（§Decision analysis 行 7/11 与 §Required actions 注记）。

---

## 1. Reviewed subject: task | design | implementation

**implementation**。被审对象 = 当前 diff：

| 路径 | 形态 |
|---|---|
| `packages/ws-replication/test/ws-replication-issue449-gamma-reconcile-chunked.test.ts` | **新增**（1129 行；ROUND3/ANCHOR3/CHUNK3/ABORT3/DRAIN3 五族 14 用例）——本票唯一可执行交付物 |
| `artifacts/sa3-issue449-*.log`（9 份）、`artifacts/sa6-issue449-*.log`（5 份，入场既有） | 新增/既有证据日志 |
| `wiki/raw/task_issue-449*.md`（简报/设计/SA6 契约/SA3 实现记录） | 流水线文档 |

`git status --porcelain` + `git diff --quiet` 实查：**tracked 文件零修改**（`packages/ws-replication/src/**`、夹具 `issue447-async-seam.ts`/`issue448-live-seam.ts`/`harness.ts`/`driver.ts`、既有 `*.test.ts`、`docs/**`、`CONTEXT.md`、根配置/lockfile 全部零 diff）；全部条目为 untracked 新增。与设计 §11 ALLOW/DENY 及 SA3 §Changed paths 声明一致。

## 2. Inputs and decision set

| 输入 | 状态 |
|---|---|
| 任务简报 `wiki/raw/task_issue-449.md` | 在场；6 条 AC；`## Comments` 空（派工明示 REST 读 = 空数组 ⇒ 无 owner 评论要求） |
| 设计 `wiki/raw/task_issue-449_design.md` | 在场（§0 verification-only 裁定、§7-D2 交付物、§8.1 著写规格、§11 文件范围、§13 风险） |
| SA6 契约 `wiki/raw/task_issue-449_sa6_contract.md` | 在场（§12.3 15 条目矩阵 = 条目权威规格） |
| SA3 实现记录 `wiki/raw/task_issue-449_sa3_impl.md` | 在场（条目→用例映射 + 7 项偏差登记） |
| SA2 / SA4 / SA9 产物 | **不存在**（`wiki/raw/` 实查仅上列 4 份 #449 文件；iteration 0 无评审输入）——本复查触发依据 = 派工明文 + 实际 diff 锚定 ADR 0032 A4/协议 §24 冻结面（skill「实际 diff 触碰 ADR/协议/冻结面」触发条件：新测试把 γ 缝冻结面变为可执行锚） |
| #449 前置门禁 SA8 产物（`relevant_decisions`/`conflict_report`） | 不存在（设计 §6 已登记；约束集 = 规范原文 + #447 已过门冻结面） |

**决策集合**（全部实读）：ADR 0001–0032 全量状态清点——本域相关且 **accepted**：ADR 0032（A1–A4，γ 缝决策权威）、ADR 0010（复制架构）、ADR 0013（kind=0 分块；wire 冻结值权威 = 协议文档）、ADR 0022（kind=2 分块；同前）、ADR 0012/0023（插件/冻结服务面——未被触碰）；**无一被 superseded 于本域**（0016/0024 的修订属 readData 域，与本 diff 无关；0015 为 proposed 不构成约束）。规范协议 `docs/protocols/instance-replication-v1.md` §3（envelope）/§8.2/§9.2–9.3/§10.3（UPDATE_CHUNK）/§13.2（namespace 错误注册表）/§23.1（observer 事件词汇）/§24（γ 缝契约）。模块规约 `packages/ws-replication/AGENTS.md`（γ append-only、β 同步冻结、验证门）。CONTEXT.md 词条（HubSession/γ 异步形态/序回执）。源码仅用于确认当前事实，不替代决策文本。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（交付 diff 的实际行为） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0032 决策 2 / A4.1；协议 §24.1/§24.3 | 缝词汇 append-only 闭集合；无拒纳/闸门/信用词汇 | 新测试零缝词汇新增：仅消费既有夹具 API（`withholdEdgeToSession`/`release`/`setHeld`/`setDropPredicate`/`reorderNext`/`dropReceipts`/`probes.*`）；夹具与 `src/**` 零 diff | `no-conflict` | `git diff --quiet` = EMPTY；test 文件 import 面（:26-49）；§24.3 词汇表 | 无 |
| 2 | ADR 0032 A4.8；模块 AGENTS「Verification」 | 验收测试用延迟可注入的显式异步内存管道、不引入 worker_threads；聚焦测试纪律 | 交付物本身 = 该义务的兑现：全编排显式 `release`/扣留 + `makeManualClock`（经 `hubClock` 注入）+ `pumpUntil`/`microPump` 微任务泵；grep 实查零 `skip/only/todo`、零 `process.env`、零 `setTimeout/setInterval`、零 `worker_threads/MessageChannel` | `implements-existing-decision` | test :229-245（microPump/releaseHeld）、:529-539（manual clock）、grep 出口 exit=1（无命中）；`artifacts/sa3-issue449-stability-3x.log`（14/14 ×3，Type Errors no errors） | 无 |
| 3 | 协议 §24.2/§24.4；ADR 0032 A4.2 | 保序条款（回执恒先于引用该序的 ACK；违契响亮）；两锚三值中间态；`tag→seq` 换键不换槽两相记账 | `ANCHOR3-C1`（消费序 strict 先行断言 :605-619）、`ROUND3-C3`（reorder 注入 ⇒ `SYNC_STATE_VIOLATION` + failed + 消费序 ACK 先于回执 :495-521）、`ANCHOR3-N1`（丢回执 ⇒ `connection-fatal{ACK_STATE_VIOLATION}` + ERROR :638-654）、`CHUNK3-C0`（中间回执零占位变化/末回执仍 1 槽 :712-731）——全部为**锚定既有生产行为**；生产行为实读核实（`round-engine.ts:135-161` anchorOf/anchorSequenceOf/onSendReceipt、`:224-236` onApplied、`update-channel.ts:585-598` pendingSends） | `no-conflict`（锚定 §24.4 明文不变量） | 协议 :1103/:1126-1128；src 实读；测试断言 | 无 |
| 4 | 协议 §24.5；ADR 0032 A4.3 | 流控单点 edge；分块 transfer 无「洞中」形态：连接死亡 ⇒ 通道 quiesce 整体 abort；ADR 0013/0022 abort 语义不变 | `ABORT3-C1/C2`（死后缝出站/wire/sessionToEdge 零增长、零 settled、`unsealed === 0`、零 chunked-sent/acked、非 live；追加放行 close 后仍零增长 :886-918/:920-945）；`ABORT3-N1` 存活对照（结算恰一 + live，证明断言非空 :1006-1022） | `no-conflict` | 协议 :1138；ADR 0013/0022 状态行（abort 语义以协议为权威）；测试断言 | 无 |
| 5 | 协议 §10.3 transfer 身份；§24.5 重连恢复 | transferId 作用域 = (连接, 方向, namespace)，新作用域从 1 严格递增；旧 transfer 不续传 | `ABORT3-C3`：死亡后 `advanceMs(run, 5000)` 重连 ⇒ 新会话独立收敛 live、新作用域 `transferId === 1` ∧ `chunkIndex` 从 0 严格递增、旧 session/死连接 wire 零增长（零续传）:947-1004 | `no-conflict` | 协议 §10.3「transfer 身份」段（:318 附近）；`update-channel.ts` teardown（transferId 归 1，设计 §2 锚点表） | 无 |
| 6 | 协议 §24.6；ADR 0032 A4.4 | 自驱 drain 三触发点（入队/ACK 到达/transfer 末 chunk 回执）；推完即停、禁 busy loop | `DRAIN3-C1`：末回执结算后零新增 data 帧、`scheduler.pending()` 不增、零 acked、第 2 笔不过缝；ACK 放行 ⇒ 第 2 笔恰一次推出（:1028-1068）；`DRAIN3-D1`：隔离变异 `BulkTransferSender.prototype.onReceipt` 返回值 ⇒ 轨迹逐值不变（dormant 登记），`finally` 恢复原型（:1070-1128） | `no-conflict`——触发点③结构性在场且被调用（`hub-session-async-host.ts:174-176` 实读：`settledTransferLastChunk === true ⇒ selfDrain()`），§24.6 明文命令（在场 + 推完即停）被满足；「非承重」是诊断登记而非条款修订，延续 #448 SA10 D2 已裁的「规范命令超集 ⇒ 规范内满足」读法，**未触碰 §24.4 占用守恒条款**（欲使承重须另票 amendment，设计 §13-R8 已登记） | 协议 :1143；ADR 0032 A4.4（:83）；src `hub-session-async-host.ts:161-177/:271-277` 实读；测试 D1 用例 | 无 |
| 7 | 协议 §23.1 第 26–34 型（chunked 族事件）；§24.8 | 键集冻结：sent/applied/acked 恒无 `sequence` 键；sent 恒无 latency 键；acked `ackLatencyMs` t0 = 推送时刻（γ 口径含管道/edge 等待）；每完成 transfer 恰一；中间 chunk 零事件；与 aborted 互斥 | 断言逐条锚定：`not.toHaveProperty('sequence')`（:377/:745）、`ackLatencyMs = k + m`（t0 = 推送时刻算术：ANCHOR3-C1 :600、CHUNK3-C0 :746）、sent/acked 各恰一（多处）、`chunkCount`/`bytes = totalBytes` 字段值、ABORT3 下零 sent/acked（互斥面）。**SA3-D3 校正核实**：kind=0 的 sent 发射点 = 末 chunk 出站结算记账（`update-channel.ts` sendOneChunk γ 分支：`pendingSends.set` + `noteUpdateSent{chunked}` 同步于推送）——与 §23.1 第 26 型明文「末 chunk 帧已交宿主发送且注册在途——发射点 = 末 chunk 结算记账点」逐字吻合；kind=1/2 的 sent 发射点 = 末 chunk 序回执结算（`bulk-transfer.ts:262-275` onReceipt → `onLastChunkSent`）——与 §24.8「chunked 族事件在 session 回执/结算点」吻合。测试按各自载体真实结算点断言（kind=0 中间回执 ⇒ 「不新增」事件而非「恒零」；kind=1 中间回执 ⇒ 零 sent），**未削弱任何判据** | `no-conflict` | 协议 :749/:752/:755/:753-757（第 31/34 型 acked 字段）、:1151-1152；src `update-channel.ts:585-611`、`bulk-transfer.ts:262-275`、`hub-namespace.ts:612-649` 实读；测试断言 | 无 |
| 8 | 协议 §24.4 / §23.1 注记（SA3-D5 校正的裁决） | 两锚中间态三值（未发 / pending / 已盖章）；idle ∨ pending 同构 ⇒ 引用性 ACK 响亮 | 测试头注 + `ROUND3-C2/C3`、`ANCHOR3-N1` 实锚的是判别单点 `anchorSequenceOf`（idle ∨ pending 皆 ⇒ undefined ⇒ 违例）的**共同响亮面**；实读核实：分块形态（kind=1/2）下 γ 的锚在末 chunk 回执结算前为 idle（`sendStep2` 清锚、分块分支不回填，`round-engine.ts:293-311`），单帧形态（SYNC_STEP1）为真 pending(tag)（`anchorOf` γ 分支）——`ROUND3-C2` 锚的正是真 pending 面（丢弃 STEP1 回执 ⇒ pending 被引用 ⇒ 响亮）。SA6 §12.3 的「pending 面」措辞在 step2 分块场景实为 idle，属**上游措辞与源码事实的精确化**，非判据削弱（响亮判别不变；单帧 pending 面由既有 #447 `ANCHOR-C2`/`CHUNK-C2` 锚定） | `no-conflict`（§24.4 三值模型与因果不变量完整成立；措辞精确化不构成对条款的偏离） | 协议 :1128；src `round-engine.ts:135-145/:208-217/:293-311` 实读；测试 :307-314 头注 | 无 |
| 9 | 协议 §13.2（namespace 错误注册表）+ §9.3/§8.2 | `SYNC_STATE_VIOLATION`（fatal、terminal failed）；`ACK_STATE_VIOLATION`（connection fatal、close 1002） | 断言与注册表逐字同向：ROUND3-C2/C3 ⇒ ERROR 码 `SYNC_STATE_VIOLATION` + namespace `failed`（:421-422/:503-504）；ANCHOR3-N1 ⇒ `connection-fatal` 信号含 `ACK_STATE_VIOLATION` + ERROR 帧（:647-652）；零 park/零静默接受断言在场 | `no-conflict` | 协议 :413/:431/:255/:305；测试断言 | 无 |
| 10 | 协议 §3（envelope）+ §10.3（UPDATE_CHUNK 字段） | sequence 恒在帧字节 `[8..12]`（big-endian uint32）；chunkIndex 0-based 严格递增 < chunkCount；单 transferId；chunkCount 单值 = chunk 数；totalBytes 投影 | `rawSequenceOf` 读 `[8..11]` big-endian（:170-172）；`CHUNK3-C1` 逐 chunk `receipt.sequence = wire [8..12]` 原字节核对（:785-797）；ROUND3-C1/CHUNK3-C0 的 chunkIndex/chunkCount/transferId 结构断言（:329-351/:689-698）；双向 `SYNC_APPLIED`/`BOOTSTRAP_ACK`/`UPDATE_ACK` `ackedSequence` = 末 chunk 帧序 | `no-conflict` | 协议 §3 表（:52-63）、§10.3（:309-321）；测试断言 | 无 |
| 11 | ADR 0032 A4.8（成功路径与 β 形态 wire 逐字节等价） | parity 判据：控制帧逐字节 + 骨架（含 UPDATE_CHUNK 帧型/帧序）+ 数据帧文档语义 | `CHUNK3-P1`（T3 多 chunk 构型）三判据 + NC-1 内容变异敏感性全保留（:829-880）。**SA3-D1 校正核实**：β 参照 = 进程内组合根单体（`boot` 缺省 `createHubReplication`，`driver.ts:516` 实读）而非设计原文的 `issue424-sharded-hub`——该夹具冻结缺省 limits 无法表达多 chunk 构型（SA3 以 `artifacts/sa3-issue449-beta-reference.log` 留证）。**不构成冲突**的依据：① 同款选择是仓库既定先例（#447 `CHUNK-C1/ROUND-C2 parity（分块构型）` 即用单体参照，`ws-replication-issue447-async-session-round.test.ts:546-578` 实读）；② ADR 0032 状态行与决策 2 明文「listen 模式行为逐字节不变」「wire 逐字节不变」⇒ 单体 wire 是 β wire 的忠实代理，β↔单体 byte 同一性另由既有 edge/session 拆分契约与 wire parity 守卫套件锁定；③ A4.8 判据实质（逐字节 + 骨架 + 语义 + 敏感性）零削弱 | `no-conflict`（参照载体选择属设计层措辞与既定先例的精确化；A4.8 实质完整兑现） | ADR 0032 :4/:18/:99；#447 测试 :546-578；`driver.ts:516`；SA3 §Deviations-D1 + 证据日志 | 无 |
| 12 | ADR 0032 附录 A1（β 冻结）；模块 AGENTS「β 同步冻结逐字不动」「公共工厂 append-only」 | `createHubSessionHost` 冻结签名逐字保留；`src/index.ts` 导出面 append-only | 零 `src/**` diff ⇒ β 面、公共导出面、`HubNamespaceChannel` 零改动（实查 `git diff --quiet` = EMPTY） | `no-conflict` | git 实查；ADR 0032 A4.1（:61） | 无 |
| 13 | 模块 AGENTS（ws-replication）「Verification」 | 缝变更另跑拆分契约/parity 守卫；wire 或 lifecycle 变更另跑根门禁 | 本 diff 零生产/零 wire/零 lifecycle 变更 ⇒ 触发条件不满足；SA3 已超额跑包级门（单文件 14/14 ×3、γ 五文件 57/57、包全量 102 文件/911 用例、包 tsc exit 0——`artifacts/sa3-issue449-*.log` 抽查尾部与 SA3 声明一致）；根门禁移交 CI/#451 已登记（SA3 §Deferred） | `no-conflict` | 模块 AGENTS Verification 段；证据日志抽查（gamma-suites/package-suite/package-tsc/stability-3x/mutation-summary 尾部） | 无 |
| 14 | 设计 §11 DENY LIST（#449 的冻结面执行） | `src/**`、夹具、既有测试、规范文本、CONTEXT/AGENTS、replication-protocol、根配置、#450/#451 面全部禁改 | 实查全部零 diff；`ABORT3` 编排仅用 `closePeerSide(1006)` 异常断链形态（未越 #450 的 revoke/close 冲刷/1011 面）；测试对生产原型的唯一触碰 = D1 隔离变异且 `finally` 恢复（进程内测试纪律，仓库既有先例 `issue169/238/243` 直读 src） | `no-conflict` | git 实查；测试 :1101-1127 | 无 |
| 15 | CONTEXT.md 词条（γ 异步形态/序回执/HubSession） | 序回执 = 序号事实回传，非接纳信号；_Avoid_：伪造非零序号、当背压信号用 | 测试仅以夹具注入**投递序列扰动**（扣留/放行/丢弃/reorder）模拟宿主义务违契并断言响亮收口；未把回执当流控信号断言、未伪造序号 | `no-conflict` | CONTEXT.md :230-235；测试用法 | 无 |

**条目覆盖核对**（SA6 §12.3 15 条目 → 14 用例）：`CHUNK3-C2` 与 `ROUND3-C1` 同构合并于同一用例且按矩阵逐条断言（SA3 映射表 + 测试 :316-389 实读确认判据未合并削弱）——其余 14 条目一一对应。著写纪律（零 skip/only/todo/env、变异 finally 恢复、无跨线程事件序断言——顺序断言仅在单一 `edgeToSession` 通道的 `delivered()` 消费序上，符合 §24.8「跨线程 observer 事件无全序」的适用域限定）逐项 grep/实读核实通过。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| （无） | — | — | — |

无合法 override 亦无需 override：Issue comments REST 读 = 空数组（派工明示 + 简报 `## Comments` 空双确认）⇒ 无 Owner 评论覆盖；无新 ADR/修订；无协议版本升级。SA3 的 D1–D7 均为**事实性校正/编排裁定**（对照规范原文逐条核实为吻合或既定先例，见 §3 行 7/8/11），不是对任何决策条款的偏离，故不进入 override 表。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| wire envelope / sequence 布局 | 固定头 20B、sequence 于 `[8..12]` big-endian（§3） | 协议 :52-63 | 未变（零 wire diff；测试按此读取） |
| γ 缝消息词汇 | §24.3 append-only 闭集合（frame{tag,bytes,lane}/receipt{tag,sequence}/settled/connection-fatal/close/terminateUnauthorized；无拒纳词汇） | 协议 :1108-1120 | 未变（夹具零改动、零新词汇） |
| 错误码语义 | `SYNC_STATE_VIOLATION`→terminal failed；`ACK_STATE_VIOLATION`→connection fatal 1002（§13.2） | 协议 :413/:431 | 未变（测试仅锚定既有收口） |
| chunked 族事件键集 | sent/applied/acked 无 `sequence`；sent 无 latency 键；acked `ackLatencyMs` t0 = 推送时刻（§23.1/§24.8） | 协议 :749-757/:1151-1152 | 未变（断言与冻结键集逐字同向） |
| transferId 作用域 | (连接, 方向, namespace) 从 1 严格递增；重连新作用域（§10.3） | 协议 §10.3 | 未变（ABORT3-C3 锚定归 1） |
| β `createHubSessionHost` 同步冻结 | 签名与行为逐字不动（ADR 0032 A4.1；模块 AGENTS） | ADR 0032 :61 | 未变（`src/**` 零 diff） |
| 公共导出面 / `HubNamespaceChannel` | append-only；零改动原则（ADR 0032 A4.1） | ADR 0032 :61 | 未变 |
| 夹具面 | `issue447-async-seam.ts` 等零改动（模块 append-only 纪律 + 设计 §7-D5） | git 实查 | 未变（tracked 零 diff） |
| 规范文本 / CONTEXT / AGENTS | 冻结（设计 §11 DENY） | git 实查 | 未变 |
| 测试采集/类型门配置 | 根 `vitest.config.ts` include/maxWorkers、tsconfig 零改动 | git 实查 | 未变（新文件逐字命中 `packages/*/test/**/*.test.ts`） |

## 6. Evolution requirements

无。交付面未改变任何既有契约（零生产 diff、零规范 diff、零夹具 diff），不存在需要同变更集修订 ADR/CONTEXT/协议的条目。条件性重开项（非本轮激活，设计 §15-4 已登记）：若未来欲使 drain 触发点③承重（触碰 §24.4 占用守恒）或为 γ 增补 `sendQueueMs` 携带（触碰 §24.3 闭集合），届时须重开冲突门——本票未预留任何钩子。

## 7. Hard conflicts

无。逐条对照（§3 15 行）零 `hard-conflict`：交付物是对既有决策所命令行为的**可执行锚定**，且其全部断言面经源码实读与规范原文逐条比对吻合（含 SA3 七项校正的三处决策相关项 D1/D3/D5，均已裁决为吻合/既定先例/精确化）。

## 8. Required actions

无阻塧行动。登记性注记（不构成 verdict 条件）：

1. SA3-D1（β 参照载体）：与 A4.8 实质兼容且为 #447 既定先例；后续若 `issue424-sharded-hub` 夹具演化出可配置 limits，可回归设计原文的参照选择——非义务。
2. SA6 §12.3 的「pending 面」措辞在 kind=1/2 分块场景与源码事实（idle 相位）存在措辞差——SA3-D5 已在测试头注诚实登记，判别语义（响亮）不变；后续引用 SA6 矩阵时应以该登记为准，避免把「idle」误读为判据削弱。
3. 根门禁全量回归（`pnpm test`/`pnpm typecheck`）按分工属 CI/Host 收尾与 #451——非本票义务（模块 AGENTS 的根门触发条件「wire 或 lifecycle 变更」不满足）。

## 9. Verdict

**`clear`** —— 全部对照项为 `no-conflict` 或 `implements-existing-decision`（A4.8 验收纪律义务的兑现）；无 `evolution-required`、无 `hard-conflict`、无未兑现的正式 override。

## 10. requiresConflictRecheck

**`false`** —— 理由：本 diff 为纯测试锚，公共 API、wire、schema、持久化、状态机语义、生命周期、失败语义**零变化且无尚待实现核对的面**；本报告即实现后复查，已闭合。dormant 保险丝登记（DRAIN3-D1）不修订任何条款（§24.6 命令在场性满足；承重化属另票 amendment，触发条件已由设计 §15-4 登记，无需本轮标记）。
