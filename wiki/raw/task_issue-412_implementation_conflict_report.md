# SA8 实现后冲突复审 — issue #412（CI smoke-harness 修复轮；implementation）

- 复审对象：**implementation**——工作区当前未提交的 **SA3 CI smoke-harness 修复变更集**（`git status`/`git diff` 全量核对：恰 2 个修改文件 `apps/yjs-server/test/smoke-skeleton-red.test.ts`（+92/−5）与 `wiki/raw/task_issue-412_sa3_impl.md`（SA3 固定产物原位更新）+ 29 份未跟踪证据日志 `artifacts/sa3-issue412-iter3-*.log`），对照 ADR 全集、CONTEXT.md、规范协议/集成文档、模块 AGENTS、CI 门禁定义、已批准设计（design iteration 2，SA2 approve）与 issue #412 停机耐久约束
- 仓库 / worktree：`/home/wangjian/nomicore-fix-issue-412`（分支 `mabf/issue-412`，HEAD = `f3b13ee`；#412 主体实现 `75bd0ab` 与 codegen 修复 `9094760` 均在其历史内且逐字节保持）
- SA8 dispatch：`sa-bf993d19-0db8-4835-874c-6f92a7456807`（phase: conflict-gate，iteration 4）；dispatch 问题域 = 「SA3 CI smoke-harness 修复 vs ADR/规范文档/issue #412 停机耐久约束」+ 确认 Owner comment `5751613018`（updated `2026-09-20T18:03:36Z`）的 drain-before-dispose 硬契约与 ADR 对齐保持完好
- **原位更新说明**：本文件前身两轮（iteration 0 复审 #412 主体实现 → clear / requiresConflictRecheck false，对象已提交为 `75bd0ab`；iteration 1 复审 codegen-freshness 修复 → clear / false，对象已提交为 `9094760`）均已闭合，结论不在此堆叠；本报告只裁决**当前被审对象** = smoke-harness 修复增量 diff（修复 CI run `35535478371` `test (24, 6)` 的 `peer exit code: expected 143 to be +0` flake）

---

## 1. Reviewed subject

**implementation**——修复 CI smoke flake 的最小测试侧变更集（未提交 diff）：

1. `apps/yjs-server/test/smoke-skeleton-red.test.ts`：
   - `spawnApp` 由 `spawn(node_modules/.bin/tsx, [MAIN_TS, …])` 改为 `spawn(process.execPath, ['--import', 'tsx', MAIN_TS, …], { cwd: REPO_ROOT, … })` 直跑（信号直达 app 进程自身的 SIGTERM handler，不再经 tsx CLI 包装进程的 30ms 回执转达窗）；新增可选 `appNodeOptions` 注入缝（经 `NODE_OPTIONS` 追加 node 选项）；
   - 新增第 5 个用例「SIGTERM 直达 app 进程：忙窗内送达仍完成排空链 → exit 0」：运行时写入 tmp dir 的 blocker 模块（`--import` 注入，零新增仓内 fixture）周期阻塞 app 事件循环 400ms/415ms，用例据此把 SIGTERM 精确送进忙窗，断言 exit 0 + `app-stopped` 出现 + `persistence-disposed` 严格先于 `app-stopped`（Owner 5751613018 硬契约尾序锚）；
   - 头注释/`spawnApp` 注释记录根因（tsx CLI 包装进程 30ms 回执窗 → SIGKILL + exit 143）与 CI run 编号；
   - **既有 4 个用例的断言面逐字不变**（四事件外的启动序、SIGTERM exit 0、锁守卫、durable 回读、401/403/101）；无 `.skip`/`.only`/`.todo`；`143` 在文件中仅出现于注释（根因记录），无任何断言容忍 143。
2. `wiki/raw/task_issue-412_sa3_impl.md`：SA3 固定产物原位更新（iteration 3 根因诊断/修复/验证记录）——wiki/raw 为证据层（docs/AGENTS.md Authority），非决策面。
3. `artifacts/sa3-issue412-iter3-*.log`（29 份，未跟踪）：仓内既有 SA3 证据惯例（`git ls-files artifacts/` 既有 200+ 项）。

