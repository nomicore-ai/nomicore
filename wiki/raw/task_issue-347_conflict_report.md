# task_issue-347 conflict report（SA8 冲突裁决）

- Reviewed subject: **task**（issue #347 任务简报前置门禁；无 design/implementation 复审输入）
- 审查时间：2026-09-13；iteration=0；Owner 评论：无（REST comments=[]，无额外 owner 要求）
- 审查问题：任务要求的**单操作顶层 guard**与**批量顶层 `{ ops, guard }`**语义是否与
  仓库契约（ADR 全集 + CONTEXT.md + 协议 + 模块 AGENTS 决策边界）或所述父基线冲突。

## 1. Inputs and decision set

- 输入：`wiki/raw/task_issue-347.md`（issue #347 简报：条件写核心 guard I）、
  `wiki/raw/task_issue-347_dispatch.md`。
- 决策集：`docs/adr/0001–0026` 全集（均 accepted；无 superseded 项参与约束）、
  `CONTEXT.md`、`docs/protocols/instance-replication-v1.md`（未触）、模块 AGENTS
  （doc-runtime / namespace-runtime / namespace-diagnostic-log）。
- 核心决策：**ADR 0025（条件写，已接受）** 与 **ADR 0026（原子变更信封，已接受）**，
  含两者互写的组合节。
- 父基线：`origin/adr0025-guarded-mutation` @ `1b55d5c`——ADR 0025/0026 文本、CONTEXT
  两词条、typed-access guard 小节、**#350 批量信封实现（PR #354）** 均已就位；任务
  Blocked-by #350 在基线内已满足。
- 源码（`packages/doc-runtime/src/mutation.ts`、`read.ts`、`index.ts`；
  `packages/namespace-runtime/src/write.ts`、`diagnostic.ts`；
  `packages/namespace-diagnostic-log/src/schema.ts`、`projection/issues.ts`）仅用于确认
  当前事实，不替代决策文本。

## 2. Decision analysis

| Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| ADR 0025 | 信封形态 L21–44：四操作统一可选 `guard` 键、定稿判别联合（equals/absent 恰其一、absent 字面 true） | 任务要求 set/delete/array-insert/array-delete 信封可携带可选单条件 guard，形状校验在信封解析完成 | implements-existing-decision | docs/adr/0025 L21–44、L57；基线 `mutation.ts` parseMutationCore 封闭键集（L534–572）现为动词封闭集，guard 为预留可选键 | 实现时把 `guard` 纳入四动词封闭键集的可选键；其余未知键 loud 拒绝不变（N3 测试 `zzz` 冻结面保持） |
| ADR 0025 + ADR 0026 | 0025 L72–74 / 0026 L29、L53–55：guard 适用于**两种形态顶层**；批内元素永远不得携带 guard（形状错误）；评估先于逐操作 prepare | 任务要求批量顶层 `{ ops, guard }`：评估一次、先于逐操作 prepare；元素携带 guard = 无码形状错误 | implements-existing-decision | docs/adr/0025 L72–74；docs/adr/0026 L29（「届时只允许出现在顶层」）、L53–55；基线 `mutation.ts` E1 顶层键封闭恰 `{'ops'}`（L186–193）——`{ops,guard}` 现拒为「未知信封键」，正是两 ADR 预留落点；B6 测试（L269–292）已冻结元素级 guard 拒绝且顶层未知键 fixture 用 `zzz` | E1 键封闭演进为 `{'ops','guard'}`（guard 可选）；元素解析核封闭键集**不加** guard——元素级 guard 维持无码形状错误 |
| ADR 0025 | 评估位置 L48–51：`applyValidatedMutation` prepare 阶段、信封解析后、局部/legacy 分叉前、先于 schema 校验；`set([])` legacy 同样生效；批量下先于逐操作 prepare | 任务要求评估在信封解析后、分叉前、schema 校验之前；guard 不满足且新值违反 schema 时只报 guard | implements-existing-decision | docs/adr/0025 L48–51、L74；基线 `mutation.ts` prepareMutation（L124–159）在 parse 成功后、`isRootReplace` 分叉前有精确插入点；prepareBatchMutation E1–E5 后、P 循环前同理 | 实现按 ADR 次序插入纯读评估；不得移入 Yjs 事务（0025 L49 明文反对） |
| ADR 0025 + ADR 0008 | 谓词 L42–44：equals 与 `readLogicalValueAtPath` 投影逻辑值结构深相等（undefined 键过滤，读取面 D4 缺席吸收）；absent 由 PATH_NOT_ALLOWED 或投影 undefined 满足；guard 路径段纪律同 mutation path；穿越不可下钻终态语义 | 任务要求对 guard 路径 committed 当前载体投影逻辑值断言 equals/absent；缺键吸收为 undefined 记 equals 不满足 | implements-existing-decision | docs/adr/0025 L42–44；`read.ts` D4（L18–19：缺键/显式 undefined/越界 → ok:true undefined）与 PATH_NOT_ALLOWED（L27、L44–46）；`mutation.ts` `logicalValuesEqual`（L483–495）已是同款 undefined 键过滤深相等先例 | 复用既有投影读取与深相等纪律；不为 guard 新起第二套读取/相等语义 |
| ADR 0025 | guard 路径禁 `[]`（L44：ROOT 整树 CAS v1 拒绝） | 任务要求 path 为 `[]` 是形状错误（无码、不可重试） | implements-existing-decision | docs/adr/0025 L44、L57 | 信封解析期拒绝；词表演进（放开 `[]`）须过设计评审（0025 开放问题 1），本任务不做 |
| ADR 0025 | 错误域两态 L53–58：形状错误家族（非对象/非恰其一/缺 path/absent 非字面 true/段类型错/`[]`/equals 含非有限数）无码不可重试；评估不满足零写入单 issue、稳定码 `MUTATION_GUARD_MISMATCH`、issue.path=guard 条件路径、message 含期望/实际摘要截断 | 任务验收同款两态与稳定码 | implements-existing-decision | docs/adr/0025 L53–58 | 实现稳定码常量与单 issue 形态；message 摘要须截断（防爆） |
| ADR 0025 + doc-runtime AGENTS | L58、L86–87：`MutationGuard` 类型与 `MUTATION_GUARD_MISMATCH` 从 doc-runtime `index.ts` 导出（该包首个领域拒绝稳定码）；公共面审计测试同步 | 任务要求两导出 + 公共面审计测试覆盖 | implements-existing-decision | docs/adr/0025 L58、L87；`packages/doc-runtime/AGENTS.md` L14（「Add public APIs only through src/index.ts; public-surface guard tests must account for every export」）；`index.ts` 现无任何稳定码导出；`test/public-surface-guard.test.ts` 审计纪律在位 | 经 `src/index.ts` 新增导出并同步审计测试；issue 携带码的字段形态（如 `MutationIssue` 增可选 `code`）属 SA1 设计裁量——无任何文档冻结 MutationIssue 形状（docs/ 全集零引用） |
| ADR 0025 + ADR 0011/0014 | 诊断 L60：guard 拒绝经写槽现有 R9 透传（stage=validation、result=rejected）自动进诊断日志；namespace-runtime 写槽零改动；fatal 通道不变 | 任务不要求改 namespace-runtime 写槽；携带 guard 的信封在公共面结果联合中正确透传 | no-conflict | docs/adr/0025 L60；`write.ts` R9 issues 同源透传、公共联合 `issues: unknown[]`（L80、L205–209）；`diagnostic.ts` diagValidation 无顶层 code（L269–273）；诊断 `DiagnosticIssue` 已含可选 `code?: string` 且投影保留/截断（`schema.ts` L139–146、`projection/issues.ts` L82–92、L134–173） | 零 namespace-runtime / 诊断包改动；不得给 `diagValidation` 加顶层 code（与 #151 `diagValidationCode` 分工并存现状一致） |
| ADR 0025 + ADR 0026 | 0025 L86 / 0026 L65：旧调用方不受影响（可选键）；单操作形态逐字节不变 | 任务要求不携带 guard 的既有调用行为逐字节不变 | no-conflict | docs/adr/0025 L86；docs/adr/0026 L65；基线 `mutation.ts` L22–23（「byte-identical frozen surface」注释） | 可选键实现不得触碰无 guard 路径的消息与行为（N3/B6 既有断言是回归锚） |
| ADR 0025 + ADR 0026 | 0025 L74「本 ADR 其余条款原样适用于两种形态」+ 错误域「单 issue（v1 单条件）」；0026 L41 操作失败聚合全部 issues | 任务要求批量 guard 不满足 → 整体零写入**单 issue**（非聚合） | no-conflict | docs/adr/0025 L58、L74；docs/adr/0026 L38–42 | 无冲突：guard 评估先于逐操作 prepare ⇒ 拒绝点上尚无操作 issues 可聚合；聚合语义保留给操作失败（不因 guard 改变） |
| ADR 0025 + ADR 0002 | L68–70：不 supersede；两谓词词表封闭、机制而非策略；authority 词表仍在范围外 | 任务只实现 equals/absent 两谓词，无领域词表 | no-conflict | docs/adr/0025 L15、L68–70；docs/adr/0002；CONTEXT.md「条件写」avoid 词条（规则引擎/authority 复活） | 不新增谓词（exists/数值比较/neq/组合子均属 0025 开放问题 1 词表演进，须过设计评审） |
| ADR 0025 + ADR 0010/0008 | 边界 L64–66：复制 apply（replication-unvalidated）不受 guard 拦截；replaceSchema 不适用；跨实例是约定 | 任务范围限 doc-runtime 受控写管线，不触复制与 wire | no-conflict | docs/adr/0025 L64–66；CONTEXT.md「复制未校验」L165–167、「条件写」avoid「compare-and-swap 协议」；instance-replication-v1.md 未触 | 不在复制 apply / wire 面引入任何 guard 拦截或新帧 |
| ADR 0008 + CONTEXT.md | 写序列器 L89–91（读取不进序列）、零写入 L113–114、槽序 L140（领域事实读取在单事务前） | guard 评估是写槽内纯读（零写入、零事件），原子性归属 FIFO 独占 | no-conflict | docs/adr/0008 L140；CONTEXT.md L89–91、L113–114、L120–122；`write.ts` 槽体（S1–S7）无需重排 | guard 读不得绕槽（不得走公共 readData 面）也不得进事务 |
| 父基线 `adr0025-guarded-mutation` | 分支 @ `1b55d5c` 含 ADR 0025/0026 + #350 实现（PR #354）+ CONTEXT 词条 + typed-access guard 小节（L183–201，ADR 0025 L88 义务已先行兑现） | 任务声明实现基线为该分支；Blocked-by #350 已满足 | no-conflict | `git log origin/adr0025-guarded-mutation`；`.agents/skills/nomicore/typed-access.md` L183–201；ADR 0026 L68（票序 0026 先、#347–#349 后） | 按基线分支继续；guard 顶层叠加是 #350 明文预留落点（其测试注释「guard 顶层叠加属 ADR 0025 后续」） |

