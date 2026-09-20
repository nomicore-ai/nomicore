# SA10 Spec Review — issue #412（persistence 公开完成式排空 `drain()` + `retryDelayMs` 解耦 + 停机硬契约）

- 任务：issue #412（spec-review，iteration 0；dispatch `sa-2cf05a4a-8931-4f38-a72e-35048838f4b6`）
- 审查对象：**最终已提交 diff** `c3f7bd9..1fef434`（HEAD `1fef4348dad49eb6c2891ca48d89013974b5b952`「feat(persistence): add completion drain lifecycle」；权威基线 = dispatch 指定的 `main@c3f7bd9e474d465e95e870def353a65c70363076`，与本地解析一致）
- 适用 Owner 要求：Issue comment ID `5751613018`，updated `2026-09-20T18:03:36Z`（MEMBER）——**本次审查经 `gh api repos/nomicore-ai/nomicore/issues/comments/5751613018` 独立拉取全文核对**（该 issue 仅此一条评论，无更新版本覆盖）；dispatch 转述（hard graceful-shutdown drain-before-dispose 契约 + ADR-0006 对齐）与原文一致
- 审查纪律：静态 spec 审查（未运行测试、未启动服务、未修改任何代码/设计/测试；运行期绿证据采用 SA3 申报 + SA4 静态核验 + 本审查的源码-断言对应核对）

## Verdict

**approve**（0 × BLOCKER / 0 × MAJOR；5 × MINOR 全部非阻断，见 §6；PR 必须披露项见 §7）。

核心判定：issue 正文全部请求面、Owner 评论 5751613018 全部要求、SA6 验收契约 C1–C14 与补充锚 S-1~S-4/S-5a/S-5b/S-5c，在最终提交 diff 中**逐项忠实落地**；ADR-0006 对齐（修订节 7 条 + :86「修订并扩展」）与停机硬契约在**规范条款、对外指引、自家实现（file/memory 统一）、验收证据**四方同答案；文件范围严格贴合设计 ALLOW 15 行，DENY 零触碰，无 scope creep。

## 1. Reviewed inputs

| 输入 | 状态 |
| --- | --- |
| Issue #412 正文（`gh issue view 412` 独立拉取；与 `wiki/raw/task_issue-412.md` 快照逐字一致） | 已读 |
| Issue comment 5751613018 全文（gh api 独立拉取） | 已读 |
| `wiki/raw/task_issue-412_design.md`（iteration 2，SA2 verdict approve） | 已读（全 558 行） |
| `wiki/raw/task_issue-412_sa6_contract.md`（verdict approve） | 已读 |
| `wiki/raw/task_issue-412_sa2_review.md`（iteration 2 verdict approve） | 已读 |
| `wiki/raw/task_issue-412_sa3_impl.md`、`task_issue-412_sa4_review.md`（verdict approve） | 已读 |
| `wiki/raw/task_issue-412_design_conflict_report.md`（clear）+ `task_issue-412_implementation_conflict_report.md`（**clear，requiresConflictRecheck: false**） | 已读 |
| 提交 diff 全量：`git diff c3f7bd9..HEAD`（13 修改 + 2 新增测试 + wiki 过程产物）逐行核对 | 已读 |
| 现状源码：lifecycle.ts（drain/startFlush/flush/scheduleRetry/maybeEvict/releaseSettleWaiters 四调用点）、contract.ts、memory.ts、file.ts、index.ts、probe.ts、app.ts、config.ts、main.ts | 已读 |
| 测试：SA6 契约两文件（27 运行期 + 5 类型）+ 新增 semantics（9）+ shutdown（3）+ 既有锚文件零触碰 | 已读 |
| `git status --porcelain`（干净）、`vitest.config.ts`（include/alias/typecheck 面）、`apps/yjs-server/AGENTS.md` | 已读 |

## 2. Issue 正文请求面落实（逐条）

