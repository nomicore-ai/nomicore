# Task issue-350 冲突报告（SA8 前置门禁）

1. **Reviewed subject**: task——issue #350「原子变更信封：mutateData 批量 ops 多操作全有或全无（ADR 0026，guard 前置）」的实现请求（brief `wiki/raw/task_issue-350.md`，labels: in-progress/feature，无 owner 评论、无 override 要求）。
2. **Inputs and decision set**: `wiki/raw/task_issue-350.md`；`CONTEXT.md`；`docs/adr/` 全集 22 篇（无整篇 superseded；0007 Runtime/open/read 条款由 0008 部分取代，mutation 底层条款仍有效）；`docs/protocols/instance-replication-v1.md`（无关联条款）；模块 AGENTS（root / docs / packages/doc-runtime / packages/namespace-runtime）；`.agents/skills/nomicore/typed-access.md`；源码事实仅用于确认现状（详见 `task_issue-350_relevant_decisions.md`）。

## 3. Decision analysis

| Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| ADR 0026（已接受） | 全文：双形态信封、`ops` ≤16 非空、元素为完整单操作信封、元素禁 `guard`、批内路径互不嵌套、逐操作 prepare→任一失败整体零写入→单事务按序提交→逐操作边界验证、聚合失败 issues、单条诊断 update、最小 edit 不降级 | issue #350 逐条兑现上述已接受决策，未加码未减码（AC 与 ADR 条款一一对应） | implements-existing-decision | `docs/adr/0026-atomic-mutation-envelope.md` L14–55；issue body/AC；commit `211c5fa` | 按条款实现；无需新决策 |
| ADR 0026 后果义务 | L65–69：CONTEXT.md 词条、ADR 0025 组合节、typed-access 改写同变更集兑现 | 三项文档义务已在 docs commit `211c5fa` 完成（CONTEXT ±6、0025 +4、typed-access +22） | implements-existing-decision | `git show 211c5fa --stat`；CONTEXT.md L116–122；0025 L72–74；typed-access L163–201 | 实现变更集只需让已成文契约成真，不再改决策文档 |
| ADR 0007 | L27/§issue#237-1/4/5：边界级管线、零写入在触碰 live Y.Doc 前决定、禁 write-then-undo、E201 变体 C/D、verifyBoundaryIntact | 批量逐操作 prepare 复用既有单操作局部/legacy 管线选择，全部成功后单事务提交、逐操作边界验证 | no-conflict | 0007 L27、L71–119；0026 L34（次序同构声明） | 每个元素按其自身形态走局部或 legacy 管线；失败裁决必须在事务前完成 |
| ADR 0007 | L31：mutation 仅 `set`/`delete`/`array-insert`/`array-delete` | 批量不新增动词，元素为四动词信封 | no-conflict | 0007 L31；0026 L29 | 元素 op 词表封闭于四动词 |
| ADR 0007 | L46：逻辑校验保留完整 issues，结构/路径/操作错误 fail-fast | 批量聚合**全部失败操作**的 issues（跨操作聚合；操作内部仍 fail-fast）——ADR 0026 L41 明文决策并引 schema issues 多条先例 | no-conflict（由后决 ADR 0026 显式演进） | 0026 L41「聚合全部……不是 fail-fast 单错」 | 聚合只跨操作、按 ops 顺序拼接；不得改变单操作内部 issue 行为 |
| ADR 0008 | L47「空路径整体替换……是唯一清空并重装完整 ROOT 的 mutation」 | ADR 0026 允许元素为「完整合法的单操作信封」（字面含 `set([])`）；单元素批量 `{ops:[set([])]}` 在两两不嵌套规则下空真通过，会形成全量重装的**第二信封形态**，与 0008 唯一性句存在解释张力 | no-conflict（决策缺口，非矛盾——issue 未请求该形态） | 0008 L47；0026 L29；0026 未明示排除 `set([])` 元素 | **SA1 设计必须封口**：要么把 `set([])` 元素定为形状错误（与 0008 唯一性句最一致），要么明示等价 legacy 管线并记录理由；不得静默留下歧义 |
| ADR 0008 | L40–51 槽序、L85–93 fatal 通道、稳定码注册修订 L119–131 | 一个写槽 = 一次变更尝试；S1–S7 不重排；S3 对整个信封一次快照；无新增稳定码；fatal 面不变 | no-conflict | 0008 L49–51；write.ts 头注 INV-W2；0026 L42「fatal 通道不变；本 ADR 无新增稳定码」 | 批量不得新建槽类型、不得绕过 snapshotter（`{ops}` 数组是 plain data，可整体快照） |
| ADR 0025 | L72–74 组合节：批内元素不得携带 guard（形状错误）；guard 顶层叠加属后续票 #347–#349 | issue AC3 明示「元素携带未知键（含 guard）」即刻按形状错误拒绝；本票不含 guard 实现 | implements-existing-decision | 0025 L72–74；0026 L29/L55；issue AC3 | 元素 guard 键自本票起即拒；顶层 guard 不实现、不预留半成品 |
| ADR 0011/0014 | 0011 结局/阶段词表；0014 L61–89：每次变更尝试一条最终 attempt record、operation 封闭词表 `root-mutation`、rejected 禁携带 update、新增 operation 须新 record schema 版本 + stream generation | 批量仍是一条 root-mutation 变更尝试、一条记录、单事务单条 owned update bytes | no-conflict | 0014 L61–89；0026 L46；write.ts D-B 捕获窗口（单事务首赋值 update bytes） | 不得新增 operation/stage/result 词；聚合 issues 经 R9 同源透传进同一记录 |
| ADR 0014 amendment C（issue #228） | emit 调用点必须在 write sequencer slot 之外或释放之后 | 现行 `emitSlot` 由公共方法 `.then` 在槽释放后调用；批量不得把 emission 移进槽内 | no-conflict | 0011 澄清修订节 L158–159；diagnostic.ts 头注「槽外 emission」 | 保持槽外 emission；每结局点仍恰一行诊断写入 |
| ADR 0023 | L41：`NamespaceLease` 等服务方法返回值不是服务表面 | `mutateData` 信封演进不触 `ctx.provide` 服务表面纪律 | no-conflict | 0023 L41 | 无 |
| ADR 0002/0009/0010/0013/0016/0017/0018/0022；instance-replication-v1 | 范围外条款 | 批量不触复制 apply、wire 帧、readData、META、re-arm、authority 词表 | no-conflict | 0026 L50–51 边界节；协议文档无 0026 引用 | 保持复制面零改动 |
| CONTEXT.md | 「原子变更」「条件写」「写序列器」「零写入」「变更尝试」「语义 emission」词条 | issue 请求与全部词条一致；_Avoid_ 清单排除「多阶段命令拆写」「整父替换换原子」 | no-conflict | CONTEXT.md L89–122 | 实现与文档用词遵循词条（公共面词汇是「原子变更」非「事务」） |
| typed-access 技能（根 AGENTS.md 强制） | L163–201 批量信封范式；完成门（最小 edit/可合并/语义化证明） | 宿主 typed adapter 组装批量信封走 `PathAt`/`PathPatchValue`；引擎票不需改 codegen 契约 | no-conflict | typed-access.md L163–201；根 AGENTS.md「Typed Namespace writes——mandatory」 | 引擎公共类型保持可被 typed adapter 组装（数组元素类型可静态约束） |
| 模块 AGENTS（doc-runtime / namespace-runtime） | 公共 API 只经 `src/index.ts`、public-surface guard 覆盖每导出、FIFO/零写入/验证门槛 | 新增批量信封公共类型与解析行为须登记公共面守卫测试 | no-conflict | 两包 AGENTS.md；`public-surface-guard.test.ts`、`public-surface-type-guard.test-d.ts` 存在 | 新导出（如批量联合类型）同步登记守卫测试与类型负例 |

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| ADR 0007/0008 塑造的单操作 mutation 信封形态（隐式单形态；未知信封键 loud 拒绝） | ADR 0026（新 ADR 修订，2026-09-12 已接受，commit `211c5fa`；伴随 CONTEXT.md 词条、ADR 0025 组合节、typed-access 改写同变更集完成） | 仅 `mutateData` 受控 ROOT 信封形态：双形态互斥并存 | 批量形态按 0026 条款落地；单操作形态逐字节不变；旧运行区对 `{ops}` 按未知信封键 loud 拒绝（非静默） |

