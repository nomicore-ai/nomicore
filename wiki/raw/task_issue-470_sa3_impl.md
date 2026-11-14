# SA3 Implementation Report — issue #470（Cordis rc.12 双形态 Root tracer bullet 与工件验真）

- Worktree/HEAD：`/home/wangjian/nomicore-fix-issue-470`，分支 `mabf/issue-470`，HEAD = base = `279dba4ac81b7c7520e3d0b87b5c4d621a86a517`（**改动全部留在工作树，未 add / 未 commit / 未 push**）。
- 施工图：`wiki/raw/task_issue-470_design.md`（iteration 1，approved）。本报告按设计 §14 的实施序落证；设计 artifact 未被回改。
- 结论（待 Controller 裁决）：**实现完成、TDD 红→绿成立、三基线 15-project typecheck 全绿、4 负控全部按预期判红（本轮四枚证据已齐备，见 §6.1）、G1′–G9 全绿、`ws-package` cell 绿（R-5 后复跑 66/66）**。唯一红 cell = `root-test`（默认布局全量 vitest）：矩阵运行 5880/5912、**32 failed = 28 环境 + 4 既有**（28 = 环境 pnpm（corepack 11.28.5）违反仓库 `packageManager: pnpm@10.28.2` 声明所致子进程失败；4 = 既有 `ws-replication-issue421-edge-factory-api.test-d.ts` 可选参数元组断言与 expect-type@1.4.0 / vitest 3.2.7 不兼容），32 例已在 **BASE 279dba4 上等量复现**且证据已持久化（§8.1）；在 packageManager 对齐环境复跑全量为 **5908/5912，仅余 4 例既有红**（§9.5 R-3）。红因均非本票改动引入，且无法在 §11.1 ALLOW 内修复。**本报告任何位置均不声称「根 test 全绿 / 默认布局全量通过 / 既有测试全绿」**（SA8 §4.2(c) 约束，逐条见 §9.5「交付叙述约束」）。
- **iteration 2（SA10 最终 spec-review，`wiki/raw/task_issue-470_sa10_spec.md`）**：必修项 M2（AC3(c) 持久化结果断言缺失）已在本轮闭合——在既有 ALLOW 内的 N2 新增可证伪断言，三基线 real-timer 11/11 绿、BASE+B3 目标原因红；详见 **§9.6**。M1（`task_issue-470_sa4_review.md:155` 的「root-test 全绿」叙述）属 SA4 自有 review 工件，不属 SA3 范围，未改动。

---

## 1. Inputs consumed

| 输入 | 使用方式 |
|---|---|
| `wiki/raw/task_issue-470.md` | owner 原文（8 checkbox + L17 尾句；Comments 空） |
| `wiki/raw/task_issue-470_design.md` | 唯一实现依据：§5 seam 形态/C-R4a–d/B1 捕获纪律/§5.2 文案冻结、§6 fixture 迁移、§8 三基线设施、§11 ALLOW/DENY、§13 AC 矩阵、§14 TDD 序与红灯纪律、§15 gates、§16 冻结面、§17 交付清单、§18 风险、§21 OPEN |
| `wiki/raw/task_issue-470_sa2_review.md` | approve + N-1/N-2/N-3 MINOR（处理见 §9） |
| `wiki/raw/task_issue-470_design_conflict_report.md` | clear + 实现后复查清单 + advisory A′-1（`@nomicore/*` resolve 载体；落实见 §6.3） |
| `wiki/raw/task_issue-470_sa6_acceptance_contract.md` | AC1–AC9 判据、§12.1 integrity 钉值、§12.3 probe 表、§12.4 gate、§12.5 输出契约、附录 A |
| `wiki/raw/task_issue-470_conflict_report.md` | R1–R9 绑定裁决（R2 迁移面、R4 seam 形态、R5 provenance 8 项、R7 gate、R8 冻结面） |
| `wiki/raw/task_issue-470_sa4_review.md` | 实现评审 approve（0 BLOCKER/0 MAJOR）+ 交付限定（root-test 红表述纪律、负控证据口径） |
| `wiki/raw/task_issue-470_impl_conflict_report.md` | **iteration 1 输入**：SA8 实现级复查（verdict=reject，仅证据面）§4.2(b)(c)(d) 裁定、§5 负控缺口、§8 Required actions、§9/§10 —— 本轮 R-1–R-6 的闭合对象 |
| `docs/adr/0035`（normative）+ 0006/0009/0012/0023；`packages/{persistence,dsh-persistence,ws-replication,namespace-registry}/AGENTS.md` | 决策形态、生命周期语义、模块门禁 |

---

## 2. Existing worktree reconciliation

开工前工作树只有 `wiki/raw/**`（untracked 设计/评审/dispatch 文档），`packages/**`、`docs/**`、`artifacts/**`、根清单零实现 diff——与设计「未实现」前提一致，无需修补历史实现。

---

## 3. Changed paths（逐条对照 §11.1，**6 修改 + 11 新增，无加减项**）

### 3.1 tracked 修改（6）

| # | Path | §11.1 承载 | 实际改动 |
|---|---|---|---|
| M1 | `packages/persistence/src/service.ts` | persistence seam | 新增包内私有 `CORDIS_ROOT_SYMBOL`/`ROOT_TIMER_UNAVAILABLE`/`RootTimerSource`/`throwRootTimerUnavailable`/`safeReadChannel`/`assertRootTimerShape`/`tryResolveRootTimer`；`createCordisPersistenceScheduler` 改为 apply 期解析 + **捕获 `rootTimer` 对象引用**并以 `rootTimer.timeout(callback, delayMs)` 方法调用武装；三处 doc comment 同步（含明文禁 detach 的理由）。原 `ctx.root.timeout` 惰性读取消失 |
| M2 | `packages/ws-replication/src/plugin.ts` | ws seam | 同规私有解析函数（文案沿用既有 `required Cordis root timer context is unavailable` 逐字节不变）；`timerFromContext` = host 级联（`timer.ctx → ctx`）+ symbol 优先 + malformed/null-host 立即 throw；`OwnedTimer` 改为 `rootTimer.timeout(...)` 方法调用（对象引用，零 detach） |
| M3 | `packages/ws-replication/test/ws-replication-plugin.test.ts` | fixture 迁移 :24,25,41 | 内联 `resolveRootForTest`；`effectTimer` 用 helper；`dependencies()` 删探测分支 → 统一 symbol shim |
| M4 | `packages/ws-replication/test/ws-replication-issue299-ac-red.test.ts` | fixture 迁移 :173,177 | 内联 helper + 统一 symbol shim（断言面零改动） |
| M5 | `packages/ws-replication/test/ws-replication-issue422-listen-false.test.ts` | fixture 迁移 :44,83,84 | 内联 helper + 统一 symbol shim（断言面零改动） |
| M6 | `packages/ws-replication/test/ws-replication-guard-proxy-consumption.test.ts` | fixture 迁移 :101,102 | 仅 `dependencies()` 改写；guard-Proxy 断言面原样（R8）。**iteration 1（R-5）**：删除本文件内未使用的 `resolveRootForTest`（净 diff 中该 helper 不再存在） |

diffstat：**R-5 后实测 `6 files changed, 177 insertions(+), 30 deletions(-)`**（R-5 删除 6 行未使用 helper 前为 183；路径集合零变化）；`packages/ws-replication/src/plugin.ts` 之外 ws-replication src 零改动。

### 3.2 tracked 新增（11）

| # | Path | 承载 |
|---|---|---|
| N1 | `packages/persistence/test/cordis-root-channel.test.ts` | AC1 全判据 + AC5 生产通道 sentinel + AC9 默认 options + B6 两条 pin（D10/D11）+ 基线形状（含 legacy-shim 故障注入点） |
| N2 | `packages/persistence/test/cordis-root-real-timer.test.ts` | AC2 三基线 × {memory,file} × {flush,retry,drain,dispose,service-revoke}，真实 `TimerService`；**iteration 2 追加** AC3(c)「UNLOADING 窗口内已接纳写在真实 Timer 上提交最新 generation」断言（§9.6） |
| N3 | `packages/persistence/test/cordis-baseline-provenance.test.ts` | AC4/AC5 身份断言（双位置 realpath、版本/integrity 钉值、无第二份、B3 clone/ls-tree/输出哈希/配方/诚实标注） |
| N4 | `packages/persistence/test/cordis-public-surface.test.ts` | AC7 runtime 导出面快照（persistence + `/testing` + dsh + ws 4 entry） |
| N5 | `packages/persistence/test/fixtures/cordis-baselines/baselines.json` | 三基线清单 + integrity 钉值 + probe 期望表 + suite 清单 |
| N6 | `packages/persistence/test/fixtures/cordis-baselines/provenance-b3.json` | R5 八项期望值（commit/32 条 source blob 全表/配方/输出哈希/诚实标注） |
| N7 | `packages/persistence/test/fixtures/cordis-baselines/public-surface.base.json` | base worktree 捕获的 4 entry 导出名快照（捕获流程见 §6.4） |
| N8 | `packages/persistence/test/fixtures/cordis-baselines/acquire.mjs` | npm tarball（纯 Node 解包 + sha512 复核）+ DSH sparse clone + 最小 tsc source-build + provenance 生成/复核 |
| N9 | `packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs` | NEW_FILES 并集物化 + 声明驱动 symlink farm + 6 suites/typecheck/ws-package/root-test/gates cells + 4 fault + `--all --matrix`。**iteration 1（R-4）**：root-test cell 从 vitest JSON 补记 `testNames/failedTestNames`（命令/聚合语义不变，见 §9.5 R-4） |
| N10 | `packages/persistence/test/fixtures/cordis-baselines/root-probe.mjs` | 独立 Root 通道探针（只 import baseline Context/TimerService） |
| N11 | `packages/persistence/test/fixtures/cordis-baselines/gates.mjs` | G1′/G2–G9 机械 gate（含 G5 五步捕获） |

