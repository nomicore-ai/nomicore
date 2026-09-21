# task_issue-421 SA2 设计攻击评审 — Edge 公共工厂：accept 双入口 + OPEN 准入管线 + sequence 盖章（spec #415 T4）

- 评审对象：`wiki/raw/task_issue-421_design.md`（**732 行，迭代 1 修订版**：逐条落实 SA2 R1–R6 与 SA8 A1–A5，§15 修订映射）
- 基线核对：HEAD `7039f6d`（git 亲测；与设计 §0 声明一致）；`git status --porcelain` 仅流水线产物，零实现
- 评审方式：独立读取全部上游产物 + 生产源码/既有测试逐锚点亲核（本轮重点复核迭代 0 全部 finding 的修订收口 + 新视角攻击）；零实现、零测试运行、零设计修改
- Verdict：**`approve`**（无 BLOCKER、无 MAJOR；5 条 MINOR 非阻断观察，见 §14）

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| 任务简报 `wiki/raw/task_issue-421.md`（Issue #421 正文 + AC1–AC6；评论快照空） | 已读 |
| 设计 `wiki/raw/task_issue-421_design.md`（迭代 1，732 行全文） | 已读 |
| SA6 契约 `wiki/raw/task_issue-421_sa6_contract.md`（§5/§8/§12.0–12.8/§15 全读；OAP/RK/ER/WS/LC/EF/GATE/SD 逐条） | 已读 |
| SA8 摘录 `task_issue-421_relevant_decisions.md` + task 门禁 `task_issue-421_conflict_report.md`（clear）+ **设计后复审 `task_issue-421_design_conflict_report.md`（reject，A1/A2 阻断 + A3/A4/A5）** | 已读 |
| SA2 迭代 0 评审（本文件前版：reject，R1/R2 BLOCKER + R3/R4/R5 MAJOR + R6 MINOR + N1–N6） | 已读；逐条核销见 §13 |
| 生产源码（本轮亲核锚点）：`hub-split.ts`（127 行全文）、`hub-connection.ts`（1–469 全文：44–151 符号族、179–205 校验链、242–379 双入口门序、429–463 组合根）、`hub-edge.ts`（56–175 配置/port、199–317 生命周期、318–402 准入、403–522 HELLO/drain、523–597 路由/ERROR、598–712 收口/settled、713–790 工厂）、`hub-session.ts`（60–293：84–94 建通道、105–111 shim、115–172 分派壳、174–199 withChannel、203–254 出站门、256–282 生命周期）、`hub-namespace.ts`（285–374 onOpen/startOpen、468–531 waiter 终局、830–848 opening UPDATE、1650–1672 sendChecked、1690–1746 settled/quiet/terminationSettled）、`frame-io.ts`（38–60 namespaceErrorFrame、146–205 队列/盖章）、`backpressure.ts`（140–195）、`types.ts`（44–52/145–159）、`index.ts` 全文、`validate.ts`（54–84/140–174） | 已读并逐锚点核验 |
| 既有测试冻结面：contract.test（:50 import、:144–156 双冻结清单、:551 断言）、structure.test（:34–46、:616–619 四模块键面）、两份既有 test-d、`ws-replication-issue190-*.test.ts`（早到帧契约值引用方式） | 已读（本轮 R1/R2 收口的核心证据源） |
| `CONTEXT.md:225–235` 三词条、`packages/ws-replication/AGENTS.md`、根 `vitest.config.ts`（alias + typecheck include）、`packages/ws-replication/package.json`（nomicore-source 条件）、ADR 0032 全文 | 已读 |
| Owner 评论 REST 快照 | 空（dispatch 明示）——无评论级要求 |

迭代 1 设计的事实锚点抽查全部属实（§2.1/§2.2 行号引用逐条亲核，含本轮新增的 C5a/L616 证据行、opening 合流语义行、`isOpenAborted`/`finishOpenSilently` 行、`terminationSettled` 行——与源码零偏差）。§15 修订映射所列的每个修订位置经抽查真实在文。

## 2. Verdict

**`approve`**。迭代 0 的 2 BLOCKER + 3 MAJOR + 1 MINOR 与 SA8 的 A1–A5 全部收口，且收口方式经源码级独立核验**正确、完整、架构一致**：

