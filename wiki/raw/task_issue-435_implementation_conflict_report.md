# SA8 实现后冲突复查报告 — issue #435（vfsl 数组逐元素校验 seam + 一致性 fixture）

- 复查对象：Issue #435 交付实现（工作树 diff：`packages/vfsl/src/validate-patch.ts`、
  `packages/vfsl/src/index.ts`，+130/−3）+ SA3 实现报告与证据日志
- 裁决：**clear**（`requiresConflictRecheck: false`——本报告即设计复查 arm 的实现后闭合）
- 复查人：SA8 Conflict Gatekeeper；日期：2026-09-22；基线 HEAD `f6b27da8eadc5cad3bf65c728094767ecb8c601b`
- 冲突点数：**19 项对照，0 hard-conflict / 0 evolution-required / 11 implements-existing-decision /
  8 no-conflict**（分布见 §3；实现未创设设计裁决范围之外的新决策面）

---

## 1. Reviewed subject: implementation

被审 diff（`git diff HEAD` 实证，仅两个 ALLOW 文件）：

- `packages/vfsl/src/validate-patch.ts`：文件头补 issue #435 一句；import 类型行追加
  `ValidateIssue`；文件尾新增 `ArrayCarrierFacts`、`ElementwiseArrayMutationPayload`、
  `applyElementwiseArrayMutation` 与私有助手 `isSafeNonNegInt`/`singleIssue`/`wrapElementwise`
  （纯加法，既有符号零触碰）；
- `packages/vfsl/src/index.ts`：头注释两处补 issue #435 说明；`validate-patch` 导出块追加
  运行时导出 `applyElementwiseArrayMutation` 与类型导出 `ArrayCarrierFacts`、
  `ElementwiseArrayMutationPayload`（运行时导出 22 → 23，纯加法）。

重点核对面（按 Host 指定）：**公共导出面**（AC5 / B-1）与**逐元素校验行为**（AC1–AC4 /
ADR 0033 决策 1/2/4/5）——对照实际 diff 逐行核验，另抽验 SA3/SA6 证据日志（SA8 不运行测试）。

## 2. Inputs and decision set

| 输入 | 路径 | 状态 |
|---|---|---|
| 任务简报 | `wiki/raw/task_issue-435.md` | 已读；comments REST 快照为空，**无 owner 要求**（Host 明文） |
| 批准设计 | `wiki/raw/task_issue-435_design.md` | 已读全文（§8.1 类型块/§8.2 算法/§8.3 message 冻结表为实现规范） |
| SA2 评审 | `wiki/raw/task_issue-435_sa2_review.md` | `approve`（0 BLOCKER / 0 MAJOR；O-1…O-6 非阻断） |
| 设计后 SA8 报告 | `wiki/raw/task_issue-435_design_conflict_report.md` | `clear` + `requiresConflictRecheck: true`（§8 行 1/2 为本次核对义务） |
| SA6 验收契约 | `wiki/raw/task_issue-435_sa6_contract.md`（B-1…B-6、§12.2/§12.3/§13） | 冻结验收面 |
| SA3 实现报告 | `wiki/raw/task_issue-435_sa3_impl.md` | 已读；声明零偏差 |
| 母法 | `docs/adr/0033-elementwise-yarray-mutation-validation.md` | **accepted**；无 ADR 被 superseded（`grep 状态` 全库零命中废弃态） |
| 关联 ADR | `docs/adr/0007`（L70–82 #237 修订节）、`docs/adr/0010`（L340–350 后备句定稿） | 均核对；经 ADR 0033 优先 + CONTEXT 调和（设计复查已裁决，实现未改变其文本） |
| 词汇/规范 | `CONTEXT.md`「重建校验」「复制未校验」数组位例外句；`docs/vfsl/v1-spec.md` L219 载体矩阵 | 目标态词汇，与实现语义一致 |
| 模块决策 | `packages/vfsl/AGENTS.md`（公共入口/纯函数不抛错/兼容行为/无 Yjs 关切） | 明确收录的决策面 |
| 实际 diff + 证据 | `git diff HEAD`；`artifacts/sa3-issue435-*.log`、`artifacts/sa6-issue435-*.log` | 逐项核对（§3 Evidence 列） |

