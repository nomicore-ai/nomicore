# SA4 实现静态审查 — issue #349 条件写端到端：mutateData 透传、诊断 rejected 与写序列器竞争证明（guard III）

- Role: mabf-sa4（implementation review，iteration 0）
- 被审对象：SA3 实现 = 单个新增测试文件 `packages/namespace-runtime/test/issue-349-guard-e2e-competition.test.ts`（17 用例）+ 实现报告 `wiki/raw/task_issue-349_sa3_impl.md`
- 基线：HEAD `61e2daa37e21b467e7ce130d5c4db7be38bde982`（#347 合并点）；worktree `/home/wangjian/nomicore-fix-issue-349`；分支 `mabf/issue-349`
- 审查依据：SA6 契约 §12.2–§12.6 冻结用例表（approve）、SA1 设计 iteration 1（SA2 approve）、SA2 F1/F2 + N1'/N2'、SA8 conflict_report（clear，RA#1–#4）
- 纪律声明：SA4 未修改任何实现/测试/设计，未运行测试、未启动服务、未 curl、未创建临时进程；全部结论基于源码、配置、Git 只读状态与上游产物的独立核验
- **Verdict：`approve`**（无 BLOCKER / 无 MAJOR；5 项 MINOR 观察见 §12，不阻断）
- `requiresConflictRecheck`：**false**（实现零生产改动、零决策面触碰、冻结面只被断言；未发现新 ADR 冲突风险）

