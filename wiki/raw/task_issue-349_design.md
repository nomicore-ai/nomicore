# SA1 架构与实现设计 — issue #349 条件写端到端：mutateData 透传、诊断 rejected 与写序列器竞争证明（guard III）

- 任务类型：**feature / verification**（验收证明票：guard 目标能力已由 #347 落地于 HEAD；本票缺口是竞争、生命周期与组合**证明面**在可执行测试语料中不存在）
- 上游输入：brief `wiki/raw/task_issue-349.md`（Issue 正文 AC1–AC8；REST 预读 comments 为空）、SA6 契约 `wiki/raw/task_issue-349_sa6_contract.md`（approve；§12 冻结 K/L/N/D/NC 用例表）、SA8 `task_issue-349_relevant_decisions.md` + `task_issue-349_conflict_report.md`（verdict **clear**；4 项 required actions）、SA2 评审 `wiki/raw/task_issue-349_sa2_review.md`（iteration 0 verdict **reject**：F1/F2 两项 MAJOR，均为文本级证据/规格修订；**本轮 = iteration 1 逐条落实**，范围与零生产改动约束不变，评审映射见文末）
- 设计结论补充（iteration 1）：本轮修订仅更正 typecheck 覆盖机制的事实陈述（F1）与钉死诊断 log 构造选项（F2），不改变任何用例、断言口径、落位与文件范围
- 基线：HEAD `61e2daa37e21b467e7ce130d5c4db7be38bde982`（#347 合并点）；worktree `/home/wangjian/nomicore-fix-issue-349`，分支 `mabf/issue-349`
- 设计结论：**本票产物 = 单个新增验收测试文件，生产实现零改动**（SA6 probe P-A…P-F 在 HEAD 实测全部目标断言已绿）；红灯即回归，走升级路径不改产线

---

## 1. 任务类型、目标与非目标

### 目标

把 issue #349 AC1–AC8 要求的端到端证明面固化为可执行、可回归的验收测试语料，兑现 ADR 0025 L90 验证门槛中「namespace-runtime 写槽透传与序列器竞争测试」义务：

1. **竞争证明**（AC4/AC1/AC2）：两个受控写带同一 guard 串行提交——第一个成功、第二个基于**已提交的新值**判定并零写入拒绝；三写交错时中间无第三写插入「guard 评估 → 提交」间隙（TOCTOU 消除的槽级证明面）。
2. **透传证明**（AC1）：guard 不满足经 `MutateDataResult.issues` 透传，`issues[0].code === MUTATION_GUARD_MISMATCH`、`issue.path` = guard 条件路径。
3. **诊断证明**（AC3）：装配 diagnostic emitter 时 guard 拒绝以 rejected 变更尝试落日志（stage=validation、result=rejected、issue 携稳定码、record 级无顶层码）；未装配时业务结果逐字等价。
4. **生命周期证明**（AC6）：closing/closed 期带 guard 的 `mutateData` 仍按接纳门 `RUNTIME_WRITE_DISABLED` 拒绝（零输入访问），guard 不改变门次序；已接纳 guarded 写随 close 无条件排空。
5. **非 fatal 证明**（AC5）：guard 拒绝不触发 fatal、不损后续写能力。
6. **批量组合证明**（AC7）：`{ ops, guard }` 竞争拒绝零写入、诊断 rejected 单条记录、成功路径单事务单条 update bytes。
7. **门槛收口**（AC8）：新用例按既有 mutate/sequencer/fullchain 测试组织方式落位；根 `pnpm typecheck` + 根 `pnpm test` 通过。

### 非目标

- 不改 doc-runtime 语义（guard 核已由 #347 落地并冻结）；不改 namespace-runtime 生产实现（透传与诊断走既有管线）。
- 不触碰 wire / 复制 apply / `replaceSchema` / META（ADR 0025 L64–66 边界外，零断言零改动）。
- 不重复 #347 已冻结的 doc-runtime 次序用例（O1–O3）与形状错误族用例（E7 之外不新增形状用例；NC3/NC4 仅作负控锚复跑）。
- 不新增公共观测面、不改诊断 record schema（指纹冻结）、不新增稳定码、不触碰 ADR 0025 开放问题 1–3（词表演进、读改写组合子、跨实例执法）。
- 无性能/规模断言；无跨实例复制 × guard 断言（约定级边界，0025 L65 明示不承诺）。

## 2. 当前行为与证据锚点（HEAD `61e2daa`）

### 入口与调用链

