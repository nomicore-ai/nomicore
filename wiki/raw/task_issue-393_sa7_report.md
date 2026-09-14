# SA7 动态验证报告 — Issue #393：FileDiagnosticLog 自绑定（P0）+ manager 泛化导出（P1）+ skill 文档（P2）

- 验证人：SA7（Dynamic Verifier；独立动态验证，未参与 SA1–SA6/SA8 任一环节）
- 日期：2026-09-14；worktree：`/home/wangjian/nomicore-fix-issue-393`（HEAD `dcb3766` + SA3 未提交实现 diff，与 SA4 审查对象逐字节一致）
- 被验对象：SA4 verdict **approve** 之后的交付运行时行为（9 个 ALLOW 路径修改 + 4 个 SA6 契约文件）
- 验证范围（dispatch 指定）：自然组合（raw `FileDiagnosticLog` 直传 registry）下 runtime root-mutation 与 replication-apply 落盘；其它 namespace 不写本流；无归属公共入口拒绝的既定落盘语义；P1 manager 生命周期行为

---

## 1. Inputs

| 输入 | 位置 | 状态 |
|---|---|---|
| 任务简报（issue 正文 + Owner comment 5664521867，updated 2026-09-14T13:12:42Z） | `wiki/raw/task_issue-393.md` | 已读 |
| SA1 设计（approved；§8.3 数据流路线表为验证基准） | `wiki/raw/task_issue-393_design.md` | 已读 |
| SA6 诊断与验收契约（4 契约文件 + 差分臂/红灯基线） | `wiki/raw/task_issue-393_sa6_contract.md` | 已读 |
| SA3 实现报告 | `wiki/raw/task_issue-393_sa3_impl.md` | 已读 |
| SA4 实现静态审查（approve；§10 后续动态验证项） | `wiki/raw/task_issue-393_sa4_review.md` | 已读 |
| SA8 设计后冲突报告（clear；协议边界识别用） | `wiki/raw/task_issue-393_design_conflict_report.md` | 已读 |
| `_relevant_decisions.md` / `_conflict_report.md` | `wiki/raw/` | 不存在（SA6/SA1/SA2/SA8/SA3/SA4 六方一致确认；不阻塞） |

SA4 已 approve——SA7 仅可在其上独立发现 fail；本轮未发现任何下证事实。

## 2. Runtime environment

- Node `v24.13.0`；pnpm `10.28.2`；vitest `3.2.7`；测试统一 `NODE_OPTIONS=--conditions=nomicore-source`
- 纯库进程内验证（无端口/服务/网络）；所有 vitest/tsc 一次性进程已退出（`pgrep` 核查零残留）；`git stash list` 空
- `git status`：修改文件恰为 SA3 的 9 个 ALLOW 路径；4 契约文件与 SA6/SA3 证据 log 未跟踪原样、零触碰
- 驱动面：固定 Clock `1_700_000_000_000`、确定性计数随机源（ns…01/ns…02）、MemoryPersistence + fake scheduler、泵排空 = 有界 `setImmediate` 轮次（12）——与 SA6 契约同款夹具纪律（零 real sleep、零到达型 poll）

## 3. Changed Data Flow Verification

