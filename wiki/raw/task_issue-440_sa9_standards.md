# SA9 标准审查 — issue #440：vfsl 逐 entry 校验扩展（Record + 封闭对象 delete）与一致性 fixture 扩展（ADR 0034）

- 角色：SA9（独立 Standards 审查者）｜phase：standards-review｜iteration 0｜2026-09-22
- 被审对象：**最终已提交交付 diff** `0a91f1429c3818320eaacdf2a33d2a267d79620e..08497d92ac1824bb311cb0b26153c04840911902`（分支 `mabf/issue-440`，提交 `08497d9 feat(vfsl): validate record entry mutations`；20 文件、+4547/-0）
- 母法基线：`spec/adr-0034-record-elementwise-validation` @ `0a91f14`——本次以 `git merge-base --is-ancestor` 独立确认其为交付提交祖先（ANCESTOR_OK）
- Owner 反馈面：REST Issue #440 comments = `[]`（简报 + SA6 §2 双源）——无适用 owner 评论
- 方法：只读独立审查——交付 diff 逐行实读、冻结产物 md5 复算、兼容文案/路径对源码逐字节比对、证据日志实读、仓库先例（#435 提交 `006e416` / PR #434 `ca0ab53`）对照；未修改任何产物、未运行测试、未派发其他 SA

## 1. Reviewed inputs

| 输入 | 状态 | 核验方式 |
|---|---|---|
| `wiki/raw/task_issue-440.md`（简报） | 在场（untracked，见观察 1） | 实读；AC1–AC6 + Blocked by #437 |
| `wiki/raw/task_issue-440_design.md`（SA1） | 已提交 | 实读；§7.2 D1–D7、§8.1 管线、§10 ALLOW/DENY |
| `wiki/raw/task_issue-440_sa2_review.md`（SA2） | 已提交 | verdict approve、3 MINOR |
| `wiki/raw/task_issue-440_sa3_impl.md`（SA3） | 已提交 | 实读；声明与交付 diff/证据日志交叉核验 |
| `wiki/raw/task_issue-440_sa4_review.md`（SA4） | 已提交 | verdict approve、5 MINOR；其独立核验结论本次逐项复核 |
| `wiki/raw/task_issue-440_design_conflict_report.md`（SA8 design） | 已提交 | verdict clear；R1–R4 |
| `wiki/raw/task_issue-440_implementation_conflict_report.md`（SA8 impl） | 已提交 | verdict clear；R1 跨票追踪（#441 前落地 ADR 0007 注记） |
| `wiki/raw/task_issue-440_sa6_contract.md` + `_sa6_capability_probe.mts`（SA6） | 已提交 | §12.1 B-1…B-6、§16 md5 登记逐项比对 |
| 交付 diff 本体 | 已提交 | `git show 08497d9 --stat` + `git diff 0a91f14..08497d9` 逐行实读 |
| 规范面 | HEAD | `docs/adr/0034`（母法全文）、`docs/adr/0033`、`packages/vfsl/AGENTS.md`、根 `AGENTS.md`、`docs/AGENTS.md`、`vitest.config.ts` |

## 2. Verdict

**approve**——交付 diff 全面符合仓库 AGENTS 纪律、ADR 0033/0034 决策面、模块责任边界、既有架构惯例、单一事实源、生命周期对称性、文件范围与测试质量标准。无 BLOCKER、无 MAJOR；6 条 MINOR 观察（§8）均不阻断。

## 3. 已提交 diff 与上游审查对象的一致性

SA3/SA4/SA8 审查的是工作区未提交 diff（2 生产文件、+151/-0）；最终提交 `08497d9` 的生产面与之**逐字节同一**（`packages/vfsl/src/validate-patch.ts` +143、`packages/vfsl/src/index.ts` +8，纯加法、零删除行），并另外纳入：SA6 冻结测试四件、SA6 探针、SA1/SA2/SA3/SA4/SA8×2/SA6 报告七件 wiki 工件、证据日志 6 件（sa3-issue440 五件 + sa6 探针日志）。提交范围与仓库先例同形（`006e416` 同样含生产两文件 + 测试 + wiki 工件 + artifacts 证据）。

## 4. 标准符合性矩阵

