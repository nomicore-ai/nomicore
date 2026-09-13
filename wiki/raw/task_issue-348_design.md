# task_issue-348 设计 — 条件写语义矩阵补全：深相等、读失败路径、XML 与 set([])（guard II）

- 任务：issue #348（`wiki/raw/task_issue-348.md`，8 条 AC）
- 设计角色：SA1（iteration 0；无既有设计文件，本文件为首版）
- 上游输入（均已读）：SA6 契约 `wiki/raw/task_issue-348_sa6_contract.md`、SA8 冲突报告 `wiki/raw/task_issue-348_conflict_report.md`（verdict **clear**、requiresConflictRecheck **false**）、SA8 决策摘录 `wiki/raw/task_issue-348_relevant_decisions.md`
- 基线：HEAD `61e2daa37e21b467e7ce130d5c4db7be38bde982`（branch `mabf/issue-348`），工作区无生产改动
- 一句话结论：**本票是纯测试锚定票**——在冻结落点 `packages/doc-runtime/test/issue-348-guard-semantics-matrix.test.ts` 新建单个自包含测试文件，以 92 个用例把 ADR 0025「评估语义」边角固化为可执行锚；**生产修正范围为 ∅**（SA6 §5 实测 92/92 与 ADR 一致、§9.2 四个错误实现模型全部被新矩阵击穿而既有套件对其中两个完全盲）。

## 1. 任务类型、目标和非目标

**任务类型：Feature（既有决策兑现 / 语义矩阵锚定），非 Bug。** issue 正文自述「本票以测试为主，若边角暴露 #347 实现的偏差，以 ADR 0025 为准修正实现」；SA6 诊断（§5、§11 H9）已裁定当前 HEAD 全部边角与 ADR 0025 一致，无需实现修正。本设计据此把主交付物定义为**测试组织与覆盖计划**，并给出实现阶段意外红灯时的有界修正路径（§13.3）。

### 目标

1. 在 `packages/doc-runtime/test/issue-348-guard-semantics-matrix.test.ts`（落点由 SA6 §12.1 冻结）落地 AC1–AC7 全部 92 个用例 + 内嵌负控，组织方式遵循 doc-runtime 既有 mutation 测试惯例（AC8 前半）。
2. 用例可观察口径遵循 SA6 §12.0 冻结的判决契约（满足 / 不满足 / 形状错误三态），全部断言观察运行时行为。
3. 负控成对（同 fixture、同 op、仅 guard 极性/存在性不同），并以 SA6 §9.2 变异敏感度证据证明矩阵非重言式。
4. AC8 门：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/doc-runtime/test` 全绿 + 根 `pnpm typecheck` exit 0。

### 非目标（与 SA6 §10/§12.12 一致，全部排除）

- 不新增谓词（词表封闭于 `equals`/`absent`；ADR 0025 L94 开放问题 1 的任何演进均须独立决策）。
- 不改错误域形状、不放宽 guard 路径 `[]` 禁令、不放开批内元素 guard。
- 不定义 equals 侧非 JSON 输入语义（自定义原型链 A15、循环输入 Z1、万层深 Z2/Z3——SA6 §9.3 边界观察，fail-closed 且零写入，不请求修正）。
- 不触碰 wire/schema/持久化/状态机/生命周期面；不触碰 `read.ts`、`index.ts`、namespace-runtime。
- 不修改 `#347`/`#350`/public-surface 既有测试（它们是负控基线，必须原样保持全绿）。

## 2. 当前行为与证据锚点

实现已在库中（#347 于 `61e2daa` 落地、ADR 0026 批量于 `1b55d5c` 先行落地），本节锚定矩阵所观察的现行调用链与语义事实源。SA1 只读取证据，未运行任何测试；运行时观察引自 SA6 契约（其 §5 探针实测 92/92 一致）。

### 2.1 入口与调用链（矩阵的全部用例都经同一公共入口）

| 环节 | 符号锚点 | 事实 |
|---|---|---|
| 公共入口 | `applyValidatedMutation(derived, doc, mutation)` — `packages/doc-runtime/src/mutation.ts` L130–158 | 第三参公共类型 `ValidatedMutation \| unknown`，guard 信封原样传入；`assertOutermostTransactionContext` 前置 |
| 信封分发 | `prepareMutation` L160–213：`Object.hasOwn(env,'ops')` → `prepareBatchMutation`（L223–307）；否则 `parseMutation` → `parseMutationCore(input,'',true)`（L594–642） | 单操作与批量共用同一解析核；`allowGuard` 仅两形态顶层为 true（L589–593） |
| guard 形状校验 | `parseGuard` L644–683 | 形状错误全表（未知键 / 恰其一 / absent 字面 true / equals 非 undefined / 非有限数 / path 存在·数组·段型·非空），一律无码 `failIssue([], …)`、零写入 |
| 单操作评估位置 | L173–178：`parsed.mutation.guard !== undefined` → `evaluateGuard`；位于解析成功后、局部/legacy 分叉（L182 `isRootReplace`）之前 | ADR 0025 L48 的实现位点；`set([])`（L182 判真走 legacy）同样先过 guard |
| 批量评估位置 | `prepareBatchMutation` E1–E5 信封校验后、G 段 L287–292：顶层恰一次、读批前 committed、先于逐操作 prepare（L293–304） | ADR 0025 L74 / ADR 0026 L53–55 |
| 评估实现 | `evaluateGuard` L711–718：`readLogicalValueAtPath(doc, guard.path)` 纯读一次；absent ⇒ `!read.ok \|\| read.value === undefined` 满足；equals ⇒ `read.ok && logicalValuesEqual(read.value, guard.equals)` 满足 | 不满足 → `mismatchIssue`（L722–729）：稳定码 + `path` 为 guard 路径新鲜副本 + 有界摘要（`GUARD_SUMMARY_LIMIT=256`，L731–737） |
| 深相等 | `logicalValuesEqual` L540–552：`===` 首判（`-0 === 0` 为 true）+ 数组逐位递归 + plain object undefined 键过滤结构递归（键完整，非子集） | 同时被 `resolveNode`（L535，union 成员判别）消费——共享助手，修正路径的禁区（§13.3） |
| 投影读取 | `readLogicalValueAtPath` — `packages/doc-runtime/src/read.ts` L53–135 | schema-independent 载体投影；失败单通道 `PATH_NOT_ALLOWED`（L26–27、L44–46）；缺键/越界吸收 `ok:true value:undefined`（L79、L85、L94、L101）；XML 穿越失败（L106–107）与 XML 终点语义字符串（L351–352）；detached 载体 loud 拒绝（L112–113、L247–248、L341–344）；Y.Text 终点失败（L353–354）；非 plain 原型对象（Date）不可下钻（L116–117） |
| 公共导出 | `packages/doc-runtime/src/index.ts` L23、L28–33 | `MUTATION_GUARD_MISMATCH` 值导出 + `MutationGuard`/`GuardedMutation`/`BatchedMutation`/`MutationEnvelope` 类型导出；`public-surface-guard.test.ts` 已审计 |

