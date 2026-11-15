# SA6 诊断与验收契约 — issue #472：Cordis rc.12 三基线回归与 Nomicore `0.5.0` 收官

状态：**approve**（诊断已在本轮以空缓存重新取得精确工件并实跑；契约可执行、可判真假；release 增量本身尚未实施，属预期的实现缺口，不是 diagnostic reject）
`requiresConflictRecheck`：**true**（见 §18.2：三项票级 supersession 需要 SA8/owner 追认；不是 ADR 级冲突，不阻断诊断）
HEAD：`6be891a3a0cb32fe21c3a6bf485f33428052ce7b`（= PR #469 `spec/468-cordis-rc12-root` 的最新 head；worktree 分支 `mabf/issue-472`）
任务类型：**release / acceptance feature**（三基线全仓回归 + 真实打包产物门禁 + `0.5.0` 版本与变更记录）。不是 bug 修复，也不改生产实现。
写面：**仅本文件**。本会话未修改 `packages/**`、`apps/**`、`domains/**`、`docs/**`、`artifacts/**`、根清单或任何仓库内测试；`git status --porcelain` 的仓库内变更只有 Host 提供的两个 untracked brief 与本文件。所有诊断用 worktree、临时 tarball 与并发实验均在收尾前清理（§16）。

---

## 1. Task type and inputs

| 输入 | 位置 | 状态 / 用途 |
|---|---|---|
| Host 任务简报 | `wiki/raw/task_issue-472.md`（untracked） | Issue 正文：Parent PR #469、What to build、**8 条** Acceptance criteria、`Blocked by: #470/#471`、`## Comments` 空 |
| Dispatch 台账 | `wiki/raw/task_issue-472_dispatch.md`（untracked） | Round 1、唯一 SA6、base `6be891a`、`gh api .../issues/472/comments --paginate → []`（本轮复核仍为 `[]`） |
| 架构决策（normative） | `docs/adr/0035-cordis-rc12-root-compatibility.md` | §1 三基线固定、§4 依赖与公共契约不变、§5 验收绑定精确工件与 Root 通道、§6 排除真实 Host 部署 |
| Parent / tracking | PR #469（open，head `spec/468-cordis-rc12-root`）；Issue #468（open，`## Parent` = PR #469） | `gh api` 本轮实读；#468 的 Parent 不得关闭或改写 |
| 前序设施（候选证据，不自动证明本票） | `packages/persistence/test/fixtures/cordis-baselines/{baselines.json,acquire.mjs,run-baseline.mjs,gates.mjs,root-probe.mjs,provenance-b3.json,public-surface.base.json,root-test-known-red.json}`；`packages/{persistence,ws-replication,dsh-persistence,namespace-registry,clock}/test/**`；`apps/yjs-server/test/**` | #470（PR #473）/ #471（PR #474）已合并进当前 base；本票**必须**在本轮重新执行并重新留证 |
| 发布流程（normative） | `INSTALL.md`「npm release preparation and publication」L165–L200；`scripts/package-catalog.mjs`；`scripts/{build-local-packages,verify-package-tarballs,verify-reproducible-packages,create-publish-manifest,publish-state}.mjs` | 15 个 publishable 包、`pack:local`/`publish:verify`/`publish:reproducible`、workspace:* 重写规则 |
| 既有 release 批次形态 | commits `19df983`（最近一次）、`3321390`、`303666d`、`abbb89a` | `package.json` 版本 + `artifacts/local-packages/manifest.json`（必要时生成物头部）+ `chore(release)` 提交正文记录门禁结果 |
| 本票精确工件（本轮重新获取） | `.cache/cordis-baselines/{npm,dsh,overlay,workspaces,evidence}/`（gitignored） | `.cache/` 本轮起始为空；B1/B2 npm tarball、B3 DSH `1511a6e…` 已在本轮重新获取/构建（§9.1） |
| Issue 评论 | `gh api repos/nomicore-ai/nomicore/issues/472/comments --paginate → []` | **无 owner 追加要求**；无豁免、无 override |
| 缺失输入 | `wiki/raw/task_issue-472_sa8_*`、`_design.md`、`_relevant_decisions.md`、`_conflict_report.md` | iteration 0 全部不存在；替代约束面 = 简报 + ADR 0035 + #470/#471 已合并设施 + 模块 `AGENTS.md` |

**AC 条数核对**：Issue 正文 checklist 恰 **8 条**（brief L21–L28），本报告逐条编号 AC1–AC8，不派生第 9 条、不合并、不改写。

---

## 2. Owner comment mapping

- Issue #472 **无任何评论**（本轮 `gh api` 实跑返回 `[]`，与 dispatch 台账一致）。无 owner 追加要求、无范围豁免、无版本矩阵指定。
- 需求面 = Issue 8 条 AC + `What to build` 叙事 + `Parent: PR #469` + ADR 0035 决策 1–6 + `INSTALL.md` 既有 release 流程。
- 逐条映射（不增不减）：

| Issue 原文锚点 | 本报告 | 语义 |
|---|---|---|
| L21 三基线分别通过全仓 typecheck 和完整相关运行时矩阵 | AC1 | 三基线独立验收口径 |
| L22 每个基线独立模块解析路径与 Root 通道证据；回退/同名替换/通道错配阻止收官 | AC2 | 工件身份 + 通道 fail-closed |
| L23 现有包构建、发布验证、可复现性全部通过；源码 worktree 结果不替代真实打包产物门禁 | AC3 | 真实打包产物门禁 |
| L24 完成 `0.5.0` 版本与变更记录；确认公共 Namespace/Registry/Replication API、schema、wire、服务名、持久化布局无非预期变化 | AC4 | release 内容 + 公共契约冻结 |
| L25 不改变 Cordis/Timer 依赖范围或 dependency/peerDependency 归属；必须改变安装契约则停止并另立 ADR | AC5 | 安装契约冻结 |
| L26 结果回填本 ticket 与集成 PR；不得关闭或改写 #468 的 Parent | AC6 | 回填与 tracking 边界 |
| L27 明确记录真实 MABF/DSH 部署与本地 patch 移除不属于本阶段，不作完成性声明 | AC7 | 范围排除 |
| L28 #464–#466 保持撤回，不复用其错误/不可核验证据 | AC8 | 历史证据隔离 |

---

## 3. SA8 constraints

本 Issue 没有自己的 SA8 工件。唯一可继承的绑定裁决是 #470 冲突报告 §8 的 R1–R9 与 #471 SA6/SA8 的 S1–S3；对 #472 必须先分类再继承。

| 既有裁决 | 对 #472 的效力 | 说明 |
|---|---|---|
| **R1** 全仓 typecheck = 根 `scripts.typecheck` **15-project** 清单，逐基线全绿、逐 project 留证；禁子集/known-red/默认 `node_modules` 冒充/tsconfig 掩蔽 | **原样继承** | AC1 直接落在 R1 上（§12.1） |
| **R5** B3 provenance 八项（commit/clean、ls-tree blob、构建配方、输出哈希、双位置 realpath、symbol 探针、四负控、非官方流水线诚实标注） | **原样继承** | AC2 复用同一 acquire/provenance，不建第二套 |
| **R7** 机械 gate：ws diff allowlist、`src/index.ts` 零 diff、公共面快照、manifest/lock/artifacts gate | **扩展**（见 S1） | 本票必须为 release 版本文件增加**精确 allowlist**，否则正确 release 反而被 G1′/G3/G6 判红 |
| **R8** ADR 0023 冻结服务面 | **原样继承** | AC4 的 guard-Proxy 与服务名确认 |
| **#471 S1** 三基线行为矩阵由「附加证据」升为「必绿 cell」 | **原样继承** | 12 个 suite × 3 基线已是必绿口径 |
| **#471 S2** ws/app 测试面与共享 runner 设施扩展 | **原样继承** | 本票不新建第二套 runner/acquire/probe/baseline 表 |
| **#471 S3** 跨包验收设施依赖（`packages/persistence/test/fixtures/cordis-baselines`） | **原样继承** | 测试面依赖，不是生产依赖 |
| **#470 R3**「ws 只做编译面、行为矩阵留后续票」 | **已被 #471 显式取代** | 本票沿用取代后的矩阵 |
| **#470/#471 的 root-test 台账** | **原样继承但只能作 disclosure** | root-test 不是 AC1 的逐基线证据；不得据此宣称全绿（§12.1 A1-5） |

**本票新增、必须由 SA8 追认的票级 supersession（详见 §18.2）**：

- **S1**：release 版本/manifest diff 与既有 G1′/G3/G6 零 diff 语义不相容；必须把 gate BASE 重钉到本票 base（`6be891a`）并增加 **只允许 7 个 `version` 字段 + manifest 文件名** 的 release allowlist，同时保留 G2/G4/G5/G7–G12 的冻结语义。
- **S2**：「Nomicore `0.5.0`」在本仓不是统一 monorepo 版本（根 `package.json` 私有且版本 0.1.0；15 个包各自版本）。按既有 release 流程与 packed 依赖重写规则，本票的最小正确 bump 闭包是 **7 个包**（§9.3、§12.4）；其中 `@nomicore/persistence` 到 `0.5.0`，`ws-replication`/`yjs-server` 到 `0.6.0`。若 owner 意图是「15 包统一 minor」，属新要求，需显式确认。
- **S3**：#471 提交 `caede8a` 的正文声称「公共 entry 导出名集合由 4 扩到 7（新增 ws-replication/testing、clock、namespace-registry）」，但树内 `cordis-public-surface.test.ts` 与 `public-surface.base.json` **实际仍为 4 个 entry**（本轮复核；见 §9.7）。#472 的 AC4 不得依赖该声明；要么在 #472 补 7-entry 快照并修正记录，要么以 4-entry + 源码零 diff 作为实际证据并在 release 记录中如实说明。
- **S4**：root-test 的 4 个既有 test-d 红与 28 个 pnpm 环境红只能按冻结台账披露；不得扩台账、不得把环境红说成已修、不得声称 CI/所有既有测试全绿。

> 以上均为**票级口径/验收设施**的明确化，不需要修改 ADR 0035，不改变 ADR §4/§6 的任何规范条款。

---

## 4. Environment and baseline

### 4.1 环境事实（本轮实测）

| 项 | 值 / 证据 |
|---|---|
| 运行时 | Node `v24.13.0`；TypeScript `5.9.3`；vitest `3.2.7`；tsx `4.23.12`；npm `11.9.0` |
| pnpm | 仓库 `packageManager: pnpm@10.28.2`。PATH 上的 `pnpm` 是 corepack 11.28.5 shim，**拒绝**本 workspace。本轮 `pack:local` 与 RC 因果实验使用临时 PATH shim 指向 corepack 缓存二进制 `node /home/wangjian/.cache/node/corepack/v1/pnpm/10.28.2/bin/pnpm.cjs`（非语义 override）；矩阵的 root-test cell 在**未固定 PATH** 下运行，因此如实保留 28 个 environmentRed。最终 release 验证必须对**所有** pnpm 语义固定 10.28.2，并记录 `pnpm --version`。 |
| 仓库 | `git rev-parse HEAD` = `6be891a…`；`git status --porcelain` 起始 = `?? wiki/raw/task_issue-472.md`、`?? wiki/raw/task_issue-472_dispatch.md`（+ 本文件） |
| 依赖 | 已安装；workspace 链接存在（`@deepseek-ai/cordis` 默认 4.0.1 / timer 1.1.3 / cosmokit 1.8.2） |
| 网络 | npm registry 与 `github.com/deepseek-ai/deepseek-harness` 可达；本轮成功重新获取 B1/B2 tarball 与 B3 sparse clone |
| 基线缓存 | **本轮起始 `.cache/` 不存在**；`node .../acquire.mjs --all` 本轮重新获取，B3 `provenanceDigest = 9d6633550e82c2960ec58e31a8626af7482d53ad323a612c0dce2f3e0a44221c` |
| 最近一次 release | `19df983`（`chore(release): 发布 γ 异步缝 + ADR 0033/0034 积压批次`） |
| 当前 npm 已发布版本 | 15 个 publishable 包的当前版本**全部已在 registry 发布**（本轮逐个查询：`vfsl-protocol 0.2.0`、`vfsl 0.4.0`、`vfsl-codegen 0.3.0`、`doc-runtime 0.3.0`、`clock 0.2.0`、`instance 0.2.0`、`persistence 0.4.0`、`dsh-persistence 0.4.0`、`namespace-diagnostic-log 0.3.0`、`namespace-runtime 0.4.0`、`namespace-registry 0.4.0`、`namespace-api 0.3.0`、`replication-protocol 0.2.0`、`ws-replication 0.5.0`、`yjs-server 0.5.0`） |

