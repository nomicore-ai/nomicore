# SA8 冲突报告 — issue #364 实现后复查（implementation）

- Reviewed subject: **implementation**（SA3 iteration 1 工作树 diff + SA3 证据 log，对照
  已批准 SA6 契约、SA1 设计、SA8 iteration-0 冻结面、ADR 全集与规范文档）
- 迭代：1 · 复查对象 HEAD `f8a06fe`（分支 `mabf/issue-364`）+ 工作树未提交实现
  （28 modified + 5 untracked 测试文件；`git diff --stat` = +1417 / −1085）
- 聚焦面（dispatch 指定）：**公共 API 形状、类型/导出兼容性、冻结面是否被改动**
- 本报告只裁决冲突；不评价实现质量（SA4）、不判断验收完成度与突变全表（SA7）、
  不运行测试（绿证据取自 SA3 log 逐项复读）。Issue REST comments 为空——无 owner
  逐字判据、无新 override 需转写。

## 1. Inputs and decision set

| 输入 | 状态 |
| --- | --- |
| `wiki/raw/task_issue-364.md`（Host brief） | 在场（AC 10 条为裁决判据来源之一） |
| `wiki/raw/task_issue-364_sa6_contract.md`（approve；CT-1..CT-10、附录 A/B/C、U1–U7、M1–M8） | 在场；其冻结点（附录 A 字节格式、CT-8 联合解释、U2/U3）逐项核对 |
| `wiki/raw/task_issue-364_design.md`（SA1，含 §7-D1..D9、§11 ALLOW/DENY） | 在场；CT-8 解释采纳、W1 对齐、U3 决断均以设计为执行蓝本 |
| `wiki/raw/task_issue-364_sa2_review.md`（approve，O1–O6） | 在场；O1–O6 处置与 diff 一致性抽查 |
| `wiki/raw/task_issue-364_sa3_impl.md` + 9 份 log（red/green/typecheck/root-test ×2 轮 + M1 probe） | 在场；exit code 与计数逐份复读（见 §8 证据行） |
| `wiki/raw/task_issue-364_conflict_report.md`（SA8 iteration 0，clear；§4 冻结面 11 项 + W1–W4） | 在场；本复查的核对清单基线 |
| `docs/adr/**`（27 个；相关有效：0003/0008/0009/0016/0019/0023/0024/0027） | 实读；**工作树零改动**（`git status -- docs/adr` 空）——修订链文本未被触碰 |
| `CONTEXT.md`（词表权威 L38–58） | 实读；工作树零改动（零漂移核对通过） |
| 模块 AGENTS（runtime/registry/vfsl/doc-runtime）+ 根 AGENTS + `docs/AGENTS.md` | 明文收录决策计入决策集 |
| 实际 diff（`git status --porcelain` 33 路径 + 逐文件实读） | 生产 5 / 新契约测试 5 / 存量翻新 20 / 文档 3；与 SA1 §11 ALLOW LIST 逐路径比对**全命中、无 ALLOW 外路径** |
| Issue #364 comments（REST） | 空 |

## 2. Decision analysis

> 分类依据：`conflict-gate` skill。每项引用决策路径/条款与 diff 实证。