### 2.2 状态、副作用与可观察面（矩阵断言的对象）

- 满足：`result.ok === true`；目标写入落盘（活动 Y.Doc 值）；恰 1 次本地 `afterTransaction`（`transaction.local && changed.size>0`）+ 恰 1 次 `update` 事件。
- 不满足：`ok:false`；`issues.length===1`；`issues[0].code === 'MUTATION_GUARD_MISMATCH'` 且与公共导出同源；`JSON.stringify(issues[0].path) === JSON.stringify(guard.path)`；零写入 = `Y.encodeStateAsUpdate(doc)` 逐字节不变 + 0 次本地事务 + 0 次 update。
- 形状错误：`ok:false`；`code === undefined`；零写入（矩阵仅 A13 一例对照，与 #347 S10 同源）。
- guard 评估为纯读（零写入、零事件、不进事务——`evaluateGuard` 调用点在 `transactGuarded` 之外，mutation.ts L176/L290 均位于任何事务开启前）；原子性归写序列器 FIFO（ADR 0008 L40–51），本票不新增并发面。

### 2.3 既有锚与既有套件基线

- `issue-347-guard-envelope-red.test.ts`：G1–G9/M1–M10/O1–O3/S0–S11/N1–N4/P1–P2（41 用例，全绿）——guard I 红线锚与负控基线（N 组），**不得修改**。
- `issue-350-*.test.ts`、`read-logical-value-at-path-*.test.ts`、`public-surface-guard.test.ts`：既有 28 files / 447 tests 全绿（SA6 §4 基线）。
- 组织惯例样本：`issue-347` 文件头 doc-comment 引 ADR 行号 + 契约 §12 用例 ID；文件自带 `derivedOf`/`fixture`/`baseSnapshot(overrides)`；助手 `watchWrites`/`bytes`/`expectZeroWrite`/`expectGuardMismatch`/`expectShapeError` 内联于文件；按组 `describe`、用例 ID 入 `it` 标题；直造载体 fixture 惯例见 `read-logical-value-at-path-schema-independent.test.ts` L278/L282（`root.set('textVal', new Y.Text('hi'))` 等）。

## 3. 根因或能力缺口

**缺口口径 = 验证锚缺失（非行为缺口）**，根因链承接 SA6 §8：

1. ADR 0025 冻结的评估语义**多于** #347 落地时锚定的面：深相等边角（`-0`/0、undefined 键过滤全形态、嵌套结构、大子树）、读失败两态全表（标量穿越/中间缺失/越界/段型不符/null 穿越/Y.Text/Date/detached）、XML 两形态、数组下标段纪律全表、`set([])` 先过 guard、批量顶层同语义（ADR 0025 L42–44/L48/L74 vs `issue-347` 用例清单逐条比对）。
2. 实现侧语义已在库中（§2.1 锚点；SA6 §5 探针 92/92 实测一致）。
3. 缺口表现为**既有套件盲区**：错误实现模型 M2（`-0`/0 误判不等）与 M3（`set([])` 跳过 guard）下既有 447 用例全绿（SA6 §9.2 变异实验）；M1/M4 仅被 #347 M5/G7 各检出 1 例。
4. 因此本票交付**可执行锚补全**，而非行为修正；矩阵对 M1–M4 全部敏感（DEV 击穿 13/5/3/3 例）即为反伪绿证明。

## 4. Owner要求落实

issue 评论经 REST 读取：**无**（SA6 §2、SA8 冲突报告 §1 同口径）。无 Owner 要求、无 override 授权在册；AC1–AC8 全部来自 issue 正文，无外部附加要求。

| 来源 | 要求 | 设计落实位置 |
|---|---|---|
| issue 正文 AC1–AC7 | 七组语义边角用例 | §7/§8（用例组织与覆盖计划，逐组映射 SA6 §12.2–§12.8 的 92 用例） |
| issue 正文 AC8 | 按 doc-runtime 既有 mutation 测试组织方式落位；根 `pnpm typecheck` + doc-runtime 测试通过 | §7（组织设计）、§11（文件范围）、§12（验收门） |
| issue 正文「以 ADR 0025 为准修正实现」 | 意外红灯时的修正准则 | §13.3（有界条件修正路径；冻结面触碰 → 回 SA8） |