### 4.2 三基线工件矩阵（ADR 0035 §1；本轮实际身份）

| ID | 组成 | 本轮实际身份 | Root 通道（探针实测） |
|---|---|---|---|
| **B1** | npm `@deepseek-ai/cordis@4.0.1` + `cordis-plugin-timer@1.1.3` + `cosmokit@1.8.2` | overlay 三包版本逐个复核一致；sha512 integrity 与 `baselines.json` 钉值一致 | legacy `ctx.root` |
| **B2** | npm `@deepseek-ai/cordis@4.1.0` + Timer `1.2.0` + Cosmokit `1.9.0` | 版本逐个复核一致；**同名同版本但不是 rc.12**（内置同名负控） | legacy `ctx.root` |
| **B3** | DSH commit `1511a6ed442c207919142a4b0e6c4916f96d2c3b` vendored Cordis `4.1.0`（rc.12 行为）+ Timer `1.2.0` + Cosmokit `1.9.0` | sparse clone + 最小 tsc source-build；commit/clean/ls-tree/output 哈希由 provenance 复核；`provenanceDigest = 9d663355…` | `Symbol.for('cordis.root')` |

不扩大支持基线：其他 Cordis/Timer 版本与后续 DSH master 仍未验证（ADR 0035 §1）。

### 4.3 本票起点与 release 内容范围（相对最近一次发布）

`git diff 19df983..HEAD` 的生产面（`packages/**/src/**`、`apps/**/src/**`、`domains/**`、`docs/protocols/**`、`packages/*/package.json`、`apps/*/package.json`、`pnpm-lock.yaml`、`artifacts`）只有：

```
packages/persistence/src/service.ts   | 77 ++++++++++++++++++++++++----
packages/ws-replication/src/plugin.ts | 71 +++++++++++++++++++++++---
```

即：**自上次发布以来只有两个 Host adapter 源文件变化，所有 package.json、lockfile、manifest、schema、wire 协议源码均零 diff**。这直接支撑 AC4/AC5 的「公共契约与依赖不变」确认，也解释了为什么当前版本的 tarball 内容已经与 registry 上的同名版本不一致（版本未 bump）。

---

## 5. Positive reproduction / capability gap

本票是 release/acceptance 任务，不是 bug 票。生产 seam 在三基线已由 #470/#471 建立；本票的真实缺口是**发布收官的证据与版本记录尚未完成**、以及**现有验收设施会把正确的 release diff 判红**。以下每条都在本轮实跑或实测。

| ID | 缺口 | 本轮事实 / 证据 | 影响 AC |
|---|---|---|---|
| **G1** | **release 版本未 bump，真实打包发布门禁当前为红** | `node scripts/build-local-packages.mjs /tmp/sa6-pack` 成功（15 tarball）；`node scripts/verify-package-tarballs.mjs /tmp/sa6-pack` **exit 1**：`@nomicore/persistence@0.4.0` 与 `@nomicore/ws-replication@0.5.0` 的本地 sha512 与 registry 同名版本不一致（完整日志 `.cache/sa6-472/publish-verify-head.log`） | AC3/AC4 |
| **G2** | **正确 release diff 会被既有 gate 判红** | 在一次性 release-candidate worktree（HEAD + 7 包版本 bump + manifest）实跑 `gates.mjs`：**G1′/G3/G6 红**，其余 9 gate 绿（`.cache/sa6-472/gates-release-probe.log`）。G1′ 因 manifests/artifacts 变化；G3 因 `packages/ws-replication/package.json` 版本行（探针 worktree 的 `node_modules` symlink 是临时噪声）；G6 因 manifest 未提交时 `artifacts/` dirty | AC1（gates cell）/AC3/AC4 |
| **G3** | **`0.5.0` 的版本/变更记录未落地** | 7 个受影响包仍是已发布版本；`artifacts/local-packages/manifest.json` 仍是旧文件名；没有 `chore(release)` 提交正文；Issue #472 无评论 | AC4/AC6 |
| **G4** | **本票要求的本轮证据尚未存在** | `.cache/` 起始为空；历史 #470/#471 的记录不能替代本轮精确工件证据。本轮已重新 acquire 并开始重跑矩阵（§13） | AC1/AC2/AC3 |
| **G5** | **公共 API 确认的实际覆盖范围与记录不一致** | 真实 `cordis-public-surface.test.ts` + `public-surface.base.json` = **4 entry**；#471 提交正文声称扩到 7，但树内无对应文件变更（§9.7）。#472 不得沿用一个不存在的 7-entry 证据 | AC4 |
| **G6** | **root-test 仍有 32 个红（4 个既有 test-d + 28 个 pnpm 环境红）** | 本轮 `vitest --typecheck` 复现 `ws-replication-issue421-edge-factory-api.test-d.ts` 4 failed；`root-test-known-red.json` 冻结 4+28。不能宣称 root-test/CI/所有既有测试全绿 | AC1/AC4 |
| **G7** | **回填与 tracking 边界未执行** | Issue #472 comments = `[]`；#468 仍 open 且 Parent = PR #469（必须保持） | AC6/AC8 |

> 诚实边界：**不得**把「生产实现没有坏」写成「release 已完成」；也**不得**把「版本 bump 缺失」误判成生产 bug。G1/G2/G3 都是 release/验收设施缺口，必须由实现与最终验证闭合。

---

## 6. Negative control

### 6.1 本轮已执行的正/负对照

| 对照 | 目的 | 结果 |
|---|---|---|
| 空缓存重新 acquire B1/B2/B3 | 证明三基线证据来自本轮真实工件 | exit 0；B3 provenance digest 与钉值一致 |
| HEAD 上 `pack:local` → `publish:verify` | 证明「源码 worktree 可构建」≠「可发布」 | pack exit 0；verify **exit 1**（2 个同名同版本 integrity mismatch） |
| HEAD 上 `publish:reproducible` | 证明可复现性门禁本身可用 | exit 0，15 包一致 |
| 一次性 release-candidate（7 包 bump） | 证明正确的 bump 闭包能让发布门禁转绿 | pack exit 0；publish:verify **exit 0**；reproducible **exit 0**；`pnpm install --frozen-lockfile --lockfile-only` exit 0 且 lockfile 零 diff |
| 一次性 release-candidate 上的 `gates.mjs` | 证明现有 gate 与 release diff 不相容 | **G1′/G3/G6 红**；G2/G4/G5/G7–G12 绿（含 G10 全仓零残留） |
| 既有 test-d lane | 证明 4 个 known-red 是真实 BASE 债务 | 4 failed / 4 passed（`ws-replication-issue421-edge-factory-api.test-d.ts`） |

### 6.2 契约要求执行、且必须真红的负控（实现/最终验证阶段）

> 本轮已完成 N-1…N-4（4/4 外层 exit 0 + 内层 observed=fail，§13.1b）与 N-5（integrity 钉值下调 → acquire exit 2，恢复 → exit 0）；N-6…N-9 已用矩阵证据审计做过「缺失/损坏」演示（§13.1c），最终验证须在 release candidate 上重跑全部负控。

| # | 负控 | 污染方式（一次性副本/内建 fault） | 期望 |
|---|---|---|---|
| N-1 | 工件解析回退 | `run-baseline.mjs --baseline B3 --fault fallback --suite provenance --suite root-probe` | 内层 cell 红；外层 exit 0 当且仅当 observed=fail |
| N-2 | 同名替换（B3 被 npm 4.1.0 替换） | `--baseline B3 --fault substitute-npm ...` | 同上 |
| N-3 | 通道错配（B2 被 DSH rc.12 替换） | `--baseline B2 --fault substitute-rc12 ...` | 同上 |
| N-4 | legacy shim 蒙混 | `--baseline B3 --fault legacy-shim --suite provenance --suite root-probe` | channel 断言红 |
| N-5 | integrity 钉值下调 / 工件回退 | 在一次性副本把 `baselines.json` 的 B1 cordis integrity 改成错误值后 `acquire.mjs --baseline B1` | acquire 响亮失败（exit 2）；恢复原值后绿 |
| N-6 | 证据缺失 | 删除矩阵中任一 cell JSON 后运行证据审计 | 审计 exit != 0；缺证据不得判 pass |
| N-7 | 证据损坏 | 截断任一 cell JSON | 审计 exit != 0 |
| N-8 | 证据过期/跨轮混用 | 用上一轮 `matrix.json` 或把 B2 cell 的 `provenanceDigest` 改成 B3 的 | 审计 exit != 0 |
| N-9 | root-test 台账扩账 | 把新红测试名加入 `root-test-known-red.json`（一次性副本） | 必须被禁止/判红；新红是回归，不是台账项 |
| N-10 | 发布门禁绕过 | `NOMICORE_VERIFY_REGISTRY_INTEGRITY=0` 或跳过 `publish:verify` | 不得作为 AC3 证据；判红 |
| N-11 | 源码结果冒充打包产物 | 未运行 `pack:local`/`publish:verify`，只给 `pnpm typecheck`/矩阵结果 | AC3 判红 |
| N-12 | 版本不 bump | 当前 HEAD 状态（persistence 0.4.0 / ws 0.5.0） | `publish:verify` 红（已实测） |

> 负控纪律：`--passWithNoTests=false`；目标测试名必须存在且 passed；`fault` 入口外层 exit 0 当且仅当内层 observed=fail；任何负控「应红实绿」都直接阻断收官。

---

## 7. Stability, scale and timing

| 维度 | 要求 |
|---|---|
| 重复性 | 矩阵中 `real-timer`/`ws-cordis-timers`/`replication-lifecycle` 各 3 次 repeat；任一 repeat 红即该 cell 红；lifecycle 的 23 名枚举 + `coverage` + `issue420` 必须逐 repeat 判定 |
| 时序 | 行为等待用谓词轮询 + deadline（5 s 量级），禁固定 sleep 轮数；deadline 耗尽 = 红 |
| 竞态 | timer 触发 vs stop/dispose 的窗口用显式 gate/observer 拉开；不得用墙钟睡眠凑 |
| 规模 | 不引入大载荷；timer timeout 用毫秒级可辨识 delay；backoff 注入常量 random |
| 资源 | 每 cell 结束必须 dispose fiber/root context；无遗留真实 listener |
| 网络 | B1/B2 tarball 与 B3 clone 必须在网络可用环境获取；任何下载/构建失败 = 响亮失败，不回退到缓存未验证工件 |
| 并行 | 最终验收的 `--all --matrix` 应独占运行，避免其他 CPU 密集任务造成 timer deadline 抖动；本轮诊断曾并行 probe，矩阵仍全绿，但契约不把并行当保证 |
| 证据新鲜度 | 所有证据必须由**同一轮**产生；矩阵 `matrix.json` 的 `generatedAt`/mtime、每个 cell 的 mtime 必须晚于本轮开始 marker；过期/跨轮证据 = 红 |
| 工具链 | 所有 pnpm 语义固定 10.28.2；记录 `node/npm/pnpm/tsc/vitest` 版本；不得用 `NOMICORE_VERIFY_REGISTRY_INTEGRITY=0`、`--passWithNoTests`、`skip`/`only`/`todo` 或 env override 制造伪绿 |
| 平台 | B3 最小 tsc source-build 依赖 Node ≥ 24；不满足 = 响亮失败 |

