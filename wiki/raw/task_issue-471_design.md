# SA1 实现设计 — issue #471：Cordis rc.12 Hub/Peer/SessionHost 全链兼容（验收能力扩展）

状态：**定向修订版（iteration 3）**——iter 1/2 已闭合项（SA2 F-1/F-3/F-4/F-6/F-7/F-8、F-5r；E-增补授权、十文件闭合 ALLOW、B-1…B-5、T-1a/T-2/T-3/T-4）与 SA8 iter-2 §13 追认面（X-1 暂停解除、§9.2 rev 2 为新钉死值、实现义务 I-1/I-2/I-3）**全部维持不回退**；本轮按 SA2 iter-2 §18（verdict=reject，唯一阻断 = **F-9** MAJOR：干跑取证脚本与 §9.2 rev 2 规范文的可证差异）做第三轮**窄面机械修订**——修 `.cache/issue471-g10-dryrun/scan.mjs` 三处保真缺陷（cast 括接收者 `inner[1]`→`inner[0]`、`inVctx` 去 `/i`、`commentSpan` 补 `*`/`/*` 注释行）、复跑两 pass 并逐项解释计数 delta、按修后机械语义改写 §9.2 自检表两行、回归自检补 cast 形断言、吸收 I-1/I-2/I-3，映射见 §17.3；G10 语义基线仍是 §9.2 rev 2（SA8 §13.5 钉死值），本轮仅对齐取证脚本与自检表述、**不动候选集/分类表/扫描面/允许清单/N-6 三形态**；本轮 delta 触碰钉死值的取证与自检表述面，须回 SA8 增量追认后做 SA2 定向复审（§18）
设计基线：worktree HEAD `d59a4d141c6c5ac7f267295829157d9570cde36e`（与 Issue `## Parent` PR #469 head 一致；已 `git rev-parse HEAD` 核对）
规范来源：**SA6 验收契约 `wiki/raw/task_issue-471_sa6_acceptance_contract.md`（approve）**——本设计的全部判据（AC1–AC9、§12 可观测断言、§13 冻结面、§14 三基线口径、§18.2 S1–S3、§6.2 负控）以该契约为准；**SA8 冲突报告 §9 为本票约束性裁决（§9.1 十文件 ALLOW/DENY、§9.2 T-1…T-4、B-1…B-5、§9.3 十二条交付条件）——本设计与该报告不一致之处，以 SA8 报告为准**；该报告 **iter-2 §13 为当前结论**（X-1 追认解除暂停、§9.2 rev 2 为 §13.5 新钉死值、T-1a 钉死语义、E-增补授权、I-1/I-2/I-3 实现义务；iter-0 §1–§11 与 iter-1 §12 除其明示增补外继续有效），本轮按其逐字吸收。本设计不另立验收标准。
写面：**仅本文件**。本会话零改动 `packages/**`、`apps/**`、`docs/**`、`artifacts/**`、根清单。

---

## 1. 任务类型、目标与非目标

- **任务类型**：feature（**验收能力**：三基线行为矩阵 + 验收设施扩展），承接 SA6 §1。**不是 bug 票**——生产 seam 在三基线实测已工作（SA6 §5.1 探针 P1–P6，10/10 × 3）。
- **目标**：
  1. 判定并锁定生产岸改动面（本设计判定：**零生产代码改动**，见 §5）；
  2. 把 #470 的工件验真设施（单点 acquire/runner/probe/gates）扩展出 Replication 行为面：新 suite 注册、`NEW_FILES`、`--all --matrix` cell、证据 JSON 契约（AC7，不建第二套）；
  3. 交付 3 基线 × 3 入口 × 7 场景 = 63 单元 + β/γ 补充单元的可执行行为矩阵（AC2），A1-1…A1-8 通道/定时器族断言（AC1），A5-1 零残留 gate（AC5），组合根拆卸序与 Timer 所有权断言（AC3/AC4）；
  4. 负控与变异反证（SA6 §6.2 四项 + 双挂 provide）证明测试可证伪；
  5. 给出闭合 ALLOW/DENY、TDD 红灯计划、AC→证据矩阵、S1–S5 追认结果（SA8 已裁决，§15）。
- **非目标**：不改任何生产 `src/**`；不新增基线；不改 ADR/artifacts/依赖面；不修 4 个既有 test-d 红（仅披露，A8-4）；不修 28 个 #470 记录的环境红（仅披露）；不建立第二套工件验真机制；不做真实 MABF/DSH 部署或 patch 移除（ADR 0035 §6）。

---

## 2. 输入与 Owner 要求落实

| 输入 | 状态 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-471.md` | 已读 | Issue 正文 9 条 AC（L21–L29）、`Parent: PR #469`、`Blocked by: #470`（已因 PR #473 合并解除）、`## Comments` **空** |
| `wiki/raw/task_issue-471_dispatch.md` | 已读 | Round 1；base `d59a4d1`；本轮评论 `[]` |
| `wiki/raw/task_issue-471_sa6_acceptance_contract.md` | 已读（规范来源） | §5.1/§5.2/§9/§12/§13/§14/§18 |
| `wiki/raw/task_issue-471_sa2_review.md` | 已读（评审输入；iter-2 verdict=reject，唯一阻断 F-9） | Round 1 §14 F-1…F-7 逐条闭合（§17）；iter-1 §17（F-8/F-5r）逐条闭合（§17.2）；iter-2 §18（**F-9** MAJOR——干跑脚本保真度 + 自检表两行）按其 §18.5 Required change (1)–(4) 逐条落实（§17.3）；§15/§17.5/§18.6 非阻塞观察逐条表态（§17.1/§17.3 注） |
| `wiki/raw/task_issue-471_design_conflict_report.md` | 已读（约束性裁决；iter-0 clear + iter-1 reject + **iter-2 clear（§13 为当前结论）**） | §9.1 十文件闭合 ALLOW（台账转正）、§9.2 T-1…T-4、§3 B-1…B-5、§9.3 十二条交付条件全部吸收（§4.1、§7、§12、§13、§15）；iter-1 §12（T-1a/X-1/§12.8/E-增补授权）逐字吸收（§4.1、§7.2 E5、§8.1、§9.2 rev 2、§11 N-1、§13.2、§17.2）；**iter-2 §13（X-1 追认解除暂停、§9.2 rev 2 = §13.5 新钉死值、实现义务 I-1/I-2/I-3）逐字吸收（§4.1、§7.3、§9.2 rev 2.1、§11、§13.2、§17.3）** |
| `wiki/raw/task_issue-471_relevant_decisions.md` | 不存在 | 无独立相关决议件需合并；上游决议面 = #470 R1–R9（经 SA6 §3 分类 + 本票 SA8 §2 逐条复核）|
| 源码/设施实读 | 本会话（iter 0）+ 修订会话（iter 1/2） | iter 0：`plugin.ts:200–298`（seam）、`run-baseline.mjs`（全 870 行）、`gates.mjs`（全 423 行）、`baselines.json`、`vitest.config.ts`、根 `package.json` typecheck（15 project）、4 具名 fixture、`third-party-composition-red.test.ts`、`issue270-regression-anchors.test.ts:99–142`、`cordis-root-real-timer.test.ts:52–100`（插桩纪律）、`dsh-persistence/src/profile.ts:43–109`（直接 apply dispose 序）。iter 1 复读：`run-baseline.mjs` fault 链路（通用分支 `:540–548` 无 `extraEnv` / root-probe 分支 `:584` 注入 / `runFault :739–769` 外层语义 / `baseCell :485–498` / root-test `diagnostics :729–733`）、`gates.mjs` `changedPaths/assertNoChange/assertAllowlist`（`:109–139`）与 G6（`:372` 无基座）、3 处既有双读行（`ws-replication-plugin.test.ts:19`、`issue299-ac-red:171`、`issue422-listen-false:39`）与 seam 内 `'root'` 实参形态（`service.ts:86`、`plugin.ts:251`）、`hub-edge.ts:356/363–364`（reauth deadline 载体 = `closeTimeoutMs`）、`hub-connection.ts:174–183`（auth 封顶复用 `helloTimeoutMs`）、`hub-namespace.ts:1049–1050`（`armTimer('assembly')`）、`plugin.ts:761`（waitForLive 固定 25ms）、`cordis-root-channel.test.ts:445–475`（legacy-shim F9 纪律）、`ws-replication-issue246-interop-matrix` / `issue418-{contract,structure}` / `issue420-session-host-round` 在盘核实。**iter 2（F-8/X-1 取证）**：`root-probe.mjs:95–144`（`:104/:124/:134` 三处 `Reflect.get(ctx,'root')` 双读 + `:119` `Context.root` 静态观察——探针本体命中形态逐行核实）；域数据 root 族第一手：`registry.ts:711 record.root`/`:1472 payload.root`/`:1506 p.root`、`vfsl/src/schemasource.ts:139/:173 scanDomains(this.root)`、`doc-runtime/src/create-initial-document.ts:150/:154/:178 input.root`、`apps/yjs-server/src/app.ts:384 entry.root`/`:864/:880 args.root`、`namespace-api/src/request-body.ts:131 hasOwnProperty.call(record,'root')`/`:139 record['root']`、`namespace-runtime/src/schema-write.ts:383 (snap as …)['root']`、`create-namespace.ts:292 validationProblemResponse(…,'root',…)`、Cordis 面核查（上述域文件零 `@deepseek-ai/cordis`/`TimerService`/`Context` 标记；`app.ts` 8 处标记；两 seam 文件均 `import type { Context } from '@deepseek-ai/cordis'`）；**全仓干跑扫描**（`.cache/issue471-g10-dryrun/`，§9.2 rev 2：732 文件、285 条命中全量分类、第 6 类恰 0）；**iter 3（F-9 对齐）**：修后脚本复跑两 pass（计数对账与 delta 逐项解释见 §9.2 rev 2.1 取证节）+ cast/注释行/大小写探针 17 条全 PASS（`.cache/issue471-g10-dryrun/cast-probe.mjs`，辅助函数逐字复制自修后脚本——与 SA2 §18.0 探针同法，未在 `packages/`/`apps/` 内建任何文件） |

### Owner要求落实

| Comment ID | Updated at | Requirement | Design section |
|---|---|---|---|
| （无） | — | Issue #471 无任何评论（SA6 §2 实跑 `gh api …/comments` → `[]`；dispatch 台账同） | 需求面 = Issue 正文 9 条 AC + ADR 0035；逐条落 §14 AC→证据矩阵 |

---

## 3. 复现和根因承接

| 上游事实（SA6 契约） | 证据位置 | 设计响应 |
|---|---|---|
| 生产 seam `tryResolveRootTimer`/`timerFromContext`（`plugin.ts:200–298`）三基线实测可用（P1–P6，10/10 × 3） | SA6 §5.1、§9.1 | **零生产代码改动**（§5）；`plugin.ts` 入 DENY |
| 真实缺口在验收岸：G1（无三基线行为矩阵）、G2（legacy 通道零覆盖）、G3（真实 TimerService × replication 零交叉）、G4（timer 族 12 类无证据）、G5（两跳级联无测试）、G6（第三方组合根未进矩阵）、G7（拆卸序/所有权无三基线断言）、G8（NEW_FILES/suites 白名单是硬门） | SA6 §5.2、§8 | 逐缺口 → 新测试文件/suite/gate（§7–§11、§14） |
| 变异 M-1/M-2 证明现有 4 fixture 对通道回归零判别力（66/66 仍绿），探针定向红 2/10 | SA6 §9.4 | 新通道测试必须复现该判别力（§11.3）；4 fixture 不改写（SA6 §10.3） |
| `run-baseline.mjs` 现状：`NEW_FILES`（:67–79）是 materialize 白名单、`BASELINE_SUITES = MANIFEST.suites`（:50）、unknown suite `fail('usage')`（:138–140）、`--all` 只把 `ws-package` 挂 B1（:809） | 本会话实读 | 精确 diff 边界（§7.2）；S1 升级（ws-package 三基线必绿） |
| Cordis `ctx.provide`：「Throws if the name is already provided in this scope」（B1 4.0.1 与 B3 rc.12 的 `lib/types/reflect.d.ts` 同语义，本会话实读 overlay） | `.cache/cordis-baselines/overlay/{B1,B3}/…/reflect.d.ts:33–35` | AC2 重挂载负控「双挂 provide 响亮失败」有基线原生语义可观察（§11.5） |
| 直接 apply profile 的 dispose 序 =「adapter 先、Cordis fiber 后，幂等」（`await persistence.dispose(); await ctx.fiber.dispose()`） | `packages/dsh-persistence/src/profile.ts:43–49,98–109` | A4-4 断言锚点（§10.4） |
| 4 个既有 test-d 红 + #470 的 28 环境红 | SA6 §15.2、A8-4 | 如实披露机制（S4 已知红台账，§13/§16-R6） |

## 4. SA8约束落实（#470 R1–R9 经 SA6 §3 分类账本）

| 决议或义务 | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|
| R1 全仓 typecheck = 根 `scripts.typecheck` 15-project 动态解析、逐基线全绿 | §7.2（typecheck cell 原样）、§13、§14 AC8 | 原样沿用；本会话核对根 `package.json:13` 恰 15 project | 否 |
| R2 ws 改动面「plugin.ts + 恰好 4 fixture」 | §12（ALLOW/DENY） | **本票扩展**：plugin.ts 升为零 diff（DENY），新增 6 测试文件 → **SA8 已追认（S2，§3.2）** | 是（实现后按 §9.1 十文件核对，T-1/T-2） |
| R3「ws 不做三基线行为矩阵」 | §7.2、§15 S1 | **显式取代**：本票即 R3 预留的后续票；owner 锚点 Issue L22/L28 + ADR 0035 §5 L92；**SA8 §2.1 裁定取代合法** | 是（S1 实现核对，B-1） |
| R4 seam 形态（symbol 优先/legacy 兜底/同步 loud fail/无 ambient/包内私有/cast 不扩散/生命周期不变） | §5、§9（A1-1…A1-7 断言） | 形态逐条落断言，**代码零改动**；本会话实读 `plugin.ts:244–298` 复核两跳级联与 null 宿主语义与 R4 一致 | 否 |
| R5 B3 provenance 8 项 | §7.2（provenance suite 原样） | 原样复用，零重写 | 否 |
| R6「owner checkbox 恒 8 条 + derived AC9」 | §14 | 仅对 #470 有效；本票 9 条 AC 账本 | 否 |
| R7 机械 gate（ws diff allowlist、`src/index.ts` 零 diff、公共面快照、manifest/lock/artifacts gate） | §7.3（G1′/G3/G4/G5 更新） | allowlist 按本票更新 + BASE 重钉（S5，**SA8 已追认**，B-4/B-5）；`index.ts`/manifest/lock/artifacts 零 diff 保留 | 是（gates 首落地核对，T-2） |
| R8 ADR 0023 冻结面（accessor+freeze 构造、guard-Proxy 断言面） | §7.2 `guard-proxy` suite（AC6/AC8-②④） | 原样继承并扩到 clock/registry/sessionhost 四处同纪律 | 否 |
| R9 无阻塞性 Host/owner 问题 | §16 | 本票同样无阻塞 | 否 |

### 4.1 SA8（本票）约束性裁决落实（`task_issue-471_design_conflict_report.md` §9；不一致处以该报告为准）

| 裁决条款 | 内容 | 设计位置 | 落实方式 |
|---|---|---|---|
| §9.1 十文件闭合 ALLOW | 台账文件由「条件」**转正**为第 10 个无条件 ALLOW 文件；DENY = 十文件之外全部路径（闭合世界条款） | §12.1 | 「9+1 条件」改「10 文件无条件」；§12.2 注记闭合世界条款 |
| §3.1 **B-1**（S1 绑定） | 升级后 #470「B2/B3 仅附加证据」语义在本票全部失效；任何交付叙述不得回退 B1-only 口径 | §15 S1 行、§13.2 | 绿灯判据与交付叙述按三基线必绿收口 |
| §3.3 **B-2**（S3 绑定） | 禁止把 fixture 复制进 ws/app 包；测试不得硬编码 `.cache` 绝对/相对路径（只读 runner 注入 env） | §15 S3 行、§7.2 零改动面 | `cellEnv` 既有 env 面零新增，测试不自解析 `.cache` |
| §3.4 **B-3a…B-3e**（S4 绑定） | 台账来源冻结于 Step 0 BASE 捕获、逐条映射 #470 裁定红集（4+28 带归因）、实现/验证期**不得新增条目**；判定为完整测试名集合级 `failedTestNames ⊆ (knownRed ∪ environmentRed)`（禁计数级近似），failedTestNames 提取须覆盖 test-d lane（Step 0 捕获时 4 例 test-d 必须实际出现——台账机制自身负控）；新文件失败永不可入账；cell 恒携带 `failedUnexpected[]`+`disclosure`；`--all` 聚合语义不变（任一 gating cell 红 ⇒ exit≠0） | §13.0 Step 0、§13.2、§16-R6 | 判定谓词、提取核证、披露义务全部落绿灯判据；否决回退案 = root-test 不 gating + 披露（不得回退无条件 gating、不得环境 shim） |
| §3.5 **B-4**（S5 绑定） | A6-4 点名文件（`issue246-interop-matrix`、`issue418-*` 结构守卫）**必须取得三基线 cell 证据**；默认布局留证只可用于契约未点名面的补充，不得作为 A6-4 替代；文件归置可在 §12.1 ALLOW 内微调，**判据不可变** | §7.4、§14 AC6 行 | F-3 修订：两结构守卫 + interop matrix 钉进 `guard-proxy` suite 六文件清单（E1 常量）；「默认布局留证」兜底全删 |
| §3.5 **B-5**（S5 绑定） | `public-surface.base.json` 内容不变主张由实现期 G5 实跑核证；若需重拍，仅允许基座元数据差异，导出名集合差异 = AC6 红 | §7.3 G5 行 | G5 行增补核证判据 |
| §9.2 **T-1** + iter-1 **T-1a** | T-1：E5 `units={expected:23,…}`、repeat 计数、suite→文件清单、pass 谓词（counts.failed===0 ∧ 目标测试名在场 ∧ units.observed===23）为钉死语义；实现 diff 只准表达 §7.2/§7.3 编辑点；行为锚点独立于 runner（lifecycle 文件内自检单元在测试文件里，runner 改不动）。**T-1a（iter-1 §12.2 项 2 四款，逐字吸收）**：(1) 每基线**枚举清单**恰 23 名（21 个 `L.<entry>.<scenario>` + `L.edge-beta.minimal-round` + `L.async-gamma.minimal-round`），`observed` = 清单内「在场且 passed」去重计数，`missing` = 清单 − 在场，pass 仍要求 `observed===23`；(2) 自检单元**不计入 units**——本设计定为 **`coverage`（非 `L.` 前缀名，§8.1 显式）**，但必须在 testNames 在场且 passed；(3) **fail-closed**：出现「清单 ∪ {自检名}」之外的任何 `L.` 段名 ⇒ cell 判红，禁止静默丢弃；(4) 三基线全名并集恰 69，自检不计入 | §7.2 E4/E5、§8.1、§13.2 | edit point 清单即钉死边界；E5 归类改按 23 名钉死枚举（F-5r 闭合）；自检名由 `L.coverage` 改 **`coverage`**（T-1a-2 授权二选一，显式写明） |
| §9.2 **T-2** + iter-1 项 3 追认 | gates 自我豁免反制：裁决层 ALLOW/DENY 优先于 gates 机械承载；G12 使 gates.mjs 自身 diff 面小且可逐行审；G10 允许清单（**2 seam 行级 + 3 fixture 双读行级 + 恰 2 个文件级通道探针许可**——iter-1 §12.2 项 3 具名化追认值，全仓文件级许可恰此两文件不得再扩）与 G11 允许清单（空集）为钉死值 | §7.3、§9.2、§12 | G10 允许清单按 §9.2 rev 2 **零增删**落地；`root-probe.mjs` 的定位在扫描面排除条款内合法解决（§9.2 R0，不新增任何清单条目）；G10 候选/分类**算法**为 rev 2（X-1）——**SA8 iter-2 §13 已追认为钉死值、暂停解除**（rev 2.1 仅取证对齐，见 §17.3） |
| §9.2 **T-3** | 台账新增豁免封堵 = B-3a/c；G12 把台账文件纳入设施白名单使后续改动可机械检出 | §7.3 G12、§13 | 台账入 G12 白名单 |
| §9.2 **T-4** | N-6（G10/G11 注入定向红）与 B-3b（4 例 test-d 出现于 failedTestNames）是机制自身可证伪性证明，实现阶段必须实跑留证 | §11 N-6、§13.0 | N-6 样本扩为三种注入形态（F-2） |
| **iter-2 §13**（X-1 追认 + §13.5 钉死 + **I-1/I-2/I-3** 实现义务） | §12.8-1 (a)–(e) 五款逐款 clear ⇒ X-1 暂停解除、**§9.2 rev 2 语义整体为新钉死值**（R0 扫描面/R1 四形态与词表/R2 分类表/两类自证伪/回归自检表/通过判定；任何增删须回 SA8）；I-1 = G10 落地**以设计文本为准**（①cast 括接收者取括内首个标识符 + 不可解析 fail-closed ⇒ 类 6；②V_ctx 后缀大小写敏感 `ctx`/`Ctx`；③M4 跨行实参位/被调点链空白——或记不可解析 fail-closed；BASE 首跑与干跑对账、记录级 token 差异逐项解释、超出即回 SA8）；I-2 = G10–G12 联动钉死（G12 弱化 ⇒ G10 扫描面失效 ⇒ 回 SA8，不得以「G10 已过」先行放宽）；I-3 = 回归自检断言绑**类 + 判别 token** | §9.2（rev 2.1：钉死句 + 自检表 + 对账基线）、§7.3 G10/G12 行、§13.2、§11 N-6 注 | I-1 ①② 落 §9.2 钉死句与词表（原文已钉死大小写敏感）、③ 落 §9.2 M4 形态、对账基线随 F-9 修复更新为 rev 2.1 值并逐项列 delta；I-2 落 §9.2 R0 联动句 + §7.3 G12；I-3 落 §9.2 自检表（intro 句 + 逐行 token；`:383` 行 token 修正为 `snap`、`:548` 行补 `input2` 锚点） | **是**——本轮 F-9 修订使两处记录 token 由 `undefined` 修正、两处 `*` 引导注释行 3→5、自检表增行，属 §13.5 钉死值的取证/自检表述面修订，随本回 SA8 增量追认（§18） |
| §9.3 十二条交付条件 | 零生产 diff ⊆ 十文件、gates 12/12、三基线 15/15、矩阵 41 行、A1 三基线全绿、N-1…N-6 应红实红、4 fixture 零字节不动且 66/66、台账合规（B-3a…e）、新测试默认布局必绿、反向闸门执行记录、AC9 全机械面、交付摘要按 §13.2 + A8-4 + 调用方矩阵闭合 | §13.2 | 绿灯判据与 §9.3 逐条对齐（§13.2 注记） |