- **R1（BLOCKER→核销）**：C5a 冻结清单的**限定性 append-only 更新**纳入 ALLOW LIST（一名追加、零删除、零其他断言触碰、零测试条目增删），授权理由（#418 冻结边界 = 该票零新公共 API；本票 = ADR 0032:41 授权的首发布票）成立且不可替代——AC1 强制导出，清单同步是唯一落地路径。亲核：`contract.test:551` 断言为 `Object.keys(productionApi).sort()).toEqual(FROZEN_PRODUCTION_EXPORTS)`，字典序追加位 `'createHubReplication' < 'createHubReplicationEdge' < 'createHubReplicationPlugin'`（前缀序 + `'E'<'P'`）正确；`FROZEN_TESTING_EXPORTS` 不受扰；根 vitest alias 将 `@nomicore/ws-replication` 直解到 `src/index.ts`（叠加 `nomicore-source` 条件双保险）；全 test/ 检索无第二处导出面断言（import-star 仅 structure.test 四模块 + contract.test 两入口）。DENY/GATE/§11/§13-8/§14 五处口径一致化（「唯授权例外一处」），矛盾消除。
- **R2（BLOCKER→核销）**：选项 α 落地——`MAX_EARLY_FRAMES`/`EarlyFrameAdmission`/`installEarlyFrameAdmission`/`closeAdmission` 四符号经亲核为**自包含符号族**（`hub-connection.ts:44–151`，仅引用 `DuplexTransport`/`ResolvedLimits` 类型与注入回调，零模块私有耦合；`closeAdmission` 仅被前者内部调用 2 处 ：112/:119；全仓无第四符号的包外引用——issue190 系测试只复刻契约值 16 不引符号）→ 逐字搬迁至 `hub-upgrade-admission.ts` 可行；import 不进 `Object.keys` → L616 `['createHubReplication']` 单键保持、L616–619 四断言全绿；两消费点 :268/:353 迁移后共享单点，#190 纪律保持。SA8-A2 的四处证据链失真同步修正（D1 理由 2 重写、§11 引 L616–619 全块、措辞改「导入路径迁移」、§13-9 回滚含迁移还原）。
- **R3（MAJOR→核销）**：本轮**源码级确认收敛正确性**——单体 `startOpen` 首个 OPEN 即 push waiter（`hub-namespace.ts:342`），故 N 个 OPEN（首 + 合流 N−1）在 deny/throw 下单体发 **N 帧**（`finishOpenError` `483–488` 按 waiter 数）+ `namespace-error{sent}` 恰一（HB2，:489）+ 迁移 failed 时 `namespace-failed` 恰一（:490–497）——适配器 `finishTerminal` 的 `openCount = buffer 中 {kind:'open'} 项数`（首 OPEN 占位在缓冲）与单体**逐帧等值**。`PendingItem` 按 kind 分型（open 变体无 sequence）+ `flushPending` 分派投递面，类型自洽且与缝契约一致（`hub-split.ts:109–112`：OPEN 投递不带序、非 OPEN 带序）。no-sink 合流 OPEN 零应答 = §13-1(iii) 显式登记 + 收敛回退在档。OAP-C4b 三态用例入 §12。
- **R4（MAJOR→核销）**：`settleAdmission` try/catch（→ `finishTerminal(ns,'INTERNAL_ERROR')`，对齐单体 shim reject 路径 `hub-session.ts:105–111` + `hub-namespace.ts:347–349`，亲核属实）+ `connectionClosed` 前置守卫（deny/throw/authorized 迟归 → `finishTerminalSilently`）。本轮亲核单体 `finishOpenSilently`（:505–523）确实**零 wire/零事件/零 settled**，且 `maybeFinishDrainEarly` 在 closedFlag 上早退（:705）——设计「不通知 settled 的观测等价」论证成立。`runSettle`/`runResolve` 入口兜底 → 零 unhandled rejection。OAP-C9 两用例入 §12。
- **R5（MAJOR→核销）**：四成员异常纪律全部落入 D2 契约注释（发布即冻结条款）+ §8.2 伪码防御点 + §9.1 三行 + OAP-C10 三用例。本轮结构性核验：内部 edge `cleanupAll`（`hub-edge.ts:599–617`）的 `settleTail = requestSinkClose().then(()=>undefined)` 后 `await settleTail → onConnectionDropped()`——适配器 close() 的逐 sink 归一使 `sink.close()` 恒 resolve ⟹ settleTail 恒 resolve ⟹ `onConnectionDropped` 必达、`hub-connection.ts:136–141` 识别的 unhandledRejection 面不引入新实例。`terminateNamespace` 归一与单体 `terminationSettled`（:1730–1734 吞清理异常）同形。
- **R6（MINOR→核销）**：门 6/7 次序对齐单体——亲核 `hub-connection.ts:304–315`：微任务让位（:309）+ 迟拒复查（:310）**先于** instanceId 文法（:312–315），设计 §7-D4 步骤 6/7 与之一致，EF-C2 增补次序语料。
- **SA8 A3/A4/A5**：读法登记（协议 §2「同步 TypeError」括注）、分歧族三态完整化（§13-1 (i)(ii)(iii) + 收敛方案）、实现票边界（CONTEXT.md 限于「复制 Edge」词条 :225–227 亲核在档 + §14-4 四类 diff 核对）——逐项落档。

