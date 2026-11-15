# SA8 设计后冲突复查 — issue #472：Cordis rc.12 三基线回归与 Nomicore `0.5.0` 收官（design 复查 + S1–S4 追认）

- Reviewed subject: **design**（`wiki/raw/task_issue-472_design.md`，SA1 iter 0，442 行）
- 复查轮次：round 1，conflict-gate iteration 0（§1–§10 为历史裁定文本，保持原样以保证可追溯性）
- **当前轮裁定（round 1，conflict-gate iteration 3，design rev3 终审 remediation 复查）：verdict = clear，requiresConflictRecheck = true——见文末 §14（iteration 3 复查增补：PV-9 working-tree 指纹钉值发布 + D-11 勘误 E-4 / PV-8a 机械判定补钉与勘误 E-5 / W-2/W-3/W-4 追认 / 条件 3′ 扩面与条件 6 落实口径与条件 9 载体 / C5 message-only 唯一合法路径裁决 / AC6-B-4 职责边界裁决 / 实现就绪结论）**
- 前轮裁定（round 1，conflict-gate iteration 2，design rev2 修订后复查）：verdict = clear，requiresConflictRecheck = true——§13（rev2 复查增补：PV-8a 原语补钉 `--no-renames` / 条件 9 判定口径补钉 / 条件 10 正向绑定判据 / 越界核对 / 实现就绪结论）；除 §14 明示的 PV-8a 机械判定补钉与勘误 E-4/E-5 外，历史裁定全部继续有效
- 前轮裁定（round 1，conflict-gate iteration 1，design rev1 修订后复查）：verdict = clear，requiresConflictRecheck = true——§11（rev1 复查增补：越界核对 / PV-8a+PV-8b 发布 / PV-1…PV-7 处置 / 交付条件增量）与 §12（勘误：iteration-0 三处归因失实的更正，终验不得依赖）
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

---

# §14 iteration 3 复查增补（round 1，conflict-gate iteration 3）——当前轮裁定

- Reviewed subject：**design**（`wiki/raw/task_issue-472_design.md` **rev3**，685 行，iteration 3 = 终审组两组 reject（SA9-1…SA9-5 / B-1…B-4）的定向 remediation：§7.4 W-1/W-3/W-4、§7.3.g W-2、§9.1 C4/C5/C6 时序与 W-7、§10 F-L/F-M/N-8e/N-8f/N-8g/N-10/T-1/T-2、§11.1 W-6 固定 pnpm 复验协议、§9.4 回填证据包与职责边界、§4.2 条件 9 可机判口径）。
- 输入：rev3 设计 / `task_issue-472_sa9_standards.md`（rg-472-final-iter0，verdict=reject，MAJOR 4 + MINOR 1）/ `task_issue-472_sa10_spec.md`（同组，verdict=reject，blocking 4）/ 本报告 §1–§13（iteration-0/1/2 历史裁定 + 勘误 E-1…E-3 + PV-8a 现行版）/ 已交付提交 C1 `1198312`、C2 = R `e3d5881`、C3a `d5cf485`（BASE `6be891a`）。
- **决策集不变性**：本会话复核 `git rev-parse HEAD` = `d5cf4850e317b51df9b50c33f8487d832565f8d6`（= C3a），`git diff --no-renames --name-only 6be891a..HEAD -- docs/adr docs/protocols CONTEXT.md` = **空**（ADR 0035、CONTEXT.md、`docs/protocols/**` 自 BASE 零漂移）；`git diff --no-renames --name-only 6be891a..HEAD` 全集 = 恰 20 文件（4 设施 + 8 release + 8 wiki，与 SA9「已核实通过的标准面」一致）；porcelain = 2 个 tracked 修改（`task_issue-472_design.md` rev3、`task_issue-472_dispatch.md`）+ 2 个 untracked（sa9/sa10 报告）——全部 ⊆ `wiki/raw/task_issue-472*.md` 面。冲突基准零漂移，§1 决策集认定继续有效。

## 14.1 第一手复核（本会话只读实测；八项裁决的事实基础）

