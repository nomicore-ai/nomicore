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

---

# iteration 1（R′）— 终审 remediation 后的全量复验（rev3 §11.1 权威协议；旧 R 的绿全部作废，仅作历史记录）

**验证对象（R′）**：HEAD `a7fb8ffe562febb0bdcf8cad632723a3cf90559e`（C4 终审 remediation），`HEAD^{tree}` = `91c1c49a38746a9314955d632989939aad418379`；分支 `mabf/issue-472`；BASE `6be891a3a0cb32fe21c3a6bf485f33428052ce7b`。本节全部 log 落 `.cache/issue-472-final/iter1/`（下称 `$I`），矩阵/门禁证据落规范目录 `.cache/cordis-baselines/evidence/`。round 1（旧 R `e3d5881`）的 41/41 与本节不可互相抵销（SA6 §12.0.1 单树绑定）。

**会话纪律（W-6）**：`$I` 全部命令在 pnpm shim（`.cache/issue-472-final/bin/pnpm`，exec corepack 10.28.2 二进制）置 PATH 首位的同一口径下执行；落盘 `pnpm --version` = **10.28.2**（`00-pnpm-version.txt`、`05-pnpm-version.txt`）；root-test cell `pnpmProbe` = `{"exitCode": 0, "stdout": "10.28.2", "stderr": ""}`；全程 `NOMICORE_VERIFY_REGISTRY_INTEGRITY` 在 env 中出现 **0** 次（禁 override）。

**工作树纪律（W-1 期望值语义）**：复验开始时工作树含 4 个已修改 tracked 证据文件（`wiki/raw/task_issue-472_{design,design_conflict_report,dispatch,sa3_impl}.md`）。为使被测内容恰为 R′ 内容树（§7.4：干净树 `worktree === 提交 tree OID`，不得以 BASE/旧值冒充），先 `cp -a` 备份至 `$I/wiki-mods-backup/`（sha256 留档 `wiki-mods-backup.sha256`）再 `git checkout --` 还原至 HEAD；全部动态步骤结束后按备份逐字节恢复（`wiki-mods-restored.sha256` 四条全等）并落盘 porcelain（`09-final-state.log`）。全程未 `git add`/`commit`/`push`。

## §11.1 步骤 1 — acquire 三基线（log `01-acquire-all.log`，exit 0）

`node …/acquire.mjs --all` → exit 0；B1/B2/B3 按 `baselines.json` 钉值重取（B1 cordis 4.0.1 / B2 npm 4.1.0 + timer 1.2.0 + cosmokit 1.9.0 / B3 DSH rc.12 同版本表）；**B3 `provenanceDigest` = `9d6633550e82c2960ec58e31a8626af7482d53ad323a612c0dce2f3e0a44221c`，与钉值逐字相等**。

## §11.1 步骤 2 — 固定 pnpm 完整矩阵（log `02-matrix-all.log`，`02-matrix-all.exit` = exit 0；关键数字 `02-matrix-key-fields.txt`）

`node …/run-baseline.mjs --all --matrix`（独占运行）：

