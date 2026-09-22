# SA8 设计后冲突复查报告 — issue #440：vfsl 逐 entry 校验扩展（Record + 封闭对象 delete）与一致性 fixture 扩展（ADR 0034）

- 角色：SA8（Conflict Gatekeeper）｜phase：design 复查（设计后复审）｜iteration 0
- 被审对象：`wiki/raw/task_issue-440_design.md`（SA1 设计，iteration 0）
- 复查基准：ADR 全集（34 篇，状态逐一核阅）+ `CONTEXT.md` + `docs/vfsl/v1-spec.md`（包规范）+ 模块 `AGENTS.md` 明示收录的决策
- worktree：`mabf/issue-440` @ HEAD `0a91f1429c3818320eaacdf2a33d2a267d79620e`（ADR 0034 文档提交，实读核实）
- 前置门禁工件：`task_issue-440_relevant_decisions.md` / `task_issue-440_conflict_report.md` **不存在**（iteration 0，SA6 §1 与设计 §6 同述；本报告为 #440 首份 SA8 工件，兼采相关决策摘录职能于 §2/§3）

---

## 1. Reviewed subject

**design**（SA1 设计全文 372 行逐节审阅）。不判断设计优劣（SA2 职责——本票 SA2 review 不存在）、不判断实现质量（SA4/SA7）、不改任何被审对象或决策文档。

## 2. Inputs and decision set

| 输入 | 角色 | 核验方式 |
|---|---|---|
| `wiki/raw/task_issue-440.md` | 任务简报（What to build + AC1–AC6 + Blocked by #437） | 实读；REST comments 为空（简报 + SA6 §2 双源一致），无 owner 需求面 |
| `wiki/raw/task_issue-440_design.md` | 被审对象 | 逐节实读；其 §2 事实锚点 C1–C10 逐条对源码复核（见 §3 各行 Evidence） |
| `wiki/raw/task_issue-440_sa6_contract.md` | 上游固定工件（approve 契约） | 实读；其引用的行号/符号抽样核对 |
| `wiki/raw/task_issue-440_sa6_capability_probe.mts` + `artifacts/sa6-issue440-probe.log` | 上游固定工件（探针与证据） | md5 复核（`0b598041…` 与 SA6 §16 登记一致）；探针日志 G1/等价集结论实读 |
| `docs/adr/**`（34 篇） | 决策集 | 状态行逐一提取：0001–0030、0032–0034 均 accepted（0015 为「提议」，不构成约束；0016/0024 带 0027 修订注记；0007 带 issue #237 修订节 + ADR 0033 修订注记）；无 superseded 状态的 ADR 对本票构成约束豁免 |
| `CONTEXT.md` | 共享词汇（根权威） | 「重建校验」L143-144、「复制未校验」L201-202 实读——ADR 0033/0034 两阶段触达面立法已入词汇 |
| `docs/vfsl/v1-spec.md` | 语言规范（`packages/vfsl/AGENTS.md` 点名 normative） | Record/Pattern/E306/物化表核阅；本票不动语言面 |
| `docs/adr/0034-record-and-parent-elementwise-validation.md` | **母法**（accepted @ HEAD `0a91f14`） | 决策 1–6 + 不做什么 + 后果逐条对照（§3 行 1–6） |
| `docs/adr/0033-elementwise-yarray-mutation-validation.md` | 同族先例（accepted） | 决策 1–6 对照（§3 行 7） |
| `docs/adr/0007-…md` issue #237 修订节 + ADR 0033 修订注记 | mutation 管线既有契约 | L62–140 实读（**发现语料缺口，见 §3 行 8 与 §6**） |
| `docs/adr/0010-…md` issue #237 修订节 | 触达面后备句 | L333–361 实读（标题点名惯例已覆盖，见 §3 行 9） |
| `packages/vfsl/AGENTS.md`、`packages/doc-runtime/AGENTS.md`、根 `AGENTS.md` | 模块契约/纪律 | 实读 |
| 源码事实 | 确认当前事实（不替代决策文本） | `validate-patch.ts`（L1–34 头注/imports、L726–822 规划器、L900–1022 边界接缝、L1034–1146 #435 节）、`validate.ts`（L140–149、L355–379、L638–694）、`index.ts`（L120–147）、`mutation-local.ts`（L255–349）、`derived.ts` 抽样 |
| `git log`/`git status` | 链序与冻结面核实 | ADR 0033 家族（#435 vfsl 接缝 + #436 doc-runtime fast path + #437 lease 测试）经 `ca0ab53`（PR #434）已在 HEAD 祖先链；SA6 五件冻结产物 md5 逐一复核一致 |