| Route | Design change | Runtime driver | Observed hops | Expected result | Actual result | Verdict |
|---|---|---|---|---|---|---|
| ① root-mutation（设计 §8.3-①） | raw log 直传由 legacy 回落改入 #226 泵路径；runtime 级 emission 落本 ns segments | SA7 临时 harness `R①`（raw log 整对象直传 → create/release/open → `mutateData`）+ SA6 R1 复跑 | (1) 构造期 `typeof runtimeEmitterFor === 'function'`；(2) `resolver(本 ns) === log.emitter`、`resolver(其它 ns) === undefined`（identity 数据键控）；(3) `mutateData` 返回 `{ok:true}` 后、macrotask drain **前** segments 中 root-mutation 记录 = 0（槽内 O(1) 入队，非同步写）；(4) drain 后本 ns 流 = `[namespace-create committed, root-mutation committed]`（strict reader 回读） | identity 解析 + 延迟投递 + 本 ns 落盘 | 全部命中（`artifacts/sa7-issue393-dynamic-harness.log` route=R1） | ✅ |
| ①b replication-apply（设计 §8.3-①） | 同一装配承载 runtime 级 replication emission | SA7 `R①-replication`（enableReplication → openReplicationSession → 合法远端 update `applyRemoteUpdate`）+ SA6 R2 复跑 | (1) apply 返回 `ok:true`；drain 前 replication-apply = 0；(2) drain 后本 ns 流 = `[namespace-create committed, replication-enable committed, replication-apply committed]` | replication-apply committed 落本流（共用装配，无需触碰 runtime/replication 包） | 命中（route=R2） | ✅ |
| ② 无归属公共入口拒绝（设计 §8.3-②、§7.1-D5 定案「接受落盘」） | 泵路径判别（`runtimeEmitterFor` 在场）+ `emitEarlyOutcome(namespaceId===undefined)` 恒走同步共享通道 → 落本流恰一次 | SA7 `R②`（shutdown 后 create → `REGISTRY_NOT_ACCEPTING`）+ SA6 R4 复跑 | (1) 业务拒绝 `{ok:false, code:'REGISTRY_NOT_ACCEPTING'}`；(2) **drain 前**本流已恰 1 条该 code 的 `rejected` 记录（同步共享通道跳点——与泵路径的 macrotask 延迟形成可区分证据）；(3) drain 后仍恰 1 条（无重复） | 恰一次、同步落本流、`result.kind='rejected'` | 命中（route=R2-unattributed pre/post-drain `landed:1`） | ✅ |
| ③ 其它 ns 不写本流（设计 §8.3-③） | 其它 ns 解析 undefined → 泵 drain 内静默丢弃；跨 ns 写入缺陷（B4/D0）消除 | SA7 `R③`（第二 ns create + open + mutate——覆盖 create 结局与 runtime emission 两类投递）+ SA6 R3 复跑 | 第一 ns 流 baseline = 2 条（create + root-mutation）；第二 ns 全生命周期（create/open/mutate）+ drain 后本流 = 同 2 条、逐条相等 | 本流记录数与内容不变 | 命中（route=R3 baseline/after `count:2→2` 且序列相同） | ✅ |
| ④ manager 事件面（设计 §8.3-④、P1） | `notify` 收口：`onEvent?` 缺席静默、throw 吞没；binding 语义零漂移 | SA7 `M1–M5`（经公共入口 `apps/yjs-server/src/index.js` 动态 import）+ SA6 P1-R1…R4 复跑 | (1) 多 ns：ns-a/ns-b 各落自己流的 `root-mutation`（streamId 互异）；(2) 共享通道 emit → `diagnostic-log-emission-dropped/unattributed` 恰 1 次经 onEvent、零落盘；(3) `close()` → 迟到解析返回丢弃桩、事件 `manager-closed`（携 ns 与不携 ns 两形态）、双 close 幂等；(4) `retireNamespace` → `namespace-deleted`（携 ns）且再 `initStream` 复活重建（un-retire 分支）后照常落盘；(5) onEvent throw / 缺席 → emit 面零 throw、流写面照常 | 事件词表/键控行为与 #226/#228 冻结语义一致 | 命中（route=M1–M5） | ✅ |

关键中间跳点均有运行时证据（identity 解析返回值、drain 前/后盘上记录计数、事件回调序列、strict reader 回读）——非仅最终断言。

## 4. Preserved Data Flow Verification

| Route | Preserved invariant | Runtime driver | Baseline observation | Current observation | Verdict |
|---|---|---|---|---|---|
| #150 legacy 字面量 | 裸 `{emitter}` 恰 1 条 create、0 条 runtime 记录（逐字节冻结） | SA7 `P-legacy` + SA6 G2 + 五套既有 #150/#226/#249 契约复跑 | SA6 基线 `sa6-issue393-baseline-registry.log`：55/55 绿 | SA7 `P-legacy`：`[namespace-create committed]` 恰 1 条、root-mutation 0 条；五套复跑 55/55 绿（`sa7-issue393-post-removal-verify.log`） | ✅ |
| `initStream` 成员缺席 | 不新增成员；泵路径缺席 → no-op | SA7 `P-eager`（`log.initStream === undefined`）+ SA6 G3/NDCL G1 | SA6 G3 绿 | 缺席保持 | ✅ |
| 构造期 eager 建流 | manifest/current.json/segments 构造期建立（「日志外观存活」面；#153） | SA7 `P-eager`（直接 `existsSync`/`readdirSync`） | #153 语义 | `<ns>/current.json` + `<ns>/streams/<id>/manifest.json` 在场、segments 目录 0 文件 | ✅ |
| no-op 装配 | `diagnosticLog` 缺席 → 零日志、业务零影响 | SA7 `SM-noop` | 既有行为 | create/open/mutate `{ok:true}` | ✅ |
| 适配的两个 app 调用点 | P1 签名泛化后 app 组合根行为零回归（仅调用形状适配） | `diagnostic-replay-host-lifecycle-sa7.test.ts` + `host-diagnostics-retirement-sa7-228.test.ts` 复跑 | SA3 全量套件绿 | 2 文件 / 8 tests 绿（`sa7-issue393-app-call-sites.log`） | ✅ |

## 5. State Machine Verification

