# SA8 实现后冲突复查报告 — issue #440：vfsl 逐 entry 校验扩展（Record + 封闭对象 delete）与一致性 fixture 扩展（ADR 0034）

- 角色：SA8（Conflict Gatekeeper）｜phase：implementation 复查（实现后复审）｜iteration 0
- 被审对象：SA3 实现（工作区未提交 diff：`packages/vfsl/src/validate-patch.ts` +143 行、`packages/vfsl/src/index.ts` +8 行，共 151 insertions / 0 deletions）+ `wiki/raw/task_issue-440_sa3_impl.md`（SA3 实现报告）
- 复查触发：设计 §15 与 `task_issue-440_design_conflict_report.md` §10 均标记 `requiresConflictRecheck: true`（公共 API 加法 + 兼容行为面 + R1 跨票追踪），且实际 diff 触碰公共 API 冻结面（加法式）——符合技能「design 要求复查」触发条件
- 复查基准：ADR 全集（34 篇，状态逐一核阅：0001–0030、0032–0034 均 accepted；0015「提议」不构成约束；无 superseded）+ `CONTEXT.md` + `docs/vfsl/v1-spec.md` + `packages/vfsl/AGENTS.md` 明示收录的决策
- worktree：`mabf/issue-440` @ HEAD `0a91f14`（与设计/SA6/SA2/前份 SA8 报告同一 HEAD；实现为未提交工作区改动）
- 上游工件：SA4/SA9 的 #440 工件不存在（`wiki/raw/` 仅 7 件 #440 文件）——本复查不依赖其结论，全部独立核验

---

## 1. Reviewed subject

**implementation**（SA3 语义代码变更后的实际 diff + 其自述报告）。逐行核对 `git diff`（仅 2 个生产文件、纯加法）与决策集；不判断实现质量/测试充分性（SA4/SA7 职责）、不判断设计优劣（SA2 已 approve）、不改任何被审对象或决策文档、不运行测试（证据以 SA3 落位日志 + 冻结断言绿面为凭）。

## 2. Inputs and decision set

