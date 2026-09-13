# SA3 Implementation Report — issue #368 W1：`@nomicore/doc-runtime` 载体级窗口原语（ADR 0028 缝 1）

- Role：SA3（TDD 实现执行者），dispatch `sa-9782138e-9458-40d2-8699-983f3bf69b82`，phase implementation，iteration 0
- Worktree：`/home/wangjian/nomicore-fix-issue-368`（branch `mabf/issue-368`，基线 HEAD `36a73bb`）
- 结果：SA6 红灯契约 **45/45 绿**（原 39 红 + 6 绿负控保持）；必选 pins **11/11 绿**（实现前 11 红统一于入口存在性）；
  包级/root typecheck 与 root `pnpm test` 全绿；`read.ts` 与契约测试文件零 diff；改动面 = ALLOW LIST + 本报告。

## Inputs consumed

| 输入 | 用途 |
|---|---|
| `wiki/raw/task_issue-368.md` | 任务简报（What to build + AC1–AC6；Owner override 正向/负向清单） |
| `wiki/raw/task_issue-368_design.md`（680 行，iteration 1） | 最新批准设计：D1–D12、§8 接口与算法、§9 失败语义、§11 ALLOW/DENY、实现边界摘要 |
| `wiki/raw/task_issue-368_sa2_review.md` | SA2 approve（0 BLOCKER / 0 MAJOR）；F1–F4 全部销项；实现期复核清单（§14-3） |
| `wiki/raw/task_issue-368_sa6_contract.md` + `test/issue-368-window-read-contract-red.test.ts` | 验收契约：绑定 B-1…B-5、39 红 + 6 绿负控、§12.7 红线 |
| `wiki/raw/task_issue-368_relevant_decisions.md`、`docs/adr/0028-window-read.md` | 决策 2/3/4/5/7/8/9 词表与总序、三稳定码、成本纪律 |
| `docs/adr/0024-readdata-shape-budget.md` 轴语义（经设计 §7-D9 摘引） | `depth` / `maxChildrenPerNode` 语义与 `-0` 归一 |
| `packages/doc-runtime/src/{index,read,carrier}.ts`、`test/*`、`packages/doc-runtime/AGENTS.md` | 姊妹语义逐行对账、复制集名目、公共面纪律、守卫测试现状 |
| `packages/doc-runtime/test/issue-368-window-read-contract-red.test.ts`（816 行实读） | 逐条断言核对（A–H 组 / NC1–NC6）——**未修改** |

## Existing worktree reconciliation

- 本轮为首次实现轮：`wiki/raw/task_issue-368_sa3_impl.md` 原先不存在，`packages/doc-runtime/src/**` 对 HEAD 零改动，
  无既有实现需要保留/修正/删除。
