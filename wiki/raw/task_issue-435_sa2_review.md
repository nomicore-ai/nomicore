# SA2 设计攻击评审 — issue #435：vfsl 数组逐元素校验 seam + 一致性 fixture（ADR 0033 · vfsl 侧）

- 评审对象：`wiki/raw/task_issue-435_design.md`（SA1 设计，iteration 0 首版）
- 评审角色：SA2（独立设计攻击；不为既有方案背书，不修改设计/代码/测试）
- 评审日期基线：HEAD `f6b27da8eadc5cad3bf65c728094767ecb8c601b`（与 SA6 契约一致，`git log` 核对）

## 1. Reviewed inputs

| 输入 | 状态 | 说明 |
|---|---|---|
| `wiki/raw/task_issue-435.md`（任务简报） | 在场 | Issue #435 正文 + AC1–AC6；Comments 节空（REST 快照空，Host 明示无 owner 要求） |
| `wiki/raw/task_issue-435_design.md`（SA1 设计） | 在场 | 402 行，§1–§15 + 附录结论 |
| `wiki/raw/task_issue-435_sa6_contract.md`（SA6 验收契约，approve） | 在场 | 绑定 B-1…B-6、21 红契约 / 17 负控 / test-d / 132 例 fixture、探针 |
| `packages/vfsl/test/issue-435-elementwise-array-{contract,control}.test.ts`、`-fixture.ts`、`.test-d.ts` | 在场（SA6 交付件，工作树未跟踪） | 逐行核对断言与设计 §8 规范的对应（见 §12） |
| `wiki/raw/task_issue-435_sa6_capability_probe.mts` + `artifacts/sa6-issue435-*.log` | 在场 | 抽查 post-test（462 files / 21 failed / 5601 passed）、contract-red（21 failed）、control-green（17 passed）、post-typecheck（7 条 TS 报错）与 SA6 §4/§13 数值一致 |
| `task_issue-435_relevant_decisions.md` / `_conflict_report.md` / 既有 `_sa2_review.md` | **缺席**（iteration 0） | SA6 §1/§15 与设计 §6/§15 同证；替代约束面 = ADR 0033 + CONTEXT.md + `packages/vfsl/AGENTS.md` + 简报 AC，均已在场并被逐一核对。缺席不构成无法判断安全性的缺口（母法 ADR 0033 已合入 HEAD 且决策 1–6 完备），故不据此 reject |
| 源码锚点核对 | 完成 | `validate-patch.ts` L736–819（规划）、L923–1008（legacy 数组支，域 message/路径逐字）、L478–515（descendValues 归一化）、L35（validateSubtree import）；`validate.ts` L54（ISSUE_LIMIT=100）、L556–558（validateValue 顶层 resolveValues——element 为 ref 时逐元素调用仍正确）、L604–615（数组逐元素分发）、L768–770（validateSubtree=interpret 直通）、L80–99（Ctx 调用局部）；`src/index.ts` L125–137（validate-patch 导出块）、`package.json` exports 仅 `.`；`doc-runtime/mutation-local.ts` L296–347（kind=array 分支 S5 walk → S6 apply → S9 proposedBoundary）、`mutation.ts` L40 import + L337/L361 组合写；`vitest.config.ts` include/typecheck.include；CONTEXT.md L144/L202（数组位例外词汇已按目标态措辞）；`docs/vfsl/v1-spec.md` 不枚举包公共导出面（grep 零命中） |

## 2. Verdict

**approve**。无 BLOCKER、无 MAJOR。设计的接缝形状、闸门、域规则冻结、rebase 公式、守卫词表、文件范围与验收映射均可安全实施，且与已接受的 SA6 契约、ADR 0033 决策 1–6、`packages/vfsl/AGENTS.md` 纪律一致。5 条非阻断观察见 §14。`pass` 不替代 SA4/SA7 对实现与活链路的后续验证。

关键攻击结论（详见下文各表）：

