# SA3 Implementation Report

- 任务：issue #412（persistence：公开完成式排空 `drain()` + `retryDelayMs` 与 `debounceMs` 解耦 + 宿主优雅停机 `drain` 硬契约）
- Worktree：`/home/wangjian/nomicore-fix-issue-412`（分支 `mabf/issue-412`）
- 入口 HEAD（iteration 3）：`f3b13ee chore(ci): record final issue 412 reviews`（= 失败 CI run `35535478371` 的 `headSha`；`#412` 主体实现 `75bd0ab`、codegen 修复 `9094760` 均在其历史内）
- 入口 HEAD（iteration 4）：`2c3a486 chore(ci): record issue 412 final repair reviews`（分支 `mabf/issue-412`，领先 `origin/main` 7 提交；修复提交 `d60760c`、证据提交 `bdb91cb` 均在其历史内）
- iteration 3 dispatch：`sa-98b9e976-b530-4227-ae2e-1dfa5cfa40d7`（phase implementation）——修复 `test (24, 6)` 中 `apps/yjs-server/test/smoke-skeleton-red.test.ts` 的 `peer exit code: expected 143 to be +0`；保持 Owner comment `5751613018`（updated `2026-09-20T18:03:36Z`）的 drain-before-dispose 硬契约与 ADR-0006 对齐；建立可执行 red→green 覆盖并留证据。该变更集已由 Controller 提交为 `d60760c`，评审留档提交 `2c3a486`。
- iteration 4 dispatch：`sa-05a9c736-0de4-4574-a4f0-36587424884f`（phase implementation）——回执「剩余未跟踪的 iteration-3 验证产物」：为干净最终工作区确定证据集，保留必要的可复现验证证据、只清理冗余生成物；**不得改动已评审通过的产品/测试修复**；Owner comment `5751613018` 的硬 drain-before-dispose 与 ADR 对齐须保持。
- 本轮 dispatch：`sa-dd43d106-f485-4082-a0c4-23720f4b9ea7`（phase implementation，**iteration 5**）——只归零 `git diff --cached --check` 在已批准保留的 iteration-3 验证产物上报出的**精确** trailing-whitespace / EOF 空行缺陷（8 份日志、共 14 处）；保持日志内容与已评审修复不变，**产品/测试语义零改动**；Owner comment `5751613018` 的硬 drain-before-dispose 与 ADR 对齐须保持。
- **iteration 5 结论**：`git diff --cached --check` 报出的 14 处具名缺陷（8 处行尾空白 + 6 处 EOF 空行）全部归零，**未触碰任何其他字节**：8 份日志去空白后的内容哈希与索引版本逐份相同，行列差逐份符合预期（EOF 类 −1 行/−1 byte；行尾空白类 0 行/−N bytes，N = 该文件被报行数）。产品/测试/文档树对 HEAD 零 diff（`git diff HEAD -- packages apps docs .github domains scripts` = 空）；Owner 硬契约载体（ADR-0006 :242/:270/:276、`app.ts:624→:630`、S-5 锚、忙窗尾序锚）逐项复核在位。
- **iteration 4 结论**：裁决依据 = iteration-3 SA3 `structured_output.artifactPaths` 已声明的产物集（Controller 侧在案）∩ 工作区实际文件。**保留 8 份**具名闸门证据日志（未跟踪，待 Controller 循 iteration 2 先例以 `chore(ci)` 入库）+ 已入库 3 份；**清理 18 份**从未被声明、逐次重复同一命令输出的生成物（1 份修复前基线 + 3 份修复前 4-test 负载 + 14 份最终形态负载复跑），其计数/时序/摘要已完整固化于本报告「Evidence reconciliation」节。产品与测试树 `git diff HEAD` = 空；Owner 硬契约四方载体逐项复核在位。
- **iteration 3 结论（历史，保持）**：根因 = **测试 harness 的 `tsx` CLI 包装进程信号转达窗（30ms）**，非产品缺陷。修复 = 把 `spawnApp` 换成 `node --import tsx <main.ts>` 直跑（信号直达 app 进程），断言面逐字不变；并新增「忙窗内 SIGTERM 仍完成排空链 → exit 0」回归锚（旧形态下该用例红：`expected 143 to be +0`）。**产品代码（`packages/**`、`apps/yjs-server/src/**`、`docs/**`）本轮零改动**，#412 契约逐字保持。

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
| **本 dispatch 文本**（`sa-05a9c736-0de4-4574-a4f0-36587424884f`，iteration 4） | 已读 | 范围：判定证据集、保留必要可复现证据、清理冗余生成物；不得改动已评审修复；Owner comment `5751613018` 须保持 |
| **Controller 在案的 iteration-3 SA3 结果记录**（`~/.dsh/nomicore/mabf-peer-jim-dev/mabf-sa-executions.json` + `mabf-center` 命名空间快照中的 `artifactPaths`） | 只读核对 | 「已声明产物」= 保留集的权威判据：声明集 = 本报告 + 被修复测试文件 + 9 份具名证据日志；`smoke-load*` / `smoke-run1` **全量未出现在任何在案记录中** |
| `git status --porcelain --untracked-files=all`、`git diff HEAD` | 只读 | 收纳前 = 26 份未跟踪日志 + 0 已跟踪改动；出口核对同款命令 |
| 26 份未跟踪日志逐份内容 + `stat` + `sha256sum` | 已读 | 分类：8 份互不重复的闸门/机制证据 vs 18 份逐次重复 stdout 转储（清单见 §Evidence reconciliation） |
| `wiki/raw/task_issue-412_sa9_standards.md` §7（M-1）、`..._sa10_spec.md` §6-9 | 已读 | 披露本轮回执与「补入库」建议的差异，交 Controller/SA9 认定 |