## 5. 复现和根因承接

| 上游事实（SA6 契约） | 证据位置 | 设计响应 |
|---|---|---|
| HEAD 92/92 用例与 ADR 0025 一致，0 偏差；修正范围 ∅ | SA6 §5 表、§12.11.1 | 设计主范围 = 纯测试新增（§7/§11）；不为「以防万一」预留生产改动 |
| 既有套件对 M2（-0/0）与 M3（set([]) 跳 guard）完全盲 | SA6 §9.2 变异表 | 矩阵必须包含 A1/A1b/A8/A12/G6（-0 族）与 E1/E6/E7（set([]) 不满足态）为不可替代增量锚（§8 覆盖表逐组标注） |
| M1/M4 已被 #347 M5/G7 部分覆盖 | SA6 §9.2 | 矩阵仍全量落 B 组读失败两态与 A5/A6 键过滤（成对负控要求），不因部分覆盖而删减 |
| 探针 4 轮 92/92 稳定，无 flake；两处开发期不符均为探针自身缺陷 | SA6 §7 | 用例本身不引入定时器/并发/真实时钟；fixture 全同步构建 |
| X0：XML 终点投影值与 `Y.XmlFragment.toString()` 逐字相等 | SA6 §5 | C1 期望值直接用 `'<p>hi</p>'` 字面量（与 fixture `body` 快照相同时），无需在测试内调用 toString 作二次换算（§8 C 组注） |
| A1c：`n:-0` 物化后读回 `Object.is(value,-0)===true`（-0 未被归一） | SA6 §5 | A1/A1b 是真实比较而非同义反复；A1b 用 fixture 覆盖 `n:-0`（§8 A 组） |
| 边界观察 A15/Z1–Z3/D14–D15：非 AC 项、不请求修正 | SA6 §9.3、§12.11.3 | 全部排除出矩阵（非目标 §1）；D14/D15 的**段值域**语义由读面纪律覆盖（B7/B9/D15 absent 满足即可锚定「非形状错误」） |
| B25 空 XML 终点投影 `''` 属有值 → absent 不满足（N-C 正极性反例，非负控失败） | SA6 §6 注 | B25 断言不满足判决（mismatch），B25b 断言 `equals:''` 满足（§8 B 组） |
| 落点路径可被真实入口发现（vitest include 覆盖） | SA6 §14 runner-trigger 探针 | 文件路径冻结不变；根 `vitest.config.ts` L15 `packages/*/test/**/*.test.ts` 已覆盖（无需配置改动） |

## 6. SA8约束落实

| SA8 决议或义务 | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|
| verdict clear；全部对照项 no-conflict / implements-existing-decision | §1/§7 | 纯测试锚定，不引入新语义、不扩词表、不动 wire/schema/持久化/状态机/生命周期 | 否 |
| 冻结面（冲突报告 §4）：稳定码字面量、不满足 issue 形态、形状错误族、谓词词表、单操作无 guard 逐字节契约、公共导出集、评估位置与次序、`set([])` 管线归属 | §8（断言只锚定现值）、§13.3（修正禁区）、§11（DENY LIST） | 矩阵用例断言这些面的**现值**；任何实现修正不得改动；触碰即回 SA8 | 否（条件性入口见 §13.3，非本票既定面） |
| §8 第 2 条：修正触碰冻结面 → 回 SA8 复核 | §13.3 条件修正路径 | 明示触发器与回退动作 | 条件触发时另起，本设计不请求 |
| §8 第 3 条：修正触及 mutation/read 契约 → 追加根 `pnpm test` | §12 验收门 | 主门（AC8）= typecheck + doc-runtime 套件；条件门 = 根 `pnpm test` | 否 |
| §7 前置：#347（61e2daa）与传递前置 #350/ADR 0026（1b55d5c）已落地 | §2.1 | guard 双形态落点已在库中，矩阵直接消费公共入口 | 否 |
| ADR 0025 L90 落地门槛的 namespace-runtime 面已由 #347 闭环 | §12 | 本票 AC8 门为其 doc-runtime 子集，不重复 namespace-runtime 面 | 否 |

## 7. 设计决策与主要备选方案

本节是本设计的核心交付：**测试文件的组织与覆盖计划**。全部决策以「实现角色可据此直接落码、SA2 可据此逐条审计」为准。

### D1 单文件落位（vs 按 AC 组拆多文件）

冻结于 `packages/doc-runtime/test/issue-348-guard-semantics-matrix.test.ts`（SA6 §12.1）。理由：(a) 仓内惯例是**每 issue 一个测试文件**（`issue-237-*`、`issue-347-*`、`issue-350-*` 三个先例，#350 三个文件是 SA7 增补等特殊产物，主锚仍单文件）；(b) 七组共用同一 fixture 与助手，拆文件将强制抽共享模块，违背「每文件自带 fixture」惯例；(c) 92 用例单文件规模与 `issue-347`（41 用例 759 行）同量级，可评审。**备选（否决）**：按 AC 拆 7 个文件——重复 fixture 7 份、SA2 映射面反而变差。

### D2 fixture 自包含且为 #347 fixture 的严格超集