| 锚点 | 事实 |
|---|---|
| `packages/namespace-runtime/src/runtime.ts` L512–533 | `mutateData(mutation)`：L515 D5.1 接纳门——`lifecycle !== 'ready'` 时同步零入队、经返回 Promise 即时 settle `disabled(...)`（不 throw、**不读 mutation**，Proxy 零触发）；L518–522 装配 emitter 时该拒绝 emit `stage:'acceptance'`、`code: RUNTIME_WRITE_DISABLED_CODE`、`input:{status:'not-accessed'}` 的 attempt 记录；L527 ready 期 `sequencer.enqueue(() => runRootWriteSlot(...), 'S')`；L528–531 槽 settle 后 `emitSlot` |
| `packages/namespace-runtime/src/sequencer.ts` L94–155 | 唯一 FIFO 排序机构：`settled = this.tail.then(run, run)` + `this.tail = settled.then(noop, noop)`（L91–92 注释 G1：不移动/移除/并行化槽序）；入队回调经微任务排程（INV-N1）；槽级样本 `SequencerSlotSample{slotKind, waitMs?, runMs, queueDepthAtStart}`（L49–57）；flush 在槽 settle 后续体（L150–153），sink throw 自捕获（L172–174） |
| `packages/namespace-runtime/src/write.ts` L94–230 | 写槽槽序 S1–S7：S1 fatal gate（L96）→ S2 writable+notifier（L106–136）→ S3 输入快照（L139–146）→ S4 active schema（L149–171）→ S5 `applyValidatedMutation`（L187，唯一 Y.Doc 写入口；diag 在场时订阅 `update` 事件捕获 bytes，L180–204）→ **R9**（L205–208：`!result.ok` → `diagValidation(diag, result.issues)` + `return { ok:false, issues: result.issues }` 同源透传）→ S6 `await notifyDirty()`（L211–226）→ S7 settle |
| `packages/doc-runtime/src/mutation.ts` L173–178 | 单操作：信封解析成功后、局部/legacy 分叉前、schema 校验前评估 guard；不满足 → `{kind:'fail', issues:[单 issue]}`，零写入、不进事务 |
| `packages/doc-runtime/src/mutation.ts` L276–292 | 批量：E1 顶层键封闭（恰 `ops`∪可选 `guard`）→ E6 顶层 guard 形状校验 → G 顶层 guard 评估恰一次、先于逐操作 prepare；不满足 → 恰 1 issue、整体零写入 |
| `packages/doc-runtime/src/mutation.ts` L62、L648–683、L711–729 | `MUTATION_GUARD_MISMATCH = 'MUTATION_GUARD_MISMATCH'` 定义；`parseGuard` 形状域（无码）；`evaluateGuard` 纯读 `readLogicalValueAtPath` 投影 + 结构深相等；`mismatchIssue` 产出 `{message（含期望/实际有界摘要）, path:[...guard.path], code}`；`src/index.ts` 导出该码（SA8 relevant_decisions §8 实证） |
| `packages/namespace-runtime/src/diagnostic.ts` L271–274 | `diagValidation`：`diag.outcome = { stage:'validation', result:{kind:'rejected'}, issues }`——**无顶层 code**（码落 issues 通道，ADR 0011 §B） |
| `packages/namespace-runtime/src/status.ts` L39/L45/L67–75 | `getStatus()` 八键：`rootWrite.enabled`、`fatal: {code,message}|null`（正常路径 null）——N1 观察面 |
| `packages/persistence/src/lifecycle.ts` L157–161 | `PersistenceHandle.release()` 幂等（`if (this.released) return`）——L4 用例 close 后 teardown 再 release 安全 |
| `packages/namespace-runtime/src/runtime.ts` L84–85/L104/L420–443/L790–816 | `replicationObservability{stageClock, slotMetrics}` 为 seam 构造输入（包内测试面，非公共面；ADR 0008 L97/L101） |
| `vitest.config.ts` L15/L18–22 | include `packages/*/test/**/*.test.ts`——新文件必被收集；`typecheck.enabled: true` + `typecheck.tsconfig: './tsconfig.typecheck.json'`——**每次 vitest 运行（聚焦 / 目录 / 根 `pnpm test`）都对该 tsconfig 定义的程序执行类型检查** |
| 根 `tsconfig.typecheck.json` L3–8 | include 含 `packages/*/src/**/*.ts` **与** `packages/*/test/**/*.ts`——新 `.test.ts` 文件落在 vitest 类型检查程序内（新文件类型检查覆盖的真实来源） |
| `packages/namespace-runtime/tsconfig.json`（全文件） | 仅 `{"extends":"../../tsconfig.base.json","include":["src/**/*.ts"]}`——**不含本包 `test/**`**；它是根 `pnpm typecheck` 14 个 `tsc -p` 项目之一，只覆盖本包 `src/**`。本包测试文件的类型检查覆盖**不来自该门**（F1 修正，iteration 0 版本曾误称其含 `test/**`）；该文件在 DENY LIST（§11），真实机制已覆盖新文件，无需亦不得改动 |

### 运行时已验证的目标行为（SA6 §5 probe，已删除的临时诊断，逐字留档于契约）

P-A 双写竞争（r2 带码拒绝、updates=1、终值=胜者、拒绝后非 fatal、重读重试 ok）、P-B emitter 装配/未装配逐字等价、P-C closing/closed 接纳门（Proxy 零访问、stage=acceptance）、P-D 批量竞争（1 update、payloadLength 一致、2 records）、P-E 三写交错（槽样本 `queueDepthAtStart [3,2,1]`、allSlotKinds `['S','S','S']`）、P-F close 排空窗口。**全部目标断言在 HEAD 即绿；最终 probe 版本连续 2 次运行结构一致（§7）。**

## 3. 根因 / 能力缺口

| Step | 事实 | 证据 |
|---|---|---|
| 1 | ADR 0025 L90 明示验证门槛含「namespace-runtime 写槽透传与序列器竞争测试」 | ADR 0025 L90；SA8 冲突报告裁决 #3/#11 |
| 2 | 该证明面在测试语料中不存在：全仓无两个并发 guarded 写竞争用例；无 guard × lifecycle 接纳门用例；无批量 + guard 竞争用例；`Promise.all` 在 namespace-runtime 测试中唯一命中为 #337 两笔无 guard 写 | SA6 §8 Step 3（grep 实测）；本设计复核：`packages/namespace-runtime/test/` 现存 45 个 `*.test.ts`、无 `issue-349-*` 文件（另有 5 个 `*.test-d.ts`，不计入 `.test.ts` 计数；vitest 目录收集口径 45+5=50 文件，见 §12 AC8 行） |
| 3 | 机制上行为应成立（接纳门 D5.1 先于输入读取；guard 评估与提交同槽；FIFO 独占使第二写必见已提交值；领域失败经 R9 进 issues 与诊断） | §2 锚点链 |
| 4 | 运行时实测全部目标断言在 HEAD 成立，无任何行为偏差 | SA6 §5/§13 |
| 5 | **缺口定性：不是行为缺陷，是验收证明面缺失**——与 brief「namespace-runtime 实现预期零改动」一致；本票 = 按 SA6 §12 冻结用例表落地测试，不存在可诚实生产的红灯相 | SA6 §8 Step 6/7 |

## 4. Owner 要求落实

| Comment ID | Updated at | Requirement | Design section |
|---|---|---|---|
| （无——Issue comments 经 REST 预读为空，dispatch 明示） | — | 无额外 owner 反馈要求；需求完全由 Issue 正文 AC1–AC8 承载 | §1 目标逐条映射 AC；§12 验收映射 AC1–AC8 |

## 5. 复现和根因承接

