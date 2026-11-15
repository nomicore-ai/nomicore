# SA8 设计后冲突复查 — issue #471：Cordis rc.12 Hub/Peer/SessionHost 全链兼容（design 复查 + S1–S5 追认）

1. **Reviewed subject**: design（`wiki/raw/task_issue-471_design.md`，HEAD `d59a4d141c6c5ac7f267295829157d9570cde36e`，475 行全文逐节复审；重点 §5 零生产改动判定、§7 设施扩展 E1–E7/G1′–G12、§8 行为矩阵、§9 通道/迁移、§10 所有权、§11 负控、§12 ALLOW/DENY、§13 TDD、§14 AC 矩阵、§15 S1–S5 提案、§16 风险回退、§18 复查申报）。
2. SA8 dispatch：`sa-45cbe0c4-6f25-4513-b6de-f028f61a74a5`，iteration 0，phase conflict-gate。本会话只读核证（唯一写入 = 本报告）；未改任何被审对象、决策文档、src/test/设施，未运行测试。
3. 规范基准：ADR 全集 + CONTEXT.md + 协议/接入文档（`docs/AGENTS.md`：「Historical `wiki/raw/` artifacts are evidence, not normative contracts」）。#470 的 R1–R9 与 §8.6/§8.8、SA9 §8.2 均为 **wiki 证据工件中的票级裁决**——对 #471 必须先分类再继承，不得直接当作规范阻塞。

---

## 1. Inputs and decision set

| 输入 | 位置 | 本会话核对方式 |
|---|---|---|
| 被审设计 | `wiki/raw/task_issue-471_design.md` | 全文 475 行 |
| Owner 原文 | `wiki/raw/task_issue-471.md`（9 条 checkbox **L21–L29**；`## Comments` 空；Parent PR #469；Blocked by #470 已由 PR #473 合并解除） | 全文；L22（三基线×三入口×七场景）、L28（每基线全仓 typecheck + 点名测试面）逐字核 |
| SA6 验收契约（设计自认的规范来源） | `wiki/raw/task_issue-471_sa6_acceptance_contract.md`（§12.1–12.9 AC1–AC9、§13 冻结面、§14 三基线口径、§17.2 边界、§18.2 S1–S3/§18.3/§18.4） | 全文 |
| #470 裁决原件 | `task_issue-470_conflict_report.md`（R1–R9 §8 L162–L170、O1–O7）、`task_issue-470_design_conflict_report.md`（C-R4a–d）、`task_issue-470_impl_conflict_report.md`（iter-2 I-5/I-6/I-7 root-test 台账裁定、iter-3） | 关键节逐字 |
| ADR 0035 | `docs/adr/0035-cordis-rc12-root-compatibility.md`（状态**提议**；#470 SA8 已裁定其经 owner 正文收编为约束，#471 L21 同样点名「按 ADR 0035」） | 全文重读；§2 L45–L58、§3 L60–L70、§4 L72–L78、§5 **L82/L86–L90/L92**、§6 L96–L102 |
| 交叉 ADR | 0023（`0023-proxy-consumable-frozen-service-surfaces.md`：访问器+freeze 构造纪律、guard-Proxy 回归验收）、0032（edge/session 拆分、β 冻结/γ append-only、listen:false 互斥、公共面 append-only） | 关键条款重核 |
| 协议/接入文档 | `docs/protocols/instance-replication-v1.md`（wire 契约）、`docs/integration/cordis-plugin-hosting.md` L14–L66（装配序）+ L454–L488（单条拆卸链、drain 硬契约、Timer 覆盖整个排空过程） | 相关节重读 |
| 仓库事实 | `run-baseline.mjs`（870 行：`:50` `BASELINE_SUITES=MANIFEST.suites`、`NEW_FILES :67–79` 恰 11 条、unknown suite `fail('usage')` `:138–140`、`r5p` 回填 `:556–559`、`runFault :739–769`、`--all :802–828` 含 B1 专属 `ws-package` 块 `:809–811`）；`gates.mjs`（423 行，G1′–G9，`BASE='279dba4…'` `:41`）；`baselines.json`（`base=279dba4`、`suites` 恰 6 项）；`plugin.ts:200–298` seam（symbol 优先/legacy 兜底/malformed 不回落/F5 非对象宿主/两跳级联 `timer.ctx→ctx`/稳定文案/`rootTimer.timeout` 方法调用不 detach）；`profile.ts`（直接 apply + `await persistence.dispose(); await ctx.fiber.dispose()`）；根 `package.json:13` typecheck 恰 15 project；根 `vitest.config.ts`（`include: packages|domains|apps/*/test/**/*.test.ts`，`.ts` helper 不被收集）；`core-dsh-boundary.test.ts`（守卫 = 核心包不 import DSH、从核心包位置解析 `@nomicore/dsh-persistence` 必须失败、核心包 manifest 无 DSH 依赖——**全部是生产解析/清单面**）；overlay `reflect.d.ts:35`「already provided in this scope…」B1/B2/B3 三份同语义；被引用既有测试文件（`third-party-composition-red`、`issue270-*`、`on-fatal-error-issue288`、`persistence-drain-shutdown`（`persistence-drain-budget-exceeded` 唯一既有测试观察者）、`registry-sa7-rev1/-cordis`、`issue447-async-seam.ts`、`ws-replication-issue421-edge-factory-api.test-d.ts` 等）全部在盘；peer 工厂公开 override 含 `dial`/`random`（`plugin.ts:156/159/180`，注入面零 src 改动可行）；facility 内 `.base` 字段消费者 grep **零命中**（文档性字段主张成立） | 本会话逐处第一手 |

---

## 2. R1–R9 继承账本（dispatch 项 1）

| #470 裁决 | 本票处置 | 裁决与依据（规范锚点 + 仓库事实） | 需后续复查 |
|---|---|---|---|
| **R1** 全仓 typecheck 严格读法 | **原样继承** | 设计 §7.2 typecheck cell 零改动、§14 AC8/A8-1 同口径；根 `package.json:13` 本会话重数恰 15 project。分类：implements-existing-decision | 否（实现后由 cell 证据核） |
| **R2** ws 改动面 = `plugin.ts` + 恰好 4 fixture | **本票扩展（追认见 S2）** | R2 原文自限「**本票** ws-replication 允许改动面」——票级收口边界，非永久策略（#470 SA6 §3 同判）。#471 owner L22/L25/L28 要求新增 replication 行为/通道测试与设施扩展，必然超出该集合；扩展方向 = **+6 新测试文件 + helper**，且 `plugin.ts`/4 fixture 收紧为零 diff（§12.2 DENY）。分类：implements-existing-decision（owner AC 授权面内） | 是（实际 diff 对照本票 ALLOW） |
| **R3** ws 不做三基线行为矩阵、B2/B3 行为面仅附加证据 | **被本票合法取代（显式）** | 见 §3.1 专项裁定：取代合法，**不需要 ADR 修订，不需要 owner override** | 是（S1 实现核对） |
| **R4** seam 决策形态（symbol 优先/legacy 兜底/同步 loud fail/无 ambient/包内私有/cast 不扩散/生命周期不变） | **原样继承（断言化）** | 本票零生产 diff（§5）；`plugin.ts:200–298` 本会话实读，形态与 R4/C-R4a–d 逐条一致（F5 非对象宿主 `:247`、优先级 `:248–263`、级联 `:264–271`）；A1-1…A1-8 把形态转为三基线断言。**S2 的 plugin.ts 零 diff 收紧与 R4 无冲突**：R4 绑定的是 seam 形态（已由 #470 实现并冻结），不要求本票改码。分类：no-conflict | 是（A1 断言三基线实跑） |
| **R5** B3 provenance 8 项 | **原样继承** | provenance suite 零重写（§7.2）；`baselines.json` integrity/dshCommit/probes 期望零改动（§7.1、G12）。分类：no-conflict | 否 |
| **R6** AC 账本恒 8 条 + derived AC9 | **不适用（仅对 #470 有效）** | #471 owner checklist 恰 **9 条**（L21–L29，SA6 §1 核对 + 本会话复核）；套用 8+derived 会吞掉一条 AC。设计 §14 采用 9 条账本，正确。分类：no-conflict（正确地不适用） | 否 |
| **R7** 机械 gate（allowlist、index.ts 零 diff、公共面快照、manifest/lock/artifacts） | **扩展（追认见 S2/S5）** | allowlist 换为 **BASE 重钉 `d59a4d1` + 零 diff 断言**（G2/G3，D-5）；G4（index.ts）/G1′（manifest/lock/artifacts）/G7（docs）零改动保留；新增 G10/G11/G12。`index.ts`/manifest/lock/artifacts 零 diff 义务一项不减。分类：implements-existing-decision（更严） | 是（gates 首落地核对） |
| **R8** ADR 0023 冻结面 | **原样继承并扩展到 clock/registry/sessionhost 四处** | ADR 0023 的构造纪律（访问器+freeze）覆盖「凡经 `ctx.provide` 发布的 nomicore 服务对象」——扩展到四服务面 guard-proxy suite 是纪律的全量兑现，非新决策。零生产 diff。分类：no-conflict | 是（guard-proxy 三基线 cell） |
| **R9** 无阻塞性 Host/owner 问题 | **原样继承** | 本票 owner Comments 空（SA6 §2 实跑 `gh api` → `[]`）；Blocked by 已解除；无阻塞（§16）。分类：no-conflict | 否 |

### 2.1 专项裁定：R3 与 #470 §8.6/§8.8 B1-only 口径的取代合法性（dispatch 项 1 核心）

**裁定：合法取代；不需要 ADR 修订，不需要 owner override。** 依据链（每环本会话核证）：

1. **R3 自身预留了取代通道**：R3 原文（`task_issue-470_conflict_report.md` L164）把 ws-replication 限定为「编译面 + seam 语义 + B1 门禁」，其 O7（L182）明文「把 Replication 三基线行为矩阵并入本票 = 超出 owner 范围（L17『后续 Replication』）」——即 #470 的裁决**以「后续 Replication 票」的存在为前提**；#470 impl 报告 I-7 更把「Replication 三基线行为矩阵 + apps/yjs-server 行为验收」显式列为**后续票边界**。#471（Title 即 `Ticket(ws-replication)`，Parent = spec/468-cordis-rc12-root，Blocked by #470）就是被指定的那张后续票。被取代条款自带演进出口，属合法 supersession，不是 override。
2. **Owner 文本直接授权**：#471 L22「Hub、Peer、SessionHost 免 listen 模式在**三个目标基线上**分别通过……验收」、L28「**每个基线**分别通过全仓 typecheck，以及 Registry Cordis、Hub/Peer plugin、SessionHost、guard-Proxy、Nomicore DSH profile 和第三方组合根相关测试」——owner 亲笔、无歧义、Comments 空。B2/B3 行为面由「附加证据」升「必绿」是 owner checkbox 的直接读法。
3. **ADR 层无需任何修订，因为 ADR 本就要求**：ADR 0035 §5 **L82**「**每个目标基线**分别执行全仓 typecheck 和**同一组外部行为测试**；一个基线的绿色结果不得抵销另一个基线失败」+ **L92** 行为清单点名「Hub/Peer/SessionHost 启停和 timer 清理……DSH profile 以及第三方组合根」。B1-only 是 #470 的**票级收窄**（其 owner L17「后续 Replication」授权），不是 ADR 语义；S1 是**回到 ADR 基线**，方向是收紧而非偏离。
4. **被取代文本的规范层级**：`task_issue-470_design.md` §8.6（L386「B1 专属 cell……B2/B3 上运行本 suite 属允许的附加证据……只对 B1 列标记必绿」）、§8.8（L404/408）、`task_issue-470_sa6_acceptance_contract.md` §12.5、`task_issue-470_sa9_standards.md` §8.2（L118「不得宣称 Hub/Peer/SessionHost 三基线行为兼容……仍属后续票」）——全部位于 `wiki/raw/`，按 `docs/AGENTS.md` 是**证据工件，不是规范契约**；SA9 §8.2 是 #470 的**交付叙述**约束（不得把未验证说成已验证），不是「永久禁止验证」（#470 SA6 §18.4 已同判）。
5. **无残留义务**：取代后 #470 的 O7 防线（不超范围宣称）由本票 AC2 的「无证据即不通过」纪律继承；#470 交付叙述的既有限定声明（impl iter-2 I-6）不受影响——本票完成后可宣称的恰是「**本票矩阵覆盖的**三基线行为」，与 SA9 §8.2 的 #470 边界不冲突。

---

## 3. S1–S5 追认（dispatch 项 2）

### 3.1 S1 — 矩阵口径升级（ws-package 与 replication suite 在 B2/B3 升必绿 cell；`--all --matrix` 必纳入）

**裁决：追认成立。分类：implements-existing-decision**（兑现 ADR 0035 §5 L82 被推迟的义务）+ 票级取代（§2.1）。
- 依据：ADR 0035 §5 L82/L92（规范层）；owner L22/L28（授权层）；SA6 §14/§18.2 S1（契约层，同判）；实测三基线 `ws-package` 已 66/66 × 3（SA6 §4.3/§15.1），升级零成本。
- 机械承载成立：`ws-package` 入 `baselines.json.suites`（§7.1）后 `BASELINE_SUITES` 自动含之，`--all` 对三基线各跑（E6 删除 B1 专属块 `run-baseline.mjs:809–811`）；未知 suite 仍 `fail('usage')`（`:138–140`）。
- **绑定条件 B-1**：升级后 #470 语义「B2/B3 仅附加证据」在本票全部失效；任何交付叙述不得回退到 B1-only 口径。

### 3.2 S2 — 改动面扩展（§12.1 的 9+1 文件；`plugin.ts` 由「条件允许」收紧为零 diff）

**裁决：追认成立，且较 SA6 §18.2 S2 建议更严。分类：implements-existing-decision。**
- 与 R4 无冲突（见 §2 R4 行）：R4 绑形态不绑「本票是否改码」；形态由既有实现 + A1 断言 + G3 零 diff 三重锁定，比「允许改」更满足 R4。
- 零生产改动判定（§5）事实复核通过：seam 逐行为与 R4/C-R4a–d/F5 一致（`plugin.ts:200–298` 实读）；A1-3 同步 throw（`timerFromContext` 在 apply 内同步调用，`:508–514`/`:703–708` 调用点 + `:224–226` 文案）；两跳级联三态与 §8.1/A1-6 一致；`profile.ts` dispose 序与 A4-4 断言锚点一致；G1–G8 全为证据/设施缺口（SA6 §5.2 诚实边界）。**反向闸门**（§5：cell 因生产行为判红 → 停 cell 留证上报，不得就地修 `src/**`）正确地把「零 diff」从静态清单升级为运行期纪律，追认。
- S3 的生产依赖图零变化主张成立：peer 注入面（`dial`/`random`，`plugin.ts:156/159/180`）与 listen 适配器均为既有公开 override，零 src 改动即可装配。

### 3.3 S3 — 跨包测试面依赖（ws/app 行为 suite 由 `packages/persistence/test/fixtures/cordis-baselines` 承载）