产品树零改动：`git diff HEAD --stat` 中 `packages/**`、`apps/yjs-server/src/**`、`docs/**`、`.github/**`、`domains/**` 输出为空。

SA8 职责边界：只裁决与既有决策集的冲突、演进义务与冻结面保持；不判断测试充分性/时序稳健性/flake 根因诊断对错（SA4/SA7 面）；不运行测试——所有事实以只读方式独立核对（diff 全量、tsx 源码、app 源码、ADR/协议/设计文本、gh 拉取的 Owner 评论）。

## 2. Inputs and decision set

| 输入 | 状态 | 说明 |
| --- | --- | --- |
| 当前 diff（被审对象） | 已全量读取 | `git diff HEAD`（2 文件）+ 被改测试文件全文阅读 + `git status --porcelain`（恰 2 修改 + 29 未跟踪证据日志） |
| **Issue #412 + Owner comment 5751613018** | 已独立拉取（`gh api`；id/时间戳/作者核对一致：created=updated=`2026-09-20T18:03:36Z`，welltop-jim-wang，MEMBER） | 硬契约三件套：①「宿主优雅停机必须先 await drain() 再 dispose」为**硬性契约**（非参考建议）；②同步修订 ADR-0006 :86 dispose 定义；③dispose 保持 abortive 时保留分层公开 drain（另支持 retryDelayMs 解耦、缺省保持现行为）——①②③ 载体全部在 `75bd0ab` 提交态，本轮只需确认未被 harness 修复破坏 |
| ADR 0006（含 #412 修订节） | 已读（:242-282 HEAD 现读） | 修订节七条：:270 停机硬契约（无条件）、:276 dispose 对齐（修订并扩展 :86）、drain 语义/retryDelayMs 解析形状/liveness 不变量等 |
| ADR 全集（0001–0030） | 状态核对 | 全部 accepted、无 superseded（0008/0010 为 0017 增补式修订）；无任何 ADR 治理测试 spawn 形态或 CI harness |
| `docs/protocols/instance-replication-v1.md`、`docs/adr/0010-*` | 已读（相关节） | 复制/停机 drain 的规范 wire 契约——smoke 断言面（认证 401/403/101、verify-write 收敛、回读、SIGTERM exit 0）所锚定的规范面，本轮零触碰 |
| `docs/integration/hub-peer-deployment.md` :36-41/:287-288 | 已读 | stdout NDJSON 生命周期事件词表与四事件序 `replication-drained → registry-stopped → persistence-disposed → app-stopped` 的成文载体 |
| `docs/integration/cordis-plugin-hosting.md` :458 | 已读 | 宿主指引侧的同一硬契约（「dispose() 之前必须先 await drain()」） |
| CONTEXT.md「完成式排空（drain）」词条（:139-141） | 已读 | 含 `_Avoid_`（flush-all/force-sync/定时排空窗/把 drain 并进 dispose）——本轮零触碰 |
| `apps/AGENTS.md` + `apps/yjs-server/AGENTS.md` | 已读（全文） | 模块决策集合组成：graceful shutdown 契约测试保持绿为完成门；单一拆卸链（含 persistence dispose 步、禁第二条并发拆卸链）；stdout 严格 NDJSON 生命周期事件通道 |
| `wiki/raw/task_issue-412_design.md`（iteration 2，SA2 approve） | 已读（§11 ALLOW/DENY、B17 事件面规范、§12 S-5、L4） | DENY 含「`apps/yjs-server/test/` 既有测试（冻结锚）」——被改文件落在该路径类目内（见 R5 裁决）；B17：词表新增事件不破坏四事件序冻结断言 |
| `wiki/raw/task_issue-412_sa3_impl.md`（iteration 3 版） | 已读 | 根因诊断（tsx CLI 30ms 回执窗）、修复动作、唯一范围申报与验证记录；其声明经本报告独立复核 |
| `wiki/raw/task_issue-412_sa2_review.md`、`..._sa4_review.md`、`..._sa9_standards.md`、`..._sa10_spec.md` | 已读（结论面） | iteration 0/1 审查结论（approve ×3）；本轮被审对象不在其审查范围内，其修订映射（SA2-1~SA2-13）载体零触碰 |
| 本文件前身两轮 SA8 报告 + 前置门禁/设计复审报告 | 已读 | 约束谱系（D1-D19、O1-O3、action 2/4/5）：均已随 `75bd0ab`/`9094760` 落地闭合；本轮只需确认零回退 |
| `.github/workflows/ci.yml`（test 矩阵）、`scripts/ci-test-shard.mjs`、`.github/ci/test-durations.json` | 已读 | CI 门禁定义与分片来源；工作流零触碰 |
| 事实核对源 | 只读 | `node_modules/tsx/dist/cli.mjs`（tsx 4.23.12，lock 固定）`relaySignals`/`waitForSignalFromChild` 机制原文；`apps/yjs-server/src/main.ts:214-216`（唯一 SIGTERM 注册点）；`apps/yjs-server/src/app.ts:620-637`（排空→dispose→事件序）；`apps/yjs-server/test/root-lock-atomic-reclaim-red.test.ts:34`（`--import tsx` 仓内先例）；`node_modules/tsx/package.json`（4.23.12） |

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（实际 diff） | Classification | Evidence | Required action |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | **Owner comment 5751613018 要求① + ADR 0006:270（停机硬契约）** | 「宿主优雅停机在调用 dispose() 之前必须先 await drain()——硬性契约，非参考建议」 | 硬契约全部载体（`app.ts` 停机链 `awaitDrainWithBudget(adapter.drain(), budgetMs)` 结构性先于全仓唯一 `persistenceFiber.dispose()`、ADR 0006:270 条款、CONTEXT 词条、两份集成文档）**逐字节零触碰**（`git diff` 上述路径为空）。新增忙窗用例反而把硬契约做成**可执行回归锚**：SIGTERM 送进事件循环忙窗 → 阻塞结束仍完成 `drain → dispose → app-stopped → exit 0`，并断言尾序 `['persistence-disposed', 'app-stopped']`——与产品真实链（app.ts:620-637：排空（预算事件仅预算尽时）→ fiber.dispose → `persistence-disposed` → 根 fiber dispose → `app-stopped`）及 ADR 0006:270 的可观察退出语义一致；spawn 形态修复使该断言度量的是**应用自身**的信号处理，而非包装进程的转达竞态 | no-conflict（且为硬契约可观察面的强化） | `git diff HEAD --stat`（产品路径全空）；app.ts:620-637 现读；ADR 0006:270 现读；测试新用例 :397-432；`gh api` 评论原文 | 无 |
| R2 | Owner comment 5751613018 要求② + ADR 0006:276（dispose 对齐条款） | 「:86 dispose 定义修订并扩展；dispose 语义不变且保持 abortive/有损，从来不是持久性屏障；分层公开 drain 不与 dispose 合并」 | 零触碰：diff 不含 `packages/persistence/**`、`docs/adr/**`；新用例只断言 dispose **在链内完成**（`persistence-disposed` 先于 `app-stopped`），未把 dispose 断言成持久性屏障、未改变其 abortive 语义 | no-conflict | `git diff`；ADR 0006:276 现读；测试 :426-429 | 无 |
| R3 | Owner comment 5751613018 要求③（分层公开 drain + retryDelayMs 解耦缺省兼容） | `contract.ts` `readonly drain?` optional；`lifecycle.ts` 公共 `drain(targets?)`；`PersistenceSchedule.retryDelayMs?` 缺省动态回退不物化 | 零触碰：`packages/persistence/**`、两份 SA6 契约文件（`persistence-issue-412-drain-red.test.ts` / `-surface.test-d.ts`）均在提交态未被本轮 diff 列出；新用例不触 drain 的 API 面（经 app 停机链间接行使） | no-conflict | `git status --porcelain`（仅 2 修改文件）；SA6 契约文件不在 diff | 无 |
| R4 | `apps/yjs-server/AGENTS.md`（模块决策集合） | ①完成门「graceful shutdown and cross-package contract tests to remain green」；②「Single disposal chain…persistence dispose…Never trigger a second concurrent teardown chain」；③「stdout is a strict NDJSON lifecycle-event channel」 | ①spawn 形态修复**保住**而非放宽 graceful-shutdown 锚：既有 SIGTERM → exit 0 断言逐字保留，转绿的途径是把信号送达修复为直达 app 进程（消除测量仪器竞态），非放宽被测语义；②新用例单发一次 SIGTERM，走 app 唯一 handler（main.ts:214）→ 单一停机链，无第二条拆卸链；③blocker 为**测试注入模块**（NODE_OPTIONS `--import`，tmp dir 运行时生成）向 app 进程 stdout 写合法 NDJSON 行（`busy-window-start`），产品自身的通道纪律与事件发射零变化（产品代码零 diff）；`isAppProcess` 守卫将忙窗限制在被测 app 进程。既有残余文档债（AGENTS 单一拆卸链摘要行未逐字反映 drain 等待步）系 iteration 0 起已登记事项，本轮未触碰亦未加重 | no-conflict | AGENTS 全文；diff（产品零改动）；main.ts:214-216；测试 :229-254（blocker 源）、:407-419 | 无（残余文档债沿用既有登记） |
| R5 | #412 设计 §11 DENY（文件范围纪律）+ 文件头「[SA6 owned] T3-skeleton」标记 | DENY 条目（设计 :466）：「`apps/yjs-server/test/` 既有测试（ordered-shutdown-red、app-config-red、lifecycle-watchdog-red、issue270-* 等）｜冻结锚｜四事件序/配置边界/watchdog 锚零改动即绿（B10/B17）；**S-5 以新增文件承载**」 | 被改文件落在 DENY 路径类目内（枚举例不含本文件），但该条的**立法理由完整保持**：(a) 全部冻结锚断言逐字节零改动——本文件既有 4 用例的断言体（启动序 `provisioned→listening→ready`、SIGTERM 双进程 exit 0、锁守卫 exit 1 + lock 匹配、durable 回读 41、401/403/101）在 diff 中逐字未动，仅 `spawnApp` 内部形态与注释变化；(b) S-5 证据仍由新增文件 `persistence-drain-shutdown.test.ts`（`75bd0ab` 提交态，零触碰）承载，新增的第 5 用例是 dispatch 直接指名的 CI 失败面回归锚，不是 S-5 证据；(c) 「[SA6 owned]」历史标记保留，其冻结对象（断言面）未被触碰。改动权属 = 本轮 dispatch 明示修复指令（具名该测试文件的 143 失败）；设计 ALLOW/DENY 属 SA1 任务范围纪律而非 ADR/CONTEXT/协议决策文本，越范围认定权在 Controller——SA3 已按 skill 申报且未自行宣告合规 | no-conflict（决策基线；范围申报事项交 Controller 认定） | 设计 :454（S-5 承载文件）、:466（DENY 条目）；diff（断言体零变化）；`git status`（persistence-drain-shutdown.test.ts 零触碰）；SA3 报告 §File scope check 申报 | 范围认定交 Controller（见 §8 行动 1）；无决策文本需修订 |
| R6 | 设计 B17 事件面规范 + `hub-peer-deployment.md:36-41/:287-288`（四事件序冻结） | 四事件序 `replication-drained → registry-stopped → persistence-disposed → app-stopped` 由 `ordered-shutdown-red.test.ts:77-91` findIndex 严格递增断言冻结；**词表新增事件不破坏该断言** | 四事件序冻结锚文件零触碰；新用例断言的尾序 `persistence-disposed → app-stopped` 是冻结序的**子序列**且与 :287-288 成文一致；`busy-window-start` 为测试注入事件而非产品词表新增（产品事件发射零 diff），连 B17 的词表免疫条款都无需动用 | no-conflict | 设计 :55（B17）；hub-peer-deployment.md:36-41/:287-288；app.ts:632-635；diff（产品零改动） | 无 |
| R7 | CI 门禁定义（`.github/workflows/ci.yml` test 矩阵 / codegen-freshness）+ 测试断言纪律 | CI 门禁步骤原文（`node scripts/ci-test-shard.mjs N 6` + vitest、`pnpm generate --check`）为验收执行器；测试不得以 skip/only/放宽断言换绿 | 工作流/分片脚本/时长表零触碰；被改文件无 `.skip`/`.only`/`.todo`（全文核对）；`143` 仅现于注释（根因记录），无任何断言值被改为 143 或容忍 143——相反，按 SA3 红证明（`artifacts/sa3-issue412-iter3-smoke-red-proof.log`：旧 spawn 形态下新用例确定红 `expected 143 to be +0`），新锚把「包装进程腰斩排空链」钉成**确定红**，门禁因而是净强化：flake 被以「修复测量仪器」而非「放宽被测契约」消除 | no-conflict | `git status`（`.github/**`、`scripts/**` 零触碰）；测试全文（无 skip/only/todo；143×5 全在注释）；SA3 红证明日志 | 无 |
| R8 | 注释诚实性约束谱系（前置门禁 action 4 一脉：技术注释必须与被引事实一致） | 测试注释对 tsx CLI 机制的断言：包装进程转发信号后「只留 30ms 回执窗（`relaySignals` → `waitForSignalFromChild`）…回执迟到即 SIGKILL 子进程 + 包装进程 `process.exit(128+15)` = 143」 | 注释事实**独立复核属实**：`node_modules/tsx/dist/cli.mjs`（tsx 4.23.12，lock 固定）`relaySignals` 实现原文——`waitForSignalFromChild` 以 `setTimeout(…, 30)` 设窗；首个窗内未收到子进程回执即 `t.kill(r)` 转达，第二个 30ms 窗仍未收到则 `t.on('exit', …) + t.kill('SIGKILL')` 且包装进程 `process.exit(128 + signals[r])`（SIGTERM=15 → **143**）；「信号直达 app 自身 handler」由 main.ts:214 唯一注册点 + 新形态 `node --import tsx` 直跑（无包装进程）成立；`--import tsx` 形态有仓内先例（`root-lock-atomic-reclaim-red.test.ts:34` `execArgv: ['--import', 'tsx']`）且与发布产物 `bin` 直跑 `dist/main.js` 同形 | no-conflict | cli.mjs 原文（本报告 §2 已引）；tsx package.json 4.23.12；root-lock-atomic-reclaim-red.test.ts:34；apps/yjs-server/package.json `bin` | 无 |
| R9 | ADR 0010 + `docs/protocols/instance-replication-v1.md`（复制/停机 drain 规范 wire 契约） | smoke 所锚规范面：认证（升级前恰一次 bearer 校验）、verify-write 收敛、hub 回读、SIGTERM 有序停机 exit 0、watchdog 纪律 | smoke 的全部 wire/协议断言逐字未动（diff 仅 spawn 机制）；`packages/ws-replication/**`、`docs/protocols/**` 零触碰；watchdog 面零触碰 | no-conflict | diff；`git status` | 无 |
| R10 | 决策集全谱核对（ADR 0001–0030 状态 + CONTEXT 词条 + 根 AGENTS 决策面） | 全部 ADR accepted、无 superseded；CONTEXT「完成式排空（drain）」词条（:139-141，含 `_Avoid_`）；根 AGENTS typed-writes/schema 授权纪律 | 无任何 ADR/CONTEXT/协议/模块 AGENTS 条款治理测试 spawn 形态、NODE_OPTIONS 测试注入缝或 blocker fixture——本 diff 不落入任何决策文本的管辖面；`domains/**`、schema.vfsl、生成物零触碰（typed-access 义务面未触及）；CONTEXT 词条零触碰 | no-conflict | ADR 状态核对；CONTEXT.md:139-141 现读；`git status` | 无 |

