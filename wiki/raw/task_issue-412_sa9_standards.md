# SA9 Standards Review — issue #412（iteration 4：CI 修复提交 `d60760c` 终审）

- 任务：issue #412（standards-review，**iteration 4**）；dispatch `sa-04dcaf1e-736e-4e82-bfa2-7cb39ef5c499`（role `mabf-sa9`，phase standards-review）——「Review the final committed CI repair for issue #412 at the current head. The repair makes the smoke harness launch the app with direct Node plus a busy-window SIGTERM regression check. Confirm engineering standards, evidence integrity, and no test suppression. Owner requirement: comment 5751613018, updated 2026-09-20T18:03:36Z, requires the hard drain-before-dispose contract and ADR alignment remain intact.」
- 审查对象：**当前 HEAD `d60760c`「test(yjs-server): make smoke signal handling deterministic」**（恰 7 文件：1 测试文件修复 + 3 证据日志 + 3 wiki 过程产物原位更新）及其提交链谱系：`75bd0ab feat(persistence): add completion drain lifecycle`（#412 主体）→ `9094760 fix(codegen): refresh generated vfs3 assets`（CI 修复 1）→ `5b3ff26`/`bdb91cb`/`f3b13ee`（评审/证据留档）→ `d60760c`（CI 修复 2，本终审对象）。
- 适用 Owner 要求：Issue comment `5751613018`——本轮经 `gh api repos/nomicore-ai/nomicore/issues/comments/5751613018` **独立拉取核对**：`id=5751613018`、`updated_at=2026-09-20T18:03:36Z`、`author_association=MEMBER`、author `welltop-jim-wang`，与 dispatch 逐项一致，无更新版本覆盖；评论全文要求面：①「宿主优雅停机必须先 `await drain()` 再 dispose」写为**硬性契约**（可接受分层方案：公开 `drain()`、dispose 保持 abort 式）；②**同步修订 ADR-0006 :86** dispose 定义；③retryDelayMs 解耦（缺省保持现行为）。
- 审查纪律：静态标准审查——不运行测试、不启动服务、不修改代码/设计/测试、不调度其他 SA；所有事实只读独立核对（`gh api`/`gh run list`/`gh pr view` 本轮拉取、git diff/log/numstat 字节谱系、tsx 4.23.12 锁定源码机制复核、源码锚点 sed/grep 现读、证据日志全文/尾部抽读）。范围 = 仓库/工程标准符合性、证据完整性、测试抑制面；Issue 需求完整性属 SA10 面。
- 历史轮次：iteration 0/1/2 SA9 approve（主体实现 / codegen 修复 / 验证证据留档）；iteration 3 SA9 approve（留档提交 `bdb91cb` 终审，0B/0M/4 MINOR）。前身全文留存于 git 历史（`f3b13ee:wiki/raw/task_issue-412_sa9_standards.md` 及更早）；本文件按原位更新惯例只裁决本轮 dispatch 对象。

