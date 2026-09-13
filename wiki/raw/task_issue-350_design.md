# 实现设计 — issue #350 原子变更信封：mutateData 批量 ops 多操作全有或全无（ADR 0026）

| 项 | 值 |
|---|---|
| 任务类型 | Feature（能力缺口实现：ADR 0026 已接受、未实现） |
| 任务简报 | `wiki/raw/task_issue-350.md`（Issue #350，无 owner 评论） |
| 上游产物 | SA6 契约 `wiki/raw/task_issue-350_sa6_contract.md`（approve）；SA8 `wiki/raw/task_issue-350_conflict_report.md`（clear + requiresConflictRecheck:true）+ `wiki/raw/task_issue-350_relevant_decisions.md`；**实现后链路**：SA3 `wiki/raw/task_issue-350_sa3_impl.md`（唯一偏差 Deviations §1）、SA4 `wiki/raw/task_issue-350_sa4_review.md`（approve）、SA8 `wiki/raw/task_issue-350_implementation_conflict_report.md`（clear——其 Required action 1 路由本文 iteration 3 回写） |
| 评审输入 | `wiki/raw/task_issue-350_sa2_review.md`（iteration 1 评审，verdict **reject**：F5 MAJOR / F6 MINOR；iteration 0 的 F1 BLOCKER / F2 MAJOR / F3、F4 MINOR 经该评审 §13 处置记录核实**已解决**）——iteration 2 逐条落实见 §14；**iteration 3 回写输入**为实现后链路的同一事项三源记录（SA3 Deviations §1 / SA4 §12 观察 1 / SA8 实现后复审 Required action 1：S8 fixture 调和），映射见 §14.1 |
| 代码基线 | HEAD `211c5fa`（ADR 0026 已成文；生产代码零 `ops` 信封引用——SA6 §5 grep 复核；实现已按本文落地并经 SA4/SA8 复审——见实现后链路产物） |
| 设计产物 | 本文（`wiki/raw/task_issue-350_design.md`，iteration 3，原位修订 iteration 2；全文只描述当前一致设计——S8 fixture 已回写为落地的镜像成员构造，实现与测试零改动） |

---

## 1. 任务类型、目标和非目标

**目标**：按 ADR 0026 落地 `mutateData` / `applyValidatedMutation` 的批量信封 `{ ops: [...] }`：

1. 信封双形态互斥识别：单操作对象（现役契约，**逐字节不变**）与批量 `{ops}` 并存，同现为形状错误。
2. 写序列器槽内逐操作 prepare（解析/导航/detached 构建/校验）；任一操作失败 → **整体零写入** + **聚合全部失败操作的 issues**（按 ops 顺序，非 fail-fast 单错）。
3. 全部成功 → **单 Yjs 事务按序提交** + **批量感知的逐操作边界验证**（F1 修订：共享 record/parent/union 边界的合法兄弟操作不得触发伪 E201-C——以**组合期望边界**实现，见 §7.5；**array-\* 载荷折入共享边界同受覆盖**——F5 验收锚 S7）；观察者要么见全部、要么不见。
4. 各操作仍是最小 edit——不整父替换、不重建容器、不降级载体。
5. 一次变更尝试 = 一条诊断记录；单事务产出单条 owned update bytes。
6. 封口 SA8 移交的 `set([])` 批量元素边界（§7.2，裁定：**形状错误**）。
7. 定型批量公共类型名目并登记 public-surface 守卫测试（SA8 required action 3 / SA6 §12 义务②）。
8. 补齐共享边界验收覆盖（F2 修订）：新增两个红→绿测试文件作为落点（§11/§12.1）。
9. 补齐 array-\* 载荷折入共享边界的验收用例（F5：S7/NS-1 拓展）与组合失败分支的可达性表述更正 + 负向守卫（F6：S8、§7.5.2/§7.5.3/§7.6/§9 措辞）。
10. 实现后证据调和（iteration 3，SA8 实现后复审 Required action 1）：把 §12.1 S8 的字面 fixture 回写为已落地、经 SA4 源码独立复核与 SA8 no-conflict 裁定的**镜像成员构造**——**测试操作与断言语义逐字保持、实现零改动**；同时把「空 union 值仲裁恒选声明序首成员 ⇒ 非首成员独有键不可导航（单操作即 E204）」补入现状事实（§2 C18）。

**非目标**（issue 正文「本票不含」+ ADR 0026 L50–55 + SA8 范围外条款）：

- guard / `MUTATION_GUARD_MISMATCH`（ADR 0025，票 #347–#349 叠加于两种形态顶层；本票只兑现「元素携带 `guard` 键即刻形状错误」）。
- 复制 apply（replication-unvalidated）、wire 帧、META、readData、`replaceSchema` 面——零改动。
- `ops` 上限 16 放宽、批内嵌套受控放宽（0026 开放问题 1/2，须独立决策）。
- 新增稳定码、新增 operation/stage/result 诊断词、record schema 版本变更。
- 单操作形态任何行为、文案、时序变化（AC5 冻结面）。
- **扩大 E5 拒绝域**（以禁共享边界兄弟操作规避 F1）——SA2 明文禁止，且违反 ADR 0026 L30 本意与 AC1（见 §7.9 备选 G）。

---

## 2. 当前行为与证据锚点

| # | 事实 | 锚点 |
|---|---|---|
| C1 | `applyValidatedMutation(derived, doc, mutation)` 是唯一受控 Y.Doc 写入口；第三参公共类型 `ValidatedMutation \| unknown`——信封原样透传，无需改签名 | `packages/doc-runtime/src/mutation.ts` L66–70；`packages/doc-runtime/src/index.ts` L20–26 |
| C2 | `parseMutation` 先读 `env.op`：`{ops}` 无 `op` → 立即 `未知操作 "undefined"`，从不读取 `ops` 键——批量形态不存在 | `mutation.ts` L317–333；SA6 probe 逐字输出 |
| C3 | 单操作两管线分流：`set([])` 走 legacy 全量 ROOT 管线（extract → 双重全量校验 → clone → 单事务 replace-root → verifyInstall + verifySnapshotIntact）；其余非空路径走 issue #237 局部管线（`prepareLocalMutation` → `MutationPrepared{kind:'local', commit, verify}`） | `mutation.ts` L94–116；`mutation-local.ts` L211–423 |
| C4 | 局部管线 prepare 产物 = `{commit: PreparedCommit, verify: VerifyBoundaryIntactInput}`；提交由 `transactGuarded(doc, () => commitPrepared(...))` 单事务执行；提交后 `verifyBoundaryIntact` 双核：**安装事实核**（O(1)，操作自身安装位 identity/长度断言）+ **边界重投影核**（O(boundary)，`walk(structureNode, boundaryLive)` 后 `productEqual(walked.snapshot, proposedBoundary)` 整边界比较）；偏离 → E201-C committed:true；无法运行 → E201-D。**单操作成立的前提是「prepare 与 verify 之间无其他写入」——该前提在批量内结构性不成立（F1 根因，见 C14）** | `mutation.ts` L71–85、L192–211；`mutation-local.ts` L44–46；`install-verify.ts` L395–459（重投影核 L430–459） |
| C5 | 写槽 S1–S7（INV-W2 不可重排）：S3 `snapshotMutation` 对**整个信封**做一次受控冻结快照（`{ops}` 数组是 plain data，整体可快照——R6/R7 绿锚）；S5 把 `snap.value` 原样交给 `applyValidatedMutation`；失败 issues 经 R9 `diagValidation` 同源透传 | `packages/namespace-runtime/src/write.ts` L138–208（S3 L139、S5 L187、R9 L205–208）；`write.ts` L322–436（snapshotter） |
| C6 | 一个写槽 = 一次变更尝试 = 一条诊断记录：`createSlotDiag('root-mutation')` 在公共方法构造；`emitSlot` 由 `.then` 回调在槽释放后调用（槽外 emission）；committed update bytes 由 D-B 捕获窗口（`doc.on('update')` 首-赋值闭包）取得单事务增量 | `packages/namespace-runtime/src/runtime.ts` L512–533；`diagnostic.ts` L174–220；`write.ts` L173–204 |
| C7 | `mutateData` 公共面 `mutation: unknown`——信封无关；lifecycle 停接纳门（D5.1）先于输入访问（Proxy 零触发） | `runtime.ts` L512–525；R5 绿锚 |
| C8 | 稳定码注册表 append-only：doc-runtime 形状错误（`未知信封键`/`未知操作` 等）与 namespace 领域拒绝均无码走 `ok:false`；**throw 通道的 fatal 只有 E201-C/D、E203、E204**（`DocRuntimeFatalPhase` 联合恰三值：`'observer-cleanup-throw' \| 'post-commit-verification' \| 'pre-commit-internal'`）；**E205 不是 throw**——prepare 期意外异常经 `prepareMutation` 既有 catch **返回** `{ok:false, issues:[单条 'DOCRT-E205: …' 前缀 message]}`（零写入；message 前缀非稳定码字段） | `mutation.ts` L117–127（catch 返回 E205 issue）；`fatal.ts` L12–15（phase 联合）、L64–77（E203）；`write.ts` L188–204（branded → `RuntimeWriteFatalError`）；SA8 冻结面表 |
| C9 | SA6 红灯契约已就位：doc-runtime 12 用例（B1–B8 红 / N1–N4 绿）、namespace-runtime 7 用例（R1–R4、R7 红 / R5–R6 绿）；全仓基线 341/343 文件绿、13 红全为契约本义。**契约对共享边界交互零敏感（F2）：B1=两 target-Kind set+array-insert、B2 唯一 delete 边界独占、B5=16 个互异 target-Kind set、B7 兄弟=两个 ROOT 级 target-Kind set、R1/R3 同 B1 形态——13 红在 F1 缺陷存在时全部转绿** | `packages/doc-runtime/test/issue-350-batch-envelope-red.test.ts`（B1 L149–155、B2 L173–181、B5 L250–254、B7 L298–306）；`packages/namespace-runtime/test/issue-350-batch-envelope-red.test.ts`（LEGAL_OPS L170–174、R3 L236–241）；SA2 §12 缺口分析 |
| C10 | public-surface 守卫机制存在且分两面：值面 `public-surface-guard.test.ts`（`applyValidatedMutation` 恰一 mutation 值导出）、类型面 `public-surface-type-guard.test-d.ts`（正例 import + vitest `--typecheck`，include `packages/*/test/**/*.test-d.ts`） | 两测试文件；`vitest.config.ts` L18–22 |
| C11 | vfsl `planMutationBoundary`/`applyMutationAtBoundary` 为逐操作纯函数（零 base 读、零 doc 状态），字段名与单操作信封逐字对齐——逐元素复用无 vfsl 改动 | `packages/vfsl/src/validate-patch.ts` L702–834；`mutation-local.ts` L214、L234、L267、L310 |
| C12 | `planMutationBoundary`、`applyMutationAtBoundary` 与类型 `MutationBoundaryPlan`、`BoundaryMutationPayload` 均**经 `@nomicore/vfsl` 公共入口导出**——`mutation.ts` 可直接消费实现组合逻辑，零 vfsl 改动、零 `mutation-local.ts` 改动 | `packages/vfsl/src/index.ts` L100–114；`mutation-local.ts` L30–31（既有同源 import 先例） |
| C13 | 边界种类判定（`planMutationBoundary` L788–815）：路径首次穿越 union 位 → kind `'union'`（prefix=union 位）；`array-insert`/`array-delete` → kind `'array'`（prefix=数组位）；`delete` → kind `'record'`（终段经 Record `<key>`）或 `'parent'`（prefix=父 map 位）；`set` 终段为具名字段 → kind `'target'`（prefix=目标位本身，整值替换、旧值不读），终段经 Record `<key>` → kind `'record'`（prefix=Record map 位）。`applyMutationAtBoundary` 消费 `plan.relPath`（域规则导航/重建）、`plan.prefix`（issue path 折算）、`plan.node`（`validateSubtree`）——**不消费 `plan.kind`**（合成 plan 结构合法） | `validate-patch.ts` L788–815、L923–1009（分支仅按 `mutation.op`）、L1011–1019 |
| C14 | `proposedBoundary` 语义 = **批前边界逻辑值 + 本操作足迹**（`applyMutationAtBoundary` 的 `rebuildAlong` 以 prepare 期 `walk` 的批前提取值为 base，沿 relPath 脊柱拷贝式重建）；record/parent/union 种类的 `boundaryLive` 是 prefix 位 live 容器引用（提交后重投影读当前内容）。**因此 E5 允许的兄弟操作写入边界子树时，重投影核必然不等 → 伪 E201-C（committed:true、经写槽 `markWriteFatal` 永久禁写）** | `mutation-local.ts` L247（target verify 输入）、L283–293（record/parent verify 输入）、L410–420（union verify 输入）；`validate-patch.ts` L892–902（rebuildAlong）、L951–957（set 重建）；`install-verify.ts` L430–459；`write.ts` L188–204 |
| C15 | 诊断记录面：R9 `diagValidation` 把聚合 issues 以**同源引用**写入 rejected outcome；bounded memory log 的 `issuesPolicy` 默认 `'full'`——rejected record 的 `issues` 载荷含全部聚合 issues（F4 断言锚） | `diagnostic.ts` L269–273；`namespace-diagnostic-log/src/adapters/memory.ts` L164；`pipeline.ts` L228–233、L277 |
| C16 | **array-\* 载荷折入共享边界机制可行（F5）**：`applyMutationAtBoundary` 的 array 分支以 `relNavigate(boundaryBase, plan.relPath, plan.prefix)` 定位目标数组、`rebuildAlong` 沿 relPath 脊柱拷贝式重建——**非空 relPath 的合成 plan（parent/record/union 边界 + relPath 指向数组字段）是结构合法输入**，与 set/delete 终键位折迭同一分支族；union 边界的 array-\* 载荷在单操作 prepare 已是现役先例 | `validate-patch.ts` L980–1007（array 分支 relNavigate/rebuildAlong）；`mutation-local.ts` L307–309（array 边界 payload 构造）、L358–365（union 边界全四动词 payload 构造）、L373–394（union 位 array-\* 提交先例） |
| C17 | **union any-of 语义与非判别联合可表达（F6 可达性构造的源码依据）**：`validateUnion` = 候选过滤 + 首个零 issue 成员接受（判别式缓存仅快速路径、不改输出）；封闭对象对未声明键 emit `未知字段 "${k}"`；判别式检测是保守附加——成员全为内联对象但**无公共非可选字面量字段** ⇒ `discriminator === undefined`、走 any-of 全扫描；作者指南明文「联合对象的键空间是所有成员字段的并集，但具体值仍须完整匹配其中一个成员」⇒ **「两操作各自合法（各自期望边界命中不同成员）、组合边界无成员可容」可达——前提是逐操作 prepare 导航可过，即成员键集满足 C18 的空值仲裁约束（iteration 2 字面构造 `{ x?: number } \| { label?: string }` 不满足该前提，见 C18）** | `validate.ts` L391–433（validateUnion 候选/接受/报告）、L530–577（validateObject 封闭形态未知键）；`evaluate.ts` L230–241（detectDiscriminator 保守附加）；`docs/vfsl/schema-authoring-guide.md` §7（联合键空间句） |
| C18 | **空 union 值的成员仲裁恒选声明序首成员；非首成员独有键不可导航（iteration 3 补充——S8 fixture 调和的根因，SA8 Required action 1 的「C17 限定/现状事实」落实）**：读侧 `walkUnion` 对「封闭 map 形成员、全可选字段全缺席」的试验**接受**（缺必填仅置软标记、不中断——首个接受者胜，声明序）；写侧 prepare 期换根导航 `resolveNode` 以同一「逻辑值相等」判据按声明序扫描成员，空值（提取逻辑值 `{}`）恒命中成员 0。⇒ 终键仅存在于非首成员的单操作（如字面构造的 `set ['u','label']`）在 `childNodeOf` 抛 `DerivedInvariantError`（`validated map child 缺少结构字段（label）`）→ **E204 fatal（pre-commit-internal、零写入）**——单操作路径在 HEAD 即命中的**既有行为**（`extract.ts`/`mutation-local.ts`/`mutation.ts` 导航件均 DENY 路径零改动）。推论：组合失败构造类（C17/引理 4'）的 fixture 须让两成员声明**同一键集**（镜像成员、值域互斥），「两操作各自单独合法」前置方成立（§12.1 S8） | `extract.ts` L160–175（walkUnion 首个接受者胜）、L187–219（trialMember：软标记仅缺必填、全可选全缺席即接受）；`mutation.ts` L465–481（resolveNode 声明序 + `logicalValuesEqual` 等值消歧）、L508–522（childNodeOf——L521 缺结构字段 throw）、L161–165（DerivedInvariantError → E204 pre-commit-internal）；`mutation-local.ts` L349–374（union case：边界提取 → `applyMutationAtBoundary` 校验 → S7 换根导航消费 boundaryLogical）；SA3 `sa3_impl.md` Deviations §1（probe 逐字输出）；SA4 `sa4_review.md` §2/§12 观察 1（独立复核）；测试内联记录 `packages/doc-runtime/test/issue-350-batch-shared-boundary.test.ts` L265–276 |