## Existing worktree reconciliation

- 入口工作区干净（`git status --short` 无产品改动），HEAD = `f3b13ee` = 失败 run `35535478371` 的 `headSha`。
- iteration 0/1 的 #412 实现（`packages/persistence/**`、`packages/dsh-persistence/src/probe.ts`、`apps/yjs-server/src/{app,config,main}.ts`、`docs/adr/0006-*.md`、`CONTEXT.md`、两份集成文档、两份新增测试）与 iteration 1 的 codegen 修复（`domains/vfs3-assets/generated.ts` + 两处字节哨兵）**均已提交并在位，本轮零触碰**。
- iteration 2 的结论（「三个具名检查已绿」）在本轮被新证据修正：`test (24, 6)` 在同一实现上仍会以 **143** 形态偶发红（详见下节），故本轮不再是核验轮，而是**根因修复轮**。
- 本轮实际改动只有 1 个测试文件（`apps/yjs-server/test/smoke-skeleton-red.test.ts`）+ 证据日志 + 本报告；产品树 `git diff HEAD --stat` 中 `packages/**`、`apps/yjs-server/src/**`、`docs/**`、`.github/**` 为空。
- **iteration 4（本轮）工作区入口**：HEAD = `2c3a486 chore(ci): record issue 412 final repair reviews`（分支 `mabf/issue-412`，领先 `origin/main` 7 个提交）；`git status --porcelain --untracked-files=all` = **26 份未跟踪 `artifacts/sa3-issue412-iter3-*.log`，已跟踪改动 0**（`git diff HEAD` 空、无 staged）。本轮即对这 26 份的收纳裁决：未引入任何实现改动，唯一变更 = 删除 18 份冗余生成物 + 本报告原位更新（详见 §Evidence reconciliation）。
- **iteration 5（本轮）工作区入口**：HEAD 仍 = `2c3a486`；Controller 已把 iteration-4 裁决后的出口态 `git add` 入索引 —— `git status --porcelain -uall` = 8 份 `A `（`artifacts/sa3-issue412-iter3-{app-suite,ci-failure-evidence,generate-check,persistence-contract,root-typecheck,shard6-node24,shutdown-tests,smoke-red-proof}.log`）+ 3 份 `M `（`wiki/raw/task_issue-412_sa3_impl.md`、`..._sa4_review.md`、`..._implementation_conflict_report.md`），未跟踪面为空；`git diff --cached --check` 报出 14 处空白缺陷（全部落在上述 8 份日志，wiki 记录零命中）。本轮只做这 14 处的空白归零 + 本报告原位更新，**零实现/测试/文档改动、零文件增删**（详见 §iteration 5 清整记录）。

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

## Changed paths（iteration 3 修复轮 + iteration 4 收纳轮 + iteration 5 清整轮）

| Path | Design section | Change |
| --- | --- | --- |
| `apps/yjs-server/test/smoke-skeleton-red.test.ts` | dispatch 具名失败面（`test (24, 6)`）；设计 §12 S-5 的相邻锚面 | ① `spawnApp` 由 `.bin/tsx` CLI 改为 `node --import tsx <main.ts>` 直跑（+`cwd: REPO_ROOT`、可选 `appNodeOptions` 注入缝）；② 新增忙窗回归用例「SIGTERM 直达 app 进程：事件循环忙窗内送达仍完成排空链 → exit 0」+ 运行时生成的 blocker 模块（tmp dir，零新增仓内 fixture）+ `persistence-disposed` 先于 `app-stopped` 硬契约尾序断言；③ 头注释/spawn 注释记录根因与 CI 编号。**断言面（SIGTERM → exit 0、四事件序、锁守卫、durable 回读）逐字不变，无 skip/only/todo、无容忍 143 的放宽。** |
| `wiki/raw/task_issue-412_sa3_impl.md` | SA3 固定产物 | 原位更新：iteration 3 根因修复记录 + iteration 4 证据收纳裁决（§Evidence reconciliation）+ iteration 5 清整记录（§iteration 5 清整记录） |
| `artifacts/sa3-issue412-iter3-*.log`（**iteration 4 出口 = 11 份**：3 份已随 `d60760c` 入库 + 8 份保留待入库；**iteration 5 = 其中 8 份仅空白归零，内容逐字不变**） | 仓内 SA3 证据惯例（`git ls-files artifacts/` 既有 215 项） | 证据留档：CI 失败原文、仓内 red 证明、shard 6、persistence 契约、S-5、app 全套、root typecheck、generate --check（+ 已入库的机制 red/green、稳定性 5 连跑、失败探针轨迹）；iteration 5 去 14 处被报空白（8 行尾空白 + 6 EOF 空行），−14 bytes |
| `artifacts/sa3-issue412-iter3-{smoke-run1,smoke-load1..3,smoke-load-run1..14}.log`（18 份，**本轮已从工作区删除**） | 本 dispatch：「只清理冗余生成物」 | 逐次重复同一命令的 stdout 转储（修复前基线 1 + 修复前 4-test 负载 3 + 最终形态负载复跑 14）；其计数/时序/摘要已固化于 §Evidence reconciliation，命令可重放 |

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