**裁决：追认成立。不构成生产依赖违规，不违反 `core-dsh-boundary` 反向依赖守卫。分类：no-conflict。**
- 依据：AC7「不建第二套」（owner L27）的直接结果——`run-baseline.mjs`/overlay 是**验收设施**（runner + 工件表 + symlink farm），产物全部落在 gitignored 的 `.cache/`（`baselines.json` 注释/`#470` 交付形态本会话核证）；生产 `package.json` 依赖面零 diff（A9-5/G1′）⇒ 依赖图零变化。
- `core-dsh-boundary.test.ts` 本会话实读：其三条断言全部锚定**生产**解析方向（核心包模块位置解析 `@nomicore/dsh-persistence` 必须失败；核心包 manifest 无 DSH 依赖；核心插件裸 Cordis 启停）——测试设施目录的消费者关系不进入其任何断言面。该测试自身在 DENY（零 diff），守卫持续在跑。
- 跨包 import 先例在盘：`packages/ws-replication/test/` 既有 `harness.ts`、`issue238`、`ac5-live` 已 import `@nomicore/persistence`（本会话 grep）——新 lifecycle 测试以 persistence 为装配依赖（SA6 §12.2 AC2 同判「装配依赖」）沿用既有测试面形态，非新边界。
- **绑定条件 B-2**：禁止把 fixture 复制进 ws/app 包（防第二套，设计 §15 S3 已承诺）；测试不得硬编码 `.cache` 绝对/相对路径（A7-3，只读 runner 注入 env）。

### 3.4 S4 — root-test cell 改「台账判定」（运行+留证，`failedTestNames ⊆ root-test-known-red.json` 才 pass）

**裁决：可接受，追认成立——附 5 条绑定条款（B-3a…B-3e）；台账文件入 ALLOW。分类：no-conflict（票级验收语义，落在 SA6 预授权包络内且更严）。**

理由链：
1. **不可满足性已由 #470 裁定确立**：root-test 面存在 4 例 BASE 既有 test-d 红（`ws-replication-issue421-edge-factory-api.test-d.ts` × expect-type@1.4.0 可选参数元组不兼容）+ 28 例环境红（pnpm packageManager 未对齐）。#470 impl iter-2 I-5.2 四重证明其为 base 分支自身 CI lane 既有红、修复被显式指派**另立后续票**（I-7），且在本票 ALLOW 内同样不可修（该文件属 §12.2 DENY 既有测试；升工具链触 G1′）。若 root-test 维持无条件 gating（备选 a），`--all --matrix` 永红，AC8-3 收口不可满足——与 #470「§17-3 阻断 vs ALLOW 禁修联合不可满足」同构，SA8 已裁定该形态的自设规则不能自动升格为决策层阻断。
2. **SA6 预先授权了方向**：SA6 §17.2-2 明文本票必须预先二选一：「对齐 packageManager 复跑并如实披露」或「把 root-test 排除在『本票必绿』之外并写明理由（**推荐后者 + 披露**，与 #470 处置一致）」。S4 是推荐项的**严格化**：仍运行、仍留证、新增红仍 gate（备选 b 完全排除会丧失对新红的回归灵敏度；S4 保留之）。
3. **不触犯 R1/反掩蔽纪律**：R1 的禁令锚定「全仓 typecheck 15-project」车道（#470 impl §4.2(a) 同判：test-d lane 与 typecheck lane 是两条 lane）；root-test lane 的规范根基是模块 AGENTS 的「跑根 test」= **执行 + 如实上报义务**（#470 impl iter-2 I-5.2-1），不是「必须全绿」义务。台账法履行执行与上报，且把「新增红」重新 gate 化。
4. **A8-4 相容**：A8-4 禁的是「静默为已知债务而不披露」；S4 以 `failedUnexpected[]` + `disclosure` 字段 + 交付摘要逐条披露 + 「禁止宣称 root-test/CI 全绿」的显式禁令（设计 §13.2/§16-R6）消解「静默」要素，继承 #470 impl iter-2 I-6 七条限定声明的血脉。

**绑定条款（缺一即台账机制违例）：**
- **B-3a（台账来源冻结）**：台账唯一合法内容 = **Step 0 在 BASE（`d59a4d1`，未做任何本票改动）实跑捕获**的失败清单，且逐条归因映射到 #470 已裁定红集（4 例 test-d `knownRed` + 28 例 packageManager 环境红 `environmentRed`，各带归因注记）。对齐环境（`corepack pnpm@10.28.2`）下复跑预期 28 例转绿、台账收敛为 4——两种捕获形态均合法，但**实现/验证阶段不得向台账新增任何条目**；新增 = 掩蔽新红 = 违例，须回 SA8 复审。
- **B-3b（判定谓词与提取机制）**：pass 判定 = **完整测试名集合级** `failedTestNames ⊆ (knownRed ∪ environmentRed)`（禁文件级/计数级近似——计数级会以「旧红转绿」抵销「新红出现」）。实现必须核证 failedTestNames 提取覆盖 **typecheck lane**（test-d）失败（#470 impl 曾出现 `root-test.json` testNames 空、需 R-4 回填的先例）；核证方式 = Step 0 台账捕获时 4 例 test-d 必须实际出现在 failedTestNames（这是台账机制自身的负控）。
- **B-3c（新文件永不可入账）**：§12.1 全部新测试文件（含 helper 支撑的测试）的任何失败**永不落入台账**——D-7 已要求新测试默认布局必绿，新文件红 = 真红 = cell fail。
- **B-3d（披露绑定）**：cell JSON 恒携带 `failedUnexpected[]`（pass 时为空）+ `disclosure`；交付摘要逐条列出在账红（名称+归因），并继承 #470 I-6 血脉的表述禁令（不得声称「root-test/CI/既有测试全绿」）；环境红在场时必须同步披露对齐环境复跑证据或其缺席事实。
- **B-3e（语义钉死）**：`--all` 聚合语义不变——任一 gating cell 红 ⇒ exit≠0，绿不抵红；root-test 行仅在 B-3a/b/c/d 全部满足时按台账判定 pass。台账文件入 G12 的设施 diff 白名单（设计已列）。

**若否决的回退语义（按 dispatch 要求明示）**：回退为「root-test cell 完全不 gating（不进 pass/fail 判定，仅运行 + 留证 + 交付摘要披露）」——即 SA6 §17.2-2 的推荐原案；**不得**回退为无条件 gating（不可满足），也不得以任何环境 shim 注入交付链路换取全绿。S4 与回退案二选一时必须在交付记录中显式写明所选语义。

### 3.5 S5 — gates 比较基座重钉 `279dba4 → d59a4d1`

**裁决：追认成立。分类：no-conflict（设施内部常量的票级语义变化，方向为收紧）。**
- 依据：`gates.mjs:41` `BASE` 是 #470 交付的设施常量，属本票 ALLOW 可改文件；`d59a4d1` 即本票设计基线（PR #473 合并提交）。保留旧基座存在**防回退盲区**（D-5）：把 `plugin.ts` 回退到 `279dba4` 形态会使 diff 变空而 allowlist gate 仍绿——重钉 + G2/G3 零 diff 断言后，#470 已交付面（`service.ts`/`plugin.ts`/4 fixture/设施）全部进入反回退保护，严格更强。
- `baselines.json.base` 文档性同步主张核实：facility 内 `.base` 消费者 grep **零命中**（本会话）；integrity/dshCommit/probes 零改动（G12 执法）。
- **绑定条件 B-4（A6-4 三基线不可降级）**：设计 §14 AC6 行中「interop/结构守卫经 replication-lifecycle cell 内嵌套运行**或默认布局留证**」的「或默认布局留证」从属于 SA6 §12.6 A6-4「`issue246-interop-matrix` 与 `issue418-*` 结构守卫在**三基线**通过」的契约判据——**A6-4 点名文件必须取得三基线 cell 证据**，默认布局留证只可用于契约未点名面的补充，不得作为 A6-4 的替代。实现文件归置可在 §12.1 ALLOW 内微调（§14 脚注），判据不可变。
- **绑定条件 B-5（G5 快照事实核证）**：`public-surface.base.json` 内容不变的主张（#470 未动任何 `src/index.ts`，`d59a4d1` 面 == `279dba4` 面；快照内容不含基座 sha）由实现期 G5 实跑验证；若快照需重拍，仅允许基座元数据差异，导出名集合差异 = AC6 红。

### 3.6 S5 之外的规范冲突检查（dispatch 项 4）

| 规范面 | 条款 | 设计行为 | 分类 |
|---|---|---|---|
| ADR 0035 §2（双形态 Root、包内私有、cast 不扩散、统一迁移） | L45–L58 | 零生产 diff；seam 断言化（A1-1…A1-8）；G10 零残留 gate 把「统一迁移」机械化（允许清单恰 `service.ts`+`plugin.ts` 两 seam + 显式双读探针）；4 fixture 逐字节不动 | no-conflict / implements |
| ADR 0035 §3（调度所有权、停机序、不销毁上游、watchdog/有界 drain、直接 apply dispose 序） | L60–L70 | AC3/AC4 全部为**断言**（A3-1…A3-5、A4-1…A4-4）；`profile.ts:98–109` 既有序为锚点；零改动 | no-conflict / implements |
| ADR 0035 §4（依赖/公共契约不变、无 volatile config/internal 事件、不读私有 Fiber store） | L72–L78 | G1′ 零 diff；**G11 新 gate** 把 L77–L78 的禁令（`volatile config`/`internal/config`/`internal/update`/`internal/commit`/私有 Fiber store）机械扫描到 `packages|apps|domains/*/src`，允许清单 = 空集 | implements-existing-decision（新增执法面） |
| ADR 0035 §5（三基线、provenance、解析断言、探针、负控） | L82–L92 | S1 兑现 L82；provenance/root-probe 原样（R5）；N-1/N-2 复用 `--fault` 编排（`runFault :739–769` 原样）；L92 行为清单逐条映射 AC1–AC8 | implements-existing-decision |
| ADR 0035 §6（排除 Host 部署/patch 移除） | L96–L102 | 非目标明列（§1）；A9-4 命令白名单 | no-conflict |
| ADR 0023（访问器+freeze 构造纪律、guard-Proxy 回归） | 决策节+验收节 | 零生产 diff；guard-proxy suite 三基线 + 扩到 clock/registry/ws/sessionhost（纪律全量兑现） | no-conflict |
| ADR 0032（edge/session 拆分、β 冻结/γ append-only、listen:false 互斥、公共面 append-only） | L30/L48/L57–L61/L110–L112 | β/γ 补充单元为**注入 timer 的工厂行为断言**（§8.3，不读 `ctx.root`，SA6 §10.2 同判）；`issue447-async-seam.ts`/β 生产面零 diff（DENY）；startup 场景断言两入口服务互斥（§8.2） | no-conflict |
| wire 协议（`instance-replication-v1.md`） | 全文（1154 行） | 零生产 diff ⇒ 帧布局/sequence/握手/capability 不变；A6-4 经 interop matrix + 结构守卫三基线断言；`replication-protocol/**` DENY | no-conflict |
| 持久化布局 | ADR 0006/0014 锚 | A6-5 contract suites 三基线断言；持久化键零增改 | no-conflict |
| Cordis 使用面纪律（hosting 文档 L14–L66/L454–L488） | 装配序/单条拆卸链/Timer 覆盖排空 | §8.1 最小装配 = Instance→Clock→Timer→Persistence→Registry→replication（与文档一致）；§10.2 拆卸沿单链；A4 断言「Timer 最后释放」「drain 前置 dispose」 | no-conflict / implements |
| 模块 AGENTS（persistence/ws-replication/yjs-server 等） | 验证门 | 根 test 义务 = 执行 + 如实上报（S4 台账 + 披露履行）；包 typecheck 经 15-project cell 三基线 | no-conflict |

**结论：无任何条款与 ADR/协议/接入契约冲突；无需要额外 ADR 裁决的面。**

---

## 4. Decision analysis（汇总表）

| Decision | Clause | Subject behavior（设计） | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| ADR 0035 §5 | L82/L92 | S1 三基线必绿矩阵 | implements-existing-decision | ADR 逐字；Issue L22/L28；`run-baseline.mjs:809–811` 现状 B1-only | B-1 |
| #470 R3/O7 + SA9 §8.2 + 设计 §8.6/§8.8 | 票级 B1-only | 显式取代 | （票级 supersession，合法） | §2.1 链；`docs/AGENTS.md` 证据非规范 | B-1 |
| #470 R2/R7 | 票级 allowlist | S2/S5 扩展 + 收紧 | implements-existing-decision | Issue L22/L25/L27/L28 | §5 ALLOW/DENY 发布 |
| #470 R4/C-R4a–d/F5 | seam 形态 | 断言化零 diff | no-conflict | `plugin.ts:200–298` 实读 | A1 三基线实跑 |
| #470 R5/R8/R9、ADR 0023 | provenance/冻结服务面/无阻塞 | 原样继承/扩展 | no-conflict | §2 表 | cell 证据 |
| ADR 0035 §4 L77–L78 | 无 volatile/internal | G11 机械扫描 | implements-existing-decision | 设计 §7.3 G11 | G11 首落地核 |
| SA6 §17.2-2 + #470 impl I-5/I-6/I-7 | root-test 已知红处置 | S4 台账判定 | no-conflict（预授权包络内，更严） | §3.4 链 | **B-3a…e** |
| SA6 §12.6 A6-4 | interop/结构守卫三基线 | §14 行含「或默认布局」歧义 | no-conflict（须按契约读法收口） | SA6 §12.6 逐字 | **B-4** |
| AC7/owner L27 | 不建第二套 | S3 跨包测试面依赖 | no-conflict | `core-dsh-boundary.test.ts` 实读；`.cache` gitignored | B-2 |

## 5. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| —（无） | — | — | — |

本票**不存在也不需要** override：S1 是 ADR 0035 §5 L82 的兑现 + #470 票级条款的**自带出口取代**（§2.1）；S2–S5 均为票级收口/设施语义，规范集合内可解。SA8 不替 owner 创设 override；owner 亦无任何表态（Comments `[]`）。

## 6. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| wire 协议/帧布局/状态机 | 零改动 | 协议文档；DENY `replication-protocol/**`、`ws-replication/src/**` 状态机 | 设计承诺零生产 diff；待实现核对 |
| 公共导出面（各 `src/index.ts`） | 逐字节不变 | G4；ADR 0035 §4 L76 | 持守（待 G4/G5 实跑） |
| 服务名 8 字面 | 不变 | §13/AC6-3；ADR 0009/0012/0032 | 断言承载 |
| 持久化布局 | snapshot/META/JSONL 键名不变 | A6-5；ADR 0006/0014 | contract suites 三基线 |
| Host 装配序/拆卸链/Timer 最后释放 | 不变 | hosting L14–L66/L454–L488；ADR 0035 §3 | AC3/AC4 断言 |
| 服务构造形态（ADR 0023） | 访问器+freeze | R8 | guard-proxy 四面三基线 |
| 配置形态 | 无 volatile/internal/私有 store | ADR 0035 §4 L77–L78 | G11 |
| 稳定错误文案 | 既有文案逐字节（`required Cordis service "timer" is unavailable` 等） | `plugin.ts:224–226`；#470 冻结面 | A1-3/A1-5 逐字体断言 |
| `#470` 已交付面 | `service.ts`/`plugin.ts`/4 fixture 对 `d59a4d1` 零 diff（**本票新增反回退面**） | S5/G3 | 待 gates 实跑 |
| 设施冻结子面 | `acquire.mjs`/`root-probe.mjs`/`provenance-b3.json`/`public-surface.base.json` 零 diff | G12 | 待实跑 |
| 既有测试（含 4 具名 fixture、`issue421 test-d`） | 逐字节不动 | §12.2 DENY；A5-3 | 待 G3/矩阵核对 |
| manifests/lock/artifacts/docs/tsconfig/vitest.config | 零 diff | G1′/G6/G7/G9 | 待实跑 |

