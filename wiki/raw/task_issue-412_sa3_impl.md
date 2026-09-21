# SA3 Implementation Report

- 任务：issue #412（persistence：公开完成式排空 `drain()` + `retryDelayMs` 与 `debounceMs` 解耦 + 宿主优雅停机 `drain` 硬契约）
- Worktree：`/home/wangjian/nomicore-fix-issue-412`（分支 `mabf/issue-412`）
- 入口 HEAD：`f3b13ee chore(ci): record final issue 412 reviews`（= 失败 CI run `35535478371` 的 `headSha`；`#412` 主体实现 `75bd0ab`、codegen 修复 `9094760` 均在其历史内）
- 本轮 dispatch：`sa-98b9e976-b530-4227-ae2e-1dfa5cfa40d7`（phase implementation，**iteration 3**）——修复 `test (24, 6)` 中 `apps/yjs-server/test/smoke-skeleton-red.test.ts` 的 `peer exit code: expected 143 to be +0`；保持 Owner comment `5751613018`（updated `2026-09-20T18:03:36Z`）的 drain-before-dispose 硬契约与 ADR-0006 对齐；建立可执行 red→green 覆盖并留证据
- **本轮结论**：根因 = **测试 harness 的 `tsx` CLI 包装进程信号转达窗（30ms）**，非产品缺陷。修复 = 把 `spawnApp` 换成 `node --import tsx <main.ts>` 直跑（信号直达 app 进程），断言面逐字不变；并新增「忙窗内 SIGTERM 仍完成排空链 → exit 0」回归锚（旧形态下该用例红：`expected 143 to be +0`）。**产品代码（`packages/**`、`apps/yjs-server/src/**`、`docs/**`）本轮零改动**，#412 契约逐字保持。

## Inputs consumed

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| `wiki/raw/task_issue-412.md` | 已读 | Issue 正文（缺口 1/2、消费方证据、请求面） |
| `wiki/raw/task_issue-412_design.md`（SA2 verdict **approve**） | 已读（§11 ALLOW/DENY、§12 验收映射、§7 DD-7） | 实施唯一依据 + 本轮范围核对 |
| `wiki/raw/task_issue-412_sa6_contract.md` | 已读 | 契约项 C1–C14、runner 触发命令 |
| `wiki/raw/task_issue-412_sa2_review.md` | 已读（§13/§14 修订映射） | SA2-1~SA2-13 落实核对（0 BLOCKER/0 MAJOR） |
| `wiki/raw/task_issue-412_design_conflict_report.md`、`..._implementation_conflict_report.md` | 已读 | SA8 约束（ADR 同变更集、不得物化缺省 retryDelayMs、注释诚实性、liveness 不变量）；实现后复审 **clear** |
| `wiki/raw/task_issue-412_sa4_review.md`、`..._sa9_standards.md`、`..._sa10_spec.md` | 已读 | iteration 0/1 审查结论（approve ×3） |
| **CI run `35535478371`（head `f3b13ee`）job `test (24, 6)` 原始日志** | 只读拉取（`gh api .../jobs/106143620539/logs`） | 失败原文：`AssertionError: peer exit code: expected 143 to be +0`，行号 `smoke-skeleton-red.test.ts:267`；全文 66 files / 745 tests，唯一非绿 job |
| **CI run `35534499992`（head `5b3ff26`）** | 只读拉取 | 同一份产品代码下 **16/16 job 全绿**（含 `test (24, 6)`、`test (20, 6)`）⟹ 判定 flaky |
| `git diff --name-only 5b3ff26 f3b13ee` | 本地核对 | 两 head 间差异仅 `wiki/**` + `artifacts/**`，**产品与测试树逐字节相同** |
| `apps/yjs-server/test/smoke-skeleton-red.test.ts`、`apps/yjs-server/src/main.ts`、`shutdown-watchdog.ts`、`fatal-policy.ts`、`apps/yjs-server/src/app.ts` | 已读 | harness 形态、SIGTERM 注册点（`main.ts:214-216`，唯一注册点、无移除点）、停机链与预算 |
| `node_modules/tsx/dist/cli.mjs`、`preflight.cjs`、`client-D3mGB526.cjs`、`get-pipe-path-D4YM6rQt.cjs`（tsx `4.23.12`，lock 固定） | 已读 | 转达机制取证：`relaySignals` → `waitForSignalFromChild`（30ms 双窗）→ 超时 `child.kill('SIGKILL')` + `process.exit(128 + SIGTERM=15)` = 143；子进程侧 `preflight` 才安装 hidden signal handler，且仅经父进程 pipe 上报 |
| `apps/yjs-server/test/root-lock-atomic-reclaim-red.test.ts:34` | 已读 | 仓内既有先例：`fork(..., { execArgv: ['--import', 'tsx'] })` |
| `.github/workflows/ci.yml`、`scripts/ci-test-shard.mjs` | 已读 | `test (node, shard)` 矩阵（20/24 × 1..6）与分片 6 文件列表（含本测试） |

