# 冲突门禁报告 — Issue #368 W1: doc-runtime 载体级窗口原语（ADR 0028）

## 1. Reviewed subject: task

- 被审对象：Issue #368 任务简报（`wiki/raw/task_issue-368.md`）——`@nomicore/doc-runtime` 新增载体级确定性窗口原语（排序项 WindowTerm / 统一条目列表 / 组合式 depth / 排序总序 / 零物化 / 三失败码 / 敌意 options 校验）+ 六条验收标准 + 「Blocked by: None（可立即开始——载体层原语与 ADR 0027 阶段零依赖）」。
- 阶段：task 前置门禁（SA 派发前）。
- 裁决人：ADR Conflict Gatekeeper（SA8，conflict-gate phase）。
- Worktree：`/home/wangjian/nomicore-fix-issue-368`（branch `mabf/issue-368`，HEAD `36a73bb`）。

## 2. Inputs and decision set

- 输入：任务简报全文；Issue #368 正文（author welltop-jim-wang，2026-09-13T10:06:26Z 创建；**评论数 0，REST comments 端点返回 []，无 Owner override 评论**）；PR #367（Parent，OPEN 未合并）；spec issue #366 与依赖阶段 issue #363/#364、PR #362（均 OPEN，作意图佐证，非决策基准）。
- 决策基准：`docs/adr/` 现存全部 **26 个 ADR 逐个盘点**（0001–0014、0016–0026、0028；编号 **0015 与 0027 空缺**——0027 被并行阶段 PR #362 占用、文件不在本 worktree）+ 根 `CONTEXT.md` 全读 + `docs/protocols/instance-replication-v1.md`（W1 零 wire 接触）+ `packages/doc-runtime/AGENTS.md`（模块明确收录决策）。
- 源码事实（仅确认现状，不作独立基准）：`packages/doc-runtime/src/read.ts`（readLogicalValueAtPath 三参形态、E1 缺席吸收、plain 域 JSON 值域响亮失败、预算零物化哨兵先例）；`packages/vfsl/src/` 无投影文本渲染器。
- 被 superseded 的条款不计入约束：ADR 0007 的 open/read 编排与 schema-aware read（已被 ADR 0008 取代）。
- 出处注记：ADR 0028 + CONTEXT 两词条的提交 `36a73bb` 仅存在于 `origin/adr0028-window-read`（PR #367 OPEN，未进 origin/main）——本门禁按 worktree 当前文本为决策集（门禁纪律），总控需知悉该决策基线是分支局部的。

## ADR 盘点

