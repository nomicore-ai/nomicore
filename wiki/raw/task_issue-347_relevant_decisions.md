# task_issue-347 relevant decisions（SA8 前置门禁摘录）

被审对象：issue #347 任务简报（`wiki/raw/task_issue-347.md`）——doc-runtime 条件写核心
（信封解析、槽前评估、`MUTATION_GUARD_MISMATCH`，guard I）。本文件只摘录相关决策、
条款与关联点，不重写原义、不作业务设计。Owner 评论：无（REST comments=[]）。

## 决策集合状态

| 决策 | 状态 | 与本任务关系 |
|---|---|---|
| ADR 0025 条件写（guarded mutation） | 已接受（2026-09-12） | 直接权威：谓词语义、评估位置、错误域、边界 |
| ADR 0026 原子变更信封（批量） | 已接受（2026-09-12） | 组合约束：批量顶层 guard、元素禁 guard、评估次序 |
| ADR 0007 逻辑校验与 Yjs 运行时桥 | 有效（issue #237 修订节在册） | mutation 四操作契约、零写入、双管线；信封可选键演进由 0025 授权 |
| ADR 0008 运行时读写能力与写序列器 | 有效 | 写序列器 FIFO、槽序、`readLogicalValueAtPath`（D4 缺席吸收） |
| ADR 0002 authority 规则范围外 | 有效（未被 0025 supersede，0025 L68–70 明文） | guard 为无领域词表机制，词表封闭两谓词 |
| ADR 0011 / ADR 0014 诊断变更日志 | 有效 | guard 拒绝经写槽 R9 透传进日志；record schema 冻结面 |
| ADR 0016 readData 语义 schema 投影 | 有效 | guard 比较对象是 ADR 0008 载体投影读取，与 0016 无耦合 |
| ADR 0023 服务表面 getter 化 | 有效 | 不适用（doc-runtime 非 Cordis 服务表面） |
| docs/protocols/instance-replication-v1.md | 现行 wire 契约 | 不触（guard 是本地受控写信封，非 wire 协议——CONTEXT.md 条件写 avoid 词条） |

无被 superseded 的 ADR 参与约束。

## ADR 0025（条件写）相关条款

- **信封形态（L21–44）**：四个操作（set / delete / array-insert / array-delete）统一可携带
  可选 `guard` 键，单条件对象；定稿判别联合
  `{ path: readonly (string|number)[]; equals: unknown } | { path: …; absent: true }`。
- **谓词（L42–44）**：`equals` 与投影逻辑值结构深相等（undefined 键过滤，「与读取面 D4
  缺席吸收语义一致」），比较对象是 `readLogicalValueAtPath` 投影出的普通逻辑值；`absent`
  由「读失败（PATH_NOT_ALLOWED）或投影值 undefined（缺键吸收）」满足；guard 路径段纪律同
  mutation path；穿越不可下钻终态 → equals 不满足 / absent 满足；**guard 路径不允许 `[]`**。
- **评估位置与原子性（L48–51）**：评估在 doc-runtime `applyValidatedMutation` prepare 阶段、
  信封解析成功后、局部/legacy 管线分叉前；`set([])` legacy 管线同样生效；guard 评估**先于**
  schema 校验管线（CAS 竞争是高频拒绝路径）；原子性来自写序列器 FIFO 独占（ADR 0008），
  不来自 Yjs 事务；评估是纯读（零写入、零事件）。
- **错误域两态（L53–58）**：形状错误（guard 非对象、equals/absent 非恰其一、缺 path、
  absent 非字面 true、path 为 `[]`、equals 含非有限数）→ `parseMutation` 信封校验拒绝，
  沿用现有无码信封错误风格，零写入，不可重试；评估不满足 → 零写入 `ok:false` 单 issue
  （v1 单条件），稳定码 **`MUTATION_GUARD_MISMATCH`**（doc-runtime 定义并从 `index.ts`
  导出——该包首个领域拒绝稳定码）；`issue.path` = guard 条件路径；message 含期望/实际
  摘要（截断防爆）；可重试。
- **诊断（L60）**：guard 拒绝经写槽现有 R9 透传（stage=validation、result=rejected）自动进
  namespace 诊断变更日志；**namespace-runtime 写槽零改动**；fatal 通道不变。
- **边界（L64–66）**：只约束受控写——复制 apply（replication-unvalidated）不受拦截；
  `replaceSchema` 不适用；跨实例是约定不是强制；guard 不解决生成器权威。
- **与 ADR 0002（L68–70）**：不 supersede；`equals`/`absent` 词表封闭，策略留在调用方；
  ADR 0007 mutation 信封由此增加一个可选键，双管线（issue #237 局部 / legacy）与零写入
  承诺不变。
- **与 ADR 0026 组合（L72–74）**：guard 键适用于**两种形态的顶层**（单操作对象 / 批量信封
  顶层）；**批内元素永远不得携带 guard**（元素携带 guard 键为形状错误）；评估次序在批量下
  不变：guard 先于逐操作 prepare；谓词语义、错误域、边界、原子性归属原样适用两种形态；
  实现顺序 0026 先行，guard 落地时直接同时支持两种形态。
- **Consequences（L86–90）**：旧调用方不受影响（可选键）；携带 guard 的信封对旧运行区按
  未知信封键 loud 拒绝；doc-runtime 公共面新增 `MutationGuard` 类型导出与首个领域拒绝
  稳定码，公共面审计测试同步（包 AGENTS.md 纪律）；CONTEXT.md 新增词条；typed-access
  技能增补 guard 使用小节；验证门槛：doc-runtime mutation/read/public-surface 测试、
  namespace-runtime 写槽透传与序列器竞争测试、根 `pnpm typecheck` + `pnpm test`。

