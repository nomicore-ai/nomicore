# 冲突报告 (Conflict Report) — Issue #337 `[shape-budget] T4: DeepOptional 预算读类型面` 设计后复审

> SA8 设计后复审（design）。裁决基准 = `docs/adr/` 全集 + 根 `CONTEXT.md` + 模块 AGENTS 明文收录的决策。源码仅作现状对照；本报告只裁冲突，不评设计优劣（全维度攻击评审属 SA2）、不代设计、不实现。

## 1. Reviewed subject

**design**：`wiki/raw/task_issue-337_design.md`（SA1 设计，iteration 0；派发 `sa-b3846512-…`，基线 HEAD `cb8aaff`）。

本复审的派发焦点：设计**变更公共协议类型面**（协议包第 13 名导出 `DeepOptional` + `VfslTypedAccess` 新增第 7 方法 `readBudgeted`）并**钉死 typed-access 方法落点**——逐条对照决策集裁决。

被审设计核心 pin：

- D-1：`DeepOptional` 定义在**读值类型域**（`PathValue` 产型域），ADR-0024 L92 记法 `DeepOptional<PathAt<…>>` 经 doc-comment 显式桥接为规范展开 `DeepOptional<PathValue<PathAt<…>>>`；三分支表示（变长数组同态映射不加 `?`、元组元素可选、对象全字段可选，索引签名值位 `| undefined`，标量原样）。
- D-2：预算读类型接缝 = `VfslTypedAccess<Map>` 新增第 7 方法 `readBudgeted`（`read` 之后、`kindOf` 之前），返回 `DeepOptional<PathValue<PathAt<Map, NoInfer<P>>>>`；**否决** runtime/lease `readData` 泛型化落点。
- D-3：无 options 基线零降级 = **零 diff**（runtime/lease/`VfslTypedAccess` 既有六方法/`apps/yjs-server` 全不触）。
- D-4：`DeepOptional` 只从 `@nomicore/vfsl-protocol` 出口；`PROTOCOL_EXPORT_NAMES` 同变更集跟名（13 名）+ 头注计数如实追加注记。
- D-6：判别字段退路**不启用**（E5 实测 TS 5.9.3 支持窄化）；G4 test-d 锚定。
- 文件范围：ALLOW = `packages/vfsl-protocol/src/index.ts` + `packages/vfsl-codegen/src/protocol-surface.ts` + 2 个新 test-d；DENY 含 runtime/registry src、`domains/**`、`docs/integration/**`、`docs/adr/**`、`CONTEXT.md`、typed-access 文档、既有测试。

## 2. Inputs and decision set

- 输入：`wiki/raw/task_issue-337_design.md`（被审对象）；任务简报 `wiki/raw/task_issue-337.md`（Issue #337 正文；REST comments 为空——无 Owner 评论要求，无 override 可言）；上游 SA6 契约 `wiki/raw/task_issue-337_sa6_contract.md`（approve；§15 Q1–Q8 设计 pin 位）；SA8 前置门禁 `wiki/raw/task_issue-337_conflict_report.md`（clear；§8 行动 1–4、§10(a)(b)(c) 复核项）与 `wiki/raw/task_issue-337_relevant_decisions.md`。
- **无 SA2 评审输入**：`wiki/raw/task_issue-337_sa2_review.md` 不存在（glob 实核；设计 §14 已按缺位记录）。SA8 设计后复审不因 SA2 缺位而阻塞（前置门禁 §10 明文：设计复审与实现复审各触发一次 SA8）。
- 决策集：`docs/adr/` 20 文件（0001–0024，无 0015/0020/0021/0023；ls 实核）全部 accepted、无 superseded；条款级修订链 ADR-0008/0016 ← ADR-0024 修订节、ADR-0016 ← ADR-0019 §7。根 `CONTEXT.md` 全读（「形状预算」L45–47 含 `DeepOptional<PathAt<…>>` 记法与 Avoid 项）。模块 AGENTS：vfsl-protocol（纯类型空模块、fail-closed、公共兼容契约、正负 test-d）、vfsl-codegen（生成物确定性、协议 wiring 变更跑 root 门）、namespace-runtime、namespace-registry、domains、docs、根 AGENTS typed-access 强制段。
- 语料扫查（本次复审实核）：`DeepOptional` 在决策语料中仅出现于 ADR-0024 L92/L94/L113 与 CONTEXT.md L46；`readBudgeted` 在 `docs/`、`packages/`、`domains/`、`apps/` **零命中**——方法名是设计 pin，非决策文本义务；无任何 ADR 冻结 `VfslTypedAccess` 方法集（`docs/` grep `VfslTypedAccess` 仅 ADR-0004 D3 枚举与 integration 文档描述）。
- 源码现状实核（对照，不构成基准）：`packages/vfsl-protocol/src/index.ts` 157 行 12 名导出、`read` 返回 `PathValue<PathAt<Map, NoInfer<P>>>`（L126–129）、`VfslTypedAccess` 六方法（L118–154）；`protocol-surface.ts` 冻结 12 名 + 头注同步锚（L1–16）；runtime `readData` 双重载预算在前 legacy 在后、两成功成员 `value: unknown`（runtime.ts L148–220）；lease 镜像 + `_readAlias`/`_readBudgetAlias`/`_readOverloadOrder` Equal 锁（lease.ts L282–295/L405–421）；`keyof VfslTypedAccess` 全仓零命中（无方法集穷尽锚、无在库实现者）；worktree 干净（仅 wiki artifacts 与 SA6 证据 log 未跟踪，零生产改动——实现未开始）。