新视角攻击（状态机/错误恢复/契约/架构/文件范围/验收六面）未发现 BLOCKER/MAJOR 级缺口；残余 5 条 MINOR 见 §14。架构主线（D1 零 FSM 复现包装 + D2 三参回调/句柄 egress + 选项 α 搬迁 + D6 维持 T2 登记 + SD-1..SD-6 选形）经本轮源码复核全部成立，且全部落在 SA6 §12.7 硬约束带与 ADR 0032/协议条款内。

## 3. 需求覆盖

| Requirement（Issue 正文） | Design section | Assessment |
|---|---|---|
| 导出 `createHubReplicationEdge` 普通工厂（非 Cordis 插件、无 Registry 依赖） | §1 目标 1（含 R1 落地前提）、§7-D1、§8.1、§10 | 覆盖；落地路径与 C5a 冻结断言的冲突已由限定性 append-only 同步收口（R1 核销，本轮亲核断言形态与字典序插入位） |
| `accept(transport, { token })`（内部跑注入的 verifyToken） | §7-D4、§8.3 R5 路线 | 覆盖；门序逐点复刻 `hub-connection.ts:242–334`（含修订后的 6/7 次序，亲核 :304–315 一致） |
| `acceptTrusted(transport, identity)` | §7-D4 | 覆盖；单同步段、文法→admission→分配，与 :336–379 一致（无门 0 为登记差异，工厂无服务面） |
| 出站 sequence 盖章对外可见（多会话并发帧经 mux 后 per-connection 严格递增） | §7-D2、§8.4、§12 WS-C1..C3 | 覆盖；等价论证经 `frame-io.ts:178–205`（emitOne 单点 + writeBe32At [8..12]）与 `backpressure.ts:149–178`（sendControlFrame/tryEmitDataFrame）亲核成立 |
| OPEN 准入管线全分支 | §7-D3、§8.2、§12 OAP-C1..C10 | 覆盖且阶段序 = Issue 正文序；内部三门零改动继承（:391–397/:495–512/:373–388 亲核）；R3/R4/R5 缺口全部闭合 |
| 路由键提取与无 sink 帧两分支 | §8.5、§12 RK | 覆盖；`hub-edge.ts:533–586` 亲核（台账命中投递/违例 fatal/无台账合成），no-sink 落点形状复刻 :570–586 |
| ERROR mini-decode（消费 T1 守卫布局契约） | §8.5、§12 ER | 覆盖；:526–532 特例 + `ERROR_NS_PREFIX_BUDGET=64` 消费链一致 |
| 宿主回调 `resolveSessionSink(connectionKey, namespaceId, authorization)` 授权通过后调用 | §7-D2、§8.2 阶段 4、§12 OAP-C8 | 覆盖；三参钉死、grant = ok 投影（`hub-split.ts:49` 同形）、deny 零调用、`Promise.resolve` 包裹同步 throw 同归 |
| AC1–AC6 | §12 | 全映射；EF-C2 的 `channels`→`namespaces` 偏差有 SA6 §15-8 显式授权 + 设计登记（见 §10 架构审查） |
| 目标/非目标未静默扩大 | §1 | 核验通过：listen:false/SessionHost 服务面/peer 侧/worker 形态/工厂级服务面均显式排除且与 SA8 A6 一致 |

## 4. Owner评论覆盖

