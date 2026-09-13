# SA7 动态验证报告 — issue #349 条件写端到端：mutateData 透传、诊断 rejected 与写序列器竞争证明（guard III）

- Role: mabf-sa7（dynamic verification，iteration 0）
- 基线：HEAD `61e2daa37e21b467e7ce130d5c4db7be38bde982`（#347 合并点）；worktree `/home/wangjian/nomicore-fix-issue-349`；分支 `mabf/issue-349`
- 被验证对象：SA3 实现 = 单个新增测试文件 `packages/namespace-runtime/test/issue-349-guard-e2e-competition.test.ts`（17 用例，806 行，sha256 `76021f34…36ba`）+ 零生产改动
- 验证范围：SA4 §11 四项动态验证项（V1–V5 真实性 / K4·L4 确定性与时长 / D2 目录稳定性 / typecheck 门存活）+ 本票 dispatch 点名的 guard 竞争、lifecycle、确定性轮询与 typecheck 行为
- **Verdict：`approve`**（全部动态证明通过；1 项非阻断精确化 finding 见 §8/§Deviation，供 Controller 转告契约文本修订）

---

## 1. Inputs

| 输入 | 用途 |
|---|---|
| `wiki/raw/task_issue-349.md` | brief：AC1–AC8、What to build（零生产改动预期） |
| `wiki/raw/task_issue-349_design.md`（iteration 1，SA2 approve） | §7 D1–D5 落位/门槛/fixture/时序论证；§8 数据流「无变化」声明；§13 R1–R5 风险 |
| `wiki/raw/task_issue-349_sa6_contract.md`（approve） | §12.0–§12.9 冻结用例表（K1–K6/L1–L4/N1/D1–D2/NC1–NC4）；§13 无红相声明 |
| `wiki/raw/task_issue-349_sa3_impl.md` | V1–V8 声明（本报告逐条独立复现 V1–V5） |
| `wiki/raw/task_issue-349_sa4_review.md`（approve） | §11 后续动态验证项（本报告的直接验证清单）；§12 M-1–M-5 |
| `wiki/raw/task_issue-349_sa2_review.md`、`_relevant_decisions.md`、`_conflict_report.md` | F1/F2 口径、SA8 RA#1–#4、冻结面清单（识别不可变边界） |
| Issue #349 comments | 无（REST 预读为空，dispatch 明示）；无 owner 反馈要求 |
| 实现产物 | `packages/namespace-runtime/test/issue-349-guard-e2e-competition.test.ts` 全文精读（fixture/seam/断言逐条与冻结契约对照） |

## 2. Runtime environment

| 项 | 值 |
|---|---|
| OS / 机 | Linux，4 核（`nproc`=4） |
| node / pnpm / vitest / tsc | v24.13.0 / 10.28.2 / v3.2.7（vitest 3.2.7）/ typescript 5.9.3 |
| 依赖 | worktree `node_modules` 已物化（SA6 §4 同源安装），本轮零新增安装 |
| 运行入口 | `NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run <path>`；根 `pnpm test` = `vitest run --typecheck`；根 `pnpm typecheck` = 14 个 `tsc -p` 顺序编译 |
| 关键配置事实 | `vitest.config.ts`：include `packages/*/test/**/*.test.ts`、`maxWorkers: 1`、`typecheck.enabled: true` + `typecheck.include: ['packages/*/test/**/*.test-d.ts', …]` + `typecheck.tsconfig: './tsconfig.typecheck.json'`（该程序 include `packages/*/test/**/*.ts`）；无 `testTimeout` 覆盖 → vitest 默认 **5000ms** |
| 负载场景 | 整机负载 = 根 `pnpm test`（后台并发）+ 4 × 75s CPU burner；实测 load average 峰值 **1.41**（4 核） |
| 纪律 | 未修改任何生产代码/配置/冻结锚；唯一临时改动 = typecheck 门存活探针（§7，已还原并复验）；无服务、无端口、无 nohup/setsid/PID 文件；后台作业全部回收（§9） |

## 3. Changed Data Flow Verification

**设计声明：无数据流变化**（design §8「接口/状态机变化：无」「运行时数据流：无变化」；SA8 RA#1 零生产改动）。本轮动态核验该前提本身成立：