### 3.3 与设计的偏差（实现期决策，需 Controller 归口）

| # | 偏差 | 理由/影响 | 是否越出 ALLOW |
|---|---|---|---|
| D-a | `gates.mjs` G2/G3/G1′/G7/G9 用 `git diff --name-only <BASE> -- <pathspec>` + `git ls-files --others`（工作树 vs BASE + untracked），而非设计的 `$BASE..HEAD` | 本 worktree 中 HEAD == BASE 且改动未提交，`$BASE..HEAD` 恒空 ⇒ gate 会**假绿**；工作树对比是**严格超集**（零 diff 义务一项不减，且 untracked 新文件也被覆盖）。语义更强，不是放松 | 否（gates.mjs 内部实现） |
| D-b | real-timer 的 `--repeat 3` 实现为 **3 次顺序 vitest 调用**（任一红即 cell 红，`repeatRuns` 落证据） | vitest 3.2 无 `--repeat` CLI flag；顺序 3 跑与「每个基线 ≥3 次、任一失败即失败」等价 | 否 |
| D-c | `root-probe` suite = 独立 `root-probe.mjs`（`--resolve-from <ws>/packages/persistence`）+ channel 测试 | 探针仍只 import baseline Context/TimerService，观测点=被测 ws 的解析位置；比「在 ws 内执行脚本」等价且不需要额外 ws 依赖 | 否 |
| D-d | 测试侧 env：`NOMICORE_CORDIS_{RUNNER_MODE,BASELINE,BASELINE_ROOT,TREE_ROOT,EXPECTED_CHANNEL,DSH_CLONE}`、`NOMICORE_CORDIS_FAULT=legacy-shim` | 仅测试代码读取（G8 机械证明生产 src 零 env/分支）；用于基线身份、期望通道、B3 clone 定位、legacy-shim 负控 | 否（N1/N3/N9 内部） |
| D-e | G5 实现 = ①BASE detached worktree 五步捕获 → 与 `public-surface.base.json` 严格比较；②再跑 `cordis-public-surface.test.ts`（当前树 vs 快照） | 双向闭合（快照真伪 + 当前面不漂移），比单侧更强 | 否 |
| D-f | `contract` suite 按 glob 动态收集（A-1 口径）；因此 N1/N2 在 contract 里**双跑**，base 阶段 contract 也红（红因=同一批目标用例） | 设计 A-1 明文「新文件被 contract 与各自专属 suite 双跑，幂等无害」 | 否 |
| D-g | `root-test` cell 红（32 failures，**BASE 上逐条复现**，0 新增） | 见 §8.1：28 个为环境 pnpm shim 错配（可用 PATH shim 修）、4 个为既有 `ws-replication-issue421-edge-factory-api.test-d.ts` 与 vitest 3.2.7 的 `expectTypeOf(...).parameters` 不兼容。修复前者需改环境、后者需改 ALLOW 外文件；**不降级、不 skip、不伪绿**，如实上报 | 否（未改任何 ALLOW 外文件） |

---

## 4. SA2 finding 落实

| Finding | 落实 | 结果 |
|---|---|---|
| **F1**（捕获形态，MAJOR） | M1/M2 骨架：两处均 `const rootTimer = tryResolveRootTimer(...)` 捕获对象引用，武装一律 `rootTimer.timeout(callback, delayMs)`；两处 doc comment 明文 ❌ detach + C15 理由；real-timer 三基线绿 = 运行时佐证 | ✅ code review 两处均方法调用形态、零 detach |
| **F2/RA-1①②③**（B1 门禁载体 + 锚点） | `ws-package` cell（B1 ws 内 4 fixture 逐文件实跑，66 tests）+ `root-test` cell（默认布局全量）作为执行载体；`contract`/`typecheck` cells 覆盖包面 | ✅ ws-package 绿；root-test 红但 100% pre-existing（见 §8.1） |
| **F3**（物化并集，MAJOR） | `run-baseline.mjs` NEW_FILES 常量（N1–N11）+ 逐条 `existsSync` 预检，缺失 → materialize exit 2 并打印清单；evidence 记 `filesPresent`/`allFilesPresent` | ✅ 红灯阶段每 cell `filesPresent: true`（见 §5） |
| F4 / B6（safeGet 判据 + read-throw 裁定） | `safeReadChannel` 单次 `Reflect.get` 包裹；malformed 在 catch 外断言；双通道皆拒 → 同一稳定文案；D10/D11 两用例 | ✅ D10 红→绿、D11 恒绿（pin） |
| F5（null host 守卫） | `tryResolveRootTimer` 首行 `host === null || typeof host !== 'object'` → 稳定 throw；`timer.ctx === undefined` 仍级联 | ✅ |
| F6/A-2（G5 捕获） | `gates.mjs` 五步：worktree list 预检 → `worktree add --detach` → base worktree 声明驱动 farm（`@nomicore/*` → base 兄弟包；其余 → 主仓 realpath）→ 逐 entry 捕获 → **finally** `worktree remove --force` | ✅ 可重复运行，残留 0 |
| F7（解析通道差异） | ws 内 vitest/tsc 命令**不携带** `NODE_OPTIONS=--conditions=nomicore-source`（`envForWorkspace` 显式删除）；root-test cell 命令逐字保留该 env | ✅ |
| F8（instrument 时机） | `TimerService.prototype.timeout` 在模块加载期（任何 `new TimerService` 之前）打补丁，meter 计 arms/pending（natural fire 与显式 disposer 都归零） | ✅ dispose 后 `pending = 0` 实测成立 |
| F9（legacy-shim 同一受控 ctx） | channel 测试从 env 读 fault 后，在该用例自建 ctx 上**同时**注入 legacy shim 并断言「B3 legacy 缺席」 | ✅ 负控实测判红（`expected { timeout: [Function] } to be undefined`） |
| F10（行号漂移） | 全设施以符号/命名字段锚定（`Symbol.for('cordis.root')`、package name、provenance 字段） | ✅ |
| **N-1**（AC6 suite 计数笔误） | 实现按规范文本 = **6 个基线 suites**（provenance/root-probe/contract/real-timer/dsh-profile/unload），`--all` 实际 21 个基线相关 cell + ws-package + gates + root-test = 24 cells | 已按意图处理，未回改设计 |
| **N-2**（root-test 环境前置） | 设计未写环境前置 → 实现把 `node` 版本与 `pnpm --version` 探针写入 root-test evidence `diagnostics`（诊断而非门禁）；补救路径见 §8.1 | 已记录 |
| **N-3**（synopsis `--baseline` 可选） | runner 中 `--baseline` 为可选：`--suite root-test` / `--all --matrix` 均不需要它 | 已按意图处理 |

---

## 5. TDD 证据

### 5.1 步③ 红灯矩阵（**BASE HEAD，seam 未实现**；SSOT = `.cache/cordis-baselines/evidence-base/**`，日志 `.cache/cordis-baselines/red-matrix.log`）

运行方式：在 `git worktree add --detach .worktrees/red-matrix 279dba4` 的 BASE 工作树内，把 N1–N11（未 tracked）复制进去后运行与绿阶段**完全相同**的 runner（物化机制 = working tree ∪ NEW_FILES，故被测内容 = BASE 源码 + 本票新测试）。每个 cell 均记录 `filesPresent: true`（11 条 NEW_FILES 全在物化后的 ws 内，`allFilesPresent=true`），**无任何 missing-file 红**。