| 输入 | 角色 | 核验方式 |
|---|---|---|
| `wiki/raw/task_issue-440.md` | 任务简报 | 实读；REST Issue comments 为空（简报 §Comments + 派发指令双源）——无 owner 需求面、无 override 授权面 |
| `wiki/raw/task_issue-440_design.md` | 设计（SA2 approve） | 实读；§7.2 D1–D7、§8.1 管线、§10 ALLOW/DENY 为实现对照基线 |
| `wiki/raw/task_issue-440_sa2_review.md` | SA2 评审 | 实读；verdict approve、3 MINOR（探针翻红口径/文案复用/闸门文案），SA3 落实情况见 §3 行 10 注 |
| `wiki/raw/task_issue-440_sa3_impl.md` | 被审对象自述 | 实读；其「Changed paths / DENY 核对 / Verification」各表逐项对实际 diff 与日志复核 |
| `wiki/raw/task_issue-440_sa6_contract.md` | 上游固定工件 | 实读；§12.1 B-1…B-6 名目冻结（L272-275）、§16 md5 登记（L390）逐项比对 |
| `wiki/raw/task_issue-440_sa6_capability_probe.mts` + `artifacts/sa6-issue440-probe.log` / `artifacts/sa3-issue440-probe-post.log` | 探针与前后证据 | md5 复核（`0b598041…` 与 §16 一致）；post 日志实读（25/27 ok，唯 G1.1/G1.2 红 = 缺口正向闭合预期，NC2.2 既有 23 导出超集仍绿） |
| `docs/adr/**`（34 篇） | 决策集 | 状态行逐一提取（同前份设计报告口径，本次抽验未发现状态漂移）；0034/0033/0007/0010 全文实读 |
| `docs/adr/0034-record-and-parent-elementwise-validation.md` | **母法**（accepted @ HEAD `0a91f14`） | 决策 1–6 + 不做什么 + 后果逐条对照（§3 行 1–6） |
| `docs/adr/0033-elementwise-yarray-mutation-validation.md` | 同族先例（accepted） | 决策 1–6 对照（§3 行 7）；#435 实现节（`validate-patch.ts:1039-1146`）零 diff 核验 |
| `docs/adr/0007-…md` issue #237 修订节（L62-124）+ ADR 0033 修订注记（L126-140） | mutation 管线既有契约 | 全文实读；**确认无「ADR 0034 修订注记」**——R1 仍属未落地（§6） |
| `docs/adr/0010-…md` issue #237 修订节 | 触达面后备句 | 惯例核验（该节已被 ADR 0034 决策 4 标题点名） |
| `CONTEXT.md` | 共享词汇（根权威） | 「重建校验」L143-144、「复制未校验」L201-202 实读——ADR 0034 两阶段立法已在 HEAD 词汇面落地，本票零改动 |
| `docs/vfsl/v1-spec.md` | 语言规范（包 AGENTS 点名 normative） | grep 核验：不枚举 vfsl 公共 API（`applyMutationAtBoundary`/`applyElementwiseArrayMutation` 均无提及）——新增接缝不产生规范同步义务；语言语义零变化 |
| `packages/vfsl/AGENTS.md` | 模块契约 | 实读；公共 API 只经 `src/index.ts`、同步/纯函数/畸形输入走判别联合、稳定 message/序/path 兼容行为、零 Yjs |
| 实际 diff + 源码事实 | 被审对象本体 | `git diff` 逐行；`validate-patch.ts`（#435 节 L1039-1146、新 #440 节 L1150-1289、legacy 边界 L929-1025）、`validate.ts`（L130-149 透镜/resolveValues、L640-696 两形态、L768 validateSubtree）、`resolve.ts:87`（walkRefChain 签名）、`index.ts` 全文导出面 |
| 证据日志 | 验证凭据 | `artifacts/sa3-issue440-{focused,vfsl-typecheck,root-typecheck,root-test,probe-post}.log` 实读：45/45（契约 26 + 负控 19）+ Type Errors no errors + `FOCUSED_EXIT:0`；`VFSL_TSC_EXIT:0`；`ROOT_TYPECHECK_EXIT:0`（15 包链）；根 test 469 files / 5712 tests / `ROOT_TEST_EXIT:0`；探针 post `PROBE_EXIT:1`（25/27，唯 G1.1/G1.2） |
| `git status` / `git log` | 冻结面与链序 | 仅 2 个生产文件 M + SA6/SA3 工件 untracked；HEAD 祖先链含 `ca0ab53`（PR #434，ADR 0033 家族 #435–437）——排序前提成立 |

**决策集界定**：与设计报告同口径——代码与 wiki 工件是证据不是规范契约；SA6 B-1…B-6 是上游工件名目冻结（工件纪律面，单列 §3 行 11）。

## 3. Decision analysis