| 声称（SA9/SA10/rev3） | 本会话复核结果 |
|---|---|
| **指纹原语失效模式**（SA9-1 证据 1–3） | ✅ **当场复现**：临时 index（`GIT_INDEX_FILE=<tmp>` → `git read-tree HEAD` → `git add -u` → `git write-tree`）产出 `fa2f9292…` ≠ HEAD tree `b898d119…`，差源恰为 2 个未暂存 tracked 修改（design/dispatch）；**真实 index 的 `git write-tree` = `b898d119…` = HEAD tree**——index 干净而 working tree 漂移，旧 marker（`tree: gitOutput(['write-tree'])`，L1074）/旧审计（L1222–L1225 比对 write-tree）在该状态判绿。被测内容来源 = `copyTrackedTree` 逐 `git ls-files` 路径 `fs.copyFileSync`（SA9 引证属实） |
| **树身份**（SA9-1 证据 3 / rev3 自验 ②） | ✅ `git show -s --format='%T'`：BASE `6be891a` → `b41d9e73…`、C1 `1198312` → `da3f368f…`、R `e3d5881` → `bdbdd7a…`、C3a `d5cf485` → `b898d119…`——round 1 C1 矩阵 marker 记 `tree=b41d9e73…`（= BASE tree）而 C1 四文件当时未提交，「单树绑定」未绑定实际被测内容（实际 = `da3f368f…`）属实 |
| **现盘旧字段** | ✅ `run-marker.json` = `{startedAt, head, tree, porcelain}`（旧 `tree`）；`matrix.json` = `runHead`/`runTree`（旧字段名）——W-1 的改名对象在案 |
| **isTicketDoc 放宽**（SA9-3） | ✅ `gates.mjs` L127–L132 现实现 = `posix.startsWith('wiki/')` + basename 正则；注释自称「basename glob under wiki/」——`wiki/task_issue-472_probe.md`、`wiki/other/…`、`wiki/raw/nested/…` 均被 tracked 分量放行，超出 PV-8a 钉值 `wiki/raw/task_issue-472*.md` |
| **printAudit 无 problems 载体**（SA9-4） | ✅ L1390–L1397：成功路径只打印 `EVIDENCE AUDIT PASS (…)`，无 problems 输出；失败逐条 stderr——条件 9「不是自述文本」在成功路径不可机判 |
| **main() 头部 mkdirp 使缺目录 guard 不可达**（SA9-5.3） | ✅ L1465 `mkdirp(EVIDENCE)` 先于 `--audit-evidence` 分支；L1375–L1377 缺目录 guard 因此不可达。而 `writeRunMarker`（L1072）/`writeEvidence`（L563）/`runGatesCell`（L889）/`runRootTestCell`（L922）各自 mkdir 所需目录——删除头部 mkdirp 后无调用路径依赖预创建，rev3 论证成立 |
| **注释失真**（SA9-5.1/5.2） | ✅ `gates.mjs` L5「G1' … zero-diff」、L7「G3 … plugin.ts + the four named fixtures」与 release 语义（白名单 + G13 钉形状）不符；`run-baseline.mjs` L898–L903 注释「13 gates = 14 lines incl. the summary」与现盘 21 行（SA10 §2 AC1 已核）不符 |
| **C2 正文 ⑦/⑩**（B-2） | ✅ `git show -s --format=%B e3d5881`：⑦ 原文「固定 pnpm 10.28.2 下 root-test 实际 counts 按树记录（C1 5959/5991、C2 预验 5987/5991…）」——C1 的 5959/5991 实为未固定 PATH 口径（32 = 4 frozen + 28 environment），混同属实；⑩ 仅含 BASE hash 与「本提交为 release candidate R」，无 R 的 HEAD/tree |
| **既有 release 批次形状** | ✅ `19df983`（11 files）/`3321390`（3）/`303666d`（8）/`abbb89a`（19）全部为带文件变更的 `chore(release)`；git 历史无 message-only `chore(release)` 先例（zero-file 提交全部为 merge）；仓库无 `CHANGELOG.md`（iteration-0 §1 已核，S2 触发器禁新造） |
| **pnpm 固定硬判据**（SA9-2/B-3） | ✅ SA6 契约 L83（「最终 release 验证必须对**所有** pnpm 语义固定 10.28.2，并记录 `pnpm --version`」）、L180（工具链行）、L645（§7「最终验证必须固定 10.28.2 PATH」）——固定是硬判据非记录性偏离；corepack 10.28.2 二进制在盘（`/home/wangjian/.cache/node/corepack/v1/pnpm/10.28.2/bin/pnpm.cjs` 可执行）；W-6 shim 固定法与 SA6 §4.1 记录的临时 PATH shim 同款 |
| **AC6 契约面** | ✅ SA6 §12.6：A6-1（#472 评论，证据 = `gh api …/issues/472/comments` JSON 落盘）、A6-2（集成 PR 回填，证据 = `gh pr view --json`）、A6-3（#468 open + Parent=PR #469，证据 = 前后快照）；通过判定 = 三项**全部满足**；契约未规定执行主体。SA10 B-4 判定明示「由有权限的后续 Controller/Owner 执行……不由本 SA10 执行」 |

## 14.2 逐项裁决（dispatch 项 1–8）

