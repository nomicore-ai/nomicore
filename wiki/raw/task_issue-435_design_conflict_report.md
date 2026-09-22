# SA8 设计后冲突复查报告 — issue #435（vfsl 数组逐元素校验 seam + 一致性 fixture）

- 复查对象：`wiki/raw/task_issue-435_design.md`（SA1 设计，iteration 0 首版）
- 裁决：**clear**（`requiresConflictRecheck: true`）
- 复查人：SA8 Conflict Gatekeeper；日期：2026-09-22；基线 HEAD `f6b27da8eadc5cad3bf65c728094767ecb8c601b`
- 冲突点数：**24 项对照，0 hard-conflict / 0 evolution-required / 12 implements-existing-decision / 12 no-conflict**（分布见 §3；其中 5 项为设计创设的新决策面，均无既有决策文本约束、无抵触）

---

## 1. Reviewed subject: design

SA1 设计《issue #435：vfsl 数组逐元素校验 seam + 一致性 fixture（ADR 0033 · vfsl 侧）》。
核心被审面：**新公共接缝 `applyElementwiseArrayMutation(derived, plan, facts, payload) → ValidateResult`**
（含 `ArrayCarrierFacts = { readonly length }`、`ElementwiseArrayMutationPayload` 两类型导出）、
**逐元素判定语义**（insert 逐新值 + `[...arrayPath, index+j]` rebase / delete 仅域规则）、闸门三条件
fail closed、新 message 词表（G-A/G-B/F-1/P-1/P-2）、纯加法两文件 ALLOW LIST 与 DENY LIST。

## 2. Inputs and decision set

| 输入 | 路径 | 状态 |
|---|---|---|
| 任务简报 | `wiki/raw/task_issue-435.md`（Issue #435；Parent PR #434） | 已读；comments REST 快照为空，**无 owner 要求**（Host 明文） |
| 被审设计 | `wiki/raw/task_issue-435_design.md` | 已读全文 |
| 母法 | `docs/adr/0033-elementwise-yarray-mutation-validation.md` | **accepted**（2026-09-22，tracking #433）——本设计的直接依据 |
| 关联 ADR | `docs/adr/0007-…bridge.md`（issue #237 修订节）、`docs/adr/0008-…sequencer.md`（L47 最小 edit）、`docs/adr/0010-…replication.md`（issue #237 修订节）、`docs/adr/0025/0026`（guard/信封，仅载荷词表）、`docs/adr/0023`（Cordis 服务面，不涉 vfsl 导出） | 均已核对适用段；无 superseded 状态干扰（0033 未废弃任何 ADR，属增量修订） |
| 词汇 | `CONTEXT.md` L143-144「重建校验」（含数组位例外句）、L201-202「复制未校验」（含 ADR-0033 触达面句） | 已按目标态措辞（见 §3 第 11 行） |
| 规范 | `docs/vfsl/v1-spec.md` L219/L228（载体矩阵：Y.Array 元素级、plain 整体级） | 载体语义，无校验粒度 norm |
| 模块决策 | `packages/vfsl/AGENTS.md`（公共面只经 `src/index.ts`；同步/纯函数/不抛错；稳定 message/顺序/path 兼容；无 Yjs 关切） | 明确收录的决策面 |
| SA2 review | `task_issue-435_sa2_review.md` | **不存在**（iteration 0，设计 §14 同证）——本报告不受影响（SA2 攻击评审缺席不构成 SA8 冲突项） |
| 源码事实核对 | `validate-patch.ts` L736-819/L923-1029、`validate.ts` L48-60/L600-620/L700-741、`index.ts` L118-137、`derived.ts` L44-46、SA6 四测试件、`vitest.config.ts` L15-20 | 设计证据锚点逐条核实（见 §3 Evidence 列） |

