# SA1 架构设计 — issue #472：Cordis rc.12 三基线回归与 Nomicore `0.5.0` 收官

- HEAD / base：`6be891a3a0cb32fe21c3a6bf485f33428052ce7b`（分支 `mabf/issue-472`；`git status --porcelain` 仅 6 个 untracked wiki 工件，生产面零污染）
- 上游契约：`wiki/raw/task_issue-472_sa6_acceptance_contract.md`（verdict=approve，requiresConflictRecheck=true，S1–S4）
- **评审输入（iteration 1 定向修订依据）**：`wiki/raw/task_issue-472_sa2_review.md`（round 1 iteration 0 评审，verdict=**reject**，BLOCKER 0 / MAJOR 4（SA2-1…SA2-4）/ MINOR 8（SA2-5…SA2-12）；§13 修正判据、§14 MINOR、§15 对 SA8 追认事项的意见）；`wiki/raw/task_issue-472_design_conflict_report.md`（SA8 设计后冲突复查，verdict=**clear**：S1/S3 = **ratified-with-conditions**、S2/S4 = **ratified**；§8.1 发布 PV-1…PV-7、§8.2 发布 8 条交付条件）
- **评审输入（iteration 2 极小定向修订依据）**：`wiki/raw/task_issue-472_sa2_review.md` iteration 1 复查（verdict=**reject**，唯一 blocking = **SA2-13**：`git diff --name-only` 在默认 rename detection 下对改名只列新路径、旧路径删除被隐藏；SA2-1/SA2-3/SA2-4 = CLOSED、SA2-2 = PARTIAL（残余即 SA2-13）；非阻塞观察 SA2-14…SA2-17）；`wiki/raw/task_issue-472_design_conflict_report.md` 追加 §11/§12 后（rev1 复查 verdict=**clear**：PV-8a/PV-8b 正式发布、PV-1…PV-7 不需重钉（PV-6 加注记）、交付条件增补 3′/**9**/**10**、勘误 E-1/E-2/E-3 已生效、S1/S3 可进入实现）
- **评审输入（iteration 3 = 终审 reject 的定向 remediation 依据）**：`wiki/raw/task_issue-472_sa9_standards.md`（reviewGroup rg-472-final-iter0，verdict=**reject**，MAJOR 4 = **SA9-1**（run-marker/审计的 `git write-tree` 只绑 index、未绑被测 working-tree 内容，未暂存漂移可全绿；需 tracked 内容指纹 + 未暂存漂移负控 + 更正 §7.4/D-11 归因）/ **SA9-2**（终验矩阵未按强制口径固定 pnpm 10.28.2）/ **SA9-3**（G13.g tracked wiki allowlist 实际放宽到整个 `wiki/**`，应为直接父目录恰为 `wiki/raw`）/ **SA9-4**（条件 9 要求落盘可机判空 `problems` 列表，成功路径只打印 PASS）+ MINOR 1 = **SA9-5**（注释/死 guard/summary 行数描述失真））；`wiki/raw/task_issue-472_sa10_spec.md`（同 reviewGroup，verdict=**reject**，blocking 4 = **B-1**（AC3/A3-5 缺「篡改 tarball 字节」「删除一个 tarball」两项真实负控）/ **B-2**（release 记录 ⑦ 把未固定 PATH 的 5959/5991 与固定 pnpm 的 5987/5991 混为一谈，且缺 R 的 HEAD/tree）/ **B-3**（交付条件 6 的 pnpm 10.28.2 固定未落实，同 SA9-2）/ **B-4**（GitHub 回填缺失——控制器/发布侧职责，不属本设计面，设计只定义回填证据包与职责边界，§9.4））。round 1 已交付 C1 `1198312` / C2 = R `e3d5881` / C3a `d5cf485`（终审组 reject），remediation 按 §9 追加时序（C4/C5/C6）与 §11.1 复验协议执行
- 规范契约：`docs/adr/0035-cordis-rc12-root-compatibility.md`（§4 依赖与公共契约不变；§6 排除 Host 侧实施）
- 本设计为 **release / acceptance 收官设计**（iteration 1 = 按 SA2 四条 MAJOR + 八条 MINOR 的定向修订；iteration 2 = 按 SA2-13 的极小定向修订（§7.3.g 原语钉 `--no-renames` + §10 F-K 改名注入 + 全文 diff 口径注记）并吸收 SA8 rev1 增量（条件 3′/9/10、PV-8a 精确口径、PV-8b 执行面、PV-6 注记）；**iteration 3 = 终审组两组 reject（SA9-1…SA9-5 / B-1…B-4）的定向 remediation**（§7.4 working-tree 指纹原语 W-1、§7.3.g wiki/raw 收窄 W-2、§7.4 审计结果可机判落盘 W-3、SA9-5 清理 W-4、§10 tarball 负控 T-1/T-2、§11.1 固定 pnpm 复验协议 W-6、§9 记录更正格式 W-7 与 C4/C5/C6 时序）——rev2 骨架与终审已核实成立面（提交拆分、release 数字、生产零 diff、`--no-renames` 原语、台账零扩账、负控应红实红记录）保持不变，修订面显式标注「iteration 3 修订吸收」）：不写生产代码、不写可执行测试本体、不执行提交与发布；只定义实现与最终验证必须遵循的工程决策、设施扩展形状、文件级范围与验收映射。
- SA1 自验记录（iteration 0 原文保持）：本会话实测并复核了 gates.mjs 在 HEAD 12/12 绿（exit 0）、15 包当前版本、7 包 workspace 依赖闭包、`baselines.json` BASE 钉值（`d59a4d1`）、`public-surface.base.json`/surface 测试 = 4 entry、`artifacts/local-packages/manifest.json` 15 键、lockfile `link:` importer 结构、`matrix.json` 41 cells / 0 非 pass / `generatedAt=2026-11-14T22:24:17Z`、`git diff 19df983..HEAD` 生产面恰为两个 seam 文件、registry `persistence@0.4.0` integrity 与 SA6 报告一致、`.cache/sa6-472/publish-verify-head.log`（exit 1，2 mismatch）与 `gates-release-probe.log`（G1′/G3/G6 红）在盘。
- SA1 自验记录（iteration 1 新增，全部本轮一手实测）：`evidence/` 实盘布局逐项核对——cell JSON 以 `<suite>.json` 落盘（`writeEvidence()` L545–L550，**不带基线前缀**），`<B>-typecheck.json` 聚合件（= typecheck cell 的 `logPath`）与 `<B>-typecheck-<project 把 / 与 . 换成 _>.log` ×15 并存，`B1/` 共 96 文件，`fault-*/` 目录内为 `<B>-<suite>.{log,vitest.json}` 与 `<B>-root-probe.mjs.log`；gates cell `provenanceDigest = provenanceDigestFor('B3')`（L881）、root-test cell `= provenanceDigestFor('B1')`（L992），两 cell `baseline='default'`；`run-baseline.mjs` L885 `summary` 的 `slice(-12)`（现盘 gates.json summary 恰 12 行、已缺 G1′ 行）；`gates.mjs` L60–L65 `FACILITY_ALLOW` 含 `baselines.json`（G12 名义上**允许**其 diff）；G2 pathspec 仅 3 个 src 树、G4 仅 2 个 entry 文件、G7 仅 `docs`（L1116–L1135）；ledger `capturedAt="BASE d59a4d1 default layout"`；surface 测试 describe 文本含旧 base 串 `279dba4`；`.gitignore` 覆盖 `.worktrees/`（L4）与 `.cache/`（L18）；`evidence/tmp/` 是 `runVitest` 的默认 evidenceDir 兜底（L447），`--all --matrix` 正常路径不落盘。
- SA1 自验记录（iteration 2 新增，本轮一手实测）：历史改名提交 `27e012b`（`R098 docs/adr/0031-…md → docs/adr/0032-…md`）上 `git diff --name-only 27e012b^ 27e012b` **只列新路径**（输出仅 `CONTEXT.md` 与 `docs/adr/0032-…`，旧路径 `0031-…` 被默认 rename detection 吞掉），`--no-renames` 下**两路径均列**；`diff.renames` 未设置（builtin 默认 true）；当前 porcelain 恰 6 个 `wiki/raw/task_issue-472*.md` untracked，`--no-renames` 只多列改名旧路径、不影响 add/delete 计数语义（两态允许集判定不变）；既有 `changedPaths()`（`gates.mjs` L134–L142）以 `git diff --name-only BASE -- <pathspec>` 取变更集——pathspec 限定 gate（G1′/G2/G12）因 pathspec 外 add 候选被滤、rename 配对失败、旧路径以 D 呈现（SA2 §3 实测同判），**唯独 §7.3.g 的无 pathspec 全树 diff 受默认 rename 语义影响**，故该原语必须钉 `--no-renames`。
- SA1 自验记录（iteration 3 新增，全部本轮一手实测，只读探测）：① **指纹原语实测**——git 2.43.0 下 `GIT_INDEX_FILE=<tmp> git read-tree HEAD && git add -u && git write-tree`（cwd = REPO）在当前树产出 `59a60b0f0124ca7510444e2fcd37f0ca7605510c`，≠ HEAD tree `b898d119…`（= d5cf485 的 tree），差源恰为唯一未暂存 tracked 修改 `wiki/raw/task_issue-472_dispatch.md`（Host 刷新台账）；同时真实 index 的 `git write-tree` = `b898d119…` = HEAD tree——**SA9-1 的失效模式当场复现**：index 绑定与被测 working-tree 内容绑定不是同一事物，旧 marker/审计（`run-baseline.mjs` L1071–L1079/L1195–L1225）在该状态下会判绿。② **树身分复核**：BASE `6be891a`→tree `b41d9e73bbeafe44831fdc85ef652964d7a65dab`、C1 `1198312`→`da3f368fb4a959b53ab8e1f424e0369a6adf85e5`、R `e3d5881`→`bdbdd7a41f743048b9b4ac01f2f252971df79ae8`、C3a `d5cf485`→`b898d119…`（与 SA9-1 第 3 条证据一致：C1 矩阵 marker 记 `tree=b41d9e73…` = BASE tree，而 C1 四文件当时仍在 working tree 被复制执行，真正 C1 内容树 = `da3f368f…`）。③ corepack 10.28.2 二进制在盘可执行（`/home/wangjian/.cache/node/corepack/v1/pnpm/10.28.2/bin/pnpm.cjs`）；`.cache/issue-472-final/bin/` shim 目录即 SA6 §4.1 记录的固定法（release 三连已用、矩阵未用——SA9-2/B-3 缺口）。④ 现盘 `evidence/gates/gates.json` summary = **21 行**（首行 G10 sweep 明细、末行 `all 13 gates passed`）；台账 knownRed=4 / environmentRed=28，environmentRed 名集全部是 `pnpm generate` CLI e2e 类（PATH 解析 `pnpm` → shim 置首位后预期转绿，实际值以重跑为准）。⑤ `scripts/verify-package-tarballs.mjs`：逐包 `run('tar', ['-xzf', tarball, '-C', temp])` 失败即 reject，错误消息含完整 tarball 路径（`tar -xzf <file> failed (N)`）→ stderr `ERROR:` 行按文件名指名受影响包；`publish:reproducible`（`verify-reproducible-packages.mjs`）双次构建于独立临时目录、**不读** `artifacts/local-packages`（删除该目录 tarball 不影响其判定——T-2 的红点必须落在 `publish:verify`）。⑥ `gates.mjs` L128–L132 `isTicketDoc()` 现实现 `posix.startsWith('wiki/')` + basename 正则——SA9-3 属实（`wiki/task_issue-472_probe.md`、`wiki/other/task_issue-472_probe.md`、`wiki/raw/nested/…` 均被 tracked 全树条款放行）。⑦ C2 正文 ⑦ 原文复核：`固定 pnpm 10.28.2 下 root-test 实际 counts 按树记录（C1 5959/5991、C2 预验 5987/5991，failedUnexpected=[]）`——B-2 失实点确认（C1 的 5959/5991 是未固定 PATH 口径，含 28 个 pnpm 环境红）；⑩ 仅写「本提交为 release candidate R」，无 R 的 HEAD/tree hash。

---

## 0. 结论速览（S1–S4 明确结论）

| # | 事项 | 本设计结论 | 追认主体 |
|---|---|---|---|
| **S1** | release diff 与 G1′/G3/G6 零 diff 语义不相容 | **采纳并精确化**：BASE 重钉 `6be891a`；G1′/G3 改为「文件集 allowlist」（只放行 7 个 `package.json` + `artifacts/local-packages/manifest.json`）；新增 **G13 release batch 审计**做逐行/逐值形状判定（两态：absent / exact，任何部分/越界 diff 红）；**G6 语义不变**（依赖"manifest 先提交"时序）；G2/G4/G5/G7–G12 冻结语义不变。gate 数 12→13，矩阵仍 41 cells。**修订吸收（SA2 §15.1 授权并入 PV 清单的两钉）**：G13 两态各增**全树变更集绑定**（SA2-2，§7.3.g；iteration 2 按 SA2-13 把原语钉为 `git diff --no-renames --name-only BASE`）与 **`baselines.json` 逐字节钉死**（SA2-3，§7.3.f；执行面 = G13.f + acquire N-5，PV-8b）；manifest diff 口径钉为 **PV-4 numstat 7 增 + 7 删** | **SA8 已追认：ratified-with-conditions**（PV-1…PV-7 + §8.2 八条 + 本轮并入两钉） |
| **S2** | 「Nomicore 0.5.0」版本语义 | **采纳 7 包闭包**（§6.1 版本矩阵）：`0.5.0` 是批次名，锚点是 `@nomicore/persistence@0.5.0` headline；**不是** 15 包统一版本。统一 minor 属 owner 新要求，出现即停手升级（触发器保留，SA8 条件 7） | **SA8 已追认：ratified**（升级触发器 + AC6 知会性披露保留） |
| **S3** | #471「public entry 4→7」声明与实际树不符 | **采纳方案 A：补齐 7-entry**——在新 BASE 重捕快照（7 键）、surface 测试 ENTRIES 扩到 7（describe 文案同步去旧 base 串）、G12 allowlist 精确 +1（`public-surface.base.json`），release 记录按 **SA8 条件 4 的两分文案**逐字修正（§8）——既承认 #471 以 3 条 runtime 断言等价承载 7/7 覆盖，又写明 7-entry 快照由 #472 落地。方案 B 仅作 owner 否决 A 时的回退，文件范围互斥 | **SA8 已追认：ratified-with-conditions（方案 A，条件 1–4）** |
| **S4** | root-test 32 红只能披露 | **采纳**：台账零扩账（G13.d 把 `root-test-known-red.json` 钉为相对 BASE 零 diff）；final verification 固定 pnpm 10.28.2 后按实际 counts 原样披露；任何新红 = 回归上报，不是台账项 | **SA8 已追认：ratified/沿用**（无需新裁决） |

`requiresConflictRecheck = true`，理由（详见 §18）：(a) S1/S3 为 ratified-with-conditions——追认条件与 PV 钉值（含本轮按 SA2 §15.1 并入的两钉）必须在实现后逐字核对；(b) SA8 冲突报告三处与实码不符的表述——§5 第 1 行（`baselines.json`「G12 零 diff」，实际 G12 允许其 diff）、§5 第 3 行（公共 API 冻结执行面「G2/G4/G7」，G2 仅 3 包 src、G4 仅 2 文件）、§3-S1（「F-A…F-E 恰把这些中间态一一证伪」的过度声明）——**已由 SA8 以报告 §12 勘误（E-1/E-2/E-3）形式即时更正**并发布交付条件 10（终验不得依赖该三处表述；实现记录按 SA8 现行版执行，核对口径见 §11 条件 10 依赖禁令段）；(c) G13 新增失败语义分支（全树条款、baselines.json 钉死）与审计新分支（logPath、目录纪律）需负控实证；(d) **iteration 3 remediation 的四处失败语义/观测面变更需冲突门禁先行确认后再改实现**（SA9-1 闭合判据明示「按冲突门禁确认新指纹口径后再改实现」）：run-marker/审计的绑定原语从 index `write-tree` 换为 tracked working-tree 内容指纹（W-1，marker/matrix 字段随之改名）、G13.g tracked wiki 判定收窄到直接父目录恰为 `wiki/raw`（W-2，PV-8a 钉值语义不变、实现对齐钉值）、审计结果 RESULT 行新增观测面（W-3，无新落盘工件）、standalone 缺目录 guard 复活（W-4，`main()` 头部 `mkdirp(EVIDENCE)` 移除）。本设计不触碰 ADR 0035 任何条款（见 §18）。

---

## 1. 任务类型、目标与非目标

**任务类型**：release / acceptance 收官（SA6 §1 同判）。不是 bug 修复，不改生产实现。

**目标**：
1. 在单一 release candidate 树 `R` 上，闭合 SA6 §18.3 的 G-R1…G-R10：版本 bump 闭包、manifest 收敛、release 记录、验收设施与 release diff 的相容性、本轮证据与 fail-closed 审计。
2. 使 AC1（三基线 41-cell 矩阵，gates cell 含 release 形状）与 AC3（真实打包发布门禁）在**同一棵树**上同时成立（SA6 §12.0.1：不同树上的绿不得互相抵销）。
3. 产出 AC4/AC6/AC7/AC8 所需的版本/变更记录与回填内容边界。

**非目标**（与 ADR 0035 §6、AC5/AC7 对齐）：
- 不修改任何 `packages/**/src/**`、`apps/**/src/**`、`domains/**` 生产内容；
- 不改 Cordis/Timer 依赖范围、dependency/peerDependency 归属、`pnpm-lock.yaml`、`scripts/**`、根 `package.json`；
- 不执行真实 npm 发布（`pnpm publish:packages -- --publish` 属 maintainer 在 `main` 上的动作；本票止于 `publish:verify` 的 dry-run 验证与版本/变更记录落地，见 §13 数据流）；
- 不做真实 MABF/DSH 部署、不修改/移除任何 `patchedDependencies`；
- 不修改 ADR / `docs/protocols/**`；不关闭或改写 #468 Parent；不复活 #464–#466。

---

## 2. 输入与 Owner 要求落实

Issue #472 无任何评论（Host brief `## Comments` 为空；SA6 两轮 `gh api …/comments --paginate → []`）。**无 owner 追加要求、无豁免、无 override**；需求面 = Issue 正文 8 条 AC + `What to build` 叙事 + Parent PR #469 + ADR 0035 决策 1–6 + `INSTALL.md` 既有 release 流程。

### Owner要求落实

| 来源 | 要求 | 设计章节 |
|---|---|---|
| Issue L21（AC1）三基线全仓 typecheck + 完整运行时矩阵 | §7（gates cell 与 release 相容）、§11（复验计划）、§16（A1 映射） |
| Issue L22（AC2）独立解析路径与 Root 通道证据；回退/同名/通道错配阻止收官 | §7.4（证据审计 fail-closed）、§10（负控重跑）、§16（A2/D1–D3/D12/D13） |
| Issue L23（AC3）真实打包产物门禁；源码结果不替代 | §6（版本/manifest）、§13（打包数据流）、§16（A3/D10/D11） |
| Issue L24（AC4）`0.5.0` 版本与变更记录；公共契约冻结确认 | §6.1、§8、§9（release 记录骨架）、§16（A4） |
| Issue L25（AC5）依赖范围/归属不变；须改安装契约即停 | §6.1（闭包只动 `version` 行）、§12（停手条件）、§16（A5） |
| Issue L26（AC6）回填本票与集成 PR；不改 #468 Parent | §9.3（回填时序与边界）、§16（A6） |
| Issue L27（AC7）明确排除真实部署与 patch 移除 | §1 非目标、§9.2（记录文本）、§12、§16（A7） |
| Issue L28（AC8）#464–#466 保持撤回 | §9.2、§12、§16（A8） |

---

## 3. 复现和根因承接

### 复现和根因承接

| 上游事实（SA6 契约） | 证据位置 | 设计响应 |
|---|---|---|
| HEAD `publish:verify` 红：`persistence@0.4.0`、`ws-replication@0.5.0` registry integrity mismatch（内容变、版本未变） | `.cache/sa6-472/publish-verify-head.log`（SA1 复核在盘；registry integrity 本轮 npm view 抽查一致） | §6 版本闭包 bump 使其转绿（SA6 RC 实验已证因果） |
| 三基线矩阵在 HEAD 绿：41 cells（3×(1+12) + gates 12/12 + root-test 按台账 pass，`failedUnexpected=[]`） | `.cache/cordis-baselines/evidence/matrix/matrix.json`（SA1 复核：41 cells / 0 非 pass） | 矩阵结构不动（仍 41 cells）；gates 内部 12→13 gate（§7.2） |
| 一次性 RC（7 包 bump + manifest）使 pack/verify/reproducible 全绿、lockfile 零 diff；同树 gates G1′/G3/G6 红 | `.cache/sa6-472/{release-candidate-probe.json,gates-release-probe.log}`（SA1 复核：G3 unexpected = `packages/ws-replication/package.json` + 探针 worktree 的 `node_modules` symlink；G6 = manifest 未提交） | §7.1 BASE 重钉 + §7.2 G1′/G3 release allowlist + §7.3 G13；G6 靠 §9 提交时序闭合 |
| 自 `19df983` 以来生产面只有 `persistence/service.ts`、`ws-replication/plugin.ts` 两个 seam 文件变化 | `git diff 19df983..HEAD --name-only -- 'packages/*/src/**' 'apps/*/src/**' 'domains/**' 'docs/protocols/**'`（SA1 复核一致） | AC4/AC5 冻结确认的 diff 基础；本票 release diff 只允许版本行 + manifest（§14 文件范围） |
| packed 依赖重写：`workspace:*` → 依赖方当前版本的精确版本（`create-publish-manifest.mjs` L35），只 bump persistence 会改变依赖方 tarball 内容 | `scripts/create-publish-manifest.mjs` + SA6 §9.3 解包实证 | §6.1 闭包推导（SA1 逐包复核依赖图，见下） |
| #471 `caede8a` 声明 7-entry，实际树 4 entry（`cordis-public-surface.test.ts` ENTRIES=4、快照 4 键；该 commit 未改这两文件） | `packages/persistence/test/cordis-public-surface.test.ts` L21–L30、`public-surface.base.json`（SA1 复核一致） | §8 方案 A 补齐 7-entry + 记录修正 |
| root-test 32 红 = 4 knownRed（`ws-replication-issue421-edge-factory-api.test-d.ts`）+ 28 environmentRed（pnpm 未固定）；台账 `root-test-known-red.json`（ticket=#471） | ledger 文件（SA1 复核：4+28） | §7.3 G13 钉台账零 diff；§11 固定 pnpm 10.28.2 后按实际值披露 |
| pnpm 语义：仓库钉 `pnpm@10.28.2`，PATH shim 拒绝 workspace；本轮 pack 用临时 corepack 缓存二进制 | SA6 §4.1 | §11：所有 pnpm 语义（pack/lockfile/root-test）统一固定 10.28.2 并记录 `pnpm --version` |
| `publish:verify` 在普通 CI 被 `NOMICORE_VERIFY_REGISTRY_INTEGRITY=0` 降级 | `.github/workflows/ci.yml`（SA1 复核 L172） | §10/§11：release 证据必须默认模式；env override 视为伪绿 |
| **（修订吸收 SA2-1）证据目录实盘布局与 cell 形态**：cell JSON 以 `<suite>.json` 落盘（无基线前缀）；`<B>-typecheck.json` 聚合件 = typecheck cell 的 `logPath`；`<B>-typecheck-<project>.log` ×15；`fault-*/` 目录内为 `<B>-<suite>.{log,vitest.json}` 与 `*.mjs.log`；gates/root-test cell `baseline='default'` 且 digest 分别钉 `provenanceDigestFor('B3')`/`('B1')` | 本轮 `ls evidence/{B1,B2,B3}` 96 文件逐项核对 + `run-baseline.mjs` L545–L550/L854–L855/L881/L992；SA2 §13 SA2-1 同判 | §7.4 审计允许清单/_DIGEST 期望按此实盘形态精确化（消除干净矩阵假红） |
| **（修订吸收 SA2-2/SA2-3）gate 执法面边界**：G2 仅覆盖 3 个 src 树、G4 仅 2 个 entry 文件、G7 仅 `docs`；11 个包的 `src/**`、非 facility 测试、`scripts/**`、`.github/**` 不在任何 gate pathspec 内；`FACILITY_ALLOW` 含 `baselines.json`（G12 允许其 diff），而 G13 原稿未钉它 | `gates.mjs` L60–L65（FACILITY_ALLOW）、L1116–L1135（G1′/G2/G4/G7 pathspec）本轮逐行复核；SA2 §11/§13 同判 | §7.3.g 全树条款 + §7.3.f `baselines.json` 逐字节钉死；§14/§15 执法面归因更正 |
| **（修订吸收 SA2-5）gates cell summary 截断**：L885 `slice(-12)` 在 12 gate（13 行 `[gates]` 输出）下已缺 G1′ 行；13 gate（14 行）将再缺 G2 行 | 现盘 `evidence/gates/gates.json` summary 恰 12 行（首行为 G2），本轮实测 | §16：去截断，保留全部 `[gates]` 行 |