决策集范围声明：`wiki/raw/**` 工件是证据不是规范（docs/AGENTS.md 明文）；源码用于确认事实。
SA4/SA9 复查工件不存在（iteration 0 单趟流），以实际 diff + 既有测试证据替代——本次复查
由设计 `requiresConflictRecheck: true` 触发，属技能规定的合法运行条件（「实际 diff 触碰
公共 API/失败语义冻结面」）。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（实际 diff） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0033 决策 1 | 闸门 = `plan.kind='array'` ∧ 边界值节点 kind=`array`；union 数组目标永久 legacy；规划层完全不动 | 实现闸门逐字落地：`plan.kind !== 'array' \|\| plan.relPath.length !== 0` → G-A；`plan.node.kind !== 'array'` → G-B（union 数组目标由第二条件排除，fail closed 不静默接受）；`planMutationBoundary`/规划层零改动（diff 不含其行） | implements-existing-decision | ADR 0033 L21-23；diff（新增段 ①）；探针 post G5.2/G5.2b PASS；契约 F1–F3 绿 | 无 |
| 2 | ADR 0033 决策 1（防御收紧） | （第三条件 relPath=[] 超出 B-6 字面——设计 D4/R6、SA2 O-6） | `plan.relPath.length !== 0` → G-A；真实 array-* 计划恒满足（NC3.1 锚定），只拒手造 plan | no-conflict（设计复查行 2 已裁决） | diff 新增段 ①；探针 post G5.1×6 `relPath=[]` PASS | 无（若未来并入 B-6 文字，归接线票顺带，非阻塞） |
| 3 | ADR 0033 决策 2 | insert 逐新值过 element 子 schema（复用 `validateSubtree`）+ issue 路径 `[...arrayPath, index+j]` 与现状逐字节一致 | 每新值独立 `validateSubtree(derived.values, node.element, values[j])`，rebase `[...arrayPath, index+j, ...原生相对 path]`——与 legacy `validateValue(element, v, [i])` + `validateBoundary` prefix rebase（L1016-1020）数学同构；契约 E1 132/132 逐字节一致（root test 全绿含此） | implements-existing-decision | ADR 0033 L28；diff 新增段 insert 循环；`validate.ts` L768 三参签名核实；探针 post O1.2 132/132 | 无 |
| 4 | ADR 0033 决策 2 | 域规则与现行逐字一致：不 clamp、拒越界 no-op、批量一次判定、空批量 noop | `index > length` → `array-insert index 越界（不 clamp）` @ `[...arrayPath, index]`；`index >= length \|\| index+count > length` → `array-delete 范围越界（不 clamp、不接受越界 no-op）` @ `[...arrayPath, index]`——两条 message 与 legacy L994/L1004 **逐字节相同**（源码对照）；判定式同式；单循环一次收集；空批量恒等 `{ok:true}` | implements-existing-decision | ADR 0033 L27；`validate-patch.ts` L993-994/L1003-1004 vs diff；守卫探针 D-I/D-D/空批量 PASS；契约 C1/C2/D2/D3 绿 | 无 |
| 5 | ADR 0033 决策 2 | delete 仅越界检查 O(1)，不触碰元素值 | delete 支域检查后直接 `{ok:true}`；`ArrayCarrierFacts = {readonly length}` 结构性排除元素值；实现不读 `facts.length` 外任何长度相关量 | implements-existing-decision | ADR 0033 L29；diff delete 支；契约 D1–D5 绿（D4 污染 delete 照常成功） | 无 |
| 6 | ADR 0033 决策 2 | 越界检查读 live 载体 `Y.Array.length`（O(1)） | 接缝收 `facts.length` 投影，live 读取属调用方（doc-runtime 接线票）——与包纪律「无 Yjs 运行时关切」正确分层（设计复查行 6 已裁决） | no-conflict | ADR 0033 L27；`packages/vfsl/AGENTS.md` Boundaries；diff 类型块 | 接线票从 `Y.Array.length` 投影（已登记调用方职责） |
| 7 | ADR 0033 决策 2 | 零写入纪律不变 | 无状态纯函数：只读四输入、path 一律新数组（`singleIssue` 内 `[...path]`）、零模块级可变态；守卫探针「纯度：四输入零突变」+「确定性」PASS | implements-existing-decision | ADR 0033 L31；diff；契约 A2（plan JSON 前后比对）绿；`artifacts/sa3-issue435-guard-probe.log` 21/21 | 无 |
| 8 | ADR 0033 决策 3 | fast-path 产物不需要 `proposedBoundary` | 返回 `ValidateResult` 直出（`{ok:true} \| {ok:false; issues}`），无 result 包装；test-d 3 条 `@ts-expect-error` 负面夹具命中（root test `Type Errors: no errors` 证签名未放宽） | implements-existing-decision | ADR 0033 L35-37；diff 返回形；`issue-435-elementwise-array.test-d.ts` L51-55；root test log | 无 |
| 9 | ADR 0033 决策 4 | 触达面 = 载体 + 变更区间；污染数组 delete 照常成功 | delete 支域规则之外零判定；契约 D4/D5 + E2 固化并绿；探针 post O3.1 污染组 6/6 oracle 拒绝/逐元素成功逐字节可分。**wired 行为（doc-runtime E201 面）归接线票**——分票执行不构成违背（Issue What to build 明文 vfsl 侧；设计非目标 §1；设计复查行 10 已裁决） | implements-existing-decision（分票执行中） | ADR 0033 L39-43；diff delete 支；探针 post O3.1；SA3 §Deferred verification | 接线票兑现（已路由，见 §8 行 1） |
| 10 | ADR 0033 决策 5 | 立法「数组合法 ⟺ 逐元素合法」+ 一致性 fixture 执法；禁止校验器特判引入数组级约束 | `validate.ts` 零改动（git diff 不含该文件）；fixture 132 例转绿（E1）；NC4 立法前提锚保持绿——若有人后续引入数组级约束，fixture 红灯 | implements-existing-decision | ADR 0033 L47-50；git diff 文件清单；root test 462/5622 全绿；探针 post O1/O2/NC1 | 无 |
| 11 | ADR 0033 决策 6 | 性能软验收（O(k)，基准为证据，不钉毫秒） | 无阈值断言；结构性 O(k)（不随 `facts.length` 增长）；规模证据留探针 G3 诊断面 | implements-existing-decision | ADR 0033 L52-54；diff（无基准代码）；探针 post G3.1 | 无（基准票可选，另票） |
| 12 | ADR 0033 范围句 | 复制协议、诊断捕获、namespace-runtime 写槽零改动 | `git status --porcelain`：生产面仅两 ALLOW 文件被修改；`packages/namespace-runtime/**`、`packages/namespace-diagnostic-log/**`、`apps/**`、`domains/**` 零触碰 | no-conflict | ADR 0033 L4；git status 实证 | 无 |
| 13 | ADR-0007 #237 修订节（L76-77） | 「批量 values[]/count 一次整体判定，不逐元素」（phase-1 管线描述） | 实现不改 ADR-0007 文本；数组含义已被更晚接受的 ADR 0033 显式改写，CONTEXT.md L144「数组位例外（ADR-0033）」句完成词汇层调和——新 ADR 优先，无沉默矛盾（设计复查行 14 已裁决，实现未引入新事实） | no-conflict（新 ADR 优先） | `docs/adr/0007` L76-77；ADR 0033 全篇；CONTEXT.md L144；git diff（docs 零改动） | 无（本票）；接线票顺带补 0033 回指（docs 纪律，非阻塞） |
| 14 | ADR-0010 #237 修订节（L343-347） | 「触达面外的非法数据不再被普通写发现」后备句 | ADR 0033 决策 4 明文修订其数组含义；CONTEXT.md L202 已载 ADR-0033 数组句；实现与两者皆一致（污染 delete 成功仅在新接缝；legacy 轨 NC2 锚保持） | no-conflict | ADR 0033 L39；`docs/adr/0010` L343-347；CONTEXT.md L201-202；契约 NC2 绿 | 无 |
| 15 | `CONTEXT.md`「重建校验」/「复制未校验」 | 数组位例外目标态词汇 | vfsl 侧接缝现已存在；doc-runtime 接线前仍整数组 walk——**措辞-现实差**（设计 R5 登记、路由接线票）。裁决不变：CONTEXT 描述已接受决策终态，母法先行是常规姿势；本实现未使其陈述的合同变化（docs/AGENTS.md「code behavior changes ⇒ update normative docs」——本票改变的正是词汇已描述的目标态本身，无规范性文档合同被违背） | no-conflict（执行缺口，已登记） | CONTEXT.md L143-144/L201-202；git diff（CONTEXT 零改动）；SA3 §Deferred | 接线票收口（已路由） |
| 16 | `packages/vfsl/AGENTS.md`「公共 API 只经 `src/index.ts`」 | 公共面唯一入口 | 新导出仅经 `src/index.ts` 导出块追加；`package.json` exports 仍只有 `.`（未触碰）；既有 22 运行时导出名/顺序逐字节不变（diff 纯加行）；探针 post `exports(23)` 名单 = 原 22 + 新 1 | implements-existing-decision | `packages/vfsl/AGENTS.md`；diff of `index.ts`；`artifacts/sa3-issue435-probe-post.log`（运行时反射 23 键）；契约 A1/NC6 绿 | 无 |
| 17 | `packages/vfsl/AGENTS.md`「同步/确定性/纯函数；畸形输入走判别联合而非抛错」 | 判别联合纪律 | 一切失败 `ok:false + issues`（含守卫 F-1/P-1/P-2 与 E100 兜底 `wrapElementwise`，文案/结果形与 sibling `wrapApply` L1025-1032 同款）；守卫探针「E100 收编手造 plan（path=[]、不抛错）」PASS | implements-existing-decision | `packages/vfsl/AGENTS.md` L9-10；diff `wrapElementwise`；守卫探针 21/21 | 无 |
| 18 | `packages/vfsl/AGENTS.md`「稳定 error code/issue 顺序/path 报告是兼容行为」 | 兼容面 | 两条域 message 逐字复用 legacy；元素 issue 顺序 = 插入后位置升序（j 升序循环）；新词表 G-A/G-B/F-1/P-1/P-2 **逐字节**落地设计 §8.3 冻结表（8 条 message 机械比对全 HIT，见 §5 表）；发布即冻结成立 | implements-existing-decision | `packages/vfsl/AGENTS.md` L14；机械字节比对（本报告方法）；契约 C/D 组 + B3/B4 绿 | 无 |
| 19 | 任务简报 AC1–AC6 + SA6 契约 B-1…B-6 | 验收面 | 聚焦 38/38（21 契约 + 17 负控）；包 tsc exit 0；根 `pnpm typecheck` exit 0；根 `pnpm test` 462 files/5622 tests 全绿 `Type Errors: no errors`；探针 post `exports(23)`、仅 G1.1/G1.2 FAIL（导出缺席断言的预期翻转 = 缺口闭合，其余 51 项 PASS）——与设计 §5 矛盾记录/SA8 设计报告 §8 行 4 的既定解读一致 | implements-existing-decision | `artifacts/sa3-issue435-{final-focused,package-tsc,root-typecheck,root-test,probe-post}.log`；SA6 §13 期望值 | 无（SA4/SA7 独立验收另行，非 SA8 面） |

