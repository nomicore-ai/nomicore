# SA4 Implementation Review — issue #412（persistence 公开完成式排空 `drain()` + `retryDelayMs` 解耦 + 停机硬契约）

- 任务：issue #412（iteration 0 implementation review）
- Worktree：`/home/wangjian/nomicore-fix-issue-412`（分支 `mabf/issue-412`，HEAD `c3f7bd9`）
- 审查对象：SA3 实际实现 + 测试（13 文件修改 + 2 新增测试文件；diff 全量核对）
- 适用 Owner 要求：Issue comment ID `5751613018`，updated `2026-09-20T18:03:36Z`（MEMBER）——`gh api` 独立拉取全文核对（见 §3）
- 审查纪律：静态实现审查（未运行测试/未启动服务/未修改实现；`npx vitest list` 仅做 runner 发现枚举，不执行用例）

## 1. Reviewed inputs

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| `wiki/raw/task_issue-412.md` | 已读 | Issue 正文（缺口 1/2、请求面、消费方证据） |
| Issue #412 正文 + comment 5751613018（`gh` 只读拉取） | 已读 | Owner 硬契约 + ADR-0006 对齐 + 分层 drain + 第三击穿窗口 + 问题 2 解耦确认；评论 updated_at 与 dispatch 一致（2026-09-20T18:03:36Z，MEMBER），无更新版本 |
| `wiki/raw/task_issue-412_design.md`（iteration 2，558 行） | 已读 | 批准设计：DD-1~DD-8、§8 状态机、§11 ALLOW/DENY、§12 验收映射 |
| `wiki/raw/task_issue-412_sa2_review.md` | 已读（§2 verdict approve / §13 修订映射） | SA2-1~SA2-13 落实核对基准 |
| `wiki/raw/task_issue-412_sa6_contract.md` | 已读（§5/§8/§13/§15） | 契约项 C1–C14、红灯归因、D-5 语义缺口（S-1~S-4）、冻结审计裁决 |
| `wiki/raw/task_issue-412_design_conflict_report.md` | 已读（O1–O3 + D1–D19 + 行动 1–7） | SA8 约束：同变更集、缺省不物化、注释诚实性、liveness 不变量 |
| `wiki/raw/task_issue-412_sa3_impl.md` | 已读 | 实现报告（changed paths / 验证命令 / deviations） |
| 源码 diff：`packages/persistence/src/{contract,lifecycle,memory,file,index}.ts`、`packages/dsh-persistence/src/probe.ts`、`apps/yjs-server/src/{app,config,main}.ts`、四份文档 | 逐行核对 | 实现保真 |
| 测试：SA6 两契约文件 + 新增 `persistence-issue-412-drain-semantics.test.ts`（9 tests）+ `persistence-drain-shutdown.test.ts`（3 tests）+ 既有锚（ordered-shutdown-red / lifecycle-watchdog-red / app-config-red / persistence-contract） | 逐行核对 | 测试质量与触发面 |
| Git 状态（`git status --porcelain`、`git diff --stat`、`git show HEAD:domains/...`） | 只读核对 | 文件范围 + 既有失败归属 |
| `vitest.config.ts`、`.github/workflows/ci.yml`、`packages/persistence/AGENTS.md`、`apps/yjs-server/AGENTS.md` | 已读 | runner/CI 触发与模块验证门 |

缺失输入：`task_issue-412_relevant_decisions.md`、`task_issue-412_conflict_report.md` 不存在（设计 §0 已声明；SA8 设计后复查报告承担该职责）——不阻断本次实现审查。

## 2. Verdict

**approve**（0 × BLOCKER；0 × MAJOR；4 × MINOR 全部非阻断，见 §10/§12）。

核心判定：实现与 iteration 2 批准设计**逐条忠实**；Owner 三项硬要求（硬契约成文且 app 结构性强制、ADR-0006 :86 修订对齐、分层公开 drain 且 dispose 保持 abortive）全部落地并有行为级测试锚定；SA2-1/SA2-7 两个 MAJOR 修订的验收行（S-5a/S-5b/S-5c）真实存在、断言敏感、被真实 runner 触发；文件范围严格贴合 ALLOW 15 行，DENY 零触碰。