## 7. Evolution requirements

**无。** 设计未触碰任何 ADR/CONTEXT/协议文本；S1–S5 全部为票级收口或设施语义，修订对象（#470 §8.6/§8.8/SA9 §8.2）是 wiki 证据工件且自带取代出口，无文档修订义务。

## 8. Hard conflicts

**无。** O1–O7 红线（#470）零回归：O1/O2（子集/带债收口）——typecheck 仍 15-project 全绿口径，root-test 红以台账 + 披露处置而非宣称绿；O4（cast 压静）——零 diff；O5（官方流水线）——诚实标注沿用；O6（升依赖/硬切）——G1′ 零 diff；O7（行为宣称）——行为矩阵按 owner 授权建立，宣称范围 = 本票矩阵覆盖面。

---

## 9. Required actions — 本票 ALLOW/DENY 发布与边界收紧（dispatch 项 3/5）

### 9.1 本票约束性 ALLOW（SA3 唯一可改动/新增面；共 10 文件，闭合）

| # | 路径 | 授权依据 |
|---|---|---|
| 1 | `packages/persistence/test/fixtures/cordis-baselines/baselines.json` | AC7/A7-1（§7.1：suites 尾部追加 6 项、`base` 重钉、comment 一句；integrity/dshCommit/probes 零改动） |
| 2 | `packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs` | AC7/A7-3/A7-5/A7-6（§7.2 E1–E7 钉死；§7.2 零改动面清单保留） |
| 3 | `packages/persistence/test/fixtures/cordis-baselines/gates.mjs` | R7 扩展/A5-1/A9-1/A7-1（§7.3：G2/G3/G5/G8 更新 + G10/G11/G12 + BASE 重钉；G1′/G4/G6/G7/G9 零改动） |
| 4 | `packages/ws-replication/test/ws-replication-cordis-root-channel.test.ts` | AC1/AC5（A1-1…A1-7、A5-2/A5-4） |
| 5 | `packages/ws-replication/test/ws-replication-cordis-root-timers.test.ts` | AC1/AC3（A1-8、A3-4） |
| 6 | `packages/ws-replication/test/ws-replication-cordis-baseline-lifecycle.test.ts` | AC2（63+6 单元 + β/γ + N-5） |
| 7 | `packages/ws-replication/test/cordis-baseline-support.ts` | §8.1 测试 helper（非 `.test.ts`，根 glob 不收集——本会话核证 include 模式） |
| 8 | `apps/yjs-server/test/third-party-timer-ownership-red.test.ts` | AC3/AC4（A3-2、A4-1…A4-3） |
| 9 | `packages/dsh-persistence/test/dsh-profile-direct-apply-order.test.ts` | AC4（A4-4；SA6 §12.4 证据载体点名直接 apply 装配用例） |
| 10 | `packages/persistence/test/fixtures/cordis-baselines/root-test-known-red.json` | **S4 追认后由条件转正**（B-3a…e 绑定） |

**DENY = 上述 10 文件之外的仓库全部路径**（设计 §12.1「无其他任何文件可改」的闭合世界条款即操作性 DENY；§12.2 清单为强调性列举，二者一致）。**必须增删的条目：无**——设计清单与 owner 授权面逐条对上，无多余、无缺失；唯一状态变化 = 条目 10 转正。

**与 #470 allowlist 的关系**：#470 R2 的「可改清单」（`plugin.ts`/`service.ts`/4 fixture）在本票**全部翻转为对 `d59a4d1` 的零 diff 义务**（S5/G2/G3）——由「允许改」升「禁止回改」；#470 的新增设施文件中 `run-baseline.mjs`/`gates.mjs`/`baselines.json` 转为本票**限编辑点**可改（E1–E7 / G-清单），`acquire.mjs`/`root-probe.mjs`/`provenance-b3.json`/`public-surface.base.json` 保持冻结（G12）；#470 的 4 个 `.test.ts`（channel/real-timer/provenance/public-surface）零 diff。

### 9.2 边界收紧条款（dispatch 项 5；封堵三处可绕缝隙）

- **T-1（改 runner 单元定义放松断言）**：E5 的 `units={expected:23,…}` 与 repeat 计数、suite→文件清单、pass 谓词（counts.failed===0 ∧ 目标测试名在场 ∧ units.observed===23）以本报告为**钉死语义**——`run-baseline.mjs`/`gates.mjs` 的实现 diff 只准表达 §7.2/§7.3 列举的编辑点，任何其他语义变化（缩小 expected、放宽谓词、改 include 模式、绕过 `--passWithNoTests=false`）= 越权，SA8 实现复审按本报告逐字核对。行为面锚点独立于 runner：lifecycle 文件尾部 `it('L.coverage')` 自检 23 单元名（测试文件内，runner 改不动）。
- **T-2（gate allowlist 自我豁免）**：`gates.mjs` 属 ALLOW，理论可自我放宽—— countered by（i）本报告 §9.1 发布的闭合 ALLOW/DENY 是**裁决层**约束，gates 只是机械承载，两者不一致以本报告为准；（ii）G12 使设施目录内除 4 文件外零 diff，`gates.mjs` 自身 diff 面小且可逐行审；（iii）SA4/SA10/SA8 实现复审必查 gates diff 是否恰为列举编辑点。G10 分类器的允许清单（两 seam `Reflect.get` + 显式双读探针）与 G11 允许清单（空集）同为本报告钉死值。
- **T-3（台账新增豁免）**：即 B-3a/c——台账冻结于 Step 0 BASE 捕获、逐条映射 #470 裁定红集、新文件失败永不可入账、新增条目须回 SA8；G12 把台账文件纳入设施白名单使任何后续改动可机械检出。
- **T-4（配套）**：负控 N-6（G10/G11 注入定向红）与 B-3b（4 例 test-d 必须出现在 failedTestNames）是台账/gate 机制自身的可证伪性证明，实现阶段必须实跑留证。

### 9.3 交付条件（dispatch 项 6；全部成立的硬约束）

1. **零生产 diff**：`git diff --name-only d59a4d1 -- 'packages/*/src' 'apps/*/src' 'domains/*/src'` 为空；各 `src/index.ts` 零 diff；实际 diff ⊆ §9.1 十文件。
2. **gates 12/12 PASS**（含 G10 命中清单第 6 类为空 + 自校验、G11 零命中、G12 设施白名单精确）。
3. **三基线 typecheck**：B1/B2/B3 各 15/15 project exit 0，逐 project 留证（R1 严格读法，禁子集/掩蔽/冒充）。
4. **矩阵 41 行**：12 suite × 3 基线全部 `status==='pass'` + gates + root-test（按 B-3 台账判定）；任一 gating cell 红 ⇒ exit≠0；`replication-lifecycle` 每基线 `units.observed===23`、三基线并集 69 单元名在场且 passed；`ws-cordis-timers` 12 族三基线在场且 passed。
5. **A1 断言三基线全绿**，错误文案逐字体一致（A1-3/A1-5 稳定文案）。
6. **N-1…N-6 全部「应红实红」留证**；M-1/M-2 对三基线至少各一轮且副本用后还原（diff 校验逐字节一致）。
7. **4 具名 fixture 逐字节不动**且 `ws-package` 三基线 66/66（A5-3）。
8. **S4 台账合规**（B-3a…e 全项）：Step 0 BASE 捕获、内容 ⊆ #470 裁定红集（4+28 带归因）、名级谓词、failedUnexpected 恒空、A8-4 披露写入交付摘要（含不得宣称全绿的表述禁令）。
9. **新测试默认布局必绿**（D-7）：root-test 因本票新增文件产生的红 = 真红（B-3c）。
10. **反向闸门执行记录**：任何矩阵 cell 若因生产行为判红，已停 cell、留证、上报（未就地修 `src/**`）。
11. **AC9 全机械面**：依赖面/manifests/lock/artifacts/docs 零 diff；无 volatile/internal 用法；验收命令白名单（node/git/tsc/vitest）；无部署/patch。
12. 交付摘要按设计 §13.2 绿灯判据闭合 + A8-4 披露 + §16.3 调用方影响矩阵核对。

**若设计被否决时的修订要求（本票不适用，留档）**：S4 否决 → 回退语义见 §3.4（root-test 不 gating + 披露，二选一显式记录）；S5 否决 → 保留 `279dba4` + 扩 allowlist，并接受「#470 面回退不可侦测」盲区的显式披露；S1/S2/S3 否决 → 需 owner 改写 L22/L25/L27/L28 checkbox（因三者直接兑现 owner 文本），不属 SA8 可单方否决面。

### 9.4 需 owner 介入的判定

**无。** 无 override 诉求、无阻塞性冲突、无规范集合内不可解项。#470 遗留的 4 例 test-d 红已由 #470 impl iter-2 裁定「另立后续票、限定声明收口、owner 表态欢迎但不前置」——本票 S4 台账与该裁定同向，不产生新的 owner 问题。

---

## 10. Verdict

**clear** —— R1–R9 经分类后逐条成立（R1/R4/R5/R8/R9 原样、R2/R7 票级扩展、R3 票级合法取代、R6 不适用）；S1–S5 全部追认成立（S1 = ADR 0035 §5 L82 的兑现；S2 较 SA6 建议更严；S3 为测试面依赖、生产依赖图与 `core-dsh-boundary` 守卫零影响；S4 落在 SA6 §17.2-2 预授权包络内且以 B-3a…e 绑定；S5 为收紧性重钉）；规范冲突检查零命中；ALLOW/DENY 清单闭合且与 owner 授权面精确对齐，无需增删（仅台账条目转正）；三处可绕缝隙以 T-1…T-4 封堵。设计可放行实现，前提是实现逐条吸收 §9 绑定条款（B-1…B-5、T-1…T-4、§9.3 交付条件）。

## 11. requiresConflictRecheck

**true** —— 理由：(i) S1–S5 全部是**验收/门禁语义变化面**（矩阵口径升级、`--all` 收口语义、gates 基座与新增 G10–G12、ALLOW/DENY 执法），实现后须按本报告钉死语义逐项核对实际 diff 与 gates 首落地行为；(ii) 实际 diff 是否守住 §9.1 十文件闭合清单（含 #470 已交付面零回改）需实现后机械 + 语义双核对；(iii) 新断言面（A1-6 级联冻结、A4 所有权存活、L.coverage 自检、负控 N-1…N-6、B-3b 台账提取负控）为新增失败语义/证据面，属实现后复查触发；(iv) B-4/B-5 两项事实核证（A6-4 三基线归置、G5 快照内容不变）待实现期闭合。

---

# SA8 增量冲突复查（iteration 1）— 设计修订版守界裁决

**Reviewed subject**: design 修订版 `wiki/raw/task_issue-471_design.md`（475→528 行，基线仍 HEAD `d59a4d1`，骨架不变；本轮改动 = SA2 F-1…F-7 逐条闭合 + 本报告 iter-0 §9 约束吸收，见修订版 §4.1/§17/§17.1）。SA8 dispatch：`sa-6ae0b26f-0c74-4dae-be0b-76ab607ce287`，iteration 1，phase conflict-gate。本会话只读核证（唯一写入 = 本报告本章追加）；未改任何被审对象、决策文档、src/test/设施，未运行测试。
**规范基准**：与 iter-0 §1 相同（ADR 全集 + CONTEXT.md + 协议/接入文档），本章不重复决策集。
**本章地位**：本章是对 iter-0 §9 约束性裁决的**增量裁决**，为当前结论；iter-0 §1–§11 除本章明示修订/增补（T-1a、X-1、E-增补授权）外**全部继续有效**。

## 12.1 本会话第一手核证（增量证据锚点）

| 对象 | 核证结果 |
|---|---|
| G10 允许清单锚点 | `ws-replication-plugin.test.ts:19`、`issue299-ac-red.test.ts:171`、`issue422-listen-false.test.ts:39` 三处确为 `Reflect.get(ctx, Symbol.for('cordis.root')) ?? Reflect.get(ctx, 'root')` 双读；`service.ts:86`/`plugin.ts:251` 确为 `safeReadChannel(host, 'root')`（M4 实参形态）；`cordis-root-channel.test.ts:445–475` F9 纪律实存（shim 同一受控 ctx + `Reflect.get` 双读 + legacy 缺席断言） |
| G10 扫描面现状 | `.root` 成员读取形态在扫描面（packages/*/src+test、apps/*/src+test）共 **214 处、≥25 文件**：`doc-runtime/test/issue-348`（64）、`issue-350-batch-envelope-red`（19）、`vfsl/test/schemasource-seam`（18）、**`namespace-registry/src/registry.ts`（14，`record.root`/`payload.root`/`p.root`）**、`issue301`（13，其中 `:624/645/836` 为 `ctx.root('hub',…)` helper 调用=第 2 类）、`cordis-root-channel.test.ts`（8，文件级允许覆盖）、`vfsl/src/schemasource.ts`（3）、`doc-runtime/src/create-initial-document.ts`（3）等；seam 文件自身的 `.root` 命中全部为字符串字面量/注释（`plugin.ts:210/217/264`、`service.ts:41/46/49`——即第 1 类 seam 锚只能靠 M4 实参形态成立，与修订版一致） |
| E4a 事实前提 | `runVitest` 调用点恰三处（`:542` 通用分支、`:581` root-probe、`:614` ws-package）+ E4/E5 新分支；`extraEnv` 仅 `:584` 注入（通用分支 `:540–548` 确不传）——F-1 缺陷与修法均属实；`NOMICORE_CORDIS_FAULT` 为既有 env 名（无新名，B-2 保持） |
| F-6 旋钮锚点 | `hub-edge.ts:356`（GOAWAY `drainTimeoutMs = timeouts.closeTimeoutMs`）+ `:363–364`（reauth deadline 以 `closeTimeoutMs` 武装）✔；`hub-connection.ts:175–183`（auth 封顶 = `this.timeouts.helloTimeoutMs`，注释明文「零新 knob」）✔；`hub-namespace.ts:1050` `armTimer('assembly')` ✔；`plugin.ts:761` `timer.setTimeout(check, 25)` 字面量 ✔；TIMEOUT_KEYS/BACKOFF_KEYS（`plugin.ts:182/183`）与 §9.1 表 11 键载体一一对应、无 `reauthTimeoutMs` ✔ |
| F-3 在盘事实 | `issue246-interop-matrix`（4 用例）、`issue418-edge-session-split-{contract,structure}`（17/9 用例）、`issue420-session-host-round`、三个 guard-proxy-consumption 文件全部在盘，数量与设计主张一致 |
| gates/runner 形状 | `gates.mjs:109–139` `changedPaths`（tracked diff ∪ untracked）/`assertNoChange`/`assertAllowlist` 与 F-7 描述一致；`gates.mjs:372` `git diff --check` 确无基座；`run-baseline.mjs:139` `'gates'` 死字面量确在白名单表达式（`runSuite` 无分支、gates 经 `runGatesCell` 于 `--all` 承载）；root-test `diagnostics` 先例 `:729–733`、r5p 回填 `:556–559` 实存；`--all` B1 专属 ws-package 块 `:809–811` 实存（E6 删除目标） |
| 台账文件 | `root-test-known-red.json` 在盘不存在 ✔（应由 Step 0 捕获后新建，属 §9.1 条目 10）；`baselines.json` 现值 `base=279dba4`、suites 恰 6 项（S5 重钉 + 6 追加 = 12 suite 算术成立） |

## 12.2 逐项裁决（dispatch 项 1–7；每项 clear/reject + 修订版行锚点）

