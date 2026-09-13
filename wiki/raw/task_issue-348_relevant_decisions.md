# task_issue-348 相关决策摘录（SA8 前置门禁输入）

被审对象：`wiki/raw/task_issue-348.md`（issue #348「条件写语义矩阵补全：深相等、读失败路径、XML 与 set([])（guard II）」）。
本文只摘录相关决策、条款与关联点，不重写原义、不作业务设计。行号以当前 worktree 文本为准。

## 1. ADR 0025 条件写（guarded mutation）— `docs/adr/0025-guarded-mutation-conditional-write.md`（状态：已接受）

| 条款位置 | 原义摘录要点 | 与 #348 验收项的关联 |
|---|---|---|
| L42（信封形态·equals） | `equals` 与投影逻辑值**结构深相等**（undefined 键过滤，与读取面 D4 缺席吸收语义一致）；比较对象是 `readLogicalValueAtPath` 投影出的普通逻辑值 | AC1 深相等细节（嵌套结构、undefined 键过滤、`-0`/`0`）；AC6 大子树比较 |
| L43（信封形态·absent） | 读失败（`PATH_NOT_ALLOWED`）或投影值为 `undefined`（缺键吸收）均满足 | AC2 读失败路径两态判定 |
| L44（路径语义） | guard 路径段纪律同 mutation path（string = 键、number = 数组下标）；路径语义整体跟随载体投影读取（ADR 0008 域）：穿越 XML 等「不可下钻终态」→ 读失败 → `equals` 不满足 / `absent` 满足；指向 XML 终点则与其投影值比较；**guard 路径不允许为 `[]`**（v1 拒绝） | AC2、AC3（XML 两形态）、AC4（数组下标段） |
| L48（评估位置） | 评估在 doc-runtime `applyValidatedMutation` 的 prepare 阶段：信封解析成功后、局部/legacy 管线分叉前；**`set([])` legacy 管线同样生效** | AC5 `set([])` 先过 guard（不满足零写入、满足走 legacy 管线） |
| L49–51（原子性与次序） | 原子性来自写序列器 FIFO 独占（ADR 0008），不来自 Yjs 事务；guard 评估是纯读（零写入、零事件）、不进事务；guard 评估**先于** schema 校验管线 | 矩阵用例不得把检查挪进事务或改变先序 |
| L53–58（错误域两态） | 形状错误族（非对象、`equals`/`absent` 非恰其一、缺 `path`、`absent` 非字面 `true`、`path` 为 `[]`、`equals` 含非有限数）→ `parseMutation` 无码信封校验拒绝、零写入、不可重试；评估不满足 → 零写入 `ok:false` 单 issue、稳定码 **`MUTATION_GUARD_MISMATCH`**、`issue.path` = guard 条件路径、message 含期望/实际摘要（截断防爆）、可重试 | 矩阵锚定两态错误域；若用例暴露偏差须以此为准修正 |
| L60（诊断） | guard 拒绝经写槽现有 R9 透传（stage=validation、result=rejected）自动进诊断日志；namespace-runtime 写槽零改动 | #348 为 doc-runtime Seam 1 票，不触碰该面 |
| L62–66（边界与不承诺） | 只约束受控写（复制 apply 不受拦截）；跨实例是约定不是强制；guard 不解决生成器权威 | 矩阵范围限定单实例受控写语义 |
| L68–70（与 ADR 0002 关系） | 不 supersede；谓词无领域词表（`equals`/`absent` 词表封闭），策略留调用方 | #348 不得引入领域谓词 |
| L72–74（与 ADR 0026 组合，2026-09-12 增补） | guard 适用于**两种形态的顶层**（单操作 / `{ ops, guard }` 批量）；批内元素永远不得携带 guard（形状错误）；批量下评估次序不变：guard 先于逐操作 prepare；实现顺序 0026 先行、0025 随后，guard 落地直接双形态 | AC7 批量顶层 guard 用例（顶层语义与单操作一致） |
| L86–87（后果·公共面） | 四 op 信封校验接受可选 `guard`；旧调用方不受影响；doc-runtime 公共面新增 `MutationGuard` 类型导出与首个领域拒绝稳定码 `MUTATION_GUARD_MISMATCH`；**公共面审计测试同步（包 AGENTS.md 纪律）** | AC8 测试落位与公共面审计纪律 |
| L90（实现验证门槛） | doc-runtime mutation/read/public-surface 测试、namespace-runtime 写槽透传与序列器竞争测试、根 `pnpm typecheck` + `pnpm test` | #347 落地门槛；#348 验收门（AC8）为其 doc-runtime 子集 |
| L94（开放问题 1） | 谓词词表演进（`exists`、数字比较、`neq`、多条件组合、guard 路径放开 `[]`）——词表封闭，新增须显式决策过设计评审 | #348 未请求任何词表演进 |

## 2. ADR 0026 原子变更信封 — `docs/adr/0026-atomic-mutation-envelope.md`（状态：已接受）

| 条款位置 | 原义摘录要点 | 关联 |
|---|---|---|
| L29 | `ops` 元素不得携带 `guard` 键（guard 属批级前提，只允许出现在顶层） | AC7 批内元素禁 guard 的冻结面 |
| L53–55 | guard 叠加于两种形态顶层；guard 评估先于逐操作 prepare；实现顺序：0026 先行，0025 随后 | AC7 的次序依据；前置票序 |
| L65 | 单操作形态逐字节不变；携带 `ops` 的信封对旧运行区按未知信封键 loud 拒绝 | 矩阵不得改动单操作无 guard 契约 |

