# SA3 Implementation Report — issue #471（Cordis rc.12 Hub/Peer/SessionHost 全链兼容）

状态：**实现与验证闭合（iteration 2：SA4/SA8 实现级评审阻断项已闭合）**。三基线矩阵 `41/41 PASS`（exit 0）、三基线 typecheck `3×15/15` project exit 0、每基线 `replication-lifecycle units.observed===23 && coverage` 在场、root-test 按 Step 0 BASE 台账判定 `failedUnexpected===[]`、负控 N-1/N-2 与变异 M-1/M-2 全部「应红实红」并逐字节还原。**iteration 2 修复**：G10 M4 跨行实参归属 + fail-closed（SA4-1 / SA8 §8-1(a)）、V_ctx 后缀边界（§8-1(b)）、自检表 12→16 行（§8-1(c)）、分类判定顺序按钉死表序（SA4-2）、`baselines.json` 最小 diff 还原（SA4-5）——逐条修法、修复前后分类差异与复跑证据见 **§9**。本文档只描述当前实现与当前验证结果；未闭合项与如实披露见 §8 与 §9.7。
基线：worktree HEAD `d59a4d1`（= Issue `## Parent` PR #469 head；`git rev-parse HEAD` 核对）。
设计真源：`wiki/raw/task_issue-471_design.md`（rev 3，§9.2 rev 2.1）；验收契约：`wiki/raw/task_issue-471_sa6_acceptance_contract.md`（AC1–AC9）；约束性裁决：`wiki/raw/task_issue-471_design_conflict_report.md`（§9.1 十文件 ALLOW、T-1…T-4、B-1…B-5、§9.3、§14 I-1@rev2.1）。

---

## 1. Inputs consumed

- `wiki/raw/task_issue-471_design.md`（全 620 行；§5/§7/§8/§9.1/§9.2 rev 2.1/§10/§11/§12/§13/§14/§17）
- `wiki/raw/task_issue-471_sa6_acceptance_contract.md`（§1–§5、§6.2、§9.4 M-1/M-2、§11、§12.0–§12.10、§13、附录 A）
- `wiki/raw/task_issue-471_design_conflict_report.md`（§9.1/§9.2/§9.3、§12–§14 追认面；I-1/I-2/I-3）
- `wiki/raw/task_issue-471_sa2_review.md`（approve；F-1…F-9）
- iter-0 实现报告（`wiki/raw/task_issue-471_sa3_impl.md` 上一版）与 Host 审阅意见（本轮 8 项必须闭合项）
- 源码/设施实读：`packages/ws-replication/src/plugin.ts`（seam 195–298、三处 `ctx.plugin` 消费点）、`hub-namespace.ts`（`afterAssemblyAccept`/`armTimer('assembly')`/`onAssemblyTimeout` 1969–2015、1050）、`peer-namespace.ts`（`sendStep2` kind=2 判据 1587–1640、`sendUpdateFrame` 1493）、`update-channel.ts`（`isChunkable`/`sendAndRegister` 363–420）、`defaults.ts`（`DEFAULT_REPLICATION_LIMITS`）、`apps/yjs-server/src/main.ts:36–37`（唯一合法 `process.env.NOMICORE_CONFIG`）、`packages/persistence/test/fixtures/cordis-baselines/{run-baseline.mjs,gates.mjs,baselines.json}`、`vitest.config.ts`、根 `package.json`（`packageManager=pnpm@10.28.2`、15-project typecheck）
- 运行期取证（本轮新增/更新，均在 `.cache/`，gitignored）：`.cache/cordis-baselines/evidence/{matrix,gates,B1,B2,B3,root-test,root-test-base,negative}`、`.cache/mutations/`

## 2. Existing worktree reconciliation

iteration 1：起始工作树 = iter-0 的 10 文件实现 + 本轮修复。逐项核对最新设计后：保留符合设计的全部改动；**修正** 4 处（typecheck 的 `as never` 过度 cast、lifecycle 单元名提取口径、guard-proxy A6-4 判据、G8 扫描口径）；**补跑** §7 的 5 项负控/变异；**新捕获** Step 0 BASE 台账。未保留任何过时实现。

**iteration 2（实现级评审闭合）reconciliation**：起始工作树 = iteration 1 的 10 文件实现（评审 reject 状态）。逐项核对 SA4 review + SA8 impl conflict report §8-1 后：**只修 `gates.mjs` 的 G10 四点**（M4 跨行 fail-closed、V_ctx 后缀边界、自检表 4 行、分类表序）并把 `baselines.json` 还原为最小 diff；其余 8 文件按「已闭合项不得回退」原样保留（零改动复核：`git status` 非 wiki 改动仍恰十文件）。修法、前后分类差异与复跑见 §9。

## 3. Changed paths（实际 10 文件 ⊆ §12.1 ALLOW）

