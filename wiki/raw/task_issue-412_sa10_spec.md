# SA10 Spec Review — issue #412（iteration 4：最终提交 `d60760c`「smoke 信号处理确定性 CI 修复」终审）

- 任务：issue #412（persistence 公开完成式排空 `drain()` + `retryDelayMs` 解耦 + 停机硬契约）
- 本轮 dispatch：`sa-0870ce4d-ca3a-4ed7-bb33-4c7e3df272c3`（phase **spec-review**，**iteration 4**）——「Review the final committed CI repair for issue #412 at the current head against issue requirements, acceptance evidence, and relevant specifications. Confirm the smoke harness repair preserves and verifies drain-before-dispose.」
- **审查对象：当前最终提交 `d60760c test(yjs-server): make smoke signal handling deterministic`（HEAD，tracked 工作树干净）**。提交内容 = 7 文件：`apps/yjs-server/test/smoke-skeleton-red.test.ts`（**+98/−5**，`git diff f3b13ee..d60760c --numstat` 实测）+ 3 份证据日志（iter3-probe-memory / iter3-relay-redgreen / iter3-smoke-stability）+ 3 份 wiki 过程产物原位更新（SA3 impl、SA4 review、SA8 implementation conflict report）。**零产品代码、零规范文本**
- 适用 Owner 要求：Issue comment ID `5751613018`——本轮经 `gh api repos/nomicore-ai/nomicore/issues/comments/5751613018` **独立拉取全文核对**：`id=5751613018`、`updated_at=2026-09-20T18:03:36Z`，与 dispatch 逐项一致，**无更新版本覆盖**。要求面 = ①「宿主优雅停机必须先 `await drain()` 再 dispose」写为**硬性契约**（分层方案可接受：公开 `drain()`、dispose 保持 abort 式）；②**同步修订 ADR-0006 :86** dispose 定义（否则契约与实现继续脱节）；③第三击穿窗口（degraded retry 回退窗）确认；④问题 2 解耦确认（缺省保持现行为）
- 审查纪律：spec 审查。未修改任何代码/设计/测试、未运行测试套件、未启动服务、未调度其他 SA。本轮证据 = 只读核验：git diff/numstat/status、`gh api`/`gh run list`/`gh pr view` 只读拉取、tsx `cli.mjs` 信号转达机制源码独立复核、HEAD 锚点现读、上游 SA 产物（SA3 iteration 3 / SA4 iteration 4 Part C / SA8 conflict-gate iteration 4）交叉核对
- 历史轮次：iteration 0（主体实现 `75bd0ab`，**approve**）、iteration 1（CI-repair `9094760`，**approve**）、iteration 2（`5b3ff26` 时点，**approve**）、iteration 3（证据留档 `bdb91cb`，**approve**）结论经本轮复核**全部保持**；存档见文末附录

## Verdict

**approve**（0 × BLOCKER / 0 × MAJOR / 0 × 阻断 MINOR；非阻断观察见 §5，PR 必须披露项见 §6）。

核心判定：