Issue 评论 REST 快照为空（dispatch 明示 `[]`）。设计 §4 如实登记。无遗漏。

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| SA6 G1–G9 缺口 + O/NC oracle + M 变异 | §3/§5/§12 逐条承接，断言面原样 + 本迭代增补（OAP-C4b/C9/C10） | 属实（迭代 0 已核 probe 日志；本轮核 SA6 §12 条目与设计映射一致） |
| ADR 0032 决策 1–5 + 后果节 | §6 表逐行；D1 包装零 FSM 复现 / D2 字节缝 / D3 管线全落 / §8.5 零改动复用 / §8.6 观测纪律 / §10 append-only | 全部一致（ADR 全文亲读；决策 3 的 edge 职责落点 = 库内 `HostSessionAdapter`，非宿主——责任归属正确） |
| 协议 §1/§2/§3/§13/§14/§19 | §6 行 + D4 门 2 读法登记 + SD-2/SD-3 选码 + D2 第三参 ok 投影 | 一致；§2「同步 TypeError」读法登记 = SA8 设计报告 §3 行 10 裁决原样采纳（A3 核销） |
| R4''/R5''/R7''/R8'' 跨票义务 | §7-D3 阶段 4 / §1 非目标 / §6 行 / §6 行 + §14-4 | 逐条落实；R8'' 不触发（四 DENY 文件零 diff；hub-connection.ts 仅符号搬迁导入，模块键面/行为/port 成员集/结局词汇/reject 面零变化——本轮亲核搬迁可行性） |
| SA8 A1（选项 α）+ A2（证据链） | §7-D1 搬迁段、§10 两行、§11、§13-8/9、§14-4 | **核销**（见 §2 R2 段） |
| SA8 A3（§2 括注读法） | §6 + §7-D4 门 2 | 核销 |
| SA8 A4（两项自登记分歧） | §7-D3 SD-5 + §13-1 三态 | 核销（维持登记 + 收敛方案；行为面攻击见 §7/§8——无阻断项） |
| SA8 A5（实现票义务） | §10 CONTEXT.md 行 + §14-4 | 落档为验收边界（词条 :225–227 亲核） |
| spec #415 不在库 | §5 行 | 与 SA8 核验一致 |
| SA8 设计报告 §3 行 16（L616 违规） | 选项 α 消除 | **核销**：模块键面不变经搬迁可行性亲核 + L616–619 断言原文亲核 |

## 6. 设计内部一致性

| 检查点 | 结论 |
|---|---|
| 正文 ↔ 伪码 ↔ 接口类型 | 一致：`PendingItem` 按 kind 分型与 `flushPending` 分派/deliverOpen·deliverFrame 签名自洽；`finishTerminal` 应答数（缓冲 open 项数）与 §7-D3 阶段 3 声明、§8.3 R2 行、§8.6 事件表、§9.1 表四方一致；D2 契约注释的异常纪律与 §8.2 防御点、§9.1 三行、§12 OAP-C10 一致 |
| §7-D4 门序 ↔ `hub-connection.ts:242–334` | 逐点一致（含 6/7 次序修订；差异仅无门 0，显式登记） |
| §10 ALLOW/DENY ↔ §12 GATE ↔ §11 矩阵 | 一致：C5a 例外四处口径统一（「唯授权例外一处」+「L616–619 零改动」+「588 条目数不变」）；§11 补列 C5a 测试消费者行与 C0a–C0d 全块行（迭代 0 选择性取证已修正） |
| §13-1 分歧登记 | 三态完整（(i) 非分歧 (ii) 已登记 (iii) 显式登记 + 收敛回退）；与 §8.2 语义映射表互证 |
| 死引用/旧 API | 未发现；全部锚点（含本轮新增的 :136–141/:342/:505–527/:1730–1734/:268/:353）亲核有效 |
| §15 修订映射 | R1–R6/N1–N6/A1–A5 逐条有所列修订位置，抽查全部在文且内容相符 |
| 残余不一致（非阻断） | §8.3 R4 行声称「编码异常 → sendChecked catch 形状（防御）」但 §8.2 `finishTerminal` 伪码的帧发送无 catch（见 §14-M1） |