## Existing worktree reconciliation

- 入口工作区干净（`git status --short` 无产品改动），HEAD = `f3b13ee` = 失败 run `35535478371` 的 `headSha`。
- iteration 0/1 的 #412 实现（`packages/persistence/**`、`packages/dsh-persistence/src/probe.ts`、`apps/yjs-server/src/{app,config,main}.ts`、`docs/adr/0006-*.md`、`CONTEXT.md`、两份集成文档、两份新增测试）与 iteration 1 的 codegen 修复（`domains/vfs3-assets/generated.ts` + 两处字节哨兵）**均已提交并在位，本轮零触碰**。
- iteration 2 的结论（「三个具名检查已绿」）在本轮被新证据修正：`test (24, 6)` 在同一实现上仍会以 **143** 形态偶发红（详见下节），故本轮不再是核验轮，而是**根因修复轮**。
- 本轮实际改动只有 1 个测试文件（`apps/yjs-server/test/smoke-skeleton-red.test.ts`）+ 证据日志 + 本报告；产品树 `git diff HEAD --stat` 中 `packages/**`、`apps/yjs-server/src/**`、`docs/**`、`.github/**` 为空。

## 根因诊断（证据链）

### 失败观测（run `35535478371`，head `f3b13ee`）

- 唯一非绿 job = `test (24, 6)`（其余 15 job 全绿）；shard 内唯一失败用例 = 文件第 2 例
  `hub emits provisioned→listening(actual port)→ready; peer authenticates static target; …; SIGTERM exits 0`，
  断言点 = `await signalAndExpectExit(peerProc, 'SIGTERM', 30_000, 0, 'peer')`（:267）：
  `AssertionError: peer exit code: expected 143 to be +0`；该用例仅 964ms 即返回（未触 30s 超时）。

### 为什么 143 只能来自 tsx CLI，而不是 app 进程

1. app 侧 `process.exit` 只出现三类码：`0`（SIGTERM/SIGINT 有序停机、`shutdown` 动词）、`1`（boot/换装失败、watchdog 兜底）；**不存在 143**（`apps/yjs-server/src/**` 全树 grep `process.exit` 仅 main.ts 三型 + watchdog 注入缝）。
2. `main.ts:214-216` 是仓内唯一的 `process.on('SIGTERM'|'SIGINT'|'SIGHUP')` 注册点，同步注册（`createNomicoreApp` → `attachControlChannel` 之后同一同步块），且**无任何移除点**（全树 `removeAllListeners`/`off('SIGTERM')` = 0 命中）⟹ 「应用无 SIGTERM listener → tsx hidden handler `process.exit(128+15)`」路径不成立。
3. harness 用 `spawn(TSX_BIN, [MAIN_TS, …])`（`TSX_BIN = node_modules/.bin/tsx`）：`.bin/tsx` 是 sh shim（`exec node .../tsx/dist/cli.mjs`），**tsx CLI 再 spawn 一个 node 子进程跑 `main.ts`**，并把收到的 SIGTERM/SIGINT 经内部 pipe 转达给子进程：转达后只给 **30ms** 回执窗（`waitForSignalFromChild`），超时即 `child.kill('SIGKILL')` + 包装进程 `process.exit(128 + 15)` = **143**。回执由子进程 `preflight` hidden handler 发出，依赖子进程事件循环被调度 ⟹ **30ms 是竞态窗**。
4. flaky 判定：同一份产品代码 + 同一测试文件，run `35534499992`（head `5b3ff26`）该 job 绿、run `35535478371`（head `f3b13ee`）红；两 head 间 `git diff` 仅 `wiki/**`+`artifacts/**`。**产品缺陷无法解释「零差异双态」**。

