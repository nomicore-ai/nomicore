# SA8 冲突门禁报告 — Issue #405 SA1 实施架构设计（设计后复审）

- 派发：`sa-21527fd3-988c-4fb5-bcfc-0dee886f03df`（role `mabf-sa8`，phase `conflict-gate`，iteration 2）
- Worktree：`/home/wangjian/nomicore-fix-issue-405`（branch `mabf/issue-405`，HEAD `fc6c1d3a4d…` = ADR 0031 入仓提交，与决策集快照一致）
- 本报告为**原位更新**：前两次门禁（iteration 0 前置门禁审 SA6 契约 rev1 → `reject`；iteration 1 设计复查审 SA6 契约 rev2 → `clear`，RA-1/2/3 闭合）的结论已折入处置核对，不堆叠为当前裁决。本次被审对象 = **SA1 设计本体** `wiki/raw/task_issue-405_design.md`（399 行，派发 `sa-f601b28b-e8e6-478c-aa45-0e101f1a43a1`，iteration 0）——SA6 契约 rev2 在案为验收权威，SA2 review 不存在（设计 §14 如实登记，本次 `ls` 复核确认）。

## 1. Reviewed subject

**design** —— `wiki/raw/task_issue-405_design.md`。复审重点按派发指定：**① readData 公共 API 扩张**（options 三键闭合形状 + 预算联合追加 `READ_BUDGET_EXCEEDED` 五键分支，§7 DD-5）；**② options 拆分读/中继语义**（`splitReadDataOptions` 忠实中继 + T1 单源权威保持，§7 DD-2/DD-3/DD-8）；**③ 类型联合传播**（registry 别名单源跟随、legacy 联合零泄漏、公共导出面零扰动，§7 DD-5）；**④ 文档义务处理**（OBL-DOC-1 两形态落地路径，§7 DD-9/§11 Phase B）；**⑤ 测试锁修正**（既有两键 `Equal` 锁的原位三键化，§2 B11/§7 DD-5.4）。对照基准 = ADR 0031（母法）与适用规范契约。本报告不评价设计优劣、断言充分性或实现可行性（SA2/下游维度）。

## 2. Inputs and decision set

