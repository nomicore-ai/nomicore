# 冲突门禁报告（实现复查）— issue #450

**被审对象**：SA3 实现交付（`wiki/raw/task_issue-450_sa3_impl.md`，dispatch `sa-018ababa-7198-4561-b785-c8bafda7a2eb` / mabf-sa3 / implementation / iteration 0）——worktree 当前 diff：`packages/ws-replication` 生产 3 文件 + 模块 `AGENTS.md` + 既有测试 2 文件修改、新建测试 2 文件，及 `artifacts/sa3-issue450-*.log` 证据 12 份
**门禁类型**：实现复查（implementation 复查；触发条件成立——SA8 iteration 1 设计报告登记实现期复核义务 R1–R7 + `requiresConflictRecheck: true` 的五项待核对面；SA4 quality review 并行派发中，其产物尚未在场，非本报告输入）
**门禁轮次**：iteration 0（dispatch `sa-75eaa825-e651-443e-b9ac-b3f062bf330f` / mabf-sa8 / conflict-gate；无同类历史报告，本文件为首份 implementation 冲突报告）
**基线**：worktree HEAD `444c166`（与 SA6/SA1/SA2/SA8 设计轮基线同一 commit）；`git status` 实查 = 恰 6 个 ALLOW 修改文件 + 2 个 ALLOW 新建测试文件 + `wiki/raw/task_issue-450*` 工件与 `artifacts/sa{3,6}-issue450-*.log`——**规范文本（ADR 0032 / 协议 / CONTEXT.md）与 `src/index.ts` 零触碰**；`git diff --check` exit 0。本轮**未运行任何测试**（SA8 纪律）；验证门结论取自 SA3 落盘证据日志的文本核对 + 源码/diff 逐行核验。

---

## 1. Reviewed subject

- subject = **implementation**（SA3 交付的当前 diff + 其报告申报面）。核对维度 = 任务明示四项：**ADR 0032**（附录 A4 + 决策 1/2/5 + 后果节）、**协议 §24**（含 §17/§23.1 邻接条款）、**仓库架构**（模块 `AGENTS.md` 契约、公共导出面、#447/#448/#421 前序冻结面）、**SA8 iteration-1 ruling**（`task_issue-450_design_conflict_report.md`：§16 读法 A 裁定 + §8 R1–R7 实现期复核义务 + §10 五项待核对面）。
- 上游输入（全部在场已读）：Host 简报（7 AC，`## Comments` 空）、SA6 验收契约（approve）、SA1 设计 iteration 1（517 行，两翼版）、SA2 评审 iteration 1（**verdict `approve`**，F-1 关闭）、SA3 实现报告。缺席（非阻塞）：SA4/SA9 产物（并行派发未 settle）；`task_issue-450_relevant_decisions.md` / `_conflict_report.md`（前置门禁产物从未存在——设计轮已同判非阻塞）。
- **Issue 评论 REST 快照为空**（简报 + dispatch log + 本 dispatch 三方一致）⇒ **无 Owner override 权威可用**；需求全集 = Issue 正文 AC×7 + ADR 0032 A4.3/A4.5 + 协议 §24.5/§24.7。
- 变更面实查（`git status` / 逐 diff）：`src/backpressure.ts`、`src/hub-edge.ts`、`src/hub-edge-host.ts`、`packages/ws-replication/AGENTS.md`、`test/issue447-async-seam.ts`、`test/ws-replication-issue421-edge-factory-api.test-d.ts` 修改 + `test/issue450-flow-seam.ts`、`test/ws-replication-issue450-flow-lifecycle.test.ts` 新建——与设计 §11 ALLOW LIST 八行**逐一对应、零越界、零 DENY 触碰**。

## 2. Inputs and decision set

决策集（全部现行为准、本轮逐条重核原文；ADR 编号至 0032 止、无 supersede）：