| # | 事项 | 裁决 | 依据（摘要；事实见 §14.1） |
|---|---|---|---|
| 1 | **W-1 内容指纹原语**（`tree`→`worktree`、`runTree`→`runWorktree`、两模式指纹比对、移除 index `write-tree`） | **ratified（已追认面内的收紧，非新决策面）**；发布 **PV-9**（§14.3）；**D-11 归因更正 = 勘误 E-4，非放宽**（§14.4） | ① iteration-1 §11.2 追认的**意图**是「run-marker 内容绑定从 disclosure 升为校验」（D-11、SA2-7/T-4 处置——SA2 评审 T-4 原文「marker 记录 head/tree/porcelain，但**无检查消费 tree**；披露不校验」）；`git write-tree` 是错误配方而非被追认的语义本体——本会话一手复现其失效（index 绑定 ≠ 被测 working-tree 内容，`copyTrackedTree` 逐路径复制）。② 语义面全部收紧或等强：绑定面从 index（错误代理）换到被测内容本体；untracked 天然不入指纹（`add -u` 只更新既有条目，与 PV-8a untracked 分量无冲突）；tracked 删除计入；移除 `tree` 字段消灭第二「tree」语义误读源。③ 无允许集扩张、无 fail-closed 放松、PV-8a/G13.g 形状面不变（指纹是内容树构建非 diff，rename 概念不适用，两执法面互补）。④ 期望值语义钉死 = **实际被测内容树**（干净树 = 该提交 tree OID；R′ 复验 `marker.worktree === runWorktree === R′ tree OID`；禁以 BASE/HEAD tree 冒充——round 1 C1 marker 记 BASE tree 是失效实证） |
| 2 | **W-2 wiki/raw 收窄**（`isTicketDoc` = `path.posix.dirname(p) === 'wiki/raw'` ∧ basename 正则） | **ratified（实现对齐钉值，非修改钉值）**；PV-8a 机械判定补钉 + 勘误 **E-5**（§14.3/§14.4） | glob `wiki/raw/task_issue-472*.md` 在常规 glob 语义下只匹配 `wiki/raw/` 直接子层，`wiki/` 根下与更深层路径**从来不在钉值内**——现实现 `startsWith('wiki/')` 是实现缺陷（fail-open，SA9-3 负控可复现），不是钉值的合法读法。但本报告 §11.3/§13.2 的注记「glob 按 basename 匹配」字面确有歧义空间、现实现正是钻此缝——该注记作废（E-5），机械判定钉为 dirname 精确判定（§14.3 PV-8a iteration-3 补钉）。W-2 是**收窄**：条件 8 禁的是扩张；不收窄才是违反 PV-8a。untracked ⊆ `wiki/**` 分量保持不变（`untrackedPaths()` 判定不动） |
| 3 | **W-3 审计 RESULT 行**（两路径 `[run-baseline] EVIDENCE AUDIT RESULT (<context>): exit=<0\|1> problems=<JSON 数组>`，零新增落盘 artifact） | **ratified（条件 9 判据的可机判载体升级，判据本体不变；无目录纪律 allow-set 变更）** | 条件 9（§11.4 发布 + §13.3 补钉）前半的判定单位本就是「exit code + 打印/落盘的 problems 列表，不是自述文本」——W-3 使成功路径可观察（字面量 `problems=[]`），不新增判据。落盘位置 = 既有日志通道（内置矩阵日志 / standalone 日志重定向），**不新增 artifact** ⇒ `evidence/` 目录允许集（§7.4 检查 7）零改动、无越类文件、不触发「扩类回 SA8 追认」——SA9-4 闭合判据的「若另增 JSON artifact 须同步允许集」路径无需走。N 系负控经同一 `printAudit` 显示非空数组（判红依据本身），无「装饰性空 []」路径。格式钉值见 §14.5 条件 9 载体 |
| 4 | **W-4 与 SA9-5 清理**（删除 `main()` 头部 `mkdirp(EVIDENCE)`、注释对齐实际语义） | **ratified（实现面内部修正，无新决策面）** | 删除 mkdirp 把「被预建目录掩盖的死 guard」复活为响亮红（fail-closed 增强）；本会话核验四个写证据调用点各自 mkdir，删除后无调用路径依赖预创建。注释对齐（gates.mjs L5/L7 头注、run-baseline L898–L903 行数表述）不触碰任何判定语义（gates 数、summary 判据按 §13.3 完备性口径、行数不钉常数）。无 allowlist 变化、无新文件。N-10 负控并入条件 3′（§14.5） |
| 5 | **验证义务扩充**（F-L/F-M、N-8e/f/g、N-10、T-1/T-2 并入条件 3′；W-6 = 条件 6 落实） | **ratified（验证义务扩充，非决策面变化——与 iter-2 §13.4 对 F-K 的处理同机制）；W-6 钉为条件 6 的落实口径** | T-1/T-2 逐字覆盖 SA10 B-1 闭合判据（真实打包输出一次性副本、默认模式非零并指名、恢复 15/15、不得以源码测试/matrix/G13 替代）；`scripts/**` 只运行零改动（DENY 保持）；T-2 对 `publish:reproducible` 不读 `artifacts/local-packages` 的披露诚实。W-6 与 SA6 L83/L180/L645 三处硬判据及 SA9-2 闭合判据逐字一致（shim 置 PATH 首位、同会话全部子进程、完整 `--all --matrix` 不可子集替代、`pnpmProbe.exitCode===0`、落盘 10.28.2、禁 env override）。见 §14.5 |
| 6 | **记录更正格式（B-2）**：C5 = message-only `chore(release)` 更正提交 | **ratified-with-conditions（唯一合法路径 = C5 message-only 追加；不得 rebase reword C2）** | 见 §14.6 专项 |
| 7 | **AC6/B-4 职责边界**（控制器禁 `git push`/`gh pr create`；集成 PR 由 Runner Host 发布侧 finalize 后创建） | **结构性后置裁决成立（对本设计/本轮 remediation 非 reject 事由；对 issue 收官是未闭合前置义务）** | 见 §14.7 专项 |
| 8 | **实现就绪与 requiresConflictRecheck** | **rev3 可进入实现；requiresConflictRecheck = true**（核对清单 §14.9） | 全部 remediation 面已闭合或随本轮钉值/条件增量闭合；无未满足的设计层条件 |

