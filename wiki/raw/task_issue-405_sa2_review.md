# SA2 设计攻击评审 — Issue #405 `readData 面：maxBytes 交付总量收/拒闸（tracer）`

- 派发：`sa-a3db79dc-3822-495c-b33c-6da878dabb05`（role `mabf-sa2`，phase `design-review`，iteration 0）
- Worktree：`/home/wangjian/nomicore-fix-issue-405`（branch `mabf/issue-405`，HEAD `fc6c1d3a4d…` = ADR 0031 入仓提交）
- 评审方式：全新视角独立攻击。SA1 设计正文的每个源码事实锚点（§2 B1–B13）均由本评审**独立实读源码复核**，不采信设计的转述；关键机制（split 读次序 parity、类型传播、DENY 面结构保证）逐点重推演。

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| 任务简报 `wiki/raw/task_issue-405.md`（44 行，Comments 段空） | 已读；Issue 正文 AC 十条逐条核对 |
| SA1 设计 `wiki/raw/task_issue-405_design.md`（399 行，rev 含 DD-1–DD-9） | 已读，逐节攻击 |
| SA6 验收契约 `wiki/raw/task_issue-405_sa6_contract.md`（rev2，494 行） | 已读（§12.0–§12.8 验收权威） |
| SA8 冲突门禁 `wiki/raw/task_issue-405_design_conflict_report.md`（iteration 2，verdict `clear`，RA-D1–RA-D5） | 已读 |
| SA8 决议摘录 `wiki/raw/task_issue-405_relevant_decisions.md`（62 行） | 已读 |
| 母法 `docs/adr/0031-readdata-byte-budget.md`（81 行，全读） | 决策 1–6 + 修订节 + 备选 + 验收节逐条与设计引用对照 |
| 源码独立复核 | `runtime.ts`（L140–245 双重载/联合、L690–819 readData 组合体、L1000–1096 canonical/seam/echoReadPath）、`doc-runtime/src/read.ts`（L60–108 类型与联合、L118–179 G0/OPT/N0 定序、L300–389 T1 `validateReadOptions`）、`lease.ts`（L311–332 透传、L472–494 Equal 锁）、registry `types.ts`（L465–489/L727–749 按名别名与接口成员）、`read-schema-projection.ts`（L55–110 四参重载、L155–202 headLine/budgetSuffix）、`window-read.ts`（L242–310 五键键空间）、`index.ts`（导出面）、三个包 AGENTS、`tsconfig.base.json`、`vitest.config.ts` |
| 测试独立复核 | `runtime-readdata-shape-budget-red.test.ts`（F1/F3 HOSTILE_CASES L438–453、F6/F7 L518–535、F-x5/F-x6 L537–559）、`runtime-readdata-shape-budget-fixture.ts`（L194–249 状态化/交替/非 enumerable 构造）、`runtime-readdata-shape-budget.test-d.ts`（L30–104 含 B11 锁 L86–89）、`runtime-readdata-shape-budget-control.test.ts`、`registry-readdata-budget-passthrough.test.ts`、`runtime-acceptance-exports-audit.test.ts`（只钉值导出键集）、`readdata-docs-adr0016-{contract-fixture,sync-control}.test.ts`（SCOPE_DOCS 三文件 + 陈旧注记扫描语义） |
| 文档目标独立复核 | `.agents/skills/nomicore/typed-access.md` ~L125「only the two budget keys」原句在案；`cordis-plugin-hosting.md` ~L360 两键句在案；`external-project-vfsl-codegen.md` ~L288 readData 结果段在案；「归调用方字节闸」措辞在三文件 grep 全空（SA8 RA-D3 真空结论独立复现） |
| 环境事实 | `git status --short` 仅 `wiki/raw/**` + `artifacts/**` 未跟踪（B13 ✓）；`exactOptionalPropertyTypes: true`（B12 ✓）；vitest include 覆盖 `packages/*/test/**/*.{test.ts,test-d.ts}`（新契约文件零配置可发现 ✓） |

## 2. Verdict

**`approve`** —— 无 BLOCKER、无 MAJOR。设计可安全实施。

核心理由（均为本评审独立复核所得，非转述）：