## 1. Reviewed inputs

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| HEAD `d60760c` 全量 diff（`git show --stat` + 逐文件/逐行核对） | 全量核对 | 被审对象组成与边界 |
| 提交链谱系（`git diff f3b13ee..d60760c` 各路径段、`--numstat`、`git diff --check HEAD`） | 全量核对 | 产品树零漂移证明、空白纪律 |
| Owner comment `5751613018`（元数据 + 全文） | `gh api` 本轮独立拉取 | 保持性基准（要求①②③逐字核对） |
| CI run 谱系 | `gh run list --branch mabf/issue-412` 本轮拉取 | flaky 双态判定（`35534499992` success@`5b3ff26` vs `35535478371` failure@`f3b13ee`）与 HEAD CI 状态 |
| PR #413 | `gh pr view --json state,headRefOid,mergeable` 本轮拉取 | 交付态一致性 |
| 被改测试 `apps/yjs-server/test/smoke-skeleton-red.test.ts` 全文 | 已读（433 行）+ 词边界抑制 grep | 断言面冻结、无 skip/only/todo、新锚断言强度 |
| `node_modules/tsx/dist/cli.mjs`（tsx `4.23.12`，lock 固定） | 机制原文复核 | 30ms 回执窗 + SIGKILL + `process.exit(128+15)`=143 机理独立证实 |
| 先例与发布形态（`root-lock-atomic-reclaim-red.test.ts:34`、`apps/yjs-server/package.json` `bin`） | 现读 | direct-node 形态的仓内惯例一致性 |
| 硬契约锚点（ADR 0006 :265-282 修订节、app.ts :559/:624/:630/:632/:635、main.ts :214-216、hub-peer-deployment.md :36-42） | sed/grep 现读 | Owner 要求保持性 |
| `.github/workflows/ci.yml`（test 分片步骤 :74-78）、`scripts/ci-test-shard.mjs 6 6` 本地只读枚举 | 已执行 | 新用例的 CI 真实触发入口（shard 6 含本文件） |
| 设计 §11 DENY（:466）、§12 S-5（:454）；SA8 conflict 报告（同轮，clear/false）；SA4 iteration 4 报告（approve）；SA3 iteration 3 报告 | 已读 | 范围裁定谱系与上游审查结论交叉核对 |
| 证据日志（committed 3 份全文 + untracked 26 份中关键 9 份抽读） | 已读 | 证据真实性与内部一致性 |
| SA6 两契约文件 git log | 已执行 | 零触碰核对（仅 `75bd0ab` 一条） |
| 工作区状态（`git status --porcelain`、`git diff HEAD --stat`） | 已执行 | 出口边界 |

## 2. Verdict

**approve**（0 × BLOCKER；0 × MAJOR；6 × MINOR 全部非阻断，见 §9）。

核心判定：

1. **HEAD 提交是纯测试 harness 修复 + 证据/评审留档，产品树零 diff**：`d60760c` 相对 `f3b13ee` 恰 7 文件——`apps/yjs-server/test/smoke-skeleton-red.test.ts`（+98/−5，numstat 实测）、3 份新增证据日志、3 份 wiki 过程产物原位更新（SA3 impl / SA4 review / SA8 conflict）；对全部产品树路径（`packages/**`、`apps/yjs-server/src/**`、`docs/**`、`domains/**`、`CONTEXT.md`、`.github/**`、`scripts/**` 及根配置）`git diff f3b13ee..d60760c --name-only` 输出**为空**（本审查逐路径核对）。#412 主体实现与 CI 修复 1 逐字节保持。
2. **根因诊断独立复核成立，修复路径正确（修测量仪器，不修被测契约）**：tsx `4.23.12`（lock 固定）`cli.mjs` 的 `relaySignals` → `waitForSignalFromChild` 确为 **30ms** 回执窗（`setTimeout(…,30)` 原文），回执迟到即 `kill("SIGKILL")` + 包装进程 `process.exit(128 + signals[SIGTERM]=15)` = **143**——与注释/三份 SA 报告的机制断言逐字相符；`gh run list` 证实同一产品/测试树（两 head 间仅 wiki/artifacts 差异）下 run `35534499992` 绿、`35535478371` 红（`test (24, 6)`：`peer exit code: expected 143 to be +0`）——flaky 判定闭合。修复形态 `node --import tsx <main.ts>` 与仓内先例（`root-lock-atomic-reclaim-red.test.ts:34` `execArgv: ['--import','tsx']`）及发布产物 `bin` 直跑 `dist/main.js` 同构，信号直达 app 唯一 SIGTERM handler（main.ts:214）。
3. **无测试抑制、门禁净强化**：词边界 grep 证实全文件无 `.skip`/`.only`/`.todo`/`xit`/`xdescribe`；既有 4 用例断言面在 diff 中**逐字未动**（仅 `spawnApp` 内部形态、`TSX_BIN` 常量删除、注释、末尾追加新用例）；`143` 仅出现于注释（5 处），无任何断言容忍 143；新增忙窗用例反向**加严**——exit `toBe(0)` + `app-stopped` 存在 + 尾序 `toEqual(['persistence-disposed','app-stopped'])`（全序列比对，与 hub-peer-deployment.md:39 成文词表序一致）。
4. **Owner comment 5751613018 硬契约与 ADR 对齐保持完好且被可执行化强化**：成文面（ADR 0006 修订节第 3 条无条件停机硬契约、第 4 条「修订并扩展 :86」dispose 对齐条款——均明文引用该 comment）、实现面（app.ts:624 `awaitDrainWithBudget(adapter.drain(), budgetMs)` 结构性先于全仓唯一 `persistenceFiber.dispose()` :630）、验收面（SA6 契约 27+5、semantics 9、shutdown 3 在证据日志中全绿）三层锚点全部在位且本轮**零触碰**；新忙窗锚把「drain-before-dispose」在「信号送达时事件循环正忙」不利条件下钉成可执行红/绿（旧 spawn 形态下该用例确定红——红证明日志在案）。
5. **证据真实、与独立核验互洽**：CI 失败证据与 `gh run list`/`gh api` 本轮拉取值一致；shard 6 复跑 66 files/746 tests（CI 基线 745 + 新增 1，计数自洽）；persistence 契约 21/221、shutdown 3、generate --check、root typecheck、app 全套 35/183、机制 A/B 3×3、仓内红证明、5 连稳定性日志形态真实、计数互洽。留档缺口（26/29 日志未跟踪）登记为 MINOR M-1。
6. **流程纪律符合**：conventional-commit（`test(yjs-server):`，仓内同款 9 例）；wiki/raw 为证据层非规范（docs/AGENTS.md 明文）；SA3 范围申报 → SA8 裁决（clear / requiresConflictRecheck false）→ SA4 裁定（in-scope，approve）→ Controller 提交的权责链完整；本审查未 commit/push/调度其他 SA。