## Owner comment 5751613018 / ADR 对齐保持性（iteration 3 记录 + iteration 4/5 复核）

| Owner 要求 | HEAD 证据 | 判定 |
| --- | --- | --- |
| 宿主优雅停机**必须先 `await drain()` 再 dispose**（硬契约） | `docs/adr/0006-server-persistence-docstore.md:270` 无条件条款；`apps/yjs-server/src/app.ts` 停机链 `awaitDrainWithBudget(adapter.drain(), budgetMs)` 结构性先于全仓唯一 `persistenceFiber.dispose()`；file/memory 统一无 kind 特判 | **保持**（本轮 `apps/**/src`、`packages/persistence/**`、`docs/adr/**` diff = 空；SA6 契约切片 21 files/221 tests + S-5 3 tests 重跑全绿） |
| 同步修订 ADR-0006 :86 dispose 定义 | ADR 0006:276「修订并扩展 :86」；dispose 保持 abortive/有损 | **保持** |
| dispose 保持 abortive 时保留分层公开 drain | `contract.ts` `readonly drain?`；`lifecycle.ts` `async drain` | **保持** |
| `retryDelayMs` 独立可配置、缺省保持现行为 | `retryDelayMs?` + 缺省动态回退 `debounceMs`（解析键形状不变） | **保持** |
| 硬契约的可观察失败面不被测试放宽 | 新增回归用例在忙窗下额外断言 `persistence-disposed` → `app-stopped` 尾序；旧形态下该用例红（143） | **强化**（未新增任何容忍码） |

### iteration 4 保持性复核（iteration 4，只读）

本轮零实现改动，硬契约载体逐项现读在位：

| 载体 | 现读证据（HEAD `2c3a486`） | 判定 |
| --- | --- | --- |
| ADR 成文面 | `docs/adr/0006-server-persistence-docstore.md:242`（修订节标题，含 owner comment 5751613018）、**:270**（无条件硬契约：dispose 前必须先 await drain）、**:276**（dispose 对齐条款「修订并扩展 :86」，dispose 保持 abortive/有损） | **在位** |
| 实现强制面 | `apps/yjs-server/src/app.ts:624` `await this.awaitDrainWithBudget(adapter.drain(), budgetMs)` 结构性先于 **:630** 全仓唯一 `await this.persistenceFiber.dispose()`；**:625** 预算尽 `persistence-drain-budget-exceeded` 诚实事件 | **在位** |
| 对外指引 / 词条 | `docs/integration/cordis-plugin-hosting.md:64`、`:458`（硬契约 + 有界排空 + 有损继续）、`:468-473`；`CONTEXT.md:139-141`（完成式排空词条 + `_Avoid_`） | **在位** |
| 验收锚 | `apps/yjs-server/test/smoke-skeleton-red.test.ts` 5 用例（忙窗锚尾序断言在 :397-441 区）；`apps/yjs-server/test/persistence-drain-shutdown.test.ts` S-5a/b/c | **在位** |
| 产品/测试树未被本轮触碰 | `git diff HEAD --stat` = 空；`git status` 唯一变更 = 18 份未跟踪日志删除 + 本报告修改 | **保持** |
| 修复文件零抑制面 | `grep -n "\.skip\|\.only\|\.todo"` = 0 命中；`143` 仅现于 4 处注释（根因记录），无容忍码 | **保持** |

### iteration 5 保持性复核（只读；本 dispatch 要求 hard drain-before-dispose 与 ADR 对齐保持完好）

| 载体 | 本轮现读证据（工作区 = HEAD `2c3a486`） | 判定 |
| --- | --- | --- |
| ADR 成文面 | `docs/adr/0006-server-persistence-docstore.md:242`（修订节标题「完成式排空 drain、retryDelayMs 与停机硬契约修订（2026-09，issue #412；owner 要求 comment 5751613018）」）、**:270**（「停机硬契约（无条件；owner 要求 comment 5751613018）：宿主优雅停机在调用 `dispose()` 之前必须先 await `drain()`」）、**:276**（「`dispose()` 对齐条款（owner 要求 comment 5751613018；本节修订并扩展 :86 的 dispose 定义边界）」） | **在位**（逐行现读） |
| 实现强制面 | `apps/yjs-server/src/app.ts:624` `if (!(await this.awaitDrainWithBudget(adapter.drain(), budgetMs))) {` 结构性先于 **:630** `await this.persistenceFiber.dispose();` | **在位**（逐行现读） |
| 验收锚 | `apps/yjs-server/test/smoke-skeleton-red.test.ts:429` `expect(tailOrder).toEqual(['persistence-disposed', 'app-stopped'])`（:427 过滤、:425 契约注释）；`apps/yjs-server/test/persistence-drain-shutdown.test.ts`（S-5a/b/c）在位 | **在位** |
| 零触碰面 | `git diff HEAD -- packages apps docs .github domains scripts` = 空（rc=0）；`git diff HEAD --stat` = 8 份证据日志（相对 HEAD 新增）+ 3 份 wiki 记录（本报告 + SA8/SA4 记录），非 `wiki/**`/`artifacts/**` 面为空；8 份证据日志相对索引**仅空白差异**（去空白哈希 8/8 MATCH） | **保持** |

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

### iteration 3（修复轮）

