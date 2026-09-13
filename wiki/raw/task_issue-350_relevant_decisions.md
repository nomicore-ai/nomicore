# Task issue-350 前置门禁：相关决策摘录（SA8）

被审对象：task（issue #350「原子变更信封：mutateData 批量 ops 多操作全有或全无（ADR 0026，guard 前置）」，
brief `wiki/raw/task_issue-350.md`）。本文只摘录与被审对象相关的决策、条款与关联点，不重写原义、不作业务设计。
决策全集为 `docs/adr/`（22 篇，无整篇 superseded；0007 的 Runtime/open/read 条款由 0008 部分取代）+ `CONTEXT.md`
+ 协议文档 `docs/protocols/instance-replication-v1.md`（本任务不触 wire）。源码仅用于确认现状事实。

## 1. ADR 0026（原子变更信封）——本任务的主决策

`docs/adr/0026-atomic-mutation-envelope.md`，2026-09-12，状态：已接受（commit `211c5fa`，tracking #345）。

- 信封双形态互斥：单操作对象「逐字节不变」为现役契约；批量 `{ ops: [...] }` 为新增形态；同现 = 形状错误。
- `ops` 约束（L29）：非空数组、上限 **16**、元素为完整合法单操作信封、**元素不得携带 `guard` 键**。
- 批内路径互不嵌套（L30）：任意两操作路径不得构成祖先-后代或相同关系；嵌套在信封解析期直接拒绝为形状错误。
- 槽内次序（L34）：逐操作 prepare（解析/导航/detached 构建/校验）→ 任一失败整体零写入 → 全部成功单事务按序提交 → 逐操作边界验证。
- 原子性归属（L35）：写序列器 FIFO 独占 + 单 Yjs 事务；跨实体路径同样原子（Yjs 事务覆盖整个 doc）。
- 最小 edit 不降级（L36）：各操作仍是最小 edit，不整父替换、不重建容器。
- 错误域（L40–42）：形状错误（双形态同现、`ops` 非法、元素非单操作信封、元素携带未知键、路径嵌套、超上限）→ 信封校验拒绝，**无码**，不可重试；操作失败 → 零写入 `ok:false`，**聚合全部**失败操作的 issues（非 fail-fast 单错）；fatal 通道不变，**无新增稳定码**。
- 诊断（L46）：一个写槽 = 一次变更尝试 = 一条诊断记录；单事务产出单条 update bytes。
- 边界（L50–51）：只覆盖单实例受控写；复制 apply（replication-unvalidated）与 `replaceSchema` 不适用；跨实例语义不变。
- 与 0025 组合（L55）：guard 后续叠加于两种形态顶层；批内元素永远不得携带 guard；实现顺序 0026 先行。
- 后果义务（L65–69）：单操作形态对旧调用方零影响；CONTEXT.md「原子变更」词条 + 「条件写」词条修订；ADR 0025 增组合节；typed-access 技能改写「多节点命令」立场——**全部已在 commit `211c5fa` 兑现**（`git show 211c5fa --stat`：0026 新增、0025 +4 行、CONTEXT.md ±6、typed-access.md +22）。
- 开放问题（L73–74）：`ops` 上限 16 的词表演进须过设计评审；批内嵌套受控放宽须独立决策。

## 2. ADR 0007（逻辑验证与 Yjs bridge）——逐操作管线的底层权威

- L27 `applyValidatedMutation`：结构/逻辑检查 → 模拟/构造 → 单次 Yjs transaction；非空路径 mutation 只修改目标 carrier（最小 edit）；只有 `set([])` 走完整 ROOT 清空重装；transaction 后验证偏离属已提交 fatal，不回滚。
- L31：首版 mutation 仅支持 `set` / `delete` / `array-insert` / `array-delete`（批量不新增动词，元素仍是四动词信封）。
- L38：成功只返回 `{ ok:true }`，不返回 snapshot、Yjs update 或内部类型。
- L52–54 失败边界：零写入承诺覆盖所有验证与 detached 构造失败；observer no-rollback；事务后未知 observer 抛错 = fatal。
- issue #237 修订节（L62–124）：
  - §1 普通非空路径 mutation 管线 = 导航 → 最近必要语义边界 → 边界级校验（批量 values[]/count 一次整体判定）→ detached 构造 → 单 guarded transaction 最小 carrier edit → 只验证受影响边界（verifyBoundaryIntact）。
  - §2 phase-1 前置假设：mutation 前 committed ROOT 已合法；不扫描触达面外数据；无 baseline 状态机。
  - §3 `set([])` 是唯一合法全量形态，继续走完整 ROOT 清空重装管线，不作为普通消费模式。
  - §4 损坏条款：导航逐跳载体违规与边界内非法响亮拒绝；set 目标位旧值不读；触达面外不发现。
  - §5 零写入、禁 write-then-undo（验证失败在触碰 live Y.Doc 前决定）保持；边界级偏离 → E201 变体 C（committed:true、不回滚）；校验无法运行 → E201 变体 D。
  - §6 行为等价测试硬前置（A-6 28 场景）继续有效。

## 3. ADR 0008（NamespaceRuntime 单序列器）——槽机械与公共面权威

- L47：`mutateData` 接受路径化领域 mutation（非完整 Data 快照）；最小 carrier 修改保留不相关 Yjs identity；「空路径整体替换……是**唯一**清空并重装完整 ROOT 的 mutation，不作为普通消费模式」。
- L49–51 槽序：lifecycle/fatal gate → writable gate → 输入快照 → 领域校验 + detached 构造 + 单 Yjs transaction → `await notifyDirty()` → 释放；snapshotter 只接受 plain data（primitive/finite number/null/plain object/array），其余拒绝。
- L85–93 Fatal 与失败通道：预期失败零写入走结果联合；internal fatal 永久禁写、读保留；不补偿、不回滚；已排队写零写入返回 `RUNTIME_WRITE_DISABLED`。
- 稳定码注册修订节（L119–131）：`RUNTIME_WRITE_DISABLED` 为写停接纳/禁用统一码族（message 区分域）；其余稳定码以包内 append-only 注册表为准（`errors.ts`）。
- L117 取代关系：0007 关于 logical validation、detached materialization、validated mutation、零写入与 observer no-rollback 的底层决策继续有效。