### 项 1 — ALLOW 守界：**clear（文件级）**，附编辑点增量授权；无文件级增删

- **十文件闭合清单未被扩出**：修订版 §12.1（L330–345）仍恰 10 文件（台账条目 10 转正），DENY = 十文件外全部路径（L345/L349 闭合世界条款原样）；无第 11 文件；#470 已交付面零回改义务（iter-0 §9.1 末段）经 F-7 G2/G3 形状仍被覆盖——`plugin.ts`/4 具名 fixture 走 G3（tracked diff 不在 4 新文件的 allowed 内即 FAIL），`service.ts` 走 G2（persistence src `assertNoChange`），回退判据明文（L176「回退 `plugin.ts` 或改任何既有 ws 测试时 G3 FAIL」）。
- **编辑点增量授权（E-增补；全部落在既有 ALLOW 文件 2/3 内，逐条 RATIFY）**：
  - `run-baseline.mjs`：**E4a**（L163：全部 `runVitest` 调用点贯通 legacy-shim `extraEnv` + N-2 升级为逐 suite `cells[]` 均 fail）——修的是 SA2 F-1 揭出的伪证明通道，方向**更严**，且 `runFault` 编排结构保留（L168）、env 名零新增（B-2 保持）；**E3 附带** `'gates'` 死字面量清理（L161，unknown-suite `fail('usage')` 语义不变，gates 仍经 `--all` 承载）；**E4 附带** 可选 `diagnostics` 字段（L162，镜像 `:729–733` 先例，明文「不参与 pass 判定」）。
  - `gates.mjs`：**G6 挂基座**（L175：`git diff --check <BASE>`，语义 = 本票 tracked diff 恰 3 设施文件零 whitespace error——#470 SA9 S9-M3 盲区的收紧）；**G2/G3 判据形状**（L176，F-7：G2 `assertNoChange` 三 src + G3 `assertAllowlist` allowed=4 ws 新文件，等效双判据明文）——两者均为形状修正/收紧。
  - **F-3 suite 常量钉死**（L159 E1 / L189 / L192 / L423）：guard-proxy 六文件、`WS_LIFECYCLE_FILES` 双文件、`UNLOAD_FILES` 双文件；suite 总数仍 12（guard-proxy 沿用不新增），矩阵 41 行算术不变（L196）——属 iter-0 B-4「归置可在 ALLOW 内微调、判据不可变」预期内的**设计层收口**，RATIFY。
  - **除外**：G10 §9.2 算法语义（L267–288）**不在本授权内**，见项 7 / X-1——文件级仍属 ALLOW 文件 3，但其语义须按 §12.8 重设计后回本章追认。
- 观察项（非违例，iter-0 以来未变）：G2/G3 机械面之外的 src（clock/instance/doc-runtime/vfsl/replication-protocol/namespace-runtime/api/diagnostic-log）与 apps/dsh test 目录的新文件无逐路径 gate，由 §9.3-1 交付条件（生产树 diff 空集 + 实际 diff ⊆ 十文件）与实现复审承载——非本轮回归。

### 项 2 — T-1 语义钉死：**reject（可修正）**——数值未缩、谓词未放宽，但 F-5 命名 + E5 句法归类使钉死谓词按原文**不可满足**；发布 **T-1a** 钉死

- 守住面：`expected:23` 原样（L164）；pass 谓词原文引用本报告钉死语义（L164「T-1 钉死：counts.failed===0 ∧ 目标测试名在场 ∧ units.observed===23」）；repeat 口径不变（D-4）；`L.coverage` 自检仍在测试文件内且明文「runner 改不动」（L214）；include 模式、`--passWithNoTests=false` 零触碰。
- **不可满足点**：F-5 统一命名（L214）下 lifecycle 文件内 `L.` 起名单元 = 21 场景 + 2 补充 + **自检 `L.coverage` 自身 = 24 个**；E5 归类规则（L164「含 ` > L.` 段或全名以 `L.` 开头……去重计数」）是纯句法的，会把 `L.coverage` 计入 → `observed=24 ≠ 23` → cell 恒红；而修订版自己的 §13.2「三基线全名并集恰 69」（L389）与 §8.1「每基线 21+2=23」证明**意图是自检不计入**——三处口径在句法规则下互相矛盾。实现者无论「静默排除自检」还是「改 expected」都越权（前者是无授权语义选择，后者违反 T-1）。
- **T-1a（iter-1 增补钉死；与 iter-0 T-1 叠加生效）**：
  1. 每基线**枚举清单** = 21 个 `L.<entry>.<scenario>`（entry ∈ {hub-listen, peer-dial, session-host} × scenario ∈ {startup, timer-fired, timer-cancelled, explicit-stop, fiber-dispose, service-revoked, remount}）+ `L.edge-beta.minimal-round` + `L.async-gamma.minimal-round`，恰 23 名；`observed` = 清单内「在场且 passed」去重计数，`missing` = 清单 − 在场；pass 仍要求 `observed===23`（数值不变）。
  2. 自检单元**不计入 units**（`L.coverage` 或设计改用非 `L.` 前缀名——二选一须在 §8.1/E5 显式写明），但**必须在 testNames 在场且 passed**（行为面锚点义务不变）。
  3. **fail-closed**：cell 内出现「清单 ∪ {自检名}」之外的任何 `L.` 段名 ⇒ cell 判红，禁止静默丢弃。
  4. 三基线全名并集判据 = 恰 69（23 名 × 3 基线标签互异）；自检名不计入 69。

### 项 3 — T-2 自我豁免：**clear**（allowlist 具体化追认为新钉死值；G11 空集保留；gates 自校验确认**未被弱化、反被强化**）

- **G10 允许清单**（L276）：`service.ts:86` + `plugin.ts:251`（两 seam，M4 实参形态——本会话核实全仓唯二生产 seam）+ 3 处既有 fixture 双读行（`:19/:171/:39`，本会话核实为真双读）+ 2 个**文件级**许可（既有 `cordis-root-channel.test.ts` 8 处 `.root` 命中、新通道测试文件）。裁决：前五项是 iter-0 T-2 钉死类别「两 seam `Reflect.get` + 显式双读探针」的**具名化**，无生产侧扩容，**RATIFY 为新钉死值**（增删须回 SA8——修订版 L276 自钉同款）；两个文件级许可是该类别内**粒度放宽**（行级→文件级），仅因通道探针文件以双读/形态断言为判据自身而许可，**钉死边界：全仓文件级许可恰此两文件**，不得再扩。
- **G11 空集**：L181 原样「允许清单为空集——T-2 钉死值」✔。
- **自校验未被弱化**：seam 自校验从 iter-0 的括形死规则改锚 M4 实存形态（L284——本会话核实 seam 文件的 `.root` 成员读全为字符串/注释，第 1 类只能经 M4 成立，改锚是**使自校验真正可满足**的修正）；N-6 从 1 样本扩为 3 注入形态（L285/L322）；回归样本自检四类恒定断言（L286）。§17.1-3（L516）拒绝 `--self-test` 的三重防线论证**逐字引用本报告 T-2 (i)(ii)(iii)**，不构成弱化。
- 但注意：以上追认的是**清单与自证伪义务**；G10 的候选/分类**算法**另裁（X-1）。

### 项 4 — T-3 台账：**clear**（B-3a…B-3e 原样保留）

逐条锚点：B-3a 来源冻结（L371「台账唯一合法内容 = 本步在 BASE `d59a4d1`……实跑捕获……不得新增任何条目（新增 = 掩蔽新红 = 违例，须回 SA8 复审——T-3）」）；B-3b 名级谓词 + test-d 提取核证（L371(b)「完整测试名集合级 `failedTestNames ⊆ (knownRed ∪ environmentRed)`，禁文件级/计数级近似（计数级会以旧红转绿抵销新红出现）」+「4 例 test-d 必须实际出现在 failedTestNames」）；B-3c 新文件永不可入账（L76 §4.1 行原样转述 + §12.1 L343 绑定 + §16-R4 L488）；B-3d 披露（L389「failedUnexpected[] 恒空 + disclosure 在场」+ §16-R6 L490 含「禁止宣称 root-test/CI 全绿」表述禁令）；B-3e 聚合语义（L196「任一 gating cell 红 → exit≠0（绿不抵红）」）。台账入 G12 白名单（L182「任何后续改动可机械检出」）✔。

### 项 5 — B-4/B-5：**clear**

- **B-4**：修订版 §14 AC6-A6-4 行（L418）「钉进 `guard-proxy` suite 六文件清单（E1 常量）三基线 cell 载体（F-3：**无兜底选项**）」+ 脚注（L433）「不再保留『实现期微调/默认布局留证』选项……若实现期确需调整归置，仍只准改 `run-baseline.mjs` 常量……不得回退到任何『默认布局留证』形态；调整须回 SA8 复审」——比 iter-0 B-4 最低要求更严，E5 同步要求 interop/418 测试名在场且 passed（L164）、§13.2 绿灯判据绑定（L389）。✔
- **B-5**：G5 行（L178）如实陈述「`public-surface.base.json` 内容不变（#470 未动 index.ts，d59a4d1 面 == 279dba4 面；快照内容不含基座 sha，无需重拍）」+「B-5 绑定：该主张由实现期 G5 实跑核证——若快照需重拍，仅允许基座元数据差异，导出名集合差异 = AC6 红」+ 陈旧 sha（`cordis-public-surface.test.ts:32` 描述标题）如实记录不修（DENY 文件）。✔

### 项 6 — S4 回退语义与披露：**clear**（无「已知红可静默」新表述）

- E4 可选 `diagnostics` 明文「仅环境红排查留痕、**不参与 pass 判定**」（L162/L200），且环境红处置为「前置项排除后**重跑**」（§16.2 L466）+ §13.1「环境红（不得计入）」（L385）——不构成静默通道；行为 cell pass 谓词零变化。
- N-2 判定升级（L318：逐 suite `cells[]` 均 fail、payload 顶层 `observed` 单独不构成证据）**收窄**了伪证明面；F-1 的通道测试 fault 消费纪律（L265）镜像 F9 并保留严格断言原样。
- §17.1-6（L519）对台账遮蔽面维持 iter-0 裁决口径。附一条收紧注记（并入 §12.8-3）：N-1 的接受判据按其命令行点名的逐 suite cell 读法收口（provenance/root-probe/ws-cordis-channel 各自 `observed=fail`，外层 exit 0 只是编排事实）——与 N-2 同理防单 suite 红冒充。

### 项 7 — 新增裁决需求：**X-1 = reject（G10 §9.2 现行算法语义不可满足）**；此外无任何新规范冲突面

**X-1（G10 候选/分类语义按原文不可满足，须设计修订）**：
- **事实**（本会话 grep，§12.1）：M1「接收者任意」的 `.root` 成员读取在扫描面共 **214 处 / ≥25 文件**，其中绝大多类是**域数据 root 字段读取**——VFSL/Registry 文档 ROOT 载荷（`registry.ts:711/1472/1492/1506…` 的 `record.root`/`payload.root`/`p.root`、`doc-runtime/src/*` 的 `input.root`、`vfsl/src/schemasource.ts`）与 Y.Doc root map 句柄（`doc-runtime/test/issue-348` 等 `fx.root.get/set`，64 处）。这些与 Cordis root **通道**读取同名异义，但修订版六类分类（L275–281）中：非清单命中（第 1 类✗）、非 `root(` 调用（第 2 类✗）、非字符串内部（第 3 类✗）、非定义位（第 4 类✗）、非注释（第 5 类✗）→ **全部落入第 6 类**。
- **后果**：G10 通过判定（L282「第 6 类为空」）在真实树 `d59a4d1` 上**恒假** → gates 12/12 PASS（L389）与本报告 §9.3-2 交付条件**不可满足**。修订版自检样本（L286 四类）恰好不含数据 root 族，G10 验收判据（L287）也只验「4 fixture 零第 6 类」，均探测不到该失败。设计自身的 class-4 示例行 `harness.ts:537` 同行就含 `opts.root` 成员读（M1 候选 → 第 6 类），与其「定义位不产生候选」的论断直接矛盾。
- **为何必须回设计而非就地修**：修订版 L276 自钉「允许清单为 T-2 钉死值，增删须回 SA8」；实现者无论扩清单（把 25+ 文件的数据读全塞进允许类）还是新增排除类（「receiver 为数据容器」——句法不可判定）都是未经裁决的语义变更，且前者会把生产文件 `registry.ts` 整体置于 G10 盲区。判别规则（如何机械区分「Cordis 通道 root 读取」与「域数据 root 字段读取」：接收者词表、形态判别、AST/类型面等）是**设计决策，属 SA1**，SA8 不代做（本报告只钉住不可让步的判据，见 §12.8-1）。
- **规范冲突面复查（dispatch 项 7 后半）**：除 X-1 与 T-1a 外，**无**新增——F-6 旋钮修正全部为测试断言锚点的事实纠偏（本会话逐一核实为真，零生产 diff）；ADR 0035 §2–§6 / ADR 0023 / ADR 0032 / wire 协议 / 持久化布局 / Cordis 装配纪律面 iter-0 §3.6 表结论全部维持（修订未触生产面、未触协议文本、未触拆卸序）。

## 12.3 Decision analysis（增量汇总）

| Decision / 约束 | 条款 | 修订版行为 | 分类 | 证据 | Required action |
|---|---|---|---|---|---|
| iter-0 §9.1 十文件闭合 ALLOW | 闭合世界 | §12.1 十文件不变、DENY 原样 | no-conflict | L330–349 | 无文件级增删 |
| iter-0 T-1 | E5/units/谓词 | 数值与谓词原样，但 F-5+E5 句法使 observed=24 | （可修正不一致） | L164/L214/L389 | **T-1a 吸收（§12.8-2）** |
| iter-0 T-2 | G10 清单/G11 空集/自校验 | 清单具名化+2 文件级许可；G11 空集；自校验改锚 M4 | no-conflict（清单 RATIFY 为新钉死值） | L276/L281/L284 | 文件级许可边界恰两文件 |
| —（新增裁决） | G10 §9.2 候选/分类算法 | M1/M3 接收者任意 → 真实树第 6 类恒非空 | **（不可满足，reject 该节现状）** | §12.1 grep 214 处；L275–287 | **X-1：§9.2 重设计（§12.8-1）** |
| iter-0 B-3a…e | 台账五绑定 | §13.0/§13.2/§7.5/§4.1 原样 | no-conflict | L371/L389/L200/L76 | 无 |
| iter-0 B-4/B-5 | A6-4 不可降级/G5 核证 | §14 钉死无兜底；G5 行如实 + 实现期核证 | implements-existing-decision | L418/L433/L178 | 无 |
| iter-0 S4 披露纪律 | 已知红不静默 | diagnostics 不参与判定、环境红须重跑、N-2 逐 suite | no-conflict | L162/L318/L385/L466 | N-1 同口径收口（§12.8-3） |
| SA2 F-1/F-4/F-7 修订 | E4a/G6/G2-G3/快速通道 | 均为收紧或形状修正 | no-conflict | L163/L175/L176/L104/L442/L493 | E-增补授权（§12.2 项 1） |

## 12.4 Overrides

无（同 iter-0 §5；本轮修订亦未产生 override 诉求——X-1 是票内 gate 语义问题，规范集合内可解）。

## 12.5 Frozen surfaces（增量确认）

