# 冲突门禁报告 — Issue #368 W1（design 复查：SA1 设计 vs 决策集与 Owner override 范围）

## 1. Reviewed subject: design

- 被审对象：`wiki/raw/task_issue-368_design.md`（SA1 iteration 0 新建设计——`@nomicore/doc-runtime`
  载体级窗口原语 `readArrayWindowAtPath` / `readMapWindowAtPath`，ADR 0028 缝 1）。
- 复查焦点（本轮派发指令）：该设计是否**仍在 Owner scoped override（评论 5652697060，仅授权
  schema 无关的 W1 seam-1 在 ADR-0027 T1/T2 之前开工、排除 W2/W3）范围之内**，以及与 ADR 全集、
  规范文档、任务范围的全部适用约束是否一致。SA8 不重做设计、不评优劣（SA2 职域）、不实现。
- 裁决人：ADR Conflict Gatekeeper（SA8，conflict-gate phase，dispatch `sa-43a1237c-fdf4-41f6-a193-9ec8331e77d1`，iteration 3）。
- Worktree：`/home/wangjian/nomicore-fix-issue-368`（branch `mabf/issue-368`，HEAD `36a73bb`——与
  iteration 1/2 同一提交；`git status` 仅未跟踪产物（SA6 契约测试 + `wiki/raw/task_issue-368*`），
  **tracked 文件零改动** → 决策基线零漂移，iteration 2 §7-2 触发器未命中）。
- 程序注记：`conflict-gate` 技能已加载并按其分类学/报告结构执行；只读复查，唯一产物 = 本报告。

## 2. Inputs and decision set

| 输入 | 用途 |
|---|---|
| `wiki/raw/task_issue-368_design.md`（全文实读） | 被审对象（D1–D11、§8 编排、§9 失败表、§11 文件范围、§12 验收映射、§15 复查自请） |
| `wiki/raw/task_issue-368.md` | 任务简报（issue 正文快照，10:09:45Z） |
| `wiki/raw/task_issue-368_sa6_contract.md` + `packages/doc-runtime/test/issue-368-window-read-contract-red.test.ts`（本轮实读 A/E/F/G 组与 fixture/常量） | 已验收红灯契约（39 红 + 6 绿负控）——设计的验收对账基与 D3 证据链 |
| SA8 iteration 1 `…_conflict_report.md` / iteration 2 `…_conflict_report_iter2.md` | 前置门禁裁定（11 项对照、冻结面 7 行、override 表、注记 3/4）——本轮承继复核 |
| `wiki/raw/task_issue-368_relevant_decisions.md` | 决策摘录（交叉核对用） |
| `docs/adr/0028-window-read.md`（本轮全文重读） | 主契约：决策 2/3/4/5/6/7/8/9、备选、验收三缝、开放问题 |
| `docs/adr/0024`、`docs/adr/0016`、`docs/adr/0008`（经摘录 + 抽查） | 姊妹冻结面与预算轴先例 |
| `CONTEXT.md` L45–46/L57–59（本轮实读） | 「形状预算」「窗口读」词条 |
| `packages/doc-runtime/AGENTS.md`、根 `AGENTS.md`、`docs/AGENTS.md` | 模块公共面纪律与文档权威规则 |
| 源码事实（本轮抽查实读）：`packages/doc-runtime/src/read.ts`（三参重载 L118–125、E1 吸收 L168–191、`validateReadOptions` L326–361、`copyPlainStrict` non-finite 拆支 L723–726、`putKey` L805–810）、`src/index.ts`（9 值导出 + 类型导出）、`src/carrier.ts`（`carrierOf`/`probeRoot` 已导出） | 确认设计 §2 事实锚点（源码只作现状确认，不作独立基准） |
| REST 复证（本轮实跑） | 评论 5652697060：id/作者/OWNER/`created_at = updated_at = 2026-09-13T10:24:57Z`（与派发指令一致，零编辑）、正文逐字；issue #368 open、comments=1、updated 10:26:53Z（非正文编辑）；依赖边 **#368 blocked_by=[]、#369←[#368,#363,#364]、#370←[#369,#365]**；PR #367 OPEN 未合并 |
| `wiki/raw/task_issue-368_sa2_review.md` | **不存在**（设计 §14 声明一致）——本轮无 SA2 评审输入 |

