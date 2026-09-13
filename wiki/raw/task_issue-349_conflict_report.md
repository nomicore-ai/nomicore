# SA8 Conflict Report — issue #349 条件写端到端：mutateData 透传、诊断 rejected 与写序列器竞争证明（guard III）

## 1. Reviewed subject: task

前置门禁。被审对象为 issue #349 的**已接受验收契约面**：

- Host 任务简报 `wiki/raw/task_issue-349.md`（正文 What to build + AC1–AC8；State: open；Blocked-by #347 已满足——HEAD 即 #347 合并点 `61e2daa`）。
- SA6 验收契约 `wiki/raw/task_issue-349_sa6_contract.md`（approve；§12 冻结 K/L/N/D/NC 用例表、§12.1 测试文件路径、§12.9 SA1/SA3 义务、§13 无红相声明）。

本报告不评价设计优劣（SA2）、实现质量（SA4/SA7）或验收完成度；只裁决上述要求与既有决策集的冲突等级。

## 2. Inputs and decision set

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-349.md`、`wiki/raw/task_issue-349_sa6_contract.md` | 已读（固定位置） |
| Issue #349 comments | **无**（REST 预读为空，dispatch 明示）；无 owner 反馈要求 → 无评论来源的 override 输入 |
| `CONTEXT.md` | 已读（词条级基准：条件写、写序列器、停接纳、原子变更、变更尝试、零写入、诊断日志等） |
| `docs/adr/**`（22 份，全部已接受，无 superseded） | 全量识别状态；相关者全文精读：0025、0026、0008（含全部修订节）、0011（含澄清性修订节）、0014；援引面核对：0002、0007（Runtime/open/read 条款被 0008 部分取代，其余条款有效）、0010、0016 |
| 模块 AGENTS 决策收录 | `packages/namespace-runtime/AGENTS.md`、`packages/doc-runtime/AGENTS.md`、`packages/namespace-diagnostic-log/AGENTS.md`（冻结 record schema 指纹） |
| 协议文档 | `docs/protocols/instance-replication-v1.md`（wire 权威；本票零涉及，仅作冻结面清单） |
| 源码/测试现状 | 仅用于确认事实（见 `task_issue-349_relevant_decisions.md` §8），不构成冲突基准 |

既存同类报告：`wiki/raw/task_issue-349_conflict_report.md` 与 `_relevant_decisions.md` 此前不存在（SA6 契约 §1 已实测声明），本报告为首次产出。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0025 | L21–44 信封形态与谓词（四 op 可选 guard；equals 结构深相等 / absent；guard 路径禁 `[]`） | AC1：mutateData 携带 guard，条件满足 `ok:true`；K 组全部经 `mutateData` 端到端，输入形态与谓词语义逐条采用决策原文 | **implements-existing-decision** | `docs/adr/0025` L21–44；CONTEXT.md「条件写」词条；源码 `mutation.ts` 已实现（#347） | 无（测试落地即兑现） |
| 2 | ADR 0025 | L48 评估位置（doc-runtime prepare 阶段，信封解析后、管线分叉前；`set([])` legacy 同样生效） | brief/契约：全部 K/L 用例经 `mutateData` 端到端观察，不做 doc-runtime 直打、不改 doc-runtime 语义 | **implements-existing-decision** | 0025 L48；契约 §3 行 1；`mutation.ts` 现状 | 无 |
| 3 | ADR 0025 | L49 原子性来自写序列器 FIFO 独占、不来自 Yjs 事务；L51 guard 见最新 committed 值 | AC4：两个受控写串行，第二个基于已提交新值判定并零写入拒绝（TOCTOU 消除证明面）；K1/K3 竞争对 + 三写交错 | **implements-existing-decision**（0025 L90 明示「序列器竞争测试」为验证门槛，SA6 §8 Step 3 实测该证明面在测试语料中不存在） | 0025 L49/L51/L90；ADR 0008 L40–44；CONTEXT.md「写序列器」 | 无 |
| 4 | ADR 0025 | L50 guard 评估先于 schema 校验管线 | 契约不重复 doc-runtime O1–O3 次序用例（#347 已冻结）；NC4 仅锚 S3 输入快照分层（`MUTATION_INPUT_NOT_PLAIN_DATA`、stage=input-snapshot、顶层码） | **no-conflict** | 0025 L50；#347 契约 §12.4；ADR 0008 L49 槽序（输入快照先于领域校验） | 无 |
| 5 | ADR 0025 | L57–58 错误域两态：形状错误无码不可重试；评估不满足零写入单 issue、稳定码 `MUTATION_GUARD_MISMATCH`、`issue.path`=guard 路径、message 含期望/实际摘要 | AC1/AC2：不满足 → `ok:false`、issues 含稳定码、issue.path 为条件路径、零写入后续读取不变；契约 §12.0 码载体口径（issue 级带码、record 级无码、形状错误无码） | **implements-existing-decision** | 0025 L57–58；源码 `mutation.ts` L56–62/L726–728、`index.ts` L23 导出 | 无 |
| 6 | ADR 0025 | L60 诊断经写槽现有 R9 透传（stage=validation、result=rejected）；namespace-runtime 写槽零改动；guard 评估无 fatal 面 | AC3（装配 emitter 时 rejected 落日志）+ AC5（不触发 fatal、后续写能力保留）+ brief「namespace-runtime 实现预期零改动」；D1/D2/N1 | **implements-existing-decision** | 0025 L60；ADR 0011 L40–49 阶段词表含 validation；源码 `write.ts` L206–207 | 无 |
| 7 | ADR 0025 | L64–66 边界：复制 apply 不受 guard 拦截、replaceSchema 不适用、跨实例约定级 | 契约 §10：wire/复制/replaceSchema/META 零影响、零断言 | **no-conflict** | 0025 L64–66；契约 §10/§15 | 无 |
| 8 | ADR 0025 L74 + ADR 0026 L28–29/L55 | guard 适用于两种形态顶层；批内元素禁 guard（形状错误）；guard 先于逐操作 prepare | AC7：`{ops, guard}` 组合端到端；K5/K6；NC3 冻结元素 guard 形状错误（无码、零写入） | **implements-existing-decision** | 0025 L74；0026 L29/L55；CONTEXT.md「原子变更」「条件写」词条 | 无 |
| 9 | ADR 0026 | L34–36/L46 批量原子性：任一失败整体零写入、全部成功单事务提交；一个写槽=一次变更尝试=一条诊断记录、单条 update bytes | AC7：竞争拒绝零写入、诊断 rejected 单条记录、成功路径单条 update bytes；K5 ④⑥/K6 | **implements-existing-decision** | 0026 L34–36/L46；ADR 0011「变更尝试」 | 无 |
| 10 | ADR 0025 | L86–88 公共面后果（`MutationGuard` 导出、首个领域稳定码、CONTEXT 词条） | #349 无新公共面义务；现状已随 #347 兑现（源码/CONTEXT 实证），本票零生产改动不触碰 | **no-conflict**（义务已兑现，非本票待办） | `doc-runtime/src/index.ts` L23/L28；CONTEXT.md「条件写」词条 | 无 |
| 11 | ADR 0025 | L90 实现验证门槛：…「namespace-runtime 写槽透传与序列器竞争测试」…根 `pnpm typecheck` + `pnpm test` | AC8 要求「根 `pnpm typecheck` + 相关测试通过」；SA6 §12.9.5 门槛 = 根 typecheck + namespace-runtime 全目录 + 聚焦 3 文件 | **implements-existing-decision**（本票正是 L90 中 namespace-runtime 透传与竞争测试义务的兑现票） | 0025 L90；brief AC8；契约 §12.9.5/§14 | **见 Required action #2**：最终验证须以根 `pnpm test` 收口 L90 全门槛；§12.9.5 聚焦/目录门槛为过程最低线，不得替代根门槛（brief AC8 的「相关测试」措辞是 ADR 门槛的下限表述，不是收敛） |
| 12 | ADR 0008 | L40–51 单一严格 FIFO write sequencer、槽序（lifecycle gate → writable gate → 输入快照 → 校验/构造 → 单事务 → notifyDirty） | AC4/AC6 的机制基础；K4 槽级样本（slotKind='S'、queueDepthAtStart [3,2,1]）；L4 close 排空（已接纳任务无条件排空） | **no-conflict**（纯断言既有不变量） | 0008 L40–51/L99；`sequencer.ts` G1 注释；AGENTS「Preserve one strict FIFO」 | 无 |
| 13 | ADR 0008 | L99 + 稳定码注册修订 #2（L125）：close 同步停接纳；`RUNTIME_WRITE_DISABLED` 统一码族覆盖 lifecycle≠ready 接纳拒绝，message 区分域 | AC6：closing/closed 期带 guard 的 mutateData 仍按 `RUNTIME_WRITE_DISABLED` 拒绝、guard 不改变接纳门次序；L1/L2/L4 | **no-conflict** | 0008 L99/L125；CONTEXT.md「停接纳」；`runtime.ts` L176–177（D5.1 零入队、零输入访问） | 无 |
| 14 | ADR 0011 | L40–49/L51 阶段与结局词表（acceptance/validation/…；rejected 不折叠）；记录保留所属模块已有稳定 code/issues 顺序 | L3：acceptance 记录 `stage==='acceptance'`、`code==='RUNTIME_WRITE_DISABLED'`、`input.capture==='not-accessed'`；D1：validation 记录 record 级无码、issue 级带码 | **no-conflict** | 0011 L40–51/L69–77；契约 §12.0 | 无 |
| 15 | ADR 0011 | L18–27 日志故障/在场不得改变业务结果、sequencer 顺序或 Runtime 状态；L16 启用为可选 | AC3「未装配 emitter 时行为等价（无诊断、拒绝照常）」；D2 `rWith===rWithout` 逐字相等 + 两侧零写入 | **no-conflict** | 0011 L16–27；CONTEXT.md「namespace 诊断变更日志」 | 无 |
| 16 | ADR 0014 + `packages/namespace-diagnostic-log/AGENTS.md` | 冻结 v1 record schema（指纹 `sha256:v1:dedad2ab…` 被 schema-freeze 钉死；改任何字符 = 版本变更） | 契约 §10：record schema/投影零变更，只断言既有字段（stage/result.kind/issues.items[].code/path） | **no-conflict** | AGENTS Contract 首条；契约 §10 | 无 |
| 17 | ADR 0008 | L97/L101 测试 seam 包内注入合法；status 不暴露队列长度/任务类型；v1 无公共事件订阅 | K4 经包内 `replicationObservability` seam 观测槽样本（既有先例 `sequencer-slotkind-close-barrier.test.ts`），不新增公共观测面 | **no-conflict** | 0008 L97/L101；`runtime.ts` L104/L638；契约 §12.9.3 | 无 |
| 18 | ADR 0016（经 0008 修订节援引） | readData 成功分支 `{ok:true, value, schema}`；读取不进 sequencer | K/N 组用 `readData(...).value` 观察终值（仅消费既有读面） | **no-conflict** | 0008 L167–178 修订节；CONTEXT.md「语义 schema 投影」 | 无 |
| 19 | ADR 0002 + 0025 L15/L70 | authority 规则语言范围外；guard 是词表封闭的条件原语，机制而非策略 | 测试 fixture 用业务形态数据（tasks.status 状态转移）仅作数据；断言只锚 equals/absent + 稳定码，不向引擎引入状态机/单调性词表 | **no-conflict** | 0002；0025 L15/L70；CONTEXT.md「条件写」Avoid 项 | 无 |
| 20 | brief AC8 + SA6 §12.1/§12.7 | （落位组织方式——非决策文本，对照仓内先例） | 新文件 `issue-349-guard-e2e-competition.test.ts` 按既有 describe 组织、复用 #347 E2E fixture；沿用 issue-scoped 文件先例（issue-347/issue-350） | **no-conflict** | `packages/namespace-runtime/test/` 先例；vitest include L15；SA6 §12.9.1 已把落位列为 SA1 裁量并要求回写 | 无（落位最终裁决归 SA1 设计，见 Required action #4） |

裁决分布：**implements-existing-decision 8 项、no-conflict 12 项、evolution-required 0 项、hard-conflict 0 项**。

补充说明（非冲突，登记备查）：

- **无红相声明**（SA6 §13：HEAD 全绿、不得伪造红灯）——决策集中无任何 ADR/协议要求测试必须以红→绿方式落地；红灯纪律是流程期望而非决策义务。#349 是验收证明票（能力由 #347 落地），SA6 的「HEAD 绿为冻结基线」处理与决策集相容。
- **SA6 §3「SA8 constraints」自拟替代约束表**——该表在无 SA8 产物时由 SA6 推导；本报告已逐条对照（其 8 行分别落入上表 #2/#3/#4/#5/#6/#8/#11 及冻结面节），未发现与决策集的偏差。SA6 §15「SA8 若后续产出须逐条对账，冲突以 ADR 0025 为准」——本报告即该对账，结论为无冲突。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| （无） | （无） | （无） | （无） |

- Issue #349 comments 为空（REST 预读），无 Owner 评论覆盖任何决策。
- 无新 ADR 修订/废弃旧 ADR；无协议版本升级。
- ADR 0025 自身的演进条款（开放问题 1–3：谓词词表、读-改-写组合子、跨实例执法）均未被本票援引——#349 不触碰词表演进。
- 实现方便、测试通过、既有代码、PR 存在或其他 SA 同意均不构成 override；本票也无需任何 override（全部要求落在既有决策内）。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（task 契约面核对） |
|---|---|---|---|
| 稳定码 `MUTATION_GUARD_MISMATCH` 字面与码载体 | issue 级 `issues[0].code` 带码；record 级 `code===undefined`；形状错误 issue 无码；doc-runtime `index.ts` 导出 | ADR 0025 L58；契约 §12.0；`mutation.ts` L62/`index.ts` L23 | 一致（契约只断言既有载体，零改动） |
| 诊断 record schema 指纹 | `sha256:v1:dedad2ab93d9df9224960ca094924168f8bcc1c0512dfdd0a03dc6e66613e070` 钉死于 schema-freeze 测试；改任何字符 = 版本变更 + 新 generation | ns-diagnostic-log AGENTS Contract；ADR 0014 | 一致（契约零 schema 触碰） |
| 写槽 R9 透传语义 | validation/rejected/issues 同源透传；写槽零改动 | ADR 0025 L60；`write.ts` L206–207 | 一致（零改动为契约约束，§10/§12.9.2） |
| lifecycle 接纳门次序（D4/D5.1） | lifecycle≠ready 同步零入队、`RUNTIME_WRITE_DISABLED`、零输入访问；已接纳任务无条件排空 | ADR 0008 L99/L125；CONTEXT.md「停接纳」；`runtime.ts` L176–177 | 一致（L1–L4 只断言既有次序） |
| 批内元素禁 guard（形状错误域） | 元素携带 guard → 无码、零写入、不可重试 | ADR 0026 L29/L40；0025 L74 | 一致（NC3 冻结锚） |
| wire / 复制 / replaceSchema / META | 零断言、零改动（0025 边界外） | ADR 0025 L64–66；`docs/protocols/instance-replication-v1.md` | 一致（契约 §10/§15） |
| `#347` 冻结测试锚 | `issue-347-guard-passthrough-red.test.ts` E1–E7 逐字节不动、全绿 | SA6 §12.1/NC5（契约级冻结，非 ADR） | 一致（本票不触碰该文件） |

（implementation 复审时按本表逐项核对实际 diff。）

## 6. Evolution requirements

无 `evolution-required` 项。#349 不修改任何 ADR/CONTEXT/协议条款：信封形态、谓词语义、错误域、诊断管线、sequencer 语义、lifecycle 语义全部按既有决策原文消费；唯一产物是新增验收测试语料（测试文件不是决策文档）。

## 7. Hard conflicts

无 `hard-conflict` 项。

## 8. Required actions

1. **零生产改动纪律**：实现阶段 `packages/namespace-runtime/src/*` 与 `packages/doc-runtime/src/*` 预期零改动（brief What to build + ADR 0025 L60）。任何 K/L/N/D 断言红 = 回归/阻断性偏差 → 停下升级 SA1、以 ADR 0025 为准裁定，不得就地改产线或放宽断言（SA6 §12.9.2 义务予以确认）。
2. **验证门槛收口**：最终验证必须运行根 `pnpm typecheck` + 根 `pnpm test` 以全额兑现 ADR 0025 L90 门槛；SA6 §12.9.5 的聚焦 3 文件 + namespace-runtime 全目录为过程最低线，不得替代根门槛（brief AC8「相关测试通过」是下限表述）。
3. **冻结面保持**：#347 E1–E7 文件字节稳定；诊断 record schema 指纹不动；不引入 skip/only/todo/env override、不降断言、不加 sleep 阈值断言（SA6 §12.7/§13 纪律与决策集一致，予以确认）。
4. **落位裁量归属**：测试落位（新文件 `issue-349-guard-e2e-competition.test.ts` vs 扩展既有文件）属 SA1 设计裁量；若偏离 SA6 §12.1 冻结路径，须回写 SA6 契约，且用例 ID 与断言不得削弱（SA6 §12.9.1，予以确认）。

## 9. Verdict

**clear**

- 全部 20 项对照裁决为 `no-conflict`（12）或 `implements-existing-decision`（8）；无 `evolution-required`、无 `hard-conflict`、无需 override。
- #349 是 ADR 0025 L90 验证门槛中「namespace-runtime 写槽透传与序列器竞争测试」义务的兑现票——该义务由既有决策明确要求且尚未被任何可执行用例覆盖（SA6 §8 Step 3 实测），兑现路径（新增验收测试、生产零改动）与 ADR 0025 L60「namespace-runtime 写槽零改动」直接对齐。
- Required actions #1–#4 为实现阶段的纪律确认与门槛收口要求，不构成对本票前置门禁的阻塞。

## 10. requiresConflictRecheck

**false**

- 依据：本票为纯 no-conflict + 无新决策面的 existing-decision 兑现——生产实现零改动（无公共 API、wire、schema、持久化、状态机、生命周期、失败语义的待实现变更），无正式 override，冻结面只被断言不被触碰。
- 边界条件（不改变本值）：若实现阶段偏离零改动预设（出现需要修改产线的红灯，即 Required action #1 的升级路径）、SA1 改动冻结面、或 SA1 选择扩展既有测试文件以外的决策面，该偏离本身构成新的被审对象，届时由设计后复审（design 复查产物）另行裁决。
