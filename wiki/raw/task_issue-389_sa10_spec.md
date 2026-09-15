# SA10 Spec 审查 — issue #389：复制来源与订阅终止（变更订阅 T3）

- 审查轮：2026-09-15（iteration 0；dispatch `sa-3da4bc21-3260-49b4-9939-8da4d4447fa4`，phase = spec-review）
- 被审对象：**committed 最终交付** = HEAD `55900b1388270ce226e8377db8d90e4af81332a7`（`feat(namespace): terminate change subscriptions`，branch `mabf/issue-389`，基线 `28faeae` = #395 T1）
- 交付组成（本轮 `git diff HEAD~1 HEAD --name-status` 实读）：4 个 runtime 源文件改动（`watch-map.ts` +68/−6、`runtime.ts` +52/−10、`schema-write.ts` +17、`replication-session.ts` +13）+ 3 个新测试文件（fixture 631 行 / 行为契约 594 行 17 用例 / SA7 动态验证 373 行 7 场景）+ wiki/raw 流程产物
- 审查方法：issue 正文与 AC1–AC7 逐条对照交付源码实读（S5.6 / R5.7 / 关闭 admission 分型 / `terminateAll` / 泵 drain / 退订豁免）、契约测试全读、证据日志抽检（红 10 败 → 绿 17/17、回归 86/86、全仓 4770、SA7 24/24、4 mutation 击穿）、独立 grep（产出点 / reason 词表 / 冻结面零 diff / 零 skip-only-todo）；不修改代码/设计/测试，不运行测试，不启动服务
- 结论速览：**verdict = approve**。AC1–AC7 全部满足（AC3 的 import/genesis 族按 SA6§15-4 + SA1 冻结收窄为 reset——结构性不可达论证充分且全链批准，已登记披露）；ADR 0030 §4/§5/§6/§7、ADR 0018 §1/§3、ADR 0010 #133 冻结次序逐项相符；零 scope creep；MINOR 项（stale 证据日志、已登记覆盖缺口与残余）不阻断

---

## 1. Reviewed inputs

| 输入 | 状态 | 用途 |
|---|---|---|
| Issue #389 正文（brief `wiki/raw/task_issue-389.md`：What-to-build + AC1–AC7 + Blocked by #387） | 在场 | 需求源 |
| Issue #389 评论 | **0 条**（dispatch 明示 REST 实读空数组；brief Comments 节为空；SA6 §2/探针 6 同证） | 无 owner 条款 |
| `wiki/raw/task_issue-389_sa6_contract.md`（approve 附 SA1 冻结条件） | 在场 | 验收契约 C1–C11 / NC1–NC6 / B-T3-0–6 |
| `wiki/raw/task_issue-389_design.md`（SA1 iteration 1）+ `..._sa2_review.md`（approve，F-1 已解决） | 在场 | 已批准设计（§5 冻结裁定全 = SA6 默认） |
| `wiki/raw/task_issue-389_sa3_impl.md` / `..._sa4_review.md`（approve）/ `..._sa7_report.md`（approve） | 在场 | 交付自述与前置审查 |
| `wiki/raw/task_issue-389_relevant_decisions.md` / `..._conflict_report.md`（clear）/ `..._implementation_conflict_report.md`（clear，requiresConflictRecheck=false） | 在场 | SA8 约束面与实现后冲突门闭合 |
| `docs/adr/0030-change-subscription.md` §4/§5/§6/§7 + 备选节；`docs/adr/0018` §1/§3；ADR 0010 #133 round-2；`CONTEXT.md` L65–67 | 在场（本轮重读 §4–§7 原文） | 规范权威 |
| 交付源码 4 文件当前态 + 3 测试文件 + 证据日志（`artifacts/sa3-issue389-*.log`、`sa6-*`、`sa7-*`） | 本轮独立实读/抽检 | §3–§6 |

## 2. Owner comment mapping

