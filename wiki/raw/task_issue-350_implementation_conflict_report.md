# Task issue-350 实现冲突复审（SA8 implementation recheck）

1. **Reviewed subject**: implementation——issue #350「原子变更信封：mutateData 批量 ops 多操作全有或全无（ADR 0026，guard 前置）」在语义实现变更后的实际 diff：
   - `packages/doc-runtime/src/mutation.ts`（修改，+250/−14：双形态分发、E1–E5 信封校验、逐操作 prepare 聚合、阶段 C 组合期望边界、单事务按序提交 + 逐操作验证、`BatchedMutation`/`MutationEnvelope` 公共类型、`MAX_BATCH_OPS` 包内常量、单操作解析核抽取）
   - `packages/doc-runtime/src/index.ts`（修改，+2：两类型导出）
   - `packages/doc-runtime/test/public-surface-type-guard.test-d.ts`（修改，+27：正例 + 三类编译期负例）
   - 新增 4 个测试文件（SA6 两红灯契约 + 两共享边界文件，12 新用例）
   - **全部 DENY 路径零改动**（`git diff --stat` 对 `mutation-local.ts`、`install-verify.ts`、`namespace-runtime/src/**`、`namespace-diagnostic-log/**`、`packages/vfsl/**`、`docs/**`、`CONTEXT.md`、`.agents/**` 输出为空）。

2. **Inputs and decision set**: `wiki/raw/task_issue-350.md`（brief）；`wiki/raw/task_issue-350_design.md`（iteration 2）；`wiki/raw/task_issue-350_sa2_review.md`（iteration 2 approve）；`wiki/raw/task_issue-350_sa6_contract.md`（approve）；`wiki/raw/task_issue-350_sa3_impl.md`（实现报告，含 Deviations §1）；`wiki/raw/task_issue-350_conflict_report.md` + `_relevant_decisions.md`（SA8 前置门禁，clear + requiresConflictRecheck:true）；`CONTEXT.md`（L114–122「原子变更」「条件写」等词条）；`docs/adr/` 全集（22 篇，状态核实：无整篇 superseded）；模块 AGENTS（root / docs / packages/doc-runtime / packages/namespace-runtime）；`.agents/skills/nomicore/typed-access.md` L163–201；实际 diff 与现行源码（仅作事实确认）。Issue 无 owner 评论（Host REST 预读），无 override 要求。

   **过程观察**：前置门禁预告的「设计后复审」产物（`task_issue-350_design_conflict_report.md`）不在 `wiki/raw/`——设计期移交的 `set([])` 元素封口（required action 2）未单独留存 SA8 裁决文。本复审为实现后复审，该封口的 ADR 符合性**在本文 Decision analysis 第 10 行就地裁决**（结论：闭口 B 与 ADR 0008 L47 唯一性句最一致，落地无冲突）；此项不阻塞，记录为流程缺角（见 Required actions 4）。

## 3. Decision analysis

| Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| ADR 0026（已接受） | L28–29：双形态互斥；`ops` 非空、≤16、元素为完整单操作信封、元素禁 `guard` | E1 顶层键封闭（恰 `{'ops'}`；`op` 同现=双形态、其余=未知键，均 fail-fast 单 issue 无码）→ E2 数组/非空/≤`MAX_BATCH_OPS=16` → E3 逐元素复用**同一**单操作解析核（`parseMutationCore(ops[i], '批量元素 #i：')`；`guard` 与一切未知键由封闭键集排除） | implements-existing-decision | `mutation.ts` L186–212、L63；0026 L28–29；B5/B6 契约断言 | 无 |
| ADR 0026 | L30：批内路径互不嵌套（祖先-后代或相同），信封解析期直接拒绝为形状错误 | E5 两两 `isPrefixOrEqual` 严格段 `===` 判定（L223–232、L330–336），位于任何逐操作 prepare 之前；**拒绝域精确为「祖先-后代或相同」**——共享边界兄弟路径（不同键终段）放行，未为规避验证问题扩大（设计 §7.9 备选 G 未采纳） | implements-existing-decision | `mutation.ts` L223–232；0026 L30；B7 契约（兄弟 anchor + 嵌套/相同拒绝） | 无 |
| ADR 0026 | L34：逐操作 prepare → 任一失败整体零写入 → 全部成功单事务按序提交 → 逐操作边界验证 | `prepareBatchMutation`（E1–E5 → root 检查 → P 循环 `prepareLocalMutation` 逐元素、fail 聚合 continue → 全败即 return fail）+ `applyValidatedMutation` L102–110：单 `transactGuarded` 内按序 `commitPrepared`，事务后按序 `verifyBoundaryIntact`。全部失败裁决先于事务开启（禁 write-then-undo 保持） | implements-existing-decision | `mutation.ts` L102–110、L181–250；0026 L34；B1/B2/R1/R3 断言 | 无 |
| ADR 0026 | L35–36：跨实体路径同样原子；各操作仍是最小 edit，不整父替换、不重建容器 | 单 Yjs 事务覆盖整个 doc；逐 item `commitPrepared` 即单操作局部管线现役最小 edit（父 map 单键/数组局部区间）；E4 排除 `set([])` ⇒ 批量元素结构性只走局部管线，无 legacy 全量路径 | implements-existing-decision | `mutation.ts` L102–109、L213–222；0026 L35–36；B4（700k 兄弟 + update 体量 + 载体身份） | 无 |
| ADR 0026 | L40–42：形状错误无码不可重试；操作失败聚合全部 issues 非 fail-fast；fatal 通道不变、无新增稳定码 | 形状错误（E1–E5）fail-fast 单 issue、无码 `ok:false`；操作失败跨操作聚合（操作内部不拆，`{kind:'fail'}` 整体追加，顺序=ops 序）；组合失败（阶段 C）fail-closed 聚合、无码；fatal 仍只 E201-C/D（`verifyBoundaryIntact` 未改动）、E203（事务栈）、E204（`DerivedInvariantError` catch）；E205 仍为 catch **返回**单 issue；`errors.ts`/`fatal.ts` 零改动、无新码 | implements-existing-decision | `mutation.ts` L186–247、L296–306、L160–170；`fatal.ts` 零 diff；B3/B5–B8/R2/R4、S8/NS-2 断言 | 无 |
| ADR 0026 | L46：一个写槽 = 一次变更尝试 = 一条诊断记录；单事务单条 update bytes | `namespace-runtime/src/**` 与 `namespace-diagnostic-log/**` 零改动：批量全部封闭在 S5 单次 `applyValidatedMutation` 调用内；单事务 ⇒ D-B 捕获窗口天然单条 owned bytes | implements-existing-decision | git diff（两包 src 空）；`mutation.ts` L102–110；R3/R4/NS-1 断言 | 无 |
| ADR 0026 | L50–51：复制 apply / `replaceSchema` 不适用；跨实例语义不变 | 复制/wire/META/readData/持久面零改动（DENY 核实）；批量不经 replication apply 路径 | no-conflict | git diff（replication/persistence 面空）；0026 L50–51 | 无 |
| ADR 0025 | L72–74 组合节：批内元素永远不得携带 guard（形状错误）；guard 顶层叠加属 #347–#349；guard 先于逐操作 prepare 的次序届时不变 | 元素 `guard` 键由解析核封闭键集即刻拒（`批量元素 #i：未知信封键 "guard"…`）；顶层 `{ops, guard}` 现按 E1 未知键 loud 拒（未实现 guard、未预留半成品）；#347–#349 落地时扩展 E1 与类型（设计 §13.3 已留位） | implements-existing-decision | `mutation.ts` L186–193、L534–575（封闭键集）；0025 L72–74；B6 断言 | guard 票落地时按其自身门禁重审 |
| ADR 0007 | L27/L31 与 #237 修订节 §1/§5：逐操作管线复用、边界级验证、零写入在触碰 live Y.Doc 前决定、E201 变体 C 只对真实提交后偏离 | 元素 prepare 复用未改动的 `prepareLocalMutation`（mutation-local.ts 零 diff）；阶段 C 组合期望边界使重投影核**只对真实偏离触发**——恢复 #237 §5 冻结语义，消除批量下伪 E201-C（F1 修复收窄回正确触发面，非新增触发点）；实际侧与 `productEqual` 比较器零改动 | no-conflict | `mutation.ts` L263–308；`install-verify.ts` 零 diff；0007 #237 §5（L110–113）；S1–S7/NS-1（合法共享边界不再 fatal）+ S8（组合失败不 throw、写能力保持） | 无 |
| ADR 0007 | L46：逻辑校验保留完整 issues、结构/路径/操作错误 fail-fast（该条已由 0026 L41 就**跨操作聚合**显式演进——前置门禁 override 表） | 聚合只发生在跨操作层（P 循环按 ops 序拼接）；元素内部仍 fail-fast（解析核整体返回、prepare 结果整体追加）；单操作形态路径不经聚合代码 | no-conflict（既有合法演进） | `mutation.ts` L237–247 vs L132–145（单操作分支零聚合）；0026 L41；B3/R2/NS-2 | 无 |
| ADR 0008 | L47：「空路径整体替换……是唯一清空并重装完整 ROOT 的 mutation」 | E4 `set([])` 元素禁令落地（SA1 闭口 B——前置门禁 required action 2 推荐闭口）：批量内无第二全量形态，`set([])` 仍只经单操作 legacy 管线可达；非 set 空路径元素不特判、落入逐操作 prepare 领域失败 | implements-existing-decision（前置门禁移交封口的落地） | `mutation.ts` L213–222；0008 L47；B8（decision-neutral 契约在闭口 B 下闭合）；N4（单操作 `set([])` 不变） | 词表化留待开放问题复审（非阻塞，见 Evolution） |
| ADR 0008 | L49–51：槽序 S1–S7（lifecycle → writable → 快照 → 校验+构造+单事务 → notifyDirty → 释放）；snapshotter 只接受 plain data | 写槽机械零改动；S3 仍对整个 `{ops}` 信封一次受控快照（数组是 plain data）；批量解析保持在 S5 槽内位置（未前移接纳层/S3）——形状错误仍落 stage `validation` | no-conflict | git diff（write.ts/runtime.ts 空）；R5/R6/R7 契约；设计 §7.7 | 无 |
| ADR 0008 | L85–93：internal fatal 永久禁写读保留；不补偿不回滚 | fatal 分类与通道零改动；批量验证失败仍经既有 E201 throw 通道 → 写槽 fatal 处置不变 | no-conflict | `fatal.ts`/`write.ts` 零 diff；既有 fatal 套件（SA3 两包 769 用例零回归） | 无 |
| ADR 0011 / 0014 | 0011 结局/阶段词表与 issues 顺序保留；0014 L61–89：一尝试一条最终 attempt record、operation 封闭词表 `root-mutation`、rejected 禁 update | 诊断包与 `diagnostic.ts` 零改动；聚合 issues 经 R9 `diagValidation` 同源引用透传进同一 rejected record（顺序=ops 序）；无新增 operation/stage/result 词、无 record schema 版本变更、emission 仍槽外 `.then` | no-conflict | git diff（诊断面空）；NS-1/NS-2 断言（root-mutation/transaction/committed 单 update；rejected/validation/无码/issues ≥2 按 ops 序）；0014 L61–89 | 无 |
| ADR 0023 | L41：服务方法返回值非服务表面 | `mutateData`/`NamespaceLease` 面零改动；新类型是 doc-runtime 包导出，不触 `ctx.provide` 纪律 | no-conflict | git diff（runtime 面空）；0023 L41 | 无 |
| CONTEXT.md | 「原子变更」词条（含 _Avoid_：事务、多阶段命令拆写、整父替换换原子）；「条件写」词条（批内元素不得携带） | 实现与词条逐句一致：公共类型注释/消息词表用「批量信封/原子变更」，无「事务」公共面词汇；元素 guard 禁令同词条 | no-conflict | `mutation.ts` L54–60 注释；CONTEXT.md L114–122 | 无 |
| typed-access 技能（根 AGENTS 强制） | L163–201：批量信封范式（元素禁嵌套/禁 guard/单条诊断）；完成门=元素可静态约束 | `BatchedMutation = { ops: readonly ValidatedMutation[] }`——宿主 typed adapter 以生成 `PathPatchValue` 组装元素、该类型定型信封；类型守卫负例证明元素 `guard` 编译期 fail-closed | no-conflict | `mutation.ts` L57；`public-surface-type-guard.test-d.ts` 新增 describe（正例投影 + `@ts-expect-error` ×3） | 无 |
| 模块 AGENTS（doc-runtime / namespace-runtime） | doc-runtime：「Add public APIs only through src/index.ts; public-surface guard tests must account for every export」；ns-runtime：FIFO/快照/零写入纪律 | 两类型只经 `src/index.ts` 导出（无新值导出——值面守卫不动）；ns-runtime 仅新增测试文件（自有 fixture，契约文件未编辑），src 零改动 | no-conflict | `index.ts` L25–26；type-guard 登记；git status | 无 |
| 设计 §12.1 S8 字面 fixture（被审实现的唯一偏差） | 设计字面 `u: { x?: number } \| { label?: string }` + 「两操作各自单独合法」前置 | **字面构造在 HEAD 不可执行**：空 `u` 的 union 仲裁（`trialMember` 软接受 + 写侧 `resolveNode` 逻辑值等值消歧）恒选成员 0 ⇒ 单操作 `set ['u','label']` 即 E204 fatal——pre-existing 行为（`mutation-local.ts`/`extract.ts` 均 DENY 且零改动），非本 diff 引入。SA3 以镜像成员 fixture `u: { x?: number; label?: number } \| { label?: string; x?: string }` 替换：ops 逐字相同、断言语义逐字相同（ok:false/issues ≥1/字节不变/0 事务 0 update/无 fatal/后续单操作仍 ok）、构造类相同（非判别联合 any-of 重叠） | no-conflict（决策集无涉：ADR 0026 不规定测试 fixture；替换未触任何 ADR 条款、冻结面或 override；偏差已在同变更集留证——SA3 报告 Deviations §1 + 测试文件内联记录 L265–276） | 设计 §12.1 文本回写（Required action 1）；设计 §2/C17 补导航步骤事实（可选） |

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| ADR 0007/0008 塑造的单操作信封形态（隐式单形态） | ADR 0026（已接受，commit `211c5fa`；前置门禁已裁） | 仅 `mutateData`/`applyValidatedMutation` 受控 ROOT 信封双形态 | **已按裁决范围兑现，未扩大**：批量按 0026 条款落地；单操作形态逐字节不变（见 Frozen surfaces 第 1 行）；`{op,…,ops}` 同现输入从 HEAD 的 `未知信封键 "ops"（操作 set）` 变为批量分支双形态形状错误——该输入类不在冻结面内（冻结面限定「无 ops」信封；0026 L28 明文同现=形状错误），属前置门禁 override 表第 4 行已裁演进 |