文件自带 `TEXT`/`derivedOf`/`baseSnapshot(overrides)`/`fixture(snapshot?)`，不引入共享 helper 模块（`packages/doc-runtime/test/` 无任何共享 helper 文件；#347 与 read 系列测试均自包含）。fixture 文本冻结为 SA6 §12.0 原文（超集关系：保留 `n:4711`、`a:'guarded-scalar'`、`tasks.t1/t2`、`values`、`more` 与 #347 逐字段同形，新增 `t3`（缺可选 `reviewer`/`tags`）、`body`（XML）、`blob`（YPlainArray）、`free`（unknown 嵌套 plain 值））。超集而非另起炉灶的理由：#347 锚与本矩阵同 fixture 语义可比；AC1「显式 undefined 过滤」与 AC5「legacy 全量重装可观察」依赖 `t3` 缺可选键（`reviewer?: string`、`tags?: YArray<string>` 是 VFSL 合法可选字段，#347 已用 `reviewer?`）；`free: unknown` 是合法 VFSL 标量类型（`packages/vfsl/src/derived.ts` L51），为 AC1/AC2 提供 plain 域嵌套结构与读失败形态。SA6 探针已用该 fixture 实测 92/92，文本有效性有运行时证据。

### D3 用例粒度：一个 `it` 恰承载一个 SA6 用例 ID

92 个用例 ID（A1、A1b、A1d、A2–A14；B1–B30 含 B25b；C1–C7；D1–D15；E1–E7；F1–F4；G1–G12）一一对应 92 个 `it`，用例 ID 置于 `it` 标题首 token。理由：(a) SA6 §12 表的行级可审计性（SA2 评审逐行映射）；(b) 期望套件计数确定：**28→29 files、447→539 tests**，作为实现自查锚；(c) #347 同款粒度（41 用例 = 41 `it`）。**备选（否决）**：同路径 equals/absent 成对合一个 `it`（#347 G6/G7 风格）——省行数但破坏 1:1 映射与计数确定性；成对性由「同 fixture 构造 + 相邻放置 + 断言互反」表达，不必共用 `it`。

### D4 `describe` 分组：恰 7 个顶层组，按 AC 划分

```
describe('issue #348 A 组 — AC1 equals 深相等细节（16 用例）')
describe('issue #348 B 组 — AC2 读失败路径与缺席吸收（31 用例）')
describe('issue #348 C 组 — AC3 XML 穿越 / 终点两形态（7 用例）')
describe('issue #348 D 组 — AC4 数组下标段纪律（15 用例）')
describe('issue #348 E 组 — AC5 set([]) legacy 先过 guard（7 用例）')
describe('issue #348 F 组 — AC6 大子树结构比较（4 用例）')
describe('issue #348 G 组 — AC7 批量顶层 guard 同语义（12 用例）')
```

组序 = AC 序 = SA6 §12.2–§12.8 节序。不用嵌套 describe（#347 全平铺；B 组的 fixture 变体以每个 `it` 内自建 fixture 表达）。**备选（否决）**：B 组按 fixture 变体再嵌套 5 个子 describe——嵌套无先例，且变体归属由用例表已固定，平铺更贴 #347。

### D5 负控组织：内嵌成对 + 引用保持，零重复

| 负控（SA6 §12.9） | 落位方式 |
|---|---|
| N-A 无 guard 基线 | **引用保持**：`issue-347-guard-envelope-red.test.ts` N1–N4 原样全绿即满足；本文件不重复断言（避免同义反复与双维护） |
| N-B equals 反极性 | **内嵌成对**：A1↔A1d、A3↔A4、A9↔A11、F1/F2↔F3/F4、A2↔A7 等同 fixture 两极性用例相邻落位，极性互反（满足→`ok:true`+落盘；不满足→稳定码判决），断言口径同为 SA6 §12.0 判决契约 |
| N-C absent 反极性 | **内嵌成对**：B 组每条读失败路径的 absent（满足）与同路径有值对照（B25/C3/E6/G3 不满足）成对出现 |
| N-D 次序对照 | **内嵌**：E4（guard 满足 + 非法新值 → schema 管线可达、message 含 `类型不匹配`）↔ E7（guard 不满足 + 同款非法新值 → 唯一 guard issue、message 不含 `类型不匹配`） |
| N-E 公共面 | **引用保持**：`public-surface-guard.test.ts` 原样全绿即满足；本文件仅在 `expectGuardMismatch` 内保留 `issue.code === ns.MUTATION_GUARD_MISMATCH` 同源检查（#347 P2 同款，一行成本） |

### D6 助手集：#347 五助手原样内联 + 新增 `expectCommitted`

`derivedOf`/`fixture`/`run`/`bytes`/`watchWrites`/`expectZeroWrite`/`expectGuardMismatch`/`expectShapeError` 按 #347 L54–167 同款语义内联于本文件（自包含，不跨文件 import）。新增一个满足态助手：

```ts
/** 满足判决共同断言：ok:true + 恰 1 次本地事务 + 恰 1 次 update（SA6 §12.0）。 */
function expectCommitted(
  result: ApplyValidatedMutationResult,
  watch: { txs: { count: number }; updates: Uint8Array[] },
  label: string,
): void
```

理由：矩阵约 40 个满足态用例共用同一满足契约，集中编码防口径漂移（#347 满足态少，内联可接受；本票量级下助手化是一致性要求）。落盘值断言（如 `taskEntry(fx,'t1').get('status')`、`(fx.root.get('values') as Y.Array<number>).toJSON()`）保持逐用例内联。`expectShapeError` 仅 A13 使用（保留，因 A13 需要零写入三件套与无码断言，与 #347 S10 同源对照）。

