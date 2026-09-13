# task_issue-347 implementation conflict report（SA8 冲突裁决）

- Reviewed subject: **implementation**（issue #347 已实现的 guarded mutation 变更：工作区 diff vs 基线 `1b55d5c`）
- 审查时间：2026-09-13；iteration=1；Owner 评论：无（REST `comments=[]`，无额外 owner 要求——brief/SA6/SA8/SA3 四源一致）
- 触发依据：设计 §15 `requiresConflictRecheck: true`（新公共导出、新失败语义、E1 键封闭演进）+ SA3 报告
  「Deviations」第 1 项显式提请复核 exclusive-union `?: never` 类型面收紧。
- 审查对象：`git diff 1b55d5c`（HEAD=1b55d5c，未提交工作区）：`packages/doc-runtime/src/{mutation,index}.ts`（改）、
  `packages/doc-runtime/test/{issue-347-guard-envelope-red,public-surface-guard,public-surface-type-guard.test-d}`（改/增）、
  `packages/namespace-runtime/test/issue-347-guard-passthrough-red.test.ts`（增）——恰为设计 §10 ALLOW LIST 六路径。

## 1. Inputs and decision set

- 输入：`wiki/raw/task_issue-347.md`（brief）、`…_design.md`（SA1）、`…_sa2_review.md`（approve，N1–N9 MINOR）、
  `…_sa6_contract.md`（approve，§12 用例表）、`…_sa3_impl.md`（V1–V8 证据）、`…_conflict_report.md`
  （SA8 前置门禁，clear + §9 预置复查四点）、`…_relevant_decisions.md`。**SA4/SA9 评审尚不存在**（无输入可读）。
- 决策集：`docs/adr/0001–0026` 全集（均 accepted；无 superseded 参与约束）、`CONTEXT.md`（L120–122「条件写」、
  L116–118「原子变更」、L127–131 判别联合/封闭对象词条）、`docs/protocols/instance-replication-v1.md`（未触）、
  模块 AGENTS（doc-runtime L14 公共面纪律）。核心：**ADR 0025**（含 L72–74 与 0026 组合节）、**ADR 0026**。
- 源码/测试仅用于确认当前事实：mutation.ts 全量 diff 逐行核读；两新测试文件冻结锚 grep 核验；
  DENY 清单路径 `git diff` 空 outputs 实证。
- 独立编译探针（SA8 自建事实核验，非仓库测试）：TypeScript 5.9.3（仓内 `node_modules/.bin/tsc`），
  `--strict --exactOptionalPropertyTypes`（对齐 `tsconfig.base.json` L10），探针文件 `/tmp/sa8-347-probe/probe.ts`。

## 2. Decision analysis

| Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| **ADR 0025 L21–27**（信封形态：`MutationGuard` 逐字判别联合 snippet） | 单条件对象；equals/absent 两成员 | **SA3 偏离 1（本次专项复核项）**： delivered `MutationGuard` 为 exclusive-union 惯用法——成员一增 `absent?: never`、成员二增 `equals?: never`（`mutation.ts` L78–81），与 ADR snippet 存在文本差异；SA3 动因：设计 D1 声称字面联合可静态拒绝「同现」系事实性错误 | **no-conflict** | 编译探针实证：(a) ADR 逐字联合对字面量与非新鲜变量均**静态接纳** `{path, equals:1, absent:true}`（探针 A1/A2 零报错——TS 联合 excess-property 检查不拒绝「存在于任一成员」的键，SA3 事实认定成立）；(b) delivered 联合对两者均报错（B1/B2：`'true' is not assignable to type 'never'`，且在可赋值性层面生效、非仅 EPC）；(c) **合法值集合不变**（B3/B9：equals/absent/深值/可变 path 全部可赋值）；(d) 新增静态拒绝面 ⊆ ADR 0025 **L57 自身立法的形状错误族**（「equals/absent 非恰其一」「absent 非字面 true」——`absent: undefined` 即非字面 true）；(e) ADR 对该类型的义务性条款 L87 是「公共面新增类型导出 + 审计同步」，非逐字文本冻结；CONTEXT.md L120–122 与 typed-access L190–199 均只载语义零 TS 渲染。结论：snippet 是语义载体（两形态、恰其一、字面 true、path 纪律），delivered 渲染逐条兑现且**收紧方向与仓内 fail-closed 纪律一致**（根 AGENTS「negative type fixtures … fail closed」；CONTEXT「封闭对象：未声明字段拒绝」）；唯一保留的静态宽松点 `equals: undefined`（探针 B6 无报错）恰为设计 §5 D4 ⑤a + SA2 N9 已披露的运行时拒绝项，非本偏离引入 | 无阻塞项。文本差异已在代码 JSDoc（`mutation.ts` L71–77）与本报告双重留痕；可选 cosmetic follow-up：为 ADR 0025 snippet 补 `?: never` 注记（Owner/SA1 裁量，与 R1 同类、非本任务义务） |
| ADR 0025 L57（形状错误族：非对象/非恰其一/缺 path/absent 非字面 true/段型错/`[]`/equals 含非有限数） | 全族无码、零写入、不可重试 | `parseGuard` 确定性检查序 ①–⑥ 全表落地（`mutation.ts` L648–682）；另含设计 §5 D4 三项裁定（guard 内未知键 S9、`equals:undefined` S10、`{guard:undefined}` S11）——超出 ADR 枚举但同向收紧，属 SA1 裁量 + SA2 approve + SA6 回写请求范围内 | implements-existing-decision | mutation.ts diff 逐行（①`plainObjectOf` ②未知键 ③a/③b 恰其一 ④字面 true ⑤a undefined ⑤b `containsNonFiniteNumber` ⑥a–d path 族）；测试 S0–S11 全绿（V3/V5）；SA2 N3 采纳：parseGuard 置于 op 自身形状检查之后，非 guard 缺陷消息优先级不变 | 无 |
| ADR 0025 L42–44（谓词语义：投影深相等/absent 两满足源/路径纪律/禁 `[]`） | equals=投影逻辑值结构深相等；absent=读失败或缺键吸收 | `evaluateGuard` 复用 `readLogicalValueAtPath` + `logicalValuesEqual`（零新读取/相等语义）；`isAbsentGuard` 谓词判别 parse 产物（恰携其一，构造面 `mutation.ts` L680–682 保证） | implements-existing-decision | mutation.ts L711–719；read.ts 零 diff（git 实证）；SA8 前置报告 required action 4 兑现；G3/G6/M1–M5/M10 绿 | 无 |
| ADR 0025 L48–51（评估位置：解析后、分叉前、先于 schema 校验；不进事务） | prepare 阶段纯读插入 | 单操作：parse → root fatal 检查（保持在前，SA2 N2 选定次序）→ guard 评估 → `isRootReplace` 分叉；批量：E1–E5 → E6 parseGuard → root 检查 → G 评估（恰一次）→ P 循环；评估在 `transactGuarded` 之外 | implements-existing-decision | mutation.ts L173–178（单）、L276–292（批）；O1/O2/O3 证明 guard 先于 schema 校验且 schema 管线仍可达 | 无 |
| ADR 0025 L58（评估不满足：零写入单 issue、稳定码、issue.path=guard 路径、message 含期望/实际摘要截断） | 两态错误域可判别 | `mismatchIssue`：`code: MUTATION_GUARD_MISMATCH`、`path: [...guard.path]` 新鲜副本、模板 `${CODE}: guard 条件不满足（guard 路径 P：期望 …，实际 …）`、单侧 ≤256 字符截断 + 不可序列化回退 | implements-existing-decision | mutation.ts L722–730、L732–755；M1–M10 绿（M8 1 MiB equals 实测 message ≈300 字符 < 1 KiB < 诊断 4096B 预算）；形状族 issue 键缺席构造（`failIssue` 无 code） | 无 |
| ADR 0025 L58/L87 + doc-runtime AGENTS L14（两导出经 `src/index.ts` + 公共面审计） | `MutationGuard` 类型与 `MUTATION_GUARD_MISMATCH` 稳定码导出 | `index.ts` 增值导出 `MUTATION_GUARD_MISMATCH` 与类型导出 `MutationGuard`/`GuardedMutation`；P4 值导出三断言 + T1a/T1b/T1c 类型用例（含 SA2 N4 `GuardedMutation` 锚）追加；`applyValidatedMutation` 签名零改动（第三参本 `ValidatedMutation \| unknown`） | implements-existing-decision | index.ts diff；public-surface-guard.test.ts P4；public-surface-type-guard.test-d.ts T1；V4 `tsc --noEmit` exit 0 ⇒ T1b 四条 `@ts-expect-error` 全部真实命中（无 TS2578） | 无 |
| ADR 0025 L74 + ADR 0026 L29/L53–55（guard 两种形态顶层；批内元素永禁 guard；评估先于逐操作 prepare） | 批量顶层 `{ops,guard}` 合法、元素 guard = 无码形状错误 | E1 过滤式演进 `key !== 'ops' && key !== 'guard'`（消息模板零改动）；元素循环 `parseMutationCore(ops[i], prefix, false)` ⇒ 元素 guard 维持 `未知信封键 "guard"（操作 <op>）`；`BatchedMutation.ops` 元素类型 `ValidatedMutation` 不变 ⇒ 元素 guard 静态 TS2353 双层一致 | implements-existing-decision | mutation.ts L228–229、L252、L609；类型 diff（`GuardedMutation = ValidatedMutation & {guard?}` 交集式，元素面不动）；N3/E7/S8、既有 #350 B6 锚 V5 绿；E5 恰 1 issue 无聚合 | 无 |
| ADR 0025 L86 / ADR 0026 L65（旧调用方不受影响；无 guard 行为逐字节不变） | 可选键前向兼容 | 未知键判定仅增析取支 `!(allowGuard && k === 'guard')`：无 guard 输入的求值路径与消息逐字节不变；批量 `zzz` 消息尾保持（R1 残余维持） | implements-existing-decision | mutation.ts L609；N1–N4 负控 + 既有 402 用例零回归（V5/V8：根 `pnpm test` 3686 用例 exit 0） | 无 |
| ADR 0025 L60 + ADR 0011/0014（诊断经 R9 透传；namespace-runtime 写槽零改动；fatal 通道不变） | 码经 `issues.items[].code` 结构化流入诊断 | namespace-runtime / namespace-diagnostic-log 源码 `git diff` **零改动**；`MutationIssue.code?: string` 与 `DiagnosticIssue.code?` 结构兼容达成透传 | no-conflict | git diff 空（两包全部路径）；E3/E5 断言 stage=validation、result=rejected、record 级 `code === undefined`（SA8 明令保持）、`issues.items[0].code` = 稳定码；E6 固化 S3 层 `MUTATION_INPUT_NOT_PLAIN_DATA` 先拒分层 | 无 |
| `MutationIssue` 增 `code?: string`（码载体字段形态） | ADR 未冻结 issue 字段形态 | 设计 D2 采纳 `issue.code`（键缺席 = 无码），eOPT 禁显式 undefined | no-conflict | 前置报告 §2 行 6 明示「属 SA1 设计裁量——无任何文档冻结 MutationIssue 形状（docs/ 全集零引用）」；本复核 grep 重证：docs/ 除 ADR 0025 L24/L87 外零 `MutationGuard`/issue 形态引用 | 无 |
| ADR 0008 + CONTEXT L89–91/L113–114（写序列器、零写入、槽序） | guard 评估为槽内纯读 | 评估零写入零事件（read INV-R1/R9），不进事务、不改槽序；原子性归属 FIFO 独占 | no-conflict | mutation.ts 评估调用点均在 `transactGuarded` 之外；write.ts 零 diff；M 组逐字节 `Y.encodeStateAsUpdate` + 0 事务 0 update 断言 | 无 |
| ADR 0002 + CONTEXT avoid 词条（机制非策略；谓词词表封闭） | 无领域词表 | 谓词恰 equals/absent；无 exists/数值比较/组合子；guard 路径 `[]` 维持拒绝 | no-conflict | parseGuard ② 未知键封闭 + ⑥d `[]` 拒绝；S6/S9 绿；词表零扩张 | 无 |
| ADR 0025 L64–66（复制 apply/replaceSchema/跨实例边界） | 不触复制与 wire | 复制/wire/协议文档零改动 | no-conflict | git diff 空；instance-replication-v1.md 未触 | 无 |

