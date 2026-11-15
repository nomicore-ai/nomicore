# SA10 Spec Review — issue #472：Cordis rc.12 三基线回归与 Nomicore `0.5.0` 收官

- 任务对象：`nomicore-ai/nomicore#472`，round 1，spec-review iteration 0。
- 审查范围：`git diff --no-renames 6be891a3a0cb32fe21c3a6bf485f33428052ce7b..d5cf4850e317b51df9b50c33f8487d832565f8d6`。
- 交付提交：C1 设施 `119831274f37ebfee2f157398bb866270f4726d3`；C2 = R `e3d58812170a23686103db126f989cdef77b2101`（tree `bdbdd7a41f743048b9b4ac01f2f252971df79ae8`）；C3 wiki `d5cf4850e317b51df9b50c33f8487d832565f8d6`。
- 方法：只读核对最终 diff、提交正文、原始 `.cache` 证据与 GitHub 实况；未修改代码/设计/测试，未运行测试或服务，未执行任何 GitHub 写操作。
- **verdict：reject**。
- **blocking：4**（B-1 AC3 负控缺失；B-2 AC4 release 记录失实/缺项；B-3 交付条件 6 的 pnpm 固定未落实；B-4 AC6/AC7 的 GitHub 回填缺失）。

## 1. 总结

生产与发布主体大部分已按契约落地：R 上确有独立重跑，41 cells 全为 `pass`，三基线各有 15-project typecheck 与完整 12-suite 行为证据，证据审计和工件/通道负控有效；真实 tarball 三项门禁均绿；七包版本、manifest、依赖冻结和公共契约冻结形状正确。

但不能据此判定 Issue 全部收官：

1. SA6 A3-5 与设计 §15 明确要求的「篡改 tarball 字节」和「删一个 tarball」负控均无执行证据。
2. `chore(release)` 正文把 C1 的 `5959/5991` 错置于「固定 pnpm 10.28.2 下」；原始证据显示该计数对应 32 红（4 frozen + 28 environment），而固定 pnpm 的 C2 预验才是 `5987/5991`。正文还未按设计 §9 写入 R 的实际 HEAD/tree hash。
3. 最终 R 矩阵的 root-test 仍记录 `pnpmProbe.exitCode=1`、当前 pnpm `11.28.5`，违反「全部 pnpm 语义固定 10.28.2」的硬交付条件。
4. 本审查只读实读 GitHub：#472 评论仍为 0；`mabf/issue-472` 没有集成 PR；Parent PR #469 也没有结果评论。wiki 证据不能替代 AC6 所要求的实际回填。

因此 SA7 的动态结果可以支持其已执行的 D1–D15，但不能消除上述未执行项、记录矛盾与外部回填缺口。

## 2. AC1–AC8 逐条裁决