| Cell | 命令 | 结果 | 红因（实测） | 目标原因? | filesPresent |
|---|---|---|---|---|---|
| B1 typecheck | `run-baseline.mjs --baseline B1 --mode typecheck` | **绿**（15/15） | — | — | true |
| B2 typecheck | 同上 B2 | **绿**（15/15） | — | — | true |
| B3 typecheck | 同上 B3 | **红**（7 project 非 0） | 13 个 `TS2576` 出现（12 个 distinct 位置）：`service.ts:54` ×1、`plugin.ts:214` ×2 读、4 fixture ×10 读 | ✅ D7 | true |
| provenance ×3 | `--suite provenance` | **绿**（4/4、4/4、8/8） | —（身份断言不依赖 seam） | ✅ D8 | true |
| root-probe B1/B2 | `--suite root-probe` | **红**（channel 6/12 失败；probe 本身 exit 0） | symbol 优先（arm 0 vs >0）、malformed symbol/legacy 不 throw（`<no throw>`）、双缺席不 throw、双通道皆拒不 throw、sentinel 用 symbol 通道时 `TypeError: Cannot read properties of undefined (reading 'timeout')` | ✅ D1/D2/D3/D10 | true |
| root-probe B3 | 同上 | **红**（7/12；probe exit 0） | 同上 6 条 + AC9 默认 options（B3 root ctx 上 `TypeError … reading 'timeout'`） | ✅ D1/D2/D3/D10 | true |
| contract B1/B2 | `--suite contract` | **红**（6/242） | 恰为上述 6 条 channel 用例（glob 双跑） | ✅ D1–D3/D10 | true |
| contract B3 | 同上 | **红**（18/246） | 6 channel + 10 real-timer + 1 AC9 + 既有 `file-persistence.test.ts > registers as a Cordis service…`（`service.ts:54` TypeError） | ✅ D1–D4 | true |
| real-timer B1/B2 | `--suite real-timer`（3 连跑） | **绿**（10/10 ×3） | — | ✅（D4 预期 B1/B2 绿） | true |
| real-timer B3 | 同上 | **红**（0/10） | 全部在首次 `saveDoc` reject（B3 root context `TypeError`/proxy Error） | ✅ D4 | true |
| dsh-profile B1/B2 | `--suite dsh-profile` | **绿**（12/12） | — | ✅ | true |
| dsh-profile B3 | 同上 | **红**（8/12） | profile 直 apply root ctx，flush 时 root 通道缺失 | ✅ D6 | true |
| unload B1/B2 | `--suite unload` | **绿**（6/6，含 `R5P.`） | — | ✅ | true |
| unload B3 | 同上 | **红**（5/6） | `R5P. persistence 卸载排空在途写…` 失败 | ✅ D5 | true |
| ws-package @B1 | `--baseline B1 --suite ws-package` | **绿**（4 文件 15/7/42/2） | — | ✅（R8 锚点） | true |
| gates（BASE） | `node gates.mjs` | **绿**（9/9） | — | ✅（BASE 无实现 diff 时全绿 = gate 不假红） | n/a |

红灯双记录（SA2 F3 纪律）：(i) materialize 的 NEW_FILES 逐条预检 + vitest 逐文件存在预检均通过（`filesPresent: true` / `allFilesPresent: true`，见每 cell JSON）；(ii) 失败断言/错误文本与设计 §14「目标原因」列比对一致（上表）。**无 missing-file 红被记账**。红灯证据另存 `evidence-base/red-matrix-summary.json`（含每 cell 失败测试名全表）。

### 5.2 步⑤ 绿矩阵（`node run-baseline.mjs --all --matrix`，日志 `.cache/cordis-baselines/green-matrix.log`，聚合 `.cache/cordis-baselines/evidence/matrix/matrix.json`）

| baseline | suite | status | exit | 关键计数 | 证据 |
|---|---|---|---|---|---|
| B1 | typecheck | pass | 0 | 15/15 projects（root `scripts.typecheck` 解析所得，禁子集） | `evidence/B1/B1-typecheck.json` + 15 条 project 日志 |
| B1 | provenance | pass | 0 | 4/4 tests；双位置 realpath 一致且在 overlay 内；恰 1 份 cordis | `evidence/B1/provenance.json` |
| B1 | root-probe | pass | 0 | 12/12 tests + probe exit 0（legacy 命中、symbol 缺席） | `evidence/B1/root-probe.json`、`B1/B1-root-probe.mjs.log` |
| B1 | contract | pass | 0 | 242/242 | `evidence/B1/contract.json` |
| B1 | real-timer | pass | 0 | 10/10 ×3（repeatRuns exit 0,0,0） | `evidence/B1/real-timer.json` |
| B1 | dsh-profile | pass | 0 | 12/12 | `evidence/B1/dsh-profile.json` |
| B1 | unload | pass | 0 | 6/6（`R5P.` present & passed） | `evidence/B1/unload.json` |
| B2 | typecheck | pass | 0 | 15/15 | `evidence/B2/B2-typecheck.json` |
| B2 | provenance/root-probe/contract/real-timer/dsh-profile/unload | pass | 0 | 4/4、12/12+probe0、242/242、10/10×3、12/12、6/6 | `evidence/B2/*.json` |
| B3 | typecheck | pass | 0 | 15/15，**0 个 TS2576** | `evidence/B3/B3-typecheck.json` |
| B3 | provenance | pass | 0 | 8/8（4 identity + 4 B3 clone/blob/output/recipe） | `evidence/B3/provenance.json` |
| B3 | root-probe | pass | 0 | 12/12 + probe exit 0（symbol 命中、legacy 缺席、`Context.root === Symbol.for('cordis.root')`、fiber legacy throws） | `evidence/B3/root-probe.json` |
| B3 | contract | pass | 0 | 246/246 | `evidence/B3/contract.json` |
| B3 | real-timer | pass | 0 | 10/10 ×3 | `evidence/B3/real-timer.json` |
| B3 | dsh-profile | pass | 0 | 12/12 | `evidence/B3/dsh-profile.json` |
| B3 | unload | pass | 0 | 6/6（`R5P.` 转绿） | `evidence/B3/unload.json` |
| B1 | **ws-package** | pass | 0 | 66/66（plugin 15 / issue299 7 / issue422 42 / guard-proxy 2），4 文件逐个存在预检 | `evidence/B1/ws-package.json` |
| default | **gates** | pass | 0 | 9/9（G1′、G2–G9） | `evidence/gates/gates.json` |
| default | **root-test** | **fail** | 1 | 5880/5912；32 failed | 矩阵运行时 `evidence/root-test/root-test.json`（现由 R-4 以同一 runner cell 重新生成，仍 fail、32 failed；原矩阵件归档 `root-test.matrix-run-2026-11-14T2311.json`）；pre-existing，见 §8.1/§9.5 R-4 |

聚合语义：`MATRIX FAIL: 1/24 cell(s) red`，绿不得抵销红（runner exit 1）。

---

## 6. 四负控 + G1′–G9 + 两个新 cell

### 6.1 四个负控（`--fault`，外层 exit 0 当且仅当内层 observed=fail）— **2026-11-14 23:38 以现行 runner 重跑（SA8 R-1 闭合）**

runner：`packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs`（重跑时 mtime `2026-11-14 23:37:47 +0800`、sha256 `6928b7407703ea4118fbe8bd66d9e67819cca839ae91279571b5826c66ba984b`；R-4 只给 root-test cell 追加 `testNames/failedTestNames` 字段，四条负控路径零改动）。外层日志：`.cache/cordis-baselines/evidence/negative-controls-r1.log`（四条均 `outer-exit=0`）；机读汇总：`.cache/cordis-baselines/evidence/negative-controls-r1.json`（含 sha256 / 失败断言名 / probe 观测）。

| 命令（逐字） | 证据（路径 + mtime + sha256） | `expected/observed/code/status` | 外层 exit | 判红的具体断言/观测（实测） |
|---|---|---|---|---|
| `node …/run-baseline.mjs --baseline B3 --suite provenance --suite root-probe --fault fallback` | `.cache/cordis-baselines/evidence/B3/fault-fallback.json`；23:38:40；`666df90cf6495fbb46d5237f185fa82429a8f625d735e137b8e9334c0050a260` | `fail / fail / 1 / pass` | 0 | provenance 2 例：①`工件身份：版本 + realpath 双位置一致… 基线 B3：两个解析位置指向同一 realpath，且在基线 overlay 内`（`@deepseek-ai/cordis resolved outside the B3 overlay: …/node_modules/.pnpm/@deepseek-ai+cordis@4.0.1/…`）；②`B3 provenance：… 实际使用的工件输出哈希与 provenance 一致…`（`lib tree hash drifted`）。root-probe 1 例：`基线通道形状（SA6 §12.3，root-probe suite） 基线通道精确命中期望形态…`，probe 观测错配：`rootCtxLegacy: expected absent, observed root-context`、`rootCtxSymbol: expected root-context, observed absent`、`contextRootStatic: expected symbol, observed absent`、`hitChannelTimeout: expected function, observed missing:undefined`、`fiberLegacy: expected absent-or-throw, observed root-context` |
| `node …/run-baseline.mjs --baseline B3 --suite provenance --suite root-probe --fault substitute-npm` | `.cache/cordis-baselines/evidence/B3/fault-substitute-npm.json`；23:38:44；`bf4201685c05e39bc391f15694a5e4176c6ad3f20cbf79b0f332de65ca4ca773` | `fail / fail / 1 / pass` | 0 | provenance 2 例（同名）：realpath 落 `overlay/B2/node_modules/@deepseek-ai/cordis`（**同名同版本 4.1.0 也判红**）+ `lib tree hash drifted`；root-probe 1 例：通道形状断言红（probe 错配五项同上） |
| `node …/run-baseline.mjs --baseline B2 --suite provenance --suite root-probe --fault substitute-rc12` | `.cache/cordis-baselines/evidence/B2/fault-substitute-rc12.json`；23:38:45；`92fc25f20313d0ce00e38f9056e34b3116a3404452253ef14ba3640adbf4ea4a` | `fail / fail / 1 / pass` | 0 | provenance 1 例：`工件身份：… 基线 B2：两个解析位置指向同一 realpath，且在基线 overlay 内`（realpath = `…/dsh/build/cordis`，落在 B2 overlay 之外）。root-probe cell 红于**模块装载失败**：probe 侧 `[root-probe] FAIL <load> Error: Cannot find module '@deepseek-ai/cosmokit'`，channel 测试侧 `Cannot find package '@deepseek-ai/cosmokit' imported from …/dsh/build/cordis/lib/events.js`。**更正原文**（旧文写「probe：B2 期望 legacy、实得 symbol 形态」，与磁盘证据不符：该 fault 的 root-probe 判红原因是替换后的 DSH 构建件无法装载，而非通道形状断言；设计 §8.7 要求的判红点在 provenance realpath 断言上成立）。成因核实：`.cache/cordis-baselines/dsh/build/` 有 `cordis/cosmokit/timer` 三个同级目录，但 `dsh/build/cordis` 下无 `node_modules` 链接，`cordis/lib/events.js` 的 `@deepseek-ai/cosmokit` 自替换点起无法解析（`MODULE_NOT_FOUND`）——属负控工件形态，不是 seam 缺陷，本轮未改 runner/fixture（负控外层语义 `observed=fail` 与 provenance 判红点均成立） |
| `node …/run-baseline.mjs --baseline B3 --suite root-probe --fault legacy-shim`（F9 同受控 ctx） | `.cache/cordis-baselines/evidence/B3/fault-legacy-shim.json`；23:38:48；`13445277f61801ec882defa14afbb8367f6d2d3c4e9dccb1934588b01a15067f` | `fail / fail / 1 / pass` | 0 | root-probe/channel 1 例：`基线通道形状（SA6 §12.3，root-probe suite） 基线通道精确命中期望形态…` → `AssertionError: expected { timeout: [Function timeout] } to be undefined`（在自建受控 ctx 注入 legacy `root` 后，「B3 legacy 缺席」形状断言必红）；probe 本体 `ok:true`（`failures: []`，不受 shim 影响）；channel 测试 12 例中仅该形状断言 1 例红、其余 11 例绿（shim 只作用于该用例自建的受控 ctx） |