---

## 3. 能力缺口（根因承接）

能力缺口链（SA6 §8 已证，设计承接不重做复现）：

1. ADR 0026 已接受并要求双形态信封（L14–46）→ 现状解析器 `env.op` 先行（C2），`{ops}` 落单操作拒绝路径 `未知操作 "undefined"`。
2. 因此批量解析 / 逐操作 prepare / 跨操作聚合 / 单事务多操作提交路径**全部不存在**；`{ops}` 当前的「零写入」是整体拒绝的副产物，不是原子性实现（SA6 H4 排除）。
3. 设计层缺口（SA2 F1 指出，本版补齐）：批量语境下**逐操作验证输入未适配**——单操作管线的「批前快照式期望边界 + 提交后整边界重投影比对」依赖「prepare 与 verify 之间无其他写入」，该前提在单事务批量内结构性不成立；直接逐操作复用会使 ADR 0026 自身的示范用例（状态转移改 status + 清 reviewer）触发伪 E201-C 永久禁写。缺口封闭方式 = §7.5 组合期望边界（仍封闭在 doc-runtime 编排层）。
4. 验收层缺口（SA2 F2 指出；F5 析出残余形态缺口，本版补齐）：现有 13 条红灯对共享边界交互零敏感（C9），iteration 1 计划用例又遗漏 array-\* 载荷折入共享边界与组合失败负向两形态——需新增红→绿用例与负向守卫（§12.1 S1–S8/NS）。
5. 端到端面同源透传已就绪（C5/C7）：缺口封闭在 doc-runtime `applyValidatedMutation` 信封解析与管线编排一层；namespace-runtime 预计零改动（SA6 impact surface 同判）。
6. 诊断面缺口是 5 的下游：正例 committed 记录不可达、失败聚合 issues 不可达；槽机械、词表、emission 调用点本身无缺口（R5/R6 绿）。

---

## 4. Owner 要求落实

Issue #350 无 owner 评论（Host REST 预读：「none; there are no owner-comment requirements」）。

| Comment ID | Updated at | Requirement | Design section |
|---|---|---|---|
| （无） | — | 无额外评论要求；需求完全由 issue 正文 AC1–AC8 + ADR 0026 + SA8 冻结面 + SA2 评审（iteration 0 F1–F4、iteration 1 F5/F6）推导 | §7（AC 逐条映射见 §12）；AC3 中 `set([])` 未列出的解释性锚点由本设计封口（§7.2）；F1–F6 落实见 §14 |

---

## 5. 复现和根因承接

| 上游事实 | 证据位置 | 设计响应 |
|---|---|---|
| `{ops}` 全合法 → `{ok:false, 未知操作 "undefined"}`；批量能力整体不存在 | SA6 §5 probe（batch-all-legal 逐字输出）；`mutation.ts` L317–333 | §7.1 信封双形态分发：`Object.hasOwn(env,'ops')` 先行分派批量分支 |
| 元素合法性前置已证（set 容器/可选字段 delete/array-insert/array-delete/`set([])`/16+1 元素单独全绿） | SA6 §5 E2、`expectEachOpLegalAlone` | 逐元素复用**同一**单操作解析器（§7.3 E3），元素合法性判定零第二实现 |
| S3 快照边界先于批量解析：`{ops}` 含 class/accessor → `MUTATION_INPUT_NOT_PLAIN_DATA`、accessor 零执行 | SA6 §9 E3；R6 绿 | 批量解析放在 S5 `applyValidatedMutation` 内（槽内位置不变）→ R6 路径零改动 |
| lifecycle 停接纳先于输入访问 | SA6 §9 E4；R5 绿 | 公共面零改动；接纳门与信封形态无关 |
| 失败聚合：当前仅 1 条 `未知操作 "undefined"`，期望 ≥2 条按 ops 顺序 | B3/R2 红 | §7.4 聚合协议：逐操作 prepare、fail 追加 issues 继续、全失败后整体 `ok:false` |
| 诊断：批量后恰 1 条 committed/update record（对照 3 次顺序写 3 条）；形状错误 rejected/validation/`code===undefined`/capture digest | R3/R4 红+绿锚 | §7.7：namespace-runtime 与诊断包零改动；单事务天然单 update bytes（C6 D-B 窗口） |
| 排队期间改动 `ops[0].value` → 槽起点快照获胜 | R7 红（快照语义由同一 S3 承接） | S3 对整个 `{ops}` 一次快照（现状行为，C5）；批量实现不改快照点 |
| 最小 edit：700k 兄弟字段下 update < 1000 字节、unrelated 载体身份保持 | B4 红 | §7.5：逐操作局部管线 commit 原样进单事务；无整父/整根替换路径 |
| `set([])` 元素边界未决（SA8 conflict report §4/§8 移交 SA1） | SA8 Decision analysis ADR 0008 行；SA6 §15 第 1 行；B8 decision-neutral | **§7.2 本设计封口：形状错误拒绝**（B8 闭口 B）——iteration 1 保持不变 |
| **SA2 F1 证据链**（本设计独立复核属实）：record/parent/union 的 `proposedBoundary` 为批前整边界重建；重投影核整边界 `productEqual`；kind 判定使 delete 恒 parent/record、Record-键 set 为 record、union 穿越为 union、仅具名字段 set 为 target；write.ts L188–198 把 E201-C 转 `RuntimeWriteFatalError` + `markWriteFatal` | SA2 §8 D1 证据链 1–5；本文 C13/C14 逐锚点复核 | §7.5 D5 验证面重写：组合期望边界（方案 (a)，封闭在 mutation.ts）；`mutation-local.ts`/`install-verify.ts` 零改动（§11 DENY 保持） |
| **SA2 F5/F6 证据链（iteration 1）**：array-\* 载荷折入共享边界是合法形态（E5 兄弟）且 iteration 1 计划用例对其零覆盖——`payloadOf` 的 array 分支在一切计划折迭中从未执行，实现误差将复现 F1 症状且 C13 跨包行为依赖无行为锚；组合失败分支「理论不可达」标注可证伪（union 成员 any-of 重叠构造类）且 §7.6 契约锚悬空 | SA2 §13 F5/F6 行、§8 D2/D6、§12 缺口行；本文 **C16**（array 分支合成 plan 结构合法 + union 位 array-\* 现役先例）、**C17**（非判别联合可表达 + 封闭对象未知键 + any-of 全扫描）源码级复核 | §12.1 文件 A **新增 S7**（array 折迭正例）与 **S8**（组合失败负向守卫）、文件 B **NS-1 拓展 array 元素**（端到端）；§7.5.2/§7.5.3（引理 4'）/§7.6/§9 可达性表述更正（F6） |
| **S8 fixture 实现偏差（iteration 3 回写输入）**：iteration 2 字面 fixture `u: { x?: number } \| { label?: string }` 的「两操作各自单独合法」前置在 HEAD 不成立——空 `u` 的 union 仲裁恒选成员 0（本文 C18），`set ['u','label']` **单操作**即 E204 fatal（probe 逐字留证）；SA3 以镜像成员 fixture `u: { x?: number; label?: number } \| { label?: string; x?: string }` 替换（ops 与断言语义逐字不变、构造类相同），SA4 对源码独立复核判定替换**成立且必要**（approve），SA8 实现后复审裁定 no-conflict 并把设计文本回写列为 Required action 1 | SA3 `sa3_impl.md` Deviations §1（probe 输出 + 根因 + 替换构造 + 不变量保持）；SA4 `sa4_review.md` §2/§12 观察 1；SA8 `implementation_conflict_report.md` Decision 表「设计 §12.1 S8 字面 fixture」行 + §8 Required action 1；本文 **C18** 源码级复核；测试内联记录 L265–276 | §2 新增 C18 + C17 尾部限定；§7.5.2/§7.5.3/§7.6 构造类表述、§12.1 文件 A fixture 与 S8 行回写为镜像成员构造（**操作与断言逐字保持**）；§13 残余问题 1 补固化要求；§14.1 回写映射 |

上游事实与源码无矛盾（SA6 §8 六步全「高」置信；本文 C1–C18 逐锚点复核一致；SA2 F1/F3 证据链经本设计对源码独立复核属实）。iteration 2 字面 S8 fixture 的「各自单独合法」前置与源码矛盾的一处，已由实现链路（SA3 替换/SA4 复核/SA8 裁定）承接并经本文 C18 复核后回写（§12.1）——该矛盾属**验收示例选形**失真，非设计决策面失真（§7.5.2 组合期望边界机制本身未被证伪，S8 落地用例全绿）。

---

## 6. SA8 约束落实

