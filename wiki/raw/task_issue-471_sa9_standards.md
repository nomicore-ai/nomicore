# SA9 最终标准评审 — issue #471：Cordis rc.12 Hub/Peer/SessionHost 全链兼容

状态：**standards-review，iteration 1（复审）；verdict = approve（0 BLOCKER / 0 MAJOR / 0 MINOR）**。

**结论：可交付。** 上轮 3 个 MAJOR 与 5 个 MINOR 均按本报告 iter-0 的闭合判据闭合；本轮未引入新的标准、范围、生命周期或测试质量问题，也未发现冻结面回退。

被审对象：本地提交 `caede8a6c8a6266f4e1cfca3a4c87536f5ede995`（短 SHA `caede8a`），父提交 `f7a3f7464272da0ed16e53ecdd708d93294bb948`，再父 `d59a4d141c6c5ac7f267295829157d9570cde36e`。范围严格为 `git diff d59a4d1..caede8a`；本轮增量重点为 `f7a3f74..caede8a`。本评审只复核 iter-0 的 SA9-1…SA9-8、本轮 delta 的新风险与不得回退项，不替代 SA10 的 Issue 完备性判定。

评审方式：实读本轮 7 个实现/测试文件 delta、相关生产 trigger 路径、SA3 iteration 3 闭合说明与全部点名证据；只读解析 JSON/log、重算集合和计数、比对冻结常量及字节。**遵守只读评审约束，未运行测试、gates、typecheck、负控脚本或服务；root-test 6/6 与 G10 注入/变异采用「driver + 生成物 + 日志 + 当前源码同一性」只读核对，而非再次执行。** 未修改任何被审实现、设计或测试。

---

## iteration 1（复审）

### 1. 裁决总表

| Finding | iter-1 状态 | 闭合依据摘要 |
|---|---|---|
| SA9-1 — root-test 证据 fail-open | **已闭合** | 本轮 JSON 先删后跑；要求存在、可解析、新鲜、正数 total、有限 counts、总名数/失败名数一致及非信号终止；`--passWithNoTests=false` 已补。6/6 负控均实红，台账集合与语义未变。 |
| SA9-2 — 注释后的跨行实参静默漏检 | **已闭合** | comment 对有效 token 邻接透明；普通块/行/JSDoc 形态均归属真实 callee，归属不明则 `UNRESOLVED-CROSSLINE` ⇒ 类 6。29/29 探针、3/3 真实文件注入及 M-6 回退变异相互印证。 |
| SA9-3 — timer 恒真/错路径 trigger | **已闭合** | reconcile 用严格增大的新 `SYNC_STEP1` round id；waitForLive 观察 poll fire 与 live resolve；close/drain 走真实 `removeTarget` + `CLOSE_NAMESPACE` 排水；bulk ACK 观察真实 `chunked-sync-acked`。M-5 在三基线均恰使 reconcile 一用例红。 |
| SA9-4 — 只判最后一次 repeat | **已闭合** | 每轮分别计算 23 名、coverage、foreignUnits、issue420；`runs.length===repeat` 且全部 judgement 通过才绿。三基线均为 `[true,true,true]`。 |
| SA9-5 — 固定墙钟等待 | **已闭合** | ownership 两处改为有界谓词等待；lifecycle 的 `delay(5)` 改为两个显式事件轮次。quiet window 仍按「持续不发生」语义保留。 |
| SA9-6 — 死导出/死变量/装饰断言 | **已闭合** | 点名死导出已删除，`delay`/`FAULT` 收为模块私有；`sessionHandle`、`sinkOpened`、装饰性 registry import 断言和 `peerAssembly.timer` defined 断言均移除。现存 `peerAssembly.timer` 表达式是真实工厂注入，不是遗留装饰断言。 |
| SA9-7 — 摘要字段与陈旧注释/数字 | **已闭合** | 统一 `counts.passed/total`；矩阵 root-test 行显示 `5956/5988 (32 known-red: 4 frozen + 28 environment)`，无 `undefined/undefined`。helper/lifecycle 注释改为 Vitest 单空格事实；SA3 已更新 hunk、探针和 root-test 数字。 |
| SA9-8 — regex/nested template 未建模 | **已闭合** | R-REGEX、R-TEMPLATE、R-FAILCLOSED 已写成显式状态规则；regex 体与 template 文本不透明，`${…}` 正常扫描，嵌套模板保留栈；不可判定实参归 `UNRESOLVED-CROSSLINE` ⇒ 类 6。对应探针与 M-7/M-8 变异均实红。 |

### 2. SA9-1：root-test 已真实改为证据 fail-closed

实现核对（`run-baseline.mjs:900-1013`）：