## 3. Decision analysis

| Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| ADR-0024 | 决策 7 L92：`DeepOptional` 进协议类型面与 `PathAt` 并列导出、零 per-schema 生成 | 设计 D-1/D-4：第 13 名纯类型导出（通用递归映射类型），只从协议包出口、不从 vfsl/runtime/registry 再导出，零生成器输出变更 | **implements-existing-decision** | ADR-0024 L92；设计 §7 D-1/D-4、§11 ALLOW；SA6 P1（现 12 名实测）；`protocol-surface.ts` L13–16 | 无——按条款落地；实现后核 `Object.keys === []`、`dependencies` 零新增 |
| ADR-0024 | 决策 7 L91：无 options 调用保持 `PathAt` 完整子树承诺（编译期权威不降级） | 设计 D-3：零 diff——runtime/lease 签名、Equal 锚、重载序、`VfslTypedAccess.read`、yjs-server 单参消费方全不动；AC1 由「零 diff + G2 既有锚全绿」逐点成立 | **implements-existing-decision** | ADR-0024 L91；设计 §7 D-3、§10 调用方矩阵、§12.1；runtime.ts L214–220、lease.ts L282–295/L405–421（实核）；index.ts L126–129 | 无——实现期 G2.1–G2.5 保持零改动即绿（§8 行动 1） |
| ADR-0024 | 决策 7 L92 记法 `DeepOptional<PathAt<…>>` 的语义域 | 设计 D-1 Q1 pin：值域解释 + `PathValue` 桥接（`DeepOptional<PathAt<…>>` ≡ `DeepOptional<PathValue<PathAt<…>>>`，协议 doc-comment 显式声明），不选载体感知第二套剥壳 | **no-conflict**（记法消歧，非改约——见下判据） | ADR-0024 L91/L92；CONTEXT.md L46（「全字段可选形状」「必填字段的类型承诺只在无预算读成立」）；SA6 §9 E6（载体直套产 `{__brand?; __value?; __kind?}` 壳）；index.ts L61–72（`PathValue` 既有单一剥壳权威）+ L125–129（`read` 的「PathAt 承诺」现行为即 `PathValue<PathAt<…>>`）；设计 §7 D-1 + R-7 | 判据：①L91 平行条款「PathAt 完整子树承诺」的现行实现本就是 `VfslTypedAccess.read` 的 `PathValue<PathAt<…>>`（无 options 动态面恒 `unknown`，从未有 PathAt 承诺）——两条款同源记法；②载体字面读法使 L92 自身语义句（对象全字段可选/标量原样）与 AC2「联合字面量精确」自相矛盾，非规范读法；③决策文本与 CONTEXT 词条零改动，桥接声明落在类型实际所在的协议 doc-comment。实现期核对 doc-comment 桥接段在位（§8 行动 1）；T5 #338 文档同步沿用同一展开口径 |
| ADR-0024 | 决策 7 L91/L92 类型分叉的**落点载体**（条款文本未指定表面）+ 前置门禁 §8.2 落点裁决 | 设计 D-2：钉死落点 = `VfslTypedAccess.readBudgeted`（第 7 方法）；runtime/lease 公共面**不**泛型化（Q4/Q7 义务消解）；动态 `lease.readData(path, options)` 维持 `value: unknown` 运行时形状面 | **no-conflict**（前置门禁已裁落点为设计自由：runtime/lease 公共面、`VfslTypedAccess`、宿主适配器文档面或其组合；本选择在 sanctioned 集内，且分叉在「PathAt 承诺」实际存活的 typed 面兑现） | ADR-0024 L91/L92（表面无关文本）；前置门禁 §8.2（「重载落点……属设计自由，但任一落点的无 options 分支静态类型必须与现状逐点一致」）；SA6 G3.6 后半（「若落点选 `VfslTypedAccess`/宿主适配器（备选），则同组断言迁移到该接缝：无 options 仍 `PathValue<PathAt<…>>`、预算方法返回 `DeepOptional<PathValue<PathAt<…>>>`、未知路径仍编译错误」——契约自身预置的备选分支）；设计 §7 D-2 五点否决链；根 AGENTS typed-access 段（动态 `readData` 面向 runtime-shaped data；typed 读用 `PathAt`/`PathValue`）；ADR-0016 L77（typed-access 加法兼容） | 无——设计即钉死（前置门禁 §10(a) 关闭）；SA6 契约无需原位修订（选择落在 G3.6 预声明备选分支内，§12.3 文件 2 即该分支的落盘清单）。宿主适配器接线示例归 T5 #338，无悬空义务 |
| ADR-0024 | 决策 7 L94：判别字段不豁免；narrowing 由 type-level 测试锚定；退路由 test-d 红灯触发、不在 ADR 预先承诺 | 设计 D-6：不启用退路（E5 实测 TS 5.9.3 支持可选判别窄化，唯一 TS2322）；G4 双文件锚定；实现期意外红灯 → 票内记录 + SA8 复核 | **implements-existing-decision**（条件退路为 ADR 文本内置演进条款，触发条件与记录义务被设计如实镜像） | ADR-0024 L94；设计 §7 D-6；SA6 §9 E5；`domains/vfs3-assets/generated.ts` AssetEntity fixture | 未触发不预防性豁免；若实现期红灯非 TS2322 形态 → 按设计 G4.3 条款记录并再触发 SA8（§8 行动 2） |
| ADR-0024 | 验收 L127 类型面行（无 options 承诺/全字段可选/标量精确/数组递归） | 设计 §12.2 G1（语义）+ G3（接缝）+ G4（窄化）断言组逐点对应 | **implements-existing-decision** | ADR-0024 L127；设计 §12.1/§12.2 | 无——test-d 按 D4 装置落盘 |
| ADR-0024 | L113 备选否决：预算读静态类型 `unknown` 被否 | 设计 `readBudgeted` 返回 DeepOptional 值类型（非 unknown）；动态面 unknown 维持（该面为 ADR-0016 L77/root AGENTS 认可的 runtime-shaped 归宿，且属 L91 零降级对象） | **no-conflict** | ADR-0024 L113；设计 §7 D-2；SA6 P2（预算价值列现状 unknown 即被否方案的实证） | 无 |
| ADR-0024 | L130 + 各包 AGENTS：影响包全套门禁 + root typecheck/test | 设计 §12.3 验证门（包级 tsc ×2、root typecheck、`generate --check`、四包 vitest --typecheck、root test）+ 红灯重捕获前置步 | **implements-existing-decision** | ADR-0024 L130；设计 §11 实现序/§12.3；vfsl-protocol AGENTS（导出类型变更 → root typecheck）、vfsl-codegen AGENTS（protocol wiring 变更 → root typecheck/test） | 无——实现后全门执行 |
| ADR-0024 | L93/L95/L128 typed 纪律与「预算读非写前快照」的 typed-access 文档同步（归 T5 #338） | 设计 DENY `docs/integration/**` 与 `.agents/skills/nomicore/typed-access.md`；仅在**新增类型自身**的协议 doc-comment 内写非写前快照警示与判别不豁免注记 | **no-conflict**（T5 归票不被侵占；新公共类型的 API doc-comment 属本票交付物自身文档，非作用域文档负控对象） | ADR-0024 L93/L95/L128；设计 §1 非目标 4、§11 DENY；前置门禁 §3 L93/L95/L128 行（义务已归 #338） | 无——本票不得顺手落 typed-access 文档/负控正则修订（§8 行动 3） |
| ADR-0004 | D3 L24–28：纯类型 + 接口、编译后空模块、零依赖、零运行时；fail-closed | 设计 D-1/D-2/D-4：`DeepOptional` 为 type-only 导出；`readBudgeted` 为接口方法签名（类型空间产物）；options 用内联封闭形状而非 import doc-runtime（零依赖）；fail-closed 复用 `FailClosedRest`（未知路径 TS2554 不放松） | **implements-existing-decision** | ADR-0004 L24–28；vfsl-protocol/AGENTS.md（empty JS surface / fail-closed / avoid importing runtime packages）；设计 §7 D-1 精确形态、D-2 options 论证、§12.2 G3.6 | 无——实现期核 empty-module 测试绿、`dependencies` 零新增 |
| ADR-0004 | D3 L26 导出面与方法枚举（12 名/六方法为决策时点描述） | 设计加第 13 名导出 + `VfslTypedAccess` 第 7 方法（加法，不改既有名与既有六方法签名） | **no-conflict**（D3 枚举是时点描述，规范内容是形态约束——与前置门禁对第 13 名导出的同一裁决逻辑；无任何决策文本冻结方法集；`readBudgeted` 决策语料零命中） | ADR-0004 L26；ADR-0024 L92（授权协议类型面加法）；前置门禁 §3 ADR-0004 D3 行；`keyof VfslTypedAccess` 全仓零命中 + 在库零实现者（grep 实核，B3）；设计 §10 影响矩阵（外部实现者风险 R-5 走 0.x minor bump 先例 ADR-0024 L69） | 无——既有六方法签名与既有 12 名语义零改动为实现期核对项（§8 行动 1） |
| ADR-0004 | D2 L20–22：成员独有字段 read → `T \| undefined`；整值读发射判别联合、消费方吃 tsc 原生窄化 | 设计 D-1：索引签名值位 `DeepOptional<E> \| undefined`（缺席 = 查找落空，与 D2 同源口径）；D-6：预算面窄化保留（E5）、无预算整值读面零改动（D2 承诺面不受触） | **no-conflict** | ADR-0004 L20–22；设计 §7 D-1 表/D-6；index.ts L31–34（MemberLookup 的 `T\|undefined` 先例） | 无 |
| ADR-0004 | D4 L30–32：正例 expectTypeOf、负例 @ts-expect-error 自反转 | 设计 D-5：相等 + 赋值双向叠加判据（E7 Equal 盲点对策）；§12.2 全部正负例按该装置 | **implements-existing-decision** | ADR-0004 L30–32；设计 §7 D-5 | 无 |
| ADR-0004 | D5 L36：路径不含 ROOT 前缀、`PathAt` 含 `[]` 分支 | 设计 §12.2 根路径锚：`readBudgeted([], {depth:1})` → `DeepOptional<根值>`（`{}` 可赋值正例 + 自有键访问 `string \| undefined`） | **no-conflict** | ADR-0004 L36；index.ts L47–59；设计 §12.2 文件 2 根路径 D5 | 无 |
| vfsl-codegen #45 冻结面（`protocol-surface.ts` 头注明文契约 + 守卫测试）+ 前置门禁 §8.1 | 「协议导出面增名而名单未跟 → silent 清单非空 → 守卫红」「名单更新只改本文件一处」 | 设计 D-4：同变更集增补 `'DeepOptional'`（13 名）；头注计数行**如实追加** T4 注记（不静默改写历史基点描述）；单文件单处更新 | **implements-existing-decision**（名单跟名是机制自身既定义务，前置门禁已定阻塞级） | `protocol-surface.ts` L1–16（实核）；`generate-alias-collision-guard.test.ts` L66–76（checker 实测枚举）；SA6 P5（假想第 13 名 → `silent=['DeepOptional']` 行为级因果）；设计 §7 D-4、§11 ALLOW | 无——实现期核对两处同变更集成对落盘、守卫 13=13 绿（§8 行动 1） |
| ADR-0005 | L43–55/L65：生成管线纪律、生成物入仓 + `generate --check` 新鲜度、生成器在 codegen | 设计：零生成器输出规格变更、零 `domains/*/generated.ts` 触碰、`PROTOCOL_IMPORT_LINE` 不动；codegen 面唯一改动 = 名单文件 | **no-conflict** | ADR-0005 L43–55/L65；ADR-0024 L92「零 per-schema 生成」；设计 §11 ALLOW/DENY、§12.2 G5.4；domains/AGENTS（生成物禁手改） | 实现后 `pnpm generate --check` 零漂移（验证项） |
| ADR-0016 | L69 always-on（经 0024 修订节澄清：预算字段恒在场不构成分叉）/ L77 typed-access 加法兼容 | 设计：纯类型面加法，不触结果形状（恒五键已由 T3 落地）、不触 schema 通道；`readBudgeted` 属 typed-access 面加法 | **no-conflict** | ADR-0016 L69/L77；ADR-0024 L100–101；设计 §1 非目标 | 无 |
| ADR-0008 | L16–27 读取能力（经 0024 L99 修订）；读取不进 sequencer | 设计：零运行时行为变更（type-level only）；不借类型票改读取保留不变量/失败通道/sequencer 边界 | **no-conflict** | ADR-0008 L16–27；ADR-0024 L99；设计 §1 非目标 1、§8（零运行时数据流变化论证） | 无 |
| ADR-0009 | L38 lease 代理 Runtime 同步读取、不公开裸引用 | 设计 Q4/Q7 处置：lease 面零改动，Equal 锚与「legacy 恒为最后」重载序原样保持（其变动前提「落 runtime/lease 面」不成立） | **no-conflict** | ADR-0009 L38；lease.ts L282–295/L405–421（实核）；设计 §7 Q4/Q7 | 无——实现期 lease/registry 包零 diff 即证 |
| ADR-0003 | L46 派生 schema 形状变更须走设计修订流程（ValueSchema 9-kind 冻结面） | `DeepOptional` 是 TS 映射类型，非 ValueSchema 语义联合成员、不触派生 schema 形状 | **no-conflict**（冻结面零接触） | ADR-0003 L46；ADR-0024 L115（`kind:'truncated'` 进 ValueSchema 已否决）；设计 §7 D-1 | 无 |
| CONTEXT.md | L45–47「形状预算」词条（`DeepOptional<PathAt<…>>` 记法 + Avoid「对预算读的值使用非可选访问」） | 设计语义与词条一致（全字段可选、必填承诺只在无预算读成立、可选访问纪律入 G3.3 负例）；不新增/修订词条 | **no-conflict** | CONTEXT.md L45–47（实核）；设计 §1 非目标 6、§12.2 G3.3 | 无——记法展开口径由协议 doc-comment 桥接承载（R-7），词条无需变更 |
| 根 AGENTS.md typed-access 强制段 | 「typed reads should use generated `PathAt`/`PathValue` where static projection is desired」；动态 readData 面向 runtime-shaped data | 设计 `readBudgeted` 恰以 `PathValue<PathAt<…>>` 组合为值域、字面量路径 fail-closed；动态面归宿不变 | **no-conflict** | 根 AGENTS.md typed-access 段；设计 §7 D-2 谱系论证 | 无 |
| registry 文档负控正则（ADR-0024 L105 修订对象，现行「禁一切带参用法」） | 扫描 `docs/integration` 作用域文档 | 设计 DENY `docs/integration/**`；本票零文档触碰 | **no-conflict** | 前置门禁 §3 正则行；设计 §11 DENY；ADR-0024 L105（修订归 T5） | 无——实现期不得引入 `readData(path, …)` 带参示例（§8 行动 3） |
| docs/AGENTS.md 权威规则 | wiki/raw 为证据非规范契约；修订 ADR 须显式、不静默矛盾 | 设计零决策文档改动；SA6 契约不原位修订——落点选择落在其 G3.6 预声明的备选分支内（非「另有选择」） | **no-conflict** | docs/AGENTS.md；SA6 G3.6/§12.3 文件 2（备选落点行）；设计 §7 D-2 第 4 点 | 无 |