四枚 JSON 均由**现行 runner 同批生成**（23:38:40–23:38:48），内容均为 `{expected:'fail', observed:'fail', code:1}` 且 `status:'pass'`，外层 exit 全 0 —— SA8 §5 的「三枚缺失/由旧版 runner 生成」缺口就此闭合；旧文所引证据指针与实际磁盘内容不一致处已按实测改写。

### 6.2 G1′–G9（`node packages/persistence/test/fixtures/cordis-baselines/gates.mjs`，独立重跑 exit 0）

| Gate | 实测结果 |
|---|---|
| G1′ | PASS：19 条 pathspec（`pnpm-lock.yaml` + 根/14 packages/1 app/1 domain 的 package.json + `artifacts`）零 diff |
| G2 | PASS：changed = `[packages/persistence/src/service.ts]` ⊆ allowlist |
| G3 | PASS：changed = `[src/plugin.ts, 4 具名 fixture]` ⊆ allowlist |
| G4 | PASS：两 `src/index.ts` 零 diff |
| G5 | PASS：BASE 五步捕获的 4 entry 导出名集合与 `public-surface.base.json` 严格相等 **且** 当前树 runtime 测试通过 |
| G6 | PASS：`git diff --check` 干净；`git status --porcelain artifacts/` 空 |
| G7 | PASS：`docs/`（含 `docs/adr/`）零 diff |
| G8 | PASS：三生产 src 树对 `process.env|CORDIS_BASELINE|ROOT_CHANNEL|rc.12` 零命中 |
| G9 | PASS：`tsconfig.base.json`/`tsconfig.typecheck.json`/`vitest.config.ts`/各包 tsconfig（19 条 pathspec）零 diff |

### 6.3 两个新 cell 的实际结果

- **`ws-package`（B1 专属）**：`pass`，4 文件逐文件实跑 + `--passWithNoTests=false` + 存在预检：`ws-replication-plugin` 15、`issue299-ac-red` 7、`issue422-listen-false` 42、`guard-proxy-consumption` 2 = **66 tests 全绿**（R8「guard-Proxy B1 必绿」锚点成立）。
- **`root-test`（默认布局，基线无关）**：`fail`（exit 1；5880/5912）。命令 = `NODE_OPTIONS=--conditions=nomicore-source node <repo>/node_modules/vitest/vitest.mjs run --typecheck`（与根 `scripts.test` 等价，逐字保留 env）。失败清单与 BASE 完全相同的证据见 §8.1。

### 6.4 A′-1 advisory 落实（G5 capture 的 `@nomicore/*` resolve 载体）

`gates.mjs` 的 BASE worktree farm 按 §8.4 步 2 机制**为全部 16 个 workspace 包**建链：`@nomicore/*` → base worktree 内兄弟包目录；`@deepseek-ai/*`/外部依赖 → 主仓对应包 realpath 解析后 symlink（base worktree 自身无 node_modules，A-2 缺口由此关闭）；base worktree 的 `@nomicore/*` 经 `NODE_OPTIONS=--conditions=nomicore-source` + export 条件直载自身 `src/`。捕获结果 16 packages / 109 links，4 entry 导出名与 N7 快照逐项相等。**「不需链接至主仓安装」按 advisory 理解为「不需要（也不可能）链接主仓的 @nomicore 安装」**，表述歧义已在实现中消除。

---

## 7. B3 provenance 8 项实际记录值

1. **commit 钉死**：`1511a6ed442c207919142a4b0e6c4916f96d2c3b`；每次 acquire `git rev-parse HEAD` 精确相等且 `git status --porcelain` 为空（provenance 测试每次 B3 cell 重跑该断言）。
2. **source blob 绑定**：`git ls-tree -r <sha> -- vendor/{cordis,timer,cosmokit}` **32 条 blob 全表**记录于 `provenance-b3.json`（`sourceBlobs`），每次运行逐文件比对；四个交叉校验锚与 SA6 附录 A 逐字相同：`context.ts=951a0ddae440787d15798144370bf57508c390d3`、`utils.ts=4337b9d6c213ef90f47b982675e92302ba117f9a`、`timer/src/index.ts=8d133e5c7ffab583e4612d51217d203b7913de72`、`cosmokit/src/types.ts=0aab4420c16776750ae4c5891ec3d6c3a1a8231b`。
3. **构建配方/toolchain**：`node v24.13.0` + `typescript 5.9.3`（仓库 `node_modules/typescript/bin/tsc`）；逐包 tsconfig 记录 `rootDir: src`、`outDir: lib`、`declaration: true`、`declarationDir: lib/types`、`allowImportingTsExtensions`、`rewriteRelativeImportExtensions`、`module/moduleResolution/target`、`paths`（依赖类型指向已构建的 lib/types，`@standard-schema/spec` 指向钉值 tarball）；三包按 cosmokit → cordis → timer 顺序构建，`noEmitOnError`。
4. **输出哈希**（每次 acquire 重算并与 provenance 比对，任一不符 exit 2）：
   - cosmokit：libTree `af9297c4b1eae626f12d02bb5ce267fc5a7bc25aa25d5ef92768340fd0721b55`，lib/index.js `79fdda55…5d6d69`，types `731fdb0b…a068a4b`
   - cordis：libTree `9bb7ac59…7d807c8e330`，lib/index.js `dbc5668c…f8e07cd3a9f57551`，types `95824988…33d58862`
   - timer：libTree `c43884d0…bafb0731`，lib/index.js `c450ed6c…7310d313e9c5ed`，types `a0cbbaa9…b9c1ac64579487`
   - 三包 `lib/index.js` 哈希与 SA6 附录 A 的 rc.12 最小构建示例**逐字节一致**（独立复现）。
5. **双位置解析断言**：从 test 模块位置与 `packages/persistence/src/service.ts` 目录位置解析 `cordis`/`timer` → realpath 相同；三者（含 cosmokit 从 cordis/timer 位置解析）均在 `NOMICORE_CORDIS_BASELINE_ROOT` 内；workspace 内声明的 `@deepseek-ai/cordis` realpath 集合恰 1 个。B3 evidence 的 `resolvedRealpaths` = `.cache/cordis-baselines/overlay/B3/node_modules/@deepseek-ai/{cordis,cordis-plugin-timer,cosmokit}`，`provenanceDigest=112f0db0bf58a75ff786a9c5d008fa91b6c5e0c547ff925b96902070fdc7e9ab`。
6. **运行时通道探针**（独立 `root-probe.mjs`，只 import baseline Context/TimerService）：B3 = `rootCtxSymbol: root-context`、`rootCtxLegacy: absent`、`contextRootStatic: symbol`、`hitChannelTimeout: function`、fiber legacy `throws: cannot get property "root" without inject`；B1/B2 = legacy 命中、symbol 缺席、`Context.root` 静态缺席、fiber legacy 继承 root。三次运行 `probe.exitCode = 0`。
7. **负控实跑**：四条命令全部 `{expected:'fail', observed:'fail', code:1, status:'pass'}`、外层 exit 0（2026-11-14 23:38 以现行 runner 重跑；四枚证据 mtime 23:38:40 / 23:38:44 / 23:38:45 / 23:38:48，sha256 见 §6.1）。
8. **诚实标注**：`buildRecipe.honestyNote` 明记「minimal tsc source-build, NOT the official DSH `tsc -b` + tsdown pipeline」；版本元数据只作辅助（provenance 不含任何「版本号证明形态」的断言）。

---

## 8. 已知残留/风险（不得当作已验证）

### 8.1 `root-test` cell 红：32 failures，**BASE 279dba4 等量复现，0 新增**（**第一手证据已持久化**，SA8 R-2 闭合）