1. **读次序 parity 数学成立**。F-x5/F-x6 夹具只对 `getOwnPropertyDescriptor` trap 计数（fixture L199–237 逐行核实）。split 替位 T1 成为 raw 第一读者、T1 改读 plain relay（零 trap）、canonical 仍为第二读者后：F-x5 路径 = split #1/#2 → canonical #3 抛 → re-split #4 抛 = **4**；F-x6 路径 = split #1/#2 → canonical #3 抛 → re-split #4/#5 过 → 出口② = **5**。与既有断言逐点相等，且 ownKeys trap 消耗次数两方案同为 3 次（即使夹具计数范围扩展也不漂移）。
2. **T1 单源权威通过忠实中继保持**。对 14 个 HOSTILE_CASES（F1 矩阵）逐个推演：非 plain 宿主（string/number/null/数组/Date/自定义原型）经 split 宿主门 raw 原样直传 → T1 单源 message；accessor `depth` 经 `defineProperty` 原样复制（getter 零执行）→ T1(relay) 拒；未知键/非法值原样复制 → T1(relay) 拒同码同文。F3 差分矩阵（readData ≡ readLogicalValueAtPath 接受集/码）在 split 机制下逐 case 保持。仓库级 grep 复核：**无任何既有测试钉死 options 失败 message 文本**（只断言 code/恰四键/非空/回显），split 前置拦截只改写诊断文本（非契约字段）。
3. **类型传播链闭合**。`NamespaceRuntimeReadDataOptions` 与 `NamespaceRuntimeReadDataBudgetResult` 已在 `index.ts` 按名导出（L65–66）——联合追加成员与 interface 三键化**零导出键集变化**；registry `types.ts` L476–478/L734–738 与 `lease.ts` L320–326 全部按名引用 → 自动跟随；`_readBudgetAlias` Equal 锁（L483–485）随联合扩展自动覆盖新分支；`_readOverloadOrder`/`ReturnType` 末签名锚不受影响（legacy 联合零泄漏与 B11 侧 `_legacyNoOptionsCode` 锁语义一致）。B11 两键 Equal 锁（test-d L86–89 实读在案）三键化后必然编译红 → 原位修订是 root typecheck 的结构性必要条件，设计主动披露并给出理由，正确。
4. **D7 头行由构造保证**。`projectReadDataSchema` 四参重载收 `ResolveSchemaBudgetOptions`（两键，实读 L71–76）；canonical 剥离 `maxBytes` 后 `options` 恒两键 → `headLine`/`budgetSuffix`（只认 depth/width，实读 L175–195）结构上看不到 `maxBytes`。
5. **递延期守卫零改动自然保持**。窗口面 options 键空间恰五键（`n/orderBy/depth/maxChildrenPerNode/where`，实读 window-read.ts L262–272）→ `maxBytes` 落未知键 → `WINDOW_OPTIONS_INVALID` 现行为即 D6 守卫。
6. **SA6 契约与 ADR 0031 逐条可满足**。度量等式是构造性的（`JSON.stringify` 定义性保证紧凑与键序）；R12 ≡ R0（`{maxBytes:358}` 与 `readData([])` 逐字节相同）经 canonical 产 `{}` → headLine 无预算段 → 与 S2a 输出全等的推演成立；G5 组级判据（接受锚 ∧ 拒绝锚同组）在设计 DD-6/§12 有明确落点。
7. **架构先例真实存在**（非凭空声称）：`canonicalWindowBudget`（window-read.ts L250–310）就是「组合层同纪律重读 helper」的既有同款；`seamReadOptionsInvalid`（runtime.ts L1088–1096，含 D1 豁免登记注释）就是「runtime 构造 READ_OPTIONS_INVALID 成员、形状由单源类型注解锁死」的既有先例；`readDisabled` 是 runtime 自持失败成员先例。

MINOR 发现 4 条（见 §14），均不阻断实施。

## 3. 需求覆盖