| Changed path | ALLOW entry | Purpose |
| --- | --- | --- |
| `apps/yjs-server/test/smoke-skeleton-red.test.ts` | **dispatch 具名失败面**（`test (24, 6)`：`apps/yjs-server/test/smoke-skeleton-red.test.ts` 的 143 观测）+ 设计 §12「建立红→绿可执行覆盖」要求；`domains/AGENTS.md`/skills 未涵盖 app 测试 | harness 形态修复（信号直达）+ red→green 回归锚 |
| `wiki/raw/task_issue-412_sa3_impl.md` | SA3 固定产物（skill §实现报告） | 原位更新 |
| `artifacts/sa3-issue412-iter3-*.log`（29 份） | 仓内 SA3 证据惯例 | 验证证据留档 |

### iteration 4（收纳轮）

| Changed path | ALLOW entry | Purpose |
| --- | --- | --- |
| `artifacts/sa3-issue412-iter3-{smoke-run1,smoke-load1..3,smoke-load-run1..14}.log`（18 份，**删除**） | dispatch 明示：「removing only redundant generated artifacts」 | 移除未被 iteration-3 SA3 声明、逐次重复同一命令的 stdout 转储；计数/时序固化于 §Evidence reconciliation |
| `artifacts/sa3-issue412-iter3-{ci-failure-evidence,smoke-red-proof,shard6-node24,persistence-contract,shutdown-tests,root-typecheck,generate-check,app-suite}.log`（8 份，**保留**） | dispatch 明示：「preserving any necessary reproducible verification evidence」 | 必要证据集，待 Controller 入库；与 iteration-3 SA3 `structured_output.artifactPaths` 声明集逐项一致 |
| `wiki/raw/task_issue-412_sa3_impl.md` | SA3 固定产物（skill §实现报告） | 原位更新为当前实现 + 当前验证结果（含 iteration 4 裁决与逐次负载摘要） |

**iteration 4 DENY 面核对**：`packages/**`、`apps/**`（含被修复测试文件）、`docs/**`、`.github/**`、`domains/**`、`scripts/**`、其余 `artifacts/**`、其他 SA 的 wiki 产物 —— 本轮零写入；`git diff HEAD` = 仅本报告。

**范围申报（交 Controller/SA4 认定，不自行宣告合规）**：设计 §11 **DENY LIST** 含「`apps/yjs-server/test/` 既有测试」条，其立法理由是「四事件序/配置边界/watchdog 锚零改动即绿；S-5 以新增文件承载」。本轮改动的 `smoke-skeleton-red.test.ts` **不属于 #412 的证据锚**（该文件自 `b66615c` Phase 5 起未动、与 #412 变更集零交集），且改动为 **dispatch 直接指名的 CI 失败面**；改动只触 spawn 形态 + 新增回归用例，**不触碰任何 #412 冻结锚的断言**。其余 DENY 面本轮零触碰：`packages/persistence/src/{service,testing}.ts`、`namespace-registry/**`、`dsh-persistence/{record,events,profile,cli}.ts`、persistence 既有测试（含冻结审计）、**SA6 两份契约文件**、其余 apps 既有测试、`docs/protocols/**`、`packages/ws-replication/**`、Host/SA2/SA6/SA8 wiki 产物、`packages/vfsl-codegen/**`、`.github/**`、`domains/vfs3-assets/schema.vfsl`。

### iteration 5（证据清整轮，本 dispatch）

| Changed path | ALLOW entry | Purpose |
| --- | --- | --- |
| `artifacts/sa3-issue412-iter3-{app-suite,generate-check,persistence-contract,root-typecheck,shard6-node24,shutdown-tests}.log`（6 份） | dispatch 明示：只归零 `git diff --cached --check` 在已批准保留的 iteration-3 验证产物上报出的精确缺陷 | 删除 EOF 处多出的空行（`…\n\n` → `…\n`）；其余字节（含全部日志行）不变 |
| `artifacts/sa3-issue412-iter3-{ci-failure-evidence,smoke-red-proof}.log`（2 份） | 同上 | 删除被具名的行尾空白（CI 摘录空行的时间戳行 7 处 + vitest 代码帧空源码行 1 处）；行数不变，除该空白外逐字节不变 |
| `wiki/raw/task_issue-412_sa3_impl.md` | SA3 固定产物（skill §实现报告） | 原位更新：iteration 5 清整记录（§iteration 5 清整记录） |

**iteration 5 DENY 面核对**：`packages/**`、`apps/**`（含被修复测试文件）、`docs/**`、`.github/**`、`domains/**`、`scripts/**`、其余 `artifacts/**`（含 3 份已入库 iter3 日志与其他任务日志）、**8 份日志的日志内容本身**（除被报空白外逐字节保持）、其他 SA 的 wiki 产物 —— 本轮零写入。SA3 未执行 `git add`/`commit`/`push`（角色边界）：索引仍持有清整前 blob，故 `git diff --cached --check` 需由 Controller 重新 `git add` 这 8 份后复跑方为静默（清整后内容的同款检查证据见 §iteration 5 清整记录）。

## Verification（iteration 3，最终文件版本）

