# SA8 冲突报告 — issue #364 前置门禁（task）

- Reviewed subject: **task**（`wiki/raw/task_issue-364.md` Host brief + 已批准的 SA6 验收契约
  `wiki/raw/task_issue-364_sa6_contract.md`；issue REST comments 为空，无 owner 逐字判据）
- 迭代：0 · 诊断 HEAD `f8a06fe`（分支 `mabf/issue-364` = `origin/adr0027-projection-text` tip）
- 裁决问题：**readData 投影文本化原子切换（恒四键、✂ 单一截断载体、组合层退役）是否与
  现有决策集冲突**
- 本报告只裁决冲突，不评价设计优劣（SA2）、不实现（SA3）、不判断验收完成度（SA7）。

## 1. Inputs and decision set

| 输入 | 状态 |
| --- | --- |
| `wiki/raw/task_issue-364.md`（task brief：What-to-build 5 条 + AC 10 条） | 在场 |
| `wiki/raw/task_issue-364_sa6_contract.md`（SA6 验收契约，approve） | 在场；其证据（probe/baseline log）逐项复核属实 |
| `docs/adr/**`（27 个 ADR） | 全部读取状态行；相关且有效：0003/0008/0009/0016/0019/0023/0024（含 #359 amendment）/0027；无 superseded 参与裁决 |
| `CONTEXT.md`（词表权威） | L38–58 已含 ADR 0027 词汇 |
| 模块 AGENTS（runtime/registry/vfsl/doc-runtime）+ 根 AGENTS + `docs/AGENTS.md` | 已读；其明文收录的决策计入决策集 |
| `docs/protocols/instance-replication-v1.md` | 与 readData 无关（本地 seam，非 wire 面）——不构成约束面 |
| Issue #364 comments（REST） | 空——无 owner override 需转写 |
| 源码/测试 | 仅用于确认当前事实（五键在位、渲染器零接线、detach 层在场、双联合在场），不替代决策文本 |

## 2. Decision analysis

