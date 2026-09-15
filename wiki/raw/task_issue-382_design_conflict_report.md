# 冲突门禁报告（设计后复审）

- 被审对象：`wiki/raw/task_issue-382_design.md`（SA1 设计，**iteration 1 评审修订版**，dispatch `sa-6596f9d9-6b9f-4a1c-82ef-1255849d6623`；已落实 SA2 approve 的 R-1–R-4 全部 MINOR 修订）
- 冲突基准：`docs/adr/` 全集 26 份（无整体 superseded；0029 accepted 为规范权威、演进 0028 基契约）+ `CONTEXT.md` 现行词条（「窗口读」「过滤窗口」「形状预算」）+ 模块 AGENTS 收录边界。**评论 REST 复核：issue #382 comments = 0（本复审经 `gh api` 独立刷新确认，open，updated 2026-09-14T17:18:36Z）——无 Owner 评论，无任何 override 权威在场。**
- 门禁阶段：设计后复审（SA1 产出之后、实现派发之前；iteration 1）
- 产出日期：2026-09-16（SA8，dispatch `sa-47d72a88-96a1-433c-84d0-e5f06aa8f4c8`）
- 上位产物：前置门禁 `wiki/raw/task_issue-382_conflict_report.md`（`clear`，A1–A5 义务 + F1–F8 冻结面 + R1–R16 裁决）+ 决议清单 `wiki/raw/task_issue-382_relevant_decisions.md`
- 基线快照：worktree `/home/wangjian/nomicore-fix-issue-382` HEAD `1b639e0ebe825ffbbfce377850c01ef620734f47`（本次独立复核：`git rev-parse HEAD` 一致；`read.ts` sha256 `3bf6b8b0…b1b312` 实算一致；worktree 除 wiki 证据产物外零未提交改动）
- 指定裁决点（dispatch）：① compose 入口 fail-closed 分支（设计 D8）；② 其敌意 Proxy 漂移证据要求（SA2 R-2 → 设计 §12 D8 变异探针 + S4 增补检查位）；③ P2 票与缝 2 范围分界。

## 1. Reviewed subject

**design**（设计后复审）：iteration 1 修订版设计 vs ADR 全集 + CONTEXT.md + SA8 前置门禁 A1–A5/F1–F8 + 架构边界（ADR 0028 §9 分层、模块 AGENTS）。设计自身只做设计（§0「只做设计，不实现」），本报告亦只裁决冲突，不评设计优劣（SA2 已 approve）。

## 2. Inputs and decision set

