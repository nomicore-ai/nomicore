# SA3 Implementation Report — issue #348 条件写语义矩阵补全：深相等、读失败路径、XML 与 set([])（guard II）

- 任务：issue #348（`wiki/raw/task_issue-348.md`，8 条 AC）
- 角色：SA3（iteration 0；此前无 `wiki/raw/task_issue-348_sa3_impl.md`，本文件为首版）
- 基线：HEAD `61e2daa37e21b467e7ce130d5c4db7be38bde982`（branch `mabf/issue-348`）
- 一句话结论：**按 SA6 契约 §12.2–§12.8 与设计 §7/§8 落地单文件 92 用例语义矩阵（7 组 describe，1:1 用例 ID），首次运行即 92/92 全绿**；生产修正范围保持 **∅**（无 ADR 0025 偏差暴露），doc-runtime 套件 29 files / 539 tests 全绿、根 `pnpm typecheck` exit 0（AC8 门闭合）。

## Inputs consumed

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-348.md`（issue 正文 + 8 AC + Blocked by #347） | 已读 |
| `wiki/raw/task_issue-348_sa6_contract.md`（验收契约；§12.0–§12.9 用例表为用例权威） | 已读 |
| `wiki/raw/task_issue-348_design.md`（SA1 设计；纯测试锚定、落点冻结、修正范围 ∅、§13.3 条件修正路径） | 已读 |
| `wiki/raw/task_issue-348_sa2_review.md`（approve；R1/R2 MINOR + N1–N6 观察） | 已读 |
| `wiki/raw/task_issue-348_conflict_report.md`（SA8 clear；冻结面 8 项；requiresConflictRecheck=false） | 已读 |
| `wiki/raw/task_issue-348_relevant_decisions.md`（ADR 0025/0026/0007/0008/0016 条款摘录） | 已读 |
| Issue 评论（dispatch 与 SA6 §2/SA8 §1 同口径：REST 读取为空） | 无 Owner 要求、无 override |
| 源码只读核对：`packages/doc-runtime/src/mutation.ts`（guard 面）、`read.ts`（投影面）、`index.ts`；`packages/doc-runtime/test/issue-347-guard-envelope-red.test.ts`（组织惯例与助手语义） | 已核 |
| 模块契约：`packages/doc-runtime/AGENTS.md`（公共面只经 `index.ts`；mutation/read 契约变化才需根 `pnpm test`） | 已核 |

## Existing worktree reconciliation

- 派发时工作区无生产改动：`git status --short` 仅 6 个未跟踪任务产物（issue 简报 / 冲突报告 / 设计 / 决策摘录 / SA2 评审 / SA6 契约）；无既有 `task_issue-348_sa3_impl.md`，无待修订实现。
- 生产源与 SA6 §16 记录逐字节一致（未修正即未触碰）：`packages/doc-runtime/src/mutation.ts` sha1 `dd46e2bcec58dd8c6dab61175e08ce994f9de397`（= HEAD 与 SA6 记录值）、`read.ts` `7e1a0496e0b0715d7f7aca6f02a597954eb5249b`、`index.ts` `e7f36c5ff140a7a99f98918be62b3c815f287aa9`。
- 落点 `packages/doc-runtime/test/issue-348-guard-semantics-matrix.test.ts` 不存在（SA6 §14 的 runner-trigger 临时文件已删除、无残留）；本票为首次实例化。
- 临时诊断（收尾已删）：`packages/doc-runtime/.sa3-probe/probe.ts`（非 `.test.ts`、不入库）用于先行验证 fixture 文本与 9 个高风险边角（XML 终点 / 空 XML / Y.Text / Date / detached / `-0` 保号 / 24 层 / 批量 / `set([])` 先过 guard）；证据齐备后整目录删除，`git status` 无残留。

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/doc-runtime/test/issue-348-guard-semantics-matrix.test.ts` | 设计 §7 D1–D9、§8.1–§8.2、§11 ALLOW 第 1 行；SA6 §12.0–§12.9 | **新建**（1086 行）：文件头 doc-comment（ADR 0025 L42–44/L48–51/L53–58/L72–74、ADR 0008 L23/L26、ADR 0007 L29/L93–96、ADR 0026 L29/L53–55 + 目标绿声明 + M1–M4 反伪绿证据 + SA2 R1/R2 澄清）；自包含 fixture（`TEXT`/`derivedOf`/`baseSnapshot`/`fixture`）；内联助手（`run`/`bytes`/`taskEntry`/`valuesArray`/`guardIssues`/`watchWrites`/`expectZeroWrite`/`expectCommitted`/`expectGuardMismatch`/`expectShapeError` + `guarded`/`rootReplace`/`bigTasks`/`deepFree`）；7 个顶层 `describe` × 92 个 `it`（A 16 / B 31 / C 7 / D 15 / E 7 / F 4 / G 12），用例 ID 1:1 置于 `it` 标题首 token |
| `wiki/raw/task_issue-348_sa3_impl.md` | SA3 技能固定产物位 | 本报告（新建/原位维护） |