| Decision | Clause | Subject behavior（实际 diff） | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| ADR 0034（accepted @ HEAD） | 决策 1：Record set/delete 逐 entry fast path；闸门 = 非 union Record 形态；union map 位永久 legacy；值位 union 不排除；旧值不读；域规则不变；issue 路径 `[...mapPath, key]` 逐字节兼容 | 新节 `applyElementwiseEntryMutation`（`validate-patch.ts:1220-1289`）：闸门 ① kind∈{record,parent} ∧ relPath 单段 string ∧ node.kind=object ∧ `<key>` 槽↔kind 一致（`plan.kind` 词表 `'union'\|'record'\|'array'\|'parent'\|'target'`，L727——union/target/array 全部 fail closed 拒入）；set 支单 entry 合成视图 `{[key]: value}` 过 `validateSubtree`（`facts.has` 不参与判决——旧值不读；值位 union 经 `<key>` 槽整体过解释器，不排除）；delete 支仅在场/no-op 域规则；rebase `[...plan.prefix, ...issue.path]` 与 legacy `validateBoundary`（`:1023`）同式 | **implements-existing-decision** | `docs/adr/0034:16-22`；`validate-patch.ts:1220-1289`（diff 实读）；`validate.ts:655-667`（Record 形态纯逐键）；契约 26/26 + 负控 19/19 绿（`artifacts/sa3-issue440-focused.log`，`FOCUSED_EXIT:0`） | 无 |
| ADR 0034 | 决策 2：封闭对象 delete 静态必填判定（必填 ∧ 非 unknown 标量 → 拒；optional ∨ unknown → 允；`has` 拒 no-op；不读父值） | `judgeClosedObjectDelete`（`validate-patch.ts:1178-1195`）：声明表查名 → 未找到 fail closed（手造计划）；`optional` 包装先查 → ok；`walkRefChain(field.value, valueLens(derived.values))` 解 ref → `scalar ∧ unknown` → ok；否则 `缺少必填字段 "${key}"` @ `[...prefix, key]`。次序/语义镜像 `validate.ts:672-681`；`valueLens`（`validate-patch.ts:81-87`）与 `validate.ts` 侧（L137-145）同算法同报错文案；`walkRefChain` memo 参数可选（`resolve.ts:87`）——省略仅失性能 memo，语义恒同；`facts.has` = `Y.Map.has`/`Object.hasOwn` 同义（与 legacy delete 支 `Object.hasOwn`（`:976`）同一判定基准，非 `present()`） | **implements-existing-decision** | `docs/adr/0034:24-31`；`validate-patch.ts:1170-1195,1268-1273`；`validate.ts:670-682`；契约 D 组绿 | 无 |
| ADR 0034 | 决策 3：fast-path 返回 `ValidateResult` 直出（无 `proposedBoundary`） | 签名返回 `ValidateResult`；ok 支恰 `{ ok: true }`；无 `result` 包装（diff 实读；test-d 类型红转绿 + 契约 A2 双锚） | **implements-existing-decision** | `docs/adr/0034:33-35`；`validate-patch.ts:1226-1229`（签名）；`artifacts/sa3-issue440-focused.log` Type Errors no errors | 无（#441 接线时再核 S9 面） |
| ADR 0034 | 决策 4：触达面 = map/父载体 + 目标键位 | 接缝输入面恰 `{has}`（`EntryCarrierFacts`），结构上不携带其他 entry/父值；doc-runtime 零接线（`git status` 无 `mutation-local.ts` 条目）——管线行为未翻转 | **implements-existing-decision** | `docs/adr/0034:37-41`；`CONTEXT.md:201-202`；diff 输入面；fixture 触达面组 10/10 绿（E2/E3，契约证据） | 无（端到端钉正归 #442） |
| ADR 0034 | 决策 5：容器合法性 ⟺ 逐 entry 合法；禁止 map 级约束特判；enforcement = 一致性 fixture | 冻结夹具 `issue-440-elementwise-entry-fixture.ts`（117 例）md5 实现前后恒同（§5 行 5）；契约 E1（107/107 逐字节一致）/E2/E3 绿 = 执法兑现；实现零 map 级约束特判（判定全部经 `validateSubtree` 单 entry 视图或静态字段表） | **implements-existing-decision** | `docs/adr/0034:43-49`；`packages/vfsl/test/issue-440-elementwise-entry-fixture.ts`（md5 `ce86199a…`）；`artifacts/sa3-issue440-focused.log` | 无 |
| ADR 0034 | 决策 6：排序（#435–437 后开工）；「复用而非另起平行机制」；#435 既定范围不动 | 排序满足（HEAD 祖先链含 `ca0ab53`/PR #434）；新节与 #435 节同构（闸门→事实守卫→载荷守卫→域规则→`validateSubtree`→`wrapElementwise` E100；命名族 `EntryCarrierFacts`/`ElementwiseEntryMutationPayload` 对 `ArrayCarrierFacts`/`ElementwiseArrayMutationPayload`）；复用既有私有助手 `singleIssue`（`:1063`）/`wrapElementwise`（`:1142`）/`valueLens`（`:81`）/`walkRefChain` import（`:39`）——零新平行机制；#435 节 L1039-1146 与四测试文件零 diff | **implements-existing-decision** | `docs/adr/0034:51-55`；`validate-patch.ts:1039-1146`（零 diff）；`git log`（`ca0ab53` 在祖先链） | 无 |
| ADR 0033（accepted） | 决策 5/6 + #435 契约面：数组接缝签名/既有导出冻结；规划层完全不动，只动执行层 | `applyElementwiseArrayMutation`/`ArrayCarrierFacts`/`ElementwiseArrayMutationPayload` 零改动；`planMutationBoundary`/`applyMutationAtBoundary`/`validateSubtree`/`validate.ts`/`derived.ts`/`resolve.ts`/`pattern.ts` 全部零 diff（`git status` 仅 2 文件 M）；负控 NC5 锚绿 | **no-conflict** | `docs/adr/0033:19-23,45-54`；`git diff --stat`（2 files, +151/-0）；探针 post NC2.1/NC2.2 绿 | 无 |
| **ADR 0007 issue #237 修订节（L62-124）+ ADR 0033 修订注记（L126-140）** | 条款 1「只把该边界投影为局部 logical 值…边界级校验」+ 条款 4(ii)「Record 位、delete 的父 map 位内部既存非法仍响亮拒绝」+ 条款 7「Record…边界与 delete 父位按边界规模」成本句；0033 注记明示这些边界种类「按本节原文逐字保持」 | **实现未接线**：doc-runtime `mutation-local.ts` record/parent 分支零改动，管线运行时行为逐字符合 ADR 0007 现行措辞——本票落地不产生行为面矛盾；但 ADR 0007 文件内**仍无「ADR 0034 修订注记」**（本次全文实读确认，L126-140 止于 0033 注记）——R1 语料缺口原样延续，未被实现扩大也未被闭合 | **evolution-required**（语料层，承接设计报告 §3 行 8；修订计划完备性见 §6） | `docs/adr/0007:71-81,98-107,121-124,126-140`（本次实读：无 0034 注记）；`git status`（`packages/doc-runtime/**` 零条目）；`git show 0a91f14 --stat`（仅 CONTEXT.md + ADR 0034） | **R1**（§8）：立法路径补 ADR 0007「ADR 0034 修订注记」；硬性时点 = #441 行为翻转变更集落地前；不阻塞本票 |
| ADR 0010 issue #237 修订节（accepted） | 后备句「导航路径与语义边界内的非法数据…仍会被响亮拒绝；触达面外的非法数据不再被普通写发现」（通用措辞） | ADR 0034 决策 4 以标题点名修订该节——符合 0033 注记确立惯例，无需另行注记；`CONTEXT.md:201-202` 已收录两阶段触达面 | **no-conflict** | `docs/adr/0010:343-347`；`docs/adr/0007:139-140`（惯例依据） | 无 |
| `packages/vfsl/AGENTS.md` | 「公共 API 只经 src/index.ts」「同步确定性、畸形输入走判别联合不抛错」「稳定 error code/issue 序/path 报告是兼容行为」「不引入 Yjs 关切」 | 新增 1 值导出 + 2 类型导出全经 `src/index.ts` 既有 `validate-patch.js` 导出块追加（diff 实读，无第二公共面）；纯函数 + `wrapElementwise` E100 崩溃边界；兼容 message 零复制单源继承（§5 行 4）；零 Yjs 引用（`{has}` 由调用方读出传入）。**实现自决细节核验**：facts/payload 经敌意通道语义读取（`(facts as {has?:unknown}\|null\|undefined)?.has` 等）——畸形 `{}`/`null` facts 与 array-* 载荷走守卫 ②③ 响亮拒绝而非 E100，与「畸形输入走判别联合」纪律**更对齐**，判决形状与设计 §8.1 ②③（`ok:false` ∧ 带 issue ∧ 不抛）完全相容；冻结断言未覆盖该形状，无契约影响。SA2 MINOR 2（可选常量提取）未采纳：理由成立（行为中性重构会在负控锚定的 legacy 轨上扩 diff），双锚（NC1.3/NC1.4 + E1 逐字节）仍绿 | **no-conflict** | `packages/vfsl/AGENTS.md`（Contract/Boundaries 节）；diff（index.ts/validate-patch.ts 实读）；`artifacts/sa3-issue440-focused.log`（19/19 负控绿） | 无 |
| 根 `AGENTS.md` + `docs/AGENTS.md` | 测试纪律；「wiki/raw 是证据非规范」；「改代码行为须同步更新每个契约变化的规范文档」 | 测试/夹具/test-d 五件 md5 恒同（§5 行 5）；本票新增公共 API 而**未改变任何管线代码行为**（未接线）——语义规范的载体（ADR 0034 + CONTEXT.md 两词条）已随 HEAD `0a91f14` 同变更集立法完毕；v1-spec 不枚举公共 API（grep 核验），无未履行的规范同步义务；唯一残留语料项 = R1（立法路径） | **no-conflict**（本票范围内） | `git show 0a91f14 --stat`；`docs/vfsl/v1-spec.md` grep（无 API 枚举）；设计报告 §6 同口径 | R1（见上） |
| SA6 契约 §12.1 B-1…B-6（上游工件名目冻结，非决策集） | 绑定点名目/形状/oracle/夹具 | 实现与 B-1…B-4 逐字一致：`applyElementwiseEntryMutation(derived, plan, facts, payload)`（唯一新增运行时导出）/ `EntryCarrierFacts = { readonly has: boolean }` / `ElementwiseEntryMutationPayload = { op:'set'; value: unknown } \| { op:'delete' }` / 闸门与返回 `ValidateResult` 直出；五件冻结产物 md5 恒同——不触发契约重绑 | **no-conflict**（工件纪律面） | `wiki/raw/task_issue-440_sa6_contract.md:272-275`；`validate-patch.ts:1155-1229`；§5 行 5 md5 表 | 无 |

