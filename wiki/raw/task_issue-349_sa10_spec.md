# SA10 独立 Spec 审查 — issue #349 条件写端到端：mutateData 透传、诊断 rejected 与写序列器竞争证明（guard III）

| 项 | 值 |
|---|---|
| 审查对象 | 已提交最终 diff：commit `9eb819f`「test(namespace-runtime): prove guarded mutation competition」（分支 `mabf/issue-349`，工作区干净，仅 Host brief 未跟踪）；父提交 `61e2daa37e21b467e7ce130d5c4db7be38bde982`（Parent PR #346 head，与 dispatch 复核值一致） |
| 审查基准 | issue #349 正文 + AC1–AC8（`wiki/raw/task_issue-349.md`）；ADR 0025（含 0026 组合节）、0008、0011/0014；SA6 验收契约（approve，§12.0–§12.9 冻结）；SA1 设计 iteration 1（SA2 approve）；SA8 前置门禁（clear）；`packages/namespace-runtime/AGENTS.md` |
| Owner 评论 | 无（dispatch 预读确认 REST 为空）——无额外映射义务 |
| 审查方式 | 静态审查（SA10 纪律：不运行测试、不改代码/设计/测试）；对交付 diff 全文精读并对生产源码锚点独立抽查（mutation.ts / runtime.ts / write.ts / sequencer.ts / diagnostic.ts / record.ts / projection/input.ts）；动态证据引用 SA7 报告并核对其被审对象（新文件 sha256 `76021f34…36ba`、806 行）与 committed 文件一致 |
| **Verdict** | **approve**（AC1–AC8 全达成；无 unmet/partial/unachievable 项；无 scope creep；§6 三项 MINOR 均不阻断，列入 PR 披露） |

---

## 1. Diff 范围核对（无 scope creep）

`git diff 61e2daa..HEAD`：新增 1 个测试文件 + 8 个 wiki 证据文书，**生产面零改动**：

- `packages/namespace-runtime/test/issue-349-guard-e2e-competition.test.ts`（+806，新建）：SA6 §12.2–§12.6 冻结的 17 用例（K1–K6 / L1–L4 / N1 / D1–D2 / NC1–NC4）+ #347 同款 fixture 与三处 seam 输入侧扩展（samples 槽观测 / notifyGate 门 / hostile Proxy 工厂）。
- wiki 文书 8 件：design / sa2 / sa3 / sa4 / sa6 / sa7 / conflict_report / relevant_decisions（流水线固定产物）。
- **DENY 面零改动**（diff stat 实证）：`packages/**/src/**` 改动数 = 0；#347 冻结锚 `issue-347-guard-passthrough-red.test.ts` 逐字节未动（NC5）；诊断包 / wire / ADR / CONTEXT / `vitest.config.ts` / `tsconfig*.json` / `package.json` / lockfile 全部未触。
- 与 issue「What to build」的零改动预期逐字相符：「本票不改 doc-runtime 语义；namespace-runtime 实现预期零改动（透传与诊断走既有管线）」——交付恰为纯验收证明面固化，无半成品、无超范围生产变更。

## 2. Issue AC 逐条核对