输入：设计（308 行全文）、SA2 评审 `wiki/raw/task_issue-382_sa2_review.md`（approve，R-1–R-4 已在设计 §14 逐条落实，本复审核对其落实位置与内容在场）、SA6 验收契约（§12.4 M1–M5、§12.6 S1–S4、§12.7 变异表）、任务简报、前置门禁两产物、`docs/adr/**`、`CONTEXT.md`、`packages/doc-runtime/AGENTS.md`、`packages/namespace-runtime/AGENTS.md`。源码（`window.ts` / `window-read.ts` / `runtime.ts` / `types.ts` / `lease.ts`）仅作当前事实确认：本次独立复核的关键事实——W1 OPT 四键白名单（`window.ts` 键集门）、A 阶段 `total: candidates.length` 恒数值、`WindowComposeInput.total: number`（`window-read.ts` L101）、S3 `canonicalWindowBudget` 四键白名单 + `Object.keys`/descriptor 重读（L203–248）、S3 失败重派发在 `composeWindowRead` 体内（L157–162）、S6 `truncated = kept < total`（L176–177）、`seamWindowOptionsInvalid` 接缝终态构造器（L408）、runtime 把**同一 raw `options` 引用**先交 W1（L689/L701）再交 compose（L691/L703）、别名链 + Equal 锁（`types.ts` L468–480 / `lease.ts` L446–450）。决策集状态与前置门禁一致，无新 ADR/协议版本介入。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| DR-1 | ADR 0029 §5 | 「W1 成功结算从恰两键扩为 `{ok:true, value, total: number\|undefined}`——total 键恒在：无 where = 零值域标识计数；有 where = undefined」「匹配总数恒不承诺」 | §8.1 类型面 + D6 A 阶段单点分支（own 键恒在、有 where 有意不报告匹配数） | implements-existing-decision | ADR 0029 §5；设计 §8.1/§7-D6；`window.ts` A 阶段现状（total 恒数值，加宽位点明确） | 实现后按 F7/T 组核对 |
| DR-2 | ADR 0029 §2 | WhereTerm v1 两键全必填、标量闭集、finite、合取、空数组拒、上限 16、同 field 重复合法、「where 自身形状永不再变」 | §8.1 `WhereTerm` 逐字对应 + §8.3 W-1/W-4–W-12 判据表（含 falsy equals 全合法、零强制转换、descriptor 纪律） | implements-existing-decision | ADR 0029 §2；设计 §8.1/§8.3 | 词表零扩大（A1 承接；F5 实现后核对） |
| DR-3 | ADR 0029 §3 | 数据侧安静不匹配（field 缺席/不可下钻/非标量/non-finite）× 入参侧响亮 | §8.4 E+W（`drillField` 单段下钻 + `undefined ⇒ 安静不匹配`）+ §8.3 全部入参判据响亮 | implements-existing-decision | ADR 0029 §3；设计 §8.3/§8.4 | 照文执行 |
| DR-4 | ADR 0029 §4 | 管线 where → orderBy → n；readArray 对称获得；where 不触碰 orderBy 面词表 | §8.4 管线（E+W 内联过滤 → S → 取前缀）+ W-14 `validateOrderBy` 逐字节不动 | implements-existing-decision | ADR 0029 §4；设计 §8.4/W-14 | F4 实现后核对 |
| DR-5 | ADR 0029 §5（缝 2 面） | truncated 双语义、✂ 段有 where 永不装配、过滤槽不呈现 | §1 非目标明示不做；F8 落实「where 路径到不了 S6、✂ 装配规则零触碰」；Follow-up ① 缝 2 票闭合 | no-conflict（义务性保持：缝 2 义务在阶段内后置，非本票免除） | ADR 0029 §5 + 验收缝 2；设计 §1/§6-F8/§13 | 缝 2 落地前 lease 面 where 恒响亮（见 DR-6）；缝 2 票须整体取代 D8 分支（A2′） |
| DR-6 | **SA8 A2 + ADR 0029 §6「两层同步扩」+ ADR 0029 §8（影响包含 namespace-runtime）** | 前置门禁 A2：「lease 面实传 where 会响亮失败而非静默错组 ✂——该中间态必须保持响亮（设计不得引入绕过 S3 的静默通道）」「S3 镜像扩展义务由缝 2 票在阶段收官前闭合」 | **D8 compose 入口 fail-closed 分支**：`WindowComposeInput.total` 加宽 `number\|undefined` + `composeWindowRead` 函数体第一句判 `total === undefined` → 四键 `WINDOW_OPTIONS_INVALID`（新私有构造器，message 非契约）；键于 **W1 结算结果**而非 options 重读；S3/S5/S6 语义零改动；runtime.ts/lease.ts/types.ts 零 diff | **implements-existing-decision**（A2 响亮中间态的落地机制；非新决策面） | 前置门禁 A2；ADR 0029 §6/§8；设计 §8.6/§7-D8/§10/§11；本次源码复核（compose 消费点、S6 `kept < total`、接缝构造器先例 `seamWindowOptionsInvalid` L408、runtime 同一 raw 引用双消费 L689–L703） | 见 A2′（分支形态纪律 + 缝 2 取代义务）；S3 判据体逐字节不动为实现后核对项 |
| DR-7 | **ADR 0029 §6 + ADR 0028 §7（敌意通道纪律）** | 「零 `[[Get]]`、零 accessor 执行、trap 异常收编」；「options/orderBy 封闭数据形状校验，零外抛、零 accessor 执行」 | §8.3 W-2/W-5/W-6/W-13（descriptor 读 `length` 与元素、accessor 显形即拒、try 收编）+ §9 敌意并发段 | implements-existing-decision | ADR 0029 §6；ADR 0028 §7；设计 §8.3/§9；`canonicalWindowBudget` 同款纪律先例（L203–248） | 实现后 V11–V17 计数器断言核对 |
| DR-8 | **SA8 A2 + ADR 0029 §6（敌意漂移证据要求）** | A2 禁止「绕过 S3 的静默通道」；ADR 0029 §6 敌意校验纪律 | §12 D8 变异探针（**前后双态证据**：临时删除/软化入口分支 + 对 W1/S3 呈不同键视图的 options Proxy 经 lease 调用 → 必须先观测静默已过滤四键成功面【探针有牙】→ 恢复后同调用必须 `WINDOW_OPTIONS_INVALID`；证据入实现票 artifacts 与 S1–S4 同列）+ S4 增补检查位（分支在场、先于 S3、键于 W1 结算 `total === undefined`） | **no-conflict**（证据方法论与既有敌意哨兵/变异审计先例同族，不构成决策变更；其事实前提经本次源码独立复核成立） | 前置门禁 A2；ADR 0029 §6；设计 §12「SA8 A2 中间态」行/「S4」行/变异表；源码复核：S3 以 `Object.keys`+descriptor 重读同一 raw options（视图可分裂）∧ S6 `kept < undefined → false`（分支缺席即静默成功面）∧ A 阶段 total 恒数值（`total === undefined ⟺ where 已生效` 判据无双义来源） | 双态证据 + S4 增补位为实现票验收项（A6′）；不得以编译期收窄钉替代行为级探针 |
| DR-9 | ADR 0029 §7 + ADR 0002 | 谓词比较实际数据值、schema 无关；不得援引为规则引擎先例 | D4 复用 `drillField` 单段原始读（与 orderBy field 基同源），无 schema/domain 语义注入 | no-conflict | ADR 0029 §7；ADR 0002；设计 §7-D4 | 无 |
| DR-10 | ADR 0029 §8 + ADR 0028 §9 | 「解除 doc-runtime 窗口原语的包范围冻结：window.ts 原地扩 where 与 total」；ADR 0029 影响包明示含 `@nomicore/namespace-runtime`（§8 本身即指挥 runtime 侧收缩/组合层职责）；ADR 0028 §9：doc-runtime 载体原语 / namespace-runtime 组合选窗 / registry lease 零校验透传 | ALLOW：`window.ts` 原地扩（唯一实现落点）+ `window-read.ts` **仅** compose 两入口与 `WindowComposeInput` 签名加宽 + 入口分支 + 新私有构造器（S3/canonicalOrderBy 判据体 DENY 逐字节不动）；runtime.ts/lease.ts/types.ts 零 diff（D9） | implements-existing-decision（组合层签名加宽是 §5 total 值域经既有直通消费点的机械必然后果——本次复核 runtime L691/L703 直传 `windowResult.total`，不加宽即 TS2345，加宽而不分支即静默通道或 cast；无第三路） | ADR 0029 §8/影响包行；ADR 0028 §9；设计 §7-D8/D9/§11；SA6 §12.4 M5（「必须在消费边界显式分支……禁 `?? 0`/`as number`/静默兜底」，approved 契约在场） | 实现后核对 ALLOW/DENY 逐路径与 S3 判据体零改动 |
| DR-11 | **ADR 0029 验收三缝 + issue #382 = 缝 1（P2 票 vs 缝 2 范围）** | 缝 1 = doc-runtime 原语公共入口（过滤矩阵/total 双形态/零物化/敌意校验/三失败码/#368 先例）；缝 2 = lease 两方法公共面（truncated 双语义/✂ 规则/恒四键/registry 透传/类型面 fail-closed） | §1 目标全部落缝 1（W1 where/total/校验/测试）；非目标明示不做缝 2；唯一跨包触点（window-read.ts）为类型链机械后果（DR-10），且方向是**收紧**（lease 面 where 响亮拒绝）而非提前兑现缝 2 语义——truncated 双语义/✂ 装配/S3 镜像零实现 | no-conflict（范围分界正确：不越缝 2 一步，也不欠缝 1 一项） | ADR 0029 验收节；简报正文/AC1–AC8（无 lease where 成功验收项）；设计 §1/§11/§13-Follow-up ① | 缝 2 票须在 PR #380 阶段收官前闭合（A2 承接；阶段内同支累积、中间态不污染 main） |
| DR-12 | ADR 0028 §7 | 三稳定码语义；失败结算四键 | §8.7 零新增码；D8 分支复用 `WINDOW_OPTIONS_INVALID`——与既有接缝终态 `seamWindowOptionsInvalid`（「视图不稳定……接缝拒绝组合窗口读」）同族同码，message 非契约字段 | no-conflict | ADR 0028 §7；设计 §8.6/§8.7；`window-read.ts` L161/L408 先例 | F3 实现后核对（同码不漂移） |
| DR-13 | ADR 0028 §5/§8 | 总序/平局锚/不可比尾组；只物化入选项、未入选零物化哨兵 | §8.4 S 阶段零改动（匹配集照搬总序纪律）；D3/D4 单遍内联过滤零整项物化；Z1–Z8 毒值哨兵 | implements-existing-decision | ADR 0028 §5/§8；设计 §8.4/§12 | 实现后 Z 组/T 组核对 |
| DR-14 | ADR 0027 §1 + ADR 0029 备选 | 恒四键 `{ok,value,schema,truncated}`；「结算加第五键 total」已否决 | 组合层成功面构造零改动（where 路径在成功面构造前已响亮失败）；十四键 runtime 面不动（F2） | no-conflict | ADR 0027 §1；ADR 0029 备选节；设计 §6-F2/§8.6 | 实现后核对 lease 四键基线（E5 无 where 面） |
| DR-15 | ADR 0024 + CONTEXT「形状预算」 | 预算结构盲；值感知选择走窗口读独立公共面，不进 readData options | §1 非目标 + D9 负控（带 where 的 readData → `READ_OPTIONS_INVALID` 钉死） | no-conflict | ADR 0029 背景；CONTEXT.md L50；设计 §1/§10 | F1 实现后核对 |
| DR-16 | ADR 0023 | 冻结服务对象字面量构造纪律 | 不触碰任何服务对象构造（compose 为 namespace-runtime 内部函数，非服务面） | no-conflict（无关面） | ADR 0023；设计 §11 | 无 |
| DR-17 | ADR 0008 + namespace-runtime AGENTS | 读不进 sequencer、只观察已提交 live Y.Doc、公共面 detached 投影 | 全链同步纯读、零状态、W1 无生命周期触点；§9 并发/幂等段与之一致 | no-conflict | ADR 0008；`packages/namespace-runtime/AGENTS.md`；设计 §9 | 无 |
| DR-18 | `packages/doc-runtime/AGENTS.md` | 「Add public APIs only through `src/index.ts`; public-surface guard tests must account for every export」 | §8.2 `export type { WhereTerm }` type-only 导出 + M2 记账/投影断言（值导出面保持两枚） | implements-existing-decision（A3 承接） | 模块 AGENTS；设计 §8.2/M2 | 实现后 M2/P-W1/P-W2 核对 |
| DR-19 | ADR 0029 §5（短路语境）+ 简报「位置序短路选窗」 | ADR 以「计数不可短路」论证 total 恒不承诺——短路是成本论证与实现自由，非行为承诺；可观察契约 = value/total/序 | D7 v1 不做流式短路（单遍全枚举，可观测等价：value/total/顺序全一致）；§13 Follow-up ② 口径注（SA2 R-4）防后续票误读；成本短路登记演进位（触发 ~10⁵） | no-conflict（可观察契约零损失；简报散文按 SA6 §7/H8/O3 已批准裁定以可观测等价兑现，非静默偏离——设计显式登记） | ADR 0029 §5/备选节（「为 total 废掉位置序短路路径……不可接受」语境 = 反对恒输出 total 方案，非强制短路）；SA2 §3/N-4；设计 §7-D7/§13 | 实现票验收不以短路为门槛；若后续实现短路分叉，须回到设计（S2 审计禁第二读路径） |
| DR-20 | CONTEXT.md「窗口读」/「过滤窗口」词条 + 缝 3 | 词条已锚定 where 语义（total undefined/✂ 永不/安静不匹配/无规则引擎先例）；缝 3 已闭合（PR #380 基线） | 设计零触碰 CONTEXT/ADR（DENY明示）；设计语义与词条逐点一致（无「期望匹配总数」「过滤槽呈现」类违词） | no-conflict | CONTEXT.md L61–67；设计 §1 非目标/§11 DENY | 无 |