### 4.1 仓库与模块 AGENTS

| 条款 | 核验结果 | 证据 |
|---|---|---|
| `packages/vfsl/AGENTS.md`「Add public API only through `src/index.ts`」 | 符合：恰 1 运行时导出 `applyElementwiseEntryMutation` + 2 类型导出 `EntryCarrierFacts`/`ElementwiseEntryMutationPayload`，全部追加进既有 `validate-patch.js` 导出块；无第二公共面 | 交付 diff `index.ts` 段（值导出块 +1、类型块 +2、注释 +5） |
| 同步/确定性；公共畸形输入路径返回判别联合而不抛错 | 符合：全程 `wrapElementwise`（E100 同款崩溃边界）包裹；闸门/守卫/缺字段全部 `ok:false` 响亮 issue；敌意 facts/payload 经 `?.` 读取由守卫 ④⑤ 响亮拒绝（判别联合，非 TypeError） | `validate-patch.ts:1225-1289` |
| 不引入 Yjs 运行时关切 | 符合：`facts.has` 由调用方读出传入；diff 零新 import、零 Yjs 引用 | diff 实读；`grep` 包外零引用 |
| 稳定 error code/issue 序/path 是兼容行为 | 符合（本次独立逐字节比对）：no-op 文案 `delete 目标键不存在（拒绝 no-op）`（legacy `:977` ↔ 新面 `:1272/:1277`）；必填文案 `缺少必填字段 "${key}"`（`validate.ts:680` ↔ `:1194`）；rebase 形态 `[...plan.prefix, ...issue.path]` 与 legacy `validateBoundary`（`:1019-1023`）及 `issueAt`（`:937-943`，record/parent 计划 relPath=[key] ⟹ `[...prefix,key]` 与 entryPath 逐字节同）一致；Record 键/值 issue 序与键 Pattern 消息族经 `validateSubtree` 单源继承零复制 | 本次源码比对 |
| 验证门禁（包 tsc + 根 typecheck/test） | 符合：`VFSL_TSC_EXIT:0`、`ROOT_TYPECHECK_EXIT:0`（15 包 && 链）、`ROOT_TEST_EXIT:0`（469 files / 5712 tests / Type Errors no errors）、聚焦 45/45 `FOCUSED_EXIT:0` | `artifacts/sa3-issue440-{vfsl-typecheck,root-typecheck,root-test,focused}.log` 实读 |
| 根 `AGENTS.md` 测试纪律（零 skip/only/todo/env override、真实入口发现） | 符合：四件冻结测试 grep 零命中 `it.skip/it.only/describe.skip/it.todo/process.env`；两测试文件命中根 `vitest.config.ts:15` include，test-d 命中 `:20` typecheck include（root-test L10/L623/L637 收集证据） | grep + config 实读 |

### 4.2 ADR 决策面