| Route | Design change | Runtime driver | Observed hops | Expected result | Actual result | Verdict |
|---|---|---|---|---|---|---|
| 全部生产路线 | 无（零生产改动） | `git diff --name-only HEAD` = 空；`git diff --quiet HEAD -- issue-347-guard-passthrough-red.test.ts` 通过；`git status --porcelain` 仅新测试文件 + wiki 产物 | — | tracked 零改动、#347 锚逐字节不动 | 实测一致（§9 G0；收尾复验 G9） | ✓ |

→ 无「changed」路线需要证明「按设计变化」；全部验证力量投入 §4 保持性证明。

## 4. Preserved Data Flow Verification

依据 design §8「测试所观测的既有流」逐条以新测试文件为运行时驱动取证（基线 = SA6 §5 probe P-A…P-F 逐字留档 + §12 HEAD 预期全绿；本轮观察 = V1' 起 4 次聚焦全绿 + 目录/根门槛全绿）：

| Route | Preserved invariant | Runtime driver | Baseline observation | Current observation | Verdict |
|---|---|---|---|---|---|
| 受控写（单操作/批量 + guard） | mutateData → 接纳门 → `'S'` 槽 → 槽内 guard 评估（解析后分叉前、单 Yjs 事务）→ R9 同源透传 issues → S6 notifyDirty；胜者落盘、败者零写入 | K1/K3/K5/K6（`Promise.all` 背靠背） | probe P-A/P-D/P-E：r1 ok / r2 带码；updates 1；终值=胜者 | 4 次聚焦运行 + 目录 + 根全绿：K1④ updates===1、K3 message 含 `'closed'`、K5④ 拒绝批零写入终态仅胜者批三项、K1⑤/K5④/K6 `payloadLength===updates[0].length`（单事务不变量） | ✓ |
| 码与 path 透传 | `issues[0].code === MUTATION_GUARD_MISMATCH`（字面量 + doc-runtime 导出同源双锚）、`issue.path` 深等 guard 路径 | K1②/K2/K5②/D1 | probe P-A/P-B | 全绿（V1' verbose 逐用例 ✓） | ✓ |
| 诊断变更尝试记录 | 槽 settle → emitSlot → 内存 adapter 同步入队；装配侧恰 2 条（transaction/committed + validation/rejected，record 级无码、issues.policy full、items[0] 带码带路径）；未装配侧零记录且业务结果逐字等价 | D1/D2、K1⑤/K5⑥、L1–L3 | probe P-B：`rWith===rWithout` 逐字相等 | 全绿；D2 双等值（deep + JSON 文本）在 4 次聚焦 + 目录并发上下文（SA4 §11#3）+ 根全绿中恒绿 | ✓ |
| FIFO 槽级记账 | enqueue 记账、槽 settle 后 flush、sink 只读观测；窗口恰 3 个 `S` 样本、`queueDepthAtStart [3,2,1]`（深度单调递降 = 严格串行、无第三写插入 guard 评估→提交间隙） | K4（seam `replicationObservability{stageClock, slotMetrics}`） | probe P-E：`['S','S','S']` / `[3,2,1]` | 全绿 4 次（clean 2ms / 负载 6ms），样本序=入队序恒成立 | ✓ |
| lifecycle 接纳门 | `lifecycle!=='ready'` → 同步零入队即时拒绝（不读输入）；closing 期拒绝 message 含 `closing`、closed 期含 `closed`；hostile Proxy 三 trap 访问 `===0`；无 validation/transaction 记录；acceptance 记录 `code=RUNTIME_WRITE_DISABLED`、`input.capture='not-accessed'` | L1/L2/L3 | probe P-C：proxyGets 0 | 全绿（L3 调用不抛、`accesses()===0`） | ✓ |
| close 排空 | close() 同步进 closing → 已接纳槽无条件排空 → 队尾 barrier release 恰一次 → closed；排空窗口内已提交值可读、closing 新写即时拒 | L4（notifyGate deferred） | probe P-F | 全绿：窗口内读值 `'reviewing'`、放行后 `p={ok:true}`、`isReleased===true`、1 update + 1 notifier、记录 = 1 acceptance + 1 transaction/committed | ✓ |
| 非 fatal / 能力保留 | 拒绝后 `fatal===null`、`rootWrite.enabled===true`、后续无 guard 写 ok、重读重试 ok、零 unhandled rejection | N1（显式 unhandledRejection 探针） | probe P-A | 全绿（探针 events `[]`） | ✓ |
| 负控锚 | NC1 无 guard 幸福路径 / NC2 guard 满足（敏感度锚）/ NC3 元素 guard 形状错误无码零写入 / NC4 S3 分层（input-snapshot 带顶层码） | NC1–NC4 | SA6 §6 全绿 | 全绿 4 次（双向退化捕获面在位） | ✓ |

