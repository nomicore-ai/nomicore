# SA1 实现设计 — issue #412：persistence 公开完成式排空 `drain()` + `retryDelayMs` 与 `debounceMs` 解耦（iteration 2，落实 SA2-7 修订：停机硬契约对 file/memory 路径统一）

- 任务类型：**Feature（能力缺口）**（承接 SA6 契约判定）
- 仓库 / worktree：`/home/wangjian/nomicore-fix-issue-412`（分支 `mabf/issue-412`，HEAD `c3f7bd9`）
- 上游输入：
  - `wiki/raw/task_issue-412.md`（Host task brief；快照 updated 2026-09-20T17:31:48Z）
  - `wiki/raw/task_issue-412_sa6_contract.md`（SA6 契约，verdict **approve**，含两份已就位的红/绿契约测试文件）
  - `wiki/raw/task_issue-412_sa2_review.md`（SA2 攻击评审，iteration 1 verdict **reject**：0 × BLOCKER、**1 × MAJOR（SA2-7）**、4 × MINOR（SA2-8~SA2-11）——本轮修订输入；iteration 0 findings（SA2-1~SA2-6）经该评审复核已全部落实）
  - `wiki/raw/task_issue-412_design_conflict_report.md`（SA8 设计后冲突复查，iteration 0 verdict **clear**：0 hard-conflict、3 × evolution-required、`requiresConflictRecheck: true`）
- **Owner 要求（本轮适用）**：Issue comment ID `5751613018`，updated `2026-09-20T18:03:36Z`（MEMBER）——「graceful shutdown 必须有 await drain before dispose 的硬契约；ADR-0006 dispose 语义/契约必须对齐（否则契约与实现继续脱节）；dispose 保持 abortive 时保留分层公开 drain 方式」。来源说明：该评论更新时间晚于 Host task brief 快照（17:31:48Z，其 Comments 节为空）；评论要求以 dispatch 转述为权威输入纳入设计（§4 映射；SA2 已经 `gh api` 取回全文核对转述一致）。
- 缺失输入：`task_issue-412_relevant_decisions.md`、`task_issue-412_conflict_report.md`、`task_issue-412_sa8*` 前置门禁产物不存在（SA8 设计后复查报告为该任务首个 SA8 产物，其决策集由其自行重建，见 §6）
- 设计产物：本文件（`wiki/raw/task_issue-412_design.md`，**iteration 2 原位全量修订**——iteration 1 被 SA2 reject 的 memory 路径三处文本不一致（SA2-7：DD-7「memory 不引入 drain」vs DD-8(1) 无条件硬契约 vs DD-8(4)「file/memory」指引）已按 **SA2-7 路径 (b)：统一调用** 删除/改写，全文只描述当前一致设计；iteration 0/1 其余结论维持）

---

## 1. 任务模型：目标与非目标

### 目标

1. **缺口 1（公开完成式排空）**：为 `PersistenceLifecycle` / 两个 adapter 提供公开 `drain()`——把归档路径私有排空（`settleEntryForArchive`，lifecycle.ts:690-709）一般化为宿主可调用的完成式入口：对所有 live 脏 entry（含有 handle 与零 handle）跳过 debounce 立即 flush 并 await 全部 settle；不 abort、不 destroy、不清调度面；drain 返回后 `dispose()` 可安全立即执行；可选参数只排空指定 `(owner, docId)` 集合。
2. **缺口 2（retry 基准解耦）**：`PersistenceSchedule` 新增可选配置键 `retryDelayMs`；显式配置时重试首基准 = `retryDelayMs`（与 `debounceMs` 正交），退避增长 ×2、cap = `maxDirtyMs` 不变；未配置时缺省基准 = 解析后的 `debounceMs`（动态，非固定默认值）。
3. **缺口 3（宿主停机组合，SA2-1 / Owner 硬契约 / SA2-7）**：`apps/yjs-server` 停机链第 3 步的固定睡眠窗替换为**有预算的完成式排空**——`Promise.race([adapter.drain(), sleep(budget)])`，预算 = `maxDirtyMs + 边距`（由 `MAX_MAX_DIRTY_MS` 立法保证 < 60s watchdog）；预算尽 → 发 `persistence-drain-budget-exceeded` 诚实事件后**继续**走 3b 步有损 dispose。**该步对 file 与 memory 两种配置统一执行，无 kind 特判（SA2-7 路径 (b)，iteration 2）**——memory 配置无 schedule 键，预算取缺省推导（`DEFAULT_MAX_DIRTY_MS + 边距`）。停机硬契约成立：dispose 之前必然先 await drain（完成，或预算耗尽且该事实可观察），**对两种 adapter 配置同构成立**；degraded store 下停机/换装链在预算内收口，永不被 60s watchdog 击穿。

### 非目标

- **不改变 `dispose()` 语义**（ADR 0006 §228-5 冻结：abort + clearTimers + doc.destroy + cells.clear + allSettled(inFlight)；有损/abortive 语义保持——SA6 §3-4、C11/0a/0b 基线绿锚定；**Owner 评论 5751613018 明文再确认**）。硬契约由**组合层**兑现（宿主先 await drain 再 dispose），**不是**把 drain 吸收进 dispose（该备选的否决论证见 DD-7）。
- **drain API 本体无时间预算/超时参数**（ADR 0006:34「不设外部 flush/cron 协调器」保持）：预算是宿主策略（app 层组合），不进 persistence 公共 API——分层公开 drain 方式保持（Owner 评论 5751613018：dispose 保持 abortive 时保留分层公开 drain）。
- 不修改 `packages/namespace-registry` 停机链路（issue 未要求；registry shutdown 释放 lease 后由宿主 drain 兜底）。
- 不在 `apps/yjs-server` 配置面暴露 `retryDelayMs`，也**不新增停机预算配置键**（预算 = `maxDirtyMs + 边距` 推导，模块常量边距——镜像 `REST_DRAIN_BUDGET_MS` 的「零新增配置键」纪律，issue #270 §7-D4 步 4 先例；memory 配置无 schedule 键 → 预算 = `DEFAULT_MAX_DIRTY_MS + 边距` 缺省推导，同样零新增键）。
- 不改 DSH 探针记录头格式（`record.ts:20`，见 DD-6）。
- 不承诺掉电级持久性（ADR 0006:55「rename 成功即完成一次 flush」无 fsync 纪律不变）。

---

## 2. 当前行为与证据锚点（源码事实）

| # | 事实 | 锚点 |
| --- | --- | --- |
| B1 | 公开面无完成式排空入口：`DocPersistence`（contract.ts:80-139）成员为 createDoc/loadDoc/saveDoc/importDoc?/archiveDoc?/readPersistedReplicationIdentity?/deleteDoc?；两 adapter 类面（memory.ts:74、file.ts:59）与 `PersistenceLifecycle` 均无 drain | contract.ts:80-139；SA6 §8 直接故障点 2 |
| B2 | 唯一排空通知面 `archiveWaiters`（LiveEntry 私有数组）仅两处消费：`settleEntryForArchive`（:690-709）与 `settleEntryForDelete`（:655-677）；通知点仅两处：flush finally 首位无条件 splice+call（:1100-1101，通知点 1）、dispose 同步段（:818-819，通知点 2） | lifecycle.ts:96-98、:655-677、:690-709、:1100-1101、:818-819 |
| B3 | `settleEntryForArchive` 私有先例：零-handle 脏 entry 强制即时 `startFlush`（:703，跳过 debounce）；`retryTimer` 武装（degraded 回退窗）时被动等待、不热循环（:696-704）；干净零-handle 当场驱逐（:697-701）；`handles.size > 0 → DocArchiveActiveHandleError`（:695）——**不能直接复用为停机排空**（live handle 场景即拒） | lifecycle.ts:690-709；SA6 §11-2 排除项 |
| B4 | `dispose()` 同步段：`closed=true`、`epoch+=1`、`abortController.abort()`（:808）→ 逐 live cell `clearTimers` + 通知 waiters + `handles.clear()` + `doc.destroy()`（:809-823）→ `cells.clear()`（:824）→ `await Promise.allSettled(inFlight)`（:825）——只覆盖**已 track 的在途操作**，不覆盖未点火定时器/回退窗内/未 startFlush 的待落盘脏状态 | lifecycle.ts:801-826；SA6 §8 直接故障点 1 |
| B5 | retry 基准耦合两落点：`createEntry` 初始化 `retryDelayMs: this.schedule.debounceMs \|\| 1`（:1030）；flush 成功回落同式（:1088）。`scheduleRetry`（:1116-1124）首重试 delay = `entry.retryDelayMs`（未 cap），其后 `retryDelayMs = min(max(delay*2,1), maxDirtyMs)`——**退避只 cap 间隔，不 cap 次数**：持续失败 store 下 flush 尝试无上界（ADR 0006:34「重试直到成功或插件停止」） | lifecycle.ts:1030、:1088、:1116-1124；SA2-1 证据 |
| B6 | 调度面：`scheduleFlush`（:1047-1060）武装 maxDirty + 重置 debounce；degraded 窗内 retry 退避是唯一调度源（:1056 早退，ADR 0006:195）；key 内 single-flight（`startFlush` :1074-1077 与 `flush` :1080 双门）；`flush` 捕获 generation、成功标记 saved、失败置 degraded + `scheduleRetry`（:1079-1114）；`maybeEvict`（:1126-1132）脏 entry 不驱逐 | lifecycle.ts:1047-1132 |
| B7 | `PersistenceSchedule = { debounceMs, maxDirtyMs }`（contract.ts:473-476）；`DEFAULT_PERSISTENCE_SCHEDULE` 冻结 500/5000（:478-481）；`resolvePersistenceSchedule`（:494-509）逐键做 finite/non-negative 校验后 `Object.freeze` | contract.ts:473-509 |
| B8 | 既有 optional 成员 + 派生 required 面先例：importDoc/archiveDoc/probe/deleteDoc 均为 `DocPersistence` optional（readonly 属性签名）+ `ReplicaPersistence` required（contract.ts:93-139、:142-158）；三成员字面量绿守卫（persistence-phase5-archive-surface.test-d.ts:100-108；SA6 契约 surface 测试同款 `legacyThreeMemberAdapter`） | contract.ts:74-79、:142-158 |
| B9 | 仓库内消费方同构实例：`apps/yjs-server/src/app.ts:565-573`——file adapter 停机前 `sleep(maxDirtyMs ?? 5000 + 500)`；注释明示「dispose() 只 abort+destroy，不冲刷 dirty」；boot 期 `ctx.plugin(createFilePersistencePlugin(...))` 只保留 fiber（:287-299），未保留 plugin 句柄（`.instance` 不可达） | app.ts:84-87、:177、:287-299、:565-577 |
| B10 | app 配置面 schedule 为两键闭集（config.ts:60 字面量类型 + :248-252 未知键拒绝）；`MAX_MAX_DIRTY_MS=30_000` 上界立法理由 = 停机排空时延必须短于 60s 停机 watchdog（config.ts:13-15、:27-34；拒绝文案 :270）。**无测试钉死拒绝文案全文**：`app-config-red.test.ts:299` 只断言 `toContain('persistence.schedule.maxDirtyMs')`、`lifecycle-watchdog-red.test.ts:122` 只断言 `toContain('config violation persistence.schedule.maxDirtyMs')` | apps/yjs-server/src/config.ts；两测试文件 |
| B11 | DSH 探针镜像内核退避：`probe.ts:444-445 let delay = schedule.debounceMs \|\| 1`，:464 `delay = min(delay*2, maxDirtyMs)`；probe :73 经 `resolvePersistenceSchedule` 解析；记录头冻结两键渲染（record.ts:20）；`dsh-file-probe-determinism.test.ts:36-42` 钉死含 `t=` 的事件行 | dsh-persistence probe.ts/record.ts |
| B12 | 既有冻结审计（设计必须显式裁决，非本任务断言）：`persistence-contract.test.ts:32-37`（DEFAULT `toEqual` 两键精确 + 解析结果 `toEqual` 两键精确）、`file-persistence.test.ts:50` / `file-persistence-sa7-dynamic.test.ts:36`（`TEST_SCHEDULE` 两键字面量） | SA6 §3-5 |
| B13 | 两个 adapter 均为 `PersistenceLifecycle` 委派壳（memory.ts:144-186、file.ts:88-152；ADR 0006:157-159「不得复制状态机」）；Memory.dispose 在 core.dispose 后清 mirror（memory.ts:206-213） | memory.ts、file.ts |
| B14 | File adapter 每个公开入口先 `validateIdentity`（SAFE_PATH_SEGMENT 双段，file.ts:217-220）；`createFilePersistencePlugin` 返回 `{apply, get instance()}`（file.ts:262-274；memory 同款 memory.ts:235 附近；`dsh-persistence/src/profile.ts:65/79` 已有 `plugin.instance` 消费先例） | file.ts:217-220、:262-274 |
| B15 | **同链路有界排空先例（SA2-1 指认的纪律源）**：REST 工作排空 = `restHost.drain(REST_DRAIN_BUDGET_MS)`（app.ts:552；模块常量 10_000，注释明示「上界 < main.ts 停机 watchdog（60s）；无 in-flight 时即时返回」，app.ts:92-96）；实现 = tagged-outcome `Promise.race`（`'settled' \| 'timeout'`）+ timer 早清 + 预算尽则 abort 后**继续**（rest-hosting.ts:13-15、:37、:151-171） | app.ts:92-96/:552；rest-hosting.ts:151-171 |
| B16 | **watchdog 与换装链**：`STOP_WATCHDOG_MS = 60_000`（main.ts:30）；SIGTERM/SIGINT 停机经 `runWithShutdownWatchdog`（超时 → stderr + `exit(1)`，main.ts:71-80、shutdown-watchdog.ts:8-23）；SIGHUP 换装「停旧」半程受同一 watchdog 覆盖，注释明文「file 排空窗，上界由 config.ts `MAX_MAX_DIRTY_MS` 保证 < watchdog」（main.ts:96-99；watchdog 到点 → `reload-failed{reason:'watchdog-timeout'}` + `process.exit(1)`，main.ts:100-104）。watchdog 强杀后果：跳过 persistence dispose/timer/clock 拆卸、NDJSON 序列断裂、root lock 残留（lifecycle.ts:72 不洁停机提示需人工清除） | main.ts:30/:67-87/:89-105；shutdown-watchdog.ts |
| B17 | **事件面规范**：stdout NDJSON 生命周期事件词表记录于 `docs/integration/hub-peer-deployment.md:36-41`；四事件序 `replication-drained → registry-stopped → persistence-disposed → app-stopped` 由 `ordered-shutdown-red.test.ts:77-91` 以逐事件 `findIndex` + 严格递增断言冻结——**词表新增事件（如既有 `fatal-shutdown`/`diagnostics-closed`）不破坏该断言**；`issue270-regression-anchors.test.ts:120-128`、`on-fatal-error-issue288.test.ts:360-364` 同款 findIndex 模式 | hub-peer-deployment.md:36-41/:278；ordered-shutdown-red.test.ts:77-91 |
| B18 | `docs/integration/cordis-plugin-hosting.md` 是宿主（含仓库外 nomic-server）拆卸契约的规范文档：:64「停机时先停止并排空业务消费者、释放 lease，再排空 replication，最后关闭 Registry、释放 Persistence」；:450-466 停机清单第 5 步「释放 Persistence Fiber…再 dispose adapter」——当前无 drain-before-dispose 表述，示例代码块为 `await persistenceFiber.dispose()`（无 drain） | cordis-plugin-hosting.md:64/:450-466 |
| B19 | **memory 配置无 schedule 键（iteration 2 / SA2-7 事实面）**：`PersistenceConfig` memory 变体 = `Readonly<{ kind: 'memory' }>`（config.ts:58-60，TS 层无 `.schedule` 可达）；boot 以零 options 构造 memory plugin（app.ts:297 `createMemoryPersistencePlugin()`）→ 内部 schedule = `DEFAULT_PERSISTENCE_SCHEDULE`（500/5000）= app.ts `DEFAULT_MAX_DIRTY_MS = 5_000`（:85）的镜像源；`createMemoryPersistencePlugin` 返回与 file 同款 `{apply, get instance()}` 公共句柄（memory.ts:225-237）——B14 `.instance` 公共面对两 adapter 均成立；`MemoryPersistence`/`FilePersistence` 均自 `@nomicore/persistence` barrel 公开导出（index.ts:48-56）→ 类原型面对测试可达 | config.ts:58-60；app.ts:85/:297；memory.ts:225-237；index.ts:48-56 |
| B20 | **memory adapter 的耐久面由 hook 决定，不是类名（SA2-7 裁决依据）**：`writeSnapshot`/`readSnapshot` hook 接线时外部 store 是唯一读权威、flush 写经 hook 进入该 store（memory.ts:38、:93-97）——接线 hook 的 memory 实例与 file 实例具有同质的「已 ACK 写需要 drain 兑现进 store」保护对象；yjs-server 内置配置不接线 hook ⟹ io.write = abort 门 + mirror set，无外部 I/O 失败面（abort 信号在 drain 期间未点火——只在 dispose 点火）；dispose 在 core.dispose 后清 mirror + 归档分区（memory.ts:206-213）——no-hook 配置无跨实例耐久事实 | memory.ts:38、:93-97、:206-213 |