1. **CI 修复根因成立、修复对象正确（修测量仪器，不修被测契约）**：失败观测 = CI run `35535478371`（head `f3b13ee`）`test (24, 6)` 唯一非绿 job，`peer exit code: expected 143 to be +0`（失败原文 `artifacts/sa3-issue412-iter3-ci-failure-evidence.log`，本轮与 `gh run list` 交叉证实：同分支 run `35534499992`（head `5b3ff26`）16/16 全绿、run `35535478371` 15/16 绿唯 `test (24, 6)` 红，两 head 间 `git diff --name-only` 仅 wiki/artifacts ⟹ 同一份产品/测试树零差异双态 = flaky，非产品缺陷）。机理本轮**独立复核 tsx `4.23.12` `dist/cli.mjs` 源码成立**：`relaySignals` → `waitForSignalFromChild` 内联 `setTimeout(...,30)` 双回执窗，超时即 `child.kill('SIGKILL')` + 包装进程 `process.exit(128+15)` = 143；app 侧 `main.ts:214-216` 为唯一 SIGTERM/SIGINT/SIGHUP 注册点（无移除点）、全树 `process.exit` 仅 0/1 两型，**无 143 路径**（grep 实证）。修复 = `spawnApp` 由 `.bin/tsx` CLI 包装形态改 `node --import tsx <main.ts>` 直跑（信号直达 app handler；与 `root-lock-atomic-reclaim-red.test.ts:34` 仓内先例同款、与发布产物 `bin` node 直跑同形）。
2. **无语义交付变化（零交集证明）**：`git diff f3b13ee..d60760c --name-only -- packages apps/yjs-server/src docs CONTEXT.md .github domains` 输出**为空**；测试树唯一改动 = dispatch 指名失败面 `smoke-skeleton-red.test.ts`。HEAD 的语义交付与 iteration 0–3 终审且 approve 的对象（`75bd0ab`+`9094760` 提交态）**逐字节同一**。
3. **smoke harness 修复保持且验证 drain-before-dispose（本轮核心问题）**：
   - **保持**：既有 4 用例断言面逐字不变（SIGTERM→exit 0 硬 `toBe(0)`、四事件序、锁守卫、durable 回读——本审查对 diff 逐 hunk 核对，断言行零增删）；全文件无 `.skip`/`.only`/`.todo`；`143` 仅出现于注释，**无任何容忍码**；硬契约全部成文与实现载体（ADR 0006 :242-282、app.ts:618-635、cordis-plugin-hosting.md :64/:458/:468-474、CONTEXT.md:139-141、hub-peer-deployment.md :38-42/:282-287）零触碰（§3 HEAD 现读逐项在位）。
   - **验证（净强化）**：新增忙窗回归锚「SIGTERM 直达 app 进程：事件循环忙窗内送达仍完成排空链 → exit 0」——运行时 tmp 物化 blocker（`NODE_OPTIONS --import` 注入、`isAppProcess` 守卫、400ms/415ms 占空 ≈96% 忙窗、`busy-window-start` 广播后 50ms 送 SIGTERM 精确落窗），三重断言：exit `toBe(0)` + `app-stopped` 存在 + **尾序恰为 `['persistence-disposed','app-stopped']`（`toEqual` 全序列比对——缺事件、乱序、双拆卸链均红）**。**敏感性双证**：仓内反证——仅还原 spawn 形态、其余逐字节不动，该用例即以 CI 签名红（`hub (busy window) exit code: expected 143 to be +0`，`smoke-red-proof.log`）；机制复现——同一 app/同一 blocker 双形态 3×3：tsx-cli 143×3（`app-stopped=false`，排空链被包装进程腰斩）vs node-import 0×3（`app-stopped=true`，`persistence-disposed → app-stopped`）（`relay-redgreen.log`）。旧 harness 形态下包装进程可在 drain 在途时 SIGKILL app 进程——即旧形态可能**腰斩排空链并假红/掩盖停机行为**；修复后信号直达，停机硬契约在「信号送达时事件循环正忙」不利条件下被钉成可执行红/绿。
4. **验收证据链闭合且与申报一致**：CI `test (…, 6)` 步骤原文本机复跑 **66 files / 746 tests 全绿**（`shard6-node24.log`）；修复后文件连续 5 次全绿（`smoke-stability.log`，已随集入库）+ 6 路 CPU 人工负载 14/14 绿（`smoke-load-run{1..14}.log`）；SA6 契约切片 **21 files / 221 tests 全绿 + Type Errors: no errors**（含 drain-red 27 + drain-surface 5 + drain-semantics 9）；S-5a/S-5b/S-5c **3 tests 全绿**（`shutdown-tests.log`）；app 全套 **35 files / 183 tests 全绿**（`app-suite.log`）；root `pnpm typecheck` 15 段完成（`root-typecheck.log`）；`pnpm generate --check` 无 diff 输出（`generate-check.log`）。
5. **无 scope creep 新增**：唯一 DENY 交叉（被改文件落在设计 §11 DENY「`apps/yjs-server/test/` 既有测试（冻结锚）」类目）已经三方透明处理——SA3 按 skill 申报（未自裁）、SA8 conflict-gate 裁决无决策文本抵触（clear / requiresConflictRecheck **false**）、SA4 裁定 in-scope（C2-5：iteration-3 dispatch 直接指名该文件为 CI 失败面构成后发显式授权；DENY 立法意图——冻结锚零改动即绿、S-5 以新增文件承载——逐项核实保持）。spec 维度：该改动不减损任何验收锚覆盖，反而新增回归锚，不构成对 issue 请求面的偏离或扩张。范围追认登记交 Controller（§6-2）。

