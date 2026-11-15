# SA3 Implementation Report — issue #472（round 1 / iteration 0）

- 任务对象：`nomicore-ai/nomicore#472`，round 1，implementation iteration 0
- **本轮实现范围 = 设计 §9 的 C1（设施提交）4 文件集**；C2（7 个 `package.json` 版本行 + `artifacts/local-packages/manifest.json`）与 C3（wiki 回填）不在本轮，未触碰。
- HEAD / BASE：`6be891a3a0cb32fe21c3a6bf485f33428052ce7b`（分支 `mabf/issue-472`）；本轮生产面零改动。
- 设计/追认输入：`wiki/raw/task_issue-472_design.md`（rev2，562 行，SA2 iteration-2 approve）、`wiki/raw/task_issue-472_sa6_acceptance_contract.md`（AC1–AC8 / D1–D15 / G-R1–G-R10）、`wiki/raw/task_issue-472_sa2_review.md`（iter-2 approve；SA2-18…SA2-20 非阻塞观察）、`wiki/raw/task_issue-472_design_conflict_report.md`（PV-1…PV-8b、交付条件 1–10、§13 现行口径）。
- 结论：**C1 实现完成且验收判据全部实跑通过** —— 设施树 `gates.mjs` = **13/13 通过且 G13 `state=absent`**；`--all --matrix` = **41 cells 全 pass**、内置证据审计 **exit 0 且 `problems=[]`**、gates cell summary 含全部 13 个 gate 明细行（含 G1′、G13）；F-A…F-K 与 N-5…N-9（含 b 变体）**逐项应红实红**并已还原。无 blocker。

---

## 1. Inputs consumed

| 输入 | 用途 |
|---|---|
| `wiki/raw/task_issue-472_design.md`（rev2） | 唯一实现权威：§7.1 BASE / §7.2 G1′/G3 allowlist / §7.3 G13 两态 a–g / §7.4 审计七检查 + run-marker / §7.5 G12 delta / §8 方案 A 7-entry / §10 TDD 与 F/N 负控表 / §14 ALLOW·DENY / §16 D-10 summary |
| `wiki/raw/task_issue-472_sa6_acceptance_contract.md` | AC1/A1-6 gates 与 release 相容、A1-3 counts 判据、A1-5 root-test disclosure、D13、§12.0 单树绑定 |
| `wiki/raw/task_issue-472_sa2_review.md`（iter-2） | SA2-1/2/3/4/5/7/8/9/10/13 闭合要求；SA2-18…20 非阻塞观察 |
| `wiki/raw/task_issue-472_design_conflict_report.md` | PV-1…PV-8b 钉值、交付条件 1–10（负控先于绿、条件 9 全量 summary、条件 10 勘误不依赖） |
| 现盘设施/证据 | `packages/persistence/test/fixtures/cordis-baselines/{gates.mjs,run-baseline.mjs,baselines.json,public-surface.base.json,root-test-known-red.json}`；`.cache/cordis-baselines/{evidence,overlay,workspaces}`（SA6 本轮工件，本轮复用但 C1 验收全部本轮实跑） |

## 2. Existing worktree reconciliation

- 起始 `git status --porcelain` = 6 个 untracked `wiki/raw/task_issue-472*.md`（brief / dispatch / design / SA2 / SA6 / SA8 报告），与设计头部自验一致；无既有实现改动需要保留或回滚。
- `.cache/issue-472-impl/` 本轮新建（gitignored），全部日志/辅助脚本只落此处；一次性 falsification 沙箱位于 `.worktrees/issue-472-falsify`（gitignored），负控完成后已 `git worktree remove --force` + `prune` 删除（`git worktree list` 只剩 main 与任务 worktree）。
- 未执行 `git add/commit/push`；提交由 Controller 完成。

## 3. Changed paths（本轮 changedPaths，精确 4 文件）

| # | Path | Design section | Change |
|---|---|---|---|
| 1 | `packages/persistence/test/fixtures/cordis-baselines/gates.mjs` | §7.1/§7.2/§7.3/§7.5/§8；PV-1…PV-8b | BASE 重钉 `6be891a3a0cb32fe21c3a6bf485f33428052ce7b`（`RELEASE_BATCH.base` 直接引用同一常量，SA2-10 单一钉值）；`PUBLIC_ENTRIES` 4→7；G1′ 由 `assertNoChange` 改文件集 allowlist（恰 8 文件）；G3 改「tracked ⊆ {`packages/ws-replication/package.json`} ∧ untracked ⊆ 4 fixture」两段分别判定；新增 **G13 两态（absent/exact）** 审计 a–g 款；G12 `FACILITY_ALLOW` 4→5（`+public-surface.base.json`，`baselines.json` 降为「名义死条目」并更正 detail）；G5 detail 动态 entry 数；`changedPaths()` 统一携带 `--no-renames`（单一原语纪律，SA2-13）；G3 独立判定并留 SA2-18 免疫注记 |
| 2 | `packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs` | §7.4；SA2-1/4/5/7 | `--audit-evidence` 独立模式（standalone，exit 0 iff `problems=[]`，无 `--evidence-dir` 重定向）；`--all --matrix` 启动先写 `evidence/run-marker.json`（`{startedAt, head, tree, porcelain}`，`tree` 为校验值）；收尾内置 `auditEvidence()`（§7.4 七检查）；`matrix.json` additive 增 `runHead/runTree`；gates cell `summary` 去 `slice(-12)` 保留全部 `[gates]` 行；审计含 `evidence/` 缺失 guard |
| 3 | `packages/persistence/test/fixtures/cordis-baselines/public-surface.base.json` | §8 方案 A / PV-7 | 在**新 BASE `6be891a`** 上用设施既有捕获机制（`gates.mjs --write-surface-snapshot`：detached BASE worktree + declaration farm + tsx + `nomicore-source`）重捕为 **7 键**（新增 `@nomicore/ws-replication/testing`、`@nomicore/clock`、`@nomicore/namespace-registry`）；四个既有 entry 导出集合逐字不变 |
| 4 | `packages/persistence/test/cordis-public-surface.test.ts` | §8；SA2-9 | `ENTRIES` 4→7（`ws-replication/testing`、`clock`、`namespace-registry` 以相对路径 entry 文件加载，与既有 dsh-persistence 同法）；describe 文案去掉失真旧 base 串（`vs base 279dba4 捕获` → `vs BASE 快照捕获，7 entry`）；it 数 5→8 |

`git diff --stat`：4 files, +860 / −16。**未触碰**：7 个 `package.json` 版本行、`artifacts/local-packages/manifest.json`（C2）；任何 `packages/**/src/**`、`apps/**/src/**`、`domains/**`；`docs/**`、`scripts/**`、`.github/**`；`acquire.mjs`/`root-probe.mjs`/`provenance-b3.json`/`baselines.json`/`root-test-known-red.json`（逐字节冻结）；既有历史 `wiki/raw/**`（只新增本报告）。

## 4. TDD 红→绿记录

### 4.1 红灯 1 —— 真实发布门禁红（本票因果起点；未 bump 版本 HEAD 上本轮重捕）

| 步骤 | 命令 | 结果 | 证据 |
|---|---|---|---|
| pack | `PATH=<pnpm-10.28.2 shim> node scripts/build-local-packages.mjs`（= `pack:local`，默认 outDir `artifacts/local-packages`） | **exit 0**，15 tarball；`git status --porcelain -- artifacts/` 为空（manifest 确定性再生、逐字节不变） | `.cache/issue-472-impl/red1-pack.log` |
| verify | `node scripts/verify-package-tarballs.mjs`（**默认模式**，未设 `NOMICORE_VERIFY_REGISTRY_INTEGRITY=0`） | **exit 1**，恰两条 `ERROR:` —— `@nomicore/persistence@0.4.0` 与 `@nomicore/ws-replication@0.5.0` 的 registry integrity mismatch；其余 13 包 MATCH | `.cache/issue-472-impl/red1-publish-verify.log` |

pnpm 版本：`node /home/wangjian/.cache/node/corepack/v1/pnpm/10.28.2/bin/pnpm.cjs`（shim，`pnpm --version` = `10.28.2`）；node `v24.13.0`。

### 4.2 设施两态控制（沙箱，R 等价一次性副本）

| 控制 | 状态 | 结果 | 证据 |
|---|---|---|---|
| C1 absent 态 | C1 设施 copy（4 文件提交于 sandbox） | **13/13 pass**，`G13 state=absent` | `.cache/issue-472-impl/falsify-f-control-absent.log` |
| C2 exact 态 | sandbox 上模拟 release 批次（7 version 行 + manifest 7 filename 提交） | **13/13 pass**，`G13 state=exact; versions: persistence 0.4.0→0.5.0, …, ws-replication 0.5.0→0.6.0, yjs-server 0.5.0→0.6.0`；G6 干净 | `.cache/issue-472-impl/falsify-F-control-exact.log` |

### 4.3 实现自身缺陷的红→绿（falsification 发现的 gate bug）

- 首次运行 exact 态控制时 G13 误红：`manifest: expected exactly 7 changed keys, got 6 addition + 6 deletion`。
- 根因（真实缺陷）：manifest diff 行解析正则 `^([+-])  "…": "…",$` 强制尾逗号，而 JSON 最后一个键 `"@nomicore/yjs-server": "…-0.6.0.tgz"` **无尾逗号** ⇒ 第 7 个键被漏计。
- 修复：正则尾逗号改可选 `,?`（`gates.mjs`），并重跑 exact 态控制 → **13/13 pass**（`falsify-F-control-exact.log`）。
- 该缺陷已由红灯实证并被修复，未以放宽判定收场（7/7 键与 7 增 7 删仍双钉）。

### 4.4 C1 验收（最终代码、同一棵树）

| 验收 | 命令 | 结果 | 证据 |
|---|---|---|---|
| gates | `node packages/persistence/test/fixtures/cordis-baselines/gates.mjs` | **13/13 PASS，exit 0**；`G13: state=absent`；`G1′ changed=[(none)]`；`G5: 7 entries match base snapshot; runtime surface test passed`；`G12 changed ⊆ 5-file allowlist` | `.cache/issue-472-impl/gates-final.log` |
| 平台矩阵 | `node …/run-baseline.mjs --all --matrix` | **41 cells 全 pass，exit 0**；gates cell 13/13；root-test pass-by-ledger 5959/5991（32 failed = 4 knownRed + 28 environmentRed；`failedUnexpected=[]`）；**内置审计 `EVIDENCE AUDIT PASS … 41 cells, identity digests, freshness, logPath containment, directory discipline`** | `.cache/issue-472-impl/matrix-run-final.log` |
| standalone 审计 | `node …/run-baseline.mjs --audit-evidence` | **exit 0，`problems=[]`** | `.cache/issue-472-impl/audit-standalone-final.log` |
| matrix JSON | `.cache/cordis-baselines/evidence/matrix/matrix.json` | 41 cells；`runHead=6be891a…`、`runTree=b41d9e73…`、`generatedAt=2026-11-15T00:06:48.773Z`；root-test `status=pass`、`failedUnexpected=[]`、`counts={passed:5959,failed:32,total:5991}` | 同目录工件 |
| gates cell summary | `.cache/cordis-baselines/evidence/gates/gates.json` | 全量 `[gates]` 行（21 行 = 7 行 G10 明细 + **13 行 gate 结果（G1′…G13，含 G1′/G13）** + 1 行 `all 13 gates passed`），无截断 | 同目录工件 |
| surface 快照 | `node …/gates.mjs --write-surface-snapshot` | 7 键（exports 数：persistence 28、persistence/testing 10、dsh-persistence 6、ws-replication 16、ws-replication/testing 5、clock 5、namespace-registry 9） | `.cache/issue-472-impl/surface-recapture.log` |
| surface 测试 | `NODE_OPTIONS=--conditions=nomicore-source vitest run packages/persistence/test/cordis-public-surface.test.ts --passWithNoTests=false` | **8 passed**（1 键集合 it + 7 entry it） | 运行输出（见报告 §8） |
| 受影响包 typecheck | `node node_modules/typescript/bin/tsc -p packages/persistence/tsconfig.json`；`tsc -p tsconfig.typecheck.json` | 均 **exit 0** | `.cache/issue-472-impl/tsc-typecheck-surface.log` |

