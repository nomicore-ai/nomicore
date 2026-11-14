# SA10 最终规范与需求评审 — issue #471

**当前结论（iteration 1）：approve。** 复审范围为 `caede8a6c8a6266f4e1cfca3a4c87536f5ede995`（父 `f7a3f74`，再父 `d59a4d1`），即 `git diff d59a4d1..caede8a`。iter-0 的 AC1/AC2/AC6/AC8 partial 均已按本文件 §3.1–§3.4 的机械判据闭合；**iter-1 的 AC1–AC9 全部 satisfied**。详见文末「iteration 1 最终规范复审」。既有 4 个 test-d 红、28 个环境红、B3 非官方构建及非完整 JS parser 仍是必须随 PR 保留的披露边界，不是本票未达成项。

两轮均为只读审查：核对源码、提交 diff、SA3/SA4/SA6/SA8 产物与 `.cache` 落盘证据；未运行测试、typecheck、gates、服务或部署，未修改被审实现。iter-0 原文完整保留如下，文末 iter-1  supersede 其 verdict 与 AC 表。

---

# iteration 0 历史报告（reject；已被 iteration 1 取代）

**Verdict：reject。** 评审范围为本地提交 `f7a3f7464272da0ed16e53ecdd708d93294bb948`（父 `d59a4d141c6c5ac7f267295829157d9570cde36e`），即 `git diff d59a4d1..f7a3f74`。Issue 正文恰 9 条 AC，Comments 为空；本报告以 Issue、SA6 §12、适用 SA8 裁决及 ADR 0035/0032/0023、wire/hosting 契约为准。

本轮只读审查源码、提交 diff、SA3/SA4/SA6/SA8 产物与 `.cache` 落盘证据；**未运行测试、typecheck、gates、服务或部署，未修改被审实现**。结论不是“生产码存在 rc.12 行为回归”，而是：**若按 SA6 的「无证据即不通过」逐条验收，AC1、AC2、AC6、AC8 仍有 partial；runner 的 41/41 PASS 是在现有判定谓词下成立，不能替代这些缺失的可观测断言。**

---

## 1. 范围与交付事实

- 非 wiki 实现改动恰为 SA8 §9.1 的 10 个文件：3 个设施修改 + 7 个新增测试/helper/台账；wiki 任务产物另随提交入库。未越出该业务面。
- `git diff --name-only d59a4d1..f7a3f74 -- 'packages/*/src' 'apps/*/src' 'domains/*/src'` 为空。包括 `apps/yjs-server/src/app.ts`、`packages/ws-replication/src/plugin.ts` 在内，**生产源码零改动**。
- `artifacts/**`、`docs/**`（含 ADR）、全部 `package.json`、`pnpm-lock.yaml`、tsconfig、`vitest.config.ts` 对该范围均为零 diff；`git diff --check` 无输出。
- 10 个实现文件的当前工作树字节与 `f7a3f74` 一致；当前另有 Host-owned `wiki/raw/task_issue-471_dispatch.md` 修改，不在本次提交评审范围内。
- 因此行为面只由测试与验收设施扩展引入；未发现 scope creep 到生产状态机、公共 API、wire、持久化或 Host 装配。

---

## 2. AC1–AC9 逐条满足性

