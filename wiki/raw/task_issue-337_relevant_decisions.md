# 相关决议 (Relevant Decisions) — 全链 SA 复用

> SA8 前置门禁产出。只摘录，不裁决；引用编号与原文行号，需要时按编号回查 ADR 全文。

## 任务标识

- 任务：Issue #337 — `[shape-budget] T4: DeepOptional 预算读类型面`（State: open；issue 更新于 2026-09-12T18:47:36Z）
- 简报：Issue #337 正文（REST comments 为空——无 Owner 评论要求）与 `wiki/raw/task_issue-337.md`（同源摘要）
- Worktree：`/home/wangjian/nomicore-fix-issue-337`（branch `mabf/issue-337`，HEAD `cb8aaff`；ADR 0024 三次提交 `50d52a1`/`7679c57`/`ba11f32` 已在，T0 #333/PR #343、T1 #334/PR #341、T2 #335/PR #342、T3 #336/PR #352 均已合入——本票 Blocked-by #336 已解除）
- 冲突基准：`docs/adr/` 全集 **20 个文件（0001–0024，无 0015/0020/0021/0023 号文）逐个清点状态、相关者全文细读** + 根 `CONTEXT.md` 全读 + `packages/vfsl-protocol/AGENTS.md` / `packages/vfsl-codegen/AGENTS.md` / `packages/namespace-runtime/AGENTS.md` / `packages/namespace-registry/AGENTS.md` / `domains/AGENTS.md` / `docs/AGENTS.md` 模块契约 + `docs/protocols/`、`docs/vfsl/` grep 核对（无 readData/DeepOptional 条款面——readData 不上 wire、类型面不进语言 spec）
- Ticket 谱系（tracking issue #331 / ADR 0024 / PR #332 `adr-0024-readdata-shape-budget`）：
  T0 #333（形状断言 helper 化 prefactor，已合入）→ T1 #334（值通道三参化与截断省略，doc-runtime 面，已合入）→ T2 #335（投影通道三参化与截断标记，vfsl 面，已合入）→ T3 #336（readData 五键组合 + READ_OPTIONS_INVALID + lease 透传，已合入）→ **T4 #337（本票：DeepOptional 预算读类型面，vfsl-protocol 协议类型面 + readData 静态重载）** → T5 #338（文档负控与形状注记同步）

## 现状确认（源码事实，仅供对照，不构成冲突基准）