## 3. 上游要求落实

Owner 评论按 Comment ID + updated_at 核对（5751613018，2026-09-20T18:03:36Z，MEMBER——`gh api repos/nomicore-ai/nomicore/issues/comments/5751613018` 全文拉取；该 issue 仅有此一条评论，无更新版本覆盖）。

| Requirement or finding | Implementation evidence | Assessment |
| --- | --- | --- |
| 「把『宿主优雅停机必须先 await drain() 再 dispose』写为**硬性契约**而非参考建议」 | ① ADR 0006 修订节第 3 条（docs/adr/0006-server-persistence-docstore.md:270 起）：无条件条款 + 「预算尽后继续 dispose 是显式可观察退出，不是违约」+ 「未经 drain 直接 dispose 的宿主接受静默丢失」代价申明；② app.ts:604-627：`performStop` 第 3 步在**唯一**的 `persistenceFiber.dispose()`（:630）之前 `await this.awaitDrainWithBudget(adapter.drain(), budgetMs)`，预算尽先发 `persistence-drain-budget-exceeded` 再继续——结构性强制（全仓唯一 dispose 调用点在 drain 之后；main.ts 停机/换装全部经 `app.stop()`）；③ cordis-plugin-hosting.md:64/:455-478 对仓库外宿主的同款硬契约指引 + 示例代码块 | **落实**。条款、对外指引、自家实现三方同答案；S-5c 以原型 spy 锚定 drain 恰一次且严格先于 `persistence-disposed` |
| 「同步修订 ADR-0006 :86 对 dispose 的现有定义——否则契约与实现继续脱节」 | ADR 修订节第 4 条：「本节**修订并扩展** :86 的 dispose 定义边界」（:86 原文「释放文件句柄、后台任务和 Y.Doc 缓存」经 `sed -n '80,92p'` 核实）——dispose 保持 abortive/有损、从来不是持久性屏障（§228-5 重申）、「dispose 前的持久性」唯一经分层 drain 表达；约束性修订语气（SA8 O2 要求），非信息性重申 | **落实**（SA2-10 措辞采纳） |
| 「可以接受分层方案（公开 drain()，dispose 保持 abortive），但至少需要硬契约 + ADR 对齐」 | `DocPersistence.drain?` optional 分层成员（contract.ts:149-176）；dispose 路径零改动（lifecycle.ts dispose 段仅把内联 waiter 通知抽为 `releaseSettleWaiters`，行为逐字节等价）；DD-7 备选 (iii)「dispose 内部先 drain」否决论证入 ADR 第 4 条 | **落实**（分层保持） |
| 第三个击穿窗口：degraded entry 的 retry 回退窗（backoff 上限 maxDirtyMs） | drain 对 `retryTimer` 武装只注册 waiter 被动等待（lifecycle.ts:866-869），零热循环（1f：attempts 恒 1 锚定）；宿主预算覆盖回退窗（S-5b：预算 520ms 内收口 + 事件）；§4.1 traceability 行已在设计落实（SA2-11） | **落实** |
| 问题 2 解耦属实、独立 `retryDelayMs` 配置（缺省保持现行为） | `PersistenceSchedule.retryDelayMs?`（contract.ts:513-523）+ `resolvePersistenceSchedule` 条件展开（:548-552，校验环 `Object.entries` 自动覆盖新键 → 非法值 RangeError）+ `retryBaseMs` getter 单源（lifecycle.ts:1077-1082）改引 createEntry（:1094）与 flush 成功回落（:1152）两落点；DSH 探针镜像锁步（probe.ts:444-447） | **落实**。缺省 `(undefined ?? debounceMs) \|\| 1` ≡ 旧 `debounceMs \|\| 1`（静态等价；2b/3a 保持绿）；缺省不物化键（SA8 action 2 红线遵守，冻结审计零迁移） |
| Issue 正文请求面（drain 语义 6 条 + 可选 targets + 宿主替换固定睡眠） | 见 §4 设计落实审查表 | **落实** |