## 1. Reviewed inputs

| 输入 | 状态 |
| --- | --- |
| Issue #412 正文快照（`wiki/raw/task_issue-412.md`） | 已读 |
| Owner comment 5751613018 全文（`gh api` 本轮独立拉取） | 已读核对（id/updated_at 逐项一致；含「至少需要…硬性契约…同步修订 ADR-0006 :86…否则契约与实现继续脱节」原文段） |
| 审查对象：`git show d60760c`（7 文件全 diff）+ `git diff f3b13ee..d60760c --numstat`（测试 +98/−5）+ `git status --porcelain`（tracked 零改动） | 已读核对 |
| 零交集 diff：`git diff f3b13ee..d60760c -- packages apps/yjs-server/src docs CONTEXT.md .github domains`（**空**） | 已实证 |
| 被改测试全文（HEAD 态 433 行）与既有 4 用例断言面 | 已读逐 hunk 比对 |
| tsx 机制：`node_modules/tsx/dist/cli.mjs`（lock 固定 4.23.12）`relaySignals`/`waitForSignalFromChild`(30ms)/`SIGKILL`/`process.exit(128+sig)` | 已独立复核（机理成立） |
| app 侧：`main.ts:214-216` 唯一信号注册点 + 全树 `process.exit` 面（仅 0/1）；`app.ts:540-649` 停机链（:559 `awaitDrainWithBudget` → :618-627 有界 drain → :630 唯一 `persistenceFiber.dispose()` → :632/:635 事件） | 已读 |
| 规范锚点现读：ADR 0006 :242-282 修订节全文（:244 owner 三要求成文、:261-268 drain 语义、:270 第 3 条无条件硬契约、:276 第 4 条「修订并扩展 :86」、:278 retryDelayMs 解析形状、:280 liveness 不变量、:282 归档裁决）；CONTEXT.md:139-141 词条（含 `_Avoid_`）；hub-peer-deployment.md :38-42 词表 + :282-287 停机序段；cordis-plugin-hosting.md :64/:458/:468-474 硬契约指引 + 有界 drain 示例 | 全部在位 |
| 库层锚点现读：contract.ts:176（`readonly drain?`）/:523（`retryDelayMs?`）/:545-551（条件展开不物化键）；lifecycle.ts:858（公共 `drain`）/:1078（`retryBaseMs` 单源）/:1094/:1152（两落点）/:1227（`releaseSettleWaiters`）；memory.ts:189-193 / file.ts:153-157（委派，File 入口 validateIdentity）；probe.ts:444-446（DSH 镜像锁步） | 全部在位（本轮零 diff） |
| 验收锚现读：`persistence-drain-shutdown.test.ts`（S-5a 完成式停机+内容耐久+四事件序；S-5b 预算内收口+`persistence-drain-budget-exceeded` 先于 dispose+有损诚实；S-5c `MemoryPersistence.prototype.drain` spy 恰 1 次且严格先于 `persistence-disposed`） | 已读（本轮零触碰） |
| SA3 iteration 3 证据日志 29 份（`artifacts/sa3-issue412-iter3-*.log`） | 关键 12 份抽读（CI 失败原文、机制 red/green、仓内红证明、shard 6、稳定性×5、负载×14、persistence 契约、S-5、root typecheck、generate --check、app 全套、Node 20 替身申报） |
| CI 事实：`gh run list --branch mabf/issue-412`（run `35534499992` success / `35535478371` failure 唯 `test (24, 6)`）、`gh pr view 413`（OPEN / MERGEABLE / headRefOid `f3b13ee` / 16 checks 15 SUCCESS + `test (24, 6)` FAILURE） | 已独立证实 |
| 上游产物：设计 iteration 2（§11/§12）、SA3 iteration 3 impl 报告、SA4 iteration 4 Part C（**approve**，0 finding）、SA8 implementation conflict-gate（**clear** / requiresConflictRecheck **false**）、SA6 契约 C1–C14 | 已读并交叉核对 |

