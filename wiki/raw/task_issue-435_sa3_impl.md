# SA3 Implementation Report — issue #435：vfsl 数组逐元素校验 seam + 一致性 fixture（ADR 0033）

- 角色：SA3（TDD 实现执行者，一次性 dispatch `sa-7c7f6c91-a4ed-4582-98f3-aa4adffbfa5c`，iteration 0）
- 基线 HEAD：`f6b27da8eadc5cad3bf65c728094767ecb8c601b`（与 SA1/SA2/SA6/SA8 一致；工作树含 SA6 未跟踪交付件）
- 结论：**实现完成，规定验证全绿**——红契约 21 → 绿、负控 17 恒绿、包 tsc exit 0、根 `pnpm typecheck` exit 0、
  根 `pnpm test` 462 files / 5622 tests 全绿（Type Errors: no errors）。无阻塞、无偏差。

## Inputs consumed

| 输入 | 路径 | 用途 |
|---|---|---|
| 任务简报 | `wiki/raw/task_issue-435.md` | Issue #435 正文 + What to build + AC1–AC6；Comments 空（Host 明文「no owner requirements apply」，本票无 owner 追加面） |
| 批准设计（SA1） | `wiki/raw/task_issue-435_design.md` | §7 D1–D8 决策、§8.1 类型块、§8.2 算法规范、§8.3 message 冻结表、§11 ALLOW/DENY、§12 验收映射 |
| SA2 设计评审 | `wiki/raw/task_issue-435_sa2_review.md` | `approve`（0 BLOCKER / 0 MAJOR）+ §14 六条非阻断观察 O-1…O-6 |
| SA8 冲突复查 | `wiki/raw/task_issue-435_design_conflict_report.md` | 裁决 `clear`；§8 Required actions 1/2/4 为实施期义务（message 逐字、纯加法核对、探针解读） |
| SA6 验收契约 | `wiki/raw/task_issue-435_sa6_contract.md` | §12.1 绑定 B-1…B-6、§12.2 目标行为、§12.3 测试路径、§13 红/绿证据与期望值 |
| SA6 交付件（4 个测试文件） | `packages/vfsl/test/issue-435-elementwise-array-{contract,control}.test.ts`、`-fixture.ts`、`.test-d.ts` | 红灯契约（21）、负控（17）、132 例一致性夹具、类型契约（B-1…B-5 + 3 负面夹具） |
| 探针 | `wiki/raw/task_issue-435_sa6_capability_probe.mts` | 时点证据；实现后预期态核对（SA8 §8 行 4） |
| 源码锚点 | `packages/vfsl/src/validate-patch.ts`、`packages/vfsl/src/index.ts`、`packages/vfsl/src/validate.ts`、`packages/vfsl/src/derived.ts`、`packages/vfsl/AGENTS.md`、根 `package.json`/`tsconfig*.json`/`vitest.config.ts` | 实现落位、纪律与验证入口 |

缺失输入：`task_issue-435_relevant_decisions.md` / `_conflict_report.md` / 既有 `_sa2_review.md` 均不存在（iteration 0）；
SA8 已以 `task_issue-435_design_conflict_report.md` 补位裁决（`clear`，追认绑定 B-1…B-6 无需换名/换形），故不构成阻塞。

## Existing worktree reconciliation

进入时工作树 = HEAD + SA6 交付件（4 个未跟踪测试文件 + 探针 + 契约报告 + 基线/红灯/负控证据日志），
`packages/*/src` 零改动。核对与处置：