- 输入：`wiki/raw/task_issue-405.md`（Comments 段空）、`wiki/raw/task_issue-405_design.md`、`wiki/raw/task_issue-405_sa6_contract.md` rev2（494 行，验收权威——wiki/raw 属证据非规范契约，但其 pins 编码 ADR 派生义务，设计对齐性纳入核对）、`wiki/raw/task_issue-405_relevant_decisions.md`、`CONTEXT.md`、`docs/adr/**` 全集（31 篇全部「已接受」，无整篇 superseded；0024/0027 对 0031 的再修订链在各自状态行登记——本次实读复核在案）、`packages/{namespace-runtime,namespace-registry,doc-runtime}/AGENTS.md`、`docs/AGENTS.md`。Owner 评论：无（简报 Comments 空 + REST `[]`，派发说明一致）——无 override 来源。
- 决议摘录 `task_issue-405_relevant_decisions.md`：决策集与 HEAD 未变（同 `fc6c1d3`），本次逐条对照 ADR 原文复核**仍然准确**，无需更新。
- 事实核验（本次实读源码/测试/文档，非冲突基准，用于锚定设计 §2 B1–B13 与冻结面判断；逐点结果）：
  - B1/B2/B3 ✓：`runtime.ts` L153–154（`NamespaceRuntimeReadDataOptions = ReadLogicalValueAtPathOptions` 单源别名 + 注释「doc-runtime 单源类型别名（零复制）」）、L185–188（预算联合，失败面无 `READ_BUDGET_EXCEEDED`）、L239–245（双重载，预算在前 legacy 在后）。
  - B4 ✓：三参分支 `readLogicalValueAtPath(doc, path, options)` raw 直传；doc-runtime `read.ts` L133–150（G0 → OPT → N0 定序，V2 非法 options 在 N0 前短路）。
  - B5/B6 ✓：`canonicalReadOptions`（runtime.ts ~L1041–1067）与 T1 `validateReadOptions`（doc-runtime read.ts L326–361）读纪律逐字同构（宿主 plain 判定 → `Object.keys` 键空间 → 逐键 `getOwnPropertyDescriptor` data-property、accessor 拒、present-undefined ≡ 缺席、整体 try 收编）。
  - B7 ✓：`runtime-readdata-shape-budget-red.test.ts` L537–559 在案——F-x5 期望 `descriptorCalls() === 4`、F-x6 `=== 5`，两处**只**断言 code/恰四键/message 非空/path 回显，message 文本未钉死。本次另核实：**无任何既有测试钉 `getPrototypeOf` 触达次数**（split 宿主门的额外一次原型探测不构成计数漂移面）。
  - B8 ✓：F6（`PATH_NOT_ALLOWED` 先于 options 校验）/F7（lifecycle 先于一切 options 触达）在案 L518–535。
  - B9 ✓：`lease.ts` L311–332（released 短路优先、raw 引用直传）+ L472–489（`_readAlias`/`_readBudgetAlias`/`_readOverloadOrder` Equal 锁）；`types.ts` L465–478/L732–738 按名引用。
  - B10 ✓：`read-schema-projection.ts` 头行 `budgetSuffix` 只认 depth/width 两轴；`projectReadDataSchema` 四参重载收 `ResolveSchemaBudgetOptions`（两键）——canonical 剥离即头行结构上不可能记 `maxBytes`（D7 由构造保证，成立）。
  - B11 ✓：`runtime-readdata-shape-budget.test-d.ts` L86–89 `_optionsAlias` 两键 `Equal` 锁在案（注释「预算 options 为 doc-runtime 单源类型别名（零复制）」）——三键化后必然编译红，设计的原位修订判断属实。
  - B12 ✓：`tsconfig.base.json` L10 `exactOptionalPropertyTypes: true`。
  - B13 ✓：`git status` 仅 `wiki/raw/**` + `artifacts/**` 未跟踪，生产面零 diff。
  - 文档义务对象 ✓：`.agents/skills/nomicore/typed-access.md` Shape-budget reads 段「the closed options shape accepts **only the two budget keys**」原句在案（~L125）；`SCOPE_DOCS` 三文件实名（fixture L54–58）在案；`cordis-plugin-hosting.md` ~L360「封闭形状 { depth?, maxChildrenPerNode? }」两键句在案。**另核实**：三份 SCOPE_DOCS 中「归调用方字节闸」措辞**现无文本对应**（grep 全空）——OBL-DOC-1 的清退子项当前为真空，见 RA-D3。
  - 公共面 ✓：`index.ts` 值导出审计（`runtime-acceptance-exports-audit.test.ts`）只钉**值导出键集** `['RuntimeWriteFatalError']`，不钉类型联合形状——DD-5.2「导出键集零扰动、guard 零改动」成立。
  - 接缝先例 ✓：`seamReadOptionsInvalid`（runtime.ts ~L1088–1095）= runtime 构造失败成员的 D1 豁免登记先例（形状由 `ReadLogicalValueBudgetFailure` 单源类型注解锁死）——DD-7 的 `budgetAxisInvalid` 沿用该先例，豁免逻辑成立（maxBytes 域违约在 T1 的两键视野内结构性不可观测，T1 无法作为该分支的拒绝权威）。
