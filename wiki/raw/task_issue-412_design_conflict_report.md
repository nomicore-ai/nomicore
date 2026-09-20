# SA8 设计后冲突复查 — issue #412（persistence 公开完成式排空 `drain()` + `retryDelayMs` 解耦；iteration 2 修订版复审）

- 复查对象：**design**（`wiki/raw/task_issue-412_design.md`，**iteration 2 原位全量修订版**，558 行——落实 SA2-7（MAJOR）路径 (b)：停机硬契约对 **file/memory 两条 store 路径统一**；含 SA2-8~SA2-11 四项 MINOR）
- 仓库 / worktree：`/home/wangjian/nomicore-fix-issue-412`（分支 `mabf/issue-412`，HEAD `c3f7bd9`；当前 diff 仅含任务产物与 SA6 两份契约测试（git status 核实），代码零改动——设计与实现尚未分离验证）
- SA8 dispatch：`sa-12740a40-6476-45d6-a865-7127c24da0c3`（phase: conflict-gate，iteration 2）
- 本报告为既有设计后复查报告的**原位更新**：只反映当前被审对象（iteration 2 修订版设计），不堆叠历史结论；iteration 1 报告中与修订版不一致的表述（memory 路径裁决）已被本轮对象取代。

---

## 1. Reviewed subject

**design** —— SA1 修订版实现设计（iteration 2），覆盖：

1. `PersistenceLifecycle` / 两 adapter 公开完成式排空 `drain()`（DD-1/DD-4/DD-5/DD-5b）；
2. `PersistenceSchedule.retryDelayMs?` 可选键与 `debounceMs` 解耦（DD-2/DD-3/DD-6 锁步）；
3. `apps/yjs-server` 停机链第 3 步固定睡眠 → **有预算的完成式排空**（`awaitDrainWithBudget(adapter.drain(), maxDirtyMs + 边距)` + 预算尽诚实事件 `persistence-drain-budget-exceeded` 后有损继续）（DD-7，SA2-1 路径 (a)）；
4. **iteration 2 核心修订（SA2-7 路径 (b)）**：上一步对 **file 与 memory 两种配置统一执行**——`kind === 'file'` 守卫删除、plugin 句柄两 kind 统一保留、memory 预算走 `DEFAULT_MAX_DIRTY_MS` 缺省推导；停机硬契约「dispose 前 await drain」对两条 store 路径同构成立；
5. Owner 评论 5751613018 三项要求落实——停机硬契约（DD-8(1) 无条件条款 + 适用面申明「不以 adapter 类型特判」）、ADR-0006 :86 dispose 定义对齐修订（「修订并扩展」措辞，SA2-10）、分层公开 drain 保持（§4.1 映射、DD-8）；
6. 规范文档同步（DD-8 四文件）：ADR 0006 增量修订节（含硬契约 + dispose 对齐 + 适用面申明）+ CONTEXT.md 词条 + `hub-peer-deployment.md`（事件词表条件性注记 SA2-8 / 停机序 file/memory 统一措辞）+ `cordis-plugin-hosting.md`（宿主硬契约指引统一措辞 + **:450-466 示例代码块加有界 drain 步**，SA2-9）。

## 2. Inputs and decision set

| 输入 | 状态 | 说明 |
| --- | --- | --- |
| `wiki/raw/task_issue-412.md`（Host task brief） | 存在 | Issue #412 正文快照（updated 2026-09-20T17:31:48Z，其时 Comments 节为空）——owner 输入以下述评论为准 |
| **Issue comment ID 5751613018**（MEMBER welltop-jim-wang，created/updated 2026-09-20T18:03:36Z） | 存在（本轮继续适用） | SA8 经 `gh api repos/nomicore-ai/nomicore/issues/comments/5751613018` 独立拉取核对（issue `updatedAt` 亦为 18:03:36Z，与此评论一致），与 dispatch 转述及设计 §4.1 映射逐条一致：①确认 dispose 静默丢已 ACK 脏写（违反 ADR 0006:192 durability 承诺）；②确认三个击穿窗口（慢盘并发 / schedule 调长 / **degraded retry 回退窗**）；③接受分层方案（公开 `drain()`、dispose 保持 abort 式）但**至少需要**：硬性契约「宿主优雅停机必须先 `await drain()` 再 dispose」（非参考建议）+ **同步修订 ADR 0006 :86 对 dispose 的现有定义**——「否则契约与实现继续脱节」；④支持 `retryDelayMs` 解耦（缺省保持现行为）。**该评论是本轮的要求权威（requirement authority），不构成对任何既有决策的 override**（见 §4） |
| `wiki/raw/task_issue-412_design.md`（SA1 design iteration 2） | 存在 | 被审对象（558 行，原位全量修订） |
| `wiki/raw/task_issue-412_sa2_review.md` | 存在 | SA2 攻击评审 iteration 1 verdict **reject**：**1 × MAJOR（SA2-7：DD-7/DD-8(1)/DD-8(4) 三处文本对 memory 停机路径互斥——硬契约条款、对外指引与自家实现的「契约与实现脱节」预演）**+ 4 × MINOR（SA2-8~SA2-11）——设计 §14.2 修订映射与 SA2 §13.2 接受条件（路径 (b)：三处文本零矛盾 + S-5a/S-5b 不受影响 + 补 memory 停机验收行）逐条核对**全部满足** |
| `wiki/raw/task_issue-412_sa6_contract.md` | 存在 | SA6 契约 verdict **approve**；两份红/绿契约测试已就位（`persistence-issue-412-drain-red.test.ts` / `-surface.test-d.ts`，git status 存在性核实）；其快照早于 owner 评论（无 owner 约束记载），owner 面由设计 §4.1/SA2 §4 承接，不构成缺口 |
| `task_issue-412_relevant_decisions.md` / `task_issue-412_conflict_report.md` | **不存在** | 前置门禁未运行；SA8 决策集由本报告（承 iteration 0/1 报告）从全量 ADR + CONTEXT + 协议/集成文档 + 模块 AGENTS 重建 |
| ADR 全集（0001–0030） | 已读 | 状态全部 accepted，无 superseded；与本题相关：0006（normative for persistence）、0009、0010、0012、0023；0011/0014 旁证 |
| `CONTEXT.md` | 已读 | 无既有「drain / 完成式排空」词条（grep 证实，:136 的排空表述属 NamespaceRuntime close 语境）→ DD-8 (2) 为新增词条；Language 词条格式 `**术语**: 定义 + _Avoid_` 与设计拟文吻合 |
| `docs/protocols/instance-replication-v1.md` | 已读（相关节） | :685 宿主进程级总停机 watchdog 纪律（「库级无条件排空 + 宿主侧有界退出」模式）；wire 契约 DENY，零变化 |
| `docs/integration/hub-peer-deployment.md`、`docs/integration/cordis-plugin-hosting.md` | 已读（相关节） | 前者 :36-41 事件词表（含「…」开放标记）+ :276-279 停机顺序 AC4 节（四事件序）；后者 :64 停机句 + :450-466 停机清单第 5 步与示例代码块——**当前均无 drain-before-dispose 表述**（B18 属实，grep 核实），DD-8 (3)/(4) 计划同变更集补齐 |
| 模块 AGENTS | 已读 | 根 AGENTS、`docs/AGENTS.md`、`packages/persistence/AGENTS.md`（ADR 0006 normative + 双 adapter 同契约）、`packages/dsh-persistence/AGENTS.md`、`apps/AGENTS.md`、`apps/yjs-server/AGENTS.md`（含「Single disposal chain…Never trigger a second concurrent teardown chain」纪律）——按 skill 计入决策集合 |
| 源码 | 用于事实确认 | 设计 B1–B20 锚点逐条对照（见下注）——**全部属实** |