| # | Decision | Clause | Subject behavior（实现 diff 实证） | Classification | Evidence | Required action |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ADR 0027 决策 1（恒四键） | `docs/adr/0027-readdata-projection-text.md` L20–22 | 成功分支两处组装删 `truncations` 键位：legacy `runtime.ts` L578–584 `{ok,value,schema,truncated:false}`、预算 L605–611 `{ok,value,schema,truncated:result.truncated}`；类型面单一 `ReadDataOkResult`（见 #5） | **implements-existing-decision** | runtime.ts diff（组装两处）；`grep truncations packages/namespace-runtime/src packages/namespace-registry/src` → 仅 JSDoc 与内部参数名（喂渲染器的值通道清单），无结果键 | 无 |
| 2 | ADR 0027 决策 1（options 闭合形状 / 失败分支零变化） | L23–24；ADR 0024 决策 1 | `canonicalReadOptions` / `seamReadOptionsInvalid` / lifecycle gate / 重派发出口 / 失败透传**逐行未动**（runtime.ts diff 中这些符号零出现）；唯一接触点 = 预算成功点多传 `canonical.options` + `result.truncations` 两跳给 `projectReadDataSchema` | **no-conflict** | runtime.ts diff 符号扫描（`^[+-].*(seamReadOptionsInvalid\|readDisabled\|canonicalReadOptions)` → 0）；失败短路 `if (!result.ok) return result` 原样 | 无 |
| 3 | ADR 0027 决策 2/3（组装序 + 头行规范文法） | L29–31、L34–42；SA6 附录 A | `assembleProjectionText` = `headLine(normalized, options) + '\n\n' + renderProjectionText(resolved[, truncations])`；`headLine` = `# readData [<pathText>]` + 预算段（键序 depth→maxChildrenPerNode、逗号无空格、`String()` 呈现、foldSegment 与渲染器 foldText 同规则）；空路径 `pathText=''` → `# readData []`（**W1 按 C1/附录 B 操作性口径对齐，设计 §7-D2 冻结**，SA6 附录 A 伪公式字面 `[[]]` 未采用——iteration-0 W1 指定程序内处置，不动 ADR） | **implements-existing-decision** | read-schema-projection.ts L105–164（实读）；新契约 C1–C7（red test L366–456，含 `# readData [] {depth:1,maxChildrenPerNode:3}`） | 无 |
| 4 | ADR 0027 决策 4（detach 深拷贝层退役） | L46 | `detachReadSchemaProjection` / `cloneValueSchema`（双载）/ `cloneDiscriminator` / `cloneNumberRecord` / `cloneValueSchemaRecord` / `cloneDocsRecord` / `CloneMemo` **整段删除**；全仓 `grep -rE 'detach…\|clone…\|CloneMemo' packages/` → 0 命中；渲染器进程内直读 resolver 产物 | **implements-existing-decision** | read-schema-projection.ts diff（−216 行整段）；grep 实测 0 命中（= SA3 报告 G4 结构面，本次独立复核） | SA4 AST/符号级证据归 SA4（非冲突面） |
| 5 | ADR 0027 决策 4 + ADR 0024 决策 6（CT-8 联合解释） | 0027 L47；0024 L99–101；SA6 CT-8 注 | **两联合未合并**：`NamespaceRuntimeReadDataResult = ReadDataOkResult \| ReadLogicalValueFailure \| RuntimeReadDisabledResult`、`…BudgetResult = ReadDataOkResult \| ReadLogicalValueBudgetFailure \| RuntimeReadDisabledResult`——成功成员同型坍缩为内部 `ReadDataOkResult`（未公共导出），`READ_OPTIONS_INVALID` 仍只经 `ReadLogicalValueBudgetFailure` 属预算联合；零泄漏注释**原文保留**（「该联合\*\*不含\*\* READ_OPTIONS_INVALID（零泄漏：无 options 调用结构上不可达该码）」）；双重载签名与重载序未动（diff 中为 context 行） | **implements-existing-decision**（iteration-0 唯一自洽解释的落地） | runtime.ts L150–172（实读）；test-d 双向锁：`Extract<…,{code:'READ_OPTIONS_INVALID'}>===never`（shape-budget.test-d L56）+ 反向 `@ts-expect-error`（L120） | 无 |
| 6 | ADR 0027 决策 4（lease 别名跟随、透传零语义） | L48；ADR 0009 L40–44 | registry `types.ts` / `lease.ts` diff **仅 JSDoc**（别名定义与 `leaseReadData` 代码行零变化）；Equal 组合锁 `_readAlias`/`_readBudgetAlias`/`_readOverloadOrder`（lease.ts L412–422）原文在场；released 短路先于透传未动 | **no-conflict** | 两文件 diff（全部 hunk 为注释）；lease.ts L412–422 实读 | 无 |
| 7 | ADR 0027 决策 5（发布与 DSH 探针） | L50–53 | `git diff -- '**/package.json'` → **0 行**；无 lockfile/publish 脚本改动；仓外探针工具零代码改动（不属本仓 diff） | **no-conflict** | git diff 实测 | 发布 bump 归发布流程（非本票） |
| 8 | ADR 0027 修订链（0016/0024） | 0027 L55–58；0016/0024 状态行 | `docs/adr/**` 工作树零改动——历史文本未被改写，修订指针维持 0027 提交原状；sync-control 对 0016（`schema: ReadDataSchemaProjection \| null`）/0024（`truncations: TruncationsEntry[]`）的**权威源健全性门保持在场**（L367–376）并新增 0027 门（L387） | **no-conflict** | `git status -- docs/adr` 空；sync-control.test.ts L367–390 实读；根测试绿（log） | 无（W4 闭合） |
| 9 | ADR 0016 语义面（经 0027 延续） | 0016 L26/L72/L77 | 状态守卫（先于 path 守卫）→ `normalizeReadPath`（内层 try 只包扫描）→ resolver 两/三参分流 → `!resolved.ok → null`——守卫顺序与收敛面逐位未动；`schema:null` 严格 null（`assembleProjectionText` 只在 ok 分支可达）；`InternalError` 逃逸面扩盖渲染器（同为零 catch——模块头注明示「不包裹 resolveSchemaAtPath / renderProjectionText」）；值缺席照常返 schema（值读与投影解耦未动） | **no-conflict** | read-schema-projection.ts L83–101 实读；sequencer 测试 InternalError 逃逸锚仍在（runtime-mutate-root-sequencer.test.ts L796–806，未改） | 无 |
| 10 | ADR 0024 决策 1/2/5/6/7 + #359（未被 0027 修订） | 0024 L20–45、L80–109、L154–196 | `packages/doc-runtime/**` 零改动（值通道、`ReadLogicalValueTruncationEntry` 形状、E1 吸收纪律全部冻结）；预算校验单源未动（#2）；typed-access 预算纪律整句**原文保留**（HEAD L128 → 工作树 L127，内容逐字同——SA2 O4 内容锚成立） | **no-conflict** | `git status -- packages/doc-runtime` 空；typed-access.md「Typed budget discipline (ADR 0024 decision 7)…」双版本 diff 对读 | 无 |
| 11 | ADR 0024 验收节 L139「width 对投影无操作」句 | 0024 L139；SA6 §11 排除项行 7 | D4 锚按收窄口径落地：width-only 格「渲染器**正文**（剥离头行）与无预算读逐字节相等 + ✂ 在场 + ‡ 缺席 + **全文**不等」（red test L494 标题即明示全文必不等）——iteration-0 第 11 行裁决的执行面 | **no-conflict**（0027 已登记修订面的直接推论，非新决策面） | red test L494–507；SA6 CT-4 D4 | 无 |
| 12 | ADR 0008 读域框架（含 D8 镜像） | 0008 L18/L30/L97、L167–179、L223–239 | 读位置未移动（lifecycle gate / 值读先行定序未动）；`derived`/module/validator 仍不出公共面（文本 string 原始值交付，D8 核心保持）；读保留不变量锚（P0 未就绪/fatal 下 readData 照常）在 control 文件在场 | **no-conflict** | runtime.ts 编排段 diff（仅注释与成功组装变化）；control 测试 E 组 | 无 |
| 13 | ADR 0009 + registry AGENTS | 0009 L40–44；registry AGENTS | released 短路 `NAMESPACE_LEASE_RELEASED` 定序未动；registry 公共入口 `src/index.ts` 零改动（类型名未变，无需改导出——设计 §11 预判成立） | **no-conflict** | `git status -- packages/namespace-registry/src/index.ts` 空；lease.ts diff 仅 JSDoc | 无 |
| 14 | ADR 0003 / 0019 / 0023（外围） | 0003 冻结面；0019 决策 7；0023 服务表面 | `packages/vfsl/**` 零改动（渲染器/resolver/index 与 144 条 T1 测试冻结面完整）；`ReadDataSchemaProjection` 系仍为 vfsl 公共类型（仅 runtime.ts 不再导入、read-schema-projection.ts 内部续用为渲染器入参类型）；别名跟随不构成 0023 服务表面重设计 | **no-conflict** | `git status -- packages/vfsl` 空；vfsl/src/index.ts 未改（导出面原样） | 无 |
| 15 | SA6 U3 / SA8 W3：`ReadLogicalValueTruncationEntry` 公共转出 | SA6 §15 U3（两选皆可）；设计 §7-D6（决断退役 + 依据 a–d） | 转出已删（index.ts 原 L46），头注记录退役理由与消费方替代路径（直依 `@nomicore/doc-runtime`）；仓内唯一原消费者 `runtime-readdata-shape-budget.test-d.ts` 的 Equal 锁随票删除；新 test-d 对该类型的 H5 保持性守卫改自 doc-runtime 直依——**退役在 SA6 U3 明示的两选包络内，且是 SA1 显式决断**（iteration-0 必行动作 2/W3 的程序被遵守） | **no-conflict**（契约选项兑现，非越权扩张） | index.ts diff；grep 全仓无第三方从 `@nomicore/namespace-runtime` 导入该符号；projection-text.test-d.ts L33–37（doc-runtime 直依） | 无（W3 闭合） |
| 16 | CONTEXT.md 词表（L38–58） | `docs/AGENTS.md` Authority 节 | 工作树零改动；J7 零漂移核对随根测试绿 | **no-conflict** | `git status -- CONTEXT.md` 空 | 无 |
| 17 | `docs/AGENTS.md` 文档纪律 | Authority/Editing 节；SA6 CT-10 | 三份作用域文档（typed-access / cordis-plugin-hosting / external-project-vfsl-codegen）词汇重录 = **随契约变化更新**（非发明行为）：旧词汇扫描归零（`truncations`/`恒五键`/五键在 3 文档 0 命中）；cordis 跨 realm 节零触碰；codegen 明示 `.value` 适配器零代码变化；fixture 匹配器双向重录 + 新增 `retiredVocabularyViolations`（J4）；ADR 健全性门未删（#8） | **no-conflict** | 3 文档 diff 实读；fixture L28–215 谓词清单实读；J4/J5 由 sync-control 自控样本承载（根测试绿） | 无 |
| 18 | 根 AGENTS typed-access 写纪律（组合层零 cast） | 根 AGENTS「Typed Namespace writes」；SA6 §3 | read-schema-projection.ts ` as ` → **0 命中**；runtime.ts diff **零新增 cast**（`git diff \| grep '^\+.* as '` → 0）；`ReadLogicalValueTruncationEntry` ↔ `ProjectionTruncation` 结构透传无 cast（test-d H6 双向锚在场） | **no-conflict** | grep 实测；projection-text.test-d.ts H6 | 无 |
| 19 | SA6 U2 / SA8 W2（truncated 口径） | SA6 §15 U2；设计 §7-D5 | 预算分支逐字段透传 `result.truncated`、legacy 硬编码 `false`——**无 OR 合成**；D1/D2（⟺ ✂ 在场）、D6（null×预算诚实共存）锚在场；实现未演示出「投影独截」可达格 → 无需修订 CT-4 | **no-conflict**（契约钉死口径的执行） | runtime.ts L584/L610；red test D1/D5、D3、D4、D6、D7（L465–520） | 无（W2 闭合） |
| 20 | SA1 设计 §11 ALLOW/DENY（文件范围） | 设计 §11；SA6 §10.1–10.4 | 33 个改动路径逐一对号 ALLOW（生产 5 / 新契约 5 / 存量 20 / 文档 3）；DENY 面（vfsl、doc-runtime、docs/adr、CONTEXT、版本链、runner 配置、写路径、诊断、registry index、ws-replication、apps）`git status` **全空**；helper 随动组 7 文件零编辑（随 helper 四键化自动通过） | **no-conflict** | `git status --porcelain` 逐路径比对（本次独立执行） | 无 |