### SA1 对 7 包闭包的独立复核（不自证 SA6 结论）

对 15 个 publishable 包的 `dependencies` 逐个读取（本轮实测）。**表头口径（修订吸收 SA2-11②）：下表「闭包内 workspace 依赖」列只列与闭包判定相关的子集，不是该包 workspace 依赖的全集——未列出的 workspace 依赖均不在闭包内、本票零 diff**（dsh-persistence 另有 `@nomicore/clock`；namespace-api 另有 vfsl 系；yjs-server 共 9 项 workspace 依赖此处列 4 项；SA2 §5 独立重算与本表结论一致）：

| 包 | 闭包内 workspace 依赖（相关子集；其余均不在闭包、不变） | 是否入闭包 |
|---|---|---|
| persistence | clock | **是**（自身源变化，headline） |
| dsh-persistence | persistence | **是**（packed dep 联动） |
| namespace-runtime | persistence | **是** |
| namespace-registry | persistence, namespace-runtime | **是** |
| namespace-api | namespace-registry | **是** |
| ws-replication | namespace-registry（clock/instance/replication-protocol 不变） | **是**（自身源变化 + 闭包） |
| yjs-server | persistence, namespace-registry, namespace-api, ws-replication | **是** |
| 其余 8 包（vfsl 系 3、doc-runtime、clock、instance、namespace-diagnostic-log、replication-protocol） | 不依赖闭包内包的新版本 | 否（零 diff） |

闭包 = {persistence, dsh-persistence, namespace-runtime, namespace-registry, namespace-api, ws-replication, yjs-server}，与 SA6 §9.3 完全一致。反向核查：不存在闭包外包 packed 内容因本次 bump 变化（其 workspace 依赖均不在闭包内）。

---

## 4. SA8约束落实

**修订吸收（iteration 1）**：`wiki/raw/task_issue-472_design_conflict_report.md` 已于 round 1 落盘（verdict=**clear**；S1/S3 = **ratified-with-conditions**、S2/S4 = **ratified**；§8.1 发布 PV-1…PV-7、§8.2 发布 8 条交付条件）。iteration 0 的「本票无 SA8 产物」状态作废。可继承裁决落实如下；**设计后冲突复查仍需**（理由与三处 SA8 报告表述更正见 §0/§17/§18）。

| 决议或义务 | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|
| #470 **R1** 全仓 typecheck = 根 `scripts.typecheck` 15-project 清单，逐 project 留证 | §11（矩阵命令不变） | 原样继承；typecheck cell 代码零改动 | 否 |
| #470 **R5** B3 provenance 八项 | §11（acquire/provenance 复用） | 原样继承；`acquire.mjs`/`provenance-b3.json` 零 diff | 否 |
| #470 **R7** 机械 gate（ws allowlist、index.ts 零 diff、公共面快照、manifest/lock/artifacts gate） | §7（G1′/G3/G13 扩展） | **扩展**：R7 的"manifest/lock/artifacts gate"在 release 票上精确化为文件集 allowlist + G13 形状审计；G2/G4（src/index 零 diff）与 lock/catalog 冻结不动 | **是（S1，已追认带条件）** |
| #470 **R8** ADR 0023 冻结服务面 | §16 A4-4⑥ | 原样继承（服务名断言走 guard-proxy suite） | 否 |
| #471 **S1** 12 suite × 3 基线为必绿 cell | §7.4（suite 注册零改动） | 原样继承 | 否 |
| #471 **S2** ws/app 测试面与共享 runner 设施 | §7（只扩 gates/audit，不建第二套 runner） | 原样继承 | 否 |
| #471 **S3** 跨包验收设施依赖（fixtures 目录） | §7、§14 | 原样继承（仍是测试面依赖） | 否 |
| #470 **R3**「ws 只做编译面」 | — | 已被 #471 显式取代，沿用取代后矩阵 | 否 |
| #470/#471 root-test 台账 | §7.3（G13-d 钉零 diff）、§11 | 只作 disclosure（S4） | 否（沿用） |
| 本票 **S1–S4**（SA6 §18.2） | §0 结论速览 + §6/§7/§8 | **SA8 冲突报告已全部追认**（S1/S3 带条件、S2/S4 无条件）；条件 = §8.1 PV + §8.2 八条 + SA2 §15.1 授权并入的两钉（§4.1 末行） | **是**（实现后核对钉值与条件；更正 SA8 报告三处表述） |

### 4.1 SA8 PV-1…PV-7 逐字吸收（修订吸收；下个 release 票重钉）

| PV | 钉值（逐字采用 SA8 §8.1） | 设计位置 |
|---|---|---|
| **PV-1 BASE** | `gates.mjs` `BASE = 6be891a3a0cb32fe21c3a6bf485f33428052ce7b`（`baselines.json` 的 `base` 文档字段保留 `d59a4d1` 作 #470 出处记录，规范 BASE 单源在 gates.mjs） | §7.1 |
| **PV-2 G1′ release allowlist（恰 8 文件）** | `packages/{persistence,dsh-persistence,namespace-runtime,namespace-registry,namespace-api,ws-replication}/package.json` + `apps/yjs-server/package.json` + `artifacts/local-packages/manifest.json`；pathspec 不变（17 manifest + `pnpm-lock.yaml` + `artifacts`），白名单外零 diff | §7.2 |
| **PV-3 七包版本表（RELEASE_BATCH.versions，from→to）** | persistence 0.4.0→0.5.0；dsh-persistence 0.4.0→0.5.0；namespace-runtime 0.4.0→0.5.0；namespace-registry 0.4.0→0.5.0；namespace-api 0.3.0→0.4.0；ws-replication 0.5.0→0.6.0；yjs-server 0.5.0→0.6.0。每文件文本 diff 恰 1 删 1 增（删 `  "version": "<from>",` / 增 `  "version": "<to>",`）∧ JSON 深度相等（唯一例外 version）∧ `version === to` | §6.1、§7.3.a |
| **PV-4 manifest diff 行数口径** | `git diff --numstat 6be891a..R -- artifacts/local-packages/manifest.json` = **7 增 + 7 删**（= 7 个变更键，每键 1 行删 1 行增；先例：19df983 九包 = 18 行）；15 键集合不变；每个非 private workspace 包 filename === `<name 去连字符>-<working version>.tgz`；无旧 filename 残留。**口径注记（iteration 2）**：manifest 为双树俱存的修改型 diff，rename 配对不适用；实现按单一原语纪律（§7.3.g）统一携带 `--no-renames`，对该形状为无操作，numstat 钉值逐字不变 | §6.2、§7.3.c |
| **PV-5 台账/catalog 冻结** | `root-test-known-red.json` 相对 BASE 逐字节相同（knownRed=4 + environmentRed=28 + attribution + ticket=#471）；`scripts/package-catalog.mjs` 相对 BASE 逐字节相同 | §7.3.d/e |
| **PV-6 gate 数与矩阵（原值不变 + 注记，SA8 §11.3 判定非重钉）** | gate 总数 **13**（G1′–G12 语义除追认明示项外不变 + 新 G13 两态）；矩阵仍 **41 cells**（gates 为 1 cell 执行 13 gate；SA6 A1-6「12/12 或扩展后的等价 gate 数」满足）；G12 闭集 **5 文件**；G5 比较面 **7 entry**（方案 A）。**注记**：f/g 款为 G13 子句、不是新 gate，gate 数不因增款漂移；G12 闭集组成不变（D-9），其中 `baselines.json` 名义项自本票起为**死条目**——其批次级冻结的实际执行面是 **G13.f（PV-8b）+ acquire N-5**，不是「G12 零 diff」，G12 detail 文案随实现更正 | §7.3、§7.5、§8 |
| **PV-7 公共面 entry 集（方案 A）** | `PUBLIC_ENTRIES` = `@nomicore/persistence`、`@nomicore/persistence/testing`、`@nomicore/dsh-persistence`、`@nomicore/ws-replication` + 新增 `@nomicore/ws-replication/testing`（→ `packages/ws-replication/src/testing.ts`）、`@nomicore/clock`（→ `packages/clock/src/index.ts`）、`@nomicore/namespace-registry`（→ `packages/namespace-registry/src/index.ts`）——与 #471 SA10 `C.public-surface.*` 断言集一致；快照在新 BASE 重捕为 7 键 | §8 |
| **PV-8a 全树变更集绑定（SA2 §15.1 授权并入 S1 追认面，SA8 §11.3 正式发布；iteration 2 按 SA2-13 与 `--no-renames` 原语合并表述——钉值语义「改名 ⇒ 红」不变，`--no-renames` 恰是兑现该钉值的机械配方；iteration 3 按 SA9-3 把 wiki 分量的机械判定钉为「直接父目录恰为 `wiki/raw` 且 basename 匹配 `task_issue-472*.md`」，对齐钉值原文、消除「glob 按 basename 匹配」的放宽读法）** | tracked：**`git diff --no-renames --name-only BASE`** 的变更集 ⊆ {C1 的 4 个设施文件：`packages/persistence/test/fixtures/cordis-baselines/{gates.mjs, run-baseline.mjs, public-surface.base.json}` + `packages/persistence/test/cordis-public-surface.test.ts`} ∪ {PV-2 的 8 个 release 文件（7 个 `package.json` + `artifacts/local-packages/manifest.json`）} ∪ {`wiki/raw/task_issue-472*.md`（C3 docs-only 面；**机械判定：`path.posix.dirname(p) === 'wiki/raw'` ∧ basename 匹配 `task_issue-472*.md`——`wiki/` 根下（如 `wiki/task_issue-472_probe.md`）与更深层（如 `wiki/raw/nested/task_issue-472_probe.md`、`wiki/other/…`）一律判红**）}；**absent 允许集（C1 态）= 上述集合去掉 8 个 release 文件（不含任何 release 文件）**；untracked：`git status --porcelain` 项 ⊆ `wiki/**`（独立分量，不因 tracked 分量收窄而放宽或收紧；`.cache/`、`.worktrees/` 已 gitignored，天然无噪声）；rename 在判定上等价于「旧路径删除 + 新路径新增」，两条都必须落在允许集内才可绿；越界任何一项即红并指名文件 | §7.3.g |
| **PV-8b `baselines.json` 逐字节冻结（SA8 §11.3 正式发布）** | G13 两态各增 f 款：`baselines.json` 与 BASE **逐字节相同**（含 `base` 文档字段 `d59a4d1`、B1/B2 integrity、B3 dshCommit、suites 12 项——三基线工件身份的唯一定义源随批次钉死）；**执行面 = G13.f + `acquire.mjs` 的 N-5 完整性负控共同承载**；G12 的 `FACILITY_ALLOW` 名义项自此为**死条目**（PV-6 注记） | §7.3.f |

### 4.2 SA8 §8.2 交付条件逐字吸收（修订吸收；全部为硬约束；含 SA8 §11.4 增补的条件 3′/9/10）

| # | 条件（SA8 §8.2 原文要义，语义逐字） | 设计位置 |
|---|---|---|
| 1 | **C1 三文件一致**：`gates.mjs`（BASE/PUBLIC_ENTRIES/G1′/G3/G13/G12/G5 文案）、`public-surface.base.json`（7 键重捕）、`cordis-public-surface.test.ts`（ENTRIES 4→7 + 文案）必须在**同一设施提交 C1** 变更；快照重捕在 BASE 重钉之后的 C1 工作树执行 | §9 C1 |
| 2 | **两态自洽实证**：C1 上 gates 13/13 且 `G13 state=absent`；C2 上 gates 13/13 且 `G13 state=exact` 且 G6 干净；AC 证据只认 exact 态树（SA6 §12.0.1 单树绑定，不允许两态绿互相抵销） | §9、§11 |
| 3′（SA8 §11.4 重述；iteration 2 扩至 F-K；**iteration 3 扩至 F-M + N-10 + T-1/T-2**） | **负控先于绿**：负控面 = **F-A…F-M + N-5…N-10 + T-1/T-2**，以设计 §10 表为唯一权威口径；时机按 §10——F-A…F-F、F-H…F-M 在 C1 完成时（iteration 3 新增项在 C4 完成时）；F-G 在 C2 形成后（absent 分支的首次红灯实证）；N 系在 `--audit-evidence` 实现完成时；**T-1/T-2 在 §11.1 复验协议步骤 5**；任何应红实绿 ⇒ 停手（§12.8） | §10 |
| 4 | **记录修正两分文案（S3）**：release 正文/回填/SA10 产物统一表述——「#471 提交 `caede8a` 所称『公共 entry 导出名集合由 4 扩到 7』在快照/测试文件层面未发生（树内仍为 4 entry），其覆盖由 #471 以 3 条 runtime 严格相等断言等价承载（SA10 记录 7/7）；7-entry **快照**由 #472 设施提交落地，现快照与记录一致」。不得宣称 #471 已交付 7-entry 快照，也不得宣称 #471 未做任何公共面覆盖扩展；不得改写 caede8a 或任何历史 wiki 工件 | §8、§9.2（逐字采用） |
| 5 | **G5 重捕失败处置**：新 BASE 捕获因传递依赖解析失败 ⇒ 停手并回 SA8/owner 重议方案 B；禁止静默降级回 4-entry | §12（风险表 + 等效停手） |
| 6 | **发布门禁证据纪律**：`publish:verify` 必须默认模式（禁 `NOMICORE_VERIFY_REGISTRY_INTEGRITY=0`）；全部 pnpm 语义固定 10.28.2 并记录 `pnpm --version`；root-test 计数按实际值原样披露、名集判红；不执行 `publish:packages -- --publish`。**iteration 3 落实口径（SA9-2/B-3）**：固定法 = §11.1 W-6 的 shim 置 PATH 首位（矩阵及其全部子进程同会话继承），矩阵 root-test `pnpmProbe.exitCode === 0`、落盘 `pnpm --version`=10.28.2；只跑 root-test 子集不构成落实 | §10、§11.1 |
| 7 | **S2 触发器**：owner 任何评论要求 15 包统一 minor、新增 `CHANGELOG.md`、根版本号语义 ⇒ 停手升级（§12.4）；AC6 回填时**知会性披露**版本矩阵读法与 S3 方案 A 选择（非阻塞，供 owner 行使否决） | §12、§9 C3 |
| 8 | **锁定文件范围**：实现/最终验证的全部改动 ⊆ 设计 §14 ALLOW；任何进一步 allowlist 扩张、`scripts/**`/CI/ADR 触碰、台账改动 ⇒ 回本门禁 | §14 |
| 9（SA8 §11.4 新增；iteration 3 补可机判落盘口径，闭合 SA9-4） | **审计相容性与全量 summary**：HEAD 干净树重跑 `--all --matrix`，内置证据审计 **exit 0 且 problems=[]**（SA2-1 相容判据：干净矩阵零假红）；gates cell 的 summary 必须保留**全量 14 行** gates 输出（13 gate = 14 行 `[gates]` 输出，`slice(-12)` 截断已按 D-10 去除）——终验不得假设截断。**iteration 3 口径精确化**：①「problems=[]」的可机判载体 = **W-3 RESULT 行**（成功与失败路径都输出 `[run-baseline] EVIDENCE AUDIT RESULT (<context>): exit=<0|1> problems=<JSON 数组>`，成功行含字面量 `problems=[]`，自述 PASS 文本不再作为该判据证据）；②「全量 14 行」按 SA8 §13.3 的 14/21 合法口径读——**完备性**（逐 gate 行 + 汇总行 + G10 明细行全保留、无 magic 截断）是判据本体，行数不钉常数（现盘 21 行，§16 注记） | §7.4 末段、§11 步骤 2、§16 |
| 10（SA8 §11.4 新增） | **勘误不依赖**：终验与实现后复查**不得依赖** SA8 报告 §12 已更正的三处表述（E-1：`baselines.json`「G12 零 diff」；E-2：公共 API 冻结「G2/G4/G7」覆盖归因；E-3：「F-A…F-E 一一证伪」过度声明）；核对口径——`baselines.json` 冻结按 **G13.f + N-5**、公共 API 冻结按 **G13.g（`--no-renames` 原语）+ G2/G4 + 终验步骤 8**、负控覆盖按 **§10 表（F-A…F-K + N-5…N-9）** | §11（条件 10 依赖禁令段）、§12 风险表、§14 DENY、§17 |

**冲突时取舍规则（dispatch 约束）**：设计与追认条件冲突时以追认条件为准，本设计不得反向要求 SA8 让步。iteration 1 的设计—报告差异（SA8 报告三处表述失实）已由 SA8 以 §12 勘误（E-1/E-2/E-3）即时更正并加条件 10，设计侧按实码执法面书写的口径（§7.3.f/g、§14、§15）与之逐字一致；SA8 发布的 PV-8a 原文（§11.3）逐字继承了 §7.3.g rev1 的「删除/改名同样计入变更集 ⇒ 红」表述，SA2-13 实证该表述在默认 rename detection 下对改名不成立——本修订把原语钉为 `--no-renames`（§7.3.g），**PV-8a 的钉值语义「改名 ⇒ 红」不变**，`--no-renames` 是兑现该钉值的机械配方而非新决策面；SA8 将在实现后复查中给 PV-8a 补注该口径（SA2-13 required change 同判）。

---

## 5. 设计决策总览与主要备选

| # | 决策 | 主要备选 | 不选原因 |
|---|---|---|---|
| D-1 | release diff = 7 包 `"version"` 单行 + manifest 7 个 filename 行，一次 `chore(release)` 提交 | ① 只 bump 2 个源变化包；② 15 包统一 minor | ① packed 依赖重写使依赖方 tarball 内容变化 → `publish:verify` 仍红（SA6 §9.3 解包实证）；② 未经 owner 确认的新流程（S2），会改变 8 个无关包的已发布版本语义 |
| D-2 | BASE 重钉 `6be891a`（gate 审计面只含本票 diff） | 保留 `d59a4d1` 并把 #470/#471 设施 diff 也放进 release allowlist | 审计面无谓扩大；#471 已合并进 base，其设施 diff 不是本票要放行的对象（SA6 §15.2.8） |
| D-3 | G1′/G3 = 文件集 allowlist；新增 G13 做两态（absent/exact）形状审计 | ① 把形状判定全塞进 G1′；② 为 release 建"豁免模式"开关 | ① 单 gate 职责混杂，absent/exact 两态难以表达；② 任何模式开关都是 fail-open 面（`--release-mode` 误开即放行） |
| D-4 | 证据 fail-closed 审计落在 `run-baseline.mjs`（`--audit-evidence` + 矩阵内置） | ① 新增 facility 文件；② 新增 `scripts/audit-*.mjs` | ① 扩大 G12 闭集（需新追认）且审计与证据生产分离易漂移；② `scripts/` 不在 G12 闭集纪律内，反而游离；SA6 的 `.cache/sa6-472/audit-matrix.mjs` 是一次性诊断件，不可直接转正 |
| D-5 | 7-entry 快照补齐（方案 A） | 方案 B：保持 4-entry，仅记录修正 | B 留下"公共 entry 集合"与记录永久不一致，且 #471 SA10 原要求即为 7；A 成本可控（§8） |
| D-6 | 设施提交（C1）先于 release 提交（C2） | release 先行 | 旧 gates 在 release 树上必红（G1′/G3/G6），每步 gate 语义不自洽；G13 两态设计使 C1 上 absent 态合法、C2 上 exact 态合法（§9） |
| D-7 | 不在本票执行 npm publish | 连带执行 `publish:packages -- --publish` | INSTALL 要求 main 分支 + clean + npm whoami；AC3 只要求 verify/reproducible；发布是 maintainer 动作，越权即流程违规 |
| **D-8**（修订吸收 SA2-2） | G13 两态各增**全树变更集绑定**（§7.3.g：tracked ⊆ 12 文件 + `wiki/raw/task_issue-472*.md`，untracked ⊆ `wiki/**`） | ① 维持手工把关（final verification 步骤 8 唯一执行面）+ §14/§15 归因改写 + 残余风险登记；② 仅查 tracked 不查 untracked | SA2 给出的二选一中①为推荐项：机械绑定优先于人工纪律，且属收紧、在 S1 已追认面内（SA2 §15.1 明示无需新裁决）；手工方案会把 11 个包 `src/**`、非 facility 测试、`scripts/**`、`.github/**` 留在无人执法面。选①后步骤 8 降为复核性双保险。untracked 一并查是因为 wiki 工件在 C3 前必然以 untracked 形态在树（`.cache/`、`.worktrees/` 已 gitignored 不产生噪声） |
| **D-9**（修订吸收 SA2-3） | `baselines.json` 以 **G13 两态逐字节钉死**（§7.3.f）；`FACILITY_ALLOW` 保持 PV-6 的 5 文件闭集不动，`baselines.json` 名义项自此为死条目并在 G12 文案中更正归因 | 把 `baselines.json` 从 `FACILITY_ALLOW` 移除 | G13 钉死已在 S1 已追认面内（SA2 §15.1 授权并入）且与 PV-6「G12 闭集 5 文件」兼容；移除方案会第二次改动 #471 已批准的 G12 闭集组成（4→5→再变组成），制造额外 supersession 面。两方案的执法效果等价（任何 diff 均红），差别只在红点 gate 与闭集语义稳定性 |
| **D-10**（修订吸收 SA2-5） | gates cell `summary` 去掉 `slice(-12)` 截断，保留全部 `[gates]` 行（13 gate = 14 行） | `slice(-14)` | 任何 magic 常量都会随 gate 数再次漂移失真（12→13 已两次丢行）；14 行体量对 JSON 字段无截断必要；全量保留使 SA10/终验可直接从 gates.json 核对 G1′…G13 逐 gate 结果 |
| **D-11**（修订吸收 SA2-7/SA2-12；**iteration 3 更正归因并升级原语（SA9-1）**） | run-marker 的内容绑定从 disclosure 升级为校验，且校验原语是 **tracked working-tree 内容指纹 `trackedWorktreeFingerprint()`**（W-1：临时 index `read-tree HEAD` → `add -u` → `write-tree`；untracked wiki 排除、tracked 删除计入、无 rename 语义），内置/standalone 审计收尾均比对「当前指纹 === marker.worktree」（抓矩阵运行中的被测内容漂移，T-4）；HEAD 检查保留（standalone）。**归因更正**：iteration 1/2 写的「`git write-tree` === marker.tree 抓 tracked 树漂移」是错误归因——`git write-tree` 写的是 **index**，未暂存的 working-tree 修改不进 index，故该比对对「被测内容 = working tree」（`copyTrackedTree` L251–L260 逐 `git ls-files` 路径 `fs.copyFileSync`）的绑定不成立（SA9-1 实证：C1 矩阵 marker `tree=b41d9e73…` = BASE tree，而 C1 四文件当时未提交、真正被测内容树 = `da3f368f…`）；本设计 §7.4 已同步更正。mtime 威胁模型成文（§7.4 末段）；「marker 龄差值上限」不采纳（理由见 §7.4） | tree/porcelain 维持 disclosure-only；或保留 index `write-tree` 比对再另加指纹 | disclosure-only 留下 T-4 缺口；保留 index 比对则留下与指纹并存的第二个「tree」语义，正是 SA9-1 判定的误读源——单一字段、单一语义（内容指纹）才可机判 |