| # | Decision | Clause | Subject behavior | Classification | Evidence | Required action |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ADR 0027 决策 1 | 成功分支恒四键 `{ok,value,schema,truncated}`；`schema`=投影文本 string\|null；`truncations` 键删除；`truncated` 保留；单 API | task AC1 + SA6 CT-1/CT-9：恒四键、`truncations` 负控、类型面零泄漏锁；HEAD 现状恒五键（`runtime.ts` L572–578/L600–606，SA6 E1 探针一致）——缺口 = 已接受决策未兑现 | **implements-existing-decision** | `docs/adr/0027` L18–25；issue AC1；SA6 §5 E1/E2；本门禁 grep 复核 | 按 SA6 §10.1/§12 落地；无修订需求 |
| 2 | ADR 0027 决策 1 | options 闭合形状 `{depth?,maxChildrenPerNode?}` 零变化；失败分支形状与语义不动；`schema:null` 单义不变 | task AC5/AC6 + CT-5/CT-6：失败码三通道、键集、定序、canonical 等价、透传全部零变化回归 | **no-conflict** | `docs/adr/0027` L23–24；ADR 0024 决策 1；SA6 CT-5/CT-6 | 无 |
| 3 | ADR 0027 决策 2 | 渲染器零选项纯函数；`ReadDataSchemaProjection` 系保留公共类型（resolver 输出/渲染器入参契约）；组装序 = 头行→正文→✂ | task AC2 + CT-2 一致性锚（`schema` ≡ 头行 + `renderProjectionText(resolveSchemaAtPath(derived,…))`，公共 API oracle）；T1 已交付且 §10.4 冻结渲染器零改动 | **implements-existing-decision** | `docs/adr/0027` L27–32；`packages/vfsl/src/index.ts` L154；生产面 0 接线（本门禁 grep 复核 = SA6 E5） | 组合层接线，不动 vfsl/src |
| 4 | ADR 0027 决策 3 | 头行 `# readData [<path>] {depth:N}` 与 ✂ 段为规范文法；✂ 承担截断事实契约职责 | task AC3/AC4 + CT-3/CT-4；ADR 未给全逐字节细节（path 记法/行注入折叠/预算段键序/分隔）由 SA6 附录 A 冻结（契约 §15 U1：偏离须先显式修订契约） | **implements-existing-decision**（SA6 字节冻结在 ADR 文法框架内，未越权改义） | `docs/adr/0027` L31、L34–42；issue AC3 措辞 `{depth:N[,maxChildrenPerNode:K]}` 与附录 A 一致 | 见 watch 项 W1（附录 A 空路径伪公式内部不一致，非 ADR 冲突） |
| 5 | ADR 0027 决策 4 | detach 深拷贝层退役；隔离不变量由渲染结果形态保证 | task AC7 + CT-7：文本隔离锚（G1/G2）替代引用/冻结断言；detach 符号在场待退役（`read-schema-projection.ts` L142–169） | **implements-existing-decision** | `docs/adr/0027` L46；SA6 §8 Step 3；本门禁符号复核 | 无 |
| 6 | ADR 0027 决策 4 | readData 结果类型坍缩为单一四键形（预算/legacy 双结果联合消失）；lease 别名跟随、透传零语义变化 | task What-to-build + CT-8 **契约解释**：成功成员坍缩为同一四键类型；两联合**名**与双重载签名保留——合并联合将使 legacy 面结构可达 `READ_OPTIONS_INVALID`，与 ADR 0024 决策 6 零泄漏（未被 0027 修订）及 issue AC6「失败码不动」直接冲突 | **no-conflict**（该解释是全决策集唯一自洽读法；字面「合并联合」读法才会制造未登记硬冲突） | `docs/adr/0027` L47；`docs/adr/0024` L99–101 + 状态行（0027 只修订 0024 决策 3/4，未修订决策 6）；`runtime.ts` L140–146 零泄漏注释；SA6 CT-8 注 + H4 | SA1 设计必须采纳该解释或先走显式修订（见 W2） |
| 7 | ADR 0027 决策 5 | 破坏性 minor bump；DSH 探针零代码改动 | task AC10 + SA6 §10.4：本票不改版本号/发布链（归发布流程） | **no-conflict**（ADR 未要求实现票内 bump；issue 为 owner 指令且方向一致） | `docs/adr/0027` L50–53；issue AC10 | diff 核对无版本改动（SA7） |
| 8 | ADR 0027「对既有 ADR 的修订」节 | 0016 交付条款、0024 决策 3/4 恒五键/截断清单通道的取代 | 修订链已显式登记：0016 状态行 L4 + 文内指针；0024 状态行 L4 + 文内指针——符合 `docs/AGENTS.md`「显式修订、不静默矛盾」 | **no-conflict**（合法 override 链，见第 4 节） | `docs/adr/0016` L4/L22–24；`docs/adr/0024` L4/L35–53 | 无 |
| 9 | ADR 0016 语义面（经 0027 延续） | null 单义三情形；always-on；值缺席照常返 schema；resolver 条款 + InternalError 逃逸 | task AC5 + CT-5 E1/E2/E5 全部保持；oracle 用 `compileSchemaEnvelope` 属仓内 resolver 直达（0027 已知限制 1 明文许可） | **no-conflict** | `docs/adr/0016` L26/L77/L72；`docs/adr/0027` L62；vfsl AGENTS（InternalError 例外） | 无 |
| 10 | ADR 0024 决策 1/2/5/6/7 + #359 amendment（未被 0027 修订） | 值通道预算递归、截断两形态、E1 吸收纪律、READ_OPTIONS_INVALID 只属预算联合、DeepOptional、typed-access 纪律三句 | task/SA6 负控层 1（值通道零变化）+ CT-4 D7 + CT-6 F2 + CT-10 J1（三句原文保留）；doc-runtime 零触碰（§10.4） | **no-conflict** | `docs/adr/0024` L20–45、L99–109、L154–196；SA6 §6 层 1、CT-8 H5 | 无 |
| 11 | ADR 0024 验收节「width 对投影无操作：……schema 投影与同路径无预算读逐字节相等」（L139） | 成文于 JSON 投影 + 无头行时代 | 0027 决策 3 头行事实性（含预算段）⇒ width-only 读**全文**必然不等；SA6 把相等性收窄为「渲染器正文逐字节相等」（CT-4 D4/E1 负控） | **no-conflict**（语义性质「width 对投影无操作」在渲染器层保留；旧验收句的对照框架已被 0027 头行条款取代，且该取代属 0027 已登记修订面的直接推论） | `docs/adr/0024` L139；`docs/adr/0027` L31（头行=事实锚）；SA6 §11 排除项行 7 | 实现复查核对 E1 负控在场（正文相等 + 全文不等） |
| 12 | ADR 0008 读域框架（经 0024 修订节） | 读取不进 sequencer、只观察已提交事实、失败通道、`RUNTIME_READ_DISABLED` 停接纳先于 options 触达、公共面只暴露 detached 投影 | task 组合层改动不移动读位置、不动 lifecycle gate 定序（CT-5 E3/E4）；文本形态天然满足「公共 API 只暴露 detached 投影」（runtime AGENTS 边界） | **no-conflict** | `docs/adr/0008` L18/L30/L97、L223–239；runtime AGENTS；SA6 CT-5 | 无 |
| 13 | ADR 0008「ADR 0016 修订」节 D8 镜像（L167–179） | `derived` 只经 readData 投影受控只读深拷贝进入公共面（**其第 2 点明示交付纪律「以 ADR 0016 为权威」**）；module/validator 永不公共 | 0027 在权威方（0016）退役深拷贝条款并已登记；文本渲染进程内直读不递出活引用——D8 核心（module/validator 不公共、derived 不以活引用出场）保持 | **no-conflict**（镜像句随权威方演进；非独立决策面，无需单独修订登记） | `docs/adr/0008` L169–177；`docs/adr/0016` L4；`docs/adr/0027` L46、L57 | 无 |
| 14 | ADR 0009 + registry AGENTS | lease 独立 capability；release 幂等；released 短路 `NAMESPACE_LEASE_RELEASED`；公共 API 只经 `src/index.ts` | task：lease 透传零语义变化、别名跟随（Equal 组合锁保持，CT-8 H4）；released 短路先于透传（CT-1 A5、CT-6 F4） | **no-conflict** | `docs/adr/0009` L40–44；registry AGENTS；`lease.ts` L410–422；ADR 0023（服务表面 getter 化不受别名跟随影响） | 无 |
| 15 | ADR 0003 / 0019（冻结面/输入面） | ValueSchema 9-kind 封闭联合；memberDocs 切片三来源 | 本任务不扩展 ValueSchema（截断包装联合退出公共读面后仍是 resolver 内部入参）；resolver 测试零改动（§10.4）；0019 属渲染器输入侧（T1 已承载） | **no-conflict** | `docs/adr/0027` 备选节（否决动 0003/0024 冻结面的 wire 紧凑化）；`docs/adr/0016` L108–126；SA6 §10.4 | 无 |
| 16 | CONTEXT.md 词表（L38–58） | 投影文本/✂ 段/截断省略/形状预算词条已由 ADR 0027 提交写完 | task AC9 对 CONTEXT 只做零漂移核对（J7），不重写语义 | **no-conflict** | CONTEXT.md L41–59（含 _Avoid_ 旧词汇清退）；`docs/AGENTS.md`（词表权威） | 无 |
| 17 | `docs/AGENTS.md` 文档纪律 | ADR 是历史记录不随条款改写；文档不得发明实现行为；链接权威源 | task AC9/CT-10：作用域文档词汇重录 + 匹配器词汇双向重录（J6）；ADR 正文健全性门保持绿（J7）；J1 的 `adr0016Refs` 放宽 = 挂接新权威源 0027，符合「链接权威源」 | **no-conflict** | `docs/AGENTS.md` Authority/Editing 节；SA6 CT-10 J1/J6/J7 | 无 |
| 18 | 根 AGENTS typed-access 写纪律 | 写路径必须生成投影 + typed adapter；禁 cast | 本票零写路径改动；CT-8 H6 明令组合层零 cast 过类型缝 | **no-conflict** | 根 AGENTS「Typed Namespace writes」；SA6 §3、CT-8 H6 | SA4 审查证据核对零 cast |
| 19 | issue AC4 `truncated` 语义（值通道截断 ∨ 投影截断）vs SA6 U2 钉死 `truncated === valueOracle.truncated` | — | 81 格可达矩阵内两实现不可区分（E3：无「投影独截」格）；SA6 已登记残差风险与演进路径（若设计演示出可达格，按 AC4 改 OR 并同步修订 CT-4） | **no-conflict**（可达域上等价；残差已按 U2 显式登记，不是静默收窄） | SA6 §9 E3、§15 U2、CT-4 D1/D2 | 设计/实现期若出现「投影独截」可达格须先修订契约再落测试 |
| 20 | SA6 U3：`ReadLogicalValueTruncationEntry` 公共转出建议退役 | ADR 0027 决策 1「JSON 投影四件套从公共读面退役」的爆炸半径内；doc-runtime 本体类型冻结不动 | 退役/保留两选均不改变 CT-1..CT-10；SA6 不强制 | **no-conflict**（留 SA1 裁量；若保留须 JSDoc 声明其为值通道事实） | `docs/adr/0027` L25；SA6 §15 U3、§10.1 | SA1 显式决断并在设计记录依据 |

