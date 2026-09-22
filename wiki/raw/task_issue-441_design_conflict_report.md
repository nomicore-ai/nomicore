# SA8 冲突门禁报告 — issue #441 设计后复审（iteration 1 设计，原位更新）

- Reviewed subject: **design**（`wiki/raw/task_issue-441_design.md`，iteration 1——SA2 reject
  （F-SA2-1/F-SA2-2）+ 本报告 iteration 0 reject（1 项 evolution-required：ADR-0007 注记计划
  缺失）后的修订版；本报告原位更新，只反映当前被审对象）。
- 本轮复审焦点（dispatch 指定）：**ADR-0007 修订注记计划（设计 §7.6）的完整性**与**iteration 0
  evolution-required 裁决的解除**。iteration 0 §8 Required action 4 明确「修订后 SA8 复审仅核
  注记计划完整性（七要素），无需重开行为面裁决」——行为核心（§7.1–§7.5/§8–§10）经核对与
  iteration 0 同范围未动（设计 §0「本轮不动其本体」），iteration 0 §3 行为面裁决（前八行
  implements-existing-decision × 8 + no-conflict × 10，无 hard-conflict）继续有效，不重开。
- 复审基线：HEAD `3fd6aa8b659420fd63d07b051139fe5f279556b8`（分支 `mabf/issue-441`，`git log`
  核对；worktree 仅 SA6 未跟踪证据工件，`packages/*/src`、`docs/**` 零改动）。
- Issue REST comments：**空**（Host 简报明文 none——无 Owner 评论 override 来源；与 iteration 0
  一致）。