---

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-349.md`（brief：AC1–AC8、What to build、Blocked-by #347） | 已读 |
| `wiki/raw/task_issue-349_sa6_contract.md`（approve；§12.0–§12.9 冻结口径；§13 无红相声明；§14 runner 基线） | 已读 |
| `wiki/raw/task_issue-349_design.md`（iteration 1；§7 D1–D5、§11 ALLOW/DENY、§12 断言纪律、§13 风险表） | 已读 |
| `wiki/raw/task_issue-349_sa2_review.md`（iteration 1 approve；F1/F2 核销；N1'/N2' 实现期提醒） | 已读 |
| `wiki/raw/task_issue-349_relevant_decisions.md`、`_conflict_report.md`（SA8 clear；RA#1–#4；冻结面清单） | 已读 |
| `wiki/raw/task_issue-349_sa3_impl.md`（SA3 报告：零生产改动、17 用例、V1–V8 验证记录） | 已读 |
| Issue #349 comments | 无（REST 预读为空，dispatch 明示）；无 owner 反馈要求 |
| 实现产物 | `packages/namespace-runtime/test/issue-349-guard-e2e-competition.test.ts` 全文 806 行精读 |
| 生产源码独立核验 | `runtime.ts`（seam 校验 L790–816、mutateData 接纳门、emitSlot 接线）、`sequencer.ts`（enqueue 记账/flush/queueDepthAtStart L40–160）、`write.ts`（S1–S7 + R9 L88–230）、`diagnostic.ts`（diagValidation L271–274、emitAttempt/emitSlot L146–190）、`close.ts` 接线（runtime.ts close JSDoc：同步 closing、队尾 barrier、release 恰一次）、`doc-runtime/mutation.ts`（单操作 L165–200、批量 E1–E6+G L215–300、parseGuard/evaluateGuard/mismatchIssue L640–740）、`namespace-diagnostic-log/src/adapters/memory.ts`（L160–230 缺省与 physicalize）、`projection/input.ts`（status→capture 映射）、`record.ts`（AttemptResult/UpdateCarrier/InputCapture）、`persistence/lifecycle.ts`（release 幂等 + isReleased getter） |
| 配置独立核验 | `vitest.config.ts`（include/typecheck 块）、根 `tsconfig.typecheck.json`（include 含 `packages/*/test/**/*.ts`）、`package.json` L11/L13（test/typecheck 脚本）、`packages/namespace-runtime/tsconfig.json`（仅 `src/**`——设计 F1 修正口径与磁盘一致） |
| 先例独立核验 | `issue-347-guard-passthrough-red.test.ts`（helpers/导入/log 构造先例）、`sequencer-slotkind-close-barrier.test.ts`（seam 注入先例，经设计援引）、`registry-idle.test.ts` L120–130（unhandledRejection 探针先例） |
| Git 只读核验 | `git status --porcelain`、`git diff --name-only/--stat HEAD`（空）、`git diff --quiet HEAD -- <#347 锚>`（逐字节一致）、锚文件 last-touch commit（全部 `61e2daa`） |
| 计数核验 | `packages/namespace-runtime/test/`：46 `.test.ts` + 5 `.test-d.ts`；聚焦三文件 it 数 7/12/10；新文件 it 数 17 |

## 2. Verdict

**approve**。

核心结论：SA3 以**零生产改动 + 单个新增测试文件**兑现 SA6 §12.2–§12.6 全部 17 条冻结用例。逐条对照冻结契约：**全部输入形态与可观察断言在位，无一条被削弱**，多处严格增强（K1⑤ 补 `issues.policy==='full'`、L1 补 message 含 `closing`、L3 补 `issues.items[0].path===[]`、D2 在 JSON 深等外补文本相等）。断言纪律、log 构造钉死（SA2 F2）、冻结面保持（#347 锚逐字节不动）、ALLOW/DENY 全部合规。时序确定性论证经源码逐点复核成立（§8）。SA6 §13「无红相」与 SA3「首跑 17/17 绿」相互印证——红灯升级路径未被触发，与零生产改动约束自洽。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| Issue AC1（透传：满足 ok / 不满足带码 + path） | K1②（L289–296：恰 1 issue、`code===docRuntime.MUTATION_GUARD_MISMATCH===字面量` 双重断言、path 深等 guard 路径）；K2/K3/K5②、N1④、NC2 满足侧 | 落实；码载体三重锚（字面量/导出同源/issue 位）与源码 `mutation.ts` L726–729 逐字相符 |
| Issue AC2（拒绝零写入、值不变） | K2（字节逐字节相等 + update/notifier 计数不变 + 读值不变，L329–341）；K5③④、L1/L2（`bytesOf` 相等 + 0/0） | 落实；零写入判据 = SA6 §12.0 冻结口径（`Y.encodeStateAsUpdate` + update 事件 + notifier 三件套） |
| Issue AC3（诊断 rejected / 未装配等价） | D1（L659–668：恰 1 attempt、`operation==='root-mutation'`、stage=validation、`{kind:'rejected'}`、record 级 `code===undefined`、policy full、items[0] 带码带路径）；D2（L689–710：`toEqual` + `JSON.stringify` 双相等 + 两侧零写入 + 成功侧同 ok） | 落实；与 `diagnostic.ts` L271–274（diagValidation 无顶层 code）、ADR 0011 L18–27 相符 |
| Issue AC4（竞争与 FIFO 独占、TOCTOU 消除） | K1（背靠背双写：r1 ok / r2 带码、updates===1、终值=胜者）；K3（[ok,ok,reject]、message 含实际值 `closed`、updates 2）；K4（seam 槽样本 `['S','S','S']`、`queueDepthAtStart [3,2,1]`、waitMs/runMs number）；K5（批量竞争） | 落实；K4 深度序列与 `sequencer.ts` 记账语义（开跑时刻含本槽计数）逐点对上 |
| Issue AC5（非 fatal、能力保留） | N1（L615–633：`fatal===null`、`rootWrite.enabled===true`、后续无 guard 写 ok、重读重试 ok、unhandledRejection 探针 0 事件） | 落实；探针手法有仓内先例（`registry-idle.test.ts` L120–130） |
| Issue AC6（lifecycle 接纳门次序不变） | L1/L2（closing/closed 期 `RUNTIME_WRITE_DISABLED` 前缀 + 文案域、字节不变、无 transaction/validation 记录）；L3（hostile Proxy `get/has/ownKeys` 计数并 throw、`accesses()===0`、acceptance/not-accessed 记录）；L4（排空窗口六断言 + `isReleased===true`） | 落实；与 `runtime.ts` 接纳门（先 emit acceptance 后 resolve、不读 mutation）相符 |
| Issue AC7（批量 + guard 组合） | K5（竞争：恰 1 issue、终态仅胜者批三项、updates 1、诊断 2 条、payloadLength===updates[0].length）；K6（成功：三项落盘、updates 1、committed/update 载体一致、notifier 1） | 落实；与 `mutation.ts` 批量 G 节（顶层 guard 恰一次先于逐 op prepare）相符 |
| Issue AC8（落位 + 根门槛） | 新文件落位于 SA6 §12.1 冻结路径（命名无 `-red`）；SA3 V1–V5 报告聚焦 4 文件 46 例、目录 51 文件 396 例、根 typecheck exit 0、根 pnpm test 350 文件 3703 例全绿 | 落实（静态可核部分）：runner 收集面、typecheck 程序覆盖面、计数口径全部实测一致；运行输出真实性列入 §11 动态验证项（SA7 面） |
| SA6 §12.9.2 / SA8 RA#1（零生产改动 + 升级路径） | `git diff HEAD` 为空；`git status --porcelain` 仅新测试文件 + Host 预置 wiki 产物；生产锚文件（sequencer/write/runtime/mutation/memory.ts）last-touch 均为 `61e2daa` | 落实；未触发红灯 → 升级路径未被使用，自洽 |
| SA8 RA#2（根门槛收口） | SA3 V4/V5：根 `pnpm typecheck` exit 0 + 根 `pnpm test`（`vitest run --typecheck`）全绿，明示不以聚焦/目录门槛替代 | 落实（声明级）；重跑列入 §11 |
| SA8 RA#3 / SA6 NC5（冻结面保持） | `git diff --quiet HEAD -- issue-347-guard-passthrough-red.test.ts` 逐字节一致；诊断包/schema/wire 零触碰；无 skip/only/todo/env override、无源码字符串断言、无 sleep 阈值断言（grep 实测 0 命中） | 落实 |
| SA8 RA#4（落位裁量） | 接受 SA6 §12.1 冻结默认路径（同路径同名新建）→ 无需回写契约 | 正确行使 |
| SA2 F1（typecheck 覆盖机制） | 实现未触碰任何 tsconfig/vitest 配置（DENY LIST，diff 为空）；覆盖机制事实经本轮独立复核成立：`tsconfig.typecheck.json` include 含 `packages/*/test/**/*.ts`，根 `pnpm test` 含 `--typecheck` | 落实；SA6 §14 原文错误未被沿用（SA3 §Deviations 如实登记） |
| SA2 F2（log 构造钉死） | 10 处 `createBoundedMemoryDiagnosticLog` 全部在用例调用点构造 `({ inputPolicy:'digest', updateCapture:true })`（grep 逐条核验：L277/403/442/470/500/524/550/645/674/766）；`setup()` helper 内零 log 构造，经 `setup({ log })` 注入 | 落实；与 `memory.ts` L165（`updateCapture ?? false`）/L217–221（false → `update-omitted` 无载体）逐字相符——伪回归陷阱确实被消除 |
| SA2 N1'（统一 log 构造约定） | 含 L1/L2（断言无 validation/transaction 记录）与 NC4（断言 input-snapshot 记录内容）在内全部 log 用例同款钉死构造，文件内无第二种约定 | 落实 |
| SA2 N2'（typecheck 门存活信号留档） | SA3 V1–V5 每行均含 `Type Errors no errors` | 落实（声明级） |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| §7 D1：单文件 `issue-349-guard-e2e-competition.test.ts`、17 用例 5 组、命名无 `-red` | 文件即唯一实现产物；describe 组 K/L/N/D/NC（L275/468/601/643/719）；`it` 计数 17（逐一对应冻结 ID）；命名无 `-red` | 完全一致 | — |
| §7 D2：K4 接受包内 seam 观测，纳入正式验收 | `setup({ samples })` 注入 `replicationObservability{stageClock:{now:单调计数}, slotMetrics:sink}`（L133–144）；断言窗口恰 3 个 S 样本、`[3,2,1]`、`allSlotKinds===['S','S','S']`、waitMs/runMs number（L390–397）；ready 后清空样本（L372） | 完全一致；seam 键名与 `runtime.ts` L790–816 校验（stageClock+slotMetrics 双在场）对上；清空时机无竞态（P0 样本 flush 微任务先于任何 poll 定时器，见 §8） | — |
| §7 D3：零生产改动 + 红灯升级路径 | 零 tracked 改动；首跑全绿（无红相，SA6 §13 预期一致）→ 升级路径未触发 | 一致 | — |
| §7 D4：双层验证门槛 | V1/V2 聚焦、V3 目录、V4 根 typecheck、V5 根 test；计数口径（45+1/5+5=51、29+17=46、379+17=396）经本轮 ls/grep 实测全部吻合 | 一致 | — |
| §7 D5 fixture：#347 同款 helper + 三扩展 | `makeDoc`/`setup`/`teardown`/`readOk`/`bytesOf`/`failureOf`/`waitAttempts` 与 #347 L53–137 逐行同构；扩展 = samples seam / notifyGate（先 await 门再 `saveDoc`）/ hostile Proxy 工厂（get/has/ownKeys 计数并 throw） | 一致；扩展点全部在 seam 输入侧，零生产面变化 | — |
| §7 D5 log 构造钉死 | 见 §3 F2 行 | 一致 | — |
| §7 D5 L4 release 观察点备选 (a) | `isReleased(handle)===true`（经窄类型读取 `lifecycle.ts` L163 getter）；teardown 二次 release 幂等（L157–161 实测在位） | 一致（备选 (a)，SA3 已声明） | — |
| §7 D5 导入说明符 `.js` | `./real-persistence-scheduler.js`（磁盘 `.ts` 存在）；`../src/runtime.js` 等 ESM 说明符 | 一致（#347 L28 同款） | — |
| §7 D5 组织与用例注释 | 每用例标题引用 K/L/N/D/NC ID + AC + ADR 行号；文件头注引用 SA6 §12.2–12.6 与 ADR 0025/0026/0008/0011/0014 行号（经本轮对 ADR 原文抽查全部准确） | 一致 | — |
| §7 D5 断言口径（SA6 §12.0） | 码载体/零写入三件套/path 深等/acceptance 四件套/committed payloadLength/message 仅锚稳定码前缀 + K3 实际值文本 | 逐条一致（多处增强，无削弱） | — |
| §7 D5 确定性纪律 | 并发全部 `Promise.all` 背靠背；等待仅 `expect.poll`（ready/notifier/记录数）；`setImmediate` 仅用于 N1⑤ 探针冲刷（非业务 sleep 断言） | 一致 | — |
| §7 D5 teardown | `handle.release()` + `writer.dispose()`；L4 门 `finally` 放行（L590–593） | 一致 | — |
| 命名偏离声明（SA3 §Deviations）：`setup({samples})`/`setup({notifyGate})` vs 设计示例 `observability`/`gate` | 注入语义与断言口径逐条不变；设计未冻结 helper 标识符 | 可接受的非实质偏离，已如实声明 | — |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| 竞争/定序语义 | 写序列器（ADR 0008） | 测试仅经 seam 观测 `SequencerSlotSample`，零回流 | ✓ |
| guard 评估 | doc-runtime prepare 阶段 | 测试全部经 `mutateData` 端到端，无 doc-runtime 直打 | ✓ |
| 诊断透传 | 写槽 R9 + 诊断包 | 只断言既有字段（stage/result/issues/code/path/payloadLength） | ✓ |
| log 构造选项 | 消费方 fixture 责任（SA2 F2 归属） | 10/10 调用点钉死 | ✓ |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| issue-scoped 验收契约测试 | `issue-347-guard-passthrough-red.test.ts`、`issue-350-*` | 新文件同模式（helpers 逐行同构） | 一致 | 仓内先例 |
| 槽级 seam 观测 | `sequencer-slotkind-close-barrier.test.ts` | K4 同款 `replicationObservability` 注入 | 一致 | 不新增公共面（ADR 0008 L97/L101） |
| unhandledRejection 探针 | `registry-idle.test.ts` L120–130 | N1⑤ 同款显式探针 + dispose | 一致 | 非全局忽略兜底 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 槽序/深度 | sequencer 内部 | seam 样本（纯观测 sink） | 无（只读，不回流） |
| 文档状态 | live Y.Doc | 用例内 bytes/update/notifier 快照 | 无（用例内局部） |
| 稳定码字面量 | doc-runtime 导出 | 测试内常量 + 导出同源双断言 | 无（K1② 双锚显式防漂移） |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| setup（createDoc + seam + poll ready） | teardown（release + dispose） | release 幂等；L4 门 finally 放行；探针 dispose 于 finally | ✓ 对称；每用例独立 fixture，无跨用例状态 |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 无第二套 cleanup/重试/状态/日志/排序机制 | — | 测试文件零机制引入 | ✓ |

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/namespace-runtime/test/issue-349-guard-e2e-competition.test.ts`（新建，untracked） | 设计 §11 ALLOW 第 1 行（= SA6 §12.1 冻结路径） | 唯一实现产物：17 用例 + fixture 扩展 | ✓ 精确命中 |
| `wiki/raw/task_issue-349_sa3_impl.md`（新建，untracked） | skill 固定输出 | SA3 实现报告 | ✓ |