## 5. State Machine Verification

| Initial state | Trigger | Expected transitions | Observed transitions | Forbidden transitions absent | Verdict |
|---|---|---|---|---|---|
| `ready` | `close()` 调用（L1） | 同步 → `closing`（close Promise 结算前即可观察）→ 排空 → `closed` | L1 断言 `close()` 返回前 `lifecycle==='closing'`；`await cp` 后 `'closed'` —— 全绿 | closing 期无任何 `validation`/`transaction` 记录（guard 未被评估）；零 update/notifier | ✓ |
| `ready` | 已接纳 guarded 写挂于 S6 + `close()`（L4） | 已接纳槽排空 ok → barrier release 恰一次 → `closed`；closing 期新写走接纳门即时拒绝（不入队） | 窗口内已提交值可读；closing 新写 `RUNTIME_WRITE_DISABLED`；放行后 `p={ok:true}`、`isReleased===true`、终态 `closed` | 排空窗口无第二笔受控写插入（notifier 恰 1、update 恰 1）；release 未重复（teardown 二次 release 幂等无异常） | ✓ |
| `closed` | `mutateData`（L2/L3） | 即时领域拒绝（`ok:false` + `RUNTIME_WRITE_DISABLED` 前缀 + 文案含 `closed`）；输入零访问 | L2/L3 全绿；hostile Proxy `accesses()===0`、调用不抛 | 无复活写路径（字节不变、0 update、0 notifier） | ✓ |
| 空 sequencer 队列 | 三笔受控写背靠背 `Promise.all`（K3/K4） | 严格 FIFO：槽执行序 = 入队序；`queueDepthAtStart [3,2,1]`；第二写 guard 见第一写已提交值、第三写见第二写值 | `[ok, ok, 带码拒绝]`、终值 `'closed'`、updates 2、样本 `['S','S','S']`/`[3,2,1]` | 无并行槽 / 无跳槽 / 无「guard 评估→提交」间隙插写（深度单调递降 + allSlotKinds 无杂槽，NC6） | ✓ |
| guard 满足态 | 单操作/批量 + guard（NC2/K6/D2③） | `{ok:true}` + 单事务落盘 | 全绿（updates 1、notifier 1、三项落盘） | 无「一律拒绝」退化（NC2 红）；无部分落盘 | ✓ |
| guard 不满足态 | 单操作/批量 + guard（K1/K2/K5/D1） | `{ok:false}` 单 issue 带码、零写入、非 fatal | 全绿（字节不变、0 update、0 notifier、fatal null、后续写 ok） | 无「一律放行」退化（K1/K5 红）；拒绝不升 fatal（N1 红） | ✓ |

## 6. Error and Cleanup Flow

- **错误分类**：全部被断言失败均为领域拒绝（`ok:false` + issues），非异常通道 —— L3 hostile Proxy 输入**不抛**（若接纳门后移即 trap 抛出/计数>0，实测 0）；形状错误（NC3）与 S3 分层（NC4，`MUTATION_INPUT_NOT_PLAIN_DATA`、record 顶层码、stage=input-snapshot）分层正确。
- **fatal 通道**：N1 断言不触发（`fatal===null`、`rootWrite.enabled===true`），显式 unhandledRejection 探针 0 事件（`setImmediate` 冲刷后 `[]`）。
- **cleanup/quiescence**：每用例 teardown（`handle.release()` + `writer.dispose()`）；L4 close 后 teardown 二次 release 幂等（实测无异常，`lifecycle.ts` L157–161）；L4 门 Promise `finally` 恰一次放行（用例 5ms/负载 16ms 内完成，无挂死）。
- **retry/restart 不复活旧路径**：N1 拒绝后重读旧值重构造 guard → `{ok:true}`（新值 `'published'` 落盘）；K2 stale guard 再拒仍零写入。
- **伪成功检查**：拒绝路径全部三件套钉死（`Y.encodeStateAsUpdate` 字节不变 + 0 update 事件 + 0 notifier）。

## 7. Temporary Diagnostics（动态日志协议收尾）

本轮**未注入任何 `[SA7-DATAFLOW]` 运行时日志**——既有测试断言面（seam 样本、诊断 records、update/notifier 计数、lifecycle 状态）已足够观察全部关键跳点。