无新增 override；无 Owner 评论类、无协议版本类。实现未使用任何前置门禁未裁的偏离路径。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| 单操作信封行为 | 无 `ops` 自有键的信封解析/管线/结果/文案逐字节不变（含 `未知信封键 "zzz"（操作 set）` 冻结文案） | 0026 L17/L65；issue AC5；前置门禁冻结面第 1 行 | **保持**：分发只读自有 `ops` 键（`plainObjectOf`+`Object.hasOwn`，纯读）；`parseMutation` → `parseMutationCore(input, '')`，全部消息模板以空前缀插值——字符级等价（L526–533、L534–575 逐条核对）；单操作分支主体代码零改动（L132–159 与 HEAD 相同）；N1–N4/R3 前段/R5/R6 锚 + SA3 两包 769 用例零回归 |
| 写槽槽序 S1–S7 | 不可重排；一槽一变更尝试；S3 整体快照；不新建槽类型 | 0008 L49–51；INV-W2；issue AC7 | **保持**：`namespace-runtime/src/**` 零 diff；批量（含阶段 C）封闭在 S5 单次调用内、事务前 |
| 稳定码注册表 | 批量无新增稳定码；码族与 message 模板不变 | 0026 L42；`errors.ts` append-only | **保持**：`errors.ts`/`fatal.ts` 零 diff；形状/聚合/组合失败均无码 `ok:false`（R4 `code===undefined`）；fatal 联合仍恰 E201-C/D、E203、E204（phase 三值）+ E205 返回值 |
| 诊断词表与记录形态 | operation 仍 `root-mutation`、stage/result 联合、一尝试一最终 record、rejected 禁 update、槽外 emission | 0014 L61–89；0011 修订节 | **保持**：诊断包零 diff；NS-1/NS-2 断言逐项核对通过（SA3 证据） |
| op 动词词表 | `set`/`delete`/`array-insert`/`array-delete`，键集封闭 | 0007 L31 | **保持**：specs 表原样；`payloadOf` 穷尽四动词、无 default |
| 复制 wire 与 apply | 协议帧/状态机零改动；复制 apply 不经批量信封 | 0026 L50；instance-replication-v1 无 0026 引用 | **保持**：相关路径零 diff |
| fatal 通道与语义 | E201 变体 C committed:true 不回滚；internal fatal 永久禁写读保留；E201-C 只对真实提交后偏离 | 0007 #237 §5；0008 L85–93 | **保持**：`verifyBoundaryIntact` 及其比较器零改动；阶段 C 组合使触发面收窄回冻结语义（伪触发消除=恢复原语义，非新触发点）；S8/NS-1 断言写能力保持 |
| `ops` 上限 16 与元素 guard 禁令 | 词表常量；放宽/变更须过设计评审（0026 开放问题 1）；元素 guard 属 0025 顶层语义 | 0026 L29/L73；0025 L74 | **兑现**：`MAX_BATCH_OPS=16` 包内常量**不导出**（L63）；元素 guard 由封闭键集即刻拒（B6） |
| vfsl 公共面 | `planMutationBoundary`/`applyMutationAtBoundary` 签名与语义零改动（既有 #237 公共导出的消费，非新面） | `packages/vfsl/src/index.ts` L100–114 | **保持**：`packages/vfsl/**` 零 diff；`ValidateResult` 类型消费为既有公共导出 |