1. **等价域核心攻击通过**：设计的「逐值 `validateSubtree(plan.node.element)` + `[...prefix, index+j]` rebase」与 legacy「整数组重建 + `validateSubtree(plan.node)`」在同一解释器上数学同构——`validateValue` 顶层 `resolveValues`（validate.ts L558）保证 element 为 ref 节点时两条路径同样正确解析，不存在「ref element 静默全过」的失守面；探针 REF 见证 132/132 逐字节命中提供经验证据，且见证所走的合成 `kind:'target'` 计划 + `op:'set'` 路由经源码核对与直接调 `validateSubtree` 语义恒等（set 支 relPath=[] → `validateBoundary` → 同一 `validateSubtree(element, value)` + 同一 rebase 公式）。
2. **闸门攻击通过**：双条件（`plan.kind='array'` ∧ `plan.node.kind='array'`）+ relPath=[] 结构前提只收紧手造 plan（`planMutationBoundary` 的 array-* 计划恒 relPath=[]，L796–799 核对；NC3.1 锚定），fail-closed 方向，契约 F1–F3 不受影响。
3. **并发/纯度攻击通过**：无状态纯函数；Ctx/memo 全部调用局部（validate.ts L80–99 注释契约核对）；契约 A2 的 plan 前后 JSON 比对锚与设计的「path 一律新数组」规范闭合。
4. **范围攻击通过**：ALLOW 两文件纯加法、无测试/文档新文件（SA6 交付件已在工作树）、DENY 与正文零冲突、doc-runtime 接线确属后续票（简报 What to build + ADR 决策 3 + SA6 §15 三方一致，非静默扩面或缩面）。
5. 设计主动暴露并妥善处置了 SA6 契约 §13 的一处自相矛盾（探针「exit 0 不变」vs G1.1/G1.2 断言导出缺席）与病态域分歧（issue 上限/预算粒度），未见伪修订或附录承认正文不改的迹象。

## 3. 需求覆盖

| Requirement（简报 What to build / AC） | Design section | Assessment |
|---|---|---|
| array-insert 逐新值过 element 子 schema；非法值任一位置拒绝；issue 路径 `[...arrayPath, index+j]`；与全量路径逐字节兼容 | §7 D3/D6、§8.2 算法、§8.3 表 E-*、§12 AC1 行 | 覆盖。rebase 公式与 legacy `validateValue(element, v, [i])` 发射路径同构（源码核对）；契约 B2/B3/B5/B7 逐条与规范对上 |
| array-delete 仅域规则（下标/范围越界、越界 no-op 拒绝），不触碰元素值 | §7 D3 delete 支、§8.2、§8.3 D-D、§12 AC2 行 | 覆盖。`ArrayCarrierFacts` 结构性排除元素值（B-3）；D4/D5 契约锚「不消费元素值」 |
| 域规则逐字对齐：不 clamp、批量一次判定、中间态不参与 | §8.2（域检查先于元素循环）、§8.3 D-I/D-D 逐字复用 legacy L991/L1001、§12 AC3 行 | 覆盖。两条域 message 与 `validate-patch.ts` L991/L1001 源码逐字核对一致；批量一次判定 = 单循环收集全量 issues 后一次返回 |
| 一致性 fixture：随机/参数化下逐元素 vs 全量逐字节一致（ADR 决策 5 兜底） | §1 目标 4、§6 决策 5 行、§12 AC4 行 | 覆盖。fixture 为 SA6 交付件（132 例），本票使其转绿；fixture 污染组不进等价集的处理与决策 4 一致 |
| 公开面只经包公共入口导出 + public-surface guard 覆盖新导出 | §7 D8、§12 AC5 行 | 覆盖。`src/index.ts` 唯一入口（package.json exports 仅 `.` 核对）；契约 A1（自有导出键 + typeof function）+ test-d 签名断言即新导出的 guard |
| 包测试 + 根 `pnpm typecheck`/`pnpm test` 绿 | §12 AC6 行 | 覆盖。期望值与 SA6 §4/§13 记录及 artifacts 日志抽查一致（5601+21=5622；459→462 files） |
| 目标未静默扩大 | §1 非目标（doc-runtime 接线、union 数组、plain 数组、数组级约束、性能门禁均排除） | 与简报/ADR「不做什么」逐条对齐；无越界 |

## 4. Owner评论覆盖