**counts 变化说明（预期、非回归）**：surface 测试位于 `packages/persistence/test/*.test.ts`，既属 `contract` suite 的动态文件集，也属 root-test；7-entry 改造 +3 it ⇒ contract counts B1/B2 `243→246`、B3 `247→250`，root-test `5988→5991`。A1-3 判据为 `failed=0 ∧ total>0 ∧ 每 repeat 绿`（无固定计数钉），release 记录按实际 counts 原样披露（本条移交 C2 release 正文与终验）。

## 5. Falsification matrix（应红实红；逐项注入 → 红 → 还原）

环境：一次性 sandbox `.worktrees/issue-472-falsify` = BASE `6be891a` + C1 四文件提交（`HEAD=cb3ca60`）+ 模拟 C2 批次提交（`HEAD=cf18f30`）；`node_modules` 以真实目录 + 符号链接条目提供（规避 `.gitignore` `node_modules/` 不匹配 symlink 的探针噪声）。所有注入均以 `git reset --hard` 还原并核对 `git status` 干净；负控结束删除 sandbox，仅留 log。

### 5.1 gates 注入（F-A…F-K）

| # | 注入 | 实测结果（应红点） | 红点唯一性 | 证据 |
|---|---|---|---|---|
| F-A | 第 8 个包 bump：`packages/clock/package.json` `0.2.0→0.2.1` | **G1′ FAIL**（allowlist 外 `packages/clock/package.json`）+ **G13 FAIL**（exact：clock 非逐字节 + manifest 交叉检查 `nomicore-clock-0.2.1.tgz` 期望） | 红点 = G1′ + G13（设计预期两者） | `falsify-F-A.log` |
| F-B | 7 文件之一改依赖 range：persistence `@deepseek-ai/cordis ^4.0.1→^4.1.0` | **仅 G13 FAIL**：`manifest differs … beyond the "version" line (PV-3 deep equality failed)` + `text diff must be exactly 1 deletion + 1 addition, got 2 + 2` | 唯 G13（G1′ 绿） | `falsify-F-B.log` |
| F-C | manifest 保留一个旧 filename（`@nomicore/persistence → …-0.4.0.tgz`，**已提交**以排除 G6 噪声） | **仅 G13 FAIL**：filename↔version 交叉检查 + `stale filename lingers` + `7 changed keys → 6+6`；`publish:verify`（默认模式）exit 1：`@nomicore/persistence: manifest filename does not match package version` | 唯 G13（G6 绿） | `falsify-F-C.log` + `falsify-F-C-publish-verify.log` |
| F-D | bump 后**未再生 manifest**（manifest 回 BASE 旧 filename，未提交） | **G6 FAIL**（`artifacts/ is dirty: M artifacts/local-packages/manifest.json`）+ **G13 FAIL**（7 个 filename 交叉检查 + numstat 非 7+7）+ `publish:verify` **exit 1** | G6 + G13 + publish:verify（设计预期三项） | `falsify-F-D.log` + `falsify-F-D-publish-verify.log` |
| F-E | 台账加一个新红名（`root-test-known-red.json` knownRed +1） | **仅 G13 FAIL**：`root-test-known-red.json: not byte-identical to BASE (G13 byte-freeze)` + absent 逐字节分支 | 唯 G13（G6 绿） | `falsify-F-E.log` |
| F-F | 仅 bump 7 之 3（persistence/dsh-persistence/namespace-runtime）+ 再生 manifest（已提交） | **仅 G13 FAIL**：absent 分支 3 文件 version ≠ BASE；exact 分支 4 个 pinned 文件 `version="0.4.0" expected 0.5.0`（text diff 0/0） | 唯 G13；**G1′ 绿**（全部变更 ⊆ 8 文件白名单） | `falsify-F-F.log` |
| F-G | exact 态把 `packages/persistence/package.json` 单独回退 0.4.0（manifest 不再生） | **仅 G13 FAIL**：absent 分支（6 + 7 文件异于 BASE）∧ exact 分支（persistence `version="0.4.0" expected 0.5.0` + manifest 交叉检查） | 唯 G13（absent 分支首次红灯实证） | `falsify-F-G.log` |
| F-H | `packages/clock/src/system.ts` 加一行注释（G2 pathspec 外的 11 包 src 面） | **仅 G13 FAIL**：`tracked change outside the release allowlist: packages/clock/src/system.ts` | 唯 G13.g；**G2/G4 绿** | `falsify-F-H.log` |
| F-I | `scripts/create-publish-manifest.mjs` 与 `.github/workflows/ci.yml` 各加一行注释 | **仅 G13 FAIL**：同时指名 `scripts/create-publish-manifest.mjs` 与 `.github/workflows/ci.yml` | 唯 G13.g；G1′/G2/G4 绿 | `falsify-F-I.log` |
| F-J | `baselines.json` 单字节改动（B1 cordis integrity `…0Nw==`→`…0Nw=A`） | **仅 G13 FAIL**：`baselines.json: not byte-identical to BASE`（G13.f 两态）；**G12 PASS**（名义 allowlist 不救） | 唯 G13.f；G12 绿 | `falsify-F-J.log` |
| F-K | `git mv .github/workflows/ci.yml wiki/raw/task_issue-472_renamed.md`（gate 未覆盖 tracked 文件改名进 wiki glob） | **仅 G13 FAIL** 并指名被删旧路径 `.github/workflows/ci.yml`；`--no-renames` diff 同时列出旧路径 D 与新路径 A（新路径命中 wiki glob 不救） | 唯 G13.g；G1′/G2/G4/G12 绿 | `falsify-F-K.log` |

对照：干净 absent（C1）与 exact（R 等价）树均 13/13 绿、无回归（§4.2）。

### 5.2 证据审计/工件负控（N-5…N-9，含 b 变体）

规范目录 `.cache/cordis-baselines/evidence/` 上「备份 → 污染 → 审计 → 还原」，或一次性副本；每次还原后 `N-control-restored` 均 `problems=[]`、exit 0。

| # | 注入 | 实测结果 | 证据 |
|---|---|---|---|
| N-5 | 一次性副本把 `baselines.json` B1 cordis integrity 尾位改错 → `acquire.mjs --baseline B1` | **exit 2**：`[acquire] FAIL <integrity> … sha512 mismatch: pinned …0Nw=A, got …0Nw==`；恢复后 **exit 0** | `falsify-N-5-tamper.log` / `falsify-N-5-restored.log` |
| N-6 | 删除 `B1/provenance.json` | 审计 **exit 1**：`missing required evidence: …/B1/provenance.json` | `falsify-N-6.log` |
| N-6b (a) | 某 cell `logPath` 改为不存在路径 | 审计 **exit 1**：`logPath: file does not exist` | `falsify-N-6b-nonexistent.log` |
| N-6b (b) | 某 cell `logPath` 改为 `../../escape.log` | 审计 **exit 1**：`logPath: path escapes evidence/` | `falsify-N-6b-escape.log` |
| N-7 | 截断 `B3/provenance.json` | 审计 **exit 1**：`unparsable evidence: … (Unterminated string in JSON…)` | `falsify-N-7.log` |
| N-7b | 在 `B1/` 放换名旧工件 `zz-old.json` | 审计 **exit 1**：`file outside the six allowed classes` | `falsify-N-7b.log` |
| N-8a | `touch -d 2020-01-01` 回溯 `B2/contract.json` mtime | 审计 **exit 1**：`stale evidence (mtime predates the run marker)` | `falsify-N-8a.log` |
| N-8b | 把 `B2/contract.json` 的 `provenanceDigest` 改成 B3 值 | 审计 **exit 1**：`provenanceDigest=… expected …`（identity mismatch） | `falsify-N-8b.log` |
| N-8c | 在另一棵树（sandbox HEAD `cf18f30` ≠ marker.head `6be891a`）跑 `--audit-evidence` | 审计 **exit 1**：`evidence belongs to another tree …` + `tracked tree drifted during the run`（write-tree 比对） | `falsify-N-8c.log` |
| N-8d | 换入上一轮（SA6）`matrix.json` | 审计 **exit 1**：`generatedAt … predates the run marker` + `runHead/runTree ≠ marker`（单树绑定） | `falsify-N-8d.log` |
| N-9 | 一次性副本注入合成新红测试（`zz-n9-synthetic-new-red.test.ts`，固定 10.28.2 PATH）后跑 `--suite root-test` | root-test cell **status=fail、exit 1**：`failedUnexpected=["N-9 synthetic new red N-9 synthetic new red not in the frozen ledger"]`（counts 5987/5992，5 failed = 4 knownRed + 1 合成新红；28 environmentRed 在固定 pnpm 下转绿）⇒ 新红不得扩账解释 | `falsify-N-9.log` |

> 覆盖声明以设计 §10 表（F-A…F-K + N-5…N-9 含 b 变体）为唯一权威口径；本报告不引用 SA8 §3-S1 的「F-A…F-E 一一证伪」表述（条件 10 勘误不依赖）。`catalog` 漂移分支仍无直接注入（SA2-16 非阻塞观察），由 G13.e + G13.g 间接覆盖。

## 6. SA2 Finding 落实

