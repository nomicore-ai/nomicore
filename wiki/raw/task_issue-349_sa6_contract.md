# SA6 诊断与验收契约 — issue #349 条件写端到端：mutateData 透传、诊断 rejected 与写序列器竞争证明（guard III）

- 任务类型：**feature / verification**（验收证明票：目标能力已由 #347 落地；缺口是 #349 的竞争、生命周期与组合证明面在测试语料中不存在；不虚构 Bug 根因）
- 被审对象：issue #349「条件写端到端：mutateData 透传、诊断 rejected 与写序列器竞争证明（guard III）」
  （brief `wiki/raw/task_issue-349.md`，State: open；Blocked-by #347 已满足——HEAD 即 #347 合并点）
- 诊断基线：HEAD `61e2daa37e21b467e7ce130d5c4db7be38bde982`（2026-09-13T09:27:27+08:00，
  「fix(#347): 条件写核心：doc-runtime 信封解析、槽前评估与 `MUTATION_GUARD_MISMATCH`（guard I）(#356)」），
  worktree `/home/wangjian/nomicore-fix-issue-349`，分支 `mabf/issue-349`
- 结论：**approve**（诊断可信：目标行为在 HEAD 已全部成立且可运行时复现；缺口为 #349 契约证明面缺失；
  契约可执行、测试入口真实、负控全绿。**本票不存在红灯相**——不得为满足流程而伪造红灯，见 §13）
- 本轮范围声明：按 dispatch「Do not implement production code or executable tests」，**不实例化测试文件**；
  验收契约以「用例 ID — 最小输入 — 可观察断言 — HEAD/目标预期」完整冻结于 §12，测试文件路径与
  用例 ID 已冻结，供 SA1 设计核对、SA3/SA6 下一轮按表落地。临时 probe 为诊断用途，收尾已删除（§16）。

---

## 1. Task type and inputs

| 输入 | 用途 |
|---|---|
| `wiki/raw/task_issue-349.md` | Host task brief：issue #349 正文、AC1–AC8、What to build、Blocked-by #347 |
| `wiki/raw/task_issue-347_sa6_contract.md` | 前置票 #347 的 SA6 契约（§12.8 E1–E7 端到端透传面已冻结并随 #347 落地） |
| `wiki/raw/task_issue-347_sa3_impl.md`、`_sa9_standards.md`、`_sa10_spec.md` | #347 实现与验收证据（测试路径、红→绿、根门槛） |
| `docs/adr/0025-guarded-mutation-conditional-write.md` | 主决策：信封形态、评估位置与原子性、两态错误域、诊断透传、验证门槛（L46–60、L72–74、L90） |
| `docs/adr/0026-atomic-mutation-envelope.md` | 批量形态与顶层 guard 组合约束（#350 已实现；批内元素禁 guard） |
| `docs/adr/0008`（写序列器）、`0011`/`0014`（诊断日志）、`0016`（读取投影） | FIFO 独占语义、rejected 变更尝试记录、载体投影读取 |
| 源码现状 | `packages/namespace-runtime/src/{runtime.ts,write.ts,sequencer.ts,diagnostic.ts}`；`packages/doc-runtime/src/mutation.ts`（#347 guard 核） |
| 既有测试 | `packages/namespace-runtime/test/issue-347-guard-passthrough-red.test.ts`（E1–E7）、`runtime-mutate-root-sequencer.test.ts`、`runtime-close-lifecycle.test.ts`、`sequencer-slotkind-close-barrier.test.ts` |

Issue 评论：**无**（dispatch 明示 REST 预读 comments 为空）；无 owner 反馈要求。
SA8 产物：**不存在** `wiki/raw/task_issue-349_design.md` / `_conflict_report.md` / `_relevant_decisions.md`
（全目录实测仅 `task_issue-349.md`）——本契约直接由 brief + ADR + #347 冻结契约推导（见 §3、§15）。

## 2. Owner comment mapping

| Owner 评论 | 映射 |
|---|---|
| （无） | 无额外 owner 要求或 override；契约完全由 issue 正文 AC1–AC8 + ADR 0025（含 0026 组合节）+ #347 已落地实现推导 |

## 3. SA8 constraints（本票无 SA8 产物时的替代约束来源）

| 约束（来源） | 本契约落点 | 证据 |
|---|---|---|
| 评估在写槽内、信封解析成功后/分叉前；`set([])` legacy 同样生效（0025 L48） | 全部 K/L 用例经 `mutateData` 端到端观察，不做 doc-runtime 直打 | `mutation.ts` L173–176、L287–290 |
| 原子性来自写序列器 FIFO 独占，不来自 Yjs 事务（0025 L49） | K1/K3/K4/K5：竞争对 + 三写交错 + 槽级样本 | `sequencer.ts` L94–101；`write.ts` L94 槽序 |
| guard 评估先于 schema 校验管线（0025 L50） | 不在 e2e 新增 schema 次序用例（doc-runtime O1–O3 已冻结）；#349 不重复 | #347 契约 §12.4 |
| 评估不满足：零写入单 issue、稳定码 `MUTATION_GUARD_MISMATCH`、`issue.path` = guard 路径（0025 L58） | K1/K2/K3/K5/D1；码载体 `issues[0].code` | probe §5；`mutation.ts` L56–62 |
| 诊断经写槽 R9 同源透传（stage=validation、result=rejected）（0025 L60） | D1/D2 + K1/K5 record 断言；record 级无顶层 code | `write.ts` L205–208；`diagnostic.ts` L273 |
| guard 适用于两种形态顶层；批内元素禁 guard（0025 L74、0026 L29） | K5/K6（批量正例）；NC3（元素 guard 形状错误冻结） | `mutation.ts` L228–232、L276–292 |
| namespace-runtime 写槽零改动、透传走既有管线（issue #349 What to build） | §10：生产实现零改动为预期；契约只新增测试 | probe：HEAD 全行为已成立 |
| 验证门槛：doc-runtime + namespace-runtime 写槽透传与序列器竞争测试 + 根 `pnpm typecheck`/`pnpm test`（0025 L90、issue AC8） | §12.1 测试路径 + §14 runner 证据 | 基线实测（§4） |
| 冻结面：诊断 record schema 指纹、wire、写槽 R9、lifecycle 接纳门次序、元素 guard 形状错误 | NC1–NC5 与 L1–L4 全绿；契约零触 schema/wire/槽序 | §6、§12 |

## 4. Environment and baseline

| 项 | 值 |
|---|---|
| 环境 | Linux；node v24.13.0；pnpm 10.28.2；typescript 5.9.3；vitest 3.2.7；tsx 4.23.12 |
| 依赖 | `pnpm install --frozen-lockfile --prefer-offline`：65 包全部复用本地 store（0 网络下载，exit 0） |
| 运行入口 | `NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run <path>`；根 `pnpm test` = `vitest run --typecheck`（include `packages/*/test/**/*.test.ts`，`maxWorkers: 1`） |
| 前置票基线（绿） | #347 E1–E7 + `runtime-mutate-root-sequencer` + `runtime-close-lifecycle`：**3 文件 / 29 用例通过**，`Type Errors no errors`（1.30s） |
| 目录基线（绿） | `packages/namespace-runtime/test` 全目录：**50 文件 / 379 用例通过**，`Type Errors no errors`（25.91s） |
| 根门槛（绿） | `pnpm typecheck`：14 个 tsconfig 顺序编译，**exit 0** |
| fixture | 复用 #347 E2E 形态：`createMemoryPersistence` + memory store + `createNamespaceRuntimeWithSeam`（handle/notifyDirty/可选 diagnosticEmitter+clock）+ `expect.poll(schema.state==='ready')`；根文档 `{n:1, a:'x', tasks.t1/t2.status:'open' reviewer:'r0', values:[1,2,3]}` |
| 生产实现改动 | **零**（`git status` 仅 Host 预置 brief；临时 probe 已按 §16 删除） |

## 5. Positive reproduction（#349 目标面的运行时观察）

临时 probe `packages/namespace-runtime/probe-349.tmp.ts`（**已删除**）逐字输出（节选；最终版本连续运行
2 次，去除 Yjs update 的随机 client-id 编码后结构逐字节一致；早期 2 次为 probe 脚本自身缺陷修正前的迭代，
不作为契约证据）——**全部目标断言在 HEAD 即为绿**：

```
=== P-A 单操作双写竞争（同一 guard equals:'open'，并发两写）===
mismatchExport: "MUTATION_GUARD_MISMATCH"
r1: {"ok":true}
r2: {"ok":false,"issues":[{"message":"MUTATION_GUARD_MISMATCH: guard 条件不满足（guard 路径
     [\"tasks\",\"t1\",\"status\"]：期望 equals=\"open\"，实际=\"reviewing\"）",
     "path":["tasks","t1","status"],"code":"MUTATION_GUARD_MISMATCH"}]}
statusAfterPair: value="reviewing"（仅胜者落盘）
updatesAfterPair: 1   notifierAfterPair: 1
recordsAfterPair (2): [stage=transaction result={kind:committed,effect:update} payloadLength=36,
                       stage=validation result={kind:rejected} record.code=undefined
                       issues.items[0].code="MUTATION_GUARD_MISMATCH" path=["tasks","t1","status"]]
committedPayloadMatchesSingleUpdate: true
rejectZeroWriteInPlace: true（同过期 guard 再拒：字节不变、update 数不变）
statusFatalAfterReject: null   rootWriteEnabledAfterReject: true
nextUnguardedWrite: {"ok":true}   retryWithRereadGuard(equals:'reviewing'): {"ok":true}
=== P-B 装配/未装配 emitter 等价（同一 mismatch guard equals:'draft'）===
rWith === rWithout（逐字相等）；withLogRejectZeroWrite: true；withoutLogRejectZeroWrite: true
updatesAfterReject: 0/0；notifier: 0/0；两侧值保持 "open"
装配侧 records: [stage=validation result={kind:rejected} issues.items[0].code=MUTATION_GUARD_MISMATCH]
=== P-C closing/closed 接纳门（hostile Proxy 输入）===
duringClosing: {"ok":false,"issues":[{"message":"RUNTIME_WRITE_DISABLED: Runtime lifecycle 为 closing…
               ——本调用零写入、输入零访问","path":[]}]}
afterClosed: 同款（lifecycle 为 closed）
proxyGets: 0   updates: 0   notifierCalls: 0   lifecycleEnd: "closed"
records (2): stage=acceptance result={kind:rejected} code="RUNTIME_WRITE_DISABLED"
=== P-D 批量 {ops,guard} 竞争（3 ops：set status / set n=7 / array-insert values@1 [9]）===
r1: {"ok":true}
r2: {"ok":false,"issues":[{code:"MUTATION_GUARD_MISMATCH", path:["tasks","t1","status"], message…}]}
final: status="reviewing", n=7, values=[1,9,2,3]（仅胜者批落盘）
updates: 1   updateByteLens: [64]   notifierCalls: 1
records (2): [transaction committed update payloadLength=64, validation rejected 单 issue 带码]
=== P-E 三写交错 + FIFO 槽样本（A guarded→reviewing；B 无 guard→closed；C guarded(stale)→archived）===
rA {"ok":true}  rB {"ok":true}  rC {"ok":false, 实际="closed"}
final: "closed"   updates: 2   notifierCalls: 2
sSlots: [{slotKind:"S",queueDepthAtStart:3,waitMs:3},
         {slotKind:"S",queueDepthAtStart:2,waitMs:4},
         {slotKind:"S",queueDepthAtStart:1,waitMs:5}]   allSlotKinds: ["S","S","S"]
=== P-F close 排空窗口 ===
committedWhileHeld: value="reviewing"（已接纳 guarded 写先提交）
rejectedDuringDrain: RUNTIME_WRITE_DISABLED（closing 期新写）
acceptedResult: {"ok":true}   finalLifecycle: "closed"   updates: 1   notifierCalls: 1
records: [stage=acceptance RUNTIME_WRITE_DISABLED, stage=transaction committed update]
```

- 期望（issue #349 AC1–AC7 目标）：见 §12 用例表「目标预期」列——与本 probe 实际输出逐项一致。
- 实际：HEAD 即全部满足；**无任何行为偏差**。缺的是把这些断言固化下来的可执行用例（§8 Step 3/5）。

## 6. Negative control（当前全绿，实现后必须保持）

| 负控 | 断言 | 当前（实测） |
|---|---|---|
| NC1 无 guard 单操作幸福路径 | `{ok:true}`、readData 见值、1 update、1 notifier | 绿（probe P-A `nextUnguardedWrite`；#347 E1） |
| NC2 guard 满足 | `{ok:true}`、值落盘、1 update | 绿（probe P-A retry / P-B ok 侧；#347 E2） |
| NC3 批量元素携带 guard（形状错误） | `ok:false`、`code===undefined`、零写入 | 绿（#347 E7；ADR 0026 L29 冻结） |
| NC4 `guard.equals` 含 NaN / undefined 值键经 mutateData | S3 先拒 `MUTATION_INPUT_NOT_PLAIN_DATA`、record stage=input-snapshot 带顶层码、零写入 | 绿（#347 E6） |
| NC5 #347 E1–E7 全文件 | 逐字节不动、全绿 | 绿（`issue-347-guard-passthrough-red.test.ts` 7/7） |
| NC6 P0 启动槽 / close barrier 槽 | K4 的 `slotMetrics` 窗口只含 3 个 `S` 样本（无杂槽混入） | 绿（probe P-E `allSlotKinds`） |

NC2 是 K 组「拒绝」断言的**敏感度锚**：若实现退化为「带 guard 一律拒绝」，NC2 会红；若退化为
「guard 一律放行」，K1/K5 会红。两组互为方向相反的对照。

## 7. Stability, scale and timing

- 全部契约断言为**确定性**观察：FIFO 由 JS run-to-completion + promise 链保证；无 sleep 阈值、无墙钟竞态；
  并发场景用 `Promise.all` 背靠背入队，结果由序列器定序唯一决定。最终 probe 版本连续运行 2 次
  （run5/run6），去除 Yjs 随机 client-id 编码后 `diff` 为空（exit 0）；此后未再改动 probe 逻辑。
  早期 run2/run4 曾因 probe 脚本自身缺陷（F 组自锁、B 组输入误选为满足态）非零退出，修正后重跑，
  不作为契约证据（§16）。
- 时序等待仅 `expect.poll(schema.state==='ready')`（既有惯例）与诊断记录轮询；无固定 sleep 断言。
- 规模：fixture ≤6 字段的小文档；无性能/规模断言（#349 不引入 perf 面）。
- 时长：probe 全量 ~2s；聚焦 3 文件 1.30s；namespace-runtime 全目录 25.91s；根 typecheck exit 0。
- 无 skip/only/todo/env override；无软断言；无吞错；无源码字符串断言。

## 8. Root-cause chain / capability gap

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| 1 | ADR 0025 要求：guard 在写槽内评估、原子性归写序列器 FIFO 独占、两态错误域、诊断经 R9 透传；验证门槛明确要求「namespace-runtime 写槽透传与序列器竞争测试」 | `docs/adr/0025` L46–60、L90；issue #349 AC1–AC8 | 高 |
| 2 | #347 已落地 guard 核：四动词与批量顶层可选 guard、形状校验、槽前评估、稳定码导出；端到端 E1–E7 已随 #347 合入且全绿 | `mutation.ts` L56–62/L173–176/L228–232/L276–292；`issue-347-guard-passthrough-red.test.ts` 7/7；`git show --stat 61e2daa` | 高 |
| 3 | #349 契约面在测试语料中**不存在**：全仓无两个并发 guarded 写的竞争用例；`MUTATION_GUARD_MISMATCH` 仅出现在 doc-runtime 测试与 #347 E2E 文件；无「guard × lifecycle 接纳门」用例；无「批量 + guard 竞争」用例 | `grep -rln MUTATION_GUARD_MISMATCH packages/*/test/`（3 文件）；`grep -rn "Promise.all" packages/namespace-runtime/test/*.ts`（唯一命中为 #337 SA7 诊断的两笔**无 guard** 写，非竞争证明） | 高 |
| 4 | 机制上目标行为应当成立：`mutateData` 接纳门在 lifecycle≠ready 时同步零入队拒绝（先于任何输入读取）；`ready` 时入 `'S'` 写槽；槽内 S5 调 `applyValidatedMutation`（guard 评估与提交同槽、解析后分叉前）；领域失败经 R9 进 `MutateDataResult.issues` 与诊断 record | `runtime.ts` L512–533；`write.ts` L94–230（S1–S7）；`diagnostic.ts` L176–220/L273 | 高 |
| 5 | 运行时实测：AC1–AC7 的全部目标断言在 HEAD 成立（竞争、零写入、诊断 rejected、非 fatal、lifecycle 次序、批量组合、单事务 bytes、FIFO 槽深度递降） | §5 probe P-A…P-F | 高 |
| 6 | **结论（能力缺口定性）**：缺口不是行为（无需修生产实现，与 brief「namespace-runtime 实现预期零改动」一致），而是**验收证明面缺失**——#349 要求的竞争/生命周期/组合断言没有被任何可执行用例覆盖，ADR 0025 L90 的门槛未闭合 | Step 3 + Step 5 | 高 |
| 7 | 推论：本票实现阶段 = 按 §12 落地测试；不存在可诚实生产的红灯相；断言敏感度必须由负控（NC1–NC6）+ 反向退化推理（§13）承担 | Step 5/6；skill 纪律「不得制造伪红」 | 高 |

## 9. Causal experiments

| 实验 | 控制变量 | 观察 | 结论 |
|---|---|---|---|
| X1 同 fixture 单点加 guard | 仅把无 guard 信封追加 `guard.equals:'open'`（满足） | 无 guard `{ok:true}`；加 guard `{ok:true}` 且 1 update | guard 键本身不改变幸福路径（NC2 敏感度锚） |
| X2 竞争对 vs 串行重读 | 两个同 guard 写并发 vs 第一个提交后重读旧值再写 | 并发：先到者 `{ok:true}`、后到者带码拒绝；串行重读：`{ok:true}` | 第二写的判定基于**已提交**新值——FIFO 独占 + 槽内评估共同成立（K1/N1） |
| X3 三写交错 + 槽样本 | A(guarded) / B(无 guard 改写同一路径) / C(stale guarded) 背靠背入队 | 结果 [ok, ok, 带码拒绝]；S 槽样本 queueDepthAtStart [3,2,1]；终值 = B | 无第三写插入 guard 评估→提交间隙：槽严格串行、深度单调递减（K3/K4） |
| X4 接纳门次序定界 | closing/closed 期传入 hostile Proxy（get/ownKeys 计数并 throw） | 返回 `RUNTIME_WRITE_DISABLED`、Proxy 访问 0 次、record stage=acceptance | lifecycle 门先于 guard 解析与输入读取；guard 不改变接纳门次序（L1–L3） |
| X5 批量 vs 单操作 | 同一 guard 叠加在 3-op 批量与单操作上 | 批量为单事务（1 update、payloadLength=update 长度）；拒绝侧单条 issue、零写入 | 0026 原子性与 0025 顶层 guard 组合语义成立（K5/K6） |
| X6 emitter 在场/缺席 | 同一 mismatch 信封经两个 fixture（装配 / 未装配 emitter） | 业务结果逐字相等、两侧零写入；装配侧 1 条 rejected/validation 记录 | 诊断是纯观测面，不改变业务结果（D1/D2、ADR 0011） |
| X7 close 排空 | 持有 notifier 使已接纳 guarded 写挂住，再 close() | 已接纳写先提交、随排空 `ok:true`；closing 期新写即刻 `RUNTIME_WRITE_DISABLED`；release 恰一次 | guard 不改变「已接纳任务无条件排空」语义（L4） |

## 10. Impact surface

| 面 | 影响 |
|---|---|
| `packages/namespace-runtime/src/*` | **零改动（预期）**：接纳门（`runtime.ts` L512–533）、写槽 R9（`write.ts` L205–208）、序列器（`sequencer.ts`）与 guard 语义无耦合需修正；若实现阶段出现红，即为回归/阻断性偏差，须停下升级而非就地改产线（§12.11） |
| `packages/doc-runtime/src/*` | 零改动（guard 核已由 #347 落地并冻结） |
| 诊断日志 record schema / 投影 | 零变更（指纹冻结面不动）；本票只断言 `stage=validation|acceptance`、`result.kind=rejected`、`issues.items[].code`/`path` |
| wire / 复制 / `replaceSchema` / META | 零影响（ADR 0025 L64–66 边界外；契约零断言） |
| 测试语料 | 新增 1 个 issue-scoped 验收文件（§12.1）；不改动 `issue-347-guard-passthrough-red.test.ts` 与既有 sequencer/lifecycle 文件（冻结锚保持字节稳定） |
| 既有测试 | 全绿面保持：namespace-runtime 50 文件/379 用例、聚焦 3 文件/29 用例、根 typecheck exit 0 |

## 11. Ruled-out hypotheses

| 假设 | 反证 | 结论 |
|---|---|---|
| H1 guard 端到端未透传（#347 只在 doc-runtime 生效） | #347 E2/E4 与 probe P-A/P-D：满足→`{ok:true}` 且落盘；不满足→带码 `ok:false` | 排除 |
| H2 两个并发 guarded 写可双双通过（TOCTOU 残留） | P-A：`r2` 带码拒绝、`updatesAfterPair=1`、终值为先到者值 | 排除 |
| H3 lifecycle 门在 guard 评估之后（closing 期会先解析 guard） | P-C：hostile Proxy 访问 0 次、stage=acceptance、`RUNTIME_WRITE_DISABLED` | 排除 |
| H4 批量 guard 拒绝会部分落盘 | P-D：终值仅含胜者批三项；拒绝批 0 update；`updates=1` | 排除 |
| H5 guard 拒绝升级为 fatal | P-A：`fatal===null`、`rootWrite.enabled===true`、下一笔无 guard 写 `{ok:true}`、重读重试 `{ok:true}` | 排除 |
| H6 装配 diagnostic emitter 会改变业务结果 | P-B：`rWith===rWithout` 逐字相等、两侧零写入、0 update | 排除 |
| H7 #347 E1–E7 已覆盖 #349 竞争/生命周期/组合面 | 实读 #347 文件：E1 无 guard、E2 单写满足、E3/E5 单写与批量拒绝诊断、E4 批量满足、E6 S3 分层、E7 元素 guard；**无并发竞争、无 lifecycle×guard、无槽级 FIFO 证据** | 排除 |
| H8 新测试文件不会被 runner 收集 | `vitest.config.ts` include `packages/*/test/**/*.test.ts`；同类 `issue-347-*`/`issue-350-*` 文件均在同一模式内且实测被收集 | 排除 |
| H9 契约断言会「伪绿」（例如只断言 `ok:false` 而旧实现同样拒绝） | 目标断言含 `ok:true` 落盘（K1/K5/K6、NC2）、稳定码与 path（K1/K5/D1）、update 计数与 payload 一致性（K1/K5/K6）、`fatal===null`（N1）、Proxy 零访问（L3）；不存在「仅拒绝即通过」的断言 | 排除（§13 敏感度表） |
| H10 本票需要修生产实现 | brief 明示 namespace-runtime 预期零改动；P-A…P-F 全绿；无任何偏差需要修正 | 排除（零改动为契约约束） |

## 12. Acceptance contract and test paths

### 12.0 接口约定（可观察口径，沿用 #347 契约 §12.0）

- **码载体**：评估不满足的单 issue 暴露 `code` 属性，值 === 从 `@nomicore/doc-runtime` 值导出的
  `MUTATION_GUARD_MISMATCH`（字面 `'MUTATION_GUARD_MISMATCH'`）；record 级 `code === undefined`
  （写槽 `diagValidation` 无顶层码）；形状错误 issue `code === undefined`。
- **零写入**：`Y.encodeStateAsUpdate(doc)` 逐字节不变 + 0 次该调用引发的 `update` 事件 + 0 次 notifier 调用。
- **issue.path**：评估不满足时深等于 guard 条件路径。
- **acceptance 记录**：lifecycle 拒绝的 record `stage === 'acceptance'`、`code === 'RUNTIME_WRITE_DISABLED'`、
  `result.kind === 'rejected'`、`input` 投影 `capture === 'not-accessed'`（`projection/input.ts` L68）。
- **FIFO 槽样本**：经包内 seam `createNamespaceRuntimeWithSeam({ replicationObservability: { stageClock, slotMetrics } })`
  观察（既有测试先例 `sequencer-slotkind-close-barrier.test.ts`）；样本 `slotKind === 'S'`、
  `queueDepthAtStart`、`waitMs`/`runMs` 为 number。

### 12.1 测试文件路径（已冻结）

| 文件 | 层级 | 本轮状态 |
|---|---|---|
| `packages/namespace-runtime/test/issue-349-guard-e2e-competition.test.ts` | `mutateData` 端到端：竞争 / lifecycle / 非 fatal / 批量组合 / emitter 等价 / FIFO 槽证据 | 未实例化（dispatch 指示）；SA3 实现前由下一轮 SA6 或 SA3 按 §12.2–§12.8 落地 |
| `packages/namespace-runtime/test/issue-347-guard-passthrough-red.test.ts` | #347 冻结的 E1–E7（本轮负控 NC5） | 已存在且全绿；**本票不得修改** |

- 落位理由：沿用仓内 issue-scoped 契约文件惯例（`issue-347-*`、`issue-350-*`），保留 #347 文件字节稳定；
  若 SA1 改为扩展 `runtime-mutate-root-sequencer.test.ts` / `runtime-close-lifecycle.test.ts` 等既有文件，
  必须在设计中显式给出并回写本契约（用例 ID 不变）。
- 命名不含 `-red`：本票无红灯相（§13），命名不得声称红色契约；文件名语义由 SA1 复核。
- 复用：`./real-persistence-scheduler.js`、`createMemoryPersistence`、`createNamespaceRuntimeWithSeam`、
  `createBoundedMemoryDiagnosticLog`（`../../namespace-diagnostic-log/src/index.js`）；fixture 与 §4 一致。

### 12.2 K 组 — 写序列器竞争与 FIFO 独占（AC4/AC1/AC2/AC3）

| 用例 | 最小输入 | 可观察断言 | HEAD 预期 | 目标预期 |
|---|---|---|---|---|
| K1 单操作双写竞争 | 同 fixture；`p1 = mutateData({op:'set',path:['tasks','t1','status'],value:'reviewing',guard:{path:['tasks','t1','status'],equals:'open'}})`；`p2 =` 同 guard、value `'blocked'`；背靠背后 `await Promise.all` | ① `r1 = {ok:true}`；② `r2.ok===false`、`issues.length===1`、`issues[0].code===docRuntime.MUTATION_GUARD_MISMATCH==='MUTATION_GUARD_MISMATCH'`、`issues[0].path` 深等 guard 路径；③ `readData(['tasks','t1','status']).value==='reviewing'`；④ `update` 事件恰 1、notifier 恰 1；⑤ 诊断恰 2 条 attempt：`[transaction, committed, effect:'update', result.update.payloadLength===updates[0].length]` 与 `[validation, rejected, record.code===undefined, issues.items.length===1, items[0].code=稳定码, items[0].path=guard 路径]` | **绿**（probe P-A） | 绿 |
| K2 拒绝零写入隔离 | K1 之后同一 fixture：再发一笔 stale `equals:'open'` 的 guarded set | `ok:false`+稳定码+path；`Y.encodeStateAsUpdate` 与 K1 后逐字节相等；`update` 事件数不变；notifier 数不变；`readData` 值仍 `'reviewing'` | **绿**（probe P-A `rejectZeroWriteInPlace:true`） | 绿 |
| K3 三写交错（无第三写插入） | 背靠背 `pA`（guarded `equals:'open'`→`'reviewing'`）、`pB`（无 guard set `'closed'`）、`pC`（guarded `equals:'open'`→`'archived'`）；`Promise.all` | `rA={ok:true}`、`rB={ok:true}`、`rC` 带码拒绝且 message 含实际值 `"closed"`；终值 `'closed'`；`update` 事件恰 2；notifier 恰 2 | **绿**（probe P-E） | 绿 |
| K4 FIFO 槽级证据（seam） | 同 K3，但装配 `replicationObservability{stageClock,slotMetrics}`；ready 后清空样本 | 窗口内 `slotKind==='S'` 样本恰 3 条、`queueDepthAtStart` 依次 `[3,2,1]`；样本序 = 入队序；`runMs`/`waitMs` 为 number；`allSlotKinds===['S','S','S']`；业务结果同 K3 | **绿**（probe P-E） | 绿 |
| K5 批量竞争 + 单条 rejected 诊断 | 背靠背 `p1/p2 = mutateData({ops:[set status v, set n=7, array-insert values@1 [9]], guard:{path:['tasks','t1','status'],equals:'open'}})`（v=`'reviewing'`/`'blocked'`）；`Promise.all` | ① `r1={ok:true}`；② `r2.ok===false`、恰 1 issue、`code`=稳定码、path=guard 路径；③ 终态仅含胜者批：status `'reviewing'`、n `7`、values `[1,9,2,3]`；④ `update` 事件恰 1 且 `updates[0].length===committed 记录 result.update.payloadLength`；⑤ notifier 恰 1；⑥ 诊断恰 2 条：1 committed/transaction（effect update）+ 1 rejected/validation（恰 1 issue item 带码） | **绿**（probe P-D：updates=1、lens [64]、records=2） | 绿 |
| K6 批量成功路径单条 update bytes | 单次 `mutateData({ops:[3 合法 op], guard:{…equals:'open'}})` | `{ok:true}`；三项落盘；`update` 事件恰 1；committed 记录 `effect:'update'` 且 `payloadLength===updates[0].length`；notifier 恰 1 | **绿**（probe P-D 胜者侧 + #347 E4） | 绿 |

### 12.3 L 组 — lifecycle 接纳门次序（AC6）

| 用例 | 最小输入 | 可观察断言 | HEAD 预期 | 目标预期 |
|---|---|---|---|---|
| L1 closing 期 | `const cp = close()`（同步进入 `closing`）后立即 `mutateData(guarded 信封，guard 若被评估则满足)` | `ok:false`；`issues[0].message` 以 `RUNTIME_WRITE_DISABLED` 开头；字节不变；0 update、0 notifier；无 `transaction`/`validation` 记录；`await cp` 后 `lifecycle==='closed'` | **绿**（probe P-C） | 绿 |
| L2 closed 期 | `await close()` 后同 L1 输入 | 同 L1；拒绝文案含 `closed` | **绿**（probe P-C） | 绿 |
| L3 输入零访问 + acceptance 记录 | closing/closed 期传入 hostile Proxy（`get`/`ownKeys` 计数并 throw）作为 mutation | 调用**不抛**、返回 `ok:false`+`RUNTIME_WRITE_DISABLED`；Proxy 访问计数 `===0`；诊断记录 `stage==='acceptance'`、`code==='RUNTIME_WRITE_DISABLED'`、`result.kind==='rejected'`、`input.capture==='not-accessed'`；0 update、0 notifier | **绿**（probe P-C `proxyGets:0`） | 绿 |
| L4 close 排空窗口（已接纳 guarded 写） | 受控 notifier 门：`p = mutateData(guarded equals:'open')` 挂住于 S6；确认已提交值后 `close()`；closing 期再发一笔 guarded 写；放行门 | ① 挂住窗口内 `readData` 已见 `'reviewing'`；② closing 期新写 `RUNTIME_WRITE_DISABLED`；③ `p` 随排空 `{ok:true}`；④ `lifecycle==='closed'`；⑤ `update` 恰 1、notifier 恰 1；⑥ 记录含 1 acceptance 拒绝 + 1 transaction committed | **绿**（probe P-F） | 绿 |

### 12.4 N 组 — 非 fatal 与后续写能力（AC5）

| 用例 | 最小输入 | 可观察断言 | HEAD 预期 | 目标预期 |
|---|---|---|---|---|
| N1 拒绝后能力保留 + 重读重试 | 先一笔 guard 不满足（K1 的 p2 形态）→ `getStatus()` → 无 guard `set n=2` → guarded `equals:'reviewing'` 写 `'published'` | ① `status.fatal === null`；② `status.rootWrite.enabled === true`；③ 后续无 guard 写 `{ok:true}`；④ 重读重试 `{ok:true}` 且 `readData` 见 `'published'`；⑤ 全程无 fatal rejection / 无 unhandled rejection | **绿**（probe P-A） | 绿 |

### 12.5 D 组 — 诊断透传与 emitter 等价（AC3）

| 用例 | 最小输入 | 可观察断言 | HEAD 预期 | 目标预期 |
|---|---|---|---|---|
| D1 装配 emitter：rejected 变更尝试 | 两 fixture 之一装配 `diagnosticEmitter + clock`；单笔 guard 不满足（`equals:'draft'`，实际 `'open'`） | ① 业务结果 `ok:false` 单 issue 带稳定码与 guard path；② 诊断**恰 1** 条 attempt：`operation==='root-mutation'`、`stage==='validation'`、`result.kind==='rejected'`、record 级 `code===undefined`、`issues.policy==='full'`、`issues.items.length===1`、`items[0].code`=稳定码、`items[0].path`=guard 路径；③ 零写入（字节不变、0 update、0 notifier） | **绿**（probe P-B / #347 E3） | 绿 |
| D2 未装配 emitter：行为等价 | 另一 fixture 不装配 emitter/clock；同一 mismatch 信封 | ① `rWithout` 与 `rWith` **逐字相等**（JSON 深等）；② 零写入（字节不变、0 update、0 notifier、值仍 `'open'`）；③ 成功侧（guard 满足）两侧同为 `{ok:true}` | **绿**（probe P-B `resultsEqual:true`） | 绿 |

### 12.6 NC 组 — 负控锚（HEAD 绿，实现后必须保持）

| 用例 | 断言 |
|---|---|
| NC1 | 无 guard 单操作 `set n=2`：`{ok:true}`、readData 见 2、1 update、1 notifier |
| NC2 | guard 满足（`equals:'open'`）单操作：`{ok:true}`、值落盘、1 update（K 组拒绝断言的敏感度锚） |
| NC3 | 批量元素携带 guard：`ok:false`、`code===undefined`、零写入（ADR 0026 L29 冻结） |
| NC4 | `guard.equals` 含 NaN / undefined 值键经 `mutateData`：`MUTATION_INPUT_NOT_PLAIN_DATA`、record stage=`input-snapshot` 带顶层码、零写入（S3 分层冻结，禁止在 e2e 层断言无码形状错误） |

### 12.7 用例落位与组织方式（AC8）

- 新文件按既有 `describe` 组织：`K 组（竞争/FIFO）`、`L 组（lifecycle）`、`N 组（能力保留）`、`D 组（诊断）`、
  `NC 组（负控锚）`；测试内注释引用本契约用例 ID 与 ADR 行号（沿 #347 文件风格）。
- setup/teardown 与 #347 E2E 同款（memory persistence + seam + poll ready + handle.release/writer.dispose）。
- 不新增 skip/only/todo/env override；不引入 sleep 阈值断言。

### 12.8 AC 映射

| issue AC | 用例 |
|---|---|
| AC1 mutateData 携带 guard：满足 `ok:true`；不满足 `ok:false` + `MUTATION_GUARD_MISMATCH` + `issue.path` | K1/K2/K3/K5/K6、N1、NC2 |
| AC2 guard 拒绝零写入、后续读取值不变 | K2、K5、K3、L1/L2 |
| AC3 装配 emitter：rejected/validation + 稳定码；未装配等价（无诊断、拒绝照常） | D1、D2 |
| AC4 序列器竞争：第一成功、第二零写入拒绝；中间无第三写介入 | K1、K3、K4、K5 |
| AC5 拒绝不触发 fatal、不影响后续写能力 | N1 |
| AC6 closing/closed 期仍按 `RUNTIME_WRITE_DISABLED` 拒绝（guard 不改接纳门次序） | L1、L2、L3、L4 |
| AC7 批量 + guard：竞争拒绝零写入、诊断 rejected 单条、成功路径单条 update bytes | K5、K6 |
| AC8 用例落位 + 根 `pnpm typecheck` + 相关测试通过 | §12.1、§12.7、§14 |

### 12.9 SA1/SA3 义务（本契约不替设计决策的部分）

1. 落位裁决：默认新文件 `issue-349-guard-e2e-competition.test.ts`；若改为扩展既有文件，须在设计中显式给出并回写本契约。
2. **无红相纪律**：HEAD 全绿（§5/§13）；不得为制造红灯而改动生产实现、降低断言或引入 skip/only/env override。
   实现阶段任何一条 K/L/N/D 断言红 = **回归**（阻断性偏差）→ 停下升级 SA1，以 ADR 0025 为准裁定，不得就地放宽断言。
3. K4 依赖包内 `replicationObservability` seam（既有惯例）；SA1 若不接受 seam 观测，须给出等价可观察面（如公共面无法观测，则应保留 K3 为竞争主证并说明取舍）。
4. 冻结面：诊断 record schema 指纹、wire、写槽 R9 语义、lifecycle 接纳门次序、元素 guard 形状错误（NC3/NC4）与 #347 E1–E7 全绿。
5. 门槛：根 `pnpm typecheck` + `packages/namespace-runtime/test`（含新文件）+ 聚焦 3 文件（#347 E 组/sequencer/lifecycle）。

## 13. Red/green evidence

- **本轮无红灯相（诚实声明）**：HEAD `61e2daa` 上 §12 全部目标断言已成立（probe P-A…P-F，§5）。
  能力由 #347 落地，本票是验收证明/回归契约票。skill 与流水线禁止以 skip/only/todo/env override/源码字符串
  断言或降低断言制造伪红；因此本契约以「HEAD 绿」为冻结基线，`目标预期` 全绿。
- **绿（基线，运行时实测）**：聚焦 3 文件 29/29、namespace-runtime 全目录 50 文件 379/379、
  根 `pnpm typecheck` exit 0（§4）；probe 6 次运行结构一致（§7）。
- **断言敏感度（反向退化推理，替代不可执行的生产 mutation）**：

| 断言 | 能捕获的退化 |
|---|---|
| K1 `r2` 带码拒绝 + `updates===1` + 终值=胜者 | guard 评估移出槽/序列器并行化 → 两写都见 `'open'` 双双通过（TOCTOU 回归） |
| K3 三写 [ok,ok,reject] + 终值 `'closed'` + updates 2 | 槽序被并行化或 guard 读队列意图值 → 结果序列与终值改变 |
| K4 `queueDepthAtStart [3,2,1]` | 槽记账/入队序退化（并行/跳槽）→ 深度与样本序改变 |
| K5 批量拒绝恰 1 issue + 终态仅胜者 + updates 1 | guard 被移到逐 op prepare 之后 → 聚合多 issue 或部分落盘 |
| K1/K5 committed `payloadLength===updates[0].length` | 单事务不变量破坏（多次 update / 多事务） |
| K2/L1/L2 字节不变 + 0 update | 拒绝路径出现隐性写入 |
| L3 Proxy 访问 `===0` + stage=acceptance | 接纳门被移到输入读取/guard 解析之后 |
| N1 `fatal===null` + `rootWrite.enabled` + 后续写 `{ok:true}` | 拒绝被误分类为 internal fatal |
| D1 恰 1 条 rejected/validation + record 级无码 | R9 透传缺失、顶层码误加或 issues 泄漏 |
| D2 `rWith===rWithout` | 诊断装配反向影响业务结果 |
| NC1/NC2/NC3/NC4 | guard 能力回归（一律拒绝 / 一律放行 / 形状域坍缩 / S3 分层变化） |

## 14. Runner trigger evidence

- `vitest.config.ts` include `packages/*/test/**/*.test.ts`；新文件路径命中该模式，且同类 issue-scoped 文件
  （`issue-347-guard-passthrough-red.test.ts`、`issue-350-*.test.ts`）均已被真实收集（§4 实测 50 文件）。
- 聚焦基线：`NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run
  packages/namespace-runtime/test/issue-347-guard-passthrough-red.test.ts
  packages/namespace-runtime/test/runtime-mutate-root-sequencer.test.ts
  packages/namespace-runtime/test/runtime-close-lifecycle.test.ts`
  → `Test Files 3 passed (3)`、`Tests 29 passed (29)`、`Type Errors no errors`（1.30s）。
- 目录基线：`… vitest run packages/namespace-runtime/test` → `Test Files 50 passed (50)`、
  `Tests 379 passed (379)`、`Type Errors no errors`（25.91s）。
- 根门槛：`pnpm typecheck` → 14 个 tsconfig 顺序编译 `exit 0`。
- probe 入口（本轮证据来源，已删除）：
  `NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/tsx packages/namespace-runtime/probe-349.tmp.ts`
  → 最终版本连续 2 次运行 exit 0、结构输出一致（§7）。
- 与 issue AC8 对齐：实现落地后同一 runner 命令必须收集并跑绿新文件；`packages/namespace-runtime/tsconfig.json`
  含 `src/**/*.ts` + `test/**/*.ts`（新文件落在编译门内）。

## 15. Unknowns and blockers

| 项 | 状态 | 处置 |
|---|---|---|
| #349 无 SA8 产物（design/conflict/relevant_decisions 均不存在） | 已实测 | 契约由 brief + ADR + #347 冻结契约推导；SA8 若后续产出，须逐条与本契约对账，冲突以 ADR 0025 为准并回写 |
| 新测试文件命名（无 `-red` 后缀）与落位（新文件 vs 扩展既有文件） | 属 SA1 设计裁量 | 默认冻结新文件路径（§12.1）；SA1 可改名/改落位，但用例 ID 与断言不得削弱 |
| K4 槽级 seam 观测是否纳入正式验收 | 属 SA1 设计裁量 | 默认纳入（既有测试先例）；不接受时以 K3 为主证并说明公共面可观测性取舍 |
| message 摘要格式（稳定码前缀 + 期望/实际文案） | ADR 只要求含摘要 | 契约主断言锚 `code`/`path`；message 仅断言含稳定码与前缀（K 组）与 K3 含实际值文本；格式细节属 SA1 裁量 |
| 跨实例复制、`replaceSchema`、wire | ADR 0025 L64–66 边界外 | 零测试、零断言 |

无阻塞项：环境完备、目标行为 100% 可复现、契约可执行、负控全绿、测试入口真实；生产实现零改动为预期。

## 16. Temporary diagnostics cleanup

- 临时 probe（**已删除**）：`packages/namespace-runtime/probe-349.tmp.ts`。
- 临时诊断目录（**已删除**）：`.scratch/issue-349/`（probe 运行日志 6 份；关键输出已逐字留档于 §5/§13）。
- 生产实现零改动：`git status` 仅剩 Host 预置的 `wiki/raw/task_issue-349.md` 与本报告。
- 依赖变更：`pnpm install --frozen-lockfile --prefer-offline` 仅物化 worktree `node_modules`（lockfile 未改）。
- 长命令/后台作业：typecheck、目录测试与 probe 均经后台作业运行并已回收；无遗留进程、无服务、
  无 nohup/setsid/PID 文件。
