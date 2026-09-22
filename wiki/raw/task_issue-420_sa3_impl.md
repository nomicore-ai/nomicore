# SA3 Implementation Report — issue #420：SessionHost 公共工厂 + 内存管道完整协议回合（spec #415 T3）

- 派工（iteration 0，实现）：`sa-21b8addd-f3ef-41b2-a768-c5530fc7c893`（role `mabf-sa3`，phase implementation，iteration 0）
- 派工（iteration 1，finalization repair）：`sa-ef1c290c-a552-4c83-a1ac-73ad3f806405`（role `mabf-sa3`，phase implementation，iteration 1）——本报告在该轮原位更新
- 派工（iteration 2，finalization-repair 证据集 × 权威基 rebase 准备）：`sa-3974e1e9-834e-43ad-9cca-08acb5605efe`（role `mabf-sa3`，phase implementation，iteration 2）——本报告在本轮原位更新
- 派工（iteration 3，rebase 前工作树准备：脏面裁定 × `25c51cd` 零冲突复认 × 派生缓存修复）：`sa-f36d0903-db28-46ce-9bcf-396d3d8ae18f`（role `mabf-sa3`，phase implementation，iteration 3）——本报告在该轮原位更新
- 派工（iteration 4，CI 红灯修复：PR #429 / `3f470fb` 的 typecheck + Node 20/24 矩阵）：`sa-5df08616-a9b8-446d-85c5-c249158e2883`（role `mabf-sa3`，phase implementation，iteration 4）——本报告在本轮原位更新
- worktree / branch：`/home/wangjian/nomicore-fix-issue-420`，`mabf/issue-420`
- iteration 0 基线 HEAD：`7039f6dae8e7d29f0c929492f0ca2119bc63afaa`（= PR #426 merge）；iteration 0 实施期间零 commit / 零 push
- 交付承载（iteration 1 亲验）：`a315e7077576951cf0330596cdc588afbeca51be`（`feat(ws-replication): expose session host factory`，父 = `7039f6d`）——iteration 0 的 13 个 ALLOW 路径改动已由 Controller 提交；iteration 1 起点 `git diff HEAD -- packages docs CONTEXT.md` 为空
- 权威基（iteration 2 复认）：`1f5809b001c984e63fac3bafd4c1f3febc76e8a8`（= PR #427 merge，issue #421）；iteration 2 仍未执行 rebase/commit/push（交付分支零触碰）
- iteration 2 证据日志（新增）：`artifacts/sa3-issue420-finalize-rebase-evidence.log`，sha256 `bd4b5bfd0385916823c26fd6fdf54dbaa7e3ca0d66cd2663875312b6739d64a3`
- 授权父基（iteration 3 复认，第二段 rebase 目标）：`25c51cd45a3e4ec1cf8bcdbdcb33ff1f13d1b0df`（= PR #416 当前 head / PR #428 merge，issue #423）；iteration 3 起点 HEAD = `52a9e56534d56a75127207b2b9044afa8c3a27b0`（第一段 rebase 落地点）
- iteration 3 证据日志（新增）：`artifacts/sa3-issue420-rebase-prep-25c51cd.log`，165 行 / 12703 B，sha256 `33411d6313bde44291f31e21d9aa928e2de9040d902bd4da74e6d456de2b5e85`
- iteration 4 修复面（CI 红灯 → 最小 TDD 修复）：PR #429 head `3f470fbcb6f10b0b26dced0fc05fceaec353494a`；失败作业 = `typecheck` + `test (20,1)` + `test (20,6)` + `test (24,1)` + `test (24,6)`（run `35663498235`，其余 11 作业含 `contract-gates`/`codegen-freshness`/`packaging`/分片 2–5 全绿）；根因 = 父增量 #423 的三个测试文件仍按重命名前符号名 `HubSessionHost`/`createHubSessionHost` 构造内部 splice；修复 = **零生产代码**、两文件的机械符号名跟随（含 `HubSessionSink` 类型改由 `hub-split.js` 导入），断言与用例体逐字不变
- iteration 4 证据日志（新增）：`artifacts/sa3-issue420-ci-fail-evidence.log`（修复前 CI 定证）/ `artifacts/sa3-issue420-ci-typecheck-fail.log`（CI typecheck 原始失败步日志）/ `artifacts/sa3-issue420-local-typecheck-pre-fix.log` + `artifacts/sa3-issue420-local-prefix-wsrep-excerpt.log`（本地独立复现）/ `artifacts/sa3-issue420-ci-fix-{typecheck,tests,contract-anchors}.log`（修复后验证）
- Owner 评论：无（五轮派工均明文 none；REST comments = `[]`）⇒ 无逐条评论映射可建

---

## Iteration 4 — CI 修复轮：`3f470fb` 上 typecheck + Node 20/24 分片红灯的两文件机械跟随

- 派工：`sa-5df08616-a9b8-446d-85c5-c249158e2883`（role `mabf-sa3`，phase implementation，iteration 4）；Owner feedback requirements = none、REST comments = `[]`（本轮 `gh pr view`/`gh pr checks` 亲验）。
- 被修对象：PR #429（head `3f470fbcb6f10b0b26dced0fc05fceaec353494a`，base `spec/415-replication-transport-decoupling`）的失败 CI。派工明文允许「CI 日志在 workflow 进行中可能不可用」；本轮在 run 结束后取到**定证**（`gh run view --job <id> --log-failed`），并用本地独立复现交叉确认。
- 边界：**零生产代码改动**（`packages/ws-replication/src/**` 零 diff）、零断言/用例体改动、零 skip/only/todo/env override、零 `git add`/`commit`/`push`。

### 4.1 定证（修复前）

| 面 | 事实（命令/值） | 来源 |
| --- | --- | --- |
| run 结论 | `35663498235`：**5 fail / 11 pass**；失败 = `typecheck`、`test (20,1)`、`test (20,6)`、`test (24,1)`、`test (24,6)` | `artifacts/sa3-issue420-ci-fail-evidence.log` §A |
| `typecheck`（job `106543911063`，失败步 = `Typecheck (tsc)`） | 4 条错误：`ws-replication-issue423-observer-emission-split.test.ts(54,10)` TS2724 + `(54,37)` TS2305；`ws-replication-issue423-sa7-dynamic.test.ts(52,10)` TS2724 + `(52,37)` TS2305（均指向 `'../src/hub-session.js'` 的 `createHubSessionHost`/`HubSessionHost`） | 同上 §B + `artifacts/sa3-issue420-ci-typecheck-fail.log` |
| `test (20,1)` / `test (24,1)`（job `106543911555` / `106543911521`） | `ws-replication-issue423-sa7-dynamic.test.ts` **3 用例红**（D-SEAM1a/b/c），全部 `TypeError: (0 , createHubSessionHost) is not a function`；`Test Files 1 failed ｜ 62 passed (63)` | 同上 §C |
| `test (20,6)` / `test (24,6)`（job `106543911524` / `106543911700`） | `ws-replication-issue423-observer-emission-split.test.ts` **5 用例红**（EM-C1e/C3a/C3b/C3d/C4b），同一 `TypeError`；`1 failed ｜ 66 passed (67)` | 同上 §C |
| 旁证（非本票面） | 同一 run 内 `contract-gates`/`codegen-freshness`/`packaging`/分片 2–5（Node 20+24）全绿 ⇒ 失败面被完全解释为上述两文件，无第二根因 | 同上 §A |
| 本地独立复现（Node v24.13.0 / pnpm 10.28.2） | `pnpm typecheck` ⇒ 同 4 条错误、`EXIT=2`；`vitest run packages/ws-replication/test` ⇒ `Test Files 2 failed ｜ 84 passed (86)`、`Tests 8 failed ｜ 750 passed (758)`（8 红 = 上述 3+5，逐条同一 `TypeError`） | `artifacts/sa3-issue420-local-typecheck-pre-fix.log`、`artifacts/sa3-issue420-local-prefix-wsrep-excerpt.log` |

### 4.2 根因（父基前移带出的语义碰撞，非文本冲突）

- #420 的 D9（SA6 §12.6 授权编辑 2）对内部 splice 做零行为重命名：`createHubSessionHost`→`createHubSessionSink`、`HubSessionHostConfig`→`HubSessionSinkConfig`、**删除** `export type HubSessionHost = HubSessionSink`（`hub-session.ts`），并把公共名称 `createHubSessionHost` 让给新公共 byte-seam 工厂（`hub-session-host.ts`，经 `src/index.ts`）。
- 父增量 #423（`7333f35`，经 merge `25c51cd` 进入权威基）带来 3 个测试文件；其中两个以**重命名前**的符号名从深路径构造内部 splice：`import { createHubSessionHost, type HubSessionHost } from '../src/hub-session.js'`。重命名后：`hub-session.ts` 只剩 `createHubSessionSink`（工厂）与配置型导出；`HubSessionSink` 接口在 `hub-split.ts`（`hub-session.ts` 不再导出该类型名）。
- 因此 SA8 iteration 5 §2-4 的「双层 merge-tree RC=0 零冲突」判断**在文本面上成立**，但语义面在**门禁**上破：这正是 SA8 RA2' 要求在新基树重取五门的意义所在。typecheck 直接命中；矩阵红因 = ESM 链接期具名导入缺席 ⇒ 值为 `undefined`，调用即 `TypeError`（**非**行为断言失败，故不涉及验收语义）。
- 归因面唯一：CI 5 个失败作业的每一处错误/失败都指向这两个文件的同一 stale 导入；无生产代码、无冻结面、无协议/ADR 文本卷入。

### 4.3 最小修复（落地形态）

| 文件（父侧 #423 测试） | 修复前 | 修复后 |
| --- | --- | --- |
| `packages/ws-replication/test/ws-replication-issue423-sa7-dynamic.test.ts` | `import { createHubSessionHost, type HubSessionHost } from '../src/hub-session.js';` + `import type { HubSessionEdgePort } from '../src/hub-split.js';`；`:171` `readonly host: HubSessionHost;`；`:189` `createHubSessionHost({` | `import { createHubSessionSink } from '../src/hub-session.js';` + `import type { HubSessionEdgePort, HubSessionSink } from '../src/hub-split.js';`；`:176` `readonly host: HubSessionSink;`；`:194` `createHubSessionSink({` |
| `packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts` | 同形（导入 `:54`；类型 `:442`；调用 `:460`） | 同形跟随（导入 `:59`/`:60`；类型 `:447`；调用 `:465`） |

- 逐行清单（`git diff -U0 | grep -E '^[-+][^-+]'`）= 每文件 **+5 行头注 + 2 行导入 + 1 行类型标注 + 1 行工厂调用**，共 `2 files changed, 18 insertions(+), 8 deletions(-)`；**断言、用例体、`describe/it` 名称、选择器、阈值零字节变化**；头注登记该跟随为「D9 机械跟随（父基前移后的符号名跟随）」并明示用例体与断言逐字不变。
- 类型导入跟随仓库既有权威形态：`HubSessionSink` 接口自 `hub-split.js` 导入（与 `src/hub-connection.ts:23` 后的 `hub-split` 类型面、`test/…issue418-…-structure.test.ts:41-46` 的既有写法同源）——首次尝试（把类型留在 `hub-session.js` 导入）被 `tsc` 以 `TS2459: declares 'HubSessionSink' locally, but it is not exported` 拒绝，已按上表修正（中间态未归档为证据）。
- **不采用的生产侧替代方案（决定性否决）**：在 `hub-session.ts` 恢复运行性别名 `export const createHubSessionHost = createHubSessionSink`（或再导出）会让 #418 冻结结构断言 `test/ws-replication-issue418-edge-session-split-structure.test.ts:618` `expect(Object.keys(sessionModule).sort()).toEqual(['createHubSessionSink'])` 转红——该断言要求 `hub-session.ts` 的**运行时导出面恰为 `['createHubSessionSink']`**；只恢复**类型**别名（`export type HubSessionHost = HubSessionSink`）不能修运行期 `TypeError`（且被 D9 明文删除）。⇒ 生产侧被冻结契约封死，跟随必须落在 stale 消费方（与 D9 对 #418 两测试文件的授权编辑同类）。
- 与 AC/验收语义的关系：AC1–AC5 的断言面、SA6 冻结签名、#418 冻结导出表、7 文件 listen 矩阵、#420 三契约**全部零改动**；修复只让既有 #423 断言能重新执行（修复后 8 红全绿，见 §4.4）。
- 未修改的 stale 面（登记延续）：`artifacts/sa6-issue420-{capability-gap,causality,sequence-discipline}-probe.mts` 仍用旧内部名；本轮以 `grep -rn artifacts tsconfig*.json vitest.config.ts package.json packages/*/tsconfig.json` **零命中**再证其不在任何编译 include 面（根 typecheck exit 0 为独立旁证）⇒ 仍按「Deviations #2」登记，`artifacts/**` 不在 ALLOW LIST，SA3 不动。

### 4.4 Verification（iteration 4：V29–V35）

