# SA3 Implementation Report — issue #349 条件写端到端：mutateData 透传、诊断 rejected 与写序列器竞争证明（guard III）

- Role: mabf-sa3（implementation，iteration 0）
- 基线：HEAD `61e2daa37e21b467e7ce130d5c4db7be38bde982`（#347 合并点）；worktree `/home/wangjian/nomicore-fix-issue-349`；分支 `mabf/issue-349`
- 设计依据：`wiki/raw/task_issue-349_design.md`（iteration 1，SA2 verdict **approve**）
- 契约依据：`wiki/raw/task_issue-349_sa6_contract.md`（approve；§12.2–§12.6 冻结 K/L/N/D/NC 用例表）
- 结论：**零生产改动**兑现全部冻结用例——新增单文件 17 例（K1–K6 / L1–L4 / N1 / D1–D2 / NC1–NC4），全部在 HEAD 绿（无红相，SA6 §13 诚实声明）；聚焦、目录、根门槛全部通过。

## Inputs consumed

| 输入 | 用途 |
|---|---|
| `wiki/raw/task_issue-349.md` | Host brief：issue #349 正文、AC1–AC8、What to build |
| `wiki/raw/task_issue-349_design.md` | 本轮被执行的批准设计（§7 D1/D2/D3/D4/D5、§11 ALLOW/DENY、§12 断言纪律） |
| `wiki/raw/task_issue-349_sa2_review.md` | iteration 1 verdict approve；F1/F2 核销与 N1'/N2' 实现期提醒 |
| `wiki/raw/task_issue-349_sa6_contract.md` | §12.2–§12.6 冻结用例表（用例 ID / 最小输入 / 可观察断言）；§12.0 口径；§4/§14 runner 基线 |
| `wiki/raw/task_issue-349_relevant_decisions.md`、`_conflict_report.md` | SA8 verdict clear；Required actions #1–#4（零生产改动、根门槛收口、冻结面、落位） |
| Issue #349 comments | 无（dispatch 明示 REST 预读为空）；无 owner 反馈要求 → 无 §4 映射行 |
| 源码锚点（只读核对） | `packages/namespace-runtime/src/{runtime.ts,write.ts,sequencer.ts,diagnostic.ts,close.ts,status.ts}`、`packages/doc-runtime/src/mutation.ts`、`packages/namespace-diagnostic-log/src/{adapters/memory.ts,record.ts,projection/input.ts}`、`packages/persistence/src/{contract.ts,lifecycle.ts}` |
| 既有测试先例（只读复用） | `issue-347-guard-passthrough-red.test.ts`（fixture/断言口径）、`sequencer-slotkind-close-barrier.test.ts`（seam 注入先例）、`runtime-mutate-root-sequencer.test.ts`（notifier 门）、`runtime-close-lifecycle.test.ts`（close 排空窗口） |

## Existing worktree reconciliation