| 决议或义务（来源） | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|
| 单操作信封行为逐字节不变（冻结面第 1 行；0026 L17/L65；AC5） | §7.1 分发设计；§7.3 元素解析复用；§7.5 验证面修订**只在批量分支内** | 无 `ops` 自有键的信封走**原路径原代码**；`hasOwn('ops')===false` 时单操作分支零改动（含 `未知信封键`/`未知操作` 文案与次序）；组合逻辑、plan 复跑、合成 plan 全部位于批量分支 | 是（复核实现确未扰动） |
| 一个写槽 = 一次变更尝试；S1–S7 不重排；S3 对整个信封一次快照；不新建槽类型（0008 L49–51；INV-W2） | §7.7 | namespace-runtime **零改动**；批量全部封闭在 S5 单次 `applyValidatedMutation` 调用内（组合逻辑亦在 S5 内、事务前） | 是 |
| 稳定码 append-only、批量无新增稳定码（0026 L42） | §7.6 错误域 | 形状错误与聚合失败均无码 `ok:false`（沿 C8 现路径）；fatal 码族零变化 | 是 |
| 诊断词表与记录形态冻结：operation 仍 `root-mutation`、stage/result 联合不变、一尝试一最终 record、rejected 禁 update、槽外 emission（0011/0014） | §7.7 | 诊断包与 diagnostic.ts 零改动；聚合 issues 经 R9 `diagValidation` 同源引用透传进同一记录（issues 顺序 = ops 顺序，0011「保留 issues 顺序」；记录面 `issues` 载荷由 C15 锚定） | 是 |
| `ops` ≤16 非空、元素为完整单操作信封、元素禁 `guard`、批内路径互不嵌套（0026 L29–30；AC3） | §7.3 E1–E5 | 信封校验期（fail-fast 单 issue、无码）一次性判定；元素键集封闭由共享单操作解析器天然排除 `guard` 与一切未知键；**E5 拒绝域精确保持「祖先-后代或相同」——不为 F1 扩大**（共享边界兄弟路径合法，SA2 明文要求） | 是（词表常量冻结核对） |
| 槽内次序：逐操作 prepare → 任一失败整体零写入 → 单事务按序提交 → 逐操作边界验证（0026 L34） | §7.4–§7.5 | prepare 全部先于事务（禁 write-then-undo，0007 #237 §5）；单 `transactGuarded` 内按序 `commitPrepared`；事务后按序 `verifyBoundaryIntact`（批量 item 的**期望边界经组合**，实际侧与比较器零改动） | 是 |
| 最小 edit 不降级（0026 L36） | §7.2、§7.5 | 批内元素禁 `set([])` ⇒ 批量元素**只走局部管线**，无 legacy 全量路径 ⇒ 结构性排除整父/整根替换；组合逻辑只改期望值构造，不触提交面 | 否（局部） |
| 跨实体路径同样原子（0026 L35；AC4） | §7.5 | 单 Yjs 事务覆盖整个 doc（跨 Record 条目/不同集合一次提交） | 否（局部） |
| 聚合只跨操作、按 ops 顺序拼接；不改变单操作内部 issue 行为（0007 L46 由 0026 L41 演进） | §7.4 | 元素内部仍 fail-fast（复用单操作 prepare 结果整体）；单操作形态路径不经聚合代码 | 否（局部） |
| `MUTATION_INPUT_NOT_PLAIN_DATA` 对整个 `{ops}` 信封的 S3 快照拒绝保持（required action 6） | §7.7 | snapshotter 零改动；R6 绿锚保持 | 否 |
| lifecycle 停接纳次序不变（AC7） | §7.7 | 公共面零改动；R5 绿锚保持 | 否 |
| 公共面纪律：新公共类型只经 `src/index.ts`、同步登记 public-surface 守卫测试（required action 3） | §7.8 | 新增 `BatchedMutation`/`MutationEnvelope` 两个**类型**导出（无值导出）；类型面守卫登记正例 + `@ts-expect-error` 负例；值面守卫测试不动（mutation 值导出仍恰一个） | 是 |
| **SA1 封口 `set([])` 元素边界**（required action 2） | §7.2 | 裁定闭口 B：形状错误零写入（与 0008 L47 唯一性句最一致）；完整理由与不选择闭口 A 的原因入文——iteration 1 保持不变 | 是（设计后复审裁可） |
| 不触复制 wire / apply / META / readData / `replaceSchema`（0026 L50–51） | §11 DENY LIST | 相关路径全部禁改 | 否 |
| fatal 通道不变、无新增 fatal 触发点 | §7.6 | **throw 通道仅 E201-C/D（逐操作验证）、E203（事务栈异常）、E204（prepare 期不变量）**；E201-C 经组合期望边界后**只对真实提交后偏离触发**（恢复 0007 #237 §5 语义）；E205 = 既有 prepare catch **返回**的 `ok:false` 单 issue（零写入、不进聚合、非 fatal phase——F3 更正后的准确描述）；批量循环意外异常照旧经同一 catch 收编 | 是（F1 修订涉及 E201-C 触发面收窄回正确语义，复审核实无新触发点） |
| typed-access 完成门：引擎公共类型可被 typed adapter 组装（元素类型可静态约束） | §7.8 | `BatchedMutation` 元素类型 `readonly ValidatedMutation[]`——宿主以生成 `PathPatchValue` 组装元素、以该类型定型信封；负例证明 `guard` 元素编译期 fail-closed | 否 |
| **实现后复审 Required action 1（S8 fixture 设计回写，iteration 3 已兑现）**：更正 §12.1 文件 A S8 字面 fixture 为镜像成员构造、根因补入 §2 现状事实/C17 限定（`implementation_conflict_report.md` §8；Decision 表裁定 no-conflict——ADR 0026 不规定测试 fixture，替换不触任何条款/冻结面/override；证据链以 SA3 Deviations §1 与测试内联注释为准） | §12.1 文件 A/S8 行、§2 C17 限定 + C18、§7.5.2/§7.5.3/§7.6、§14.1 | 本版完成回写：fixture 规格与已落地测试一致（测试 L34/L61）；根因与等价性论证入 C18 与 §12.1 S8 行；**不改任何实现/测试**（已按语义等价构造落地并经 SA4 approve/SA8 clear） | 否（证据文书更正，非决策修订——SA8 复审明文，见 §15 理由 7） |

---

## 7. 设计决策与主要备选方案

### 7.1 决策 D1：信封分发点与判据——`plainObjectOf` + `Object.hasOwn(env, 'ops')`

`applyValidatedMutation` 内（`prepareMutation` 顶部）：

```
env = plainObjectOf(mutation)
env !== null && Object.hasOwn(env, 'ops')  →  批量分支 prepareBatch(env)
其余（含 env === null、无自有 'ops' 键）   →  单操作分支（现状代码原样）
```

- **判据用自有键而非值**：`{ops: undefined}` 判入批量分支 → E2「ops 必须是非空数组」形状错误（确定性零写入）。经 `mutateData` 时该输入已被 S3 以「键值 undefined」拒绝（`MUTATION_INPUT_NOT_PLAIN_DATA`，先于 doc-runtime）；doc-runtime 直调面由 E2 兜底。
- **单操作逐字节不变的机制保证**：无自有 `ops` 键的输入所经分支与现状**字符级相同**。旧运行区对 `{op,...,ops}` 同现的拒绝（现状 `未知信封键 "ops"（操作 set）`）在新代码变为批量分支的双形态形状错误——该输入**不在** AC5 冻结面内（冻结面限定「无 ops」信封；ADR 0026 L28 明文同现 = 形状错误，SA8 override 表第 4 行已裁此演进合法）。
- 原型链继承的 `ops`（非自有键）不入批量分支——与单操作未知键检测用 `Object.keys`（自有可枚举）的既有口径一致。

### 7.2 决策 D2（SA8 移交封口）：`set([])` 作为批量元素 = **形状错误，零写入拒绝**

**裁定**：`{ops:[...]}` 中任一元素为 `{op:'set', path:[]}` 时，整个信封在信封校验期拒绝为形状错误（无码、不可重试、path `[]`、确定性）。（iteration 1 保持 iteration 0 裁定，SA2 §5 核定通过。）

理由（按 SA8 required action 2 的两闭口权衡）：

1. **ADR 0008 L47 唯一性句**：「空路径整体替换……是**唯一**清空并重装完整 ROOT 的 mutation，不作为普通消费模式」。单元素批量 `{ops:[set([])]}` 若走 legacy 全量管线，即构成抵达全量重装的**第二信封形态**——SA8 判其为「解释张力」；闭口 B 消除张力，闭口 A 须明示豁免并长期背负该豁免的文档与审计义务。
2. **能力零损失**：批内路径互不嵌套规则下，`[]` 是一切非空路径的祖先——含 `set([])` 的多元素批量**必然已被嵌套规则拒绝**。唯一幸存形态是恰含一个 `set([])` 元素的批量，而它语义上等价于直接发单操作 `set([])`（legacy 管线逐字节可达，N4 锚）。拒绝该退化形态不削减任何可表达的合法意图。
3. **管线纯度**：`set([])` 元素若放行，prepare 阶段将混入 legacy 全量管线（extract + 双重全量校验 + replace-root），其 `rootMap.clear()` 会废弃同批其他操作 prepare 持有的 live 容器引用（父 map/目标数组被脱链），提交后逐操作边界验证结构性失效（误报 E201-C 或漏检）。禁令使**批量元素全部走局部最小 edit 管线**（§7.5），prepare 独立性由非嵌套规则完整建立（§7.4 引理 1–2）。
4. **词汇一致**：typed-access 技能（`211c5fa` 已改写）明文 `set([])`「reserve for explicit administrative replacement/migration flow—not normal application writes」；批量是普通消费面。CONTEXT.md「原子变更」词条 _Avoid_「整父替换换原子」同向。

**闭口 A 被否的完整表述**：明示等价 legacy 管线虽可满足 B8 闭口 A 的可观察不变量（单事务、单 update、ROOT 全等），但它引入第二全量形态、破坏批量管线单形性、且不提供任何单操作形态不具备的能力——成本全为负。

**边界细化**：非 `set` 的空路径元素（`{op:'delete', path:[]}`、`{op:'array-insert', path:[], ...}`）**不是**形状错误——它们是键集完整的单操作信封，落入逐操作 prepare 以操作失败（领域 issue）进聚合（与单操作形态同款失败，零特判）。禁令精确限定 `op === 'set' && path.length === 0`。

**契约联动**：SA6 B8 为 decision-neutral（两闭口均过）；本裁定后 SA6 下一轮把 B8 升级为闭口 B 单向断言（follow-up，见 §13 残余问题 1），本任务实现与测试均无需改动 B8。

### 7.3 决策 D3：信封校验（阶段 E，fail-fast 单 issue、无码、槽内 S5 位置）

批量分支校验次序（**全部先于任何逐操作 prepare 与任何 live 读**；任一步失败即返回 `{ok:false, issues:[单条]}`，零写入）：

| 步 | 检查 | 拒绝消息（新词表，确定性；非稳定码） | issue path |
|---|---|---|---|
| E1 | 顶层键封闭：恰 `{'ops'}`。若含 `op` → 双形态；其他多余键 → 未知键 | `批量信封形状错误：双形态同现（"ops" 与单操作字段组不得同时出现）` / `未知信封键 "${k}"（批量信封只允许 "ops"）` | `[]` |
| E2 | `ops` 为数组、非空、长度 ≤ 16（词表常量，包内具名常量 `MAX_BATCH_OPS = 16`，**不导出**） | `批量信封形状错误：ops 必须是非空数组（实际 ${word}）`（空数组：`（空数组）`）/ `批量信封形状错误：ops 元素数量超上限（${n} > 16）` | `[]` |
| E3 | 逐元素（按序）：复用**同一**单操作解析核（动词封闭键集/缺键/path 数组与段型/动词值域——`guard` 与一切未知键由封闭键集天然排除）；失败即止 | `批量元素 #${i}：` + 单操作解析核原文（如 `未知操作 "bogus"`、`信封缺少必需键 "value"（操作 set）`） | 解析核原 issue path |
| E4 | 逐元素（E3 通过后）：`set([])` 禁令（§7.2） | `批量元素 #${i}：禁止 set([])（空路径全量重装仅保留给单操作形态——ADR 0008 唯一全量形态；批量元素必须是非空路径最小 edit）` | `[]` |
| E5 | 两两路径互不嵌套（`i<j`，段严格 `===` 前缀或相等判定；O(n²)、n≤16 ≤ 120 次）。**拒绝域精确为「祖先-后代或相同」——共享边界兄弟路径（不同键终段）合法放行（F1 修复不扩大拒绝域）** | `批量信封形状错误：批内路径嵌套（#${i} 与 #${j} 的路径构成祖先-后代或相同关系）` | `[]` |

- **单操作解析核抽取**：把现 `parseMutation` 的校验体抽为共享函数，单操作分支与元素循环共同消费；单操作分支的调用点、参数、返回、消息**零变化**（N3 文案 `未知信封键 "zzz"（操作 set）` 冻结）。元素消息仅加 `批量元素 #i：` 前缀。
- **元素级继承口径**：非自有/非可枚举键沿单操作 `Object.keys` 既有口径（不可见则不判）；经 `mutateData` 的输入已被 S3 快照器整体拒绝（非枚举/accessor/symbol 全拒），直调面行为与单操作形态一致——非新增缺口，记录不改。
- **形状错误分类依据**：ADR 0026 L40「元素非单操作信封、元素携带未知键」属形状错误（信封校验拒绝），与操作失败（L41 聚合）分域。E1–E5 均 fail-fast 单 issue；聚合只发生在 §7.4。

### 7.4 决策 D4：逐操作 prepare 与聚合协议（阶段 P）

E1–E5 全过（得到按序解析元素 `m1..mk`，每元素为现役 `ParsedMutation` 形状）后：

```
if (derived.structure.kind !== 'root') throw DerivedInvariantError(...)   // 与单操作分支同款、同位置语义（E 后 P 前，一次性）
issues: MutationIssue[] = []
items: Array<{commit, verify}> = []
for i in 0..k-1:                          // 按 ops 顺序
  r = prepareLocalMutation(derived, doc, m[i])
  if r.kind === 'fail': issues.push(...r.issues)      // 追加该操作全部 issues，继续下一操作
  else: items.push({commit: r.commit, verify: r.verify})
if issues.length > 0: return {kind:'fail', issues}    // 整体零写入、聚合、按 ops 顺序
// —— 阶段 C（组合验证输入）：见 §7.5，仅全部 prepare 成功后执行 ——
return {kind:'batch', items}
```