| # | Command | Result | Evidence |
| --- | --- | --- | --- |
| V29 | `pnpm exec tsc -p packages/ws-replication/tsconfig.json` | **绿**：`PACKAGE_TSC_EXIT=0` | `artifacts/sa3-issue420-ci-fix-typecheck.log` |
| V30 | `pnpm typecheck`（根，15 tsconfig 串行 = CI `typecheck` 作业失败步逐字） | **绿**：`ROOT_TYPECHECK_EXIT=0`（修复前同命令 `EXIT=2` + 同 4 条错误） | 同上 + `artifacts/sa3-issue420-local-typecheck-pre-fix.log` |
| V31 | `vitest run <两 #423 文件> --typecheck.enabled=false --passWithNoTests=false` | **绿**：`Test Files 2 passed (2)` / `Tests 26 passed (26)` / `TWO_FILES_EXIT=0`（修复前同二文件 8 红） | `artifacts/sa3-issue420-ci-fix-tests.log` §V-F1 |
| V32 | `vitest run --typecheck packages/ws-replication/test`（包全量；含 test-d） | **绿**：`Test Files 90 passed (90)` / `Tests 785 passed (785)` / `PACKAGE_SUITE_EXIT=0`（文件数 **90** = SA8 RA2' 预期 87 + #423 三文件） | 同上 §V-F2 |
| V33 | `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck.only --passWithNoTests=false`（CI `typecheck` 作业第二步逐字） | **绿**：`Test Files 49 passed (49)` / `Tests 270 passed (270)` / `TYPECHECK_ONLY_EXIT=0` | 同上 §V-F3 |
| V34 | CI 分片命令逐字：`files=$(node scripts/ci-test-shard.mjs S 6); vitest run $files --typecheck.enabled=false --passWithNoTests=false`，`S∈{1,6}` | **绿**：分片 1/6 = `63 passed (63)` 文件 / `820 passed (820)` 用例（CI 修复前 `1 failed ｜ 62 passed (63)`）；分片 6/6 = `67 passed (67)` / `831 passed (831)`（CI 修复前 `1 failed ｜ 66 passed (67)`）；两 `SHARD_S_EXIT=0` | 同上 §V-F4 |
| V35 | 契约锚 + CI `contract-gates` 作业四步逐字 | **绿**：#420 三契约 + #418 两冻结锚（`--typecheck`）= `5 passed (5)` / `89 passed (89)`；`persistence-contract` 6/6、`registry-sa7-rev1 -t R5P` 1 passed ｜ 5 skipped（过滤预期）、`domains-scaffold` 2/2、`materialize-root` 59/59，四步 exit 0 | `artifacts/sa3-issue420-ci-fix-contract-anchors.log` |

- 卫生门：`git diff --check` RC=0；两文件 `trailing_ws=0 / cr=0 / blank_line_before_eof=0`；全部新增证据日志 `tw=0 / cr=0 / esc=0 / 末字节 LF`（CI 原始日志的 ANSI 与 CI 前缀仅在 §4.1 的**摘录**日志内做纯格式归一，语义零改动；`ci-typecheck-fail.log` 为原始失败步日志，仅去 ANSI 与行尾空白）。

**iteration 4 未运行面（职责边界）**：根 `pnpm test`（全仓 443 文件）——本修复只触 2 个测试文件的导入符号，SA6 红绿契约、包全量、两失败分片、typecheck 两步与 CI 契约门已全部实跑；新 commit 上的 CI 重跑属交付执行者（SA3 不 commit/push）。

**iteration 4 冻结态锚（供暂存/复核核对；V29–V35 全部在本冻结代码态上执行）**：

```text
sha256 packages/ws-replication/test/ws-replication-issue423-sa7-dynamic.test.ts
  = 778d2461f0421027c25c17bd817327dcccf14b3a53b4f92efa2e728852e0183c
sha256 packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts
  = 160565873bf980c0ee1042d699fc9da890ee74743222139097e095a60395681e
# 两文件 mtime 06:41:06 < 全部验证日志产出（06:45:07）⇒ 修复后代码零漂移；
# 此后仅本报告与证据日志变更（零代码字节变化）。
sha256 artifacts/sa3-issue420-ci-fail-evidence.log          = 9f77827e4e83b4c7f8bcfcb1364babb192db6ba1dc00ea995f4492b03c82dfaa
sha256 artifacts/sa3-issue420-ci-typecheck-fail.log         = d457d4bf83bd71f204ba79054890fb41a3fd6cbbc62c409c2630a4a533745297
sha256 artifacts/sa3-issue420-local-typecheck-pre-fix.log   = 4828bc9fd49d498971351ff144d5d0ceb0db145d3075d480240692907058ffcb
sha256 artifacts/sa3-issue420-local-prefix-wsrep-excerpt.log = 71565c341f64121c48c2109890ae2f2850bf2caa745e7c350b889d33a45c0b4b
sha256 artifacts/sa3-issue420-ci-fix-typecheck.log          = c664826a5673ebf4af01d440eeab594017db469b2c25f1f4e72bbb1945bdcb0d
sha256 artifacts/sa3-issue420-ci-fix-tests.log              = c0443302525406bded9d0644272d5dec1da852dd6e7ba630600a61b5810cb2e5
sha256 artifacts/sa3-issue420-ci-fix-contract-anchors.log   = a4c9caab5808aeac4fe72ef08fb8cb1b85bbac54ff922ebb137e2efc634248d8
```

---

## Iteration 3 — rebase 前工作树准备：脏面裁定 × `25c51cd` 零冲突复认 × 派生缓存修复

- 派工：`sa-f36d0903-db28-46ce-9bcf-396d3d8ae18f`（role `mabf-sa3`，phase implementation，iteration 3）；Owner feedback requirements = none、REST comments = `[]`。
- 授权目标：把 `mabf/issue-420` 重放到 Parent PR #416 当前 head `25c51cd45a3e4ec1cf8bcdbdcb33ff1f13d1b0df`（**第二段 rebase**；第一段已由 Controller 落地为 `9d2500d`（重放交付）+ `52a9e56`（证据归档））。Controller 的 rebase 被「未暂存产物」阻断；本轮职责 = 裁定脏面中哪些是**必须保留的有效证据**、把工作树收敛为**可精确暂存/提交的干净面**，并独立复认 rebase 机械面。
- 边界：**零 rebase、零 commit、零 push、零 PR**（SA3 角色禁 `git add`/`git commit`；交付分支、HEAD 与真实 index 零触碰）；**零业务字节改动**（`packages/ apps/ domains/ docs/ tests/ scripts/ CONTEXT.md/.editorconfig/vitest.config.ts/package.json/tsconfig*` 全空 diff）；暂存门一律经 `GIT_INDEX_FILE` scratch index。
- 证据日志（新增）：`artifacts/sa3-issue420-rebase-prep-25c51cd.log`，**169 行 / 13161 B / sha256 `ca860222485e6f1e7d8df9f87607266dee7d0ace67bbbfbd7e904ff69bc50b18`**（日志不自载摘要 ⇒ 自登记于本报告；该 digest 不含本报告任何字节）。

### Iteration 3 脏面裁定（「Preserve valid evidence」的落点）

| 路径 | 生产者 / 轮次 | 裁定 |
| --- | --- | --- |
| `wiki/raw/task_issue-420_implementation_conflict_report.md` | SA8 conflict-gate iteration 5（06:08） | **有效证据，保留并入档**：父基前移后二段路线的终认 `clear`（双层 merge-tree RC=0 预演、`index.ts` 并集 blob 原样过继、RA1'–RA6'、`requiresConflictRecheck: true` 窄域）——即本授权 rebase 的裁决依据 |
| `wiki/raw/task_issue-420_sa9_standards.md` | SA9 standards-review（05:53） | **有效证据，保留并入档**：rebase 后交付（`9d2500d` + `52a9e56`）的标准复审 `approve`（9 条 MINOR 全非阻断；`requiresConflictRecheck: true` 驱动 RA2 形式闭环调度） |
| `wiki/raw/task_issue-420_sa10_spec.md` | SA10 spec-review（05:55） | **有效证据，保留并入档**：rebase 后交付的 spec 复审 `approve`（R1–R9 rebase 保真度独立重取 + AC1–AC5 复核；残余项均为流程门/登记项） |

- 三条均为归档 commit `52a9e56`（05:42:26）之后的活性编辑；**不存在需删除、回退或修正的无效/陈旧/半写证据**：无冲突标记、无占位符/TODO、文件尾完整、末字节均为单 LF；时序自洽（SA9 05:53 < SA10 05:55 < SA8 06:08；SA9/SA10 审 `1f5809b` 基 rebased 交付，SA8 iteration 5 审父基前移后的二段路线）。
- 脏面除此之外**零残留**：无其它 tracked-modified、无非忽略 untracked（本迭代新增 1 条日志除外）、无暂存残留、`git stash list` 空、无 `.orig/.rej/.swp/.tmp` 残片。
- **「clean」可达边界的如实登记**：SA3 角色禁 `git add`/`git commit`（skill 明文），故本迭代不能把工作树变为字面零 diff。落点 = 把可提交面收敛为**上述有效证据（3 条）+ 本迭代 SA3 固定产物（2 条）= 恰 5 条**，并逐条通过 C1/暂存门，使 Controller 一次 `git add -A --` + `git commit`（配方见「Suggested commit message」）即得 clean 工作树并解除 rebase 阻断。

### Iteration 3 事实与动作

| 面 | 事实（命令/值） | 结果 |
| --- | --- | --- |
| 谱系 | HEAD `52a9e56534d56a75127207b2b9044afa8c3a27b0`，父 `9d2500dd84f59c0bfaa94c53eb1e9966cec82b42`，祖父 `1f5809b001c984e63fac3bafd4c1f3febc76e8a8` | 与第一段 rebase 落地点一致，本迭代零新 commit |
| 授权父基 | `git rev-parse origin/spec/415-replication-transport-decoupling` = `25c51cd…`；`git cat-file -t` = `commit`；`log -1` = `Merge pull request #428 from nomicore-ai/mabf/issue-423` | 与派工明文逐位相同，对象在场 |
| 拓扑 | `merge-base(HEAD, 25c51cd…)` = `1f5809b…`；`git rev-list --count 1f5809b..HEAD` = **2**（`52a9e56`、`9d2500d`） | 二段 rebase 重放集恰 2 commit |
| 零冲突预演（独立重取） | `git merge-tree --write-tree 25c51cd… 9d2500d…` ⇒ 树 `7b5c1cbc3bb77ea98e7b8669f09896624fde76c4`，RC=0；`… 25c51cd… 52a9e56…` ⇒ 树 `2cee6d03f05fb61f12a37c2a9a41170e60fbef86`，RC=0 | 双层 RC=0 且输出仅 1 行 tree OID ⇒ **零冲突、零手工消解**；与 SA8 iteration 5 登记值逐位相同 |
| 并集路径不动点 | 合并树内 `packages/ws-replication/src/index.ts` blob = `08fa49a1fb84321b92a4cae2da7ee401afdc7ce1` | == SA8 钉死的登记并集 blob ⇒ 父侧未触碰该路径，原样过继，旧「手工写并集」配方作废 |
| 重叠面 | 交付（`1f5809b..9d2500d`）× 父增量（`1f5809b..25c51cd`，23 路径）交集 = 恰 3 条：`docs/adr/0032-*.md`、`src/hub-session.ts`、`src/hub-split.ts` | 与 SA8 iteration 5 §2-5 一致，hunk 不交叠、auto-merge 双侧语义保留 |
| 归档顺序无关性 | 5 条可提交路径 ∩ 父增量 23 路径 = **空** | 归档 commit 可在 rebase 前或后重放，零冲突 |
| C1 卫生门（Host 精确口径） | 3 条证据 + 本报告：`trailing_ws_lines=0 / blank_line_at_eof=False / cr=0 / nul=False / ends_with_LF=True`；`git diff --check` 三路径 RC=0 | 全清 ⇒ 不会触发 Host `MABF_FINALIZE_REPAIR_REQUIRED` 归一化/阻断面 |
| 暂存门（scratch index） | `GIT_INDEX_FILE=<scratch> git read-tree HEAD` + `add -A -- <5 路径>` + `diff --cached --check` | `SCRATCH_GATE_RC=0`；逐条 staged blob == worktree blob；真实 index 零暂存 |
| 派生缓存修复 | 陈旧 commit-graph 使 `git rev-list --count --all` **fatal（exit 128）**、`git commit-graph verify` exit 2；备份后 `git commit-graph write --reachable --no-progress` | verify exit 0、`--all` 遍历 exit 0（328 commits）；refs 快照 sha256 `2b1007c4695e3c49d8c56c4b1139229b3331c68caa9111c6f42c5a3e25ca67fb` 前后不变、HEAD 不变 ⇒ 仅派生缓存更换 |
| 未执行面（边界） | `git diff --cached` 空、`git stash list` 空、reflog `HEAD@{0}` 仍为第一段 rebase finish、业务面 diff 0 条 | 无 rebase/commit/push/PR；交付分支零触碰 |

### File scope check（iteration 3，实际写入面）

| Changed path | 授权 | 用途 |
| --- | --- | --- |
| `artifacts/sa3-issue420-rebase-prep-25c51cd.log` | 本轮派工明文（rebase 准备）+ SA3 证据惯例（iteration 1/2 同款 `artifacts/sa3-issue420-*.log`） | 新增证据日志：脏面裁定 / 哈希 / C1 门 / 零冲突预演 / commit-graph 修复 / 精确暂存清单原文 |
| `wiki/raw/task_issue-420_sa3_impl.md` | SA3 固定产物（skill：原位更新实现报告） | 登记 iteration 3（活文档，提交字节以 Controller 暂存时为准） |
| （零其它工作树路径） | — | 3 条非 SA3 证据（SA8/SA9/SA10）与全部业务面在本迭代**零字节改动** |
| （`.git/objects/info/commit-graph`，非工作树路径） | 派生缓存（可重建，非源码/证据） | 陈旧态 → 一致态重建（备份 `/tmp/sa3prep/commit-graph.bak`，before sha256 `4bede9ae…`）；refs/HEAD/对象库零变化 |

### Verification（iteration 3：V22–V28）