| Requirement（Issue #405） | Design section | Assessment |
|---|---|---|
| `maxBytes`（≥1 有限整数）触发交付总量收/拒 | §7 DD-2/DD-4、§8.1 S2b-5 | 覆盖；域判定 `Number.isSafeInteger(v) && v >= 1` 与 ADR 0031 决策 1 逐字一致（ADR L16 实读） |
| 总量 = 值通道 `utf8(JSON.stringify(value))` + schema 通道投影文本 UTF-8；`undefined`/`null` 计 0 | §7 DD-4 度量等式 | 覆盖；构造性等式与 ADR 决策 2（L21–25）一致；`JSON.stringify(undefined) === undefined` 的三目守卫正确 |
| ≤ 预算原样成功、逐字节相同 | DD-4 判定 + §12 G1/G2 | 覆盖；闸门透明（成功路径不触碰已组装四键） |
| > 预算零交付五键分支、`measuredBytes` 只报合计 | DD-4 失败分支构造 | 覆盖；恰五键、`echoReadPath` 新鲜回显 |
| 校验与度量住 namespace-runtime 组合层；doc-runtime/vfsl 零改动、下传两键 | §7 DD-1/DD-3、§11 DENY | 覆盖；relay/canonical 剥离保证下传恒两键 |
| registry lease 别名跟随透传 | §7 DD-5.3、§10 | 覆盖；registry 源码零改动 + 按名单源别名（本评审实读确认别名链全按名引用） |
| 契约词汇以 ADR 0031 与 CONTEXT.md「字节预算」词条为权威 | §1 目标、DD-6 | 覆盖；CONTEXT.md L53–55 词条实读，语义逐点一致（`_Avoid_` 全家在非目标显式排除） |
| AC①–AC⑩ | §12 映射表 G1–G12 | 逐条覆盖（G1/G2↔AC①②、G3↔AC③、G4+G6↔AC④、G5↔AC⑤、G6↔AC⑥、G7↔AC⑦、G8↔AC⑧、G9↔AC⑨、G12↔AC⑩）；无 AC 缺落点 |

## 4. Owner评论覆盖

| Comment ID | Updated at | Design section | Assessment |
|---|---|---|---|
| —（无） | — | 设计 §4 | 简报 Comments 段空、REST issue-comments `[]`（派发说明与 SA6 §2/SA8 §2 三方一致）；无评论来源 override/豁免/附加义务。设计 §4 的空表登记如实 |

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment（独立复核结果） |
|---|---|---|
| SA6 P1：HEAD 上 `maxBytes` ≡ 未知键（A1–A11 同码同文，值域判定从未发生） | §3 承接；DD-2 split 剥离 `maxBytes` 出 T1 视野 | 成立；doc-runtime `validateReadOptions` L339–342 键空间白名单两键实读在案 |
| SA6 P2：类型面 TS2353×4/TS2322/TS2367/TS2339 | DD-5 三键 interface + 联合追加 | 成立；`NamespaceRuntimeReadDataOptions = ReadLogicalValueAtPathOptions` 单源别名（runtime.ts L153–154）实读在案 |
| SA6 P4/RA-1：D2 域收口 1..2^53−1，`2^53` 拒、组级判据 | DD-2/DD-6 D2 非自由位 | 成立；ADR 0031 L16 域句逐字核对，设计未重开 |
| SA6 §12.0 冻结 fixture + 锚 R0–R12 + total/total−1 成对 | §11 ALLOW fixture 文件 + §12 G1/G2/G4 | 承接；夹具纪律（期望不得自证）与 R11 边界成对在设计验收映射中保留 |
| 既有 F-x5=4 / F-x6=5 descriptor 读计数（B7） | DD-2 强制镜像 T1 读形态 + §8.2 路线 3 逐跳推演 + R-1 任务内必要条件 | **本评审独立重算成立**（见 §2 理由 1）；夹具只计 gOPD trap、ownKeys 不计，即使计数范围扩展 ownKeys 消耗也同为 3 次不漂移 |
| B8 定序锚：F6（G0 优先）/F7（lifecycle 优先） | §8.1 S2b-0 G0 前置分支 + S1 不变 | 成立；`readLogicalValueAtPath` 2 参直调命中同一 G0 单源拒绝（doc-runtime L133–138 实读），非数组 path + options 双非法 → `PATH_NOT_ALLOWED`、零 options 读取 |
| B9 lease raw 直传 + Equal 锁 | DD-5.3 registry 源码零改动 | 成立；lease.ts L328–331、types.ts L476–478/L734–738 实读全按名引用 |
| B11 两键 Equal 锁原位修订（SA6 §12.2 未列） | DD-5.4 主动披露 + ALLOW 补充 + SA8 复核触发 | 成立；test-d L86–89 及其相邻注释实读在案；SA8 RA-D2 已附「同变更集 + 相邻注释同步」条件，设计 §11 行内已含 |
| SA8 RA-7/RA-D3：OBL-DOC-1 两形态、义务关闭前不得宣告完成 | DD-9 Phase A 零 diff + Phase B 实名清单 | 成立；三文件目标句全部实读在案；「归调用方字节闸」清退子项确为真空（grep exit 1 独立复现）——Phase B 清单不含该项与真空事实自洽 |
| SA8 RA-4/RA-D5：OBL-WIN-1 窗口面独立票、message 镜像 | DD-6 D6 本票不动 + DD-7 文案冻结为镜像基准 | 成立；窗口面五键键空间实读（window-read.ts L262–272），`maxBytes` 落未知键 → 现行 `WINDOW_OPTIONS_INVALID` 自然保持 |
| SA8 RA-D1：split parity 为实现验收必要条件 | §13 R-1 + 「任务内必要条件」段 | 成立；未被伪装成 follow-up |
| SA8 RA-8/RA-D4：实现后复审 | 设计 §15 自报 `requiresConflictRecheck = true` | 与 SA8 门禁 §10 一致；本评审未发现需新增的 ADR 冲突面 |