---

## 6. 决策 1（dispatch 项 1）：release batch 与版本语义

### 6.1 版本矩阵与依据（A4-1）

| 包 | 当前（=registry 已发布） | 目标 | 依据 |
|---|---|---|---|
| `@nomicore/persistence` | 0.4.0 | **0.5.0** | 自身 `src/service.ts` 行为新增（rc.12 双形态 Root，append-only 兼容缝，无破坏性公共面变化）→ minor；批次 headline「Nomicore 0.5.0」锚点 |
| `@nomicore/dsh-persistence` | 0.4.0 | 0.5.0 | packed dep `workspace:*` 重写为 `0.5.0`，tarball 内容变化；沿用 `19df983` 的「闭包联动 minor」惯例（避免部分联动产生同树双版本） |
| `@nomicore/namespace-runtime` | 0.4.0 | 0.5.0 | 同上（dep persistence） |
| `@nomicore/namespace-registry` | 0.4.0 | 0.5.0 | 同上（deps persistence + namespace-runtime） |
| `@nomicore/namespace-api` | 0.3.0 | 0.4.0 | 同上（dep namespace-registry） |
| `@nomicore/ws-replication` | 0.5.0 | 0.6.0 | 自身 `src/plugin.ts` 行为新增 + 闭包；已发布 0.5.0，内容变化只能 > 0.5.0 |
| `@nomicore/yjs-server` | 0.5.0 | 0.6.0 | 闭包（deps persistence/namespace-registry/namespace-api/ws-replication）；已发布 0.5.0 |
| 其余 8 publishable 包 + 根 `package.json`（0.1.0, private）+ `domains/vfs3-assets`（0.1.0, private） | — | 不变 | 源与 packed 依赖均不变；根/域包无私有版本语义（SA6 §10.1b：仓库无 `CHANGELOG.md`，不得新造 release 文件约定） |

每个 bumped 版本的可发布性由 `publish:verify` 默认模式证明：7 个新版本走 `npm publish --dry-run --json --ignore-scripts`，8 个已发布版本走 registry integrity 相等（SA6 RC 实验已实证全绿）。偏离本矩阵（如 owner 要求统一 minor）= S2 新决策，停手升级（§12）。

### 6.2 manifest 的生成时序与验证

**生成**（一条会话内完成，顺序固定）：
1. 编辑 7 个 `package.json` 的 `"version"` 行（全部位于 L3，形状 `  "version": "X.Y.Z",`）；
2. 以固定 pnpm 10.28.2 运行 `pnpm pack:local`（无参 → outDir = `artifacts/local-packages`）。脚本逐包 `pnpm run build` → `pack-package.mjs` 打 tarball（gitignored `*.tgz`）→ 以 `scripts/package-catalog.mjs` 顺序重写 `manifest.json`（键序 = catalog 序，2-space JSON + 尾随换行；`build-local-packages.mjs` L21–L26）。注意脚本会先整目录 `rm -rf` 重建——tracked 文件只有 `manifest.json`，重建后内容确定性可再生；
3. `git status` 应只显示 `artifacts/local-packages/manifest.json` 修改（7 个 filename 行）。

**验证**（三层，全部要绿）：
1. **形状（修订吸收 SA2-8/PV-4 numstat 口径，消除「恰 7 行」歧义；iteration 2 补单一原语纪律）**：`git diff --no-renames --numstat 6be891a..R -- artifacts/local-packages/manifest.json` = **7 增 + 7 删**（= 7 个变更键，每键恰 1 行删 + 1 行增；先例：`19df983` 九包批次 = 18 行；`--no-renames` 对该双树俱存的修改型 diff 为无操作——单一原语纪律见 §7.3.g），且每个新增行的 filename 均为 `nomicore-<name>-<target>.tgz`（G13 逐键钉死，§7.3.c）；15 键集合不变、无旧 filename 残留（A4-2）；
2. **一致性**：`pnpm publish:verify`（默认模式，禁 env override）内建 manifest filename ↔ 包 name/version 交叉检查 + registry integrity/dry-run（`verify-package-tarballs.mjs` L19–L21、L56–L62）；
3. **lockfile 判据**：`pnpm install --frozen-lockfile --lockfile-only` exit 0 **且** `git diff --exit-code -- pnpm-lock.yaml` 为空。依据（本轮实测 lockfile 结构）：workspace 依赖在 lockfile importers 中记为 `specifier: workspace:* / version: link:../<pkg>`（37 处 link），版本字段不参与 lock 解析；`--frozen-lockfile` 同时证明全部 manifest specifier 未漂移（依赖字段零改动，A5-2）。

---

## 7. 决策 2（dispatch 项 2）：验收设施改造

全部落在既有 facility 文件的闭集内：`gates.mjs`（BASE 重钉 + G1′/G3 allowlist + 新 G13 + G12 delta + G5 文案）与 `run-baseline.mjs`（证据审计）。**不新增文件、不动 `scripts/**`、不动 `acquire.mjs`/`root-probe.mjs`/`provenance-b3.json`/`baselines.json`**。

### 7.1 BASE 重钉（G5 捕获与所有 diff 的参照）

`gates.mjs` L41 `const BASE`：`d59a4d1…` → `6be891a3a0cb32fe21c3a6bf485f33428052ce7b`。效果（本轮以 HEAD 干跑验证）：#471 的 4 个 facility 文件 diff 从 G12 视角消失，G12 审计面收敛为「本票改过的 facility 文件」。`baselines.json` 的 `"base"` 文档字段**不改**：它无代码读方（本轮 grep 确认仅 `MANIFEST.baselines`/`MANIFEST.suites` 被使用），语义是「#470 fixture 的成文 base」，保留原值作为出处记录；规范 BASE 单源在 `gates.mjs`（PV-1）。

**base 串语义分工（修订吸收 SA2-9）**——仓内四处 base 字符串语义各别，本票只改 ①④、不得改写 ②③：
① `gates.mjs` `BASE`（重钉后 `6be891a`）＝规范单源，所有 diff/gate 判定的唯一参照；② `baselines.json` 的 `base` 文档字段（`d59a4d1`）＝#470 fixture 的成文出处记录，无代码读方，保留原值，且受 G13.f 逐字节钉死（§7.3.f——这正是其不被改写的机械保障）；③ `root-test-known-red.json` 的 `capturedAt: "BASE d59a4d1 default layout (Step 0, frozen)"`＝台账捕获出处，随台账整体逐字节冻结（G13-d），不改写；④ `cordis-public-surface.test.ts` describe 文案中的旧捕获串（`vs base 279dba4 捕获`）＝快照捕获时点的描述文本，随 §8 的 7-entry 改造同步更正（去掉具体 sha，避免重捕到 `6be891a` 后再次失真）。

### 7.2 G1′/G3 的 release allowlist 精确形状（fail-closed，不是放宽）

**G1′（manifests / lockfile / artifacts）**：由 `assertNoChange` 改为 `assertAllowlist`，pathspec 不变（`['pnpm-lock.yaml', ...listManifests(), 'artifacts']`，覆盖根 + 14 包 + app + `domains/vfs3-assets` 共 17 个 manifest），allowlist 恰为 8 个文件：

```
packages/{persistence,dsh-persistence,namespace-runtime,namespace-registry,namespace-api,ws-replication}/package.json
apps/yjs-server/package.json
artifacts/local-packages/manifest.json
```

- 未列入者（根 `package.json`、其余 8 个 `package.json`、`domains/vfs3-assets/package.json`、`pnpm-lock.yaml`、`artifacts/**` 其余 tracked log）仍为零 diff 语义。**口径精确化（修订吸收 SA2-11①）**：对白名单外文件是**原零 diff 语义不变**；对白名单内 8 文件是**受控开口**——由旧 G1′ 的零 diff 改为 allowlist 放行文件集，且文件集的内容移交 G13 更强的形状执法（深度相等 + 1 删 1 增 + 逐键交叉核对）。整体等价于「白名单外语义不变 + 白名单内执法更严」，不是放宽（SA8 §3-S1 ② 的论证口径）。`artifacts/issue424-*.log` 等历史文件继续受零 diff 保护。
- **逐行形状不在此 gate 判**（避免职责混杂），由 G13 唯一裁定点（§7.3）；G1′ 红 ⇔ 出现 allowlist 外文件。

**G3（ws-replication）**：tracked 判定由零 diff 改为 `tracked changed ⊆ {packages/ws-replication/package.json}`；untracked `⊆ WS_ALLOW_NEW_FILES`（4 文件，不变）。版本行形状同样由 G13 裁定。探针曾出现的 `packages/ws-replication/node_modules` symlink 噪声：根因是 gitignore `node_modules/`（带斜杠）不匹配 symlink；正式仓库布局中该位置是真实目录被忽略，不构成放行项——**allowlist 不为其开口**，若在正式运行中出现即按 unexpected 红（诚实上报环境问题，而非吸收）。

**G6**：**零改动**。其红是纯序列问题（manifest 未提交），由 §9 的提交时序闭合：release 文件形成 `chore(release)` 提交后 `git status --porcelain -- artifacts/` 为空、`git diff --check BASE` 无空白错误（manifest 由脚本确定性再生，无手工空白）。

**G2/G4/G5/G7–G12 语义全部不变**（src 零 diff、entry 文件零 diff、公共面快照、docs 零 diff、G8 无环境分支、G9 tsconfig 零 diff、G10/G11 扫描、G12 闭集纪律）。

### 7.3 新增 G13：release batch 审计（两态设计；修订吸收 SA2-2/SA2-3/SA2-8/SA2-10）

单一数据源：`gates.mjs` 顶部钉死 `RELEASE_BATCH = { base: BASE, versions: Map<7 个文件路径, {from, to}>, manifest: 'artifacts/local-packages/manifest.json', baselines: '<FACILITY_DIR>/baselines.json', frozenLedger: '<FACILITY_DIR>/root-test-known-red.json' }`（版本值取 §6.1 矩阵 / PV-3；**`base` 直接引用同一 `BASE` 常量而非二次钉串**，消除第二个可漂移钉值——修订吸收 SA2-10；票级钉值，随本票追认发布，下个 release 票重钉）。

判定（先 absent 后 exact，二者皆不满足即红）：

1. **absent 态**（预发布干净树，如设施提交 C1）：15 个 publishable manifest 的 `version` 逐个等于 BASE 树解析值，且 `manifest.json`、`root-test-known-red.json`、`baselines.json` 三者均与 BASE 逐字节相同，且满足 g 款全树条款（absent 允许集 = 4 个设施文件 + `wiki/raw/task_issue-472*.md`，**不含 8 个 release 文件**；untracked ⊆ `wiki/**`）→ PASS，detail 记 `state=absent`。
2. **exact 态**（release candidate `R`）：全部满足才 PASS，detail 记 `state=exact` + 7 项版本表：
   - a. 7 个 pinned 文件：working JSON 与 BASE JSON **深度相等（唯一例外 `version`）**，且 `version === to`，且 `git diff --no-renames BASE -- <file>` 的文本 diff **恰一行删 + 一行增**（删行 = `  "version": "<from>",`、增行 = `  "version": "<to>",`）——语义与字节形状双钉（PV-3）；**diff 口径（iteration 2 修订吸收 SA2-13）**：统一携带 `--no-renames`（单一原语纪律，见 g 款）——7 个 pinned 文件双树俱存、属修改型而非 rename 候选，该 flag 对其无操作，防的是条款间残留默认 rename 语义；
   - b. 其余 8 个 publishable `package.json`、根 `package.json`、`domains/vfs3-assets/package.json`、`pnpm-lock.yaml`：与 BASE 逐字节相同（b/d/e/f 的「逐字节」以读取 BASE blob 与工作树文件直接字节比对承载，不经过 rename 配对、天然免疫 SA2-13；若实现改用 diff 变体则必须同样携带 `--no-renames`——单一原语纪律见 g 款）；
   - c. `manifest.json`：解析后恰 15 键；对每个非 private 的 workspace manifest，filename === `<name 去 scope 连字符>-<该包 working version>.tgz`（与 `build-local-packages.mjs` L24 同一推导，gate 内自包含不 import catalog）；diff 口径按 **PV-4 numstat**：`git diff --no-renames --numstat BASE -- artifacts/local-packages/manifest.json` = **7 增 + 7 删**（7 个变更键，每键 1 行删 1 行增；携带 `--no-renames` 按单一原语纪律，对修改型形状无操作、numstat 与 PV-4 钉值逐字一致），且每个新增行均为 §6.1 目标 filename，无旧 filename 残留；
   - d. `root-test-known-red.json` 与 BASE 逐字节相同（**S4 冻结台账**：knownRed=4 + environmentRed=28 不得扩、不得缩、不得改 attribution；PV-5）；
   - e. `scripts/package-catalog.mjs` 与 BASE 逐字节相同（A5-2 唯一清单源；PV-5）；
   - f. **（修订吸收 SA2-3）`baselines.json` 与 BASE 逐字节相同**：三基线工件身份（B1/B2 integrity、B3 dshCommit——AC2/A2-1 的根基）的唯一定义源随批次钉死，杜绝「一个随 release 混入的 `baselines.json` 改动重定义工件身份且 13 gate 全绿」。**执行面归因更正**：该冻结的机械执行者是 **G13 本款 + `acquire.mjs` 的 integrity 复核（N-5 负控）**，**不是 G12**——G12 的 `FACILITY_ALLOW` 仍按 PV-6 保持 5 文件闭集（`baselines.json` 名义项自本票起为死条目，见 §7.5/D-9），终验不得以「G12 零 diff」作为该冻结面的执行依据（更正 SA8 冲突报告 §5 第 1 行的归因，见 §17/§18）；
   - g. **（修订吸收 SA2-2；iteration 2 修订吸收 SA2-13；iteration 3 修订吸收 SA9-3）全树变更集绑定**：tracked 判定原语显式钉为 **`git diff --no-renames --name-only BASE`**（无 pathspec 的全树 diff；等价实现 `git diff --no-renames --name-status BASE`——D/R/A 状态均按**两条路径**计入变更集；实现不得复用带默认 rename 语义的 `changedPaths()` 变体做本款全树判定）。其变更集 ⊆ **exact 允许集** = {C1 的 4 个设施文件：`gates.mjs`、`run-baseline.mjs`、`public-surface.base.json`、`cordis-public-surface.test.ts`（均相对 `FACILITY_DIR` / `packages/persistence/test/` 定位）} ∪ {PV-2 的 8 个 release 文件} ∪ {`wiki/raw/task_issue-472*.md`（C3 docs-only 面；**iteration 3 钉死机械判定——`isTicketDoc(p)` 必须 `path.posix.dirname(p) === 'wiki/raw'` ∧ basename 匹配 `/^task_issue-472.*\.md$/`。现实现（`gates.mjs` L128–L132）用 `posix.startsWith('wiki/')` + basename 正则，实际把 tracked 分量放宽到整个 `wiki/**`（`wiki/task_issue-472_probe.md`、`wiki/other/…`、`wiki/raw/nested/…` 均被放行），超出追认钉值 `wiki/raw/task_issue-472*.md`；remediation 收窄为 dirname 精确判定。此为**对齐钉值的收窄**，不是 allowlist 扩张（SA8 条件 8 禁的是扩张），untracked ⊆ `wiki/**` 分量保持不变**）}；`git status --porcelain` 的 untracked 项 ⊆ `wiki/**`（`.cache/`、`.worktrees/` 已 gitignored，天然不产生噪声）。**absent 态允许集（C1）= 上述集合去掉 8 个 release 文件（不含任何 release 文件）**。**rename 判定语义（SA2-13）**：改名在判定上等价于「**旧路径删除 + 新路径新增**」两条记录，两条都必须落在允许集内才可绿——把 gate 未覆盖、无字节钉死的 tracked 既有文件改名进 `wiki/**` glob（如 `.github/workflows/ci.yml` → `wiki/raw/task_issue-472_renamed.md`）时，新路径虽命中 glob，**旧路径删除不在允许集 ⇒ 红**。必须钉 `--no-renames` 的依据（本会话一手实证，SA2-13 同判）：默认 rename detection 会把改名折叠成单条新路径、隐藏被删旧路径（历史改名提交 `27e012b` 上 `git diff --name-only 27e012b^ 27e012b` 只列 `docs/adr/0032-…`，`--no-renames` 下 `0031-…`/`0032-…` 两路径均列；`diff.renames` 未设置，builtin 默认 true）——不携带该 flag 时「改名 ⇒ 红」对本款失实（fail-open，13 gate 全绿而未保护路径实际被删除）。**单一原语纪律**：本设计所有用于 allowlist/变更集裁定的 `git diff`（本 g 款全树变更集、a 款逐文件文本 diff、c 款 manifest numstat、§6.2 验证 1、§11 步骤 8 形状审计）一律携带 `--no-renames`，任何条款不得残留默认 rename 语义；既有 pathspec 限定 gate（`changedPaths()`，`gates.mjs` L134–L142，G1′/G2/G12）因 pathspec 外 add 候选被滤、rename 配对失败、旧路径以 D 呈现，不受该语义影响（SA2 §3 实测同判，无需改动）。**越界任何一项即红并指名文件**（删除/改名同样计入变更集 ⇒ 红，覆盖 T-7；**tracked wiki 分量越类（`wiki/` 根或更深层同名文件）同样指名判红**——F-L/F-M 负控，§10）。该条款把「`R` 相对 BASE 只允许版本行 + manifest + 设施文件 + docs-only 工件」从 final verification 手工步骤 8 的唯一执行面升级为机械绑定——**属收紧**（旧语义下此面无人执法），在 S1 已追认面内（SA2 §15.1 授权并入 PV 清单 = PV-8a，无需新裁决）；自此 11 个包的 `src/**`（G2 只覆盖 3 个 src 树）、全部非 facility 测试文件、`scripts/**`、`.github/**` 均落入机械执法面，步骤 8 保留为复核性双保险。`--no-renames` 语义由 SA2-13 修订补入：PV-8a 钉值语义「改名 ⇒ 红」不变，本 flag 是兑现该钉值的机械配方，不构成新决策面；wiki dirname 收窄由 SA9-3 修订补入：PV-8a 钉值原文（`wiki/raw/task_issue-472*.md`）不变，本判定是其精确兑现。
3. **任何其他形状 = 红**，逐条列出违规文件与原因（部分 bump、多余版本变化、依赖字段改动、manifest 陈旧/多余键、台账漂移、catalog 漂移、baselines.json 漂移、tracked/untracked 越界变更、**改名把允许集外旧路径折进允许集内新路径**（g 款 `--no-renames` 判定：旧路径删除不在允许集）…）。

两态的意义：absent 使设施提交 C1 自身 gate 语义自洽（此时树 = BASE + 仅设施 diff + docs-only 工件，G13 无可审的 release 面）；exact 是 `R` 的唯一合法 release 形状。**AC 证据只认 exact 态树上的矩阵**（§11、§16；`publish:verify` 在 absent 态树上必红，两种绿无法互相抵销，SA6 §12.0.1）。gate 总数 12→13；矩阵 gates cell 仍为 1 个 cell，41-cell 结构不变（PV-6；对 SA6 A1-6「12/12 或扩展后的等价 gate 数」的落实）。

### 7.4 证据 fail-closed 审计（D13 / N-6…N-10）落在 `run-baseline.mjs`（修订吸收 SA2-1/SA2-4/SA2-7/SA2-12；**iteration 3 修订吸收 SA9-1/SA9-4/SA9-5：W-1 working-tree 指纹原语 + W-3 审计结果可机判落盘 + W-4 缺目录 guard 复活**）

新增两处（同文件内，`--audit-evidence` 独立模式 + `--all --matrix` 内置收尾审计）：

**run-marker 与 W-1 指纹原语（iteration 3 修订吸收 SA9-1）**：`--all --matrix` 启动时（任何 cell 生产前）写 `.cache/cordis-baselines/evidence/run-marker.json`：`{ startedAt, head: git rev-parse HEAD, worktree: trackedWorktreeFingerprint(), porcelain: git status --porcelain }`。这是 SA6 §12.0.2「本轮开始 marker」的落地，同时把证据绑到唯一候选树（§12.0.1）。**`tree` 字段（index `git write-tree`）自 iteration 3 起移除**——它绑定的是 Git index，而矩阵被测内容来自 working tree（`copyTrackedTree` L251–L260 逐 `git ls-files` 路径 `fs.copyFileSync`），未暂存的 tracked 修改不进 index，故 index tree 相同不代表被复制/执行的内容相同（SA9-1；iteration 1/2 把 `git write-tree` 比对写作「工作树漂移校验」是错误归因，D-11 已更正）；单一字段、单一语义，杜绝第二个「tree」读法。`porcelain` 仍为披露面。

**W-1 `trackedWorktreeFingerprint()`（新增 helper，run-baseline.mjs 内，两处调用：`writeRunMarker` 与审计检查 1）**：

```js
function trackedWorktreeFingerprint() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'issue472-wt-fp-'))
  try {
    const env = { ...process.env, GIT_INDEX_FILE: path.join(tmp, 'index') }
    execFileSync('git', ['read-tree', 'HEAD'], { cwd: REPO, env })   // 文件集 = HEAD tracked 集
    execFileSync('git', ['add', '-u'], { cwd: REPO, env })           // 内容 = working tree；untracked 不入（-u 只更新 index 既有条目）
    return execFileSync('git', ['write-tree'], { cwd: REPO, env, encoding: 'utf8' }).trim()
  } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
}
```