- 冲突基准：**ADR 0031 + ADR 0027/0024（修订链后）+ ADR 0028/0029 + ADR 0008 + ADR 0023 + CONTEXT.md 词条 + 模块/文档 AGENTS 收录纪律**。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（SA1 设计） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0031 决策 1（域句） | 「`maxBytes?: number`：≥1 的有限整数（≤ 2^53−1）…不新增校验码。缺席 ≡ 不设预算…不内建任何魔法默认」 | DD-2/DD-6：域判定 = `Number.isSafeInteger(v) && v >= 1`（split 与 canonical 双处同判据）；`2^53`/`2^53+2`/`1e21` → `READ_OPTIONS_INVALID`；D2 非自由位遵守、未重开；缺席/present-undefined/非 enumerable ≡ 无预算；G5 组级判据映射 | **implements-existing-decision** | ADR 0031 L16–17；设计 §7 DD-2/DD-6、§12 G5 行 | 实现后核对（RA-D4） |
| 2 | ADR 0031 决策 1（演进门） | 域句无域外值演进条款 | 设计明记 D2「再引入须 ADR 修订计划 + SA8 复核」，无并列终点 | **no-conflict** | 设计 §7 DD-6 D2 行 | 无 |
| 3 | ADR 0031 决策 2（规范度量） | 值通道 `utf8(JSON.stringify(value))` 紧凑键序交付序、`undefined` 计 0；schema 通道投影文本 UTF-8（✂/头行自然计入）、`null` 计 0；「整体序列化即度量」；账本不进公共面 | DD-4 度量等式构造性落地（`Buffer.byteLength` × 2 通道求和，组合式记账零镜像代码）；闸门位置在投影组装之后（度量对象 = 塑形后交付物，R6）；成功面恒四键不加 bytes 键 | **implements-existing-decision** | ADR 0031 L21–25；设计 §7 DD-4 | 实现后核对 |
| 4 | ADR 0031 决策 3（超限零交付） | 五键失败分支、`measuredBytes` 只报合计、≤ 判定、不裁剪不降深不拟合、三面同码同文同载荷 | DD-4 失败分支恰五键（`echoReadPath` 新鲜回显）；DD-7 文案三面共用并冻结为 OBL-WIN-1 镜像基准；成功交付物与无预算读逐字节相同（闸门透明） | **implements-existing-decision** | ADR 0031 L29–38；设计 §7 DD-4/DD-7 | 实现后核对 |
| 5 | ADR 0031 决策 4（分层落点 + 零变化清单） | 校验与度量住 runtime 组合层；doc-runtime 零改动下传两键；lease 别名跟随透传（别名锁延伸）；恒四键/✂ 文法/渲染器/头行（不记 maxBytes）/`DeepOptional`/无 options 逐字节零变化 | DD-1 全部生产改动集中 runtime.ts；DD-3 canonical 三键白名单 + 下传前剥离（`options` 恒两键，D7 结构保证）；DD-5.3 registry 源码零改动、按名单源别名自动跟随；§11 DENY LIST 逐面冻结（doc-runtime/vfsl/投影渲染器/窗口面/registry src/CONTEXT/ADR） | **implements-existing-decision**（D3 宿主形态 = 观测面已锁的自由位内选择，**no-conflict**） | ADR 0031 L42–43；设计 §7 DD-1/DD-3/DD-5、§11 | 实现后核对（RA-D4：§12.8 第 4 条 git diff 证据） |
| 6 | ADR 0031 决策 5（边界） | 缺席目标照常计量可超限；终态非预算 no-op；where 无对撞 | 闸在投影之后、`schema:null` 计 0 / `value === undefined` 计 0 由构造保证；G6（`['nick']` 26 拒/27 收锚）映射 | **implements-existing-decision** | ADR 0031 L47–49；设计 §7 DD-4、§12 G6 行 | 无 |
| 7 | ADR 0031 决策 6 + 验收「文档负控」行 + `docs/AGENTS.md` 同步规则（OBL-DOC-1） | 使用指引进 typed-access 纪律与作用域文档；「代码行为变化须同步每份陈述该契约的规范文档」 | DD-9 采用 SA6 §12.6 默认两形态：Phase A 实现变更集对 SCOPE_DOCS 三文件零 diff，Phase B 重录**紧随同迭代**独立落地（实名清单齐备：typed-access L125 句清退 + 三键语义 + 决策 6 分工指引；cordis L360–365 三键化；codegen L288 词汇补充）；义务关闭前不得宣告本票完成 | **implements-existing-decision**（义务登记且窗口闭合；兑现属实现期） | ADR 0031 L53/L76；`docs/AGENTS.md` Editing；SA6 §3.3；设计 §7 DD-9、§11 Phase B | RA-D3 兑现监督 |
| 8 | ADR 0031「验收」节（主接缝/度量 property/lease 透断言/门禁/minor bump） | 分支形状、≤ 边界、负控、缺席 × 超限、`schema:null` × maxBytes、无 options 回归锚、全套门禁 | §12 验收映射逐组承接（G1–G12）；R-6 破坏性 minor 引用验收节明文授权 | **implements-existing-decision** | ADR 0031 L73–77；设计 §12、§13 R-6 | 实现后核对 |
| 9 | ADR 0031 决策 1/3 窗口面三面义务 + ADR 0028（`WINDOW_OPTIONS_INVALID`）+ ADR 0029（where ✂ 永不装配） | 窗口面 maxBytes 同码同文（未兑现义务） | D6：本票不动窗口面；递延期守卫 = 现行 `WINDOW_OPTIONS_INVALID`（零改动自然保持）；OBL-WIN-1 挂账延续，DD-7 文案冻结为其镜像基准 | **no-conflict**（递延登记可追溯） | ADR 0028 L67；ADR 0031 L16/L24/L36；设计 §7 DD-6/D6、§13 follow-up | OBL-WIN-1 独立票（RA-D5） |
| 10 | ADR 0027（修订链后） | 决策 1 options 句已修订三键；恒四键、✂ 唯一载体、渲染器零选项纯函数、头行文法不动 | G8（`{depth:1,maxBytes:415}.schema === {depth:1}.schema` 逐字节、头行无 maxBytes）；DENY vfsl/渲染器 | **no-conflict** | ADR 0027 状态行 + L20–31；ADR 0031 L58；设计 §12 G8 行、§11 DENY | 无 |
| 11 | ADR 0024（修订链后） | 决策 1 options 三键 + 终态 no-op 例外注记；决策 2（amendment）E1 输出端 undefined 吸收纪律 | 设计按三键/例外注记口径工作；值面零触碰（E1 不动）；R4 终态锚参与计量断言 | **no-conflict** | ADR 0024 状态行、L26–31/L45；设计 §12 G4 行 | 无 |
| 12 | ADR 0008 + runtime/registry/doc-runtime AGENTS | reads 不进 sequencer、同步结果联合、lifecycle 停接纳稳定码、公共面只暴露 detached 投影、lease 独立调用方能力 | §8/§9：同步纯函数、零缓存零订阅零状态写入；S1 lifecycle gate 不变且先于一切 options 读取（N7 延伸） | **no-conflict** | ADR 0008 L16–18/L123；三个包 AGENTS；设计 §8.1/§9 | 无 |
| 13 | ADR 0023 + 公共导出面纪律（issue #93 值导出审计） | 公共面演进须可控、值导出键集审计锚定 | DD-5.2 新失败成员为包内名、经 `Extract` 结构可达，**零新导出名**；index.ts 仅注释增量；本次实测值导出审计只钉键集 `['RuntimeWriteFatalError']`——类型联合扩展零扰动 | **no-conflict** | ADR 0023；`runtime-acceptance-exports-audit.test.ts` L28–31（实测）；设计 §7 DD-5.2、§11 | 无 |
| 14 | CONTEXT.md 词条（字节预算/形状预算/截断省略/✂/投影文本/窗口读） | 零交付、稳定码、合计载荷、不裁剪、逐字节相同、缺席可超限、三面同码同文；`_Avoid_` 全家 | 设计语义面与词条逐点一致；非目标显式排除 `_Avoid_` 全部形态（裁剪/部分交付/maxBytes 当第三轴/✂ 找字节事实/载荷拆分分项） | **no-conflict** | CONTEXT.md L49–71（本次实读）；设计 §1 非目标、§13 | 无 |
| 15 | ADR 0024 决策 1（经 0031 再修订）× 既有类型锁 B11（**测试锁修正**） | options 闭合形状条款已演进三键；`_optionsAlias` Equal 锁的期望面应随修订链演进 | DD-5.4：`runtime-readdata-shape-budget.test-d.ts` L86–89 两键锁**原位修订**为三键闭合形状锁，纳入 Phase A ALLOW LIST（与类型变更**同变更集**，无中间红态）；理由在案 = 锁语义本是「options 闭合形状」锚、修订链在两 ADR 状态行登记；此为对 SA6 §12.2 清单的**必要补充**（非范围扩张），设计主动披露并触发本次复核——gating 正确 | **implements-existing-decision**（锁期望跟随已登记的 ADR 修订链；保留两键反而与修订后决策矛盾） | ADR 0024/0027 状态行（实测）；ADR 0031 L57–58；设计 §2 B11、§7 DD-5.4、§11、§15 理由 3 | RA-D2（同变更集 + 相邻注释同步） |
| 16 | 既有读纪律事实（B5–B8）与接缝豁免先例 × **拆分读/中继机制**（DD-2/DD-3/DD-8） | T1/canonical 读纪律、零 `[[Get]]`、message 单源、F-x5=4/F-x6=5 计数、F6/F7 定序、`seamReadOptionsInvalid` D1 豁免登记 | split 为包内 helper（非公共面）：逐字镜像 T1 读纪律读 raw 一次，产出忠实中继（未知键/accessor/非法值原样 `defineProperty` 复制 → T1 继续作两轴/未知键/宿主的**单一权威**，message 单源不漂移）；maxBytes 域违约走 runtime 构造成员（沿 seam 豁免先例、形状由单源类型注解锁死）；出口①改「re-split + re-T1(relay₂)」——本次逐跳推演核对：F-x5（1 键 trap）计数 4、F-x6 计数 5 **保持**（split 替位 T1 成为 raw 第一读者、T1 改读 plain relay 零 trap、canonical 仍第二读者）；失败优先级阶梯保 F6（G0 前置零 options 读取）/F7/N4/N5；设计将 parity 列为实现验收必要条件（R-1）而非既成事实——诚实且可核对 | **no-conflict**（组合层内部机制，落在 ADR 0031 决策 4 授权面内；观测面全数被 G5/G10 锁住；备选否决表未触碰任何冻结面） | 设计 §7 DD-2/DD-3/DD-8、§8.2 路线 3、§13 R-1；本次对 B5–B8/seam 先例/计数断言的实测 | RA-D1（实现期 parity 验收） |