| AC | 判定 | 已满足部分与证据载体 | 未闭合部分 |
|---|---|---|---|
| **AC1** | **partially（阻断）** | A1-1…A1-7 有 `C.*` 29 tests × B1/B2/B3：symbol 优先且 legacy getter/arm 为 0、legacy-only 三入口兜底、malformed/双缺席 loud fail、timer service 缺失/畸形、`timer.ctx → ctx` 级联、sentinel 未 fire 无后果且显式 fire 后发生。见 `ws-replication-cordis-root-channel.test.ts:266-467` 与 `.cache/cordis-baselines/evidence/B{1,2,3}/ws-cordis-channel.json`。M-1/M-2 在 `.cache/mutations/mutations.json` 对各基线定向红，且既有 `ws-package` 仍 66/66，证明新测试有判别力。真实 `TimerService` 的 12 个测试名也在三基线各 repeat 3 绿。 | **A1-8 的「每族 arm → trigger → cancel」并未全部成立**：reconcile 的 trigger 谓词在初次 arm 后即已真；waitForLive 只观察 stop 导致的拒绝，未观察 25ms poll fire/live resolve；close/drain 与 reauth 两测试都走 `requestReauth`，缺独立 close/drain 驱动。详见 §3.1。 |
| **AC2** | **partially（阻断）** | `LIFECYCLE_UNITS` 名义上覆盖 3 入口 × 7 场景 + β/γ；三份 `replication-lifecycle.json` 均 `units={expected:23,observed:23,missing:[]}`、`coverage=true`、`foreignUnits=[]`、`issue420.tests=10`，各 repeat 3 为 34/34，`unit-union.json` 并集 69。显式 stop 与撤销分列、双挂负控、β OPEN/CLOSE 回合与 γ frame/receipt 均在 `ws-replication-cordis-baseline-lifecycle.test.ts:260-571`。 | **Fiber dispose 场景没有证明「该入口所有 arm outstanding=0」**：`:383-386` 只查 `pendingFor(HELLO_MS)` 与 `pendingFor(BOOTSTRAP_MS)`，且二者都为 30ms；peer backoff/reset、liveness 等其它 delay 不在判定内。详见 §3.2。 |
| **AC3** | **satisfied** | `composition-root` 三基线各 28/28：`issue270-regression-anchors.test.ts:119-135` 与 `persistence-drain-shutdown.test.ts:40-47,145-151,190-206` 以 sink 索引锁单向事件序；预算耗尽事件先于 dispose，drain 严格先于 dispose。`third-party-timer-ownership-red.test.ts:119-144` 以 5s deadline 验证无等待环；`T.fence-watchdog`（timers `:617-640`）有 idle re-arm ≥2 与清零；`unload` 三基线各 10/10 且 `r5p.present/passed=true`（R5P 源 `registry-sa7-rev1.test.ts:396-500`）。生产源码零改动也排除移除 watchdog/有界 drain 的实现路径。 | 无本票级缺口。 |
| **AC4** | **satisfied** | `third-party-timer-ownership-red.test.ts:61-117`：persistence fiber dispose 后 timer 可取且真实 arm/fire，根 fiber dispose 后不可取/不可 arm；persistence 服务消失的正向对照证明非自动依赖边。`dsh-profile-direct-apply-order.test.ts:22-90`：直接 apply profile 记录 `adapter-dispose → adapter-disposed → root-fiber-dispose`，二次 dispose 幂等，并由真实 baseline TimerService 驱动 flush。三基线均由 `composition-root` 留证。 | 无。 |
| **AC5** | **satisfied（附已披露 MINOR）** | G10 全仓分类第 6 类为空、两 seam 自检 2/2、16/16 samples、18/18 cast probes、8/8 cross-line probes；见 `.cache/cordis-baselines/evidence/gates/gates.log:298-310`。通道五形态由 channel 文件枚举，npm B1/B2=legacy、B3=symbol 的 `root-probe` 与 channel identity 均绿。4 个具名 fixture 对 base 零 diff，三基线 `ws-package` 均 66/66。 | SA4-7/8/9 是已知 gate 角落与文书 nit，见 §6；它们不改变本次 diff 未引入 legacy 直读的事实，但应随 PR 保留披露。 |
| **AC6** | **partially（阻断）** | Registry、Hub、Peer、Clock 的既有 guard-Proxy 文件有访问器、稳定闭包、freeze、写/defineProperty 拒绝等断言；三基线 `guard-proxy` 各 38/38，`a64` 的 issue246/418-contract/418-structure 均 true。生产源码零 diff 保证服务名、wire 与持久化实现不变；`contract` 三基线为 243/243/247，wire/结构守卫在三基线运行。 | **A6-1 点名 `nomicoreHubSessionHost`，但三基线 guard-proxy evidence 中 SessionHost 用例为 0**；ws guard 文件只测 Hub/Peer。**A6-2 要求 7 个公共 entry 的 runtime 导出名集合，当前快照只覆盖 4 个**，缺 ws-replication/testing、clock、namespace-registry。详见 §3.3。 |
| **AC7** | **satisfied** | `baselines.json:3-20` 仍是唯一基线/suite 表，B3 commit/integrity/probe 期望未改；`acquire.mjs`、`root-probe.mjs` 零 diff。新 suite 均注册进同一 `run-baseline.mjs`，`NEW_FILES` 包含新增文件，E7 强制 provenance → root-probe 先行；matrix 每基线 realpath/digest/expectedChannel 完整，B1/B2 legacy、B3 symbol。`cordis-baseline-support.ts` 只是测试观测 helper，不是第二套 acquire/runner/probe。 | 无。 |
| **AC8** | **partially（阻断）** | 三份 `B{1,2,3}-typecheck.json` 各 15 project、45/45 exit 0；矩阵 41 cells 全 `status=pass`。① Registry Cordis：unload 两文件；② Hub/Peer：4 fixture；③ SessionHost：issue422 + issue420；④ guard-Proxy；⑤ DSH profile；⑥ 7 个组合根文件均有三基线证据。A8-4 在 SA3 §6.3/§8-2、台账和 root-test disclosure 中有实质披露，且没有宣称 root-test/CI/所有既有测试全绿。 | **root-test cell 可在无有效 JSON/零测试证据时判 pass**：缺少 `--passWithNoTests=false`，JSON parse 失败只留下空失败名集，`failedUnexpected=[]` 即 pass，违反 SA6 §12.0 与 A8-3 的 fail-closed 口径。最终提交消息也未完整携带 A8-4 的 4+28 归因与对齐复跑说明，须由最终 PR 摘要补齐。详见 §3.4、§5。 |
| **AC9** | **satisfied** | 生产源码零 diff；G11 forbidden API 允许集为空且 PASS；G1′/G6/G7/G9/G12 PASS。无 volatile config、internal config/update/commit、私有 Fiber store 读取新增；无 artifacts/ADR/manifests/lock 改动，无 patchedDependencies 改动，无真实 MABF/DSH 部署或 patch 移除证据。B3 的仓外 vendored source-build 是验真工件，不是部署；其非官方流水线性质在 `baselines.json:109` 与 SA3 中明示。 | 无。 |

---

## 3. 阻断缺口与机械验收方式

### 3.1 AC1 / A1-8：三个 timer 族缺少规定的真实 trigger 证据

1. **reconcile interval**
   - `ws-replication-cordis-root-timers.test.ts:687-688` 已等待初次 arm；随后 `:690-693` 的谓词为 `meter.armsFor(reconcileIntervalMs) >= 1 && meter.pendingFor(reconcileIntervalMs) >= 1`。
   - 该条件在初次 arm 后、interval 尚未 fire 时就已成立，不能证明设计 §9.1 的「≥1 次 reconcile 回合」或 SA6 A1-8 的「触发产生可观察后果」。
   - **闭合判据**：在 B1/B2/B3 各 repeat 3 中，先观察该 delay 的真实 `fired` 记录及对应 reconcile 协议/observer 后果，再 `peer.stop()` 并断言 pending=0；不得用初次 arm 重述 trigger。