| Command | Result | Evidence |
| --- | --- | --- |
| **红证明（仓内）**：临时把 `spawnApp` 还原为 `.bin/tsx` 形态 → `vitest run apps/yjs-server/test/smoke-skeleton-red.test.ts -t "busy event loop"` | ✅ **红（复现 CI 签名）**：`AssertionError: hub (busy window) exit code: expected 143 to be +0`；`Tests 1 failed \| 4 skipped`（跑后文件已还原，`diff` 核验 RESTORED-OK） | `artifacts/sa3-issue412-iter3-smoke-red-proof.log` |
| **机制 red/green（同 app / 同 blocker / 双形态）** | ✅ A 形态 143×3（`app-stopped=false`）；B 形态 0×3（`app-stopped=true`） | `artifacts/sa3-issue412-iter3-relay-redgreen.log` |
| `NODE_OPTIONS=--conditions=nomicore-source vitest run apps/yjs-server/test/smoke-skeleton-red.test.ts --typecheck.enabled=false --passWithNoTests=false`（修复后，连续 5 次） | ✅ **5 files-runs 全绿（每次 5 tests）** | `artifacts/sa3-issue412-iter3-smoke-stability.log` |
| CI `test (…, 6)` 步骤原文：`files=$(node scripts/ci-test-shard.mjs 6 6); NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run $files --typecheck.enabled=false --passWithNoTests=false`（本机 Node v24.13.0） | ✅ **66 files / 746 tests 全绿，exit 0**（CI 基线 745 + 新增 1） | `artifacts/sa3-issue412-iter3-shard6-node24.log` |
| 同 shard 6 命令 + 6 路 CPU 忙循环人工负载（本机 4 vCPU，loadavg 6→18）14 次 | ✅ 14/14 绿（忙窗用例 1.4–3.1s，距 30s 退出窗 10 倍余量） | 逐次日志 `smoke-load-run{1..14}.log` 于 iteration 4 按「冗余生成物」清理；逐次计数/时序固化于 §Evidence reconciliation（命令可重放） |
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

## Evidence reconciliation（iteration 4 的交付）

### 裁决规则（先证后删）

1. **声明面**：iteration-3 SA3 的 `structured_output.artifactPaths` 是工作区产物的权威清单（Controller 侧在案）；**未被声明的文件不构成交付物**。
2. **必要性**：只有当一份日志承载**互不重复的验证主张**（各自独立的闸门/机制/计数）时才保留；同一命令的逐次重复 stdout 转储不构成独立主张。
3. **可复现性**：被清理文件的命令、计数与逐次时序必须在本报告内固化，使主张可重放/审计；产品/测试/DENY 面零触碰。

**报告增量（相对 `d60760c` 版本的评审基线，供下一轮 SA4/SA9/SA10 对照）**：① 头部 iteration 4 记录；② §Existing worktree reconciliation 末条；③ §Changed paths 证据行改为 iteration 4 出口态 + 新增删除行；④ §Owner comment 新增「iteration 4 保持性复核（只读）」表；⑤ §File scope check 拆为 iteration 3/4 两表；⑥ §Verification 负载行改为指向本节；⑦ 新增本节；⑧ §Deferred「1 次未复现失败」条追加收纳注；⑨ §Deviations 新增 iteration 4 范围条；⑩ §Suggested commit message 追加证据提交建议。**未改动任何 iteration 3 的验证结论、计数与判定。**

### 保留集（必要证据：11 份日志 + 本报告 + 被修复测试文件）

| 类别 | Path | 承载主张 | 入库状态 |
| --- | --- | --- | --- |
| CI 失败外证 | `artifacts/sa3-issue412-iter3-ci-failure-evidence.log` | run `35535478371` / job `106143620539` 原文（外部账本，受 CI 日志保留期约束，无法由本仓再生成） | 未跟踪，待入库 |
| 敏感性锚 | `artifacts/sa3-issue412-iter3-smoke-red-proof.log` | 临时还原旧 spawn 形态 → CI 签名逐字复现（`expected 143 to be +0`、`1 failed \| 4 skipped`、`RED-EXIT=1`）+ 还原核验 | 未跟踪，待入库 |
| CI 闸门原文 | `artifacts/sa3-issue412-iter3-shard6-node24.log` | `ci-test-shard.mjs 6 6` + vitest：66 files / 746 tests 绿 | 未跟踪，待入库 |
| 契约闸门 | `artifacts/sa3-issue412-iter3-persistence-contract.log` | SA6 切片 21 files / 221 tests + Type Errors: no errors | 未跟踪，待入库 |
| Owner 硬契约锚 | `artifacts/sa3-issue412-iter3-shutdown-tests.log` | S-5a/b/c 3 tests 绿（drain 先于 dispose 的语义时序） | 未跟踪，待入库 |
| 静态门 | `artifacts/sa3-issue412-iter3-generate-check.log` | `pnpm generate --check` exit 0（无 diff 输出） | 未跟踪，待入库 |
| 类型门 | `artifacts/sa3-issue412-iter3-root-typecheck.log` | root `pnpm typecheck` 15 段 tsconfig exit 0 | 未跟踪，待入库 |
| 模块门 | `artifacts/sa3-issue412-iter3-app-suite.log` | apps 全套 35 files / 183 tests 绿 | 未跟踪，待入库 |
| 机制 red/green | `artifacts/sa3-issue412-iter3-relay-redgreen.log` | 同 app / 同忙窗 blocker：旧形态 143×3（`app-stopped=false`）vs 新形态 0×3（`app-stopped=true`） | **已随 `d60760c` 入库** |
| 稳定性 5 连跑 | `artifacts/sa3-issue412-iter3-smoke-stability.log` | 修复后连续 5 次、每次 5 tests 绿 | **已随 `d60760c` 入库** |
| 失败探针轨迹 | `artifacts/sa3-issue412-iter3-probe-memory.log` | 中间探针模块解析失败 ×3 TIMEOUT（被 relay-redgreen 取代；SA9 M-6 诚实留痕） | **已随 `d60760c` 入库** |