决策集范围声明：`wiki/raw/**` 其余工件（SA6 契约、探针）是证据不是规范；源码仅用于确认事实。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0033 决策 1 | 闸门 = kind=`array` ∧ 边界值节点 kind=`array`；union 数组目标永久 legacy；规划层完全不动 | 设计 D4 闸门前两条件逐条对应；`planMutationBoundary` 在 DENY LIST 零改动。代码事实：array-* 计划恒 `prefix=full, relPath=[], node=descendValues(derived.values, prefix)`（`validate-patch.ts` L796-799、L816-817）——`plan.node` 即 ADR 所指「经 ref 解析后的边界值节点」，第二条件实现忠实；union 数组目标 `node.kind='union'`（SA6 G5/NC3.2 实测）由第二条件排除 | implements-existing-decision | ADR 0033 L21-23；`validate-patch.ts` L796-817；设计 §7 D4 | 无 |
| 2 | ADR 0033 决策 1（同上） | 同上 | 设计增设第三闸门条件 `relPath.length === 0`（R6 自认超出 B-6 字面两条件）。裁决：**fail-closed 方向的防御性收紧**——真实 array-* 计划恒满足（NC3.1 锚定 `relPath=[]`），只拒绝手造 plan，不收窄 ADR 定义的 fast-path 人口，且不静默接受（B-6 纪律） | no-conflict | `validate-patch.ts` L798（relPath=[] 恒真）；负控 NC3.1；设计 §7 D4/§13 R6 | 无 |
| 3 | ADR 0033 决策 2 | insert 逐新值过 element 子 schema（复用 `validateSubtree` 于 element 节点）+ issue 路径 `[...arrayPath, index+j]` 与现状逐字节一致 | 设计 D6/§8.2：逐值 `validateSubtree(derived.values, plan.node.element, values[j])` + `[...prefix, index+j, ...rel]` rebase。数学同构核实：legacy 全量路径中元素 issue 由解释器以 `validateValue(element, v, [i])` 发射、`validateBoundary` 以 `[...plan.prefix, ...issue.path]` rebase（`validate.ts` L610-611、`validate-patch.ts` L1012-1019）——两式恒等；`validateSubtree` 三参签名核实（`validate.ts` L768）。逐值调用正是 ADR 自身的处方 | implements-existing-decision | ADR 0033 L28；`validate.ts` L604-615/L768；`validate-patch.ts` L1012-1019；设计 §7 D6/§8.2 | 无 |
| 4 | ADR 0033 决策 2 | 域规则与现行逐字一致：不 clamp、拒越界 no-op、批量一次判定、空批量 noop | 设计 §8.2/§8.3 两条域 message 逐字复用（`array-insert index 越界（不 clamp）` / `array-delete 范围越界（不 clamp、不接受越界 no-op）`），判定式与 legacy L990/L1000 同式；批量循环一次判定、中间态不参与；空批量 = 恒等 accept（ADR 的 hasContent 守卫属调用方管线，接缝直收 noop 与「空批量经守卫为 noop」语义一致） | implements-existing-decision | ADR 0033 L27；`validate-patch.ts` L990-992/L1000-1002；设计 §8.2-8.3 | 无 |
| 5 | ADR 0033 决策 2 | delete 仅越界检查 O(1)，不触碰元素值 | 设计 D3 delete 支只读 `facts.length`，无元素值输入面（`ArrayCarrierFacts` 结构性排除） | implements-existing-decision | ADR 0033 L29；设计 §7 D3/§8.1 | 无 |
| 6 | ADR 0033 决策 2 | 越界检查读 live 载体 `Y.Array.length`（O(1)） | 设计以 `ArrayCarrierFacts = { readonly length }` 投影代 live 载体，length 由消费方（doc-runtime 接线票）从 `Y.Array.length` 读出传入（§10 矩阵）。分层核实：这是 ADR 管线句与包纪律「vfsl 不引入 Yjs 运行时关切」的正确兼 iterators——vfsl 侧收事实、doc-runtime 侧读 live 载体，两句各得其所 | no-conflict | ADR 0033 L27；`packages/vfsl/AGENTS.md` Boundaries；设计 §7 D3/§8.1/§10 | 无 |
| 7 | ADR 0033 决策 2 | 零写入纪律不变 | 接缝为无状态纯函数（§8.5/§9），只读四输入、path 一律新数组，无任何写面 | implements-existing-decision | ADR 0033 L31；设计 §9 | 无 |
| 8 | ADR 0033 决策 2 | issue 路径/顺序是兼容行为，钉回归测试 | 合法基线等价域由 132 例 fixture + 21 条契约钉死（E1 逐字节比较）；**已知边界**（设计 §8.4/D6/R2）：病态域（全批或单元素 >100 条 issue、预算耗尽、解释器 E100）上，每次调用的 100 条上限/2×10⁸ 预算粒度（`validate.ts` L54-56）随「逐值调用」粒度化，截断标记 rebase 到 `[...arrayPath, index+j]` 而 legacy 在数组根。裁决：该分歧是 ADR 自身处方（逐值复用 `validateSubtree`，单一解释器来源）的固有后果，非对决策文本的违背——ADR 后果句「charge 计数变化…issue 输出不变」的射程是「未触达元素不再计入 budget」（未触达元素在合法基线上本就零 issue，输出确实不变），未对病态批量截断形态立法；设计显式文档化且 fixture 远离该界 | no-conflict（带登记残余） | ADR 0033 L28/L67；`validate.ts` L54-56/L713-719；设计 §7 D6/§8.4/§13 R2 | 无（本票）；若未来需病态域逐字节一致，须另立契约/修订（设计已注明「另立契约扩展」路径） |
| 9 | ADR 0033 决策 3 | S9 安装事实核保留、fast-path 提交省略边界重投影 ⇒ 无 `proposedBoundary` | 设计 D7 返回 `ValidateResult` 直出，test-d 负面夹具钉死非 `{ok:false; result}` 包装形 | implements-existing-decision | ADR 0033 L35-37；设计 §7 D7；test-d L50-59 | 无 |
| 10 | ADR 0033 决策 4 | 触达面 = 载体 + 变更区间；污染数组 delete 照常成功 | 设计 delete 支域规则之外零判定；契约 D4/D5 固化（污染 delete → `ok:true`）。注意：该 observable 变化在**本票**只落在新接缝上（doc-runtime 仍走 legacy 轨，非目标 §1）——分票执行不构成对决策的违背，Issue #435 What to build 明文只要求 vfml 侧接缝 + fixture；接线票已登记（§13 Follow-up） | implements-existing-decision（分票执行中） | ADR 0033 L39-43；任务简报 What to build；设计 §1 非目标/§10/§13 | 接线票兑现 wired 行为（已路由，见 §8 行 3） |
| 11 | ADR 0033 决策 5 | 立法「数组合法 ⟺ 逐元素合法」+ 一致性 fixture 为执法载体；禁止以校验器特判引入数组级约束 | fixture = SA6 交付件（132 例，mulberry32(435) 冻种子，已核实存在）；`validate.ts` 零改动（DENY LIST）。立法前提核实：解释器数组分发仅逐元素（`validate.ts` L604-615，无数组级约束） | implements-existing-decision | ADR 0033 L47-50；`packages/vfsl/test/issue-435-elementwise-array-fixture.ts`；`validate.ts` L604-615；设计 §11 DENY/§12 | 无 |
| 12 | ADR 0033 决策 6 | 性能软验收（O(n)→O(k)，基准为证据，不钉毫秒） | 设计不含阈值断言（§1 非目标、§12 末行），结构性 O(k)（不读 `facts.length` 外的长度相关量）；规模证据留探针 G3 诊断面 | implements-existing-decision | ADR 0033 L52-54；设计 §1/§12 | 无 |
| 13 | ADR 0033 范围句 | 复制协议、诊断捕获、namespace-runtime 写槽零改动 | 纯函数无运行时数据路径（§8.5）；DENY LIST 排除 `namespace-runtime/**`/`namespace-diagnostic-log/**`/`apps/**`/`domains/**` | no-conflict | ADR 0033 L4；设计 §8.5/§11 | 无 |
| 14 | ADR-0007 issue #237 修订节（L71-78） | 边界级校验「批量 values[] / count 一次整体判定，不逐元素」 | 该句为 2026-09-06 phase-1 管线描述；**后被 2026-09-22 ADR 0033 就非 union `T[]` 显式改写**（0033 整篇即对此的修订：逐元素 + 触达面收窄），且 `CONTEXT.md` L144「重建校验」条已以「数组位例外（ADR-0033）」句完成词汇层调和。新 ADR 优先 + 词汇调和 ⇒ 无沉默矛盾；设计不改 ADR-0007（DENY）不构成冲突。残余：ADR-0007 修订节原文未加 0033 回指（ADR 0033 决策 4 只声明修订 ADR-0010 侧）——doc-runtime 接线前该句描述的管线仍是仓库现实，本票无需同变更集修订 | no-conflict（新 ADR 优先） | `docs/adr/0007` L76-77；ADR 0033 全篇/L39；`CONTEXT.md` L144；设计 §11 DENY | 无（本票）；建议接线票的文档收口顺带在 ADR-0007 §#237 补 0033 回指（docs 纪律「explicitly amend」，非阻塞） |
| 15 | ADR-0010 issue #237 修订节（L343-347） | 「触达面外的非法数据不再被普通写发现」后备句 | ADR 0033 决策 4 明文修订其数组含义；现行 ADR-0010 措辞为通用形，与数组收窄兼容；`CONTEXT.md` L202「复制未校验」条已载 ADR-0033 数组句（「不再整数组提取…污染 delete 照常成功」） | no-conflict | ADR 0033 L39；`docs/adr/0010` L343-347；`CONTEXT.md` L201-202 | 无 |
| 16 | `CONTEXT.md`「重建校验」/「复制未校验」 | 数组位例外词汇（目标态） | 词汇与设计语义一致（逐元素/union 整体/触达面=载体+区间）。**措辞-现实差**：CONTEXT 已按目标态措辞而 doc-runtime 接线前仍整数组提取——设计 R5 如实登记、不伪装收益、不改 CONTEXT（DENY）。裁决：CONTEXT 描述的是已接受决策的终态（母法先行是常规姿势），执行缺口归接线票，非决策冲突 | no-conflict（执行缺口，已登记） | `CONTEXT.md` L143-144/L201-202；设计 §6/§13 R5 | 接线票收口（已路由） |
| 17 | `packages/vfsl/AGENTS.md` Boundaries | 公共 API 只经 `src/index.ts` | 设计 D8：唯一入口 `.`（`package.json` exports），既有导出块追加 1 运行时 + 2 类型导出，运行时 22 → 23，纯加法；无新子路径 export | implements-existing-decision | `packages/vfsl/AGENTS.md`；`packages/vfsl/src/index.ts` L125-137；设计 §7 D8 | 无 |
| 18 | `packages/vfsl/AGENTS.md` Boundaries | 同步/确定性/纯函数；畸形输入走判别联合而非抛错 | 接缝同步纯函数；一切失败 `ok:false + issues`（含新守卫与 E100 兜底 `wrapElementwise`，与 sibling `wrapApply` L1022-1029 同款纪律）；`resolveSchemaAtPath` 的 InternalError 例外（ADR 0016）不涉本接缝 | implements-existing-decision | `packages/vfsl/AGENTS.md` L9-10；`validate-patch.ts` L1021-1029；设计 §8.2/§9 | 无 |
| 19 | `packages/vfsl/AGENTS.md` Boundaries | 稳定 error code/issue 顺序/path 报告是兼容行为 | 两条域 message 逐字复用 legacy；元素 issue 顺序 = 插入后位置升序（j 升序循环 + 收集序）；新词表 G-A/G-B/F-1/P-1/P-2 **发布即冻结**（§8.3 表为唯一来源）——新面即刻纳入兼容纪律，方向正确 | no-conflict | `packages/vfsl/AGENTS.md` L14；设计 §8.3 | 实现逐字落地 §8.3（见 §8 行 1） |
| 20 | `packages/vfsl/AGENTS.md` Boundaries | 不在此引入 Yjs 运行时关切 | `ArrayCarrierFacts` 为纯 `{length}` 投影（非 live 载体、无 Y 类型引用）；载荷字段与 `BoundaryMutationPayload` 同名支逐字一致（`validate-patch.ts` L835-839 核实：`array-insert`/`array-delete` 两支字段名/类型完全相同） | no-conflict | `packages/vfsl/AGENTS.md` L12；`validate-patch.ts` L835-839；设计 §8.1 | 无 |
| 21 | 任务简报 AC1–AC6（含 AC5「公开面只经包公共入口导出，public-surface guard 覆盖新导出」） | 验收面 | 设计 §12/§13 全映射；绑定 B-1…B-5 与 test-d 断言逐字核对一致（`SEAM_EXPORT`、四参签名、`ValidateResult` 直出、3 条 `@ts-expect-error` 负面夹具）；既有面无精确枚举断言（NC6 为超集锚，`render-projection-text-control.test.ts` 的 `Object.keys` 断言均针对结果对象非模块面——新增导出不破既有测试） | no-conflict | `wiki/raw/task_issue-435.md`；契约/负控/test-d 四件；设计 §12/§13 | 无 |
| 22 | Host 简报 | 「Issue comments REST snapshot is empty; no owner requirements apply」 | 设计 §4 如实登记无 owner 要求——**无 override 需求也无 override 可用**（本报告未发现任何需要 override 的冲突） | no-conflict | Host 简报；设计 §4；SA6 §2 同证 | 无 |
| 23 | （新决策面）D5 域外载荷/事实守卫 | 无既有决策文本约束 | 负 index/非数组 values/负 count/畸形 length → 响亮拒绝（新 message P-1/P-2/F-1）。裁决依据：ADR 决策 2 的「域规则与现行逐字一致」枚举项（不 clamp/拒越界 no-op/批量一次/空批量）被逐字镜像；被守卫的形态在 legacy 中依赖整数组重建产物（slice 截断/负位放置）——非 ADR 所列域规则，且真实调用域（doc-runtime E3）不达；判别联合失败符合包纪律 | no-conflict（新面，fail-loud 方向） | ADR 0033 L27；设计 §7 D5/§8.4 行 6/§13 R4 | 接线票维持 E3 前置（设计已标注调用方职责） |
| 24 | （证据一致性，非决策面）SA6 §13 绿色判据「探针 exit 0 不变」vs 探针 G1.1/G1.2 断言导出缺席 | SA6 工件内部矛盾（非决策集冲突） | 实现后 G1.1/G1.2 必然翻红（缺口闭合的预期翻转）。设计 §5/§14 R1 的处置是唯一自洽读法：门禁 = 契约/负控/根 typecheck+test（AC6 明文）；探针不在 vitest include 面（`vitest.config.ts` L15-20 核实 `wiki/raw/**` 不在内）、保留为时点证据不修改 | no-conflict | `vitest.config.ts` L15-20；SA6 §13/§14；设计 §5 矛盾记录/§13 R1 | 验证角色按「仅 G1.1/G1.2 FAIL = 缺口闭合」解读（见 §8 行 4） |

