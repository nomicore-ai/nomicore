# SA9 标准审查报告 — issue #349 最终交付（条件写端到端：mutateData 透传、诊断 rejected 与写序列器竞争证明，guard III）

- **阶段**：standards-review（SA9，iteration 0）| **Dispatch**：sa-d168d4da-0df5-4d30-a6c9-394fde347d65 | **日期**：2026-09-13
- **Verdict**：**approve**（无 BLOCKER / 无 MAJOR；2 项非阻断观察均为上游文本级、已按既定路径路由，见 §5）
- **审查对象**：最终交付提交 `9eb819f`（`test(namespace-runtime): prove guarded mutation competition`），父提交 = Parent PR #346 权威 head `61e2daa37e21b467e7ce130d5c4db7be38bde982`（与 dispatch 重取一致；`git log` 实测直接父子关系）
- **交付面**：`git diff 61e2daa..9eb819f` = 9 文件、全新增、零删除零修改——生产/测试**代码产物仅 1 个**：`packages/namespace-runtime/test/issue-349-guard-e2e-competition.test.ts`（806 行，17 用例）；其余 8 个为 wiki 流程产物（design/sa2/sa3/sa4/sa6/sa7/conflict_report/relevant_decisions）。工作树仅剩 Host 预置 brief `wiki/raw/task_issue-349.md` untracked
- **输入（全部读过）**：brief `task_issue-349.md`（AC1–AC8）、SA1 设计 iteration 1、SA2 复审（approve，F1/F2 核销）、SA3 实现报告、SA4 静态审查（approve）、SA6 冻结契约（§12.0–§12.9）、SA7 动态验证（approve）、SA8 conflict_report（**clear**，RA#1–#4）+ relevant_decisions、交付测试文件全文 806 行精读
- **独立核验（本评审执行，非转抄）**：交付 diff 逐文件清点；冻结面 `git diff` 实测（#347 锚逐字节、src/docs/config/lockfile 零改动）；`createNamespaceRuntimeWithSeam` seam 校验面（`runtime.ts` L790–816）与测试注入形态对照；`mutateData(mutation: unknown)` 签名（`runtime.ts` L178/L512）；`MUTATION_GUARD_MISMATCH` 公共导出（`doc-runtime/src/index.ts` L23）；稳定码断言惯例（#347 先例 vs `../src/errors.js` 导入派）；vitest/tsconfig/package.json 门槛机制逐项磁盘核对；ADR 0025 L49/L51/L58/L60/L74/L90、ADR 0026 L29/L34–36/L46、ADR 0008 L40/L97/L99/L101/L125 行号引用抽查；memory adapter `updateCapture ?? false`（L165）/缺省退化（L217–221）核对；log 构造钉死 10/10 调用点 grep；纪律 grep（skip/only/todo/setTimeout/sleep 零命中）
- **纪律声明**：本评审未修改任何代码/设计/测试，未运行测试，未启动服务，未调度其他 SA；唯一写产物为本文件

---

## 1. Dispatch 交办逐项裁决

| 交办项 | 实测 | 裁决 |
|---|---|---|
| 读 task brief 与固定位置产物/diff | §输入清单全部读取；diff 经 `git diff 61e2daa..9eb819f` 独立清点 | ✅ |
| Issue comments（REST 预读为空）→ 无 owner 反馈要求 | 各上游产物一致登记「comments 为空」；无 owner override 输入 | ✅ 无遗漏映射面 |
| Parent PR #346 head = `61e2daa`，最终交付基于它 | `git log` 实测 `9eb819f` 的直接父即 `61e2daa` | ✅ |
| 只判标准合规（AGENTS/ADR/模块责任/惯例/单一事实源/生命周期对称/文件范围/测试质量）；需求完整实现属 SA10 | 本报告 §2–§4 仅裁标准面；AC 覆盖度只在「断言纪律未被削弱」维度引用冻结契约，不做需求完成度裁决 | ✅ |

## 2. 仓库与工程标准合规