**取证方式（诚实标注）**：`git worktree add --detach .worktrees/base-snapshot 279dba4` + 同款声明驱动 farm（`.cache/cordis-baselines/base-farm.mjs`：16 packages / 109 links；`@nomicore/*` → base worktree 兄弟包，其余依赖 → 主仓 realpath）。因全量单跑成本高，BASE 侧按**文件族**分 4 条 vitest 命令复跑（**逐族复跑，非单次全量**；覆盖绿矩阵 root-test 的全部 9 个失败文件），命令模板：

```
cd .worktrees/base-snapshot && NODE_OPTIONS=--conditions=nomicore-source \
  node node_modules/vitest/vitest.mjs run --typecheck \
  --reporter=default --reporter=json --outputFile.json=<证据>/<family>.vitest.json <files…>
```

证据目录 `.cache/cordis-baselines/evidence-base/base-repro/`：4× `<family>.log` + 4× `<family>.vitest.json` + `base-repro-run.log`（含每条命令与真实 exit code）；汇总 `base-root-test-repro-summary.json`（worktree HEAD、farm、node/tsc/vitest 版本、命令模板、逐文件 failed/passed、与绿矩阵逐文件比对、`coverageMode: per-family rerun`）。

| 文件族（覆盖的 9 个失败文件） | BASE 逐族计数（failed/passed/total，exit） | 与矩阵 root-test 逐文件比对 | 归因 |
|---|---|---|---|
| dsh-persistence：`dsh-probe-cli`（6）+ `dsh-file-probe-determinism`（1） | 7 / 2 / 9，exit 1 | 相等（7/2） | **环境**：子进程 `pnpm` = corepack 11.28.5，违反仓库 `packageManager: pnpm@10.28.2` 声明 → 子进程 exit 1 |
| `vfsl/test/schema-check-cli`（spawn `pnpm schema:check`） | 6 / 0 / 6，exit 1 | 相等（6/0） | 同上 |
| `vfsl-codegen/test/generate-*`（5 文件，spawn `pnpm generate`） | 15 / 46 / 61，exit 1 | 相等（15/46） | 同上 |
| `ws-replication-issue421-edge-factory-api.test-d.ts` | 4 / 4 / 8，exit 1 | 相等（4/4） | **既有**：`expectTypeOf(...).parameters.toEqualTypeOf<[可选参数元组]>()` 与 vitest 3.2.7 / expect-type@1.4.0 不兼容（`Expected 1 arguments, but got 0`；文件本票零改动、不在 ALLOW） |
| **合计** | **32 / 52 / 84** | **9/9 文件逐项相等（`allEqual: true`）** | **0 新增** |

BASE 失败断言文本与绿矩阵同文件逐条一致（`expected 1 to be +0`、`expected '[ERROR] This project is configured to…' to match /rootDir/`、`expected '[ERROR] This project is configured to…' to contain 'VFSL-E311'`、`Expected 1 arguments, but got 0.` 等；完整原文在各 `<family>.log`）。取证前后 BASE worktree `git status --porcelain` 为空；取证用毕已 `git worktree remove`（`git worktree list` 无残留，`.worktrees/` 空）。

**28 例环境归因的补齐证据**（SA8 §4.2(b)-1/(c)-4）：在尊重仓库 `packageManager` 声明的环境（PATH 局部 `.cache/cordis-baselines/pnpm-shim-10.28.2/pnpm` = `exec corepack pnpm@10.28.2 "$@"`，仅本证据步骤的子进程环境）复跑**单次完整全量** root-test = **5912 total / 5908 passed / 4 failed**，8 个环境归因文件 **76/76 全绿、0 failed**，4 例 test-d 不受影响 —— 证据 `evidence/root-test/root-test-pnpm10282.json` + `.log` + `.vitest.json`（详见 §9.5 R-3）。

本 SA3 **未**修改 runner 的 root-test 命令、**未**把 pnpm shim 固化进 runner/交付链路、**未** skip/降级该 cell —— 矩阵 cell 保持红（exit 1）并由 Controller/SA10 裁决交付影响；对齐环境复跑属验收现场动作（证据并存，未覆盖矩阵证据）。

### 8.2 其他边界

- **本票不宣称 Replication rc.12 行为兼容**（R3/I6）：ws-replication 交付 = 编译面（3 基线 15-project 绿）+ seam 语义（channel sentinel/形状）+ B1 包门禁四件套（focused tests=66、包/根 typecheck、根 test 见 §8.1）。三基线 Hub/Peer/SessionHost 行为矩阵、`apps/yjs-server` 行为验收不在本票（其 typecheck project 已覆盖）。
- **B3 为最小 tsc source-build**，非 DSH 官方 `tsc -b`+tsdown；按 Q4 裁决 + provenance 诚实标注接受；若 owner 另要求官方流水线等价性，属新要求。
- **File retry 依赖 POSIX rename 语义**（本机 Linux 实测通过）；非 POSIX 平台该 cell 会响亮失败（不 skip），evidence 会记录平台。
- **同名工件替换**只由 realpath 包含性 + 输出哈希 + ls-tree blob 全表区分（timer/cosmokit 源码与 npm 逐字节相同，SA6 §9.3），四个负控实测判红。
- **memory/file 注释仍写 `ctx.timeout`**（G20 失实注释）按设计 §18 残余不修（AC7 byte-identical 冻结）。
- **ADR 0035 状态未更新**（仍「提议」）：按 SA6 §17.8 / §18 归实施收官票，本票零 `docs/**` diff（G7 机械证明）。

### 8.3 设计 §21 OPEN 项实际状态

| OPEN | 状态 |
|---|---|
| 1. 实际 diff 面复查（M1–M6 守住 §11.1/G2/G3/G9） | ✅ 机械面已核（G2/G3/G9 绿 + diffstat 恰 6 文件）；语义面已由 **SA4 approve（0 BLOCKER/0 MAJOR）** 与 **SA8 实现级复查 §3（seam/迁移/gates/冻结面全项持守）** 复核；本轮仅按 SA8 证据面 required actions 补齐（§9.5） |
| 2. `gates.mjs` 首落地执行核对（含 G5 五步可行性） | ✅ 首次真实运行通过（9/9），G5 捕获可重复、finally 清理无残留；A′-1 歧义已消除 |
| 3. A-3（若改走私有 seam 文件形态） | ✅ 未触发：维持 in-file 收口（`service.ts` / `plugin.ts`），G3 allowlist 未扩展 |
| 4. 红灯证据落证（F3 acceptance） | ✅ 在 BASE worktree（未实现 seam）逐 cell 双记录，`filesPresent=true`，无 missing-file 红；D5/D6 的 B2「预期绿」由首跑确证（本报告 §5.1） |
| 5. B1/F1 实现核对（两处均方法调用、零 detach） | ✅ 两处均 `rootTimer.timeout(callback, delayMs)`（§3.1）+ real-timer 三基线绿为运行时佐证 |
| 6. F8 instrument 时机 | ✅ 选择「模块加载期 patch `TimerService.prototype.timeout`」（早于任何构造/provide），meter 以 arm/自然到期/显式 disposer 三路归零 |
| 7. SA8 实现级复查证据面 required actions（R-1–R-5） | ✅ 全部闭合：R-1 四负控证据齐备（§6.1）、R-2 BASE 等量复现落盘（§8.1）、R-3 对齐环境全量复跑（§9.5）、R-4 证据契约字段（§9.5）、R-5 死代码清理（§9.5） |

---

## 9. Verification（命令与真实结果）