---

## 8. Root-cause chain / capability gap

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| 1 | 最近一次 release `19df983` 之后，production 面只有 `persistence/service.ts` 与 `ws-replication/plugin.ts` 变化 | `git diff 19df983..HEAD --stat -- packages/*/src apps/*/src domains docs/protocols ...`（§4.3） | 高 |
| 2 | 这两个包的当前版本仍等于已发布版本（0.4.0 / 0.5.0），而 packed `dist` 内容已变化 | 本轮 `pack:local` 产出 + registry 查询 | 高 |
| 3 | `publish:verify` 的 registry-integrity 判定因此失败（同名同版本但内容不同） | 本轮实跑：2 个 integrity mismatch（§9.2） | 高 |
| 4 | 正确做法是 release bump；但现有 G1′/G3/G6 要求 manifests/artifacts/ws 目录零 diff 或 artifacts clean，正确 bump 反而被判红 | 一次性 RC worktree 实跑 gates：G1′/G3/G6 红（§9.4） | 高 |
| 5 | bump 闭包不是「只改 2 个包」：`create-publish-manifest` 把 `workspace:*` 重写成依赖方当前版本，persistence 版本变化会改变 dsh-persistence/namespace-runtime/namespace-registry/namespace-api/ws-replication/yjs-server 的 packed 内容 | `scripts/create-publish-manifest.mjs` + 本轮 tarball 解包对比（§9.3） | 高 |
| 6 | 7 包 bump 后，`pack:local`/`publish:verify`/`publish:reproducible` 全部转绿；lockfile 零 diff | 一次性 RC 实跑（§9.3） | 高 |
| 7 | 验收设施（G1′/G3/G6、BASE d59a4d1）需要按 release 票重钉并加 release allowlist；否则 AC1 的 matrix gates cell 与 AC3/AC4 互斥 | 代码阅读 + RC gates 实跑（§9.4） | 高 |
| 8 | `0.5.0` 的版本/变更记录、issue/PR 回填、#468 Parent 保持均未执行 | `gh api`；release 提交历史；Issue comments=[] | 高 |

**放大因素**：`publish:verify` 在普通 CI 被 `NOMICORE_VERIFY_REGISTRY_INTEGRITY=0` 降级为结构检查（`.github/workflows/ci.yml:172`），所以源码 PR 可以绿而 release 门禁红；这正是 AC3 要区分的边界。

---

## 9. Causal experiments

### 9.1 空缓存重新获取三基线（本轮）

```
node packages/persistence/test/fixtures/cordis-baselines/acquire.mjs --all
```

- B1/B2：npm registry 下载 cordis/timer/cosmokit + `@standard-schema/spec`，integrity 与 `baselines.json` 钉值逐包复核。
- B3：`git clone https://github.com/deepseek-ai/deepseek-harness.git`，checkout `1511a6ed44`，sparse `vendor/{cordis,timer,cosmokit}` + `tsconfig.base.json`，最小 tsc source-build；`provenanceDigest = 9d6633550e82c2960ec58e31a8626af7482d53ad323a612c0dce2f3e0a44221c`。
- 结论：本轮矩阵证据来自本轮真实工件，不是历史缓存。

### 9.2 HEAD 上的真实打包门禁（红）

```
PATH=<pnpm-10.28.2 shim>:$PATH node scripts/build-local-packages.mjs /tmp/sa6-pack   # exit 0，15 tarballs
node scripts/verify-package-tarballs.mjs /tmp/sa6-pack                                # exit 1
```

```
ERROR: @nomicore/persistence@0.4.0: published version integrity mismatch
  (local sha512-JU34b0hA2EcbLQtRwp2up8R1iGGb5LpVRq2tKwgMy37jLR5h/jrvXGuGJ5DesJhxk32fla0b0Kqan6ql3wf/IQ==,
   registry sha512-iUWb4VQCWXIBeWixqwQYF+RIY1tFkwV1X71k2VfAbfiGLarr75cauK7gpu7sRGyfZr5HLDmeZEAb1zK2fpe5Fw==)
ERROR: @nomicore/ws-replication@0.5.0: published version integrity mismatch
  (local sha512-LvdSRP90Ydwo8fw0QTgj5Uq85Cyh/417gtgbUNVBm+JUSQE06lvpGn9u8y89AtRNBO3zGAg2DJfw62OOHAd94A==,
   registry sha512-nwZxCzqFTLq2FP0v0Q4dMvbClvFQReaXC2ayU4Gx/AY/xE95+0k0suGUFI6Nf27qrEtRpW5go0r5W7wmSJczcQ==)
```

其余 13 包 integrity MATCH；`publish:reproducible` exit 0。**结论**：失败不是网络、npm 或可复现性问题，而是「内容变了但版本没变」。

### 9.3 一次性 release-candidate 因果实验（7 包 bump）

在 `.worktrees/sa6-release-probe`（HEAD `6be891a` 的 disposable worktree）只改版本与 manifest：

| 包 | 当前 | RC |
|---|---|---|
| `@nomicore/persistence` | 0.4.0 | **0.5.0** |
| `@nomicore/dsh-persistence` | 0.4.0 | 0.5.0 |
| `@nomicore/namespace-runtime` | 0.4.0 | 0.5.0 |
| `@nomicore/namespace-registry` | 0.4.0 | 0.5.0 |
| `@nomicore/namespace-api` | 0.3.0 | 0.4.0 |
| `@nomicore/ws-replication` | 0.5.0 | 0.6.0 |
| `@nomicore/yjs-server` | 0.5.0 | 0.6.0 |
| 其余 8 包 | 不变 | 不变 |

实跑结果：

- `build-local-packages.mjs → /tmp/sa6-release-pack`：**exit 0**，15 tarball，manifest 15 键。
- `verify-package-tarballs.mjs /tmp/sa6-release-pack`：**exit 0**，registry integrity 开启；7 个新版本走 `npm publish --dry-run --json`，其余 8 个 already-published integrity match。
- `verify-reproducible-packages.mjs`：**exit 0**，15 包两次构建 sha256 一致。
- `pnpm install --frozen-lockfile --lockfile-only`：**exit 0**；`pnpm-lock.yaml` 零 diff。
- packed 依赖重写实证：`nomicore-dsh-persistence-0.5.0.tgz` 的 `dependencies["@nomicore/persistence"] = "0.5.0"`；0.4.0 tarball 为 `"0.4.0"`。这证明「只 bump persistence 而不 bump 依赖方」会让依赖方 tarball 也变化 → 版本必须联动。

元数据证据：`.cache/sa6-472/release-candidate-probe.json`。

### 9.4 正确 release diff 与现有 gate 的不相容（红）

在同一 RC worktree 实跑 `gates.mjs`：

```
[gates] FAIL G1′: manifests / lockfile / artifacts must be byte-identical to BASE; changed:
  apps/yjs-server/package.json
  artifacts/local-packages/manifest.json
  packages/dsh-persistence/package.json
  packages/namespace-api/package.json
  packages/namespace-registry/package.json
  packages/namespace-runtime/package.json
  packages/persistence/package.json
  packages/ws-replication/package.json
[gates] FAIL G3: ... unexpected: packages/ws-replication/package.json (+ probe-only node_modules symlink)
[gates] FAIL G6: artifacts/ is dirty: M artifacts/local-packages/manifest.json
[gates] PASS G2/G4/G5/G7/G8/G9/G10/G11/G12
[gates] 3/12 gate(s) failed
```

- G6 的「dirty」是序列问题：manifest 尚未提交。真实 release 必须**先形成 `chore(release)` 提交**，再在干净树上跑矩阵；否则 gates cell 必红。
- G3 的 `node_modules` 是探针 worktree 的临时 symlink（不计入仓库语义）；真实阻塞项是 `packages/ws-replication/package.json` 的版本行。
- 结论：矩阵的 gates cell 不能原样用于 release candidate；需要 §12.1 A1-6 的 release gate 扩展。

### 9.5 三基线矩阵（本轮实跑）

`node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs --all --matrix`。本轮实际结果见 §13.1：B1/B2/B3 各 13 个 cell（typecheck + 12 suites）全部 pass，gates 12/12 pass，root-test 按冻结台账判定（5956/5988，32 known-red，`failedUnexpected=[]`），聚合 **MATRIX PASS: 41 cells**。**矩阵本身在 HEAD 上是绿的**；它证明生产 seam 与验收设施可用，不能替代 G1/G3 的 release 缺口闭合。

### 9.6 既有 test-d 红的复现

```
NODE_OPTIONS=--conditions=nomicore-source node node_modules/vitest/vitest.mjs run --typecheck \
  --passWithNoTests=false packages/ws-replication/test/ws-replication-issue421-edge-factory-api.test-d.ts
→ 4 failed / 4 passed，TypeCheckError（expect-type 可选参数元组）
```

同时 `tsc -p packages/ws-replication/tsconfig.json` exit 0（15-project typecheck 不因此红）。这说明 AC1 的 tsc typecheck 与 root-test 的 vitest typecheck lane 是两条证据线；release 记录必须如实披露 4 个 known-red，不能拿 tsc 绿掩盖 root-test 红。

### 9.7 记录一致性复核：#471 的 7-entry 声明

- #471 `caede8a` 提交正文：「公共 entry 导出名集合由 4 扩到 7（新增 ws-replication/testing、clock、namespace-registry）」。
- 实际树：`packages/persistence/test/cordis-public-surface.test.ts` 的 `ENTRIES` = 4；`public-surface.base.json` = 4 keys；`git show caede8a --name-only` 不含这两个文件。
- 结论：#472 的 AC4 不得引用该声明作为已完成的 7-entry 证据；实际快照仍是 4 entry。要么在 #472 补齐 7-entry 并修正记录（推荐，成本可控且与 #471 SA10 的原要求一致），要么在 release 记录中明确「4-entry 快照 + 其余包源码/导出图零 diff」并说明修正。无论哪种，都不得重复错误声明。

### 9.8 清理

- 一次性 RC worktree、临时 tarball、PATH shim、base-snapshot worktree 均在收尾前删除（§16）；仓库只保留本报告与 Host brief。

---

## 10. Impact surface

### 10.1 release 文件面（实现阶段必须触碰）

| 文件 | 预期变化 | 依据 |
|---|---|---|
| `packages/persistence/package.json` | `version: 0.4.0 → 0.5.0` | 自身内容变化 + headline |
| `packages/dsh-persistence/package.json` | `0.4.0 → 0.5.0` | packed dep persistence |
| `packages/namespace-runtime/package.json` | `0.4.0 → 0.5.0` | packed dep persistence |
| `packages/namespace-registry/package.json` | `0.4.0 → 0.5.0` | packed deps persistence/runtime |
| `packages/namespace-api/package.json` | `0.3.0 → 0.4.0` | packed dep registry |
| `packages/ws-replication/package.json` | `0.5.0 → 0.6.0` | 自身内容 + packed deps |
| `apps/yjs-server/package.json` | `0.5.0 → 0.6.0` | packed deps 闭包 |
| `artifacts/local-packages/manifest.json` | 7 个 filename 更新 | `pack:local` 生成 |
| `domains/vfs3-assets/generated.ts` | **预期不变** | vfsl-codegen 不 bump；只有 codegen 版本变化才刷新头部 |
| 根 `package.json` | **不变** | 私有 workspace；无产品版本语义 |
| `pnpm-lock.yaml` | **不变** | 版本字段不影响 lock importers；RC 实测零 diff |
| `scripts/package-catalog.mjs` | **不变** | 15 包清单/顺序是唯一源 |