**专项复核结论（dispatch 点名项）**：SA3 的 exclusive-union `?: never` 调整与已交付行为**共同构成对
ADR 0025 语义契约的完整兑现**——静态面（T1b 四负例，含同现）与运行时面（parseGuard ③a/④/⑤a，S2/S4/S10）
在「equals+absent 同现」等非法输入上**双层一致拒绝**；若按 ADR snippet 字面联合交付，静态面将接纳运行时
必拒的输入（探针 A1/A2），形成 fail-open 缺口，反而背离 D1/T1 的既定 fail-closed 意图。调整未改变任何
合法值的可赋值性（探针 B3/B9）、未改运行时语义/错误域/导出名/冻结面、未扩大任何 override。判 **no-conflict**。

## 3. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| ——（无需任何 override） | —— | —— | —— |

exclusive-union 调整不构成对 ADR 0025 的 override：它不废止或改写任何条款，只是把 L57 已立法的
「恰其一」错误族从「仅运行时拒绝」补强为「静态+运行时双层拒绝」；合法值集合与全部公共语义不变。

## 4. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| 诊断 v1 record schema/指纹 | `sha256:v1:dedad2ab…` 不变；码只经 `issues.items[].code` | 前置报告 §4 行 1 | namespace-diagnostic-log 零 diff；E3/E5 record 断言 ✅ |
| 复制 wire 协议 | instance-replication-v1.md 全部帧/码/状态机 | 前置报告 §4 行 2 | 协议文档与复制源码零 diff ✅ |
| 批量信封冻结项 | ops 非空、≤16（`MAX_BATCH_OPS` 未动）、元素完整单操作、元素禁 guard、批内互不嵌套、元素禁 `set([])` | ADR 0026 L28–30；#350 B5–B7 | E1 仅过滤式放行顶层 guard；E3 `allowGuard=false`；B5–B7 既有锚 V5 绿 ✅ |
| 单操作现役契约 | 无 guard 调用行为与消息逐字节不变（含 `zzz`、批量消息尾「只允许 "ops"」） | 前置报告 §4 行 4；R1 残余 | 判定式仅增析取支；N1–N4 重钉 + 402 既有用例零回归 ✅ |
| 谓词/操作词表 | 四操作封闭；恰 equals/absent；guard 路径禁 `[]` | 前置报告 §4 行 5 | parseGuard ②/⑥d；词表零扩张 ✅ |
| doc-runtime 公共入口纪律 | 新导出仅经 `src/index.ts` 且审计全覆盖 | doc-runtime AGENTS L14 | 恰三新导出（值 1 + 类型 2）经 index.ts；P4/T1 审计同步；既有三断言原样 ✅ |
| 写槽槽序与 R9 语义 | S1–S7 次序、R9 stage=validation/rejected、`diagValidation` 无顶层 code | 前置报告 §4 行 7 | namespace-runtime src 零 diff；E3/E5 `record.code === undefined` 断言 ✅ |
| `applyValidatedMutation` 签名 | 公共签名不变 | 设计 §8 | 第三参仍 `ValidatedMutation \| unknown`，函数体仅经 prepare 传导 ✅ |