无 Owner 评论类 override（issue 无评论）；无协议版本升级类 override（wire 不涉）。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| 单操作信封行为 | 无 `ops` 的信封解析/管线/结果逐字节不变（含 `未知信封键` 拒绝文案路径） | 0026 L17/L65；issue AC5 | 现码 `parseMutation` 单形态；批量未实现——实现后须回归锚定 |
| 写槽槽序 S1–S7 | 不可重排；一槽一变更尝试；D5.1 接纳门在公共方法层 | 0008 L49–51；write.ts INV-W2；issue AC7 | 现状一致；实现须保持 |
| 稳定码注册表 | 批量无新增稳定码；`RUNTIME_WRITE_DISABLED`/`MUTATION_INPUT_NOT_PLAIN_DATA` 等码族与 message 模板不变 | 0026 L42；0008 修订节 2；errors.ts append-only | 现状一致 |
| 诊断词表与记录形态 | operation 封闭词表（仍 `root-mutation`）、stage/result 联合、一尝试一最终 record、rejected 禁 update、槽外 emission | 0014 L61–89；0011 修订节；diagnostic.ts | 现状一致；实现须保持（新增 operation 将强制 record schema 版本 + 新 stream generation——禁止） |
| op 动词词表 | `set`/`delete`/`array-insert`/`array-delete`，含各键集封闭 | 0007 L31；mutation.ts specs | 现状一致 |
| 复制 wire 与 apply | `instance-replication-v1.md` 全部帧/状态机零改动；复制 apply 不经批量信封 | 0026 L50；协议文档无 0026 引用 | 现状一致 |
| fatal 通道与语义 | 边界级提交后偏离仍 E201 变体 C（committed:true 不回滚）；internal fatal 永久禁写读保留 | 0007 #237 修订 §5；0008 L85–93 | 现状一致 |
| `ops` 上限 16 与元素 guard 禁令 | 词表常量；放宽/变更须过设计评审（0026 开放问题 1）；元素 guard 属 0025 顶层语义 | 0026 L29/L73；0025 L74 | 待实现核对 |