裁决分布（与上表逐行一致）：**implements-existing-decision ×9（DR-1、DR-2、DR-3、DR-4、DR-6、DR-7、DR-10、DR-13、DR-18）、no-conflict ×11（DR-5、DR-8、DR-9、DR-11、DR-12、DR-14、DR-15、DR-16、DR-17、DR-19、DR-20）、evolution-required ×0、hard-conflict ×0**。

### 指定裁决点专述

**① compose 入口 fail-closed 分支（D8）——implements-existing-decision，合法。**
分支是三条既有约束的唯一交集解：(a) ADR 0029 §5 强制 W1 有 where 时 `total = undefined`；(b) 该值经 runtime L691/L703 直通流入 compose 的 `total` 形参并在 S6 被 `kept < total` 消费（本次源码复核）——不加宽签名即编译红，加宽后不加显式分支即静默 `truncated:false` 成功面（A2 禁止的静默通道）或 cast（SA6 M5 + typed-writes 纪律明禁）；(c) S3 五键放宽属缝 2 且会在 truncated 双语义缺席下开门。分支键于 **W1 结算结果**（`total === undefined ⟺ where 已在 W1 生效`；A 阶段无 where 时 `candidates.length` 恒数值，判据无双义来源——本次复核成立），不重读 options、不校验 where 形状，故**不构成第三套校验器**，与 ADR 0029 §6「W1 权威校验 + S3 镜像」的两层结构无平行机制冲突；失败构造复用 window-read.ts 单源 `windowFailure` 四键纪律（`seamWindowOptionsInvalid` 同款先例），不新增失败码（F3）。与 HEAD 现状（E5：lease where → W1「未知键」拒）**同码同向**，中间态无静默窗口。§15-2 自登记的「新失败位点」经本复审裁定：不改变任何冻结面（失败面四键、S3 判据体、成功面构造、runtime/registry 零 diff），属 A2 义务的落地机制选择，无需决策演进。