iter-0 §6 全表继续有效且零变化（wire/公共导出面/服务名/持久化布局/装配序与拆卸链/服务构造形态/配置形态/稳定错误文案/#470 已交付面/设施冻结子面/既有测试/manifests-lock-artifacts-docs-tsconfig-vitest）。唯一非冻结面 = G10/G11/G12 语义本身（本票新增 gate），其中 G10 语义按 X-1 待重设计、G11 空集与 G12 白名单为钉死值不变。

## 12.6 Evolution requirements / 12.7 Hard conflicts

均无：修订未触碰任何 ADR/CONTEXT/协议文本；X-1 是设计内部可修正不一致（票级验收设施语义），非与决策集的 hard-conflict。

## 12.8 Required actions（下一轮设计修订；两项必改 + 一项收口注记）

1. **X-1 — 重写 §9.2 G10 候选/分类语义**（仍限 `gates.mjs` = §9.1 文件 3，无需 ALLOW 增删），必须同时满足以下**不可让步判据**（SA8 钉死，重设计稿须回本章追认）：
   - (a) 在真实树 `d59a4d1` 干跑**第 6 类恰为空**（新增验收判据，与 L287 并列：先于实现落地以 dry-run 留证）；
   - (b) N-6 三种注入形态（`const r = ctx.root;` / `const { root } = ctx;` / `ctx?.root`）**均须定向红**；
   - (c) 两 seam 文件各 ≥1 个第 1 类命中（M4 实参形态）保留；
   - (d) 允许清单条目维持 §12.2 项 3 追认值（2 seam + 3 fixture 双读行 + 恰 2 个文件级通道探针许可）；对「域数据 root 字段」的排除必须是**可机械判定且命名显式**的规则（如接收者词表/形态判别，附 ≥4 个实存回归样本进 L286 自检，其中至少含 `registry.ts` 的 `payload.root` 与 `fx.root.get` 两族），不得以整文件白名单方式把生产文件移出监控；
   - (e) 完整命中清单（含各类排除项与理由）仍须随 gates.log 输出，不许静默丢弃。
2. **T-1a — 吸收进 §8.1/§7.2 E5/§13.2 三处**（按 §12.2 项 2 的四款钉死语义；自检单元是否保留 `L.coverage` 名或改非 `L.` 前缀名由设计定，须显式写明）。
3. **N-1 判据收口注记**：N-1 接受判据按逐 suite cell 读法表述（点名 suite 各自 `observed=fail`），与 N-2 同口径；纯文字修订，无机制变化。
4. 其余已追认事项（E-增补授权、F-1/F-3/F-4/F-6/F-7、§12.1 十文件、B-1…B-5、T-2/T-3/T-4）**维持**，下一轮修订不得回退。

## 12.9 ALLOW 增删结论

**文件级：无增无删**（§9.1 十文件闭合清单与闭合世界 DENY 原样有效；G10 重设计与 T-1a 吸收均落在既有 ALLOW 文件 3 / 6 内）。**编辑点级**：按 §12.2 项 1 发布 E-增补授权（`run-baseline.mjs` +E4a/E3 清理/E4 可选 diagnostics；`gates.mjs` G6 挂基座/G2-G3 形状/G10 清单具名化；suite 常量钉死）；其中 **G10 §9.2 算法语义的授权被 X-1 暂停**，待 §12.8-1 重设计稿追认。

## 12.10 Verdict（iteration 1）

**reject（外科手术式）** —— 七项逐裁：项 1/3/4/5/6 **clear**（文件级守界 + 编辑点增量授权 + T-2 清单追认 + B-3/B-4/B-5 原样 + S4 无静默新表述）；项 2 **reject（可修正）**（T-1 数值未缩、谓词未放宽，但 F-5 命名与 E5 句法归类互相矛盾，钉死谓词 `observed===23` 按原文不可满足——已发布 T-1a 钉死待吸收）；项 7 **X-1 reject**（G10 §9.2「接收者任意」候选集在真实树产生 214 处域数据 `root` 字段误命中，第 6 类恒非空，gates 12/12 与 §9.3-2 不可满足，且实现者无合法就地修正通道）。设计骨架（零生产 diff、12-suite/41 行矩阵、S1–S5、十文件闭合、B-1…B-5、T-3/T-4）**全部守住并维持放行前提**；仅 §9.2 G10 语义与 E5 归类口径两处须按 §12.8 修订后回 SA8 增量追认，其余章节无需重开。

## 12.11 requiresConflictRecheck（iteration 1）

**true** —— (i) iter-0 §11 全部理由维持（验收/门禁语义变化面、十文件 diff 双核对、新断言面、B-4/B-5 事实核证）；(ii) 新增：G10 重设计稿（§12.8-1）须回 SA8 追认后方可实现，实现后 G10 首落地 dry-run 证据（第 6 类恰空 + N-6 三样本红 + seam 自校验）为复查必查项；(iii) T-1a 落地后 `units` 回填与 69 并集判据的实跑一致性为复查必查项。

---

# SA8 增量冲突复查（iteration 2）— §12.8-1 五款 / T-1a 吸收追认裁决

**Reviewed subject**: design 定向修订版 `wiki/raw/task_issue-471_design.md`（528→594 行，基线仍 HEAD `d59a4d1`，骨架不变；本轮改动 = §9.2 G10 rev 2（X-1/F-8）+ E5/§8.1/§13.2 计账（T-1a/F-5r）+ §11 N-1 收口（§12.8-3）+ 头部/输入/§17.2 映射，见修订版 §17.2 末行自述——经逐节核对属实）。SA8 dispatch：`sa-015c92db-d0e3-43bb-af6d-813949026893`，iteration 2，phase conflict-gate。本会话只读核证（唯一写入 = 本报告本章追加）；未改任何被审对象、决策文档、src/test/设施；未运行任何测试——干跑复跑为只读扫描（脚本仅写 stdout）。
**规范基准**：与 iter-0 §1 相同；本章不重复决策集。本章地位：iter-1 §12 的**增量裁决**，为当前结论；iter-0 §1–§11 与 iter-1 §12 除本章明示增补（X-1 追认解除、I-1/I-2/I-3 实现义务）外全部继续有效。

## 13.1 本会话第一手核证（全部命令可复跑；工作树 HEAD `d59a4d1`）

| 对象 | 命令/方法 | 结果 |
|---|---|---|
| 干跑主证复跑 | `node .cache/issue471-g10-dryrun/scan.mjs`（重定向 /tmp 比对） | `scanned_files=732 cordis_faced=45`；`cat_1=19 cat_2=13 cat_3=9 cat_5=2 cat_5DR=196 cat_5DC=46` **`cat_6=0`**；全量输出与留档 `report-main.txt` 去首行后 **diff 为空（逐字节一致）**——设计 L338 主张逐项吻合，19+13+9+2+196+46=285 条全量清单属实 |
| 干跑负控复跑 | `node .cache/issue471-g10-dryrun/scan.mjs --n6` | `scanned_files=733`、**`cat_6=3`** 恰为三注入形态（`n6-g10-scratch.ts:4 [M1 receiver=ctx]`、`:5 [M3 source=ctx]`、`:6 [M1 receiver=ctx]`），其余计数与主证逐项相同；`cordis_faced` 仍 45（注入文件零标记成立）；与留档 `report-n6.txt` 逐字节一致——设计 L339 主张吻合 |
| 扫描面独立计数 | `find packages/*/{src,test} apps/*/{src,test} domains/*/{src,test} -name '*.{ts,tsx,mts,cts,js,mjs}'`（剔设施目录）| **恰 732**，与脚本 `walk` 独立殊途同归（且证扫描面内无 node_modules/dist/隐藏目录分叉） |
| 读取原语全仓枚举 | `grep -rnE "safeReadChannel\([^)]*'root'|Reflect\.get\([^)]*'root'"`（全扫描面） | **恰 6 处**：`service.ts:86`、`plugin.ts:251`（两 seam）+ 探针 `cordis-root-channel.test.ts:458` + 3 处 fixture 双读行（`:19/:171/:39`）——**全部在 T-2 允许清单内，清单外零读取原语调用**。cat_6=0 的「空」由此闭环：非静默丢弃换来 |
| V_ctx 接收者全群体对账 | cat_2/3/5 明细逐行审计 + 5D-R 接收者直方图 | 全仓 V_ctx 形接收者的 `root` 触碰 = 13 处 issue301 `ctx.root(…)` helper 调用（cat 2，逐行核实为域 helper）+ 2 个注释 token（cat 5，`plugin.ts:264`）+ 清单内 cat 1——**清单外零 V_ctx 直读**；5D-R 196 条接收者直方图（fx×117、opts/p/overrides/input/record/payload/args/entry/body/this×3…）无一以 ctx/Ctx 结尾（`this` 3 处 = `vfsl/src/schemasource.ts:114/:139/:173`，`this.root` 为 SchemaSource 自有根目录字段，域数据，且逐条在案非静默） |
| 漏洞通道排查（问「空是否以规则漏洞换来」） | 四组定向 grep | ①跨行实参位 `'root'` 字面量（行内无 `(`）：全部为 case 标签/类型联合/对象字面量/默认值/`in` 运算——**零实参位形态**；②行首 `.root`/`?.root` 分裂成员访问：**零**；③跨行解构 root 绑定：**零**（16 处 M3 全为单行，独立 grep 16 = 报告 16 行对账一致，源全为 `freshRoot()`/`runVerify*()` 域 helper）；④cast 括形态全仓恰 3 处：`registry-create.test.ts:548`（**写目标**，非读）、`schema-write.ts:383`（内层 `snap` ∉ V_ctx）、探针 `:463/:468`（文件级允许内 → cat 1）——**清单外零 V_ctx 内层 cast 形态**；⑤模板插值 `${…root…}`：全部为裸 `root` 局部变量（域），**零 `X.root` 成员插值** |
| 设计自检样本锚点 | 逐行 grep 报告 | `registry.ts:711/:1472/:1506`（5D receiver=record/payload/p）、`issue-348…:147`（5D receiver=fx）、`app.ts:864/:880`（5D receiver=args，且 :864 附 `callee=if` 的 `in` 探测行）、`request-body.ts:131`（5D-C callee=hasOwnProperty.call）、`create-namespace.ts:292`（5D-C callee=validationProblemResponse）、`schema-write.ts:383`（5D cast-M2）、`harness.ts:537`（5D receiver=opts）、`issue301:624`（cat 2）——设计 §9.2 自检表锚点**全部实存且分类相符**（仅 :383 记录 token 为 `undefined` 而非 `snap`，见 13.2 项 1(a) 附注） |
| 设施目录（R0 排除对象） | `ls packages/persistence/test/fixtures/cordis-baselines/` | 恰 7 文件（acquire/baselines.json/gates/provenance-b3/public-surface.base/root-probe/run-baseline），+ 待建台账 = G12「4 可 diff + 4 零 diff」恰好全覆盖，无第 9 文件；`root-probe.mjs` 含 `:104/:124/:134` 三处 `Reflect.get(ctx,'root')` + `:119` `Context.root`（设计 L33 取证属实）——该文件现为 G12 **零 diff 逐字节执法**对象 |
| 上轮裁决文本 | `wiki/raw/task_issue-471_design_conflict_report.md` §9/§12；SA2 `…_sa2_review.md` §17 | §12.8-1 五款、T-1a 四款、§12.2 项 3 追认值、E-增补授权、十文件 ALLOW 逐条载入比对 |

辅助证据（设计未引用、不承载判据）：`.cache/issue471-g10-dryrun/{scan-noface.mjs,report-noface.txt}`（F 门控对照变体，cat_5DR=210）与 `scan.mjs --sample` 查询口——存在无害。

## 13.2 逐项裁决（dispatch 项 1–5；每项 clear/reject + 设计行锚点）

### 项 1 — §12.8-1 (a)–(e) 五款：**clear（逐款成立）**——X-1 据此追认，暂停解除

- **(a) BASE `d59a4d1` 第 6 类恰空：成立，且经第一手复跑 + 独立对账证实非「以规则漏洞换来的空」**（设计 L330/L336–L338）。空的真实性由三条独立证据链闭环：(i) **读取原语枚举闭环**——全扫描面 `safeReadChannel`/`Reflect.get` × `'root'` 实参恰 6 处、全在清单内（13.1 表 4 行），任何 V_M4 通道的新增 legacy 读必落第 6 类，无藏匿位；(ii) **V_ctx 接收者全群体对账**——清单外 V_ctx 触碰仅 helper 调用与注释（均记录在案），零直读；(iii) **伪造通道全为零实例**——cast 括、跨行实参位、行首分裂成员访问、跨行解构、模板插值五类通道在 BASE 均无可被现行分类误纳的实例（13.1 表 6 行）。N-6 负控（零标记 + `cordis_faced` 不变）另证「无标记文件 `ctx.root`」不因文件面逃逸。
  **附注（脚本忠实度，非设计缺陷）**：干跑脚本与设计 §9.2 文本存在三处已核实的实现偏离——①cast 括接收者解析因正则无捕获组返回 `undefined`（本应取括内首个标识符），且 `undefined` 流入 5D-R 而非 fail-closed 类 6（对 `(ctx as any).root` 形态为 fail-open）；②V_ctx 尾缀匹配实现为大小写不敏感（设计文本「大小写敏感」——实现更严，方向无害）；③M4 跨行实参位/空白被调形态不识别（设计语义下跨行实参位是候选）。三者均**不改变 BASE 分类结果**（上述通道 BASE 零实例，`registry-create:548` 为写目标、`schema-write:383` 内层 ∉ V_ctx，结局同为 5D 排除且已记录）——干跑作为「rev 2 算法在 BASE 得 cat_6=0」的证据**成立**；但 `gates.mjs` 落地必须以**设计文本语义**为准，不得照抄脚本（发布为 **I-1**，见 13.8）。
