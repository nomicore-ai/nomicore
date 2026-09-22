# SA1 实现设计 — issue #435：vfsl 数组逐元素校验 seam + 一致性 fixture（ADR 0033 · vfsl 侧）

- 任务卡：`wiki/raw/task_issue-435.md`（Issue #435，feature；Parent PR #434 = `spec/433-yarray-elementwise-validation` 基线）
- 上游输入：`wiki/raw/task_issue-435_sa6_contract.md`（SA6 验收契约，**approve**）+ 其交付的四个测试文件与探针
  `wiki/raw/task_issue-435_sa6_capability_probe.mts`
- 缺失输入（iteration 0，已核实 `ls wiki/raw`）：`task_issue-435_relevant_decisions.md`、`task_issue-435_conflict_report.md`、
  `task_issue-435_sa2_review.md` 均不存在——处置见 §6/§15
- 基线 HEAD：`f6b27da8eadc5cad3bf65c728094767ecb8c601b`（与 SA6 契约一致；工作树含 SA6 未跟踪交付件）

---

## 1. 任务类型、目标与非目标

**类型**：Feature（能力缺口 + 立法执行面）。SA6 已证明：现行「整数组重建 + `validateSubtree` 整体验证」在
phase-1 契约下**正确**（负控 17/17 绿）；缺口是 ADR 0033 要求的**公共逐元素接缝与触达面收窄尚无载体**。本设计不虚构 Bug 根因。

**目标**（全部落在 `@nomicore/vfsl` 包内，纯加法）：

1. 新公共运行时导出 `applyElementwiseArrayMutation` + 类型导出 `ArrayCarrierFacts`、`ElementwiseArrayMutationPayload`
   （绑定 B-1…B-5，SA6 §12.1）——以「element 子 schema + 载体长度 O(1) 事实 + 新值/区间」结算数组写判定，
   不再要求调用方提供整数组边界提取值；
2. `array-insert` 逐新值过 element 子 schema，issue 路径 `[...arrayPath, index+j, ...elementIssuePath]`，
   与现行全量路径输出**逐字节一致**（合法基线）；`array-delete` 仅做域规则判定（O(1)，不触碰元素值）；
3. ADR 0033 决策 4 的触达面收窄在新接缝上生效（污染数组的 delete 照常成功）；
4. ADR 0033 决策 5 的一致性 fixture 以既有 SA6 交付件落地（132 例逐元素 vs 全量逐字节一致，本票使其转绿）。

**非目标**：

- doc-runtime 消费方接线（S5 省略整数组 walk / S6 换接缝 / S9 省略边界重投影、E201 行为变化）——后续票
  （SA6 §15「doc-runtime 接线」；ADR 0033 决策 3）。本票后数组写热路径**仍走 legacy 轨**，O(n)→O(k) 的
  实际收益在接线票兑现；
- union 数组目标（`A[] | B[]`）改道——永久 legacy（ADR 0033 决策 1，双轨有意保留）；
- plain 数组（YPlainArray）、数组级约束语法（被立法禁止而非实现）、污染数组的异步/抽样审计、delete 前像捕获
  （ADR 0033「不做什么」）；
- 修改既有导出、既有 message、legacy 判定路径的任何字节（NC1–NC6 + `validate-patch-mutation-boundary.test.ts` 锚定）；
- 性能基准门禁（ADR 决策 6 为软验收；SA6 契约明确不含阈值断言，避免机器相关伪红）。

## 2. 当前行为与证据锚点

| 事实 | 锚点 |
|---|---|
| 结构侧边界规划：`planMutationBoundary(derived, path, op)` 纯函数；array-* 目标产出 `kind='array'`、`prefix=full`、`relPath=[]`、`node=descendValues(values, prefix)`（值树节点，已归一化非 ref/optional） | `packages/vfsl/src/validate-patch.ts` L736–819（数组支 L796–799） |
| 数组节点值 schema：`{ kind: 'array'; element: ValueSchema }`（element 可为 union/scalar/object/ref） | `packages/vfsl/src/derived.ts` L44–46 |
| 现行执行接缝 `applyMutationAtBoundary(derived, plan, boundaryBase, mutation)`：数组支先 `relNavigate(boundaryBase, relPath)`、要求 `Array.isArray(target.value)`（L985–987，message `${op} 目标必须是数组`），insert 域检查 `index > arr.length`（L990–992，message `array-insert index 越界（不 clamp）`）、整数组 splice 重建（L993–996）；delete 域检查 `index >= length \|\| index + count > length`（L1000–1002，message `array-delete 范围越界（不 clamp、不接受越界 no-op）`）后重建；两支统一 `validateBoundary` = `validateSubtree(plan.node, proposed)` + 按 `plan.prefix` rebase（L1012–1019） | `packages/vfsl/src/validate-patch.ts` L923–1008 |
| 共享解释器 `validateSubtree(values, node, value)`：issue path 相对子树根（`[]` 起步）；全收集上限 100 条 + 截断标记（`校验问题超出 100 条上限…另有 N 处问题未报告`，path `[]`）；工作预算 2×10⁸（每调用独立）；E100 崩溃边界在 `interpret` 顶层收编、**从不抛错** | `packages/vfsl/src/validate.ts` L708–741（validateSubtree L768–770；ISSUE_LIMIT L54；数组分发 L604–615：逐元素 `validateValue(element, value[i], [...path, i])`） |
| 公共面：22 个运行时导出只经 `src/index.ts`；`validate-patch` 家族导出块 L125–137 | `packages/vfsl/src/index.ts` L125–137；SA6 探针 G1（运行时反射） |
| 消费方（不在本票改）：doc-runtime kind=`array` 分支 S5 `walk(boundaryNode, boundaryLive)` 整数组提取 → S6 `applyMutationAtBoundary(walked.snapshot)`；`mutation.ts` L337/L361 组合写同轨 | `packages/doc-runtime/src/mutation-local.ts` L296–347（walk L305、apply L310）；`packages/doc-runtime/src/mutation.ts` L40/L337/L361 |
| 包纪律：公共 API 只经 `src/index.ts`；同步/纯函数/不抛错（畸形输入走判别联合）；稳定 message/issue 顺序/path 是兼容行为；不引入 Yjs 运行时关切 | `packages/vfsl/AGENTS.md` |
| 词汇：数组位例外（ADR-0033）——非 union `T[]` 走逐元素校验、union 数组目标仍整体验证、触达面 = 载体 + 变更区间 | `CONTEXT.md`「重建校验」条目、「复制未校验」条目 |
| 既有语义锚：legacy 边界接缝单测（本票必须保持绿） | `packages/vfsl/test/validate-patch-mutation-boundary.test.ts` |