SA6 契约承接：C1–C14 全部由 SA6 两份契约文件（27 运行期 + 5 类型）锚定，实现后转绿（SA3 报告 + 断言面静态核验）；S-1~S-4/S-5a/S-5b/S-5c 补充锚全部新增（见 §9）。

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
| --- | --- | --- | --- |
| DD-1 drain 放置面：`DocPersistence.drain?` optional + 两 adapter 具体类方法 + barrel 导出 `PersistenceDrainTarget` + 不进 `ReplicaPersistence` | contract.ts:68-73/:149-176；memory.ts:189-194；file.ts:149-159；index.ts:37；ReplicaPersistence 零改动 | 忠实。File 入口 targets 逐个 `validateIdentity`（`targets === undefined` 无校验路径），错误文案 `/unsafe userId\|namespaceId/` 与 assertSafePathSegment 一致（file.ts:257-262） | — |
| DD-2 retryDelayMs 键形状不变（缺省回退在 lifecycle 内） | contract.ts:545-552 条件展开；lifecycle.ts:1077-1082 getter | 忠实。`persistence-contract.test.ts:32-37` 两键 `toEqual` 零改动即绿（键缺席时无第三键）；probe 默认时间线逐字节不变（静态等价推导） | — |
| DD-3 optional 类型建模 | contract.ts:513 | 忠实；`TEST_SCHEDULE` 两键字面量零迁移 | — |
| DD-4 目标集合形状 `targets?: readonly PersistenceDrainTarget[]`；`[]`=no-op；缺席 target=no-op | lifecycle.ts:841-843 scope Set；S-4 双锚 | 忠实，与 SA6 契约临时形状逐字段一致 | — |
| DD-5 drain 语义与状态机（§8 骨架逐行） | lifecycle.ts:840-879——`closed` 早退（vacuous）/ 非 live 跳过 / 回退窗+在途被动等待（仅注册 waiter）/ idle-脏强制 `startFlush` / 干净跳过 / `Promise.all` 屏障后重扫 | **逐行一致**（含注释）。扫描段同步完成 waiter 注册（错过通知窗为零——单线程内 check-then-push 原子）；`startFlush` 同步置 `flushing=true` 后才遇首个 await ⟹ 注册的 waiter 必被该 flush finally 释放 | — |
| DD-5b 驱逐路径通知面补全（4 处移除点） | `releaseSettleWaiters`（lifecycle.ts:1227-1230）+ 四调用点：settleEntryForDelete 驱逐腿（:679）/ settleEntryForArchive 干净驱逐腿（:709）/ dispose 同步段（:831，替代原内联 splice+call）/ maybeEvict（:1195） | 忠实。live-entry 移除点全集枚举核对：其余 `cells.delete`（:355 creating、:566/:573 archiving、:629/:635 deleting、:989-1010 reading）均作用于非 live claim cell——drain waiter 只注册在 live entry 上，不可达 ⟹ 枚举完备（SA2 SM-4 结论复核成立） | — |
| DD-6 DSH 探针锁步 + 记录头冻结 | probe.ts:444-447 一行镜像 + 注释；record.ts/events.ts/profile.ts/cli.ts 零改动（git status 核实） | 忠实 | — |
| DD-7(1) app 停机第 3 步预算组合 drain，file/memory 统一 | app.ts:297-312（两分支统一保留 plugin 句柄）、:618-627（`kind==='file'` 守卫删除；file 预算 = `schedule?.maxDirtyMs ?? DEFAULT_MAX_DIRTY_MS` + 边距，memory = 缺省 5_500）、:547-568（`awaitDrainWithBudget` tagged-outcome race + timer 早清，镜像 rest-hosting 先例） | 忠实。boot 窗口 `instance === undefined` 跳过（F2）；工厂 `instance` 在 `apply` 内赋值（file.ts:274-285）——`ctx.plugin()` 同步调 apply ⟹ 停机时句柄可达 | — |
| DD-7(2)(3)(4) config/main 注释刷新 + 停机时序 | config.ts:13-44/:278（拒绝文案 parenthetical 更新，`persistence.schedule.maxDirtyMs` 路径段保持——app-config-red:299 与 lifecycle-watchdog-red:122 只钉路径段，零破坏）；main.ts:96-103 仅注释 | 忠实，行为零变化 | — |
| DD-8(1) ADR 0006 修订节 7 条 | docs/adr/0006...md:242-282：接口契约 / drain 语义（静息观察点 + 并发写者边界 + `[]` no-op + File 校验例外）/ 停机硬契约（无条件 + 适用面 store 面 + :34 关系 + 实施注记）/ dispose 对齐（修订并扩展 :86）/ retryDelayMs 解析形状 / 排空通知面不变量 / 非 live cell 排除存档 | 忠实——Owner O1/O2、SA8 D1/D8/D15/O3 全部落入成文条款 | — |
| DD-8(2)(3)(4) CONTEXT 词条（含 `_Avoid_`）/ hub-peer 词表+停机序 / cordis-plugin-hosting 硬契约+示例 | CONTEXT.md:139-142；hub-peer-deployment.md:36-46/:277-289（条件性注记 SA2-8 + memory 缺省预算括注 SA2-13）；cordis-plugin-hosting.md:64/:98-133/:455-478（示例加有界 drain 步 + 句柄保留说明） | 忠实 | — |
| 备选实现核对（SA3 deviations 1-3） | S-5a/S-5b 夹具参数替换（确定性构造）、S-5b `elapsedMs>=500`/tmpPath 强化断言、`releaseSettleWaiters` 抽方法 | 均为等价实现选择，非语义偏离；设计 §12 S-5b 明文允许机制等价替换 | — |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
| --- | --- | --- | --- |
| drain 状态机（扫描/强制 flush/等待/重扫） | `PersistenceLifecycle`（ADR 0006:157-159 lifecycle core 共享） | lifecycle.ts 单点；Memory/File 纯委派（memory.ts:189-194、file.ts:149-159） | 正确——无状态机复制 |
| drain 的 targets 输入校验 | File adapter（路径安全事实所有者） | file.ts:151-154 `validateIdentity`（与其余公开入口同款） | 正确 |
| 停机预算与诚实事件 | 宿主组合层（app） | app.ts `awaitDrainWithBudget` + 事件；库级 drain 无预算参数 | 正确（分层与 Owner 评论一致） |
| retry 基准单源 | lifecycle（调度事实所有者） | `retryBaseMs` getter，两落点共用 | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
| --- | --- | --- | --- | --- |
| 有界停机排空 | REST `restHost.drain(REST_DRAIN_BUDGET_MS)`（app.ts:92-96/:591；rest-hosting tagged-outcome race + timer 早清） | `awaitDrainWithBudget` 同款纪律（进程级 setTimeout、早清、败者续体语义文档化） | 一致（有意差异已注释：app 不 abort drain——drain 非破坏性，abort 等价物是随后的 dispose） | 复用既有纪律而非新造机制 |
| 私有强制排空先例 | `settleEntryForArchive`（lifecycle.ts:698-720） | drain 与之同构、去掉归档前置/驱逐腿、去掉 `handles.size>0` 拒绝 | 一致（泛化，非复制） | 同一 waiter 通知面 + 同一 startFlush |
| degraded 回退窗尊重 | `scheduleRetry`/ADR 0006:195 | drain 被动等待（注册 waiter） | 一致 | 退避仍是唯一调度源 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
| --- | --- | --- | --- |
| entry 结算完成 | flush finally 通知点 1 / dispose 通知点 2 / 4 处驱逐释放（`archiveWaiters` 单通知面） | drain/settleEntryForArchive/settleEntryForDelete 共同消费 | 无——未引入第二套 waiter/事件机制 |
| retry 首基准 | `schedule.retryDelayMs ?? debounceMs`（`retryBaseMs` 单 getter） | entry.retryDelayMs（运行态） | 无——两落点（初始化/成功回落）均改引单源 |
| 排空预算 | `maxDirtyMs + DRAIN_MARGIN_MS`（配置推导） | 事件载荷 budgetMs | 无——零新增配置键（镜像 REST_DRAIN_BUDGET_MS 纪律的设计裁决） |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
| --- | --- | --- | --- |
| drain 不获取任何资源（无 abort/destroy/清定时器/驱逐） | 无对应释放义务；宿主预算 timer 一次性早清 | 败者 drain 续体由 dispose 通知点 2 收口（vacuous resolve，零 unhandled rejection——store 失败面永不 reject） | 对称（additive 能力，无新资源） |
| plugin 句柄获取（boot 两分支统一赋值） | 句柄随 app 实例生命周期；instance 经 `get instance()` 只读 | boot 窗口 undefined → 停机跳过（F2，与 restHost/diagnostics 同款 optional 纪律） | 对称 |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
| --- | --- | --- | --- |
| 第二套 cleanup/retry loop | lifecycle 内部退避 | drain 复用（不新造重试） | 无平行 |
| 第二拆卸链 | `performStop` 单链 | drain 是链内等待步（diagnostics-closed 与 persistence-disposed 之间），`stop()` single-flight 不变；S-5c 二次 stop 断言 drain 恰一次 | 无平行（apps AGENTS 纪律保持） |
| 第二事件通道 | stdout NDJSON sink | 新事件走同一 sink（`{event, budgetMs}`，脱敏合规——纯数值） | 无平行 |