**对照小结**：12 行对照中 11 行为 no-conflict（5）/ implements-existing-decision（6）；1 行（ADR 0007 修订节语料）为承接的 evolution-required——实现既未扩大也未闭合该缺口（未接线 ⇒ 无行为面矛盾；注记属立法路径）。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|

**无**。四个合法来源逐一核验：(i) Owner 评论——REST Issue #440 comments = `[]`（简报 + 派发指令双源），无；(ii) 新 ADR 修订/废弃——实现零 ADR 改动（`git status` 无 `docs/adr/**` 条目），ADR 0034 对 ADR 0007/0010 的部分取代是 HEAD 已合入的正式修订，非本实现新造 override；(iii) 协议版本升级——无涉及；(iv) 决策文本自允演进——未援引。SA3 未以「实现方便/测试通过/SA6 同意」豁免任何决策；其唯一自决细节（敌意通道读取）落在设计 §8.1 守卫语义范围内，不构成对任何决策条款的豁免。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（实际 diff 核对） |
|---|---|---|---|
| `@nomicore/vfsl` 既有 23 个运行时导出 | 名单与行为逐字节不变（纯加法超集） | 探针 post NC2.2（23 超集绿，`artifacts/sa3-issue440-probe-post.log`）；静态计数：`export {}` 再导出 16 + index.ts 直定义 7 = 23 → +1 = 24 | **保持**——diff 对既有导出零触碰（纯追加 3 名）；负控 NC5.1 绿 |
| #435 数组接缝签名面 | `applyElementwiseArrayMutation` / `ArrayCarrierFacts` / `ElementwiseArrayMutationPayload` 不动 | `validate-patch.ts:1039-1146` | **保持**——新节自 L1150 起，#435 节零 diff；NC5.2 绿 |
| vfsl 判定内核与解释器 | `planMutationBoundary` / `applyMutationAtBoundary` / `validateSubtree` / `validate.ts` / `derived.ts` / `resolve.ts` / `pattern.ts` 零改动 | `git status`（仅 `index.ts` + `validate-patch.ts` 两文件 M） | **保持**——`git diff --stat` = 2 files, +151/-0；新节只消费（`validateSubtree` import `:41`、`walkRefChain` import `:39`）不修改 |
| 兼容行为 message/path/序 | `delete 目标键不存在（拒绝 no-op）`、`缺少必填字段 "${name}"`、Record 键 Pattern 消息族、rebase 形态 `[...prefix, key, ...值内]`、键先值后全收集序 | `packages/vfsl/AGENTS.md`（兼容行为条款） | **保持**——逐字比对：no-op 文案 `validate-patch.ts:977` ↔ `:1272`/`:1277` 逐字节同；必填文案 `validate.ts:680` ↔ `validate-patch.ts:1194` 逐字节同（路径同为 `[...prefix, key]`：legacy 经 `issueAt(..., plan.relPath)` = `[...prefix, ...relPath]`）；set 支 issue 经 `validateSubtree` 单源（`validate.ts:655-667`：键 issue L663 先于值 issue L665）+ rebase 与 `validateBoundary:1023` 同式；负控 NC1 19/19 绿 + E1 107/107 逐字节一致 |
| SA6 冻结产物（5 件） | contract/control/fixture/test-d/probe md5 恒同 | SA6 §16（`task_issue-440_sa6_contract.md:390`） | **保持**——本次复算：`ce86199a85f7787dcca529a87ff72408` / `a595c8ae4a2bd02cfcd1ed95375c514b` / `46829054dc02ff6e9d1f2b760b84bea6` / `0fe31a97f9207ef183b4e5a04305b9d9` / `0b5980411662eab9b8964f0f1283ad33` 与登记 5/5 一致 |
| wire / 协议 / 诊断 / 持久化 | 复制协议、诊断捕获、写槽零改动（ADR 0034 状态行） | ADR 0034:4 | **保持**——diff 不含 `packages/ws-replication`、`docs/protocols/**`、诊断面、持久面任何条目 |
| doc-runtime / namespace-runtime | 本票零改动（#441/#442 既定范围） | 设计 §10 DENY、§11 | **保持**——`git status` 无 `packages/doc-runtime/**`、`packages/namespace-runtime/**` 条目 |
| 规范文档面 | `docs/adr/**`、`CONTEXT.md`、`docs/vfsl/**` 本票零改动 | 设计 §10 DENY | **保持**——`git status` 无上述条目（R1 属立法路径独立 doc 提交，非本票实现改动；见 §6） |
| 闸门 message①–⑥ | 非冻结面（SA6 §15.3 明示；仅钉 `ok:false ∧ issues.length>0 ∧ 不抛`） | SA6 §15.3；设计 §8.1 建议文案 | 实现原样采用设计建议文案（F1–F3 绿）——新面文案，无既有契约面 |