| # | Command | Result | Evidence |
| --- | --- | --- | --- |
| V22 | `git status --porcelain -uall`；`git diff --cached --stat`；`git stash list` | 脏面 = 恰 3 条 tracked-modified 报告编辑（+ 本迭代 2 条 SA3 产物）；index 空；stash 空；无 `.orig/.rej/.swp` 残片 | 日志 §1 |
| V23 | `git rev-parse HEAD`/父链；`git merge-base HEAD 25c51cd…`；`git rev-list --count 1f5809b..HEAD`；`git cat-file -t 25c51cd…`；`git rev-parse origin/spec/415-…` | HEAD `52a9e56`；merge-base `1f5809b`；重放集恰 2；父基对象在场且与本地 ref 同值 | 日志 §0 |
| V24 | `git merge-tree --write-tree 25c51cd… {9d2500d,52a9e56}` | 双双 RC=0（树 `7b5c1cbc…` / `2cee6d03…`）；合并树 `index.ts` blob = `08fa49a1…` | 日志 §3.1–3.3 |
| V25 | 交付 × 父增量路径交集；5 条可提交路径 ∩ 父增量 | 重叠恰 3（ADR 0032 / `hub-session.ts` / `hub-split.ts`）；证据面交集空 | 日志 §3.4–3.5 |
| V26 | Host 口径 C1 扫描（逐行 `/[ \t]+$/`、EOF 空行、CR、NUL、末尾 LF）+ `git diff --check` 逐路径 | 4 条待提交面（3 证据 + 报告）全清；三路径 `--check` RC=0；本日志末稿复扫亦全清 | 日志 §2.2–2.4 + 本节末命令块 |
| V27 | scratch index 暂存门（`read-tree HEAD` + `add -A -- <5 路径>` + `diff --cached --check` + staged blob 身份） | `GATE_RC=0`；5/5 staged blob == worktree blob；真实 index 零暂存条目 | 本节末命令块 |
| V28 | `git commit-graph verify`；`git rev-list --count --all`；refs 快照 sha256 / HEAD 前后比对 | 修复前 exit 2 + fatal 128 → 修复后 exit 0 + `328`；refs 与 HEAD 逐位不变 | 日志 §5 |

**iteration 3 未运行的验证（职责边界）**：任何测试/typecheck 套件——本迭代零业务字节改动，SA6 红绿契约与包 typecheck 已由 iteration 0 的 V1–V7 覆盖；rebase 后新树的五门重取属 SA8 RA2'（SA4/SA7 证据链），见「Deferred verification」。

- iteration 3 终态命令块（真实 index 零写入；本报告定稿后执行）：

```text
$ GIT_INDEX_FILE=/tmp/sa3prep/scratch-index git read-tree HEAD
$ GIT_INDEX_FILE=/tmp/sa3prep/scratch-index git add -A -- \
    wiki/raw/task_issue-420_implementation_conflict_report.md \
    wiki/raw/task_issue-420_sa9_standards.md \
    wiki/raw/task_issue-420_sa10_spec.md \
    wiki/raw/task_issue-420_sa3_impl.md \
    artifacts/sa3-issue420-rebase-prep-25c51cd.log
$ GIT_INDEX_FILE=/tmp/sa3prep/scratch-index git diff --cached --check   # GATE_RC=0
$ # per-path staged blob == worktree blob identity check                # IDENTITY_FAIL=0
$ git diff --cached --stat | wc -l                                      # 0（真实 index 零写入）
```

- 触发条件：若授权父基 head 再前移（≠ `25c51cd…`），停止，先按 `git merge-tree` 复认冲突面再解（SA8 RA1'/RA4'）。

---

## Iteration 2 — 证据集备妥：精确提交清单 × 权威基 rebase 机械解

- 派工：`sa-3974e1e9-834e-43ad-9cca-08acb5605efe`（role `mabf-sa3`，phase implementation，iteration 2）；Owner feedback requirements = none、REST comments = `[]`。
- 目标：把 iteration 1 已批准的 finalization-repair 证据集**备妥为可精确暂存/提交的集合**（SA8 RA6），并对**权威基 `1f5809b`**（PR #427 = issue #421）的 rebase（SA8 RA1）给出机械可复现的准备证据。**零业务语义改动**：本迭代不触任何 `packages/`、`docs/`、`CONTEXT.md`、测试基础设施、config 或生成物字节。
- 证据日志（新增，冻结）：`artifacts/sa3-issue420-finalize-rebase-evidence.log`，**469 行 / 33524 B / sha256 `bd4b5bfd0385916823c26fd6fdf54dbaa7e3ca0d66cd2663875312b6739d64a3`**（日志不能自载摘要 ⇒ 自登记于本报告；与 iteration 1 同惯例；该 digest 不含本报告自身任何字节）。

### Iteration 2 事实与动作

| 面 | 事实（命令/值） | 结果 |
| --- | --- | --- |
| 候选集 | `git status --porcelain` = 3 tracked-modified + 16 untracked；本迭代新增 1 条日志 ⇒ 20 条 | iteration 1 的 18 条 → **20 条**：新增 `wiki/raw/task_issue-420_sa4_review.md`（SA4 iteration-1 原位评审；SA4 O13 明文要求随交付归档）与本迭代日志；无路径移除/改名/删除 |
| C1 形态 | 全 20 路径扫描（行尾空白 / CR / 末字节 / EOF 空行） | `C1_FAIL_COUNT=0`（19 条于本日志写入前全过；本日志自身亦过） |
| 暂存门 | scratch index：`read-tree HEAD` + `add -A -- <20 路径>` + `diff --cached --check` | `GATE_RC=0`；每条 staged blob == worktree 字节；真实 index 零暂存条目（SA3 不写 index） |
| 业务面身份 | `git diff HEAD -- packages docs CONTEXT.md .editorconfig vitest.config.ts package.json tsconfig*` 空；13/13 ALLOW 路径 blob == HEAD | `ALLOW_PATH_IDENTITY_FAIL_COUNT=0` |
| 冻结哈希完整性 | `evidence-reconcile.log` = `4f893393…`（与 SA8 报告 §2-4 登记值逐位相同）；`sa9_standards` `434fd836…`、`sa10_spec` `fba2b74a…` 不变；SA8 报告现值 `f3e2b357…`（iteration-7 原位更新字节，落在 RA6 hash 口径注记面内）、SA4 报告现值 `c70309a3…` | 无在册哈希承诺被破坏；两条现值首次落表（iteration-1 未登记） |
| rebase 事实 | merge-base `7039f6d`；分叉 4 vs 1；父增量 31 路径 ∩ 20 staging 路径 = **0**；全 OID `git merge-tree` → 树 `a24156e2…`、唯一冲突 `packages/ws-replication/src/index.ts`、stage blob `977bd3d`/`7e2f746`/`71fc417` | 与 SA8 历轮配方逐位复现；证据归档 commit 在 rebase 前后任意顺序重放均零冲突 |
| 并集解 | union blob `08fa49a1fb84321b92a4cae2da7ee401afdc7ce1`（2872 B / 95 行）：base→union 为纯增量（26 插 0 删）；值导出 11→13（+`createHubReplicationEdge`、+`createHubSessionHost`）、类型 44→59（+15，零删除） | 「纯并集唯一机械解」逐字成立；与 #418 冻结导出表 13 名全等断言相容 |
| 干跑 rebase | gitignored 临时 worktree `.worktrees/sa3-420-rebase-dryrun`（交付分支零触碰）：`git rebase 1f5809b` → 唯一冲突 → 写入 union → `--continue` ⇒ commit `c9653f0d…`（父 `1f5809b`）、tree `e777f961…` | 唯一冲突面与 merge-tree 完全一致 |
| 机械性证明 | `read-tree a24156e2` + `update-index --cacheinfo 100644,08fa49a1…,src/index.ts` + `write-tree` == `e777f961…` | `IDENTITY=YES`：干跑树 = merge-tree 自动合并结果 + 唯一冲突路径并集 blob ⇒ **冲突路径之外零手写内容** |
| 证据归档重放 | 在干跑树上把 20 条证据路径 `add -A --`（`diff --cached --check` RC=0）后 commit：run #1 = `49ed8bda…`（tree `9d7d4de3…`，父 = 干跑 rebase commit `c9653f0d…`）；`git diff c9653f0 49ed8bd -- packages docs CONTEXT.md …` 空；逐路径 `git show HEAD:<p>` 与工作树字节比对 **20/20 相同**（18 条冻结行 = 日志 §2 表值，含 reconcile log `4f893393…`） | 归档 commit 仅含证据、逐字节等于扫描集；「先归档后 rebase」与「先 rebase 后归档」两序皆零冲突（§5 交集 0） |
| 双侧保真 | 3 条 auto-merge 路径（`CONTEXT.md`/`hub-connection.ts`/#418 contract 测试）交付侧与父侧新增行缺失数均 = 0；13 条 ALLOW 路径中 9 条与交付树 blob 逐字节相同、4 条 = 双方并集（恰为 both-modified 集） | 交付内容零丢失、零改写 |
| 干跑门禁（**不闭合 RA2**） | 真装（`pnpm install --frozen-lockfile --offline`）后：V17 3 files/63 tests 绿 exit 0；V18 包 tsc exit 0；V19 包全量 **87 files / 749 tests** 绿 exit 0（= RA2 预期 87 文件）；V20 根 typecheck exit 0；AC3 listen 矩阵 7 files/52 tests 绿 | rebase 配方在干跑新树落地即绿（树绑定仍归真实 rebase 后的重取） |
| 交付树重取 | 当前交付树（a315e70 业务字节 + 20 条证据）：V17 3 files/63 tests 绿 exit 0；V18 包 tsc exit 0 | 与 iteration 1 同口径，零回归 |
| 环境陷阱（登记） | 以 symlink 共享 node_modules 的干跑首跑产生 4 条**伪红**（#421 test-d `TS2554: Expected 1 arguments, but got 0`，exit 1）；同命令在**真装**的父树 `1f5809b` 上 8/8 绿 exit 0 | 伪红已排除；证据一律取真装，日志 §8 明文禁止以 symlink 复现 |

### File scope check（iteration 2，实际写入面）

| Changed path | 授权 | 用途 |
| --- | --- | --- |
| `artifacts/sa3-issue420-finalize-rebase-evidence.log` | 本轮派工明文（证据集准备） | 新增证据日志：候选集/哈希/C1/暂存门/rebase 事实/并集解/干跑/后续重取义务原文 |
| `wiki/raw/task_issue-420_sa3_impl.md` | SA3 固定产物（skill：原位更新实现报告） | 登记 iteration 2（本报告为活文档，其提交字节以 Controller 暂存时为准） |
| （零其它路径） | — | 其余 18 条 staging 路径在本迭代**零字节改动**（含 iteration-1 的 13 条归一化路径、SA4/SA8/SA9/SA10 产物） |

- 收尾复跑：本报告与日志定稿后，对**冻结 20 条集合**再执行一次归档重放与全量门（C1 扫描 `C1_FAIL_COUNT=0`、scratch-index `GATE_RC=0`、staged==worktree `IDENTITY_FAIL=0`、真实 index 零暂存）。该次重放的 commit OID **不写入任何被暂存文件**（自指会改字节），随 SA3 iteration-2 结构化结果报出；被暂存文件自身的字节由「staged blob == worktree blob」门覆盖（活报告口径 = SA8 RA6 hash 注记）。
- 边界：本迭代**未**对交付分支执行 `git add/commit/rebase/push`；两个临时 worktree（`.worktrees/sa3-420-{parent-probe,rebase-dryrun}`）在收尾前删除，无新分支、无新 tag。
- 树绑定：干跑与交付树证据**均不闭合 SA8 RA2**；rebase 后须在真实新树重取五门（分工与命令见日志 §11）。
- 触发条件：若权威基 head 前移离开 `1f5809b`，停止并按 `git merge-tree` 复认冲突面后再解（SA8 RA1）。

---

## Iteration 1 — finalization repair：未提交证据集的 C1 归并

- 派工：`sa-ef1c290c-a552-4c83-a1ac-73ad3f806405`（role `mabf-sa3`，phase implementation，iteration 1）；Owner feedback requirements = none、REST comments = `[]`。
- 触发：finalization repair 诊断（`MABF_FINALIZE_REPAIR_REQUIRED` / `whitespaceViolations`）——把交付提交 `a315e70` 之后仍留在工作区的 16 条 #420 证据路径作为候选集暂存后，强制门 `git diff --cached --check` 报 **39 条 whitespace findings（27 trailing-whitespace + 12 blank-at-eof），分布于 13 条路径**。同一缺口已由 SA9 §10-M3 独立登记（「commit 证据集不完整……建议 finalize/提交方在同一交付归档中补齐」）。本轮目标 = 把这套证据集归并进既有交付使其**可提交（gate-clean）**，且**不改动任何已批准实现语义**。
- C1 规范形（沿用 #419 先例 `bd75a2c`）= `.editorconfig [*]`（`end_of_line=lf`、`insert_final_newline=true`、`trim_trailing_whitespace=true`）+ 门规则（`blank-at-eol`、`blank-at-eof`）：(1) LF 前无 `[ \t]`；(2) EOF 无 `[ \t]`；(3) 恰一个末尾 LF。
- 动作：对 13 条非 C1 路径执行 `perl -0777 -i -pe 's/[ \t]+(?=\n)//g; s/\n+\z/\n/' <path>`（**仅空白**）；3 条本已 C1 干净（`…_implementation_conflict_report.md`、`…_sa9_standards.md`、`…_sa10_spec.md`）零字节改动。SA3 不写真实 index（无 `git add`/`commit`/`push`）；全部暂存验证经 `GIT_INDEX_FILE` scratch index。
- 证据日志（冻结）：`artifacts/sa3-issue420-evidence-reconcile.log`，**656 行 / 53056 B / sha256 `4f893393b9fba731b8d843666472abb9d0eda554d17114d811abf884b2b0d2fe`**——含诊断复现、逐路径字节事实、无空白字节/内容行保持证明、scratch-index 逐条 C1 扫描、业务面零 diff 与重跑验证原文、精确 staging 清单与 post-commit 期望。