| AC | 实现落点（committed 测试） | 判定 |
|---|---|---|
| AC1 guard 透传：满足 `ok:true`；不满足 `ok:false` + `MUTATION_GUARD_MISMATCH` + `issue.path`=guard 路径 | K1②（L289–296：恰 1 issue、码三重锚——字面量 / `docRuntime.MUTATION_GUARD_MISMATCH` 导出同源 / issues[0].code 位、path 深等 guard 路径）；K2/K3/K5②、N1④、D1 复证；NC2 满足侧敏感度锚 | ✅ met |
| AC2 拒绝零写入、后续读取值不变 | K2（L329–341：`Y.encodeStateAsUpdate` 逐字节不变 + update/notifier 计数不变 + `readData` 值仍 `'reviewing'` 三件套，SA6 §12.0 冻结口径）；K5③④、L1/L2 | ✅ met |
| AC3 装配 emitter：rejected/validation + 稳定码；未装配等价 | D1（L659–668：恰 1 attempt、`operation==='root-mutation'`、stage=validation、`result={kind:'rejected'}`、record 级 `code===undefined`、`issues.policy==='full'`、items[0] 带码带路径）；D2（L689–710：`toEqual` + `JSON.stringify` 双相等、两侧零写入、成功侧同 `{ok:true}`） | ✅ met |
| AC4 序列器竞争：第一成功、第二零写入拒绝、中间无第三写介入 | K1（背靠背双写：r1 ok / r2 带码拒绝、updates 恰 1、终值=胜者）；K3（三写交错 `[ok,ok,带码拒]`、message 含实际值 `'closed'`、终值=中间写、updates 恰 2）；K4（seam 槽样本 `['S','S','S']`、`queueDepthAtStart [3,2,1]`——深度单调递降 = 严格串行无跳槽的槽级直接证据、waitMs/runMs number、NC6 无杂槽）；K5（批量竞争） | ✅ met |
| AC5 拒绝不触发 fatal、不影响后续写能力 | N1（L615–633：`fatal===null`、`rootWrite.enabled===true`、后续无 guard 写 ok、重读重试 ok 且 `'published'` 落盘、显式 unhandledRejection 探针 0 事件） | ✅ met |
| AC6 closing/closed 期仍按 `RUNTIME_WRITE_DISABLED` 拒绝（guard 不改接纳门次序） | L1（closing：`close()` 返回前同步 `closing`、码族前缀 + 文案含 `closing`、字节不变、0/0、无 transaction/validation 记录、acceptance 四件套）；L2（closed 同款、文案含 `closed`）；L3（hostile Proxy `accesses()===0` 不抛、acceptance/`not-accessed`）；L4（排空窗口：挂住期已提交值可读、closing 新写拒、放行后 `p={ok:true}`、`isReleased===true`、1 acceptance + 1 committed） | ✅ met |
| AC7 批量 + guard：竞争拒绝零写入、诊断 rejected 单条、成功路径单条 update bytes | K5（② 恰 1 issue 带码带路径；③ 终态仅胜者批三项 status/n/values；④ updates 恰 1 且 `payloadLength===updates[0].length`；⑥ 恰 2 条：committed/transaction + rejected/validation 恰 1 issue 条目）；K6（成功侧三项落盘、updates 恰 1、载体长度一致、notifier 恰 1） | ✅ met |
| AC8 用例落位 + 根 `pnpm typecheck` + 相关测试通过 | 落位 SA6 §12.1 冻结路径（issue-scoped 惯例，命名无 `-red`——本票无红灯相）；describe 按 K/L/N/D/NC 分组、逐用例注释引用契约 ID 与 ADR 行号。门槛：SA3 V4/V5 声明根 `pnpm typecheck` exit 0 + 根 `pnpm test` 350 文件/3703 用例全绿；SA7 G4/G5 独立重跑逐项复现（聚焦 4 文件 46 例、目录 51 文件 396 例、新文件含负载 4 次连绿）；SA7 GATE-4 注入对照证明根收口门对新文件类型错误 fail-closed（exit 1） | ✅ met |

## 3. 规范条款核对（ADR 0025/0026/0008/0011）

| 条款 | 核对结果 |
|---|---|
| ADR 0025 L48–49 评估在写槽内、原子性来自写序列器 FIFO 独占（非 Yjs 事务） | ✅ K1/K3/K4/K5 全部经 `mutateData` 端到端观察该语义；K4 深度 `[3,2,1]` 与 `sequencer.ts` L118「含本槽自身」记账语义逐点对上（本席独立抽查源码核实） |
| ADR 0025 L58 不满足 → 零写入单 issue、稳定码、`issue.path`=guard 路径 | ✅ K1②/K5②/D1 断言与 `mutation.ts` L726–728（`code: MUTATION_GUARD_MISMATCH`、`path:[...guard.path]`）逐字相符 |
| ADR 0025 L60 诊断经写槽 R9 同源透传（stage=validation、result=rejected） | ✅ D1/K1⑤/K5⑥ 断言与 `write.ts` L205–208（R9 `diagValidation` 后同源返回）+ `diagnostic.ts` L271–274（`diagValidation` 无顶层 code）一致 |
| ADR 0025 L74 + 0026 L29 顶层 guard 两形态适用、批内元素禁 guard | ✅ K5/K6 顶层批量正例；NC3 元素 guard 形状错误无码零写入（冻结面保持） |
| ADR 0025 L90 验证门槛（namespace-runtime 写槽透传与序列器竞争测试 + 根门槛） | ✅ 本票交付物即兑现该门槛缺口；根门槛证据经 SA7 独立复现（见 §2 AC8 行） |
| ADR 0008 唯一严格 FIFO / close 同步停接纳 + 已接纳任务无条件排空 / 包内 seam 观测合法 | ✅ K3/K4 FIFO；L1–L4 停接纳与排空；K4 经 `createNamespaceRuntimeWithSeam({replicationObservability})`（`runtime.ts` L84–85/L104/L790–816 校验面核实），不新增公共面 |
| ADR 0011/0014 rejected 变更尝试记录、record schema 指纹冻结 | ✅ 只断言既有字段（stage/result/code/issues.policy/items/input.capture/payloadLength）；诊断包零 diff，指纹面未触 |
| `packages/namespace-runtime/AGENTS.md` 边界（读取在序列器外、普通校验失败零写入、close 排空、公共面只暴露分离投影、seam 内部） | ✅ 测试为公共 API + 包内 seam 的只读新消费方；零生产改动 ⇒ 全部边界不变式保持 |

## 4. 冻结契约逐条核对（SA6 §12.2–§12.6）

17 条冻结用例全部落位，**无一条削弱**，多处严格增强：