## 2. Inputs and decision set

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-441.md`（Host 简报，issue #441，comments = 空，AC1–AC6） | 已读；与设计 §4 映射核对不变 |
| `wiki/raw/task_issue-441_design.md`（iteration 1，被审对象） | 全文逐节对照；修订差异面（§0 摘要 ①–④）逐条核验 |
| `wiki/raw/task_issue-441_sa2_review.md`（iteration 0 设计的 SA2 评审：reject，F-SA2-1/F-SA2-2 两 MAJOR + O-1..O-3） | 全文；设计 §14 修订映射逐条核对成立 |
| 本报告 iteration 0 版（前置 reject：1 项 evolution-required，Required actions 1–5） | 作为修订输入核对；iteration 0 行为面裁决按其 §8.4 承继 |
| `docs/adr/0034-record-and-parent-elementwise-validation.md`（已接受 2026-09-22） | 全文复核（决策 1–6；**决策 4 标题「扩展 ADR-0010 issue #237 修订节」——只点名 ADR-0010，未点名 ADR-0007**，L37） |
| `docs/adr/0007-logical-validation-and-yjs-runtime-bridge.md` issue #237 修订节（L62–124）+ ADR 0033 修订注记（L126–140） | **逐行核对**：条款 1 投影/重建句 L72–78（含「Record 位…delete 的父 map 位…只把该边界投影为局部 logical 值…在 detached 局部值上…重建」）；条款 4(ii) L100–107 引块（「union 穿越位、Record 位、数组位、delete 的父 map 位…内部既存载体/值域非法仍响亮拒绝」L101–103）；条款 7 成本句 L121–124（「array/Record/union 边界与 delete 父位按边界规模」L122）；0033 注记作用域句 L137–139（「其余边界种类（union 穿越位、Record 位、delete 父 map 位）按本节原文逐字保持」——被 reaffirm 面恰为本次修订对象）+ ADR-0010 处置先例句 L139–140 |
| `docs/adr/0010-hub-peer-websocket-ydoc-replication.md` issue #237 修订节（L333–361） | 后备句 L345–347 逐字复核（「导航路径与语义边界内的非法数据…仍会被响亮拒绝；触达面外的非法数据不再被普通写发现」）；其授权链 L337–338 以 ADR-0007 损坏条款为单一真相源 |
| `docs/adr/0033-elementwise-yarray-mutation-validation.md`（数组先例） | 决策 4 标题「修订 ADR-0010 issue #237 修订节的数组含义」L39——标题点名 ADR-0010 的先例形态与 ADR 0034 同构 |
| `CONTEXT.md` L144（重建校验）/ L202（复制未校验） | 复核：两词条均含「自 ADR-0034 起」例外/收窄句（`0a91f14` 同批立法）；L144 的「Record 位」命中位于「见 ADR-0007 issue #237 修订节」转引短语内，其后紧随 ADR-0034 主断言——注记落地后自洽 |
| `docs/AGENTS.md` 义务句 | 「Amend or supersede prior decisions explicitly instead of silently contradicting them」+「When code behavior changes, update every normative document whose stated contract changed」——在位（本审直接依赖） |
| git 证据 | `0a91f14`（ADR 0034 受理）仅改 CONTEXT.md +4 行 + 新增 ADR 0034——**未修订 ADR-0007**；`git log -- docs/adr/0007-…md` 最后改动 = `ca0ab53`（PR #434 spec PR，**同 PR** 含 ADR-0007 +16 行注记 + vfsl/doc-runtime 数组实现 + 测试重锚）——同变更集纪律先例成立，#438 缺位即 iteration 0 reject 诱因，与本票须补注记的因果链一致 |
| 陈旧句面独立扫描（复核 iteration 0 结论） | `grep -rn "Record 位\|delete 父位\|delete 的父 map 位\|父 map 位\|按边界规模" docs/ CONTEXT.md`（排除 ADR 0033/0034 自身）：**规范文档命中仍恰 `docs/adr/0007-…md` 一处**（L74/L102/L122 条款正文 + L137–138 注记作用域句）+ CONTEXT.md L144 转引短语——「陈述契约变化的规范文档恰此一处」结论维持 |
| 直接先例：`wiki/raw/task_issue-436_design_conflict_report.md`（数组案设计后复审 **clear** 判例） | §6 七要素标尺 + 「计划完整 ⇒ 允许 clear，但必须 requiresConflictRecheck: true」规则原文——本轮套用同一标尺 |

决策集状态：34 份 ADR 无 superseded 影响本审（同 iteration 0 核对）；ADR 0034 已接受为最新立法。

## 3. Decision analysis

行为面（ADR 0034 决策 1–6 及其管线、S9 收窄、触达面、零写入、公共面、SA6 契约、模块纪律、
ADR 0025/0026、根 AGENTS.md）与 iteration 0 裁决一致承继（implements-existing-decision × 8 +
no-conflict × 10，无 hard-conflict）——iteration 1 未动行为本体，SA2 §6 行号锚点独立核验亦
无漂移。本轮增量裁决面：

| Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| **ADR-0007 issue #237 修订节 条款 1**（投影/重建句 L72–78 对 Record 位/delete 父位） | 同 iteration 0 | fast path 不再整边界投影/重建——字面不相容，**但 §7.6 已给出修订注记计划**（落点/授权链/建议文案/同变更集） | **evolution-required（计划完整）** | 0007 L72–78；0034 决策 1–4；设计 §7.6 陈旧面表第 1 行 + 建议文案（明引条款 1 句面） | 实现期按计划落地注记 + 同变更集（见 §6/§8） |
| **ADR-0007 条款 4(ii)**（「Record 位」「delete 的父 map 位」响亮拒绝字面 L100–107） | 同 iteration 0 | 触达面收窄后未触达兄弟污染由响亮拒绝变为目标键合法即成功——§7.6 建议文案明示修订该两处字面与触达面新义 | **evolution-required（计划完整）** | 0007 L100–107；0034 决策 4；设计 §7.6 陈旧面表第 2 行 + 建议文案（「未触达 entry/字段的既存损坏不再被普通写发现（对污染 map 的写目标键合法即成功）」） | 同上 |
| **ADR-0007 条款 7**（成本句 L121–124 对 Record/父位「按边界规模」） | 同 iteration 0 | Record set O(新值)/delete O(1)——§7.6 建议文案明示成本句修订 + union 句保持 | **evolution-required（计划完整）** | 0007 L121–124；0034 后果节；设计 §7.6 陈旧面表第 3 行 + 建议文案 | 同上 |
| `docs/AGENTS.md` 两条义务句 | 显式修订而非静默矛盾；行为变化更新契约陈述变化的规范文档 | iteration 0 裁决「义务未兑现」的缺口**已解除**：§7.6 把注记定为票内默认交付物（豁免仅 Controller 明示且须记录）；§11 把 `docs/adr/0007-*.md` 以有界追加式纳入 ALLOW，`docs/**` 一揽子 DENY 解除、其余 DENY 理由改为如实陈述（0033/0034/CONTEXT/ADR-0010 经核对自洽） | no-conflict（义务在票内兑现，落地核对随 §15 ①②） | docs/AGENTS.md；设计 §7.6/§11/§6；本报告 §2 扫描行（陈旧面恰一处） | 无（实现期核对随复查清单） |
| ADR-0010 issue #237 修订节后备句（L345–347） | Record/父位含义扩展 | 不追加注记——ADR 0034 决策 4 标题显式点名「扩展 ADR-0010 issue #237 修订节」（0034 L37），沿 0033 注记 L139–140 先例句式（「该节已被其标题点名，无需另行注记」）；§7.6 末句登记处置 + §15 ① 复查句面无漂移 | no-conflict（已被母法点名扩展；同 iteration 0 裁决） | 0010 L333–347；0034 L37；0007 L139–140 先例；ADR 0033 L39 同构先例；设计 §7.6「ADR-0010 处置」 | 实现后复查 ADR-0010 句面无漂移（§15 ①） |
| ADR-0007 条款 4(i)/5/6/2/3 与其余边界种类句面（L83–119/L137–139） | 注记作用域外逐字保持 | §7.6 不变面清单逐项列明（union 位/4(i)/5/6/2/3/条款 7 union 句）+ 建议文案明示「按本节原文逐字保持」「不受影响」 | no-conflict | 0007 L83–119；设计 §7.6 不变面清单 + 建议文案 | 无（注记落地后随 §15 ① 核对作用域句 L137–139 与新注记自洽） |
| SA6 契约 §12.2-8「探针 exit 0 不变」半句（iteration 1 新处置面） | 固定验收工件内的失实预期 | `wiki/raw/` 是证据非规范契约（docs/AGENTS.md Authority 节）——不构成冲突基准；设计不动固定工件，以 §12 判据枚举 + §12.1 逐 check 分类消歧（探针实现后 exit 1 且失败集恰 12 项 = 确认信号） | no-conflict（不在决策集内；属 SA2 F-SA2-1 验收判据域） | docs/AGENTS.md Authority；设计 §12/§12.1；SA2 §12–§13 | 无 |
| ADR 0025/0026 引文（iteration 0 Required action 3） | 批内路径互不嵌套 L30 / 最小 edit L36 / 操作失败聚合零写入 L41 | §6/§7.5/§15 引文已更正为实条款（L30/L36/L41），「ADR 0026 §7.5.2」误引删除；「组合期望边界」正确归源 issue #350 设计 + `mutation.ts` 折迭机制 | no-conflict（证据修正已兑现） | 设计 §6 ADR 0025/0026 行、§7.5、§15 第 5 点 | 无 |

iteration 1 其余修订面（§12.1 探针重新定性、§13 O-1/O-2/O-3 残余登记、§14 映射）均不触及
ADR/CONTEXT 决策文本，无新决策面。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| ADR-0007 issue #237 条款 1/4(ii)/7 的 Record/父位整体语义 | **ADR 0034（已接受 2026-09-22，决策 1–4）**+ `docs/AGENTS.md` 义务句（同 iteration 0 裁定）；**iteration 1 起该权威正被显式行使**——§7.6 规划「ADR 0034 修订注记（2026-09-22）」追加于 ADR-0007 #237 节末（紧随 0033 注记 L126–140 之后），带授权链首段、作用域句、不变面清单，与实现**同一变更集**（§12 判据 5） | 仅非 union Record 位与封闭对象 delete：逐 entry/静态校验、触达面 = map/父载体 + 目标键位、成本 O(新值)/O(1)；union map 位/union 穿越、其余边界种类、条款 4(i)/5/6/2/3、`set([])` 管线逐字保持 | ① 注记 + fast path 实现同变更集交付（§7.6 纪律节 + §12 判据 5，先例 `ca0ab53`）；② 实现后复查注记文本一致性（§15 ①② → requiresConflictRecheck）；③ 豁免仅 Controller 明示裁决且实现报告记录——无在案豁免 |

无 Owner 评论 override（comments = 空）；无协议版本升级主张；无决策文本自含演进条款被援引。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（设计声明；实现后复查逐项对 diff） |
|---|---|---|---|
| update bytes / 事件形态（单键最小 edit、单事件、批量单事务单 update） | 复制协议与诊断捕获零改动 | ADR 0034 状态行/决策 1 | `commitPrepared` set/delete 两支零改动（§7.4）；ND1–ND6 字节 oracle 锚定 |
| 错误分类：E201 变体 C/D、E203/E204/E205；issue path/message 逐字兼容 | fatal 分类不削弱；域规则兼容面 | ADR-0007 #237 条款 5；ADR 0034 决策 1 | §9.1 分类表逐字；F1/NC10/NC11 载体文案冻结；域文案经接缝单一实现源 |
| 零写入纪律（拒绝先于 live 写、无 write-then-undo） | 一切失败零写入零 update | packages/doc-runtime/AGENTS.md；ADR-0007 条款 5 | §7.3 一切失败在 prepare 期返回；锚 B-4 |
| 公共 API 面（`src/index.ts`） | 无新公共导出 | packages/doc-runtime/AGENTS.md；SA6 §12.1 B-1 | `src/index.ts` 零改动（§8） |
| `planMutationBoundary`（规划层） | 完全不动 | ADR 0034 决策 1 | §1 非目标/§7.2 只消费 plan；DENY `packages/vfsl/**` |
| union map 位 / union 穿越 legacy 轨 | 永久双轨、行为逐字节一致 | ADR 0034 决策 1；SA6 B-2 | §7.1 legacy 逐字保留；NA1–NA5 锚定 |
| vfsl 接缝与导出面 | #440 已交付冻结 | ADR 0034 决策 6 | 本票零 vfsl 改动（§11 DENY） |
| `install-verify.ts`（VerifyPlan/install-facts/共享事实核） | #436 已建立，纯消费 | ADR 0034 决策 3 | 零改动（§7.5 复用） |
| guard/信封面（E1–E6） | 冻结 | ADR 0025/0026 | §2 入口锚零改动 |
| SA6 三件套测试 + 探针 | 红灯经实现自然转绿；探针文件字节不变（实现后 exit 1 + 12 项翻转集 = 确认信号） | SA6 契约纪律；设计 §12.1 | §11 DENY 明示不可修改；新探针须另行命名 |
| ADR-0007 条款 4(i)/5/6/2/3 与其余边界种类句面 | 注记作用域之外逐字保持 | 0007 L83–119/L137–139 | **注记计划在位**：§7.6 不变面清单 + 建议文案明示「按本节原文逐字保持」「不受影响」（实现后随 §15 ① 核对） |
| ADR 0033/0034、ADR-0010、CONTEXT.md、协议文档文本 | 零改动 | 设计 §11 DENY（理由如实：0033/0034 已接受、CONTEXT 已按目标状态立法、ADR-0010 已被标题点名） | 本票规范修订面**仅** ADR-0007 有界追加注记一处（§11 ALLOW） |

## 6. Evolution requirements

唯一 evolution-required 项 = **ADR-0007 issue #237 修订节条款 1/4(ii)/7 的 Record 位/delete 父位
字面**（同 iteration 0；执行依据 docs/AGENTS.md 义务句）。iteration 1 §7.6 修订计划七要素核对
（逐项对照实际文件验证，标尺 = #436 判例 §6）：

| 要素 | 计划内容（设计 §7.6） | 本审独立验证 | 判定 |
|---|---|---|---|
| 修订文件 | `docs/adr/0007-…md` issue #237 修订节末尾、紧随 0033 注记（L126–140）之后追加同级 `###` 注记；追加式不重写既有条款；§11 ALLOW 有界纳入（豁免仅 Controller 明示） | 文件现 140 行、末节即 0033 注记——落点存在且追加式与 `ca0ab53` 先例 diff 形态一致；ALLOW/DENY 作用域核对（`0007-*.md` 摘出，其余 `docs/**` 维持 DENY 且理由如实） | ✓ |
| 新旧语义 | 陈旧面表 3 行（条款 1 L72–78 / 4(ii) L100–107 / 7 L121–124，引原文）+ 建议文案逐句给出旧→新（整边界投影重建→逐 entry/静态；边界内响亮拒绝→触达面「map/父载体 + 目标键位」；按边界规模→O(新值)/O(1)） | 三处行号与引文逐行比对实际文件**全部吻合**；建议文案明示三处条款字面与 ADR 0034 决策来源（镜像 0033 注记句式，作用域句反向收窄） | ✓ |
| 兼容与迁移 | 行为面 ↔ 条款字面映射（FA/FC↔4(ii)、FB↔7、§8↔1）；既有测试零迁移需求 | §10 核查面经 SA2 §9 与 iteration 0 §3 专项裁决双重独立复核成立（无既有用例锚定待废止 record 污染阻断/重投影 E201）；应急模板保留（#436 W5 同款，断言语义零放宽） | ✓ |
| 失败语义 | 条款 4(i)/5/E201 C/D/零写入/fatal 分类保持；注记明示「不受影响」 | 设计 §9 与 iteration 0 no-conflict 裁决一致；建议文案含「载体形态违规（条款 4(i)）不受影响」 | ✓ |
| 版本/授权 | 带日期（2026-09-22 = ADR 0034 受理日）注记 + 授权链首段（ADR 0034 决策 1–4 已接受 + docs/AGENTS.md 义务句 + 显式修订节先例）；无需 Owner 裁决（comments = 空；override 权威 = 已接受 ADR 0034 实质 + 义务句） | 授权链结构与 0033 注记 L128–131 先例逐句同构；日期核对（0034 状态行 2026-09-22） | ✓ |
| 验证 | §12 判据 5（同变更集 git diff 可核）+ §15 ①②（注记文本与条款 1/4(ii)/7 原句、ADR 0034 决策 1–4、ADR-0010 L345–347 引句一致性） | 判据枚举无歧义（探针已移出判据，F-SA2-1 落实）；§15 ①含 L137–139 作用域句与新注记自洽核对——iteration 0 缺项补齐 | ✓ |
| 保持不变的冻结面 | §7.6 不变面清单（union 位/4(i)/5/6/2/3/条款 7 union 句）+ §5 冻结面表「ADR-0007 作用域外句面」行 + §11 DENY（0033/0034/CONTEXT/ADR-0010/协议文档） | 不变面清单与 iteration 0 冻结面表逐项对齐；建议文案含「union 容器目标…与 union 穿越、本节其余边界种类按本节原文逐字保持」 | ✓ |

**七要素全过（7/7 ✓）——计划完整。** 对照 iteration 0 的四项 ✗（修订文件/新旧语义/版本授权/
冻结面）逐项解除；iteration 0 §8 Required actions 1（注记计划三要件 a/b/c）、2（DENY 作用域 +
§6 补行 + §15 改写）、3（ADR 0026 引文更正）全部兑现。按门禁规则（#436 判例原文）：「计划完整
⇒ 允许 clear，但必须 requiresConflictRecheck: true」。

## 7. Hard conflicts

**无。** iteration 0 已裁定无 hard-conflict（合法修订路径存在且完备）；iteration 1 把该路径
落成具体计划（文件/文案/授权/纪律齐备），「实现改变 ADR-0007 条款 1/4(ii) 所陈述契约而不带
显式修订」的潜在硬冲突形态在计划层面已被封死（同变更集纪律 + §12 判据 5 + §13 风险行
「注记欠账」+ 豁免仅 Controller 明示）。行为面与 ADR 0034 决策 1–6 逐条相容（承继 iteration 0
§3，SA2 源码逐点核验佐证）。

## 8. Required actions

1. **同变更集纪律（实现期，阻塞转绿条件）**：ADR-0007「ADR 0034 修订注记」追加与 fast path
   实现**同一变更集**交付（设计 §7.6 纪律节 + §12 判据 5 已承诺；先例 `ca0ab53`）——实现后
   复查以 `git diff` 核对注记与实现在位且无次序分离。
2. **实现后冲突复查清单**（= requiresConflictRecheck 承载，沿 iteration 0 §8.5 + 设计 §15）：
   ① 注记最终文案与 ADR-0007 条款 1（L72–78）/4(ii)（L100–107）/7（L121–124）原句、ADR 0034
   决策 1–4、ADR-0010 L345–347 引句的一致性——含 ADR-0010 句面零漂移、0033 注记作用域句
   （L137–139）与新注记的自洽（新注记为时序在后的显式修订，作用域以新注记为准且其明示的
   保持面与 0033 注记枚举的差额恰为本次修订的两类边界）；② 同变更集 git diff 核对；③ 若实现期
   触发测试重锚应急模板（§10），重锚 diff 恰为授权链注释/锚定载体迁移、断言语义面零放宽；
   ④ fast path 管线本身不要求重查（iteration 0 §3 行为面已核毕，iteration 1 未动本体）。
3. 无新增阻塞项。iteration 0 Required actions 1–3 已兑现（本报告 §6 验证），action 4 即本轮
   复审本身，action 5 并入上文清单 2。

## 9. Verdict

**clear** —— 全部对照项为 no-conflict 或 implements-existing-decision（承继 iteration 0 行为面
裁决），唯一 evolution-required 项（ADR-0007 issue #237 修订节条款 1/4(ii)/7 的 Record 位/delete
父位字面）已有**完整同变更集修订计划**：§7.6 七要素 7/7 全过（本审对三处条款行号/引文、
0033 注记先例结构、`ca0ab53` 同 PR diff、`0a91f14` 缺位、陈旧面恰一处扫描逐项独立验证吻合），
并标记后续实现期复查。iteration 0 reject 的阻塞缺口（注记计划缺失 + DENY 封死修订路径）与
非阻塞引文错误均已解除。`approve` 不是 SA8 verdict；方向合法性见 §7。

## 10. requiresConflictRecheck

**true** —— ① 规范性文档修订（ADR-0007 修订注记）已计划但**尚待实现期落地核对**：注记最终
文本与条款原句/ADR 0034/ADR-0010 引句一致性 + 同变更集 git diff（§8 清单 ①②）；② 失败语义
边界移动（E201 检出面收窄到目标键位）虽是 ADR 0034 决策 3/4 已接受取舍，仍属「写后验证防线
覆盖面」语义变化，实现后确认 ADR-0007 注记/ADR-0010 后备句/CONTEXT L144/L202 与实现行为无
残留矛盾；③ 若触发测试重锚应急模板，断言面零放宽须实现后复核。