- **确定性**：产出是 tracked working-tree 内容的 tree OID（git 2.43.0 本轮实测：当前树 `59a60b0f…` ≠ HEAD tree `b898d119…`，差源恰为唯一未暂存 tracked 修改 `wiki/raw/task_issue-472_dispatch.md`；真实 index 的 `git write-tree` 则 = HEAD tree——旧 marker 失效模式当场复现）。`add -u` 只更新临时 index 既有条目 ⇒ untracked wiki 工件**天然排除**；tracked 文件被删除 ⇒ 删除被暂存 ⇒ 指纹变化（与 `copyTrackedTree` 跳过缺失文件的行为一致）；同一进程 env 内两次调用（marker 时与审计时）git config/filters 相同 ⇒ 差异只能来自内容本身。临时 index 位于 `os.tmpdir()`，`finally` 删除；`write-tree` 只向 `.git/objects` 写入无引用 tree 对象（不改 HEAD/ref/真实 index，可重复执行）。
- **与 `--no-renames` / PV-8a 的关系**：指纹是**内容树构建**（read-tree/add/write-tree），不是 diff——rename detection 概念上不适用；G13.g 的 `git diff --no-renames --name-only BASE`（形状执法面）保持单一原语纪律不变。两者互补：G13.g 裁「相对 BASE 的变更形状」，指纹裁「marker 时刻与审计时刻之间被测内容是否漂移」，PV-8a 钉值不受影响。
- **R 验证时的期望值语义**：干净 checkout 上（无未暂存 tracked 修改）`worktree === 该提交的 tree OID`——remediation 后在 R′（= C4）上终验时，`marker.worktree` 必须等于 **R′ 的实际内容树**（matrix.json 的 `runWorktree` 同源交叉核对），**不得把 BASE tree `b41d9e73…` 或任何「HEAD tree」当内容绑定**；运行树含未暂存 tracked 修改时指纹如实偏离 HEAD tree 并在审计/负控中判红（N-8e/N-8f）。历史注记：round 1 的 C1 矩阵 marker 记 `tree=b41d9e73…`（= BASE tree）而 C1 四文件当时未提交——该轮的「单树绑定」未绑定实际被测内容；重跑 C1 等价控制时指纹必须对应实际 C1 内容树 `da3f368f…`。
- **字段改名连带**：`matrix.json` 的 `runTree` → **`runWorktree`**（= `marker.worktree`，审计检查 5 的交叉核对同步改字段名）；`writeRunMarker` 后的 console 行改打 `head=<12> worktree=<12> startedAt=<…>`；审计检查 1 的 marker 字段必备清单 `{startedAt, head, worktree, porcelain}`。

**审计检查**（`auditEvidence()`，缺一即 exit 1，problems 数组全量打印 + **W-3 结构化 RESULT 行落盘**，见下）：
1. marker 存在且可解析；standalone 模式下当前 `git rev-parse HEAD` === `marker.head`（否则「证据来自另一棵树」红——跨轮/跨树混用的树级判定；**N-8g 实证「同指纹、HEAD 移动」仍红，两个绑定相互独立**）；**两种模式下均比对 `trackedWorktreeFingerprint() === marker.worktree`**（否则「tracked working-tree content drifted during the run: marker.worktree=<X> current=<Y>」红——矩阵运行中被测内容的未暂存漂移自此有机械红点，SA2 §7 T-4 / SA9-1；**N-8e/N-8f 实证**）；
2. 必需 cell 集完整：**39 个 baseline cell** = `evidence/<B1|B2|B3>/<suite>.json`，suite ∈ {typecheck + 12 suites}（**文件名不带基线前缀**——`writeEvidence()` L545–L550 以 `<suite>.json` 落盘，iteration 0 稿的 `<B>-<suite>.json` 写法与实盘不符，已更正）+ `evidence/gates/gates.json` + `evidence/root-test/root-test.json` + `evidence/matrix/matrix.json` 全部存在、可解析、`status === 'pass'`；`baseline/suite` 字段与所在目录/文件名一致（gates/root-test cell 的 `baseline` 为 `'default'`，按 `suite` 归位校验，不算前缀错配）；
3. **digest 期望分三类（修订吸收 SA2-1，钉死实盘现状而非泛化规则）**：39 个 baseline cell 逐个 `cell.provenanceDigest === provenanceDigestFor(cell.baseline)`；**gates cell（`baseline='default'`）期望 `provenanceDigestFor('B3')`**；**root-test cell（`baseline='default'`）期望 `provenanceDigestFor('B1')`**——两特例沿用 `run-baseline.mjs` L881/L992 现值（runner 零改动），任何 B2/B3 摘要互换仍被名集级判红（N-8 的注入面不变）；
4. **新鲜度**：所有必需证据文件 mtime ≥ marker mtime（marker 先写；过期/跨轮文件红）；`matrix.json.generatedAt ≥ marker.startedAt`；
5. `matrix.json` 恰 41 cells 且 (baseline, suite) 多重集与期望一致、全 pass；root-test cell `failedUnexpected === []` 且 counts 为有限正数（复用 cell 内既有判定字段）；
6. **logPath 判定（修订吸收 SA2-4）**：每 cell 记录的 `logPath`（及 repeat/file 级 log 与 vitest JSON 路径——typecheck cell 的 15 个 per-project log、real-timer/ws-cordis-timers/replication-lifecycle 的 repeat1–3、guard-proxy/composition-root 的 per-file 件、root-probe 的 `.mjs.log`）必须三判全过：(a) 文件存在；(b) `path.resolve` 后仍位于 `evidence/` 根之内（拒绝 `..` 逃逸、跨目录引用与指向外部的绝对路径）；(c) mtime ≥ marker；
7. **目录纪律——精确允许清单（修订吸收 SA2-1，与实盘 96 文件布局逐项对账）**：`evidence/` 顶层只允许 `B1/`、`B2/`、`B3/`、`gates/`、`root-test/`、`matrix/`、`tmp/`（目录）与 `run-marker.json`；`evidence/<B>/` 内逐文件判定，只允许以下六类，越类即红并指名文件：
   - ① 13 个 cell JSON：`{typecheck, provenance, root-probe, contract, real-timer, dsh-profile, unload, ws-package, guard-proxy, ws-cordis-channel, ws-cordis-timers, replication-lifecycle, composition-root}.json`（必需集，检查 2 已判 pass）；
   - ② 聚合件：`<B>-typecheck.json`（typecheck cell 的 `logPath` 所指，实盘必有）；
   - ③ `<B>-*.log`（覆盖 suite log、`<B>-typecheck-<project 把 / 与 . 换成 _>.log` ×15、guard-proxy/composition-root 的 per-file log、`<B>-root-probe.mjs.log`）；
   - ④ `<B>-*.vitest.json`（含 `-repeatN.vitest.json` 与 per-file vitest JSON）；
   - ⑤ `fault-*.json`（fault cell JSON）；
   - ⑥ `fault-*/` 目录：**递归 walk，目录内只容 `*.log` 与 `*.vitest.json` 两类**（实盘 `B3-root-probe.mjs.log` 由 `*.log` 类覆盖），出现其他后缀或嵌套子目录即红。
   `gates/` 只容 `{gates.json, gates.log}`；`root-test/` 只容 `{root-test.json, root-test.log, root-test.vitest.json}`；`matrix/` 只容 `matrix.json`；`tmp/` 是 `runVitest` 的默认 evidenceDir 兜底（L447，`--all --matrix` 正常路径不落盘），不参与必需集，但**不得被任何必需 cell 的 logPath 引用**（检查 6 的 containment 判定会拒绝）。**相容性验收（SA2-1 acceptance）**：实现后在 HEAD 干净树重跑 `--all --matrix`，内置审计必须 exit 0 且 problems 为空（干净矩阵零假红）；随后按 N-6/N-6b/N-7/N-7b/N-8a–d 注入仍逐项 exit 1。任何为消红而进一步放宽允许类的改动都必须回到 SA8 追认（SA6 §10.2 原文纪律）。

矩阵主流程在写完 `matrix.json` 后调用同一函数，审计红 ⇒ `MATRIX FAIL` exit 1（绿 cell 不抵销审计红）。**审计不提供 `--evidence-dir` 之类的重定向参数**：负控直接在规范目录上「备份 → 污染 → 审计红 → 还原」，全程留 log（防"审计一份干净副本冒充档案"的 fail-open 面）。

**W-3 审计结果可机判落盘（iteration 3 修订吸收 SA9-4）**：`printAudit()` 在**成功与失败两条路径**都先输出一行结构化结果再输出人读行：

```
[run-baseline] EVIDENCE AUDIT RESULT (<context>): exit=<0|1> problems=<JSON 数组>
```

- 成功：`… exit=0 problems=[]`（显式空列表字面量，非自述 PASS）；失败：`… exit=1 problems=["…","…"]`（`JSON.stringify(problems)`，problem 均为单行消息，数组恒为一行可 `JSON.parse` 的 JSON），随后保留既有逐条 `  - <problem>` 明细与人读 PASS/FAIL 行。`<context>` ∈ {`built-in matrix audit`, `standalone --audit-evidence`}；exit code 语义不变（0/1）。
- **落盘位置 = 既有日志通道，不新增 artifact**：内置模式的 stdout 进矩阵运行日志（如 `.cache/issue-472-final/02-matrix-all.log` 一类重定向文件），standalone 模式进其日志（如 `audit-standalone-final.log`）；条件 9 的判定自此可机判——「每次审计恰一行 RESULT、成功行含字面量 `problems=[]`、exit code 与 `.exit` 文件/`$?` 一致」。**不新增 JSON 落盘文件** ⇒ `evidence/` 目录允许集（检查 7）零改动、无新越类文件、无需为工件目录扩集再追认；N 系负控经同一 `printAudit` 自动显示非空数组（不存在「装饰性空 `[]`」路径——失败路径的数组就是判红依据本身）。

**W-4 standalone 缺目录 guard 复活 + 死代码清理（iteration 3 修订吸收 SA9-5.3）**：现实现 `main()` 头部 `mkdirp(EVIDENCE)`（L1466）使 `auditEvidence()` 的「missing evidence directory」分支（L1377–L1379）不可达。remediation：**删除 `main()` 头部的 `mkdirp(EVIDENCE)`**——`writeRunMarker()`（L1072）、`writeEvidence()`（L563）、`runGatesCell()`（L889）、`runRootTestCell()`（L922）各自 mkdir 所需目录，删除后无调用路径依赖该预创建；standalone `--audit-evidence` 在 `evidence/` 不存在时到达 guard ⇒ problems 非空（`missing evidence directory: … (a matrix run without evidence is never a pass)`）⇒ W-3 RESULT 行显示非空数组 ⇒ exit 1（响亮红，不是「目录缺了被静默建空目录后按 missing cell 红」的含混语义）。**N-10 负控**实证：一次性副本上移走 `evidence/` → standalone exit 1 且指名该 problem；空目录变体同样红（missing run marker + 41 个 missing cell）。

**mtime 威胁模型（修订吸收 SA2-12；iteration 3 注记指纹的对应边界）**：检查 4 防的是**意外**过期/跨轮混用（上一轮残留、缓存复用、中途换树），**不防对抗性伪造**——同时回拨 marker 与 cell 的 mtime 可令检查 4 反向放行（N-8a 只回拨 cell 不回拨 marker，故仍红）。对抗面的承担者是：marker.head 单树绑定（检查 1）+ **W-1 指纹比对** + final verification 在 `R` 上的独立重跑（§11——AC 证据一律以终验轮为准，攻击者伪造的实现期证据会被终验重跑覆盖）；指纹同理防**意外**内容漂移，不防「marker 与工作树内容被协同伪造」的对抗面（对抗面仍是终验独立重跑）。可选加固「`matrix.generatedAt − marker.startedAt` 差值上限」**不采纳**，理由：任意常数在长矩阵运行下有假红风险，对「小步回拨」无实质增益，且该威胁已由上述对抗面承担；如威胁模型升级再随新票裁决。

### 7.5 G12 allowlist 的精确 delta 与理由

| 情形 | delta | 理由 |
|---|---|---|
| 方案 A（推荐，S3 采纳） | `FACILITY_ALLOW` 4 → **5**：`+ packages/persistence/test/fixtures/cordis-baselines/public-surface.base.json`；同步更新 G12 detail 文案（"acquire/root-probe/provenance-b3 zero-diff"） | 快照必须在新 BASE 按 7 entry 重捕（§8），该文件是快照本体；G12 若不开口，正确的快照修正反被己方 gate 判红——与本票 G1′/G3 面临的是同一类"正确 diff 被零 diff 语义误伤"，解法同为**精确单文件开口**而非放松闭集纪律 |
| 方案 B（回退） | **零 delta** | 快照与测试均不动，只改 release 记录文本 |

除上述外，G12 闭集不扩：证据审计放 `run-baseline.mjs`（已在 allowlist），不新增 facility 文件；`acquire.mjs`/`root-probe.mjs`/`provenance-b3.json`/`baselines.json` 继续零 diff。**任何"为了让 gate 绿而扩 allowlist"的进一步改动都必须回到 SA8 追认**（SA6 §10.2 G12 约束原文）。

**修订吸收（SA2-3，与 D-9 配套）**：`FACILITY_ALLOW` 保持 PV-6 的 **5 文件闭集**不变；其中 `baselines.json` 名义项自本票起为**死条目**——BASE 重钉后 C1/C2 对它均无合法 diff 需求，其批次级冻结的实际执行者是 **G13.f 逐字节钉死 + acquire.mjs integrity 复核（N-5）**，不再是「G12 零 diff」。不采用「从闭集移除」的替代方案（理由见 D-9：避免第二次改动 #471 已批准的 G12 闭集组成；两方案执法效果等价）。G12 的 detail 文案随实现同步更正为「acquire/root-probe/provenance-b3 zero-diff；baselines.json 的批次冻结由 G13 执行」，消除「G12 允许其 diff」与「该面被 G12 把关」的误读空间（更正对象含 SA8 冲突报告 §5 第 1 行的归因表述——SA8 已以 §12 勘误 E-1 即时更正并加条件 10，终验不得依赖该原表述；本设计按实码书写与之逐字一致）。

---

## 8. 决策 3（dispatch 项 3）：4→7 public entry 快照的处置

**结论：方案 A（补齐 7-entry），并修正记录**（S3 推荐；owner/SA8 否决则按 B 回退）。

**落点**（三个文件必须同一次设施提交内一致变更，否则 G5/G12 互斥）：
1. `gates.mjs` `PUBLIC_ENTRIES` 4 → 7，新增：
   - `['@nomicore/ws-replication/testing', 'packages/ws-replication/src/testing.ts']`（`exports['./testing']` 本轮实测存在，`nomicore-source` 条件 → src）；
   - `['@nomicore/clock', 'packages/clock/src/index.ts']`；
   - `['@nomicore/namespace-registry', 'packages/namespace-registry/src/index.ts']`；
2. BASE 重钉后运行 `node gates.mjs --write-surface-snapshot` 在 `6be891a` 基线上重捕 → `public-surface.base.json` 变为 7 键（捕获机制不变：base worktree + 符号链接 farm + tsx + `nomicore-source`；三个新 entry 的传递依赖均在 farm/alias 解析面内，本轮核实 `vitest.config.ts` 的 `@nomicore/*` 通配 alias 与各 entry 的 import 面）；
3. `cordis-public-surface.test.ts` `ENTRIES` 4 → 7（相对路径加载：`../../clock/src/index.js` 等，与既有 dsh-persistence 同法），断言「快照键集合 === ENTRIES」的测试与描述文案同步改 7；**describe 文案中的旧捕获串一并更正**（现文本 `vs base 279dba4 捕获` 在 `6be891a` 重捕后失真——改为不钉具体 sha 的表述如「vs BASE 快照捕获」，修订吸收 SA2-9）。

**连锁影响**：
- **G5**：比较面 4 → 7 entry（detail 文案 `4 entries` 改为动态数）；absent 态树（C1）上 working entry 导出与 BASE 相同 → 绿；exact 态树（R）同理（release 不改 src）。
- **G12**：精确 +1（§7.5）。
- **root-test / CI**：surface 测试属 `pnpm test` 与 root-test cell 的一部分，测试数 +3（5 → 8 个 it）；`numTotalTests` 相应变化，final verification 按**实际 counts 原样记录**（台账按名集判红，不受计数变化影响；S4 披露口径不变）。
- **release 记录（AC4/A4-5；修订吸收 SA2-8——逐字采用 SA8 §8.2 条件 4 的两分文案，iteration 0 稿的单一修正口径作废）**：`chore(release)` 正文、AC6 回填与 SA10 产物统一表述——「#471 提交 `caede8a` 所称『公共 entry 导出名集合由 4 扩到 7』在快照/测试文件层面未发生（树内仍为 4 entry），其覆盖由 #471 以 3 条 runtime 严格相等断言等价承载（SA10 记录 7/7）；7-entry **快照**由 #472 设施提交落地，现快照与记录一致」。**不得**宣称 #471 已交付 7-entry 快照，也**不得**宣称 #471 未做任何公共面覆盖扩展（后者与 SA10 L219–L221 的等价承载记录不符，同样违反 A4-5）；不得改写 `caede8a` 或任何历史 wiki 工件。

**方案 B（回退）**：快照/测试/G12 均不动；release 记录写「公共 entry 快照为 4-entry（persistence/persistence-testing/dsh-persistence/ws-replication），clock/namespace-registry/ws-replication-testing 的公共面冻结以 `git diff 19df983..R` 零 diff + guard-proxy/unload suite 三基线绿为证据」——且仍须包含条件 4 两分文案中关于 #471 以 3 条 runtime 断言等价承载 7/7 覆盖的表述（不得宣称 #471 未做覆盖扩展），并如实写明 7-entry 快照未由 #472 落地。文件范围相应删去两文件（§14 注 B）。

---

## 9. 决策 4（dispatch 项 4）：提交时序（Controller 按文件级 ALLOW 精确暂存并建本地 commit）

**C1 — 设施提交**（先行；其上 gates 13/13 绿、G13 `state=absent`）：
- 文件：`gates.mjs`、`run-baseline.mjs`、`public-surface.base.json`、`cordis-public-surface.test.ts`（后两者仅方案 A）
- 建议：`test(fixtures): #472 release 门禁与证据审计扩展（BASE 6be891a + G13 + 7-entry 快照）`
- 时序内含：重捕快照须在 BASE 重钉之后的 C1 工作树上执行（捕获读的是 BASE worktree，与工作树版本无关；absent 态满足 G13）。

**C2 — release 提交**（`R` 的定义；其上 gates 13/13 绿、G13 `state=exact`、G6 干净）：
- 文件：7 个 `package.json`（各 1 行）+ `artifacts/local-packages/manifest.json`（7 行）
- 建议：`chore(release): Nomicore 0.5.0 —— Cordis rc.12 双形态 Root 三基线收官批次`，正文按 A4-3 ①–⑩ 骨架（§16 映射）：
  ① 版本矩阵 + 闭包理由（§6.1 表原文）；② 内容（#470/#471 双形态 Root seam，公共 API/schema/wire/服务名/持久化布局零变化）；③ AC1 结果（3×15 typecheck + 41/41 矩阵，含 gates 13/13 与 G13 state=exact）；④ AC2 工件身份/provenanceDigest `9d663355…`/通道（B1/B2 legacy、B3 symbol）/负控结果；⑤ AC3 pack/publish:verify/publish:reproducible 结果；⑥ AC4 公共契约冻结五项证据（含 7-entry 快照与 #471 记录的**两分修正文案**——§8 逐字版本，S3 条件 4）；⑦ known-red 披露（4 test-d + 固定 pnpm 后的实际环境红数；不宣称全绿）；⑧ 非目标（无真实 MABF/DSH 部署、无 patch 移除、未执行 npm publish）；⑨ 不复用 #464–#466 证据；⑩ toolchain（node/pnpm/tsc/vitest 版本）与 `R` 的 HEAD/tree hash。
- 版本编辑 → `pack:local`（固定 10.28.2）→ manifest 再生 → `publish:verify`/`publish:reproducible` 预检 → lockfile 零 diff 复核 → 暂存 8 文件提交；**manifest 与版本必须同一提交**（G6 的 artifacts-clean 与 A4-2 的收敛性都以此为前提）。

**C3 — 证据/回填归档**（final verification 之后，docs-only）：`docs(wiki): #472 最终验证与回填证据`——**入库范围枚举为 `wiki/raw/task_issue-472*.md` 全集（修订吸收 SA2-6，与 #470/#471 的 `docs(wiki)` 惯例一致）**：brief（`task_issue-472.md`）、dispatch 台账（`task_issue-472_dispatch.md`）、SA6 契约（`task_issue-472_sa6_acceptance_contract.md`）、本设计（`task_issue-472_design.md`）、SA8 冲突报告（`task_issue-472_design_conflict_report.md`）、SA2 评审（`task_issue-472_sa2_review.md`）、`task_issue-472_sa10_spec.md` 及后续轮新增的同前缀产物；既有历史 `wiki/raw/**` 不改写，只新增。`.cache/**` 保持 gitignored 不入库，wiki 产物记录其路径与摘要。GitHub 回填（AC6：#472 评论、集成 PR 正文/评论、#468 仅追加评论；含 S2 版本矩阵读法与 S3 方案 A 选择的知会性披露——SA8 条件 7）在 final verification 绿后执行，不属提交序列。

每步自洽性（红点归因按 SA2 §6 精确化）：C1 上 absent 合法（release 面未动）；仅编辑 7 个 version 行而未再生 manifest 的中间态，**G6 仍绿**（`artifacts/` 未 dirty）而 **G13 红**（absent 失败：version ≠ BASE；exact 失败：manifest 交叉检查不过）；再生 manifest 后未提交时 **G6 红**（artifacts dirty）且 G13 exact 可过形状——组合效果「两步之间无合法半 release 态」由 G13+G6 联合闭合，任何拆分/乱序都会被 gate 如实判红。

### 9.1 终审 remediation 追加时序（iteration 3；append-only，不改写已交付提交）

（编号说明：上文 C1/C2/C3 三个粗体段落即全文交叉引用所指的「§9.2 记录文本」与「§9.3 回填时序」锚点；本节与 §9.4 为 iteration 3 新增的编号小节。）round 1 已交付 C1 `1198312` / C2 = R `e3d5881` / C3a `d5cf485` 且终审组 reject；remediation 在其上**追加**三个提交（**禁止 rebase/amend 改写既有提交**——终审报告与 dispatch 台账引用这三个 hash 作锚点，改写即销毁可复核性；也不改写任何历史 wiki 工件）：