| 标准 | 证据 | 裁决 |
|---|---|---|
| 根 AGENTS：改 `packages/` 前读就近 AGENTS.md | `packages/namespace-runtime/AGENTS.md` 已对照（Contract/Boundaries/Verification 三节逐条） | ✅ |
| namespace-runtime AGENTS「Preserve one strict FIFO…Reads stay outside that sequencer」 | 测试只**观测** FIFO（K4 seam 槽样本 `['S','S','S']`/`queueDepthAtStart [3,2,1]`），不实现不定序；终值读取全部经 `readData` 公共读面（不进 sequencer） | ✅ |
| namespace-runtime AGENTS「close() 同步停接纳…drains accepted slots, releases exactly once, idempotent」 | L1–L4 逐条断言该契约：同步 `closing`、closing/closed 期 `RUNTIME_WRITE_DISABLED`、已接纳 guarded 写排空 `{ok:true}`、`isReleased===true`、teardown 二次 release 幂等安全（`persistence/lifecycle.ts` L157–161 在先例中核实） | ✅ |
| namespace-runtime AGENTS「test seams remain internal / 公共面只暴露 detached 投影」 | K4 观测经**包内** `createNamespaceRuntimeWithSeam` 注入 `replicationObservability{stageClock,slotMetrics}`（ADR 0008 L97/L101 明示合法；先例 `sequencer-slotkind-close-barrier.test.ts` 同款）；零新增公共观测面；`seam as never` 注入形态与 #347 L85 先例逐字同构 | ✅ |
| namespace-runtime AGENTS Verification（聚焦面 + 根 `pnpm typecheck`/`pnpm test`） | 本票为纯测试新增、非 runtime/replication 契约变更；即便如此 SA3 V4/V5 与 SA7 V4'/V5' 各自独立实测根 typecheck exit 0、根 `pnpm test` 350 文件 3703 例全绿；目录运行 51 文件含 sequencer/lifecycle/acceptance 全部聚焦面 | ✅ |
| ADR 0025（条件写主决策） | L49/L51（FIFO 独占原子性、guard 见最新 committed 值）→ K1/K3/K4/K5；L58（稳定码 + issue.path + 零写入单 issue）→ K1②/K2/K5②/D1；L60（R9 透传 stage=validation/rejected、写槽零改动、无 fatal 面）→ D1/N1 + 交付零生产改动；L74（两形态顶层 guard、批内元素禁）→ K5/K6/NC3；L90（namespace-runtime 写槽透传与序列器竞争测试 + 根门槛）→ 本票即兑现票。行号引用抽查全部与 ADR 原文相符 | ✅ |
| ADR 0026（批量原子性） | L29 批内元素禁 guard → NC3（无码形状错误、零写入）；L34–36 任一失败整体零写入 → K5③；L46 一槽=一次尝试=一条记录、单事务单条 update bytes → K5④⑥/K6（`payloadLength===updates[0].length`） | ✅ |
| ADR 0008（sequencer/lifecycle） | L40 唯一严格 FIFO → K 组；L97/L101 包内 seam 合法、status 不暴露队列 → K4 只经 seam 注入观测；L99 close 幂等/同步 closing/队尾 barrier/无条件排空/release 恰一次 → L1/L4；L125 `RUNTIME_WRITE_DISABLED` 统一码族 message 区分域 → L1（含 `closing`）/L2（含 `closed`） | ✅ |
| ADR 0011/0014（诊断） | 0011 L18–27 诊断不改变业务结果 → D2 `rWith===rWithout` 双等值（deep + JSON 文本）；0014 + 包 AGENTS record schema 指纹冻结 → 只断言既有字段（stage/result/issues/code/path/payloadLength），诊断包零触碰（diff 实测） | ✅ |
| 模块责任归属 | guard 评估归 doc-runtime（测试全经 `mutateData` 端到端，无 doc-runtime 直打）；定序归 sequencer（测试只读 seam 样本，零回流）；诊断透传归写槽 R9 + 诊断包（只断言既有字段）；log 构造选项属消费方 fixture 责任（SA2 F2 归属，10/10 调用点钉死） | ✅ |
| 既有架构惯例 | issue-scoped 契约文件先例（`issue-347-guard-passthrough-red.test.ts`、`issue-350-*`）同模式落位；fixture helpers（makeDoc/setup/teardown/readOk/bytesOf/failureOf/waitAttempts）与 #347 逐行同构；seam 注入、`.js` 导入说明符（磁盘 `.ts`）、unhandledRejection 探针（`registry-idle.test.ts` L120–130 先例）全部沿既有惯例 | ✅ |
| 单一事实源 | 稳定码 `MUTATION_GUARD_MISMATCH` 双锚（doc-runtime 公共导出 + 冻结字面量，SA6 §12.0 冻结口径；导出实测在 `index.ts` L23）；`RUNTIME_WRITE_DISABLED`/`MUTATION_INPUT_NOT_PLAIN_DATA` 用局部字面量——与 #347 先例及 SA6 §12.0 冻结字面口径一致（仓内 `../src/errors.js` 导入派与字面派并存，本文件归属后者且被契约冻结）；槽序/深度单源在 sequencer，测试侧为只读 sink；文档状态单源 live Y.Doc，测试内快照不外泄 | ✅ |
| 生命周期对称性 | 每用例独立 fixture：setup（createDoc + seam + poll ready）↔ teardown（`handle.release()` + `writer.dispose()`）；L4 门 Promise `finally` 恰一次放行（L590–593）；N1 unhandledRejection 探针 `finally` dispose；D2 双 fixture 双 teardown；无跨用例可变状态 | ✅ |
| 文件范围（设计 §11 ALLOW/DENY = SA8 RA#1/#3） | ALLOW 第 1 行精确命中（同路径同名新建，命名无 `-red`，符合「无红相不得声称红色契约」）；DENY 全合规实测：`git diff --name-only 61e2daa 9eb819f -- 'packages/*/src/**' 'domains/**' 'apps/**' 'docs/**' vitest/tsconfig/package.json/lockfile` = **0 行**；#347 冻结锚 `git diff --quiet` 逐字节一致（NC5）；未以「补 test include」为名改动任何 tsconfig（SA2 F1 警示） | ✅ |
| SA8 RA#2（根门槛收口，不以聚焦/目录替代） | SA3 V1–V5 + SA7 独立复现：聚焦 4 文件 46 例、目录 51 文件 396 例、根 typecheck exit 0、根 `pnpm test` 350 文件 3703 例全绿；SA7 GATE-2/3/4 注入对照证明 vitest typecheck 程序对新文件 fail-closed（目录/根级 exit 1） | ✅ |
| SA8 RA#4（落位裁量） | 接受 SA6 §12.1 冻结默认路径、零偏离 → 无需回写契约；用例 ID 与断言逐条按 §12.2–§12.6 落地，SA4 复核「无一条削弱、多处严格增强」 | ✅ |