| 工作树既有内容 | 处置 |
|---|---|
| SA6 红灯契约 / 负控 / 夹具 / 类型契约（4 文件） | **原样保留**（DENY）：未改一个字节，未加 skip/only/todo、未动断言与绑定块；mtime 11:49–11:51（早于本次实现 12:30），文件大小与 SA6 交付一致 |
| `wiki/raw/task_issue-435_sa6_capability_probe.mts` | 原样保留（DENY）；仅执行取证，实现后预期态 = 仅 G1.1/G1.2 FAIL（已实测） |
| 既有 `packages/vfsl/src/validate-patch.ts` legacy 轨（`planMutationBoundary`/`applyMutationAtBoundary`/`validateBoundary`/`wrapApply` + 数组三操作/`validatePatch`） | 逐字节不动（DENY）；仅在文件尾**追加**新符号、文件头补一句 issue #435 说明、import 行类型加 `ValidateIssue` |
| 既有 `packages/vfsl/src/index.ts` 22 个运行时导出 | 纯加法（22 → 23）：既有名字/顺序不变，仅追加 1 运行时 + 2 类型导出 + 注释 |
| `artifacts/sa6-issue435-*.log` 等 SA6 证据 | 只读复用（SA6 期望值核对），未修改 |
| 无 `task_issue-435_sa3_impl.md`、无未提交实现 | 本票为首次实现；本报告新建 |

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/vfsl/src/validate-patch.ts` | §7 D2/D3/D4/D5/D6/D7；§8.1/§8.2/§8.3 | 文件头补 issue #435 一句；import 类型加 `ValidateIssue`；文件尾新增：`ArrayCarrierFacts`、`ElementwiseArrayMutationPayload`、`applyElementwiseArrayMutation`、私有 `isSafeNonNegInt`/`singleIssue`/`wrapElementwise`（+114 净行，纯加法；既有符号逐字节不动） |
| `packages/vfsl/src/index.ts` | §7 D8；§11 ALLOW | 头注释公共接缝清单补 issue #435 一条；既有 `validate-patch` 导出块追加运行时 `applyElementwiseArrayMutation` 与类型 `ArrayCarrierFacts`、`ElementwiseArrayMutationPayload`（运行时导出 22 → 23） |

实现要点（与设计逐条一致）：

1. **闸门三条件 fail closed**（D4）：`plan.kind !== 'array' || plan.relPath.length !== 0` → G-A；
   `plan.node.kind !== 'array'` → G-B（union 数组目标由第二条件排除，不静默接受）。
2. **载体域事实守卫**（D3/D5）：`facts.length` 必须非负安全整数（`Number.isSafeInteger && >= 0`），否则 F-1；
   实现不读取 `facts.length` 之外的任何长度相关量 ⇒ 结构性 O(1) 闸门/域规则 + O(Σ size(新值)) 元素校验。
3. **op 域规则逐字复用 legacy**（D3/§8.3）：insert `index > length` → `array-insert index 越界（不 clamp）`；
   delete `index >= length || index + count > length` → `array-delete 范围越界（不 clamp、不接受越界 no-op）`；
   两条 message/path 与 `validate-patch.ts` legacy 支（L990–992/L1000–1002）逐字相同。
4. **insert 逐新值过 element 子 schema**（D6）：每个新值独立 `validateSubtree(derived.values, node.element, values[j])`，
   issue rebase `[...arrayPath, index+j, ...原生相对 path]`（与 legacy `validateValue(element, v, [i])` + `validateBoundary`
   rebase 数学同构）；批量循环一次收集、中间态不参与、空批量恒等 accept。
5. **delete 仅域规则**（D3/决策 4）：域检查后直接 `{ ok: true }`，无元素值输入面（`ArrayCarrierFacts` 结构性排除元素值）。
6. **返回 `ValidateResult` 直出**（D7）：无 `proposedBoundary`、无 `result` 包装；`wrapElementwise` 崩溃边界
   收编一切内部异常为单条 `VFSL-E100: 内部错误（意外异常）: …`（path `[]`），不抛错、无静默 `ok:true`。
7. **纯度**：只读四输入，path 一律新数组（`[...plan.prefix, …]`），零模块级可变态、零缓存、零写入面。

## SA2 Finding落实

SA2 裁决 `approve`，**0 BLOCKER / 0 MAJOR**，故无强制修订；§14 六条非阻断观察落实如下：

| Finding ID | Implementation | Result |
|---|---|---|
| O-1（§8.4 病态行「legacy 截断标记 path=[]」不精确） | 设计文档属 DENY，未改；实现未以「legacy 标记 path=[]」为锚写任何逻辑——新接缝对元素级解释器 issue 统一 rebase 为 `[...arrayPath, index+j]`，仅接缝自身 `wrapElementwise` E100 为 `[]`（与 SA2/SA8 核正一致） | 已按核正实现；无契约断言触及病态域 |
| O-2（§10 证据路径缺包前缀 `packages/namespace-diagnostic-log/test/…`） | 实现面不涉及该文件；本报告与后续引用补全包前缀 | 无动作需求（记录即闭环） |
| O-3（两条域 message 在 legacy 与新接缝各存一份） | 按设计 §8.3 逐字**复制**（不抽共享常量——抽常量会触碰 legacy 面且超出本票范围）；两侧漂移由 NC1（legacy）与契约 C1/C2/D2/D3 + E1（新接缝）双向钉死 | 双轨镜头下维持一致（根 `pnpm test` 5622 全绿含两组锚） |
| O-4（探针实现后预期态解读） | 实测 `artifacts/sa3-issue435-probe-post.log`：`exports(23)`、51 PASS、**failures=2 = 仅 G1.1/G1.2**（断言导出缺席的两项，缺口闭合的预期翻转），其余 GAP/ORACLE/NC/DRY 全 PASS | 与设计 §13 R1 / SA8 §8 行 4 的解读逐字一致 |
| O-5（病态域逐字节分歧有意接受） | 未在接缝内聚合 100 条上限或全局预算（保 `validate.ts` 解释器单一来源）；每元素独立上限/预算 | 与设计 §8.4/D6/§13 R2 一致；已登记为潜在后续契约触发条件 |
| O-6（闸门第三条件 relPath=[] 超出 B-6 字面两条件） | 按设计 D4 实施（`plan.relPath.length !== 0` → G-A，fail closed 更严方向）；真实 `array-*` 计划恒 `relPath=[]`（NC3.1 锚定），不收窄任何真实计划 | 契约 F 组不受影响（21/21 绿） |

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/vfsl/src/validate-patch.ts` | §11 ALLOW 行 1（新增类型 + 接缝函数 + 私有守卫助手 + 头注释一句） | 接缝实现本体（§7 D2/D3、§8）；与边界接缝家族同文件 |
| `packages/vfsl/src/index.ts` | §11 ALLOW 行 2（既有导出块追加 1 运行时 + 2 类型导出；头注释补一句） | 公共面唯一入口（包 AGENTS；AC5；B-1） |
| `wiki/raw/task_issue-435_sa3_impl.md` | 技能规定的实现报告固定产物（非设计 ALLOW 枚举的源码面） | 本报告 |
| `artifacts/sa3-issue435-*.log`、`artifacts/sa3-issue435-guard-probe.mts` | 证据面（沿用 SA6 证据日志惯例，非源码/非测试入口，不在 vitest include 面） | 红/绿/typecheck/test/探针/守卫核对/判据敏感性证据留档 |
| `/tmp/sa3-435-guard-probe.mts` | 仓外临时 scratch（同内容存档于 `artifacts/sa3-issue435-guard-probe.mts`） | 守卫 message/纯度运行时核对 |

