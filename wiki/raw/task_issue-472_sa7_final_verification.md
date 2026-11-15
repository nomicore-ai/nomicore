# SA7 Final Verification（动态验证）— issue #472：Cordis rc.12 三基线回归与 Nomicore `0.5.0` 收官

- 任务对象：`nomicore-ai/nomicore#472`，round 1，final-verification iteration 0。
- **验证对象（R）**：worktree `/home/wangjian/nomicore-fix-issue-472`，分支 `mabf/issue-472`，HEAD = `e3d58812170a23686103db126f989cdef77b2101`（"chore(release): Nomicore 0.5.0 —— Cordis rc.12 双形态 Root 三基线收官批次"），父提交 `1198312`（C1 设施）。BASE = `6be891a3a0cb32fe21c3a6bf485f33428052ce7b`。
- 工具链：node `v24.13.0`；pnpm `10.28.2`（`node /home/wangjian/.cache/node/corepack/v1/pnpm/10.28.2/bin/pnpm.cjs`，经 `.cache/issue-472-final/bin/pnpm` shim 置 PATH 首位）；npm `11.9.0`。
- 运行时树绑定：矩阵 run-marker `head=e3d58812170a…`、`tree=bdbdd7a41f743048b9b4ac01f2f252971df79ae8`（= 终验会话 `git write-tree`，单树绑定成立）；全程 `git status --porcelain` 仅 `?? wiki/raw/task_issue-472*.md`（⊆ wiki/** 允许集）。
- 证据目录：`.cache/issue-472-final/`（本报告逐项引用）；矩阵/门禁证据在规范目录 `.cache/cordis-baselines/evidence/`。
- **verdict：approve**（判据逐项见 §3 D1–D15 矩阵与 §5 条件核对；无「应红实绿」、无 fail-open、无停手条件触发）。

## 1. Inputs consumed

| 输入 | 用途 |
|---|---|
| `wiki/raw/task_issue-472_design.md` §11（复验 8 步）/§4.2（交付条件 9/10）/§7.3–§7.4（G13/审计）/§10（F/N 注入表）/§12（停手条件） | 本轮执行的唯一计划与判据来源 |
| `wiki/raw/task_issue-472_sa6_acceptance_contract.md` §17（D1–D15）/§12（AC 判据）/§6.2（负控契约） | 动态断言清单与 fault 外层 exit 0 ⇔ 内层 observed=fail 契约 |
| `wiki/raw/task_issue-472_design_conflict_report.md` §8（PV-1…PV-8b）/§13（rev2：G13.g 原语、F-K、条件 9/10 判据） | 钉值核对（PV-3/PV-4/PV-5/PV-8b、`--no-renames` 原语） |
| `wiki/raw/task_issue-472_sa3_impl.md`（C1+C2 实现记录） | 仅供对照预期值（gates summary 行数、manifest sha256、root-test counts 口径）；**全部 AC 证据以本轮在 R 上的独立重跑为准，未复用实现轮任何运行结果** |

条件 10 依赖禁令遵守声明：本报告未把「`baselines.json` 依据 G12 零 diff」「公共 API 冻结依据 G2/G4/G7」「F-A…F-E 一一证伪」三处已勘误表述作为核对依据；实际核对口径 = G13.f + acquire N-5（附 log）、G13.g（`--no-renames` 原语）+ G2/G4 + 步骤 8 同款 diff、§10 表 F-A…F-K + N-5…N-9（含 b 变体）逐项应红实红。

## 2. §11 步骤 1–8 实测结果

### 步骤 1 — `acquire.mjs --all`（log `.cache/issue-472-final/01-acquire-all.log`，exit 0）

三基线工件按 `baselines.json` 钉值重取：B1（cordis 4.0.1 / timer 1.1.3 / cosmokit 1.8.2）、B2（4.1.0 / 1.2.0 / 1.9.0）、B3（4.1.0 / 1.2.0 / 1.9.0 + dsh `1511a6e` "chore(cordis): upgrade core to 4.0.0-rc.12"）。**B3 `provenanceDigest = 9d6633550e82c2960ec58e31a8626af7482d53ad323a612c0dce2f3e0a44221c`**，与 SA6 §4.2 钉值逐字一致。`baselines.json` 本身零 diff（步骤 7 复核 + G13.f）。

### 步骤 2 — `run-baseline.mjs --all --matrix`（log `.cache/issue-472-final/02-matrix-all.log`，exit 0）

- **41 cells 全 pass**（B1/B2/B3 各 typecheck(15 projects)+12 suites=39 + gates + root-test）；`MATRIX PASS: 41 cells`。
- **内置证据审计 `EVIDENCE AUDIT PASS (built-in matrix audit): 41 cells, identity digests, freshness, logPath containment, directory discipline`，exit 0 且 `problems=[]`**（条件 9 前半，干净矩阵零假红）。
- **gates cell：`[gates] PASS`×13 + `[gates] all 13 gates passed`** 汇总行 + 7 行 G10 明细 = summary 21 行，**无 `slice(-N)` 截断**（G1′…G13 逐 gate 可从 `gates/gates.json` 核对）；**`G13 … state=exact`**（版本表 persistence 0.4.0→0.5.0 … yjs-server 0.5.0→0.6.0 七项全列）。
- `matrix.json`：`cells=41`、`statuses=['pass']`、**`runHead=e3d58812170a23686103db126f989cdef77b2101`（= R）**、`runTree=bdbdd7a41f…`（= write-tree，T-4 树漂移检查绿）。
- **root-test（D14）**：`status=pass`、`exitCode=1`（台账红）、counts **`5959/5991`，failed=32 = 4 knownRed + 28 environmentRed**，**`failedUnexpected=[]`**（名集判定：失败名集合 ⊆ 冻结台账；28 个环境红系本会话 PATH 上的 corepack pnpm 11.28.5 shim 拒绝 workspace 所致，与台账 environmentRed 项吻合；counts 按实际值原样记录，不据此扩账/宣称全绿）。
- D1–D9 载荷抽查（`02-d1-d9-cell-facts.txt`）：三基线 provenance 全 realpath 一致（4/4、4/4、8/8）；root-probe B1/B2 `expectedChannel=legacy`、B3 `expectedChannel=symbol`（12/12×3）；ws-cordis-channel 33/33×3（legacy/legacy/symbol）；real-timer 11/11×3、unload 10/10×3；replication-lifecycle 34/34×3（23/23 lifecycle units observed）；ws-cordis-timers 12/12×3；guard-proxy 71/71×3；dsh-profile 12/12×3、composition-root 28/28×3；contract 246/246（B1/B2）、250/250（B3）；ws-package 66/66×3；typecheck 15 projects×3。

### 步骤 3 — fault 负控 ×4（D12；log `03-fault-B3-fallback.log` 等 4 件 + `03-fault-summary.txt`）

| fault @ baseline | 外层 exit | 内层 observed | 内层 cells |
|---|---|---|---|
| `fallback` @ B3 | **0** | **fail** | provenance fail / root-probe fail |
| `substitute-npm` @ B3 | **0** | **fail** | provenance fail / root-probe fail |
| `legacy-shim` @ B3 | **0** | **fail** | provenance pass / root-probe fail |
| `substitute-rc12` @ B2 | **0** | **fail** | provenance fail / root-probe fail |

外层 exit 0 ⇔ 内层 observed=fail 契约 4/4 成立（fault 证据落 `evidence/<B>/fault-*.json`，属审计允许类⑤，事后 standalone 审计复核不红）。

### 步骤 4 — 证据负控（D13；log `04-n-series-summary.txt` + `audit-*.log`）

在规范目录 `.cache/cordis-baselines/evidence/` 上「全量备份 → 污染 → 审计（应 exit 1）→ 从备份还原 → 审计（应 exit 0）」逐项执行：

| # | 注入 | 审计结果（应红实红） | 红点原因（log 原文摘要） |
|---|---|---|---|
| N-6 | 删 `B1/provenance.json` | **exit 1** → 还原 exit 0 | `missing required evidence: …/B1/provenance.json` |
| N-6b(a) | cell `logPath` → 不存在路径 | **exit 1** → 还原 exit 0 | `logPath: file does not exist` |
| N-6b(b) | cell `logPath` → `../../escape.log` | **exit 1** → 还原 exit 0 | `logPath: path escapes evidence/` |
| N-7 | 截断 `B3/provenance.json` | **exit 1** → 还原 exit 0 | `unparsable evidence (Unterminated string…)` |
| N-7b | `B1/zz-old.json` 换名旧工件混入 | **exit 1** → 还原 exit 0 | `file outside the six allowed classes` |
| N-8a | `B2/contract.json` mtime 回拨 2020-01-01 | **exit 1** → 还原 exit 0 | `stale evidence (mtime predates the run marker)` |
| N-8b | B2 cell digest 换 B3 值 | **exit 1** → 还原 exit 0 | `provenanceDigest="112f0db0…" expected 88f718ba…` |
| N-8c | 跨树（sandbox HEAD ≠ marker.head） | **exit 1**（步骤 8 sandbox 实测） | `evidence belongs to another tree: marker.head=e3d5881… current HEAD=ae456e1…` + `tracked tree drifted during the run: marker.tree=bdbdd7a… current write-tree=0cbc5e6…`（恰 2 problem，head+tree 双红） |
| N-8d | 换入上一轮 `matrix.json` | **exit 1** → 还原 exit 0 | `generatedAt … predates the run marker` 等 3 problem |
| N-9 | 台账外合成新红 | root-test cell **fail**（步骤 8 sandbox 实测） | cell `status=fail`、`exitCode=1`、counts `5959/5992`（failed 33 = 台账 32 + 1 合成）、**`failedUnexpected=["N-9 synthetic new red"]`**（cell JSON 留档 `falsify-N-9-root-test.json`；runner 判定式 `status = evidenceOk && failedUnexpected.length===0 ? pass : fail`，新红不得扩账解释） |

收尾对照：`control-clean` / `control-final` 均 exit 0；**还原后规范目录与污染前备份逐字节相同（`diff -r` NO RESIDUE）**。

### 步骤 5 — 发布门禁（D10/D11；log `05-release-gates-summary.txt`、`05-pack.log`、`05-publish-verify.log`、`05-publish-reproducible.log`、`05-sha256.txt`、`05-e2e-chain.log`）

固定 pnpm 10.28.2（PATH 首位置 shim；首次尝试未置 PATH 被 corepack 11.28.5 shim 拒绝，属环境事实非产品红，见 §偏差 1）：

- `pnpm run pack:local` → **exit 0**，15 tarball；
- `pnpm run publish:verify`（**默认模式**，`NOMICORE_VERIFY_REGISTRY_INTEGRITY` 环境出现次数 = 0）→ **exit 0**，`verified 15 publishable tarballs`；7 个未发布新版本各走 `npm publish --dry-run --json`（log 内 7 组 dry-run notice，id 匹配由脚本断言）；8 个已发布版本 registry integrity sha512 相等（`05-registry-published-8.txt` 复核 8 版本在 registry 在册）；
- `pnpm run publish:reproducible` → **exit 0**，`reproducible tarballs verified for 15 packages`（双次独立构建 sha256 逐包一致）；
- manifest sha256 = `d94102d2440a03768979d2c7a27b44c50f3a97a12493bc6000e0c760ae348737`（与 C2 实现轮确定性再生的钉值一致 → 跨轮确定性成立）；pack 后 `git status` 干净（manifest 逐字节再生）。
- **端到端链（`05-e2e-chain.log`，65 项 ok / 0 FAIL，E2E CHAIN PASS）**：
  - **版本 → packed 依赖**：7 个新版本 tarball 解包后 `version` 全对（0.5.0×4、0.4.0、0.6.0×2）；`@nomicore/dsh-persistence@0.5.0` 的 `dependencies["@nomicore/persistence"] === "0.5.0"` ✓，闭包内 8 条 packed workspace 依赖重写（namespace-runtime/registry/api/ws-replication/yjs-server 等）全部 === 目标精确版本、无 `workspace:`/`file:` 残留；
  - **manifest filename**：15/15 `filename === <name>-<version>.tgz`；
  - **exports/bin 目标存在**：15/15 tarball 全部 exports 目标（跳过 `./src/` 开发态目标）与 bin 目标在包内存在（bin 另带 shebang 由 verify 脚本断言）；
  - **packed dist 可加载（不用 nomicore-source）**：15/15 在清除 `NODE_OPTIONS` 后从 tarball 解包目录 import 成功（keys=0…28；每个解包包内建其声明依赖的 symlink farm 以镜像真实安装，仅默认条件解析）；
  - **registry**：7 个新版本 `npm view` 全部 404（未发布，符合本票不执行 npm publish）；8 个旧版本在册（integrity 相等由 verify 默认模式承载）。

### 步骤 6 — lockfile 与 codegen（D15；log `06-lockfile-generate.log`）

- `pnpm install --frozen-lockfile --lockfile-only` → **exit 0**（`Scope: all 17 workspace projects`，251 ms）∧ `git diff --exit-code -- pnpm-lock.yaml` → **exit 0 零 diff**（sha256 `3127b6bb…`）；
- `pnpm generate --check` → **exit 0**；`domains/vfs3-assets/generated.ts` sha256 `1c079a16e08d2c1b56bc0cca184fb67dc6ab3b643e6842075ab76a819f05c31e` 与提交态一致（字节不变）；`git diff --exit-code -- domains/ pnpm-lock.yaml` exit 0。

### 步骤 7 — 形状审计（log `07-shape-audit.log`）

- **`git diff --no-renames --name-only 6be891a`（与 G13.g 同原语）= 恰 12 文件**：8 个 release 文件（7 个 `package.json` + `artifacts/local-packages/manifest.json`）+ 4 个 C1 设施文件（`gates.mjs`、`run-baseline.mjs`、`public-surface.base.json`、`cordis-public-surface.test.ts`），name-status 全 `M`，无第三类路径；
- 生产面零 diff：`packages/**/src/**` 0、`apps/**/src/**` 0、`domains/**` 0、`docs/adr/**` 0、`docs/protocols/**` 0、`scripts/**` 0、`.github/**` 0、`artifacts/**` 除 manifest 0；
- 逐字节不变：`pnpm-lock.yaml`、`scripts/package-catalog.mjs`、`root-test-known-red.json`、`baselines.json`（G13.f 手工复核面）+ `acquire.mjs`/`root-probe.mjs`/`provenance-b3.json`；
- numstat：7 个 pinned `package.json` 各 **1/1**，manifest **7/7**（PV-3/PV-4 逐字）；
- untracked ⊆ `wiki/raw/task_issue-472*.md`。

### 步骤 8 — 门禁 falsification（R 的一次性副本；log `08-f-series-summary.txt` + `falsify-*.log` + `08-n5-n8c-n9-summary.txt`）

一次性副本 = `.worktrees/issue-472-final-falsify`（detached git worktree @ `e3d5881` = R 本体，含 15 个 R 版本 tarball 经固定 pnpm 原位 pack；`node_modules` 以真实目录+逐条符号链接提供，`git status` 零噪声）。每项注入 → gates（log 含 HEAD/porcelain/`--no-renames` 全树 diff 上下文）→ `git reset --hard` 还原；收尾对照 + 清理。

| # | 注入 | gates 实测（红点唯一性） | 关键 detail（log 原文） |
|---|---|---|---|
| F-A | 第 8 包 bump（clock 0.2.0→0.2.1） | **exit 1：G1′+G13 双红**（设计预期两者） | exact：`packages/clock/package.json: not byte-identical to BASE (PV-3)`；manifest 交叉检查 `nomicore-clock-0.2.0.tgz expected nomicore-clock-0.2.1.tgz` |
| F-B | pinned 文件改依赖 range | **exit 1：唯 G13**（G1′ 绿） | `manifest differs from BASE beyond the "version" line — PV-3 deep equality failed`；`text diff … got 2 deletion(s) + 2 addition(s)` |
| F-C | manifest 留 1 个旧 filename（已提交） | **exit 1：唯 G13**（G6 绿） | `stale filename lingers: nomicore-persistence-0.4.0.tgz`；numstat `6+6` 非 7+7；∧ `publish:verify exit=1`（恰 1 条 `manifest filename does not match package version`） |
| F-D | bump 后未再生 manifest（未提交） | **exit 1：G6+G13** | G6 `artifacts/ is dirty`；G13 exact 7 项交叉红；∧ `publish:verify exit=1`（7 条 filename mismatch） |
| F-E | 台账加新红名 | **exit 1：唯 G13** | `root-test-known-red.json: not byte-identical to BASE (G13 byte-freeze)` |
| F-F | 仅 bump 7 之 3 + 再生 manifest（已提交） | **exit 1：唯 G13**（**G1′ 绿**——白名单内部分 bump 的唯一红点） | absent 分支 3 文件 version ≠ BASE；exact 分支 4 个 pinned `version="0.4.0" expected 0.5.0` |
| F-G | exact 后单文件回退 persistence 0.4.0 | **exit 1：唯 G13**（absent 分支首次红灯实证：6/7 文件异于 BASE） | exact：`version="0.4.0" expected 0.5.0` + manifest 交叉检查红 |
| F-H | `packages/clock/src/system.ts` 加注释 | **exit 1：唯 G13.g**（G1′/G2/G4 全绿） | exact（1 problem）：`tracked change outside the release allowlist: packages/clock/src/system.ts` |
| F-I | `scripts/create-publish-manifest.mjs` + `.github/workflows/ci.yml` 各加注释 | **exit 1：唯 G13.g** | exact 指名两文件（scripts/ 与 .github/ 面与 src 同判） |
| F-J | `baselines.json` 单字节改动（integrity 尾位） | **exit 1：唯 G13.f**；**G12 PASS**（名义 5 文件闭集不救） | `baselines.json: not byte-identical to BASE`；G12 detail 明示「batch freeze is enforced by G13.f + acquire N-5, not by this gate」 |
| F-K | `git mv .github/workflows/ci.yml wiki/raw/task_issue-472_renamed.md` | **exit 1：唯 G13.g**（G1′/G2/G4/G12 全绿） | exact（1 problem）：**`tracked change outside the release allowlist: .github/workflows/ci.yml`**——`--no-renames` 下改名=旧路径删除+新路径新增，旧路径被指名，新路径命中 wiki glob 不救 |
| 对照 | 干净 sandbox 树（还原后） | **13/13 PASS，exit 0**（exact 态不回归） | `falsify-F-control-exact.log`；porcelain 0 行（无残留） |

| #（工件/审计负控，sandbox） | 注入 | 实测 |
|---|---|---|
| N-5 | `baselines.json` B1 integrity 尾位改错 → `acquire.mjs --baseline B1` | **exit 2**（`sha512 mismatch: pinned …0Nw=A, got …0Nw==`）；还原后 **exit 0**（`falsify-N-5-{tamper,restored}.log`） |
| N-8c | 跨树审计（sandbox 提交后 HEAD=`ae456e1` ≠ marker.head `e3d5881`；canonical 证据经只读 symlink，真目录先行移开） | **exit 1**：恰 2 problem——`evidence belongs to another tree`（head）+ `tracked tree drifted during the run`（write-tree）双红（`audit-N-8c.log`；首次尝试因 symlink 落点错误红在「missing run marker」，已重做并留档 `08-n8c-n9-redo-summary.txt`） |
| N-9 | 合成台账外新红（`zz-n9-synthetic-new-red.test.ts`）→ `--suite root-test` | root-test cell **status=fail、exit 1**，counts `5959/5992`（failed 33 = 4 frozen + 28 environment + 1 合成），**`failedUnexpected=["N-9 synthetic new red"]`**（cell JSON 留档 `falsify-N-9-root-test.json`）——新红不得扩账解释 |

副本清理：F/N 全部注入 `git reset --hard` + `clean -fdq` 还原，收尾 `git status --porcelain` 0 行；最终 `git worktree remove --force` + `prune` exit 0，`git worktree list` 恢复「main + 任务 worktree」两项、`.worktrees/` 空（`09-final-state.log`）。主 worktree 终态：HEAD 仍 `e3d58812170a…`，porcelain 仅 `wiki/raw/task_issue-472*.md` untracked，`git diff` 空；canonical 证据目录收尾 standalone 审计 **PASS exit 0**；`git diff` 中 `SA7-DATAFLOW` 出现 0 次（未加入任何临时诊断；`git grep` 命中的同名串均为历史票的既有 tracked 工件）。

## 3. D1–D15 判定矩阵

| # | 动态断言 | 载荷（本轮实测） | 判定 |
|---|---|---|---|
| D1 | 测试位置与生产 leaf 同 realpath、恰一份 cordis | 3 基线 provenance cell 4/4、4/4、8/8 pass（`resolvedRealpaths` 3 键，cordis/cordis-plugin-timer 各一） | **pass** |
| D2 | B1/B2 legacy、B3 symbol；Root 通道可 arm | root-probe 12/12×3（expectedChannel legacy/legacy/symbol）；ws-cordis-channel 33/33×3 | **pass** |
| D3 | symbol 优先、legacy 兜底、malformed loud fail、无 ambient timer、timer.ctx→ctx 两跳 | ws-cordis-channel（三基线 expectedChannel 断言随 cell 记录）33/33×3 | **pass** |
| D4 | 真实 Timer flush/retry/drain/dispose、UNLOADING 窗口写先于 dispose | real-timer 11/11×3 + unload 10/10×3 | **pass** |
| D5 | Registry 启停/revoke、dependent Fiber join、R5P 卸载窗口写 | unload 10/10×3 | **pass** |
| D6 | Hub/Peer/SessionHost ×7 场景 ×3 = 63 单元；23 名 lifecycle 枚举 + coverage + issue420 | replication-lifecycle 34/34×3（23/23 units observed） | **pass** |
| D7 | 12 timer 族 arm→trigger→cancel（真实 baseline TimerService） | ws-cordis-timers 12/12×3 | **pass** |
| D8 | 冻结服务 getter + guard-Proxy 五面 + wire/结构守卫 | guard-proxy 71/71×3 | **pass** |
| D9 | DSH profile dispose 顺序、第三方组合根拆卸序、Timer 最后释放 | dsh-profile 12/12×3 + composition-root 28/28×3 | **pass** |
| D10 | packed manifest 重写、exports/bin、dist 可加载（无 source condition） | 步骤 5：verify 15/15 + e2e 15/15 dist 加载 | **pass** |
| D11 | 版本 → packed 依赖 → manifest filename → registry integrity 端到端 | 步骤 5 e2e chain（65 ok / 0 FAIL） | **pass** |
| D12 | fault 负控内层应红 | 步骤 3：4/4 外层 exit 0 ∧ observed=fail | **pass** |
| D13 | 证据缺失/损坏/过期/跨树/名集漂移/logPath 断链/越类 → 红 | 步骤 2 内置审计 problems=[] + 步骤 4/8 N-6/N-6b/N-7/N-7b/N-8a-d 逐项 exit 1 | **pass** |
| D14 | root-test 失败名集 ⊆ 冻结台账、新红不被吞 | counts 5959/5991（32=4+28）`failedUnexpected=[]`；N-9 注入新红 → cell fail | **pass** |
| D15 | `generate --check` 与 lockfile 稳定 | 步骤 6 双零 diff / exit 0 | **pass** |

## 4. Dynamic Evidence Matrix

| Source | Requirement or risk | Driver | Expected | Actual | Evidence | Result |
|---|---|---|---|---|---|---|
| SA6 §17 / Design §11-2 | 41-cell 矩阵 + gates 13/13 exact + 审计零假红 | `run-baseline.mjs --all --matrix` @R | 41 pass、G13 exact、problems=[] | 如期（§2 步骤 2） | `02-matrix-all.log`、`evidence/matrix/matrix.json`、`evidence/gates/gates.json` | pass |
| SA6 §17 D12 / Design §11-3 | 污染工作区必须内层红 | fault ×4 | 外层 0 ⇔ observed=fail | 4/4 | `03-fault-*.log` | pass |
| SA6 §17 D13 / Design §7.4 | 证据审计 fail-closed | N-6…N-9（含 b 变体） | 逐项 exit 1，还原 exit 0 | 9/9 | `audit-*.log`、`falsify-N-*.log` | pass |
| SA6 §12.3 / Design §11-5 | 打包门禁三连绿 | pack/verify/reproducible | 15/15、默认模式 | 三连 exit 0 | `05-*.log` | pass |
| SA6 §12.4 A4-2 / PV-4 | manifest 收敛 | numstat + sha256 | 7+7、确定性 | 7/7、`d94102d2…` 跨轮一致 | `07-shape-audit.log`、`05-sha256.txt` | pass |
| SA8 PV-8a/PV-8b / SA2-2/SA2-3 | 全树绑定 + baselines.json 钉死执法面 | G13.g/G13.f + 步骤 7 同款 diff + F-H/F-I/F-J/F-K 注入 | 越界/单字节/改名 → 唯一红点 G13 | 见 §2 步骤 8 | `falsify-F-*.log`、`07-shape-audit.log` | pass |
| SA8 条件 9 | 审计相容性 + 全量 summary | 干净树矩阵 | exit 0 ∧ problems=[] ∧ 14 行 gates 输出 | 21 行 summary（13 gate + 汇总 + 7 G10 明细） | `02-matrix-key-fields.txt` | pass |
| SA8 条件 10 | 勘误不依赖 | 本报告核对口径 | G13.f+N-5 / G13.g+G2/G4+步骤 8 / §10 表 | 见 §1 声明与 §2 | 本报告 | pass |

## 5. 交付条件 9 / 10 核对

- **条件 9**：HEAD `e3d5881` 干净树（untracked 仅 wiki 工件）重跑 `--all --matrix` → 内置审计 **exit 0 且 problems=[]**（`02-matrix-all.log` 尾行 `EVIDENCE AUDIT PASS`）；gates cell summary 保留全量 `[gates]` 行（**13 gate 行 + `all 13 gates passed` 汇总行在场**，另含 7 行 G10 明细，共 21 行，无截断）。
- **条件 10**：核对口径落实——`baselines.json` 冻结按 **G13.f（步骤 2 gates PASS 内含）+ N-5（步骤 8 sandbox：acquire exit 2 → 恢复 exit 0，log `falsify-N-5-*.log`）**；公共 API 冻结按 **G13.g（`--no-renames` 原语；步骤 7 同款 diff 12 文件恰合允许集）+ G2（3 src 树零 diff）+ G4（2 entry 文件零 diff）**；负控覆盖按 **§10 表 F-A…F-K + N-5…N-9（含 N-6b/N-7b）逐项应红实红**（§2 步骤 4/8）。三处已勘误表述未被用作依据。

## 6. Deviations（记录性，非判据偏离）

1. **步骤 5 首次尝试环境红（非产品红）**：`pack:local` 首跑 exit 1，根因是 spawn 的 `pnpm` 经 PATH 命中 corepack 11.28.5 shim 拒绝 workspace 钉定的 10.28.2（与本会话 root-test 28 个 environmentRed 同源）；按设计 §11「pnpm 语义固定 10.28.2」把 `.cache/issue-472-final/bin/pnpm` shim 置 PATH 首位后三连绿。首跑日志留档 `05-pack-attempt1-PATHshim.log` 等 3 件；期间 `build-local-packages.mjs` 曾 `rm` 掉 manifest，已立即 `git checkout --` 还原（树回到干净态，后续 pack 确定性再生同 sha256）。
2. **root-test counts 口径**：本轮矩阵在默认 shell（PATH pnpm 11.28.5 shim）下运行，counts `5959/5991`（32 = 4 frozen + 28 environment，与 SA6 轮同形）；实现轮 C2 probe 在固定 pnpm PATH 下为 `5987/5991`（4 frozen）。两种口径下 `failedUnexpected=[]` 均成立（名集判定）；按 D14 要求 counts 原样披露、不扩账、不宣称全绿。
3. **一次性副本与临时 worktree 清理**：`.worktrees/issue-472-final-falsify` 用毕 `git worktree remove --force` + `git worktree prune`（`09-final-state.log`）；`.worktrees/` 复归为空，`git worktree list` 恢复 main + 任务 worktree 两项。
4. **e2e 依赖 farm**：tarball 解包目录自身无依赖，dist 加载 smoke 按真实安装形态为每个解包包内建「声明依赖 → 主安装」symlink farm（仅默认条件解析）；这是 smoke 的最小忠实装载面，不影响任何门禁判定（门禁判定全部来自 `publish:verify`/`publish:reproducible` 原生输出）。
5. **N-8c 首次执行红点错位（已重做）**：首跑把 canonical 证据 symlink 到 sandbox 时目标目录已存在，symlink 落在目录内部，审计红在「missing run marker」（仍 exit 1、无 fail-open，但非预期红点）；随后移开真目录、正确落点重做，得到预期的 head+tree 双红（恰 2 problem）。两次输出均留档（`08-n5-n8c-n9-summary.txt` / `08-n8c-n9-redo-summary.txt`）。

## 7. 数据流 / 状态机核对（Changed vs Preserved）

本票设计声明：**唯一新增运行时数据流 = release 打包链**（版本行 → `pack:local` 重写 packed manifest `workspace:*`→精确版本 → manifest filename → verify/reproducible），**业务数据流零变化**（生产 src/domains/docs 零 diff，§2 步骤 7 机械复核）。

| 面 | 判定 | 依据 |
|---|---|---|
| Changed（打包链） | 按设计变化：7 版本行 → 15 tarball 重写依赖 → manifest 7 键更新（numstat 7/7）→ registry integrity/dry-run → 双次构建 sha256 一致 | 步骤 5 全链 + `05-e2e-chain.log` 65 项 |
| Changed（证据链） | 按设计变化：run-marker（head/tree 校验值）先行、41 cell JSON + 内置七项 fail-closed 审计、`matrix.json` 增 `runHead/runTree` | 步骤 2/4；N-6…N-9 应红实红 |
| Preserved（业务数据流/状态机） | 保持不变：Root 通道（B1/B2 legacy、B3 symbol、33/33×3）、Timer 状态机（arm→trigger→cancel 12/12×3、flush/retry/drain/dispose 11/11×3）、Registry/Hub/Peer/SessionHost lifecycle（23/23 units ×3、UNLOADING 窗口写先于 dispose 10/10×3）、guard-Proxy 五面（71/71×3）、DSH dispose 顺序（12/12×3 + 28/28×3）——全部由三基线矩阵在 R 上独立重跑承载（D1–D9） | 步骤 2 + `02-d1-d9-cell-facts.txt` |
| Preserved（公共契约） | 保持不变：7-entry 公共面快照与 runtime 严格相等（G5 PASS）、G2/G4/G7/G9 零 diff、lockfile/catalog/台账/baselines.json 逐字节 | 步骤 2 gates + 步骤 7 |

错误与清理流：fault ×4 内层红（错误分类正确）；审计负控 9 项 fail-closed（无伪成功）；一次性副本 `reset --hard`+`clean` 后零残留、worktree 移除；未复活任何旧路径。

## 8. Temporary diagnostics

未在产品/设施代码中加入任何 `[SA7-DATAFLOW]` 或其他临时日志；全部观察经现有设施输出（gates/run-baseline/acquire/verify-* 脚本与 cell JSON）取得。`git diff` 无临时诊断残留（工作树唯一新增 = 本报告文件）。

## 9. Verdict

**approve**。D1–D15 全部以 R 上的独立重跑证据成立；交付条件 9/10 满足；负控 F-A…F-K 与 N-5…N-9（含 b 变体）应红实红、无 fail-open；发布门禁三连绿且端到端链 65/65；生产面/冻结件零 diff；一次性副本与临时 worktree 已清理（见 §偏差）。未触发设计 §12 任何停手条件；未执行真实 `npm publish`；未修改任何生产源码/测试/facility/manifest/docs/scripts（本轮唯一树内新增 = 本报告文件，属 `wiki/raw/task_issue-472*.md` 允许集）。