**新决策面核查**：实现未创设设计裁决（§7 D1–D8 / §8.1–8.3）之外的新面——守卫/闸门/E100
词表逐字照设计冻结表落地；算法结构与 §8.2 伪代码逐行同构（含守卫次序：闸门 → F-1 →
op 内 P-1/P-2 → 域规则 → 元素循环）；`import type` 行追加 `ValidateIssue` 是类型导入的
必要伴随（ALLOW 清单「私有守卫助手」的自然依赖），不触任何既有符号。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| （无） | — | — | — |

无条目需要 override：未发现 hard-conflict；comments 快照为空（无 Owner 评论可作权威）；
ADR 0033 自身即是对 0007/0010 相关句的合法修订权威，实现属执行。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（实际 diff 逐项核对） |
|---|---|---|---|
| 既有 22 个运行时导出 | 名字/行为逐字节不变，新增纯加法 22 → 23 | 设计 D8/NC6；SA6 G1 名单 | ✅ diff 纯加行；探针 post `exports(23)` = 原 22 名单 + `applyElementwiseArrayMutation`，无一缺失/改名 |
| legacy 边界接缝符号 | `planMutationBoundary`/`applyMutationAtBoundary`/`validateBoundary`/`wrapApply`/`wrapPlan`/数组三操作/`validatePatch`/`BoundaryMutationPayload` 逐字节 | 设计 §11 DENY；ADR 0033 决策 1 | ✅ diff 不含这些符号的任何删改行（仅头注释、import type 行、文件尾追加）；`validate-patch-mutation-boundary.test.ts` 保持绿（root test 462/462 files） |
| 两条域 message 及 path 形 | `array-insert index 越界（不 clamp）` / `array-delete 范围越界（不 clamp、不接受越界 no-op）` @ `[...arrayPath, index]` | L993-994/L1003-1004；§8.3 D-I/D-D | ✅ 逐字节相同（源码对照 + 机械比对 HIT + 守卫探针 PASS） |
| 元素 issue 路径/顺序 | `[...arrayPath, index+j, ...原生相对 path]`、插入后位置升序 | ADR 0033 决策 2；契约 B2–B4 | ✅ rebase 公式同构；契约 E1 132/132 逐字节一致 |
| 新 message 词表（发布即冻结） | G-A/G-B/F-1/P-1/P-2 + E100 逐字按设计 §8.3 | 设计 §8.3；包 AGENTS L14 | ✅ 8 条 message 机械字节比对设计 ↔ 实现全 HIT（G-B 经 `node.kind` 局部量插值同一值） |
| 共享解释器 `validate.ts` | 零改动（决策 5 立法） | 设计 §11 DENY | ✅ git diff 不含该文件 |
| E100 崩溃边界纪律 | 判别联合收编、从不抛错、message 形 `VFSL-E100: 内部错误（意外异常）: …`、path `[]` | L1025-1032；包 AGENTS L9 | ✅ `wrapElementwise` 同款文案/直出结果形；守卫探针「E100 收编手造 plan」PASS |
| 母法/词汇/规范文本 | `docs/adr/**`（含 0033/0007/0010）、`CONTEXT.md`、`docs/vfsl/v1-spec.md` 不改 | 设计 §11 DENY | ✅ git status：docs/CONTEXT 零改动 |
| doc-runtime / namespace-runtime / 诊断 / 复制 / wire | 零改动（本票） | ADR 0033 L4；设计 §11 DENY | ✅ git status：仅两 ALLOW 文件被修改 |
| SA6 四测试件 + 探针 | 冻结验收面：只许红→绿、负控恒绿、探针保留时点证据 | 设计 §11 DENY；SA6 §12.4 | ✅ mtime 11:49–11:51 早于实现（12:30/12:39）；零 skip/only/todo（grep 实证）；探针未修改，post 态恰为既定解读（仅 G1.1/G1.2 FAIL） |