2. **peer waitForLive**
   - `:603-610` 只等待 25ms arm，然后立刻 `service.stop()`，断言 waiter 因 stop reject 且 pending=0。没有 `fired`/第二次 poll/live resolve 证据；设计 §9.1 该行的「live 后 resolve」也未覆盖。
   - **闭合判据**：至少证明 25ms poll timer 实际 fire 并驱动一次状态检查；另以 live 成功路径断言 waiter resolve，并保留独立 stop→reject、pending=0 路径。三基线各 repeat 3 留证。

3. **close/drain deadline 与 reauth 未区分**
   - `T.close-drain-deadline` 在 `:481` 调用 `hub.requestReauth(PEER_INSTANCE)`；`T.reauth-deadline` 在 `:523` 也调用同一 API。两者都是同一 reauth 驱动，只是后一个额外检查 `hub-reauth` reason。
   - 这没有满足设计 §9.1「close/drain = hub listen 关闭路径；reauth = `requestReauth`，以触发路径区分两族」。
   - **闭合判据**：close/drain 用非 `requestReauth` 的真实关闭/GOAWAY（例如 SERVER_SHUTTING_DOWN）路径观察 `closeTimeoutMs` 武装、到期收口和取消；reauth 继续由 `requestReauth` 独立承载。三基线各 repeat 3 留证。

> D-2 的 kind=2 路径不在本缺口内：其真实 wire 驱动已经成立，见 §6.1。这里不把已获 SA8 追认的 D-2 重新当成偏差。

### 3.2 AC2 / Fiber dispose：全量 timer 清理断言被缩成单一 delay

- `ws-replication-cordis-baseline-lifecycle.test.ts:373-393` 在 hub accept/session open 后直接 `handle.fiber.dispose()`。
- `:385` 仅断言 `pendingFor(HELLO_MS)===0 && pendingFor(BOOTSTRAP_MS)===0`；`HELLO_MS` 与 `BOOTSTRAP_MS` 都定义为 30（`:61-63`），因此实际只检查一个 delay。SA6 AC2 明确要求「该入口所有 arm outstanding=0」。
- 后续 `withEntry` 的根清理不能倒证在 Fiber dispose 断言点所有入口 timer 已清零。
- **闭合判据**：在 `handle.fiber.dispose()` 完成后、任何 root cleanup 前，对 hub-listen/peer-dial/session-host 分别断言覆盖该入口全部 real-Timer arm 的 `meter.pending()===0`（或逐一枚举该入口所有 delay），并保留零 unhandled rejection；B1/B2/B3 × 3 entry × repeat 3 全部通过，且 `units.observed=23` 不得靠改名维持。

### 3.3 AC6：SessionHost guard-Proxy 与三项公共 entry 证据缺席

1. **SessionHost guard-Proxy**
   - SA6 A6-1 明确列出 `clock`（system/manual）、`nomicoreRegistry`、`nomicoreHubReplication`、`nomicorePeerReplication`、`nomicoreHubSessionHost` 五面。
   - `run-baseline.mjs:77-84` 的六个 guard 文件里没有 SessionHost 专项；对三份 `guard-proxy.json` 的 `testNames` 检查，SessionHost 命中均为 `[]`。`ws-replication-guard-proxy-consumption.test.ts` 只有 Hub（`:122-160`）与 Peer（`:162-210`）。
   - 生产 SessionHost 的确在 `plugin.ts:664-671` 使用 accessor + `Object.freeze`，但源码形态不能替代 SA6 要求的三基线消费行为证据。
   - **闭合判据**：增加 `nomicoreHubSessionHost` 在 guard-Proxy 下的 `status/open/stop` 消费、函数稳定闭包、`Object.isFrozen`、descriptor 无 `value`/无 setter、赋值与 defineProperty 抛 TypeError 等断言；B1/B2/B3 均有具名测试与 JSON 证据。

2. **公共导出面的覆盖只有 4/7 entry**
   - SA6 A6-2 还要求 `@nomicore/ws-replication/testing`、`@nomicore/clock`、`@nomicore/namespace-registry`；`public-surface.base.json` 与 `gates.mjs:44-49` 只含 persistence、persistence/testing、dsh-persistence、ws-replication 四项。
   - **闭合判据**：以 `d59a4d1` 的真实导出名为基准，补齐上述三 entry 的 runtime 导出名集合严格相等证据，并在 B1/B2/B3 留证。若需修改冻结快照或 ALLOW，先走适用 SA8 留痕，不得直接放宽 G12。

### 3.4 AC8 / A8-3：root-test 证据提取存在 fail-open 通道

- `run-baseline.mjs:879` 的 root-test 直接命令没有 `--passWithNoTests=false`（通用 `runVitest` 在 `:452` 有该参数）。
- `:891-903` 若 JSON 不存在或不可解析，`counts=undefined`，而 `failedTestNames` 保持 `[]`；`:906` 因而得到 `failedUnexpected=[]`，`:918` 直接返回 `status:'pass'`。零 assertion/未生成 reporter/崩溃在 JSON 写出前均可能走同一通道。
- 这与 SA6 §12.0「无证据即不通过、passWithNoTests=false」及 A8-3「任一 cell 红则聚合红」冲突；台账只能豁免已逐名归因的失败，不能豁免证据采集失败。
- 当前落盘的 root-test 恰好有完整 JSON，所以本次 32 红没有被该通道吞掉；但本票主体就是验收设施，该 fail-open 必须闭合。
- **闭合判据**：root-test 命令显式加 `--passWithNoTests=false`；只有 JSON 可解析、总数>0、失败名提取完整时才允许台账名集判定。缺失/不可解析/空测试/提取不一致必须 `status:'fail'` 并进入 matrix 非零退出，且有一个「无有效 JSON 不得 pass」负控。保留当前合法 32 名的披露语义，不用进程 exit 1 简单否定已知红台账。

