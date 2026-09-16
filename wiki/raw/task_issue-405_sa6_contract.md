# SA6 诊断与验收契约 — Issue #405 `readData 面：maxBytes 交付总量收/拒闸（tracer）`

- 派发：`sa-78b66ccc-2cf2-4be6-90e8-a3b153ec7bd2`（role `mabf-sa6`，phase `acceptance-contract`，iteration 0）→ **rev2 修订派发 `sa-d87c6677-066b-4248-8466-1346e66e8657`（role `mabf-sa6`，phase `acceptance-contract`，iteration 1）**
- Worktree：`/home/wangjian/nomicore-fix-issue-405`（branch `mabf/issue-405`，HEAD `fc6c1d3a4d56453a6c7288519ec7cbfe852f8e1a` = `docs(adr): 0031 readData 字节预算——交付总量收/拒闸（设计基座）`）
- 任务类型：**Feature（tracer）** —— ADR 0031 已接受、设计基座已入仓，`maxBytes` 面**零落地**；本报告证明能力缺口、给出可执行验收契约。不虚构 Bug 根因（options 校验行为是既有设计的正确结果，不是缺陷）。
- 派发约束（逐条遵守）：**不实现生产代码、不落盘任何可执行测试**；红在 HEAD 由**临时最小探针**实跑证明（§5/§9/§13），断言组与测试路径在本报告钉死（§12），测试文件由下游实现迭代落盘；探针收尾删除（§16，源码留档 `artifacts/sa6-issue405-probe-sources.log`、`artifacts/sa6-issue405-probe-d2-domain-sources.log`）。rev2 同约束：**只修订契约文本**，rev2 探针收尾删除（§16）。
- 输入（rev2 更正）：SA8 冲突门禁 `wiki/raw/task_issue-405_design_conflict_report.md`（verdict `reject`）与决议摘录 `wiki/raw/task_issue-405_relevant_decisions.md` **已在案**（rev1 时缺席）——处置见 §3.1。Issue comments REST 读取为空（`[]`；无 Owner 评论、无可应用 override）。契约义务 = Issue #405 正文 AC 十条 + ADR 0031（含其「验收」节）+ `CONTEXT.md`「字节预算」词条 + SA8 required actions（rev2）。

## 0. 修订记录（explicit revision）

| 版本 | 派发 | 日期 | 触发 | 变更 |
|---|---|---|---|---|
| rev1 | `sa-78b66ccc-2cf2-4be6-90e8-a3b153ec7bd2`（role `mabf-sa6`，iteration 0） | 2026-09-15 | Issue #405 派发（SA8 产物缺席） | 初版：能力缺口诊断（§5 P1–P3）+ §12.0–§12.8 验收契约 + rev1 探针证据 |
| **rev2** | `sa-d87c6677-066b-4248-8466-1346e66e8657`（role `mabf-sa6`，iteration 1） | 2026-09-15 | SA8 冲突门禁 `task_issue-405_design_conflict_report.md`（verdict `reject`；阻塞 RA-1/RA-2/RA-3） | **RA-1（本次修订主因）**：`maxBytes` 规范域收口 = **有限整数 1..2^53−1**（`Number.isSafeInteger(v) && v >= 1`），删除「镜像既有轴、接受 `2^53`」的并列可选分支，G5 C-LIMIT 由条件项改为硬断言 + 组级红/绿判据；**RA-2**：作用域文档落点路径更正为 `SCOPE_DOCS` 三文件实名；**RA-3**：文档负控递延升格为显式挂账 **OBL-DOC-1**（§3.3）；新增 §5 P4 / §13 / §4 的 D2 域边界实测证据；§1/§8/§15 事实与 pin 状态同步 |

**本次修订原则**：

1. **只改文本**：不实现生产代码、不落盘可执行测试、不改既有测试与 fixture；rev2 探针（临时诊断脚本）收尾删除（§16）。
2. **保留全部有效证据**：除与 D2 / pin 状态 / 文档落点直接相关的行（§1、§3、§8 未证实假设行、§10 影响面两行、§12.3 G5/G12、§12.4 G5 行、§12.5 R2、§12.6、§12.7、§15）按 §3.1 处置表原位修订外，其余证据段**逐字保留**：§4 基线、§5 P1–P3、§6 负控、§7 规模/时序、§9 E1–E7、§12.0 锚表、§12.1–§12.2、§12.3 其余断言组、§13 红/绿、§14 runner 触发。rev2 只**追加** D2 域边界证据（§5 P4、§13、§4；`artifacts/sa6-issue405-probe-d2-domain.log`）。
3. **删除并列资格、保留审计线索**：「接受 `2^53`」路径的**可选解资格**已删除（不再是 D2 条件解、不再是 SA1 可选项）；其被删除的原因与再引入前提（须先修订 ADR 0031 决策 1 域句并送 SA8 复核）在 §12.7 D2 行内留档，仅供审计，**不构成并列实现终点**。
4. **修订后送审**：本 rev2 即为送 SA8 复跑的版本（RA-6）；`requiresConflictRecheck = true`（D2 断言字面已变）。

## Verdict

`approve` —— 能力缺口已证实且可稳定呈现：HEAD 上任何携带 `maxBytes` 的 `readData` 调用（无论预算 1 还是 100000、无论值本身大小）都命中 options 键空间白名单，返回 `READ_OPTIONS_INVALID` + message「options 含未知键（封闭形状）：maxBytes」；类型面 `NamespaceRuntimeReadDataOptions` 仍是 doc-runtime 两键别名，`maxBytes` 编译红（TS2353），结果联合失败码集合为 `PATH_NOT_ALLOWED | READ_OPTIONS_INVALID | RUNTIME_READ_DISABLED`（`READ_BUDGET_EXCEEDED` TS2322/TS2367 不可表达）。以**只组合公共 API 的参考闸门**（§9 E3）对照：HEAD 目标断言 **11/11 红**且红因单一（未知键），参考闸门 **10/11 绿**（唯一 FAIL 是 T5 options 校验层——参考闸门按构造不承担校验，恰证明校验必须住 runtime 组合层而非事后闸），断言可满足、红点可归因。无 options/已知键面、lifecycle 面、PATH_NOT_ALLOWED 面、窗口面、doc-runtime 面负控在 HEAD 全绿（§6）。**无 blocker**；ADR 未逐字钉死的实现自由位在 §12.7 列为 SA1 必收口的 design pin：**D1/D3/D4/D6**（会影响断言字面者 = D1/D3/D6，已在契约内给出推荐解 + 条件解）。**D2 已于 rev2 收口**：`maxBytes` 规范域 = 有限整数 **1..2^53−1**（ADR 0031 决策 1 域句），`2^53` 拒绝且**不存在**「镜像既有轴、接受 `2^53`」的并列可选解（SA8 RA-1；§0 修订记录、§3.1、§12.3 G5、§12.7 D2）。SA8 门禁（`task_issue-405_design_conflict_report.md`）裁决 `reject` 的三条阻塞 required actions（RA-1/RA-2/RA-3）已在本 rev2 原位处置，其余对照项为 no-conflict / implements-existing-decision、无 hard conflict、无 override。

---

## 1. 任务类型与输入

| 输入 | 路径 | 用途 |
|---|---|---|
| 任务简报 | `wiki/raw/task_issue-405.md`（44 行；`Comments` 段空） | Issue #405 正文「What to build」+ AC 十条 + Blocked by: None |
| Owner 评论 | 派发说明（REST 刷新结果 `[]`） | 空——无 override、无附加义务 |
| SA8 冲突门禁 / 决议摘录（rev2 已在案） | `wiki/raw/task_issue-405_design_conflict_report.md`（107 行；verdict `reject`：RA-1/RA-2/RA-3 阻塞、RA-4/RA-5/RA-6 非阻塞）、`wiki/raw/task_issue-405_relevant_decisions.md`（62 行；决策集摘录） | rev2 的 required-actions 处置 = §3.1；D2 域收口 = §12.3 G5 / §12.7 D2；作用域文档挂账 = §3.3 |
| 母法（本票直接授权） | `docs/adr/0031-readdata-byte-budget.md`（81 行） | 决策 1–6（options 三键 / 总量语义与规范度量 / 超限零交付 / 分层落点 / 边界 / 使用指引）+ 对既有 ADR 修订 + 备选否决 + 「验收」节 |
| 术语面 | `CONTEXT.md` L51–55 | 「形状预算」`_Avoid_` 修订 + 新增「字节预算（byte budget）」词条（超限零交付 `READ_BUDGET_EXCEEDED`、`measuredBytes`、不裁剪、缺席目标照常计量、跨三读面同码同文） |
| 上游 ADR | `docs/adr/0024-readdata-shape-budget.md`（决策 1/2/6 + 开放问题「字节级预算」）、`docs/adr/0027-readdata-projection-text.md`（决策 1/3/4：恒四键、头行/✂ 文法、options 闭合形状句修订为三键） | 现状形状与本次修订的对应条款；ADR 0031 §「对既有 ADR 的修订」逐条落实 |
| 落点现状（runtime） | `packages/namespace-runtime/src/runtime.ts` L153–154（options 单源别名）、L185–188（预算联合）、L239–245（双重载属性）、L711–764（readData 组合体：lifecycle gate / 无 options 分支 / 三参分支 / canonical 接缝 / 恒四键组装）、L1041–1060（`canonicalReadOptions` 键空间白名单）、L1088–1095（`seamReadOptionsInvalid`）、L1003（`readDisabled`） | 校验与度量的唯一可行落点（唯一同时见两通道的组合层） |
| 落点现状（doc-runtime，**零改动**） | `packages/doc-runtime/src/read.ts` L66–77（options 两键）、L100–108（预算结果联合）、L315–361（`validateReadOptions`：L339–342 未知键、L344–352 轴值域、L353 -0 归一） | 「下传 options 仍为 depth/maxChildrenPerNode 两键」的观测锚（§6 P8） |
| 落点现状（registry lease） | `packages/namespace-registry/src/lease.ts` L311–332（双重载透传 + released 短路）、L472–489（`_readAlias`/`_readBudgetAlias`/`_readOverloadOrder` Equal 锁）、`src/types.ts` L468–478（两结果别名）、L732–738（接口成员）、`src/index.ts` L60–61（导出面） | 「options 与结果类型别名跟随透传 + 别名锁断言延伸」的落点 |
| 投影/头行面（**不塑形**） | `packages/namespace-runtime/src/read-schema-projection.ts` L67–89（`projectReadDataSchema` 头行 + 正文 + ✂）、L155–195（`headLine` 文法与 budgetSuffix = depth/width 两轴） | 头行不记 `maxBytes`、✂/头行照常计入 schema 通道（AC8 快照锚） |
| 既有测试/夹具 | `packages/namespace-runtime/test/runtime-readdata-shape-budget-{red.test.ts,fixture.ts,test-d.ts,control.test.ts}`、`helpers/readdata-ok-shape.ts`、`runtime-readdata-projection-text-red.test.ts`；`packages/namespace-registry/test/registry-readdata-budget-passthrough.{test.ts,test-d.ts}`、`issue-383-filtered-window-fixture.ts` | 契约文件路径/夹具/形状 helper/Equal 锁的既有先例与延伸点（§12.2） |
| 运行入口 | `vitest.config.ts` L15（`packages/*/test/**/*.test.ts`）、L20（`typecheck.include: packages/*/test/**/*.test-d.ts`）、`tsconfig.typecheck.json`、`tsconfig.base.json` L10（`exactOptionalPropertyTypes`）、root `package.json` scripts | 测试发现、类型门、EOPT 语义、门禁命令（§14） |
| 本报告自身 | `wiki/raw/task_issue-405_sa6_contract.md` | 固定报告（可原位修订） |