## 6. Evolution requirements

无 `evolution-required` 条目。实现零修订 ADR/CONTEXT/协议文本；纯执行已接受的 ADR 0033。
分票执行（doc-runtime 接线归后续票）不产生本变更集的文档修订义务——CONTEXT/ADR 0033 已按
目标态措辞，接线票负责让消费方现实追上（设计 R5、SA3 §Deferred 均已登记路由）。

## 7. Hard conflicts

无。

## 8. Required actions

| # | 行动 | 责任落点 | 阻塞 |
|---|---|---|---|
| 1 | doc-runtime 接线票（后续）：S5 省略整数组 walk / S6 换接缝 / S9 省略边界重投影、E201 行为变化、其侧 public-surface guard、CONTEXT 措辞-现实差收口；建议顺带 ADR-0007 §#237 补 ADR-0033 回指、闸门第三条件并入 B-6 文字（O-6） | Controller 路由后续票 | 否（已登记；新票自带冲突门禁） |
| 2 | 接线票调用方义务：`facts.length` 必须从 live `Y.Array.length` O(1) 投影传入、维持 E3 前置（严格非负整数 index、严格正整数 count）——负 index/非数组 values 等域外形态在本接缝是响亮拒绝（F-1/P-1/P-2），不是 legacy 的重建产物 | 接线票实现 | 否 |
| 3 | 若未来需要病态域（单元素 >100 issue / 预算边界）与 legacy 逐字节对齐，须另立契约或修订决策——不得在接缝内静默聚合上限（破坏解释器单一来源；设计 D6/R2、SA8 设计报告 §8 行 5 既定） | 未来票 | 否 |
| 4 | 新 message 词表（G-A/G-B/F-1/P-1/P-2）自本次交付起为兼容面：任何后续措辞变更视同破坏性变更，须同变更集走兼容审查 | 后续维护 | 否（登记） |
| 5 | 验证角色（SA4/SA7）解读探针：预期态 = 仅 G1.1/G1.2 FAIL（缺口闭合翻转），勿据 exit code 误判回归 | SA4/SA7 | 否 |