## 6. 文件范围审查

`git status --porcelain` + `git diff --stat` 核对（13 修改 + 2 新增测试 + wiki 过程产物 untracked）：

| Changed path | ALLOW entry | Purpose | Assessment |
| --- | --- | --- | --- |
| `packages/persistence/src/contract.ts` | ✅ 行 1 | DD-1/2/3/4/5 类型与解析 | 贴合 |
| `packages/persistence/src/lifecycle.ts` | ✅ 行 2 | drain + retryBaseMs + 4 处驱逐通知 + 字段注释（SA2-4） | 贴合 |
| `packages/persistence/src/memory.ts` | ✅ 行 3 | drain 委派 | 贴合 |
| `packages/persistence/src/file.ts` | ✅ 行 4 | drain 委派 + targets 校验 | 贴合 |
| `packages/persistence/src/index.ts` | ✅ 行 5 | barrel `type PersistenceDrainTarget` | 贴合 |
| `packages/dsh-persistence/src/probe.ts` | ✅ 行 6 | 退避镜像一行 | 贴合 |
| `apps/yjs-server/src/app.ts` | ✅ 行 7 | 第 3 步 + 句柄 + 助手 + 事件 + 注释 | 贴合 |
| `apps/yjs-server/src/config.ts` | ✅ 行 8 | 注释 + 拒绝文案 parenthetical（行为零变化） | 贴合 |
| `apps/yjs-server/src/main.ts` | ✅ 行 9 | 仅注释 | 贴合（diff 核实无行为行） |
| `docs/adr/0006-server-persistence-docstore.md` | ✅ 行 10 | 修订节 7 条（+42 行） | 贴合 |
| `CONTEXT.md` | ✅ 行 11 | 词条 + `_Avoid_` | 贴合 |
| `docs/integration/hub-peer-deployment.md` | ✅ 行 12 | 词表 + 停机序 | 贴合 |
| `docs/integration/cordis-plugin-hosting.md` | ✅ 行 13 | 硬契约 + 示例 | 贷合 |
| `packages/persistence/test/persistence-issue-412-drain-semantics.test.ts`（新增） | ✅ 行 14（建议新增） | S-1~S-4 | 贴合 |
| `apps/yjs-server/test/persistence-drain-shutdown.test.ts`（新增） | ✅ 行 15（建议新增） | S-5a/S-5b/S-5c | 贴合 |
| `wiki/raw/task_issue-412_sa3_impl.md`（untracked） | 过程产物（SA3 自有报告） | — | 不属实现范围 |