**无 SA1 设计产物**（`wiki/raw/task_issue-405_design.md` 不存在）。SA1 若对 §12.7 现存 pins（D1/D3/D4/D5/D6）另有选择，须先原位修订本契约的对应断言字面并触发复核。**D2 不在此列**：其域已由 ADR 0031 决策 1 钉死（rev2），SA1 无权在本契约内改选。

## 2. Owner 评论映射

无 owner 评论：REST Issue-comments 读取为空（`[]`，rev2 复核仍为空）。不存在评论来源的 override、豁免或附加义务。契约全部义务 = Issue #405 AC1–AC10 + ADR 0031 决策 1–6 与「验收」节 + `CONTEXT.md` 词条 + SA8 required actions（rev2，§3.1）；映射见 §12.1。

## 3. SA8 约束采纳（rev2）

rev1 时 SA8 产物缺席；**rev2 已收到** `wiki/raw/task_issue-405_design_conflict_report.md`（verdict `reject`；裁决分布：no-conflict 11 / implements-existing-decision 5 / evolution-required（计划缺失）1 / 可修正不一致 1 / **hard conflict 0、override 0**）与 `task_issue-405_relevant_decisions.md`。本节 = SA8 required actions 处置表（§3.1）+ ADR 0031 验收义务映射（§3.2，沿用 rev1 并保留）+ 挂账义务台账（§3.3，rev2 升格）。

### 3.1 SA8 required actions 处置（rev2）

| RA | SA8 要求 | 本契约处置（rev2） | 落点 |
|---|---|---|---|
| **RA-1**（**阻塞**，reject 主因） | 删除 D2「镜像既有轴（只查 `Number.isInteger/isFinite`，无上界）→ 接受 `2^53`」的并列分支；ADR 字面解（`Number.isSafeInteger` 语义拒绝 `2^53`）为唯一非演进解 | **已处置**：`maxBytes` 规范域钉死 = **有限整数 1..2^53−1**（等价 `Number.isSafeInteger(v) && v >= 1`）；`2^53`、`2^53 + 2`、`1e21` 等域外值 → `READ_OPTIONS_INVALID`；并列条件解**删除**（不再是 pin、不再是 SA1 可选项），改为硬断言 + 组级红/绿判据 + 实测伪绿陷阱说明 | §12.3 G5 C-LIMIT；§12.7 D2；§12.5 R2；§5 P4；§13 |
| **RA-2**（**阻塞**，证据准确性） | 更正作用域文档义务落点路径：`docs/integration/typed-access.md` **不存在** → `.agents/skills/nomicore/typed-access.md`（连同 `docs/integration/cordis-plugin-hosting.md`、`docs/integration/external-project-vfsl-codegen.md`，以 readdata-docs 夹具 `SCOPE_DOCS` 为准） | **已处置**：§3.2 / §3.3 / §10 / §12.6 全部改为 `SCOPE_DOCS` 三文件实名；除本行对 SA8 原文的引用外，错误路径 `docs/integration/typed-access.md` 已从本契约清除（存在性实测：MISSING；`SCOPE_DOCS` = `packages/namespace-registry/test/readdata-docs-adr0016-contract-fixture.ts` L54–58） | §3.2、§3.3、§10、§12.6 |
| **RA-3**（**阻塞**，防规范文档失真窗口） | 文档负控递延升格为显式挂账：`.agents/skills/nomicore/typed-access.md` L125「the closed options shape accepts only the two budget keys」句在 #405 实现落地即失真；重录须**同变更集或紧随同迭代**落地（`docs/AGENTS.md` 同步规则 + ADR 0031 验收行），不得停留在「若流水线要求本票携带」的被动表述 | **已处置**：登记为 **OBL-DOC-1**（§3.3）：含清退对象（上述 L125 句 + 「归调用方字节闸」措辞）、新增词汇（`maxBytes` 收/拒语义 + `READ_BUDGET_EXCEEDED`）、落点文件（`SCOPE_DOCS` 三文件）、落地窗口（同变更集或紧随同迭代）、锚定夹具族；rev1 被动句已删除 | §3.3、§12.3 G12、§12.6、§15 |
| RA-4（非阻塞） | 窗口面义务挂账：三面 `maxBytes`（含决策 2 窗口同构度量、验收主接缝窗口面「各走其码」负控）+ message 措辞镜像；G11 在窗口票落地时原位改写 | **登记**：OBL-WIN-1（§3.3）+ §12.7 D6 保留「本票不动」范围 pin | §3.3、§12.7 D6、§10 |
| RA-5（非阻塞） | D1 由 SA1 收口（推荐解 ≡ 缺席，沿 R1 纪律）；D3/D4/D5 按观测面锁收口 | 保留 rev1 的 D1/D3/D4/D5 pins（推荐解 + 条件解；实现前由 SA1 收口） | §12.7 |
| RA-6（流程） | 契约经 RA-1/RA-2/RA-3 修订后须原位修订并送本门禁复核 | **本 rev2 即为送审版本**；SA6 输出 `requiresConflictRecheck = true`（D2 断言字面已变，且 readData 公共面待实现核对——沿 conflict report §10） | `structured_output`；§0 |

### 3.2 ADR 0031 验收义务映射（沿用 rev1，逐条保留）

| ADR 0031 验收义务 | 契约落点 |
|---|---|
| 主接缝：超限失败分支形状、`≤` 边界、options 负控、缺席目标 × 超限、`schema:null` × maxBytes、无 options 回归 | G1/G2/G3/G5/G6/G7/G11（§12.3） |
| 度量等式 property：`measuredBytes === utf8(JSON.stringify(value)) + utf8(schema)`（✂/头行自然计入；`schema:null` 计 0） | G4（9 锚 + raw 2 锚；判据 = 同参无预算读的**独立**两通道测量） |
| lease 透传断言：既有别名锁延伸（options 形状 + 新失败分支） | G9（runtime/lease 行为等价 + `_readBudgetAlias` 延续 + 新 options/失败分支锁） |
| 文档负控（作用域文档词汇重录：`maxBytes` 语义在场、「归调用方字节闸」措辞清退） | **契约已挂账（不再是被动递延，rev2/RA-3）**：落点 = readdata-docs 夹具 `SCOPE_DOCS` 三文件（`.agents/skills/nomicore/typed-access.md`、`docs/integration/cordis-plugin-hosting.md`、`docs/integration/external-project-vfsl-codegen.md`，`packages/namespace-registry/test/readdata-docs-adr0016-contract-fixture.ts` L54–58）；清退对象含 `.agents/skills/nomicore/typed-access.md` L125「the closed options shape accepts **only the two budget keys**」句；落地窗口 = 实现变更集或紧随同迭代 —— **OBL-DOC-1**（§3.3）。默认形态 = 实现变更集（生产代码 + 契约测试）对作用域文档**零 diff**、文档重录紧随同迭代独立落地；若采用 SA8 RA-3 允许的「同变更集」形态，则文档重录须与实现一并落地并逐项对照 §3.3 台账 —— **两种形态都不得随 tracer 结束而悬空，也不得只改代码不改文档** |
| 决策 4 分层落点：doc-runtime / vfsl 零改动，下传两键；registry 别名跟随 | G11（doc-runtime 负控 + 类型锁）+ G9 |
| 决策 4 零变化清单：恒四键、✂ 文法、头行（**不记 maxBytes**）、`DeepOptional` 类型面、无 options 逐字节 | G7/G8（快照 + 字节指纹 + 头行断言） |

### 3.3 挂账义务台账（rev2 升格；义务关闭前不得宣告本票完成）

| # | 义务 | 落点（实名） | 清退 / 新增对象 | 落地窗口 | 锚定 |
|---|---|---|---|---|---|
| **OBL-DOC-1** | 作用域文档词汇重录：`maxBytes` 语义在场、旧措辞清退（ADR 0031 验收「文档负控」行；`docs/AGENTS.md`「代码行为变化须同步规范文档」） | `.agents/skills/nomicore/typed-access.md`；`docs/integration/cordis-plugin-hosting.md`；`docs/integration/external-project-vfsl-codegen.md`（readdata-docs 夹具 `SCOPE_DOCS`，`packages/namespace-registry/test/readdata-docs-adr0016-contract-fixture.ts` L54–58） | **清退**：`.agents/skills/nomicore/typed-access.md` L125「the closed options shape accepts only the two budget keys」（实现落地即失真）+ 「归调用方字节闸」措辞；**新增**：`readData(path, { depth, maxChildrenPerNode, maxBytes })` 的收/拒语义、`READ_BUDGET_EXCEEDED` 失败分支词汇 | 与实现**同变更集**或**紧随同迭代**（不得跨迭代悬空；与 #405 实现落地解耦不成立） | readdata-docs 契约夹具族（`SCOPE_DOCS` 扫描域）；ADR 0031 §验收「文档负控」行 |
| **OBL-WIN-1** | 窗口面三面义务：`readArray` / `readMap` 的 `maxBytes`（同码同文、决策 2 窗口同构度量、`WINDOW_OPTIONS_INVALID` 负控） | 窗口面独立票（ADR 0031 决策 1/3；ADR 0028 现行码） | 兑现 ADR 0031 三面义务；message 措辞须**镜像**本票 readData 面选定文案（三面同文义务）；G11 前两条断言届时原位改写并送复核 | 独立票兑现前保持 open（可追溯，不阻塞本票） | ADR 0028 L67；ADR 0031 L16/L24/L36；SA8 RA-4 |