## 14.3 新钉值发布（dispatch 项 1/2；下个 release 票重钉）

### PV-9 tracked working-tree 内容指纹（iteration 3 发布）

- **原语**：`trackedWorktreeFingerprint()` = 临时 index（`GIT_INDEX_FILE` 指向 `os.tmpdir()` 下临时文件）内依次 `git read-tree HEAD` → `git add -u` → `git write-tree`，返回 tree OID；不读真实 index、不改 HEAD/ref/真实 index，临时目录 `finally` 删除；两次调用（marker 时/审计时）在同一 `run-baseline.mjs` 进程 env 内 ⇒ 差异只能来自内容本身。等价实现（逐 tracked 文件内容摘要聚合）允许，但**必须同样排除 untracked、计入 tracked 删除**。
- **字段钉值**：`run-marker.json` = `{startedAt, head, worktree, porcelain}`——`tree` 字段**移除且不得回流**（防 index-tree 冒充内容绑定的读法回流）；`matrix.json` = `runHead` / **`runWorktree`**（= `marker.worktree`，旧 `runTree` 改名）；`writeRunMarker` 后的 console 行打印 `head`/`worktree`；审计检查 1 的 marker 字段必备清单同步。
- **审计绑定**：built-in 与 standalone **两模式均**比对 `trackedWorktreeFingerprint() === marker.worktree`，红点 = `tracked working-tree content drifted during the run: marker.worktree=<X> current=<Y>`；standalone 的 HEAD 比对（`marker.head === 当前 HEAD`）**保留且独立**（N-8g 证明同指纹、HEAD 移动仍红——两绑定互不取代）。
- **期望值语义 = 实际被测内容树**：干净树（无未暂存 tracked 修改）上 fingerprint === HEAD 的 tree OID；终验在 R′（= C4）上必须 `marker.worktree === runWorktree === R′ tree OID`，**不得把 BASE tree 或任何「HEAD tree」当内容绑定**（历史注记：round 1 C1 marker 记 BASE tree `b41d9e73…`，实际 C1 被测内容树 = `da3f368f…`——重跑 C1 等价控制时指纹必须对应实际内容树）。
- **负控**：N-8e（矩阵后未暂存 tracked 修改、不 `git add` → standalone exit 1 + drift problem + RESULT 非空）、N-8f（运行中漂移 → 内置审计 MATRIX FAIL）、N-8g（同 tree HEAD 移动 → 仅 head 红、指纹不红）应红实红。
- **威胁模型边界**：指纹防**意外**内容漂移，不防 marker 与工作树协同伪造；对抗面 = 终验在 R′ 上的独立重跑（与 §7.4 mtime 段同判）。
- **与 PV-8a 的关系**：指纹是内容树构建（read-tree/add/write-tree），非 diff——rename detection 概念不适用；G13.g 的 `git diff --no-renames --name-only BASE`（形状执法面）单一原语纪律不变。PV-8a 钉值不受影响。

### PV-8a 机械判定补钉（iteration 3；钉值语义不变，机械配方精确化——与 §13.2 `--no-renames` 补钉同机制）