| 上游事实（SA6 契约） | 证据位置 | 设计响应 |
|---|---|---|
| HEAD `61e2daa` 上 AC1–AC7 全部目标断言运行时成立（P-A…P-F，probe 连续 2 次结构一致） | SA6 §5、§7 | 设计以「零生产改动 + 新增测试固化」为基线（§7 D3）；无红相纪律进入实现约束（§7 D3、§13） |
| 契约证明面缺失：竞争/lifecycle×guard/批量竞争用例不存在 | SA6 §8 Step 3 | 新文件承载全部 K/L/N/D/NC 用例（§7 D1/D5、§12） |
| 负控 NC1–NC6 全绿且必须保持 | SA6 §6 | NC1–NC4 以负控组纳入新文件（§12）；NC5（#347 E1–E7 逐字节不动）与 NC6（K4 窗口无杂槽）进 DENY LIST/断言纪律（§11、§12） |
| 断言敏感度由「负控 + 反向退化推理」承担（不可执行生产 mutation） | SA6 §13 | 设计保留全部冻结断言，禁止削弱（§7 D3）；敏感度表映射进验收映射（§12） |
| SA6 裁量项交 SA1：落位、K4 seam 观测、message 断言口径、命名不含 `-red` | SA6 §12.9.1/.3、§15 | §7 D1（落位裁决）、D2（K4 接受 seam）、§12.0 口径沿用（message 仅锚稳定码前缀 + K3 实际值文本）；命名确认无 `-red`（无红灯相） |
| 上游事实与源码矛盾 | 1 项已修正（iteration 1，SA2 F1）：SA6 §14「`packages/namespace-runtime/tsconfig.json` 含 `src/**/*.ts` + `test/**/*.ts`（新文件落在编译门内）」与磁盘事实不符——该 tsconfig 仅 `src/**` | 运行时行为类锚点逐一对源码复核一致（`runtime.ts` L512–533、`write.ts` L205–208、`diagnostic.ts` L272–274、`mutation.ts` L62/L173–178/L276–292/L648–683/L711–729、`sequencer.ts` L91–92/L147–153/L172–174、`status.ts`、`lifecycle.ts` L157–161）；工具链类锚点中 tsconfig 一项 iteration 0 版本沿用了 SA6 §14 的错误，已在本设计 §2 与 §13 R5 以真实机制改写（vitest typecheck 程序，`tsconfig.typecheck.json` include 含 `packages/*/test/**/*.ts`）。SA6 §14 原文错误在此登记供 Controller 对账，本设计不再沿用其结论。另：诊断包 `memory.ts` 的 `updateCapture` 缺省语义（L165/L217–221）为 SA2 首次核出、本设计复核相符并钉死进 §7 D5 |

## 6. SA8 约束落实

| 决议或义务（SA8 conflict_report / relevant_decisions） | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|
| Required action #1：零生产改动纪律——`namespace-runtime/src/*`、`doc-runtime/src/*` 预期零改动；任何 K/L/N/D 红 = 回归/阻断性偏差 → 停下升级、以 ADR 0025 为准裁定，不得就地改产线或放宽断言 | §7 D3、§11 DENY LIST、§13 R1 | 完整内化：升级路径、仲裁基准、禁止事项写入实现约束 | 否（遵循即不触发；若触发即新被审对象，见 §14） |
| Required action #2：最终验证必须根 `pnpm typecheck` + 根 `pnpm test` 收口 ADR 0025 L90 全门槛；聚焦/目录门槛为过程最低线不替代根门槛 | §7 D4、§12 验证门槛 | 双层门槛：过程最低线（聚焦 3 文件 + namespace-runtime 全目录）+ 最终收口（根 typecheck + 根 test） | 否 |
| Required action #3：冻结面保持——#347 E1–E7 字节稳定、诊断 record schema 指纹不动、无 skip/only/todo/env override、不降断言、不加 sleep 阈值断言 | §11 DENY LIST、§12 断言纪律 | 逐项列入 DENY LIST 与测试纪律条款 | 否 |
| Required action #4：落位裁量归属 SA1；若偏离 SA6 §12.1 冻结路径须回写契约且断言不得削弱 | §7 D1 | **接受 SA6 冻结默认路径（不偏离）→ 无需回写**；理由与备选记录于 §7 D1 | 否 |
| 裁决分布：implements-existing-decision 8 / no-conflict 12 / evolution-required 0 / hard-conflict 0 | §7、§14 | 本票零决策面触碰；测试文件不是决策文档（SA8 §6） | 否 |
| 冻结面清单（稳定码载体、record 指纹、写槽 R9、lifecycle 接纳门、元素禁 guard、wire 零断言、#347 锚） | §2、§11、§12 | 全部按「只断言不触碰」消费 | 否 |
| ADR 0025 L49/L51：原子性来自写序列器 FIFO 独占、guard 见最新 committed 值 | §7 D2、§8 数据流、§9 | K1/K3/K4/K5 竞争证明直接消费该条款 | 否 |
| ADR 0011 L18–27：诊断在场/故障不得改变业务结果 | §12 D1/D2 | D2 `rWith === rWithout` 逐字等价断言 | 否 |

## 7. 设计决策与主要备选方案

### D1 落位裁决（SA6 §12.9.1 / SA8 RA#4）：新增单文件，接受 SA6 冻结路径

**决策**：新建 `packages/namespace-runtime/test/issue-349-guard-e2e-competition.test.ts`，承载全部 K1–K6 / L1–L4 / N1 / D1–D2 / NC1–NC4 用例（17 例、5 个 describe 组）。**不偏离 SA6 §12.1 → 无需回写契约**。命名确认不含 `-red`：本票无红灯相（HEAD 全绿），文件名不得声称红色契约（SA6 §12.1 明示由 SA1 复核）。

理由：
1. issue-scoped 契约文件先例（`issue-347-guard-passthrough-red.test.ts`、`issue-350-*.test.ts`），单文件 = #349 证明面的单一可评审产物。
2. #347 E1–E7 冻结锚保持字节稳定（NC5）——散布扩展会触碰冻结面。
3. 跨组共享 fixture（memory persistence + emitter + seam 观测 + 门控 notifier）与既有 sequencer/lifecycle 文件的 fake-handle fixture 不同构；硬塞入会造成双 fixture 体系混杂。
4. vitest include（`vitest.config.ts` L15）收集已实证（SA6 H8 排除 + 目录 50 文件实测含同类文件）。

**备选（被否）**：扩展 `runtime-mutate-root-sequencer.test.ts` / `runtime-close-lifecycle.test.ts`——被否因由 2/3；且若采该路线须回写 SA6 契约（SA6 §12.9.1 义务），徒增对账面。

### D2 K4 槽级观测（SA6 §12.9.3）：接受包内 seam 观测，纳入正式验收

**决策**：K4 经 `createNamespaceRuntimeWithSeam({ replicationObservability: { stageClock, slotMetrics } })` 观测槽样本，断言窗口内恰 3 条 `slotKind==='S'` 样本、`queueDepthAtStart` 依次 `[3,2,1]`、样本序 = 入队序、`runMs`/`waitMs` 为 number、`allSlotKinds === ['S','S','S']`。