## 6. 设计内部一致性

| 检查点 | 结论 |
|---|---|
| §8.1 伪代码 ↔ DD-2/DD-3/DD-8 阶梯 ↔ §8.2 六条数据流路线 | 一致：S1 → S2a → S2b-0(G0) → split → T1(relay) → canonical → 投影 → 闸门 → 四键组装的次序在四处表述相同 |
| DD-4 闸门消费 canonical.maxBytes ↔ DD-3 canonical 产物扩为 `{options, maxBytes}` ↔ §8.1 S2b-5 | 一致；「与投影通道消费 canonical.options 同源」的单源声明与伪代码相符 |
| DD-5.4/§11 ↔ SA6 §12.2 文件清单 | 一致（B11 为已披露的必要补充，SA8 复核在案） |
| §13 R-1 ↔ §12 G7 计数断言 | 一致（parity 是验收不是既成事实，诚实） |
| 非目标 ↔ DENY LIST ↔ OBL 挂账 | 一致；窗口面/裁剪/性能阈值/新校验码全部显式排除且各有守卫 |
| **DD-5.1 括注 ↔ DD-3** | **一处措辞矛盾**：DD-3 说 canonical 签名放宽为三键 `NamespaceRuntimeReadDataOptions`（正确——canonical 必须读到 `maxBytes` 才能剥离与回传），DD-5.1 括注却说「relay/canonical 参数类型仍用 doc-runtime 两键类型」。误按 DD-5.1 实现会在「canonical 读 `maxBytes` 键」处编译红（fail loud，不可静默走偏），且 §8.1 伪代码（`canonicalReadOptions(options)` 收三参分支 raw）已把意图钉死——降为 MINOR（见 §14 MINOR-1），建议实现迭代顺手修正 DD-5.1 括注为「relay 用 doc-runtime 两键类型；canonical 放宽为三键」 |
| DD-7 文案 ↔ 契约 G5 断言（只断言域可区分） | 一致；文案为建议值非契约钉死项 |

## 7. 状态机与并发攻击

