# 冲突门禁报告 — Issue #368 W1（iteration 2：Owner scoped override 复核）

## 1. Reviewed subject: task（前置门禁重裁）

- 被审对象：Issue #368 任务简报（`wiki/raw/task_issue-368.md`）的**前置门禁第 9 项裁定的合法化复核**——iteration 1 报告（`wiki/raw/task_issue-368_conflict_report.md`，verdict **reject**）唯一阻塞项为「Blocked by: None（可立即开始）」vs ADR 0028 时序条款（状态行 L4 + 决策 9 L80），并枚举了 §6-1 合法化路径（Owner 显式 scoped override 评论）。
- 本轮输入增量：Owner 评论 **5652697060**（issue #368，2026-09-13T10:24:57Z）声称按该路径豁免 seam-1。
- 裁决人：ADR Conflict Gatekeeper（SA8，conflict-gate phase，dispatch `sa-65b4f072-f2e4-47ec-a406-54c2af928af1`，iteration 2）。
- Worktree：`/home/wangjian/nomicore-fix-issue-368`（branch `mabf/issue-368`，HEAD `36a73bb`——与 iteration 1 基线**同一提交**；`docs/`、`CONTEXT.md`、`packages/` 对 HEAD 零改动，iteration 1 的 26-ADR 全量盘点结论原样有效，本轮不重开）。
- 程序注记：工作区技能目录无 `sa8-conflict-gate` 技能（与前续所有 SA8 轮次实测一致）；按系统角色定义执行——冲突基准仅 ADR 全集 + CONTEXT.md、只读、唯一产物 = 本报告。

## 2. Override 证据核验（REST，全部实测）

| 核验面 | 事实 | 命令面 |
|---|---|---|
| 评论存在性与身份 | id **5652697060**；author `welltop-jim-wang`；`author_association: OWNER`；issue #368 唯一评论（`comments: 1`） | `GET /repos/welltop-jim-wang/nomicore/issues/368/comments` |
| 时间与不可篡改性 | `created_at` = `updated_at` = **2026-09-13T10:24:57Z**（与派发指令给出的 updated 时间一致；创建后零编辑） | 同上 |
| 覆盖对象明确引用 | 明确点名「豁免 ADR-0027 时序门禁」并引 ADR 0028 决策 9 分层句（L77）、状态行与决策 6 的「实现排 ADR-0027 阶段 T1/T2 之后」（L4/L59–80）为被覆盖条款——满足「Owner 评论明确覆盖具体决策」 | 评论正文 |
| 豁免范围（正向） | 仅 seam-1：#368 全部验收面——载体级选窗原语、条目列表、排序总序、零物化哨兵、三失败码、敌意 options 校验；纯加法、schema 无关；**开工与合入**（挂 Parent PR #367）均豁免 | 评论正文 |
| 豁免范围（负向） | #369（W2 lease 公共面）及以后**不覆盖**——其 schema 通道（元素口径投影文本，ADR 0028 决策 6）确实依赖 #363（T1 渲染器）/#364（T2 readData 文本形态）；#370（W3）亦不覆盖（blocked_by #369/#365） | 评论正文 + 依赖边实测 |
| 范围未扩大（票面稳定） | issue #368 正文与简报快照（10:09:45Z 版）**逐字节一致**（diff 空）；`updated_at` 10:26:53Z 的增量非正文编辑（labels `in-progress`/`feature` 与原生依赖边登记，评论自身引用这些边为证据）。「listed W1 acceptance surface」= 简报六条 AC，锚定不变 | `GET /issues/368` body diff |
| 依赖边实测（活门槛） | **#368 blocked_by = []**；**#369 blocked_by = [#368, #363, #364]**；**#370 blocked_by = [#369, #365]**；T1=#363、T2=#364 均 open，PR #367 open——W2/W3 时序维持由原生依赖边**强制**，与豁免负向范围互证 | `GET /issues/{n}/dependencies/blocked_by` |
| 豁免承重性 | T1/T2 均未落地（`docs/adr/` 无 0027 文件、`packages/vfsl` 无渲染器）→ 无此 override 则时序条款仍阻塞——override 是承重的，非冗余声明 | glob + iteration 1 §2 事实复核 |

## 3. 裁决分析：第 9 项 evolution-required → override-authorized

iteration 1 §3-第 9 项的裁定不被推翻——其推理（时序条款是已接受决策文本、SA8 无权自作限缩解释）**成立且正是本轮合法化的前提**。变化仅在：§6-1 预设的三条合法化路径之一现已由业主实际行使。