DENY 零触碰：`service.ts`/`testing.ts`/`namespace-registry/**`/dsh `record|events|profile|cli.ts`/既有 persistence 测试（含冻结审计四组）/SA6 两契约文件/`apps/yjs-server/test/` 既有测试/`docs/protocols/**`/`ws-replication/**`/上游 wiki 产物——`git status` 全部干净。ALLOW 中未修改的路径：无（15 行全部兑现）。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
| --- | --- | --- | --- | --- |
| `DocPersistence.drain?` 新 optional 成员 | 第三方实现/13 stub/wrapIo 字面量 | optional ⟹ 编译零破坏；surface 测试 `legacyThreeMemberAdapter` 三成员字面量保持绿（类型锚实测面） | 无 | — |
| `PersistenceSchedule.retryDelayMs?` | `Partial<PersistenceSchedule>` 消费方（两 adapter options、DSH profile） | 自动获得可选键；app 配置面有意不暴露（设计非目标，config 词表两键闭集不变） | 无 | — |
| 新事件 `persistence-drain-budget-exceeded{budgetMs}` | stdout NDJSON 消费方/运维 | additive；hub-peer-deployment 词表已同步（含条件性注记）；既有 findIndex 严格递增锚（ordered-shutdown-red:77-91）对词表新增免疫（源码核实断言形状） | 无 | — |
| yjs-server 停机链 callers（SIGTERM/SIGINT/SIGHUP/fatal-exit） | main.ts 全部经 `app.stop()` | 预算内必然返回 ⟹ watchdog 退居兜底；换装注释已刷新 | 无 | — |
| registry shutdown → drain 前置 | `namespace-registry` | 零改动（SA8 D12）；lease 全释放后无并发写者——drain 静息观察点边界由链路前置条件关闭（ADR 条款 2 明示） | 无 | — |
| `MemoryPersistence.prototype.drain` 原型面 | S-5c spy / 仓库外宿主 | barrel 公开导出（index.ts:48-56 既有）；vitest alias 同映射 ⟹ 单模块实例 | 无 | — |
| DSH golden 消费方 | determinism/acceptance 测试 | 缺省时间线逐字节不变（静态等价：`(undefined ?? debounceMs) \|\| 1`） | 无 | — |