- 评论数 = **0** → 无 owner override、无范围收缩；需求源 = issue body AC1–AC7 + ADR 0030 决策 4/6（规范权威，与 issue「规范权威 = ADR 0030 决策 4 / 6」一致）。

## 3. Issue AC ↔ 交付对照（逐条裁决）

| Issue AC | 交付证据（本轮独立核实） | 裁决 |
|---|---|---|
| **AC1** 复制 apply（lease `openReplicationSession` + `applyRemoteUpdate` 驱动）→ `data` 且 `origin:'replication'`；本地写恒 `'local'` | SA6 实测该能力在 HEAD 已由 T1 结构性交付（探针 1：`["local","replication"]`），本票义务 = 验收补锚 + 回归锁。契约 C1/C2 + NC3 补充：fixture L520 经 `lease.openReplicationSession`（issue 点名的 lease 面驱动先例）→ `applyRemoteUpdate`；断言恰三键 `{kind:'data',origin,changes:[{path:['tasks'],key}]}` 逐字、同流 FIFO `['data','data']`、零 watch-end。`classifyOrigin`（watch-map.ts:331）**零 diff**（本轮 grep 核实）——无过滤面引入 | ✅ 满足（补锚形态与 SA6 批准契约一致） |
| **AC2** schema 变更 → 全部存活订阅 `{kind:'watch-end',reason:'schema-changed'}`，两路径 | ① Hub 本地 `replaceSchema`：`schema-write.ts:323` S5.6——S5.5 `installed` 判定后、S6 `await notifyDirty()` 前同步段 `void env.watchHub.terminateAll('schema-changed')`；S5.5 失败防御分支 early-return 在产出点**之前**（fatal 结算逐字不动）。② Peer re-arm：`replication-session.ts:828` R5.7——`text` 变化块内、re-arm 结局 + failed-diag 配对后、R6 前；覆盖 applied/**failed** 两结局（SA1 B-T3-2 冻结 = 发）。「全部存活订阅」= `terminateAll` 快照迭代整个订阅集合。C3（oracle：replaceSchema ok + text 切 V2）/ C4（oracle：`schemaRearm.kind==='applied'` + 指纹双侧一致）/ C4b（fatal INVALID 构造 → 仍发且 apply ok 携 `kind:'failed'`）全绿 | ✅ 满足 |
| **AC3** doc 替换（reset / bootstrap import / genesis 一族）→ `watch-end:'doc-replaced'` | reset 路径：`runtime.ts:655–671` `closeAfterFenceReset`——共享首步 `fanout.terminateAll('runtime-close')`（现状保持）→ `watchHub.terminateAll('doc-replaced')` 同步段入队+注销 → 投递结算 `await delivered` 并入 close 承诺；registry reset 槽 **零 diff**（registry.ts:1865–1898 既有次序：startCloseAfterFence → forceRelease → await closePromise → archive）。C5 **免 poll** 断言结算时流已含已投递末条（强于契约默认「最终送达」）。**import/genesis 收窄**：SA6 §15-4 + SA1 §5-§15-4 冻结——`importReplica` 排他创建（live entry 在场 → `NAMESPACE_ALREADY_EXISTS`）、genesis = 新 doc 建立，两者在「订阅存在」前提下结构性不可达；全链批准（SA6→SA1→SA2→SA8→SA4→SA7） | ✅ 满足（附已批准收窄披露，§7-①） |
| **AC4** `watch-end` 流末条：此后静默、已注销；`unsubscribe` 幂等 no-op | `terminateAll` 队尾追加 + 从 `subscriptions` 摘除（`onRootTransaction` 迭代不到 = 零入队点的结构性静默）；句柄 `unsubscribe` 首行 `terminated` → **no-op 不清队**（watch-map.ts:501–512）。C6（终止后两笔写 + 微任务双预算 400 ×2 → 计数不变、末条仍 watch-end）/ C7（×2 零 throw 零通知，嵌于 C5/C9）绿 | ✅ 满足 |
| **AC5** FIFO：`watch-end` 与滞留 data 同流有序——不会先终止、后到僵尸 data | 终止项复用订阅 FIFO 队列与单飞泵（绝不直调 listener）；B-T3-6「滞留 data 必达」= terminated 队列免于全部清队点（退订 no-op / force-release 经句柄收敛 / shutdown 后置且只作用集合内 / 溢出清队仅 data 路径）。C8 三断言（末位 / dataKeys 恰 `['t3','t4','t5']` / 终止后零通知）绿；mutation M1（绕队列）击穿 C8+CAP、M2（清队丢滞留）击穿 C8(ii) | ✅ 满足 |
| **AC6** 终止后重建订阅正确——生命周期只与 lease 和 schema 耦合 | C9：schema-changed 后 lease `active` + 重新 `watchMap` 按 V2 建立并投递 + 旧句柄双退订 no-op + 旧流静默。C10：doc-replaced 后 `NamespaceLeaseReleasedError` 既有通道 + 重新 open 后新订阅正常投递、零终止信号 | ✅ 满足 |
| **AC7** 全部经 lease 公共面可观察（零新接缝） | C11：lease 恰 16 键、runtime 恰 15 键（`Object.keys` 排序逐字断言，与 registry-open/phase5 既有守卫同面）、通知 kind ⊆ 三 kind 闭集、readData 经集中化 helper `expectReadDataOkKeys`。新增面（hub `terminateAll` 方法、`SchemaWriteEnv`/`RuntimeReplicationHost` 的 `watchHub` 字段）全为**包内模块面**——`index.ts`/`internal.ts` 零 diff；`packages/namespace-registry/src/**` 整包零 diff | ✅ 满足 |

**裁决：7/7 AC 满足。** 无 unmet、无 unachievable；AC3 的 import/genesis 族收窄为已批准的披露项（§7-①），非部分实现——其「订阅存在前提下结构性不可达」论证经 SA6 源码级核验且本 SA10 复核成立（importReplica 排他契约 + genesis 无 live lease 面）。

## 4. 规范相符性（ADR 0030 决策 4/6 逐款 + 关联冻结面）

| 规范条款（本轮重读原文） | 交付相符性 | 裁决 |
|---|---|---|
| ADR 0030 §4：三 kind 封闭 `{kind,origin,changes}` / `{kind,origin}` / `{kind,reason}` | 终止项 = `Object.freeze({kind:'watch-end',reason})` 恰两键（watch-map.ts:526）；联合类型零改动；reason 词表全仓 grep 恒 `'schema-changed'\|'doc-replaced'`；`origin` 恰两态、无 'admin' | ✅ |
| ADR 0030 §4：`watch-end` 流末条、此后静默；终结三因封闭（lease 释放 / schema 变更 / doc 替换）；数据缺席与删除**从不**终结 | 摘除即零入队点；`terminateAll` 产出点恰 3 处（schema-write.ts:323 / replication-session.ts:828 / runtime.ts:658——本轮 grep 独立复核）；delete/shutdown/idle 走正常风味静默收口（§15-5 冻结）；NC5（数据缺席/容器删除不终结）绿 | ✅ |
| ADR 0030 §5：宁多勿漏；**绝不按 origin 过滤**（唯一不变量） | `classifyOrigin` 零 diff；C1/C2 + NC3 补充绿 | ✅ |
| ADR 0030 §6：挂点 = 事务提交后异步分发、三来源全覆盖、throw 静默隔离、有界队列溢出 → `invalidate-all` | 入队在槽内同步段（S5.6/R5.7/reset admission）、投递经既有槽外微任务泵（20 让步/项、逐 listener try/catch X1）；容量豁免仅限终止项（data 溢出 → 清队 + 单条 `invalidate-all` 语义逐字不变）；CAP（64 笔快连 → `invalidate-all` ≥1 且 watch-end 恒末条）绿 | ✅ |
| ADR 0030 §7：runtime 承担终止编排；registry 仅 lease 公共面；通知不出进程 | 编排全落 namespace-runtime；`registry.ts`/`lease.ts`/`types.ts`/`index.ts`、`ws-replication/**`、`docs/protocols/**` 零 diff（本轮 name-status 核实） | ✅ |
| ADR 0030 备选节：onEnd 独立回调 / schema 变更作通知 kind / origin 'admin' 已否决 | 零复活——统一进通知流、终止入队不直调（M1 变异即红） | ✅ |
| ADR 0018 §1/§3：R5.6 同步段位置；fatal 双码、tools 不动、apply 不回滚 | R5.7 在 text 门内、结局+diag 后、R6 前，`void` fire-and-forget（零新槽类型零插队）；re-arm fatal 结算路径逐字不动；round2 25/25 绿 | ✅ |
| ADR 0010 #133 round-2：fence→closing→唯一 barrier→归档；fence 槽不建/不等 barrier | fence 槽体零改动（`createBeginResetFence` 仅换绑 `closeAfterFenceReset`）；终止发生在槽后 lazy continuation 的关闭 admission 层（ADR 明文允许建 barrier 的层）；`lazyCloseBarrier()` 仍恰创建一次；phase5 fence 7/7（双向 same-promise、release 恰一次）绿 | ✅ |
| R2-2 / runtime AGENTS：`close()` 同步终止存活 sessions | 共享首步 `fanout.terminateAll('runtime-close')` 在两种风味中显式保持（SA2 F-1 落点）；公共 `close()` = 正常风味；round2 R2-2 族 25/25 绿 | ✅ |

## 5. 验收证据核验（本轮抽检日志 + 独立静态核对）

| 证据 | 内容 | 本轮核验 |
|---|---|---|
| `artifacts/sa3-issue389-red-contract-final.log` | 实现前红：**10 failed / 7 passed**，首因统一 = `waitForWatchEnd` 屏障超时（流中无 watch-end） | 实读一致；红面精确落在终止编排缺席 |
| `artifacts/sa3-issue389-green-contract.log` | 实现后 **17/17 绿**（C1–C11 + C4b + CAP + NC3/NC5/NC6 + 3 装置自检） | 实读一致 |
| `artifacts/sa7-issue389-contract-rerun.log` | 契约 + SA7 动态场景 **24/24 绿** | 实读一致 |
| `artifacts/sa7-issue389-regression-gates.log` | **86/86**（#387 21 + #369 33 + phase5 fence 7 + round2 25） | 实读一致 |
| `artifacts/sa3-issue389-full-suite.log` | 全仓 `pnpm test` **395 files / 4770 tests 全绿**，Type Errors 0，exit 0 | 实读一致 |
| mutation M1–M4 日志 | 绕队列 / 清队丢滞留 / 撤退订豁免 / 错 reason——全部被契约击穿 | SA3 记录在档，与契约断言机理一致 |
| 断言纪律 | 零 skip/only/todo（本轮 grep，仅头注提及）、零 sleep（屏障 + `expect.poll` 5ms/2s + 微任务预算）、形状全 `toStrictEqual`、reason 逐字、零 env override、零源码字符串断言 | 契约文件全读核实 |
| 工作树卫生 | tracked 树与 HEAD 一致（`git status --porcelain` 无 tracked 修改）；untracked 仅 artifacts 证据日志 | 本轮实读 |

## 6. 范围审查（scope creep 检查）

- 改动面恰 = 设计 ALLOW 6 行（4 源文件 + fixture + 行为契约）+ SA7 动态验证测试 1 件（dynamic-verify 流程许可的最小补充，零生产代码）+ wiki/raw 流程产物。
- DENY 全清单零触碰：registry/lease/types/index、ws-replication、docs/CONTEXT、读面（`read-schema-projection`/`window-read`/`projection`）、诊断面、`schema-rearm.ts`/`p0.ts`/`close.ts`/`write.ts`、全部既有测试——本轮 name-status + diff 实读核实。
- 非目标未越界承接：T2 谓词（#388）、T4 `invalidate-all` 触发编排（#390，本票 CAP 仅锁「溢出语义不变 + 终止项恒入队」）、T5 文档面（#391）、数组载体/含值通知（ADR v2）——均无涉入。
- **零 scope creep。**

## 7. PR 必须披露的未达成/收窄项与 MINOR 观察

1. **【披露·已批准收窄】AC3 的 `doc-replaced` 产出点仅挂 reset 一族**：`importReplica`（排他创建）与 genesis（新 doc 建立）在「存活订阅存在」前提下结构性不可达，故无独立产出点——SA6 §15-4 登记、SA1 §5-§15-4 冻结、SA8 实现后冲突门闭合。语义 = 「doc 替换终止订阅」在 lease 公共面唯一可观察场景（reset）已完整交付；若未来 import/genesis 出现可携带存活订阅的形态，需回设计门补产出点。
2. **【MINOR·证据卫生】** `artifacts/sa3-issue389-test-typecheck.log` 为中间态 stale 捕获（含 4 条已修复的宽谓词 TS 错误），与 SA3 §6.2-V5 引用的 exit 0 相矛盾；最终事实已由 SA8 静态编译检查 + SA4 独立 `tsc --noEmit` + SA7 重捕（`artifacts/sa7-issue389-test-typecheck.log` exit 0）三重独立确认成立。建议 finalize 前以最终树重捕该日志（SA8 §8-2 / SA4 N-O1 已登记）。
3. **【MINOR·覆盖缺口，均非契约义务】** SA4 N-O3 登记：① schema 路径多订阅同刻终止无多 sink 用例（set 快照迭代结构性覆盖；reset 路径已由 SA7 D-S2 以 2 lease × 3 sink 动态覆盖）；② peer 滞留 data FIFO 契约无专用用例（SA7 D-S1 已动态补齐：混合 update → `[data(replication), watch-end]`）；③ watch-end 投递 listener throw 隔离（SA7 D-S3a/b 已动态覆盖）；④ `terminateAll` 连续两次幂等（SA7 D-S4 已动态覆盖）。建议路由 T4 #390 或契约加固轮收编。
4. **【MINOR·已登记残余，非本票义务】** 设计 §13：R3（本地 S5.5 结构性不可达防御分支不发终止——无可观察路径）、R4（peer re-arm fatal 后重建订阅按旧 tools 判定——T1 建立门冻结行为 + ADR 0018 fatal 降级终局的诚实反映）、reset armed 后 archive 失败时 `doc-replaced` 已投递而旧字节仍在（T5 #391 措辞输入）。

## 8. Verdict

**approve** —— committed 最终交付对 issue #389 正文（What-to-build + AC1–AC7）、零 owner 评论、已批准验收契约（SA6 C1–C11 / NC1–NC6 / B-T3-0–6 全按冻结值落位）与规范权威（ADR 0030 决策 4/6、ADR 0018、ADR 0010 #133）为**忠实、完整实现**：三条终止路径产出点恰 3 处且挂点逐字落位；`watch-end` 流末条 + 此后静默 + 退订幂等 no-op + 滞留 data 必达的 FIFO 语义经契约与 4 项 mutation 双向锁定；lease 16 键 / runtime 15 键 / 通知三 kind 闭集零新接缝；DENY 面零触碰、零 scope creep。唯一需在 PR 披露的未达成面 = §7-① 的 AC3 import/genesis 收窄（已全链批准）与 §7-② 的 stale 证据日志重捕建议；MINOR 项均不阻断。