### 10.1b 版本与变更记录的落地清单（直接回答「按既有流程落到哪些文件」）

| 项 | 文件/载体 | 动作 |
|---|---|---|
| 包版本 | 上述 7 个 `package.json` 的 `"version"` | bump；其余 8 个 publishable 包与根 `package.json` 不变 |
| 发布清单 | `artifacts/local-packages/manifest.json` | 由 `pack:local` 重新生成；7 个 filename 更新；15 键不变 |
| 变更记录 | **`chore(release)` 提交正文**（既有流程：`19df983` / `3321390` / `303666d` / `abbb89a` 均如此） | 记录版本矩阵、内容、AC1–AC4 证据、known-red 披露、非目标 |
| 代码生成物头部 | `domains/vfs3-assets/generated.ts` | **本批不变**（`vfsl-codegen` 不 bump；只有 codegen 版本变化才刷新头部） |
| 证据归档 | `wiki/raw/task_issue-472_sa10_spec.md`（final verification）+ `.cache/...` 运行期证据 | 最终验证写入；GitHub 回填另见 AC6 |
| 不存在的文件 | `CHANGELOG.md` / 根版本 | 仓库没有 CHANGELOG；根 `package.json` 是私有 workspace 且不参与发布版本。**不得**新造一套未经验证的 release 文件约定 |

> 若 owner 期望新增 `CHANGELOG.md` 或统一 15 包版本，这是**流程变更**（S2），必须在 SA8/owner 明确后执行；不得由实现自行决定。

### 10.2 验收设施面（实现阶段允许扩展的测试 fixture）

| 文件 | 预期变化 | 理由 |
|---|---|---|
| `packages/persistence/test/fixtures/cordis-baselines/gates.mjs` | BASE 重钉到 `6be891a`；G1′/G3/G6 增加 release allowlist；新增 release batch 审计（或等价 gate） | AC1/AC3/AC4；不扩展就无法同时满足 matrix 与 release |
| `packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs` | 可选：证据审计（freshness/cell 完整性）与 matrix manifest | AC2 fail-closed；若用独立审计脚本也可 |
| `packages/persistence/test/fixtures/cordis-baselines/public-surface.base.json` / `packages/persistence/test/cordis-public-surface.test.ts` | 可选：4→7 entry（推荐）；若改快照，G12 allowlist 需同步调整 | AC4/§9.7 记录修正 |
| `wiki/raw/task_issue-472_sa10_spec.md`（final verification） | 新增 | 最终证据与 release 记录引用 |

> 设施扩展的 G12 约束：`FACILITY_ALLOW` 目前是 4 文件闭集；若新增 facility 文件或修改 `public-surface.base.json`（例如 7-entry 扩展），必须同步更新 G12 白名单并给出理由，或把新审计逻辑放进既有 `run-baseline.mjs`/`gates.mjs`/`scripts/` 以避免扩大闭集。任何「为了让 gate 绿而扩大 allowlist」的改动都必须与 S1/S3 一起由 SA8 追认。

### 10.3 生产源码面

**本票不修改生产源码。** #470/#471 的两个 seam 文件已在 base；#472 的 release diff 只允许版本字段与 manifest。任何 `packages/**/src/**`、`apps/**/src/**`、`domains/**` 变化（相对 `6be891a`）都使 AC4/AC5 红。

### 10.3b 边界与禁区（DENY / 停手条件）

| 禁区 | 判据 |
|---|---|
| 改变 Cordis/Timer 依赖范围或 dependency/peerDependency 归属 | 任一 `package.json` 的 `@deepseek-ai/*` range 变化、新增 peer、dependency↔peer 迁移 → **停止收官，另立 ADR**（ADR 0035 §4） |
| 改公共 Namespace/Registry/Replication API、schema、wire、服务名、持久化布局 | 任一 `src/**`/`schema.vfsl`/`generated.ts`/`docs/protocols/**` 非预期变化 → AC4 红 |
| 用依赖升级/安装契约变化掩盖兼容问题 | 禁止；必须走新 ADR |
| 真实 MABF/DSH 部署、迁移窗口、本地 patch 移除 | ADR 0035 §6 明确排除；不得执行、不得宣称 |
| 修改/关闭 tracking issue #468 或改写其 `## Parent` | 只允许评论回填；Parent 必须保持 `PR #469` |
| 复用 #464–#466 的 POC/撤回结论 | 只能作为「已撤回、不使用」的历史说明 |
| 用 `skip`/`only`/`todo`/`--passWithNoTests`/`NOMICORE_VERIFY_REGISTRY_INTEGRITY=0`/env override/fallback 制造伪绿 | 证据审计不通过 |
| 以源码字符串/正则断言冒充行为断言 | 行为 AC 只认运行时证据；机械 gate 例外且必须单列 |
| 改历史 `artifacts/**` 或 `docs/adr/**` 追认实现 | `git diff` 零 diff（release 版本文件除外） |
| 伪造/扩充 root-test known-red 台账 | 新红是回归，不是台账项 |
| 用历史 #470/#471 结果替代本票本轮证据 | 所有 AC 证据必须绑定本轮 `R` |

### 10.4 GitHub 面

- Issue #472：新增回填评论（当前 0 条）。
- Integration PR（`mabf/issue-472` → `spec/468-cordis-rc12-root`）：正文/评论回填。
- Issue #468：保持 open，`## Parent` = PR #469 不变。
- Issue #464/#465/#466：保持 closed + 撤回评论不变。

---

## 11. Ruled-out hypotheses

| 假设 | 排除依据 |
|---|---|
| 「publish:verify 红是网络/npm 故障」 | 13/15 包 integrity MATCH；reproducible exit 0；失败恰好是两个内容变化但版本未变的包；错误是 deterministically 的 integrity mismatch |
| 「源码 typecheck/test 全绿 = 发布门禁通过」 | `publish:verify` 只读 tarball 与 registry，不读源码；HEAD 上矩阵绿但 verify 红 |
| 「B2 与 B3 版本号同为 4.1.0，所以可互相替代」 | root-probe 本轮实测 B2 legacy、B3 symbol；provenance realpath 不同；同名替换负控正是为此设计 |
| 「`B3` 的 DSH 构建可以换成当前 checkout」 | provenance 钉死 commit/clean/ls-tree/output 哈希；`fallback`/substitute 负控必须红 |
| 「正确 release 只需 bump persistence」 | packed `workspace:*` 重写实证：dsh-persistence 的依赖变成 `0.5.0`，其 tarball 内容变化 → 必须 bump 闭包 7 包 |
| 「Nomicore 0.5.0 = 15 包统一 0.5.0」 | 根包私有、15 包独立版本；最近 release 只 bump 受影响闭包；ws/yjs 已在 0.5.0，内容变化只能 ≥0.6.0。统一 bump 是未经 owner 确认的新要求（S2） |
| 「#471 已把公共快照扩到 7 entry」 | 实际文件/测试仍 4 entry；`caede8a` 未改这两个文件（§9.7） |
| 「root-test 不绿就不能 release」 | #470/#471 的裁定是冻结台账 + 如实披露；4 test-d + 28 环境红是 BASE 债务，本票不修、不扩账、不宣称全绿 |
| 「gate 判红说明生产码有回归」 | RC gates 红来自 release 版本文件与既有零 diff 语义冲突；G2/G10 等生产面 gate 全绿 |
| 「#464–#466 的 rc.3 POC 可作为 rc.12 证据」 | 三个 issue 已 closed 且撤回评论明确说明锚点错误；ADR 0035 §5 明确不使用 |

---

## 12. Acceptance contract

### 12.0 通用判据

1. **单一候选树**：设 release candidate 为 `R`（`chore(release)` 提交的 tree；若验证时尚未提交，则以 tree hash `T` 绑定，并在提交后复核 tree hash 一致）。AC1/AC2/AC3/AC4 的全部证据必须记录 `git rev-parse HEAD` / `git write-tree` 及 `git status --porcelain`；**不同树上的绿不得互相抵销**。
2. **本轮证据**：所有命令必须在同一轮执行；`.cache/` 证据的 mtime 必须晚于本轮开始 marker；历史 #470/#471 结果只能作背景，不能作为本票 AC 证据。
3. **fail-closed**：缺失、损坏、过期、跨轮混用的 cell 一律判红；已知红台账只能解释**已存在**的失败名，不能解释缺证据，也不能扩账。
4. **行为断言只观察运行时行为**；源码字符串/正则只能用于机械形状 gate（G10 等），不能冒充行为验证。
5. 禁止 `skip`/`only`/`todo`/`--passWithNoTests`/`NOMICORE_VERIFY_REGISTRY_INTEGRITY=0`/fallback/吞错/软化断言。
6. **无证据即不通过**：任一 AC 的任一条目没有可复核证据，即该 AC 不通过；release 不得收官。

### 12.1 AC1 — 三基线分别通过全仓 typecheck 与完整相关运行时矩阵