- `DeepOptional` 全仓 `*.ts` **零命中**（packages/ domains/ apps/ tests/ grep 0 hits）——本票为全新落地面，无先行实现、无陈旧引用。
- `packages/vfsl-protocol/src/index.ts`（157 行，纯类型模块）：现行导出面 **12 名**——`VfslKind`、`PathSchema`、`UnknownPath`、`RootSchema`、`PathAt`（L59）、`VfslValueOf`、`PathValue`（L72）、`PathKind`、`PathPatchValue`（L81）、`PathElementValue`（L96）、`VfslTypedAccess`（L118，六方法 `patch/read/kindOf/appendToArray/insertIntoArray/deleteFromArray`）、`VfslPathMap`（L156 空接口）。零依赖、零运行时值导出（ADR-0004 D3）。
- `packages/vfsl-codegen/src/protocol-surface.ts` L13–16：`PROTOCOL_EXPORT_NAMES` 冻结快照 12 名（2026-08-21 基点 `5907dc3`）——**生产发射器碰撞守卫名单的单一数据源**；文件头注 L8–11 明文同步锚机制：「协议导出面【增名】而本名单未跟 → 实测新名不抛 → silent 清单非空 → 该测试红」「名单更新只改本文件一处」。守卫测试 `packages/vfsl-codegen/test/generate-alias-collision-guard.test.ts` L66–76 经 `tsc-helper.ts` `protocolExportNames()`（checker.getExportsOfModule **实测枚举**，L76–88）逐一作碰撞别名断言必抛——测试自动跟随导出面漂移，不靠手工名单。
- `packages/namespace-runtime/src/runtime.ts` L214–220：`readData` 公共面已双重载（T3 落地）——`(path, options) => NamespaceRuntimeReadDataBudgetResult` 在前、`(path) => NamespaceRuntimeReadDataResult` 在后；L148–157 / L163–172 两结果联合的 `value` 均为 **`unknown`**（L151/L166）；L212–213 注注明「重载序：预算重载在前、legacy 在后（`ReturnType` 取末签名 → registry lease 的 `_readAlias` Equal 锚原文保持）」。
- `packages/namespace-registry/src/lease.ts` L282–295：lease `readData` 双重载镜像 runtime（legacy 排最后）；L410–420 类型级 Equal 锚——`_readAlias`（legacy 返回型 = `ReturnType<runtime.readData>` 末签名 ∪ released issue）、`_readAliasBudget`、`_readOverloadOrder`（「重载序稳定锁：legacy 恒为最后」）。`packages/namespace-registry/src/types.ts` L675–679 接口面同构。
- `packages/namespace-runtime/package.json` / `packages/namespace-registry/package.json`：**均无 `@nomicore/vfsl-protocol` 依赖**（依赖止于 doc-runtime/vfsl/persistence 等）；`packages/vfsl-protocol/package.json` 零 dependencies。
- 既有 typed-read 模式（`.agents/skills/nomicore/typed-access.md` L42–46 + `docs/integration/external-project-vfsl-codegen.md` §5 L231–288）：宿主自持 `TypedNamespace` 薄适配器，`read<P>(path)` 返回 `PathValue<PathAt<VfslPathMap, P>>`，以**单一窄断言**从 `lease.readData(path)` 的 `unknown` value 桥接——「静态 `PathAt` / `PathPatchValue` 类型恒为编译期权威」（typed-access L124）。
- 既有负向类型锚（本票 AC4 指定保持红）：`packages/vfsl-protocol/test/vfsl-protocol-empty-fail-closed.test-d.ts`（空表 fail-closed，`@ts-expect-error` 自反转断言）、`packages/vfsl-protocol/test/vfsl-protocol-projection.test-d.ts`、`domains/vfs3-assets/test/vfs3-assets-projection.test-d.ts` / `vfs3-assets-migration.test-d.ts`。
- `domains/vfs3-assets/generated.ts`：判别联合 `AssetEntity`（`kind: 'image' | 'text' | 'file'` 字面量判别字段）在场——AC3 判别字段 narrowing test-d 锚的现成 fixture 形态；生成物仅 import `PathSchema` 一名（`PROTOCOL_IMPORT_LINE`）。
- 已知 readData 消费方：`apps/yjs-server/src/app.ts` L609 `lease.readData(path)` 单参调用（opRead，T3 门禁 N1 已补列的枚举消费方）；`docs/integration/cordis-plugin-hosting.md` L340「恰三键」形状注记与 registry 文档负控正则仍待 T5 修订。
- 文档负控正则 `readDataOptionUsages`（`packages/namespace-registry/test/readdata-docs-adr0016-contract-fixture.ts` L109–116，`readdata-docs-adr0016-sync-control.test.ts` L244–249 消费）：扫描对象 = `SCOPE_DOCS`（docs/integration 作用域文档），**不扫代码**；现行语义「禁一切带参用法」，修订（只禁 schema opt-in、放行预算形态）归 T5 #338（ADR-0024 L105）。
- 未落地面（谱系归票核对）：`DeepOptional` 类型（本票 T4）；文档负控正则修订、`docs/integration` 恰三键→恒五键形状注记、typed-access 预算纪律条款（ADR-0024 L93/L95/L128——T5 #338 面，非本票）；ADR 0008/0016 文本回填「ADR 0024 修订」批注节（PR #332 / T5 面，T2/T3 门禁均注记非阻塞——修订权威链在 ADR 0024 修订节内完整）。

## 相关 ADR

### ADR-0024 readData 形状预算——depth/width 截断省略与截断清单（accepted，2026-09-12；本票直接母法）

`docs/adr/0024-readdata-shape-budget.md`（tracking issue #331；CONTEXT.md「形状预算」词条已含 DeepOptional 静态类型口径）