计数：**24 项对照 = no-conflict 16 + implements-existing-decision 8；evolution-required 0；hard-conflict 0**。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| （无） | （无——issue comments 为空，无 Owner 评论；无新 ADR/协议版本对本票相关条款再修订） | — | — |

无需任何 override：设计全部 pin 由已接受 ADR-0024 决策 7 与前置门禁落点裁决覆盖；判别字段退路是 ADR-0024 L94 决策文本内置的条件演进条款（当前未触发），非外部 override。SA8 不替 Owner 或 SA1 创建 override。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| ADR-0003 ValueSchema 9-kind 语义联合 | 不新增 kind、不改派生 schema 形状 | ADR-0003 L46；ADR-0024 L115 | 设计不触 ✅ |
| ADR-0004 D3 协议包形态 | 编译后空模块、零依赖、零运行时值导出；空 `VfslPathMap` fail-closed | ADR-0004 L24–28；vfsl-protocol/AGENTS.md | 设计承诺 type-only + 内联 options 形状（不 import doc-runtime）——**待实现核对**（empty-module 测试、`dependencies`） |
| 既有 12 名协议导出及其语义 | 公共兼容契约语义不变（加法不改既有名） | vfsl-protocol/AGENTS.md；index.ts L59–156（实核） | 设计纯加法（新增名 + 新方法，零修改既有声明）——**待实现核对** |
| `VfslTypedAccess` 既有六方法签名 | `patch`/`read`/`kindOf`/序列编辑三件套签名与 `FailClosedRest`/`ArrayEditRest` 机制不变 | index.ts L105–154；ADR-0004 D3 fail-closed | 设计只加第 7 方法，D-3 明文零改动——**待实现核对**（G2.3 差分锁） |
| readData 运行时形状与失败语义 | 恒五键成功面、`READ_OPTIONS_INVALID` 零泄漏、released 通道、读取保留不变量（T3 已落） | ADR-0024 决策 1/4/6；runtime.ts L148–220（实核） | 设计 D-3/Q4/Q7 零接触 ✅——实现期 runtime/registry 包应零 diff |
| 无 options 静态基线（AC1） | 动态面 `value: unknown`、typed 面 `PathValue<PathAt<…>>` 逐点不变；yjs-server 单参消费方编译不破 | ADR-0024 L91；前置门禁 §8.2；index.ts L126–129；apps/yjs-server/app.ts L609 | 设计零 diff 方案——**待实现核对**（G2 指纹 + root typecheck） |
| lease Equal 锚与重载序 | `_readAlias`/`_readBudgetAlias`/`_readOverloadOrder`、「legacy 恒为最后」 | lease.ts L405–421（实核）；ADR-0009 L38 | 设计零接触 ✅ |
| 既有负向类型锚（49 条 `@ts-expect-error`） | 保持真错误（红） | SA6 §4；vfsl-protocol/vfs3-assets test-d；AC4 | **待实现核对**（G0.5） |
| wire / 持久化 / 状态机 / 生命周期 | readData 与类型面不上 wire、不触持久化格式 | `docs/protocols/` grep 零 readData 条款（前置门禁 §2）；ADR-0024 影响包清单 L4 | 设计不触 ✅ |
| 生成物新鲜度 | `domains/*/generated.ts` 零漂移、`generate --check` 绿、`PROTOCOL_IMPORT_LINE` 不动 | ADR-0005 L49–55；protocol-surface.ts L18–19 | **待实现核对**（G5.4） |
| 作用域文档负控面 | `docs/integration` 不引入 `readData(path, …)` 带参示例（现行正则禁一切带参用法） | 前置门禁 §3；ADR-0024 L105 | 设计 DENY 覆盖 ✅ |