---

## 3. 根因 / 能力缺口（承接 SA6 §8，不重复复现）

| 层级 | 结论 | 证据 |
| --- | --- | --- |
| 能力缺口 1 | 生命周期把「pending dirty 的完成」表达为**内部定时器状态**而非**可 await 的完成事件**；归档路径曾以 `settleEntryForArchive` 局部兑现但未升格为公开能力，且带 `handles.size>0` 拒绝而不能复用于停机 | SA6 §8 最深根因；B3 |
| 能力缺口 2 | retry 首基准硬绑 `debounceMs`（初始化 + 成功回落两落点），无独立配置键；cap（maxDirtyMs）只作用于第二次起的增长，**首次**重试取未 cap 的 debounceMs | B5；SA6 §11-4；2a 实测首重试 = 60s |
| 能力缺口 3（宿主组合，SA2-1） | 仓库内宿主对「停机前落盘」只有两种错误形状：固定睡眠（时间量近似事件量，可被慢盘/并发在途击穿）或——iteration 0 设计引入的——无预算 `await drain()`（degraded store 下无上界等待 → 60s watchdog 强杀 `exit(1)`：跳过剩余拆卸、NDJSON 序列断裂、root lock 残留）。正确形状 = **有界预算的完成式等待 + 预算尽的诚实降级**，同链路 REST 排空已是该纪律的既有先例 | SA2-1；B5（退避无次数 cap）、B15（REST 先例）、B16（watchdog 后果） |
| 触发面 | 宿主以**时间量**（固定睡眠）近似**事件量**（完成）；慢盘/跨 key 并发在途 flush（0b 三 key 构造）与 schedule 调长（0a 5.5s < 60s 零落盘）两类条件均可击穿；degraded store + 无预算等待则击穿 watchdog 不变量 | SA6 §5 0a/0b；B9；SA2-1 |

---

## 4. Owner 要求落实

### 4.1 Owner 评论映射（本轮适用：comment 5751613018）

| Comment ID | Updated at | Requirement | Design section |
| --- | --- | --- | --- |
| 5751613018（MEMBER） | 2026-09-20T18:03:36Z | graceful shutdown 必须有**硬契约**：dispose 之前 await drain | §1 目标 3、§7 DD-7（app 停机链第 3 步 = 有界完成式排空，**file 与 memory 两 kind 统一执行（SA2-7 路径 (b)）**；唯一退出 = 完成或预算耗尽且事件可观察，dispose 绝不在 drain 在途且无预算耗尽事实时被调用）、§7 DD-8（ADR 0006 修订节硬契约条款——对全部宿主立法，不以 adapter 类型特判）、§12 S-5a/S-5b/S-5c（可执行验收） |
| 5751613018（MEMBER） | 2026-09-20T18:03:36Z | ADR-0006 dispose 语义/契约必须对齐 | §7 DD-8：修订节显式申明 dispose 保持 abortive/有损（**修订并扩展** :86 的 dispose 定义边界——SA2-10 措辞；§228-5 对齐重述）——dispose 从来不是持久性屏障；「dispose 前的持久性」唯一经分层 drain 表达 |
| 5751613018（MEMBER） | 2026-09-20T18:03:36Z | dispose 保持 abortive 时**保留分层公开 drain 方式** | §1 非目标（dispose 冻结 + drain API 无预算参数）、§7 DD-1（drain = `DocPersistence` optional 分层公开能力，不并入 dispose；否决「dispose 内部先 drain」备选的论证见 DD-7） |
| 5751613018（MEMBER） | 2026-09-20T18:03:36Z | 第三个击穿窗口：degraded entry 的 retry 回退窗（`scheduleRetry` :1116，backoff 上限 `maxDirtyMs`）——drain 遇回退窗只能被动等待 | §3 触发面（degraded store 分支）、§7 DD-5（回退窗被动等待、零热循环）、§7 DD-7 备选 (iv)（`debounceMs > 预算` 的诚实记录）、§13 风险行 1/2（SA2-11 traceability 补行） |

### 4.2 Issue 正文 request 面映射

| Issue 正文措辞 | 设计章节 | 落实方式 |
| --- | --- | --- |
| 「把所有脏 entry 落完盘再退」 | §7 DD-5、§8 | drain = 完成式排空：resolve ⟺ 静息观察点范围内 live 脏状态全部提交且无在途 flush |
| 「对所有 live 脏 entry（含零 handle）立即 startFlush（跳过 debounce）」 | §8 状态机 | pass 式扫描：idle-dirty 且非回退窗 → `startFlush`（不经 debounce/maxDirty 定时器）；有 handle 不拒绝（与 B3 私有先例的关键差异） |
| 「await 全部 settle（复用 archiveWaiters 通知面或等价机制）」 | §8 | 复用 `archiveWaiters` 通知面（通知点 1/2 + 本设计补全的驱逐通知点，DD-5b） |
| 「不 abort、不 destroy、不清定时器之外的任何状态」 | §8、§9 | drain 不触碰 abortController/epoch/doc 生命周期/调度定时器/驱逐面（读 C4/C5 断言面） |
| 「drain 返回后 dispose() 可以安全立即执行」 | §9 | drain resolve 后无 pending 脏状态 → dispose 有损窗口内无已 ACK 待落盘内容（C6/1d） |
| 「可选参数：只 drain 指定 key 集合」 | §7 DD-4 | `targets?: readonly PersistenceDrainTarget[]`（公开词汇 (owner, docId)）；`targets: []` = no-op（空目标集 = 无可排空对象，立即 resolve） |
| 「独立的 retryDelayMs 配置，缺省保持现行为」 | §7 DD-2/DD-3 | 可选键 + 缺省动态回退 debounceMs（C8/C9/C10） |
| 「宿主侧把固定睡眠替换为 await persistence.drain()」 | §7 DD-7 | yjs-server 停机链第 3 步替换为**有预算** `await adapter.drain()`（**file 与 memory 两 kind 统一**——SA2-7 路径 (b)；issue 的「替换为 drain」诉求 + 仓库既有「排空时延上界 < watchdog」不变量 + Owner 硬契约对全部 adapter 配置同构成立，共同成立） |

---

## 5. 复现和根因承接（上游事实 → 设计响应）

| 上游事实（SA6 契约） | 证据位置 | 设计响应 |
| --- | --- | --- |
| 0a/0b：固定睡眠 + dispose 丢已 ACK 写（单 key 调长 schedule / 三 key 并发在途；双 adapter 稳定复现，连续 5 次一致） | sa6_contract §5、§7 | 保持性绿灯（dispose 语义不变）；目标态由 drain 用例（1a/1d/1g）给出完成式对照 |
| 14 个运行期 TypeError 红 + 2a/2c 行为红 + 3 类型锚红，红因逐条归因于目标断言（非环境/超时/入口） | sa6_contract §13 | 设计的公开面/配置面/类型面（§7 DD-1~DD-4）与红锚一一对应；实现后 27+5 全绿 |
| 参考实现实验：临时 4 文件最小实现 → 212 tests 全绿 + tsc 零错误，随后全量恢复 | sa6_contract §9.4、§16 | 本设计的关键结构（optional 键 + 条件展开 + `(retryDelayMs ?? debounceMs) \|\| 1` + live-cells 环 + waiter 复用）与该实验同构，降低实现不可达风险 |
| `apps/yjs-server/src/app.ts:566-571` 与 nomic-server 固定 5500ms 同构 | sa6_contract §3-6 | DD-7 纳入本改动集（file 与 memory 两 kind 统一替换为**有预算** drain——memory 今日无睡眠窗，iteration 2 起统一进入同一等待步） |
| 既有冻结审计四组（B12）需设计显式裁决 | sa6_contract §15 D-2/D-3 | DD-2 裁决为「解析键形状不变」路径：四组审计**零改动零迁移** |
| 未证实假设：生产 io.write ≈ 2.2s（消费方单点） | sa6_contract §8 | 仅背景，设计不依赖；窗口击穿以「在途未结算」确定性构造表达 |
| D-5 六个未锚定交错（drain×dispose/archive/delete/creating/reading/并发重入） | sa6_contract §15 | §8/§9 给出显式语义；缺口项列入补充验收（§12 S-1~S-4） |
| SA2 §7 对 DD-5 骨架的 11 态攻击：SM-1/2/3/5/7/8/9/10 无缺口；SM-4（驱逐 liveness）由 DD-5b 修复且枚举完备；SM-6 需措辞精确化（→ SA2-2）；SM-11 需宿主组合预算（→ SA2-1/DD-7） | sa2_review §7 | DD-5 返回语义改写为静息观察点结算 + 并发写者边界（SA2-2）；DD-7 以预算组合收口 SM-11 的宿主侧映像 |