- **C4 — 设施 remediation 提交**（`test(fixtures): #472 终审 remediation——working-tree 指纹 + wiki/raw 收窄 + 审计可机判落盘`）：文件恰为 `gates.mjs` + `run-baseline.mjs` 两个设施文件（4 个 C1 设施文件中的 2 个；快照与 surface 测试零改动）。内容 = W-1（`trackedWorktreeFingerprint()` + marker/审计/matrix 字段切换）、W-2（`isTicketDoc` dirname 收窄）、W-3（RESULT 行）、W-4（`main()` 头部 `mkdirp` 删除 + gates.mjs L5/L7 头注与 run-baseline.mjs L901–L903 注释对齐实际语义，SA9-5.1/5.2）。C4 提交前在同一工作树上先跑新负控（F-L/F-M、N-8e/N-8f/N-8g、N-10 于一次性副本；T-1/T-2 于打包输出一次性副本，§10/§11.1）应红实红，随后 C4 树上 gates 13/13（G13 `state=exact`——release 文件自 C2 已在树内）。**C4 的 tree 即新的 release candidate `R′`**：AC1–AC4 证据全部重新绑定 R′（§11.1），旧树（`e3d5881`/`d5cf485`）上的绿**不得沿用**（SA10 B-2 闭合判据原文）。
- **C5 — 记录更正提交**（`chore(release): #472 变更记录更正——pnpm 口径两分与 R′ 身份再绑定`）：**message-only（`git commit --allow-empty`，零文件变更）**——仓库无 `CHANGELOG.md` 且不得新造（S2 触发器），变更记录的既有载体就是 `chore(release)` 提交正文，更正记录只能以同类型提交追加。正文必须包含（W-7，闭合 B-2）：① **口径两分**——「未固定 PATH（默认 shell pnpm 11.28.5）」口径：round 1 实现轮 C1 矩阵 `5959/5991`（32 = 4 frozen + 28 environment）与 SA7 终验 R 矩阵 `5959/5991` 同口径；「固定 pnpm 10.28.2」口径：实现轮 C2 预验 `5987/5991`（4 frozen）与 **remediation 后在 R′ 上按 §11.1 重跑的实际 counts（原样记录）**；并更正 C2 正文 ⑦「固定 pnpm 10.28.2 下 …（C1 5959/5991、C2 预验 5987/5991）」的混同归因与 SA7「非判据偏离」的分类（SA9-2 闭合判据）；② **R′ 身份**——当前 release candidate 的完整 HEAD（= C4 hash）与 tree（= C4 tree OID；两者在撰写 C5 正文时均为已知事实，无自指问题），并声明 AC1–AC4 证据绑定 R′、旧树绿作废；③ 保持 A4-3 ①–⑩ 其余各条不变引用（两分文案等条件 4 内容原样）。
- **C6 — 证据归档提交**（`docs(wiki): #472 终审 remediation 证据与 dispatch 台账`）：入库范围仍为 `wiki/raw/task_issue-472*.md` glob（本设计 rev3、`task_issue-472_sa9_standards.md`、`task_issue-472_sa10_spec.md`、dispatch 台账增量及后续同前缀产物）；`.cache/**` 保持 gitignored，wiki 产物记录其路径与摘要。C6 后重跑一次 gates 全量（13/13，G13 exact——wiki 增量仍在允许集内）收尾。
- **顺序与依赖**：C4（设施）→ §11.1 复验协议全量重跑（绑 C4 = R′）→ C5（记录更正，引用 R′ 身份与重跑实际值）→ 重新进入终审组（SA9/SA10 对最终状态重裁）→ C6（证据归档）。C5 必须晚于复验协议（正文要引用重跑实际 counts）；C6 必须晚于终审组重裁或与其并行后按终审结论补齐。**文件级 ALLOW 见 §14**：remediation 期间预计仍为 4 个 facility 文件中的 2 个（`gates.mjs`、`run-baseline.mjs`）+ 必要证据/记录（wiki glob + `.cache/**` gitignored 运行日志）；7 个 release `package.json`、manifest、lockfile、`scripts/**`、`.github/**`、台账/catalog/baselines.json **零新改动**。

### 9.4 回填证据包与职责边界（iteration 3；B-4 的设计面闭环）

B-4（#472 评论、`mabf/issue-472 → spec/468-cordis-rc12-root` 集成 PR、Parent PR #469 结果评论均未执行）**不由本设计或任何 SA 执行**——SA10 §6 B-4 判定由「有权限的后续 Controller/Owner」在 final verification 绿且 B-1…B-3 闭合后执行；GitHub 写操作不在 SA 权限面（本角色硬边界）。设计只固定**回填内容与触发条件**：

- **触发条件**：§11.1 复验协议全绿 + C4/C5 落盘 + 终审组（SA9/SA10）对 remediation 后状态改判 approve。
- **回填证据包（同一组内容投放到 #472 评论与集成 PR，#469 仅追加结果评论）**：3×15 typecheck 全绿；41/41 矩阵（gates 13/13、G13 exact、审计 RESULT `problems=[]`、root-test 固定 pnpm 口径的实际 counts 与 `failedUnexpected=[]`、`pnpmProbe.exitCode=0`）；工件身份（B1/B2/B3 版本 + DSH `1511a6e…` + B3 provenanceDigest `9d663355…`）与 Root 通道（B1/B2 legacy / B3 symbol）；fault ×4 与 N-5…N-10 负控应红实红摘要；**tarball 负控 T-1/T-2 应红实红 + 恢复后 15/15 三连绿**；15 包 pack/verify（默认模式）/reproducible 结果与 sha256 表；七包版本表 + manifest 7+7 + R′ HEAD/tree；公共契约冻结五项；非目标声明（无部署/无 patch 移除/未真实发布）；#464–#466 不复用声明；S2 版本矩阵读法与 S3 方案 A 选择的知会性披露（SA8 条件 7）；工具链（node/pnpm 10.28.2/tsc/vitest）。
- **边界与保护面**：#468 保持 open 且 Parent 仍为 PR #469（只追加评论）；#464–#466 保持撤回；操作前后各留 `gh api` JSON 快照（issues/472/comments、pr list、issues/468）；wiki 内部记录不替代回填（SA6 §12.6）。

---

## 10. 决策 5（dispatch 项 6）：TDD 红灯方案

**红灯 1 —— 真实发布门禁红（已捕获，本票的因果起点）**：HEAD 上 `pnpm pack:local`（10.28.2）exit 0 后 `pnpm publish:verify` **exit 1**，恰 2 个 integrity mismatch（`.cache/sa6-472/publish-verify-head.log` 在盘，SA1 复核）。实现开始时先在未 bump 的 HEAD 重捕一次同款红（同轮证据纪律），随后版本闭包落地使其转绿——红→绿的因果可复核。

**红灯 2 —— 设施扩展自身的 falsification（先证不会 fail-open，再宣告绿）**：在 C1 设施代码就绪后、宣告任何绿之前，于一次性副本（`.worktrees/` 下 disposable worktree 或 `.cache/issue-472-impl/` 副本；负控后删除，仅留 log）逐项注入并记录**必须真红**：

| # | 注入 | 期望红点 |
|---|---|---|
| F-A | 第 8 个包（如 clock 0.2.0→0.2.1）bump | G13 exact 失败（unexpected version change）+ G1′（若非 7 文件集内） |
| F-B | 7 文件之一改依赖 range（如 `@deepseek-ai/cordis: ^4.0.1 → ^4.1.0`） | G13 深度相等失败 + 文本 diff 行数 ≠ 1 |
| F-C | manifest 保留一个旧 filename | G13 manifest 交叉检查红 + `publish:verify` filename↔version 红 |
| F-D | bump 后未再生 manifest | G6 artifacts dirty（提交前）+ `publish:verify` 红 + G13 exact 红 |
| F-E | 台账加一个新红名 | G13 台账逐字节比较红（S4） |
| **F-F**（修订吸收 SA2-4） | 仅 bump 7 之 3（如 persistence/dsh-persistence/namespace-runtime）并再生 manifest | G13 两态皆失败（absent：3 文件 version ≠ BASE；exact：4 个 pinned 文件 version ≠ to）⇒ gates 红；**G1′ 仍绿**（全部变更 ⊆ 8 文件白名单）——证明部分 bump 的唯一红点是 G13（SA2 §7 T-1） |
| **F-G**（修订吸收 SA2-4） | C2 提交后把 `packages/persistence/package.json` 单独回退为 `0.4.0`（manifest 不再生） | absent 失败（6 文件异于 BASE）∧ exact 失败（persistence version ≠ 0.5.0 ∧ manifest filename 交叉检查红）⇒ G13 红（SA2 §7 T-2——**absent 分支的首次红灯实证**） |
| **F-H**（修订吸收 SA2-2） | 在实现树给 `packages/clock/src/system.ts` 加一行注释 | **G13.g 全树条款红并指名文件**；G1′/G2/G4 全绿——证明 G2 pathspec 外的 11 包 src 树已入机械执法面（SA2-2 acceptance） |
| **F-I**（修订吸收 SA2-2） | 在实现树给 `scripts/create-publish-manifest.mjs` 与 `.github/workflows/ci.yml` 各加一行注释 | G13.g 全树条款红并指名两文件（`scripts/**`、`.github/**` 面与 src 面同判） |
| **F-J**（修订吸收 SA2-3） | `baselines.json` 单字节改动（如 B1 cordis integrity 尾位） | **G13.f 逐字节比较红**（G12 的 FACILITY_ALLOW 名义放行**不救**）；对照：干净 C1/C2 树上 13/13 绿（SA2-3 acceptance） |
| **F-K**（iteration 2 修订吸收 SA2-13） | 在实现树一次性副本上 `git mv .github/workflows/ci.yml wiki/raw/task_issue-472_renamed.md`（把 gate 未覆盖、无字节钉死的 tracked 既有文件改名进 `wiki/**` glob；或同类「包 src / 测试文件 → wiki glob」改名） | **G13.g 红并指名被删旧路径 `.github/workflows/ci.yml`**（`--no-renames` 原语下改名 = 旧路径删除 + 新路径新增，旧路径不在允许集；新路径虽命中 glob 不救）；G1′/G2/G4/G12 同时仍绿（红点唯一 G13.g——默认 rename detection 下 `--name-only` 只见 glob 内新路径、13 gate 全绿的 fail-open 洞自此有红灯实证）；对照：干净 C1/C2 树 13/13 绿不回归（SA2-13 acceptance） |
| **F-L**（iteration 3 修订吸收 SA9-3） | 一次性副本上新建 `wiki/task_issue-472_probe.md` 并 `git add`（**必须 staged**——不 add 会落入本就允许的 untracked ⊆ `wiki/**` 规则，不构成 tracked 分量注入） | **G13.g 红并指名 `wiki/task_issue-472_probe.md`**（W-2 收窄后：直接父目录 ≠ `wiki/raw` ⇒ tracked 越界；旧实现 `startsWith('wiki/')` 会放行——fail-open 洞的红灯实证）；G1′/G2/G4/G12 仍绿（该路径不在其 pathspec）；对照：C3 已交付的 `wiki/raw/task_issue-472*.md` 全部保持绿（正向控制不回归） |
| **F-M**（iteration 3 修订吸收 SA9-3） | 一次性副本上新建 `wiki/raw/nested/task_issue-472_probe.md` 并 `git add`（更深层同名文件；`wiki/other/…` 变体同判） | **G13.g 红并指名 `wiki/raw/nested/task_issue-472_probe.md`**（basename 匹配但父目录是 `wiki/raw/nested` ≠ `wiki/raw` ⇒ tracked 越界）；其余 gate 仍绿；对照同 F-L |
| N-6 | 删除任一必需 cell JSON | 审计 exit 1（missing） |
| **N-6b**（修订吸收 SA2-4） | 改写某 cell 的 `logPath` 为不存在路径，另一注入改为 `../../escape.log` 逃逸路径 | 审计 exit 1（logPath 不存在 / 越出 `evidence/` 根——§7.4 检查 6 的 (a)/(b) 两分支各实证一次） |
| N-7 | 截断任一 cell JSON | 审计 exit 1（unparsable） |
| **N-7b**（修订吸收 SA2-4） | 在 `evidence/B1/` 放置换名旧工件（如 `zz-old.json`） | 审计 exit 1（目录纪律：不属 §7.4 检查 7 六类允许集——「换名旧工件混入」自此有红灯实证） |
| N-8a | `touch -t` 回溯某 cell mtime | 审计 exit 1（stale） |
| N-8b | 把 B2 cell 的 `provenanceDigest` 改为 B3 值 | 审计 exit 1（identity mismatch） |
| N-8c | 在另一棵树上跑审计（marker.head ≠ 当前 HEAD） | 审计 exit 1（cross-tree） |
| N-8d | 换入上一轮 `matrix.json` | 审计 exit 1（41-cell 名集/新鲜度） |
| N-9 | root-test 出现台账外新红 | root-test cell `failedUnexpected ≠ []` → cell 红（不得扩账解释） |
| **N-8e**（iteration 3 修订吸收 SA9-1） | 矩阵完成后**仅做未暂存 tracked 修改、不 `git add`**（如给 `INSTALL.md` 追加一行），再跑 standalone `--audit-evidence` | 审计 exit 1，problem 行 = `tracked working-tree content drifted during the run: marker.worktree=<X> current=<Y>`；**W-3 RESULT 行 problems 为含该条的非空数组**；还原（`git checkout --`）后字节复原、审计回绿——证明 index 未变（旧 `write-tree` 比对对此盲）而被测内容漂移有机械红点 |
| **N-8f**（iteration 3 修订吸收 SA9-1） | **运行中**未暂存漂移：一次性副本上启动 `--all --matrix`，待首个证据文件（如 `evidence/B1/typecheck.json`）出现后向 tracked 文件追加一行（选 `INSTALL.md` 等测试面不消费的文件，避免行为 cell 假红混淆归因），让矩阵跑完 | 收尾内置审计 exit 1 且含同一 drift problem 行 ⇒ `MATRIX FAIL`；若 gates cell 在注入后运行，其 G13.g 会并列指名该文件（如实披露的并列红，不要求唯一）——判据核心 = 审计 drift problem 在场；注入时点由「文件已出现」触发，保证 marker < 注入 < 审计的序（若矩阵先于注入完成则重跑一次，留 log） |
| **N-8g**（iteration 3 修订吸收 SA9-1） | **同 tree、HEAD 移动**：一次性副本上 `git commit --allow-empty -m probe`（tree 不变 ⇒ 指纹不变），再跑 standalone 审计 | 审计 exit 1，problem 行 = `evidence belongs to another tree: marker.head=<X> current HEAD=<Y>`；**drift 检查同指纹 ⇒ 不红**——证明指纹与 HEAD 两个绑定相互独立，指纹没有静默取代 HEAD 绑定 |
| **N-10**（iteration 3 修订吸收 SA9-5.3） | 一次性副本上移走 `evidence/` 目录后跑 standalone `--audit-evidence`（另做「空目录」变体：建空 `evidence/` 再跑） | 缺目录：exit 1，problem = `missing evidence directory: …`，RESULT 行非空数组（W-4 复活后的 guard 首次有红点实证）；空目录：exit 1（missing run marker + 41 missing cell） |
| **T-1**（iteration 3 修订吸收 SA10 B-1/A3-5） | **篡改 tarball 字节**：R′ 上固定 pnpm 打包后，把 `artifacts/local-packages` 整目录复制为一次性探针副本（`.cache/issue-472-impl/tarball-probe-tamper/`；终验轮 `.cache/issue-472-final/tarball-probe-tamper/`），对副本中**恰一个** tarball（如 `nomicore-persistence-0.5.0.tgz`）在 `floor(size/2)` 偏移翻转 1 字节（XOR 0x01，避开 gzip 头），备份原目录 → 换入副本 → `pnpm run publish:verify`（默认模式，无 env override） | `publish:verify` **exit ≠ 0** 且 stderr `ERROR:` 行按 tarball 文件名**指名受影响包**（`tar -xzf <path> failed (N)`；若 gzip 恰存活，后续 packed 检查/registry integrity/npm dry-run 仍以包名报错——无论哪个分支触发都指名）；恢复原目录（sha256 表逐字节复核）后再跑 `publish:verify` = **15/15 绿**；全程留前后日志 + sha256 表 + `git status` 复核（tracked manifest 零 diff） |
| **T-2**（iteration 3 修订吸收 SA10 B-1/A3-5） | **删除一个 tarball**：同一探针框架下从副本中删除恰一个 tarball（如 `nomicore-yjs-server-0.6.0.tgz`），备份 → 换入 → `pnpm run publish:verify`（默认模式） | `publish:verify` **exit ≠ 0** 且 ERROR 行按文件名指名受影响包；恢复后 15/15 绿；**披露**：`publish:reproducible` 独立双构建于临时目录、不读 `artifacts/local-packages`，删除不影响其判定（本轮实测确认）——T-2 红点唯一落点即 `publish:verify`，恢复后 reproducible 15/15 一并复跑留证 |

外层纪律沿用 SA6 §6.2：`--passWithNoTests=false`；fault 入口外层 exit 0 当且仅当内层 observed=fail；任何「应红实绿」直接阻断收官。**红灯捕获时机**：F-A…F-F、F-H…F-M 在 C1 完成时（gates 新语义首次运行即先跑负控；iteration 3 新增的 F-L/F-M 同批）；F-G 在 C2 形成后（absent 分支需 exact 起点树）；N-6/N-6b/N-7/N-7b/N-8a–d 在 `--audit-evidence` 实现完成时（对规范目录备份→污染→审计→还原）；**N-8e/N-8f/N-8g/N-10 在 C4（W-1/W-3/W-4）实现完成时**（一次性副本上）；**T-1/T-2 在 C4 后、R′ 复验协议内**（真实打包输出的一次性副本上，§11.1 步骤 5′；不得以源码测试/矩阵/G13 替代——SA10 B-1 闭合判据原文）；全部红灯 log 归档 `.cache/issue-472-impl/`（终验轮在 `.cache/issue-472-final/` 重跑同款），随 final verification 一并复核；F-* 系 gates 注入在 `R′` 等价的一次性副本上重跑复核（不污染 `R′` 本体）。

**覆盖声明口径更正（修订吸收 SA2-4；iteration 3 扩面）**：G13 两态「任何其他形状=红」与审计七检查的红分支覆盖，以**本节表格实际注入项（F-A…F-M + N-5…N-10 + T-1/T-2）为准**（iteration 1 增 F-F/F-G/N-6b/N-7b；iteration 2 增 F-K；iteration 3 增 F-L/F-M、N-8e/N-8f/N-8g、N-10、T-1/T-2）。SA8 冲突报告 §3-S1 所称「F-A…F-E 负控恰把这些中间态一一证伪」是**过度声明**——部分 bump（7 之 k）、exact 后单文件回退、审计检查 6（logPath 断链/越界）、检查 7（换名旧工件混入）四类中间态在 iteration 0 稿均无注入，后续迭代已补齐；**tarball 内容完整性（篡改/删除）在 round 1 亦无注入（SA10 B-1），iteration 3 以 T-1/T-2 补齐且明确不得以源码测试/matrix/G13 替代**；终验与实现后复查不得引用 SA8 该声明作为覆盖证据，应以本表为唯一权威口径。

---

## 11. 决策 6（dispatch 项 7）：复验与最终验证计划

**release 提交（C2 = `R`）后必须重跑**（全部绑定同一 `R`：每次记录 `git rev-parse HEAD` / `git write-tree` / porcelain；pnpm 语义全部固定 10.28.2 并记录 `pnpm --version`；矩阵独占运行）。**iteration 3 注记**：round 1 已按本节执行但其矩阵未固定 pnpm（SA9-2/B-3 判红）；终审 remediation 后的**权威复验协议 = §11.1（在 R′ = C4 tree 上、固定 pnpm、含 T-1/T-2 与扩展负控集）**，本节保留作 round 1 过程记录与 §11.1 的基线对照：

1. `node packages/persistence/test/fixtures/cordis-baselines/acquire.mjs --all`（本轮重取工件，B3 provenanceDigest 钉值复核）；
2. `node …/run-baseline.mjs --all --matrix` → **41 cells 全 pass**；gates cell 13/13 且日志含 `G13 … state=exact`，summary 保留**全量 14 行** `[gates]` 输出（**条件 9**：`slice(-12)` 截断已去除，终验不得假设截断）；root-test 按台账（`failedUnexpected=[]`，实际 counts 原样记录）；**内置证据审计 exit 0 且 problems=[]（SA2-1 相容性判据 = 条件 9 前半：干净矩阵零假红）**；
3. fault 负控 ×4（`--fault fallback|substitute-npm|substitute-rc12|legacy-shim`，各 `--suite provenance --suite root-probe`）+ N-5 integrity 钉值下调→acquire exit 2→恢复绿；
4. 审计负控 **N-6/N-6b/N-7/N-7b/N-8a–d** 与 gates 负控 **F-A…F-K**（F 系在 `R` 等价一次性副本上）在规范目录/副本上备份→污染→红→还原，逐项留 log（**iteration 3 注记**：round 1 已按此执行；remediation 后的权威口径 = §11.1 步骤 3 的扩展集 N-6…N-10 + F-A…F-M，在 R′ 等价副本上重跑）；
5. `pnpm pack:local` → `pnpm publish:verify`（**默认模式**，禁 `NOMICORE_VERIFY_REGISTRY_INTEGRITY=0`）→ `pnpm publish:reproducible`；留 `pack.log / publish-verify.log / publish-reproducible.log / sha256 表 / manifest 副本`；
6. `pnpm install --frozen-lockfile --lockfile-only` + `git diff --exit-code -- pnpm-lock.yaml`（零 diff）；
7. `pnpm generate --check` exit 0（`domains/vfs3-assets/generated.ts` 不变——本批不 bump codegen）；
8. `git diff --no-renames --name-only 6be891a..R` 形状复核（**单一原语纪律，与 G13.g 同口径**：改名在判定上等价「旧路径删除 + 新路径新增」，两条都必须 ⊆ §14 ALLOW）：变更文件 ⊆ §14 ALLOW（**G13.g 已作机械绑定，本步为双保险复核**）；生产 `src/**`、`domains/**`、`docs/adr|protocols/**`、lock/catalog/根 manifest 零 diff；`baselines.json` 逐字节相同（G13.f 的手工复核面）。

**D1–D15 归属**：SA6 §17 明确 D1–D15「必须由 final-verification 实际执行」——实现轮的运行为开发自证，**AC 证据一律以 final verification 在 `R` 上的独立重跑为准**：D1–D9 由第 2 步矩阵承载；D10/D11 由第 5 步承载；D12 由第 3 步；D13 由第 2 步内置审计 + 第 4 步负控；D14 由 root-test cell JSON + 名集比较；D15 由第 6/7 步。runtime 证据全部落 `.cache/cordis-baselines/evidence/**` 与 `.cache/issue-472-final/**`，`wiki/raw/task_issue-472_sa10_spec.md` 引用其路径与关键数字。

**条件 10 依赖禁令（iteration 2 修订吸收 SA8 §11.4/§12）**：final verification 不得依赖 SA8 冲突报告已被勘误更正的三处表述——`baselines.json` 冻结按 **G13.f + 第 3 步 N-5** 核（非「G12 零 diff」）；公共 API 冻结按 **G13.g（`--no-renames` 原语）+ G2/G4 + 第 8 步** 核（非「G2/G4/G7」覆盖归因）；负控覆盖按 **§10 表（F-A…F-M + N-5…N-10 + T-1/T-2）** 核（非「F-A…F-E 一一证伪」）。第 2 步的 `problems=[]` 与全量 summary 判据即条件 9。

### 11.1 终审 remediation 复验协议（iteration 3；W-6 固定 pnpm 口径 + 全量重跑，闭合 SA9-2/B-3、B-1 执行面）

**W-6 固定 pnpm 10.28.2 的机械口径（所有 pnpm 语义，一个会话内）**：

```bash
# 1) shim 目录（沿 SA6 §4.1 / round 1 release 三连已验证的同款固定法）：
mkdir -p .cache/issue-472-final/bin
printf '#!/bin/sh\nexec node /home/wangjian/.cache/node/corepack/v1/pnpm/10.28.2/bin/pnpm.cjs "$@"\n' \
  > .cache/issue-472-final/bin/pnpm && chmod +x .cache/issue-472-final/bin/pnpm
# 2) 置 PATH 首位并记录（该 shim 就是 pnpm 10.28.2 本体入口，非语义 override）：
export PATH="$PWD/.cache/issue-472-final/bin:$PATH"
pnpm --version | tee .cache/issue-472-final/10-pnpm-version.txt   # 必须输出 10.28.2
# 3) 同一 shell 内执行下述全部步骤（execFileSync/spawnSync 子进程默认继承 env ⇒ 一切子进程的 pnpm 解析到 shim）
```

