# SA3 Implementation Report — issue #471（Cordis rc.12 Hub/Peer/SessionHost 全链兼容）

状态：**iteration 3 实现闭合（SA9 ∥ SA10 双 reject 的 3 MAJOR + AC1/AC2/AC6/AC8 partial 全部闭合，证据已按冻结树重取）**。
最终证据（冻结树）：gates `12/12 PASS`、`--all --matrix` **41/41 PASS（exit 0）**、三基线 typecheck **3×15/15 exit 0**、每基线 lifecycle `units.observed=23 && coverage && foreignUnits=[] && issue420`、root-test **5956/5988 passed、32 名失败 ⊆ 冻结台账、`failedUnexpected=[]`、fresh complete JSON**、负控 N-1/N-2 与变异 M-1/M-2/M-5 全部「应红实红」并逐字节还原。**生产 `src/**` 零 diff，改动面恰为 §12.1 十文件 ALLOW。**
基线：`d59a4d1`（= Issue `## Parent` PR #469 head；`git rev-parse HEAD` 中该提交为父，起点提交为 `f7a3f74`）。
设计真源：`wiki/raw/task_issue-471_design.md`（rev 3 / §9.2 rev 2.1）；验收契约：`wiki/raw/task_issue-471_sa6_acceptance_contract.md`（AC1–AC9）；约束性裁决：`wiki/raw/task_issue-471_design_conflict_report.md`（§9.1 十文件 ALLOW、T-1…T-4、B-1…B-5、§14 I-1@rev2.1、R-2）。

---

## 1. Inputs consumed

- `wiki/raw/task_issue-471_sa9_standards.md`（全 214 行；0 BLOCKER / 3 MAJOR=SA9-1/2/3 / 5 MINOR=SA9-4…SA9-8）
- `wiki/raw/task_issue-471_sa10_spec.md`（全 164 行；AC3/4/5/7/9 satisfied；AC1/AC2/AC6/AC8 partially 阻断 + §3.1–§3.4 机械闭合判据 + §5 披露义务）
- 本轮 dispatch（逐条阻断项、`不得改变` 钉死面、复跑与报告要求）
- `wiki/raw/task_issue-471_design.md`（§9.1 十二 timer 族表、§9.2 G10 rev 2.1、§7.2 E1–E7、§13.0 B-3a…e、§12.1/§12.2 范围）
- `wiki/raw/task_issue-471_sa6_acceptance_contract.md`（A1-8 三段证据、AC2 全矩阵、A6-1/A6-2、§12.0「无证据即不通过」）
- `wiki/raw/task_issue-471_design_conflict_report.md`（SA8 裁决：B-3a…e、T-1a、R-2、§9.1 十文件闭合 ALLOW）
- iteration-2 报告与本文件（`git show f7a3f74:wiki/raw/task_issue-471_sa3_impl.md`）作为待修订基线
- 源码/设施实读（本轮）：`run-baseline.mjs`（root-test cell `:874–934`、lifecycle repeat 判定 `:619–692`、matrix 打印 `:981–995`）、`gates.mjs`（G10 词法/M4/探针）、`peer-namespace.ts`（`TIMER_DELAY_FIELD.close`、`removeTarget` 的 `armTimer('close')`、`onTimerFired('close')`、`startPeriodicReconcile`、`onGoaway`）、`hub-edge.ts`（`beginReauth` GOAWAY/deadline）、`plugin.ts`（`waitForLive` 25 ms 轮询、SessionHost 服务 getter 形态）、`ws-replication-guard-proxy-consumption.test.ts`（ADR 0023 断言形态）、`peer-connection.ts`（GOAWAY blocked deadline）
- CSV/证据落盘：`.cache/cordis-baselines/evidence/**`、`.cache/mutations/**`、`.cache/negative/**`、`.cache/export-capture/**`

## 2. Existing worktree reconciliation

起始工作树 = iteration-2 交付提交 `f7a3f74`（评审 reject 状态）。逐项核对 SA9 + SA10 后：

- **保留** iteration-2 已闭合面：G10 M4 跨行归属/`V_ctx` 边界/自检 16 行/分类表序、`baselines.json` 最小 diff、三步 typecheck 修复、lifecycle 提取口径、guard-proxy a64 文件级判据、BASE 台账捕获、N-1/N-2/M-1/M-2 证据。
- **本轮修改 7 个文件**（全部在十文件 ALLOW 内）：`run-baseline.mjs`、`gates.mjs`、`cordis-baseline-support.ts`、`ws-replication-cordis-root-channel.test.ts`、`ws-replication-cordis-root-timers.test.ts`、`ws-replication-cordis-baseline-lifecycle.test.ts`、`third-party-timer-ownership-red.test.ts`。
- **本轮零改动**：`baselines.json`、`root-test-known-red.json`（台账集合与语义原样）、`dsh-profile-direct-apply-order.test.ts`（其固定等待为有界谓词轮询，SA9-5 未点名，保留）。
- 未保留任何过时实现：旧 `T.close-drain-deadline`（走 `requestReauth`）、旧 `T.chunked-bulk-ack`（stall 却声称 ACK）、旧 reconcile trigger（首次 arm 同义反复）、旧 waitForLive（只测 stop reject）、旧 Fiber dispose（只查两个 30 ms delay）全部替换。

