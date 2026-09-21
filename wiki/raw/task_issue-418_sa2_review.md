# SA2 设计攻击评审 — issue #418：`HubConnectionImpl` 拆分 Edge/SessionHost + 单体进程内组合

- Dispatch：`sa-1e8aa9fb-bc44-4356-9366-a43fa0c49445`（mabf-sa2 / design-review / iteration 2）
- 评审对象：`wiki/raw/task_issue-418_design.md`（SA1，**iteration 2 修订版**，736 行——SA3 §7 BLOCKER 后的核心机制重写版）
- 基线：`/home/wangjian/nomicore-fix-issue-418`，分支 `mabf/issue-418`，HEAD `27e012b6606e48797842a79e11e3505819c34cc6`（worktree 内含 SA3 iteration 0 未提交实现——本次评审据此核验附录 B 适配量的真实性；`git status` 核实 `hub-namespace.ts` 未在改动清单，DENY 面现状成立）
- 本版任务：核验 iteration 2 对 SA3 §7 BLOCKER 的解决方案 A（**到达点建通道 + 异步 edge-owned admission**）是否真实落实、行为等价论证是否成立、既有测试面（含 I13 两锚）是否保全、新缝成员 `openAdmission` 是否被诚实门禁而非静默扩缝

## 1. Reviewed inputs

| 输入 | 状态 |
| --- | --- |
| `wiki/raw/task_issue-418.md`（Host 简报，Issue #418 body 5 条 AC；§Comments 空） | 存在，复核一致 |
| `wiki/raw/task_issue-418_design.md`（被评审设计，iteration 2，736 行） | 存在，全文核对（§1~§15、附录 A/B） |
| `wiki/raw/task_issue-418_sa3_impl.md`（SA3 实现报告，**reject**：§7 设计级 BLOCKER + §8 A1~A6 登记项） | 存在，全文核对；其 §7 方案 A 即本版修订蓝本 |
| `wiki/raw/task_issue-418_sa6_contract.md`（SA6 契约，approve；C0a~C0d + C1~C6 + U1~U5） | 存在，全文核对 |
| `wiki/raw/task_issue-418_design_conflict_report.md`（SA8 设计后冲突复查，clear + requiresConflictRecheck:true，针对 iteration 1 形态；注 A/B/C + §8-R1~R9） | 存在，全文核对；注 C 五点目的读法为本版 §15.1 论证基准 |
| `wiki/raw/task_issue-418_sa2_review.md`（本文件 iteration 1 版：approve + F5 MINOR + N1~N5） | 原位更新为本版 |
| Owner comments | 派工单明示 REST comments snapshot `[]`（dispatch 前读取）；简报 §Comments 为空 ⇒ 无 owner 追加要求 |
| `docs/adr/0032-transport-decoupling-edge-session-split.md`（已接受） | 本轮亲读全文（决策 1~5、否决备选、后果节）；决策 3 机制句「未授权 OPEN 不过缝，edge 复现…」与决策 2「缝无接纳信号」字面与本版形态的差距已逐句核对 |
| `docs/protocols/instance-replication-v1.md` | 约束面沿用 SA6/SA8 报告核对结论（§6.3/§21 drain、§7.1/§19、§13/§14） |
| `packages/ws-replication/AGENTS.md`（本次 dispatch 附带重申） | 已读；「Keep admission bounded across handshake, ready, backpressure, and drain windows」纪律对应设计 §13 R2 了结口径（见 §5） |
| 源码锚点复核（本轮亲读）：HEAD `hub-connection.ts`（revoke/requestReauth :406-448、channelHost 内联 :512-555、beginReauth :585-617 含 `:602` 直赋、revokeNamespace/maybeFinishDrainEarly :633-647、`onChannelSettled → maybeFinishDrainEarly` 单点 :529、dispatchReady :787-878、onOpenNamespace :880-894、withChannel :896-922）；`hub-namespace.ts`（onOpen :289-332、startOpen :335-459 同步前缀 + D-H1 注释、finishOpenError :483-503、isOpenAborted :529-531、onFieldViolation/onUpdate/onUpdateChunk :832-935、onUpdateAck/onCloseRequest/onResyncReceived/onErrorFrame/terminateUnauthorized :1095-1191、sendChecked/finalize/notifySettled :1651-1713）；两锚测试 `ws-replication-ac7-faults.test.ts:32-56`、`ws-replication-issue171-red.test.ts:60-77/170-212`（untilMicrotask 预算 3,000）；harness `settle()`（300 跳）；SA3 现状 `hub-split.ts`（109 行）/`hub-edge.ts`（二相 entry/日志/回放机械件 :86-400）/`hub-session.ts`（投影存储 + replayAuthorization :52-117）；`ws-replication-issue418-pending-window-matrix.test.ts`（M1 臂 + M1-revoke 臂 :559-594 + M2 :600-640 + fixture :151-210）；`ws-replication-issue418-edge-session-split-structure.test.ts`（stub 形态 :159-176）；SA6 契约测试（**全文零 seam/openNamespace/port 引用**，公共入口直测） | 逐点核对，与设计 §2 证据表及附录 B 适配量一致 |
| 全套测试 authorize 桩扫描（`grep authorize × channels/connections/channelState`） | **零命中**：无任何既有测试的 authorize 桩在调用时同步观察通道在场性（见 §7 SM-3'' 排序反转攻击） |
| 既有测试微任务泵面扫描（`await Promise.resolve()` 直用点） | 全部为循环预算泵（3,000/5,000/300）——R6' 的 1→约 3 跳被全套件安全吸收（见 §7 SM-5''） |

SA2 未修改任何生产代码、测试或设计文件；未运行测试/服务；唯一产物为本文件。

