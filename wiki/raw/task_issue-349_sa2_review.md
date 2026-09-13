# SA2 独立设计攻击评审 — issue #349（guard III）SA1 设计（iteration 1 复审）

- 评审对象：`wiki/raw/task_issue-349_design.md`（SA1，iteration 1——iteration 0 verdict reject 后的逐条修订稿）
- 评审人：SA2（独立攻击审查；未采信 SA1/SA6/SA8 任何断言为前提，F1/F2 涉及的全部磁盘事实与关键运行时锚点均由本轮独立复核）
- 基线：HEAD `61e2daa37e21b467e7ce130d5c4db7be38bde982`，worktree `/home/wangjian/nomicore-fix-issue-349`，分支 `mabf/issue-349`
- **Verdict：`approve`（iteration 0 的 F1/F2 两项 MAJOR 均已在本轮独立核验为已解决；未发现新的 BLOCKER/MAJOR；设计可安全进入实现）**
- `requiresConflictRecheck`：**false**（修订为纯事实性文本更正与 fixture 规格钉死，不新增决策面、不触碰任何 ADR 冻结面、不改 ALLOW/DENY）

---

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-349.md`（brief，issue #349 正文 AC1–AC8） | 已读 |
| `wiki/raw/task_issue-349_design.md`（iteration 1 修订稿，含文末评审修订映射） | 已读（本轮被审对象） |
| `wiki/raw/task_issue-349_sa6_contract.md`（approve，§12 冻结 K/L/N/D/NC 用例表） | 已读 |
| `wiki/raw/task_issue-349_relevant_decisions.md`（SA8 相关决策摘录） | 已读 |
| `wiki/raw/task_issue-349_conflict_report.md`（SA8 verdict **clear**，4 项 required actions） | 已读 |
| Issue #349 comments | 无（REST 预读为空，dispatch 明示） |
| 本评审 iteration 0 产物 | 已读（F1/F2 finding 原文，用于核销对账） |
| F1 事实独立复核 | `packages/namespace-runtime/tsconfig.json`（全文件 4 行）、根 `package.json` L11/L13（test/typecheck 脚本逐字）、`vitest.config.ts` L14–23、根 `tsconfig.typecheck.json` L1–9；typecheck 脚本 14 个 `tsc -p` 项目逐一清点 |
| F2 事实独立复核 | `namespace-diagnostic-log/src/adapters/memory.ts` L163–168（三策略缺省）/L199–230（physicalize/physicalizeUpdate：`!updateCapture` → `update-omitted`/`update-capture-disabled` 无载体）、`src/record.ts` L74–89（UpdateCarrier.payloadLength）/L94（committed+update 成员）、`src/carrier.ts`（`buildInlineCarrier` → `payloadLength: bytes.byteLength`）、`src/index.ts` L56（`createBoundedMemoryDiagnosticLog` 导出） |
| #347 先例独立复核 | `issue-347-guard-passthrough-red.test.ts`：L28（`.js` 导入说明符）、L32（log 导入）、L38（导出同源读法）、L53/L85/L112/L117/L123/L132/L137（makeDoc/setup({log})/teardown/readOk/bytesOf/failureOf/waitAttempts 全部在位）、L187/L242/L274（`{inputPolicy:'digest', updateCapture:true}` 三处调用点构造）、L188/L243/L275（`setup({ log })` 注入） |
| 运行时锚点独立复核（抽查+沿用 iteration 0 全量） | `runtime.ts` 接纳门（lifecycle≠ready 同步拒绝、零输入访问、emit acceptance、`enqueue(..., 'S')`）、`write.ts` R9 透传、`diagnostic.ts` diagValidation 无顶层码、`sequencer.ts` L91–92 G1 链形、`mutation.ts` L62 稳定码——逐一对上 |
| 计数复核 | `packages/namespace-runtime/test/`：45 个 `.test.ts` + 5 个 `.test-d.ts`（实测），无 `issue-349-*` 文件 |
| ADR/CONTEXT | ADR 0025（L49/L51/L58/L60/L64–66/L74/L90 抽查相符）、ADR 0026、ADR 0008、ADR 0011、0014、CONTEXT 词条 |
| 评审产物 | 本文件（iteration 1 原位更新；F1/F2 核销，正文不再列为阻断项） |

本评审按 SA2 纪律**未运行任何测试/服务/probe**；全部结论基于源码、配置与既有产物文本的独立核验。

---

## 2. Verdict

**approve**。

iteration 0 的两项 MAJOR 均为文本级修订要求，本轮逐一回源码核验：

1. **F1（typecheck 覆盖机制陈述）——已解决**。修订稿 §2 锚点表（vitest include+typecheck 程序 / `tsconfig.typecheck.json` / namespace-runtime tsconfig 实况三行）、§7 D4 门槛机制口径、§11 DENY 行、§12 AC8 行、§13 R5 五处全部改为真实机制，且与磁盘逐字一致：包级 tsconfig 仅 `src/**`（实测 4 行文件）；根 `pnpm typecheck` 实为 14 个 `tsc -p` 项目（package.json L13 逐项清点）且不覆盖本包测试；新文件类型检查覆盖来自 `vitest.config.ts` `typecheck.enabled:true` + `typecheck.tsconfig:'./tsconfig.typecheck.json'`（include 实测含 `packages/*/test/**/*.ts`）；根 `pnpm test` 实为 `vitest run --typecheck`（package.json L11）。全文 grep 无任何残留「包级 tsconfig 含 test/**」表述；SA6 §14 同款错误已在设计 §5 如实登记（登记内容与 SA6 契约 L335–336 原文核对相符）。
2. **F2（update-capture fixture 钉死）——已解决**。修订稿 §7 D5「log 构造钉死」条款以普遍规则（「凡构造诊断 log 的用例一律在用例调用点构造 `createBoundedMemoryDiagnosticLog({ inputPolicy: 'digest', updateCapture: true })`」）钉死，并同步进入 §8 数据流、§10 调用方矩阵、§12 断言纪律（含「记录断言红先核对构造再进 D3 判定」的排障次序）、§13 R1（伪红陷阱消除声明）五处。依据链与源码逐字相符：`memory.ts` L165 `config.updateCapture ?? false`、L217–221 缺省退化 `update-omitted`/`update-capture-disabled`（无 `update` 载体）、carrier `payloadLength === bytes.byteLength`；`issuesPolicy` 缺省 `'full'`（L164）对 D1 的影响亦如实说明。#347 三处调用点先例（L187/L242/L274）与「不在 helper 内、经 `setup({log})` 注入」的描述与实测一致。

修订未改动任何用例、断言口径、落位与 ALLOW/DENY 范围（修订稿 §1/文末映射自述「仅 F1/F2 文本级修订」经本轮对照成立）。iteration 0 已通过攻击的断言体系、时序论证、升级路径、架构归属与文件范围本轮未复检出新缺口。无 BLOCKER/MAJOR；2 项 MINOR 观察见 §14。

---

## 3. 需求覆盖

| Requirement | Design section | Assessment |
|---|---|---|
| AC1 mutateData 携带 guard：满足 `ok:true`；不满足 `ok:false` + `MUTATION_GUARD_MISMATCH` + issue.path | §1 目标 2、§12 AC1 行（K1/K2/K3/K5/K6、N1、NC2） | 覆盖；码载体口径与源码一致（`mutation.ts` L62；`runtime.ts` R9 同源透传）；导出同源断言沿 #347 L38 先例（实测在位） |
| AC2 guard 拒绝零写入、后续读取值不变 | §12 AC2 行（K2/K5/K3、L1/L2） | 覆盖；「字节不变 + 0 update + 0 notifier」判据与 #347 E3 同款（先例实测现役） |
| AC3 诊断 rejected（stage=validation、稳定码）+ 未装配 emitter 等价 | §1 目标 3、§12 AC3 行（D1/D2） | 覆盖；**iteration 0 的 F2 缺口已闭合**：D1/K 组记录断言的 fixture 前提（`updateCapture:true`）已钉死进 §7 D5/§12 断言纪律 |
| AC4 序列器竞争（TOCTOU 消除证明面） | §1 目标 1、§7 D2、§12 AC4 行（K1/K3/K4/K5） | 覆盖；机制链复核成立（`sequencer.ts` L91–92 G1 链形 + 写槽 S5 同槽评估/提交、S6 `await notifyDirty()` 后下一槽才开跑） |
| AC5 非 fatal、后续写能力保留 | §12 AC5 行（N1） | 覆盖；`status.ts` `fatal:null` / `rootWrite.enabled` 观察面在位 |
| AC6 lifecycle 接纳门次序不变 | §1 目标 4、§12 AC6 行（L1–L4） | 覆盖；`runtime.ts` 接纳门先于任何输入读取（emit `stage:'acceptance'`、`input:{status:'not-accessed'}`）实测相符 |
| AC7 批量 + guard 组合 | §12 AC7 行（K5/K6） | 覆盖；`mutation.ts` 顶层 guard 评估恰一次先于逐 op prepare 相符 |
| AC8 落位 + 根 typecheck + 相关测试 | §7 D4、§12 AC8 行 | 覆盖且高于 brief 下限（SA8 RA#2 收口）；**iteration 0 的 F1 陈述错误已更正为真实机制**（本轮磁盘逐项核验） |
| What to build：namespace-runtime 实现预期零改动 | §7 D3、§11 DENY LIST | 覆盖；升级路径（停 → ADR 0025 裁定 → 回 SA1 + 冲突复查）完整内化 SA8 RA#1 |
| 非目标不扩大 | §1 非目标 | 核实：零 wire/复制/replaceSchema/META 断言（ADR 0025 L64–66 边界）；不触碰开放问题 1–3 |

无需求遗漏；无静默扩大。

## 4. Owner评论覆盖

| Comment ID | Updated at | Design section | Assessment |
|---|---|---|---|
| （无——Issue comments 经 REST 预读为空，dispatch 明示） | — | §4（设计已如实登记） | 与 dispatch 一致；无 owner 反馈要求可映射 |

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| SA6 probe P-A…P-F：HEAD 上全部目标断言运行时成立（无红相） | §2「运行时已验证」+ §3 Step 4/5 + §7 D3 无红相纪律 | 承接正确；SA6 声称的运行时行号锚经本轮抽查复核相符 |
| SA6 §8 Step 3：证明面在测试语料不存在 | §3 Step 2 | 独立复核相符：实测 45 个 `.test.ts`、0 个 `issue-349-*` |
| **SA6 §14 工具链事实错误**（「namespace-runtime tsconfig 含 src + test」——与磁盘相反，该文件仅 `src/**`） | 设计 §5 末行登记矛盾 + §2/§13 R5 以真实机制改写，明示「不再沿用其结论」 | **登记属实**：SA6 契约 L335–336 原文核对一致；设计处理方式正确（错误属证据陈述而非决策面，登记供 Controller 对账即可，无需 SA6 重跑） |
| SA8 RA#1 零生产改动 + 红灯升级路径 | §7 D3、§11、§13 R1 | 完整内化；R1 补充「记录断言红先核对 log 构造（§12）再进升级判定」，消除了 iteration 0 E2 指出的伪回归升级陷阱 |
| SA8 RA#2 根 `pnpm typecheck` + 根 `pnpm test` 收口 | §7 D4 双层门槛 + 门槛机制口径 | 内化；机制口径经本轮磁盘核验全部属实（14 项目、`vitest run --typecheck`、typecheck 程序 include） |
| SA8 RA#3 冻结面（#347 字节稳定、record 指纹、无 skip/only/降断言/sleep） | §11 DENY、§12 断言纪律 | 内化；诊断指纹 `sha256:v1:dedad2ab…` 与 `namespace-diagnostic-log/AGENTS.md` 一致 |
| SA8 RA#4 落位裁量 + 偏离回写义务 | §7 D1（接受冻结路径，不偏离 → 无需回写） | 正确行使裁量，理由充分 |
| SA8 裁决分布 8/12/0/0、evolution-required 0 | §6、§14 | 与 conflict_report §3/§9 一致 |
| ADR 0025 L49/L51（FIFO 独占、committed 视角）、L60（R9 透传、写槽零改动）、L74+0026（顶层 guard、元素禁）、L90（验证门槛） | §6、§7 D2、§8、§12 | 逐条与 ADR 原文核对相符（L90 门槛文本本轮复核） |
| ADR 0011 L18–27（诊断在场不改变业务结果） | §12 D2 | 相符 |

## 6. 设计内部一致性

- **F1 修订一致性**：修订后 §2 三行锚点 / §7 D4 四条口径 / §11 DENY tsconfig 行 / §12 AC8 行 / §13 R5 相互一致且与磁盘逐字相符；全文 grep `tsconfig` 所有命中均为修正后表述，无残留旧口径；「14 个 tsc 项目」「根 pnpm test = vitest run --typecheck」「typecheck 程序 include 含 test」三个关键事实经 package.json/vitest.config.ts/tsconfig.typecheck.json 实测成立。iteration 0 的「§5 强断言自相矛盾」已由 §5 末行改写（列明复核范围 + 登记 SA6 §14 同错）消除。
- **F2 修订一致性**：钉死条款在 §7 D5（fixture 规格）、§8（数据流行内注）、§10（`createBoundedMemoryDiagnosticLog` 行）、§12（断言纪律）、§13 R1（陷阱消除）五处同口径出现；所引 `memory.ts` L165/L217–221、`issuesPolicy` L164 缺省 `'full'`、carrier payloadLength 语义全部实测相符；依赖面枚举（K1⑤、K5④/⑥、K6）比 iteration 0 finding 更精确（补 K5④），未发现遗漏或扩大。
- 正文 §1 目标 ↔ §7 决策 ↔ §11 文件范围 ↔ §12 验收映射逐条对得上；17 用例 = K1–K6(6) + L1–L4(4) + N1(1) + D1–D2(2) + NC1–NC4(4)，与 §7 D1 声称一致。
- 计数口径已统一注明：45 `.test.ts` + 5 `.test-d.ts` = 50 → 46+5 = 51（实测 45/5 相符；iteration 0 N3 关闭）。
- 文末「评审修订映射」与正文实际修订位置逐条对得上（F1 六处、F2 五处、N1–N5 五处处置）——非伪修订。
- 未发现死引用、旧 API、前后相反描述。

## 7. 状态机与并发攻击

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| C1 | ready | 两笔同 guard 写背靠背 `Promise.all` 入队 | FIFO 定序：先到者提交、后到者带码拒绝、update 恰 1 | 无——`sequencer.ts` L91–92 链形保证第二槽仅在前槽 settle（含 S6 await notifyDirty）后开跑，guard 必见已提交值；§7 时序论证与源码一致 | — |
| C2 | ready | 三写交错（guarded/无 guard/stale guarded） | [ok, ok, 带码拒]、终值 = B、update 2 | 无 | — |
| C3 | ready + 记账在场 | K4 槽样本采集 | `await Promise.all` 返回时 sink 已收齐 3 样本 | 无——flush 注册先于调用方 await（微任务 FIFO 序），论证与源码一致 | — |
| C4 | ready（槽挂于 S6 门） | `close()` | lifecycle 同步 `closing`；已接纳写排空 `{ok:true}`；closing 新写即时 `RUNTIME_WRITE_DISABLED`；release 后 barrier 执行、终态 closed | 无；R2 要求门 `finally` 放行 | — |
| C5 | closing/closed | 带.guard mutateData + hostile Proxy 输入 | 即时拒绝、Proxy 零访问、stage=acceptance | 无——接纳门不读 mutation（`runtime.ts` mutateData 分支实测先于 `sequencer.enqueue`） | — |
| C6 | ready | 拒绝后再写 | 非 fatal、`rootWrite.enabled` 保持、后续写 ok | 无（N1 用例） | — |

并发断言全部由 run-to-completion + promise 链确定性承载，无墙钟竞态——独立复核成立。

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| E1 | K/L/N/D 断言红（实现期） | D3：停、不改产线、ADR 0025 裁定、升级 + 冲突复查 | 正确且必要 | — |
| E2 | fixture 误配（log 缺 `updateCapture`）→ 记录断言必红 | **iteration 0 已识别为 F2；现已钉死**：§7 D5 普遍构造条款 + §12 断言纪律「记录断言红先核对构造」+ §13 R1 排障次序 | 已闭合——`memory.ts` L165/L217–221 语义实测相符；钉死条款先例（#347 L187/L242/L274）实测在位 | — |
| E3 | L4 门 Promise 未释放 | R2：`finally` 放行 + vitest testTimeout 兜底 | 已处置 | — |
| E4 | 诊断 emit 异步/失败 | R3 `waitAttempts`（expect.poll）+ ADR 0011 隔离 | 已处置 | — |
| E5 | typecheck 门对新文件失效 | R5 结论（在门内）以正确机制重述：vitest typecheck 程序覆盖新文件，聚焦/目录/根 `pnpm test` 均执行该程序检查（SA6 §4/§14 实测输出含 `Type Errors no errors` 为门生效证据） | 已处置——机制陈述与磁盘一致；门存活信号可观察（见 N2'） | — |

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| 生产面（mutateData/readData/getStatus/close、写槽、sequencer、诊断 schema） | 无——零生产改动，无签名/返回/时序/生命周期变化 | 设计 §8/§10 与源码一致；ALLOW LIST 仅新测试文件 + 设计文档自身 | — |
| 新测试文件作为消费方 | 消费面全部只读：公共 API + 包内 seam（`createNamespaceRuntimeWithSeam`）+ `createBoundedMemoryDiagnosticLog`（导出于 `src/index.ts` L56，实测）+ yjs API；log 构造选项已钉死（§7 D5/§10） | #347 先例齐备（helpers 全部实测在位：makeDoc L53/setup({log}) L85/teardown L112/readOk L117/bytesOf L123/failureOf L132/waitAttempts L137） | — |
| `MUTATION_GUARD_MISMATCH` 导出 | 断言与导出值同源相等（沿 #347 L38 读法，实测在位） | `doc-runtime/src/index.ts` 导出 | — |

## 10. 架构一致性与惯例审查

### 责任归属
| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| 竞争/定序语义 | 写序列器（ADR 0008） | 测试只观测不实现 | ✓ |
| guard 评估 | doc-runtime prepare 阶段（ADR 0025 L48） | 不改 doc-runtime | ✓ |
| 诊断透传 | 写槽 R9 + 诊断包 | 只断言既有字段；log 构造选项属消费方 fixture 责任（F2 钉死归属正确） | ✓ |

### 相似能力对照
| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| issue-scoped 验收契约测试 | `issue-347-guard-passthrough-red.test.ts`、`issue-350-*.test.ts` | 新文件同模式 | 一致 | 先例实测存在 |
| 槽级 seam 观测 | `sequencer-slotkind-close-barrier.test.ts` | K4 同款注入 | 一致 | 不新增公共面（ADR 0008 L97/L101） |
| committed 记录 payloadLength 断言 | #347 E3/E5/E6 + `runtime-root-schema-diagnostic-red.test.ts` | K1⑤/K5④⑥/K6 | 一致；fixture 前提已钉死（`updateCapture:true`，#347 调用点同款） | — |

### 单一事实源
| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 槽序/深度 | sequencer 内部 | seam 样本（纯观测） | 无（只读 sink，不回流） |
| 文档状态 | live Y.Doc | 测试内 bytes/计数快照 | 无（用例内局部） |
| typecheck 覆盖机制 | 磁盘配置（vitest.config.ts/tsconfig*.json/package.json） | 设计 §2/§7 D4/R5 陈述 | 无——修订后逐字一致 |

### 生命周期对称性
| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| setup（createDoc + seam 构造 + poll ready） | teardown（`handle.release()` + `writer.dispose()`，#347 L112 同款实测） | release 幂等；L4 门 finally | ✓ 对称 |

### 平行机制检查
| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 无第二套 cleanup/重试/状态/日志通道 | — | 测试文件不引入任何机制 | ✓ |

无错误 Owner、无绕过既有能力、无第二事实源、无生命周期不对称。

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW = 新测试文件 + 设计文档自身 | §11 | ✓ 最小充分；iteration 1 未扩张 |
| DENY 覆盖 src/**、#347 冻结锚、诊断包、ADR/CONTEXT/协议、`vitest.config.ts`/`tsconfig*.json`/package.json/lockfile、其余包 | §11；与 SA8 RA#1/#3 一致 | ✓ 与正文（零生产改动）无冲突 |
| tsconfig 行保留「不得以补 include 为名改动」警示 | §11 + §7 D4 + §13 R5 三处同口径 | ✓ 正确——真实机制已覆盖新文件，改 tsconfig 既违反 DENY 亦无必要 |
| follow-up（§13：ADR 0025 开放问题 1–3、跨实例零断言） | §13 | 非掩盖本任务必要项 ✓ |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1–AC7 行为证明 | §12 K/L/N/D/NC 表（冻结自 SA6 §12.2–12.6） | 断言体系完整、观察行为而非源码文本、敏感度表方向覆盖双向退化 | — |
| AC8 门槛 | §7 D4：聚焦 4 文件 + 全目录 + 根 typecheck + 根 test；机制口径与磁盘一致（本轮逐项实测：14 tsc 项目、typecheck 程序 include、`--typecheck` 旗标） | 无 | — |
| committed 记录断言可满足性 | §7 D5 钉死 `updateCapture:true`；carrier `payloadLength===bytes.byteLength` 实测 | 无——断言前提已成文条款，不再依赖实现者自行发现 adapter 缺省值 | — |
| 「无红相」纪律 | §7 D3/§13 R1 + SA6 §13 | 与 SA8 补充说明相容；R1 增加构造核对排障步（诚实且不降断言） | — |
| 测试入口真实性 | vitest include `packages/*/test/**/*.test.ts`（L15 实测）；计数口径 45+5=50→51 已注明 | 无 | — |

## 13. Required revisions

**无**（iteration 1 无新增 BLOCKER/MAJOR/MINOR 阻断项）。

### 已解决 finding 核销（供修订映射；正文不再列为阻断项）

| Finding ID | iteration 0 严重度 | 核销证据（本轮独立复核） |
|---|---|---|
| F1 | MAJOR | 修订稿 §2/§7 D4/§11/§12/§13 R5 全部改为真实机制；磁盘逐项实测：包级 tsconfig 仅 `src/**`（4 行文件原文一致）；根 typecheck 脚本恰 14 个 `tsc -p` 项目；`vitest.config.ts` L18–22 `typecheck.enabled:true` + `typecheck.tsconfig:'./tsconfig.typecheck.json'`；`tsconfig.typecheck.json` include 含 `packages/*/test/**/*.ts`；根 test 脚本含 `--typecheck`。全文无残留旧表述；SA6 §14 同错已登记（登记内容与 SA6 原文核对相符）。接受条件（iteration 0）：「修订后两处文本与磁盘事实一致；R5 结论以正确机制重述」——满足 |
| F2 | MAJOR | 修订稿 §7 D5 普遍钉死条款（凡构造诊断 log 一律 `{inputPolicy:'digest', updateCapture:true}`，调用点构造、`setup({log})` 注入）+ §8/§10/§12/§13 R1 同步；依据与 `memory.ts` L163–168/L199–230 逐字相符；#347 先例 L187/L242/L274 实测在位。接受条件（iteration 0）：「设计文本含钉死条款；K 组记录断言可满足性不再依赖实现者自行发现缺省值」——满足 |

## 14. Non-blocking observations

| # | 观察 | 建议 |
|---|---|---|
| N1' | §7 D5 钉死条款的枚举列表为「K1/K5/K6、D1 装配侧、D2 装配侧、L3/L4，及任何断言 attempt 记录内容的用例」——L1/L2（断言「无 transaction/validation 记录」，需构造 log 观察）与 NC4（断言 input-snapshot 记录内容）仅由句首普遍规则「凡构造诊断 log 的用例…一律」覆盖，未进枚举 | SA3 落地时对所有构造 log 的用例（含 L1/L2/NC4，若它们装配 log）统一采用钉死构造，避免同一文件内出现两种 log 构造约定；纯实现一致性问题，不阻断 |
| N2' | typecheck 门存活信号：「每次 vitest 运行都执行 typecheck 程序」依赖 vitest 3.2.7 行为，仓内实证为 SA6 §4/§14 聚焦/目录运行输出中的 `Type Errors no errors` 行 | SA3/SA4 留档运行输出时保留 `Type Errors no errors` 行作为门生效证据（含新文件入程序后的首跑输出）；若某聚焦运行缺失该行，先核 runner 配置再判定，非设计缺口 |

iteration 0 的 N1–N5 均已由修订稿处置（§7 D5 release 观察点/导入说明符注记、§7 D4 全仓基线留档、§3/§12 计数口径、§5 强断言软化 + SA6 §14 登记），本轮核销、不再列观察。

---

## 附：评审结论路由建议（供 Controller）

- F1/F2 均核销，verdict **approve**：设计可放行 SA3 实现。
- 两条实现期提醒（非设计修订）：统一 log 构造约定（N1'）；typecheck 门存活信号留档（N2'）。
- SA6 §14 的 tsconfig 错误表述已由设计 §5 登记——建议 Controller 在对账时知会 SA6 供后续票修正其契约文本，不影响本票。
- 本评审未发现需要重新执行 ADR 冲突检查的新风险：iteration 1 修订不触碰决策面、冻结面或公共语义（与 SA8 conflict_report §10 边界条件一致）。