理由：K3 的业务结果（[ok, ok, reject] + 终值 + update 计数）只能证明终态一致于串行语义，**不能区分「严格 FIFO 槽独占」与「恰好串行的其它调度」**；样本深度单调递降序列是「guard 评估 + 提交之间无第三写插入」唯一直接可观测的槽级证据，且 seam 观测有既有先例（`sequencer-slotkind-close-barrier.test.ts` 同款注入）、不新增公共面（ADR 0008 L97/L101 边界保持）。

**备选（被否）**：仅以 K3 为主证、放弃 K4——牺牲槽级直接证据，且 seam 先例已存在、零新增成本；无取舍必要。

### D3 零生产改动预期与升级路径（SA8 RA#1）

**决策**：实现阶段 `packages/namespace-runtime/src/**` 与 `packages/doc-runtime/src/**` 零改动。任何 K/L/N/D 断言红 = **回归或阻断性偏差**，处置序列固定：
1. 立即停止，不改产线、不放宽断言、不加 skip/only/todo/env override、不降敏感度；
2. 以 ADR 0025 为准定位偏差语义（评估位置 / 原子性归属 / 错误域 / R9 透传 / 接纳门次序）；
3. 升级回 SA1 重审设计并触发设计后冲突复查（SA8 §10 边界条件：红灯偏离本身构成新被审对象）——所需裁定可能是「实现缺陷修复」或「ADR 层演进」，由复查裁决，本设计不预设结论。

**备选（被否）**：实现角色就地修产线——违反 SA8 RA#1 与 brief「若发现阻断性偏差以 ADR 0025 为准修正」的裁定次序（先裁定后修正，且修正是否需要属决策复查输出）。

### D4 验证门槛（SA8 RA#2）

| 层 | 命令 | 角色 |
|---|---|---|
| 过程最低线 | `NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run packages/namespace-runtime/test/issue-349-guard-e2e-competition.test.ts packages/namespace-runtime/test/issue-347-guard-passthrough-red.test.ts packages/namespace-runtime/test/runtime-mutate-root-sequencer.test.ts packages/namespace-runtime/test/runtime-close-lifecycle.test.ts`（新文件 + 聚焦 3 文件），随后 `vitest run packages/namespace-runtime/test`（全目录） | 快速回归定位 |
| **最终收口** | 根 `pnpm typecheck` + 根 `pnpm test`（= `vitest run --typecheck`，含全部 packages/domains/apps） | 兑现 ADR 0025 L90 全门槛与 AC8；**不得以聚焦/目录门槛替代** |

门槛机制口径（F1 修正后，两道门互不替代、均必跑）：

- **根 `pnpm typecheck`** = 14 个 `tsc -p <package>/tsconfig.json` 项目顺序编译；其中 `packages/namespace-runtime/tsconfig.json` 仅含 `src/**`，**不覆盖本包测试文件**——该门的覆盖对象是全部包的 `src/**` 面。
- **新测试文件的类型检查覆盖来自 vitest typecheck 程序**：`vitest.config.ts` `typecheck.enabled: true` + `typecheck.tsconfig: './tsconfig.typecheck.json'`（include 含 `packages/*/test/**/*.ts`）——聚焦运行、目录运行与根 `pnpm test`（`vitest run --typecheck`）都执行该程序检查（SA6 §4/§14 聚焦与目录运行实测输出均含 `Type Errors no errors`，即门已生效）；#347 同位置 `.test.ts` 已实证在门内。
- tsconfig / vitest 配置均在 DENY LIST（§11）：真实机制已覆盖新文件，**不得以「补齐 namespace-runtime tsconfig 的 test include」为名改动任何 tsconfig**（SA2 §11 注意事项）。
- 全仓基线留档（SA2 N2）：根 `pnpm test` 全仓在 HEAD 的基线未被 SA6 实测（其只实测根 typecheck + 本包目录 + 聚焦 3 文件）；实现/最终验证阶段先留档 HEAD 全仓输出，与本票无关的既有红按基线事实登记，不当作本票回归、不就地处理。

### D5 测试文件结构（test-proof change plan）

- **fixture**：沿用 #347 文件同款 helper（`makeDoc` / `setup` / `teardown` / `readOk` / `bytesOf` / `failureOf` / `waitAttempts`），根文档 `{n:1, a:'x', tasks.t1/t2:{status:'open',reviewer:'r0'}, values:[1,2,3]}`。扩展三点（全部为 seam 输入侧，零生产面变化）：
  1. `setup({ observability })`：透传 `replicationObservability{stageClock:{now:()=>0 或单调计数}, slotMetrics: sample=>samples.push(sample)}`（K4；先例同款）；
  2. `setup({ gate })`：可控 notifier 门——`notifyDirty` 先 `await gate.promise` 再 `saveDoc`（L4：使已接纳 guarded 写挂住于 S6，已提交值可读、槽未 settle）；
  3. hostile Proxy 工厂（L3）：`get`/`has`/`ownKeys` 计数并 throw 的输入对象——仅在 closing/closed 期传入（D5.1 门保证零访问，计数断言 `===0` 即接纳门次序证明）。