- `:910` 在 spawn 前删除固定 JSON，`:911-929` 记录本轮起点并显式传入 `--passWithNoTests=false`；旧文件不能再冒充本轮证据。
- `:931-973` 将信号终止、文件缺失、JSON 不可解析、mtime 早于本轮、非有限 counts、零测试、总测试名数不一致及失败名数不一致全部写入 `problems[]`。
- `:985-1007` 的 pass 谓词为 `evidenceOk && failedUnexpected.length===0`；台账只解释失败名，不再能解释证据缺失。`exitCode` 仍保留诊断语义，未把合法已知红误改为无条件红。
- 当前 root-test JSON 为 `5956/5988`、32 failed、`testNames.length=5988`、`failedTestNames.length=32`、`failedUnexpected=[]`、`evidence.problems=[]`；原生 `exitCode=1` 如实保留（`root-test.json:4-5,6070-6133`）。

负控只读核对：

- `.cache/negative/root-failclosed/root-failclosed.json:4-77` 的 missing / malformed / stale / stale-mtime / zero / mismatch 六例均为 `exitCode=1 ∧ cellStatus='fail' ∧ failedUnexpected=[] ∧ problems 非空`。
- driver 只替换 evidence cache 与 vitest 二进制三处锚点（`run.mjs:23-34`），其余为真实 runner；本次在内存中重放这三项文本替换，生成物与当前 `run-baseline.mjs` **逐字相同**。fake vitest 的 missing/stale 以原生 exit 0 不写本轮 JSON，证明判定不依赖进程红，而依赖证据 fail-closed（`fake-vitest.mjs:36-54`）。
- 台账文件在 `f7a3f74..caede8a` 零 diff；独立集合作比对为 4 knownRed + 28 environmentRed = 当前 32 个唯一失败名，缺失、额外、重复、unexpected 均为 0。B-3a…e 的名级判定、冻结来源、新文件不得入账、披露与聚合语义未放宽。

矩阵摘要已同步修复：`matrix.log:45` 直接显示真实 `5956/5988` 与 32 known-red，不再出现 `undefined/undefined`。

### 3. SA9-2 / SA9-8：G10 词法与负控闭合，冻结语义零漂移

实现核对（`gates.mjs:465-670`）：

- `codeMask` 将注释、regex 体和 template 文本排除出有效代码；`prevSignificantIndex` 同时跳过空白与注释，因此 `(` / `,` 后的块注释、JSDoc 或换行行注释不再破坏 `argumentStart`。
- 字符串记录开启引号前的有效代码字符与最内层调用；dotted callee 链同样跳过注释。regex 支持转义、字符类和 flags；template 以 template/expr 帧处理 `${…}`、对象 brace 与嵌套 backtick。
- `m4CandidateOf` 对实参位中不可归属或全局不可判定的字面量返回 `callee=UNRESOLVED-CROSSLINE`，随后进入类 6；并未以静默 non-candidate 放行。非实参位仍按钉死语义排除。
- `G10_M4_PROBES` 实数 **29**（原 8 + 注释 9 + regex 5 + template 6 + 不可判定 1，`gates.mjs:863-899`）。同行块/JSDoc、跨行块/JSDoc/行注释、callee 链夹注释、注释散文、regex、嵌套模板、模板文本与不可判定出口均在探针集内。行注释会吞掉本行后续代码，其有效代码后续形态天然是跨行，探针覆盖与语法事实一致。

证据核对：

- `gates.log:308` 为正树 `cross-line M4 probes 29/29`，类 6 为空；`:311` 为 12/12 gates PASS。
- 三个真实文件注入均 `exit=1`、G10 FAIL，且类 6 callee 精确命中：`inject-comment-cross-line.log:298-310`、`inject-comment-block-jsdoc.log:298-310`、`inject-regex-and-nested-template.log:298-312`。
- M-6 注释透明回退产生 3 条目标探针红；M-7 regex 回退产生 2 条；M-8 template-expression 回退产生 1 条；三者均 `exit=1 ∧ gate10Failed`（`gates-mutations.json:4-42`）。变异作用于 `.cache` 副本，真实注入文件均在 finally 删除，当前无残留。
- 只读重算当前 gates 全量记录：BASE 子集 **285 = `1=19, 2=13, 3=7, 5=4, 5D-R=196, 5D-C=46, 6=0`**，恰为 I-1@rev2.1；新增文件命中仍为 4（`1:1 / 3:2 / 5D-R:1`）。before/final 全量 diff 恰三处行号位移，类别、token、文件不变。
- `G10_LINE_ALLOW`、`G10_FILE_ALLOW`、V_ctx、V_M4、扫描面与分类基线未改；`baselines.json`、root-test 台账、runner 与 lifecycle 测试两侧 23 名枚举在 `f7a3f74..caede8a` 均逐字不变。未借修漏扩大允许清单或改变分类语义。

### 4. SA9-3：四个点名 timer 族均改为真实、可证伪 trigger