## 2. Issue 请求面与 Owner 要求保持性（HEAD 现读逐项核对）

| Issue / Owner 要求 | HEAD 锚点 | 判定 |
| --- | --- | --- |
| 公开完成式 `drain()`：live 脏 entry（含零 handle）立即 startFlush 跳过 debounce + await 全部 settle | contract.ts:176 optional 成员 + lifecycle.ts:858 公共实现 + memory.ts:192/file.ts:153 委派；ADR 0006 :261-268 语义成文 | **保持**（本轮零 diff） |
| 不 abort、不 destroy、不清定时器之外状态；drain 后 dispose 可安全立即执行 | ADR :266 非破坏性条款 + S-1（drain-after-dispose vacuous）/ C6（drain→dispose 安全）锚绿 | **保持** |
| 可选参数只 drain 指定 key 集合 | `targets?: readonly PersistenceDrainTarget[]`（contract.ts）；C7 subset 锚绿 | **保持** |
| `retryDelayMs` 独立配置、缺省保持现行为 | contract.ts:523 + :551 条件展开（缺省不物化键）+ lifecycle.ts:1078 `retryBaseMs` 动态回退 debounceMs + probe.ts:446 DSH 镜像锁步；ADR :278 解析形状条款 | **保持** |
| 宿主固定睡眠替换为 `await persistence.drain()` | app.ts:618-627 `awaitDrainWithBudget(adapter.drain(), budgetMs)`（file/memory 统一无 kind 特判，预算 = maxDirtyMs + 边距，预算尽 `persistence-drain-budget-exceeded` 诚实事件后有损继续） | **保持** |
| **Owner ①：dispose 前 await drain 硬契约（成文，非建议）** | ADR 0006 :270 第 3 条**无条件**条款（含适用面「不以 adapter 类型特判」、预算尽 = 显式可观察退出、与 :34 不冲突申明）+ app.ts:624 → :630 结构性先于全仓唯一 dispose + cordis-plugin-hosting.md :458/:468-474 对外指引 + CONTEXT.md:139-141 词条 | **保持** |
| **Owner ②：同步修订 ADR-0006 :86 dispose 定义** | ADR :276 第 4 条「本节**修订并扩展** :86 的 dispose 定义边界」（dispose 不变且保持 abortive/有损、从来不是持久性屏障、持久性唯一经分层公开 drain 表达、「dispose 内部先 drain」否决论证在文） | **保持** |
| Owner ③：第三击穿窗口（degraded retry 回退窗） | ADR :264 回退窗被动等待（不热循环）+ app.ts 预算覆盖回退窗；S-5b degraded 预算内收口锚绿 | **保持** |
| Owner 分层立场：dispose 保持 abortive + 公开分层 drain | dispose 段不在全 PR 语义改动面；S-1/0a/0b 保持性锚绿（iteration 0–3 终审确认） | **保持** |
| 硬契约可观察失败面不被测试放宽 | 本轮修复**零容忍码**；新锚在旧 harness 形态下确定红（敏感性反证）；既有断言逐字不变 | **强化** |

## 3. 本轮提交内容 spec 符合性逐项