| 决策源 | 状态 | 相关条款 |
|---|---|---|
| `docs/adr/0032-transport-decoupling-edge-session-split.md` | 已接受 | 决策 1（:14 单份实现）、决策 2（:18 缝无接纳信号 + 1011 终局兜底）、决策 5（:30 缺面 dormant）、A4.1（:61-65 缝词汇闭集合）、**A4.3（:77-79：流控单点；删除 `dataGateOpen`/`connectionState`/`bufferedAmount` 前置检查；账本投影越界即 1011 收口整条连接——无逐帧拒纳、无 deferred、无 ns 级 send-failed resync；单帧超限 = 配置错误 → 响亮收口 + 诊断；β/γ 显式行为差；OPEN 水位 = 故障参数）**、A4.5（:85-87 生命周期单规则）、A4.6（:89-91）、A4.7（:93-95 观测口径）、A4.8（:97-99 验收纪律）、后果（:112 公开面冻结、演进只能 append-only） |
| `docs/protocols/instance-replication-v1.md` §24 | 规范文本（:1093 host-facing；决策权威 = ADR 0032 A4） | §24.2（:1108 回执条款/宿主义务）、§24.3（:1110-1120 七消息闭集合 + 无拒纳/闸门/信用词汇）、**§24.5（:1132-1139：流控 edge 单点、session 乐观发送；越界即 1011、三否定式；β/γ 行为差；单帧超限响亮收口；内存链 + 最坏账 cap + control 后死亡释放；OPEN 水位故障参数）**、§24.7（:1147 收口后丢弃/close 冲刷/revoke 不溯及/settled 晚到/`closeTimeoutMs` 不动）、§24.8 |
| 同上 §17（:564-617）/ §23.1（:775, :839）/ §23.2 | 已接受 | :587 总队列记账含 `bufferedAmount`、shed 只作用排队侧；:589 水位暂停/恢复 + 缺面视为 0 + 生产 Adapter 必须暴露三面；:600/:609 链式不变量；`send-paused`/`send-resumed` 字段；事件型 append-only |
| `CONTEXT.md` | 现行词表 | 「SessionHost」γ 段（流控单点在 edge、账本溢出即 1011、无拒纳/闸门/信用词汇）；Avoid（在 γ 缝上加拒纳/闸门/信用词汇） |
| `packages/ws-replication/AGENTS.md` | 模块契约 | :17 缝纪律（γ append-only 句 + still no rejection/gate/credit vocabulary + β 冻结）；:20 工厂 append-only；:22 生产 API 经 index；:24-26 验证门（聚焦 + 缝契约/OPEN admission/wire parity + 包 typecheck + 根 `pnpm typecheck`/`pnpm test`） |
| SA8 iteration-1 设计裁定（`task_issue-450_design_conflict_report.md`） | 本门既有 ruling | §16 **读法 A 确认**（A4.3/§24.5 适用范围覆盖 egress 前置门水位暂停项——翼(ii) = 既有决策登记目标语义的实现，非契约变更；R9 降级路径关闭）；§8 R1–R7 实现期复核义务；§10 五项 `requiresConflictRecheck` 面 |
| ADR 0013:52 / 0022:49（背景权威） | 已接受 | chunk 逐帧经既有 data 路径出站 |

代码事实独立核实（代码只作当前事实确认，不替代决策文本；全部锚点为**交付后**行号）：