---

## 4. 规范一致性

| 规范面 | 审查结论与证据 |
|---|---|
| **ADR 0035 §1 三基线** | `baselines.json` 固定 B1 npm 4.0.1/Timer 1.1.3、B2 npm 4.1.0/Timer 1.2.0、B3 DSH `1511a6ed…`/Timer 1.2.0；matrix realpath 均指向相应 overlay，B3 provenance 8/8。B3 仍明确「minimal tsc source-build, NOT official pipeline」。 |
| **ADR 0035 §2 双形态 Root / 无 ambient** | 生产 `plugin.ts:244-298` 与 base 零 diff，保持 symbol 优先、legacy 兜底、malformed 不回落、两跳级联和 rootTimer 方法调用；channel 29×3 与 M-1/M-2 证明行为。sentinel 三入口在超过配置窗口后无后果，显式 fire 才发生。没有生产 ambient timer 新增。 |
| **ADR 0035 §3 生命周期** | AC3/AC4 的组合根证据支持单向拆卸、Timer 最后释放和直接 apply dispose 序；但 AC2 的 Fiber dispose 全量清理断言仍须按 §3.2 补齐，不能用名义 23/23 替代。 |
| **ADR 0035 §4 公共契约/配置** | 全部生产 src、公共入口、manifest/lock 零 diff；无 volatile/internal API、私有 Fiber store 或依赖范围变化。公共导出 runtime 证据覆盖不足是 AC6 的证据缺口，不是已发生 API diff。 |
| **ADR 0035 §5 验收** | 三基线 typecheck、identity-first、root probe 和大多数点名行为面成立；本报告列出的 A1-8、Fiber dispose、A6-1/A6-2 与 root-test fail-open 是该条尚未完全兑现的部分。 |
| **ADR 0035 §6 Host 排除项** | 无真实 MABF/DSH 部署，无 patchedDependencies 修改/移除，无“可据此删 Host patch”的宣称。 |
| **ADR 0023** | Registry/Hub/Peer/Clock 的冻结 accessor 消费测试仍绿；SessionHost 生产形态也保持 accessor+freeze，但缺 SA6 点名的三基线 guard-Proxy 消费证据。 |
| **ADR 0032 / 协议 §24** | listen 与 listen:false 服务互斥在 lifecycle startup/service-revoked 断言中保持；β CLOSE/OPEN 回合、γ outbound frame 与 receipt>0、关闭后 meter=0 有证据。`createHubReplicationEdge`、SessionHost、async seam 等生产文件零 diff，β 冻结面与 γ append-only 未被修改。 |
| **wire 与持久化布局** | `replication-protocol` 和 persistence 生产源码零 diff；issue246/418 三基线守卫与 persistence contract 三基线通过。没有 wire 帧字节、sequence、capability、snapshot/META/JSONL 布局改动。 |

**结论：未发现 ADR/协议级 hard conflict，也未发现生产面行为变更。reject 的对象是 SA6 可观测验收未闭合及验收设施的 fail-open，不是要求改写生产实现。**

---

## 5. 披露诚实性与台账复核

### 5.1 已有披露是真实且可复核的

- `.cache/cordis-baselines/evidence/root-test/root-test.json` 保留 `exitCode:1`，当前默认布局为 **5984 total / 5952 passed / 32 failed**；`failedUnexpected=[]`，disclosure 明示不得据此声称 root-test/CI/all existing tests green。
- `root-test-base/ledger-capture.json` 的 `baseHead=d59a4d1`，BASE 为 **5913/5881/32**。独立从 `base-root-test.vitest.json` 取失败全名，集合与 `root-test-known-red.json` 的 `knownRed(4)+environmentRed(28)` **精确相等**；当前 root-test 的 32 名也与该台账精确相等，本票新增文件失败为 0。
- 4 名均来自 `ws-replication-issue421-edge-factory-api.test-d.ts`，`root-test.log:1431-1469` 为 4 个 `Expected 1 arguments, but got 0`；归因于 expect-type 1.4.0 的可选参数元组比较，文件在本提交零 diff。
- `aligned-capture.json` 与 `base-root-test-aligned.log:837-839` 证明对齐 `pnpm@10.28.2` 后 **5913/5909/4**，28 个环境红转绿，只剩 4 个 knownRed；失败集合恰等于 knownRed。ambient 11.28.5 与 packageManager 10.28.2 的冲突在 root-test log 中亦可见。
- SA3 §6.3/§8-2 逐项披露 4+28、对齐复跑与表述禁令；SA8 S4/B-3 选择是「名集台账判定」，不是宣称进程全绿。

### 5.2 必须保留的限制

- **不能把 41/41 PASS 写成 root-test、CI 或所有既有测试全绿。** root-test 的 `status:pass` 是 SA8 授权的台账判定，原生 vitest `exitCode` 仍是 1。
- 台账当前没有掩盖新增红；但 §3.4 的证据提取 fail-open 是另一种设施风险，修复前不能把它称作完备 fail-closed 机制。
- 最终提交消息仅写「root-test 按台账判定 failedUnexpected=[]」，没有完整带入 4+28 的归因、对齐复跑和禁止全绿表述。**最终 PR 摘要必须补齐或明确引用 SA3 §6.3/§8-2 与本节证据，不能只用该提交消息作为完整交付披露。**

---

## 6. 偏差、裁决与残余 MINOR 留痕

### 6.1 D-2：如实记录并已收敛，判据不变