| 族 | 当前真实 trigger 与取消段 | 反证/区分证据 |
|---|---|---|
| reconcile | `ws-replication-cordis-root-timers.test.ts:743-766` 先记录既有 peer round 最大值，再等待严格更大的新 `SYNC_STEP1` round id，随后观察 rhythm 二次 arm；stop 后 interval 与 round deadline 均清零。 | M-5 将周期回调改为不启动 round；B1/B2/B3 均恰 `T.reconcile-interval` 1 红、其余 0 红（`mutations.json` 各 M-5）。首次 arm 已不能满足 trigger。 |
| peer waitForLive | `:603-675` 等待 25 ms poll 真实 `entry.fired`，确认非 live 状态，再 `addTarget` 并等待原 Promise resolve；独立 stop→reject 后 pending=0。 | 不再以 stop reject 代替 poll trigger；三基线 × 3 repeat 的该名均 passed。 |
| close/drain | `:469-508` 以 `peer.removeTarget` 驱动，缝上扣留真实 `CLOSE_NAMESPACE`，等待 closeTimeout 到期使 namespace closed；正常 `CLOSE_OK` 段使用不同预算并证明 timer 从未 fire。 | `:490-492` 证明无 GOAWAY 且连接仍 ready；reauth `:510-551` 独立证明 GOAWAY(REAUTH_REQUIRED)、1001/hub-reauth 且无 CLOSE_NAMESPACE。两族不再共用 trigger。生产 `peer-namespace.ts:1136-1176` 证实该路径真实 arm close timer。 |
| bulk ACK | `:768-806` 正常交付真实 kind=2 多 chunk，等待 sender(peer) 的真实 `chunked-sync-acked`，再验证 assembly deadline 清理及零 abort。 | 不再以 stall/pending 充当 ACK；独立 `T.assembly-timeout` 保留 timeout abort。生产 `peer-namespace.ts:691-710` 证实该 observer 事件来自真实 bulkTransfer settle。 |

三基线的 timers cell 均为 12/12 × 3，逐 repeat JSON 中上述目标名均各自存在且 passed；不是只看汇总日志。装饰性 `peerAssembly.timer` defined 断言已删除。

### 5. SA9-4…SA9-7 与清理质量

- **逐 repeat**：`run-baseline.mjs:628-649,702-717` 对每一轮独立判定并保存 `repeatJudgements`；三基线每一轮均为 23/23、`missing=[]`、`coverage=true`、`foreignUnits=[]`、issue420 10 tests、`ok=true`。双枚举仍是受控维护点，但本轮枚举零漂移且双向 foreign/missing 检查保留，不构成未闭合项。
- **等待纪律**：ownership `third-party-timer-ownership-red.test.ts:35-41,83-91,118-122` 等待真实 fired；lifecycle `:388-402` 先等全量 pending=0，再以显式事件轮次收集迟到 rejection，不再裸 `delay(5)`。
- **死代码**：`cordis-baseline-support.ts` 现仅 352 行，iter-0 点名的 `RUNNER_MODE`、event sink、runtime dependency provider、close recorder 等死导出均不存在；lifecycle 顶部 import 均服务真实装配/断言。
- **摘要/注释**：`printMatrix` 使用统一字段；helper `:9-19` 与 lifecycle `:10-20` 的 runner/JSON 命名注释与实现一致。SA3 终版采用 1 hunk 内 3 处语义编辑、29/29、5956/5988 等当前数值，旧值仅作为明确的 before/after 对照出现。

### 6. 不得回退项与本轮新风险

| 核验项 | iter-1 只读结果 |
|---|---|
| 十文件 ALLOW | `d59a4d1..caede8a` 非 wiki 改动恰 10 文件，与设计 §12.1 集合双向相等；全范围另含 9 份过程文书。iter-3 delta 只改其中 7 个实现/测试文件及 2 份 wiki。 |
| 生产及冻结面 | `packages/*/src/**`、`apps/*/src/**`、`domains/*/src/**` 零 diff；ADR、artifacts、manifest/lock 零 diff；`git diff --check` clean。当前被审实现文件与 `caede8a` 一致。 |
| 矩阵 | `matrix.json` 恰 41 cells、41 pass、0 fail；`matrix.log:46` 为 `MATRIX PASS: 41 cells`。 |
| typecheck | B1/B2/B3 各 15 projects、15 个 exit 0，合计 **3×15/15**。 |
| 行为计数 | 每基线 channel 33/33、timers 12/12×3、lifecycle 34/34×3、guard-proxy 71/71、composition-root 28/28、ws-package 66/66。 |
| lifecycle units | 每基线 23/23 × 3 repeat，`unit-union.json` 为 observedUnion=69、problems=[]；23 名枚举未改。 |
| N-1 / N-2 | N-1 三个目标 suite、N-2 两个目标 suite 均逐 cell `status:'fail', exitCode:1`；外层 expected/observed=fail 语义未误读为业务绿。 |
| M-1 / M-2 / M-5 | M-1：B1/B2 4 红（新增 SessionHost guard 用例同因第 4 红）、B3 3 红；M-2：三基线各 9 红；ws-package gap 均 66/66。M-5：三基线均恰 reconcile 1 红。 |
| 还原 | 3 基线 × 3 变异 = **9/9** `sameAsPristine=true ∧ sameAsHead=true`。证据生成时 `mutations.json.head` 记录为 f7a3f74（提交前 HEAD），但 `plugin.ts` 与 `peer-namespace.ts` 在 f7a3f74..caede8a 零 diff，且当前字节/SHA 与 caede8a 一致，故还原证据对 reviewed head 仍成立，不构成回退或新风险。 |
| 导出面新增测试 | `base-exports.json` 明确 base=d59a4d1，clock 5 名、namespace-registry 9 名、ws-replication/testing 5 名；channel 测试逐名集合相等断言，三基线 71/71 guard-proxy 与 33/33 channel 留证。未改生产导出。 |