| Initial state | Trigger | Expected transitions | Observed transitions | Forbidden transitions absent | Verdict |
|---|---|---|---|---|---|
| 无 log | 构造 registry | no-op 装配态（零日志） | 业务 ok、零记录面 | 不出现「缺席却落盘」 | ✅ |
| 裸 `{emitter}` | create+mutate | legacy 态：共享 emitter 同步直发 create 尝试；Runtime 无 `diagnosticEmitter` | 恰 1 create、0 runtime | 不出现 runtime 记录（结构性缺席保持） | ✅ |
| raw log（P0 后） | 构造 registry | 泵路径态：构造期一次非抛探测 → O(1) wrapper | resolver identity 命中；drain 前零 runtime 落盘 | 不出现「槽内同步写 segments」（ADR-0014 slot 外接线）——drain 前计数 0 证明 | ✅ |
| 泵队列非空 | mutate 后立即 `lease.release()` + `registry.shutdown()` | 迟到 drain 仍投递（流存活；#226/#228 既有语义） | shutdown 后 drain → root-mutation committed 落盘 | 不出现「shutdown 吞掉已接纳任务」或旧路径复活 | ✅ |
| manager open | `close()` | closed 态：解析 → `manager-closed` 桩；共享通道同报 `manager-closed`；幂等 | 双 close 零副作用；两形态事件齐 | 不出现 closed 后新流/写盘 | ✅ |
| manager open | `retireNamespace(ns)` | retired 态：解析 → `namespace-deleted` 桩（携 ns）；不重建 adapter | 恰 1 次事件携 ns | 不出现 retired 后落盘（直到显式 `initStream` un-retire——重建语义，另测复活） | ✅ |
| manager retired(ns) | 再 `initStream(ns)` | un-retire → ensureAdapter 重建 → 真实写面复活 | 复活后 emit 落该 ns 流 | —（合法转换） | ✅ |

## 6. Error and Cleanup Flow

- **emitter 同步 throw 全吞没**（SA7 `ERR-hostile`：敌意 emitter + identity resolver）：create/mutate 业务 `{ok:true}`，泵排空（12 轮 setImmediate）不抛、无 unhandled——ADR-0011 隔离边界运行时成立。
- **onEvent throw 吞没**（`M4`）：emit 面零 throw，流写面不受影响（记录照常落盘）。
- **清理时序**：`lease.release()` → `registry.shutdown()` → 迟到泵任务落盘后自然 quiescence；临时 harness 的 tmp 目录 `afterEach` 全清；无进程/端口/timer 残留。
- **部分完成诚实性**：无归属拒绝恰一次（pre/post drain 计数不变）；跨 ns 投递零泄漏（序列逐条比对）。

## 7. Temporary Diagnostics

- **添加项**：2 个临时 harness（`packages/namespace-registry/test/zz-sa7-issue393-dataflow.test.ts`（9 场景）、`apps/yjs-server/test/zz-sa7-issue393-manager.test.ts`（5 场景）），内含 `[SA7-DATAFLOW]` 前缀最小字段日志（route/step/关键值）——仅用于中间跳点观察，未改任何生产代码/既有测试。
- **删除项**：两文件已整文件删除；`git diff`（tracked）`grep -c SA7-DATAFLOW` = **0**；test 目录零 `zz-` 残留（worktree 其余 `SA7-DATAFLOW` 命中全部为历史任务的既有 tracked 报告，非本轮产物）。
- **Post-removal 验证**：删除后复跑 4 契约文件 + 5 legacy 套件 → **9 文件 / 77 tests / Type Errors no errors / EXIT 0**（`artifacts/sa7-issue393-post-removal-verify.log`），与删除前结果一致。
- 临时日志未进入 artifactPaths；stdout 证据固化于 `artifacts/sa7-issue393-dynamic-harness.log`（SA6/SA3 同款 artifacts 惯例）。
- 备注（harness 自身迭代，非实现缺陷）：`P-eager` 首版对 manifest 路径的假设写错（`<nsDir>/manifest.json`），按实际布局 `<nsDir>/streams/<streamId>/manifest.json` 修正后绿——修正仅发生在临时测试内。

## 8. Dynamic Evidence Matrix