## 3. Changed paths（实际 10 文件 ⊆ §12.1 ALLOW）

| Path | Design section | Change |
|---|---|---|
| `packages/persistence/test/fixtures/cordis-baselines/baselines.json` | §7.1 | `base` 重钉 `d59a4d1…`；`suites` 追加 6 项；`comment` 增记 #471。**本轮未改**；对 BASE 仍为 **1 hunk 内 3 处语义编辑**（`+9/−3`） |
| `packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs` | §7.2 E1–E7 + E4a | **本轮**：root-test cell 改证据 fail-closed（删旧 JSON/新鲜度/完整提取/正数/名数一致）；matrix 统一 `counts.passed/total` 并显示 root-test 真实计数与台账分解；lifecycle 逐 repeat 判定（`repeatJudgements`）；`GUARD_PROXY_FILES` +新 channel 文件（A6-1）；`runs.length===repeat` fail-closed |
| `packages/persistence/test/fixtures/cordis-baselines/gates.mjs` | §7.3 | **本轮**：G10 M4 词法器重写为显式规则（R-COMMENT/R-STRING/R-REGEX/R-TEMPLATE/R-FAILCLOSED，注释透明、regex 体不透明、嵌套模板栈、不可判定⇒`UNRESOLVED-CROSSLINE`⇒类 6）；探针 8→29（注释 9 + regex 5 + 模板 6 + 不可判定 1）；G10 计数与全量命中记录零漂移 |
| `packages/ws-replication/test/ws-replication-cordis-root-channel.test.ts` | §9.1（A1-1…A1-7、A5-2/A5-4）+ **A6-1/A6-2** | **本轮**：新增 `C.guard-proxy.session-host.<baseline>`（SessionHost 三成员 guard-Proxy 消费 + 访问器姿态 + freeze 拒绝 + 稳定闭包 + `open/stop` 真实行为）与 `C.public-surface.{clock,namespace-registry,ws-replication/testing}`（BASE `d59a4d1` 运行时导出名钉死）；删除冗余固定 `delay(2)`。29→33 tests |
| `packages/ws-replication/test/ws-replication-cordis-root-timers.test.ts` | §9.1（A1-8、A3-4） | **本轮**：close/drain 改真实 CLOSE drain（`removeTarget` + 缝上扣留 `CLOSE_NAMESPACE`，`closeTimeoutMs` 到期本地收口；正常 `CLOSE_OK` 为取消段；与 reauth 互斥负控）；reauth 保留 `requestReauth` 并加反向负控；waitForLive 观察 25 ms poll **fire** + live resolve + stop reject；reconcile 以**新 SYNC_STEP1 round id** 为 trigger；bulk ACK 正常放行末帧并观察 `chunked-sync-acked`（sender=peer）；删除装饰性 `peerAssembly.timer` 断言 |
| `packages/ws-replication/test/ws-replication-cordis-baseline-lifecycle.test.ts` | §8（AC2 + β/γ + N-5） | **本轮**：fiber-dispose 改 `meter.pending()===0`（全 delay 族，非两个 30 ms）；删 `delay(5)` 改显式事件轮次；删 `createNamespaceRegistryForTesting` 装饰断言、未赋值 `sessionHandle`、装饰性 `sinkOpened`；JSON 命名注释改 Vitest 单空格 |
| `packages/ws-replication/test/cordis-baseline-support.ts` | §8.1（meter/宿主/装配/waitFor/sink） | **本轮**：删死导出 `RUNNER_MODE`/`captureMessage`/`EventSink`/`createEventSink`/`RuntimeDependencies`/`provideRuntimeDependencies`/`CloseRecorder`/`recordCloses`；`delay`/`FAULT` 收为模块私有；头部「stay untouched」「`' > '`」注释纠正 |
| `apps/yjs-server/test/third-party-timer-ownership-red.test.ts` | §10（A3-2、A4-1…A4-3） | **本轮**：两处固定 30/25 ms 等待改 `waitFor(predicate,label,deadline)`（慢 CI 不抖动） |
| `packages/dsh-persistence/test/dsh-profile-direct-apply-order.test.ts` | §10.1（A4-4） | **本轮未改**（其 5 ms 为有界谓词轮询，非裸等待） |
| `packages/persistence/test/fixtures/cordis-baselines/root-test-known-red.json` | §13.0/D-6（A8-4） | **本轮未改**：`knownRed=4` + `environmentRed=28` 集合原样；台账语义（B-3a…e）不放宽 |

## 4. SA2 / SA4 / SA8 既有闭合（保留，不回退）