- `git diff --name-only HEAD` / `git diff --stat HEAD`：**空**——DENY LIST 全部合规（`namespace-runtime/src/**`、`doc-runtime/src/**`、#347 锚、`namespace-diagnostic-log/**`、ADR/CONTEXT/协议、`vitest.config.ts`、`tsconfig*.json`、package.json、lockfile、其余包均逐字节未改）。
- 其余 untracked 文件均为 Host 预置 wiki 产物（brief/design/sa2/sa6/relevant_decisions/conflict_report）；无 probe/tmp 残留（`ls packages/namespace-runtime/test/` 无 `probe-349.tmp.ts`；`.scratch/` 仅含历史任务文件，gitignored）。
- ALLOW 内无未修改路径（两条均已落位）；无 ALLOW 外新增。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| 生产公共面（mutateData/readData/getStatus/close、写槽、sequencer、诊断 schema） | 生产调用方 | 零生产改动 → 签名/返回/时序/生命周期零变化 | 无 | — |
| 新测试文件作为消费方 | 公共 API + 包内 seam + `createBoundedMemoryDiagnosticLog` + yjs API | 全部只读消费；seam 键名（handle/notifyDirty/diagnosticEmitter/clock/replicationObservability）经 `runtime.ts` L707–816 校验面逐一核对有效 | 无 | — |
| `diagnosticEmitter` 成对约束（emitter 在场必须 clock 在场，`runtime.ts` L787） | `setup({ log })` 同时注入 `seam.clock = () => NOW_MS` | 满足 | 无 | — |
| `MUTATION_GUARD_MISMATCH` 公共导出 | 测试 L47 直接类型化读取（#347 红灯期曾用 Record 反射读，现导出已在位） | 与 `doc-runtime/src/index.ts` L23 一致 | 无 | — |
| close 自等待禁律（runtime.ts close JSDoc：notifier 内 await close Promise = 死锁） | L4 门为测试自有 deferred（非 close Promise），主流程 + finally 双放行 | 无死锁路径 | 无 | — |