> 备注（rev2）：SA8 门禁已运行（verdict `reject`，处置见 §3.1），送审时 `requiresConflictRecheck = true`。§12.7 现存的实现自由位 = **D1/D3/D4/D5/D6**（其中 D1/D3/D6 会改断言字面，实现前由 SA1 收口）；**D2 已由 ADR 0031 决策 1 钉死，不再是自由位**（rev1 的并列条件解已删除）。

## 4. 环境与基线

- 运行时：Node `v24.13.0`；pnpm `10.28.2`；typescript `5.9.3`；vitest `3.2.7`；tsx `4.23.12`。
- 依赖：`pnpm install --frozen-lockfile` exit 0（16 workspace projects，65 包 store 复用；仅 pnpm 提示 esbuild build script 被忽略——vitest/tsx/tsc 实测全部可用）。
- 语义环境：`tsconfig.base.json` L10 `exactOptionalPropertyTypes: true`（显式 `maxBytes: undefined` 在 TS 层是编译错误 → §12.7 D1 只在运行时/JS 调用者可观测）。
- **基线（HEAD `fc6c1d3`，零生产改动；日志 `artifacts/sa6-issue405-baseline-gates.log` / `…-fulltest.log`）**：

| 命令 | 结果 |
|---|---|
| `pnpm typecheck`（root，14 个 tsc project） | exit 0 |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/namespace-runtime/test packages/namespace-registry/test packages/doc-runtime/test --typecheck` | exit 0；**162 files / 2051 tests passed；Type Errors: no errors** |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm test`（root 全量） | exit 0；**412 files / 5021 tests passed；Type Errors: no errors**（602.36s） |
| 运行期公共面（探针 P0） | runtime 15 键（`bumpReplicationEpoch, close, enableReplication, getActiveSchema, getMetadata, getSchema, getStatus, mutateData, namespaceId, owner, readArray, readData, readMap, replaceSchema, watchMap`）；`schema.state = ready` |
| 定点装置入口（`artifacts/sa6-issue405-runner-trigger.log`） | exit 0；4 files / 36 tests（含 2 个 `test-d.ts` 经 vitest typecheck）——§14 |
| 类型探针（`artifacts/sa6-issue405-probe-types.log`） | exit 2（7 条**预期缺口**诊断：4×TS2353 + TS2322 + TS2367 + TS2339；恒绿控制零诊断）——§5 |
| D2 域边界探针（rev2；`artifacts/sa6-issue405-probe-d2-domain.log`） | exit 0；域内/域外 9 例同码同文（`READ_OPTIONS_INVALID` + 未知键 message）、既有合法轴 `{depth:1}` 绿——§5 P4 |

- 现状锚（源码确认，不构成决策依据）：`NamespaceRuntimeReadDataOptions` = `ReadLogicalValueAtPathOptions`（doc-runtime 两键）单源别名；预算联合失败面 = `PATH_NOT_ALLOWED | READ_OPTIONS_INVALID` + lifecycle `RUNTIME_READ_DISABLED`；`canonicalReadOptions` 键空间白名单为 depth/maxChildrenPerNode 两项，越界 → 出口①重派发 / 出口②`seamReadOptionsInvalid`；头行 budgetSuffix 只认 depth/width 两轴；registry lease 双重载内存形态 raw 直传（零解释/零校验）。

## 5. 正例复现（能力缺口，HEAD 实测）

Feature 无「运行时故障」；可复现的是**能力缺口**。全部探针为临时文件/inline 脚本，收尾删除（§16）；日志 `artifacts/sa6-issue405-probe-{runtime,types,gate}.log`。

**P1 — 行为缺口：`maxBytes` ≡ 未知键（`artifacts/sa6-issue405-probe-runtime.log` §P1）**

| # | 最小输入（`readData(path, options)`） | HEAD 结果 |
|---|---|---|
| A1 | `([], {maxBytes: 1})` | `ok:false code:READ_OPTIONS_INVALID keys=[ok,code,path,message] message="options 含未知键（封闭形状）：maxBytes"` |
| A2 | `([], {maxBytes: 100000})` | 与 A1 **逐字相同**（预算大小零影响） |
| A3–A8 | `{maxBytes: 0}` / `-1` / `1.5` / `NaN` / `Infinity` / `'100'` | 与 A1 **逐字相同**（值域判定从未发生） |
| A9 | `{maxBytes: undefined}` | 与 A1 逐字相同（键在场即未知键） |
| A10 | `{unknownKey: 1}` | 同码，message「…：unknownKey」（**唯一差异 = 键名**） |
| A11 | `{maxBytes: 1, depth: 1}` | 同 A1（合法轴在场也不能豁免） |
| A12/A13 | `{depth: 1}` / `{maxChildrenPerNode: 2}` | `ok:true`，恒四键（已知键通道健康——负控，§6） |

判读：HEAD 的拒绝发生在 **options 键空间判定**（doc-runtime `validateReadOptions` L339–342），与预算值、值大小、schema 状态无关 → 缺口是**能力不存在**，不是既有行为错误。

**P2 — 类型面缺口（`artifacts/sa6-issue405-probe-types.log`；tsc 5.9.3 实跑）**

```
probe-types.ts(29,54): error TS2353: Object literal may only specify known properties, and 'maxBytes' does not exist in type 'ReadLogicalValueAtPathOptions'.
probe-types.ts(33,42): error TS2353: ... 'maxBytes' does not exist in type 'ReadLogicalValueAtPathOptions'.   // runtime.readData 字面量调用点
probe-types.ts(37,40): error TS2353: ... 'maxBytes' does not exist in type 'ReadLogicalValueAtPathOptions'.   // lease.readData 调用点
probe-types.ts(40,14): error TS2322: Type '"READ_BUDGET_EXCEEDED"' is not assignable to type '"PATH_NOT_ALLOWED" | "READ_OPTIONS_INVALID" | "RUNTIME_READ_DISABLED"'.
probe-types.ts(44,16): error TS2367: This comparison appears to be unintentional because the types '"PATH_NOT_ALLOWED" | "READ_OPTIONS_INVALID" | "RUNTIME_READ_DISABLED"' and '"READ_BUDGET_EXCEEDED"' have no overlap.
probe-types.ts(44,60): error TS2339: Property 'measuredBytes' does not exist on type 'never'.
probe-types.ts(69,87): error TS2353: ... // 三键复合 options（C5，实现后必须合法）
```

判读：① runtime 与 lease 两个调用点都不接受 `maxBytes`；② 失败码联合**没有** `READ_BUDGET_EXCEEDED` 名目，`measuredBytes` 载荷不可达；③ 恒绿控制（既有两键合法、未知键保持编译红 `@ts-expect-error` 被使用、doc-runtime options 恰两键、成功成员恰四键）**零诊断**——探针装置本身健康。

**P3 — 断言可实现性对照（`artifacts/sa6-issue405-probe-gate.log`）**：同一断言组对 HEAD 真实 runtime 与「参考闸门」（§9 E3 的公共 API 组合模型）求值：

| 断言组 | HEAD 真实 runtime | 参考闸门（目标语义） |
|---|---|---|
| T1 恰好等于 `maxBytes=358` → 成功且与无预算读逐字节一致 | FAIL（`READ_OPTIONS_INVALID`） | PASS |
| T2 `maxBytes=357` → `READ_BUDGET_EXCEEDED`、`measuredBytes=358`、恰五键 | FAIL（同上） | PASS |
| T3 宽预算 100000 → 成功面全等 | FAIL | PASS |
| T4 度量等式 property（9 锚：✂/头行/缺席/双轴） | FAIL（9/9 锚红） | PASS（all anchors hold） |
| T5 options 负控 + 有效域边界 | FAIL（`validBoundary.ok=false`） | FAIL（**按构造**：参考闸门只做度量，不做校验——证明校验必须住 runtime，见 §9 E3） |
| T6 缺席目标 26 拒 / 27 收 | FAIL | PASS |
| T7 `{depth:1,maxBytes:415}` schema 逐字节 == `{depth:1}` | FAIL | PASS |
| T8 值通道失败优先 `PATH_NOT_ALLOWED` | FAIL（`READ_OPTIONS_INVALID`） | PASS |
| T9 零总量读 `maxBytes=1` 收 | FAIL | PASS |
| T10/T10b raw `schema:null` 值侧单通道 101/102 + 附加锚 | FAIL | PASS |
| **合计** | **红 11/11（红因单一：未知键）** | **绿 10/11（唯一红 = T5 校验层越界，判据构造使然）** |

判读：目标断言**可满足**（参考闸门 10/11 绿），且红/绿差异**只**归因于 `maxBytes` 组合层缺失；红点不是装置错误（oracle 前置全绿：同 doc 无预算读、schema ready、lifecycle ready）。

**P4 — D2 域边界（rev2 补测；`artifacts/sa6-issue405-probe-d2-domain.log`，PROBE_EXIT=0）**