**代码事实核查汇总**（设计 §2 证据锚点抽核全数命中）：`planMutationBoundary` 数组支 L796-799（kind/prefix/relPath）+ L816-817（node=descendValues）；`applyMutationAtBoundary` 数组支 L980-1008（两条域 message 与路径逐字）；`validateBoundary` L1012-1019（rebase 式）；`wrapApply` E100 L1021-1029；`validate.ts` ISSUE_LIMIT=100/WORK_LIMIT=2×10⁸ L54-56、数组逐元素分发 L604-615、截断标记/预算/E100 三态 L713-739、`validateSubtree` 三参 L768；`index.ts` 导出块 L125-137；`derived.ts` `{kind:'array'; element}` L44-45。

**精确性备注（低严重度，不改任何裁决）**：设计 §7 D6/§8.4 行 5 称 legacy 侧截断标记与预算/E100 路径「均为 `[]`」——实际 `validateBoundary`（L1017）对 `validateSubtree` 的一切 issue（含截断标记、预算耗尽、解释器 E100）统一 prefix rebase，绝对路径为 `[...plan.prefix]`（= arrayPath）；字面 `[]` 仅 `wrapApply` 自身 E100（L1027）。该偏差不影响分歧存在性结论（标记在数组根 vs 元素位仍分歧）、不触任何已钉契约（fixture 远离病态域），但若未来就此边界立法或修文档，须以此核正为准。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| （无） | — | — | — |