## 8. 错误、恢复与并发

- **drain 失败面**：store 失败沿既有 degraded + 内部退避吸收（flush catch → scheduleRetry），drain 永不因 store 失败 reject——源码核对（lifecycle.ts:1148-1157 无 rethrow；waiter 由 flush finally 无条件释放）。File unsafe target 的 loud `Error` 是文档化例外通道（SA2-3 申明，S-4 专项锚定）。
- **静默失败检查**：预算尽路径**不静默**——事件先于有损 dispose（S-5b 断言 `budgetIndex < indexOf('persistence-disposed')` 且 `budgetMs === 520`）；app-stop-failed 计数为 0 断言排除伪装。dispose 有损语义保持（S-1/0a/0b 锚定「丢失仍发生且可预期」）。
- **并发/竞态静态核验**（重点攻击面，均通过）：
  - 扫描-注册原子性：drain 扫描为同步块，check-then-push 无交错窗；`startFlush` 同步置 `flushing` ⟹ 注册 waiter 必被释放；
  - 双 flush：`startFlush`/`flush` 双门 + armed 的陈旧 debounce/maxDirty 到点经 `flushing`/干净守卫早退（零 write）——1a 第二段（attempts 恰 2）与 1g（attempts 恒 3）锚定；
  - 驱逐×drain 挂起：4 处移除点全部 `releaseSettleWaiters`（S-3 行为锚定 deleteDoc 交错）；
  - dispose×drain：通知点 2 + `closed` 早退 → vacuous resolve（S-1）；
  - 等待期再脏：屏障后重扫强制 flush（S-2：attempts=2、内容 99）；
  - 单飞/幂等：多次 drain 各自成环（1a→1e 连续调用 attempts 精确递增）；`stop()` single-flight（S-5c 二次 stop drain 恰 1 次）；
  - 终止性：每 waiter 由通知点 1/2 或驱逐释放；停机上下文（lease 全释放）有界——与设计 §8 论证一致。