| Comment ID | Updated at | Design section | Assessment |
|---|---|---|---|
| （无） | — | §4（设计明文记录 Host 简报「comments REST snapshot is empty」） | 与简报 `## Comments` 空节一致；无遗漏要求。设计未虚构 owner 追加面 |

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| G1 公共面 22 运行时导出零逐元素接缝 | §7 D8：+1 运行时 +2 类型导出（22→23） | 22 计数与 SA6 §5.1 名单核对一致；纯加法 |
| G2 legacy 接缝必须消费整数组提取值 | §7 D3：第 3 参只收 `{readonly length}` | `applyMutationAtBoundary` L985–987 `Array.isArray(target.value)` 核对一致 |
| G3 成本与 n 耦合（软证据） | 结构性 O(k)；不加基准断言 | 与 ADR 决策 6「软验收」及 SA6 §15「性能断言」处置一致 |
| G4 语义快照（message/路径/批量序逐字节） | §8.3 冻结表 + E-* rebase | 与 L990–1002 及负控 NC1 断言逐字核对一致 |
| G5/E2 union 数组目标判别在 `plan.node.kind`（非 `plan.kind`） | §7 D4 双条件闸门 | 源码核对：union 数组目标 plan.kind='array'、node.kind='union'（规划层 array 候选前置只查结构树）；F2 红灯钉死 |
| ADR 0033 决策 1（闸门 + 永久双轨 + 规划层不动） | §6 表行 1、§7 D4、DENY（planMutationBoundary 逐字节不变） | 落实 |
| ADR 0033 决策 2（insert 逐值 + delete 仅域规则 + 域规则逐字 + 零写入） | §7 D3、§8 | 落实；纯函数结构性保证零写入 |
| ADR 0033 决策 3（S9 收窄 ⇒ 无 proposedBoundary） | §7 D7 返回 `ValidateResult` 直出 | 落实；test-d 第 3 条负面夹具钉死非包装形 |
| ADR 0033 决策 4（触达面收窄，污染 delete 照常成功） | §7 D3 delete 支、§8.4 分歧表 | 落实；D4/D5/E2 契约固化 |
| ADR 0033 决策 5（立法 + fixture） | §6 表行 5、§12 AC4 | 落实；解释器零改动（DENY `validate.ts`） |
| ADR 0033 决策 6（性能软验收） | §1 非目标、§13 | 落实 |
| `packages/vfsl/AGENTS.md`（只经 index.ts、纯函数不抛错、稳定 message、无 Yjs 关切） | §7 D2/D3/D8、§9 | 落实；facts 只收长度投影而非 live 载体，Yjs 关切零引入 |
| SA8 工件缺席（iteration 0） | §6 替代约束面 + §15 复查申请 | 处置正当：约束语义全部可从已合入 ADR 0033 + SA6 冻结绑定恢复；绑定换名/换形的同步面已预登记（契约 §12.1 条款） |
| **SA6 §13 内部矛盾**（「探针 exit 0 不变」vs G1.1/G1.2 断言导出缺席） | §5 矛盾记录 + §13 R1 | 设计处置正确：门禁 = 契约/负控/typecheck/根命令（AC6），探针不在 vitest include 面（`vitest.config.ts` 核对）；实现后探针预期态 = 仅 G1.1/G1.2 FAIL。已在 §14 O-4 补充验证角色解读建议 |

## 6. 设计内部一致性

| 检查点 | 结论 |
|---|---|
| 正文 ↔ 伪代码 ↔ 接口契约（§8.1 类型 / §8.2 算法 / §8.3 冻结表） | 一致。伪代码四参/返回形/守卫次序/消息文案与 §8.1、§8.3 逐项对上；`isSafeNonNegInt`、`wrapElementwise` 在 `validate-patch.ts` 无同名冲突（grep 核对），`validateSubtree` 已在 L35 import |
| 死引用 / 旧 API | 未发现。所有引用的导出名（`planMutationBoundary`、`applyMutationAtBoundary`、`validateSubtree`、`ValidateResult` 等）在场；引用行号抽查全部命中 |
| ALLOW/DENY ↔ 正文 | 一致。正文声称的全部改动落在两文件；DENY 各行与正文「零改动」声明无冲突（如 §7 D6「只消费 validateSubtree」与 DENY `validate.ts` 闭合） |
| 调用方矩阵 ↔ 源码 | 一致。`mutation-local.ts` L296–347、`mutation.ts` L40/L337/L361、namespace-runtime 消费面（grep `from '@nomicore/vfsl'` 命中）核对在位 |
| 验收映射 ↔ SA6 契约 | 一致。21+17+test-d、根命令与期望数值与 SA6 §13 及 artifacts 日志抽查吻合 |
| 伪修订（附录承认正文不改） | 未发现。两处已知分歧（病态上限/预算粒度、域外载荷守卫）在正文 §7 D5/D6、§8.4 显式文档化，且与 DENY/非目标无矛盾 |
| 轻微不精确 | §8.4 病态行「legacy 截断标记（path `[]`）」不准确——legacy 边界路径输出的截断标记经 `validateBoundary` rebase 后为 `[...plan.prefix]`（如 `['items']`），仅 wrapApply 层 E100 为 `[]`；分歧方向与结论不受影响（见 O-1） |