| Finding | 实现 | 结果 |
|---|---|---|
| SA2-1（审计允许集与实盘不符） | 六类文件允许集 + `fault-*/` 递归仅 `*.log`/`*.vitest.json`；gates/root-test/matrix 精确内容；三类 digest 期望（39 cell 按 baseline、gates=B3、root-test=B1）；logPath 三判（存在/containment/tmp 拒绝/新鲜） | 干净矩阵审计 `problems=[]`（§4.4）；N-6/N-6b/N-7/N-7b/N-8a–d 逐项红 |
| SA2-2（全树绑定） | G13 两态 g 款：`git diff --no-renames --name-only BASE` ⊆ C1 4 + release 8 + `wiki/raw/task_issue-472*.md`；untracked ⊆ `wiki/**`；越界指名 | F-H/F-I/F-K 应红实红且 G1′/G2/G4 同时绿 |
| SA2-3（`baselines.json` 钉死） | G13.f 两态逐字节；G12 保持 5 文件闭集并把 `baselines.json` 标注为名义死条目（执行面 G13.f + acquire N-5） | F-J 单字节注入 G13 红、G12 绿；N-5 acquire exit 2 |
| SA2-4（新分支证伪） | F-F/F-G/N-6b/N-7b 全部实跑 | 各自应红点留 log |
| SA2-5（summary 截断） | 去 `slice(-12)`，保留全部 `[gates]` 行 | gates cell summary 13 行 gate 结果 + 汇总（含 G1′/G13） |
| SA2-7（marker tree 校验） | 内置与 standalone 审计均比 `git write-tree === marker.tree` | N-8c 双红（head + tree） |
| SA2-8（PV-4 numstat 口径） | manifest numstat 恰 7 增 + 7 删 + 逐键 target filename + 无旧 filename 残留 | F-C/F-D/F-F 各自按此判红 |
| SA2-9（describe 旧 sha） | 文案改为「vs BASE 快照捕获，7 entry」，不再钉具体 sha | 快照为 `6be891a` 捕获，文案不再失真 |
| SA2-10（双钉值） | `RELEASE_BATCH.base = BASE`（同一常量） | 单一 BASE 单源 |
| SA2-13（rename 原语） | `changedPaths()`/G13 全树/逐文件 diff/numstat 一律 `--no-renames`；F-K 实证 | F-K 指名旧路径 |
| SA2-18（G3 免疫注记） | G3 改「tracked / untracked 两段分别判定」并在 `changedPaths()` 注释成文（4 个 fixture 在 BASE 均 tracked，非 add 候选） | 干净树 G3 绿；任何 tracked fixture 改动即红（更严格） |
| SA2-19/20（措辞与 PV-8a 补注） | 实现只用 `--no-renames --name-only` 原语、未使用 `--name-status` 等价说法；PV-8a 的 `--no-renames` 补注属 SA8 实现后复查义务，本轮不越权改 SA8 报告 | 记录在案，移交实现后复查 |

## 7. File scope check

| Changed path | ALLOW entry（设计 §14 / 本轮 dispatch） | Purpose |
|---|---|---|
| `packages/persistence/test/fixtures/cordis-baselines/gates.mjs` | ALLOW 第 1 行（C1） | BASE/7-entry/G1′/G3/G13/G12/G5 |
| `packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs` | ALLOW 第 2 行（C1） | run-marker + 内置/standalone 审计 + matrix 字段 + summary |
| `packages/persistence/test/fixtures/cordis-baselines/public-surface.base.json` | ALLOW 第 3 行（C1，方案 A） | 新 BASE 7 键重捕 |
| `packages/persistence/test/cordis-public-surface.test.ts` | ALLOW 第 4 行（C1，方案 A） | ENTRIES 4→7 + 文案 |

DENY 面核对：`git status --porcelain` 仅上述 4 个 `M` + 7 个 `wiki/raw/task_issue-472*.md`（含本报告）`??`；无 `src/**`、`domains/**`、`docs/**`、`scripts/**`、`.github/**`、lockfile、根/其余 manifest、门禁冻结件改动。`git diff --no-renames --name-only HEAD` 与 `git ls-files --others --exclude-standard` 的证据见 `.cache/issue-472-impl/gates-final.log`（G13 absent 全树条款）。

## 8. Verification

| Command | Result | Evidence |
|---|---|---|
| `node scripts/build-local-packages.mjs`（PATH pnpm 10.28.2） | exit 0（15 tarball；artifacts 零 diff） | `.cache/issue-472-impl/red1-pack.log` |
| `node scripts/verify-package-tarballs.mjs`（默认模式） | **exit 1，恰 2 integrity mismatch**（persistence@0.4.0 / ws-replication@0.5.0） | `.cache/issue-472-impl/red1-publish-verify.log` |
| `node …/gates.mjs --write-surface-snapshot` | exit 0；7 键快照写盘 | `.cache/issue-472-impl/surface-recapture.log` |
| `NODE_OPTIONS=--conditions=nomicore-source vitest run packages/persistence/test/cordis-public-surface.test.ts --passWithNoTests=false` | 8 passed / Type Errors no errors | 终端输出（记录于本报告 §4.4） |
| `node …/gates.mjs`（C1 验收，最终代码） | **13/13 pass，exit 0，G13 state=absent** | `.cache/issue-472-impl/gates-final.log` |
| `node …/run-baseline.mjs --all --matrix`（最终代码） | **41 cells pass，exit 0；内置审计 PASS（problems=[]）** | `.cache/issue-472-impl/matrix-run-final.log` |
| `node …/run-baseline.mjs --audit-evidence` | exit 0，`problems=[]` | `.cache/issue-472-impl/audit-standalone-final.log` |
| `node node_modules/typescript/bin/tsc -p packages/persistence/tsconfig.json` | exit 0 | 终端输出 |
| `node node_modules/typescript/bin/tsc -p tsconfig.typecheck.json` | exit 0 | `.cache/issue-472-impl/tsc-typecheck-surface.log` |
| F-A…F-K 注入（sandbox，`run-gates.sh` 逐项） | 全部 exit 1 且红点如 §5.1；还原后 sandbox `git status` 干净 | `.cache/issue-472-impl/falsify-F-*.log` + 两个 control log |
| N-5…N-9 注入 | 全部应红实红；还原后 `problems=[]` | `.cache/issue-472-impl/falsify-N-*.log` |
| `node --check`（两个 facility JS） | exit 0 | 终端输出 |

## 9. Deferred verification（C2 与终验前置条件）

1. **C2（下一轮实现）**：7 个 `package.json` 仅 `"version"` 行 + `pack:local`（pnpm 10.28.2）再生 `artifacts/local-packages/manifest.json`（numstat 7+7）；提交后必须满足 `gates.mjs` **13/13 且 G13 `state=exact`、G6 artifacts-clean**；`publish:verify`（默认模式）→ 15/15 绿。A4-3 两分文案与 §8 记录修正属 C2/C3。
2. **F-G 在真实 C2 树上重跑**（本轮已在 R 等价 sandbox 上实证 absent 分支红灯；设计 §10 的时机说明按 sandbox = R 等价副本处理）；F-* 系 gates 注入在终验轮的 R 等价副本上重跑复核。
3. **AC 证据以 final verification 在 `R` 上的独立重跑为准**（SA6 §12.0.1 单树绑定）：D1–D15、fault ×4、`publish:verify`/`publish:reproducible`、lockfile 零 diff、`generate --check`、`git diff --no-renames --name-only 6be891a..R` 形状复核；root-test 按固定 10.28.2 的实际 counts 原样披露（本轮 sandbox N-9 已观察到 28 environmentRed 在固定 pnpm 下转绿，终验需复记）。
4. 终验必须按条件 10 的核对口径：`baselines.json` 冻结按 **G13.f + N-5**、公共 API 冻结按 **G13.g（`--no-renames`）+ G2/G4 + 步骤 8**、负控覆盖按 **§10 表（F-A…F-K + N-5…N-9）**；不得依赖 SA8 报告已勘误的三处表述。
5. 本轮 extra counts 变化（contract +3、root-test +3）由 C2 release 正文按实际值披露；`root-test-known-red.json` 零 diff（G13.d 已钉）。

## 10. Deviations or blockers

- **无 blocker**；设计、红灯契约与实现一致，未触发任何停手条件。
- 记录性偏差（不影响验收判据）：
  1. F-G 依设计 §10 属「C2 形成后」的注入；本轮在 **R 等价 sandbox**（BASE + C1 + 模拟 release 批次提交）上完成并如实记录（dispatch 要求 F-A…F-K 全量），终验按 §9.2 在真实 R 上复核。
  2. F-A…F-K 的 gates 日志由同一 G13 逻辑的稍早版本产生；其后仅做两处不改变任何注入结果的收尾（wiki glob 收紧为必须 `wiki/` 前缀、移除一个未用变量），最终 C1 验收在收紧后的代码上重跑 13/13（`gates-final.log`）。
  3. N-9 在一次性副本上用「合成新红 + 固定 10.28.2 PATH」实现（规范目录不被污染）；规范目录侧的 `failedUnexpected=[]` 判据由内置审计（`matrix.json` root-test cell）独立承载。
  4. 本轮未对 `publish:reproducible`/lockfile/`generate --check` 之外的全仓工程做额外回归（SA3 职责边界）：C1 只要求设施与矩阵证据；全仓 AC 证据为终验轮职责。

## 11. Suggested commit message（Controller 选择；本轮未执行 commit）

```
test(fixtures): #472 release 门禁与证据审计扩展（BASE 6be891a + G13 + 7-entry 快照）

- gates.mjs: BASE 重钉 6be891a；PUBLIC_ENTRIES 4→7；G1′/G3 release allowlist
  （8 文件）；新增 G13 两态审计（absent/exact，a–g 含 baselines.json 逐字节
  钉死与全树变更集绑定 `git diff --no-renames --name-only BASE`）；G12 +1
  public-surface.base.json（baselines.json 名义死条目）；G5 文案动态化
- run-baseline.mjs: --audit-evidence 独立模式；--all --matrix 启动写
  run-marker.json 并收尾内置七项 fail-closed 审计；matrix.json 增
  runHead/runTree；gates summary 去 slice(-12) 截断
- public-surface.base.json: 新 BASE 重捕 7 键
- cordis-public-surface.test.ts: ENTRIES 4→7 + 描述文案去旧 base 串
- 实证: gates 13/13 + G13 state=absent；41 cells 全 pass + 审计 problems=[];
  F-A…F-K 与 N-5…N-9 应红实红（日志 .cache/issue-472-impl/）
```

---

# SA3 实现报告增补 —— round 1 / implementation iteration 1（**C2：release 提交范围**）

- 任务对象：`nomicore-ai/nomicore#472`，round 1，implementation iteration 1，范围 = 设计 §9 **C2**（7 个 `package.json` 版本行 + `artifacts/local-packages/manifest.json`），**共 8 个文件**，无第 9 个。
- 工作树：`/home/wangjian/nomicore-fix-issue-472`，分支 `mabf/issue-472`，起始/结束 HEAD 均为 `119831274f37ebfee2f157398bb866270f4726d3`（C1 设施提交；**SA3 未在主 worktree 执行任何 commit/add**，提交交控制器）。
- 工具链：node `v24.13.0`；pnpm **10.28.2**（`node /home/wangjian/.cache/node/corepack/v1/pnpm/10.28.2/bin/pnpm.cjs`，经 `.cache/issue-472-impl/bin/pnpm` shim 置 PATH 首位）；npm `11.9.0`。
- 结论：**C2 实现完成，本轮要求的全部验收实跑通过** —— 8 文件 diff 形状逐文件恰 1 删 1 增（manifest 7 增 7 删）；`publish:verify` 默认模式 exit 0；`publish:reproducible` exit 0；lockfile 冻结安装 exit 0 且零 diff；`generate --check` exit 0 且 `generated.ts` 字节不变；**一次性 worktree 上 gates 13/13、G13 `state=exact`、G6 干净、exit 0**，并完成 exact 态 41 cells 矩阵预验。无 blocker。