唯一临时诊断 = **typecheck 门存活探针**（SA4 §11#4 / SA2 N2' 要求的对照实验，属临时 fixture 修改而非日志）：

1. **添加**：文件尾追加 2 行——注释行（含 `[SA7-DATAFLOW]` 标记）+ `const __SA7_TYPECHECK_GATE_PROBE: number = 'type-error-probe';`（纯类型层错误，esbuild 转译不受影响 → 运行时 17/17 仍绿，见 GATE-2 的 396/396）。
2. **对照结果**（详见 §9 GATE-1…GATE-4 与 §10 F-1）：目录级选择（含 `.test-d.ts`）→ `TypeCheckError … ❯ issue-349-guard-e2e-competition.test.ts:809`、`Errors 1 error`、**exit 1**；`.test.ts`-only 聚焦选择 → tsc 未运行。
3. **删除**：从 `.scratch/issue-349-sa7/testfile.backup.ts` 原样还原；`sha256sum` 与基线 `76021f34…36ba` **逐字节一致**（806 行）。
4. **移除后复验**：聚焦新文件重跑 → 17/17 绿、`Type Errors no errors`、exit 0（§9 G8）；`grep -rn "SA7-DATAFLOW\|__SA7_TYPECHECK_GATE_PROBE"` 于 `packages/ apps/ domains/`（代码面）**0 命中**（wiki/raw 仅命中其他任务历史报告的既有文本，非本轮添加）；`git diff --name-only HEAD` 仍为空。
5. 备份目录 `.scratch/issue-349-sa7/` 在还原核验后已整体删除（`.scratch` 非 gitignored，删除使工作树回到本席启动前状态）；`pgrep node` = 0（无遗留进程）。

## 8. Dynamic Evidence Matrix

| Source | Requirement or risk | Driver | Expected | Actual | Evidence | Result | Suggested routing |
|---|---|---|---|---|---|---|---|
| SA4 §11#1 | SA3 V1–V5 运行输出真实性（SA4 纪律不运行） | V1'–V5' 同命令重跑 | 聚焦 1 文件 17 例 / 4 文件 46 例 / 目录 51 文件 396 例 / 根 typecheck exit 0 / 根 test 350 文件 3703 例，各含 `Type Errors no errors` | **逐项复现一致**：V1' 1/17 exit 0（782ms）；V2' 4/46 exit 0；V3' 51/396 exit 0；V4' exit 0；V5' 350/3703 exit 0（608.11s） | §9 G1–G5 | PASS | — |
| SA4 §11#2 | K4/L4 poll 类断言负载下确定性与时长（design R2/R3） | 新文件连续 4 次运行：1 clean + 1 随根测试并发 + 2 整机负载（4 CPU burner + 根测试，load avg 峰值 1.41） | 结果逐次一致；L4 总时长远低于默认 testTimeout（5000ms） | 4/4 全绿且结果同构；L4 = **5ms（clean）/ 16ms（满载）**，K4 = 2ms/6ms；无间歇红、无超时 | §9 G1/G6/G7 | PASS | — |
| SA4 §11#3 | D2 emitter 等价在完整目录并发上下文中的稳定性 | V3' 目录运行（51 文件并发上下文，且叠加外部负载） | D2 恒绿 | 目录 396/396 全绿含 D2；另 4 次聚焦亦恒绿 | §9 G3/G6/G7 | PASS | — |
| SA4 §11#4 | vitest typecheck 程序对新文件的门存活（SA2 N2'） | 注入临时类型错误对照（探针已还原复验，§7） | 出现类型错误报告且非零退出（失败条件 = 门未覆盖新文件） | 目录级：`Unhandled Source Error: Type 'string' is not assignable to type 'number' ❯ …issue-349…test.ts:809`、`Errors 1 error`、**exit 1**；聚焦含 `.test-d.ts`：同样捕获、exit 1；根级 `pnpm test`：同样捕获（`ELIFECYCLE Test failed`）且 **exit 1** | **门存活、新文件在门内**（强制的目录/根门槛均含 `.test-d.ts` → tsc 程序必运行） | §9 GATE-2/GATE-3/GATE-4 | PASS | — |
| Design §7 D4（F1 修正机制口径） | 「聚焦运行、目录运行与根 pnpm test 都执行该程序检查」 | GATE-1 vs GATE-3 边界定界 | 程序检查被执行 | **精确化**：仅当运行选择含 ≥1 个 `.test-d.ts`（`typecheck.include`）时 tsc 才运行；`.test.ts`-only 聚焦运行不触发 tsc，其 `Type Errors no errors` 行为平凡真（SA3 V1/V2 与 SA6 §4 聚焦基线的该行不能独立证明门覆盖；V3/V5 与 GATE 对照才是覆盖证据） | §9 GATE-1/GATE-2/GATE-3（typecheck 计时仅在前者出现） | PASS（含 finding F-1） | Controller 转告 SA6/SA1 后续票修订契约/设计文本（与 SA4 M-5 同族） |
| SA6 §12.2–§12.6 | 17 条冻结用例全部执行且绿 | V1' verbose 逐用例 | 17/17 | 17 用例 ID 逐一出现且 ✓（K1–K6/L1–L4/N1/D1–D2/NC1–NC4） | §9 G1 | PASS | — |
| SA8 RA#1/RA#3（冻结面） | 零生产改动 + #347 锚逐字节不动 | G0/G9 git 只读核验 | tracked 零改动 | `git diff --name-only HEAD` 空；`git diff --quiet -- issue-347-…` 通过 | §9 G0/G9 | PASS | — |