`readData` 为同步纯函数（不进 sequencer、零缓存、零订阅、零状态写入——runtime AGENTS「Reads stay outside that sequencer」+ ADR 0008；设计 §9 与此一致），无新增状态机。攻击集中在**读次序、重复事件与敌意漂移**：

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| X1 | ready；path 非数组 + 非法 options | `readData('x', {depth:-1, maxBytes:0})` | `PATH_NOT_ALLOWED`（G0 优先，零 options 读取——F6 锚） | 无：S2b-0 前置分支 2 参直调命中 doc-runtime G0 单源拒绝（L133–138 实读） | 无 |
| X2 | closing/closed + 敌意 Proxy options | `readData([], Proxy{maxBytes})` | `RUNTIME_READ_DISABLED`、trap 0 次 | 无：S1 lifecycle gate 在组合之前（runtime L724–727 实读），split 在其后 | 无 |
| X3 | ready；状态化 descriptor trap（F-x5 型） | 首读过后第 3 次 gOPD 起 | `READ_OPTIONS_INVALID` 恰四键、计数 4 | 无：split #1/#2 → T1(relay) 零 trap → canonical #3 抛 → re-split #4 抛（本评审独立重算） | 无 |
| X4 | ready；交替 trap（F-x6 型） | 仅第 3 次 gOPD 抛 | `READ_OPTIONS_INVALID`（出口② seam 成员）、计数 5 | 无：re-split #4/#5 过 → re-T1(relay₂) 过 → 出口② | 无 |
| X5 | ready；敌意对象在 split 与 canonical 两读间 `maxBytes` 域内漂移（100→50）或键消失 | 两次合法读 | 判据判定（canonical 后读为闸门权威）——HEAD 对 depth 的同款既有纪律 | 行为正确且与 HEAD 同族；R-2 只枚举了「域内值漂移」，未显式点名「键消失 → 预算静默脱落」子例（HEAD 的 depth 消失同样静默脱落预算，非本设计新造） | 无（行为不改）；措辞补全见 MINOR-3 |
| X6 | 同一敌意对象重复调用（trap 已进入永久抛态） | 第二次 `readData` 同参 | 确定性 `READ_OPTIONS_INVALID`（split 首读即抛并收编） | 无；无 flake 源（SA6 §7 确定性前提 + 设计 §9） | 无 |
| X7 | released lease + 预算调用 | `lease.readData(path, {maxBytes:1})` | `NAMESPACE_LEASE_RELEASED` 三键先行 | 无：released 短路在透传之前（lease.ts L328 实读），registry 零改动 | 无 |
| X8 | 非枚举 `maxBytes` / 继承键宿主 | `Object.defineProperty` 隐藏键 / `Object.create` | ≡ 无预算 / 宿主拒绝 | 无：split 用 `Object.keys` + 宿主门 raw 直传，与 T1 键空间双盲（N3/N4 保持） | 无 |

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| E1 | 值通道导航/载体失败 + 合法 `maxBytes` | T1(relay) 失败原样透传 `PATH_NOT_ALLOWED`，闸门不参与（T8：值通道失败优先于预算判定） | 无——闸门在全部成功通道之后 | 无 |
| E2 | 非法 `maxBytes`（0/负/非整数/非有限/`2^53`） | split 前置拒绝 `READ_OPTIONS_INVALID`（恰四键、runtime 构造 message，域可区分），先于 doc 触碰 | 无——与 HEAD「非法 options 在 N0 前短路」（V2）同位；G5/G10 锚定 | 无 |
| E3 | options 视图不稳定（敌意 descriptor/Proxy 漂移或抛） | canonical 失败 → 出口① re-split/re-T1 失败即返 / 出口② seam 终态；绝不外抛 | 无——出口①/②语义三键面原样延伸，`budgetAxisInvalid` 形状由 `ReadLogicalValueBudgetFailure` 单源类型注解锁死（沿 seam 豁免先例，先例实读在案） | 无 |
| E4 | 预算超限 | 零交付五键分支；无部分交付、无回滚需求（无资源获取） | 无 | 无 |
| E5 | 值含 non-finite / lone surrogate | `JSON.stringify` 规范行为（`'null'`/well-formed 转义）计入度量 | 无——ADR 决策 2「整体序列化即度量」的定义部分；R-3 已登记 | 无 |
| E6 | 极深嵌套值使 `JSON.stringify` 栈溢出 | 设计未显式讨论 | 极低：值通道本身由 doc-runtime 递归物化产出（同阶递归深度先在导航期暴露），非本设计新造的独立失败面 | 无（登记为观察即可，见 §14 末注） |
| E7 | 投影可信域畸形 | `InternalError` throw 逃逸（唯一逃逸通道，不变） | 无——闸门在投影之后，不改变逃逸面 | 无 |
| E8 | split/canonical 探测期 trap 异常 | 各自 try 收编为 `READ_OPTIONS_INVALID` | 无——与 T1 V3 策略 A 同款；仓库级复核无既有测试钉死该 message 文本 | 无 |

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| `readData` 预算重载（options 三键 + 联合追加五键分支） | 无。破坏性 minor 已由 ADR 0031 验收节明示授权（L77），消费方可枚举 | §10 矩阵 + ADR L77 | 无 |
| `lease.readData` 双重载消费方 | 无。registry 全按名单源别名（types.ts L476–478/L734–738、lease.ts L320–326 实读），`_readBudgetAlias` 自动覆盖新分支、`_readOverloadOrder` 延续 | B9 实读 | 无 |
| 单参 legacy 消费方（`apps/yjs-server` 等） | 无。legacy 联合零变化；`ReturnType` 末签名锚延续；yjs-server 无 options 调用点（grep 复核） | §10；`_legacyReturnType` 锁（test-d L82–84 实读） | 无 |
| 窗口面 `readArray`/`readMap` 消费方 | 无。五键键空间不含 `maxBytes` → 现行 `WINDOW_OPTIONS_INVALID`（window-read.ts L262–272 实读），零改动即 D6 递延期守卫 | §10/D6 | 无 |
| doc-runtime 直调消费方 | 无。两键闭合形状 + T1 冻结（`ReadLogicalValueAtPathOptions` L74–77 实读），G11/N11 负控锚 | §11 DENY | 无 |
| 携 `maxBytes` 的新消费方 | 采用指引已排 Phase B（DD-9 实名清单 + 决策 6 分工指引） | OBL-DOC-1 | 无（义务关闭前不得宣告完成，RA-D3 监督） |
| 公共导出面 | 无。`NamespaceRuntimeReadDataOptions`/`…BudgetResult` 已按名导出（index.ts L65–66 实读），联合扩成员零导出键集变化；值导出审计只钉 `['RuntimeWriteFatalError']`（audit 测试 L29 实读） | DD-5.2 | 无 |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| `maxBytes` 校验与度量 | 唯一同时见值/schema 两通道的组合层（ADR 0031 决策 4） | runtime.ts `readData` 组合体 + 包内 helper | 正确；无应用层复制状态机 |
| 两轴域/未知键/宿主校验 | doc-runtime T1 单一权威 | DD-2 忠实中继（relay 原样保留未知键/accessor/非法值） | 正确；message 单源不漂移 |
| 净化（canonical） | runtime 接缝（#336 先例） | DD-3 扩展三键白名单 + 剥离 | 正确 |
| 预算值权威 | canonical 后读（组合层单源） | DD-4 闸门消费 canonical.maxBytes | 正确；与投影消费 canonical.options 同源 |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| 组合层同纪律重读 helper | `canonicalWindowBudget`（window-read.ts L250–310：`Object.keys` + 逐键 gOPD + try 收编 + 五键键空间镜像） | `splitReadDataOptions`（逐字镜像 T1 读纪律） | 一致 | 同款「判据镜像、非第二权威」模式 |
| runtime 构造 options 失败成员 | `seamReadOptionsInvalid`（runtime.ts L1088–1096，D1 豁免登记 + `ReadLogicalValueBudgetFailure` 注解锁形） | `budgetAxisInvalid`（DD-7） | 一致 | `maxBytes` 域违约在 T1 两键视野内结构性不可观测，T1 无法作该分支的拒绝权威——豁免逻辑成立 |
| runtime 自持失败成员 | `RuntimeReadDisabledResult`（readDisabled） | `ReadDataBudgetExceededResult`（DD-5.2） | 一致 | 同款先例；均不新增公共导出名 |
| 接缝出口①/② | #336 A-2b/A-2c | DD-3 延伸（re-split + re-T1） | 一致 | 出口语义不变，仅替换重派发载体 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 两轴预算值（投影用） | canonical 后读 | 无镜像 | 低（HEAD 同款） |
| `maxBytes` 预算值（闸门用） | canonical 后读 | split 前置域判定只服务定序、不供闸门消费 | 低——split/canonical 双处同判据是 T1+canonical 既有「判据判定」模式的延伸，非第二权威 |
| T1 失败 message | doc-runtime 单源 | relay/raw 直传保证透传 | 低 |
| 域外值演进门 | ADR 0031 决策 1 域句 | 设计 DD-6 明记「再引入须 ADR 修订计划 + SA8 复核」 | 低 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| 无新资源（同步纯读；relay/canonical/失败分支均为组合层新鲜对象，不逃逸不缓存） | 无需释放 | 同参重读确定性重放 | 对称；`echoReadPath` 新鲜回显隔离实参事后变异 |

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 第二套 options 校验通道 | T1 + canonical | split | **非平行机制**：split 不判两轴/未知键/宿主（忠实中继给 T1），仅消费 T1 结构上看不到的 `maxBytes` 域；与 `canonicalWindowBudget` 同族 |
| 消费侧字节闸（`capJson`/`preview`） | ADR 0031 已裁决收回引擎 | 引擎内五键分支 | 本票即兑现，无残留平行通道 |
| 新校验码 | `READ_OPTIONS_INVALID` 既有词表 | 复用（唯一新码 `READ_BUDGET_EXCEEDED` 为 ADR 决策 1/3 明文） | 一致 |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| Phase A ALLOW（runtime.ts + index.ts 仅注释 + 6 个新契约文件 + 2 个原位修订）覆盖设计正文全部生产/测试落点 | §7 DD-1–DD-5 与 §11 逐行对照 | 无缺漏 |
| `runtime-readdata-shape-budget.test-d.ts` 原位修订（SA6 §12.2 未列） | B11 实读在案；三键化后必然编译红；SA8 iteration 2 已裁「锁期望跟随已登记的 ADR 修订链」并附 RA-D2 同变更集条件 | 无（披露 + 理由 + 复核均正道） |
| DENY 面与正文零冲突：doc-runtime/vfsl/渲染器/窗口面/registry src/CONTEXT/ADR/配置 | 各 DENY 行与 DD-1/DD-3/DD-5.3/DD-6/D7 逐条对得上；`projectReadDataSchema` 四参两键类型使 D7 成为构造性保证 | 无 |
| Phase B 三文件实名 = SA6 §3.3 `SCOPE_DOCS`（fixture L54–58 实读） | 三文件目标句全部实读在案 | 无 |
| ALLOW 无无理由扩张；follow-up（OBL-WIN-1/载荷拆分/裁剪模式）不掩盖任务内必要项（R-1 parity、B11 修订） | §13「任务内必要条件」段显式划界 | 无 |
| 注：registry `types.ts` L472–475 相邻 JSDoc 对预算联合成员的枚举在三键化后少列 `READ_BUDGET_EXCEEDED`——但该注释**今天**已少列 `RUNTIME_READ_DISABLED`（本为部分枚举风格），且 registry src 属 DENY | 实读对照 | 无（MINOR-4 记录，见 §14） |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC①②（≤/恰好等于成功、逐字节一致） | G1/G2：§12.0 锚 total 收 / total−1 拒成对；`toStrictEqual` 四键全等 | 无——R12≡R0 等价（`{maxBytes:358}` ≡ `readData([])`）经 canonical `{}` → 无预算段头行推演成立 | 无 |
| AC③（五键零交付） | G3：own 键集恰五键、合计 ≠ 单通道、path 新鲜回显 + 实参变异隔离 | 无 | 无 |
| AC④（度量等式 property） | G4：9+2 锚 × 成对判定，oracle = 同参无预算读独立两通道测量 | 无——等式构造性；oracle 对 `value === undefined` 锚走 R7 单通道断言（`measuredBytes === utf8(o.schema)`）规避 `JSON.stringify(undefined)` 书写细节 | 无 |
| AC⑤（负控 + 域区分 + C-LIMIT） | G5 组级判据（`2^53`/`2^53+2` 拒绝锚 ∧ `1`/`2^53−1` 接受锚同组） | 无——反伪绿关键设计（SA6 §12.5 R2）在设计 §12 显式承接 | 无 |
| AC⑥（缺席目标 × 超限） | G6：`['nick']` 26 拒 / 27 收 | 无 | 无 |
| AC⑦（无 options/两键回归） | G7 + 既有 shape-budget/projection 套件 + F-x5=4/F-x6=5 计数 | 无——计数断言既有测试已携带（L545/L557 实读），G7 引用即可 | 无 |
| AC⑧（恒四键 + ✂/头行零漂移） | G8：`{depth:1,maxBytes:415}.schema === {depth:1}.schema`；头行无 `maxBytes` | 无——D7 结构保证 + 字节比较双锚 | 无 |
| AC⑨（lease 跟随 + 别名锁） | G9 行为 + 类型（`_readBudgetAlias` 延续、options 跟随、`Extract` 五键、doc-runtime 两键硬锁） | 无 | 无 |
| AC⑩（门禁） | G12：包内 tsc×2 + vitest（含 --typecheck）+ root typecheck/test + git diff 证 DENY 零 diff | 无——vitest include 实读覆盖新路径，零配置可发现 | 无 |
| 敌意/定序（设计派生） | G10：lifecycle > 校验 > 预算；Proxy trap 0 次；accessor getter 0 次；非枚举 ≡ 无预算 | 无——§8.1 阶梯逐行可观察 | 无 |
| 范围守卫 | G11：窗口面/doc-runtime 面携 `maxBytes` 各走其码 | 无——窗口面五键键空间实读佐证 | 无 |
| 测试落点真实性 | §12.2 路径与 `vitest.config.ts` L15/L20 include 模式匹配（实读）；`.test-d.ts` 走 typecheck 引擎 | 无 | 无 |
| Phase A 不误伤既有 doc-sync 测试 | `readdata-docs-adr0016-sync-control` 只扫退役词汇/opt-in 用法/陈旧注记，**不检测「only the two budget keys」失真**（fixture 扫描器实读）——Phase A 零 doc diff 下该套件保持绿，失真由 OBL-DOC-1 流程义务兜住 | 无缺口（SA6 §3.3/RA-D3 已把「义务关闭前不得宣告完成」钉死）；提示 Phase B 重写时须保持该套件绿（G12 root test 覆盖） | 无 |