---

## 5. 生产岸判定：**零生产代码改动**（dispatch 项 1）

**判定：本票不需要任何生产源码修改。`packages/*/src/**`、`apps/*/src/**`、`domains/*/src/**` 全部零 diff。**

依据（全部为已核实事实，非推断）：

| # | 检查 | 结论 | 证据锚点 |
|---|---|---|---|
| 1 | 三基线真实 `TimerService` 实测 hub/peer/sessionhost 全场景 | 10/10 × 3 pass（P1–P6） | SA6 §5.1、§9.1；探针 `.cache/cordis-baselines/sa6-probe/issue471-probe.test.ts` 可复跑 |
| 2 | A1-3「apply 同步 throw 稳定文案」：`timerFromContext` 在 `apply()` 内同步调用（hub `plugin.ts:513`、peer `:708`），throw 先于任何 await | 满足 | 本会话实读 `plugin.ts:508–514`、`:703–708`、`:224–226` |
| 3 | A1-6 两跳级联：`timer.ctx === undefined` → 级联 plugin `ctx`；`timer.ctx === null` → `tryResolveRootTimer(null)` → `throwRootTimerUnavailable()` 不回落；`timer.ctx = {}`（宿主在场、通道双缺席）→ 级联 | 满足 | `plugin.ts:269–271`、`:247`（F5 非对象宿主即畸形） |
| 4 | A1-1/A1-4 优先级/双缺席、A1-5 timer 服务文案 | 满足 | `plugin.ts:248–263`；P5 探针三基线 |
| 5 | 唯一 Cordis 面 = `plugin.ts`（type-only import :1、`declare module` :169、三处有序 effect :584/:675/:783）；cast 不扩散 | 满足 | SA6 §10.1；本会话实读 |
| 6 | 全部缺口 G1–G8 均为「证据/设施」缺口，非「产品行为」缺口 | 满足 | SA6 §5.2 诚实边界 |

**不设「最小缺陷修正」清单**：未发现任何必须改生产代码的缺陷。因此 SA6 §18.2 S2 建议中的「`ws-replication/src/plugin.ts`（如需修缺陷时才允许）」在本设计里**收紧为 DENY**——比 SA6 建议更严，不存在放宽风险。

**反向闸门（单一出口路径，§5/§15-S2/§16 三处表述一致——F-4 修订）**：若实现/验证阶段任一矩阵 cell 因**生产行为**判红（区别于测试自身缺陷或环境红），实现者**不得**就地修 `src/**`；唯一出口 = ①停在该 cell、②留存红证据（cell JSON + log）、③上报 Controller。Controller 处置走 **§15 S2 预授权快速通道**：按 SA6 §18.2 S2 原文（「`ws-replication/src/plugin.ts`（如需修缺陷时才允许）」）直接修订本票 ALLOW（把对应缺陷文件移出零 diff 面）、在 §5 增补缺陷条目（缺陷、证据、最小改动点、为何不可留在验收岸）后派发修复——**不要求重跑完整诊断轮**。修复 diff 回到同一验收面（A1 断言 + 重钉后的 gates + 该 cell 复跑绿）才算闭合。该闸门是回退边界的一部分（§16.4 同口径）。

---

## 6. 设计总览与关键决策

### 6.1 决策表（含主要备选与不选原因）

| # | 决策 | 备选 | 不选原因 |
|---|---|---|---|
| D-1 | **零生产代码改动**（§5） | 顺手加固 seam | 无缺陷依据；任何 src diff 都违反本票「Host 装配、公共 API 与生命周期所有权保持不变」叙事与 AC6 冻结面 |
| D-2 | **6 个新测试文件 + 1 个测试内 helper**（§7.1），全部经既有 runner 注册执行 | 在 ws 包内自建 mini-runner | 直接违反 AC7（第二套验真机制，SA6 §8 放大因素） |
| D-3 | suite 架构：`baselines.json.suites` **追加** 6 个 suite（ws-package 提升 + guard-proxy + ws-cordis-channel + ws-cordis-timers + replication-lifecycle + composition-root），`unload` 扩为文件数组（补 registry-sa7-cordis，AC8-2①） | 单一大 suite 或逐文件 suite | 单一大 suite 无法按 AC8-2 ①–⑥ 分列留证与差异定位；逐文件 suite 使 matrix 膨胀且 repeat 语义碎片化 |
| D-4 | repeat 口径：`ws-cordis-timers`、`replication-lifecycle` repeat=3（沿用 #470 real-timer 口径），channel/guard-proxy/composition-root/ws-package repeat=1 | 全 suite repeat=3 | 组合根集成测试含 15–40s 有界停机，×3×3 基线将使 `--all` 无界化（SA6 §7 要求避免无界运行）；时序敏感面恰是 timer 族 |
| D-5 | gates 比较基座 **BASE 重钉 `279dba4` → `d59a4d1`**（S5）：allowlist 精确表达本票改动面，且能侦测对 #470 已交付面的回改/回退 | 保留 279dba4 + 扩 allowlist | 旧基座下「回退 #470 的 plugin.ts 改动」会使 diff 变空而 gate 仍绿——防回退盲区 |
| D-6 | root-test cell：**运行并留证但按「已知红台账」判定**（S4）：`failedTestNames ⊆ knownRed` 才 pass，新增红仍 gate | (a) 照旧 gating（matrix 永红）；(b) 整体排除不判定 | (a) 无法收口；(b) 丧失对新红的回归灵敏度；台账法满足 A8-4「如实披露」且不静默 |
| D-7 | 新测试**默认布局也可运行**（不硬性要求 runner env）：行为断言与通道形状基线无关；`NOMICORE_CORDIS_EXPECTED_CHANNEL` 等严格等值断言仅在 `NOMICORE_CORDIS_RUNNER_MODE=1` 下生效；**命名方案统一（F-5）：describe 标签 = `NOMICORE_CORDIS_BASELINE ?? 'default'`（runner 模式即 B1/B2/B3，默认布局即 `default`），测试名 = `L.<entry>.<scenario>`（名内不含基线段），JSON `testNames` 全名 = `<标签> > L.<entry>.<scenario>`** | 硬要求 env | 新文件被根 `vitest.config.ts` glob 收集（§12.0），若默认布局必红会把新红引入 root-test 面，违反「本票不增加红」；且 cell 身份绑定已由 cell JSON 的 `resolvedRealpaths/provenanceDigest/baseline` 承载 |
| D-8 | 通道判别力由**新通道测试**承担；4 具名 fixture **逐字节不动**（A5-3 断言面保留） | 改写 4 fixture 为双通道 | SA6 §10.3 明文「不要求改写……避免削弱既有基线无关性」；改写扩大无收益 diff |
| D-9 | A4-4 用**新文件** `dsh-profile-direct-apply-order.test.ts`；不改 #470 已交付的 `dsh-profile-acceptance.test.ts` | 扩写既有验收文件 | 最小 diff；既有文件是 #470 证据载体 |
| D-10 | 单元完备性用**测试名编码 + runner 回填**（replication-lifecycle cell 增 `units{expected,observed,missing}`，镜像既有 `r5p` 回填先例 `run-baseline.mjs:556–559`） | runner 内建全部矩阵语义 | 保持 runner 通用性；测试名即证据（§12.0「测试名必须出现在 JSON 且 passed」） |

### 6.2 新测试文件清单（dispatch 项 2 之一，精确到文件）

| 文件（新增，untracked） | 承载 | 所属 suite |
|---|---|---|
| `packages/ws-replication/test/ws-replication-cordis-root-channel.test.ts` | A1-1…A1-7、A5-2/A5-4（5 形态宿主 × 三入口 + 级联 + sentinel + 双缺席/malformed/服务缺失） | `ws-cordis-channel` |
| `packages/ws-replication/test/ws-replication-cordis-root-timers.test.ts` | A1-8（12 timer 族，真实 baseline `TimerService`） | `ws-cordis-timers`（repeat 3） |
| `packages/ws-replication/test/ws-replication-cordis-baseline-lifecycle.test.ts` | AC2 3×3×7=21 单元/基线 + β/γ 补充单元 + 重挂载/双挂负控观测点 | `replication-lifecycle`（repeat 3） |
| `packages/ws-replication/test/cordis-baseline-support.ts` | 测试内共享支撑（非 `.test.ts`，不被 glob 收集）：TimerService 插桩 meter、5 形态假宿主工厂、最小装配构造器、谓词轮询 `waitFor`、事件 sink | （被上三者 import） |
| `apps/yjs-server/test/third-party-timer-ownership-red.test.ts` | A3-1/A3-2（第三方装配面）+ A4-1…A4-3 | `composition-root` |
| `packages/dsh-persistence/test/dsh-profile-direct-apply-order.test.ts` | A4-4（直接 apply profile 显式 dispose 序） | `composition-root` |
| `packages/persistence/test/fixtures/cordis-baselines/root-test-known-red.json` | root-test 已知红台账（schemaVersion/ticket/knownRed/environmentRed/notes）——**SA8 §9.1 第 10 项已由条件转正**（S4 追认成立，B-3a…e 绑定，§4.1） | gates + runner 读取 |

命名遵循 SA6 §12.1「命名可变，判据不可变」；上述名称与 SA6 证据载体栏一致。

---

## 7. 验收设施扩展设计（AC7 单点复用；dispatch 项 2）

### 7.1 `baselines.json` 扩展点与 diff 边界

唯一改动：`suites` 数组**尾部追加**（不动既有 6 项的相对顺序，`provenance`、`root-probe` 仍在最前——A7-4 身份先行的承载）：

```jsonc
"suites": ["provenance","root-probe","contract","real-timer","dsh-profile","unload",
           "ws-package","guard-proxy","ws-cordis-channel","ws-cordis-timers",
           "replication-lifecycle","composition-root"]
```

（示意，非实现代码；实现时保持 JSON 语法。）另两处小改：`base` 字段同步重钉为 `d59a4d1…`（S5，文档性字段；本会话核实其唯一类型消费者 `cordis-baseline-provenance.test.ts:39,76` 只用 `.baselines[id]`，不改语义）、`comment` 增记 #471 扩展一句话。**integrity 表 / dshCommit / probes 期望零改动**（A7-1 单点工件表）。

### 7.2 `run-baseline.mjs` 扩展点（逐个 edit point，闭合的 diff 边界）

| # | 位置（现行号） | 改动 |
|---|---|---|
| E1 | 常量区 `:51–64` | 新增 suite 文件清单常量：`WS_CHANNEL_TEST`、`WS_TIMERS_TEST`、`WS_LIFECYCLE_FILES = [ws-replication-cordis-baseline-lifecycle.test.ts, ws-replication-issue420-session-host-round.test.ts]`（**F-3/AC8-③ 钉死**：issue420 场景回合归本 suite）、`GUARD_PROXY_FILES`（**六文件，F-3 钉死**：clock/registry/ws 三 guard-Proxy 消费 + `ws-replication-issue246-interop-matrix.test.ts` + `ws-replication-issue418-edge-session-split-{contract,structure}.test.ts`——AC6-A6-4 结构守卫三基线载体，SA8 B-4）、`APP_COMPOSITION_FILES`（6 文件，§7.4）、`DSH_DIRECT_APPLY_TEST`；`UNLOAD_TEST` → `UNLOAD_FILES = [registry-sa7-rev1.test.ts, registry-sa7-cordis.test.ts]`（AC8-2①「registry plugin/生命周期相关」） |
| E2 | `NEW_FILES :67–79` | 追加 §6.2 全部新文件（含 helper 与台账文件——台账已经 SA8 §9.1 转正，不再条件）；`copyNewFiles` 缺失即 exit 2 的既有语义不变（A7-5） |
| E3 | `parseArgs :138–141` | suite 白名单随 `BASELINE_SUITES` 自动含新名；`'ws-package'` 字面量从附加清单移除（已入 manifest）；**顺手清理 `'gates'` 死字面量**（`:139` 接受但 `runSuite` 无分支、矩阵经 `runGatesCell` 跑——SA2 §15-2 采纳：删除并在白名单表达式留一行注释说明 gates 由 `--all` 承载） |
| E4 | `runSuite :526–564` 通用分支 | 文件选择支持新 suite 名；`ws-cordis-timers`、`replication-lifecycle` `repeat=3`；`unload` 分支改跑 `UNLOAD_FILES` 数组（R5P 回填保留）；通用 cell 增**可选** `diagnostics` 字段（仅环境红排查留痕、不参与 pass 判定——镜像 root-test cell 既有先例 `:729–733`；SA2 §15-4 采纳） |
| **E4a（新，F-1）** | `runSuite` 全部 `runVitest` 调用点（通用分支 `:542`、root-probe 分支 `:581–585` 既有、`ws-package` 分支 `:614`、E4/E5 新分支） | **legacy-shim fault env 全分支贯通**：每处统一 `extraEnv: fault === 'legacy-shim' ? { NOMICORE_CORDIS_FAULT: 'legacy-shim' } : {}`（镜像 `:584` 既有写法；`runVitest` options 已支持 `extraEnv`）。不读该 env 的 suite 收到亦无害（唯一消费者是通道测试）。同时把 N-2 判定从「外层 exit 0 ⇔ 任一内层 fail」升级为「**逐 suite `cells[]` 均 fail**」（§11 N-2）——修掉「root-probe 单独红即可蒙混」的伪证明通道 |
| E5 | `runSuite` 新分支 | `guard-proxy`（**六文件**逐文件留证，同 `ws-package` 模式；interop/418 测试名须在场且 passed——A6-4）、`composition-root`（逐文件）；`replication-lifecycle` 运行后回填 `cell.units = {expected: 23, observed, missing}`。**归类规则（F-5r/T-1a 修订：按 23 名钉死枚举归类，废弃 iter-1 的句法前缀规则——该规则按字面把自检 `L.coverage` 计入致 observed=24≠23 恒红）**：runner 内置枚举常量 `LIFECYCLE_UNITS`（恰 23 名 = 21 个 `L.<entry>.<scenario>`（entry ∈ {hub-listen, peer-dial, session-host} × scenario ∈ {startup, timer-fired, timer-cancelled, explicit-stop, fiber-dispose, service-revoked, remount}）+ `L.edge-beta.minimal-round` + `L.async-gamma.minimal-round`，逐名钉死）；`observed` = `testNames` 全名 `<标签> > <单元名>` 中**单元名 ∈ 枚举 且 该测试 passed** 的去重计数；`missing` = 枚举 − 在场名集。**自检单元 `coverage`（§8.1，非 `L.` 前缀）不计入 units**，但必须在 testNames 在场且 passed（cell 级谓词承载，不进 `units` 字段）。**fail-closed（T-1a-3）**：testNames 出现枚举之外、以 `L.` 起头的任何单元名 ⇒ cell 判红（多写、改名、漂移均红，禁止静默丢弃）；非 `L.` 名（issue420、`coverage`）不计数也不触红。镜像 `:556–559` 的 r5p 回填先例。cell pass 谓词（T-1/T-1a 钉死）= counts.failed===0 ∧ 目标测试名在场 ∧ units.observed===23 ∧ `coverage` 在场且 passed ∧ 无枚举外 `L.` 名 |
| E6 | 主流程 `--all :802–828` | 删除 B1 专属 `ws-package` 块（`:809–811`）——BASELINE_SUITES 已含之，三基线各自跑（S1）；root-test cell 按 S4 台账判定（§13.0，B-3a…e） |
| E7 | 装载时自检（新增 3 行） | `BASELINE_SUITES[0]==='provenance' && BASELINE_SUITES[1]==='root-probe'` 否则 `fail('usage')`——A7-4「provenance → root-probe → 行为 suite」顺序的机械承载 |