- **聚合语义**：跨操作聚合、操作内部不拆（元素 prepare 结果整体追加——与单操作「逻辑校验保留完整 issues、结构错误 fail-fast」的内部行为一致，SA8 override 表第 5 行）；顺序 = ops 顺序（B3/R2 断言 `atN < atA`）。
- **fatal 不进聚合**：循环中抛出的 `DerivedInvariantError`（两树分歧/手造派生物）与意外异常直接穿出，由 `prepareMutation` 既有 catch 分类——E204（pre-commit-internal，committed:false 零写入）/ E205（意外异常，**返回** `ok:false` 单条 E205 前缀 issue，零写入——F3 更正，见 §7.6）。与单操作形态分类完全同款；「聚合」只收编 `{kind:'fail'}` 领域结果。
- **prepare 独立性引理**（批量单遍 prepare 正确性的依据，引理 1 的推论）：非嵌套规则（E5）保证任一操作的路径不是另一操作路径的祖先/相等 ⇒ 无操作的导航目标位于另一操作的写入位之下 ⇒ 每个操作的 prepare 所读 live 状态与「批前 committed 状态」一致（prepare 不写）⇒ 逐操作对批前状态 prepare、随后单事务提交，语义等价于顺序提交且无中间态外泄。同数组多操作被相同路径禁令排除 ⇒ 无下标位移交互；同父 map 不同键写入互不干扰。
- **元素只走局部管线**：`set([])` 禁令（E4）后，元素不可能命中 `isRootReplace`；空路径非 set 元素在 `prepareLocalMutation`/`planMutationBoundary` 以领域 issue 失败进聚合（与单操作 `delete []` 同款行为，零特判）。

### 7.5 决策 D5：单事务按序提交 + 批量感知的逐操作边界验证（F1 修订核心）

`MutationPrepared` 联合新增成员 `{kind:'batch'; items}`；`applyValidatedMutation` 编排：

```
ready = prepareMutation(...)                       // 单操作 → legacy|local；批量 → batch|fail
if ready.kind === 'fail': return {ok:false, issues: ready.issues}
transactGuarded(doc, () => {
  if ready.kind === 'batch': for (it of ready.items) commitPrepared(it.commit)   // 单 Yjs 事务内按序
  else: commitPrepared(ready.commit)
})
if ready.kind === 'legacy': verifyInstall(...); verifySnapshotIntact(...)        // 现状原样
else if ready.kind === 'local': verifyBoundaryIntact(ready.verify)              // 现状原样
else: for (it of ready.items) verifyBoundaryIntact(it.verify)                   // 逐操作按序（0026 L34）；
                                                                                // it.verify.proposedBoundary 已在阶段 C 组合
return {ok:true}
```

#### 7.5.1 提交面（与 iteration 0 相同，零变化）

- **单事务 = 单 update 事件**：一个 `transactGuarded`（一次 `doc.transact`）内 N 个最小 edit → 恰一条 owned update bytes（B1/R1/R3 断言；D-B 首-赋值捕获窗口天然取该条）。
- **观察者原子可见**：update 事件时刻全部操作已生效（B1 observed 断言）。
- **最小 edit 保持**：`commitPrepared` 逐项执行现役最小 edit（父 map 单键 set/delete、目标数组局部 insert/delete-range）；无容器重建（B4 载体身份 + update 体量断言）。
- **`assertOutermostTransactionContext`** 保持为函数首行——批量同样只允许在写槽外层事务上下文调用（namespace 写槽 S5 保证）。

#### 7.5.2 验证面修订（F1）：组合期望边界——方案 (a)

**问题**（C4/C14）：`verifyBoundaryIntact` 的安装事实核是操作自身安装位的 O(1) 断言（足迹局部，批量下安全）；**边界重投影核**比较整个边界（`productEqual(structureNode, walked.snapshot, proposedBoundary)`），而 `proposedBoundary` = 批前边界 + 本操作足迹。E5 允许的共享边界兄弟操作写入边界子树时，重投影必然不等 → 伪 E201-C（committed:true → `markWriteFatal` 永久禁写）。受影响种类：`'record'`（Record-键 set/delete）、`'parent'`（delete 的父 map 位）、`'union'`（union 穿越写）；`'target'`/`'array'` 的边界即操作自身写入位，结构性免疫（引理 3）。

**决策**：批量分支在**全部逐操作 prepare 成功之后、单事务之前**（阶段 C，槽内、零写入前提不变）为每个 item 组合期望边界——把同批中写入位落在该 item 边界子树内的其他操作的足迹（按 ops 序）合并进该 item 的 `proposedBoundary`，然后按原编排调用**未改动**的 `verifyBoundaryIntact`：

```
// 阶段 C（prepareMutation 批量分支内，prepare 全成功后；处于既有 try/catch 内）
plans = [for each i: planMutationBoundary(derived, m[i].path, m[i].op)]   // 纯函数复跑（C11/C12：零 base 读、
                                                                          // 零 doc 状态；与 prepare 内部同输入同结果）
compIssues: MutationIssue[] = []
for i in 0..k-1:
  if plans[i].kind !== 'ok': compIssues.push(...plans[i].result.issues); continue   // 结构性不可达（同输入确定性纯函数复跑，prepare 已过同款规划）；
                                                                                    // fail-closed 归入组合失败聚合
  composed = items[i].verify.proposedBoundary
  for j in 0..k-1, j ≠ i:
    if isStrictPrefix(plans[i].plan.prefix, m[j].path):          // op_j 写位落在 boundary_i 子树内（引理 2/3）
      rel = m[j].path.slice(plans[i].plan.prefix.length)          // 边界内相对段（set/delete 终键或 array-* 数组位）
      synth = { prefix: plans[i].plan.prefix, relPath: rel,
                node: plans[i].plan.node, kind: plans[i].plan.kind }   // 合成 plan：applyMutationAtBoundary 只消费
                                                                       // relPath/prefix/node（C13），kind 不参与逻辑
      applied = applyMutationAtBoundary(derived, synth, composed, payloadOf(m[j]))
      if (!applied.ok): compIssues.push(...applied.result.issues); continue outer-for-i   // 可达的保守收口（union 成员 any-of 重叠——引理 4'/C17）；
                                                                                          // fail-closed：零写入聚合拒绝
      composed = applied.proposedBoundary
  items[i].verify = { ...items[i].verify, proposedBoundary: composed }
if compIssues.length > 0: return {kind:'fail', issues: compIssues}    // 整体零写入（事务尚未开启）
```

- **`payloadOf(m)`** 与 `mutation-local.ts` 各 case 的构造逐字同款：`set → {op:'set', value}`；`delete → {op:'delete'}`；`array-insert → {op:'array-insert', index, values}`；`array-delete → {op:'array-delete', index, count}`（`mutation-local.ts` L264–266、L307–309、L358–365）。
- **`isStrictPrefix(prefix, path)`**：`prefix.length < path.length && prefix.every((seg, i) => seg === path[i])`——段严格 `===`（string/number），与 E5 同一比较器族。**统一折迭、无种类分支**：`'target'`/`'array'` 种类在该谓词下天然零匹配（引理 3），无需特判；实现仍可按引理 3 跳过以省 plan 复跑，语义等价。
- **只改期望值，不改实际侧与比较器**：`verifyBoundaryIntact` 的实际侧来源（`boundaryLive` 引用提交后重读 / `facts.parent.get(key)` 重读）与 `productEqual` 比较器逐字节不变；`verify` 输入的其余字段（`derived`/`structureNode`/`boundaryLive`/`facts`）原样。`install-verify.ts`、`mutation-local.ts`、`packages/vfsl/**` **零改动**（§11 DENY 保持——SA2 F1 修订要求「优先在 mutation.ts 批量分支组合期望边界」，本方案完全封闭在 mutation.ts）。
- **plan 复跑的代价**：每元素一次 `planMutationBoundary`（纯结构游走，O(path)；与 prepare 内部已跑的规划重复）。零接口变化的代价——扩展 `LocalPreparedResult` 携带 plan 需改 `mutation-local.ts`（DENY，备选 I 否决）。
- **验证次序与 fatal 语义（不变）**：事务后按 ops 顺序验证；任一操作**真实**偏离 → E201-C（committed:true、不回滚、不补偿，后续操作验证不再执行）；验证无法运行 → E201-D。组合期望边界使 E201-C **只对真实提交后偏离（observer 干扰/安装缺陷）触发**——恢复 0007 #237 §5「E201-C 保留给真实提交后偏离」的冻结语义；fatal 通道零变化。
- **组合失败的失败语义（fail-closed；可达的保守收口——F6 更正）**：阶段 C 的任何非 throw 失败 → 按聚合语义返回 `{ok:false, issues}`（零写入、无 fatal、无部分写）。两个子分支可达性不同：**plan 复跑 !ok 结构性不可达**（`planMutationBoundary` 是同输入确定性纯函数、prepare 已以同参通过同款规划；保留该收口纯为防御）；**合成应用返回 issues 可达**——构造类为 union 成员 any-of 重叠（C17 + 引理 4' + C18）：非判别联合**镜像成员** `u: { x?: number; label?: number } | { label?: string; x?: string }`（两成员同键集 `{x,label}`、对同键声明互斥值域——**同键集是 C18 空值仲裁前提的要求**）、基态 `{}`，批量 `{set ['u','x']=5, set ['u','label']='L'}` 两操作各自 prepare 均过（各自期望边界 `{x:5}` / `{label:'L'}` 分别命中成员 0/成员 1——同键集下另一成员因对应键值型不匹配而拒；且两终键都在仲裁胜出成员的键空间内，导航可过），阶段 C 折迭后整体边界 `{x:5,label:'L'}` 成员 0 拒 `label:'L'` 值型、成员 1 拒 `x:5` 值型 ⇒ **无成员可容** ⇒ compIssues。（iteration 2 曾以键集不相交的字面 `u: { x?: number } | { label?: string }` 表述该构造类——该字面在 HEAD **不可执行**：空值仲裁恒选成员 0，`set ['u','label']` 单操作即 E204 fatal、`expectEachOpLegalAlone` 前置无法通过，C18；本版已回写为与落地测试一致的镜像成员构造——SA3 Deviations §1 / SA4 §12 观察 1 / SA8 Required action 1，操作与断言零变化。）该拒绝是**正确且必需**的保守收口：提交将产生 schema 非法文档，且顺序单操作语义下第二操作同样会被拒（批量原子语义 ⊆ 顺序组合语义）——**不引入新 fatal 触发面**（SA8「无新增 fatal 触发点」）。阶段 C 内的意外 throw 穿出至 `prepareMutation` 既有 catch → E205 返回（§7.6，与批量其余阶段同款）。

#### 7.5.3 正确性依据（引理 1–4 与适用域引理 4'；E5 通过的存活批量为前提）

- **引理 1（足迹互斥）**：E5 禁「祖先-后代或相同」路径 ⇒ 任意两操作的**写入位**两两不嵌套。set/delete 的写入位 = 其 path 终键位（值槽在 path 处）；array-* 的写入位 = path 处数组对象的元素区间。任何「op_j 写入位包含/重叠 op_i 写入位」都蕴含 `path_i ⊑ path_j` 或 `path_j ⊑ path_i`（树的路径唯一性）→ E5 已拒。
- **引理 2（边界包含判定）**：对存活批量中 j ≠ i：**op_j 写入位落在 boundary_i 子树内 ⟺ `plan_i.prefix` ⊊ `path_j`（严格前缀）**。「⇐」：boundary 值 = prefix 位值，其子树即所有 prefix 延伸路径上的槽；`plan_i.prefix ⊊ path_j` ⇒ 写入位在内。「⇒」：写入位在内 ⇒ `plan_i.prefix ⊑ path_j`；若相等或 `plan_i.prefix ⊋ path_j`，结合 `plan_i.prefix ⊑ path_i` 得 `path_j ⊑ path_i`（含相等）→ E5 已拒，矛盾。
- **引理 3（target/array 免疫）**：kind `'target'`/`'array'` 的 `plan.prefix === path_i` ⇒ 由引理 1，无 j 使 `path_i ⊊ path_j` ⇒ 折迭零匹配、`proposedBoundary` 原样即为正确的提交后期望。故 B1/B2/B5/B7/R1/R3 现有契约形态（target-Kind set / 边界独占 delete）在组合逻辑下行为与 iteration 0 描述一致。
- **引理 4（组合等价）**：`applyMutationAtBoundary(derived, synth_j, base, payload_j)` 是与 op_j 自身 prepare 完全同域规则的纯函数应用；由引理 1（足迹互斥），对任一 op_j 的应用而言 base 中其写入位处的状态 = 批前状态（无先前折迭触碰过该槽；先前折迭只写互斥槽，`rebuildAlong` 浅 spread 拷贝不触碰其余键）⇒ 应用结果与 op_j 自身 prepare 的重建在其槽上逐值相等 ⇒ 期望边界 = 批前边界 + 全部包含足迹（任意折迭次序同果）= 单事务提交后的 live 边界重投影值。数组成员仲裁稳定性：全部折迭均作用于同一 pre-batch live 成员值内的互斥槽（成员切换式写入会在自身 prepare 被 `validateSubtree` 拒绝），合成后仍匹配原成员；若例外发生，阶段 C 的 `validateSubtree`（`applyMutationAtBoundary` 内含）会以 issues fail-closed，不会产生伪通过。
- **引理 4'（适用域更正，F6）**：引理 4 建立的是**槽级等价**（折迭结果在互斥槽上与 op_j 自身 prepare 的重建逐值相等、任意次序同果）；它**不蕴含整边界 schema 可容性**——逐操作可容性只保证「批前边界 + 单一足迹」各自由某个 union 成员（或各自边界节点）容忍，不保证「批前边界 + 全部包含足迹」仍被任一成员容忍。union 成员 any-of 重叠（C17 构造类：非判别联合、成员对同一键集声明互斥值域——镜像成员形态，满足 C18 空值仲裁前提）下，组合边界可无成员可容 ⇒ 阶段 C 内嵌 `validateSubtree`（`applyMutationAtBoundary` 经 `plan.node`）以 issues fail-closed。因此「合成应用返回 issues」是**可达的保守收口**，不是理论不可达分支（SA2 F6 更正；负向守卫 S8 锚定）。引理 4 末句的「若例外发生……不会产生伪通过」据此收窄理解为：成员仲裁例外与整边界不可容同走该 fail-closed 收口。**实现面推论（SA3 禁事项）**：不得把阶段 C 的整体校验当死代码删除或弱化——删除后 union 重叠批量将以 `ok:true` 提交 schema 非法文档（S8 红），弱化为只校验足迹位则退化为备选 H 的漏检面。