| 提交内容 | spec 核对 | 判定 |
| --- | --- | --- |
| `spawnApp`：`spawn(process.execPath, ['--import','tsx', MAIN_TS, …], { cwd: REPO_ROOT, env })` | 信号直达 app 自身 handler（消除包装进程 30ms 竞态窗）；`cwd: REPO_ROOT` 钉模块解析面；与仓内先例/发布形态同构；argv 契约面（`--config <abs>`）不变 | 符合（修复落在问题拥有层 = 测试装配） |
| 可选 `appNodeOptions` 注入缝（3 行） | 仅写入该次 spawn 的 env 副本（不污染 `process.env`）；`--import` 在 NODE_OPTIONS 白名单（Node ≥20.6，CI 20/24 矩阵内）；测试专用，零产品缝 | 符合 |
| `BUSY_WINDOW_BLOCKER_SOURCE`（运行时 tmp 物化） | 零新增仓内 fixture；`isAppProcess` 守卫（argv[1] 尾缀 `main.ts`）防包装形态继承时度量错对象；`afterEach` 既有清理链覆盖（tmpDirs rmSync + liveProcs SIGKILL 兜底） | 符合 |
| 新增忙窗用例三重断言（exit 0 / `app-stopped` / 尾序 `toEqual(['persistence-disposed','app-stopped'])`） | 加严不放宽；`sleep(50)` 落 400ms 忙窗；退出等待 30s ≫ 阻塞 400ms；`waitForEvent` 60s 窗兜底（即使 boot 慢于 blocker 900ms 起播，415ms 周期留隙推进）；CI 分片器磁盘枚举自然落入 shard 6（SA4 本地枚举复核） | 符合（分工见 §5 O-2） |
| 头注释/spawn 注释记录根因与 CI 编号（run 35535478371 `test (24, 6)`） | 注释诚实性：与 `gh run list`/`gh pr view 413` 独立拉取事实一致；「断言面逐字不变」声称经本审查 diff 逐 hunk 核对成立 | 符合 |
| 3 份证据日志随集（probe-memory / relay-redgreen / smoke-stability） | 仓内 SA3 证据惯例（`artifacts/` 既有 200+ tracked 项）；内容与其余未入库日志互洽无矛盾 | 符合（其余日志入库状态见 §6-5） |
| 3 份 wiki 过程产物原位更新（SA3/SA4/SA8） | 非 DENY 名单内（DENY 仅列 Host/SA2/SA6/SA8 **设计期**产物；SA8 本文件为其自身 implementation 复审固定产物）；不引入新承诺、不改验收契约文本 | 符合 |

## 4. 范围与规范符合性（全 PR 维度复核）

- **设计 §11 ALLOW**：12 产品文件 + 2 新增测试文件 + SA6 两契约文件（零触碰提交）逐字节保持（iteration 0–3 已终审；本轮 `git diff` 实证零后续触碰）。
- **设计 §11 DENY 逐项零触碰（本轮对 `c3f7bd9..HEAD` 全量名单复核）**：namespace-registry、docs/protocols、ws-replication、persistence service.ts/testing.ts、dsh record/events/profile/cli、.github、persistence 既有测试与冻结审计、SA6 两契约文件、上游 wiki 产物均零触碰。**唯一交叉** = `apps/yjs-server/test/` 既有测试类目中的 `smoke-skeleton-red.test.ts`——dispatch 具名豁免面，SA4 裁定 in-scope、SA8 裁决无决策抵触（§6-2 披露）。
- **规范文档同步四方同答案保持**：ADR 0006 修订节（:270 无条件硬契约 + :276 dispose 对齐）、hub-peer-deployment.md（:282-287 file/memory 统一有界排空 + 事件序）、cordis-plugin-hosting.md（:458 第 5 步硬契约指引 + :468-474 有界 drain 示例）、自家实现（app.ts:618-635）对「memory 路径同样 drain-before-dispose」给同一答案（SA2-7 MAJOR 闭合保持）；本轮零触碰。
- **SA6 契约两文件零触碰**：本轮 `git diff f3b13ee..HEAD -- packages/persistence/test` 为空（实证）。
- **门禁链**：SA2 iteration 1 approve（设计）；SA4 iteration 4 Part C approve（本轮实现，0 finding，O-1~O-5 非阻断观察）；SA8 implementation conflict-gate clear / requiresConflictRecheck false；SA9/SA10 iteration 0–3 approve（历史）。无悬而未决的阻断项。
- **CI 现状（如实登记）**：PR #413 head 仍为 `f3b13ee`（修复提交 `d60760c` 为本地提交，推送属 Controller 动作）；该 head 的 `test (24, 6)` 红正是本轮修复对象——修复的 CI 权威验证 = 推送后复跑（§6-1 披露，本地已以该 job 步骤原文 66/746 绿 + Node 20 替身绿为前置证据）。

