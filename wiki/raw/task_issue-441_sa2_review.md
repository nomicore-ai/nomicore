# SA2 设计评审 — issue #441：doc-runtime Record/parent fast path 接线与 S9 收窄（ADR 0034）

- 评审对象：`wiki/raw/task_issue-441_design.md`（SA1，**iteration 1**——本轮为对 iteration 0 reject
  （F-SA2-1 / F-SA2-2）修订稿的复审；dispatch 焦点 = 冻结探针 finding 的解决 + 全设计正确性）
- Verdict：**approve**（iteration 0 两项 MAJOR 均已可执行地落实并经本轮独立源码复核证实；
  无新增 BLOCKER/MAJOR；4 项非阻塞观察登记于 §14）
- 评审 HEAD：`3fd6aa8b659420fd63d07b051139fe5f279556b8`（= 设计/SA6 契约/SA8 报告声明 HEAD，
  `git rev-parse` 核对一致；worktree `mabf/issue-441`，`packages/*/src` 零改动）
- requiresConflictRecheck：**true**（iteration 1 新增规范文档修订面——ADR-0007 追加注记属
  ADR 文本编辑，其落地文本与条款 1/4(ii)/7、ADR 0034、ADR-0010 L345–347 的一致性须实现后
  复核；与设计 §15 / SA8 §10 的自立登记同向，见 §5/§14-N1）

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-441.md`（任务简报，issue #441 正文 + AC1–AC6，comments = 空） | 已读 |
| `wiki/raw/task_issue-441_design.md`（SA1 **iteration 1**，683 行全文） | 已读（逐节） |
| `wiki/raw/task_issue-441_sa6_contract.md`（approved 契约：18 红 + 27 负控 + 探针 49 项；§12.2-8/L301/L364「探针 exit 0 不变」句定位核对） | 已读（相关节全文） |
| `wiki/raw/task_issue-441_design_conflict_report.md`（SA8 设计后复审 reject：1 项 evolution-required + Required actions 1–5） | 已读（全文） |
| `wiki/raw/task_issue-441_sa6_capability_probe.mts`（49 项 check，逐 check 与 §12.1 分类对齐核验：12 翻转 + 37 保持；全部行号锚点对齐） | 已读（全文） |
| `packages/doc-runtime/test/issue-441-record-fastpath-{contract,control,fixture}*.ts`（契约 `it()` 计数复核 = FA1–FA11+FB1–FB3+FC1–FC4 = 18；NA1–NA5+NB1–NB5+NC1–NC11+ND1–ND6 = 27；夹具 `summarizeThrown(undefined).fatal===false`、`capture` 未抛返回 undefined、`obj: {req: string; opt?: number; unk: unknown; deep: …}` 形态核对） | 已读（关键面全文） |
| `docs/adr/0034-record-and-parent-elementwise-validation.md`（母法；决策 4 标题「（扩展 ADR-0010 issue #237 修订节）」核对） | 已读（全文） |
| `docs/adr/0033-elementwise-yarray-mutation-validation.md`（数组先例；决策 4 标题「（修订 ADR-0010 issue #237 修订节的数组含义）」核对） | 已读（关键节） |
| `docs/adr/0007-logical-validation-and-yjs-runtime-bridge.md`（issue #237 修订节条款 1/4(ii)/7 原文 L72–124 + ADR 0033 修订注记 L126–140；文件共 140 行，注记即文件末尾；git log 最后改动 = `ca0ab53`（#434），#438 未触碰） | 已读（相关节全文） |
| `docs/adr/0010-hub-peer-websocket-ydoc-replication.md` issue #237 修订节（后备句 L345–347；授权链引 ADR-0007 损坏条款为单一真相源） | 已读（相关节） |
| `docs/adr/0026-*.md`（L30 批内路径互不嵌套 / L36 最小 edit / L41 操作失败聚合零写入；无 §7.5.2——SA8 Required action 3 引文更正的事实面核对） | 已读（相关条款） |
| `CONTEXT.md` L144「重建校验」/ L202「复制未校验」（两词条均已含「自 ADR-0034 起」目标态立法句，逐字核对） | 已读 |
| `wiki/raw/task_issue-436_design.md` §7.6（ADR-0007 注记先例，获 SA8 clear 的同款结构）/ §7.7（重锚先例） | 定位核对 |
| 陈旧句面独立扫描（复现 SA8 §2 扫描）：`grep -rn "按边界规模\|delete 父位\|delete 的父 map 位" docs/ CONTEXT.md`（排除 0033/0034） | 唯一规范命中 `docs/adr/0007-*.md` L74/L102/L122/L137；CONTEXT L144 命中位于已含 ADR-0034 例外主断言的转引短语内——**独立复现 SA8 结论** |
| 源码：`mutation-local.ts`（record/parent 分支 L266–310 legacy 现状 + L322–374 #436 数组闸门先例 + `carrierMismatchIssue` 已在 import 面）、`mutation.ts`（模块头/L329/L357–361 注释、`composeBatchVerify` 折迭跳过、`commitPrepared` set/delete 支）、`install-verify.ts`（`verifyBoundaryInstallFacts`/`VerifyPlan`/`verifyPrepared`/`verifyBoundaryIntact` 全链）、`validate-patch.ts`（`planMutationBoundary` L742–825：union 冻结 L798–801、delete 终段 L806–809、set 升边界 L815–820、数字终段拒 L756–769；接缝 L1219–1289 四条件闸门；`judgeClosedObjectDelete` L1178–1195；`EntryCarrierFacts` L1161）、`packages/vfsl/src/index.ts`（`applyElementwiseEntryMutation` + 类型公共导出在位） | 已读（设计引用锚点逐一对齐） |
| `task_issue-441_relevant_decisions.md` / 前置 `_conflict_report.md` | 不存在（`ls wiki/raw` 核对；与设计 §0/§6 声明一致——SA8 约束面由设计后冲突报告承担） |

## 2. Verdict

**approve**。iteration 0 的两项 MAJOR 已按 finding 的 Required change 逐项落实且质量高于最低要求：

- **F-SA2-1（探针判据）**：§12.1 把探针重新定性为实现前（HEAD 时点）遗产证据，给出 **49 项
  check 的逐项实现后分类（12 翻转 + 37 保持）**——本轮经探针源码 + 夹具语义逐项独立复核
  **完全成立**（含对我方 iteration 0「13 项」枚举的 G1h 更正，见 §12）；§12 实现后判据枚举 1–5
  不含探针、全部可满足；判据 6 把探针复跑转为精确的一次性确认信号（exit 1 ∧ 失败集恰为 12 项
  命名子集）；§11 DENY 探针行重写为如实陈述；「新探针须另行命名」路径在位。
- **F-SA2-2（规范文档矛盾）**：采 finding 选项 (a)——§7.6 完整注记计划（陈旧面表/落点/授权链/
  建议文案/不变面/同变更集纪律/ADR-0010 处置/七要素自检）+ §11 有界 ALLOW `docs/adr/0007-*.md`
  + DENY 理由改如实；三处陈旧句面（条款 1 L72–78 / 4(ii) L100–107 / 7 L121–124）与 ADR-0010
  处置（0033 标题点名先例逐字同构）均经原文核对成立；同时兑现 SA8 evolution-required 与
  Required actions 1–2，Required action 3（ADR 0026 引文）已更正。

核心双轨设计（闸门双条件合取 + F1–F5 镜像 #436 + 复用 #440 接缝与 #436 `install-facts` +
批量零代码继承 + 零写入）在 iteration 0 已经源码逐点核验为健全，本轮未动其本体，锚点复核全部
仍然对齐。无新增 BLOCKER/MAJOR。

## 3. 需求覆盖

| Requirement | Design section | Assessment |
|---|---|---|
| AC1 闸门分流（非 union Record/封闭对象 delete fast；union map 位 legacy；Record 值位 union 仍 fast） | §7.2 闸门 + §7.3 F1–F5 | 覆盖（iteration 0 已核验：union 位规划层冻结 kind=`union`（L798–801）结构不可达本分支（P1d/P1i）；值位 union 不入闸门条件（P1e；`descendValues` 归一化）；本轮锚点复核一致） |
| AC2 不再提取/重建整 map（与 n 解耦） | §7.3 F1–F5、§12 FB1–FB3 | 覆盖（fast 轨对目标 map 读 = F2 `has` ×1 + S9 `get`/`has` ×1；`buildDetachedValue`/`descendStructureNode` 零 live 读） |
| AC3 commit 的 update 事件形态不变 | §7.4（`commitPrepared` set/delete 两支零改动，源码复核）+ ND1–ND6 | 覆盖 |
| AC4 零写入、零 update | §9.1（一切拒绝先于 `transactGuarded`）+ NC 组 | 覆盖 |
| AC5 S9 收窄（仅安装事实核；legacy 双核不变；E201 变体语义保持） | §7.5（复用 `VerifyPlan.install-facts`；`install-verify.ts` 零改动） | 覆盖（`verifyPrepared` 判别联合穷尽分派源码复核） |
| AC6 包测试 + 根 gates 绿 | §12 判据 1–4（**探针已移出判据**，见 §12） | 覆盖且判据全部可执行可满足 |
| （iteration 1 新增）规范文档一致性 | §1 目标 7 + §7.6 + §12 判据 5 | 覆盖（F-SA2-2/SA8 落实，见 §5/§11） |
| 非目标（union 位/封闭对象 set/`set([])`/数组轨/新公共导出/异步审计/前像捕获/SA6 固定面不修改） | §1 非目标 + §11 | 与 ADR 0034「不做什么」逐条一致，无静默扩大；探针/契约三件套禁改纪律明示 |

## 4. Owner评论覆盖

Host 明文「Current REST comment read returned no comments, so there are no owner-comment
requirements」；简报 Comments 段为空（L38–39）；SA6 §2、SA8 报告（「Issue REST comments：空」）
同结论。设计 §4 如实映射并四源交叉印证。**无遗漏**。

| Comment ID | Updated at | Design section | Assessment |
|---|---|---|---|
| （无评论） | — | §4/§7/§12 | 无 owner 追加面；核验一致 |

## 5. 上游事实与SA8约束

iteration 1 起 SA8 约束面由设计后冲突报告 `task_issue-441_design_conflict_report.md` 承担
（其对 iteration 0 的 reject 与 Required actions 1–5 已在修订稿 §14 逐条映射）。逐条核验：

| Fact or constraint | Design response | Assessment |
|---|---|---|
| ADR 0034 决策 1（闸门 + 永久双轨 + 值位 union 不阻断；规划层不动） | §7.2/§7.3；`planMutationBoundary` 零改动 | 落实（planner L742–825 源码复核：产出闸门所需形状无需改动） |
| 决策 1 管线（set 导航+验载体→键 Pattern→新值 schema+构造→单键 commit 旧值不读；delete `has` 拒 no-op；issue 路径逐字节兼容） | §7.3 F1–F5；接缝 rebase `[...plan.prefix, ...issue.path]`（L1286） | 落实（消息字面量单源：接缝与 `validate.ts` 同源，源码复核） |
| 决策 2（封闭对象 delete 静态必填判定） | §7.3 F3 消费 `judgeClosedObjectDelete`（L1178–1195：optional 先查 → `unknown` 标量跳过 → 必填 `缺少必填字段 "<key>"`） | 落实（源码逐字核对） |
| 决策 3（S9 收窄；E201 变体语义不变） | §7.5 复用 `install-facts`；E201-C/D 构造器共享（`verifyBoundaryInstallFacts` 源码复核） | 落实 |
| 决策 4（触达面 = 载体 + 目标键位；载体位仍响亮拒绝；**标题点名「扩展 ADR-0010 issue #237 修订节」**） | §7.3 F1（`carrierMismatchIssue` 共享构造）+ **§7.6 ADR-0007 注记计划 + ADR-0010 标题点名处置** | 落实（决策 4 标题原文核对：确只点名 ADR-0010——设计据此刻画 ADR-0007 需显式注记 / ADR-0010 无需注记的分界，与 SA8 §3/§4 裁决一致） |
| **SA8 evolution-required：ADR-0007 条款 1（L72–78）/4(ii)（L100–107）/7（L121–124）字面与实现行为矛盾，修订计划缺失 → reject** | §7.6（陈旧面表三行逐字对应原文 + 建议文案 + 授权链 + 不变面 + 同变更集 + 七要素自检表）+ §11 ALLOW 有界纳入 + §6 三行 + §12 判据 5 + §15 ①② | **已落实并核验**：三处陈旧句面原文逐字核对成立；注记落点（紧随 L126–140 的 0033 注记之后 = 文件末尾，文件共 140 行）成立；授权链（ADR 0034 决策 1–4 已接受 + `docs/AGENTS.md` 两义务句 + `ca0ab53` 先例）成立且无需新增 Owner 裁决（comments = 空，SA8 §4 已裁定 override 权威）；七要素对照 SA8 §6 标尺逐项 ✓ |
| **SA8 对 ADR-0010 的 no-conflict 裁决**（后备句 L345–347；0033 注记末句先例「该节已被其标题点名，无需另行注记」） | §7.6 末段 + §15 ① 复查 | 落实且处置精确：ADR 0033 决策 4 标题「（修订 ADR-0010 issue #237 修订节的数组含义）」与 ADR 0034 决策 4 标题「（扩展 ADR-0010 issue #237 修订节）」同构（两处标题本轮均核对）；建议注记文案末句镜像 0033 注记句式（Record/父位含义同步 + 无需另行注记） |
| CONTEXT.md L144/L202 词汇层 | §6（零改动声明） | 成立（本轮逐字核对：两词条均含「自 ADR-0034 起」目标态句——`0a91f14` 已立法；L144 的「见 ADR-0007 issue #237 修订节」转引短语随注记落地自洽） |
| `docs/AGENTS.md` 两义务句 | §7.6（注记为默认交付物；豁免仅 Controller 明示且实现报告记录） | 兑现（SA8 Required action 1/2） |
| ADR 0025/0026（guard 先于逐操作 prepare；批内路径互不嵌套 L30；最小 edit L36；失败聚合零写入 L41） | §6 行 + §7.5 批量面引 L30 | 落实；**SA8 Required action 3 引文更正已核验为真**：ADR 0026 无 §7.5.2，「组合期望边界」系 issue #350 设计 §7.5.2 / `mutation.ts` 折迭机制产物——修订稿 §6/§7.5/§15 引实条款 L30/L36/L41 |
| SA6 契约 §3/§12.1/§12.2（含 **§12.2-8「探针 exit 0 不变」半句与探针自身断言不相容**） | §6 行如实登记 + §12.1 消歧（绑定判据以 §12 枚举为准） | 落实（半句定位核对：契约 L301 与 L364 两处；处置路径正当——固定工件不可改，消歧经设计正文 + 本评审背书，见 §12） |
| 仓库其余规范文档自洽性（SA8 §2 独立扫描「唯一规范命中 ADR-0007」） | §11 DENY 理由 | **本轮独立复现该扫描**（grep 同款关键词，排除 0033/0034）：结论一致——DENY 理由与事实相符 |

## 6. 设计内部一致性

- **iteration 1 修订摘要四项与正文逐一对齐**：①探针重定性（§12.1 + §12 判据 6 + §11 DENY 行
  重写 + §13 风险行——四处口径一致，无残留旧判据；grep「exit 0 不变/按目标行为断言/仍全命中」
  仅剩引用/消歧语境）；②§7.6 注记计划（与 §6 三行、§11 ALLOW 行、§12 判据 5、§13 风险行、§15
  ①② 五处引用同一计划，无分叉）；③ADR 0026 引文更正（§6/§7.5/§15 三处一致）；④O-1/O-2/O-3
  登记（§13 逐字收录 iteration 0 §14）。
- 行号锚点复核全部对齐：`mutation-local.ts` L266–310 / L322–374、`mutation.ts` 注释三处与
  `commitPrepared`、`install-verify.ts` 全链、`validate-patch.ts` L756–769/L798–801/L806–809/
  L815–820/L1178–1195/L1219–1289、探针 12 翻转项行号（L128/134/143/153/161/169/177/185/202/
  321/331/341）与 37 保持项行号（G1h L193、G1j L211、G1k/G1l L225/L235、G3 L273、G3b L286、
  G3c L303、G4d–G4g L351/361/371/382、G5 系 L394–560、S1a/S1b L590/591、NC1–NC3 L602/609/615）、
  探针尾部 exit 逻辑 L620–624。唯一漂移：`packages/vfsl/src/index.ts` 导出行号（设计称 L145/
  L133–145，实际块 L141–157）——非实质（导出在位是断言的实质）。
- **12+37=49 分类独立复核成立**（逐 check 见 §12）；G1h 更正的论据链（断言面仅 `r.ok === false`
  L193 + 夹具 `obj.req: string` 必填 + `judgeClosedObjectDelete` 静态拒绝）三源核实。
- 批量论证（§7.5）与 iteration 0 核验一致：E5 非嵌套 ⇒ 同 map 批内兄弟操作必写不同键 ⇒
  install-facts 互不破坏；折迭输入侧 `parsed` 驱动与 item 的 verify.kind 无关 ⇒ legacy 边界项
  吸收 fast 足迹照旧。`composeBatchVerify` 判别 `verify.kind !== 'boundary'` 对 record fast 项
  跳折迭——零代码改动成立，注释刷新必要性维持（现行注释「fast path 仅产生于 kind=`array`
  计划」实现后失实）。
- 正向确认（维持 iteration 0）：`mutation.ts` 注释-only 刷新为必要项；`§7.7` 备选方案表把
  F-SA2-2 的 (a)/(b) 二选一及采纳 (a) 的理由（义务句非许可 + SA8 Required action 1/2 + (b) 无
  Owner 授权）显式化——决策可追溯。

## 7. 状态机与并发攻击

无新状态机（S3→S4→[fast|legacy]→S8→S9 结构不变）。iteration 0 九个攻击场景结论维持（本轮源码
锚点复核后无变化）：SM-1 批量兄弟异键（E5 结构性保证）、SM-2 混合批量折迭/吸收交叉（parsed 驱动）、
SM-3/SM-4 afterTransaction 窗口（NB 组事实核 / FC 组已确认取舍）、SM-5 整载体替换残余（O-2 登记）、
SM-6 `undefined` 值在场性微观分歧（O-1 登记）、SM-7 闸门 resolve 抛错同 try/同 catch → E204、
SM-8 批量聚合零写入、SM-9 手造槽形态分歧接缝第三锁响亮拒绝（O-3 登记）。iteration 1 未引入
新的状态/并发面（唯一新增交付物是文档追加，无运行时语义）。

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| SM-1..SM-9 | 见上 | 见上 | 与 iteration 0 核验一致 | 无 | — |

## 8. 错误与恢复攻击

iteration 0 七个场景结论维持（源码复核后无变化）：ER-1 载体错位逐字同文案同 path（`carrierMismatchIssue`
共享构造，`mutation-local.ts` 数组先例同款已 import）；ER-2 接缝崩溃 `wrapElementwise` 收编 VFSL-E100
（`validate-patch.ts` L1225 源码核对）；ER-3 构造失败领域 issue；ER-4 S9 偏离/异常 E201-C/D（共享构造器）；
ER-5 拒绝后可见性（字节不变 + 0 update）；ER-6 回滚 = 移除闸门合取 + revert 注记（git revert 单提交，
§9.2 已把注记纳入回滚面——iteration 1 补全）；ER-7 无「跳过验证继续提交」分支。iteration 1 新增
错误面审查：**注记欠账**（实现落地而注记缺失 = 行为与规范文本矛盾的中间态）——§7.6 同变更集纪律 +
§12 判据 5（git diff 可核）+ §13 风险行 + 豁免仅 Controller 明示且须记录，防线完备。

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| ER-1..ER-7 | 见上 | 与 iteration 0 核验一致 | 无 | — |
| ER-8（新） | 注记未随实现同变更集落地 | §7.6 禁止「实现先行、注记欠账」红窗；判据 5 显式核对 | 已缓解 | — |

## 9. 契约影响审查

iteration 0 全表结论维持（本轮抽验锚点不变）：`applyValidatedMutation` 签名/判别联合不变；
`prepareBatchMutation`/`composeBatchVerify` 元素继承双轨（判别已泛化，零代码 + 注释刷新）；
`verifyPrepared` 穷尽分派；读取/物化/替换/建档面零涉及；`@nomicore/namespace-runtime` 测试不锚
record 污染行为；既有 doc-runtime 测试兼容性核查（issue-350 系 TD-1/2/3 均仍 E201-C、
batch-shared-boundary S1–S8、operations L134–135 同消息、fatal-contract W5 已锚 union 数组、
issue-237-red A-1–A-6 不受触）经 SA2/SA8 双重复核成立；update 事件形态不变（ND1–ND6）。

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| （维持 iteration 0 全表结论） | 无 | 本轮锚点复核 | — |

## 10. 架构一致性与惯例审查

### 责任归属
| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| 域规则/逐 entry 判定 | vfsl（#440 接缝，单源） | F3 纯消费 | ✓ |
| 载体事实/导航/构造/提交 | doc-runtime mutation 管线 | F1/F2/F4 + `commitPrepared` | ✓ |
| S9 两轨分派 | `install-verify.ts`（#436 已建） | 纯消费 | ✓ |
| 规范文档修订 | 被修文件内的显式修订注记（仓库惯例） | §7.6（ADR-0007 #237 节内追加） | ✓（先例链核对：ADR-0006 #64/#79、ADR-0008 #93/#132、ADR-0007/0010 #237 节、0033 注记 `ca0ab53`） |

### 相似能力对照
| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| 数组逐元素 fast path（ADR 0033/#436） | `mutation-local.ts` L322–374 | 镜像同构 | 一致 | 逐点比对（iteration 0 + 本轮复核） |
| 逐 entry 接缝（#440） | `applyElementwiseEntryMutation` | 唯一消费方落地 | 一致 | §7.6/§7.7 明确拒绝第二实现源 |
| ADR 修订注记形态 | ADR 0033 注记（`ca0ab53`，#434 spec PR 同变更集）+ #436 设计 §7.6（获 SA8 clear） | §7.6 镜像同款结构（带日期 + 授权链 + 作用域句 + ADR-0010 同步句） | 一致 | 句式/纪律/先例三面对齐核对 |

### 单一事实源
无重复缓存/镜像状态/第二事实源：闸门只消费既有 `plan` + `resolve`；facts 为 prepare 期一次性捕获；
**ADR-0010 后备句继续以 ADR-0007 损坏条款为单一真相源**（注记不另立第二源，仅同步含义）。✓

### 生命周期对称性
无新 acquire/release/subscribe 面；同步单线程入口与单 guarded transaction 不变。✓

### 平行机制检查
| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| doc-runtime 自写单键校验 | vfsl 接缝 | — | 已拒绝（§7.7）✓ |
| 新 S9 核 | `install-facts` 变体 | 复用 | ✓ |
| 第二折迭通道 | `composeBatchVerify` 判别跳过 | 复用 | ✓ |
| 第二套 ADR 修订机制（如新「修订登记册」文件） | ADR 文件内显式修订节惯例 | §7.6 在被修文件内追加 | ✓（不另起平行登记面） |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW：`mutation-local.ts`（闸门 + fast path + 模块头 ADR 0034 段 + 接缝 import） | 与 §7.1–7.3 改造面精确一致；`carrierMismatchIssue` 等符号已在既有 import 面（数组先例），无跨文件扩散 | ✓ |
| ALLOW：`mutation.ts`（注释-only：模块头 + 折迭跳过注释） | 现行注释「install-facts 仅数组项/仅 kind=array」实现后失实；不改任何语句 | ✓ |
| ALLOW：`docs/adr/0007-*.md`（**有界、追加式**：紧随 L126–140 0033 注记之后追加「ADR 0034 修订注记（2026-09-22）」，不重写/不删除既有条款；与实现同变更集；豁免仅 Controller 明示且记录） | F-SA2-2 选项 (a) + SA8 Required actions 1/2；落点为文件末尾（共 140 行，核对成立）；陈旧面恰三处（本轮原文核对） | ✓ |
| ALLOW：设计产物自身 | SA1 固定产物 | ✓ |
| DENY：vfsl / `install-verify.ts` / `index.ts` / 契约三件套 / 探针 / 其余测试 / 0033/0034/CONTEXT/ADR-0010/协议文档 / namespace-runtime / 其余包 | 探针行重写为如实陈述（实现前遗产证据 + 12 项预期翻转 = 确认信号 + 新探针另行命名）；`docs/**` 一揽子 DENY 已解除改为「除 0007 有界追加外」且理由逐项如实（本轮独立扫描复现：其余文档自洽） | ✓ |
| follow-up 面 | §13：异步审计/前像捕获/E8/实现后目标行为探针（另行命名经 Controller/SA6）——不含本票必要项被推诿 | ✓ |

## 12. 验收设计审查

**iteration 0 F-SA2-1 的核心申诉已消除**：§12 实现后判据 1–5（聚焦对 45/45、包 tsc、根 typecheck、
根 test 471 files/5757 全绿、注记同变更集 git diff 可核）全部可执行可满足，探针不在其中。

**§12.1 分类的独立复核（本轮核心工作）**——逐 check 对照探针源码 + 夹具：

- **12 项翻转逐一成立**：G1a/G1a2/G1b/G1d/G1e/G1f/G1i（兄弟或目标位污染在 fast 轨不读 ⇒
  `ok:false` 断言翻 FAIL）；G1c（`Y.Map.has('t2')`=true（raw 写在场）⇒ 照常删除 ⇒ FAIL）；
  G1g（optional 静态允许 ⇒ 删除成功 ⇒ FAIL）；G4a/G4b/G4c（重投影核省略 ⇒ 不抛 ⇒
  `capture` 得 `undefined`（夹具 L162–170）⇒ `summarizeThrown(undefined).fatal === false`
  （夹具 L300–310）⇒ `.fatal` 断言 FAIL）。三处机制语义均经夹具源码核实。
- **37 项保持逐一成立**：P1a–P1i（规划层零改动）；**G1h（L193）断言面仅 `r.ok === false`，
  夹具 `obj.req: string` 必填，`judgeClosedObjectDelete` 静态拒绝（L1184–1194：非 optional、
  非 `unknown` 标量 ⇒ `缺少必填字段 "req"`）⇒ 断言仍成立**——设计对我方 iteration 0「13 项」
  枚举的更正**属实且只收窄不放宽**（finding 实质——探针实现后 exit 1、「exit 0 不变」不可满足
  ——不变）；G1j/G3c（干净写照常成功）；G1k/G1l（F1 逐字复刻 legacy S5 首错，断言含逐字 issue
  JSON）；G3（`check('G3', true, …)` 恒真，报告值变化为观察项）；G3b（直接 map 操作不经管线）；
  G4d（union 永久 legacy 双核）；G4e/G4f/G4g（安装事实核保留，两轨共享单实现）；G5 系 12 项
  （域规则逐字/零写入/commit 字节 oracle/复制面/批量单 update/敏感性反证——全部目标不变面）；
  S1a/S1b（vfsl 纯函数零改动）；NC1–NC3（union legacy）。计数 12+37=49 ✓。
- **判据 6 精确且可满足**：「exit 1 ∧ 失败集合恰为 12 项命名子集 ∧ 探针文件字节不变」——
  偏离即排查信号；SA4/SA7 指令无歧义（「预期 13 见 12」的误读源已被 §12.1 末注消除）。
- **SA6 契约 §12.2-8「探针 exit 0 不变」半句的消歧路径正当**：固定工件不可改（修改即伪绿），
  设计 §12.1 + 本评审共同确立**对 SA4/SA7 的绑定读法 = 设计 §12 判据 1–5 为准、判据 6 为探针
  确认信号**；该半句登记为固定工件内的失实预期，无需 Controller 另行裁决即可执行。

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1–AC5 行为 | 契约 18 红（FA/FB/FC）转绿 + 负控 27 绿（NA/NB/NC/ND）+ 既有 469 files | 无（判据只观察运行时行为；`it()` 计数 18/27 本轮复核） | — |
| AC6 门禁 | §12 判据 1–4（命令面 = 真实 vitest/根脚本入口） | 无 | — |
| 规范文档一致性 | §12 判据 5（同变更集 git diff）+ §15 ①②（注记文本与条款/ADR 0034/ADR-0010 引句一致性） | 无 | — |
| 探针复跑 | §12 判据 6（exit 1 ∧ 恰 12 项命名失败 ∧ 字节不变；非 AC 判据） | 无（iteration 0 的不可满足判据已删除，替换为精确确认信号） | — |
| 防伪绿 | NC/NA 反「放行一切写」、NB 反「删一切写后验证」、G5k oracle 敏感性反证、红灯集合 md5 5 轮稳定（SA6 §13） | 无 | — |

## 13. Required revisions

无 BLOCKER / MAJOR。iteration 0 两项 MAJOR 的处置核验：

| Finding ID | 原严重度 | 处置核验 | 状态 |
|---|---|---|---|
| F-SA2-1（验收判据不可满足） | MAJOR | §12 判据重写（探针移出）+ §12.1 逐 check 分类（12+37=49，本轮独立复核成立，含 G1h 更正属实）+ §11 DENY 行重写 + 新探针另行命名路径 + §13 风险行——finding 的 Required change 五要素（如实陈述/可执行判据/探针不改/新探针新文件/SA4-SA7 无歧义）全部兑现 | **已解决（关闭）** |
| F-SA2-2（规范文档矛盾无处置落点） | MAJOR | 采选项 (a)：§7.6 完整注记计划（三处陈旧句面原文核对 / 授权链 / 建议文案镜像 0033 句式 / 不变面清单 / 同变更集纪律 / ADR-0010 标题点名处置 / 七要素自检）+ §11 有界 ALLOW + DENY 理由改如实（本轮独立扫描复现）——finding 的 Acceptance（不再以「无新决策/新术语」禁改 docs；ADR 0034 决策 4 点名扩展有落点；SA8/冲突复查有裁定对象）全部兑现 | **已解决（关闭）** |

## 14. Non-blocking observations

- **N1（注记落地文本的执行期核对——requiresConflictRecheck 载体）**：§7.6 建议文案本轮逐句
  对照 ADR-0007 条款原文/ADR 0034 决策 1–4/ADR-0010 L345–347 核验为准确，但落地文本由实现期
  写入——须按 §15 ①② 复核（注记最终文本一致性 + 同变更集 git diff）。这是 iteration 1 新增的
  规范文档编辑面，构成本评审提交 `requiresConflictRecheck: true` 的依据（与设计 §15 / SA8 §10
  自立登记同向）。
- **N2（0033 注记作用域句与新注记的层叠读法）**：0033 注记 L137–139「本节其余边界种类（union
  穿越位、Record 位、delete 父 map 位）按本节原文逐字保持」在 0034 注记落地后成为历史性真陈述
  （其日期时点为真），由后日期注记显式取代——与仓库「带日期追加式修订」惯例的时序层叠读法一致，
  无需改写 0033 注记（改写反而违追加式纪律）。§15 ① 已把「L137–139 作用域句与新注记自洽」列入
  复查项。登记供实现与复查知悉。
- **N3（G1h 证据语义变化的说明义务）**：G1h 实现后仍 PASS 但 issue 载荷由 S5 父值载体错位
  （path `["deep"]`）变为静态必填判定（path `["obj","req"]`）——设计 §12.1 已明示 SA4/SA7 不得
  把 G1h 计入预期失败集；本评审复核确认该说明正确且必要（避免「断言绿但证据变了」被误读）。
- **N4（行号微漂移）**：`packages/vfsl/src/index.ts` 接缝导出实际位于 L141–157（设计称 L145/
  L133–145）；探针尾部 exit 逻辑 L620–624（设计称 L617–623）。均为 ±2–4 行漂移，不影响任何
  断言实质；实现期按符号名定位即可。
- **O-1/O-2/O-3（iteration 0 移入，维持登记）**：在场性谓词微观分歧（`undefined` 值键：legacy
  视同缺席 vs fast `Y.Map.has` 在场——ADR 决策 1/2 字面谓词即 `has(key)`，设计忠实母法）；提交后
  整载体替换的静默残余（install-facts 持 prepare 期实例，与 #436 数组轨同形，决策 3 已确认收窄面
  的同构延伸）；手造槽形态分歧呈现为领域 issue 而非 E204（fail-closed 方向，#440 冻结面）。设计
  §13 已逐字登记供 SA4/SA7 知悉，非本票义务。

---

## 附：结论一句话

iteration 1 对两项 MAJOR 的修订均为可执行、可验证的精确落实——探针被正确重定性为实现前遗产
证据并给出经本轮逐项独立复核成立的 12+37 分类（含对我方 13 项枚举的正当收窄更正），ADR-0007
一致性注记计划以有界追加式进入 ALLOW 并兑现 docs/AGENTS.md 义务句与 SA8 全部 Required actions；
核心双轨设计本体未动且锚点复核全部对齐——设计足以安全实施，`approve`（保留实现后 ADR 文本
一致性/同变更集复核，`requiresConflictRecheck: true`）。