## 3. Overrides

| Old decision | Override authority | Scope | New obligation |
| --- | --- | --- | --- |
| ADR 0016 交付条款（四件套交付、每次读深拷贝） | ADR 0027（已接受；0016 状态行 + 文内指针显式登记——本次 diff 未触碰登记文本） | readData 投影通道交付形态 | 投影文本 string\|null + 恒四键 + detach 退役（**已兑现**，语义面原文延续经 #9 核对） |
| ADR 0024 决策 4 恒五键 / 决策 3 截断清单通道 | ADR 0027（同上登记链） | readData 成功分支键集与截断事实载体 | 恒四键；截断事实唯一载体 = ✂ 段（**已兑现**；决策 1/2/5/6/7 未动经 #10 核对） |

两次 override 的范围与 iteration-0 登记完全一致，**未扩大**；实现 diff 未产生新 override
（U3 转出退役是 SA6 U3 契约选项 + SA1 决断，不是决策override；W1 空路径口径是契约 U1
程序内对齐，不动 ADR）。无 owner 评论 override（comments 为空）。

## 4. Frozen surfaces

逐项核对 iteration-0 §4 冻结面 + 本票新增契约级冻结点（实际 diff）：

| Surface | Must remain unchanged | Evidence | Actual result（实现 diff 实测） |
| --- | --- | --- | --- |
| 值通道（doc-runtime） | `ReadLogicalValueResult` 恰 `{ok,value}`；预算递归、截断两形态、E1 吸收、`ReadLogicalValueTruncationEntry` 形状 | ADR 0024 决策 1/2 + #359；doc-runtime AGENTS | **保持**：`git status -- packages/doc-runtime` 空；H5 保持性守卫在场（test-d L72–78） |
| 渲染器（T1） | `renderProjectionText` 签名/输出/✂ 文法；144 条 T1 测试 | ADR 0027 决策 2；SA6 §10.4 | **保持**：`git status -- packages/vfsl` 空；根测试含该文件绿（4607 tests） |
| resolver 输出契约 | `resolveSchemaAtPath` 三参与 JSON 四件套输出 | ADR 0016 + 0024 决策 5 | **保持**：resolver 测试零改动（不在 changed paths）；组合层仍以四件套为渲染器入参 |
| options 闭合形状与失败码 | `{depth?,maxChildrenPerNode?}`；`READ_OPTIONS_INVALID` 矩阵、只属预算联合、三层透传 | ADR 0024 决策 1/6；issue AC6 | **保持**：校验/净化/短路代码零改动（#2）；零泄漏注释 + test-d 锁在场（#5） |
| 失败分支与生命周期 | 三失败码键集语义定序；released 短路；InternalError 唯一逃逸 | ADR 0008 + 0009；vfsl AGENTS | **保持**：失败透传/短路未动；逃逸通道扩盖渲染器仍是零 catch 单通道（#9） |
| 读域框架 | 读在 sequencer 外、只观察已提交事实 | ADR 0008；runtime AGENTS | **保持**：编排定序未动（#12） |
| ADR 正文 | 0016/0024/0008 等历史文本不改写 | `docs/AGENTS.md`；SA6 J7 | **保持**：docs/adr 零改动；健全性门在场且绿（#8） |
| CONTEXT.md 语义 | 只核对零漂移 | CONTEXT L38–58 | **保持**：零改动 |
| 版本号/发布链 | 本票零版本改动 | issue AC10；ADR 0027 决策 5 | **保持**：package.json diff 0 行（#7） |
| 写路径/复制/诊断 | mutateData/replaceSchema、replication、diagnostic 零改动 | 根 AGENTS；SA6 §10.4 | **保持**：write.ts/schema-write.ts/replication-write.ts/p0.ts/status.ts/diagnostic-log 均 `git status` 空 |
| typed-access 预算纪律整句 | 「Typed budget discipline (ADR 0024 decision 7)…」原文 | SA6 J1；ADR 0024 决策 7 | **保持**：内容逐字一致（行号 L128→L127 仅因上方编辑位移，SA2 O4 内容锚） |
| **（新增）公共结果联合结构** | 两联合名 + 双重载签名 + Equal 组合锁 + 重载序 | SA6 CT-8 注/H4；iteration-0 必行动作 2 | **保持**：未合并；`ReadDataOkResult` 仅内部；锁原文在场（#5/#6） |
| **（新增）runtime 公共导出面** | 除 U3 转出退役外导出键集不变 | 设计 §7-D3（不新增公共面） | **保持**：index.ts 导出清单仅删 `ReadLogicalValueTruncationEntry` 一项；`ReadDataOkResult` 未导出 |
| **（新增）头行字节格式** | SA6 附录 A（含 W1 对齐后口径） | SA6 U1；设计 §7-D2 | **保持**：headLine 实现与 C1/C4/附录 B 逐字节一致；oracle 断言全按操作性口径 |