**决策集界定**：代码与 wiki 其他文档不构成自动阻塞依据；`wiki/raw/` 工件是证据不是规范契约（docs/AGENTS.md「Authority」节）。SA6 契约 B-1…B-6 绑定点是**上游固定工件的名目冻结**，不是决策集成员——设计对其「原样采用、不触发重绑」是工件纪律问题，不是 ADR 冲突问题（§3 行 11 单列核验）。

## 3. Decision analysis

| Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| ADR 0034（accepted @ HEAD） | 决策 1：Record set/delete 逐 entry fast path；闸门 = 非 union Record 形态（object 节点含 `<key>` 槽）；union map 位永久 legacy；值位 union 不排除；旧值不读；域规则不变；issue 路径 `[...mapPath, key]` 逐字节兼容 | 设计 §8.1 三重闸门（kind ∈ {record,parent} ∧ relPath=[string key] ∧ node.kind=object ∧ kind↔形态一致）fail closed；set 支单 entry 合成视图过 `validateSubtree`（键 Pattern + 新值，set 不读 `facts.has`）；delete 支仅在场/no-op 域规则；F2 钉 union map 位不接管；rebase 式 `[...plan.prefix, ...i.path]` 与 legacy `validateBoundary`（`validate-patch.ts:1015-1022`）同式 | **implements-existing-decision** | `docs/adr/0034:16-22`；设计 §7.2 D2/D3、§8.1/§8.2；源码 `validate.ts:655-667`（Record 形态纯逐键判定）、`validate-patch.ts:954-981`（legacy 对照）；SA6 G3/G4 探针实测 | 无（实现后按 §5 冻结面核对） |
| ADR 0034 | 决策 2：封闭对象 delete 静态必填判定（必填 ∧ 非 `unknown` 标量 → 拒；optional ∨ `unknown` → 允；`has(key)` 拒 no-op；不读父值；未知键不可能在场） | 设计 §7.2 D4 逐条镜像 `validate.ts:672-681` 次序：optional 包装先查 → ref 解析（`walkRefChain` + `valueLens`，与 `resolveValues` 同算法同文案）→ unknown 标量跳过 → 必填拒（`缺少必填字段 "${key}"` 逐字）；缺字段 fail closed（规划层不可达，`planMutationBoundary:803-806` 证实 delete 恒 kind=record/parent 且 relPath=[last]） | **implements-existing-decision** | `docs/adr/0034:24-31`；设计 §7.2 D4；源码 `validate.ts:670-682`、`validate-patch.ts:78,36`（valueLens/walkRefChain 在场可复用）、`:803-817` | 无 |
| ADR 0034 | 决策 3：S9 收窄——fast-path 提交省略边界重投影（无 proposedBoundary）；返回 `ValidateResult` 直出 | 设计 D1 签名返回 `ValidateResult`（ok 支恰 `{ok:true}`，无 `result`/`proposedBoundary` 包装）；与 #435 先例（`validate-patch.ts:1074-1077`）同构；doc-runtime S9 面本票零改动（接线归 #441） | **implements-existing-decision** | `docs/adr/0034:33-35`；设计 §7.2 D1、§8.3；`mutation-local.ts:266-310`（本票不动的 legacy 轨） | 无（#441 接线时再核） |
| ADR 0034 | 决策 4：触达面 = map/父载体 + 目标键位；污染容器写由连带拒绝变目标键合法即成功（扩展 ADR-0010 issue #237 修订节） | 设计 D5：接缝输入面只收 `{has}`（结构上不携带其他 entry/父值）；fixture 触达面组 10 例 + 负控 NC7（legacy 连带拒绝对照基线）；端到端钉正归 #442 | **implements-existing-decision** | `docs/adr/0034:37-41`；`CONTEXT.md:201-202`（两阶段立法已入词汇）；设计 §7.2 D5、§13 残余 2；fixture 头注「触达面分类」节 | 无（#442 承担端到端） |
| ADR 0034 | 决策 5：容器合法性 ⟺ 逐 entry 合法成为规范性承诺；禁止 map 级约束特判；enforcement = 一致性 fixture（逐字节一致）+ 本文档；「数组案 fixture 扩展覆盖 Record/parent 两形态」 | 设计 D6：`issue-440-elementwise-entry-fixture.ts`（117 例 = 107 等价 + 10 触达面，mulberry32(440) 冻结，md5 `ce86199a…` 复核一致）为执法载体；其头注自述「扩展 ADR 0033 数组案 `issue-435-elementwise-array-fixture.ts`」——以同纪律**姊妹文件**履行「数组案 fixture 扩展」，不改 #435 冻结文件（与决策 6「#435 既定范围不动」相容；ADR 冻结的是机制与覆盖面，非文件身份） | **implements-existing-decision** | `docs/adr/0034:43-49`；`packages/vfsl/test/issue-440-elementwise-entry-fixture.ts:1-27`；SA6 §12.1 B-6 | 无 |
| ADR 0034 | 决策 6：实现排序（ADR 0033 链 #435–437 完成后开工）；「复用而非另起平行机制」；#435 既定范围不动 | 排序前提满足：#435 接缝 + #436 doc-runtime 数组 fast path + #437 lease 测试经 `ca0ab53`（PR #434）已入 HEAD 祖先链（`git merge-base` + 源码在场双证）；设计命名族/管线/崩溃边界与 #435 同构（A4 备选显式拒绝两名制，引 ADR 0034 §6）；ALLOW/DENY 钉死 #435 四测试文件不动 | **implements-existing-decision** | `docs/adr/0034:51-55`；`validate-patch.ts:1034-1146`、`mutation-local.ts:312-349`（先例在场）；设计 §7.3 A4、§10 | 无 |
| ADR 0033（accepted） | 决策 5/6 + #435 契约面：数组接缝签名/既有导出冻结；规划层完全不动，只动执行层 | 设计纯加法：`applyElementwiseArrayMutation`/`ArrayCarrierFacts`/`ElementwiseArrayMutationPayload` 零改动（NC5.2）；`planMutationBoundary`/`applyMutationAtBoundary`/`validateSubtree`/`validate.ts` 全部 DENY；既有 23 运行时导出逐字节不变（NC5.1 超集锚） | **no-conflict** | `docs/adr/0033:19-23,45-54`；设计 §7.1、§10 DENY、§11；`git status`（#435 文件零改动）；探针 G1（23 导出普查，`artifacts/sa6-issue440-probe.log:5`） | 无 |
| **ADR 0007 issue #237 修订节（accepted，L62–124）+ ADR 0033 修订注记（L126–140）** | 条款 1「只把该边界投影为局部 logical 值…边界级校验」+ 条款 4(ii)「被提取/重建/校验的边界（…**Record 位、delete 的父 map 位**）内部既存载体/值域非法仍响亮拒绝」+ 条款 7 成本句「Record…边界与 delete 父位按边界规模」——且 0033 注记末句明示这些边界种类「按本节原文逐字保持」 | 设计的目标语义（Record 位/封闭对象 delete 逐 entry 判定、目标键位外污染不再连带拒绝、成本与 n 解耦）对上述字面构成**部分取代**——取代的权威是 ADR 0034 本身（accepted @ HEAD，决策 4 显名修订 ADR-0010 修订节；`CONTEXT.md` 两词条同步更新于同一提交 `0a91f14`）。但 ADR 0007 **未随 ADR 0034 落地平行的「ADR 0034 修订注记」**——而其自身的「ADR 0033 修订注记」（同为 2026-09-22，随数组家族变更集 `ca0ab53` 落地）正是 docs/AGENTS.md「Amend or supersede prior decisions explicitly」义务在本族条款上的既定履行形式。**本票设计/实现不改变任何管线运行时行为**（doc-runtime record/parent 仍走 legacy 全量轨，`mutation-local.ts:266-310` 本票不动），故 #440 落地后代码仍逐字符合 ADR 0007 现行措辞；语料不一致在 #441 接线翻转行为时才成为行为面矛盾 | **evolution-required**（语料层面：需按 0033 注记先例补 ADR 0007 修订注记；非设计缺陷、非本票行为冲突） | `docs/adr/0007:71-81,98-107,121-124,126-140`；`git show 0a91f14 --stat`（仅 CONTEXT.md + ADR 0034 两文件，无 ADR 0007 改动）；`git show ca0ab53 --stat`（0033 家族变更集含 ADR 0007 注记与 CONTEXT.md） | **R1**（§8）：立法路径补「ADR 0034 修订注记」于 ADR 0007（修订计划见 §6）；最迟随 #441 行为翻转变更集落地；不阻塞本票 |
| ADR 0010 issue #237 修订节（accepted，L333–361） | 后备句「导航路径与语义边界内的非法数据…仍会被响亮拒绝；触达面外的非法数据不再被普通写发现」（通用措辞，触达面由各 elementwise ADR 重定义） | ADR 0034 决策 4 以「扩展 ADR-0010 issue #237 修订节」标题点名修订——符合 0033 注记确立的「该节已被其标题点名，无需另行注记」惯例；`CONTEXT.md:201-202` 已收录 Record/parent 两阶段触达面 | **no-conflict** | `docs/adr/0010:343-347`；`docs/adr/0007:139-140`（惯例依据）；`CONTEXT.md:201-202` | 无 |
| `packages/vfsl/AGENTS.md` | 「公共 API 只经 src/index.ts」「同步确定性、畸形输入走判别联合不抛错」「稳定 error code/issue 序/path 报告是兼容行为」「不引入 Yjs 关切」「IR/derived 环境中性」 | 新导出只经 `src/index.ts` 追加（AC5 + ALLOW LIST）；纯函数 + `wrapElementwise` E100 崩溃边界（比 ADR 0016 对 `resolveSchemaAtPath` 的 trusted-domain throw 例外**更保守**，与 `applyMutationAtBoundary`/`applyElementwiseArrayMutation` 家族纪律同款）；既有语义 message 零复制（D2/D4 单源继承，keyPattern 引擎错误族经 `emitPatternError` 原样继承）；`EntryCarrierFacts.has` 由调用方从 `Y.Map.has`/`hasOwn` 读出后传入（vfsl 零 Yjs 引用） | **no-conflict** | `packages/vfsl/AGENTS.md`（Contract/Boundaries 节）；设计 §7.2 D1/D7、§8、§10；源码 `validate.ts:355-379`、`validate-patch.ts:20-33,1039-1146` | 无 |
| 根 `AGENTS.md` + docs/AGENTS.md | 测试纪律（零 skip/only/todo、真实入口发现）；「wiki/raw 是证据非规范」；「改代码行为须同步更新每个契约变化的规范文档」 | 测试/夹具/test-d 全部由 SA6 落位且 md5 冻结，设计零改动（DENY LIST）；本票不产生代码行为变化（纯加法未接线），规范同步义务落在 R1（ADR 0007 注记）与 #441 | **no-conflict**（本票范围内） | 设计 §10 DENY、§12；`git status`（五冻结产物 md5 复核一致） | R1（见上） |
| SA6 契约 §12.1 B-1…B-6（上游工件名目冻结，非决策集） | 绑定点名目/形状/oracle/夹具 | 设计原样采用 `applyElementwiseEntryMutation` / `EntryCarrierFacts` / `ElementwiseEntryMutationPayload` / 闸门与返回 / oracle / 夹具（A4 显式拒绝两名制）——不触发契约重绑 | **no-conflict**（工件纪律面） | 设计 §7.2 D1、§7.3 A4；SA6 §12.1/§15.1 | 无 |