### 确定性复现（red→green，同一 app / 同一忙窗 blocker / 仅换 spawn 形态）

`artifacts/sa3-issue412-iter3-relay-redgreen.log`（`/tmp/probe-shape.mjs`：blocker 在 app 进程内周期阻塞事件循环 400ms/415ms，忙窗开始时广播 NDJSON；探针收到广播后 50ms 发 SIGTERM，稳定落进忙窗）：

| spawn 形态 | parent exit | `app-stopped` | 3 次结果 |
| --- | --- | --- | --- |
| A：`node_modules/.bin/tsx <main.ts>`（现 harness） | **143** | **false**（app 被 SIGKILL，排空链腰斩） | 143 / 143 / 143 |
| B：`node --import tsx <main.ts>`（修复后 harness） | **0** | **true**（`persistence-disposed` → `app-stopped`） | 0 / 0 / 0 |

⟹ 143 与「应用是否正确处理 SIGTERM/是否完成 drain」**无因果**，只取决于包装进程那 30ms 回执窗是否被错过；形态 B 下信号直达 app 自身 handler，阻塞结束即继续 `drain → dispose → exit 0`。

## Changed paths

| Path | Design section | Change |
| --- | --- | --- |
| `apps/yjs-server/test/smoke-skeleton-red.test.ts` | dispatch 具名失败面（`test (24, 6)`）；设计 §12 S-5 的相邻锚面 | ① `spawnApp` 由 `.bin/tsx` CLI 改为 `node --import tsx <main.ts>` 直跑（+`cwd: REPO_ROOT`、可选 `appNodeOptions` 注入缝）；② 新增忙窗回归用例「SIGTERM 直达 app 进程：事件循环忙窗内送达仍完成排空链 → exit 0」+ 运行时生成的 blocker 模块（tmp dir，零新增仓内 fixture）+ `persistence-disposed` 先于 `app-stopped` 硬契约尾序断言；③ 头注释/spawn 注释记录根因与 CI 编号。**断言面（SIGTERM → exit 0、四事件序、锁守卫、durable 回读）逐字不变，无 skip/only/todo、无容忍 143 的放宽。** |
| `wiki/raw/task_issue-412_sa3_impl.md` | SA3 固定产物 | 原位更新为当前实现 + 当前验证结果（iteration 3 根因修复轮） |
| `artifacts/sa3-issue412-iter3-*.log`（29 份） | 仓内 SA3 证据惯例（`git ls-files artifacts/` 既有 200+ 项） | 证据留档：CI 失败原文、机制 red/green、仓内 red 证明、shard 6、persistence 契约、S-5、generate --check、root typecheck、app 全套、稳定性与负载复跑 |

**产品代码零改动**（iteration 0/1 已提交、本轮在位核对的 #412 变更集）：