源码事实核对备注（iteration 2 设计断言 vs 当前代码，重点核对新 B19/B20 与既有锚点复核）：

- **B19（本轮新增，逐条属实）**：`PersistenceConfig` memory 变体 = `Readonly<{ kind: 'memory' }>`（config.ts:58-60，TS 层无 `.schedule` 可达）；boot 以零 options 构造 memory plugin（app.ts:297）；`createMemoryPersistencePlugin` 返回与 file 同款 `{apply, get instance()}`（memory.ts:225-237）；`MemoryPersistence`/`FilePersistence`/两 plugin 工厂均自 barrel 公开导出（index.ts:48-58）→ S-5c 的原型面 spy 可达；
- **B20（本轮新增，逐条属实）**：`writeSnapshot`/`readSnapshot` hook（memory.ts:38/:40）接线时外部 store 是唯一读权威（`read: options.readSnapshot?.(…) ?? mirror` 的 `??` 短路，memory.ts:93）且 flush 写经 hook 进入该 store（memory.ts:94-97）——接线 hook 的 memory 实例与 file 实例同质具有「已 ACK 写需 drain 兑现进 store」保护对象；no-hook 配置 io.write = abort 门 + mirror set，无外部 I/O 失败面；dispose 在 core.dispose 后清 mirror + 归档分区（memory.ts:206-213）——no-hook memory 无跨实例耐久事实（DD-7 memory 统一排空「诚实边界」的技术依据成立）；
- `PersistenceLifecycle` 无 drain、两 adapter 类面无 drain（grep 核实）；`DocPersistence` 成员面 = createDoc/loadDoc/saveDoc required + importDoc/archiveDoc/probe/deleteDoc optional（contract.ts:80-140）、`ReplicaPersistence` required 派生面（:144-158）——DD-1 optional 放置有四连先例；
- `dispose()` = closed/epoch/abort + 逐 live cell clearTimers + **通知 waiters（:818-819 通知点 2）** + handles.clear + doc.destroy + cells.clear + allSettled(inFlight)（lifecycle.ts:801-826）——与 §228-5「dispose() 语义不变」一致；
- `archiveWaiters` push 仅 settle-for-delete 在途等待腿（:661-666）与 settle-for-archive（:690-709）；通知仅 flush finally（:1100-1101）与 dispose（:818-819）；`settleEntryForDelete` cancel-then-evict 腿（:668-675）、`settleEntryForArchive` 干净驱逐腿（:697-701）、`maybeEvict`（:1126-1132）**销毁 live entry 时均不通知 waiter**——DD-5b liveness 空洞指认属实；`:96-98` 字段注释对 settleEntryForDelete 已过期（SA2-4 属实）；
- retry 基准耦合两落点 `schedule.debounceMs || 1`（:1030、:1088）；`scheduleRetry` 首延 = 未 cap 的 `entry.retryDelayMs`，其后 ×2、cap=maxDirtyMs（:1116-1124）——只 cap 间隔不 cap 次数；`scheduleFlush` :1056 retryTimer 早退门（ADR 0006:195 落实）；
- `resolvePersistenceSchedule` 经 `Object.entries(schedule)` 校验环（contract.ts:502-506）——DD-2「条件展开后新键自动入环」成立；`DEFAULT_PERSISTENCE_SCHEDULE` 冻结 500/5000（:478-481）；
- app.ts 第 3 步现状 = `kind === 'file'` 守卫内固定睡眠 `maxDirtyMs ?? 5000 + 500`（:565-573），注释明示 dispose「不冲刷 dirty」；boot 只保留 fiber 未保留 plugin 句柄（:287-299）——iteration 2 的守卫删除与句柄统一保留有明确落点；
- `REST_DRAIN_BUDGET_MS = 10_000` 有界排空先例（app.ts:92-96/:552）= tagged-outcome race（rest-hosting.ts 同款纪律）——DD-7 `awaitDrainWithBudget` 镜像成立；watchdog 链 `STOP_WATCHDOG_MS = 60_000`（main.ts:30）+ `MAX_MAX_DIRTY_MS = 30_000` 立法注释（config.ts:27-34）——预算 ≤ 30.5s < 60s 不变量成立；memory 预算 5.5s 亦然；
- 冻结审计：`persistence-contract.test.ts:32-37` `toEqual` 两键精确、`file-persistence.test.ts:50` / `-sa7-dynamic.test.ts:36` `TEST_SCHEDULE` 两键字面量（源码核实）；`ordered-shutdown-red.test.ts:77-91` 四事件 findIndex + 严格递增（源码核实）——对词表新增事件免疫，B17 论证成立；
- File 写路径 `writeCommittedSnapshot` = mkdir → writeFile(tmp) → rename（file.ts:165-172，写前无 tmp 清理）——S-5b 的 EISDIR 确定性注入机制可行。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior | Classification | Evidence | Required action |
| --- | --- | --- | --- | --- | --- | --- |
| O1 | **Owner 评论 5751613018（要求权威）** | 「把『宿主优雅停机必须先 `await drain()` 再 dispose』写为**硬性契约**而非参考建议」（「否则契约与实现继续脱节」） | 设计三落点兑现：①仓库内宿主结构性强制——DD-7 改造后 dispose 被调用前必然经过第 3 步 await（唯一两出口：drain 完成，或预算耗尽且 `persistence-drain-budget-exceeded` 先于 dispose 发射）；②对全部宿主立法——DD-8 (1) ADR 0006 修订节硬契约条款（含「未经任何 drain 直接 dispose 的宿主接受静默丢失已 ACK 未写入 store 的写」的诚实代价申明）；③**iteration 2：契约跨 store 路径对齐**——硬契约条款**保持无条件**并附适用面申明（「不以 adapter 类型特判；契约边界 = 配置的 store 面」），yjs-server 对 file 与 memory 两 kind 统一执行同一排空步（SA2-7 路径 (b)）——iteration 1 的「条款无条件 vs memory 实现跳过」文本脱节已消除。预算耗尽出口被**显式写入硬契约文本**为「可观察退出，不是违约」，与 Owner 自己的失败路径停机时延关切（「degraded + retry 武装时可能等到 backoff 上限」）自洽，非静默弱化 | implements-existing-decision | 设计 §1 目标 3、§4.1 行 1、§7 DD-7(1) 统一代码块与「硬契约的可满足性论证」、§7 DD-8 (1) 适用面申明、§12 S-5a/S-5b/**S-5c**；owner 评论原文（gh 独立拉取）；config.ts:58-60；memory.ts:225-237 | ADR 修订节落地时预算出口必须保持为**成文可观察条款**（不得降格为建议性措辞）、适用面申明（store 面、非 adapter 类型）须随条款落地；S-5b/S-5c 分别锚定 file 预算路径与 memory 统一路径的事件先序（见 §8 行动 3/3b） |
| O2 | **Owner 评论 5751613018（要求权威）** | 「同步修订 ADR 0006 :86 对 dispose 的现有定义（『释放文件句柄、后台任务和 Y.Doc 缓存』）」 | DD-8 (1) dispose 对齐条款（SA2-10 措辞落实）：「本节**修订并扩展** :86 的 dispose 定义边界」（issue #79 修订节对 :33/:36 的引用式修订同款惯例）——:86 所列释放资源之外，显式声明 dispose 保持 abortive/有损、从来不是持久性屏障（§228-5 重申），「dispose 前的持久性」唯一经分层公开 drain 表达；与本仓 ADR 演进机制（#79/#133/#228 各修订节、docs/AGENTS「Amend or supersede prior decisions explicitly」）同款 | implements-existing-decision | 设计 §4.1 行 2、§7 DD-8 (1)；ADR 0006:86（原文核实）；docs/AGENTS.md Editing 节 | 修订节文本须以**约束性修订语气**呈现对 :86 dispose 定义的增补（有损性 + 硬契约前置），不得仅为信息性重申（见 §8 行动 4） |
| O3 | **Owner 评论 5751613018（要求权威）** | 「可以接受 issue 的分层方案（公开 drain()，dispose 保持 abort 式）」＋确认问题 2 解耦（缺省保持现行为）＋确认 degraded retry 回退窗为第三击穿窗口 | 分层保持：drain 为 `DocPersistence` optional 分层公开能力（DD-1），dispose 不吸收 drain（DD-7 备选 (iii) 否决论证与 Owner 表述逐字对齐）；DD-2/DD-3 解耦且缺省动态回退 debounceMs（键形状不变，冻结审计零迁移）；回退窗由 drain 被动等待（ADR 0006:195）+ 宿主预算（DD-7 备选 (iv) 诚实记录）双重覆盖；§4.1 行 4 补第三窗口 traceability（SA2-11） | no-conflict | 设计 §1 非目标、§4.1 行 3/行 4、§7 DD-1/DD-2/DD-5/DD-7；owner 评论原文 | 无 |
| D1 | ADR 0006（`docs/adr/0006-server-persistence-docstore.md`） | :34「持久层内部调度：不设外部 flush/cron 协调器……retry 同属持久层内部，以退避策略重试直到成功或插件停止」 | drain 是宿主发起的**一次性**完成式排空（每脏 entry 恰一次强制 flush + 完成等待 + 回退窗被动等待），非周期协调器；库级 drain 无预算参数（§1 非目标明示），持续失败下不 resolve = 「直到成功或插件停止」的宿主侧映像（宿主预算 = 「插件停止」映像，DD-7/修订节关系申明）。方向有 ADR 内在先例（:37 release 归零后可触发/等待 flush、:213 archiveDoc 先排空），但「公开完成式排空入口」超出 :34 明文许可面，属对已接受持久层契约的扩展 | **evolution-required** | 设计 §1 目标/非目标、§7 DD-5、§8、§13 风险行 7；ADR 0006:34/:37/:213；`settleEntryForArchive` 先例（lifecycle.ts:690-709） | ADR 0006 增量修订节（DD-8）必须与实现同变更集落地，含与 :34 的关系申明（iteration 0 行动 1 维持） |
| D2 | ADR 0006 | :195「降级等待期内（任一可观察时刻）retry 退避即该 entry 的唯一 flush 调度源（退避上限 max-dirty 间隔）」 | drain 遇 `retryTimer` 武装期被动注册 waiter 等待退避到点，不发起额外 flush、不热循环（1f 锚定 attempts 恒 1）；宿主预算在等待之外计时（app 层 race），不进入 entry 调度面 | no-conflict | 设计 §7 DD-5、§8 状态机行 1；lifecycle.ts:1056、:1116-1124 | 无 |
| D3 | ADR 0006 | §228-5（issue #228 修订节第 5 条，:240）「`dispose()` 语义不变」＋ :86 dispose 释放资源条款 | dispose 路径零改动（非目标明示，Owner 评论再确认）；DD-5b 三处驱逐点通知补全不含 dispose 段（dispose 已有通知点 2）；drain-after-dispose vacuous resolve 是新入口语义、不改 dispose 行为；memory 路径统一排空**不触碰 Memory.dispose 的 drain-then-clear mirror 冻结语义**（memory.ts:206-213，B20——统一调用「不为 no-hook memory dev 配置创造跨实例耐久事实」在 DD-7/风险表/DD-8 显式声明） | no-conflict | 设计 §1 非目标、§7 DD-5「dispose 交错」、§7 DD-7 memory 统一 bullet 第 3 点、§7 DD-8 (1)、§11 DENY；lifecycle.ts:801-826；memory.ts:206-213 | 无 |
| D4 | ADR 0006 | :157-159「create/load 同键协调与 flush 调度收敛为 adapter 共享的 persistence lifecycle core（两 Adapter 不得复制状态机）」＋ `packages/persistence/AGENTS.md`「Memory and file adapters must satisfy the same contract」 | drain 状态机单点落 `PersistenceLifecycle`；Memory/File 仅纯委派（File 侧仅增 `validateIdentity` 防御）；C14 双 adapter 等价验收；**memory 统一路径经同一 core.drain 兑现**（无 memory 专属状态机分支） | no-conflict | 设计 §7 DD-1、§12 C14；memory.ts/file.ts 委派壳现状 | 无 |
| D5 | ADR 0006 | :52（temp→rename 提交态、`.tmp` 忽略）/:55（「rename 成功即完成一次 flush」，无 fsync 纪律） | drain 复用既有 `io.write` 提交语义，零 I/O 路径改动；不承诺掉电级持久性（§1 非目标明示） | no-conflict | 设计 §1 非目标、§8 L1；lifecycle.ts flush 段；file.ts:165-172 | 无 |
| D6 | ADR 0006 | :221-232（issue-#228 修订节「DocPersistence optional 成员 / ReplicaPersistence required 成员」放置先例）＋ contract.ts §4.4 注释 | `drain` 建模为 `DocPersistence` **optional** 成员（readonly 属性签名，与 importDoc/archiveDoc/probe/deleteDoc 同款）；三成员字面量 / 13 stub 守卫零编译红（C13）；Memory/File 均为具体类方法（SA6 `HasDrain<MemoryPersistence/FilePersistence>` 类型锚可达——B19 barrel 导出核实） | implements-existing-decision | 设计 §7 DD-1；contract.ts:80-139 现状；ADR 0006:226-229；index.ts:48-58 | 无（放置先例兑现；新成员语义随 D1/D8 演进走 DD-8 文档化） |
| D7 | ADR 0006 | :142-158「`ReplicaPersistence` = 具备复制生命周期能力的 Persistence 面（required 形态）」 | drain **不**加入 `ReplicaPersistence`：drain 是宿主停机/排空能力，非复制生命周期语义；消费方持具体 adapter 类型或 typeof 窄化（INV-13 纪律）。无任何条款要求 drain 上派生面 | no-conflict | 设计 §7 DD-1 备选论证；contract.ts:142-158 | 无 |
| D8 | ADR 0006 | :34「默认值可由插件配置覆写」＋ `PersistenceSchedule` 契约形状（contract.ts:473-481，`DEFAULT_PERSISTENCE_SCHEDULE` 冻结 500/5000） | `PersistenceSchedule` 新增可选键 `retryDelayMs?`：显式配置时重试首基准 = 该键；未配置时解析结果**键形状不变**（缺省回退在 lifecycle 内动态取 debounceMs，`retryBaseMs` getter 单源）——B12 四组冻结审计零改动即绿（源码核实 `toEqual` 精确断言）。新键扩展了已接受的 schedule 契约形状，需决策文档同步 | **evolution-required** | 设计 §7 DD-2/DD-3、§10；contract.ts:472-509；`persistence-contract.test.ts:32-37` | ADR 0006 修订节收录新键与解析形状裁决（DD-8 已计划） |
| D9 | `packages/dsh-persistence/AGENTS.md` | 「Preserve machine-readable event and record shapes when changing the CLI or inspector-facing output」 | `record.ts:20` 记录头与 `ProbeRecordMeta.schedule` 两键字面量**有意冻结**不改；默认探针运行 resolved 键面/时间线逐字节不变；配置 retryDelayMs 的探针运行时间线变化 = 新配置的预期可观察行为（事件 `t=` 值），非 shape 变化 | no-conflict | 设计 §1 非目标、§7 DD-6、§11 DENY；record.ts:20；probe.ts:445/:464 | 无（记录头扩展列为 follow-up 属独立立法，处置正确） |
| D10 | `apps/yjs-server/AGENTS.md` + `docs/integration/hub-peer-deployment.md` | AGENTS「Single disposal chain: replication drain → bounded REST drain → registry shutdown → diagnostics close → persistence dispose → timer/clock teardown. Never trigger a second concurrent teardown chain」；hub-peer-deployment :276-279 停机顺序 AC4 节四事件序 | DD-7 在同一链的原睡眠位（diagnostics-closed 之后、persistence fiber dispose 之前）以 `awaitDrainWithBudget(adapter.drain(), budget)` 替换固定睡眠——drain（含预算 race）是**等待**不是拆卸，不构成第二条 teardown 链；预算尽发事件后继续同一链 3b 步 dispose；四事件序零变化（ordered-shutdown-red.test.ts:77-91 findIndex 断言源码核实，对词表新增免疫）；`stop()` 幂等 single-flight 不变。**iteration 2**：memory 路径在同位置**新增**同一等待步——同为链内等待（今日 memory 无任何等待步，iteration 2 起为「即时完成的完成式等待步」），单一拆卸链纪律对两 kind 同构保持 | no-conflict | 设计 §7 DD-7、§8 L4、§12 S-5a/S-5b/S-5c；apps/yjs-server/AGENTS.md；app.ts:532-594 现状；ordered-shutdown-red.test.ts:77-91 | 无 |
| D11 | ADR 0012（instance identity / plugin ownership）+ 根 AGENTS「do not assume a stable dynamic pluginId or cordis_define contract」 | :37「上游资源随后由 composition root 按 Registry → Persistence → Timer/Clock 的顺序释放」 | **iteration 2 扩展后的裁决仍成立**：file 与 memory 两分支统一保留 plugin 句柄（`createFilePersistencePlugin` / `createMemoryPersistencePlugin` 返回同款 `{apply, get instance()}` 自有公共句柄，file.ts:265-272、memory.ts:225-237 源码核实；dsh-persistence profile.ts 消费先例），经 `get instance()` 取 adapter——`.instance` 是本仓插件的公开面，不触碰 instanceId/role 所在 Instance service，不假设 cordis 动态 pluginId；drain 位置与 :37 释放次序一致（Persistence 释放段内的前置等待）；apps AGENTS「Consume only package public exports」合规（句柄与类均 barrel 导出，B19） | no-conflict | 设计 §7 DD-7(1)、B14/B19；file.ts:265-272；memory.ts:225-237；ADR 0012:37 | 无 |
| D12 | ADR 0009（Registry、租约与宿主生命周期） | :99 shutdown 语义（停接纳、已接纳操作结算、close 全部 Runtime、不等外部 lease release） | `packages/namespace-registry/**` 在 DENY LIST；registry shutdown 语义零触碰；drain 在 registry shutdown 之后由宿主调用（lease 全释放 ⟹ 停机上下文无并发写者——DD-5 静息观察点边界的链路前置条件） | no-conflict | 设计 §1 非目标、§7 DD-5、§11 DENY；ADR 0009:99 | 无 |
| D13 | ADR 0010 + `docs/protocols/instance-replication-v1.md` | wire 契约与复制状态机（:685 宿主进程级总停机 watchdog 纪律；库级无条件排空 + 宿主侧有界退出模式） | wire 零变化（DENY LIST 排除 docs/protocols/** 与 ws-replication/**）；DD-7 把有界退出从「依赖 watchdog 兜底」升级为「app 自有预算 + 诚实事件」——watchdog 退居最后兜底而非常规边界，库级 drain 无预算语义与 :685 模式同族且更严（file 预算 ≤ 30.5s、memory 预算 5.5s，均 < 60s watchdog） | no-conflict | 设计 §11 DENY、§7 DD-7；instance-replication-v1.md:685（源码核实） | 无 |
| D14 | `docs/AGENTS.md` + 根 AGENTS 词汇纪律 | 「When code behavior changes, update every normative document whose stated contract changed」/「update CONTEXT.md when introducing a changing domain term」/「Record a durable architectural decision as an ADR. Amend or supersede prior decisions explicitly」 | DD-8 计划（四文件，均在 ALLOW）：①ADR 0006 增量修订节（接口片段 + drain 语义条款 + **停机硬契约条款（无条件 + 适用面申明）** + **dispose 对齐条款（修订/扩展 :86）** + DD-2 解析形状 + DD-5b 不变量 + 非 live cell 排除裁决存档）；②CONTEXT.md「Language」新增词条「完成式排空（drain）」（含 `_Avoid_` 行）；③hub-peer-deployment.md 事件词表补 `persistence-drain-budget-exceeded`（**条件性注记，SA2-8**）+ 停机顺序节补有界完成式排空一句（**file/memory 统一**）；④cordis-plugin-hosting.md :64 停机句与 :450-466 清单第 5 步补 drain-before-dispose 硬契约指引（**统一措辞 + degraded 预算措辞限定为耐久 adapter 关注点 + 示例代码块加有界 drain 步，SA2-9**）——app 事件面与宿主拆卸契约变化后的规范同步义务闭合 | implements-existing-decision | 设计 §6 行 D14、§7 DD-8；docs/AGENTS.md；hub-peer-deployment.md:36-41/:276-279；cordis-plugin-hosting.md:64/:450-466（现状无 drain 表述，grep 核实） | 实现阶段同变更集兑现（见 §8 行动 1/5） |
| D15 | ADR 0006 | :213「archiveDoc……先排空既有 dirty 状态」（归档 settle 通知面的契约承诺） | DD-5b 把「任何移除 live entry 的路径必须释放其 settle waiters」归纳为不变量，补全三处驱逐点通知（maybeEvict / settle-for-delete cancel-then-evict / settle-for-archive 干净驱逐，源码核实三处均无通知）——修复既有 archive×delete 理论挂起，是 :213 排空承诺的 liveness 完备化；无等待者时 splice 空数组零观测差异（:1097-1099 既有同款论证）；live-entry 移除点全集枚举完备（SA2 SM-4 核对） | implements-existing-decision | 设计 §7 DD-5b、§13 风险行 5；lifecycle.ts:668-675/:697-701/:1126-1132（通知缺席核实） | 无（修订节收录该不变量一句；iteration 0 行动 3 维持） |
| D16 | ADR 0006 | issue-#79 修订节 :187「状态词与优先级冻结：`disposed` > `released` > entry 状态（`persistence-degraded` / `ready`）」 | drain 不改 getStatus 词表、不新增状态（§8 零新状态、§7 DD-5 明示） | no-conflict | 设计 §7 DD-5「非破坏性」、§8 | 无 |
| D17 | ADR 0023（冻结服务可被 Proxy 包装消费——构造纪律） | :45/:62「凡经 ctx.provide 发布的服务对象，函数成员一律访问器属性构造；新增服务优先纯数据对象或 class 实例」 | `nomicorePersistence` 服务 = class 实例（0023 影响面表「否——不变量只约束自有属性」）；drain 以原型方法落在 class 上，天然合规；未新增对象字面量服务 | no-conflict | 设计 §7 DD-1；ADR 0023:43-47/:60-64（源码核实） | 无 |
| D18 | `apps/yjs-server/AGENTS.md`「stdout is a strict NDJSON lifecycle-event channel」+ `docs/integration/hub-peer-deployment.md:36-41` 事件词表（含「…」开放标记；`fatal-shutdown`/`diagnostics-closed`/`reload-failed` 均为后增先例） | 公开事件面的 additive 纪律：新增事件须保持 NDJSON 形状、脱敏纪律与冻结事件序/在场性锚 | `persistence-drain-budget-exceeded`（载荷 `{event, budgetMs}`——纯数值，脱敏合规）；发射位 = 原睡眠位（diagnostics-closed 与 persistence-disposed 之间；memory 路径为同位置新步，但 no-hook memory 无失败面 ⟹ 结构性不发射）；三组既有锚（findIndex 严格递增 / countOf 恰一次 / firstIndex 顺序）经源码核验对词表新增免疫；词表同步进 hub-peer-deployment.md 且**带条件性注记**（SA2-8：仅预算耗尽时发射——注记防运维在每次停机中寻找该事件） | implements-existing-decision | 设计 §7 DD-7 (1) 新事件、B17、§7 DD-8 (3)、§10 事件行；ordered-shutdown-red.test.ts:77-91（源码核实） | 词表文档同步与事件落地同变更集（§8 行动 5）；实现复查核对新事件不破坏任何既有锚 |
| D19 | `docs/integration/hub-peer-deployment.md`（停机顺序 AC4 节）+ `docs/integration/cordis-plugin-hosting.md`（:64/:450-466 宿主拆卸契约——根 AGENTS 指定为外部 Cordis 宿主生命周期拆卸的规范文档） | 规范集成文档所载宿主停机契约 | **iteration 2 扩面后的触碰面**：①hub-peer-deployment 停机顺序节补「Registry shutdown 之后、Persistence dispose 之前对持久化 adapter（**file 与 memory 配置统一**）执行有界完成式排空」一句；②cordis-plugin-hosting 停机清单第 5 步补 drain-before-dispose 硬契约指引——**统一适用于两种 adapter**（接线外部 store 的 memory 实例与 file 实例同质受保护；未接线 hook 的 memory dev 配置不因 drain 获得跨实例耐久，但契约形状一致）、degraded 退避等待措辞限定为耐久 adapter 关注点、**:450-466 示例代码块加入有界 drain 步（SA2-9——现状示例恰是硬契约禁止的形状）**。两处均为**已接受宿主契约文档的显式演进**（additive 细化 + Owner 硬契约向全部宿主立法），修订计划完整（DD-8 (3)/(4)，两文件在 ALLOW）；iteration 1 的「指引含 memory vs app 实现跳过」三方不一致（SA2-7 的文档面）由此消除——指引、ADR 条款与 app 实现对 memory 路径给出同一答案 | **evolution-required** | 设计 §7 DD-8 (3)/(4)、B18、§11 ALLOW；hub-peer-deployment.md:276-279；cordis-plugin-hosting.md:64/:450-466（现状核实） | 与代码同变更集落地（§8 行动 5）；实现复查核对两文档实际 diff 与设计拟文一致（含示例代码块 drain 步与统一措辞） |

裁决分布：**no-conflict 13（O3、D2–D5、D7、D9–D13、D16、D17）/ implements-existing-decision 6（O1、O2、D6、D14、D15、D18）/ evolution-required 3（D1、D8、D19）/ hard-conflict 0**（共 22 项对照）。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
| --- | --- | --- | --- |

**无。** Owner 评论 5751613018（本轮继续适用，SA8 已再次独立拉取核对）**不覆盖（override）任何既有决策**：它确认分层方案与 §228-5 dispose 冻结（「可以接受 issue 的分层方案」＝对既有冻结面的明文再确认，非推翻）、确认 ADR 0006:192 durability 读法，并以「至少需要」形式**要求走正式演进路径**（ADR 0006 增量修订节修订 :86 dispose 定义 + 无条件硬契约条款 + 集成文档同步）。无新 ADR supersede 旧 ADR；无协议版本升级。本题全部决策面处理均为正式演进（ADR 0006 修订节 + 集成文档同步），非 override；SA8 不替 Owner 或 SA1 创建 override。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（iteration 2 设计裁决） |
| --- | --- | --- | --- |
| `dispose()` 语义（lifecycle 与 Memory/File 壳） | abort + clearTimers + 通知 waiters + handles.clear + doc.destroy + cells.clear + allSettled(inFlight)；Memory 壳 drain-then-clear mirror；有损/abortive 语义保持 | ADR 0006 §228-5（:240）+ :86；lifecycle.ts:801-826；memory.ts:206-213；Owner 评论 5751613018 明文再确认；SA6 C11 基线绿锚 | 保持（§1 非目标；dispose 段零改动；DD-5b 不触 dispose；DD-7 备选 (iii)「dispose 内部先 drain」被否决；memory 统一排空不触碰 Memory.dispose 冻结语义——DD-7「诚实边界」显式声明） |
| `DEFAULT_PERSISTENCE_SCHEDULE` 与未配置解析键形状 | `Object.freeze({debounceMs:500, maxDirtyMs:5000})`；未配置时 resolved 恰两键 | contract.ts:478-509；`persistence-contract.test.ts:32-37`（`toEqual` 精确，源码核实） | 保持（DD-2 条件展开——缺省不物化键；iteration 0 行动 2 维持为实现红线） |
| 既有冻结审计四组 | `persistence-contract.test.ts:32-37`、`file-persistence.test.ts:50`、`file-persistence-sa7-dynamic.test.ts:36`、phase5 surface 测试零改动即绿 | 设计 B12；SA6 §15 D-2/D-3；源码核验 | 保持（DD-2/DD-3 零迁移路径） |
| yjs-server 停机事件序与在场性锚 | 四事件 `replication-drained → registry-stopped → persistence-disposed → app-stopped` 严格递增；五事件（含 `diagnostics-closed`）`countOf === 1` | ordered-shutdown-red.test.ts:77-91（源码核实）；issue270-regression-anchors.test.ts；hub-peer-deployment.md:276-279 | 保持（file：原睡眠位替换；memory：同位置新增等待步但无新事件发射；新事件 additive 且预算耗尽才发射——两类锚均免疫，源码核验） |
| yjs-server 配置 schedule 词表 | 两键闭集 + 未知键拒绝 + `MAX_MAX_DIRTY_MS` 上界 | app config.ts:58-60/:248-252/:27-34（源码核实） | 保持（DD-7：retryDelayMs 不上 app 配置面，**不新增预算配置键**——file 预算 = maxDirtyMs + 边距推导、memory 预算 = DEFAULT_MAX_DIRTY_MS + 边距缺省推导，零新增键；仅注释与 :270 拒绝文案 parenthetical 刷新，两测试只钉路径段，零改动即绿） |
| DSH 记录头与事件行 | `record.ts:20` 两键渲染；事件行含 `t=`（determinism golden 逐字节） | record.ts:20；dsh-persistence AGENTS「Preserve machine-readable shapes」 | 保持（DD-6 有意冻结；默认探针时间线零漂移） |
| getStatus 状态词与优先级 | `'ready' \| 'persistence-degraded' \| 'released' \| 'disposed'` 冻结 | ADR 0006 issue-#79 修订节 :187 | 保持（drain 零新状态、不触词表） |
| 提交语义与存储格式 | temp→rename 提交点；`.tmp` 忽略；无 fsync 承诺；snapshot/归档布局不变 | ADR 0006:52/:55/:215；file.ts:165-172 | 保持（零 I/O 路径改动，全 additive 可 revert） |
| Registry shutdown / lease 语义 | ADR 0009 全部条款 | `packages/namespace-registry/**` DENY | 保持（零触碰） |
| Wire / 复制状态机 | instance-replication-v1.md 全部帧与状态机 | `docs/protocols/**`、`packages/ws-replication/**` DENY | 保持（wire 零变化） |
| `PersistenceIO` seam | 既有成员面不变（不新增 io 成员） | contract.ts PersistenceIO；ADR 0006:230-232 | 保持（drain 只消费既有 io.write） |
| SA6 契约测试两文件 | `persistence-issue-412-drain-red.test.ts` / `-surface.test-d.ts` 零触碰（验收证据不可变） | 设计 §11 DENY（SA2-6）；文件存在性核实 | 保持（DD-4 形状与两文件调用点形状逐字段一致 → 契约测试零改动） |

## 6. Evolution requirements

三项 `evolution-required`（D1 公开 drain 能力、D8 schedule 新键、D19 集成文档宿主契约演进）与 O1/O2 的 ADR 义务共用 DD-8 修订计划。**iteration 2 在 iteration 1 扩面之上再扩展**（硬契约条款适用面申明、dispose 对齐措辞「修订/扩展」、cordis-plugin-hosting 示例代码块、hub-peer-deployment 词表条件性注记与 file/memory 统一措辞），按 skill 清单逐项核对：

| 检查项 | 计划内容（设计章节） | 判定 |
| --- | --- | --- |
| 修订文件 | `docs/adr/0006-server-persistence-docstore.md` 增量修订节 + `CONTEXT.md` Language 新词条「完成式排空（drain）」（含 `_Avoid_`）+ `docs/integration/hub-peer-deployment.md`（词表/停机序）+ `docs/integration/cordis-plugin-hosting.md`（宿主硬契约指引 + 示例代码块） | 完整（四文件均在 ALLOW LIST） |
| 新旧语义 | 接口片段（optional `drain` + `PersistenceDrainTarget` + `PersistenceSchedule.retryDelayMs?`）；drain 语义条款（§8 全量：范围/每 entry 语义/静息观察点返回语义/非破坏性/dispose 交错/并发重入/`targets: []` no-op/File 校验例外）；**停机硬契约条款（O1：无条件 + 适用面申明「不以 adapter 类型特判，契约边界 = 配置的 store 面」+ 预算耗尽可观察出口 + 「未 drain 即 dispose = 接受静默丢失」代价申明）**；**dispose 对齐条款（O2：「修订并扩展 :86 定义边界」——abortive/有损、非持久性屏障、分层表达）**；DD-2 解析形状裁决；DD-5b 不变量；非 live cell 排除裁决存档；与 :34/:195/§228-5 的关系申明（均保持） | 完整（DD-8 明示；Owner 两项最低要求均入修订节文本，iteration 2 对 memory/store-path 适用面再补申明） |
| 兼容与迁移 | 全 additive：optional 成员 + optional 键 + 新公共方法 + 消费方一处替换（file 睡眠位）+ memory 同位置新等待步 + 一个新事件 + 注释/文档刷新；第三方 stub/三成员字面量零编译红（C13）；B12 四组审计零改动零迁移；既有事件锚免疫（源码核验）；revert = 逐文件删除，无数据迁移 | 完整（DD-2/DD-3/§9 回滚） |
| 失败语义 | drain store 失败面永不 reject、不新增 typed 错误族（例外申明：`resolvePersistenceSchedule` 非法值复用既有 `RangeError` 词表（校验环 `Object.entries` 自动覆盖新键，源码核实）、File unsafe target 沿既有 `validateIdentity` bare Error）；degraded 沿既有内部退避（ADR 0006:34/:195）；**宿主预算尽 → `persistence-drain-budget-exceeded` 诚实事件 + 有损继续（不 abort drain、不重试、不静默）；drain 同步 throw（结构性不可达）→ 链 catch → `app-stop-failed` loud**；no-hook memory 无失败面（B20）⟹ 预算事件结构性不发射 | 完整（§9；S-4/S-5b/S-5c） |
| 版本 | 无 wire / 持久化格式 / schema 版本面被触碰（存储布局不变、DSH 记录格式冻结、协议 DENY）；无版本化表面适用 | N/A（已论证；实现复查确认无隐含版本面漂移即可） |
| 验证 | §12 验收矩阵（C1–C14 + S-1~S-4 + S-5a 健康 / S-5b degraded 预算路径 / **S-5c memory 统一路径**——SA2-7 路径 (b) 接受条件的验收行：drain 恰一次且严格先于 `persistence-disposed`、四事件序完整、无预算事件、stop 正常返回）+ Runner 门（persistence `vitest --typecheck`、包 tsc、dsh golden、yjs-server tsc+test、root `pnpm typecheck && pnpm test`——满足 persistence AGENTS「契约/生命周期变更必跑根门」+ yjs-server AGENTS 验证条目） | 完整（S-5b 的 EISDIR 注入机制经 file.ts:165-172 写序核验可行） |
| 保持不变的冻结面 | §1 非目标 + §11 DENY + 本报告 §5 表 12 项逐条对照 | 完整 |

**结论：修订计划完整（iteration 2 扩面后仍完整，且 SA2-7 的三处文本一致性缺口已消除）** → 按技能规则可 `clear`，但必须 `requiresConflictRecheck: true`（见 §10）。

## 7. Hard conflicts

**无。** 未发现任何与既有决策不兼容且无演进路径的设计点。iteration 2 修订的核心变化（file/memory 统一排空、硬契约适用面申明、示例代码块、S-5c）均有明确决策依据与完整修订计划；设计 §6 表对本报告各行的预映射经 ADR/源码逐条核实无误。特别核对：

- **SA2-7（MAJOR）所指控的三方文本矛盾在 iteration 2 中已消除**：DD-7(1) 统一代码块（`kind === 'file'` 守卫删除、plugin 句柄两 kind 统一、memory 预算缺省推导）／DD-8(1) 硬契约条款保持无条件 + 适用面申明（不以 adapter 类型特判）／DD-8(4) 指引与示例统一 file/memory 措辞——三处对「memory 停机是否先 drain」给出**同一答案（是）**，且 yjs-server 自家实现兑现；SA2 §13.2 路径 (b) 的三项接受条件（三处零矛盾 / S-5a/S-5b 不受影响 / 补 memory 停机验收行 S-5c）逐条满足。Owner 的「契约与实现脱节」禁令在硬契约文本面上闭合；
- 统一 memory 排空不与任何冻结面冲突：Memory.dispose drain-then-clear mirror 冻结语义不变（D3）；单一拆卸链纪律对两 kind 同构（D10）；预算（file ≤ 30.5s / memory 5.5s）< 60s watchdog，`MAX_MAX_DIRTY_MS` 立法的被约束对象保持为真不变量（config.ts/main.ts 注释刷新一致化，均入 ALLOW）；no-hook memory 无跨实例耐久事实的边界在 ADR 修订节、指引与风险表三处显式声明（不夸大 drain 对 dev 配置的耐久意义——与 ADR 0006 措辞纪律一致）；
- Owner 评论 5751613018 的两项最低要求（硬契约 + :86 对齐修订）在修订版中均有结构落点与成文计划（§4.1 映射与评论源文逐条核对一致），无遗漏、无静默弱化（预算出口成文于硬契约文本本身；「修订并扩展 :86」措辞满足 SA2-10）；
- 新事件面（D18）与集成文档触碰（D19）不与任何冻结面冲突（三组事件锚免疫 + 四事件序保持 + DENY 未越界）。

## 8. Required actions

1. **（阻断实现合并，非阻断设计通过）** DD-8 修订必须与代码同变更集落地，且**扩面后的四文件一个不可缺**：ADR 0006 增量修订节（含 a. 停机硬契约条款（无条件 + 适用面申明——store 面，非 adapter 类型）、b. dispose 对齐条款（「修订并扩展 :86」措辞）、c. 与 :34/:195/§228-5 关系申明、d. DD-2 解析形状、e. DD-5b 不变量）+ CONTEXT.md 词条 + hub-peer-deployment.md（词表含条件性注记/停机序 file/memory 统一句）+ cordis-plugin-hosting.md（宿主硬契约指引 + **:450-466 示例代码块有界 drain 步**）。缺失即构成「缺少必要修订」的 reject 条件。
2. 实现阶段保持 DD-2 的「键形状不变」红线：不得物化缺省 `retryDelayMs` 进 resolved schedule（会击穿 `persistence-contract.test.ts:32-37` 与 DSH 记录头两处冻结面）。
3. 硬契约的落地保真：ADR 文本中预算耗尽出口必须保持为**成文可观察条款**（「预算尽后继续 dispose 有损路径是硬契约的显式可观察退出，不是违约」），不得在实现/文档化时降格为建议性措辞；app 侧预算尽时 `persistence-drain-budget-exceeded` 必须**先于** `persistence-disposed` 发射（S-5b 锚定）。
4. dispose 对齐条款须以约束性修订语气**修订并扩展** :86 的 dispose 定义（有损性 + drain 前置硬契约），不得仅为信息性重申——Owner 原文「同步修订……否则契约与实现继续脱节」的验收标准即在于此。
5. 词表与宿主契约文档同步保真：`persistence-drain-budget-exceeded` 进 hub-peer-deployment.md 词表（位置：`registry-stopped` 与 `persistence-disposed` 之间，**带「仅预算耗尽时发射」条件性注记**）；cordis-plugin-hosting.md 指引须覆盖仓库外宿主且与 app 实现对 memory 路径**同答案**（统一措辞 + degraded 预算措辞限定耐久 adapter + 示例代码块加 drain 步）。
6. config.ts/main.ts 注释刷新保持诚实边界：预算覆盖**正常路径**最坏等待（强制 flush + maxDirty 级退避节奏 + I/O 边距）；库级 drain 本体无上界（持续失败 store 下的总界 = 宿主预算）；注释不得写成「drain 恒有界」；memory 预算分支（`DEFAULT_MAX_DIRTY_MS` 缺省推导）须在注释中如实表述。
7. 实现后运行 **implementation 复查**（触发条件已满足：design §15 明示需要 + 公共 API/事件面/生命周期/文档修订等待实现核对）；复查按 §5 冻结面 12 项逐项核对实际 diff，核对 §8 行动 1/3/4/5 的落地保真，并**专项核对 SA2-7 路径 (b) 的实现保真：memory 停机链上 drain 确被调用且严格先于 dispose（S-5c：spy 恰一次 + 事件先序）、`kind === 'file'` 守卫确实删除、plugin 句柄两 kind 分支统一赋值**。

## 9. Verdict

**clear**

- 22 项对照：13 项 no-conflict + 6 项 implements-existing-decision + 3 项 evolution-required（修订计划完整、四份修订文件已入 ALLOW、冻结面 12 项全部显式保持）；
- 0 hard-conflict、0 项需要 override（Owner 评论 5751613018 为要求权威而非 override 权威——其要求经正式演进路径兑现）；
- Owner 两项最低要求（硬契约 + ADR 0006 :86 对齐）在修订版设计中均有结构落点与成文计划，且 iteration 2 把硬契约对齐扩展到全部适用 store 路径（file 与 memory——含 hook 接线 memory 实例的耐久面），「契约与实现脱节」在三处文本（DD-7/DD-8(1)/DD-8(4)）与 app 实现四方面同时闭合（§4.1 映射与评论源文逐条核对一致）；
- SA2-7（MAJOR，iteration 1 reject 根因）按其 §13.2 路径 (b) 接受条件逐条闭合；SA2-8~SA2-11 四项 MINOR 均已采纳（词表条件注记 / 示例代码块 / 「修订并扩展」措辞 / 第三窗口 traceability 行）；
- 修订版的 B1–B20 事实锚点（含 iteration 2 新增 B19 memory 配置面/公共句柄/barrel 导出、B20 hook 决定耐久面）经源码逐条核实全部属实；iteration 1 报告的全部结论在 iteration 2 对象上复核维持或强化，无新增冲突面。

## 10. requiresConflictRecheck

**true**

- 公共 API（`DocPersistence.drain?` + `PersistenceDrainTarget` barrel 导出）、生命周期/状态机新入口语义（vacuous-after-dispose、无预算、并发重入、静息观察点边界）、驱逐点通知面补全（DD-5b 三处 + 字段注释）、持久化配置语义（`PersistenceSchedule.retryDelayMs?` + 解析形状）——尚待实现核对；
- **公共事件面新增**（`persistence-drain-budget-exceeded`：发射位/载荷/三组既有锚免疫）与**消费方停机语义替换**（DD-7 预算组合、常量保留、config/main 注释刷新）——尚待实现核对；
- **iteration 2 新增复查面**：memory 路径统一排空的实现保真（`kind === 'file'` 守卫删除、plugin 句柄两 kind 统一、S-5c 的 drain-先于-dispose 事件先序锚、no-hook memory 无预算事件）——尚待实现核对；
- **DD-8 扩面后的四份规范文档修订**（ADR 0006 硬契约条款 + 适用面申明 + dispose 对齐条款 + :34 关系申明；CONTEXT.md 词条；hub-peer-deployment.md；cordis-plugin-hosting.md 含示例代码块）与 Owner 要求的落地保真（§8 行动 1/3/4/5）——尚待实现核对；
- 前置门禁产物缺失（relevant_decisions / conflict_report 不存在，本报告为该任务唯一 SA8 产物链）亦要求实现后复查闭合。