## 7. 状态机与并发攻击

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| SM-1 | ns = pending（authorize 在途），已缓冲首个 OPEN | 同 ns 第二个 OPEN | 单体：waiter 合流（:309–313 + :342 首个亦 waiter）→ established 每 waiter 一帧 OPEN_OK / deny 每 waiter 一帧 ERROR + 事件族恰一 | 无——本轮源码级确认 N OPEN → N 帧等值（缓冲 open 项数 = waiter 数，含首项）；established 投递面按 kind 分派正确 | 无 |
| SM-2 | ns = pending，连接已 fatal 收口 | authorize 迟归 denied/throw/authorized | 单体：`isOpenAborted` → `finishOpenSilently`（零 wire 零事件零 settled） | 无——`settleAdmission` 前置 `connectionClosed` 守卫 → `finishTerminalSilently`（闩锁防重入 + 缓冲丢弃 + 账目）；authorized 形态下迟归 sink 仅得归一 `onConnectionClosed` | 无（OAP-C9(a) 用例在档） |
| SM-3 | 任意 | `port.openAdmission(ns)` reject（台账缺失） | 单体：shim reject → `startOpen` catch → ns `INTERNAL_ERROR` | 无——catch → `finishTerminal(ns,'INTERNAL_ERROR')` 对齐（连接存活、响亮、有分类）；且 `beginAdmission` 的 promise 永不以 reject 结算（`hub-edge.ts:340–359`，throw 结局以值承载）→ 正常路径无第二 reject 源 | 无（OAP-C9(b) 用例在档） |
| SM-4 | ns = no-sink 终态记录 | 重 OPEN | 重解析（缓存 grant，authorize 不重复） | 无——edge 台账只增不减（:324–326）⟹ 重 OPEN 走 `sink.openNamespace` 不再 beginAdmission；闩锁/上界/放大面登记完整（§13-2 + 回退方案） | 无 |
| SM-5 | 连接 draining | 全部台账 ns settled 齐备 | `maybeFinishDrainEarly` 提前 1001（:704–710） | 无——适配器 settled 账目（denied/failed/no-sink 结算时通知；established 经 egress 转发；pending 永不通知；已收口静默不通知）与判定式兼容；closedFlag 早退使「静默不通知」观测等价 | 无（LC-C2 + R4b 观测用例在档） |
| SM-6 | pendingFrameCount = 16 | 第 17 项到达 | 响亮 `CONNECTION_POLICY_VIOLATION`/1008 收口 | 无——`pushPending` 上界检查 + connectionFatal；OPEN 自身占位计入；内存账 = 16 × maxFrameBytes 与早到帧同账 | 无 |
| SM-7 | in-flight OPEN = 4 | 第 5 个不同 ns 的 OPEN | 拒绝 + 收口 + quiesce；被拒 OPEN 的 authorize 已发起 | 无——无适配器记录但 edge 台账 promise 以值结算（无 reject）→ 零 unhandled rejection、零外溢（本轮亲核 :338–360）；fatal 后 onMessage 早退（:374）⟹ 后续帧不可达 | 无（§13-3 登记 + OAP-C5） |
| SM-8 | established | 连接收口 | `onConnectionClosed` 通知全部 established sink；迟归解析 sink 仅得卫生通知（恰好一次，无双发/漏发） | 无——close() 迭代时点快照 + runResolveInner 闭路分支互斥（record 未 established 则不在 close() 迭代内，反之亦然）——本轮推演确认恰一次 | 无（OAP-C10(b) 用例在档） |
| SM-9 | 适配器表 vs edge 台账锁步 | 任意帧路由 | 台账命中 ⟺ 表记录在场（R-delivered） | 无实质缺口——唯一分叉（超额 OPEN：台账有、表无）在 fatal 收口后不可达；防御分支（rec==null → 合成）与 `withChannel` 同形 | 无（OAP-C8 锁步断言在档） |

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| ER-1 | `resolveSessionSink` throw/reject | `connectionFatal('INTERNAL_ERROR',1011)` 恰一帧 + close + 无 fallback | 无（OAP-C6） | 无 |
| ER-2 | sink 投递同步 throw | 防御 catch → 1011 终局，不展开进 transport 回调 | 无（R5 条款 + OAP-C10(a)） | 无 |
| ER-3 | sink `onConnectionClosed` reject | 逐 sink 归一 → close()/settle() 恒 resolve、onConnectionDropped 必达 | 无（结构核验通过：settleTail 恒 resolve） | 无 |
| ER-4 | sink `terminateUnauthorized` reject | 归一 → revokeNamespace 恒 resolve（单体 terminationSettled 同形） | 无 | 无 |
| ER-5 | `openAdmission` reject / 迟归终局 | R4a/R4b 分类收口 / 静默结算 | 无 | 无 |
| ER-6 | 升级期各门失败 | close code/reason + reason 闭集复刻；accept 永不 reject | 无（:242–379 逐点核对相符） | 无 |
| ER-7 | `finishTerminal` 帧编码 throw（宿主配置极小 maxFrameBytes） | 伪码无 catch → 逃逸至 `runSettle` 静默兜底；§8.3 却声称有 sendChecked 形状防御 | 理论角落（validateLimits 仅 positiveSafeInteger，无最小值；ns ERROR 帧 ~90–150 字节）：单体在该形态走 sendChecked catch → finalize failed + `namespace-failed{send-failed}` + settled，适配器静默吞 + 账目不递减——与自设「全路径已分类」不变量矛盾 | **M1（MINOR，非阻断）**：`finishTerminal`/`sendNsReply` 帧发送包防御 catch（镜像 sendChecked：失败 → 闩锁 + 丢弃 + settled），或修订 §8.3 行的声称使两处一致 |
| ER-8 | 对端/宿主恢复语义 | §9.2：无静默重试面；诚实终局 | 无 | 无 |

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| `src/index.ts` 公共导出面（11→12） | 无——C5a 消费者已列入 §11 矩阵并获限定性同步授权；字典序插入位正确；无第二处导出面断言（全 test/ 检索）；两份既有 test-d 具名导入不受扰 | contract.test:50/144–156/551（亲核）；根 vitest.config alias；grep 全量 | 无 |
| `hub-connection.ts` 模块导出面 | 无——选项 α 下键面不变（import 不进 Object.keys）；L616–619 全绿；符号族自包含经亲核 | structure.test:34/616–619（亲核）；hub-connection.ts:44–151/268/353 | 无 |
| `HubNamespaceSessionSink`（新公共缝） | 异常纪律四成员 + 「OPEN 投递不带 wire 序」边界声明均在契约注释（R5 收口） | 设计 §7-D2 代码块；hub-split.ts:109–112 同形 | 无 |
| `HubReplicationEdgeEgress` | 成员映射经 port 单点亲核成立（sendControlFrame→sender、sendData 前置门 = hub-session.ts:210–216 逐点、connectionFatal 缺省 1002 = makePort:222、chunked = :733–735）；`connectionState()`/`dataGateOpen()` 为真实 port 成员（hub-split.ts:73/94） | hub-split.ts:54–99；hub-edge.ts:213–251 | 无 |
| 句柄面（D7） | `channels`→`namespaces` 偏差有 SA6 §15-8 授权 + §12 登记；`settle` 恒 resolve；egress/生命周期成员齐备 | SA6 契约 :333（亲读）；hub-edge.ts:305–312 | 无 |
| `apps/yjs-server` 与既有 77 测试 | 零变化（组合根仅导入迁移；C5a 为期望同步非产品面变化） | hub-connection.ts:429–463；§11 矩阵 | 无 |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| 连接级 FSM | edge 单份（ADR 决策 1） | 内部 `HubReplicationEdgeImpl` 零 diff | 正确 |
| OPEN 准入管线岗位（缓冲/上界/解析/收口） | edge 侧（ADR 决策 3） | `HostSessionAdapter`（库内、经 sessionFactory 注入） | 正确——适配器是 edge 产品的组成部分而非宿主/应用层代码，不构成第二 FSM |
| authorize 真实调用 | edge 单点 | 内部 edge `beginAdmission`（:338–360） | 正确 |
| 宿主 sink 生命周期 | 宿主 | 四成员 + 异常纪律 | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| 升级接纳双入口 | `hub-connection.ts` accept/acceptTrusted | 门序复刻 + `hub-upgrade-admission.ts` 单点复用 | 一致 | 搬迁不复制（两消费方共享同一实现，#190 纪律保持） |
| 连接级半边工厂 | `hub-edge.ts:788` 模块级 | 新公共工厂包装之 | 一致 | SD-1 建议原样采纳；等价由 RK-C3/WS-C2 锁死 |
| admission 有界先例 | `MAX_EARLY_FRAMES` 账法 | pending 16 帧同账推导 | 一致 | 同一对抗面 |
| 并发上界先例 | `maxConcurrentAssembliesPerConnection`（types.ts:44–52） | `MAX_CONCURRENT_OPEN_ADMISSIONS=4` 模块常数 | 一致（判然两分已登记） | 非平行重定义 |
| deny/throw 应答复刻 | `hub-namespace.ts:483–503` | 适配器 `finishTerminal` | 一致（本轮逐帧等值核验） | 帧构造/观测折叠单源 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| ns 是否已 OPEN | edge 台账 | 适配器准入表（锁步 + OAP-C8 断言） | 低 |
| 连接标识 | 工厂计数器 → connectionCounter | connectionKey（同串，:441/:479 亲核） | 无 |
| drain 终态集 | edge settledNames | 适配器/宿主通知（单点写入） | 无 |
| 出站序 | OutboundQueue 单点 | egress 返回值 | 无 |