## 12. Inputs consumed（iteration 1 增补）

| 输入 | 用途 |
|---|---|
| `wiki/raw/task_issue-472_design.md` §6（版本矩阵 + manifest 时序与三层验证）/ §9 C2 / §11（复验计划）/ §14 ALLOW·DENY | C2 文件集、版本表、manifest 判据（numstat 7+7）、验证命令清单 |
| `wiki/raw/task_issue-472_sa6_acceptance_contract.md` §12.3（A3-1…A3-5）/ §12.4（A4-1…A4-5） | `pack:local` / `publish:verify` 默认模式 / `publish:reproducible` 的 AC 判据；版本矩阵与记录 |
| `wiki/raw/task_issue-472_design_conflict_report.md` §8.1 PV-3/PV-4/PV-5/PV-8b + §8.2 交付条件 1–10（含 3′/9/10） | 版本表逐字钉值、manifest numstat 口径、台账/`baselines.json` 冻结、两态自洽（exact 只认 exact 态树） |
| C1 交付物 `1198312`（`gates.mjs` G13 两态 a–g 款、7-entry 快照、审计设施） | 本次 exact 态判定的唯一机械裁定点 |
| 现盘工件 `.cache/issue-472-impl/*`（C1 轮日志）、`.cache/cordis-baselines/{overlay,npm,dsh}` | 复验与一次性 probe 的矩阵预验（overlay 仅第三方 `@deepseek-ai/*`，bump 不影响） |

## 13. Existing worktree reconciliation

- 起始 `git status --porcelain` = 7 个 untracked `wiki/raw/task_issue-472*.md`（无既有实现改动需要保留/回滚）；C1 四文件改动已在 `1198312` 中，工作树干净。
- 本轮新增改动 = 恰 8 个受控路径（7 个 `package.json` + manifest），全部为 `M`，无新增/删除/改名；`git diff --no-renames --name-status 6be891a` 合计 12 项 = C1 的 4 个设施文件（已在 HEAD）+ 本轮 8 个 release 文件。
- 一次性 worktree `.worktrees/sa3-c2-probe`（gitignored）用于 exact 态预验，结束后 `git worktree remove --force` + `git worktree prune` 删除，`git worktree list` 回到「main + 任务 worktree」两项（`c2-probe-cleanup.log`）。

## 14. Changed paths（本轮 changedPaths，精确 8 文件）

| # | Path | Design section | Change | diff 形状（`git diff --no-renames --numstat 6be891a`） |
|---|---|---|---|---|
| 1 | `packages/persistence/package.json` | §6.1 / PV-3 | `"version": "0.4.0" → "0.5.0"`（仅 L3） | 1 删 + 1 增 |
| 2 | `packages/dsh-persistence/package.json` | §6.1 闭包 / PV-3 | `0.4.0 → 0.5.0` | 1 / 1 |
| 3 | `packages/namespace-runtime/package.json` | §6.1 闭包 / PV-3 | `0.4.0 → 0.5.0` | 1 / 1 |
| 4 | `packages/namespace-registry/package.json` | §6.1 闭包 / PV-3 | `0.4.0 → 0.5.0` | 1 / 1 |
| 5 | `packages/namespace-api/package.json` | §6.1 闭包 / PV-3 | `0.3.0 → 0.4.0` | 1 / 1 |
| 6 | `packages/ws-replication/package.json` | §6.1 / PV-3 | `0.5.0 → 0.6.0` | 1 / 1 |
| 7 | `apps/yjs-server/package.json` | §6.1 闭包 / PV-3 | `0.5.0 → 0.6.0` | 1 / 1 |
| 8 | `artifacts/local-packages/manifest.json` | §6.2 / PV-4 / A4-2 | `pack:local`（10.28.2，无参 → `artifacts/local-packages`）确定性再生，恰 7 个 filename 键更新 | **7 增 + 7 删** |

**逐文件文本 diff 形状**（`c2-version-edits.log`，7 个文件同形，示例 persistence）：

```
-  "version": "0.4.0",
+  "version": "0.5.0",
```

仅 `version` 行变化：7 个文件的 `git diff --no-renames 6be891a -- <file>` 均恰 1 删 1 增；JSON 深度比对（去掉 `version`）与 BASE **完全相等**，`version === to`（`c2-scope-freeze.log` 的 `DEEP-EQUAL-EXCEPT-VERSION` ×7）。7 个文件末尾仍为单个 `\n`，无编码/空白变化。

**manifest 形状**（`c2-manifest-diff.log`、`c2-final-state.log`）：

- 15 键集合不变（catalog 键序），`sha256 = d94102d2440a03768979d2c7a27b44c50f3a97a12493bc6000e0c760ae348737`；
- `git diff --no-renames --numstat 6be891a -- artifacts/local-packages/manifest.json` = **`7  7  artifacts/local-packages/manifest.json`**（PV-4 逐字钉值）；
- 7 个新增行均为 `<name 去 @…→连字符>-<target version>.tgz`（`nomicore-persistence-0.5.0.tgz` … `nomicore-yjs-server-0.6.0.tgz`），**无旧 filename 残留**（0.4.0/0.3.0/0.5.0 旧名 0 命中）；
- **确定性再生实证**：同参数再跑一次 `pack:local`，manifest 的 sha256 前后**逐字节相同**（`d94102d2…` → `d94102d2…`），numstat 仍 7+7（`c2-pack-rerun.log`）。