| AC | 裁决 | 一手证据与判定 |
|---|---|---|
| **AC1** | **approve**（AC 本体；另有条件 6 阻断 B-3） | R 的真实重跑成立：`.cache/cordis-baselines/evidence/run-marker.json:2-5` 的 `head=e3d5881…`、`tree=bdbdd7a…`；`.cache/cordis-baselines/evidence/matrix/matrix.json:2-4` 的 `runHead/runTree` 与 R 完全相同。`.cache/issue-472-final/02-matrix-all.log:5-48` 列出 B1/B2/B3 各 13 cells、合计 41 cells 全 pass，末尾为 `EVIDENCE AUDIT PASS` 与 `MATRIX PASS: 41 cells`。三份 typecheck cell 各 15 projects、全部 exit 0；12 suites 每基线齐全。repeat 证据不是只留最后一次：例如 `.cache/cordis-baselines/evidence/B1/replication-lifecycle.json:77-152` 有 3 次 34/34、每次 `23/23`、`coverage=true`、`foreignUnits=[]`、`issue420.present=true`。gates 为 13/13、`G13 state=exact`；summary 21 行含全部 13 gate 行与绿态汇总，符合 SA8 §13.3 的 14/21 合法口径。root-test 是**台账 pass 而非全绿**：`matrix.json:10851-10876` 记录 `problems=[]`、`failedUnexpected=[]`、counts `5959/5991`、32=4+28、原生 exit 1；不作 root-test/CI 全绿声明。 |
| **AC2** | **approve** | 工件重新 acquire：`.cache/issue-472-final/01-acquire-all.log:17-40` 固定 B1/B2/B3 版本与 DSH `1511a6e…`，B3 source provenance digest 为 `9d663355…`。三基线解析路径分别位于独立 overlay，B2/B3 即使同标 Cordis 4.1.0 也不混用；B3 `provenance.json:11-19` 还逐名覆盖双 realpath、恰一份 Cordis、commit/clean、ls-tree、构建配方与输出哈希。Root 通道：B1/B2 `root-probe.json:55-75` 均 `legacy`、symbol absent；B3 `root-probe.json:55-75` 为 `symbol`、`contextRootStatic=symbol`、legacy absent/throw，命中通道 `timeout=function`。四 fault 均外层 0、内层 fail（`.cache/issue-472-final/03-fault-summary.txt:1-12`）；具体 cell 也真实变红，如 B3 fallback、B3 substitute-npm、B2 substitute-rc12、B3 legacy-shim。N-5 integrity 下调 exit 2、恢复 exit 0（`.cache/issue-472-final/08-n5-n8c-n9-summary.txt:1-4`）。证据缺失、损坏、过期、digest 跨基线、旧矩阵与跨树均应红实红：`audit-N-6.log`、`audit-N-7.log`、`audit-N-8a.log`、`audit-N-8b.log`、`audit-N-8d.log` 以及 `08-n8c-n9-redo-summary.txt:1-10`。N-8c 首次红点错位已重做得到预期 head+tree 双红，没有把错误红点冒充目标证据。 |
| **AC3** | **partial**（B-1） | 正控与边界成立：`.cache/issue-472-final/05-pack.log:1-95` 是真实 `pack:local`，产生 15 tarball；`05-publish-verify.log:1-75` 为默认模式、7 组 dry-run、最终 `verified 15 publishable tarballs`；`05-release-gates-summary.txt:1-15` 明确 pnpm 10.28.2、registry-integrity 环境覆盖 0 次、verify/reproducible 均 exit 0；`05-publish-reproducible.log:1-5` 为 15 包可复现。`05-e2e-chain.log:20-65` 证明版本→packed 依赖→manifest→exports/bin→默认条件 dist 加载，`:66-129` 证明 7 个新版本尚未发布（404 是预期，不是实际 npm publish）。源码 worktree 未替代 tarball 门禁。缺口在 **A3-5**：现有 F-C/F-D 只证明 stale/未再生 manifest 红（`falsify-F-C-publish-verify.log:44-45`、`falsify-F-D-publish-verify.log:1-9`）；`release-gates.sh:16-34` 只有正控三连与 digest 拷贝。最终及实现证据目录均无「篡改 tarball 字节」或「删除一个 tarball」的执行日志，故 A3-1…A3-5 未全部满足。 |
| **AC4** | **partial**（B-2） | PV-3 七包版本表逐项准确：persistence/dsh-persistence/namespace-runtime/namespace-registry `0.4.0→0.5.0`，namespace-api `0.3.0→0.4.0`，ws-replication/yjs-server `0.5.0→0.6.0`；最终 numstat 为每 manifest 1/1、发布 manifest 7/7。`artifacts/local-packages/manifest.json:1-17` 为 15 键且新 filename 正确。公共生产面相对 BASE 零 diff；`public-surface.base.json:1-95` 恰 7 键，`cordis-public-surface.test.ts:22-50` 对 7 entry 做严格运行时相等断言；`06-lockfile-generate.log:9-17` 证明 schema 生成检查与生成物零 diff。R 上 guard-proxy/unload/contract 等矩阵证据支撑服务名、wire 与持久化布局保持。**记录面未合格**：`git show -s --format=%B e3d5881` 的 ⑦ 写「固定 pnpm 10.28.2 下 …（C1 5959/5991、C2 预验 5987/5991）」，但 SA3 §4.4 与 SA7 §6.2 均证明 `5959/5991` 是未固定 PATH 的 32 红口径，固定 pnpm 的 `5987/5991` 才只有 4 个 frozen 红。该句与一手证据矛盾，违反 A4-3⑦/A4-5。设计 §9 还要求 R 的 HEAD/tree hash，正文只有 BASE 与「本提交为 R」，没有 `e3d5881…`/`bdbdd7a…`。SA7 报告中的正确披露不能 retroactively 修复 release 正文本身的强制记录缺陷。 |
| **AC5** | **approve** | 对 BASE 与最终提交的全部根/package/app/domain manifest 逐 JSON 比较：`dependencies`、`devDependencies`、`peerDependencies`、`optionalDependencies`、`patchedDependencies` 全部零 diff；出现的 Cordis/Timer range 仍分别为 `^4.0.1`/`^1.1.3`，没有 dependency↔peer 迁移。最终 diff 只有七个 version 行；`pnpm-lock.yaml` 与 `scripts/package-catalog.mjs` 不在变更集中。`.cache/issue-472-final/06-lockfile-generate.log:1-8` 的 frozen lockfile 安装 exit 0 且 lockfile diff exit 0；`07-shape-audit.log:30-37` 另作逐字节复核。没有发现必须改变安装契约才能闭环的情况，故 AC5 停手条件未触发。 |
| **AC6** | **reject**（B-4） | A6-3 保护面通过：本审查 `gh api repos/nomicore-ai/nomicore/issues/468` 实读仍为 `state=open`，末尾 `## Parent` 仍为 `PR #469（spec/468-cordis-rc12-root）`；Parent PR #469 仍 open、head 仍 `6be891a`。但 A6-1/A6-2 均未执行：`gh api …/issues/472/comments --paginate` 无条目；`gh pr list --head mabf/issue-472 --state all` 返回 `[]`；Parent PR #469 的 issue comments 也为空。工作区已有 R、SA7 与数字摘要，说明证据**可回填**，不代表结果**已回填**。SA6 §12.6 明文禁止用 wiki 内部记录替代 GitHub 回填。 |
| **AC7** | **partial**（与 B-4 同根，不重复计数） | 已交付文本的非目标声明本身合格：release 正文 ⑧ 明确不执行真实 MABF/DSH 部署验收、不修改/移除 Host 本地 patchedDependencies、未执行 npm publish；SA7 §6/§9 也只记录本地验证与 dry-run，没有 Host 部署或 patch 可删除的完成性声明。最终 diff 无 Host/patch 改动。可是 SA6 A7-1 还要求 Issue #472 与集成 PR 两个载体均有同义声明；二者因 B-4 不存在，故严格按契约为 partial。Issue 正文要求的核心范围排除已在 release 与 final-verification 中兑现，未另行虚构 Host 成果。 |
| **AC8** | **approve** | 本审查只读实读 #464/#465/#466：三者均 `state=closed`、`state_reason=not_planned`，原撤回评论仍在，内容均明确指出错误 DSH rc.3 审计锚点。release 正文 ⑨ 仅声明不复用其撤回证据；最终 diff 无 ADR 修改、无新增/复活 POC。当前验收引用的是本轮重新 acquire 的精确工件和 R 上实跑，不以 #464–#466 或 rc.3 tag `38a6a5c965` 作证据。 |