- 与本任务的关联点：本票全部需求是 ADR 0024 **决策 7（类型面）+ 验收 L127（类型面验收行）** 的 T4 切片兑现。
- 核心条款（原文摘录，编号=文件行号）：
  1. L91（决策 7 第一条）：「**无 options 调用**：保持 `PathAt` 完整子树承诺（编译期权威不降级）」。
  2. L92（决策 7 第二条——本票直接授权）：「**带 options 调用**：静态类型为 `DeepOptional<PathAt<…>>`——通用递归映射类型（对象 → 全字段可选并递归；数组 → 元素递归；标量 → 原样），进协议类型面与 `PathAt` 并列导出，**零 per-schema 生成**」。
  3. L93（决策 7 typed 纪律——**T5 #338 面**）：「typed 纪律（typed-access 文档同步）：需要静态类型完整性的读不传预算；预算读的值一律可选访问」。
  4. L94（决策 7 判别联合附注——本票 AC3 母文）：「`DeepOptional` 对判别字段**不豁免**（如实反映『width 可裁任何字段』）；可选化判别字段的 narrowing 兼容性由 type-level 测试锚定，TS 不容时退路为『判别字段保持必选』——**由 test-d 红灯触发，不在本 ADR 预先承诺**」。
  5. L95（决策 7 写前快照禁令——纪律面随 typed-access 文档 T5 锚定）：「**预算读不是写前完整快照**：预算读的值不得作为写前完整快照使用；mutation 构造必须显式，不从截断值隐式继承字段」。
  6. L113（备选否决——`unknown` 方案被否，保结构感知动机）：「预算读静态类型 `unknown`：丢掉全部结构感知与在场标量的精确类型，过保守；`DeepOptional` 以一个通用映射类型的代价保住了两者」。
  7. L127（验收·类型面行——本票 AC 直接对应）：「**类型面（type-level）**：无 options 保持 `PathAt` 承诺、预算读全字段可选、在场标量保精确类型、数组元素递归」。
  8. L128（验收·文档负控行——**T5 #338 面**）：typed-access 纪律条款「纳入作用域文档锚定」；L130 影响包全套门禁 + root `pnpm typecheck` / `pnpm test`（本票 AC4 对应）。
  9. L69（破坏面论据——公共类型面变更的发布纪律先例）：影响包已发布但均处 **0.x**，「破坏性修订随 minor bump 发布；已知消费方可枚举」。
  10. L97–105（对既有 ADR 的修订）：L99 ADR-0008 读语义修订；L100–104 ADR-0016 四处显式登记（(2)(3) T1/T2 已落、(1)(4) 形状/成本句随 T3 已生效）；L105 文档负控正则修订（T5 面）。
- 对本任务影响：需求与决策 7 L91/L92/L94 及验收 L127/L130 逐点对应；禁区 = 无 options 静态类型降级、per-schema 生成（须通用映射类型）、预算值当写前完整快照使用。

### ADR-0004 vfsl-protocol 类型协议包——编译期路径投影五决策（accepted，2026-08-19；本票落地面母法）

`docs/adr/0004-vfsl-protocol-type-projection.md`

- 与本任务的关联点：`DeepOptional` 的落点包形态与类型面行为母法。
- 核心条款（原文摘录，编号=文件行号）：
  1. L24–28（**D3 包形态**——本票硬约束）：「全部内容为类型空间产物（幻影 `unique symbol` 口袋、`PathSchema`/`PathAt`/`PathValue`/`PathKind`/`UnknownPath`、`VfslPathMap` 空表、`VfslTypedAccess` 接口签名）——**编译后为空模块，零依赖、零运行时代码**」；「空 `VfslPathMap` 默认 **fail-closed**」；「不含生成器……不进引擎包」。
  2. L20–22（**D2 联合投影宽度**——判别联合附注的对照条款）：「成员独有字段：read → `T | undefined`（诚实反映『当前成员可能没带这个键』）」「路径级窄化不做……**整值读取发射判别联合（有判别式时），消费方在 JS 里吃 tsc 原生窄化**」。
  3. L30–32（**D4 类型测试装置**——本票 test-d 锚的方法论母法）：「正例用 `expectTypeOf`（类型相等断言），负例用 `@ts-expect-error`（自我反转断言：该行被错误放行时测试反而失败）」。
  4. L36（**D5 路径不含 ROOT 前缀**）：`PathAt` 含 `[]` 分支——`DeepOptional<PathAt<…>>` 的输入域含根。
  5. L44–48（后果）：「类型树形状 = 生成契约」「协议包独立演进节奏：类型规则变更 → 消费方重编译即见，无运行时兼容负担」——纯类型加法导出的演进模式依据。