- **K1–K6**：输入形态与可观察断言逐条对上；K1⑤ 在冻结口径外补 `issues.policy==='full'` 锚（增强）；K4 的「样本序=入队序」由 `queueDepthAtStart` **依次** `[3,2,1]` 承载（冻结文本原口径即「依次」）；K5⑥ 冻结文本未要求 `items[0].path`（结果侧 path 已由 K5② 锚定）。
- **L1–L4**：L1 补 message 含 `closing`（增强）；L3 补 `issues.items[0].path===[]`（增强）；L4 六断言 + `isReleased` 观察点（设计 §7 D5 备选 (a)，SA3 已声明）。
- **N1 / D1–D2**：D2 在 JSON 深等外补文本相等（增强）。
- **NC1–NC4**：负控锚全绿面断言在位，NC2/K1 双向敏感度锚成对（一律拒绝→NC2 红；一律放行→K1/K5 红）。
- **无红相纪律**：SA6 §13 诚实声明（HEAD 全绿）与 SA3 首跑 17/17 绿相互印证；无 skip/only/todo/env override、无源码字符串断言、无 sleep 阈值断言（本席 grep 复核 0 命中）。
- **log 构造钉死**（SA2 F2）：10 处 `createBoundedMemoryDiagnosticLog` 全部调用点构造 `({inputPolicy:'digest', updateCapture:true})`，`setup()` helper 内零构造——伪回归陷阱（adapter 缺省 `updateCapture:false` → committed 退化为 `update-omitted`）已消除。

## 5. 上游义务与流水线一致性核对

- **SA8 前置门禁 clear；RA#1–#4**：RA#1 零生产改动 ✅（diff 实证）；RA#2 根门槛收口 ✅（SA3 V4/V5 + SA7 G4/G5）；RA#3 冻结面保持 ✅（#347 锚逐字节不动、诊断指纹未触、无断言降级）；RA#4 落位接受冻结默认路径（不偏离，无需回写契约）✅。
- **SA2 iteration 1 approve 的 F1/F2**：F1（typecheck 覆盖机制文本更正）——实现未触碰任何 tsconfig（DENY LIST 合规）；F2（log 构造钉死）——10/10 落实（§4）。
- **SA4 approve**（无 BLOCKER/MAJOR；M-1–M-5 非阻断）；**SA7 approve**（V1'–V5' 复现、负载 4 次连绿、GATE 对照 fail-closed、探针还原复验 sha256 一致）。
- **基线一致性**：交付 commit 父 = Parent PR #346 head `61e2daa`，与 dispatch 复核值一致；SA7 被审对象与 committed 文件 sha256 一致，证据链无断点。

## 6. MINOR 观察（不阻断 approve，列入 PR 披露）

| # | 观察 | 评估 |
|---|---|---|
| m-1 | L3 hostile Proxy 仅在 `closing` 相位执行（SA6 冻结行措辞为「closing/closed 期」） | 两相位走同一接纳门分支（`runtime.ts` D5.1，本席核实 L513–525），且 L1/L2 已分别钉住两相位拒绝行为与「无 validation 记录」（guard 未被评估）；AC6 证明面完整。SA4 M-1 同款结论：无需修订 |
| m-2 | vitest 3.2.7 的 tsc 仅在选择集含 ≥1 `.test-d.ts` 时运行；`.test.ts`-only 聚焦运行的 `Type Errors no errors` 为平凡真（SA7 F-1） | AC8 的强制门（根 `pnpm test` = `vitest run --typecheck`，选择集恒含 `.test-d.ts`）实测覆盖新文件且经 GATE-4 注入对照证明 fail-closed；仅影响 SA3 V1/V2 与 SA6 §14 聚焦基线行的证据解读，不构成门缺口。属 SA6/SA1 后续票契约/设计文本精确化事项（与 m-3 同族） |
| m-3 | SA6 §14 关于 `packages/namespace-runtime/tsconfig.json` 含 `test/**` 的表述与磁盘事实不符，仍留存于上游契约文本 | 未被实现沿用（设计 §5 与 SA3 报告均已登记）；磁盘实况 = 仅 `src/**`，新文件类型检查覆盖真实来源为根 `tsconfig.typecheck.json` 程序。SA4 M-5 同款：建议 Controller 转告 SA6 后续票修正文本 |

**PR 必须披露的未达成项：无。** 以上三项均为非阻断精确化/文本修正事项，不影响任何 AC 的达成判定。

## 7. 收尾声明

- 本审查为纯静态：未修改代码/设计/测试，未运行测试或服务，未创建临时进程；唯一写产物为本文件。
- 全部关键断言的真实性经生产源码锚点独立抽查核实（码定义与导出 `mutation.ts` L62/`index.ts` L23；槽样本语义 `sequencer.ts` L49–57/L118；R9 透传 `write.ts` L205–208；`diagValidation` 无顶层码 `diagnostic.ts` L271–274；接纳门零输入访问 + acceptance 记录 `runtime.ts` L513–525；seam 校验 `runtime.ts` L790–816；record 字段 `record.ts` L51–56、`projection/input.ts` L68）。
- 结论路由建议：**approve** 放行；m-2/m-3 转告 SA6/SA1 供后续票文本修正。