## 3. PV-1…PV-8b 与交付条件 1–10

### 3.1 Pinned values

| 钉值 | 裁决 | 证据 |
|---|---|---|
| PV-1 BASE | pass | `gates.mjs` 与全部形状日志使用 `6be891a3a0cb32fe21c3a6bf485f33428052ce7b`；`07-shape-audit.log:1-14` 同原语复核。 |
| PV-2 八文件 release allowlist | pass | 最终 release 文件恰为 7 个 package.json + `artifacts/local-packages/manifest.json`，无第 9 个 release 文件。 |
| PV-3 七包版本表 | pass | 最终逐文件 diff 均恰 1 删 1 增，from→to 与 AC4 表一致；G13 exact 行在 matrix gates summary 中。 |
| PV-4 manifest 7+7 | pass | 本审查 `git diff --no-renames --numstat BASE..d5cf485` 得 manifest `7 7`；`07-shape-audit.log:50-58` 同值；manifest 15 键无旧名。 |
| PV-5 台账/catalog 冻结 | pass | `07-shape-audit.log:30-37` 逐字节相同；F-E 台账扩名应红实红。 |
| PV-6 13 gates / 41 cells / G12 5 / G5 7 | pass | `02-matrix-key-fields.txt:1-8` 为 41 cells 全 pass、13 gate 行与绿态汇总；G12/G5 行明确 5 文件闭集与 7 entries。 |
| PV-7 七公共 entry | pass | 快照与测试均含规定七项；三个耦合文件在同一 C1 `1198312` 落地。 |
| PV-8a 全树 `--no-renames` 绑定 | pass | 最终 diff 恰 4 设施 + 8 release + 8 wiki；生产 src/domains/docs/scripts/.github 零 diff。F-H/F-I/F-K 均唯 G13 红，F-K 指名旧路径 `.github/workflows/ci.yml`（`08-f-series-summary.txt:32-47` 及对应详 log）。 |
| PV-8b baselines.json 冻结 | pass | 以现行口径 **G13.f + acquire N-5** 核：`07-shape-audit.log:30-37` 字节不变；F-J 单字节改动唯 G13 红而 G12 绿；N-5 acquire exit 2、恢复 0。 |

### 3.2 交付条件

| 条件 | 裁决 | 说明 |
|---|---|---|
| 1 C1 耦合文件同提交 | pass | `1198312` 恰含 gates/run-baseline/快照/surface 测试四文件；快照三元组一致。 |
| 2 absent/exact 两态自洽 | pass | C1 有 absent 13/13；R 有 exact 13/13、G6 clean；AC 证据只采用 R 的 exact 矩阵。 |
| 3′ F-A…F-K + N-5…N-9 负控 | pass | `08-f-series-summary.txt` 与 N 系日志逐项应红实红，干净 exact 对照 13/13；没有发现应红实绿。AC3 的 tarball 负控是另一项 A3-5 缺口，不能借此表推定已执行。 |
| 4 #471 两分修正 | pass | release 正文与本报告 §4 均使用两分口径，未改写 caede8a 或历史 wiki。 |
| 5 G5 重捕失败须停 | pass（未触发） | 7-entry 捕获成功，没有静默降级为 4 entry。 |
| 6 发布证据纪律 / 全 pnpm 固定 | **reject（B-3）** | publish 默认模式、未真实发布等满足；但 R 的 root-test 原始诊断是 pnpm 11.28.5 拒绝 workspace，且 28 环境红仍在，违反「全部 pnpm 语义固定 10.28.2」。 |
| 7 S2 触发器与 AC6 知会披露 | **partial（并入 B-4）** | 没有 owner 新要求或统一 minor/CHANGELOG 触发；但版本矩阵读法与方案 A 的知会性披露尚未回填到 Issue/PR。 |
| 8 文件范围 | pass | 最终 20 文件均在 ALLOW；生产 src 零 diff，无 scripts/CI/ADR/台账越界。 |
| 9 审计相容性与全量 summary | pass | 干净矩阵审计 exit 0、`problems=[]`；summary 为 21 行（7 G10 明细 + 13 gate + 1 汇总），符合 SA8 §13.3，不缺 G1′/G13，无 magic 截断。 |
| 10 勘误依据禁令 | pass | 本审查未把三项已勘误表述作为依据：baselines 冻结采用 G13.f+N-5；公共面采用 G13.g 全树 `--no-renames` diff + G2/G4 + 手工最终 diff；负控采用 F-A…F-K + N-5…N-9 实际日志，且没有宣称 catalog 漂移已有直接注入。 |

## 4. 条件 4 所要求的统一两分文案

本报告采用以下事实口径，与 release 正文一致：

> #471 提交 `caede8a` 所称「公共 entry 导出名集合由 4 扩到 7」在快照/测试文件层面未发生（树内仍为 4 entry），其覆盖由 #471 以 3 条 runtime 严格相等断言等价承载（SA10 记录 7/7）；7-entry **快照**由 #472 设施提交落地，现快照与记录一致。