| Finding | 状态 |
|---|---|
| SA2 F-1（E4a fault 贯通全部 `runVitest`） | 保留；N-2 逐 suite fail 实跑复证 |
| SA2 F-2/F-3/F-4/F-5r/F-6/F-7 | 保留（G10 词表、归置、23 名枚举、旋钮、G2/G3 形状） |
| SA4-1 / SA8 §8-1(a)（M4 跨行 fail-closed） | 保留并**加强**为注释/正则/模板透明（SA9-2/SA9-8） |
| SA4-2（分类表序）/ SA4-5（最小 diff）/ SA4-6（units 提取口径） | 保留 |
| SA8 D-2/D-3（kind=2 装配、G8 两行钉死）/ I-2（G12） | 保留；矩阵与 gates 复证 |

## 5. SA9 Finding 落实（本轮）

### SA9-1（MAJOR）/ SA10-AC8 — root-test cell 证据 fail-closed

**修前缺陷**：命令无 `--passWithNoTests=false`；`jsonPath` 不删除、无新鲜度校验；`JSON.parse` 失败只把 `counts=undefined`，`failedTestNames` 保持 `[]` ⇒ `failedUnexpected=[]` ⇒ `status:'pass'`。同一实现可「本轮无有效证据」仍产 PASS。

**修法（`run-baseline.mjs` `runRootTestCell`）**：
1. 运行前 `fs.rmSync(jsonPath,{force:true})` —— 上一轮 JSON 永不作为本轮证据；
2. 命令显式 `--passWithNoTests=false`；
3. 记录 `startedAt`；证据必须：存在 ∧ 可解析 ∧ `mtime >= startedAt` ∧ 三个 counts 均为有限数 ∧ `numTotalTests > 0` ∧ `testNames.length === numTotalTests` ∧ `failedTestNames.length === numFailedTests` ∧ 进程未被信号终止；
4. 任一不满足 ⇒ `evidence.problems[]` 非空 ⇒ `status:'fail'`（台账只能解释失败名，不能解释证据缺失）；合法 32 名（4 knownRed + 28 environmentRed）仍判绿，`exitCode:1` 保留为诊断；
5. `printMatrix` 统一 `counts.passed/total`，root-test 行显示真实计数与台账分解，不再 `undefined/undefined`。

**修复前后差异**：`root-test.json` 现携带 `evidence:{jsonPath,fresh:true,problems:[]}`、`ledger:{knownRed:4,environmentRed:28}`、`counts{passed,failed,total,numTotalTests,…}`；矩阵行 `5956/5988 (32 known-red: 4 frozen + 28 environment)`。

**负控（6/6 应红实红，`failedUnexpected=[]` 仍红）**：见 §9.4。

**证据**：`.cache/cordis-baselines/evidence/root-test/{root-test.json,root-test.vitest.json,root-test.log}`；`.cache/negative/root-failclosed/{root-failclosed.json,run.mjs,fake-vitest.mjs,root-failclosed-*.log}`。

### SA9-2（MAJOR）/ SA10-AC5 补强 — G10 对「注释后的跨行 `'root'` 实参」不再静默漏检

**修前缺陷**：`previousNonSpace` 只跳空白不跳注释，注释文本末字母被当作实参前导字符 ⇒ `argumentStart=false` ⇒ 静默按非候选丢弃（违背「不可解析 ⇒ 候选 ⇒ 类 6」）。

**修法（`gates.mjs` `m4ContextsOf`）**：M4 词法器重写为显式规则集（注释写在函数头）：
- **R-COMMENT**：`//`、`/*…*/`（含 JSDoc）非代码，且对 token 邻接透明——`argumentStart` 的「前一有效 token」与被调点链都跳过注释；被调链与 `(` 之间夹注释也透明；
- **R-STRING**：`'…'`/`"…"` 为代码定界，内部不透明；`'root'` 记录开启引号前的有效代码字符；
- **R-REGEX / R-TEMPLATE / R-FAILCLOSED**：见 SA9-8；
- **不可判定 ⇒ 候选 ⇒ 类 6**：`UNRESOLVED-CROSSLINE`。

**修复前后差异**：注释形态由「静默非候选」变为「归属或被调 ⇒ 类 6」；BASE 实存零变化（见 §7）。新增探针 **8→29**：同行/跨行 × 块/行/JSDoc 9 条、被调链夹注释 2 条、注释散文负控 1 条、regex 5 条、嵌套模板 6 条、不可判定 1 条。

**真实文件注入红证（3/3）**：`//` 跨行、块注释/JSDoc 跨行、regex+嵌套模板；均 G10 FAIL、`cat 6` 命中预期 callee、gates exit 1。变异 M-6（回退注释透明）⇒ 3 条探针 FAIL；M-7（回退 regex）⇒ 2 条；M-8（回退模板表达式）⇒ 1 条。