| 项 | 内容 |
|---|---|
| **A1-1 命令与聚合** | 在 `R` 上运行 `node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs --all --matrix`，**exit 0**；输出/`matrix.json` 必须恰含 **41 cells** = 3 × (1 typecheck + 12 suites) + gates + root-test；任一 cell `status != pass` 或缺失 → 红。 |
| **A1-2 全仓 typecheck** | 每基线 `B1/B2/B3` 各自对根 `scripts.typecheck` **动态解析出的 15 个 project** 逐个 `tsc -p` exit 0：`packages/{vfsl,vfsl-protocol,vfsl-codegen,persistence,dsh-persistence,doc-runtime,namespace-runtime,clock,instance,namespace-registry,namespace-api,namespace-diagnostic-log,replication-protocol,ws-replication}/tsconfig.json` + `apps/yjs-server/tsconfig.json`。逐 project 留日志/exit code；禁止子集、默认 `node_modules` 类型面、tsconfig 删项/`skipLibCheck` 扩张/整体 cast。`domains/vfs3-assets` 无 tsconfig、私有、零 Cordis 依赖，不在 15-project 清单；其类型面由 `tsconfig.typecheck.json`/`pnpm test` 覆盖，作为 disclosure 记录，不作为逐基线 cell。 |
| **A1-3 完整相关运行时矩阵** | 12 suites × 3 基线 = 36 个行为 cell；文件清单与不变量见下表。每个 cell 必须 `counts.failed=0`、`counts.total>0`；repeat suite 的每次 repeat 都必须绿；`replication-lifecycle` 每 repeat 必须 `units.observed=23/23` + `coverage=true` + `foreignUnits=[]` + `issue420.present=true`；`unload` 必须含 R5P；`guard-proxy` 必须含 issue246 + issue418 contract/structure 三文件。 |
| **A1-4 覆盖映射（ADR 0035 §5 最低行为面）** | ① Memory/File Persistence 真实 Timer flush/retry/drain/dispose → `real-timer` + `contract` + `unload`；② Registry Cordis 启动/shutdown → `unload`；③ Hub/Peer/SessionHost 启停与 timer 清理 → `replication-lifecycle` + `ws-cordis-timers` + `ws-cordis-channel` + `ws-package`；④ 冻结服务 guard-Proxy → `guard-proxy`；⑤ DSH profile → `dsh-profile`；⑥ 第三方组合根 → `composition-root`。缺任一映射即 AC1 红。 |
| **A1-5 root-test 只作 disclosure** | 默认布局 `root-test` cell 不是逐基线证据；它必须运行、JSON 证据必须 fresh/可解析/`numTotalTests>0`，失败名集合 ⊆ `root-test-known-red.json` 冻结集合，`failedUnexpected=[]`；实际 counts（如 5956/5988、32 红，或对齐 pnpm 后的实际值）必须原样记录。**不得**用它证明三基线兼容，也**不得**因它绿而宣称全仓库测试全绿。 |
| **A1-6 gates cell 与 release 相容** | gates cell 必须在 `R` 上 pass（12/12 或扩展后的等价 gate 数）。release gate 必须满足：G2/G4/G5/G7–G12 语义不变且绿；G1′/G3/G6 以 **`6be891a` 为 BASE** 并只允许下列 release diff：① 7 个 `package.json` 仅 `"version"` 行变化；② `artifacts/local-packages/manifest.json` 仅对应 7 个 filename 变化；③ `pnpm-lock.yaml`/根 `package.json`/`scripts/package-catalog.mjs`/依赖字段零 diff；④ artifacts 在运行时干净（manifest 已提交）。任何其他 diff → 红。 |
| **证据载体** | `.cache/cordis-baselines/evidence/matrix/matrix.json`；`.cache/cordis-baselines/evidence/B{1,2,3}/typecheck.json` + `B*-typecheck.json` + 每个 suite JSON + `*.vitest.json`/`.log`；`.cache/cordis-baselines/evidence/gates/{gates.json,gates.log}`；`.cache/cordis-baselines/evidence/root-test/{root-test.json,root-test.log}`；本轮命令日志/开始 marker。 |
| **通过判定** | A1-1…A1-6 全部满足；41/41 cells 绿；每基线独立留证；无绿抵销。 |
| **失败判定** | 任一 project/cell 红或缺失；用子集/单基线代替 `--all --matrix`；默认布局冒充基线；空测试/`passWithNoTests` 变绿；root-test 扩账或宣称全绿；gates 未按 release allowlist 扩展导致 matrix 红；用历史证据代替本轮证据。 |

**12 suites 精确清单与不变量**（以 `run-baseline.mjs` 的注册为准；实现若改名/拆文件必须仍能被 `--all` 发现并保持判据）：

| suite | 文件（工作树相对） | repeat | 关键不变量 |
|---|---|---|---|
| `provenance` | `packages/persistence/test/cordis-baseline-provenance.test.ts` | 1 | 双位置 realpath 一致、恰一份 cordis、版本/integrity 钉值、B3 八项 |
| `root-probe` | `root-probe.mjs` + `packages/persistence/test/cordis-root-channel.test.ts` | 1 | 独立 probe 通道命中 + 通道行为测试 |
| `contract` | `packages/persistence/test/*.test.ts`（动态全目录，23 文件；禁止硬编码子集） | 1 | Memory/File persistence 契约、guard、drain、phase 等 |
| `real-timer` | `packages/persistence/test/cordis-root-real-timer.test.ts` | 3 | 真实 Timer flush/retry/drain/dispose + UNLOADING 窗口提交 |
| `dsh-profile` | `packages/dsh-persistence/test/dsh-profile-acceptance.test.ts` | 1 | DSH profile 行为 |
| `unload` | `packages/namespace-registry/test/registry-sa7-rev1.test.ts`、`registry-sa7-cordis.test.ts` | 1 | Registry 启停/lease/revoke；R5P 必须存在且 passed |
| `ws-package` | `ws-replication-plugin`、`issue299-ac-red`、`issue422-listen-false`、`ws-replication-guard-proxy-consumption` | 1 | 4 个具名 Host fixture 的既有断言面 |
| `guard-proxy` | clock/registry/ws 三个 guard 文件 + `issue246-interop-matrix` + `issue418-edge-session-split-{contract,structure}` + `ws-cordis-channel` | 1 | 冻结 getter/Proxy + wire/结构守卫；A6-4 三文件必须存在且绿 |
| `ws-cordis-channel` | `ws-replication-cordis-root-channel.test.ts` | 1 | symbol 优先/legacy 兜底/malformed/缺席/两跳级联/无 ambient timer |
| `ws-cordis-timers` | `ws-replication-cordis-root-timers.test.ts` | 3 | 12 timer 族真实 arm/trigger/cancel |
| `replication-lifecycle` | `ws-replication-cordis-baseline-lifecycle.test.ts` + `ws-replication-issue420-session-host-round.test.ts` | 3 | 3 入口 × 7 场景 = 23 units + coverage + issue420 |
| `composition-root` | `third-party-composition-red`、`third-party-timer-ownership-red`、`issue270-regression-anchors`、`issue270-server-integration-red`、`on-fatal-error-issue288`、`persistence-drain-shutdown`、`dsh-profile-direct-apply-order` | 1 | 第三方组合根/拆卸序/Timer 所有权/直接 apply 顺序 |

### 12.2 AC2 — 每个基线独立模块解析路径与 Root 通道证据；回退/同名替换/通道错配阻止收官

| 项 | 内容 |
|---|---|
| **A2-1 双位置解析身份** | 每基线 provenance cell 必须证明：测试模块位置与生产 leaf（`packages/persistence/src/service.ts`）位置解析到**同一 realpath**；该 realpath 位于 `NOMICORE_CORDIS_BASELINE_ROOT` overlay 内；工作区内声明的 `@deepseek-ai/cordis` 恰有 **1** 份可达；cordis/timer/cosmokit 版本与 `baselines.json` 一致；B3 另须 commit/clean/ls-tree blob 全表/构建配方/output 哈希全对。 |
| **A2-2 Root 通道** | `root-probe.mjs` 三基线分别 exit 0：B1/B2 `legacy`、B3 `symbol`；B3 `Context.root === Symbol.for('cordis.root')`，B1/B2 absent；命中通道有 `timeout` function；fiber legacy 形态符合期望（B3 absent-or-throw）。通道行为测试（`cordis-root-channel` / `ws-cordis-channel`）在三基线绿：symbol 优先（legacy 读取=0）、legacy 兜底、malformed/双缺席 loud fail 稳定文案、形状不符 loud fail、`timer.ctx → ctx` 两跳、无 ambient timer。 |
| **A2-3 fail-closed 负控** | 必须真跑 N-1…N-4（§6.2）且「外层 exit 0 当且仅当内层 observed=fail」；N-5 integrity 钉值下调必须使 acquire 失败；恢复后必须绿。任何负控应红实绿 → AC2 红、release 阻断。 |
| **A2-4 同名/工件/通道边界** | B2（npm 4.1.0）与 B3（DSH rc.12，同为 4.1.0）必须表现为不同 realpath、不同通道；不得出现「版本号相同即可互相替代」或「B1 绿抵销 B3」。 |
| **A2-5 缓存不可信** | `acquire.mjs` 每次 run 复核 integrity/rev-parse/porcelain/ls-tree/output；本轮 `.cache/` 为空 → 重新获取；不得仅凭缓存命中判绿。 |
| **证据载体** | `.cache/cordis-baselines/evidence/B*/provenance.json`、`root-probe.json`、`ws-cordis-channel.json`、`fault-<name>.json`；`.cache/cordis-baselines/overlay/*`；acquire 日志；B3 clone/`provenance-b3.json`。 |
| **通过判定** | A2-1…A2-5 全部满足；三基线各自留证；负控全部应红实红。 |
| **失败判定** | 任一基线 realpath 不在 overlay、出现第二份 cordis、版本/integrity 漂移、B3 非钉死 commit、通道错配、负控未红、用缓存冒充重新获取。 |

### 12.3 AC3 — 真实打包产物门禁（`pack:local` / `publish:verify` / `publish:reproducible`）

| 项 | 内容 |
|---|---|
| **A3-1 构建真实 tarball** | 在 `R` 上 `node scripts/build-local-packages.mjs <out>`（等价 `pnpm pack:local`）exit 0；15 个 tarball；`manifest.json` 键集合 = `scripts/package-catalog.mjs` 的 15 包；每个 filename 与 package name/version 一致。**不得**用源码 worktree、`--conditions=nomicore-source` 或 `dist` 替代 tarball。 |
| **A3-2 发布验证（registry integrity 开启）** | `node scripts/verify-package-tarballs.mjs <out>` **默认模式** exit 0：15 包逐个 name/version/private/license/publishConfig/registry/exports/bin/dependency 协议检查；已发布版本 integrity 必须与本地 tarball sha512 相同；未发布版本必须通过 `npm publish --dry-run --json --ignore-scripts`。禁止 `NOMICORE_VERIFY_REGISTRY_INTEGRITY=0`。 |
| **A3-3 可复现性** | `node scripts/verify-reproducible-packages.mjs` exit 0：两次独立构建的 15 包 SHA-256 逐个相同；记录 sha256 表。 |
| **A3-4 边界（源码不替代）** | AC1 的 matrix/typecheck 与 `pnpm test` 是行为/编译证据；AC3 只接受 tarball + registry 证据。只给源码结果 = AC3 红；只给 tarball 结果 = AC1 红。两者都必须存在且绑定同一 `R`。 |
| **A3-5 负控** | 当前 HEAD（未 bump）必须红（已实测）；stale manifest / 篡改 tarball 字节 / 删一个 tarball 必须红；`NOMICORE_VERIFY_REGISTRY_INTEGRITY=0` 视为伪绿；`publish:reproducible` 失败不得用单次构建代替。 |
| **证据载体** | `.cache/sa6-472/` 或 final-verification 目录下的 `pack.log`、`publish-verify.log`、`publish-reproducible.log`、`sha256.json`、`manifest.json` 副本；registry 查询结果；本轮 `R`/toolchain。 |
| **通过判定** | A3-1…A3-5 全部满足；15/15 包通过；日志与 digest 可复核。 |
| **失败判定** | 任一命令红/缺失；跳过 registry integrity；只跑结构检查；用源码结果替代；tarball 与 `R` 不绑定。 |

### 12.4 AC4 — `0.5.0` 版本与变更记录；公共契约无非预期变化