## 6. Evolution requirements

**唯一 evolution 项 = §3 行 8（R1：ADR 0007「ADR 0034 修订注记」缺席）——自设计报告原样承接，修订计划不变且仍完整**：

| 要素 | 内容（与设计报告 §6 同一计划，本次复核未变） |
|---|---|
| 修订文件 | `docs/adr/0007-logical-validation-and-yjs-runtime-bridge.md`——在「ADR 0033 修订注记」（L126-140）之后追加「ADR 0034 修订注记」 |
| 新旧语义 | 旧：条款 1 Record 位/delete 父位「边界投影 + 边界级整体校验」、条款 4(ii) 连带拒绝、条款 7 按边界规模。新（自 ADR 0034 起，非 union Record 位与封闭对象 delete）：逐 entry 校验、触达面 = 载体 + 目标键位、O(新值)/O(1)。保持不变：union 穿越位、union 容器目标、set 目标位、条款 4(i)、条款 5、条款 6 |
| 兼容与迁移 | 纯文档修订，零运行时/零 wire/零 schema 迁移；CONTEXT.md 两词条已先行（`0a91f14`） |
| 失败语义 | 不变 |
| 版本 | 无版本面 |
| 验证 | `git diff --check` + 链接核验（docs/AGENTS.md Verification） |
| 冻结面 | §5 全部冻结面零变化 |