- SA3 §8-3 与 SA8 `impl_conflict_report.md` 项 6/D-2 均记录：早期 kind=0 合成驱动已改为真实 **kind=2 chunked SYNC_STEP2**。
- `ws-replication-cordis-root-timers.test.ts:701-737` 从 wire 解码并断言至少 2 个 `UPDATE_CHUNK transferKind===2`（`:725-729`），在测试侧 transport seam withhold 尾帧，驱动生产 `armTimer('assembly')`；`:739-770` 另观察 `-aborted{reason:'timeout'}` 与 pending=0。
- peer 100KB 写 → live 不可分块 → 恢复 diff 超阈值的触发链、为什么不能用线上丢帧、零生产改动均有披露。SA8 已判 clear/RATIFY；本轮未发现判据缩水，不重新 opening 该裁决。

### 6.2 D-3：已由 SA8 追认为 R-2

- SA8 `impl_conflict_report.md` 项 6/D-3 发布 R-2：`G8_ENV_LINE_ALLOW` 只允许 `apps/yjs-server/src/main.ts:36,37` 两个 BASE 既有 `NOMICORE_CONFIG` 行，行号/内容漂移即回审；channel 标记永不豁免。
- 实现在 `gates.mjs:79-82` 可见，G8 扫描四类生产 src，证据 `gates.log:305` PASS。它不是整棵 app 树豁免，也不需要另立 ADR；留痕完整。

### 6.3 SA4-7/8/9：已披露，MINOR 不阻断，但不得遗忘

- **SA4-7**：跨行 M4 的 `argumentStart` 不跳过注释，刻意排版的注释行可使 `'root'` 实参成为盲区；BASE 零实存。SA4 I2-8/I2-9 已给复现与后续 driver。
- **SA4-8**：行级词法器对含未配对 `)` 的正则、嵌套模板有残余归属角落；同属已记录的非本轮回归限制。
- **SA4-9**：SA3 所称 baselines.json「3 hunk」实为 **1 hunk 内 3 处编辑**；本次 `git diff --unified=0` 复核一致。另有被调链自身跨 `(` 断行的探针覆盖 nit。
- 三项在 SA4 与 dispatch 中均如实保留，不影响当前 AC5 的 zero-diff/zero-residue 结论，也不要求本票扩张成完整 JS parser。PR 应列为后续加固项，而不是宣称 G10 对所有 JS 形态均完备。
- 另两处装饰性断言（lifecycle `:584`、timers `:493`）仍按 SA4-3 以非阻断理由保留；不构成验收判据加强。

---

## 7. 后续票边界

- #470 `impl_conflict_report.md` I-7 明确把 4 个 test-d 的修复另立票：可选参数元组断言改写或 expect-type 工具链升级，并复绿 root-test/CI test-d lane。
- 本提交没有改 `ws-replication-issue421-edge-factory-api.test-d.ts`，没有升工具链，也没有声称修复该 4 红；处理仍是台账+披露，符合 #470 裁定。
- #470 留后的 Replication 三基线行为矩阵和 `apps/yjs-server` 行为验收正是 #471 本票，当前已建立主体矩阵，不应再整体推给后续票；但 §3 所列本票 SA6 子断言也不能以「后续加固」名义留下。
- 未做真实 Host 部署/patch 移除、未改 ADR/历史 artifacts、未建立第二套验真设施、未改生产 API/wire/持久化，未见越界做后续票事项。

---

## 8. 最终结论与交付前必办

**verdict = reject。** AC3/AC4/AC5/AC7/AC9 satisfied；AC1/AC2/AC6/AC8 partially satisfied；无 AC 需要判为完全 not-satisfied。

重新提交 SA10 前，至少须机械闭合：

1. §3.1 的 reconcile、waitForLive、close/drain 三族真实 trigger 证据，B1/B2/B3 × repeat 3 留证。
2. §3.2 的三入口 Fiber dispose 全量 `meter.pending()===0` 证据，保持 23 单元语义不缩水。
3. §3.3 的 SessionHost guard-Proxy 三基线证据，以及 ws-replication/testing、clock、namespace-registry 三个 entry 的公共导出严格相等证据。
4. §3.4 的 root-test 无有效证据必红 + `--passWithNoTests=false` + 对应负控；保持合法 4+28 名集台账语义。
5. 最终 PR 摘要逐条携带：4 个 BASE test-d 红及 expect-type 归因、28 个 pnpm 环境红及 10.28.2 对齐复跑、root-test 原生 exit 1/台账判定的区别、不得宣称 root-test/CI/所有既有测试全绿；同时保留 SA4-7/8/9 与 B3 非官方构建/无真实部署的边界。

上述闭合前，**不得**以「41/41 matrix PASS」「12 timer 族三段证据」「五面 guard-Proxy」「root-test 全绿」作为无保留交付表述。

---

# iteration 1 最终规范复审（当前结论）

## I-1. 复审范围、证据有效性与 verdict

- 交付 HEAD = `caede8a6c8a6266f4e1cfca3a4c87536f5ede995`，父 = `f7a3f7464272da0ed16e53ecdd708d93294bb948`，BASE = `d59a4d141c6c5ac7f267295829157d9570cde36e`；需求仍为 Issue 正文恰 9 条 AC，Comments 为空，无 owner 追加或豁免。
- 非 wiki 改动仍恰为 SA8 十文件 ALLOW；`packages/*/src`、`apps/*/src`、`domains/*/src` 对 BASE 零 diff，生产 API、wire、持久化、Host 装配均未改。当前十个实现文件与 `caede8a` 逐字节一致，B1/B2/B3 materialized workspace 中对应文件也逐字节一致。
- `.cache/cordis-baselines/evidence/matrix/matrix.json` 为 **41 cells / 41 pass**，`matrix.log:45-46` 保留 root-test 原生 `exit=1` 与 `MATRIX PASS: 41 cells` 的区别。`.cache/mutations/mutations.json` 的 `head` 字段仍为 `f7a3f74`，因为变异在最终提交前执行；`plugin.ts` 与 `peer-namespace.ts` 在 `f7a3f74..caede8a` 零 diff，且三 workspace 最终字节已对当前 HEAD 复核，不构成陈旧证据。
- 本轮只读解析证据、比对集合和字节，未把 SA3 的「已闭合」自述当作证据本身，也未重跑任何测试或 gate。