裁决分布：**no-conflict 8 项、implements-existing-decision 8 项、evolution-required 0 项、hard-conflict 0 项、override 0 项**。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| —（无） | — | — | — |

- Owner 评论为空（简报 Comments 段空 + REST `[]` + 派发说明一致）→ 无评论来源 override。
- 无新 ADR 修订/废弃、无协议版本升级、ADR 0031 无允许域外值的演进条款。
- 设计未造任何 override：D1/D3/D4/D5/D6 全部选 SA6 契约推荐解（D7/D2 为 ADR 明文非自由位）——「另有选择须先原位修订契约」的触发条件未发生；B11 测试锁补充走的是「披露 + 记录理由 + 触发复核」正道，非 silent override。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（设计态度） |
|---|---|---|---|
| 成功面恒四键 `{ok,value,schema,truncated}`，不加 bytes 键 | ADR 0031 决策 2 + ADR 0027 决策 1 | ADR 0031 L25 | 闸门透明（成功路径不触碰已组装四键）；§8.1 S2b-6 不变——一致 |
| ✂ 段与头行文法；头行**不记** `maxBytes` | ADR 0031 决策 4 + ADR 0027 决策 3 | ADR 0031 L43 | D7 canonical 剥离 → 结构保证（渲染面零触碰）；G8 逐字节锚——一致 |
| 投影渲染器零选项纯函数（vfsl 零改动） | ADR 0027 决策 2 + ADR 0031 决策 4 | ADR 0027 L29 | §11 DENY——一致 |
| `DeepOptional` 类型面 | ADR 0031 决策 4 零变化清单 | ADR 0031 L43 | 零触碰——一致 |
| 无 options / 两键 options 逐字节现行为（含敌意面读次序与计数） | ADR 0031 决策 1/4 | ADR 0031 L17/L43 | G7 + split 读次序 parity（F-x5=4/F-x6=5 保持，本次推演核对）——一致（parity 落地为 RA-D1 实现验收） |
| doc-runtime options 两键闭合形状 + 校验器 + 直调行为 | ADR 0031 决策 4「零改动、下传两键」 | ADR 0031 L42 | §11 DENY + G11/N11 + `keyof` 硬锁——一致 |
| 既有失败码形状与定序：`PATH_NOT_ALLOWED` / `RUNTIME_READ_DISABLED` / `NAMESPACE_LEASE_RELEASED`（三键）/ `WINDOW_OPTIONS_INVALID`（递延期） | ADR 0008 修订节 / lease 冻结 issue / ADR 0028 | ADR 0008 L123；ADR 0028 L67 | DD-8 阶梯逐行保持（F6 G0 前置/F7 lifecycle 先行/T8 值通道失败先于预算/N8 released 短路）——一致 |
| 校验码词表：不新增校验码；唯一新码 `READ_BUDGET_EXCEEDED`（恰五键） | ADR 0031 决策 1/3 | ADR 0031 L16/L31–33 | split/canonical 域违约全部复用 `READ_OPTIONS_INVALID`——一致 |
| lease 原样透传（raw 引用直传）+ 重载序 legacy 末位 + legacy 联合零泄漏 | ADR 0031 决策 4 + ADR 0024 决策 6 | ADR 0031 L42 | registry `src/**` 入 DENY；别名按名自动跟随；`_readOverloadOrder`/`_readAlias` 不受影响——一致 |
| 公共导出键集（值导出面） | ADR 0023 + issue #93 审计 | `runtime-acceptance-exports-audit.test.ts`（实测只钉值键集） | index.ts 仅注释增量、零新导出名——一致 |
| E1 输出端 undefined 吸收纪律（值面第三态禁止） | ADR 0024 决策 2（amendment） | ADR 0024 L45 | 值面零触碰——一致 |
| readData 同步、不进 sequencer、零缓存 | ADR 0008 + runtime AGENTS | ADR 0008 L16–18 | §9 明示——一致 |
| maxBytes 规范域（1..2^53−1） | ADR 0031 决策 1 域句 | ADR 0031 L16 | DD-6 D2 非自由位遵守——一致 |

