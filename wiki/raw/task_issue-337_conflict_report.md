# 冲突报告 (Conflict Report) — Issue #337 `[shape-budget] T4: DeepOptional 预算读类型面`

> SA8 前置门禁（task）。裁决基准 = `docs/adr/` 全集 + 根 `CONTEXT.md` + 模块 AGENTS 明文收录的决策。源码仅作现状对照。

## 1. Reviewed subject

**task**（前置门禁）：`wiki/raw/task_issue-337.md` 简报 vs 决策全集。

简报需求：`DeepOptional` 通用递归映射类型（对象全字段可选并递归 / 数组元素递归 / 标量原样）进协议类型面与 `PathAt` 并列导出；readData 重载——无 options 保持 `PathAt` 完整子树承诺、带 options 返回 `DeepOptional<PathAt<…>>`。AC：①无 options 静态类型与现行为完全一致（PathAt 承诺零降级，type-level）；②预算读全字段可选、在场标量保精确类型（联合字面量）、数组元素递归（type-level）；③判别联合附注——可选化判别字段 switch narrowing 由 test-d 锚定，TS 不容时启用「判别字段保持必选」退路并在票内记录；④未知路径/错误值既有负向类型锚保持红 + 全套包门禁 + root typecheck/test。

## 2. Inputs and decision set

- 输入：`wiki/raw/task_issue-337.md`（issue #337 正文同源；**REST comments 为空——无 Owner 评论要求，无 override 可言**）。
- 决策集：`docs/adr/` 20 文件（0001–0024，无 0015/0020/0021/0023）逐个清点——全部 accepted、无 superseded；条款级修订链：ADR-0008/0016 ← ADR-0024 修订节（corpus 内显式登记）、ADR-0016 ← ADR-0019 §7。根 `CONTEXT.md` 全读（「形状预算」词条已含 `DeepOptional<PathAt<…>>` 口径）。模块 AGENTS：vfsl-protocol / vfsl-codegen / namespace-runtime / namespace-registry / domains / docs。`docs/protocols/`、`docs/vfsl/` grep——readData 与类型面不上 wire、不进语言 spec。
- 现状基线（worktree `mabf/issue-337`，HEAD `cb8aaff`）：T0–T3 已合入；readData 运行时双重载已落（runtime.ts L214–220、lease.ts L282–295），`value: unknown`；`DeepOptional` 全仓 `*.ts` 零命中；协议导出面 12 名；`PROTOCOL_EXPORT_NAMES` 冻结名单 12 名；Blocked-by #336 已解除。
- 逐条对照见 `wiki/raw/task_issue-337_relevant_decisions.md`（条款行号摘录）。

## 3. Decision analysis

| Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| ADR-0024 | 决策 7 L92：`DeepOptional<PathAt<…>>` 进协议类型面与 `PathAt` 并列导出，零 per-schema 生成 | 简报 What-to-build 逐字兑现该条款（通用递归映射类型 + 并列导出） | **implements-existing-decision** | `docs/adr/0024-readdata-shape-budget.md` L92；简报 L17 | 无——按条款落地 |
| ADR-0024 | 决策 7 L91：无 options 调用保持 `PathAt` 完整子树承诺（编译期权威不降级） | AC1「无 options 调用的静态类型与现行为完全一致（PathAt 承诺零降级）」 | **implements-existing-decision** | ADR-0024 L91；简报 L21；现状：runtime/lease readData `value: unknown`（runtime.ts L151/L166）、typed read 权威在 `VfslTypedAccess.read`/宿主适配器（vfsl-protocol/src/index.ts L126–129；external-project-vfsl-codegen.md §5） | SA1 需钉死「现行为」基准面（见 §8 行动 2）：无 options 分支的静态类型逐点不变，含 Equal 锚与 apps/yjs-server 单参消费方 |
| ADR-0024 | 验收 L127：类型面——预算读全字段可选、在场标量保精确类型、数组元素递归 | AC2 与验收行逐点对应 | **implements-existing-decision** | ADR-0024 L127；简报 L22 | 无——test-d 正例按 D4 装置（expectTypeOf）锚定 |
| ADR-0024 | 决策 7 L94：判别字段不豁免；narrowing 由 type-level 测试锚定；TS 不容时退路「判别字段保持必选」，由 test-d 红灯触发，不在本 ADR 预先承诺 | AC3 逐字镜像（含「并在票内记录」义务） | **implements-existing-decision**（条件退路为 ADR 决策文本自身允许的演进条款，非新决策面） | ADR-0024 L94；简报 L23；`domains/vfs3-assets/generated.ts` `AssetEntity`（kind 判别联合）为现成 fixture | 退路触发时：test-d 红灯证据 + 票内记录（AC3 已含）；退路未触发时不得预防性豁免判别字段 |
| ADR-0024 | 验收 L130 + 各包 AGENTS 验证门 | AC4「全套包门禁 + root typecheck/test」 | **implements-existing-decision** | ADR-0024 L130；vfsl-protocol AGENTS（导出类型变更 → root typecheck）；vfsl-codegen AGENTS（protocol wiring 变更 → root typecheck/test） | 无——按门禁执行 |
| ADR-0024 | L113 备选否决：预算读静态类型 `unknown` 被否 | 简报不采用 unknown（带 options 返回 DeepOptional） | **no-conflict** | ADR-0024 L113 | 无 |
| ADR-0024 | L93/L95/L128：typed 纪律与「预算读不是写前完整快照」的 typed-access 文档同步锚定 | 简报不含文档同步（纯类型面票） | **no-conflict**（谱系归票：T5 #338 面——非本票义务，无悬空） | ADR-0024 L93/L95/L128；`task_issue-336_conflict_report.md` L67（T5 = typed-access 预算纪律条款）；T3 设计 §13 残余清单 L1026 | 无——义务已归 #338，本票不得顺手改 typed-access 文档（负控正则仍禁带参用法示例） |
| ADR-0004 | D3 L24–28：协议包纯类型 + 接口、编译后空模块、零依赖、零运行时；空表 fail-closed | `DeepOptional` 为纯类型导出（映射类型），包形态不变 | **no-conflict** | ADR-0004 L24–28；vfsl-protocol/AGENTS.md「emitted JavaScript surface empty」 | 实现禁运行时值导出/依赖引入（§8 行动 3） |
| ADR-0004 | D3 L26 导出面枚举（12 名列举）+ ADR-0024 L92「进协议类型面与 PathAt 并列导出」 | 第 13 名 `DeepOptional` 加法导出 | **implements-existing-decision**（D3 枚举为决策时点描述，规范内容是形态约束；加法导出由 ADR-0024 明文授权并列） | ADR-0004 L26；ADR-0024 L92（影响包列 `@nomicore/vfsl-protocol`，L4） | 无 |
| vfsl-codegen #45 冻结面（`PROTOCOL_EXPORT_NAMES`，模块内明文契约 + 守卫测试） | `protocol-surface.ts` L8–11：导出面增名而名单未跟 → 碰撞守卫测试红；「名单更新只改本文件一处」 | 协议加名后名单须同变更集跟名 | **implements-existing-decision**（名单跟名是 #45 契约自身的既定义务） | `packages/vfsl-codegen/src/protocol-surface.ts` L13–16 及头注 L8–11；`generate-alias-collision-guard.test.ts` L66–76（checker.getExportsOfModule 实测枚举，自动跟随漂移） | **必须**：同变更集在 `PROTOCOL_EXPORT_NAMES` 增 `'DeepOptional'`（§8 行动 1） |
| ADR-0004 | D2 L20–22：成员独有字段 read → `T\|undefined`；整值读取发射判别联合、消费方吃 tsc 原生窄化 | DeepOptional 对判别字段不豁免 → 预算读 narrowing 可能失效 | **no-conflict**（张力已由 ADR-0024 L94 显式登记并给出 test-d 触发退路；D2 窄化承诺属无预算整值读取面，该面 AC1 零降级保护） | ADR-0004 L20–22；ADR-0024 L94 | 无——按 AC3 锚定；退路触发时票内记录 |
| ADR-0004 | D4 L30–32：正例 expectTypeOf、负例 @ts-expect-error 自反转 | AC3/AC4 的 test-d 装置 | **implements-existing-decision** | ADR-0004 L30–32 | 无 |
| ADR-0005 | L43–55 生成管线：生成物入仓 + `generate --check` 新鲜度；L65 生成器在 vfsl-codegen | DeepOptional 零 per-schema 生成——生成器输出规格与 `domains/*/generated.ts` 零变更 | **no-conflict** | ADR-0024 L92「零 per-schema 生成」；ADR-0005 L49–55；`domains/AGENTS.md` | 实现后 `pnpm generate --check` 应零漂移（验证项） |
| ADR-0016 | L69 always-on / 结果形状不随参数分叉（经 0024 修订节第 1 条澄清：预算字段恒在场自描述）；L77 typed-access 投影与 codegen 加法兼容 | readData 静态重载 = 类型面加法，不触结果形状（T3 已落恒五键）与 schema 通道 | **no-conflict** | ADR-0016 L69/L77；ADR-0024 L100–101 | 无 |
| ADR-0008 | L16–27 读取能力（被 0024 L99 修订为预算内投影；不传预算 = 完整投影）；读取不进 sequencer | 本票 type-level only，零运行时行为变更 | **no-conflict** | ADR-0008 L16–27；ADR-0024 L99；runtime.ts L214–220 现状 | 无——不得借类型票改运行时语义 |
| ADR-0009 | L38 lease 代理 Runtime 同步读取、不公开裸引用 | 若重载落 lease 面：类型别名跟随 + 镜像重载序 | **no-conflict** | ADR-0009 L38；lease.ts L282–295/L410–420 | Equal 锚（`_readAlias`/`_readAliasBudget`/`_readOverloadOrder`）如需变动须同变更集有意更新并保持「legacy 恒为最后」（§8 行动 2） |
| ADR-0003 | L46 派生 schema 形状变更须走设计修订流程（ValueSchema 9-kind 冻结面） | DeepOptional 是 TS 映射类型，非 ValueSchema 成员 | **no-conflict**（冻结面零接触） | ADR-0003 L46；ADR-0024 L115（`kind:'truncated'` 进 ValueSchema 已否决——T2 已落投影包装联合） | 无 |
| 根 AGENTS.md typed-access 强制段 | 「typed reads should use generated `PathAt`/`PathValue` where static projection is desired」；dynamic readData 面向 runtime-shaped data | 本票强化 typed 读面（预算读可选访问口径） | **no-conflict** | 根 AGENTS.md；CONTEXT.md L47 Avoid「对预算读的值使用非可选访问」 | 无 |
| CONTEXT.md | L45–47「形状预算」词条已含 DeepOptional 静态类型口径与 Avoid 项 | 简报口径与词条一致 | **no-conflict** | CONTEXT.md L45–47 | 无——本票无需词条变更；文档负控/形状注记同步归 T5 #338 |
| registry 文档负控正则（ADR-0024 L105 修订对象，现行「禁一切带参用法」） | `readDataOptionUsages` 扫 docs/integration 作用域文档 | 本票纯代码/类型测试面，不触 docs/integration | **no-conflict**（正则修订归 T5 #338；本票不得在作用域文档引入 `readData(path, …)` 带参示例——现行负控会红） | fixture L109–116；sync-control 测试 L244–249；ADR-0024 L105 | 无 |
| 谱系 | #337 Blocked by #336 | #336 已合入（`cb8aaff`） | **no-conflict** | git log `cb8aaff` | 无 |

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| （无） | （无——issue comments 为空，无 Owner 评论；无新 ADR/协议版本对本票相关条款再修订） | — | — |