## 3. 能力缺口（Feature 语义的「根因」）

SA6 契约 §8 的能力缺口链（本设计全盘承接，不重复论证）：

1. **公共面零落点**：22 导出中无任何逐元素数组接缝（探针 G1 运行时反射 `/elementwise/i` 零命中）；
2. **唯一数组判定入口是边界值驱动**：`applyMutationAtBoundary` 数组支必须消费整数组提取值（G2：以载体事实
   `{length}` 代 boundaryBase → `ok:false`「目标必须是数组」）；成本与 n 耦合（G3 软证据：100× 规模 → ×83–97）；
3. **判定语义本身正确**（负控 NC1/NC2 + pre-contract 全绿）——缺的是把「整体验证」替换为「逐元素验证」的公共表达，
   以及决策 4（触达面收窄）与决策 5（立法 fixture）的载体；
4. **关键设计约束（探针 E2/G5）**：union 数组目标的判别**不在 `plan.kind`**（仍为 `'array'`），而在
   `plan.node.kind === 'union'`——闸门必须双条件，只看 `plan.kind` 的实现会在 `plan.node.element` 处失守。

## 4. Owner要求落实

Host 简报明文：**「Issue comments REST snapshot is empty; no owner requirements apply」**（SA6 §2 同证）。
本设计全部需求源自 Issue 正文 What to build + AC1–AC6 + ADR 0033 决策 1–5 + `CONTEXT.md` 词汇，无外部 Owner 追加面。

| Comment ID | Updated at | Requirement | Design section |
|---|---|---|---|
| （无） | — | 无 owner 评论 | — |

## 5. 复现和根因承接

| 上游事实（SA6 契约） | 证据位置 | 设计响应 |
|---|---|---|
| G1 公共面无逐元素接缝（22 导出普查零命中） | 契约 §5.1；探针 G1 | §7 D8：`src/index.ts` 追加 1 运行时导出 + 2 类型导出（纯加法，B-1/B-2/B-3 绑定） |
| G2 legacy 接缝必须消费整数组提取值 | 契约 §5.2；探针 G2 | §7 D3：新接缝第 3 参只收 `ArrayCarrierFacts = { readonly length }`，不收数组值 |
| G3 成本与 n 耦合（×83–97/100× 规模，软证据） | 契约 §5.3 | §7 D3：判定只读 `facts.length` + k 个新值，结构性 O(k)；本票不含基准断言（决策 6 软验收） |
| G4 现状语义快照（issue 路径/批量序/域 message 逐字节） | 契约 §5.4；负控 NC1 | §8 message 冻结表逐字复用两条域 message；元素 issue rebase 公式 `[...prefix, index+j, ...rel]` 与 legacy `validateBoundary` 数学同构（E3 见证 132/132） |
| G5/E2 闸门判别在 `plan.node.kind`（union 数组目标 `plan.kind='array'` 但 `node.kind='union'`） | 契约 §5.5/§9-E2；负控 NC3.2 | §7 D4：闸门 = `plan.kind==='array'` ∧ `plan.node.kind==='array'`（+ relPath 结构前提），fail closed 返回 `ok:false`（B-6、契约 F1–F3） |
| E3 见证实现 132/132 逐字节命中；E5 判据敏感 6/6 | 契约 §9 | §7 D6：生产实现采用与见证同构的「逐值 `validateSubtree(plan.node.element)` + rebase」管线 |
| E6/NC4 立法前提：VFSL v1 数组层无数组级约束 | 契约 §9-E6；负控 NC4 | 设计零触碰 `validate.ts` 解释器（DENY LIST）；一致性 fixture（SA6 交付件）即执法载体 |
| 决策 4：污染数组 delete 由响亮拒绝变为照常成功 | ADR 0033 决策 4；契约 D4/D5/E2 | §7 D3 delete 支只查域规则、从不读取元素值（无元素值输入面） |
| pre-contract 基线全绿 / post-contract 红面恰 = 契约 21 + test-d 7 条 | 契约 §4/§13 | §13 验收映射：实现后 21+17+test-d 全绿、根 typecheck/test 复绿（AC6） |
| **矛盾记录**：SA6 §13 绿色判据写「探针 exit 0 不变」，但探针 G1.1/G1.2 断言的正是**导出缺席**（`/elementwise/i` 零命中、`typeof !== 'function'`）——实现后这两项**必然翻红**（缺口闭合的预期翻转；其余 GAP/ORACLE/NC/DRY 组基于 legacy 轨与夹具见证实现，不受影响） | 探针 L126–132 vs 契约 §13 | 不阻塞设计：门禁是契约/负控/根 typecheck+test（AC6 明文），探针不在 vitest include 面（`wiki/raw/**`）。设计处置：探针保持时点证据不修改（§12 DENY），验收时探针预期态 = 仅 G1.1/G1.2 两项 FAIL、其余全 PASS；已在 §14 R1 登记提请验证角色按此解读 |