## 13. Required revisions

无 BLOCKER、无 MAJOR——空表。设计可直接进入实现迭代；SA8 RA-D1（split parity 验收）/RA-D2（B11 同变更集）/RA-D3（OBL-DOC-1 兑现）/RA-D4（实现后复审）为实现期既有约束，无需本评审追加。

## 14. Non-blocking observations

| # | 观察 | 建议 | 严重度 |
|---|---|---|---|
| MINOR-1 | DD-5.1 括注「relay/canonical 参数类型仍用 doc-runtime 两键类型」与 DD-3「canonical 签名放宽为三键」矛盾（DD-3 正确：canonical 必须读到 `maxBytes` 才能剥离/回传；误按括注实现会在读键处编译红，fail loud 不可静默走偏；§8.1 伪代码已钉死正确意图） | 实现迭代顺手把 DD-5.1 括注修为「relay 用两键类型；canonical 放宽为三键」，消除双读者歧义 | MINOR（文档精度） |
| MINOR-2 | `Buffer.byteLength` 将成为 `packages/namespace-runtime/src` **首个** Node 全局依赖（现状 src 零 `node:` import、零 Node 全局；仓内亦无 string→UTF-8 长度的既有惯例——diagnostic-log 只对二进制 buffer 计长）。部署面 Node-only、`@types/node` devDep 在位，正确性无虞 | 可考虑 `new TextEncoder().encode(s).length`（环境中性、同为精确 UTF-8 长度）；采纳与否不阻断 | MINOR（惯例/可移植性） |
| MINOR-3 | R-2 残余只枚举「域内值漂移」，未显式点名「`maxBytes` 键在 split 与 canonical 两读之间消失 → 闸门静默关闭（预算脱落）」子例。该行为与 HEAD 对 depth 键消失的既有处置**逐字同款**（canonical 判据判定、不比对键集），非本设计新造 | 在 R-2 措辞中把「键消失/键集漂移 → 预算脱落」并入同一接受残余的枚举，保持残余清单诚实完整；行为不改 | MINOR（文档诚实度） |
| MINOR-4 | registry `types.ts` L472–475 相邻 JSDoc 对预算联合做部分成员枚举，三键化后少列 `READ_BUDGET_EXCEEDED`；但该注释今天已少列 `RUNTIME_READ_DISABLED`（本就是举例式而非穷举式），且 registry src 属 DENY（别名经 Equal 锁强制，注释非契约载体） | 记录在案即可；若实现迭代希望极致整洁，可经设计补充说明后在 Phase B 之外单列注释级触碰——不强求 | MINOR（注释整洁） |
| 附注 | 极深嵌套值的 `JSON.stringify` 栈溢出理论面：值通道由 doc-runtime 递归物化产出（同阶递归先在导航期暴露），非本设计新造独立失败面；ADR 决策 2 已把序列化定为规范度量 | 无需动作 | 观察 |

---

**收尾声明**：本评审只审查设计声明与既有证据，未运行测试/服务、未修改设计/业务代码/测试。`approve` 仅表示设计通过审查，不能替代 SA4/SA7 对实现与活链路的验证；实现期须满足 SA8 RA-D1–RA-D4（parity 验收、B11 同变更集、OBL-DOC-1 兑现、实现后复审）。