## 3. Overrides

| Old decision | Override authority | Scope | New obligation |
| --- | --- | --- | --- |
| ADR 0016 交付条款（四件套经 readData 交付、每次读投影深拷贝） | ADR 0027（新 ADR 修订旧 ADR，2026-09-14 已接受；0016 状态行 + 文内指针显式登记） | readData 投影通道交付形态 | 投影文本（string\|null）+ 恒四键 + detach 退役；语义面原文延续 |
| ADR 0024 决策 4 恒五键形状、决策 3 截断清单通道 | ADR 0027（同上；0024 状态行 + 文内指针显式登记，先例 #338/#359 修订链一致） | readData 成功分支键集与截断事实载体 | 恒四键；截断事实唯一载体 = 投影文本 ✂ 段；决策 1/2/5/6/7 语义不变 |

无 owner 评论 override（issue comments 为空）；无需 SA8 替 Owner 或 SA1 创建任何 override。
实现方便、测试基线、既有代码（恒五键）都不构成 override——它们正是本票要退役的旧实现。

## 4. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（前置门禁 = 计划面核对；实现 diff 尚未发生） |
| --- | --- | --- | --- |
| 值通道（doc-runtime） | `ReadLogicalValueResult` 恰 `{ok,value}`；预算递归、截断两形态、E1 吸收纪律、`ReadLogicalValueTruncationEntry` 形状 | ADR 0024 决策 1/2 + #359 amendment 1/2；doc-runtime AGENTS | 契约保持（CT-4 D7、CT-8 H5、§6 层 1；§10.4 doc-runtime 零触碰） |
| 渲染器（T1） | `renderProjectionText` 签名/输出/✂ 文法；144 条 T1 测试 | ADR 0027 决策 2；SA6 §10.4 | 契约保持（§10.4 vfsl/src 红线；M 表禁改渲染器） |
| resolver 输出契约 | `resolveSchemaAtPath` 三参与 JSON 四件套输出（渲染器输入） | ADR 0016 解析语义 + 0024 决策 5；ADR 0027 决策 2（保留公共类型） | 契约保持（resolver 测试零改动，§10.4） |
| options 闭合形状与失败码 | `{depth?,maxChildrenPerNode?}`；`READ_OPTIONS_INVALID` 校验矩阵、只属预算联合（零泄漏）、三层透传 | ADR 0024 决策 1/6；issue AC6 | 契约保持（CT-6、CT-8 H4/I5） |
| 失败分支与生命周期 | `PATH_NOT_ALLOWED`/`READ_OPTIONS_INVALID`/`RUNTIME_READ_DISABLED` 键集语义与定序；released `NAMESPACE_LEASE_RELEASED` 短路；InternalError 唯一逃逸通道 | ADR 0008 + 修订节 1；ADR 0009；vfsl AGENTS | 契约保持（CT-1 A4/A5、CT-5 E3–E5、I4） |
| 读域框架 | 读在 sequencer 外、只观察已提交事实、读取保留不变量 | ADR 0008；runtime AGENTS | 契约保持（组合层不移动读位置） |
| ADR 正文 | 0016/0024/0008 等历史文本不改写（修订指针已由 0027 承担） | `docs/AGENTS.md`；SA6 CT-10 J7 | 契约保持（J7 门保持绿；watch 项 W4） |
| CONTEXT.md 语义 | 只核对零漂移，不改语义 | CONTEXT.md L38–58；SA6 §10.3 | 契约保持（J7 只读检查） |
| 版本号/发布链 | 本票零版本改动 | issue AC10；ADR 0027 决策 5 | 契约保持（§10.4；SA7 diff 核对） |
| 写路径/复制/诊断 | mutateData/replaceSchema、replication、diagnostic 零改动 | 根 AGENTS 写纪律；§10.4 | 契约保持 |
| typed-access 预算纪律三句 | L126/L130/L132 原文保留 | ADR 0024 决策 7；SA6 CT-10 J1 | 契约保持（J1 明令原文保留） |