**证据**：`.cache/negative/g10-iter3/{injections.json,gates-mutations.json,*.log}`；`.cache/cordis-baselines/evidence/gates/gates.log`（冻结树 29/29）；`.cache/gates-iter3-try3.log`（同判据复跑）；`.cache/gates-before-iter3.log`（修前 8/8）；`.cache/gates-hits-{before,final}.txt`（记录级 diff 仅行号位移）。

### SA9-3（MAJOR）/ SA10-AC1 — 十二族 arm → trigger → cancel 全部可证伪

| 族 | 本轮修法（trigger 证据） | before → after |
|---|---|---|
| reconcile interval | 记录触发前 peer 轮次基线 `peerRoundIds(wire)`，要求**严格更大的新 `SYNC_STEP1` syncRoundId** 出现（周期回合真实启动），再要求 rhythm 二次 arm；`peer.stop()` 后 `pendingFor(interval)=0` 且 round 截止 0 | 「首 arm 后恒真」→ 新 round id（M-5 变异：禁止周期回合 ⇒ 恰该用例红，其余 0 红） |
| peer `waitForLive` | (a) 25 ms poll arm；(b) poll **真实 fire**（`entry.fired`）；(c) 非 live 状态复检；(d) `addTarget` 后 **live resolve**；(e) 独立 stop→reject + pending=0 | 只测 stop reject → 五段可观察 |
| close/drain deadline | 真实 CLOSE 排水：`peer.removeTarget` + 缝上扣留 `CLOSE_NAMESPACE`（`makeWire.dropNextPeerToHub`）⇒ `armTimer('close')=closeTimeoutMs` 到期本地收口（namespace `closed`）；取消段＝正常 `CLOSE_OK` 在预算内清定时器且**从未 fire**；负控：无 GOAWAY、连接保持 ready（不是 reauth 路径） | 与 reauth 共用 `requestReauth` → 独立 driver + 互斥负控 |
| reauth deadline | `hub.requestReauth`：GOAWAY(REAUTH_REQUIRED) → `close(1001,'hub-reauth')`；负控：无 `CLOSE_NAMESPACE`、非 `blocked-deadline`/`goaway-drain` | 保留 + 反向负控 |
| bulk-transfer ACK | 正常放行末帧（不 stall）：真实 kind=2 chunked SYNC_STEP2（≥2 chunk）→ sender(peer) 观察 **`chunked-sync-acked`** 结算 → assembly 预算清零且无 `chunked-sync-aborted` | 「stall 却声称 ACK」→ 真实 ACK；独立 `T.assembly-timeout` 保留 `reason:'timeout'` |
| 装饰性断言 | 删除 `peerAssembly.timer` defined、`sinkOpened` 自增断言、`createNamespaceRegistryForTesting` 恒真断言、未赋值 `sessionHandle` | SA9-6 同步清理 |

### SA9-4（MINOR）— 逐 repeat 判定

`run-baseline.mjs` 现在对 **每个 repeat** 计算 23 名/`coverage`/`foreignUnits`/issue420，全部须通过（`cell.repeatJudgements[]` 留证），且 `runs.length === repeat` 失败即红；最后一轮不再掩盖前轮。**证据**：三基线 `replication-lifecycle.json` 的 `repeatJudgements` 均为 `[true,true,true]`。

### SA9-5（MINOR）— 固定墙钟等待改谓词

- `apps/yjs-server/test/third-party-timer-ownership-red.test.ts`：30 ms/25 ms 固定 wait → `waitFor(() => armed/fired, label, deadline)`；`expectQuiet` 的「持续不发生」判据保留。
- lifecycle fiber-dispose 的 `delay(5)` → 两次显式 `setImmediate` 事件轮次（有界、非墙钟）。

### SA9-6（MINOR）— 死导出/死变量/装饰断言

见 §3 表。`cordis-baseline-support.ts` 仅保留被消费的导出；两处测试装饰断言与未赋值变量删除；`FAULT`/`delay` 收为私有。

### SA9-7（MINOR）— 摘要字段与陈旧注释

1. `printMatrix` 统一 `counts.passed/total`；root-test 行显示 `5956/5988 (32 known-red: 4 frozen + 28 environment)`；
2. helper/lifecycle 的 `' > '` 注释改为 Vitest 单空格事实；runner「stay untouched」表述删除（单 runner 口径）；
3. 本报告清理 iteration 间陈旧数字：`baselines.json` 为 **1 hunk 内 3 处语义编辑**；G10 探针为 **29/29**（非 12/12 或 16/16 旧数）；本轮 root-test 为 **5956/5988**（较 iter-2 的 5952/5984 恰 +4 = channel 文件新增 4 tests）。

### SA9-8（MINOR）— 手写词法器的 regex/嵌套模板显式规则