| 项 | 内容 |
|---|---|
| **A4-1 版本矩阵** | 7 包闭包按 §9.3 矩阵 bump（persistence **0.5.0**；其余 > 当前已发布版本；推荐值见 §10.1）；非闭包 8 包版本不变；每个 bumped 版本必须由 `publish:verify` 证明「未发布 or 与本地 tarball 一致」。偏离推荐矩阵必须记录理由并经 SA8 批准。 |
| **A4-2 manifest 收敛** | `artifacts/local-packages/manifest.json` 15 键不变、7 个 filename 更新；与 `pack:local` 生成结果逐字节一致；旧 filename 不得残留。 |
| **A4-3 变更记录（既有流程）** | 以 `chore(release)` 提交正文作为变更记录（仓库无 `CHANGELOG.md`；根 `package.json` 私有且不 bump）。正文必须包含：① 版本矩阵与闭包理由；② 内容（#470/#471 双形态 Root seam，无公共 API 变化）；③ AC1 的 3×15 typecheck 与 41/41 矩阵结果；④ AC2 的工件身份/provenance digest/通道与负控结果；⑤ AC3 的 pack/publish:verify/publish:reproducible 结果；⑥ AC4 的公共契约冻结确认；⑦ known-red 披露（4 test-d + 28 环境红，或对齐 pnpm 后的实际值；不宣称全绿）；⑧ 非目标（无真实 MABF/DSH 部署、无 patch 移除）；⑨ 不复用 #464–#466 证据；⑩ toolchain 与 `R`。证据：`git show --format=%B --stat <release-sha>`。 |
| **A4-4 公共 API/schema/wire/服务名/持久化布局冻结** | 逐项证据：<br>① **Namespace API**：`packages/namespace-api/src`、`namespace-runtime/src`、`vfsl*/src` 相对 `19df983` 零 diff；projection/类型面不变。<br>② **Registry API**：`namespace-registry/src` 零 diff；`guard-proxy` + `unload` 三基线绿。<br>③ **Replication API**：`ws-replication/src/index.ts` 零 diff；4-entry 运行时快照（或补齐后的 7-entry）不变；`guard-proxy`/interop 三基线绿。<br>④ **schema**：`domains/*/schema.vfsl` + `generated.ts` 零 diff；`pnpm generate --check`（固定 10.28.2）exit 0。<br>⑤ **wire protocol**：`packages/replication-protocol/src` + `docs/protocols` 零 diff；`issue246-interop-matrix` + `issue418-*` 三基线绿。<br>⑥ **服务名**：8 个服务名（`nomicoreInstance`、`clock`、`timer`、`nomicorePersistence`、`nomicoreRegistry`、`nomicoreHubReplication`、`nomicorePeerReplication`、`nomicoreHubSessionHost`）字面不变；guard-Proxy 消费测试通过。<br>⑦ **持久化布局**：`persistence`/`dsh-persistence` 源变化仅 `service.ts` seam；`contract` suite 243/247 ×3 全绿；snapshot/META/诊断 JSONL 键名断言不变。 |
| **A4-5 记录一致性** | 不得重复 #471 的「7-entry 已扩」错误声明；实际快照范围必须与记录一致（4 或补齐后的 7，二选一并留证）。任何把未发生的变化写进 release 记录的行为 = AC4 红。 |
| **证据载体** | package.json diff；manifest；`git show --format=%B`；`publish:verify` 日志；`guard-proxy`/`contract`/`unload` 三基线 cell；public-surface snapshot/test；`generate --check` 日志；`git diff 19df983..R` 生产面零 diff（除两个已合并 seam 文件）。 |
| **通过判定** | A4-1…A4-5 全部满足；`publish:verify` 15/15；公共契约冻结五项证据齐全；release 记录完整且无虚假声明。 |
| **失败判定** | 版本未 bump/闭包不全；manifest 陈旧；release 记录缺项或夸大；任何公共 API/schema/wire/服务名/持久化布局非预期变化；沿用错误的 7-entry 声明；release 记录宣称 root-test/CI 全绿。 |

### 12.5 AC5 — 依赖范围与 dependency/peerDependency 归属不变

| 项 | 内容 |
|---|---|
| **A5-1 安装契约冻结** | 全部 16 个 workspace manifest（15 publishable + 根）中 `@deepseek-ai/cordis` 仍为 `^4.0.1`、`@deepseek-ai/cordis-plugin-timer` 仍为 `^1.1.3`；不新增 `peerDependencies`；不把 dependency 改成 peerDependency；不改变包归属/依赖图。 |
| **A5-2 release diff 只含版本** | `git diff 6be891a..R -- '*package.json'` 只出现 7 个包 `"version"` 行；`dependencies`/`optionalDependencies`/`peerDependencies`/`devDependencies` 逐字节不变；`pnpm-lock.yaml`、`scripts/package-catalog.mjs`、根 `package.json` 零 diff；无 `patchedDependencies`。 |
| **A5-3 阻断条件** | 若要让三基线/发布门禁通过必须改变依赖范围或归属 → **停止收官**，另立 ADR；不得在本票内实现。 |
| **证据载体** | manifest JSON canonical diff；lockfile diff；catalog diff；`git diff 6be891a..R`；`publish:verify` 的 dependency 协议检查（`workspace:`/`file:` 零命中）。 |
| **通过判定** | A5-1/A5-2 全绿；无 A5-3 情形。 |
| **失败判定** | 任一 range/归属变化；lock/catalog 变化；新增 peer/patchedDependencies；用依赖升级掩盖兼容问题。 |

### 12.6 AC6 — 结果回填 ticket 与集成 PR；不改 #468 Parent

| 项 | 内容 |
|---|---|
| **A6-1 Issue #472 回填** | 新增评论（当前 0 条）至少包含：AC1 的 3×15/15 typecheck 与 41/41 matrix；AC2 三基线身份/通道/负控结果；AC3 15 包 pack/publish:verify/publish:reproducible；AC4 版本矩阵 + 公共契约冻结 + release commit SHA；known-red 披露；非目标声明。证据：`gh api repos/nomicore-ai/nomicore/issues/472/comments` 的 JSON 落盘。 |
| **A6-2 集成 PR 回填** | `mabf/issue-472` → `spec/468-cordis-rc12-root` 的 PR 正文/评论包含同一组结果与证据路径；PR 的 Parent/head 关系不变。证据：`gh pr view --json` 落盘。 |
| **A6-3 #468 tracking 边界** | #468 保持 `state=open`；正文 `## Parent` 仍为 `PR #469（spec/468-cordis-rc12-root）`；不得 close、不得改写 Parent。证据：操作前后 `gh api .../issues/468` 的 body/state 快照 + diff（仅允许无关的追加评论，不允许 Parent 变化）。 |
| **通过判定** | A6-1/A6-2/A6-3 全部满足。 |
| **失败判定** | 无回填/缺关键数字；#468 被关闭或 Parent 被改写；用 wiki 内部记录代替 GitHub 回填。 |

### 12.7 AC7 — 明确排除真实 MABF/DSH 部署与本地 patch 移除

| 项 | 内容 |
|---|---|
| **A7-1 明确记录** | release commit 正文、Issue #472 回填、集成 PR 正文/评论、final-verification 报告都必须有同义声明：真实 MABF/DSH Host 部署、迁移窗口、本地 patchedDependencies 移除均不属于本阶段；不宣称 Host 可据此删除 patch。 |
| **A7-2 无越界动作** | 验收命令白名单 = node/git/tsc/vitest/npm registry HTTPS/gh read；不执行 DSH/MABF 部署、不修改/移除 patch、不新增 `patchedDependencies`、不修改 Host 仓库。 |
| **A7-3 无完成性声明** | 不得出现「Host 已兼容」「可以删除 MABF patch」「部署已验证」等表述。 |
| **证据载体** | release 记录/issue/PR 文本；命令日志；`git diff` 无 patchedDependencies；ADR 0035 §6 引用。 |
| **通过判定** | A7-1…A7-3 全部满足。 |
| **失败判定** | 缺声明；执行部署/patch 移除；任何完成性声明。 |

### 12.8 AC8 — #464–#466 保持撤回，不复用其证据

| 项 | 内容 |
|---|---|
| **A8-1 状态保持** | #464/#465/#466 仍 `state=closed`，撤回评论仍在（本轮实读：三条评论均写明「撤回：…错误 DSH 审计锚点…」）。 |
| **A8-2 证据隔离** | release 记录/回填/验证报告不得把 #464–#466 的 POC、rc.3 tag `38a6a5c965`、或任何已撤回结论作为本票证据；只允许作为「已撤回、不使用」的历史说明。不得新增/复活其 POC 文件。 |
| **A8-3 与 ADR 一致** | ADR 0035 §5 的「不使用此前错误标记为 rc.3 的 POC 作为 rc.12 验收证据」保持有效；ADR 文本不得被本票改写（除非另立 ADR）。 |
| **证据载体** | `gh api` 三个 issue 的 state/comments；release 记录文本；`git diff` 无 docs/adr 变更；仓库内无新增 POC。 |
| **通过判定** | A8-1…A8-3 全部满足。 |
| **失败判定** | 任一 issue 被 reopen/改写撤回评论；release 证据引用 #464–#466；复活 POC；改 ADR 追认。 |

### 12.9 AC → 验收主体包

| AC | 主体包/面（必测） | 只读/装配依赖 |
|---|---|---|
| AC1 | 全仓 15 project + 12 suite（persistence/ws-replication/registry/clock/dsh/app） | 三基线 Cordis/Timer 工件 |
| AC2 | `persistence`/`ws-replication` 的 Root 通道与工件身份；acquire/provenance/root-probe | B1/B2 npm、B3 DSH 工件 |
| AC3 | 15 个 publishable 包的 tarball + manifest + registry | `scripts/package-catalog.mjs`、`create-publish-manifest.mjs` |
| AC4 | 7 包版本闭包 + manifest + release 记录；公共 API/schema/wire/服务名/持久化布局 | 全仓只读；ADR 0035 |
| AC5 | 16 个 workspace manifest + lockfile + catalog | 三基线行为证据（只读） |
| AC6 | GitHub Issue #472 / 集成 PR / #468 | `gh` read |
| AC7 | release 记录 / 命令白名单 / diff | ADR 0035 §6 |
| AC8 | GitHub #464–#466 / release 记录 | ADR 0035 §5 |

---

## 13. Red/green baseline evidence

### 13.1 本轮三基线矩阵（HEAD `6be891a`）

`node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs --all --matrix`：

| baseline | typecheck | 12 suites | 结果 |
|---|---|---|---|
| B1 | 15/15 project exit 0 | provenance 4/4、root-probe 12/12、contract 243/243、real-timer 11/11×3、dsh-profile 12/12、unload 10/10、ws-package 66/66、guard-proxy 71/71、ws-cordis-channel 33/33、ws-cordis-timers 12/12×3、replication-lifecycle 34/34×3、composition-root 28/28 | 13/13 pass |
| B2 | 15/15 project exit 0 | 同上（contract 243/243） | 13/13 pass |
| B3 | 15/15 project exit 0 | provenance 8/8、contract 247/247，其余同 B1 | 13/13 pass |
| gates | — | G1′–G12（HEAD 上） | 12/12 pass |
| root-test | — | 默认布局 `vitest run --typecheck`，冻结台账判定 | **pass（ledger）**：5956/5988，failed=32 = 4 knownRed + 28 environmentRed；`failedUnexpected=[]`；vitest exit=1 被台账解释，**不是全绿**（§13.3） |

**聚合**：39/39 baseline cells + gates + root-test = **41 cells**；本轮 `matrix.json` 记录 `generatedAt = 2026-11-14T22:24:17.171Z`、41 cells、0 非 pass；runner 输出 `MATRIX PASS: 41 cells`，exit 0。HEAD 上该矩阵全绿（按 root-test 台账规则）；这证明生产 seam 与验收设施在当前 base 可用。

### 13.1b 本轮 fault 负控（AC2）

四条内建 fault 均「外层 exit 0 当且仅当内层 observed=fail」：

| 负控 | 命令 | 结果 |
|---|---|---|
| 工件解析回退 | `--baseline B3 --fault fallback --suite provenance --suite root-probe` | 外层 exit 0；`observed=fail code=1`；`B3/fault-fallback.json` |
| 同名替换 | `--baseline B3 --fault substitute-npm ...` | 外层 exit 0；`observed=fail`；`B3/fault-substitute-npm.json` |
| 通道错配 | `--baseline B2 --fault substitute-rc12 ...` | 外层 exit 0；`observed=fail`；`B2/fault-substitute-rc12.json` |
| legacy shim | `--baseline B3 --fault legacy-shim ...` | 外层 exit 0；`observed=fail`；`B3/fault-legacy-shim.json` |