决策集：`docs/adr/` 现存 26 个 ADR（0001–0014、0016–0026、0028；0015/0027 空缺——本轮 `ls docs/adr/`
复核 0027 仍不在场，T1/T2 未落地结论承继有效）+ 根 `CONTEXT.md` + 模块 AGENTS 收录决策。
被 superseded 条款（ADR 0007 open/read 等）不计入约束。iteration 1 的 26-ADR 全量盘点在零漂移
基线下原样承继，本轮不重开，仅对设计新增语义面逐条对照。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（设计） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0028 决策 2（`docs/adr/0028-window-read.md` L24–35） | WindowTerm 闭合联合、`by` 与 `dir` 同项成对、v1 词表（readArray 仅 `by:'index'`；readMap `by:'key'` 缺省或单段 `field`）、词表外响亮拒绝 | D1/B-4（orderBy 冻结**单对象**，演进位保留）+ D11（`IndexWindowTerm`/`KeyWindowTerm`/`FieldWindowTerm` 联合）+ D9 face 词表（数组面 `field`/`by:'key'` 非法、键面 `by:'index'` 非法 → `WINDOW_OPTIONS_INVALID`） | implements-existing-decision | 0028 L27–35；设计 §7-D1/D9/D11；契约 G4/G5（列表非法、语境外拒绝） | 按文实现；face 专属 options 类型只作编译期编码，运行时校验为唯一权威 |
| 2 | ADR 0028 决策 2 注释「`asc = 自 [0] 取`」（L29）× 决策 5（L50–54）× 验收缝 1（L93） | 注释字面（容器下标 [0]）与决策 5 总序机制在数组面的张力 | **D3 钉死**：数组面（缺省/显式 `by:'index'`）排序键 = 项值本身，按类型组总序排列、平局（含不可比整组）按下标 asc 恒定锚、dir 只翻转可比组内序；「自 [0] 取」调和为「自**有序基** [0] 位取」（前缀读法，决策 5「窗口是序列前 n 前缀」） | **no-conflict**（解释性钉死，非契约变更——裁决理由见下） | 0028 L29/L50–54/L93；简报行为要点「排序总序」段（「平局按 key/**下标** asc 恒定」「两方向都先装可比项」——纯索引序永无平局，此句只在值键排序下有效）+ AC1 矩阵；契约 A1–A8 实读复核（`ORDER_VALUES=[5,1,30,'b','A',true,null,{z:1},[7]]` → A1 期望 `[1,0,2,4,3,5,6,7,8]` = 值序、A2 desc = `[2,0,1,3,4,…]` 组间序不翻转、A7 码点序在数组面） | 裁决理由：(a) 决策 5 明文为数组设平局锚（「下标（array）asc 恒定」）——纯索引读法使该条款与「不可比尾组/类型组序」在数组面全部空转，与缝 1 矩阵（基 × dir × 类型组序 × 不可比尾组 × 平局稳定锚）不可同时成立；(b) 前置门禁 iteration 1 §3-第 2 项已裁简报「排序总序」段 ≡ 决策 5（implements-existing-decision），iteration 2 verdict clear 承继，Owner override 正向清单把「排序总序」列入授权验收面；(c) SA6 已验收契约 A 组钉值键序且设计 D1 绑定取契约默认（契约文件零改动红线）；(d) 注释是行内注解而非编号决策条款，前缀读法与其字面兼容。**若 Owner/SA2 后续采纯索引读法，须改契约 A 组与实现并重开本复查——登记 §8-4** |
| 3 | ADR 0028 决策 5 不可比组枚举「缺失/null/布尔/容器」（L52）——non-finite 归组为决策文本空白 | 枚举未点名 non-finite number；NaN 无法参与「数值序」 | **D4 钉死**：`Number.isFinite` 判 number 组成员资格，NaN/±Infinity 一律归不可比尾组、身份 asc 锚、组位不随 dir 变 | **no-conflict**（空白填充，且为 iteration 1 注记 3/§8-5 移交 SA1 的义务兑现） | 0028 L52（枚举）；迭代 1 注记 3（「SA1 须钉死……不得实现期临场发明」）；read.ts L723–726（`copyPlainStrict` 对 non-finite 家族统一 `Number.isFinite` 拆支——包内纪律同构，本轮实读）；SA6 §15-2（契约对排序键 non-finite 无断言，钉死不与契约冲突） | 填充方向与决策 5 的总序确定性（NaN 不可比）、尾组立法目的（脏项不挤正常项）、零物化兼容（分类只用原始读）全部同构；以设计记录锚定（iteration 1 允许的两路径之一），实现轮按 D4 核对 |
| 4 | ADR 0028 决策 3（L37–42） | 条目两形 `{index,value}`/`{key,value}`、身份随行、呈现序 = 有序基之序、值不含容器壳、敌意键免疫、空容器 → `[]` | D6（条目字面量构造、原型 `Object.prototype`、值经姊妹 `putKey` 纪律）+ D11（`ArrayWindowEntry`/`MapWindowEntry`）+ §8.1-A | implements-existing-decision | 0028 L39–42；设计 §7-D6/D11；契约 D1–D5/A6/B3 | 按文实现 |
| 5 | ADR 0028 决策 4（L44–48） | 每入选项 ≡ 同预算逐项读；`maxChildrenPerNode` 只治理入选项内部；终点宽度由 `n` 治理 | D7-M：逐项物化**按字面调用公共姊妹** `readLogicalValueAtPath(doc, [...path, identity], 预算|两参)`——等价锚由构造保证 | implements-existing-decision | 0028 L46–48；iteration 1 注记 4（doc-runtime 层对账基 = 姊妹而非 lease `readData`）；契约 E1–E5 `expectEquivalence`（本轮实读确认锚即姊妹调用） | 按文实现；实现轮核对逐项通道确为公共姊妹同形状调用 |
| 6 | ADR 0028 决策 7（L61–68） | 三稳定码名与语义（ABSENT 不做缺席吸收 / CARRIER_MISMATCH 载体闭集 / OPTIONS_INVALID 规则非法）、响亮不抛、敌意 options/orderBy 封闭形状校验零外抛零 accessor 执行 | §9 失败表（三码名逐字）+ D9 校验规格（镜像 `validateReadOptions` 纪律：plain 宿主、own 键空间 ⊆ 闭集、accessor 非法零执行、descriptor 缺失键忽略、内层 try 收编 trap）+ D7-G1（缺席改判响亮、不与姊妹吸收互渗） | implements-existing-decision | 0028 L63–68；read.ts L326–361（姊妹纪律实读）；契约 G1–G8 | 三码名逐字；敌意校验纪律实现轮核对（G6/G7 accessorRuns===0） |
| 7 | ADR 0028 决策 7 三码词表的边界（入选项物化失败 / 导航纪律失败的码归属——决策未述） | 「稳定码三枚」枚举的是窗口域失败语义，未声明 doc-runtime 层可观察失败联合的完备性 | **D8 钉死**：投影域失败（入选项内不可表示值/detached 项）与导航纪律位（段型不符/终态/值域违规/E100）透传 `PATH_NOT_ALLOWED`（姊妹既有码），不发明第四窗口码、不静默跳项、不冒充 CARRIER_MISMATCH | **no-conflict**（边界解释，非词表变更） | 0028 L63–68（三码语义各自锁定缺席/载体/规则，无「仅此三码」完备性条款）；简报 AC5 与契约 B-5/G8（只锁三码各就各位与互异，无第四码禁令）；NC5（毒值经姊妹物化必 `PATH_NOT_ALLOWED`——透传方向与既有失败语汇同源）；read.ts D8「一切预期失败统一」惯例 | 裁决理由：三枚 `WINDOW_*` 码语义边界保持逐字不变（冻结面不破）；新公共 API 的完整失败联合从未被决策文本枚举，透传复用姊妹投影域码是唯一不扩大 v1 词表、不吞错的读法。设计 R2 已登记为 SA2/SA4 复核焦点——若被否决需 Owner 拍板，**不得实现期静默改**（§8-5） |
| 8 | ADR 0028 决策 8（L70–73） | O(N) 枚举 + field 基每 child 一次单段下钻 + 只物化入选项（O(n×depth)）；未入选毒值必须 ok:true | D7 成本段 + §8.1 E/S/M：O(path) 导航 + O(N) 原始分类 + O(N log N) 全序排序 + O(min(n,N)×depth) 物化；分类只用 typeof/`Number.isFinite`/carrierOf 级原始读 | implements-existing-decision | 0028 L72–73；契约 F1–F5（含 N=2000 规模哨兵，本轮实读确认） | 决策 8 清单是成本**下界义务**枚举而非穷尽禁令；排序 O(N log N) 为确定性全序所必需（设计 R4 登记 partial-selection 为零可观察差异优化，不入 v1）——不构成契约变更。零物化哨兵实现轮核对 |
| 9 | ADR 0028 决策 9-子弹 1（L77）+ ADR 0016 L82 + ADR 0008 L20/L229 | doc-runtime = 载体级窗口原语、`readLogicalValueAtPath` 姊妹、schema 无关；姊妹三参签名与无 options 语义逐字不变 | D2：新文件 `src/window.ts`，`read.ts` **零字节 diff**（既不导出内部助手也不抽取共享模块，助手复制并注明出处）；逐项物化只经公共面调用姊妹 | implements-existing-decision | 0028 L77；0016 L82；0008 L20/L229；read.ts L118–125（本轮实读：双 overload 原样） | 实现轮核对 read.ts 零 diff（iteration 2 §7-1 承继） |
| 10 | ADR 0028 决策 9（L79「readData 与 ADR-0024 的 options 零改动」）+ ADR 0024 决策 1 | readData/姊妹 options 闭合形状与 `READ_OPTIONS_INVALID` 家族零触碰 | D9：窗口 options 是**新独立形状** `{n, orderBy?, depth?, maxChildrenPerNode?}`，不复用不改姊妹校验；`depth`/`maxChildrenPerNode` 轴语义原样（≥0 有限整数、-0 归一） | implements-existing-decision | 0028 L79；0024 决策 1（L22–31）；契约 NC2（姊妹拒 `n`/`orderBy`/未知键实测绿） | 实现轮核对姊妹 options 零触碰（NC2 保持绿） |
| 11 | ADR 0028 状态行 L4 + 决策 9 L80（时序条款：「实现排 ADR-0027 阶段（T1/T2）之后」对 seam-1 的适用） | 时序条款 vs T1/T2 落地前开工 | 设计即为 seam-1 开工产物（设计本身不实现不合并）；§11 DENY 把 `packages/vfsl/**`、`docs/adr/0027*` 列为零接触 | **override-authorized**（承继 iteration 2 §4，本轮 REST 复证未变） | 评论 5652697060（本轮实读：id/OWNER/`created=updated=2026-09-13T10:24:57Z`/正文逐字——豁免仅限 seam-1 开工与合入挂 PR #367）；`docs/adr/` 无 0027（本轮 `ls` 复核）；#369←[#363,#364]、#370←[#369,#365] 依赖边原样 | 设计不触碰 ADR-0027 归属面；override 未扩大（见 #12/#13） |
| 12 | Owner override 正向清单（评论 5652697060）：#368 全部验收面——载体级选窗原语、条目列表、排序总序、零物化哨兵、三失败码、敌意 options 校验；纯加法、schema 无关 | 授权范围 | 设计 §1 目标 1–8 与正向清单逐条一一对应（两值导出 + 类型导出、总序、条目列表、组合式 depth、零物化、三码、敌意校验、纯加法含守卫记账）；schema 无关 = 值排序比较实际数据值（决策 9-子弹 1 同语） | no-conflict | 评论正文（REST 本轮复证）；设计 §1/§7/§12（AC1–AC6 ↔ 契约组 A–H 映射） | 无 |
| 13 | Owner override 负向清单：#369（W2 lease 公共面：`readArray`/`readMap`、四键 `{ok,value,schema,truncated}` 结算、`kept n/total N` 与 ✂ 段、registry 透传、类型别名）及以后不覆盖；#370（W3 schema 通道）不覆盖 | 排除范围 | 设计 §1 非目标逐条排除；D9 成功面**恰两键**（不带 `kept/total/truncated`——不预占 W2 冻结面）；§11 DENY：`packages/namespace-runtime/**`、`packages/namespace-registry/**`、`packages/vfsl/**`、`docs/adr/**`、`CONTEXT.md`、`docs/protocols/**`、wire/持久化/诊断日志；文档面零改动（钉死项以设计记录锚定，§13-R6） | no-conflict | 评论正文；设计 §1/§7-D9/§11；本轮 git status（`docs/`、`CONTEXT.md`、`packages/*/src` 对 HEAD 零改动） | 范围越界即触发 iteration 2 §7-3（override 失效、时序条款恢复）——实现轮红线 |
| 14 | `packages/doc-runtime/AGENTS.md` Boundaries/Verification | 公共 API 仅经 `src/index.ts`；公共面守卫测试逐导出记账；公共类型变更跑 root typecheck/test | D2 + §10 + ALLOW LIST：`src/index.ts` 加法导出；`public-surface-guard.test.ts`/`public-surface-type-guard.test-d.ts` 加法扩展记账（SA6 §10 明示属「纯加法」允许范围） | implements-existing-decision | packages/doc-runtime/AGENTS.md；设计 §2.7/§10/§11 | 实现轮核对新导出仅经 index.ts 且两守卫文件记账 |
| 15 | ADR 0024（轴语义 + `READ_OPTIONS_INVALID` 敌意纪律 + 验收 L138 零物化哨兵先例） | 预算轴纪律与哨兵先例 | D9 校验规格镜像姊妹纪律（本轮实读 `validateReadOptions` 逐条对上：plain 宿主/闭集/accessor 零执行/R1 undefined≡缺席/trap 收编）；F 组哨兵承接 | implements-existing-decision | 0024 决策 1/验收；read.ts L326–361；契约 F1–F5/NC5 | n 边界异于预算轴（n≥1 vs ≥0）——G3 全枚举锚定，不与 0024 冲突（n 是窗口新轴，非预算轴改动） |
| 16 | 简报「多段 field 响亮拒绝」× ADR 0028 决策 2「`field: string`…v1 恰单段」× 开放问题「嵌套属性路径（`field` 段数组）」× 姊妹段纪律（read.ts L16–17「段从不拆分、点号是合法键名」） | field 形态与点号语义 | **D5 钉死**：`field` 非 string（含 `['a','b']`）→ `WINDOW_OPTIONS_INVALID`（= 「多段 field」的数组形态，与开放问题的段数组演进位对位）；字符串值为单段字面键，点号不拆分（沿姊妹段纪律） | no-conflict（解释性钉死） | 0028 L31/L100（开放问题「field 段数组」证明「多段」词指段数组形态）；read.ts L16–17；契约 G4（只断言非字符串形状非法）；SA6 §15-3（契约刻意不锁点号键接受/拒绝） | 设计记录锚定；可选 pins 测试（ALLOW 第 5 行）使其可执行 |
| 17 | 决策文本空白三处：条目空间（Y.Map 显式 undefined 值键、plain object undefined 值键/accessor 键、plain array 稀疏空洞/在界 undefined）、空路径 `[]`、detached 目标载体 | 无条文 | **D6/D7 钉死**：undefined 值键出条目空间（与姊妹 E1 吸收同构、保 Y.Map↔plain object 载体同构 A6/B3）；稀疏空洞归不可比尾组（不可表示 ≠ 选窗失败）；空路径接受（目标 = ROOT，与姊妹 `[]` 同构）；detached Y.Array/Y.Map → `PATH_NOT_ALLOWED`（面符但不可读，沿姊妹 detached 纪律） | no-conflict（空白填充，全部与姊妹既有纪律同构） | read.ts L168–191（E1/D4/D5 现状实读）；契约未测（SA6 §15-4/5/6 刻意不锁）；设计 §7-D6/D7 | 设计记录锚定；W2 开工时对账 R3（`undefined` 值键占位口径）——非本票义务 |
| 18 | `CONTEXT.md` L57–59「窗口读」词条 / L45–46「形状预算」词条 | 词汇基线（lease 层口径的窗口读描述 + 护栏 vs 选择器分工句） | 设计语义与词条同源（WindowTerm/条目列表/总序/三码/n≥1）；doc-runtime 层剥离 lease 四键与 schema 通道（词条中两者均明确属 lease/schema 面）；零词汇改动、零词条回写 | no-conflict | CONTEXT.md L45–46/L57–59（本轮实读）；设计 §1 非目标/§13-R6 | 词条无实现时序语句（iteration 1 已核）；设计不要求 CONTEXT 改动 |

裁决分布：**no-conflict 8 / implements-existing-decision 9 / override-authorized 1 / evolution-required 0 / hard-conflict 0**。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| ADR 0028 状态行 L4 + 决策 9 L80 时序条款（对 seam-1 的适用） | Owner `welltop-jim-wang`（REST 评论 5652697060，`created_at = updated_at = 2026-09-13T10:24:57Z`，issue #368 唯一评论，OWNER association——**本轮 iteration 3 REST 复证逐字未变、零编辑**） | 仅 #368（W1/seam-1）全部验收面，schema 无关、纯加法，含开工与合入（挂 PR #367） | W2（#369）/W3（#370）不在豁免内，时序由原生依赖边维持（本轮复证：#369←[#368,#363,#364]、#370←[#369,#365]、PR #367 OPEN）；豁免不触碰 ADR 0028 其余条款（v1 词表、三码、冻结面照旧） |

- 本轮**无新增 override 需求**：设计的全部钉死项（D3/D4/D5/D6/D7 空路径/D8）都是既有决策文本的解释或空白填充，不需要覆盖任何明文条款（对照见 §3 #2/#3/#7/#16/#17 行的裁决理由）。
- SA8 不替 Owner 或 SA1 创建 override：设计自请的 §15 复查（本轮即兑现）与 R2（D8 若被否决需 Owner 拍板）维持该纪律。

## 5. Frozen surfaces

承继 iteration 1 §5 七行，逐行标注设计侧状态（实现尚未开始——`packages/` 对 HEAD 零改动，本轮 git status 复核）：

| Surface | Must remain unchanged | Evidence | Actual result（设计轮） |
|---|---|---|---|
| `readLogicalValueAtPath` 签名与语义 | 三参 `(doc, path, options?)`；无 options 逐字节现行为；E1 缺席吸收 | ADR 0016 L82；ADR 0008 L20/L229；0028 决策 9 | 设计 D2 承诺 read.ts 零 diff（含不导出内部助手、不抽共享模块）——**合规**；实现轮核对 diff 为空 |
| readData options 闭合形状与失败码 | depth/maxChildrenPerNode 两轴 + 未知键拒绝 + `READ_OPTIONS_INVALID`；五键成功形状 | ADR 0024 决策 1/4；0028 决策 9 L79 | D9 新独立窗口形状、不复用姊妹校验；NC2 绿锚——**合规**；实现轮核对 |
| ValueSchema 9-kind 语义联合 | 冻结面零扩展 | ADR 0003（0024 决策 5 引用） | 设计零 schema 接触（条目列表是传输形态）——**合规** |
| wire / 协议表面 | instance-replication-v1 全部冻结值 | docs/protocols/instance-replication-v1.md | W1 纯 doc-runtime 读原语，§8.2 明示零 wire——**合规** |
| ADR 0028 v1 词表 | WindowTerm 闭合联合、条目两形、总序、三码名、n≥1、零物化、成本界 | 0028 决策 2/3/5/7/8 | D1/D3/D4/D6/D7/D9/D10 逐条实现；三码名逐字；D8 不扩 `WINDOW_*` 词表——**合规**（钉死项裁决见 §3）；实现轮核对 |
| doc-runtime 公共面纪律 | 新导出仅经 `src/index.ts`；守卫测试逐导出记账 | packages/doc-runtime/AGENTS.md | ALLOW LIST 第 2–4 行落实——**合规**；实现轮核对 |
| 缺席语义边界 | `WINDOW_TARGET_ABSENT` 不吸收只属窗口原语，不回渗姊妹 E1 | 0028 决策 7；read.ts D4 | D7 单点分歧 + NC1/G1 成对锚定——**合规**；实现轮核对 |

## 6. Evolution requirements

**无。** 设计不要求修订任何 ADR、CONTEXT 词条或协议文档：

- 时序条款已由合法 override 化解（§4，承继 iteration 2，本轮复证未变）；
- 全部钉死项（D3/D4/D5/D6/D7/D8）为既有文本的解释或空白填充，均以**设计记录锚定**——iteration 1
  §6-1/注记 3 明示允许的两条路径之一（「钉死并回写词条**或**以设计记录锚定」）；`docs/AGENTS.md` 的
  「Amend or supersede explicitly」约束的是改文路径，设计未走改文路径、未与任何决策文本静默矛盾；
- 若 Owner 后续改走词条回写（评论末段预告的状态行微调或词条补句），属 Owner 自选收口动作，落地时按
  iteration 2 §7-2 对账重开——非本设计缺陷。

（对照技能规则：无 evolution-required 项 → 无修订计划完整度检查义务。）

## 7. Hard conflicts

**无。** 关键裁决链（本门禁与 SA1 分工的边界所在）：

1. **D3 不是 hard-conflict 也不是 evolution-required**：编号决策条款（决策 5 总序 + 数组平局锚 + 缝 1
   矩阵）与已验收契约、简报行为要点三方共同要求数组面值键总序；行内注释「自 [0] 取」在前缀读法下与其
   兼容。设计未改写任何决策文本即可实现。纯索引读法反而与决策 5/缝 1/契约三面不相容——若采该读法需
   改的是契约与实现，不是本设计。
2. **D4 是被移交义务的兑现**（iteration 1 注记 3/§8-5），填充方向与决策 5 确定性要求、尾组立法目的、
   包内 non-finite 统一纪律同构。
3. **D8 不扩词表**：三枚 `WINDOW_*` 码语义逐字保持；投影域失败复用姊妹既有码是空白处的唯一不吞错、
   不发明读法（§3 #7 裁决理由）。
4. **范围零越界**：override 正/负向清单逐条对上（§3 #12/#13）；W2/W3、schema 通道、lease 四键结算、
   文档面全部零涉及。

## 8. Required actions

1. 【实现轮红线，承继 iteration 2 §7-1/§7-3】§5 冻结面逐行核对；范围越界（触 W2 lease 公共面 /
   schema 通道 / readData options / `docs/**`）即时使 override 失效并重开门禁；
2. 【实现轮红线】三窗口码名逐字、响亮不抛；敌意 options 零外抛零 accessor 执行；未入选子树零读取
   （F 组哨兵）；逐项物化字面调用公共姊妹（E 组等价锚）；
3. 【实现轮红线】SA6 契约文件语义断言零改动（绑定取默认 → 整文件零改动）；守卫两测试加法记账新导出；
4. 【条件触发】若 Owner/SA2 复核推翻 D3（采纯索引读法）：契约 A 组期望值 + 设计 §7-D3/§8/§12 同步
   修订并重开本复查——修订面封闭在设计文档与契约文件内，无需 ADR 变更；
5. 【条件触发】若 D8 被否决：替代方案（第四窗口码或入选项失败语义）需 Owner 拍板——属新决策面，
   不得实现期静默改（设计 R2 已正确登记为「所需决策而非静默改」）；
6. 【建议，非门禁】ALLOW 第 5 行可选 pins 测试落地，使 D3/D4/D5/D6/D7/D8 钉死项可执行（SA6 §15
   系未锁面，不加不阻塞六条 issue AC）。

## 9. Verdict

**clear** —— 设计与决策集全面一致：9 项 implements-existing-decision、8 项 no-conflict（其中 6 处
钉死项均为既有文本的解释/空白填充并以设计记录锚定，含 iteration 1 移交义务 D4 的兑现）、1 项
override-authorized（时序条款豁免，本轮 REST 复证评论 5652697060 逐字未变、范围未扩大）、0 项
evolution-required、0 项 hard-conflict。**设计完整地处于 Owner override 授权范围之内**：正向清单
（#368 全部验收面、schema 无关、纯加法）逐条兑现，负向清单（W2/W3、lease 四键结算、schema 通道）
零涉及且 DENY LIST 机器可查；文档面零改动，决策基线零漂移（HEAD 36a73bb、tracked 文件零 diff、
ADR 0027 仍缺席、PR #367 OPEN）。设计的实现边界摘要（ALLOW 五路径、read.ts 与契约文件零改动）
可直接交 SA3/SA4/SA7 执行。

## 10. requiresConflictRecheck

**true**。理由（设计 §15 自请 + 本轮裁定确认）：

1. **新公共 API + 新失败码族的实现符合性**尚待实现轮核对（iteration 2 §7-1 触发器站立：公共面纪律、
   `WINDOW_*` 码名、`WINDOW_TARGET_ABSENT` 不吸收不回渗、read.ts 零 diff、姊妹 options 零触碰）；
2. **D3/D4/D8 三处钉死项**在实现轮须逐项验证实现与设计记录一致（尤其 D3 数组面值键总序、D8
   `PATH_NOT_ALLOWED` 透传边界）；若任一被 Owner/SA2 推翻，按 §8-4/§8-5 路径处理并重开；
3. **决策基线漂移监视**持续：PR #367 改稿（含 Owner 预告的状态行微调）或 override 评论变动即按
   iteration 2 §7-2 重跑。

（本轮为设计复查：纯 no-conflict/existing-decision 的部分不单独触发；触发源集中在尚待实现的
公共 API、失败语义与正式 override 的实现期核对。）