**判定**：root-test cell JSON `pnpmProbe.exitCode === 0` 且 stdout = `10.28.2`（矩阵内 `spawnSync('pnpm', ['--version'])` 走 PATH）；落盘 `pnpm --version` 输出；全程禁 `NOMICORE_VERIFY_REGISTRY_INTEGRITY=0` 等语义 override。**不得以只跑 root-test 子集替代完整 `--all --matrix`**（SA9-2 闭合判据）。

**在 R′（= C4 的 tree）上的全量重跑顺序**（每次记录 `git rev-parse HEAD` / `trackedWorktreeFingerprint` 等价值（干净树 = R′ tree OID）/ porcelain；矩阵独占运行）：

1. `node …/acquire.mjs --all`（B3 provenanceDigest `9d663355…` 复核；N-5 负控重跑：钉值下调 → exit 2 → 恢复 exit 0）；
2. `node …/run-baseline.mjs --all --matrix`（**固定 pnpm 环境**）→ 41 cells 全 pass；gates cell 13/13、`G13 … state=exact`、summary 全量 `[gates]` 行（不假设行数常数；现盘 21 行）；root-test 按台账判 pass，**counts 按本次实际值原样记录**（28 个 pnpm 环境红在固定 PATH 下预期转绿、余 4 个 frozen——预期不预设，实际值落盘；`failedUnexpected=[]`；**出现台账外新红 ⇒ 停手**，不得扩账、不得 env override 消红）；**内置审计 exit 0 且 W-3 RESULT 行 `problems=[]`**；`marker.worktree === runWorktree === R′ tree OID`（干净树；运行树若含未暂存 tracked 修改则审计已红）；
3. fault 负控 ×4 + 审计/gates 负控 **N-6/N-6b/N-7/N-7b/N-8a–d/N-8e/N-8f/N-8g/N-10 与 F-A…F-M**（F 系/一次性副本系在 `R′` 等价一次性副本上，备份→污染→红→还原逐项留 log，RESULT 行显示对应非空数组）；
4. `pnpm pack:local` → `git diff --exit-code -- artifacts/local-packages/manifest.json`（确定性再生零 diff）→ sha256 表；
5. **tarball 负控 T-1/T-2（W-5 = tarball 真实负控协议：篡改字节/删除各恰一包、`publish:verify` 默认模式非零并指名、恢复后 15/15、日志+sha256+`git status` 证据、不得以源码测试/matrix/G13 替代；B-1 执行面）**：按 §10 表在真实打包输出的一次性副本上执行两项注入，`pnpm run publish:verify`（默认模式）各 exit ≠ 0 且指名受影响包；恢复（sha256 逐字节复核 + `git status` 无 tracked 残留）后 **15/15 绿**（步骤 6 的 reproducible 15/15 一并复跑留证）；
6. `pnpm publish:verify`（默认模式）→ `pnpm publish:reproducible`（均固定 pnpm；15/15 + 15/15）；留 `pack/publish-verify/publish-reproducible` 日志与 sha256 表；
7. `pnpm install --frozen-lockfile --lockfile-only` + `git diff --exit-code -- pnpm-lock.yaml`；`pnpm generate --check`；
8. `git diff --no-renames --name-only 6be891a..R′` 形状复核（单一原语纪律；变更集 ⊆ §14 ALLOW——facility 4 + release 8 + `wiki/raw/task_issue-472*.md`（**dirname 恰为 `wiki/raw`**）；`baselines.json`/台账/catalog 逐字节相同）。

**记录与回填更正（W-7）**：上述实际 counts 与口径写入 C5 记录更正提交（§9.1）；终验/回填/SA10 产物同步采用两分口径；SA7 轮「矩阵用默认 shell pnpm 11.28.5 属记录性偏离」的分类作废——固定 PATH 是 SA6 契约 L83/L180/L645 与 SA8 条件 6 的**硬判据**，未固定即该轮矩阵不可作为 AC1 证据。**remediation 后重新进入终审组**（SA9/SA10 对 C4/C5 后的最终状态重裁；B-4 回填由控制器/发布侧按 §9.4 执行）。

---

## 12. 决策 7（dispatch 项 8）：风险与停手条件

**停手并升级（不得就地裁决）**：
1. 为让三基线/发布门禁通过而需要改变 Cordis/Timer 依赖范围或 dependency/peerDependency 归属（AC5 / ADR 0035 §4）→ 停，另立 ADR；
2. 需要改公共 Namespace/Registry/Replication API、schema（`schema.vfsl`/`generated.ts`）、wire protocol（`replication-protocol/src`、`docs/protocols/**`）、8 个服务名、持久化布局才能闭环 → 停（AC4）；
3. 需要真实 MABF/DSH 部署、迁移窗口或本地 patch 移除才能宣称完成 → 停（AC7 / ADR §6；只能记录"不在本阶段"）；
4. owner 要求 15 包统一 minor / 新增 `CHANGELOG.md` 等新 release 约定（S2 流程变更）→ 停，待 owner 明确；
5. 7 包 bump 后 `publish:verify`/`publish:reproducible` 仍红且原因超出版本/manifest/gate 的确定性缺口（SA6 §18.4）→ 停，按 reject 路径上报；
6. #468 被要求关闭/改写 Parent、#464–#466 被要求复活、或需要复用其证据 → 停（AC6/AC8）；
7. root-test 出现台账外新红（N-9）→ 停，按回归上报，不得扩账；
8. 任何负控「应红实绿」（含审计 fail-open）→ 停，阻断收官。