## 3. ADR 0007 逻辑验证与 Yjs Runtime Bridge — `docs/adr/0007-logical-validation-and-yjs-runtime-bridge.md`（状态：已接受，open/read 条款被 0008 部分取代）

| 条款位置 | 原义摘录要点 | 关联 |
|---|---|---|
| L29 | 路径统一 `readonly (string \| number)[]`：map/object/Record 用 string，Y.Array 用 number；leaf、plain、XML 是不可下钻终态 | AC4 段纪律同源条款 |
| L93–96（issue #237 修订节条款 3） | `set([])` 是唯一合法全量形态，继续走完整 ROOT 清空与重装管线，不作为普通消费模式 | AC5「满足后正常走 legacy 管线」的管线归属 |
| L27 / L62–96 | validated mutation 管线、零写入承诺、路径级/边界级校验（issue #237 修订） | guard 纯读插桩点不改变该管线 |

## 4. ADR 0008 NamespaceRuntime 读写能力与单序列器 — `docs/adr/0008-namespace-runtime-read-write-capabilities-and-sequencer.md`（状态：已接受）

| 条款位置 | 原义摘录要点 | 关联 |
|---|---|---|
| L18、L109 | 读取不进 sequencer；`readLogicalValueAtPath(doc, path)` schema-independent 载体投影 | guard 读的语义来源（非 readData/schema 投影） |
| L23 | map/object 缺键或数组越界均成功返回 `undefined`，中间缺失立即结束 | AC2「中间容器缺失与数组越界按缺席吸收」 |
| L26 | `Y.XmlFragment` 是不可下钻终态，返回语义字符串 | AC3 XML 两形态 |
| L40–51 | 单一严格 FIFO write sequencer；槽序 lifecycle/fatal gate → writable gate → 输入快照 → 领域校验与 detached 构造 → 单 Yjs transaction → `await notifyDirty()` | guard 评估位置（槽内 prepare、事务外）与原子性归属 |

## 5. ADR 0016 readData 语义 schema 投影 — `docs/adr/0016-readdata-semantic-schema-projection.md`（状态：已接受）

| 条款位置 | 原义摘录要点 | 关联 |
|---|---|---|
| L74 | `@nomicore/doc-runtime` 不动：读取保持 schema 无关，`readLogicalValueAtPath(doc, path)` 签名与语义不变 | guard 比较不涉及语义 schema 投影；矩阵无该面 |

## 6. ADR 0002 — `docs/adr/0002-nomicore-is-a-rewrite-authority-out-of-scope.md`（状态：已接受）

| 条款位置 | 原义摘录要点 | 关联 |
|---|---|---|
| L3 | 旧系统 authority 规则体系（`__authority__` manifest：enum / range / conditional / state-machine）完全排除在范围外 | guard 谓词无领域词表，不构成 authority 复活（ADR 0025 L68–70 明示不 supersede） |

## 7. CONTEXT.md 词条

| 位置 | 词条 | 关联 |
|---|---|---|
| L120–122 | 「条件写（guarded mutation）」：可选前置条件、双形态顶层、`MUTATION_GUARD_MISMATCH` 可重试、形状错误无码不可重试、原子性归写序列器、机制而非策略 | #348 全部验收项的术语基准 |
| L85–87 | 「载体投影读取（readLogicalValueAtPath）」：缺席吸收、不重复校验 | AC2 缺席吸收语义 |
| L113–114 | 「零写入（zero-write）」：校验失败 → 400 且文档不变；所有写入口走同一条管线 | AC5 不满足零写入 |
| L116–118 | 「原子变更（atomic mutation）」：批量信封、全有或全无、单操作形态与批量形态互斥同拒 | AC7 批量形态基准 |

## 8. 模块 AGENTS 决策（`packages/doc-runtime/AGENTS.md`）

- Boundaries：读保持 schema-independent；validated writes 恰支持公共 mutation 操作、验证失败零写入；公共 API 只经 `src/index.ts`，public-surface guard 测试须覆盖每一导出。
- Verification：运行 doc-runtime 测试（fatal、nested-path、carrier、public-surface guards）；公共类型或 mutation/read 契约变化时运行根 `pnpm typecheck` + `pnpm test`。

## 9. 实现事实核对（仅确认，不构成决策依据）

- 前置 #347 已落地：`git log` 61e2daa「fix(#347): 条件写核心……（guard I）」；#350（ADR 0026 批量）先行落地：1b55d5c。
- `packages/doc-runtime/src/mutation.ts`：L173–178 单操作 guard 评估位于解析后、局部/legacy 分叉（L182）前；L287–291 批量顶层 guard 先于逐操作 prepare；L540–552 `logicalValuesEqual`（严格 `===` 首判 + undefined 键过滤结构递归）；L644–683 `parseGuard` 形状错误全表（含 `path` 为 `[]` 拒绝 L678–680、非有限数 L667–669）；L711–729 `evaluateGuard`/`mismatchIssue`。
- `packages/doc-runtime/src/read.ts`：L26–27/L46 失败单通道 `PATH_NOT_ALLOWED`；L106–107 穿越 XML → 读失败；L351–352 XML 终点 → 语义字符串。
- `packages/doc-runtime/src/index.ts` L23/L28–31：`MutationGuard`/`GuardedMutation`/`BatchedMutation`/`MutationEnvelope`/`MUTATION_GUARD_MISMATCH` 已导出；`packages/doc-runtime/test/public-surface-guard.test.ts` L55–59 已审计值导出；`packages/namespace-runtime/test/issue-347-guard-passthrough-red.test.ts` 存在。