## 5. Evolution requirements

无 `evolution-required` 项。任务所需的全部契约演进已由 **ADR 0027 完成并显式登记**
（0016/0024 状态行 + 文内指针），CONTEXT.md 词汇已同步，协议文档无涉。本票是执行票，
不新增决策面、不需新 ADR。U1（头行逐字节）/U2（truncated OR 语义）/U3（类型转出）
是 SA6 契约层冻结与登记的残差，不属于 ADR 演进缺口。

## 6. Hard conflicts

无 `hard-conflict` 项。特别核对并排除的两个潜在硬冲突：

1. **「合并双联合」字面读法**（ADR 0027 决策 4「双结果联合消失」若读成合并两联合为
   一）：将使 legacy 两参调用结构可达 `READ_OPTIONS_INVALID`，与未被 0027 修订的
   ADR 0024 决策 6 零泄漏及 issue AC6 直接冲突。SA6 CT-8 已钉死自洽解释（成功成员
   同型坍缩、联合名/重载序保留），任务按此执行则无冲突。
2. **「保留 truncations 兼容期」**：issue 明令原子切换；类型面 Equal 锁 + 消费测试
   字面断言使双形态编译不可行（SA6 E7）——与 ADR 0027 决策 1 冲突，任务未采用。

## 7. Required actions