一手交叉证据：`git show --name-only caede8a` 不含 `public-surface.base.json` 或 `cordis-public-surface.test.ts`；`wiki/raw/task_issue-471_sa10_spec.md:218-221` 明确记录「4/7 + 3/7 = 7/7」且未修改冻结快照；本票 C1 才把快照与 surface 测试扩为 7。既不宣称 #471 已交付 7-entry 快照，也不宣称 #471 未做公共面覆盖扩展。

## 5. 停手条件与完成性声明核查

- 未发现设计 §12 的停手条件被触发后被掩盖：无依赖范围/归属变更，无公共生产契约变更，无 Host 部署需求，无 owner 新流程要求；7 包 bump 后发布门禁转绿；#468/#464–#466 状态合规；N-9 合成新红确实使 cell fail；没有负控「应红实绿」。
- N-8c 首次执行红在错误原因，但报告已披露并以正确 head+tree 双红重做；这不是应红实绿。
- 因此本次 **reject 不是因为 §12 停手条件被触发**，而是因为关键 AC/硬交付条件存在未执行、未回填或记录失实项。
- 不得把「41 cells pass」写成「root-test/CI/全部既有测试全绿」；root-test 原生 exit 1、32 个台账红必须继续披露。
- 不得把 `publish:verify` 的 dry-run 写成真实 npm 发布；7 个新版本在 registry 查询中仍 404，这是本阶段预期状态。
- 不得把 wiki/本地提交中的可回填证据写成 Issue/PR 已回填。

## 6. Blocking 缺口与闭合判据

### B-1 — AC3 / A3-5：两个真实 tarball 负控未执行

- **缺口**：只有 stale/未再生 manifest 的 F-C/F-D；没有篡改 tarball 字节与删除一个 tarball 的应红实红证据。
- **闭合判据**：在 R 的真实打包输出的一次性副本上分别执行两项注入；`publish:verify` 默认模式必须非零并指名受影响包，恢复后 15/15 再绿；保留前后日志、digest 与清理证据。不得以源码测试、matrix 或 G13 替代 tarball 门禁负控。

### B-2 — AC4 / A4-3⑦、A4-5 与设计 §9：release 记录不准确且缺 R 身份

- **缺口**：正文把 C1 `5959/5991` 错称为固定 pnpm 10.28.2 下的计数；未分解该口径的 32=4 frozen+28 environment；正文未写 R 的实际 HEAD/tree hash。
- **闭合判据**：按既有 release 流程形成更正后的变更记录，明确区分：未固定 PATH 的 C1/R 终验口径 `5959/5991`（32=4+28）与固定 pnpm 的 C2 预验口径 `5987/5991`（4 frozen），或记录重新执行后的实际值；写入当前 R 的完整 HEAD 与 tree。若因此改变 R，则 AC1–AC4 证据必须全部重新绑定新 R，不能沿用旧树绿。

### B-3 — SA8 条件 6 / 设计 §11：最终矩阵未全部固定 pnpm 10.28.2

- **缺口**：`matrix.json:10871-10876` 的 `pnpmProbe.exitCode=1` 和 v11.28.5 错误是直接反证；SA7 §6.2 也承认矩阵使用默认 shell。
- **闭合判据**：在同一 R 上将已记录的 pnpm 10.28.2 shim 置于矩阵及其所有子进程 PATH 首位，重跑完整 `--all --matrix`；`pnpmProbe` 必须 exit 0，41 cells、审计和 gates 仍全 pass；按实际值更新 root-test counts，并保留 `failedUnexpected=[]`，不得预设或扩账。同步更正 release/回填/终验的工具链表述。

### B-4 — AC6（并影响 AC7 与条件 7）：GitHub 实际回填缺失

- **缺口**：#472 无评论；`mabf/issue-472 → spec/468-cordis-rc12-root` 集成 PR 不存在；Parent PR #469 也无结果评论。只有本地可回填证据。
- **闭合判据**：由有权限的后续 Controller/Owner 在 final verification 绿且 B-1…B-3 闭合后，向 #472 与集成 PR 回填同一组结果：3×15 typecheck、41/41、工件/digest/通道与负控、15 包三项发布门禁、七包版本与 R、公共契约冻结、实际 known-red、非目标、#464–#466 不复用，以及 S2 版本矩阵和方案 A 的知会披露。保留 GitHub JSON 快照；#468 必须继续 open 且 Parent=PR #469，#464–#466 继续保持撤回。该工作不由本 SA10 执行。

## 7. 最终裁决

**reject；blocking = 4。** AC1、AC2、AC5、AC8 approve；AC3、AC4、AC7 partial；AC6 reject。B-1…B-4 全部闭合并重新核对受影响的 R 证据后，才可改判 approve。

---

# SA10 Spec Review — round 1 / spec-review iteration 1（remediation 后终审重裁）