### 生命周期对称性

accept 分配 ↔ 句柄 close/settle + 五路收口 + cleanupAll；准入记录 ↔ 四类终局 + settled；`resolveSessionSink` 在途 ↔ established/no-sink/卫生通知；fire-and-forget 续体全路径自兜底。对称成立（迟归/异常路径经 R4/R5 收口后完整）。

### 平行机制检查

无第二套连接级 FSM / upgrade 门（复刻为任务要求且机制单点）/ pending worker / 测试基建。deny/throw 应答复刻已登记（§13-5，帧构造与观测折叠单源）。**无阻断项**。

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW `contract.test` C5a 限定行 | 断言形态/插入位/授权理由/回滚面（§13-9）齐备；范围限定语（一名、零删除、零条目增删）明确 | 无 |
| ALLOW `hub-upgrade-admission.ts` + `hub-connection.ts` 迁移行 | 符号族自包含亲核；「不进 index.ts」明示；L616 保持绿论证成立 | 无 |
| ALLOW 其余项（hub-edge-host.ts/index.ts/7 测试文件/CONTEXT.md） | 路径与 SA6 §12.0 逐条一致（7 文件 = 6 test + 1 test-d，与 GATE-C1「新增 7 文件」相符）；vitest include/typecheck 覆盖新路径；CONTEXT 词条边界（:225–227）在档 | 无 |
| DENY 面 | 四核心文件零 diff 与 R8'' 相容；testing.ts 零改动（`FROZEN_TESTING_EXPORTS` 不受扰）；77 文件 = 75 test + 2 test-d 亲数相符 | 无 |
| Follow-up 未掩盖必要项 | §13 Follow-up (a)–(f) 均在 SA8 A6/非目标边界内 | 无 |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1/EF-C1 | test-d 锁签名 + `Object.keys` 只增 + C5a 同步后全绿（GATE 前置显式断言） | 无 | 无 |
| AC2/OAP-C1..C8 + C4b/C9/C10 | 含合流三态、迟归守卫、sink 异常、锁步断言五组新增用例；红绿纪律（旧红 = 能力缺失；新用例对迭代 0 伪码红、对修订伪码绿）声明完整 | 无 | 无 |
| AC3–AC6/RK/ER/WS/LC | 逐字节 parity + 预算见证 + timer 驱动 + 负控 + EF-C3 机制单点验证（搬迁后单体与工厂同 close code/reason） | 无 | 无 |
| GATE-C1..C4 | 全量 vitest（nomicore-source）+ tsc + 空 diff + 只增不减 + L616–619 零改动 + C5a 更新后全绿 + 588 条目数不变 + 测试纪律 | 无（迭代 0 的可实现性破坏已消除） | 无 |
| 防「红在错误原因」/防伪绿 | §12 末段纪律 + 测试设施（内存 transport + 注入 timer + harness 夹具）落点真实 | 无 | 无 |