- **41 cells 全 pass**（`MATRIX PASS: 41 cells`；B1/B2/B3 各 13 + gates + root-test）。
- **run-marker（W-1）**：`{startedAt, head, worktree, porcelain}`——`tree` 字段不存在；`head=a7fb8ffe562febb0bdcf8cad632723a3cf90559e`；**`worktree=91c1c49a38746a9314955d632989939aad418379`**（= R′ tree OID，干净树）；porcelain 仅 2 个 untracked wiki 文件。
- **matrix.json 交叉核对**：`runHead === marker.head === R′ HEAD`；**`runWorktree === marker.worktree === R′ tree OID（91c1c49a…）`**（旧 `runTree` 字段不存在）。
- **内置审计（W-3）**：`02-matrix-all.log` 恰 **1 行** `[run-baseline] EVIDENCE AUDIT RESULT (built-in matrix audit): exit=0 problems=[]`。
- **gates cell 13/13**：`G13 … state=exact`（7 包版本表 0.4.0→0.5.0 ×4 / 0.3.0→0.4.0 / 0.5.0→0.6.0 ×2；manifest 7/7 filenames；ledger/catalog/baselines.json byte-identical；变更集 ⊆ 8 release + 4 facility + `wiki/raw/task_issue-472*.md`）。`gates.log` 保留全量 **21 行** `[gates]`（13 逐 gate 判定 + 7 行 G10 明细 + 1 汇总行 `all 13 gates passed`）——完备性口径、不假设行数常数。
- **root-test（D14）**：cell pass；counts（固定 pnpm 下实际值，原样记录）**`passed=5987, failed=4, total=5991`**；4 个失败名 = 台账 knownRed 的 4 个 frozen test-d 名（ws-replication-issue421 EF-C1/EF-C2×3）；**`failedUnexpected=[]`**；28 个 environmentRed 在固定 PATH 下全部转绿（与台账 attribution「对齐环境预期转绿」一致）；ledger 字段 `{knownRed:4, environmentRed:28}` 零扩账。
- **pnpmProbe（W-6 判定②）**：`diagnostics.pnpmProbe` = `{exitCode:0, stdout:"10.28.2", stderr:""}`。
- **D1–D9 逐基线 counts**（`02-matrix-key-fields.txt`）：provenance 4/4（B3 8/8）、root-probe 12/12、contract 246/246（B3 250/250）、real-timer 11/11、dsh-profile 12/12、unload 10/10、ws-package 66/66、guard-proxy 71/71、ws-cordis-channel 33/33、ws-cordis-timers 12/12、replication-lifecycle 34/34、composition-root 28/28——三基线同形（B1/B2 legacy、B3 symbol 双形态各自全绿）。

## §11.1 步骤 3 — fault 负控 ×4（log `03-fault-B3-{fallback,substitute-npm,legacy-shim}.log`、`03-fault-B2-substitute-rc12.log`；汇总 `03-fault-summary.txt`）

`--baseline B3 --fault fallback|substitute-npm|legacy-shim`、`--baseline B2 --fault substitute-rc12`，各 `--suite provenance --suite root-probe`：**四项全部 outer exit=0 ∧ `expected=fail observed=fail`**（D12；外层 exit 0 当且仅当内层 observed=fail）。

## §11.1 步骤 3′（§10 表 N-6…N-10）— 证据 fail-closed 负控（汇总 `04-n-series-summary.txt`、`08-n5-n8c-n8g-n10-n9-summary.txt`、`04-n8f-summary.txt`）

规范目录上「备份（`$I/nbackup/`）→ 污染 → standalone 审计红 → 还原 → 审计绿」逐项留 log（`audit-*.log`）；每条审计恰 1 行 RESULT、问题数组即判红依据：