## 3. HEAD 提交组成与「零产品漂移」证明

| 维度 | 核对结果 |
| --- | --- |
| 文件清单 | `git show d60760c --stat` = 恰 7 文件：1 × 测试文件（+98/−5）+ 3 × `artifacts/sa3-issue412-iter3-{probe-memory,relay-redgreen,smoke-stability}.log`（新增）+ 3 × wiki 原位更新（SA8 conflict 报告、SA3 impl、SA4 review）——**零产品代码、零规范文本、零生成物、零 CI 配置** |
| 产品树零漂移 | `git diff f3b13ee..d60760c --name-only -- packages apps/yjs-server/src docs domains CONTEXT.md .github scripts tests package.json pnpm-lock.yaml …` → **空** |
| DENY 面零触碰 | 设计 §11 DENY 全表（persistence `service.ts`/`testing.ts`、namespace-registry、dsh 四件、persistence 既有测试与冻结审计、**SA6 两契约文件**（git log 仅 `75bd0ab` 一条）、其余 apps 既有测试、`docs/protocols/**`、`packages/ws-replication/**`、上游 wiki 产物、`packages/vfsl-codegen/**`、`.github/**`、`schema.vfsl`）不在 HEAD diff 名单内 |
| 唯一 DENY 交叉的裁定链 | 被改文件落在 DENY「`apps/yjs-server/test/` 既有测试」路径类目（枚举例不含本文件）：iteration-3 SA3 dispatch **直接指名该文件为 CI 失败面**；DENY 立法理由完整保持——(a) 冻结断言面逐字未动（diff 逐行核对）；(b) S-5 仍由新增文件 `persistence-drain-shutdown.test.ts` 承载（零触碰）；(c) SA3 按 skill 透明申报未自裁、SA8 R5 裁决无决策文本抵触、SA4 §C2-5 裁定 in-scope、Controller 提交即追认。裁定链闭合，无标准违例 |
| commit message | `test(yjs-server): make smoke signal handling deterministic`——内容与对象相符，符合仓内 conventional-commit 惯例（`test(` 前缀仓内 9 例） |
| 工作区出口 | `git diff HEAD --stat`（tracked）空；`git diff --check HEAD` 净（exit 0）；未跟踪项 = 26 份 iter3 证据日志（见 M-1）；分支领先 `origin/main` 6 提交（推送权属 Controller） |

