# SA8 实现后冲突复审 — issue #412（persistence 公开完成式排空 `drain()` + `retryDelayMs` 解耦 + 停机硬契约；implementation）

- 复查对象：**implementation**——工作区当前未提交变更集（13 个已修改文件 + 2 个新增测试文件，`git status`/`git diff` 全量核对），对照 ADR 全集、CONTEXT.md、规范协议/集成文档、模块 AGENTS 与已批准设计（design iteration 2）
- 仓库 / worktree：`/home/wangjian/nomicore-fix-issue-412`（分支 `mabf/issue-412`，HEAD `c3f7bd9`）
- SA8 dispatch：`sa-939d6e66-ab98-4634-912e-45e1824d90ff`（phase: conflict-gate，iteration 0；本任务无前置门禁产物，SA8 产物链 = 设计后复查报告（iteration 2，clear）→ 本实现后复审）
- 本报告为该任务首个 implementation 复审报告（无同类既有报告需原位更新）；只反映当前被审对象（当前 diff），不堆叠历史结论

---

## 1. Reviewed subject

**implementation**——issue #412 已实施变更集，覆盖：

1. **公开完成式排空**：`PersistenceLifecycle.drain(targets?)`（lifecycle.ts 状态机单点）+ `DocPersistence.drain?` optional 成员（contract.ts，含完整语义 doc-comment）+ Memory/File 具体类方法（File 入口 targets `validateIdentity`）+ barrel 导出 `PersistenceDrainTarget`；
2. **`retryDelayMs` 解耦**：`PersistenceSchedule.retryDelayMs?` + `resolvePersistenceSchedule` 条件展开（键形状不变）+ `retryBaseMs` getter 单源（createEntry/flush 回落两落点改引）+ DSH 探针退避镜像锁步；
3. **停机硬契约（Owner comment 5751613018）**：yjs-server 停机第 3 步固定睡眠 → **file/memory 统一**的有界完成式排空（`awaitDrainWithBudget(adapter.drain(), maxDirtyMs + 边距)` + 预算尽 `persistence-drain-budget-exceeded{budgetMs}` 诚实事件 + 有损继续）；plugin 句柄两 kind 统一保留；config.ts/main.ts 注释与拒绝文案 parenthetical 刷新（行为零变化）；
4. **规范文档同变更集**：ADR 0006 增量修订节（7 条：接口契约 / drain 语义 / 停机硬契约（无条件 + 适用面）/ dispose 对齐（修订并扩展 :86）/ retryDelayMs 解析形状 / 排空通知面不变量 / 非 live cell 排除存档）+ CONTEXT.md 词条「完成式排空（drain）」（含 `_Avoid_`）+ hub-peer-deployment.md（词表 + 条件性注记 + 停机序 file/memory 统一句含 memory 缺省预算括注——SA2-13 兑现）+ cordis-plugin-hosting.md（:64 停机句硬契约 + 清单第 5 步统一指引 + 示例代码块有界 drain 步——SA2-9 兑现）；
5. **liveness 完备化（DD-5b）**：`releaseSettleWaiters` 统一释放 + 四处 live-entry 移除点（dispose / delete 驱逐腿 / archive 干净驱逐腿 / maybeEvict）调用；`archiveWaiters` 字段注释更新（SA2-4）；
6. **新增验收锚**：`persistence-issue-412-drain-semantics.test.ts`（S-1~S-4）+ `persistence-drain-shutdown.test.ts`（S-5a/S-5b/S-5c——含 memory 停机链 drain 恰一次且严格先于 `persistence-disposed` 的硬契约时序锚）。

SA8 职责边界：只裁决与既有决策集的冲突、演进义务兑现与冻结面保持；不判断测试充分性/实现质量（SA4/SA7 面，含 SA3 报告的运行期验证声明——本报告仅将其作为申报证据记录，不独立复跑）。

## 2. Inputs and decision set