- **log 构造钉死（SA2 F2，本轮修订核心）**：凡构造诊断 log 的用例（K1/K5/K6、D1 装配侧、D2 装配侧、L3/L4，及任何断言 attempt 记录内容的用例）一律在用例调用点构造 `createBoundedMemoryDiagnosticLog({ inputPolicy: 'digest', updateCapture: true })` 并经 `setup({ log })` 注入（#347 E3/E5/E6 同款——L187/L242/L274 调用点构造，不在 helper 内）。**依据（已对源码复核）**：内存 adapter `const updateCapture = config.updateCapture ?? false`（`packages/namespace-diagnostic-log/src/adapters/memory.ts` L165）缺省为 false；false 时 committed 记录被 `physicalizeUpdate` 退化为 `{kind:'committed', effect:'update-omitted', reason:'update-capture-disabled'}`——**无 `update` 载体**（L217–221）。因此 K1⑤、K5④/⑥、K6 的 `effect:'update'` 与 `result.update.payloadLength === updates[0].length`（载体 `payloadLength` 字段，`record.ts` L74–87/L94）断言以 `updateCapture: true` 为**硬前提**；若 SA3 按缺省构造 log，这三处断言必红，并按 D3 纪律被误判为「回归/阻断性偏差」触发停工升级 + 冲突复查（伪回归升级陷阱）——本钉死条款消除该陷阱。`issuesPolicy` 缺省即 `'full'`（`memory.ts` L164），D1 的 `issues.policy==='full'` 断言不受该构造影响。
- **L4「release 恰一次」观察点（SA2 N1）**：SA6 §12.3 L4 冻结断言集①–⑥不含 release 计数；落地时择一：(a) 断言 seam 注入的真 handle `handle.isReleased === true`（close 排空后必真），teardown 中二次 `release()` 无害（幂等，`lifecycle.ts` L157–161）；或 (b) 需要精确计数时在 seam 注入前包裹 `handle.release` 计数（fake-handle 先例 `sequencer-slotkind-close-barrier.test.ts`）。设计不强制其一；不得为此新增断言面以外的机制。
- **导入说明符（SA2 N4）**：`./real-persistence-scheduler.js` 为导入说明符，磁盘文件为 `real-persistence-scheduler.ts`（#347 L28 同款导入，bundler 解析成立）——实现者不要因找不到 `.js` 文件而改动该 helper 或另建文件。
- **组织**：`describe('issue #349 K 组 — 写序列器竞争与 FIFO 独占')`（K1–K6）、`describe('issue #349 L 组 — lifecycle 接纳门次序')`（L1–L4）、`describe('issue #349 N 组 — 非 fatal 与后续写能力')`（N1）、`describe('issue #349 D 组 — 诊断透传与 emitter 等价')`（D1–D2）、`describe('issue #349 NC 组 — 负控锚')`（NC1–NC4）；逐用例注释引用 SA6 契约用例 ID 与 ADR 行号（沿 #347 文件头注风格）。
- **断言口径**（SA6 §12.0 冻结，逐条沿用）：码载体 `issues[0].code === docRuntime.MUTATION_GUARD_MISMATCH === 'MUTATION_GUARD_MISMATCH'`、record 级 `code === undefined`、形状错误 issue 无码；零写入 = `Y.encodeStateAsUpdate(doc)` 逐字节不变 + `update` 事件 0 + notifier 0；`issue.path` 深等 guard 路径；acceptance 记录 `stage==='acceptance'`、`code==='RUNTIME_WRITE_DISABLED'`、`result.kind==='rejected'`、`input.capture==='not-accessed'`；committed 记录 `result.update.payloadLength === updates[0].length`；message 断言仅锚稳定码前缀（K 组）与 K3 含实际值文本 `"closed"`（格式细节属 SA6 §15 裁量，不收紧）。
- **确定性纪律**：并发场景 `Promise.all` 背靠背入队（结果由 FIFO 定序唯一决定）；等待仅 `expect.poll(schema.state==='ready')` 与诊断记录轮询（`waitAttempts`）；无 sleep 阈值断言、无 skip/only/todo/env override、无源码字符串断言、无软断言。
- **teardown**：`handle.release()` + `writer.dispose()`（#347 同款）；L4 close 后再 release 安全（`lifecycle.ts` L157–161 幂等）；L4 门 Promise 必须 `finally` 放行，避免挂死（§13 R2）。

### 关键时序论证（设计对「测试为何确定性」的机制依据）

- **竞争唯一性**：JS run-to-completion + sequencer promise 链（`sequencer.ts` L91–92 G1）——`Promise.all` 背靠背入队后，槽执行序 = 入队序，第二写 guard 评估必见第一写已提交值（前槽 S7 settle → 链尾放行 → 本槽开跑；同槽独占期无中间受控写），无墙钟竞态。
- **K4 样本必已 flush**：`enqueue` 内部 `settled.then(() => this.flushSamples())`（L150–153）先于调用方对同一 `settled` 的 await 恢复（微任务 FIFO 序）——`await Promise.all([...])` 返回后样本 sink 已收齐。
- **L4 门语义**：S6 `await notifyDirty()` 挂住 → 槽未 settle → close barrier（队尾）不执行 → `close()` Promise 未结算而 lifecycle 已同步 `closing`；closing 期新写走 D5.1 即时拒绝（不排队、零输入访问）；门放行 → S6 完成 → barrier 执行 release 恰一次 → close Promise 结算、lifecycle `closed`。

## 8. 接口、状态机和数据流

**接口/状态机变化：无。** 本票零生产改动（§7 D3）：`mutateData` 签名、`MutateDataResult` 联合、写槽 S1–S7、sequencer FIFO、诊断 record schema、lifecycle 状态机全部按现状消费（§2 锚点）。新测试文件是既有公共面/包内 seam 的**只读新消费方**（§10）。

**运行时数据流：无变化。** 依据：SA6 probe 实测 HEAD 全行为成立（§5 承接）；本票不新增运行时数据创建/写入/转换/存储/传输/投影路径。以下为测试所**观测**的既有流（验收锚点即断言位置）：

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| 受控写（单操作/批量 + guard） | `mutateData(envelope)`（K/L/N/D/NC 组） | S5 单 Yjs 事务（`mutation.ts` L141–147 transactGuarded） | S3 快照（runtime 侧）→ doc-runtime parse→guard 评估→prepare→事务（跨包边界：namespace-runtime → doc-runtime） | live Y.Doc + S6 notifyDirty → memory persistence store | `readData(path).value`（读取不进 sequencer） | `{ok:true}` 1 update + 1 notifier + 1 committed/transaction 记录；或 `{ok:false, issues:[{code, path}]}` 零写入 | 拒绝 = R9 validation/rejected 记录；fatal 通道不触发（guard 无 fatal 面） | K1/K2/K3/K5/K6、N1、NC1/NC2 |
| 诊断变更尝试记录 | 写槽各结局点 / 接纳门 | `diagValidation` / `emitAttempt`（acceptance） | `SlotDiag` → `emitSlot` → diagnosticEmitter（ADR 0011：emit 不改变业务结果） | `createBoundedMemoryDiagnosticLog({ inputPolicy:'digest', updateCapture:true })` 内存 records（构造选项钉死于 §7 D5——committed 记录 `update` 载体在场的前提，adapter 缺省 `updateCapture:false` 会退化为 `update-omitted`） | `log.records()` 过滤 `recordKind==='attempt'` | 装配：恰 1 条 rejected/validation（issue 携码、record 无码）或 acceptance（带码、not-accessed）；未装配：零记录、业务逐字等价 | emitter 缺席 = 槽体 diag no-op（行为等价） | D1/D2、K1⑤/K5⑥、L3 |
| FIFO 槽级记账 | sequencer `enqueue`（记账在场时） | `pushSample`（槽释放后续体 flush） | 包内 seam 出包（闭包转发，无公共面） | 测试内 `samples[]` 数组 | 样本过滤 `slotKind==='S'` | 窗口恰 3 样本、深度 [3,2,1]、序 = 入队序 | clock throw → 该槽折叠无样本（不外溢） | K4（NC6：窗口无杂槽） |
| close 排空 | `close()` 持有门时（L4） | close barrier（队尾）：release 恰一次 | closing 同步停接纳 → 已接纳槽排空 → barrier | handle release（幂等） | `getStatus().lifecycle` | 挂住窗口内已提交值可读；closing 新写 `RUNTIME_WRITE_DISABLED`；排空后 `p={ok:true}`、lifecycle `closed` | 门 finally 放行；teardown release 幂等 + dispose | L4（L1–L3 为静态门断言） |
| 测试 fixture 自身 | 文件级 setup/teardown | memory store（`createMemoryPersistence`） | 无跨进程/持久化边界（内存适配器） | Map<string, Uint8Array> | — | 每用例独立 runtime，无跨用例状态 | release + dispose（#347 同款） | 全组 |