- **(b) N-6 三注入均定向红：成立**（设计 L299–L310/L331/L339）。scratch 内容与钉死样本逐字一致（零 Cordis 标记、一个 `ctx` 形参）；复跑 `cat_6=3` 恰为 M1/M3/M1 可选链三形态、行号 `:4/:5/:6` 逐条对上；其余计数与主证逐项相同（隔离性成立）。
- **(c) 两 seam 各 ≥1 第 1 类命中保留：成立**（设计 L298/L332/L338）。`cat_1` 中 `service.ts:86 [M4 callee=safeReadChannel]` 与 `plugin.ts:251 [M4 callee=safeReadChannel]` 在场——M4 实参形态自校验可满足。
- **(d) 允许清单 = 追认具名值零增删 + 设施目录排除裁定 + 域排除规则判别性：成立**（设计 L271/L287/L333）。
  - **清单零增删**：设计 L287 第 1 类行 = 行级 5 条（两 seam `:86/:251` + 3 fixture 双读 `:19/:171/:39`）+ 文件级恰 2 条（既有 `cordis-root-channel.test.ts` + 新 `ws-replication-cordis-root-channel.test.ts`），与 iter-1 §12.2 项 3 追认值**逐字相同**；干跑脚本 `LINE_ALLOW`/`FILE_ALLOW` 同值；G11 空集原样（L181）。
  - **设施目录整体移出扫描面的裁定：不等价于「整文件白名单把监控面移出」，无需新增强度条款——等强度监控已由 G12 现行钉死值承载，但成立性为条件性，以 I-2 联动条款钉死**。理由四点：(i) iter-1 (d) 禁令的对象是「**生产文件**」——设施目录 7 文件全在 `test/fixtures/` 下，零生产文件，全部生产文件仍在扫描面内、其域读逐条记录于 5D（设计 L333 自述与本会话直方图互证）；(ii) 唯一含真实 legacy 读形态的 `root-probe.mjs` 受 G12 **零 diff 逐字节执法**——强度严格**高于** G10 文件级许可（许可 = 文件内任意 root 读合法；零 diff = 任何字节改动即红；SA2 F-8 建议的「第三份文件级许可」路线反而更弱，设计选排除+G12 是更强方案）；(iii) 其余 may-diff 设施文件中 `gates.mjs` 是 G10 实现本体（自扫描自我命中，排除是使 gate 可运行的必要条件），`run-baseline.mjs`/`baselines.json`/台账受 G12 白名单机械检出 + 裁决层闭合编辑点（E1–E7/G 清单/T-1「实现 diff 只准表达列举编辑点」）双重约束；(iv) 「仅 4 文件可 diff」的闭合语义下目录内**新增文件即红**（changedPaths 含 untracked），无逃逸缝。故对 `root-probe.mjs` 的「恰 2 文件级许可边界内合法解决」成立——不是第三份许可，而是更强的冻结。
  - **域排除规则可机械判定且命名显式：成立**。V_ctx = {`ctx`,`context`,`host`} ∪ 以 `ctx`/`Ctx` 结尾（命名闭集、字符串/后缀判定机械可执行）；V_M4 = {`Reflect.get`,`safeReadChannel`}（写形 `defineProperty`/`Reflect.set` 如实记录为排除项而非静默）；不可解析（cast 内层非标识符、括链、嵌套下标）fail-closed ⇒ 类 6（设计 L279/L280——脚本未完全兑现，归 I-1）。**≥4 域族实存样本进自检：成立且超额**——自检表 7 个域族行（registry 三形态、`fx.root`、`app.ts args.root`、request-body、create-namespace、schema-write cast-M2）≥ 4，含本报告点名的 `payload.root` 与 `fx.root.get` 两族，锚点经本会话逐条在树核实、分类与干跑一致（`:383` 记录 token 偏差归 I-1/I-3）。
- **(e) 完整命中清单随 gates.log 输出、不得静默丢弃：成立**（设计 L283「全部命中含排除项与理由随 gates.log 输出，不许静默丢弃——第 6 类编号与语义不变」+ L334 + L469 AC5 行证据路径 `…/evidence/gates/gates.log`）。干跑报告 285 条 + 负控 286 条全量在案；脚本唯一的非记录出口是设计定义下的**非候选**（M4 非实参位字面量），非「命中被丢弃」——跨行实参位的忠实度归 I-1。

### 项 2 — T-1a 四款逐字吸收：**clear**（钉死谓词零放宽）

逐款锚点（设计 L79 §4.1 行、L164 E5、L214 §8.1、L444 §13.2、L463 §14 AC2 行）：
1. **枚举恰 23 名**：`LIFECYCLE_UNITS` = 21 个 `L.<entry>.<scenario>`（entry ∈ {hub-listen, peer-dial, session-host} × scenario ∈ {startup, timer-fired, timer-cancelled, explicit-stop, fiber-dispose, service-revoked, remount}）+ `L.edge-beta.minimal-round` + `L.async-gamma.minimal-round`，逐名钉死——与本报告 iter-1 §12.2 项 2 第 1 款**逐字同集**；`observed` = 清单内「在场且 passed」**去重**计数、`missing` = 枚举 − 在场、pass 要求 `observed===23`（L164/L214）✔。
2. **自检不计入 units 但须在场且 passed**：显式定名 **`coverage`**（非 `L.` 前缀——T-1a-2 授权二选一，设计在 §8.1/E5 三处显式写明），在场且 passed 由 cell 级谓词承载（L164/L214）✔。
3. **fail-closed**：「23 名枚举 ∪ {`coverage`}」之外任何以 `L.` 起头单元名 ⇒ cell 红、禁止静默丢弃（L164/L214/L444）✔。
4. **三基线并集恰 69、自检不计入**（L214/L444）✔。
**无任何形式放宽**：iter-0 T-1 原四要素（`expected:23` 数值、repeat 口径 D-4、suite→文件清单 §7.4、pass 谓词 `counts.failed===0 ∧ 目标测试名在场 ∧ units.observed===23`）原样保留，E5 新谓词 = 原四项**合取**再叠加 `coverage 在场且 passed ∧ 无枚举外 L. 名` 两个新合取项——**严格化而非放宽**；iter-1 废弃的句法前缀归类已连根移除（L164 明文「废弃 iter-1 的句法前缀规则」），F-5r 的裁量面消除。设计文本中残存的 4 处 `L.coverage` 字样（L79/L164/L582/L592）经逐处核对均为历史引文/修订说明语境（含对 iter-0 §11 原文的引用），无一处作为现行计账名使用，不构成口径矛盾。

### 项 3 — 守界：**clear**（十文件闭合无增删；T-2/T-3/T-4 与 E-增补授权全部尊重；无盲区扩大、无 A5-1 变相放宽）

- **十文件 ALLOW**：§12.1（L388–L399）仍恰 10 文件、与 iter-0 §9.1 逐条同名同序（台账条目 10 维持转正态）；闭合世界 DENY 原样（L401/L405）。**文件级无增无删**。
- **编辑点级零越权**：本轮 §9.2 rev 2 落 `gates.mjs`（§9.1 文件 3——X-1 暂停的算法授权经本章项 1 追认解除）；E5 归类重写落 `run-baseline.mjs`（§9.1 文件 2——iter-1 §12.8-2 明文授权「T-1a 吸收进 §8.1/§7.2 E5/§13.2 三处」）；其余改动均在本设计文档自身。E-增补授权各元素（E4a/E3 清理/E4 diagnostics/G6 挂基座/G2-G3 形状/suite 常量钉死）逐条原样在盘（L159–L166/L175/L176），无回退。
- **T-2**：允许清单零增删（项 1(d)）；G11 空集原样；gates 自我校验未被弱化——seam 自校验保留且 rev 2 使其实际可满足。**T-3**：B-3a…e 逐条原样（L76 §4.1 行、L427 §13.0、L444 §13.2、G12 白名单 L182）。**T-4**：N-6 三形态扩样维持（L378），实现期实跑留证义务在盘（L310/L378）。
- **无「扫描面排除」盲区扩大**：R0 排除**仅**设施目录一处（L271），其余扫描面 = `packages|apps|domains/*/{src,test}` 全量（较 iter-1 干跑面不减），排除的监控义务由 G12 等强度承载（项 1(d) 四点论证 + I-2 联动钉死）。
- **无「词表」变相放宽 A5-1**：V_ctx/V_M4 词表判别**正是** iter-1 §12.8-1(d) 授权的「可机械判定且命名显式」机制本身（「如接收者词表/形态判别」原文），非对 A5-1 的收缩——A5-1 的执法对象（生产+测试面 legacy 直读）仍全量在扫描面内，且 rev 2 拒绝了 SA2 F-8 建议的文件面（F 门控）限定、以 F 仅作记录元数据杜绝「无标记文件 `ctx.root`」漏判通道（L281，N-6 零标记样本实证）——较建议方案**更严**。残余风险（接收者别名/`this` 规避词表）为词表机制固有：BASE 上全部 `this.root` 实为域字段（已核）、全部排除逐条在案可审计，且蓄意改名规避任何词法 gate 均不可防（威胁模型为意外回归，纵深 = 记录 + 实现复审 + T-2 裁决层），不构成放宽。

### 项 4 — 新的规范面：**无新冲突需求**（逐面核对）

本轮 delta（§9.2 rev 2 / E5 / §8.1 / §13.2 / §11 N-1 / §14 AC2 / §17.2 / 头部）全部为验收设施与测试计账语义，未触碰任何决策文本：**Cordis 使用纪律**（ADR 0035 §2–§6：三基线工件面/patch 禁令/部署边界——设计 §1/§16-R3 原样，V_ctx/V_M4/F 为 gate 内部词表非 Cordis API 用法）；**ADR 0035** §5 三基线义务兑现口径不变（S1 维持）；**ADR 0023**（accessor+freeze——guard-proxy suite 面原样）；**ADR 0032**（edge/session 分治——β 冻结 byte-for-byte、γ append-only 原样 L238，零生产 diff §5 不变）；**wire**（replication-protocol 包 DENY 原样 L410，A6-4 载体仅执行不修改）；**持久化**（布局/拆卸序零变化，A4-4 断言锚点不变）。iter-0 §3.6 与 iter-1 §12.2 项 7 的「零命中」结论维持。

### 项 5 — 结论与路由

见 13.8–13.11。

## 13.3 Decision analysis（增量汇总）

| 决策/约束 | 条款 | iter-2 行为 | 分类 | 证据 | Required action |
|---|---|---|---|---|---|
| iter-1 §12.8-1(a) | BASE 干跑第 6 类恰空 | 复跑逐字节复现 + 独立三链对账 | implements-existing-decision（裁决义务兑现） | 13.1 表 1/4/5/6 行 | I-1（落地忠实度） |
| iter-1 §12.8-1(b)/(c) | N-6 三形态红 / 两 seam cat 1 | cat_6=3 恰三形态；两 seam M4 在场 | implements-existing-decision | 13.1 表 2 行、cat_1 明细 | 无 |
| iter-1 §12.8-1(d) | 清单零增删 + 机械判别域排除 + ≥4 样本 | 逐字相同清单；V_ctx/V_M4 命名词表；7 域族样本 | implements-existing-decision | L287/L279/L280、13.1 表 8 行 | I-2（G10–G12 联动钉死）、I-3（样本断言绑 token） |
| iter-1 §12.8-1(e) | 全量清单输出不静默 | L283/L334 + 285 条在案 | no-conflict | 13.1 表 1 行 | 无 |
| iter-1 §12.8-2（T-1a） | 四款逐字吸收 | 三处（§8.1/E5/§13.2）+ §4.1/§14 逐字落位，谓词只增合取项 | no-conflict | 13.2 项 2 | 无 |
| iter-1 §12.8-3（N-1 收口） | 逐 suite 读法 | §11 N-1 行 + 负控纪律段 | no-conflict | L373/L380 | 无 |
| iter-1 X-1（暂停的 G10 算法授权） | §9.2 重设计待追认 | rev 2 五款全过 | **RATIFY（暂停解除）** | 13.2 项 1 | §9.2 rev 2 = 新钉死值 |
| iter-0 §9.1 十文件闭合 ALLOW | 文件级无增删 | §12.1 十文件原样 | no-conflict | L388–L401 | 无 |
| E-增补授权（iter-1 §12.2 项 1） | E4a/E3/E4/G6/G2-G3/常量钉死 | 全部在盘未回退 | no-conflict | L159–L176 | 无 |

## 13.4 Overrides

无（同 iter-1 §12.4；本轮修订未产生 override 诉求——X-1 追认是票内 gate 语义的裁决闭合，规范集合内自解）。

## 13.5 Frozen surfaces（增量确认）

iter-0 §6 与 iter-1 §12.5 全表继续有效且零变化。**新增钉死值（自本章起）**：G10 §9.2 rev 2 语义整体（R0 扫描面含设施目录排除、R1 四形态 + V_ctx/V_M4 词表 + F 仅记录、R2 七行分类表、两类自证伪、回归样本自检表、通过判定「类 6 空 ∧ 两自证伪 ∧ 自检恒定」）——实现 diff 不得偏离；任何增删（含词表成员、分类表行、扫描面、清单条目）须回 SA8。G11 空集、G12 白名单维持钉死。

## 13.6 Evolution requirements / 13.7 Hard conflicts

均无：本轮修订未触碰 ADR/CONTEXT/协议文本；无与决策集的不兼容项。

## 13.8 Required actions（实现期绑定义务；无设计修订要求）

1. **X-1 追认生效**：§9.2 rev 2 为 G10 算法的**新钉死语义**（13.5），iter-1 对 G10 算法授权的暂停**解除**；`gates.mjs` 可按 §9.2 rev 2 实现（仍限 §9.1 文件 3，无 ALLOW 增删、无编辑点新增）。
2. **I-1（G10 落地忠实度 = 以设计文本为准，不照抄干跑脚本）**：落地实现必须兑现设计文本的三点语义，即干跑脚本的已证实偏离之处——①cast 括（M1/M2）接收者取**括内首个标识符**（`(snap as X)['root']` → `snap`；`(ctx as any).root` → `ctx` ⇒ 类 6），解析不可得一律 fail-closed ⇒ 类 6，**不得**落入 5D；②V_ctx 后缀匹配按文本**大小写敏感**（`ctx`/`Ctx` 结尾）；③M4 实参位判定覆盖跨行调用形态与被调点链空白形态（或将其记为不可解析并 fail-closed）。**落地后 BASE 首跑须与本轮干跑对账**：分类计数逐项一致（`cat_1=19 cat_2=13 cat_3=9 cat_5=2`、5D 合计 242、`cat_6=0`），285 条命中对账允许且仅允许记录级 token 修正差异（现两行 `receiver=undefined` → `snap`/`input2`，类不变）；超出即回 SA8。此项并入既有 G10 首落地复查必查项（iter-0 §11(i)、iter-1 §12.11(ii)）。
3. **I-2（G10–G12 联动条款）**：R0 设施目录排除的合法性**当且仅当** G12 维持现行钉死值——(i) `root-probe.mjs`/`acquire.mjs`/`provenance-b3.json`/`public-surface.base.json` 对 `d59a4d1` 零 diff；(ii) 其余 4 文件闭合白名单且目录内**新增文件即红**。G12 的任何弱化（含把 root-probe.mjs 移入可 diff 集）同时使 G10 扫描面出现盲区，构成对 13.5 钉死值的违反，须回 SA8 重裁——不得以「G10 已过」为由先行放宽。
4. **I-3（自检断言绑 token）**：回归样本自检的每行断言须绑定**类 + 判别 token**（如 `schema-write.ts:383 → 5D receiver=snap`、`registry.ts:1472 → 5D receiver=payload`、`request-body.ts:131 → 5D callee=…hasOwnProperty.call`），不得只断言类——使接收者/被调解析本身处于被测状态（对 I-1① 的机械承载）。
5. 其余已追认事项（E-增补授权、F-1/F-3/F-4/F-6/F-7 闭合、十文件 ALLOW、B-1…B-5、T-2/T-3/T-4、§9.3 十二条交付条件）维持，实现期不得回退。

## 13.9 ALLOW 增删结论

**文件级：无增无删；编辑点级：无新增授权。** §9.2 rev 2 与 E5 重写均落在既有授权面（§9.1 文件 3 的 X-1 追认 / 文件 2 的 §12.8-2 授权）内。I-1/I-2/I-3 为绑定解释与实现义务，不构成对任何文件或编辑点的新授权。

## 13.10 Verdict（iteration 2）

**clear** —— 五项逐裁：项 1（§12.8-1 (a)–(e) 五款）**逐款 clear**（cat_6=0 经第一手复跑 + 三链独立对账证实为真而非规则漏洞换取；三注入定向红；两 seam cat 1 在场；允许清单零增删、设施目录排除裁定为「更强而非更弱」并附 G12 联动钉死；全量清单输出在案）；项 2（T-1a 四款）**clear**（逐字吸收、谓词严格化零放宽）；项 3（守界）**clear**（十文件无增删、授权全尊重、无盲区扩大、无 A5-1 变相放宽）；项 4（新规范面）**零命中**。iter-1 的两处 reject（X-1、T-1a）**均已被本修订闭合**；X-1 暂停解除，§9.2 rev 2 与 E5 计账口径追认为钉死值。设计可放行 SA3 实现，前提是实现逐条兑现 §9/§12 既有绑定条款与本章 I-1/I-2/I-3。