| Path | Design section | Change（已提交，本轮零 diff） |
| --- | --- | --- |
| `packages/persistence/src/contract.ts` | DD-1~DD-5 | `PersistenceDrainTarget`；`DocPersistence.drain?` + 语义 doc-comment；`PersistenceSchedule.retryDelayMs?`；`resolvePersistenceSchedule` 条件展开 |
| `packages/persistence/src/lifecycle.ts` | DD-2/DD-5/DD-5b | 公共 `drain(targets?)`；`retryBaseMs` 单源 getter；`releaseSettleWaiters` 统一释放 + 四处移除点 |
| `packages/persistence/src/memory.ts` / `file.ts` / `index.ts` | DD-1 | drain 委派（File 入口 `validateIdentity`）；barrel 导出新类型 |
| `packages/dsh-persistence/src/probe.ts` | DD-6 | 退避镜像锁步 `retryDelayMs ?? debounceMs` |
| `apps/yjs-server/src/app.ts` / `config.ts` / `main.ts` | DD-7 | 停机第 3 步固定睡眠 → file/memory 统一的 `awaitDrainWithBudget` + `persistence-drain-budget-exceeded` 事件 + 有损继续；注释/文案刷新 |
| `docs/adr/0006-server-persistence-docstore.md`、`CONTEXT.md`、`docs/integration/*.md` | DD-8 | 修订节 7 条（含 :270 无条件硬契约、:276 修订并扩展 :86）；词条；宿主指引 |
| `packages/persistence/test/persistence-issue-412-drain-semantics.test.ts`、`apps/yjs-server/test/persistence-drain-shutdown.test.ts` | §12 S-1~S-5 | 9 + 3 tests |
| `domains/vfs3-assets/generated.ts` + 两处字节哨兵 | iteration 1 dispatch 扩权 + `domains/AGENTS.md` §Workflow | 生成物横幅 `0.1.3→0.2.0` + `GENERATED_SHA256` 重钉（断言/语义指纹零改动） |

## Owner comment 5751613018 / ADR 对齐保持性（本轮）

| Owner 要求 | HEAD 证据 | 判定 |
| --- | --- | --- |
| 宿主优雅停机**必须先 `await drain()` 再 dispose**（硬契约） | `docs/adr/0006-server-persistence-docstore.md:270` 无条件条款；`apps/yjs-server/src/app.ts` 停机链 `awaitDrainWithBudget(adapter.drain(), budgetMs)` 结构性先于全仓唯一 `persistenceFiber.dispose()`；file/memory 统一无 kind 特判 | **保持**（本轮 `apps/**/src`、`packages/persistence/**`、`docs/adr/**` diff = 空；SA6 契约切片 21 files/221 tests + S-5 3 tests 重跑全绿） |
| 同步修订 ADR-0006 :86 dispose 定义 | ADR 0006:276「修订并扩展 :86」；dispose 保持 abortive/有损 | **保持** |
| dispose 保持 abortive 时保留分层公开 drain | `contract.ts` `readonly drain?`；`lifecycle.ts` `async drain` | **保持** |
| `retryDelayMs` 独立可配置、缺省保持现行为 | `retryDelayMs?` + 缺省动态回退 `debounceMs`（解析键形状不变） | **保持** |
| 硬契约的可观察失败面不被测试放宽 | 新增回归用例在忙窗下额外断言 `persistence-disposed` → `app-stopped` 尾序；旧形态下该用例红（143） | **强化**（未新增任何容忍码） |

## SA2 Finding落实（iteration 1，均已随 HEAD 提交，本轮零改动）

| Finding ID | Implementation | Result |
| --- | --- | --- |
| **SA2-1（MAJOR，预算组合）** | `app.ts` `awaitDrainWithBudget`（race + timer 早清）+ 预算 = `maxDirtyMs + 边距` + 预算尽 `persistence-drain-budget-exceeded` + 有损继续 | 已落实（S-5b 实测绿） |
| SA2-2（静息观察点措辞） | `contract.ts` doc-comment + ADR 修订节第 2 条 | 已落实 |
| SA2-3（永不 reject vs File 校验） | 显式例外通道申明 + File 入口 `validateIdentity` | 已落实（S-4 File 专项） |
| SA2-4 / SA2-5 / SA2-8 / SA2-9 / SA2-10 / SA2-13 | 字段注释、CONTEXT `_Avoid_`、词表条件性注记、示例 drain 步、「修订并扩展」措辞、memory 缺省预算括注 | 已落实（文本逐条在位） |
| SA2-6（契约文件零触碰） | SA6 两文件本轮重跑 md5/内容零改动 | 已落实 |
| **SA2-7（MAJOR，memory 统一）** | 停机第 3 步删除 `kind==='file'` 守卫；plugin 句柄两分支统一 | 已落实（S-5c 实测绿） |
| SA2-11 / SA2-12 | 实现层证据（S-5b）/ 设计文档文本属 SA1 产物 | 记录 |