### D7 断言纪律（反伪绿/重言式的机械约束）

- 全部断言观察运行时行为：结果联合（`ok`/`issues`/`code`/`path`）、活动 Y.Doc 值、事务/update 事件计数、`Y.encodeStateAsUpdate` 字节快照。**禁止**：`skip`/`only`/`todo`、env override、fallback、吞错、软化断言、以源码字符串/正则断言实现、以 message 文案替代 `code`/`path` 断言（message 仅辅助：C2/E4/E7 的 `toContain`/`not.toContain` 为次级断言，主断言仍是判决契约）。
- 零写入三件套（字节不变 + 0 事务 + 0 update）在每个不满足/形状错误用例中经 `expectZeroWrite` 强制。
- fixture 不共享可变状态：每个 `it` 内独立 `fixture(...)`；同一 `it` 不含多场景（D3 已定）。

### D8 文件头 doc-comment：锚定矩阵定位（明确非红灯）

文件头必须：引 ADR 0025 L42–44/L48–51/L53–58/L72–74、ADR 0008 L23/L26、ADR 0007 L93–96、ADR 0026 L29/L53–55 与 SA6 契约 §12.0–§12.9 用例 ID；声明本文件是**回归锚定矩阵（目标绿）**——ADR 0025 能力已由 #347 落地并有红灯证据，本票不伪称红灯（SA6 §13）；引用 §9.2 变异敏感度（M1–M4）作为非重言式证明。**禁止**照抄 #347 头部「红灯现状」段——HEAD 无红灯，抄写即虚构。

### D9 主要备选方案汇总（均否决，理由如上）

单票多文件（D1 否）、共享 helper 模块（D2 否）、成对共用 `it`（D3 否）、嵌套 describe（D4 否）、重复 #347 负控（D5 否）、生产预防性改动（SA6 §12.11.1 修正范围 ∅，任何「顺手加固」都触碰冻结面风险，否）。

## 8. 接口、状态机和数据流（= 覆盖计划）

### 8.0 可观察判决契约（全部用例的断言口径，冻结自 SA6 §12.0）

见 §2.2 三态。补充：`issues[0].path` 断言用 `toEqual(guardPath)`（#347 L145 同款新鲜副本等价断言）。

### 8.1 fixture 规格（冻结）

```ts
const TEXT = `type Task = { status: string; reviewer?: string; tags?: YArray<string> };
type ROOT = {
  n: number; a: string;
  tasks: Record<string, Task>;
  values: YArray<number>; more: YArray<string>;
  body: YXmlFragment<{ p: string }>;
  blob: YPlainArray<YLeaf<string>>;
  free: unknown;
};`;

// baseSnapshot()（overrides 展开）：
// { n: 4711, a: 'guarded-scalar',
//   tasks: { t1: { status: 'draft', reviewer: 'r0', tags: ['x','y'] },
//            t2: { status: 'open',  reviewer: 'r0', tags: [] },
//            t3: { status: 'draft' } },               // t3 缺可选键（AC1/AC5 依赖）
//   values: [1,2,3], more: ['m'],
//   body: '<p>hi</p>', blob: ['b1','b2'],              // XML 终点 / YPlainArray
//   free: { arr: [10,20,{k:'v'}], obj: { nested: { deep: true }, nil: null } } }
```

B 组直造载体变体（`fixture()` 后 `fx.root.set('free', …)`，read 系列测试同款惯例）：

| 变体 | 构造 | 服务用例 |
|---|---|---|
| Y.Text 终点 | `fx.root.set('free', new Y.Text('t'))` | B22/B23/B24 |
| 空 XML 终点 | `fx.root.set('free', new Y.XmlFragment())` | B25/B25b |
| 非 plain 原型 | `fx.root.set('free', new Date(0))` | B26/B27 |
| detached 载体嵌 plain 容器 | `fx.root.set('free', { frag: new Y.XmlFragment() })`（plain 值内嵌、永不集成 → `doc===null`） | B28/B29/B30 |

设计依据：读面 schema-independent（ADR 0008 L18/L109；ADR 0016 L74），guard 评估只消费 `readLogicalValueAtPath`，直造载体在契约内；read.ts R2 #2 detached 守卫（L247–248/L341–344）与 read 测试 L278/L282 是既有同款先例。

### 8.2 覆盖计划（92 用例逐组；输入/断言细目以 SA6 §12.2–§12.8 表为准，本表为组织与关键断言契约）

**A 组 · AC1 equals 深相等（16）** — fixture：标准（A12 用 `baseSnapshot({ free: { z: 0 } })`、A1b 用 `baseSnapshot({ n: -0 })`、A14 程序化构造 24 层嵌套对象）。承载 op 一律 `set n=2`（A13 为形状对照，无承载写）。关键锚：`-0`/`0` 四向（A1/A1b/A8/A12——M2 盲区增量锚）；undefined 键过滤三态（A5 多幽灵键 / A6 缺键≡显式 undefined / A7 键完整非子集）；嵌套结构与数组顺序敏感（A2–A4/A9–A11）；A13 `equals:undefined` → `expectShapeError`（无码 + 零写入，与 #347 S10 同源）。

