# 冲突门禁报告

- 被审对象：GitHub issue #383 任务简报（[ADR 0029] P3 — 组合面与 lease 类型（缝 2：runtime + registry）：runtime 十四键面 `readArray`/`readMap` 组合 `where` 并透传到 registry lease；S3 canonical 键集白名单同步扩 `where`；S6 结算 truncated 双语义与 ✂ 装配规则；lease options 类型面 fail-closed）
- 冲突基准：`docs/adr/` 全集 28 份逐个盘点（无整体 superseded；0029 为最新、accepted）+ `CONTEXT.md` 现行词条 + 模块 AGENTS 收录边界（namespace-runtime / namespace-registry / doc-runtime）。评论 REST 快照为空——**无 Owner 评论，无任何 override 权威在场**。
- 门禁阶段：前置门禁（SA 派发之前；iteration 0）
- 产出日期：2026-09-16（SA8，dispatch `sa-43a7f81c-7ac7-475b-ab5b-e9efe0e50a72`）
- 配套决议清单：`wiki/raw/task_issue-383_relevant_decisions.md`
- 基线快照：worktree `mabf/issue-383` HEAD `de2ff55`（ADR 0029 基线 `8a4fa40` + P1 `1b639e0` + P2 缝 1 `de2ff55` 已入；前置票 #382 已合并，blocked-by 无阻塞）

## 1. Reviewed subject

**task**（前置门禁）：issue #383 任务简报 vs ADR 全集 + CONTEXT.md。

## 2. Inputs and decision set

