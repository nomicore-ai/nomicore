# SA6 诊断与验收契约 — CI repair：issue #420 / PR #429 CI 红灯（typecheck + test 分片 1/6・6/6）

> 轮次：acceptance-contract（iteration 1，**CI 修复轮**）。Dispatch `sa-1073bc5f-1320-42d6-bc1c-e220c77bc26b`（role `mabf-sa6`）。
> 任务类型：**Bug（CI repair）**。被诊断对象 = PR #429 head `3f470fbcb6f10b0b26dced0fc05fceaec353494a` 上
> CI run [`35663498235`](https://github.com/nomicore-ai/nomicore/actions/runs/35663498235) 的 5 个红灯作业
> （`typecheck` + `test (20|24, 1|6)`）；修复对象 = commit `2c87b3b`（两 #423 消费方测试文件的机械符号名跟随）。
> **结论：`approve`。** 红灯在本机以**单变量控制实验**逐字复现（生产树 `3f470fb..HEAD` 零 diff，仅换两消费方文件
> ⇒ 4 × TS2724/TS2305 + 8 × `TypeError: (0 , createHubSessionHost) is not a function`）；根因链以源码符号、
> 谱系事实与运行时探针闭合（9/9 PASS）；修复 commit 的 26 行机械集（断言/用例体零字节变化）在新 head `5a4049d`
> 上 **CI run 35665953800 = 16/16 绿**（原 5 个红灯作业全部转绿），PR #429 已 merge（`4ad13a35`，2026-09-21T23:08:48Z）。
> 契约门集（K1~K8）、负控（NC-A~NC-F）、变异敏感性与 runner 触发证据全部实测在册；禁止的修复方向经冻结锚证否。

**Summary (EN).** Task type = **Bug (CI repair)**. The reported CI red (run 35663498235, head `3f470fb`) is a
deterministic consumer-side symbol drift: the #420 delivery `4e5ff0a` renamed the internal splice exports of
`packages/ws-replication/src/hub-session.ts` (`HubSessionHost`/`createHubSessionHost` →
`HubSessionSink`/`createHubSessionSink`, design §7 D9) and followed the #418 consumers, but two #423 consumer test
files (inherited from the moved-forward parent base `25c51cd`) still bound the pre-rename deep-path names ⇒
`TS2724/TS2305` in `pnpm typecheck` and an ESM named-import `undefined` at runtime (8 cases). Root cause proven by a
single-variable experiment (production bytes identical between red and green heads; only the two consumer files
restored to their pre-repair bytes reproduce the exact CI failures) plus a runtime probe of the module surface.
The repair commit `2c87b3b` is a 26-line mechanical follow (imports + type annotation + call site + header note; zero
assertion/selector/case-body change), verified green by root typecheck, package suite, the two CI-verbatim failing
shards, `--typecheck.only`, and the post-repair CI rerun (16/16). Contract = the CI-equivalent gate set K1–K8 with
red/green expectations, negative controls, mutation sensitivity and the frozen-anchor constraints that forbid
production-side alias restoration. Verdict: **approve**.

---

## 0. 轮次与 supersession

| 项 | 值 |
| --- | --- |
| 本文件角色 | 固定 SA6 契约路径 `wiki/raw/task_issue-420_sa6_contract.md`；本**CI 修复轮**按 skill 纪律**原位修订**，只保留当前诊断/契约/证据（同 SA9 前例：新轮原位覆盖旧轮） |
| 前轮内容 | **feature 轮**（base `7039f6d`，SessionHost 公共工厂能力缺口契约，439 行）全文由 git 历史保存：`git show 4e5ff0a:wiki/raw/task_issue-420_sa6_contract.md`。其仍生效的条目见 **附 B（前轮契约索引）**——被 SA9/SA10 引用的 §12.1（公共签名冻结）、§12.6（授权编辑边界）、U1（重命名冻结）在该处可查 |
| 本轮不改动 | 生产实现、已合并的交付字节、任何既有测试文件、CI 配置、docs/CONTEXT；只新增 `artifacts/sa6-issue420-ci-repair/**` 证据/最小复现脚本 + 本报告 |

## 1. Task type and inputs

| 项 | 值 |
| --- | --- |
| 任务类型 | **Bug（CI repair）**：CI 红灯稳定复现 + 根因证明 + 最小可执行验收契约；不设计最终修复方案、不实现 |
| 派工 | `sa-1073bc5f-1320-42d6-bc1c-e220c77bc26b`；phase `acceptance-contract`，iteration 1；Owner comment requirements = none |
| 任务简报 | `wiki/raw/task_issue-420.md`（issue #420：SessionHost 公共工厂 + 内存管道完整协议回合；AC1~AC5） |
| CI 红灯证据 | `artifacts/sa3-issue420-ci-fail-evidence.log`（run 35663498235：head `3f470fb`，5 fail / 11 pass；§A 作业表 + §B typecheck 4 错 + §C 分片 1/6・6/6） |
| 上游产物 | `wiki/raw/task_issue-420_implementation_conflict_report.md`（SA8 CI 修复轮：clear；RA1''–RA5''）、`…_sa4_review.md` Part C（approve；O14–O16）、`…_sa9_standards.md`（CI 修复终审 approve；N3 = 新 head CI 复跑待 Controller）、`…_sa10_spec.md`、`…_sa3_impl.md`（SA3 iteration 4 修复报告）、`…_design.md` §7 D9 / §11 ALLOW·DENY LIST |
| 源码锚点 | `packages/ws-replication/src/{hub-session,hub-session-host,hub-split,index}.ts`；`packages/ws-replication/test/ws-replication-issue423-{sa7-dynamic,observer-emission-split}.test.ts`；`…issue418-edge-session-split-structure.test.ts`（C0c 冻结锚）；`packages/ws-replication/tsconfig.json`（`include: src/**/*.ts + test/**/*.ts`）；`.github/workflows/ci.yml`；`scripts/ci-test-shard.mjs`；`vitest.config.ts` |
| 本机/远端裁决输入 | REST 双端点亲验 `[]`（§2）；CI 复跑 run [`35665953800`](https://github.com/nomicore-ai/nomicore/actions/runs/35665953800)（head `5a4049d`，success）；PR #429 merged |
| 角色边界 | 只读诊断 + 报告/证据/最小复现脚本写入；`packages/**` tracked 文件零改动（临时探针已恢复，§16） |

## 2. Owner comment mapping

- 派工明文：**Owner comment requirements: none（REST comments returned `[]`）**。本轮独立复核（证据
  `artifacts/sa6-issue420-ci-repair/10-rest-comments-snapshot.log`，2026-09-21T23:12:04Z）：
  `issues/420/comments` = `[]`（`{state:"closed", comments:0}`）；`issues/429/comments` = `[]`；
  `pulls/429/comments` = `[]`；`pulls/429/reviews` = `[]`。⇒ **无逐条评论映射**。
- 由此验收口径 = 派工自带的唯一硬要求 + 冻结锚：**「修复 CI 红灯且不软化/不跳过任何测试」**，落位如下：

| 派工要求 | 落位 |
| --- | --- |
| 「Diagnose the newly reported CI failures」 | §5（正复现）、§8（根因链）、§9（因果实验）、§11（排除项） |
| 「define the minimal executable acceptance contract for repair」 | §12（K1~K8 门集 + 最小输入/命令 + 红绿期望 + 负控 + 禁止方向 + 入口证据） |
| 「Read the task brief, current CI evidence, and relevant upstream artifacts」 | §1 输入表；§3 SA8 约束（RA1''–RA5''） |
| 「Do not implement」 | 交付 = 本报告 + `artifacts/sa6-issue420-ci-repair/**`（探针/三支 harness/12 组日志）；`git status` 对 tracked 文件零 diff（§16） |

## 3. SA8 constraints

CI 修复轮的 SA8 产物 = `wiki/raw/task_issue-420_implementation_conflict_report.md`（原位更新的 implementation 复查；
`clear`：6 × no-conflict + 4 × implements-existing-decision / 0 hard-conflict / 0 override；`requiresConflictRecheck: false`）。
对本契约有约束力的条款（逐条落位）：

| # | SA8 条款 | 对本契约的含义 |
| --- | --- | --- |
| S1（RA1''） | 修复随交付变更集落地 + push；新 head 上 `typecheck` + `test (20/24, 1–6)` + `contract-gates` 须绿；若出现**不能完全归因于两文件 stale 导入**的失败 ⇒ 停车回 SA8（RA4''①） | 契约 K5 以「CI 复跑 16/16 绿 + 每项失败可归因」为形式闭合凭证；本轮已实测满足（run 35665953800） |
| S2（RA2''） | 形式闭合 = push 后新 head CI 绿（SA9 §8-N3 登记待 Controller） | 同上；本轮把该状态登记由「待办」更新为**已观测绿**（§13/§14），裁决权仍归 SA8/Controller |
| S3（RA4''） | 专家路由触发条件：① 新 head CI 失败根因超出两文件 stale 导入；② 实际 diff 超出 26 行机械集；③ 父 head 再前移未复认；④ 「恢复生产别名」或「#423 测试改道公共工厂」提案 | 契约 §12.4 把 ②④ 写成**禁止方向**（违反即非本契约范围内修复，须新 SA8 轮）；本轮 census = 恰 26 行（§5.3） |
| S4（RA5''） | 账本存续：D9 重命名跟随迄今覆盖 #418 两文件 + #423 两文件；后续内部缝消费方同名同类处理 | 契约 §12.6 给出「同类跟随」的可执行门集与口径注记（含 O14 的引用修正） |
| S5（SA6 §12.6/U1 边界） | 内部 splice 重命名（D9）为**零行为机械改动**；既有测试文件除授权编辑外不得改动；断言逐字不变 | 契约 K6 把「断言/用例体/选择器/金标零字节变化 + 用例数守恒 + 变异敏感」写成硬判据 |
| S6（#418 C0c 冻结锚） | `hub-session.ts` 运行时导出面 exact-equality `['createHubSessionSink']`（structure test :618） | 契约 K7 据此**证否**生产侧别名恢复；修复只能落消费方（§12.4） |

## 4. Environment and baseline

| 项 | 值 |
| --- | --- |
| worktree / branch | `/home/wangjian/nomicore-fix-issue-420`，`mabf/issue-420`（= PR #429 head 分支） |
| HEAD（本轮全程） | `5a4049d87bb3d244abed910e1bd372949501515c`（`docs: archive CI repair final reviews`；父 `2c87b3b`） |
| 远端状态 | PR #429 **MERGED**（merge commit `4ad13a35f782411d3c48096c31afa724f6eae067`，parents = `25c51cd`（base）+ `5a4049d`（head），mergedAt 2026-09-21T23:08:48Z）；issue #420 `closed/completed`（23:08:50Z） |
| 工具链 | node `v24.13.0`，pnpm `10.28.2`，vitest `3.2.7`（`pnpm exec vitest --version` 由运行日志体现）；4 vCPU / 14 GiB（本地），CI = ubuntu-latest × node 20/24 |
| CI 失败 run | `35663498235`（head `3f470fb`，5 fail / 11 pass，2026-09-21T22:35:52Z）：`typecheck`（job 106543911063）、`test(20,1)`（106543911555）、`test(24,1)`（106543911521）、`test(20,6)`（106543911524）、`test(24,6)`（106543911700） |
| CI 复跑 run | `35665953800`（head `5a4049d`，**success 16/16**，2026-09-21T23:05:53Z→23:08:37Z；`gh pr checks 429` 19=16 all pass，exit 0） |
| 门集 | `pnpm typecheck`（15 tsconfig 串行；`ws-replication` 为第 14 条，其 `include` 覆盖 `test/**/*.ts`）；`vitest run --typecheck.only`（`*.test-d.ts`，CI typecheck 作业第二步）；分片作业 `node scripts/ci-test-shard.mjs <shard> 6` + `vitest run $files --typecheck.enabled=false --passWithNoTests=false` |
| 谱系（亲验） | `4e5ff0a^` = `25c51cd`（PR #428 / #423 merge）；两 #423 测试文件自 `25c51cd` 至 `3f470fb` 零 commit 触碰（`git log 25c51cd..3f470fb -- <两文件>` 空）⇒ 交付时已是 stale 消费方；`4e5ff0a` 交付树 package 收集面 = 90 文件（`25c51cd` = 87 + #423 三文件） |
| 基线（本机、HEAD） | 修复后全绿：聚焦 2 文件 26/26；包全量 86 文件/758 用例；分片 1/6 = 63 文件/820；分片 6/6 = 67 文件/831；`--typecheck.only` 49 文件/270 且 `Type Errors no errors`；根 typecheck `EXIT=0` |

## 5. Positive reproduction

### 5.1 CI 原始红灯（证据 A：`artifacts/sa3-issue420-ci-fail-evidence.log`）

- **typecheck**（`pnpm typecheck`，exit 2）——4 条错误，逐字：

```
packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts(54,10): error TS2724: '"../src/hub-session.js"' has no exported member named 'createHubSessionHost'. Did you mean 'createHubSessionSink'?
packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts(54,37): error TS2305: Module '"../src/hub-session.js"' has no exported member 'HubSessionHost'.
packages/ws-replication/test/ws-replication-issue423-sa7-dynamic.test.ts(52,10): error TS2724: '"../src/hub-session.js"' has no exported member named 'createHubSessionHost'. Did you mean 'createHubSessionSink'?
packages/ws-replication/test/ws-replication-issue423-sa7-dynamic.test.ts(52,37): error TS2305: Module '"../src/hub-session.js"' has no exported member 'HubSessionHost'.
```

- **test 分片**：`test (20,1)`/`test (24,1)` 红 `ws-replication-issue423-sa7-dynamic.test.ts` 3/5 用例
  （D-SEAM1a/b/c）；`test (20,6)`/`test (24,6)` 红 `ws-replication-issue423-observer-emission-split.test.ts` 5/21 用例
  （EM-C1e、EM-C3a、EM-C3b、EM-C3d、EM-C4b）；全部失败消息同为
  `TypeError: (0 , createHubSessionHost) is not a function`（合计 8 红）。分片报告计数：`1 failed | 62 passed (63)` /
  `1 failed | 66 passed (67)`。
- 同 run 其余 11 作业绿（其余 4 个分片 × 2 node 版本、`codegen-freshness`、`contract-gates`、`packaging`）
  ⇒ 失败面**局部**且与 node 版本无关。

### 5.2 本机单变量红色复现（证据 B：`07-red-*`，harness `run-red-prefix.sh`）

控制变量：树固定为已修复 head（`HEAD=5a4049d`），且先证 `git diff 3f470fb HEAD -- packages/ws-replication/src
packages/ws-replication/test/issue420-shim-hub.ts docs CONTEXT.md .github scripts package.json vitest.config.ts` **为空**、
`git diff --name-only 3f470fb HEAD -- packages/` = **恰两消费方文件**；随后仅把这两个文件恢复为 `3f470fb` 字节
（sha256 `bc8c898f…` / `9838f489…`），其余全树不动：

| 项 | 结果 | 与 CI 关系 |
| --- | --- | --- |
| `pnpm exec tsc -p packages/ws-replication/tsconfig.json` | `EXIT=2`，4 条 TS2724/TS2305（文件/行/列/文案逐字同 CI） | 逐字同形 |
| `pnpm typecheck`（CI typecheck 作业命令） | `EXIT=2`，同 4 条错误 | 逐字同形 |
| `vitest run <两文件> --typecheck.enabled=false` | `EXIT=1`；`Tests 8 failed | 18 passed (26)`；`TypeError: (0 , createHubSessionHost) is not a function` × **8** | 8 红用例名逐条同 CI |
| 恢复 | sha256 与恢复前逐位相同；`git status --porcelain --untracked-files=no` 空 | 临时改动已闭合 |

### 5.3 机制隔离探针（证据 C：`06-mechanism-probe.log`，9/9 PASS）

`NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx artifacts/sa6-issue420-ci-repair/probe-stale-internal-import.mts`
（不触碰任何 tracked 文件）：

| 判据 | 观察 |
| --- | --- |
| A. 旧消费方绑定名缺席 | `typeof sessionModule.createHubSessionHost === 'undefined'`；调用得到真实 `TypeError: sessionModule.createHubSessionHost is not a function` |
| B. 改名后工厂在场 | `typeof createHubSessionSink === 'function'`；模块运行时导出面 `['createHubSessionSink']`（= #418 C0c 结构锚 :618 的 exact-equality 集合） |
| C. 公共面 ≠ 内部面 | 公共入口 `createHubSessionHost` 为 function 且与内部 splice 工厂**不同一**（`distinct: true`） |
| D. 负控 | 相邻模块 `createHubReplicationEdge`、公共入口 `createHubReplication` 在场（导入机制/环境正常） |
| E. 谱系 | `25c51cd:packages/ws-replication/src/hub-session.ts` 曾 `export function createHubSessionHost(config: HubSessionHostConfig): HubSessionHost` |

### 5.4 修复 commit 的机械集 census（证据：§13 表 + 下方 census）

`git diff 3f470fb 2c87b3b -- packages/` = **恰 2 文件、+18/−8（26 行变更）**，逐行分类：

| 类 | 每文件 | 说明 |
| --- | --- | --- |
| 头注 5 行 | +5 | 记录「#420 D9 机械跟随」的授权出处与「用例体、断言与选择器逐字不变」声明 |
| 深路径导入 2 行 | −1/+1 ×2 | `import { createHubSessionHost, type HubSessionHost } from '../src/hub-session.js'` → `import { createHubSessionSink } from '../src/hub-session.js'`；`HubSessionEdgePort` 类型行并入 `HubSessionSink`（自 `hub-split.js`） |
| 类型标注 1 行 | −1/+1 | `readonly host: HubSessionHost` → `HubSessionSink`（父树 `HubSessionHost` = `HubSessionSink` 的别名 ⇒ 同一类型） |
| 工厂调用 1 行 | −1/+1 | `createHubSessionHost({` → `createHubSessionSink({`（同一工厂、同一配置形态） |

**零** `describe/it` 名、断言、选择器、阈值、金标常量变更；修复后 sha256 = `160565873bf980c0ee1042d699fc9da890ee74743222139097e095a60395681e` /
`778d2461f0421027c25c17bd817327dcccf14b3a53b4f92efa2e728852e0183c`（= SA8 §1 登记值 = 本轮工作树字节）。

## 6. Negative control

| # | 负控 | 实测 | 排除的伪因 |
| --- | --- | --- | --- |
| NC-A | 同一命令在修复后 head 上运行 | 聚焦 26/26 绿（`01`/`11`）；根 typecheck `EXIT=0`；包 86/758、分片 63/820、67/831、typecheck.only 49/270 全绿 | 命令写错/入口失配/环境故障 |
| NC-B | 红态下同两文件的**其余 18 用例** | `8 failed | 18 passed (26)`：红恰为 8 个调用被改名工厂的用例 | 整文件加载失败/夹具或超时（非「全红」而是「精确 8 点」） |
| NC-C | 红/绿两态的生产树同一性 | `git diff 3f470fb HEAD -- packages/ws-replication/src …` 空；两态差异 = 恰两消费方文件 | 生产行为回归/环境漂移（单变量控制） |
| NC-D | 相邻第三份 #423 文件（`…issue423-update-offset-guard.test.ts`） | 对被改名符号 `HubSessionHost|createHubSessionHost|hub-session` **0 命中**，全程绿（包套件内） | 失败面外溢（无附带损伤） |
| NC-E | 变异敏感性（`09-mutation-*`，`run-mutation-sensitivity.sh`） | 生产单行变异：`hub-session.ts:63` 丢弃 `accounting` 透传（`this.sendData(ns, bytes, undefined)`）⇒ 同两文件 **5 failed | 21 passed (26)**（D-SEAM1a、D-SEAM1b、D-BURST1、EM-C4c、EM-C7a 红） | 修复后断言空转化/软化（断言仍绑定运行时行为） |
| NC-F | node 20 vs 24 分组 | 修复前两版本同 8 红、修复后两版本同绿（run 35663498235 → 35665953800） | 版本相关确定性缺陷 |

## 7. Stability, scale and timing

- **确定性**（非 flake）：红灯在 CI 两组 node 版本与两次本机独立复现（SA3 一轮 + 本轮一轮）中失败集合、文件、行号、
  错误文案**逐字一致**；修复后绿门在 6 次独立运行（聚焦 ×2、包套件、分片 1/6、分片 6/6、typecheck-only）与 CI 16 作业中
  全部稳定。无 sleep、无锁、无真实时钟依赖（被 #423 套件自身的 accounting 仪器保留原状，未被修复触碰）。
- **规模**：影响面 = 2 文件 / 8 用例；门集覆盖 = 包 86 文件 758 用例、分片 1/6（63 文件 820 用例）、分片 6/6（67 文件 831 用例）、
  `*.test-d.ts` 49 文件 270 用例、根 typecheck 15 tsconfig（全仓）。
- **时序/预算**（本机实测）：聚焦 1.7s；包套件 51s；每分片 ~51s（CI ~1–2m，含 install）；`--typecheck.only` 与
  `pnpm typecheck` 各 ~40s。⇒ 契约门集可在 CI 现有预算内逐字复跑，无需新增预算或特例。
- **本地 vs CI 分片文件数逐位一致**（63/67），说明分片枚举对新树稳定（`scripts/ci-test-shard.mjs` 磁盘枚举）。

## 8. Root-cause chain

| Step | Fact | Evidence | Confidence |
| --- | --- | --- | --- |
| S1 症状 | PR #429 CI：`typecheck` 4 条 TS2724/TS2305 + 分片 1/6・6/6 共 8 条 `TypeError: (0 , createHubSessionHost) is not a function` | run 35663498235；本机逐字复现（`07-red-*`） | 高（直接观测，双源同形） |
| S2 直接故障点 | `packages/ws-replication/src/hub-session.ts` 在 head 上**只**导出 `createHubSessionSink`（运行时面 `['createHubSessionSink']`）；旧名 `createHubSessionHost`/类型 `HubSessionHost` 已不存在 | 探针 A/B（9/9 PASS）；`grep ^export` 亲验（:299 工厂 / 无别名）；#418 C0c :618 exact-equality 锚 | 高（运行时 + 编译期双证） |
| S3 触发条件 | 两个 #423 消费方测试文件在 `:54`/`:52` 以深路径具名导入被删除的符号 ⇒ tsc 报错；vitest 变换后该具名绑定为 `undefined` ⇒ 用例内工厂调用抛 TypeError | 红态 4 TS + 8 TypeError；18/26 其余用例绿（NC-B） | 高 |
| S4 消费方为何 stale | #420 交付 `4e5ff0a` 执行 D9 重命名时跟随了 #418 两测试文件（同一 commit diff 内）与自身新测试，但两 #423 文件不在其 diff 内；而 `4e5ff0a^` = `25c51cd`（#423 已合入的父基）⇒ 两文件自交付起即为同树 stale 消费方（`25c51cd..3f470fb` 对其零触碰） | `git rev-parse 4e5ff0a^`；`git log 25c51cd..3f470fb -- <两文件>` 空；`4e5ff0a --stat` 含 #418 两文件不含 #423 两文件 | 高（谱系亲验） |
| S5 为何本地门未拦住 | 随交付归档的门日志**不覆盖交付树**：`sa3-issue420-package-suite.log` 自报 80 文件/651 用例且 `issue423` 命中 0，而交付树 package 收集面 = 90 文件（含 #423 三文件）；根测试日志 443 文件 vs 交付树全仓收集面 453 文件 ⇒ 门执行在「#423 尚未进入本分支」的旧快照上，基座前移后未重取门，CI 首次在全量合并树上执行 | 两归档日志全文（`git show 4e5ff0a:artifacts/…`）；文件面计数 `git ls-tree`（87→90 / 443→453） | 中高（「日志不覆盖交付树」= 直接观测；「日志产自哪棵更早的树」= 推断） |
| S6 最深根因 | **重命名的消费方清点用了过期快照**：D9 的义务面 = 「全仓内部缝消费方」，但交付在 base 前移前完成清点并沿用旧门日志；可捕获该类的编译门（package tsconfig `include: src+test`）存在且必红，只是未在合并树上运行 ⇒ 义务在「消费方清点」这一步失效，而非在重命名语义本身 | S5 + §4 谱系 + 红态 package tsc `EXIT=2` | 高（机制唯一自洽） |
| S7 修复方向约束 | head 上同模块**两个同名不同形**者并存（内部 splice `createHubSessionSink` ↔ 公共 `createHubSessionHost`，config 形态不同、绑定不同一）⇒ 修复只能让消费方跟随改名后的内部工厂；生产侧恢复别名会破 #418 C0c exact-equality（:618），改道公共工厂则改变被测面（SA8 RA4''④） | 探针 C（distinct）；structure test :618；SA8 §2-7/§3 | 高 |
| A1 放大因素 | ① `hub-session.ts` 的深路径消费在仓内是多点形态（#418 ×2、#420 夹具、#423 ×2）——单次重命名需要跨票清点；② 归档门日志与交付 commit 同体提交，容易把「旧树绿」误读为「交付树绿」 | §4 谱系 / S5 | 中（属流程放大，不是本红灯的必要条件） |
| E1 排除 | node 版本差异：两版本同红同绿（NC-F） | run 双矩阵 | 高（排除） |
| E2 排除 | #423 测试自身缺陷：断言/用例体在父基与修复后零字节变化；同文件 18/26 绿；红点集中在工厂调用 | §5.4 census；NC-B | 高（排除） |
| E3 排除 | 生产行为回归：红/绿两态生产树零 diff；修复后包套件 + 根 typecheck + CI 16 作业绿 | NC-C；§13 | 高（排除） |
| E4 排除 | CI 配置/依赖/分片枚举故障：同 run 11 作业绿、分片文件数本地/CI 逐位一致、`codegen-freshness`/`contract-gates`/`packaging` 绿 | §5.1 / §4 | 高（排除） |

## 9. Causal experiments

1. **机制隔离（无副作用）**：运行时导入内部 splice 模块 → 旧名 `undefined`、新名 function、公共面另一绑定、相邻导出在场
   （探针 9/9，`06-mechanism-probe.log`）。⇒ 直接故障点是**模块导出面**，不是测试或环境。
2. **单变量红复现**：固定修复后 head 的生产字节（diff 空），仅把两消费方文件回退到 `3f470fb` 字节 ⇒ CI 的 4 TS 错 + 8 TypeError
   逐字重现；恢复后 sha256 逐位相同。⇒ 红 = 消费方绑定漂移的**充分原因**（`07-red-*`）。
3. **变异敏感性**：生产单行语义变异（丢弃缝上 `accounting` 透传）⇒ 修复后的同一批断言 5/26 转红。⇒ 修复未软化断言，
   契约门对生产行为仍然敏感（`09-mutation-*`）。恢复校验：sha256 相同、tracked 状态空。
4. **绿门对照**：CI 逐字命令（根 typecheck、分片 1/6、分片 6/6、`--typecheck.only`）+ 包套件全部 `EXIT=0`，分片文件数
   63/67 与 CI 失败态逐位一致。⇒ 绿不是「命令换了」或「测试被过滤」的结果（`01`–`05`）。
5. **`--passWithNoTests=false` / `--typecheck.enabled=false` 纪律**：所有绿跑都用 CI 同款开关（空分片/空过滤会响亮失败），
   未使用任何 `skip/only/todo/env override/fallback`。

## 10. Impact surface

| 面 | 内容 | 状态 |
| --- | --- | --- |
| 失败/修复面 | `packages/ws-replication/test/ws-replication-issue423-{sa7-dynamic,observer-emission-split}.test.ts`（消费方） | 修复 commit `2c87b3b`，26 行机械集 |
| 编译门面 | `pnpm typecheck` 第 14 条 `packages/ws-replication/tsconfig.json`（`include` 覆盖 `test/**/*.ts`）；CI typecheck 作业两步 | 红 → 绿 |
| 运行门面 | CI 分片 1/6・6/6（node 20/24，共 4 格）；`scripts/ci-test-shard.mjs` 磁盘枚举 | 红 → 绿 |
| 冻结锚面 | `src/index.ts` 13 值公共导出（`createHubSessionHost` 自 `hub-session-host.ts`）；#418 C0c 模块面 exact-equality；ADR 0032/协议 §17/§23.x | 全程零 diff（修复不触碰） |
| 协议/wire/schema/持久化/状态机/生命周期 | 零变更 | 零 diff |
| 跨票账本面（RA5''） | 内部缝深路径消费方清点：`src/hub-connection.ts:18`、`src/hub-session-host.ts:30`、`test/issue420-shim-hub.ts:66`、`test/ws-replication-issue418-edge-session-split-structure.test.ts:36/39` 均已为改名后名；#423 两文件由本修复跟随 | 收敛（根 typecheck 绿 + grep 0 残留） |
| 语义面 | 不改内部缝/公共缝边界；不改 #423 被测面（仍是内部 splice session） | 保持（§12.4 禁止方向） |

## 11. Ruled-out hypotheses

- **H1「CI flake / runner 噪音」**——排除：失败集合在 node 20/24 与两次本机复现中逐字相同；无时间/并发敏感面（编译错误 + 具名导入缺失是确定性事实）。
- **H2「#423 测试断言本身错误」**——排除：断言/用例体相对父基零字节变化；红态同文件 18/26 绿，红点恰为 8 个工厂调用点。
- **H3「#420 重命名引入生产行为回归」**——排除：重命名纯度（旧类型名为别名、config 成员逐行相同）；红/绿两态 `src` 零 diff；包 86 文件/758 用例 + 根 typecheck + CI 16 作业绿。
- **H4「修复通过弱化测试变绿」**——排除：26 行机械集（仅导入/注解/调用/头注）；用例数守恒 26 = 红态 8+18；变异敏感性实测 5/26 红（NC-E）。
- **H5「rebase 冲突损坏」**——排除：rebase 零冲突；公共面 blob 逐位过继（SA8 §1 亲验 `index.ts` blob `08fa49a1…`）；本红灯 = 清点快照过期，而非合并损坏（S5/S6）。
- **H6「第三份 #423 文件同样 stale」**——排除：0 命中改名符号，全程绿。
- **H7「CI 作业过滤/入口失配」**——排除：分片枚举本地/CI 文件数逐位一致（63/67）；红态聚焦命令用 CI 同款开关。
- **H8「Node 20 专有语义」**——排除：两 node 版本同红同绿（`node --experimental-*` 无涉；失败为纯符号解析）。

## 12. Acceptance contract and test paths

### 12.0 不变式（目标行为）

> 在修复后的 head 上：**（i）** 仓内任何对被改名内部 splice 模块的消费方绑定都解析到存在的导出（编译门）；
> **（ii）** 上游 #423 的两支权威套件以 26/26 通过且断言语义零变化；**（iii）** 原 5 个红灯作业在 push 后 CI 复跑全绿；
> **（iv）** 生产字节、公共导出面与 #418 结构锚零变化（修复只落消费方）。
> 本契约对「未来同类跟随」（RA5''）同样生效：任何内部缝改名必须一次性清点**当前树**的全部消费方并以本门集验证。

### 12.1 最小输入与可执行命令（全部实测）

| ID | 最小输入（命令，仓根） | 旧实现（`3f470fb` 消费方字节） | 目标实现（HEAD） | 证据 |
| --- | --- | --- | --- | --- |
| K1 | `pnpm typecheck` | **红**：`EXIT=2`，4 × TS2724/TS2305（:54/:52） | **绿**：`EXIT=0` | `07-red-prefix-root-typecheck.log` / `02-head-root-typecheck.log` |
| K2 | `pnpm exec tsc -p packages/ws-replication/tsconfig.json`（K1 的失败 tsconfig，最短输入） | **红**：`EXIT=2`，同 4 条 | **绿**：`EXIT=0` | `07-red-prefix-package-tsc.log` |
| K3 | `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts packages/ws-replication/test/ws-replication-issue423-sa7-dynamic.test.ts --typecheck.enabled=false --passWithNoTests=false` | **红**：`EXIT=1`，`8 failed \| 18 passed (26)`，8 × `TypeError: (0 , createHubSessionHost) is not a function` | **绿**：`EXIT=0`，`2 files / 26 passed` | `07-red-prefix-focused.log` / `01`、`11` |
| K4 | `files=$(node scripts/ci-test-shard.mjs 1 6); NODE_OPTIONS=… vitest run $files --typecheck.enabled=false --passWithNoTests=false`（`6 6` 同式） | **红**（CI 证据：`1 failed \| 62 passed (63)` / `1 failed \| 66 passed (67)`） | **绿**：分片 1/6 = 63 文件/820 用例；6/6 = 67 文件/831 用例 | `04-head-shard-{1,6}.log` + `-meta.log` |
| K5 | `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck.only --passWithNoTests=false`（CI typecheck 作业第二步） | —（不受该 4 条 `test/**` 错误影响的独立步骤；红由 K1 承担） | **绿**：49 文件/270 用例，`Type Errors no errors` | `05-head-typecheck-only.log` |
| K6 | 包全量：`NODE_OPTIONS=… vitest run packages/ws-replication/test --typecheck.enabled=false --passWithNoTests=false` | 红态等价面：`2 failed \| 84 passed (86 files)`（SA3 复现） | **绿**：86 文件/758 用例 | `03-head-package-suite.log` |
| K7 | push 后 CI 复跑（`typecheck` + `test (20/24, 1–6)` + `contract-gates` 等 16 作业） | **红**：run 35663498235（5 fail / 11 pass） | **绿**：run 35665953800（**16/16 success**），PR #429 merge `4ad13a35` | `08-ci-rerun-green.log` / `12-merge-state.log` / `10` |
| K8 | diff 纪律：`git diff 3f470fb <fix> -- packages/` = 恰 2 文件 26 行机械集；生产/配置/docs 零 diff；零 `skip/only/todo/env override` | — | **满足**（§5.4 + NC-E） | §5.4；`09-mutation-*` |

**执行器**（最小复现/契约 harness，全部可重复、自恢复）：
`artifacts/sa6-issue420-ci-repair/{run-green-gates.sh, run-red-prefix.sh, run-mutation-sensitivity.sh, probe-stale-internal-import.mts}`。

### 12.2 可观察断言（不得以源码字符串断言替代）

- K1/K2/K5 = 编译期可观察结果（tsc 退出码/错误集）；K3/K4/K6 = 运行时行为（用例断言，观察真实 sink/缝上帧与事件），
  K7 = CI 作业结论。**契约本体不含任何源码 grep/正则断言**；`probe-stale-internal-import.mts` 走**运行时导入**观察模块面，
  仅作诊断证据，不是验收门。
- 目标实现的可观察期望：`26 passed` 且失败数为 0；任何用例红都必须来自被观察行为本身（不得 skip/only/todo 或软化）。

### 12.3 红/绿期望（旧实现 vs 目标实现）

| 验收件 | 旧实现（stale 消费方字节，生产同 HEAD） | 目标实现（消费方跟随） | 敏感性 |
| --- | --- | --- | --- |
| K1/K2 编译门 | 红：4 × TS2724/TS2305 | 绿：0 错 | 去掉任一跟随行即回到 4 错（红态即该状态） |
| K3 运行门 | 红：8/26，8 × TypeError | 绿：26/26 | 生产变异 ⇒ 5/26 红（NC-E） |
| K4/K6 分片/包门 | 红：对应文件所在分片/包面 | 绿：63+67 / 758 用例，exit 0 | 分片枚举自动纳入两文件（新文件自动发现） |
| K7 CI | 红：5 作业 | 绿：16/16 | CI 逐字命令已在 K1/K3/K4/K5 复跑 |

### 12.4 禁止的修复方向（冻结锚证否；触发 SA8 RA4''④）

| 方向 | 为何禁止 | 证据 |
| --- | --- | --- |
| 生产侧恢复 `hub-session.ts` 的旧别名/工厂名 | 破坏 #418 C0c 运行时导出面 exact-equality（`:618` = `['createHubSessionSink']`），并反转设计 §7 D9 | structure test :618；SA8 §3-2 |
| 把两 #423 测试改道公共入口 `createHubSessionHost` | 公共工厂吃 `HubSessionHostConfig`（授权投影形态）、与内部 splice 工厂**不同一**；被测面改变 = 决策面变化 | 探针 C；SA8 §2-7；RA4''④ |
| 放宽/删除断言、加 skip/only/todo、改分片或 CI 配置绕过 | skill 纪律与 K8 | §12.1 K8 |

### 12.5 测试入口与 runner 触发（真实性）

- 两套件路径匹配根 `vitest.config.ts:17` 的 `include`（`packages/*/test/**/*.test.ts`），由 `scripts/ci-test-shard.mjs`
  磁盘枚举自动落入分片（本地实测：`sa7-dynamic` ∈ shard 1/6 的 63 文件清单；`observer-emission-split` ∈ shard 6/6 的 67 文件清单）；
  `--passWithNoTests=false` 防过滤假绿。
- 编译门入口：`pnpm typecheck` 的 14/15 条 `packages/ws-replication/tsconfig.json` 的 `include` 覆盖 `test/**/*.ts`
  ⇒ 消费方 stale 导入**必然**在 CI typecheck 作业暴露（本地红态 tsc 已验证）。
- CI 触发链（实测）：PR push `3f470fb` → workflow `CI` → 失败 5 作业；push `5a4049d` → 同一 workflow → **16/16 绿** → merge。

### 12.6 「未来同类跟随」口径注记（SA4 O14 收口，不改已合并字节）

- **授权账**：D9 重命名的授权 = 设计 §7 D9 / SA6 U1；SA6 §12.6「授权编辑 2」授权的是 **#418 structure 测试**的机械跟随，
  不是 #423 两文件本身。CI 修复轮对 #423 两文件的**范围许可**由 SA8 §3-1（`implements-existing-decision`）收编并终认、
  SA4 Part C `approve`、SA9 §7.1 落账。两文件头注括注「SA6 §12.6 授权编辑 2」（O14 MINOR）因此属**散文级精度**问题；
  本契约以本条把「重命名授权（D9/U1）」与「跟随先例（§12.6 编辑 2）」分列，供后续同类跟随的头注引用。
- 已合并字节（sha256 见 §5.4）保持冻结，不在本轮修改（改字节会使 K3/K8 的证据链失配）。

## 13. Red/green or baseline evidence

| 证据 | 文件 | 结果 |
| --- | --- | --- |
| CI 原始红灯（5 作业） | `artifacts/sa3-issue420-ci-fail-evidence.log`（run 35663498235） | 5 fail / 11 pass；4 TS + 8 TypeError |
| 本机红态（单变量） | `artifacts/sa6-issue420-ci-repair/07-red-{preconditions,prefix-package-tsc,prefix-root-typecheck,prefix-focused,driver,restore-check}.log` | `PREFIX_PACKAGE_TSC_EXIT=2`、`PREFIX_ROOT_TYPECHECK_EXIT=2`、`PREFIX_FOCUSED_EXIT=1`、`TYPEERROR_COUNT=8`；恢复 sha256 相同、tracked 状态空 |
| 机制隔离 | `…/06-mechanism-probe.log` + `probe-stale-internal-import.mts` | 9/9 PASS（旧名缺席、新名在场、公共面不同一、负控在场、谱系在场） |
| 修复后绿（本机 6 跑） | `…/01-head-focused-green.log`、`…/02-head-root-typecheck.log`、`…/03-head-package-suite.log`、`…/04-head-shard-{1,6}.log`、`…/05-head-typecheck-only.log`、`…/11-final-focused-recheck.log` | 26/26；`EXIT=0`；86/758；63/820；67/831；49/270（no type errors）；26/26 |
| 修复后绿（CI） | `…/08-ci-rerun-green.log`、`…/12-merge-state.log` | run 35665953800 success（16/16）；`gh pr checks 429` 全 pass（exit 0）；merge `4ad13a35` |
| 变异敏感性 | `…/09-mutation-{driver,focused,restore-check}.log` | 5 failed / 21 passed (26)；恢复 sha256 相同、tracked 状态空 |
| 冻结字节 | §5.4 sha256（两文件）+ `07-red-sha256-*.log`（`3f470fb` 与 HEAD 两态） | 修复后 = `1605658…`/`778d246…`；红态 = `bc8c898…`/`9838f48…` |
| REST 评论 | `…/10-rest-comments-snapshot.log` | issue #420 / PR #429 评论与评审全 `[]` |
| 工作树收尾 | `…/11-final-state-recheck.log` | tracked 状态空；两文件与生产文件 sha256 = HEAD blob |

## 14. Runner trigger evidence

- **CI 红触发（可复核 URL）**：run [`35663498235`](https://github.com/nomicore-ai/nomicore/actions/runs/35663498235)
  → job `typecheck` [`106543911063`](https://github.com/nomicore-ai/nomicore/actions/runs/35663498235/job/106543911063)、
  `test (20,1)` `106543911555`、`test (24,1)` `106543911521`、`test (20,6)` `106543911524`、`test (24,6)` `106543911700`；
  其余 11 作业绿。
- **本机逐字复跑入口**：`run-red-prefix.sh`（红）与 `run-green-gates.sh`（绿）内命令 = CI 命令逐字（含
  `scripts/ci-test-shard.mjs` 与 `--typecheck.enabled=false --passWithNoTests=false`）；`04-head-shard-*-meta.log` 记录
  分片文件清单（63/67），两份清单分别包含两个被修文件。
- **修复后 CI 触发**：push `5a4049d` → run [`35665953800`](https://github.com/nomicore-ai/nomicore/actions/runs/35665953800)
  = success 16/16（原 5 作业全绿）→ PR #429 merge。
- **无旁路**：全程未使用 `--exclude`、`-t` 过滤、`skip/only/todo`、env override 或重试软判。

## 15. Unknowns and blockers

| # | 项 | 状态/影响 |
| --- | --- | --- |
| U1 | 交付 commit 归档门日志（80 文件 / 0 条 `issue423`）**产自哪一棵更早的树**不可直接重建（无对应 CI 日志/commit） | **不阻断**：「这些日志不覆盖交付树（90 文件收集面）」是直接观测事实；仅「最早可拦点的确切历史时点」为推断（§8 S5 已标注置信度中高） |
| U2 | 本机无 Node 20（仅 24） | **不阻断**：node 20 面由 CI 双矩阵覆盖（红/绿均同形）；本地只跑 24 |
| U3 | 本轮运行期间 PR #429 已被合并、issue #420 关闭 | **不阻断**：K7 的形式闭合凭证（新 head CI 绿）已观测（run 35665953800），merge commit `4ad13a35` 的 head 父即 `5a4049d`；本轮不执行任何 re-apply/push |
| U4 | 未来同类跟随（RA5''）是否会出现新 stale 消费方 | 当前收敛：根 typecheck 绿 + grep 0 残留；契约 K1/K3/K4/K5 即其回归门 |
| U5 | 交付归档门日志与交付 commit 同体提交（S5/A1②）属流程风险，非本票修复面 | 已在 §8/A1 登记；是否加「基座前移后重取门」流程门属 SA8/Controller 裁决 |

## 16. Temporary diagnostics cleanup

- 本轮的临时改动**恰两处、均已自恢复**并复验：
  1. **消费方回退**（红态复现）：`run-red-prefix.sh` 以 `git restore --source=3f470fb --worktree` 回退两测试文件，
     结束后 `git restore --source=HEAD --worktree` 恢复；复验：sha256 与恢复前逐位相同（`SHA256_IDENTICAL`）、
     `git status --porcelain --untracked-files=no` 空（`07-red-restore-check.log`）。
  2. **生产单行变异**（敏感性探针）：`hub-session.ts:63` 丢弃 `accounting` 透传，结束后同法恢复；复验：
     sha256 与 HEAD blob 相同、tracked 状态空（`09-mutation-restore-check.log`）。
- 无 `nohup/setsid/PID` 文件、无残留进程、无长驻服务；所有检查点均为前台/后台 job 且已结算（`job_list` 无 running）。
- 交付写入仅：本报告 + `artifacts/sa6-issue420-ci-repair/**`（3 支 harness + 1 支探针 + 全部日志）；
  `packages/**`、`docs/**`、`CONTEXT.md`、`.github/**`、`scripts/**`、`wiki/raw/task_issue-420_*.md`（除本文件）零改动。
- 终态复验：`11-final-state-recheck.log`（tracked 空；两测试文件 sha256 = HEAD blob；`hub-session.ts` sha256 = HEAD blob）
  + `11-final-focused-recheck.log`（26/26 绿，`EXIT=0`）。

## 附 A：artifactPaths（worktree-relative）

| 路径 | 内容 |
| --- | --- |
| `wiki/raw/task_issue-420_sa6_contract.md` | 本报告（固定 SA6 契约路径，原位修订） |
| `artifacts/sa6-issue420-ci-repair/probe-stale-internal-import.mts` | 机制隔离探针（运行时模块面；9 判据） |
| `artifacts/sa6-issue420-ci-repair/run-green-gates.sh` | 绿门 harness（CI 逐字命令：包套件/分片 1・6/typecheck-only）；脚本内 `90 files` 为横幅估计，权威计数以各 run 摘要为准：包套件 `--typecheck.enabled=false` = 86 文件（90 = 86 + 4 个仅在 typecheck 模式计入的 `*.test-d.ts`） |
| `artifacts/sa6-issue420-ci-repair/run-red-prefix.sh` | 单变量红复现 harness（自恢复 + 前后 sha256/状态校验） |
| `artifacts/sa6-issue420-ci-repair/run-mutation-sensitivity.sh` | 变异敏感性 harness（自恢复） |
| `artifacts/sa6-issue420-ci-repair/00-green-gates-driver.log` | 绿门 driver（HEAD、四段 EXIT 汇总） |
| `artifacts/sa6-issue420-ci-repair/01-head-focused-green.log` | 聚焦两文件绿（2 files / 26 tests） |
| `artifacts/sa6-issue420-ci-repair/02-head-root-typecheck.log` | 根 typecheck（`EXIT=0`） |
| `artifacts/sa6-issue420-ci-repair/03-head-package-suite.log` | 包全量（86 files / 758 tests） |
| `artifacts/sa6-issue420-ci-repair/04-head-shard-1.log` / `04-head-shard-1-meta.log` | CI 分片 1/6 绿（63 files / 820 tests）+ 文件清单 |
| `artifacts/sa6-issue420-ci-repair/04-head-shard-6.log` / `04-head-shard-6-meta.log` | CI 分片 6/6 绿（67 files / 831 tests）+ 文件清单 |
| `artifacts/sa6-issue420-ci-repair/05-head-typecheck-only.log` | `--typecheck.only`（49 files / 270 tests，Type Errors no errors） |
| `artifacts/sa6-issue420-ci-repair/06-mechanism-probe.log` | 机制探针日志（9/9 PASS） |
| `artifacts/sa6-issue420-ci-repair/07-red-driver*.log` | 红态 driver + 前置条件 + 恢复校验 |
| `artifacts/sa6-issue420-ci-repair/07-red-prefix-package-tsc.log` | 红态包 tsc（4 × TS2724/TS2305，EXIT=2） |
| `artifacts/sa6-issue420-ci-repair/07-red-prefix-root-typecheck.log` | 红态根 typecheck（CI 逐字，EXIT=2） |
| `artifacts/sa6-issue420-ci-repair/07-red-prefix-focused.log` | 红态聚焦（8 failed \| 18 passed (26)，8 × TypeError） |
| `artifacts/sa6-issue420-ci-repair/07-red-sha256-{head-before,3f470fb,restored}.log` | 两态与恢复后 sha256 |
| `artifacts/sa6-issue420-ci-repair/08-ci-rerun-green.log` | CI 复跑 run 35665953800（success，head `5a4049d`） |
| `artifacts/sa6-issue420-ci-repair/09-mutation-*.log` | 变异敏感性（5 failed \| 21 passed）+ 恢复校验 |
| `artifacts/sa6-issue420-ci-repair/10-rest-comments-snapshot.log` | REST 评论/评审快照（全 `[]`） |
| `artifacts/sa6-issue420-ci-repair/11-final-state-recheck.log` / `11-final-focused-recheck.log` | 收尾状态与最终绿复验 |
| `artifacts/sa6-issue420-ci-repair/12-merge-state.log` | PR #429 merge 状态 + `gh pr checks` 全绿 |
| `artifacts/sa3-issue420-ci-fail-evidence.log` | CI 原始红灯证据（run 35663498235 归档，既有） |

> 证据规范化说明（零语义，C1 级）：本轮所有日志为命令原始 stdout/stderr；唯一后处理 = 对
> `12-merge-state.log` 去除行尾空白（`gh pr checks` 输出的尾随 TAB 16 处，2414→2398 字节），
> 作业名/结论/URL/`PR_CHECKS_EXIT=0` 与全部 CI 事实逐字保留。其余日志未做任何 ANSI/时间戳/内容改写。

## 附 B：前轮（feature 轮）契约索引与出处

前轮 439 行全文由 git 历史保存：`git show 4e5ff0a:wiki/raw/task_issue-420_sa6_contract.md`。仍在生效的条目索引：

| 前轮条目 | 内容（摘要） | 现状（CI 修复轮核验） |
| --- | --- | --- |
| §12.0 / §12.1 AC1（冻结公共签名） + test-d | 公共 `createHubSessionHost`/`HubSessionHost`/`HubSessionOpenInput`/`HubSessionFrameListener`/`HubSessionSignal`/`HubSessionHandle` 逐字冻结；锁定文件 `packages/ws-replication/test/ws-replication-issue420-session-host-api.test-d.ts` | 交付后在场；`--typecheck.only` 49 文件/270 用例绿（K5）；公共面 13 值导出零 diff |
| §12.2 AC2（内存管道完整回合） | 夹具 `test/issue420-shim-hub.ts` + `test/ws-replication-issue420-session-host-round.test.ts`（A1~A12，含红臂 A12） | 包套件内绿（K6）；本轮修复不触碰 |
| §12.3 AC3（现有 hub-namespace 矩阵 shim 重跑） + 反空跑 | `test/ws-replication-issue420-shim-matrix.test.ts` + 七矩阵文件 listen/shim 双形态（52 tests 基线） | 包套件内绿（K6） |
| §12.4 AC4（缝纯度/零 worker 依赖） | 结构门（源码扫描，唯一补充判据）+ 行为判据 C4b/c/d | 包套件内绿；本轮零改动 |
| §12.5 AC5（session 侧零入站 sequence 重检） | C5a 行为正锚 / C5b 负控 / C5c 结构门 / C5d 变异 | 包套件内绿；本轮零改动 |
| §12.6 授权编辑 1/2 | ① #418 契约表追加 `createHubSessionHost`；② #418 structure 测试机械跟随 | 已随交付落地；**口径注记见本报告 §12.6**（O14 收口） |
| §12.7 变异敏感性 M1~M6 | 交付说明须登记实跑结果 | 本轮新增 NC-E 变异（内部缝 accounting 透传）作为修复后断言敏感性的再证 |
| U1（重命名冻结） | 内部 splice 改名 `createHubSessionHost`→`createHubSessionSink`、别名删除、零行为 | 本轮根因链 S2/S4 的授权依据；消费方跟随面见 §12.6 |