## 6. SA8 约束落实（SA8 设计后冲突复查 verdict **clear**：12 no-conflict + 3 implements-existing-decision + 2 evolution-required + 0 hard-conflict）

| 决议或义务（SA8 报告条款） | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
| --- | --- | --- | --- |
| D1（evolution-required）：ADR 0006:34「不设外部 flush/cron 协调器；retry 内部退避直到成功或插件停止」——公开完成式排空超出 :34 明文许可面，走 ADR 0006 增量修订节 | §7 DD-5、§8、DD-8 | drain 是宿主发起的**一次性**完成式排空（每脏 entry 恰一次强制 flush + 完成等待 + 回退窗被动等待），非周期协调器；DD-8 修订节与实现同变更集落地（含与 :34 关系申明）。SA8 另引 :37「release 归零后可触发/等待 flush」/ :213「archiveDoc 先排空」为 ADR 内在先例 | 是（公共 API 新入口语义） |
| D2（no-conflict）：ADR 0006:195「降级等待期内 retry 退避即唯一 flush 调度源」 | §8 回退窗被动等待分支 | drain 遇 `retryTimer` 武装只注册 waiter，零热循环（1f 锚：attempts 恒 1） | 否 |
| D3（no-conflict）：§228-5「dispose() 语义不变」+ :86 dispose 条款 | §1 非目标、§9、DD-7/DD-8 | dispose 路径零改动；DD-5b 不触 dispose 段；drain-after-dispose vacuous 为新入口语义不改 dispose 行为。**本轮强化（Owner 评论）**：DD-8 修订节把 :86/:240 与硬契约对齐重述 | 否（保持；对齐文本入 DD-8） |
| D4（no-conflict）：ADR 0006:157-159 lifecycle core 共享 | §7 DD-1 | drain 状态机单点落 `PersistenceLifecycle`；两 adapter 纯委派（C14） | 否 |
| D5（no-conflict）：:52/:55 提交语义/无 fsync | §8 L1 | drain 复用既有 `io.write`，零 I/O 路径改动 | 否 |
| D6（implements）：:221-232 optional/派生面放置先例 | §7 DD-1 | `drain` = `DocPersistence` optional 成员（C13 三成员字面量/13 stub 零红） | 是（契约面新成员） |
| D7（no-conflict）：drain 不进 `ReplicaPersistence` | §7 DD-1 | 保持（语义家族 = 复制生命周期 vs 宿主停机能力） | 否 |
| D8（evolution-required）：`PersistenceSchedule` 新键 = 已接受 schedule 契约形状扩展 | §7 DD-2/DD-3、DD-8 | DD-2「键形状不变」路径（B12 四组审计零迁移）；修订节收录新键与解析形状裁决 | 是（配置语义 + ADR 修订） |
| D9（no-conflict）：dsh AGENTS「保留机器可读事件/记录形状」 | §7 DD-6 | 记录头有意冻结；默认探针时间线逐字节不变 | 否 |
| D10（no-conflict）：apps AGENTS「单一拆卸链…persistence dispose…不得触发第二条并发拆卸链」+ hub-peer-deployment:278 事件序 | §7 DD-7 | drain（含预算 race）位于同一拆卸链内（**file：原睡眠位**——diagnostics-closed 之后、persistence fiber dispose 之前；**memory：同位置新增等待步**——今日无睡眠窗，iteration 2 统一进入），是**等待**不是拆卸，不构成第二条 teardown 链；预算尽发事件后继续同一链 dispose；四事件序零变化（B17） | 否 |
| D11（no-conflict）：ADR 0012 插件所有权 / `.instance` 是仓库自有公共面 | §7 DD-7 | **两 kind 均保留 plugin 句柄**（`createFilePersistencePlugin` / `createMemoryPersistencePlugin` 返回同款 `{apply, get instance()}` 自有公共句柄，file.ts:262-274、memory.ts:225-237；profile.ts:65/79 消费先例；B14/B19），经 `get instance()` 取 adapter；不假设 cordis 动态 pluginId | 否 |
| D12（no-conflict）：ADR 0009 registry shutdown 语义 | §11 DENY | `namespace-registry/**` 零触碰 | 否 |
| D13（no-conflict）：ADR 0010 + instance-replication-v1.md wire 契约（:685 宿主 watchdog 纪律；:246 close barrier 永不 reject 先例） | §11 DENY、§7 DD-7 | wire 零变化。**本轮修订强化其论证**：库级 drain 无预算语义与 ADR 0010「库级无条件排空 + 宿主侧有界退出」模式同族；DD-7 把有界退出从「依赖 watchdog」升级为「app 自有预算 + 诚实事件」——watchdog 退居最后兜底而非常规边界 | 否 |
| D14（implements）：docs/AGENTS 行为变更同步规范文档 | §7 DD-8 | ADR 0006 修订节 + CONTEXT.md 词条（本轮追加：hub-peer-deployment.md 事件词表/停机序段 + cordis-plugin-hosting.md 宿主拆卸硬契约行——app 事件面与宿主契约变化后的规范同步义务） | 是（ADR 修订） |
| D15（implements）：:213 归档排空承诺的 liveness 完备化 | §7 DD-5b | 「任何移除 live entry 的路径必须释放其 settle waiters」不变量；修订节收录该句（SA8 required action 3） | 否 |
| D16/D17（no-conflict）：状态词冻结 / ADR 0023 服务构造纪律 | §8、DD-1 | drain 零新状态；class 原型方法合规 | 否 |
| SA8 required action 1：DD-8 修订必须与代码同变更集 | §11 ALLOW（docs 与代码同集） | 已固化 | — |
| SA8 required action 2：实现红线——不得物化缺省 `retryDelayMs` 进 resolved schedule | §7 DD-2 | 设计裁决保持（击穿 B12 冻结审计与 DSH 记录头） | — |
| SA8 required action 4：config.ts 注释保持诚实——「上界约束正常路径最坏等待；持续失败 store 下 drain 本体无预算」 | §7 DD-7（config.ts 注释刷新措辞） | **本轮以预算路径超越该表述**：app 侧预算成为 degraded store 下的**主动总界**（预算尽 → 诚实事件 + 有损继续），watchdog 退居最后兜底；注释措辞按此书写且不得声称「drain 恒有界」（库级语义仍无界，见 §9） | — |
| SA8 required action 5：实现后 implementation 复查 | §15 | `requiresConflictRecheck: true` 维持 | 是 |

---

## 7. 设计决策与主要备选方案

### DD-1（SA6 D-1）：drain 放置面 —— `DocPersistence` optional 成员 + 两 adapter 类面具体方法 + 独立导出目标类型

**裁决**：

```ts
// contract.ts（新增类型 + optional 成员；doc-comment 详述语义）
export interface PersistenceDrainTarget {
  readonly owner: User
  readonly docId: string
}

export interface DocPersistence {
  // …既有成员不变…
  /** issue #412：完成式排空（语义见 §8）——optional 成员（§4.4 先例）。 */
  readonly drain?: (targets?: readonly PersistenceDrainTarget[]) => Promise<void>
}
```

- `PersistenceLifecycle` 落公共方法 `async drain(targets?): Promise<void>`（状态机单点）；`MemoryPersistence.drain` / `FilePersistence.drain` 为**具体类方法**（满足 SA6 类型锚 `HasDrain<MemoryPersistence/FilePersistence>`），纯委派 `this.core.drain(targets)`；File 侧入口先对每个 target `validateIdentity`（B14 先例——unsafe target 永不可能对应 live cell，校验纯为 loud 防御，合法 target 零行为差异；`targets === undefined` 时无校验路径）。
- barrel `index.ts` 增 `type PersistenceDrainTarget` 导出（`PersistenceIO` 之外 lifecycle/契约面导出先例同款）。
- **不**把 `drain` 加进 `ReplicaPersistence`：该派生面的语义家族是「复制生命周期能力」（import/archive/probe/delete，ADR 0006 §133/§228 修订节），drain 是宿主停机/排空能力，消费方持具体 adapter 类型或经 `typeof` 窄化（INV-13 纪律）。
- **分层保持（Owner 评论 5751613018）**：drain 是 dispose 之上的独立分层公开能力，二者不合并——见 DD-7 对「dispose 内部先 drain」备选的否决。
- 放弃的备选：(a) 仅 adapter 类面、不进 `DocPersistence`——第三方 adapter 无能力词汇、消费方无法以契约面窄化；(b) required 成员——击穿三成员字面量/13 个 stub 绿守卫（C13 红锚即为此预置）。

### DD-2（SA6 D-2）：`retryDelayMs` 解析形状 —— 键形状不变（缺省回退在 lifecycle 内）

**裁决**（SA6 参考实现同款「零遗留」路径）：

```ts
// contract.ts
export interface PersistenceSchedule {
  readonly debounceMs: number
  readonly maxDirtyMs: number
  /** issue #412：重试首基准（可选）；缺省 = debounceMs（动态回退，非固定默认值）。 */
  readonly retryDelayMs?: number
}

// resolvePersistenceSchedule：仅显式配置时携带该键（条件展开）——
// 既有逐键 finite/non-negative 校验环（:502-506）经 Object.entries 自动覆盖新键。
const schedule: PersistenceSchedule = {
  debounceMs: config.debounceMs ?? DEFAULT_PERSISTENCE_SCHEDULE.debounceMs,
  maxDirtyMs: config.maxDirtyMs ?? DEFAULT_PERSISTENCE_SCHEDULE.maxDirtyMs,
  ...(config.retryDelayMs !== undefined ? { retryDelayMs: config.retryDelayMs } : {}),
}
```

```ts
// lifecycle.ts：retry 基准单源（两落点共用）
private get retryBaseMs(): number {
  return (this.schedule.retryDelayMs ?? this.schedule.debounceMs) || 1
}
// createEntry（:1030）与 flush 成功回落（:1088）改为 retryDelayMs: this.retryBaseMs
```

- **理由**：备选（A）「解析面物化缺省值」会命中 `persistence-contract.test.ts:34-37` 的 `toEqual` 精确键断言（需立法改既有审计）与 DSH 记录头键面，零行为收益；备选（B）保持未配置时 resolved 键形状不变 → B12 四组冻结审计**零改动零迁移**，probe/golden 默认时间线逐字节不变。SA8 required action 2 已将此固化为实现红线。
- `|| 1` 下限纪律：显式 `retryDelayMs: 0` 与 `debounceMs: 0` 同款折叠为 1（防 0ms 热重试；`scheduleRetry` 的 `Math.max(delay*2,1)` 增长下限既有纪律一致）。C10 缺省 = **动态** debounceMs（非硬编码默认）由 getter 表达式保证。
- 行为验证对照（SA6 时序表）：`{debounceMs:60_000, retryDelayMs:200}` → 首重试 t=60_200（基线 120_000）；`{debounceMs:50, maxDirtyMs:350, retryDelayMs:100}` → 尝试序列 50/150/350/700（cap=maxDirtyMs 不变）；`{debounceMs:40}` 无 retryDelayMs → 首重试 +40（2b 保持绿）。

### DD-3（SA6 D-3）：类型建模 —— optional

`retryDelayMs?: number` 可选键。`file-persistence.test.ts:50`、`file-persistence-sa7-dynamic.test.ts:36` 两处两键 `TEST_SCHEDULE` 字面量零迁移；`Partial<PersistenceSchedule>`、两 adapter options、DSH profile options 自动获得该键。放弃 required（无收益、纯迁移面）。

### DD-4（SA6 D-4）：目标集合形状冻结

`targets?: readonly PersistenceDrainTarget[]`，`PersistenceDrainTarget = { owner: User; docId: string }`（公开 key 词汇；内部 `toKey` 的 `${userId}\u0000${docId}` 复合串保持私有，lifecycle.ts:1219）。与 SA6 两份契约文件的临时声明形状**逐字段一致 → 契约测试零改动**（SA2-6：连「临时形状」注释也不更新，验收证据零触碰，见 §11）。语义：目标映射为 key 集合；无对应 live cell 的 target 为 no-op（该 key 无脏状态可排空——缺席即完成）；**`targets: []` = no-op**（空目标集合 = 无可排空对象，立即 resolve，零 write）；未提供 targets → 排空全部 live cells。