- 任务对象：`nomicore-ai/nomicore#472`；dispatch `sa-8bfa8f3c-edec-4232-aeac-283ef1697ecb`；reviewGroup `rg-472-final-iter1`。
- 审查范围：`git diff --no-renames 6be891a3a0cb32fe21c3a6bf485f33428052ce7b..ae0dc6dfcef24150156d665c238fcb97877fa4e2`。
- 交付链：C1 `119831274f37ebfee2f157398bb866270f4726d3` → 旧 R `e3d58812170a23686103db126f989cdef77b2101` → C3a `d5cf4850e317b51df9b50c33f8487d832565f8d6` → **C4 = R′** `a7fb8ffe562febb0bdcf8cad632723a3cf90559e`（tree `91c1c49a38746a9314955d632989939aad418379`）→ C5 `66a35f6ed96873ad1cf2160570711b7a820bc84d` → C6a `ae0dc6dfcef24150156d665c238fcb97877fa4e2`。
- 方法：只读复核提交图、提交正文、最终 diff、R′ 原始 `.cache` 证据与 GitHub 实况；未修改代码/设计/测试，未运行测试或服务，未执行 GitHub 写操作。旧 R 的绿仅作历史记录，本节不以其抵销 R′ 证据。
- **verdict：approve（remediation 终审通过；不是 Issue #472 的关闭许可）。**
- **blocking：0**；**MINOR：3**（均为证据展示/编排脚本的非阻断口径瑕疵，见 §5）；**结构性 pending：1 项**（AC6/AC7 共用的 GitHub 回填义务，按 SA8 条件 12 不计新增 blocking）。

## 1. 独立复核的硬事实

### 1.1 提交身份与范围

本审查以 `git show`/`git diff-tree` 逐提交复核：

1. C4 恰改 `gates.mjs`、`run-baseline.mjs` 两个设施文件，parent = C3a，tree = `91c1c49a…`。
2. C5 是 parent = R′ 的 message-only `chore(release)`，无文件变更；实测 `66a35f6^{tree} = a7fb8ff^{tree} = 91c1c49a38746a9314955d632989939aad418379`，满足条件 11 的机械完整性条件。
3. C6a 仅改 7 个 `wiki/raw/task_issue-472*.md`；R′→C6a 的非 wiki diff 为空。BASE→C6a 全集为 **22 文件 = 4 facility + 8 release + 10 wiki**；生产 `src/**`、`domains/**`、`docs/**`、`scripts/**`、`.github/**`、lockfile、catalog、台账和 `baselines.json` 均无越界变化。
4. C1 恰含四个耦合设施文件；C2 恰含七个版本行与 manifest；没有 rebase/reword 旧提交，也没有 scope creep。

### 1.2 R′ 动态证据是本轮新证据，而非旧 R 绿沿用

- `.cache/issue-472-final/iter1/00-environment.txt:1-8` 固定验证起点为 R′ HEAD/tree；`00-pnpm-version.txt:1` 为 `10.28.2`。
- `.cache/issue-472-final/iter1/02-matrix-all.log:1-49` 是完整 `--all --matrix`：B1/B2/B3 各 13 cell + gates + root-test，末尾 `MATRIX PASS: 41 cells`；第 47 行是唯一的内置审计 RESULT `exit=0 problems=[]`。
- `.cache/cordis-baselines/evidence/run-marker.json:2-5` 与 `matrix/matrix.json:2-4` 交叉相等：`runHead/marker.head = a7fb8ff…`，`runWorktree/marker.worktree = 91c1c49a…`；marker 只有 `{startedAt,head,worktree,porcelain}`，没有旧 `tree` 字段。
- `root-test/root-test.json:6001-6007,6059-6080`：实际 `5987/5991`、4 个 frozen test-d 红、`failedUnexpected=[]`、`pnpmProbe={exitCode:0,stdout:"10.28.2"}`；`exitCode=1` 是原生 vitest 的既有红，cell 是**台账 pass**，不是 root-test/CI 全绿。
- `gates/gates.log:298-311` 为 G1′–G13 全绿、G13 `state=exact`，并列出七包版本表、manifest 7/7、冻结件与全树允许集。
- fault ×4、F-A…F-M、N-5…N-10、T-1/T-2 均有 R′ 原始应红实红记录；恢复后发布门禁与可复现性均回绿。lockfile 与 `generate --check` 亦有独立日志。

## 2. AC1–AC8 重裁表