| # | 注入 | exit | RESULT problems | 红点 |
|---|---|---|---|---|
| N-6 | 删 `B1/provenance.json` | 1 | 1 | `missing required evidence: …B1/provenance.json` |
| N-6b(a) | logPath→不存在路径 | 1 | 1 | `logPath: file does not exist` |
| N-6b(b) | logPath→`../../escape.log` | 1 | 1 | `logPath: path escapes evidence/` |
| N-7 | 截断 `B3/provenance.json` | 1 | 1 | `unparsable evidence` |
| N-7b | `B1/zz-old.json` 换名旧工件 | 1 | 1 | `file outside the six allowed classes` |
| N-8a | cell mtime 回拨 2020 | 1 | 1 | `stale evidence (mtime predates the run marker)` |
| N-8b | B2 digest→B3 值 | 1 | 1 | `provenanceDigest="112f0db0…" expected 88f718ba…` |
| N-8c（副本） | 异树审计（提交新文件） | 1 | 2 | `another tree` + `drifted`（两绑定并列如实红） |
| N-8d | 换入 round-1 matrix.json | 1 | 3 | `generatedAt` 早于 marker + `runHead≠marker.head` + `runWorktree=undefined≠marker.worktree` |
| **N-8e** | 矩阵后 INSTALL.md 未暂存追加（不 add） | 1 | 1 | **`tracked working-tree content drifted during the run: marker.worktree=91c1c49a… current=ba4f23d2…`**（index 未变、被测内容漂移有机械红点）；还原后绿 |
| **N-8f**（副本） | **运行中**漂移：首个证据文件（`B1/typecheck.json`，11:23:31）出现后注入，矩阵跑完 | 1 | 3 | **drift problem 在场**（首位）+ `default/gates: status="fail"`（G13.g 并列指名，设计允许的如实披露）+ matrix cell 红 ⇒ `MATRIX FAIL`；root-test 仍 5987/5991（注入文件不被行为面消费） |
| **N-8g**（副本） | 同指纹、HEAD 移动（`--allow-empty` 提交） | 1 | **1** | **仅** `another tree: marker.head=a7fb8ff… current HEAD=77a7c92a…`；drift 提及 0 次——指纹与 HEAD 两绑定相互独立 |
| N-9（副本） | 合成台账外新红 | 1（cell fail） | — | cell `status=fail`、counts 5987/5992、**`failedUnexpected=['N-9 synthetic new red']`**（cell JSON 留档 `falsify-N-9-root-test.json`） |
| **N-10(a)**（副本） | `evidence/` 目录缺失 | 1 | 1 | `missing evidence directory: .cache/cordis-baselines/evidence (a matrix run without evidence is never a pass)`（W-4 guard 响亮红） |
| **N-10(b)**（副本） | 空 `evidence/` | 1 | 49 | 1×missing run marker + 6×missing directory + 42×missing required cell（完备 fail-closed） |
| 控制组 | 规范目录未污染（首/尾） | 0 | 0 | `control-clean` / `control-final` 均 `problems=[]`；收尾 `audit-closing.log` 亦 exit 0 |

每项注入后还原审计均回绿（`audit-*-restored.log` 全部 `exit=0 problems=[]`）。

## §11.1 步骤 4–6 — 发布门禁 + T-1/T-2 + 端到端（汇总 `05-release-gates-summary.txt`）

固定 pnpm 10.28.2、默认模式（env override 出现次数 = 0）：

1. `pnpm pack:local` exit 0（`05-pack.log`）；`git diff --exit-code -- artifacts/local-packages/manifest.json` **exit 0**（确定性再生零 diff）。
2. `pnpm publish:verify`（默认 registry-integrity 模式）exit 0，`verified 15 publishable tarballs`（`05-publish-verify.log`）。
3. `pnpm publish:reproducible` exit 0，`reproducible tarballs verified for 15 packages`（`05-publish-reproducible.log`）。
4. sha256 表（15 tgz + manifest = 16 行，`05-sha256-pre.txt`）+ manifest 副本（`05-manifest-copy.json`）。
5. **T-1（篡改）**：真实打包输出一次性副本 `$I/tarball-probe-tamper/`，对 `nomicore-persistence-0.5.0.tgz` 在 `floor(80906/2)=40453` 偏移翻转 1 字节（cmp 证实恰一字节差：0x38→0x39）→ 换入 → `publish:verify` **exit 1**，`ERROR: tar -xzf …/nomicore-persistence-0.5.0.tgz … failed (2)` **按文件名指名**（`05-T1-publish-verify.log`）；还原后 sha256 表与 pre 逐字节一致。
6. **T-2（删除）**：副本 `$I/tarball-probe-delete/` 删 `nomicore-yjs-server-0.6.0.tgz`（余 14 个）→ `publish:verify` **exit 1**，ERROR 同款指名该文件（`05-T2-publish-verify.log`）；还原后 sha256 表一致。
7. **恢复后再绿**：`publish:verify` **15/15** + `publish:reproducible` **15/15**（`05-publish-verify-post-restore.log`、`05-publish-reproducible-post-restore.log`）；manifest diff exit 0；porcelain 仅 untracked wiki。
8. **端到端链（D10/D11）**：`e2e-chain.mjs`（版本→packed 依赖（`workspace:*` 重写为精确版本）→manifest filename→registry）**E2E CHAIN PASS，65 ok / 0 FAIL**；7 个新版本 registry 侧 `NOT PUBLISHED`（本票不执行真实 publish；dry-run id 检查由 publish:verify 承载）。