tracked 分量第三项的机械判定钉为：**`path.posix.dirname(p) === 'wiki/raw'` ∧ basename 匹配 `/^task_issue-472.*\.md$/`**。`wiki/` 根下（如 `wiki/task_issue-472_probe.md`）、更深层（如 `wiki/raw/nested/…`、`wiki/other/…`）一律判红。原「glob 按 basename 匹配」注记自本版起**作废**（勘误 E-5）。untracked ⊆ `wiki/**` 分量与两态允许集组成、`--no-renames` 原语、absent 态不含 8 个 release 文件——全部不变。

## 14.4 勘误增量（E-4/E-5；追加于 §12 的 E-1…E-3 之后，同机制生效）

| # | 位置 | 失实表述 | 更正后权威口径 |
|---|---|---|---|
| **E-4** | 本报告 §11.2（「marker `tree` 升校验」）、§11.7(b)（「write-tree 比对」）；设计 rev1/rev2 D-11 同源表述 | 「`git write-tree` === marker.tree 抓 tracked 树漂移 / 工作树漂移校验」 | `git write-tree` 写的是 **index**，未暂存的 tracked 修改不进 index——该比对对「被测内容 = working tree」（`copyTrackedTree` 逐 `git ls-files` 路径复制）**不成立**（SA9-1；本会话一手复现：真实 index write-tree = HEAD tree 而 working tree 已漂移）。现行口径 = **PV-9**（§14.3）。终验与实现后复查不得引用 write-tree 比对作为内容绑定证据 |
| **E-5** | 本报告 §11.3 PV-8a 原文与 §13.2 现行版的注记「glob 按 basename 匹配」 | 注记字面允许「basename 命中即可、路径任意 `wiki/` 前缀」的读法——现实现 `startsWith('wiki/')` 正是钻此缝（SA9-3） | glob `wiki/raw/task_issue-472*.md` 的通配只发生在 `wiki/raw/` 直接子层的 basename 段；机械判定 = **PV-8a iteration-3 补钉**（§14.3）。终验按补钉口径核对 |

**效力声明**：E-4/E-5 并入交付条件 10 的禁依赖面（终验不得引用共五处被勘误表述作为核对依据）；历史裁定文本不改写。

## 14.5 交付条件增量（iteration 3）

- **条件 3′（扩面重述）**：负控面 = **F-A…F-M + N-5…N-10 + T-1/T-2**，以设计 rev3 §10 表为唯一权威口径。时机：F-A…F-F、F-H…F-M 在 C1 完成时（**F-L/F-M 同批**）；F-G 在 C2 形成后；N-6/N-6b/N-7/N-7b/N-8a–d 在 `--audit-evidence` 实现完成时；**N-8e/N-8f/N-8g/N-10 在 C4（W-1/W-3/W-4）实现完成时**（一次性副本）；**T-1/T-2 在 §11.1 复验协议步骤 5**（R′ 真实打包输出一次性副本；不得以源码测试/matrix/G13 替代——SA10 B-1 原文）。任何应红实绿 ⇒ 停手。
- **条件 6（落实口径钉值）**：固定法 = §11.1 W-6 协议——`.cache/issue-472-final/bin/pnpm` shim（exec corepack 缓存的 10.28.2 二进制，与 SA6 §4.1 同款固定法、非语义 override）置 **PATH 首位**，**同一会话**内执行复验全部步骤（`execFileSync`/`spawnSync` 子进程继承 env ⇒ 一切子进程的 pnpm 解析到 shim）。判定四件套：① 落盘 `pnpm --version` = 10.28.2；② root-test cell `pnpmProbe.exitCode === 0` ∧ stdout = 10.28.2；③ 完整 `--all --matrix` 重跑（**只跑 root-test 子集不构成落实**）；④ 全程禁 `NOMICORE_VERIFY_REGISTRY_INTEGRITY=0` 等 override。counts 按实际值原样披露、`failedUnexpected=[]`、台账外新红停手不扩账。
- **条件 9（可机判载体钉值）**：「problems=[]」的可机判载体 = **W-3 RESULT 行**：成功与失败两路径均输出 `[run-baseline] EVIDENCE AUDIT RESULT (<context>): exit=<0|1> problems=<JSON 数组>`（`<context>` ∈ {`built-in matrix audit`, `standalone --audit-evidence`}；成功含字面量 `problems=[]` + exit 0；失败非空数组（单行可 `JSON.parse`）+ exit 1；每次审计恰一行 RESULT；人读 PASS/FAIL 与明细行保留；exit code 语义不变）。落盘 = 既有日志通道、零新增 artifact（`evidence/` 目录允许集零改动）。自述 PASS 文本不再作为该判据证据。后半（summary 全量）按 §13.3 判定口径不变（完备性是判据、行数不钉常数）。
- **条件 10（禁依赖面扩至五处）**：在 E-1/E-2/E-3 基础上并入 **E-4**（write-tree 比对不得作为内容绑定证据——按 PV-9 核）与 **E-5**（「glob 按 basename 匹配」不得作为 tracked wiki 判定依据——按 PV-8a iteration-3 补钉核）。
- **新增条件 11（C5 记录更正的合格判据；见 §14.6）**。
- **新增条件 12（AC6 回填边界；见 §14.7）**。