- **翼(i)**：`backpressure.ts:82` 可选钩子 `onDataFrameAdmissionFatal?(reason: 'ledger-overflow' | 'oversize'): void`（append-only，接口其余成员零变化）；`:182-196` `tryEmitDataFrame` 两守卫各增一行 `this.host.onDataFrameAdmissionFatal?.(reason)` 后 `return 0`——**守卫判据（严格大于）、次序（oversize 先）、投影公式（`observe() + pendingDataHandoff + controlPendingHandoff + totalQueuedBytes() + frameBytes`）逐字未动**（diff 逐行核对）；模块头注 :26-30 append #450 段。
- **翼(ii)**：`hub-edge-host.ts:712` 构造参数 `pausePreGate: boolean`（构造期常量、单一 option 派生）；`:721` egress 前置门 = `port.connectionState() === 'closed' || (pausePreGate && !port.dataGateOpen()) ? 0 : port.sendDataFrame(frame)`——标记缺席 ⇒ `pausePreGate === true` ⇒ `(true && ¬gate) ≡ ¬gate`，**缺省判定次序与求值语义与 HEAD 逐字节等价**（HEAD 原式 `closed || !gate`；短路次序保留）；`γ ⇒ false` ⇒ 前置门仅 `closed` 项。`:982` `pausePreGate = options.asyncDataAdmissionFatal !== true`；`:971-973` allocate 落点 (a) 条件展开转发内部 config。
- **设置链与码映射**：`hub-edge-host.ts:177-186` 公共 option 第 10 可选成员 `readonly asyncDataAdmissionFatal?: true`（doc 含方向性义务 + 双向误用 + 前置门声明）；`hub-edge.ts:93` 内部 config append；`:224-231` 构造器条件挂接——reason→码映射单点在 edge：`'oversize' → connectionFatal('FRAME_TOO_LARGE', wsCloseCodeFor('FRAME_TOO_LARGE'))`（注册表 :105 = config/1009 既有）、`'ledger-overflow' → connectionFatal('CONNECTION_BACKPRESSURE', 1011)`（与 control 耗尽同码同拓扑，`:218` 既有行原样）。
- **收口单点未动**：`hub-edge.ts:690-704` `connectionFatal` —— `closedFlag` 早退（:691，幂等恰一）、`sender.teardown()`（:693 ⇒ `tornDown=true`）、ERROR 直发（:696，`onEmitted` 因 `backpressure.ts:232` tornDown 早退 ⇒ 零记账）、**`closedFlag = true; setConnState('closed')`（:700-701）与 `requestSinkClose()`（:702）均在方法返回前同步完成** ⇒ 守卫钩子同步回调返回时连接已 closed（R7 doc 真陈述的代码前提）、transport.close（:703-704）殿后。该函数与 `onTransportClosed`/`cleanupAll`/drain 族零改动。
- **γ 0 值来源穷尽性**：`port.sendDataFrame` 单漏斗 = `sender.tryEmitDataFrame`（`hub-edge.ts:284-288`，#423 注释原样；`sequence>0` 门原样）⇒ γ data 帧 0 值 ∈ {oversize 守卫（fatal 已发起）、ledger-overflow 守卫（fatal 已发起）、前置 `closed` 闸（丢弃域）}——与 `hub-edge-host.ts:121-135` 公共 doc append 逐形态一致，**无第四来源**（水位暂停项已按读法 A 移除；`emitOne` 序号耗尽路径为响亮 throw 非 0，`frame-io.ts` 零改动）。
- **水位机械保留面**：`sendControl`/`sendControlFrame`（含暂停态额度与耗尽 1011）、`observeWater`/`enterPause`/`resume`/poll、`emitWaterEvent` 接线（`onSendPaused`/`onSendResumed` 行为上下文未动）、`validate.ts` 链式校验、`defaults.ts` 缺省值——diff 零触碰；α 真实闸门镜像 `hub-session.ts:222-229`（`closed` 门 → `dataGateOpen` 门 → `port.sendDataFrame`）零改动。
- **测试面**：新契约 `ws-replication-issue450-flow-lifecycle.test.ts`（778 行，22 用例 = SA6 §12.2 全条目 + 设计新增 `BPK-C4`/`BPK-NC2` + PUB 缺省不变性）；新夹具 `issue450-flow-seam.ts`（427 行；头注登记 F1 三压力形态等价性 + F4 桥纪律「收口一律 edge 发起」+ 零真实 timer）；`issue447-async-seam.ts` 语义 diff = **+49/−0**（`git diff -w` 实查；缩进重排为 resolver 抽取闭包，行为零变化由 #447 三套件复跑绿背书）；421 test-d append 类型锚 + 「九→十」措辞（头注 + 用例名两处），既有断言全保留。
- **证据日志核对**（文本核对，未复跑）：红聚焦 4 failed|18 passed（`sa3-issue450-red-focused.log`）；红类型面 TS2339/TS2353/TS2344 恰落 421 test-d 新锚（`-red-typecheck.log`）；聚焦绿 22/22 + no type errors；×3 复跑同值；γ 族 5 文件/65 用例；421 套件 7 文件/98 用例；包全量 **102 文件/919 用例**（基线 101/897 ⇒ 恰 +1/+22）；包 tsc exit=0；根 typecheck 全链（日志无错误输出）；根 test **465 文件/5649 用例**全绿；变异负控（`pausePreGate` 恒 true）恰在 `BPK-C4` 判别性断言红（1 failed|21 skipped）。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（交付事实） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | **ADR 0032 A4.3 + §24.5:1132-1134（翼(i)）** | 账本投影越界即 1011 收口整条连接；无逐帧拒纳、无 deferred、无 ns 级 send-failed resync | 两守卫失败动作经可选钩子升级为 `connectionFatal`（1011/1009）；判据/次序/投影逐字未动；钩子缺席 = `return 0` 既有 β 语义逐字保留 | **implements-existing-decision** | `backpressure.ts:82/:182-196`；`hub-edge.ts:224-231`；红→绿证据（4 failed → 22/22）；`BPK-C1/C2` 绿 | — |
| 2 | **ADR 0032 A4.3 + §24.5（翼(ii) = SA8 iteration-1 §16 读法 A 裁定）** | 删除清单覆盖 egress 前置门水位暂停项；γ data 帧恒达账本守卫、投影含 `observe()` 自行判死 | `pausePreGate` 构造期常量（`:982` 单一 option 派生，无运行时切换）；γ ⇒ 前置门仅 `closed` 项（`:721`）；缺省 ⇒ 次序逐字保留；`closed` 项保留 = A4.5 丢弃机械载体 | **implements-existing-decision**（按本门 iteration-1 裁定执行；R9 降级路径确认未触发） | `hub-edge-host.ts:712/:721/:982`；iteration-1 报告 §3-#1/§16；变异负控恰红 `BPK-C4`（`sa3-issue450-mutation-wing2.log`） | — |
| 3 | §24.5:1135 + A4.8（β/γ 行为差、β 行为不变） | β = ns 级 resync 存活；成功路径 wire 逐字节等价 | 缺省零传 ⇒ 两翼新分支结构性不可达（`(true && ¬gate) ≡ ¬gate` 逐字节等价；钩子缺席）；`BPK-NC1`（β）+ `BPK-NC2`（缺省前置门弹回 + 漏置位形态）+ PUB 缺省不变性三重负控绿；102 既有文件全绿 | **implements-existing-decision** | `hub-edge-host.ts:721`（常量折叠等价）；测试 :224/:269/:765；`sa3-issue450-package-suite.log`（102/919） | — |
| 4 | §24.5 + §13.1/§14（单帧超限 = 配置错误） | 响亮收口 + 诊断；17 连接码冻结 | `FRAME_TOO_LARGE` + 既有 1009 映射（`errors.ts:105` 零改动）；ERROR + close + observer `connection-failed` 恰一；零新码、零新事件型；`OVS-C1/NC1/NC2` 绿（NC1 按 N2 校准 cap 64KiB + 清账） | **implements-existing-decision** | `hub-edge.ts:229-231`；`errors.ts:105`（未触碰）；测试 :307/:324 | — |
| 5 | **§17:587-589/:600-609（水位机械，γ 位移外全量）** | 暂停 dequeue/恢复；control 保留额度；链式不变量；`bufferedAmount` 缺面视为 0 | `sendControl`/`sendControlFrame`、`observeWater`/`enterPause`/`resume`、`validate.ts` 链、`defaults.ts`、α 真实闸门（`hub-session.ts:222-229`）全部零触碰；缺省装配 egress 前置门逐字保留（`BPK-NC2` 锚） | **no-conflict** | git diff（无相关 hunk）；`hub-session.ts:222-229`；测试 :269 | — |
| 6 | §23.1:775/:839 + §23.2（水位事件） | 字段 `connectionId?`/`bufferedAmount`；发射点在 edge；事件型 append-only | `emitWaterEvent` 接线与发射点（`enterPause`/`resume` 边沿）零改动；γ 下事件照常发射（判据不依赖 `paused`）；O3 可达性专属断言未加 = 设计 D1.5 保留面登记的极端形态，非义务缺口 | **no-conflict** | `hub-edge.ts` diff（`onSendPaused`/`onSendResumed` 行为上下文未动）；设计 §7-D1.5 保留面；SA3 报告 O3 处置 | — |
| 7 | §24.3:1110-1120 + A4.1/A4.6（缝词汇闭集合） | 七消息；无拒纳/闸门/信用词汇；receipt 恒 `{tag,sequence}` | 零新缝消息；收口经既有 edge→session `close`（`requestSinkClose` 同道）；分叉 = edge 内部构造期常量；`BPK-C1/C2` 断言缝词汇 ⊆ 闭集合；`issue447-async-seam.ts` 桥纪律（`egress ≤ 0 ⇒ 不投回执`）零语义改动（+49/−0） | **no-conflict** | `hub-edge-host.ts:712-724`；测试 :156；`git diff -w` 计数 | — |
| 8 | **ADR 0032 后果:112 + 模块 AGENTS:20/:22（公共面冻结/append-only）** | 公开面一经发布冻结，演进只能 append-only | 唯一公共面变化 = `HubReplicationEdgeOptions` 第 10 可选成员 `asyncDataAdmissionFatal?: true`（精确 `true`、装配期事实）；内部 `HubReplicationEdgeConfig`/`ConnectionSenderHost` append-only 可选成员；`src/index.ts` 零改动（类型经既有再导出流动）；421 test-d 类型锚 + `@ts-expect-error` 非法值形态 + 缺省字面量零 cast（`satisfies`）；既有断言全保留 | **no-conflict**（注册 append-only 通道内） | `hub-edge-host.ts:177-186`；`index.ts`（git status 零触碰）；421 test-d diff | — |
| 9 | A4.5 + §24.7（生命周期单规则） | 收口后丢弃/close 冲刷/revoke 不溯及/settled 晚到/`closeTimeoutMs` 不动 | session 侧生产零改动（`hub-session-async-host.ts` 等 DENY 全未触碰）；新收口触发点汇入既有 `connectionFatal` 拓扑（`requestSinkClose` 同步 quiesce 前缀原样）⇒ 四腿自动适用；`DROP-C1`/`FLUSH-C1/C2`/`REVOKE-C1/NC1`/`DRAIN-C1×2/NC1` 全绿（含 2× `closeTimeoutMs` 敏感性负控） | **implements-existing-decision** | git status（DENY 零触碰）；`hub-edge.ts:690-704`；测试 :356-:624 | — |
| 10 | A4.3 + §24.5:1139（OPEN 水位 = 故障参数、原值不动） | 16 帧/4 并发原值；打穿响亮收口 | 常量与收口点零触碰；γ 缝 + F2 deferred resolver permutation 补锚：恰 4 并发/恰 16 帧零收口，第 5/第 17 ⇒ 恰一 `CONNECTION_POLICY_VIOLATION` + 1008（`OPENWP-C1×2/C2×2` 绿） | **no-conflict** | `hub-edge-host.ts` OPEN 区（diff 零触碰）；测试 :625-:708 | — |
| 11 | §24.5:1137 + A4.3（内存安全链） | 逐跳有界；最坏账 = cap + control 后死亡释放 | 翼(ii) 使「死亡释放」在有 `bufferedAmount` 传输可达（`BPK-C4`：> highWater 仍放行、投影越界 ⇒ 1011）；`MEM-C1/C1b/C2/NC1` 绿（session 跳 queue-overflow / edge 跳 1011 死亡判然两分；死亡后零泄漏零新观测） | **implements-existing-decision** | 测试 :169/:193/:709-:762；迭代-1 报告 #3 裁定承接 | — |
| 12 | A4.7 + §24.8（`update-sent` 发射点） | edge 盖章点；`seq>0` 门；直驱帧 `sendQueueMs` 整键缺席 | `emitUpdateSentAtStamp` 与单漏斗零改动（`hub-edge.ts:284-288` #423 注释原样）；`OVS-C1` 断言零 `update-sent` 新增 | **no-conflict** | `hub-edge.ts:279-288`；测试 :307 | — |
| 13 | ADR 0032 决策 1/2（单份实现；缝无接纳信号、1011 终局兜底） | 不得 fork 协议状态机 | 无第二份 ConnectionSender/egress 面；分叉 = 同一装配闭包内构造期参数；翼(ii) 强化 1011 终局在 γ data 面可达性（决策 2 兜底语义兑现） | **no-conflict** | `hub-edge-host.ts:708-724`（单类单构造点）；迭代-1 报告 #13 | — |
| 14 | ADR 0013:52 / 0022:49（chunked 背景权威） | chunk 逐帧经既有 data 路径出站 | chunk 仍经同一单漏斗（守卫共享）；`bulk-transfer.ts`/`update-channel.ts` 零触碰；不新建第二 data 路径 | **no-conflict** | git status；`hub-edge.ts:280-282` 注释 | — |
| 15 | **SA6 契约 §15-1【核心裁定】（已批准验收契约）** | 两处共享字节路径必须显式分叉 | 分叉在 `tryEmitDataFrame`（翼 i）与 `HostEdgeConnection.egress.sendDataFrame`（翼 ii）**两处**落地，载体 = append-only 连接选项（SA6 列举合法形态）；`BPK-C1/C4` 判别性观察 + 双负控 | **implements-existing-decision** | SA6 契约 :265/:173；`backpressure.ts:182-196`；`hub-edge-host.ts:721` | — |
| 16 | SA6 §6/§12.2 契约条目（验收锚全集） | BPK/OVS/DROP/FLUSH/REVOKE/DRAIN/OPENWP/MEM 逐条落地、负控成对 | 22 用例逐条对号（含设计新增 `BPK-C4`/`BPK-NC2` 与 N2/N4 校准）；**载体替换 1 项已登记**：`BPK-NC1` 经 #420 shim 桥（`createHubSessionHost` 同步缝）而非设计括注的 `makeShardedReplicationFacade`——实查 `issue424-sharded-hub.ts:426-434` `ShardedFacadeOptions` 无 limits 注入面，SA6 §6 NC-1 明文允许「监听单体或 `createHubSessionHost` 同步缝」；断言键与契约逐字一致（ns 级 `RESYNC_REQUIRED` + `resync-required{send-failed,'send-frame-rejected'}` + 存活 + 零 1011） | **implements-existing-decision**（载体在契约许可通道内；既有夹具零改动复用） | 测试 :224-:267；SA6 :104/:225；`issue424-sharded-hub.ts:426-434` | — |
| 17 | #447 设计 §9.1 桥纪律行（证据级） | egress ≤ 0 ⇒ 不投回执；tag pending 占窗 | 桥零语义改动（+49/−0）；γ 下「0 ⟺ 已收口」经 doc append（`hub-edge-host.ts:121-135`）成为与代码逐形态一致的真陈述——iteration-1 #16 裁定的 R7 核对面闭合 | **no-conflict** | `issue447-async-seam.ts` diff；`hub-edge-host.ts:121-135` | — |
| 18 | CONTEXT.md「SessionHost」γ 段 + Avoid | 流控单点在 edge；不得在 γ 缝加拒纳/闸门/信用词汇 | CONTEXT 零改动；翼(ii) 移除 γ data 路径事实闸门 ⇒ 实现向词条收敛；词汇面零扩展 | **no-conflict** | git status（CONTEXT 未触碰）；`hub-edge-host.ts:721` | — |
| 19 | **模块 AGENTS.md（:17 缝纪律 + :24-26 验证门）+ docs/AGENTS.md 同步义务** | 行为变化时同步登记；验证门照跑 | :17 append-only 一句落盘（方向性义务「γ 装配 ⇒ 应置位」+ 双向误用面 + 前置门仅 `closed` 项声明 + 缺省逐字不变），既有句原文保留（diff = 单 bullet 尾部追加）；§12.2 六道验证门证据 12 份落盘（含根 `pnpm typecheck`/`pnpm test`——模块 AGENTS 对 wire/lifecycle 改动的门） | **implements-existing-decision**（= iteration-1 R5 义务兑现） | `packages/ws-replication/AGENTS.md` diff；`artifacts/sa3-issue450-*.log` ×12 | — |
| 20 | **SA8 iteration-1 ruling §8 R1–R7（实现期复核义务全集）** | R1 append 形状 / R2 两翼机械 / R3 冻结面 / R4 规范零改动 / R5 登记句 / R6 #449 边界 / R7 doc 真陈述 | 逐项独立复核**全部成立**（见 §5 冻结面表与 §2 代码事实；R4：git status 零规范触碰；R6：`update-channel.ts`/`bulk-transfer.ts` 零触碰；R7：`connectionFatal` :700-701 同步前缀次序未动 + 0 值三来源穷尽 + 缺省 doc「0 = 拒纳」语义保留 + 水位事件发射点未动） | **implements-existing-decision** | 本报告 §2/§5 逐行锚点；iteration-1 报告 §8 | — |