**B 组 · AC2 读失败两态（31）** — fixture：B1–B21 标准；B22–B30 按 §8.1 变体表。共同契约：读失败/越界/吸收路径上 absent 用例期望满足判决（`expectCommitted` + 落盘 `n=2`），同路径 equals 用例期望不满足判决（稳定码 + `path`=guard 路径 + 零写入）。关键锚：标量穿越（B1/B2）、中间容器缺失（B3/B4）、Y.Array 越界/负下标/非整数下标（B5–B10，均为读失败非形状错误）、plain array 越界/段型（B11–B13）、null 穿越与 null 终点区分（B14 穿越读失败 absent 满足 / B15 equals 不满足 / B16 `equals:null` 终点满足——null 是合法值）、plain 缺键立即结束（B17/B18）、布尔标量穿越（B19）、越界先于后续段（B20）、段型不符先于后续段（B21）、Y.Text 终点与穿越（B22–B24）、空 XML 终点 `''` 属有值（B25 absent **不满足** / B25b `equals:''` 满足）、Date 不可下钻（B26/B27）、detached loud 拒绝禁止静默投影（B28–B30，即使内容字面相等也不满足）。

**C 组 · AC3 XML 两形态（7）** — fixture：标准（`body` 物化为 Y.XmlFragment）。C1 `['body']` `equals:'<p>hi</p>'` 满足（X0 已证投影值即 `toString()` 语义字符串，期望直接用字面量）；C2 同路径 `equals:'<p>bye</p>'` 不满足 + message 含实际 `<p>hi</p>`（辅助断言）；C3 `absent:true` 不满足（字符串是值）；C4/C5 `['body','p']` 穿越 XML 不可下钻终态 → equals 'hi' 不满足 / absent 满足；C6/C7 `['body',0]` number 段穿越 XML 同两态。

**D 组 · AC4 数组下标段纪律（15）** — fixture：标准。段纪律同 mutation path（类型纪律：string=键 / number=下标；值域边界沿读面，段型合法即非形状错误）。关键锚：Y.Array/YArray 嵌套/plain array/YPlainArray 位置读取（D1/D2/D9/D12）、下标段+键段混用（D10）、`-0` 归一（D3/D13）、string 段落数组与 number 段落 Y.Map 均读失败（D4–D7/D11）、index==length 越界吸收（D8）、值域边界 `Number.MAX_SAFE_INTEGER+2` 与 `NaN` 段（D14/D15 absent 满足——非 guard 形状错误）。

**E 组 · AC5 set([]) legacy 先过 guard（7）** — fixture：标准；E1–E4/E7 的 value 为 `baseSnapshot({ n: … })` 全量快照（E3 再删除 `tasks.t1.reviewer`）。关键锚：不满足零写入（E1——M3 盲区增量锚）；满足走完整 legacy 管线：ROOT 全等新快照 + 1 事务 1 update（E2）；省略可选键证明完整清空重装非合并（E3：提交后 `tasks.t1` **无** `reviewer` 键，断言 `taskEntry(fx,'t1').toJSON()` 深等 `{status:'draft',tags:['x','y']}` 或 `has('reviewer')===false`）；guard 先于 schema 校验在 legacy 分支同样成立（E4 满足→schema 管线可达、message 含 `类型不匹配`、无码 ↔ E7 不满足→唯一 guard issue、message 不含 `类型不匹配`）；absent 两极（E5 满足 / E6 不满足）。

**F 组 · AC6 大子树（4）** — fixture：程序化构造（`Array.from({length:64}, …)` 生成 `tasks`；`Array.from({length:256},(_,i)=>i)` 生成 `values`），不用字面量。F1 64 键 Record 整树 equals 满足；F2 256 元素数组整树满足；F3/F4 同规模一元素/一键差异 → 不满足判决 + `issue.message.length < 4096`（截断防爆次级断言；SA6 §7 实测 594/593）。深度方向由 A14（24 层）覆盖；万层级深属非 AC 边界（§1 非目标）。

**G 组 · AC7 批量顶层同语义（12）** — fixture：标准；`ops` 固定 `[{op:'set',path:['tasks','t1','status'],value:'reviewing'}, {op:'array-insert',path:['values'],index:1,values:[9]}]`（G10 为 `[{op:'set',path:['n'],value:'bad'}]`）。共同契约：满足 → 两 op 全落盘 + 恰 1 事务 1 update；不满足 → 恰 1 issue（先于逐 op prepare、无聚合）+ 稳定码 + `path`=guard 路径 + 零写入。G1–G12 与 A/B/C/D/E 单操作配对（G1↔A2、G2↔B4、G3↔B 极性、G4↔C4、G5↔C1、G6↔A1、G7↔D1、G8↔A6、G9↔B6、G10↔E7/O1、G11↔D5、G12↔A10/D10），用例标题或注释标注配对 ID（成对声明即 N-E 的批量 vs 单操作对照）。

### 8.3 运行时数据流

**本设计无运行时数据流变化**（测试唯一交付物；生产路径零改动）。依据：矩阵只**观察** §2.1 既有调用链——guard 评估是槽内 prepare 的纯读段（`evaluateGuard` → `readLogicalValueAtPath`，零写入零事件、不进事务），写侧提交点（`transactGuarded` 单事务 + 边界/快照验证）与失败清理（零写入 = 不开启事务）均为既有行为，矩阵仅断言其可观察产物（结果联合、Y.Doc 值、事件计数、字节快照）。无跨模块/跨进程/跨持久化新边界。

## 9. 错误、恢复、并发和幂等