- 实现开始前无 `wiki/raw/task_issue-349_sa3_impl.md`，无未提交实现；`git status` 仅含 Host 预置 wiki 产物（brief / design / sa2 / sa6 / relevant_decisions / conflict_report）。
- 无过时或冲突的既有实现需要修正；本轮为首次落地，全部用例一次写就（见 §Verification：首跑 17/17 绿——与设计 §3/§7 D3「HEAD 已全绿、无红相」一致，红灯升级路径未被触发）。
- 冻结面复核：`packages/namespace-runtime/test/issue-347-guard-passthrough-red.test.ts` 经 `git diff --quiet` 确认**逐字节未改**（NC5）；`vitest.config.ts`、`tsconfig*.json`、`package.json`、`pnpm-lock.yaml` 均未触碰。

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/namespace-runtime/test/issue-349-guard-e2e-competition.test.ts` | §7 D1（落位裁决）/ D2（K4 seam）/ D5（fixture 与结构）；§11 ALLOW LIST 第 1 行；SA6 §12.1 冻结路径 | **新建**：17 用例 + fixture（memory persistence + 包内 seam + K4 slotMetrics / L4 notifier 门 / L3 hostile Proxy），断言逐条按 SA6 §12.2–§12.6 冻结口径；文件头注引用 SA6 用例 ID 与 ADR 行号 |
| `wiki/raw/task_issue-349_sa3_impl.md` | skill 固定产物（实现报告） | 本报告原位写入（此前不存在） |

**生产面改动：零。** `packages/namespace-runtime/src/**`、`packages/doc-runtime/src/**`、诊断包、`domains/**`、`apps/**` 与全部 DENY LIST 路径逐字节未改（`git diff --name-only` 为空；`git status --porcelain` 仅列出新测试文件与 Host 预置 wiki 文件）。

## SA2 Finding落实

| Finding ID | Implementation | Result |
|---|---|---|
| F1（MAJOR）：typecheck 覆盖机制文本更正 | 无实现动作需要（设计已更正文本；tsconfig 在 DENY LIST，未以「补 test include」为名改动任何 tsconfig）。新文件类型检查覆盖由 vitest typecheck 程序承担并经运行输出实证 | **已核实**：4 次 vitest 运行输出均含 `Type Errors no errors`（含新文件入程序后的首跑） |
| F2（MAJOR）：诊断 log 构造钉死（`updateCapture:true`） | 文件内 10 处 `createBoundedMemoryDiagnosticLog` 全部在**用例调用点**构造 `({ inputPolicy: 'digest', updateCapture: true })`；`setup()` helper 内零 log 构造（经 `setup({ log })` 注入），与 #347 L187/L242/L274 同款 | **已落实**：`grep` 实测 10/10 命中钉死构造、0 处其他构造；K1⑤/K5④⑥/K6 的 `effect:'update'` 与 `payloadLength===updates[0].length` 断言在首跑即满足（无伪回归） |
| N1'（实现期提醒）：统一 log 构造约定 | 含 L1/L2（断言「无 transaction/validation 记录」）与 NC4（断言 input-snapshot 记录内容）在内的全部 log 用例统一钉死构造 | **已落实**：同一文件内不存在第二种 log 构造约定 |
| N2'（实现期提醒）：typecheck 门存活信号留档 | 保留各次运行的 `Type Errors no errors` 行（本报告 §Verification） | **已落实** |

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/namespace-runtime/test/issue-349-guard-e2e-competition.test.ts` | §11 ALLOW LIST 第 1 行（新建：K1–K6/L1–L4/N1/D1–D2/NC1–NC4 共 17 用例 + fixture 扩展） | 本票唯一实现产物：把 SA6 冻结契约固化为可执行验收语料 |
| `wiki/raw/task_issue-349_sa3_impl.md` | skill 固定输出（实现报告原位写入） | SA3 实现证据与对账 |

未新增其他路径；未修改 SA6 `issue-347-*` 冻结锚、既有 sequencer/lifecycle 测试、任何 `src/**`、配置或文档。

## 用例落位与 AC 映射（SA6 §12.2–§12.6 / §12.8）

| 组 | 用例 | 关键断言（与冻结契约逐条对齐） |
|---|---|---|
| K1–K6 | 竞争与 FIFO 独占 | 双写竞争（后到者带码拒绝、`updates===1`、终值=胜者、诊断 2 条 committed/validation）；拒绝零写入隔离；三写交错 `[ok,ok,拒绝]`、终值=中间写；K4 seam 槽样本 `['S','S','S']` + `queueDepthAtStart [3,2,1]`；批量竞争单事务 + 单条 rejected；批量成功单条 update bytes |
| L1–L4 | lifecycle 接纳门次序 | closing/closed 期 `RUNTIME_WRITE_DISABLED` 零写入、无 validation/transaction 记录；hostile Proxy 访问计数 `===0` + acceptance 记录 `input.capture==='not-accessed'`；close 排空窗口（已接纳 guarded 写提交后挂 S6、closing 新写拒、放行后 ok:true、release 已发生、记录 1 acceptance + 1 committed） |
| N1 | 非 fatal 与能力保留 | `fatal===null`、`rootWrite.enabled===true`、后续无 guard 写 ok、重读重试 ok、unhandledRejection 探针 0 事件 |
| D1–D2 | 诊断透传与等价 | 装配侧恰 1 条 validation/rejected（issue 带码、record 级 `code===undefined`、`issues.policy==='full'`）；未装配侧 `rWith===rWithout` 逐字相等 + 两侧零写入 + 成功侧同 ok |
| NC1–NC4 | 负控锚（敏感度） | 无 guard 幸福路径；guard 满足；元素 guard 形状错误无码零写入；`equals` 非有限数 / undefined 值键 S3 分层先拒（stage=input-snapshot、record 顶层码） |

AC1–AC8 全部有对应用例；AC8 门槛在 §Verification 收口。

## Verification

| # | Command | Result | Evidence |
|---|---|---|---|
| V1 | `NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run packages/namespace-runtime/test/issue-349-guard-e2e-competition.test.ts` | **exit 0**：`Test Files 1 passed (1)`、`Tests 17 passed (17)`、`Type Errors no errors`（777ms） | 新文件首跑即全绿（无红相，与设计 §3 Step 5 一致，红灯升级路径未触发） |
| V2 | `… vitest run <新文件> packages/namespace-runtime/test/issue-347-guard-passthrough-red.test.ts packages/namespace-runtime/test/runtime-mutate-root-sequencer.test.ts packages/namespace-runtime/test/runtime-close-lifecycle.test.ts` | **exit 0**：`Test Files 4 passed (4)`、`Tests 46 passed (46)`、`Type Errors no errors`（1.61s） | 聚焦门槛：新 17 + #347 E1–E7 7 + sequencer 12 + close-lifecycle 10 = 46（基线 29 全绿保持） |
| V3 | `… vitest run packages/namespace-runtime/test` | **exit 0**：`Test Files 51 passed (51)`、`Tests 396 passed (396)`、`Type Errors no errors`（18.77s） | 目录门槛：45+1 `.test.ts` + 5 `.test-d.ts` = 51 文件（设计 §12 AC8 计数口径）；379+17 = 396 用例 |
| V4 | `pnpm typecheck` | **exit 0** | 根门槛 14 个 `tsc -p` 项目顺序编译全绿（该门只覆盖各包 `src/**`；新文件覆盖来源见 F1 行） |
| V5 | `pnpm test`（= `vitest run --typecheck`） | **exit 0**：`Test Files 350 passed (350)`、`Tests 3703 passed (3703)`、`Type Errors no errors`（616.48s） | 根门槛收口（SA8 RA#2 / ADR 0025 L90）：全仓零既有红——无需按设计 §7 D4「全仓基线留档」登记无关既有红 |
| V6 | `git status --porcelain` / `git diff --name-only` / `git diff --quiet -- packages/namespace-runtime/test/issue-347-guard-passthrough-red.test.ts` | 无 tracked 改动；#347 锚未改 | 零生产改动 + NC5 冻结面保持 |
| V7 | `grep` 纪律审计：`skip/only/todo` 0 命中；`createBoundedMemoryDiagnosticLog` 10/10 钉死构造；17 个 `it(` 与冻结用例 ID 一一对应 | 通过 | 断言纪律（设计 §12）与 NC6（K4 无杂槽）自查 |
| V8 | 新文件连续重跑 ×2（同一命令，V1 之后） | **各 exit 0**：`1 passed (1)` / `17 passed (17)` / `Type Errors no errors` | 确定性（SA6 §7/§9：FIFO 由 run-to-completion + promise 链保证，无墙钟竞态）；新文件累计 **3 次连续全绿**、结果一致 |

## Deferred verification

- 独立验证与最终裁决由 SA4（code review）/ SA7（dynamic verification）承担本报告不重复；本票无 SA5 面。
- 未做生产实现「反向 mutation」实验——SA6 §13 明确断言敏感度由 NC1–NC4 负控 + 反向退化推理承担，且 SA8 RA#1 禁止触碰产线；本报告不扩展该职责。
- 无其他遗留：根门槛已达全绿，无需以「无关既有红」登记项收尾。

## Deviations or blockers

- **无阻断项**；零生产改动约束未被触发例外（无 K/L/N/D 红灯，无需 §7 D3 升级）。
- 实现级命名说明（不改变任何冻结语义）：设计 §7 D5 的 fixture 扩展点 `setup({ observability })` / `setup({ gate })` 在实现中取名为 `setup({ samples })` / `setup({ notifyGate })`——设计仅描述注入语义（seam 输入侧透传 `replicationObservability`；notifier 先 await 门再 `saveDoc`），未冻结 helper 标识符；注入内容与断言口径逐条不变。
- L4 release 观察点采用设计 §7 D5 N1 备选 (a)：`handle.isReleased === true`（经窄类型读取，`lifecycle.ts` L163 getter）；teardown 二次 `release()` 幂等安全。
- 已知上游文本错误（设计 §5 已登记）：SA6 §14 L335–336 称 `packages/namespace-runtime/tsconfig.json` 含 `test/**` 与磁盘事实不符；本实现未据此改动任何 tsconfig（DENY LIST），真实覆盖机制见 F1 行。
- MINOR 无未处置项；`message` 断言按设计 §12 口径只锚稳定码前缀（K1/K5/D1）与 K3 实际值文本 `'closed'`，不收紧格式细节。

## Suggested commit message

```
test(#349): 条件写端到端验收契约——mutateData 透传、诊断 rejected 与写序列器竞争证明面（guard III）

- 新增 packages/namespace-runtime/test/issue-349-guard-e2e-competition.test.ts（K1–K6/L1–L4/N1/D1–D2/NC1–NC4，共 17 例）
- 竞争：双写/三写/批量 {ops,guard} 竞争 + K4 seam 槽样本 queueDepthAtStart [3,2,1]（TOCTOU 消除证明面，ADR 0025 L49/L51）
- 透传与诊断：稳定码 + issue.path 同源透传；装配侧 validation/rejected 单条记录、未装配侧逐字等价（ADR 0025 L58/L60、ADR 0011）
- lifecycle：closing/closed 接纳门次序不变（hostile Proxy 零访问、acceptance/not-accessed）；close 排空窗口证明
- 生产实现零改动（ADR 0025 L60）；验证：聚焦 4 文件 46 例、目录 51 文件 396 例、根 typecheck exit 0、根 pnpm test 350 文件 3703 例全绿
```

（仅供 Controller 选择提交信息；SA3 不执行 commit/push/PR。）