### 裁定承接核对（iteration-1 §16 读法 A → 实现落点）

iteration-1 六点论证裁定 A4.3/§24.5 覆盖 egress 前置门水位暂停项（γ 装配下前置门仅留 `closed` 项）。交付实现**逐要素落实**该裁定：① 构造期常量（非运行时切换、非第二标记）；② `closed` 项保留（A4.5 机械载体，裁定理由⑤）；③ cap 仍为唯一终止界、highWater 不 fatal 化（裁定理由⑥——`BPK-C3`/`MEM-NC1` 界内放行锚绿）；④ 可恢复阶段真实存在的面（α 闸门/control 额度/缺省前置门）逐字保留（裁定理由②的后半义务）。**R9 降级路径（读法 B contingency）确认不触发**——实现与裁定同向，无 revert 义务、无 AC1 适用域限定义务、无 0 值三来源 doc 回改义务。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| （无） | — | — | — |

无任何 override 在场或被需要：Issue 评论 REST 快照为空（无 Owner 评论）；无新 ADR 修订/废弃；无协议版本升级；全部行为变化均在既有决策（A4.3/§24.5 + iteration-1 读法 A 裁定）登记的目标语义内。SA8 不替 Owner 或 SA1 创设 override。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（交付 diff 实查） |
|---|---|---|---|
| β 公共工厂/句柄面 | `createHubSessionHost` 冻结签名逐字 | A4.1；AGENTS:17 | **保持**（`hub-session-host.ts` 零触碰） |
| 公共导出面与工厂签名 | `src/index.ts` 值导出零增删；三工厂签名零变化；类型只增不改 | 后果:112；AGENTS:20/:22 | **保持**（index.ts 零改动；option 经 `:90` 既有再导出流动；421 test-d 既有断言全保留） |
| 公共 option 形状 | `asyncDataAdmissionFatal?: true` 恰 `true \| undefined`；无 per-call/运行时切换 | 迭代-1 R1 | **成立**（`hub-edge-host.ts:186`；test-d :185-205 类型锁定 + `@ts-expect-error` false 形态；`true as const` 仅内部转发窄化） |
| wire 格式与序号纪律 | envelope/帧型/`[8..12]` mux 单点盖章/§3 严格递增 | §24 头注:1093；决策 2 | **保持**（`frame-io.ts`/protocol 包零触碰；wire 仅作观察） |
| 缝词汇闭集合 | §24.3 七消息 + 无拒纳/闸门/信用 + receipt 恒 `{tag,sequence}` | §24.3；A4.6 | **保持**（零新缝消息；分叉为 edge 内部行为） |
| 缺省装配 egress 前置门 | `closed ∨ ¬gate` 判定次序逐字（`hub-session.ts:210-216` 等价镜像）；α 真实闸门 | 迭代-1 §5 新增行 | **保持**（`(pausePreGate && ¬gate)` 常量折叠逐字节等价；`hub-session.ts:222-229` 未触碰；`BPK-NC2` 运行期绿 + 变异负控红证判别力） |
| `tryEmitDataFrame` 守卫面 | 判据（严格大于）、次序（oversize 先）、投影口径逐字 | 迭代-1 R2 | **保持**（diff 仅插入可选调用行；公式逐字未动） |
| `connectionFatal` 收口拓扑与次序 | `closedFlag` 早退 → teardown → ERROR 直发 → closedFlag/setConnState → requestSinkClose → transport.close；幂等恰一 | 迭代-1 R2/R7 | **保持**（`hub-edge.ts:690-704` 零改动；:700-701 次序未破坏） |
| 收口 ERROR 零记账 | `onEmitted` tornDown 早退 | 迭代-1 R2 | **保持**（`backpressure.ts:231-232` 零改动） |
| §17 水位机械（γ 位移外全量） | control 侧暂停额度与耗尽 1011、`enterPause`/`resume`、链式校验、缺省值、`send-paused`/`send-resumed` 事件型与字段 | §17:587-609；§23.1 | **保持**（全部零触碰；事件发射点原样） |
| 错误注册表与映射单点 | 17 连接码冻结；code→close code 单点 | §13.1；A1 | **保持**（`errors.ts` 零改动；映射单点在 `hub-edge.ts:224-231` 装配处） |
| observer 事件型与字段集 | `connection-failed` 既有形状；§23.2 append-only | §23.2 | **保持**（零新事件型；两码均白名单内） |
| OPEN 水位原值与 §18/§21 参数 | 16/4；`closeTimeoutMs` 等不动 | §24.5:1139；§24.7 | **保持**（常量与 defaults 零触碰；`DRAIN-NC1` 2× 敏感性负控绿） |
| α/β/peer 行为 | 与 HEAD 逐字节等价；既有矩阵全绿 | A4.8；AGENTS | **保持**（102 既有文件全绿 + 根 465/5649 + 三重负控；peer/α 组合根文件零触碰） |
| 规范文本 | ADR 0032 / 协议 / CONTEXT.md 零改动 | 迭代-1 R4 | **保持**（git status 零触碰；§16 裁定后无修订需求） |
| 前序票冻结面（#418/#420-#424/#447/#448） | 公共面只增不改；#447/#448 夹具 append-only；421 test-d append-only | AGENTS:20 | **保持**（#447 夹具 +49/−0；#448/`issue420-shim-hub`/`issue424` 零改动；γ 族 65/65 复跑绿） |
| peer 侧 | 不拆分、零改动 | 后果:113 | **保持**（`peer-*.ts` 零触碰；peer host 无钩子成员 ⇒ 新分支不可达） |
| #449 边界（R6） | `update-channel.ts`/`bulk-transfer.ts` 不触碰 | 迭代-1 R6 | **保持**（git status 零触碰） |