| # | 命令 | 结果 |
|---|---|---|
| 1 | `node packages/persistence/test/fixtures/cordis-baselines/acquire.mjs --baseline B1 --baseline B2` | exit 0；tarball sha512 逐一匹配钉值 |
| 2 | `node …/acquire.mjs --baseline B3 --write-provenance`（随后默认模式复核） | exit 0；clone clean、32 blobs、3 包输出哈希与 provenance 一致 |
| 3 | `node …/root-probe.mjs --resolve-from .cache/…/overlay/B{1,2,3} --baseline B{1,2,3}` | 三次 exit 0，观测值与 SA6 §12.3 表逐项一致 |
| 4 | 红灯矩阵（BASE worktree，§5.1） | 23 cells（21 基线相关 + ws-package + gates）：**13 绿 / 10 红**；10 红归为 4 个目标族：D7（typecheck@B3）、D1–D3/D10（root-probe×3 + contract×3 的双跑）、D4/D6/D5（real-timer/dsh-profile/unload @B3）——与 D1–D11 预期逐条吻合 |
| 5 | `node …/run-baseline.mjs --all --matrix` | exit 1：23/24 cell 绿，仅 `root-test` 红（pre-existing，§8.1） |
| 6 | 四负控（§6.1） | 4× `{expected:'fail', observed:'fail', code:1}`，外层 exit 0 |
| 7 | `node …/gates.mjs` | exit 0，9/9 PASS |
| 8 | `node node_modules/typescript/bin/tsc -p packages/persistence/tsconfig.json` / `…/ws-replication/tsconfig.json`（仓库布局） | 均 exit 0 |
| 9 | `NODE_OPTIONS=--conditions=nomicore-source node node_modules/vitest/vitest.mjs run <4 新测试 + 4 迁移 fixture + unload + dsh-profile>` | 10 files / **115 tests 全绿**（channel 12 + real-timer 10 + provenance 4 + public-surface 5 + 4 fixture 66 + unload 6 + dsh-profile 12），`Type Errors: no errors` |
| 10 | **R-1**：四条 `--fault` 负控（§6.1 命令逐字；2026-11-14 23:38） | 4× 外层 exit 0；4× `{expected:'fail', observed:'fail', code:1, status:'pass'}`；证据 mtime 23:38:40 / 44 / 45 / 48（sha256 见 §6.1 与 `evidence/negative-controls-r1.json`） |
| 11 | **R-2**：BASE `279dba4` + 同款 farm **逐族复跑**（4 条 vitest，覆盖 9 个失败文件；非单次全量） | **32 failed / 52 passed / 84 total**；9/9 文件与矩阵 root-test 逐项相等；汇总 `evidence-base/base-repro/base-root-test-repro-summary.json` |
| 12 | **R-3**：packageManager 对齐（PATH 前缀 `…/pnpm-shim-10.28.2`，实测 `pnpm --version`=10.28.2）**单次完整全量** root-test | exit 1；**5912 total / 5908 passed / 4 failed**；8 个环境归因文件 76/76 绿；证据 `evidence/root-test/root-test-pnpm10282.{json,log,vitest.json}` |
| 13 | **R-4**：`node …/run-baseline.mjs --suite root-test`（runner 已补记 `testNames/failedTestNames`） | exit 1（**仍红**）；counts 5880/5912/32；`testNames=5912`、`failedTestNames=32`；原矩阵件归档 `evidence/root-test/root-test.matrix-run-2026-11-14T2311.*` |
| 14 | **R-5**：`node …/run-baseline.mjs --baseline B1 --suite ws-package`（guard-proxy 死代码删除后） | exit 0；**66/66**（15/7/42/2）；日志 `.cache/cordis-baselines/evidence/r5-ws-package.log` |
| 15 | `node …/gates.mjs`（R-5 后独立重跑） | exit 0，**9/9 PASS**；`git worktree list` 仅主仓与本 worktree（无残留） |
| 16 | `node node_modules/typescript/bin/tsc -p packages/ws-replication/tsconfig.json` 与 `…/packages/persistence/tsconfig.json`（终态复跑） | 均 exit 0 |

---

## 9.5 SA8 实现级复查闭合（iteration 1：证据面；实现面零语义改动）

SA8 实现级复查（`wiki/raw/task_issue-470_impl_conflict_report.md`，verdict=reject）**只针对证据面**（其 §3/§6/§7 已确认 seam/迁移/gates/冻结面全部持守、无 hard-conflict）。本轮逐条闭合其 required actions；**未改 seam 行为、未改 4 个 fixture 的断言面、未改 gates 决策、未改任何 ALLOW 外 tracked 文件**。

### R-1 负控证据补齐（阻塞项）→ **已闭合**

- 命令 = dispatch 四条逐字（见 §6.1 表格第一列）；执行时间 2026-11-14 23:38:37–23:38:48（+0800）。
- 外层日志 `.cache/cordis-baselines/evidence/negative-controls-r1.log`（四条均 `outer-exit=0`）；机读汇总 `.cache/cordis-baselines/evidence/negative-controls-r1.json`（含 runner sha256、四枚证据 sha256/mtime、失败断言名、probe 观测）。
- 四枚证据（**现行 runner 同批生成**）：`evidence/B3/fault-fallback.json`（23:38:40，`666df90c…`）、`evidence/B3/fault-substitute-npm.json`（23:38:44，`bf42016…`）、`evidence/B2/fault-substitute-rc12.json`（23:38:45，`92fc25f…`）、`evidence/B3/fault-legacy-shim.json`（23:38:48，`1344527…`）；全部 `{expected:'fail', observed:'fail', code:1, status:'pass'}`，外层 exit 0。
- 判红断言名逐条见 §6.1。**已更正**旧文与磁盘证据不符的声称：`substitute-rc12` 的 root-probe cell 判红于模块装载失败（`Cannot find module '@deepseek-ai/cosmokit'`），不是「B2 期望 legacy、实得 symbol 形态」；provenance 的 realpath 断言仍为设计 §8.7 要求的判红点。

### R-2 BASE 等量复现证据落盘（阻塞项）→ **已闭合**

- 证据目录 `.cache/cordis-baselines/evidence-base/base-repro/`；汇总 `base-root-test-repro-summary.json`（含 worktree HEAD、farm、node/tsc/vitest 版本、命令模板、exit code、逐文件计数）。
- BASE = `279dba4ac81b7c7520e3d0b87b5c4d621a86a517`；farm 16 packages / 109 links。
- 逐族计数：dsh-persistence **7/2/9**、vfsl schema-check **6/0/6**、vfsl-codegen **15/46/61**、issue421 test-d **4/4/8** → 合计 **32 failed / 52 passed / 84 total**；与绿矩阵 root-test 的 9 个失败文件**逐项相等**（`allEqual: true`）。
- 覆盖方式已在证据中标注：**逐族复跑（4 条命令），非单次全量**。执行时间 2026-11-14 23:37:32–23:38:21（+0800）；四条 log 的 mtime 依次 23:38:08 / 23:38:11 / 23:38:19 / 23:38:21，真实 exit code 均为 1（`base-repro-run.log`）。取证后已删除 BASE worktree（`git worktree list` 无残留）。

### R-3 packageManager 对齐环境 root-test 复跑（阻塞项）→ **已闭合**

- 环境：PATH 局部目录 `.cache/cordis-baselines/pnpm-shim-10.28.2/`（`pnpm` = `#!/bin/sh` + `exec corepack pnpm@10.28.2 "$@"`；实测 `pnpm --version` = `10.28.2`）；shim **未**进入 runner、未进仓库、未固化进交付链路。
- 命令：设计 §8.6 root-test 命令逐字（`NODE_OPTIONS=--conditions=nomicore-source node node_modules/vitest/vitest.mjs run --typecheck`，cwd = 仓库根），仅追加与矩阵 cell 相同的 JSON 输出捕获 flags（不改测试选择、不改 env、无 skip/过滤/降级）。
- 结果（**单次完整全量**，486 test files）：**5912 total / 5908 passed / 4 failed**，exit 1；唯一红文件 = 既有 `ws-replication-issue421-edge-factory-api.test-d.ts`（4 例）。
- 「28 例转绿」逐族核对：8 个环境归因文件 **76/76 passed、0 failed**（dsh-persistence 9/9、vfsl schema-check 6/6、vfsl-codegen 61/61）；4 例 test-d 不受 shim 影响。
- 证据：`evidence/root-test/root-test-pnpm10282.json`（计数/失败名/逐文件 before-after/环境/命令/仓库洁净性）+ `root-test-pnpm10282.log` + `root-test-pnpm10282.vitest.json`；与矩阵证据**并存**（未覆盖 `root-test.json`）。时间戳：命令启动 **23:38:55**，结束 **23:45:51**（+0800；log mtime 23:45:51、summary JSON 23:46，`Duration 415.52s`）。
- 仓库洁净性：运行前后 `git status --porcelain -uall` 逐字节一致（成功执行的 `pnpm generate` 写盘为字节等价；`evidence/root-test/pre-r3-git-status.txt` 与 `post-r3-git-status.txt` sha256 相同）。

### R-4 证据契约字段（非阻塞）→ **已闭合**

- `run-baseline.mjs` 的 `runRootTestCell` 追加：从 vitest JSON 读取并写入 `testNames`（5912 条）与 `failedTestNames`（32 条，附加字段）；**§8.6 命令、cell 选择、聚合语义（任一红 ⇒ exit 1、绿不抵红）零变化**。
- 以该 runner 重新生成矩阵 cell 证据：`node …/run-baseline.mjs --suite root-test` → exit 1（**仍红**；执行时间 23:46:17–23:53:01 +0800），`root-test.json`（23:53；counts 5880/5912/32；`testNames=5912`；`failedTestNames=32`）。原矩阵运行件归档为 `evidence/root-test/root-test.matrix-run-2026-11-14T2311.{json,log,vitest.json}` 以并存核对（R-3 的 `root-test-pnpm10282.json` 中 `coexistence.matrixEvidence` 指的是 R-3 执行当时的矩阵件 `root-test.json`；该原件此后按本 R-4 步骤归档为上述文件名，同一失败集不变，仅补齐契约字段）。
- **不得**据此声称「根 test 全绿」：该 cell 状态仍为 `fail`/exit 1。

### R-5 死代码清理（非阻塞）→ **已闭合**

- 删除 `packages/ws-replication/test/ws-replication-guard-proxy-consumption.test.ts` 中未被使用的 `resolveRootForTest`（该 helper 仅由本票 diff 引入；删除后相对 BASE 的净 diff 仅剩 `dependencies()` 迁移，guard-Proxy 断言面原样）。
- `--baseline B1 --suite ws-package` 复跑：**66/66 全绿，exit 0**（plugin 15 / issue299 7 / issue422 42 / guard-proxy 2；证据 `evidence/B1/ws-package.json`，日志 `evidence/r5-ws-package.log`，执行时间 23:53:15–23:53:21 +0800）。
- 注：`ws-replication-issue299-ac-red.test.ts` 的同名 helper 亦未被使用（SA4 O4），但本轮 dispatch 的清理范围仅限 guard-proxy，故未触碰并留待后续票。

### 本轮 tracked 文件改动（2 个，均在 ALLOW 内；无新增/删除 tracked 路径）