## 4. ADR 0025（条件写）——组合条款（本票不含 guard，但元素禁 guard 即刻生效）

- L72–74「与 ADR 0026 的组合」（2026-09-12 增补）：guard 适用于两种形态顶层；批内元素永远不得携带 guard（元素携带 guard 键为形状错误）；guard 先于逐操作 prepare 的次序在批量下不变；实现顺序 0026 先行。
- L57–58 错误域：guard 形状错误走无码信封校验拒绝；评估不满足才有稳定码 `MUTATION_GUARD_MISMATCH`（属 #347–#349，非本票）。

## 5. ADR 0011 / ADR 0014（诊断变更日志）——一条记录与封闭词表

- ADR 0011 §变更尝试与结局：结局词表 committed/rejected/fatal/unknown；阶段词表含 `validation`；每条结局保留所属模块已有稳定 code 与 issues 顺序；日志层不得发明语义。
- ADR 0011 §时序与 sequencer：业务排序由既有槽决定，日志不引入第二排序机构；emitter 不被 await。
- ADR 0011 澄清修订节（issue #228）：File adapter `emit` 接入 namespace 生命周期的调用点必须在 write sequencer slot 之外或该 slot 释放之后。
- ADR 0014 §JSONL record（L61–89）：首版默认**每次变更尝试只写一条最终 attempt record**；v1 operation 封闭词表含 `root-mutation`（新增 operation 需新 record schema 版本与 stream generation）；result 严格判别联合；rejected 禁止携带 update。
- ADR 0014：committed update 以该 transaction 的 owned Yjs update bytes 为权威 effect（不得以事务后编码整个文档冒充）。

## 6. ADR 0023（冻结服务表面）——不适用面确认

- L41：服务方法的返回值（`NamespaceLease` 等）不经过消费方沙箱顶层包装，不受本纪律约束。`mutateData` 是 lease/运行时面方法，非 `ctx.provide` 服务表面。

## 7. 不涉决策（确认零关联）

ADR 0002（authority 规则范围外——批量是机制、无领域词表）；ADR 0009（Registry/lease 生命周期——mutateData 槽机械不变）；ADR 0010/0013/0022（复制与 wire——批量不触复制 apply 与协议帧）；ADR 0016（readData 投影，L44 仅顺带提及 mutateData）；ADR 0017/0018（META/re-arm）；ADR 0001/0003/0004/0005/0019（VFSL 语言与投影）；`docs/protocols/instance-replication-v1.md`（无 0026 引用，wire 不变）。

## 8. CONTEXT.md 术语（随 211c5fa 已对齐）

- 「原子变更（atomic mutation）」（L116–118）：批量信封 `ops` 全有或全无；一个写槽一次变更尝试一条诊断 update；单操作信封为现役契约形态，与批量形态互斥同拒。_Avoid_: 事务（公共面词汇）、多阶段命令拆写、整父替换换原子。
- 「条件写（guarded mutation）」（L120–122）：单操作与批量信封顶层均可携带，批内元素不得携带。
- 「写序列器」「零写入」「变更尝试」「语义 emission」词条与本任务直接相关（emission 调用点纪律：write sequencer slot 之外或释放之后）。

## 9. 模块契约与技能义务（downstream 约束来源）

- `packages/doc-runtime/AGENTS.md`：公共 API 只经 `src/index.ts`；public-surface guard 测试必须覆盖每个导出；零写入行为保持；验证门槛 = 包测试 + 根 `pnpm typecheck` / `pnpm test`。
- `packages/namespace-runtime/AGENTS.md`：单一严格 FIFO 不可绕过；槽起点快照、写前 writable 复查、普通校验失败零写入；公共面只暴露 detached 投影。
- 根 `AGENTS.md`：typed writes 强制经宿主 typed adapter（`PathAt`/`PathPatchValue`）走 `mutateData`；诊断日志调用点在写序列器槽之外。
- `.agents/skills/nomicore/typed-access.md` L163–201：批量信封使用范式已成文（含元素禁嵌套、禁 guard、单条诊断）；「完成门」要求最小 edit/可合并/语义化证明。

## 10. 现状代码事实（仅确认，不构成决策）

- `packages/doc-runtime/src/mutation.ts`：`parseMutation` 按四动词封闭键集校验，未知信封键 loud 拒绝（`未知信封键`）、形状错误无稳定码；`applyValidatedMutation(derived, doc, mutation)` 单操作形态，`set([])` 走 legacy 全量管线，其余走 issue #237 局部管线。批量形态**未实现**。
- `packages/namespace-runtime/src/write.ts`：写槽 S1–S7（INV-W2 不可重排）；S3 `snapshotMutation` 对整个信封做一次受控快照；R9 `diagValidation` 把 `ok:false` issues 同源透传为 stage=validation/result=rejected。
- `packages/namespace-runtime/src/diagnostic.ts`：槽外 emission——`emitSlot` 由公共方法 `.then` 回调在槽释放后调用；INV-DIAG「业务拒绝 ⇒ result.kind !== 'committed'」。
- `packages/doc-runtime/test/public-surface-guard.test.ts` + `public-surface-type-guard.test-d.ts`：公共面守卫测试存在，新增导出须同步登记。