## 14.6 专项裁决：C5 message-only 记录更正（dispatch 项 6）

**唯一合法路径 = C5 = `git commit --allow-empty` 的 message-only `chore(release)` 更正提交。** 禁止 rebase reword C2。

1. **与既有 release 流程相容**：仓库无 `CHANGELOG.md` 且不得新造（S2 触发器；SA6 §10.1b）——变更记录的既有载体就是 `chore(release)` 提交正文（`19df983`/`3321390`/`303666d`/`abbb89a` 四批次正文均记录版本矩阵/内容/门禁结果，iteration-0 §1 已核）。C5 的类型与载体与既有约定一致；它**不是**新 release 文件约定（不新增文件、不改发布动作流程、不触碰 `scripts/**`/INSTALL），只是对既有载体上记录错误的**追加更正**。无 message-only 先例（本会话核验：历史 zero-file 提交全部是 merge）≠ 不相容——既有流程从未出现过「记录更正」需求，而 git 历史不可重写约束下 message-only 追加是唯一既保留可复核性又落在既有载体上的形态。不触发 S2 升级（无 owner 新要求、无新文件约定）。
2. **不得 reword C2**：C1/C2/C3a 三个 hash 是终审报告（SA9/SA10 的 reviewed subject = `git diff --no-renames 6be891a..d5cf485`）与 dispatch 台账的锚点；reword `e3d5881` 连锁改写 `d5cf485` 及后续全部提交，销毁已交付证据的可复核性，违反 rev3 §9.1「禁止 rebase/amend 改写既有提交」与 append-only 原则。
3. **R′ 身份何时为已知事实、如何避免自指**：时序固定为 **C4（设施 remediation，提交完成）→ §11.1 复验协议全量重跑（绑 R′ = C4）→ C5（记录更正）**。C4 提交完成后其 HEAD hash 与 tree OID 即为可取得的已知事实（`git rev-parse HEAD` / `HEAD^{tree}`）；C5 正文引用的是 **C4 的 hash/tree，不是 C5 自身的**——不存在「提交正文包含自身 hash」的自指。C5 自身 hash 无需写入自身正文（C5 是更正记录，不是 release candidate；R′ = C4）。附加完整性交叉核对：C5 为 empty commit ⇒ `C5^{tree} === C4^{tree}`——终验以此机械验证 C5 未夹带文件变更。
4. **条件 11（C5 合格判据，硬约束）**：(a) 正文含**口径两分**——未固定 PATH 口径（round 1 实现轮 C1 矩阵 5959/5991 = 32 = 4 frozen + 28 environment；SA7 终验 R 矩阵 5959/5991 同口径）vs 固定 pnpm 10.28.2 口径（实现轮 C2 预验 5987/5991 = 4 frozen；remediation R′ 重跑实际 counts 原样记录），每个 counts 标注所属口径，并明示更正 C2 ⑦ 的混同归因与 SA7「非判据偏离」分类作废；(b) 正文含 R′ 完整 HEAD（= C4 hash）与 tree（= C4 tree OID），声明 AC1–AC4 证据绑定 R′、旧树（`e3d5881`/`d5cf485`）绿作废（仅历史过程记录）；(c) A4-3 ①–⑩ 其余各条（含条件 4 两分文案）不变引用；(d) C5 晚于 §11.1 复验完成（正文引用重跑实际值）；(e) `C5^{tree} === R′ tree`；G13/gates 对 C5 零新增变更（exact 态不回归）、C6 后重跑 gates 全量保持 exact。回填证据包（§9.4）中的 R′ HEAD/tree 以 C5 所载为准。

## 14.7 专项裁决：AC6/B-4 职责边界（dispatch 项 7）

**义务主体与证据要求**（SA6 §12.6 为验收基准；执行主体由权限/编排事实决定，不在 SA8 裁决面内——SA8 裁义务、证据与时序边界）：