## 9. Verdict

**clear** —— 19 项对照全部为 no-conflict 或 implements-existing-decision；0 hard-conflict、
0 evolution-required、无待补 override。实现把 ADR 0033 决策 1/2/3/4/5/6 的 vfsl 侧义务
逐条落地：闸门双条件 fail closed（union 数组目标永久 legacy、规划层逐字节不动）、域规则
与 legacy 逐字同式同文案、insert 逐新值过 element 子 schema 且 issue 路径/顺序与全量路径
逐字节一致（132 例 fixture + 21 契约 + 17 负控 + 根 462 files/5622 tests 全绿佐证）、
delete 仅域规则不触碰元素值（污染 delete 照常成功——决策 4）、解释器零改动（决策 5 立法
面完好）、公共面纯加法 22 → 23 且只经 `src/index.ts`。设计复查 arm 的四项核对义务
（导出纯加法、五条新 message 逐字、observable 语义、绑定追认）全部核验通过。SA4/SA9
复查工件缺席（iteration 0 单趟流）不构成 SA8 冲突项——实际 diff 与证据链足以支撑本裁决。

## 10. requiresConflictRecheck

**false**。设计报告 arm 的四项触发面已在本实现复查中逐项闭合：

1. 公共 API 变化（22 → 23）：diff + 运行时反射双证纯加法，既有名字节不变（§5 表 1）；
2. 失败语义新增（五条 message + E100）：机械字节比对全 HIT（§5 表「新 message 词表」）；
3. 新接缝 observable 判定语义（决策 4 / 等价域）：契约 21 + fixture 132 + 负控 17 + 根 test
   全绿 + 探针 post 态恰为既定解读（§3 行 19）；
4. 绑定 B-1…B-6 追认：设计报告已完成，实现与绑定逐字命中（契约 A1/A2、test-d、探针 exports）。

剩余事项（doc-runtime 接线、ADR-0007 回指、病态域契约化）均为**已登记的后续独立票**，
非本变更集尚待核对的实现面——新票自带其冲突门禁。本变更集内 wire/持久化/状态机/生命周期
零触碰（纯函数）、无正式 override、规划层与 legacy 轨逐字节不动。