## 8. 错误、恢复与并发

- **确定性论证逐点复核**（设计 §7 时序论证 vs 源码）：
  1. FIFO 链形：`sequencer.ts` enqueue `settled = this.tail.then(run, run)` + 链尾恒绿（G1）——K1/K3/K5 竞争结果由入队序唯一决定 ✓。
  2. K4 样本可见性：`enqueue` 内部 `void settled.then(flushSamples)` 的注册**先于**返回 `settled` 给调用方——微任务 FIFO 序保证 `await Promise.all` 恢复前 sink 已收齐 ✓。
  3. `queueDepthAtStart` 语义：`runMeasured` 开跑时刻读 `this.depth`（含本槽自身）——三写背靠背 → 恰 `[3,2,1]` ✓。
  4. 记录顺序：槽内 R9 置 `diag.outcome` → 槽 settle 后 `emitSlot`（runtime.ts L528–531）→ 内存 adapter 同步入队——records[0]=committed、records[1]=rejected 确定序 ✓。
  5. P0 样本清空时机：P0 槽 settle → flush 微任务在任何 poll 定时器（宏任务）前排空 → setup 返回后清空不与 P0 样本竞态 ✓。
  6. L4 挂点：`notifyDirty` 先计数再 `await gate` 再 `saveDoc`——`notifierCalls()===1` 即「S5 已提交、槽挂于 S6」的可观察信号；close barrier 排队尾、lifecycle 同步 `closing`、closing 新写走 D5.1 即时拒绝（不排队）✓。
  7. L3 零访问：接纳门分支（`runtime.ts` mutateData）在读取 `mutation` 前判定 `lifecycle !== 'ready'` 并 emit acceptance（`input:{status:'not-accessed'}`）——hostile Proxy 三 trap 计数断言 `===0` 有真实判别力（门若后移即计数>0 或 trap 抛出）✓。