## 6. SA8约束落实

#435 无 SA8 工件（iteration 0，SA6 §1/§15 同证）。替代约束面（ADR + CONTEXT + 包纪律），逐条落实：

| 决议或义务 | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|
| ADR 0033 决策 1：闸门 = `plan.kind='array'` ∧ 边界值节点 kind=`array`；union 数组目标永久回退 legacy；规划层完全不动 | §7 D4 | 闸门三条件（含 relPath=[] 结构前提）fail closed；`planMutationBoundary` 零改动（DENY） | 否（执行既定决策） |
| ADR 0033 决策 2：insert 逐新值过 element 子 schema + issue 路径 `[...arrayPath, index+j]`；delete 仅越界检查；域规则逐字一致（不 clamp、拒越界 no-op、批量一次判定、空批量 noop）；零写入纪律不变 | §7 D3、§8 算法/冻结表 | 逐值 `validateSubtree` + rebase；两条域 message 逐字复用；纯函数无任何写入面 | 否 |
| ADR 0033 决策 3：S9 安装事实核保留、fast-path 提交省略边界重投影 ⇒ 快路径产物不需要 `proposedBoundary` | §7 D7 | 返回 `ValidateResult` 直出（无 result 包装、无 proposedBoundary；B-5、test-d 负面夹具） | 否 |
| ADR 0033 决策 4：触达面 = 载体 + 变更区间；污染数组 delete 照常成功 | §7 D3 delete 支 | 域规则之外零判定；`ArrayCarrierFacts` 结构性排除元素值 | 否（有意行为变更，契约 D4/D5 已固化） |
| ADR 0033 决策 5：立法 + 一致性 fixture | §12（fixture 为 SA6 交付件，本票转绿） | 解释器零改动；fixture 断言逐元素 vs 全量逐字节一致 | 否 |
| ADR 0033 决策 6：性能软验收 | §1 非目标、§13 | 无阈值断言；规模证据留诊断面（探针 G3） | 否 |
| `CONTEXT.md`「重建校验」/「复制未校验」条目（数组位例外词汇） | §12 DENY（CONTEXT 不改） | 词汇已描述 ADR-0033 目标态；本票实现 vfsl 侧，措辞-现实差由 doc-runtime 接线票收口（§14 R5） | 否 |
| `packages/vfsl/AGENTS.md`：公共面只经 `src/index.ts`；同步/纯函数/不抛错；稳定 message/顺序/path 兼容；无 Yjs 关切 | §7 D2/D3/D8、§9 | 接缝只收载体**事实** `{length}`（非 live 载体）；E100 崩溃边界同款；新 message 即刻冻结（§8 表） | 否 |
| 简报 AC1–AC6 | §13 映射表 | 全覆盖 | 否 |
| **SA8 工件缺席本身** | §15 | 绑定 B-1…B-6 由 SA6 冻结、语义取自 ADR 0033；若后续裁决换名/换形，只动契约绑定块 + test-d import + 本设计的 §8 类型块，语义/断言/fixture 不变（SA6 §12.1/§15 同款条款） | **是**（见 §15） |

## 7. 设计决策与主要备选方案

### D1 单接缝函数（两 op 判别联合载荷）——采纳

一个 `applyElementwiseArrayMutation` 承载 insert/delete 两支（载荷判别联合，B-2/B-4）。理由：与
`applyMutationAtBoundary` 的词表家族同构；调用方（未来 doc-runtime S6）在 kind=`array` 分支一次绑定；
SA6 §15 已裁定「拆成两个导出 = 等价实现，只需同步绑定块」——本设计取单函数为规范形。

**备选**：`validateElementwiseInsert` / `validateElementwiseDelete` 双导出——拒绝：公共面多一个名字、两份闸门/
守卫样板，契约绑定块需双份同步；无行为收益。

### D2 实现位置：就地扩展 `packages/vfsl/src/validate-patch.ts`——采纳

与 `planMutationBoundary`/`applyMutationAtBoundary` 同文件：边界接缝家族内聚，直接复用既有私有纪律
（`jsonTypeOf`、E100 包装模式、注释契约风格）与 `validateSubtree` import（L35）。

**备选**：新文件 `src/elementwise-array.ts`——拒绝：拆散 mutation 边界接缝家族、需要重复或内部导出
E100/守卫助手；公共面仍必须经 `src/index.ts` 转出，无解耦收益。

### D3 判定管线（O(k)，无整数组输入面）——采纳

```
闸门（fail closed） → 载体域事实守卫 → 载荷域标量守卫 → op 域规则（逐字复用 legacy）
  → insert：逐新值 validateSubtree(plan.node.element, values[j]) + rebase（批量一次判定，中间态不参与）
  → delete：直接 { ok: true }（不触碰元素值——决策 2/4）
```

- `facts` 只收 `{ readonly length: number }`（O(1)；`Y.Array.length` 的投影，**不是** live 载体——vfsl 无 Yjs 关切）；
- 复杂度结构性 O(1) 闸门/域规则 + O(Σ size(新值)) 元素校验；任何路径都不随 `facts.length` 增长；
- 零写入纪律：纯函数，无任何写面（比 legacy 更强——legacy 也纯，但消费大输入）。

### D4 闸门三条件 fail closed——采纳