## 3. 测试质量标准

- ** runner 收集真实**：`vitest.config.ts` L15 include `packages/*/test/**/*.test.ts` 命中新文件；SA7 实测目录 51 文件（46 `.test.ts` + 5 `.test-d.ts`）含新文件、17/17 逐用例 ✓。
- **类型检查覆盖真实**：新文件落在根 `tsconfig.typecheck.json` 程序内（include 含 `packages/*/test/**/*.ts`，磁盘实测）；`mutateData(mutation: unknown)` 签名（`runtime.ts` L178）使 hostile Proxy 输入合法过类型门；SA7 门存活对照（注入类型错误 → 目录/根 exit 1）证明 fail-closed。
- **断言质量**：全部断言观察运行时行为（结果联合、readData 值、Y.Doc 字节、update 事件、notifier 计数、诊断 record、seam 槽样本）；零写入三件套（字节不变 + 0 update + 0 notifier）贯穿 K2/L1/L2/NC3/NC4/D1；码载体口径（issue 级带码 / record 级无码 / 形状错误无码 / S3 record 顶层码）分层正确。
- **确定性**：并发全部 `Promise.all` 背靠背入队（FIFO 定序唯一决定结果）；等待仅 `expect.poll`（ready/notifier/记录数）；纪律 grep 实测零 `skip/only/todo/setTimeout/sleep`、零 `expect.soft`、零 fs 读源码断言；SA7 连续 4 次运行（含整机负载 load avg 1.41）结果同构，L4 最长 16ms ≪ 5000ms 默认超时。
- **敏感度双向锚**：NC2（满足）vs K1/K5（拒绝）互为反向退化对照；K4 深度递降 `[3,2,1]` + `allSlotKinds` 兜底杂槽（NC6）；L3 hostile Proxy 计数 `===0` 对接纳门次序有真实判别力。
- **log 构造钉死（SA2 F2）**：10 处 `createBoundedMemoryDiagnosticLog` 全部在用例调用点构造 `({ inputPolicy:'digest', updateCapture:true })`（grep 逐条核验），helper 内零构造、经 `setup({ log })` 注入——与 `memory.ts` L165（缺省 false）/L217–221（缺省退化 `update-omitted` 无载体）对齐，committed 记录 `update` 载体断言前提成文且落实。