#### 7.5.4 与单操作形态的关系

单操作分支（`legacy`/`local`）不经过阶段 C（其 `prepareMutation` 返回值不含 batch 成员）——单操作路径字符级不变（AC5）。批量 item 的组合只发生在 `{kind:'batch'}` 编排内；`verifyBoundaryIntact` 对单操作调用点的输入构造零变化。

### 7.6 错误域汇总（F3 更正：E205 为返回值，非 throw）

| 失败面 | 触发 | 返回/抛出 | 写入 | 码 | 契约锚 |
|---|---|---|---|---|---|
| 形状错误 | E1–E5（双形态、ops 非法、元素非完整信封/未知键/guard、`set([])` 元素、嵌套、超上限） | **返回** `{ok:false, issues:[单条]}` | 零 | 无 | B5/B6/B7/B8、R4（stage validation、`code===undefined`） |
| 操作失败 | 阶段 P 任一/多元素 prepare 失败 | **返回** `{ok:false, issues:[聚合，按 ops 顺序]}` | 零（事务前裁决） | 无 | B3、R2（R9 同源透传） |
| 组合失败（fail-closed，可达的保守收口——F6 更正） | 阶段 C plan 复跑失败（**结构性不可达**：同输入确定性纯函数复跑）/ 合成应用返回 issues（**可达**：union 成员 any-of 重叠——引理 4'/C17/C18（镜像成员构造）；提交即 schema 非法文档，顺序单操作语义下第二操作同拒——第二操作单发时其期望边界已含第一操作足迹，同样无成员可容） | **返回** `{ok:false, issues:[聚合]}` | 零（事务前） | 无 | **S8 组合失败负向守卫（§12.1 文件 A：ok:false、issues ≥1、字节不变、无 fatal、后续单操作仍 ok）** |
| fatal（throw `DocRuntimeFatalError`，经写槽转 `RuntimeWriteFatalError`） | **E201-C/D**（逐操作验证：真实提交后偏离/防线未能运行——组合期望边界后 C 只对真实偏离触发）、**E203**（事务栈异常）、**E204**（prepare 期不变量，`pre-commit-internal`） | **throw**（fatal phase 联合恰三值：`'observer-cleanup-throw' \| 'post-commit-verification' \| 'pre-commit-internal'`，fatal.ts L12–15） | committed 事实随 phase | 既有码族（message 内码字） | 既有 fatal 套件（本票零新增触发设计） |
| **E205（非 fatal）** | prepare 期意外异常（含批量分支任何阶段的意外 throw：解析/校验/prepare 循环/阶段 C） | **返回** `{ok:false, issues:[单条 'DOCRT-E205: …' 前缀 message]}`（mutation.ts L117–127 既有 catch；path `[]`） | 零 | 无（message 前缀，非稳定码字段） | 既有行为（单操作同款；批量循环继承同一 catch，零新通道） |

不可重试性沿现役语义：形状错误、操作失败、组合失败均为调用方修正输入后重新发起的普通领域拒绝；fatal 永久禁写、读保留（0008 L85–93）。**SA3 不得为 E205 制造 throw 通道**（F3：iteration 0 表格「E205 …throw」失真已更正）。

### 7.7 决策 D6：namespace-runtime 与诊断面零改动

- `write.ts` / `runtime.ts` / `diagnostic.ts` / `namespace-diagnostic-log`：**零改动**。依据：S3 对整个 `{ops}` 一次快照（C5，R6/R7 锚）；S5 信封透传（C1）；R9 `diagValidation` 对聚合 issues 同一数组引用透传（0011「issues 顺序保留」）；一槽一记录与槽外 emission 由槽机械保证（C6）；`MutateDataResult.issues` 已是 `unknown[]`（兼容 `MutationIssue[]` 双侧赋值，write.ts L72–80 现注）。
- 形状错误与操作失败在诊断面同落 stage `validation` / result `rejected` / 无 code——因批量解析保持在 S5 槽内位置（未前移到接纳层或 S3），SA6 §15 第 3 行的「若 SA1 改变位置须回写契约」条件**不触发**，R4 断言原样成立。
- 聚合 issues ≥2 条进入同一 attempt record 的 issues 载荷（SA8 required action 4 同款要求；C15：memory log `issuesPolicy` 默认 `'full'` → rejected record `issues` 含聚合序列——NS-2 断言落点，F4）。

### 7.8 决策 D7：公共类型名目与守卫登记

`mutation.ts` 新增（紧邻 `ValidatedMutation`），经 `src/index.ts` 导出：

```ts
/** ADR 0026 批量信封（形态二）。运行时约束：ops 非空、≤16、元素为完整单操作信封、
 *  元素不得携带 guard、批内路径互不嵌套——类型面不承载基数/嵌套约束，运行时校验为权威。 */
export type BatchedMutation = { ops: readonly ValidatedMutation[] };

/** ADR 0026 双形态信封联合：单操作对象（现役契约）或批量信封；两形态互斥（同现为形状错误）。 */
export type MutationEnvelope = ValidatedMutation | BatchedMutation;
```

- 类型**只有这两个**新增名目；`MAX_BATCH_OPS` 常量与解析内部件不导出（词表演进须过设计评审，0026 开放问题 1——导出常量会把它变成公共面承诺）。
- `applyValidatedMutation` 参数类型保持 `ValidatedMutation | unknown` 不动（`unknown` 已吸收联合；最小编辑、零 typecheck 涟漪；`MutationEnvelope` 服务宿主 adapter 定型）。
- `mutateData(mutation: unknown)` 不变（runtime 校验为权威，S3 拒绝非 plain data）。
- 守卫登记（SA3 落实）：`public-surface-type-guard.test-d.ts` 增正例 import + `expectTypeOf` 投影（`batch.ops` 元素可赋 `ValidatedMutation`）；增 `@ts-expect-error` 负例：①双形态字面量（`{op:'set', path:[], value:1, ops:[...]}` 超 `BatchedMutation` 属性集 → TS2353）；②元素携带 `guard` 键字面量；③字符串值不可赋 `MutationEnvelope`。运行期 fail-closed 负例已由 B5/B6/B7 承担（SA8「编译期或运行期」二分 satisfied）。值面守卫测试（`applyValidatedMutation` 恰一值导出）不动。

### 7.9 主要备选方案与不选原因

| 备选 | 不选原因 |
|---|---|
| A. 批量编排放 namespace-runtime（拆 N 次单操作 + 外层事务） | 事务所有权属 doc-runtime（`assertOutermostTransactionContext` + `transactGuarded` exact identity）；namespace 层不得触 live Y.Doc（AGENTS 边界）；聚合/解析逻辑将第二实现 |
| B. `set([])` 元素放行走 legacy 管线（B8 闭口 A） | §7.2 全文：第二全量形态、批量管线混入 clear+重装破坏 prepare 独立性、能力零增益 |
| C. 逐操作各自开事务 + 补偿回滚 | 违反零写入/禁 write-then-undo（0007 #237 §5）与单条 update 诊断（0014） |
| D. 嵌套检查延后到 prepare/提交期 | ADR 0026 L30 明文「信封解析期直接拒绝为形状错误」 |
| E. 聚合扩展到形状错误（多个形状 issue 并列） | ADR 0026 L40 形状错误属信封校验拒绝（单义、fail-fast）；L41 聚合限定「失败操作的 issues」；混域会改 B6/R4 可观察面且无契约要求 |
| F. 批量专用新槽类型 / 新诊断 operation 词 | 违反冻结面（一槽一尝试、operation 词表封闭；0014 新 operation 须 record schema 版本 + stream generation） |
| **G.（F1 禁用项）扩大 E5 拒绝域——禁共享边界兄弟操作** | **SA2 F1 明文禁止**：违反 ADR 0026 L30 本意（嵌套歧义才是拒绝理由）与 AC1（共享边界兄弟批量是 ADR 背景段示范用例）；过度拒绝合法形态且不修复验证语义（仍是错误验证，只是掩盖触发面） |
| **H.（F1 备选 (b)）足迹受限重投影核——批量 item 只比对操作自身足迹** | 需改 `install-verify.ts` 冻结接缝或新造第二验证器（平行机制）；且**削弱验证强度**——同一 doc 区域批量比单操作少检（单操作检整个边界，足迹受限只检足迹位），observer 对边界内非足迹位的干扰将漏检；方案 (a) 保持整边界验证强度不变 |
| **I. 扩展 `LocalPreparedResult` 携带 plan（免复跑）** | 需改 `mutation-local.ts`（DENY；SA2 F1 要求优先零改动）；复跑是 O(path) 纯函数，代价可忽略 |
| **J. 提交后从 live doc 反推期望边界** | 验证空转（live 对 live 推导值比对，永真）——违背「证明 installed ≡ proposed」的核语义（install-verify.ts L388–390 注释） |

---

## 8. 接口、状态机与数据流

### 8.1 接口变化

| 面 | 变化 |
|---|---|
| `applyValidatedMutation(derived, doc, mutation)` | 签名零变化；行为扩展为接受批量信封（`unknown` 参数面本就容纳） |
| 公共类型 | +`BatchedMutation`、+`MutationEnvelope`（§7.8） |
| `mutateData` / `MutateDataResult` / `DataMutationIssue` | 零变化 |
| vfsl `planMutationBoundary` / `applyMutationAtBoundary` / `MutationBoundaryPlan` / `BoundaryMutationPayload` | 签名零变化；`mutation.ts` 批量分支**新增消费**（阶段 C 复跑规划 + 合成 plan 应用——C12 既有公共导出，非新面） |
| 包内 @internal | `MutationPrepared` +`{kind:'batch'; items}` 成员；单操作解析核抽取为共享函数（消息零变化）；`MAX_BATCH_OPS` 常量；阶段 C 组合函数（包内私有，不导出） |

### 8.2 槽内状态机（S5 内部视角，S1–S4/S6–S7 不变）

```
S5: applyValidatedMutation(derived, doc, frozenEnvelope)
 ├─ assertOutermostTransactionContext
 ├─ 分发：hasOwn('ops') ? 批量 : 单操作（原路径）
 ├─ [批量] E1 顶层键封闭 → E2 基数 → E3 元素解析 → E4 set([]) 禁令 → E5 嵌套
 │         （任一失败 → ok:false 单 issue，零写入，终止）
 ├─ [批量] 结构 root 检查（DerivedInvariantError → E204 fatal）
 ├─ [批量] P 逐元素 prepareLocalMutation（fail → issues 聚合继续）
 │         （存在聚合 issues → ok:false 聚合，零写入，终止）
 ├─ [批量] C 组合验证输入：每元素复跑 planMutationBoundary；对每个 i 以
 │         「plan_i.prefix ⊊ path_j」折迭同批足迹进 items[i].verify.proposedBoundary
 │         （applyMutationAtBoundary 合成 plan 纯应用；失败 → ok:false 聚合，零写入，终止）
 ├─ transactGuarded（单事务）：单操作 1 个 / 批量按序 N 个 commitPrepared
 └─ 提交后验证：legacy → verifyInstall+verifySnapshotIntact；local → verifyBoundaryIntact；
                batch → 逐操作按序 verifyBoundaryIntact（record/parent/union item 的期望边界
                已组合；target/array item 期望边界原样）（真实偏离 → E201-C / 无法运行 → E201-D fatal）
```

### 8.3 数据流路线

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚 |
|---|---|---|---|---|---|---|---|---|
| 1. 信封接纳 | 宿主 `mutateData({ops})`；lifecycle=ready | 无（只入队） | 公共面 `unknown` 原样入 sequencer；非 ready → 停接纳拒绝（零输入访问） | 内存队列 | — | pending Promise | 停接纳 → `RUNTIME_WRITE_DISABLED`/`not-accessed` | R5 |
| 2. S3 快照（跨模块边界：runtime→snapshotter） | 写槽起点 | frozen 深拷贝（一次、整个 `{ops}`） | 递归冻结；class/accessor/symbol/循环 → 拒绝 | 内存（frozen） | S5 唯一 payload 来源 | 快照获胜（排队期改动无效） | `MUTATION_INPUT_NOT_PLAIN_DATA`、零写入 | R6、R7 |
| 3. 逐操作 prepare + 组合（doc-runtime 内） | S5 批量分支 | 无（纯读 + detached 构建） | 每元素：结构边界规划→live 导航→边界提取→重建校验→detached 构造；**阶段 C：每元素复跑规划 + 对包含足迹以合成 plan 纯应用折迭期望边界**（逻辑值内存变换，零 live 读） | 内存（PreparedCommit + 组合后 verify 输入） | live Y.Doc（只读，prepare 期） | 无（未提交） | 元素 fail → 聚合 issues；组合 fail → 聚合 issues（均零写入）；不变量破坏 → E204 fatal（零写入） | B1–B4、B7 前置、R2、**S1–S8** |
| 4. 单事务提交（边界：detached→live Y.Doc） | S5 全成功后 | `transactGuarded` 内按序 N 个最小 edit | detached 值装入既有 live 容器（单键 set/delete、数组局部 insert/delete-range） | Y.Doc（单事务、单 update 事件） | 观察者/`readData` | 全部值原子可见 | 事务栈异常 → E203（committed:true） | B1 observed、B2、B4、R1、**S1–S7/NS-1** |
| 5. 逐操作边界验证（批量感知） | S5 提交后 | 无（只读核） | O(1) 安装事实核（足迹局部）+ O(boundary) 重投影核（**对照组合后期望边界**；target/array 对照原 payload） | — | live Y.Doc | 无（成功静默） | 真实偏离 → E201-C / 无法运行 → E201-D（均 fatal、不回滚）——**共享边界合法批量不再伪触发** | 既有 fatal 套件、**S1–S7/NS-1（无 fatal + 写能力保持）、S8（组合失败不 throw、零写入）** |
| 6. dirty 登记 | S6 同槽 | persistence saveDoc | — | 持久层 | — | 完成信号 | notifier 失败 → fatal committed:true | R1 notifierCalls=1、**NS-1** |
| 7. 诊断 emission（边界：槽释放后） | 公共方法 `.then` | 一条 attempt record | 聚合 issues 同源引用 / 单条 owned update bytes（D-B 首-赋值） | 诊断日志（JSONL/内存） | 重放（baseState + update） | 一尝试一记录 | emitter 故障吞没（不改业务） | R3、R4、**NS-1/NS-2（含 F4 记录面 issues）** |