**分层备注（非冲突，实现/测试须知情）**：guard 形状错误家族中「equals 含非有限数」「equals
值为 undefined 键」等输入，经 namespace-runtime `mutateData` 时会被既有 S3 受控
snapshotter **先行**以稳定码 `MUTATION_INPUT_NOT_PLAIN_DATA` 拒绝（`write.ts`
copyFrozen L340–437：非有限数/undefined 值/plain-data 四查），到不了 doc-runtime 信封
解析。这与现行 `set` value 含 NaN 的两层拒绝模式完全同构（先到者裁决），不构成新冲突；
但「equals 含非有限数 → 无码形状错误」的验收断言须**直打 doc-runtime
`applyValidatedMutation`**（或在 mutateData 面接受 S3 先拒的现实），doc-runtime 层仍须
完整实现 ADR 0025 形状家族以覆盖直接调用方。两态拒绝在两层均为零写入、不可重试。

## 3. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| ——（无需任何 override） | —— | —— | —— |

说明：本任务不推翻任何既有决策。ADR 0025 自身即是 ADR 0007 mutation 信封「增加一个
可选键」的合法演进授权（0025 L70、L86），ADR 0025/0026 互写的组合节已预先立法两种
形态顶层 guard——全部要求都在已接受决策的兑现面上。Owner 无评论（comments=[]），
亦无 owner 级 override 供给或需求。