## 6. Evolution requirements

无待办 ADR/CONTEXT/协议演进。信封双形态的契约演进已由 `211c5fa` 完整兑现（前置门禁 Evolution 核对「完整」），本实现只是使其成真；实现未产生新的决策演进需求：

- 阶段 C 组合期望边界、组合失败 fail-closed 收口、E4 `set([])` 元素禁令均为 ADR 0026 L29/L34/L40 既有文本（「元素为完整合法的单操作信封」+「逐操作边界验证」+ 形状/操作失败分域）之下的**实现层语义填充**，不改变任何条款边界——SA2 iteration 2 观察 4/5 同判。
- 设计 §12.1 S8 fixture 回写是 `wiki/raw` 证据文书的更正（docs/AGENTS.md：wiki/raw 是 evidence 非规范契约），不构成决策文档修订，故不触发本节八要素计划。
- `set([])` 元素禁令与批量形状错误消息的词表化（写入 ADR 0026 修订节或 CONTEXT 注记 + typed-access 补句）维持前置门禁结论：属开放问题复审随伴项，非本变更集缺失。
- 顶层 guard（0025）落地属 #347–#349 独立票，届时按其自身门禁处理（E1 与 `BatchedMutation` 类型同步扩展）。

## 7. Hard conflicts

无。未发现与既有决策不兼容且无合法 override 的实现行为；前置门禁裁定的唯一 override（双形态信封）在获批范围内兑现且未扩大。