**② 敌意 Proxy 漂移证据要求——no-conflict，事实前提成立，证据义务合法且必要。**
漂移通道经本次源码独立复核为**结构性真实**：runtime 把同一 raw `options` 引用先交 W1 再交 compose（L689/691、L701/703），S3 以 `Object.keys` + descriptor 重读（L213–217）——敌意 Proxy 的 ownKeys/getOwnPropertyDescriptor trap 可对 W1 呈五键视图、对 S3 呈干净四键视图；分支缺席时 S6 `kept < undefined → false` ⇒ `{ok:true, value, schema, truncated:false}` 已过滤静默成功面。设计据此（SA2 R-2）要求的**前后双态变异探针**（删/软化分支 → 必须观测到静默成功面以证明探针有牙；恢复 → 必须 `WINDOW_OPTIONS_INVALID`）+ S4 增补检查位 + 变异表新类，与仓内既有敌意哨兵/变异审计先例（ADR 0028 §7 敌意通道验收、SA6 §12.7）同族，是 A2「必须保持响亮」的可验证化，非决策变更。注意：探针属实现期审计证据（临时变异不入库），不与「零 `[[Get]]`/零 accessor」生产纪律冲突——后者约束生产校验路径，探针构造的是测试侧敌意输入。

**③ P2 vs 缝 2 范围——no-conflict，分界正确。**
P2 票义务 = 缝 1 全集（AC1–AC8 逐项有落点），设计未欠项；缝 2 面（lease where 接收、truncated 双语义、✂ 永不装配、S3 镜像）一项未做、显式非目标、Follow-up ① 登记（PR #380 阶段收官前闭合）。唯一跨包触点 window-read.ts 是类型链机械后果（DR-10），且其效果是**收紧**（lease 面 where 响亮）而非提前兑现缝 2 语义——不是范围越界，更不是「缝 2 偷跑」。ADR 0029 验收三缝结构由此保持完整：缝 2 票落地时 D8 分支被「truncated 双语义 + ✂ 永不装配 + S3 镜像扩展」整体取代（F7 严格断言预期翻转已由 P4 条件不变式形态预置，无退役义务）。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| ——（无需任何 override） | ——（评论 REST 复核 0 条，无 Owner 评论；无新 ADR/协议版本援引；SA2 approve 非冲突豁免权威） | —— | —— |