| # | 最小输入（`readData([], options)`） | ADR 0031 域（有限整数 1..2^53−1） | HEAD 结果 |
|---|---|---|---|
| B1 | `{maxBytes: 2**53 - 1}` | **域内**（有效域顶） | `READ_OPTIONS_INVALID` + message「options 含未知键（封闭形状）：maxBytes」 |
| B2 | `{maxBytes: 2**53}` | **域外**（边界） | 与 B1 **逐字相同** |
| B3 | `{maxBytes: 2**53 + 2}` | **域外**（上邻） | 与 B1 逐字相同 |
| B4 | `{maxBytes: 1}` | **域内**（底） | 与 B1 逐字相同 |
| B5 | `{nope: 1}` | 未知键（对照） | 同码，message 仅键名不同（「…：nope」） |
| B6 | `{depth: 1}` | 既有合法轴（负控） | `ok:true`，恒四键（已知键通道健康） |

判读（rev2 修订的直接依据）：
1. HEAD 对 `maxBytes` 的**域内 / 域外毫无判别力**（B1 ≡ B2 ≡ B3 ≡ B4 逐字相同），拒绝来自**键空间白名单**而非域校验 → 域边界断言所测的能力在 HEAD 零落地。
2. **伪绿陷阱（必读）**：目标期望中 `{maxBytes: 2**53}` → `READ_OPTIONS_INVALID`，而 HEAD 恰好也返回该码（未知键路径）——rev1 的 C-LIMIT 若写成**单项**断言即在 HEAD 上巧合绿。因此 rev2 把 C-LIMIT 定为「拒绝锚 ∧ 有效域接受锚」**组级**判据：HEAD 上接受锚（B1/B4）红 ⇒ 组红；实现后两者皆绿（§12.3 G5、§12.5 R2）。
3. ADR 0031 决策 1 的域是**有限整数 1..2^53−1**（`Number.isSafeInteger(v) && v >= 1`；node 边界事实：`2^53 = 9007199254740992` → `isSafeInteger=false`，`2^53−1 = 9007199254740991` → `true`）——不存在「接受 `2^53`」的并列实现终点（rev2/RA-1，§12.7 D2）。

## 6. 负控（HEAD 必须绿；实现后必须保持）

| # | 负控 | HEAD 实测 | 判据 |
|---|---|---|---|
| N1 | `readData(['title',0])` 载体不匹配 | `PATH_NOT_ALLOWED` | 既有失败面不变；带 `maxBytes` 时仍须优先短路（目标断言 T8/G10） |
| N2 | `readData(['rogue'])` 路径偏离 | `ok:true, schema:null, value:undefined` | `schema:null` 单义不变 |
| N3 | 继承键 options（`Object.create({depth:1})`） | `READ_OPTIONS_INVALID`（宿主非 plain 原型） | 宿主判据不变（零原型污染） |
| N4 | **非 enumerable** `maxBytes` 键 | `ok:true`（键空间外 ≡ 无预算） | 键空间 = own enumerable string 键；杀 `in`/直读实现（§12.5 反伪绿） |
| N5 | accessor `maxBytes` 键 | `READ_OPTIONS_INVALID`，**getter 调用 0 次** | 零 `[[Get]]` 纪律不变 |
| N6 | 未知键 `{nope:1}` | `READ_OPTIONS_INVALID`，message 与 maxBytes 域不同 | 负控必须与「有效 maxBytes 被接受」同组出现（HEAD 上「message 含 maxBytes」单项会**伪绿**——探针 T5 detail 实测 `mention=true distinct=true` 而 `validBoundary.ok=false`） |
| N7 | closed 期 `readData([], Proxy{maxBytes})` | `RUNTIME_READ_DISABLED`，**trap 调用 0 次** | lifecycle gate 先于 options 读取与预算判定（既有不变量延伸） |
| N8 | released lease `readData([], {maxBytes:1})` | `NAMESPACE_LEASE_RELEASED`（三键） | released 短路先于一切透传/预算校验 |
| N9 | `readArray([tags], {n:1,maxBytes:1})` / `readMap([meta], …)` | `WINDOW_OPTIONS_INVALID` | 窗口面本票不动（§12.7 D6 范围 pin） |
| N10 | `readArray([tags], {n:1})` / `readMap` 无预算 | `ok:true`，恒四键 | 窗口面现状零回归 |
| N11 | doc-runtime `readLogicalValueAtPath(doc, ['title'], {maxBytes:1})` | `READ_OPTIONS_INVALID`（键集 `[ok,value,truncated,truncations]` 现状） | ADR §4「doc-runtime 零改动、下传两键」的行为锚 |
| N12 | 无 options 读 / `{}` 空预算 / `{depth:1}` / `{maxChildrenPerNode:2}` | 四键成功、头行无预算段、字节指纹稳定（§12.0 锚表） | AC1/AC7/AC8 回归锚 |

## 7. 稳定性、规模与时序

- **同步纯函数**：`readData` 不进 sequencer、无缓存、无订阅（ADR 0008/0024 既有约束）；读取结果只依赖 (doc 状态, path, options)。同参重复读实测**逐字节相同**（探针 P3：`R0 vs R0'`、`R1 vs R1'` 均 true）→ `maxBytes` 判定无 flake 源，无竞态议题。
- **规模/成本（探针 P6，n=50000 raw 数字数组，诊断性无阈值）**：`valueBytes=194391`、`schema:null`；`t(readData)=2.96ms`，`t(JSON.stringify(value)+utf8)≈0.03ms`。闸门测量 = **交付后一次序列化遍历**，O(交付字节)，不追加物化；与 ADR §6「无结构预算的宽路径读可能全量物化后被拒（成本与消费侧事后封顶同阶，不劣化）」一致。契约不设性能阈值断言；如需，另开票。
- **确定性前提**：字节锚（§12.0）依赖 fixture 的**冻结文本**（schema 文本、CJK 种子值、无时钟/随机参与）——契约要求夹具常量与锚值同变更集更新，任何文本改动必须同时改锚（否则断言即红，属预期）。
- **时序边界**：lifecycle 期（closing/closed）先于一切 options 读取（P9/N7）；`maxBytes` 判定在值通道成功之后（T8/G10），无「迟到 rejection 覆盖早期失败」的窗口。

## 8. 根因链（能力缺口链）

| Step | 事实 | 证据 | 置信度 |
|---|---|---|---|
| 症状 | 调用方无法让引擎按交付总量拒绝：`readData` 无字节预算面；消费侧被迫自造 `capJson`/`preview`/`valueBytes` 词汇，schema 侧封顶会砍掉承载截断事实的 ✂ 段 | ADR 0031 §背景；`CONTEXT.md` 词条 `_Avoid_`「字节截断/字节裁剪」 | 高（文档） |
| 直接故障点 | `readData` options 闭合形状只有 `depth`/`maxChildrenPerNode` 两键；`maxBytes` 命中未知键白名单 → `READ_OPTIONS_INVALID` | 探针 P1（A1–A11）；`doc-runtime/src/read.ts` L74–77 + L339–342；`runtime/src/runtime.ts` L153–154 | 高（运行实测 + 源码） |
| 触发条件 | 任何携带 `maxBytes` 的 `readData` 调用（含合法值、非法值、紧凑/宽预算）——无预算大小、无数据形状依赖 | 探针 P1（A1≡A2≡A3–A8） | 高（运行实测） |
| 更深根因（契约史） | ADR 0024 把字节级预算**委托给调用方**（「序列化期才精确可知，运行时递归中只能估算」）；ADR 0027 随后让 ✂ 段成为截断事实**唯一载体**——被委托出去的消费侧闸砍前缀会灭失 ✂；ADR 0031 把预算收回引擎（整体序列化即度量、收/拒不裁剪）但**该 ADR 在 HEAD 只有文档、零实现** | `docs/adr/0024`（开放问题）；`docs/adr/0027` 决策 1；`docs/adr/0031` §背景/决策 2/3；HEAD 提交 `fc6c1d3` 只改 4 个文档 | 高（文档 + 提交面） |
| 放大因素 | ① 类型链三处跟随（runtime options 别名 / 结果联合 / registry lease 别名 + Equal 锁）——只改一处会留下编译红或形状漂移；② 组合层有两道键空间闸（doc-runtime `validateReadOptions` 与 runtime `canonicalReadOptions`）——只改值通道会撞接缝出口①/②；③ 头行 budgetSuffix 与 `options` 类型同源，若把 `maxBytes` 混进塑形轴会污染头行/✂ 快照 | 源码 L154/L185–188/L1041–1060/L175–195；lease L478–489 | 高（源码） |
| 未证实假设 | ① `{maxBytes: undefined}`（键在场、值 undefined）是否 ≡ 缺席（D1）；② `NamespaceRuntimeReadDataOptions` 的新宿主形态（runtime 自持 vs 交叉类型 vs 其他，D3）；③ 接缝 `canonicalReadOptions` 对 `maxBytes` 的剥离处置（D4，观测面已锁） | 见 §12.7 D1/D3/D4 | 中（设计自由位，契约给推荐解 + 条件解；观测面已锁） |
| 已收口（rev2，不再是假设） | `maxBytes` 的**上界**由 ADR 0031 决策 1 明文钉死：域 = 有限整数 **1..2^53−1**，`2^53` 及以上值 → `READ_OPTIONS_INVALID`；不存在并列「镜像既有轴（无上界）」解 | `docs/adr/0031-readdata-byte-budget.md` L16；`task_issue-405_design_conflict_report.md` §3 行 3 / §6 / §8 RA-1；§5 P4 实测（HEAD 域两侧逐字相同） | 高（ADR 明文 + 门禁裁定 + 运行实测） |
| 已排除项 | 见 §11（options 校验缺陷 / 投影文本面缺失 / doc-runtime 已支持 / lease 自实现 / lifecycle 环境问题 / 装置不可判定） | §11 表 | 高 |

## 9. 因果实验（最小控制变量）