### DD-5（SA6 D-5）：drain 语义与状态机

**方法契约**（写入 contract.ts doc-comment 与 ADR 修订节；措辞按 SA2-2 精确化）：

- **范围**：`targets` 给定 → 仅这些 key；否则全部。仅 **live cells** 参与；`reading`（无脏状态）/`creating`（初始 snapshot 经自身 tracked op 已有完成语义，结果归其调用方）/`archiving`/`deleting`（自持 claim 排他 settle）不在 drain 范围。
- **每 entry 语义**（单 key 内与 `settleEntryForArchive` 同构、去掉归档前置/驱逐腿）：
  - `retryTimer` 武装（degraded 回退窗）→ **被动等待**（注册 waiter），不强制即时重试、不热循环（ADR 0006:195；C12/1f）；
  - `flushing` → 等待其结算（single-flight 既有双门保证零重复发起；C2/1b/1g）；
  - idle 且脏（含 handle>0 与零 handle）→ **立即 `startFlush`**（跳过 debounce/maxDirty 定时器；C1/1a/1d）；
  - 干净 → 跳过（不驱逐、不清定时器、零 write；C3/1c）。
- **返回语义（静息观察点结算，SA2-2）**：resolve ⟺ **最后一轮扫描观察时**（静息观察点）范围内无「脏且可推进」「在途」「回退窗等待」的 live entry。**并发写者边界**：终扫观察之后 ACK 的 `saveDoc` 不属本 drain 调用的覆盖范围（本设计不承诺「drain 不早退于新 ACK 的脏状态」的过强表述）；停机场景下该边界由链路前置条件关闭——lease 已全部释放（registry.shutdown 先行）、接纳已停，无并发写者。
- **失败面**：**store 失败面永不 reject**（flush 失败被既有 degraded + 内部退避吸收，drain 不引入新 typed 错误）。例外申明（SA2-3）：File 侧 target 输入校验沿既有 `validateIdentity` bare Error loud 拒绝（S-4，契约违约通道非 store 失败面）；`targets: []` 为 no-op。
- **无时间预算（库级语义）**：持续失败的 store 下 drain 不 resolve（完成式语义的诚实代价；ADR 0006:34「重试直到成功或插件停止」——**宿主侧的「插件停止」映像 = 宿主预算**，见 DD-7）。库级 drain 不提供超时参数（§1 非目标；ADR 0006:34 边界）。
- **非破坏性**：不 abort、不 destroy、不清定时器、不驱逐、不改 epoch/closed、不改 getStatus 词表。drain 后 armed 的陈旧 debounce/maxDirty 定时器到点 → `startFlush` → `flush` 以 generation/干净守卫早退（零 write，既有语义）；后续 `saveDoc` 的 `scheduleFlush` 重武装时自然覆盖（:1058）。
- **dispose 交错**：dispose 同步段通知 waiters（通知点 2）→ drain 续体重扫见 cells 已清 → 立即 resolve（**vacuous 完成**：dispose 后无 live 脏状态可排空；丢失已在 dispose 的冻结有损语义内发生，drain 不二次报告）。drain-after-dispose 调用同款立即 resolve（与 dispose 幂等第二调用 await-allSettled-返回同族语义）。该 vacuous 收口同时是 DD-7 预算路径下「败者 drain 续体」的清零机制（见 DD-7）。
- **并发重入**：多个并发 drain 各自独立成环，均以**自己的静息观察点**结算；等待期内的再脏由重扫捕获并强制 flush（在途屏障内不早退）；终扫之后的新写者按上述边界处理。

**实现骨架**（lifecycle.ts；扫描段同步完成 waiter 注册，await 置于扫描后——错过通知窗为零；SA2 §7 攻击核验通过）：

```ts
async drain(targets?: readonly PersistenceDrainTarget[]): Promise<void> {
  const scope = targets === undefined ? undefined
    : new Set(targets.map((t) => toKey(t.owner, t.docId)))
  for (;;) {
    if (this.closed) return                                   // vacuous（dispose 后/中）
    const pending: Array<Promise<void>> = []
    for (const [key, cell] of this.cells) {
      if (scope !== undefined && !scope.has(key)) continue
      if (cell.state !== 'live') continue                     // 非 live cell 不在范围
      const entry = cell.entry
      if (entry.retryTimer !== undefined || entry.flushing) {
        pending.push(new Promise<void>((r) => { entry.archiveWaiters.push(r) }))  // 被动等待
        continue
      }
      if (entry.savedGeneration === entry.dirtyGeneration) continue             // 干净：跳过
      this.startFlush(entry)                                   // ★ 强制即时 flush（跳过 debounce）
      pending.push(new Promise<void>((r) => { entry.archiveWaiters.push(r) }))
    }
    if (pending.length === 0) return                           // 静息：本轮无待结算
    await Promise.all(pending)                                 // 屏障后重扫（重脏/换 cell 均吸收）
  }
}
```

终止性：每轮要么返回、要么等待 ≥1 个 waiter；每个 waiter 由 flush finally（通知点 1）、dispose 同步段（通知点 2）或 DD-5b 驱逐通知释放；停机上下文（lease 全释放、无新 handle）下有界。并发 archive/delete 换走 cell → 重扫见非 live → 该 key 退出范围（destructive op 自持其完成）。

### DD-5b：驱逐路径通知面补全（liveness 完备化，本设计对既有代码的最小外延）

**问题**：`archiveWaiters` 的通知点只有 flush finally 与 dispose；`maybeEvict`（:1126-1132，clean 才驱逐 → 对 drain 等待者不可达）、`settleEntryForDelete` 的 cancel-then-evict 腿（:668-674）与 `settleEntryForArchive` 的干净驱逐腿（:697-701）**销毁 live entry 时不通知 waiter**。理论交错：drain 等待回退窗中的零-handle entry，并发 `deleteDoc` 取消 retryTimer 并驱逐 → drain 的 waiter 永不释放（该交错对既有 archive-settle 等待者同样成立，属既有 liveness 空洞；drain 公开后暴露面变大——SA2 SM-4 确认）。

**裁决**：三处驱逐点在 `cells.delete` 前镜像 dispose 通知（`const ws = entry.archiveWaiters.splice(0); for (const w of ws) w()`）——归纳为一条不变量「**任何移除 live entry 的路径必须释放其 settle waiters**」（dispose 通知点 2 的泛化）。无等待者时 splice 空数组为 no-op、零观测差异（:1097-1099 既有同款论证）。live-entry 移除点全集 = dispose（已有通知点 2）/ `settleEntryForDelete` :672 / `settleEntryForArchive` :699 / `maybeEvict` :1130——DD-5b 覆盖完备（SA2 §7 SM-4 枚举核对）。**附带（SA2-4）**：`lifecycle.ts:96-98` `archiveWaiters` 字段注释一并更新——现状「仅 settleEntryForArchive 填充」对 `settleEntryForDelete`（:664 亦填充）已过期，改为「settle 排空路径（archive/delete/drain）填充；驱逐/dispose 路径释放」。

### DD-6（SA6 D-6）：DSH 探针锁步 + 记录头冻结

- `probe.ts:445` 镜像改 `let delay = (schedule.retryDelayMs ?? schedule.debounceMs) || 1`（:464 的 ×2/cap 镜像不变）。未配置 retryDelayMs 的默认探针运行 resolved 键面与时间线逐字节不变（DD-2 键形状不变 ⇒ determinism/acceptance golden 零漂移）；配置了 retryDelayMs 的探针运行按新基准重试（预期可观察变化）。
- **记录头有意冻结**：`record.ts:20` 与 `ProbeRecordMeta.schedule`（:5 两键字面量）不改——retry 基准经事件 `t=` 值可观察，记录格式是机器冻结面（§8 确定性硬规范；dsh AGENTS「Preserve machine-readable shapes」），头扩展属独立 golden 立法，列为 follow-up（§13）。

### DD-7（SA6 D-7 / SA2-1 / Owner 硬契约 / SA2-7）：消费方改动集 —— yjs-server 停机链路 = **有预算的完成式排空，file/memory 统一**

**裁决**（SA2-1 路径 (a)：预算组合 + 注释一致化 + 失败路径验收；**SA2-7 路径 (b)：file/memory 统一调用——iteration 2**，按本轮 dispatch 指令方向选定）：

**(1) app.ts —— 停机第 3 步替换为预算组合 drain（两 kind 统一）**

- boot 保留 plugin 句柄（**file 与 memory 分支统一**）：`private persistencePlugin: ReturnType<typeof createFilePersistencePlugin> | ReturnType<typeof createMemoryPersistencePlugin> | undefined`（两分支各赋值；B14/B19——两工厂均返回 `{apply, get instance()}` 公共句柄，SA8 D11 no-conflict）。两 adapter 的 `drain` 均为 DD-1 具体类方法 ⟹ 在句柄类型的并集上 `adapter.drain()` 可直接调用。
- `performStop` 第 3 步（:565-573）整体替换（**`kind === 'file'` 守卫删除**——SA2-7 统一调用）：

```ts
// 3. persistence fiber 卸载前：完成式排空（停机硬契约：dispose 前 await drain——
//    Owner 评论 5751613018；file 与 memory 配置统一执行，无 kind 特判，SA2-7 路径 (b)）。
//    adapter 对所有 live 脏 entry 立即强制 flush 并等待 settle（跳过 debounce）；
//    宿主预算 = maxDirtyMs + 边距（MAX_MAX_DIRTY_MS 立法保证 < 60s watchdog；memory
//    配置无 schedule 键 → 缺省预算 = DEFAULT_MAX_DIRTY_MS + 边距，与内置 memory
//    adapter 的内部 DEFAULT schedule 同构）。预算尽 → persistence-drain-budget-
//    exceeded 诚实事件后继续 3b 有损 dispose（ADR 0006 dispose 保持 abortive；预算
//    路径是硬契约的可观察退出，不是违约）。boot 窗口 stop 时 instance 未定义 → 跳过（F2）。
const adapter = this.persistencePlugin?.instance;
if (adapter !== undefined) {
  const schedule =
    this.config.persistence.kind === 'file' ? this.config.persistence.schedule : undefined;
  const budgetMs = (schedule?.maxDirtyMs ?? DEFAULT_MAX_DIRTY_MS) + DRAIN_MARGIN_MS;
  if (!(await this.awaitDrainWithBudget(adapter.drain(), budgetMs))) {
    this.sink({ event: 'persistence-drain-budget-exceeded', budgetMs });
  }
}
```

- 有界等待助手（**镜像同文件 REST 排空先例** rest-hosting.ts:151-166 的 tagged-outcome race + timer 早清，B15）：

```ts
/** 有界等待完成式排空：drain 先完成 → true；预算尽 → false（诚实事件 + 有损继续）。
 *  预算 timer 用 node setTimeout（rest-hosting.ts:159 同款先例——停机编排属进程级，
 *  不走 Cordis Timer）。败者 drain 续体不放弃：dispose 的通知点 2 唤醒 waiter 后
 *  重扫见 closed → vacuous resolve（drain store 失败面永不 reject ⟹ 零 unhandled
 *  rejection；见 §9）。 */
private async awaitDrainWithBudget(drain: Promise<void>, budgetMs: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const outcome = await Promise.race<'drained' | 'budget'>([
    drain.then(() => 'drained' as const),
    new Promise<'budget'>((resolve) => {
      timer = setTimeout(() => resolve('budget'), Math.max(0, budgetMs));
    }),
  ]);
  if (timer !== undefined) clearTimeout(timer);
  return outcome === 'drained';
}
```