- 对本任务影响：`DeepOptional` 必须为纯类型导出（零运行时、零依赖、编译后空模块不变）；D2 的判别联合窄化承诺属**无预算整值读取**面——预算读可选化判别字段的张力由 ADR 0024 L94 显式登记并给出 test-d 触发退路；D4 装置约束本票 AC 的正负例形态。

### ADR-0005 投影生成管线（accepted；生成面纪律）

`docs/adr/0005-projection-generation-pipeline.md`

- 与本任务的关联点：ADR 0024 L92「零 per-schema 生成」的管线侧对应。
- 核心条款：L43–47 生成器输入契约（吃 `evaluate` 派生 schema、纯发射器）；L49–55 生成物入仓 + CI regen-diff（`generate --check` 源漂移与生成器逻辑漂移双抓、schema 改动与重新生成同一原子提交）；L65「生成器包：`@nomicore/vfsl-codegen`（协议包按 ADR 0004 D3 不含生成器）」。
- 对本任务影响：`DeepOptional` 为 schema 无关通用映射类型——**不触生成器输出规格、不触 `domains/*/generated.ts`、`generate --check` 应零漂移**；唯一 codegen 面改动 = `PROTOCOL_EXPORT_NAMES` 名单跟名（碰撞守卫机制自身的同步义务，非生成输出变更）。

### ADR-0016 readData 语义 schema 投影（accepted；被 ADR 0019 §7 与 ADR 0024 修订节条款级修订）

`docs/adr/0016-readdata-semantic-schema-projection.md`

- 与本任务的关联点：readData 静态面与 typed-access 加法兼容条款；预算参数不是 schema opt-in 的划界（0024 修订节第 1 条）。
- 核心条款：L69（交付纪律 always-on——「结果形状随参数分叉」禁令，0024 已澄清预算字段恒在场不构成分叉）；L77「typed-access 投影与 codegen 加法兼容（adapter 可忽略新字段，亦可在其后消费）」；L100–118 ADR 0019 修订节（docs 切片三来源，与本票无交集）。
- 对本任务影响：本票只做静态类型面加法，不触 schema 通道、不触结果形状（T3 已落恒五键）；typed-access 面的加法兼容条款为 `DeepOptional` 进宿主适配器提供既有授权模式。

### ADR-0008 NamespaceRuntime 读写能力与单序列器（accepted；读语义被 ADR 0024 修订节修订）

`docs/adr/0008-namespace-runtime-read-write-capabilities-and-sequencer.md`

- 与本任务的关联点：readData 公共面所属读域母法；类型面不触其运行时语义。
- 核心条款：L16–27 读取能力（非空 path 只转换目标子树；被 0024 L99 修订为「预算内投影 + 截断清单」，不传预算 = 完整投影默认保留）；读取不进 write sequencer；L123 稳定码纪律。ADR 0024 对本 ADR 的修订现登记于 0024 修订节（0008 文本回填批注属 PR #332 / T5 面，非阻塞——T2/T3 门禁同一注记）。
- 对本任务影响：本票零运行时行为变更（type-level only）；readData 重载的静态类型化不得改变读取保留不变量、失败通道与 sequencer 边界。

### ADR-0009 NamespaceRegistry、调用方租约与 Cordis Host 生命周期（accepted）

`docs/adr/0009-namespace-registry-leases-and-host-lifecycle.md`