| # | 实验 | 变量 | 观察 | 结论 |
|---|---|---|---|---|
| E1 | 同 path 同数据，只变 `maxBytes`（1 vs 100000 vs 非法值） | 预算值 | 三种结果**逐字相同**（`READ_OPTIONS_INVALID` + 同 message） | 拒绝由**键**触发而非值/大小；缺口 = 能力不存在 |
| E2 | 同 path 同数据，抽掉 `maxBytes`（A12/A13）vs 换成未知键 `nope`（A10） | options 键集 | 抽掉 → 四键成功；换成未知键 → 同码同形态、仅 message 键名不同 | options 通道健康；唯一障碍是 `maxBytes` 未进白名单 |
| E3 | **参考闸门**（只组合公共 API：剥 `maxBytes` → 同参两键读 → `utf8(JSON.stringify(value)) + utf8(schema)` → ≤ 收 / > 拒）对同一断言组求值 | 组合层是否存在 | 参考闸门 10/11 绿，HEAD 真实 11/11 红；唯一红 = T5（校验层，参考闸门按构造不实现） | 目标语义**可满足**且**必须分层**：校验（T5）与度量（T1–T4/T6–T10）都在 runtime 组合层——与 ADR §4 落点一致 |
| E4 | 同一次读的 utf8 与 UTF-16 code unit 对照（CJK fixture） | 度量单位 | R0：value 120 vs 92、schema 238 vs 194（TOTAL 358 vs 286） | 断言对度量单位**敏感**：错误单位实现必红（反伪绿 §12.5） |
| E5 | 类型面：两键闭合形状上的 excess-property 与失败码联合 | 类型面 | TS2353 ×4（三处调用 + 复合三键）、TS2322、TS2367、TS2339；恒绿控制零诊断 | 类型缺口独立成立；实现必须同变更集改 runtime 类型（lease 自动跟随）+ 新失败分支 |
| E6 | lifecycle/敌意面：closed 期 Proxy{maxBytes} / accessor / descriptor trap / 非 enumerable | 观测通道 | `RUNTIME_READ_DISABLED` + trap 0 次；accessor → 拒绝 + getter 0 次；trap → 拒绝不抛；非 enumerable → 成功 | 既有纪律（lifecycle 优先、零 `[[Get]]`、键空间白名单）必须**延伸到含 maxBytes 的 options**（G10） |
| E7 | 窗口面 / doc-runtime 面同参注入 `maxBytes` | 面 | `WINDOW_OPTIONS_INVALID` / `READ_OPTIONS_INVALID` | 本票 tracer 范围边界清晰（G11；窗口面独立票） |

## 10. 影响面

| 面 | 是否受影响 | 契约断言 |
|---|---|---|
| `@nomicore/namespace-runtime` `readData` options 类型（新 3 键闭合形状） | 是（破坏性 minor：别名宿主变化，消费方可枚举） | G5（运行时值域，含 maxBytes 域 **1..2^53−1** 与 `2^53` 拒）+ G9/类型锁（编译面） |
| `readData` 校验与度量组合层（新增预算判定与失败分支） | 是 | G1–G4、G6、G10 |
| `readData` 成功面（恒四键、头行、✂、`truncated`） | **否（零变化）** | G7/G8（快照 + 字节指纹） |
| `readData` 失败面（`PATH_NOT_ALLOWED` / `RUNTIME_READ_DISABLED`） | 顺序不变、形状不变 | G10/T8/N7 |
| `NamespaceRuntimeReadDataBudgetResult` 联合（+`READ_BUDGET_EXCEEDED`） | 是 | 类型锁 G9 |
| `@nomicore/doc-runtime`（options 两键 / 校验器 / 结果联合） | **否** | G11/N11 + 类型锁（`keyof ReadLogicalValueAtPathOptions` 恰两键） |
| `@nomicore/vfsl`（投影渲染/头行） | **否** | G8（逐字节快照） |
| `@nomicore/namespace-registry` lease（options 别名跟随 + 结果别名 + Equal 锁） | 是（零新增逻辑，别名/锁跟随） | G9（行为等价 + `_readBudgetAlias` 延续 + 新 options 锁） |
| 窗口面 `readArray`/`readMap` | **否**（tracer 范围外；ADR 0031 §1 的三面同码留待窗口面票） | G11 |
| 作用域文档词汇（`.agents/skills/nomicore/typed-access.md` 的「only the two budget keys」句 + 集成文档「归调用方字节闸」措辞清退） | **默认否（实现变更集零 diff）**；重录义务 = **OBL-DOC-1**（§3.3：同变更集或紧随同迭代，不得悬空） | G12 改动面纪律 + §3.3 台账 |
| `apps/yjs-server` 等单参消费方 | **否**（legacy 重载与 `ReturnType` 末签名锁保持） | G9（`_readOverloadOrder` 延续） |

## 11. 已排除假设

| 假设 | 排除证据 |
|---|---|
| H1 「readData 无预算面损坏」 | 无 options 读恒四键成功、确定性、字节指纹稳定（P3/§12.0）；既有 27+5+2 测试全绿（§14） |
| H2 「options 校验把合法 maxBytes 当非法**值**拒绝」 | message 明写「含未知键（封闭形状）：maxBytes」（键域），且 A1≡A2（1 与 100000 无差别）——值域判定从未发生 |
| H3 「投影文本/✂ 面缺载体，字节无法计量」 | R1/R2/R3/R11 实测 schema 通道在场、✂ 段与头行齐备（238/358/190/312/345 字节） |
| H4 「环境/装配/lifecycle 问题」 | schema ready、runtime 15 键、lifecycle ready；closed 期按既有纪律 `RUNTIME_READ_DISABLED`（N7） |
| H5 「doc-runtime 已支持 maxBytes，runtime 只是没透传」 | N11：doc-runtime 自身对 `{maxBytes}` 同样 `READ_OPTIONS_INVALID`（两键闭合形状，L74–77） |
| H6 「registry lease 自己实现闸门即可」 | L0 lease ≡ runtime 同参结果；L1 lease 对 `{maxBytes:1}` 原样透传出 `READ_OPTIONS_INVALID`（零解释/零校验）→ 闸门必须住 runtime，lease 只跟随 |
| H7 「断言不可判定 / 装置前提不成立」 | 参考闸门 10/11 绿、oracle（同参无预算读 + 冻结常量）全绿；红点唯一归因 |
| H8 「字节预算与 where 过滤窗口语义对撞」 | 本票 tracer 不触窗口面（G11）；ADR 0031 §5 已裁定「本 ADR 不装配任何 ✂ 条目、超限同码报错」 |

## 12. 验收契约

### 12.0 冻结 fixture 与字节锚（断言的可判定前提）

fixture（建议新增 `packages/namespace-runtime/test/issue-405-maxbytes-fixture.ts`，或原位扩展 `runtime-readdata-shape-budget-fixture.ts`；**文本必须逐字冻结**）：

```text
type Meta = YMap<{
  /** 备注内容 */
  content: YLeaf<string>;
  /** 附加计数 */
  extra: YLeaf<number>;
}>;
type ROOT = YMap<{
  /** 页面标题 */
  title: YLeaf<string>;
  count: YLeaf<number>;
  /** 元数据 */
  meta: Meta;
  /** 标签组 */
  tags: YLeaf<string>[];
  /** 可选昵称 */
  nick?: YLeaf<string>;
}>;

ROOT 种子：title='你好，世界'（CJK，utf8≠utf16）、count=3、meta{content='备注说明', extra=7}、
tags=['甲','乙','丙','丁','戊']、nick 缺席；raw 变体追加 rogue='x'.repeat(100)。
```

**锚表（HEAD 实测；`artifacts/sa6-issue405-probe-runtime.log` §P2/P5）**——`total = utf8(JSON.stringify(value)) + utf8(schema ?? '')`：

| 锚 | 读 | valueBytes | schemaBytes | **total** | 说明 |
|---|---|---|---|---|---|
| R0 | `readData([])` | 120 | 238 | **358** | 主锚（恒四键、无截断） |
| R1 | `readData([], {depth:1})` | 57 | 358 | **415** | ✂ 段 + 头行 `{depth:1}` 自然计入 |
| R2 | `readData([], {depth:0})` | 2 | 190 | **192** | 折叠 + ✂ |
| R3 | `readData([], {maxChildrenPerNode:2})` | 37 | 312 | **349** | width 截断 + ✂ |
| R4 | `readData(['title'])` | 17 | 27 | **44** | 终态标量 |
| R5 | `readData(['meta'])` | 36 | 107 | **143** | ref 容器 |
| R6 | `readData(['tags'])` | 31 | 28 | **59** | 数组面 |
| R7 | `readData(['nick'])` | 0 | 27 | **27** | **缺席目标**：值侧 0、投影文本照常计量 |
| R8 | 严格档 `readData(['rogue'])` | 0 | 0 | **0** | `schema:null` × 值缺席（零总量 ≠ 超限） |
| R9 | raw 档 `readData(['rogue'])` | 102 | 0 | **102** | `schema:null` × 值侧单通道 |
| R10 | raw 档 `readData([])` | 231 | 238 | **469** | raw 全量 |
| R11 | `readData([], {depth:1,maxChildrenPerNode:2})` | 37 | 345 | **382** | 双轴塑形后计量（反「预塑形计量」） |
| R12 | `readData([], {})` | 120 | 238 | **358** | 空预算 options ≡ 无预算段（头行 `# readData []`） |

边界锚（目标实现必须收/拒的**精确**字节）：`total` → 收；`total - 1` → 拒且 `measuredBytes = total`。`R8` 的 `total = 0`：`maxBytes: 1` 必须收（零总量不是超限）。

### 12.1 AC → 契约组绑定

| Issue #405 AC | 契约组 |
|---|---|
| ① 总量 ≤ 预算成功，交付物与同参无 `maxBytes` 读逐字节一致 | G1 |
| ② 恰好等于 `maxBytes` 成功（≤ 判定） | G2 |
| ③ 超限零交付：失败分支形状 + `measuredBytes` 合计 | G3 |
| ④ 度量等式 property（含 `schema:null` 计 0 / `value===undefined` 计 0、可因投影文本超限报错） | G4 + G6 |
| ⑤ options 负控（0/负/非整数/非有限/未知键）+ message 区分 maxBytes 域 | G5 |
| ⑥ 缺席目标 × 超限：投影文本照常计量、可报错 | G6 |
| ⑦ 无 options（含 maxBytes 缺席 ≡ 不设预算）逐字节现行为回归 | G7 |
| ⑧ 成功面恒四键、✂ 与头行文法零漂移（快照锚） | G8 |
| ⑨ registry lease：options 闭合形状与结果联合别名跟随，别名锁断言延伸 | G9 |
| ⑩ 包内门禁 + root `pnpm typecheck` / `pnpm test` | G12 |