| Issue 请求（原文措辞） | 实现证据 | 判定 |
| --- | --- | --- |
| 公开完成式排空入口（「把所有脏 entry 落完盘再退」） | `PersistenceLifecycle.drain(targets?)`（lifecycle.ts:856-879 状态机单点）；`DocPersistence.drain?` optional 成员 + 全语义 doc-comment（contract.ts:149-176）；Memory/File 具体类方法（memory.ts:189-195 纯委派；file.ts:149-159 委派 + targets `validateIdentity`）；barrel 导出 `type PersistenceDrainTarget`（index.ts:37）；静息观察点结算语义（resolve ⟺ 终扫时范围内无脏可推进/在途/回退窗等待） | **met** |
| 对所有 live 脏 entry（含零 handle）立即 `startFlush`（跳过 debounce） | drain 扫描：idle 且脏（`savedGeneration !== dirtyGeneration`，**不查 handles.size**——与私有先例 `settleEntryForArchive` 的 `handles.size>0` 拒绝关键差异成立）→ 直调 `startFlush`（不经 `scheduleFlush`，结构性跳过 debounce/maxDirty 定时器）；契约锚 1a（live handle，零 advanceBy 恰 1 次 write 落盘 n=77）/1d（零 handle 消费方链路）双 adapter | **met** |
| await 全部 settle（复用 `archiveWaiters` 通知面或等价机制） | 复用 `archiveWaiters` 单通知面（通知点 1 = flush finally 无条件 splice+call :1160-1161；通知点 2 = dispose 同步段 `releaseSettleWaiters`）；`Promise.all(pending)` 屏障后重扫；在途 flush 只注册 waiter（single-flight 零重复发起，1b/1g attempts 锚） | **met** |
| 不 abort、不 destroy、不清定时器之外的任何状态 | drain 不触碰 abortController/epoch/closed/doc 生命周期/调度定时器/驱逐面/getStatus 词表（严于请求——定时器也不清；drain 后 armed 陈旧定时器到点经 `flush` generation/干净守卫早退零 write，:1143 守卫源码核实）；C4（1b/1g 提交段真实执行）/C5（1a drain 后续写第二轮落盘 n=88） | **met** |
| drain 返回后 `dispose()` 可以安全立即执行 | 1d/1a（drain → 立即 dispose → 新实例见 77）；S-5a（停机链端到端：stop 远小于预算返回 + 新实例见 77） | **met** |
| 可选参数：只 drain 指定 key 集合 | `targets?: readonly PersistenceDrainTarget[]`（公开 (owner, docId) 词汇；内部 `toKey` :1300 私有）；`targets: []` = no-op；缺席 target = no-op；1e（仅 A 落盘、B 保持脏）+ S-4（边界三形态） | **met** |
| 独立 `retryDelayMs` 配置，缺省保持现行为 | `PersistenceSchedule.retryDelayMs?` optional（contract.ts:513-521）；`resolvePersistenceSchedule` 条件展开（:548-552——键缺席时 resolved 形状不变，既有 `toEqual` 冻结审计零迁移）；`retryBaseMs` getter 单源（lifecycle.ts:1077-1082）改引 createEntry(:1094)/flush 成功回落(:1152) 两落点；显式 0 折叠为 1；非法值经既有 `Object.entries` 校验环 RangeError；时序锚 2a（首重试 t=60_200）/2b（缺省 = 40ms 动态回退）/2c（50/150/350/700 cap 保持）；DSH 探针镜像锁步（probe.ts:444-447，缺省同值 ⟹ golden 零漂移） | **met** |
| 宿主侧把固定睡眠替换为 `await persistence.drain()` | yjs-server 停机第 3 步固定睡眠（旧 app.ts:565-573 `sleep(maxDirtyMs+500)`）整体替换为 `awaitDrainWithBudget(adapter.drain(), budgetMs)`（app.ts:604-627）——完成式等待 + 宿主预算上界（有界化偏差的立法依据见 §3.1，非降格） | **met** |
| 消费方配合（nomic-server 仓库外替换固定睡眠） | 仓库外事项，经 cordis-plugin-hosting.md 硬契约指引 + 示例代码块传达（DD-8(4)）；列为 follow-up 披露（§7） | **met（本仓面）** |

## 3. Owner 评论 5751613018 落实（逐条；gh 全文核对）

### 3.1 硬性契约「宿主优雅停机必须先 await drain() 再 dispose」