`plan.kind === 'array'` ∧ `plan.node.kind === 'array'` ∧ `plan.relPath.length === 0`，任一不满足返回
`ok:false` 单 issue（新 message，§8 冻结表 G-A/G-B）。前两条 = ADR 决策 1 + B-6（union 数组目标由第二条排除，
探针 E2 实证判别点）；第三条是结构前提（`planMutationBoundary` 的 array-* 计划恒满足，负控 NC3.1 锚定
`relPath=[]`）——防御手造 plan，不收窄任何真实计划。**不得静默接受**（契约 F1–F3 红灯钉死）。

### D5 域外载荷/事实守卫（新词表，响亮拒绝）——采纳

类型词表之外、运行时可达的畸形形态（`facts.length` 非非负安全整数；`index` 非非负安全整数；delete `count`
非非负安全整数；insert `values` 非数组）→ `ok:false` 单 issue（新 message，§8 冻结表 F-1/P-1/P-2）。
理由：这些形态下 legacy 的产物语义（负 index 的重建放置、非整数 index 的 slice 截断）**依赖整数组**、在无
整数组输入面上不可复现；静默接受即「正常路径不变量缺失时的静默 fallback」。真实调用域（doc-runtime E3：
index 严格非负整数、count 严格正整数）永不受影响；界内 `count=0` 维持域谓词镜像结论 = 接受（与 legacy
NC1.5 快照及决策 4「零触达区间」语义一致，不进契约）。

**备选**：完全镜像 legacy 谓词、不加守卫——拒绝：负 index insert 会产出 `['items', -1+0, ...]` 类无意义
路径或静默 ok；「fail loud on 畸形输入」是包纪律（判别联合而非抛错）与设计纪律的共同要求。

### D6 元素校验复用 `validateSubtree`（单一解释器来源）+ rebase——采纳

每个新值独立调 `validateSubtree(derived.values, plan.node.element, values[j])`，issue 按
`[...plan.prefix, payload.index + j, ...issue.path]` rebase（等价于 legacy 对重建数组中位置 `index+j`
元素的 `validateValue(element, v, [index+j])` 发射路径）。SA6 见证实现（探针 REF，经合成 kind=`target`
计划复用 `applyMutationAtBoundary`）已证 132/132 逐字节一致；生产实现直接调 `validateSubtree` 少一层合成
plan 间接（同源 `interpret`，语义恒等）。

**已知边界（诚实记录，§8 分歧表）**：issue 上限与工作预算随调用粒度变化——legacy 一次调用 100 条上限 +
单预算 2×10⁸ 覆盖全数组；新接缝每元素独立上限/预算。仅在「单元素子树 >100 条 issue」或「预算耗尽/解释器
E100」的病态载荷上可分（截断标记与元素级解释器 issue 的 path 经统一 rebase 变为 `[...arrayPath, index+j]`，
仅接缝自身 wrap 的 E100 保持 path `[]`；legacy 两者均为 `[]`）——ADR 决策 6
后果明文接受「charge 计数变化（issue 输出不变）」的同族差异；fixture 132 例（批量 ≤3、元素浅层）远离该界。
**备选**（跨调用聚合 100 条上限 + 全局计数截断标记）——拒绝：需要在接缝内重实现解释器的计数态/标记拼装，
破坏「解释器单一来源」纪律，换取病态域的逐字节一致。

### D7 返回 `ValidateResult` 直出（无 `proposedBoundary`）——采纳

`{ ok: true } | { ok: false; issues: ValidateIssue[] }`（B-5）。决策 3：fast path 提交省略边界重投影，无
proposed 产物；不采用 `applyMutationAtBoundary` 的 `{ok:true; proposedBoundary} | {ok:false; result}` 包装
（test-d 负面夹具钉死非包装形）。

### D8 公共导出面（纯加法）——采纳

`src/index.ts` 既有 `validate-patch` 导出块（L125–137）追加：运行时 `applyElementwiseArrayMutation`，
类型 `ArrayCarrierFacts`、`ElementwiseArrayMutationPayload`；头注释块补 issue #435 一句。运行时导出
22 → 23；既有导出逐字节不变（NC6、`render-projection-text-control.test.ts` C1 均为超集锚，不锁新增名）。

**备选**：经新子路径 exports——拒绝：包 exports 只有 `.`（`packages/vfsl/package.json`），公共面唯一入口
纪律（AC5）。

## 8. 接口契约（实现冻结面）

### 8.1 类型（落位 `validate-patch.ts`，`src/index.ts` 转出）

```ts
/** 数组载体域事实（ADR 0033 决策 2）：O(1) 可得的长度投影——不含任何元素值。 */
export type ArrayCarrierFacts = { readonly length: number };

/**
 * 逐元素数组 mutation 载荷：字段与 BoundaryMutationPayload 同名支逐字一致（B-4），
 * 词表恰两支（set/delete 走 legacy 边界路径）。
 */
export type ElementwiseArrayMutationPayload =
  | { op: 'array-insert'; index: number; values: readonly unknown[] }
  | { op: 'array-delete'; index: number; count: number };

/**
 * 数组逐元素 mutation 判定（issue #435 / ADR 0033 决策 2）：在「element 子 schema +
 * 载体长度事实 + 新值/区间」上结算 array-insert/array-delete，不消费整数组。
 * 返回 ValidateResult 直出（无 proposedBoundary——决策 3）。
 * 同步、纯函数、不抛错（E100 同款崩溃边界）；调用方职责：闸门前置
 * plan.kind='array' ∧ plan.node.kind='array'（接缝对违约计划 fail closed，B-6）。
 */
export function applyElementwiseArrayMutation(
  derived: DerivedSchema,
  plan: MutationBoundaryPlan,
  facts: ArrayCarrierFacts,
  payload: ElementwiseArrayMutationPayload,
): ValidateResult;
```