- **常量保留（iteration 0 的「删除两常量」裁决作废）**：`DEFAULT_MAX_DIRTY_MS = 5_000` 与 `DRAIN_MARGIN_MS = 500` 保留为预算推导输入；注释刷新——`DEFAULT_MAX_DIRTY_MS` 语义改为「缺省 flush 上限（file 配置缺省 schedule 与 memory 内部 DEFAULT schedule 同源——memory 配置无 schedule 键，预算走缺省分支）」；`DRAIN_MARGIN_MS` 语义改为「排空预算边距：预算窗内最后一轮在途/重试 flush I/O 的保守余量」（原「调空窗口边距」措辞过期）。`sleep` 助手保留（:1060/:1085/:1101/:1129 另有使用；race 内联 `new Promise(setTimeout)` 以取 timer 句柄早清，与 rest-hosting 同款）。
- **新事件 `persistence-drain-budget-exceeded`**（载荷 `{ event, budgetMs }`；memory 路径预算值 = 缺省 5_500）：发射位 = 第 3 步预算尽分支（`diagnostics-closed` 之后、`persistence-disposed` 之前；file 路径即原睡眠位，memory 路径为同位置新步）；四事件冻结序不受影响（B17：findIndex 严格递增断言对词表新增事件免疫，`fatal-shutdown`/`diagnostics-closed` 同款先例）。词表同步进 hub-peer-deployment.md（DD-8）。
- **败者 drain 续体语义**：预算尽后 drain promise 继续在后台运行；3b 步 `persistenceFiber.dispose()` → adapter dispose → 通知点 2 唤醒 waiter → drain 重扫见 `closed` → vacuous resolve。drain 在 store 失败面永不 reject（DD-5）⟹ 零 unhandled rejection；`awaitDrainWithBudget` 已消费 race 胜者，败者续体自然终结。**不对称于 REST 排空的 abort 是有意的**：rest-hosting 拥有并 abort **它自己的** socket；app 不 abort drain（drain 非破坏性）——abort 等价物就是紧随其后的 dispose（冻结语义），预算事件把该降级显式化。
- **memory 路径统一排空（SA2-7 路径 (b)，iteration 2 修订——替换 iteration 1 的「memory 不引入 drain」裁决）**：第 3 步对 file 与 memory 配置执行同一 `awaitDrainWithBudget(adapter.drain(), budget)`。技术依据：
  1. **契约边界 = 配置的 store 面，不是 adapter 类名**：`MemoryPersistence` 可经 `writeSnapshot` hook 接线外部 store（memory.ts:38、:93-97——hook store 是唯一读权威，flush 写经 hook 进入该 store）；按 adapter 类名把硬契约 scope 到耐久配置（SA2-7 备选 (a)）会把「接线外部 store 的 memory 实例」错误排除在保护范围外——它们的已 ACK 写与 file 实例同质需要 drain 兑现（B20）。
  2. **零实害**：yjs-server 内置 memory 配置不接线 hook（app.ts:297 零 options 构造），io.write = abort 门 + mirror set（进程内 Map 写，无外部 I/O 失败面；abort 信号在 drain 期间未点火——只在随后 dispose 点火）⟹ drain 对干净/脏 store 均即时 resolve；预算 race 是结构性上界，对内置 memory 配置结构性难以触发。
  3. **诚实边界**：统一调用不为 no-hook memory dev 配置创造跨实例耐久事实——dispose 清 mirror 的冻结语义（memory.ts:206-213，§228-5）不变；drain 在 memory 路径兑现的是「dispose 前 in-flight/脏状态 settle」的契约形状，与耐久配置完全一致（措辞随 DD-8(1)/(4) 入规范文本）。
  4. **预算推导**：memory 配置无 schedule 键（B19，config.ts:58-60）→ 预算 = `DEFAULT_MAX_DIRTY_MS + DRAIN_MARGIN_MS`（5_500）；内置 memory adapter 内部 schedule = `DEFAULT_PERSISTENCE_SCHEDULE`（500/5000）与 `DEFAULT_MAX_DIRTY_MS` 同源 ⟹ 预算形状与 file 缺省配置同构（maxDirty 级退避节奏 + I/O 边距）。
  - 备选 (a)（SA2-7：把 ADR 硬契约 scope 到耐久 adapter、memory 路径维持现状不 drain）否决——除上述 (1) 的「类名 vs store 面」错配外，它要求 DD-8(1) 无条件条款与 DD-8(4)「file/memory」指引改写为带 adapter 限定的三处文本，且 yjs-server 自家 memory 停机落在自家硬契约之外——正是 Owner 明令避免的「契约与实现脱节」的文本残留。统一调用使规范条款、对外指引与自家实现三方对 memory 路径给出**同一个答案**。
- **硬契约的可满足性论证（Owner 评论 5751613018）**：改造后 dispose 被调用前**必然**经过第 3 步对 drain 的 await——唯一两种出口：(i) drain 完成（有界或即时）；(ii) 预算耗尽且 `persistence-drain-budget-exceeded` 事件已先于 dispose 发射。即 dispose 永不在「drain 在途且无预算耗尽可观察事实」下被调用；**file 与 memory 两 kind 均然**（memory 链今日无第 3 步等待，iteration 2 起统一进入同一等待步）；degraded store 下停机链在预算内收口（≤ 30.5s 排空段），watchdog（60s）退居最后兜底而非常规边界（对照 iteration 0：无预算等待把 watchdog 变成 degraded store 的常规终结者——SA2-1 MAJOR）。
- **预算推导取舍（放弃的备选）**：
  - (i) **模块常量**（如镜像 `REST_DRAIN_BUDGET_MS=10_000`）：对合法配置（`maxDirtyMs` 可至 30_000）会把「慢而可恢复的 store」误判入预算耗尽 → 不必要的有损 dispose；且使 config.ts 的 `MAX_MAX_DIRTY_MS` 立法失去被约束对象（数值不变量 `maxDirtyMs + 边距 < watchdog` 无从谈起）。否决。
  - (ii) **显式立法接受 watchdog 终结**（SA2-1 路径 (b)）：degraded store 下停机以 `exit(1)` + root lock 残留 + NDJSON 序列断裂收场——与 B16 后果、Owner 硬契约（「await drain before dispose」在 watchdog 强杀下根本不发生 dispose）与同文件 REST 有界先例三方冲突。否决。
  - (iii) **`dispose()` 内部先 drain 再 abort**：击穿 §228-5 冻结面；degraded store 下 dispose 挂起（把 SA2-1 的挂起从宿主层搬进库层，更糟）；剥夺宿主预算控制权；违反 Owner「dispose 保持 abortive 时保留分层公开 drain」。否决。
  - (iv) 预算从 `max(debounceMs, maxDirtyMs)` 推导：`debounceMs` 在 app 配置面无上界（config.ts 只校验正有限）⟹ 预算无上界 ⟹ watchdog 不变量重新失守。否决——采用 `maxDirtyMs + 边距`，并诚实记录：配置 `debounceMs > 预算` 的操作员接受了「degraded 首重试可能超出预算 → 预算事件 + 有损继续」（该事件使其可观察；健康 store 下 drain 于 t=0 强制 flush，根本不经 debounce，严格优于现状固定睡眠）。

**(2) config.ts —— 注释与拒绝文案刷新（行为零变化）**

- `:13-15` 校验纪律 bullet 与 `:27-34` `MAX_MAX_DIRTY_MS` 文档注释：措辞从「file 停机排空窗 = `maxDirtyMs + DRAIN_MARGIN_MS`（固定睡眠）…watchdog 必须覆盖排空窗」刷新为「停机**排空预算** = `maxDirtyMs + DRAIN_MARGIN_MS`（app.ts 对完成式 `drain()` 的有界等待；memory 配置无 schedule 键，走 `DEFAULT_MAX_DIRTY_MS` 缺省推导——两 kind 统一）必须严格短于总超时 watchdog；预算尽 → `persistence-drain-budget-exceeded` 事件 + 有损 dispose 继续（诚实降级，不依赖 watchdog 兜底）」。**诚实性边界（SA8 action 4）**：预算覆盖的是**正常路径**最坏等待（强制 flush + maxDirtyMs 级退避节奏 + I/O 边距）；库级 drain 本体无上界（持续失败 store 下的总界 = 本预算），注释不得写成「drain 恒有界」。
- `:270` 拒绝文案 parenthetical 更新为 `(the stop total-timeout watchdog must cover the bounded persistence-drain budget)`——`app-config-red.test.ts:299` 只钉 `'persistence.schedule.maxDirtyMs'`、`lifecycle-watchdog-red.test.ts:122` 只钉 `'config violation persistence.schedule.maxDirtyMs'`（B10），两测试零改动即绿。
- schedule 配置词表保持两键闭集（`retryDelayMs` 不上 app 配置面；亦不新增预算配置键——预算由推导得出，§1 非目标）。

**(3) main.ts —— 注释刷新（移入 ALLOW；iteration 0 的 DENY「无关联」归类不成立，SA2-1 指认）**

- `:96-99` 换装注释中的「停旧（含 file 排空窗，上界由 config.ts `MAX_MAX_DIRTY_MS` 保证 < watchdog）」刷新为「停旧（含持久化**排空预算窗**：file/memory 完成式 drain 的有界等待，上界 = `MAX_MAX_DIRTY_MS` + 边距 < watchdog；预算尽发 `persistence-drain-budget-exceeded` 后有损继续，换装链不因 degraded store 挂起）」。行为零变化（reload 链只是消费 `app.stop()` 的新形状——预算内必然返回）。

**(4) 停机时序总览（改造后）**

| 步 | 动作 | 时延形状 |
| --- | --- | --- |
| 1/1b | listener close + 复制 drain + REST 有界排空（10s 预算，不变） | 既有有界 |
| 2/2b | registry shutdown + diagnostics O(1) close | 既有有界 |
| **3** | **file/memory 统一：有界完成式排空（drain vs 预算 race；干净时即时通过；预算：file = maxDirtyMs+500 ≤ 30.5s，memory = 缺省 5.5s）** | **新（file：替换固定睡眠——干净时更快、degraded 时有界且诚实；memory：新增统一等待步——今日无任何等待，drain 即时完成）** |
| 3b | persistence fiber dispose（abortive，冻结语义） | 既有有界（abort + allSettled） |
| 4 | 根 fiber dispose（Timer/Clock） | 既有有界 |

链预算核算：file 路径排空段上界 30.5s 与现状固定睡眠相同量级 ⟹ watchdog 余量画像与现状一致（issue #139 SA4 B2 立法继续成立，仅语义从「猜测窗」变为「预算窗」）；memory 路径排空段 = 即时（无等待步变即时完成式等待步，时延形状不变、语义从「跳过」变为「完成式确认」）。

### DD-8：规范文档同步（ADR 0006 增量修订节 + CONTEXT.md + 两份集成文档）

**(1) `docs/adr/0006-server-persistence-docstore.md` 追加修订节**「完成式排空 drain、retryDelayMs 与停机硬契约修订（2026-09，issue #412）」：

- 接口片段：optional `drain` + `PersistenceSchedule.retryDelayMs?` + `PersistenceDrainTarget`。
- drain 语义条款（§8 全量；含 SA2-2 静息观察点措辞与并发写者边界、`targets: []` no-op、File target 校验例外申明）。
- **停机硬契约条款（Owner 评论 5751613018；保持无条件——SA2-7 路径 (b)）**：「宿主优雅停机在调用 `dispose()` 之前必须先 await `drain()`——至 drain 完成，或至宿主显式预算耗尽且该事实可观察（如 yjs-server 的 `persistence-drain-budget-exceeded` 事件）。预算尽后继续 dispose 有损路径是硬契约的**显式可观察退出**，不是违约；未经任何 drain 直接 dispose 的宿主接受（静默地）丢失已 ACK 未写入 store 的状态。」**适用面申明（SA2-7）**：本条款不以 adapter 类型特判——yjs-server 对 file 与 memory 两种配置执行同一停机排空步；接线了外部 store（`writeSnapshot` hook）的 memory 实例与 file 实例具有同质保护对象（配置的 store 面）；未接线外部 store 的 memory dev 配置中 drain 不创造跨实例耐久事实（dispose 清 mirror 的冻结语义不变），但「dispose 前 in-flight/脏状态 settle」的契约形状与耐久配置完全一致。与 :34 的关系申明：drain 是归档 settle 范式（:37/:213 内在先例）的一次性公开化，非周期协调器；宿主预算是「重试直到成功或插件停止」中「插件停止」的宿主侧映像——硬契约与 :34 不冲突。
- **dispose 对齐条款（Owner 评论 5751613018；SA2-10 措辞）**：**本节修订并扩展 :86 的 dispose 定义边界**（issue #79 修订节对 :33/:36 的引用式修订同款惯例）——:86 所列「释放文件句柄、后台任务和 Y.Doc 缓存」之外，本节显式声明：`dispose()` 语义不变且保持 abortive/有损，它从来不是持久性屏障（§228-5，issue #228 修订节第 5 条，重申）；「dispose 前的持久性」唯一经**分层公开 drain** 表达（drain = 完成式排空层，dispose = abortive 拆卸层，两者不合并）。
- DD-2 解析形状裁决（键形状不变；缺省回退在 lifecycle 内）；DD-5b 不变量一句「任何移除 live entry 的路径必须释放其 settle waiters」（SA8 action 3）；非 live cell 排除裁决存档（SA2 §14-6 建议归档）。

**(2) `CONTEXT.md`「Language」新增词条**（SA2-5：含 `_Avoid_` 行）：

```markdown
**完成式排空（drain）**:
把「所有 live 脏 entry 落完盘」表达为可 await 的完成事件：对所有 live 脏 entry（含有
handle 与零 handle）立即强制 flush（跳过 debounce）并 await 全部 settle；不 abort、
不 destroy、不清调度面。宿主优雅停机硬契约：dispose 前 await drain（完成或至宿主
预算耗尽且可观察）。
_Avoid_: flush-all、force-sync、定时排空窗（固定睡眠猜窗口）
```