- worktree 内既有未跟踪输入（SA6 契约测试文件 + `wiki/raw/task_issue-368*.md` 上游产物）按只读消费，未改动。
- 实施前检查通过：设计内部一致、ALLOW/DENY 明确、SA2 无未落实 BLOCKER/MAJOR、SA8 约束可在设计内实现、
  39 条红灯契约的预期失败行为明确（能力缺失断言，实测复现）、接口与失败语义足以编码。

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/doc-runtime/src/window.ts`（新建，~730 行） | §7 D1–D11、§8.1/§8.2、§9 | 两入口 + 全部窗口私有逻辑与公共类型；`read.ts` 复制集 9 件带出处标记；新建码点比较器 |
| `packages/doc-runtime/src/index.ts`（+19 行） | §7 D2/D11、§10 | 加法导出：2 值导出（`readArrayWindowAtPath` / `readMapWindowAtPath`）+ 13 类型名目（含 `WindowTerm` / 结果联合 / 失败联合） |
| `packages/doc-runtime/test/issue-368-window-read-design-pins.test.ts`（新建，11 用例） | §7 D12（P1–P8，必选）、§12 | 钉死项可执行锚；实现前 11 红统一于入口存在性，实现后全绿 |
| `packages/doc-runtime/test/public-surface-guard.test.ts`（+2 用例） | §10/§11 ALLOW 第 3 行 | P-W1 两值导出记账（存在性 + 函数形态）；P-W2 命名空间键审计（窗口面恰两枚，防别名） |
| `packages/doc-runtime/test/public-surface-type-guard.test-d.ts`（+3 用例 + 14 类型名目 import/declare） | §10/§11 ALLOW 第 4 行 | D11 类型名目正例投影 + 4 条编译期负例（语境外排序项 fail-closed） |
| `wiki/raw/task_issue-368_sa3_impl.md`（本文件） | 技能固定产物 | 实现报告 |

## SA2 Finding 落实

| Finding ID | Implementation | Result |
|---|---|---|
| **SA2-F1（MAJOR）** D8/D4 零可执行锚 | 必选 pins 文件落地：**P1**（D8 fail-fast：`n:3` field 基全选含毒项 f3 → 同步不抛 / `ok:false` / `code:'PATH_NOT_ALLOWED'` 严格 / 失败联合无 `value`（无半窗）/ `path` 深等 `['field','f3']` / message 非空）+ **P2**（D4：NaN/-Infinity/+Infinity 全落不可比尾组、组内键 asc、asc/desc 组位不变、插入序刻意打乱 `q5,q3,q1,s1,n2,q2,q4,n1` + n=5 边界）+ **P2b**（数组面值键同款归尾）；P3–P8 同文件必选承载 | 已落实；两处观察面完成见「Deviations」§1/§2（期望值零改动） |
| SA2-F2（MINOR）身份锚比较器未钉死 | `compareCodePoints` 逐码点迭代比较器**同时**用于 string 组排序键与键面身份（平局/尾组）锚；**P8** astral 平局键两方向均 `['\uFFFD','\u{1F600}']` | 已落实（mutation-4 UTF-16 码元序实现 → P8 + 契约 A7 双红） |
| SA2-F3（MINOR）调用方矩阵标签 | 无代码面（仅设计文本）；实现零调用方改动（新导出纯加法，root 全绿） | 无需实现动作 |
| SA2-F4（MINOR）复制集名目/漂移约定 | 9 件复制件逐函数头注释 `copied from read.ts@36a73bb (<原名>)`：`safeSpreadPath` / `safeDetail` / `isNonNegInt` / `segMsg` / `yjsWord` / `isPlainRecord` / `readableOwnDataValue` / `readableArrayElement` / `navClassify`；`read.ts` 零 diff（`git diff --name-only` 空） | 已落实 |

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/doc-runtime/src/window.ts` | §11 ALLOW 第 1 行（新建） | 两入口 + 窗口私有逻辑/类型（唯一实现载体） |
| `packages/doc-runtime/src/index.ts` | §11 ALLOW 第 2 行 | 加法导出（AGENTS：公共 API 仅经 `src/index.ts`） |
| `packages/doc-runtime/test/public-surface-guard.test.ts` | §11 ALLOW 第 3 行 | 加法 describe：两新值导出记账 |
| `packages/doc-runtime/test/public-surface-type-guard.test-d.ts` | §11 ALLOW 第 4 行 | 加法：D11 类型名目 + 编译期负例 |
| `packages/doc-runtime/test/issue-368-window-read-design-pins.test.ts` | §11 ALLOW 第 5 行（必选，SA2-F1 升格） | D12 P1–P8 |
| `wiki/raw/task_issue-368_sa3_impl.md` | 技能固定产物 | 本报告 |