## 2. Verdict

**`approve`**（`requiresConflictRecheck: true`，见 §15）。

SA3 §7 BLOCKER 被真实、完整解决，且解决机制经源码逐点核验**由构造成立**：

- **BLOCKER 消解（方案 A 落地）**：D5 整体重写为「首个 OPEN 全解码后 `beginAdmission`（①台账+唯一真实 authorize）→ **无条件立即** `sink.openNamespace`（②到达点建通道 + `startOpen`）」。经源码复核：HEAD `onOpenNamespace`（:880-894）即「无通道同步建 + `channels.set` + `startOpen`」；`startOpen` 为同步方法发起 async IIFE，**同步执行到首个 `await this.host.authorize(...)`**——shim（D5.3）因此在 ② 内同步调 `port.openAdmission`，① 必须先行（D5.1 次序约束是承重且正确的）。由此两锚**由构造转绿**：
  - **I13a（ac7-faults:53）**：窗口 UPDATE → D4b R-delivered 命中台账 → 到达点进入零 diff 通道 `'opening'` 行 → `onUpdate` `:839-849` 同步产出 `NAMESPACE_STATE_VIOLATION` ns ERROR（sendNsError→sendChecked→port.sendControlFrame 全同步链）——`resolve()` 前 `hubFrames('ERROR')` 已含该帧；
  - **I13b（issue171-red:183）**：`openNamespace` 返回即 `channels.set` 完成、state `'opening'`，`untilMicrotask` 谓词首轮成立；投影面（edge face `channels` → session Map 同引用，A1 formalize）承载该白盒读。
- **等价判据较 iteration 1 净增强**：iteration 1 登记的「跨 ns 微任务交错」（R1）与「窗口效应推迟至结算」（SA8 §8-R6/R8 登记面）两类差随窗口日志/结算段回放机制删除而**整体消失**——窗口帧行为回到 HEAD 到达点原生形态；登记面收敛为两处（R4' 双不可达角落、R6' 微任务跳数），本轮独立复核均成立。
- **SA8 注 C 五点目的逐点保全且更强**（§15.1 复核简报如实）：真实 authorize 单点 edge、恰一次、入参逐值一致（HEAD `host.authorize(host.peerInstanceId(), nsId)` = service `options.authorize(authenticatedInstanceId, nsId)`，`peerInstanceId: () => this.authenticatedInstanceId` :518 核实）；被拒 ns 零会话资源（shim `{ok:false}` → HEAD 自身 `!authz.ok` 短路 :355-359，先于 registry.open）；失败面/闩锁由单份零 diff 通道原生；准入结算管线在 edge；`HubNamespaceChannel` 零 diff。
- **新缝面诚实门禁**：`port.openAdmission` 为行为面新成员、OPEN 过缝时序前移（结局产出之前）——设计不静默扩缝，按 SA8 §8-R9 口径登记为须重过 SA8 的新缝面（§15.1），并以 R9' 把「实现适配合入」显式阻塞在该复查之后。本评审 `requiresConflictRecheck: true` 与之对齐。
- **可实施性核验**：附录 B 适配量与 worktree 内 SA3 现状逐文件对上（`hub-edge.ts` 待替换机械件位于 :86-400 集中区；`hub-session.ts` 投影存储/replay 为局部面；`frame-io.ts`/`backpressure.ts`/`hub-connection.ts` 零功能改动成立——组合根 `sessionFactory` 装配 :443-444 已在位）；`hub-namespace.ts` 当前零 diff。

iteration 1 的 F5（revoked shim 形态矛盾）随 `revoked` 结局整体删除而消解（设计全文无「revoked 为现行机制」的矛盾残段——历史引用均为删除线/理由记录）。本轮新发现 **0 BLOCKER / 0 MAJOR**，4 条非阻断观察（§14）。

`approve` 的准确含义：设计内容足以安全实施且行为保持论证成立；**进入实现仍以 SA8 对本版（新缝成员 + 过缝时序前移 + R2/R6/R8 义务了结口径）的冲突复查为前置**（设计 §15.1/R9' 自设同一门禁）。`pass` 不替代 SA4/SA7 对实现与活链路的后续验证。

## 3. 需求覆盖

| Requirement | Design section | Assessment |
| --- | --- | --- |
| Issue：沿 `HubChannelHost` 内缝劈为 Edge/SessionHost，单体 = 进程内组合 | §7 D1/D2/D7 | 覆盖；D2 劈分总账与 `HubConnectionImpl` 成员逐项对上（iteration 1 已核；本版仅 D5 行替换，与 HEAD 时序还原一致） |
| Issue：零新公共 API、零配置变化 | §1 硬约束 / §7 D1/D8 / §11 DENY | 覆盖；两工厂 + 缝类型仅模块级导出（`HubNamespaceChannel` 不进 index 先例）；`index.ts`/`testing.ts`/`types.ts`/`defaults.ts`/`validate.ts`/`plugin.ts` 全 DENY |
| Issue：wire 逐字节不变 | §7 D3/D8、§1 等价判据 | 覆盖且**强化**：D3 出站机制逐字维持（iteration 1 已核）；本版把 authorize 窗口帧效应收回**到达点**（= HEAD），登记面收敛为 R4'/R6' 两处（本轮复核成立） |
| Issue：入站 sequence 由 edge 校验 | §7 D4a | 覆盖（iteration 1 已核，维持） |
| Issue：出站 session 占位编码 + edge 定偏移盖章 | §7 D3 | 覆盖（维持） |
| AC1 两个可独立实例化内部模块 + 单体组合 | §7 D1、§12 C0a~C0d | 覆盖；C0a/C0b stub 适配新缝（拉取形态）+ C0d 锁步断言升级为到达点 |
| AC2 出站单点盖章 + 入站收口在 edge | §7 D3/D4、§12 | 覆盖（C1/C2 + C0 白盒） |
| AC3 通道实现零改动 | §7 D5、§11 DENY、§12 | 覆盖且依赖**加深**：'opening' 行矩阵/terminateUnauthorized/D-H1 续体全部由零 diff 通道原生承载；worktree 现状 `hub-namespace.ts` 未改已核实 |
| AC4 既有全量测试逐字节绿灯（**不改而绿**，含 I13 两锚） | §1/§12 | 覆盖：两锚由构造保证绿（本轮源码级复核构造链）；SA3 证据（iteration 1 实现下 567/569 绿、唯二红即两锚）+ 本版机制向 HEAD 形态收敛 ⇒ 其余 567 绿面不动 |
| AC5 包 typecheck + 根 `pnpm typecheck`/`pnpm test` | §12 | 覆盖；入口沿用 SA6 §13 真实命令 |
| 非目标未静默扩大 | §1 非目标、§11、§13 Follow-up | 核对无扩大；worker 形态/导出面/peer 侧均留后续票 |