**零改动面**（对 runner）：`copyTrackedTree`/`copyNewFiles`/`buildFarm`/`faultOverrides`/`materialize`/`envForWorkspace`/`cellEnv`（A7-3：测试只读既有 `NOMICORE_CORDIS_{RUNNER_MODE,BASELINE,BASELINE_ROOT,TREE_ROOT,EXPECTED_CHANNEL,DSH_CLONE}` env，不新增 env 名，不自行解析 `.cache`——B-2）/`runTypecheckCell`（15-project 动态解析原样，A8-1）/`resolvedRealpaths`/`writeEvidence`。**`runFault`（`:739–769`）编排结构保留**（materialize → 逐 suite cell → payload/exit 语义），但其「原样复用」冻结声明按 F-1 消解：它经 `runSuite` 传导的 env 线路由 E4a 扩展，fault payload 的 `cells[]`（既有字段，逐 suite `status`）成为 N-2 的判定载体；payload 顶层 `observed`（any-fail 聚合）**单独不构成** N-2 通过证据。

### 7.3 `gates.mjs` 扩展点

| # | gate | 改动 |
|---|---|---|
| G1′/G7/G9 | manifest/lock/artifacts、docs/、tsconfig/vitest.config 零 diff | **零改动**（A9-2/A9-3 由此承载；三处 pathspec 下本票零新增 untracked 文件，`assertNoChange` 不自引爆） |
| G6 | `git diff --check` + artifacts 干净 | **一处小改（SA2 §15-1 采纳）**：`git diff --check` → `git diff --check <BASE>`（`:372` 挂基座——#470 SA9 S9-M3 已记为 MINOR 的盲区；本票正在改 gates.mjs，顺手钉上；语义 = 本票 tracked diff（恰 3 个设施文件）不得引入 whitespace error） |
| G2/G3 | src 面守卫（**F-7 修订：判据形状分明**） | **G2 = `assertNoChange`**：`packages/{persistence,dsh-persistence,namespace-registry}/src` 对 `d59a4d1` 零 diff（该三处 src 无本票新文件，untracked 并集无自引爆风险）。**G3 = `assertAllowlist`**：pathspec `packages/ws-replication`，allowed = §6.2 的 **4 个 ws 新测试文件**（`ws-replication-cordis-root-channel.test.ts`、`ws-replication-cordis-root-timers.test.ts`、`ws-replication-cordis-baseline-lifecycle.test.ts`、`cordis-baseline-support.ts`）——因 `changedPaths`（`gates.mjs:109–118`）是 tracked diff ∪ untracked 的并集，裸 `assertNoChange` 会在 ALLOW 新文件上自我引爆，故 G3 必须走 allowlist 形（`assertAllowlist` `:130–139` 既有形态）。等效双判据：tracked 对 `d59a4d1` 零 diff ∧ untracked ⊆ 4 新文件。`plugin.ts`、`service.ts`、4 具名 fixture 从 allowlist 移除（D-5 防回退）。**G3 验收（F-7）**：4 新文件在场时 G3 PASS；回退 `plugin.ts` 或改任何既有 ws 测试（tracked diff 出现、不在 allowed）时 G3 FAIL |
| G4 | `src/index.ts` 零 diff | 零改动（AC6 公共面） |
| G5 | 公共面快照 | BASE 常量随 S5 重钉；`public-surface.base.json` **内容不变**（#470 未动 index.ts，d59a4d1 面 == 279dba4 面；快照内容不含基座 sha，无需重拍）；**B-5 绑定**：该主张由实现期 G5 实跑核证——若快照需重拍，仅允许基座元数据差异，导出名集合差异 = AC6 红；`cordis-public-surface.test.ts:32` 描述标题里的旧 sha 属 DENY 文件，仅文档性陈旧，如实记录不修 |
| G8 | 生产 src 无 env/通道分支 | 扫描面扩到 `apps/*/src`、`domains/*/src`（A9-1 与 G11 分工：G8 管 env 分支，G11 管 forbidden API） |
| **G10（新）** | A5-1 legacy Root 直读零残留 | 算法见 **§9.2 rev 2（X-1/F-8 修订版；rev 2.1 = F-9 取证对齐）**：接收者词表 V_ctx + 读取原语被调词表 V_M4 双判别、七行分类表（第 6 类仍为唯一红类）、允许清单 T-2 钉死值零增删、设施目录扫描面排除（root-probe.mjs 定位由此合法解决）、N-6 三形态零标记样本、≥6 域族回归自检；**BASE `d59a4d1` 干跑第 6 类恰空已留证**（SA8 §12.8-1(a) 新增验收判据先于实现落地成立；rev 2.1 复跑留档）；**I-1（SA8 §13.8-2，落地忠实度）**：实现以 §9.2 设计文本语义为准、**不得照抄干跑脚本**（cast 括取内层首标识符 + 不可解析 fail-closed ⇒ 类 6、V_ctx 大小写敏感、M4 跨行实参位），BASE 首跑按 §9.2 rev 2.1 对账基线逐项复现，记录级差异逐项解释、超出即回 SA8 |
| **G11（新）** | A9-1 forbidden API 扫描 | `packages/*/src`、`apps/*/src`、`domains/*/src` 内零 `volatile config` / `internal/config` / `internal/update` / `internal/commit` / Cordis 私有 Fiber store 读取（模式表 + 命中清单；命中即红，允许清单为**空集**——T-2 钉死值，本票不引入任何此类用法） |
| **G12（新）** | 设施文件 allowlist | `packages/persistence/test/fixtures/cordis-baselines/**` 内对 `d59a4d1` 仅 `baselines.json`、`run-baseline.mjs`、`gates.mjs`、`root-test-known-red.json`（**T-3：台账文件纳入白名单，任何后续改动可机械检出**）可 diff；`acquire.mjs`、`root-probe.mjs`、`provenance-b3.json`、`public-surface.base.json` 零 diff（A7-1/A7-2）；**I-2（G10–G12 联动钉死，SA8 §13.8-3）**：G10 R0 设施目录排除的合法性**当且仅当**本 gate 维持现行钉死值（4 文件零 diff + 4 文件闭合白名单 + 目录内新增文件即红）；本 gate 的任何弱化（含把 `root-probe.mjs` 移入可 diff 集）同时使 G10 扫描面出现盲区、构成对 §13.5 钉死值的违反，须回 SA8 重裁——不得以「G10 已过」为由先行放宽；判定按 `changedPaths`（tracked diff ∪ untracked）执行，目录内**新增未跟踪文件即红** |

### 7.4 suite → 文件清单（闭合）

| suite | 文件（工作树相对） | repeat |
|---|---|---|
| `ws-package`（提升） | 既有 4 具名 fixture（`ws-replication-plugin` / `issue299-ac-red` / `issue422-listen-false` / `guard-proxy-consumption`）——**清单不扩**（66/66 证据面保持稳定） | 1 |
| `guard-proxy` | **六文件（F-3 钉死，SA8 B-4）**：`packages/clock/test/clock-guard-proxy-consumption.test.ts`、`packages/namespace-registry/test/registry-guard-proxy-consumption.test.ts`、`packages/ws-replication/test/ws-replication-guard-proxy-consumption.test.ts`（与 ws-package 重叠运行 1 次，换取 ④ 面自包含留证）+ **`packages/ws-replication/test/ws-replication-issue246-interop-matrix.test.ts` + `ws-replication-issue418-edge-session-split-contract.test.ts` + `ws-replication-issue418-edge-session-split-structure.test.ts`（AC6-A6-4 wire/结构守卫，三基线 cell 载体；本会话核实三文件在盘，4/17/9 条用例量级，repeat=1 预算可控）**。suite 名沿用 `guard-proxy`（不新增 suite，保持 12-suite 矩阵与 T-1 钉死算术），语义 = 「AC6 冻结面守卫」 | 1 |
| `ws-cordis-channel` | 新 `ws-replication-cordis-root-channel.test.ts` | 1 |
| `ws-cordis-timers` | 新 `ws-replication-cordis-root-timers.test.ts` | 3 |
| `replication-lifecycle` | 新 `ws-replication-cordis-baseline-lifecycle.test.ts` + 既有 `ws-replication-issue420-session-host-round.test.ts`（**AC8-③ 钉死**归置；issue420 测试名不计入 `units`，见 E5 归类规则） | 3 |
| `composition-root` | `apps/yjs-server/test/third-party-composition-red.test.ts`、新 `third-party-timer-ownership-red.test.ts`、`issue270-regression-anchors.test.ts`、`issue270-server-integration-red.test.ts`、`on-fatal-error-issue288.test.ts`、`persistence-drain-shutdown.test.ts`（A3-5 `persistence-drain-budget-exceeded` 唯一既有观察者，本会话核实）、新 `packages/dsh-persistence/test/dsh-profile-direct-apply-order.test.ts` | 1 |
| `unload`（扩展） | 既有 `registry-sa7-rev1.test.ts` + `registry-sa7-cordis.test.ts` | 1 |

`--all --matrix` cell 结构（改动后）：每基线 13 cell（typecheck + 12 suite）× 3 = 39，加 `gates` 1、`root-test` 1（按 S4 判定）＝ **41 行**；`evidence/matrix/matrix.json` 聚合，任一 gating cell 红 → exit≠0（A7-6/A8-3，绿不抵红）。

### 7.5 证据 JSON 字段契约（A7/§12.0）

通用 cell（既有 `baseCell` 字段原样）：`{baseline, suite, status, resolvedRealpaths, provenanceDigest, expectedChannel, testNames, counts{passed,failed,total}, exitCode, repeat, repeatRuns[], logPath, filesPresent, allFilesPresent}`；suite 专属回填：`unload.r5p{present,passed}`（既有）、`replication-lifecycle.units{expected:23, observed, missing[]}`（新，E5——`observed` 按 **23 名钉死枚举**「在场且 passed」去重计数，自检 `coverage` 不计入，每基线恰 23；枚举外 `L.` 名 ⇒ cell 红——T-1a）。root-test cell 增 `{failedUnexpected[], disclosure}`（S4/B-3d）并保留既有 `diagnostics`（`:729–733`）；行为 cell 的可选 `diagnostics`（E4）仅环境红排查留痕、不参与 pass 判定。所有路径工作树相对；运行期产物只写 `.cache/`（A9-2）。

### 7.6 身份先行（A7-4）的执行顺序承载

单基线内 cell 生成顺序 = `typecheck → BASELINE_SUITES 数组序`（`runBaselineCells :773–780` 既有行为），配合 E7 装载自检 ⇒ 每基线恒为 `provenance → root-probe → （ws-package/contract/…/composition-root 行为 suite）`。行为 suite 永远排在身份断言之后；matrix 行生成序与 per-cell `logPath` 时间序可交叉复核。

---

## 8. 三基线 3×3×7 行为矩阵可执行设计（AC2；dispatch 项 3）

### 8.1 参数化结构

测试文件按「当前 cell 的基线」参数化（同一文件在 B1/B2/B3 workspace 各跑一次，行为断言基线无关；基线身份绑定 = cell JSON 的 `resolvedRealpaths`+`provenanceDigest`+`baseline` + describe 标签（`<baseline> > L.…` 全名首段），D-7）：

- **测试名编码（F-5 统一 + T-1a 计账钉死，三处口径同源）**：**测试名** = `L.<entry>.<scenario>`（名内不含基线段），entry ∈ {`hub-listen`, `peer-dial`, `session-host`}，scenario ∈ {`startup`, `timer-fired`, `timer-cancelled`, `explicit-stop`, `fiber-dispose`, `service-revoked`, `remount`}；补充单元 `L.edge-beta.minimal-round`、`L.async-gamma.minimal-round`。**describe 标签** = `NOMICORE_CORDIS_BASELINE ?? 'default'`（runner 模式下即 B1/B2/B3，默认布局下即 `default`——D-7）。**JSON `testNames` 全名** = `<标签> > L.<entry>.<scenario>`。**计账口径（T-1a-1/-4，钉死枚举制）**：每基线 cell 的**枚举清单** = 上述 21 个 `L.<entry>.<scenario>` + 2 个补充单元，**恰 23 名逐名钉死**（E5 的 `LIFECYCLE_UNITS` 常量即此清单）；`units.observed` = 清单内「在场且 passed」去重计数（T-1a-2：自检不计入）；三基线 cell 全名并集恰 23×3=**69** 条（基线段使三 cell 全名互异；自检名不计入 69——§13.2 绿灯判据与 E5 回填在同一方案下同时可满足；SA6 §12.2「63 个必绿单元」+ EDGE/ASYNC 补充、SA8 §9.3-4/T-1a-4 同口径）。**自检单元（T-1a-2 二选一，本设计显式定名）**：文件尾部 `it('coverage')` 断言**本次运行** 23 个枚举单元名全部出现且通过——**定名 `coverage`（放弃 iter-1 的 `L.coverage`：非 `L.` 前缀名天然不计入 units、不触 fail-closed 子句，E5 无需为自检名设例外）**，但其在 testNames 在场且 passed 是 cell 级必绿谓词（E5）；完备性的行为面承载不变（runner 回填是第二道机械面，T-1：该自检在测试文件内，runner 改不动）。**fail-closed（T-1a-3）**：cell 的 testNames 中出现「23 名枚举 ∪ {`coverage`}」之外、以 `L.` 起头的任何单元名 ⇒ cell 判红（防多写/改名/前缀漂移静默通过）。
- **入口 × 场景装配**（每 entry 3 类宿主实例，`beforeAll` 建组、逐 `it` 定位场景）：
  - **hub-listen**：`createHubReplicationPlugin({listen:{host,port}} , {listen: 注入 listener 适配器, verifyToken, authorize, observer})`；`listen` 适配器记录 `listen()` 恰 1 次、持有注入 transport（不绑真实 TCP，§7 资源纪律）。
  - **peer-dial**：`createPeerReplicationPlugin({expectedHubInstanceId}, {dial: 注入 dial 适配器, random: ()=>0.5, observer})`（full-jitter 确定性，SA6 §7）。
  - **session-host**：`createHubReplicationPlugin({listen:false})`（消费侧 `requireHubSessionHost`）。
- **取得该基线真实 `TimerService`（先于构造插桩）**：与 `cordis-root-real-timer.test.ts:52–97` 同款纪律——模块顶层/`beforeAll` 内、任何 `new TimerService(ctx)` 之前 patch `TimerService.prototype.timeout`（import 自 `@deepseek-ai/cordis-plugin-timer`，在基线 workspace 内经 overlay symlink farm 解析到该基线工件）；meter 记录 `{delay, armedAt, fired, disposed}` 序列与 `pending` 计数（fired 与 disposed 都递减——「dispose 后 pending=0」才是诚实陈述）；`afterAll` 还原。helper 位于 `cordis-baseline-support.ts`（测试代码，非第二套验真设施——设施 = 工件表/acquire/probe/runner，A7 不涉及测试内观测助手）。
- **最小装配**（SA6 §9.1 实测配方）：`new Context()` → `createInstancePlugin().apply(ctx,{instanceId,role})` → `ctx.plugin(createSystemClockPlugin())` → patch 后 `new TimerService(ctx)` → `ctx.plugin(createMemoryPersistencePlugin())` → `ctx.plugin(createNamespaceRegistryPlugin())` → 目标 replication plugin（hub/peer 同 ctx 或分 ctx 按场景）。

### 8.2 七场景断言与事件序证据（SA6 §12.2 逐条）

| 场景 | 断言（全部运行时行为） | 证据形态 |
|---|---|---|
| startup | `await ctx.plugin(...)` resolve；`listen`/`dial` 恰 1 次；`require*` 不抛；`status.state==='ready'`；hub-listen 下 `ctx.get(NOMICORE_HUB_SESSION_HOST_SERVICE)===undefined` 且 listen:false 下 `ctx.get(NOMICORE_HUB_REPLICATION_SERVICE)===undefined`（两入口互斥，ADR 0032） | 观察者/适配器计数 + 服务可见性 |
| timer-fired | meter arm 记录命中配置 delay（hello 35ms 级 / bootstrap 4321 / liveness 40/12 等，SA6 §7 规模纪律）；触发后果：hello→transport `close(1002)`；pong→`close(1001,'pong-timeout')`；bootstrap→会话终态/ns 超时事件；backoff→第二次 `dial` | meter 序列 + 适配器/观察者事件 |
| timer-cancelled | 触发前关连接或 `stop()` → 该 delay 的 `pending` 归 0，且谓词轮询 + deadline（5s）断言「约定窗口内未发生」 | meter.pending + 事件缺席断言 |
| explicit-stop | `stop()` 两次返回**同一 Promise**（幂等）；drain 期间 `require*` 仍可取；结束后 `state==='stopped'`、`connections/sessions===0`；服务仍注册（`ctx.get(service)` 非 undefined——撤销属下一场景；探针 P3 证实 `stop()`≠revoke） | Promise 全等 + 服务可见性时序 |
| fiber-dispose | 不 `stop()` 直接 fiber `dispose()` → 有序 effect 完成 stop（`plugin.ts:581–587/:673–678/:781–786` 反向 yield 序）→ 该入口全部 arm `pending===0`；零 unhandled rejection | meter + process 级断言 |
| service-revoked | fiber dispose 后 `ctx.get(<service>)===undefined`；`require*` 抛 `/unavailable/`；另一入口服务从始至终缺席 | 服务可见性 |
| remount | 同一 `ctx` 再 apply 新插件实例 → ready、服务可取、旧句柄失效；**双挂负控**：不先撤销即二次 apply → `ctx.provide` 抛（三基线同语义，§11.5） | 新实例状态 + 抛错文案 |

竞态纪律（SA6 §7）：触发 vs `stop()` 窗口用显式闸门/observer 事件（`settled`/`channel-state-changed`）拉开；同 cell 至少记录「触发前 stop」与「触发后 stop」两路径；等待一律谓词轮询 + 5s deadline，禁固定 sleep；每 cell 结束 `fiber.dispose()` + 根 `ctx.fiber.dispose()`，零遗留 listener。

### 8.3 EDGE/ASYNC 补充单元（β/γ 注入方式）

β：`createHubReplicationEdge`（无 Registry 依赖的纯工厂）+ `createHubSessionHost`，宿主注入「该基线 `new TimerService(ctx)` 解出的 timer 能力」（`timerFromContext` 同款 wrapper 形状或直接 `rootTimer.timeout` 桥接——工厂口径是「注入的 timer 被正确使用」，不读 `ctx.root`，SA6 §10.2）；γ：`createHubAsyncSessionHost` 以 `test/issue447-async-seam.ts` 既有参考桥接为装配范本。每基线 1 条最小回合：OPEN→OPEN_OK、一帧过缝（β 同步 / γ `frame{tag,bytes,lane}` + `receipt{tag,sequence}`）、`close()` 收口、arm outstanding=0。**β 冻结面 byte-for-byte 不动、γ append-only**（ADR 0032/模块 AGENTS）。

---

## 9. AC1/AC5 通道与 fixture 迁移设计（dispatch 项 4）

### 9.1 A1-1…A1-8 断言实现位置

全部落 `ws-replication-cordis-root-channel.test.ts`（A1-1…A1-7，假宿主 5 形态：symbol-only / legacy-only / both(legacy getter 计数) / malformed(symbol 在、`timeout` 非函数)+legacy / `{}`；× 三入口；A1-6 级联三态：`timer.ctx` 合法通道→用之 / `timer.ctx` 为 `{}` 或 `undefined`→回落 plugin `ctx` / `timer.ctx===null`→畸形宿主 loud fail 不回落；A1-7 sentinel 只记录不自走 + fire 后后果发生）与 `ws-replication-cordis-root-timers.test.ts`（A1-8）：