## §11.1 步骤 7 — lockfile 与 codegen（log `06-lockfile-generate.log`）

`pnpm install --frozen-lockfile --lockfile-only` exit 0 ∧ `git diff --exit-code -- pnpm-lock.yaml` **空**；`pnpm generate --check` exit 0 ∧ `domains/vfs3-assets/generated.ts` 字节不变（D15）。

## §11.1 步骤 8 — 形状审计（log `07-shape-audit.log`，SHAPE AUDIT: PASS）

`git diff --no-renames --name-status 6be891a`（单一原语纪律）：**恰 20 文件** = 4 个 C1 设施文件（`gates.mjs`、`run-baseline.mjs`、`public-surface.base.json`、`cordis-public-surface.test.ts`，前两者含 C4 再改）+ 8 个 release 文件（7 个 pinned `package.json` 仅 version 行 + manifest）+ 8 个 `wiki/raw/task_issue-472*.md`（**dirname 恰为 `wiki/raw`**，PV-8a iteration-3 补钉口径）；生产面 `packages/**/src/**`、`apps/**/src/**`、`domains/**`、`docs/adr|protocols/**`、`scripts/**`、`.github/**`、`artifacts/**` 的 diff **仅 manifest 一件**；冻结件 `pnpm-lock.yaml` / `scripts/package-catalog.mjs` / `root-test-known-red.json` / `baselines.json` 与 BASE blob **逐字节相同**（blob OID 四条全等）。

## §10 表 F-A…F-M + N-5 — 门禁 falsification（R′ 等价一次性副本 `.worktrees/issue-472-final-iter1-falsify`；汇总 `08-f-series-summary.txt`、`08-n5-n8c-n8g-n10-n9-summary.txt`）

副本 = detach worktree @ `a7fb8ff` + 真实 node_modules 逐项 symlink + 固定 pnpm 副本内真实打包（15 tarballs）。每项注入 → gates（log `falsify-*.log`）→ `reset --hard`：

| # | 注入 | gates 结果 | 唯一红点 |
|---|---|---|---|
| F-A | 第 8 包 bump（clock 0.2.0→0.2.1） | G1′+G13 红 | G13 unexpected version change（G1′ 红系 clock 不在 7 文件集，设计明示） |
| F-B | pinned 文件依赖 range 改 | 仅 G13 红 | 深度相等/文本 diff 行数 ≠ 1 |
| F-C | manifest 保留旧 filename（已提交） | 仅 G13 红 | manifest 交叉红；副本 `publish:verify` exit 1 `ERROR: @nomicore/persistence: manifest filename does not match package version` |
| F-D | bump 后未再生 manifest | G6+G13 红 | G6 artifacts dirty + G13；`publish:verify` exit 1，7 条 ERROR 逐包指名 |
| F-E | 台账加新红名 | 仅 G13 红 | 台账逐字节（S4） |
| F-F | 部分 bump（7 之 3）+再生 manifest | 仅 G13 红（G1′ 绿） | 两态皆败——部分 bump 唯一红点 G13 |
| F-G | exact 后单文件回退 0.4.0 | 仅 G13 红 | absent 分支红 |
| F-H | `packages/clock/src/system.ts` 加注释 | 仅 G13 红 | **G13.g 指名该文件**；G1′/G2/G4 同轮绿 |
| F-I | `scripts/create-publish-manifest.mjs` + `.github/workflows/ci.yml` 注释 | 仅 G13 红 | **G13.g 指名两文件** |
| F-J | `baselines.json` 单字节 | 仅 G13 红 | **G13.f** 逐字节红（G12 名义放行不救） |
| F-K | `git mv .github/workflows/ci.yml wiki/raw/task_issue-472_renamed.md` | 仅 G13 红 | **G13.g 指名被删旧路径 `.github/workflows/ci.yml`**（`--no-renames` 下改名=删+增） |
| **F-L** | staged `wiki/task_issue-472_probe.md` | 仅 G13 红 | **G13.g 指名 `wiki/task_issue-472_probe.md`**（dirname≠`wiki/raw` ⇒ tracked 越界；W-2 收窄实证）；G1′/G2/G4/G12 同轮绿 |
| **F-M** | staged `wiki/raw/nested/task_issue-472_probe.md` | 仅 G13 红 | **G13.g 指名 `wiki/raw/nested/task_issue-472_probe.md`**（basename 命中但父目录 `wiki/raw/nested` 越界）；其余 gate 同轮绿 |
| N-5（副本） | `baselines.json` B1 integrity 尾字节 | acquire **exit 2** | `sha512 mismatch: pinned …0Nw=A, got …0Nw==`；还原 exit 0 |
| 正向控制 | 干净副本（= R′，已交付 wiki 文件在位） | **13/13 全绿** | F-control-exact |