**实现期核对结论（技能要求的三项）**：

1. **文档与代码是否同变更集**：本票代码**未翻转任何管线行为**（接缝未接线），故无「代码先行、文档滞后」的行为面不一致；新语义的规范载体（ADR 0034 + CONTEXT.md 两词条）已在 HEAD `0a91f14` 先于代码合入——次序合法。R1 是 ADR 0007 文件内的平行落款义务，doc-only，归属立法路径（SA3/SA8 均无权改 ADR；设计 DENY LIST 正确排除）。
2. **语义是否一致**：接缝判定语义与 ADR 0034 决策 1/2/4/5 逐条一致（§3 行 1–5）；未接线 ⇒ ADR 0007 现行措辞在运行时仍逐字为真。
3. **override 是否扩大 / 旧引用是否更新**：无 override（§4）；无旧引用需更新（v1-spec 不枚举公共 API；CONTEXT.md 词条已是新语义）。

**硬性时点（不变）**：最迟随 #441（doc-runtime 接线的行为翻转变更集）落地——届时若注记仍缺席，运行时行为将与 ADR 0007 未修订字面直接矛盾，构成 #441 的实现期冲突。

## 7. Hard conflicts

**无**。逐项排查：实际 diff 严格落于设计 §10 ALLOW LIST（2 生产文件 + 证据日志 + 角色产物），零 DENY 面触碰（§5 逐行核对）；与全部 accepted 决策兼容（§3）；无未授权 override（§4）；未实现 ADR 0034「不做什么」禁止项（union map 位接管被闸门 ① fail closed 拒绝、map 级约束零特判、封闭对象 set 被闸门 ⑥ 拒绝、无异步审计）；ADR 0033/0034 排序满足；唯一字面重叠（ADR 0007 修订节）已有合法修订权威（ADR 0034 accepted）且本票无行为面影响（§6）。