| 决策 | 核验结果 | 证据 |
|---|---|---|
| ADR 0034 决策 1（闸门=非 union Record 形态；union map 位永久 legacy；值位 union 不排除；旧值不读；issue 路径 `[...mapPath,key]` 逐字节兼容） | 符合：闸门四条件（kind∈{record,parent} ∧ relPath 单段 string ∧ node.kind=object ∧ `<key>` 槽↔kind 一致）fail closed；set 支不读 `facts.has`；值位 union 经 `<key>` 槽整体过解释器；rebase 与 legacy 同式 | `validate-patch.ts:1226-1248,1275-1287` |
| 决策 2（封闭对象 delete 静态必填：optional∨unknown 允、必填非 unknown 拒、`has` 拒 no-op、不读父值） | 符合：`judgeClosedObjectDelete`（`:1178-1195`）镜像 `validate.ts:672-681` 次序（optional 先查 → `walkRefChain(field.value, valueLens(derived.values))` 与 `resolveValues`=`validate.ts:147-149` 同算法同文案 → scalar∧unknown 跳过 → 必填拒）；缺字段 fail closed（规划层不可达） | 本次逐行比对 |
| 决策 3（返回 `ValidateResult` 直出，无 `proposedBoundary`） | 符合：ok 支恰 `{ok:true}`；test-d 负面夹具锚定 | `:1219-1224`；`.test-d.ts:50` |
| 决策 4（触达面=载体+目标键位） | 符合（本票份额）：输入面恰 `{has}`；doc-runtime 零接线（包外 grep 零引用新名目） | `:1161,1250`；grep |
| 决策 5（一致性 fixture 执法；禁 map 级约束特判） | 符合：fixture md5 `ce86199a…` 与 SA6 §16 恒同；E1 107/107 逐字节、E2/E3 绿（证据日志）；实现零 map 级特判 | md5 复算；focused/root-test 日志 |
| 决策 6（排序 #435–437 后；复用而非另起平行机制；#435 既定范围不动） | 符合：祖先链含 `ca0ab53`（PR #434）；新节与 #435 节同构同命名族（`EntryCarrierFacts`/`ElementwiseEntryMutationPayload` 对 `ArrayCarrierFacts`/`ElementwiseArrayMutationPayload`）；复用既有私有助手 `singleIssue:1063`/`wrapElementwise:1142`/`valueLens:81`/`walkRefChain` import `:39`/`validateSubtree` import `:41`；#435 节零 diff（新节自 L1150 起纯尾部追加） | diff 实读 |
| ADR 0033（数组接缝签名面冻结；规划层不动） | 符合：`applyElementwiseArrayMutation` 及类型零改动；`planMutationBoundary`/`applyMutationAtBoundary`/`validateSubtree`/`validate.ts` 等全部零 diff | `git show --stat`（仅 2 生产文件 M 且纯加） |
| ADR 0007 修订节语料（SA8 R1） | 不冲突：本票未接线 ⇒ 运行时行为仍逐字符合 ADR 0007 现行措辞；「ADR 0034 修订注记」doc-only 归立法路径，硬性时点 #441 前（SA8 implementation 报告 §8 R1/R4 跨票追踪）——非本票交付缺陷 | SA8 两份报告 |

### 4.3 模块责任 / 架构惯例 / 单一事实源 / 生命周期

| 维度 | 结论 |
|---|---|
| 模块责任 | 判定语义归 `@nomicore/vfsl`（与 #435 同文件同布局追加）；在场性 O(1) 事实采集显式移交 doc-runtime（#441）；零跨模块改动——责任归属正确 |
| 既有架构惯例 | 命名族/判定管线（闸门→事实守卫→载荷守卫→域规则→共享解释器→`wrapElementwise`）/文件内分区横幅/头注释式样均与 #435 先例同构；提交信息式样 `feat(vfsl): validate record entry mutations` 与 `006e416 feat(vfsl): validate array mutations elementwise` 同款 |
| 单一事实源 | Record 判定语义无镜像（直调 `validateSubtree`）；封闭对象必填判定镜像 `validate.ts` 但由 NC1.4 冻结常量 + E1 oracle 逐字节双锚（漂移即红）；两条域规则文案同文件字面复用（NC1.3/NC1.4 常量锚）；计划形状只消费不重算——无第二状态字段、无反推面 |
| 生命周期对称性 | 同步纯函数：无 register/dispose、订阅、事务、后台任务；中间态（合成视图、透镜实例）调用局部即弃；回滚 = 删节（纯加法）；不适用面如实标注——无缺口 |

### 4.4 文件范围

交付 diff 严格落于设计 §10 ALLOW LIST + 角色产物：生产恰 2 文件（+151/-0）；DENY LIST 逐项零触碰——`validate.ts`/`derived.ts`/`resolve.ts`/`pattern.ts`、`packages/vfsl/test/issue-435-*`、`packages/doc-runtime/**`、`packages/namespace-runtime/**`、`docs/adr/**`、`CONTEXT.md`、`docs/vfsl/**` 全部无条目。`git diff --check` 零空白错误。冻结产物 md5 本次独立复算 5/5 与 SA6 §16 登记一致（fixture `ce86199a…` / contract `a595c8ae…` / control `46829054…` / test-d `0fe31a97…` / probe `0b598041…`）。

### 4.5 测试质量