## 5. Findings（非阻断观察）

| # | 严重度 | 观察 | 处置 |
| --- | --- | --- | --- |
| O-1 | 观察（流程） | `d60760c` 为本地提交：PR #413 `headRefOid` 仍为 `f3b13ee`（本轮 `gh pr view` 实证），其 `test (24, 6)` 红 = 本修复对象。推送 + CI 复跑属 Controller 动作；本地前置证据（shard 6 步骤原文 66/746 绿、连续 5 次绿、负载 14/14 绿、Node 20 替身绿）充分但不替代真实 runner 剖面 | 不阻断；推送后 CI 重跑即闭合 |
| O-2 | 观察（锚定分工） | 忙窗新锚的尾序断言证明「链次序 + 完成」（`persistence-disposed` → `app-stopped` + exit 0），其本身不单独证明 drain 被执行/结算（该场景 hub 无停机前脏写）；drain-before-dispose 的**语义时序**由 S-5a（脏写经 drain 落盘、重启 durable 回读）与 S-5c（spy 证 drain 恰一次且严格先于 `persistence-disposed`）承载，本轮 3/3 重跑绿。分工明确、无覆盖缺口 | 无需处置（SA4 O-4 同款结论） |
| O-3 | 观察 | 忙窗锚只起 hub 进程；CI 失败观测点在 peer 退出码。`spawnApp` 为 hub/peer 共享缝（第 2 用例 peer SIGTERM 断言未动），机制面已覆盖，peer 忙窗变体未单独锚定 | 可选后续加固（SA4 O-3，非必需） |
| O-4 | 观察 | 同类暴露面残余：其余 14 个 apps 既有测试仍用 `.bin/tsx` 包装形态（同一 30ms 转达窗 flake 风险）；SA3 如实申报并交 SA1/Controller 决策 | 后续变更集统一迁移或抽公共 spawn 助手 |
| O-5 | 观察（诚实登记） | SA3 人工 4× 超订负载实验出现 1 次未复现失败（无 143 字样，疑等待超时/端口竞态；随后 17 次等量或更重负载 + shard + 常规全绿未复现；原始轮次未留档） | 已如实登记；CI 复跑与长尾观测闭合 |
| O-6 | 观察（计数出入） | SA3/SA8 报告记 smoke diff「+92/−5」，实测 numstat = **+98/−5**（内容核对一致，系引用旧计数）；「13 个其余文件」实测 14 | 以实测数为准，无需返工（SA4 O-5） |
| O-7 | 观察（承接） | `apps/yjs-server/AGENTS.md` 单一拆卸链摘要行未逐字列新增排空等待步（陈述仍真；文档债，承接 SA4 N-1） | 后续文档变更集顺带补一行 |

无 BLOCKER / MAJOR。本轮独立复核未发现上游 SA 记录之外的新缺口。

## 6. PR 必须披露项（终审清单，承接 iteration 3 §6 并更新）