| Path | ALLOW 承载 | 改动 |
|---|---|---|
| `packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs` | N9（§11.1） | R-4：root-test cell 补记 `testNames/failedTestNames`（命令/聚合语义不变） |
| `packages/ws-replication/test/ws-replication-guard-proxy-consumption.test.ts` | M6（§11.1） | R-5：删除未使用 helper（净 diff 仅 `dependencies()` 迁移） |

`.cache/cordis-baselines/**` 证据为 gitignored；`.worktrees/base-snapshot` 用毕已删；未执行 `git add/commit/push`，未写 marker。

### 交付叙述约束（SA8 §4.2(c) 七条，**原样**纳入，供 SA9/SA10 逐条核销）

1. **不得声称**「根 test 全绿」「默认布局全量测试通过」「既有测试全绿」或任何等价表述。
2. 必须写明：`root-test` cell 红 = **32 = 28 环境 + 4 既有**；28 = 环境 pnpm（corepack 11.28.5）违反仓库 `packageManager: pnpm@10.28.2` 声明所致子进程失败（`pnpm --version` 独立 exit 1）；4 = 既有 `ws-replication-issue421-edge-factory-api.test-d.ts` 的可选参数元组断言与 expect-type@1.4.0（vitest 3.2.7）不兼容。
3. 必须提供 **BASE 等量复现证据**（两族逐条；本报告 §4.1 的独立复现可引，SA10 交付现场应留存同等工件——SA3 原始 BASE 复现未落盘，见 §5）。
4. 必须写明 shim 实验：28 例在补齐声明版本后转绿（抽检 3 文件 15 例全绿，本会话复现）；4 例不受 shim 影响。
5. 必须在 work records/交付摘要**显式标注**：该 cell 触发设计 §17-3 交付阻断语义，带红交付系经 owner 裁定（或环境复跑 + owner 对 4 例既有红的接受）；4 例既有红的修复另立后续票（文件在 G3 allowlist 外）。
6. AC6 表述限定：AC6 点名族全绿可以声称；涉及「现有 DSH 相关测试」的任何总括表述必须带环境限定。
7. 复跑留证：交付现场在 packageManager 对齐环境下重跑 root-test 的完整证据（预期 5908/5912，余 4 既有红）应与矩阵证据并存，不得以复跑结果覆盖原证据。

> 条目 3/4 中的「本报告 §4.1」「抽检 3 文件 15 例」等指 SA8 报告当时的证据；本轮已按 3/4/7 补落更强证据：**R-2** = BASE 全 9 文件逐族等量复现；**R-3** = 对齐环境**单次完整全量**（8 个环境文件 76/76 绿，非抽检）；对齐复跑证据与矩阵证据并存（未覆盖）。第 5/6 条为 SA9/SA10 交付叙述的绑定约束；第 1 条为本报告与后续交付摘要的禁止项——**本报告任何位置均不声称「根 test 全绿 / 默认布局全量通过 / 既有测试全绿」**。

---

### 9.6 SA10 M2 闭合（iteration 2：AC3(c) 持久化结果断言）

SA10 最终 spec-review（`wiki/raw/task_issue-470_sa10_spec.md` §1「必须修项」**M2**、§2 AC3 核销段、§6 I-7 边界）判定 SA6 §12.2 AC3 的 **(c)「随后 flush 在 deadline 内提交最新 snapshot」**没有任何直接断言或证据（既有 R5P 只证明 dirty notification、`fatal=null`、事件序与零 unhandled）。本轮在**既有 ALLOW 清单内**（§11.1 N2）新增一条可证伪的持久化结果断言；**未触碰** `packages/namespace-registry/test/**`（SA10 明示：若需改 Registry 测试必须先修订并复审设计范围，本轮 dispatch 不批准该路径——故按 dispatch 要求走 persistence 侧等价场景），**未改 seam 行为**（`service.ts`/`plugin.ts` 零 diff；新断言未暴露 seam 缺陷），**未新增文件**。

#### 9.6.1 断言位置与测试名

- 文件：`packages/persistence/test/cordis-root-real-timer.test.ts`（§11.1 N2），新增顶层 describe `AC3(c) UNLOADING 窗口 × 真实 Timer（三基线）`。
- 测试名（runner 证据 `testNames` 逐字）：`AC3(c) UNLOADING 窗口 × 真实 Timer（三基线） dependent 排空窗口内已接纳写在真实 Timer 上提交最新 generation；adapter dispose 严格晚于该提交；零 unhandled`。

#### 9.6.2 场景（persistence 侧 R5P 等价构造）

1. **真实 Timer**：`createContext()` = `createSystemClockPlugin().apply(ctx)` + `new TimerService(ctx)`；`TimerService.prototype.timeout` 在**任何构造之前** instrument（meter 计 arm/pending）——**无 fake scheduler、无 fake timer**。
2. **`ctx.plugin(...)` 形态的 persistence fiber**：`ctx.plugin(createMemoryPersistencePlugin({ schedule: { debounceMs: 10, maxDirtyMs: 40, retryDelayMs: 10 }, writeSnapshot }))`，store hook 记录写入的 snapshot（key = `userId\u0000docId`）。
3. **dependent plugin/fiber 承载被 gate 的 `saveDoc`**：`ctx.plugin({inject: ['nomicorePersistence'], apply(ctx){...}})`——经 `inject` 消费 persistence service；`open(1)` 用注入的 service `createDoc` 建立 live doc + 初始 committed snapshot（generation 1）；`write(2)` = dependent 的已接纳写路径（`adapter.saveDoc`）。其卸载 effect 先 `await` 在途写、再 await 测试锚定的 drain barrier（窗口只由 dependent 自身 settle 决定，与 R5P 用 pending `shutdown` 拉开窗口同构）。
4. **写槽 gate**（R5P 的 S6 锚点，persistence 侧）：包装 `adapter.saveDoc`——首次进入即挂起，直到测试放行。
5. **`persistenceFiber.dispose()`**：服务撤销 → dependent fiber 级联卸载 → drainStep 等待依赖 settle ⇒ persistence fiber 停在 `UNLOADING`、`adapter.dispose` 未发生、服务已不在 store。
6. **放行前窗口断言**：fiber `state === 5 (UNLOADING)`、`ctx.get('nomicorePersistence') === undefined`、dependent fiber 也 `UNLOADING` 且卸载已开始、adapter dispose 事件为空、`writeSettled === false`、store 仍是 generation 1。
7. **放行 gate**：`await expect(writePromise).resolves.toBeUndefined()` ⇒ 已接纳写在 UNLOADING 窗口内仍完成 dirty notification（AC3(b) 的 persistence 侧等价：不再是 B3 base 的 reject）。
8. **deadline 谓词轮询**（`DEADLINE_MS = 5000`、5ms 间隔；**无固定轮数、无 sleep 猜**）等待 store 解码为 generation 2；随后断言 `meter.arms` 增量 > 0（真实 `TimerService` 武装了 flush；ambient timer 不会计入 meter）、fiber 仍 `UNLOADING`、adapter dispose 事件仍为空。
9. **释放 dependent drain barrier** → `adapter-dispose-start`/`adapter-dispose-complete` 严格晚于 `snapshot-committed`（事件序断言，AC3(d)/(f) 的 persistence 侧等价）；`adapter.getStatus() === 'disposed'`；`ctx.get(...) === undefined`；**零 unhandled rejection**（AC3(e)）。
- **不强制 flush**：测试不调用 `adapter.drain()`/flush、不直接写 store；窗口内唯一提交通道是 `saveDoc` 的 dirty notification 所武装的 debounce timer。drain barrier 只决定 dependent **何时** settle（窗口长度），不改变「窗口内必须提交最新 generation」这一判据——否则 BASE B3 不会在该点判红。

#### 9.6.3 三基线绿（fixed tree：`473f83e` + 本轮 N2 修改）

| baseline | real-timer（含新断言；`--repeat 3` = 3 次顺序运行） | contract（persistence 目录 glob 双跑，含新断言） | unload（R5P，源文件零改动） | 证据 |
|---|---|---|---|---|
| B1 | pass **11/11 ×3**（三次 exit 0） | pass **243/243** | pass **6/6**，`r5p.present=true, r5p.passed=true` | `.cache/cordis-baselines/evidence/B1/{real-timer,contract,unload}.json` |
| B2 | pass **11/11 ×3** | pass **243/243** | pass **6/6** 同上 | `.cache/cordis-baselines/evidence/B2/{...}.json` |
| B3 | pass **11/11 ×3** | pass **247/247** | pass **6/6** 同上 | `.cache/cordis-baselines/evidence/B3/{...}.json` |

- 命令（§8.6 命令与聚合语义**零变化**，runner 未修改）：`node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs --baseline <B1|B2|B3> --suite <contract|real-timer|unload>`；新测试自动进入 real-timer suite（11 例）与 contract glob 的 `testNames`/计数（原 10/242/242/246 → 11/243/243/247）。
- 默认布局复跑：`NODE_OPTIONS=--conditions=nomicore-source node node_modules/vitest/vitest.mjs run packages/persistence/test/cordis-root-real-timer.test.ts packages/namespace-registry/test/registry-sa7-rev1.test.ts` → **2 files / 17 tests 全绿、Type Errors no errors**（`.cache/cordis-baselines/m2-green/default-layout.log`）；`node node_modules/typescript/bin/tsc -p packages/persistence/tsconfig.json` → **exit 0**（`.cache/cordis-baselines/m2-green/persistence-tsc.log`）。
- 绿矩阵原始日志：`.cache/cordis-baselines/green-m2.log`。