| 编号 | 标题 | 状态 | 相关 | 对照结论 |
|---|---|---|---|---|
| 0001 | VFSL 文本唯一真相源 | accepted | 否 | W1 不触 schema 文本/方言 |
| 0002 | 全新重写，authority 出范围 | accepted | 否 | 不涉旧 authority 规则 |
| 0003 | 求值器与派生 schema | accepted | 边界 | ValueSchema 9-kind 冻结联合零接触（窗口值形态是传输形态，ADR 0028 决策 3） |
| 0004 | vfsl-protocol 类型投影 | accepted | 否 | W1 schema 无关，零类型面接触 |
| 0005 | 投影生成管线 | accepted | 否 | 同上 |
| 0006 | 持久化 DocPersistence | accepted | 否 | 零持久化接触 |
| 0007 | 逻辑校验与 Yjs Runtime Bridge | accepted（open/read 被 0008 取代） | 否 | 残余条款（validation/mutation/observer 纪律）不涉读原语加法 |
| 0008 | NamespaceRuntime 读写能力与单序列器 | accepted（经 0024 修订） | 是 | L20 schema 无关载体投影读域 + L229 签名冻结——W1 同域姊妹加法，不改签名 |
| 0009 | Registry、租约与 Host 生命周期 | accepted | 否 | W1 不触 lease 公共面（那是 W3） |
| 0010 | Hub/Peer 复制 | accepted | 否 | 零 wire 接触 |
| 0011 | best-effort 诊断变更日志 | accepted | 否 | 读原语零日志面接触 |
| 0012 | 实例身份与 plugin 所有权 | accepted | 否 | — |
| 0013 | chunked live update | accepted | 否 | 「窗口」命中为 in-flight 槽语义，无关 |
| 0014 | JSONL/sidecar 日志格式 | accepted | 否 | 「窗口」命中为崩溃窗口语义，无关 |
| 0016 | readData 语义 schema 投影 | accepted（经 0024 修订） | 是 | L82 doc-runtime 保持 schema 无关、三参签名无 options 逐字不变——W1 遵守 |
| 0017 | schema 生命周期元数据 | accepted | 否 | — |
| 0018 | peer schema re-arm | accepted | 否 | — |
| 0019 | VFSL 联合成员文档 | accepted | 否 | — |
| 0020 | VFSL 数值约束 | accepted | 否 | — |
| 0021 | VFSL number 值域收窄 | accepted | 边界 | 见注记 3（non-finite 排序边角为决策文本空白，非冲突） |
| 0022 | chunked sync transfer | accepted | 否 | — |
| 0023 | Proxy 可包装冻结服务表面 | accepted | 否 | 影响包不含 doc-runtime；W1 不触 getter 化构造纪律 |
| 0024 | readData 形状预算（含 #359 amendment） | accepted | 是 | 轴语义复用 + options 零改动义务 + 零物化哨兵先例 + READ_OPTIONS_INVALID 先例 |
| 0025 | 条件写 | accepted | 否 | W1 纯读 |
| 0026 | 原子变更信封 | accepted | 否 | W1 纯读 |
| 0028 | 窗口读 | accepted（分支局部） | **核心** | 决策 2/3/4/5/7/8/9-子弹1 = 任务实质的逐条依据；**状态行与决策 9 时序条款 vs 任务「可立即开始」→ evolution-required**（见下） |

## 3. Decision analysis

| # | Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0028 决策 2 | WindowTerm 三形 + dir 缺省 asc + v1 词表（readArray 仅 index；readMap key/单段 field；词表外响亮拒绝） | 简报「排序项」段逐条同义（readArray 语境传 field/'key'、readMap 传 'index'、多段 field 拒绝） | implements-existing-decision | docs/adr/0028-window-read.md L26–35 | 按文实现；词表外组合归 `WINDOW_OPTIONS_INVALID` |
| 2 | ADR 0028 决策 5 | 类型组序 number→string→不可比组恒居尾（无论 dir）；组间序恒定、dir 只翻转组内序；平局锚 key/下标 asc 恒定 | 简报「排序总序」段逐条同义 | implements-existing-decision | 同上 L50–54 | 按文实现；AC「选窗正确性矩阵」锚定 |
| 3 | ADR 0028 决策 3 | 条目列表 `[{index,value}]`/`[{key,value}]`、呈现序 = 有序基之序、值不含容器壳、空容器 → `[]` | 简报「条目列表」段 + AC「条目列表形态」同义 | implements-existing-decision | 同上 L37–42 | 按文实现 |
| 4 | ADR 0028 决策 4 | 每入选项 ≡ 同预算逐项读；`maxChildrenPerNode` 只治理入选项内部；终点宽度由 `n` 治理 | 简报「组合式 depth」段 + AC「组合式 depth 等价（逐字节一致）」同义 | implements-existing-decision | 同上 L44–48 | 等价锚以 `readLogicalValueAtPath(项路径, options)` 为对账基（doc-runtime 层无 readData） |
| 5 | ADR 0028 决策 8 | O(N) 枚举 + field 基每 child 一次单段下钻 + 只物化入选项；未入选项埋毒值必须 ok:true | 简报「成本纪律」段 + AC「零物化哨兵」同义 | implements-existing-decision | 同上 L70–73；ADR 0024 验收 L138 哨兵先例 | 行为哨兵锚定，禁「全量物化再挑」退化 |
| 6 | ADR 0028 决策 7 | 三稳定码（ABSENT 不做缺席吸收 / CARRIER_MISMATCH 载体闭集 / OPTIONS_INVALID）响亮不抛；敌意 options 封闭形状校验零外抛 | 简报「失败三码」段 + AC「三失败码各就各位、敌意 options 零外抛」同义 | implements-existing-decision | 同上 L61–68；ADR 0024 决策 1 L30（READ_OPTIONS_INVALID 敌意纪律先例） | 三码名与语义按文；doc-runtime 层结果形状沿既有判别联合惯例 |
| 7 | ADR 0028 决策 9-子弹1 + ADR 0016 L82 + ADR 0008 L20 | doc-runtime = 载体级窗口原语、`readLogicalValueAtPath` 姊妹、schema 无关；readLogicalValueAtPath 三参签名与无 options 语义逐字不变 | 简报「schema 无关姊妹原语」「纯加法」 | implements-existing-decision | 0028 L77；0016 L82；0008 L20/L229 | 新 API 仅经 `src/index.ts`；不改姊妹签名与语义 |
| 8 | ADR 0028 决策 9 + ADR 0024 决策 1/4 | readData 与 ADR-0024 options 零改动；五键形状不动 | 简报未要求任何 readData/options 改动 | no-conflict | 0028 L79；0024 L22–31/L67–78 | 红线：options 闭合形状与 READ_OPTIONS_INVALID 家族零触碰 |
| 9 | ADR 0028 状态行 L4 + 决策 9 L80（时序条款） | 「schema 通道形态依赖 ADR-0027 交付，**实现排其阶段之后**」；「**实现时序：依赖 ADR-0027 阶段渲染器（T1）与 readData 文本形态（T2）落地**」 | 简报：「Blocked by: None（**可立即开始**——载体层原语与 ADR 0027 阶段零依赖）」——在 T1/T2 均未落地（PR #362/#363/#364 全 OPEN、`packages/vfsl` 无渲染器、`docs/adr/` 无 0027 文件）时立即开始实现 | **evolution-required** | 0028 L4/L59/L80；依赖未落地事实见「Inputs」节；CONTEXT.md 窗口读词条无时序语句 | 三选一合法化（见 §6/§8）：Owner 显式 override 评论 / ADR 0028 时序条款同变更集修订 / 改排期至 T1/T2 落地后；**缺任一路径前不得派发实现** |
| 10 | 模块 AGENTS（packages/doc-runtime） | 「Add public APIs only through `src/index.ts`; public-surface guard tests must account for every export」 | AC「既有测试全绿（纯加法）」 | no-conflict | packages/doc-runtime/AGENTS.md Boundaries 节 | 「纯加法」不得读作「零既有测试文件触碰」——公共面守卫测试须逐新导出记账 |
| 11 | ADR 0028 验收缝 1 | 选窗矩阵 / 零物化哨兵 / 三失败码 / 敌意 options 校验，公共入口行为断言不读实现源码 | 简报前五条 AC 与缝 1 逐条对应 | implements-existing-decision | 0028 L93 | 测试契约按缝 1 兑现 |

裁决分布：no-conflict 2 / implements-existing-decision 8 / evolution-required 1 / hard-conflict 0。

第 9 项裁定理由（为什么不是 no-conflict，也不是 hard-conflict）：

- **不能放行为 no-conflict**：时序条款是已接受决策文本（状态行 + 决策正文双处在场），措辞为无限定的「实现排其阶段之后」「实现时序：依赖……落地」——条文只陈述依赖对象（T1 渲染器 / T2 readData 文本形态），未对 doc-runtime 载体原语（缝 1）作豁免。任务以「功能零依赖」为由主张立即开始，是对条款的限缩解释；SA8 无权替 Owner 作此解释——采纳它等于 SA8 自造 override（技能明令禁止）。佐证严格读法：spec #366「本阶段实现 ticket 须排 0027 阶段 T1 与 T2 落地之后」、PR #367「实现 ticket 待 ADR-0027 阶段（#363/#364）收官后派生」（非决策基准，但同作者同阶段的意图一致）。
- **不升级为 hard-conflict**：任务实质（建什么）与决策 9-子弹 1 逐字吻合，零冻结面破坏、零与任何其他 ADR 不兼容；唯一不兼容点是启动时序 vs 一条可经正式路径轻量修订的排期条款（修订路径存在且不改 W1 实质）。按技能分类学这属 evolution-required——「方向可能合理，但改变已有契约（时序条款），需同变更集修订 ADR 或取得显式 override」。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| —（无） | — | — | — |