1. **本地提交待推送 + CI 权威复跑**（本轮新增登记）：修复提交 `d60760c` 尚未推入 PR #413（remote head = `f3b13ee`，其 `test (24, 6)` FAILURE 即本修复对象）；推送为 Controller 动作。修复有效性证据 = 本地 CI 步骤原文复跑 66/746 绿 + 机制 red/green 双形态 + 仓内红证明 + 负载 14/14 + Node 20 替身；真实 runner 4 vCPU 剖面以推送后 CI 为准。
2. **范围追认登记**（本轮新增，承接 SA4 C2-5/O-1 + SA8 §8 行动 1）：本轮改动落在设计 §11 DENY「`apps/yjs-server/test/` 既有测试（冻结锚）」类目内；权属 = iteration-3 SA3 dispatch 直接指名该文件为 CI 失败面 + 「建立可执行 red→green 覆盖」要求；SA3 已按 skill 申报（未自裁）、SA8 裁决无决策文本抵触、SA4 裁定 in-scope；DENY 立法意图（冻结锚零改动即绿、S-5 以新增文件承载）逐项核实保持。建议 Controller/SA1 在提交追认时于设计或 dispatch 记录补一行「iteration-3 具名豁免仅限该文件该用途」，防后续轮次误读 DENY 可自由触碰。
3. **同类 flake 暴露面残余**（本轮新增登记）：其余 14 个 apps 测试仍用 `.bin/tsx` 包装形态，同一 30ms 转达窗下存在潜在 143 形态 flake；本轮 dispatch 只具名 `smoke-skeleton-red.test.ts`，未扩大改动面；统一迁移决策交 SA1/Controller。
4. **范围扩权事实**（承接，仍有效）：`domains/vfs3-assets/generated.ts` 与两哨兵测试不在 #412 设计 §11 两表内；权属 = iteration 1 修复 dispatch 明示指令 + `domains/AGENTS.md` §Workflow 规定动作；跨任务字节哨兵 `GENERATED_SHA256` 重钉（语义指纹与全部断言零改动）。
5. **根因归属**（承接 + 本轮补充）：iteration 1 三 CI 检查失败根因 = 发布提交 `abbb89a` 版本 bump 未伴随重生成（仓库级历史遗留）；本轮 `test (24, 6)` 143 flake 根因 = 测试 harness 的 tsx CLI 包装进程信号转达窗（仓库测试装配层，非 #412 引入、非产品缺陷）。
6. **库级 drain 无时间预算**（设计非目标，承接未变）：持续失败 store 下库级 drain 不 resolve 是完成式语义的诚实代价（ADR 0006 :267 成文）；宿主侧总界 = yjs-server 预算 race + 诚实事件 + 有损继续；仓库外宿主经 cordis-plugin-hosting.md :458/:468-474 指引。
7. **仓库外消费方采纳**：nomic-server 替换 `FILE_PERSISTENCE_DRAIN_MS` 固定睡眠属其自有变更集（issue「消费方配合」节）。
8. **Follow-up（设计 §13，未变）**：DSH 记录头携带 `retryDelayMs` 的 golden 立法；yjs-server 配置面暴露 `retryDelayMs`；archive×delete 既有理论挂起的专项系统性测试；SA3 登记的 1 次未复现负载失败的长尾观测。
9. **证据入库残余**（本轮新增登记）：iter3 证据日志 29 份中 3 份已随 `d60760c` 入库，其余（shard6、red-proof、app-suite、persistence-contract、shutdown-tests、root-typecheck、generate-check、smoke-load 系列等）仍以 untracked 形态留在工作树——与 iteration 2/3 由 Controller 后续提交闭合的流程同款；语义覆盖面不受影响。

## 7. 结论

当前最终提交 `d60760c` 是**纯测试 harness CI 修复提交**（smoke spawn 形态 + 忙窗回归锚 + 证据/评审留档），对全部产品与规范面零触碰——**无语义交付变化**，HEAD 语义交付与 iteration 0–3 终审 approve 的对象逐字节同一。根因诊断（tsx CLI 包装进程 30ms 回执竞态 → SIGKILL + exit 143）经本轮独立源码复核成立，flaky 判定（同一产品树 run `35534499992` 绿 / `35535478371` 红、两 head 间仅 wiki/artifacts 差异）经 `gh` 独立证实。**smoke harness 修复保持并验证 drain-before-dispose**：断言面逐字不变、零容忍码、无 skip/only/todo；新增忙窗锚把「SIGTERM 送达时事件循环正忙 → drain → dispose → app-stopped → exit 0」钉成可执行红/绿（旧形态确定红 = CI 签名复现），与 S-5a/S-5b/S-5c 语义锚分工闭合。**Owner 评论 5751613018（2026-09-20T18:03:36Z，本轮 gh 独立全文核对）的硬 drain-before-dispose 契约与 ADR-0006 对齐保持完好**——成文载体（ADR 0006 :242-282，含 :270 无条件条款与 :276「修订并扩展 :86」）、实现载体（app.ts :624→:630 统一有界排空先于唯一 dispose）、对外指引（cordis-plugin-hosting.md :64/:458/:468-474）、词条（CONTEXT.md:139-141）、验收锚（S-5a/b/c + 新忙窗锚）五方同答案。SA6 契约 C1–C14 与全部补充锚绿、契约文件零触碰、唯一 DENY 交叉经三方透明处理待 Controller 追认登记、无 scope creep 新增；iteration 0/1/2/3 的 approve 结论经本轮复核保持。**approve**。