本轮 delta 未引入第二 runner/probe、生产环境分支、新允许清单、新配置面或新的生命周期所有者。G10 仍是明示的手写词法器而非完整 JavaScript parser；本次闭合判据要求的 comment/regex/nested-template 状态与保守出口已具实证，不以「完整 parser」另设新门槛。

### 7. 提交消息与 A8-4 披露

`caede8a` 提交 body 如实写明 root-test **5956/5988、32 红 = 4 既有 test-d + 28 环境红**，说明 expect-type 1.4.0 可选参数元组原因、另票边界、ambient pnpm 11.28.5 与对齐 pnpm@10.28.2 后环境红转绿，并明确「不声称 CI/所有既有测试全绿」。没有将台账绿表述为 root-test 原生全绿。

对齐复跑独立证据仍成立：`aligned-capture.json:2-20` 记录 BASE d59a4d1、pnpm@10.28.2、**5913 total / 5909 passed / 4 failed**，恰剩 4 个 test-d，`environmentRedNowGreen=28`、`knownRedStillRed=4`。当前 root-test 只表示「新鲜完整 JSON 上失败名集合 ⊆ 冻结台账」，不是 root-test/CI 全绿宣称。

### 8. 最终结论

**verdict = approve（0 BLOCKER / 0 MAJOR / 0 MINOR）。可交付。**

---

# 附录：iteration 0 原始报告（历史归档，非当前裁决）

状态：**standards-review，iteration 0；verdict = reject（0 BLOCKER / 3 MAJOR / 5 MINOR）**。

被审对象：本地提交 `f7a3f7464272da0ed16e53ecdd708d93294bb948`（短 SHA `f7a3f74`），范围严格为 `git diff d59a4d141c6c5ac7f267295829157d9570cde36e..f7a3f74`。本评审只判断仓库/工程标准、模块责任、门禁与测试质量、证据和文书一致性；不替代 SA10 的 Issue 完备性判定。

评审方式：逐行实读十个实现/设施文件、根及相关模块 `AGENTS.md`、设计 rev 3、SA6、SA3/SA4/SA8；只读解析 `.cache/` 落盘 JSON/log，并做集合与字节比对。**未运行测试、gates、typecheck 或服务，未修改任何被审实现/设计/测试。** 工作树中本提交以外的其他过程文书不属于本次 diff，未纳入裁决。

---

## 1. 结论

**reject，当前不可交付。**

改动面、模块归属、生产零 diff、现有落盘数值与负控/还原证据总体真实且可复核；但以下三项 MAJOR 直接破坏交付所依赖的工程保证：

1. root-test cell 在 JSON 缺失、损坏或复用旧文件时可以 **无当前证据却判 PASS**；
2. G10 对常见的“实参前带注释的跨行调用”仍会 **静默漏检**，不满足钉死的跨行 fail-closed；
3. timer 验收中有两处“trigger”判据在 arm 后已经恒真，另有一处 close/drain 与 reauth 路径混用，不能支撑“十二族三段证据”的交付叙述。

这三项不是对既有红色测试的苛求，而是**门禁可假绿 / 断言不可证伪 / 文书超声称**的问题。现有 `41/41 PASS` JSON 并非被认定伪造；阻断点是实现不能保证该 PASS 在未来失败情形下仍然可信，且部分当前测试本身没有测量其声称的行为。

---

## 2. 改动面与模块契约：通过（附 MINOR 清理项）

### 2.1 精确范围

实际提交为 **19 个文件**：设计 §12.1 的十个实现/设施文件（`wiki/raw/task_issue-471_design.md:399-414`）+ 九份 `wiki/raw/task_issue-471*.md` 过程证据。

- 十文件恰为：3 个既有设施修改（`baselines.json`、`run-baseline.mjs`、`gates.mjs`），7 个新增测试/helper/台账；无第 11 个实现文件。
- `docs/adr/**`、`artifacts/**`、所有 `package.json` / lock、`src/index.ts`、生产 `packages|apps|domains/**/src/**` 均为零 diff；`baselines.json` 仅 `base/comment/suites` 三处语义编辑，冻结的 integrity / dshCommit / probes 未改（`baselines.json:2-20,74-119`）。
- G3/G12 白名单与裁决值一致（`gates.mjs:50-67,835-849`），未夹带 fixture 复制件或第二套 acquire/probe/runner。

### 2.2 模块责任与惯例

