# SA8 Relevant Decisions — issue #349 条件写端到端（guard III）

- Reviewed subject: **task**（前置门禁；被审对象 = issue #349 验收契约面：brief `wiki/raw/task_issue-349.md` + SA6 契约 `wiki/raw/task_issue-349_sa6_contract.md`）
- 基线：HEAD `61e2daa37e21b467e7ce130d5c4db7be38bde982`（#347 合并点）；worktree `/home/wangjian/nomicore-fix-issue-349`
- 本文件只摘录相关决策、条款与关联点，不重写原义、不作业务设计。冲突裁决见 `wiki/raw/task_issue-349_conflict_report.md`。

## 0. 决策集状态概览

- `docs/adr/` 现存 22 份 ADR（0001–0019、0022、0023、0025、0026），全部状态**已接受**；无 superseded 决策文件。
- ADR 0007 状态注明「Runtime/open/read 条款由 ADR 0008 部分取代」——其 logical validation、validated mutation、零写入、observer no-rollback 底层条款**继续有效**（0007 L117 取代关系节）。
- 本票相关决策：**0025（主）、0026、0008、0011、0014、0016（经 0008 修订节援引）、0007（经 0025 L70 援引）、0002、0010（边界）**；协议文档 `docs/protocols/instance-replication-v1.md` 为 wire 权威（本票零涉及）。

## 1. ADR 0025 条件写（guarded mutation）— 主决策

`docs/adr/0025-guarded-mutation-conditional-write.md`（2026-09-12，已接受）

| 条款（行号） | 摘录要点 | 与 #349 的关联点 |
|---|---|---|
| L21–27 信封形态 | 四操作（set/delete/array-insert/array-delete）统一可选 `guard` 单条件对象：`{path, equals}` 结构深相等 或 `{path, absent: true}` | AC1 guard 携带形态；K 组全部用例的输入形状 |
| L42–44 谓词语义 | `equals` 与 `readLogicalValueAtPath` 投影逻辑值结构深相等（undefined 键过滤）；`absent` 读失败或投影 `undefined` 均满足；guard 路径段纪律同 mutation path；**guard 路径不允许为 `[]`** | K1/K2/K3/K5 的 `equals` 断言语义基础 |
| L48 评估位置 | 评估在 doc-runtime `applyValidatedMutation` 的 prepare 阶段：**信封解析成功后、局部/legacy 管线分叉前**；`set([])` legacy 管线同样生效 | brief「在 #347 落地的条件写核心之上，验证 namespace-runtime 端到端链路（Seam 2）」；契约 §3 行 1 |
| L49 原子性归属 | **原子性来自写序列器 FIFO 独占（ADR 0008），不来自 Yjs 事务**：本槽独占期间无其他受控写，guard 读到的 committed 值在本槽提交前不会改变；guard 评估是纯读（零写入、零事件） | AC4「两个受控写串行，第二个基于已提交的新值判定并零写入失败（TOCTOU 消除的证明面）」的直接决策依据；K1/K3/K4 |
| L51 committed 视角 | guard 看到的是序列器视角的最新 committed 值，看不到排队中的后续写 | K1 第二写基于已提交新值判定的语义基础 |
| L50 评估次序 | guard 评估**先于** schema 校验管线（CAS 竞争是最便宜的高频拒绝路径） | 契约 §3 明示不在 e2e 重复 doc-runtime O1–O3 次序用例（#347 已冻结）；NC4 锚 S3 分层 |
| L57 形状错误态 | guard 非对象、equals/absent 非恰其一、缺 path、absent 非字面 true、path 为 `[]`、equals 含非有限数 → 无码信封校验拒绝，零写入，不可重试 | NC3（元素 guard，援引 0026 L29）与 #347 E7 的决策基础；#349 不新增形状用例 |
| L58 评估不满足态 | 零写入 `ok:false`、单 issue、稳定码 **`MUTATION_GUARD_MISMATCH`**（doc-runtime 定义并从 `index.ts` 导出——该包首个领域拒绝稳定码）；`issue.path` = guard 条件路径；message 含期望/实际摘要 | AC1/AC2；契约 §12.0 码载体口径（`issues[0].code`；record 级 `code===undefined`；形状错误无码） |
| L60 诊断与 fatal | guard 拒绝经写槽现有 R9 透传（stage=validation、result=rejected）自动进 namespace 诊断变更日志；**namespace-runtime 写槽零改动**；guard 评估自身无 fatal 面，fatal 通道不变 | AC3（诊断 rejected）、AC5（不触发 fatal）、brief「namespace-runtime 实现预期零改动」的决策级出处 |
| L64–66 边界与不承诺 | 只约束受控写：复制 apply（replication-unvalidated）不受 guard 拦截；`replaceSchema` 不适用；跨实例是约定不是强制 | 契约 §10「wire/复制/replaceSchema 零影响、零断言」的决策依据 |
| L70 与 ADR 0002/0007 关系 | 不 supersede 0002；ADR 0007 mutation 信封增加可选键，双管线（issue #237 局部/legacy）与零写入承诺不变 | 确认 #349 不触碰 0007 双管线语义 |
| L74 与 0026 组合节 | guard 键适用于**两种形态顶层**（单操作对象、批量信封顶层）；批内元素永远不得携带 guard；评估次序在批量下不变：guard 先于逐操作 prepare | AC7；K5/K6；NC3 |
| L86–88 后果 | 四 op 信封校验接受可选 guard；公共面新增 `MutationGuard` 类型导出与首个领域拒绝稳定码；CONTEXT.md 新增「条件写」词条（均已随 #347 兑现） | #349 无新公共面义务；现状实证见 §5 |
| L90 实现验证门槛 | 「doc-runtime mutation/read/public-surface 测试、**namespace-runtime 写槽透传与序列器竞争测试**、根 `pnpm typecheck` + `pnpm test`」 | #349 的存在性依据：该门槛中 namespace-runtime 透传与**序列器竞争**测试尚未落地（SA6 §8 Step 3 实测缺口）；AC8 收口义务 |

