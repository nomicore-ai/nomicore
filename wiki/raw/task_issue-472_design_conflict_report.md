# SA8 设计后冲突复查 — issue #472：Cordis rc.12 三基线回归与 Nomicore `0.5.0` 收官（design 复查 + S1–S4 追认）

- Reviewed subject: **design**（`wiki/raw/task_issue-472_design.md`，SA1 iter 0，442 行）
- 复查轮次：round 1，conflict-gate iteration 0（§1–§10 为历史裁定文本，保持原样以保证可追溯性）
- **当前轮裁定（round 1，conflict-gate iteration 2，design rev2 修订后复查）：verdict = clear，requiresConflictRecheck = true——见文末 §13（rev2 复查增补：PV-8a 原语补钉 `--no-renames` / 条件 9 判定口径补钉 / 条件 10 正向绑定判据 / 越界核对 / 实现就绪结论）**
- 前轮裁定（round 1，conflict-gate iteration 1，design rev1 修订后复查）：verdict = clear，requiresConflictRecheck = true——§11（rev1 复查增补：越界核对 / PV-8a+PV-8b 发布 / PV-1…PV-7 处置 / 交付条件增量）与 §12（勘误：iteration-0 三处归因失实的更正，终验不得依赖）；除 §13.2 明示的 PV-8a 原语补钉外，历史裁定全部继续有效
- 复查会话 HEAD：`6be891a3a0cb32fe21c3a6bf485f33428052ce7b`（与设计/SA6 声明的 base 一致；`git status --porcelain` 仅 4 个 untracked wiki 工件，生产面零污染）
- 本报告全部证据为本会话第一手核验（git/文件/npm 元数据/`gh api` 只读复跑），可复跑命令随条目附注。

---

## 1. Inputs and decision set

| 输入 | 状态/用途 |
|---|---|
| `wiki/raw/task_issue-472_design.md` | 被审对象（SA1 iter 0） |
| `wiki/raw/task_issue-472_sa6_acceptance_contract.md` | 上游契约（verdict=approve；§18.2 S1–S4 待追认） |
| `wiki/raw/task_issue-472.md` | Issue 正文 8 条 AC；`## Comments` 空（本会话 `gh api .../issues/472/comments --paginate` 复跑 → `[]`） |
| `docs/adr/0035-cordis-rc12-root-compatibility.md` | 规范面：§1 三基线、§2 决策形态、§4 依赖与公共契约不变、§5 工件/通道验收 +「生产包构建与发布检查保持既有门禁」、§6 排除 Host 侧实施。状态字段为「提议」，但 tracking issue #468 正文（本会话实读）明确「The corrected ADR 0035 is currently proposed and is the design reference for this phase」——本阶段规范参考，与 #470/#471 两轮 SA8 的处理一致 |
| `INSTALL.md` L162–L219「npm release preparation and publication」 | 既有 release 流程：bump 先于 manifest 重建；「Never publish different contents under the same version」；真实 publish 需 `main` + clean + `npm whoami` |
| 既有 release 批次 `19df983` / `3321390` / `303666d` / `abbb89a` | 成文约定（本会话逐个 `git show` 复核）：闭包 scoped bump、每 `package.json` 恰 1 行版本变更（stat 恒 `2 +-`）、manifest 每包 2 行（1 增 1 删）、`chore(release)` 正文记录版本矩阵/内容/门禁结果 |
| #470 SA8 冲突报告（R1–R9，verdict=clear）、#471 SA6/SA8 契约与两轮增量复查 | 可继承裁定：R7（机械 gate）、#471 S5（BASE 重钉 + 快照内容不变）、#471 impl 复查（G12 4 文件闭集、`public-surface.base.json` 冻结零 diff、台账 B-3a…e） |
| `CONTEXT.md` | 术语面；无 release/版本/CHANGELOG 类既有约定（本会话 grep 复核），「服务表面」（L174）与 ADR 0023 纪律不受本票影响 |
| 模块 `AGENTS.md`（persistence/ws-replication/docs） | 边界与验证面；设计未触碰其契约面 |

缺失输入：`task_issue-472_sa2_review.md`（iteration 0 不存在，设计 §评审修订映射同判）——非阻塞，本报告为 rg-472-design-iter0 的冲突面独立裁决。

## 2. 第一手核验记录（裁决的事实基础）

全部在本会话复跑：

1. `git rev-parse HEAD` = `6be891a…`；`git diff 19df983..HEAD --name-only` 生产面（src/domains/protocols/manifests/lock/artifacts/scripts）**恰两个 seam 文件** `packages/persistence/src/service.ts`、`packages/ws-replication/src/plugin.ts`，其余零 diff——AC4/AC5 冻结确认的 diff 基础成立。
2. `gates.mjs` 现值（本会话逐行读）：`BASE='d59a4d1…'`（L41）、`PUBLIC_ENTRIES`=4（L44–49）、`WS_ALLOW_NEW_FILES`=4（L52–57）、`FACILITY_ALLOW`=4（L60–65：baselines.json / run-baseline.mjs / gates.mjs / root-test-known-red.json）、G1′=`assertNoChange(['pnpm-lock.yaml', ...listManifests(), 'artifacts'])`（L1116，`listManifests()` 覆盖根+14 包+app+domains/vfs3-assets=17 manifest）、G3=tracked 零 diff ∧ untracked ⊆ 4 新文件（L1126）、gate 总数 12。设计 §3/§7 对现状的描述**逐项属实**。
3. 7 包闭包（本会话逐 manifest 读 workspace deps 复算）：closure = {persistence, dsh-persistence, namespace-runtime, namespace-registry, namespace-api, ws-replication, yjs-server}；反向核查 8 个非闭包包（clock/instance/replication-protocol/vfsl/vfsl-protocol/doc-runtime/vfsl-codegen/namespace-diagnostic-log）的 workspace 依赖与闭包**交集为空**（doc-runtime/vfsl-codegen/namespace-diagnostic-log 仅依赖 vfsl 线）——闭包**精确且完备**，与 SA6 §9.3、设计 §3 完全一致。
4. 版本现值（本会话读 7 个 manifest）：persistence/dsh-persistence/namespace-runtime/namespace-registry=0.4.0、namespace-api=0.3.0、ws-replication/yjs-server=0.5.0，与设计「from」列一致；7 个 `"version"` 行**全部位于 L3**、形状 `  "version": "X.Y.Z",`；全部 16 个 manifest 的 `@deepseek-ai/cordis`=`^4.0.1`、timer=`^1.1.3`（ADR 0035 §4 在 HEAD 完好）。
5. `public-surface.base.json` = 4 键；`cordis-public-surface.test.ts` `ENTRIES` = 4；`git show caede8a --name-only` **不含**这两文件，而 caede8a 正文写「公共 entry 导出名集合由 4 扩到 7」——S3 事实基础成立。**补充关键事实**：#471 `task_issue-471_sa10_spec.md` L78–79 记录「覆盖只有 4/7」缺口、L219–221 记录缺口以「快照 4 + `C.public-surface.@nomicore/{clock,namespace-registry,ws-replication/testing}` 三条 runtime 严格相等断言 = 7/7」闭合，且明示「未修改冻结的 `public-surface.base.json`」——即 #471 的终态是**覆盖 7/7、快照冻结 4**，caede8a 的表述是机制误导而非零交付（影响 S3 修正文案的精确边界，见 §3-S3 条件 c）。
6. `root-test-known-red.json`：`ticket="nomicore-ai/nomicore#471"`、`knownRed=4`、`environmentRed=28`；#471 impl 复查 B-3a…e 五绑定（名级谓词 `failedUnexpected = failedTestNames − 台账`、新文件永不可入账、披露禁令）为本票继承面。
7. `artifacts/local-packages/manifest.json` = 15 键；`scripts/package-catalog.mjs` = 15 包冻结序；`pnpm-lock.yaml` `version: link:` 计 37 处；`.github/workflows/ci.yml:172` = `NOMICORE_VERIFY_REGISTRY_INTEGRITY=0 pnpm publish:verify`（CI 降级语义与 SA6 一致）。
8. `ws-replication` `exports['./testing'] → ./src/testing.ts` 存在；`clock`、`namespace-registry` 根 export 存在；`vitest.config.ts` alias 通配 `@nomicore/<pkg>` 与 `<pkg>/testing`——S3 方案 A 的三个新 entry 均为**既有公共面**，快照扩展只是扩大观测面。
9. SA6 证据在盘复核：`.cache/sa6-472/{publish-verify-head.log, gates-release-probe.log, release-candidate-probe.json, audit-*.json}` 均存在；`gates-release-probe.log` 尾部确认 RC 树 G1′/G3/G6 红 + 其余 9 gate 绿 + `3/12 gate(s) failed`；`matrix.json` = 41 cells / 0 非 pass / `generatedAt=2026-11-14T22:24:17.171Z`。
10. GitHub 实况（本会话 `gh api` 只读）：#472 comments=`[]`；**#468 state=open 且 body 末尾 `## Parent` = `PR #469（spec/468-cordis-rc12-root）`**；#464/#465/#466 全部 `closed`；PR #469 OPEN（head `spec/468-cordis-rc12-root`）。#468 正文 Implementation Decisions 含「Target Nomicore `0.5.0`」「Keep Cordis `^4.0.1` and Timer `^1.1.3` ranges unchanged」——同时支撑 S2 的版本语义读法与 AC5。
11. 设施目录恰 8 文件：FACILITY_ALLOW 4 + 冻结零 diff 4（acquire.mjs / root-probe.mjs / provenance-b3.json / public-surface.base.json）——设计 §7.5 的 G12 delta（+public-surface.base.json → 5 文件闭集、3 文件零 diff）与目录现状精确对账。