- app 测试只消费公开包入口（`apps/yjs-server/test/third-party-timer-ownership-red.test.ts:23-30`），符合 `apps/yjs-server/AGENTS.md:14-25`；DSH 直接 apply 测试同样只走公共入口（`packages/dsh-persistence/test/dsh-profile-direct-apply-order.test.ts:15-23`）。
- `cordis-baseline-support.ts` 明确是 test-only observer/helper，不是生产导出或第二验真设施（`cordis-baseline-support.ts:1-20`）。根 glob 仅收集 `*.test.ts`（`vitest.config.ts:14-21`），该 helper 不会被独立收集；runner 的 `NEW_FILES` 负责向基线 workspace 复制它（`run-baseline.mjs:115-135`）。
- helper 不读取 `.cache` 业务路径；环境变量仅用于基线标签、runner 身份断言与受控 fault 注入（`cordis-baseline-support.ts:30-46,277-310`）。没有把 baseline/env 分支带入生产 `src/**`。
- 新测试注释使用英文，与相邻验收设施既有英文注释一致；类型检查证据为三基线全绿。静态搜索未见 `skip/only/todo`、`@ts-ignore`、`eslint-disable` 或业务测试里的 `as any`。`as never` 主要用于 Cordis 测试替身/负控，和相邻既有 fixture 的用法一致，未据此判为滥用。
- 每测试 20–30s 上限、谓词轮询、注入 transport、100KB 小载荷和 `maxWorkers:1` 的总体资源预算合理；固定等待与失败路径清理的局部问题见 SA9-5。

---

## 3. 落盘证据与文书核对：数值一致，但两类超声称须修正

### 3.1 已独立核实为一致的陈述

| 陈述 | 只读核证结果 | 证据 |
|---|---|---|
| `41/41 PASS` | `matrix.json` 恰 41 cell、41 pass、0 fail；汇总日志 `MATRIX PASS: 41 cells`、`MATRIX_EXIT=0` | `.cache/cordis-baselines/evidence/matrix/matrix.log:4-47` |
| `3×15/15` typecheck | B1/B2/B3 各 15 project，45 个 `exitCode` 全 0 | 同上 `:5,18,31`；`matrix.json:16-79` 及 B2/B3 对应 cell |
| 三基线 repeat 与计数 | 每基线 channel 29/29、timers 12/12 × 3、lifecycle 34/34 × 3、ws-package 66/66、guard-proxy 38/38、composition-root 28/28 | `matrix.log:6-43` |
| `units 23×3` / 并集 69 | 三 cell 均 `expected=23, observed=23, missing=[]`、`coverage=true`、`foreignUnits=[]`；独立从 `testNames` 复算为 69 个唯一 `L.` 全名 | `unit-union.json:2-8`；matrix lifecycle cells |
| root-test 台账 | BASE 失败集与台账双向精确相等：4 knownRed + 28 environmentRed；当前 5984 tests / 32 failed，`failedUnexpected=[]`；4 个 test-d 名实际在捕获中 | `root-test-known-red.json:4-75`；`root-test.json:6081-6116`；`ledger-capture.json:2-15` |
| 对齐环境披露 | 对齐 pnpm 后 5913/5909/4，恰剩 4 个 knownRed，28 个环境红转绿；没有宣称 root-test/CI 全绿 | `aligned-capture.json:2-22`；`root-test.json:6100-6116` |
| N-1 / N-2 | N-1 三个目标 cell 全 fail，N-2 两个目标 cell 全 fail；外层 fault 编排为 pass/observed=fail | `fault-substitute-npm.json:4-8,67-87`；`fault-legacy-shim.json:4-8,59-75` |
| M-1 / M-2 | 三基线 M-1 各定向 3 红、M-2 各定向 9 红，ws-package 同变异均 66/66 | `.cache/mutations/mutations.json:19-99,115-195,211-291` |
| 6 次逐字节还原 | `restores[]` 六条均 `sameAsPristine=true ∧ sameAsHead=true`、39033 bytes；本次另将三 workspace 最终 `plugin.ts` 与提交字节比对，三者全等，SHA-256 均为 `dc121111…b47f4ee53` | 同上各 `restores`；提交 `f7a3f74:packages/ws-replication/src/plugin.ts` |
| G10/N-6 既有留档 | 正树 12/12、class 6=0、16/16 samples、18/18 cast、8/8 cross-line；N-6 三形态与两种跨行注入均实红 | `gates-final.log:299-311`；`N6-gates-final.log:299-320`；`N6-crossline-gates.log:299-314`；`N6-crossline-blank-gates.log:299-314` |

另一个一致性交叉点：BASE 对齐捕获为 5913 tests，当前 root-test 为 5984 tests，差值恰 71 = channel 29 + timers 12 + lifecycle 24 + ownership 4 + direct-apply 2，和新增测试文件/根 glob 一致；helper 没有额外形成测试单元。

### 3.2 文书超声称

- 提交 body 第一条与 SA3 `wiki/raw/task_issue-471_sa3_impl.md:32-34,87` 所称“十二 timer 族三段证据”过强，原因见 **SA9-3**。
- 提交 body 第二条及 SA3 `:3,160-195` 所称“跨行实参 fail-closed”对带注释的合法形态不成立，原因见 **SA9-2**。
- SA3/SA4/SA8 所述台账名级判定本身与当前 JSON 一致，但 runner 没有兑现通用的“无证据即不通过”（SA6 `task_issue-471_sa6_acceptance_contract.md:290-295,372-375`），原因见 **SA9-1**。