## 6. Evolution requirements

**无剩余 evolution-required 项。**

- 全部 20 项对照落在 no-conflict / implements-existing-decision；无契约被改变，无修订计划义务。
- 公共面扩张（`HubReplicationEdgeOptions` +1 可选成员、内部两接口 +1 可选成员、构造参数）在 ADR 0032:112 注册的 append-only 条款内（iteration-1 #8 裁定承接，本报告 #8 复核成立）。
- 模块 AGENTS.md 登记句 = docs/AGENTS.md 文档同步义务的变更集内兑现（#19），非决策演进。
- iteration-1 §16 读法 A 裁定下的实现追平不产生规范文本修订义务（§24.5/A4.3/§17/CONTEXT 逐字复核仍为目标语义——本轮重核原文成立）。

## 7. Hard conflicts

无。逐项要点：

1. **翼(ii) 与 §17 水位条款**：iteration-1 §16 已裁定（理由②/③）γ data 路径的暂停前提结构性不存在、§24.5 为 γ 特别条款；实现按裁定落地且保留面完整——无新冲突面。
2. **翼(i) 钩子的重入安全**（`connectionFatal` 在 `tryEmitDataFrame` 栈内同步执行）：回调返回后仅 `return 0` 不读 sender 状态（diff 实查）；`closedFlag` 幂等收敛恰一收口——与 A4.5/SM-1 登记一致。
3. **`BPK-NC1` 载体替换**：SA6 契约明文许可通道内的等价载体，断言键逐字一致，无验收语义漂移（#16）。
4. **`issue447-async-seam.ts` 缩进重排**：语义 +49/−0，#447 三套件复跑绿背书行为零变化——不构成对 #447 冻结面的触碰。
5. 规范文本、wire、错误注册表、事件型、β/α/peer 面全部未触碰且以运行期证据锚定不变。