## 7. 状态机与并发攻击

无状态机（设计 §8.5 声明，源码核对成立：接缝不引入模块级可变态）。按攻击面逐行验证：

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| SM-1 | 纯函数，无前置态 | 同一 (derived, plan, facts, payload) 重复调用 | 判决逐字节相同（确定性） | 无——`validateSubtree` 的 memo/计数均为调用局部（validate.ts L80–99），接缝自身零共享态 | 无 |
| SM-2 | — | 多线程/并发交错调用 | 无共享可变 ⇒ 安全且确定性 | 无 | 无 |
| SM-3 | plan 为外部对象 | 调用后 plan 被 JSON 比对（契约 A2） | plan 不被突变 | 无——设计明示「path 一律新数组、无输入突变」；实现规范已把该断言钉进契约 | 无 |
| SM-4 | 手造/篡改 plan（kind='array' 但 node.kind='union'，或 relPath≠[]，或 node 缺失） | 直调接缝 | fail closed `ok:false`（G-A/G-B）或 E100（缺字段抛错被 wrap 收编），绝不静默 `ok:true` | 无——闸门三条件 + `wrapElementwise` 双保险；F1–F3 锚定前两类 | 无 |
| SM-5 | 进程重启 / 迟到回调 / 后台任务 | — | 不适用（无进程态、无回调注册、无后台任务） | 无 | 无 |
| SM-6 | 多事实源分叉（facts.length vs 实际载体长度） | 调用方投影陈旧长度 | 接缝只能信 facts（单一输入面）；陈旧长度导致域判定与载体实态偏差属调用方职责 | 无——设计 §10 已把「facts = Y.Array.length 的 O(1) 投影」标为接线票调用方义务；接缝对 facts 形状非法 fail loud（F-1） | 无 |

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| ER-1 | 非法新元素（型错/Int 溢出/未知键/联合全拒） | 逐值 `validateSubtree` 原生 issue + rebase，整批 `ok:false`，无部分接受 | 低——与 legacy 同源同序（元素内多 issue 连续、跨元素按位置升序，与解释器遍历序一致） | 无 |
| ER-2 | insert `index > length` / delete 越界 | 单 issue 域拒绝，message/path 与 legacy 逐字（L991/L1001 核对） | 低 | 无 |
| ER-3 | facts/载荷畸形（length/index/count 非非负安全整数、values 非数组） | 响亮拒绝 F-1/P-1/P-2（新词表），非静默 fallback | 低——真实调用域（doc-runtime E3）不产该形态；legacy 轨仍可服务；设计 D5 论证了为何不镜像 legacy 的重建产物语义（负 index slice 截断/放置依赖整数组，不可复现且会产出无意义路径） | 无 |
| ER-4 | 实现缺陷导致意外异常 | `wrapElementwise` 收编为 E100 单 issue（`ok:false`，path `[]`），与 wrapApply 同款文案 | 低——无静默 ok:true 路径 | 无 |
| ER-5 | 病态载荷（单元素 >100 issue / 预算耗尽） | 每元素独立上限/预算，与 legacy 全数组单上限可分 | 低——显式文档化分歧（§8.4/D6/R2），fixture 与真实载荷远离；ADR 决策 6 明文接受同族差异 | 无（O-5 记录未来契约化路径） |
| ER-6 | 失败后重试 | 纯函数无残留状态，修正载荷重试安全 | 低 | 无 |
| ER-7 | 「伪成功」面（决策 4 污染 delete 成功） | 有意行为变更，契约 D4/D5 固化且与 NC2 legacy 对照锚并存 | 低——非静默降级，是 ADR 裁决的触达面重定义；两轨对照测试使语义可见 | 无 |