- **进程重启/事务中断**：drain 不改持久化格式与提交点（复用 `io.write`，rename 提交语义不变）；S-5b「新实例见旧 committed 快照 + tmp 目录仍在」诚实锚定有损边界。
- **静态无法完全确认项**：真实慢盘下 30.5s 预算的充分性、nomic-server（仓库外）采纳——列入 §11。

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
| --- | --- | --- | --- | --- |
| SA6 `persistence-issue-412-drain-red.test.ts`（27 tests：§0 4 / §1 14 / §2 6 / §3 3） | 0a/0b 缺口正复现（dispose 有损保持）；1a-1g drain 全语义（强制 flush 零推进、在途不早退零重复、负控零 write、零 handle、subset、回退窗不热循环、三 key 并发）；2a/2b/2c retry 基准/缺省/退避 cap；3a-3c 保持性 | root `pnpm test` 分片（`packages/*/test/**/*.test.ts`）+ SA6/设计 §12 显式命令；`vitest list` 枚举确认发现 | 无 skip/only/todo（grep 核实）；「临时形状」注释保留（SA2-6 零触碰——文件 untracked 无 git 基线，以 SA6 契约清单 27+5 与 DD-4 逐字段形状抽验一致为证；此为静态可验证上限，如实记录） | — |
| SA6 `persistence-issue-412-drain-surface.test-d.ts`（5） | 类面 drain / schedule 键 / 三成员字面量 / 实现关系 | CI typecheck 作业 `vitest run --typecheck.only`（`packages/*/test/**/*.test-d.ts` include） | 无 | — |
| 新增 `persistence-issue-412-drain-semantics.test.ts`（9） | S-1 vacuous；S-2 等待期再脏重扫；S-3 驱逐释放 waiter（含 advanceBy(1_000_000) 无复活）；S-4 `[]`/缺席/全量 + File unsafe target `/unsafe userId\|namespaceId/` | 同上 root 分片 | 双 adapter 矩阵；withTimeout 全覆盖；零源码字符串断言 | — |
| 新增 `apps/yjs-server/test/persistence-drain-shutdown.test.ts`（3） | S-5a 完成式（elapsed<450 ≪ 预算 5500 + 新实例见 77 + 无预算事件 + 四事件序）；S-5b 预算内收口（elapsed≥500、budgetMs=520、事件先于 dispose、旧快照可观察、tmp 仍在）；S-5c drain 恰一次且 eventsBefore 不含 persistence-disposed、二次 stop 幂等 | root 分片（`apps/*/test/**/*.test.ts`）+ app 套件命令 | 真实组合根 + 真实 fs；EISDIR 注入确定性（首重试 1000ms > 预算 520ms，无 timing 竞争）；夹具参数偏离设计示例属设计明文允许的等价替换 | MINOR-3（450ms 墙钟上界的 CI 慢机 flake 余量，见 §12） |
| 既有锚（ordered-shutdown-red / lifecycle-watchdog-red / app-config-red / persistence-contract / dsh determinism） | 四事件序 / 配置边界 / 冻结审计 / golden | 既有入口不变 | 全部零改动即兼容（拒绝文案只改 parenthetical、路径段保持——两测试断言形状源码核实） | — |

**SA6 红灯保持**：契约两文件未被弱化（断言面与 SA6 契约 §13 归因清单一一对应；无断言删除迹象——文件结构与 SA6 描述的 27+5 及各 § 编号完整一致）。**Mutation 敏感性**：SA3 报告三项反证（删除 delete 驱逐通知 → S-3 红；恢复 file 守卫 → S-5c 红；恢复固定睡眠 → S-5a/b/c 红）——静态核验其可 distinctions 性成立（S-5c spy 计数、S-5a withTimeout 对实现形状微分敏感）；运行级复现列入 §11 交由后续动态验证。