| 输入 | 状态 | 说明 |
| --- | --- | --- |
| 当前 diff（被审对象） | 已全量读取 | `git diff`（13 文件，+345/−52）+ 4 个未跟踪测试文件读取；`git status` 核对无越界触碰 |
| `wiki/raw/task_issue-412_design.md`（iteration 2） | 已读（全 558 行） | 实现的裁决依据（SA2 iteration 2 verdict **approve**）；DD-1~DD-8、§11 ALLOW/DENY、§12 验收映射逐条对照 |
| `wiki/raw/task_issue-412_design_conflict_report.md`（SA8 设计后复查，iteration 2，clear） | 已读 | 本复审的核对清单来源：§5 冻结面 12 项、§8 行动 1–7（行动 7 = 本报告） |
| `wiki/raw/task_issue-412_sa3_impl.md` | 已读 | 实现记录（文件范围/验证/偏离申报）；其声明经 diff 独立核对 |
| `wiki/raw/task_issue-412_sa2_review.md` | 已读（§13–§15） | iteration 2 verdict **approve**（0 BLOCKER/0 MAJOR；SA2-8~SA2-13 落实核对输入）；SA2-12/SA2-13 为 MINOR 非阻断 |
| `wiki/raw/task_issue-412_sa6_contract.md` + 两份契约测试文件 | 存在性/形状核对 | `drain(targets?: readonly PersistenceDrainTarget[]): Promise<void>` 与实现逐字段一致（DD-4）；文件保持未跟踪零触碰（SA2-6） |
| SA4 / SA9 产物 | **不存在** | 本任务无 SA4/SA9 报告；实现复查触发条件 = 设计 §15 明示需要（非 SA4/SA9 新决策面） |
| **Issue comment 5751613018**（MEMBER，2026-09-20T18:03:36Z） | 已独立拉取核对（`gh api`） | 与 dispatch 转述一致：①硬契约「宿主优雅停机必须先 await drain() 再 dispose」（非参考建议）；②同步修订 ADR 0006 :86 dispose 定义（否则契约与实现继续脱节）；③dispose 保持 abortive 时保留分层公开 drain；④确认三击穿窗口（含 degraded retry 回退窗）；⑤支持 retryDelayMs 解耦（缺省保持现行为） |
| ADR 全集（0001–0030） | 已读（相关节） | 全部 accepted、无 superseded；相关：0006（normative for persistence，含新修订节）、0009、0010、0012、0023 |
| `CONTEXT.md` | 已读 | 新词条「完成式排空（drain）」与既有词条格式一致（`**术语**: 定义 + _Avoid_`）；无冲突既有词条 |
| `docs/protocols/instance-replication-v1.md` | 已读（相关节） | wire 契约零触碰（DENY 遵守） |
| `docs/integration/hub-peer-deployment.md`、`cordis-plugin-hosting.md` | 已读（diff + 现状） | 两文档均按 DD-8(3)/(4) 落地（见 §3 I18/I19） |
| 模块 AGENTS（root/docs/persistence/dsh-persistence/apps/apps-yjs-server） | 已读 | 决策集合组成部分（skill 规则）；边界逐条对照（§3 I9/I13/I14） |
| 源码 | 用于事实确认 | drain 状态机/`startFlush` 双门/`flush` generation 守卫/`releaseSettleWaiters` 四移除点/app 停机链事件序均直接读源核对 |

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（实际 diff） | Classification | Evidence | Required action |
| --- | --- | --- | --- | --- | --- | --- |
| O1 | **Owner 评论 5751613018（要求权威）** | 「把『宿主优雅停机必须先 await drain() 再 dispose』写为硬性契约而非参考建议」 | 三落点全部落地：①**结构性强制**——app.ts `performStop` 第 3 步（:601-625）对 `persistencePlugin?.instance` 统一执行 `awaitDrainWithBudget(adapter.drain(), budgetMs)`，dispose（3b 步 :628-630）只在此 await 之后可达，唯一两出口 = drain 完成或预算耗尽且 `persistence-drain-budget-exceeded` 已 sink（:623，先于 `persistence-disposed` :632——源码序核对）；**file/memory 无 kind 特判**（SA2-7 路径 (b) 兑现：原 `kind === 'file'` 守卫删除，plugin 句柄两分支统一赋值 :297-311）；②**成文硬契约**——ADR 0006 修订节第 3 条（:270）「**宿主优雅停机在调用 dispose() 之前必须先 await drain()**……预算尽后继续走 dispose() 有损路径是硬契约的**显式可观察退出**，不是违约；未经任何 drain 直接 dispose 的宿主接受（静默地）丢失已 ACK 未写入 store 的状态」——成文可观察条款，未降格为建议措辞（设计后报告行动 3 保真）；③**适用面申明**——不以 adapter 类型特判、契约边界 = 配置的 store 面（:272）；S-5b（预算 520ms 收口 + 事件先于 dispose + 旧 committed 快照可观察）与 S-5c（memory 原型 spy：drain 恰一次、调用时刻 `persistence-disposed` 未发射、`stop()` 二次调用不触发第二次 drain）为验收锚 | implements-existing-decision | app.ts :601-632；ADR 0006:270-274；`persistence-drain-shutdown.test.ts:112-210`；owner 评论原文（gh 独立拉取） | 无（已闭合） |
| O2 | **Owner 评论 5751613018（要求权威）** | 「同步修订 ADR 0006 :86 对 dispose 的现有定义——否则契约与实现继续脱节」 | ADR 0006 修订节第 4 条（:276）以**约束性修订语气**「本节**修订并扩展** :86 的 dispose 定义边界」（SA2-10 措辞）落地：:86 所列释放资源之外显式声明 dispose 语义**不变且保持 abortive/有损**（§228-5 重申）、「它从来不是持久性屏障」、「dispose 之前的持久性」唯一经分层公开 drain 表达、两者不合并（附「dispose 内部先 drain」否决论证）；:86 原文未改动、以引用式修订扩展（issue #79 修订节同款惯例） | implements-existing-decision | ADR 0006:276；:86 原文核对；设计 §7 DD-8(1) | 无（已闭合） |
| O3 | **Owner 评论 5751613018（要求权威）** | 「可以接受分层方案（公开 drain()，dispose 保持 abort 式）」＋确认 degraded retry 回退窗为第三击穿窗口＋支持 retryDelayMs 解耦（缺省保持现行为） | 分层保持：drain = `DocPersistence` optional 独立成员，dispose 未吸收 drain（diff 中 dispose 段唯一变化 = 内联 waiter 通知抽为 `releaseSettleWaiters` 私有方法，splice+同步 call 逐字节等价）；回退窗被动等待落地（lifecycle.drain 首分支 `retryTimer !== undefined \|\| flushing` → 仅注册 waiter，零热循环）；retryDelayMs 缺省动态回退（`retryBaseMs` getter，两落点改引） | no-conflict | lifecycle.ts drain/`retryBaseMs`；contract.ts:513-521；owner 评论原文 | 无 |
| I1 | ADR 0006（设计后报告 D1，evolution-required） | :34「不设外部 flush/cron 协调器……retry 以退避策略重试直到成功或插件停止」 | 演进已按计划执行且同变更集落地：修订节第 2 条固化 drain 语义（一次性完成式排空、非周期协调器、库级无预算、store 失败面永不 reject + File 校验例外申明）；第 3 条「与 :34 的关系（不冲突申明）」：drain = 归档 settle 范式（:37/:213）一次性公开化、「插件停止」的宿主侧映像 = 宿主预算——SA2-2 静息观察点措辞与并发写者边界入 doc-comment（contract.ts:149-176）与 ADR 第 2 条 | implements-existing-decision | ADR 0006:261-274；contract.ts:149-176；设计后报告行动 1 | 无（演进闭合） |
| I2 | ADR 0006（设计后报告 D8，evolution-required） | :34「默认值可由插件配置覆写」+ `PersistenceSchedule` 契约形状 + 冻结审计 | `retryDelayMs?` 可选键 + 条件展开（`config.retryDelayMs !== undefined ? {…} : {}`——键缺席时 resolved 形状不变）；`persistence-contract.test.ts:32-37` 等四组冻结审计零改动（git status 证实未触碰）；DSH 记录头（record.ts）零触碰；修订节第 5 条收录解析形状裁决为实现红线（「不物化进 resolved schedule」） | implements-existing-decision | contract.ts:542-556；ADR 0006:278；设计后报告行动 2（红线遵守） | 无 |
| I3 | ADR 0006 §228-5 + :86（dispose 冻结面） | 「dispose() 语义不变」（abort + clearTimers + 通知 waiters + handles.clear + doc.destroy + cells.clear + allSettled） | dispose 段唯一 diff = 通知点 2 内联代码 → `releaseSettleWaiters(entry)`（`splice(0)` + 同步 call，行为逐字节等价）；abort/destroy/cells.clear/allSettled 顺序与成员零变化；Memory.dispose drain-then-clear mirror 语义零触碰（memory.ts diff 仅增 drain 方法） | no-conflict | lifecycle.ts:815-838（diff）；memory.ts diff | 无 |
| I4 | ADR 0006 :195（设计后报告 D2） | 「降级等待期内 retry 退避即该 entry 的唯一 flush 调度源」 | drain 对 `retryTimer` 武装期只注册 waiter 被动等待（不强制重试、不热循环）；宿主预算在 entry 调度面之外（app 层 race）；`scheduleRetry`/`scheduleFlush` 本体零改动 | no-conflict | lifecycle.ts drain 首分支；:1089-1096 未触碰 | 无 |
| I5 | ADR 0006 :157-159 + persistence AGENTS「Memory and file adapters must satisfy the same contract」 | lifecycle core 共享、两 Adapter 不得复制状态机 | drain 状态机单点落 `PersistenceLifecycle`；Memory/File 纯委派 `this.core.drain(targets)`；File 侧仅增入口 `validateIdentity`（输入校验通道，与其余公开入口同款）；SA6 契约 C14 双 adapter 等价由两份契约测试矩阵承载 | no-conflict | lifecycle.ts:840-872；file.ts:149-158；memory.ts:189-195 | 无 |
| I6 | ADR 0006 :52/:55（提交语义/无 fsync） | temp→rename 提交点、rename 成功即完成一次 flush | drain 复用既有 `startFlush`/`flush`/`io.write`，零 I/O 路径改动；无 fsync 承诺扩张 | no-conflict | lifecycle.ts flush 段（仅 retryDelayMs 落点两行改引）；file.ts 写路径零触碰 | 无 |
| I7 | ADR 0006 :221-232（optional/派生面放置先例，设计后报告 D6） | DocPersistence optional / ReplicaPersistence required 放置纪律 | `drain` = `DocPersistence` optional readonly 属性签名（doc-comment 完整）；`ReplicaPersistence` 零触碰（grep 证实）；两 adapter 具体类方法满足 SA6 `HasDrain<…>` 类型锚；barrel `type PersistenceDrainTarget` 导出（persistence AGENTS「Add public exports through src/index.ts」遵守） | implements-existing-decision | contract.ts:68-74/:149-176；index.ts:37；file.ts/memory.ts | 无 |
| I8 | `packages/dsh-persistence/AGENTS.md`（设计后报告 D9） | 「Preserve machine-readable event and record shapes」 | `record.ts`/`events.ts`/`profile.ts`/`cli.ts` 零触碰（git status）；probe.ts 仅退避基准镜像一行 `(schedule.retryDelayMs ?? schedule.debounceMs) \|\| 1`——键缺席时与旧式逐字节同值 ⟹ 默认探针时间线零漂移；配置 retryDelayMs 的探针时间线变化 = 新配置的预期可观察行为（事件 `t=` 值），非 shape 变化 | no-conflict | probe.ts:444-447（diff）；record.ts 未触碰 | 无 |
| I9 | `apps/yjs-server/AGENTS.md` + hub-peer-deployment :276-279（设计后报告 D10） | 「Single disposal chain…Never trigger a second concurrent teardown chain」；四事件序 | drain（含预算 race）位于同一拆卸链原睡眠位（diagnostics-closed 之后、fiber dispose 之前）——是**等待**不是拆卸；memory 路径同位置新增同一等待步（同为链内等待）；预算尽发事件后继续同一链 3b dispose；`stop()` single-flight 幂等未触碰；四事件序保持（`persistence-disposed` :632 / `app-stopped` :635 发射位未变；新事件仅插入 registry-stopped 与 persistence-disposed 之间且仅预算耗尽时） | no-conflict | app.ts:601-637；ordered-shutdown-red.test.ts 未触碰；hub-peer-deployment.md:277-290（diff） | 无 |
| I10 | ADR 0012:37 + 根 AGENTS（设计后报告 D11） | 插件所有权/composition root 释放序；不假设动态 pluginId | file/memory 两分支统一保留 plugin 公共句柄（`createFilePersistencePlugin`/`createMemoryPersistencePlugin` 均返回既有 `{apply, get instance()}`——file.ts:284、memory.ts:243 源码核实），经 `get instance()` 取 adapter；未触碰 instanceId/role、未假设 cordis 动态 pluginId；drain 位于 :37「Persistence 释放」段内的前置等待，释放次序一致 | no-conflict | app.ts:180-188/:297-311；file.ts:284；memory.ts:243 | 无 |
| I11 | ADR 0009:99（设计后报告 D12） | Registry shutdown 语义 | `packages/namespace-registry/**` 零触碰（git status）；drain 在 registry shutdown 之后由宿主调用（链路前置条件成立） | no-conflict | git status；app.ts 停机序 | 无 |
| I12 | ADR 0010 + instance-replication-v1.md（设计后报告 D13） | wire 契约/复制状态机/:685 watchdog 纪律 | `docs/protocols/**`、`packages/ws-replication/**` 零触碰（git status）；wire 零变化；app 自有预算（file ≤ 30.5s / memory 5.5s）< 60s watchdog，「库级无条件排空 + 宿主侧有界退出」模式以更严形状兑现 | no-conflict | git status；app.ts 预算推导 | 无 |
| I13 | `docs/AGENTS.md` + 词汇纪律（设计后报告 D14） | 行为变更同步规范文档；新域词条入 CONTEXT.md；ADR 显式增量修订 | 四文件全部落地且与代码同变更集：①ADR 0006 修订节（7 条全量，见 O1/O2/I1/I2/I15/I16）；②CONTEXT.md「完成式排空（drain）」词条含 `_Avoid_` 行（SA2-5 兑现，含「把 drain 并进 dispose」禁令——与分层保持一致）；③hub-peer-deployment.md 词表 + 条件性注记（SA2-8 兑现：「仅在停机排空预算耗尽时发射……不是每次停机的必发阶段事件」）；④cordis-plugin-hosting.md :64 停机句硬契约 + 第 5 步统一指引 + 示例代码块有界 drain 步（SA2-9 兑现——原示例 `await persistenceFiber.dispose()` 无 drain 恰是硬契约禁止形状，已更新）；另装配示例改为保留 `persistencePlugin` 句柄并说明原因 | implements-existing-decision | 四文档 diff 全量核对；设计 §7 DD-8 | 无 |
| I14 | hub-peer-deployment.md 事件词表 + `apps/yjs-server/AGENTS.md`「stdout is a strict NDJSON lifecycle-event channel」（设计后报告 D18） | NDJSON 形状、脱敏、冻结事件序锚 | 新事件 `persistence-drain-budget-exceeded` 载荷 `{event, budgetMs}`（纯数值，脱敏合规）；发射位 = 预算尽分支（:623），先于 `persistence-disposed`（:632）——S-5b 断言 `budgetIndex < indexOf('persistence-disposed')`；三组既有锚（ordered-shutdown-red / issue270 / on-fatal-error-issue288）零触碰，对词表新增免疫；词表文档同步带条件性注记 | implements-existing-decision | app.ts:623-632；hub-peer-deployment.md:36-44（diff）；`persistence-drain-shutdown.test.ts:147-149` | 无 |
| I15 | ADR 0006 :213（设计后报告 D15） | 「archiveDoc……先排空既有 dirty 状态」的 liveness 完备化 | `releaseSettleWaiters` 统一释放；四处 live-entry 移除点全部调用（源码逐一核对：dispose :829、settleEntryForDelete 驱逐腿 :677-681、settleEntryForArchive 干净驱逐腿 :707-711、maybeEvict :1193-1197）；无等待者时 splice 空数组零观测差异；不变量句入 ADR 修订节第 6 条；`archiveWaiters` 字段注释更新（SA2-4 兑现：「settle 排空路径（archive/delete/drain）填充；驱逐/dispose 路径释放」） | implements-existing-decision | lifecycle.ts:94-101/:677/:707/:829/:1193-1197/:1218-1231；ADR 0006:280 | 无 |
| I16 | ADR 0006 issue-#79 修订节 :187 + ADR 0023（设计后报告 D16/D17） | 状态词冻结 / 服务构造纪律 | `getStatus` 词表零触碰、drain 零新状态；drain 为 class 原型方法（0023 合规）；无新对象字面量服务 | no-conflict | git diff（词表/服务面零触碰） | 无 |
| I17 | **已批准设计（iteration 2）整体保真** | DD-1~DD-8、§11 ALLOW/DENY、§12 验收映射 | 实际 diff 与设计 ALLOW 逐行对应（13 修改文件 + 2 建议新增测试文件，无越界）；DENY 全部零触碰（service.ts/testing.ts/namespace-registry/dsh record·events·profile·cli/既有 persistence 测试四组冻结审计/apps 既有测试/docs/protocols/ws-replication/SA6 两契约文件）；drain 骨架与设计 §8 伪码逐行同构（scope 集/closed vacuous/live-only/回退窗与在途被动等待/idle-dirty 强制 `startFlush`/干净跳过/静息观察点返回/屏障后重扫）；`startFlush` 双门（flushing/closed）与 `flush` generation/干净守卫既有语义未动——「跳过 debounce」由直调 `startFlush`（不经 `scheduleFlush`）结构性达成；SA2-7 路径 (b) 三项保真全部核实（守卫删除/句柄统一/S-5c 锚）；SA2-13 memory 缺省预算括注已写入 hub-peer-deployment 停机序句 | implements-existing-decision | git diff 全量；lifecycle.ts:1138-1141/:1143-1148；设计 §11/§12/§14.2 | 无 |
| I18 | **ADR 修订节内部引用精确性（本轮新发现 F1）** | 修订节第 2/3 条中三处「第 4 条」交叉引用（:264「本条与第 4 条『退避即唯一 flush 调度源』一致」、:267「见第 4 条『重试直到成功或插件停止』」、:273「唯一调度源（第 4 条）」） | 被引短语在本 ADR 的实际位置：**「重试直到成功或插件停止」= :34**（「## 决策」节 bullet「持久层内部调度」，无编号）；**「退避即该 entry 的唯一 flush 调度源」= :195**（issue #79 修订节第 **2** 条末 bullet）。ADR 全文不存在任何「第 4 条」条款包含这两个短语（各修订节第 4 条分别为：#64「supersede 裁决撤销」、#133「committed-identity probe」、#228「状态机与复活向量封堵」、#412「dispose() 对齐条款」）——数字引用悬空。**规范影响为零**：两短语逐字唯一可定位（grep 单命中），修订节对它们的语义转述（被动等待一致 /「插件停止」宿主侧映像）与原文一致，不产生歧义裁决或语义漂移 | no-conflict（编辑性精确度缺口，非决策冲突） | ADR 0006:264/:267/:273 vs :34/:195；全节条款编号 grep 枚举 | **F1（非阻断）**：后续文档变更集将三处「第 4 条」改为可解析引用（「:34」「#79 修订节第 2 条」或逐字短语直引）——纯文本修正，不触碰任何决策语义/冻结面，无需新 SA8 门禁 |
| I19 | `packages/persistence/AGENTS.md` 验证门 | 「Run root `pnpm typecheck` and `pnpm test` for contract or lifecycle changes」 | SA3 申报：root typecheck exit 0；root test 5242 中 2 failed——**既有失败**（`packages/vfsl-codegen/test/generate-union-member-docs.test.ts` 的 `pnpm generate --check` 版本横幅新鲜度断言，HEAD `abbb89a` 发布提交遗留；本 diff 零触碰 `domains/**`、`packages/vfsl*`，git status 证实）。SA8 裁决范围外注记：失败面与本题决策/冻结面零交集，其归因与修复属 SA4/SA7 动态验证面；本 diff 相关三包切片（persistence 242 / yjs-server 182 tests）申报全绿 | no-conflict | SA3 报告 Verification 表；git status（domains/vfsl* 零触碰） | 无（SA8 不复跑测试；交 SA4/SA7 裁断） |