## 2. ADR 0026 原子变更信封（批量）

`docs/adr/0026-atomic-mutation-envelope.md`（2026-09-12，已接受，先行实现）

| 条款 | 摘录要点 | 关联点 |
|---|---|---|
| L28–29 信封双形态 | 恰提供两种形态之一；`ops` 约束：非空数组、上限 16、元素为完整单操作信封、**元素不得携带 `guard` 键**（形状错误） | AC7 组合形态；NC3 冻结锚 |
| L34–36 槽内次序与原子性 | 逐操作 prepare → 任一失败整体零写入 → 全部成功单事务按序提交；原子性 = 写序列器 FIFO 独占 + 单 Yjs transaction；各操作仍是最小 edit，不以载体降级换原子 | K5 拒绝零写入 + K6 单条 update bytes |
| L40–42 错误域 | 形状错误无码不可重试；操作失败聚合全部 issues；本 ADR 无新增稳定码 | K5「恰 1 issue」断言的边界（guard 拒绝单 issue，0025 L58） |
| L46 诊断 | 一个写槽 = 一次变更尝试 = 一条诊断记录；单事务天然产出**单条 update bytes** | AC7「诊断 rejected 单条记录、成功路径单条 update bytes」 |
| L55 与 0025 组合 | guard 叠加于两种形态顶层；guard 评估先于逐操作 prepare；实现顺序 0026 先行、0025 随后（#347–#349 排序依据） | brief「Blocked by #347」的决策谱系 |

## 3. ADR 0008 NamespaceRuntime 读写能力与单序列器

`docs/adr/0008-namespace-runtime-read-write-capabilities-and-sequencer.md`（已接受；含多处修订节）