- 错误两态锚定：形状错误（无码、不可重试、零写入）与评估不满足（稳定码、可重试、零写入单 issue）——矩阵 A13/E 组/B/C/D 不满足用例分别锚定；不引入第三态。
- 恢复/可重试语义：#347 M9 已锚（状态改写后重放同一信封通过）；本矩阵不重复，E/G 不满足用例的「可重试」属性由稳定码 + `path` 断言携带。
- 并发/幂等：无新增面。原子性归写序列器 FIFO（ADR 0008 L40–51）；序列器竞争面由既有 `packages/namespace-runtime/test/issue-347-guard-passthrough-red.test.ts` 与根套件覆盖（SA6 §7）。测试自身全同步、无定时器、无真实时钟（SA6 §7 探针 4 轮无 flake 的设计侧保证）。
- 资源所有权：每个 `it` 自建 `Y.Doc`，无跨用例共享；vitest 单 worker（`maxWorkers: 1`）下无并行干扰。

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| `applyValidatedMutation` 生产调用方（namespace-runtime 写槽、上层 typed adapter） | 消费结果联合（`ok`/`issues`/稳定码） | **不变**（测试唯一交付物，公共 API/类型/行为零变化） | 无 | §2.1；`index.ts` L23/L28–33 导出面冻结；SA8 冻结面表 |
| `issue-347-guard-envelope-red.test.ts` / `issue-350-*.test.ts` / `public-surface-guard.test.ts` | 28 files/447 tests 全绿 | 原样保持全绿（负控基线 N-A/N-E 的载体） | 无（禁止修改，§11 DENY） | SA6 §4 基线、§12.1 |
| 根 vitest 入口 | include `packages/*/test/**/*.test.ts` | 自动发现新文件（SA6 §14 runner-trigger 已证）；套件 28→29 files、447→539 tests | 无配置改动 | `vitest.config.ts` L15 |
| 根 `pnpm typecheck` | `tsc -p packages/doc-runtime/tsconfig.json` 含 `test/**/*.ts` | 新文件纳入类型检查（AC8 门的一半由此闭合） | 无 | `packages/doc-runtime/tsconfig.json` include；`package.json` L13 |
| CI / 后续维护者 | 依赖矩阵语义与 ADR 0025 一致 | 矩阵成为 ADR 0025 评估语义的可执行规格（重构守卫） | 无 | §3 根因链（既有套件盲区被封堵） |

无未覆盖调用方：本设计不改变任何返回值、抛错、nullable、异步时序、取消或生命周期语义。

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/doc-runtime/test/issue-348-guard-semantics-matrix.test.ts` | **新建**单个测试文件：§7 D2–D8 规格的文件头 doc-comment、fixture（§8.1）、助手、7 个 describe × 92 个 `it`（§8.2） | AC1–AC8 全部落点（SA6 §12.1 冻结路径；唯一交付物） |
| `wiki/raw/task_issue-348_design.md` | 本设计产物 | SA1 固定产物位 |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/doc-runtime/src/mutation.ts` | guard 实现（被矩阵观察） | SA6 §12.11.1 修正范围 ∅（HEAD 92/92 一致）；§13.3 条件修正路径是唯一例外入口，主范围禁改 |
| `packages/doc-runtime/src/read.ts` | guard 评估消费的投影读面 | ADR 0008/0016 冻结契约；SA8 §4；触碰须回 SA8 |
| `packages/doc-runtime/src/index.ts` | 公共导出面 | 导出集冻结（N-E）；ADR 0025 L87 已落地 |
| `packages/doc-runtime/test/issue-347-guard-envelope-red.test.ts` | guard I 既有锚与 N-A 负控 | 负控基线须原样保持全绿（SA6 §12.1） |
| `packages/doc-runtime/test/public-surface-guard.test.ts` | 公共面审计（N-E） | 同上；导出无变化故无需同步 |
| `packages/doc-runtime/test/issue-350-*.test.ts`、其余 `packages/doc-runtime/test/*` | 既有套件 | 无关联改动需求；修改即破坏基线计数与负控语义 |
| `packages/namespace-runtime/**`、`packages/vfsl*/**`、`packages/persistence/**`、`apps/**`、`domains/**` | 无关面（ADR 0025 L60 诊断透传、词表、生成器） | 本票为 doc-runtime Seam 1 测试票；跨包改动即越权 |
| `docs/adr/**`、`CONTEXT.md`、`docs/protocols/**` | 决策面 | 无决策演进（SA8 §5 无 evolution）；文档纪律禁止无行为变化的规范改写 |
| `vitest.config.ts`、`package.json`、根/包 tsconfig | 测试发现与类型检查配置 | include/`typecheck` 已覆盖新路径（§10；SA6 §14 已证） |
| `wiki/raw/task_issue-348*.md`（除 ALLOW 的设计产物） | Host/上游产物 | 只读输入 |