### 8.2 判定算法（伪代码 = 实现规范）

```ts
function applyElementwiseArrayMutation(derived, plan, facts, payload): ValidateResult {
  return wrapElementwise(() => {              // 顶层 E100 收编（与 wrapApply 同款文案、结果形直出）
    // ① 闸门（B-6 fail closed；ADR 决策 1 双条件 + relPath 结构前提）
    if (plan.kind !== 'array' || plan.relPath.length !== 0) return single(G_A, [...plan.prefix, ...plan.relPath]);
    if (plan.node.kind !== 'array')             return single(G_B, [...plan.prefix, ...plan.relPath]);
    const arrayPath = [...plan.prefix];
    // ② 载体域事实守卫（length = Y.Array.length 的 O(1) 投影）
    if (!isSafeNonNegInt(facts.length))          return single(F_1, arrayPath);
    const length = facts.length;
    // ③ op 域规则 + 载荷域守卫（域 message 逐字复用 legacy；批量一次判定、中间态不参与）
    if (payload.op === 'array-insert') {
      if (!isSafeNonNegInt(payload.index) || !Array.isArray(payload.values)) return single(P_1, arrayPath);
      if (payload.index > length)                // 不 clamp（legacy L990 同式）
        return single('array-insert index 越界（不 clamp）', [...arrayPath, payload.index]);
      const issues: ValidateIssue[] = [];
      for (let j = 0; j < payload.values.length; j++) {          // O(k)；空批量 = 恒等 accept
        const sub = validateSubtree(derived.values, plan.node.element, payload.values[j]);
        if (!sub.ok) for (const it of sub.issues)
          issues.push({ message: it.message, path: [...arrayPath, payload.index + j, ...it.path] });
      }
      return issues.length === 0 ? { ok: true } : { ok: false, issues };
    }
    // array-delete：仅域规则，O(1)，不触碰元素值（决策 2/4）
    if (!isSafeNonNegInt(payload.index) || !isSafeNonNegInt(payload.count)) return single(P_2, arrayPath);
    if (payload.index >= length || payload.index + payload.count > length)  // legacy L1000 同式
      return single('array-delete 范围越界（不 clamp、不接受越界 no-op）', [...arrayPath, payload.index]);
    return { ok: true };
  });
}
```

- `isSafeNonNegInt(n)` = `Number.isSafeInteger(n) && n >= 0`；`-0` 归 0（与 legacy slice 语义等价）；
- `wrapElementwise`：catch 一切 → `{ ok:false, issues:[{ message: 'VFSL-E100: 内部错误（意外异常）: …', path: [] }] }`
  （`validateSubtree` 自身从不抛错——E100 面只覆盖闸门/守卫/防御性访问的实现缺陷，与 sibling 同款纪律）；
- 纯度：只读 `derived`/`plan`/`facts`/`payload`；path 一律新数组（`[...plan.prefix, …]`），无输入突变
  （契约 A2 的 plan 前后 JSON 比对锚）。

### 8.3 message 冻结表

| ID | 场景 | message（逐字） | issue path | 来源 |
|---|---|---|---|---|
| D-I | insert `index > length` | `array-insert index 越界（不 clamp）` | `[...arrayPath, index]` | legacy 逐字（L991；契约 C1/C2、负控 NC1.2） |
| D-D | delete `index >= length ∨ index+count > length` | `array-delete 范围越界（不 clamp、不接受越界 no-op）` | `[...arrayPath, index]` | legacy 逐字（L1001；契约 D2/D3、负控 NC1.4） |
| E-* | 新元素非法 | `validateSubtree(element, value)` 原生 message（类型不匹配/枚举/Int/Pattern/封闭对象未知键…） | `[...arrayPath, index+j, ...原生相对 path]` | 与 legacy 全量路径逐字节同源（契约 B2/B3/B5/B7、E1 oracle） |
| G-A | 闸门：`plan.kind !== 'array'` 或 `relPath` 非空 | `逐元素数组校验仅服务 planMutationBoundary 的 array-* 计划（要求 kind=array 且 relPath 为空；实际 kind=${plan.kind}、relPath 长度=${plan.relPath.length}）；其他计划请走 applyMutationAtBoundary` | `[...plan.prefix, ...plan.relPath]` | 本设计新冻结（契约 F3 只断言 ok:false） |
| G-B | 闸门：`plan.node.kind !== 'array'`（union 数组目标） | `逐元素数组校验要求边界值节点为 array（实际 ${plan.node.kind}）；union 数组目标永久走 applyMutationAtBoundary 整体验证（ADR 0033 决策 1）` | `[...plan.prefix, ...plan.relPath]` | 本设计新冻结（契约 F2 只断言 ok:false） |
| F-1 | `facts.length` 非非负安全整数 | `逐元素数组校验的载体域事实非法：length 必须是非负安全整数` | `[...arrayPath]` | 本设计新冻结 |
| P-1 | insert `index` 非非负安全整数或 `values` 非数组 | `逐元素数组校验载荷非法：array-insert 要求 index 为非负安全整数、values 为数组` | `[...arrayPath]` | 本设计新冻结 |
| P-2 | delete `index`/`count` 非非负安全整数 | `逐元素数组校验载荷非法：array-delete 要求 index 与 count 为非负安全整数` | `[...arrayPath]` | 本设计新冻结 |

G-A/G-B/F-1/P-1/P-2 为新词表：**发布即兼容面**（包纪律「稳定 message 是兼容行为」）；实现须逐字落地上表，
后续修改视同破坏性变更。

### 8.4 与 legacy 全量 oracle 的等价域与分歧边界