**verdict = approve（0 个关键 AC partial / unmet / unachievable）。** iter-0 四个阻断项全部闭合；下表及 I-2–I-6 给出逐项依据与必须保留的非阻断披露。

## I-2. iter-0 §3.1–§3.4 机械闭合复核

### I-2.1 AC1 / A1-8：真实 trigger 已闭合，十二族三段齐全

1. **reconcile interval — closed**
   - `ws-replication-cordis-root-timers.test.ts:743-762` 先记录既有 `SYNC_STEP1.syncRoundId` 的最大值，再要求出现**严格更大的新 round id**，随后要求 interval 第二次 arm，最后 `peer.stop()` 并分别断言 periodic/reconcile-round 两类 pending=0。旧的「首 arm 后恒真」谓词已不存在。
   - `.cache/mutations/run-mutations.mjs:68-87,171-190` 的 M-5 仅把 `kind === 'periodic-reconcile'` 的 `startPeriodicReconcile()` 改为 no-op；`.cache/mutations/mutations.json` 在 B1/B2/B3 均为 **恰 1 红 = `T.reconcile-interval`**、`otherFailures=[]`，日志失败点正是「NEW SYNC_STEP1 round」超时。这把新协议回合与该 timer 回调建立了反向因果证明，而不是只凭 arm 状态宣称 trigger。M-5 与其它变异合计 9/9 还原为 pristine/HEAD 字节。

2. **peer waitForLive — closed**
   - `:648-655` 等待 25ms arm 后，明确等待 `entry.delay===25 && entry.fired`，并在非 live 状态复检；`:657-659` 通过 `addTarget` 驱动 live，断言原 waiter resolve 且状态为 live；`:661-668` 另起 waiter，保留独立 stop→reject 与 pending=0。覆盖 iter-0 要求的 poll fire、live resolve、stop reject 三个不同事实。

3. **close/drain 与 reauth — closed 且路径可区分**
   - close/drain `:469-508` 改由真实 `peer.removeTarget()` 驱动，在 transport seam 扣留 `CLOSE_NAMESPACE`，观察 closeTimeoutMs 武装、无 CLOSE_OK 时 deadline 收口为 `closed`、pending=0；正常 CLOSE_OK 分支另断言 timer 在从未 fire 的情况下被取消。反向负控断言无 GOAWAY 且连接仍 ready。
   - reauth `:510-551` 独立由 `hub.requestReauth()` 驱动，观察 GOAWAY(REAUTH_REQUIRED)、`close(1001,'hub-reauth')`，并断言没有 CLOSE_NAMESPACE、没有 generic `blocked-deadline/goaway-drain` reason。两族不再共享同一驱动。

4. **bulk ACK / assembly 及十二族总账 — closed**
   - `:768-806` 使用真实 kind=2 chunked SYNC_STEP2（≥2 chunks），正常放行末帧，观察 sender=peer 的真实 `chunked-sync-acked`，再断言 assembly pending=0 且无 abort；`:808-840` 的独立 stall 用例观察真实 `*-aborted{reason:'timeout'}`。iter-0 已接受的 D-2 因此没有回退。
   - B1/B2/B3 的 `ws-cordis-timers` 均列齐 12 个 `T.*` 名（hello、auth/upgrade、bootstrap、close/drain、reauth、backoff/reset、waitForLive、fence-watchdog、liveness、reconcile、bulk ACK、assembly timeout），每基线 `repeatRuns` 三次均 12/12、exit 0。A1-1…A1-7 仍由 channel 29 个原有用例承载；新增 4 个 AC6 用例只使 channel 总数成为 33/33，不替代原通道断言。

### I-2.2 AC2 / Fiber dispose：全 delay 族 outstanding=0 已闭合

- `ws-replication-cordis-baseline-lifecycle.test.ts:372-404` 在 hub accept/session open 等动作后先要求 `meter.pending()>0`，再直接 `handle.fiber.dispose()`，在 `withEntry` 的任何 root cleanup 之前等待并断言 **`meter.pending()===0`**。`cordis-baseline-support.ts:56-68,93-98` 证明该谓词枚举所有真实 TimerService arm，而非 HELLO/BOOTSTRAP 两个 30ms delay；另保留零 unhandled rejection 检查。
- 三份 `replication-lifecycle.json` 均有三入口 Fiber dispose 测试名、`repeatRuns` 三次 34/34、`repeatJudgements=[true,true,true]`、`units={expected:23,observed:23,missing:[]}`、`coverage=true`、`foreignUnits=[]`、`issue420.tests=10`；`matrix/unit-union.json` 独立给出并集 69、`problems=[]`。不是靠改名或只保留最后一轮维持名义覆盖。

### I-2.3 AC6：SessionHost guard-Proxy 与 7/7 公共 entry 已闭合