## 8. Required actions

1. **R1（立法路径 / Owner，doc-only，硬性时点 = #441 行为翻转前）**：按 §6 计划在 ADR 0007 追加「ADR 0034 修订注记」。本次复核确认其**尚未落地**（ADR 0007 全文实读，修订注记止于 0033）——不阻塞 #440（未接线、无行为矛盾），但必须在 #441 接线变更集合入前完成；#441 的前置门禁须核验。
2. **R2（已闭合，备案）**：设计报告 R2 的实现期义务全部兑现——ALLOW/DENY 逐项核对通过（§5）、五件冻结产物 md5 恒同、既有 23 导出与 #435 签名面逐字节不变、B-1…B-4 名目逐字一致。
3. **R3（已闭合，备案）**：设计报告 R4 实现期复查清单三项——公共新增名目 ✓（§3 行 11）、兼容 message/path 零漂移 ✓（§5 行 4，负控 NC1 + E1 双锚绿）、R1 落地核验 → 转为 R1 跨票追踪（本报告 §8 行 1）。
4. **R4（Controller，#441 派发时）**：#441 前置门禁须同时核验 (a) R1 已落地；(b) 接线闸门与接缝契约（B-1…B-4）一致——分流模板同 `case 'array'`（#436）先例；(c) S9/E201/charge 收窄与 ADR 0034 决策 3 一致。探针 G1 翻红口径（设计报告 R3）已由 SA3 落实留档（`artifacts/sa3-issue440-probe-post.log`：25/27 ok，唯 G1.1/G1.2 = 缺口正向闭合预期），无需再行动。

## 9. Verdict

**clear**

- 全部对照项为 no-conflict 或 implements-existing-decision（§3 行 1–7、9–12）；
- 唯一 evolution-required（§3 行 8 / R1）的修订计划完整（§6）且修订权威（ADR 0034 accepted @ HEAD）合法合入——实现未扩大该缺口（零接线 ⇒ ADR 0007 现行措辞在运行时仍逐字为真），缺口为语料落款完备性，硬性时点在 #441；
- 实现证据链充分：diff 纯加法且逐行落于设计 ALLOW LIST；五件 SA6 冻结产物 md5 与 §16 登记 5/5 一致；兼容面 message/path 逐字节单源继承（源码级逐字比对 + 负控 NC1 19/19 + E1 107/107）；契约 26/26、负控 19/19、test-d 转绿、包 tsc / 根 typecheck / 根 test（469 files / 5712 tests）全绿（SA3 证据日志实读）；探针 post 仅 G1.1/G1.2 翻红（= 立法口径内的缺口正向闭合）。

## 10. requiresConflictRecheck

**true**（范围收窄后的跨票追踪，非 #440 自身未闭合项）：

1. **#440 自身面已闭合**：公共 API 加法（B-1…B-4 名目/形状）、兼容行为面（message/path/序）、冻结面（§5 全表）均经本次实现复查逐项核对完毕；
2. **保留 true 的唯一理由 = R1（evolution-required）尚未落地**：技能规则「evolution-required 计划完整时可以 clear，但必须 requiresConflictRecheck: true」——ADR 0007「ADR 0034 修订注记」须在 #441 行为翻转前核验落地，属跨票追踪项（§8 R1/R4）；#441 接线本身还将触碰管线失败语义（S9/E201/charge）与公共消费面，届时按标准流程另行门禁。

---

*SA8 只读复查：未修改任何被审对象、决策文档、代码或测试；未运行测试；未派发其他 SA。本报告为 #440 本次新增的唯一文件（`wiki/raw/task_issue-440_implementation_conflict_report.md`）。*