| AC | 重裁 | 一手证据与判定 |
|---|---|---|
| **AC1** | **approve** | R′ 上完整矩阵 41/41 成立，不以子集代替：`02-matrix-all.log:5-49` 逐行列出三基线 typecheck + 12 suites、gates、root-test。`matrix.json:7-18` 及 `B1/typecheck.json:13-75` 直接记录 15 个 project 全 exit 0；B2/B3 同形见矩阵日志。repeat 不是只留末次：`B1/replication-lifecycle.json:77-152` 三次均 34/34，且每次 `23/23`、`coverage=true`、`foreignUnits=[]`、`issue420.present=true`。根测试原始 JSON 的 `failedUnexpected=[]` 与四个失败名可复核；固定 pnpm 条件已满足，旧 B-3 不再影响 AC1。 |
| **AC2** | **approve** | `01-acquire-all.log:11-40` 固定 DSH `1511a6e…`，B3 `provenanceDigest=9d663355…`。三份 `provenance.json` 分别指向独立 B1/B2/B3 overlay；B3 额外 8/8 覆盖 commit/clean、ls-tree、构建配方、输出哈希。Root 通道直接证据：B1/B2 `root-probe.json:55-75` 为 legacy、symbol absent；B3 同位置为 symbol、`contextRootStatic=symbol`、legacy absent/throw，命中通道 `timeout=function`。`03-fault-summary.txt:1-5` 四项均 outer 0 / observed=fail；`08-n5-n8c-n8g-n10-n9-summary.txt:1-4` 的 N-5 integrity 篡改 exit 2、恢复 exit 0。证据缺失、损坏、过期、跨树、运行中漂移、HEAD 移动与缺目录均 fail-closed，未见回退。 |
| **AC3** | **approve**（B-1 已闭合） | 三项真实产物门禁均为默认模式：`05-pack.log:1-95` 产生 15 个 tarball；`05-publish-verify.log:1-75` 最终 `verified 15 publishable tarballs`；`05-publish-reproducible.log:1-5` 为 15 包可复现。`05-release-gates-summary.txt:1-18` 记录 pnpm 10.28.2、registry integrity env override 出现 0 次、三项 exit 0。**T-1**：`05-T1-publish-verify.log:6-8,69-70` 篡改后 gzip/tar 失败并非零，ERROR 指名 `nomicore-persistence-0.5.0.tgz`；**T-2**：`05-T2-publish-verify.log:65-70` 删除后非零并指名 `nomicore-yjs-server-0.6.0.tgz`。`05-sha256-pre.txt` 与两份 post 表逐行相同，恢复后 verify/reproducible 各 15/15（`05-release-gates-summary.txt:19-38`）。F-C/F-D 另证 stale/未再生 manifest 红；`05-e2e-chain.log:20-65` 直接检查 packed 版本、依赖重写与默认条件 dist 加载。故 A3-1…A3-5 全部满足，源码 worktree 没有替代 tarball 门禁。 |
| **AC4** | **approve**（B-2 已闭合） | 最终 diff 中七个 package manifest 各恰 1 删 1 增，值依次为 persistence/dsh-persistence/namespace-runtime/namespace-registry `0.4.0→0.5.0`、namespace-api `0.3.0→0.4.0`、ws-replication/yjs-server `0.5.0→0.6.0`；manifest numstat `7/7`、15 键无旧名（`artifacts/local-packages/manifest.json:1-17`）。**PV-3 仍成立**；`root-test-known-red.json`、`scripts/package-catalog.mjs` 与 BASE 零 diff，**PV-5 仍成立**。公共面：`public-surface.base.json:1-95` 恰 7 键，`cordis-public-surface.test.ts:22-50` 对七 entry 做运行时严格相等；19df983→C6a 的生产 src/schema/wire 仅既有 `persistence/src/service.ts` 与 `ws-replication/src/plugin.ts` 两个 seam，BASE→C6a 此面零 diff。`06-lockfile-generate.log:9-16` 证明 schema 检查与生成物稳定。**C5 记录更正合格**：正文分别标注未固定 PATH 的 C1/旧 R `5959/5991 = 32 = 4 frozen + 28 environment` 与固定 pnpm 的 C2/R′ `5987/5991 = 4 frozen`，明确作废 C2 ⑦ 混同及 SA7 旧分类；写入完整 R′ HEAD/tree、声明旧树绿作废并保持 A4-3 其余项不变引用。实测 C5 tree = R′ tree，故历史 C2 原文未被篡改，追加更正链完整。 |
| **AC5** | **approve** | 对 BASE→C6a 的全部 `*package.json` diff 逐项复核，只出现上述七个 version 行；Cordis/Timer range、dependency/peerDependency 归属、根/其余 manifest 均无变化。`pnpm-lock.yaml`、catalog、`patchedDependencies` 不在变更集。`06-lockfile-generate.log:1-8` 为固定 10.28.2 下 frozen lockfile install exit 0 且 lockfile diff exit 0。没有为闭环而改变安装契约，AC5 停手条件未触发。 |
| **AC6** | **pending（条件 12 的结构性后置；非本轮新增 reject）** | 本审查实时只读 GitHub：#472 仍 open、comments=0，REST comments 为空；`gh pr list --head mabf/issue-472 --state all` 为 `[]`；Parent PR #469 仍 open、head=`6be891a…`、无结果评论。故 A6-1/A6-2 **尚未满足**，不得宣称 AC6 approve 或关闭 #472。另一方面，A6-3 当前合格：#468 仍 open，正文末尾 `## Parent` 仍是 `PR #469（spec/468-cordis-rc12-root）`。按 SA8 §14.7，ticket 回填由有权 Controller 在终审触发条件满足后执行，集成 PR 由发布侧在本地 finalize 后创建；本轮控制器禁 `gh pr create`/`git push`，且回填本来就须等待终审 approve，因此当前没有可由本轮实现再闭合却未闭合的缺口。闭合证据包与触发条件见 §6。 |
| **AC7** | **pending（仅外部两个载体随 AC6 后置；本地范围排除已通过）** | C2 ⑧ 明确不执行真实 MABF/DSH 部署验收、不修改/移除 Host 本地 patchedDependencies、未执行 npm publish；C5 保持该项不变引用；SA7 iteration-1 只记录本地验证与 dry-run，没有 Host 部署、迁移窗口或可删除 patch 的完成性声明。最终 diff 无 Host/patch 改动，A7-2/A7-3 合格。严格按 SA6 A7-1，Issue #472 与集成 PR 还须有同义声明；二者随 A6-1/A6-2 结构性后置，故当前不能标 approve，但也不构成新的实现 reject。回填执行时与 AC6 一并闭合。 |
| **AC8** | **approve** | 本审查实时读取 #464/#465/#466：三者均 `state=closed`、`state_reason=not_planned`，各自唯一撤回评论仍明确指出错误 DSH rc.3 审计锚点。C2 ⑨ 仅声明不复用其撤回证据；最终 diff 无 ADR 修改、无新增/复活 POC。本票动态证据来自 R′ 重新 acquire 的精确工件，不以 #464–#466 或 rc.3 tag 作证据，未见回退。 |

## 3. round-1 blocking 的逐项处置

