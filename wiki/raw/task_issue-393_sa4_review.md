# SA4 实现静态审查 — Issue #393：FileDiagnosticLog 自绑定（P0）+ manager 泛化导出（P1）+ skill 文档（P2）

- 审查人：SA4（implementation review）；日期：2026-09-14；worktree：`/home/wangjian/nomicore-fix-issue-393`（HEAD `dcb3766`，基线未 commit，与 SA6/SA1/SA2/SA8/SA3 报告一致）
- 被审对象：SA3 实现 diff（9 个 ALLOW 路径修改 + 6 份 sa3 证据 log）+ 4 个 SA6 红灯契约文件（DENY，未触碰）的实现后状态
- 审查方法：全部上游产物（task brief / SA6 契约 / SA1 设计 / SA2 评审 / SA8 设计后冲突报告 / SA3 实现报告）逐字读取；实现 diff 逐行核对；registry/NDCL/yjs-server 源码锚点（探测、泵、seam 类型、构造产物）独立复核；4 契约测试逐行通读并与 SA6 红灯 log 的用例名逐一比对；证据 log 尾部核对；只读 git 命令核查范围与 mtime 时序。SA4 未运行测试、未修改任何实现/设计/测试。

---

## 1. Reviewed inputs

| 输入 | 位置 | 状态 |
|---|---|---|
| 任务简报（issue 正文 + Owner comment 5664521867，updated 2026-09-14T13:12:42Z） | `wiki/raw/task_issue-393.md` | 存在，已读（mtime 21:12:58，早于全链） |
| SA6 诊断与验收契约 | `wiki/raw/task_issue-393_sa6_contract.md` | 存在，已读（21:34） |
| SA1 设计（approved） | `wiki/raw/task_issue-393_design.md` | 存在，已读（21:44；505 行） |
| SA8 设计后冲突报告（verdict clear；requiresConflictRecheck=true 待实现 diff 闭合） | `wiki/raw/task_issue-393_design_conflict_report.md` | 存在，已读（21:58）；§8-b 六项清单逐项复核见 §5 |
| SA2 设计评审（approve；O1–O4 MINOR） | `wiki/raw/task_issue-393_sa2_review.md` | 存在，已读（22:10） |
| SA3 实现报告 | `wiki/raw/task_issue-393_sa3_impl.md` | 存在，已读（22:44） |
| 固定位置缺失项 `_relevant_decisions.md` / `_conflict_report.md` / `_sa1_review.md` | `wiki/raw/` | 不存在（SA6 §1/SA2 §1/SA8 §2/SA3 四方一致确认；SA8 设计后报告收编决策摘录职能，不阻塞） |
| 实现源码 + 测试 + git 状态/diff + 证据 log（sa6 ×10、sa3 ×6） | 见 §6/§9 | 已核 |

缺失输入不影响实现安全性判断（SA8 设计后报告已补位裁决，实现 diff 可直接对照其冻结面清单）。

## 2. Verdict

**approve**