## 6. Evolution requirements

无 `evolution-required` 项。说明：

1. 公共协议类型面的**加法**（第 13 名导出 + `VfslTypedAccess` 第 7 方法）与预算读类型分叉已由 ADR-0024 决策 7（L91/L92）完成立法；落点表面由前置门禁 §8.2 裁为设计自由，本设计钉死在 sanctioned 集内的访问面。CONTEXT.md「形状预算」词条（L45–47）已含记法口径，无术语缺口——设计不触 ADR/CONTEXT，正确。
2. `DeepOptional<PathAt<…>>` 记法的值域桥接（D-1 Q1 pin）是**消歧**而非改约：L91 平行条款的现行实现（`read` 的 `PathValue<PathAt<…>>`）证明记法本就指经 `PathValue` 的读值域；载体字面读法与 L92 自身语义句及 AC2 矛盾，非规范读法。桥接声明落在新类型的协议 doc-comment（类型实际所在地），决策文本零改动——不构成需要同变更集修订 ADR/CONTEXT 的新决策面。残余读者歧义（R-7）的文档面传播已归 T5 #338（谱系完整）。
3. 数组/元组/索引签名三态表示（D-1 Q2 pin）与 EOPT 精确断言（D-5 Q5 pin）是**新类型自身**的形状细化——决策文本从未描述过该类型的产品形态（SA6 §15 明文「ADR 未逐字钉死」并预置 SA1 pin 位 + 默认判据「元素递归 + 无多余 `\| undefined` + 修饰符保留」），设计选择恰为默认判据，无既有契约被改变。
4. 唯一条件演进路径——判别字段保持必选退路——是 ADR-0024 L94 文本自身允许的条款，设计未触发（E5 证据）且登记了再触发规则；触发与否均无需新 ADR。
5. 既有的 ADR-0008/0016 文本「ADR 0024 修订」回填批注缺口为 PR #332 / T5 #338 已登记残余（T2/T3 门禁与本前置门禁同判非阻塞），非本设计引入、亦非本票义务。