---

## 4. Findings

### SA9-1 — MAJOR：root-test 在证据缺失/损坏/陈旧时可 fail-open 为 PASS

**位置：**

- `packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs:874-903`（运行与 JSON 提取）
- `run-baseline.mjs:904-919`（pass 谓词）

**问题：**

`failedTestNames` 初始为 `[]`。若 `root-test.vitest.json` 不存在或 `JSON.parse` 失败，catch 仅把 `counts` 设为 `undefined`，随后 `failedUnexpected=[]`，而 `:918` 只凭 `failedUnexpected.length===0` 就给出 `status:'pass'`。`result.status` 只写入 `exitCode`，不参与该分支的 pass 判定。

此外，`jsonPath` 是固定路径且运行前没有删除或 freshness 校验（`:875-885`）。若本轮进程异常、reporter 未写文件，而上一轮 JSON 尚在，程序会读取旧证据；只要旧失败名属于台账，本轮仍可 PASS。空测试集、计数与提取名数不一致也没有 fail-closed 检查。

**影响：**

这直接违反 SA6「任何 cell 缺证据 = 不通过」及 B-3b 的名级提取约束。当前落盘恰好完整，所以 `root-test.json:4-5` 的 `status=pass, exitCode=1` 是可解释的台账绿；但同一实现可以在 **本轮没有有效证据** 时产生同样的 PASS，使 41/41 的聚合门禁失去防回归意义。SA3 `:138-142` 的“判据强度未降低/无 fallback”因此说得过满。

**建议与闭合判据：**

1. 运行前删除/隔离本轮 JSON，解析失败、文件缺失、空测试集、非有限计数、`numFailedTests !== failedTestNames.length`、`numTotalTests !== testNames.length` 均必须 `status:'fail'`；已知红只有在**本轮新鲜且完整的 JSON** 上才允许台账判绿。
2. 保留 `exitCode` 作为诊断，不要把“已知红导致 exit 1”误改成无条件红；同时增加 missing / malformed / stale / zero-test 四种负控，证明 cell 实红且 matrix exit 非 0。
3. 修复后重取 root-test 与 41-cell 证据，并在 SA3/SA4/SA8 文书中补记该负控。

### SA9-2 — MAJOR：G10 对“注释后的跨行 `'root'` 实参”仍静默漏检

**位置：**

- `packages/persistence/test/fixtures/cordis-baselines/gates.mjs:471-494`（`previousNonSpace` / `argumentStart`）
- `gates.mjs:541-547`（非候选出口）
- `gates.mjs:615-624`（`continue` 静默跳过）
- `gates.mjs:737-746`（现有跨行探针未覆盖该形态）
- 钉死语义：`wiki/raw/task_issue-471_design.md:276-284`

**可直接由代码推导的漏检形态：**

```ts
const legacy = Reflect.get(
  ctx,
  // explain why the legacy key is needed
  'root',
)
```

同一行回溯在当前行找不到 `(`，进入 whole-file lexer。`previousNonSpace` 只跳过 whitespace、不跳过 comment，故在 `'root'` 前看到的是注释文本末尾字母，而非 `(` 或 `,`；于是 `argumentStart=false`，`m4CandidateOf` 返回 `{candidate:false}`，sweep 在 `:620` 直接 `continue`。该读取既不进入 class 6，也不进入 5D 记录。块注释结尾 `/` 同样触发此路径。

**影响与定级说明：**

这不是 SA4-8 所述极端正则/模板角落，而是普通、常见的格式化注释。它精确落在设计 R1 M4 要求覆盖的跨行实参位，并被静默丢弃，违背“不可解析 ⇒ 候选 ⇒ 类 6；不得静默按非候选丢弃”。SA4 已把同类现象记为 SA4-7 MINOR（`task_issue-471_sa4_review.md:298-301`）；本次最终标准评审将其升为 MAJOR，因为它使本票核心防线的 fail-closed 承诺在常规代码下失效，且现有 8 条探针和 N-6 都无法揭示它。

**建议与闭合判据：**

- 在统一 lexer 中记录“最后一个有效代码 token”，跳过 line/block comment，而不是用原始字符反推实参起点；不可判定时仍归 `UNRESOLVED-CROSSLINE` ⇒ class 6。
- 将上述 `//` 与 `/* */` 两种形态加入 `G10_M4_PROBES`，并至少做一次真实文件注入红证；正树 BASE 分类计数应继续保持既有 285 条基线，新增文件 delta 逐条可解释。
- 同步收窄提交/SA3 的“跨行 fail-closed”表述，直到该形态有实证。

### SA9-3 — MAJOR：timer 测试存在恒已成立/错路径的 trigger，十二族“三段证据”不成立

**位置 A — reconcile 的 trigger 是 arm 状态的同义反复：**

`packages/ws-replication/test/ws-replication-cordis-root-timers.test.ts:683-695`