## ADR 0026（原子变更信封）相关条款

- **信封形态（L28–30）**：双形态互斥（单操作字段组 / `ops` 数组，同现 = 形状错误）；`ops`
  约束：非空数组、上限 16、元素是完整合法单操作信封、**元素不得携带 `guard` 键**（guard
  属 ADR 0025 批级前提，「届时只允许出现在顶层」）；批内路径互不嵌套。
- **错误域（L38–42）**：形状错误（含元素携带未知键、路径嵌套、超上限）无码不可重试；
  操作失败聚合全部 issues（非 fail-fast）；fatal 通道不变，本 ADR 无新增稳定码。
- **与 ADR 0025 组合（L53–55）**：guard 后续叠加于两种形态顶层；guard 评估先于逐操作
  prepare；实现顺序 0026 先行。
- **Consequences（L65–69）**：单操作形态逐字节不变，旧调用方零影响；实现票序 0026 先、
  #347–#349（guard）随后。

## ADR 0007 / 0008 相关条款

- ADR 0007 L46：底层能力保留领域化结果联合；逻辑校验保留完整 issues，结构与路径/操作
  错误 fail-fast——guard 形状错误沿用该无码信封风格。
- ADR 0007 L50/L54：#237 修订节下 validated mutation、零写入承诺继续有效；零写入承诺
  覆盖所有验证失败与 detached 构造失败。
- ADR 0008 L43–47：`mutateData` 接受路径化最小 mutation（四操作）；空路径整体替换是唯一
  全量形态（受控管理/迁移能力）。
- ADR 0008 L20/L109：`readLogicalValueAtPath(doc, path)` schema-independent 载体投影读取。
- ADR 0008 L140：四公共写方法进同一严格 FIFO write sequencer，完整槽序（lifecycle/fatal
  gate → writable gate → 输入校验 → 领域事实读取 → 单 Yjs transaction → 同步投影 →
  `await notifyDirty()`）不变——guard 评估属槽内领域事实读取面。

## CONTEXT.md 词条

- **条件写（guarded mutation）L120–122**：单操作与批量信封顶层均可携带、批内元素不得
  携带；写序列器槽内、信封解析后、管线执行前评估；`MUTATION_GUARD_MISMATCH` 可重试；
  形状错误无码不可重试；原子性来自写序列器 FIFO；复制 apply 与跨实例合并不受约束。
  _Avoid_：compare-and-swap wire 协议、规则引擎/authority 复活、事务内条件读。
- **原子变更 L116–118**、**写序列器 L89–91**（读取不进入序列）、**零写入 L113–114**、
  **复制未校验 L165–167**（复制 apply 无 zero-write 保证、不受 guard 拦截）。

## 模块 AGENTS 决策边界

- `packages/doc-runtime/AGENTS.md`：公共 API 仅经 `src/index.ts`；public-surface guard
  测试必须覆盖每一导出；验证失败保持零写入；根 typecheck/test 门槛。
- `packages/namespace-runtime/AGENTS.md`：单 FIFO、槽起点输入快照、普通校验失败零写入、
  公共面仅 detached 投影。
- `packages/namespace-diagnostic-log/AGENTS.md`：v1 record schema 冻结（指纹
  `sha256:v1:dedad2ab…` 被 schema-freeze 测试钉死）；改 `src/schema.ts` 任何字符 = schema
  版本变更。

## 基线实现事实（源码确认，非决策替代）

- 基线分支 `origin/adr0025-guarded-mutation` @ `1b55d5c`：ADR 0025/0026 已入 docs；
  **#350 批量信封已落地**（PR #354；任务 Blocked-by #350 已满足）；CONTEXT 两词条与
  `.agents/skills/nomicore/typed-access.md` guard 小节（L183–201）均已先行就位。
- `packages/doc-runtime/src/mutation.ts`：D1 双形态分发（L126–131）；批量 E1 顶层键封闭
  恰 `{'ops'}`（L186–193）——`{ops, guard}` 现为「未知信封键」拒绝，是 ADR 0025/0026
  预留的落点；E3 元素解析复用单操作解析核（L205–212），元素封闭键集天然排除 guard；
  单操作解析核按动词封闭键集（L534–572）；`logicalValuesEqual`（L483–495）已是
  undefined 键过滤的结构深相等先例。
- `packages/doc-runtime/src/read.ts`：D4 缺席语义（缺键/显式 undefined/数组越界 →
  `ok:true, undefined`；L18–19）；不可下钻/非法值 → `ok:false, code:'PATH_NOT_ALLOWED'`
  （L27、L44–46）。
- `packages/namespace-runtime/src/write.ts`：S3 受控 snapshotter（L322–437，plain-data
  四查 + 拒绝非有限数/undefined 值）；S5 调 `applyValidatedMutation`（L187）；R9 领域
  失败 issues 同源透传、公共联合 `issues: unknown[]`（L80、L205–209）。
- `packages/namespace-runtime/src/diagnostic.ts`：`diagValidation` stage=validation /
  result=rejected / issues 透传、无顶层 code（L269–273）。
- `packages/namespace-diagnostic-log/src/schema.ts` L139–146：诊断 `DiagnosticIssue` 已含
  可选 `code?: string`；`projection/issues.ts` L82–92/L134–173 接受、保留（full 256B
  截断 / redacted 保留）字符串 code——record schema 冻结面无需变更。
- `packages/doc-runtime/test/issue-350-batch-envelope-red.test.ts` B6（L269–292）：批量顶层
  未知键 fixture 用 `zzz`（非 guard）；元素携带 guard 拒绝已冻结为形状错误。