## File scope check

| Changed path（本轮） | ALLOW entry | Purpose |
| --- | --- | --- |
| `apps/yjs-server/test/smoke-skeleton-red.test.ts` | **dispatch 具名失败面**（`test (24, 6)`：`apps/yjs-server/test/smoke-skeleton-red.test.ts` 的 143 观测）+ 设计 §12「建立红→绿可执行覆盖」要求；`domains/AGENTS.md`/skills 未涵盖 app 测试 | harness 形态修复（信号直达）+ red→green 回归锚 |
| `wiki/raw/task_issue-412_sa3_impl.md` | SA3 固定产物（skill §实现报告） | 原位更新 |
| `artifacts/sa3-issue412-iter3-*.log` | 仓内 SA3 证据惯例 | 验证证据留档 |

**范围申报（交 Controller/SA4 认定，不自行宣告合规）**：设计 §11 **DENY LIST** 含「`apps/yjs-server/test/` 既有测试」条，其立法理由是「四事件序/配置边界/watchdog 锚零改动即绿；S-5 以新增文件承载」。本轮改动的 `smoke-skeleton-red.test.ts` **不属于 #412 的证据锚**（该文件自 `b66615c` Phase 5 起未动、与 #412 变更集零交集），且改动为 **dispatch 直接指名的 CI 失败面**；改动只触 spawn 形态 + 新增回归用例，**不触碰任何 #412 冻结锚的断言**。其余 DENY 面本轮零触碰：`packages/persistence/src/{service,testing}.ts`、`namespace-registry/**`、`dsh-persistence/{record,events,profile,cli}.ts`、persistence 既有测试（含冻结审计）、**SA6 两份契约文件**、其余 apps 既有测试、`docs/protocols/**`、`packages/ws-replication/**`、Host/SA2/SA6/SA8 wiki 产物、`packages/vfsl-codegen/**`、`.github/**`、`domains/vfs3-assets/schema.vfsl`。

## Verification（iteration 3，最终文件版本）