设计不与任何现行决策冲突，不存在也无需 override；D8 分支不修订任何 ADR 条款（DR-6/DR-10 裁定为既有决策的兑现机制）。

## 5. Frozen surfaces（F1–F8 设计阶段核对）

| Surface | Must remain unchanged | Evidence | Actual result（设计阶段静态核对） |
|---|---|---|---|
| F1 readData options 闭合形状 `{depth?, maxChildrenPerNode?}` | 三层透传零变化 | ADR 0027 §1；ADR 0024 | 设计非目标 + D9 负控（`READ_OPTIONS_INVALID`）→ **保持**（实现后核对） |
| F2 lease 恒四键 + 十四键 runtime 面 | own 键集不动；total 不上 lease 结算 | ADR 0027 §1；ADR 0029 §1/备选 | where 路径在成功面构造前响亮失败；runtime/registry 零 diff → **保持**（实现后核对） |
| F3 三窗口失败码语义 | 不新增码、语义不漂移；where 形状非法与中间态均收编 `WINDOW_OPTIONS_INVALID` | ADR 0028 §7；ADR 0029 §6；前置门禁 F3 | §8.7 零新增；D8 复用接缝族同码（`seamWindowOptionsInvalid` 先例）→ **保持**（实现后核对） |
| F4 orderBy v1 词表（readArray 仅 `by:'index'`） | where 不触碰排序词表 | ADR 0028 §2；ADR 0029 §4 | W-14 `validateOrderBy` 逐字节不动 → **保持**（实现后核对） |
| F5 `where` 自身形状永不再变 | v1 只收标量闭集等值；演进只走数组项形态加法 | ADR 0029 §2 | §8.1/§8.3 v1 闭集即终态；type-only `readonly` → **保持**（实现后核对） |
| F6 `read.ts` 零 diff + 镜像纪律 | sha256 `3bf6b8b0…b1b312` + `copied from read.ts@36a73bb` 标记数不减 | 前置门禁 F6；window.ts 模块头 | read.ts 不入 ALLOW；本次复算 sha256 一致 → **保持**（实现后核对） |
| F7 where 缺席行为零回归 | total = 标识计数、truncated = kept < total、✂ 照旧逐字节 | ADR 0029 §5；#381 | §8.4 无 where 守卫（array 面零元素读保持）+ T1–T3/NC1–NC3 锚定 → **保持**（实现后核对） |
| F8 ✂ 段 where 在场永不装配 | 缝 2 面最终语义 | ADR 0029 §5 | 缝 1 期间 where 路径到不了 S6（入口即拒）——**中间态由 D8 分支保证、终态由缝 2 票实现**；✂ 装配规则本票零触碰 → **保持**（缝 2 落地后终态核对） |