正常路径不变量（不 clamp、拒越界 no-op、批量一次判定、零写入）均以显式规范 + 双轨测试锚定，无 fallback 掩盖。

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| 新导出 `applyElementwiseArrayMutation` + 2 类型导出 | 无现有消费者；唯一目标消费方（doc-runtime kind=array 分支）明确留给接线票，且接缝形状按其最小化（只收 `{length}`、直出 `ValidateResult`） | `mutation-local.ts` L296–347（现状 S5/S6/S9）；SA6 §15；ADR 决策 3 | 无 |
| 既有 22 运行时导出 | 纯加法，既有名逐字节不变；仓库内导出面断言均为超集式（`render-projection-text-control.test.ts` C1.1「不锁死新增名」、NC6 在场性断言；跨包 `Object.keys` 断言属 vfsl-protocol/registry/persistence 自身模块面，与 @nomicore/vfsl 无关） | grep 核对 | 无 |
| `ElementwiseArrayMutationPayload` 与 `BoundaryMutationPayload` 同名支字段 | 逐字一致（op/index/values/count 类型核对相同） | `validate-patch.ts` L835–839 vs 设计 §8.1 | 无 |
| test-d 类型契约（3 条 `@ts-expect-error` 负面夹具） | 设计类型块满足全部断言（缺 length/词表 set 支/result 包装三负面均命中） | `issue-435-elementwise-array.test-d.ts` 逐条对照 §8.1 | 无 |
| wire/schema/持久化消费者 | 无——纯函数库新增判定接缝，不触复制协议、诊断日志、快照（ADR 0033 明文零改动） | ADR 0033 决策 2「commit 形态不变 ⇒ 复制协议与诊断捕获窗口零改动」 | 无 |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| 数组写判定语义（域规则 + 元素校验） | `@nomicore/vfsl`（校验语义唯一 Owner） | `validate-patch.ts` 就地扩展 | 正确 |
| 载体长度投影（`Y.Array.length`） | 调用方（doc-runtime，接线票） | 设计仅声明 facts 输入面 | 正确——vfsl 保持无 Yjs 关切（包 AGENTS 纪律） |
| 触达面/双轨策略 | ADR 0033（已裁决） | 设计执行，不自创策略 | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| `applyMutationAtBoundary`（legacy 边界接缝） | 整数组重建 + 整体验证 | 同文件同族新接缝：同参数前缀（derived, plan）、判别联合载荷、issues 失败族 | 一致（唯一有意分歧 = 返回不包装 `proposedBoundary`） | ADR 决策 3 明文；test-d 负面夹具钉死 |
| `validateInsertIntoArray`/`validateAppendToArray`/`validateDeleteFromArray`（#53 路径级数组三操作） | 路径尺度、消费数组值 | 边界计划尺度、消费载体事实 | 一致（不同尺度层，无重复） | 各服务各自管线 |
| 探针 REF 见证实现 | 测试侧合成 plan 复用 legacy | 生产实现直接调 `validateSubtree` | 一致 | 见证已证两路由语义恒等（set 支 relPath=[] → validateBoundary → 同一 validateSubtree + 同一 rebase） |