> 注：设计 §11 ALLOW 列表列出的是 SA1 自身设计产物与测试落点；本报告为 SA3 技能规定的固定产物位（`wiki/raw/task_<slug>_sa3_impl.md`），非源码路径。临时探针目录已删除，不计入 changed paths。

## SA2 Finding落实

| Finding ID | Implementation | Result |
|---|---|---|
| R1（MINOR）各组 fixture 变体枚举不完整、括号列举呈穷举貌 | 逐条按 SA6 表行首前置条件落码：A1/A1d 用 `baseSnapshot({ n: 0 })`、A8 用 `baseSnapshot({ values: [1, 0, 3] })`、G6 用 `baseSnapshot({ n: 0 })`、E5 value = schema 合法全量快照 `baseSnapshot({ n: 42 })`；文件头显式声明「各组 fixture 变体非穷举枚举，前置条件一律以 SA6 §12.2–§12.8 表为准」 | 落实；无「标准 fixture」误导残留，A1/A1b/A8/A12/G6 的 M2 增量锚与 E1/E6/E7 的 M3 增量锚完整落码 |
| R2（MINOR）「即使内容字面相等也不满足」超出空 XML fragment fixture 的锚定能力 | 文件头改写为「B28 是『loud 拒绝而非静默空投影』的区分锚（静默投影 `''` 会使 absent 满足转红）；B29/B30 锚读失败路径上 equals 的 M1 敏感性」，不主张内容相等；B28 用 absent 满足 + 落盘断言（区分锚），B29/B30 用 equals 不满足判决 | 落实；设计与实现口径一致，无超出 fixture 能力的主张 |
| N1（引注精度，非阻断） | 未复制 #347 的区间记法 | 无影响 |
| N2（D6 助手枚举未列 `baseSnapshot`/`taskEntry`/`guardIssues`） | 三者按 #347 全套内联（`baseSnapshot` L87、`taskEntry` L146、`guardIssues` L155；`watchWrites` L160、`expectCommitted` L183、`expectGuardMismatch` L195、`expectShapeError` L215） | 落实 |
| N3（`expectCommitted` 不含落盘值断言） | 全部 59 个满足态用例均携带至少一条落盘值断言（`n=2` / `taskEntry(...)` / `valuesArray(...).toJSON()` / `fx.root.toJSON()`） | 落实 |
| N4（C2 message 辅助断言依赖摘要 JSON） | C2 主断言仍为判决契约（`expectGuardMismatch`），`toContain('<p>hi</p>')` 为次级辅助断言并注明 | 落实 |
| N5（`类型不匹配` 文案锚） | E4（`toContain`）↔ E7（`not.toContain`）与 G10（`not.toContain`）构成 N-D 次序对照 | 落实 |
| N6（B25 极性归属） | B25 断言 absent 不满足（正极性反例），B25b 断言 `equals:''` 满足；标题与注释明示「投影 `''` 属有值」 | 落实 |