- **错误面**：全部被断言失败均为领域拒绝（`ok:false`），fatal 通道断言为不触发（N1）；S3 分层（NC4 record 顶层码）与形状域（NC3 无码）分层正确。
- **恢复/幂等**：`handle.release()` 幂等（L4 close 后 teardown 二次 release 安全）；`close()` 幂等；L4 门 `finally` 恰一次放行（重复 resolve 无害）。
- **隔离**：每用例独立 store/handle/writer/runtime；`collectUpdates` 监听器绑定于用例自有 doc，无跨用例泄漏；探针 dispose 于 finally。
- 静态无法确认的运行风险（时长/flake/输出真实性）列入 §11，不猜测通过。

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| K1–K6 | 竞争/槽级 FIFO/批量组合：结果联合 + 码/path + 字节/update/notifier 计数 + 诊断 2 条记录（含 payloadLength===updates[0].length 单事务不变量） | `vitest.config.ts` include `packages/*/test/**/*.test.ts` 命中（同目录 45 个既有 `.test.ts` 均被收集，SA6 §4 实测 50 文件含同类） | 无；主路径（K6/NC1/NC2/D2③）与拒绝路径双向覆盖，敏感度锚成对（NC2 vs K1/K5） | — |
| L1–L4 | 接纳门次序：closing/closed 拒绝 + 无 validation/transaction 记录 + Proxy 零访问 + acceptance/not-accessed + 排空窗口六断言 + isReleased | 同上 | 无；L1 同步断言 `close()` 返回前 lifecycle 已 `closing`（比契约更严） | — |
| N1 | 非 fatal + 能力保留 + 重读重试 + unhandledRejection 0 事件 | 同上 | 无 | — |
| D1–D2 | 诊断透传 + emitter 装配/未装配逐字等价 | 同上 | 无；双等值断言（deep + JSON 文本） | — |
| NC1–NC4 | 负控锚：幸福路径 / guard 满足 / 元素 guard 形状错误 / S3 分层 | 同上 | 无 | — |
| 类型检查覆盖 | 新文件在 `tsconfig.typecheck.json` 程序内（include 含 `packages/*/test/**/*.ts`）；根 `pnpm test` = `vitest run --typecheck` | 聚焦/目录/根运行均执行该程序（SA6 §4/§14 与 SA3 V1–V5 输出均含 `Type Errors no errors`） | 无 | — |
| 纪律 | 无 skip/only/todo/env override（grep 0 命中）；无源码字符串断言（无 fs 导入、无 `expect.soft`）；无 setTimeout/sleep 阈值断言（grep 0 命中） | — | 无 | — |
| 冻结锚 | #347 文件逐字节不动；17 用例 ID 与冻结表一一对应 | `git diff --quiet` 实测 | 无 | — |