## 12. 验收与验证映射

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1 深相等（`-0`/0、undefined 过滤、嵌套、大子树、深结构） | SA6 §5 探针 16/16；#347 G7/M10 部分覆盖 | A 组 16 用例（§8.2） | 92 用例全绿；A1/A1b/A8/A12/G6 在 M2 变异下必红（反伪绿） |
| AC2 读失败两态/缺席吸收 | SA6 §5 31/31；#347 M5/G6 部分 | B 组 31 用例 | 全绿；读失败路径 absent 满足/equals 不满足成对；B28–B30 无静默投影 |
| AC3 XML 两形态 | SA6 §5 7/7 + X0 | C 组 7 用例 | 全绿；C3/B25 absent 对有值（含 `''`）不满足 |
| AC4 数组下标段纪律 | SA6 §5 15/15 | D 组 15 用例 | 全绿；段型不符=读失败非形状错误（D4/D6/D11/D15） |
| AC5 set([]) 先过 guard | SA6 §5 7/7；#347 G5/N4 满足态与无 guard 基线 | E 组 7 用例 | 全绿；E1/E6/E7 在 M3 变异下必红；E3 提交后 t1 无 `reviewer` 键 |
| AC6 大子树比较 | SA6 §5 4/4、§7 规模/消息有界实测 | F 组 4 用例 | 全绿；F3/F4 `message.length < 4096` |
| AC7 批量顶层同语义 | SA6 §5 12/12、§12.8 成对声明 | G 组 12 用例 | 全绿；与单操作配对判决一一相同；不满足恰 1 issue 无聚合 |
| AC8 落位 + 门 | SA6 §4 基线、§14 可发现性 | 实现票执行：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/doc-runtime/test` + 根 `pnpm typecheck` | 29 files / 539 tests 全绿（D3 粒度下确定性计数）、typecheck exit 0 |
| 负控 N-A–N-E 保持 | #347/public-surface 现全绿 | 上述门内一并运行（引用保持，§7 D5） | 两既有文件原样全绿 |
| 条件门（仅当实现修正发生） | `packages/doc-runtime/AGENTS.md` Verification | 修正触及 mutation/read 契约 → 追加根 `pnpm test` | 349 files / 3686+ tests 全绿、no type errors |

## 13. 风险、回滚和残余问题

### 13.1 风险

| 风险 | 缓解 |
|---|---|
| 矩阵被弱化为重言式（只断言现状、不锚语义） | D5 内嵌成对极性 + D7 判决契约强制（稳定码/path/零写入三件套）+ SA6 §9.2 变异敏感度在案（M1–M4 全击穿，M2/M3 为既有套件盲区的增量锚）；SA2 评审按 §8.2 逐行映射审计 |
| 实现落码时意外红灯（探针与正式测试的口径差） | §13.3 有界条件修正路径；修正触碰冻结面 → 停止并回 SA8，不得在票内静默改契约 |
| B22–B30 直造载体 fixture 依赖 Yjs 内部集成行为（detached `doc===null`、plain 容器内嵌不集成） | read.ts R2 #2/L247–248/L341–344 是显式契约分支；read 测试 L278/L282 同款先例；SA6 §5 已实测该五变体全绿 |
| F/A14 程序化 fixture 可读性与规模成本 | 程序化构造（非字面量）；成本线性（SA6 §7：探针单轮 ≈2s、套件 9.7s 基线） |
| 与 #347 fixture 漂移 | D2 超集策略：既有字段逐字段同形，仅增不改 |
| 用例计数偏差（评审或实现对 92 的拆分理解不一致） | D3 冻结 1:1 映射与 ID 清单（§8.2 组小计 16+31+7+15+7+4+12=92）；539 计数为自查锚 |

### 13.2 回滚

交付物为单个新增测试文件，无生产耦合：回滚 = 删除该文件，套件回到 28 files / 447 tests 基线；不涉及数据、配置或迁移。

### 13.3 条件修正路径（仅实现红灯时启用；主范围为 ∅）

按 SA6 §12.11.2 承接，裁定权在实现票、约束如下：

1. 以 ADR 0025 为准修正，且修正收敛于 doc-runtime guard 专属面：允许改 `packages/doc-runtime/src/mutation.ts` 内 guard 专属逻辑（`parseGuard` 形状检查、`evaluateGuard` 两态判定、guard 局部深相等比较器、`mismatchIssue` 摘要）——此时 ALLOW LIST 相应开放该文件。
2. 禁止触碰（SA8 §4 冻结面）：稳定码字面量、不满足 issue 形态、形状错误族与无码性、谓词词表、单操作无 guard 逐字节契约、`index.ts` 导出集、评估位置与次序、`set([])` 管线归属。触碰任一项 → 停止实现、回 SA8 复核。
3. 谨慎项：`logicalValuesEqual` 同时被 `resolveNode`（mutation.ts L535，union 成员判别）消费——不得为 guard 需求整体重写；优先新增 guard 局部比较器并附 union 面回归证据。
4. 修正触及 `read.ts`（ADR 0008/0016 契约）→ 回 SA8；触及 mutation/read 契约 → 按 AGENTS.md 追加根 `pnpm test`（§12 条件门）。

### 13.4 残余问题（明确的 follow-up，非本票必要条件）

- A15/Z1–Z3（equals 侧非 JSON 形态：自定义 plain 原型链、循环、万层深；读面栈边界收编）语义未被 ADR 定义，当前 fail-closed 零写入。若未来要收口，属形状错误语义演进，须独立决策（ADR 0025 L94 同款路径），不随本票。
- 谓词词表演进（`exists`、数字比较、`neq`、多条件、guard 路径放开 `[]`）——ADR 0025 开放问题 1，词表封闭，须显式决策过设计评审。

## 14. 评审修订映射

iteration 0 无评审输入（`wiki/raw/task_issue-348_sa2_review.md` 不存在）。首轮评审到达后按 finding 逐条修订本文件并在此登记映射。

## 15. 是否需要设计后 ADR 冲突复查

**否（requiresConflictRecheck = false）。** 理由：本设计是纯测试锚定——不改公共 API/协议、不动 wire/schema/持久化/状态机/生命周期、不修订任何既有决策、不引入新生命周期所有权或失败语义（三态错误域只被断言、不被改变）；全部对照项为 implements-existing-decision / no-conflict，SA8 前置门禁已裁 clear 且 requiresConflictRecheck=false。唯一条件性再核入口是 §13.3 第 2 条（实现修正触碰冻结面时另起），属未来条件触发，不构成本设计的既定复查需求。