无 BLOCKER / MAJOR；SA2 的 approve 前置（生产修正范围 ∅）在实现中保持成立。

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/doc-runtime/test/issue-348-guard-semantics-matrix.test.ts` | 设计 §11 ALLOW LIST 第 1 行（SA6 §12.1 冻结落点，唯一交付物） | AC1–AC8 全部用例落点（92 用例 + 负控成对） |
| `wiki/raw/task_issue-348_sa3_impl.md` | SA3 技能固定产物位（实现报告） | 汇报改动、验证与证据 |

DENY 面核对（全部未触碰）：`mutation.ts` / `read.ts` / `index.ts`（sha1 与 HEAD 一致）、`issue-347-guard-envelope-red.test.ts`、`public-surface-guard.test.ts`、`issue-350-*.test.ts` 与其余既有测试、`packages/namespace-runtime/**`、`packages/vfsl*/**`、`packages/persistence/**`、`apps/**`、`domains/**`、`docs/adr/**`、`CONTEXT.md`、`docs/protocols/**`、`vitest.config.ts`、`package.json`、根/包 tsconfig、`wiki/raw/task_issue-348*.md`（除本报告）。`git status --short` 仅新增测试文件与任务 wiki 产物。

## Verification

| Command | Result | Evidence |
|---|---|---|
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/doc-runtime/test/issue-348-guard-semantics-matrix.test.ts` | **92/92 passed（1 file）**，`Type Errors no errors`，558ms | 首次运行即全绿——无实现红灯，未触发设计 §13.3 条件修正路径 |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/doc-runtime/test`（AC8 门逐字） | **29 files / 539 tests passed**，`Type Errors no errors`，12.19s（基线 28/447 → 29/539，与设计 D3 计数锚逐字一致）；收尾复核复跑 8.74s 同结果 | 既有 #347/#350/public-surface 等 28 files 原样全绿（N-A/N-E 引用保持） |
| `pnpm typecheck`（根，AC8 门另一半） | **exit 0**（14 个 tsconfig 串行全过） | 新文件已被 `packages/doc-runtime/tsconfig.json` include `test/**/*.ts` 纳入 |
| 用例 ID 1:1 核对（`grep -o "^  it('[A-Za-z0-9]*"`） | 92 个 ID = `A1 A1b A1d A2–A14 / B1–B25 B25b B26–B30 / C1–C7 / D1–D15 / E1–E7 / F1–F4 / G1–G12` | 与 SA6 §12.2–§12.8 逐 ID 相同；7 个 describe = §7 D4 组序（16/31/7/15/7/4/12） |
| 断言纪律核对（grep skip/only/todo/env override/`as any`/`console`） | 0 命中（exit 1） | D7 机械约束落实 |
| 生产面零改动核对（`sha1sum`） | `mutation.ts` = `dd46e2bcec58dd8c6dab61175e08ce994f9de397`（= SA6 §16 冻结值 / HEAD） | 修正范围 ∅ 直接证据；SA6 §12.11.1 裁定维持 |
| 零写入三件套覆盖 | `expectZeroWrite` 经 `expectGuardMismatch`（31 例）/ `expectShapeError`（A13）/ E4 显式调用，覆盖全部 32 个拒绝用例 | 字节快照 + 0 事务 + 0 update 逐例强制 |

## Deferred verification

- **变异敏感度复跑（M1–M4）**：SA6 §9.2 已在案（探针 13/5/3/3 例击穿，M2/M3 为既有套件盲区）；对新矩阵复跑需临时改动 DENY 面 `packages/doc-runtime/src/mutation.ts`，超出 SA3 范围（设计 §13.3 仅在实现红灯时开放该文件，本票无红灯），列后续验证。
- **根 `pnpm test`**：仅当实现修正触及 mutation/read 契约时按 `packages/doc-runtime/AGENTS.md` 追加；本票生产修正范围 ∅，条件门未触发。
- **SA4/SA7 动态与最终验证**：矩阵的宽/深规模耗时、消息有界（F3/F4 < 4096）与 detached 直造载体的稳定性归后续动态验证（本报告仅记录单轮实测：新文件 124ms、整目录 12.19s）。
- **namespace-runtime 透传面**：本票未触碰，归 #347 既有 `issue-347-guard-passthrough-red.test.ts` 与后续流程。

## Deviations or blockers

- **无偏差、无阻塞**：92 用例首次运行全绿，未暴露任何 ADR 0025 偏差，故生产修正范围保持 ∅（未触碰 SA8 §4 冻结面任一项，无需回 SA8 复核、`requiresConflictRecheck` 不适用）。
- 交付物为单个新增测试文件 + 本报告；回滚 = 删除测试文件（套件回到 28 files / 447 tests 基线）。
- 残余问题承接 SA6 §9.3 / 设计 §13.4（A15 自定义原型链、Z1–Z3 环状/万层深、D14/D15 值域边界语义张力），均为非 AC 边界、当前 fail-closed 零写入，不随本票。

## Suggested commit message

```
test(#348): 条件写语义矩阵补全：深相等、读失败路径、XML 与 set([])（guard II）
```