**主要风险与缓解**：
- pnpm 语义漂移（PATH shim 拒绝 workspace / 环境红掩盖 root-test）→ 全流程固定 10.28.2 并留 `pnpm --version`（§11）；
- `.worktrees/base-snapshot` 陈旧注册 → gates exit 2 前置检查（既有行为，SA6 §14 注）；矩阵前确认无注册 worktree 残留；
- G5 重捕依赖网络/tsx farm → 捕获失败响亮失败（既有 fail 语义），不回退旧快照；
- 快照 7-entry 若在 BASE 捕获时因传递依赖解析失败 → 属方案 A 的实现风险，失败即停并按方案 B 回退重议（不静默降级 4-entry；**SA8 条件 5 已追认为等效停手条件**）；
- 中间态树（bump 未提交）被误当证据 → §12.0.1 单树绑定 + marker.head/**worktree 指纹**审计（N-8c + **N-8e/N-8f/N-8g**；**W-1 指纹比对抓运行中被测内容漂移**，§7.4 检查 1——iteration 3 更正：index write-tree 比对不构成此防线）；
- run-marker 被对抗性回拨（marker+cell mtime 同步回拨可绕过新鲜度检查）→ **威胁模型成文**（§7.4 末段）：审计防意外不防伪造；对抗面由 marker.head 单树绑定 + **W-1 指纹比对** + 终验在 `R′` 上的独立重跑承担（AC 证据以终验轮为准）；
- 证据审计允许集与 runner 演进漂移（后续票给 runner 增加新工件形态时假红）→ §7.4 允许集为票级钉值，任何扩类回 SA8 追认；相容性判据（干净矩阵审计 exit 0）随每次 `--all --matrix` 内置执行，漂移当场暴露；
- **SA8 冲突报告三处表述失实**（§5 第 1/3 行归因、§3-S1 覆盖声明）→ SA8 已以 §12 勘误（E-1/E-2/E-3）**即时生效**并发布交付条件 10：终验不得依赖该三处表述——`baselines.json` 冻结按 G13.f + N-5 核、公共 API 冻结按 G13.g（`--no-renames` 原语）+ G2/G4 + 步骤 8 核、负控覆盖按 §10 表（F-A…F-M）核（§11 条件 10 依赖禁令段；实现记录按 SA8 现行版执行）；PV-8a 原文继承的「改名同样计入变更集」表述由 §7.3.g 的 `--no-renames` 原语机械兑现，钉值语义不变。
- **（iteration 3）固定 pnpm 重跑暴露新红**（28 个环境红转绿预期之外的台账外红）→ 停手条件 7/§11.1：按回归上报，不得扩账、不得 env override 消红；台账逐字节冻结（G13.d）不动。
- **（iteration 3）tarball 探针的恢复不完整**（T-1/T-2 注入后 artifacts 未复原）→ sha256 表逐字节复核 + `git diff --exit-code -- artifacts/local-packages/manifest.json` + `git status --porcelain` 三重收尾判据；探针只碰 gitignored `*.tgz` 与副本，tracked manifest 由确定性再生兜底（pack 再跑即复原）。
- **（iteration 3）C5 空提交被误读为流程异常** → `--allow-empty` 是 message-only 更正的机械载体（仓库无 CHANGELOG 且不得新造）；dispatch 台账与终审报告注明其性质；G13.g 对空提交零新增变更（形状不变绿）。
- **（iteration 3）指纹原语的环境耦合**（git config/filters 在 marker 与审计之间变化会导致假红或假绿）→ 两次调用都在同一 `run-baseline.mjs` 进程 env 内（`GIT_INDEX_FILE` 指向临时 index，不读真实 index）；§7.4 mtime 威胁模型段已声明对抗面由终验独立重跑承担。

**回滚**：C2/C1 均为本地提交，未触碰 registry（本票不执行 npm publish）；任何停手条件触发即 `git reset` 掉未推送的 release/设施提交，`.cache` 证据可再生。无外部状态需要清理。

---

## 13. 数据流路线

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| **release 打包链**（唯一新增运行时数据流；生产代码零改动，故无业务数据流变化） | 实现者编辑 7 个 `"version"` 行 | 工作树 7 个 `package.json` | `pnpm run build` 产 `dist/`（gitignored）→ `create-publish-manifest.mjs` 把 packed manifest 的 `workspace:*` 重写为依赖方**精确版本**并按 key 排序 | tarball（15 个，gitignored）+ tracked `artifacts/local-packages/manifest.json`（catalog 键序确定性再生） | `verify-package-tarballs.mjs`：filename↔name/version、结构、registry integrity（已发布版本 sha512 相等）/未发布版本 `npm publish --dry-run`；`verify-reproducible-packages.mjs`：双次构建 sha256 | 15/15 绿；7 个新 filename；dry-run id 匹配 | 任一检查失败 exit 1 全量列错；`build-local-packages.mjs` 先 `rm -rf` outDir 再重建（幂等） | A3-1…A3-5 / D10 / D11 / §6.2 |
| **lockfile 不变量** | `pnpm install --frozen-lockfile --lockfile-only` | （不应有任何写变化） | workspace 依赖以 `link:` 记录，版本字段不参与解析（§6.2.3 依据） | `pnpm-lock.yaml` | `git diff --exit-code -- pnpm-lock.yaml` | 零 diff | 若出现 diff ⇒ manifest specifier 漂移 ⇒ A5 红，停手核查 | A5-2 / D15 |
| **证据链**（无跨进程业务边界；纯本地文件） | `run-baseline.mjs --all --matrix` 先写 `run-marker.json`（head/**worktree=trackedWorktreeFingerprint()**/porcelain/startedAt；worktree 为校验值——iteration 3 起 `tree` 字段移除，W-1） | `evidence/<B>/<suite>.json` ×39 + `<B>-typecheck.json` 聚合 + `<B>-*.log`/`*.vitest.json` + fault 件 + `gates/gates.json` + `root-test/root-test.json` + `matrix/matrix.json`（增 `runHead`/**`runWorktree`** 字段，additive；iteration 3 前 `runTree`） | 每 cell 由 runner 内 vitest JSON reporter / tsc 退出码归一化；gates cell 直接执行 `gates.mjs`（summary 保留全部 `[gates]` 行，修订吸收 SA2-5） | `.cache/cordis-baselines/evidence/**`（gitignored） | 内置 `auditEvidence()`（§7.4 七项检查：含精确允许清单、三类 digest 期望、logPath 存在/containment、**W-1 指纹比对**）与 standalone `--audit-evidence`；两路径均输出 **W-3 RESULT 行**（`problems=<JSON 数组>`，成功 `[]`） | 41 cells 全 pass + 审计 exit 0 且 RESULT 行 `problems=[]` | 缺失/损坏/过期/跨树/名集漂移/logPath 断链/越类工件/**未暂存内容漂移（N-8e/f）/缺目录（N-10）** → 审计 exit 1（fail-closed，无 fallback；RESULT 行非空数组） | A2 / D13 / N-6…N-10 |
| **公共面快照**（方案 A） | `gates.mjs --write-surface-snapshot` 于新 BASE `6be891a` | `public-surface.base.json`（7 键，tracked） | base worktree + farm + tsx + `nomicore-source` 逐 entry `Object.keys(mod).sort()` | facility 目录 | G5 比较（BASE 捕获 vs tracked 快照）+ runtime surface test（working tree vs 快照，7 entry） | 7/7 entry 严格相等 | 捕获失败响亮 exit；漂移逐 entry 列 missing/unexpected | A4-4③ / A4-5 / S3 |
| **tarball 完整性探针**（iteration 3；T-1/T-2，B-1 执行面） | 复验协议 §11.1 步骤 4/5：固定 pnpm `pack:local` 后整目录复制 `artifacts/local-packages` → `.cache/issue-472-{impl,final}/tarball-probe-{tamper,delete}/`（一次性副本） | 副本内注入：T-1 恰一 tarball 中位偏移翻 1 字节；T-2 恰一 tarball 删除；原目录备份 | 注入只碰 gitignored `*.tgz` 与副本；manifest 副本逐字节同源 | `.cache/**`（gitignored）+ 短暂替换 `artifacts/local-packages`（备份→换入→还原） | `pnpm run publish:verify`（默认模式）逐包 `tar -xzf` → 结构/registry/dry-run 检查 | 注入 ⇒ exit ≠ 0 且 ERROR 行按文件名指名受影响包；还原（sha256 逐字节复核）⇒ 15/15 绿；reproducible 15/15 复跑留证 | 还原不完整由 sha256 表 + `git diff --exit-code -- …/manifest.json` + porcelain 三重判据拦截 | A3-5 / D10 / T-1 / T-2 |

---

## 14. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/persistence/test/fixtures/cordis-baselines/gates.mjs` | BASE 重钉 `6be891a`；PUBLIC_ENTRIES 4→7；G1′/G3 release allowlist；新增 G13（RELEASE_BATCH 引用 `BASE` 常量；两态 + **f 款 `baselines.json` 逐字节** + **g 款全树变更集绑定（原语钉 `git diff --no-renames --name-only BASE`）** + PV-4 numstat 口径）；G12 FACILITY_ALLOW +`public-surface.base.json`（`baselines.json` 名义项转死条目 + 文案归因更正）；G5 文案；**iteration 3 remediation（C4）：`isTicketDoc()` 收窄为 `path.posix.dirname(p) === 'wiki/raw'` ∧ basename 正则（W-2）+ L5/L7 头注对齐 release 语义（W-4，SA9-5.1）** | §7.1–§7.3、§7.5、§8、§9.1 C4；修订吸收 SA2-2/SA2-3/SA2-8/SA2-10/SA2-13/SA9-3/SA9-5 |
| `packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs` | `--audit-evidence` 模式 + run-marker（**iteration 3：`tree` → `worktree` = `trackedWorktreeFingerprint()`，W-1**）+ 内置审计（精确允许清单 / 三类 digest 期望 / logPath 判定 / **指纹比对**）+ `matrix.json` 增 `runHead`/**`runWorktree`** + gates cell summary 去 `slice(-12)` 截断 + **iteration 3 remediation（C4）：W-3 RESULT 行（成功/失败两路径均 `problems=<JSON 数组>`）+ W-4 删除 `main()` 头部 `mkdirp(EVIDENCE)`（缺目录 guard 复活）+ L901–L903 注释对齐（「保留全部 `[gates]` 行，行数不钉常数；现盘 21 行」，SA9-5.2）** | §7.4（闭合在既有闭集文件内）、§9.1 C4；修订吸收 SA2-1/SA2-4/SA2-5/SA2-7/SA9-1/SA9-4/SA9-5 |
| `packages/persistence/test/fixtures/cordis-baselines/public-surface.base.json` | **仅方案 A**：新 BASE 重捕，4→7 键（**iteration 3：零新改动**） | §8 / S3 |
| `packages/persistence/test/cordis-public-surface.test.ts` | **仅方案 A**：ENTRIES 4→7 + 文案（含 describe 去旧 base 串）（**iteration 3：零新改动**） | §8 / S3；修订吸收 SA2-9 |
| `packages/persistence/package.json` | `"version": "0.4.0" → "0.5.0"`（仅 L3 单行） | §6.1 |
| `packages/dsh-persistence/package.json` | `0.4.0 → 0.5.0`（单行） | §6.1 闭包 |
| `packages/namespace-runtime/package.json` | `0.4.0 → 0.5.0`（单行） | §6.1 闭包 |
| `packages/namespace-registry/package.json` | `0.4.0 → 0.5.0`（单行） | §6.1 闭包 |
| `packages/namespace-api/package.json` | `0.3.0 → 0.4.0`（单行） | §6.1 闭包 |
| `packages/ws-replication/package.json` | `0.5.0 → 0.6.0`（单行） | §6.1 |
| `apps/yjs-server/package.json` | `0.5.0 → 0.6.0`（单行） | §6.1 闭包 |
| `artifacts/local-packages/manifest.json` | 恰 7 个 filename 键更新（`pack:local` 再生；numstat 7 增 + 7 删，PV-4） | §6.2 / A4-2 |
| `wiki/raw/task_issue-472*.md`（全集：本设计 + brief + dispatch + SA6 契约 + SA8 冲突报告 + SA2 评审 + `task_issue-472_sa10_spec.md` + **`task_issue-472_sa9_standards.md` 及终审/remediation 后续轮同前缀产物**） | 本票 SA 工件与 final-verification 产物（**修订吸收 SA2-6**：入库范围枚举为 glob 全集；既有 `wiki/raw/**` 历史不改写、只新增——**iteration 3 重申：不重复读取或重写历史 wiki 工件，只增订正节/新文件**） | §9 C3/§9.1 C6 / SA6 §10.2 |

提交分组按 §9：C1 = 前 4 行（方案 B 时去掉 3/4 两行）；C2 = 7 个 package.json + manifest；C3 = `wiki/raw/task_issue-472*.md` 全集；**iteration 3 remediation（§9.1）：C4 = 恰 `gates.mjs` + `run-baseline.mjs` 两个设施文件；C5 = `--allow-empty` 记录更正提交（零文件变更）；C6 = `wiki/raw/task_issue-472*.md` 新增工件。remediation 期间 7 个 release `package.json`、manifest、lockfile、快照/测试两文件零新改动**。

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/**/src/**`、`apps/**/src/**`、`domains/**` | 生产实现与 schema/生成物 | ADR 0035 §4；AC4/AC5；本票 release diff 只含版本行。**执法面（修订吸收 SA2-2，更正 iteration 0 归因）**：**G13.g 全树条款（机械，覆盖全部 11+ 个包的 src 树）** + G2（3 个 src 树零 diff 的窄面）+ G4（2 个 entry 文件）+ 终验步骤 8 手工复核（双保险）；`generated.ts` 因 codegen 不 bump 必须零 diff（`generate --check`） |
| `docs/adr/**`、`docs/protocols/**`、`docs/**` 其余 | 规范契约 | G7 零 diff；**G13.g 全树条款**（docs 不在 exact 允许集）；改 ADR 追认实现 = AC8 红 |
| `pnpm-lock.yaml` | 依赖锁 | A5-2；版本 bump 不应产生任何 lock 变化（§6.2 判据；G13.b 逐字节） |
| 根 `package.json`、其余 8 个 publishable `package.json`、`domains/vfs3-assets/package.json` | workspace manifest | 私有/非闭包：版本与依赖字段零 diff（G1′ 白名单外 + G13.b 逐字节 + G13.g 全树） |
| `scripts/**`（含 `package-catalog.mjs`、`build-local-packages.mjs`、`verify-*.mjs`、`create-publish-manifest.mjs`、`publish-*.mjs`） | 发布流水线 | A5-2 唯一清单源（catalog 另受 G13.e 逐字节）；本票不改发布流程（改流程 = 新决策）；证据审计按 D-4 放 facility 闭集。**执法面**：`scripts/**` 不在任何既有 gate pathspec 内，自本票起由 **G13.g 全树条款**机械覆盖（修订吸收 SA2-2）。**iteration 3**：tarball 负控 T-1/T-2 **只运行**既有 `verify-package-tarballs.mjs`（经 `pnpm run publish:verify`），对其零改动——注入落在打包输出一次性副本，不落在脚本 |
| `.github/workflows/**`、其余 CI 配置 | CI | 不以改 CI 代替 release 门禁（`NOMICORE_VERIFY_REGISTRY_INTEGRITY=0` 的降级语义保持现状并被 §10/§11 排除在证据外）；**执法面**：同样由 G13.g 全树条款机械覆盖（`--no-renames` 原语：把 CI 文件**改名挪走**同样以「旧路径删除」计红——F-K 注入面；iteration 0 该面无任何 gate 把关，已更正） |
| `artifacts/**`（除 `local-packages/manifest.json`） | 历史证据档案 | G1′/G6 零 diff；**G13.g 全树条款**；改历史工件追认实现 = 红 |
| `packages/persistence/test/fixtures/cordis-baselines/{acquire.mjs,root-probe.mjs,provenance-b3.json,baselines.json,root-test-known-red.json}` | facility 冻结件 | acquire/root-probe/provenance-b3 = G12 零 diff + G13.g；**baselines.json / root-test-known-red.json = G13 逐字节钉死（f/d 款；S4/PV-8b）——`baselines.json` 在 G12 的名义白名单项自本票起为死条目，终验不得以「G12 零 diff」作为其执行依据（修订吸收 SA2-3，更正 SA8 报告 §5 第 1 行归因）** |
| 12 suite 测试文件本体与非 facility 的 `packages/*/test/**`、`apps/*/test/**` | 既有验收面 | 零 diff 义务（非目标）；**执法面**：不属任何既有 gate pathspec，自本票起由 G13.g 全树条款机械覆盖（修订吸收 SA2-2；surface 测试文件是唯一 ALLOW 例外，§14 ALLOW 第 4 行） |
| `CHANGELOG.md`（不存在则不得新造）、根版本号 | release 记录载体 | SA6 §10.1b：无既有约定，新造 = S2 流程变更（SA8 条件 7 触发器） |

---

## 15. 验收与验证映射

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| **AC1 / A1-1…A1-6** | HEAD 矩阵 41 cells 绿（本轮 `matrix.json`） | final verification 在 `R` 重跑 `--all --matrix`；gates cell 13/13、G13 `state=exact` | 41/41 cells pass；每基线独立留证；root-test 仅按台账 pass 且原样披露 counts |
| **AC2 / A2-1…A2-5（D1–D3、D12）** | 本轮 fault 4/4 应红实红 + N-5 红→恢复 | 在 `R` 重跑 fault ×4 与 N-5；provenance/root-probe cell | 外层 exit 0 ⇔ 内层 observed=fail；digest `9d663355…` 复核 |
| **AC3 / A3-1…A3-5（D10、D11）** | HEAD `publish:verify` 红（红灯 1）；RC 实验绿 | `R` 上 pack → verify（默认模式）→ reproducible + 负控（篡改 tarball/stale manifest/删 tarball 必红） | 15/15 绿；7 新版本 dry-run 通过；8 已发布版本 integrity 相等；双次构建 sha256 一致 |
| **AC4 / A4-1…A4-5** | 版本矩阵推导（§6.1 自验闭包）；生产面零 diff；快照 4-entry 现状 | `git show --format=%B` release 正文；`git diff --no-renames --name-only 19df983..R` / `6be891a..R`；7-entry（或 B 方案披露）快照与 G5；guard-proxy/contract/unload 三基线 cell；`generate --check` | 版本/manifest/记录三收敛；公共契约五项冻结各有证据；记录采用 §8 **两分文案**（不得宣称 #471 已交付 7-entry 快照，也不得宣称其未做覆盖扩展） |
| **AC5 / A5-1…A5-3** | 依赖字段现状零 diff | G1′/G13 对 17 manifest + lock + catalog 的逐字节/单行判定 + **G13.g 全树条款** | 除 7 个 version 行外全部逐字节不变；无新 peer/patchedDependencies；gate pathspec 外越界改动（src/scripts/.github/测试文件）机械红 |
| **AC6 / A6-1…A6-3** | #472 comments=[]、#468 open/Parent=PR #469 | 回填评论/PR 正文（引用 `R` 与证据路径）；操作前后 `gh api` 快照 | 回填含关键数字；#468 state/Parent 不变 |
| **AC7 / A7-1…A7-3** | ADR 0035 §6 | release 正文/回填/final 报告三处同义声明 + 命令白名单审计 | 无部署/patch 动作、无完成性声明 |
| **AC8 / A8-1…A8-3** | #464–#466 closed + 撤回评论（本轮实读） | `gh api` 状态保持复核；记录文本检查 | 保持撤回；证据隔离 |
| **D13 / N-6…N-10** | SA6 `.cache/sa6-472/audit-*.json` 演示 | §7.4 审计 + §10 负控（含 N-6b/N-7b；iteration 3 增 N-8e/f/g、N-10）在 R′ 重跑（§11.1 步骤 3） | 缺失/损坏/过期/跨树/名集漂移/logPath 断链/越类工件/**未暂存内容漂移/缺目录**全部 exit 1（RESULT 行非空数组） |
| **SA2-1 审计相容性（修订吸收）** | 实盘 41-cell 布局逐项对账（§3 新增行；96 文件实测） | HEAD 干净树重跑 `--all --matrix`（内置审计） | 审计 exit 0 且 `problems=[]`（干净矩阵零假红）；随后 N-6/N-6b/N-7/N-7b/N-8a–d 注入仍逐项 exit 1 |
| **SA2-2 全树绑定（修订吸收）** | gates pathspec 覆盖边界本轮逐行核实（G2 仅 3 src 树/G4 仅 2 文件/G7 仅 docs） | F-H/F-I 注入（src / scripts+.github 越界注释） | gates exit 1 并指名越界文件；G1′/G2/G4 同时仍绿（证明红点唯一来源是 G13.g）；干净 C1/C2 树 13/13 绿 |
| **SA2-13 rename 原语缺口（iteration 2 修订吸收）** | `git diff --name-only` 默认 rename detection 只列新路径（`27e012b` 历史改名实证：默认输出无 `0031-…`、`--no-renames` 下两路径均列；`diff.renames` 未设置；本轮一手复测一致） | F-K 注入（`git mv .github/workflows/ci.yml wiki/raw/task_issue-472_renamed.md`） | gates exit 1 且指名旧路径 `.github/workflows/ci.yml`；G1′/G2/G4/G12 仍绿（红点唯一 G13.g）；干净 C1/C2 树 13/13 绿不回归；`--no-renames` 下现盘 6 个 wiki untracked 与两态允许集判定不变 |
| **SA2-3 工件身份钉死（修订吸收）** | `FACILITY_ALLOW` 含 `baselines.json`（G12 名义允许其 diff）本轮实测 | F-J 注入（`baselines.json` 单字节改动） | G13.f 红（G12 名义放行不救）；干净 C1/C2 树 13/13 绿 |
| **SA2-4 新分支证伪（修订吸收）** | iteration 0 表缺四类注入（SA2 §12 指出） | F-F / F-G / N-6b / N-7b 注入 | 四项各自应红点留 log（§10 表）；覆盖声明以 §10 为唯一权威口径 |
| **D14** | root-test 5956/5988（SA6 轮，未固定 pnpm）；round 1 实现轮 C1 5959/5991（未固定）、C2 预验 5987/5991（固定） | **固定 10.28.2（§11.1 W-6 shim 置 PATH 首位）重跑完整 `--all --matrix`**（非 root-test 子集）；root-test cell JSON | `pnpmProbe.exitCode=0` ∧ stdout=10.28.2；`failedUnexpected=[]`；实际 counts 原样记录（固定口径下的新值落 C5 更正记录）；台账外新红 ⇒ 停手 |
| **SA9-1 working-tree 内容绑定（iteration 3）** | 指纹原语本轮一手实测（§头部自验记录⑦：worktree `59a60b0f…` ≠ HEAD tree `b898d119…`，差源 = 唯一未暂存 tracked 修改，而真实 index write-tree = HEAD tree——旧 marker 失效模式复现）；round 1 C1 marker `tree=b41d9e73…`（= BASE tree）≠ 实际被测内容树 `da3f368f…` | C4 落地 W-1 后：N-8e（矩阵后未暂存修改、不 add → standalone exit 1 + drift problem）、N-8f（运行中漂移 → 内置审计 MATRIX FAIL）、N-8g（同 tree HEAD 移动 → 仅 head 红、指纹不红）；R′ 复验时 `marker.worktree === runWorktree === R′ tree OID`（干净树），**不得再以 BASE/HEAD tree 冒充内容绑定** | 三负控各自应红实红留 log（`.cache/issue-472-{impl,final}/`）；干净矩阵审计 exit 0 不回归 |
| **SA9-2 / B-3 固定 pnpm 终验环境（iteration 3）** | round 1 终验矩阵 root-test.json `pnpmProbe.exitCode=1`（pnpm 11.28.5）；仅 release 三连在 10.28.2 下（`05-pnpm-version.txt`） | §11.1 W-6 协议在 R′ 重跑完整矩阵（shim PATH 首位、同会话全部子进程） | 41/41 + gates 13/13 + 审计 `problems=[]` 全绿；`pnpmProbe.exitCode=0`；counts 实际值原样披露、`failedUnexpected=[]`、不扩账不 override；C2 正文 ⑦ 混同归因与 SA7「非判据偏离」分类在 C5 更正 |
| **SA9-3 tracked wiki 精确范围（iteration 3）** | `gates.mjs` L128–L132 现实现 `startsWith('wiki/')` 本轮复核（SA9-3 属实）；PV-8a 钉值原文 = `wiki/raw/task_issue-472*.md` | C4 落地 W-2 后：F-L（staged `wiki/task_issue-472_probe.md`）/F-M（staged `wiki/raw/nested/task_issue-472_probe.md`）注入 | G13.g 各自指名判红（gates exit 1）；G1′/G2/G4/G12 仍绿；C3 已交付 `wiki/raw/task_issue-472*.md` 正向保持绿；untracked ⊆ `wiki/**` 分量不变 |
| **SA9-4 审计结果可机判（iteration 3）** | round 1 成功路径仅打印 `EVIDENCE AUDIT PASS`（SA9-4 证据 3：三处日志无空列表载体） | C4 落地 W-3 后：干净矩阵 + standalone 重跑；N 系负控逐项复核 | 两条路径各恰一行 `EVIDENCE AUDIT RESULT … problems=<JSON 数组>`；成功 = 字面量 `problems=[]` + exit 0；失败 = 非空数组 + exit 1；无新落盘工件（evidence 目录允许集零改动） |
| **B-1 tarball 真实负控（iteration 3）** | round 1 只有 F-C/F-D（stale/未再生 manifest）；`release-gates.sh` 只有正控三连 | §11.1 步骤 5 的 T-1（篡改字节）/T-2（删除 tarball）在 R′ 真实打包输出一次性副本上执行（`.cache/issue-472-impl/` 与终验 `.cache/issue-472-final/`） | `publish:verify` 默认模式各 exit ≠ 0 且指名受影响包；恢复后 15/15 绿 + reproducible 15/15；sha256 前后表 + 日志 + `git status` 复核齐全；不以源码测试/matrix/G13 替代 |
| **B-2 记录口径与 R′ 身份（iteration 3）** | C2 正文 ⑦ 原文（本轮复核）：把 C1 `5959/5991` 置于「固定 pnpm 10.28.2 下」；⑩ 无 R HEAD/tree | C5 记录更正提交（§9.1）：口径两分（未固定 PATH vs 固定 10.28.2）+ R′ 完整 HEAD/tree + AC1–AC4 证据再绑定声明 | `git show -s --format=%B <C5>` 含两分口径、四个 counts 各自的口径标注与 R′ 身份；旧树绿不被沿用（终审组重裁 R′ 上的证据） |
| **B-4 回填证据包（iteration 3，设计面）** | #472 comments=[]、无集成 PR、#469 无结果评论（SA10 §2.4 实读） | §9.4：证据包清单 + 触发条件 + 职责边界（控制器/发布侧执行，非 SA 面） | 终审 approve 后由有权方回填同一组内容；#468 open/Parent 不变、#464–#466 保持撤回、前后 `gh api` JSON 快照留档 |
| **D15** | lockfile link: 结构（本轮实测） | `pnpm install --frozen-lockfile --lockfile-only` + `generate --check` | 双零 diff / exit 0 |
| **G-R1…G-R10** | SA6 §18.3 | 分别落在 §6（G-R1/G-R3）、§7+§9（G-R2）、§11（G-R4/G-R10）、§8（G-R5）、§7.3+§11（G-R6/G-R7）、§9.3（G-R8）、§9.2（G-R9） | 每项有命令、证据路径与失败判据（SA6 §12 原文为准） |

---

## 16. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| `run-baseline.mjs` gates cell（`runGatesCell`） | 执行 gates.mjs，记录 exit + summary（round 1 已去 `slice(-12)`；**注释仍写「13 gates = 14 lines incl. the summary」，实际现盘 21 行**） | 同；summary **保留全部 `[gates]` 行**（逐 gate + 汇总 + G10 明细，完备性是判据、行数不钉常数）；**iteration 3（W-4/SA9-5.2）：L901–L903 注释改写为完备性表述并如实注明现盘 21 行** | 注释对齐（无行为改动） | run-baseline.mjs L887–L906；`evidence/gates/gates.json` summary = 21 行本轮实测 |
| gates.json `summary` 的消费方（SA10 / final verification / SA8 复查） | 12 行（iteration 0 缺 G1′）→ round 1 已 21 行全量 | 21 行全量（G1′…G13 逐 gate 可从 JSON 核对；行数非钉值） | 无代码改动；终验按完备性核对（SA8 §13.3 的 14/21 合法口径），不得假设截断、也不得假设固定行数 | 同上 |
| `run-baseline.mjs --all --matrix` 主流程 | round 1：先写 run-marker（`tree` = index `git write-tree`），收尾 `auditEvidence()`（比对 index tree）；`matrix.json` 记 `runHead/runTree` | **iteration 3（W-1）**：marker 字段 `{startedAt, head, worktree, porcelain}`（`tree` 移除）；`writeRunMarker` 与审计检查 1 调 `trackedWorktreeFingerprint()`；`matrix.json` 记 `runHead/runWorktree`（`runTree` 改名）；审计红 ⇒ MATRIX FAIL 不变 | §7.4 W-1 edit points | run-baseline.mjs L1071–L1081/L1195–L1226/L1293–L1305；指纹原语本轮实测（§头部自验记录） |
| **marker/matrix 字段的消费方**（`auditRunMarker` 字段清单、`auditMatrix` 交叉核对、SA7 证据摘录 `02-matrix-key-fields.txt` 一类 extracts） | 读 `marker.tree` / `matrix.runTree` | 读 `marker.worktree` / `matrix.runWorktree`（语义 = tracked working-tree 内容指纹）；旧字段名不复存在，防「index tree 冒充内容绑定」的读法回流 | §7.4 W-1；终验摘录模板同步 | auditRunMarker L1209–L1224、auditMatrix L1300–L1304 |
| **`printAudit` 输出的消费方**（内置矩阵日志 / standalone 日志 / SA7 与终审组对条件 9 的核对） | 成功只打印 `EVIDENCE AUDIT PASS …`（无可机判空列表——SA9-4）；失败逐条 problem | **iteration 3（W-3）**：两路径均先输出 `[run-baseline] EVIDENCE AUDIT RESULT (<context>): exit=<0|1> problems=<JSON 数组>`，成功含字面量 `problems=[]`；人读 PASS/FAIL 与明细行保留；exit code 语义不变 | §7.4 W-3 edit points | run-baseline.mjs L1390–L1397 |
| **standalone `--audit-evidence` 的目录前提** | `main()` 头部 `mkdirp(EVIDENCE)` 使缺目录 guard 不可达（SA9-5.3 死代码） | **iteration 3（W-4）**：删除该 `mkdirp`；缺目录 ⇒ guard problem ⇒ RESULT 非空数组 ⇒ exit 1（N-10 实证）；写证据路径各自 mkdir（writeRunMarker L1072 / writeEvidence L563 / gates L889 / root-test L922），无路径依赖预创建 | §7.4 W-4 edit points | run-baseline.mjs L1375–L1379/L1464–L1473 |
| `cordis-public-surface.test.ts`（被 G5 runtime 与 root-test/CI `pnpm test` 共用） | 4 entry，5 个 it（describe 文案含旧 base 串 `279dba4`） | 7 entry，8 个 it（方案 A）；describe 文案去具体 sha | §8；CI/root-test 计数 +3，名集不受影响 | vitest.config.ts alias 通配、各 entry 文件本轮核实 |
| `verify-package-tarballs.mjs` / `verify-reproducible-packages.mjs` / `build-local-packages.mjs` / `create-publish-manifest.mjs` | 读取 15 包 manifest/版本 | 输入变化（7 个新版本）但代码与语义零改动；**iteration 3：T-1/T-2 负控只以其为被测对象（注入在打包输出副本），脚本零改动** | 无 | scripts/* 本轮通读（`run()` 错误消息含 tarball 路径 ⇒ 指名受影响包；reproducible 不读 artifacts/local-packages） |
| `gates.mjs` `isTicketDoc()`（G13.g 唯一调用方） | `posix.startsWith('wiki/')` + basename 正则（实际放行整个 `wiki/**`——SA9-3） | **iteration 3（W-2）**：`path.posix.dirname(posix) === 'wiki/raw'` ∧ basename 正则；`wiki/` 根与更深层判红（F-L/F-M）；untracked 分量（`untrackedPaths()`）不动 | §7.3.g edit points | gates.mjs L127–L132/L1172–L1184 |
| pnpm workspace（`link:` importer） | 版本无关 | 版本 bump 后 lockfile 不变 | 无 | pnpm-lock.yaml L282–L296 本轮实测 |
| `gates.mjs` 自身（G12 自指） | FACILITY_ALLOW 4 文件 | +`public-surface.base.json`（A 方案）→ 5 文件闭集（PV-6）；`baselines.json` 名义项转死条目（§7.5）；gates.mjs 本身在 allowlist 内，自改不触发 G12 红 | §7.5 | gates.mjs L58–L65、L988–L1003 |
| CI（`.github/workflows/ci.yml`） | pack:local + 降级 verify + reproducible；`pnpm test` 含 surface 测试 | surface 测试 7 entry 随 `pnpm test` 生效；CI 脚本零改动（受 G13.g 全树条款保护） | 无 | ci.yml L165–L180 |

无未覆盖调用方：facility 的全部调用点（matrix/gates cell/开发者手动）都在上表；生产代码与发布脚本零改动故无生产调用方影响。

---

## 17. 风险、回滚与残余问题

- **票级追认状态（iteration 1 更新）**：S1–S4 已由 SA8 冲突报告全部追认（S1/S3 = ratified-with-conditions、S2/S4 = ratified），实现可按本文落地；前置义务改为「逐字兑现 §4.1/§4.2 的 PV 与交付条件」，任何偏离 = 回冲突门禁（SA8 条件 8）。owner 侧仍保留 S2 升级触发器与 AC6 知会性披露（条件 7），方案 A 的 owner 否决权在合并前行使。
- **SA8 报告三处表述更正（已生效，iteration 2 更新）**：SA8 已于 rev1 复查轮以报告 §12 勘误（E-1/E-2/E-3）形式即时更正并发布交付条件 10——① §5 第 1 行：`baselines.json` 冻结的执行面是 **G13.f + acquire N-5**，不是「G12 零 diff」（G12 名义允许其 diff）；② §5 第 3 行：公共 API 冻结的机械执行面是 **G13.g 全树条款（`--no-renames` 原语）+ G2/G4 + 终验步骤 8**（G2 仅 3 包 src、G4 仅 2 文件），不是「G2/G4/G7」三 gate 全覆盖；③ §3-S1：「F-A…F-E 一一证伪」为过度声明，覆盖以 §10 表（F-A…F-K + N-5…N-9 含 b 变体）为准。**终验不得依赖这三处被更正表述**（条件 10，§11 依赖禁令段/§12 风险表；实现记录按 SA8 现行版执行——SA2-15 同判：更正已生效，无需再等）；PV-8a 原文的「删除/改名同样计入变更集」表述按 SA2-13 由 §7.3.g 的 `--no-renames` 原语机械兑现，SA8 将在实现后复查中给 PV-8a 补注该口径（钉值语义不变）。
- **残余（非本票）**：4 个 test-d 既有红（#421 EF-C1 类型面）按台账披露，另票处理；真实 npm 发布（`main` 上 `publish:packages -- --publish`）是 maintainer 后续动作；`baselines.json` 的历史 `base` 文档字段与 ledger `capturedAt` 保留原出处不改（§7.1 四处 base 串语义分工）。
- **回滚**：见 §12 末段——本地提交回退即可，无外部状态。
- **完成定义**：本设计完成 = 实现与最终验证可完全依本文执行而无需再做工程决策；SA2 四条 MAJOR 已逐条闭合（§评审修订映射）、八条 MINOR 已逐条处置（采纳 7 条、部分采纳 1 条并附理由）、iteration 1 复查的唯一 blocking SA2-13 已闭合（§评审修订映射 rev2）、SA8 PV-1…PV-7（+PV-8a/8b 补充钉，PV-6 加注记）与交付条件（八条 + SA8 §11.4 增补 3′/9/10）已逐字吸收（§4.1/§4.2）；**iteration 3：终审组 SA9-1…SA9-4 四条 MAJOR + SA9-5 MINOR 与 SA10 B-1…B-3 三条设计面 blocking 已逐条给出 remediation（§评审修订映射 rev3；B-4 = 控制器/发布侧职责，设计面以 §9.4 证据包与边界闭环）**。开放项 = C4/C5 落地、§11.1 复验协议执行事实与终审组重裁。
- **残余（iteration 3 新增注记）**：round 1 旧树（`e3d5881`/`d5cf485`）上的全部绿证据随 R′ 再绑定而作废，仅作历史过程记录引用（终审报告/dispatch 台账锚点保留）；SA7 报告中「矩阵默认 shell pnpm 属记录性偏离」的表述已被 SA9-2 判为与硬判据冲突，后续产物不得沿用该分类。

---

## 18. 是否需要设计后 ADR 冲突复查及理由

**需要（`requiresConflictRecheck = true`）**，不触碰 ADR 0035 任何条款（§1/§4/§5/§6 零改动、零例外；如实现阶段出现 §12 停手条件 1–3，则升级为 ADR 级冲突另议）：

1. **S1（已追认，带条件）**：G1′/G3 的零 diff 语义与 G12 闭集是 #470 R7/#471 已批准的验收契约；本设计精确化为「文件集 allowlist + G13 两态形状审计 + 台账/catalog/baselines.json 逐字节钉死 + 全树变更集绑定」。SA8 冲突报告已追认（ratified-with-conditions），**PV 清单含本轮按 SA2 §15.1 并入的两钉（PV-8a 全树绑定、PV-8b baselines.json）**——实现后复查必须按**修订后的完整钉值集**逐字核对（`gates.mjs` 实际 diff 是否精确等于追认形状：BASE/8 文件 allowlist/G13 两态含 f/g 款（g 原语 `git diff --no-renames --name-only BASE`）/G12 5 文件 + 死条目文案/G5 7 entry/`RELEASE_BATCH.base` 引用 `BASE` 常量）。
2. **S3（已追认，带条件）**：#471 记录的「公共 entry 4→7」事实声明与树不符；本设计落地 7-entry 并按两分文案修正记录。实现后复查须核对快照恰 7 键、三文件同一 C1 提交一致变更、记录文案与 SA8 条件 4 逐字一致。
3. S2/S4 已获无条件追认（升级触发器/披露义务保留）；ADR 0035 各条款被原样兑现而非修改。
4. **SA8 报告三处表述更正须在复查时落实**（§17 第 2 条；终验不得依赖该三处归因）。
5. **失败语义面新增分支需实证**：G13 全树条款/baselines.json 钉死（F-H/F-I/F-J/**F-K 改名注入**）、两态新红分支（F-F/F-G）、审计 logPath/目录纪律（N-6b/N-7b）须应红实红；证据审计与实盘布局的相容性（干净矩阵审计 exit 0 且 problems=[]、gates summary 全量 = 条件 9，14/21 合法口径）须实证；终验按条件 10 的核对口径执行（§11 依赖禁令段）。
6. **iteration 3 remediation 的四处失败语义/观测面变更须冲突门禁先行确认**（SA9-1 闭合判据原文「按冲突门禁确认新指纹口径后再改实现」；§0(d)）：① W-1 绑定原语从 index `write-tree` 换为 `trackedWorktreeFingerprint()`（marker `tree`→`worktree`、matrix `runTree`→`runWorktree`）——这是对已追认审计契约（条件 9 所依附的 §7.4）的原语级修订，虽属 SA9-1 判定必须做的收紧，仍需 SA8 复核钉值表述（如同 SA2-13 时 PV-8a 补注 `--no-renames` 的先例）；② W-2 `isTicketDoc` 收窄——PV-8a 钉值语义不变、实现从宽实现对齐钉值，属收紧非扩张（SA8 条件 8 禁扩张），备案待核；③ W-3 RESULT 行——条件 9 判据的可机判载体升级（成功路径新增 `problems=[]` 字面量），不改判据本体；④ W-4 `main()` 头部 `mkdirp` 移除——standalone 审计缺目录从「被预建目录掩盖」变为「响亮红」（N-10）。C4 的 `gates.mjs`/`run-baseline.mjs` 实际 diff 必须逐字对上本节与 §7.3.g/§7.4/§9.1 的形状；新增负控 F-L/F-M、N-8e/N-8f/N-8g、N-10、T-1/T-2 须应红实红（§11.1 步骤 3/5）。

## 评审修订映射

`wiki/raw/task_issue-472_sa2_review.md`（round 1，iteration 0，verdict=reject：BLOCKER 0 / MAJOR 4 / MINOR 8）逐条落实如下；iteration 1 为定向修订，骨架与已核实成立部分保持。

### MAJOR（SA2-1…SA2-4，逐条闭合）

| Finding | 修订位置 | 处理结果（闭合判据） |
|---|---|---|
| **SA2-1**（证据审计允许集与实盘布局不符：`<B>-typecheck.json` 聚合件、`fault-*/` 目录不在允许类 ⇒ 干净矩阵假红；gates/root-test cell 的 digest 期望未定义特例；`fault-*` walk 语义未定义） | §7.4 检查 2/3/7（cell 命名更正为 `<suite>.json`；digest 三类期望钉死——39 baseline cell 按 `cell.baseline`、gates=`'B3'`、root-test=`'B1'` 沿用 L881/L992 现值；允许清单六类 + `fault-*/` 递归仅容 `*.log`/`*.vitest.json`）；§3 新增实盘布局承接行；§15 SA2-1 行 | **已闭合**：允许清单以实盘 96 文件布局逐项对账；闭合判据 =「HEAD 干净树重跑 `--all --matrix` 内置审计 exit 0 且 problems=[]」+「N-6/N-6b/N-7/N-7b/N-8a–d 注入仍逐项 exit 1」；任何进一步放宽允许类回 SA8 追认 |
| **SA2-2**（release diff 缺机械全树绑定：13 gate pathspec 覆盖不到 11 包 `src/**`、非 facility 测试、`scripts/**`、`.github/**`；§14 DENY 归因「G2/G4/G13 把关」失实） | §7.3.g（G13 两态各增全树条款：tracked ⊆ 4 设施文件 + 8 release 文件 + `wiki/raw/task_issue-472*.md` glob，untracked ⊆ `wiki/**`，越界指名红）；§14 DENY 执法面归因逐行更正；§10 F-H/F-I 注入；§5 D-8（二选一取①机械绑定）；§11 步骤 8 降为双保险 | **已闭合**：采纳 SA2 推荐项①（收紧、S1 已追认面内、SA2 §15.1 授权并入 PV-8a、无需新裁决）；闭合判据 = F-H/F-I 注入 gates exit 1 并指名文件、G1′/G2/G4 同时仍绿、干净 C1/C2 树 13/13 绿；归因更正覆盖 §14/§15 及对 SA8 报告 §5 第 3 行的更正请求（终验不得依赖） |
| **SA2-3**（`baselines.json` 是三基线工件身份唯一定义源，但 G12 白名单允许其 diff、G13 不钉 ⇒ 混入改动可重定义工件身份且 13 gate 全绿；SA8 §5 第 1 行归因失实） | §7.3.f（G13 两态逐字节钉死）；§7.5 + §5 D-9（FACILITY_ALLOW 保持 PV-6 的 5 文件闭集，`baselines.json` 名义项转死条目 + G12 文案归因更正；不采纳「移除」替代案的理由）；§10 F-J 注入；§14 DENY facility 行更正 | **已闭合**：采纳「G13 钉死」方案（SA2-3 required change 之首），并按 SA2 §15.1 并入 PV-8b；闭合判据 = F-J 单字节注入 G13 红（G12 名义放行不救）+ 干净 C1/C2 树 13/13 绿；执行面归因更正（G13.f + acquire N-5，非「G12 零 diff」），终验不得依赖 SA8 §5 第 1 行 |
| **SA2-4**（部分 bump（7 之 k）、exact 后单文件回退、审计检查 6（logPath）、检查 7（换名旧工件）无负控注入；SA8「F-A…F-E 一一证伪」声明过度） | §10 新增 F-F/F-G/F-H/F-I/F-J、N-6b/N-7b 七行（各附应红点）+ 红灯捕获时机更新 + **覆盖声明口径更正**段；§7.4 检查 6（logPath 存在/containment/mtime 三判）；§11 步骤 4 | **已闭合**：四个新判定分支各有注入与应红点；覆盖声明以 §10 表（iteration 1 时为 F-A…F-J + N-5…N-9 含 b 变体；iteration 2 增 F-K 后为 **F-A…F-K**，见 rev2 节）为唯一权威口径，SA8 §3-S1 声明标注为过度并禁止终验引用 |

### MINOR（SA2-5…SA2-12，逐条处置）

| Finding | 处置 | 修订位置 |
|---|---|---|
| **SA2-5**（`slice(-12)` 在 13 gate 下静默丢 G1′/G2 两行；§16「自动继承 13 gate 输出」失准） | **采纳**：去掉截断，保留全部 `[gates]` 行（14 行）；不取 `slice(-14)` 替代案（magic 常量随 gate 数再漂移，D-10）；§16 相应更正并补 gates.json 消费方行 | §5 D-10、§14 ALLOW（run-baseline.mjs）、§16 |
| **SA2-6**（C3 入库范围未枚举，Controller 按行暂存有歧义） | **采纳**：C3 = `wiki/raw/task_issue-472*.md` 全集（brief/dispatch/SA6 契约/设计/SA8 报告/SA2 评审/sa10_spec 及后续轮同前缀产物），§14 ALLOW 改为 glob 单行 | §9 C3、§14 |
| **SA2-7**（run-marker 的 tree/porcelain 只记录不校验） | **采纳**：内置与 standalone 审计收尾均比对 `git write-tree === marker.tree`（抓运行中树漂移，T-4）；`porcelain` 维持披露面（**iteration 3 勘误：本行所写的 write-tree 比对经 SA9-1 判定只绑 index、不绑被测内容，已由 rev3 的 W-1 指纹原语取代——现行口径见 §7.4/§5 D-11，本行仅作 iteration 1 的历史处置记录**） | §7.4 检查 1、§5 D-11、§13 |
| **SA2-8**（须逐字回写 PV-4 numstat 口径与 SA8 条件 4 两分文案） | **采纳（逐字）**：§6.2/§7.3.c 改用 `git diff --numstat` 7 增 + 7 删口径；§8/§9.2/§4.2-4 逐字采用条件 4 两分文案，iteration 0 的单一修正口径作废（其表述会把修正写成「#471 未发生公共面扩展」，本身成为新的不准确记录） | §4.1/§4.2、§6.2、§7.3.c、§8、§9 |
| **SA2-9**（describe 文案 `vs base 279dba4` 重捕后失真；三处 base 串语义需澄清） | **采纳**：describe 去具体 sha；§7.1 新增四处 base 串语义分工成文（gates BASE 规范单源 / baselines.json base 出处记录 / ledger capturedAt 随台账冻结 / 测试 describe 文案随 §8 更正） | §7.1、§8、§14 |
| **SA2-10**（`RELEASE_BATCH.base` 与 `BASE` 常量重复钉值） | **采纳**：`RELEASE_BATCH = { base: BASE, … }` 引用同一常量，消除第二钉值 | §7.3、§14 |
| **SA2-11**（①「收窄不是放宽」表述失准；② §3 闭包表头易误读） | **采纳**：① §7.2 改为「白名单外语义不变 + 白名单内受控开口并移交 G13 更强执法」（SA8 §3-S1 ② 口径）；② 表头改「闭包内 workspace 依赖（相关子集；其余均不在闭包、不变）」并补 dsh-persistence/namespace-api/yjs-server 的全集注记 | §7.2、§3 |
| **SA2-12**（mtime 威胁模型应成文；可选 marker 龄窗口） | **部分采纳**：威胁模型成文（§7.4 末段：防意外过期/跨轮混用，不防对抗伪造；对抗面 = marker.head 单树绑定 + tree 比对 + 终验独立重跑）；**龄窗口不采纳**，理由：任意常数有长跑假红风险、对小步回拨无实质增益、该威胁已由对抗面承担——如威胁模型升级随新票裁决 | §7.4 末段、§12 风险表、§5 D-11 |

### rev2（iteration 2）—— SA2-13 闭合 + SA8 rev1 增量吸收（极小定向修订）

输入：`task_issue-472_sa2_review.md` iteration 1 复查（verdict=**reject**，唯一 blocking = **SA2-13**；SA2-1/SA2-3/SA2-4 = CLOSED、SA2-2 = PARTIAL（残余即 SA2-13）；rev1 已核实成立内容无回滚/削弱）与 `task_issue-472_design_conflict_report.md` §11/§12 增补（rev1 复查 verdict=**clear**：PV-8a/PV-8b 正式发布、PV-1…PV-7 不需重钉（PV-6 加注记）、交付条件增补 3′/9/10、勘误 E-1/E-2/E-3 生效、S1/S3 可进入实现）。rev1 其余内容原样保持，本节只登记增量修订。

| Finding / 增量 | 修订位置 | 处理结果 |
|---|---|---|
| **SA2-13**（`git diff --name-only` 默认 rename detection 对改名只列新路径、隐藏被删旧路径 ⇒ 把 gate 未覆盖文件改名进 `wiki/**` glob 可令 G13.g 判绿而实际删除未保护路径，且 13 gate 全绿；§7.3.g rev1「改名同样计入变更集 ⇒ 红」半句与 git 实际行为不符） | §7.3.g（原语显式钉 **`git diff --no-renames --name-only BASE`**，等价 `--name-status` 口径下 D/R/A 均按两路径计入；**单一原语纪律**成文——所有用于 allowlist/变更集裁定的 diff 一律 `--no-renames`，不得复用默认 rename 语义的 `changedPaths()` 变体做全树判定；rename ≡ 旧路径删除 + 新路径新增、两条都必须落允许集才可绿；absent 允许集显式「不含 8 个 release 文件」）；§7.3.1（absent 允许集）/§7.3.3（红清单加改名分支）/§7.3.a（逐文件 diff 口径）/§7.3.b（逐字节 = blob 直比、rename 免疫）/§7.3.c（numstat 口径）；§6.2 验证 1；§10 F-K 注入 + 红灯时机（F-H…F-K 于 C1）；§11 步骤 8；§14 ALLOW（gates.mjs）/DENY（.github 行）；§15 SA2-13 行；§0 S1 行与 §0(b)；§17/§18；§4.1 PV-8a 合并表述、PV-4 口径注记；头部 iteration 2 评审输入与自验记录 | **已闭合**：闭合判据（SA2-13 acceptance）= F-K 注入「应红实红 + 指名旧路径 `.github/workflows/ci.yml`」log（`.cache/issue-472-impl/`）+ 干净 C1/C2 树 13/13 绿不回归 + `--no-renames` 下现盘 6 个 wiki untracked / 两态允许集判定不变；**PV-8a 钉值语义「改名 ⇒ 红」不变，`--no-renames` 是兑现该钉值的机械配方**——不动架构决策、不动钉值语义、无需重开裁决（SA2-13 required change / SA8 §11.2 追认面同判） |
| **SA8 条件 9**（干净树内置证据审计零假红 + gates cell summary 全量） | §4.2 条件 9 行；§11 步骤 2（`problems=[]` + summary 全量 14 行判据）；§7.4 末段相容性验收（rev1 既有）；§16/§18.5（引用） | **已吸收**：判据 = HEAD 干净树重跑 `--all --matrix` 内置审计 **exit 0 且 `problems=[]`** + gates cell summary 保留**全量 14 行** gates 输出（对应 D-10 `slice(-14)`/末行截断修正的落地）；终验不得假设截断 |
| **SA8 条件 10**（勘误不依赖） | §4.2 条件 10 行；§11「条件 10 依赖禁令」段（最终验证计划显式钉死核对口径）；§12 风险表 SA8 行；§14 DENY facility 行（归因以 G13.f + N-5 为准，rev1 既有）；§17 第 2 条；§0(b) | **已吸收**：三处勘误（§5 行 1/行 3、§3-S1 过度声明）的依赖禁令在最终验证计划与 DENY/风险表显式成文——`baselines.json` 冻结按 **G13.f + N-5**、公共 API 冻结按 **G13.g（`--no-renames`）+ G2/G4 + 步骤 8**、负控覆盖按 **§10 表（F-A…F-K）** |
| **SA8 PV-8a 精确口径**（tracked ⊆ {4 设施文件 + 8 release 文件 + `wiki/raw/task_issue-472*.md`}；untracked ⊆ `wiki/**`；**absent 态（C1）不含 release 文件**） | §4.1 PV-8a 行（按 SA8 §11.3 逐字重写并与 `--no-renames` 原语合并表述）；§7.3.g（absent 允许集表述同步） | **已吸收**：与 `--no-renames` 合并表述完成，钉值语义不变 |
| **SA8 PV-8b 执行面**（`baselines.json` 逐字节冻结由 **G13.f + `acquire.mjs` N-5 完整性负控**共同承载） | §4.1 PV-8b 行（按 SA8 §11.3 逐字对齐：含 base 文档字段/integrity/dshCommit/suites 与死条目口径）；§7.3.f/§7.5（rev1 既有执行面归因） | **已吸收**：执行面表述与 SA8 §11.3 逐字一致 |
| **SA8 PV-6 注记**（gate 数仍 13、G12 闭集仍恰 5 文件、`baselines.json` 为白名单内「名义项→死条目」） | §4.1 PV-6 行（原值不变 + 注记，非重钉；A1-6 引文按 SA8 §8.1 原文补全——顺手对齐 SA2-17） | **已吸收**：非重钉注记；f/g 为 G13 子句、gate 数不漂移；G12 detail 文案更新要求保持（§7.5） |
| SA8 条件 3′（负控面重述） | §4.2 条件 3 行（重述 + 扩至 F-K；F-G 时机 = C2 形成后，以 §10 为准） | 已吸收：SA2-14 指出的 §4.2-3 与 §10 措辞张力随重述统一 |
| SA2-15（勘误已提前生效，设计文本滞后无害） | §0(b)、§12 风险表、§17 第 2 条（改写为「已生效」，实现记录按 SA8 现行版执行） | 顺手对齐（非义务）：设计不再写「待实现后复查落实」 |
| SA2-16 / SA2-17（非阻塞观察） | —（不构成修订义务） | 记录在案：catalog 漂移分支仍无直接注入（G13.e + G13.g + 终验步骤 8 手工字节核对间接覆盖；实现后复查不得宣称「catalog 漂移分支已注入证伪」）；PV-6 的 A1-6 引文缩写已顺手对齐 |

### rev3（iteration 3）—— 终审 reject 的定向 remediation（SA9-1…SA9-5 / B-1…B-4 逐条闭合）

输入：`wiki/raw/task_issue-472_sa9_standards.md`（rg-472-final-iter0，verdict=**reject**，MAJOR 4 + MINOR 1）与 `wiki/raw/task_issue-472_sa10_spec.md`（同组，verdict=**reject**，blocking 4）。rev2 骨架与终审已核实成立面（提交拆分 4+8+8、release 数字、生产零 diff、4+28 披露无扩账、`--no-renames` 原语覆盖、surface 测试质量）保持不变；本节登记增量修订。逐条闭合映射：

| Finding | 修订位置 | 处理结果（闭合判据） |
|---|---|---|
| **SA9-1**（MAJOR：run-marker/审计的 `git write-tree` 只绑 index、未绑被测 working-tree 内容；未暂存 tracked 漂移可审计全绿；§7.4/D-11 归因错误；N-8c 未覆盖未暂存修改） | §7.4（**W-1**：`trackedWorktreeFingerprint()` 原语 + 代码块 + 确定性/排除 untracked/删除计入论证；marker `{startedAt, head, worktree, porcelain}`，`tree` 字段移除；审计检查 1 两模式均比对指纹；`matrix.json runTree`→`runWorktree`；与 `--no-renames`/PV-8a 关系成文——指纹是内容树构建非 diff，G13.g 形状面与指纹运行面互补；R 验证期望值语义 = 实际被测内容树、禁止 BASE/HEAD tree 冒充，历史注记 C1 轮 `b41d9e73` ≠ 实际 `da3f368f`）；§5 D-11（归因更正 + 单字段单语义）；§0(d)/§18.6（冲突门禁先行确认）；§10 **N-8e/N-8f/N-8g** 三负控；§11.1 步骤 2（`marker.worktree === runWorktree === R′ tree`）；§13/§15/§16 连带 | **已闭合（设计面）**：闭合判据 = C4 落地后三负控应红实红（矩阵后未暂存修改不 add ⇒ standalone exit 1；运行中漂移 ⇒ 内置审计 MATRIX FAIL；同 tree HEAD 移动 ⇒ 仅 head 红、指纹不红）+ 干净矩阵审计 exit 0 不回归 + R′ 复验指纹对应实际内容树。原语本轮一手实测（worktree `59a60b0f…` ≠ HEAD tree `b898d119…` 而真实 index write-tree = HEAD tree——旧失效模式当场复现，§头部自验记录） |
| **SA9-2**（MAJOR：终验矩阵未按强制口径固定 pnpm 10.28.2；「非判据偏离」分类与强制条件冲突；C2 ⑦ 归因失实） | §11.1（**W-6**：shim 置 PATH 首位的具体命令与环境注入、`pnpm --version` 落盘、同会话全部子进程继承、完整 `--all --matrix` 不可子集替代、`pnpmProbe.exitCode===0`、counts 实际值原样、`failedUnexpected=[]`、台账外新红停手不扩账不 override）；§4.2 条件 6 行（落实口径）；§9.1 C5（更正 C2 ⑦ 归因与 SA7 分类）；§15 SA9-2 行 | **已闭合（设计面）**：闭合判据 = R′ 上固定 pnpm 完整矩阵重跑全绿 + `pnpmProbe.exitCode=0` + 落盘 10.28.2 + counts 原样披露 + C5 更正记录在案（与 B-3 同根，一次执行闭合两项） |
| **SA9-3**（MAJOR：G13.g tracked wiki allowlist 实际放宽到 `wiki/**`，超出追认钉值；缺 staged 负控） | §7.3.g（**W-2**：`isTicketDoc` = `path.posix.dirname(p) === 'wiki/raw'` ∧ basename 正则；`wiki/` 根与更深层判红；untracked 分量不动；对齐钉值 = 收紧非扩张）；§4.1 PV-8a 行（机械判定同步）；§10 **F-L/F-M** 两 staged 负控（期望红点 + 正向对照 C3 文件保持绿）；§16 isTicketDoc 行 | **已闭合（设计面）**：闭合判据 = F-L/F-M 注入 G13.g 各自指名判红（gates exit 1）且 G1′/G2/G4/G12 仍绿、C3 已交付 wiki 文件正向保持绿、untracked ⊆ `wiki/**` 判定不变 |
| **SA9-4**（MAJOR：条件 9 要求落盘可机判空 `problems` 列表，成功路径只打印 PASS；N 系需显示非空数组） | §7.4（**W-3**：`printAudit` 两路径均输出 `[run-baseline] EVIDENCE AUDIT RESULT (<context>): exit=<0|1> problems=<JSON 数组>`，成功含字面量 `problems=[]`；落盘位置 = 既有日志通道（内置矩阵日志 / standalone 日志），**不新增 artifact** ⇒ 审计目录允许集零改动、无新越类文件；N 系负控经同一函数自动显示非空数组）；§4.2 条件 9 行（可机判载体升级）；§16 printAudit 行 | **已闭合（设计面）**：闭合判据 = C4 落地后干净矩阵 + standalone 重跑的两条日志各含恰一行 RESULT（成功 `problems=[]` + exit 0）且 N 系负控 RESULT 非空 + exit 1 |
| **SA9-5**（MINOR：① gates.mjs L5/L7 注释仍按旧零 diff/plugin.ts 语义；② run-baseline L901-903「13 gates = 14 lines」与 21 行实际不符；③ standalone 缺目录死 guard） | §9.1 C4（W-4 三项注释/guard 修正入 C4 范围）；§14 ALLOW 两设施文件行；§16 三行（gates cell 注释行 / 缺目录前提行 / summary 消费方行——「完备性是判据、行数不钉常数，现盘 21 行」）；§10 **N-10**（缺目录/空目录负控，W-4 删除 `main()` 头部 `mkdirp(EVIDENCE)` 后 guard 复活、各写证据路径自建目录的依据：writeRunMarker L1072 / writeEvidence L563 / gates L889 / root-test L922） | **已闭合（设计面）**：闭合判据 = C4 落地后注释与实际语义一致（zero-diff 外 + 白名单内 G13 钉形状；tracked 仅 package.json、四 fixture 零 diff；summary 行数不钉常数）+ N-10 响亮 exit 1 且 RESULT 非空 |
| **B-1**（blocking：AC3/A3-5 缺「篡改 tarball 字节」「删除一个 tarball」两项真实负控） | §10 **T-1/T-2**（在 R 的真实打包输出一次性副本上：恰一 tarball 中位偏移翻 1 字节 / 删恰一 tarball；`publish:verify` 默认模式 exit ≠ 0 且指名受影响包；恢复后 15/15 再绿 + reproducible 15/15；放置位置 `.cache/issue-472-impl/tarball-probe-{tamper,delete}/` 与终验 `.cache/issue-472-final/` 同款；sha256 前后表 + 日志 + `git status` 复核；不得以源码测试/matrix/G13 替代）；§11.1 步骤 5；§13 tarball 完整性探针数据流行；§15 B-1 行 | **已闭合（设计面）**：闭合判据 = T-1/T-2 应红实红（ERROR 行按文件名指名包）+ 恢复后 15/15 + 证据齐全；reproducible 不读 artifacts 的披露成文（本轮实测） |
| **B-2**（blocking：release 记录 ⑦ 口径混同 + 缺 R 的 HEAD/tree） | §9.1 C5（**W-7**：`--allow-empty` 记录更正提交；口径两分 = 「未固定 PATH」（C1 5959/5991 = 32 = 4+28 与 SA7 终验同口径）vs「固定 10.28.2」（C2 预验 5987/5991 = 4 frozen + remediation R′ 重跑实际值）；写入当前 release candidate 完整 HEAD/tree（= C4 hash + tree，撰写时已知、无自指）；声明 AC1–AC4 证据全部再绑定 R′、旧树绿不沿用）；§11.1 记录与回填更正段；§15 B-2 行 | **已闭合（设计面）**：闭合判据 = `git show -s --format=%B <C5>` 含两分口径（每个 counts 标注所属口径）+ R′ 完整 HEAD/tree + 再绑定声明；终审组对 R′ 上的新证据重裁 |
| **B-3**（blocking：交付条件 6 的 pnpm 固定未落实；同 SA9-2） | 同 SA9-2 行（§11.1 W-6 + §4.2 条件 6 落实口径 + §15） | **已闭合（设计面，与 SA9-2 同一执行面）**：一次固定 PATH 完整重跑同时闭合两条 |
| **B-4**（blocking：GitHub 回填缺失——不属本设计面） | §9.4（回填证据包清单 + 触发条件 + 职责边界：由有权 Controller/Owner 在终审绿且 B-1…B-3 闭合后执行；#468 open/Parent 不变、#464–#466 保持撤回、前后 `gh api` JSON 快照；SA 无 GitHub 写权限） | **设计面闭环**：职责与内容边界成文，执行主体明确为控制器/发布侧；不作为 SA 完成性声明（SA10 §6 B-4 原文同判） |

**rev3 约束重申**：不为消红扩大任何 allowlist（W-2 是收窄；W-3 不新增落盘工件）；不放松 fail-closed（W-1/W-4 都是把原本不可达/误导的判定变成响亮红）；不改 ADR/CONTEXT/协议；不改 `scripts/**`、`.github/**`（T-1/T-2 只运行既有脚本）；不重复读取或重写历史 wiki 工件（本设计只原位修订 + 追加本节）；不改写已交付提交（C4/C5/C6 append-only）。