### Iteration 1 changed paths（证据面；零 code/test/doc 字节变化）

| Path | 生产者 | iteration 1 变更 | before sha256[:16] → after sha256[:16] | Δbytes |
| --- | --- | --- | --- | --- |
| `artifacts/sa3-issue420-design-letter-divergence.log` | SA3 | C1（去 EOF 空行） | `6022accc5312a3ac` → `b4c7f8540df30af2` | −1 |
| `artifacts/sa3-issue420-mutation-M1-a12-red-arm.log` | SA3 | C1（去 EOF 空行） | `7d4676dc92ee01a3` → `03237793be1e2fc5` | −1 |
| `artifacts/sa3-issue420-mutation-M2-drop-open.log` | SA3 | C1（8 行行尾空白 + EOF 空行） | `6361560ba4d7992e` → `d473d0bfc7205c92` | −9 |
| `artifacts/sa3-issue420-mutation-M3-restamp-sequence.log` | SA3 | C1（7 行行尾空白 + EOF 空行） | `4475bc3a025996a1` → `d53d4aa081e84e43` | −8 |
| `artifacts/sa3-issue420-mutation-M4-disable-shim.log` | SA3 | C1（去 EOF 空行） | `d0e080a70e35d6f9` → `a6025d4848875090` | −1 |
| `artifacts/sa3-issue420-mutation-M5-session-resequence-check.log` | SA3 | C1（8 行行尾空白 + EOF 空行） | `1050e2c52dd30697` → `36d7512090d04ee6` | −9 |
| `artifacts/sa3-issue420-mutation-M7-reopen-reentry.log` | SA3 | C1（去 EOF 空行） | `25d8b33ecd88fe93` → `1689afe6dc61d793` | −1 |
| `artifacts/sa3-issue420-mutation-M7b-drop-inflight-open.log` | SA3 | C1（去 EOF 空行） | `5fba2315da1fe3a3` → `b635a9474b43892d` | −1 |
| `artifacts/sa3-issue420-red-contract.log` | SA3 | C1（去 EOF 空行） | `6401bbc17ad66c43` → `75109f57b153a9e7` | −1 |
| `artifacts/sa6-issue420-runner-trigger-red.log` | SA6 | C1（4 行行尾空白） | `5202a6c9b0c7e573` → `b26a55ab841554b7` | −4 |
| `artifacts/sa7-issue420-focused-420-tests.log` | SA7 | C1（去 EOF 空行） | `45d4e82b64d00fa4` → `37565aeee394eacd` | −1 |
| `artifacts/sa7-issue420-listen-matrix-baseline.log` | SA7 | C1（去 EOF 空行） | `de80fcf5835ff9f9` → `9882feec7943e6ac` | −1 |
| `wiki/raw/task_issue-420.md` | Host 简报 | C1（去 EOF 空行） | `18f95b5d0011cf2d` → `2eb0d8cb0bae20ac` | −1 |
| `artifacts/sa3-issue420-evidence-reconcile.log` | SA3（本轮新增） | 新增证据日志（记录载体，candidate 集外） | — → `4f893393b9fba731` | +53056 |
| `wiki/raw/task_issue-420_sa9_standards.md` | SA9 | 无字节变化（本已 C1；未跟踪 → 纳入交付） | `434fd8364db0d855` | 0 |
| `wiki/raw/task_issue-420_sa10_spec.md` | SA10 | 无字节变化（本已 C1；未跟踪 → 纳入交付） | `fba2b74af08caffe` | 0 |
| `wiki/raw/task_issue-420_implementation_conflict_report.md` | SA8（iteration 6） | 无字节变化（本已 C1；tracked-modified → 纳入交付） | `590ef35da0e9dc4c` | 0 |
| `wiki/raw/task_issue-420_sa3_impl.md` | SA3（本文件） | 新增本 iteration 1 章节（记录载体，candidate 集外） | — | — |

### File scope check（iteration 1）

| Changed path | 授权 | 用途 |
| --- | --- | --- |
| 13 条既有证据日志 + `wiki/raw/task_issue-420.md` | 本轮派工明文（归并证据集使其可提交） | 仅 C1 空白归一化；非空白字节与 rstrip 内容行序完全一致（证据日志 §2 `CONTENT_PRESERVATION_FAIL_COUNT=0`） |
| `artifacts/sa3-issue420-evidence-reconcile.log` | 本轮派工明文（证据） | 归并与验证原文 |
| `wiki/raw/task_issue-420_sa3_impl.md` | SA3 固定产物（skill：原位更新实现报告） | 登记 iteration 1 |
| `wiki/raw/task_issue-420_{sa9_standards,sa10_spec}.md`、`…_implementation_conflict_report.md` | 非 SA3 写入（SA9/SA10/SA8 产物）；本轮仅纳入 staging 清单 | 交付归档补齐（SA9 §10-M3） |

- **零 ALLOW 代码/测试/文档路径改动**：13 条 ALLOW 路径（设计 §11）逐字节等于 HEAD blob（证据日志 §5 `ALLOW_PATH_IDENTITY_FAIL_COUNT=0`）；`packages/**`、`docs/**`、`CONTEXT.md`、`.editorconfig`、`vitest.config.ts`、`package.json`、`tsconfig*` 工作区与暂存 diff 全空。
- 真实 git index 零写入；无 hash registry 被破坏（#420 各报告未注册这些 artifact 的 sha256；40/64-hex 扫描仅命中 commit OID 与 HEAD ref）。
- **引用完备性（SA9 §10-M3 闭合判据）**：交付报告（HEAD 上的 `task_issue-420_{design,sa2_review,sa3_impl,sa4_review,sa6_contract,sa7_report}.md`）引用的全部 `issue420` artifact 路径现均为「`committed_at_HEAD`」或「本轮 staging set」，`UNRESOLVED_CITED_PATHS=0`；唯一不在场的 `artifacts/sa6-issue420-smoke.mts` 是 SA6 §16 明文登记为已删除的临时 smoke 脚本（非证据缺口）。
- 一致性：`artifacts/sa3-issue420-evidence-reconcile.log` 自身满足 C1（trailing-ws=0、blank-at-eof=0、恰一末尾 LF），嵌入的 gate 命中行以 `{WS}` 占位呈现（日志首节声明该约定）。

### Verification（iteration 1，归并后重跑；与 iteration 0 的 V1–V16 并列）

| # | Command | Result | Evidence |
| --- | --- | --- | --- |
| V17 | `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck <三契约路径>` | **绿**：`Test Files 3 passed (3)` / `Tests 63 passed (63)` / `Type Errors no errors` / exit 0 | 证据日志 §6 |
| V18 | `pnpm exec tsc -p packages/ws-replication/tsconfig.json` | **绿**：exit 0 | 证据日志 §6 |
| V19 | `… vitest run --typecheck packages/ws-replication/test` | **绿**：`Test Files 80 passed (80)` / `Tests 651 passed (651)` / `Type Errors no errors` / exit 0（与 iteration 0 V4 同口径，零回归） | 证据日志 §6 |
| V20 | `pnpm typecheck`（根 15 tsconfig 串行） | **绿**：exit 0 | 证据日志 §6 |
| V21a | `GIT_INDEX_FILE=<scratch> git diff --cached --check`（16 条证据 + 本日志 = 17 条候选）；逐条 staged-blob C1 扫描 | **CLEAN**：`GATE_RC=0`；C1 扫描 PASS 17/17（trailing_ws=0、blank_at_eof=0、末字节 LF、CR=0、canon-net=0、worktree==index） | 证据日志 §4（16 条 RC=0 / 16 PASS）；iteration 1 实测 17/17 |
| V21b | 同上，本报告更新后的 18 条全量候选（16 证据 + 日志 + 本报告） | **CLEAN**：`GATE_RC=0`；C1 扫描 PASS 18/18 | iteration 1 终态实测（命令见本节末） |

- iteration 0 的 V1–V16 取证于基线 `7039f6d` 上的工作区实现；该实现的 13 个 ALLOW 路径字节与交付提交 `a315e70` 逐字节相同（本轮 `git diff HEAD -- packages docs CONTEXT.md` 空 + 13 条 blob 身份核对），故其结论对当前交付树继续成立；V17–V21 为归并后在交付提交树上的独立重跑。
- V21a/V21b 实测命令（含本报告最终修订后的复跑；真实 index 零写入）：

```text
$ GIT_INDEX_FILE=/tmp/sa3-420-scratch-index-final git read-tree HEAD
$ GIT_INDEX_FILE=/tmp/sa3-420-scratch-index-final git add -A -- <18 candidate paths>
$ GIT_INDEX_FILE=/tmp/sa3-420-scratch-index-final git diff --cached --check
FINAL_GATE_RC=0
$ # per-path staged-blob C1 scan (trailing_ws / blank_at_eof / last byte / CR / canon-net / worktree==index)
FINAL_C1_SCAN_FAIL=0        # 18/18 PASS
```

---

## Inputs consumed

| 输入 | 用途 |
| --- | --- |
| `wiki/raw/task_issue-420.md` | Issue 正文 AC1–AC5、非目标 |
| `wiki/raw/task_issue-420_sa6_contract.md` | **冻结契约**：§12.1 公共签名逐字、§12.2 A1–A12、§12.3 AC3 机制 (a)、§12.4 C4a–C4d、§12.5 C5a–C5d、§12.6 两处授权编辑、§12.7 M1–M7、§12.0 运行命令 |
| `wiki/raw/task_issue-420_design.md`（iteration 1） | ALLOW/DENY LIST、§7 D1–D10、§12 验收映射、§14 SA2-F1 修订映射 |
| `wiki/raw/task_issue-420_sa2_review.md` | verdict **approve**（SA2-F1 已解决；N1'–N3' 非阻断观察） |
| `wiki/raw/task_issue-420_conflict_report.md` | SA8 前置门禁 **clear**（RA1–RA5、S1–S6） |
| `wiki/raw/task_issue-420_relevant_decisions.md` | ADR 0032 决策 1–5、CONTEXT.md:225-235、协议 §4/§7.1/§8-11/§13/§14/§17/§19/§23.1 |
| `wiki/raw/task_issue-420_design_conflict_report.md` | SA8 design 复查 **clear**（RA1'–RA6'，35 项对照） |
| `artifacts/sa6-issue420-*`（16 项） | 能力缺口/因果/序列纪律/纯度/中继保真探针与基线日志 |
| 源码开卷核对 | `src/{index,hub-session,hub-split,hub-edge,hub-connection,hub-namespace,frame-io,observer,defaults,validate,types}.ts`；`test/{harness,driver}.ts`、7 矩阵文件、#418 两冻结锚文件、`vitest.config.ts`、`packages/*/tsconfig*`、`package.json` |
| iteration 3 追加：`wiki/raw/task_issue-420_implementation_conflict_report.md`（工作区最新字节：SA8 iteration 5 终认） | 二段 rebase 授权面：新父基、零冲突预演、RA1'–RA6'、`requiresConflictRecheck` 口径 |
| iteration 3 追加：`wiki/raw/task_issue-420_{sa9_standards,sa10_spec}.md`（工作区最新字节） | 归档后两轮复审的 verdict 与其 recheck 依据（脏面裁定 + 归档口径） |
| iteration 3 追加：`wiki/raw/task_issue-420_design.md` §11 | ALLOW/DENY 面核对（本迭代零业务路径改动，确认无范围扩大） |
| iteration 3 追加：Host `mabf-runner` `MabfLocalFinalizer`/`MabfPreFinalizationRebaser` 语义（只读源码 + 诊断原文） | C1 卫生门与 clean-worktree 门的**精确口径**（逐行 `/[ \t]+$/`、EOF 空行；脏树 rebase 的 stash 事务先例） |

---

## Existing worktree reconciliation

| 项 | 事实 |
| --- | --- |
| 既有 `wiki/raw/task_issue-420_sa3_impl.md` | **不存在**（本轮首次实现；`ls` 核对） |
| 未提交实现残留 | **无**：初始 `git status --short` 仅显示 SA6 诊断产物（`artifacts/sa6-issue420-*`）与 wiki 输入（`??`）；`packages/**`/`docs/**` 零 diff |
| SA6 诊断资产 | 原样保留（未修改）；其中 3 个 `.mts` 引用被本轮授权重命名替换的内部名——登记见「Deviations」第 2 条 |
| 授权编辑核对 | #418 contract 测试 `FROZEN_PRODUCTION_EXPORTS` 由 11 → 12 名（仅插入 `'createHubSessionHost'`，字母序零重排）；structure 测试仅机械跟随重命名 |
| 决策面核对 | 公共冻结签名逐字采用 SA6 §12.1；`hub-namespace.ts`/`hub-edge.ts`/`src/testing.ts`/协议文本/上游包 **零 diff**（见 Verification V8） |
| iteration 1 起点（交付提交 `a315e70` 之后） | `git diff HEAD -- packages docs CONTEXT.md` 空（13 条 ALLOW 路径零 diff）；工作区仅 16 条未提交证据路径 —— 处置见「Iteration 1」节 |
| iteration 3 起点（归档提交 `52a9e56` 之后） | 工作区 = 恰 3 条 tracked-modified 活报告编辑（SA8 iteration 5 / SA9 / SA10）+ 零未跟踪、零暂存、零 stash —— 逐条裁定为有效证据后收敛为 5 条可提交面，见「Iteration 3」节；业务面 `git diff` 全空 |

---

## Changed paths