## 6. Evolution requirements

**无新增 evolution 项**（evolution-required ×0）。设计零 ADR/CONTEXT/协议修订；决策演进（ADR 0029、CONTEXT 词条、缝 3）已于任务前正式完成（前置门禁 §6 已核）。DR-6 的 D8 分支经裁定为 A2 既有义务的落地机制而非契约变更，不触发修订计划完备性核对。缝 2 义务（truncated 双语义/✂ 规则/S3 镜像「两层同步扩」）为 ADR 0029 既有验收项的后置兑现，非本设计引入的演进需求。

## 7. Hard conflicts

无（hard-conflict ×0）。指定三项裁决点全部落入 implements-existing-decision / no-conflict（§3 专述）。

## 8. Required actions（实现票执行义务，非阻塞）

- **A1′（词表纪律，承接 A1）**：严格按 §8.3 判据表执行；in/范围/OR/NOT/多段 field/容器深相等一律 v1 外响亮拒绝；禁 truthiness 校验；16 哨兵改动须先改 ADR/简报口径（O1）。
- **A2′（缝序一致性，细化 A2）**：D8 分支实现须同时满足——位于 `composeWindowRead` 函数体第一句（先于 S3）、判据键于 W1 结算 `total === undefined`（不得改为 options 重读）、失败面经 window-read.ts 单源四键构造器（`windowFailure` 纪律，message 非契约）；S3 `canonicalWindowBudget`/`canonicalOrderBy` 判据体逐字节不动；runtime.ts / lease.ts / types.ts 零 diff（若实现发现必须改 runtime.ts 即设计偏离，先回报）。**缝 2 票落地时须整体取代该分支**（truncated 双语义 + ✂ 永不装配 + S3 镜像扩展），且须在 PR #380 阶段收官前闭合——「两层同步扩」义务（ADR 0029 §6）在此之前保持未闭合状态，不得被本票视为已履行。
- **A3′（公共面与测试先例，承接 A3/A5）**：`WhereTerm` 经 `src/index.ts` type-only 导出并纳入守卫记账（值导出面保持两枚）；新契约三文件沿 #368 家族形态、零跨包 import（F7 严格形态仅实现期审计 + P4 条件不变式落 registry）；全仓 `pnpm typecheck` + `pnpm test` 绿。
- **A4′（冻结面纪律，承接 A4）**：`read.ts` 零 diff（sha256 复核）；`window.ts` 原地扩展且无 where 路径逐字节不变（F6/F7）；F1–F5 逐项实现后核对。
- **A6′（新增：敌意漂移证据义务）**：实现票 artifacts 必须含 D8 变异探针**前后双态证据**（删/软化分支 → 分视图 Proxy 经 lease 观测到静默已过滤成功面；恢复 → `WINDOW_OPTIONS_INVALID`）+ S1–S4 结构审计（含 S4 增补位：分支在场/先于 S3/键于 W1 结算），与 S1–S4 同列登记；不得以编译期收窄钉或 P4 恒绿不变式替代该行为级证据。