入库建议（Controller 动作，SA3 不执行）：`chore(ci): record issue 412 iter3 verification evidence` —— 上述 8 份未跟踪日志 + 本报告；循 iteration 2 先例（`bdb91cb` 恰为具名闸门日志 5 份）。入库后工作区出口 = `git status` 干净。

### 清理集（冗余生成物：18 份，本轮已从工作区删除）

判据：均为**同一命令的逐次 stdout 转储**，从未被 iteration-3 SA3 声明为交付物，且其主张已被保留集覆盖（修复前/中间态 4 份）或已在本表固化（最终形态 14 份）。

| # | Path（已删除） | bytes | sha256[:12] | 形态 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| 1 | `artifacts/sa3-issue412-iter3-smoke-run1.log` | 1167 | `0c454bb1cde4` | 修复前（4 tests） | 4 passed / 4.83s / 11:12:33 |
| 2 | `artifacts/sa3-issue412-iter3-smoke-load1.log` | 1055 | `7429a93bbbf9` | 修复前（4 tests） | 4 passed / 14.17s / 11:20:54 |
| 3 | `artifacts/sa3-issue412-iter3-smoke-load2.log` | 1055 | `44a61cc19e4d` | 修复前（4 tests） | 4 passed / 12.47s / 11:21:10 |
| 4 | `artifacts/sa3-issue412-iter3-smoke-load3.log` | 1053 | `21603a609466` | 修复前（4 tests） | 4 passed / 11.93s / 11:21:24 |
| 5–18 | `artifacts/sa3-issue412-iter3-smoke-load-run{1..14}.log` | 1247–1249 | `3c5982f4b795` … `f0616f452ab8` | 最终形态（5 tests） | **14/14 绿**；忙窗用例 1417–3141ms；总时长 12.25–24.80s |

最终形态 14 次逐次摘要（Start / 忙窗用例 / Duration）：11:40:40 / 1579ms / 12.25s；11:40:53 / 1523ms / 12.30s；11:41:07 / 1675ms / 12.60s；11:41:21 / 1417ms / 12.88s；11:41:36 / 1622ms / 12.75s；11:41:50 / 2033ms / 13.59s；11:42:06 / 1424ms / 13.09s；11:42:20 / 1523ms / 13.14s；11:42:43 / 2397ms / 21.09s；11:43:06 / 2795ms / 24.53s；11:43:33 / 2585ms / 24.80s；11:43:59 / 3083ms / 24.18s；11:44:25 / 3141ms / 22.33s；11:44:51 / 2046ms / 24.65s。忙窗用例对 30s 退出窗仍保有 ≥9.5 倍余量。

**披露（与 SA9 M-1 的关系，交 Controller/SA9 认定）**：SA9 M-1 建议将「关键验证日志（含 14 份负载复跑）」补入库；本轮回执按 dispatch「保留必要证据、只清理冗余生成物」把逐次负载日志判为冗余生成物并清理，**8 份具名闸门证据仍在工作区且待入库**。原始逐次日志删除后不可恢复：若 Controller 认为其也须入库，需重放 §Verification 表内命令（人工 6 路忙循环）重新生成——本报告已保有其计数与逐次摘要，判断依据与计数事实零丢失。

**未触碰面**：`packages/**`、`apps/**`、`docs/**`、`.github/**`、`domains/**`、`scripts/**`、其余 `artifacts/**`（215 份 tracked）、其他 SA 的 wiki 产物 —— `git diff HEAD` 仅本报告。

### iteration 4 复核运行（工作区出口态）

| Command | Result |
| --- | --- |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run apps/yjs-server/test/smoke-skeleton-red.test.ts apps/yjs-server/test/persistence-drain-shutdown.test.ts --typecheck.enabled=false --passWithNoTests=false` | ✅ 2 files / **8 tests 全绿**（修复后 smoke 5 + S-5 3）；忙窗锚 1361ms |
| `pnpm exec tsc -p apps/yjs-server/tsconfig.json --noEmit` | ✅ exit 0 |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/persistence/test` | ✅ 21 files / 221 tests、Type Errors: no errors |
| `git status --porcelain --untracked-files=all` | ✅ `M wiki/raw/task_issue-412_sa3_impl.md` + 8 份保留证据日志（未跟踪）；产品/测试面 0 变更 |
| `git diff HEAD --stat` | ✅ 仅 `wiki/raw/task_issue-412_sa3_impl.md` |

## iteration 5 清整记录（`git diff --cached --check` 归零）

### 被报缺陷（清整前 `git diff --cached --check` 归类）

索引入口态 = Controller 已 `git add` 的 8 份保留日志（状态 `A `）+ 3 份 wiki 记录；检查器共报 **14 处**缺陷，全部落在 8 份日志，wiki 记录零命中。下表 `␠` 为显式标记的 U+0020 行尾空白（仅为可读性，**本报告不含尾随空白**）：