| A1-8 timer 族（12，SA6 §12.1 全列） | 入口/装配 | 配置旋钮（TIMEOUT_KEYS/BACKOFF_KEYS 或实际读取点） | 触发后果观察 |
|---|---|---|---|
| hello | hub listen + peer dial | `helloTimeoutMs`（10–50ms；∈ TIMEOUT_KEYS） | `close(1002)` |
| auth/upgrade 认证封顶 | hub listen（不完成认证的注入 transport） | `helloTimeoutMs`（**F-6 修正**：arm 载体 = `this.timeouts.helloTimeoutMs`，`hub-connection.ts:175–183`，arm 点 `:175`、注释明文「复用 timeouts.helloTimeoutMs——握手预算的既有载体，零新 knob」；`openTimeoutMs` 虽在 TIMEOUT_KEYS 但**不是**本族 arm 点） | 认证超时关闭（`close(1008,'upgrade-timeout')` + `upgrade-rejected`） |
| bootstrap | session-host 真实 registry namespace | `bootstrapTimeoutMs=4321`（可辨识 delay；∈ TIMEOUT_KEYS） | 会话终态/ns 超时事件 |
| close/drain deadline | hub listen 关闭路径 | `closeTimeoutMs`（∈ TIMEOUT_KEYS） | deadline 后收口 |
| reauth deadline | hub listen `requestReauth` | `closeTimeoutMs`（**F-6 修正**：全仓不存在 `reauthTimeoutMs`；reauth deadline 实以 `closeTimeoutMs` 武装——`hub-edge.ts:356` GOAWAY `drainTimeoutMs` 载体、`:363–364` arm delay；本族与 close/drain 同键，**以触发路径 `requestReauth` 区分两族**） | reauth drain 关闭（`close(1001,'hub-reauth')`） |
| peer backoff/reset | peer dial（首轮失败） | `backoff{baseMs,maxMs}`（∈ BACKOFF_KEYS）+ `random:()=>0.5` | 第二次 `dial`、确定性 delay |
| bulk-transfer ACK | hub/peer namespace（kind=2 自持 ACK，arm 点 `hub-namespace.ts:1050` `armTimer('assembly')`） | `ackTimeoutMs`/`assemblyTimeoutMs`（∈ TIMEOUT_KEYS） | ACK 发出/装配超时 |
| reconcile interval | peer（差流场景） | `reconcileIntervalMs`（∈ TIMEOUT_KEYS） | ≥1 次 reconcile 回合 |
| liveness ping+pong | hub listen HELLO→ready | `pingIntervalMs`/`pongTimeoutMs`（∈ TIMEOUT_KEYS） | ping 计数>0；`close(1001,'pong-timeout')` |
| fence-watchdog | hub/peer namespace（经 `host.armTimer/clearTimer`） | `ackTimeoutMs`（idle 探测重武装；∈ TIMEOUT_KEYS） | watchdog arm 记录；dispose 后清零 |
| peer `waitForLive` 轮询 | peer（ns 未 live 时调用） | 固定 25ms 字面量（`plugin.ts:761` 实际读取点——**非 TIMEOUT_KEYS 载体**，以读取点对应） | live 后 resolve；stop 后 reject |
| assembly/ACK 超时 | namespace 装配 | `assemblyTimeoutMs`（∈ TIMEOUT_KEYS） | 装配中止事件 |

每族一条 `it('T.<family>')` 断言三段：arm（delay===配置值）→ 触发（后果）→ 取消（stop/dispose 后同类 delay `pending===0`）。A1-8 文件**只准**使用基线真实 `TimerService`（若误用 fake，meter.arms===0 使断言结构性红——自执行约束，无需源码形状 gate）。**旋钮对应验收（F-6）**：上表 12 行旋钮全部与 `TIMEOUT_KEYS`/`BACKOFF_KEYS`（`plugin.ts:182/183`）或实际读取点一一对应（11 行键载体 + 1 行字面量读取点），实现期逐行核对，无凭空旋钮。

**通道文件的 fault 消费纪律（F-1 配套，N-2 生效前提）**：`ws-replication-cordis-root-channel.test.ts` 必须镜像既有探针的 F9 纪律（`cordis-root-channel.test.ts:445–460` 本会话复读）：读 `process.env.NOMICORE_CORDIS_FAULT`，在 `fault === 'legacy-shim'` 时对**同一受控 ctx** `Object.defineProperty(ctx, 'root', { value: { timeout: … }, configurable: true, enumerable: false })`，且「legacy 缺席 / symbol 优先（legacy getter 读取计数 = 0）」等严格断言**原样保留**——shim 使这些断言定向红，这正是 N-2 要的可红性；无 fault 时同一断言全绿（正控）。跨对象/跨进程 shimming 不允许（与 F9 同约束）。

### 9.2 A5-1 零残留机械 gate（G10）算法（**rev 2：X-1/F-8 修订版——SA8 §13.5 钉死值；rev 2.1 = F-9 取证对齐**——判别词表可机械执行，BASE 干跑第 6 类恰空已留证）

> rev 1 的候选集「接收者任意」在真实树 `d59a4d1` 产生 200+ 处**域数据 root 字段**误命中（`registry.ts` 的 `record.root`/`payload.root`/`p.root`、`doc-runtime` 的 `fx.root.get`×64、`vfsl` 的 `input.root`/`this.root`、yjs-server 的 `entry.root`/`args.root`、`request-body.ts` 的 `record['root']` 等），六类分类下全部落入第 6 类 ⇒ gates 12/12 与交付条件不可满足；且允许清单漏了探针本体 `root-probe.mjs:104/119/124/134`。SA2 F-8 与 SA8 X-1 同根因裁定 reject。rev 2 以**接收者词表 V_ctx + 读取原语被调词表 V_M4** 重写候选/分类语义；允许清单（T-2 钉死值）**零增删**；骨架不变（限 `gates.mjs` = §12.1 文件 3、无 ALLOW 文件级增删、分类表编号与「第 6 类 ⇒ 红」语义保持）。
>
> **rev 2.1（iter 3，SA2 F-9）**：干跑取证脚本 `scan.mjs` 与本节规范文的三处已证实偏离被对齐——①cast 括接收者解析取内层**首个标识符**（原脚本无捕获组正则取 `inner[1]` 恒 `undefined`，把「不可解析 ⇒ 类 6」的 fail-closed 静默降级为 5D 静默排除）；②V_ctx 后缀匹配**大小写敏感**（去 `/i`，后缀恰 `ctx`/`Ctx`——`fiberCtx`/`timerCtx` 入表、`fiberCTX` 不入）；③`commentSpan` 补 `*`/`/*` 引导纯注释行识别（类 5）。**本节 R0–R2 规范文为唯一真源、gate 判定语义零变化**；rev 2.1 只改取证脚本、自检表两行表述、回归自检新增 cast 探针断言与 I-1/I-2/I-3 吸收——候选集、分类表、扫描面、允许清单、N-6 三形态全部不动。已知残余脚本局限（SA8 §13.2 项 1 附注 ③、**归 I-1③ 的 gates.mjs 落地义务**，非本轮修复对象）：脚本 M4 实参位判定不建模跨行调用形态，BASE 实存为零（SA8 §13.1 通道排查 ①），对计数无影响；落地实现按 M4 形态条款（下）执行。

**R0 扫描面（含命名显式的设施目录排除——root-probe.mjs 的合法定位）**：`packages/*/{src,test}/**`、`apps/*/{src,test}/**`、`domains/*/{src,test}/**`，扩展名 `.ts/.tsx/.mts/.cts/.js/.mjs`；**排除 `packages/persistence/test/fixtures/cordis-baselines/**`（验收设施目录）**。排除的四点理由（SA8 §12.8-1(d) 边界内合法解决 `root-probe.mjs` 定位）：(i) 该目录是 G10 自身实现所在——`gates.mjs` 的模式串与 `run-baseline.mjs` 的 suite 表会自我命中，gate 不自扫自身实现；(ii) 目录内 `root-probe.mjs`/`acquire.mjs`/`provenance-b3.json`/`public-surface.base.json` 由 **G12 零 diff 逐字节执法**、其余 4 文件由 G12 白名单执法——**监控不丢失，由姊妹 gate 全量承载**（对 `root-probe.mjs` 的任何改动，包括新增 legacy 直读，G12 机械检出）；(iii) 该目录**无任何生产文件**，不触「禁以整文件白名单把生产文件移出监控」；(iv) `root-probe.mjs` 不出现在扫描面 ⇒ **不需要任何允许清单条目** ⇒ §12.2 项 3「恰 2 个文件级通道探针许可」边界原样保持（不新增第三份文件级许可）。**I-2（G10–G12 联动钉死，SA8 §13.8-3）**：本排除的合法性**当且仅当** G12 维持现行钉死值——(i) `root-probe.mjs`/`acquire.mjs`/`provenance-b3.json`/`public-surface.base.json` 对 `d59a4d1` 零 diff；(ii) 其余 4 文件闭合白名单、且目录内**新增文件（含未跟踪）即红**（判定按 `changedPaths` = tracked diff ∪ untracked 执行，理由 (ii) 的「监控不丢失」由此闭合）。G12 的任何弱化（含把 `root-probe.mjs` 移入可 diff 集）同时使本扫描面出现盲区、构成对 §13.5 钉死值的违反，须回 SA8 重裁——不得以「G10 已过」为由先行放宽。

**R1 候选集（M1–M4 四形态，每形态绑定一个命名判别词表；匹配顺序 = 形态命中 → 判别词表 → 分类）**：

- **M1 成员读取**：`recv.root` / `recv?.root`——`root` 为独立词（`rootValue` 永不匹配；`root` 后随 `(` 仍为候选，交类 2 判定，保类 2 存活）；接收者 = 紧邻访问点（`.` 或 `?.`）之前的标识符（链式接收者取终端段：`timer.ctx.root` 取 `ctx`）；`...` 展开形不产生候选（`[...root.keys()]` 非读取）。
- **M2 下标读取**：`recv['root']`——下标字符串**整体恰为 `root`**（`'root-mutation:queue-full'`、`'root 携带 symbol 键'` 等长字符串不产生候选）；接收者 = `[` 之前标识符；cast 括形 `(snap as X)['root']` 取**cast 括内首个标识符**（`snap`）。
- **M3 解构读取**：`const|let|var { …root… } = src`（绑定表含 `root` 或 `root:` 别名；声明位解构即属性读取）；**源 token = 源表达式首个标识符**（cast 括透明：`(ctx as any)` 取 `ctx`；调用源 `freshRoot(…)` 取 `freshRoot`）。
- **M4 读取实参字面量**：独立的 `'root'` 字符串字面量（引号内恰为 `root`）出现在**调用实参位**；被调 = 实参位所属调用的点链被调名。**跨行实参位（I-1③ 钉死）**：实参位判定须覆盖跨行调用形态与被调点链空白形态（如实参 `'root'` 与所属调用不在同一行）；无法机械归属所属调用时**记为不可解析 ⇒ 候选 ⇒ 类 6（fail-closed）**，不得静默按非候选丢弃。
- **判别词表一：V_ctx（M1/M2/M3 的接收者/源词表，命名显式、大小写敏感）**：token ∈ {`ctx`, `context`, `host`} 或以 `ctx`/`Ctx` 结尾（`fiberCtx`、`timerCtx` 入表；`Context`、`docContext` 不入表）⇒ **候选**；否则 ⇒ **类 5D 排除并记录**（记录 token 名）。依据：本仓 Cordis 上下文载体命名事实（seam/probe/测试的 `ctx`/`host`/`fiberCtx` 族；两 seam 的 `host`）。**fail-closed 方向（歧义 ⇒ 红）**：接收者/源 token **不可解析**（cast 内层非标识符起始、`a[i].root` 括链接收者等）⇒ 视为候选 ⇒ 类 6。
- **钉死句（cast 括形解析——gates.mjs 实现直接照抄；I-1① 的机械承载）**：cast 括形（M1/M2）接收者解析 = 取 cast 括内**首个标识符**（`(snap as X)['root']` → `snap` ⇒ ∉ V_ctx ⇒ 5D；`(ctx as any).root` → `ctx` ⇒ ∈ V_ctx ⇒ **类 6**；`(host as Context).root` → `host` ⇒ 类 6）；**不可解析（内层非标识符起始，如 `(0 as any).root`；括链接收者，如 `a[i].root`）⇒ 候选 ⇒ 类 6（fail-closed）**，不得落入 5D 静默排除。rev 2.1 探针实证见本节末尾取证（17/17 PASS）。
- **判别词表二：V_M4（M4 的被调读取原语词表，命名显式）**：被调 ∈ {`Reflect.get`, `safeReadChannel`} ⇒ **候选**；其他被调（`Object.prototype.hasOwnProperty.call`、`Object.hasOwn`、`Object.defineProperty`、`doc.getMap`、`validationProblemResponse`、vitest matcher、`if(`/`for(` 括等）⇒ **类 5D 排除并记录**（记录被调名）。依据：这两个被调是「字面量即被读属性键」的读取原语——`Reflect.get` 是属性读取原语，`safeReadChannel` 是两 seam 的通道读取器（类 1 自校验的可满足载体，SA8 §12.8-1(c)）；写形（`Reflect.set`/`defineProperty`）不属 A5-1「直读」语义，如实记录为排除项而非静默。
- **Cordis 面 F（文件标记：内容含 `@deepseek-ai/cordis` / `TimerService` / `Context` 任一）——仅作记录元数据，不参与候选判定**。这是 rev 2 的关键决策：若 F 参与门控，「无标记文件里的 `ctx.root`」会被静默放行——恰是新的漏判通道（SA2 F-8 建议的文件面限定因此只取其记录价值）；V_ctx 独立生效使接收者判别对所有文件一致成立。N-6 干跑以**零标记**注入文件证实：无标记文件的 `ctx.root` 仍红（§9.2 末尾负证）。
- **词法 gate 固有边界（显式声明——SA2 §18.6 O-1/O-2/O-3，免实现复审重议）**：接收者别名（`const c = ctx; c.root`）、动态下标（`ctx['ro'+'ot']`）、变量键（`Reflect.get(ctx, k)`）、M3 嵌套解构（`const { ctx: { root } } = host` 非候选）与 M3 源解析不对称（`const { root } = timer.ctx` 按源表达式**首个标识符/整段点链**判 5D，与 M1 终端段规则不对称）均为文本级 gate 固有边界——全树零实存（SA2 §18.2 漏判面逐项核查）、生产 src 由 G2/G3 零 diff 冻结；威胁模型是「意外重新引入 legacy 直读」，纵深 = 全量命中记录 + 实现复审 + T-2 裁决层。`Context` 静态形（`(Context as {root?}).root`）不入 V_ctx 为**已命名决策**（全树唯一实存位 `cordis-root-channel.test.ts:463/468` 在文件级许可探针内，设施由 G12 零 diff 冻结）。M3 终端段同款源解析为 latent 改进，不于本轮改动钉死值（如需收紧须回 SA8）。

**R2 分类表（rev 2：七行；每候选恰归一类，判定顺序自上而下，首中即定；全部命中含排除项与理由随 gates.log 输出，不许静默丢弃——第 6 类编号与语义不变）**：

| 类 | 判定 | 处置 |
|---|---|---|
| **1** | **允许清单命中（T-2 钉死值，与 iter-1 §12.2 项 3 逐字相同——零增删）**。行级 5 条：`packages/persistence/src/service.ts:86`、`packages/ws-replication/src/plugin.ts:251`（两 seam 的 `safeReadChannel(host, 'root')`，M4——全仓唯二生产 seam）；`ws-replication-plugin.test.ts:19`、`ws-replication-issue299-ac-red.test.ts:171`、`ws-replication-issue422-listen-false.test.ts:39`（三处既有 `Reflect.get(ctx, 'root')` 双读行，M4）。文件级恰 2 条：既有 `packages/persistence/test/cordis-root-channel.test.ts`、新 `packages/ws-replication/test/ws-replication-cordis-root-channel.test.ts`（通道探针本体；全仓文件级许可不得再扩） | 允许，记录（增删须回 SA8） |
| **2** | M1/M2 候选且 `root` 后第一个非空白字符为 `(`——同名 helper 调用（Cordis legacy root 是对象不可调用）。实存样本：`ws-replication-issue301…test.ts` 的 `ctx.root('hub', nsId, 'blurb')` 族 13 处 | 排除并记录 |
| **3** | M1 token 位于字符串字面量内部（`'cordis.root'` ≠ `'root'`）。实存样本：`Symbol.for('cordis.root')` 键（`service.ts:46` 等 **7 处**（rev 2.1；iter-2 计 9 处系含两行 `*` 引导注释行——`service.ts:41`/`plugin.ts:210`，rev 2.1 起按类 5 归属）；`guard-proxy-consumption.test.ts:105`） | 排除并记录 |
| **4** | 定义位（`root:` / `'root':` 键形，如对象字面量/类型成员的 `root: { … }`）——**键形部分**无读取形、结构性非候选；**同行若另含读取形则照常判定**（rev 2.1：iter-2 的「任何 matcher 均不触发」表述被干跑实录反驳——`harness.ts:537` `root: { ...GOOD_ROOT, ...(opts.root ?? {}) },` 的 M1 确有触发、receiver=opts 落 5D；由自检样本断言之） | 键形部分非候选（自检断言）；复合行的读取部分按实际类归属 |
| **5** | 注释命中（行内 `//` 之后或 `*`/`/*` 引导的纯注释行，如 `plugin.ts:264`；rev 2.1 起新增两实存锚点 `service.ts:41`/`plugin.ts:210`——`*` 引导 JSDoc 行内 `` `Symbol.for('cordis.root')` `` 注释散文自类 3 移入） | 排除并记录 |
| **5D** | **域数据 root 字段（rev 2 新增）**：M1/M2/M3 的接收者（或 M3 源）∉ V_ctx（记 `receiver=<名>`），或 M4 被调 ∉ V_M4（记 `callee=<名>`）；Cordis 面 F 作附加元数据（`unfaced` 注记） | **排除并逐条记录**——对域数据命中的唯一合法出口，每条携带判别款与 token 名，审计可见 |
| **6** | 其余 = **Cordis 语境直读命中**（V_ctx 接收者/源的 M1/M2/M3，或 V_M4 读取原语实参的 M4，且非类 1/2/3/5/5D；含一切不可解析接收者的 fail-closed 命中） | **gate 红**——逐条输出 `路径:行 [形态 receiver/callee] 摘录` |

**通过判定**：类 6 为空 ∧ 两类自证伪通过 ∧ 回归样本自检恒定。

**两类自证伪（保留）**：
- **seam 自校验**：`service.ts:86` 与 `plugin.ts:251` 各 ≥1 个第 1 类命中（M4 `safeReadChannel(host, 'root')` 实参形态——证明模式没有烂成永不匹配）。
- **N-6 定向红（T-4；SA8 §12.8-1(b)）**：注入样本**内容钉死**（三形态 + 一个 `ctx` 形参、**零 Cordis 标记**——证明 F 不门控、无漏判通道）：

  ```ts
  export function n6(ctx: unknown) {
    const r = ctx.root        // M1 → 类 6
    const { root } = ctx      // M3 → 类 6
    const o = ctx?.root       // M1 可选链 → 类 6
    return [r, root, o]
  }
  ```

  置于**扫描面内**的未跟踪位置（如 `packages/persistence/test/n6-g10-injection.ts`：非 `.test.ts` 后缀不被根 vitest glob 收集；在 G2（三处 src）/G3（pathspec `packages/ws-replication`）/G12（设施目录）pathspec 之外 ⇒ 只有 G10 红，负控不引入其他 gate 噪声）；`node gates.mjs` 留 G10 FAIL 输出为证后删除。三形态均须定向红。**（iter-3 注）cast 括形不进 N-6 三形态钉死集**——N-6 样本内容维持 SA8 §12.8-1(b) 追认的三形态零标记钉死**零变化**，cast 形（`(ctx as any).root` 等）仅以合成探针进下方回归自检表与干跑 `cast-probe.mjs` 留证；故 N-6 钉死内容不构成本轮 SA8 增量追认对象（追认对象 = 取证脚本对齐 + 自检表表述 + 对账基线，见 §17.3/§18）。