**结论：无任何冻结面被改动。** 公共 API 形状变化（恒四键 + `schema: string|null` + 转出退役）
全部落在 ADR 0027 已登记修订面包络内，且该修订正是本票任务本体。

## 5. Evolution requirements

无。全部对照项为 `no-conflict` 或 `implements-existing-decision`；实现未引入新决策面、
未修订任何契约文本、未扩大 override 范围。U1（附录 A 伪公式内部不一致）按 iteration-0
指定程序在设计层完成对齐并落地（#3），SA6 契约原文属 Host/SA6 产物，SA3 依设计 §11
DENY（wiki/raw 他任务产物只读）未改——该残留为契约文档自身措辞问题，已由设计冻结 +
本报告引用闭环，无需 ADR/CONTEXT/协议演进。

## 6. Hard conflicts

无 `hard-conflict`。特别复核并排除：

1. **联合合并读法**（iteration-0 硬冲突排除项 1）：实现未合并两联合——成功成员同型、
   失败面分立、零泄漏注释与 test-d 双向锁在场（#5）。
2. **truncations 兼容期残留**（排除项 2）：结构化键在成功面**不存在**（`Extract<…,
   {truncations:unknown}>===never` 锁 × 6 处 + `'truncations' in r === false` 行为锚）；
   生产 src 树残留 `truncations` 字样仅为 JSDoc 历史注释与内部参数名（喂渲染器的值通道
   清单，非交付键）。