## 6. Evolution requirements

**无待计划的 evolution-required 项。** 设计不改变任何既有契约：全部条款在 ADR 0031 授权面内兑现既有决策。被删 D2 域外演进路径维持「计划在先」门（再引入须同变更集补齐 ADR 0031 决策 1 域句修订计划并送本门禁复核——要件见 iteration 0 报告 §6，仍适用）。ADR 0031 登记的合法演进位（可选裁剪模式、载荷拆分分项、窗口面 maxBytes）在设计中的处置均为「不承诺/独立票」，与登记状态一致。

## 7. Hard conflicts

**无。** 逐项核对未发现任何与既有决策不兼容且无合法 override 的条款。五个复审重点的全部结论：① 公共 API 扩张 = ADR 0031 决策 1/3/4 的忠实兑现（三键域句、五键分支、组合层落点、别名跟随、minor bump 授权）；② 拆分/中继 = 组合层内部机制，T1 单源权威与既有读纪律/计数全数保持；③ 类型联合传播 = 单源别名按名跟随，legacy 联合与导出键集零扰动；④ 文档义务 = OBL-DOC-1 两形态合法落地路径，窗口闭合不悬空；⑤ 测试锁修正 = 锁期望随已登记的 ADR 修订链演进，同变更集落地即无矛盾窗口。