输入：`wiki/raw/task_issue-383.md`（issue #383 正文快照，评论为空）、`CONTEXT.md`、`docs/adr/**`、`packages/namespace-runtime/AGENTS.md`、`packages/namespace-registry/AGENTS.md`、`packages/doc-runtime/AGENTS.md`（模块收录边界）；代码（`window-read.ts` / `runtime.ts` / `lease.ts` / `types.ts` / doc-runtime `window.ts`）仅作当前事实确认，不构成裁决依据。决策集状态：ADR 0029（accepted，2026-09-16，规范权威）演进 ADR 0028（accepted，基契约）；ADR 0027（恒四键 + ✂ 载体）、0024（结构盲预算 + registry 透传纪律）、0008（读边界与 `RUNTIME_READ_DISABLED`）、0009（lease 代理面）、0002（authority 出范围）、0023（冻结服务面）为关联约束；无 superseded ADR 参与对照。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| R1 | ADR 0029 §1 + 验收缝 2 | 「`readArray` / `readMap` 的 options 增可选 `where`……不新增第四个读方法、不改 readData；恒四键结算……与十四键 runtime 面不动」；缝 2 = 「truncated 双语义、✂ 装配规则、恒四键 own 键集、组合式 depth 等价锚、registry 透传、类型面 fail-closed」 | #383 即缝 2 实现票：runtime 组合面接收 `where` + registry lease 透传；无新方法、不动 readData、不动十四键键集 | implements-existing-decision | `docs/adr/0029-filtered-window-read.md` §1、验收节；issue #383 正文 | 「十四键不动」= 键集/方法面不动；`where` 只作 options 词表加法（勿误解为禁止 options 扩展——§1 本身就是该扩展的授权） |
| R2 | ADR 0029 §5 | truncated 双语义：无 where 精确 `kept < total`、有 where 装满判定 `kept === n` → true / `kept < n` → false；「✂ 段：无 where 照现状按 truncated 装配（既有快照逐字节不变）；有 where 永不装配，过滤槽不呈现」；匹配总数恒不承诺 | AC1「无 where 时 lease 面结算与 ADR 0028 快照逐字节一致」+ AC2「有 where 时 `truncated === (kept === n)`……✂ 段永不装配、不呈现过滤槽；schema 通道仍为元素口径投影文本（where 不影响）」 | implements-existing-decision | ADR 0029 §5；issue #383 AC1/AC2 | S6 双语义判据应键于 W1 结算单源（`total === undefined ⟺ where 已应用`，B-8 单源不变量），不重读 options；装满判定需 canonical `n`（S3 已产出） |
| R3 | ADR 0029 §6 | 「doc-runtime W1 权威校验与 runtime S3 镜像**两层同步扩**」：键集白名单（恰 `field`/`equals`）、plain object 原型链、零 `[[Get]]`、零 accessor、trap 收编；失败码复用三码族 | AC「S3 canonical 键集白名单同步扩 where（与 doc-runtime 权威校验判据一致，接缝出口覆盖新键）」+ AC「S3 接缝两出口（视图不稳定重派发 / 交替视图终态）对 where 判据同步：敌意 where 在组合层同样零外抛」 | implements-existing-decision | ADR 0029 §6；issue #383 正文；当前 `window-read.ts` S3 白名单恰四键（L229–232）待扩 | S3 是**镜像**不是第三套权威（W1 单权威裁定合法性；S3 只做接缝净化）；W1 判据含非空数组、≤16、稀疏空洞非法——镜像须判据一致（见 A2） |
| R4 | ADR 0029 §2 + 验收缝 2「类型面 fail-closed（where 词表 / 数组形态 / 标量闭集）」 | WhereTerm v1 = `{field: 单段字面键, equals: 标量闭集}`；「`where` 自身形状永不再变」；合取、空数组非法、上限 16 | AC「registry lease 类型 fail-closed（test-d）：where 非数组、元素未知键、equals 非标量闭集、by/dir 词表混用等编译期拒绝；registry 透传组合面」 | implements-existing-decision | ADR 0029 §2、验收节；issue #383 AC | v1 词表不得扩大（F5）；per-face `orderBy` 判别与 `where?: readonly WhereTerm[]` 经单源别名链已透传至 lease 类型面——test-d 锚定既有链，勿复制第二份类型（A4） |
| R5 | ADR 0029 §4 + ADR 0028 §4 | 「管线：where → orderBy → n」；「排序总序、平局锚、组合式 depth、条目列表、身份随行照搬 ADR 0028」；「每个入选项 ≡ `readData(项路径, { depth, maxChildrenPerNode })`」 | AC「组合式 depth 等价锚：过滤入选项 ≡ 同预算 readData(项路径)」+ AC3「条目身份随行（key/index）可拼下一轮路径」 | implements-existing-decision | ADR 0029 §4；ADR 0028 §3/§4；issue #383 AC | 过滤在 W1 内已完成（#398），组合层不重滤、不重排——等价锚是测试义务不是组合层新逻辑 |
| R6 | ADR 0029 §7 + ADR 0002 | 「谓词比较的是实际数据值……schema 通道不受 where 影响」；「谓词无领域语义……不得援引为在 where 上生长规则引擎的先例」；authority 规则体系完全出范围 | `where` 为等值筛选、比较实际载体值；schema 锚链（S5）与 where 无关 | no-conflict | ADR 0029 §7；ADR 0002 | 实现与后续设计不得在 where 上生长领域规则语义 |
| R7 | ADR 0028 §1/§3/§7（+ CONTEXT.md「窗口读」） | 恒四键 own 键集、条目列表身份随行、三稳定码语义、敌意通道零外抛 | AC3 恒四键 own 键集 `{ok, value, schema, truncated}` 不变；AC1 无 where 路径零回归 | no-conflict（义务性保持） | ADR 0028 §7；CONTEXT.md L61–63 | 实现不得改变无 where 路径任何行为（F7） |
| R8 | ADR 0028 §9 + ADR 0029 §8 | 「runtime：组合选窗与元素口径投影文本；registry：lease 公共面与类型别名」；「S4 候选计数下沉进 W1……runtime……收缩为纯组合层（S3 净化 / S5 锚链 / S6 ✂ 装配）」 | #383 只动组合层 S3/S6 与类型/透传面；`total` 继续从 W1 结算单源直通 | no-conflict（义务性保持） | ADR 0028 §9；ADR 0029 §8；`window-read.ts` L29–31 单源纪律 | 组合层零计数函数、零 where 谓词求值镜像（过滤权威在 W1）——只做 canonical 净化与结算装配（A3） |
| R9 | ADR 0027 §1/决策 1（经 ADR 0029 §5 条款级细化） | 「成功分支恒四键」；「截断事实的唯一载体 = 投影文本内的 ✂ 段」；L63 备案「文本不存在时截断事实仅剩 `truncated: true` 布尔」 | lease 结算保持恒四键；where 在场 ✂ 永不装配 ⟹ 截断信号仅剩 `truncated` 布尔（装满判定） | no-conflict | ADR 0027 §1/L63；ADR 0029 §5 | 已由 ADR 0029 显式决定（✂ 不装配 + 「调用方自知查询参数」），非未授权偏离 0027；实现不得在 where 在场时装配任何 ✂/过滤槽文本（F8） |
| R10 | ADR 0008 读取能力 + 修订 L123/L178–179 | 「read 停接纳稳定码 `RUNTIME_READ_DISABLED`……lifecycle 失败不是路径缺陷，不借用路径失败码」；读取不进 sequencer、不重编译 VFSL | AC「close 后带 where 读 → `RUNTIME_READ_DISABLED`（停接纳不豁免，四键失败形）」——S1 gate 先行、零 options 读取（`runtime.ts` L675–706 既有编排） | implements-existing-decision | ADR 0008 L123/L178–179；issue #383 AC | 停接纳覆盖与 where 无关（lifecycle gate 先于 options）；失败形 own 键集 `{ok, code, path, message}` 恰四键不变 |
| R11 | ADR 0009 §NamespaceLease + ADR 0024 决策 6（经 types.ts L460 引用） | lease 代理 Runtime 同步读取、不公开裸 Runtime/Y.Doc；release 后经既有通道 `NAMESPACE_LEASE_RELEASED`；「registry lease 原样透传」 | 「registry 透传组合面」= 既有 raw 引用直传通道（`lease.ts` L309–316）承载 `where`；released 短路先于透传 | no-conflict | ADR 0009 L38/L44；`lease.ts` L309–316 | lease 层零解释/零校验（透传即代理语义）；不新增 lease 方法/成员（F2/F10） |
| R12 | ADR 0027 §1 + ADR 0024 + ADR 0028 §9 | readData options 闭合形状 `{ depth?, maxChildrenPerNode? }` 零变化；「readData 与 ADR-0024 的 options 零改动」 | #383 不触碰 readData / 预算轴 | no-conflict | ADR 0027 §1；ADR 0028 §9 | 无（F1 冻结面） |
| R13 | ADR 0023 | 冻结服务对象字面量构造纪律（registry/ws-replication/clock 服务面 getter 化影响表） | #383 不触碰任何服务对象构造；lease/runtime 均非其影响面 | no-conflict（无关面） | ADR 0023 影响面表 | 无 |
| R14 | CONTEXT.md「过滤窗口」（L65–67）+「窗口读」（L61–63） | 词条已全文落定：合取、管线序、装满判定、✂ 永不装配、安静不匹配、v1 词表外响亮拒绝 | 简报措辞与词条逐点一致（truncated 双语义、✂ 规则、恒四键、fail-closed）；缝 3 已闭合，#383 无文档缝义务 | no-conflict | CONTEXT.md L61–67 | 无新增词条义务；若实现引入词条未覆盖的呈现语义须回门禁（目前无） |
| R15 | 模块 AGENTS（namespace-runtime / namespace-registry / doc-runtime） | 读取留 sequencer 外；公共 API 只经 `src/index.ts` 并纳入 public-surface 守卫；runtime 契约变更跑根 typecheck + test | where 组合是纯读（零 sequencer、零状态写）；新公共类型导出（如 `WhereTerm` 再导出）须走各包 `src/index.ts`；AC8 全仓 typecheck + 测试绿 | no-conflict（附执行义务 A4/A5） | 三个模块 AGENTS.md | 见 A4/A5 |
| R16 | ADR 0029 §5/§6 + #382 遗留缝序中间态 | （决策义务：两层同步扩须在阶段收官前闭合——#382 报告 A2） | 当前组合层入口 fail-closed（`seamWhereNotImplemented`，`total===undefined` → 响亮 `WINDOW_OPTIONS_INVALID`）与 S3 恰四键白名单，均为**待 #383 取代的中间态**（模块注释明言「缝 2 落地时本分支被……整体取代」）；`issue-382-lease-where-no-silent-pass.test.ts` 为条件不变式耐久形态（`ok:true` ⟹ 条目全满足谓词） | implements-existing-decision | `window-read.ts` L161–168、L432–446；`packages/namespace-registry/test/issue-382-lease-where-no-silent-pass.test.ts` 头注 | 取代中间态分支是本票义务而非违规；耐久测试须在缝 2 态继续绿，缝 1 严格断言（若有）不得留作会变红的持久测试（A5） |