**对照小结**：10 行对照中 9 行为 no-conflict / implements-existing-decision；1 行（ADR 0007 修订节字面）为语料层 evolution-required——其修订权威（ADR 0034）已合法存在并合入，缺口仅是 ADR 0007 文件内平行注记未按 0033 先例落款，且在本票范围内无行为面影响。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|

**无**。合法 override 的四个来源逐一核验：(i) Owner 评论——REST Issue #440 comments = `[]`（简报 + SA6 §2 双源），无；(ii) 新 ADR 修订/废弃旧 ADR——设计不提议任何 ADR 变更（DENY LIST 含 `docs/adr/**`）；ADR 0034 对 ADR 0007/0010 措辞的部分取代是 HEAD 已合入的正式修订（非本设计新造 override），其履行缺口见 §3 行 8/§6；(iii) 正式协议版本升级——无（`docs/protocols/instance-replication-v1.md` 零涉及）；(iv) 决策文本自允演进条款——未援引。实现方便、测试通过、已有代码、SA6 同意均不构成 override——设计也未以此类理由豁免任何决策。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（设计承诺） |
|---|---|---|---|
| `@nomicore/vfsl` 既有 23 个运行时导出 | 名单与行为逐字节不变（纯加法超集） | 探针 G1（`artifacts/sa6-issue440-probe.log:5`）；`index.ts:132-147` | 保持（NC5.1 锚定；§7.1「纯加法」） |
| #435 数组接缝签名面 | `applyElementwiseArrayMutation` / `ArrayCarrierFacts` / `ElementwiseArrayMutationPayload` 不动 | `validate-patch.ts:1044-1084`；ADR 0033 | 保持（DENY LIST + NC5.2） |
| vfsl 判定内核与解释器 | `planMutationBoundary` / `applyMutationAtBoundary` / `validateSubtree` / `validate.ts`（含 `validateObject` 两形态、`validateKeyPattern`、`emitPatternError`）零改动 | `validate-patch.ts:739-822,926-1022`；`validate.ts:640-694,369-379` | 保持（DENY LIST；D2/D4 只消费不修改） |
| 兼容行为 message/path/序 | `delete 目标键不存在（拒绝 no-op）`、`缺少必填字段 "${name}"`、`Record 键 "…" 不满足 Pattern 正则 /…/` 及 Pattern 引擎错误族、issue rebase 形态 `[...prefix, key, ...值内]`、键先值后全收集序 | `packages/vfsl/AGENTS.md`（兼容行为条款）；`validate.ts:355-379,663-665,674-681`；`validate-patch.ts:973-974,1015-1022` | 保持（单源继承零复制；契约 B/C/D 组 + 负控 NC1 常量锚） |
| SA6 冻结产物（5 件） | contract/control/fixture/test-d/probe md5 恒同 | 本次 md5 复核：`a595c8ae…`/`46829054…`/`ce86199a…`/`0fe31a97…`/`0b598041…` 与 SA6 §16 登记全部一致 | 保持（DENY LIST） |
| wire / 协议 / 诊断 / 持久化 | 复制协议、诊断捕获、写槽零改动（ADR 0034 状态行） | ADR 0034:4；设计 §8.3「零存储、零传输、零网络、零时钟」 | 保持 |
| doc-runtime / namespace-runtime | 本票零改动（#441/#442 既定范围） | `mutation-local.ts:266-310`（legacy 轨不动）；设计 §10 DENY、§11 | 保持 |
| 规范文档面 | `docs/adr/**`、`CONTEXT.md`、`docs/vfsl/**` 本票零改动 | 设计 §10 DENY；ADR 0034/CONTEXT 已随 `0a91f14` 立法 | 保持（R1 属立法路径的独立 doc 提交，非本票实现改动） |