## 8. Required actions

1. **设计回写（SA1，非阻塞）**：更正 `wiki/raw/task_issue-350_design.md` §12.1 文件 A S8 的字面 fixture 为镜像成员构造（`u: { x?: number; label?: number } | { label?: string; x?: string }`），并把根因（union 歧义仲裁下非首成员字段不可导航 → 单操作 E204）补入 §2 现状事实/C17 限定——消除设计与已落地测试之间的字面不一致；证据链以 SA3 报告 Deviations §1 与测试内联注释为准。
2. **SA6 follow-up（既有约定，非阻塞）**：按设计 §13.1 把 B8 升级为闭口 B 单向断言；可顺带吸收 S1–S8/NS-1/NS-2 为契约用例。
3. **词表化随伴（非阻塞）**：`set([])` 元素禁令与批量形状错误消息的词表化随 0026 开放问题 1/2 复审一并处理（维持前置门禁 required action 7）。
4. **流程记录**：设计后冲突复审产物缺失于 `wiki/raw/`（前置门禁 requiresConflictRecheck:true 所预告）；`set([])` 封口的 ADR 符合性已由本文 Decision analysis 第 10 行就地裁决（闭口 B 成立）。后续任务应留存中间门禁产物，避免裁决链断档。
5. **转交观察（SA8 范围外，不构成本门禁结论）**：pre-existing 行为——空值歧义 union（如 `u={}`）上单操作写非首成员声明字段即 E204 fatal（`mutation-local.ts` 换根仲裁恒选成员 0）——是潜在 vfsl 规范符合性/质量问题（SA3 probe 留证；DENY 路径零改动、HEAD 即可复现，与本 diff 无关）。建议 Controller 转 SA4/SA7 评审或开独立 issue；SA8 不裁实现质量。

## 9. Verdict

**clear** —— 全部对照项为 no-conflict 或 implements-existing-decision；ADR 0026 的全部条款（双形态互斥、`ops` 约束、嵌套拒绝、槽内次序、单事务最小 edit、错误域三分、单条诊断）经实际 diff 逐条核对落地；前置门禁裁定的 override 未扩大；冻结面（单操作逐字节不变、槽序、稳定码、诊断词表、fatal 通道、复制面、词表常量）逐项保持；唯一偏差（S8 fixture 语义等价替换）不触任何决策条款且已在同变更集留证，其设计文本回写列为 Required action 1，不构成 reject 事由（决策集无违、证据完备、无静默分歧）。

## 10. requiresConflictRecheck

**false** —— 本实现后复审已闭合前置门禁与设计阶段遗留的全部核对项（公共 API、失败语义、冻结面、封口裁决、诊断面）。遗留事项（S8 设计文本回写、B8 单向化、词表化、guard 票 #347–#349）均为证据文书/后续票工作，不改变公共 API、wire、schema、持久化、状态机、生命周期、失败语义或 override 范围，无需再次冲突复审；guard 落地票将按其自身门禁重新进场。