## 9. Verdict

**`clear`**

iteration 1 修订版设计对 ADR 0029/0028 及关联决策全集逐条款兑现或保持（implements-existing-decision ×9、no-conflict ×11），SA2 R-1–R-4 修订落实到位（§14 映射与正文一致，R-1 修正后的 D8 论据与源码无矛盾——本次复核 runtime.ts L980 构造器归属 readData 预算域，论证成立）。三项指定裁决点：**compose 入口 fail-closed 分支 = A2 响亮中间态的合法落地（非第三校验器、非缝 2 偷跑、无冻结面触碰）；敌意 Proxy 漂移证据要求 = 事实前提成立且与既有敌意纪律同族的必要证据义务；P2/缝 2 分界 = 正确（不越一步、不欠一项）**。无 evolution-required、无 hard-conflict、无需 override。**放行进入实现派发**；附带 A1′–A4′ + A6′ 执行义务（非阻塞）。

## 10. requiresConflictRecheck

**true** —— ① W1 公共入口类型面（options 增 `where?`、结算 `total: number | undefined`、`WhereTerm` type-only 导出）与失败语义（§8.3 判据、D8 分支行为、§8.7 词表）尚待实现 diff 逐项核对（F3–F7 冻结面 + A2′ 分支形态纪律 + A6′ 双态证据）；② ADR 0029 §6「两层同步扩」与 §5 truncated 双语义/✂ 装配规则的**缝 2 义务仍未闭合**（Follow-up ①，PR #380 阶段收官前），届时须按 DR-5/A2′ 复核缝 2 票对 D8 分支的整体取代与 F7/F8 终态翻转。