| # | Path（`artifacts/sa3-issue412-iter3-…`） | 行号 | 缺陷类型 | 被报行（`␠` = U+0020） |
| --- | --- | --- | --- | --- |
| 1 | `app-suite.log` | 124 | new blank line at EOF | —（末行空行） |
| 2 | `ci-failure-evidence.log` | 19, 21, 24, 27, 28, 33, 34 | trailing whitespace ×7 | `401-2026-09-20T20:25:55.4494239Z␠`、`403-…4495713Z␠`、`406-…4507957Z␠`、`423-…4574361Z␠`、`424-…4577377Z␠`、`429-…4598070Z␠`、`430-…4599396Z␠`（CI 摘录中的空行） |
| 3 | `generate-check.log` | 4 | new blank line at EOF | —（末行空行） |
| 4 | `persistence-contract.log` | 33 | new blank line at EOF | —（末行空行） |
| 5 | `root-typecheck.log` | 4 | new blank line at EOF | —（末行空行） |
| 6 | `shard6-node24.log` | 189 | new blank line at EOF | —（末行空行） |
| 7 | `shutdown-tests.log` | 14 | new blank line at EOF | —（末行空行） |
| 8 | `smoke-red-proof.log` | 31 | trailing whitespace ×1 | `    155|␠`（vitest 代码帧的空源码行） |

### 清整动作（索引版 → 工作区版，仅空白）

| Path（`artifacts/sa3-issue412-iter3-…`） | 索引 lines/bytes | 工作区 lines/bytes | Δlines / Δbytes | 去空白内容哈希 sha256[:16]（索引 == 工作区） |
| --- | --- | --- | --- | --- |
| `app-suite.log` | 124 / 20763 | 123 / 20762 | −1 / −1 | `a366528812f35a5a` == 同值 |
| `ci-failure-evidence.log` | 43 / 4536 | 43 / 4529 | 0 / −7 | `d2082a3265ffea33` == 同值 |
| `generate-check.log` | 4 / 155 | 3 / 154 | −1 / −1 | `d7d3ff9b93e3ff77` == 同值 |
| `persistence-contract.log` | 33 / 2143 | 32 / 2142 | −1 / −1 | `a6ef2ba351ab9878` == 同值 |
| `root-typecheck.log` | 4 / 767 | 3 / 766 | −1 / −1 | `5d37cf4f88b777b6` == 同值 |
| `shard6-node24.log` | 189 / 18155 | 188 / 18154 | −1 / −1 | `d954341f1e14045a` == 同值 |
| `shutdown-tests.log` | 14 / 736 | 13 / 735 | −1 / −1 | `719925b2775ab5ce` == 同值 |
| `smoke-red-proof.log` | 42 / 2415 | 42 / 2414 | 0 / −1 | `5f9a6ea122bab4c0` == 同值 |

字节差与缺陷计数逐份守恒：6 份 EOF 类各 −1 byte（删一个多余换行）+ 7 处行尾空白 −7 bytes + 1 处 −1 byte ⟹ 合计 −14 bytes = 14 处被报缺陷，**无任何非空白字节变化**。

### 清整后验证（工作区出口态）

| Command | Result | 说明 |
| --- | --- | --- |
| `git diff --no-index --check /dev/null <逐份>`（同款规则，两种内容对照） | ✅ **工作区版（清整后）8/8 静默、rc=1**；**索引 blob 版（清整前）8/8 报缺陷、合计 14 处、rc=3** | 与 `git diff --cached --check` 逐行同源：从索引 blob 还原后逐份报 `app-suite:124`、`ci-failure-evidence:19,21,24,27,28,33,34`、`generate-check:4`、`persistence-contract:33`、`root-typecheck:4`、`shard6:189`、`shutdown-tests:14`、`smoke-red-proof:31` |
| `grep -nP '[ \t]+$' <8 份>` | ✅ 零命中（rc=1） | 行尾空白归零 |
| `tail -c 2 <8 份>` | ✅ 均为 `<非换行字符>\n`，无 `\n\n` | EOF 空行归零 |
| `git show :<path> \| tr -d '[:space:]' \| sha256sum` vs 工作区同款 | ✅ **8/8 MATCH** | 索引版 ↔ 工作区版**仅空白差异** ⟹ 日志内容逐字保持 |
| `git diff --cached --numstat -- artifacts/` | ✅ 8 份均 `N 0`（索引相对 HEAD 为纯新增） | 无删除行 |
| `git status --porcelain -uall` | ✅ 8 份 `AM`（索引新增 + 工作区空白归零）+ 本报告 `MM`；另有 Controller 已 staged 的 2 份 SA 记录 `M `（`..._sa4_review.md`、`..._implementation_conflict_report.md`，本轮未触碰） | 产品/测试/文档面零变更 |
| `git diff HEAD --stat -- packages apps docs .github domains scripts` | ✅ 空 | 已评审修复（`d60760c`）与 Owner 硬契约载体零触碰 |
| `git diff --cached --check`（**索引未重写**） | ⏳ 仍报原 14 处 | **预期且已披露**：SA3 角色边界禁 `git add`，索引仍持清整前 blob；Controller 重新 `git add` 上述 8 份后该命令即静默（内容侧等价证据 = 上表首行 8/8 静默） |

**内容保持性说明**：清整只动空白，未增删任何日志行内容、未改任何计数、时序、退出码或判定文字——`smoke-red-proof.log` 的 `RED-EXIT=1`、`ci-failure-evidence.log` 的 `##[error]` 与测试总结数、各日志的 `Start at`/`Duration`/`Tests` 行均逐字保持；Owner 硬契约（drain-before-dispose）与 ADR 对齐在本轮零触碰。

## Deferred verification