无「已有扩展点可用却新增平行通道」的情形：公共逐元素接缝在仓库内确无先例（G1 普查 22/22），新增是本票的存在理由。

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| element 子 schema | `plan.node.element`（descendValues 归一化产物） | 无副本 | 无 |
| 解释器语义 | `validate.ts` interpret 单一来源 | 无 | 无（DENY 锁定） |
| 域规则 message | legacy 分支字面量 | 新接缝复用字面量（§8.3 冻结表） | 低——两条轨各自被测试逐字节钉死（NC1 vs C1/C2/D2/D3），任何一侧漂移即红灯；属双轨 ADR 的固有代价，见 O-3 |
| 数组合法性判据 | 「逐元素可组合」立法（ADR 决策 5）+ fixture | 无第二判据 | 无 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| 不适用（无状态纯函数，无 register/subscribe/缓存/后台任务） | 不适用 | 判决经返回值传递，无资源持有 | 对称性平凡成立 |

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 第二套数组写判定路径 | legacy `applyMutationAtBoundary` | 新接缝 | 非漂移性重复：ADR 决策 1 裁决的永久双轨（union 目标走 legacy、非 union 走 fast path），两轨行为差异全部显式文档化并由对照测试锚定 |
| 第二套守卫/包装助手 | `wrapApply`/`wrapPlan`（E100 同款文案） | `wrapElementwise`（结果形直出） | 同族惯例的第三次实例化，非平行机制 |
| 第二测试入口/日志格式 | vitest 根入口 | 无新增（SA6 交付件复用既有入口） | 无 |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW `packages/vfsl/src/validate-patch.ts`（类型+函数+私有助手+头注释一句） | §7 D2/D3、§8；与边界接缝家族同文件，复用 L35 import 与既有纪律；无同名符号冲突（grep 核对） | 无 |
| ALLOW `packages/vfsl/src/index.ts`（导出块追加 + 头注释一句） | §7 D8；公共面唯一入口纪律（AC5、包 AGENTS、package.json exports 仅 `.`） | 无 |
| ALLOW 无新增测试/文档文件 | SA6 四交付件已在工作树；`docs/vfsl/v1-spec.md` 不枚举包导出面（grep 零命中）、CONTEXT.md 词汇已按目标态措辞——无规范性文档合同因本票改变 | 无 |
| DENY SA6 四交付件 + 探针 | 冻结验收面；探针保留时点证据（R1 处置正当） | 无 |
| DENY `validate.ts`/规划层/既有符号/doc-runtime/docs | 与正文「零改动」声明一致；ADR 决策 1「规划层完全不动」 | 无 |
| ALLOW 无理由扩张 / DENY 与正文冲突 / follow-up 掩盖必要项 | 未发现：doc-runtime 接线、性能基准、delete 前像均为简报与 ADR「不做什么」明文划出的后续票，非本票必要项 | 无 |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1–AC5 目标行为 | 契约 21 tests（A1–F3）逐条与设计 §8 规范核对：A2 `{ok:true}` + plan JSON 不变；B2 `[...arrayPath, index+j, ...rel]`；B3/B4 批量序与整批拒绝；B7 联合元素（容器形/标量形）；C1/C2/D2/D3 message+path 逐字；D4/D5 决策 4；E1 132 例逐字节；F1–F3 闸门 | 无——设计规范满足全部断言且无需改测试（逐条推演：域检查先于元素循环、空批量恒等、每元素独立 sub 结果按 j 序拼接均与断言形状吻合） | 无 |
| 旧实现真实为红 | 21 failed（artifacts/sa6-issue435-contract-red.log 抽查：Tests 21 failed (21)，红因 = `seam()` loud throw 能力缺口）；test-d 7 条 TS 报错（post-typecheck.log 抽查 exit 2） | 无 | 无 |
| 负控不伪绿 | NC1–NC6 锚 legacy 语义/闸门/立法前提/导出面，全部只观察公共入口运行时行为；17/17 绿（control-green.log 抽查 CONTROL_EXIT:0） | 无 | 无 |
| 类型契约 fail closed | 3 条 `@ts-expect-error`（缺 length / set 支 / result 包装）——签名若放宽为超集即红 | 无 | 无 |
| AC6 根门禁 | `npx tsc -p packages/vfsl/tsconfig.json`；根 `pnpm typecheck`（15 tsconfig）；根 `pnpm test` 期望 462 files / 5622 tests 全绿（5601 基线 + 17 负控 + 21 契约） | 无——算术与 SA6 §4 post-contract 记录（5622 = 5601+21、2 failed files = 契约 + test-d）吻合，日志抽查一致 | 无 |
| 判据敏感性（防恒真） | E2（污染 delete 上 oracle vs target 逐字节可分）+ O3.2（合法/非法 insert 字节可分）+ NC5.1（fixture 期望 vs legacy 判决全命中） | 无 | 无 |
| 回归面 | `validate-patch-mutation-boundary.test.ts` 等既有 vfsl 测试 + 跨包消费方测试不动（纯加法导出） | 无 | 无 |
| 探针预期态 | 实现后 G1.1/G1.2 FAIL（缺口闭合的预期翻转）、其余组 PASS；探针不在门禁面 | 无（设计 R1 已登记；见 O-4 的执行侧解读建议） | 无 |