## 6. Evolution requirements

**唯一 evolution 项 = §3 行 8（ADR 0007 修订注记缺口）。修订计划完备性检查**：

| 要素 | 内容 |
|---|---|
| 修订文件 | `docs/adr/0007-logical-validation-and-yjs-runtime-bridge.md`——在「ADR 0033 修订注记」（L126-140）之后追加「ADR 0034 修订注记」，授权链引 ADR 0034（accepted）+ docs/AGENTS.md 修订义务句 + 本节 0033 先例 |
| 新旧语义 | 旧：条款 1 的 Record 位/delete 父位「边界投影 + 边界级整体校验」、条款 4(ii)「Record 位、delete 的父 map 位内部既存非法仍响亮拒绝」、条款 7「按边界规模」成本句。新（自 ADR 0034 起，就**非 union Record 位与封闭对象 delete**）：逐 entry 校验（Record set = 键 Pattern + 新值、delete = O(1) 在场判定；封闭对象 delete = 必填性静态判定）、触达面收窄为「map/父载体 + 目标键位」、成本 O(新值)/O(1)。保持不变：union 穿越位、union 容器目标、set 目标位（R6 整值替换）、载体形态违规条款 4(i)、零写入/E201 分类条款 5、行为等价测试硬前置条款 6 |
| 兼容与迁移 | 纯文档修订，零运行时/零 wire/零 schema 迁移；CONTEXT.md 两词条已先行（`0a91f14`），注记仅补齐 ADR 0007 文件内落款 |
| 失败语义 | 不变（本修订不触失败语义；fast-path 失败面语义已由 ADR 0033/0034 决策承载） |
| 版本 | 无版本面（ADR 文档修订注记，非协议版本） |
| 验证 | `git diff --check` + 链接/文件名核验（docs/AGENTS.md「Verification」）；无代码检查需要 |
| 冻结面 | 上表全部冻结面零变化 |