| 原项 | 本轮裁决 | 闭合证据 / 状态 |
|---|---|---|
| **B-1：A3-5 两项 tarball 负控缺失** | **closed** | T-1/T-2 均在 R′ 真实打包输出的一次性副本上执行，默认 `publish:verify` 非零并指名；恢复 sha256 逐字节一致，verify 15/15 + reproducible 15/15。不是用 matrix、G13 或源码测试代替。 |
| **B-2：C2 ⑦ 混同且缺 R 身份** | **closed** | C5 按条件 11 追加 message-only `chore(release)` 更正：口径两分、R′ HEAD/tree、旧树绿作废、其余 A4-3 项不变引用；`C5^{tree} === R′ tree` 实测成立。旧 C2 不重写，R′ 证据全部重跑。 |
| **B-3：最终矩阵未固定 pnpm 10.28.2** | **closed** | R′ 完整 `--all --matrix` 非子集重跑，落盘 10.28.2，`pnpmProbe.exitCode=0`，41/41、审计 RESULT `problems=[]`、13/13 gates、`runWorktree === marker.worktree === R′ tree`，root-test 5987/5991 且 `failedUnexpected=[]`。 |
| **B-4：GitHub 回填缺失** | **pending（结构性后置，不计 blocking）** | 义务与证据包已按 SA8 条件 12 明确；A6-1/A6-2 尚未发生，#468 保护面仍合格。不得把本地 wiki 当 GitHub 回填，也不得在回填前关闭 #472。 |

## 4. 交付条件、记录一致性与停手条件

### 4.1 条件 4（#471 两分文案）：pass

C2 正文使用完整的两分文案，C5 不变引用；本报告继续采用同一事实口径：

> #471 提交 `caede8a` 所称「公共 entry 导出名集合由 4 扩到 7」在快照/测试文件层面未发生（树内仍为 4 entry），其覆盖由 #471 以 3 条 runtime 严格相等断言等价承载（SA10 记录 7/7）；7-entry **快照**由 #472 设施提交落地，现快照与记录一致。

本审查直接复核 C1 恰含四个耦合文件，且 `caede8a` 未改 `public-surface.base.json` 或 `cordis-public-surface.test.ts`。没有宣称 #471 已交付 7-entry 快照，也没有宣称 #471 未做公共面覆盖扩展；历史提交/wiki 未改写。

### 4.2 条件 10（五处勘误依据禁令）：pass

本报告没有以被勘误表述作为裁决依据：

1. `baselines.json` 冻结按 **G13.f + acquire N-5**：`07-shape-audit.log:27-30` 字节相同，`08-n5…summary.txt:1-4` 篡改 exit 2 / 恢复 0；未按「G12 零 diff」归因。
2. 公共 API 冻结按 **G13.g（`--no-renames`）+ G2/G4 + 步骤 8**：`gates.log:298-311` 与最终全树 diff；未以「G2/G4/G7」冒充全仓覆盖。
3. 负控覆盖按 **F-A…F-M + N-5…N-10 + T-1/T-2 实际日志**；未引用「F-A…F-E 一一证伪」。
4. 内容绑定按 **PV-9 指纹**：marker/matrix 交叉相等及 N-8e/N-8f/N-8g 三向红点；未以旧 index `write-tree` 比对作为 working-tree 内容证据。
5. tracked wiki 判定按 **dirname 恰为 `wiki/raw` + basename 正则**：F-L/F-M 分别指名 `wiki/task_issue-472_probe.md`、`wiki/raw/nested/task_issue-472_probe.md` 判红；未采用「glob 按 basename 匹配」的旧注记。

### 4.3 条件 6 / 9 / 11 / 12

- **条件 6：pass。** 固定 pnpm 四件套与默认发布模式均满足；没有以 root-test 子集替代全矩阵。
- **条件 9：pass。** 干净矩阵和 standalone closing 各恰一行 RESULT，`problems=[]` 可机判；gates summary 21 行 = 13 gate + 7 G10 明细 + 1 汇总，完备性而非固定行数判据成立。
- **条件 11：pass。** C5 的追加时序、正文两分、R′ 身份、旧树作废、不变引用及 tree 相等全部满足。
- **条件 12：pending。** §6 的外部回填仍是 ticket 最终收官前置义务，但不阻断本轮 remediation approve。

### 4.4 设计 §12 停手条件

未触发：无依赖范围/归属变更；无公共 API/schema/wire/服务名/持久化布局新增变化；无需真实 Host 部署或 patch 移除；无 owner 统一 minor/新 CHANGELOG 要求；七包 bump 后三项发布门禁均绿；#468/#464–#466 状态合规；root-test 无台账外新红（N-9 注入确实变红）；F/N/T 负控均应红实红。T-1/T-2 恢复完整，未见应红实绿或 fail-open。

## 5. 数字与口径复核：3 个 MINOR（不阻断）

### M-1 — 辅助 shape 汇总分类重叠，出现 `release=12 / other=-4`

- `.cache/issue-472-final/iter1/07-shape-audit.log:34` 写 `changed total=20 facility=4 release=12 wiki=8 other=-4`，与同日志 path list 及 SA7 正文的 **4 facility + 8 release + 8 wiki = 20** 不一致。
- 原因可从 `shape-audit.sh:67-70` 直接看出：`rel` 对 `allowed_exact` 的全部 12 项计数，与 `fac` 的 4 项重叠，`other` 再重复扣减，故为负数。
- **影响判定：MINOR。** 脚本真正的 allowlist 判定是逐 path `path not in allowed_exact`（`:58-66`），没有被该展示算式改变；本审查另以 git 直接复核 R′ 为 20、最终 C6a 为 22（4+8+10）。但后续记录不得引用该行的 `release/other` 数字，应引用 path list 或本报告的分类数。