| 输入域 | legacy（`applyMutationAtBoundary`） | 新接缝 | 处置 |
|---|---|---|---|
| 合法基线 × insert/delete 全参数化 + 随机身（等价集 132 例：6 路径 × 参数化 12 + 随机 60；接受 54 / 拒绝 78） | 判决 V | 判决 V，**逐字节一致**（message+path 全序） | 契约 E1 断言（SA6 见证 132/132 预证） |
| 污染数组 delete（变更区间外非法） | 响亮拒绝（NC2 锚） | **照常成功**（决策 4） | 契约 D4/D5/E2 单列（有意分歧） |
| 污染数组 insert（空批量/合法新值） | 拒绝（整数组重验） | 成功（不读基线） | 决策 4 同族（零触达区间 = no-op）；不进契约，设计明示 |
| 界内 `count=0` | 接受（重建后整体验证；污染基线上拒绝） | 接受（域谓词镜像；污染基线上也接受） | 结论一致的合法基线上逐字节同；污染差异归决策 4 族；不进契约（NC1.5 明示） |
| 单元素子树 issue > 100 / 全批 > 100 / 预算耗尽 / 解释器 E100 | 全数组单 100 上限 + 截断标记（path `[]`）；单预算；E100 path `[]` | 每元素独立上限/预算；截断标记与元素级解释器 issue 统一 rebase 为 `[...arrayPath, index+j]`；仅接缝自身 wrap 的 E100 为 path `[]` | **病态域已知分歧**（D6）；ADR 决策 6 后果同族；fixture 远离该界；不进契约 |
| index 非非负安全整数 / values 非数组 / count 负 | 依赖整数组的重建产物（slice 截断/负位放置），无逐元素对应物 | 响亮拒绝（P-1/P-2） | 域外输入（D5）；doc-runtime E3 保证不达；legacy 轨仍可服务该形态 |
| union 数组目标 / 非 array 计划 / YPlainArray | 正常服务（永久 legacy；plain 在规划层已拒） | fail closed `ok:false` | 契约 F1–F3、负控 NC3 |

### 8.5 状态机与数据流依据

无状态机：接缝是**无状态纯函数**（每调用独立，零模块级可变态；memo/预算均在 `validateSubtree` 调用局部）。
无新运行时数据创建/写入/存储/传输路径：输入（derived、plan、facts、payload）→ 判决（纯 JSON 值）单跳；
不触碰 live Y.Doc、快照、诊断日志、复制协议（ADR 0033：复制协议与诊断捕获窗口零改动）。故本设计不引入
数据流路线表——唯一「数据」是判定结果本身的返回，见 §9。

## 9. 错误、恢复、并发和幂等

- **错误面**：一切失败经判别联合 `ok:false + issues`（包纪律：不抛错）。三条失败族：域规则（D-I/D-D，legacy
  逐字）、元素校验（解释器原生 issue，rebase）、守卫/闸门（新词表）+ E100 兜底（`wrapElementwise`）。无
  `ok:true` 伴随吞错的路径。
- **恢复/重试**：纯函数无副作用，任何 `ok:false` 后调用方可修正载荷重试，无残留状态、无补偿动作；
  「零写入纪律」由纯函数性结构性保证（先判定后提交属调用方管线，本票无提交面）。
- **并发**：零共享可变态（无缓存、无计数器、无单例）；多线程/重复并发调用安全且确定性（同输入恒同输出，
  `validateSubtree` 的 memo 亦为调用局部——`validate.ts` L81–99 注释契约）。
- **幂等**：天然幂等（判定不改变任何输入；契约 A2 锚 plan 不被突变）。

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| （新）未来 doc-runtime `prepareLocalMutation` kind=`array` 分支 fast path | S5 `walk` 整数组提取（L305）→ S6 `applyMutationAtBoundary(walked.snapshot)`（L310）→ S9 边界重投影（L343 `proposedBoundary`） | 本票**不改**；接线票改为：闸门（plan 双条件）→ `applyElementwiseArrayMutation(derived, plan, { length: YArray.length }, payload)` → 省略 S5/S9 重投影 | 本票零改动（非目标）；接缝形状按该消费面最小化（只收 `{length}`、直出 `ValidateResult`） | `mutation-local.ts` L296–347；ADR 0033 决策 3；SA6 §1/§15 |
| `packages/doc-runtime/src/mutation.ts`（组合写 L337/L361，synthetic plan 复跑 legacy） | legacy 轨 | 不变（本票零改动） | 无 | `mutation.ts` L40/L337/L361 |
| 既有 vfsl 公共导出消费方（namespace-runtime / namespace-diagnostic-log / 各测试） | 22 导出 | 23 导出，既有名逐字节不变 | 无（纯加法；NC6/负控超集锚） | NC6；`render-projection-text-control.test.ts` C1；`write-path-number-domain-closure.test.ts` |
| SA6 契约/负控/test-d/fixture（已在工作树） | 21 red / 17 green / TS 红 | 21 green / 17 green / TS 干净 | 无需改测试——实现翻绿即可（绑定块同步仅当评审裁决换名，SA6 §12.1） | SA6 §12/§13 |
| `validate-patch-mutation-boundary.test.ts` 等既有 vfsl 测试 | 绿 | 绿（legacy 轨逐字节不动） | 无 | pre-contract 基线 459 files/5584 绿 |