| Command | Result | Evidence |
| --- | --- | --- |
| **红证明（仓内）**：临时把 `spawnApp` 还原为 `.bin/tsx` 形态 → `vitest run apps/yjs-server/test/smoke-skeleton-red.test.ts -t "busy event loop"` | ✅ **红（复现 CI 签名）**：`AssertionError: hub (busy window) exit code: expected 143 to be +0`；`Tests 1 failed \| 4 skipped`（跑后文件已还原，`diff` 核验 RESTORED-OK） | `artifacts/sa3-issue412-iter3-smoke-red-proof.log` |
| **机制 red/green（同 app / 同 blocker / 双形态）** | ✅ A 形态 143×3（`app-stopped=false`）；B 形态 0×3（`app-stopped=true`） | `artifacts/sa3-issue412-iter3-relay-redgreen.log` |
| `NODE_OPTIONS=--conditions=nomicore-source vitest run apps/yjs-server/test/smoke-skeleton-red.test.ts --typecheck.enabled=false --passWithNoTests=false`（修复后，连续 5 次） | ✅ **5 files-runs 全绿（每次 5 tests）** | `artifacts/sa3-issue412-iter3-smoke-stability.log` |
| CI `test (…, 6)` 步骤原文：`files=$(node scripts/ci-test-shard.mjs 6 6); NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run $files --typecheck.enabled=false --passWithNoTests=false`（本机 Node v24.13.0） | ✅ **66 files / 746 tests 全绿，exit 0**（CI 基线 745 + 新增 1） | `artifacts/sa3-issue412-iter3-shard6-node24.log` |
| 同 shard 6 命令 + 6 路 CPU 忙循环人工负载（本机 4 vCPU，loadavg 6→18）14 次 | ✅ 14/14 绿（忙窗用例 1.4–3.1s，距 30s 退出窗 10 倍余量） | `artifacts/sa3-issue412-iter3-smoke-load-run{1..14}.log` |
| `npx -y node@20 node_modules/vitest/vitest.mjs run apps/yjs-server/test/smoke-skeleton-red.test.ts --typecheck.enabled=false`（Node 20 面本地替身） | ✅ **5 tests 全绿**（`--import tsx` 直跑形态在 Node 20.20.2 成立） | 见本报告 §Verification 命令行输出；Node 20 权威证据仍以 CI `test (20, 6)` 为准 |
| `pnpm exec tsc -p apps/yjs-server/tsconfig.json --noEmit`（apps AGENTS.md 门） | ✅ exit 0（tsconfig `include: test/**/*.ts` ⟹ 改动文件被类型检查） | 命令行输出 |
| `pnpm typecheck`（root 门，设计 §12） | ✅ exit 0（15 段 tsconfig，含 apps/yjs-server） | `artifacts/sa3-issue412-iter3-root-typecheck.log` |
| `pnpm exec vitest run apps/yjs-server/test --typecheck.enabled=false --passWithNoTests=false`（apps AGENTS.md 全套门） | ✅ **35 files / 183 tests 全绿**（含其余 13 个仍用 `.bin/tsx` 形态的既有测试，本轮未复现 flake） | `artifacts/sa3-issue412-iter3-app-suite.log` |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/persistence/test`（SA6 §12 runner 触发） | ✅ **21 files / 221 tests 全绿，Type Errors: no errors**（含 SA6 契约 27 + 5） | `artifacts/sa3-issue412-iter3-persistence-contract.log` |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run apps/yjs-server/test/persistence-drain-shutdown.test.ts --typecheck`（S-5a/S-5b/S-5c） | ✅ **3 tests 全绿，Type Errors: no errors** | `artifacts/sa3-issue412-iter3-shutdown-tests.log` |
| `pnpm generate --check`（CI job `codegen-freshness` 步骤原文，设计 §12 静态门） | ✅ exit 0（无 diff 输出） | `artifacts/sa3-issue412-iter3-generate-check.log` |
| `git diff HEAD --stat` | ✅ 仅 `apps/yjs-server/test/smoke-skeleton-red.test.ts`（+92/-5）；`packages/**`、`apps/**/src/**`、`docs/**`、`.github/**` = 空 | 出口核对 |
| CI 侧（待 Controller 触发）：`test (24, 6)` / `test (20, 6)` 复跑 | ⏳ 本机无法触发（无 push 权限）；本地以该 job 步骤原文 + Node 20 替身替代 | CI run 编号见上 |

### 本轮 CI 失败/对照证据（只读拉取，未改动 CI 配置）

- `run 35535478371`（head `f3b13ee`）：16 job，唯一非绿 = `test (24, 6)`（job `106143620539`）→ `peer exit code: expected 143 to be +0`。
- `run 35534499992`（head `5b3ff26`）：16 job 全绿（`test (20, 6)`、`test (24, 6)` 均 success）。
- `git diff --name-only 5b3ff26 f3b13ee` = `artifacts/sa3-issue412-iter2-*.log`(5) + `wiki/raw/task_issue-412_*.md`(3) ⟹ 产品/测试树零差异。
- 失败原文摘录留档：`artifacts/sa3-issue412-iter3-ci-failure-evidence.log`。

## Deferred verification