**裁决**：修订计划完整（上表逐要素给出）、修订权威已合法存在（ADR 0034 accepted）、修订动作是 doc-only 且归属立法路径（SA1/SA3/SA8 均无权改 ADR——设计 DENY LIST 正确地将规范面排除在本票外）。**该缺口不阻塞本票**：#440 落地后管线行为仍逐字符合 ADR 0007 现行措辞（接缝未被接线），语义面由 ADR 0034 + CONTEXT.md 现行文本合法承载。**硬性时点**：最迟随 #441（行为翻转变更集）落地——届时若无此注记，运行时行为将与 ADR 0007 未修订字面直接矛盾，构成实现期冲突。

## 7. Hard conflicts

**无**。逐项排查：设计不触碰任何 ADR 冻结面（§5）；不与任何 accepted 决策不兼容——唯一字面重叠（ADR 0007 修订节）已被 ADR 0034 正式修订且 CONTEXT.md 同步，缺的只是 ADR 0007 文件内注记（§6）；无未授权 override（§4）；不实现 ADR 0034「不做什么」明令禁止的项（map 级约束、union map 位接管、封闭对象 set、异步审计——设计 §1 非目标逐条对齐）；不违反 ADR 0033/0034 排序（#435–437 已在 HEAD）。

## 8. Required actions