- **A6-1 ticket 侧（#472 REST 评论）**：义务主体 = **有 GitHub 写权限的 Controller**（后续 Controller，或发布侧具备评论权限的执行者）；**不是任何 SA**（GitHub 写操作不在 SA 权限面——rev3 §9.4、SA10 B-4 同判）。证据要求：① 评论正文 = §9.4 回填证据包全集（3×15 typecheck；41/41（gates 13/13、G13 exact、审计 RESULT `problems=[]`、固定 pnpm 口径实际 counts 与 `failedUnexpected=[]`、`pnpmProbe.exitCode=0`）；工件身份（B1/B2/B3 + DSH `1511a6e…` + B3 digest `9d663355…`）与 Root 通道；fault ×4 与 N-5…N-10 负控摘要；T-1/T-2 应红实红 + 恢复 15/15；15 包三项发布门禁 + sha256；七包版本表 + manifest 7+7 + **R′ HEAD/tree（以 C5 记录为准）**；公共契约冻结五项；非目标声明；#464–#466 不复用；S2 版本矩阵读法与 S3 方案 A 的知会性披露（条件 7）；工具链）；② 操作后 `gh api repos/nomicore-ai/nomicore/issues/472/comments --paginate` JSON 落盘（含评论 id/created_at），与操作前快照（SA10 已落盘 `[]`）一并归档。
- **A6-2 PR 侧**：集成 PR（`mabf/issue-472 → spec/468-cordis-rc12-root`）由 **Runner Host 发布侧**在本地 finalize 后创建（控制器硬门禁禁止 `gh pr create`）；PR 正文/评论回填同一组结果，义务主体 = 创建该 PR 的发布侧（或后续 Controller 对已存在 PR 补评论）。证据 = `gh pr view --json` 落盘（head/base/正文/评论含结果包）。
- **A6-3 保护面**：任何执行者不得 close #468、不得改写 Parent（仍 = PR #469）；#464–#466 保持撤回。证据 = 操作前后 `gh api …/issues/468` body/state 快照（仅允许追加评论）。

**「结构性后置」裁决**：可以成立，边界如下——

- **对本设计/本轮 remediation**：AC6 **不是 reject 事由**。设计面以 §9.4 闭环（内容清单 + 触发条件 + 职责边界）；时序上回填必须在「§11.1 复验全绿 + C4/C5 落盘 + 终审组改判 approve」之后——提前回填 = 回填未定稿数据，本身违反记录一致性义务（A4-5 同源）。「PR 尚未存在」在本轮末端是编排事实（门禁禁止本轮创建），不是设计或实现的缺陷。
- **对 issue #472 的最终收官**：AC6 是**未闭合前置义务**，不得宣告满足——SA10 对 round 1 判 AC6 reject 正确（该轮自称收官而回填全缺）。结构性后置 ≠ 豁免，只是闭合时点后置到回填执行时。**ticket 关闭前 A6-1/A6-2/A6-3 必须全部满足**（SA6 通过判定原文）；wiki 内部记录不替代回填（SA6 §12.6）。
- **ticket 侧回填是否必须由本轮控制器完成**：SA8 不裁「哪一轮」——若本轮控制器具备 REST 评论权限且终审已 approve，由本轮控制器执行是顺位最短路径；若本轮末端在终审重裁之前，回填顺延至满足触发条件的第一个有权执行者。**条件 12（硬约束）**：回填完成前 #472 不得关闭；终审组对 remediation 后状态重裁时，在 §9.4 证据包与职责边界在案且 B-1…B-3 已闭合的前提下，AC6 应判 **pending（结构性后置）**而非新增 reject 事由；回填执行时按上述证据要求落盘三组快照。

## 14.8 Frozen surfaces / Overrides / Evolution / Hard conflicts（iteration 3 增量面）

- **Frozen surfaces（增量核对）**：W-1–W-4 零触碰——`baselines.json`/台账/catalog 逐字节（PV-5/PV-8b）、ADR/CONTEXT/协议、`scripts/**`/`.github/**`、生产 `src/**`/`domains/**`、C1/C2/C3a 已交付提交（append-only）、`evidence/` 目录允许集（W-3 零新增 artifact）、gate 数 13 / 矩阵 41 cells / G12 闭集 5 文件（PV-6）、`--no-renames` 单一原语纪律（PV-8a）。C4 文件面恰 = `gates.mjs` + `run-baseline.mjs` 两文件（§14 ALLOW 信封内）；C5 零文件变更；C6 ⊆ `wiki/raw/task_issue-472*.md` glob。
- **Overrides**：无新增。W-1–W-4、验证义务扩充、C5 全部落在 iteration-0/1/2 已追认面内（收紧/对齐/载体升级/义务扩充）；无 ADR 级 override、无 owner 升级需求（S2 触发器与 AC6 知会性披露原样保留）。
- **Evolution requirements**：无 ADR/CONTEXT/协议层演进需求。票级演进已由 PV-9 与 PV-8a iteration-3 补钉收口；实现计划（§9.1 C4→复验→C5→终审→C6 时序、§11.1 协议、§10 负控表）完整。
- **Hard conflicts**：**无**。