## 4. Owner评论覆盖

REST comments snapshot 返回 `[]`（派工单明示，dispatch 前读取）；简报 §Comments 为空。**无 owner 追加要求**——需求全集 = Issue body 5 条 AC + ADR 0032 决策 1~5（与 SA6 §2、SA8 §2 口径一致）。

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
| --- | --- | --- |
| SA3 §7 BLOCKER：iteration 1 结算段回放 vs AC4「不改而绿」2/569 红（ac7-faults:53 / issue171-red:183） | §7 D5 重写（方案 A）+ §14.1 映射 | **真实解决**（构造性，见 §2）；SA3 三条修复路的排除理由逐条复核成立（edge 合成 = 决策 1 fork；改测试 = DENY；方案 B 触碰 SA6 冻结契约） |
| SA3 A1（channels 只读投影） | §7 D1 formalize + D4b 路由事实源 = edge 台账 | 落实且更强：投影降为纯观测（组合根 face），不承载路由/drain 行为——worker 形态可迁移性成文于 D4b 备选否决记录 |
| SA3 A2/F5（revoked shim 形态矛盾） | `revoked` 结局整体删除（D5.2/D5.3） | 落实：矛盾载体不复存在；shim 两态唯一（denied/throw）；设计无矛盾残段（本轮全文扫描） |
| SA3 A3/A4/A5（routingKeyOf 响亮 / requestSinkClose 幂等 / R4' 不伪造测试） | D4a / D2/D6 / D3.3+§13 R4' | 维持（iteration 1 已核） |
| SA3 A6 + SA8 §8-R4（pending 有界缓冲义务） | §13 R2 就地了结：零新增缓冲面（窗口帧零缓冲；台账 ≤ 通道数、与 `channels` Map 同阶 = HEAD 既有增长面）；worker 票重新进入 | 论证成立：台账为 per-ns 一次性 `{promise, resolve}`，基数 ⟺ HEAD channels Map（listen 只增不减）；「本票收尾不得宣称决策 3 全部兑现」的诚实措辞保留；义务了结口径请 SA8 随 §15.3 确认（属裁决面，非设计缺口） |
| SA8 §8-R5（worker 形态前置门禁） | §13 R5 扩面（openAdmission 拉取形态一并重过） | 落实 |
| SA8 §8-R6/R8（推迟等价类/never-settling 登记） | §13 R1/R8 关闭：到达点机制下推迟类不存在；never-settling 与 HEAD 逐点一致（通道 `'opening'` 无限停放、无 authorize 超时——源码复核 HEAD 确无该超时面） | 落实；关闭口径请 SA8 复核（§15.3） |
| SA8 §8-R7（ADR/CONTEXT 文本调和） | §13 R8'：描述差**扩大**（拉取形态 + 时序前移），维持「worker 票 SA8 前置门禁之前或之中正式落修订」义务，且在此之前任何票不得援引机制句字面迫使回退 | 落实（诚实登记扩大而非淡化） |
| SA8 §8-R9（R4' 维持 / R7 撤销） | §13 R4'/R7 + §15.3 | 落实；R7 撤销依据（revoked 删除 → revoke-窗口-ok 走 HEAD 原生 D-H1）经源码复核成立 |
| SA8 注 C 五点（iteration 1 裁决） | §15.1 逐点重申且以本版形态重推（通道存在性/到达点效应使字面读法矛盾更直接） | 落实；新缝面 + 时序前移 = SA8 未裁决面，门禁到位 |
| SA6 C1~C6 全绿基线 / U1~U5 | §3 G4、§5、§11、§12 | 维持；C2c/C2d 在 edge 直调形态下语义保持（入参逐值一致，§2 核实） |
| 模块 AGENTS「admission bounded」四窗口 | §13 R2：handshake（早到帧 ≤16 既有）/ready（窗口零缓冲）/backpressure（额度账本既有）/drain（drain 门既有） | 覆盖：无新无界面 |

## 6. 设计内部一致性