规则文本写入 `m4ContextsOf` 头注释（R-REGEX/R-TEMPLATE/R-FAILCLOSED），并加探针：
- regex：`/\)/`（不配对括号不破坏栈）、`/\/\* not a comment/`（注释外形不进入注释态）、`a / b`（除法非 regex）、`/x/`、`/'/`（引号在 regex 内不开启字符串）；
- 嵌套模板：`${ {a:1} }`、`${ Reflect.get(...) }`、`outer ${ \`inner ${…}\` }`、模板文本 `'root'` 非候选；
- 不可判定：未闭合 regex ⇒ 后续实参 `UNRESOLVED-CROSSLINE` ⇒ 类 6。
变异 M-7/M-8 证明规则载荷（各 2/1 条探针应红）。

## 6. SA10 AC 闭合（AC1/AC2/AC6/AC8）

### AC1（A1-8 三段证据）

12 族全部具备「arm（delay=配置值）→ trigger（可观察后果）→ cancel（stop/close/dispose 后同类 delay pending=0）」，4 个被点名的族（reconcile / waitForLive / close-drain / bulk ACK）按 §5 SA9-3 修法重写。三基线 `ws-cordis-timers` 12/12 × repeat 3 全绿（`.cache/cordis-baselines/evidence/B{1,2,3}/B*-ws-cordis-timers-repeat3.log`）。

### AC2（Fiber dispose 全量清零）

`L.<entry>.fiber-dispose` 在 `handle.fiber.dispose()` 完成后、任何 root cleanup 前断言 `meter.pending() === 0`（**全部 delay 族**的 live arm 集合为空；远强于原 `pendingFor(HELLO)`/`pendingFor(BOOTSTRAP)` 两个同为 30 ms 的 delay），并保留零 `unhandledRejection`。三基线 × 3 entry × repeat 3 通过，`units.observed=23`、`coverage=true`、`foreignUnits=[]`、`issue420={present:true,tests:10}` 不缩水。

### AC6（A6-1 SessionHost guard-Proxy + A6-2 七 entry 导出面）

- **A6-1**：`ws-replication-cordis-root-channel.test.ts` 新增 `C.guard-proxy.session-host.<baseline>`：`nomicoreHubSessionHost` 的 `status/open/stop` 在 guard-Proxy（get 返回包装闭包）下全部 ACCESS_OK；诚实 Proxy 负控、敏感性正控（冻结数据成员抛 TypeError）；guard 下的 `open()` 真实开会话（sessions 1→0）、`stop()` 缓存 Promise 恒等且 drain 后 `open` loud 抛；逐成员 descriptor 无 `value`/无 setter/不可配置/可枚举 + `Object.isFrozen` + 赋值/defineProperty 抛 TypeError。该文件已加入 `run-baseline.mjs` `GUARD_PROXY_FILES`（三基线 guard-proxy 71/71，`a64` 三 true）。
- **A6-2**：新增 `C.public-surface.{clock,namespace-registry,ws-replication/testing}`，以 **BASE `d59a4d1` 干净 worktree 运行时捕获**（G5 farm 同法；`.cache/export-capture/base-exports.json`）钉死导出名集合；不修改冻结的 `public-surface.base.json`，4/7 + 3/7 = 7/7 entry 全覆盖。三基线均绿。

### AC8（root-test fail-closed）

见 §5 SA9-1；台账集合（4+28）、名级谓词、新文件永不入账、`disclosure` 语义原样；矩阵 `root-test` cell pass，`status` 不再可能在无有效证据时成立。

## 7. G10 分类对账（零漂移）

冻结树实跑：`{"1":20,"2":13,"3":9,"5":4,"6":0,"5D-R":197,"5D-C":46}`，`scanned=738 cordis_faced=51`，**类 6 恰空**，seam 自校验 2/2，回归自检 16/16，cast 探针 18/18，跨行 M4 探针 **29/29**。

机械分桶（`.cache/m4-alignment/base-subset.mjs`）：**BASE 子集 285 条 = `1=19 2=13 3=7 5=4 5D-R=196 5D-C=46 6=0`（= I-1@rev2.1 逐项）**；新增文件命中仍 **4 条**（`1:1/3:2/5D-R:1`），全部来自本票新增文件。与 iteration-2 的全量记录 diff 仅为 **3 处行号位移**（本票文件内部编辑所致），类别/token/文件不变。**候选词表、允许清单（2 seam 行 + 3 fixture 双读行 + 恰 2 文件级）、分类计数基线、台账集合、23 名枚举语义均未改。**

## 8. Verification（冻结树实跑，证据在 `.cache/`）