无未覆盖调用方：新导出是增量，仓库内不存在会因「新名字出现」而行为变化的消费者（导出面断言均为超集式）。

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/vfsl/src/validate-patch.ts` | 新增类型 `ArrayCarrierFacts`、`ElementwiseArrayMutationPayload`，函数 `applyElementwiseArrayMutation`，私有守卫助手（`isSafeNonNegInt`、`wrapElementwise`、单 issue 构造）；文件头「工程纪律」注释块补一句 issue #435 说明 | 接缝实现本体（§7 D2/D3、§8）；与边界接缝家族同文件 |
| `packages/vfsl/src/index.ts` | 既有 `validate-patch` 导出块（L125–137）追加 1 运行时导出 + 2 类型导出；头注释公共接缝清单补 issue #435 一句 | 公共面唯一入口（包 AGENTS；AC5；B-1）；头注释即注释契约 |

合计两个生产文件、纯加法。**无需新增测试或文档文件**：验收契约/负控/类型契约/fixture 已由 SA6 交付在工作树；
母法 ADR 0033 与 `CONTEXT.md` 词汇已描述目标态。

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/vfsl/test/issue-435-elementwise-array-contract.test.ts` | 红契约（21 tests） | 冻结验收契约；实现只许红→绿；改语义即毁掉验收面（SA6 §12.4 纪律） |
| `packages/vfsl/test/issue-435-elementwise-array-control.test.ts` | 负控（17 tests） | 恒绿回归锚（NC1–NC6），实现后必须保持绿 |
| `packages/vfsl/test/issue-435-elementwise-array-fixture.ts` | 一致性夹具（132 例） | ADR 决策 5 立法执行面；SA6 交付件 |
| `packages/vfsl/test/issue-435-elementwise-array.test-d.ts` | 类型契约（B-1…B-5） | 冻结绑定；仅当评审裁决换名/换形时同步 import + 断言（SA6 §12.1 条款） |
| `wiki/raw/task_issue-435_sa6_capability_probe.mts` | 探针证据 | 时点性诊断证据（不在 vitest include 面）；实现后 G1.1/G1.2 预期翻红（§5 矛盾记录、§14 R1） |
| `packages/vfsl/src/validate.ts` | 共享解释器 | 决策 5 立法：禁止以校验器特判引入数组级约束；接缝只消费 `validateSubtree`，零改动 |
| `packages/vfsl/src/derived.ts`、`parser.ts`、`semantic.ts`、`evaluate.ts`、`envelope.ts`、`resolve*.ts` 等 | schema 语言/派生面 | 本票无语言、无 IR、无派生物变化 |
| `packages/vfsl/src/validate-patch.ts` 内既有符号 | legacy 轨 | `planMutationBoundary`/`applyMutationAtBoundary`/`validatePatch`/数组三操作/`BoundaryMutationPayload` 逐字节不变（规划层完全不动——ADR 决策 1；NC1–NC6 锚） |
| `packages/doc-runtime/src/**`（`mutation-local.ts`、`mutation.ts` 等） | fast path 消费方 | 接线属后续票（ADR 决策 3；SA6 §15）；本票动它即越界扩面 |
| `packages/vfsl/test/validate-patch-mutation-boundary.test.ts` 及其余既有测试 | legacy 语义锚 | 实现不改变既有行为，锚必须原样保持绿 |
| `docs/adr/0033-elementwise-yarray-mutation-validation.md`、`CONTEXT.md`、`docs/vfsl/v1-spec.md` | 母法/词汇/规范 | 已接受决策与目标态词汇；本票不改文档（§14 R5 登记措辞-现实差归接线票） |
| `packages/namespace-runtime/**`、`packages/namespace-diagnostic-log/**`、`apps/**`、`domains/**` | 写槽/诊断/应用面 | ADR 0033 明文零改动；无 schema 演进 |