## 4. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| 诊断 v1 record schema | schema id/指纹 `sha256:v1:dedad2ab…` 不变；guard 拒绝只经既有 issues 投影（`code?: string` 已支持） | namespace-diagnostic-log AGENTS（冻结指纹钉死）；`schema.ts` L139–146；`projection/issues.ts` L82–173 | 任务不触诊断包；无需 schema 变更 ✅ |
| 复制 wire 协议 | instance-replication-v1.md 全部 wire 码/帧/状态机不变 | CONTEXT.md「条件写」avoid「compare-and-swap 协议」；ADR 0025 L64–66 | 任务限本地受控写信封，不触 wire ✅ |
| 批量信封既有冻结项 | ops 非空、≤16、元素完整单操作信封、元素禁 guard、批内路径互不嵌套、批量元素禁 `set([])` | ADR 0026 L28–30；`mutation.ts` E1–E5；B5/B6/B7 测试 | 任务只加顶层可选 guard，全部保持 ✅ |
| 单操作信封现役契约 | 无 guard 调用行为与消息逐字节不变 | ADR 0026 L17、L65；ADR 0025 L86；N3 测试 | 任务明文承诺不变 ✅ |
| 谓词/操作词表 | 四操作封闭；谓词恰 equals/absent；guard 路径禁 `[]`；update-omitted reason 词表 | ADR 0025 L21–44、开放问题 1；ADR 0026 L73 | 任务不扩词表 ✅ |
| doc-runtime 公共入口纪律 | 新导出仅经 `src/index.ts` 且审计测试全覆盖 | doc-runtime AGENTS L14；public-surface-guard.test.ts | 任务要求恰好如此（新增 2 项导出 + 审计同步）✅ |
| 写槽槽序与 R9 语义 | S1–S7 次序、R9 stage=validation/result=rejected/无顶层 code 不变 | ADR 0008 L140；ADR 0025 L60；diagnostic.ts L269–273 | 任务不触 namespace-runtime 写槽 ✅ |

## 5. Evolution requirements

无。全部对照项为 no-conflict 或 implements-existing-decision：两种形态顶层 guard、评估
位置、谓词语义、错误域、导出面、诊断透传均由已接受的 ADR 0025（含 0026 组合节）直接
立法；CONTEXT.md 词条与 typed-access 小节已在基线先行兑现，本任务无需修订任何 ADR、
CONTEXT、协议或模块 AGENTS。

## 6. Hard conflicts

无。未发现任何与既有决策不兼容且无合法修订路径的要求；父基线（#350 已落地 + 两 ADR
组合节）与任务要求完全互洽——批量顶层 guard 恰是基线明文预留的落点。

## 7. Required actions

1. **实现义务（SA1/SA3）**：单操作四动词封闭键集纳入可选 `guard`；批量 E1 顶层键封闭
   演进为 `{'ops', 'guard'}`；元素解析核**不**纳入 guard（元素级 guard 维持无码形状错误）。
2. **评估插入点**：单操作在 parse 成功后、局部/legacy 分叉前；批量在 E1–E5 后、逐操作
   prepare 前；均为槽内纯读，不进事务、不改槽序。
3. **导出面**：`MutationGuard` 类型 + `MUTATION_GUARD_MISMATCH` 稳定码经 `src/index.ts`
   导出，公共面审计测试同步；issue 携带码的字段形态属设计裁量（诊断面 `code` 字段名
   先例可循）。
4. **测试分层知情**：「equals 含非有限数 → 无码」等形状家族验收须直打 doc-runtime；
   经 mutateData 面此类输入由 S3 snapshotter 以 `MUTATION_INPUT_NOT_PLAIN_DATA` 先拒
   （既有两层模式，非缺陷）。
5. **保持冻结面**：N3/B6/B5/B7 既有断言、诊断 record 指纹、wire 协议、写槽 R9 语义
   零回归。

## 8. Verdict

**clear** —— 任务要求（单操作与批量顶层 guard 语义）与仓库契约及父基线无 hard-conflict、
无 evolution-required：这是 ADR 0025（与 ADR 0026 组合节）在 #350 落点上的直接兑现，
可以继续进入设计阶段。

## 9. requiresConflictRecheck

**true** —— 理由：任务将新增公共 API 导出（`MutationGuard`、`MUTATION_GUARD_MISMATCH`）
与新失败语义（两态错误域、首个 doc-runtime 领域拒绝稳定码）并改动批量信封顶层键封闭
（E1），均尚待实现核对——SA1 设计产出后应做 design 冲突复审（对照本报告第 2/4/7 节，
尤其 E1 键封闭演进、元素级 guard 维持拒绝、单操作逐字节不变与 R9 零改动四点）。