| # | Command | Result | Evidence |
|---|---|---|---|
| V-1 | `node packages/persistence/test/fixtures/cordis-baselines/gates.mjs` | **12/12 PASS，exit 0**（G10 29/29 探针） | `.cache/cordis-baselines/evidence/gates/gates.log`（冻结树直跑归档；矩阵 gates cell 同判据）；`.cache/gates-final-iter3.log` |
| V-2 | `node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs --all --matrix` | **41/41 PASS，exit 0**；`MATRIX PASS: 41 cells` | `.cache/cordis-baselines/evidence/matrix/{matrix.json,matrix.log,unit-union.json}`；stdout `.cache/matrix-final-iter3.log` |
| V-3 | 三基线 typecheck（矩阵逐 project） | **3×15/15 project exit 0** | `.cache/cordis-baselines/evidence/B*/B*-typecheck.json` + 逐 project 日志 |
| V-4 | 三基线 `replication-lifecycle`（repeat 3） | 每基线 **34/34**、`units={23,23,[]}`、`coverage=true`、`foreignUnits=[]`、`issue420={present,tests:10}`、`repeatJudgements=[true,true,true]`；并集 **69** | `.cache/cordis-baselines/evidence/B*/replication-lifecycle.json`；`matrix/unit-union.json` |
| V-5 | 三基线 `guard-proxy`（7 文件，含新 channel 文件） | 每基线 **71/71**、`a64={issue246,issue418Contract,issue418Structure}=true`；`nomicoreHubSessionHost` 用例在场 | `.cache/cordis-baselines/evidence/B*/guard-proxy.json` |
| V-6 | 三基线 `ws-cordis-channel` / `ws-cordis-timers`(×3) / `composition-root` / `ws-package` | **33/33、12/12×3、28/28、66/66**（每基线） | `.cache/cordis-baselines/evidence/B*/…` |
| V-7 | 三基线 `provenance` / `root-probe` / `contract` / `real-timer` / `dsh-profile` / `unload` | 4/4（B3 8/8）、12/12、243/243（B3 247/247）、11/11×3、12/12、10/10 | 同上 |
| V-8 | 默认布局聚焦（新文件） | channel 33/33、timers 12/12、lifecycle 24/24、ownership 4/4、dsh-profile 2/2；`Type Errors: no errors`；三基线内部走 repeat 3（V-6） | `.cache/{channel,timers,lifecycle,ownership}-iter3-try*.log` |
| V-9 | 受影响 project typecheck | `packages/ws-replication` / `apps/yjs-server` / `packages/dsh-persistence` 均 exit 0 | 本会话实跑 |
| V-10 | `git diff --name-only d59a4d1 -- 'packages/*/src' 'apps/*/src' 'domains/*/src'` | **空（生产 src 零 diff）** | §8 |
| V-11 | `git diff --name-only d59a4d1`（非 wiki） | 恰 **10 文件**（7 个本轮修改 + 3 个自 iteration 2 起已在 HEAD 的台账/基线文件）⊆ §12.1 十文件 ALLOW | 本会话实跑 |
| V-12 | `node .cache/evidence-tools/unit-union.mjs` | `observedUnion=69 problems=[]` | `matrix/unit-union.json` |

## 9. 负控与变异（本轮全部重取）

### 9.1 N-1 / N-2（B3，逐 suite `cells[]` 判据）

| # | 实跑 | 结果 |
|---|---|---|
| N-1 | `--baseline B3 --suite provenance --suite root-probe --suite ws-cordis-channel --fault substitute-npm` | 外层 exit 0（编排事实）；`cells[]` 三 suite 各自 `status:'fail'`（provenance realpath/lib tree drift；root-probe/channel 通道断言红） |
| N-2 | `--baseline B3 --suite root-probe --suite ws-cordis-channel --fault legacy-shim` | 外层 exit 0；`cells[]` 两 suite 各自 `status:'fail'` |
| 正控 | 同 suite 无 fault 三基线全绿 | V-2/V-6 |

证据：`.cache/cordis-baselines/evidence/B3/{fault-substitute-npm.json,fault-legacy-shim.json}`、`.cache/negative/{N1-iter3.log,N2-iter3.log}`。

### 9.2 M-1 / M-2 / M-5（`.cache` workspace 副本，逐字节还原）

| 变异 | 结果（B1/B2/B3） |
|---|---|
| M-1（删 legacy 兜底） | channel 红：B1/B2 **4**（设计预期 3 = `C.legacy-only.{hub-listen,peer-dial,session-host}` 全在场；第 4 条为 **同因**新增的 `C.guard-proxy.session-host.*`——npm 基线仅 legacy 通道，删除兜底后真实 TimerService 的 SessionHost 面同样不可解析，属更强红），B3 **3**；`ws-package` 仍 66/66（缺口证明） |
| M-2（legacy 优先） | channel **9 红**（`C.both.priority.*` + `C.malformed.*` + `C.symbol-only.*`），`ws-package` 66/66；三基线一致 |
| M-5（禁止周期 reconcile 回合启动） | timers **恰 1 红 = `T.reconcile-interval`**，其余 0 红；三基线一致 |
| 还原 | 3 基线 × 3 变异 = **9/9** `sameAsPristine=true ∧ sameAsHead=true`（`plugin.ts` 39033 B、`peer-namespace.ts` 115712 B）；最终态再次逐字节校验 |

证据：`.cache/mutations/{mutations.json,mutations-driver.log,*log}`。

### 9.3 G10 注入/变异（真实文件注入 + 规则回退）