| 落点 | 证据 | 判定 |
| --- | --- | --- |
| 成文硬契约（非参考建议） | ADR 0006 修订节第 3 条（:270-274）：**无条件**条款「宿主优雅停机在调用 `dispose()` 之前必须先 await `drain()`——至 drain 完成，或至宿主显式预算耗尽且该事实可观察」+「预算尽后继续 dispose 有损路径是硬契约的**显式可观察退出**，不是违约」+「未经任何 drain 直接 dispose 的宿主接受（静默地）丢失已 ACK 未写入 store 的状态」；适用面申明不以 adapter 类型特判（契约边界 = 配置的 store 面） | **met** |
| 自家实现结构性强制 | `performStop` 第 3 步（app.ts:604-627）对 `persistencePlugin?.instance` 执行 `awaitDrainWithBudget(adapter.drain(), budgetMs)`；全仓**唯一** `persistenceFiber.dispose()` 调用点（:630）只在该 await 之后可达；唯二出口 = drain 完成 / 预算耗尽且 `persistence-drain-budget-exceeded{budgetMs}` 已 sink（:625，源码序先于 `persistence-disposed` :632）；**file/memory 统一无 kind 特判**（旧 `kind==='file'` 守卫删除，plugin 句柄两分支统一赋值 :297-312）；全部停机路径（SIGTERM/SIGINT main.ts:72、SIGHUP 换装 main.ts:124、fatal 退出链）均经 `app.stop()` 收敛 | **met** |
| 仓库外宿主指引 | cordis-plugin-hosting.md :64 停机句 + 清单第 5 步统一指引（file/memory + degraded 措辞限定耐久 adapter）+ :457-478 示例代码块加入有界 drain 步 + 装配示例保留 `persistencePlugin` 句柄 | **met** |
| 验收锚 | S-5a（健康 file：stop <450ms ≪ 预算 5500 + 新实例见 77 + 无预算事件 + 四事件序）；S-5b（degraded file：EISDIR 确定性注入 → 预算 520ms 内收口 + 事件先于 `persistence-disposed` + budgetMs=520 + 旧 committed 快照诚实可观察 + withTimeout 包裹）；S-5c（memory：`MemoryPersistence.prototype.drain` 原型 spy → 恰 1 次调用且调用时刻 `persistence-disposed` 未发射 + 二次 stop 幂等无第二次 drain + 无预算事件） | **met** |

**有界化偏差说明（非降格）**：issue 字面请求「固定睡眠 → `await persistence.drain()`」，实现为「固定睡眠 → 有预算 race 的完成式等待」。该偏差由三方强制推导成立且经 SA2-1（MAJOR）修订闭环：①Owner 第三击穿窗口（degraded 回退窗，库级 drain 无上界）；②既有不变量「停机排空时延上界 < 60s watchdog」（config.ts `MAX_MAX_DIRTY_MS` 立法，行为零变化）；③同文件 REST 排空有界先例（rest-hosting.ts tagged-race 纪律镜像）。预算尽 → 诚实事件 + 有损继续，是硬契约的显式可观察退出而非违约（ADR 条款成文）。

### 3.2 ADR-0006 对齐（「同步修订 :86 对 dispose 的现有定义——否则契约与实现继续脱节」）

ADR 0006 修订节第 4 条（:276）以约束性修订语气「本节**修订并扩展** :86 的 dispose 定义边界」落地：:86 原文（「dispose 时释放文件句柄、后台任务和 Y.Doc 缓存」——`sed` 核对逐字）未改动，以引用式扩展（issue #79 修订节同款惯例）显式声明 dispose 语义**不变且保持 abortive/有损**（§228-5 重申）、「它从来不是持久性屏障」、dispose 前持久性唯一经分层公开 drain 表达、两者不合并（附「dispose 内部先 drain」备选否决论证）。dispose 实现面零语义变化（diff 中 dispose 段唯一变化 = 内联 waiter 通知抽为 `releaseSettleWaiters`，splice(0)+同步 call 逐字节等价——源码核对）。**met**。

### 3.3 分层方案保持（「公开 drain()，dispose 保持 abort 式」）

drain = `DocPersistence` optional 独立成员（不进 `ReplicaPersistence`——grep 证实零触碰；三成员字面量/13 stub 绿守卫由 surface 类型锚 `legacyThreeMemberAdapter` 保持）；dispose abortive 语义冻结（0a/0b 保持性绿灯锚定「固定睡眠 + dispose 丢已 ACK 写」正复现不变）；CONTEXT.md 词条 `_Avoid_` 行含「把 drain 并进 dispose」禁令。**met**。

### 3.4 第三击穿窗口（degraded retry 回退窗，`scheduleRetry` backoff 上限 maxDirtyMs）

drain 对 `retryTimer` 武装期只注册 waiter 被动等待（lifecycle.ts:866-869 首分支），不强制即时重试、零热循环（ADR 0006:195「退避即唯一 flush 调度源」一致）；锚 1f（t=149 attempts 恒 1、回退到点后 resolve）双 adapter；宿主预算覆盖回退窗（S-5b 首重试基准 1000ms > 预算 520ms 的确定性构造）。**met**。