| 条款 | 摘录要点 | 关联点 |
|---|---|---|
| L40–44 单一 write sequencer | 同一 namespace 内所有受控 Y.Doc 写共享唯一严格 FIFO；`mutateData` 接受路径化领域 mutation；v1 公开两窄方法（+复制管理例外，issue #132 修订） | AC4 竞争证明的机制基础 |
| L49–51 槽序 | 写方法调用时同步决定接纳顺序；每槽依次：lifecycle/fatal gate → writable gate → 输入快照 → 领域校验与 detached 构造 → 一次 Yjs transaction → `await notifyDirty()` | AC6「guard 不改变接纳门次序」的槽序依据；NC4 S3 分层 |
| L87–93 fatal 通道 | internal fatal 永久禁写保读；已排队后续写零输入访问返回 `RUNTIME_WRITE_DISABLED` | AC5 非 fatal 断言的对照面（guard 拒绝不走该通道） |
| L99 close 语义 | `close()` 幂等；首次调用同步进入 `closing`，立即停止接纳公共 read 和 write；此前已接纳任务无条件排空 | AC6；L1/L2/L4 |
| L97 测试 seam | 生产工厂保留包内，测试通过包内确定性 seam 注入可控 P0、dirty notifier、handle 与 fault | 契约 fixture（`createNamespaceRuntimeWithSeam`）与 K4 `replicationObservability` 槽观测的合法性依据 |
| L101 status 边界 | status 不暴露队列长度、任务类型或 sequence；v1 不提供公共事件订阅 | K4 只经包内 seam 观测槽样本、不进公共面的边界 |
| 稳定码注册修订 #2（L125） | `RUNTIME_WRITE_DISABLED` 是写停接纳/写禁用统一码族，覆盖 fatal 后排队写、writable gate、notifyDirty 未绑定、close 后 lifecycle≠ready 接纳拒绝；区分域靠 message | AC6 码与 message 断言；P-C/L1–L3 |
| issue #237 修订节（L145–165） | 路径级/边界级校验取代完整 ROOT 校验；`set([])` 唯一全量例外 | guard 评估所在管线的现行语义（经 0025 L48/L70 援引） |
| ADR 0016 修订节（L167–178） | `readData` 成功分支 `{ok:true, value, schema}`；读取 schema 无关、不进 sequencer | K 组用 `readData(...).value` 观察终值的形状依据 |

## 4. ADR 0011 best-effort namespace 诊断变更日志

`docs/adr/0011-best-effort-namespace-diagnostic-change-log.md`（已接受；issue #228 澄清性修订节）

| 条款 | 摘录要点 | 关联点 |
|---|---|---|
| L18–27 产品契约 | 日志 emit/排队/持久化/背压/丢弃/关闭失败不得改变业务操作的返回值、rejection、提交事实、sequencer 顺序或 Runtime 状态 | AC3「未装配 emitter 时行为等价」；D2 `rWith===rWithout` |
| L33–38 结局词表 | `committed` / `rejected` / `fatal` / `unknown`；rejected 不得折叠成统一 failed | AC3「rejected 变更尝试」 |
| L40–49 阶段词表 | 至少保留 acceptance、capability-gate、input-snapshot、schema-compile、validation、identity、transaction、dirty-notification | AC3 stage=validation；L3 stage=acceptance 的词表出处 |
| L51 记录保留义务 | 每条结局记录保留所属模块已有的稳定 code、phase、issues 顺序与 committed 事实；日志层不得发明语义 | 契约 §12.0「record 级 `code===undefined`、issue 级带码」的归属依据 |
| L69–77 输入捕获 | gate 拒绝时输入零访问；acceptance/capability gate 在输入访问前拒绝时记录 `input.capture = not-accessed`；只消费既有安全快照；策略 none/digest/redacted/full | L3 `input.capture==='not-accessed'`；D1 `issues.policy==='full'`（测试显式配置） |
| L121–129 时序与 sequencer | 变更尝试的业务排序由既有槽决定，日志不引入第二排序机构；committed record 的 emitter 接收不被 await | 竞争证明中诊断不改变定序的依据 |
| 澄清性修订节（L154–160） | emitter seam「非阻塞」是 interface 级契约；File adapter 接线必须在 write sequencer slot 之外 | #349 用内存 adapter（`createBoundedMemoryDiagnosticLog`），不涉 File adapter 接线面 |

## 5. ADR 0014 与 diagnostic-log 包契约（冻结 record schema）

- `docs/adr/0014-vfsl-validated-jsonl-and-framed-sidecar-change-log.md`（已接受）：record schema 为 VFSL 校验的冻结格式；配置冻结改变即建立新 stream generation。
- `packages/namespace-diagnostic-log/AGENTS.md`：**冻结 v1 record 契约**——schema id/指纹单源 `src/schema.ts`，指纹 `sha256:v1:dedad2ab93d9df9224960ca094924168f8bcc1c0512dfdd0a03dc6e66613e070` 被 `test/schema-freeze.test.ts` 钉死；改 `src/schema.ts` 任何字符 = schema 版本变更。
- 关联点：SA6 契约 §10「诊断日志 record schema / 投影零变更（指纹冻结面不动）」——#349 只断言既有 record 字段（stage/result.kind/issues.items[].code/path）。