| Path | Design section | Change |
|---|---|---|
| `packages/persistence/test/fixtures/cordis-baselines/baselines.json` | §7.1 | `base` 重钉 `d59a4d1…`；`suites` 追加 6 项（ws-package / guard-proxy / ws-cordis-channel / ws-cordis-timers / replication-lifecycle / composition-root）；`comment` 增记 #471。**iteration 2 还原最小 diff**：以 BASE 字节为底只施加上述 3 处编辑，消除整文件重编码噪声（`+9/−3`，3 hunk；语义 `JSON.parse` 全等） |
| `packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs` | §7.2 E1–E7 + E4a | E1 七组文件/单元常量（含 `LIFECYCLE_UNITS` 23 名钉死枚举）；E2 `NEW_FILES` +7；E3 suite 白名单由 manifest 驱动（删除 `'gates'` 死字面量）；E4/E4a `NOMICORE_CORDIS_FAULT` 贯通全部 `runVitest` 调用点、`unload` 双文件；E5 新 suite 分支（channel 单文件、timers/lifecycle repeat=3、guard-proxy/composition-root 逐文件）；E6 `--all` 删除 B1 专属 ws-package 块；E7 装载期 provenance→root-probe 自检；root-test cell 改台账判定。**本轮修正**：`unitNameOf` 改用 `assertion.title`（vitest JSON reporter 以空格拼 ancestorTitles，不产生 `' > '`）；`assertions[]` 随 `runVitest` 回流；lifecycle `units` 按 title+status 计数、`coverage` 同口径、`issue420` 改为文件级在场（含 tests>0）；guard-proxy `a64` 改为文件级「在场且该文件自身 exit0 ∧ 0 failed ∧ tests>0」。+217/−21 行（相对 BASE） |
| `packages/persistence/test/fixtures/cordis-baselines/gates.mjs` | §7.3 | BASE 重钉 `d59a4d1`；G2=`assertNoChange`（三处 src）；G3=allowlist（恰 4 个 ws 新测试文件）；G6 挂基座 `git diff --check <BASE>`；**G10 新增**（§9.2 rev 2.1：R0 扫描面+设施排除、R1 M1–M4 + V_ctx/V_M4、R2 七行分类、类 6 空判定、两类自证伪、I-3 回归自检 12 行 + 15 cast/注释/大小写探针）；**G11 新增**（forbidden API 五种模式，允许清单空集）；**G12 新增**（设施 4 文件闭合白名单，目录内新增即红）。**本轮修正 D-3**：G8 改为「四类 src 全扫描 + 恰 2 行 BASE 合法 app 配置行钉死允许」，取消原「app edge 整树豁免」。+426/−28 行（相对 BASE）。**iteration 2 修复**：G10 M4 补跨行实参归属 + 不可归属 fail-closed（`m4ContextsOf`/`m4CandidateOf`，含 `callee=UNRESOLVED-CROSSLINE`）、V_ctx 后缀按钉死文锚定（去前置字符类）、自检表 12→16 行（补 4 锚点 + `none` 非候选断言）、R2 分类按钉死表序 1→2→3→4→5→5D→6、新增 8 条多行 M4 探针、删除死参数 `void minimum`/死常量 `ROOT_EXTS`；修复后 +606/−28 行（相对 BASE），G10 计数与全量命中记录零漂移（§9.3） |
| `packages/ws-replication/test/ws-replication-cordis-root-channel.test.ts` | §9.1（A1-1…A1-7、A5-2/A5-4） | 新增 468 行：5 形态宿主 × 3 入口 + timer-service 缺失/畸形 + 两跳级联 4 例 + sentinel 3 例 + 基线通道身份 1 例 = 29 测试 |
| `packages/ws-replication/test/ws-replication-cordis-root-timers.test.ts` | §9.1（A1-8、A3-4） | 新增 771 行：12 timer 族，真实基线 `TimerService` + 原型插桩 meter，每族 arm→trigger→cancel。**本轮 D-2 收敛**：bulk/assembly 两族改由**真实 kind=2 chunked SYNC_STEP2** 驱动 `armTimer('assembly')`（peer 100 KB 写 → live 不可分块 → 恢复 round diff > `maxSyncDiffBytes` → kind=2；尾帧在 transport seam 被 withhold 以观察滑动 deadline），删除原 kind=0 手工注入；`bootLivePair` 增 `limits/schema/root/peerWrite/wrapHubEnd` |
| `packages/ws-replication/test/ws-replication-cordis-baseline-lifecycle.test.ts` | §8（AC2 全矩阵 + β/γ + N-5） | 新增 586 行：3 入口 ×7 场景 = 21 单元 + `L.edge-beta.minimal-round` + `L.async-gamma.minimal-round` + `coverage` 自检（= runner 侧 `units.observed===23` 的第二道面）；真实基线 `TimerService` |
| `packages/ws-replication/test/cordis-baseline-support.ts` | §8.1（meter/宿主/装配/waitFor/sink） | 新增 412 行测试内共享支撑（非 `.test.ts`、不被根 glob 收集）；不含任何 `.cache` 路径解析（B-2） |
| `apps/yjs-server/test/third-party-timer-ownership-red.test.ts` | §10（A3-2、A4-1…A4-3） | 新增 145 行：`O.timer-alive.*` / `O.last-release.*` / `O.no-auto-edge.*` / `O.no-cycle.*` 四例 |
| `packages/dsh-persistence/test/dsh-profile-direct-apply-order.test.ts` | §10.1（A4-4） | 新增 91 行：直接 apply profile 的 dispose 序（adapter 先 → 根 fiber 后）+ 幂等 + 真实 TimerService 驱动 flush |
| `packages/persistence/test/fixtures/cordis-baselines/root-test-known-red.json` | §13.0/D-6（A8-4；SA8 §9.1 第 10 项） | 由**空集骨架**改为 Step 0 BASE 捕获台账：`knownRed` 4 条 + `environmentRed` 28 条 + 逐条 `attribution` + `notes`（冻结纪律/名级谓词/披露禁令） |

## 4. SA2 Finding 落实

| Finding ID | Implementation | Result |
|---|---|---|
| F-1（E4a legacy-shim 全分支） | `run-baseline.mjs` `faultEnv(fault)` 注入全部 4 个 `runVitest` 调用点（通用/root-probe/逐文件/channel） | 已落实；N-2 按 `cells[]` 逐 suite fail（§7） |
| F-2（G10 候选集） | gates.mjs G10 实现 M1–M4 + 词表 + 7 类 | 已落实；N-6 三形态定向红（§7） |
| F-3（归置钉死） | E1 `GUARD_PROXY_FILES`（六文件，含 issue246 + 418×2）/ `WS_LIFECYCLE_FILES`（含 issue420） | 已落实；本轮 `issue420` 在场改为文件级可证 |
| F-4/F-5/F-5r | E5 归类按 23 名钉死枚举 + 自检名 `coverage` | 已落实；本轮修正提取口径后每基线 `observed===23`、`coverage`/无 foreign（§6.1） |
| F-6（旋钮） | timers 文件 12 族逐族使用 TIMEOUT_KEYS/BACKOFF_KEYS 或读取点字面量（waitForLive 25ms） | 已落实 |
| F-7（G2/G3 形状） | G2=`assertNoChange` 三处 src；G3=allowlist 恰 4 ws 新文件 | 已落实（gates 实跑 PASS） |
| F-8/X-1（G10 rev2/rev2.1） | G10 以 §9.2 文本语义落地（不照抄脚本）；**iteration 2 更正**：iteration 1 的 M4 实参位判定照抄了干跑脚本的跨行局限（只回溯本行、被调不可归属即静默 `continue`），与「以设计文本语义落地」自述不符——本轮已补跨行实参归属 + 不可归属 fail-closed ⇒ 类 6（§9.2(a)） | §9.2(a)、§9.3、§7 N-6 |
| F-9（取证对齐） | 落地直接采用 rev 2.1 语义 | 已落实 |
| 本轮 Host 审阅 1（typecheck 3 cell） | 移除 `ctx.plugin(plugin as never)` 的 `as never`（P=never ⇒ `Spread<GetPluginConfig<never>>` 变必填二元组） | 3×15/15 project exit 0（§6.2） |
| 本轮 Host 审阅 2（lifecycle 3 cell） | `unitNameOf`/`coverage`/`foreign` 改按 `assertion.title`（避免依赖不存在的 `' > '` 分隔符） | 每基线 `observed===23`、`coverage=true`、`issue420.present=true`（§6.1） |
| 本轮 Host 审阅 3（guard-proxy 3 cell） | A6-4 改为文件级在场+自身绿（原英文子串匹配中文标题恒 false） | 三基线 38/38、`a64` 三项 true（§6.1） |
| 本轮 Host 审阅 4（台账） | Step 0 BASE 干净副本捕获 → 32 条台账 | `failedUnexpected=[]`（§6.3） |
| 本轮 Host 审阅 5（负控/变异） | N-1/N-2/M-1/M-2 全部实跑 + 还原校验 | 全部「应红实红」（§7） |
| 本轮 Host 审阅 7（D-2/D-3） | D-2 收敛到真实 kind=2；D-3 收敛到四类 src 全扫描 + 2 行钉死 | §8-3/§8-4 |

## 5. G10 首落地与 I-1@rev2.1 对账（本轮复跑）

命令：`node packages/persistence/test/fixtures/cordis-baselines/gates.mjs`（证据 `.cache/cordis-baselines/evidence/gates/gates.log`）。

实跑分类计数：`{"1":20,"2":13,"3":9,"5":4,"5D-R":197,"5D-C":46,"6":0}`，`scanned=738 cordis_faced=51`，**第 6 类恰空 ✓**，两 seam 第 1 类命中 2/2 ✓，回归自检 12/12 ✓，cast 探针 15/15 ✓，G8 新口径 PASS。

与 I-1@rev2.1 基线（`cat_1=19 cat_2=13 cat_3=7 cat_5=4 cat_5DR=196 cat_5DC=46 cat_6=0`，285 条）的 delta —— 全部来自本票新增文件，BASE 实存锚点零漂移：

| 类别 | 基线 | 实跑 | delta 解释 |
|---|---|---|---|
| cat_1 | 19 | 20 | `ws-replication-cordis-root-channel.test.ts:453` `Reflect.get(assembly.base,'root')` —— T-2 文件级许可的通道探针行（记录类，非新增许可） |
| cat_3 | 7 | 9 | `cordis-baseline-support.ts:44` `Symbol.for('cordis.root')`、`apps/yjs-server/test/third-party-timer-ownership-red.test.ts:87` 测试名 `O.last-release.root-fiber-dispose` —— 新增文件内字符串字面量（类 3 = 排除类） |
| cat_5D-R | 196 | 197 | `ws-replication-cordis-root-timers.test.ts:212` `root: options.root ?? { n: 1 },`（**本轮 D-2 收敛新增的 namespace 创建参数行**）—— 5D-R = 域数据/载荷键类排除类，无门禁影响；BASE 文件零新增命中 |
| cat_2/5/5D-C/6 | 13/4/46/0 | 一致 | BASE 锚点逐项复现 |