| Path | Design section | Change |
| --- | --- | --- |
| `packages/ws-replication/src/hub-session-host.ts` | §7 D1–D5 | **新增**（280 行）：公共冻结面（1 工厂 + 7 类型，逐字 SA6 §12.1）+ 句柄实现 + adapterPort（17 成员：闭包回放 ok-投影、字节出入、占位/回传序、dormant 面、observer 单点复用、信号面） |
| `packages/ws-replication/src/index.ts` | §7 D9 / AC1 / S5 | 追加 1 值导出 `createHubSessionHost` + 7 类型导出（append-only，11 → 12 值） |
| `packages/ws-replication/src/hub-session.ts` | §7 D9（U1） | 机械重命名：`createHubSessionHost`→`createHubSessionSink`、`HubSessionHostConfig`→`HubSessionSinkConfig`、删 `HubSessionHost = HubSessionSink` 别名、`HubSessionSinkImpl`；头注补公共工厂指引（零行为） |
| `packages/ws-replication/src/hub-connection.ts` | §7 D9 | import/调用点/头注机械跟随（3 行） |
| `packages/ws-replication/src/hub-split.ts` | §7 D9（仅头注） | 头注「绝不进 src/index.ts」→ 三工厂现状（成员/类型零变化） |
| `packages/ws-replication/test/issue420-shim-hub.ts` | §7 D6/D7 | **新增**（夹具）：宿主桥（三分支路由 + 有界 pending + 载体提交 + E10 兜底 + closed 守卫 + terminate 相位挂起）+ shim hub（accept/acceptTrusted 门链镜像 + 早到帧有界缓冲 + 真 edge 装配）+ 探针 |
| `packages/ws-replication/test/ws-replication-issue420-session-host-api.test-d.ts` | §12.1 / AC1 | **新增**：冻结签名正控全集 + 负控 `@ts-expect-error` ×6（denied 投影 / authorize / transport / port / `namespaceFrame` / `onFrame` 无 number） |
| `packages/ws-replication/test/ws-replication-issue420-session-host-round.test.ts` | §12.2 / §12.4 / §12.5 | **新增**：A1–A12 + C4a–C4d + C5a–C5c（内存管道对完整回合，无 socket 无 worker） |
| `packages/ws-replication/test/ws-replication-issue420-shim-matrix.test.ts` | §12.3（机制 (a)） | **新增**：`vi.mock` 仅替换 `createHubReplication` + 动态 import 7 矩阵文件（断言体零编辑）+ 末位反空跑 describe + 同 run unhandled rejection 哨兵 |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts` | §12.6 授权编辑 1 | `FROZEN_PRODUCTION_EXPORTS` 插入 1 行（零删除零重排） |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-structure.test.ts` | §12.6 授权编辑 2 | 7 行机械跟随（:13 注释、:39 导入、:421/:528/:571/:594 调用、:618 期望列表） |
| `docs/adr/0032-transport-decoupling-edge-session-split.md` | §7 D10 / RA1（E1+E2） | 澄清附录 +23 行：A1 信号词汇公共面映射（含 `connection-fatal` 公共化登记、同步 pipe 边界）、A2 决策 3 三载体调和（α/β/γ + 重 OPEN 语义）、A3 决策 5 dormant 降级 + U8 登记 |
| `CONTEXT.md`（:229-231） | §7 D10 / RA1（E2） | 「SessionHost」词条补公共工厂轨形态（描述子字段、句柄成员、denied/throw 不过公共缝、内部 splice 拉取式）与 _Avoid_ 一项 |

---

## SA2 Finding落实

| Finding ID | Implementation | Result |
| --- | --- | --- |
| **SA2-F1（MAJOR，设计 iter 1 已解决）** 桥 `openNamespace` 缺「同连接再 OPEN / authorized 在途 OPEN」分支 | 夹具 `HostBridge.openNamespace` 落**三分支路由**：① 相位 `authorized` → 不再调 `open()`，OPEN 帧字节经既有句柄 `handleFrame` 转发（`reopenForwarded` 探针）；② 相位 `routing` → 入与 `namespaceFrame` 同一有界 pending 窗口（≤16 帧/ns + 单帧 ≤ `maxFrameBytes`，溢出 `CONNECTION_POLICY_VIOLATION`(1008) 响亮收口），authorized 续体**同步段内**冲刷（`pendingFlushed` 探针）；③ 相位 `denied` → `denialSink.openNamespace`（生产 `onOpen` 承接重开矩阵）。路由相位互斥、单调、不可逆；closed 守卫放弃在途路由 | **已落实**。证据：矩阵 `ac1-ac2-open.test.ts:212`（opening 中重复 OPEN → `OPEN_OK`×2 + authorize 恰一次）与 `:240`（conflicted 后再 OPEN → `NAMESPACE_REOPEN_REQUIRES_RECONNECT`）在 shim 臂**断言逐字不变**全绿（V3/V4）；变异 M7（再 OPEN 重入 `open()` → 重复前置 throw）与 M7b（丢弃在途 OPEN）分别使两用例转红（V9/V10） |
| N1'（非阻断）closed 守卫放弃在途路由时挂起的 `terminateNamespace` promise 归宿未明示 | `terminateNamespace` 相位 `routing` → 挂起至路由完成（`settleTerminateWaiters` 按结局委托句柄/denialSink）；桥 closed 或续体异常 → **no-op resolve**（镜像 listen quiet 语义） | 已落实（A10 live 直调绿；该角落无验收路径触达，登记为 R11 同族） |
| N2'（非阻断）「pending 冲刷必须在续体同一同步段内完成」为隐式不变量 | `flushAuthorized`/`flushDenied` 在续体同步段内调用（相位置位后、无 await 间隔）；头注登记该不变量 | 已落实（矩阵 `:212` 用例即其载荷路径；M7b 反证） |
| N3'（非阻断）设计 :188 Map 键模板排版笔误 | 实现按语义落 `${connectionKey}\u0000${namespaceId}` | 已落实 |
| N1/N2/N3/N5/N6（iteration 0 遗留） | N1 → 夹具头注登记 accept 门链保真度差异清单；N2 → 本报告「Changed paths」单列 `hub-split.ts` 头注；N3 → 句柄连接投影头注登记 {ready, closed} 两态；N5/N6 → 维持登记 | 已按设计 §14 处置 |

---

## File scope check

| Changed path | ALLOW entry | Purpose |
| --- | --- | --- |
| `packages/ws-replication/src/hub-session-host.ts` | ALLOW 第 1 条（新增） | D1/D2/D3/D4/D5 唯一新生产代码 |
| `packages/ws-replication/src/index.ts` | ALLOW 第 2 条（追加导出） | AC1/S5 append-only |
| `packages/ws-replication/src/hub-session.ts` | ALLOW 第 3 条（重命名 + 别名删除 + 头注） | D9/U1 |
| `packages/ws-replication/src/hub-connection.ts` | ALLOW 第 4 条（机械跟随） | D9 |
| `packages/ws-replication/src/hub-split.ts` | ALLOW 第 5 条（**仅头注**） | D9（注释真实性；SA2 N2 单列登记） |
| `packages/ws-replication/test/issue420-shim-hub.ts` | ALLOW 第 6 条（新增夹具） | D6/D7；仅深路径 import（D8 mock 安全） |
| `packages/ws-replication/test/ws-replication-issue420-session-host-api.test-d.ts` | ALLOW 第 7 条（新增） | AC1 类型冻结 |
| `packages/ws-replication/test/ws-replication-issue420-session-host-round.test.ts` | ALLOW 第 8 条（新增） | AC2 A1–A12 + AC5 C5a–C5c + AC4 C4a–C4d |
| `packages/ws-replication/test/ws-replication-issue420-shim-matrix.test.ts` | ALLOW 第 9 条（新增） | AC3 机制 (a) + 反空跑 + 零 unhandled rejection |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts` | ALLOW 第 10 条（§12.6 授权编辑 1） | 冻结导出表插 1 行 |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-structure.test.ts` | ALLOW 第 11 条（§12.6 授权编辑 2） | 机械跟随内部重命名 |
| `docs/adr/0032-transport-decoupling-edge-session-split.md` | ALLOW 第 12 条（澄清附录 E1/E2） | RA1 |
| `CONTEXT.md`（:229-231） | ALLOW 第 13 条（词条更新） | RA1/E2 |

- 每个实际 changed path 均有 ALLOW 条目；**无 ALLOW 外改动**（V8 全量审计）。
- DENY LIST 逐项零 diff：`hub-namespace.ts`/`hub-edge.ts`/`src/testing.ts`/其余 src 单点/协议文本/上游包/`apps`/`domains`/`package.json`/7 矩阵文件（后者仅经 `vi.mock` 二次执行，零编辑）。

---

## Verification

> 全部命令在 worktree 根执行；日志 `artifacts/sa3-issue420-*.log`（worktree-relative）。最终冻结态顺序重跑（无并发变异探针）。

| # | Command | Result | Evidence |
| --- | --- | --- | --- |
| V1 | `pnpm exec tsc -p packages/ws-replication/tsconfig.json`（**红阶段**，实现前） | **红**：8 × `TS2305`（7 类型 + 工厂缺）+ `TS2307`（模块缺）+ 级联；`[tsc exit: 2]` | `artifacts/sa3-issue420-red-package-tsc.log` |
| V2 | `vitest run --typecheck <三契约路径>`（**红阶段**） | **红**：`Test Files 3 failed`、`Errors 7 errors`、`vitest exit: 1`（红因 = 能力缺口/模块缺席，与 SA6 `type-lock-red` 同形） | `artifacts/sa3-issue420-red-contract.log` |
| V3 | `vitest run --typecheck <三契约路径>`（**绿**） | **绿**：`Test Files 3 passed (3)` / `Tests 63 passed (63)` / `Type Errors no errors` / `[vitest exit: 0]` | `artifacts/sa3-issue420-green-contract.log` |
| V4 | `vitest run --typecheck packages/ws-replication/test`（包全量；listen 臂 + 新三文件） | **绿**：`Test Files 80 passed (80)` / `Tests 651 passed (651)` / `Type Errors no errors` / exit 0（SA6 基线 77/588 ⇒ +3 文件/+63 用例，零回归） | `artifacts/sa3-issue420-package-suite.log` |
| V5 | `pnpm exec tsc -p packages/ws-replication/tsconfig.json`（绿） | **绿**：`[tsc exit: 0]`（含 test-d 负控 `@ts-expect-error` 全部被触发，无 TS2578） | `artifacts/sa3-issue420-package-tsc.log` |
| V6 | `pnpm typecheck`（根，15 tsconfig 串行） | **绿**：`[typecheck exit: 0]` | `artifacts/sa3-issue420-root-typecheck.log` |
| V7 | `NODE_OPTIONS=--conditions=nomicore-source pnpm test`（根全量） | **绿**：`Test Files 443 passed (443)` / `Tests 5381 passed (5381)` / `Type Errors no errors` / `[root test exit: 0]` | `artifacts/sa3-issue420-root-test.log` |
| V8 | 结构/范围独立复核：`git diff --stat <DENY 全表>`（空）；`git diff --check`（clean）；`grep -rlE 'worker_threads\|MessageChannel\|MessagePort' packages/ws-replication/src packages/ws-replication/package.json \| wc -l` → `0`；node 侧 `Object.keys(@nomicore/ws-replication).sort()` → 12 名（11 冻结名 + `createHubSessionHost`，字母序位于 `createHubReplicationPlugin` 与 `createPeerReplication` 之间） | **符合**：DENY 零 diff、AC4 结构门 0 命中、导出恰增一名 | 本报告 §File scope check + V7/V3（C4a 结构门在测试内亦绿） |
| V9 | 变异 **M7**（再 OPEN 重入 `open()` → 重复前置 throw；临时改动，已复原）：`vitest run <shim 矩阵>` | **红**：`Tests 2 failed \| 51 passed`；`:240` 用例失败（`REPLICATION_ID_MISMATCH` ≠ `NAMESPACE_REOPEN_REQUIRES_RECONNECT`）+ 反空跑（`INTERNAL_ERROR` 签名）+ 日志含 `hub-session-host: (connectionKey, namespaceId) 重复开启` | `artifacts/sa3-issue420-mutation-M7-reopen-reentry.log` |
| V10 | 变异 **M7b**（丢弃在途 OPEN，取消分支 ②；已复原） | **红**：`:212` 用例失败（`opening 中重复 OPEN` 无第二 `OPEN_OK`）+ 反空跑 | `artifacts/sa3-issue420-mutation-M7b-drop-inflight-open.log` |
| V11 | 变异 **M4**（关闭 shim 替换，矩阵臂跑回 listen；已复原） | **红**：`Tests 1 failed \| 52 passed`——恰好末位反空跑 describe 红（52 listen 用例仍绿 ⇒ 反空跑判据非恒真） | `artifacts/sa3-issue420-mutation-M4-disable-shim.log` |
| V12 | 变异 **M5**（session 解码自行重检入站序；已复原） | **红**：`Tests 9 failed`，含 C5a 正锚与 C5c 结构门（`expectedSequence` 出现在 `src/hub-session-host.ts`） | `artifacts/sa3-issue420-mutation-M5-session-resequence-check.log` |
| V13 | 变异 **M2**（桥丢弃首 OPEN 转发；已复原） | **红**：`Tests 9 failed \| 1 passed`（A4 无 `OPEN_OK` 起全回合断言链断） | `artifacts/sa3-issue420-mutation-M2-drop-open.log` |
| V14 | 变异 **M3**（桥二次盖章序列；已复原） | **红**：`Tests 7 failed \| 3 passed`（含 A4–A8 缝序/wire 序纪律） | `artifacts/sa3-issue420-mutation-M3-restamp-sequence.log` |
| V15 | **M1**（内建红臂 A12：宿主不回传被分配序） | **绿/红按设计**：断言绿（观察到 `ACK_STATE_VIOLATION` 连接级 ERROR + `close(1002,'protocol-error')` + onSignal 命中），被断言对象红（回合不可达 `live`） | `artifacts/sa3-issue420-green-contract.log`（A12 用例）+ `artifacts/sa3-issue420-mutation-M1-a12-red-arm.log` |
| V16 | **M6**（公共入口去掉导出 = HEAD 态） | 已由 V1/V2 承载（红因 = 缺导出/缺模块） | `artifacts/sa3-issue420-red-*.log` |