- 不存在任何合法 override：Issue #368 评论数为 0（REST 端点返回 []，无 Owner override 评论）；无新 ADR 修订/废弃旧 ADR；无协议版本升级；ADR 0028 自身的演进条款（开放问题节）只登记加法演进位（多字段/嵌套路径/readArray 属性排序/n=0），不含时序豁免。
- Issue #368 正文虽为 Owner（welltop-jim-wang）撰写，但它是被审任务对象本身而非 override 评论；其「零依赖」是事实主张（且该主张针对功能依赖，成立），未显式引用并覆盖 ADR 0028 时序条款——不构成技能定义的「Owner 评论明确覆盖具体决策」。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| `readLogicalValueAtPath` 签名与语义 | 三参 `(doc, path, options?)`；无 options 逐字节现行为；E1 缺席吸收 | ADR 0016 L82（经 0024 修订登记）；ADR 0008 L229；ADR 0028 决策 9（姊妹定位） | 任务纯加法，未触碰——实现后复查核对 |
| readData options 闭合形状与失败码 | depth/maxChildrenPerNode 两轴 + 未知键拒绝 + `READ_OPTIONS_INVALID`；五键成功形状 | ADR 0024 决策 1/4；ADR 0028 决策 9 L79 | 同上 |
| ValueSchema 9-kind 语义联合 | 冻结面零扩展（窗口条目列表是传输形态，不进 schema 口径） | ADR 0003（经 0024 决策 5 引用为冻结）；ADR 0028 决策 3 | 同上 |
| wire / 协议表面 | instance-replication-v1 全部冻结值 | docs/protocols/instance-replication-v1.md（ADR 0010/0013/0022 收录） | W1 零 wire 接触 |
| ADR 0028 v1 词表（W1 自身待实现的既定契约） | WindowTerm 闭合联合 + dir 同项成对；条目两形；总序 + 不可比恒居尾 + 平局 asc 锚；三码名；n 必填 ≥1；零物化；成本界 | ADR 0028 决策 2/3/5/7/8 | 待实现核对（见 §10） |
| doc-runtime 公共面纪律 | 新导出仅经 `src/index.ts`；公共面守卫测试逐导出记账 | packages/doc-runtime/AGENTS.md | 待实现核对 |
| 缺席语义边界 | `WINDOW_TARGET_ABSENT` 不做缺席吸收的分歧**只属窗口原语**，不得回渗 readLogicalValueAtPath 的 E1 吸收 | ADR 0028 决策 7；read.ts D4 现状 | 待实现核对 |

## 6. Evolution requirements

第 9 项（evolution-required）的合法化路径，任选其一：

1. **Owner 显式 override**：Owner 在 Issue #368 留评论，明确覆盖 ADR 0028 时序条款对缝 1（doc-runtime 载体原语）的适用性（scope：仅 W1/seam 1；schema 通道与 lease 组合仍排 T1/T2 之后）——零文档改动；
2. **同变更集修订 ADR 0028**：把状态行与决策 9 的时序条款改为依赖语义的限定表述（如「schema 通道及 lease 组合实现依赖 T1/T2 落地；载体级原语（缝 1）schema 无关、不依赖 ADR-0027 交付物」）。修订计划须含：**修订文件**（docs/adr/0028-window-read.md 状态行 L4 + 决策 9 L80；CONTEXT.md 窗口读词条无时序语句、不需改；PR #367 描述同步）／**新旧语义**（无限定排期 → 依依赖限定的排期）／**兼容与迁移**（纯文档排期条款，零已发布行为、零迁移）／**失败语义**（不变——三码词表不动）／**版本**（docs-only，无包版本影响）／**验证**（`git diff --check`、链接与编号核对、docs/AGENTS 验证门）／**冻结面**（§5 全部保持不变）；
3. **改排期**：W1 的 Blocked-by 修正为 #363/#364（T1/T2 落地）——零文档改动。