**DENY 核对（`git status`/`git diff` 实证）**：`packages/vfsl/src/validate.ts`、`validate-patch.ts` 内既有符号、
SA6 四测试件与探针、`packages/doc-runtime/**`、`packages/namespace-runtime/**`、`packages/namespace-diagnostic-log/**`、
`apps/**`、`domains/**`、`docs/**`、`CONTEXT.md` 全部零改动；未新增任何测试文件（无仓内测试新增/修改）。

## Verification

| Command | Result | Evidence |
|---|---|---|
| `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/vfsl/test/issue-435-elementwise-array-contract.test.ts packages/vfsl/test/issue-435-elementwise-array-control.test.ts`（实现前） | **exit 1：21 failed（契约）/ 17 passed（负控）**，红因逐条 = 能力缺口（`seam()` loud throw，`typeof=undefined`） | `artifacts/sa3-issue435-pre-fix-focused.log` |
| 同上（实现后，收尾态） | **exit 0：2 files / 38 passed（21 契约 + 17 负控）**，`Type Errors  no errors` | `artifacts/sa3-issue435-final-focused.log`（另 `-focused-green{,-rerun}.log` 同值） |
| `npx tsc -p packages/vfsl/tsconfig.json` | **exit 0**（无输出） | `artifacts/sa3-issue435-package-tsc.log` |
| `pnpm typecheck`（根，15 个 tsconfig） | **exit 0**（全链通过） | `artifacts/sa3-issue435-root-typecheck.log` |
| `pnpm test`（根，`vitest run --typecheck`） | **exit 0：462 files / 5622 tests 全绿，Type Errors: no errors**（= SA6 契约 §13 期望值） | `artifacts/sa3-issue435-root-test.log` |
| 探针（SA6 能力探针，实现后） | exit 1，`failures=2`：**仅 G1.1/G1.2 FAIL**（导出缺席断言翻转 = 缺口闭合），51 PASS（GAP 其余/ORACLE/NC/DRY） | `artifacts/sa3-issue435-probe-post.log` |
| 守卫/纯度探针（SA3 诊断，`artifacts/sa3-issue435-guard-probe.mts`） | **exit 0：21/21 PASS**——G-A/G-B/F-1/P-1/P-2 message 逐字 + path、D-I/D-D 逐字、E-* rebase、空批量恒等、`count=0` 界内镜像接受、E100 收编手造 plan、四输入零突变、确定性 | `artifacts/sa3-issue435-guard-probe.log` |
| 判据敏感性 MUT-B：insert rebase `index+j` → `index+j+1` | exit 1：**6 failed**（B2/B3/B4/B5/B7/E1）| `artifacts/sa3-issue435-mutation-insert-rebase.log` |
| 判据敏感性 MUT-E：短路逐元素校验（循环上界 0） | exit 1：**6 failed**（B2/B3/B4/B5/B7/E1） | `artifacts/sa3-issue435-mutation-skip-element-check.log` |
| 判据敏感性 MUT-F：insert 域规则放宽 `index > length` → `index > length + 1` | exit 1：**2 failed**（C1、E1） | `artifacts/sa3-issue435-mutation-insert-domain.log` |
| 判据敏感性 MUT-D（对照）：delete 首子句 `index >= length` → `index > length` | exit 0（0 failed）——**covered 域上的语义等价变体**：count ≥ 1 时该子句被 `index + count > length` 吸收，SA6 §15 明文把 `count=0` 越界形态排除在目标契约外；实现仍逐字镜像 legacy 两子句式（未据此简化） | `artifacts/sa3-issue435-mutation-delete-domain.log` |