### 3.5 问题 2 复核确认（支持解耦、缺省保持现行为）

见 §2「独立 retryDelayMs」行——缺省 `(undefined ?? debounceMs) || 1` 与旧式 `debounceMs || 1` 静态等价（2b/3a 保持绿锚定）。**met**。

## 4. 验收契约落实（SA6 C1–C14 + 补充锚）

- **SA6 契约两文件零弱化**：`persistence-issue-412-drain-red.test.ts`（27 = §0 2×2 + §1 7×2 + §2 3×2 + §3 3——结构与断言面与 SA6 §13 归因清单一一对应：14 TypeError 锚（1a–1g×2）、2a/2c 时序断言、t=149 红判据先于结算屏障）与 `persistence-issue-412-drain-surface.test-d.ts`（5 类型锚：双 adapter `HasDrain`、`keyof PersistenceSchedule ∋ 'retryDelayMs'`、三成员字面量保持、实现关系保持）以**新增文件形态进入提交**（SA6 时 untracked，无 git 基线；静态可验证上限 = 结构/计数/断言形状与 SA6 契约描述逐项一致——本审查已核对）。无 skip/only/todo、零源码字符串断言、竞态全 withTimeout。
- **C1–C14 全部有实现侧对应**（§2/§3 矩阵；C11/C13 保持性项由 dispose 零语义变化 + 冻结审计零触碰承接；C14 双 adapter 等价由契约矩阵承载）。
- **补充锚**：S-1~S-4（`persistence-issue-412-drain-semantics.test.ts`，9 = 4×2 + File 校验专项；S-3 锚定 DD-5b 驱逐释放 waiter——`releaseSettleWaiters` 四调用点源码逐一核对：settleEntryForDelete 驱逐腿 :677、settleEntryForArchive 干净驱逐腿 :707、dispose :829、maybeEvict :1195，live-entry 移除点枚举完备）+ S-5a/S-5b/S-5c（`persistence-drain-shutdown.test.ts`，3；真实组合根 + 真实 fs，EISDIR 注入确定性）。
- **Runner 发现**：两新文件命中 `vitest.config.ts` include（`packages/*/test/**`、`apps/*/test/**`）与 typecheck include（`*.test-d.ts`）；`@nomicore/persistence` alias 对 app 源与测试同映射 ⟹ S-5c 原型 spy 单模块实例成立。

## 5. 规范文档对齐与文件范围

- **ADR 0006 修订节 7 条全量落地**（:241-282）：接口契约 / drain 语义（静息观察点 + 并发写者边界 + `targets: []` no-op + File 校验例外）/ 停机硬契约（无条件 + 适用面 + :34 关系申明 + yjs-server 实施注记）/ dispose 对齐（修订并扩展 :86）/ retryDelayMs 解析形状（DD-2 红线成文）/ 排空通知面不变量 / 非 live cell 排除存档——与代码同变更集（SA8 action 1 闭环）。
- **CONTEXT.md** 词条「完成式排空（drain）」含 `_Avoid_`（SA2-5）；**hub-peer-deployment.md** 词表补 `persistence-drain-budget-exceeded`（条件性注记 SA2-8 + memory 缺省预算括注 SA2-13）+ 停机序句（file/memory 统一）；**cordis-plugin-hosting.md** 硬契约指引 + 示例（SA2-9）。
- **文件范围**：产品代码 diff = 设计 ALLOW 15 行逐行对应（13 修改 + 2 新增测试），DENY 零触碰（service.ts/testing.ts/namespace-registry/dsh record·events·profile·cli/四组冻结审计/SA6 契约文件/apps 既有测试/docs-protocols/ws-replication——git 状态与 diff 核对）；wiki/raw 过程产物（task brief、design、SA2/SA3/SA4/SA6、两份冲突报告）随提交入库属 MABF 证据链惯例（wiki/raw 为 tracked 目录，.gitignore 仅排除 TASK.md/.mabf*），不构成产品面 scope creep。config.ts 仅注释 + 拒绝文案 parenthetical（`persistence.schedule.maxDirtyMs` 路径段保持，两锚测试断言形状不变——行为零变化）；main.ts 仅注释。
- **SA8 链闭合**：设计后复查 clear（requiresConflictRecheck: true）→ 实现后复审 **clear / requiresConflictRecheck: false**，12 项冻结面对实际 diff 全部保持，O1/O2 保真核对无降格。