- 核心条款：L38「Lease 是调用方唯一能力入口，**代理 Runtime 除 `close()` 外的同步读取**……不公开裸 Runtime、DocHandle、Y.Doc 或 live Yjs 引用」。
- 对本任务影响：若 readData 类型化重载落 lease 面，须保持镜像 runtime 的代理语义（类型别名跟随 + 透传，零 lease 层解释）；`_readAlias` 系 Equal 锚为包内锁，变更须同变更集有意更新。

### ADR-0003 求值器与派生 schema（accepted；冻结面守卫）

`docs/adr/0003-evaluator-derived-schema.md`

- L46「派生 schema 的形状变更须走设计修订流程（公共契约）」——ValueSchema 9-kind 冻结面；0024 L115 明文否决 `kind:'truncated'` 进该联合。
- 对本任务影响：`DeepOptional` 是 TypeScript 映射类型，**不是** ValueSchema 语义联合成员、不触派生 schema 形状——冻结面零接触。

### 其他 ADR 清点（相关性核对）

0001（语言层——DeepOptional 非 VFSL 语言面）、0002（重写范围外）、0006（持久化）、0007（逻辑校验与运行时桥——本票无校验面变更）、0010/0012/0013/0018/0022（复制与分块传输——readData/类型面不上 wire，grep `docs/protocols/` 零 readData 条款）、0011/0014（诊断日志——ADR-0016 L77「诊断变更日志不涉及读面」）、0017（schema 生命周期元数据）、0019（联合成员文档——投影 docs 切片，T2 面已落）。被 superseded 者：无（全部 accepted；条款级修订关系见上）。

## CONTEXT.md 词汇（已同步 ADR 0024 基线）

- L45–47「形状预算」：末句已含本票口径——「预算读的静态类型是 `DeepOptional<PathAt<…>>`（全字段可选形状）：必填字段的类型承诺只在无预算读成立」；Avoid 含「对预算读的值使用非可选访问（必填承诺已不成立）」。
- L41–43「语义 schema 投影」：预算读投影裁剪口径（T2/T3 已落）；Avoid 含「预算读后期望全量类型口径」。
- L49–51「截断省略」/ L53–55「截断清单」：值内截断形态与清单语义（T1/T3 已落，本票不触）。
- L37–39「Data」：`readData`/`mutateData` 公共消费面表述。
- 对本任务影响：`DeepOptional` 术语已在「形状预算」词条内就位——本票无需新增/修订 CONTEXT 词条（若 SA1 判定需独立词条，属加法演进，随实现票落）。

## 模块 AGENTS 明文契约

- `packages/vfsl-protocol/AGENTS.md`：「Keep the emitted JavaScript surface empty: use type declarations and type exports only」；「Preserve fail-closed path resolution……reads of union-member-only fields retain `undefined` where specified」；「Treat `PathSchema`, `PathAt`, value/kind projections, `VfslTypedAccess`, and `VfslPathMap` augmentation as **public compatibility contracts**」；「Validate behavior with both positive and negative `.test-d.ts` cases」；「Run root `pnpm typecheck` when an exported type changes, because generated domains consume this surface」。
- `packages/vfsl-codegen/AGENTS.md`：「Generated files import protocol types from `@nomicore/vfsl-protocol`; preserve module augmentation and empty-domain behavior」；「If emitted types or protocol wiring change, also run root `pnpm typecheck` and `pnpm test`」——`PROTOCOL_EXPORT_NAMES` 跟名属 protocol wiring 面。
- `packages/namespace-runtime/AGENTS.md` / `packages/namespace-registry/AGENTS.md`：公共 API 只暴露 detached 投影；registry 公共 API 只经 `src/index.ts`；root `pnpm typecheck` / `pnpm test` 验证门。
- `domains/AGENTS.md`：生成物为 artifact、禁止手改；`pnpm generate --check` 新鲜度门禁——本票零生成物变更，门禁应零漂移通过。
- 根 `AGENTS.md`（typed-access 强制段）：「Reads may use the dynamic `NamespaceLease.readData()` interface when the caller intentionally handles runtime-shaped data, though typed reads should use generated `PathAt`/`PathValue` where static projection is desired」——本票是对后一句的兑现深化，无冲突。