裁决分布：**no-conflict 12（O3、I3–I6、I8–I12、I16、I18、I19）/ implements-existing-decision 7（O1、O2、I1、I2、I7、I13–I15 合并计 4 项：I7/I13/I14/I15）/ hard-conflict 0 / evolution-required 0（设计后报告的三项 evolution-required——D1/D8/D19——修订计划已在本变更集内全部执行完毕，闭环为 implements）**（共 19 行对照；设计后报告的 22 行决议/义务经本表 O1–O3 + I1–I17 逐项承接核对，无遗漏行）。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
| --- | --- | --- | --- |

**无。** 实现未主张、也未需要任何 override：全部变更经 ADR 0006 增量修订节（正式演进路径）+ 四份规范文档同步落地；Owner 评论 5751613018 依设计后复审结论为**要求权威**而非 override 权威（其要求 = 硬契约条款 + :86 修订 + 分层保持，全部经演进兑现）；:86 原文以引用式「修订并扩展」处理（#79 惯例），非推翻。无新 ADR supersede、无协议版本升级、override 面较设计批复未扩大。

## 5. Frozen surfaces

（设计后报告 §5 的 12 项冻结面，逐项对实际 diff 核对）

| Surface | Must remain unchanged | Evidence | Actual result（实际 diff 核对） |
| --- | --- | --- | --- |
| `dispose()` 语义（lifecycle + 两壳） | abort + clearTimers + 通知 waiters + handles.clear + doc.destroy + cells.clear + allSettled；Memory 壳 drain-then-clear mirror | ADR 0006 §228-5 + :86；Owner 评论再确认 | **保持**——dispose 段唯一变化 = 通知点 2 抽为 `releaseSettleWaiters`（逐字节等价）；Memory.dispose 零触碰 |
| `DEFAULT_PERSISTENCE_SCHEDULE` 与未配置解析键形状 | 冻结 500/5000；未配置 resolved 恰两键 | contract.ts:478-481/:542-556 | **保持**——常量零触碰；条件展开使缺省不物化 `retryDelayMs`（红线遵守） |
| 既有冻结审计四组 | `persistence-contract.test.ts:32-37` 等零改动即绿 | 设计 B12 | **保持**——四文件零触碰（git status） |
| yjs-server 停机事件序与在场性锚 | 四事件严格递增；五事件 countOf 恰一次 | ordered-shutdown-red.test.ts:77-91 | **保持**——锚文件零触碰；新事件 additive 且仅预算耗尽发射（发射位 :623 在 `persistence-disposed` :632 之前） |
| yjs-server 配置 schedule 词表 | 两键闭集 + 未知键拒绝 + `MAX_MAX_DIRTY_MS` 上界 | config.ts | **保持**——仅注释与 :275-278 拒绝文案 parenthetical 刷新（仍含 `persistence.schedule.maxDirtyMs` 路径段，两锚测试断言面不变）；`retryDelayMs` 未上 app 配置面、零新增预算键 |
| DSH 记录头与事件行 | record.ts:20 两键渲染；事件行含 `t=` | dsh AGENTS | **保持**——record.ts/events.ts 零触碰；probe 默认时间线零漂移（镜像表达式缺省同值） |
| getStatus 状态词与优先级 | `'ready' \| 'persistence-degraded' \| 'released' \| 'disposed'` | ADR 0006 #79 修订节 :187 | **保持**——零触碰、drain 零新状态 |
| 提交语义与存储格式 | temp→rename；`.tmp` 忽略；无 fsync；布局不变 | ADR 0006:52/:55 | **保持**——I/O 路径零改动 |
| Registry shutdown / lease 语义 | ADR 0009 全部条款 | namespace-registry/** DENY | **保持**——零触碰 |
| Wire / 复制状态机 | instance-replication-v1.md 全部 | docs/protocols/**、ws-replication/** DENY | **保持**——零触碰 |
| `PersistenceIO` seam | 既有成员面不变 | ADR 0006:230-232 | **保持**——drain 只消费既有 io.write |
| SA6 契约测试两文件 | 零触碰（验收证据不可变） | 设计 §11 DENY（SA2-6） | **保持**——未跟踪状态未变；调用形状与实现逐字段一致 |

## 6. Evolution requirements

设计后报告的三项 `evolution-required`（D1 公开 drain、D8 schedule 新键、D19 集成文档宿主契约演进）与 O1/O2 的 ADR 义务，其修订计划**已全部在本变更集内执行**——按 skill 清单逐项复核实现闭环：

| 检查项 | 计划（设计 DD-8 / SA8 行动 1） | 实现闭环核对 |
| --- | --- | --- |
| 修订文件 | ADR 0006 修订节 + CONTEXT.md 词条 + hub-peer-deployment.md + cordis-plugin-hosting.md（四文件一个不可缺） | **全部落地**（四文件均在当前 diff；ADR 修订节 7 条覆盖行动 1 的 a–e 全部子项） |
| 新旧语义 | 接口片段 / drain 语义 / 硬契约（无条件 + 适用面 + 预算可观察出口 + 代价申明）/ dispose 对齐（修订并扩展 :86）/ 解析形状 / 不变量 / 非 live 存档 | **逐条落地**（ADR :246-282 与 contract.ts doc-comment 一致；语义与代码行为同变更集一致——见 §3 各行） |
| 兼容与迁移 | 全 additive；第三方 stub 零编译红；冻结审计零迁移 | **成立**（optional 成员/键；SA3 申报 tsc 零错误 + 既有审计零改动即绿） |
| 失败语义 | store 失败面永不 reject；RangeError 词表扩展；File 校验例外；预算尽诚实事件 + 有损继续；同步 throw → `app-stop-failed` | **落地**（drain 无 reject 路径——`await Promise.all(pending)` 的 waiter 只 resolve；app 预算分支 sink 事件后继续；catch 链既有） |
| 版本 | 无 wire/持久化格式/schema 版本面 | **确认**（存储布局、DSH 记录格式、协议全部未触碰，无隐含版本面漂移） |
| 验证 | §12 矩阵 + Runner 门 | **已执行**（SA3 申报：三包切片全绿 + root typecheck 0 + root test 仅 2 既有无关失败；SA8 不复跑，交 SA4/SA7） |
| 保持不变的冻结面 | §5 表 12 项 | **全部保持**（§5 核对） |

**结论：三项演进全部闭环，无遗留演进义务。**

## 7. Hard conflicts

**无。** 未发现任何与既有决策不兼容且无演进路径的实现点。特别核对：

- **Owner 两项最低要求的落地保真**（设计后报告行动 3/4）：硬契约以成文可观察条款进入 ADR（「显式可观察退出，不是违约」原文核对）；预算事件在代码序上先于 `persistence-disposed`（:623 < :632）且被 S-5b 断言锚定；:86 以约束性「修订并扩展」语气对齐——无降格、无信息性重申冒充修订；
- **SA2-7 路径 (b) 实现保真**（行动 7 专项）：`kind === 'file'` 守卫确认删除（diff 删除行核对）、`persistencePlugin` 句柄两分支统一赋值（:297-311）、memory 停机链 drain 经公共原型面被 S-5c 锚定（恰一次 + 调用时刻 `persistence-disposed` 未发射 + 二次 `stop()` 无第二次 drain）；ADR 硬契约条款与 cordis-plugin-hosting 指引对 memory 路径与 app 实现同答案——「契约与实现脱节」在规范、指引、实现、验收四方闭合；
- **drain 状态机与既有调度面的相容性**：直调 `startFlush` 的「跳过 debounce」不触碰 `scheduleFlush`/`scheduleRetry` 语义（:195 退避唯一调度源仅约束降级等待期，drain 对该期被动等待）；扫描段同步完成 waiter 注册（错过通知窗为零）；`closed` 早退 + 通知点 2 + DD-5b 三驱逐点共同保证终止性；
- **唯一新发现 F1（I18）为编辑性交叉引用悬空**，无规范歧义后果（被引短语逐字唯一），不构成任何冲突等级的实质事项。

## 8. Required actions

1. **（非阻断，文档精确性 follow-up）** ADR 0006 修订节三处悬空的「第 4 条」交叉引用（:264/:267/:273）改为可解析引用（`:34` /「issue #79 修订节第 2 条」/逐字短语直引）——纯文本修正，无决策语义变化，随任一后续 docs 变更集顺带处理，无需新门禁。
2. **（非阻断，文档债 follow-up——SA3 已如实记录）** `apps/yjs-server/AGENTS.md` 单一拆卸链摘要行未列举新增的链内排空等待步（不矛盾——drain 是同一链内的等待，非第二条拆卸链；该文件不在设计 ALLOW，SA3 不越界触碰正确）；随后续文档变更集补一行。
3. **（非阻断，SA1 产物遗留——SA2-12）** 设计文档对 SA8 设计后报告的三处计数/traceability 描述滞后，属 SA1 产物修订，留待 Controller/SA1 顺带修正（零行为影响）。
4. **（交 SA4/SA7 裁断面）** root `pnpm test` 的 2 个既有失败（vfsl-codegen 版本横幅新鲜度）与本题零交集（本 diff 未触碰相关面）；其归因修复与 SA3 申报的全绿切片由 SA4/SA7 动态验证复核，不属冲突门禁事项。
5. 实现侧无阻断行动：本变更集可在通过 SA4/SA7 质量门后合并（ADR/文档/代码同变更集的演进义务已闭合）。

## 9. Verdict

**clear**

- 19 项对照：12 no-conflict + 7 implements-existing-decision + 0 evolution-required（设计后三项演进已闭环执行）+ 0 hard-conflict；
- 设计后报告 §8 行动 1–6 逐条核对**全部兑现**，行动 7（本实现后复审）由本报告执行完毕；§5 冻结面 12 项对实际 diff 全部保持；
- Owner 评论 5751613018 的硬 drain-before-dispose 契约与 ADR-0006（:86 修订并扩展 + :34/:195/§228-5 关系申明）对齐要求，在规范条款、对外指引、自家实现（file/memory 统一）、验收证据四方一致落地；
- 唯一新发现 F1 为 ADR 修订节内部引用数字悬空（编辑性、零规范后果），列为非阻断 follow-up。

## 10. requiresConflictRecheck

**false**

- 设计后报告标记的全部待核对面——公共 API（`DocPersistence.drain?` + `PersistenceDrainTarget` 导出）、生命周期/状态机新入口语义（vacuous-after-dispose/无预算/并发重入/静息观察点）、驱逐通知面补全、持久化配置语义（`retryDelayMs?` + 解析形状）、公共事件面（`persistence-drain-budget-exceeded`）、消费方停机语义（预算组合/常量/注释）、memory 统一路径保真、四份规范文档修订——**均已由本报告对实际 diff 逐项核对闭合**；
- 无公共 API/wire/schema/持久化格式/状态机/生命周期/失败语义/正式 override 面尚待实现核对；§8 所列 follow-up 均为纯文本精确性/文档债事项，不开新决策面，无需再门禁。