#### 9.6.4 BASE HEAD 目标原因红（seam 未实现；`279dba4`）

- 机制沿用 §5.1：`git worktree add --detach .worktrees/base-m2 279dba4` + 同款 `.cache/cordis-baselines/base-farm.mjs` farm（**109 links / 16 packages**）+ 把 N1–N11 从主树复制进 BASE 工作树（real-timer 文件 sha256 与主树**逐字节相同**：`6117927d…efc4f5`）+ runner 以 working tree ∪ NEW_FILES 物化（`3415 tracked + 11 new files`，`allFilesPresent=true`，无 missing-file 红）；取证完毕已 `git worktree remove`。
- 结果（完整 real-timer suite = 既有 10 例 + 新断言 1 例）：
  - **BASE + B3：fail 0/11**（1 次运行即停）。新的 AC3(c) 用例失败点 = `await expect(writePromise).resolves.toBeUndefined()`（复制后文件行 670），原文 `Error: promise rejected "Error: cannot get property "root" without inject" instead of resolving`——即**UNLOADING 窗口内已接纳 `saveDoc` 在 base 的惰性 `ctx.root` 读取处 reject、无法提交**。该用例的**窗口锚定断言在 base 上均已通过**（fiber UNLOADING、service 已撤销、adapter dispose 未发生、写在途、store 仍 generation 1），故红因精确落在 dispatch 指定的目标原因上。
  - **BASE + B1 / B2：pass 11/11 ×3**（三次顺序运行 exit 0）——证明该断言不是「恒红」：其红/绿分界正是 seam 的 legacy/symbol 通道差异（legacy 在 npm 基线可用、rc.12 需 symbol）。
- 证据（全部在 `.cache/cordis-baselines/**`）：
  - `evidence-base/m2/{B3,B1,B2}/real-timer.json` + 各 `*-real-timer-repeat1.{log,vitest.json}`；
  - `evidence-base/m2/base-head.txt`、`base-farm.log`、`base-real-timer-test.sha256`、`base-<B>-real-timer.run.log`、`worktree-add.log`、`overlay-links.log`；
  - 机读汇总 `evidence-base/m2/m2-summary.json`（含 fixed-tree / BASE 每 cell 状态、计数、repeatRuns、证据 sha256、BASE 新用例失败原文、gates 结果、tracked 改动清单）。
- **既有 BASE 红证据未删除、未改写**：`evidence-base/red-matrix-summary.json`、`evidence-base/base-repro/**`（以及 `evidence-base/{B1,B2,B3}/**` 既有 cell）原样保留；`evidence/{B1,B2,B3}/{contract,real-timer,unload}.json` 为本次重跑生成的新鲜绿 cell（real-timer 10/10 → 11/11、contract 计数随 glob 双跑同步 +1）。
- 注：BASE cell JSON 的 `logPath` 指向已删除的临时 worktree；原始日志已按 baseline 复制到 `evidence-base/m2/<B>/` 并存（`m2-summary.json` 中 `baseHead.logPathNote` 已注明）。

#### 9.6.5 范围与纪律（本轮）

- tracked 改动：**仅** `packages/persistence/test/cordis-root-real-timer.test.ts`（§11.1 N2）；总 diff 面仍 = **6 修改 + 11 新增**，**不新增文件**。
- 未改 `packages/namespace-registry/**`（R5P 源文件零 diff）、未改 `service.ts`/`plugin.ts`、未改 runner/fixtures（N9 零 diff；`--all --matrix` 聚合语义不变）、未改 tsconfig/vitest.config/package.json/pnpm-lock/docs/artifacts/.gitignore。
- **本轮未重跑 `root-test` cell**（dispatch 的复跑范围 = 三基线 real-timer + unload；SA8 §4.2(c)-7 / SA10 §4 I-7 要求三套 root-test 证据**并存不得覆盖**）：该 cell 证据仍为上一轮生成件（矩阵件 `evidence/root-test/root-test.json`：fail/exit 1、5880 passed / 5912 total / 32 failed；对齐复跑件 `evidence/root-test/root-test-pnpm10282.json`：5908/5912、余 4 既有红），红因与失败集合不变；新断言会使默认布局聚合 **+1 test**（若重跑预期 5913 total、仍 32 failed）。**本报告不声称根 test/CI 全绿**。
- `node …/gates.mjs`（本轮重跑）：G1′/G2/G3/G4/G5/G7/G8/G9 **PASS**；**G6 FAIL**，唯一原因是 **Controller/Host 自有的未提交 wiki 修改** `wiki/raw/task_issue-470_dispatch.md:40 new blank line at EOF`（本 dispatch 开工前即存在；`git status` 首次快照已含 `M wiki/raw/task_issue-470_dispatch.md`），**非代码面**；代码面 `git diff --check -- packages apps domains docs '*/package.json' pnpm-lock.yaml` **exit 0**。修复该 wiki 文件不属 SA3 范围（Host/Controller 工件面；本轮证据只写 `.cache/cordis-baselines/**`，未写 marker）。
- 未执行 `git add`/`git commit`/`git push`。

---

## 10. 供 Controller 精确 `git add` 的最终路径清单

**tracked 修改（6）**

```
packages/persistence/src/service.ts
packages/ws-replication/src/plugin.ts
packages/ws-replication/test/ws-replication-plugin.test.ts
packages/ws-replication/test/ws-replication-issue299-ac-red.test.ts
packages/ws-replication/test/ws-replication-issue422-listen-false.test.ts
packages/ws-replication/test/ws-replication-guard-proxy-consumption.test.ts
```

**tracked 新增（11）**

```
packages/persistence/test/cordis-root-channel.test.ts
packages/persistence/test/cordis-root-real-timer.test.ts
packages/persistence/test/cordis-baseline-provenance.test.ts
packages/persistence/test/cordis-public-surface.test.ts
packages/persistence/test/fixtures/cordis-baselines/baselines.json
packages/persistence/test/fixtures/cordis-baselines/provenance-b3.json
packages/persistence/test/fixtures/cordis-baselines/public-surface.base.json
packages/persistence/test/fixtures/cordis-baselines/acquire.mjs
packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs
packages/persistence/test/fixtures/cordis-baselines/root-probe.mjs
packages/persistence/test/fixtures/cordis-baselines/gates.mjs
```

**iteration 1（SA8 证据面闭合，§9.5）的改动全部落在上述既有路径内**（不新增/删除 tracked 路径）：`packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs`（R-4：root-test cell 补记 `testNames/failedTestNames`）与 `packages/ws-replication/test/ws-replication-guard-proxy-consumption.test.ts`（R-5：删除未使用 helper）。

**iteration 2（SA10 M2 闭合，§9.6）的改动同样只落在既有路径内**：仅 `packages/persistence/test/cordis-root-real-timer.test.ts`（N2 原位增补 AC3(c) 断言 + 文件头注释）。路径集合与「6 修改 + 11 新增」均不变；`packages/namespace-registry/test/**` 与 `service.ts`/`plugin.ts` 零 diff。

**明确不 add**：`.cache/cordis-baselines/**`（gitignored：tarball/clone/build/overlay/workspaces/evidence/evidence-base/pnpm-shim）、`.worktrees/**`（G5/红灯取证临时 worktree，用毕已删）、`wiki/raw/**`（Host/Controller 既有未 tracked 工件）、任何 marker 文件。

**无**：`git add`/`git commit`/`git push` 执行记录；`.gitignore`、`package.json`、`pnpm-lock.yaml`、`artifacts/**`、`docs/**`、`tsconfig*.json`、`vitest.config.ts`、两包 `src/index.ts`、persistence 核心、namespace-registry/src、replication-protocol、ws-replication 其余文件、apps/、CONTEXT.md、domains/ 全部零改动（G1′/G4/G7/G9 + G2/G3 allowlist 机械证明）。

---

## 11. Suggested commit message（供 Controller 选择）

```
feat(cordis): 双形态 Root 解析缝 + 三基线工件验真设施 (#470)

- persistence service.ts / ws-replication plugin.ts：包内私有 symbol 优先、legacy 兜底
  Root timer 解析（apply 期同步 loud fail、稳定单句、无 ambient 兜底、对象引用+方法调用
  武装禁 detach）；错误文案与生命周期语义零漂移
- ws-replication 恰好 4 个具名 fixture 迁移为 symbol shim + 内联 helper
- 新增 cordis-root-channel / cordis-root-real-timer / cordis-baseline-provenance /
  cordis-public-surface 四套验收测试（AC1/AC2/AC4/AC5/AC7/AC9）
- 新增 cordis-baselines 夹具：npm tarball（sha512 钉值）/ DSH commit 1511a6e 最小 tsc
  source-build（provenance 8 项）/ 独立 root-probe / 规范 runner（NEW_FILES 并集物化、
  每基线 15-project typecheck、ws-package、root-test、4 负控、--all --matrix）/ G1′–G9 gates
- 证据面闭合（SA8 实现级复查 iteration 1）：runner 的 root-test cell 补记
  testNames/failedTestNames；删除 guard-proxy fixture 内未使用 helper；四负控证据、
  BASE 等量复现与 packageManager 对齐复跑证据落 .cache（不提交）
```