1. **R1（立法路径 / Owner，doc-only，最迟随 #441）**：按 §6 修订计划在 ADR 0007 追加「ADR 0034 修订注记」。不阻塞 #440；实现期复查（implementation 阶段 SA8）须核对其在 #441 行为翻转前已落地。
2. **R2（实现，#440）**：按设计 §10 ALLOW/DENY 执行——仅 `validate-patch.ts` #440 节 + `index.ts` 三行导出 + 证据日志；五件 SA6 冻结产物 md5 恒同；既有 23 导出与 #435 签名面逐字节不变。
3. **R3（Controller 绿判据路由）**：采纳设计 §13 残余 1 的口径——探针 G1.1/G1.2 实现后翻红是缺口正向闭合的预期结果，权威绿判据 = 契约 26/26 + 负控 19/19 + test-d 转绿 + 根 `pnpm typecheck`/`pnpm test`（SA6 §13）；不修改冻结探针文件。
4. **R4（实现期 SA8 复查清单）**：公共新增与 B-1…B-3 名目逐字一致；兼容 message/path 零漂移（负控 NC1）；R1 已落地（#441 前）。

## 9. Verdict

**clear**

- 全部对照项为 no-conflict 或 implements-existing-decision（§3 行 1–7、9–10）；
- 唯一 evolution-required（§3 行 8）已有完整修订计划（§6）并标记后续复查（§8 R1/R4 + §10）——其修订权威（ADR 0034）已合法合入，缺口为语料落款完备性，非设计缺陷、非本票行为冲突、无 hard-conflict；
- 设计证据链充分：§2 事实锚点 C1–C10 经本次源码/git/探针日志逐条复核无矛盾；设计忠实实现 ADR 0034 决策 1/2/4/5（3/6 按 Blocked-by 链归 #441/#442，与 ADR 排序一致），纯加法、零冻结面触碰、零未授权 override。

## 10. requiresConflictRecheck

**true**。理由（技能规则：公共 API 尚待实现核对时为 true）：

1. `@nomicore/vfsl` 公共面新增 1 运行时导出 + 2 类型导出——实现期须核对与 B-1…B-3 名目/形状逐字一致、纯加法不扰既有 23 导出（§5 冻结面逐项核对属 implementation 复查职责）；
2. 兼容行为面（message/path/序，包纪律明文兼容条款）依赖实现期负控/契约全绿核验；
3. R1（ADR 0007 修订注记）须在 #441 行为翻转前核验落地——跨票追踪项。

---

*SA8 只读复查：未修改任何被审对象、决策文档、代码或测试；未运行测试；未派发其他 SA。本报告为 #440 唯一新增文件。*