DENY LIST 核对（实测零 diff / 零改动）：`packages/doc-runtime/src/read.ts`、`src/carrier.ts`、其余 `src/*`、
`test/issue-368-window-read-contract-red.test.ts`、`test/` 其余既有测试、`packages/namespace-*`、`packages/vfsl`、
`docs/**`、`CONTEXT.md`、wire/持久化/诊断面——全部未触碰（`git status` 仅显示上表路径；`git diff --name-only` 对
read.ts/carrier.ts/契约文件为 0 行）。临时诊断文件（探针测试 + `.scratch` 探针脚本）已删除，`git status` 无残留。

## Verification

| Command | Result | Evidence |
|---|---|---|
| `NODE_OPTIONS=--conditions=nomicore-source npx vitest run <契约文件> --typecheck.enabled=false`（实现前） | **1 failed file；39 failed / 6 passed（45）**；红因 100% = `typeof ns[export] === 'function'` 能力缺失 | 复现 SA6 §13 基线；无 fixture/TypeError 类失败 |
| 同上（实现后） | **2 suites passed；56/56**（契约 45 + pins 11） | `Test Files 2 passed (2) / Tests 56 passed (56)` |
| `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/doc-runtime/test/issue-368-window-read-design-pins.test.ts --typecheck.enabled=false`（实现前） | **11 failed / 0 passed**；11 条红因统一 = `W1 能力缺口：…未导出 readArrayWindowAtPath / readMapWindowAtPath`（入口存在性断言在 `not.toThrow` 包装之外，红因不混入包装断言） | pins 文件红灯纪律（D12） |
| 同上（实现后） | **11/11 passed** | P1–P8 全绿（含 P7 own 键集） |
| `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/doc-runtime`（含 typecheck） | **34 files passed；729 tests passed；Type Errors: no errors** | 对比 SA6「契约在场」基线 713 用例：+11 pins +2 值守卫 +3 类型守卫 = 729；负控 NC1–NC6 保持绿 |
| `npx tsc -p packages/doc-runtime/tsconfig.json` | **exit 0**，零输出 | 受影响 package typecheck（含 `test/**/*.ts`，pins 文件在内） |
| `pnpm typecheck`（root，14 个 tsconfig） | **exit 0**；`grep -c "error TS"` = 0 | 设计 §12 AC6 / 包 AGENTS「公共类型变更须跑 root typecheck」 |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm test`（root，`vitest run --typecheck`） | **exit 0；380 files passed；4445 tests passed；Type Errors: no errors**（~607s） | 纯加法核算：4390（SA6 既有全绿）+ 39（契约红转绿）+ 11（pins）+ 2（值守卫）+ 3（类型守卫）= 4445；文件 379 + 1（pins）= 380 |
| 突变探针（临时改 `window.ts` 后还原，sha256 前后一致 `7c765939…`） | 4/4 突变被捕获：① D8 静默跳项 → P1/P2/P2b/P6b/P7 红（契约 45 仍绿 = SA2-F1 伪绿通道实证）；② non-finite 进 number 组 → P2/P2b 红；③ 平局锚随 dir 翻转 → 8 红；④ UTF-16 码元序 → P8 + 契约 A7 红 | pins 有牙（SA2-F1 阻断最小集敏感性直证） |

静态生成/check：本票为纯读原语、schema/wire 零接触（设计 §1 非目标、§11 DENY），**无 `pnpm generate` /
`schema:check` 适用面**；设计明确指定并在上表执行的静态检查 = 包级 + root typecheck。

## Deferred verification

- root 全量测试与最终动态验证归 SA7（上表 root `pnpm test` 为设计 §12 AC6 的补充证据，不替代 SA7 复核）；
- SA4 复核清单移交项：复制集逐函数对账（出处标记）、D3/D4/D5/D6/D7/D8 实现与设计逐项一致、P1/P2 期望核对、
  透传 message 非空、`noUncheckedIndexedAccess` 收窄（已实现，`enumerateMapCandidates` 的 Y.Map `get()` 结果收窄）；
- W2（#369）/W3（#370）零涉及（无 lease `readArray`/`readMap` 公共面、无 schema 通道、无 registry 透传）；
- follow-up（设计 §13）：read.ts 冻结解除时评估抽共享模块消复制；partial-selection 排序优化；W2 对账 undefined 值键条目空间；
- 合同 B-5 允许的额外字段（`truncated`/`kept/total`）v1 未携带——设计 D9 明示，W2 结算面不预占。

## Deviations or blockers

无阻塞。两处 **pins 观察面完成**（期望值/语义断言零改动、不触 SA6 契约、不改任何 D 决策）：

1. **P2 以 `depth: 0` 观察完整键序**。D12-P2 未点名预算轴；实测（本 pin 内建断言 + 临时探针）无预算折叠时，
   尾组首项 q1（`{score: NaN}`）入选即被 D8 fail-fast 拦下 → `{ok:false, code:'PATH_NOT_ALLOWED', path:['tasks','q1']}`，
   D12 期望的完整键序**不可作为 `ok:true` 观察**。`depth: 0`（ADR-0024 同形空壳折叠）不读取值、不参与排序键分类，
   故键序观察与 D12 逐条一致（`[n1,n2,s1,q1,q2,q3,q4,q5]` / desc 翻转组内序 / n=5 边界），杀伤面完整（mutation-② 实测红）。
   该 pin 同时内建「无预算 → fail-fast 至 q1」断言作 D8 交叉锚与折叠理由的可执行记录。
2. **P2b 以「可物化前缀 + 尾组首项 fail-fast 身份」观察**。数组面排序键 = 项值本身，非有限标量入选后物化必响
   （D8/NC5 同源），D12 的完整序列 `[2,0,5,1,3,4]` 同样不可作为 `ok:true` 观察。pin 改以：n=1/2/3 的升/降序精确条目
   （asc 首位 = 下标 2、desc 首位 = 下标 0——即 D12 明示杀伤面「±Inf 归 number 组则 asc 首位变 3 / desc 首位变 4」）
   + n=4/6 的尾组首项 fail-fast 身份 `['arr',1]`（尾组两方向同位、不静默跳项/不补位）。语义断言与 D12 同基（同一有序基的
   可观察投影），mutation-② 实测红。

上述两点已按 D12 末段纪律记录为**设计观察面缺口**（fixture 期望本身不可直接观察，非语义分歧）；SA3 未临场修改期望值、
未改设计/ADR/CONTEXT，交由 SA4/SA7 复核判定是否需要 SA1 回写 D12 文本。其余 P1/P3–P8 与 D12 逐字一致。

## Suggested commit message

```
feat(doc-runtime): ADR 0028 缝 1 载体级窗口原语（issue #368 W1）

- 新增 src/window.ts：readArrayWindowAtPath / readMapWindowAtPath
  （readLogicalValueAtPath 姊妹、schema 无关）——类型组总序（number → string →
  不可比尾组）× dir 仅翻转组内序 × 身份锚 asc 恒定；统一条目列表（{index|key,value}）；
  组合式 depth（每项 ≡ 同预算逐项姊妹读）；零物化（未入选子树零读取）；
  三稳定码 WINDOW_TARGET_ABSENT / WINDOW_CARRIER_MISMATCH / WINDOW_OPTIONS_INVALID
  响亮不抛 + 投影域透传 PATH_NOT_ALLOWED（D8 fail-fast、无半窗、无跳项、无补位）。
- 公共面纯加法：index.ts 2 值导出 + 13 类型名目；守卫两测试逐导出记账。
- 必选设计钉死项可执行锚 issue-368-window-read-design-pins.test.ts（P1–P8）；
  read.ts 零 diff（复制件带 read.ts@36a73bb 出处标记）。
- 验证：SA6 红灯契约 45/45 绿、pins 11/11 绿、包级/root typecheck exit 0、
  root pnpm test 380 files / 4445 passed / 0 failed / no type errors。
```