## 6. 边界类决策（零涉及确认）

- **ADR 0002**（authority 范围外）：0025 L15/L70 明确 guard 是无领域语义的条件原语（equals/absent 词表封闭），不 supersede 0002。#349 测试 fixture 使用业务形态数据（tasks.status）仅是数据，不向引擎引入状态机/单调性词表。
- **ADR 0010**（Hub/Peer 复制）+ `docs/protocols/instance-replication-v1.md`：0025 L64 复制 apply 不受 guard 拦截；#349 契约对 wire/复制零断言零改动。
- **ADR 0016**（readData 语义 schema 投影）：仅作为观察面消费（`.value`），无投影语义变更。
- **ADR 0009**（Registry/Lease）：#349 经包内 seam 直测 Runtime，不经 Registry；无 Registry 面变更。

## 7. CONTEXT.md 术语（冲突基准组成部分）

| 词条 | 与 #349 相关的摘录要点 |
|---|---|
| 条件写（guarded mutation） | 可选前置条件（单操作与批量信封顶层均可携带，批内元素不得携带）：写序列器槽内、信封解析后、管线执行前断言 committed 当前逻辑值；不满足零写入拒绝（稳定码 `MUTATION_GUARD_MISMATCH`，可重试；形状错误走无码信封校验拒绝）；原子性来自写序列器 FIFO 独占，不来自 Yjs 事务；机制而非策略 |
| 写序列器 | 每个 NamespaceRuntime 独有的严格 FIFO：P0 与同一 namespace 全部受控写共享顺序，前项完成 dirty notification 后下一项才执行；读取不进入该序列 |
| 停接纳 | close 首次调用同步进入 closing 后立即停止接纳；mutateData 经 Promise settle 含 `RUNTIME_WRITE_DISABLED` 的零写入结果（与 fatal 后排队写等共用码族，message 区分域）；close 前已接纳任务无条件排空 |
| 原子变更 | 批量信封 `ops` 全有或全无；一个写槽对应一次变更尝试与一条诊断 update；单操作与批量形态互斥同拒 |
| 变更尝试 | 一次可能修改 namespace 的请求及其结局；结局区分 committed/rejected/fatal 并标明 acceptance/validation 等阶段；被拒请求也属变更尝试 |
| 零写入 | 校验失败 → 400 且文档不变；所有写入口走同一条管线 |
| namespace 诊断变更日志 | 可选 observability 流；不参与业务提交、不承诺完整性或恢复能力 |

## 8. 现状事实核对（源码仅用于确认事实，不构成决策基准）

| 事实 | 证据 |
|---|---|
| `MUTATION_GUARD_MISMATCH` 由 doc-runtime `src/mutation.ts` L62 定义、`src/index.ts` L23 导出（含 `MutationGuard` 类型） | ADR 0025 L58 公共面义务已随 #347 兑现 |
| 写槽 R9：`packages/namespace-runtime/src/write.ts` L206–207「validation / rejected / issues 同源透传」 | ADR 0025 L60「namespace-runtime 写槽零改动」现状成立 |
| 接纳门 D5.1：`runtime.ts` L176–177「lifecycle≠ready 时同步不入队、经返回 Promise 即时 settle（RUNTIME_WRITE_DISABLED）——零输入访问」 | AC6/L 组断言与实现一致 |
| sequencer 严格 FIFO 链形（`sequencer.ts` enqueue 注释：G1 不移动/移除/并行化槽序） | AC4/K4 机制成立 |
| `replicationObservability`（stageClock/slotMetrics）为 `runtime.ts` 构造选项、经包内 seam 注入 | K4 观测面为包内测试 seam，非公共面 |
| `packages/namespace-runtime/test/` 现存 `issue-347-guard-passthrough-red.test.ts`；无 `issue-349-*` 测试文件 | SA6 契约 §12.1「未实例化」属实；issue-scoped 文件先例存在（issue-347/issue-350） |
| vitest include `packages/*/test/**/*.test.ts`（`vitest.config.ts` L15） | AC8 runner 收集面成立 |
| HEAD = `61e2daa`（fix(#347)…(#356)），worktree 除 Host 预置两份 wiki/raw 文件外干净 | SA6 基线声明属实 |
