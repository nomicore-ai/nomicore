# SA2 设计评审 — issue #383：[ADR 0029] P3 组合面与 lease 类型（缝 2：runtime + registry）

- 被审对象：`wiki/raw/task_issue-383_design.md`（SA1 **iteration 1**，原位修订 iteration 0）
- 评审人：SA2（mabf-sa2，dispatch `sa-69b97b30-aea8-49bd-9f23-d95965869b7b`，iteration 1）
- 评审基线：worktree `mabf/issue-383` HEAD `de2ff55`（与设计自述基线一致——修订期 HEAD 未移动，`git status` 仅 Host wiki 产物，已核实）
- 评审日期：2026-09-16（iteration 1 复审）
- 本轮复审焦点：`F-383-S2-1`（文档对齐范围缺口，iteration 0 唯一 MAJOR）是否完全消解 + 既有实现架构是否零回归 + 修订新增内容的语义准确性

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-383.md`（任务简报，AC1–AC8，评论 REST 快照 `[]`） | 已读 |
| `wiki/raw/task_issue-383_conflict_report.md`（SA8 `clear`；R1–R16 / F1–F11 / A1–A6；`requiresConflictRecheck: true`） | 已读（A6 全文核验：确实只登记根 `AGENTS.md`，其输入清单未含 skills/docs-integration 面——设计 §5.6/§6.2 的陈述属实） |
| `wiki/raw/task_issue-383_relevant_decisions.md`（SA8 决议摘录） | 已读 |
| `wiki/raw/task_issue-383_sa6_contract.md`（SA6 `approve`；B-1–B-15、§12.3 用例组、M1–M7、P1–P6；M5 文档行核验） | 已读 |
| `wiki/raw/task_issue-383_sa2_review.md`（本文件 iteration 0 版：`reject`，MAJOR `F-383-S2-1` + 非阻塞观察 5 条） | 已读（作为修订映射基准） |
| `wiki/raw/task_issue-383_design.md`（SA1 iteration 1，全文 361 行） | 已读 |
| `docs/adr/0029-filtered-window-read.md` §5（双语义权威）、`docs/adr/0028-window-read.md` | 已读（§5 逐句核验：装满判定 / 匹配总数恒不承诺 / 要计数给大 n / ✂ 不装配） |
| `CONTEXT.md`「窗口读」「过滤窗口」词条 | 已读（「过滤窗口」词条双语义全量陈述核验属实——设计援引的措辞权威真实在场） |
| `docs/AGENTS.md`（文档验证门） | 已核（「When code behavior changes, update every normative document whose stated contract changed; documentation-only wording changes must not invent implementation behavior」+「search for stale terminology and contradicted decisions」原文属实） |
| 文档面独立复核：根 `AGENTS.md`（全文 47 行，窗口读陈述仅 L31 一处）、`.agents/skills/nomicore/typed-access.md` L130–189、`.agents/skills/nomicore/SKILL.md`（全文）、`.agents/skills/nomicore/schema.md` L7、`docs/integration/cordis-plugin-hosting.md` L385–429、`docs/integration/app-data-access-skill.md`（L3/L34–37/L45/L57/L83/L110–120/L129）、`docs/integration/external-project-vfsl-codegen.md` L288、`.agents/skills/triage/AGENT-BRIEF.md`、`packages/namespace-diagnostic-log/{README,AGENTS}.md` | 已核 |
| 文档面 grep 独立复现：`kept < total`（全仓 `.md`，排除 wiki//docs/adr//CONTEXT.md，命中恰三文件四处：root AGENTS.md L31、typed-access.md L172、cordis-plugin-hosting.md L409/L412）；`readArray\|readMap`（命中文件全集 = 上述清单 + ADR 0028/0029）；`truncated`（命中文件全集逐一定性） | 已核（与设计 E-11 清单一致，无一遗漏、无一误列） |
| 源码核验：`packages/namespace-runtime/src/window-read.ts`（L150–264、L410–459：入口分支 L161–168、两出口 L172–178、S6 现行结算 L189–197、`CanonicalWindowBudget` L208–210 不携 `n`、白名单 L229–232 恰四键、present-undefined 剥离 L237、`seamWhereNotImplemented` L432–446）、`packages/doc-runtime/src/window.ts`（`WHERE_TERM_LIMIT = 16` 模块私有 L74；`validateWhere` W-4/W-5/非空/≤16/trap 收编锚点） | 已核（HEAD 与 iteration 0 评审时相同——架构保持声明的基础成立） |

输入完备性：无缺失（Owner 评论 REST 快照为空是事实而非缺口；SA6/SA8/上一轮 SA2 产物齐全）。

## 2. Verdict

**`approve`** —— 无 BLOCKER、无 MAJOR。

- **`F-383-S2-1` 完全消解**：四个子项（① D6 范围扩至 typed-access.md + cordis-plugin-hosting.md；② ALLOW LIST 增补；③ SKILL.md/app-data-access-skill.md 缩写引用的补注或显式登记；④ §8 审计对象扩列）全部落实且经独立复核成立；iteration 0 给出的三条接受条件逐条满足（见 §11/§12）。
- **既有实现架构零回归**：修订期 HEAD 未移动；设计 §5.1–§5.5 与 iteration 0 经源码级核验通过的版本语义零变更（仅收编当时请求的观察 1/2/5，均为承载形状点名的澄清与措辞精确化，零行为影响——逐项对源码复核，见 §6）。
- **修订新增内容（文档对齐设计）语义准确**：四文档预期补注的措辞与 CONTEXT.md「过滤窗口」词条 / ADR 0029 §5 逐点一致，零行为发明；「显式登记不改 app-data-access-skill.md」的三点理由全部经文件实读核实（见 §11）。
- 残余 3 条 MINOR 观察（§14），不阻断实施。

`pass`（approve）仅覆盖设计审查；实现与活链路验证仍归 SA4/SA7。

## 3. 需求覆盖

（iteration 0 §3 的逐 AC 核验结论在 iteration 1 全部保持——AC1–AC8 的设计落点 §5.1–§5.5/§8 未变，本轮复核源码锚点仍一一对应。唯一变化的 AC8 文档面：覆盖面从「仅根 AGENTS.md」扩为全量，恰好是 `F-383-S2-1` 的修复，见 §11。）

| Requirement（简报 What to build / AC） | Design section | Assessment |
|---|---|---|
| runtime 十四键面 `readArray`/`readMap` 组合 `where` | §5.1（S6 双语义）、§5.2（S3 五键） | 覆盖（iteration 0 已核，本轮锚点复核不变） |
| S3 canonical 键集白名单同步扩 `where` | §5.2 镜像判据表（W-4–W-13 逐条锚 `window.ts` 行号） | 覆盖；判据表锚点本轮抽查复核一致（W-4 L366–370、W-5 descriptor 长度门、非空/≤16 L380–385、trap 双收编） |
| S6 结算 truncated 双语义与 ✂ 装配规则 | §5.1 伪代码 + 不变量 | 覆盖；伪代码与现行 L189–197 的无 where 分支逐字节等价性保持 |
| lease options 类型面 fail-closed | §5.3（零代码 + Y 组锁边界） | 覆盖 |
| 调用方「找到所有 state == 'claimed' 的 task」并正确读出截断信号 | §10 调用方矩阵（含第 7 行文档读者面） | 覆盖；**本轮新增**：矩阵把「消费方指导文档的读者」列为显式受影响调用方并给出文档面处理——iteration 0 的缺口正是这一行 |
| AC1–AC7 | §5.1–§5.5 + §8 对应组 | 覆盖（同 iteration 0，零变化） |
| AC8 测试先例 + 全仓门 + 文档对齐 | §8 + §7 | 覆盖；文档面验收从单一 git diff 扩为四文档 diff + app-data-access-skill.md 零 diff 核对 + 全仓 grep 门（`F-383-S2-1` ④） |

目标/非目标无静默扩大：§1.3 新增「文档对齐是措辞补全」限定（不发明行为、不改 CONTEXT 词条、不改 ADR）——这是对修复方向的收窄而非扩大，正确。

## 4. Owner评论覆盖

| Comment ID | Updated at | Design section | Assessment |
|---|---|---|---|
| ——（REST 快照 `[]`，无 Owner 评论） | —— | §4 | 无映射义务；Owner 要求以 Issue 正文 AC1–AC8 为唯一载体，逐条落实（§4 表） |

## 5. 上游事实与SA8约束

iteration 0 §5 的逐条核验结论全部保持（A1–A5、F1–F11、R16、B-1–B15、SA6 §12.3.9 事项——设计 §12 仍独立登记 F1/F2/F4 HEAD 颜色实测回填义务，处置不变）。本轮增量核验：

| Fact or constraint | Design response | Assessment |
|---|---|---|
| SA8 A6（原文只登记根 `AGENTS.md` 签名补注，非阻塞） | §5.6 把范围扩至全部陈述该契约的文档（三必改 + 一 gloss + 一显式登记不改）；§6.2 A6 行声明「扩展属 A6 义务的完备化而非冲突」 | **成立**：A6 原文经核验确实只含根 `AGENTS.md`（SA8 输入清单未含 skills/docs-integration 面）；扩展援引的是 A6 自身引述的 docs/AGENTS.md 验证门原则（「update **every** normative document whose stated contract changed」原文属实），方向一致、无冲突；非阻塞定性保持 |
| SA6 M5（文档行：「非阻塞、无测试义务」） | §8 文档对齐行：「无行为测试义务（M5——文档非运行时面，不进 vitest）；git diff 审计对象扩列」 | 成立；与 SA6 M5 原文一致，审计扩展是 `F-383-S2-1` ④ 的落实 |
| E-11（设计 iteration 1 新增的文档面事实清单） | 全仓 grep 独立复现 | **成立**：`kept < total` 全仓 `.md`（排除 wiki//adr//CONTEXT.md）命中恰三文件四处（root AGENTS.md L31 / typed-access.md L172 / cordis-plugin-hosting.md L409+L412）；`readArray\|readMap` 与 `truncated` 的全文件命中集逐一开庭定性（schema.md=元素口径陈述不被缝 2 失真；AGENT-BRIEF/diagnostic-log=同词异义；external-project-vfsl-codegen.md=readData 面冻结）——清单无一遗漏、无一误列（观察 2 的措辞小瑕见 §14） |

## 6. 设计内部一致性

- **架构保持声明核验**：设计头部与 §14 声明「核心实现设计（§5.1–§5.5）零变更」。逐项对照 HEAD 源码（未移动）：§5.1 伪代码（`total === undefined ? kept === canonical.n : kept < total` + ✂ 结构性排除）与 iteration 0 评审通过的版本语义一致；§5.2 判据表、§5.3 零代码、§5.4/§5.5 零改动声明全部与源码锚点吻合（`window-read.ts` L161–168/L168、L172–178、L189–197、L208–210、L229–232、L237、L432–446；`window.ts` L74）。三处增量均为 iteration 0 非阻塞观察的收编（canonical `n` 承载改形点名、L221–254 措辞精确化、`WHERE_TERM_LIMIT` 具名常量），零行为变化。**声明属实，无伪修订**。
- **`canonical n` 承载改形的自洽性**（观察 1 收编）：源码核验 `CanonicalWindowBudget` ok 分支现确为 `{ ok, budget, term }` 不携 `n`（L208–210），L254 必填校验后弃值；设计把 `{ ok: true, budget, term, n: number }` 明示为 ALLOW ①② 预期改动并以 SA6 §12.6 S3 为结构审计锚——正文（§5.1 不变量）、ALLOW（§7 ①②）、审计锚（§8）三处一致，无矛盾。
- **§5.6 内部一致性**：范围依据（docs/AGENTS.md 验证门原文）→ 措辞权威（CONTEXT.md 词条 + ADR 0029 §5）→ 四文档清单（现状失真点均与实读文件逐行对应：typed-access.md L151/L172、cordis-plugin-hosting.md L396/L409/L412–414、root AGENTS.md L31 两签名 + truncated 句、SKILL.md L15 gloss）→ 显式登记不改（三点理由）→ 零改动面（CONTEXT/ADR/app-data-access-skill/其余分支文件）——链条完整、无死引用。
- **§5.7 新增两条备选否决**（「仅改根 AGENTS.md」「内联进 app-data-access-skill.md」）与 §5.6 的裁决一一对应，否决理由援引的规则（docs/AGENTS.md 验证门、app-data-access-skill.md 禁复制纪律 L116）均实读核实。
- **§9/§10 增量**：数据流表新增「文档对齐……对五跳零影响」收尾句（属实——纯文本改动）；调用方矩阵第 7 行（文档读者面）为 `F-383-S2-1` 的直接产物，与 §5.6 一致。
- 未发现死引用、旧 API、前后相反描述或「附录承认但正文未改」的伪修订。

## 7. 状态机与并发攻击

纯同步读路径、零状态迁移；iteration 0 的 SC-1–SC-8 攻击结论全部保持（源码 HEAD 未动、§5.1–§5.5 语义未变）。本轮无新增攻击面——文档对齐不触运行时路径。SC-8（双合法视图值漂移）已按 iteration 0 观察 3 收编进 §8 表后注 + §12 风险行（处置正确：登记为 #369 已接受暴露类、Z 组头注文档化、无新用例无新出口）。

## 8. 错误与恢复攻击

iteration 0 的 ER-1–ER-7 结论全部保持（分层拒绝、透传、零外抛、无半窗、无伪成功——源码锚点复核不变）。文档对齐新增的失败模式只有「补注措辞超出词条/ADR §5」（发明行为）与「漏改某份陈述契约的文档」两种，设计 §12 已列风险行并给出 E-11 清单 + grep 门 + 措辞权威钉死三重缓解——处置充分。

## 9. 契约影响审查

iteration 0 的六行核验结论保持（lease 透传、runtime 签名、compose 模块内、W1 冻结、四键/失败形、类型面）。iteration 0 第 7 行（消费方指导文档——唯一缺口行）**已闭合**：

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| 消费方指导文档（typed-access.md / cordis-plugin-hosting.md 的读者 = 简报点名的截断信号消费方） | 无（已闭合）：§5.6 两文档预期补注覆盖 L151 词表 / L172 双语义 + ✂ 永不装配 + 计数降级 / L396/L409/L412 三点；SKILL.md 路由 gloss 补能力提及；app-data-access-skill.md 经深水区指针（L83/L116 实读核实指向 GitHub nomicore skill 目录）自动继承上游修正 | `.agents/skills/nomicore/typed-access.md` L135–181；`docs/integration/cordis-plugin-hosting.md` L390–424；§5.6 表；§10 行 7 | —— |

## 10. 架构一致性与惯例审查

iteration 0 §10 的全部结论保持（责任归属四行、相似能力对照四行、单一事实源三行、生命周期对称、平行机制三行——源码未动）。本轮增量：

### 文档面的单一事实源（新增核验）

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 截断双语义措辞 | CONTEXT.md「过滤窗口」词条 + ADR 0029 §5 | 四文档补注（措辞限定） | 低：设计钉死「文档仅措辞补全、零行为发明」+ §8 grep 门；app-data-access-skill.md 禁复制纪律（L116 实读核实）防止模板侧第二信源 |
| where 词表/判据语义 | W1 `validateWhere`（doc-runtime） | typed-access.md L151 补注的谓词形态描述 | 低：补注只描述公共 API 形态（与 CONTEXT 词条一致），不复述内部判据 |

评估：通过。文档对齐采用「link to the authoritative source instead of copying its rules」（SKILL.md gloss 不陈述截断语义、语义单源 typed-access.md；app-data-access-skill.md 深水区指针）——与 docs/AGENTS.md 编辑纪律逐条一致。

## 11. 文件范围审查

### `F-383-S2-1` 消解核验（本轮核心）

iteration 0 finding 的四个子项与三条接受条件：

| 子项 | 修订位置 | 独立复核结论 |
|---|---|---|
| ① D6 范围扩至 typed-access.md + cordis-plugin-hosting.md（窗口读节补 `where` + 双语义限定 + ✂ 永不装配；措辞以 CONTEXT.md 词条与 ADR 0029 §5 为权威） | §5.6 表第 2/3 行 | **成立**：两文件的现状失真点描述与实读逐行吻合（typed-access.md L151 词表段/L172 ✂ 段；cordis L396/L409/L412–414）；预期补注措辞与 ADR 0029 §5（L45–53）+ CONTEXT「过滤窗口」词条逐点一致——「kept === n → true 可能还有 / kept < n → false 确定没有」「匹配总数不承诺（total 不上四键面）」「✂ 永不装配」「要计数给大 n」「空数组/超上限/词表外响亮拒绝」「合取语义」全部有权威出处，零发明 |
| ② ALLOW LIST 增补两路径 | §7 ALLOW（typed-access.md / cordis-plugin-hosting.md 两行，预期改动逐条对应 §5.6） | **成立**：ALLOW 行 ↔ §5.6 表行一一对应；root AGENTS.md 原行保留；无 ALLOW/DENY 冲突 |
| ③ SKILL.md L15 与 app-data-access-skill.md L36–37/L129：补注或显式登记不做并给理由 | §5.6（SKILL.md 行 + 显式登记段）+ §7（SKILL.md 入 ALLOW / app-data-access-skill.md 入 DENY） | **成立（拆分处置）**：SKILL.md 做短语级补注（gloss 不陈述截断语义——符合 link-not-copy）；app-data-access-skill.md 显式登记不做，三点理由全部实读核实——⑴ 调用形态缩写（本就省略 depth/maxChildrenPerNode，grep 证实全文件零 `kept < total`/截断语义陈述）；⑵ 其两级纪律 L45/L116/L83 实文把 ✂ 段解读/窗口完整纪律划入深水区并明令「复制一份即制造漂移面」；⑶ docs/AGENTS.md 门只覆盖「stated contract changed」者。DENY 防顺手扩写——闭环 |
| ④ §8「文档（A6）」行审计对象扩列 | §8 末行 | **成立**：审计对象 = 四文档 diff + app-data-access-skill.md 零 diff 核对 + 全仓 grep 门（`kept < total` 排除 wiki//adr//CONTEXT.md 文档面仅剩限定陈述）——与 iteration 0 接受条件逐字对应 |

接受条件复核：

1. 「设计与 ALLOW LIST 覆盖全部陈述该契约的文档」——独立 grep 复现：无条件精确语义陈述恰三处（root AGENTS.md L31 / typed-access.md L172 / cordis L409+L412），三处全在 ALLOW；两缩写引用（SKILL.md L15 / app-data-access-skill.md L36–37/L129）一处补注入 ALLOW、一处显式登记入 DENY。**满足**。
2. 「实现后全仓 grep …… 仅剩带 where 限定的陈述」——已原样采纳为 §8 门。**满足**。
3. 「补注与 ADR 0029 §5/CONTEXT.md 词条措辞逐点一致」——逐点比对完成（见上 ① 行）。**满足**。

### 范围表其余项

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW 生产/测试面（window-read.ts 四项 + runtime.ts 可选注释 + 5 新测试/fixture 路径） | 与 iteration 0 核验一致；SA6 P1–P6 对应保持 | —— |
| DENY 面与正文一致性 | doc-runtime src / registry lease·types·index / runtime index / CONTEXT+adr / app-data-access-skill.md / 既有测试 / 守卫 / 配置——逐条与 §5.3/§5.6 决策一致（新增 app-data-access-skill.md 行理由链完整） | —— |
| DENY 未逐项列举 `.agents/skills/nomicore/{schema,cordis-host,replication}.md` 与 `docs/integration/external-project-vfsl-codegen.md` 零改动面 | 二者由 §5.6「零改动面」声明覆盖 + ALLOW 之外默认不可改；非 ALLOW 冲突 | 无（观察 3，可选补列） |

## 12. 验收设计审查

iteration 0 §12 的全部结论保持（AC1–AC8 ↔ 用例组映射、独立预言机纪律、红绿诚实分类、Y3 纪律、运行器可触发、既有家族零改红、M1–M7、结构审计）。本轮增量：

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| 文档对齐验收（`F-383-S2-1` ④） | §8 末行：四文档 git diff 审计 + app-data-access-skill.md 零 diff 核对 + 全仓 grep 门 + 「与词条/ADR §5 措辞逐点一致（零行为发明）」+「SKILL.md gloss 含 where 能力提及且不含截断语义」 | 无——grep 门与 diff 审计对象覆盖 iteration 0 点名的全部文档面；「gloss 不含截断语义」的可检性由 grep 门天然承载（gloss 行无 `kept < total`） | —— |

## 13. Required revisions

无。`F-383-S2-1` 已消解（§11）；iteration 0 的 5 条非阻塞观察已全部按设计 §14 映射表收编/维持（逐条复核属实：观察 1 → §5.1 承载改形 + ALLOW 点名；观察 2 → §5.2 末条措辞精确化；观察 3 → §8 注 + §12 风险行；观察 4 → §12 维持原文；观察 5 → §5.2 具名常量 + 出处注释）。核心实现设计经两轮源码级核验可安全实施。

## 14. Non-blocking observations

1. **typed-access.md L170 完结性措辞与双语义的轻度张力**：L170 末句「never treat a window as a complete snapshot or a page」在缝 2 后对 where 读不再普适——`kept < n ⟹ truncated:false` 即「匹配集已扫完」，调用方恰可据此判定完备（这正是简报点名的截断信号消费方式）。该句属解读性指导而非结算契约陈述（结算契约在 L172，已被 ② 补注覆盖），且方向安全（最多导致多余的大 n 复核，不会误读信号），故不构成阻断；建议实现票做 L172 补注时允许对 L170 该句加一从句限定（如「with `where`, a `kept < n` window is the complete matched set」），或在 §5.6 登记维持原措辞的理由，避免文档内部「L172 说确定没有 / L170 说永远别当完备快照」的读者困惑。纯措辞完备性，不影响安全实施。
2. **E-11 对 schema.md 的表述略宽**：「`.agents/skills/nomicore/` 其余分支文件（schema.md/cordis-host.md/replication.md）无窗口读契约陈述」——schema.md L7 实际提及窗口读（元素口径投影 + field 基按值排序，服务 schema 作者的口径书写指导），但其所陈述两点在缝 2 后均不变（schema 通道不受 where 影响 = AC2；field 基排序语义不变），零改动处置正确；仅「无窗口读契约陈述」的字面表述过强，准确说法是「无被缝 2 失真的陈述」。不影响任何决策。
3. **DENY 清单完备性小瑕**：`.agents/skills/nomicore/{schema,cordis-host,replication}.md` 与 `docs/integration/external-project-vfsl-codegen.md` 的零改动面仅由 §5.6 声明承载、未入 DENY 表逐项列举（ALLOW 之外默认不可改已足约束）。可选补列以助 SA4 审计；非缺口。

---

### 评审结论路由建议（供 Controller）

- 设计通过审查（`approve`）：`F-383-S2-1` 已完全消解、架构零回归，可进入实现派发。
- iteration 0 的既定事项随实现票延续：F1/F2/F4 HEAD 颜色实测回填 SA6（设计 §12 处置不变）；`requiresConflictRecheck: true` 维持（实现后核对，SA8 §10 / 设计 §13——文档对齐扩展不新增复查事由，本评审无新增 ADR 冲突风险）。