## 10. Required revisions

无 BLOCKER / MAJOR finding。（MINOR 项不阻断 approve，见 §12。）

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
| --- | --- | --- | --- |
| SA3 报告的验证命令与 mutation 反证的可复现性（本审查未运行测试） | 后续验证角色按设计 §12 Runner 命令 + SA3 mutation 清单复跑 | 221/242/182 切片全绿；三项 mutation 分别使 S-3/S-5c/S-5a-c 变红后恢复 | 任一 mutation 下对应测试仍绿（= 断言不敏感）或切片出现新红 |
| 真实慢盘/高并发下 `maxDirtyMs + 500ms` 预算的充分性（消费方实测 io.write ≈ 2.2s 未证实） | 部署环境停机画像观测 | 健康 store 停机无 `persistence-drain-budget-exceeded`；事件出现率可告警 | 健康 store 频繁触发预算事件（预算推导需再立法） |
| 仓库外宿主（nomic-server）按 cordis-plugin-hosting 硬契约替换固定睡眠 | 消费方仓库 | `FILE_PERSISTENCE_DRAIN_MS` 移除、`drain()` + 自有预算上线 | 消费方继续固定睡眠（文档指引未被采纳——非本仓缺口） |
| S-5a `elapsedMs < 450` 在极慢 CI 上的稳定性 | CI 长期运行记录 | 无偶发红 | 偶发超时红（建议放宽至预算比例上界，如 < 预算/2） |
| `drain()` 与 `createDoc`/`importDoc` claim 环交错（非 live cell 排除已立法，但无专项行为测试） | 可选补充测试（设计 §13 follow-up 同族） | claim 完成后新 live 脏 entry 由下一次 drain 覆盖 | 出现 waiter 挂起或漏排空 |

## 12. Non-blocking observations

| # | 严重度 | 观察 | 建议处置 |
| --- | --- | --- | --- |
| N-1 | MINOR | `apps/yjs-server/AGENTS.md` 单一拆卸链摘要行（「…registry shutdown → diagnostics close → persistence dispose → timer/clock teardown」）未列新增的排空等待步——陈述仍真（drain 是链内等待非拆卸动作），但未逐字反映硬契约步；该文件不在设计 ALLOW（SA3 已记录为文档债） | 后续文档变更集顺带补一句；不要求本任务返工 |
| N-2 | MINOR | `awaitDrainWithBudget`：若 drain promise reject（设计判定结构性不可达——adapter 契约违约级 bug），`await Promise.race` 抛出使 `clearTimeout` 被跳过，预算 timer（≤30.5s）残留至自然到点；fail-loud 路径（app-stop-failed → exit(1)）不受阻 | 可改 try/finally 包裹 race 以早清 timer；非本任务必要 |
| N-3 | MINOR | S-5a 的 `elapsedMs < 450` 墙钟断言在极慢 CI 单次 fs write+rename 可能偶发击穿（预算 5500ms、withTimeout 3000ms 均不受影响，仅「远小于」上界敏感） | 观察 CI 稳定性后酌情放宽（见 §11 行 4） |
| N-4 | MINOR（design 侧） | SA2-12：设计文档对 SA8 报告的计数/traceability 停留在旧版（SA1 产物，不在 SA3 ALLOW；SA3 已如实记录移交） | 路由 `design`（SA1/Controller 文本修订），不影响实现正确性 |
| N-5 | 观察 | `flush()` finally 的通知点 1 保留内联 `splice(0)+call` 而未调用 `releaseSettleWaiters`（行为逐字节等价；统一方法覆盖的是四处**移除点**） | 纯风格项，无需处置 |

## 13. 复查标记

`requiresConflictRecheck: true` 维持（设计 §15 五项理由未变：公共 API 新成员、事件面新增、ADR 0006/两集成文档修订、驱逐点通知面补全、schedule 配置语义——均待 SA8 实现后复查闭合；本审查未发现新的 ADR 冲突维度）。