## 7. Hard conflicts

无。未发现任何与 accepted 决策不兼容且无合法修订路径的条款。

## 8. Required actions

1. **实现期核对清单**（本报告 `requiresConflictRecheck` 的核对物，归实现后 SA8 复查）：
   - 名单跟名与加名**同变更集成对**落盘，守卫 13=13 绿、`silent=[]`；头注计数注记如实（不静默改写 2026-08-21 基点描述）；
   - runtime/registry 包零 diff（Equal 锚、重载序、结果联合原样）；yjs-server 编译面不破（root typecheck）；
   - 既有 12 名导出与六方法签名零语义改动；49 条既有负向锚保持红；empty-module `Object.keys === []`；`dependencies` 零新增；
   - `generate --check` 零漂移；`PROTOCOL_IMPORT_LINE` 不动；
   - `DeepOptional` doc-comment 桥接声明（记法展开 + 非写前快照警示 + 判别不豁免）与 `readBudgeted` doc-comment（L91/L92 分叉说明）在位；
   - 红灯纪律：两测试文件先落盘在 HEAD 复现 TS2305/TS2339 红再实现。
2. **AC3 条件路径**：若实现期判别窄化 test-d 意外红灯（非 TS2322 形态）→ 启用退路前必须票内记录证据与结论并再触发 SA8 复核（设计 G4.3 已内置该规则）；未触发不得预防性豁免。
3. **边界纪律**：本票不顺手落 T5 #338 义务（typed-access 预算纪律文档、文档负控正则修订、`docs/integration` 形状注记、ADR 0008/0016 回填）；不得在作用域文档引入 `readData(path, …)` 带参示例。
4. **实现后复审触发**：实现 diff 触碰协议类型面（必然）→ 按前置门禁 §10 与本报告 §10 运行 implementation 复查。