每次变异实验均以 `cp` 备份 + `trap restore EXIT` 在同一命令内还原；收尾复核：
`git diff --stat` 仅两文件（+130/-3）、`git status` 仅两 ALLOW 文件被修改、包 tsc 复跑 exit 0、聚焦 38/38 复绿。

## Deferred verification

| 项 | 归属 |
|---|---|
| 实现后冲突复查（公共面纯加法 22 → 23、§8.3 message 逐字、DENY 清单未被触碰、NC1–NC6 与 legacy 锚保持绿、契约 21 翻绿） | SA8/SA9 复查（本报告 + 证据日志已备：探针 `exports(23)`、守卫探针 message 逐字、根 test 全绿） |
| 独立验收/反向验证（含探针预期态解读、§12.2 目标行为逐条复核） | SA4 / SA7 |
| doc-runtime 接线票：S5 省略整数组 walk / S6 换接缝 / S9 省略边界重投影、E201 行为变化、其侧 public-surface guard、`CONTEXT.md` 措辞-现实差与 O(n)→O(k) 实际收益 | 后续票（ADR 0033 决策 3/4；本票非目标） |
| 性能基准票（决策 6 软验收） | 另票（本票按设计不加阈值断言，避免机器相关伪红） |
| 病态域（单元素 >100 issue、预算边界）与 legacy 逐字节对齐 | 未来契约/修订触发项（设计 §8.4/D6/R2；不得在实现里静默聚合上限） |
| ADR-0007 §#237 补 ADR 0033 回指（docs 纪律，非阻塞） | 接线票顺带收口（SA8 §8 行 3） |

## Deviations or blockers

- **无偏差、无阻塞**：实现与批准设计 §7/§8 逐条一致；未扩大/缩小文件范围；未新增或改写测试；未引入 env override、
  fallback、吞错或伪成功；未触碰 DENY LIST 任何路径；未修改设计/契约/探针/夹具。
- 记录（非偏差）：MUT-D 显示 delete 首子句在 count ≥ 1 时冗余——实现仍逐字保留 legacy 两子句式（保持「域规则逐字一致」），
  该观察不改变任何契约结论。
- 未执行（按纪律）：`git add`/`commit`/`push`/PR/finalize 均未执行；SA3 不承担全仓回归以外的角色职责（根 test 因 AC6 明文已运行）。

## Suggested commit message

```
feat(vfsl): 数组逐元素校验接缝 applyElementwiseArrayMutation（issue #435 / ADR 0033）

新增公共纯函数接缝 applyElementwiseArrayMutation(derived, plan, {length}, payload) → ValidateResult：
闸门三条件 fail closed（kind=array ∧ node.kind=array ∧ relPath=[]）→ 载体/载荷守卫 →
逐字域规则（不 clamp、拒越界 no-op、批量一次判定、空批量恒等）→ insert 逐新值过 element 子 schema
（issue 路径 [...arrayPath, index+j, ...原生相对 path]，与全量路径逐字节兼容）/ delete 仅域规则
（不触碰元素值；触达面 = 载体 + 变更区间）。

- packages/vfsl/src/validate-patch.ts：新增 ArrayCarrierFacts、ElementwiseArrayMutationPayload、
  applyElementwiseArrayMutation 与 isSafeNonNegInt/singleIssue/wrapElementwise 私有助手（纯加法）
- packages/vfsl/src/index.ts：validate-patch 导出块追加 1 运行时 + 2 类型导出（运行时 22 → 23）
- legacy 轨（planMutationBoundary/applyMutationAtBoundary/validate.ts 解释器）逐字节不动

验证：#435 红契约 21 → 绿、负控 17 恒绿、132 例一致性 fixture 逐字节一致；包 tsc exit 0；
根 pnpm typecheck exit 0；根 pnpm test 462 files / 5622 tests 全绿（Type Errors: no errors）。
```