## 4. 根因诊断与修复正确性（本轮独立复核）

| 断言（测试注释/SA3/SA4/SA8） | 本轮独立核验 | 判定 |
| --- | --- | --- |
| tsx CLI 是包装进程，转达信号后只留 30ms 回执窗 | `node_modules/tsx/dist/cli.mjs`（4.23.12）：`waitForSignalFromChild` = `new Promise(i=>{setTimeout(()=>i(void 0),30),…})`；`relaySignalToChild` 双窗未回执即 `t.kill("SIGKILL")` + `process.exit(128+ft.signals[r])`（SIGTERM=15 → **143**）；`process.on("SIGINT"/"SIGTERM", …)` 注册转达 | **属实** |
| app 侧无 143 路径、唯一 SIGTERM 注册点 | main.ts:214-216（SIGTERM/SIGINT/SIGHUP 同步注册）；SA4 已枚举全树 `process.exit` 仅 0/1/注入缝三型 | **属实** |
| flaky 判定（零差异双态） | `gh run list`：`35534499992` success@`5b3ff26`、`35535478371` failure@`f3b13ee`（唯一非绿 job = `test (24, 6)`，`peer exit code: expected 143 to be +0`——失败证据日志原文一致）；两 head 间 `git diff` 仅 wiki/artifacts（iteration 3 已核） | **属实** |
| 修复形态 = 仓内先例 + 发布形态同构 | `root-lock-atomic-reclaim-red.test.ts:34` `fork(…, { execArgv: ['--import','tsx'] })`；`apps/yjs-server/package.json` `bin: nomicore-yjs-server → ./dist/main.js`（node 直跑） | **属实** |
| 机制敏感性（红/绿双证） | `relay-redgreen.log`：A 形态（`.bin/tsx`）143×3 且 `app-stopped=false`；B 形态（`node --import tsx`）0×3 且 `app-stopped=true`；`smoke-red-proof.log`：仓内仅还原 spawn 形态，新用例即以 CI 签名红（`hub (busy window) exit code: expected 143 to be +0`），跑后文件还原 | **成立**（红证明中「4 skipped」系 `-t` 名称过滤的运行形态，非文件内抑制） |
| CI 触发入口 | ci.yml :74-78 分片步骤原文；本地只读枚举 `node scripts/ci-test-shard.mjs 6 6` 确认本文件在 shard 6（`test (20, 6)`/`test (24, 6)` 均覆盖） | **属实** |

## 5. 测试质量与抑制面审查

| 检查项 | 结果 |
| --- | --- |
| skip/only/todo/xit/xdescribe | 词边界 grep **零命中**（初筛 `xit(` 命中均为 `waitForExit(`/`signalAndExpectExit(` 子串误配，已排除） |
| 既有 4 用例断言面 | diff 逐行核对：认证 401/403/101、启动序 `provisioned→listening→ready`（port 0 实际端口）、verify-write 收敛 + hub 回读、SIGTERM 双进程 exit 0、锁释放重启 durable 回读 41、锁守卫 exit 1 + lock 匹配——**断言行与超时预算（30_000/60_000/180_000）逐字未动** |
| 143 容忍面 | `143` 全文件 5 处命中**均在注释**（根因记录）；无任何断言值改为/容忍 143 |
| 新用例断言强度 | exit `toBe(0)`；`app-stopped` 存在；尾序 `toEqual(['persistence-disposed','app-stopped'])`（全序列比对——缺事件、乱序、双拆卸链均红）；与 hub-peer-deployment.md:39 成文序（`… / persistence-disposed / app-stopped / …`）及 app.ts:632→:635 实现序一致 |
| 忙窗注入隔离 | blocker 运行时写入 tmp dir（零仓内 fixture）；`isAppProcess` 守卫（argv[1] 尾缀 `main.ts`）限定只作用于被测 app 进程；`appNodeOptions` 仅写入该次 spawn 的 env 副本，不污染 `process.env`；`afterEach` SIGKILL + rmSync 清理链覆盖新增 tmp dir（既有机制沿用） |
| 资源/生命周期对称 | `liveProcs`/`tmpDirs` 登记-清理对称；`waitForExit` 超时 SIGKILL + loud throw（带 stderr）；无吞错路径 |