- 无 BLOCKER、无 MAJOR。P0/P1/P2 按 Owner comment 5664521867、SA1 设计 §7.1–§7.3、SA6 契约 §12.1–§12.4 忠实落位；SA8 §5 冻结面与 §8-b 实现期核对清单逐项零漂移；文件范围与 ALLOW/DENY 完全一致；契约 15 红 → 0 绿且有独立红灯基线（SA6 修复前 log）+ 全量套件零回归佐证；测试未被弱化（用例名与 SA6 红灯 log 逐字一致、无 skip/only/todo、mtime 时序红灯先行成立）。
- 3 条 MINOR 观察见 §12（均不阻断）。
- 未发现新的 ADR 冲突风险（SA8 已裁定项的实现兑现全部核对通过，见 §5），故不提交 conflict recheck。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| Owner 5664521867：自然组合（`createFileDiagnosticLog(...)` 产物直传 `diagnosticLog`）必须工作——非配置错误、非 fail-fast | `file.ts:1544-1545` 构造产物闭包成员；registry `create-diagnostic.ts` 零 diff（`git status` 核实）→ 非抛探测 `typeof candidate === 'function'`（`:309-318`）→ 泵路径（`:466-585`）；主契约载体 = raw log 直传（`issue-393-ndcl-self-binding-red.test.ts` R1/R2 直传整对象） | ✅ 经 identity 自绑定兑现，无任何类型拒绝断言（4 契约文件复核属实） |
| Owner：P0 公式 `ns === this.namespaceId ? emitter : undefined`；registry 探测零改动 | `file.ts` 接口成员（`:124-130`）+ 闭包 `ns === namespaceId ? emitter : undefined`（`:1544-1545`）逐字一致；`packages/namespace-registry/src/**` 零 diff | ✅ |
| Owner：不加 `initStream` | `file.ts` 无新增成员（G3 守卫绿：`log.initStream === undefined`）；泵侧缺席 no-op（`create-diagnostic.ts:476-479` `initStreamMember?.()` + `:553` 早退） | ✅ |
| Owner：「类型收紧 fail-fast」作废 | 全部 diff 无类型收紧面；裸 `{emitter}` 弱化为文档陷阱（`cordis-host.md`「The bare `{emitter}` trap」节） | ✅ |
| AC1：identity 匹配 + B 臂转正回归测试（root-mutation 落盘） | R0/R1（registry 契约）+ NDCL R1/R2/R3；红灯基线 `sa6-issue393-red-contracts.log`（R0–R4 红）→ 绿 `sa3-issue393-rerun-red-and-typecheck.log`（4 文件/22 tests 全绿） | ✅ |
| AC2：replication apply 落盘 | R2（真实 `openReplicationSession` + `applyRemoteUpdate` committed 回读）；`resolveRuntimeDiag` wrapper → `replication-session.ts` 既有发射点（runtime 包零 diff，仅环境变化） | ✅ |
| AC3：#150 legacy 契约零漂移 | registry `create-diagnostic.ts:419-463` legacy 路径零 diff；G2 绿（恰 1 条 create、0 条 runtime）；全量套件 392 既有文件零失败（`sa3-issue393-rerun-full-suite.log`：396/396 文件、4752/4752 tests） | ✅ |
| AC4：其它 ns 不落本流 | R3（第二 ns create 前后本流计数不变）；泵 drain `resolver(otherNs)===undefined` → 静默丢弃（`diag-pump.ts:134-139` 复核）；跨 ns 写入缺陷（B4/D0）随之消除 | ✅ |
| AC5：无归属拒绝落盘语义显式定案（接受落盘）+ 契约测试 | R4（泵路径判别 + `REGISTRY_NOT_ACCEPTING` rejected 恰 1 条）；实现侧零新代码（同步共享通道 `emitEarlyOutcome(undefined)` → `emitAttempt(emitter,…)`，`create-diagnostic.ts:530-541` 既有）；SA6 probe 实测现状即落盘（`green-capability.log` 尾部复核）→ 零行为漂移 | ✅ |
| AC（P1）：导出泛化 manager + app 消费同一实现 | `diagnostics.ts` 泛化签名/类型 + `notify` 收口；`index.ts:63-70` 导出 factory + 5 类型；`app.ts:280-284` 消费（仍从 `./diagnostics.js` 导入——单份实现、无 app↔index 循环） | ✅ |
| AC（P2）：`cordis-host.md` 配置节 + `SKILL.md` 路由 | 四要素齐备（单 ns 直传/多 ns manager/裸 `{emitter}` legacy 陷阱/Hub·Peer 示例）+ 两种无归属语义边界段；SKILL.md 路由行 + frontmatter description | ✅（P2-R1/R2 绿） |
| AC：版本 bump + 根 typecheck/测试全绿 | `package.json` 0.1.8→0.1.9；`sa3-issue393-rerun-red-and-typecheck.log`：NDCL/app/registry tsc + 根 `pnpm typecheck` 全 EXIT 0；全量套件 EXIT 0 | ✅ |
| SA2 O1（P2 补 `namespaceId` 一致性陷阱句） | `cordis-host.md` 单 ns 段：「`namespaceId` must be the namespace this log belongs to…every other namespace resolves to `undefined` and is silently dropped inside the Registry pump」 | ✅ 已落实 |
| SA2 O2（按列名 5 类型导出） | `index.ts` 恰 5 个类型 + factory，与列名清单一致 | ✅ |
| SA2 O3（0.1.9；0.2.0 留发布评审） | 落 0.1.9；R7 备案保留 | ✅ |
| SA2 O4（`onEvent: this.sink` 兜底未触发） | `app.ts:283` 直传 `this.sink`；`tsc -p apps/yjs-server` EXIT 0（证据 log） | ✅ 无需兜底 |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| §7.1-D1：required 方法成员 + 产物闭包（单构造点覆盖一切模式） | `file.ts:118-138`（接口 + JSDoc）；`:1536-1553`（唯一 return 的字面量，`:1556`） | ✅ required 声明满足 seam optional（`types.ts:902`）与 SA6 optional 目标形态；一切模式（ready/disabled/failed）同一实现，不查 mode | 无 |
| §7.1-D2：disabled/failed 统一 identity 解析（返回 silent emitter） | 闭包捕获构造期 `emitter`（`:1527`）——B7 形状完备返回下 emitter 照常构造 | ✅ 与设计 D2 理由 (a)(b)(c) 一致；观察面等价性有 JSDoc 记载 | 无 |
| §7.1-D3：不加 `initStream` | 无该成员；G3（registry）/G1（NDCL）双守卫绿 | ✅ | 无 |
| §7.1-D4：registry 零改动 | `packages/namespace-registry/src/**` 零 diff（`git status` + 空 diff 核实） | ✅ | 无 |
| §7.1-D5：AC5 接受落盘（现状零漂移） | 无实现面新增——`emitEarlyOutcome(undefined)` 既有同步共享通道；R4 见证 | ✅ | 无 |
| §7.2-1/2/3：泛化配置/事件/deps + `notify` 吞没收口 | `diagnostics.ts:54-92`（三类型，与设计签名逐字段一致）；`:136-144`（notify：缺席静默、throw 吞没） | ✅ binding/close/retire 语义零漂移（§5 逐行核对） | 无 |
| §7.2-5：公共导出 | `index.ts:63-70`：factory + `HostDiagnosticsManager`/`…Config`/`…Deps`/`…Event`/`DiagnosticEmissionDropReason` | ✅ P1-R1 锚定 | 无 |
| §7.2-6：app 消费同一模块符号 | `app.ts:60-62` 从 `./diagnostics.js` 导入；`:280` 泛化调用 `{onEvent: this.sink, now}`；`enabled` 判定保持 app 侧（`:278-279`） | ✅ 全仓一份；无循环导入 | 无 |
| §7.2-7：两测试调用点机械适配 | 2 文件各 1/2 处调用形状改 `{rootDir,…},{onEvent,now}`；diff 仅 4+8 行、零断言改动（逐行核对） | ✅ | 无 |
| §7.3：P2 文档 | `cordis-host.md` 新增「## Diagnostic change log (诊断日志)」二级节（Process 与 Guardrails 之间）+ Process 第 5 步交叉引用；`SKILL.md` L16 路由行 + description | ✅ 四要素 + O1 补句 + 双语义边界段齐备 | 无 |
| §11 版本 bump | 0.1.9 | ✅ lockfile 为 `link:` 引用（无漂移面）；无测试钉旧版本（grep 0.1.8 零测试命中） | 无 |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| per-ns identity 解析 | NDCL File adapter（持 `namespaceId`+`emitter` 事实） | `file.ts` 闭包成员 | ✅ 事实 Owner 自持 |
| 路由/泵/归因投递 | namespace-registry（#226 既有） | 零改动 | ✅ |
| 多 ns 生命周期（缓存/retire/close） | yjs-server manager | `diagnostics.ts:167-236` 逐字未动（除 sink→notify） | ✅ |
| 文档正路 | `.agents/skills/nomicore/` | cordis-host.md/SKILL.md | ✅ |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| 生产供应方 binding（`runtimeEmitterFor` 数据键控） | `apps/yjs-server/src/diagnostics.ts`（#155/#226/#228） | P0 逐字复用 seam 成员名与 identity 语义；P1 导出该实现 | 一致 | 同一 seam 的第二个供应方（per-ns 自绑定族），无平行通道 |
| registry 测试跨包源引用 | `registry-create-diagnostic-red.test.ts:95`、`registry-issue-226-red.test.ts:66` 等 5 处先例 `../../namespace-diagnostic-log/src/index.js` | 393 契约同款相对导入 | 一致 | 仓内既有惯例 |
| app 公共导出先例 | `createNodeHubListenAdapter`（index re-export 自 transport） | manager 同款 re-export | 一致 | 不新开包 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| log 归属 ns | 构造期 `namespaceId` | 纯闭包比较，无镜像 | 无 |
| 流写面 | 构造期 `emitter`（单构造点） | resolver 恒返回同一实例 | 无（幂等） |
| manager 实现 | `diagnostics.ts` 单模块 | app 经 `./diagnostics.js`、公共经 index re-export | 无（同一符号） |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| P0 成员纯闭包，无 acquire | 无 release 面 | 零 IO/零 throw | ✅ 无新增生命周期 |
| manager `close()`/`retireNamespace()` | 幂等、丢弃桩 + 计数 | 语义逐字未动；P1-R3/R4 守护绿 | ✅ |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 无归属拒绝另立丢弃通道 | 共享 emitter 通道 | 未新增（设计备选表明确拒绝） | ✅ |
| registry 启发式识别 raw log | 非抛成员探测 | 未新增（registry 零 diff） | ✅ |
| 第二套 manager 实现 | `diagnostics.ts` | app 消费同一模块符号 | ✅ 单份 |