### 12.2 契约文件路径（下游实现落盘；本报告作者不落盘）

| 文件（新/改） | 承载 | 发现入口 |
|---|---|---|
| `packages/namespace-runtime/test/issue-405-maxbytes-red.test.ts` | G1–G6、G10（红契约主体） | `vitest.config.ts` L15 `packages/*/test/**/*.test.ts` |
| `packages/namespace-runtime/test/issue-405-maxbytes-control.test.ts` | G7、G8、G9(部分)、G11（回归/负控；HEAD 即绿，实现后必须保持） | 同上 |
| `packages/namespace-runtime/test/issue-405-maxbytes.test-d.ts` | 类型面：options 三键闭合、未知第四键编译红、doc-runtime 两键锁、成功成员四键不变 | L20 `typecheck.include` + `--typecheck` |
| `packages/namespace-runtime/test/issue-405-maxbytes-fixture.ts` | §12.0 冻结 fixture + 锚常量 + 参考闸门 oracle | 非 `*.test.ts`，不被收集（沿既有 fixture 先例） |
| `packages/namespace-registry/test/issue-405-lease-maxbytes-passthrough-red.test.ts` | G9 行为：lease ≡ runtime、released 短路、lifecycle | L15 |
| `packages/namespace-registry/test/issue-405-lease-maxbytes-surface.test-d.ts` | G9 类型：`NamespaceLeaseReadDataBudgetResult` Equal 锁延续 + options 跟随 + `measuredBytes` 载荷 | L20 |
| 原位扩展 `packages/namespace-registry/test/registry-readdata-budget-passthrough.test-d.ts` | 既有别名锁的延伸点（`_readBudgetAlias` 已自动覆盖新分支；补 options 跟随锁） | 同上 |
| 形状 helper 复用 | `helpers/readdata-ok-shape.ts` 的 `expectReadDataOkKeys`（成功面恰四键集中断言门） | — |

**夹具纪律**：断言禁止从被测结果反推期望（§12.5 R1）；锚常量与 §12.0 表逐字对应；参考闸门（§9 E3 模型）可作为 oracle 的**辅助**判据，但硬断言必须落在 §12.0 锚常量或**同运行同参无预算读**的独立测量上。

### 12.3 断言组（最小输入 / 可观察断言 / 旧实现 / 目标实现）

**G1 总量 ≤ 预算成功且交付物逐字节一致（AC1）**
- 输入：`readData([], {maxBytes: 358})`；`readData([], {maxBytes: 100000})`；`readData([], {depth:1, maxBytes: 415})`。
- 断言：`ok === true`；`toStrictEqual(同参无 maxBytes 读)`（四键全等）；`schema` 字符串逐字节相等（含头行与 ✂）；`truncated` 相等。
- 旧实现：`READ_OPTIONS_INVALID`（红，§13）。目标：成功且逐字节相同（探针参考闸门 T1/T3/T7 绿）。

**G2 恰好等于预算成功（≤ 判定）（AC2）**
- 输入：R0 `maxBytes: 358`；R7 `maxBytes: 27`；R6 `maxBytes: 59`；R11 `maxBytes: 382`；R8 `maxBytes: 1`。
- 断言：全部 `ok === true` 且与同参无预算读全等。
- 旧实现：全红。目标：全绿。边界 `total` 与 `total-1` 必须**成对**断言（只测 `total-1` 拒无法排除「预算被系统性放大/缩小」的错误实现）。

**G3 超限零交付 + 失败分支形状（AC3）**
- 输入：`readData([], {maxBytes: 357})`（R0）、`(['nick'], {maxBytes: 26})`、raw `(['rogue'], {maxBytes: 101})`。
- 断言：`ok === false`；`code === 'READ_BUDGET_EXCEEDED'`；own 键集**恰** `['ok','code','path','measuredBytes','message']`（无 `value`/`schema`/`truncated`）；`measuredBytes === total`（358 / 27 / 102，**合计**；双通道锚另断言 `!== 值侧字节` 且 `!== schema 侧字节`——358 ≠ 120 且 ≠ 238；单通道锚断言缺失通道计 0——R7 `measuredBytes === utf8(schema)`、R9 `measuredBytes === utf8(JSON.stringify(value))`）；`message` 非空字符串；`path` 深等于实参且**不是**实参数组同一引用（新鲜副本，沿既有回显纪律）；`path` 实参事后变异不影响已返回结果。
- 旧实现：`READ_OPTIONS_INVALID`（红）。目标：五键失败分支。

**G4 度量等式 property（AC4）**
- 判据：对 §12.0 锚 R0–R7、R11（严格档）与 R9、R10（raw 档）逐个：`r_reject = readData(path, {...塑形轴, maxBytes: total - 1})`、`r_accept = readData(path, {...塑形轴, maxBytes: total})`；oracle `o = readData(path, {...塑形轴})`（**无** `maxBytes`，独立构造）。
- 断言：`r_accept.ok === true`；`r_reject.ok === false && r_reject.code === 'READ_BUDGET_EXCEEDED'`；`r_reject.measuredBytes === utf8(JSON.stringify(o.value)) + utf8(o.schema ?? '')`；且 `r_reject.measuredBytes !== utf8(JSON.stringify(o.value))`（当两通道均非零时，杀单通道实现）。
- 旧实现：全红。目标：全绿。

**G5 options 负控 + message 域区分（AC5）**
- 输入矩阵：`{maxBytes: 0}` / `{maxBytes: -1}` / `{maxBytes: 1.5}` / `{maxBytes: NaN}` / `{maxBytes: Infinity}` / `{maxBytes: '100' as never}` / `{maxBytes: 1, nope: 1}`（第四键）/ **`{maxBytes: 2**53}`（域外边界）** / **`{maxBytes: 2**53 + 2}`（域外上邻）**。
- 断言：全部 `ok === false && code === 'READ_OPTIONS_INVALID'`；恰四键 `{ok,code,path,message}`；`message` 非空且（a）含 `maxBytes` 域标识、（b）与 `{nope:1}` 的未知键 message **不同**（文案域可区分；不钉死具体措辞——ADR 未固定文案，见 D5）；`path` 新鲜回显；同步、绝不出抛。
- **同组必须包含有效域接受**（反伪绿，§12.5）：`{maxBytes: 1}`（R0 上应拒但**不是** `READ_OPTIONS_INVALID`）、`{maxBytes: 2**53 - 1}`（必须成功）——HEAD 上单测「非法值矩阵 + message 含 maxBytes」会**伪绿**（探针 T5 实测 `mention=true distinct=true`）。
- 旧实现：矩阵部分巧合绿、有效域接受红 → 整组红。目标：全绿。
- **C-LIMIT（D2；rev2 收口为硬断言，不再是条件项）**：`maxBytes` 的规范域 = **有限整数 1..2^53−1**（ADR 0031 决策 1 域句；等价 `Number.isSafeInteger(v) && v >= 1`）。因此：
  - `{maxBytes: 2**53}` → `ok === false && code === 'READ_OPTIONS_INVALID'`（**域外必须拒绝**）；
  - `{maxBytes: 2**53 + 2}` → 同上（上邻样本）；
  - `{maxBytes: 2**53 - 1}` → **不得**返回 `READ_OPTIONS_INVALID`（域顶接受锚；R0 上预算极大 → `ok:true` + 与无预算读逐字相同）。
  - **不存在并列实现终点**：「只查 `Number.isInteger/isFinite`、无上界、接受 `2^53`」属域外演进（须先修订 ADR 0031 决策 1 域句并送 SA8 复核），rev2 已删除其可选解资格（SA8 RA-1；§12.7 D2）。实现不得静默接受域外值。
  - **伪绿陷阱（rev2 实测，必读）**：`{maxBytes: 2**53}` 单项在 HEAD 上恰好也是 `READ_OPTIONS_INVALID`（**未知键**路径，§5 P4：B1 ≡ B2 ≡ B3 逐字相同），message 断言 (a)/(b) 也巧合满足。因此 C-LIMIT 必须以**组级判据**求值：`接受锚（2**53−1、1）绿 ∧ 拒绝锚（2**53、2**53+2、非法矩阵）正确` —— HEAD 上接受锚红 ⇒ 组红；实现后全部绿（§12.5 R2）。

**G6 缺席目标 × 超限（AC6）**
- 输入：`readData(['nick'], {maxBytes: 26})` → 拒，`measuredBytes === 27`（= 投影文本 `# readData [nick]\n\nstring?\n`）；`readData(['nick'], {maxBytes: 27})` → 成功且 `value === undefined`（键恒在场）、`schema` 非 null、`truncated === false`。
- 断言：见上；并断言 `r_reject.measuredBytes === utf8(o.schema)`（值侧为 0，schema 单通道）。
- 旧实现：红。目标：绿。

**G7 无 options / 空预算回归（AC7）**
- 输入：`readData([])`、`readData([], {})`、`readData([], {depth:1})`、`readData([], {maxChildrenPerNode:2})`、`readData(['title'])`、`readData([], {depth:1, maxChildrenPerNode:2})`。
- 断言：四键；`total` 分别 = 358/358/415/349/44/382；`schema` 字符串**逐字节**等于 §12.0 锚（或 `sha16` 指纹）；`truncated` = false/true 对应；头行不含 `maxBytes`。
- 旧实现：**绿**（基线锚，见 §13）；目标实现后必须保持绿。

**G8 成功面恒四键 + ✂/头行零漂移（AC8）**
- 断言：`expectReadDataOkKeys(r)`（集中 helper）；`({depth:1,maxBytes:415}).schema === ({depth:1}).schema`（逐字节，含头行 `# readData [] {depth:1}` 与 `✂ 截断事实：` 段）；`{depth:1}` 头行**不得**出现 `maxBytes`（ADR §4）；✂ 段头行字面 `✂ 截断事实：` 与 facts 行文法不漂移。
- 旧实现：无 `maxBytes` 侧绿、带 `maxBytes` 侧红。目标：全绿。