## 6. Owner comment 5751613018 硬契约保持确认（本轮独立抽验）

| Owner 要求 | HEAD 证据（本审查现读） | 判定 |
| --- | --- | --- |
| ① drain-before-dispose **硬契约**（分层方案可接受） | ADR 0006 修订节第 3 条（:270 起，明文引用 comment 5751613018）：「宿主优雅停机在调用 `dispose()` 之前必须先 await `drain()`」+ 预算尽 = `persistence-drain-budget-exceeded` 可观察事件后的显式可观察退出而非违约 + file/memory 无 kind 特判；实现：app.ts:624 `awaitDrainWithBudget(adapter.drain(), budgetMs)` → :630 全仓唯一 `persistenceFiber.dispose()` → :632 `persistence-disposed` → :635 `app-stopped`；对外指引 hub-peer-deployment.md:285、cordis-plugin-hosting.md 同款 | **保持且被新锚强化** |
| ② 同步修订 ADR-0006 :86 dispose 定义 | ADR 0006 修订节第 4 条（:276 起）：「本节修订并扩展 :86 的 dispose 定义边界」——dispose 语义不变保持 abortive/有损、从来不是持久性屏障、持久性唯一经分层公开 drain 表达、否决「dispose 内部先 drain」论证在文 | **保持** |
| ③ dispose 保持 abortive + 分层公开 drain；retryDelayMs 解耦缺省保持现行为 | `75bd0ab` 提交态逐字节保持（本轮及全部后续提交对其零 diff）；contract.ts `readonly drain?`、lifecycle.ts 公共 `drain(targets?)`、retryDelayMs 动态回退不物化——iteration 0/1/2/3 终审结论沿用，本轮锚点抽验在位 | **保持** |
| 硬契约的可观察失败面不被测试放宽 | 新忙窗锚在旧 spawn 形态下确定红（红证明在案）；无任何容忍码/skip 引入；S-5a/b/c（shutdown 3 tests）与 SA6 契约（27+5）本轮证据日志全绿 | **强化** |

HEAD 提交对上述全部载体路径 **diff 为空**（§3）——纯测试/证据型提交在物理上不可能削弱契约面。

## 7. 证据完整性审查