1. **放行**（verdict `clear`）：按 SA6 契约 §10/§12 派发实现——生产面 §10.1、
   测试翻新 §10.2、文档 §10.3、红线 §10.4。
2. **SA1 设计必须显式采纳 CT-8 解释**（成功成员坍缩为同一四键类型；两联合名与
   重载序保留、零泄漏锁不动）；偏离须先修订 SA6 契约再落测试（U1 同款程序）。
3. **Watch 项**（非阻塞，实现/复审期关闭）：
   - W1：SA6 附录 A 伪公式 `pathText = "[]"`（空路径）与 C1/附录 B 样张 `# readData []`
     存在内部张力（公式字面代入得 `[[]]`）。操作性断言（C1/B）一致钉死 `[]` 且与
     ADR 0027 决策 3 `[<path>]` 文法相容——非决策冲突；SA1/SA3 冻结 oracle 期望串前
     应先把伪公式与 C1 对齐（契约 U1 程序内修订，不动 ADR）。
   - W2：U2 残差——若设计演示出可达「投影独截」格，按 issue AC4 改 OR 语义并同步
     修订 CT-4（先契约后测试）。
   - W3：U3 由 SA1 显式决断（退役或保留 + JSDoc），两种选择均不改变验收断言。
   - W4：CT-10 J7 的 ADR 权威源健全性门（对 0016/0024 正文）必须保持在场且绿——
     不得为过门改写 ADR 历史（`docs/AGENTS.md`）。
4. **实现后复审**（design 如要求 / diff 触碰 ADR/协议/冻结面时）：逐项核对第 4 节
   冻结面 + CT-8 解释落实 + §10.4 红线零改动 + 无版本号改动。

## 8. Verdict

**clear** —— 全部对照项为 `no-conflict` 或 `implements-existing-decision`：
本票是已接受 ADR 0027（决策 1/2/3/4，边界由决策 5 界定）的直接兑现票，修订链
（0016/0024）显式登记完整，词表已同步，包边界与冻结面全部保持。红灯签名（SA6 E2）
证明缺口可归因于「决策未实现」而非契约矛盾。

## 9. requiresConflictRecheck

**true** —— 理由：(a) readData 公共 API 结果形状（恒四键）尚待实现核对；
(b) CT-8 联合解释、附录 A 头行字节冻结、U2/U3 等 SA6 契约级冻结点尚待设计与
实现一致性核对（watch 项 W1–W4）；(c) 冻结面清单（第 4 节）需在实现 diff 上逐项
复核。纯 no-conflict 且无新决策面的判断不适用于本票——公共读面形状变更是实质
API 面，设计后复审与实现后复查按上述触发条件执行。