> 结论：**未出现「超出清单」的差异**；上表三处 delta 100% 由 ticket 新增文件解释。允许清单零增删（2 seam 行 + 3 fixture 双读行 + 恰 2 文件级许可）。I-2：G12 维持现行钉死值，实跑 PASS。
>
> **iteration 2 复核（M4 跨行实参归属落地后）**：分类计数与全量命中记录**逐字节不变**（`{"1":20,"2":13,"3":9,"5":4,"6":0,"5D-R":197,"5D-C":46}`；289 条命中 `diff` 为空），BASE 子集仍恰 `1=19 2=13 3=7 5=4 5D-R=196 5D-C=46 6=0`（= I-1@rev2.1 逐项），新增文件仍恰 4 条。详见 §9.3。

## 6. Verification（全部实跑，证据在 `.cache/`）

| # | Command | Result | Evidence |
|---|---|---|---|
| V-1 | `node packages/persistence/test/fixtures/cordis-baselines/gates.mjs` | **12/12 PASS**（G1′/G2/G3/G4/G5/G6/G7/G8/G9/G10/G11/G12） | `.cache/cordis-baselines/evidence/gates/gates.log` |
| V-2 | `node run-baseline.mjs --all --matrix` | **41/41 PASS，exit 0**（3 基线×13 cell + gates + root-test；`MATRIX PASS: 41 cells`） | `.cache/cordis-baselines/evidence/matrix/{matrix.log,matrix.json}` |
| V-3 | 三基线 typecheck（矩阵内逐 project） | **3×15/15 project exit 0**（45 个 project 全绿、45 份 project 日志均空输出） | `.cache/cordis-baselines/evidence/B{1,2,3}/B*-typecheck.json` + `B*-typecheck-*.log` |
| V-4 | 三基线 `replication-lifecycle`（repeat=3） | 每基线 **34/34 passed**、`units={expected:23,observed:23,missing:[]}`、`coverage=true`、`foreignUnits=[]`、`issue420={present:true,tests:10}`；三基线 `L.` 全名并集 **69**（23×3，`coverage` 不计入） | `.cache/cordis-baselines/evidence/B*/{replication-lifecycle.json,B*-replication-lifecycle-repeat3.log}`、`.cache/cordis-baselines/evidence/matrix/unit-union.json` |
| V-5 | 三基线 `guard-proxy`（六文件逐文件） | 每基线 **38/38 passed**、`a64={issue246:true,issue418Contract:true,issue418Structure:true}` | `.cache/cordis-baselines/evidence/B*/{guard-proxy.json,B*-guard-proxy-*.log}` |
| V-6 | 三基线 `ws-cordis-channel` / `ws-cordis-timers`（repeat=3） / `composition-root` / `ws-package` | 29/29、12/12×3、28/28、66/66（每基线） | `.cache/cordis-baselines/evidence/B*/…`（matrix 表列全路径） |
| V-7 | 三基线 `provenance` / `root-probe` / `contract` / `real-timer`（×3） / `dsh-profile` / `unload` | 4/4（B3 8/8）、12/12、243/243（B3 247/247）、11/11×3、12/12、10/10 | 同上 |
| V-8 | 默认布局聚焦（新文件必绿） | channel 29/29、timers 12/12、lifecycle 24/24、ownership 4/4、dsh-profile-direct 2/2；`Type Errors: no errors` | 本会话实跑日志（矩阵 `root-test` 亦覆盖：本票新文件 0 失败） |
| V-9 | `git diff --stat d59a4d1 -- 'packages/*/src' 'apps/*/src' 'domains/*/src'` | **空（生产 src 零 diff）** | §6.4 |

### 6.1 本轮修复的三类红 cell（final）

| cell | 根因（iter-0 分类） | 本轮处置 | final |
|---|---|---|---|
| `B*/typecheck` | **实现缺陷**：`ctx.plugin(plugin as never)` 使 `P=never` → `GetPluginConfig<never>=never` → `Spread<never>=[config: never]`（必填第二参），在 B1/B2/B3 与仓库布局下同为 `TS2554`。**不是** Timer 类型面差异。共 10 处（lifecycle 3 + timers 6 + ownership 1） | 移除 `as never`，让真实 plugin 对象类型流入（`apply(ctx)` 无额外参 ⇒ config 可选）；未改 tsconfig、未 skipLibCheck、未用新 cast | 3×15/15 exit 0；`tsc -p packages/ws-replication`/`apps/yjs-server`/`packages/dsh-persistence` 亦干净 |
| `B*/replication-lifecycle` | **设施缺陷**：vitest 3.2.7 JSON reporter 的 `fullName` = `ancestorTitles.join(' ') + ' ' + title`（**不含** `' > '`），iter-0 的 `lastIndexOf(' > ')` 永远落空 ⇒ `observed=0` | 提取改按 `assertion.title`（= 钉死单元名本身），`observed` = 枚举内 title 且 status=passed 去重；`coverage` 同口径；`foreignUnits` 仍对以 `L.` 起头的 title fail-closed；`issue420` 改为 JSON 文件级在场且 tests>0 | 每基线 `observed=23`、`coverage` 在场 passed、并集 69（23×3，`coverage` 不计入；机械复核见 `matrix/unit-union.json`） |
| `B*/guard-proxy` | **设施缺陷**：`a64` 用英文子串（`interop`/`contract`/`structure`）匹配**中文测试标题**恒为 false ⇒ 38/38 全绿仍判红 | `a64` 改按文件级「在场 ∧ 该文件 exit0 ∧ 0 failed ∧ tests>0」，`a64` 三项可审计 | 三基线 38/38 + a64 三 true |
| `default/root-test` | **台账未捕获**（iter-0 空集骨架） | Step 0 BASE 干净副本捕获（§6.3） | `failedUnexpected=[]` |

### 6.2 三基线 typecheck（3×15/15）逐 project 留证

- B1：`.cache/cordis-baselines/evidence/B1/B1-typecheck.json`（15 project，`exitCode` 全 0）+ `B1-typecheck-<project>.log` ×15（均仅 1 字节换行 = 零诊断）
- B2：`.cache/cordis-baselines/evidence/B2/B2-typecheck.json` + 15 份日志（同上）
- B3：`.cache/cordis-baselines/evidence/B3/B3-typecheck.json` + 15 份日志（同上）
- 说明：矩阵 materialize B1（03:51:20）后本会话又做了一次**纯类型面**清理（删除 `registry.create` 实参上两处不必要的 `as never`，无运行时差异）；B1 的 `typecheck` 与 `ws-cordis-timers` 已用**最终文件**单独复跑，仍为 `15/15 exit 0` 与 `12/12×3`，矩阵判定不变。

### 6.3 root-test 台账（B-3a…B-3e）与矩阵判定

- **Step 0 BASE 捕获（B-3a）**：`git worktree add --detach .cache/root-test-base-wt d59a4d1`（干净 BASE，未做本票任何改动），按 runner 同款命令 `NODE_OPTIONS=--conditions=nomicore-source node node_modules/vitest/vitest.mjs run --typecheck --reporter=default --reporter=json …` 实跑。捕获：`numTotalTests=5913, numPassedTests=5881, numFailedTests=32`。
  - 证据：`.cache/cordis-baselines/evidence/root-test-base/{base-root-test.vitest.json,base-root-test.log,ledger-capture.json,build-ledger.mjs}`