另做 integrity 钉值下调负控：一次性 RC worktree 中把 B1 cordis integrity 改成错误值后 `acquire.mjs --baseline B1` → **exit 2**（`[acquire] FAIL <integrity> ... sha512 mismatch`）；恢复原值后 → **exit 0**。证据：`.cache/sa6-472/acquire-integrity-tamper.log` / `acquire-integrity-restored.log`。

### 13.1c 证据 fail-closed 负控（AC2/§12.0）

本轮用独立审计脚本 `.cache/sa6-472/audit-matrix.mjs` 对 41-cell 证据做完整性/新鲜度/名集审计：

| 场景 | 结果 |
|---|---|
| 正常 | `{cells:41, expected:41, problems:[], ok:true}`，exit 0（`audit-ok.json`） |
| 删除 `B2/root-probe.json` | exit 1，problems 含 `missing .cache/.../B2/root-probe.json`（`audit-missing.json`） |
| 截断 `B3/provenance.json` | exit 1，problems 含 `unparsable ... Expected property name`（`audit-corrupt.json`） |
| 恢复 | exit 0（`audit-restored.json`） |

> 这证明「缺证据/坏证据不得判 pass」在矩阵层面可机械执行；最终验证必须把该审计纳入 release gate，并以本轮开始 marker 检查 mtime（本轮诊断未提前建 marker，因此只做了完整性/损坏/名集演示）。

### 13.2 release 门禁（同一 HEAD）

| 门禁 | 结果 |
|---|---|
| `build-local-packages /tmp/sa6-pack` | exit 0（15 tarball） |
| `verify-package-tarballs /tmp/sa6-pack` | **exit 1**（persistence@0.4.0、ws-replication@0.5.0 integrity mismatch） |
| `verify-reproducible-packages` | exit 0（15 包一致） |

### 13.3 root-test（默认布局，非 AC1 逐基线证据）

- 本轮 `run-baseline --all --matrix` 的 root-test cell 在默认布局运行（PATH 未固定为 10.28.2），实际结果：`numTotalTests=5988`、`numPassedTests=5956`、`numFailedTests=32`；32 红 = **4 个 knownRed**（`ws-replication-issue421-edge-factory-api.test-d.ts`）+ **28 个 environmentRed**（pnpm 环境未对齐）；`failedUnexpected=[]`；JSON fresh、可解析；cell `status=pass`（ledger 规则），但 **vitest exitCode=1**。
- 本轮另行复现 test-d 4 failed（§9.6）；若最终验证用固定 10.28.2 PATH 运行，28 个环境红预期转绿，实际 counts 必须原样记录；若仍有环境红，按台账披露，不得扩账。
- **不得**据此宣称 root-test/CI/所有既有测试全绿；也不得把 vitest exit=1 写成「root-test 全绿」。

### 13.4 一次性 release-candidate（因果实验）

| 门禁 | 结果 |
|---|---|
| pack（7 包 bump + manifest） | exit 0（15 tarball；7 个新 filename） |
| publish:verify（registry integrity on） | **exit 0**（7 个新版本 dry-run；8 个 already-published） |
| publish:reproducible | exit 0（15 包一致） |
| frozen lockfile | exit 0；lockfile 零 diff |
| gates | **exit 1**：G1′/G3/G6（§9.4），其余 9 gate 绿 |

---

## 14. Runner trigger evidence

| 入口 | 命令（工作树相对） | 本轮真实结果 |
|---|---|---|
| 三基线获取 | `node packages/persistence/test/fixtures/cordis-baselines/acquire.mjs --all` | exit 0；B1/B2/B3 overlay；B3 provenance digest `9d663355…` |
| 三基线矩阵 | `node .../run-baseline.mjs --all --matrix` | **exit 0；MATRIX PASS: 41 cells**（B1/B2/B3 各 13 cell pass；gates 12/12；root-test pass-by-ledger 5956/5988，failedUnexpected=[]） |
| fault 负控 ×4 | `--baseline B3 --fault fallback`、`--baseline B3 --fault substitute-npm`、`--baseline B2 --fault substitute-rc12`、`--baseline B3 --fault legacy-shim`（均 `--suite provenance --suite root-probe`） | 4/4 外层 exit 0，内层 `observed=fail` |
| integrity 钉值下调 | 一次性副本改 B1 cordis integrity 后 `acquire.mjs --baseline B1` | **exit 2**（sha512 mismatch）；恢复后 exit 0 |
| 证据审计 | `.cache/sa6-472/audit-matrix.mjs` | 正常 exit 0；删 cell/截断 JSON 各 exit 1；恢复 exit 0 |
| HEAD 打包 | `node scripts/build-local-packages.mjs /tmp/sa6-pack`（PATH 10.28.2） | exit 0 |
| HEAD 发布验证 | `node scripts/verify-package-tarballs.mjs /tmp/sa6-pack` | **exit 1**（2 integrity mismatch） |
| HEAD 可复现 | `node scripts/verify-reproducible-packages.mjs` | exit 0 |
| 一次性 RC 打包 | 同上（probe worktree） | exit 0（15 tarball） |
| 一次性 RC 发布验证 | 同上 | **exit 0** |
| 一次性 RC 可复现 | 同上 | exit 0 |
| 一次性 RC gates | `node .../gates.mjs`（probe worktree） | **exit 1**：G1′/G3/G6 |
| 既有 test-d | `vitest run --typecheck .../ws-replication-issue421-edge-factory-api.test-d.ts` | exit 1（4 failed / 4 passed） |
| ws tsc | `tsc -p packages/ws-replication/tsconfig.json` | exit 0 |
| lockfile 稳定性 | `pnpm install --frozen-lockfile --lockfile-only`（probe） | exit 0；`pnpm-lock.yaml` 零 diff |
| Issue 评论 | `gh api .../issues/472/comments --paginate` | `[]` |
| #468 / #464–#466 | `gh api .../issues/{468,464,465,466}` | #468 open（Parent=PR #469）；#464–#466 closed + 撤回评论 |

> 说明：本轮第一次 gates probe 因预先存在的 `.worktrees/base-snapshot` 注册 worktree 触发 G5 的 stale 保护（exit 2）；删除该 worktree 后重跑得到 §9.4 的 3/12 红。这是诊断环境操作错误，不是产品缺陷；最终验证按 gates 自身的「无注册 base worktree」前置条件运行。

---

## 15. Unknowns and blockers

### 15.1 无阻塞项（可继续）

- 三基线工件本轮可重新获取/构建；网络可用；矩阵可运行；publish 门禁可运行。
- 无 owner 评论加码；#470/#471 blockers 已解除（已合并进 `6be891a`）。
- release 缺口是**实现缺口**，不是规范不可满足：7 包 bump + gate allowlist + release 记录 + 回填是明确可执行的。

### 15.2 必须显式记录的边界/未知

1. **S1 gate 语义**：把 G1′/G3/G6 改为 release allowlist 是验收设施变更；必须由 SA8 追认，且不得放宽 G2/G4/G5/G7–G12。若不改，AC1 的 gates cell 与 AC3/AC4 互斥。
2. **S2 版本语义**：「Nomicore 0.5.0」= release/批次名，不是 15 包统一版本。7 包闭包是本报告推导；若 owner 要求统一 minor，需显式确认（会改变大量无关包的已发布版本）。
3. **S3 #471 7-entry 声明**：实际 4-entry；#472 必须修正记录或补齐快照。未修正前，release 记录不得声称 7-entry 已存在。
4. **root-test 32 红**：4 个 test-d 是 BASE 既有债务（#470 I-5.2 / #471 披露，另立后续票）；28 个环境红在 10.28.2 对齐后预期转绿。release 记录必须披露实际 counts。
5. **B3 非官方构建**：最小 tsc source-build，不是 DSH 官方 `tsc -b + tsdown`；沿用 #470 的诚实标注。
6. **真实 Host 部署/patch 移除**：ADR 0035 §6 排除；本票不宣称。
7. **root-test 的 pnpm 依赖**：最终验证必须固定 10.28.2 PATH；否则 28 个环境红会掩盖真实结果。不得用 `NOMICORE_VERIFY_REGISTRY_INTEGRITY=0` 等语义 override。
8. **gate BASE**：应重钉到本票 base `6be891a`（而不是 `d59a4d1`），否则 release allowlist 需要同时容纳 #470/#471 的设施 diff，审计面变宽。
9. **release 提交时序**：G6 要求 artifacts clean；必须先提交 release 文件，再跑矩阵/门禁；否则 G6 必红。
10. **npm dry-run 的登录提示**：`npm publish --dry-run` 会打印「requires you to be logged in」warning，但本轮 RC 实跑 exit 0；不得把 warning 当失败，也不得把 dry-run 当真实发布。

---

## 16. Temporary diagnostics cleanup

| 诊断活动 | 位置 | 状态 |
|---|---|---|
| 依赖安装 | 工作树 `node_modules/`（既有） | 保留（运行所必需，gitignored） |
| 基线缓存/证据 | `.cache/cordis-baselines/**`、`.cache/sa6-472/**` | 保留（gitignored；本轮证据，供复核） |
| 一次性 release-candidate worktree | `.worktrees/sa6-release-probe` | **已删除**（`git worktree remove --force`；见 §16 收尾记录） |
| 临时 tarball | `/tmp/sa6-pack`、`/tmp/sa6-release-pack`、`/tmp/sa6-x`、`/tmp/sa6-y` | **已删除** |
| PATH shim | `/tmp/sa6-bin/pnpm` | **已删除** |
| base snapshot worktree | `.worktrees/base-snapshot` | 已删除/prune（gates 正常运行时会自行创建/删除） |
| 后台作业 | 本会话 bash jobs | 全部 finished；无 nohup/setsid/PID 文件/轮询 marker |
| 仓库工作树 | `git status --porcelain` | `?? wiki/raw/task_issue-472.md`、`?? wiki/raw/task_issue-472_dispatch.md`、`?? wiki/raw/task_issue-472_sa6_acceptance_contract.md`（本文件）——无 `packages/`/`apps/`/`domains/`/`docs/`/`artifacts/`/根清单改动 |

---

## 17. 必须动态验证（data-flow / state-machine）断言清单

以下断言无法由静态检查/源码字符串替代，必须由 final-verification 实际执行并观察运行时/数据流结果：