| 证据 | 本轮独立核验 | 判定 |
| --- | --- | --- |
| CI 失败证据（`ci-failure-evidence.log`，untracked） | 与 `gh run list`/`gh api` 本轮拉取值一致：run `35535478371`、job `test (24, 6)`、head `f3b13ee`、`peer exit code: expected 143 to be +0` | ✅ 真实 |
| `shard6-node24.log`（untracked） | CI 步骤原文复跑（`ci-test-shard.mjs 6 6` + vitest 两防假绿旗标）；**66 files / 746 tests 全绿**——CI 基线 66 files/745 + 新增 1 用例 = 746，计数自洽 | ✅ 真实互洽 |
| `persistence-contract.log` / `shutdown-tests.log`（untracked） | 21 files/221 tests（含 SA6 契约 27+5、semantics 9）+ Type Errors: no errors；shutdown 3/3 绿 | ✅ 契约面闭合 |
| `generate-check.log` / `root-typecheck.log`（untracked） | `pnpm generate --check`（ci.yml :147 步骤原文）无 diff；root typecheck 15 段 tsconfig（含 apps/yjs-server） | ✅ 静态门闭合 |
| `app-suite.log`（untracked） | apps AGENTS 全套门：35 files/183 tests 全绿 | ✅ 模块门闭合 |
| `relay-redgreen.log` / `smoke-stability.log` / `smoke-red-proof.log` / `smoke-load-run{1..14}.log`（前两者 committed，余 untracked） | 机制 A/B 3×3、5 连跑全绿、仓内红证明（CI 签名逐字复现 + 还原核验）、14 次人工负载复跑——形态真实、计数互洽 | ✅ 真实 |
| `probe-memory.log`（committed） | 记录一次**失败的中间探针**（`ERR_MODULE_NOT_FOUND` ×3 TIMEOUT——探针脚本模块解析路径错误），被后续 `relay-redgreen` 探针取代；疑为促使 `spawnApp` 增加 `cwd: REPO_ROOT` 的取证轨迹。诚实留痕、无诊断结论负载 | ⚠️ 观察项（M-6） |
| 留档完整性 | HEAD 仅 committed 3/29 份 iter3 日志；**26 份（含 shard6、契约、shutdown、generate-check、typecheck、app-suite、红证明、CI 失败证据、负载复跑）仍为 untracked 工作区文件**——被 committed 的三份 SA 报告引用但未入库 | ⚠️ MINOR（M-1） |
| 上游评审留档 | SA8 conflict 报告（10 项 no-conflict / clear / requiresConflictRecheck **false**）、SA4 iteration 4（approve，0B/0M）、SA3 iteration 3（根因/范围申报/验证表）均随 HEAD 入库；其关键申报经本轮独立复核逐项成立 | ✅ 留档属实 |

## 8. 仓库 AGENTS / 工程惯例总核对（本轮触面）

| 条款 | 结果 |
| --- | --- |
| root AGENTS（模块 AGENTS 先读、worktrees 位置、issue tracker） | 本轮零模块源码改动；SA3/SA4/SA8 留档证实已读 `apps/AGENTS.md`/`apps/yjs-server/AGENTS.md`；worktree 由 Host 固定 |
| apps/yjs-server AGENTS 验证门（`tsc -p apps/yjs-server/tsconfig.json` + `vitest run apps/yjs-server/test`） | SA3 验证表两门均执行（app tsconfig 段含于 root typecheck 15 段日志；app-suite 35/183 绿）；「graceful shutdown 契约测试保持绿」的完成门因修复而恢复，未被绕开 |
| apps/yjs-server AGENTS 边界（单一拆卸链、stdout 严格 NDJSON） | 新用例单发一次 SIGTERM 走唯一 handler（main.ts:214）→ 单一停机链，尾序断言兼钉「双拆卸链」反模式；blocker 为测试注入物向 stdout 写合法 NDJSON，产品事件发射零 diff |
| docs/AGENTS：wiki/raw = 证据层非规范 | HEAD 的 3 份 wiki 更新均为证据层过程产物，无规范文本冒充 |
| 单一事实源 | 未引入任何新事实源：事件序唯一权威 = 产品 stdout（hub-peer-deployment.md 词表），退出码唯一权威 = 进程 exit code；blocker 源码内联常量于唯一用例文件，无第二拷贝 |
| 生命周期对称性 | 失败 run（红）→ 根因修复 → 本地绿证据 → 提交入库的应答链完整；CI 权威复跑为已登记的 Deferred 项（SA3 §Deferred、SA4 §C11、SA8 §8 行动 2），非缺口隐瞒 |
| 测试质量标准 | 真实 runner 发现（显式文件列表 + `--passWithNoTests=false`）；无 skip/only/todo；新锚敏感性经红证明锚定；SA6 契约文件零触碰 |
| 流程纪律 | SA 产出 → Controller 提交的分工保持；本审查未 commit/push/建 PR/调度其他 SA |

## 9. Findings（全部 MINOR，非阻断）