## 9. Commands and Evidence

全部于 worktree `/home/wangjian/nomicore-fix-issue-349` 执行；`EXIT=` 行为命令真实退出码。

### 门槛复现（SA3 V1–V5 真实性）

| # | Command（缩写） | 关键输出 | 退出码 |
|---|---|---|---|
| G0 | `git status --porcelain` / `git diff --name-only HEAD` / `git diff --quiet HEAD -- …issue-347-guard-passthrough-red.test.ts` | 仅新测试文件 + wiki 产物 untracked；tracked 零改动；#347 锚逐字节一致 | 0 |
| G1 (V1') | `NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run packages/namespace-runtime/test/issue-349-guard-e2e-competition.test.ts --reporter=verbose` | `Test Files 1 passed (1)`、`Tests 17 passed (17)`、`Type Errors no errors`；17 用例逐条 ✓；L4 5ms、K4 2ms；Duration 782ms | 0 |
| G2 (V2') | 同入口 + `issue-347-guard-passthrough-red.test.ts` + `runtime-mutate-root-sequencer.test.ts` + `runtime-close-lifecycle.test.ts` | `Test Files 4 passed (4)`、`Tests 46 passed (46)`、`Type Errors no errors`（2.14s，根测试并发中） | 0 |
| G3 (V3') | 同入口 `vitest run packages/namespace-runtime/test` | `Test Files 51 passed (51)`、`Tests 396 passed (396)`、`Type Errors no errors`（35.81s，外部负载中，typecheck 17.49s） | 0 |
| G4 (V4') | `pnpm typecheck` | 14 个 `tsc -p` 顺序编译，无输出即无错误 | 0 |
| G5 (V5') | `pnpm test`（后台作业） | `Test Files 350 passed (350)`、`Tests 3703 passed (3703)`、`Type Errors no errors`、Duration 608.11s —— 且与本轮聚焦/目录运行及 CPU burner **并发执行**仍全绿 | 0 |

### 确定性（design R2/R3；≥3 次，含整机负载）

| # | 场景 | 负载 | 结果 |
|---|---|---|---|
| G6-2 | 新文件第 2 次 | 根 `pnpm test` 并发（启动期） | 17/17、`Type Errors no errors`、exit 0（782ms） |
| G6-3 | 新文件第 3 次（verbose） | 根测试 + 4 × 75s CPU burner（load avg 0.59→） | 17/17、exit 0（2.01s）；**L4 16ms、K4 6ms** |
| G6-4 | 新文件第 4 次 | 同上（load avg **1.41**） | 17/17、exit 0（1.92s） |

四次（含 G1）结果逐次同构；poll 类断言（`expect.poll` ready/notifier + `waitAttempts` 记录轮询）无一次抖动；L4 最长 16ms ≪ 5000ms 默认 testTimeout（余量 >300×）。

### typecheck 门存活对照（探针在场；SA4 §11#4）

| # | 选择范围 | 关键输出 | 退出码 |
|---|---|---|---|
| GATE-1 | 仅新 `.test.ts`（聚焦） | 运行时 17/17 绿；`Type Errors no errors`；duration 明细**无 typecheck 计时** → tsc 未运行（平凡真，finding F-1） | 0 |
| GATE-2 | `packages/namespace-runtime/test`（目录，含 5 个 `.test-d.ts`） | 运行时 396/396 绿；`Unhandled Source Error: TypeCheckError: Type 'string' is not assignable to type 'number'. ❯ …/issue-349-guard-e2e-competition.test.ts:809`；`Errors 1 error`；typecheck 2.00s | **1** |
| GATE-3 | 新文件 + 1 个 `.test-d.ts`（聚焦） | 同上 TypeCheckError 捕获；`Errors 1 error`；typecheck 1.75s | **1** |
| GATE-4 | 根 `pnpm test`（强制的 RA#2 收口门，后台作业） | 运行时 `Test Files 350 passed (350)`、`Tests 3703 passed (3703)`（类型层探针不影响运行时面）；`Unhandled Source Error: TypeCheckError: Type 'string' is not assignable to type 'number'. ❯ …/issue-349-guard-e2e-competition.test.ts:809:7`；`Errors 1 error`；`ELIFECYCLE Test failed` | **1** |

结论：注入探针在目录级（GATE-2）、聚焦含 `.test-d.ts`（GATE-3）与根 `pnpm test`（GATE-4）三个选择层级均被捕获且非零退出——**强制的 RA#2 收口门对新文件的类型错误 fail-closed，SA4 §11#4 的失败条件（门未覆盖新文件）未发生**。SA4 预期中的字面 `Type Errors` 行在 vitest 3.2.7 呈现为「Unhandled Source Error + `Errors 1 error` + 非零退出」（`Type Errors` 行只统计 `.test-d.ts` typecheck 测试文件的错误），属呈现口径差异，门的失败语义等价成立。

### 收尾复验

| # | 检查 | 结果 |
|---|---|---|
| G8 | 探针移除后聚焦重跑 | 17/17 绿、`Type Errors no errors`、exit 0（777ms，与探针前 V1' 同构） |
| G9 | `sha256sum` 还原一致性 / `grep -rn "SA7-DATAFLOW\|__SA7_TYPECHECK_GATE_PROBE"`（代码面）/ `git diff --name-only HEAD` / `git status --porcelain` / `pgrep -c node` / 备份目录删除 | 与基线 `76021f34…36ba` 逐字节一致；`packages/ apps/ domains/` 0 命中；tracked 零改动；untracked 集与 G0 相同（+ 本报告）；node 进程 0；`.scratch/issue-349-sa7/` 已删 |

## 10. Deviations

- **F-1（非阻断 finding，精确化）**：vitest 3.2.7 的 typecheck 仅在选择集含 ≥1 个 `typecheck.include`（`.test-d.ts`）文件时才运行 tsc 程序；`.test.ts`-only 聚焦运行不触发类型检查，其 `Type Errors no errors` 行为平凡真。因此 SA3 报告 V1/V2 行、SA6 §14 聚焦基线中的该行**不构成**新文件类型覆盖的独立证据；覆盖的真正证据 = 目录/根门槛（选择集恒含 `.test-d.ts`，tsc 实际运行）+ 本轮 GATE-2/3/4 注入对照（exit 1，fail-closed）。design §7 D4「聚焦运行、目录运行与根 pnpm test 都执行该程序检查」对无 `.test-d.ts` 的聚焦运行不成立，建议随 SA4 M-5 一并转告 SA6/SA1 在后续票修订文本。**不影响本票**：AC8 的强制门（根 `pnpm typecheck` + 根 `pnpm test`）实测覆盖新文件且存活。
- 无其他偏离：无一般回归扩面、无生产代码触碰、无断言修改、无 SA9/SA10 面越界。

## 11. Verdict

**approve**。

- SA3 V1–V5 全部声明经独立重跑逐项复现（计数、`Type Errors` 行、退出码全一致）。
- 设计声明「无数据流变化」的零改动前提成立；§4 全部保持性不变量在新测试文件驱动下运行时成立。
- 状态机（lifecycle ready→closing→closed、sequencer FIFO 槽序、guard 两态错误域）转换与关键值正确，禁止转换未出现（closing 期零 guard 评估、零写入、无并行槽、无插写间隙）。
- 错误与清理：领域拒绝不抛、非 fatal、cleanup 到达 quiescence（release 幂等、dispose、探针还原复验）。
- SA4 §11 四项动态验证项全部 PASS（§8）；唯一 finding F-1 为证据解读精确化，非门缺口。
- 临时诊断已删除并复验（§7 G8/G9）；无遗留进程/服务/后台作业。