| # | 动态断言 | 类型 | 最小命令/证据 |
|---|---|---|---|
| D1 | 每基线测试位置与生产 leaf 位置解析到同一 realpath，且恰一份 cordis | 数据流（模块解析） | `run-baseline --baseline B{1,2,3} --suite provenance` |
| D2 | B1/B2 legacy、B3 symbol；B3 `Context.root` static symbol；命中通道可 arm | 状态机（Root 通道） | `--suite root-probe` + `root-probe.mjs` JSON |
| D3 | symbol 优先、legacy 兜底、malformed/双缺席 loud fail、无 ambient timer、`timer.ctx → ctx` 两跳 | 状态机 | `--suite ws-cordis-channel` / persistence channel |
| D4 | Persistence 真实 Timer 的 flush/retry/drain/dispose，UNLOADING 窗口写提交先于 dispose | 状态机 | `--suite real-timer` ×3 + `--suite unload` |
| D5 | Registry 启动/shutdown/revoke、dependent Fiber join、R5P 卸载窗口写 | 状态机 | `--suite unload` |
| D6 | Hub/Peer/SessionHost × 7 场景 × 3 基线 = 63 单元；23 名 lifecycle 枚举 + coverage + issue420 | 状态机 | `--suite replication-lifecycle` ×3 repeat |
| D7 | 12 timer 族 arm → trigger → cancel（真实 baseline TimerService） | 状态机/数据流 | `--suite ws-cordis-timers` ×3 repeat |
| D8 | 冻结服务 getter + guard-Proxy 五面 + wire/结构守卫 | 运行时 Proxy/数据流 | `--suite guard-proxy` |
| D9 | DSH profile 直接 apply 的 dispose 顺序、第三方组合根拆卸序、Timer 最后释放 | 状态机 | `--suite dsh-profile` + `--suite composition-root` |
| D10 | 打包产物从 tarball 解包后的 packed manifest 重写、exports/bin、dist 可加载（不使用 source condition） | 数据流（打包） | `pack:local` + `publish:verify` + 解包/加载 smoke |
| D11 | 版本 → packed 依赖 → manifest filename → registry integrity 的端到端一致 | 数据流（release） | `publish:verify` 默认模式 + registry 查询 |
| D12 | fault 负控（fallback/substitute-npm/substitute-rc12/legacy-shim）内层应红 | 数据流（污染） | `--fault ...`；外层 exit 0 iff observed=fail |
| D13 | 证据缺失/损坏/过期/跨轮混用必须被审计判红 | 数据流（证据） | 证据审计脚本/命令 + 删除/篡改/旧 mtime 负控 |
| D14 | root-test 失败名集合 ⊆ 冻结台账；新红不被吞 | 数据流（名集） | `root-test` cell JSON + 名集比较 |
| D15 | `pnpm generate --check` 与 lockfile 稳定性 | 数据流（生成/依赖） | `generate --check`、`pnpm install --frozen-lockfile --lockfile-only` |

---

## 18. 规范一致性账本、verdict 与关键缺口

### 18.1 判定

**verdict = approve**。理由：

- 三基线工件本轮已从空缓存重新获取；矩阵、provenance、root-probe、gate、test-d 红均在本轮实跑，诊断可复核。
- release 缺口有精确、可重复的因果证据（HEAD publish:verify 红；7 包 bump 后 RC publish:verify/reproducible 绿；RC gates 的 3 个红点定位到 G1′/G3/G6）。
- 验收契约的每条断言都有可执行命令、证据路径与失败判据；负控存在且可执行。
- 不存在需要修改 ADR 0035 的规范冲突；ADR §4（依赖/公共契约不变）与 §6（排除 Host 部署）在本契约中被原样保持。

### 18.2 requiresConflictRecheck = true（票级 supersession 清单）

| # | 事项 | 与既有工件的关系 | 需要谁追认 |
|---|---|---|---|
| **S1** | release 版本/manifest diff 与 G1′/G3/G6 零 diff 语义不相容；需 BASE 重钉 `6be891a` + release allowlist + 提交时序 | 扩展 #470 R7/#471 的 gate 契约；不是 ADR 冲突 | SA8/设计 + SA10 |
| **S2** | 「Nomicore 0.5.0」的版本语义：7 包闭包、persistence 0.5.0、ws/yjs 0.6.0；不是 15 包统一版本 | 既有 release 流程（`19df983`/`3321390`/`303666d`/`abbb89a`）的延续；需 owner 确认是否另有统一 bump 意图 | SA8/owner |
| **S3** | #471 提交正文的「4→7 public entry」声明与实际树不符；#472 需修正记录或补齐 7-entry | 证据工件（`wiki/raw/` 非规范）；不影响 ADR，但影响 AC4 记录可信度 | SA8/SA10 + 本票实现 |
| **S4** | root-test 32 红（4 test-d + 28 环境）只能披露、不得扩账/宣称全绿 | #470/#471 既有裁定；本票沿用 | SA10/最终验证 |

### 18.3 关键缺口清单（按收尾阻断优先级）

1. **G-R1（AC3/AC4）**：版本未 bump；HEAD `publish:verify` 红（2 个 integrity mismatch）。
2. **G-R2（AC1/AC3/AC4）**：G1′/G3/G6 与 release diff 不相容；必须加 release allowlist + BASE 重钉 + manifest 先提交。
3. **G-R3（AC4/AC6）**：无 `chore(release)` 版本/变更记录；Issue #472/PR 未回填。
4. **G-R4（AC1/AC2/AC3）**：本票证据必须本轮重新生成；历史 #470/#471 不能替代（已开始/完成本轮矩阵与门禁实跑）。
5. **G-R5（AC4）**：公共 API 确认实际为 4-entry；#471 的 7-entry 声明不成立；release 记录不得沿用。
6. **G-R6（AC1/AC4）**：root-test 32 红必须如实披露；4 个 test-d 既有债务不修但不得掩盖。
7. **G-R7（AC5）**：安装契约必须零 diff；若必须改变 → 停 + 新 ADR。
8. **G-R8（AC6）**：#468 保持 open + Parent=PR #469；#464–#466 保持撤回（AC8）。
9. **G-R9（AC7）**：必须显式写「不部署/不移 patch/不宣称 Host 完成」。
10. **G-R10（AC2）**：fault/工件/证据负控必须真跑应红实红；本轮 N-1…N-5 已应红实红，最终验证须在 release candidate 上重跑；缺证据不得判绿。

### 18.4 哪些情况会翻转为 reject

- 三基线工件无法在本轮稳定获取/构建，或矩阵红无法定位到产品/设施之外的确定原因。
- release 的正确做法必须改变 Cordis/Timer 依赖范围或 dependency/peerDependency 归属（ADR §4 冲突，需另立 ADR）。
- `publish:verify`/`publish:reproducible` 在 7 包 bump 后仍不能转绿，且原因不是版本/manifest/gate 的确定性缺口。
- #468 被关闭/Parent 被改写，#464–#466 被重新启用，或 release 记录复用其证据。
- 证据审计无法 fail-closed（缺失/损坏/过期证据仍能判 pass）。

---

## 附录 A：本轮命令与产物（可复核）

```bash
# 0) 环境
node -v                                  # v24.13.0
pnpm --version via corepack 10.28.2      # 10.28.2
npm --version                            # 11.9.0
tsc --version                            # 5.9.3
vitest --version                         # 3.2.7

# 1) 三基线（空缓存，本轮重新获取）
node packages/persistence/test/fixtures/cordis-baselines/acquire.mjs --all
#   → B1/B2/B3 overlay；B3 provenanceDigest=9d663355…

# 2) 三基线矩阵（HEAD）
node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs --all --matrix
#   → 41 cells；MATRIX PASS: 41 cells；B1/B2/B3 各 13 cell pass；gates 12/12；
#     root-test 5956/5988，32 known-red（4 frozen + 28 environment），failedUnexpected=[]

# 2b) AC2 fault 负控（本轮 4/4 应红实红）
node .../run-baseline.mjs --baseline B3 --fault fallback --suite provenance --suite root-probe
node .../run-baseline.mjs --baseline B3 --fault substitute-npm --suite provenance --suite root-probe
node .../run-baseline.mjs --baseline B2 --fault substitute-rc12 --suite provenance --suite root-probe
node .../run-baseline.mjs --baseline B3 --fault legacy-shim --suite provenance --suite root-probe
#   → 每条外层 exit 0 且 observed=fail

# 2c) 证据 fail-closed 审计（本轮诊断脚本，未入库）
node .cache/sa6-472/audit-matrix.mjs
#   → ok:true；删/坏任一 cell JSON → exit 1

# 3) HEAD 打包与发布门禁
PATH=<pnpm-10.28.2-bin>:$PATH node scripts/build-local-packages.mjs /tmp/sa6-pack   # exit 0
node scripts/verify-package-tarballs.mjs /tmp/sa6-pack                                # exit 1（2 mismatch）
node scripts/verify-reproducible-packages.mjs                                         # exit 0

# 4) 一次性 release-candidate（7 包 bump；仅诊断）
#    .worktrees/sa6-release-probe：HEAD 6be891a + 7 包版本 + manifest
PATH=<pnpm-10.28.2-bin>:$PATH node scripts/build-local-packages.mjs /tmp/sa6-release-pack   # exit 0
node scripts/verify-package-tarballs.mjs /tmp/sa6-release-pack                                # exit 0
node scripts/verify-reproducible-packages.mjs                                                 # exit 0
pnpm install --frozen-lockfile --lockfile-only                                                # exit 0；lock 零 diff
node packages/persistence/test/fixtures/cordis-baselines/gates.mjs                            # exit 1：G1′/G3/G6

# 5) 既有 test-d 红
NODE_OPTIONS=--conditions=nomicore-source node node_modules/vitest/vitest.mjs run --typecheck \
  --passWithNoTests=false packages/ws-replication/test/ws-replication-issue421-edge-factory-api.test-d.ts
#   → 4 failed / 4 passed

# 6) GitHub 状态
gh api repos/nomicore-ai/nomicore/issues/472/comments --paginate          # []
gh api repos/nomicore-ai/nomicore/issues/468                             # open；Parent=PR #469
gh api repos/nomicore-ai/nomicore/issues/{464,465,466}                   # closed + 撤回评论
```

产物路径：

| 产物 | 路径 |
|---|---|
| 三基线 overlay/workspaces | `.cache/cordis-baselines/{overlay,workspaces}/`（gitignored） |
| 本轮矩阵证据 | `.cache/cordis-baselines/evidence/{B1,B2,B3,gates,root-test,matrix}/` |
| fault 负控证据 | `.cache/cordis-baselines/evidence/B{2,3}/fault-*.json`；`.cache/sa6-472/fault-*.log` |
| integrity 下调负控 | `.cache/sa6-472/acquire-integrity-tamper.log` / `acquire-integrity-restored.log` |
| 证据审计 | `.cache/sa6-472/audit-matrix.mjs` + `audit-{ok,missing,corrupt,restored}.json` |
| HEAD publish:verify 红证据 | `.cache/sa6-472/publish-verify-head.log` |
| RC 元数据 | `.cache/sa6-472/release-candidate-probe.json` |
| RC gates 证据 | `.cache/sa6-472/gates-release-probe.log` |
| 本报告 | `wiki/raw/task_issue-472_sa6_acceptance_contract.md` |

## 附录 B：AC → 缺口 → 证据载体 → 当前状态

| AC | 缺口 | 证据载体（本轮/新增） | HEAD 状态 |
|---|---|---|---|
| AC1 | G2/G4：matrix 在 HEAD 全绿，但 release candidate 上 gates cell 会红；需 release allowlist | `run-baseline --all --matrix` + gates 扩展 | matrix 绿；release candidate gates 红（预期） |
| AC2 | 无（设施已存在）；需本轮 fault 负控实跑 | provenance/root-probe/fault cells | 正控绿；fault 4/4 应红实红（本轮）；N-5 应红实红；证据缺失/损坏审计应红已演示 |
| AC3 | G1：版本未 bump → publish:verify 红 | tarball + registry integrity + reproducible | **红**（2 mismatch） |
| AC4 | G3/G5：无 release 记录；公共面实际 4 entry；#471 记录不一致 | package.json/manifest/release commit body/public snapshot | **缺失/待修** |
| AC5 | 无（当前依赖/lock/catalog 零 diff）；需 release allowlist 守住 | manifest/lock/catalog diff | 绿（HEAD） |
| AC6 | G7：Issue #472 无回填；PR 未回填 | gh api comments/PR JSON | **缺失** |
| AC7 | 需在 release 记录中显式声明 | 文本证据 | 待写 |
| AC8 | #464–#466 已 closed + 撤回；需保持 | gh api states/comments | 绿（保持） |

---

**结论**：本报告诊断可信、契约可执行；当前 release 增量尚未实施是预期的实现缺口。`verdict = approve`，`requiresConflictRecheck = true`（S1–S4 需 SA8/owner 追认，不是 ADR 修改，也不阻断诊断进入设计/实现）。