**验收契约覆盖**：AC1（V3 类型冻结 + V8 导出面）、AC2 A1–A12（V3/V15：A2 纯 JSON+`DataCloneError` 负控、A3 kind ⊆ namespace 域、A4 `OPEN_OK`×1 + authorize×1 + W2 `NAMESPACE_NOT_FOUND` 负控、A5 快照序回指 + reconciling、A6 双向收敛、A7 双向 UPDATE/ACK + `update-acked` 零 resync、A8 wire 严格 +1 无 0 泄漏 + 出站占位 0/入站 wire 序、A9 `CLOSE_OK` 回指 + settled 恰一次、A10 revoke 收口零 fatal、A11 `close()` 幂等 drain + 零 unhandled、A12 红臂）、AC3（V4 60 用例 shim 臂 + 反空跑 + 零 unhandled；V11 负控）、AC4（C4a 结构门 + C4b/c/d）、AC5（C5a 回退序仍被消费 + `CLOSE_OK{ackedSequence:2}`、C5b edge 单点、C5c 结构门；V12 变异）。

---

## Deferred verification

| 项 | 归属 |
| --- | --- |
| 回归面扩大（真实 transport 动态、registry/scheduler 家族、backpressure/shed 族、跨包集成） | SA4/SA7（本报告只跑 SA6 指定面 + 全量套件，不承担最终动态验证） |
| **rebase 后五门重取（SA8 RA2，iteration 2 追加）** | 交付执行者 + SA4/SA7 证据链：rebase 落地后在真实新树重取（#418 契约 exact-equal + #420 三契约；双 test-d；包全量预期 87 文件；根 typecheck；AC3 矩阵逐字）。SA3 的 delivery 重取与 dry-run 树结果均为 **pre-rebase / scratch-tree 证据，不闭合该门**（日志 §11 已列命令与判据） |
| **第二段 rebase（`25c51cd` 基）后五门重取（SA8 iteration 5 RA2'，iteration 3 追加）** | 交付执行者 + SA4/SA7 证据链：`9d2500d`/`52a9e56` 上已归档的门证据绑定 `1f5809b` 基树，**不闭合新基树**；重取增量 = 包套件文件数预期 **87 → 90**（#423 三测试文件）、根 typecheck 须覆盖 #423 缝签名 × `hub-session-host.ts`/`issue420-shim-hub.ts` 编译面、#418 契约 13/13 与双 test-d 断言面不变、AC3 矩阵（shim 53 + listen 7/52）于 #423 观测发射拆分后的 src 之上逐字重跑为决定性证据；`sendQueueMs` 经 #420 公共缝整键缺席按 #423 注册的 dormant 形态核销 |
| **迭代 3 的 rebase 预演证据树绑定（iteration 3 追加）** | 本轮 merge-tree 预演（树 `7b5c1cbc…`/`2cee6d03…`）只是**执行前预测**，不是任何门的闭合证据；实际 rebase 出现任何冲突或需任何手工消解即与预演不符，按 SA8 RA4' 路由 |
| **新 commit 上的 CI 重跑（iteration 4 追加）** | 交付执行者：本轮修复落在工作树（SA3 禁 commit/push）⇒ `3f470fb` 上 5 个红作业须由 Controller 提交后在新 head 重跑确认转绿；本轮已用**与 CI 逐字相同**的命令在本地取到对应五门全绿（V29–V35），但**未在 CI 上取绿** |
| **SA8 对「机械跟随范围扩展」的复认（iteration 4 追加）** | SA8：原 ALLOW LIST 不含两个 #423 测试文件（它们随父基前移进入本树），本轮按其 D9「机械跟随」同类把符号名跟随落在这两文件（Deviations #6）；同时 **SA9 §2.4 的「全部 `test/*issue423*` 文件零 diff」卫生记录对修复后树不再成立**（对交付 commit `4e5ff0a` 仍逐字成立），须由 SA9/SA8 按新树口径更新 |
| **根 `pnpm test` 全仓重跑（iteration 4 追加）** | 交付执行者/SA7：本修复只改 2 个测试文件的导入符号（生产零 diff），包全量与两失败分片已实跑；全仓 443 文件不在本轮 SA3 职责面 |
| SA8 implementation 段冲突复查（R8''/RA3'/RA6'：零 diff 核对、导出恰增、S2 有界事实、observer 隔离单点、反空跑与 M1–M7 实跑登记、重命名纯机械） | SA8（触发条件三合一已在实现 diff 后成立） |
| 真 worker / 异步序回传形态、跨线程 pending 义务重入 | 后续票（U2/RA5'；本票只冻结同步宿主 pipe） |
| `listen:false` 插件 + `nomicoreHubSessionHost` 服务轨、peer 侧拆分、nomic-server 宿主接线、跨进程 revoke 全链路 | 后续票（设计 §1 非目标） |
| R6（`selectedCapabilities` 单 bit 反推）、R7（authorized 通道不投影 edge `.channels`）、R11（在途 revoke 时序观测边界）、R12（accept 门链保真度差异） | 已在夹具/设计登记；未来矩阵扩场景前须先扩设计 |

---

## Deviations or blockers

### 1（落实偏差，已登记，需 SA8 impl 复查裁决）：夹具「载体提交」替换设计 §7 D7 中「routing 相位非 OPEN 帧入 pending 窗口」的字面机制

- **事实**：设计 §7 D7 的 `namespaceFrame` 行规定相位 `routing` 的非 OPEN 帧入有界 pending 窗口（并自注「实践不可达：守规 peer 在 OPEN_OK 前零后续帧」）。但**冻结契约 AC3 的七文件矩阵中 `ws-replication-ac7-faults.test.ts:32-56` 故意注入该形态**：授权门闩悬挂时注入 UPDATE 并**在门闩释放之前**断言 wire 上出现 `NAMESPACE_STATE_VIOLATION`。字面实现下该帧留在窗口、ERROR 被推迟到结算之后 ⇒ 该用例红。
- **实测证据**：按设计字面实现的变体跑 shim 矩阵 → `Tests 2 failed | 51 passed`，失败项正是 `AC7 …错序：OPEN_OK 之前的 UPDATE → NAMESPACE_STATE_VIOLATION`（`artifacts/sa3-issue420-design-letter-divergence.log`）。
- **落地机制**（`test/issue420-shim-hub.ts`，夹具内装配路由）：相位 `routing` 下的**非 OPEN** ns 域帧改为**立即把该 ns 提交给 `denialSink`**（= 生产内部 splice + 真 port，与 listen 在首 OPEN 到达点建成的通道**同一生产机械**）：`denialSink.openNamespace(firstOpen)` → `denialSink.namespaceFrame(frame, sequence)`；相位置吸收态（不再创建公共句柄），入窗 OPEN 条目随提交放弃（listen：abort 时 `openWaiters` 静默丢弃）。OPEN 帧仍走上文分支 ② 的有界 pending 窗口（SA2-F1 要求原样）。
- **为何不是新架构/新协议决策**：① 承载机械仍是 nomicore 生产代码（决策 1「分布式实例化」许可），夹具零应答合成、零错误码选择、零 FSM；② 结果与 listen **逐点同构**（违例 ERROR 由通道自身状态机在同一到达点产出；后续帧由生产通道 quiet/terminal 守卫吸收；重 OPEN 落 `NAMESPACE_REOPEN_REQUIRES_RECONNECT`）；③ 不触公共冻结签名、DENY 面、port 17 成员集、U3 裁决方向、验收语义与任何断言；④ 改动面限于 ALLOW LIST 内夹具文件。
- **影响与请求**：请求 SA8 implementation 复查把本条与设计 §7 D7 文本差异一并裁决（建议方向：把 D7 的 `namespaceFrame` 行补成「非 OPEN 帧在 routing 相位即时提交生产承载；在途 OPEN 入有界 pending 窗口」）。SA3 不改设计文件（按 skill 边界）。

### 2（登记，非阻断）：SA6 三个诊断探针因授权重命名而陈旧

`artifacts/sa6-issue420-{capability-gap,causality,sequence-discipline}-probe.mts` 仍 import `../packages/ws-replication/src/hub-session.ts` 的旧名 `createHubSessionHost`（SA6 §16 保留的诊断资产）。该重命名由 SA6 §12.6/U1 明文授权；探针**不在任何 tsconfig/vitest/脚本 include 面**（`grep artifacts/ tsconfig*.json vitest.config.ts package.json` 零命中），不构成 gate 影响；`artifacts/**` 不在本票 ALLOW LIST ⇒ SA3 未修改，登记给 SA6/Controller（重跑探针需把 import/调用名换为 `createHubSessionSink`）。**（iteration 1 追加）**：归并派工下 SA3 对 13 条证据路径做了**仅空白**的 C1 归一化（见「Iteration 1」节与 `artifacts/sa3-issue420-evidence-reconcile.log`）；三个探针 `.mts` 的 import 名仍未改，本条登记继续有效。

### 3（测试锚替换，非契约软化）：AC3 反空跑中的 `ACK_STATE_VIOLATION` 锚点

SA6 §12.3 的反空跑举例含「生产信号面在场」。实测发现 `ac5-live` 的 `ACK_STATE_VIOLATION` 用例是 **peer 侧** fatal（`injectHub` 注入未知 `ackedSequence`），不经过本桥 `onSignal`；故末位 describe 改为锚 `settled`（≥1，经 `onSignal` 到达 edge）＋ 全 run 零 `INTERNAL_ERROR`（重复 `open()`/续体异常的红臂签名）＋ `carrierCommitted`/`reopenForwarded`/`pendingFlushed` 计数阈值。`connection-fatal` 通路的正控由回合测试 A12 红臂承担（断言绿/回合红）。矩阵断言体、验收语义与阈值强度未降低（V11 M4 反空跑负控仍红）。

### 4（无阻断项）：设计/ALLOW/契约均可实施，无 reject 事由

除上条 1 的机制替换外，设计 ALLOW/DENY、SA2 三项 required change、SA8 RA1'–RA6' 的落地面无阻塞；未发现需修改设计、扩大范围或改变验收语义的事项。

### 5（iteration 3，角色边界而非缺陷）：工作树「字面 clean」由 Controller 的归档 commit 收口

SA3 角色禁 `git add`/`git commit`/`git rebase`（skill 明文），因此 iteration 3 无法自行把工作树变为零 diff 或执行授权 rebase。本轮的可交付落点 = ① 脏面裁定（3 条归档后编辑全部为有效证据，无删除/回退面）；② 可提交面收敛为恰 5 条并逐条过 C1/暂存门；③ 零冲突预演与派生缓存修复的独立证据；④ Controller 一次 `git add -A --` + `git commit` 即 clean 并解除 rebase 阻断的精确配方。若 Controller 期望工作树在本轮结束时即为零 diff，则须由其本人执行该归档 commit（或其同款的 stash 事务）——本报告与证据日志 §7 已给出两条路径的完整命令。

### 6（iteration 4，**范围扩展，须 SA8 复认**）：修复落在原 ALLOW LIST 之外的两个父侧 #423 测试文件

- **事实**：本轮 CI 红灯（typecheck + 4 个分片作业）的唯一根因是两个父侧 #423 测试文件对**被 D9 授权重命名**的内部符号的陈旧引用。修复 = 这两文件的符号名机械跟随（+2 导入行 / +1 类型标注 / +1 工厂调用 / 每文件 +5 行头注），**零生产代码、零断言/用例体改动**。
- **为何原 ALLOW LIST 未列**：该表按 `1f5809b` 基树编写，两个文件当时**不存在**（随父增量 `1f5809b..25c51cd` 进入）；DENY 表「其余既有测试文件…零改动」同属该基树口径。故本轮改动**不是** DENY 面被改写，而是设计 D9「机械跟随」类的**新增落点**（同类先例 = ALLOW 第 10/11 条对两个 #418 测试文件的 §12.6 授权编辑）。
- **为何不回退到生产侧兼容**：`hub-session.ts` 的运行时导出面被 #418 冻结结构断言（`…issue418-…-structure.test.ts:618`，`toEqual(['createHubSessionSink'])`）钉死——恢复运行性别名会让该冻结契约转红；恢复类型别名既不修运行期 `TypeError`，又被 D9 明文删除。⇒ 最小且唯一自洽的落点就是这两个消费方文件的符号名跟随。
- **未触面**：`docs/`、`CONTEXT.md`、`docs/adr/**`、`docs/protocols/**`、`src/**`、`src/index.ts` 公共面、SA6 冻结签名、#418 冻结导出表、7 文件 listen 矩阵、`packages/ws-replication/package.json`、其余 `test/**`（`git status --short` 全集 = 2 个测试文件 + 7 条新增证据日志 + 本报告）。
- **请求**（`requiresConflictRecheck: true`）：SA8 按「范围扩展 / 机械跟随落点新增」口径复认本条，并把 SA9 §2.4 的 `test/*issue423*` 零 diff 卫生记录更新为「交付 commit `4e5ff0a` 零 diff；CI 修复 commit 仅允许该两文件的符号名跟随」。SA3 不改设计、ALLOW/DENY 表或 SA9 报告（按 skill 边界）。

### 7（无阻断项）：设计、SA6 红绿契约、#418/#420 冻结面在修复后仍可实施且全绿