无任何条目需要 override：未发现 hard-conflict；Issue comments 快照为空（无 Owner 评论可作 override 权威）；
ADR 0033 自身即是对 0007/0010 相关句的合法修订权威，设计属执行而非再修订。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| `@nomicore/vfsl` 既有 22 个运行时导出 | 名字/行为逐字节不变（新增只许纯加法，22 → 23） | 设计 D8/NC6；`index.ts` L125-137 | 设计承诺纯加法； ALLOW LIST 仅 `validate-patch.ts` + `index.ts` 两文件 ✅（实现后复查须核对 diff） |
| legacy 边界接缝符号 | `planMutationBoundary`/`applyMutationAtBoundary`/`validatePatch`/数组三操作/`BoundaryMutationPayload` 逐字节 | 设计 §11 DENY；NC1–NC6；`validate-patch-mutation-boundary.test.ts` | DENY LIST 明列；规划层零改动（ADR 0033 决策 1）✅ |
| 两条域 message 及 issue path 形 | `array-insert index 越界（不 clamp）` @ `[...arrayPath, index]`；`array-delete 范围越界（不 clamp、不接受越界 no-op）` @ `[...arrayPath, index]` | `validate-patch.ts` L990-992/L1000-1002；§8.3 D-I/D-D | 设计逐字复用 ✅（实现后逐字核对） |
| 元素 issue 路径/顺序兼容形 | `[...arrayPath, index+j, ...原生相对 path]`、插入后位置升序 | ADR 0033 决策 2；`validate.ts` L610-611 + `validate-patch.ts` L1017 | 设计 rebase 公式数学同构 ✅ |
| 共享解释器 `validate.ts` | 零改动（决策 5 立法：禁以校验器特判引入数组级约束） | ADR 0033 L49；设计 §11 DENY | DENY LIST 明列 ✅ |
| E100 崩溃边界纪律 | 判别联合收编、从不抛错、message 形 `VFSL-E100: 内部错误（意外异常）: …` | `validate-patch.ts` L1021-1029；包 AGENTS L9 | `wrapElementwise` 同款文案/结果形直出 ✅ |
| 新 message 词表（本票创设即冻结） | G-A/G-B/F-1/P-1/P-2 逐字按设计 §8.3 表落地，后续修改视同破坏性变更 | 设计 §8.3；包 AGENTS L14 | 待实现核对（见 §8 行 1） |
| 母法/词汇/规范文本 | `docs/adr/0033`、`CONTEXT.md`、`docs/vfsl/v1-spec.md`、ADR-0007/0010 不改 | 设计 §11 DENY；docs/AGENTS 权威划分 | DENY LIST 明列 ✅ |
| doc-runtime / namespace-runtime / 诊断 / 复制 / wire | 零改动（本票） | ADR 0033 L4；设计 §11 DENY | DENY LIST 明列 ✅ |
| SA6 四测试件 + 探针 | 冻结验收面：实现只许红→绿、负控恒绿、探针保留时点证据 | 设计 §11 DENY；SA6 §12.4 | DENY LIST 明列 ✅ |