- **B-3b（提取机制自身负控）**：4 例 `ws-replication-issue421-edge-factory-api.test-d.ts` test-d 红**实际出现在** `failedTestNames`（名级，非计数级）；台账 `knownRed` 恰 4 条。
- **B-3c（新文件永不可入账）**：捕获/写入脚本硬断言「BASE 失败 ⊆ 非本票文件」，`problems=[]`；矩阵 root-test 的 32 条失败中 **0 条**来自本票新增文件（本票新文件全绿）。
- **B-3d（名级谓词 + 披露）**：台账 `knownRed=4` + `environmentRed=28` + 逐条 `attribution`；矩阵 root-test cell `status=pass`、`failedTestNames=32`、**`failedUnexpected=[]`**、`disclosure` 在场（`statement` 含表述禁令）。
  - 矩阵证据：`.cache/cordis-baselines/evidence/root-test/{root-test.json,root-test.vitest.json,root-test.log}`
- **对齐环境复跑（B-3d 要求的披露证据，非法定台账形态）**：在 BASE 副本前置 `PATH=.cache/pnpm-shim/pnpm → corepack pnpm@10.28.2`（`package.json packageManager=pnpm@10.28.2`；环境原生 pnpm 为 11.28.5）复跑：`5913 total / 5909 passed / 4 failed` —— **28 例环境红全部转绿，仅余 4 例 knownRed test-d 红**（`failedUnexpected=[]`）。两种捕获形态均合法（B-3a），冻结台账取**环境原生 32 条**（是 4 条的超集，在两种环境下都判绿）。
  - 证据：`.cache/cordis-baselines/evidence/root-test-base/{aligned-capture.json,base-root-test-aligned.vitest.json,base-root-test-aligned.log}`

### 6.4 改动面与生产零 diff

`git status --porcelain` 的 10 个实现文件 = §12.1 ALLOW 十文件（3 tracked M + 7 untracked）；`packages/*/src`、`apps/*/src`、`domains/*/src` 对 `d59a4d1` **零 diff**（G2/G3/G4/G7/G8/G9/G11/G12 机械承载 + 人工核对）。

## 7. 负控与变异实验（N-1/N-2/N-3/M-1/M-2；本轮全部实跑）

| # | 形态 | 实跑 | 结果 | 证据 |
|---|---|---|---|---|
| N-1 | 通道错配：B3 的 `@deepseek-ai/cordis` 换链到 npm 4.1.0 | `node run-baseline.mjs --baseline B3 --suite provenance --suite root-probe --suite ws-cordis-channel --fault substitute-npm` | **应红实红**：外层 `exit 0`（编排事实），`cells[]` 逐 suite **provenance / root-probe / ws-cordis-channel 均 `status:'fail'`**。红因可核：provenance `@deepseek-ai/cordis resolved outside the B3 overlay: …/overlay/B2/…` + lib tree hash drift；root-probe/channel `symbol baseline must not expose the legacy root property`（`C.channel-identity.B3`） | `.cache/cordis-baselines/evidence/B3/fault-substitute-npm.json` + `fault-substitute-npm/B3-*.log`；`.cache/cordis-baselines/evidence/negative/N1-N2-faults.log` |
| N-2 | legacy shim：受控 ctx 注入 legacy `root` | `node run-baseline.mjs --baseline B3 --suite root-probe --suite ws-cordis-channel --fault legacy-shim` | **应红实红**：外层 `exit 0`，`cells[]` 中 **root-probe 与 ws-cordis-channel 各自 `status:'fail'`**。红因：root-probe 既有通道精确形态断言红；channel `C.absent.{hub-listen,peer-dial,session-host}` 3 例红（legacy 注入使「双缺席」不成立）。对照无 fault 同 suite 三基线全绿（V-6） | `.cache/cordis-baselines/evidence/B3/fault-legacy-shim.json` + `fault-legacy-shim/B3-*.log`；同上 |
| N-3/M-1 | seam 删 legacy 兜底（symbol 缺席 ⇒ `throwRootTimerUnavailable`） | `.cache/mutations/run-mutations.mjs`：B1/B2/B3 各一轮，仅在 materialize 副本 `workspaces/<B>/` 注入 | **应红实红**：三基线 channel suite **恰 3 红 = `C.legacy-only.{hub-listen,peer-dial,session-host}`**（设计 §11 预期）；同变异下既有 4 fixture `ws-package` **66/66 仍绿**（= 缺口证明：旧 fixture 对 legacy 分支零判别力） | `.cache/mutations/{mutations.json,mutations-driver.log,B*-M-1-channel.log,B*-M-1-ws-package.log}` |
| N-3/M-2 | seam 优先级反转（先 legacy 后 symbol） | 同上 | **应红实红**：三基线 channel **9 红 = `C.both.priority.*`（3）+ `C.malformed.*`（3）+ `C.symbol-only.*`（3，legacy getter 读取计数断言）**（设计 §11 预期前两组，第三组为同因加强灵敏度）；`ws-package` **66/66 仍绿** | `.cache/mutations/{…,-M-2-channel.log,-M-2-ws-package.log}` |
| 还原校验 | 变异副本用后恢复 | 每次变异后把 `plugin.ts` 逐字节写回并双向比对 | 三基线 × 两变异共 6 次：`sameAsPristine=true ∧ sameAsHead=true`（与 `git show HEAD:packages/ws-replication/src/plugin.ts` 逐字节一致），最终态再次校验一致 | `.cache/mutations/mutations.json`（`restores[]`） |
| N-4 | 无 ambient timer（sentinel 只记录不自走） | channel 文件 `C.sentinel.{hub-listen,peer-dial,session-host}` | **绿**：sentinel arm ≥1、静默窗口内零后果、显式 fire 后才出现 `close(1002)` / hello-timeout / `namespace-failed{bootstrap-timeout}` | V-2/V-6（三基线 29/29） |
| N-5 | 双挂 provide | lifecycle `L.<entry>.remount` 内负控 | **绿**：未撤销即二次 mount → `service "…" has been registered` 响亮失败；撤销后重挂 ready | V-4（每基线 34/34） |
| N-6 | gate 自证伪（G10 三形态 + G11） | 注入 `packages/persistence/test/n6-g10-injection.ts` 与 `packages/persistence/src/n6-g11-injection.ts` | **应红实红**：G10 class 6 (3) → FAIL；G11 FAIL；`gates` exit 1；注入文件删除后 `packages/persistence/src` 恢复零 diff | **iteration 2 以终版 gates 重取**：`.cache/cordis-baselines/evidence/negative/{N6-gates-final.log,N6-crossline-gates.log,N6-crossline-blank-gates.log}`（对应 SA8 §8-1 末句与 dispatch 的跨行注入要求；见 §9.2(d)） |

## 8. 未闭合项、仍存偏差与如实披露