**回归样本自检（gate 内置恒定断言；I-3（SA8 §13.8-4）：每行断言绑「类 + 判别 token」——接收者/被调解析本身处于被测状态，不得只断言类；实存锚点行均经本会话干跑核实其分类，cast 探针两行为合成样本（非实存，rev 2.1 探针留证））**：

| 实存样本 / 探针样本 | 期望分类 |
|---|---|
| `registry.ts:1472` `payload.root`（**SA8 §12.8-1(d) 点名族 ①**） | 5D（receiver=payload） |
| `registry.ts:711` `record.root` / `:1506` `p.root`（同族扩展） | 5D（receiver=record / p） |
| `doc-runtime/test/issue-348-guard-semantics-matrix.test.ts:147` `fx.root.get('tasks')`（**点名族 ②**，Y.Doc root map 句柄，该文件族 64 处） | 5D（receiver=fx） |
| `apps/yjs-server/src/app.ts:864/:880` `args.root`（**Cordis 面内**的域读——证明 V_ctx 判别独立于 F 生效） | 5D（receiver=args） |
| `namespace-api/src/request-body.ts:131` `hasOwnProperty.call(record, 'root')` | 5D（callee=…hasOwnProperty.call） |
| `namespace-api/src/create-namespace.ts:292` `validationProblemResponse(…, 'root', …)` | 5D（callee=validationProblemResponse） |
| `namespace-runtime/src/schema-write.ts:383` `root: (snap as Record<string, unknown>)['root'],`（cast-M2 形；rev 2.1 干跑记录 `receiver=snap`——iter-2 报告的 `receiver=undefined` 为脚本 `inner[1]` 缺陷，已修） | 5D（receiver=snap） |
| `namespace-registry/test/registry-create.test.ts:548` `(input2 as { root: Record<string, unknown> }).root = { c: 3 };`（cast-M1 写目标形；M1 不分读/写，如实按形态记录；rev 2.1 干跑记录 `receiver=input2`——原 `undefined` 同上已修） | 5D（receiver=input2） |
| `packages/ws-replication/test/harness.ts:537` `root: { ...GOOD_ROOT, ...(opts.root ?? {}) },`（定义位 + 同行读取复合行） | **定义位部分（`root:` 键形）为结构性非候选**（类 4 语义保留）；同行 `opts.root` 读取形按机械语义 ⇒ **5D（receiver=opts）**——iter-2 表述「任何 matcher 均不触发」与干跑实录（M1 确有触发、receiver=opts）矛盾，rev 2.1 按修后机械语义改写 |
| **探针（合成样本，非实存）**：`(ctx as any).root` | **类 6**（receiver=ctx——cast 括取内层首标识符；SA2 F-9 验收判据） |
| **探针（合成样本，非实存）**：`(ctx as Record<string,unknown>)['root']` | **类 6**（receiver=ctx；M2 cast 括同款解析；SA2 F-9 验收判据） |
| `ctx.rootValue(...)` | 非候选（`root` 非独立词） |
| `service.ts:46` `Symbol.for('cordis.root')` | 类 3（字符串内部） |
| `issue301 :624` `ctx.root('hub', …)` | 类 2（helper 调用） |
| doc-runtime materialize-root 测试的 `[...root.keys()]` | 非候选（`...` 展开形） |

**G10 验收判据（rev 2 = SA8 §12.8-1 (a)–(e) 五款，逐款闭合；取证以 rev 2.1 复跑为准）**：
1. **(a) BASE `d59a4d1` 干跑第 6 类恰空**——已留证（下，rev 2.1 复跑），实现落地后 gates 首跑必须复现同一结果（按 I-1 对账基线：计数逐项 + 285 条全量 + 记录级差异逐项解释，超出即回 SA8）；
2. **(b)** N-6 三注入形态（`const r = ctx.root;` / `const { root } = ctx;` / `ctx?.root`）均定向红（零标记样本）；
3. **(c)** 两 seam 文件各 ≥1 第 1 类命中（M4 实参形态）；
4. **(d)** 允许清单 = §12.2 项 3 追认值**零增删**（2 seam + 3 fixture 双读行 + 恰 2 文件级通道探针许可）；域数据排除 = V_ctx/V_M4 命名词表（可机械判定、大小写/形态边界显式、歧义 fail-closed）；上表 ≥4 域族回归样本（含两点名族）进 gate 自检；不以整文件白名单把生产文件移出监控（全部生产文件仍在扫描面内，其命中逐条记录于 5D）；
5. **(e)** 完整命中清单（含各类排除项与理由）随 gates.log 输出，不许静默丢弃。

**dry-run 取证（rev 2.1；BASE `d59a4d1`，先于实现落地——SA8 §12.8-1(a) 留证义务；iter-3 按 F-9 对齐后复跑）**：
- 复核命令：`node .cache/issue471-g10-dryrun/scan.mjs`（主证）与 `node .cache/issue471-g10-dryrun/scan.mjs --n6`（负控证；该 pass 的扫描面 = 主面 ∪ `.cache/issue471-g10-dryrun/n6-scratch/`，用于在不污染仓库工作树的前提下证明注入形态分类；实现期 N-6 按上文置于扫描面内未跟踪文件）；cast/注释行/大小写探针：`node .cache/issue471-g10-dryrun/cast-probe.mjs`（辅助函数逐字复制自修后 `scan.mjs`——与 SA2 §18.0 探针同法，不建任何 `packages/`/`apps/` 文件）。脚本 = 本节 R0–R2 的逐条实现（rev 2.1 对齐后；残余局限仅 M4 跨行实参位，见 R1 M4 条款与 rev 2.1 注），只读扫描、输出到 stdout。
- **主证输出形态与结果（rev 2.1）**：首两行 `# G10 dry-run (main pass) — HEAD d59a4d1`、`scanned_files=732 cordis_faced=45`；计数行 `cat_1=19 cat_2=13 cat_3=7 cat_5=4 cat_5DR=196 cat_5DC=46` **`cat_6=0`**（合计 285 条，19+13+7+4+196+46=285）；随后按类输出 285 条全量命中清单（`路径:行 [形态 (receiver|callee)=<名>)] 摘录`）。**第 6 类恰空 ✓**；两 seam 第 1 类命中在场 ✓（`service.ts:86 [M4 callee=safeReadChannel]`、`plugin.ts:251 [M4 callee=safeReadChannel]`）；4 具名 fixture 零第 6 类 ✓（命中分落类 1/3：`ws-replication-plugin:19/34`、`issue299:171/183`、`issue422:39/93`、`guard-proxy-consumption:105`）。
- **负控输出与结果（rev 2.1）**：加入 6 行零标记注入文件后 `scanned_files=733 cordis_faced=45`（注入文件零标记成立），**`cat_6=3`** 恰为三注入形态（`n6-g10-scratch.ts:4 [M1 receiver=ctx]`、`:5 [M3 source=ctx]`、`:6 [M1 receiver=ctx]`），其余计数与主证逐项相同（三形态各自独立定向红、不依赖文件标记）。
- **与 iter-2 留档报告的逐项对账（计数 delta 的完整解释；修前报告留档 `report-main-prefix.txt`/`report-n6-prefix.txt`，diff 可逐字节复核）**：修后两 pass 相对修前**恰 4 行记录变化、其余逐字节一致**——(i) **2 行记录级 token 修正（类不变，均 5D-R）**：`namespace-registry/test/registry-create.test.ts:548` `receiver=undefined` → `receiver=input2`、`namespace-runtime/src/schema-write.ts:383` `receiver=undefined` → `receiver=snap`（SA8 I-1 预告的「现两行 `receiver=undefined` → `snap`/`input2`，类不变」逐字兑现）；(ii) **2 行类移动 3→5（`commentSpan` 补 `*` 引导行所致，规范文强制）**：`service.ts:41`、`plugin.ts:210`——两行均为 `*` 引导的 JSDoc 纯注释行，行内 `` `Symbol.for('cordis.root')` `` 是注释散文而非字符串字面量；修前脚本不识别 `*` 引导行，行级反引号启发式把注释散文误判为「字符串内部」落类 3，修后按类 5（`*`/`/*` 引导纯注释行）落类 5。**计数因此 `cat_3` 9→7、`cat_5` 2→4；总数 285、`cat_6=0`、其余各类与 `--n6` 三形态全部不变**。SA2 §18.5 F-9 接受判据原文预期「计数逐项相同（19/13/9/2/196/46/0）」系基于其「`*`/`/*` 行 BASE 零实存」核验——该核验覆盖的是 V_ctx 命中（cat 6 漏判风险）面，未覆盖类 3↔5 之间的注释行移动；本 delta 即上述两行，全量 diff 在案可复核，属规范文对齐的强制结果而非计数漂移。
- **cast/注释/大小写探针（rev 2.1，`probe_pass=17 probe_fail=0`）**：`(ctx as any).root`、`(host as Context).root`、`(ctx as X)['root']`、`(ctx as Record<string,unknown>)['root']` ⇒ **类 6**（F-9 验收判据）；树锚点复算：`(snap as …)['root']` ⇒ 5D（receiver=snap）、`(input2 as …).root` ⇒ 5D（receiver=input2）、`harness.ts:537` 复合行 ⇒ 5D（receiver=opts）；注释行 ` * reads ctx.root`、`/* ctx.root */` ⇒ 类 5；大小写边界：`fiberCtx.root`/`timerCtx?.root` ⇒ 类 6、`fiberCTX.root` ⇒ 5D（大小写敏感）；fail-closed：`(0 as any).root`、`a[i].root` ⇒ 类 6（receiver=UNRESOLVED）；`ctx.root('hub',…)` ⇒ 类 2；`ctx.rootValue(x)` ⇒ 非候选。证据 `report-cast-probe.txt`。
- **I-1 对账基线（落地后 gates BASE 首跑以此为锚；更新 iter-2 数值，随本回 SA8 增量追认）**：分类计数逐项复现 `cat_1=19 cat_2=13 cat_3=7 cat_5=4`、5D 合计 242（196+46）、`cat_6=0`，285 条命中全量对账；与 iter-2 追认时报告值（`cat_3=9 cat_5=2`）的差异 = 上述 (ii) 两行注释行 3→5 移动（落地实现按设计文本语义本就直接得到 rev 2.1 值），记录级 token 修正恰为 `snap`/`input2` 两处且类不变；**任何超出此清单的差异即回 SA8**（I-1 条款以 rev 2.1 基线执行）。
- 证据文件：`.cache/issue471-g10-dryrun/{scan.mjs, report-main.txt, report-n6.txt, report-main-prefix.txt, report-n6-prefix.txt, cast-probe.mjs, report-cast-probe.txt, n6-scratch/n6-g10-scratch.ts}`（`.cache` 运行期产物，gitignored；本节文本自带全部计数与锚点，不依赖该目录存活）。`scan-noface.mjs`/`report-noface.txt` 为 iter-2 的 F 门控对照变体（SA8 §13.1「辅助证据、不承载判据」），其辅助函数未随 rev 2.1 同步，**不得用于判据**。

**与 rev 1 的差异边界（外科手术式）**——**改**：候选集从「接收者任意」改为 V_ctx/V_M4 词表判别；新增类 5D（域数据排除，逐条记录）；类 4 收窄为结构性非候选断言；扫描面显式排除设施目录（G12 承载监控，解决 root-probe.mjs 定位）；M4 收窄为读取原语被调；N-6 样本钉死为零标记三形态；新增 (a) 干跑判据与取证。**不改**：分类表 1/2/3/5 语义与第 6 类「红」语义及编号、允许清单（T-2 钉死值零增删）、seam 自校验、「完整清单输出不许静默丢弃」、G10 归属文件（§12.1 文件 3）与 ALLOW 文件级集合。

**rev 2.1 差异边界（iter 3，F-9）**——**改**：取证脚本 `scan.mjs` 三处保真对齐（cast 括 `inner[0]`、`inVctx` 去 `/i`（后缀恰 `ctx`/`Ctx`）、`commentSpan` 补 `*`/`/*` 引导行）；R1 新增 cast 括形解析钉死句与 M4 跨行实参位钉死（I-1①③）；R0 末附 G10–G12 联动条款（I-2）；R2 类 4 行改「键形部分非候选、复合行读取部分照常判定」；自检表 `schema-write.ts:383` 行标注 token 修正、`harness.ts:537` 行按机械语义改写、新增 `registry-create.test.ts:548` cast-M1 锚点行与 cast 探针两断言（I-3 口径：绑类 + token）；干跑对账基线更新（`cat_3=7 cat_5=4` + token `snap`/`input2`）。**不改**：R0 扫描面、R1 候选集与词表成员、R2 分类表行集与第 6 类语义、允许清单、N-6 三形态钉死内容、通过判定、G10 归属文件与 ALLOW 文件级集合（本轮设计外零改动——除本文件外仅 `.cache/issue471-g10-dryrun/` 取证产物）。

- **A5-2 fixture 通道自述**：新测试内每处向 seam/工厂注入 Root 的构造点显式命名形态（symbol/legacy/both/malformed/absent），5 形态集合覆盖由 channel 文件的 describe 结构显式枚举（`C.<shape>.*`），证据 = cell `testNames`。**A5-3**：4 具名 fixture 零 diff（G3 allowlist 判据）+ 三基线 `ws-package` cell 66/66（既有断言面原样）。**A5-4**：A1-1/A1-2 的三基线证据即双通道证据，AC→证据矩阵（§14）分列引用。

---

## 10. AC3/AC4 组合根／所有权断言设计（dispatch 项 5）

### 10.1 落点与不可掩盖性

| 断言 | 测试文件 | 为何不被现有测试合并掩盖 |
|---|---|---|
| A3-1 顺序单调（`replication-drained < registry-stopped < persistence-drained/disposed < app-stopped`，事件索引判定） | 既有 `issue270-regression-anchors.test.ts:99–142`、`issue270-server-integration-red.test.ts`（进 `composition-root` cell，三基线） | 既有断言只在默认布局跑（G7）；三基线 cell 是新证据位；断言按事件索引单调而非时间戳 |
| A3-2 无环（replication `stop()` 不 await Registry shutdown；整体 5s deadline settle） | 新 `third-party-timer-ownership-red.test.ts`（第三方最小装配面） | 全仓现无「peer/hub stop 与 registry shutdown 互不等待」的直接断言；deadline 断言超时即红 |
| A3-3 provider/dependent 窗口（R5P：dependent 卸载窗口内写仍 `{ok:true}`） | 既有 `registry-sa7-rev1.test.ts`（`unload` cell，三基线；runner `r5p` 回填已内建） | 三基线 cell 为新；R5P 测试名必须在 JSON 且 passed（既有回填判定） |
| A3-4 watchdog 保留（双节奏 arm 记录；dispose 后清零；不得删 watchdog 换确定性） | 新 `ws-replication-cordis-root-timers.test.ts`（fence-watchdog 族） | 既有测试无 watchdog arm 三基线证据；meter 化断言 |
| A3-5 有界 drain 保留（`awaitDrainWithBudget` 路径；预算尽→`persistence-drain-budget-exceeded`；`dispose()` 前仍 `await drain()`） | 既有 `persistence-drain-shutdown.test.ts`（本会话核实为该事件唯一既有观察者；进 `composition-root` cell）+ `issue270` 面 | 三基线 cell 为新；事件可观察性断言已存在但未进矩阵（G6/G7） |
| A4-1/A4-3 Timer 存活（`persistenceFiber.dispose()` 后、根 `ctx.fiber.dispose()` 前：`ctx.get('timer')` 可取且 `timeout(()=>{},1)` 能 arm；TimerService 构造在**根 ctx**，persistence fiber 卸载不带走 timer） | 新 `third-party-timer-ownership-red.test.ts` | **全仓无任何 `ctx.get('timer')` 存活断言**（SA6 G7 实测）；断言在「Host 漏掉显式 dispose」时变红（A4 通过判定：断言非恒真——若把 persistence fiber dispose 误写为根 dispose，A4-1 红） |
| A4-2 最后释放（根 `ctx.fiber.dispose()` 后 timer 不可取/不可 arm） | 同上 | 同上 |
| A4-4 直接 apply profile 显式 dispose 序（adapter 先、Cordis fiber 后，幂等） | 新 `dsh-profile-direct-apply-order.test.ts`：直接 `plugin.apply(ctx)`（`profile.ts:52–93` 同步装配路径），经 probe 事件/adapter 观察记录 `adapter-disposed` 与根释放标记，断言顺序与幂等（`profile.ts:98–109` `await persistence.dispose(); await ctx.fiber.dispose()`） | 既有 `dsh-profile-acceptance.test.ts` 不含 dispose **顺序**断言（其 R1–R6 修订史聚焦 flush/evict 计数）；三基线 cell 为新 |

### 10.2 装配蓝本

`third-party-timer-ownership-red.test.ts` 复用 `third-party-composition-red.test.ts` 的公共入口装配（Instance → clock → `new TimerService(ctx)`（根 ctx）→ persistence fiber → registry → replication），meter 先于构造插桩；拆卸沿「单条拆卸链」（app AGENTS：replication drain → … → registry shutdown → persistence dispose → timer/clock teardown），逐步断言服务可见性与 timer 可 arm 性。

---

## 11. 负控与变异反证设计（SA6 §6.2 + 双挂；dispatch 项 6）