裁决分布：**implements-existing-decision ×7（R1、R2、R3、R4、R5、R10、R16）、no-conflict ×9（R6、R7、R8、R9、R11、R12、R13、R14、R15）、evolution-required ×0、hard-conflict ×0**。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| ——（无需任何 override） | ——（评论快照为空，无 Owner 评论；亦无新 ADR/协议版本援引） | —— | —— |

说明：#383 不与任何现行决策冲突，故不存在也无需 override 权威；issue 正文自身也不是 override（它是对已接受 ADR 0029 缝 2 的实现票）。ADR 0029 对 ADR 0028 的词表演进、对 ADR 0027「✂ 唯一载体」的 where 在场例外，均已在 ADR 0029 文本内正式完成（合法演进路径），无需 #383 另行援引。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| F1 readData options 闭合形状 `{depth?, maxChildrenPerNode?}` 与 readData 行为 | 三层透传零变化；`where` 只进窗口 options | ADR 0027 §1；ADR 0024；ADR 0028 §9 | 简报不触碰 → 保持 |
| F2 lease / runtime 窗口读成功结算恒四键 `{ok, value, schema, truncated}`（own 键集） | 无第五键（`total` 不上 lease 面）；成功成员类型键集不动 | ADR 0028 §7；ADR 0029 §1/备选（「结算加第五键 total」已否决） | AC3 明示 → 保持（实现后核对） |
| F3 runtime 十四键公共面键集 | 无第十五方法；`where` 是 options 词表加法 | ADR 0029 §1；`runtime.ts` L181 | 简报「十四键面组合 where」语义一致 → 保持 |
| F4 失败码族：`WINDOW_TARGET_ABSENT` / `WINDOW_CARRIER_MISMATCH` / `WINDOW_OPTIONS_INVALID`（+ `PATH_NOT_ALLOWED` 透传、`RUNTIME_READ_DISABLED` 停接纳） | 不新增码、语义不漂移；where 形状非法收编进 `WINDOW_OPTIONS_INVALID`；停接纳 own 键集恰四键 | ADR 0028 §7；ADR 0029 §6；ADR 0008 L123 | 简报 AC 明示 → 保持（实现后核对） |
| F5 `where` 自身形状永不再变 | v1 只收标量闭集等值、单段 field、合取、非空、≤16；in/范围/OR/NOT/多段 field/深相等一律 v1 词表外响亮拒绝 | ADR 0029 §2；CONTEXT.md L67 _Avoid_ | 简报 WhereTerm v1 一致 → 保持（实现后核对） |
| F6 orderBy v1 词表 | `where` 不触碰排序词表：readArray 仅 `by:'index'`、readMap `by:'key'`/单段 `field` | ADR 0028 §2；ADR 0029 §4 | 简报「by/dir 词表混用编译期拒绝」一致 → 保持 |
| F7 无 where 路径零回归 | total = 标识计数、truncated = kept < total、✂ 照旧逐字节（与 ADR 0028 快照一致） | ADR 0029 §5；issue #383 AC1 | AC1 逐字节锚 → 保持（实现后核对） |
| F8 ✂ 窗口事实块 B-8 冻结文法（头行 + 恰一行事实行、四插值槽、注入防御） | where 在场**永不装配**、不呈现过滤槽；无 where 照旧按 truncated 装配 | ADR 0029 §5/备选；`window-read.ts` L351–397 | AC2 明示 → 保持（实现后核对） |
| F9 doc-runtime W1 面（#398 已交付） | 缝 2 预期零 doc-runtime 改动；S3 镜像判据与 W1 一致（非第三套权威）；`read.ts` 零 diff 纪律沿袭 | ADR 0029 §6/§8；`packages/doc-runtime/src/window.ts`（#398） | 简报落点 runtime + registry → 保持（若实现需动 W1 须回门禁复核） |
| F10 lease released 通道与 registry 透传纪律 | released 短路（`NAMESPACE_LEASE_RELEASED`）先于一切透传；lease 层零解释/零校验、raw 引用直传；单源别名链 + Equal 锁 | ADR 0009 L44；`lease.ts` L309–316、L440–450 | 简报「registry 透传组合面」一致 → 保持 |
| F11 恒四键失败形 own 键集 | `RuntimeReadDisabledResult` = `{ok, code, path, message}`；窗口失败 = `{code, ok, path, message}`（message 非契约字段） | ADR 0008 L123；`runtime.ts` L128–133 | AC「四键失败形」一致 → 保持 |