## 13.11 requiresConflictRecheck（iteration 2）

**true** —— (i) iter-0 §11 与 iter-1 §12.11 全部理由维持（验收/门禁语义变化面的实现后核对、十文件 diff 双核对、B-4/B-5 事实核证）；(ii) **G10 首落地证据升级为必查项**：BASE 首跑对账（I-1：计数逐项复现 `cat_6=0` + 285 条命中 + 记录级差异解释）、N-6 三样本红、seam 自校验、自检样本断言（I-3）逐项核对；(iii) T-1a 落地后 `units` 回填（每基线 `observed===23`）与三基线 69 并集判据的实跑一致性核对；(iv) I-2 联动条款在 gates diff 审查中专项核对（G12 未被弱化）。

---

# SA8 增量冲突复查（iteration 3）— §9.2 rev 2.1（F-9 取证对齐）追认 + I-1 对账基线更新裁决

**Reviewed subject**: design 第三轮窄面修订 `wiki/raw/task_issue-471_design.md`（594→620 行，基线仍 HEAD `d59a4d1`，骨架不变；本轮 delta = §9.2 rev 2.1（F-9 三处取证脚本对齐 + R1 cast/M4 钉死句 + R2 类 4 行改写 + 自检表改写/增行）+ I-1/I-2/I-3 吸收（§4.1/§7.3/§13.2/§11 N-6 注）+ §17.3 映射 + §18 + 头部/输入，经逐节核对与 SA1 自述一致）+ 修后 `.cache/issue471-g10-dryrun/` 取证（含修前留档 `report-*-prefix.txt`）。SA8 dispatch：`sa-1fdffc0b-4a3a-4dad-96d2-c4b06422cf6b`，iteration 3，phase conflict-gate。本会话只读裁决（唯一写入 = 本报告本章追加；干跑复跑为只读扫描，脚本仅写 stdout/exit code）；未改任何被审对象、决策文档、src/test/设施；未运行任何测试。
**规范基准**：与 iter-0 §1 相同（ADR 全集 + CONTEXT.md + SA6 契约），本章不重复决策集。本章地位：iter-2 §13 的**增量裁决**，为当前结论；iter-0 §1–§11、iter-1 §12、iter-2 §13 除本章明示更新（I-1 对账基线 rev 2.1 值、§9.2 rev 2.1 增补句追认）外全部继续有效。

## 14.1 本会话第一手核证（全部命令可复跑；工作树 HEAD `d59a4d1`）

| 对象 | 命令/方法 | 结果 |
|---|---|---|
| 工作树基线 | `git rev-parse HEAD`；`git status --porcelain` | `d59a4d141c…`（与设计自述同）；tracked 零修改，untracked 仅 `wiki/raw/task_issue-471*.md` 六件任务文档——**本轮零改动 `packages/**`/`apps/**`/`domains/**`/`docs/**`** 属实（`.cache/` 经 `git check-ignore -v` 确认 gitignored） |
| 修后主证复跑 | `node .cache/issue471-g10-dryrun/scan.mjs \| tail -n +2 \| diff - .cache/issue471-g10-dryrun/report-main.txt` | **diff 为空（逐字节一致）**。`scanned_files=732 cordis_faced=45`；`cat_1=19 cat_2=13 cat_3=7 cat_5=4 cat_5DR=196 cat_5DC=46` **`cat_6=0`**；19+13+7+4+196+46=**285** 条全量清单 |
| 修后负控复跑 | `node .cache/issue471-g10-dryrun/scan.mjs --n6 \| tail -n +2 \| diff - .cache/issue471-g10-dryrun/report-n6.txt` | **diff 为空**。`scanned_files=733 cordis_faced=45`、**`cat_6=3`** 恰三注入形态（`n6-g10-scratch.ts:4 [M1 receiver=ctx]`、`:5 [M3 source=ctx]`、`:6 [M1 receiver=ctx]`），其余计数与主证逐项相同 |
| 扫描面独立计数 | `find packages/*/{src,test} apps/*/{src,test} domains/*/{src,test} -type f \( -name '*.ts' -o … \) \| grep -v 'fixtures/cordis-baselines/' \| wc -l` | **恰 732**，与脚本 `scanned_files` 殊途同归 |
| **修前/修后逐字节对账** | `diff .cache/issue471-g10-dryrun/report-main-prefix.txt .cache/issue471-g10-dryrun/report-main.txt`（n6 同法） | **两 pass 各恰 4 行记录变化、其余逐字节一致**：(i) 2 行类移动 3→5（`service.ts:41`、`plugin.ts:210`，均 `[M1 (string interior)]`→`[M1 (comment)]`）；(ii) 2 行 token 修正（`registry-create.test.ts:548` `receiver=undefined`→`input2`、`schema-write.ts:383` `receiver=undefined`→`snap`，均 5D-R 类不变）。计数行仅 `cat_3 9→7`、`cat_5 2→4`；`cat_6` 主证 0→0、负控 3→3——**SA1 自述的 delta 逐项吻合，无第 5 处变化** |
| 三处修复在脚本中的实在性 | 实读 `scan.mjs`（229 行） | ①cast 括接收者 `inner[0]`（`:103`/`:205` 两处，正则 `/^[A-Za-z_$][A-Za-z0-9_$]*/` 无捕获组、取 `[0]`；`recv===null` ⇒ `push('6', …, '(receiver=UNRESOLVED…)')` `:162`——**fail-closed 通道已实际接通，SA2 F-9 主体缺陷修复**）；②`inVctx` 无 `/i`（`:38`，后缀恰 `ctx`/`Ctx`）；③`commentSpan` 识别 `*`/`/*` 引导行（`:73–74`）——与设计 §9.2 rev 2.1 自述三处一一对应 |
| cast/注释/大小写探针 | `node .cache/issue471-g10-dryrun/cast-probe.mjs`（diff vs `report-cast-probe.txt`） | **`probe_pass=17 probe_fail=0`、与留档逐字节一致**。cast 形仍类 6 的实证：`(ctx as any).root`、`(host as Context).root`、`(ctx as Record<…>)['root']`、`(ctx as X)['root']` ⇒ **6**（receiver=ctx/host）；fail-closed 不可解析 `(0 as any).root`、`a[i].root` ⇒ **6（UNRESOLVED）**；树锚点 `(snap as …)['root']` ⇒ 5D（snap）、`(input2 as …).root` ⇒ 5D（input2）、`harness.ts:537` 复合行 ⇒ 5D（opts）；大小写 `fiberCtx`/`timerCtx` ⇒ 6、`fiberCTX` ⇒ 5D；注释行 `*`/`/*` 形 ⇒ 5。辅助函数与修后 `scan.mjs` 逐字一致（本会话逐行比对） |
| 迁移两行的注释属性 | `sed -n '38,50p' packages/persistence/src/service.ts`；`sed -n '206,218p' packages/ws-replication/src/plugin.ts` | `service.ts:41` = `* 形态 = \`Symbol.for('cordis.root')\` 优先、legacy \`root\` 实例属性兜底…`、`plugin.ts:210` = `* Shape mirrors the persistence seam: \`Symbol.for('cordis.root')\` first…`——**均为 `/** … */` 块内的 `*` 引导 JSDoc 纯注释散文行**（反引号为注释内 prose 非字符串字面量）；修前脚本按行级反引号启发式误判「字符串内部」落类 3，修后按类 5 规范文归属——「规范文强制」主张属实 |
| 修后 cat_3=7 / cat_5=4 全量清单 | 逐行提取 `report-main.txt` | cat_3（7）：`service.ts:46`、`service.ts:49`、`plugin.ts:217`、`ws-replication-guard-proxy-consumption:105`、`issue299-ac-red:183`、`issue422-listen-false:93`、`ws-replication-plugin:34`；cat_5（4）：`service.ts:41`、`plugin.ts:210`（本轮迁入）+ `plugin.ts:264` ×2（`//` 行两 token，iter-2 已在案未动） |
| 自检表锚点逐条对账 | 逐行 grep `report-main.txt` | `registry.ts:1472`（5D receiver=payload）、`:711`（record）、`:1506`（p）、`issue-348…:147`（fx）、`app.ts:864/:880`（args）、`request-body.ts:131`（5D-C callee=Object.prototype.hasOwnProperty.call）、`create-namespace.ts:292`（callee=validationProblemResponse）、`schema-write.ts:383`（**snap**）、`registry-create.test.ts:548`（**input2**）、`harness.ts:537`（opts）、`service.ts:46`（类 3）、`issue301…:624`（类 2）、两 seam `service.ts:86`/`plugin.ts:251`（类 1 M4 callee=safeReadChannel）——**设计 §9.2 自检表 12 个实存锚点 + 2 cast 探针行全部与报告一致** |
| N-6 钉死集未动 | 实读 `n6-scratch/n6-g10-scratch.ts`（7 行）；设计 L315 注/L391 | 样本内容 = 三形态（`const r = ctx.root` / `const { root } = ctx` / `ctx?.root`）+ 一个 `ctx` 形参、**零 Cordis 标记**，与 §12.8-1(b) 追认钉死内容逐字一致；cast 形**不进** N-6（设计明文），仅进回归自检表与探针 |
| 大小写修复的 BASE 影响 | `grep -oE "receiver=[A-Za-z0-9_$]+" report-main.txt \| sort \| uniq -c \| grep -iE "ctx\|host\|context"` | **空**——5D-R 196 条接收者无任何 ctx/Ctx/host/context 族（含大小写变体）token，大小写修复对 BASE 计数零影响（cat_2=13 的 helper 调用与类 1 清单不含 5D 记录，另经 cat_2/类 1 清单目验） |
| 上轮裁决与 SA2 判据文本 | 本报告 §13.8（I-1/I-2/I-3 原文）；SA2 `…_sa2_review.md` §18.5/§18.7 | I-1 字面允许域 = 「计数逐项一致（19/13/**9/2**/242/0）+ 285 条 + 仅两行 token 修正」；SA2 F-9 接受判据字面 = 「计数逐项相同（19/13/**9/2**/196/46/0 与 3）」——两者均以修前（偏离）脚本输出为基数 |

辅助证据（不承载判据，同 iter-2 §13.1 口径）：`scan-noface.mjs`/`report-noface.txt` 未随 rev 2.1 同步（设计 L351 明文「不得用于判据」）；`--sample` 尾行 argv 瑕疵（SA2 O-6）在修后报告仍在（无 `--sample` 时打印 `## sample family: /usr/local/bin/node` 尾段，零匹配行）——纯输出瑕疵、不影响计数与判据，维持 SA2 O-6/设计 §17.3 表态（gates.mjs 自检走显式断言，不采该便利开关）。

## 14.2 逐项裁决（dispatch 项 1–5；每项 clear/reject + 证据锚点）

### 项 1 — I-1 对账基线变更：**程序上超出 iter-2 I-1 字面允许域（回 SA8 正确）；实体上 delta 为规范文强制 → 追认 + 发布更新基线（I-1@rev2.1，见 14.8-2）；3→5 迁移「只降不升」成立；cast 形仍类 6** — **clear（附基线更新与自纠注记）**

- **字面裁定**：iter-2 I-1 允许域 = 「分类计数逐项一致（`cat_3=9 cat_5=2`…）+ 285 条 + 允许且仅允许两行记录级 token 修正」。本轮 `cat_3/cat_5 = 7/4` **不在该字面允许域内**（类分布变化非 token 修正）——SA1 未自行吞下该差异而按「超出即回 SA8」送裁，**程序正确**。
- **实体裁定（规范文强制，四条独立证据链）**：(i) **钉死规范文本已含该语义**——iter-2 §13.5 钉死的 §9.2 rev 2 R2 类 5 行原文即「注释命中（行内 `//` 之后**或 `*`/`/*` 引导的纯注释行**…）」，SA2 iter-2 评审（修订前独立成文）F-9 亦引述「设计类 5 含 `*`/`/*` 引导行——JSDoc 行 `* reads ctx.root` 脚本判 6、**规范判 5**」，可证非本轮事后补文；(ii) 两行实体属性经本会话实读核实为 JSDoc 纯注释散文（14.1 表 7 行），类 3「字符串字面量内部」语义对注释内反引号 prose 不适用，类 5 为唯一正解；(iii) 修前/修后逐字节 diff 恰 4 行、`cat_6` 两 pass 均不变（0→0、3→3）——delta 完整、无第 5 处漂移；(iv) 大小写与 cast 修复对 BASE 计数零影响（14.1 表 4/11 行），计数变化唯一来源即 `commentSpan` 修复。
- **自纠注记（本会话诚实披露）**：iter-2 §13.2 项 1 附注列举脚本「三处已核实偏离」**不完备**——cast 括/大小写/M4 跨行之外，`commentSpan` 不识别 `*` 引导行系第 4 处偏离，本会话 iter-2 复跑只做了「脚本输出 == 留档」的自一致性核证、未对该维度做脚本↔规范文保真核验，致 I-1 钉死的计数值（9/2）被偏离脚本污染。SA2 F-9 以探针法补获。**被污染的是取证数值，不是钉死语义**（§9.2 rev 2 规范文自 iter-2 起未变）；且按 I-1 自身「落地以设计文本为准、不照抄脚本」的原则，忠实落地本就产出 7/4——iter-2 数值若不更新，I-1 对账条款对忠实实现**不可满足**（与 F-5r 同族的「钉死谓词按旧基数不可满足」缺陷）。故基线更新是使 I-1 可满足的**必要修正**，非放宽。
- **「只降不升」判定：成立**。(a) 迁移两行均在**非红且全量记录**的排除类之间移动（3→5，二者都「排除并记录」、随 gates.log 输出），不触类 6 语义；`cat_6` 主证 0→0、负控 3→3，byte-diff 证明无任何红类记录参与移动——**本迁移不可能把红命中掩成非红**。(b) 修复的判定顺序（类 5 注释检查先于 V_ctx 判别）对 `*`/`/*` 引导行确有「行内 V_ctx 直读 ⇒ 类 5」的理论通道，但该通道是 **iter-2 已钉死的 rev 2 规范语义**（非本轮新增）：`*`/`/*` 引导行在 TS/JS 语法上为块注释续行、不可执行（唯一病态逃逸 = 跨行乘法续行如 `a\n * ctx.root`，属词法 gate 固有边界、与已声明的 O-2 别名/动态下标同族，设计 L286 显式声明）；该类命中仍**逐条记录**于类 5 并附摘录（非静默），BASE 零实存（byte-diff + `cat_6` 不变性证明），生产 src 由 G2/G3 零 diff 冻结、威胁模型为十文件 ALLOW 内的意外回归且实现复审逐行审 diff——不构成新掩蔽面。修前脚本对该形态判 6（比规范更严）只是偏离脚本的副作用，不能作为基线依据（否则与 I-1「以设计文本为准」自相矛盾）。
- **cast 形仍类 6：成立**（14.1 表 6 行）：M1/M2 cast 括形 4 条探针全 ⇒ 6（receiver=ctx/host，`inner[0]` 解析接通）；不可解析 2 条（`(0 as any).root`、`a[i].root`）⇒ 6（UNRESOLVED fail-closed）——**SA2 F-9 主体（fail-closed 被静默降级为 5D）已修复且被探针钉死**；实存 cast 命中仅 2 处（snap/input2，均 ∉ V_ctx ⇒ 5D，token 已如实记录）。
- **新基线逐项发布**：见 14.8-2（各类计数、两行 token、迁移逐行清单、cat_3/cat_5 全量清单、负控三形态）。

