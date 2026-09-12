# SA2 设计攻击评审 — issue #350 原子变更信封（mutateData 批量 ops，ADR 0026）· iteration 2

- 被审对象：`wiki/raw/task_issue-350_design.md`（**iteration 2**，原位修订 iteration 1；SA1 对 iteration 1 评审 **F5 MAJOR / F6 MINOR** 的逐条落实声明见设计 §14）
- 评审基线：HEAD `211c5fa`（`git status` 复核：生产代码零改动，仅两契约测试文件与本任务 wiki 产物未跟踪——iteration 1 全部源码级验证结论原样有效，本评审对新增锚点独立复核）
- 评审人：SA2（独立攻击评审；不修改设计、不实现、不运行测试）
- Verdict：**approve**（F5/F6 经源码级独立复核**均已正确解决**；iteration 1 已接受的组合期望边界设计（§7.5.2 方案 (a)）机制零回退；SA6/SA8/ADR 0026 约束逐条保持。无 BLOCKER/MAJOR/MINOR 遗留。）

---

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-350.md`（任务简报，issue #350 正文 + AC1–AC8） | 在位 |
| `wiki/raw/task_issue-350_design.md`（SA1 设计 iteration 2，529 行） | 在位，全文审读（§1–§15，重点 §2 C16/C17、§7.5.2/§7.5.3 引理 4'、§7.6、§12/§12.1 S7/S8/NS-1 拓展、§14 修订映射） |
| `wiki/raw/task_issue-350_sa2_review.md`（本文件前身 = iteration 1 评审，verdict reject：F5 MAJOR / F6 MINOR；iteration 0 F1–F4 处置记录） | 在位，作为修订映射基线 |
| `wiki/raw/task_issue-350_sa6_contract.md`（SA6 验收契约，approve） | 在位 |
| `wiki/raw/task_issue-350_conflict_report.md`（SA8，clear + requiresConflictRecheck:true） | 在位 |
| `wiki/raw/task_issue-350_relevant_decisions.md`（SA8 决策摘录） | 在位 |
| `docs/adr/0026-atomic-mutation-envelope.md` 全文 | 在位，L14–55/L65–74 逐条复核 |
| **本轮新增/重点源码锚点独立复核** | `mutation.ts`（分发点 L66–85、parseMutation L317–355、catch L117–127）；`mutation-local.ts`（四 kind payload 构造 L234/L264–266/L307–309/L358–365、verify 输入 L241–250/L283–293/L336–346/L410–420、union 位 array-\* 现役先例 L373–394）；`validate-patch.ts`（planMutationBoundary L736–819、**drillStep/crossedUnion L100–184**、applyMutationAtBoundary L923–1009、**array 分支非空 relPath L980–1007**、relNavigate/rebuildAlong L876–909、validateBoundary L1011–1019）；`install-verify.ts`（verifyBoundaryIntact L395–459、productEqual 消费点 L454）；`validate.ts`（**validateUnion L391–433、validateObject 封闭形态未知键 L560–579**）；`evaluate.ts`（**detectDiscriminator L235–269**）；`materialize.ts`（union 构造试验 + validateLogicalSnapshot 前置）；`docs/vfsl/v1-spec.md`（**L135 字段位容器形联合合法**、L69–72 联合文法）；`docs/vfsl/schema-authoring-guide.md` §7（**L168 联合键空间句逐字在位**）；`write.ts` L173–208（S5/D-B/R9）；`namespace-diagnostic-log`（memory.ts L164 `issuesPolicy ?? 'full'`、pipeline.ts L228–233/L277 issues 投影）；`packages/vfsl/src/index.ts`（planMutationBoundary/applyMutationAtBoundary 值导出 + 三类型导出）；`vitest.config.ts`（include `packages/*/test/**/*.test.ts`）；两契约测试文件全文（fixture/`expectEachOpLegalAlone`/`countLocalTransactions`/setup/`readOk`/`waitAttempts` 形态） |

Issue #350 无 owner 评论（Host REST 预读确认），无评论映射义务。

---

## 2. Verdict

**approve**。iteration 1 的两条 finding 经本评审对源码逐接缝独立复核确认已正确落实：

- **F5（MAJOR）已解决**：§12.1 文件 A 新增 **S7**——`{delete ['tasks','t1','reviewer'], array-insert ['tasks','t1','notes'] index 1 values ['n1']}`（本评审逐项核实：E5 合法兄弟；op1 delete 的 plan 为 kind `'parent'`、prefix `['tasks','t1']` ⊇ op2 写位 ⇒ 阶段 C 必须折迭 array 载荷；`expectEachOpLegalAlone` 前置对全部 S 行生效），断言 `ok:true`（不 throw——E201-C 为 throw 通道，断言到达即证无 fatal）、t1=`{status:'open',notes:['n0','n1']}`（与机制推演逐值一致）、**恰 1 本地事务 + 1 update（原子性）**、无 fatal。该用例使 `payloadOf` 的 array 分支与「apply 不消费 `plan.kind`」跨包依赖（C13）**首次在折迭位执行**——实现误差（遗漏 array 分支 / 对 array-kind op_j 跳过折迭）的两种症状（伪 E201-C throw 或 ok:false 误拒）均使 S7 红。文件 B **NS-1 拓展**第三元素 array-insert（端到端 + 后续单操作证明无 `markWriteFatal`）——建议项被采纳。可执行性核实：fixture 模式、schema 扩展（`notes?: YArray<string>`、字段位内联联合——spec L135 明文合法）、基础态钉死（t1 notes `['n0']`，S1 期望值同步补 `notes:['n0']` 修正了 iteration 1 的缺省不一致）、HEAD 天然红（`未知操作 "undefined"` → ok 断言红）、vitest 默认 glob 收集——全部成立。
- **F6（MINOR）已解决**：设计正文不再含组合失败整分支的「理论不可达」断言（grep 复核：仅存于否定句与 finding 追溯引文）；§7.5.2/§7.5.3（新增**引理 4'**）/§7.6/§9 把该分支改述为「可达的保守收口」，且两个子分支可达性表述分开且**均准确**（plan 复跑 = 结构性不可达，依据为同输入确定性纯函数复跑，且明示「保留纯为防御」；合成应用 = 可达，构造类经 C17 锚定）；§7.6 契约锚由悬空引用改为真实落点 **S8**。**S8 可达性构造经本评审端到端源码级复核成立**：`u: { x?: number } | { label?: string }`（detectDiscriminator 无公共非可选字面量字段 → undefined → any-of 全扫描；两成员均容器形，字段位合法）、`u = {}` 物化合法（validateObject 无必填/无未知键 + materializeRoot union 构造试验首成员胜）、两操作各自合法（各自期望边界分别命中不同成员）、折迭后 `{x:5,label:'L'}` 触发封闭对象未知键规则（`未知字段 "${k}"`）无成员可容 → compIssues；顺序单操作语义下第二操作同拒（设计等价性论证准确）。S8 为 HEAD 即绿的负向守卫，判别力在实现期（删/弱化阶段 C 整体校验 → `ok:true` 红；误走 throw 通道 → no-throw 红；部分写 → 字节不变红）——红绿依据表述诚实。
- **组合期望边界设计（iteration 1 已接受）零回退**：§7.5.2 伪代码与 iteration 1 逐句相同（仅注释更正）；E5 拒绝域未扩大（§7.3 原样、B7 兄弟 anchor 保持）；`mutation-local.ts`/`install-verify.ts`/`packages/vfsl/**` DENY 保持；单操作分支隔离保持；SA8「无新增 fatal 触发点」保持。
- **SA6/SA8/ADR 0026 约束逐条保持**（详见 §5）：iteration 2 增量（S7/S8/NS-1 拓展、C16/C17 锚点、措辞更正）不触碰任何 ADR 条款边界、不扩大文件范围（两新增文件已在 iteration 1 ALLOW 内）。

---

## 3. 需求覆盖

| Requirement（issue AC） | Design section | Assessment |
|---|---|---|
| AC1 全合法批量单事务提交/观察者原子可见 | §7.5、§12 | 成立；**AC1′ 验收缺口（F5）已封闭**：共享边界折迭矩阵补齐 array-\* 载荷正例 S7，`payloadOf` 两 array 分支与 C13 跨包依赖自此有行为锚 |
| AC2 任一失败聚合 + 整体零写入 | §7.4、§7.6 | 成立（B3/R2/NS-2 锚齐；聚合只收 `{kind:'fail'}`，throw 穿出走 E204/E205 分类——与源码 catch 结构一致） |
| AC3 形状错误零写入无码矩阵 | §7.3 E1–E5 | 成立；E5 拒绝域精确保持「祖先-后代或相同」，未为任何 finding 扩大（§7.9 G 明文禁用；S7 路径为合法兄弟，与 B7 负控一致） |
| AC4 跨实体路径原子 | §7.5 | 成立；array-\* 混合形态（issue AC4 明文枚举）现有 S6/S7/NS-1 正例覆盖 |
| AC5 单操作形态逐字节不变 | §7.1/§7.3/§7.5.4/§12 | 成立：`hasOwn('ops')===false` 走原代码；组合逻辑全在批量分支；N1–N4/R5/R6 + 全仓回归 + S 文件内单操作负控 |
| AC6 一尝试一条记录/单 update bytes | §7.7 | 成立（namespace-runtime/诊断包零改动；C15/D-B/S3 快照/槽外 emission 锚点本轮复核不变） |
| AC7 端到端透传 + 停接纳次序 | §7.7、§10 | 成立（R5/R6/R7 锚；公共面 `unknown`） |
| AC8 typecheck + 测试 | §12 | 成立：两新增文件匹配 `packages/*/test/**/*.test.ts`（vitest.config 复核属实），零配置改动 |

目标/非目标无静默扩大：iteration 2 增量全部为验收覆盖与表述更正；非目标清单（guard、复制/wire/META/readData、上限/嵌套放宽、新稳定码/诊断词、单操作形态变化、**扩大 E5 拒绝域**）原样保持。

## 4. Owner评论覆盖

| Comment ID | Updated at | Design section | Assessment |
|---|---|---|---|
| （无评论） | — | §4 | 与 Host 预读一致（「none; there are no owner-comment requirements」）；无义务遗漏 |

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| SA8 required action 2：`set([])` 批量元素封口 | §7.2 闭口 B（形状错误；iteration 2 保持） | 维持核定通过（四条理由与 0008 L47 唯一性句、能力零损失、管线纯度、词汇一致——iteration 1 复核结论不变） |
| 单操作逐字节不变（冻结面第 1 行） | §7.1/§7.3/§7.5.4 | 成立（分发判据 `Object.hasOwn(env,'ops')`；单操作分支零改动） |
| 一槽一尝试、S1–S7 不重排、S3 整体快照、不新建槽类型 | §7.7 | 成立：批量（含阶段 C）封闭在 S5 单次调用内、事务前 |
| 稳定码 append-only、无新增稳定码 | §7.6 | 成立（形状/聚合/**组合失败**均无码 `ok:false`；throw 通道仍恰 E201-C/D、E203、E204——fatal.ts L12–15 复核） |
| 诊断词表/记录形态冻结、rejected 禁 update、槽外 emission | §7.7 | 成立；NS-2 断言落点复核：pipeline L228–233/L277 issues 投影 + memory log `issuesPolicy:'full'` 默认（L164） |
| 元素禁 guard、≤16、非空、完整单操作信封、互不嵌套 | §7.3 E1–E5 | 成立；E5 拒绝域零扩大 |
| 槽内次序：prepare→零写入或单事务→逐操作边界验证（0026 L34） | §7.4–§7.5 | 成立：阶段 C 在 prepare 全成功后、事务前（验证输入构造，不扰动 ADR 次序） |
| 最小 edit 不降级 | §7.2/§7.5 | 成立（批内禁 `set([])` ⇒ 元素只走局部管线） |
| `MUTATION_INPUT_NOT_PLAIN_DATA` 对 `{ops}` 整体拒绝保持 | §7.7 | 成立 |
| 公共面纪律（required action 3） | §7.8 | 成立（`BatchedMutation`/`MutationEnvelope` 只经 src/index.ts；类型守卫正例+三类负例） |
| typed-access 完成门 | §7.8 | 成立 |
| 不触复制/wire/META/readData/replaceSchema | §11 DENY | 成立 |
| **C16（F5 机制依据）** | §2 C16 | **复核属实**：`applyMutationAtBoundary` array 分支以 `relNavigate(boundaryBase, plan.relPath)` 定位目标数组（L981）、`rebuildAlong` 沿 relPath 拷贝式重建（L993/L1003）——非空 relPath 的合成 plan（parent/record/union 边界 + relPath 指向数组字段）是结构合法输入；union 位 array-\* 单操作先例（mutation-local L373–394）在位 |
| **C17（F6 可达性依据）** | §2 C17 | **复核属实**：validateUnion = 候选过滤 + 首个零 issue 成员接受（判别式缓存仅快速路径，L396–407 注释明示「不改变任何输出」）；封闭对象未声明键 emit `未知字段 "${k}"`（L574–578）；detectDiscriminator 保守附加（全内联对象 + 公共**非可选**字面量字段 + 值两两互异，缺一即 undefined→any-of 全扫描）；authoring guide §7 L168「联合对象的键空间是所有成员字段的并集，但具体值仍须完整匹配其中一个成员」逐字在位 |
| SA6 §15 未决项处置 | §7.2/§7.8/§7.7 | `set([])` 封口闭口 B；类型名目定型；形状错误槽内位置未前移 ⇒ R4 断言原样成立 |

**iteration 2 增量对冻结面的影响**：零。S7/S8/NS-1 拓展全部落在两新增 ALLOW 文件；C16/C17 为只读源码锚点；措辞更正不改变任何行为声明。E201-C 触发面仍为收窄（只对真实提交后偏离），fatal 通道零变化。

---

## 6. 设计内部一致性

| 检查 | 结论 |
|---|---|
| §2 C1–C17 vs 源码 | 逐条复核一致。C16/C17 为本轮新增，独立复核成立（见 §5）；既有 C8（E205 返回、fatal phase 恰三值）、C12（vfsl 公共导出块）、C13（apply 不消费 plan.kind；分支仅按 `mutation.op`——L923–1009 全文复核）、C14（proposedBoundary = 批前边界 + 足迹）与 iteration 1 复核结论相同（生产代码零改动） |
| §7.5.2 伪代码 vs §8.2 槽图 vs §12 映射 | 一致；阶段 C 位置三处描述一致（prepare 全成功后、事务前、既有 try/catch 内——与 mutation.ts L87–128 结构吻合，阶段 C 意外 throw → E205 返回的声明准确） |
| **F6 措辞更正的完备性** | §7.5.2 伪代码两处注释（plan 复跑「结构性不可达」+ 依据；合成应用「可达的保守收口」）、§7.5.2 末 bullet（子分支可达性二分 + 构造类 + 顺序语义等价论证）、§7.5.3 引理 4'（槽级等价 ⊬ 整边界可容性 + SA3 禁事项）、§7.6 行（改名 + 触发面分列 + 契约锚 S8）、§9、§12 行、§14——七处一致，无残留旧表述（grep「理论不可达」仅余否定句与引文） |
| **引理 4' 的准确性** | 成立：union any-of 重叠下「批前边界 + 单一足迹」各被某成员容忍不蕴含「批前边界 + 全部足迹」被任一成员容忍——S8 构造即反例（源码级验证见 §2/§8 D6）；引理 4 末句收窄解释（成员仲裁例外同走 fail-closed 收口）正确封闭了 iteration 1 指出的不完整推论 |
| §7.6 错误域表 vs 源码 | 一致（组合失败行契约锚 S8 与 §12.1 实际用例对上——悬空引用已消除；E205 行含「批量分支任何阶段的意外 throw」且与 catch 覆盖范围一致） |
| §13 风险表 | 组合期望边界构造错误行已扩「array 载荷折迭位」并锚 S7；新增组合失败死代码化风险锚 S8——与修订配套 |
| §14 修订映射 vs 正文 | 逐条核对一致（F5 行列出的 9 处落点、F6 行列出的 7 处落点均在正文实际存在）；iteration 0/1 处置记录存目且「本版未回退任何修订」经比对属实 |
| 死引用/旧 API | 未发现 |

## 7. 状态机与并发攻击

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| S1 | 写槽执行中，批量 E1–E5 全过、逐元素 prepare 全过、阶段 C 组合完成（含 array 载荷折迭）、单事务已按序提交 | 逐操作 `verifyBoundaryIntact`（组合后期望） | 合法批量静默 `{ok:true}`；E201-C 只在真实偏离时出现 | 无（机制经源码复核成立；**array 折迭位本轮专项复核**：op1 parent 边界 t1 map ⊇ op2 写位 ⇒ 合成 plan `{prefix:['tasks','t1'], relPath:['notes'], kind:'parent'}` + array-insert payload 走 L980–1007 array 分支，relNavigate 非空 relPath 定位 notes 数组、splice 重建、validateSubtree 整体校验——结构合法且结果正确） | — |
| S2 | 批量含失败操作 | 聚合后返回 | 零事务零 update | 无 | — |
| S3 | 批量已入队未开槽 | 调用方改 `ops[k]` | 槽起点快照获胜 | 无（S3 零改动，R7 锚） | — |
| S4 | 两个批量并发提交 | FIFO 写序列器 | 各占一槽、序贯执行、各一条记录 | 无 | — |
| S5 | 单事务提交中某 `commitPrepared` 抛异常 | 事务栈异常 | E203（committed:true） | 无 | — |
| S6 | 阶段 C 执行中意外 throw | 穿出至既有 catch | E205 返回 `ok:false` 单 issue（零写入、非 fatal） | 无（catch 包裹整个 prepare 体） | — |
| S7′ | 阶段 C 合成应用返回 issues（union 成员 any-of 重叠） | compIssues 聚合 | `{ok:false}` 零写入、无 fatal | **无（F6 已解决）**：可达性表述准确、S8 负向守卫在位；行为保守正确（提交将产生 schema 非法文档；顺序单操作语义下第二操作同拒） | — |
| S8′ | runtime 已 close / `{ops}` 含 accessor | 停接纳 / S3 快照拒绝 | R5/R6 绿锚路径 | 无 | — |

（命名说明：本表 S1–S8′ 为攻击场景编号，与 §12.1 测试用例 S1–S8、写槽状态 S1–S7 分属三命名空间。）

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| D1 | 共享边界合法批量（delete+兄弟 set / 双 Record-键 / Record-键+兄弟字段 / union 兄弟对 / **array-\* 载荷折入 parent 边界**） | 阶段 C 组合期望边界后逐操作验证通过 | **已消除且全覆盖**（F1 机制 iteration 1 验证记录 1–9 有效；F5 验收缺口由 S7/NS-1 封闭） | — |
| D2 | **`payloadOf` 遗漏 array 分支 / 误读引理 3 对 array-kind op_j 跳过折迭** | S7 红（ok:false 误拒 或 E201-C throw——两症状均使断言失败）；NS-1 端到端红 | **已消除**（F5 落实）；C13 跨包依赖（apply 不消费 kind）自此有行为锚——vfsl 若让 apply 消费 kind，S7 是最先破裂用例 | — |
| D3 | prepare 期 `DerivedInvariantError` | E204 fatal（零写入） | 无 | — |
| D4 | prepare/组合期意外异常 | 既有 catch → E205 返回单 issue | 无 | — |
| D5 | 事务后 notifyDirty 失败 / 诊断 emitter 故障 | S6 frozen / emitAttempt 吞没 | 无（零改动） | — |
| D6 | union 成员 any-of 重叠：逐操作各自合法、组合边界无成员可容 | 阶段 C fail-closed：聚合 issues、零写入、无 fatal；**S8 负向守卫**防 SA3 死代码化（删/弱化 → S8 红） | **已消除**（F6 落实；可达性经源码端到端复核成立：detectDiscriminator→undefined、封闭对象未知键、any-of 首零 issue接受、`{}` 物化合法、`{x:5}`/`{label:'L'}` 各命中成员、`{x:5,label:'L'}` 无成员可容） | — |

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| `applyValidatedMutation(derived, doc, mutation)` | 无：签名零变化；批量行为扩展不影响既有直调测试；生产调用点唯一 | mutation.ts L66–70；write.ts L187 | — |
| `runRootWriteSlot` / `mutateData` / `MutateDataResult` | 无：零改动声明复核成立；共享边界合法批量（含 array 折迭形态）不再 throw E201-C | write.ts L173–208（S5/D-B/R9 本轮重读） | — |
| E201-C fatal（冻结契约） | 伪触发面消除；触发面收窄回 0007 #237 §5 冻结语义 | §8 F1 验证记录 7（iteration 1，源码未变） | — |
| vfsl `planMutationBoundary`/`applyMutationAtBoundary` | 批量分支新增消费（阶段 C 复跑 + 合成 plan 应用）——零 vfsl 改动；「apply 不消费 plan.kind」跨包行为依赖由 **S7 行为锚钉住**（§10/§12.1 明示） | validate-patch.ts L923–1009；index.ts 导出块 | — |
| 宿主 typed adapter | 可选采用 `BatchedMutation`；存量单操作零影响 | typed-access.md L163–201（批量节在位） | — |
| 复制 apply / wire / readData / replaceSchema | 不经该入口，零关联（DENY 覆盖） | write.ts 结构 | — |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| 信封双形态解析/批量编排/组合期望边界/单事务 | doc-runtime（事务所有权） | §7.1–§7.5（全部封闭在 mutation.ts） | 正确；iteration 2 未移动任何归属 |
| 槽机械/诊断/接纳门 | namespace-runtime | 零改动 | 正确 |
| 边界规划/重建校验/整边界比较 | vfsl 纯函数 + install-verify 冻结核 | 逐元素复用 + 期望值组合，零改动 | 正确（组合是编排层职责——C16/C17 只读锚点不越界） |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| issue #237 局部管线 | mutation-local.ts + install-verify.ts | 批量 = 逐元素复用 + 期望边界组合（含 array 载荷折迭——复用同一 `applyMutationAtBoundary` 分支族） | 一致 | array 折迭即 union 位 array-\* 现役先例（L373–394）的同款调用形态，非新平行机制 |
| issues 聚合多条先例 | `validateSubtree` 多 issues | 跨操作聚合、操作内不拆 | 一致 | 0026 L41 引用先例 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 信封合法性判定 / 批量原子性 / 期望边界 / `ops` 上限 | doc-runtime 解析 + 写序列器槽 + 阶段 C 组合值 + `MAX_BATCH_OPS`（不导出） | 无第二解析器/状态机/镜像缓存 | 低 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| D-B update 订阅（try/finally 退订） | finally 收口 | 异常路径同样退订 | 对称，零改动 |
| 无新增资源/句柄/后台任务（S8/S7 亦为槽内同步纯断言） | — | — | 对称 |

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 第二验证器 / 第二解析器 / plan 携带扩展 / live 反推期望 | install-verify.ts / parseMutation / LocalPreparedResult / — | 备选 H/I/J 均否 | 无平行（iteration 2 未新增任何通道） |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW 七项与 §7.7/§7.8 零改动声明互洽；两契约文件「仅由红转绿，断言零改动」；两新增文件匹配 vitest 默认 glob 且 HEAD 天然红（S1–S7 正例断言 ok——现状 `未知操作 "undefined"`） | §11 vs §12.1 | — |
| **F5/F6 落点封闭性**：S7/S8 全在文件 A、NS-1 拓展在文件 B——两文件均已在 iteration 1 ALLOW 内，iteration 2 **零文件范围增量**；组合逻辑（含 `payloadOf`/`isStrictPrefix`/阶段 C）仍全部在 mutation.ts | §11/§12.1 | — |
| DENY 与正文不冲突（`mutation-local.ts`/`install-verify.ts`/`packages/vfsl/**`/namespace-runtime src/诊断包保持禁改；C16/C17 为消费侧只读锚点，不需改 vfsl） | §11 | — |
| follow-up 无掩盖（SA6 吸收、B8 单向化、词表化、guard 叠加、嵌套放宽前瞻均列 §13 残余问题） | §13 | — |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1–AC8 映射 | §12 表（B/R/N/S/NS 全锚；D1–D7 每决策 ≥1 行，D5 验证半边→S1–S8/NS-1） | 无 | — |
| **AC1′（F1+F5）共享边界合法批量不伪 fatal** | S1–S7（S7 = array 载荷折迭：`payloadOf` array 分支 + 合成 plan array 分支非空 relPath + C13 跨包依赖**首次在折迭位执行**）——断言 ok、值、1 事务 1 update、无 fatal | **无（F5 已封闭）**：折迭矩阵（set/delete × record/parent/union 边界 + **array-\* 载荷** + 包含精度负例 S6 + ROOT 级由统一谓词天然覆盖）闭合 | — |
| AC1″（F1 端到端） | NS-1（含 array 元素折入共享 parent 边界；ok、readData 三值、1 update、1 notifier、后续单操作仍 ok=写能力保持、1 条 committed record） | 无（建议项采纳） | — |
| **组合失败 fail-closed（F6）** | **S8**（union 重叠批量各自合法、组合非法 → ok:false、issues ≥1、字节不变、0 事务 0 update、无 fatal、后续单操作仍 ok）；契约锚与实际用例一致 | **无（F6 已封闭）**：S8 HEAD 即绿（整体拒绝为保守收口超集）、实现期判别（死代码化/throw 化/部分写三向均红）——红绿依据诚实且准确 | — |
| AC2 聚合 + 记录面（F4） | B3/R2 + NS-2（rejected record `issues` ≥2 且 ops 序、stage='validation'、`code===undefined`、字节不变） | 无（pipeline issues 投影 + memory log 'full' 默认复核支持断言可执行） | — |
| AC3/AC3′ 形状错误与 `set([])` 封口 | B5/B6/B7/R4/B8 | 无；E5 拒绝域不变由 B7 保持、S7 为 E5 合法兄弟 | — |
| AC5 单操作负控 | N1–N4 + 全仓回归 + S 文件内单操作负控（S1/S7 批量的单操作等价逐个执行 + 双 fixture 重复） | 无 | — |
| 最小 edit / 诊断计数 | B4 / R3/R4/NS-1 | 无 | — |
| 红→绿依据 | §12.1 末 | 成立（S1–S7/NS-1/NS-2 正例 HEAD 红；S8 负向守卫 HEAD 绿、判别力在实现期——分类准确） | — |

---

## 13. Required revisions

无。iteration 1 的 F5（MAJOR）/F6（MINOR）均已核实解决，无新增 BLOCKER/MAJOR/MINOR。

**finding 处置记录（全代际）**：

| Finding ID | 代际/严重度 | 处置 | 验证结论 |
|---|---|---|---|
| F1 | iteration 0 BLOCKER | §7.5.2 组合期望边界（方案 (a)） | 已解决（iteration 1 验证记录 1–9；源码零改动 ⇒ 结论延续；iteration 2 机制零回退） |
| F2 | iteration 0 MAJOR | 两新增 ALLOW 文件 + §12.1 规格 | 已解决（残余形态缺口析出为 F5） |
| F3 | iteration 0 MINOR | E205 返回值描述 | 已解决（保持） |
| F4 | iteration 0 MINOR | C15 + NS-2 | 已解决（保持） |
| **F5** | iteration 1 MAJOR | §12.1 S7 + NS-1 拓展 + C16 + §1/§3/§5/§10/§11/§12/§13/§8.3 联动 | **已解决**（本轮源码级复核：用例形态合法、机制可行、断言精确、HEAD 红、判别力双向、fixture 可执行——见 §2/§8 D2/§12） |
| **F6** | iteration 1 MINOR | §7.5.2 注释/bullet、§7.5.3 引理 4'、§7.6 行、§9、§12 行、S8、C17 | **已解决**（本轮源码级复核：可达性构造端到端成立、表述准确无残留、契约锚真实、S8 可执行且判别——见 §2/§8 D6/§12） |

## 14. Non-blocking observations

1. **S7 的双重价值**已按 iteration 1 观察 2 落实：同一用例同时钉住 array 载荷折迭机制与 C13 跨包行为依赖（`applyMutationAtBoundary` 不消费 `plan.kind`）——若 vfsl 未来让 apply 消费 kind，S7 是最先破裂的行为锚。
2. S8 顺带成为 vfsl union any-of 语义（非判别联合 + 封闭对象未知键）的行为锚——C17 的三个源码依据（validateUnion/validateObject/detectDiscriminator）被测试钉住，属稳定性增益而非风险。
3. §12.1 文件 A fixture 规格对无关字段（`n/a/values/…`）与 S2 的 set 值留白由 SA3 按契约文件同款补全——SA3 显然项，不构成缺口；基础态钉死句（t1/t2/point/u）已覆盖全部用例敏感位。
4. 设计 §15 维持 `requiresConflictRecheck:true`（理由 1–4：公共 API/失败语义/冻结面邻接/封口项裁决）——该既有立场与 SA8 §10 一致。iteration 2 增量（S7/S8/NS-1 拓展、C16/C17 只读锚点、措辞更正）不触碰任何 ADR 条款边界、不新增冲突面，**SA2 不因本轮增量额外要求冲突复查**。
5. §13 残余问题 4（未来嵌套放宽须重设计严格前缀折迭）与观察 6（性能面）原样保留——正确且必要的前瞻提示。
6. 引理 4' 的「SA3 禁事项」（不得把阶段 C 整体校验当死代码删除或弱化）把 F6 的风险闭环从「表述」推进到「守卫」（S8）——修订质量高于最低要求（S8 为建议项被主动采纳）。

---

## 15. 结论

iteration 2 对 iteration 1 的两条 finding 作出了精确且经得起源码级攻击的修订：**F5** 的 S7/NS-1 拓展使 array-\* 载荷折入共享边界这一唯一未覆盖的合法折迭形态获得可执行、HEAD 红、双向判别（伪 fatal 与误拒均红）的验收锚，同时钉住 C13 跨包依赖；**F6** 的可达性更正（引理 4' + C17 + S8）把组合失败分支从「理论不可达」的死代码风险改为「可达的保守收口 + 负向守卫」，且每个源码级声明（detectDiscriminator、封闭对象未知键、any-of 接受、`{}` 物化、顺序语义等价）经本评审独立复核准确。iteration 1 已接受的组合期望边界设计、E5 拒绝域不扩大、封闭性（mutation.ts 内）、SA6/SA8/ADR 0026 全部约束零回退。验收矩阵自本文认为完备：需求、上游事实、状态机、错误恢复、调用方、架构一致性、文件范围、验收设计均足以安全实施。按裁决规则：**approve**。`pass` 仅表示设计通过审查；实现与活链路验证仍由 SA4/SA7 承接。