1. **矩阵/typecheck/units/台账均已闭合**：`41/41 PASS`、`3×15/15 exit 0`、每基线 `units.observed=23` 且 `coverage` 在场、`failedUnexpected=[]`（§6）。**无未闭合的 gating cell**。
2. **A8-4 披露（表述禁令，必须随交付摘要）**：root-test 行按**冻结台账**判绿（B-3a…e），台账在账红 = **4 例 BASE 既有 test-d 红**（`ws-replication-issue421-edge-factory-api.test-d.ts`，expect-type 1.4.0 可选参数元组不兼容；#470 已裁定另立后续票、本票 ALLOW 内不可修）+ **28 例环境红**（环境 pnpm 11.28.5 与 `packageManager=pnpm@10.28.2` 未对齐；对齐环境复跑已证 28 例转绿）。**本票不修、也不得声称「root-test / CI / 所有既有测试全绿」**；本票只声明：三基线矩阵 41/41 绿、新增文件在默认布局与三基线全绿、跑动测试的红名集合恰等于 BASE 冻结台账。
3. **D-2（已收敛，不再是偏差）**：bulk/assembly 两族改由**真实 kind=2 chunked SYNC_STEP2**（"kind=2 自持 ACK"）驱动 `hub-namespace.ts afterAssemblyAccept → armTimer('assembly')`（design §9.1 原文 arm 点），删除 iter-0 的 kind=0 手工注入。判据不变性：`delay === assemblyTimeoutMs`（meter 逐 arm 记录）、超时后果 = `chunked-sync-aborted{reason:'timeout'}`、取消后 `pendingFor(assemblyTimeoutMs)===0`（连接 close / aborted 两条路径）。触发链为生产判据（peer 100 KB 写 → live 不可分块 → 恢复 round diff > `maxSyncDiffBytes` → kind=2），尾帧只在**测试侧 transport seam** withhold，零生产改动；试过「线上丢帧」，会形成连接级序号缺口（`SEQUENCE_VIOLATION 1002`）而非装配停滞，故不采用并记录原因。
4. **D-3（已收敛到设计扫描面，保留 1 处钉死例外；SA8 impl §6-D3 已裁定 RATIFY 并发布 R-2 钉死值，问句已答复）**：G8 现在扫描 `packages|apps|domains` 全部 `src`，语义判据 = 「生产 src 无 baseline/channel env 分支」：`CORDIS_BASELINE|ROOT_CHANNEL|NOMICORE_CORDIS_|rc.12` 在**任何** src 行（含 app edge）即红；`process.env` 仅允许 BASE 既有的 **2 行**合法应用配置（`apps/yjs-server/src/main.ts:36,37` `NOMICORE_CONFIG`），逐行钉死、可审计，且该 2 行上通道标记仍禁。等价性：BASE 无任何其它 env 读取（全仓 grep 仅此 2 行），故「四类 src 全扫描」与「无 env/通道分支」同时成立，G8 在 BASE 与工作树均绿。**交 SA4/SA8 的明确问句**：该 2 行钉死允许清单是否是 design §7.3「生产 src 无 env/通道分支」可接受的机械形态（还是要求另立 ADR/改 app 配置读取方式）？本票未改生产代码、未弱化判据。
5. **判据强度未降低**：`expected:23`、`observed===23`、`coverage` 在场 passed、枚举外 `L.` fail-closed、三基线并集 69、A6-4 三文件在场且绿、12 族 timers 名在场且 passed、`--passWithNoTests=false`、gates 12/12、N-1/N-2 逐 suite `cells[]` 判据——全部按设计原文执行；无 skip/only/todo、无 env override、无 fallback、无生产 src 改动。
6. **G10 cast 面**：iteration 1 为修 typecheck 移除了测试内 10 处 `as never`（`ctx.plugin` 位置），并在 D-2 的 namespace 创建处避免新增 cast；G10 分类与探针计数见 §5 与 §9.3（唯一新增命中是 5D-R 载荷键行，排除类）。**iteration 2 另在 `gates.mjs` 内新增 2 条 V_ctx 边界探针（`ACtx`/`$ctx`）与 8 条跨行 M4 探针**，均为合成样本、不入扫描面。
7. **既有 4 test-d 红与 28 环境红**：本票零生产改动、不修（DENY 既有测试 + 工具链升级触 G1′）；披露义务见 §8-2。
8. **iteration 2 未闭合项**：仅 SA4-3 的两处测试侧装饰性断言（本轮窄面约束下保留，理由与追认请求见 §9.2(h)/§9.7-1）；其余 SA4/SA8 阻断项与字面偏差全部闭合（§9.2）。

## 9. 实现级评审闭合（iteration 2：SA4 reject + SA8 implementation reject）

### 9.1 输入与裁决面

| 输入 | 结论面 |
|---|---|
| `wiki/raw/task_issue-471_sa4_review.md` | verdict = **reject**；唯一 MAJOR = **SA4-1**（G10 M4 跨行实参位未 fail-closed，且实现报告自述「已落实」与代码不符）；MINOR：**SA4-2** 分类顺序偏离钉死表序、**SA4-3** 装饰性断言/死参数、**SA4-4** 缺设计 §16.3 调用方影响矩阵成段核对、**SA4-5** `baselines.json` 整文件重编码字节噪声、**SA4-6** units 提取口径备案 |
| `wiki/raw/task_issue-471_impl_conflict_report.md`（SA8）§8-1 | 同根阻断 = I-1③ / §14.8-2 / 设计 §9.2 R1 M4 钉死句「不得静默按非候选丢弃」；同文件两处字面偏差：(b) `inVctx` 后缀边界收窄、(c) `G10_SAMPLES` 缺 4 行；另要求**以终版 gates 重取 N-6 留证**并更正报告自述 |
| 本轮 dispatch | 修复后须新增**跨行注入**自证伪证据（可 `.cache` 下一次性验证，不入库） |
| 范围 | 仍严格 ⊆ §12.1 十文件；本轮实际改动 **仅 `gates.mjs`**（+ `baselines.json` 最小 diff 还原，同在 ALLOW 内）；生产 `src/**` 零 diff |

### 9.2 逐项修法

**(a) SA4-1 / SA8 §8-1(a) — M4 跨行实参归属 + fail-closed**（`gates.mjs:448–549` 词法上下文/候选判定，sweep M4 分支 `:615–624`）

1. **同被调行判定原样保留**：`calleeOfLiteral`（`:434`）先跑，其判据与 I-1@rev2.1 落地形态逐字相同；
2. 该判定返回 `null` 时**不再 `continue` 静默丢弃**，改由整文件词法上下文（`m4ContextsOf`，`:463`）恢复归属：单遍扫描维护「字符串/注释状态 + 括号栈」，为每个真实 `'root'` 字面量记录其**最内层 call-like 括号**（分组括号透明）与被调点链（`(` 前的点链从全文回溯，跨行透明）；
3. **实参位判据**（`m4CandidateOf`，`:541`）：字面量为「调用实参首个 token」（前一个非空白字符是 `(` 或 `,`）⇒ 候选；被调可机械归属 ⇒ 按 V_M4 落类 1 / 5D-C / 6；被调点链**空白**（如括号前是 `)` 的 cast/分组调用形）⇒ `callee=UNRESOLVED-CROSSLINE`（`:460`）⇒ 候选 ⇒ **类 6（fail-closed）**；
4. 非实参位（case 标签、类型联合、模板 JSON 串、注释散文、数组/对象元素、嵌套箭头函数体、定义位键形）保持**非候选**——与钉死 R1「调用实参位」定义、R2 类 1–4 语义一致。

**BASE 零漂移的可满足性证明（第一手测量，一次性脚本 `.cache/m4-alignment/{probe.mjs,probe2.mjs,dump.mjs}`，gitignored）**：全树「同被调行不可解析」字面量 **57** 个，逐条定性后**零个**处于调用实参位——`case 'root':` 13、类型联合/类型注解/`as` 收窄 8、`!==`/`===` 比较 5、调用外对象键值 9、模板 JSON 串 9、注释散文 3、数组元素/常量初始化/`'root' in args`/cast-M2 等 10；唯一「行首字面量」为 `apps/yjs-server/src/app.ts:879` `'root' in args`（前一非空白字符是 `=`、后随 ` in`，既非实参首 token 也无 call-like 括号）⇒ 非候选。交叉复核：`oldHits=55 newHits=55 / deltas=0 / new class-6=0`。