无复制/wire/持久 schema 面数据流变化（DENY LIST 覆盖）。

---

## 9. 错误、恢复、并发和幂等

- **失败语义**：形状错误（无码、fail-fast、不可重试的领域拒绝）；操作失败（聚合、零写入）；组合失败（聚合、零写入；**可达的保守收口**——union 成员重叠类，§7.5.2/引理 4'，S8 守卫）；E205（返回 `ok:false` 单 issue，零写入）；fatal（既有 throw 通道，永久禁写读保留）。见 §7.6。
- **恢复/重试**：本票不引入重试、补偿、回滚。调用方修正输入后重新发起即新变更尝试（新写槽、新诊断记录）。
- **并发**：写序列器 FIFO 独占不变——批量是**一个**写槽任务，槽内无并发；槽起点快照（S3）后调用方对输入的任何改动无效（R7）。跨实例并发合并面：各操作仍按 Yjs 元素语义合并（0026 L51「跨实例语义不变」），单事务只影响本实例观察原子性。
- **幂等**：与单操作形态同款——`mutateData` 无幂等键；重复发起同一批量是两次变更尝试（各一条记录）。`set` 同值重写是否产生 update 事件由 Yjs 语义决定（本设计不改变）。
- **资源所有权**：detached 构建物、组合期逻辑值与 verify 输入为槽内局部；无新增生命周期所有权（诊断 emitter、notifier、handle 所有权不变）。

---

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| `runRootWriteSlot`（namespace-runtime S5，唯一生产调用点） | `applyValidatedMutation(tools.derived, env.doc, snap.value)`；`!result.ok` → R9 `diagValidation` + 透传 issues；throw → D5 fatal 分类（branded 透传 committed/phase） | 同一代码路径自然承载批量：合法批量（含共享边界形态）→ ok:true + 单 update 捕获；失败 → 聚合 issues 同源透传；**共享边界合法批量不再 throw E201-C**（组合期望边界消除伪触发面） | **零改动** | `write.ts` L180–208；C1/C5；SA2 §9 E201-C 行（F1 修复对象） |
| `runtime.mutateData`（公共方法 + 接纳门 + emission） | `unknown` 透传入队；`.then` emitSlot | 零变化（信封无关） | **零改动** | `runtime.ts` L512–533 |
| 复制 apply 路径（replication-write） | 不经 `applyValidatedMutation`（trusted raw 自有管线） | 不适用（0026 L50 边界） | 零改动 | SA8「范围外条款」行；C11 复核 |
| vfsl `planMutationBoundary`/`applyMutationAtBoundary` | 逐操作纯函数，doc-runtime 消费 | 被批量逐元素复用（prepare 期）+ **阶段 C 复跑/合成应用**（每元素一次规划复跑、每包含足迹一次合成应用，同参形态家族）；「apply 不消费 `plan.kind`」这一跨包行为依赖（C13）由 **S7** 行为锚钉住——parent 边界合成 plan + array-\* 载荷是最先破裂形态（SA2 §9） | **零改动** | `validate-patch.ts` L702–834；C12/C13/C16 |
| 宿主 typed adapter（typed-access 范式） | 组装单操作信封经 `mutateData` | 可组装 `BatchedMutation`（元素值仍经生成 `PathPatchValue` 约束）；存量单操作调用零影响 | 可选采用（无强制迁移） | `.agents/skills/nomicore/typed-access.md` L163–201 |
| doc-runtime 直调测试（既有 341 文件 + 2 契约文件 + 2 新增共享边界文件） | 单操作断言 | N1–N4/R5/R6 锚保持绿；13 红翻绿；**S1–S7/NS-1/NS-2 由红转绿、S8 负向守卫保持绿** | **既有断言零改动**（SA3 改实现不改契约；新用例只进新文件） | SA6 §12–§14；§12.1 |

无未覆盖调用方：`applyValidatedMutation` 生产消费点唯一（grep 复核：write.ts L187）；类型消费点（`ApplyValidatedMutationResult` 导入）签名零变化。

---

## 11. 文件范围

> **iteration 3 增量说明**：本轮（S8 fixture 回写）唯一变更为本设计产物自身（SA8 实现后复审 Required action 1 路由）；下表为实现期范围，原样保持——实现与两新增测试文件已落地并经 SA4 approve / SA8 clear，文件 A 的 S8 已按本版 §12.1 镜像成员构造固化（落地证据：`issue-350-batch-shared-boundary.test.ts` L34/L61/L265–276）。

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/doc-runtime/src/mutation.ts` | 信封分发（D1）、批量校验 E1–E5（D3）、单操作解析核抽取（消息零变化）、`MutationPrepared` +batch 成员、聚合 prepare 循环（D4）、**阶段 C 组合期望边界（D5.2：plan 复跑 + 合成 plan 折迭，含 `payloadOf`/`isStrictPrefix` 包内私有函数）**、单事务按序提交 + 逐操作验证编排（D5）、`MAX_BATCH_OPS` 常量、`BatchedMutation`/`MutationEnvelope` 类型定义、模块头注更新 | 全部批量能力（含 F1 修复）的唯一实现落点（C1–C3、C12–C14） |
| `packages/doc-runtime/src/index.ts` | 导出 `BatchedMutation`、`MutationEnvelope` 两类型 | 公共面纪律（SA8 required action 3；模块 AGENTS「Add public APIs only through src/index.ts」） |
| `packages/doc-runtime/test/public-surface-type-guard.test-d.ts` | 登记两新类型正例 + 双形态/元素 guard/非信封三类 `@ts-expect-error` 负例 | 守卫测试覆盖每个导出（模块 AGENTS；SA8 required action 3） |
| `packages/doc-runtime/test/issue-350-batch-envelope-red.test.ts` | **仅由红转绿，断言零改动**（SA6 契约即行为规格） | 验收落点 B1–B8/N1–N4 |
| `packages/namespace-runtime/test/issue-350-batch-envelope-red.test.ts` | **仅由红转绿，断言零改动** | 验收落点 R1–R7 |
| **`packages/doc-runtime/test/issue-350-batch-shared-boundary.test.ts`（新增文件，F2/F5/F6 落点）** | 新建：S1–S7 共享边界正例（**HEAD 天然红**——`{ops}` 未被识别；S7 = array-\* 载荷折入共享边界，F5）+ **S8 组合失败负向守卫**（HEAD 即绿、实现后须保持绿——判别力在实现期，见 §12.1 红绿依据）+ 文件内单操作负控（规格见 §12.1） | F1/F5 验收：现有 13 红对共享边界交互零敏感（C9/SA2 §12），且 iteration 1 计划用例对 array 折迭零敏感（SA2 F5）；无此文件则 F1 类缺陷将以全绿状态静默上线；S8 防 SA3 把组合失败分支当死代码（F6） |
| **`packages/namespace-runtime/test/issue-350-batch-shared-boundary.test.ts`（新增文件，F2/F5 落点）** | 新建：NS-1 端到端（含 array-\* 元素折入共享边界——F5 端到端建议项；无 fatal/写能力保持）+ NS-2 失败批量记录面 issues 聚合断言（F4；规格见 §12.1；当前 HEAD 天然红） | F1/F5 端到端验收 + SA8 required action 4 记录面半边（SA2 §12 F4 缺口行） |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/namespace-runtime/src/**`（write.ts / runtime.ts / diagnostic.ts / errors.ts / index.ts 等） | 槽机械/公共面/诊断接线 | 设计判定零改动（§7.7）；S1–S7、稳定码、emission 调用点均为冻结面（SA8 frozen surfaces） |
| `packages/namespace-diagnostic-log/**` | 诊断记录契约 | operation/stage/result 词表与 record 形态冻结（0011/0014；新增 operation 须 record schema 版本 + stream generation） |
| **`packages/doc-runtime/src/mutation-local.ts`、`install-verify.ts`** | 被批量复用的逐操作管线（prepare 产物与双核验证） | **F1 修复明确封闭在 mutation.ts 批量分支（SA2 F1 修订要求优先零改动；§7.5.2 方案 (a) 无需触碰）**；改动会波及冻结的单操作行为与 fatal 分类 |
| `packages/doc-runtime/src/detached-build.ts`、`fatal.ts`、`carrier.ts`、`extract.ts`、`resolve.ts`、`tx-guard.ts` | 逐操作管线其余接缝 | 复用即足够（C4/C11）；改动会波及冻结的单操作行为与 fatal 分类（fatal phase 联合冻结——F3 更正依据） |
| `packages/vfsl/src/**` | 边界规划/校验纯函数 | 逐操作语义零变化；阶段 C 消费既有公共导出（C12），无 vfsl 改动需求 |
| `packages/doc-runtime/test/public-surface-guard.test.ts`（值面）及其他既有测试 | 值导出面与既有回归锚 | 无新值导出；既有断言是单操作逐字节不变的锚（SA8 required action 5） |
| `docs/adr/0026-*.md`、`docs/adr/0008-*.md`、`CONTEXT.md`、`.agents/skills/nomicore/typed-access.md` | 决策与词汇文档 | 0026 后果义务已在 `211c5fa` 全部兑现（SA8 Evolution requirements「完整」）；`set([])` 封口属设计层记录（本文 §7.2），词表化留待开放问题复审（§13 残余问题 2） |
| 复制/wire/协议/持久相关全部路径（`docs/protocols/**`、replication-*.ts、persistence 面） | 0026 L50–51 明文不适用 | SA8「范围外条款」；零关联（relevant_decisions §7） |

---

## 12. 验收与验证映射

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1 全合法批量单事务提交/观察者原子可见 | B1 红（能力缺口） | B1（doc-runtime：计数器 + update 事件 + observed 快照） | ok:true、值全落盘、恰 1 本地事务 + 1 update、observed 恰一态（全生效） |
| **AC1′（F1+F5）共享边界合法批量不伪 fatal**（delete+兄弟 set / 双 Record-键 set / 双 Record-键 delete / Record-键 set+兄弟字段 set / union 兄弟对 / 包含精度三操作 / **array-\* 载荷折入 parent 边界**） | **无现有用例（SA2 §12 缺口行；array 折迭形态系 iteration 1 计划矩阵残余缺口——SA2 F5）——S1–S7 在 HEAD 红（`{ops}` 未识别，`ok:false`）** | **S1–S7（§12.1 doc-runtime 新文件；S7 使 `payloadOf` 的 array 分支与 C13 跨包依赖首次在折迭位执行）** | **全部 ok:true、值落盘、恰 1 事务 + 1 update、无 fatal（E201-C 为 throw 通道——断言到达即证）；既有 B/N/R 断言零改动保持** |
| **AC1″（F1 端到端）共享边界批量经公共面无 fatal、写能力保持** | 无现有用例 | **NS-1（§12.1 namespace-runtime 新文件；批量含 array-\* 元素折入共享边界——F5 端到端建议项）** | ok:true、readData 三值（status/reviewer 缺席/notes）、1 update、1 notifier、**后续单操作 mutateData 仍 ok:true（无 `markWriteFatal`）**、批量恰 1 条 committed/update record |
| **组合失败 fail-closed（F6）**：union 成员重叠批量各自合法、组合非法 → 聚合拒绝零写入无 fatal | 无现有用例（iteration 1 §7.6 契约锚悬空——SA2 F6） | **S8（§12.1 文件 A；HEAD 即绿的负向守卫——判别力在实现期：漏实现/弱化阶段 C 整体校验 → `ok:true` 违反断言；误走 throw 通道 → 违反 no-throw；部分写 → 违反字节不变）** | ok:false、issues ≥1、doc 字节不变、0 事务 0 update、无 fatal、**后续单操作仍 ok:true** |
| AC2 失败聚合 + 整体零写入 | B3/R2 红 | B3、R2 | ok:false、issues ≥2 且按 ops 顺序、字节不变、0 事务 0 update、notifier 0 |
| AC3 形状错误零写入无码矩阵 | B5/B6/B7 红、R4 红 | B5（16/空/17）、B6（九类）、B7（兄弟 vs 嵌套/相同）、R4（诊断面） | 全部 ok:false + 零写入；R4：rejected/validation/`code===undefined`/无 effect/capture digest |
| AC3′ `set([])` 元素封口 | B8 decision-neutral | B8（本设计闭口 B）+ SA6 下一轮单向化（follow-up） | 形状错误、零写入、0 事务 0 update、确定性 |
| AC4 跨实体路径原子 | B2/R1 红 | B2（四动词跨 Record/集合）、R1（端到端） | 单事务、全部生效、1 notifier |
| AC5 单操作形态逐字节不变 | N1–N4、R3 前段、R5、R6 绿 | 同上负控保持绿 + 全仓 341 文件零回归 + **S 文件内单操作负控** | 全绿；N3 文案锚原样 |
| AC6 一尝试一条记录/单 update bytes | R3/R4 红 | R3（对照 3 顺序写 3 条；批量第 4 条 committed/update；重放见全部值）、R4 | 恰 1 条 root-mutation/transaction/committed update record |
| AC7 端到端透传 + 停接纳次序 | R1/R5/R7 | R1、R5（close 后 Proxy 零访问）、R7（排队期改动→快照获胜） | 如契约逐条 |
| AC8 typecheck + 相关测试 | SA6 §14 基线 | 根 `pnpm typecheck`；根 `pnpm test`（343+2 文件全绿）；`tsc -p packages/doc-runtime/tsconfig.json` | 13+S 红翻绿、无新增失败、Type Errors no errors |
| 公共面守卫（SA8 action 3） | public-surface-type-guard 现状 | 新类型正例 + 三类编译期负例（vitest `--typecheck`） | 正例可导入、负例 TS2353/TS2322 红 |
| 最小 edit 不降级 | B4 红 | B4（700k 兄弟 + 载体身份 + update < 1000B） | 容器/大字段身份保持、update 缩放 |
| **F4 聚合 issues 进入诊断记录载荷（SA8 required action 4 记录面半边）** | R2/R4 只断言 RESULT issues / 形状错误记录，无记录面聚合断言（SA2 §12 F4 行） | **NS-2（§12.1）：失败批量（≥2 失败操作）→ rejected record `issues` 载荷** | record.stage='validation'、`code===undefined`、`issues.length ≥ 2` 且顺序 = ops 序（memory log `issuesPolicy:'full'` 默认，C15） |
| S3/lifecycle/fatal 冻结面 | R5/R6 绿 + 既有 fatal 套件 | 保持绿（零改动即零回归） | 全绿 |