## 6. Evolution requirements

**无新增 evolution 项**（evolution-required ×0）。所需决策演进已在本任务之前正式完成：ADR 0029 已接受入库（`8a4fa40`）；CONTEXT.md「窗口读」分工句 + 「过滤窗口」词条已落（缝 3 闭合）；P1（`1b639e0`）与 P2 缝 1（`de2ff55`）已合并。#383 是已接受决策缝 2 的兑现票，自身不要求任何 ADR/CONTEXT/协议修订，计划完备性核对不适用。

## 7. Hard conflicts

无（hard-conflict ×0）。

## 8. Required actions

- **A1（词表纪律）**：严格按 ADR 0029 §2–§6 缝 2 范围执行；in/范围/OR/NOT/多段 field、容器深相等一律 v1 词表外响亮拒绝（运行时收编 `WINDOW_OPTIONS_INVALID`、编译期 fail-closed），不得以「实现方便」扩大词表（F5/F6）。
- **A2（S3 镜像扩展，判据一致）**：`canonicalWindowBudget` 键集白名单四键 → 五键（加 `where`），镜像判据与 W1 `validateWhere`/`validateWhereTerm` 一致：数组形态、非空、≤16、稀疏空洞非法、零 accessor/零 `[[Get]]`、plain object 原型链、恰 `field`/`equals` 两键、field 字符串、equals 标量闭集（finite number）；两出口（视图不稳定重派发 / 交替视图终态）对 where 判据同步，敌意 where 在组合层零外抛。S3 是接缝净化镜像，不是第三套校验权威（合法性由 W1 单权威裁定）。
- **A3（S6 双语义 + 单源纪律）**：入口 fail-closed 中间态分支（`seamWhereNotImplemented`）按模块注释被「truncated 双语义 + ✂ 永不装配 + S3 镜像扩展」整体取代；where 在场判据键于 W1 结算单源（`total === undefined`），不重读 options；`truncated = (kept === n)`（canonical `n`）；✂ 永不装配、无过滤槽；组合层零计数、零谓词求值镜像（ADR 0029 §8 单源纪律）。
- **A4（类型面与公共导出）**：lease/runtime 类型 fail-closed 经既有单源别名链 + Equal 锚定（勿复制第二份 options/WhereTerm 类型）；若调用方需具名 `WhereTerm`，自 `packages/namespace-runtime/src/index.ts` 与（按需）`packages/namespace-registry/src/index.ts` 再导出并纳入 public-surface 守卫（模块 AGENTS 义务）；registry 转发保持 raw 直传零校验（F10）。
- **A5（测试先例与中间态清账）**：缝 2 测试沿 issue #369 组合面家族 + `runtime-data-interface.test-d` + registry 内部缝先例；`issue-382-lease-where-no-silent-pass.test.ts`（条件不变式耐久形态）缝 2 态必须继续绿（`ok:true` ⟹ 条目全部满足谓词）；缝 1 期间的严格审计断言不得留作会随缝 2 变红的持久测试；全仓 typecheck + 测试绿（AC8）。
- **A6（文档对齐，非阻塞）**：根 `AGENTS.md`「Typed Namespace writes」节列举的 lease 窗口读签名 `readArray/readMap(path, { n, orderBy, depth?, maxChildrenPerNode? })` 未含 `where`——缝 2 落地后宜补注可选 `where` 键（docs/AGENTS.md「代码行为变化时更新每份陈述该契约的规范文档」）；属措辞补全，非冲突（该句未排斥 where，ADR 0029 §1 为权威）。

## 9. Verdict

**`clear`**

全部对照项为 no-conflict（×9）或 implements-existing-decision（×7）：issue #383 是已接受 ADR 0029 验收缝 2 的忠实实现票，逐条款与决策文本对应（truncated 双语义、✂ 装配规则、恒四键 own 键集、组合式 depth 等价锚、registry 透传、类型面 fail-closed、S3 两层同步扩、停接纳不豁免），并正确承接 #382 留下的缝序中间态取代义务；无 evolution-required、无 hard-conflict、无需 override。**放行进入后续 SA 派发**；附带 A1–A6 执行义务（A6 非阻塞）。

## 10. requiresConflictRecheck

**true** —— lease/runtime 公共类型面（options 词表加 `where`、可能的 `WhereTerm` 再导出）、失败语义（S3 镜像判据与两出口、`WINDOW_OPTIONS_INVALID` 收编、truncated 双语义与 ✂ 永不装配）、生命周期（close 停接纳对 where 读取的覆盖）尚待实现核对（F2–F11 冻结面逐项）；缝 2 落地后须复查实现与 ADR 0029 §5/§6 语义一致、中间态分支清账无残留、override 未扩大。