| # | 检查 | 结论 |
| --- | --- | --- |
| C-1'' | D5.1 到达点投递 vs HEAD `onOpenNamespace`（:880-894） | **逐行一致**（无通道 → new + set + startOpen；有通道 → onOpen）；次序约束 ①→② 与 `startOpen` 同步前缀语义（async IIFE 同步执行至首个 await → shim 同步拉取）经源码核实承重成立 ✓ |
| C-2'' | §2.2 窗口帧矩阵（12 行）vs `hub-namespace.ts` | 逐行复核一致（UPDATE :839-849、onFieldViolation :832-837、UPDATE_CHUNK kind0/1/2 :884-935、BOOTSTRAP_ACK 静默门 :650-656 前置、UPDATE_ACK→`host.connectionFatal` :1095-1102、CLOSE_NAMESPACE→closing 链+CLOSE_OK :1104-1132、RESYNC→needs-resync 且不中止 ok 续体 :1134-1148、ERROR→received+finalize :1150-1171、CLOSE_OK→onErrorFrame、SYNC_STEP1/2 RoundAborted 吞、再 OPEN 合流 :309-313）；矩阵推论（fork/缓冲延迟/缓冲丢弃三路皆破更高规范面）成立 ✓ |
| C-3'' | D5.2 结算映射 vs HEAD `startOpen` 判别 | 等价：edge 单分支折叠 `!ok ∨ !read → denied`，shim `{ok:false}` → 通道 `!authz.ok` 同一 NAMESPACE_UNAUTHORIZED 出口；throw（同步+异步）→ shim reject → `startOpen` catch → INTERNAL_ERROR（HEAD 亦丢弃错误值，`:344-359` 核实）；authorized 携完整 ok-投影（localOwner/permissions——types.ts 核实字段集）✓ |
| C-4'' | D4b 三案路由（R-pending 删除）vs D5.1 台账 | 一致：台账 ⟺ 首个 OPEN 已投递 ⟺ 通道在场（锁步）；R-delivered 含窗口期；R-none/R-violation/ERROR 特例逐字维持（HEAD withChannel :896-922 对照）；drain 门先于路由（HEAD dispatchReady 门序 :787-806 同构，现实现 :525/:551 在位）✓ |
| C-5'' | D5.4 两量判定 vs HEAD `maybeFinishDrainEarly`（:640-647） | 同构全覆盖（见 §7 SM-4''）；单触发点（`onChannelSettled` :529——HEAD 全类唯一调用点 grep 核实）保持 ✓ |
| C-6'' | D1 缝契约（17 成员 port）vs 现实现 16 成员 + `openAdmission` 新增 | 一致；`HubOpenAdmission` 三态（revoked 已删）；`HubSessionSink` 6 成员维持 ✓ |
| C-7'' | D6 信号映射 + `openAdmission` 与决策 2「无接纳信号」的区分 | 论证成立：被否决的是逐帧出站 sent/deferred/rejected 回执（背压语义）；本成员为每 (连接, ns) 一次性授权结局载体，缝词法类（纯 JSON）不变 ✓ |
| C-8'' | 附录 B 适配量 vs worktree SA3 现状 | 逐文件对上（`hub-edge.ts` 机械件集中区 :86-400；`hub-session.ts` projections/replay :52-117；`hub-connection.ts` 组合根/`sessionFactory` :443-444 在位零功能改动；`frame-io.ts`/`backpressure.ts` 本版零改动）✓ |
| C-9'' | 已删除机制的残段扫描（revoked/R-pending/二相/窗口日志/强制结算/结算段） | 全部为删除线/历史理由/修订映射语境，无「作为现行机制」的矛盾表述 ✓ |
| C-10'' | §11 ALLOW/DENY vs §12 验收映射 vs 正文 | 一致（见 §11 审查）；`hub-connection.ts` ALLOW 行「零功能改动」与附录 B 一致 ✓ |

## 7. 状态机与并发攻击