## 13. Required revisions

**无 BLOCKER、无 MAJOR。** 迭代 0 finding 与 SA8 行动的核销账（稳定 ID 保留用于修订映射）：

| Finding ID | 迭代 0 严重度 | 收口判定 | 核验要点（本轮独立复核） |
|---|---|---|---|
| R1 | BLOCKER | **核销** | C5a 断言/清单/插入位/授权/五处一致化（§2 详） |
| R2 | BLOCKER | **核销** | 选项 α 可行性（符号族自包含 + import 不进键面 + L616–619 原文） |
| R3 | MAJOR | **核销** | N OPEN → N 帧逐帧等值（首个 OPEN 亦是 waiter，:342）；kind 分派类型自洽 |
| R4 | MAJOR | **核销** | R4a/R4b 与单体 shim-reject/`finishOpenSilently` 逐点对齐；观测等价论证成立（closedFlag 早退） |
| R5 | MAJOR | **核销** | 四成员纪律入契约注释 + 伪码防御点 + 结构性核验（settleTail 恒 resolve） |
| R6 | MINOR | **核销** | 门 6/7 次序 = :304–315 |
| N1–N6 | MINOR | 全部核销 | §15 映射在文且内容相符 |
| SA8 A1/A2 | 阻断 | **核销** | 同 R2 + 证据链四处修正 |
| SA8 A3/A4/A5 | 非阻断/挂账 | 落档 | 读法登记/分歧三态/实现票边界 |