副本收尾 residue 0 行；两个一次性 worktree（falsify、n8f）均已 `git worktree remove --force` + prune（`09-final-state.log`、`04-n8f-summary.txt`），`git worktree list` 复归 main + 任务 worktree 两项。

## D1–D15 判定（R′ 轮）

| # | 承载 | 结果 |
|---|---|---|
| D1–D9 | 步骤 2 矩阵三基线 36 行为 cell + 3 typecheck | ✅（counts 见 `02-matrix-key-fields.txt`） |
| D10/D11 | 步骤 4–6 三连门禁 + e2e 65/65 | ✅ |
| D12 | fault ×4 outer 0 ∧ observed=fail | ✅ |
| D13 | 内置/standalone 审计 + N-6…N-10 全红 | ✅ |
| D14 | root-test 名集 ⊆ 冻结台账，`failedUnexpected=[]`，counts 5987/5991 原样 | ✅ |
| D15 | lockfile 零 diff + `generate --check` 0 | ✅ |

## 交付条件 9 / 10 核对（iteration 3 现行口径）

- **条件 9（可机判载体 = W-3 RESULT 行）**：本轮每次审计恰 1 行 RESULT——干净矩阵 `built-in matrix audit: exit=0 problems=[]`；standalone 干净对照（control-clean/control-final/closing）同；**全部 N 系负控 RESULT 非空数组 + exit 1**（上表逐条）。自述 PASS 文本未用作判据。
- **条件 10（禁依赖面五处，逐条避开）**：① `baselines.json` 冻结按 **G13.f（gates PASS 内含）+ N-5（acquire exit 2→0）** 核，未以「G12 零 diff」为据；② 公共 API 冻结按 **G13.g（`--no-renames`）+ G2/G4 + 步骤 8 形状审计** 核，未用「G2/G4/G7」覆盖归因；③ 负控覆盖按 **§10 表 F-A…F-M + N-5…N-10 + T-1/T-2 实际注入项** 核（F-L/F-M/N-8e/N-8f/N-8g/N-10/T-1/T-2 全部在 R′ 上重跑），未引用「F-A…F-E 一一证伪」声明；④ 内容绑定按 **PV-9 指纹**（marker.worktree/runWorktree/marker 时-审计时两次比对 + N-8e/N-8f/N-8g 三向实证），未用 write-tree 比对；⑤ tracked wiki 判定按 **PV-8a iteration-3 补钉（dirname 恰 `wiki/raw` ∧ basename 正则）**（F-L/F-M 应红实红 + 步骤 8 dirname 全等复核），未用「glob 按 basename 匹配」注记。

## Dynamic Evidence Matrix（iteration 1 增量）

| Source | Requirement or risk | Driver | Expected | Actual | Evidence | Result | Suggested routing |
|---|---|---|---|---|---|---|---|
| SA9-2/B-3（W-6） | 矩阵必须固定 pnpm 且全量 | shim PATH + `--all --matrix` | 41/41、probe=10.28.2 | 41/41、probe exit 0 stdout 10.28.2 | `02-matrix-all.log` | ✅ | — |
| SA9-1（W-1/PV-9） | 证据必须绑定实际被测内容 | marker/matrix 指纹 + N-8e/f/g | 三向红点齐备 | drift/head 独立红 | `04-n-series-summary.txt`、`04-n8f-summary.txt` | ✅ | — |
| SA9-3（W-2/PV-8a） | wiki/raw 收窄防 fail-open | F-L/F-M | 指名判红 | 两路径均指名红 | `falsify-F-L.log`、`falsify-F-M.log` | ✅ | — |
| SA9-4（W-3/条件 9） | 审计结果可机判 | RESULT 行 | 恰一行、成功含 `problems=[]` | 全部合规 | 各 `audit-*.log` | ✅ | — |
| SA9-5（W-4/N-10） | 缺目录 guard 复活 | 移走/清空 `evidence/` | exit 1 + 非空数组 | 1 / 49 条 problem | `audit-N-10-*.log` | ✅ | — |
| SA10 B-1（T-1/T-2） | tarball 内容完整性负控 | 一次性副本篡改/删除 | 非零 + 指名 + 恢复 15/15 | 两项均如此 | `05-T1/T2-publish-verify.log` | ✅ | — |