## 9. 错误、恢复、并发和幂等

- **错误面**：全部被断言的失败都是**领域拒绝**（`ok:false`），非异常通道——guard 不满足（稳定码 + path + 零写入）、接纳门拒绝（`RUNTIME_WRITE_DISABLED` 前缀 message + path `[]`）、S3 分层拒绝（NC4，`MUTATION_INPUT_NOT_PLAIN_DATA` + stage=input-snapshot + record 顶层码）、形状错误（NC3，无码）。fatal 通道断言为**不触发**（N1：`status.fatal === null`）。
- **恢复/重试**：guard 拒绝可重试语义由 N1 证明（重读旧值重构造后 `{ok:true}`）；拒绝后 `rootWrite.enabled === true`、下一笔无 guard 写成功。
- **并发**：§7 D5 时序论证——run-to-completion + FIFO 链使全部竞争断言确定性成立；无 sleep、无墙钟依赖。
- **幂等**：`close()` 幂等（ADR 0008 L99）；`handle.release()` 幂等（`lifecycle.ts` L157）；L4 门释放恰一次（finally）。
- **资源所有权**：每用例独立 fixture（store/handle/writer/runtime），teardown 释放；不共享跨用例可变状态。

## 10. 调用方影响矩阵

**生产调用方：零影响**（零生产改动，无返回值/抛错/nullable/异步时序/取消/生命周期语义变化）。新测试文件作为**新增消费方**按下表消费既有面（全部只读，零适配层）：

| 消费面 | 当前处理（生产） | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| `NamespaceRuntime.mutateData / readData / getStatus / close` | 公共面，签名不变 | 新测试文件直接调用 | 无 | `runtime.ts` L474–533；`index.ts` 公共导出 |
| `@nomicore/doc-runtime` `MUTATION_GUARD_MISMATCH` 导出 | `src/index.ts` 导出（#347 兑现） | 断言 `issues[0].code` 与导出值同源相等 | 无 | SA8 relevant_decisions §8；#347 测试 L38 同款读法 |
| `createNamespaceRuntimeWithSeam`（包内 seam） | 生产工厂保留包内，测试 seam 注入 | K4 注入 `replicationObservability`；其余用例注入 handle/notifyDirty/diagnosticEmitter/clock | 无 | `runtime.ts` L343/L420–443；先例 `sequencer-slotkind-close-barrier.test.ts` |
| `createBoundedMemoryDiagnosticLog` | 诊断包公共测试面 | D1/K1/K5/L3/L4 收集 attempt 记录，构造一律 `({ inputPolicy:'digest', updateCapture:true })`（§7 D5 钉死；adapter 缺省 `updateCapture:false` 会使 committed 记录退化为 `update-omitted`——`memory.ts` L165/L217–221） | 无 | `namespace-diagnostic-log/src/index.ts`；#347 测试 L31–35/L187/L242/L274 同款 |
| `Y.encodeStateAsUpdate` / `doc.on('update')` | yjs API | 零写入判据 / update 计数 | 无 | #347 测试 L123/L156 同款 |
| `real-persistence-scheduler.js`（导入说明符） | 测试 helper | fixture 复用 | 无 | `test/real-persistence-scheduler.ts`（说明符/磁盘后缀差异见 §7 D5 N4 注记） |

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/namespace-runtime/test/issue-349-guard-e2e-competition.test.ts` | **新建**：K1–K6/L1–L4/N1/D1–D2/NC1–NC4 共 17 用例 + fixture 扩展（observability/gate/Proxy 工厂），断言逐条按 SA6 §12.2–12.6 冻结口径 | 本票唯一实现产物：把 SA6 冻结契约固化为可执行验收语料（§7 D1/D5；AC1–AC8） |
| `wiki/raw/task_issue-349_design.md` | 本设计产物（已写入） | SA1 设计义务 |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/namespace-runtime/src/**` | 透传/槽序/接纳门/诊断接线所在地 | SA8 RA#1 + brief：预期零改动；红灯走升级路径不改产线（§7 D3） |
| `packages/doc-runtime/src/**` | guard 核（parseGuard/evaluateGuard/稳定码） | #347 已落地并冻结；本票不改 doc-runtime 语义 |
| `packages/namespace-runtime/test/issue-347-guard-passthrough-red.test.ts` | #347 E1–E7 冻结锚（NC5） | SA6 §12.1/SA8 RA#3：逐字节不动、全绿保持 |
| `packages/namespace-runtime/test/runtime-mutate-root-sequencer.test.ts`、`runtime-close-lifecycle.test.ts`、`sequencer-slotkind-close-barrier.test.ts` | 既有 sequencer/lifecycle/槽观测绿锚 | 落位裁决 D1 选择新文件；扩展既有文件触碰冻结/既有锚且需回写契约 |
| `packages/namespace-diagnostic-log/**` | 诊断 record schema（指纹 `sha256:v1:dedad2ab…` 被 schema-freeze 钉死） | ADR 0014 + 包 AGENTS 冻结面；只断言不触碰 |
| `docs/adr/**`、`CONTEXT.md`、`docs/protocols/**` | 决策/词汇/wire 权威 | SA8：evolution-required 0；测试文件不是决策文档 |
| `vitest.config.ts`、`tsconfig*.json`（含 `packages/namespace-runtime/tsconfig.json` 与根 `tsconfig.typecheck.json`）、根/包 `package.json`、`pnpm-lock.yaml` | runner/编译/依赖 | vitest include 已覆盖新文件（H8）；其类型检查覆盖来自 vitest typecheck 程序（§2/§7 D4，F1 修正口径）——**不得以「补齐 namespace-runtime tsconfig 的 test include」为名改动任何 tsconfig**（SA2 §11 注意事项：既违反本 DENY 亦无必要）；零工具链改动 |
| `domains/**`、`apps/**`、其余 `packages/**` | 边界外（wire/复制/replaceSchema/META 零断言） | ADR 0025 L64–66 边界外（SA8 裁决 #7） |