`:687-688` 已等待并断言 `includes(reconcileIntervalMs)` 和 `pendingFor(...) > 0`；紧接着 `:690-692` 的 trigger 仅为 `armsFor(...) >= 1 && pendingFor(...) >= 1`。首次 arm 后该谓词已经成立，既不要求第二次 arm，也不要求新的 `SYNC_STEP1`、round id 增长或 observer 事件。即使周期回调完全不执行，测试也可通过。仓库已有可对照的真实 round 观察法：`ws-replication-periodic-reconcile.test.ts:6-10,19-30`。

**位置 B — chunked bulk ACK 没有观察 ACK 或 timeout：**

`ws-replication-cordis-root-timers.test.ts:701-737`

`:724-730` 只证明 arm、真实 kind=2 帧、尾帧被 withhold、pending>0；随后直接 close 并验证清理。没有等待/断言 `chunked-sync-acked`（生产事件见 `packages/ws-replication/src/hub-namespace.ts:775-795`），也没有等待 assembly abort。`pending>0` 仍只是 arm/stall 状态，不是独立 trigger。另一个 `T.assembly-timeout` 用例不能反证本用例已经观察了 bulk ACK。

**位置 C — close/drain 与 reauth 共用触发路径，附加断言为装饰：**

`ws-replication-cordis-root-timers.test.ts:457-498` 与 `:500-534` 都调用 `hub.requestReauth(PEER_INSTANCE)` 来武装 `closeTimeoutMs`。前一用例没有走独立 close/drain 触发路径；`:493` 的 `expect(peerAssembly.timer).toBeDefined()` 不改变任何行为，且 `peerAssembly` 未参与 hub 的 timer 驱动。这也不能支撑两个独立族的三段证据叙述。

**影响：**

这些断言在目标行为消失时仍可为绿，属于测试卫生中的自证式/不可证伪判据。三基线 `12/12 × repeat 3` 的**执行计数**是真实的，但不能据此写成十二族均有 arm→trigger→cancel 证据；提交 body、SA3 `:33,87,140` 与 SA4 `:91-110` 对三段覆盖的描述需收窄或补足。

**建议与闭合判据：**

- reconcile：记录触发前 round/frame 基线，要求新 `SYNC_STEP1`/round id 或严格增加的 re-arm，再验证 stop 清零；可用“禁止周期 round 启动”的变异证明应红实红。
- bulk ACK：将正常末帧放行并观察实际 `chunked-sync-acked`，或把本用例明确改成 stall/cancel 并不再声称 ACK trigger；保留独立 timeout 用例观察 `reason:'timeout'`。
- close/drain：从实际 close/drain 路径触发，删除装饰性断言，并增加与 reauth 可区分的负控。
- 修复后重跑三基线 repeat，更新提交说明与 SA3/SA4 证据表。

### SA9-4 — MINOR：lifecycle 只对最后一次 repeat 做枚举/fail-closed 归类，双枚举靠漂移后变红而非同源

**位置：**`run-baseline.mjs:647-671,683-691`；`run-baseline.mjs:98-110`；`ws-replication-cordis-baseline-lifecycle.test.ts:82-96`。

`run` 是 `runs` 的最后一项，`lifecycleUnits(run.assertions)`、`coverage`、`foreignUnits` 和 issue420 只在最后一轮计算。前序 repeat 仅检查 exit/counts，未检查自己的 23 名、coverage、foreignUnits、issue420。当前三份 repeat 均 34/34，故未造成现有假绿；但后续若测试按轮次改变收集/命名，前一轮缺陷可被最后一轮掩盖。建议对每轮分别计算并全部要求通过，cell 可保存逐轮 judgement。

runner 与测试各维护一份 `LIFECYCLE_UNITS`。目前两边一致，且 runner 少列会因 observed<23 红、测试多列会因 foreignUnits 红，属于可控的双维护；更好的长期做法是由单一可共享枚举/生成物提供列表，或至少把逐轮集合相等检查作为明确不变量。

### SA9-5 — MINOR：局部固定墙钟等待使测试在慢 CI 上有不必要抖动

**位置：**`apps/yjs-server/test/third-party-timer-ownership-red.test.ts:73-80,108-111`；`packages/ws-replication/test/ws-replication-cordis-baseline-lifecycle.test.ts:373-391`。

ownership 两处分别固定等待 30ms/25ms 后断言真实 timer 已 fire；慢环境下回调可能尚未执行。建议沿用本票 `waitFor(predicate, label, deadline)` 形式，等待 `armed/fired===true`，deadline 耗尽才红。lifecycle 在 fiber dispose 后固定 `delay(5)` 再读 `unhandledRejection`，也宜改为明确的事件轮次/有界谓词等待。`expectQuiet` 的 quiet window 是有意的“持续不发生”判据，不与上述固定等待混同。

### SA9-6 — MINOR：helper/测试含未使用导出、死变量与装饰性断言

**位置：**