SA6 冻结测试四件逐字节未动；断言只经包公共入口观察运行时行为（判别联合/issue message+path/oracle 逐字节比较/导出在场性），零源码字符串断言、零 skip/only/todo、零 env override、零 fallback/吞错；oracle = 既有公共导出 `applyMutationAtBoundary`（独立通道）；断言敏感性经 SA6 变异实验反证（M1b–M4 分别 4/5/10/4 红）；红→绿由能力缺口闭合达成（红因单一 `能力缺口：@` × 26，5 轮 md5 恒同），非断言弱化；test-d 负面夹具 3 条 `@ts-expect-error` 在实现签名下全部命中（`Type Errors no errors`）。根跑批数字对账成立（基线 466/5667 + 本票 45 tests = 469 files / 5712 tests，零第 4 方回归）。

## 5. Required revisions

| Finding ID | Severity | Evidence | Problem | Required change |
|---|---|---|---|---|
| （无） | — | — | 无 BLOCKER / 无 MAJOR | — |

## 6. Non-blocking observations（MINOR，不阻断 approve）

1. **[MINOR] 交付提交未纳入简报与部分 SA6 证据日志**：`wiki/raw/task_issue-440.md` 与 15 件 `artifacts/sa6-issue440-*.log`（baseline/focused-1..5/mutation/post/type-dryrun/witness 等）仍为 untracked；兄弟票先例（#435–437 经 PR #434  squash 合入，含「chore(evidence): normalize issue 437 logs」后续提交）显示简报与全量证据最终均入库。交付 diff 本身范围合规；建议 finalize/PR 阶段按先例补齐 evidence-normalize 提交，避免证据链断档。
2. **[MINOR] 探针 exit-0 字面判据与实现态不可同时满足**：SA6 §13 绿判据字面含「探针 exit 0」，而冻结探针 G1.1/G1.2 断言的正是新导出缺席——实现后必然翻红。设计 §13 残余 1、SA2 观察 1、SA8 R3 三处已立法口径（权威绿判据 = 契约 26/26 + 负控 19/19 + test-d 转绿 + 根 gates）；`artifacts/sa3-issue440-probe-post.log` 实读确认恰 G1.1/G1.2 FAIL、其余 25 项 ok、`PROBE_EXIT:1`。处置正确，仅备案。
3. **[MINOR] parent-delete 支 seam 本地 E100 的 path 为 `[]`**（legacy 同源异常经 rebase 为 `[...prefix]`）：仅手造派生物可达（`semantic.ts` E106/E308 使合法 derived 上 ref 环/重名字段不可达），与 #435 `wrapElementwise` 家族行为完全一致（SA4 观察 1）；#441 消费方不得假设 fast-path issue path 恒有 prefix 前缀。备案，无行动项。
4. **[MINOR] 两处域规则文案同文件字面复用而非提取模块级常量**（SA2 观察 2 / SA4 观察 4）：未采纳可选优化的理由成立（提取须改负控 NC1 锚定的 legacy 冻结支 `:941-981`，行为中性却在冻结面扩 diff）；双锚（NC1.3/NC1.4 常量 + E1 逐字节）本次复核全绿。接受取舍。
5. **[MINOR] 敌意通道语义读取（`(facts as … | null | undefined)?.has` / `(payload as …)?.op`）**：设计未强制、实现自决（SA3 已如实登记）；使 null/`{}`/畸形输入经守卫响亮拒绝而非 E100，与包纪律「畸形输入走判别联合」更对齐；冻结断言未覆盖该形状，无契约影响。备案。
6. **[MINOR] 手造「重名字段封闭对象」角落的镜像分叉**：`judgeClosedObjectDelete:1184` 用 `find`（首个命中），`validate.ts:652-653` 用 Map（后名覆盖）——仅手造派生物可达（E308 拒重名字段），两侧均响亮；实现忠实于设计 D4 原文。备案（SA4 观察 2 同口径）。

## 7. 收尾声明

交付 diff 经独立标准审查：公共面纪律、兼容行为面（message/path/序）、ADR 0033/0034 决策落实、模块责任、同族惯例、单一事实源、生命周期、文件范围、测试质量全部符合；冻结产物指纹 5/5 恒同；既有 23 运行时导出与 #435 签名面逐字节不变；证据日志内部自洽且与声明一致。SA9 未修改任何实现、设计、测试或冻结产物；未运行测试/服务；未派发其他 SA。本文件为本次审查唯一新增产物。