1. **`nomicoreHubSessionHost` 的真实 guard-Proxy 消费**
   - `ws-replication-cordis-root-channel.test.ts:485-570` 对 `status/open/stop` 经 function-wrapping guard Proxy 逐一访问并全为 ACCESS_OK；实际 `guarded.open()` 使 sessions 0→1，`guarded.stop()` 与原 service 的缓存 Promise 恒等，stop 后 open loud throw。
   - 同用例有敏感性正控、诚实 Proxy 负控、原 service 函数稳定闭包、逐成员 getter/no-value/no-setter/non-configurable/enumerable、`Object.isFrozen`、赋值与 defineProperty 抛 TypeError 的断言，满足 iter-0 §3.3 的完整形态而非「能访问即可」。该 channel 文件已进入 `run-baseline.mjs:77-88` 的 guard-proxy suite。
   - B1/B2/B3 的 `guard-proxy.json` 都有 `C.guard-proxy.session-host.<baseline>` 具名通过记录，且各 **71/71**；`a64.issue246/issue418Contract/issue418Structure` 仍全 true。

2. **A6-2 七个公共 entry 的 runtime 导出名集合**
   - 原 G5 继续覆盖 persistence、persistence/testing、dsh-persistence、ws-replication 四项（`gates.log:303`）；新增 `C.public-surface.@nomicore/{clock,namespace-registry,ws-replication/testing}` 三项在 `:579-590` 对 runtime `Object.keys(module).sort()` 做严格相等断言。
   - 新名单来源可追溯：`.cache/export-capture/capture.mjs:15-21,74-100` 在干净 detached BASE `d59a4d1` worktree 上按 G5 symlink-farm 方法捕获，`.cache/export-capture/capture.log:1-29` 记录 BASE checkout 与 runtime 结果，`base-exports.json:2-33` 固定完整 SHA、farm（109 links/16 packages）及三份名单；测试内三组 expected 与该捕获逐项一致。
   - 三基线 `ws-cordis-channel.json` 均有三条新增 public-surface 测试名并 33/33 通过。因此覆盖是 **4/7 + 3/7 = 7/7**；未修改冻结的 `public-surface.base.json`，也未借 ALLOW 变更绕过 G12。

### I-2.4 AC8 / A8-3：root-test 证据提取已 fail-closed

- `run-baseline.mjs:900-1013` 现在：运行前删除旧 JSON；命令显式 `--passWithNoTests=false`；记录 `startedAt`；要求文件存在、JSON 可解析、mtime 不早于本轮、三个 count 均为有限数、总测试数 >0、`testNames.length===numTotalTests`、`failedTestNames.length===numFailedTests`，并检查信号终止。`status` 必须同时满足 `evidenceOk && failedUnexpected.length===0`，台账不再能解释证据缺失。
- `.cache/negative/root-failclosed/run.mjs` 仅对真实 runner 做三处声明式替换（证据目录与 vitest double）；已复核 generated runner 归一化这三处后与当前 `run-baseline.mjs` 完全相等。`root-failclosed.json` 的 **missing / malformed / stale / stale-mtime / zero / mismatch 6/6** 均为进程 `exitCode=1`、cell `status=fail`、`evidence.problems` 非空，即使 `failedUnexpected=[]` 也红。stale 旧文件被删除后以 missing 红，stale-mtime 另覆盖「本轮写出但时间陈旧」。
- 正控 `root-test.json` 为 `evidence.fresh=true`、`problems=[]`、`counts=5956/5988/32`、`failedUnexpected=[]`，`matrix.log:45` 如实显示原生 exit 1 和 32 known-red；因此既满足 SA6 §12.0「无证据即不通过」，也满足 A8-3 的非零聚合退出语义。

## I-3. iter-1 AC1–AC9 总表

| AC | iter-1 判定 | 当前实现与证据 | 未达成项 |
|---|---|---|---|
| **AC1** | **satisfied** | A1-1…A1-7 channel 29 用例保持，三基线各 33/33；十二 timer 族三基线各 12/12 × repeat 3。reconcile 新 round + M-5 反证、waitForLive fire/resolve/reject、真实 CLOSE drain 与独立 reauth、真实 bulk ACK/assembly timeout 见 I-2.1。 | 无。 |
| **AC2** | **satisfied** | 3 基线 × 3 入口 × 7 场景及 β/γ 完整；Fiber dispose 在 root cleanup 前对全量 `meter.pending()===0` 断言。三基线 23 单元 × repeat 3、并集 69、coverage/foreign/issue420 全符合。 | 无。 |
| **AC3** | **satisfied** | 三基线 composition-root 仍各 28/28，unload 各 10/10 且 R5P 在场通过；既有事件序、5s 无环、watchdog 与有界 drain 证据未削弱。`T.fence-watchdog` 仍有双节奏 arm/re-arm 与清零。 | 无。 |
| **AC4** | **satisfied** | 三基线 ownership/DSH 证据保留：persistence dispose 后 Timer 可取且能真实 arm/fire，root dispose 后不可取/不可 arm，非自动依赖边正控，以及直接 apply 的 adapter→root 显式 dispose 序。等待方式改为有界谓词未改变判据。 | 无。 |
| **AC5** | **satisfied** | `gates.log:308`：G10 class 6 空、2/2 seam、16/16 samples、18/18 cast、29/29 cross-line、738 files；`G1′/G3/G10/G12` 均 PASS。三基线双通道、ws-package 66/66 保持。SA4-7/8 的注释/regex/template 盲区已有定向注入和 M-6/7/8 回退变异红证。 | 无；但不得宣称手写 G10 是完整 JS parser。 |
| **AC6** | **satisfied** | 五面 guard-Proxy 证据齐备，三基线各 71/71；公共导出 7/7（G5 四项 + BASE runtime capture 三项）；服务名、wire、持久化布局由零生产 diff、contract 243/243/247、interop/structure guards 继续锁定。 | 无。 |
| **AC7** | **satisfied** | 仍只有 `baselines.json` 一份基线/suite 表、`acquire.mjs` 一个物化器、`root-probe.mjs` 一个通道探针、`run-baseline.mjs` 一个 runner；provenance→root-probe 先行，matrix realpath/digest/channel 完整。新增 export capture 是 BASE 名单证据捕获，不是第二套基线验真设施。 | 无。 |
| **AC8** | **satisfied** | 三基线各 15/15 project typecheck（45/45 exit 0）；点名 Registry/Hub-Peer/SessionHost/guard/DSH/第三方组合根均有三基线 cell；41-cell 聚合与 root-test 6 个 fail-closed 负控成立。A8-4 披露见 I-4。 | 无；root-test 原生 exit 1 不是「全绿」。 |
| **AC9** | **satisfied** | 生产 src 零 diff；G11 空允许集、G8/R-2 两行、G1′/G6/G7/G9/G12 全 PASS；无 volatile/internal API、artifacts/ADR/manifest/lock/patch 改动，无真实 MABF/DSH 部署或 patch 移除。 | 无。 |