## 12. 验收与验证映射

### AC → 用例 → 预期观察

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1 guard 透传（满足 ok / 不满足带码 + path） | #347 E2/E3；probe P-A | K1/K2/K3/K5/K6、N1、NC2 | 满足 `{ok:true}` 落盘；不满足 `ok:false` + `issues[0].code===MUTATION_GUARD_MISMATCH`（与 doc-runtime 导出同源）+ `issue.path` 深等 guard 路径 |
| AC2 拒绝零写入、值不变 | probe P-A/P-D | K2、K3、K5、L1/L2 | `Y.encodeStateAsUpdate` 逐字节不变、0 update、0 notifier、readData 值不变 |
| AC3 诊断 rejected / 未装配等价 | #347 E3/E5；probe P-B | D1、D2 | D1：恰 1 attempt `stage='validation'`、`result={kind:'rejected'}`、record 级无码、`issues.items[0].code`=稳定码、`policy='full'`；D2：`rWith===rWithout` JSON 深等、两侧零写入 |
| AC4 竞争与 FIFO 独占（TOCTOU 消除） | probe P-A/P-E | K1、K3、K4、K5 | K1：r1 ok / r2 带码拒绝、update 恰 1、终值=胜者；K3：[ok,ok,带码拒]、message 含实际值 `'closed'`、update 恰 2；K4：窗口恰 3 个 S 样本、`queueDepthAtStart=[3,2,1]`、序=入队序、`allSlotKinds=['S','S','S']` |
| AC5 非 fatal、能力保留 | probe P-A | N1 | `status.fatal===null`、`rootWrite.enabled===true`、后续无 guard 写 ok、重读重试 ok、无 unhandled rejection |
| AC6 接纳门次序不变 | probe P-C/P-F | L1、L2、L3、L4 | L1/L2：closing/closed 期 `RUNTIME_WRITE_DISABLED`、无 validation/transaction 记录；L3：Proxy 访问 0、`stage='acceptance'`、`input.capture='not-accessed'`；L4：已接纳写排空 ok、closing 新写拒、release 恰一次、终态 closed |
| AC7 批量 + guard 组合 | probe P-D | K5、K6 | K5：拒绝恰 1 issue、终态仅胜者批三项、update 恰 1、诊断 2 条（committed + rejected）；K6：成功侧 3 项落盘、update 恰 1、`payloadLength===updates[0].length`、notifier 恰 1 |
| AC8 落位 + 门槛 | SA6 §14 基线全绿 | 新文件收集于 `packages/*/test/**/*.test.ts`；§7 D4 双层门槛 | 聚焦 4 文件（新 + 3 既有）绿；namespace-runtime 全目录绿（vitest 收集口径：45 `.test.ts` + 5 `.test-d.ts` = 50 → 46+5 = **51** 文件）；根 `pnpm typecheck` exit 0（该门不含本包测试文件，覆盖来源见 §7 D4）；根 `pnpm test`（含 `--typecheck`，新文件类型检查在此门内）全绿 |
| 敏感度（TOCTOU 回归捕获） | SA6 §13 反向退化推理表 | K1 `updates===1`+终值=胜者；K3 三写序；K4 深度递降；K5 恰 1 issue；K1/K5 payloadLength 一致；L3 Proxy 零访问；N1 fatal null；D1/D2；NC1–NC4 | 任一退化方向（guard 移出槽/并行化/一律拒绝/一律放行/形状域坍缩/S3 分层变化）至少一条断言红 |

### 断言纪律（冻结，不得削弱）

无 skip/only/todo/env override；无源码字符串断言；无 sleep 阈值断言；#347 E1–E7 文件字节稳定；诊断 record schema 指纹不动；用例 ID 与断言口径以 SA6 §12.2–12.6 为冻结基准（本设计未削弱任何一条，仅复述）。**log 构造纪律（SA2 F2）**：凡构造诊断 log 的用例一律 `createBoundedMemoryDiagnosticLog({ inputPolicy: 'digest', updateCapture: true })`（§7 D5）；缺省 `updateCapture:false` 会使 committed 记录退化为 `update-omitted`（`memory.ts` L165/L217–221），属 fixture 误配而非回归——记录断言红时先核对该构造，再进入 D3 升级判定。

## 13. 风险、回滚和残余问题

| # | 风险/残余 | 评估与处置 |
|---|---|---|
| R1 | 实现阶段 K/L/N/D 断言红（回归或阻断性偏差） | 概率低（HEAD probe 全绿且 2 次结构一致）；一旦发生按 §7 D3 升级路径处置：停、不改产线、以 ADR 0025 裁定、回 SA1 + 触发冲突复查。**不在本票内静默修复**。SA2 F2 指出的「fixture 误配伪红」陷阱已由 §7 D5 log 构造钉死消除——缺省 `updateCapture:false` 不再可能以「记录断言红」的形态进入升级流程；记录断言红时先核对 log 构造（§12 断言纪律），确认构造符合钉死条款后才按本条处置 |
| R2 | L4 门 Promise 未释放 → 用例挂死至超时 | 设计要求门释放置于 `finally`（放行恰一次）；`await close()` 与 `await p` 显式结算；vitest 默认 testTimeout 兜底 |
| R3 | 诊断记录轮询 flake（emit 异步） | `waitAttempts` 用 `expect.poll`（interval 5ms/timeout 3s，#347 既有惯例）；probe 实测稳定；无 sleep 断言 |
| R4 | K4 窗口混入 P0/杂槽样本 | ready 后清空样本再入队三写（先例 `sequencer-slotkind-close-barrier.test.ts` 同款）；`allSlotKinds` 断言兜底（NC6） |
| R5 | 新文件被 typecheck 门遗漏 | **结论：在门内——机制如下（F1 修正后重述，iteration 0 版本对本机制的陈述有误）**。`packages/namespace-runtime/tsconfig.json` 仅含 `src/**`，根 `pnpm typecheck` 的该项目**不**覆盖本包测试文件；新测试文件的类型检查覆盖来自 `vitest.config.ts` `typecheck.enabled: true` + `typecheck.tsconfig: './tsconfig.typecheck.json'`（include 含 `packages/*/test/**/*.ts`）——聚焦运行、目录运行与根 `pnpm test`（`vitest run --typecheck`）均执行该程序检查（SA6 §4/§14 实测输出含 `Type Errors no errors`）；#347 同位置 `.test.ts` 已实证在门内。tsconfig / vitest 配置在 DENY LIST，无需亦不得改动（§11） |
| F1 | （follow-up，非本票）ADR 0025 开放问题 1–3：谓词词表、读改写组合子、跨实例执法 | 属词表演进，须独立决策；本票不触碰 |
| F2 | （follow-up）跨实例复制 × guard 约定级边界（0025 L65）零断言 | 设计非目标；如需证明面须另立票 |