## 5. Evolution requirements

无。全部对照项为 no-conflict 或 implements-existing-decision；无需修订任何 ADR、CONTEXT、协议或模块
AGENTS。exclusive-union 调整不属 evolution-required：未改变既有契约的任何承诺面（合法值集合、运行时
语义、错误域、导出名），仅把 ADR 自身立法的非法输入族补上静态拒绝——修订 ADR 文本非义务，
补注记为可选 cosmetic follow-up（见 §8）。

## 6. Hard conflicts

无。未发现任何与既有决策不兼容且无合法修订路径的实现行为；DENY LIST 全部路径（namespace-runtime src、
诊断包、read.ts、mutation-local.ts、#350 冻结锚、ADR/CONTEXT/typed-access、wire/复制、配置/lockfile）
git diff 全空。

## 7. Required actions

1. **无阻塞项。** 实现可进入 SA4/SA7 独立审查与最终验证。
2. （记录性，非义务）exclusive-union 与 ADR 0025 L23–27 snippet 的文本差异已在 `mutation.ts` JSDoc 与
   本报告留痕；如 Owner 希望文档-代码逐字对齐，可作 cosmetic ADR 注记 follow-up（与 R1 消息尾同类，
   不构成本任务验收项）。
3. （记账）SA6 契约回写（S9/S10/S11、<1 KiB 预算、T1 四负例、E8 可选）仍待 SA6 下一轮——测试表
   bookkeeping，不涉决策面变更。
4. （披露）ADR 0025 L90「序列器竞争测试」以 E2–E5 透传 + G9/M6b 批前语义覆盖（SA2 N5 认可），
   显式 E8 竞争用例维持 deferred——SA8 不裁测试充分性，仅确认无契约违背。

## 8. Verdict

**clear** —— 已实现的 guarded mutation 变更与 ADR 全集、CONTEXT.md、协议及模块 AGENTS 零 hard-conflict、
零 evolution-required：四点预置复查项（E1 键封闭演进、元素级 guard 维持拒绝、单操作无 guard 逐字节不变、
写槽 R9 零改动）与 SA3 偏离 1（exclusive-union `?: never` 静态收紧）均经实际 diff 与独立编译探针核实为
ADR 0025/0026 的忠实兑现，静态与运行时两面对「equals+absent 同现」一致 fail-closed。

## 9. requiresConflictRecheck

**false** —— 前置报告 §9 与设计 §15 标记的全部待核对决策面（新公共 API 导出、新失败语义、E1 键封闭
演进、`MutationIssue.code` 载体、exclusive-union 类型面收紧）已在本次实现后复查中对照实际 diff 逐项闭合；
无尚待实现核对的公共 API/wire/schema/持久化/状态机/生命周期/失败语义/override 义务。剩余事项（SA6 测试表
回写、可选 E8、可选 ADR cosmetic 注记）均非决策面变更，不触发后续冲突复查。