### SA8 §8-b 实现期核对清单（逐项独立复核）

| # | 核对项 | 结果 |
|---|---|---|
| 1 | `file.ts` 改动不越出「接口 + 构造产物字面量 + JSDoc」 | ✅ diff 恰 12 行（7 JSDoc/注释 + 1 接口成员 + 5 产物成员含注释）；无 emit/建流/schema/manifest/reader/retention 触碰 |
| 2 | manager binding/close/retire 语义零漂移 | ✅ `unattributedEmitter`/`dropStub`/`ensureAdapter`/`initStream`（un-retire 次序）/`runtimeEmitterFor`（closed→retired→ensure 三键控）/`retireNamespace`/`close` 逐字未动；唯一变化 = 3 处 `deps.sink(...)` → `notify(...)` |
| 3 | registry/runtime/replication 包零 diff | ✅ `git diff` 于全部 DENY 路径为空 |
| 4 | 4 契约文件与 SA6 证据零改动 | ✅ 契约 mtime 21:19–21:21（早于实现 22:11–22:33）；sa6 log mtime 21:18–21:34 未再写入 |
| 5 | NDCL 0.1.8→0.1.9 | ✅ `package.json:3` |
| 6 | P2 双无归属语义写为供应方范围限定 | ✅ 「The two unattributed semantics are deliberately different and not interchangeable…」段在文 |