设计路线 ↔ 可执行验收：每条决策（D1–D7）至少落在上表一行（D1→B6 anchor/AC5；D2→B8；D3→B5/B6/B7/R4；D4→B3/R2/NS-2；**D5 提交半边→B1/B2/B4/R1/R3、D5 验证半边（组合）→S1–S8/NS-1（S7=array 折迭、S8=组合失败 fail-closed）**；D6→R3–R6；D7→守卫/typecheck）。

### 12.1 新增测试文件规格（F2/F5/F6 落点；SA3 按此实现，断言观察行为）

两文件均遵循既有契约纪律（只断言运行时可观察行为——返回值、活动 Y.Doc 值、事务/update 事件、readData、诊断 record 内容；无 skip/only/todo/env override；无源码字符串断言）；默认 vitest glob 收集（`packages/*/test/**/*.test.ts`），零配置改动。**命名说明**：本节 S1–S8 为测试用例 ID，与写槽状态 S1–S7（INV-W2，C5/§7.7）分属两命名空间，按上下文区分。

**文件 A：`packages/doc-runtime/test/issue-350-batch-shared-boundary.test.ts`**（fixture 复用现有契约文件形态——`parseVfsl`/`evaluate`/`materializeRoot`/`countLocalTransactions`/`bytes` 同款，schema 在契约 TEXT 的 `n: number; a: string; values: YArray<number>; …` 基础上扩展；需含 Record、判别联合与非判别联合字段：`tasks: Record<string, { status: string; reviewer?: string; notes?: YArray<string> }>`、`point: { kind: 'a'; x: number; y: number } | { kind: 'b'; label: string }`（判别联合，S5 用）与 `u: { x?: number; label?: number } | { label?: string; x?: string }`（**非判别联合·镜像成员**——成员全内联对象、同键集 `{x,label}` 全可选、无公共非可选字面量字段 ⇒ 无判别式、any-of 全扫描；值须完整匹配单成员，且两成员对同键声明互斥值域（number vs string），C17 + C18，S8 用。**镜像形态是 C18 空值仲裁前提的必然要求**：iteration 2 字面 `u: { x?: number } | { label?: string }`（键集不相交）在 HEAD 不可执行——空 `u` 仲裁恒选成员 0，`set ['u','label']` 单操作即 E204 fatal、`expectEachOpLegalAlone` 前置无法通过；经 SA3 替换 / SA4 源码独立复核 / SA8 裁定 no-conflict（Required action 1）回写为本构造，**操作与断言零变化**——等价性论证见 S8 行）。**基础态钉死**：t1/t2 = `{status:'open', reviewer:'r0', notes:['n0']}`、t3/t4 不存在、`point = {kind:'a',x:1,y:1}`、`u = {}`（两成员全可选字段，物化合法；空值命中成员 0——C18，与落地测试 L61 一致））：

| 用例 | 批量内容（全部先以 `expectEachOpLegalAlone` 同款前置证单操作合法） | 断言 |
|---|---|---|
| S1（SA2 D1 主形态） | `{delete ['tasks','t1','reviewer'], set ['tasks','t1','status']='reviewing'}`（delete=parent 边界 t1 map ⊇ set 写位） | `ok:true`（**不 throw——伪 E201-C 为 throw 通道，断言到达即证无 fatal**）；t1 = `{status:'reviewing', notes:['n0']}`（reviewer 已删、notes 未触碰）；恰 1 本地事务 + 1 update；观察者 update 时刻即见终态 |
| S2 | `{set ['tasks','t3'], set ['tasks','t4']}`（双 Record-键创建共享 record 边界 tasks） | `ok:true`；t3/t4 落盘；1 事务 1 update；无 fatal |
| S3 | `{delete ['tasks','t1'], delete ['tasks','t2']}`（双 Record-键删除共享 record 边界） | `ok:true`；两键不存在；1 事务 1 update；无 fatal |
| S4 | `{set ['tasks','t3'], set ['tasks','t1','status']='held'}`（op1 record 边界包含 op2 写位） | `ok:true`；两效落盘；1 事务 1 update；无 fatal |
| S5 | `{set ['point','x']=2, set ['point','y']=3}`（同 union 位兄弟写，relPath ['x']/['y']） | `ok:true`；point = `{kind:'a',x:2,y:3}`；1 事务 1 update；无 fatal |
| S6（包含谓词精度） | `{delete ['tasks','t1','reviewer'], set ['tasks','t1','status'], array-insert ['tasks','t2','notes'] index 1 values ['n1']}`（op3 写位不在 t1 边界内——组合不得误吸收） | `ok:true`；三效落盘（notes=['n0','n1']）；1 事务 1 update；无 fatal |
| **S7（F5：array-\* 载荷折入共享边界）** | `{delete ['tasks','t1','reviewer'], array-insert ['tasks','t1','notes'] index 1 values ['n1']}`（E5 兄弟合法；op1 parent 边界 t1 map ⊇ op2 写位 ⇒ 阶段 C 必须对 array 载荷折迭——`payloadOf` 的 array-insert 分支 + 合成 plan 走 `applyMutationAtBoundary` array 分支非空 relPath，C16；同时钉住「apply 不消费 `plan.kind`」跨包依赖，C13） | `ok:true`（**不 throw**）；t1 = `{status:'open', notes:['n0','n1']}`（reviewer 已删、status 未触碰）；恰 1 本地事务 + 1 update；无 fatal |
| **S8（F6：组合失败负向守卫）** | `{set ['u','x']=5, set ['u','label']='L'}`（**操作与 iteration 2 逐字相同**；非判别联合**镜像成员**重叠：两操作**各自单独合法**——期望边界 `{x:5}` / `{label:'L'}` 分别命中成员 0 `{x?: number; label?: number}`（`x:number` 容纳、`label` 缺席可选）与成员 1 `{label?: string; x?: string}`（`label:string` 容纳、`x` 缺席可选）；同键集保证两终键在空值仲裁胜出成员（恒成员 0，C18）的键空间内均可导航——**这是镜像形态相对 iteration 2 字面 fixture（`{x?} \| {label?}` 键集不相交：`set ['u','label']` 单操作即 E204 fatal、前置不可过——SA3 probe 逐字留证）的唯一差异，操作与断言零变化**；值域互斥使折迭后整体边界 `{x:5,label:'L'}` **无成员可容**（成员 0 拒 `label:'L'` 值型、成员 1 拒 `x:5` 值型），C17/引理 4'/C18） | `ok:false` 且 issues ≥1（**不 throw**——组合失败是返回值非 fatal）；doc 字节不变；0 事务 0 update；**随后单操作 `set ['n']=2` 仍 `ok:true`**（写能力保持——无 `markWriteFatal`）——**断言列与 iteration 2 逐字相同**（落地：测试 L278–301） |
| 负控（文件内） | S1 与 S7 批量的单操作等价逐个执行；S1 批量在双 fixture 上重复执行 | 单操作路径行为不变（组合不外溢）；结果确定性 |

**文件 B：`packages/namespace-runtime/test/issue-350-batch-shared-boundary.test.ts`**（fixture 复用现有契约 setup/readOk/waitAttempts 同款——新文件自有 fixture，在契约 schema 基础上把 tasks 条目扩为 `{ status: string; reviewer?: string; notes?: YArray<string> }`、t1 基态含 `notes:['n0']`（不动契约文件本身）；bounded memory log `inputPolicy:'digest', updateCapture:true`——`issuesPolicy` 默认 `'full'`）：

| 用例 | 场景 | 断言 |
|---|---|---|
| NS-1 | `mutateData({ops:[delete ['tasks','t1','reviewer'], set ['tasks','t1','status']='reviewing', array-insert ['tasks','t1','notes'] index 1 values ['n1']]})`（第三元素 = array-\* 载荷折入共享 parent 边界——**F5 端到端建议项**，SA2 §13 F5） | `toEqual({ok:true})`；readData 见 `status='reviewing'`、`reviewer` 缺席、`notes=['n0','n1']`；恰 1 update 事件；notifierCalls=1；**随后单操作 `mutateData({op:'set',path:['n'],value:9})` 仍 `{ok:true}`**（写能力保持——证明无 `markWriteFatal`）；诊断恰 1 条 committed/effect=update record（第 2 条为后续单操作） |
| NS-2（F4） | `mutateData({ops:[set ['n']='bad', set ['a']='y', set ['tasks','t1','status']=5]})`（两失败夹一合法） | result `ok:false` 且 issues ≥2 按 ops 序（R2 同族）；**rejected record：stage='validation'、`code===undefined`、`issues` 载荷 ≥2 条且顺序 = ops 序**；doc 字节不变、0 update、notifier 0 |

**红→绿依据（F2/F5 验收条件）**：两文件**正例**断言（S1–S7 的 `ok:true` / NS-1 committed / NS-2 issues ≥2）——当前 HEAD `{ops}` 未被识别（`ok:false` 单 issue / rejected 单 issue）→ **天然红**；实现（含 F1 组合 + F5 array 折迭）落地后转绿。**S8 为负向守卫、HEAD 即绿**（现状整体拒绝零写入恰为保守收口的超集；镜像 fixture 下 `expectEachOpLegalAlone` 前置在 HEAD 同样可过——两单操作各 `ok:true`，C18）——其判别力在实现落地时：漏实现/弱化阶段 C 整体校验（含把组合失败分支当死代码删除）→ 该批量 `ok:true` 违反断言；组合失败误走 throw 通道（fatal 或 E205 化）→ 违反 no-throw；部分写 → 违反字节不变。不以 SA6 契约增补轮为完成前置（落点选择：新增文件，SA2 F2 二选一中的方案一）；SA6 后续轮可自愿把 S/NS 吸收为契约用例（follow-up，§13.2）。

---

## 13. 风险、回滚和残余问题

| 风险 | 等级 | 缓解 | 回滚条件 |
|---|---|---|---|
| 单操作路径被分发逻辑扰动（文案/次序漂移） | 高影响、低概率 | `hasOwn('ops')===false` 分支保持原代码字符级不动；N1–N4 + 全仓回归锚 + S 文件内单操作负控 | 任一负控/既有测试红即回滚实现分支 |
| 聚合误收编 fatal（DerivedInvariantError 被当领域失败） | 高影响、低概率 | §7.4 明文：聚合只收 `{kind:'fail'}`；throw 穿出经既有 catch 分类 E204/E205 | fatal 契约套件红即回滚 |
| **同批操作交互（prepare/commit/verify 三面）**：容器脱链、下标位移、**共享边界伪 E201-C**（含 array-\* 载荷折迭位） | 高影响、低概率（组合后） | prepare/commit：非嵌套 + 相同路径禁令结构性排除（§7.4 引理）；**verify：阶段 C 组合期望边界（§7.5.2 引理 4）使重投影核只对真实偏离触发**（array 载荷折迭由 S7 锚定，C16）；`set([])` 禁令排除根替换 | B1–B4/R1 或 **S1–S7/NS-1 任一红**（ok:false / throw / 值错）即回滚实现分支 |
| **组合期望边界构造错误**（漏吸收某包含足迹 → 伪 E201-C 残留；误吸收非包含足迹 → 期望值偏离） | 高影响、低概率 | 引理 2 严格前缀谓词 + 引理 4 等价论证；S1–S7 逐形态锚定（S6 专测包含谓词精度、S7 专测 array 载荷折迭与 C13 跨包依赖）；组合失败 fail-closed 聚合（无 fatal、无部分写——S8 负向守卫，防死代码化） | S1–S7/NS-1 任一红即回滚；S8 红（ok:true / throw / 字节变）即回滚；组合失败路径误收 fatal 套件红即回滚 |
| 诊断多记录/缺记录 | 中影响、低概率 | 槽机械零改动；R3/R4/NS-1 计数锚 | R3/R4/NS-1 红即回滚 |
| 新消息词表与既有断言意外冲突 | 低影响、低概率 | 仅新形态新消息；冻结文案（N3、`RUNTIME_WRITE_DISABLED` 等）不触 | 对应测试红即修正消息词 |
| 性能（prepare 串行 ×16 + 阶段 C） | 低 | 每元素 O(boundary) prepare；阶段 C：≤ k²=240 次段 `===` 前缀判定 + 每包含足迹一次 `applyMutationAtBoundary`（`rebuildAlong` 浅 spread 拷贝沿 relPath 脊柱，无全集深拷贝；含 `validateSubtree` 整边界校验，与单操作 prepare 同复杂度族）；k≤16；B4 体量锚（700k 字段为叶值按引用传递） | — |