## 4. 需求覆盖度的标准面边界声明

按角色边界，AC1–AC8 的需求完成度裁决属 SA10；本评审仅确认：冻结契约（SA6 §12.2–§12.6）的 17 用例 ID 与断言口径在交付文件中逐条在位、无削弱（SA4 §3/§9 已逐条核销，本轮抽查 K1②/K4/L4/NC4 与契约原文一致）；断言纪律（无 skip/only/降断言/源码字符串/sleep 阈值）grep 实测合规。AC 是否「完整实现」不在本报告下判。

## 5. 发现（全部非阻断）

| # | 严重度 | 观察 | 处置路由 |
|---|---|---|---|
| O1 | MINOR（非阻断，上游文本） | 交付 commit 内含的 SA6 契约文本 §14（L335–336）仍存「`packages/namespace-runtime/tsconfig.json` 含 `test/**`」的磁盘事实错误表述（实况仅 `src/**`，本轮实测 4 行文件）。该错误已在设计 §5、SA3 报告、SA4 M-5 三处如实登记，实现未据此行动（DENY LIST 合规、零 tsconfig 改动），真实覆盖机制（vitest typecheck 程序）经 SA7 GATE 对照证明在位 | 已路由 Controller 转告 SA6 在后续票修正契约文本；不构成本票交付缺陷 |
| O2 | MINOR（非阻断，上游文本） | SA7 F-1：设计 §7 D4「聚焦运行、目录运行与根 pnpm test 都执行该程序检查」对 `.test.ts`-only 聚焦运行不精确（vitest 3.2.7 仅当选择集含 `.test-d.ts` 时才运行 tsc）。强制门（目录 + 根 `pnpm test`）的选择集恒含 `.test-d.ts`，新文件覆盖与门存活已由 SA7 GATE-2/3/4 实证（exit 1，fail-closed）——机制无缺口，仅文本精确化问题 | 已随 SA7 报告路由 Controller 转告 SA6/SA1 后续票修订文本；不影响本票 AC8 门槛结论 |

非发现登记（核查后关闭的候选项）：① `seam as never` / `handle as unknown as { isReleased: boolean }` 窄转换——包内测试 seam 与释放事实观测的既有先例（#347 同构 + 设计 §7 D5 N1 备选 (a) 授权），读取的 getter 实存（`lifecycle.ts` L163），非公共面泄漏；② K5⑥ 未重复断言诊断 `items[0].path`——冻结文本不要求，K1⑤/D1 已覆盖该字段（SA4 M-3 同款结论）；③ K4 `samples.length = 0` 清窗——P0 flush 微任务序论证经 SA4 §8#5 复核、SA7 负载实测稳定；④ wiki 产物随交付 commit 入仓——仓内既有惯例（`git log --diff-filter=A -- wiki/raw/` 显示历史任务同法）。

## 6. 结论

**approve**。最终交付 `9eb819f`（基于权威基线 `61e2daa`）在全部标准面合规：零生产改动纪律（SA8 RA#1 + ADR 0025 L60）经 diff 实测成立；单一代码产物精确命中 ALLOW LIST 唯一授权路径；DENY LIST（src/**、#347 冻结锚、诊断包、ADR/CONTEXT/协议、工具链配置、lockfile）零触碰；ADR 0025/0026/0008/0011/0014 与包 AGENTS 边界的消费方式全部为「只断言不触碰」；单一事实源、生命周期对称、模块责任归属与既有测试惯例逐项相符；测试质量（收集真实、类型门覆盖真实、确定性、双向敏感度锚、断言纪律）满足仓库标准；SA8 RA#1–#4 全部兑现且根门槛经 SA3/SA7 双份独立运行证据收口。2 项 MINOR 均为上游产物文本级精确化事项，已按既定路径路由，不阻断放行。`requiresConflictRecheck`：**false**（零生产改动、零决策面触碰、零 ADR 冲突新风险，与 SA8 §10 同口径）。