### 项 2 — I-2（G10–G12 联动）：**clear** —— gates.mjs 侧零新增编辑点

- §7.3 G10 行（L181）形态不变：仍是单一 gate 编辑点、算法引 §9.2（rev 2 → 标注 rev 2.1 = 取证对齐）+ I-1 绑定句；§7.3 G12 行（L183）**钉死值零变化**（同 4 文件零 diff + 4 文件闭合白名单 + 目录内新增文件即红）。本轮新增的 I-2 联动句与 `changedPaths`（tracked diff ∪ untracked）显式口径是**绑定解释与既有机械的显式化**——`changedPaths` 并集机制自 iter-1 F-7 起即为 gates.mjs 既有机械（`gates.mjs:109–118`）且 iter-2 I-2「新增文件即红」已含其义，显式化同时闭合 SA2 O-4，无语义变化、无新编辑点。
- §9.2 内的 R1 cast 钉死句 = 对既有 rev 2 语义（M2 行「cast 括形取括内首个标识符」原文 + SA2 iter-2 引述的 R1 规则）的重述与 I-1① 机械承载；R1 M4 跨行实参位钉死 = I-1③ 义务入文（fail-closed 方向 = 收紧）；R2 类 4 行改写 = 修正被干跑实录反驳的表述（「任何 matcher 均不触发」不实；类 4「键形结构性非候选」机械语义不变，复合行读取部分照常判定本就是机械行为）。三处均**落在 iter-2 §13.5 钉死语义 + §13.8 I-1 义务的包络内**，属追认对象而非新授权（见 14.8-1）。

### 项 3 — I-3（自检断言绑类 + token）：**clear** —— 逐行绑定成立；cast 断言与实证一致；N-6 钉死集未动

- **每行绑类 + token**：设计 §9.2 自检表（L319–335）实读核验——9 个实存接收者/被调锚点行全部携带「类 + receiver=/callee= token」（14.1 表 9 行逐条对上报告输出），含修后的 `:383 → 5D receiver=snap` 与新增 `:548 → 5D receiver=input2`；`harness.ts:537` 行改写为「定义位键形结构性非候选（类 4）+ 同行 `opts.root` ⇒ 5D receiver=opts」——与报告实录一致（iter-2 表述「任何 matcher 均不触发」被实录反驳，本会话 iter-2「分类相符」核验对复合行粒度过粗、已由 SA2 F-9 纠正，rev 2.1 改写正确）。非接收者判别行（类 2 helper 调用/类 3 字符串内部/非候选形）绑定锚点 + 类 + 形态理由，符合 I-3「使接收者/被调解析处于被测状态」的立法目的（其判别不经过接收者/被调解析）。
- **cast 回归断言与实证一致**：表内两行 cast 探针断言（`(ctx as any).root` ⇒ 类 6 receiver=ctx；`(ctx as Record<…>)['root']` ⇒ 类 6 receiver=ctx）与 `cast-probe.mjs` 实跑 17/17 全 PASS 逐条一致（探针另覆盖 `(ctx as X)['root']`/`(host as Context).root`/不可解析 fail-closed 形），辅助函数经逐行比对为修后脚本逐字复制——I-1① 的机械承载在自检面闭环。
- **N-6 三形态钉死集未动**：scratch 内容逐字 = §12.8-1(b) 追认钉死值（三形态 + 一个 `ctx` 形参 + 零 Cordis 标记），设计 L315 明文 cast 形不进 N-6——SA2 F-9(4) 的条件分支（「若改 N-6 三形态钉死内容则须随 §12.8-1 一并回 SA8」）**未触发**，无需该分支的追加追认。

### 项 4 — 守界与新规范冲突面：**clear（零命中）**

- **十文件 ALLOW 零增删**：设计 §12.1（L403–412）与本报告 iter-0 §9.1 逐条同名同序（含台账条目 10 转正态），闭合世界 DENY（L414/L418）原样。
- **T-2 允许清单零增删**：修后 `scan.mjs` `LINE_ALLOW` 恰 5 行（两 seam `:86/:251` + 三 fixture 双读 `:19/:171/:39`）+ `FILE_ALLOW` 恰 2 文件——与 iter-1 §12.2 项 3 追认值逐字相同；设计 L292 类 1 行同值；G11 空集原样（L182）。
- **其余授权全尊重**：T-1a 四款在 §8.1/§7.2 E5/§13.2/L79 原样（23 名枚举/`coverage` 定名/fail-closed/69 并集）；T-3 = B-3a…e 在 §4.1/§13.0 原样；T-4 = N-6 三形态在 §11/§9.2 原样；B-1…B-5 在 §4.1 原样；E-增补授权（E1–E7/E4a、G6 挂基座、G2-G3 形状、F-3 suite 常量）在 §7.2/§7.3 原样；§9.3 十二条交付条件经 §13.2 对齐原样。
- **无新规范冲突面**：本轮 delta 全部为验收设施取证与自检表述（设计文本 + gitignored `.cache` 产物），零触碰 ADR/CONTEXT/协议文本、wire/schema/持久化/状态机/公共 API（工作树 tracked 零修改佐证）；iter-0 §3.6、iter-1 §12.2 项 7、iter-2 §13.3 的零命中结论维持。V_ctx 大小写敏感化对 BASE 零计数影响（14.1 表 11 行空集证明）；`fiberCTX` 出表系钉死词表的既有命名决策（iter-2 §12.8-1(d)「命名显式、机械可判」授权面内），非词表放宽——词表成员集合本身零增删。

### 项 5 — 结论与路由

见 14.8–14.11。SA2 侧注记：本轮计数 delta（7/4）与 SA2 §18.5 F-9 接受判据字面（「计数逐项相同 19/13/9/2/196/46/0」）不符——该判据基数取自修前脚本、其「BASE 零实存」核验只覆盖 V_ctx/类 6 面（SA2 自述于 F-9 (ii) 条），未覆盖类 3↔5 注释行移动；设计 §9.2 取证节（L348）已如实披露该偏差及成因。**从 SA8 决策集合看 delta 为规范文强制（项 1 四链证明），不构成冲突**；F-9 接受判据的闭合由 SA2 定向复审（设计 §18-4/SA2 §18.7 已路由）按本章基线重载，不属 SA8 重开面。

## 14.3 Decision analysis（增量汇总）

| 决策/约束 | 条款 | iter-3 行为 | 分类 | 证据 | Required action |
|---|---|---|---|---|---|
| iter-2 §13.8-2（I-1） | BASE 首跑与干跑对账、仅允许两行 token 修正、超出即回 SA8 | 类分布 9/2→7/4 超出字面域 → 如约回 SA8；delta 经四链证明为规范文强制 | implements-existing-decision（对账义务兑现 + 基线勘误） | 14.1 表 5/6/7/11 行、14.2 项 1 | **I-1@rev2.1 新基线发布（14.8-2）** |
| iter-2 §13.5 钉死值 | §9.2 rev 2 语义整体，任何增删须回 SA8 | rev 2.1 的 R1 钉死句/M4 跨行句/R2 类 4 行改写/自检表增改 = 既有语义重述 + I-1/I-3 义务入文 + 被实录反驳表述的修正，语义零变化 | no-conflict（追认，见 14.8-1 清单） | 14.2 项 2/3 | 无（追认生效） |
| iter-2 §13.8-3（I-2） | G12 弱化 ⇒ G10 盲区 ⇒ 回 SA8 | G12 钉死值零变化；联动句 + changedPaths 显式化（O-4 闭合）无语义变化 | no-conflict | §7.3 G12 行（L183） | 实现期专项核对（14.11(iii)） |
| iter-2 §13.8-4（I-3） | 自检断言绑类 + token | 12 实存锚点 + 2 cast 探针逐行绑定，与报告/探针实证一致；N-6 钉死集未动 | implements-existing-decision | 14.1 表 6/9 行 | 无 |
| SA2 §18.5 F-9 | 修脚本三处 + 复跑 + 自检两行改写 + cast 断言 | (1)–(4) 逐条落实（计数 delta 部分见 14.2 项 5 注记） | implements-existing-decision（SA8 判据面闭合；SA2 判据面待其定向复审） | 14.1 表 1–6 行 | SA2 定向复审（路由已在盘） |
| iter-0 §9.1/§9.2-T-2 | 十文件闭合 / 允许清单钉死 | §12.1 十文件、LINE/File allowlist 逐字原样 | no-conflict | 14.2 项 4 | 无 |
| E-增补授权/T-1a/T-3/T-4/B-1…B-5/§9.3 | 不得回退面 | 全部原样在盘 | no-conflict | §4.1/§7.2/§7.3/§8.1/§11/§13 | 无 |

## 14.4 Overrides

无（同 iter-2 §13.4；本轮为取证面勘误与义务吸收，规范集合内自解，无 override 诉求）。

## 14.5 Frozen surfaces（增量确认）

iter-0 §6、iter-1 §12.5、iter-2 §13.5 全表继续有效。**iter-2 §13.5 钉死值的语义内容零变化**；其**取证对账数值面**自本章起更新为 rev 2.1 值（14.8-2）——即「§9.2 rev 2 语义整体（R0/R1/R2/自证伪/自检表/通过判定）+ I-1@rev2.1 对账基线」为 G10 落地的完整钉死面；G11 空集、G12 白名单维持。实存 cast 锚点 token（snap/input2）与迁移两行（`service.ts:41`/`plugin.ts:210` ⇒ 类 5）一并钉死。

## 14.6 Evolution requirements / 14.7 Hard conflicts

均无：本轮未触碰 ADR/CONTEXT/协议文本；无与决策集不兼容项（14.3 全表 no-conflict / implements-existing-decision）。

## 14.8 Required actions

1. **rev 2.1 增补句逐项追认生效**（§13.5 钉死值包络内，均非新授权）：(i) R1 cast 括形解析钉死句（L283，既有 rev 2 语义重述 + I-1① 机械承载）；(ii) R1 M4 跨行实参位钉死（L281，I-1③ 入文，fail-closed 方向收紧）；(iii) R2 类 4 行「键形非候选 + 复合行读取照常判定」改写（L295，修正被实录反驳的表述，机械语义不变）；(iv) R2 类 3/类 5 行锚点注记（7 处/两迁移锚点）；(v) 自检表改写与增行（`:383` token、`:548` 新锚点、`:537` 复合行、2 cast 探针、I-3 intro 句）；(vi) R0 末 I-2 联动句 + §7.3 G12 `changedPaths` 显式口径（O-4 闭合）；(vii) §9.2 取证节对账叙述（L344–L351）。落地 `gates.mjs` 仍限 §9.1 文件 3、无 ALLOW 增删、无编辑点新增（iter-2 §13.8-1 维持）。
2. **I-1 对账基线更新为 rev 2.1 值（替代 iter-2 §13.8-2 数值；落地后 gates BASE 首跑以此为锚，逐项钉死）**：
   - **计数（主证）**：`scanned_files=732 cordis_faced=45`；`cat_1=19 cat_2=13 cat_3=7 cat_5=4 cat_5DR=196 cat_5DC=46`、**`cat_6=0`**、合计 **285**。
   - **计数（负控 `--n6`）**：`scanned_files=733 cordis_faced=45`、**`cat_6=3`** 恰三注入形态（`n6-g10-scratch.ts:4 [M1 receiver=ctx]`、`:5 [M3 source=ctx]`、`:6 [M1 receiver=ctx]`），其余计数与主证逐项相同。
   - **token 修正恰两处（类不变，均 5D-R）**：`registry-create.test.ts:548 receiver=input2`、`schema-write.ts:383 receiver=snap`。
   - **类 3→5 迁移恰两行（逐行清单）**：`packages/persistence/src/service.ts:41`、`packages/ws-replication/src/plugin.ts:210`（均 `*` 引导 JSDoc 注释行 ⇒ 类 5）。
   - **cat_3=7 余量清单**：`service.ts:46`、`service.ts:49`、`plugin.ts:217`、`guard-proxy-consumption:105`、`issue299-ac-red:183`、`issue422-listen-false:93`、`ws-replication-plugin:34`；**cat_5=4 清单**：上两迁移行 + `plugin.ts:264` ×2（`//` 行两 token）。
   - **对账规则（沿 I-1 原则更新）**：落地实现以 §9.2 设计文本语义为准（I-1①②③ 三点义务不变）；BASE 首跑计数逐项复现上列 rev 2.1 值 + 285 条全量对账；**允许且仅允许**记录级 token 等价修正（现两行已按 `snap`/`input2` 修正，落地不应再出现 `receiver=undefined`）；任何超出（含新的类间移动、计数漂移、第 286 条）即回 SA8。
3. **I-2/I-3 维持 iter-2 §13.8-3/-4 原文义务**，实现期逐项核对（G12 未弱化、自检逐行类 + token、cast 探针断言在 gate 自检内实跑）。
4. **SA2 定向复审路由确认**：F-9 接受判据按本章基线重载（14.2 项 5 注记），仅 F-9 一点，不重开其他面。
5. 其余已追认事项（E-增补授权、F-1…F-8 闭合、十文件 ALLOW、B-1…B-5、T-1a/T-2/T-3/T-4、§9.3 十二条）维持，实现期不得回退。

## 14.9 ALLOW 增删结论

**文件级：无增无删；编辑点级：无新增授权。** 本轮改动面 = 设计文档自身 + gitignored `.cache/issue471-g10-dryrun/` 取证产物（非 ALLOW 对象）；§9.2 rev 2.1 的 R1/R2/自检表增改均落 §13.5 钉死值与 I-1/I-3 义务包络内（14.8-1 追认清单），不构成对任何文件或编辑点的新授权。

## 14.10 Verdict（iteration 3）

**clear** —— 四项逐裁：项 1（I-1 基线变更）**clear 附基线更新**（delta 程序上如实回裁、实体上四链证明为规范文强制；「只降不升」成立——迁移仅在两个非红全量记录排除类之间、`cat_6` 两 pass 不变、byte-diff 恰 4 行；cast 形经 17/17 探针实证仍类 6 且 fail-closed 通道接通；iter-2 计数值系偏离脚本污染、更新为 rev 2.1 值是 I-1 可满足的必要修正）；项 2（I-2）**clear**（gates.mjs 侧零新增编辑点，G12 钉死值零变化，changedPaths 显式化无语义变化）；项 3（I-3）**clear**（自检表逐行绑类 + token 且与实证一致；cast 断言闭环；N-6 钉死集未动）；项 4（守界）**clear（零命中）**。SA2 iter-2 的唯一阻断 F-9 在 SA8 判据面闭合；I-1 对账基线以 14.8-2 为准。设计可放行 SA3 实现（仍以逐条兑现 §9/§12/§13 + 本章 14.8 义务为前提）。

## 14.11 requiresConflictRecheck（iteration 3）

**true** —— (i) iter-0 §11、iter-1 §12.11、iter-2 §13.11 全部理由维持；(ii) **G10 首落地必查项按本章更新**：BASE 首跑按 **I-1@rev2.1 基线**（14.8-2 逐项）复现 + 285 条全量对账、N-6 三样本红、seam 自校验、I-3 自检断言（含 cast 探针 ⇒ 类 6）逐项核对；(iii) I-2 联动条款在 gates diff 审查中专项核对（G12 未被弱化、changedPaths 并集口径在位）；(iv) SA2 F-9 定向复审闭合后如再触 §9.2 语义面须回 SA8；(v) 本章基线更新本身（数值面）已闭合、无待实现核对的悬置项。