**(3) `docs/integration/hub-peer-deployment.md`**：事件词表（:36-41）在 `registry-stopped` 与 `persistence-disposed` 之间补 `persistence-drain-budget-exceeded`——**带条件性注记（SA2-8）**：「仅停机排空预算耗尽时发射（健康 store 排空完成式返回，不发射）」（该词表现有条目多为阶段必发事件，无条件标注会误导运维在每次停机中寻找该事件；§停机顺序句已含条件）；§停机顺序（:276-279）补一句「Registry shutdown 之后、Persistence dispose 之前对持久化 adapter（**file 与 memory 配置统一**）执行**有界完成式排空**（`drain()`，预算 = maxDirtyMs + 边距 < 60s watchdog；预算尽发 `persistence-drain-budget-exceeded` 并有损继续）」。

**(4) `docs/integration/cordis-plugin-hosting.md`**（仓库外宿主 nomic-server 的规范入口，B18）：:64 停机句与 :450-466 停机清单第 5 步（释放 Persistence Fiber）补 drain-before-dispose 硬契约指引：「file/memory adapter 在 dispose 前先 `await adapter.drain()`（完成式排空；统一适用于两种 adapter——接线外部 store 的 memory 实例与 file 实例同质受保护；未接线 hook 的 memory dev 配置不因 drain 获得跨实例耐久，但契约形状一致）。宿主以自有预算对 drain 有界等待——如 `maxDirtyMs + 边距` + `Promise.race`——预算尽则诚实记录（如事件）后继续有损 dispose；degraded store（持续写失败）的退避等待主要发生在耐久 adapter，memory adapter 的 drain 通常即时完成，预算 race 仍是同款结构性上界」——该指引与 yjs-server app 实现对 memory 路径的答案一致（iteration 1 的三方不一致由此消除，SA2-7）。**:450-466 示例代码块同步加入有界 drain 步（SA2-9）**——在 `await persistenceFiber.dispose()` 之前插入「`await adapter.drain()`（有界等待，预算尽记录后继续）」，使规范示例自身演示硬契约形状（现状示例 `await persistenceFiber.dispose()`（无 drain）恰是硬契约禁止的形状）。docs/AGENTS.md「行为变更同步规范文档」由此闭合。

---

## 8. 接口、状态机和数据流

### 状态机（drain 对既有 per-entry 状态的消费，零新状态；SA2 §7 逐态攻击核验）

| entry 观测态 | drain 动作 | 唤醒来源 | 唤醒后重扫结果 |
| --- | --- | --- | --- |
| live + retryTimer 武装（degraded 回退窗） | 注册 waiter，被动等待 | 退避到点的 retry flush finally | 成功 → 干净退出；再失败 → 仍回退窗 → 继续等 |
| live + flushing | 注册 waiter（不重复发起） | 该 flush finally | 提交 → 干净/或再脏；失败 → 回退窗 |
| live + idle + 脏（handle>0 或 =0） | `startFlush`（跳过 debounce）+ 注册 waiter | 新 flush finally | 同上 |
| live + idle + 干净 | 跳过（零 write、不清定时器、不驱逐） | — | — |
| 非 live（reading/creating/archiving/deleting）或 cell 缺席 | 跳过/该 key 退出范围 | — | — |
| lifecycle closed（dispose 中/后） | 立即 return（vacuous） | dispose 通知点 2 亦唤醒已注册 waiter | cells 已清 → return |
| （宿主侧映像，SM-11/SM-6） | drain 等待中宿主预算到点 → 宿主停发等待、发 `persistence-drain-budget-exceeded`、继续 dispose；终扫后新 ACK 的 saveDoc 不属本 drain 覆盖（停机链 lease 已释放 ⟹ 无此写者） | app 层预算 timer | dispose 通知点 2 → drain vacuous resolve |

### 数据流路线（运行时数据路径变化）

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| L1 drain 强制 flush | 宿主停机 `drain()`（或 subset targets）→ `startFlush` | `flush()` 捕获 generation → `Y.encodeStateAsUpdate(doc)`（lifecycle 进程内） | 单飞/generation 保序（既有）；drain 仅改变触发时机（跳过 debounce），不改编码与写路径 | `io.write(key, snapshot, signal)`：Memory = entry 门→writeSnapshot hook→mirror；File = mkdir→writeFile tmp→**rename（提交点）** | 受信 store；新实例 `loadDoc` 是落盘事实唯一权威面（契约 `committedN`） | resolve 前 store 已持最新完整快照；dispose 后新实例可见（1a/1d n=77） | write reject → degraded + `scheduleRetry`（既有）→ drain 转被动等待（1f）；abort 不由 drain 引入 | 1a/1c/1d/1e |
| L2 drain 等待在途/回退 | drain 扫描注册 `archiveWaiters` | —（纯等待） | waiter 数组为生命周期内部通知面；flush finally splice 全量同步 call | — | drain `Promise.all` 屏障 → 重扫 | 在途未结算时 drain 不返回（1b/1g）；回退窗内零新尝试（1f t=149 attempts=1） | 驱逐/dispose 路径释放 waiter（DD-5b/通知点 2）→ 重扫退出 | 1b/1f/1g + S-3 |
| L3 retry 基准解耦 | `PersistenceSchedule.retryDelayMs`（可选）→ `resolvePersistenceSchedule` 条件展开 → `retryBaseMs` getter | `createEntry` 初始化与 flush 成功回落两落点 | 配置→解析→entry 状态；`\|\| 1` 下限；增长 ×2、cap=maxDirtyMs 不变 | 进程内调度（注入 scheduler seam） | `scheduler.setTimeout` 触发时刻（探针 attempts 时间线） | 首重试 = retryDelayMs（t=60_200）；缺省 = debounceMs（+40）；cap 保持（t=700） | 校验环对非法值 `RangeError`（既有词表扩展至新键） | 2a/2b/2c/3a |
| L4 宿主停机链（有界完成式排空） | `performStop` 第 3 步：`awaitDrainWithBudget(adapter.drain(), (kind==='file' ? schedule.maxDirtyMs : DEFAULT_MAX_DIRTY_MS) + DRAIN_MARGIN_MS)`（**file 与 memory 路径统一**；聚合 L1/L2） | —（纯等待 + 预算 timer） | registry.shutdown（lease 全释放）之后、fiber dispose 之前（位置不变；memory 路径为同位置新步）；race 镜像 rest-hosting 纪律；败者 drain 续体由 dispose 收口（vacuous） | — | stdout NDJSON：预算尽时 `persistence-drain-budget-exceeded{budgetMs}`（`diagnostics-closed` 与 `persistence-disposed` 之间；memory 预算值 = 缺省 5_500）；四事件序不变 | 停机排空从时间量（固定睡眠）变为**事件量 + 预算上界**：file 干净时即时通过（快于现状）、degraded 时 ≤ 预算内收口 + 诚实事件，watchdog 不参与；memory 即时完成式确认（时延形状不变） | 预算尽 → 事件 + 继续 3b 有损 dispose（冻结语义）；drain 续体 vacuous resolve 零 unhandled rejection；drain 同步 throw（结构性不可达）→ 链 catch → `app-stop-failed` loud | S-5a/S-5b/S-5c + ordered-shutdown-red 序列保持 |

跨边界说明：L1 跨「内存 doc → 受信 store」一跳（提交点 = rename/hook 完成，`write` resolve ⟺ committed，lifecycle.ts:33-47 公理）；L3 跨「配置 → 注入 scheduler」一跳（无墙钟，PersistenceScheduler seam）；L4 跨「app 组合根 → stdout NDJSON 事件面」一跳（事件词表经 hub-peer-deployment.md 规范化）；无网络/wire/schema 面。

---

## 9. 错误、恢复、并发和幂等

- **错误（drain 本体）**：**store 失败面永不 reject**、不新增 typed 错误族；store 失败沿既有 degraded + 内部退避通道（ADR 0006:34/:195）。例外申明（SA2-3）：`resolvePersistenceSchedule` 对非法 `retryDelayMs` 复用既有 `RangeError`（词表自动扩展，`persistence schedule retryDelayMs must be a finite non-negative number`）；`FilePersistence.drain` 对 unsafe target 沿既有 `validateIdentity` bare Error loud 拒绝（输入校验通道，非 store 失败面；S-4）；`targets: []` = no-op。
- **错误（app 预算组合）**：预算尽 → `persistence-drain-budget-exceeded{budgetMs}` 事件 + **继续** 3b 有损 dispose（诚实降级，不 abort drain、不重试、不静默）；drain promise 若同步 throw（结构性不可达——adapter 契约违约级 bug）→ `performStop` 既有 try/catch → `app-stop-failed` + rethrow → main.ts `exit(1)`（fail loud，与链上其他步骤同纪律）。
- **恢复**：degraded 回退窗内 drain 被动等待退避到点（不热循环）；退避成功 → drain resolve（1f）。**库级持续失败 → drain 不 resolve（无预算语义保持）**；宿主侧总界 = app 预算（DD-7）——预算尽走有损 dispose；库级 drain 的「宿主停止」映像由此闭合，ADR 0006:34 不被击穿。
- **并发与幂等**：drain 幂等可重入（多次调用各自静息观察点结算）；等待期内的再脏由重扫吸收；终扫后的并发写者按静息观察点边界处理（DD-5；停机上下文无此写者）；与并发 archive/delete 交由 cell 状态重扫退出 + DD-5b 驱逐通知防挂起；与 dispose 交由通知点 2 + closed 早退。key 内 single-flight 由 `startFlush`/`flush` 既有双门保证（drain 零重复发起，1b/1g attempts 断言）。停机链 single-flight 不变（`stop()` 幂等；drain 位于同一链内，不构成第二条拆卸链——apps AGENTS 纪律，SA8 D10）。
- **资源所有权**：drain 不获取任何资源——不 abort、不 destroy、不清定时器、不驱逐；doc/timer/cell 所有权完全维持既有（dispose/evict/archive/delete 所有）。app 预算 timer 一次性、早清（drain 先完成时），无泄漏。
- **回滚**：全部改动 additive（optional 成员、optional 配置键、新公共方法、消费方一处替换 + 一个新事件 + 注释/文档刷新）；revert = 逐文件删除，无数据迁移、无存储格式变化。

---

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
| --- | --- | --- | --- | --- |
| 第三方 `DocPersistence` 实现（13 个既有 stub + wrapIo 字面量） | 三成员/optional 面编译绿 | 不变（drain 为 optional；三成员字面量守卫保持绿） | 零 | contract.ts:74-79；surface 测 `legacyThreeMemberAdapter`；C13 |
| `MemoryPersistence` / `FilePersistence` 消费方（含 nomic-server） | 无完成式排空；固定睡眠 | `instance.drain(targets?)` 可用；经 `DocPersistence` 面消费需 `typeof` 窄化（INV-13）。**停机硬契约指引**经 cordis-plugin-hosting.md 传达（DD-8：dispose 前 await drain——file/memory 统一，宿主自有预算有界等待，与 app 实现同答案） | 消费方自决（nomic-server 仓库外） | issue「消费方配合」；DD-1/DD-8；B18/B20 |
| `apps/yjs-server` performStop | file 路径固定睡眠 `maxDirtyMs+500`（:570-573）；memory 路径无任何等待直接 dispose | 同位置有界完成式排空（race + 预算事件），**file 与 memory 两 kind 统一**（memory 新进入该步：drain 即时完成、零预算事件、`MemoryPersistence.prototype.drain` 原型面可观测——S-5c）；四事件序不变；boot 窗口跳过（instance undefined） | app.ts（DD-7） | B9/B15/B17/B19；ordered-shutdown-red.test.ts:77 |
| `apps/yjs-server` config 解析 | schedule 两键闭集 + `MAX_MAX_DIRTY_MS` 上界 | 行为完全不变（词表冻结；注释 + 拒绝文案 parenthetical 刷新，测试只钉路径段） | config.ts 注释/文案（DD-7） | config.ts:60/:248-276；app-config-red.test.ts:299；lifecycle-watchdog-red.test.ts:122 |
| `main.ts` SIGTERM/SIGINT/SIGHUP 链 | watchdog 兜底 + 注释依赖「排空窗上界 < watchdog」 | 行为不变（`app.stop()` 预算内必然返回）；注释刷新为预算窗表述（file/memory 统一） | main.ts 注释（DD-7；移入 ALLOW） | main.ts:30/:67-87/:89-105；B16 |
| stdout NDJSON 消费方（运维/测试解析器） | 按 `event` 字段消费词表 | 新增 `persistence-drain-budget-exceeded`（additive；既有模式：`fatal-shutdown`/`reload-ignored` 等后增事件先例）；词表文档同步 | 消费方按需关注新事件（缺省无动作） | hub-peer-deployment.md:36-41；B17 |
| `packages/namespace-registry` | 经 `DocPersistence` 面消费；shutdown 释放 lease | 不变（不调用 drain；零接口破坏） | 零 | SA6 §10 运行时/Registry 行 |
| DSH probe / profile / CLI | 退避镜像 `debounceMs \|\| 1`（probe.ts:445） | 镜像 `(retryDelayMs ?? debounceMs) \|\| 1`；默认运行时间线不变 | probe.ts 一行（DD-6） | B11 |
| DSH record 消费方（golden 测试） | 两键记录头 + `t=` 事件行冻结 | 不变（DD-6 有意冻结） | 零 | record.ts:20；dsh-file-probe-determinism.test.ts:36-42 |
| persistence 既有测试套件 | 180 tests 绿（SA6 基线） | 保持绿（B12 四组冻结审计零改动） | 零 | SA6 §4 基线 |