## 9. Verdict

**clear**

- 24 项对照全部为 `no-conflict`（16）或 `implements-existing-decision`（8）；无 `evolution-required`、无 `hard-conflict`、无悬空义务。
- 派发焦点逐项裁决：**公共协议类型面变更**（第 13 名导出 + 第 7 方法）= ADR-0024 决策 7 立法内的加法兑现，ADR-0004 D3 形态约束（纯类型/零依赖/空模块/fail-closed）全数遵守，名单跟名义务已按阻塞级纳入设计；**typed-access 方法钉死**（`readBudgeted` 落点）= 前置门禁 §8.2 裁定的设计自由内选择，SA6 G3.6 预声明备选分支，L91/L92 分叉在「PathAt 承诺」实际存活的 typed 面兑现，无 options 零降级以零 diff 最稳形态成立；记法桥接与三态表示均为消歧/pin，非改约。
- 设计可直接进入实现（SA2 攻击评审缺位不构成 SA8 阻塞；如总控另行安排 SA2，属质量评审轨道，与本门禁无关）。

## 10. requiresConflictRecheck

**true**

理由：公共 API 类型面（协议包第 13 名导出 + `VfslTypedAccess` 第 7 方法）**尚待实现核对**——§5 表多行「待实现核对」（名单成对落盘、既有名/方法语义零改动、Equal 锁零触碰、负向锚保持红、生成物零漂移、doc-comment 桥接在位、无 options 基线零 diff）；判别字段退路为条件路径（当前未触发），触发即改变公共类型面形状并须再复核。实现 diff 落地后须运行 implementation 复查（§8 行动 4）；该复查闭合前本 flag 保持 true。