针对本版**新机制**（到达点建通道 / admission 台账与锁步 / openAdmission 拉取 / drain 两量化）重放攻击；iteration 1 已通过的行（收口五路、liveness、reauth、早到帧、出站次序）不重复。

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
| --- | --- | --- | --- | --- | --- |
| SM-1''（BLOCKER 消解核心重验） | 首个 OPEN 到达（无台账） | edge 全解码后 | 同一同步段内：① `beginAdmission`（台账 set **先于** authorize 调用——D5.2 伪代码次序核实）→ ② `sink.openNamespace` → 通道在场 `'opening'` → `startOpen` 同步前缀 → shim 同步拉取台账命中 | 无：①/② 同段无外部事件可插入；台账在 authorize 调用前已写入（含同步 throw 被吸收为已结算 throw 结局的角落——shim 后挂 `.then` 于已结算 promise 语义良好） | 无 |
| SM-2''（窗口帧到达点效应） | 通道 `'opening'`（authorize 在途） | 同 ns 非 OPEN 帧依序到达 | §2.2 矩阵逐 kind 在到达点产出 wire/事件（含 UPDATE_ACK 连接级 fatal、CLOSE_NAMESPACE→CLOSE_OK 收口链、RESYNC→needs-resync 不中止 ok 续体） | 无：R-delivered 即时投递 + 零 diff 通道 FSM 原生承载；矩阵 12 行经源码逐行复核；ac7-faults:53 锚由全同步链（onUpdate→sendNsError→port.sendControlFrame→盖章→transport.send）保证 `resolve()` 前已上 wire | 无 |
| SM-3''（真实 authorize 调用点前移的排序反转） | 首个 OPEN 分派中 | authorize 被调时通道尚未创建（HEAD：通道已 `'opening'`） | 两形态均在同一同步段内完成；可观察面应零差 | 无实质缺口：HEAD 在 `startOpen` await 处调 authorize（通道已建）；本版在 `beginAdmission` 调（通道未建）——仅当宿主授权器**同步**观察 `channels` 白盒面才可分辨。本轮扫描全部 54 个含 authorize 的测试文件：**零**桩在调用内同步读通道/连接状态（ac7-faults 计数桩、issue171-red 先等 `'opening'` 再放行、matrix fixture 推迟 settler——均不敏感） | 无（建议见 N3'） |
| SM-4''（drain × admission 在途；F2 机制重验） | drainActive；nsA authorize 在途（`'opening'`） | 最后一个非 pending 通道 settled | HEAD：`maybeFinishDrainEarly` 迭代全部通道，nsA 非终态 → 阻塞；nsA 结算（ok→流转/deny→failed）→ settled 信号 → 放行 | 无：两量公式 `∀ keys ∈ settledNames` 全覆盖——含**通道先于 admission 结算**的角落（窗口 UPDATE → failed → settled → 该 ns 入 settledNames → 不阻塞 = HEAD 终态通道不阻塞，两侧同放行）；`'closing'` 未 settled → 阻塞（= HEAD closing ∉ 终态集）；空集/已全终态角落两侧同收敛（唯一触发点保持，无 settled 信号即不评估）；M2 行为锚在位 | 无 |
| SM-5''（authorize 结算续体跳数；R6'） | authorize promise resolve | 续体运行（registry.open/OPEN_OK 或 finishOpenError） | HEAD 1 跳；本版约 3 跳（edge `.then` 结算 → shim `.then` 映射 → await 恢复） | 无：帧/事件序在到达点已固定，跳数仅影响续体何时运行；全套件泵预算（settle=300、untilMicrotask=3,000、deepDrain=5,000——本轮逐一核实）与零 wall-clock 依赖使 1→3 不可观察；R6' 已登记 | 无 |
| SM-6''（revoke × 窗口；R7 消除重验） | 通道 `'opening'`（authorize 在途） | 服务层 `revoke` | HEAD：`terminateUnauthorized` 响亮（ns ERROR + protocol-violation + settled）+ 迟归 ok 续体 D-H1 transient `registry.open` + lease 回收（零 wire/零事件） | 无：本版无条件 `sink.terminateNamespace` = HEAD `channels.get()?.terminateUnauthorized()` 形态（session 实现核实）；通道在场使整链零 diff 原生；M1-revoke 臂重定基与 HEAD 一致（见 §12）；iteration 1 的 R7 微差随 revoked 删除消除 | 无 |
| SM-7''（窗口 × 连接收口；H1 重验） | 通道 `'opening'`；authorize 在途 | 五路收口任一 | HEAD：`'opening'` 通道经 quiesce/onConnectionClosed 静默收口；迟归续体 `isOpenAborted` → 静默 / D-H1 显式回收已交付 lease | 无：`sink.close()` 承载（= HEAD 全量通道扇出）；admission 无条件结算传播（D5.2 `.then` 闭包独立于连接状态）使迟归续体照常运行——issue171-red:194 锚依赖此，构造保全 | 无 |
| SM-8''（同 ns 再 OPEN × 台账） | 台账命中（通道 opening/已建立/终态/closing） | 再 OPEN 到达 | opening→openWaiters 合流（零 authorize 零帧）；已建立→立即 OPEN_OK；终态→REOPEN_REQUIRES_RECONNECT；closing→收口链补发 | 无：台账命中 → 仅投递 → 通道 `onOpen` 重开矩阵（:289-332 零 diff）；「每 (连接, ns) 恰一次 authorize」由台账 + openInFlight + onOpen 合流三重保证（C2c 面） | 无 |
| SM-9''（never-settling 授权器；R8(ii)） | authorize 永不结算 | 窗口帧持续到达 | HEAD：`'opening'` 通道无限停放，窗口帧即时产出效应 | 无：本版逐点一致（台账一条 pending promise，无新增无界面——基数 ≤ channels Map）；harness 授权桩收尾必须 settle 的既有纪律不变 | 无 |

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
| --- | --- | --- | --- | --- |
| ER-1''（迭代沿用） | session 占位编码抛错（字段/帧超限族） | 同步经缝传播回 `sendChecked` catch 按 `.code` 折叠（string code → ns ERROR + failed('send-failed')；`OutboundExhaustedError` 无 code → 静默 0） | 与 HEAD 一致（iteration 1 已核，本版未触碰出站面）；R4' 双不可达角落维持登记 | 无 |
| ER-2'' | 台账缺失（不变量破坏）时 shim 拉取 | `openAdmission` reject → shim reject → `startOpen` catch → INTERNAL_ERROR + failed（响亮 fail-loud，无静默 fallback） | 组合形态结构性不可达（SM-1'' 次序约束）；C0b 拒绝臂断言锚（手工拼装两半唯一可达面） | 无 |
| ER-3'' | authorize 同步 throw / 异步 reject | D5.2 try + 双回调吸收为 `throw` 结局（= HEAD async IIFE try 语义）；错误值两侧同被 catch 丢弃（HEAD `catch {}` 核实），仅「抛出」事实上 wire（INTERNAL_ERROR） | ✓ 等价 | 无 |
| ER-4'' | 授权器返回非 thenable（类型违约宿主角落） | D5.2 直接 `.then` 访问 → TypeError → 被 sync catch 吸收为 `throw` 结局 → INTERNAL_ERROR；HEAD `await` 对非 promise 返回值宽容（按值结算） | 仅类型契约违约宿主可达；现有全部桩返回 Promise；无测试面 | 无（观察 N1'：建议契约注释登记 thenable 前提或 `Promise.resolve()` 包裹） |
| ER-5'' | 迟归 authorize / 迟归 revoke（收口后） | admission 照常结算（传播无条件）→ 续体 `isOpenAborted` 静默 / H1 回收；terminateNamespace 命中 quiet → no-op resolve | ✓ = HEAD（D5.5/D5.6） | 无 |
| ER-6'' | port 字节路径缺可选宿主成员 | 构造期/首用响亮 throw | ✓（iteration 1 已核，维持） | 无 |
| ER-7'' | R-none 合成 ns ERROR 的发送自身失败 | HEAD `withChannel` try/catch + 事件仍发（连接收口吞发送异常）；edge 逐符号迁移 | ✓（现实现 :621 在位） | 无 |

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
| --- | --- | --- | --- |
| `src/index.ts` 11 运行时导出 + `/testing` 5 + DEFAULT_* 三常量 | 无：C5a/C5b 冻结 + DENY 兜底 | index.ts；SA6 C5a/C5b | 无 |
| `HubConnection` 服务面（revoke/requestReauth promise 语义） | 无：terminationSettled / 无副作用 resolve 逐点保持（D5.5 无条件投递 = HEAD `channels.get()?.` 形态，session 实现 :286-291 核实）；`authenticatedInstanceId` 键语义不变 | HEAD hub-connection :406-448；现 hub-session :286-291 | 无 |
| `HubChannelHost` 24 成员注入面（含 authorize） | 无：session 组装、形状不变；authorize 成员实现换拉取 shim（签名不变），其余消费方（update-channel/bulk-transfer/round-engine/fence-watchdog）零感知 | hub-namespace :52-100；§10 | 无 |
| SA6 契约测试文件（17 用例，DENY） | 无：**全文零 seam/openNamespace/port 引用**（本轮 grep=0），公共入口直测；C2c/C2d 恰一次/入参在 edge 直调形态下语义保持（SM-3'' 论证） | 契约文件在位 | 无 |
| 既有 13 文件白盒 `hub.connections[0].channels` 读 | 无：edge face → session Map 同引用投影（A1）；**窗口期即有值**（到达点建通道——iteration 1 下 issue171-red:183 无值的 1 处回到 HEAD 形态） | §10；issue171-red fixture :170-176 | 无 |
| 6 个直构 `OutboundQueue`/`ConnectionSender` 测试 + peer 侧 | 无：message 形态原签名/必选成员零变化（本版未触碰 D3） | §10；SA3 现状 | 无 |
| C0a/C0b stub halves（ALLOW 测试） | stub 适配已规划（stub sink 收 `openNamespace(msg)` + 脚本化拉取；stub port `openAdmission` 四形态臂）+ R10 漂移风险登记 + 缓解（时点断言 + 四臂覆盖） | §12/§13 R10 | 无 |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
| --- | --- | --- | --- |
| 连接 FSM / 序列 / HELLO / liveness / GOAWAY / 背压 | edge（决策 1） | hub-edge.ts | ✓ |
| 通道全部生命周期 / Registry open / session 驱动 / 出站合并 | session（决策 1） | hub-session.ts + hub-namespace.ts（零 diff） | ✓ |
| 真实 authorize（恰一次）+ 准入结算管线 | edge（决策 3） | D5.1/D5.2（台账 + beginAdmission + 结局映射） | ✓；shim 拉取形态使 session 对真实授权器**结构性不可达**（只能消费已结算结局，无法注入/影响/重试）——比 iteration 1 投影回放更强 |
| 拒绝闩锁 / 失败面 / 静默门 | 零 diff 通道（session） | D5 原生承载 | ✓（edge 复现面维持归零——C0c 结构判据） |
| OPEN 帧路由 | edge（决策 4） | D4b（台账事实源） | ✓；路由不读对侧容器，worker 形态结构前提成文 |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
| --- | --- | --- | --- | --- |
| 内部模块 + 测试相对导入 | frame-io/backpressure/hub-namespace 先例 | 两工厂仅模块级导出 | 一致 | 仓库惯例（SA6 GAP1） |
| 接缝注入风格 | `HubChannelHost`/`ConnectionSenderHost` | `HubSessionEdgePort`/`HubSessionSink` | 一致 | 同款类型缝 + 工厂注入；新增 `openAdmission` 为既有 authorize 成员的跨半边载体（形态变化已门禁 SA8） |
| 等待/合流语义 | openWaiters（:309-313） | 再 OPEN 直接走 openWaiters（无平行等待机制） | 一致 | 迭代 1 的窗口日志/二相 entry 整体删除——比 iteration 1 更贴 HEAD |
| promise 台账先例 | 早到帧 admission / inboundAssemblySlots（连接级 Map 台账） | admission 台账（per-ns 一次性） | 一致 | 同款「连接级 Map + 生命周期内只增」形态，基数同阶 channels |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
| --- | --- | --- | --- |
| 通道在场性 | session `channels` Map | edge admission 台账（投递动作记录） | 低：锁步不变量在 D5.1 同一同步段成立（①先于②、②内同步建）+ C0d 到达点断言钉死；**路由/drain 均读台账不读投影**（D4b 决策——edge 自持其自身动作的记录，非镜像对侧状态） |
| 授权决定 | edge 单次真实 authorize 的结算 | admission promise 结局（authorized/denied/throw） | 低：至多结算一次；denied 单分支折叠映射 HEAD 唯一出口；shim 无第三形态（F5 载体删除） |
| drain 完成判定 | HEAD：全部通道终态 | edge `admissions.keys ⊆ settledNames` | 低：两量单调 + 同构全覆盖（SM-4''）；M2 锚 |
| `channels` 投影 | session Map | edge face 只读同引用 | 低：纯观测（A1），无行为依赖 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
| --- | --- | --- | --- |
| edge 构造（sessionFactory 建 session）→ 早到帧重放经同一管线 | `sink.close()`（同步 quiesce + 异步尾）+ transport.close + cleanupAll → onConnectionDropped | 五路收口同构；`'opening'` 通道随全量扇出收口；迟归 admission 传播不切断（H1 依赖） | ✓ 对称 |
| 通道 registry.open/lease/session | 既有通道收口链（零 diff） | isOpenAborted 静默回收（D-H1 显式回收已交付 lease） | ✓ |
| admission 台账 | 连接生命周期内只增不减（与 channels 同阶） | 连接 drop 后随 edge 对象整体回收 | ✓ 无悬挂清理义务（迭代 1 的 dropPendingEntries 删除——少一个不对称面） |

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
| --- | --- | --- | --- |
| 第二套窗口等待/回放 | openWaiters | （已删除）窗口帧零缓冲、到达点投递 | 已消除 ✓（iteration 1 最大平行面随 D5 删除） |
| 第二套 authorize/拒绝面复现 | host.authorize/finishOpenError | edge 单点 + 零 diff 通道原生 | 已避免 ✓ |
| 第二套 drain 判定 | maybeFinishDrainEarly | edge 两量判定 | 形态换轨但单点 + 同构（SM-4''）✓ |
| 第二套字节 mux | OutboundQueue.emitOne | 复用同一 emitOne | 已避免 ✓（本版未触碰） |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
| --- | --- | --- |
| ALLOW：`hub-split.ts`（删 revoked/增 openAdmission/openNamespace 去参/注释重写）、`hub-edge.ts`（删机械件 + 台账 + 到达点投递 + 三案路由 + revoke 无条件化 + drain 两量）、`hub-session.ts`（删投影存储 + shim 改拉取） | D1/D4b/D5；与 worktree 现状逐文件对上（附录 B 真实） | 无 |
| ALLOW：`hub-connection.ts`「零功能改动（头注释）」 | 组合根/sessionFactory 已在 SA3 现状就位（:443-444 核实）；本版缝变化不触及该文件功能面 | 无 |
| ALLOW：`frame-io.ts`/`backpressure.ts`「维持 SA3 现状」 | D3 本版未触碰 | 无 |
| ALLOW：两 #418 测试文件适配（stub 拉取化 + M1 到达点强化 + M1-revoke 重定基 + 「edge 无 OpenEntry/PendingEvent 符号」结构断言） | §12；ALLOW 内测试随缝形态更新、断言强度不降（到达点断言与 registry spy 均为**增强**；revoke 臂重定基钉的是 HEAD 真实行为，非弱化） | 无 |
| ALLOW：codec 守卫测试维持 | 决策 4 | 无 |
| DENY：`hub-namespace.ts`（零 diff——本版依赖加深）、冻结面（index/testing/types/defaults/validate/plugin）、peer 侧、机械件、`replication-protocol/src/**`、既有 73 测试文件（含 SA6 契约 + ac7-faults + issue171-red）、docs/CONTEXT/apps/根配置 | 与正文零冲突；worktree 现状 `hub-namespace.ts` 未改已核实；SA6 契约文件公共入口直测（零 seam 引用）不受缝变化影响 | 无 |
| 无理由扩张 / DENY 与正文冲突 / follow-up 掩盖必要项 | 未发现；R2 义务了结措辞如实（「无新增适用面」而非「全部兑现」）；worker 形态项全部留后续票且不预留公共面 | 无 |