## 6. Evolution requirements

无 `evolution-required` 条目。设计零修订任何 ADR/CONTEXT/协议文本，纯执行 ADR 0033（已接受）+
在既有授权面内创设新公共接缝词表。分票执行（doc-runtime 接线归后续票）不产生本变更集的文档修订义务：
CONTEXT/ADR 0033 已按目标态措辞，接线票负责让现实追上（设计 R5 已登记路由）。

## 7. Hard conflicts

无。

## 8. Required actions

| # | 行动 | 责任落点 | 阻塞 |
|---|---|---|---|
| 1 | 实现必须**逐字**落地 §8.3 message 冻结表（G-A/G-B/F-1/P-1/P-2 五条新 message + 两条域 message + rebase 公式）——发布即兼容面，写错即长期冻结 | SA4/SA9 实现 + 实现后复查逐字 diff | 否（clear 的附带义务） |
| 2 | 实现后冲突复查（implementation 复查）须核对：导出纯加法（22→23，既有名字节不变）、DENY LIST 全清单未被触碰（尤其 `validate.ts`/doc-runtime/母法文本）、NC1–NC6 + `validate-patch-mutation-boundary.test.ts` 保持绿、契约 21 翻绿 | 本票实现阶段触发 | 否 |
| 3 | doc-runtime 接线票（后续）：兑现决策 3/4 的 wired 行为（S5 省略/S6 换接缝/S9 省略重投影、E201 行为变化、其侧 public-surface guard）并收口 CONTEXT 措辞-现实差（R5）；建议顺带在 ADR-0007 §#237 补 ADR-0033 回指（docs 纪律，非阻塞） | Controller 路由后续票 | 否（已登记） |
| 4 | 验证角色解读 SA6 探针时：实现后预期态 = **仅 G1.1/G1.2 两项 FAIL**（缺口闭合的预期翻转），勿据 exit code 误判回归（SA6 §13 判据句与其 G1 断言自相矛盾，以设计 §5 矛盾记录的处置为准） | SA7/验证角色 | 否 |
| 5 | 若未来有人需要病态域（>100 条 issue/预算边界）与 legacy 逐字节一致，须另立契约或修订决策——不得在实现里静默聚合上限（破坏解释器单一来源） | 未来票 | 否 |