断言敏感度评估（SA6 §13 反向退化表承接）：guard 移出槽/并行化 → K1/K3/K4 红；一律拒绝 → NC2 红；一律放行 → K1/K5 红；元素形状域坍缩 → NC3 红；S3 分层变化 → NC4 红；R9 透传缺失/顶层码误加 → D1/K1⑤ 红；诊断影响业务 → D2 红；接纳门后移 → L3 红。双向退化均有捕获面。

## 10. Required revisions

**无**（无 BLOCKER / MAJOR / MINOR 阻断项）。

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| SA3 V1–V5 运行输出真实性（SA4 纪律不运行测试） | SA7 动态验证 | 聚焦 4 文件 46 例 / 目录 51 文件 396 例 / 根 typecheck exit 0 / 根 pnpm test 全绿（350 文件 3703 例口径复核），各次输出含 `Type Errors no errors` 行 | 任一计数不符或存在红 |
| K4/L4 poll 类断言在负载下的确定性与时长（设计 R2/R3） | SA7 重复运行新文件（≥3 次，含整机负载场景） | 结果逐次一致；L4 总时长远低于默认 testTimeout | 间歇红或超时 |
| D2 emitter 等价在完整目录并发上下文中的稳定性 | SA7 目录级运行 | D2 恒绿 | 间歇不等 |
| vitest typecheck 程序对新文件的门存活（SA2 N2'） | SA7 在新文件注入临时类型错误的对照（或采信既有输出行） | 出现 Type Errors 且非零退出 | 门未覆盖新文件 |