## 12. 验收与验证映射

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1 insert 逐元素 + `[...arrayPath, index+j]` + 逐字节一致 | 契约 B1–B7（HEAD 21 red = 能力缺口）；SA6 见证 132/132 | 契约组 B（既有文件，翻绿） | B1–B7 全绿：6 路径合法插入、非法位置路径、批量两 issue 升序、嵌套 rebase、variants/scalars 联合元素 |
| AC2 delete 仅域规则、不触碰元素值 | 契约 D1–D5 | 契约组 D | D1 合法段通过；D2/D3 message+path 逐字；D4 污染 delete 照常成功；D5 同 length 污染/合法基线判决逐字节相同 |
| AC3 域规则逐字对齐 | 契约 C1–C2、负控 NC1 | 契约组 C + 负控 NC1 持绿 | 不 clamp、append 位接受、批量一次判定；NC1.2/NC1.4 message 冻结 |
| AC4 一致性 fixture（决策 5 立法） | fixture 132 例 + 契约 E1/E2 + 负控 NC5 | 契约组 E | E1 全 132 例逐元素 vs 全量逐字节一致；E2 污染组判据可分（非恒真） |
| AC5 公开面导出 + public-surface guard | 契约 A1/A2、test-d、NC6 | 契约组 A + test-d | `applyElementwiseArrayMutation` 为 `src/index.ts` 自有函数导出；签名四参与返回型逐字命中 B-2…B-5；3 条 `@ts-expect-error` 负面夹具命中；NC6 七既有导出在场 |
| AC6 包测试 + 根 typecheck/test 绿 | SA6 §4/§13 基线与红面记录 | `npx tsc -p packages/vfsl/tsconfig.json`；根 `pnpm typecheck`；根 `pnpm test`（vitest run --typecheck） | 包 tsc exit 0；根 typecheck exit 0（15 tsconfig 全过）；根 test = 462 files / 5622 tests 全绿（5601 基线 + 17 负控 + 21 契约转绿）、Type Errors: no errors |
| 聚焦回归 | SA6 §13 聚焦命令 | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/vfsl/test/issue-435-elementwise-array-contract.test.ts packages/vfsl/test/issue-435-elementwise-array-control.test.ts` | 38/38 绿（21 契约 + 17 负控） |
| 决策 6 性能（软，非门禁） | 探针 G3（×83–97 诊断） | 不加断言；如需证据另票设计基准 | 无（结构性 O(k)：接缝不读 `facts.length` 之外的长度相关量） |

SA1 不编写/运行测试；上表为实现与验证角色的可执行判据（命令与期望值均来自 SA6 契约 §13，非新造）。

## 13. 风险、回滚和残余问题

| # | 风险/残余 | 等级 | 处置 |
|---|---|---|---|
| R1 | SA6 §13「探针 exit 0 不变」与其 G1.1/G1.2（断言导出缺席）自相矛盾——实现后探针预期 = 仅该两项 FAIL、其余组（G2–G5 基于 legacy 轨、O/NC/DRY 基于夹具见证）全 PASS | 低（探针不在门禁面） | 已在 §5 矛盾记录；提请验证角色按「G1 翻红 = 缺口闭合」解读，勿据 exit code 误判回归；不改探针（保留时点证据） |
| R2 | 病态域 issue 上限/预算粒度分歧（§8.4 D6）：>100 条 issue 或预算边界上与 legacy 不逐字节一致 | 低（fixture 与真实载荷远离；ADR 决策 6 后果明文同族） | 设计明示边界；不模仿（保解释器单一来源）；如未来需要可另立契约扩展 |
| R3 | 新 message 词表（G-A/G-B/F-1/P-1/P-2）发布即兼容面；写错即长期冻结 | 中 | §8.3 表为唯一来源，实现逐字复制；评审重点核对 |
| R4 | 域外载荷守卫（D5）与 legacy 产物语义不同——未来接线若绕过 doc-runtime E3 直调接缝，负 index 等将得到响亮拒绝而非 legacy 的重建产物 | 低 | 守卫 message 自述修复方式；接线票必须维持 E3 前置（已在设计中标注调用方职责） |
| R5 | `CONTEXT.md`/ADR 0033 已按目标态措辞（「数组写自 ADR-0033 起触达面收窄…不再整数组提取」），但 doc-runtime 在接线票前仍整数组提取——文档先行于消费方现实 | 低（母法描述终态是常规姿势） | 本票不改文档（DENY）；措辞-现实差与「数组写仍 O(n)」的性能收益未兑现一并归 doc-runtime 接线票收口；不伪装成本收益已达成 |
| R6 | 闸门第三条件（relPath=[]）超出 B-6 字面两条件 | 低（planMutationBoundary 的 array-* 计划恒满足，NC3.1 锚定；只收紧手造 plan） | fail closed 方向（更严不更松），契约 F 组不受影响；已在 §7 D4 论证 |
| 回滚 | 纯加法双文件：revert 即回到 HEAD 状态（契约回红、负控回绿、基线恢复）；无数据/格式/协议迁移 | — | 无需迁移脚本 |
| Follow-up（明确非本票） | doc-runtime fast/legacy 双轨接线 + S9 收窄后 E201 行为 + 其侧 public-surface guard；性能基准票（可选）；delete 前像主动读区间（ADR「不做什么」已登记） | — | 由 Controller 路由后续票 |

任务内无未解决的必要条件；无阻塞。

## 14. 评审修订映射

`wiki/raw/task_issue-435_sa2_review.md` 不存在（iteration 0，设计首版）——无适用 finding，本章留空占位。

## 15. 是否需要设计后 ADR 冲突复查

**需要（`requiresConflictRecheck: true`）**，理由：

1. **公共 API 变化**：`@nomicore/vfsl` 公共面新增 1 运行时导出 + 2 类型导出（运行时导出 22 → 23）——属
   「公共API变化」复查触发类，即便为纯加法；
2. **observable 判定语义变化**（新接缝上）：决策 4 使「污染数组 delete」从响亮拒绝变为照常成功、insert 不再
   触达基线元素——虽为 ADR 0033 既定决策的执行且 legacy 轨保留，但触达面语义变化属复查触发类；
3. **SA8 工件缺席**：iteration 0 无 `_relevant_decisions.md`/`_conflict_report.md`；绑定 B-1…B-6 由 SA6 冻结、
   语义取自 ADR 0033（§6 表）。复查应一并追认绑定名/形（若裁决换名/换形：只动契约测试 `SEAM_EXPORT`/`SeamFn`
   绑定块 + test-d import + 本设计 §8.1 类型块，语义/断言/fixture 不变——SA6 §12.1/§15 同款条款）。

不构成复查理由的部分：未触碰 wire/持久化/状态机（纯函数，无运行时数据路径变化）；未修订任何既有 ADR 决策
（执行 0033）；未引入新的生命周期所有权（无状态纯函数）；规划层与 legacy 轨逐字节不动。

---

## 附：一句话结论

在 `packages/vfsl/src/validate-patch.ts` 就地新增纯函数接缝 `applyElementwiseArrayMutation(derived, plan,
{length}, payload) → ValidateResult`（闸门三条件 fail closed → 事实/载荷守卫 → 逐字域规则 → insert 逐值
`validateSubtree(plan.node.element)` + `[...prefix, index+j]` rebase / delete 仅域规则），经 `src/index.ts`
转出 1 运行时 + 2 类型导出；等价域与 legacy 全量 oracle 逐字节一致（132 例 fixture），分歧点 = 决策 4 有意
收窄 + 病态上限/预算粒度 + 域外载荷守卫（均显式文档化）；纯加法两文件，SA6 既有 21 红契约/17 负控/类型契约
零改动翻绿，doc-runtime 接线与措辞收口归后续票。