**G9 registry lease 透传 + 别名锁（AC9）**
- 行为（`test.ts`）：真实装配 lease 与同 doc 直调 runtime：(a) `lease.readData(path, {maxBytes: total})` ≡ `runtime.readData(path, {maxBytes: total})` 逐字段相等；(b) `{maxBytes: total-1}` → `READ_BUDGET_EXCEEDED` 同载荷；(c) released 后再调 → `NAMESPACE_LEASE_RELEASED`（三键，短路优先，零 options 触达）；(d) 单参 `lease.readData(path)` 仍走 legacy 通道（末签名锁）。
- 类型（`test-d.ts`）：`Equal<NamespaceLeaseReadDataBudgetResult, NamespaceRuntimeReadDataBudgetResult | NamespaceLeaseReleasedIssue>` **延续**（`_readBudgetAlias` 自动覆盖新分支——实现若只改 runtime 不改 lease 别名即在此编译红）；新增锁：`lease.readData` 预算重载第二参 = `NamespaceRuntimeReadDataOptions`（含 `maxBytes`），第四键编译红；**doc-runtime 零改动硬锁**：`Equal<keyof ReadLogicalValueAtPathOptions, 'depth' | 'maxChildrenPerNode'>`（若 `maxBytes` 被塞进 doc-runtime 类型即编译红——ADR §4）；`Extract<NamespaceRuntimeReadDataBudgetResult, {code:'READ_BUDGET_EXCEEDED'}>` 恰 `{ok:false; code; path; measuredBytes: number; message: string}`（五键、无成功键）；`ReturnType<NamespaceLease['readData']>` 仍 = legacy 联合（`_readOverloadOrder` 延续）。
- 旧实现：探针 L1 红（`READ_OPTIONS_INVALID`）。目标：全绿。

**G10 失败面优先级与敌意 options（设计派生；实现后必须成立）**
- `readData(['title',0], {maxBytes:1})` → `PATH_NOT_ALLOWED`（值通道失败优先于预算判定，不带预算键）。
- `readData([], {maxBytes:0})` → `READ_OPTIONS_INVALID`（校验先于度量；不得报 `READ_BUDGET_EXCEEDED`）。
- closing/closed 期 `readData([], Proxy{maxBytes})` → `RUNTIME_READ_DISABLED` 且 trap 调用 **0** 次（探针 P9 在 `close()` 后实测 closed 期；closing 期同族断言可一并覆盖）。
- accessor `maxBytes` → `READ_OPTIONS_INVALID` 且 getter 调用 **0** 次；descriptor 视图不稳定（状态化/交替 trap）→ `READ_OPTIONS_INVALID`、绝不外抛（接缝出口①/②语义延伸到三键）。
- 非 enumerable `maxBytes` → 键空间外 ≡ 无预算，成功且与无预算读全等（**杀 `in`/直读实现**）。
- 旧实现：这些负控多数绿（N1/N3/N4/N5/N7），但带 `maxBytes` 的「成功」侧红 → 组内混合，实现后必须全绿。

**G11 作用域负控（tracer 边界；AC 派生）**
- `readArray([tags], {n:1, maxBytes:1})` / `readMap([meta], {n:1, maxBytes:1})` → `WINDOW_OPTIONS_INVALID`（窗口面本票不动）。
- doc-runtime `readLogicalValueAtPath(doc, ['title'], {maxBytes:1})` → `READ_OPTIONS_INVALID`（零改动；ADR §4「下传两键」的行为锚）。
- `readArray`/`readMap` 无预算行为指纹不变（四键、现状字节）。
- **本组为范围守卫**：若 SA1 决定窗口面并入本票，则该断言须原位修订（D6）。

**G12 门禁与改动面纪律（AC10）**
- 包内：`pnpm exec tsc -p packages/namespace-runtime/tsconfig.json` + `…namespace-registry/tsconfig.json`；`vitest run` 相关文件族（含 `--typecheck`）。
- root：`pnpm typecheck` exit 0；`pnpm test` 全量 exit 0（实现落地后 ≥ 基线 412 files / 5021 tests，无 skip/only/todo）。
- 改动面：`doc-runtime` / `vfsl` / 窗口面 / 投影渲染器**零 diff**；作用域文档 `SCOPE_DOCS` 三文件（§12.6 实名）在**实现变更集**默认零 diff，其重录由 **OBL-DOC-1**（§3.3）承载——「同变更集」形态（文档与实现一并落地、逐项对照台账）或「紧随同迭代」独立形态，二者不得跨迭代悬空；义务关闭前不得宣告本票完成。

### 12.4 红/绿判定表

| 组 | HEAD | 目标实现 | 说明 |
|---|---|---|---|
| G1 | 红 | 绿 | 能力缺口主证 |
| G2 | 红 | 绿 | `≤` 边界 |
| G3 | 红 | 绿 | 五键零交付 |
| G4 | 红（9+2 锚） | 绿 | 度量等式 property |
| G5 | 红（矩阵巧合绿 + 有效域 / C-LIMIT 接受锚红） | 绿 | 反伪绿配平（组级判据） |
| G6 | 红 | 绿 | 缺席目标 |
| G7 | **绿** | 绿 | 回归锚（不得红） |
| G8 | 部分红（带 `maxBytes` 侧红） | 绿 | 形状/文法锚 |
| G9 | 红 | 绿 | lease/别名锁 |
| G10 | 混合（多数负控绿；成功侧红） | 绿 | 不变量延伸 |
| G11 | **绿** | 绿 | tracer 范围守卫 |
| G12 | **绿**（基线） | 绿 | 全量门禁 |

### 12.5 反伪绿 / 反伪红设计（必读）

| # | 防线 | 机制 | 证伪对象 |
|---|---|---|---|
| R1 | **期望不得从被测结果反推** | 期望 = §12.0 冻结常量 **或** 同运行**同参无 `maxBytes` 读**的两通道独立测量；禁止 `r.measuredBytes` 自证、禁止用被测 `schema` 反推期望字节 | 自洽伪绿 |
| R2 | **负控必须与正向接受同组** | G5 在非法矩阵后追加有效域接受（`2^53-1`、`1`）；任何「只测拒绝」的写法在 HEAD 上会因未知键巧合通过（探针 T5 实测）。**C-LIMIT 同理（rev2）**：`2^53` 拒绝锚必须与 `2^53−1` 接受锚成对，否则单项断言在 HEAD 上巧合绿（§5 P4 实测 B1 ≡ B2 ≡ B3） | 未知键伪绿（最危险的一类）+ D2 边界伪绿 |
| R3 | **精确键集而非 code 相等** | 成功恰四键（`expectReadDataOkKeys`）、失败恰五键（显式列举 + 排序比较） | 半成品交付（失败里带 value/schema） |
| R4 | **度量单位敏感** | CJK fixture：R0 utf8 358 vs utf16 286（120/92、238/194）；`.length` 实现必红 | UTF-16/字符数误度量 |
| R5 | **通道敏感 + 合计** | 断言 `measuredBytes === total` 且 `!== 值侧` 且 `!== schema 侧`（双通道非零锚）；`schema:null`（R9）与 `value:undefined`（R7）各自单通道锚 | 单通道/漏计 ✂ 与头行 |
| R6 | **塑形后计量** | R1/R11（✂ 与头行在场，total 415/382）与 R0（358）分别锚定；`{depth:1,maxBytes:414}` 必须拒（而非按预塑形 358 放行） | 「预算读先塑形但不测塑形后交付」 |
| R7 | **键空间纪律** | 非 enumerable `maxBytes`（N4/X3）必须 ≡ 无预算；accessor 零执行；继承键宿主拒绝 | `in`/`options.maxBytes` 直读实现 |
| R8 | **失败优先级** | G10：校验 > 预算；lifecycle > 一切；值通道失败 > 预算 | 报码错位（拿预算码掩盖校验/路径失败） |
| R9 | **oracle 前置 fail loud** | 装置前提（schema ready、oracle 读成功、锚常量相等）失败即抛，不吞错、不降级为跳过 | 装置坏导致的伪红 |
| R10 | **禁 skip/only/todo/env/fallback/源码字符串断言** | 断言只观察公共接缝（方法结果联合、own 键集、字节、异常观测） | 伪红/伪绿与实现耦合 |
| R11 | **边界成对** | 每个锚必须 `total` 收 + `total-1` 拒成对出现（G4） | 预算被系统性放大/缩小的错误实现 |

**敏感性说明（无生产改动下的反证）**：T1 类断言对「裁剪交付」实现必红（成功交付物须与无预算读逐字节相同——ADR 备选「递归内折叠裁剪」「事后切前缀」都被此断言排除）；T2/T4 对「值通道 only」「schema 通道 only」「UTF-16 计量」必红（R4/R5 数字实测）；G2/G4 边界对「`<` 判定」「`≤` 判定错位」必红；G8 对「头行记 maxBytes」必红（schema 逐字节比较）。

### 12.6 复用与不可触碰面

- 复用：`runtime-readdata-shape-budget-fixture.ts` 的构造纪律（MemoryPersistence + seam + poll ready）、`helpers/readdata-ok-shape.ts`、`real-persistence-scheduler.ts`、registry 侧 stub handle/persistence + manual clock + test scheduler 先例。
- **不可触碰**（本票零 diff；若设计必须触碰须原位修订本契约并在报告中记录）：`packages/doc-runtime/**`、`packages/vfsl/**`、`read-schema-projection.ts`（头行/✂ 渲染器）、窗口面 `window-read.ts`、**作用域文档 `SCOPE_DOCS` 三文件**（`.agents/skills/nomicore/typed-access.md`、`docs/integration/cordis-plugin-hosting.md`、`docs/integration/external-project-vfsl-codegen.md`；`packages/namespace-registry/test/readdata-docs-adr0016-contract-fixture.ts` L54–58）——实现变更集对作用域文档**默认零 diff**，其重录走 **OBL-DOC-1**（§3.3：「同变更集」或「紧随同迭代」两形态，不得悬空）、既有投影文本快照测试的期望常量。

### 12.7 设计 pin（ADR 未逐字钉死；SA1 必须收口，其中 D1/D3/D6 会改断言字面；**D2 已于 rev2 收口，不再是 pin / 不再是自由位**）