**当前任务简报未携带上述任一路径或修订计划 → 按技能规则（evolution-required 计划缺失）verdict = reject。** 计划到位后须 `requiresConflictRecheck: true` 复核文档与代码同变更集、条款语义一致、override 未扩大范围。

## 7. Hard conflicts

无。第 9 项为 evolution-required（理由见 §3 裁决理由）；其余对照项全部 no-conflict 或 implements-existing-decision。

## 8. Required actions

1. 【阻塞】按 §6 三选一合法化时序：Owner override 评论、或 ADR 0028 时序条款同变更集修订（计划完整度按 §6-2 清单）、或 W1 改排期至 T1/T2（#363/#364）落地后——完成前总控不得派发 SA1 及后续实现；
2. 【若走修订路径】修订须与 W1 同变更集，且 PR #367 描述中的「实现 ticket 待 ADR-0027 阶段收官后派生」表述同步对账；
3. 【实现期红线，非冲突】readLogicalValueAtPath 签名/无 options 语义、readData options 闭合形状、ValueSchema 联合、wire 表面零触碰；`WINDOW_TARGET_ABSENT` 的不吸收分歧不得回渗姊妹原语；
4. 【实现期红线】新导出仅经 `src/index.ts`，公共面守卫测试逐导出记账——AC 的「既有测试全绿（纯加法）」允许更新守卫测试以计入新导出；
5. 【交 SA1】注记 3 的 non-finite 排序边角需在设计内钉死（决策文本空白处，非冲突）。

## 9. Verdict

**reject** —— 任务实质与 ADR 0028 决策 2/3/4/5/7/8/9-子弹 1 完全一致（8 项 implements-existing-decision、2 项 no-conflict、0 项 hard-conflict），但「Blocked by: None（可立即开始）」与 ADR 0028 已接受时序条款（状态行 L4 + 决策 9 L80）构成可修正的不一致：T1/T2 均未落地、无合法 override、无修订计划。修复动作轻量且已枚举（§6/§8-1），不要求改动任务的任何实质内容。

## 10. requiresConflictRecheck

**true**。理由：(a) 第 9 项的合法化路径（override 或 ADR 0028 修订）落地后须复核文档-代码一致性与 override 范围；(b) W1 新增公共 API、新失败码族与 ADR 0028 v1 冻结词表的实现符合性（§5 末三行）尚待实现后核对。

## 事实性注记（信息充分性，非冲突）

1. **决策基线分支局部**：ADR 0028 + CONTEXT 两词条的提交 `36a73bb` 仅在 `origin/adr0028-window-read`（PR #367 OPEN）。本门禁按 worktree 当前文本裁决；若 PR #367 在后续轮次被要求改稿（含时序条款），本报告须按新文本重跑。
2. **「姊妹」命名自由**：ADR 0028 只命名了 lease 层两方法（决策 1）与 doc-runtime「载体级窗口原语」的归属（决策 9-子弹 1），未命名 doc-runtime 层 API——命名与结果形状属 SA1 设计自由，受 §5 冻结面与既有判别联合失败惯例约束。
3. **non-finite 排序边角（决策文本空白）**：决策 5 的不可比组枚举为「缺失/null/布尔/容器」，未点名 non-finite number；而 field 基下钻可能读到 NaN/±Infinity（Yjs 载体可持有）。物化侧既有纪律（plain 域 JSON 值域响亮失败、零物化哨兵以「未触及」为 ok）与「组间序恒定」的总序要求共同约束答案空间，但归组（number 组内 vs 不可比组）无条文——SA1 须钉死并回写词条或以设计记录锚定，不得实现期临场发明。
4. **等价锚的对账基**：决策 4 写「每入选项 ≡ `readData(项路径, …)`」是 lease 层口径；W1 在 doc-runtime 层的对账基是 `readLogicalValueAtPath(项路径, 同 options)`——语义同源（ADR 0024 决策 6：runtime 组合两通道），AC「逐字节一致」应锚在所在层的公共入口。
5. 评论核验：Issue #368 REST comments 端点返回 `[]`（长度 0），与简报「Comments」节一致；本次未做任何 issue 评论（Owner 要求）。

Verdict: reject