## I-4. A8-4 与交付披露：已如实记录，PR 必须原样保留

1. **提交消息已实质闭合 iter-0 的披露缺口。** `caede8a` body 明写默认布局 root-test 5956/5988、32 红 = 4 个既有 test-d + 28 个环境红；给出具体 test-d 文件、expect-type 1.4.0 可选参数元组归因及 #470 后续票边界，并写明对齐 pnpm@10.28.2 后 28 项转绿、本票未修 32 项、不声称 CI/所有既有测试全绿。没有无保留「全绿」宣称。
2. **产物给出可机械复核的完整名集。** 本轮独立比较：冻结台账 32 名 == BASE `d59a4d1` 捕获 32 名 == 当前 root-test 32 名；`failedUnexpected=[]`。4 个 knownRed 全属 `ws-replication-issue421-edge-factory-api.test-d.ts`，28 个 environmentRed 均有 pnpm 11.28.5 与 packageManager 10.28.2 未对齐的归因。
3. **对齐复跑证据未丢失。** `root-test-base/aligned-capture.json` 为 BASE **5913 total / 5909 passed / 4 failed**，本轮独立从 aligned JSON 提取失败名并确认恰等于 4 个 knownRed，故 28 个环境红转绿的说法有证据。当前 `root-test.json:5` 的原生 `exitCode:1` 与台账判定 `status:pass` 同时保留，不得只引用后者。
4. **PR 摘要仍须携带而非省略：**4+28 分类与归因、pnpm 对齐复跑、root-test 原生 exit 1/台账判定的区别、禁止声称 root-test/CI/所有既有测试全绿。矩阵 41/41 仅表示 SA8 授权的 cell 判定全部通过，不能扩张成全仓测试无红。

## I-5. D-2 / D-3（R-2）、SA4 留痕与边界

- **D-2 保持已追认形态。** 真实 kind=2 chunked SYNC_STEP2 驱动仍在 bulk ACK 与 assembly timeout 两族；新 bulk ACK 进一步观察实际 `chunked-sync-acked`，没有回到 kind=0 合成驱动或仅以 stall 冒充 trigger。SA8 的 D-2 RATIFY 无需重开。
- **D-3 = R-2 保持钉死。** `gates.log:306` 明确生产 src 仅允许 `apps/yjs-server/src/main.ts:36,37` 两个 BASE 既有 NOMICORE_CONFIG 行，通道标记不豁免；未见增删或扫描面放宽。
- **SA4-7 已实质闭合：**注释对 token adjacency 透明；`.cache/negative/g10-iter3/injections.json` 三种真实文件注入均 exit 1、G10 fail、目标命中，M-6 回退后恰 3 探针失败。
- **SA4-8 已实质闭合：**regex/nested-template 有显式规则与探针，M-7/M-8 分别产生 2/1 个预期探针失败；不可判定仍归 UNRESOLVED/class 6。剩余披露应改成「G10 非完整 JS parser」，而不是继续声称所有 JS 形态均已覆盖。
- **SA4-9 留痕仍在：**SA3 当前文本使用「1 hunk 内 3 处语义编辑」，旧文书 nit 已纠正；这不影响 AC。
- **B3 边界：**仍是 vendored rc.12 的 minimal tsc source-build、非官方 DSH 流水线；无真实 Host 部署、无 patchedDependencies 修改/移除、无可删 Host patch 的宣称。

## I-6. 后续票边界与 scope creep 复核

- 本票没有修 `ws-replication-issue421-edge-factory-api.test-d.ts` 的 4 个 BASE test-d 红，没有升级 expect-type 工具链，也没有把 28 个环境红入账为「已修」；仍严格采用冻结台账 + 披露，符合 #470 留后续票的裁定。
- 新增的 timer、lifecycle、guard-Proxy、public-surface 与 root-test fail-closed 工作分别直接服务 AC1/AC2/AC6/AC8；G10 词法加固直接闭合 AC5 既有零残留门的 fail-closed 义务及终审缺陷。均在既有十文件 ALLOW 内，不是另做后续票功能。
- 未改生产状态机、wire、公共 API、持久化布局或 Host 装配，未建立第二套 acquire/probe/runner，未做真实部署/patch 移除。未发现 scope creep。

## I-7. 最终结论

**approve。** iter-0 的 AC1/AC2/AC6/AC8 四项 partial 均有源码断言、三基线正控和定向负控闭合；iter-0 已满足的 AC3/AC4/AC5/AC7/AC9 未回退。**iter-1 AC1–AC9 全部 satisfied，无必须返工的机械缺口。**

本 approve 不豁免交付包装：最终 PR 必须保留 I-4 的 4+28/对齐复跑/native-exit-1 披露，以及 I-5 的 B3 非官方构建、无真实部署/patch 移除、G10 非完整 JS parser 边界。上述均为已知且已披露的限制，不构成本票 AC 的 partial/unmet/unachievable。