| Source | Requirement or risk | Driver | Expected | Actual | Evidence | Result | Suggested routing |
|---|---|---|---|---|---|---|---|
| SA6 | R0–R4/G1–G4（自然组合契约主载体） | 4 契约文件复跑 | 全绿 | 4 文件/22 tests 绿 | `sa7-issue393-post-removal-verify.log` | ✅ | — |
| SA6 | #150/#226/#249 legacy 零漂移基线 | 5 registry 套件复跑 | 55/55 | 55/55 绿（与 SA6 基线一致） | 同上 | ✅ | — |
| SA6 | NDCL 适配器边界（identity/resume/落盘） | NDCL 契约 2 文件复跑 | 全绿 | 5+2(tests) 绿、Type Errors no errors | 同上 | ✅ | — |
| Design §8.3-① | 泵 macrotask 延迟投递（slot 外接线） | SA7 `R①`（pre/post drain 计数） | drain 前 0 / drain 后 ≥1 | 0 → 1（committed） | `sa7-issue393-dynamic-harness.log` | ✅ | — |
| Design §8.3-① | replication-apply 共用装配 | SA7 `R①-replication` | committed 落盘 | `[create, replication-enable, replication-apply]` 全 committed | 同上 | ✅ | — |
| Design §7.1-D5 | 无归属拒绝同步共享通道 + 恰一次 | SA7 `R②` | drain 前已落 1、drain 后仍 1 | 1/1（rejected） | 同上 | ✅ | — |
| Design §8.3-③ | 跨 ns 写入消除 | SA7 `R③`（create+runtime 两类） | 本流不变 | 2→2 且序列相同 | 同上 | ✅ | — |
| Design §8.3-④ | manager 生命周期（close/retire/复活/onEvent 隔离） | SA7 `M1–M5` | 词表行为零漂移 | 全部命中 | 同上 | ✅ | — |
| SA4 §10-1 | DSH 仓外零改动恢复（Hub/Peer 部署） | 仓外部署方（tarball+重启） | segments 恢复 | **不在本 worktree 可证范围**（SA3 §Deferred/设计 §13-R6 同判） | — | 环境边界 | 总控/部署方（非 SA7 fail） |
| SA4 §10-2/3 | 泵崩溃窗口丢失（best-effort）；已构造 Runtime 不回溯补挂 | —（设计显式非目标/既有语义） | — | 与 ADR-0011 best-effort 边界一致；本轮正常路径零丢失 | 设计 §9/§13 | 边界确认 | — |

额外发现：无（未扩大验证范围）。

## 9. Commands and Evidence

| # | Command | Result | Evidence |
|---|---|---|---|
| 1 | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run --typecheck <4 SA6 契约文件>` | 4 文件/22 tests 全绿；Type Errors no errors；EXIT 0 | 会话输出（终端 1） |
| 2 | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run <registry 诊断五套：create-diagnostic-red / -sa7-dynamic / -code-source / issue-226-red / issue-249-pump-red>` | 5 文件/55 tests 全绿；EXIT 0（= SA6 基线零漂移） | 会话输出（终端 2） |
| 3 | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/namespace-registry/test/zz-sa7-issue393-dataflow.test.ts apps/yjs-server/test/zz-sa7-issue393-manager.test.ts`（临时，已删） | 2 文件/14 tests 全绿；EXIT 0 | `artifacts/sa7-issue393-dynamic-harness.log`（含全部 `[SA7-DATAFLOW]` 跳点行） |
| 4 | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run apps/yjs-server/test/diagnostic-replay-host-lifecycle-sa7.test.ts apps/yjs-server/test/host-diagnostics-retirement-sa7-228.test.ts` | 2 文件/8 tests 全绿；EXIT 0 | `artifacts/sa7-issue393-app-call-sites.log` |
| 5 | 删除 2 个临时 harness → 复跑 4 契约 + 5 legacy 套件 | 9 文件/77 tests 全绿；Type Errors no errors；EXIT 0 | `artifacts/sa7-issue393-post-removal-verify.log` |
| 6 | `git diff \| grep -c SA7-DATAFLOW` → 0；`git status` 修改面 = SA3 的 9 个 ALLOW 路径；`git stash list` 空；`pgrep` 零测试进程残留 | 清理闭环 | 会话输出 |

## 10. Deviations

- 无设计偏离；无实现修订需求。
- 仓外面（SA4 §10-1 DSH 部署恢复、CI run 级矩阵）超出本 worktree 与 SA7 职责边界（不 push、不建 PR、不读远端 CI）——按环境边界记录，不作 fail 依据。
- SA7 未运行全仓 4752-test 回归（skill：只验证设计点名不变量）；既有面零漂移由五套 legacy 契约 + 两个适配 app 套件 + SA6/SA3 全量证据共同承载。

## 11. Verdict

**approve**

- 设计声明改变的数据流（①/①b/②/③/④）全部按设计变化且有中间跳点运行时证据；
- 声明保持的数据流（#150 legacy、initStream 缺席、eager 建流、no-op 装配、app 适配调用点）保持不变；
- 状态机转换（三态装配路由、泵延迟投递、manager close/retire/复活）与关键值正确，禁止转换（槽内同步写、跨 ns 写入、closed 后写盘、重复无归属记录）未出现；
- 错误与清理（敌意 emitter/onEvent 吞没、迟到 drain 落盘、quiescence）符合设计；
- 临时诊断已全部删除并经 post-removal 复跑证明结果不变。