本票无需任何 override：全部需求由已接受 ADR-0024 决策 7 直接授权；判别字段退路是 ADR-0024 决策文本自身内置的条件演进条款（L94），非外部 override。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| ADR-0003 ValueSchema 9-kind 语义联合 | 不新增 kind、不改派生 schema 形状 | ADR-0003 L46；ADR-0024 L115 | 本票不触——DeepOptional 是 TS 映射类型 ✅ |
| ADR-0004 D3 协议包形态 | 编译后空模块、零依赖、零运行时值导出；空 `VfslPathMap` fail-closed 不变 | ADR-0004 L24–28；vfsl-protocol/AGENTS.md | 待实现核对（设计/实现须保持纯类型导出） |
| 既有 12 名协议导出及其语义 | `PathSchema`/`PathAt`/`PathValue`/`PathKind`/`PathPatchValue`/`PathElementValue`/`VfslTypedAccess`/`VfslPathMap` 等公共兼容契约语义不变（加法导出不改既有名） | vfsl-protocol/AGENTS.md「public compatibility contracts」；index.ts L59/L72/L81/L96/L118/L156 | 待实现核对 |
| readData 运行时形状与失败语义 | 恒五键成功面、`PATH_NOT_ALLOWED`/`READ_OPTIONS_INVALID`/`RUNTIME_READ_DISABLED`/released 各通道（T3 已落）——类型票零运行时变更 | ADR-0024 决策 1/4；runtime.ts L148–172 | 本票不触运行时 ✅ |
| 无 options 静态类型（AC1） | `value: unknown` 现行为 / `VfslTypedAccess.read` 与宿主适配器的 `PathValue<PathAt<…>>` 承诺零降级 | ADR-0024 L91；简报 L21；apps/yjs-server/app.ts L609（单参消费方） | 待实现核对（type-level 回归锚） |
| 既有负向类型锚 | vfsl-protocol 空 fail-closed / projection test-d、domains projection/migration test-d 的 `@ts-expect-error` 保持红 | vfsl-protocol/test/*.test-d.ts；domains/vfs3-assets/test/*.test-d.ts；简报 L24 | 待实现核对（AC4） |
| wire / 持久化 / 状态机 / 生命周期 | readData 与类型面不上 wire、不触持久化格式 | grep `docs/protocols/` 零 readData 条款；ADR-0024 影响面包清单 L4 | 本票不触 ✅ |
| 生成物新鲜度 | `domains/*/generated.ts` 零漂移、`generate --check` 绿 | ADR-0005 L49–55；ADR-0024 L92 零 per-schema 生成 | 待实现核对 |

## 6. Evolution requirements

无 `evolution-required` 项。说明两点：

1. 公共协议类型面的**加法**（第 13 名导出）与 readData 静态重载已由 ADR-0024 决策 7 完成立法——本票是该决策的兑现，不构成需要再修订 ADR/CONTEXT/协议的新决策面。CONTEXT.md「形状预算」词条（L45–47）已预先含 `DeepOptional<PathAt<…>>` 口径，无术语缺口。
2. 唯一的条件演进路径——判别字段保持必选退路——是 ADR-0024 L94 决策文本**自身允许**的演进条款（「由 test-d 红灯触发，不在本 ADR 预先承诺」），触发条件与记录义务（test-d 证据 + 票内记录）已在简报 AC3 镜像。触发与否均无需新 ADR；触发时的静态面变化（判别字段必选）应在实现票与发布说明中如实呈现。

既有的 ADR-0008/0016 文本「ADR 0024 修订」回填批注缺口为 PR #332 / T5 #338 面的已登记残余（T2/T3 门禁同判非阻塞：修订权威链在 ADR-0024 修订节内完整，docs/AGENTS「显式修订、不静默矛盾」已满足），非本票引入、亦非本票义务。

## 7. Hard conflicts

无。未发现任何与 accepted 决策不兼容且无合法修订路径的条款。全部 21 项对照为 no-conflict（13）或 implements-existing-decision（8）。

## 8. Required actions

1. **名单跟名（阻塞级门禁义务）**：协议包新增 `DeepOptional` 导出的同一变更集必须在 `packages/vfsl-codegen/src/protocol-surface.ts` 的 `PROTOCOL_EXPORT_NAMES` 增补 `'DeepOptional'`——否则 `generate-alias-collision-guard.test.ts`（实测枚举导出面）必红。该文件头注明文「名单更新只改本文件一处」；此为 #45 冻结面机制自身的同步义务，随 AC4 全套包门禁强制。
2. **SA1 设计须钉死「现行为」基准与落点**（本报告只裁冲突，不代设计）：
   - 无 options 静态类型的零降级基准须逐面声明：runtime/lease `readData` 现为 `value: unknown`（`NamespaceRuntimeReadDataResult`）；`PathAt` 完整子树承诺现活在 `VfslTypedAccess.read` 与宿主 `TypedNamespace` 适配器模式（typed-access.md / external-project-vfsl-codegen.md §5）。重载落点（runtime/lease 公共面、`VfslTypedAccess`、宿主适配器文档面或其组合）属设计自由，但任一落点的无 options 分支静态类型必须与现状逐点一致，且 `apps/yjs-server` 单参消费方编译面不破。
   - 若落 runtime/lease 公共面：`namespace-runtime`/`namespace-registry` 现无 `@nomicore/vfsl-protocol` 依赖（新包图边，无 ADR 禁止）；lease 面 Equal 锚（`_readAlias`/`_readAliasBudget`/`_readOverloadOrder`）与「legacy 恒为最后」重载序为包内公共契约锁，如需变动须同变更集有意更新；公共结果类型如从 `unknown` 加宽/改型，按 ADR-0024 L69 先例（0.x minor bump + 已知消费方可枚举）随发布流处理。
3. **实现纪律**（条款直读）：`DeepOptional` 为纯类型导出——零运行时值导出、零新依赖、编译后空模块不变（ADR-0004 D3 + vfsl-protocol AGENTS）；零 per-schema 生成——生成器输出规格与 `domains/*/generated.ts` 零改动，`pnpm generate --check` 零漂移（ADR-0024 L92 + ADR-0005）；不得在 docs/integration 作用域文档引入 `readData(path, …)` 带参示例（现行负控正则禁一切带参用法，修订归 T5）；typed-access 文档同步（L93/L95 纪律条款）归 T5 #338，本票不顺手代落。
4. **AC3 退路义务**：判别字段「保持必选」退路仅在 test-d 红灯实证 TS 不容可选化判别字段 narrowing 后启用，触发时在票内记录证据与结论（AC3 已含）；未触发不得预防性豁免。

## 9. Verdict

**clear**

- 全部对照项为 `no-conflict` 或 `implements-existing-decision`；无 `evolution-required`（立法已由 ADR-0024 决策 7 完成，条件退路为 ADR 文本内置条款）；无 `hard-conflict`；无悬空义务（文档负控/typed-access 纪律/ADR 回填均归票 T5 #338 / PR #332，谱系完整）。
- 前置门禁放行：可进入 SA1 设计。§8 行动 1（导出名名单跟名）为实现期硬义务，行动 2 为 SA1 必须显式钉死的设计基准，均不构成门禁阻塞。

## 10. requiresConflictRecheck

**true**

理由：本票新增公共 API 类型面（协议包第 13 名导出 + readData 静态重载落点待 SA1 钉死）尚待设计与实现核对——(a) 重载落点与无 options 零降级基准需设计复审确认；(b) 判别字段退路为条件路径，触发与否直接改变公共类型面形状；(c) `PROTOCOL_EXPORT_NAMES` 跟名、Equal 锁、生成物零漂移、负向锚保持红均需实现后逐项核对（§5 表「待实现核对」行）。按谱系，design 复审（SA1 产出后）与 implementation 复审（diff 触碰协议类型面时）各触发一次 SA8 复查。