## 数据流 / 状态机核对（R′ 轮）

Changed（打包链/证据链）与 Preserved（业务数据流/公共契约）的判定与 round 1 节 §7 同构，全部由 R′ 上的独立重跑承载：Root 通道（B1/B2 legacy、B3 symbol）、Timer 状态机（arm→trigger→cancel 12/12×3、flush/retry/drain/dispose）、Registry/Hub/Peer lifecycle（23 units×3）、guard-Proxy 五面、DSH dispose 顺序——counts 逐基线落盘；错误与清理流：fault ×4 内层红、审计 15 项 fail-closed、T-1/T-2 恢复逐字节、一次性副本零残留、无旧路径复活。

## Deviations（iteration 1；记录性，非判据偏离）

1. **工作树证据文件的两段式处置**：4 个已修改 tracked wiki 证据文件在全部动态步骤期间按备份→`checkout --`→复跑后恢复的次序处置（W-1 期望值语义要求被测内容 = R′ 内容树；`wiki-mods-*.sha256` 留档四条全等）。本报告文件的追加发生在全部动态验证与收尾审计之后。
2. **探针副本路径**：T-1/T-2 副本在 `$I/tarball-probe-{tamper,delete}/`（设计 §13 例举 `.cache/issue-472-final/tarball-probe-*`；iter1 子目录保持轮次分离，同属 gitignored `.cache/**`）。
3. **N-8f 的 G13 明细行**位于已清理副本的 `gates.log`；判据核心（内置审计 drift problem 在场 + MATRIX FAIL）已完整留档 `04-n8f-matrix.log`（problems 数组含 `default/gates: status="fail"` 的并列披露）。
4. round 1（作废）工件原样保留于 `.cache/issue-472-final/` 根，未改写；本轮全部新证据在 `iter1/`。
5. e2e 依赖 farm 沿用 round 1 口径（声明依赖 → symlink farm，默认条件解析），门禁判定全部来自 `publish:verify`/`publish:reproducible` 原生输出。

## Temporary diagnostics（iteration 1）

未在任何生产/设施/脚本代码中加入临时日志或修改；全部观察经现有设施输出与 `$I` 内自建编排脚本（`n-series.sh`、`f-series.sh`、`release-gates.sh`、`n8f.sh` 等，均落 gitignored `.cache/`）取得。`git diff` 无 `[SA7-DATAFLOW]` 残留；工作树 tracked 变更仅 `wiki/raw/task_issue-472*.md` 面（4 恢复文件 + 本报告追加）。

## Verdict（iteration 1，R′）

**approve**。§11.1 八步在 R′（`a7fb8ff` / tree `91c1c49a…`）上全量重跑成立：41/41（gates 13/13、G13 exact、审计 RESULT `problems=[]` 恰一行）、`pnpmProbe` 0/10.28.2、`runWorktree === marker.worktree === R′ tree OID`、root-test 5987/5991 且 `failedUnexpected=[]`；fault ×4、F-A…F-M、N-5…N-10（含 N-8e/f/g、N-10 两变体）、T-1/T-2 全部应红实红、恢复后 15/15+15/15 再绿；lockfile/codegen/形状审计全过；条件 9/10 逐条满足；未触发设计 §12 任何停手条件；未执行真实 `npm publish`；未修改任何生产源码/测试/facility/manifest/docs/scripts；一次性副本与临时 worktree 已清理。