- 注入 `Reflect.get(\n ctx,\n // comment\n 'root',\n)` ⇒ G10 FAIL `cat 6 (1) callee=Reflect.get`；
- 注入块注释/JSDoc 跨行 ⇒ 同上；
- 注入 regex（含引号/注释外形）+ 嵌套模板 + `safeReadChannel` 跨行 ⇒ `cat 6 (2)` 两 callee；
- 变异 M-6（注释不透明）⇒ 3 探针 FAIL；M-7（regex 不处理）⇒ 2 探针 FAIL；M-8（模板表达式视为文本）⇒ 1 探针 FAIL。每次注入后文件删除，`git status` 无残留。

证据：`.cache/negative/g10-iter3/{injections.json,gates-mutations.json,inject-*.log,M-*.log}`。

### 9.4 root-test 证据 fail-closed 负控（6/6）

真实 runner 代码 + 仅替换 vitest 二进制与证据目录；每例均 `exit=1`、cell `status:'fail'`、`failedUnexpected=[]`、`evidence.problems[]` 非空：

| 模式 | problems |
|---|---|
| missing | `root-test JSON evidence missing: the reporter wrote no file for this run` |
| malformed | `root-test JSON unparsable: …` |
| stale（上一轮名字全知的旧 JSON 留在盘上） | 旧文件被删除 ⇒ `missing`（旧证据永不复用） |
| stale-mtime（写合法 JSON 但 mtime 早于本轮） | `root-test JSON is stale: mtime=… predates this run` |
| zero | `root-test JSON reports zero tests`（`--passWithNoTests=false`） |
| mismatch | `test extraction mismatch: numTotalTests=3 extracted=2` |

证据：`.cache/negative/root-failclosed/{root-failclosed.json,root-failclosed-*.log}`。

## 10. 未闭合项、披露与边界

1. **A8-4 披露（表述禁令，必须随交付摘要/PR）**：root-test 行按**冻结台账**判绿（B-3a…e）。账内红 = **4 例 BASE 既有 test-d 红**（`packages/ws-replication/test/ws-replication-issue421-edge-factory-api.test-d.ts`，expect-type 1.4.0 可选参数元组不兼容；#470 已裁定另立后续票、本票 ALLOW 内不可修）+ **28 例环境红**（环境 pnpm 11.28.5 与 `packageManager=pnpm@10.28.2` 未对齐；BASE 对齐复跑 `5913/5909/4` 已证 28 例转绿）。**不得声称「root-test / CI / 所有既有测试全绿」**；本票只声明：三基线矩阵 41/41 绿、新增文件在默认布局与三基线全绿、跑动测试的红名集合恰等于 BASE 冻结台账（`failedUnexpected=[]`）。
2. **SA4-7/8/9 残余边界**：G10 是手写词法器（非完整 JS parser）。本轮已把注释/regex/嵌套模板写成显式规则并提供探针与变异红证；仍未建模的极端 JS 形态（例如把 code 注入到 by-design 不可解析的非法语法）由 `R-FAILCLOSED` 兜底为类 6，不静默丢弃。PR 应保留「非完整 JS parser」的披露。
3. **B3 工件边界**：B3 为 DSH `1511a6ed…` vendored rc.12 的 minimal tsc source-build（非官方流水线），`baselines.json:109` 与 SA3 均明示；未做真实 Host 部署、未改 `patchedDependencies`、未宣称可删 Host patch。
4. **D-2/D-3**：kind=2 真实 SYNC_STEP2 驱动装配预算（SA8 RATIFY）与 G8 两行钉死（R-2）原样保留。
5. **本轮未新增任何允许清单条目、未改扫描面、未改 N-6 内容、未动 G11/G12 语义、未改台账集合与 23 名枚举**；`cat_*` 相对 I-1@rev2.1 的差异仍恰为 SA8 批准的 4 条新增文件命中。

## 11. Suggested commit message（仅供 Controller 选择）