---

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因（对应正文） |
| --- | --- | --- |
| `packages/persistence/src/contract.ts` | `PersistenceDrainTarget` 类型；`DocPersistence.drain?` optional 成员 + doc-comment（静息观察点措辞）；`PersistenceSchedule.retryDelayMs?`；`resolvePersistenceSchedule` 条件展开（校验环自动覆盖） | DD-1/DD-2/DD-3/DD-4/DD-5 |
| `packages/persistence/src/lifecycle.ts` | 公共 `drain(targets?)`（§8 骨架）；`retryBaseMs` getter；:1030/:1088 两落点改引；三处驱逐点 waiter 通知补全；**`:96-98` `archiveWaiters` 字段注释更新**（SA2-4：改为「settle 排空路径（archive/delete/drain）填充；驱逐/dispose 路径释放」） | DD-2/DD-5/DD-5b |
| `packages/persistence/src/memory.ts` | `drain` 委派方法（getStatus 邻位放置） | DD-1；C14 双 adapter 等价 |
| `packages/persistence/src/file.ts` | `drain` 委派方法 + 入口 targets `validateIdentity` | DD-1；B14 先例 |
| `packages/persistence/src/index.ts` | barrel 导出 `type PersistenceDrainTarget` | DD-1 |
| `packages/dsh-persistence/src/probe.ts` | :445 退避镜像锁步一行 + 注释 | DD-6 |
| `apps/yjs-server/src/app.ts` | 停机第 3 步：固定睡眠 → `awaitDrainWithBudget(adapter.drain(), 预算)`——**file/memory 统一，`kind==='file'` 守卫删除（SA2-7 路径 (b)）**；保留 plugin 句柄字段（**两 kind 分支统一赋值**）；**保留两常量并刷新注释**（含 `DEFAULT_MAX_DIRTY_MS` 的 memory 缺省分支语义）；新增 `awaitDrainWithBudget` 助手；新事件 `persistence-drain-budget-exceeded`；步骤注释更新为硬契约语义 | DD-7（SA2-1 路径 (a) + SA2-7 路径 (b)；Owner 硬契约） |
| `apps/yjs-server/src/config.ts` | **注释 + :270 拒绝文案 parenthetical 刷新**（排空预算表述 + 预算尽诚实降级路径 + memory 配置缺省预算分支说明；「排空预算上界 < watchdog」新不变量措辞）；行为零变化 | DD-7；SA8 action 4 诚实性 |
| `apps/yjs-server/src/main.ts` | **仅注释**刷新（:96-99 换装链排空预算窗表述，覆盖 file/memory 两 kind）——iteration 0 的 DENY 归类不成立，SA2-1 指认后移入 | DD-7；docs 纪律 |
| `docs/adr/0006-server-persistence-docstore.md` | 增量修订节（drain + retryDelayMs 语义条款 + **停机硬契约条款（无条件 + 适用面申明）** + **dispose 对齐条款（修订/扩展 :86 边界——SA2-10）** + DD-2 解析形状 + DD-5b 不变量 + 非 live cell 排除裁决存档） | DD-8；Owner 评论 5751613018；SA8 action 1/3 |
| `CONTEXT.md` | Language 新词条「完成式排空（drain）」（含 `_Avoid_` 行） | DD-8；SA2-5；docs/AGENTS 词汇纪律 |
| `docs/integration/hub-peer-deployment.md` | 事件词表补 `persistence-drain-budget-exceeded`（**条件性注记——SA2-8**）；§停机顺序补有界完成式排空一句（**file/memory 统一**） | DD-8；B17 规范同步义务 |
| `docs/integration/cordis-plugin-hosting.md` | :64 停机句与 :450-466 清单第 5 步补 drain-before-dispose 硬契约指引（**file/memory 统一措辞 + degraded 预算措辞限定为耐久 adapter 关注点**）；**:450-466 示例代码块加入有界 drain 步（SA2-9）** | DD-8；Owner 硬契约面向仓库外宿主；B18 |
| `packages/persistence/test/persistence-issue-412-drain-semantics.test.ts`（新增，建议） | 补充锚：S-1 drain-after-dispose vacuous；S-2 drain 期间再脏（saveDoc 重扫）；S-3 驱逐/删除交错 liveness；S-4 File unsafe target loud | §12 缺口项（D-5 语义需可执行锚） |
| `apps/yjs-server/test/persistence-drain-shutdown.test.ts`（新增，建议） | **S-5a** 健康 store（file 配置）：小 schedule 配置 + 停机前写入 → stop 快速返回（远小于预算，无固定睡眠）+ 重启实例见最新内容 + 四事件序保持；**S-5b** degraded store（file 配置）：写失败注入（如以目录占据 `{rootDir}/users/{owner}/{nsId}.snapshot.tmp` 造持续 EISDIR）→ stop 在预算内返回 + `persistence-drain-budget-exceeded` 可见 + 四事件序完整 + 有损事实诚实（新实例见旧 committed 快照） + withTimeout 包裹（挂起即失败）；**S-5c** memory 停机链（SA2-7 验收）：`vi.spyOn(MemoryPersistence.prototype, 'drain')`（`@nomicore/persistence` public export 原型面，B19）+ memory 配置 stop → drain 恰被调用一次且严格先于 `persistence-disposed` 事件、四事件序完整、无预算事件、stop 正常返回 | §12（SA2-1 失败路径 + SA2-7 统一路径验收要求） |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
| --- | --- | --- |
| `packages/persistence/src/service.ts` | Cordis 生命周期绑定 | dispose 语义不变；drain 是宿主显式调用，不进 fiber 绑定链 |
| `packages/persistence/src/testing.ts` | 测试缝 | 契约测试用现有 fake scheduler/探针即可表达，零缝扩展 |
| `packages/namespace-registry/**` | 停机上游 | issue 未要求；registry shutdown 语义冻结（SA8 D12） |
| `packages/dsh-persistence/src/record.ts`、`events.ts`、`profile.ts`、`cli.ts` | 记录/装配面 | DD-6 有意冻结（记录格式机器冻结面；profile 选项经 Partial 自动获得新键；SA8 D9） |
| `packages/persistence/test/persistence-contract.test.ts`、`file-persistence.test.ts`、`file-persistence-sa7-dynamic.test.ts`、`persistence-phase5-*.test.ts` 等既有测试 | 冻结审计 | DD-2 路径使其零改动即绿；改审计 = 伪冲突 |
| **`packages/persistence/test/persistence-issue-412-drain-red.test.ts`、`persistence-issue-412-drain-surface.test-d.ts`（SA6 契约两文件）** | 验收契约证据 | **零触碰（SA2-6）**：保持验收产物不可变；「临时形状」注释无害，DD-4 形状与其逐字段一致 |
| `apps/yjs-server/test/` 既有测试（ordered-shutdown-red、app-config-red、lifecycle-watchdog-red、issue270-* 等） | 冻结锚 | 四事件序/配置边界/watchdog 锚零改动即绿（B10/B17）；S-5 以新增文件承载 |
| `docs/protocols/**`、`packages/ws-replication/**` | 线协议/复制 | wire 零变化（SA8 D13） |
| `wiki/raw/task_issue-412.md`、`task_issue-412_sa6_contract.md`、`task_issue-412_sa2_review.md`、`task_issue-412_design_conflict_report.md` | Host/SA6/SA2/SA8 产物 | 只读上游输入 |

---

## 12. 验收与验证映射

主验收 = SA6 契约两文件（已就位、基线红因已逐条确认、**本设计零触碰**）：

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
| --- | --- | --- | --- |
| C1 强制排空（含 handle/零 handle、跳 debounce） | 契约 1a/1d（基线 TypeError 红） | 1a/1d（双 adapter） | 零 advanceBy 恰 1 次 write、n=77 落盘；release 后链路 77 存活 |
| C2 完成式（在途不早退、零重复发起） | 1b/1g | hold 屏障 + attempts 计数 | release 前不返回；attempts 恒 = 在途数 |
| C3 干净负控 | 1c | 空 lifecycle/干净 entry | 0 write、即时 resolve、调度面完好 |
| C4 不 abort | 1b/1g | hold → drain → release | 提交段真实执行，store 含 77 |
| C5 不 destroy/不清调度 | 1a/1c | drain 后续写 + 推进 | `ready`、n=88 第二轮落盘 |
| C6 drain→dispose 安全 | 1d/1a | drain 后立即 dispose | 新实例见 77 |
| C7 subset targets | 1e | 指定 A 排空 | 仅 A 1 次 write；B 保持脏；零参全量补齐 |
| C8 retryDelayMs 正交 | 2a + 类型锚 | t=60_200 断言 | 首重试 = retryDelayMs |
| C9 退避 ×2/cap | 2c | t=50/150/350/700 | 序列精确成立 |
| C10 缺省 = debounceMs | 2b/3a | 40ms 基准 + 缺省常量 | 基线绿保持 |
| C11 dispose 有损正复现（保持） | 0a/0b | 调长 schedule/并发在途 | 基线绿保持（0 write 后丢 77） |
| C12 回退窗不热循环 | 1f | t=149 attempts=1 | 重试到点后 resolve |
| C13 既有面零改动 | 3a/3b/3c + `legacyThreeMemberAdapter` | 缺省常量/解析/dispose | 基线绿保持 |
| C14 双 adapter 等价 | §0/§1/§2 全矩阵 | adapterName 双跑 | 两 adapter 同判 |
| D-5 语义缺口（本设计新增语义） | 无（SA6 D-5 未锚定） | **S-1** drain-after-dispose → 立即 resolve、零 write；**S-2** drain 等待期 `saveDoc` 再脏 → 重扫强制 flush 后才 resolve（终扫后写者边界在 doc-comment/ADR 声明，不做行为断言）；**S-3** drain 等待期并发 `deleteDoc`（零 handle + 回退窗）→ 驱逐通知释放 waiter、drain resolve（不挂起）；**S-4** `FilePersistence.drain([{owner, docId: 'UPPER'}])` → `validateIdentity` loud Error | 各自唯一预期观察 |
| **DD-7 端到端（健康路径）** | ordered-shutdown-red 序列锚 | **S-5a**：file 配置（小 schedule，如 `{debounceMs:10, maxDirtyMs:20}`）+ 停机前写入（dirty 已 ACK）→ `stop()`：**在预算内且远小于预算返回**（drain 完成式——证明固定睡眠已消失）+ 重启新实例 `loadDoc` 见最新内容 + 四事件序 `replication-drained → registry-stopped → persistence-disposed → app-stopped` 不变 + 无 `persistence-drain-budget-exceeded` | 完成式停机 + 内容耐久 + 序列保持 |
| **DD-7 端到端（degraded 路径，SA2-1 验收）** | 无 | **S-5b**：同配置；boot + provision + 写入使 dirty；以确定性持续写失败注入破坏 store（建议机制：在 `{rootDir}/users/{ownerUserId}/{nsId}.snapshot.tmp` 路径预置**目录** → 每次写尝试 EISDIR，非瞬态；机制可换，任何确定性持续失败注入均可）→ `stop()` | **预算内返回**（withTimeout 包裹，挂起即失败，预算 = maxDirtyMs+500 = 520ms 量级）；**`persistence-drain-budget-exceeded` 事件可见**且先于 `persistence-disposed`；**四事件序完整**（不被 watchdog 击穿——进程内测试无 watchdog 参与，main.ts watchdog 语义由既有 lifecycle-watchdog-red 独立锚定）；**有损事实诚实**：重启新实例见旧 committed 快照（dirty 写丢失 = dispose abortive 冻结语义，事件已预告） |
| **DD-7 端到端（memory 统一路径，SA2-7 验收）** | 无 | **S-5c**：memory 配置（hub、port 0、含 provision 条目制造 boot 期已 ACK 写；干净 store 亦可——drain 对干净面即时 resolve）+ 注入 emitter 收集事件 + `vi.spyOn(MemoryPersistence.prototype, 'drain')`（`@nomicore/persistence` public export 类原型面——app 内部实例继承同一原型，模块实例一致性由同一 specifier 经 workspace 解析保证，B19）→ `stop()`（withTimeout 包裹，挂起即失败） | drain 恰被调用 **1 次**（单一停机链）；spy 记录的调用时刻事件流中 `persistence-disposed` **尚未发射**（drain 严格先于 dispose——硬契约时序锚）；四事件序完整；无 `persistence-drain-budget-exceeded`（memory drain 即时完成）；stop 正常 resolve（无 app-stop-failed） |
| 既有回归 | SA6 基线 180 绿 | 全量命令 | 既有 180 + 契约 27+5 全绿、零回归 |