SA8 `requiresConflictRecheck=true` 所列待闭合面（公共 API 变化兑现、R4/P1-R2 双语义边界、§5 冻结面 10 项）本轮全部核对通过，未发现新的 ADR 冲突风险。

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/namespace-diagnostic-log/src/adapters/file.ts`（M） | 行 1 | P0 接口 + 产物闭包 + JSDoc | ✅ 12 行，恰为设计 §8.1 面 |
| `packages/namespace-diagnostic-log/package.json`（M） | 行 2 | 0.1.9 | ✅ |
| `apps/yjs-server/src/diagnostics.ts`（M） | 行 3 | P1 泛化 + notify | ✅ 76 行净增全为类型/notify/注释 |
| `apps/yjs-server/src/index.ts`（M） | 行 4 | P1 导出 | ✅ 11 行 |
| `apps/yjs-server/src/app.ts`（M） | 行 5 | deps 键名适配 | ✅ 4 行（1 改 + 3 注释） |
| `apps/yjs-server/test/diagnostic-replay-host-lifecycle-sa7.test.ts`（M） | 行 6 | 调用形状机械适配 | ✅ 零断言改动 |
| `apps/yjs-server/test/host-diagnostics-retirement-sa7-228.test.ts`（M） | 行 7 | 同上（2 处） | ✅ 零断言改动 |
| `.agents/skills/nomicore/cordis-host.md`（M） | 行 8 | P2-R1 | ✅ |
| `.agents/skills/nomicore/SKILL.md`（M） | 行 9 | P2-R2 | ✅ |
| `artifacts/sa3-issue393-*.log`（??，6 份） | 证据产物（非实现路径） | SA3 验证证据（仓内惯例：`git ls-files artifacts/` 64 份既有 `sa3-issue*` 先例） | ✅ DENY 的 `sa6-issue393-*.log` 零触碰 |
| `wiki/raw/task_issue-393_sa3_impl.md`（??） | SA3 skill 固定输出路径 | 实现报告 | ✅ Host/SA1/SA2/SA6/SA8 输入零改动（mtime 21:12–21:58 早于实现且未被覆写） |

DENY 核查：`packages/namespace-registry/src/**`、`packages/namespace-runtime/src/**`、replication/ws-replication 包、NDCL `src/index.ts`（`FileDiagnosticLog` 经 `:72` 既有 re-export 流经新成员——零改动成立）、schema/record/health/pipeline/emission/reader/retention/read-session、memory adapter（grep `runtimeEmitterFor` 零命中=非目标 R5 保持）、`docs/adr/**`、`CONTEXT.md`、`config.ts`、`lifecycle.ts`、4 契约文件、SA6 log——**全部零 diff**。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| `FileDiagnosticLog` +required 成员（类型面） | 仓内唯一字面量构造点 = `file.ts` 自身；`diagnostics.ts:169` 仅作返回类型注解（非 implementor）；其余消费经 factory/`ReturnType` | 全量 grep 复核；NDCL/app/registry tsc + 根 typecheck EXIT 0 | 无 | 无 |
| registry seam（optional 三成员） | `createDiagRuntime` 非抛探测 | concrete required 成员满足 optional seam（结构子集）；签名逐字同形 | 无 | 无 |
| raw log 直传的运行时行为迁移（legacy→泵） | DSH 仓外两部署 | 零代码改动路径成立（装配期生效）；仓内既有测试无 raw log 直传（SA2 全量 grep + 本轮复核 38 处 `diagnosticLog:` 注入面分类不变） | 仓外恢复不可本 worktree 证明（§10 动态项） | 无 |
| create 记录时序变化（raw log 直传：legacy 同步写 → 泵 macrotask drain） | 以 raw log 直传的读盘方 | ADR-0011 best-effort 语义内（崩溃窗口内 in-flight 记录可丢；满队 256 drop-newest）——issue 明文 P0 即「进泵路径」 | 属 Owner 定案语义；列 §10 动态项 | 无 |
| `createHostDiagnosticsManager` 签名破坏 | 仓内 3 调用点（app.ts + 2 测试）全部机械适配；外部消费者此前不存在（index 原无导出） | 全量套件绿 + `tsc -p apps/yjs-server` EXIT 0 | 无 | 无 |
| onEvent throw 语义（P1 泛化后 manager 吞没） | app `this.sink`（stdout NDJSON） | 观测面收紧（原沿栈上抛由 registry 吞）；P1-R2 零 throw 断言绿 | 无 | 无 |
| yjs-server 公共面新增导出 | 第三方（未来） | 增量；版本承诺留发布评审（设计 R7/SA2 O3 一致备案） | 发布面，非本票 | 无 |

## 8. 错误、恢复与并发

| 检查项 | 结论 |
|---|---|
| 错误吞没/伪装成功 | 无新增静默 fallback：P0 成员纯闭包零 throw；保留的静默点（其它 ns 泵内丢弃、无归属落本流）均为显式定案 + 契约锚（R3/R4）+ 文档。notify 吞没 onEvent throw 为设计 §7.2-3 定案的防御性收紧 |
| 部分完成诚实性 | 泵满队 drop-newest + `diag-pump-drop`（observer 缺席时静默）= issue 明文独立处理项（R4 follow-up），未伪装解决；SA3 报告 §Deferred 诚实列出 |
| 幂等 | `runtimeEmitterFor(ns)` 闭包恒返回同一 emitter 实例；registry 构造期一次读取缓存 resolver |
| 并发/竞态 | identity 比较无状态无时间键（#155 纪律）；per-ns FIFO/单飞 drain 为既有 #249 泵（零触碰）；`file.ts` 新成员零 IO |
| 回滚 | 纯代码增量，无 schema/wire/持久化格式变化（`recordVersion:1` 不变）；revert 即回滚；旧读者可读 |
| 生命周期竞态 | shutdown 后迟到泵任务 → resolver 仍命中（log 流存活）→ 落盘 = #226/#228 既有语义，对所有 binding 形状一致，非 P0 引入 |

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| `issue-393-ndcl-self-binding-red.test.ts`（R0–R4/G1–G4，9 tests） | resolver typeof/identity/undefined；strict reader 回读 root-mutation/replication-apply committed；跨 ns 计数不变；`REGISTRY_NOT_ACCEPTING` 恰 1 条 rejected；legacy 字面量恰 1 create/0 runtime；`initStream` 缺席；显式 binding 落盘 | 根 `pnpm test`（`vitest.config.ts` include `packages/*/test/**/*.test.ts`）+ CI test 分片（磁盘枚举自动收入新文件） | 无 skip/only/todo；断言全为运行时落盘行为；负控（G2 legacy）证明 R1 非任意形状皆红 | 无 |
| `issue-393-file-log-runtime-emitter-for-red.test.ts`（R1–R3/G1–G2，5 tests） | 成员在场/identity/其它 ns undefined；解析 emitter 真实落盘；resume 同 stream 自绑定续写 | 同上 | 复用既有 helpers（`test/helpers/base.ts`/`file.ts` 在场核实） | 无 |
| `issue-393-file-log-runtime-emitter-for-surface.test-d.ts`（R/G，2 tests） | 条件类型 `HasSelfBinding=true`；`emitter`/`namespaceId`/`rootDir`/`streamId` 零漂移 | `vitest run --typecheck`（typecheck.include 命中）+ CI 独立 `--typecheck.only` 作业 + `pnpm typecheck`（NDCL tsconfig `include: test/**` 覆盖） | optional 目标形态容忍 required 声明（设计 D1 兼容论证成立） | 无 |
| `issue-393-manager-export-and-skill-docs-red.test.ts`（P1-R1–R4/P2-R1–R2，6 tests） | 动态 import 公共入口；真实落盘恰 `['root-mutation']`；`unattributed`/`manager-closed`/`namespace-deleted` onEvent 事件；文档节四要素正则 | 根 `pnpm test`（`apps/*/test/**` include）+ CI 分片 | P2 文档内容契约有 SA6 §12.4 论证（交付物本体即文档）；`emitCapturingThrows` 显式断言零 throw（对未泛化签名敏感——SA6 probe 实测佐证） | 无 |
| 红灯真实性 | SA6 修复前红 log（14 红/6 绿）与全量基线（4 文件失败全为本票） | `artifacts/sa6-issue393-red-contracts.log` / `sa6-issue393-full-suite.log` | 契约文件未被改动：mtime 21:19–21:21 早于实现 22:11–22:33；红灯 log 用例名与当前文件用例名**逐字一致**（本轮逐条比对） | 无 |
| 绿灯归因 | 契约复跑 4 文件/22 tests 绿（`sa3-issue393-rerun-red-and-typecheck.log`：EXIT 0、Type Errors no errors）；全量 396 文件/4752 tests 绿 vs 修复前 4 failed/15 failed/Type Errors 1 failed（`sa3-issue393-rerun-full-suite.log` 尾部核对） | 同上 | SA3 另做 stash/pop 因果反转（5 红/4 绿）——输出未固化 artifacts（见 §12-O2），红灯归因已由 SA6 修复前基线独立承载 | 无 |
| 既有测试适配（2 文件） | 仅调用形状（`enabled` 删除、`sink`→`onEvent`），diff 逐行核对零断言改动 | `vitest run apps/yjs-server/test`（全量套件内绿） | 无 | 无 |

CI 触发性：`ci.yml` 三入口（`pnpm typecheck` / `--typecheck.only` / 分片 `vitest run`）均覆盖本票 4 文件；分片脚本按磁盘枚举，新文件自动落入。

## 10. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| DSH Hub（`nomicore-host`）/ Peer（`mabf-runner`）仓外零改动恢复 | 部署方：升级 NDCL ≥0.1.9 tarball + 重启 | `segments/` 持续出现 root-mutation / replication-apply 记录 | 重启后仍恒空（如部署侧另有 legacy 字面量接线） |
| 泵路径下 create/运行时记录的崩溃窗口丢失（best-effort 边界，与 legacy 同步写不同） | 部署方观测 / 压测 | 正常运行零丢失；进程崩溃时最后一批 in-flight 记录可缺 | 出现稳定运行期随机缺失（>256/ns 突发丢弃且无 observer 可见——已知 R4 follow-up 票范围） |
| 已构造 Runtime 不被回溯补挂（升级不重启场景） | 部署方 | 仅重启后生效（设计 §1 非目标显式声明） | 不重启即期待恢复 |
| `pnpm test` 全量套件在 CI Node 20/24 矩阵的稳定性 | CI | 6 分片 × 2 Node 版本全绿（本 worktree 单进程全量已绿） | 特定 Node 版本/分片组合失败 |

## 11. Required revisions

无 BLOCKER / MAJOR finding。无需修订。

## 12. Non-blocking observations

- **O1（版本策略备案，随发布评审）**：yjs-server 新增公共导出（`createHostDiagnosticsManager` + 5 类型）未随本票 bump 版本——AC 仅强制 NDCL，设计 §12/§13-R7 与 SA2 O3 已一致裁定留发布评审；建议发布评审时与 NDCL 0.1.9/0.2.0 取舍一并定案。
- **O2（证据固化惯例建议）**：SA3 的因果反转核验（stash P0 hunk → registry 契约 5 红/4 绿 → pop 逐字节恢复）只在报告记载、未固化 `artifacts/sa3-*.log`。红灯归因已由 SA6 修复前基线（`sa6-issue393-red-contracts.log` + 契约 mtime 早于实现）独立承载，不影响 verdict；后续同款证明建议照 64 份既有 `artifacts/sa3-issue*` 惯例落盘。
- **O3（文档微瑕）**：`cordis-host.md` 单 ns 示例的 Peer 组合根片段用 manager 而非单 ns 直传（Hub 片段用直传）——与「Peer 复制一或多远端 ns」的多 ns 倾向自洽，但「单 ns Peer 直传」未单独示例；语义已由上文覆盖，无行为影响。

---

## 附：本轮独立复核清单（证据基础）

diff 逐行（9 文件）；源码锚点：`file.ts:100-180/1430-1562`、`create-diagnostic.ts:255-303/305-353/385-590`、`diag-pump.ts:100-150`、registry `types.ts:880-905`、`diagnostics.ts:1-237`、`index.ts`（yjs-server/app/NDCL 三处）、`app.ts:55-70/270-295`、memory adapter grep；4 契约文件逐行通读 + 用例名与 `sa6-issue393-red-contracts.log` 逐字比对；`vitest.config.ts`/`ci.yml` 触发链；`green-capability.log` 尾部（无归属 legacy 落盘实测）；`sa3-issue393-rerun-{red-and-typecheck,full-suite}.log` 尾部（4/22 绿 + 396/4752 绿 + 4×tsc/根 typecheck EXIT 0）；mtime 全链（21:12 简报 → 21:19–21:21 契约 → 21:34 SA6 → 21:44 设计 → 21:58 SA8 → 22:10 SA2 → 22:11–22:12 实现 → 22:33 file.ts(stash/pop) → 22:44 SA3 报告）；`git stash list` 空、无 skip/only/todo、无 zz- 残留、DENY 全集空 diff、lockfile `link:` 无版本钉、`git ls-files artifacts/` 惯例核实。