- **CI 权威复跑**：`test (20, 6)` / `test (24, 6)`（以及整体 run）需 Controller 触发；本机 Node 20/24 均以 job 步骤原文或替身验证绿，但真实 runner 的 4 vCPU 并行剖面以 CI 为准。
- **其余 13 个仍用 `.bin/tsx` 形态的 apps 既有测试**（`host-namespace-delete-sa7-dynamic`、`diagnostic-replay-*`、`stdin-error-chain-red`、`hub-restart-static-target-red`、`on-fatal-error-process-issue288`、`host-*` 等，均含 SIGTERM 断言）暴露在**同一 30ms 转达窗**下：本轮 dispatch 只具名 `smoke-skeleton-red.test.ts`，未扩大改动面。建议后续变更集统一改用 `node --import tsx` 直跑形态（一行替换）或抽公共 spawn 助手——**交 SA1/Controller 决策**。
- 真正的外部消费者（nomic-server）行为、真实慢盘/生产停机时长画像：属 SA4/SA7 动态验证面。
- 设计 §13 残余/follow-up 不变：DSH 记录头携带 `retryDelayMs` 的 golden 立法、yjs-server 配置面暴露 `retryDelayMs`、nomic-server 仓库外替换固定睡眠、archive×delete 既有理论挂起的专项系统性测试。
- `apps/yjs-server/AGENTS.md` 单一拆卸链摘要行未逐字反映新增等待步——残余文档债。
- 本轮人工 4 倍超订负载实验中出现过 **1 次未复现的失败**（过滤输出为 `1 failed | 4 passed`，其中未见 `143` 字样 ⟹ 非退出码不符，疑为负载下的等待超时/端口竞态）；随后 17 次等量或更重负载（loadavg 6→18，`smoke-load1..3` + `smoke-load-run1..14`）+ 1 次 shard 6 + 9 次常规全绿均未复现。**该轮次只留了命令行过滤输出且已被最终稳定性复跑覆盖（原始文件未留档）**；如实登记，不作结论。

## Deviations or blockers

- **无阻塞**。设计可实施、ALLOW/DENY 明确（唯一范围申报见 §File scope check）、红线可执行。
- **唯一偏离**：修复落在 `apps/yjs-server/test/smoke-skeleton-red.test.ts`（设计 DENY 目录内的既有测试文件），依据是 dispatch 直接指名该文件为失败面 + 「建立可执行 red→green 覆盖」要求；已按 skill §实施前检查申报，未自行认定合规，请 Controller/SA4 裁定。
- 未修改任何产品代码、未改断言语义、未加 skip/only/todo、未引入 env override 或 fallback；143 未被容忍（新增用例反而把「旧形态 143」钉成确定红）。

## Suggested commit message

```
fix(#412): 修复 test (24, 6) smoke 信号转达 flake——SIGTERM 直达 app 进程 + 忙窗回归锚

根因：spawnApp 用 node_modules/.bin/tsx CLI 起 app；CLI 再 spawn node 子进程并把
SIGTERM 经内部 pipe 转达，只留 30ms 回执窗，超时 SIGKILL 子进程 + exit(128+15)=143
（run 35535478371 test (24, 6)：peer exit code expected 143 to be +0）。同一份产品
代码在 run 35534499992 该 job 绿、35535478371 红，两 head 间仅 wiki/artifacts 差异。

修复：spawnApp → node --import tsx <main.ts> 直跑（信号直达应用 handler；与
root-lock-atomic-reclaim-red.test.ts 的 --import tsx 先例同款、与发布产物 node 直跑
dist/main.js 同形）。断言面逐字不变（SIGTERM → exit 0、四事件序、锁守卫、durable 回读）。

新增回归锚：忙窗（400ms/415ms 阻塞，运行时生成 blocker 注入）内 SIGTERM 仍完成
drain → dispose → app-stopped → exit 0，并断言 persistence-disposed 先于 app-stopped
（Owner 5751613018 硬契约）。旧 tsx CLI 形态下该用例确定红（expected 143 to be +0）。

证据：shard 6 命令原文 66 files/746 tests 绿；SA6 persistence 契约 21/221 + S-5 3 绿；
root typecheck 0；generate --check 0；app 全套 35/183 绿；机制复现 tsx-cli 143×3 vs
node --import 0×3。
```

**iteration 1（已由 Controller 提交，此处留档）**：`9094760 fix(codegen): refresh generated vfs3 assets`；`75bd0ab feat(persistence): add completion drain lifecycle`。