文件范围判定：**通过**。

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
| --- | --- | --- | --- |
| AC1（C0a~C0d） | C0a stub sink 到达点收 OPEN（authorize 未 resolve 前）+ 拉取结局；C0b 四形态臂（ok/denied/throw/**reject 响亮**）+ 真实 Registry 全生命周期；C0c 结构审阅（edge 无复现影子/二相 entry/结算回放）；C0d 锁步升级为**到达点在场**（`openNamespace` 返回即 `channels.has` 真，authorize 未 resolve 亦然） | 无阻断（stub 适配风险已登记 R10 + 缓解） | 无 |
| AC2/AC3/AC5 | C1/C2 + `git diff --stat` 零变更门禁 + 门禁清单 | 无 | 无 |
| AC4（两锚由构造转绿） | 全量 75 文件（72+SA6 契约+本票 2）+ 根套件；SA3 证据链（iteration 1 下 567/569 绿、唯二红即两锚 → 本版机制向 HEAD 收敛，绿面单调不减） | 无 | 无 |
| **M1 窗口矩阵（必做 + 到达点强化）** | 10 臂 × {ok,deny}（期望值 = HEAD 基线，SA3 已两态采集 25/25）+ **新增到达点断言**（响亮臂 wire 帧在 `resolve()` 前已在 `transport.frames()`——iteration 1 下红、HEAD 绿、本版必须绿） | 无（方法论正确：特征化基线 + 对新机制更严的时点断言） | 无 |
| **M1-revoke 臂重定基** | wire/事件断言不变（到达点 NAMESPACE_UNAUTHORIZED + protocol-violation + settled；迟归 ok 后零新帧零新事件——**两侧同为真**：finishOpenSilently 零 wire 零事件，transient registry.open/lease 释放不在 replication observer 流，本轮核实 fixture 仅捕获 ReplicationObserverEvent）；资源断言改为 registry spy（HEAD 基线：迟归 ok 后恰一次 transient `registry.open` + lease 释放）；先 stash 采 HEAD 基线 | 无（重定基方向 = 钉 HEAD 真实行为，非弱化；fixture 经 options.registry 注入，spy 可组合） | 无 |
| M2 drain-pending / M3 零新事件 | 维持（D5.4 包含式收编行为锚 / L1 直赋零事件锚） | 无 | 无 |
| 决策 4 守卫 / D3.3 次序等价 | codec 结构守卫维持；既有 6 直构测试 + issue169/231 族；R4' 登记不伪造测试 | 无 | 无 |
| R6' 微任务跳数 | 显式泵形态验证（M1/H1/C2c）；无 wall-clock 依赖 | 无（本轮泵面扫描：300/3,000/5,000 预算，1→3 跳不可观察） | 无 |

## 13. Required revisions

| Finding ID | Severity | Evidence | Problem | Required change | Acceptance |
| --- | --- | --- | --- | --- | --- |
| ~~F1~~ | ~~BLOCKER~~ | — | **已解决**（iteration 1）且本版机制更强（到达点原样取代输入序列重放；SM-1''/SM-2'' 重验） | — | — |
| ~~F2~~ | ~~MAJOR~~ | — | **已解决且公式收敛**（三量→两量，pending 包含式收编；SM-4'' 重验含通道先于 admission 结算的角落） | — | — |
| ~~F3~~ / ~~F4~~ | ~~MINOR~~ | — | **已解决**（iteration 1；本版逐字维持 §2.4/D8 与 §2.3/D3.3） | — | — |
| ~~F5~~ | ~~MINOR~~ | — | **已消解**：`revoked` 结局整体删除（D5.2/D5.3），shim 形态唯一化（denied/throw）；设计全文无矛盾残段 | — | — |
| **SA3 §7 BLOCKER** | ~~BLOCKER~~ | — | **已解决**（本版核心修订，方案 A）：D5 重写 + 两锚构造转绿（§2/§7 SM-1''~SM-2''）+ §14.1 映射逐行核实为真实修订 | — | — |

**当前 finding 集：空（无 BLOCKER/MAJOR/MINOR 阻断项）。**

## 14. Non-blocking observations

- **N1'（D5.2 对授权器返回值的前置）**：`authorize(...)` 的返回值被直接 `.then` 访问；若宿主注入的授权器违反 `NamespaceAuthorizer` 类型契约返回非 thenable，本版得 TypeError → sync catch → `throw` 结局 → INTERNAL_ERROR，而 HEAD 的 `await` 对非 promise 返回值按值宽容结算。仅类型违约宿主可达、无既有测试面。建议在 `HubReplicationEdgeConfig.authorize` 或 `openAdmission` 契约注释登记 thenable 前设（或 `Promise.resolve()` 包裹一行消差），防实现者/宿主踩坑。
- **N2'（C0d 结构断言形态）**：「edge 无 OpenEntry/PendingEvent 符号」允许「源文本扫描或行为证明」二选一；源文本扫描与本仓「断言面 = 运行时行为」的测试纪律略有张力（SA6 S9 明文禁源码字符串断言——虽仅约束 SA6 自有文件）。建议实现优先落行为证明（窗口帧到达点即投递、零缓冲可由 M1 到达点断言 + C0d 锁步断言联合承载），源文本扫描至多作辅助。
- **N3'（SM-3'' 排序反转建议成文）**：真实 authorize 调用点较 HEAD 前移到通道创建之前（同一同步段内）。现有全部授权器桩不敏感（本轮扫描零命中），但这是实现者容易误「修正」的隐含次序（例如把 ② 提到 ① 前以「贴近 HEAD」——恰破坏 shim 拉取的台账前提）。D5.1 次序约束已有明文；建议实现注释里把「① 先于 ② = shim 拉取前提」与「authorize 调用点前移 = 与 HEAD 同段不可分辨」两句一并固化，防猜测性重排。
- **N4'（R6' 跳数口径）**：约 3 跳的估计与 shim 链路（edge `.then` → shim `.then` → await 恢复）逐环核实一致；若实现为消跳数把 shim 改为同步返回已结算值（admission 已结算时），语义仍等价（`await` 包裹非 promise 同值结算）——属实现自由度，非设计义务，不需要为此改设计。
- **N5'（SA8 复查焦点的 SA2 侧补充）**：§15.1 请裁三点中，(b)「OPEN 在结局产出前过缝」是字面差距最大的一点；SA2 侧证据支持目的读法延伸——通道在场性与到达点效应本身即既有测试面（I13 两锚，DENY 保护），字面「未授权 OPEN 不过缝」在本角落同样迫使「wire 逐字节不变（AC4）」或「单份 FSM（决策 1）」必破其一，与 SA8 注 C 第 1 点同构且更直接。此为 SA8 裁决面的证据补充，不构成本评审的独立门禁。

## 15. 复查路由建议（供 Controller）

1. **`requiresConflictRecheck: true`**：SA8 须对本版重跑冲突检查，焦点——(i) 新缝面成员 `port.openAdmission`（SA8 §8-R9 口径：行为面成员）作为决策 3 authorize 跨半边载体的可接受性（§15.1(a)）；(ii) OPEN 在 authorize 结局产出**之前**过缝对「未授权 OPEN 不过缝」机制句的目的读法延伸（§15.1(b)；N5' 证据补充）；(iii) 义务账三处状态变化确认：R4 就地了结、R6/R8 消解、R9 中 R7 撤销（§15.3）；(iv) R4' 维持与 R6' 新登记的接受性。**SA8 裁决通过前，本版 §11 的实现适配不应合入**（设计 R9' 自设同一门禁）。
2. 实现期门禁沿用 §12/附录 A：HEAD 基线先行采集（M1 各臂 + revoke 臂资源基线）→ 缝/两半适配 → 两锚必须绿 → M1/M2/M3 + C0a~C0d + 全量 + 双 typecheck；`hub-namespace.ts` 等 DENY 面 `git diff --stat` 零变更逐项执行。
3. N1'/N2'/N3' 可随实现落地（注释/测试形态层面），无需再走设计修订。