## 3. Decision analysis（含 S1–S4 逐项裁定）

| # | 决策/条款 | Subject behavior（设计行为） | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| 1 | ADR 0035 §1（基线固定） | `baselines.json`/`acquire.mjs`/`provenance-b3.json` 零 diff；矩阵仍 41 cells；不扩基线 | no-conflict | baselines.json `dshCommit=1511a6e…`、suites 12 项（本会话读）；设计 §7「不动 acquire/root-probe/provenance-b3/baselines.json」 | 无 |
| 2 | ADR 0035 §4（依赖范围/归属/公共契约不变） | release diff 仅 7 个 `"version"` 行；`dependencies`/`peerDependencies` 逐字节不变由 G13.a 深度相等钉死；G2/G4 保 src/index 零 diff | implements-existing-decision | §2-4 全 manifest range 复核；设计 §6.1/§7.3.a/§14 | 无（实现后按 G13 实跑核） |
| 3 | ADR 0035 §5（验收绑定精确工件/通道；「生产包构建与发布检查**保持既有门禁**」） | `scripts/**` 零改动（DENY）；`publish:verify` 必须默认模式（禁 `NOMICORE_VERIFY_REGISTRY_INTEGRITY=0`）；G13 是**新增**审计而非既有发布门禁的弱化 | no-conflict | ci.yml:172 现状；设计 §10/§11.5/§14 DENY（scripts/**、.github/workflows/**） | 无 |
| 4 | ADR 0035 §6（排除 Host 侧实施） | 非目标 + 停手 3 + A7 三处同义声明 + 命令白名单 | no-conflict | 设计 §1/§9.2/§12/§15 | 无 |
| 5 | ADR 0023（冻结服务面，经 #470 R8/#471 扩展） | 服务名断言走 guard-proxy suite；本票零生产 diff | no-conflict | 设计 §4/§16 A4-4⑥；G2 零 diff | 无 |
| 6 | INSTALL.md release 流程 + 4 个既有 `chore(release)` 批次 | 闭包 bump、bump 先于 manifest 重建、版本与 manifest 同一提交、真实 publish 留给 maintainer（D-7）、无 CHANGELOG 新造 | implements-existing-decision | §2 release 批次 stat 复核（`2 +-`/包、manifest 2 行/包）；INSTALL L199–L205 publish 前置条件 | 无 |
| 7 | #470 R7 + #471 S5（既有 gate 契约：G1′/G3 零 diff、BASE、快照内容不变） | **S1**：BASE 重钉 `6be891a`；G1′/G3 改文件集 allowlist；新增两态 G13；G6/G2/G4/G5/G7–G12 语义不变 | **evolution-required（票级，方案完整）→ 本报告追认：ratified-with-conditions** | 见 §3-S1 专项 | 按 §8 钉值发布 + 实现后复查 |
| 8 | #471 终态（快照冻结 4 + 覆盖 7/7 runtime 断言）与 caede8a 记录 | **S3**：方案 A 补 7-entry 快照 + G12 +1 + 记录修正 | **evolution-required（票级，方案完整）→ ratified-with-conditions** | 见 §3-S3 专项 | 按 §8 条件（含修正文案精确化） |
| 9 | #470/#471 root-test 台账裁定（B-3a…e） | **S4**：台账逐字节冻结（G13-d）+ 只披露 + N-9 禁扩账 + 计数如实记录 | implements-existing-decision → ratified | 见 §3-S4 专项 | 无（沿用） |
| 10 | 版本语义（S2） | 7 包闭包 / 其余 8 包与根 manifest 不动 / 无 CHANGELOG | no-conflict（对既有流程）→ ratified | 见 §3-S2 专项 | 保留升级触发器 |
| 11 | AC6/AC8 边界（#468/#464–#466） | #468 保持 open + Parent=PR #469 不变 + 只追加评论；#464–#466 保持撤回、证据隔离 | no-conflict | §2-10 GitHub 实况与设计基线一致；设计 §9.3/§12.6/§14 | 无 |
| 12 | 停手条件覆盖（ADR §4/§6 + 既有裁定冲突面） | §12 八条 + 风险表 | no-conflict（覆盖充分，附一处归位说明） | 见 §3-停手专项 | 见 §8 条件 8 |

### 3-S1 专项 — gate 语义演进：**ratified-with-conditions**（合法演进，非静默放宽）

**Allowlist 是否精确**：是。G1′ pathspec 不变（17 manifest + lock + artifacts），allowlist 恰 8 文件 = 7 个目标 `package.json` + `artifacts/local-packages/manifest.json`（§2-2/§2-3 逐一对账：7 包名/路径与闭包推导、L3 版本行、15 键 manifest 全部吻合）；根 `package.json`、其余 8 包、`domains/vfs3-assets/package.json`、`pnpm-lock.yaml`、`artifacts/**` 其余 tracked 历史件（如 `issue424-*.log`）**保持零 diff 语义**——这是把「全量零 diff」精化为「白名单 + 白名单内形状钉死」，语义面收窄而非放宽。G3 tracked 判定由零 diff 改为 `⊆ {packages/ws-replication/package.json}`，同受 G13.a 逐行钉死。

**两态是否穷尽**：对 release 批次审计目标是穷尽的。absent（15 publishable version == BASE ∧ manifest 逐字节同 ∧ 台账逐字节同）与 exact（a–e 五款全钉）之外的一切形状（部分 bump、第 8 包 bump、依赖字段改动、manifest 陈旧/多余键、台账漂移、catalog 漂移、bump 未再生 manifest）均红；F-A…F-E 负控恰把这些中间态一一证伪。G6 零改动补上位序维度（exact 形状 + artifacts 未提交 ⇒ G6 红），两 gate 互补闭合「半 release 无合法态」。

**是否存在「为转绿而放松 fail-closed」的实质**：无。三点：① 无模式开关（D-3 明确拒绝 `--release-mode`，任何开关都是 fail-open 面）；② 白名单内不是「放行」而是**换更严的执法**——原 G1′ 对这 8 文件的义务是零 diff，现在版本行必须精确命中 `from→to` 表、深度相等（唯一例外 version）、文本 diff 恰 1 删 1 增，manifest 逐键交叉核对，比「不许动」更强的可审计性；③ 其余 9 gate 语义逐项不动（G5 仅文案/entry 数、G12 仅 +1 且闭集纪律不弱化）。与 SA6 §18.2-S1、§15.2.1 的处方一致。

**与既有裁定的关系（override 记账）**：#470 R7(d)「gate #1（manifest/lock/artifacts）原样保留」与 #471 已批准的 G1′/G3 零 diff 契约被本票**票级取代**。合法性路径：#470 SA8 自己把 R2 类义务显式自限为「**本票**允许改动面」，#471 SA8 已按同一机制扩展过 R2/R7（「本票扩展（追认见 S2/S5）」）——票级验收契约的演进以「后票 SA8 追认 + Controller dispatch 授权」为既定机制；本 dispatch 明示「S1–S4 要求 SA8/owner 追认」。本报告即该追认。**不触碰 ADR 0035 任何条款**（设计 §18.4 同判，本会话逐条核对成立）。

**条件**（并入 §8 钉值）：见 §8-PV-1…PV-6，特别是 manifest diff 行数的 numstat 口径钉死（设计「恰 7 行增删」按字面不可判定，须钉为 7 删 + 7 增 = 7 个变更键）。

### 3-S2 专项 — 0.5.0 版本语义：**ratified**（无需 owner 事前确认即可推进）

- 闭包正确性：§2-3 第一手复算，7 包闭包精确完备（packed `workspace:*` 重写为依赖方当前精确版本，`create-publish-manifest.mjs` L25–L40 实读；303666d 先例正是 persistence 批次 = 7 包闭包 bump）。
- 目标版本合法：全部严格大于已发布版本；persistence 0.4.0→0.5.0（append-only seam，无破坏性公共面变化 ⇒ minor，与 303666d/19df983 的 minor 惯例一致）；ws-replication/yjs-server 已在 0.5.0 且内容变化 ⇒ ≥0.6.0；namespace-api 0.3.0→0.4.0 沿 303666d/19df983 的「闭包联动 minor」惯例。
- 与 ADR 0035 §4 无冲突：只动 `version` 行，range/peer/归属零变化（§2-4）。
- 是否需要 owner 另行确认：**不需要作为推进前置**。Issue AC4 自身措辞是「**按既有流程**完成 Nomicore `0.5.0` 的版本与变更记录」——owner 起草的验收文本已经选定既有流程（闭包 bump、`chore(release)` 正文、无 CHANGELOG；仓库亦无 CHANGELOG 或根版本约定可循，SA6 §10.1b 同判）；#468 正文「Target Nomicore `0.5.0`」与「batch/release 身份」读法一致（0.5.0 锚 persistence headline，release 提交标题明载）。**升级触发器保留**：owner 任何评论要求 15 包统一 minor / 新增 `CHANGELOG.md` / 根版本号 ⇒ 停手升级（设计 §12.4 已列，本报告追认为硬条件）。

### 3-S3 专项 — 4→7 public entry 快照与 #471 记录修正：**ratified-with-conditions**（方案 A）

- **是否越界改写既有工件/规范面**：否。① 三个新 entry（`@nomicore/ws-replication/testing`、`@nomicore/clock`、`@nomicore/namespace-registry`）全部是**既有公共导出面**（§2-8 exports 实读）——快照 4→7 只是扩大观测面，不改任何公共 API；G4（`src/index.ts` 零 diff）与 G2 不动，ADR 0035 §4「公共 API 不变」反而被更强地证明。② #470 R7(c) 的快照机制本就写成可扩展形态（「公共面快照**增加** `@nomicore/ws-replication` entry（或以 (b) 等价承载）」）；#471 终审选择不动快照是以 3 条 runtime 断言等价承载（SA10 L219–221），**没有形成「快照永久必须是 4」的决策**——「快照内容不变」是 #471 S5 重钉的*前提事实核验*，不是永久冻结义务。③ 对 #471 已批准的 G12 4 文件闭集与「public-surface.base.json 零 diff」终态，本票以 **G12 精确 +1 + 理由成文**的方式取代——这正是 SA6 §10.2 预设的机制（「若改快照，G12 allowlist 需同步调整……必须与 S1/S3 一起由 SA8 追认」），闭集纪律本身不弱化（5 文件闭集，目录内任何新文件仍红）。
- **是否必须改写历史 wiki 工件**：**不需要，且不得改写**。git 历史（caede8a）不可重写；`wiki/raw/` 历史工件是证据不是规范契约（docs/AGENTS.md authority 条）；修正只能以**新增文本**出现在本票 release 提交正文/回填/SA10 产物中。设计 §8 的落点（release 记录显式修正）正确，方案 B 的「文件范围互斥」表述也正确。
- **成文边界是否被准确表述**：基本准确（「不得沿用错误声明，也不得把 #472 的落地写成 #471 已完成」），但需一处精确化（条件 c）：caede8a 的「由 4 扩到 7」在**快照/测试文件层面**未发生、在**覆盖层面**由 3 条 runtime 断言实现（SA10 记录 7/7）。修正文案必须两分表述，不得写成「#471 未发生任何公共面扩展」——否则修正本身成为新的不准确记录（同样违反 A4-5「记录与事实一致」）。

**条件**：见 §8 条件 1–4（同一 C1 提交三文件一致变更；捕获失败停手重议方案 B、禁静默 4-entry 降级；修正文案两分；新 entry 集合与 SA10 `C.public-surface.*` 集合一致）。

### 3-S4 专项 — root-test 32 红披露：**ratified**（沿用并加钉）

- 台账冻结由「名集纪律」升级为「G13-d 相对 BASE 逐字节不可变」——严格强于 #470/#471 既有裁定（B-3a…e 只约束集合相等与禁扩，不钉字节）；不得扩、不得缩、不得改 attribution，N-9 负控在案。
- 「按名集判红、计数如实记录」口径**足够**：台账谓词是名级的（`failedUnexpected = failedTestNames − (knownRed ∪ environmentRed)`，#471 impl 复查 B-3b 复算），`numTotalTests` 不参与判定；surface 测试 5→8 个 it 使计数 +3 属**新增通过项**，与名集谓词正交——若新测试失败，其名不在台账 ⇒ `failedUnexpected ≠ []` ⇒ cell 红 ⇒ 停手（设计 §12.7）。环境红在固定 pnpm 10.28.2 后转绿（#471 B-3a 已实证 28→0）则如实记录新 counts；不转绿则按名披露。无「计数变化破坏台账」的缝隙。

### 3-停手专项 — §12 八条覆盖面：**充分**

- ADR 0035 §4 → 条款 1（依赖范围/归属）+ 2（公共 API/schema/wire/服务名/持久化布局）；§6 → 条款 3；既有裁定冲突面 → 条款 5（publish:verify 非确定性红）、6（#468/#464–#466）、7（台账外新红）、8（负控 fail-open）；流程新决策 → 条款 4（S2）。
- 一处归位说明（非缺口）：「G5 新 BASE 重捕失败 → 停并按方案 B 回退重议」位于 §12 风险表而非八条编号内——其处置（停手 + 回 SA8/owner 重议，禁静默降级）本质就是升级路径，本报告将其追认为等效停手条件（§8 条件 5）。
- **是否有应升级 owner 而非就地裁决的项**：实现期前无。S1/S3 的票级追认已由本报告完成；S2 按 Issue 自措辞推进（触发器保留）；S4 沿用。唯一新增的 owner 通知义务是**知会性**（非阻塞）：AC6 回填时向 owner 披露 S2 版本矩阵读法与 S3 方案 A 选择，便于 owner 在合并前行使否决（改方案 B 或要求统一 minor ⇒ 触发停手条件 4）。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| #470 SA8 R7(d)「gate #1（manifest/lock/artifacts）原样保留」+ R7(a)/(c) 的票内 allowlist 形态；#471 SA8 已批准的 G1′/G3 零 diff 与 BASE `d59a4d1` 契约（含 S5「快照内容不变」前提） | 本 dispatch 授权的票级 supersession 追认（SA8）；机制先例 = #470 R2 的「票级自限」+ #471 SA8 对 R2/R7 的后票扩展追认 | 仅 #472 的 release 验收面：BASE 重钉 `6be891a`；G1′/G3 文件集 allowlist；新增 G13 两态审计；G12 闭集 4→5；快照 4→7（方案 A） | §8 发布的全部 pinned value；G2/G4/G5(语义)/G6/G7–G12 义务不减；台账/catalog 逐字节钉死；下个 release 票须重钉 RELEASE_BATCH |
| #471 终态「快照冻结 4-entry + 3 条 runtime 断言等价承载」（SA10 记录，非 ADR） | 同上（SA8 追认 + SA6 §10.2 预设机制） | 仅公共面快照的观测面：`PUBLIC_ENTRIES` 4→7、快照重捕、surface 测试 ENTRIES 4→7 | 三文件同一提交一致变更；G12 +1；release 记录两分修正 #471 声明；公共 API 本身零变化（G4 钉死） |

**无 ADR 级 override**：ADR 0035 §1/§4/§5/§6、ADR 0023、CONTEXT.md、`docs/protocols/**` 全部原样有效，本票零修订需求。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| 三基线定义与 integrity 钉值 | `baselines.json`（base 文档字段、dshCommit、integrity、suites）逐字节 | G12 零 diff + 设计 §7.1 明示不改 | 设计承诺零 diff（实现待核） |
| Cordis/Timer 依赖范围与归属 | 全 16 manifest `^4.0.1`/`^1.1.3`；无新 peer/patchedDependencies | §2-4 本会话复核 HEAD 现值 | 设计 §6.1/G13.a 钉死（实现待核） |
| 公共 API / schema / wire / 服务名 / 持久化布局 | `packages/**/src/**`、`apps/**/src/**`、`domains/**`、`docs/protocols/**` 相对 `6be891a` 零 diff；`src/index.ts` 零 diff（G2/G4/G7）；`generate --check` | §2-1 19df983..HEAD 仅两 seam 且已并入 base | 设计非目标 + DENY（实现待核） |
| 发布流水线 | `scripts/**`（catalog/build/verify/reproducible/create-publish-manifest/publish-*）零 diff；`publish:verify` 默认模式 | §14 DENY；ci.yml:172 现状保留 | 设计 D-4/D-7 承诺（实现待核） |
| pnpm-lock.yaml / 根 manifest / 8 非闭包 manifest | 逐字节不变 | G1′ 白名单外零 diff + G13.b | 设计 §6.2.3 判据（实现待核） |
| root-test 台账 | `root-test-known-red.json` 相对 BASE 逐字节（4+28、attribution） | G13-d + N-9；§2-6 现值 | 设计承诺（实现待核） |
| 设施闭集 | G12 = 5 文件闭集（baselines.json/run-baseline.mjs/gates.mjs/root-test-known-red.json/public-surface.base.json）；acquire/root-probe/provenance-b3 零 diff；目录内任何新文件红 | §2-11 目录对账；#471 G12 纪律继承 | 设计 §7.5 精确 +1（实现待核） |
| #468/#464–#466 GitHub 状态 | #468 open + Parent=PR #469；#464–#466 closed + 撤回评论；仅追加评论 | §2-10 本会话实况 | 设计 §9.3/§12.6（回填期待核） |
| 历史 artifacts 与 wiki 工件 | `artifacts/**`（除 manifest）与既有 `wiki/raw/**` 不改写；caede8a 等 git 历史不重写 | G1′/G6；docs/AGENTS.md「wiki/raw 是证据非规范」 | 设计 §8 修正仅新增文本（实现待核） |

## 6. Evolution requirements

- **ADR/CONTEXT/协议层：无演进需求**。S1–S4 全部落在票级验收设施与 release 工件层；ADR 0035 各条款被原样兑现而非修改。
- **票级演进（本报告追认）**：S1（gate 语义）与 S3（快照面）为完整修订计划——修订文件（§14 ALLOW 逐文件）、新旧语义（§7.2/§7.3/§8）、兼容与迁移（absent/exact 两态使设施提交与 release 提交各自 gate 自洽；快照三文件同提交一致变更）、失败语义（任何其他形状红；捕获失败响亮退出）、验证（F-A…F-E、N-6…N-9 负控 + final verification 在 `R` 重跑）、保持不变的冻结面（§5 表）。计划完整 ⇒ 可放行，实现后必须复查（§10）。

## 7. Hard conflicts

**无。** 全部对照项为 no-conflict / implements-existing-decision / 已追认的票级演进；不存在无合法 override 的硬冲突。

## 8. Required actions — 新发布 pinned value 与交付条件

### 8.1 Pinned values（本追认发布；下个 release 票重钉）

- **PV-1 BASE**：`gates.mjs` `BASE = 6be891a3a0cb32fe21c3a6bf485f33428052ce7b`（`baselines.json` 的 `base` 文档字段保留 `d59a4d1` 作 #470 出处记录，规范 BASE 单源在 gates.mjs）。
- **PV-2 G1′ release allowlist（恰 8 文件）**：`packages/{persistence,dsh-persistence,namespace-runtime,namespace-registry,namespace-api,ws-replication}/package.json` + `apps/yjs-server/package.json` + `artifacts/local-packages/manifest.json`；pathspec 不变（17 manifest + `pnpm-lock.yaml` + `artifacts`），白名单外零 diff。
- **PV-3 七包版本表（RELEASE_BATCH.versions，from→to）**：persistence 0.4.0→0.5.0；dsh-persistence 0.4.0→0.5.0；namespace-runtime 0.4.0→0.5.0；namespace-registry 0.4.0→0.5.0；namespace-api 0.3.0→0.4.0；ws-replication 0.5.0→0.6.0；yjs-server 0.5.0→0.6.0。每文件文本 diff 恰 1 删 1 增（删 `  "version": "<from>",` / 增 `  "version": "<to>",`）∧ JSON 深度相等（唯一例外 version）∧ `version === to`。
- **PV-4 manifest diff 行数口径（消除「恰 7 行」歧义）**：`git diff --numstat 6be891a..R -- artifacts/local-packages/manifest.json` = **7 增 + 7 删**（= 7 个变更键，每键 1 行删 1 行增；先例：19df983 九包 = 18 行）；15 键集合不变；每个非 private workspace 包 filename === `<name 去连字符>-<working version>.tgz`；无旧 filename 残留。
- **PV-5 台账冻结**：`root-test-known-red.json` 相对 BASE 逐字节相同（knownRed=4 + environmentRed=28 + attribution + ticket=#471）；`scripts/package-catalog.mjs` 相对 BASE 逐字节相同。
- **PV-6 gate 数与矩阵**：gate 总数 **13**（G1′–G12 语义除本追认明示项外不变 + 新 G13 两态）；矩阵仍 **41 cells**（gates 为 1 cell 执行 13 gate；SA6 A1-6「12/12 或扩展后的等价 gate 数」满足）；G12 闭集 **5 文件**；G5 比较面 **7 entry**（方案 A）。
- **PV-7 公共面 entry 集（方案 A）**：`PUBLIC_ENTRIES` = `@nomicore/persistence`、`@nomicore/persistence/testing`、`@nomicore/dsh-persistence`、`@nomicore/ws-replication` + 新增 `@nomicore/ws-replication/testing`（→ `packages/ws-replication/src/testing.ts`）、`@nomicore/clock`（→ `packages/clock/src/index.ts`）、`@nomicore/namespace-registry`（→ `packages/namespace-registry/src/index.ts`）——与 #471 SA10 `C.public-surface.*` 断言集一致；快照在新 BASE 重捕为 7 键。

### 8.2 交付条件（ratification conditions；全部为硬约束）

1. **C1 三文件一致**：`gates.mjs`（BASE/PUBLIC_ENTRIES/G1′/G3/G13/G12/G5 文案）、`public-surface.base.json`（7 键重捕）、`cordis-public-surface.test.ts`（ENTRIES 4→7 + 文案）必须在**同一设施提交 C1** 变更；快照重捕在 BASE 重钉之后的 C1 工作树执行。
2. **两态自洽实证**：C1 上 gates 13/13 且 `G13 state=absent`；C2 上 gates 13/13 且 `G13 state=exact` 且 G6 干净；AC 证据只认 exact 态树（SA6 §12.0.1 单树绑定，不允许两态绿互相抵销）。
3. **负控先于绿**：F-A…F-E 在 C1 完成时、N-6…N-9 在 `--audit-evidence` 完成时逐一应红实红并留 log；任何应红实绿 ⇒ 停手（§12.8）。
4. **记录修正两分文案（S3）**：release 正文/回填/SA10 产物统一表述——「#471 提交 `caede8a` 所称『公共 entry 导出名集合由 4 扩到 7』在快照/测试文件层面未发生（树内仍为 4 entry），其覆盖由 #471 以 3 条 runtime 严格相等断言等价承载（SA10 记录 7/7）；7-entry **快照**由 #472 设施提交落地，现快照与记录一致」。不得宣称 #471 已交付 7-entry 快照，也不得宣称 #471 未做任何公共面覆盖扩展；不得改写 caede8a 或任何历史 wiki 工件。
5. **G5 重捕失败处置**：新 BASE 捕获因传递依赖解析失败 ⇒ 停手并回 SA8/owner 重议方案 B；禁止静默降级回 4-entry（本条把设计 §12 风险表该项追认为等效停手条件）。
6. **发布门禁证据纪律**：`publish:verify` 必须默认模式（禁 `NOMICORE_VERIFY_REGISTRY_INTEGRITY=0`）；全部 pnpm 语义固定 10.28.2 并记录 `pnpm --version`；root-test 计数按实际值原样披露、名集判红；不执行 `publish:packages -- --publish`（maintainer 在 `main` 上的动作）。
7. **S2 触发器**：owner 任何评论要求 15 包统一 minor、新增 `CHANGELOG.md`、根版本号语义 ⇒ 停手升级（§12.4）；AC6 回填时**知会性披露**版本矩阵读法与 S3 方案 A 选择（非阻塞，供 owner 行使否决）。
8. **锁定文件范围**：实现/最终验证的全部改动 ⊆ 设计 §14 ALLOW；任何进一步 allowlist 扩张、`scripts/**`/CI/ADR 触碰、台账改动 ⇒ 回本门禁。

## 9. Verdict

**clear** —— 全部对照项为 no-conflict 或 implements-existing-decision；两项票级演进（S1 gate 语义、S3 快照面）方案完整并经本报告追认（S1、S3 = **ratified-with-conditions**；S2 = **ratified**；S4 = **ratified/沿用**）；无 hard-conflict、无 ADR 修订需求、无待批 owner override。设计可进入实现，前提是逐条吸收 §8 钉值与交付条件。

## 10. requiresConflictRecheck

**true** —— 理由：(a) S1/S3 的票级 supersession 尚待实现核对：`gates.mjs` 实际 diff 是否精确等于追认形状（BASE/8 文件 allowlist/G13 两态/G12 5 文件/G5 7 entry）、快照重捕是否恰 7 键、G13 各钉值（PV-3/PV-4/PV-5）是否逐字落地，须在实现后复查；(b) 失败语义面新增（G13 absent/exact 判定、证据审计七检查）需以 F-A…F-E/N-6…N-9 应红实红实证；(c) release 工件（C2 提交、manifest、记录修正文案）与 AC6 回填边界需终验核对。纯 no-conflict 面无需复查。

---

# §11 rev1 复查增补（round 1，conflict-gate iteration 1）——当前轮裁定

- Reviewed subject：**design**（`wiki/raw/task_issue-472_design.md` **rev1**，538 行，iteration 1 定向修订：§4.1/§4.2 逐字吸收本报告 PV-1…PV-7 与 §8.2 八条；§7.3.f/g、§7.4、§10 为吸收 SA2 reject 后的增补）
- 输入：rev1 设计 / `task_issue-472_sa2_review.md`（round 1 iter-0，verdict=reject，§15 明确授权把「`baselines.json` 逐字节钉死」与「全树变更集 ⊆ ALLOW」并入 G13 钉值后由本报告发布）/ 本报告 §1–§10（iteration-0 历史裁定）。
- **决策集不变性**：本会话复核 `git rev-parse HEAD` = `6be891a3a0cb32fe21c3a6bf485f33428052ce7b`（与 iteration-0 复查同一 commit），`git status --porcelain` 仅 6 个 untracked wiki 工件 ⇒ ADR 0035、CONTEXT.md、`docs/protocols/**`、模块 AGENTS 与 iteration-0 第一手核验时**逐位相同**——冲突基准零漂移，§1 决策集认定继续有效，本轮不重复摘录。

## 11.1 第一手复核（本会话实测；SA2 三项更正请求的证据基础）

| 声称（SA2 / rev1 设计） | 本会话复核结果 |
|---|---|
| `gates.mjs` L41 `BASE='d59a4d1…'`、L44–49 `PUBLIC_ENTRIES`=4、L52–57 `WS_ALLOW_NEW_FILES`=4 | ✅ 属实（现状即待重钉/待扩展面） |
| **L59–L65 `FACILITY_ALLOW` 含 `baselines.json`**，L59 注释明示「only these four facility files may differ from BASE」 | ✅ **G12 名义上允许 `baselines.json` diff**——本报告 §5 第 1 行「G12 零 diff」归因失实（勘误 E-1） |
| L1116 G1′ = `assertNoChange(… ['pnpm-lock.yaml', ...listManifests(), 'artifacts'])`；**L1119–L1123 G2 pathspec 恰 3 个 src 树**（persistence/dsh-persistence/namespace-registry）；**L1128–L1131 G4 恰 2 个 entry 文件**；L1135 G7 仅 `docs` | ✅ 属实——本报告 §5 第 3 行「（G2/G4/G7）」作为公共 API 冻结执行面的覆盖归因失实：11 包 `src/**`、非 facility 测试、`scripts/**`、`.github/**` 在既有 12 gate 任何 pathspec 之外（勘误 E-2） |
| `run-baseline.mjs`：`writeEvidence` 以 `<suite>.json` 落盘（L545–L550）；gates cell `provenanceDigestFor('B3')` + summary `slice(-12)`（L881/L885）；root-test cell `provenanceDigestFor('B1')`（L992） | ✅ 属实（rev1 §7.4 审计形态与实盘对齐、D-10 去截断的证据基础成立） |
| `.gitignore` L4 `.worktrees/`、L18 `.cache/`；porcelain 恰 6 个 `wiki/raw/task_issue-472*.md` untracked | ✅ PV-8a 的 untracked ⊆ `wiki/**` 在现盘可达，无噪声面 |

**结论：SA2 §15.5 三项更正请求全部属实**（勘误见 §12）；SA2 §11/§13 对 gate 执法面边界的逐行指控与本会话实读一致。

## 11.2 越界核对（dispatch 项 1）：rev1 增补是否仍在 iteration-0 追认面内

| rev1 增补 | 追认依据 | 裁定 |
|---|---|---|
| §7.3.g 全树变更集绑定（→ PV-8a） | S1 追认面（G13 新 gate 票级演进）+ SA2 §15.1 明示「属收紧，随 S1 已追认面一并实现，无需新裁决，并入 PV 清单后由 SA8 发布」 | **在面内**（收紧：旧语义下该面无任何机械执法——E-2 勘误正是该缺口的归因失实） |
| §7.3.f `baselines.json` 逐字节（→ PV-8b） | 本报告 §5 第 1 行 iteration-0 即钉「`baselines.json` 逐字节」为冻结面（义务本就成立，仅归因错）；SA2 §15.1 授权并入 | **在面内**——执行面从（错误归因的）G12 移至 G13.f + acquire N-5，义务无变化、无弱化 |
| D-9 `FACILITY_ALLOW` 保持 5 文件、`baselines.json` 转死条目 | PV-6 原样保持（组成不变）；替代案（从闭集移除）才需要改 PV-6 的已钉组成 | **在面内且为保守选项**（避免二次改动 #471 已批准闭集组成；追认） |
| §10 F-F…F-J、N-6b/N-7b | 交付条件 3 负控义务的扩充（验证义务，非决策面变化） | **在面内**；条件 3 随之重述（§11.4） |
| §7.4 审计精确化（六类允许清单、三类 digest 期望、logPath 三判、marker `tree` 升校验、mtime 威胁模型、龄窗口不采纳） | iteration-0 已追认 D-4（审计落 `run-baseline.mjs`）演进计划；细化均为钉死实盘现状或收紧；「任何扩类回 SA8 追认」正确保留 | **在面内**；龄窗口系 SA2 浮动的可选加固、从未被追认，不采纳不构成冲突（升级路径「随新票裁决」已成文） |
| D-10 gates cell summary 去截断 / SA2-6 C3 = `wiki/raw/task_issue-472*.md` glob 全集 / SA2-9 base 串四处分工 / SA2-10 `RELEASE_BATCH.base` 引用 `BASE` 常量 / §16 `matrix.json` 增 `runHead/runTree`（additive） | 均在 iteration-0 §14 ALLOW 信封内的设施文件行为 + 条件 8 的动态 ALLOW 引用 + #470/#471 `docs(wiki)` 惯例 + PV-1 单源原则 | **在面内**（枚举性澄清而非范围扩张：C3 glob 只含本票前缀产物，「既有 `wiki/raw/**` 历史不改写、只新增」承诺不变） |

**结论：无越界。** 两项新钉（PV-8a/8b）均为 SA2 §15.1 预授权、由本节 §11.3 履行发布程序——不构成新的票级决策面；不触碰 ADR 0035 §1/§4/§5/§6、CONTEXT.md、`docs/protocols/**` 任何条款（PV-8a 反而把 `docs/adr|protocols`、`scripts/**`、`.github/**`、11 包 src 树首次纳入机械执法面）。**无需升级 owner**：S2 升级触发器与 AC6 知会性披露原样保留（条件 7），PV-8a/8b 不引入任何 owner 决策面。

**C1 四文件澄清**：iteration-0 条件 1 的「三文件一致」是对快照耦合三元组（`gates.mjs`/`public-surface.base.json`/`cordis-public-surface.test.ts`）的**一致性约束**，不是 C1 的排他文件枚举；`run-baseline.mjs` 的审计扩展在 iteration-0 设计 D-4/§14 ALLOW 已入追认信封。rev1 C1 = 4 设施文件（PV-8a 的 tracked 第一分量）与条件 1 相容——三元组仍在同一提交内一致变更。

## 11.3 更新后的钉值清单（dispatch 项 2：PV-8a / PV-8b 发布；下个 release 票重钉）

### 新发布

- **PV-8a 全树变更集绑定（G13 两态各增 g 款；SA2 §15.1 授权，随 S1 追认面发布）**：
  - **tracked**：`git diff --name-only BASE` 的变更集 ⊆ **exact 允许集** = {C1 的 4 个设施文件：`packages/persistence/test/fixtures/cordis-baselines/{gates.mjs, run-baseline.mjs, public-surface.base.json}` + `packages/persistence/test/cordis-public-surface.test.ts`} ∪ {PV-2 的 8 个 release 文件（7 个 `package.json` + `artifacts/local-packages/manifest.json`）} ∪ {`wiki/raw/task_issue-472*.md`（C3 docs-only 面，glob 按 basename 匹配）}；**absent 允许集** = 上述集合**去掉 8 个 release 文件**；
  - **untracked**：`git status --porcelain` 的项 ⊆ `wiki/**`（`.cache/`、`.worktrees/` 已 gitignored，天然无噪声）；
  - 删除/改名计入变更集 ⇒ 红（覆盖 T-7）；越界任何一项即红并指名文件；**g 款为 G13 子句，gate 数不因此变化**。
  - 口径注记：dispatch 转述把 tracked 第三分量写作 `wiki/**`；以设计 §7.3.g 的**更紧口径**（`wiki/raw/task_issue-472*.md`）为准——tracked 的 wiki 面只容本票前缀产物，`wiki/**` 仅适用于 untracked。
- **PV-8b `baselines.json` 逐字节冻结（G13 两态各增 f 款）**：`baselines.json` 与 BASE **逐字节相同**（含 `base` 文档字段 `d59a4d1`、B1/B2 integrity、B3 dshCommit、suites 12 项——三基线工件身份的唯一定义源随批次钉死）；执行面 = **G13.f + `acquire.mjs` integrity 复核（N-5）**；G12 的 `FACILITY_ALLOW` 名义项自此为**死条目**。

### PV-1…PV-7 处置（是否需重钉）

- **PV-1 / PV-2 / PV-3 / PV-4 / PV-5 / PV-7：不需要重钉。** rev1 §4.1/§6.2/§7.2–§7.3/§8 逐字吸收，语义零变化，原钉继续有效（PV-4 numstat 口径与 PV-7 entry 集经 rev1 §6.2/§8 逐字回写确认）。
- **PV-6：原值不变，增补注记（非重钉）。** gate 总数仍 **13**（G1′–G12 语义除追认明示项外不变 + G13 两态；**f/g 款为 G13 子句，不是新 gate**，gate 数不因增款漂移）；矩阵仍 **41 cells**（gates 仍 1 cell）；G12 闭集仍**恰 5 文件**（组成不变，D-9）。**注记**：其中 `baselines.json` 名义项自本票起为**死条目**（BASE 重钉后 C1/C2 对它均无合法 diff 需求）——其批次级冻结的实际执行面是 **G13.f（PV-8b）+ acquire N-5**，不是「G12 零 diff」；G12 detail 文案须随实现更正（「acquire/root-probe/provenance-b3 zero-diff；baselines.json 的批次冻结由 G13 执行」）。G5 比较面仍 **7 entry**（方案 A）。

## 11.4 交付条件增量（dispatch 项 4）

- **条件 1–2、4–8：rev1 下原样成立。** 条件 4 两分文案已逐字回写（rev1 §4.2-4/§8/§9.2，iteration-0 单一修正口径作废）；PV-4 numstat 口径已回写（§6.2/§7.3.c）；条件 1 的「三文件」按 §11.2 澄清为一致性子集（C1 全集 = 4 文件，相容）。
- **条件 3（重述）**：负控面 = **F-A…F-J + N-5…N-9（含 N-6b/N-7b）**，以设计 rev1 §10 表为**唯一权威口径**；时机按 §10（F-A…F-F、F-H…F-J 于 C1 完成时；F-G 于 C2 形成后——absent 分支的首次红灯实证；N 系于 `--audit-evidence` 完成时）；任何应红实绿 ⇒ 停手。
- **条件 9（新增：审计相容性与全量 summary）**：HEAD 干净树重跑 `--all --matrix`，内置审计 **exit 0 且 problems=[]**（SA2-1 相容判据：干净矩阵零假红）；gates cell summary **保留全部 `[gates]` 行**（13 gate = 14 行，`slice(-12)` 截断已去除，D-10）——终验不得假设截断。
- **条件 10（新增：勘误不依赖）**：终验与实现后复查**不得依赖**本报告 §12 所列三处已更正表述；`baselines.json` 冻结按 **G13.f + N-5** 核、公共 API 冻结按 **G13.g + G2/G4 + 终验步骤 8** 核、负控覆盖按 **rev1 §10 表**核。
- **S1/S3 是否可入实现：可以。** 设计层条件已闭合——钉值集（PV-1…PV-8b）随本轮发布完毕、条件 3/9/10 增补完毕、两分文案与 numstat 口径已逐字吸收、SA2 四条 MAJOR 的修订均在面内闭合；剩余全部为实现/终验的**执行核对项**，无未满足的设计层条件。

## 11.5 Decision analysis（rev1 增量面；其余对照项沿用 §3，不受 rev1 影响）

| 决策/条款 | Subject behavior（rev1） | Classification | Evidence | Required action |
|---|---|---|---|---|
| ADR 0035 §1/§4/§5/§6 | rev1 零新增 ADR 面触碰；PV-8a 把 `docs/adr|protocols`、`scripts/**`、`.github/**`、11 包 src 树首次纳入机械执法面 | no-conflict | §11.1 pathspec 逐行实读 + rev1 §7.3.g/§14 | 实现后按 PV-8a 核 |
| #470 R7 / #471 gate 契约（S1 面） | PV-8a/8b 并入 G13 钉值 | implements-existing-decision（追认面内的收紧落实，SA2 §15.1 预授权） | §11.2 表 1/2 行 | 实现后复查（§11.7） |
| #471 快照终态（S3 面） | 方案 A 落点与三文件耦合零变化 | no-conflict（相对 iteration-0 追认） | rev1 §4.2 逐字吸收 | 实现后复查 |
| 本报告 §5 两处归因 / §3-S1 覆盖声明 | rev1 按实码更正（§7.3.f/§7.3.g/§10/§14/§15） | no-conflict（对决策集）+ 触发本报告勘误义务 | §11.1 | §12 勘误 + 条件 10 |
| 证据审计允许清单（票级钉值） | 六类允许集 + `fault-*/` 递归纪律；「任何扩类回 SA8 追认」 | no-conflict（钉死实盘现状，收紧） | rev1 §7.4 检查 7 + 本会话 `writeEvidence` 实读 | 扩类时回本门禁 |

## 11.6 Verdict（rev1，当前轮）

**clear** —— rev1 全部增补（§7.3.f/g、§7.4、§10、D-8…D-11、SA2-5…SA2-12 处置）均在 iteration-0 追认面内或为 SA2 §15.1 预授权的收紧落实；**未引入新票级决策、未触碰 ADR 0035/CONTEXT 任何条款、无需 owner 升级**；PV-1…PV-7 保持（PV-6 加注记）+ PV-8a/PV-8b 随 §11.3 发布；交付条件增补为 3′/9/10。S1/S3（ratified-with-conditions）、S2/S4（ratified）状态不变，**可进入实现**。

## 11.7 requiresConflictRecheck（rev1）

**true** —— 实现落地后须核对：(a) `gates.mjs` 实际 diff 精确等于追认形状：`BASE=6be891a`、G1′ 8 文件 allowlist（pathspec 不变）、G13 两态含 a–g 款（f = `baselines.json` 逐字节、g = 全树绑定允许集恰为 PV-8a 三分量）、G12 5 文件闭集 + 死条目文案、G5 7 entry、`RELEASE_BATCH.base` 引用 `BASE` 常量；(b) `run-baseline.mjs`：审计七检查（六类允许清单、三类 digest 期望——gates=B3/root-test=B1 特例、logPath 三判、write-tree 比对）、summary 全量行（14 行无截断）、run-marker；(c) 负控 F-A…F-J / N-5…N-9（含 N-6b/N-7b）应红实红 + HEAD 干净树审计零假红（条件 9）；(d) 快照恰 7 键、三文件同一 C1 提交一致变更；(e) C2 形状（PV-3/PV-4/PV-5/PV-8b）且 `G13 state=exact`、G6 干净；(f) 记录两分文案（条件 4）与 AC6 回填边界（条件 7）；(g) **本报告 §12 勘误生效——终验不得引用被更正的三处表述**（条件 10）。

---

# §12 勘误（Errata）——对 iteration-0 历史文本的三处归因更正

历史裁定文本（§1–§10）不改写、原样保留；以下更正以追加形式生效。三处均为**证据归因/覆盖声明的失实**，不改变任何裁定结论（S1–S4 追认、verdict、PV-1…PV-7、八条交付条件的义务面不变——相关冻结面反被 PV-8a/8b 机械强化）。

| # | 位置 | 原文（失实表述） | 失实点（本会话第一手证据，§11.1） | 更正后表述（权威口径） |
|---|---|---|---|---|
| **E-1** | §5 表第 1 行（三基线定义与 integrity 钉值）Evidence 列 | 「G12 零 diff + 设计 §7.1 明示不改」 | `gates.mjs` L60–L65 `FACILITY_ALLOW` **含 `baselines.json`**，L59 注释「only these four facility files may differ from BASE」——**G12 名义上允许其 diff**，不是其冻结执行者（SA2 §13 SA2-3 同判） | 该冻结面的**义务声明不变**（`baselines.json` 相对 BASE 逐字节，含 base 文档字段/integrity/dshCommit/suites）；机械执行面自 rev1 起为 **G13.f 逐字节钉死（PV-8b）+ `acquire.mjs` integrity 复核（N-5）**。终验不得以「G12 零 diff」作为该面执行依据 |
| **E-2** | §5 表第 3 行（公共 API/schema/wire/服务名/持久化布局） | 「`src/index.ts` 零 diff（G2/G4/G7）」 | G2 pathspec 仅 **3 个 src 树**（L1119–L1123：persistence/dsh-persistence/namespace-registry）、G4 仅 **2 个 entry 文件**（L1128–L1131）、G7 仅 `docs`（L1135）——括注把三 gate 表述为该冻结面的覆盖执行，实际 11 包 `src/**`、非 facility 测试、`scripts/**`、`.github/**` 在既有 12 gate 任何 pathspec 之外（SA2 §13 SA2-2 同判） | 该冻结面的机械执行面自 rev1 起为 **G13.g 全树条款（PV-8a）+ G2（3 树窄面）+ G4（2 entry 文件）+ 终验步骤 8 手工复核（双保险）**；「（G2/G4/G7）」覆盖归因作废 |
| **E-3** | §3-S1 专项「两态是否穷尽」段 | 「F-A…F-E 负控恰把这些中间态一一证伪」 | iteration-0 稿 §10 表**无**部分 bump（7 之 k）、exact 后单文件回退（absent 分支）、审计检查 6（logPath 断链/越界）、检查 7（换名旧工件）四类注入；所列枚举中「catalog 漂移」亦无直接注入——「一一证伪」为过度声明（SA2 §13 SA2-4 同判；rev1 已以 F-F/F-G/N-6b/N-7b 补齐前四类） | 负控覆盖以**设计 rev1 §10 表（F-A…F-J + N-5…N-9 含 N-6b/N-7b）为唯一权威口径**。残余观察（非阻塞）：`scripts/package-catalog.mjs` 直接注入（G13.e 逐字节红分支）在 rev1 §10 表仍缺项——该面已由 G13.e + G13.g（F-I 证明 `scripts/**` 面应红）间接覆盖、终验步骤 8 另有手工字节核对，不构成 reject 事由，但**实现后复查不得宣称「catalog 漂移分支已注入证伪」** |

**效力声明**：终验与实现后复查不得依赖上述三处被更正表述（交付条件 10）；`baselines.json` 冻结、公共 API 冻结、负控覆盖的核对口径以 §12 更正列 + 设计 rev1 §7.3.f/§7.3.g/§10 为准。

---

# §13 rev2 复查增补（round 1，conflict-gate iteration 2）——当前轮裁定

- Reviewed subject：**design**（`wiki/raw/task_issue-472_design.md` **rev2**，562 行，iteration 2 极小定向修订：§7.3.g 原语钉 `--no-renames` + §10 F-K 改名注入 + 全文单一原语纪律注记 + SA8 rev1 增量吸收（条件 3′ 扩 F-K / 条件 9 / 条件 10 / PV-8a 合并表述 / PV-8b 执行面 / PV-6 注记））。
- 输入：rev2 设计 / `task_issue-472_sa2_review.md` iteration 1 复查（verdict=reject，唯一 blocking = **SA2-13**：`git diff --name-only` 默认 rename detection 隐藏旧路径；Controller 已一手复现，实例提交 `27e012b`）/ 本报告 §1–§12（iteration-0/1 历史裁定 + 勘误）。
- **决策集不变性**：本会话复核 `git rev-parse HEAD` = `6be891a3a0cb32fe21c3a6bf485f33428052ce7b`（与 iter-0/iter-1 复查同一 commit），`git status --porcelain` 恰 6 个 `wiki/raw/task_issue-472*.md` untracked（PV-8a untracked 面现盘可达）⇒ ADR 0035、CONTEXT.md、`docs/protocols/**`、模块 AGENTS 与两轮前第一手核验时逐位相同——冲突基准零漂移，§1 决策集认定继续有效。

## 13.1 第一手复核（本会话实测；SA2-13 与条件 9 判据的证据基础）

| 声称（SA2 iter-1 / rev2） | 本会话复核结果 |
|---|---|
| 历史改名提交 `27e012b`（`docs(adr): 改号 0031→0032`）上 `git diff --name-only 27e012b^ 27e012b` **只列新路径** | ✅ 属实：默认输出仅 `CONTEXT.md` 与 `docs/adr/0032-…md`，旧路径 `0031-…` 被吞 |
| `--no-renames` 下**两路径均列**；`--name-status` 呈 M/D/A | ✅ 属实：`--no-renames --name-only` 列 `CONTEXT.md` + `0031-…` + `0032-…`；`--no-renames --name-status` = `M CONTEXT.md` / `D 0031-…` / `A 0032-…`（D/A 各计一条路径） |
| `diff.renames` 未设置（builtin 默认 true） | ✅ 属实（`git config diff.renames` 空） |
| 既有 `changedPaths()`（gates.mjs L134–L142）= `git diff --name-only BASE -- <pathspec>`，pathspec 限定 gate 不受默认 rename 语义影响（pathspec 外 add 候选被滤 ⇒ rename 配对失败 ⇒ 旧路径以 D 呈现） | ✅ 属实（L135 原文核对）；G1′/G2/G4/G12 pathspec 限定面无需改动，与 SA2 §3 同判 |
| `runGatesCell` L885 `slice(-12)`；现盘 gates.json summary 恰 12 行、首行 G2 | ✅ 属实（L885 原文 + 现盘 summary.length=12、summary[0] 为 G2 行） |
| rev2 §7.3.g 原语钉 `git diff --no-renames --name-only BASE`、rename ≡ 旧删 + 新增两条均须在允许集、absent 允许集不含 8 个 release 文件；§10 F-K 注入与 acceptance（指名旧路径 `.github/workflows/ci.yml`、G1′/G2/G4/G12 同绿、干净树 13/13 不回归） | ✅ 与本报告 PV-8a 钉值语义逐字一致（见 §13.2） |
| **新事实（rev2 条件 9 未覆盖，本轮发现）**：`gates.mjs` 的 `[gates]` 前缀 **stdout** 行不止逐 gate 行——G10 sweep 明细 **7 行**（L940 汇总 + L943 类别行 ×6，均 `console.log`）+ 逐 gate 行（L1144）+ 绿态汇总行（L1151）；现盘 12-gate 绿态合计 20 行（7 + 12 + 1）。且**红态汇总行 `[gates] N/M gate(s) failed` 走 stderr**（L1148 `console.error`），L885 的 stdout filter 收不到 | 实测：现盘 `gates/gates.log` `[gates]` 前缀行恰 20（7 行 G10 sweep + 12 行 PASS + 1 行 `all 12 gates passed`）⇒ **「全量 14 行」按字面行数不可直接机判**（naive「去掉 slice」实现下 13-gate 绿态 summary.length = 7+13+1 = **21**；仅当实现同时过滤掉非逐 gate 明细行才是 14）——条件 9 判据需补钉（§13.3） |

## 13.2 PV-8a 原语补钉（dispatch 项 1；钉值语义不变，机械配方修正）

**一致性裁定**：rev2 §4.1 PV-8a 行 / §7.3.g 与本报告 iteration-1 发布的 PV-8a 在**钉值语义**（允许集三分量、absent 去 8 release 文件、untracked ⊆ `wiki/**`、越界红并指名文件、「改名 ⇒ 红」）上**逐字一致**；唯一偏差在**原语表述层**——本报告 §11.3 原文的 tracked 原语写作 `git diff --name-only BASE`，其「删除/改名计入变更集 ⇒ 红」的机制声明在默认 rename detection 下**对改名半句失实**（§13.1 前三行实证，SA2-13 同判）。处置：**以本节重发的 PV-8a 现行版为准**（SA8 为钉值发布方；rev2 的表述与现行版一致，设计无需再改）；§11.3 原文仅存历史、不改写（与 §12 勘误同机制）。本补钉**不扩大**条件 10 的勘误清单（仍恰为 E-1/E-2/E-3 三处）——它是钉值本体的原语精确化，终验核对 PV-8a 时自然按现行版执行。

**PV-8a 全树变更集绑定（现行完整版；iteration 2 重发；下个 release 票重钉）**：

- **tracked 判定原语**：**`git diff --no-renames --name-only BASE`**（BASE = PV-1 `6be891a3a0cb32fe21c3a6bf485f33428052ce7b`；无 pathspec 的全树 diff；等价变体 `git diff --no-renames --name-status BASE` 允许——M/D/A 各按其路径计入，禁 rename 配对；实现不得复用带默认 rename 语义的 `changedPaths()` 变体做本款全树判定）；
- **rename 判定语义**：改名 ≡「**旧路径删除 + 新路径新增**」两条记录，**两条都必须落在允许集内才可绿**；旧路径不在允许集 ⇒ 红并**指名旧路径**（新路径命中允许集 glob 不救）；
- **exact 允许集（`R` 态）** = {C1 的 4 个设施文件：`packages/persistence/test/fixtures/cordis-baselines/{gates.mjs, run-baseline.mjs, public-surface.base.json}` + `packages/persistence/test/cordis-public-surface.test.ts`} ∪ {PV-2 的 8 个 release 文件（7 个 `package.json` + `artifacts/local-packages/manifest.json`）} ∪ {`wiki/raw/task_issue-472*.md`（C3 docs-only 面，glob 按 basename 匹配）}；
- **absent 允许集（C1 态）** = 上述集合**去掉 8 个 release 文件**（不含任何 release 文件）；
- **untracked**：`git status --porcelain` 的 untracked（`??`）项 ⊆ `wiki/**`（`.cache/`、`.worktrees/` 已 gitignored，天然无噪声）；staged 与未 staged 的改名均由 tracked 原语双路径覆盖（`git diff BASE`（无第二 ref）= BASE↔工作树，staged rename 在 `--no-renames` 下仍呈 D+A 两条）；
- 越界任何一项即红并指名文件；**g 款为 G13 子句，gate 数不因此变化**（PV-6 注记）。

## 13.3 条件 9 / 条件 10 的规范可验证性（dispatch 项 2）

**条件 9（审计相容性与全量 summary）——rev2 §4.2-9/§11 步骤 2 已成文，但后半「全量 14 行」偏软，补钉判定口径如下（作为条件 9 的机械判定方式，非新条件）**：

- 前半（零假红）**已可机判**：`--all --matrix` 进程 **exit code === 0** 且落盘审计输出中 **problems 列表为空列表**——判定单位 = exit code + 打印/落盘的 problems 列表，不是自述文本；
- 后半（summary 全量）**不可按字面行数机判**（§13.1 新事实：G10 sweep 明细 7 行走 stdout、红态汇总行走 stderr）。「14」是派生期望值而非判据本体，**补充可观察判据**（设 S = `evidence/gates/gates.json` 的 `summary` 数组）：
  1. **逐 gate 行完备**：∀G ∈ {G1′, G2, …, G13}，S 中恰存在一行以 `[gates] PASS G` / `[gates] FAIL G` 开头——13 行全在，**含 G1′ 行**；现盘「首行 G2 ∧ length=12」的截断形态不得再现；
  2. **绿态汇总行在场**：gates 13/13 时 S 含 `[gates] all 13 gates passed`；红态（负控注入轮）以逐 gate FAIL 行为判定依据——红态汇总行走 stderr 不入 S **不构成缺陷**，也不得因此把红态误判为绿；
  3. **无 magic 截断**：实现不得以任何 `slice(-N)` 常量形态截断（D-10 拒绝 magic 常量的理由随 gate 数漂移自动成立）；
  4. 行数断言降级为**派生检查**：绿态 length = 13（逐 gate）+ 1（汇总）+（若实现保留 G10 等 `[gates]` 前缀 stdout 明细行则计入，现盘形态为 +7）⇒ **14 或 21 均合法**，缺失逐 gate 行或绿态汇总行即红。
- 终验可执行核对：读 gates.json 断言判据 1/2（例：node 逐前缀计数），审计 problems 判定同前半。

**条件 10（勘误不依赖）——rev2 §11「条件 10 依赖禁令」段已把三处禁依赖与三面现行核对口径显式成文，语义可验证；补充正向绑定判据**：

1. **正向绑定（三面各自「现行口径命名 + log 证据」在场为绿）**：终验产物中 `baselines.json` 冻结面的核对证据必须引用 **G13.f 与/或 N-5** 的红/绿 log（`.cache/issue-472-impl/` 等）；公共 API 冻结面必须引用 **G13 行（`--no-renames` 原语）+ 步骤 8 的 `--no-renames` diff 输出 + G2/G4 行**；负控面必须**逐项列出 F-A…F-K + N-5…N-9（含 b 变体）** 的应红实红 log 引用；
2. **负向禁令（判定单位 = 依据句，不是字符串出现）**：被勘误的三处表述不得作为**核对依据句**出现——「G12 零 diff」作为 `baselines.json` 冻结依据、「（G2/G4/G7）」作为公共 API 冻结覆盖归因、「F-A…F-E 一一证伪」作为负控覆盖声明。引用勘误/条件 10 原文本身（如「（非『G12 零 diff』）」）不构成违反；
3. 红态示例：终验写「`baselines.json` 已冻结，依据 G12 零 diff」⇒ 条件 10 红；写「依据 G13.f + N-5（log: …）」⇒ 绿。

**条件增量结论**：无新增条件编号；条件 9 增补上述判定口径（判定方式钉死），条件 3′ 的负控面扩至 F-A…F-K 已由 rev2 §4.2-3 吸收、本报告追认（负控义务扩充，非决策面变化）。

## 13.4 越界核对（dispatch 项 3）：rev2 增补是否仍在追认面内

| rev2 增补 | 追认依据 | 裁定 |
|---|---|---|
| `--no-renames` 原语（§7.3.g / §4.1 PV-8a / §0/§17/§18） | PV-8a 钉值语义（iteration 1 已发布）不变；SA2-13 required change 明示「只是兑现该钉值的机械配方，不构成新决策面」；允许集组成、gate 数、矩阵结构、全部冻结面零变化，纯收紧（闭合默认 rename detection 的 fail-open 洞） | **在 S1 追认面内**（收紧；原语由本报告 §13.2 补钉后与裁定逐字一致） |
| F-K 注入（§10 + 红灯时机 F-H…F-K 于 C1） | 条件 3′ 负控义务的扩充——验证义务，非决策面变化（与 iter-1 §11.2 对 F-F…F-J 的处理同机制） | **在面内**；条件 3′ 随之扩至 F-A…F-K |
| 同款口径注记（§6.2 验证 1、§7.3.a/b/c、PV-4 注记、§11 步骤 8） | PV-4 numstat 钉值**逐字不变**（7 增 + 7 删）；manifest.json 与 7 个 `package.json` 在 BASE 与 `R` 双树俱存、属 modify 型 diff，rename 配对不适用，`--no-renames` 对其为无操作；§7.3.b 的「blob 直比」天然 rename 免疫且「若改用 diff 变体必须带 `--no-renames`」为收紧注记 | **在面内**（防御性统一原语纪律，无任何判定面/钉值变化） |
| absent 允许集显式表述（「不含 8 个 release 文件」） | iteration-1 §11.3 PV-8a 原文已含「absent 允许集 = 上述集合去掉 8 个 release 文件」；rev2 仅抬升为 PV-8a 行内显式标注 | **在面内**（零语义变化） |

**结论：无越界。** 无新票级决策（无新 gate、gate 数/闭集组成/允许集组成均不变、不触碰 ADR 0035 §1/§4/§5/§6、CONTEXT.md、`docs/protocols/**` 任何条款）；**无 owner 升级需求**（S2 升级触发器与 AC6 知会性披露原样保留，PV-8a 原语补钉不引入任何 owner 决策面）。

## 13.5 Decision analysis（rev2 增量面；其余对照项沿用 §3/§11.5，不受 rev2 影响）

| 决策/条款 | Subject behavior（rev2） | Classification | Evidence | Required action |
|---|---|---|---|---|
| ADR 0035 §1/§4/§5/§6 | rev2 零 ADR 面触碰；`--no-renames` 把 `docs/adr|protocols`、`scripts/**`、`.github/**`、11 包 src 树的「改名逃逸」面首次钉死 | no-conflict | §13.1 实测 + rev2 §7.3.g/§14 | 实现后按 PV-8a 现行版核 |
| #470 R7 / #471 gate 契约（S1 面）——PV-8a 原语补钉 | G13.g 原语钉 `--no-renames`，钉值语义「改名 ⇒ 红」不变 | implements-existing-decision（追认面内收紧，SA2-13 处方逐字兑现） | §13.1/§13.2 | 实现后核对原语字面（§13.7a） |
| 条件 3′（负控面） | 扩至 F-A…F-K + N-5…N-9（含 b 变体），时机 F-G=C2 后其余=C1/N 系 | implements-existing-decision（验证义务扩充） | rev2 §10/§4.2-3 | F-K 应红实红 log |
| 条件 9 / 条件 10 | rev2 成文；条件 9 后半行数判据偏软（G10 明细行走 stdout、红态汇总行走 stderr） | no-conflict（对决策集）+ 触发本报告判定口径补钉义务 | §13.1 新事实 | 按 §13.3 判据执行与核对 |
| 本报告 §11.3 PV-8a 机制表述 | 原语短语（`--name-only` 无 flag）对改名半句失实 | no-conflict（对决策集）+ 本轮已补钉（§13.2） | §13.1 前三行 | 终验按 §13.2 现行版执行 |

## 13.6 Verdict（rev2，当前轮）

**clear** —— rev2 全部增补（`--no-renames` 原语、F-K 注入、单一原语纪律注记、absent 允许集显式表述、SA8 rev1 增量吸收）均在 iteration-0/1 追认面内或为纯收紧；PV-8a 原语已由本报告 §13.2 补钉重发（钉值语义不变）；条件 9/10 的判定口径已补齐（§13.3）；**无 hard-conflict、无新票级决策、无 ADR/CONTEXT/协议触碰、无 owner 升级**。S1/S3（ratified-with-conditions）、S2/S4（ratified）状态不变。

## 13.7 requiresConflictRecheck（rev2）

**true** —— 实现落地后须核对（在 iter-1 §11.7 (a)–(g) 全部条目继续有效的基础上，按下述现行口径执行）：

- (a) `gates.mjs` G13.g 的 tracked 原语**字面** = `git diff --no-renames --name-only BASE`（或 `--name-status` 等价变体），无 pathspec、不复用默认 rename 语义的 `changedPaths()` 变体；两态允许集恰为 **PV-8a §13.2 现行版**三分量（absent 态不含 8 个 release 文件）；F-K 注入「应红实红 + 指名旧路径 `.github/workflows/ci.yml`」log 在 `.cache/issue-472-impl/`，G1′/G2/G4/G12 同轮绿，干净 C1/C2 树 13/13 不回归；
- (b) §7.3.b 逐字节以 blob 直比承载（或 diff 变体带 `--no-renames`）；PV-4 numstat 命令携带 `--no-renames` 且钉值 7 增 + 7 删逐字不变；§11 步骤 8 用同款原语；
- (c) 条件 9 按 §13.3 判定口径核对：审计 exit 0 ∧ problems=[]（落盘）；gates.json summary 逐 gate 13 行全在（**含 G1′**）+ 绿态汇总行在场 + 无 `slice(-N)` 截断（行数 14/21 均合法，缺失即红）；
- (d) 条件 10 按 §13.3 正向绑定/负向禁令核对终验产物（三面现行口径命名 + log 证据在场；三处被勘误表述不得作为依据句）；
- (e) 其余按 iter-1 §11.7 (a)(b)(d)(e)(f)（G13 a–f 款钉值、审计七检查、快照 7 键三文件同提交、C2 形状、两分文案与 AC6 边界）逐项不变。

## 13.8 实现就绪结论（dispatch 项 4）

**设计层已可进入实现（SA3）。** SA2 iter-1 唯一 blocking（SA2-13）已在 rev2 闭合（原语钉死 + F-K 注入 + acceptance 判据），SA2 复查明示该修订「不动架构、不动钉值语义、无需重开任何裁决，修订后直接进入实现」；钉值集（PV-1…PV-8b，PV-8a 以 §13.2 现行版为准）与交付条件（1–8 + 3′/9/10，条件 9 判定口径已补钉）完整发布；**无未满足的设计层条件**，剩余全部为实现与终验的执行核对项（§13.7）。