3. **公共面静默扩张**：`ReadDataOkResult` 未公共导出；无姊妹方法/双通道/第三参。

## 7. Required actions

1. **放行**（verdict `clear`）：实现通过冲突复查，可进入 SA4 审查与 SA7 验收。
2. 非阻塞移交（非冲突面，属其他角色职责）：SA4 的 clone 符号 AST 级证据与零 cast 全量
   核对；SA7 的 M2–M8 突变全表（SA3 仅做了 M1 sanity probe，已自证非伪绿）、DSH 探针
   与发布流程 bump（AC10）；SA4/SA7 知悉 SA3 报告 Deviation 7（control 文件头注措辞
   略宽）与 Deviation 2（CT-9 I2 自洽读法）两项登记。
3. iteration-0 watch 项 **W1/W2/W3/W4 全部闭合**（#3/#19/#15/#8）。

## 8. Verdict

**clear**

- 决策分析 20 项：`implements-existing-decision` 5 项（ADR 0027 决策 1/2+3/4 的直接兑现
  与 CT-8 解释落地）、`no-conflict` 15 项；`evolution-required` 0、`hard-conflict` 0。
- 冻结面 14 项（iteration-0 §4 全部 11 项 + 公共联合结构/导出面/头行字节格式 3 项新增
  核对面）**零改动**。