Runner 触发（SA6 §12 同款 + 包级门）：

```bash
NODE_OPTIONS=--conditions=nomicore-source npx vitest run --typecheck packages/persistence/test  # 契约 + 既有
npx tsc -p packages/persistence/tsconfig.json                                                     # 包类型面
pnpm --filter @nomicore/dsh-persistence test        # 或 vitest run packages/dsh-persistence/test（golden 零漂移）
tsc -p apps/yjs-server/tsconfig.json && vitest run apps/yjs-server/test                            # 消费方（含 S-5a/S-5b/S-5c）
pnpm typecheck && pnpm test                          # root 门（persistence AGENTS：契约/生命周期变更必跑）
```

---

## 13. 风险、回滚和残余问题

| 风险 | 评级 | 缓解 / 裁决 |
| --- | --- | --- |
| 持续失败 store 下库级 drain 永不 resolve | 中（语义代价，非缺陷） | 完成式语义的诚实结果（ADR 0006:34）；**宿主侧总界已落地**：yjs-server 预算 race + `persistence-drain-budget-exceeded` + 有损 dispose（DD-7）——SA2-1 的核心缺口闭合；仓库外宿主经 cordis-plugin-hosting.md 指引（DD-8）；库级不新增超时配置（分层保持） |
| 预算 < 可恢复 store 实际所需 → 误判有损 | 低-中 | 预算 = `maxDirtyMs + 边距` 随配置缩放（正常路径最坏等待形状：强制 flush + maxDirty 级退避节奏 + I/O 边距）；预算尽事件可观察、可告警；操作员可调 maxDirtyMs（≤ 30_000 立法内）。`debounceMs > 预算` 的极端配置接受首重试超预算（事件可观察；健康路径不经 debounce）——DD-7 备选 (iv) 论证 |
| 预算耗尽后 drain 续体泄漏（后台未决 promise） | 低 | dispose 通知点 2 + closed 早退 → vacuous resolve；drain store 失败面永不 reject ⟹ 零 unhandled rejection；S-5b 端到端锚定（无未决拒绝、进程正常退出） |
| drain 与并发写者互饿（saveDoc 再脏延长等待） | 低 | 停机上下文 lease 已全释放（registry.shutdown 先行）+ 接纳已停 ⟹ 无并发写者；语义边界（静息观察点）已在 DD-5/doc-comment/ADR 显式声明（SA2-2） |
| DD-5b 触碰三处既有驱逐点（diff 外延） | 低-中 | no-op 安全性同款论证（:1097-1099）；修复面覆盖既有 archive×delete 理论挂起（SA2 SM-4 枚举完备确认）；SA8 D15 = implements-existing-decision |
| app 停机时长变化（干净时更快；degraded 时有界） | 低 | file 干净路径即时通过（严格优于固定睡眠）；degraded 路径 ≤ 预算 ≤ 30.5s；memory 路径即时完成式确认（时延形状不变）；链预算画像与现状一致（`MAX_MAX_DIRTY_MS` 立法继续成立，语义从猜测窗变预算窗）；config/main 注释已一致化（DD-7） |
| memory 统一排空被误读为耐久承诺（SA2-7） | 低 | no-hook memory dev 配置中 dispose 清 mirror（冻结语义）⟹ drain 不创造跨实例耐久事实；该边界在 ADR 修订节与 cordis-plugin-hosting 指引中显式声明（DD-8(1)/(4)）；S-5c 只锚定契约形状（drain 先于 dispose）不锚定耐久；成本 ≈ 0（内置 memory 配置 drain 即时 resolve，无外部 I/O 失败面，B20） |
| ADR 0006 修订节与 :34「不设外部协调器」的边界解释 | 低 | 修订节显式申明：drain = 归档 settle 范式的一次性公开化，非周期协调器；回退窗内调度仍内部唯一；宿主预算 =「插件停止」的宿主侧映像（硬契约与 :34 不冲突） |
| rollback | — | 全 additive；逐文件 revert，无迁移 |

**残余 / follow-up（非本任务必要条件）**：(1) DSH 记录头携带 retryDelayMs 的 golden 立法（DD-6 冻结）；(2) yjs-server 配置面暴露 `retryDelayMs`（含与排空预算的联动再立法）；(3) nomic-server 仓库外替换固定睡眠（消费方自行；硬契约指引经 cordis-plugin-hosting.md 传达）；(4) archive×delete 既有理论挂起的系统性测试（DD-5b 已修实现面，专项回归测试可后续补）。

## 14. 评审修订映射

### 14.1 iteration 0 → iteration 1（历史轮；SA2 iteration 1 评审已逐条复核落实，见 `task_issue-412_sa2_review.md` §13.1）

| Finding | 修订位置 | 处理结果 |
| --- | --- | --- |
| **SA2-1（MAJOR）**：DD-7 无预算 `await adapter.drain()` 击穿「排空窗上界 < 60s watchdog」不变量；`MAX_MAX_DIRTY_MS` 保留论证在 degraded store 下为假命题；与同文件 REST 有界排空先例分叉无理由 | §1 目标 3/非目标、§3 能力缺口 3、§7 DD-7 全节重写（路径 (a)：`awaitDrainWithBudget` race + 预算事件 + 有损继续；预算推导取舍与四个否决备选；config.ts/main.ts 注释一致化——main.ts 移入 ALLOW）、§8 L4、§9、§10、§12 S-5a/S-5b、§13 风险表 | 已落实（SA2 复核确认：路径 (a) 全文一致化、S-5b 锚定 degraded store 停机、REST 先例分叉消除） |
| SA2-2（MINOR）：「drain 不早退于新 ACK 的脏状态」过强；应精确为静息观察点结算 + 并发写者边界 | §7 DD-5 返回语义、§8 状态机末行、§12 S-2、§13 风险行 4 | 已落实（SA2 复核确认） |
| SA2-3（MINOR）：「永不 reject」与 File unsafe target loud 拒绝并置自相矛盾 | §7 DD-5 失败面、§9 错误节 | 已落实（SA2 复核确认） |
| SA2-4（MINOR）：`lifecycle.ts:96-98` 字段注释未列入预期改动 | §7 DD-5b 附带、§11 ALLOW（lifecycle.ts 行） | 已落实（SA2 复核确认） |
| SA2-5（MINOR）：CONTEXT.md 词条补 `_Avoid_` 行 | §7 DD-8 (2)、§11 ALLOW | 已落实（SA2 复核确认） |
| SA2-6（MINOR）：SA6 两份契约测试文件应零触碰 | §7 DD-4、§11 DENY（新增条目） | 已落实（SA2 复核确认） |
| SA2 §14-6（信息性）：非 live cell 排除裁决建议随 DD-8 存档 | §7 DD-8 (1) | 已采纳（SA2 复核确认） |

### 14.2 iteration 1 → iteration 2（本轮：SA2 review iteration 1，verdict reject——1 × MAJOR（SA2-7）+ 4 × MINOR）

| Finding | 修订位置 | 处理结果 |
| --- | --- | --- |
| **SA2-7（MAJOR）**：DD-7「memory 路径不引入 drain（`kind==='file'` 守卫保持）」vs DD-8(1) ADR 停机硬契约条款（无条件「宿主 dispose 前必须先 await drain」）vs DD-8(4) cordis-plugin-hosting 指引（「file/memory adapter 在 dispose 前先 await adapter.drain()」）——三处文本对「memory 停机是否先 drain」给出三个互斥答案，恰是 Owner 明令避免的「契约与实现脱节」在硬契约条款文本上的预演 | §7 DD-7(1)（**`kind==='file'` 守卫删除 + 统一代码块 + plugin 句柄两 kind 统一 + 「memory 路径统一排空」bullet（四点技术依据）+ SA2-7 备选 (a) 否决论证）、§7 DD-8(1)（硬契约条款**保持无条件** + 适用面申明：不以 adapter 类型特判，契约边界 = 配置的 store 面）、§7 DD-8(4)（file/memory 指引与 app 实现同答案 + degraded 预算措辞限定 + 示例代码块）、§1 目标 3、§2 B19/B20、§4.1、§5、§6 D10/D11、§7 DD-7(2)(3)(4)、§8 L4、§10、§11 ALLOW、§12 S-5c、§13 风险表 | **已落实——按本轮 dispatch 指令选定 SA2-7 路径 (b)（统一调用）**：「make the hard drain-before-dispose contract consistent for the yjs-server memory path as well as the file path, while retaining the bounded graceful-shutdown behavior and required evidence」。DD-7 / DD-8(1) / DD-8(4) 三处文本对 memory 路径零矛盾（均要求且执行 drain-before-dispose）；S-5a/S-5b（file 路径预算与证据）不受影响；新增 S-5c memory 停机验收行（drain 恰一次且严格先于 `persistence-disposed` + stop 正常返回）——满足 SA2 §13.2 acceptance 全部条件 |
| SA2-8（MINOR，非阻断）：词表条目建议加条件性注记（该词表现有条目多为阶段必发事件） | §7 DD-8(3)（「仅停机排空预算耗尽时发射（健康 store 排空完成式返回，不发射）」）、§11 ALLOW | 已采纳 |
| SA2-9（MINOR，非阻断）：cordis-plugin-hosting.md:450-466 示例代码块当前无 drain，应一并加有界 drain 步 | §7 DD-8(4)（示例代码块插入「`await adapter.drain()`（有界等待，预算尽记录后继续）」）、§11 ALLOW | 已采纳 |
| SA2-10（MINOR，非阻断）：ADR :86 修订措辞应为「修订/扩展 :86 定义边界」而非「重申」（issue-#79 修订节惯例） | §7 DD-8(1) dispose 对齐条款（「本节**修订并扩展** :86 的 dispose 定义边界」）、§4.1 行 2 | 已采纳 |
| SA2-11（MINOR，非阻断）：§4.1 缺 Owner 第三窗口（degraded retry 回退窗）traceability 行 | §4.1 新行（第 4 行） | 已采纳 |

## 15. 是否需要设计后 ADR 冲突复查

**需要（`requiresConflictRecheck: true`）**。理由：

1. SA8 设计后复查（iteration 0）已判 `requiresConflictRecheck: true`，且其 evolution-required 两项（D1 公开 drain、D8 schedule 新键）的修订计划在本轮**扩大**：DD-8 新增停机硬契约条款、dispose 对齐条款与两份集成文档（hub-peer-deployment / cordis-plugin-hosting）触碰——均属规范文档演进面，需实现后核对实际落地。
2. 本轮修订（iteration 1）在 iteration 0 之上变更消费方停机语义（新增 `persistence-drain-budget-exceeded` 事件 + 预算组合）与宿主契约表述（cordis-plugin-hosting.md 硬契约指引）——公共事件面与宿主拆卸契约变化，落在 SA8 D10/D13 既往评估的邻接面，应随实现复查闭合。
3. 公共 API 变化（`DocPersistence.drain?` + barrel 新类型导出）、生命周期/状态机新入口语义（vacuous-after-dispose、无预算、并发重入）与驱逐点通知面补全（DD-5b）、持久化配置语义（`PersistenceSchedule.retryDelayMs?` + 解析形状）——与 iteration 0 相同的复查理由维持。
4. 前置门禁产物（relevant_decisions / conflict_report）缺失的状况未变（本任务的 SA8 产物为设计后复查报告），skill 规则要求标记复查。
5. iteration 2（SA2-7 修订）把消费方停机语义统一到 memory 路径（memory 配置停机新增 awaited-drain 等待步 + `persistencePlugin` 句柄覆盖两 kind）并扩展 ADR 0006 修订节与两份集成文档的硬契约措辞——落在第 1/2 条已标记的「ADR 修订节落地 + 宿主契约表述 + 消费方停机语义」复查面内（SA2 iteration 1 评审已裁定 SA2-7 不引入新的 ADR 冲突维度；§6 D10/D11 行的 memory 表述已同步细化）。