修复后：包 typecheck / 根 typecheck / 包全量 90 文件 / `--typecheck.only` / 两失败分片逐字 / #420 三契约 + #418 两冻结锚 / CI `contract-gates` 四步全绿（V29–V35）；无断言软化、无 skip/only/todo、无 env override、无 fallback。SA3 不在本轮承担 CI 重跑与 commit/push（Deferred verification）。

---

## Suggested commit message

```
feat(ws-replication): 导出 SessionHost 公共 byte-seam 工厂 + 内存管道完整回合（issue #420）

- 新增 src/hub-session-host.ts：createHubSessionHost 工厂 + 7 冻结类型 + adapterPort
  （open() 描述子纯 JSON / handleFrame 字节入帧不重检序 / onFrame 同步回传被分配 wire 序 /
  onSignal{settled,connection-fatal} / terminateUnauthorized / close 幂等；决策 5 dormant 面）
- src/index.ts 追加 1 值 + 7 类型导出（append-only，11→12）；内部 splice 机械重命名
  createHubSessionHost→createHubSessionSink（hub-session/hub-connection/hub-split 头注）
- 新增测试：AC1 test-d 类型冻结（含 6 项 @ts-expect-error 负控）、AC2+AC4+AC5 内存管道
  完整回合（A1–A12 含红臂、C4a–C4d、C5a–C5c）、AC3 机制 (a) shim 矩阵重跑（7 文件断言
  逐字不变 + 反空跑 + 零 unhandled rejection）；夹具 test/issue420-shim-hub.ts（三分支路由 +
  有界 pending + 按准入结局路由 + E10 兜底）
- #418 两处授权编辑（冻结导出表 +1 行；结构测试机械跟随）
- RA1 文本：ADR 0032 澄清附录（信号词汇公共化 + 决策 3 三载体 + 决策 5 降级登记）与
  CONTEXT.md「SessionHost」词条更新
- 验证：契约三路径 63 tests 绿、包全量 80 files/651 tests 绿、根 typecheck 绿、
  根 pnpm test 443 files/5381 tests 绿；hub-namespace.ts/hub-edge.ts 零 diff；M1–M7 变异实跑登记
```

**iteration 0 实际承载**：Controller 已用英文提交 `a315e70`（`feat(ws-replication): expose session host factory`，父 `7039f6d`）；本块保留为原始建议文案。

**iteration 1 建议提交信息（证据归并，Controller 定稿）**：

```text
test(ws-replication): canonicalize issue 420 evidence contract

- C1-normalize the uncommitted issue #420 evidence set (12 artifact logs + Host brief):
  strip trailing whitespace before LF and the single trailing blank line at EOF
  (whitespace only; non-whitespace bytes and content lines byte-identical)
- add the round approvals (sa9_standards, sa10_spec), the Host brief and the current
  SA8 implementation conflict report to the delivery archive (closes SA9 section 10 M3)
- record artifacts/sa3-issue420-evidence-reconcile.log; zero implementation/test/doc byte change
```

**iteration 1 精确 staging 清单（18 条，worktree-relative）**：`wiki/raw/task_issue-420_implementation_conflict_report.md`、`artifacts/sa3-issue420-{design-letter-divergence,mutation-M1-a12-red-arm,mutation-M2-drop-open,mutation-M3-restamp-sequence,mutation-M4-disable-shim,mutation-M5-session-resequence-check,mutation-M7-reopen-reentry,mutation-M7b-drop-inflight-open,red-contract}.log`、`artifacts/sa6-issue420-runner-trigger-red.log`、`artifacts/sa7-issue420-{focused-420-tests,listen-matrix-baseline}.log`、`wiki/raw/task_issue-420.md`、`wiki/raw/task_issue-420_{sa9_standards,sa10_spec}.md`、`artifacts/sa3-issue420-evidence-reconcile.log`、`wiki/raw/task_issue-420_sa3_impl.md`（逐行 `git add -A --` 形式见证据日志 §7.4）。

**iteration 2 建议提交信息（证据归档，Controller 定稿）**：

```text
test(ws-replication): canonicalize issue 420 evidence contract

- archive the uncommitted issue #420 evidence set (13 artifact logs + Host brief +
  sa9/sa10 approvals + the current SA8/SA4 reports + the iteration-1 reconciliation log
  and the finalize/rebase evidence log); closes SA9 section 10 M3
- record the finalization-repair reconciliation and the authoritative-base rebase
  readiness (pure-union resolution for packages/ws-replication/src/index.ts)
- zero implementation/test/doc byte change
```

**iteration 2 精确 staging 清单（20 条，worktree-relative = `git status` 全集）**：

```text
git add -A -- \
  wiki/raw/task_issue-420_implementation_conflict_report.md \
  wiki/raw/task_issue-420_sa3_impl.md \
  wiki/raw/task_issue-420_sa4_review.md \
  artifacts/sa3-issue420-design-letter-divergence.log \
  artifacts/sa3-issue420-evidence-reconcile.log \
  artifacts/sa3-issue420-finalize-rebase-evidence.log \
  artifacts/sa3-issue420-mutation-M1-a12-red-arm.log \
  artifacts/sa3-issue420-mutation-M2-drop-open.log \
  artifacts/sa3-issue420-mutation-M3-restamp-sequence.log \
  artifacts/sa3-issue420-mutation-M4-disable-shim.log \
  artifacts/sa3-issue420-mutation-M5-session-resequence-check.log \
  artifacts/sa3-issue420-mutation-M7-reopen-reentry.log \
  artifacts/sa3-issue420-mutation-M7b-drop-inflight-open.log \
  artifacts/sa3-issue420-red-contract.log \
  artifacts/sa6-issue420-runner-trigger-red.log \
  artifacts/sa7-issue420-focused-420-tests.log \
  artifacts/sa7-issue420-listen-matrix-baseline.log \
  wiki/raw/task_issue-420.md \
  wiki/raw/task_issue-420_sa10_spec.md \
  wiki/raw/task_issue-420_sa9_standards.md
# commit 前/后各跑一次 git diff --cached --check（须 RC=0）；post-commit 逐路径哈希期望见
# artifacts/sa3-issue420-finalize-rebase-evidence.log §2 与 §10。
```

**iteration 2 rebase 配方（供 Controller 执行；SA3 不执行）**：`a315e7077…` rebase 到 `1f5809b001…`；唯一冲突 `packages/ws-replication/src/index.ts`，写入并集 blob `08fa49a1fb84321b92a4cae2da7ee401afdc7ce1`，其余文件零手工改写；20 条证据路径与父增量 31 路径零交集 ⇒ 证据归档 commit 可在 rebase 前或后重放且零冲突。rebase 落地后按日志 §11 重取五门（RA2），期间不得援引本报告与日志中的 pre-rebase / dry-run 结果作为新树证据。

**iteration 3 建议提交信息（rebase 前追加归档，Controller 定稿）**：

```text
chore: archive issue 420 round evidence before 25c51cd rebase

- archive the live reports produced after the 52a9e56 archive commit: the SA8
  conflict-gate re-confirmation for the moved Parent #416 head (25c51cd) and the
  SA9/SA10 approvals of the rebased delivery
- record the iteration-3 rebase preparation: dirty-face adjudication (all three edits
  are valid evidence), C1/staging gates, the independent zero-conflict merge-tree
  prediction (trees 7b5c1cbc / 2cee6d03; index.ts union blob 08fa49a1) and the stale
  commit-graph repair
- zero implementation/test/doc byte change
```

**iteration 3 精确 staging 清单（5 条，worktree-relative）**：

```text
git add -A -- \
  wiki/raw/task_issue-420_implementation_conflict_report.md \
  wiki/raw/task_issue-420_sa9_standards.md \
  wiki/raw/task_issue-420_sa10_spec.md \
  wiki/raw/task_issue-420_sa3_impl.md \
  artifacts/sa3-issue420-rebase-prep-25c51cd.log
# 随后 git diff --cached --check（须 RC=0）并 commit —— 提交后工作树即 clean、rebase 阻断解除。
```

**iteration 3 rebase 配方（供 Controller 执行；SA3 不执行）**：先按上列 5 条完成追加归档 commit（SA8 RA6'），再执行：

```text
git rebase --onto 25c51cd45a3e4ec1cf8bcdbdcb33ff1f13d1b0df 1f5809b001c984e63fac3bafd4c1f3febc76e8a8 mabf/issue-420
git rev-parse HEAD~1:packages/ws-replication/src/index.ts   # 须 = 08fa49a1fb84321b92a4cae2da7ee401afdc7ce1
```

预期**零冲突、零手工消解**（双层 merge-tree RC=0：交付级树 `7b5c1cbc…`、全 tip 树 `2cee6d03…`）；实际出现任何冲突即停、按 SA8 RA4' 回冲突门禁。备选路径 = Host `MabfPreFinalizationRebaser` 同款 stash 事务（`git stash push --include-untracked` → rebase → `git stash pop --index`），但**归档 commit 仍不可省**（Host finalize 的 clean-worktree 门会拒绝未提交证据）；两条路径的完整命令见 iteration 3 证据日志 §7。

**iteration 4 建议提交信息（CI 红灯修复，Controller 定稿）**：

```text
fix(ws-replication): follow the issue 420 D9 splice rename in the issue 423 tests

- the parent advance (#423, base 25c51cd) brought two tests that build the internal
  splice through the pre-rename names HubSessionHost/createHubSessionHost; after the
  authorized D9 rename (createHubSessionSink; the HubSessionHost alias deleted) those
  named imports no longer resolve, so `pnpm typecheck` and the test shards 1/6 and 6/6
  failed on PR #429 (run 35663498235) with TS2724/TS2305 and
  "TypeError: (0 , createHubSessionHost) is not a function"
- follow the rename in ws-replication-issue423-{sa7-dynamic,observer-emission-split}.test.ts
  (factory call, host type annotation, imports; the sink type now comes from hub-split.js)
  and register the follow in each file header
- zero production byte change; zero assertion/test-body change (no skip/only/todo,
  no env override); the #418 frozen export face (toEqual(['createHubSessionSink'])),
  the #420 frozen public API and the 7-file listen matrix are untouched
- verification: package tsc + root typecheck exit 0; the two files 26/26 green; package
  suite 90 files/785 tests green; --typecheck.only 49 files/270 tests green; CI shards
  1/6 (63 files/820 tests) and 6/6 (67 files/831 tests) verbatim green; #420 three
  contracts + #418 two frozen anchors 5 files/89 tests green; CI contract-gates steps green
```

**iteration 4 精确 staging 清单（10 条，worktree-relative）**：

```text
git add -A -- \
  packages/ws-replication/test/ws-replication-issue423-sa7-dynamic.test.ts \
  packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts \
  wiki/raw/task_issue-420_sa3_impl.md \
  artifacts/sa3-issue420-ci-fail-evidence.log \
  artifacts/sa3-issue420-ci-typecheck-fail.log \
  artifacts/sa3-issue420-local-typecheck-pre-fix.log \
  artifacts/sa3-issue420-local-prefix-wsrep-excerpt.log \
  artifacts/sa3-issue420-ci-fix-typecheck.log \
  artifacts/sa3-issue420-ci-fix-tests.log \
  artifacts/sa3-issue420-ci-fix-contract-anchors.log
# commit 前 git diff --cached --check 须 RC=0；提交后工作树 clean，随后由 Controller push 触发
# 新 head 上的 CI 重跑（5 个红作业应转绿；SA3 不 commit/push）。
```

**CI 修复后的预期门禁面（供 Controller 复核）**：`typecheck`（两步）、`test (20|24, 1)`、`test (20|24, 6)` 应转绿；`contract-gates`/`codegen-freshness`/`packaging`/`test (*, 2..5)` 在本轮修复前后均绿（修复不触其面）。若新 head 上仍有失败，则说明存在本轮未见的第二根因，须带新证据回 SA3/SA8，不得以本地绿替代 CI 绿。

---

## Iteration 5（仅空白终态修复：staged 证据的 EOF 空行）

**派工面**：Controller 归档 SA6 CI 修复轮证据时，`git diff --cached --check` 报 4 条 `new blank line at EOF.`。唯一授权动作 = 去掉这 4 个 staged 证据文件末尾的**一个空行**；禁改生产代码、测试、断言、语义，证据内容其余逐字节保全。owner comment 面为空（REST comments 返回 `[]`）。

**修复面（恰 4 条，worktree-relative）**：

| 路径 | 修复前 bytes / sha256 | 修复后 bytes / sha256 | Δ | 内容保全证明 |
| --- | --- | --- | --- | --- |
| `artifacts/sa6-issue420-ci-repair/03-head-package-suite.log` | 21508 / `e02b721e748b385e…` | 21507 / `4581b6f96850bc6c…` | −1 byte（217→216 行） | `new == index_blob[:-1]`，内容行逐行相等 |
| `artifacts/sa6-issue420-ci-repair/05-head-typecheck-only.log` | 4853 / `48aa61c4366e0542…` | 4852 / `6b72980b6fcd13a4…` | −1 byte（61→60 行） | 同上 |
| `artifacts/sa6-issue420-ci-repair/07-red-prefix-focused.log` | 13353 / `f2a9fadd71e1d565…` | 13352 / `9a701223ff888ac7…` | −1 byte（152→151 行） | 同上 |
| `artifacts/sa6-issue420-ci-repair/09-mutation-focused.log` | 13419 / `33120c392ce8cd53…` | 13418 / `6a1f31fa3adf7c96…` | −1 byte（132→131 行） | 同上 |