---

## 附：历史轮次结论存档

### iteration 3（dispatch `sa-e873710b-03de-4c0b-a485-d22612d7a8de`，审查对象 `bdb91cb`「CI 验证证据留档」）

**approve**（0 BLOCKER / 0 MAJOR / 0 新增 MINOR；4 × 非阻断观察）。核心判定：`bdb91cb` = 纯证据留档（5 份 CI 验证日志 EXIT=0 + 3 份评审记录），对 `packages/`、`apps/`、`docs/`、`CONTEXT.md` 零触碰（零交集证明），HEAD 语义交付 ≡ CI 权威验证对象 `5b3ff26`（run `35534499992` success）；Owner 硬契约与 ADR 对齐逐项在位；范围/DENY/契约零触碰。本轮复核：`d60760c` 对该结论对象零语义触碰（§3 零交集证明），结论无需修订；其 §5 N-1（`bdb91cb` 未推送）仍属 Controller 动作面（与本轮 §6-1 同款登记）。

### iteration 2（dispatch `sa-8c3fcd5b-83f2-492f-a65b-19b134667e9a`，审查对象 = PR #413 全量 diff `c3f7bd9..5b3ff26` + CI 证据）

**approve**（0 BLOCKER / 0 MAJOR / 0 新增 MINOR；4 × 非阻断观察）。核心判定：issue #412 全部请求面落地且保持；Owner 硬契约与 ADR 对齐逐项在位；CI run `35534499992`（headSha = `5b3ff26` = PR head）success、16 job 全绿经 `gh` 独立证实；SA6 契约 C1–C14 + S-1~S-4 + S-5a/b/c 全绿；修复轮两提交对全部 #412 契约面 diff 为空。本轮复核：`d60760c` 对该对象零语义触碰，结论无需修订（注：该 run 的 `test (24, 6)` 绿与 run `35535478371` 红构成同一产品树双态，恰为本轮修复的 flaky 证据链一环，不回溯影响 iteration 2 判定）。

### iteration 1（dispatch `sa-75015d57-e8fe-40dc-a29b-b05d24a47b2e`，审查对象 HEAD `9094760`「fix(codegen): refresh generated vfs3 assets」）

**approve**（0 BLOCKER / 0 MAJOR；4 × 非阻断观察）。核心判定：`pnpm generate --check` 由 exit 1 恢复为 exit 0；修复 = 生成物横幅恰 1 行 + 两哨兵各 1 行重钉 + 注释；根因归属 `abbb89a` 成立；Owner 硬契约与 ADR 对齐零改动。本轮复核：该对象（`9094760` 提交态）经四轮后续提交逐字节保持，结论无需修订。

### iteration 0（dispatch `sa-2cf05a4a-8931-4f38-a72e-35048838f4b6`，审查对象 `c3f7bd9..1fef434`，后由 Controller 提交为 `75bd0ab`）

**approve**（0 BLOCKER / 0 MAJOR；5 × MINOR 非阻断）。核心判定：issue 正文全部请求面、Owner 评论全部要求、SA6 验收契约 C1–C14 与补充锚 S-1~S-4/S-5a/S-5b/S-5c 逐项忠实落地；ADR-0006 对齐与停机硬契约四方同答案；文件范围贴合设计 ALLOW、DENY 零触碰。本轮复核：该对象（`75bd0ab` 提交态）经四轮后续提交逐字节保持（`git log`/`git diff` 实证 #412 契约面零后续触碰），结论无需修订。