## 6. Findings（全部 MINOR，非阻断）

| # | 严重度 | 观察 | 来源/处置 |
| --- | --- | --- | --- |
| M1 | MINOR | ADR 修订节三处「第 4 条」交叉引用悬空（:264/:267/:273——被引短语实在 :34 与 issue #79 修订节第 2 条；短语逐字唯一可定位，零规范歧义后果） | SA8 F1（已核实属实）；纯文本 follow-up |
| M2 | MINOR | `apps/yjs-server/AGENTS.md` 单一拆卸链摘要行未列新增的链内排空等待步（陈述仍真——drain 是链内等待非拆卸；该文件不在设计 ALLOW，不越界正确） | SA4 N-1 / SA8 action 2；文档债 follow-up |
| M3 | MINOR | 设计文档对 SA8 设计后报告的三处计数/traceability 描述停留在旧版（SA1 产物文本债，零行为影响） | SA2-12 / SA8 action 3；留待 SA1/Controller |
| M4 | MINOR | `awaitDrainWithBudget` 在 drain reject 路径（结构性不可达）跳过 `clearTimeout`，预算 timer 残留至自然到点；fail-loud 路径（app-stop-failed → exit(1)）不受阻 | SA4 N-2；可后续 try/finally |
| M5 | MINOR | S-5a `elapsedMs < 450` 墙钟上界在极慢 CI 有偶发 flake 余量（预算 5500/withTimeout 3000 均不受影响） | SA4 N-3；观察 CI 后酌情放宽 |

无 BLOCKER / MAJOR。本审查独立复核未发现上游 SA 记录之外的新缺口。

## 7. PR 必须披露项（未达成/延迟事项）

1. **库级 drain 无时间预算（语义代价，非缺陷）**：持续失败 store 下 `drain()` 不 resolve（ADR 0006:34「重试直到成功或插件停止」的诚实代价）；宿主侧总界 = 宿主自有预算（yjs-server = `maxDirtyMs + 边距`，预算尽发 `persistence-drain-budget-exceeded` 后有损 dispose）。配置 `debounceMs > 预算` 时 degraded 首重试可能超出预算（事件可观察；DD-7 备选 (iv) 已立法记录）。
2. **nomic-server（仓库外消费方）尚未替换固定睡眠**——硬契约指引已经 cordis-plugin-hosting.md 传达，采纳在消费方仓库（issue「消费方配合」节定位为供参考）。
3. **设计 §13 follow-up（非本任务必要条件）**：DSH 记录头携带 retryDelayMs 的 golden 立法（记录头有意冻结）；yjs-server 配置面暴露 `retryDelayMs`（含与排空预算联动再立法）；archive×delete 既有理论挂起的系统性专项测试（实现面 DD-5b 已修）。
4. **root `pnpm test` 存在 2 个既有失败与本 diff 零交集**：`packages/vfsl-codegen/test/generate-union-member-docs.test.ts` 的 `pnpm generate --check` 版本横幅新鲜度断言（`domains/vfs3-assets/generated.ts` 横幅 `@nomicore/vfsl-codegen@0.1.3` vs 包 0.2.0，发布提交 `abbb89a` 历史遗留）。本 diff 零触碰 `domains/**`、`packages/vfsl*`（git 状态核实），失败归因不属本 issue。本改动三包切片（persistence 242 tests / dsh golden 零漂移 / yjs-server 182 tests）与 root typecheck 由 SA3 申报全绿、SA4 静态核验断言-实现对应。
5. **M1–M3 文本债**（见 §6）：ADR 交叉引用、AGENTS.md 拆卸链行、设计文档计数——均不阻断合并，随任一后续 docs 变更集顺带处理。

## 8. 结论

当前提交 `1fef434` 忠实满足：issue #412 正文全部请求面（公开完成式 drain + retryDelayMs 解耦 + 宿主固定睡眠替换）、Owner 评论 5751613018 全部要求（dispose 前 await drain 的**硬契约**成文且结构性强制、ADR-0006 :86「修订并扩展」对齐、dispose 保持 abortive 的分层公开 drain、第三击穿窗口闭合）、SA6 验收契约 C1–C14 与全部补充锚；规范文档（ADR/CONTEXT/两份集成文档）与代码同变更集对齐；文件范围零越界、零 scope creep。**approve**。