## 8. Required actions

| # | 动作 | 对象 | 阻塞性 | 状态 |
|---|---|---|---|---|
| RA-1/RA-2/RA-3（前次阻塞项） | D2 域收口 / 路径更正 / OBL 挂账 | SA6 契约 rev2 | 前次阻塞 | **已闭合**（iteration 1 复核在案；本次抽查 SCOPE_DOCS 实名、L125 原句仍实测在案） |
| RA-5（前次 pins 收口） | D1/D3/D4/D5 收口 | SA1 设计 | 前次非阻塞 | **设计层已闭合**：D1 ≡ 缺席（沿 R1）、D3 runtime 自持三键 interface、D4 白名单纳三键 + 下传前剥离、D5 统一文案（契约断言不变）、D6 本票不动、D7 ADR 明文——全部推荐解，无「另有选择」；落地核对并入 RA-D4 |
| **RA-D1**（新） | **split 读形态 parity 验收**：`splitReadDataOptions` 必须逐字镜像 T1 读纪律（`Object.keys` + 逐键显式 descriptor、零 `[[Get]]`、宿主门只耗 `getPrototypeOf`、try 收编）；F-x5=4 / F-x6=5 计数与全部既有 readData 面红测保持 = 实现验收的一部分（设计 §13 已列「任务内必要条件」，不得伪装成 follow-up） | SA3/SA4 实现 + SA9 | 阻塞**实现验收**（不阻塞设计放行） | open |
| **RA-D2**（新） | **B11 测试锁同变更集**：`runtime-readdata-shape-budget.test-d.ts` L86–89 三键化原位修订须与 `NamespaceRuntimeReadDataOptions` 类型变更在 Phase A 同变更集落地（无中间红态）；**相邻注释一并更新**——该锁上方注释「doc-runtime 单源类型别名（零复制）」与 `runtime.ts` L153 同款注释在三键化后失真，属规范相邻陈述，不得留旧 | 实现变更集（Phase A） | 阻塞（root typecheck exit 0 的结构性条件） | open |
| **RA-D3**（新，= 前次 RA-7 延续） | **OBL-DOC-1 兑现监督**：Phase B 重录紧随 Phase A 同迭代落地、逐项对照 SA6 §3.3 台账、义务关闭前不得宣告本票完成。本次实测注记：「归调用方字节闸」清退子项在 SCOPE_DOCS 三文件**现无文本对应**（grep 全空）——实现期对照 readdata-docs 夹具族锚定时按「`maxBytes` 语义在场为主、清退子项作真空核实」处理，不构成义务缺口的遮蔽 | 总控排票 + 实现迭代 | 阻塞**本票收尾** | open |
| **RA-D4**（= 前次 RA-8 延续） | **实现后复审**：readData 公共 API（三键 options + 五键失败分支）、失败语义优先序（DD-8 阶梯）、D1/D3/D4 落地选择、DENY 面/§12.6 零 diff（git diff 证据）、OBL-DOC-1 形态——实现 diff 就绪后按 implementation 复查模式核对本报告 §5 冻结面 | SA4/SA9 触发 + 本门禁 | 流程 | open（`requiresConflictRecheck = true` 落点） |
| **RA-D5**（= 前次 RA-4 延续） | OBL-WIN-1 窗口面三面义务独立票兑现；message 措辞**逐字镜像** DD-7 选定文案（三面同文义务） | 独立票 | 非阻塞 | open（挂账可追溯） |