### M-2 — runner 汇总行混排「本轮实际失败数」与「冻结台账容量」

- `.cache/issue-472-final/iter1/02-matrix-all.log:46` 写 `5987/5991 (4 known-red: 4 frozen + 28 environment)`，字面容易误读为本轮仍有 32 红。
- 原始 JSON 才是无歧义口径：`root-test.json:6001-6007` 仅 4 个实际失败名且 `failedUnexpected=[]`；`:6059-6061` 的 `{knownRed:4,environmentRed:28}` 是冻结台账字段，28 个 environment 项在固定 pnpm 下不再失败。C5 与 SA7 iteration-1 §步骤 2 已明确区分。
- **影响判定：MINOR。** 不改变实际 counts、名集判定或条件 6 结论；回填时应写「实际 4 frozen；台账另保留 28 environment 项且未扩账」，不要照抄该括号作当前失败数。

### M-3 — N-10 编排脚本的 `expect 42` 标签陈旧，实际为 49

- `08-n5-n8c-n8g-n10-n9-summary.txt:29-30` 同时出现 `problems=49` 与 `N-10 empty problem count (expect 42): 49`；标签来自 `falsify-n5-n8c-n8g-n10-n9.sh:91`，与实测不一致。
- `audit-N-10-empty.log:1-51` 可直接分解为 **49 = 1 missing run marker + 42 missing required evidence（39 baseline cells + gates + root-test + matrix）+ 6 missing directories**。SA7 iteration-1 正文已按 49 及该分解披露；设计的关键判据是 exit 1 + 非空 RESULT，不是必须恰 42。
- **影响判定：MINOR。** N-10 应红实红成立，但应删除/更正陈旧 `expect 42` 标签后再把该摘要作为数字证据引用。

## 6. AC6/AC7 的闭合触发条件与必需证据包

### 6.1 触发条件

按设计 §9.4 与 SA8 条件 12，以下三项全部满足后，由第一个有权执行者回填：

1. R′ 上 §11.1 全量复验绿（**已完成**）；
2. C4/C5 落盘（**已完成**）；
3. remediation 后 SA9/SA10 终审均 approve（**本报告仅为其中 SA10 一票，仍需另一终审结论**）。

集成 PR 另有时序约束：Runner Host 发布侧在本地 finalize 后创建 `mabf/issue-472 → spec/468-cordis-rc12-root`；本轮控制器硬门禁禁止 `gh pr create`/`git push`，不得以缺 PR 反判实现错误。

### 6.2 A6-1 ticket 侧

由具备 GitHub 写权限的 Controller/发布执行者向 #472 新增评论，内容至少完整包含：

- 3×15 typecheck、41/41、gates 13/13 / G13 exact、RESULT `problems=[]`、固定 pnpm `5987/5991` / 4 frozen / `failedUnexpected=[]` / probe 0；
- B1/B2/B3 版本、DSH commit、B3 digest、Root 通道；fault ×4、N-5…N-10 与 T-1/T-2 负控摘要及恢复 15/15；
- 15 包 pack / 默认 verify / reproducible、sha256；七包版本表、manifest 7+7、R′ HEAD/tree；
- 公共契约冻结五项、实际 known-red 披露；无部署、无 patch 移除、未真实发布；#464–#466 不复用；
- S2「0.5.0 = 批次名、七包闭包而非 15 包统一 minor」与 S3 方案 A 的知会性披露；工具链。

操作前后归档 `gh api repos/nomicore-ai/nomicore/issues/472/comments --paginate` JSON；操作后快照须含新评论 id/created_at，且正文关键数字与 C5/R′ 一致。

### 6.3 A6-2 集成 PR 侧

发布侧创建 PR 后，在正文或评论回填同一组结果与证据路径，并归档 `gh pr view --json`，至少能核对 head=`mabf/issue-472`、base=`spec/468-cordis-rc12-root`、正文/评论、R′ 身份。Parent PR #469 只追加结果评论，不改其 head/base。

### 6.4 A6-3 / AC7 / 关闭边界

- 操作前后各留 #468 body/state JSON：必须持续 open、Parent=PR #469；只允许追加评论，不得 close 或改写 Parent。
- #464–#466 继续保持 closed + not_planned + 撤回评论；保存状态快照。
- Issue/PR 两个外部载体补齐同义非目标声明后，AC7 才由 pending 转 approve。
- **A6-1/A6-2/A6-3 全部满足前 #472 不得关闭。** wiki 内部记录不能替代 GitHub 回填；本 approve 只表示 remediation 没有新的 spec blocking，不表示 Issue 已最终收官。

## 7. 最终裁决

**approve；blocking = 0；MINOR = 3；结构性 pending = 1（AC6/AC7 共用）。** AC1、AC2、AC3、AC4、AC5、AC8 approve；AC6、AC7 按条件 12 为 pending。B-1/B-2/B-3 已闭合，B-4 转为有明确主体、时序和证据包的结构性后置义务。

PR/后续发布记录必须披露：① #472 与集成 PR 回填尚未发生，ticket 不得提前关闭；② 本节 M-1…M-3 的辅助日志数字/标签瑕疵，引用时以原始 JSON、path list、C5 和本报告口径为准。