- 修复前四文件均满足 `worktree_bytes == index_blob_bytes` 且 `endswith(b"\n\n")`、不满足 `endswith(b"\n\n\n")`，即违规形态恰为「末尾一个空行」；修复 = 删去末位 LF，使文件以**恰一个** LF 收尾（`.editorconfig [*]`：`insert_final_newline = true` + `trim_trailing_whitespace = true`）。
- **内容锚逐条复验仍在**（取自 staged blob）：`03` = `Test Files 86 passed (86)` / `Tests 758 passed (758)`；`05` = `49 passed (49)` / `270 passed (270)` / `Type Errors no errors`；`07` = `2 failed (2)` / `8 failed | 18 passed (26)`；`09` = `2 failed (2)` / `5 failed | 21 passed (26)`。SA6 契约 §12 的 K5/K6 与红态引用行号口径不受影响（仅末行空行消失）。
- **无哈希锚受影响**：全仓 grep 确认没有任何报告/脚本记录这 4 个日志文件的字节数或 sha256（`07-red-sha256-*`、`09-mutation-sha256-*`、`11-final-state-recheck.log` 锚的是**源码/HEAD blob**，非这些日志）。

**验证**：

| 命令 | 结果 |
| --- | --- |
| `git diff --cached --check`（修复前） | RC=2，4 条 `new blank line at EOF.` |
| `git diff --cached --check`（修复后） | **RC=0** |
| `git diff --check`（worktree 对 index） | RC=0 |
| `git diff --name-only`（修复后） | 空（index == worktree，零未暂存残留） |
| `git diff --cached --name-status \| wc -l` | 41 → 42（原 41 条证据/报告路径集合不变，仅新增本报告；`git status --porcelain -uall` 路径集与暂存集逐条 diff 为空） |

**staging 说明（角色边界披露）**：本轮的验收门 `git diff --cached --check` 读的是 **index**，故修复必须落到暂存区才有意义。执行了**唯一一次**、**逐路径限定**的 `git add --`（4 个日志 + 本报告），未 `git add -A`、未 commit、未 push、未 finalize；除这 4 个文件的末位 LF 与本节文字外，index 中其余 37 条 staged blob 逐字节不变。若不希望本节随归档 commit 落账，Controller 可一条命令剔除：`git restore --staged -- wiki/raw/task_issue-420_sa3_impl.md`（不影响 `git diff --cached --check` RC=0 与四个证据文件的终态）。

**Deferred verification**：归档 commit 由 Controller 执行（`git diff --cached --check` 须 RC=0）；commit 后新 tip 的 CI 全绿由 Controller push 后定证（SA3 不承担）。

**Iteration 5 建议提交信息（Controller 定稿，可与 iteration 4 归档合并）**：

```text
chore: archive the issue 420 SA6 CI-repair evidence

- archive the in-place SA6 CI-repair contract rewrite and artifacts/sa6-issue420-ci-repair/**
  (3 harnesses, 1 probe, 31 logs) plus the SA8 CI-repair conflict report; closes SA4 O17
- drop the single trailing blank line at EOF in 4 evidence logs
  (03-head-package-suite, 05-head-typecheck-only, 07-red-prefix-focused, 09-mutation-focused;
   -1 byte each, content lines byte-identical) so `git diff --cached --check` is RC=0
- zero production/test/doc-semantic byte change
```

---

## Iteration 6（SA9/SA10 终审报告的 C1 提交门亲验：**被点名产物零字节改动**）

**派工面**：Controller 归档本轮「updated current」SA9 / SA10 终审报告（`wiki/raw/task_issue-420_sa9_standards.md` = SA9 iteration 4、`wiki/raw/task_issue-420_sa10_spec.md` = SA10 iteration 4；两条 mtime 07:38 / 07:41 晚于 HEAD `5ed3dc0` 的 07:32:08 归档时刻）前，授权**仅**修正 trailing whitespace 或 EOF 格式使其可干净提交；禁改审查结论、生产代码、测试、断言、语义。owner comment 面为空（REST comments 返回 `[]`）。

**亲验结论**：两条被点名产物在派工时点**已是 C1 规范形态**（`trailing_ws = 0` / `CR = 0` / 末字节单 LF / 无 EOF 空行），其 staged blob 上 `git diff --cached --check` **RC=0** ⇒ **无需任何字节修正**，两条产物**零字节改动**。唯一写入 = 本节文字。

| 核验点 | 命令 / 观察（本轮亲取） | 结果 |
| --- | --- | --- |
| 脏面精确性 | `git status --porcelain -uall` = 恰 2 行 ` M wiki/raw/task_issue-420_{sa10_spec,sa9_standards}.md`；`git ls-files --others --exclude-standard` 空；`git diff --cached --name-status` 空；`git diff --summary` 空（无 mode 变化）；`^<<<<<<<`/`^=======`/`^>>>>>>>` grep = 0 命中 | 提交面 = 恰这两条，零夹带 |
| 行尾空白 / CR | 逐行 `rstrip(' \t')` 比对 = **0 命中**（两条）；`b"\r"` 计数 = 0（无 CRLF）；非 ASCII 空白全字符扫描 `exotic = []`（无 NBSP / 全角空格 / ZWSP / U+2009 等）；空白行（whitespace-only line）= 0 | C1 过 |
| EOF 形态 | 末 4 字节：sa9 = `e3 80 82 0a`（`。` + 单 LF）、sa10 = `60 60 60 0a`（三个反引号 + 单 LF）；`endswith(b"\n\n") = False`（iteration 5 的「EOF 空行」违规形态**不存在**于两条报告）；HEAD 版与 worktree 版末 12 字节逐位相同 | C1 过 |
| C1 归一化干跑（幂等证明） | `diff <(perl -0777 -pe 's/[ \t]+(?=\n)//g; s/\n+\z/\n/' f) f` = **空输出**（两条）⇒ 文件已在 iteration 1/5 同一 C1 规范形上，归一化动作幂等、零字节 | 零字节改动 |
| 提交门（index 面，scratch index） | `GIT_INDEX_FILE=<tmp>` 逐路径 `git add --` 后：`git diff --cached --check` **RC=0**；加严 `-c core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,indent-with-non-tab` 仍 **RC=0**；`git diff --check`（worktree 对 index）RC=0；真实 index 零触碰（`git diff --cached --name-status` 仍空） | 可干净提交 |
| 字节锚（未改面） | worktree sha256 = `612c70b7fad20a7c…`（sa9）/ `c90baa45316c817f…`（sa10）；git blob OID = `5088ec48bbef8673…` / `5dcc50d8cd428f43…`；`git diff --name-only HEAD` 仍恰 2 条；`packages/`/`docs/`/`CONTEXT.md`/`.github/`/`scripts/`/配置与锁文件零路径 | 审查结论零触碰 |

**范围与角色边界**：本轮**未**修改两条被点名产物（0 字节）；未 `git add` 真实 index、未 commit / push / finalize。两条产物对 HEAD 的差分内容 = SA9 iteration 4 / SA10 iteration 4 的报告实质改写（非空白面，162+/136− 与 91+/131−），按派工「禁改 findings」**原样保全**并登记为待 Controller 归档面。

**顺带登记（只读扫描，非本轮授权面，零改动）**：`artifacts/sa6-issue420-ci-repair/**`（已随 `5ed3dc0` 入档、当前工作树 clean）存在两条既存形态项——`10-rest-comments-snapshot.log` 缺末位 LF（`final_nl = False`）、`07-red-prefix-root-typecheck.log` 行内含 1 个 U+2009 THIN SPACE（CI 原始输出抄录字节，非行尾）。二者**均不触发** `git diff --cached --check` 的任何规则（git 的 whitespace 规则不含「缺末位 LF」，U+2009 非行尾），不阻断任何提交；均不在本轮派工面（SA9/SA10 报告），SA3 未触碰。

**Deferred verification**：归档 commit 由 Controller 执行（`git diff --cached --check` 须 RC=0 —— 本轮已在两条产物的 staged blob 上预证 RC=0）；纯文档归档，无动态验证需求。

**Iteration 6 建议提交信息（Controller 定稿）**：

```text
chore: archive the issue 420 final SA9/SA10 review reports

- archive the post-rebase final SA9 (iteration 4) and SA10 (iteration 4) review reports
- both artifacts are already C1-canonical (trailing_ws=0, no CR, single trailing LF,
  no blank line at EOF), so `git diff --cached --check` is RC=0 with zero byte change
- zero production/test/doc-semantic byte change
```

---

## Iteration 7（Host 报脏的本报告更新：C1 亲验 + 单路径 staging 收口）

**派工面**：核对 Host 报脏的**唯一**未提交产物 `wiki/raw/task_issue-420_sa3_impl.md`（= iteration 6 那一节的写入，对 HEAD `1e521f0` 为 +34 / −0），确认其**无空白缺陷**后**仅**将该产物 stage，供 Controller 的必需归档 commit 使用；禁改业务代码、测试、断言、审查产物与语义。owner comment 面为空（REST comments 返回 `[]`）。

**亲验结论（staging 前，as-received）**：该更新**无任何空白缺陷** —— `trailing_ws = 0`（逐行 `rstrip(' \t')` 比对）/ `CR = 0` / `TAB = 0` / 非 ASCII 空白全字符扫描 `exotic = []`（无 NBSP / 全角空格 / ZWSP / U+2009）/ 空白行 = 0 / 末字节单 LF / 无 EOF 空行；**增量面自身**（`git diff -U0` 的 23 条非空新增行）的行尾空白与 CR/TAB 命中同为 0；C1 归一化干跑 `diff` 空输出（幂等、零字节）⇒ **无需任何字节修正**，Host 报脏内容逐字节保全（as-received sha256 = `07f0824c7b3a2bcb…`、blob OID = `9df5e90f0fcf8acb…`，HEAD blob = `d87f0ffe34a1898f…`）。

| 核验点 | 命令 / 观察（本轮亲取） | 结果 |
| --- | --- | --- |
| 脏面精确性 | `git status --porcelain -uall` = 恰 1 行 ` M wiki/raw/task_issue-420_sa3_impl.md`；`git ls-files --others --exclude-standard` 空；index == HEAD（`git diff --cached --name-status` 空）；`git diff --stat` = 1 file changed, 34 insertions(+), 0 deletions；`git diff --summary` 空（无 mode 变化） | 报脏面 = 恰本报告，零夹带 |
| 行尾空白 / CR / TAB | 逐行 `rstrip(' \t')` 比对 = **0 命中**；`b"\r"` 计数 = 0（无 CRLF）；`b"\t"` 计数 = 0；非 ASCII 空白全字符扫描 = 空；空白行（whitespace-only line）= 0 | C1 过 |
| EOF 形态 | as-received `len = 88397` 字节（本节文字为自指，追加后精确长度不再锚定；增量面见下两行）；末 4 字节 `60 60 60 0a`（三个反引号 + **单** LF）；`endswith(b"\n\n") = False`（iteration 5 的「EOF 空行」违规形态不存在）；末 24 字节尾部无尾随空白 | C1 过 |
| 增量面自查 | `git diff -U0` 新增行过滤后：行尾空白 0 命中、`\r`/`\t` 0 命中（新增的 34 行本身即规范形，非仅文件整体形态过） | C1 过 |
| C1 归一化干跑（幂等证明） | `diff <(perl -0777 -pe 's/[ \t]+(?=\n)//g; s/\n+\z/\n/' f) f` = **空输出** ⇒ 文件已在 iteration 1/5/6 同一 C1 规范形上，归一化动作幂等、零字节 | 零字节改动 |
| 提交门（staging 后，真实 index） | `git diff --cached --check` **RC=0**；加严 `-c core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,indent-with-non-tab` 仍 **RC=0**；`git diff --check`（worktree 对 index）RC=0 且 `git diff --name-only` 空（staged bytes == worktree bytes，无未暂存残留） | 可干净提交 |

**唯一动作与角色边界披露**：本轮执行了**一次**、**逐路径限定**的 `git add -- wiki/raw/task_issue-420_sa3_impl.md`（未 `git add -A` / `-u` / 通配，未 `git restore`，未 commit / push / finalize）。该 staging 是本派工面的显式要求（「stage only this artifact for the Controller's required archival commit」），相对技能默认边界「SA3 不执行 `git add`」属**经 Controller 明示授权的一次例外**，在此登记：staging 后 `git diff --cached --name-status` 恰 1 条且与 `git status --porcelain -uall` 的修改面逐条一致；不做 staging 则归档 commit 无内容可落。若 Controller 不需要，可一条命令剔除且不影响任何已验证结论：`git restore --staged -- wiki/raw/task_issue-420_sa3_impl.md`。

**范围与零语义变更证明**：本轮**未**触碰业务代码（`packages/` / `domains/` / `apps/` / `scripts/` / 配置与锁文件零路径）、测试、断言、CI 配置；**未**触碰任何审查产物（`wiki/raw/task_issue-420_sa{2,4,6,9,10}*`、`*conflict_report*`）；本报告 iteration 6 及其以上全部既有文字**逐字节保全**，唯一写入 = 追加上表这节文字。无 typecheck / 测试 / 静态生成语义面变化，故不产生新的动态验证需求。

**Deferred verification**：归档 commit 由 Controller 执行（`git diff --cached --check` 须 RC=0 —— 本轮已在真实 index 的 staged blob 上亲证 RC=0）；纯文档归档，无动态验证需求。

**Iteration 7 建议提交信息（Controller 定稿）**：

```text
chore: archive the issue 420 SA3 implementation report update

- archive wiki/raw/task_issue-420_sa3_impl.md (iteration 6 section: SA9/SA10
  C1 submission-gate verification, named artifacts zero-byte change)
- the as-received update is preserved byte-for-byte; it is already C1-canonical
  (trailing_ws=0, no CR/TAB, single trailing LF, no blank line at EOF), so
  `git diff --cached --check` is RC=0 with zero whitespace byte change
- zero production/test/doc-semantic byte change
```