## 9. Verdict

**`clear`** —— 全部 16 项对照为 no-conflict（8）或 implements-existing-decision（8），无 hard conflict、无需 override、无待计划的 evolution-required。五个复审重点逐项裁决：

1. **公共 readData API 扩张**：三键闭合形状 + 五键 `READ_BUDGET_EXCEEDED` 分支 + legacy 联合零泄漏 + registry 别名单源跟随 + minor bump 授权——ADR 0031 决策 1/3/4 与验收节的逐条兑现；D2 域（1..2^53−1）未被重开。
2. **options 拆分/中继语义**：包内机制，落在决策 4 组合层授权面内；T1 对两轴域/未知键/宿主的单一权威与 message 单源通过忠实中继保持；既有敌意面读次序与计数（F-x5=4/F-x6=5）经本次逐跳推演核对保持，且设计将其列为实现验收必要条件；runtime 构造 maxBytes 域失败成员沿 `seamReadOptionsInvalid` D1 豁免先例且形状由单源类型注解锁死。
3. **类型联合传播**：registry 源码零改动、按名单源别名自动跟随；值导出键集审计（实测只钉值键集）零扰动。
4. **文档义务处理**：OBL-DOC-1 采用合法两形态（Phase A 零 diff + Phase B 紧随同迭代），实名清单与内容要求齐备，义务关闭前不得宣告完成（RA-D3 监督在案）；CONTEXT/ADR 零触碰正确（HEAD 已自洽）。
5. **测试锁修正**：B11 两键 Equal 锁的原位三键化是对 SA6 §12.2 清单的必要补充，锁期望跟随 ADR 0024→0031 已登记的修订链；设计主动披露、记录理由并触发本次复核——gating 行为正确；同变更集落地条件已列为 RA-D2。

设计 §15 自报 `requiresConflictRecheck = true` 及三条理由与本次裁决一致。**门禁放行；实现迭代可按本设计推进**（RA-D1/RA-D2 为实现期约束，RA-D3 阻塞收尾，RA-D4 为实现后复审触发点）。

## 10. requiresConflictRecheck

**true**。理由：readData 公共 API（options 三键闭合形状 + 结果联合新失败分支 `READ_BUDGET_EXCEEDED` 五键）与失败语义（DD-8 优先序）**尚待实现 diff 核对**（RA-D4）；split 读次序 parity（RA-D1）与 B11 锁同变更集落地（RA-D2）为实现期结构条件；OBL-DOC-1（文档重录）与 OBL-WIN-1（窗口面三面义务）未关闭；被删 D2 演进路径如被再引入须先携 ADR 0031 修订计划送本门禁复核（§6）。纯设计层对照无未决冲突——本标志的落点是**实现后**按 implementation 复查模式核对，非本报告存在未闭合项。