## 9. Verdict

**clear** —— 24 项对照全部为 no-conflict 或 implements-existing-decision；无 hard-conflict、无
evolution-required、无待补 override。设计对 ADR 0033 决策 1–6 逐条兑现，对 ADR-0007/0010 #237
修订节经由「新 ADR 优先 + CONTEXT 调和」正确处理，对包纪律（公共入口/纯函数/不抛错/兼容面/无 Yjs
关切）全数遵守；新创设的决策面（接缝名形、守卫词表、闸门第三条件）均在既有授权方向上（fail-loud /
fail-closed / 纯加法）且无既有文本抵触。SA2 攻击评审缺席（iteration 0）不构成 SA8 冲突项。

## 10. requiresConflictRecheck

**true**。触发面（与设计 §15 自评一致）：

1. **公共 API 变化**：`@nomicore/vfsl` 运行时导出 22 → 23 + 2 类型导出——尚待实现核对（纯加法承诺、
   §8.1 签名与 test-d 绑定逐字命中）；
2. **失败语义新增**：五条新 message 词表（G-A/G-B/F-1/P-1/P-2）与 fail-closed 闸门/守卫行为——尚待
   实现逐字核对（§8 行 1）；
3. **新接缝上的 observable 判定语义**（决策 4 触达面收窄、逐元素等价域）——尚待实现后以契约 21 +
   fixture 132 + 负控 17 复核；
4. SA8 前置工件缺席（iteration 0 无 `_relevant_decisions.md`/`_conflict_report.md`）——本报告即补位裁决；
   绑定名/形（B-1…B-6）经本报告追认：与 ADR 0033 语义一致，**无需换名/换形**（若后续评审仍裁决更换，
   按 SA6 §12.1 条款只动绑定块 + test-d import + 设计 §8.1 类型块，语义/断言/fixture 不变）。

不构成复查理由：wire/持久化/状态机/生命周期零触碰（纯函数）；无正式 override；规划层与 legacy 轨
逐字节不动。