| 检验 | 结论 |
|---|---|
| 权限 | `author_association: OWNER`（welltop-jim-wang，即 ADR 0028 与 issue 作者）——合法 override 权威 |
| 明确性 | 显式引用被覆盖条款（ADR 0028 状态行 + 决策 6/9）并声明覆盖其对 seam-1 的适用性——非泛泛「同意开工」 |
| 范围纪律 | 与 iteration 1 §6-1 的预设 scope 逐字吻合：「仅 W1/seam 1；schema 通道与 lease 组合仍排 T1/T2 之后」；W2/W3 由原生依赖边独立把关 |
| 不构成静默矛盾 | 业主选择 override 路径（零文档改动）而非改 ADR——记录在案、可追溯（docs/AGENTS「Amend or supersede explicitly」针对**改文**路径；scoped override 是并列合法路径，且业主声明愿以状态行微调收口，见 §6 注 2） |
| 理由自洽性 | 豁免依据引 ADR 0028 自身分层（决策 9-子弹 1：doc-runtime 原语 schema 无关、比较的是实际数据值；时序条款动机只及决策 6 的 schema 通道）——与 iteration 1 §3-第 9 项「不升级 hard-conflict」的分层观察一致 |
| 合入路径 | 「开工与合入（挂 PR #367）」符合 issue-tracker.md 阶段集成 PR 约定（实现与设计同支累积、阶段收官人工合并）——不产生新的 main 污染面 |

**其余 10 项对照（iteration 1 §3 第 1–8、10、11 项）零变化**：基线文本未动（HEAD 同提交、规范文档零改动），8 项 implements-existing-decision + 2 项 no-conflict 原样承继。§5 冻结面七行（readLogicalValueAtPath 三参签名与无 options 语义——本轮 spot 复核 `packages/doc-runtime/src/read.ts` L118–125 未动；readData options 闭合形状；ValueSchema 9-kind；wire 表面；ADR 0028 v1 词表；doc-runtime 公共面纪律；缺席语义不回渗）全部承继为实现期红线。

裁决分布（本轮）：no-conflict 2 / implements-existing-decision 8 / **override-authorized 1** / evolution-required 0 / hard-conflict 0。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| ADR 0028 状态行 L4 + 决策 9 L80 时序条款（「实现排其阶段之后」对 seam-1 的适用） | Owner `welltop-jim-wang`（REST 评论 5652697060，2026-09-13T10:24:57Z，issue #368 唯一评论，OWNER association） | 仅 #368（W1/seam-1）全部验收面——载体级选窗原语、条目列表、排序总序、零物化哨兵、三失败码、敌意 options 校验；纯加法、schema 无关；含开工与合入（挂 PR #367） | W2（#369）/W3（#370）不在豁免内，时序维持（原生依赖边强制：#369 ← #363/#364，#370 ← #369/#365）；豁免不触碰 ADR 0028 任何其他条款（v1 词表、三码、冻结面照旧） |

## 5. Frozen surfaces

承继 iteration 1 §5 全表（七行），零增删。补充本轮实测：实现尚未开始（`packages/` 对 HEAD 零改动），全部「待实现核对」行仍待实现轮复核。

## 6. Verdict

**clear** —— iteration 1 的唯一阻塞项（第 9 项 evolution-required）已按其自身 §6-1 预设路径合法化：业主 scoped override 评论经 REST 实证（权威、明确、范围精确、未扩大、W2/W3 仍被原生依赖边强制时序）。任务实质与 ADR 0028 决策 2/3/4/5/7/8/9-子弹 1 的逐条一致性质（iteration 1 §3 第 1–8 项）不受影响。**实现派发（SA1 及后续）可以开始**，受 §5 冻结面与 iteration 1 §8-3/4/5 实现期红线约束。

## 7. requiresConflictRecheck

**true**。三个触发条件（任一发生即重开）：

1. **实现后符合性复核**：W1 新增公共 API（仅经 `src/index.ts`、公共面守卫测试逐导出记账）、`WINDOW_*` 失败码族、ADR 0028 v1 冻结词表实现符合性、`WINDOW_TARGET_ABSENT` 不吸收语义不回渗 `readLogicalValueAtPath`（iteration 1 §5 末三行「待实现核对」）——实现轮门禁按仓例重开；
2. **决策基线漂移**：ADR 0028 + CONTEXT 词条仍在分支局部基线（提交 `36a73bb` 仅在 `origin/adr0028-window-read`，PR #367 OPEN）——若 PR #367 改稿（含业主评论末段预告的状态行微调「schema 通道组合面（W2+）排其阶段之后」），须按新文本重跑；该微调若落地为「限定表述」则与本 override 同向收敛，不构成新冲突面，但仍须文本对账；
3. **范围越界**：实现或后续派发若超出豁免正向清单（触 W2 lease 公共面 / schema 通道 / readData options），override 不再覆盖，时序条款即时恢复适用。

## 8. 事实性注记

1. **豁免与 ADR 微调的关系**：业主评论末段声明「若后续 SA8 复核仍要求 ADR 面措辞对齐，业主将以状态行微调收口，不影响本豁免效力」。本轮裁定**不要求**该微调（scoped override 即完整合法化路径，§6-1 原文「零文档改动」）；微调为业主自选收口动作，落地时按 §7-2 对账。
2. iteration 1 报告不被撤销：其 §3 第 1–11 项对照、§5 冻结面、§8 实现期红线、注记 3（non-finite 排序边角归 SA1 钉死）与注记 4（等价锚对账基 = `readLogicalValueAtPath(项路径, 同 options)`）全部继续有效；本轮仅改写其第 9 项处置与 verdict。
3. 评论核验：issue #368 REST comments 长度 1（即 override 评论本身）；本轮未做任何 issue 评论或标签操作（Owner 评论即业主记录，无需 SA8 回帖）。

Verdict: clear
