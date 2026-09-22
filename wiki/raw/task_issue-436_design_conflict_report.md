# SA8 冲突门禁报告 — issue #436 设计后复审（iteration 1 修订版设计）

- Reviewed subject: **design**（`wiki/raw/task_issue-436_design.md`，iteration 1 修订版——SA2 reject 后逐条修订 F-1 + O-1..O-4）
- 复审基线：HEAD `7407ce01367b6d7a3fe497cd78c4bcf085f3ddbb`（`git log` 核对一致；ADR 0033 在 HEAD 由 `f6b27da` 立法、#435 接缝由 `006e416`/PR #444 交付，与设计 §0 声明一致）
- 复审焦点（dispatch 指定）：① ADR-0007 文档措辞处置（§7.6）；② ADR 0033 对非 union/union 测试重锚（§7.7）的授权；③ 与仓库规范性约束的一致性
- 本任务无前置门禁工件（`task_issue-436_relevant_decisions.md` / `_conflict_report.md` 不存在——`ls wiki/raw` 核对，与设计 §0/SA2 §1 声明一致）；本报告为首个 SA8 工件，决策集分析完整覆盖
- Issue REST comments：**空**（Host 简报明文 none——无 Owner 评论 override 来源）

## 2. Inputs and decision set

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-436.md`（Host 简报，Issue #436，comments = 空） | 已读；AC1–AC7 与设计 §12 映射核对 |
| `wiki/raw/task_issue-436_design.md`（iteration 1，被审对象） | 全文逐节对照 |
| `wiki/raw/task_issue-436_sa2_review.md`（存在的 SA2 评审：verdict reject，F-1 MAJOR + O-1..O-4 MINOR） | 已读；修订映射（设计 §14）逐条核对 |
| `docs/adr/0033-elementwise-yarray-mutation-validation.md` | 全文（决策 1–6、不做什么、后果；状态：已接受） |
| `docs/adr/0007-logical-validation-and-yjs-runtime-bridge.md` issue #237 修订节（L62–124） | 全文（条款 1–7 逐条） |
| `docs/adr/0010-hub-peer-websocket-ydoc-replication.md` issue #237 修订节（L333 起；后备句 L345–347） | 相关节全文 |
| `CONTEXT.md` L144（重建校验）/ L202（复制未校验） | 核对（已按 ADR 0033 目标状态立法） |
| `docs/AGENTS.md`（义务句）+ `packages/doc-runtime/AGENTS.md` | 核对 |
| ADR 0025/0026（guard/信封）相关面 | 扫描（无数组边界校验语义条款） |
| 事实锚点抽验：vfsl `validate-patch.ts` L1079 接缝、`index.ts` L139/L145 公共导出；doc-runtime `install-verify.ts` L354–355（`proposedBoundary` 必填）/L395 起（双核）、`mutation-local.ts` L296（`case 'array'`）；P-1 `apply-validated-mutation-fatal-contract.test.ts` L209–235（`W5_TEXT` 为用例内局部常量 L218）；P-2 `issue-237-path-localized-validation-red.test.ts` L548–569（共享 `TEXT_LIB_ITEM`） | 逐项命中，与设计引用一致 |
| 陈旧句面独立扫描：`grep -rn "不逐元素\|一次整体判定" docs/ CONTEXT.md`（排除 ADR 0033 自身） | **唯一命中 `docs/adr/0007-…md` L77**（条款 1）；其余命中（ADR 0025/0026）为 guard 整批语义，与数组校验无关——设计 §7.6「残留陈旧面恰一处」结论独立复核成立 |

决策集：全部 33 份 ADR 中无 superseded-by 状态影响本审（ADR-0007 状态「已接受（Runtime/open/read 条款由 ADR 0008 部分取代）」——被取代面与 mutation 校验语义无涉）；ADR 0033 为最新立法（2026-09-22，已接受）。

## 3. Decision analysis

| Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| ADR 0033 决策 1 | 闸门 = plan kind=`array` ∧ 边界值节点 kind=`array`；union 数组目标永久回退；规划层完全不动（L19–23） | §7.1 双条件闸门（值侧 `plan.node.kind` + 结构侧 `resolve(boundaryNode).kind`）+ 接缝 fail-closed 第三锁；`planMutationBoundary` 零改动；legacy 分支原样保留 | implements-existing-decision | 0033 L19–23；设计 §7.1；探针 U1/U2（SA6 证据） | 无 |
| ADR 0033 决策 2 | live `Y.Array.length` O(1) 越界；域规则逐字一致；issue 路径逐字节一致；delete O(1)；最小 edit 不变；零写入（L25–31） | §7.2 F2 facts + F3 接缝（域 message/path 复用接缝侧逐字实现）+ F4 复用 `buildDetachedValue` + F5 `commitPrepared` 零改动 | implements-existing-decision | 0033 L25–31；设计 §7.2/§7.3；SA2 §3 AC2/AC3 逐字核对结论 | 无 |
| ADR 0033 决策 3 | 事实核原样保留；fast-path 省略重投影核；legacy 双核不变（L33–37） | §7.4 `VerifyPlan` 判别联合；`verifyBoundaryInstallFacts` 逐字抽取两轨共享；`VerifyBoundaryIntactInput` 不变 | implements-existing-decision | 0033 L33–37；设计 §7.4；install-verify.ts L354–355/L395 抽验 | 无 |
| ADR 0033 决策 4 | 触达面收窄为「数组载体 + 变更区间」；污染数组 delete 由拒绝转成功；不补异步审计（L39–43） | §7.2 F1 载体检查保留（ADR-0007 条款 4(i) 面）+ §7.3 Δ1/Δ3 行为面枚举 + §7.7 两测试重锚 | implements-existing-decision | 0033 L39–43；设计 §7.2/§7.3/§7.7 | 重锚与 ADR-0007 注记**同变更集**交付（§7.6/§7.7 已承诺）；断言面不放宽（实现后复查②） |
| ADR 0033 决策 5 | 「数组合法 ⟺ 逐元素合法」立法 + 一致性 fixture enforcement（L45–50） | 本票零 vfsl 改动（fixture 已由 #435 E 组交付） | implements-existing-decision | 0033 L45–50；设计 §1 非目标/§11 DENY `packages/vfsl/**` | 无 |
| ADR 0033 决策 6 | 性能验收软：O(n)→O(k) 等价证据，不钉毫秒（L52–54） | §12 FB 组结构性读计数为证据面，毫秒仅软证据 | implements-existing-decision | 0033 L52–54；设计 §12 | 无 |
| ADR-0007 #237 条款 1 | 「批量 values[] / count 一次整体判定，**不逐元素**」（L76–77） | fast path 对非 union `T[]` 逐新值过 element 子 schema——与该句字面**不相容**；ADR 0033 决策 4 标题仅点名 ADR-0010，未点名本节 ⇒ 该句在无注记时仍以原义生效 | **evolution-required** | 0007 L76–77；0033 L25–43；设计 §7.6（注记默认交付 + 建议文案） | ADR-0007 #237 修订节末尾追加 ADR 0033 修订注记，与实现同变更集（见 §6——计划完整） |
| ADR-0007 #237 条款 4(ii) | 边界清单含「数组位」——「内部既存载体/值域非法仍响亮拒绝」（L102–103） | Δ1：非 union 数组位区间外既存损坏由响亮拒绝转为照常成功——与该句对数组位的字面不相容（载体位由 4(i)+F1 保留） | **evolution-required**（同一注记覆盖） | 0007 L100–107；设计 §7.6 注记文案明示「条款 4(ii) 中的『数组位』字面」/§7.3 Δ1 | 同上（同一注记） |
| ADR-0007 #237 条款 7 | 成本句「array/Record/union 边界与 delete 父位按边界规模」（L121–122） | 非 union 数组位成本变 O(变更量) | **evolution-required**（同一注记覆盖） | 0007 L121–122；设计 §7.6 注记文案明示条款 7 成本句 | 同上（同一注记；union 数组位仍按边界规模——注记作用域正确） |
| ADR-0007 #237 条款 4(i) | 载体形态违规（含 array-* 目标非 Y.Array）仍响亮拒绝（L100–101） | §7.2 F1 载体检查保留，issue 构造复用 extract.ts 同一助手（同文案同 path，反漂移） | no-conflict | 0007 L100–101；设计 §7.2 F1/§12.1 A-4 保绿机理 | 无 |
| ADR-0007 #237 条款 5 | 零写入/observer no-rollback/禁 write-then-undo；提交后验证覆盖范围收窄到受影响边界、边界外 observer 干扰不再检出（声明语义）；E201 C/D、E203/E204/E205 分类不削弱（L109–114） | §7.4/§9：事实核偏离→E201-C、核异常→E201-D、`committed:true` 不回滚不补偿；Δ2（区间外干扰静默通过）正是「受影响边界」= 载体+变更区间下的声明语义 | no-conflict | 0007 L109–114；0033 决策 3；设计 §7.4/§9/§7.3 Δ2 | 无 |
| ADR-0007 #237 条款 6 | A-6 行为等价 28 场景为成本优化硬验收（L116–119） | §12.1：A-6 全部为合法基线（`expectValidBaseline` 前置域），fast ≡ oracle 由组合性保证（决策 5）；A-6 保绿 | no-conflict | 0007 L116–119；设计 §12.1 | 无 |
| ADR-0007 #237 条款 2/3 | phase-1 前置假设；`set([])` 全量管线唯一合法全量形态（L83–96） | 不触碰（§1 非目标明示） | no-conflict | 0007 L83–96；设计 §1 | 无 |
| ADR-0010 #237 修订节 | 后备句「导航路径与语义边界内的非法数据…仍会被响亮拒绝」（L345–347），授权链引 ADR-0007 损坏条款为单一真相源 | 数组含义**已被 ADR 0033 决策 4 标题显式点名修订**（0033 L39「修订 ADR-0010 issue #237 修订节的数组含义」）；设计不在该文件追加注记——成立：修订已在新 ADR 中显式记录，且其后备句以 ADR-0007 损坏条款为单一真相源，注记落地后引用链自洽 | no-conflict（已被母法点名修订） | 0010 L333–347；0033 L39；设计 §7.6 扫描结论 | 实现后复查确认 ADR-0010 句面与注记后语义无漂移（轻量，随复查①） |
| CONTEXT.md L144/L202 | 重建校验/复制未校验词条 | 两词条已按 ADR 0033 目标状态立法（「数组位例外（ADR-0033）」/「数组写自 ADR-0033 起触达面收窄…」——`f6b27da` 随 ADR 0033 同批落地）；实现后即与现实一致，零改动成立。备注：L144 首句「批量数组整体判定…不逐元素」为指向 ADR-0007 #237 节的转引短语，紧随的例外句为词条主断言——注记落地后转引自洽，无需改词 | no-conflict | CONTEXT.md L144/L202；git `f6b27da`；设计 §7.6 | 无 |
| `docs/AGENTS.md` 义务句 | 「When code behavior changes, update every normative document whose stated contract changed」+「documentation-only wording changes must not invent implementation behavior」 | §7.6 把 ADR-0007 注记定为**默认交付物**（ALLOW LIST 无条件项），豁免仅 Controller 明示裁决且实现报告记录；注记随实现同批（非 doc-only 造行为）。本审独立扫描证实陈述契约变化的规范文档**恰一处**（ADR-0007 #237 节），无遗漏面 | implements-existing-decision | docs/AGENTS.md；设计 §7.6/§11/§13 R7；本报告 §2 扫描行 | 实现后 `git diff` 核对注记在位（复查①） |
| `packages/doc-runtime/AGENTS.md` | 校验失败零写入；detached 构造 + 单 guarded transaction 安装；写后不变量失败 = fatal；公共 API 仅经 `src/index.ts` | §8.1 新增导出全 @internal、公共面零变化；§7.2 detached 构造复用既有构建；§7.4 事实核失败保持 E201 fatal 通道 | no-conflict | packages/doc-runtime/AGENTS.md；设计 §8.1/§9 | 无 |
| ADR 0025/0026 | guard 评估先于逐操作 prepare；批量 E1–E6 信封语义 | guard/解析/信封区零改动（§7.5/§11 DENY）；阶段 C 折迭仅按 `verify.kind` 判别跳过 `install-facts` 项，legacy 边界项折迭语义不变 | no-conflict | ADR 0025/0026；设计 §7.5/§11 | 无 |
| Issue #436 正文 AC1–AC7（简报） | 验收判据 | §12 映射齐全；AC7 预测已修正为两态判据（实现前失败面恰 = 契约 8；实现后 464 files 全绿）——与 §7.7 重锚同批承诺一致 | no-conflict | task_issue-436.md；设计 §12/§7.7 | 无 |

**测试重锚授权专项裁决（dispatch 焦点②）**：P-1/P-2 为**enforcement 工件而非决策文本**——钉死的是 ADR-0007 #237 条款 4(ii) 对非 union 数组位的旧义；ADR 0033 决策 4（已接受）改变该行为后，两用例的旧期望失去规范依据，随实现调整是兑现新决策的组成部分，**不是对任何在役决策的 override**。重锚载体（union 数组）选在 ADR 0033 决策 1 立法的「永久 legacy 全量边界」面上（该面条款 4(ii) 原义**仍然有效**——union 边界照旧整体验证、边界内损坏照旧响亮拒绝），故重锚后两用例锚定的是持续成立的规范语义，意图锚（W5「领域失败留在 ok:false 联合」/对称面「提取型边界内损坏响亮拒绝」）不断链；断言面（`ok:false` + `issues > 0` + 零写入 / `ev.count===0` + `length===3`）原样保留不放宽。授权链完整：ADR 0033 决策 1（union 永久 legacy 面）+ 决策 4（非 union 行为变更）+ ADR-0007 注记（同批关闭条款 4(ii) 字面缺口，使「数组位」旧义对非 union 目标的废止有成文修订记录）。**无任何决策禁止修改既有非冻结测试**；唯一测试冻结面（SA6 三件套）在 DENY LIST 内未被触碰。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| ADR-0007 #237 条款 1/4(ii)/7 的数组整体语义（非 union `T[]` 数组位：一次整体判定、边界内损坏响亮拒绝、按边界规模） | **ADR 0033（已接受，2026-09-22，决策 1–4）**——新 ADR 修订旧 ADR 语义的正式路径；经 `docs/AGENTS.md`「Amend or supersede prior decisions explicitly instead of silently contradicting them」+ 义务句，由设计 §7.6 在 ADR-0007 #237 节内以**显式修订注记 + 授权链**落实（沿仓库「显式修订节」惯例：ADR-0006 #64/#79、ADR-0008 #93/#132、ADR-0007/0010 #237 节先例）。注：ADR 0033 决策 4 标题仅点名 ADR-0010——对 ADR-0007 的修订权威来自 0033 决策 1–4 的实质内容（已接受）+ 义务句，注记正是把该实质修订**显式登记**到被修文件的机制，此即本项为 evolution-required 而非 implements-existing-decision 的原因 | 仅非 union `T[]` 数组位：逐元素校验、触达面 = 载体 + 变更区间、成本 O(变更量)。union 数组目标、union 穿越/Record/delete 父位边界、set 目标位、条款 4(i) 载体条款、条款 5 失败语义、条款 6 等价硬前置、`set([])` 管线**逐字保持** | ① ADR-0007 注记 + P-1/P-2 重锚 + fast path 实现**同一变更集**交付；② 实现后冲突复查核验注记文本与 ADR-0007 条款 1/4(ii)/7、ADR 0033、ADR-0010 L345–347 引句的一致性，及重锚 diff 不放宽断言面（requiresConflictRecheck = true） |

无 Owner 评论 override（comments = 空）；无协议版本升级主张；无决策文本自含演进条款被援引。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（设计声明；实现后复查逐项对 diff） |
|---|---|---|---|
| update bytes / 事件形态（Y.Array 区间最小 edit、单事件） | 复制协议与诊断捕获零改动 | ADR 0033 决策 2 L30 | `commitPrepared` 零改动（§7.2 F5）；ND1–ND4 锚定 |
| 错误分类：E201 变体 C/D、E203/E204/E205；issue path/message 逐字兼容 | fatal 分类不削弱；兼容面 | ADR-0007 #237 条款 5 L109–114；ADR 0033 决策 2 L28 | §7.4 E201 C/D 原样；§7.1 O-4 闸门 resolve 抛错同 try/同 catch/同分类 E204；域文案经接缝逐字复用 |
| 零写入纪律（拒绝先于 live 写、无 write-then-undo） | 一切失败零写入零 update | packages/doc-runtime/AGENTS.md；ADR 0033 决策 2 L31 | §7.2 一切失败在 prepare 期返回；锚 B-4 |
| 公共 API 面（`src/index.ts` 导出） | 无新公共导出 | packages/doc-runtime/AGENTS.md | §8.1 新增导出全 @internal；公共面零变化 |
| `planMutationBoundary`（规划层） | 完全不动 | ADR 0033 决策 1 L23 | §1 非目标/§7.8 拒绝在规划层分流 |
| union 数组 legacy 轨（永久双轨） | union 永久回退全量边界路径 | ADR 0033 决策 1 L22 | §7.1 legacy 分支逐字节保留；§7.7 重锚锚定此轨 |
| vfsl 接缝与导出面（`applyElementwiseArrayMutation` 等） | #435 已交付冻结 | PR #444/`006e416`；设计 §11 DENY | 本票零 vfsl 改动（validate-patch.ts L1079/index.ts L139 抽验在位） |
| guard/信封面（E1–E6、`parseMutationCore`/`parseGuard`/`evaluateGuard`） | 解析与 guard 语义冻结 | ADR 0025/0026；设计 §11 DENY | §7.5 该区零改动 |
| SA6 三件套测试（contract/control/fixture） | 红灯必须经实现自然转绿 | SA6 契约纪律 | §11 DENY 明示不可修改 |
| ADR-0007 #237 条款 4(i)/5/6/2/3 与其余边界种类句面 | 注记作用域之外逐字保持 | 0007 L83–119；设计 §7.6 注记文案 | 注记文案明示「按本节原文逐字保持」「不受影响」 |
| ADR 0033 / ADR 0010 / CONTEXT.md 文本 | 母法与词汇零改动 | §11 DENY | 本票仅动 ADR-0007（追加注记）+ 两测试定向项 |

## 6. Evolution requirements

唯一 evolution-required 项 = ADR-0007 #237 节数组语义（条款 1/4(ii)/7，非 union `T[]`）。修订计划完整性七要素核对：

| 要素 | 计划内容（设计 §7.6/§7.7） | 判定 |
|---|---|---|
| 修订文件 | `docs/adr/0007-…md` issue #237 修订节（L62–124）末尾**追加**注记，不重写既有条款；ALLOW LIST 无条件项（默认执行） | ✓ |
| 新旧语义 | 注记建议文案逐句给出：旧（一次整体判定/数组位边界内响亮拒绝/按边界规模）→ 新（逐元素/载体+变更区间/O(变更量)），作用域显式限定非 union `T[]` | ✓ |
| 兼容与迁移 | 无 wire/schema/持久化/状态机迁移；union 数组与其余边界种类逐字保持；issue 路径/顺序逐字节兼容（决策 2 立法）；Δ1/Δ2/Δ3 行为面变更全部枚举且各有 ADR 依据（§7.3） | ✓ |
| 失败语义 | 条款 4(i) 载体违规不受影响；E201 C/D、零写入、fatal 分类不削弱（§7.4/§9） | ✓ |
| 版本/授权 | 带日期（2026-09-22）修订注记 + 授权链（ADR 0033 决策 1–4 已接受 + docs/AGENTS.md 义务句），沿仓库显式修订节惯例；豁免仅 Controller 明示裁决且实现报告记录，不得静默留白 | ✓ |
| 验证 | §12：SA6 FA/FB/FC/NA/NB/NC/ND 契约 + P-1/P-2 两态绿判据 + 根 `pnpm typecheck`/`pnpm test` 门 | ✓ |
| 保持不变的冻结面 | 注记文案 + §5 冻结面表逐项列明 | ✓ |

**计划完整** ⇒ 允许 clear，但必须 `requiresConflictRecheck: true`（注记最终文本与重锚 diff 属实现期核对面）。

## 7. Hard conflicts

**无。** 唯一潜在硬冲突形态——实现改变 ADR-0007 #237 条款 1/4(ii) 所陈述契约而不带显式修订（iteration 0 的「实现期二选一」选项 b 即该形态）——已在 iteration 1 被废止（§7.6 默认执行 + §7.8 拒绝行），修订路径完整合法。

## 8. Required actions

1. **同变更集纪律**：ADR-0007 #237 注记、P-1/P-2 定向重锚、fast path 实现三者必须同一变更集交付（设计 §7.6/§7.7/R9 已承诺）——实现后复查核对 `git diff` 三者在位且无次序分离。
2. **实现后冲突复查范围**（= `requiresConflictRecheck: true` 的核对清单，与设计 §15 建议一致）：① 注记最终文案与 ADR-0007 条款 1/4(ii)/7 原句、ADR 0033 决策 1–4、ADR-0010 L345–347 引句的一致性（含 ADR-0010 句面无漂移）；② P-1/P-2 重锚 diff 恰为 schema 文本/局部常量/注释授权链/锚定载体，断言语义面零放宽；③ fast path 实现管线本身不要求重查（SA2 逐锚点攻击已确认无架构冲突，本轮未改实质）。
3. 若 Controller 明示豁免注记：实现报告必须记录该裁决引用（不得静默留白）——否则违反 docs/AGENTS.md 义务句。

## 9. Verdict

**clear** —— 全部对照项为 no-conflict 或 implements-existing-decision；唯一 evolution-required 项（ADR-0007 #237 数组语义修订）已有完整同变更集修订计划（§6 七要素全过）并标记后续复查。设计对三个焦点面的处置均成立：ADR-0007 注记为义务驱动的默认交付物且陈旧面恰一处（独立扫描证实）；P-1/P-2 重锚授权链完整（ADR 0033 决策 1/4 + 同批注记）且锚定持续有效的 union legacy 规范面；CONTEXT/ADR-0010/模块 AGENTS/0025/0026 无残留不一致。

## 10. requiresConflictRecheck

**true** —— 规范性文档修订（ADR-0007 注记文本）与既有验收锚迁移（P-1/P-2 重锚）均尚待实现期核对（§8 清单①②）；fast path 实现管线本身（§8 清单③）不要求重查。