| # | 负控 | 应红证明方式 | 取证方法（BASE 上红于目标原因） |
|---|---|---|---|
| N-1 | 通道错配：B3 的 `@deepseek-ai/cordis` 链接指回 npm 4.1.0 | `run-baseline.mjs --baseline B3 --suite provenance --suite root-probe --suite ws-cordis-channel --fault substitute-npm`：内层 cell 须 observed=fail（provenance/realpath 或通道断言红）。**接受判据（SA8 §12.8-3 收口，与 N-2 同口径）**：`evidence/B3/fault-substitute-npm.json` 的 `cells[]` 中 **provenance、root-probe、ws-cordis-channel 逐 suite 各自 `status:'fail'`**——外层 exit 0 只是编排事实，单独不构成证据；任一目标 suite 未红 = N-1 未成立 | 复用 #470 `--fault` 编排（`runFault :739–769` 结构保留；fault 在 `faultOverrides`/`materialize` 层换链，对全部 suite 机械生效）：外层 exit 0 **当且仅当**内层逐 suite fail，`cells[]` 逐 suite 留证；证据 `evidence/B3/fault-substitute-npm.json`。**先在 BASE（未注册新 suite 时）跑 `--fault substitute-npm --suite provenance --suite root-probe` 留基线红**，再验证注册后新 suite 同样红——证明红因是「通道/工件错配」而非「测试缺失」 |
| N-2 | legacy shim：B3 受控 ctx 注入 legacy `root` 属性 | `--baseline B3 --suite root-probe --suite ws-cordis-channel --fault legacy-shim`：**每个**目标 suite 的 cell 各自 `observed=fail`（root-probe 的既有通道断言 + 新 channel 文件的「legacy 缺席/symbol 优先」断言同时红——shim 蒙混不了） | **F-1 修订判定**：env 经 E4a 贯通全部 `runVitest` 调用点（旧版仅 `:584` root-probe 分支注入，通用/新 suite 分支 `:540–548` 不传——fault 证据会被 root-probe 单独红蒙混，该缺陷已闭合）；通道测试按 §9.1「fault 消费纪律」读 env 并对同一受控 ctx 注入 legacy `root`（镜像 `cordis-root-channel.test.ts:445–460` F9 纪律）。**接受判据（F-1 Acceptance）**：`evidence/B3/fault-legacy-shim.json` 的 `cells[]` 中**每个 suite 均 `status:'fail'`** 且外层 exit 0——payload 顶层 `observed`（any-fail 聚合）单独不构成证据。对照正控：无 fault 同 suite 全绿 |
| N-3 | 回归灵敏度：seam 改 legacy-only（M-1）/ legacy-first（M-2） | 新通道测试定向红（M-1：`C.legacy-only.*` 红；M-2：`C.both.priority.*` 与 `C.malformed.*` 红）；既有 4 fixture **允许仍绿**（正是缺口证明） | 仅在 `.cache/cordis-baselines/workspaces/<B>/` 副本注入变异（SA6 §9.4 已验证可行并还原）；跑新 suite 留红证据；`diff` 校验副本与 `git show HEAD:…` 逐字节一致后清理。**实现阶段必须对三基线至少各跑一轮 M-1/M-2** |
| N-4 | ambient timer：只记录不自走的 sentinel 存在时，hello/bootstrap/backoff/liveness 不得自行发生 | channel 文件 sentinel 用例：sentinel arm≥1、写计数 0、等待 > 配置 timeout 无 hello 关闭/bootstrap 收口；错用 `setTimeout` 即红（后果不来自 sentinel ⇒ 断言红） | 与正控同文件可对照（真 timer 用例绿、sentinel 用例断言「无后果」成立）；变异版：在副本把 seam 换 `setTimeout` → sentinel 用例红 |
| N-5 | 双挂 provide：同 ctx 未撤销即二次 apply 同名服务 | lifecycle 文件 remount 负控用例：二次 apply 抛错（三基线 `ctx.provide`「already provided … Throws」原生语义，§3 已核实 B1/B3 一致） | 正向（撤销后重挂 ready）与负向（不撤销即抛）同 describe 并列，防止「从未双挂」的假绿 |
| N-6 | gate 自证伪：G10/G11 必须能红 | scratch 副本注入 **三种直读形态**（F-2 扩）：`const r = ctx.root;`（M1）、`const { root } = ctx;`（M3）、`ctx?.root`（M1 可选链）——G10 各自定向红；注入 `internal/update` 字样——G11 红 | 注入在未跟踪 scratch 路径或 workspace 副本，不留仓库工作树；留 gate FAIL 输出为证据（T-4：机制可证伪性必须实跑留证）。**G10 自校验另一侧**：正树上两 seam 文件各 ≥1 第 1 类命中（§9.2） |

负控纪律（SA6 §6.2 尾注 + F-1 收紧 + SA8 §12.8-3 收口）：`--passWithNoTests=false`；目标测试名存在且 passed 才算正控；**N-1 与 N-2 同口径——fault 外层 exit 0 只是编排事实，接受判据 = 逐 suite `cells[]` 各自 `status:'fail'`**（防单 suite 红冒充全部红；#470 既有「外层 exit 0 ⇔ 内层 fail」语义保留为编排层不变量）。

---

## 12. 文件范围（dispatch 项 7；闭合、精确到文件）

### 12.1 ALLOW LIST（SA3 唯一可改动/新增面）

| 路径 | 预期改动 | 原因（正文锚点） |
|---|---|---|
| `packages/persistence/test/fixtures/cordis-baselines/baselines.json` | `suites` 追加 6 项；`base` 重钉；`comment` 一句 | §7.1（A7-1/A7-3/E7） |
| `packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs` | E1–E7 + **E4a**（F-1） | §7.2（A7-3/A7-5/A7-6/S1/S4） |
| `packages/persistence/test/fixtures/cordis-baselines/gates.mjs` | G2/G3/G5/G8 更新 + G6 挂基座 + G10/G11/G12 新增 + BASE 重钉 | §7.3（R7 扩展、A5-1、A9-1、S5；F-7 G3 判据形状） |
| `packages/ws-replication/test/ws-replication-cordis-root-channel.test.ts` | 新增 | §9.1（A1-1…A1-7、A5-2/A5-4） |
| `packages/ws-replication/test/ws-replication-cordis-root-timers.test.ts` | 新增 | §9.1 表（A1-8、A3-4） |
| `packages/ws-replication/test/ws-replication-cordis-baseline-lifecycle.test.ts` | 新增 | §8（AC2 全矩阵 + β/γ + N-5） |
| `packages/ws-replication/test/cordis-baseline-support.ts` | 新增（测试 helper，不被 glob 收集） | §8.1（meter/宿主/装配/waitFor/sink） |
| `apps/yjs-server/test/third-party-timer-ownership-red.test.ts` | 新增 | §10（A3-2、A4-1…A4-3） |
| `packages/dsh-persistence/test/dsh-profile-direct-apply-order.test.ts` | 新增 | §10.1（A4-4） |
| `packages/persistence/test/fixtures/cordis-baselines/root-test-known-red.json` | 新增（已知红台账） | §13.0/D-6（A8-4；**SA8 §9.1 第 10 项转正**，B-3a…e 绑定） |

共 **10 个无条件文件 = SA8 §9.1 闭合 ALLOW 清单**（台账已由「条件」转正）。**无其他任何文件可改**；DENY = 上述 10 文件之外的仓库全部路径（SA8 §9.1 闭合世界条款，§12.2 为强调性列举，二者一致）。

### 12.2 DENY LIST（约束性清单；命中即违例）

> 闭合世界条款（SA8 §9.1）：**DENY = §12.1 十文件之外的仓库全部路径**；下表为强调性列举，二者一致。

| 路径/族 | 与任务的关系 | 禁止原因 |
|---|---|---|
| `packages/ws-replication/src/**`（含 `index.ts`、`plugin.ts`、全部状态机/工厂 `hub-edge*.ts`、`hub-session-host.ts`、`hub-session-async-host.ts`、`hub-connection.ts`、`hub-namespace.ts`、`peer-connection.ts`、`peer-namespace.ts`、`liveness.ts`、`backpressure.ts`、`fence-watchdog.ts`、`bulk-transfer.ts`、`hub-upgrade-admission.ts`、`validate.ts`） | 生产 seam 与状态机 | §5 零生产改动；AC6 冻结面；ADR 0032 wire/状态机；R4 |
| `packages/replication-protocol/**`（src 与测试） | wire 契约包 | AC6 A6-4 零字节变化；ADR 0010/0032 |
| 各 `package.json`（根 + packages/apps/domains 全部）与 `pnpm-lock.yaml` | 依赖面 | A9-5；ADR 0035 §4；G1′ |
| `artifacts/**` | 历史证据 | A9-2；AC9；G6 |
| `docs/**`（含 `docs/adr/**`） | 决策文档 | A9-3；不得以改 ADR 追认实现；G7 |
| `tsconfig*.json`、`vitest.config.ts`（根与各包全部） | 验收口径载体 | R1 反掩蔽；G9 |
| `packages/persistence/test/fixtures/cordis-baselines/{acquire.mjs,root-probe.mjs,provenance-b3.json,public-surface.base.json}` | 设施冻结子面 | A7-1/A7-2 单点获取与探针；G12 |
| 4 具名 fixture、`third-party-composition-red.test.ts`、`issue270-*.test.ts`、`on-fatal-error-*.test.ts`、`persistence-drain-shutdown.test.ts`、`dsh-profile-acceptance.test.ts`、`registry-sa7-*.test.ts`、`clock/registry/ws` guard-proxy 文件、`issue447-async-seam.ts` 等全部既有测试 | 既有证据面/装配范本 | A5-3 断言面保留；最小 diff（D-8/D-9）；β 冻结 |
| `packages/{persistence,dsh-persistence,namespace-registry,clock,instance,namespace-runtime,namespace-api,namespace-diagnostic-log,doc-runtime,vfsl*,replication-protocol}/src/**`、`apps/*/src/**`、`domains/*/src/**` | 全部生产源 | §5；AC6；G2/G8/G11 |
| `.github/**`、`scripts/**`、`CONTEXT.md`、`README*`、`INSTALL*`、`REPORT.md`、`tests/**` | CI/文档/辅助 | 超出票面；A9-4 命令白名单 |
| `packages/ws-replication/test/**` 既有文件（含 `harness.ts`、`driver.ts`、`issue420-*.ts` 等） | 既有测试设施 | A5-3；最小 diff |

---

## 13. TDD 红灯计划与执行预算（dispatch 项 8）

### 13.0 步序（先测试、后设施注册、负控贯穿）

1. **Step 0（BASE 取证，零改动）**：(a) 默认布局 `corepack pnpm@10.28.2 install --frozen-lockfile` 对齐后跑 root-test 面，捕获当前失败清单 → 区分 4 个 test-d 既有红与（若仍在的）28 环境红，落 `root-test-known-red.json` 数据——**B-3a（台账来源冻结）**：台账唯一合法内容 = 本步在 BASE（`d59a4d1`，未做任何本票改动）实跑捕获的失败清单，逐条归因映射 #470 裁定红集（4 例 test-d `knownRed` + 28 例环境红 `environmentRed`，各带归因注记）；对齐环境下复跑预期 28 例转绿、台账收敛为 4，两种捕获形态均合法；**实现/验证阶段不得向台账新增任何条目**（新增 = 掩蔽新红 = 违例，须回 SA8 复审——T-3）。**B-3b（提取核证 = 台账机制自身负控）**：捕获时 4 例 test-d 必须实际出现在 failedTestNames（覆盖 typecheck lane 提取——#470 impl 曾出现 root-test.json testNames 空、需回填的先例）；判定谓词为完整测试名集合级 `failedTestNames ⊆ (knownRed ∪ environmentRed)`，禁文件级/计数级近似（计数级会以「旧红转绿」抵销「新红出现」）。(b) 跑 `run-baseline.mjs --all --matrix` 于 BASE：`evidence/matrix/matrix.json` **不含**新 suite 行、`--suite ws-package` 仅 B1 行——**这是本票的「红灯」本体：验收证据缺口红（evidence-gap red），不是产品红灯**（SA6 §15.2「缺失而非绿」）；留档为 before 证据。
2. **Step 1（先写测试）**：写 4 个 ws 测试文件 + helper + 2 个 app/dsh 文件。默认布局聚焦运行（SA6 附录 A #4 同款命令 + 新文件）：**预期全绿**（生产已工作，SA6 §5.1）——此即「绿面证明失败不是环境/入口错误」；若此处红，先分辨测试自身缺陷 vs §5 反向闸门（生产行为红 → 上报，不修 src）。
3. **Step 2（设施注册）**：baselines.json/run-baseline.mjs/gates.mjs 按 §7 落地 → 单基线逐 suite 取证（B1 先）：`--suite ws-cordis-channel` 等；红灯只允许两类：注册遗漏（usage/materialize 红——修设施，不是证据）或 N-1…N-6 负控红。
4. **Step 3（三基线逐 cell）**：`--baseline B1 --mode typecheck` → B2 → B3；再逐基线逐新 suite；最后 `--all --matrix` 聚合。
5. **Step 4（负控全跑）**：§11 的 N-1…N-6 逐一留证（三基线 M-1/M-2 至少各一轮）。

### 13.1 红灯形态（不得以环境红冒充）

| 红 | 具体原因 | 证据形态 |
|---|---|---|
| 矩阵缺口红（BASE） | 新 cell 不存在 / `--suite` unknown / `--all` 无该行 | BASE 的 `matrix.json` + usage FAIL 输出 |
| 变异红（N-3） | seam 变异后新测试断言失败（优先级/兜底/malformed 判别） | workspace 副本内 vitest JSON 的定向 failed 测试名 |
| fault 红（N-1/N-2） | 工件/通道错配被 provenance/realpath/通道断言捕获 | `fault-*.json` 的 `observed:fail` + 外层 exit 0（**N-1/N-2 同口径**：均另按 `cells[]` 逐 suite fail 判定） |
| gate 红（N-6） | 注入直读/forbidden API 命中 | gates FAIL 行 + 命中清单 |
| 环境红（不得计入） | Node<24.9（B3 构建前置）、pnpm shim 版本、缺 node_modules | 判红前先按 SA6 §4.1 前置项排除并在 cell `diagnostics` 记录 |

### 13.2 绿灯判据（闭合；与 SA8 §9.3 十二条交付条件逐条对齐——F-5 统一计账口径）

矩阵 41 行中全部 gating cell `status==='pass'`（root-test 行按 S4 台账判定：名级谓词 + `failedUnexpected[]` 恒空 + `disclosure` 在场，B-3b/d）；`replication-lifecycle` **每基线 cell** 按 **T-1a 钉死枚举**判定：`units.observed===23`（= 23 名枚举内「在场且 passed」去重计数）且 23 个枚举单元名全数 passed（`<baseline> > L.…` 全名）、自检 `coverage` 在场且 passed（不计入 units）；**fail-closed**：任一基线 cell 出现枚举之外、以 `L.` 起头的单元名 ⇒ 该 cell 红；**三基线 cell 全名并集恰 69 单元名**（23×3，基线段使全名互异；自检 `coverage` 不计入 69——T-1a-4）；`guard-proxy` cell 内 issue246/issue418 测试名在场且 passed（A6-4，B-4）；`ws-cordis-timers` 每基线 12 族测试名在场且 passed；N-1…N-6 全部「应红实红」（**N-1/N-2 均按 `cells[]` 逐 suite fail 判定**）；gates 12/12 PASS（G3 按 allowlist 判据：4 新文件在场 PASS、回退/改既有即 FAIL；**G10 第 6 类为空 + 两自证伪 + 回归自检恒定**——含 SA8 §12.8-1(a) 的 BASE 干跑复现，按 **I-1** 以 §9.2 rev 2.1 对账基线执行（计数逐项 + 285 条全量 + 记录级差异逐项解释，超出即回 SA8），回归自检按 **I-3** 逐行断言「类 + 判别 token」（含 cast 探针两行 ⇒ 类 6））；`git status` 生产树零 diff、实际 diff ⊆ §12.1 十文件（SA8 §9.3-1）；A8-4 披露写入交付摘要（不得宣称 root-test/CI 全绿）；交付摘要另附 §16.3 调用方影响矩阵核对（SA8 §9.3-12）。

### 13.3 预算与执行顺序（避免无界）

- 顺序：B1 → B2 → B3（manifest 序）；每基线 typecheck → provenance → root-probe → 行为 suite（A7-4）。
- 单测等待：谓词轮询 + 5s deadline；新测试显式 `it(..., timeout)`（lifecycle/ownership 15–20s，app 集成沿用既有 30–40s 档）——不依赖 vitest 默认 5s，也不改全局配置（G9）。
- repeat：仅 `ws-cordis-timers`、`replication-lifecycle` ×3（D-4）。
- 预算上限（单次 `--all --matrix`）：typecheck ≈ 10–15 min（SA6 已实测 3×15/15）；新 suite 行为面 ≈ 20–40 min（lifecycle 双文件 ×3 repeat + channel/timers）；`guard-proxy`（六文件 repeat=1，含 issue246/issue418 共约 30 用例 ×3 基线）≈ 5–10 min；composition-root ≈ 10–25 min；gates+root-test ≈ 5–15 min ⇒ **总量 ≤ ~90 min，硬顶 2 h**；超顶即停查（无界运行禁令）。
- 磁盘：workspace 每轮重建（既有 `rmrf`）；`--fault` 副本用后即弃。

---

## 14. AC → 证据矩阵（dispatch 项 9）

| AC | 测试文件 / 测试名族 | 命令 | cell 证据路径 | 负责基线 |
|---|---|---|---|---|
| AC1（A1-1…A1-7） | `ws-replication-cordis-root-channel.test.ts`（`C.<shape>.<entry>`、`C.cascade.*`、`C.sentinel.*`、`C.timer-service.*`） | `node …/run-baseline.mjs --baseline B{1,2,3} --suite ws-cordis-channel` | `.cache/cordis-baselines/evidence/B{1,2,3}/ws-cordis-channel.json` | B1、B2、B3 各自 |
| AC1（A1-8） | `ws-replication-cordis-root-timers.test.ts`（`T.<family>` ×12） | 同上 `--suite ws-cordis-timers` | `…/B*/ws-cordis-timers{-repeat1..3}.json` | B1、B2、B3 |
| AC2 | `ws-replication-cordis-baseline-lifecycle.test.ts`（`L.<entry>.<scenario>` 63 + `L.edge-beta/L.async-gamma` 6 + 自检 **`coverage`**（T-1a：非 `L.` 前缀，不计入 units/69 并集，须在场且 passed）；全名 = `<baseline> > L.…`，§8.1 命名方案与 23 名钉死枚举） | `--suite replication-lifecycle` ×3 基线 | `…/B*/replication-lifecycle*.json`（含 `units`，每基线 23；枚举外 `L.` 名 ⇒ cell 红） | B1、B2、B3 |
| AC3（A3-1/A3-5） | `issue270-regression-anchors`、`issue270-server-integration-red`、`on-fatal-error-issue288`、`persistence-drain-shutdown`（既有，进 cell） | `--suite composition-root` ×3 | `…/B*/composition-root*.json` | B1、B2、B3 |
| AC3（A3-2）+ AC3（A3-3） | `third-party-timer-ownership-red.test.ts`；`registry-sa7-rev1.test.ts`（R5P） | `--suite composition-root`；`--suite unload` ×3 | `…/B*/composition-root*.json`；`…/B*/unload.json`（`r5p`） | B1、B2、B3 |
| AC3（A3-4） | timers 文件 fence-watchdog 族 | `--suite ws-cordis-timers` | 同 AC1-A1-8 行 | B1、B2、B3 |
| AC4（A4-1…A4-3） | `third-party-timer-ownership-red.test.ts`（`O.timer-alive.*`、`O.last-release.*`、`O.no-auto-edge.*`） | `--suite composition-root` ×3 | `…/B*/composition-root*.json` | B1、B2、B3 |
| AC4（A4-4） | `dsh-profile-direct-apply-order.test.ts` | `--suite composition-root` ×3 | 同上 | B1、B2、B3 |
| AC5（A5-1） | `gates.mjs` G10（命中清单输出） | `node …/gates.mjs` | `…/evidence/gates/gates.log` | default（全仓扫描） |
| AC5（A5-2/A5-4） | channel 文件 5 形态 | 同 AC1 | 同 AC1 行 | B1、B2、B3 |
| AC5（A5-3） | 4 具名 fixture 零 diff + 66 断言 | `--suite ws-package` ×3 | `…/B*/ws-package*.json` + G3 allowlist（tracked 零 diff ∧ untracked ⊆ 4 新文件） | B1、B2、B3 |
| AC6（A6-1） | `guard-proxy` suite **六文件**（3 guard-Proxy 消费 + issue246 + issue418×2，§7.4） | `--suite guard-proxy` ×3 | `…/B*/guard-proxy*.json` | B1、B2、B3 |
| AC6（A6-2/A6-3） | `cordis-public-surface.test.ts` + G5 快照 + 服务名字面断言 | gates G5（内嵌 runtime 测试）+ `--suite provenance` ×3 | `…/evidence/gates/gates.log`；`…/B*/provenance.json` | default + 三基线 |
| AC6（A6-4/A6-5） | **A6-4**：`ws-replication-issue246-interop-matrix` + `issue418-edge-session-split-{contract,structure}` 结构守卫——**钉进 `guard-proxy` suite 六文件清单（E1 常量）三基线 cell 载体**（F-3：无兜底选项）；**A6-5**：persistence contract suites（既有 `contract` suite 全量 `.test.ts`）三基线 | `--suite guard-proxy` ×3；`--suite contract` ×3 | `…/B*/guard-proxy*.json`（issue246/issue418 测试名在场且 passed）；`…/B*/contract.json` | B1、B2、B3 |
| AC7（A7-1…A7-6） | `baselines.json`/`run-baseline.mjs` diff scope + `--all --matrix` | `node …/run-baseline.mjs --all --matrix` | `…/evidence/matrix/matrix.json`（41 行） | 全部 |
| AC8（A8-1） | 根 `scripts.typecheck` 15 project 动态解析 | `--baseline B{1,2,3} --mode typecheck` | `…/B*/B*-typecheck.json`（逐 project exit） | B1、B2、B3 |
| AC8（A8-2 ①） | `registry-sa7-rev1` + `registry-sa7-cordis` | `--suite unload` ×3 | `…/B*/unload.json` | B1、B2、B3 |
| AC8（A8-2 ②） | 4 具名 fixture | `--suite ws-package` ×3 | `…/B*/ws-package*.json` | B1、B2、B3 |
| AC8（A8-2 ③） | `issue422-listen-false`（`ws-package` 内）+ `issue420-session-host-round`（**钉进 `replication-lifecycle` suite 文件清单**，E1 常量 `WS_LIFECYCLE_FILES`，F-3 同款钉死） | `--suite ws-package` ×3；`--suite replication-lifecycle` ×3 | `…/B*/ws-package*.json`；`…/B*/replication-lifecycle*.json`（issue420 测试名在场且 passed） | B1、B2、B3 |
| AC8（A8-2 ④） | `guard-proxy` suite | 同 AC6-A6-1 | 同上 | B1、B2、B3 |
| AC8（A8-2 ⑤） | `dsh-profile-acceptance.test.ts`（既有 `dsh-profile` suite） | `--suite dsh-profile` ×3 | `…/B*/dsh-profile.json` | B1、B2、B3 |
| AC8（A8-2 ⑥） | `third-party-composition-red` + `third-party-timer-ownership-red` + `issue270-*` + `on-fatal-error-issue288` + `persistence-drain-shutdown` | `--suite composition-root` ×3 | `…/B*/composition-root*.json` | B1、B2、B3 |
| AC8（A8-3） | `--all --matrix` 聚合 exit | `--all --matrix` | `matrix.json` | 全部 |
| AC8（A8-4） | root-test 已知红披露 | `--suite root-test` | `…/root-test/root-test.json`（`failedUnexpected` 空 + disclosure） | default |
| AC9（A9-1） | gates G11 | `node …/gates.mjs` | gates.log | default |
| AC9（A9-2/A9-3/A9-5） | gates G6/G7/G1′ + G12 | 同上 | 同上 | default |
| AC9（A9-4） | runner 命令白名单（node/git/tsc/vitest）不变 | 命令日志审计 | 各 cell logPath | 全部 |