## 13. Required revisions

无 BLOCKER / MAJOR finding。无需强制修订。

## 14. Non-blocking observations

| ID | Observation | 建议 |
|---|---|---|
| O-1 | §8.4 病态行括注「legacy 截断标记（path `[]`）」不准确：legacy 边界路径输出的截断标记（及解释器预算/E100 issue）经 `validateBoundary` rebase 后为 `[...plan.prefix]`（如 `['items']`），仅 wrapApply 层 E100 保持 `[]`。分歧的存在性与方向（每元素上限 vs 全数组单上限可观测可分）不受影响，且该域不进任何契约断言 | 实现时按本观察修正 §8.4 措辞或照实记录，避免后来者以「legacy 标记 path=[]」为锚写对照测试 |
| O-2 | §10 调用方矩阵证据列 `write-path-number-domain-closure.test.ts` 未带包前缀（实际位于 `packages/namespace-diagnostic-log/test/`） | 实现角色引用时补全路径，避免误在 vfsl 包内寻找 |
| O-3 | 两条域 message 字面量在 legacy 分支与新接缝各存一份（§8.3 冻结表为副本）。双轨 ADR 下不可避免，且 NC1（legacy 侧）与契约 C1/C2/D2/D3（新接缝侧）已把两侧逐字节钉死，漂移即双红 | 未来任何域措辞变更须同改两轨并同时过两组锚；可考虑在后续票提取共享常量（不改变字节） |
| O-4 | SA6 §13「探针 exit 0 不变」与其 G1.1/G1.2（断言导出缺席）自相矛盾（设计 §5/R1 已记录）。验证角色执行时若机械看探针 exit code 会误判回归 | 验证角色按「实现后探针 = 仅 G1.1/G1.2 两项 FAIL、其余全 PASS」解读；如需长期门禁化，可在后续票为探针补 post-state 期望而非修改既有断言 |
| O-5 | 病态域（单元素 >100 issue、预算边界）逐字节分歧被有意接受（D6/R2）。若未来消费方（如审计工具）需要该域与 legacy 逐字节对齐，须另立契约并重新引入跨调用计数态 | 保持现状；登记为潜在后续票的触发条件即可 |
| O-6 | 闸门第三条件（relPath=[]）超出 B-6 字面两条件（设计 R6 已自曝）。经核对 `planMutationBoundary` 的 array-* 计划恒满足（L796–799），NC3.1 锚定，仅收紧手造 plan，方向为更严 | 无需动作；若 SA8 复查追认绑定时建议把该条件并入 B-6 文字，消除字面差 |

## 15. 是否需要设计后 ADR 冲突复查（SA2 意见）

本评审**未发现**超出设计 §15 已登记范围的新 ADR 冲突风险：公共面纯加法与决策 4 的可观测语义变化均为 ADR 0033（已接受）明文裁决的执行面，规划层/legacy 轨/wire/持久化零改动。设计 §15 自行申请的复查（公共 API 变化 + SA8 工件缺席追认）属 Controller 路由决策；SA2 对此无新增触发项，故本次评审不因自身 finding 要求冲突重查。

---

## 附：一句话结论

设计以两文件纯加法把 ADR 0033 决策 1–5 落成 `applyElementwiseArrayMutation(derived, plan, {length}, payload) → ValidateResult`（三条件 fail-closed 闸门 → 事实/载荷守卫 → 逐字域规则 → insert 逐值 `validateSubtree(element)` + `[...prefix, index+j]` rebase / delete 仅域规则），等价域经同源解释器数学同构 + 132 例见证与 legacy 逐字节对齐，分歧点（决策 4、病态粒度、域外守卫）全部显式文档化并由既有 21 红契约/17 负控/test-d 钉死——**approve**，附 6 条非阻断观察。