## 14.9 实现就绪结论与 requiresConflictRecheck（dispatch 项 8）

**rev3 可进入实现（C4 起步）。** 无未满足的设计层条件；SA9-1…SA9-5 与 B-1…B-3 的设计面 remediation 全部闭合，B-4 以 §9.4 闭环（职责边界经 §14.7 裁决成立）。**requiresConflictRecheck = true**，实现后必须核对：

- (a) **C4 diff 形状**：恰 `gates.mjs` + `run-baseline.mjs` 两文件；W-1（`trackedWorktreeFingerprint()` + marker/matrix 字段切换 + 两模式指纹比对 + `tree` 字段不复存在）、W-2（`isTicketDoc` dirname 精确判定、`untrackedPaths()` 不动）、W-3（`printAudit` 两路径 RESULT 行、格式逐字 = §14.5）、W-4（`main()` 头部 `mkdirp` 删除 + L5/L7 头注 + L898–L903 注释对齐）逐字对上 §7.3.g/§7.4/§9.1；C4 前新负控应红实红、C4 树 gates 13/13（exact）。
- (b) **PV-9 核对**：marker = `{startedAt, head, worktree, porcelain}`；matrix = `runHead`/`runWorktree`；R′ 复验 `marker.worktree === runWorktree === R′ tree OID`；N-8e/N-8f/N-8g 应红实红（RESULT 行非空）。
- (c) **G13.g 原语与 F-L/F-M**：tracked 原语字面 = `git diff --no-renames --name-only BASE`；F-L（staged `wiki/task_issue-472_probe.md`）/F-M（staged `wiki/raw/nested/task_issue-472_probe.md`）各指名判红且 G1′/G2/G4/G12 同轮绿；C3 已交付 wiki 文件正向保持绿；untracked 分量判定不变。
- (d) **条件 9 载体**：干净矩阵 + standalone 两条日志各恰一行 RESULT（成功 `problems=[]` + exit 0）；N 系负控 RESULT 非空 + exit 1；`evidence/` 目录允许集零改动（无新文件类）；summary 按 §13.3 完备性口径（行数不钉常数）。
- (e) **W-4/N-10**：缺目录与空目录变体 standalone 均 exit 1 + RESULT 非空（guard 首次有红点实证）。
- (f) **条件 6/W-6**：R′ 上固定 pnpm 完整矩阵重跑（非子集）；`pnpmProbe.exitCode=0`、落盘 10.28.2；counts 实际值原样、`failedUnexpected=[]`、台账零 diff；无 env override。
- (g) **T-1/T-2**：R′ 真实打包输出一次性副本上执行；`publish:verify` 默认模式各 exit ≠ 0 且按文件名指名；恢复（sha256 逐字节 + manifest 零 diff + porcelain 干净）后 15/15 绿 + reproducible 15/15 复跑留证。
- (h) **C5 正文**：条件 11 五项（口径两分 + R′ HEAD/tree + 再绑定声明 + ①–⑩ 不变引用 + `C5^{tree} === R′ tree`）；C2 正文 ⑦ 混同与 SA7 分类在 C5 中明示更正。
- (i) **时序 append-only**：C4 → §11.1 复验 → C5 → 终审组重裁（SA9/SA10 对 R′ 证据重裁；AC6 按 §14.7 判 pending）→ C6；不改写 C1/C2/C3a；C6 后 gates 全量 exact。
- (j) **AC6 边界**：回填由有权方按 §9.4/§14.7 执行并落盘三组 `gh api`/`gh pr view` 快照；#468 open + Parent=PR #469、#464–#466 撤回不变；回填完成前 #472 不关闭。

## 14.10 Verdict（iteration 3，当前轮）

**clear** —— rev3 全部 remediation（W-1…W-4、§9.1 C4/C5/C6 时序、§10 负控扩面、§11.1 W-6 协议、§9.4 回填边界、§4.2 条件 9 口径）均在 iteration-0/1/2 追认面内或为收紧/对齐/载体升级/义务扩充；PV-9 与 PV-8a iteration-3 补钉随本轮发布，E-4/E-5 勘误生效（条件 10 禁依赖面扩至五处），条件 3′/6/9 增量 + 条件 11/12 发布；C5 message-only 为唯一合法更正路径、AC6 为结构性后置（对 issue 收官仍为未闭合前置义务）；**无 hard-conflict、无新票级决策、无 ADR/CONTEXT/协议触碰、无 owner 升级**。S1/S3（ratified-with-conditions）、S2/S4（ratified）状态不变，**rev3 可进入实现**。