> **归置钉死（F-3 修订）**：AC6-A6-4/A6-5 与 AC8-②③ 的文件归置**已在本表与 §7.4 钉死**（issue246/issue418×2 → `guard-proxy` 六文件；issue420-session-host-round → `replication-lifecycle`），不再保留「实现期微调/默认布局留证」选项——SA6 §12.6 失败判定明文「只在默认布局跑 guard-Proxy / interop 即不通过」，SA8 B-4 亦钉死「A6-4 点名文件必须取得三基线 cell 证据」。若实现期确需调整归置，仍**只准**改 `run-baseline.mjs` 常量（§12.1 ALLOW 内）、不得改任何测试文件本身、且不得回退到任何「默认布局留证」形态；调整须回 SA8 复审。

---

## 15. S1–S5 追认结果（SA8 已裁决：`task_issue-471_design_conflict_report.md` §3/§9，verdict=clear；dispatch 项 10）

| 编号 | 提案（本票 ALLOW/DENY 的裁决策） | SA8 裁决与绑定条款 | 设计落实 |
|---|---|---|---|
| **S1**（SA6 §18.2） | 矩阵口径升级：`ws-package` 与新 replication suite 在 B2/B3 由「附加证据」升为**必绿 cell**；`--all --matrix` 必须纳入 | **追认成立**（implements-existing-decision，兑现 ADR 0035 §5 L82 被推迟的义务 + R3 票级合法取代）；**B-1**：升级后 #470「B2/B3 仅附加证据」语义在本票全部失效，任何交付叙述不得回退 B1-only 口径 | §7.4/§13.2 三基线必绿收口；交付叙述按 B-1 |
| **S2**（SA6 §18.2） | 改动面扩展：允许 §12.1 的 **10 文件**（SA8 §9.1 闭合清单）；`plugin.ts` 从「条件允许」**收紧为零 diff**（较 SA6 建议更严，与 R4 无冲突——R4 绑形态不绑本票是否改码） | **追认成立**。**F-4 补充：真缺陷修复授权通道（预授权快速通道）**——矩阵 cell 因生产行为判红时，Controller 可按 SA6 §18.2 S2 原文（「`ws-replication/src/plugin.ts`（如需修缺陷时才允许）」）直接修订 ALLOW（把缺陷文件移出零 diff 面）、增补 §5 缺陷条目后派发修复，**无需重跑完整诊断轮**；修复回到同一验收面（A1 断言 + 重钉 gates + 该 cell 复跑绿） | §5 反向闸门单一路径 + §16.4 回退边界同口径 |
| **S3**（SA6 §18.2） | 跨包验收设施依赖：ws 与 app 行为 suite 由 `packages/persistence/test/fixtures/cordis-baselines` runner/overlay 承载 | **追认成立**（测试面依赖，生产依赖图零变化、`core-dsh-boundary` 守卫零影响）；**B-2**：禁止把 fixture 复制进 ws/app 包；测试不得硬编码 `.cache` 路径 | §7.2 零改动面（`cellEnv` env 面零新增）；§12.2 DENY fixture 复制 |
| **S4**（本设计发起，D-6） | root-test cell 改「台账判定」：运行+留证，名级 `failedTestNames ⊆ (knownRed ∪ environmentRed)` 才 pass；新增红仍 gate | **追认成立，附 B-3a…B-3e 五条绑定**（来源冻结/名级谓词+提取核证/新文件永不可入账/披露绑定/聚合语义钉死）；若否决的回退语义 = root-test 完全不 gating + 披露（不得无条件 gating、不得环境 shim），二选一须在交付记录显式写明 | §13.0 Step 0、§13.2、§16-R6、§4.1 表 |
| **S5**（本设计发起，D-5） | gates 比较基座 `279dba4 → d59a4d1`（含 `baselines.json.base` 文档性同步；快照内容不变） | **追认成立**（收紧性重钉，消除「回退 #470 面使 diff 变空而 gate 仍绿」盲区）；**B-4**（A6-4 三基线不可降级）与 **B-5**（G5 快照事实核证：若需重拍仅允许基座元数据差异，导出名集合差异 = AC6 红） | §7.3 G2/G3/G5/G12；F-3 修订落 B-4 |

**是否存在需 owner 介入的规范冲突：否。** SA8 §9.4 裁定「无」——无 override 诉求、无阻塞性冲突、无规范集合内不可解项；R1–R9 逐条分类成立（R3 票级合法取代、R6 不适用、其余原样/扩展）。无 owner 豁免/加码诉求。

---

## 16. 接口/状态机/数据流、错误与并发、调用方影响、风险与回退（dispatch 项 11）

### 16.1 接口、状态机与数据流

- **零生产接口/状态机/数据流变化**（§5）：公共类型、服务名、wire、持久化布局、Host 装配序、拆卸链全部不变（SA6 §13 冻结面逐条由 AC6/AC3/AC4 断言 + G4/G5/G7/G12 守住）。
- **验收数据流路线**（唯一新增的数据流，全在 `.cache/`）：

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| 工件→overlay | `acquire.mjs --all`（baselines.json integrity/commit） | npm tarball / DSH sparse clone + 最小 tsc | 跨网络与构建边界；integrity/rev-parse/ls-tree 复核 | `.cache/cordis-baselines/{npm,dsh,overlay}` | workspace symlink farm | 三基线可解析工件 | acquire 非 0 → `fail('acquire')` | provenance suite；G12（零 diff） |
| overlay→workspace | `materialize`（tracked ∪ NEW_FILES + farm） | `.cache/…/workspaces/<B>` | 跨「仓库树 ↔ 隔离工作区」边界；`@deepseek-ai/*` 唯一方差 | 同左 | vitest/tsc cwd | 每 cell 可执行环境 | 缺 NEW_FILES → exit 2（不作证据） | E2/A7-5 |
| workspace→证据 | 每 cell vitest/tsc/probe | `evidence/<B>/<suite>.json` + `*.vitest.json` + `*.log` | 跨「执行 ↔ 证据」边界；testNames/units 回填 | `.cache/…/evidence` | matrix 聚合、审计 | 41 行矩阵；绿不抵红 | cell 红 → matrix exit≠0 | §7.4/§7.5 |

### 16.2 错误、恢复、并发与幂等（验收岸）

- 错误分类：usage/materialize 红（修设施，不作证据）／负控红（预期）／行为红（§5 反向闸门：上报不修码）／环境红（SA6 §4.1 前置项排除后重跑，cell `diagnostics` 留痕）。
- 恢复：cell 可单点重跑（`--baseline X --suite Y`）；workspace 每轮重建（幂等）；fault 副本用后即弃。
- 并发：runner 顺序执行（`maxWorkers:1` 既有），无并发 cell；timer 竞态用闸门/observer 拉开（§8.2）。
- 幂等：`stop()` 双调用同 Promise 断言；`dispose` 幂等断言（A4-4）；remount 幂等。

### 16.3 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| `run-baseline.mjs` 使用者（CI/人工验收） | `--all` 输出 3×6+3+1+1 行 | 41 行（新 suite 三基线 + root-test 台账判定） | 命令行接口零变化；输出行数/字段扩展（§7.4/§7.5） | E1–E7 + E4a |
| `gates.mjs` 使用者 | 9 gates | 12 gates + 基座重钉 | 调用方式零变化 | §7.3 |
| 根 `pnpm test`/root-test cell | 收集 `packages|apps/*/test/**/*.test.ts` | 新文件被收集且**默认布局必须绿**（D-7），root-test 失败数不增 | 无（新测试自带 per-test timeout 与 env 条件断言） | `vitest.config.ts:15`；§13.1 |
| #470 证据可复现性 | 旧 matrix JSON 在 `.cache`（运行期） | 重跑得超集矩阵；旧 #470 cell 语义不变（suite 未删改，仅 `unload` 增文件、`ws-package` 升三基线） | 无 | §7.4 |
| 生产代码调用方（hub/peer/sessionhost 装配方） | — | **零变化**（零生产 diff） | 无 | §5 |

### 16.4 风险、OPEN 项与回退边界

| # | 风险/OPEN | 缓解/决议 |
|---|---|---|
| R-1 | app 集成测试（issue270 等）在基线 workspace 未被三基线验证过（SA6 只实测过 third-party 3/3×3）；可能暴露环境性红 | 已核实其不 spawn 子进程、端口 port 0、tmpdir 自理、tracked 树全量复制；若判红先按 §13.1 环境红排查；**不得 skip**；若确为行为红走 §5 反向闸门 |
| R-2 | 真实 timer 时序抖动 | 谓词轮询 + deadline、不断言墙钟精度、repeat 3、闸门拉开竞态窗口（SA6 §7） |
| R-3 | B3 构建非官方流水线 + Node ≥24.9 前置 | 诚实标注沿用 R5；环境前置在 Step 0 显式检查 |
| R-4 | S4/S5 绑定条款落实不足（SA8 已追认，风险从「未追认」转为「B-3a…e/B-4/B-5 执行走样」：台账被实现/验证期增项、A6-4 归置被降级、G5 重拍被当作导出面变化滑过） | 绑定条款已逐条落 §4.1/§13.0/§13.2/§7.3；实现复审（SA4/SA10/SA8）按钉死语义逐字核对（T-1/T-2/T-3）；N-6 + B-3b 是机制自身可证伪性证明，必须实跑留证（T-4） |
| R-5 | A1-8 的 12 族覆盖是最大新测试面，存在实现走捷径（fake timer）诱惑 | meter 自执行约束（fake ⇒ arms=0 ⇒ 红）+ 合同失败判据「以假 timer 冒充即不通过」+ 负控 N-4 |
| R-6 | **既有红披露（A8-4 强制）**：`ws-replication-issue421-edge-factory-api.test-d.ts` 4 红（expect-type 1.4.0 可选参数元组不兼容，#470 SA10 §5 记载，本票 SA6 B3 复现）；#470 记录的 28 环境红（packageManager 对齐后可闭合）。**本票不修、只披露**：台账文件 + 交付摘要逐条列出 + 禁止宣称「root-test/CI 全绿」 | Step 0 捕获台账；§13.2 绿灯判据与之绑定 |
| R-7 | scope 漂移（顺手改 src/配置/ADR） | §12 闭合清单 + G2/G3/G4/G7/G9/G12 机械守住 |
| R-8 | `--all` 运行超顶（无界化） | §13.3 硬顶 2 h、repeat 收敛（D-4）、单 suite 可拆跑 |
| **回退边界** | 本票零生产 diff ⇒ 回退 = 删除 §12.1 新文件 + 还原 3 个设施文件；无行为风险、无数据迁移、无兼容面。**生产行为的任何「必要修复」都超出本票回退边界，不得在本票内就地修**——唯一出口 = §5 反向闸门（停 cell → 留证 → 上报 Controller），由 Controller 走 §15-S2 预授权快速通道修订 ALLOW 后另派修复（F-4：与 §5/§15 三处同口径，无需重跑完整诊断轮） | — |

---

## 17. 评审修订映射（iter 0 → 1：SA2 §14 F-1…F-7；iter 1 → 2：SA2 §17 F-8/F-5r + SA8 §12 X-1/T-1a/§12.8-3；iter 2 → 3：SA2 §18 F-9 + SA8 §13 I-1/I-2/I-3；骨架不变）

| Finding | 严重度 | 判据要点（SA2 §14） | 修订位置 | 处理结果 |
|---|---|---|---|---|
| **F-1** | MAJOR | legacy-shim fault env 只注入 root-probe 分支（`run-baseline.mjs:584`），通用/新 suite 分支（`:540–548`）不传；§7.2「runFault 原样复用」把修复排除在闭合边界外 | §7.2 新增 **E4a**（全部 `runVitest` 调用点贯通 `extraEnv`，镜像 `:584`）；§7.2 零改动面段落消解 `runFault` 冻结声明；§9.1 新增「通道文件的 fault 消费纪律」（F9 镜像）；§11 N-2 判定升级 | 已闭合。接受判据落 §11 N-2：`evidence/B3/fault-legacy-shim.json` 中 `cells[]` **每个 suite 均 `status:'fail'`** 且外层 exit 0 |
| **F-2** | MAJOR | G10 候选模式漏裸 `ctx.root`（与规则 2 示例/N-6 样本自相矛盾）、规则 1 括形死规则、allowlist 漏 3 处既有双读、解构/可选链漏判 | §9.2 全节重写：候选集 M1–M4 四形态（成员读含可选链/下标/解构/`'root'` 实参字面量）；第 1 类允许清单显式补 3 处 fixture 双读行（`:19/:171/:39`）+ 既有通道探针文件级允许 + 新通道测试文件级允许；两类自证伪保留且第 1 类自校验改锚 M4 实存形态 | 已闭合。接受判据：两 seam 文件各 ≥1 第 1 类命中；N-6 三种注入（`const r = ctx.root;`、`const { root } = ctx;`、`ctx?.root`）均定向红；4 fixture 零命中第 6 类。**iter-1 增量复审改判：该闭合引入新 MAJOR F-8（候选集过宽），由 §9.2 rev 2 重闭合——映射见 §17.2** |
| **F-3** | MAJOR | §14 AC6-A6-4/A6-5 保留「默认布局留证」兜底，违反 SA6 §12.6 失败判定 | §14 该行重写为**只余三基线 cell 载体**（issue246 + issue418×2 钉进 `guard-proxy` 六文件清单，`--suite guard-proxy` ×3）；§7.2 E1/E5、§7.4 同步钉死；§14 脚注改「归置钉死」；B-4 逐字吸收（§4.1） | 已闭合。`--all --matrix` 含其三行且绿（§13.2 guard-proxy cell 判据） |
| **F-4** | MINOR | 反向闸门出口双表述（§5 vs §16）；真缺陷修复需完整往返 | §5 反向闸门改单一出口路径（停 cell → 留证 → 上报）；§15 S2 增预授权快速通道（按 SA6 §18.2 S2 原文修订 ALLOW，无需重跑诊断轮）；§16.4 回退边界同口径 | 已闭合。§5/§15/§16 三处表述一致 |
| **F-5** | MINOR | 单元名计账三口径不齐（D-7/§8.1/E5/§13.2） | 统一方案：describe 标签 = `NOMICORE_CORDIS_BASELINE ?? 'default'`，测试名 = `L.<entry>.<scenario>`，全名 = `<标签> > L.…`（D-7、§8.1）；E5 归类改「`L.` 段归类」（非 `L.` 名不计数，issue420 不冲击 units）；§13.2 改「每基线 cell 23 + 三基线全名并集 69」 | 已闭合。E5 回填与 §13.2 绿灯判据在同一命名方案下同时可满足 |
| **F-6** | MINOR | `reauthTimeoutMs` 旋钮不存在（实为 `closeTimeoutMs`，`hub-edge.ts:356/363–364`；`plugin.ts:182` 无该键） | §9.1 表 reauth 行改 `closeTimeoutMs`（以 `requestReauth` 触发路径区分两族）；同表 auth/upgrade 行一并修正为 `helloTimeoutMs`（`hub-connection.ts:175–183` 实际 arm 载体，`openTimeoutMs` 非 arm 点——顺带消除同类事实错）；表后新增旋钮对应验收 | 已闭合。12 行旋钮全部与 TIMEOUT_KEYS/BACKOFF_KEYS 或实际读取点一一对应（11 键载体 + waitForLive 字面量读取点） |
| **F-7** | MINOR | G3「零 diff 断言」与 `changedPaths` 的 untracked 并集（`gates.mjs:109–118`）自冲突 | §7.3 G2/G3 拆分：G2 = `assertNoChange`（三处 src 无新文件，不自引爆）；G3 = `assertAllowlist`（allowed = §6.2 的 4 个 ws 新文件），等效双判据「tracked 零 diff ∧ untracked ⊆ 4 新文件」明文写入 | 已闭合。新文件在场时 G3 PASS；回退 `plugin.ts`/改既有测试时 G3 FAIL |
| SA8 §9（约束性裁决） | — | 十文件 ALLOW（台账转正）、T-1…T-4、B-1…B-5、§9.3 十二条交付条件 | 头部规范来源、§4.1 落实表、§6.2/§12.1（台账转正）、§7.2（T-1 钉死语义）、§7.3（T-2/T-3、B-5）、§13.0（B-3a/b）、§13.2（§9.3 对齐）、§15（B 条款映射） | 已完整吸收；不一致处以 SA8 报告为准 |