裁决分布：**no-conflict 10（R1–R10）/ implements-existing-decision 0 / evolution-required 0 / hard-conflict 0**（共 10 行对照；R1 为硬契约可观察面的强化，R5 含一项交 Controller 的范围申报）。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
| --- | --- | --- | --- |

**无。** 本修复未主张、也未需要任何决策 override：

- 设计 §11 ALLOW/DENY 是 SA1 任务范围纪律（非 ADR/CONTEXT/协议决策文本）；对 DENY 路径类目内既有测试的本次修改，其权属来自本轮 dispatch 的明示修复指令（Controller 的任务授权文书），属**范围认定**事项而非决策 override——SA8 不替 Controller 认定范围，仅裁决无决策文本被抵触（R5），并已由 SA3 透明申报；
- 无 ADR supersede、无协议版本升级、无 Owner override 主张；Owner comment 5751613018 的三要求载体（ADR 0006 修订节、app 停机链、分层 drain、retryDelayMs 形状）全部保持提交态。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（实际 diff 核对） |
| --- | --- | --- | --- |
| 四事件序冻结锚 `ordered-shutdown-red.test.ts:77-91`（findIndex 严格递增）及其余 DENY 枚举锚（app-config-red、lifecycle-watchdog-red、issue270-* 等） | 零改动即绿 | `git status --porcelain`（文件不在 diff） | **保持** |
| `smoke-skeleton-red.test.ts` 既有 4 用例断言面：启动序 `provisioned→listening→ready`（含 port 0 实际端口）、SIGTERM 双进程 exit 0、锁守卫（exit 1 + lock 匹配）、durable 回读 41、401/403/101 | 逐字不变（含超时预算 30_000/60_000/180_000） | diff（断言体与用例参数零变化；仅 `spawnApp` 内部、`TSX_BIN` 常量删除、注释与末尾追加新用例） | **保持** |
| #412 硬契约载体：`app.ts`/`main.ts`/`config.ts`、`packages/persistence/**`、`packages/dsh-persistence/**`、ADR 0006 修订节（:242-282）、CONTEXT.md 词条、两份集成文档、两份 SA6 契约测试文件、persistence/yjs-server 既有测试 | 与 `75bd0ab` 提交态逐字节一致 | `git diff HEAD`（上述全部路径输出为空） | **保持** |
| stdout NDJSON 生命周期事件词表（hub-peer-deployment.md:36-41）与四事件序成文（:287-288） | 产品事件发射与词表零变化 | diff（产品代码零改动）；`busy-window-start` 系测试注入事件，不入词表 | **保持** |
| CI 门禁定义：`.github/workflows/ci.yml`（test 矩阵/codegen-freshness）、`scripts/ci-test-shard.mjs`、`.github/ci/test-durations.json` | 零触碰 | `git status` | **保持** |
| tsx 依赖钉版 4.23.12（lock） | 未改动 | `git status`（lock 零触碰）；node_modules/tsx/package.json | **保持** |
| 测试断言纪律 | 无 skip/only/todo、无误改断言值（143 不被容忍） | 测试全文核对（`143`×5 全在注释） | **保持** |