## 12. Non-blocking observations

| # | 观察 | 建议 |
|---|---|---|
| M-1 | L3 仅在 `closing` 相位执行 hostile Proxy（冻结行措辞为「closing/closed 期」）；两相位走同一接纳门分支，且 L1/L2 已分别钉住两相位的拒绝行为 | 无需修订；如后续扩票可在 closed 相补一次 Proxy 输入 |
| M-2 | `waitAttempts` 轮询至精确计数后快照，不再复查后续增量（继承 #347 既有惯例）；本文件 10 处使用的发射序均确定（槽序 + 同步内存 adapter），无现实漂移面 | 保持现状；若未来诊断 emitter 引入异步/批量发射，需改为终态断言 |
| M-3 | K5⑥ 未重复断言诊断 `items[0].path`（K1⑤/D1 已断言；K5② 已断言结果 issue 的 path）——冻结 K5⑥ 文本本身不要求该字段 | 无需修订 |
| M-4 | helper 选项命名 `samples`/`notifyGate` 与设计示例 `observability`/`gate` 不同（SA3 已声明；设计未冻结标识符，注入语义逐条一致） | 无需修订；记录供后续票对齐用语 |
| M-5 | SA6 §14 L335–336 的 tsconfig 覆盖表述错误仍留存于上游契约文本（设计 §5 与 SA3 报告均已登记、未被实现沿用） | 建议 Controller 知会 SA6 在后续票修正其契约文本；不影响本票 |

---

## 收尾

- 本审查为纯静态：未修改实现/设计/测试；未运行测试、服务、probe；未创建临时文件或后台进程；唯一写产物为本文件。
- 结论路由建议（供 Controller）：**approve** 放行；SA7 动态验证聚焦 §11 四项；M-5 转告 SA6 供后续契约文本修正。
- 未发现需要重新执行 ADR 冲突检查的新风险：实现零生产改动、零决策面触碰、落位接受冻结默认路径（SA8 RA#4 无偏离）。