## 14. Non-blocking observations

1. **M1（ER-7，伪码-正文一致性）**：§8.2 `finishTerminal`/`sendNsReply` 的帧发送（`port.sendControlFrame(encodePlaceholder(namespaceErrorFrame(...)))`）无防御 catch，而 §8.3 R4 行声称「编码异常 → sendChecked catch 形状（防御；理论不可达）」。触发条件：宿主以有效但极小的 `limits.maxFrameBytes`（< ns ERROR 帧实际 ~90–150 字节；`validateLimits` 仅 `positiveSafeInteger` 无下限）配置工厂。影响：单体在该形态走 `sendChecked` catch → finalize failed + `namespace-failed{send-failed}` + settled（:1656–1672），适配器则逃逸至 `runSettle` 静默兜底（违背自设「全路径已分类」）且 `pendingOpenCount/pendingFrameCount` 不递减、缓冲不丢弃。修订建议：帧发送包 try/catch 镜像 sendChecked（失败 → 闩锁 + 丢弃 + settled + 可选 send-failed 事件），或删改 §8.3 行的防御声称使两处一致。不阻断：需非常规配置且单体同形亦无 wire 应答；建议实现票顺手收口。
2. **M2（工厂侧 `onConnectionDropped` 接线未写明）**：内部 edge 配置必填 `onConnectionDropped`（`hub-edge.ts:77`）；设计未说明工厂传入什么（合理缺省 = no-op，工厂无服务面连接清单）。建议实现票在 §7-D1 或 §8.1 补一句，防实现者误造第二连接登记表。
3. **M3（账目一致性小节）**：`runResolveInner` 的「连接已收口 + 迟归 sink」分支不递减 `pendingOpenCount`、不迁移 phase（`finishTerminalSilently` 有对应动作）；`finishTerminal` 缺 `finishTerminalSilently` 的 `rec == null` 防御早退。均无功能影响（连接已收口/记录结构性在场），实现票统一为单点收尾 helper 即可。
4. **M4（settled 的宿主协作面）**：established 会话的 settled 通知依赖宿主调用 `egress.namespaceSettled`（单体由通道 FSM 保证）。宿主漏调时 drain 提前收口不发生、deadline 兜底收口（行为降级为等预算，非错误）。契约已文档化（D2「drain 提前完成观测输入」），建议 test-d 或 D2 注释再点一句「漏调 = 等 deadline」的降级语义，防首个消费者误读。
5. **M5（re-OPEN established 应答的宿主义务）**：established 后 re-OPEN 的 OPEN_OK 应答由宿主 sink 经 egress 产出（单体 :314–325 即答）。这是缝形态的必然（OPEN_OK 内容 = 宿主知识），D2/§8.2 已写明；建议 test-d 注释强调「sink 收到 openNamespace 后必须应答」，避免宿主静默吞 OPEN 导致对端悬挂。

---

**评审结论**：迭代 1 设计对迭代 0 全部阻断项与 SA8 全部行动的收口经源码级独立核验**正确且完整**；架构主线与仓库惯例一致；文件范围与验收设计可安全实施。`approve`（`pass` 仅表设计通过，不替代 SA4/SA7 对实现与活链路的验证）。`requiresConflictRecheck`：设计 §14 已自判 true（公共 API 首发布 + 新生命周期/失败语义 + 四类 diff 核对面）——本轮无新增需要重跑 ADR 冲突检查的风险面，维持设计自判即可。

— SA2（Wallfacer），迭代 1，基线 `7039f6d`。