回滚：单文件新增、零生产改动——回滚 = 删除该测试文件，无运行时影响、无数据迁移、无兼容性面。

## 14. 是否需要设计后 ADR 冲突复查

**false**。

依据：本票为纯验收证明面兑现——零生产改动（无公共 API、wire、schema、持久化、状态机、生命周期、失败语义的待实现变更）、零决策文档触碰（SA8 evolution-required 0）、冻结面只被断言不被触碰、无 override、落位接受 SA6 冻结默认路径（SA8 RA#4 无偏离）。与 SA8 conflict_report §10 同口径。

iteration 1 补充：本轮修订仅落实 SA2 F1/F2——F1 为验收门机制的**事实性文本更正**（不改任何门命令、不改门槛构成），F2 为 fixture 规格的**钉死补充**（不改任何用例与断言口径）；两者均不新增决策面、不触碰 ADR 冻结面、不改变文件范围（ALLOW/DENY 原样），与 SA2 评审 §14 判断一致，不触发设计后冲突复查。

唯一触发条件（不改变本值）：实现阶段出现红灯偏离零改动预设（§7 D3 升级路径被触发）——该偏离本身构成新被审对象，届时由设计后复审另行裁决。

---

### 评审修订映射（iteration 1 — `wiki/raw/task_issue-349_sa2_review.md`，SA2 verdict reject）

| Finding | 修订位置 | 处理结果 |
|---|---|---|
| **F1（MAJOR）**：typecheck 覆盖机制陈述与磁盘事实相反——iteration 0 版本 §2 锚点表末行与 §13 R5 声称 `packages/namespace-runtime/tsconfig.json` 含 `test/**`；实况为该文件仅 `include:["src/**/*.ts"]`，根 `pnpm typecheck`（14 个 tsc 项目）不覆盖本包测试；真实覆盖来自 `vitest.config.ts` `typecheck.enabled:true` + 根 `tsconfig.typecheck.json`（include 含 `packages/*/test/**/*.ts`） | §2 锚点表（原单行拆为三行：vitest include+typecheck 程序 / `tsconfig.typecheck.json` / namespace-runtime tsconfig 实况与「不含 test、不得改动」声明）；§7 D4 门槛机制口径四条注记；§11 DENY LIST tsconfig 行（禁止以补 include 为名改动）；§12 AC8 行（门槛观察重述）；§13 R5 全文重写；§5 末行（矛盾登记 + SA6 §14 同错登记供 Controller 对账） | **已落实**：两处原文（§2/R5）删除错误表述，全部改为真实机制并注明「根 `pnpm typecheck` 不含本包测试、覆盖来自 vitest typecheck 程序、tsconfig 在 DENY LIST 无需亦不得改动」；R5 结论（新文件在类型检查门内）以正确机制重述；未对 tsconfig/工具链做任何改动（纯文本修订，符合 SA2 §11 接受条件） |
| **F2（MAJOR）**：K1⑤/K5④/K6 的 committed 记录断言（`effect:'update'`、`result.update.payloadLength===updates[0].length`）依赖 fixture 选项 `updateCapture:true`；adapter 缺省 `updateCapture ?? false`（`memory.ts` L165），false 时 committed 记录退化为 `update-omitted`/`update-capture-disabled`、无 `update` 载体（L217–221）——缺省误配 = 伪回归升级陷阱；iteration 0 版本 §7 D5 只钉 helper 名单未钉 log 构造选项 | §7 D5 新增「log 构造钉死」条款（凡构造诊断 log 的用例一律 `createBoundedMemoryDiagnosticLog({ inputPolicy:'digest', updateCapture:true })`，#347 E3/E5/E6 调用点同款；含 `issuesPolicy` 缺省 `'full'` 不受影响的说明）；§8 数据流「诊断变更尝试记录」行；§10 调用方影响矩阵 `createBoundedMemoryDiagnosticLog` 行；§12 断言纪律新增 log 构造纪律（记录断言红先核对构造再进 D3 判定）；§13 R1 补伪红陷阱消除说明 | **已落实**：钉死条款进入 fixture 规格、数据流、调用方矩阵、断言纪律与风险表五处；K 组记录断言的可满足性不再依赖实现者自行发现 adapter 内部缺省值；SA2 §13 F2 验收条件逐项满足 |

非阻断观察（SA2 §14 N1–N5）处置：

| # | 观察 | 处置位置 | 结果 |
|---|---|---|---|
| N1 | L4「release 恰一次」未给观察点 | §7 D5「L4 release 观察点」条款 | 已注明两个可选观察面（`handle.isReleased` + 幂等二次 release，或包裹计数），不新增断言面以外机制 |
| N2 | 根 `pnpm test` 全仓基线未实测 | §7 D4「全仓基线留档」注记 | 已写入实现/验证阶段指引：先留档 HEAD 输出，无关既有红按基线事实登记 |
| N3 | 45 `.test.ts` 与 50 文件两种计数并存未说明口径 | §3 Step 2、§12 AC8 行 | 已注明口径：45 `.test.ts` + 5 `.test-d.ts` = 50 → 46+5 = 51 |
| N4 | `real-persistence-scheduler.js` 导入说明符 vs 磁盘 `.ts` | §7 D5「导入说明符」注记 | 已登记，防实现者误改 helper |
| N5 | §5「全部核实相符」强断言在 F1 锚点上不成立 | §5 末行改写 | 已软化并改为列明复核范围 + 登记 1 项已修正矛盾（含 SA6 §14 同错登记） |