```
test(ws-replication): #471 three-baseline Hub/Peer/SessionHost acceptance matrix

- new suite registration + 41-row matrix on B1/B2/B3 (ws-cordis-channel 33,
  ws-cordis-timers 12x3, replication-lifecycle 34x3, guard-proxy 71, composition-root 28,
  ws-package 66) and root-test cell with fresh-evidence fail-closed judgement
- real baseline TimerService arm/trigger/cancel evidence for all 12 timer families:
  reconcile is triggered by a strictly new SYNC_STEP1 round id, waitForLive observes the
  25 ms poll firing and the live resolve, close/drain is driven by a real CLOSE drain
  (withheld CLOSE_NAMESPACE => closeTimeoutMs deadline) and reauth by requestReauth,
  bulk ACK is the real chunked-sync-acked settlement, assembly timeout keeps reason=timeout
- AC2: fiber dispose asserts the full pending set is empty (every delay family), not a
  hand-picked pair; lifecycle 23 units/coverage/foreign/issue420 are judged per repeat
- AC6: nomicoreHubSessionHost guard-Proxy consumption (accessors, freeze, stable closures,
  write/defineProperty rejection) + the remaining three public entries
  (@nomicore/clock, @nomicore/namespace-registry, @nomicore/ws-replication/testing)
  pinned from a clean BASE d59a4d1 runtime capture
- AC8: root-test cell deletes stale JSON before the run, requires valid/fresh/complete
  evidence (presence, parse, mtime, positive total, exact name-count agreement) and is red
  otherwise; --passWithNoTests=false; the known-red ledger explains names only.
  Six negative controls (missing/malformed/stale/stale-mtime/zero/mismatch) are red while
  failedUnexpected stays empty
- G10: M4 lexer now has explicit rules (comments transparent for token adjacency, regex
  bodies opaque, nested templates, undecidable state => UNRESOLVED-CROSSLINE => class 6);
  probes 8 -> 29 (comment/regex/template variants) with three real-file injection proofs
  and rule-revert mutations red; classification and the BASE subset (285 records) unchanged
- M-1/M-2/M-5 mutations red on their target suites with byte-exact restore
- known-red disclosure (A8-4): the default layout keeps 4 pre-existing test-d reds in
  ws-replication-issue421-edge-factory-api.test-d.ts (expect-type 1.4.0 optional-parameter
  tuple incompatibility; follow-up ticket, out of this ticket's ALLOW) and #470's 28
  environment reds (ambient pnpm 11.28.5 vs packageManager pnpm@10.28.2; the aligned
  pnpm@10.28.2 re-run captured 5913/5909/4, i.e. all 28 turned green). The ledger greens
  the names, not the process: root-test native exitCode is 1. This commit does NOT claim
  the root-test, CI or all existing tests are green, and does not claim G10 is a complete
  JavaScript parser.

Verification: gates 12/12; matrix 41/41 PASS; typecheck 3x15/15; lifecycle units 23/coverage
per baseline (union 69); guard-proxy 71/71 x3; root-test 5956/5988 with failedUnexpected=[].
Zero production src diff; changed paths = the ten-file closed ALLOW set.
```

## 12. 已执行命令清单（可复核）

```bash
# 环境
node -v                                              # v24.13.0
git rev-parse HEAD                                   # f7a3f74（父 d59a4d1）
pnpm --version                                       # 11.28.5（环境未对齐；对齐复跑见 §10-1）

# 冻结树最终判定
node packages/persistence/test/fixtures/cordis-baselines/gates.mjs                 # 12/12 PASS
node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs --all --matrix   # MATRIX PASS: 41 cells
node .cache/evidence-tools/unit-union.mjs                                         # observedUnion=69 problems=[]
node .cache/m4-alignment/base-subset.mjs .cache/gates-final-iter3.log             # BASE=285 / new=4
node node_modules/typescript/bin/tsc -p packages/ws-replication/tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p apps/yjs-server/tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p packages/dsh-persistence/tsconfig.json --noEmit

# 默认布局聚焦
NODE_OPTIONS=--conditions=nomicore-source node node_modules/vitest/vitest.mjs run \
  packages/ws-replication/test/ws-replication-cordis-root-timers.test.ts --passWithNoTests=false      # 12/12
NODE_OPTIONS=--conditions=nomicore-source node node_modules/vitest/vitest.mjs run \
  packages/ws-replication/test/ws-replication-cordis-root-channel.test.ts --passWithNoTests=false     # 33/33
NODE_OPTIONS=--conditions=nomicore-source node node_modules/vitest/vitest.mjs run \
  packages/ws-replication/test/ws-replication-cordis-baseline-lifecycle.test.ts --passWithNoTests=false # 24/24
NODE_OPTIONS=--conditions=nomicore-source node node_modules/vitest/vitest.mjs run \
  apps/yjs-server/test/third-party-timer-ownership-red.test.ts \
  packages/dsh-persistence/test/dsh-profile-direct-apply-order.test.ts --passWithNoTests=false           # 6/6

# SA9-1 证据 fail-closed 负控（真实 runner 代码 + fake vitest）
node .cache/negative/root-failclosed/run.mjs          # 6/6 red, failedUnexpected=[]
# SA9-2/SA9-8 G10 真实注入与规则变异
node .cache/negative/g10-iter3/run.mjs                # 3/3 injections red
node .cache/negative/g10-iter3/gates-mutations.mjs    # M-6/M-7/M-8 red
# 变异 M-1/M-2/M-5 + 逐字节还原
node .cache/mutations/run-mutations.mjs               # 3 baselines; restores 9/9 sameAsHead
# N-1/N-2
node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs \
  --baseline B3 --suite provenance --suite root-probe --suite ws-cordis-channel --fault substitute-npm
node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs \
  --baseline B3 --suite root-probe --suite ws-cordis-channel --fault legacy-shim
# BASE d59a4d1 三 entry 导出面捕获（G5 farm 同法）
node .cache/export-capture/capture.mjs
```