- `cordis-baseline-support.ts:40` `RUNNER_MODE`、`:174-196` `captureMessage/createEventSink`、`:328-345` `provideRuntimeDependencies`、`:397-412` `recordCloses` 在本票无消费者。
- `ws-replication-cordis-baseline-lifecycle.test.ts:36,456,502,584`：import 只为 `toBeTypeOf('function')` 装饰断言；`sessionHandle` 从未赋值，optional cleanup 永远无操作。
- `ws-replication-cordis-root-timers.test.ts:493`：`peerAssembly.timer` 的 defined 断言不影响判定（并见 SA9-3 的错路径问题）。

这些不降低其余有效断言，但增加维护噪声。建议删除死导出/死变量；需要保留 import 时让其实际参与装配，而不是以恒真断言“消化” import。

### SA9-7 — MINOR：矩阵摘要与若干注释/文书存在可读性小错

1. `run-baseline.mjs:893,927` 的 root-test counts 使用 `numPassedTests/numTotalTests`，但通用打印在 `:981-989` 读取 `counts.passed/total`，所以实际日志显示 `default root-test … undefined/undefined`（`matrix.log:45`）。建议统一字段或按 cell 类型格式化；root-test 行应直接显示 5952/5984 与 32 known-red，避免误读为证据缺失。
2. `cordis-baseline-support.ts:10-12` 写 runner “stay untouched”，但本票明确修改 `run-baseline.mjs`；应改为“single canonical runner remains the only runner”。同文件 `:17` 与 lifecycle `:13` 仍写 JSON `<label> > L.…` 分隔符，和 runner 已核实的 Vitest 空格拼接事实（`run-baseline.mjs:590-600`）不一致，建议同步注释。
3. SA3 `wiki/raw/task_issue-471_sa3_impl.md:203,233` 写 `baselines.json` 为“3 hunk”，实际是 **1 hunk 内 3 处语义编辑**（SA4 已在 `task_issue-471_sa4_review.md:302` 记录）；SA3 `:63` 仍写旧“回归自检 12/12”，而终版 `:228` 为 16/16，应清理迭代间陈旧数字。

### SA9-8 — MINOR：手写 G10 词法器仍未建模 regex/nested template，长期维护应有明确保守出口

**位置：**`gates.mjs:496-533,659-706,730-746`；既有披露 `task_issue-471_sa4_review.md:301-302`。

当前状态机只处理字符串、注释和括号，不区分 regex literal 与除法，也不理解 `${}`/嵌套模板。含引号或未配对括号的正则可能改变 quote/括号栈，嵌套模板可能提前结束 backtick 状态。它们暂时没有造成 BASE class 6，但会使未来归属误为 5D-C 或非候选，且 8 条跨行探针未覆盖。

建议优先使用仓库已有 TypeScript parser 做调用实参归属；若继续手写，至少把 regex/template 状态及“不可判定即 UNRESOLVED”写成显式规则与探针。G10/G11/G12 的失败消息总体可操作（路径、类别、callee、allowlist diff 均明确），应在加固时保留这一优点。

---

## 5. 门禁、台账与可维护性专项评价

- **G10/G11/G12 可读性**：常量与分类表有明确命名，失败输出可定位；但 G10 约 450 行扫描/分类/探针已接近独立解析器，SA9-2/SA9-8 表明“手写词法 + 多入口分类”是主要维护风险。合成探针与实扫共用判据是正确方向，不能替代常见合法语法的负控。
- **runner units 提取**：改用 `assertion.title` 符合 Vitest JSON 实际形状，枚举外 `L.` 名归为 foreign 的方向正确（`run-baseline.mjs:590-617`）；需要补的是逐 repeat 判定（SA9-4），不是回退到不存在的 `' > '` 分隔符。
- **台账字段与纪律**：`schemaVersion/ticket/capturedAt/knownRed/environmentRed/attribution/notes` 自解释，32 条均有归因，notes 明确禁止新增条目及全绿表述（`root-test-known-red.json:41-75`）。当前台账集合与 BASE 精确一致；但台账内容正确不能弥补 runner 证据解析 fail-open（SA9-1）。
- **units 双维护**：当前通过 runner foreign/missing 与测试 coverage 形成双向漂移报警；逐轮判定和单一枚举来源仍是后续降低维护成本的重点。
- **提交信息**：范围、矩阵计数、typecheck、负控和还原描述基本准确，也没有宣称 root-test/CI 全绿；但“跨行 fail-closed”及“十二族三段证据”须待 SA9-2/SA9-3 修复后才准确。

---

## 6. 复审条件与冲突路由

必须闭合 **SA9-1、SA9-2、SA9-3**，并以修复后的新鲜证据复审；SA9-4…SA9-8 不阻断，但建议同票清理。

这些修复均可按现有设计/SA8 钉死语义在既有十文件 ALLOW 内完成，不需要新 ADR 或新验收标准，因此本报告不主动要求新的冲突裁决。**若**修复选择改变 G10 候选词表、允许清单、分类计数基线、root-test 台账集合或 23 名枚举语义，则必须另行回 SA8；不得以本次修漏为名扩大白名单。

**最终 verdict：reject（0 BLOCKER / 3 MAJOR / 5 MINOR）。当前不可交付。**