## 8. Required actions

| # | 级别 | 行动 | 归属 |
|---|---|---|---|
| A1 | 非阻塞（登记，SA8 范围外） | `issue447-async-seam.ts:70` 新增的 `NamespaceAuthorizationGrant` 类型导入在文件内无引用（HEAD 无此导入、现文件仅出现 1 次）——纯 lint 级残留，零决策面/零行为面；如需清理属 SA4/合并前清理职责，不构成本门阻断 | 总控 / SA4 |
| A2 | 非阻塞（登记） | SA4 quality review（并行派发）产物尚未 settle；本报告仅闭合冲突面，实现质量/测试充分性结论以 SA4 为准 | 总控 |
| A3 | 非阻塞（登记） | 变更集尚未 commit（SA8 纪律不 commit）；本报告结论基于当前 worktree diff @ HEAD `444c166`——commit 应保持同一 diff 内容（含 AGENTS.md 登记句与 12 份证据日志同集落盘） | 总控 |

## 9. Verdict

**`clear`**

依据（技能 verdict 规则：「clear：全部为 no-conflict 或 implements-existing-decision……或实现后复查已闭合」）：

1. **20 项对照全部落在 no-conflict / implements-existing-decision**，无 evolution-required、无 hard-conflict、无 override 需求。
2. **iteration-1 §16 读法 A 裁定被忠实执行**：两翼分叉机械、`closed` 项保留、cap 唯一终止界、保留面完整——R9 降级路径确认关闭；实现 = 规范登记目标语义的首次落地（实现追平规范，规范文本零改动）。
3. **iteration-1 §8 R1–R7 实现期复核义务逐项独立复核成立**（本报告 #20 + §5 冻结面表 18 行逐行 Actual result）；§10 五项 `requiresConflictRecheck` 面全部闭合（公共 API append / 两翼机械与 0 值穷尽 / 缺省逐字节不变与 γ 1011 死亡锚 / 生命周期四腿锚 / 规范零改动 + 登记句 + doc 真陈述）。
4. 冻结面（β 工厂、wire、缝词汇、错误注册表、水位机械保留面、OPEN 原值、前序票夹具、peer 侧）全部保持且以运行期证据（102/919、465/5649、双负控 + 变异负控）锚定。
5. 变更面 = 设计 §11 ALLOW 八行逐一对应、零越界、零 DENY 触碰；SA3 报告申报与实际 diff 逐项相符（含 1 项载体替换与 4 项实施细节偏差——均在契约/设计许可通道内且如实登记）。

## 10. requiresConflictRecheck

**false**。

iteration-1 §10 列出的五项待实现核对面经本轮 implementation 复查**全部闭合**（技能规则：「实现后复查已闭合时为 false」）：

1. 公共 API append-only 落地（9→10 成员 + allocate 双落点 + PUB/test-d 类型锚 + index 零改动）→ 本报告 #8/§5；
2. 两翼分叉机械落地（构造期常量、γ 仅 `closed` 项、0 值来源穷尽、幂等恰一收口）→ #1/#2/#20/§2；
3. α/β/peer 缺省逐字节不变 + γ 生产拓扑 1011 死亡锚 → #3/§5（证据日志核对）；
4. 生命周期四腿锚 + `closeTimeoutMs` 敏感性负控 → #9；
5. 规范零改动 + AGENTS.md 登记句同集落盘 + 公共 doc 真陈述 → #19/#20/§2（R7）。

后续阶段（SA4 质量结论、commit/PR、#449/#451 相邻票）不产生新的冲突复查触发条件——本变更集不触碰 #449 的 transfer 面，#451 的观测归属矩阵属既有票归属边界（SA6 §12.3 登记，非本门义务）。若后续 revision 改动本 diff 的任何生产面或登记句，按新 dispatch 重开冲突门。