| # | 严重度 | Finding | 处置建议 |
| --- | --- | --- | --- |
| M-1 | MINOR（证据留档，本轮新增） | HEAD 仅入库 3/29 份 iter3 证据日志；被三份 SA 报告引用的关键验证日志（shard6-node24、persistence-contract、shutdown-tests、generate-check、root-typecheck、app-suite、smoke-red-proof、ci-failure-evidence、14 份负载复跑）仍为 untracked——若 worktree 清理则证据丢失，评审可追溯性受损 | 建议 Controller 循 iteration 2 先例以单独 `chore(ci): record …` 提交补入库；不阻断（无伪造，文件在工作区且在案引用） |
| M-2 | MINOR（留档计数，carry-forward） | SA3/SA8 报告记 smoke diff「+92/−5」，实测 numstat = **+98/−5**（SA4 §C12 O-5 已同款裁定：内容经逐行核对一致，出入系引用旧计数） | 无需返工；以实测数为准（本报告已按实测登记） |
| M-3 | MINOR（验证时序，本轮新增） | HEAD `d60760c` 尚无对应 CI run（`gh run list` 最新为 `f3b13ee` 的失败 run；PR #413 `headRefOid` 仍 `f3b13ee`；分支领先 `origin/main` 6 提交）——修复的权威 CI 复跑待 Controller 推送，属三方已登记 Deferred 项 | Controller 推送后以 `test (20, 6)`/`test (24, 6)` 复跑闭合；不阻断 |
| M-4 | MINOR（同类暴露面，carry-forward） | 其余 13–14 个 apps 测试仍用 `.bin/tsx` 包装形态（同一 30ms 转达窗 flake 风险）；SA3 §Deferred、SA4 §C11/§C12 O-2、SA8 §8 行动 3 均已登记并交 SA1/Controller 决策 | 后续变更集统一迁移 `node --import tsx` 或抽公共 spawn 助手；不阻断 |
| M-5 | MINOR（文档债，carry-forward） | `apps/yjs-server/AGENTS.md` 单一拆卸链摘要行未逐字反映新增 drain 等待步（iteration 0 起登记的残余文档债，本轮未触碰亦未加重） | 后续文档变更集补一行；不阻断 |
| M-6 | MINOR（证据负载，本轮新增） | committed 的 `probe-memory.log` 记录一次失败的中间探针（模块解析错误 ×3 TIMEOUT），无诊断结论负载（被 `relay-redgreen` 取代）；诚实留痕非伪造 | 无需动作；如补 M-1 入库时可一并加注其取证角色 |

## 10. 结论

- **HEAD `d60760c` 在仓库/工程标准全部维度符合**：恰 7 文件（1 测试修复 + 3 证据日志 + 3 评审留档），产品树零 diff、DENY 面零触碰（唯一 DENY 路径类目交叉已经 SA3 申报 → SA8 裁决 → SA4 裁定 → Controller 提交追认的完整权责链闭合）、conventional-commit 与工作区出口纪律保持。
- **无测试抑制**：既有断言面逐字冻结、零 skip/only/todo、143 零容忍（仅注释）、新忙窗锚反向加严并经红证明锚定敏感性——CI 门禁净强化。
- **证据真实互洽**：根因机制（tsx 30ms 回执窗 → SIGKILL + 143）经锁定依赖源码独立复核属实；flaky 双态经 `gh run list` 独立证实；各验证日志计数自洽且与 CI 基线咬合；留档缺口（26 份 untracked）与失败探针负载如实登记为 MINOR。
- **Owner comment `5751613018`（updated 2026-09-20T18:03:36Z，MEMBER，本轮 `gh api` 独立核对）要求的 drain-before-dispose 硬契约与 ADR-0006 对齐确认保持完好**：ADR 成文面（:270 无条件条款、:276「修订并扩展 :86」）、app 结构性强制面（drain :624 先于唯一 dispose :630）、契约/验收三层锚点全部在位且本轮零触碰；新回归锚把硬契约在忙窗不利条件下钉成可执行红/绿。
- **Verdict: approve**（0 BLOCKER / 0 MAJOR / 6 MINOR 非阻断）。