**(b) SA8 §8-1(b) — V_ctx 后缀边界**（`gates.mjs:361–368`）：改为钉死文原义「token **以 `ctx`/`Ctx` 结尾**即入表」（`endsWith('ctx') || endsWith('Ctx')`，大小写敏感不变），删除原 `(?:^|[a-z0-9_])(?:ctx|Ctx)$` 的**前置字符类**（该字符类把 `ACtx`/`$ctx` 类 token 收窄进 5D）。词表成员 {`ctx`,`context`,`host`} ∪ 后缀零增删；新增两条合成探针 `ACtx`、`$ctx` ⇒ 类 6（对照探针 `fiberCtx`/`timerCtx` 仍类 6、`fiberCTX`/`Context`/`docContext` 仍 5D）；M-4 变异（回退旧正则）下两新探针即红，证明它们真的在测该边界（§9.2(d)）。

**(c) SA8 §8-1(c) / I-3 — 自检表 12→16 行**（`G10_SAMPLES`，`:640–657`）：补齐设计 §9.2 自检表缺的 4 条锚点，每行绑「类 + 判别 token」：
| 新增行 | 类 + token |
|---|---|
| `packages/persistence/src/service.ts:46` `Symbol.for('cordis.root')` | 类 3（`string interior`） |
| `packages/ws-replication/test/ws-replication-issue301-chunked-completeness-ac-red.test.ts:624` `ctx.root('peer', …)` | 类 2（`root(`） |
| `apps/yjs-server/src/app.ts:880` `root: args.root` | 5D-R（`receiver=args`） |
| `packages/doc-runtime/test/materialize-root.test.ts:782` `[...root.keys()]` | **非候选**（新增 `none` 类断言：该锚点不得出现在任何命中类——定义/枚举位的漏洞不能以「静默丢弃」形式存在） |

顺带删除 SA4-3 指出的死参数列（原 `void minimum`）与死常量 `ROOT_EXTS`。

**(d) dispatch 追加 — 跨行自证伪（N-6 之外）**：新增 **8 条多行 M4 合成探针**（`G10_M4_PROBES`，`:737–745`；分类器 `classifyM4SampleText`，`:690–707` 复用 sweep 同一 lexer/候选判据）：
- `Reflect.get(\n ctx,\n 'root'\n)`、`Reflect.get(ctx,\n 'root')`、`safeReadChannel(\n host, 'root')` ⇒ **类 6**（被调跨行归属）；
- `(ctx as Fn)\n('root')` ⇒ **类 6** `callee=UNRESOLVED-CROSSLINE`（被调点链空白 fail-closed）；
- `writeFatal(\n 'root',\n 'code')` ⇒ 5D-C（可归属但非读取原语 ⇒ 记录，不静默）；
- `{ 'root': 1 }`、`const hosts = [\n 'root',\n]`、`const body = () =>\n 'root'` ⇒ **非候选**（定义位/数组元素/箭头体）。

**实注入自证伪（不入库，验证后删除）**：

| # | 注入 | 期望 | 实测 |
|---|---|---|---|
| N-6 重取 | 三形态钉死样本（M1/M3/M1 可选链、零 Cordis 标记）+ G11 `internal/update` | `cat_6=3` 定向红 | **应红实红**：`cat_6=3` 恰三形态、G10/G11（+G2 伴生）FAIL、exit 1（`.cache/cordis-baselines/evidence/negative/N6-gates-final.log`） |
| 跨行实参 | `Reflect.get(\n ctx,\n 'root',\n)`（本次修复的盲区形态） | G10 定向红 class 6 `callee=Reflect.get` | **应红实红**：`cat_6=1 [M4 (callee=Reflect.get)]`，其余 11 gate 全绿、exit 1（`…/negative/N6-crossline-gates.log`） |
| 跨行空链 | `(channel)\n('root')` | G10 定向红 class 6 `callee=UNRESOLVED-CROSSLINE` | **应红实红**：`cat_6=1 [M4 (callee=UNRESOLVED-CROSSLINE)]`，其余 11 gate 全绿、exit 1（`…/negative/N6-crossline-blank-gates.log`） |
| M-3 变异 | 把跨行判据回退为「静默丢弃」（`.cache/m4-alignment/gates-no-crossline.mjs`） | 8 条跨行探针应红 | **应红实红**：5 条跨行探针 FAIL（`…/negative/M3-no-crossline-probe.log`） |
| M-4 变异 | 把 `inVctx` 回退为带前置字符类的旧正则 | `ACtx`/`$ctx` 两探针应红 | **应红实红**：两探针 `got 5D-R`（`…/negative/M4-old-vctx-probe.log`） |

注入文件删除后 `git status --porcelain` 无任何 `n6-*`/`injection` 条目（生产 `src/**` 零 diff 复核：`git diff --name-only d59a4d1 -- 'packages/*/src' 'apps/*/src' 'domains/*/src'` 为空）。

**(e) SA4-2 — 分类判定顺序按钉死表序**（sweep `:586–604`；`classifySampleText` `:659–688`）：改为 R2 表序 **1 → 2 → 3 → 4 → 5 → 5D → 6，首中即定**（修前为 1 → 5(注释) → 3(字符串) → 2(helper) → 5D → 6）。其中行 2（同名 helper 调用）与行 3（字符串字面量内部）按钉死文语义限定为**代码位**判定——注释内的 token 既非代码字符串也非调用；行 4（定义位 `root:`/`'root':` 键形）结构性非候选、代码中无到达路径。该限定是保留 rev2.1 已追认两锚点（`service.ts:41`/`plugin.ts:210` ⇒ 类 5）的必要机械形，已在代码注释与本节明示。**分类迁移 = 0**：修复前后 G10 **全量命中记录逐字节相同**（289 条记录 `diff` 为空），各类计数逐项不变。若按字面「无条件行 3 先于行 5」执行，上述两 JSDoc 行将由 5 迁 3（`cat_3` 9 / `cat_5` 2），与 §14 已追认的 rev2.1 值（7/4）矛盾——故取语义限定形并在此明示取舍依据。

**(f) SA4-4 — 设计 §16.3 调用方影响矩阵成段核对**：见 §9.6。

**(g) SA4-5 — `baselines.json` 最小 diff 还原**：以 `git show d59a4d1:…` 的 BASE 字节为底，仅文本化施加 3 处语义编辑（`base` 重钉、`comment` 追加 #471 句、`suites` 追加 6 项），消除整文件 JSON 重编码噪声（`\u2014`/`\u00a7` 转义）。结果：diff 恰 3 hunk（`+9/−3`），非编辑点行零 diff；`JSON.parse` 语义全等复核（`base`/`suites`/`comment` 三处变化、其余键与 BASE 逐键相等），E1 suite 注册与 `base` 重钉语义**均不变**（矩阵 41/41 实跑复证）。

**(h) SA4-3 — 装饰性断言/死参数**：`gates.mjs` 侧已闭合（`void minimum` 死列、`ROOT_EXTS` 死常量删除）；两处**测试侧**装饰性断言（`ws-replication-cordis-baseline-lifecycle.test.ts:584` `expect(createNamespaceRegistryForTesting).toBeTypeOf('function')`、`ws-replication-cordis-root-timers.test.ts:493` `expect(peerAssembly.timer).toBeDefined()`）**本轮未修改**，理由：本轮 dispatch 明确「改动面应只涉及 `gates.mjs`」；两行是恒真断言、不降低任何判定强度（存在目的只是消化 import/装配对象），修改需重跑三基线 timers/lifecycle cell，故列为待追认清理项（如要求闭合，可在同票任一后续窄面删除并复跑对应 cell）。

**(i) SA4-6 — units 提取口径**：SA8 impl §2(b) 已裁定「`assertion.title` 直读」为钉死谓词的可满足机械形（RATIFY），本轮无动作；口径披露已在 `run-baseline.mjs:591–597` 与 SA8 报告。

### 9.3 修复前后分类差异（逐项）