**任务内解决项**：全部设计决策已闭口（含 F1–F6 修订），无待定必要条件。

**残余问题 / follow-up（不阻塞本任务）**：

1. SA6 下一轮把 B8 升级为闭口 B 单向断言（SA6 §15 明文约定）；可顺带把 S1–S8/NS-1/NS-2 吸收为契约用例（§12.1 落点为新增文件，不依赖本轮）——**吸收 S8 时须按本版 §12.1 镜像成员构造固化**（iteration 2 字面构造在 HEAD 不可执行，C18；SA3 Deviations §1 待办同款要求）。
2. `set([])` 元素禁令的词表化（写入 ADR 0026 修订节或 CONTEXT 词条注记；同步在 typed-access.md 批量节补一句元素禁 `set([])`——SA2 非阻断观察 1）——建议随开放问题 1/2 复审一并处理；本任务以设计产物 + SA8 设计后复审为记录载体。
3. ADR 0025 guard 叠加（#347–#349）：顶层 `{ops, guard}` 评估先于逐操作 prepare；届时 `BatchedMutation` 类型增可选 `guard` 字段（本票类型面已留出：顶层键封闭仅允许 `ops`，guard 落地时同步扩展 E1 与类型）。
4. `ops` 上限/嵌套放宽（0026 开放问题 1/2）：须独立决策，非本票。**注意**：若未来放宽嵌套（开放问题 2），阶段 C 的严格前缀折迭不再充分（嵌套足迹需有序重放语义），须随该决策重设计验证组合——在 ADR 修订时同步评估。

---

## 14. 评审修订映射

评审输入：`wiki/raw/task_issue-350_sa2_review.md`（iteration 1，verdict reject：F5 MAJOR / F6 MINOR）。逐条处理：

| Finding | 修订位置 | 处理结果 |
|---|---|---|
| **F5（MAJOR）**：iteration 1 计划验收矩阵遗漏唯一未覆盖的折迭形态——array-\* 载荷折入共享 record/parent/union 边界（`payloadOf` 的 array 分支在一切计划折迭中从未执行）；实现误差（`payloadOf` 遗漏 array 分支 / 误读引理 3 对 array-kind op_j 跳过折迭）将使该合法批量伪 E201-C（永久禁写）或被误拒（AC1/AC4 违反），且 C13 跨包行为依赖（apply 不消费 `plan.kind`）无行为锚 | **§12.1 文件 A 新增 S7**：`{delete ['tasks','t1','reviewer'], array-insert ['tasks','t1','notes'] index 1 values ['n1']}`，`expectEachOpLegalAlone` 前置，断言 `ok:true`、t1=`{status:'open',notes:['n0','n1']}`、恰 1 事务 + 1 update、无 fatal；**§12.1 文件 B NS-1 拓展**第三元素 `array-insert ['tasks','t1','notes']`（端到端——SA2 建议项，采纳）；§2 **C16**（array 分支合成 plan 结构合法 + union 位 array-\* 现役先例锚点）；§5 承接表新增 SA2 F5/F6 行；§1 目标 3/9；§3 缺口 4；§10 vfsl 行（S7 钉住 C13）；§11 文件 A/B 行；§12 AC1′/AC1″ 行与决策映射；§13 风险两行；§8.3 路线 3/4/5 锚 | **已落实**：S7 在 HEAD 红（`{ops}` 未识别）、实现后绿；fixture 已含 `notes?: YArray<string>`（基础态钉死 `['n0']`——S1 期望值相应补 `notes:['n0']` 字段：修正 iteration 1「fixture 含 notes 而期望值缺省」的潜在不一致；文件尚不存在，非既有文件断言改动），零额外构造成本；既有 B/N/R 契约断言零改动、S2–S6/NS-2 规格原样；E5 拒绝域不变（B7 兄弟 anchor 保持，S7 路径为 E5 合法兄弟） |
| **F6（MINOR）**：组合失败分支标注「理论不可达」失真——union 成员 any-of 重叠构造类可证伪（各自合法、组合无成员可容），且 §7.5.3 引理 4 推论在整边界可容性上不完整；§7.6 该行契约锚「S 用例族负向兜底（§12.1）」悬空（§12.1 无组合失败负向用例）；失真会诱导 SA3 把该分支当死代码弱化/漏实现 | **§7.5.2** 伪代码两处注释（plan 复跑 = 结构性不可达并给出依据；合成应用 = 可达的保守收口）与「组合失败的失败语义」bullet 整体重写（子分支可达性二分 + 非判别联合构造类 + 顺序语义等价论证）；**§7.5.3 新增引理 4'**（槽级等价不被整边界可容性蕴含 + SA3 禁事项：不得删/弱化阶段 C 整体校验）；**§7.6 组合失败行**更名「可达的保守收口」、触发面分列、契约锚改指真实落点 S8；§9 失败语义；**§12 新增「组合失败 fail-closed（F6）」行 + §12.1 文件 A 新增 S8 负向守卫**（SA2 建议项，采纳——使锚与实际用例一致且防死代码化）；§2 **C17**（可达性构造的源码依据） | **已落实**：设计全文不再含组合失败整分支的「理论不可达」断言（仅 plan 复跑子分支保留「结构性不可达」且给出确定性纯函数依据）；§7.6 契约锚指向 §12.1 真实用例 S8；S8 断言 `ok:false`、issues ≥1、字节不变、无 fatal、后续单操作仍 ok——HEAD 即绿（负向守卫，判别力在实现期，见 §12.1 红绿依据） |

**iteration 0/1 finding 处置记录（SA2 iteration 1 §13 复核核实，不再阻断，此处存目）**：F1（BLOCKER）→ §7.5.2 组合期望边界（方案 (a)），经 SA2 §8 验证记录 1–9 独立复核成立，**保持不变**；F2（MAJOR）→ 两新增 ALLOW 文件 + §12.1 规格，实质解决、残余形态缺口析出为本轮 F5；F3（MINOR）→ E205 返回值描述，已解决，保持；F4（MINOR）→ NS-2 记录面断言，已解决，保持。本版未回退上述任何修订（组合期望边界方案 (a)、E5 拒绝域不扩大、mutation-local.ts/install-verify.ts/vfsl 零改动均原样保留）。

SA2 iteration 1 非阻断观察的处理：观察 1（方案 (a) 选型质量）→ 无修订需求；观察 2（S7 兼钉 C13 跨包依赖）→ §10 vfsl 行与 §12.1 S7 行明示；观察 3（ROOT 级折迭与 S2/S3 同机械，不另立用例）→ 维持；观察 4（组合方案质量）→ 无修订需求；观察 5（F5/F6 不触碰 ADR 条款边界、SA2 不额外要求冲突复查）→ §15 理由 6 引用；观察 6（嵌套放宽前瞻）→ §13 残余问题 4 原样保留；观察 7（性能面）→ §13 性能行已含阶段 C，无增量。

### 14.1 iteration 3 回写映射（实现后证据调和：S8 union fixture）

输入非 SA2 新评审轮，而是实现链路对**同一事项**的三源记录（SA3 唯一偏差 / SA4 非阻断观察 1 + approve / SA8 实现后复审 Required action 1 + no-conflict 裁定）。逐条落实：

| 来源 finding | 修订位置 | 处理结果 |
|---|---|---|
| **SA3 Deviations §1**：设计 §12.1 S8 字面 fixture `u: { x?: number } \| { label?: string }` 不可执行——空 `u` 仲裁恒选成员 0，`set ['u','label']` 单操作即 E204 fatal，`expectEachOpLegalAlone` 前置不成立；已按语义等价镜像成员构造替换（ops/断言逐字不变、构造类相同），待设计回写 | §12.1 文件 A fixture 段与 S8 行（镜像成员构造 + 等价性论证 + 「唯一差异」声明）；§2 新增 **C18**（仲裁根因，源码锚点独立复核）；§7.5.2/§7.5.3/§7.6 构造类表述；§13 残余问题 1；本节 | **已落实**：设计文本与落地测试（L34/L61/L265–276/L278–301）字面一致；操作 `{set ['u','x']=5, set ['u','label']='L'}` 与断言（ok:false / issues ≥1 / 字节不变 / 0 事务 0 update / 无 fatal / 后续单操作 ok）逐字保持；**不改实现与测试** |
| **SA4 §12 观察 1**（其 §2/§4/§9 交叉引用）：对源码独立复核确认根因链（`walkUnion` trialMember 软接受 + 首个接受者胜；写侧 `resolveNode` 逻辑值等值仲裁恒选成员 0；`childNodeOf` 抛 DerivedInvariantError → E204；属 DENY 路径既有语义、非本 diff 引入）；替换「ops 与断言语义逐字不变、构造类相同」**成立且必要**；路由 SA1/design 回写 | 同上（C18 锚点经本设计独立复核一致：`extract.ts` L160–175/L187–219、`mutation.ts` L465–481/L508–522/L161–165、`mutation-local.ts` L349–374） | **已落实**：根因链以本文自有源码锚点复核后写入 C18（非转述）；「既有语义、DENY 路径零改动」的定性与 §11 DENY LIST 记录一致 |
| **SA8 实现后复审 Required action 1**（Decision 表「设计 §12.1 S8 字面 fixture」行裁定 no-conflict）：更正 §12.1 为镜像成员构造、根因补入 §2 现状事实/C17 限定；证据链以 SA3 Deviations §1 与测试内联注释为准；可选项「C17 补导航步骤事实」 | §2 C17 尾注（限定「各自合法」前提需满足 C18）+ C18（即该可选项的落实）；§6 新增义务行；§15 理由 7 | **已落实**：必选与可选项均完成；SA8 明文本次回写属 `wiki/raw` 证据文书更正、不构成决策文档修订、不触发八要素计划——本文 §15 据此不要求新的冲突复查 |

---

## 15. 是否需要设计后 ADR 冲突复查及理由

**iteration 2 判定：需要（`requiresConflictRecheck: true`）——该复查已执行并闭合**：设计后冲突复查（SA8 `wiki/raw/task_issue-350_conflict_report.md`，clear——`set([])` 封口与 override 核定在内）与实现后复审（SA8 `wiki/raw/task_issue-350_implementation_conflict_report.md`，clear——全项 no-conflict / implements-existing-decision；SA4 实现与测试静态审查 approve）。**iteration 3 增量（S8 fixture 证据回写）不需要新的冲突复查**：SA8 实现后复审明文——`wiki/raw` 设计产物属证据文书而非规范契约，本次回写不构成决策文档修订、不触发八要素计划，不改变公共 API/wire/schema/持久化/状态机/生命周期/失败语义/override 范围（其「是否需要再次冲突复查」判定为 **false**）。iteration 2 的复查依据存目如下（对照技能判据）：

1. **公共 API/协议变化**：`@nomicore/doc-runtime` 公共类型面新增 `BatchedMutation`/`MutationEnvelope`，`applyValidatedMutation` 接受的信封契约从单形态扩为双形态互斥。
2. **失败语义变化**：新增跨操作聚合 issues（非 fail-fast）、新增形状错误类别（双形态/基数/嵌套/`set([])` 元素/guard 元素）、新增组合失败 fail-closed 类别——虽以 `ok:false` 无码呈现，属调用方可观察语义演进。
3. **触碰 ADR 冻结面邻接**：单操作形态逐字节不变、S1–S7 槽序、诊断词表、稳定码注册表、E201-C 触发语义（0007 #237 §5）均为 SA8 冻结面，实现必须证明零扰动（本文以零改动 + 组合期望边界 + 负控锚设计，需复审核实）。
4. **SA8 移交封口项裁决**：`set([])` 批量元素边界按闭口 B（形状错误）封口——SA8 conflict report §10 已预告设计产出后应运行设计后复审。
5. **iteration 1 增量**：F1 修订（组合期望边界）属实现语义适配——SA2 §14 观察 4 判定其不触碰任何 ADR 条款边界、无新增 ADR 冲突面；但该项使 E201-C 的触发面从「iteration 0 描述的逐操作直接复用」收窄回冻结语义（只对真实偏离触发），建议复审一并核实「无新触发点 + 收窄正确」。
6. **iteration 2 增量**：F5/F6 修订均为验收覆盖补齐（S7/S8/NS-1 拓展）与可达性表述更正——SA2 §14 观察 5 判定其不触碰 ADR 条款边界、不新增冲突面，SA2 亦不因此额外要求冲突复查；`requiresConflictRecheck:true` 的既有依据仍是理由 1–4（公共 API/失败语义/冻结面邻接/封口项裁决）。
7. **iteration 3 增量**：S8 fixture 回写为证据文书更正（SA8 no-conflict 裁定 + Required action 1 路由）——不改实现与测试、不触任何 ADR 条款/冻结面/override、无新决策面——**不需复查**（本节开头判定；理由 1–4 所涉面均已经两轮 SA8 复审闭合）。

无阻塞项：全部上游产物在位；F1–F6 已逐条落实并经实现链路验证（SA3 落地 → SA4 approve → SA8 实现后 clear）；iteration 3 回写消除设计与落地测试之间的最后字面不一致，本轮无新增待定必要条件。