## 6. Evolution requirements

**无。** 本修复为纯测试侧 harness 形态修复 + 回归锚新增：不改任何决策文本、协议、公共 API、schema、持久化格式、状态机、生命周期或失败语义——不存在需要修订计划的事项。

- spawn 形态从 `.bin/tsx` CLI 到 `node --import tsx` 直跑的变化只存在于**测试 harness 内部**，被测产品契约（SIGTERM → 排空链 → exit 0、四事件序、锁守卫）零变化，且与仓内既有先例（`root-lock-atomic-reclaim-red.test.ts:34`）及发布产物形态（`bin` 直跑 `dist/main.js`）同款，不构成需要立法的新模式；
- 新增忙窗锚及 `appNodeOptions` 注入缝是测试专用面（不改产品代码），无决策文本管辖，亦无需演进。

## 7. Hard conflicts

**无。** 特别核对：

- **不是门禁削弱**：143 从未被容忍；既有断言逐字保留；新锚在旧 spawn 形态下确定红（SA3 红证明），即「包装进程腰斩排空链」从此被 CI 钉住——门禁净强化；
- **不是硬契约侵蚀**：drain-before-dispose 硬契约的全部成文与实现载体逐字节保持；新用例把该契约在「信号送达时事件循环正忙」这一不利条件下做成可执行锚（尾序 `persistence-disposed` → `app-stopped` + exit 0），与 ADR 0006:270/:276、hub-peer-deployment.md:287-288、cordis-plugin-hosting.md:458 三处成文一致；
- **不是未授权冻结面改写**：被改文件的冻结对象（断言面）逐字未动；触碰 DENY 路径类目的范围权属已由 SA3 申报、本报告裁决无决策抵触（R5），交 Controller 认定——即便 Controller 不予追认，其处置方式也是回退测试侧改动，不产生决策文本冲突；
- **与 #412 变更集正交**：产品树零 diff，SA6 两契约文件、S-5 承载文件、persistence 全部源码与既有测试零触碰。