| 面 | 修复前（iteration 1） | 修复后（iteration 2） | 迁移 |
|---|---|---|---|
| G10 全量命中记录（289 条，含新增文件） | — | **逐字节相同**（`diff` 为空） | **0 条** |
| 分类计数（工作树含 10 文件 diff） | `{"1":20,"2":13,"3":9,"5":4,"6":0,"5D-R":197,"5D-C":46}` | 同左 | **0** |
| BASE 子集（285 条，对 `d59a4d1` 文件分桶） | `1=19 2=13 3=7 5=4 5D-R=196 5D-C=46 6=0` | 同左（= I-1@rev2.1 逐项） | **0** |
| 新增文件命中（4 条） | `{1:1, 3:2, 5D-R:1}` | 同左 | **0** |
| 自检行 `G10_SAMPLES` | 12 行 | **16 行** | +4（补缺锚点，非类迁移） |
| cast/边界探针 | 15 条 | **18 条**（+`ACtx`、+`$ctx`、+spread 非候选） | +3（覆盖面扩大） |
| 跨行 M4 探针 | 无 | **8 条** | +8（新能力） |
| M4 跨行实参字面量 | 静默丢弃（对 G10 不可见） | 归属或 fail-closed ⇒ 类 6 | **BASE 零实存 ⇒ 0 条命中变化**，通道闭合（三条注入实证） |

**结论**：**零分类迁移**、零计数漂移；差异只是自检/探针覆盖面扩大（12→16、15→18、0→8）与 fail-closed 通道闭合。允许清单（2 seam 行 + 3 fixture 双读行 + 恰 2 文件级许可）、扫描面（R0 + 设施目录排除）、N-6 钉死样本内容、G11 空集、G12 四文件白名单**全部零增删**。

### 9.4 复跑结果与新证据路径

| # | 命令 | 结果 | 证据 |
|---|---|---|---|
| W-1 | `node packages/persistence/test/fixtures/cordis-baselines/gates.mjs` | **12/12 PASS，exit 0**；G10：`class 6 empty (243 domain-data rejects: 5D-R=197 5D-C=46); seam self-validation 2/2; regression samples 16/16; cast probes 18/18; cross-line M4 probes 8/8; 738 files scanned` | `.cache/gates-final.log`（归档 `.cache/cordis-baselines/evidence/gates/gates-final.log`）；修复前对照 `.cache/gates-before.log`（归档 `…/gates/gates-prefix.log`） |
| W-2 | `node run-baseline.mjs --all --matrix` | **41/41 PASS，exit 0**（`MATRIX PASS: 41 cells`）；`matrix.json.generatedAt=2026-11-14T20:41:11Z`；gates cell 12/12、root-test cell `failedUnexpected=[]`、三基线 `units={23/23/[]}`+`coverage=true`+`foreign=[]`、并集 69、typecheck 3×15/15 | `.cache/matrix-rerun.log`（归档 `…/matrix/matrix.log`）、`…/matrix/matrix.json`、`…/matrix/unit-union.json`、`…/gates/gates.log` |
| W-3 | BASE 子集对账（`.cache/m4-alignment/base-subset.mjs`） | `BASE-subset hits=285 :: 1=19 2=13 3=7 5=4 5D-R=196 5D-C=46 6=0`；`new-file hits=4 :: 1=1 3=2 5D-R=1` | `…/gates/gates-final.log` 机械分桶 |
| W-4 | 注入自证伪（N-6 重取 / 跨行实参 / 跨行空链） | 3/3 应红实红（见 §9.2(d) 表） | `…/negative/{N6-gates-final.log,N6-crossline-gates.log,N6-crossline-blank-gates.log}` |
| W-5 | 变异自证伪（M-3 跨行判据回退 / M-4 `inVctx` 回退） | 2/2 应红实红（探针 5 条 / 2 条 FAIL） | `…/negative/{M3-no-crossline-probe.log,M4-old-vctx-probe.log}` |
| W-6 | 范围与零 diff | `git status` 非 wiki 改动 = **恰 §12.1 十文件**；生产 `src/**` diff = **0 行**；`baselines.json` diff = `+9/−3`（3 hunk）；`gates.mjs` diff（对 BASE）= `+606/−28`（本轮增量 = §9.2(a)(b)(c)(e) + 探针） | 本会话实跑 |

### 9.5 不得回退面核对

| 钉死面 | 本轮状态 |
|---|---|
| T-2 允许清单（5 行级 + 2 文件级）、G11 空集、G12 四文件白名单 | **零增删**（`G10_LINE_ALLOW`/`G10_FILE_ALLOW`/`FORBIDDEN_API_ALLOW`/`FACILITY_ALLOW` 未触） |
| G10 R0 扫描面 + 设施目录排除（I-2 联动） | 原样（`listScanRoots` 未改；G12 实跑 PASS） |
| N-6 三形态钉死内容 | **原样**（重取日志三形态逐字命中；cast/跨行形只进自检探针与注入证据） |
| 类 6「红」语义与编号、seam 自校验、全量命中清单输出 | 原样（seam 2/2、289 条全量输出、`cat 6` 恒空判定） |
| 十文件闭合 ALLOW、零生产 diff | 原样（§9.4 W-6） |
| E1–E7/E4a runner 编辑点、T-1a 计账、B-1…B-5 台账 | 原样（本轮未触 `run-baseline.mjs`；矩阵 41/41 复证） |
| `baselines.json` 的 `base` 重钉与 suites 注册语义 | 原样（最小 diff 还原只去噪，语义 `JSON.parse` 全等） |

### 9.6 设计 §16.3 调用方影响矩阵成段核对（SA4-4 闭合）

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 本实现证据 |
|---|---|---|---|---|
| `run-baseline.mjs` 使用者（CI/人工验收） | `--all` 输出 `3×6+3+1+1` 行 | 41 行（新 suite 三基线 + root-test 台账判定） | **命令行接口零变化**；输出行数/字段按 §7.4/§7.5 扩展 | 矩阵 41 行（§9.4 W-2）；`--fault`/`--baseline`/`--suite`/`--matrix` 语义未变（本轮未触 runner；N-1/N-2 于 iteration 1 实跑留证） |
| `gates.mjs` 使用者 | 9 gates | 12 gates + 基座重钉 | **调用方式零变化**（`node gates.mjs`；唯一另参 `--write-surface-snapshot` 保留） | 12/12 PASS（§9.4 W-1/W-2） |
| 根 `pnpm test` / root-test cell | 收集 `packages|apps/*/test/**/*.test.ts` | 新文件被收集且**默认布局必须绿**（D-7），root-test 失败数不增 | **无**（新测试自带 per-test timeout 与 env 条件断言） | 矩阵 root-test cell `failedTestNames=32 == 冻结台账`、`failedUnexpected=[]`、`disclosure` 五键在场；V-8 默认布局聚焦 |
| #470 证据可复现性 | 旧 matrix JSON 在 `.cache`（运行期） | 重跑得超集矩阵；旧 #470 cell 语义不变 | **无** | 41 行全 pass（含 6 个 #470 既有 suite ×3）；`unit-union` 69 |
| 生产代码调用方（hub/peer/sessionhost 装配方） | — | **零变化**（零生产 diff） | **无** | 生产 `src/**` diff = 0 行（G2/G3/G4/G7/G8 机械承载） |

### 9.7 未闭合项与明示理由