## 15. File scope check（每个实际 changed path vs 设计 §14 ALLOW）

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/persistence/package.json` | §14 ALLOW 第 5 行 | `0.4.0→0.5.0`（批次 headline 锚点） |
| `packages/dsh-persistence/package.json` | §14 ALLOW 第 6 行 | 闭包 bump |
| `packages/namespace-runtime/package.json` | §14 ALLOW 第 7 行 | 闭包 bump |
| `packages/namespace-registry/package.json` | §14 ALLOW 第 8 行 | 闭包 bump |
| `packages/namespace-api/package.json` | §14 ALLOW 第 9 行 | 闭包 bump |
| `packages/ws-replication/package.json` | §14 ALLOW 第 10 行 | `0.5.0→0.6.0` |
| `apps/yjs-server/package.json` | §14 ALLOW 第 11 行 | 闭包 bump |
| `artifacts/local-packages/manifest.json` | §14 ALLOW 第 12 行 | `pack:local` 再生（PV-4） |

**DENY 面逐项核对（`c2-scope-freeze.log`）**：

- 逐字节不变（`git diff --quiet 6be891a -- <path>` 全绿）：根 `package.json`、`domains/vfs3-assets/package.json`、`pnpm-lock.yaml`、`scripts/package-catalog.mjs`，以及其余 8 个 publishable manifest（`vfsl`、`vfsl-protocol`、`vfsl-codegen`、`doc-runtime`、`clock`、`instance`、`namespace-diagnostic-log`、`replication-protocol`）。
- `git diff --no-renames --name-status 6be891a` 的完整变更集 = C1 四文件 + 本轮 8 文件，**无** `packages/**/src/**`、`apps/**/src/**`、`domains/**`、`docs/**`、`scripts/**`、`.github/**`、门禁冻结件（`acquire.mjs`/`root-probe.mjs`/`provenance-b3.json`/`baselines.json`/`root-test-known-red.json`）改动；untracked 仅 `wiki/raw/task_issue-472*.md`。
- 未触碰 Cordis/Timer 依赖范围与 dependency/peerDependency 归属（7 个 pinned 文件深度相等即证）；未执行 `publish:packages -- --publish` 或任何真实发布（`publish:verify` 只做 `npm publish --dry-run --json --ignore-scripts`）。

## 16. Verification（本轮全部实跑；日志均在 `.cache/issue-472-impl/`）

| # | Command（固定 pnpm 10.28.2，除注明外） | Result | Evidence |
|---|---|---|---|
| 1 | 7×`package.json` 版本行编辑（单行替换 + 前置 `count == 1` 断言） | 7/7 恰 1 删 1 增；deep-equal except `version` | `c2-version-edits.log`、`c2-scope-freeze.log` |
| 2 | `node scripts/build-local-packages.mjs`（= `pack:local`，无参 → `artifacts/local-packages`） | **exit 0**，15 tarball；manifest 15 键、7 增 7 删 | `c2-pack.log`、`c2-manifest-diff.log` |
| 3 | 同参数再跑 `pack:local`（确定性再生） | **exit 0**；manifest sha256 前后相同 `d94102d2…`；numstat 仍 7+7 | `c2-pack-rerun.log` |
| 4 | `node scripts/verify-package-tarballs.mjs`（**默认模式**，`NOMICORE_VERIFY_REGISTRY_INTEGRITY` 未设置） | **exit 0**，`verified 15 publishable tarballs`，`ERROR:` 0 行；7 次 `npm publish --dry-run --json` 全部 id 匹配，8 个已发布版本 registry integrity 相等 | `c2-publish-verify.log` |
| 5 | `node scripts/verify-reproducible-packages.mjs` | **exit 0**，`reproducible tarballs verified for 15 packages`（两次独立构建 sha256 逐包相同） | `c2-publish-reproducible.log`（含 `pnpm --version: 10.28.2`） |
| 6 | `pnpm install --frozen-lockfile --lockfile-only` + `git diff --exit-code -- pnpm-lock.yaml` | 安装 **exit 0**（`Scope: all 17 workspace projects`，250 ms）；lockfile **零 diff**（exit 0） | `c2-lockfile.log`、`c2-final-state.log` |
| 7 | `pnpm generate --check` | **exit 0**；`domains/vfs3-assets/generated.ts` sha256 前后相同（`1c079a16…`）；`git diff --exit-code -- domains/` exit 0 | `c2-generate-check.log` |
| 8 | `git diff --check 6be891a`（G6 空白判定，主 worktree） | exit 0 | `c2-diff-check.log` |
| 9 | **一次性 worktree** `.worktrees/sa3-c2-probe`（父 `1198312` + 8 文件本地临时 commit → `HEAD=430196574e635896b1d6778a7402989bd9a2f57e`，`tree=bdbdd7a41f743048b9b4ac01f2f252971df79ae8`）：`node packages/persistence/test/fixtures/cordis-baselines/gates.mjs` | **13/13 PASS，exit 0**；`G13 state=exact`（7 项版本表 + manifest 7/7 + ledger/catalog/`baselines.json` 逐字节）；**`G6 PASS: git diff --check 6be891a clean; artifacts/ untouched`**（manifest 已提交）；`G1′` changed = 恰 8 个 release 文件；`G3` tracked = `{packages/ws-replication/package.json}`；`G5` 7 entries 相等 + runtime surface test 通过；`G12` ⊆ 5 文件闭集 | `probe-commit.log`、`c2-probe-gates.log` |
| 10 | **可选 exact 态矩阵预验**（同一一次性 worktree）：`node …/run-baseline.mjs --all --matrix` | **exit 0，41/41 cells pass**；`runHead=4301965…` / `runTree=bdbdd7a…`；内置审计 `EVIDENCE AUDIT PASS (41 cells, identity digests, freshness, logPath containment, directory discipline)`；gates cell summary **21 行** = 7 行 G10 明细 + **13 行 gate 结果（G1′…G13，含 `G13 … state=exact`）** + 1 行 `all 13 gates passed`（无 `slice(-N)` 截断）；root-test `status=pass`、counts `5987/5991`、`failedUnexpected=[]` | `c2-probe-matrix.log` + `probe-evidence/{matrix.json,gates.json,gates.log,root-test.json}` |
| 11 | 一次性 worktree 清理 | `git worktree remove --force` + `prune` exit 0；`git worktree list` 恢复 2 项，`.worktrees/` 空 | `c2-probe-cleanup.log` |
| 12 | 全量收尾状态复核 | HEAD 仍 `1198312`；`git status` = 8 个 `M` + 7 个 wiki `??`；8 文件 numstat 形状不变；lockfile 仍零 diff；manifest sha256 仍 `d94102d2…`；15 tarball | `c2-final-state.log` |

**exact 态矩阵的关键字段（`probe-evidence/matrix.json`）**：`cells=41`、`statuses=['pass']`、`runHead=430196574e635896b1d6778a7402989bd9a2f57e`、`runTree=bdbdd7a41f743048b9b4ac01f2f252971df79ae8`、`generatedAt=2026-11-15T00:31:18.873Z`；root-test counts `{passed:5987, failed:4, total:5991}`（4 = 台账冻结的 4 个 known-red；28 个 environment red 在固定 10.28.2 下不再红，随 cell 的 ledger 文案原样记）。

## 17. SA2 Finding / 交付条件落实（C2 面）

| Finding / 条件 | 实现 | 结果 |
|---|---|---|
| PV-3 七包版本表（from→to 逐字） | 逐文件单行替换，7/7 与 PV-3 一致 | deep-equal except version ×7；文本 diff 1 删 1 增 ×7 |
| PV-4 manifest numstat 口径 | `pack:local` 再生；`--no-renames --numstat` = 7 增 7 删；逐键 target filename；无旧名残留 | 逐项通过（`c2-manifest-diff.log`） |
| PV-5 台账 / catalog 冻结 | `root-test-known-red.json`、`scripts/package-catalog.mjs` 零改动 | 逐字节相同（`c2-scope-freeze.log`） |
| PV-8b `baselines.json` 冻结 | 未触碰 | 逐字节相同；probe 上 G13.f PASS |
| 条件 2（两态自洽） | C1 上 absent（控制器已复跑）∧ C2 候选树上 exact + G6 干净 | probe gates 13/13 `state=exact` + `G6 clean`（`c2-probe-gates.log`） |
| 条件 6（发布门禁证据纪律） | `publish:verify` 默认模式（未设 `NOMICORE_VERIFY_REGISTRY_INTEGRITY=0`）；pnpm 固定 10.28.2 并记录 `--version`；未执行真实发布 | `c2-publish-verify.log`、`c2-publish-reproducible.log` |
| 条件 8（锁定文件范围） | 改动 ⊆ §14 ALLOW 的 8 文件 | `c2-scope-freeze.log` 全树变更集复核 |
| A4-2 manifest 收敛 | 15 键不变、7 filename 更新、与 `pack:local` 结果逐字节一致（重跑同 sha） | `c2-pack-rerun.log` |
| A4-3 变更记录 | 由控制器写入 C2 提交正文（骨架见 §20）；本报告提供版本矩阵/闭包理由/AC3 结果原文 | 移交控制器 |
| A4-4④ / A4-5 / D15 | `generate --check` exit 0 且 `generated.ts` 不变 | `c2-generate-check.log` |
| A5-2 / D15 | lockfile、catalog、根/其余 manifest 零 diff；依赖字段逐字节不变 | `c2-lockfile.log`、`c2-scope-freeze.log` |

## 18. Deferred verification（不由 SA3 承担，移交 final verification 在 `R` 上重跑）

1. AC 证据一律以 **final verification 在 `R` 上独立重跑**为准（SA6 §12.0.1 单树绑定）：`acquire.mjs --all` → `run-baseline.mjs --all --matrix`（41 cells、含全部 14/21 行 `[gates]` summary、审计 exit 0 且 `problems=[]`）、fault ×4、N-5…N-9、`pack:local`→`publish:verify`（默认模式）→`publish:reproducible`、lockfile 零 diff、`generate --check`、`git diff --no-renames --name-only 6be891a..R` 形状复核。
2. **F-G（absent 分支红灯）在真实 C2 树上的重跑**、以及 F-A…F-K 在 `R` 等价副本上的复核（设计 §10 时机）。
3. C2 release 正文的 A4-3 ①–⑩ 十项（版本矩阵/内容/AC1/AC2/AC3/AC4/known-red 披露/非目标/#464–#466 不复用/toolchain + `R`）与 §8.2 条件 4 的**两分文案**（#471 记录修正）——由控制器写入提交正文。
4. 本轮 probe 矩阵的 root-test counts 与 C1 轮不同（固定 pnpm 下 28 environment red 转绿，`5987/5991` vs C1 的 `5959/5991`）；终验按实际值原样披露，不得据此扩账或宣称全绿。

## 19. Deviations or blockers

- **无 blocker**；未触发设计 §12 任何停手条件（无依赖范围/归属变更、无公共面/schema/wire 改动、无台账扩账、无应红实绿）。
- 记录性偏差（不影响判据）：
  1. `publish:reproducible` 首次调用（未把固定 pnpm shim 置 PATH 首位）exit 1，根因是 PATH 上的 corepack shim 为 pnpm `v11.28.5` 拒绝项目钉定的 `10.28.2`（`scripts/build-local-packages.mjs` 经 PATH 调用 `pnpm run build`）；按设计 §11「pnpm 语义固定 10.28.2」重跑即 **exit 0**。现场留档 `.cache/issue-472-impl/c2-publish-reproducible-attempt1-note.md`（第一次调用日志被随后通过日志覆盖，故以 note 形式留证据）。
  2. 一次性 probe 的 `node_modules` 以「真实目录 + 逐条符号链接到主 worktree 安装」提供（规避 `.gitignore` `node_modules/` 不匹配 symlink 的探针噪声）；`.cache/cordis-baselines/{overlay,npm,dsh}` 从主 worktree 复制（overlay 仅含第三方 `@deepseek-ai/*`/@standard-schema/cosmokit，本次 bump 不触及），矩阵由此在 probe 内独立复算 `acquire` 与 41 cells，未复用 C1 的 matrix 证据。
  3. 设计 §9 C2 提到「版本编辑 → pack:local → publish:verify/reproducible 预检 → lockfile 复核 → 暂存 8 文件提交」为一会话内顺序；本轮 `publish:reproducible`（两次独立构建）在 `publish:verify` 之后完成，`pack:local` 再跑一次用于确定性复核，顺序与本意等价。
  4. 本轮不承担 ADR/两分文案正文撰写与 GitHub 回填（§9 C3 / AC6），属控制器与终验轮。

## 20. Suggested commit message（Controller 选择；SA3 未执行 commit）

提交文件（**精确清单，恰 8 个**）：

```
apps/yjs-server/package.json
artifacts/local-packages/manifest.json
packages/dsh-persistence/package.json
packages/namespace-api/package.json
packages/namespace-registry/package.json
packages/namespace-runtime/package.json
packages/persistence/package.json
packages/ws-replication/package.json
```

正文骨架（按设计 §9 C2 / SA6 A4-3 ①–⑩ 填写）：

```
chore(release): Nomicore 0.5.0 —— Cordis rc.12 双形态 Root 三基线收官批次

① 版本矩阵与闭包理由: persistence/dsh-persistence/namespace-runtime/namespace-registry 0.4.0→0.5.0;
   namespace-api 0.3.0→0.4.0; ws-replication/yjs-server 0.5.0→0.6.0（非闭包 8 包与根/域包不变）
② 内容: #470/#471 双形态 Root seam（persistence service.ts / ws-replication plugin.ts）；无公共 API/schema/wire/服务名/持久化布局变化
③ AC1: 3×15 typecheck + 41/41 矩阵（gates 13/13、G13 state=exact）
④ AC2: 工件身份/provenanceDigest 9d663355…/通道（B1/B2 legacy、B3 symbol）/负控结果
⑤ AC3: pack:local 15 tarball；publish:verify 默认模式 15/15（7 新版本 dry-run + 8 已发布 integrity 相等）；publish:reproducible 15/15 sha256 一致
⑥ AC4: 公共契约冻结五项证据（含 7-entry 快照与 #471 记录的两分修正文案，§8.2 条件 4 逐字）
⑦ known-red 披露: 4 test-d 冻结红；固定 pnpm 10.28.2 下 root-test 实际 counts（不宣称全绿）
⑧ 非目标: 无真实 MABF/DSH 部署、无本地 patch 移除、未执行 npm publish
⑨ 不复用 #464–#466 证据
⑩ toolchain: node v24.13.0 / pnpm 10.28.2 / R 的 HEAD+tree
```

---

# SA3 实现报告增补 —— round 1 / implementation iteration 2（**C4 终审 remediation**）

- 任务对象：`nomicore-ai/nomicore#472`，round 1，implementation iteration 2；范围 = 设计 rev3 §9.1 **C4（设施 remediation，恰 2 文件）** + dispatch 指定的全部新增负控（F-L/F-M、N-8e/N-8f/N-8g、N-10、T-1/T-2、回归集 N-6/N-6b/N-7/N-7b/N-8a–d/N-9）与 **C4 候选树预验**（一次性 worktree + 固定 pnpm 10.28.2 完整 `--all --matrix`）。
- 设计/裁决输入：`task_issue-472_design.md` **rev3**（§7.3.g W-2、§7.4 W-1/W-3/W-4、§9.1 C4、§10 F-L/F-M/N-8e/f/g/N-10/T-1/T-2、§11.1 W-6、§14 ALLOW·DENY）；`task_issue-472_design_conflict_report.md` **§14**（PV-9、PV-8a iteration-3 补钉、勘误 E-4/E-5、条件 3′/6/9/11/12、§14.9 实现后核对清单 (a)–(j)）；`task_issue-472_sa9_standards.md`（SA9-1…SA9-5）；`task_issue-472_sa10_spec.md`（B-1…B-4）。
- 起始/结束 HEAD：`d5cf4850e317b51df9b50c33f8487d832565f8d6`（C3a）；**SA3 未执行 `git add`/`commit`/`push`**，主 worktree 不提交。结束时 `git status --porcelain` = 本轮 2 个设施文件 `M` + 6 个 wiki 工件（`M` design/conflict_report/dispatch/sa3_impl（本报告）、`??` sa9/sa10；除本报告外均为 SA1/SA8 既有编辑，不属本轮代码改动）。
- 结论：**C4 两文件实现完成；dispatch 要求的全部新增负控应红实红、全部回归负控仍红；C4 候选树（一次性 worktree + 本地临时 commit）gates 13/13（G13 `state=exact`、G6 干净）、固定 pnpm 10.28.2 下 41/41 全 pass、内置审计 RESULT `exit=0 problems=[]`、root-test `pnpmProbe.exitCode=0` 且 stdout `10.28.2`、counts `5987/5991`、`failedUnexpected=[]`；T-1/T-2 在真实打包输出一次性副本上 `publish:verify` 非零并指名受影响包、恢复后 15/15 且 reproducible 15/15。无 blocker。**

## 21. W-1…W-4 落点（逐项；行号为最终文件行号）

| 项 | 落点 | 实现（逐字对齐设计 rev3） |
|---|---|---|
| **W-1**（PV-9） | `run-baseline.mjs` L1087–1117 `trackedWorktreeFingerprint()`（doc + helper）；L1119–1129 `writeRunMarker()`；L1244–1278 `auditRunMarker()`；L1354–1356 `auditMatrix()`；L1550 marker console 行；L1571 `matrix.json` 字段 | **新增** `trackedWorktreeFingerprint()`：`fs.mkdtempSync(os.tmpdir())` → `GIT_INDEX_FILE=<tmp>/index` → `git read-tree HEAD` → `git add -u` → `git write-tree` → 返回 tree OID，`finally` 递归删除临时目录；不读/不改真实 index、HEAD、ref（只向 `.git/objects` 写无引用对象）。`run-marker.json` = **`{startedAt, head, worktree, porcelain}`**，`tree` 字段移除且全树零残留（`grep -n "runTree\|marker\.tree"` = 0）；`matrix.json` = `runHead` / **`runWorktree`**。审计检查 1：standalone 的 HEAD 比对**保留且独立**；**built-in 与 standalone 两模式**均比对 `trackedWorktreeFingerprint() === marker.worktree`，红点文案逐字 = `tracked working-tree content drifted during the run: marker.worktree=<X> current=<Y>`。`writeRunMarker` console 行 = `head=<12> worktree=<12> startedAt=<…>`。 |
| **W-2**（PV-8a 机械判定补钉） | `gates.mjs` L131–141 `isTicketDoc()` | `path.posix.dirname(posix) === 'wiki/raw'` ∧ `/^task_issue-472.*\.md$/`（basename）。`wiki/` 根下、`wiki/raw/nested/…`、`wiki/other/…` 一律 tracked 越界。**不动**：`untrackedPaths()`（L236–245）与 `untracked ⊆ wiki/**` 分量；G13.g tracked 原语 `wholeTreeChangedPaths()`（L231–233）= `git diff --no-renames --name-only BASE`。 |
| **W-3**（条件 9 可机判载体） | `run-baseline.mjs` L1442–1463 `printAudit()` | 成功与失败**两条路径都先**输出恰一行 `[run-baseline] EVIDENCE AUDIT RESULT (<context>): exit=<0|1> problems=<JSON 数组>`；`<context>` ∈ {`built-in matrix audit`, `standalone --audit-evidence`}；成功含字面量 `problems=[]`（exit=0），失败为单行可 `JSON.parse` 的非空数组（exit=1）；人读 `EVIDENCE AUDIT PASS/FAIL` 与 `  - <problem>` 明细行保留；exit code 语义不变；**零新增落盘 artifact**（`evidence/` 目录允许集零改动），该行走既有日志通道（`.cache/issue-472-impl/c4/*.log`）。 |
| **W-4**（SA9-5） | `run-baseline.mjs` L1530–1548 `main()`（`mkdirp` 已删）；L906–911 gates cell 注释；`gates.mjs` L5–13 头注 | **删除** `main()` 头部 `mkdirp(EVIDENCE)`（留原因注释；`writeRunMarker` L1120 / `writeEvidence` / `runGatesCell` / `runRootTestCell` 各自 mkdir，无调用路径依赖预创建）⇒ standalone 缺目录 guard 复活（N-10 实证）。gates cell 注释改「**完备性是判据、行数不钉常数**（现盘 21 行 = 7 G10 明细 + 13 gate 行 + 汇总），不得回退 `slice(-N)`」。`gates.mjs` L5/L7/L9 头注对齐 release 语义：G1′ = 白名单外零 diff + 8 文件白名单内交 G13 钉形状；G3 = tracked ⊆ {`package.json`}（版本行交 G13）∧ untracked ⊆ 4 named fixtures，`plugin.ts` 与 4 fixture 本体零 diff。 |

连带注释同步：`run-baseline.mjs` L27–37 头注（marker 字段 / 指纹 / RESULT 行）、L1045–1082 审计 doc comment（检查 1 改 PV-9；W-3 RESULT 说明）。**未触碰**：`acquire.mjs`、`root-probe.mjs`、`provenance-b3.json`、`baselines.json`、`root-test-known-red.json`、`public-surface.base.json`、`cordis-public-surface.test.ts`、8 个 release 文件、`scripts/**`、`.github/**`、`docs/**`、生产 `src/**`。

## 22. Changed paths（本轮精确 2 文件）

| # | Path | Design section | Change | numstat（vs HEAD `d5cf485`） |
|---|---|---|---|---|
| 1 | `packages/persistence/test/fixtures/cordis-baselines/gates.mjs` | §7.3.g（W-2）、§9.1 C4、§14 ALLOW 第 1 行 | `isTicketDoc()` dirname 精确判定；L5/L7/L9 头注对齐 release 语义（W-4/SA9-5.1） | `15 增 / 5 删` |
| 2 | `packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs` | §7.4（W-1/W-3/W-4）、§9.1 C4、§14 ALLOW 第 2 行 | 指纹原语 + marker/matrix 字段切换 + 两模式指纹比对 + RESULT 行 + `mkdirp(EVIDENCE)` 删除 + 注释对齐 | `94 增 / 21 删` |

合计 `2 files changed, 109 insertions(+), 26 deletions(-)`。两文件 blob（控制器可核对）：`gates.mjs` = `3b5e6511e765b5f02300380e699fa4ec1cce6cf2`、`run-baseline.mjs` = `cb1c2f724903a4edd50701c365dbfd113e5ee7f9`。

## 23. 新增负控（应红实红；环境 = 一次性 worktree `.worktrees/issue-472-c4-probe`，父 `d5cf485` + 两设施文件本地临时 commit `69097ac7…`，tree `91c1c49a38746a9314955d632989939aad418379`；负控后 `git worktree remove --force` + `prune`，主 worktree 零提交）

### 23.1 F-L / F-M（W-2；**必须 staged**；一次性副本上注入 → 红 → `git reset --hard` 还原）

| # | 注入 | gates 结果 | 红点（逐字） | 同轮绿 | 证据 |
|---|---|---|---|---|---|
| **F-L** | 新建 `wiki/task_issue-472_probe.md` 并 `git add`（直接父目录 = `wiki`） | **exit 1**，1/13 gate 失败 | `G13` FAIL（exact 分支）：`tracked change outside the release allowlist: wiki/task_issue-472_probe.md` | `G1′`/`G2`/`G4`/`G12` **PASS**（该路径不在其 pathspec） | `.cache/issue-472-impl/c4/04-F-L.log` |
| **F-M** | 新建 `wiki/raw/nested/task_issue-472_probe.md` 并 `git add`（更深层，basename 命中但父目录 ≠ `wiki/raw`） | **exit 1**，1/13 gate 失败 | `G13` FAIL（exact 分支）：`tracked change outside the release allowlist: wiki/raw/nested/task_issue-472_probe.md` | `G1′`/`G2`/`G4`/`G12` **PASS** | `.cache/issue-472-impl/c4/05-F-M.log` |
| 正向对照 | 还原后干净 C4 候选树 | **exit 0，13/13 PASS** | `G13 state=exact`（C3 已交付 `wiki/raw/task_issue-472*.md` 全部保持绿） | — | `.cache/issue-472-impl/c4/06-post-F-control.log` |

> 说明：树本身处于 exact 态，因此 G13 的 `absent` 分支同时列出 8 个 release 文件差异（该分支本应失败）；判红点以 `exact` 分支为准——其**唯一** problem 即上表指名的注入文件，与设计 §10 F-L/F-M 的应红点逐字一致。

### 23.2 N-8e / N-8f / N-8g / N-10（W-1 / W-3 / W-4）

| # | 注入 | 实测结果 | RESULT 行 | 证据 |
|---|---|---|---|---|
| **N-8e** | 41/41 矩阵完成后，对 `INSTALL.md` 追加内容、**不 `git add`**（未暂存 tracked 修改；真实 index 与 HEAD 均不变），跑 standalone `--audit-evidence` | **exit 1**，problem = `tracked working-tree content drifted during the run: marker.worktree=91c1c49a38746a9314955d632989939aad418379 current=22b4a2bdb3bfbb99b1a6cb9b25b59003a269de37` | 恰 1 行、`exit=1 problems=[…]` 非空 | `32-N-8e.log` |
| N-8e 还原 | `git checkout -- INSTALL.md`（字节复原） | **exit 0**，`problems=[]` | 恰 1 行、`exit=0 problems=[]` | `32-N-8e-restored.log` |
| **N-8g** | 同 tree、HEAD 移动：`git commit --allow-empty -m "tmp: N-8g head-move probe"`（指纹不变） | **exit 1**，**仅 1 条** problem = `evidence belongs to another tree: marker.head=69097ac7… current HEAD=76eb5942…`；**drift 检查未红**（同指纹） | 恰 1 行、非空 | `33-N-8g.log` |
| N-8c（回归） | 另一棵树：HEAD + 内容都不同（构造不同 tree 的提交） | **exit 1**，2 条：head 跨树 + `tracked working-tree content drifted during the run: marker.worktree=91c1c49a… current=aff133cd…` | 恰 1 行、非空 | `34-N-8c.log` |
| **N-10a** | 移走 `evidence/` 目录后 standalone 审计（W-4 复活 guard） | **exit 1**，problem = `missing evidence directory: .cache/cordis-baselines/evidence (a matrix run without evidence is never a pass)`；审计**未**静默重建目录 | 恰 1 行、非空 | `35-N-10a-missing-dir.log` |
| **N-10b** | 建**空** `evidence/` 目录后 standalone 审计 | **exit 1**，**49 条** problem（missing run marker + 41 missing cell + 3 missing baseline 目录 + 3 missing fixed 目录 + matrix） | 恰 1 行、非空 | `36-N-10b-empty-dir.log` |
| **N-8f** | 一次性副本上启动 `--all --matrix`（固定 pnpm）；**首个本轮证据文件 `B1/typecheck.json` 出现后**（marker 已写：`head=69097ac7… worktree=91c1c49a…`，`startedAt=2026-11-15T02:28:59Z`）于 **10:30:23** 向 tracked `INSTALL.md` 追加一行（非暂存），矩阵继续跑完 | **MATRIX FAIL，exit 1**；内置审计 RESULT `exit=1`，problem 含 `tracked working-tree content drifted during the run: marker.worktree=91c1c49a… current=488458e07eec1eba646f5592259333ae1c679fe8`；并列红（如实披露、设计允许）：gates cell `status=fail`，其 `G13` 指名 `INSTALL.md` | 恰 1 行、非空 | `50-N-8f-matrix.log`（probe 内 `evidence/gates/gates.log` 亦指名 `INSTALL.md`） |

### 23.3 回归负控（N-6 / N-6b / N-7 / N-7b / N-8a–d / N-9；备份 → 污染 → 红 → 还原）

| # | 注入 | 实测红点（逐字摘要） | RESULT / 证据 |
|---|---|---|---|
| N-6 | 删除 `B1/provenance.json` | `missing required evidence: .cache/cordis-baselines/evidence/B1/provenance.json` | exit 1 / `40-N-6.log` |
| N-6b(a) | `B2/contract.json` 的 `logPath` → 不存在路径 | `B2/contract logPath: file does not exist: …/B2/does-not-exist.log` | exit 1 / `41-N-6b-nonexistent.log` |
| N-6b(b) | `logPath` → `../../escape.log` | `B2/contract logPath: path escapes evidence/: ../../escape.log` | exit 1 / `42-N-6b-escape.log` |
| N-7 | 截断 `B3/provenance.json` | `unparsable evidence: …/B3/provenance.json (Unterminated string in JSON …)` | exit 1 / `43-N-7.log` |
| N-7b | `evidence/B1/zz-old.json` 换名旧工件 | `evidence/B1/zz-old.json: file outside the six allowed classes` | exit 1 / `44-N-7b.log` |
| N-8a | `touch -d 2020-01-01 B2/contract.json` | `B2/contract: stale evidence (mtime predates the run marker)` | exit 1 / `45-N-8a.log` |
| N-8b | `B2/contract.json` 换成 B3 的 `provenanceDigest` | `B2/contract: provenanceDigest="112f0db0…" expected 88f718ba…`（identity mismatch） | exit 1 / `46-N-8b.log` |
| N-8d | 换入上一轮 `matrix.json` | `generatedAt … predates the run marker` + `runHead=undefined ≠ marker.head` + `runWorktree=undefined ≠ marker.worktree`（单树/内容绑定） | exit 1 / `47-N-8d.log` |
| N-9 | 一次性副本注入合成新红测试 `packages/persistence/test/zz-n9-synthetic-new-red.test.ts`（固定 10.28.2 PATH）后跑 `--suite root-test` | root-test cell **status=fail、exit 1**：counts `5987/5992`（5 = 4 frozen + 1 合成新红）、`failedUnexpected=["N-9 synthetic new red N-9 synthetic new red not in the frozen ledger"]`；`pnpmProbe.exitCode=0` / `10.28.2` | `60-N-9.log`、`61-N-9-cell.json` |
| 还原 | 全量 `cp -a` 还原规范证据目录 | **exit 0、`problems=[]`** | `48-N-control-restored.log` |

**审计 RESULT 行纪律核对**：上表全部审计日志（含成功/失败、built-in/standalone）**每次恰 1 行** `EVIDENCE AUDIT RESULT`，`exit=` 与 `$?` 一致（见 §26 的逐日志计数）；`gates.mjs` 日志不含该行（非审计）。

## 24. T-1 / T-2（B-1 执行面；真实打包输出一次性副本、`publish:verify` 默认模式）

环境：主 worktree、`PATH=$PWD/.cache/issue-472-final/bin:$PATH`（`pnpm --version` = **10.28.2**）、未设 `NOMICORE_VERIFY_REGISTRY_INTEGRITY=0`。

1. `pnpm pack:local`（无参 → `artifacts/local-packages`）：**exit 0**，15 tarball；`git status --porcelain -- artifacts/` 空；`git diff --exit-code -- artifacts/local-packages/manifest.json` **零 diff**（`10-T-pack.log`、`10-T-pack-status.txt`）。
2. `sha256sum` 全量表 → `10-T-sha256-before.txt`；整目录 `cp -a` 备份（`.cache/issue-472-impl/tarball-probe/canonical-backup`），sha256 逐行相同。
3. **T-1（篡改字节）**：副本中**恰一个** tarball（`nomicore-persistence-0.5.0.tgz`，size=80906）在 `floor(size/2)=40453` 偏移 XOR `0x01`（byte 56→57）；sha256 `7d92c3fa…` → `a3fc934d…`；备份原目录 → 换入副本 → `pnpm run publish:verify`（默认模式）：**exit 1**，`ERROR: tar -xzf …/artifacts/local-packages/nomicore-persistence-0.5.0.tgz -C /tmp/… failed (2)` —— **按文件名指名受影响包**（`11-T1-publish-verify-tampered.log`、`10-T1-tamper-sha.txt`）。
4. 还原（sha256 逐字节复核 `restore after T-1 byte-identical OK`；manifest 零 diff；`git status --porcelain -- artifacts/` 空）。
5. **T-2（删除 tarball）**：同一探针框架下副本中删除**恰一个** tarball（`nomicore-yjs-server-0.6.0.tgz`，余 14）→ 备份 → 换入 → `publish:verify`（默认模式）：**exit 1**，`ERROR: tar -xzf …/artifacts/local-packages/nomicore-yjs-server-0.6.0.tgz -C /tmp/… failed (2)` —— 按文件名指名（`12-T2-publish-verify-deleted.log`）。
6. 还原后再跑：`publish:verify` **exit 0**（`verified 15 publishable tarballs`，`13-T-publish-verify-restored-green.log`）；`publish:reproducible` **exit 0**（`reproducible tarballs verified for 15 packages`，`14-T-publish-reproducible-restored.log`）。前后 sha256 表（before / backup / after-T1 / final）**逐行相同**（按 `sha256 + basename` 归一化比对，3 组 diff 全绿）。
7. 清理：探针副本目录已删除；规范目录 15 tarball、manifest 零 diff、`git status --porcelain -- artifacts/` 空。**披露**：T-2 的红点唯一落点是 `publish:verify`（`publish:reproducible` 独立双构建于临时目录、不读 `artifacts/local-packages`），与设计 §10 披露一致。

> 未以源码测试/矩阵/G13 替代；注入只落 gitignored `*.tgz` 与副本，`scripts/**` 零改动。

## 25. C4 候选树预验（一次性 worktree + 本地临时 commit；固定 pnpm 10.28.2 同会话）

- 一次性 worktree：`.worktrees/issue-472-c4-probe`，父 `d5cf485`，`git add` 恰 2 个设施文件后 `git -c user… commit` → **HEAD `69097ac74c50b04aacca179cdc7702e8f0786069`、tree `91c1c49a38746a9314955d632989939aad418379`**；`git status --porcelain` 空。`node_modules` 用「真实目录 + 逐条符号链接到主安装」（含 16 个 package/app/domain 级 `node_modules` 的相对符号链接，规避 `.gitignore` `node_modules/` 不匹配 symlink 的探针噪声）；`.cache/cordis-baselines/{dsh,npm,overlay}` 复制，`evidence/`、`workspaces/` 由探针内独立复算。
- **gates（C4 候选树）**：**13/13 PASS，exit 0**；`G13: state=exact`（7 项版本表 + manifest 7/7 + ledger/catalog/baselines.json 逐字节 + tree changeset ⊆ 8 release + 4 C1 facility + `wiki/raw/task_issue-472*.md`）；**`G6 PASS: git diff --check 6be891a clean; artifacts/ untouched`**；`G5: 7 entries match base snapshot; runtime surface test passed`（`03-probe-gates.log`）。
- **完整矩阵**（`PATH` 首位 = `.cache/issue-472-final/bin`（exec corepack 10.28.2），同一会话）：`pnpm --version` = **10.28.2**（落盘 `20-pnpm-version.txt`）；`run-baseline.mjs --all --matrix` → **exit 0，41/41 cells pass**（`21-matrix-all.log`、`22-matrix-facts.json`）：
  - `run-marker.json` = `{startedAt: 2026-11-15T02:16:54.761Z, head: 69097ac7…, worktree: 91c1c49a…, porcelain: ""}`（**无 `tree` 字段**；`marker.worktree === HEAD tree`）；
  - `matrix.json`：`cells=41`、`statuses={pass:41}`、`runHead=69097ac7…`、**`runWorktree=91c1c49a…` === marker.worktree === 该 worktree 内容树**、`generatedAt=2026-11-15T02:28:11.443Z`；
  - gates cell：`status=pass`、`exitCode=0`、`summaryLines=21`（7 G10 明细 + 13 gate 行 + `all 13 gates passed`；完备性口径、行数不钉常数）、`G13 state=exact`；
  - root-test cell：`status=pass`、counts `{passed:5987, failed:4, total:5991}`（4 = 台账冻结 known-red；28 environmentRed 在固定 pnpm 下不再红，台账不动）、`ledger={knownRed:4, environmentRed:28}`、**`failedUnexpected=[]`**、**`pnpmProbe={exitCode:0, stdout:"10.28.2"}`**；
  - 内置审计：日志中 `EVIDENCE AUDIT RESULT (built-in matrix audit): exit=0 problems=[]` **恰 1 行**（`25-audit-result-lines.txt`）。
- 结束后：`git worktree remove --force .worktrees/issue-472-c4-probe` + `git worktree prune`（exit 0；`git worktree list` 回到 `main` + 任务 worktree 两项，`.worktrees/` 空）；主 worktree HEAD 仍 `d5cf485`、零新提交。干净 41/41 的 matrix/gates/root-test cell 已归档 `.cache/issue-472-impl/c4/{28-c4-matrix-clean.json,29-c4-gates-cell-clean.json,29b-c4-root-test-cell-clean.json}`，完整证据目录备份在 `.cache/issue-472-impl/c4/evidence-backup/`（295 文件）。

**R′ 期望值语义（PV-9）**：干净树（无未暂存 tracked 修改）上 `fingerprint === HEAD tree`；因此 **C4 提交后 `marker.worktree === runWorktree === C4 tree`**。若控制器提交的两文件内容与本报告一致（blob `3b5e6511…` / `cb1c2f72…`），则 **C4 tree 应为 `91c1c49a38746a9314955d632989939aad418379`**（父 `d5cf485`）。**不得**把 BASE tree `b41d9e73…` 或任何「HEAD tree」当内容绑定（round 1 C1 marker 记 BASE tree 的失效模式已被 W-1 消除）。

## 26. Verification（本轮全部实跑；日志 `worktree`-relative 路径）

| # | Command | Result | Evidence |
|---|---|---|---|
| 1 | `node --check gates.mjs` / `node --check run-baseline.mjs` | 均 exit 0 | `70-tsc-persistence.log` |
| 2 | `node node_modules/typescript/bin/tsc -p packages/persistence/tsconfig.json` | **exit 0**（受影响包 typecheck） | `70-tsc-persistence.log` |
| 3 | C4 候选树 `node …/gates.mjs` | **13/13 PASS，exit 0**，G13 `state=exact`，G6 干净 | `03-probe-gates.log` |
| 4 | F-L 注入（staged `wiki/task_issue-472_probe.md`）→ gates | **exit 1**；G13 exact 指名该文件；G1′/G2/G4/G12 PASS；还原后 13/13 | `04-F-L.log`、`06-post-F-control.log` |
| 5 | F-M 注入（staged `wiki/raw/nested/…`）→ gates | **exit 1**；G13 exact 指名该文件 | `05-F-M.log` |
| 6 | 固定 pnpm：`pnpm --version` | **10.28.2** | `20-pnpm-version.txt` |
| 7 | C4 候选树 `run-baseline.mjs --all --matrix`（固定 pnpm，同会话） | **exit 0，41/41 pass**；RESULT `exit=0 problems=[]` 恰 1 行；`pnpmProbe` 0/10.28.2；counts 5987/5991；`failedUnexpected=[]` | `21-matrix-all.log`、`22-matrix-facts.json`、`23-gates-cell-summary.txt`、`24-root-test-cell.json`、`25-audit-result-lines.txt`、`26-cross-checks.txt` |
| 8 | N-8e（矩阵后未暂存 tracked 漂移，不 add） | **exit 1** + drift problem + RESULT 非空；还原后 exit 0 | `32-N-8e*.log` |
| 9 | N-8g（同指纹、HEAD 移动） | **exit 1**，仅 head 红（1 problem） | `33-N-8g.log` |
| 10 | N-8c（跨树） | **exit 1**，head + drift 两红 | `34-N-8c.log` |
| 11 | N-10a/N-10b（缺目录/空目录） | 均 **exit 1**、RESULT 非空（1 / 49 problems） | `35-N-10a*.log`、`36-N-10b*.log` |
| 12 | N-8f（运行中未暂存漂移 → 跑完矩阵） | **MATRIX FAIL exit 1**；内置审计 drift problem 在场；gates cell 并列指名 `INSTALL.md` | `50-N-8f-matrix.log` |
| 13 | N-6/N-6b(a)(b)/N-7/N-7b/N-8a/N-8b/N-8d | 逐项 **exit 1** 且红点如 §23.3；全量还原后 exit 0 | `40…48-*.log` |
| 14 | N-9（合成新红 + 固定 pnpm → `--suite root-test`） | cell **fail exit 1**，`failedUnexpected=["N-9 synthetic new red …"]`，counts 5987/5992 | `60-N-9.log`、`61-N-9-cell.json` |
| 15 | `pnpm pack:local`（固定 pnpm） | **exit 0**，15 tarball，manifest 零 diff | `10-T-pack.log`、`10-T-pack-status.txt` |
| 16 | T-1 篡改 1 字节 → `pnpm run publish:verify`（默认模式） | **exit 1**，ERROR 按文件名指名 `nomicore-persistence-0.5.0.tgz` | `11-T1-publish-verify-tampered.log`、`10-T1-tamper-sha.txt` |
| 17 | T-2 删除 1 个 tarball → `pnpm run publish:verify`（默认模式） | **exit 1**，ERROR 按文件名指名 `nomicore-yjs-server-0.6.0.tgz` | `12-T2-publish-verify-deleted.log` |
| 18 | 恢复后 `publish:verify` / `publish:reproducible` | 均 **exit 0**（15/15、15/15）；sha256 前后逐行相同 | `13-T-publish-verify-restored-green.log`、`14-T-publish-reproducible-restored.log`、`10-T-sha256-*.txt` |
| 19 | 一次性 worktree 清理 | `git worktree remove --force` + `prune` exit 0；`git worktree list` 2 项 | 本报告 §25 |
| 20 | 收尾状态 | HEAD 仍 `d5cf485`；`git status` = 2 设施 `M` + 6 wiki 工件；manifest 零 diff；15 tarball | 本报告 §22 / §24 |

**审计 RESULT 行逐日志计数（每次恰 1 行）**：`31/32/33/34/35/36/37/40/41/42/43/44/45/46/47/48/50` 各 `RESULT=1`，`exit=0` 仅成功路径（31、32-restored、37、48），其余 `exit=1`；F-L/F-M/gates 日志无 RESULT 行（非审计）。

## 27. File scope check（每个实际 changed path vs 设计 §14 ALLOW / dispatch 2 文件约束）

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/persistence/test/fixtures/cordis-baselines/gates.mjs` | §14 ALLOW 第 1 行（C4 = 两设施文件之一） | W-2 `isTicketDoc` 收窄 + W-4 头注 |
| `packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs` | §14 ALLOW 第 2 行（C4 = 两设施文件之一） | W-1 指纹/marker/matrix + W-3 RESULT + W-4 mkdirp/注释 |
| `wiki/raw/task_issue-472_sa3_impl.md` | §14 ALLOW `wiki/raw/task_issue-472*.md`（C6 入库面） | 本报告（SA3 唯一文档产出） |

**DENY 面核对**：`git diff --no-renames --name-status 6be891a`（工作树）恰 20 项 = C1 4 设施文件 + C2 8 release 文件 + C3a 8 `wiki/raw/task_issue-472*.md`，**本轮新增改动只落在上述 2 个设施文件**（它们在 C1 集合内，diff 形状由 13/13 的 G12/G13.g 复核）；无 `packages/**/src/**`、`apps/**/src/**`、`domains/**`、`docs/**`、`scripts/**`、`.github/**`、lockfile、根/其余 manifest、门禁冻结件（`acquire.mjs`/`root-probe.mjs`/`provenance-b3.json`/`baselines.json`/`root-test-known-red.json`）改动；根 `package.json`/依赖范围/归属零改动；未执行 `npm publish`、未执行任何 commit/push。

## 28. 外部发现（不属本轮 2 文件范围；**移交控制器/SA8 处置**）

- **G6 空白错误（阻断 C6 后 gates 全绿）**：当前工作树的 `git diff --check 6be891a` **exit 2**，唯一 offender = `wiki/raw/task_issue-472_design_conflict_report.md:465: new blank line at EOF.`（文件尾字节 = `…。\n\n`，即 SA8 rev3 编辑在最后一行后多留了一个空行；`git diff --check 6be891a d5cf485` green，说明 C3a 已提交版本无此问题）。**影响**：C6 若按当前内容提交 `wiki/raw/task_issue-472*`，则 `gates.mjs` 的 **G6 将红**（`git diff --check BASE`），C4 候选树上的 13/13 不再保持。**建议修法**（一行、不改语义）：把该文件尾部规范为单个 `\n`（删除多余的尾随空行）后再入 C6。SA3 按 dispatch「只允许两个文件」未改该 wiki 文件。
- **round 1 证据与本轮审计不兼容（预期、fail-closed）**：主 worktree 的 `.cache/cordis-baselines/evidence/run-marker.json` 仍是旧字段 `{startedAt, head, tree, porcelain}`（head=e3d5881，round 1 SA7 轮产物），当前指纹 = `d645acc34fd7a952d66736f63e52788f0897a3bd` ≠ 旧 marker 绑定。新代码对该目录跑 standalone 审计会因「`worktree` 字段缺失 + 内容漂移 + head 不同」判红——这是**正确行为**：round 1 旧树绿不得沿用；终验必须在 R′（C4）上重跑完整矩阵产生新证据（设计 §11.1）。本轮未改动主 worktree 的该证据目录。

## 29. Deferred verification（移交控制器 / 终验轮；SA3 不承担）

1. **C4 提交**（控制器）：按 §22 的**精确 2 文件清单**暂存并 `chore(release)` 之外的设施提交（`test(fixtures): #472 终审 remediation——working-tree 指纹 + wiki/raw 收窄 + 审计可机判落盘`），随后核对 `git rev-parse HEAD` 与 `HEAD^{tree}`：tree 应为 `91c1c49a38746a9314955d632989939aad418379`（前提：两文件 blob 与 §22 一致）。
2. **§11.1 复验协议在 R′ 上全量重跑**（终验轮）：`acquire --all` → 固定 pnpm 完整 `--all --matrix`（41/41、`marker.worktree === runWorktree === R′ tree`、RESULT `problems=[]`、`pnpmProbe.exitCode=0`、counts 按实际值原样记录、`failedUnexpected=[]`）→ fault ×4 + N-5/N-6/N-6b/N-7/N-7b/N-8a–d/N-8e/f/g/N-10 + F-A…F-M → `pack:local`/`publish:verify`（默认模式）/`publish:reproducible` + T-1/T-2 → lockfile/`generate --check` → 形状复核。**不得沿用本轮 41/41 或 round 1 旧树绿作 AC 证据**（本轮为开发自证）。
3. **C5（message-only 记录更正）**：条件 11 (a)–(e)（口径两分 + R′ HEAD/tree + 再绑定声明 + `C5^{tree} === R′ tree`）；C2 正文 ⑦ 的混同归因与 SA7「非判据偏离」分类在 C5 明示更正。
4. **C6 前修复 §28 的 wiki 尾随空行**，否则 G6 红；C6 后 gates 全量重跑须保持 13/13 + G13 `state=exact`。
5. **AC6 回填（B-4）**：控制器/发布侧按 §9.4/§14.7 执行并落盘三组 `gh api`/`gh pr view` 快照；#468 open/Parent=PR #469、#464–#466 保持撤回；回填完成前 #472 不关闭。

## 30. Suggested commit message（C4；Controller 执行；SA3 未 commit）

提交文件（**精确清单，恰 2 个**）：

```
packages/persistence/test/fixtures/cordis-baselines/gates.mjs
packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs
```

```
test(fixtures): #472 终审 remediation——working-tree 指纹 + wiki/raw 收窄 + 审计可机判落盘

- run-baseline.mjs（W-1/PV-9）: 新增 trackedWorktreeFingerprint()
  （临时 GIT_INDEX_FILE: read-tree HEAD → add -u → write-tree；不碰真实
  index/HEAD/ref）；run-marker 字段 = {startedAt, head, worktree, porcelain}
  （tree 字段移除）；matrix.json = runHead/runWorktree；built-in 与 standalone
  审计均比对指纹（红点文案 = tracked working-tree content drifted during the
  run: marker.worktree=<X> current=<Y>）；standalone HEAD 比对保留且独立
- run-baseline.mjs（W-3）: printAudit 成功/失败两路径先输出恰一行
  [run-baseline] EVIDENCE AUDIT RESULT (<context>): exit=<0|1> problems=<JSON>
  （成功 problems=[]；零新增落盘 artifact）
- run-baseline.mjs（W-4）: 删除 main() 头部 mkdirp(EVIDENCE)（standalone
  缺目录 guard 复活）；gates cell 注释改为完备性口径（行数不钉常数，现盘 21 行）
- gates.mjs（W-2）: isTicketDoc() 收窄为 dirname === 'wiki/raw' ∧ basename
  正则（untracked ⊆ wiki/** 分量不动）；L5/L7 头注对齐 release 语义
- 实证（一次性 worktree tree 91c1c49a…）：gates 13/13 + G13 state=exact +
  G6 干净；固定 pnpm 10.28.2 完整矩阵 41/41、审计 RESULT problems=[]、
  pnpmProbe 0/10.28.2、counts 5987/5991、failedUnexpected=[]；
  F-L/F-M、N-8e/f/g、N-10、T-1/T-2 应红实红，N-6/6b/7/7b/8a–d/9 回归仍红
  （日志 .cache/issue-472-impl/c4/）
```

- 建议 C4 提交正文附：tree `91c1c49a38746a9314955d632989939aad418379`、父 `d5cf485`，以及「AC1–AC4 证据在 R′ 上重跑后方可作为 AC 证据」声明（C5 会引用该 R′ 身份）。