- **CI 权威复跑**：`test (20, 6)` / `test (24, 6)`（以及整体 run）需 Controller 触发；本机 Node 20/24 均以 job 步骤原文或替身验证绿，但真实 runner 的 4 vCPU 并行剖面以 CI 为准。
- **其余 13 个仍用 `.bin/tsx` 形态的 apps 既有测试**（`host-namespace-delete-sa7-dynamic`、`diagnostic-replay-*`、`stdin-error-chain-red`、`hub-restart-static-target-red`、`on-fatal-error-process-issue288`、`host-*` 等，均含 SIGTERM 断言）暴露在**同一 30ms 转达窗**下：本轮 dispatch 只具名 `smoke-skeleton-red.test.ts`，未扩大改动面。建议后续变更集统一改用 `node --import tsx` 直跑形态（一行替换）或抽公共 spawn 助手——**交 SA1/Controller 决策**。
- 真正的外部消费者（nomic-server）行为、真实慢盘/生产停机时长画像：属 SA4/SA7 动态验证面。
- 设计 §13 残余/follow-up 不变：DSH 记录头携带 `retryDelayMs` 的 golden 立法、yjs-server 配置面暴露 `retryDelayMs`、nomic-server 仓库外替换固定睡眠、archive×delete 既有理论挂起的专项系统性测试。
- `apps/yjs-server/AGENTS.md` 单一拆卸链摘要行未逐字反映新增等待步——残余文档债。
- 本轮人工 4 倍超订负载实验中出现过 **1 次未复现的失败**（过滤输出为 `1 failed | 4 passed`，其中未见 `143` 字样 ⟹ 非退出码不符，疑为负载下的等待超时/端口竞态）；随后 17 次等量或更重负载（loadavg 6→18，`smoke-load1..3` + `smoke-load-run1..14`）+ 1 次 shard 6 + 9 次常规全绿均未复现。**该轮次只留了命令行过滤输出且已被最终稳定性复跑覆盖（原始文件未留档）**；如实登记，不作结论。**iteration 4 收纳注**：上述 17 次负载的逐次 stdout 转储（`smoke-load1..3` + `smoke-load-run1..14`）已按本轮 dispatch 作为冗余生成物从工作区清理，逐次计数与耗时固化于 §Evidence reconciliation（事实与结论不变）。

- **iteration 5 遗留动作（Controller 侧）**：重新 `git add` 上述 8 份日志（+ 本报告）后复跑 `git diff --cached --check`，预期静默（内容侧等价证据已由 `git diff --no-index --check /dev/null` 8/8 静默给出）；SA3 不执行 stage/commit。

## Deviations or blockers

- **无阻塞**。设计可实施、ALLOW/DENY 明确（唯一范围申报见 §File scope check）、红线可执行。
- **唯一偏离**：修复落在 `apps/yjs-server/test/smoke-skeleton-red.test.ts`（设计 DENY 目录内的既有测试文件），依据是 dispatch 直接指名该文件为失败面 + 「建立可执行 red→green 覆盖」要求；已按 skill §实施前检查申报，未自行认定合规，请 Controller/SA4 裁定。
- 未修改任何产品代码、未改断言语义、未加 skip/only/todo、未引入 env override 或 fallback；143 未被容忍（新增用例反而把「旧形态 143」钉成确定红）。
- **iteration 4 范围**：本轮唯一写入 = 删除 18 份未被声明的未跟踪冗余日志 + 本报告原位更新。`artifacts/**` 属仓内 SA3 证据惯例目录，非设计 §11 两表内的产品/测试面，不构成 DENY 触碰；无新增依赖、无实现改动、无断言语义变化。**已评审的 `d60760c` 产品/测试修复逐字节保持**（`git diff HEAD` = 仅本报告）。
- **iteration 5 范围**：本轮唯一写入 = 8 份已批准保留日志的空白归零（14 处具名缺陷：8 处行尾空白 + 6 处 EOF 空行）+ 本报告原位更新。未改日志内容/计数/时序/退出码/判定文字，未改产品/测试/文档任何字节（`git diff HEAD -- packages apps docs .github domains scripts` = 空；`d60760c` 逐字节保持），未新增/删除任何证据文件，未执行 `git add`/`commit`/`push`（索引重写留给 Controller，见 §Deferred verification）。

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

**iteration 4 建议提交（无实现改动；若 Controller 采纳 §Evidence reconciliation 的保留集，SA3 不执行 commit）**：

```
chore(ci): record issue 412 iter3 verification evidence

保留 iteration-3 具名闸门证据 8 份：CI 失败原文（run 35535478371）、
仓内 red 证明、shard 6（66/746）、persistence 契约（21/221 + 无类型错）、
S-5 停机锚（3）、app 全套（35/183）、root typecheck、generate --check。
清理 18 份逐次重复的 stdout 转储（修复前基线 1 + 修复前 4-test 负载 3 +
最终形态负载复跑 14），其计数与逐次时序已固化于 SA3 报告
「Evidence reconciliation」节；产品/测试树零改动（d60760c 逐字节保持）。
```

**iteration 5 补充（同一次 `chore(ci)` 入库提交，提交信息无需变化）**：上述 8 份日志已按 `git diff --cached --check` 归零——仅去 8 处行尾空白 + 6 处 EOF 空行（合计 −14 bytes），日志内容逐字不变（去空白哈希 8/8 MATCH，见 §iteration 5 清整记录）。

**iteration 1（已由 Controller 提交，此处留档）**：`9094760 fix(codegen): refresh generated vfs3 assets`；`75bd0ab feat(persistence): add completion drain lifecycle`。