1. **SA4-3 两处测试侧装饰性断言保留**（lifecycle `:584`、timers `:493`），理由见 §9.2(h)：本轮遵守「只涉及 `gates.mjs`」的窄面约束，且不降低判定强度。
2. **本轮未新增任何允许清单条目、未改扫描面、未改 N-6 钉死内容、未动 G11/G12、未动 `run-baseline.mjs`**；`cat_*` 相对 I-1@rev2.1 的差异仍**恰为** SA8 已裁定批准的 4 条新增文件命中。
3. **A8-4 披露维持不回退**（§8-2 表述禁令照旧）：root-test 行按冻结台账判绿，账内红 = 4 例 BASE 既有 test-d 红 + 28 例环境红；本票**不得**声称 root-test/CI/既有测试全绿。
4. 设计文本类偏差（`harness.ts:537` 复合行表述、`E1` 「6 文件」笔误等）已由设计 rev 2.1 与 SA8 处理，不属实现侧动作面。


## 10. 已执行命令清单（可复核）

```bash
# 环境
node -v                                    # v24.13.0
git rev-parse HEAD                         # d59a4d141c6c5ac7f267295829157d9570cde36e
pnpm --version                             # 11.28.5（与 packageManager 10.28.2 未对齐 → 28 环境红的成因）
corepack pnpm@10.28.2 --version            # 10.28.2（对齐环境复跑用）

# 默认布局聚焦（新文件必须先可在默认布局运行）
NODE_OPTIONS=--conditions=nomicore-source node node_modules/vitest/vitest.mjs run \
  packages/ws-replication/test/ws-replication-cordis-root-channel.test.ts --passWithNoTests=false   # 29 passed
NODE_OPTIONS=--conditions=nomicore-source node node_modules/vitest/vitest.mjs run \
  packages/ws-replication/test/ws-replication-cordis-root-timers.test.ts --passWithNoTests=false    # 12 passed（×3 无抖动）
NODE_OPTIONS=--conditions=nomicore-source node node_modules/vitest/vitest.mjs run \
  packages/ws-replication/test/ws-replication-cordis-baseline-lifecycle.test.ts --passWithNoTests=false # 24 passed
NODE_OPTIONS=--conditions=nomicore-source node node_modules/vitest/vitest.mjs run \
  packages/dsh-persistence/test/dsh-profile-direct-apply-order.test.ts \
  apps/yjs-server/test/third-party-timer-ownership-red.test.ts --passWithNoTests=false              # 6 passed

# 受影响 project 的 typecheck
node node_modules/typescript/bin/tsc -p packages/ws-replication/tsconfig.json --noEmit   # exit 0
node node_modules/typescript/bin/tsc -p apps/yjs-server/tsconfig.json --noEmit           # exit 0
node node_modules/typescript/bin/tsc -p packages/dsh-persistence/tsconfig.json --noEmit  # exit 0

# 机械门禁（G10 rev 2.1 首落地 + G8 收敛）
node packages/persistence/test/fixtures/cordis-baselines/gates.mjs                       # 12/12 PASS

# 负控 N-1 / N-2（逐 suite cells[] 判据）
node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs \
  --baseline B3 --suite provenance --suite root-probe --suite ws-cordis-channel --fault substitute-npm   # cells 3/3 fail, outer 0
node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs \
  --baseline B3 --suite root-probe --suite ws-cordis-channel --fault legacy-shim                        # cells 2/2 fail, outer 0

# 变异 M-1 / M-2（仅 .cache workspace 副本，逐字节还原）
node .cache/mutations/run-mutations.mjs                                                  # 3 baselines × M-1/M-2；restore sameAsHead=true

# Step 0 BASE 台账捕获（干净副本）+ 对齐环境披露复跑
git worktree add --detach .cache/root-test-base-wt d59a4d1
(cd .cache/root-test-base-wt && NODE_OPTIONS=--conditions=nomicore-source node node_modules/vitest/vitest.mjs run --typecheck --reporter=default --reporter=json --outputFile.json=<…>/base-root-test.vitest.json)   # 32 failed
node .cache/cordis-baselines/evidence/root-test-base/build-ledger.mjs                    # knownRed=4 environmentRed=28 problems=[]
(cd .cache/root-test-base-wt && PATH=<…>/.cache/pnpm-shim:$PATH … --typecheck … --outputFile.json=<…>/base-root-test-aligned.vitest.json)  # 4 failed（仅 knownRed）

# 三基线矩阵（最终判定）
node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs --all --matrix   # MATRIX PASS: 41 cells，exit 0

# ---- iteration 2（SA4/SA8 实现级评审闭合）----
# 修复前/后 G10 全量对账（记录级逐字节相同）
node packages/persistence/test/fixtures/cordis-baselines/gates.mjs > .cache/gates-final.log   # 12/12 PASS
diff <(grep -E '^  (packages|apps|domains)' .cache/gates-before.log) \
     <(grep -E '^  (packages|apps|domains)' .cache/gates-final.log)                          # 空 ⇒ 零分类迁移
node .cache/m4-alignment/base-subset.mjs .cache/gates-final.log                              # BASE=285 (19/13/7/4/196/46/0) + 新文件 4
node .cache/m4-alignment/probe2.mjs                                                          # 交叉算法复算 oldHits=55 newHits=55 deltas=0

# 自证伪注入（不入库；用后删除并核对 git status）
#   1) N-6 三形态 + G11（钉死样本原样）⇒ G10 cat_6=3 / G11 / G2 红，exit 1
#   2) 跨行实参 Reflect.get(\n ctx,\n 'root',\n) ⇒ G10 cat_6=1 [M4 (callee=Reflect.get)]，exit 1
#   3) 跨行空链 (channel)\n('root') ⇒ G10 cat_6=1 [M4 (callee=UNRESOLVED-CROSSLINE)]，exit 1
#   证据：.cache/cordis-baselines/evidence/negative/{N6-gates-final,N6-crossline-gates,N6-crossline-blank-gates}.log
# 变异自证伪（.cache 副本，不改工作树）
node .cache/m4-alignment/gates-no-crossline.mjs    # M-3：跨行判据回退 ⇒ 5 条跨行探针 FAIL
node .cache/m4-alignment/gates-old-vctx.mjs        # M-4：inVctx 回退 ⇒ ACtx/$ctx 两探针 FAIL
```

## 11. Suggested commit message（仅供 Controller 选择）

```
test(ws-replication): #471 three-baseline Hub/Peer/SessionHost acceptance matrix

- new suite registration + 41-row matrix (ws-cordis-channel/timers/lifecycle,
  guard-proxy six-file, composition-root, ws-package on all baselines)
- real baseline TimerService behaviour evidence: A1-1…A1-7 channel shapes,
  12 timer families (A1-8; bulk/assembly fed by a real kind=2 chunked SYNC_STEP2),
  23-unit lifecycle matrix (+coverage), β/γ rounds
- AC3/AC4 ownership: ordered teardown, no wait cycle, timer last-release,
  direct-apply DSH profile dispose order
- gates: G10 legacy-root zero-residue (rev 2.1), G11 forbidden API, G12 facility
  allowlist, G8 full-src scan with the two pinned app-config env lines
- G10 M4 cross-line argument attribution (I-1③ fail-closed: an unattributable
  `'root'` argument is class 6, never a silent non-candidate) + V_ctx suffix
  boundary aligned to the pinned word list + self-check table 12→16 rows with
  8 multi-line M4 probes
- root-test known-red ledger frozen to the Step 0 BASE capture (4 test-d + 28
  environment reds; failedUnexpected empty; aligned-env disclosure recorded)

Verification: matrix 41/41 PASS; typecheck 3x15/15; gates 12/12 (16/16 samples,
18/18 cast probes, 8/8 cross-line probes, class 6 empty); N-1/N-2 red on
every target cell; M-1/M-2 red on the new channel suite while ws-package stays
66/66 (gap proof), byte-exact seam restore; cross-line / N-6 injections red on
G10 with zero reconciliation drift (BASE subset 285 records unchanged).

Zero production src diff: packages/*/src, apps/*/src, domains/*/src untouched.
```