| # | Pin | 推荐解（契约默认） | 条件解（若 SA1 另选） |
|---|---|---|---|
| D1 | `{maxBytes: undefined}`（键在场、值 undefined） | ≡ **缺席**（沿既有轴 R1 纪律：`doc-runtime/src/read.ts` L349；EOPT 下 TS 调用者不可达） | 若定为非法：G5 把该输入并入 `READ_OPTIONS_INVALID` 矩阵（HEAD 现行为如此），并记录理由 |
| D2 | ~~`maxBytes` 上界~~ **已收口（rev2 / SA8 RA-1）** | **规范域（ADR 0031 决策 1 明文，非自由位）**：`maxBytes` = **有限整数 1..2^53−1**（`Number.isSafeInteger(v) && v >= 1`）；`2^53` / `2^53 + 2` / `1e21` → `READ_OPTIONS_INVALID`；`2^53 − 1` 接受。G5 C-LIMIT 已由条件项改为**硬断言 + 组级判据**（§12.3 G5、§12.5 R2、§5 P4） | **已删除（不可选）**：rev1 曾并列出示「镜像既有轴（只查 `Number.isInteger/isFinite`，无上界）→ 接受 `2^53` + 契约原位记录」——SA8 裁定其偏离 ADR 钉死的域、属「evolution-required 计划缺失」，**不得作为并列可选解**。留档仅供审计：再引入须先同变更集补齐 ADR 0031 决策 1 修订计划并送 SA8 复核（conflict report §6），SA1 无权在本契约内改选 |
| D3 | `NamespaceRuntimeReadDataOptions` 宿主形态 | runtime 自持 3 键闭合形状（或与 doc-runtime 两键的交叉类型），lease 沿用同名别名；doc-runtime **零改动** | 任何形态都必须满足 G5/G9/G11 的观测面（三键接受、第四键编译红、doc-runtime 类型两键不变） |
| D4 | 接缝 `canonicalReadOptions` 对 `maxBytes` 的处置 | 纳入键空间白名单并在**下传前剥离**（下传两键）；视图不稳定仍走出口①/② → `READ_OPTIONS_INVALID` | 任何处置都必须满足 G10（零 `[[Get]]`、不抛、键空间纪律） |
| D5 | message 文案 | 不钉死；只断言「maxBytes 域可区分」（含 `maxBytes`、与未知键 message 不同、非空） | 若设计给出统一文案，契约断言不变（域区分仍成立） |
| D6 | 范围：窗口面（`readArray`/`readMap`）与本票关系 | **本票不动**（tracer 只治 readData 面）；窗口面按 ADR 0031 §1 独立票落地 | 若并入本票：G11 前两条断言原位改写为窗口面目标断言并送复核 |
| D7 | 头行 | **不记 `maxBytes`**（ADR §4 明文；G8 字节比较锚定） | 无——此为 ADR 明文，非自由位 |

### 12.8 门禁清单（实现迭代必须全绿）

1. `pnpm typecheck`（root，14 project）exit 0。
2. `NODE_OPTIONS=--conditions=nomicore-source pnpm test`（root 全量）exit 0；文件/测试数 ≥ 基线（412 files / 5021 tests）+ 新增契约文件。
3. 定点：`vitest run packages/namespace-runtime/test packages/namespace-registry/test --typecheck` exit 0。
4. `git diff --stat` 证明 §12.6 不可触碰面零 diff（含 doc-runtime / vfsl / 投影渲染器 / 窗口面）；作用域文档（`SCOPE_DOCS` 三文件）若采用 OBL-DOC-1 的「同变更集」形态须在 diff 中逐文件指明并对照 §3.3 台账，否则保持零 diff 并由「紧随同迭代」形态落地。
5. 契约文件零 `skip`/`only`/`todo`/env override/fallback；无源码字符串断言。

## 13. 红/绿证据

- **HEAD 红（正例）**：`artifacts/sa6-issue405-probe-gate.log` —— 严格档 T1–T9 全 FAIL、raw 档 T10/T10b 全 FAIL，红因**全部**为 `READ_OPTIONS_INVALID` + message「options 含未知键（封闭形状）：maxBytes」（探针 `T2 detail`、`T8 detail` 等）；11/11 目标断言红且红因单一 → 归因能力缺口。
- **参考闸门绿（可实现性）**：同日志 —— 10/11 绿；唯一 FAIL = T5（参考闸门按构造只做度量不做校验），恰好证明校验必须住 runtime 组合层（ADR §4），不得靠消费侧事后闸。
- **类型面红**：`artifacts/sa6-issue405-probe-types.log`（TS2353 ×4 / TS2322 / TS2367 / TS2339；恒绿控制零诊断）。
- **D2 域边界实测（rev2）**：`artifacts/sa6-issue405-probe-d2-domain.log`（PROBE_EXIT=0）—— 域内（`2^53−1`、`1`）与域外（`2^53`、`2^53+2`）在 HEAD 上**逐字相同**（`READ_OPTIONS_INVALID` + 未知键 message）；`{depth:1}` 绿（负控）。⇒ ①HEAD 对 `maxBytes` 域边界**零判别力**；②修订后 C-LIMIT 的**拒绝锚单项在 HEAD 上属巧合绿**，必须与有效域接受锚同组求值（组级判据：HEAD 红 / 实现后绿，§12.3 G5、§12.5 R2）。
- **基线绿（HEAD 负控）**：`artifacts/sa6-issue405-baseline-gates.log`（typecheck exit 0；162 files / 2051 tests）+ `artifacts/sa6-issue405-baseline-fulltest.log`（412 files / 5021 tests；`FULLTEST_EXIT=0`）。
- **既有 readData 面在 HEAD 全绿**：`artifacts/sa6-issue405-runner-trigger.log`（`runtime-readdata-shape-budget-red.test.ts` 27 tests、`registry-readdata-budget-passthrough.test.ts` 5 tests、两个 `test-d.ts` 各 2 tests；4 files / 36 tests）。

## 14. Runner 触发证据

- 发现入口：`vitest.config.ts` L15 `include: ['packages/*/test/**/*.test.ts', …]`、L20 `typecheck.include: ['packages/*/test/**/*.test-d.ts', …]`；根 script `test = NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`；跨包源码解析走 `customConditions: ["nomicore-source"]`（无需 build）。
- 实跑（同目录族，路径与 §12.2 契约文件同型）：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/namespace-runtime/test/runtime-readdata-shape-budget-red.test.ts packages/namespace-runtime/test/runtime-readdata-shape-budget.test-d.ts packages/namespace-registry/test/registry-readdata-budget-passthrough.test.ts packages/namespace-registry/test/registry-readdata-budget-passthrough.test-d.ts` → **exit 0；4 files / 36 tests；Type Errors: no errors**（`artifacts/sa6-issue405-runner-trigger.log`）。
- 判读：§12.2 的 `.test.ts` / `.test-d.ts` 路径落在真实 include 模式内，新增契约文件无需改配置即被收集；`.test-d.ts` 经 vitest typecheck 引擎（`tsconfig.typecheck.json`）生效。

## 15. Unknowns 与 blockers

- **Blockers：无。** 缺口稳定复现（探针可重跑，§16 留档源码），根因/能力缺口可归因，契约可执行，测试入口真实，基线全绿。
- Unknowns（均已转为 §12.7 pins，不阻塞设计）：D1 present-undefined 语义；D3 options 类型宿主形态（观测面已锁）；D4 接缝剥离路径（观测面已锁）；D5 文案（不钉死）；D6 窗口面是否并入本票。**D2 已于 rev2 由 ADR 0031 决策 1 钉死（域 = 有限整数 1..2^53−1，`2^53` 拒），不再是 unknown、不再是 pin**（§0、§3.1、§12.7）。
- SA8 门禁状态（rev2）：`reject` 的三条阻塞 required actions（RA-1/RA-2/RA-3）已在本契约原位处置（§3.1）；RA-4 登记为 OBL-WIN-1（§3.3）；RA-5 保留 D1/D3/D4/D5 pins；RA-6 由 `requiresConflictRecheck = true` 送审（复跑条件见 conflict report §10）。
- 挂账义务（§3.3）：**OBL-DOC-1**（作用域文档重录，同变更集或紧随同迭代）；**OBL-WIN-1**（窗口面三面义务，独立票）。二者 open 期间，本票不得宣告完成（OBL-WIN-1 可追溯挂账、不阻塞本票；OBL-DOC-1 阻塞本票收尾）。

## 16. 临时诊断清理

| 临时产物 | 处置 | 证据 |
|---|---|---|
| `packages/namespace-runtime/.sa6-405-probe/probe-runtime.ts`（行为/锚/成本/边界探针） | **已删除**（源码留档 `artifacts/sa6-issue405-probe-sources.log`） | `git status` 无残留；见下 |
| `packages/namespace-registry/.sa6-405-probe/probe-gate.ts`（参考闸门 + 断言组求值 + lease + 敌意负控） | 同上 | 同上 |
| `packages/namespace-registry/.sa6-405-probe/probe-types.ts` + `tsconfig.probe.json`（类型面探针） | 同上 | 同上 |
| `packages/namespace-runtime/.sa6-405-rev2/probe-d2-domain.ts`（rev2 D2 域边界探针） | **已删除**（源码留档 `artifacts/sa6-issue405-probe-d2-domain-sources.log`；实跑日志 `artifacts/sa6-issue405-probe-d2-domain.log`） | `git status` 无 `.sa6-405-rev2` 残留 |
| `.scratch/sa6-405/`（探针初版目录） | 已删除（迁入包目录解决 `yjs` 解析后清理） | `git status` 无 `.scratch/sa6-405` |
| 生产实现 | **零改动**（rev1/rev2 探针只读公共 API：runtime / registry testing / doc-runtime / persistence；零日志注入、零业务语义变更） | `git status --short` 仅本报告 + `artifacts/**` + 既有 wiki 输入；`git diff` 对 `packages/**`/`docs/**` 为空 |
| 证据日志（保留） | `artifacts/sa6-issue405-{baseline-gates,baseline-fulltest,probe-runtime,probe-gate,probe-types,runner-trigger,probe-sources,probe-d2-domain,probe-d2-domain-sources}.log` | 未跟踪新增文件，不入分支提交 |