## 8. Required actions

1. **（非阻断，交 Controller 认定）** 范围申报：本轮修改落在设计 §11 DENY「`apps/yjs-server/test/` 既有测试」路径类目内（枚举例不含本文件），权属 = dispatch 具名该文件为 CI 失败面 + 「建立可执行 red→green 覆盖」要求；DENY 立法理由（冻结锚零改动即绿、S-5 以新增文件承载）完整保持。SA8 裁决无决策文本抵触；范围追认属 Controller 职权（SA3 已透明申报，未自行宣告合规）。
2. **（非阻断，交 SA4/SA7 动态面）** CI 权威复跑（`test (20, 6)`/`test (24, 6)` 真实 runner 剖面）、忙窗锚的时序稳健性（`sleep(50)` 落窗、400ms/415ms 占空比）、SA3 如实登记的 1 次未复现负载失败——均属测试质量/动态验证面，非冲突门禁事项。
3. **（非阻断，前瞻流程观察，交 SA1/Controller）** apps 测试树中其余 13 个仍用 `.bin/tsx` 形态的既有测试暴露在同一 30ms 转达窗下（潜在同类 flake 源）；是否统一改用 `node --import tsx` 直跑形态或抽公共 spawn 助手，属后续变更集决策，当前无决策文本需要修订。
4. 冲突门禁侧无阻断行动：本变更集可在通过动态质量门（行动 2）并获范围追认（行动 1）后随 #412 一并提交。