- 公共 API 形状：恒四键 + `schema: string | null` 落地且两联合未合并；类型/导出兼容性
  由根 `pnpm typecheck` exit 0 + `vitest --typecheck` no errors（386 files / 4607 tests，
  含 4 个翻新 + 2 个新 `.test-d.ts`）证据闭合；唯一导出移除（U3）在契约包络内。
- 证据链自洽：red log（22 failed / 16 passed，红签名 = 目标形状断言）→ green（346
  tests）→ 根 typecheck → 根测试双轮（clean 轮 606.78s / 0 failures）→ M1 受控突变
  击穿 A2/B1/B3 后 sha256 逐字节还原——与工作树状态、ALLOW 清单、冻结面扫描一致。

## 9. requiresConflictRecheck

**false** —— 理由：本报告即 iteration-0 §9 (a)(b)(c) 三触发条件所要求的实现后复查，
且已在**实际 diff** 上逐项闭合——(a) 公共 API 结果形状（恒四键、类型坍缩、导出面）已核对；
(b) CT-8 联合解释、附录 A 头行字节冻结（含 W1 对齐）、U2/U3 契约级冻结点已核对；
(c) 冻结面清单已在 diff 上逐项复核为零改动。后续 SA4/SA7 工作属审查/验收职权，不涉及
决策面变更；发布期 bump 属发布流程（若届时伴随契约变更则由该流程自行触发复查）。