### 17.1 SA2 §15 非阻塞观察的显式表态

| # | 观察 | 表态 | 理由/落实 |
|---|---|---|---|
| 1 | G6 whitespace 检查不带 BASE（`gates.mjs:372`） | **采纳** | §7.3 G6 行：`git diff --check` → `git diff --check <BASE>`（本票正在改 gates.mjs，顺手钉上；#470 SA9 S9-M3 已记为 MINOR） |
| 2 | `--suite gates` 死字面量（`run-baseline.mjs:139` vs `:632`） | **采纳（顺手清理）** | §7.2 E3：随白名单更新删除 `'gates'` 字面量并留注释说明 gates 由 `--all` 承载 |
| 3 | G12 对三个设施文件的内容盲区（gates.mjs 被弱化不可机械检出）；建议内建 `--self-test` | **维持现状（不采纳 `--self-test`），三重防线已足** | (i) T-2：裁决层闭合 ALLOW/DENY 优先于 gates 机械承载，SA4/SA10/SA8 实现复审必查 gates diff 是否恰为列举编辑点；(ii) G12 使 gates.mjs 自身 diff 面小且可逐行审；(iii) N-6 强制人工注入留证（T-4 升为实现义务）。「被弱化的 gates 同样能删掉自检入口」——self-test 无外部锚点时机械上不可自证，内建只会扩大设施面 |
| 4 | 行为 cell 无 `diagnostics` 字段（§16.2 说留痕但 `baseCell :485–498` 无该字段） | **采纳（实现细节落 edit point）** | §7.2 E4：通用 cell 增可选 `diagnostics`（镜像 root-test `:729–733` 先例；仅环境红排查留痕，不参与 pass 判定）；§7.5 同步 |
| 5 | D-7 与 root-test 收集面判断成立 | 无需改动 | 维持 D-7（本修订已按 F-5 统一其命名表述） |
| 6 | S4 台账的遮蔽面（未来真红被遮蔽到台账刷新为止） | **维持（SA8 已裁决）** | B-3a/c（台账冻结 + 新文件永不可入账 + 新增条目回 SA8）+ B-3d（披露绑定 + 表述禁令）已把遮蔽面钉在可审计轨道上；SA2 亦认同交 SA8 裁决而非设计预设结论 |

### 17.2 增量复审映射（iteration 1 → 2：SA2 §17 F-8/F-5r + SA8 iter-1 §12 X-1/T-1a/§12.8-3）

| Finding / 裁决 | 严重度 | 判据要点（SA2 §17.4 / SA8 §12.8） | 修订位置 | 处理结果 |
|---|---|---|---|---|
| **F-8**（= SA8 **X-1** 同根因） | MAJOR | rev 1 候选集 M1–M3「接收者任意」把全仓域对象 `root` 字段读取（`registry.ts` 14 处、`fx.root` 64、`vfsl`/`doc-runtime`/yjs-server 域读、M2/M4 域形）整体卷入第 6 类 ⇒ G10 在 BASE 出生即红、gates 12/12 与 SA8 §9.3-2 不可满足；且允许清单漏探针本体 `root-probe.mjs:104/119/124/134` | **§9.2 全节重写为 rev 2**：R0 扫描面排除设施目录（G12 承载监控 ⇒ root-probe.mjs 定位合法解决、零清单增删）；R1 候选集绑定 **V_ctx 接收者词表 + V_M4 读取原语被调词表**（命名显式、机械可判、歧义 fail-closed ⇒ 红；Cordis 面 F 仅作记录元数据——不门控，杜绝「无标记文件 `ctx.root`」漏判通道）；R2 七行分类表（新增类 5D 域数据排除并逐条记录；第 6 类编号与红语义不变）；N-6 样本钉死为零标记三形态；≥6 域族回归自检（含 SA8 点名的 `payload.root` 与 `fx.root.get` 两族） | **已闭合（SA8 iter-2 §13 已追认：(a)–(e) 五款逐款 clear，X-1 暂停解除——§9.2 rev 2 为 §13.5 钉死值）**。接受判据 = §12.8-1 (a)–(e) 五款逐款成立：**(a) BASE `d59a4d1` 干跑第 6 类恰空——已留证**（`cat_6=0`，285 条全量分类，复核命令 §9.2；rev 2.1 复跑维持，计数对账见 §9.2 取证节）；(b) 三注入形态定向红（负控干跑 `cat_6=3`，零标记样本）；(c) 两 seam 各 ≥1 第 1 类命中（M4 `safeReadChannel` 实参形态，干跑在场）；(d) 允许清单零增删 + 词表判别 + ≥4 域族样本自检；(e) 全量命中清单随 gates.log 输出 |
| **F-5r**（= SA8 **T-1a** 不可满足点） | MINOR | E5「取以 `L.` 起头的段」句法归类按字面把自检 `L.coverage` 计入 ⇒ observed=24≠23，T-1/§13.2 钉死谓词不可满足；实现者须在「永红」与「偏离字面」间自由裁量 | **§7.2 E5**：归类改按 **23 名钉死枚举**（`LIFECYCLE_UNITS` 常量）「在场且 passed」去重计数，废弃句法前缀规则；**§8.1**：自检单元显式定名 **`coverage`**（T-1a-2 二选一，本设计选非 `L.` 前缀——天然不计入 units、不触 fail-closed，E5 无需例外条款），在场且 passed 义务由 cell 级谓词承载；**§13.2/§7.5/§14 AC2** 同步 | 已闭合。E5 实现后每基线 cell `observed===23` 与 §13.2「三基线全名并集恰 69」（自检不计入）同时成立，无需实现者裁量；枚举外 `L.` 名 ⇒ cell 红（T-1a-3 fail-closed） |
| SA8 **T-1a**（iter-1 §12.2 项 2 四款钉死） | — | 枚举清单恰 23 名；observed = 清单内在场且 passed 去重计数；自检不计入 units 但须在场且 passed（名由设计定并显式写明）；fail-closed：清单 ∪ {自检名} 外任何 `L.` 段名 ⇒ 红；三基线并集恰 69、自检不计入 | §8.1（枚举 + `coverage` 定名 + fail-closed）、§7.2 E5（`LIFECYCLE_UNITS` + cell 谓词）、§13.2（绿灯判据）、§4.1 T-1 行、§7.5、§14 AC2 | 四款逐字吸收；数值（23/69）与既有 T-1 钉死不变 |
| SA8 **§12.8-3**（N-1 判据收口注记） | — | N-1 接受判据按逐 suite cell 读法表述（provenance/root-probe/ws-cordis-channel 各自 `observed=fail`），与 N-2 同口径；纯文字修订 | §11 N-1 行 + 负控纪律段 | 已吸收。外层 exit 0 降格为编排事实；逐 suite `status:'fail'` 为接受判据 |
| **不得回退面**（SA8 §12.8-4） | — | E-增补授权（E4a/E3 清理/E4 可选 diagnostics；G6 挂基座/G2-G3 形状/F-3 suite 常量钉死）、十文件闭合 ALLOW、B-1…B-5、T-2/T-3/T-4、F-1/F-3/F-4/F-6/F-7 闭合、§12.1 十文件与闭合世界 DENY | 未触碰：§7.2 E1–E4a/E6/E7、§7.3 G2/G3/G6/G11/G12、§12.1/§12.2、§4.1、§15 原样 | 全部维持。本轮改动面 = §9.2（rev 2）+ E5 归类一句 + §8.1 计账段 + §13.2 + §11 N-1 + §14 AC2 行 + 头部/输入/映射章节，均落在既有 ALLOW 文件（本设计文档）内；G10 修订仍限 `gates.mjs`（§12.1 文件 3），无 ALLOW 文件级增删（§12.9 同判） |

### 17.3 增量复审映射（iteration 2 → 3：SA2 §18 F-9（唯一阻断）+ SA8 iter-2 §13 I-1/I-2/I-3 吸收）

| Finding / 裁决 | 严重度 | 判据要点（SA2 §18.5 / SA8 §13.8） | 修订位置 | 处理结果 |
|---|---|---|---|---|
| **F-9**（MAJOR；iter-2 唯一阻断） | MAJOR | 干跑取证脚本与 §9.2 rev 2 规范文可证差异：①`receiverOf`/`receiverOfBracket` 无捕获组正则取 `inner[1]` 恒 `undefined` ⇒ cast 括形 fail-closed 被静默降级为 5D 排除（`(ctx as any).root`/`(host as Context).root`/`(ctx as Record<string,unknown>)['root']` 三探针均落 5D）；②`inVctx` 用 `/i` 与「大小写敏感」相反；③`commentSpan` 只识别 `//` 不识别 `*`/`/*` 引导行；且 §9.2 自检表两行被自身证据反驳（`schema-write.ts:383` 期望 5D receiver=snap 而报告 receiver=undefined；`harness.ts:537` 期望「任何 matcher 均不触发」而报告有 M1 命中 receiver=opts——按文接入 gate 自检即不可满足） | (1) `.cache/issue471-g10-dryrun/scan.mjs`（rev 2.1）：两处 `inner[1]`→`inner[0]`、`inVctx` 去 `/i`（后缀恰 `ctx`/`Ctx`——设计文「以 ctx/Ctx 结尾、大小写敏感」原文如此，`fiberCtx`/`timerCtx` 仍在表）、`commentSpan` 补 `*`/`/*` 引导纯注释行；(2) 复跑两 pass 落盘 + 修前报告留档（`report-*-prefix.txt`）供逐字节 diff；(3) §9.2：R1 新增 cast 钉死句、R2 类 4 行改写（键形部分非候选/复合行读取照常判定）、自检表 `:383` 行标注 token 修正、`harness.ts:537` 行按修后机械语义改写（定义位非候选 + 同行 `opts.root` ⇒ 5D receiver=opts）；(4) 自检表补 cast 探针两断言（⇒ 类 6）+ `registry-create.test.ts:548` cast-M1 锚点行（token=input2）；N-6 三形态钉死集**不变**（§9.2 N-6 注 + §11） | **已按 SA2 §18.5 Required change (1)–(4) 逐条落实**。接受判据核对：两 pass 复跑 `cat_1=19 cat_2=13 cat_5DR=196 cat_5DC=46 cat_6=0`、`--n6` `cat_6=3` 三形态原样 ✓；`cat_3`/`cat_5` 相对 iter-2 报告值 9/2→7/4 = 规范文强制的两行 `*` 引导注释行 3→5（`service.ts:41`/`plugin.ts:210`）+ 两行 token 修正（`snap`/`input2`）——恰 4 行、其余逐字节一致、总数 285 不变，逐项解释与复算在 §9.2 取证节；cast 探针 `(ctx as any).root`、`(ctx as X)['root']`/`(ctx as Record<string,unknown>)['root']` ⇒ 类 6（`cast-probe.mjs` 17/17）✓；`harness.ts:537`/`schema-write.ts:383` 自检断言与报告输出一致 ✓ |
| SA8 **I-1**（G10 落地忠实度；§13.8-2） | — | 落地以设计文本为准、不照抄脚本：①cast 括（M1/M2）接收者取括内**首个标识符**、解析不可得一律 fail-closed ⇒ 类 6 不得落 5D；②V_ctx 后缀按文本**大小写敏感**（`ctx`/`Ctx` 结尾）；③M4 跨行实参位/被调点链空白（或记不可解析 fail-closed）；BASE 首跑须与干跑对账：计数逐项一致、285 条命中、记录级 token 修正差异逐项解释，超出即回 SA8 | §9.2 R1 钉死句（①）+ V_ctx 词表（②，原文已钉死）+ M4 跨行实参位钉死（③）+ 取证节「I-1 对账基线」（rev 2.1 值）+ §7.3 G10 行 + §13.2 | 已吸收。**对账基线由 iter-2 数值（cat_3=9/cat_5=2）更新为 rev 2.1 数值（cat_3=7/cat_5=4）**，delta = 两行注释行 3→5 + 两行 token 修正，逐项列明于 §9.2——此更新属 §13.5 钉死值取证面修订，随本回 SA8 增量追认（§18） |
| SA8 **I-2**（G10–G12 联动钉死；§13.8-3） | — | R0 设施目录排除的合法性**当且仅当** G12 维持现行钉死值：(i) `root-probe.mjs`/`acquire.mjs`/`provenance-b3.json`/`public-surface.base.json` 零 diff；(ii) 其余 4 文件闭合白名单且目录内新增文件即红；G12 任何弱化 ⇒ G10 扫描面盲区 ⇒ 违反 §13.5 钉死值须回 SA8，不得以「G10 已过」先行放宽 | §9.2 R0 末联动条款句 + §7.3 G12 行（含 `changedPaths` = tracked diff ∪ untracked 的显式判定口径——同时闭合 SA2 §18.6 O-4） | 已吸收（语义逐字，无放宽；O-4 一并闭合） |
| SA8 **I-3**（自检断言绑 token；§13.8-4） | — | 回归样本自检每行断言绑**类 + 判别 token**（如 `schema-write.ts:383 → 5D receiver=snap`、`registry.ts:1472 → 5D receiver=payload`、`request-body.ts:131 → 5D callee=…hasOwnProperty.call`），不得只断言类——使接收者/被调解析本身处于被测状态（I-1① 的机械承载） | §9.2 回归自检表（intro 显式 I-3 口径；全表逐行已带 token；`:383` 行 token 修正为 `snap`、`:548` 行新锚点 `input2`）+ §13.2 | 已吸收；两处 cast 实存锚点 + 两行 cast 探针断言使 I-1① 在 gate 自检内可机械验证 |
| **不得回退面**（SA8 §12.8-4/§13.8-5） | — | E-增补授权、十文件闭合 ALLOW、B-1…B-5、T-1a/T-2/T-3/T-4、F-1/F-3/F-4/F-6/F-7/F-8 闭合、§9.2 rev 2 候选集与分类表、扫描面与允许清单、X-1 追认与 §13.5 钉死值 | 未触碰：本轮零改动 `packages/**`、`apps/**`、`domains/**`、`docs/**`；改动仅 `wiki/raw/task_issue-471_design.md` 与 `.cache/issue471-g10-dryrun/`（gitignored 取证产物）；§9.2 R0/R1/R2 判定语义、允许清单、N-6 三形态、扫描面原样 | 全部维持。本轮 delta = 取证脚本三处机械对齐 + 自检表述/断言 + I-1/I-2/I-3 吸收，**不改变 gate 判定语义与任何已追认决策**（对账基线数值更新属取证面，见 §18-4） |
| SA2 §18.6 非阻塞观察（本轮表态） | — | O-1（M3 源解析与 M1 不对称/嵌套解构不捕获，latent）、O-2（词法 gate 固有边界：别名/动态下标/变量键）、O-3（`Context` 静态形排除，已命名决策维持）、O-4（G12 判据宜显式含 untracked）、O-5（§13.1 fault 行旧括注）、O-6（`--sample` 尾行 argv 瑕疵） | O-4 已闭合（§7.3 G12 显式 `changedPaths` 口径）；O-1/O-2/O-3 **边界声明**（§9.2 rev 2.1 注 + 自检表探针行覆盖 cast 面；M3 终端段同款规则为 latent 改进、不本轮改钉死值——全树零实存、生产面 G2/G3 零 diff 冻结）；O-5 一词对齐（§13.1 fault 行括注改「N-1/N-2 同口径逐 suite `cells[]` fail 判定」）；O-6 维持（纯输出瑕疵，gates.mjs 自检样本族走显式断言，不采 `--sample` 便利开关） | O-4/O-5 采纳闭合；O-1/O-2/O-3 显式声明免重议；O-6 维持现状（实现建议已吸收进设计表述） |

---

## 18. 是否需要设计后 ADR 冲突复查

**`requiresConflictRecheck = true`（本轮维持；SA8 iter-2 §13.11 同判，本轮另增追认面，见理由 4/5）。** 理由：
1. **SA8 已裁决且自带实现后复查义务**：iter-0 §11/iter-1 §12.11/iter-2 §13.11 明示（i）S1–S5 全是验收/门禁语义变化面，实现后须按其钉死语义（T-1a/T-2）逐项核对实际 diff 与 G10–G12 首落地行为；（ii）实际 diff 是否守住 §9.1 十文件闭合清单（含 #470 已交付面零回改）需机械+语义双核对；（iii）新增失败语义/证据面（A1-6 级联、A4 所有权、`coverage`、N-1…N-6、B-3b 台账提取负控）待实现期闭合；（iv）B-4/B-5 两项事实核证待实现期闭合；（v）**G10 首落地证据为必查项**：BASE 首跑按 I-1 rev 2.1 对账基线逐项复现、N-6 三样本红、seam 自校验、I-3 自检断言逐项核对；I-2 联动条款在 gates diff 审查中专项核对（G12 未被弱化）。
2. **iter 2 修订已触碰「修订既有决策」与「验收/门禁语义变化」两类触发条件**（其追认已由 SA8 §13 完成，落地面待实现期核对）：F-8/X-1 重写 G10 候选/分类语义（**§9.2 rev 2 已追认为钉死值、X-1 暂停解除**——落地仍限 §12.1 文件 3）；F-5r/T-1a 改 E5 归类与自检定名（落地后 `units` 回填每基线 `observed===23` 与 69 并集判据实跑一致性核对）；N-1 接受判据改逐 suite 读法。iter 1 的 F-1/F-3/F-5/F-7、G6 挂基座等钉死语义维持。
3. **不**触碰任何 ADR 文本、wire/schema/持久化/状态机/公共 API 冻结面（零生产 diff，§5；SA6 §13 冻结面全数由断言+gate 守住而非修改）；无 owner 介入诉求（§15 末行、SA8 §9.4/§13.6）。
4. **本轮（iter 3）F-9 修订触碰 SA8 §13.5 钉死值的取证与自检表述面**：修后干跑使 `cat_3`/`cat_5` 相对 iter-2 追认时的报告值移动（9/2 → 7/4，两行 `*` 引导注释行 3→5，规范文强制、逐行解释、修前报告留档可 diff）、两行记录 token 由 `undefined` 修正为 `snap`/`input2`、回归自检表新增 cast 探针断言与一行 cast 实存锚点、R1 新增钉死句与 M4 跨行实参位钉死、I-1 对账基线更新为 rev 2.1 值——按 SA8 §13.5「任何增删须回 SA8」与 SA2 §18.7 路由，**回 SA8 增量追认后做 SA2 定向复审（仅 F-9 一点）**；N-6 三形态钉死内容未动（cast 形只进回归自检，§9.2 N-6 注）。
5. **本轮 delta 摘要（一句）**：`scan.mjs` 三处保真修复（cast 括 `inner[0]`、V_ctx 大小写敏感 `ctx`/`Ctx`、`commentSpan` 补 `*`/`/*` 注释行）+ 两 pass 复跑（`cat_6=0`/`--n6` 三形态仍 3 不变；`cat_3` 9→7、`cat_5` 2→4 = 两行 JSDoc 注释行规范文强制 3→5，token `undefined`→`snap`/`input2`，恰 4 行 delta、总数 285 不变）+ §9.2 自检两行按修后机械语义改写 + cast 两探针断言（⇒ 类 6，`cast-probe.mjs` 17/17）+ I-1/I-2/I-3 逐字吸收 + 对账基线更新为 rev 2.1 值。