## 9. Verdict

**clear**

- 10 项对照：10 no-conflict + 0 implements-existing-decision + 0 evolution-required + 0 hard-conflict；
- 修复走的是「修测量仪器、不修被测契约」的路径：信号送达从「包装进程 30ms 回执竞态」修复为「直达 app 进程 handler」，全部断言面逐字保持，新增忙窗锚把 Owner 硬契约在不利送达条件下钉成可执行红/绿；
- **dispatch 三问均获肯定答案**：①与 ADR 全集（0001–0030，含 ADR 0006 #412 修订节）零冲突；②与规范文档（instance-replication-v1、hub-peer-deployment、cordis-plugin-hosting、模块 AGENTS、CI 门禁定义、CONTEXT 词条）零冲突；③与 issue #412 停机耐久约束及 Owner comment 5751613018（updated 2026-09-20T18:03:36Z）的 drain-before-dispose 硬契约 + ADR 对齐**零冲突零触碰且被强化**——`75bd0ab`/`9094760` 提交态逐字节保持。

## 10. requiresConflictRecheck

**false**

- 本修复未开任何新决策面：无公共 API/wire/schema/持久化格式/状态机/生命周期/失败语义变化，无正式 override 尚待实现核对；
- 全部核对均针对当前实际 diff 完成（断言面逐字比对、产品树零 diff、冻结锚完整性、tsx 机制事实复核），无「尚待实现核对」的遗留项；
- 前两轮（#412 主体实现、codegen 修复）的复审均已闭合（clear / false）；唯一开放项是 R5 的**范围追认**（Controller 职权）与 §8 行动 2 的动态质量面（SA4/SA7 职权）——两者都不是冲突复查触发器。