## 6. Evolution requirements

无待办演进。信封双形态这一契约演进**已经由已接受的 ADR 0026 变更集完整完成**，修订计划八要素核对：

- 修订文件：0026 新增、0025 增组合节、CONTEXT.md 词条新增/修订、typed-access 改写（`211c5fa`，同一 changeset）——完整。
- 新旧语义：双形态定义 + 单操作形态逐字节不变声明（0026 L14–30）——完整。
- 兼容与迁移：旧调用方零影响；旧运行区对 `{ops}` 按未知信封键 loud 拒绝（0026 L65；现码 `parseMutation` 已兑现该拒绝路径）——完整。
- 失败语义：形状错误无码不可重试 / 操作失败聚合 issues / fatal 不变（0026 L40–42）——完整。
- 版本：不涉 wire/schema/record 版本（operation 词表不变）——不适用项成立。
- 验证：doc-runtime 批量解析/prepare/单事务测试、namespace-runtime 端到端与诊断单条记录测试、根 typecheck+test（0026 L69；issue AC8）——完整。
- 冻结面：单操作形态冻结（见上表）——完整。
- 遗留缺口：仅 `set([])` 元素边界（见 Decision analysis ADR 0008 行）——属设计封口项，不属 ADR 修订缺失。

## 7. Hard conflicts

无。未发现与既有决策不兼容且无合法 override 的条款；ADR 0026 本身即为信封演进的合法修订 authority。

## 8. Required actions

1. **实现照抄 ADR 0026**：双形态互斥、`ops` 约束（非空/≤16/完整单操作信封/无未知键/无 `guard`/路径互不嵌套）、逐操作 prepare→整体零写入或单事务按序提交→逐操作边界验证、issues 聚合。
2. **SA1 设计必须封口 `set([])` 作为批量元素的边界**：推荐按形状错误拒绝（与 ADR 0008 L47「唯一清空并重装完整 ROOT 的 mutation」最一致）；若允许，须明示走 legacy 全量管线且不构成第二全量形态。不得留歧义给实现。
3. 新公共类型只经 `packages/doc-runtime/src/index.ts` 导出，并同步登记 `public-surface-guard.test.ts` / `public-surface-type-guard.test-d.ts`（含负例：双形态同现、元素携带 `guard`、嵌套路径、超上限均编译期或运行期 fail-closed）。
4. 诊断保持一条 root-mutation 最终 record：聚合 issues 经 R9 同源透传；emission 保持槽外 `.then` 调用；不得新增 operation/stage/result 词表项。
5. 单操作形态回归：既有 doc-runtime/namespace-runtime 全量测试零变化作为逐字节不变的锚。
6. 批量不触复制、wire、META、readData 面；`MUTATION_INPUT_NOT_PLAIN_DATA` 对整个 `{ops}` 信封的 S3 快照拒绝行为保持。
7. `ops` 上限 16、元素 guard 禁令为冻结词表；任何放宽须新决策（0026 开放问题 1）。

## 9. Verdict

**clear** —— 全部对照项为 no-conflict 或 implements-existing-decision；唯一的契约演进（信封双形态）已由已接受 ADR 0026 以完整修订计划（含同 changeset 文档联动）兑现，无 hard-conflict、无缺失修订。附带一项设计封口义务（`set([])` 批量元素边界）移交 SA1，不阻塞派发。

## 10. requiresConflictRecheck

**true** —— 公共 API（doc-runtime 信封联合类型与解析契约）、失败语义（聚合 issues、形状错误无码、单操作逐字节不变）与冻结面（诊断词表、槽序、稳定码）均尚待设计与实现核对；设计产出后应运行 SA8 设计后复审，实现触碰冻结面时按技能运行 implementation 复审。
