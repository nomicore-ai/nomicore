# SA1 架构与实现设计 — issue #389：复制来源与订阅终止（变更订阅 T3）

- 任务类型：**feature**（ADR 0030 既有决策的 T3 实现切片；非 Bug 修复）
- 被实现对象：issue #389（brief `wiki/raw/task_issue-389.md`，AC1–AC7）
- 上游输入（全部在场，实读）：
  - 已批准 SA6 验收契约 `wiki/raw/task_issue-389_sa6_contract.md`（C1–C11 / NC1–NC6 /
    B-T3-0–B-T3-6 / §12.6 红线；verdict = approve 附 SA1 冻结条件）
  - SA8 决策摘录 `wiki/raw/task_issue-389_relevant_decisions.md`、SA8 前置冲突报告
    `wiki/raw/task_issue-389_conflict_report.md`（verdict = **clear**，27 项对照零 hard-conflict；
    requiresConflictRecheck = true 待实现后闭合）
  - SA6 探针证据 `artifacts/sa6-issue389-*.log`（15 份）
  - **SA2 设计评审 `wiki/raw/task_issue-389_sa2_review.md`（iteration 0，verdict =
    reject，1 × MAJOR F-1 + N-1–N-5 非阻断观察）——本 iteration 1 逐条落实，映射见 §14**
- Worktree / 基线：`/home/wangjian/nomicore-fix-issue-389`（branch `mabf/issue-389`，
  HEAD `28faeae` = #395 T1 tracer 已合并）；根 `pnpm typecheck` exit 0、#387 契约 21/21、
  #369 契约 33/33（SA6 §4 基线，本轮未重跑——SA1 不运行验证，引用 SA6 实测）。
- 版本：**iteration 1**——原位修订 iteration 0 首版；全文只描述当前一致设计，失效表述
  已删除/改写（核心修订 = F-1：关闭 admission 共享首步 `fanout.terminateAll('runtime-close')`
  在两种风味中显式保持；逐项映射见 §14）。

---

## 1. 任务目标与非目标

### 目标（issue「What to build」+ ADR 0030 决策 4/6）

1. **AC1（验收补锚，HEAD 已具备）**：复制 apply（经 lease `openReplicationSession` +
   `applyRemoteUpdate`）触发 `data` 通知且 `origin:'replication'`；本地写恒
   `origin:'local'`。T1 交付态已结构性实现（SA6 探针 1 实测；`watch-map.ts`
   `classifyOrigin` L301–308 无过滤）。本票义务 = 不引入过滤 + 回归锁（NC3），零新实现。
2. **AC2（HEAD 缺口）**：schema 变更 → 该 namespace 全部存活订阅收到
   `{kind:'watch-end', reason:'schema-changed'}`，覆盖两条路径：Hub 本地
   `replaceSchema`（`schema-write.ts` S5.5 段）与 Peer 复制 apply 槽 schema re-arm
   （`replication-session.ts` R5.6 段，ADR 0018）。
3. **AC3（HEAD 缺口）**：doc 替换（reset 族）→ `watch-end:'doc-replaced'`。
4. **AC4**：`watch-end` 是流末条——其后订阅静默、已注销；此后 `unsubscribe` 幂等 no-op。
5. **AC5**：FIFO——`watch-end` 与滞留 data 同流有序，不会先终止、后到僵尸 data。
6. **AC6**：终止后重建订阅正确——订阅生命周期只与 lease 和 schema 耦合。
7. **AC7**：全部经 lease 公共面可观察，零新接缝（lease 恰 16 键、runtime 恰 15 键、
   零新增公共成员/导出）。

### 非目标（SA6 §12.1 + SA8 行 26 分期边界，逐项对齐）

- 谓词 `where` / `WATCH_MAP_OPTIONS_INVALID`（T2 #388）；
- `invalidate-all` 触发编排（溢出注入 / 父路径删除）与 runtime 键集纯加法验收（T4 #390）；
- 三方文档面（T5 #391；CONTEXT 词条已在 HEAD，本票零文档改动）；
- `deleteNamespace` / lease 释放 / registry shutdown 的终止信号（reason 词表封闭两值，
  详见 §5-B-T3-5 与 §7-确认项）；
- 数组载体订阅、含值通知、序号/对账（ADR v2）；
- 复制 wire / session 公共面 / readData / 窗口读 / 诊断日志 / 持久化（SA8 §5 冻结面）。

---

## 2. Owner 要求落实

| Comment ID | Updated at | Requirement | Design section |
|---|---|---|---|
| —（issue #389 评论数 = 0，REST 实读 `[]`；SA6 §2 与探针 6 同证） | — | 无 owner 评论条款 | 需求源 = issue body AC1–AC7 + ADR 0030 §4/§6 + ADR 0018 + CONTEXT 词条；逐条落点见 §1 与 §12 验收映射 |

无 owner override / 无范围收缩；最新 Owner 要求与本设计（含 iteration 0 前版）冲突的问题
不存在（无评论；F-1 修订不触碰 owner 需求面）。

---

## 3. 当前行为与证据锚点（源码实读）

### 3.1 T1 交付态（#387，HEAD）

- **订阅中枢**：`packages/namespace-runtime/src/watch-map.ts`（488 行）——
  `createWatchHub(doc, state, queueCapacity?)` 构造期挂 ROOT `observeDeep`（L395），
  零订阅快路径（L381）；通知联合 `NamespaceRuntimeWatchMapNotification`（L60–67）**已含
  `watch-end` 成员**（L67：`{kind:'watch-end'; reason:'schema-changed'|'doc-replaced'}`），
  但全仓 `packages/*/src` **零产出点**（SA6 探针 5 grep；本轮独立复核一致）。
- **队列与泵**：每订阅 FIFO 有界队列（容量默认 16，L98；溢出 → 清队 + 单条
  `invalidate-all`，L404–407）+ 单飞微任务泵（每项投递前让步 20 次微任务，L103/L318–341）；
  泵退出条件 = `queue.length === 0 || unsubscribed`（L323）。
- **退订**：句柄幂等（L466–475）——置 `unsubscribed`、**清队**（`queue.length = 0`，L471，
  T1 冻结行为 L1「在途投递于下一让步点停止」）、从 `subscriptions` 集合摘除。
- **关停**：`shutdown()`（L477–486）——摘 observer + 全部订阅置 `unsubscribed` + 清队 +
  清集合；注释明示「静默——ADR §4 终结三因不含 runtime close」。
- **runtime 接线**：`runtime.ts` L576 构造（V3c'''' 位，fanout 之后）；L753 公共面透传
  （第 15 键）；L628–635 `closeAfterFence()`（公共 `close()` 与 `startCloseAfterFence()`
  **两入口共享 admission**）：首步 `fanout.terminateAll('runtime-close')` →
  `watchHub.shutdown()` → `lazyCloseBarrier()`（详见 §3.3）。
- **lease 接线**：`lease.ts` L347–363 第 16 键透传 + `activeWatches` 登记（L225）；
  释放同步段遍历退订（L235–244）。

### 3.2 schema 安装两段（`watch-end:'schema-changed'` 的挂点）

- **Hub 本地**：`schema-write.ts` `runSchemaWriteSlot`——S5 事务提交后，**S5.5 共享段**
  `syncActiveSchemaFromCommittedDoc`（`schema-rearm.ts` L122；编译 + `installActive` 原子
  安装切换 active identity），随后 S6 `await notifyDirty()`（L308–310）。S5.5 位于
  「事务提交之后、`await notifyDirty()` 之前」的同步段（ADR 0018 §1 位置约束；头注 L281–289）。
- **Peer 复制 apply 槽**：`replication-session.ts` `runSessionApplySlot`——槽开始捕获 SCHEMA
  四键快照（L671–672，仅 peer 角色）；R5 `Y.applyUpdate(doc, bytes, ctx.applyOrigin)`（L764）；
  **R5.6**（L791–817）：`text` 不等才调 `rearmPeerActiveSchema`（`schema-rearm.ts` L209），
  结局 `applied`（安装成功）或 `failed`（fatal 双码 INVALID/INTERNAL；tools 保持旧的不动、
  apply 不回滚）；随后 R6 `await notifyDirty()`（L821–838）。槽继续 dirty/ACK 照常。
- **watch 面零接触**：`schema-write.ts` / `schema-rearm.ts` / `replication-session.ts` /
  `registry.ts` 内零 `watchHub`/`watch` 引用（SA6 探针 5；`RuntimeReplicationHost`
  L340–352 与 `SchemaWriteEnv` L78–93 均无 watch 字段）。

### 3.3 doc 替换（reset）关闭链（`watch-end:'doc-replaced'` 的挂点）

- **Runtime 侧**：`runtime.ts` `createBeginResetFence`（L443–497）——唯一 write sequencer
  槽内双源核验 + 同步 arm `closing`（L482）；槽后 continuation 产出 lazy
  `startCloseAfterFence()`（L488–495）→ `closeAfterFence()`（L628–635）：
  `fanout.terminateAll('runtime-close')` → **`watchHub.shutdown()`（静默清订阅）** →
  `lazyCloseBarrier()`（幂等缓存，公共 `close()` 共用同一入口，L615–623/L866–878）。
- **Registry 侧**：`registry.ts` `runResetSlot` ⑥（L1856–1889）——冻结次序：
  `cancelIdleArm` → `closePromise = fence.startCloseAfterFence()` →
  **`forceReleaseOutstandingLeases(current)`（L1866；同步逐 lease `release()`，L1181–1190）**
  → `await closePromise`（排空 barrier）→ ⑦ `archiveDoc` → ⑧ 返回 ok。
- **结构性缺口**（SA6 §8 交付缺口链）：`startCloseAfterFence` 同步静默
  `watchHub.shutdown()` 清队 + `forceReleaseOutstandingLeases` 同步触发 lease 释放清理
  （`lease.ts` L235–244 → 句柄 `unsubscribe()` → `queue.length = 0`）——即使入队
  `watch-end` 也被双重清队丢弃（探针 4：reset ok / lease released / watch-end 计数 0）。
- **其余关闭路径（对照）**：deleteNamespace ④（L1981–1998）= forceRelease **先**于
  `runtime.close()`；shutdown（L2113–2175）不 force-release 但直接 `close()`（带活 lease
  的 entry 直接关闭）；idle close（L1139–1165）发生在最后 lease 释放之后。三条路径在
  close 发起时 watch 订阅**均无存活或不该收 `watch-end`**（runtime close 非 ADR §4
  终结三因）；但三条路径的 `close()` 都经共享 admission 首步 `fanout.terminateAll
  ('runtime-close')` **同步终止存活 ReplicationSession**（R2-2——F-1 修订消歧）。

### 3.4 键集守卫（AC7 锚）

- lease 恰 16 键：`packages/namespace-registry/test/registry-open.test.ts` L942（含
  `'watchMap'`）；runtime 恰 15 键：`packages/namespace-runtime/test/runtime-phase5-reset-fence-r2.test.ts`
  L127–150（含 `'watchMap'` + `beginResetFence` non-enumerable）；runtime index.ts 值导出
  恰一键（`RuntimeWriteFatalError`），watch 三类型为 type-only（index.ts L77–83）。

---

## 4. 能力缺口（承接 SA6 §8，feature 形态）

| Step | 上游事实 | 证据位置 | 设计响应 |
|---|---|---|---|
| 症状 | schema 变更 / doc 替换后活订阅静默存活或静默销毁，消费方无终止信号 | SA6 探针 2（S12=3 旧订阅 V2 下继续投递）/ 探针 4（reset 后流末仅 data）；`artifacts/sa6-issue389-2-schema-local.log`、`...-4-reset.log` | §7 两条终止编排 + §7-B-T3-3 机制 |
| 直接缺口 | `watch-end` 有类型联合成员、零产出点 | 探针 5 grep；`watch-map.ts` L67 vs 全仓零 enqueue | §7-D1 `terminateAll` 产出原语 |
| 编排缺口 | watch hub 未接入 S5.5 / R5.6 / reset 关闭链 | `SchemaWriteEnv` / `RuntimeReplicationHost` / registry 零 watch 引用 | §7-D3/D4/D5 接线 |
| 交付缺口 | reset 路径静默 shutdown + force-release 双重清队 | `runtime.ts` L633 + `registry.ts` L1866 + `lease.ts` L235–244 | §7-B-T3-3 冻结机制（终止先于释放投递 + 释放清队对终止订阅 no-op） |
| 已具备 | AC1 origin 两态在产（`local`/`replication` 同流 FIFO、零过滤） | 探针 1：`["local","replication"]`；`classifyOrigin` L301–308 | 零新实现；NC3 回归锁 + C1/C2 补锚 |

上游事实与源码矛盾：**无**（SA6 探针证据与本轮独立源码实读逐项一致）。

---

## 5. SA1 冻结裁定（lifecycle ordering decisions；对账回写 SA6 §12.1）

> 本节是 SA6「实现前置条件」的显式裁定。**全部裁定与 SA6 契约默认取值一致**——契约
> 规格（用例、断言、fixture 编排）零改动；B-T3-3 给出实现默认契约的具体机制。

| # | 绑定 | **冻结值** | 依据与说明 |
|---|---|---|---|
| B-T3-0 | 继承 #387 B-1–B-7 | **不变**；T3 零新增公共成员（lease 16 键 / runtime 15 键 / index 导出面 / 通知三 kind 形状全冻结） | #387 SA6 §12.1；HEAD 键集守卫（§3.4）。本设计全部新增面为包内模块面（hub 接口方法、env 字段），不经任何 `src/index.ts` |
| B-T3-1 | `watch-end` 入队点 | **= SA6 默认**：schema 路径 = 安装/切换结果的同步段内、同槽 `await notifyDirty()` 之前——本地 = `schema-write.ts` S5.5 `sync.kind==='installed'` 之后、S6 之前（§7-D3）；peer = `replication-session.ts` R5.6 `text` 变化块内、re-arm 结局（applied/failed）与 diag 配对之后、R6 之前（§7-D4）。doc 替换 = reset 关闭 admission 同步段（§7-D5） | ADR 0030 §6 挂点（事务提交后异步分发、schema 安装全覆盖）；ADR 0018 §1 同步段位置（不进事务栈、槽继续 dirty/ACK、零新槽类型零插队）；SA6 探针 2/3 实测段位 |
| B-T3-2 | 【SA1 必裁】peer re-arm **失败**（fatal INVALID/INTERNAL）是否发 `watch-end` | **发**（= SA6 默认）。终止因 = 已提交的 SCHEMA `text` 变更使旧 active schema 下的谓词语义失效——与 re-arm 成败**正交**；`rearmPeerActiveSchema` 失败路径 tools 保持旧的不动（ADR 0018 §3），存活订阅若不终止即陷入「按旧 schema 判定、doc 已是新 text」的静默失配——正是 ADR 0030 备选节（L85）否决的静默存活形态。fatal 后消费方语义：读保留、写永久禁用；重建订阅（重新 `watchMap`）在 T1 建立门下仍可行（lifecycle 仍 'ready'、activeTools 仍在），新订阅按**最后成功安装的旧 tools** 判定——诚实反映 ADR 0018 fatal 态（登记为 §13-R4 残余） | ADR 0030 §4 L51（reason 词表与触发面）+ 备选 L85；ADR 0018 §3（apply 不回滚、tools 不动）；SA6 §12.1 B-T3-2 |
| B-T3-3 | 【承重，SA1 必裁】doc-replaced 投递与 lease force-release 的顺序保证 | **机制 = reset 关闭 admission 内嵌终止编排 + 投递结算进 close 承诺**（§7-D5）：⓪ 共享同步首步 `fanout.terminateAll('runtime-close')`——**现状 session 终止语义，两种风味共同逐字保持**（runtime.ts L628–629 共享 admission 首步；R2-2 不变量，F-1 修订显式化）；① `startCloseAfterFence()` 的同步段先 `watchHub.terminateAll('doc-replaced')`（队尾追加终止项 + 注销订阅），再懒创建 close barrier；② 终止订阅的 `unsubscribe()`（含 force-release 触发的 lease 清理路径）成为**幂等 no-op——绝不清队**；③ 返回的 close 承诺 = barrier 结算 ∧ 全部终止项**已投递**，`registry.resetReplica` 结算（`await closePromise` 之后）即「reset 前已建立的订阅流已含已投递的 `watch-end:'doc-replaced'` 且为末条」——**满足 SA6 默认契约**（强于「最终送达」：确定性、无 poll 依赖）。**不裁**「force-released lease 一律静默」（该读法使 AC3 在 lease 公共面不可满足，SA8 §6 已列为 ADR 修订触发器，无必要启动） | 约束核验：ADR 0010 #133 round-2 冻结次序零破坏——fence 槽本体零改动（不创建/不等待 barrier；终止发生在槽后 lazy continuation 的关闭 admission 层，恰是冻结次序明文允许创建 barrier 的层）；fence → closing → archive 顺序保持（archive 仍在 close 结算后）；「公共 close() 与 startCloseAfterFence 同一幂等入口、同一承诺实例」不变量保持（§7-D5-c）；零新公共接缝（`beginResetFence` 签名不变）。SA6 §12.1 B-T3-3 / §15-1；SA8 行 17 |
| B-T3-4 | `invalidate-all` 与 `watch-end` 关系 | **= SA6 默认**：终止项是队尾追加——终止前已入队的 `invalidate-all`（含溢出降级）照 FIFO 先投递；终止后零通知（含 `invalidate-all` 不后置，结构性成立：注销后无入队点）。T4 #390 溢出注入语义不变 | ADR 0030 §4/§6；NC4 |
| B-T3-5 | 终止后重建语义 | **= SA6 默认**：schema-changed → lease 仍 `active`，消费方重新 `watchMap`（按新 active schema 建立），旧 handle 恒幂等 no-op；doc-replaced → lease 已 released（既有 `NamespaceLeaseReleasedError` 通道，探针 4 R8），重建 = 重新 open/import（Registry 编排）。订阅生命周期只与 lease 和 schema 耦合 | issue AC4/AC6；ADR 0030 §1/§3；探针 2 S9/S11、探针 4 R7/R8 |
| B-T3-6 | 滞留 data「必达」语义 | **必达**（= SA6 默认）：终止是队尾追加，绝不丢已入队 data / invalidate-all；终止与投递之间不存在任何清队点（退订 no-op、force-release no-op、reset 路径 `shutdown()` 后置到投递结算之后且只清已注销外集合）。断言按 SA6 C8(ii)：终止前已提交事务的 data 全部先于 `watch-end` 到达 | issue AC5；ADR 0030 §4 流末条 FIFO；§7-D2 机制论证 |
| §15-4 确认 | doc-replaced 的 lease 可观察场景 | **收窄为 reset**：`importReplica` 为排他创建（live entry / committed snapshot 在场 → `NAMESPACE_ALREADY_EXISTS`）、genesis = 新 doc 建立——两者在「订阅存在」前提下结构性不可达（订阅需要 live lease → live entry）。机制上无需为 import/genesis 增设产出点：`terminateAll('doc-replaced')` 只挂在 reset 关闭 admission，天然与其余路径零接触 | SA6 §15-4；SA8 行 2/§8-5；`registry.ts` importReplica 排他契约 |
| §15-5 确认 | `deleteNamespace` / lease 释放 / shutdown 是否发终止信号 | **不发**（指 `watch-end` 通知——reason 词表层面；ReplicationSession 的共享 admission fanout 终止照常，§7-D5-b）：ADR 0030 §4 reason 词表封闭两值（'schema-changed' \| 'doc-replaced'）；lease 释放（主动/force）与删除是静默清理（ADR 0009 修订节 + ADR 0030 §1「释放即清理」）；registry shutdown 经 runtime close（非终止三因，`watch-map.ts` L89–91 注释既有裁决）。本设计 delete ④ / shutdown / idle close 路径全部保持现状静默 | SA6 §15-5；SA8 行 19；§3.3 对照 |

---

## 6. SA8 约束落实

| 决议或义务（SA8 摘录/冲突报告） | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|
| ADR 0030 §4：三 kind 封闭；`watch-end` `{kind,reason}` 两键、无 origin；流末条、终结三因封闭；数据缺席/删除从不终结 | §7-D1（通知对象冻结两键）、§7-D2（静默结构性） | 实现既有联合成员的**产出**，非扩展词表 | 是（公共通知行为新增可观察值——SA8 §10 已列） |
| ADR 0030 §5：绝不按 origin 过滤（唯一不变量） | §1-AC1；§12 NC3 | 零过滤面新增；classifyOrigin 不动 | 否 |
| ADR 0030 §6：挂点 = 事务提交后异步分发；三来源全覆盖；回调 throw 静默隔离；有界队列 | §7-D1/D3/D4/D5（终止项复用订阅 FIFO 队列与既有泵/隔离；容量豁免仅限终止项） | 终止投递走既有泵（槽外微任务），逐 listener try/catch 沿用 | 是（挂点时序待实现核对） |
| ADR 0030 §7：runtime 承担终止编排；registry 仅 lease 公共面与透传；通知不出进程 | §7-D5（**registry.ts / lease.ts 零改动**，机制全在 runtime 构造栈与关闭 admission） | 分层严格对齐 | 否 |
| ADR 0030 备选 L80/L85/L86：onEnd 独立回调、schema 变更作通知 kind、origin 'admin' 均否决 | §9 备选 Alt-1/Alt-2 排除 | 统一进通知流 | 否 |
| ADR 0018 §1：R5.6 同步段位置（提交后、`await notifyDirty` 前）；不产生新槽类型、不插队 | §7-D4（入队点在 R5.6 块内、R6 前；`void` fire-and-forget，槽不 await 投递） | 槽语义零漂移；dirty/ACK/fatal 照常 | 是（槽语义待实现核对——SA8 §8-3-④） |
| ADR 0018 §3：re-arm 失败 fatal 双码、tools 不动、apply 不回滚 | §5-B-T3-2（失败也发 watch-end；终止与 fatal 置位正交，均不改变 apply 结果联合） | 结果联合 `schemaRearm` 携带不变 | 是（失败分支行为待实现核对） |
| ADR 0018 §4：不加 lease 级 promise/事件；通知面归 watchMap | §7 全部经 watchMap 通知流 | 零 observer 借道、零新事件面 | 否 |
| ADR 0018 §6/§7 + 协议冻结：wire / session 公共面零改动 | §11 DENY LIST | `applyRemoteUpdate` 结果形状不变；ws-replication 零接触 | 否 |
| ADR 0010 #133 round-2：reset 冻结次序（fence → closing → 唯一 barrier → 归档）；fence 槽不创建/不等待 barrier；`NAMESPACE_RESET_*` 稳定码 | §5-B-T3-3 约束核验；§7-D5 | fence 槽本体零改动；终止在关闭 admission 层；archive 时序不变 | 是（reset 次序待实现核对——SA8 §8-3-⑤） |
| ADR 0008 修订节槽序 + runtime AGENTS：单一 FIFO；reads/信号在 FIFO 之外 | §7-D1（入队在槽内同步段、投递在槽外泵——沿 T1 交付形态） | 零新槽类型、零插队 | 否 |
| ADR 0009 #134：release 幂等、released 通道、release 不追踪在途 | §7-D2（退订 no-op 不改 release 语义）；B-T3-5 | released 通道零改动 | 否 |
| ADR 0009 deleteNamespace 修订节：删除 ≠ 替换 | §5-§15-5 确认 | delete 路径静默保持 | 否 |
| ADR 0027/0028 + 守卫门：readData 四键 helper；#369 负控 | §11 DENY LIST（读面零接触）；§12 NC2 | 不触碰 | 否 |
| ADR 0023 + 两包 AGENTS：公共 API 仅经 src/index.ts；键集守卫 | §7-D6（零 index 改动）；§12 C11 | 包内模块面扩展 | 否 |
| ADR 0011/0014：诊断日志槽外纪律；watch 通知非诊断 | §7（终止不经诊断日志） | 零诊断面改动 | 否 |

---

## 7. 设计决策与接口

### D1 — watch hub 终止原语（`watch-map.ts`）

`NamespaceRuntimeWatchHub`（包内模块面，**不经 index 导出**，现况一致）新增一法：

```ts
/** T3（#389 / ADR 0030 §4）终止编排入口：向全部存活订阅的队尾追加
 *  {kind:'watch-end', reason} 并注销订阅；返回「全部终止项已投递」结算承诺。 */
terminateAll(reason: 'schema-changed' | 'doc-replaced'): Promise<void>;
```

语义（逐条冻结）：

1. **快照迭代注销**：对 `subscriptions` 集合快照中每个未退订订阅——置新标志
   `terminated = true`、从集合摘除（此后 `onRootTransaction` 天然跳过 = 零新入队 =
   「此后静默」的结构性保证）、向其队列**队尾追加**深冻结纯数据
   `Object.freeze({ kind: 'watch-end', reason })`（恰两键，无 origin——ADR §4 形状）、
   `schedulePump`。
2. **容量豁免**：容量上界只治理 data 入队（`enqueueData` 的溢出 → `invalidate-all`
   语义逐字不变）；终止项恒入队（队列瞬时可达 capacity+1）——终止项不可丢，否则复活
   「静默死亡」失败形态（AC4 流末条）。
3. **投递结算承诺**：返回的 Promise 在「每个被终止订阅的队列已排空（终止项已投递）」
   时 resolve；**永不 reject**（泵逐 listener try/catch，X1 隔离沿用）。零存活订阅 →
   立即 resolve。schema 路径调用侧 `void` 丢弃（fire-and-forget，零 unhandled
   rejection）；reset 路径 await（§D5）。
4. **幂等**：多次调用各自作用于当时的存活集合（schema 连续两次变更：第二次终止的是
   重建后的新订阅，各得恰一条流末终止项）；已终止订阅不在集合内，天然不重复。

### D2 — 订阅状态机扩展（`terminated` 与 `unsubscribed` 分立）

`WatchSubscription` 增加 `terminated: boolean`（初值 false）与内部 drain 结算回调位：

| 状态 | 入队 | 泵行为 | `unsubscribe()` |
|---|---|---|---|
| 活跃（T1 现状） | data / invalidate-all | 现状不变 | 现状不变：置 `unsubscribed` + **清队** + 摘除（T1 冻结行为 L1 保持） |
| terminated（本设计新增） | **零**（已摘除） | `unsubscribed` 恒 false → 排空至队空；`finally` 中 `terminated && queue.length===0` → resolve drain 承诺 | **首行检查 `terminated` → 幂等 no-op（不清队、零副作用）**——AC4「此后 unsubscribe 幂等 no-op」；也是 force-release 清理路径不清队的机制点 |

- 泵循环条件（L323）不变：terminated 订阅以「排空队列」自然收尾（终止项是队尾 ⟹
  投递完即静默）。泵不触 doc/state——runtime 关闭后仍可安全完成投递。
- **B-T3-6 必达论证**：终止入队（槽内同步段）到投递之间，全部潜在清队点——
  主动退订（D2 no-op）、lease 释放清理（经句柄 → no-op）、reset 路径 `shutdown()`
  （D5 后置到投递结算后，且只作用于集合内存活订阅，terminated 已摘除）——均不清
  terminated 队列；溢出清队只发生在 data 入队路径。⟹ 滞留 data 与终止项全部按 FIFO
  送达。

### D3 — Hub 本地 schema 路径接线（`schema-write.ts` + `runtime.ts`）

- `SchemaWriteEnv`（schema-write.ts L78）新增字段 `readonly watchHub: NamespaceRuntimeWatchHub`
  （类型 `import type { ... } from './watch-map.js'`，包内模块通道）。
- `runSchemaWriteSlot` 在 **S5.5 共享段 `sync.kind === 'installed'` 判定通过之后、S6
  `await notifyDirty()` 之前**插入一行：`void env.watchHub.terminateAll('schema-changed');`
  （不 await 投递——槽语义/时序零变化；S5 事务自身经 ROOT observeDeep 产生的 data
  通知已先行入队，FIFO 天然成立）。
- 边界：S5.5 失败分支（`sync.kind !== 'installed'`，S4 已对同一信封编译成功 ⟹ 结构性
  不可达防御分支）**不加终止产出**——保持 fatal 结算路径逐字不动（残余登记 §13-R3）；
  S3/S4 领域拒绝 = 零事务零通知（NC6 不变，无 watch-end——schema 未变）。
- 不对称注记（SA2 N-3）：同文本 `replaceSchema`（语义 fingerprint 不变、updatedAt 前进）
  在本地路径仍终止（S5.5 `installed` 判定无 text 门），peer 路径仅 `text` 变化才终止
  （R5.6 text 门）——两读法均与 ADR 0030 §4 相容（本地挂点无 text 条件；peer 的 text
  门来自 re-arm 上游既有语义），非设计缺陷；实现注释标注来源，C3 fixture 必须用 text
  实变的信封，**不得**在同文本 replace 上设「零终止」断言。

### D4 — Peer re-arm 路径接线（`replication-session.ts` + `runtime.ts`）

- `RuntimeReplicationHost`（replication-session.ts L340）新增字段
  `readonly watchHub: NamespaceRuntimeWatchHub`（沿 #286 `compile` 字段先例——构造栈
  捕获局部量，INV-N14 纪律延续）。
- `runSessionApplySlot` **R5.6 块内**（`if (schemaBefore.text !== schemaAfter.text)`，
  re-arm 结局与 failed-diag 配对之后、R6 `dirtyStart`/`await notifyDirty()` 之前）插入：
  `void host.watchHub.terminateAll('schema-changed');`
- 覆盖 `applied` 与 `failed` 两结局（B-T3-2 冻结：发）；`text` 未变 ⟹ 不终止（无
  schema 语义变化）；apply 结果联合（含 `schemaRearm` 携带）零改动。
- R5 事务的 data 通知（origin 'replication'）在 handler 内先行入队、终止项队尾追加——
  同槽 FIFO（AC1+AC5 在 peer 路径的同流有序由此成立）。

### D5 — doc 替换（reset）路径接线与顺序冻结（`runtime.ts`；registry 零改动）

a. **构造序微调**：`createWatchHub`（现 V3c'''' 位，L576）提前至 `schemaWriteEnv`
（V3c''，L556）组装之前——其依赖仅 `doc`/`state`（构造栈早期即在场），随后
`schemaWriteEnv` 与 `replicationHost`（V3d''，L603）各捕获该局部量。纯语句序调整，
零语义变化；fanout→watchHub→envs 的捕获局部量纪律（INV-N14）不变。

b. **关闭 admission 分型**：`closeAfterFence` 增参表达两种风味；**共享同步首步
   `fanout.terminateAll('runtime-close')` 上提至分型之前**——现状即两入口共用的
   admission 首步（runtime.ts L628–629），F-1 修订将其在两种风味中显式画出：

```ts
// ── 共享同步首步（两风味一致；现状逐字保持）──
fanout.terminateAll('runtime-close');  // 同步终止/detach 全部现存 ReplicationSession
                                       // （幂等、conflicted 终态不降级：replication-session.ts L327–332）
// ── 正常 close 风味（idle/delete/shutdown/公共 close()）：
//    fanout 终止 + 静默收口（现状逐字保持——watch 订阅静默清场，ADR §4 终结三因不含 runtime close）──
watchHub.shutdown();
return lazyCloseBarrier();
// ── reset fence 风味（startCloseAfterFence 唯一消费者）：
//    fanout 终止（同上共享首步，次序 = 现状）+ watch 订阅终止 + 投递结算 ──
const delivered = watchHub.terminateAll('doc-replaced');  // 同步段队尾追加 + 注销
return lazyCloseBarrier().then(async () => {   // barrier = 排空已接纳槽
  await delivered;                             // 终止项投递结算（有界微任务）
  watchHub.shutdown();                         // 防御收口后置（此时队列已空）
});
```

   - **为何共享首步不可省**（F-1 根因）：公共 `close()` 是 idle close
     （registry.ts L1145）、deleteNamespace ④（L1992）、shutdown 第 3 步（L2148）的
     唯一关闭入口；字面省略首步将使普通 close 后存活 ReplicationSession 不再被同步
     终止/detach——违反 runtime AGENTS「`close()` synchronously stops acceptance,
     terminates live sessions, drains accepted slots, releases exactly once」与 R2-2
     （issue #134 round 2）不变量（runtime.ts L873–875 注释明文：共享关闭 admission
     同步终止/detach 全部现存 sessions，再创建队尾 barrier；reset fence 也走同一入口）。
     正常风味的「现状逐字保持」**包含**该首步（fanout 终止 + 静默收口，缺一即非现状）。
   - reset 风味内首步次序保持现状（fanout 终止先于 watchHub 终止）：二者作用对象分立
     （ReplicationSession channel 集 vs watch 订阅集），无交叉依赖；fanout
     `terminateAll` 幂等保证两条入口汇合时零重复副作用（现状注释 L625–627 语义延续）。
   - 实现注记（SA2 N-1）：reset 风味 barrier reject（`handle.release` 失败 →
     `NamespaceRuntimeCloseError`，close.ts）时 `.then` 成功臂不执行，防御性
     `watchHub.shutdown()` 被跳过——**良性**（terminated 已摘除、集合空走 observer
     快路径、lifecycle='closed' 拒新订阅；终止项仍经独立微任务泵送达；registry 失败
     映射为既有 fatal 通道）。实现不得为「补上」该收口而构造可 reject 的第二承诺链。

c. **同一承诺不变量保持**：runtime 级 close 承诺缓存改为持有**完整 admission 承诺**
（barrier [+ 终止投递 + hub 收口]）；`close()` 首调与 `startCloseAfterFence()` 共用
同一幂等入口、返回同一实例（runtime.ts L615–623 既有不变量；reset 先行后公共 `close()`
复用同一承诺）。风味由**首调用者**固定：`beginResetFence` 在 lifecycle ≠ 'ready' 时拒绝
（L457–461）⟹ 公共 close 先行后 fence 不可达；反向（fence 先行、close 复用）安全。
缓存已置位后第二入口直接复用同一实例、**不重跑任何风味体**——admission（含共享 fanout
首步）恰执行一次（SA2 N-4；fanout `terminateAll` 幂等为双保险）；phase5 T2 双向
same-promise 断言（runtime-phase5-reset-fence-r2.test.ts L199/L204/L217）为既有行为锚。

d. **Registry reset 槽 ⑥ 零改动即可满足契约**：`startCloseAfterFence()`（同步段完成
终止入队）→ `forceReleaseOutstandingLeases(current)`（lease 清理 → 句柄 `unsubscribe()`
→ terminated no-op，队列保全）→ `await closePromise`（含终止投递结算）→ archive →
返回。⟹ `resetReplica` 结算时订阅流**已含已投递的** `watch-end:'doc-replaced'` 末条。

e. **有界性**：投递结算 ≤（capacity+1）项 × 20 微任务让步/订阅，各订阅泵并发；listener
为同步函数（throw 已隔离），无墙钟、无死锁面（承诺只依赖微任务链，不依赖 barrier 或
外部 I/O）。

### D6 — 公共面零新增（AC7）

- lease 16 键、runtime 15 键、`beginResetFence` non-enumerable、index 值导出面与
  type-only 导出面：全部不变（§3.4 守卫即回归锚）。
- 通知联合类型零变化（`watch-end` 成员 T1 已冻结在联合中）；无需新 `*.test-d.ts`
  （SA6 §12.4 第三行结论一致）。

### 主要备选方案（已否决）

| 备选 | 否决理由 |
|---|---|
| Alt-1 终止项同步直调 listener（绕过队列） | 违反 FIFO（ADR 0030 §4 + 备选 L80；SA6 红线 3；C8(i) 变异红） |
| Alt-2 `onEnd` 独立终止回调 | ADR 0030 备选 L80 明文否决（相对顺序无保证） |
| Alt-3 「force-released lease 一律静默」（放弃 AC3 投递） | AC3 在 lease 公共面不可满足 → 需 ADR 修订（SA8 §6 触发器）；且本设计机制代价极小、无破坏面 |
| Alt-4 registry/lease 侧改清队豁免（终止项免于 force-release 清队） | 需改 registry.ts/lease.ts 并在两层重复清理责任；违反 ADR 0030 §7 分层（终止编排归 runtime）；D5 以排序（终止先于释放）达成同一效果且 registry 零改动 |
| Alt-5 schema 槽内 await 终止投递（S5.5/R5.6 等待送达后再 notifyDirty） | 违反 B-T3-1 同步段位置（ADR 0018 §1「槽继续 dirty/ACK 照常」）；使写延迟依赖消费方 listener |
| Alt-6 通用化「退订不清队」（改 T1 L1 冻结语义） | 改动 T1 已冻结公共行为、波及全部既有契约；本设计仅在 terminated 态收窄（AC4 本就要求 no-op） |
| Alt-7 Hub S5.5 不可达防御分支也发终止 | 无可观察路径（S4 同信封已编译成功 + compile 确定性）；保持 fatal 结算逐字不动；登记 §13-R3 |

---

## 8. 接口、状态机与数据流

### 订阅状态机（每订阅）

```
活跃 ──unsubscribe（T1 现状：清队+摘除）──▶ 已退订（终态，静默）
  │  └─lease release 清理 → 同上（经句柄）
  └──terminateAll(reason)（槽内同步段：队尾追加终止项 + 摘除）──▶ terminated
        ├─ 泵排空队列（data… → watch-end）→ 静默终态（drain 承诺 resolve）
        └─ unsubscribe / lease 清理 → 幂等 no-op（队列保全，投递继续）
```

### 数据流路线

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| L1 schema-changed（Hub 本地） | lease `replaceSchema({schema:V2})` → sequencer 'schema' 槽 | S5 事务（SCHEMA±ROOT/META）→ handler 入队 data（若 ROOT 变）→ S5.5 安装 → `terminateAll('schema-changed')` 队尾追加 | 槽内同步段入队、槽外泵投递（20 微任务/项）；跨 runtime→listener 进程内边界 | 无持久化新增（通知是信号非数据） | lease `watchMap` listener | 流末条 `{kind:'watch-end',reason:'schema-changed'}`；lease 仍 active；重建可用 | listener throw 静默隔离（X1）；槽 fatal 语义不变 | C3/C6/C8/C9；NC1/NC3/NC5/NC6 |
| L2 schema-changed（Peer re-arm） | lease `openReplicationSession` + `applyRemoteUpdate(update)`（hub 侧 `replaceSchema(V2)` 的 owned update）→ 'R' 槽 | R5 apply 事务（origin = per-session symbol → data origin 'replication'）→ R5.6 `text` 变化 → re-arm（applied/failed）→ `terminateAll('schema-changed')` | 同上（apply 槽同步段入队、槽外投递）；结果联合 `schemaRearm` 照常携带（oracle 面） | 复制 wire 零改动（通知不出进程） | peer lease listener | 同 L1；failed 时 runtime fatal（写禁读留）但终止项照发 | re-arm fatal 双码/diag 配对不动；B-T3-2 | C4/C6/C8；NC3；既有 re-arm 契约 |
| L3 doc-replaced（reset） | `registry.resetReplica(owner, ns, expected)` → reset 槽 ⑥ | fence 槽（closing）→ 关闭 admission：`terminateAll('doc-replaced')` 同步入队 → barrier 排空 → 投递结算 → hub 收口 | force-release 在入队后同步发生（退订 no-op）；投递结算并入 close 承诺 | 归档在 close 结算后（冻结次序不变）；通知不持久化 | reset 前订阅的 lease listener（lease 随后 released） | `resetReplica` 结算时流已含已投递末条 `{kind:'watch-end',reason:'doc-replaced'}`；此后 lease 面走 released 通道 | fence mismatch/missing 零破坏零终止（订阅照旧存活）；listener throw 隔离 | C5/C7/C10；phase5 reset 契约族 |

无其余运行时数据创建/存储路径变化（通知为进程内信号；零 wire、零持久化、零诊断面）。

---

## 9. 错误、恢复、并发与幂等

- **listener throw**：终止项投递沿用泵逐投递 try/catch（X1）——不影响其他订阅、其他
  项、drain 承诺与写结果。
- **终止产出自身零 throw**：`terminateAll` 只操作内存集合/队列与冻结字面量；在槽内
  同步段调用，任何假设性异常不得改变槽语义（与 handler 零 throw 红线同族——实现以
  纯同步无抛点结构保证）。
- **并发/重入**：单线程 run-to-completion 下入队单写者（sequencer 槽同步段）；
  泵每订阅单飞；listener 内重入 `watchMap`（C9 重建场景）——新订阅独立对象、独立泵，
  terminated 旧订阅不受影响；lifecycle/schemaState 门照常裁决。
- **幂等**：`terminateAll` 幂等（§D1-4）；`unsubscribe` 幂等（T1 + terminated no-op）；
  `close()`/`startCloseAfterFence` 同一承诺（§D5-c）；`release` 幂等（ADR 0009，零改动）。
- **FIFO 证明骨架**：同一订阅队列的唯一写者序列 = sequencer 槽同步段（handler data
  入队 → 终止入队，同槽有序；跨槽按 FIFO 排空）⟹ 终止前已提交事务的 data 全部先于
  终止项；终止后零写者 ⟹ 零僵尸通知。reset 路径此前已接纳写槽在 fence 前排空
  （beginResetFence 同一 sequencer，「此前已接纳任务无条件排空」L467–469 注释）⟹
  其 data 已入队，必达（B-T3-6）。
- **失败可重试性**：终止编排无失败面（纯内存）；reset 的既有失败矩阵（mismatch/
  missing/armed 后 §3.5.2）零改动——mismatch/missing 路径**不发生终止**（零破坏期，
  订阅照旧存活，正确：doc 未被替换）。
- **回滚**：无需回滚机制——终止是不可逆流语义（消费方重建即恢复路径，AC6）。

---

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| watchMap 消费方（UI/agent，经 lease） | 只见 data/invalidate-all；schema 变更后静默存活、reset 后静默销毁 | 可收到 `watch-end`（两 reason）；收到即流终，须重建 | 消费方自行按 reason 重建（T5 #391 文档面）；仓内零调用方（T1 后新增面首次投产） | ADR 0030 §4；探针 2/4 |
| `unsubscribe()` 调用方 | 幂等；清停在队通知 | 幂等；**terminated 后 no-op（不清队）**；非 terminated 行为逐字不变 | 无（AC4 即本语义） | watch-map.ts L466–475；issue AC4 |
| `replaceSchema` 调用方（hub lease） | ok 后订阅照旧 | ok 后全部存活订阅终止（schema-changed） | 无接口变化；行为即 AC2 | lease.ts L391–397 透传零改动 |
| `applyRemoteUpdate` 调用方（ws-replication 层 / 测试） | 结果联合含 `schemaRearm` | 同左 + 副作用：text 变化时 peer 订阅终止（含 failed） | 无 | replication-session.ts L859–863 结果组装零改动 |
| `registry.resetReplica` 调用方 | ok 后订阅静默销毁 | ok 结算时终止项已投递；归档时序不变（多 await 一段有界微任务投递） | 无 | registry.ts L1856–1902 零改动 |
| `runtime.close()` / idle close / deleteNamespace / shutdown | 共享 admission：`fanout.terminateAll('runtime-close')`（同步终止存活 ReplicationSession）+ 静默 `watchHub.shutdown()`（watch 订阅静默清场） | **逐字保持**——正常风味保留共享 fanout 终止首步（R2-2 不变量）+ 静默收口；仅 reset 风味新增 watch 订阅终止与投递结算 | 无 | runtime.ts L628–635 / L873–875；registry.ts L1145 / L1992 / L2148（idle/delete/shutdown 消费点）；§3.3 对照；§5-§15-5 |
| 诊断日志 / observer 面 | 无 watch 事件 | 无（终止不经诊断） | 无 | ADR 0011/0014；SA8 行 22 |
| 既有测试（#387 21/21、#369 33/33、phase5 reset/re-arm/replication 契约族、键集守卫） | 绿 | 应保持绿（T1 语义非 terminated 路径零变化；槽/关闭链对外语义零变化；唯一新增时序 = reset admission 承诺多含一段投递结算——phase5 fence 契约断言的 barrier 语义不变） | 无（若个别测试对 close 承诺内部时序有更细断言，以测试事实为准逐点核对，属实现期验证） | SA6 §4/§6 基线 |

---

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/namespace-runtime/src/watch-map.ts` | ① `WatchSubscription` 增 `terminated` 与 drain 结算位；② hub 接口增 `terminateAll(reason): Promise<void>`（快照注销 + 队尾追加 + 容量豁免 + 投递结算承诺）；③ `unsubscribe` 首行 terminated → 幂等 no-op；④ 泵 `finally` drain 结算；⑤ 头注边界段更新（watch-end 从「T3 非目标」改为已交付说明） | §7-D1/D2 终止原语与状态机 |
| `packages/namespace-runtime/src/runtime.ts` | ① `createWatchHub` 构造位前移（watchHub 早于 schemaWriteEnv/replicationHost 组装）；② `closeAfterFence` 分型——**共享同步首步 `fanout.terminateAll('runtime-close')` 在两种风味中保持（现状 session 终止语义逐字不动，R2-2——F-1 修订）**；正常风味 = fanout 终止 + 静默 shutdown（现状逐字保持）；reset 风味 = fanout 终止 + `watchHub.terminateAll('doc-replaced')` + 投递结算并入 close 承诺（缓存完整 admission 承诺）；③ `schemaWriteEnv` 与 `replicationHost` 增 `watchHub` 字段 | §7-D3/D4/D5 接线与顺序冻结 |
| `packages/namespace-runtime/src/schema-write.ts` | `SchemaWriteEnv` 增 `watchHub` 字段（类型导入包内通道）；S5.5 installed 后、S6 前插 `void env.watchHub.terminateAll('schema-changed')` | §7-D3 |
| `packages/namespace-runtime/src/replication-session.ts` | `RuntimeReplicationHost` 增 `watchHub` 字段；R5.6 text 变化块内（结局+diag 后、R6 前）插 `void host.watchHub.terminateAll('schema-changed')` | §7-D4（B-T3-2） |
| `packages/namespace-registry/test/issue-389-change-subscription-t3-fixture.ts`（新增，实现切片落盘） | 共享 fixture（SA6 §12.4 规格：双 Registry 装配、replica stub、session 编排、update 捕获、sink、终止屏障、readData helper） | 契约可执行性 |
| `packages/namespace-registry/test/issue-389-change-subscription-termination-red.test.ts`（新增，实现切片落盘） | 主契约 C1–C11 + NC3/NC5/NC6 回归锚 | 红绿验证 |

实现切片另须满足：根 `pnpm typecheck`、`pnpm test`（runtime + registry 契约族）通过；
SA1 本轮不落盘任何测试（Host dispatch：「Do not implement or author acceptance tests」）。

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/namespace-registry/src/registry.ts` / `lease.ts` / `types.ts` / `index.ts` | reset 槽、force-release、lease 透传 | B-T3-3 机制全部落在 runtime 侧，registry 零改动（§7-D5-d）；键集与 released 通道冻结 |
| `packages/ws-replication/**`、`docs/protocols/**` | 复制协议消费方 / wire 权威 | ADR 0030 §7「通知不出进程」；ADR 0018 §6 wire 零变更（SA8 §5 冻结面） |
| `docs/adr/**`、`CONTEXT.md`、`docs/**` | 规范面 | 本票为 ADR 0030 既有义务兑现，零决策变更（SA8 §6：无 evolution-required）；文档面归 T5 #391 |
| `packages/namespace-runtime/src/{read-schema-projection,window-read,projection}.ts` 及 readData/readArray/readMap 面 | 读面 | ADR 0027/0028 冻结；NC2 |
| `packages/namespace-diagnostic-log/**`、runtime 诊断面（`diagnostic.ts` 等） | 观测面 | watch 通知非诊断日志（ADR 0011/0014；CONTEXT `_Avoid_`） |
| `packages/namespace-runtime/src/{schema-rearm,p0,close,write}.ts` 的既有语义段 | 共享段/槽序 | `syncActiveSchemaFromCommittedDoc`/`rearmPeerActiveSchema`/close barrier 本体零改动（接线只在调用方 env + 槽内插入一行；schema-rearm.ts 预计零 diff） |
| 既有测试：`issue-387-*`、`issue-369-*`、`registry-phase5-*`、`runtime-phase5-*`、`registry-open.test.ts`、`runtime-acceptance-exports-audit.test.ts` 等 | 回归基线/键集守卫 | 基线必须原样保持绿（NC1/NC2、C11） |
| `packages/namespace-registry/.sa6-389/**`（SA6 临时探针，已按其 §16 清理） | 诊断残留 | 非本设计产物；保持不存在 |

---

## 12. 验收与验证映射

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1 origin 两态 + 同流 FIFO（HEAD 已具备） | 探针 1（`["local","replication"]`） | C1/C2（SA6 §12.3 最小调用） | 恰一条 data/来源，origin 逐字；零 watch-end；无过滤 |
| AC2 本地 schema 路径 | 探针 2（watch-end 0 = 红证据） | C3：replaceSchema(V2) ok + `getSchema().text` 切换 oracle → 终止屏障 | 流末条 `{kind:'watch-end',reason:'schema-changed'}`（`toStrictEqual`，恰两键）；此前 data 先达；fixture 用 text 实变信封（同文本 replace 本地也终止——§7-D3 N-3 注记，勿设零终止断言） |
| AC2 Peer re-arm 路径 | 探针 3（re-arm applied 而零 watch-end） | C4：`schemaRearm.kind==='applied'` + 指纹一致 oracle → 终止屏障 | peer 流末条 schema-changed；B-T3-2（设计增补：failed 分支同断言——fixture 以损坏 text update 构造 fatal，断言 watch-end 仍达且 apply ok 携带 `schemaRearm.kind:'failed'`） |
| AC3 doc 替换 | 探针 4（reset ok 而零 watch-end） | C5：resetReplica ok（archive 1 次）→ **无需 poll**（D5-d 结算即已投递） | reset 结算后流已含末条 doc-replaced；lease released（R6/R8 既有通道） |
| AC4 流末条静默 + 退订幂等 | 探针 4 R7 | C6/C7：终止后「写 + 双预算屏障」；`unsubscribe()` ×2 | 终止后零新增通知（含 invalidate-all）；×2 零 throw 零通知 |
| AC5 FIFO（含滞留 data 必达） | SA6 §7 时序事实（20 微任务让步窗口） | C8 确定性配方（多笔事务 → 立即 replaceSchema）：(i) watch-end 末位 (ii) data 计数 == 事务数（B-T3-6 必达）(iii) 终止后零通知 | 三断言全绿；变异敏感：绕队列 → (i) 红；清队 → (ii) 红 |
| AC6 终止后重建 | 探针 2 S9/S11、探针 4 R7/R8 | C9（schema-changed：lease active + 重新 watchMap 按新 schema 建立并投递 + 旧 handle no-op）；C10（doc-replaced：released 通道 + 重新 open/import 后新订阅可用） | 重建即恢复；订阅生命周期只与 lease 和 schema 耦合 |
| AC7 零新接缝 | 键集守卫（§3.4） | C11：`Object.keys` 16/15 断言照绿；通知 kind ⊆ 三 kind 闭集 | 零新增公共成员/导出/子路径 |
| 容量豁免不变量（§7-D1-2；设计新增） | 无（新不变量） | **优选落盘**断言（SA2 N-5：非阻断，落盘裁量归实现切片）：连续 >16 笔快连事务（不经泵投递）后 replaceSchema → 流含 `invalidate-all`（溢出降级）后随 `watch-end` 末条 | 终止项不因容量丢失、溢出语义不变（T4 前置锚——B-T3-4/T4 边界唯一行为锚） |
| **close 同步终止 sessions（F-1 修订回归锚）** | `runtime-replication-session-round2.test.ts` R2-2 族（L438–479：close 后 session 终态 closed、apply → `RUNTIME_WRITE_DISABLED` close 域文案、重复 close 同实例、终态 throw；L425 conflicted 不降级）；phase5 fence 契约族（L199/L204/L217 双向 same-promise） | 实现后全量重跑（本票零改动该语义——纯回归门，无新测试义务） | close admission 同步终止/detach 全部存活 ReplicationSession（两种风味一致）；终态不降级；same-promise 断言全绿 |
| reset 冻结次序零破坏 | phase5 reset 契约族（HEAD 绿） | 实现后全量重跑 phase5 reset/bootstrap/identity 契约 | 全绿（SA8 §8-3-⑤） |
| ADR 0018 槽语义零漂移 | re-arm 契约（HEAD 绿） | 实现后重跑 re-arm/replication-session 契约族 | 全绿（SA8 §8-3-④） |
| 负控 NC1–NC6 | #387 21/21、#369 33/33、NC3–NC6 在 T1 契约内 | 实现后重跑 + 新契约内回归锚 | 全绿 |
| 工具链 | 根 typecheck exit 0 | 实现后根 `pnpm typecheck` + `pnpm test` | exit 0 |

---

## 13. 风险、回滚与残余问题

| # | 风险/残余 | 评估与缓解 |
|---|---|---|
| R1 | reset 结算延迟增加（终止投递结算并入 close 承诺） | 有界（≤(16+1)×20 微任务/订阅，并发泵）；无墙钟、无 I/O 等待；换得 C5 确定性（免 poll） |
| R2 | 终止投递期间 consumer 重入（listener 内再 watchMap / 再写） | 构造性安全（独立订阅对象 + 门序裁决）；C9 覆盖重建正例；写门在 schema-changed 后仍 ready（新 schema 生效） |
| R3 | Hub S5.5 内部失败防御分支（结构性不可达）不发 watch-end | 无可观察路径（S4 同信封编译成功 + compile 确定性）；若未来结构性改变，订阅将静默存活——登记为实现期注释与 follow-up 观察项（不进本票范围） |
| R4 | Peer re-arm fatal 后重建订阅按旧 tools 判定（doc text 已新） | T1 建立门冻结行为（不查 fatal）；ADR 0018 fatal 态本就是降级终局（写禁读留、Peer 主动 CLOSE_NAMESPACE）；watch-end 已诚实告知「schema 语义已变」——消费方语义归 T5 #391 文档面；本票不改门 |
| R5 | registry shutdown / delete / idle close 下**watch 订阅**静默终结 | 规范行为（runtime close 非 ADR §4 终止三因；reason 词表封闭）；§5-§15-5 确认。表述消歧（F-1）：「静默」仅指 watch 订阅零 `watch-end`——共享 admission 首步 `fanout.terminateAll('runtime-close')` 照常同步终止 ReplicationSession（R2-2，§7-D5-b；§12 回归锚行） |
| R6 | close 承诺缓存语义微调（完整 admission 承诺）波及 phase5 fence 契约与 R2-2 session 终止族 | 不变量「close() 与 startCloseAfterFence 同一实例」显式保持（§7-D5-c）；phase5 契约族 + R2-2 session 终止族为回归门（§12 两行） |
| 回滚 | 单提交切片（4 个 runtime 源文件 + 2 个新测试文件）；回滚 = revert 提交，无数据/持久化迁移面 | — |

**任务内已解决**：三条终止路径编排、三个 SA1 冻结位（§5）、容量豁免、投递结算机制、
共享 close admission 首步的显式保持（F-1）。
**明确 follow-up（非本票）**：T4 #390（溢出注入 + 父路径删除 + runtime 键集纯加法验收）、
T5 #391（消费方文档：watch-end 重建指引、fatal 态语义、shutdown 静默说明；另收 SA2 N-2
措辞输入——「doc-replaced = 所订阅 generation 的终结信号」，不以 archive 成败为条件：reset
armed 后 archive 失败时终止项已投递而旧 doc 字节仍在，重建后重拉自愈）。

---

## 14. 评审修订映射

评审输入在场：`wiki/raw/task_issue-389_sa2_review.md`（iteration 0，verdict = **reject**，
1 × MAJOR F-1；B-T3-3 承重机制经独立核验成立）。本 iteration 1 逐条落实：

| Finding | 修订位置 | 处理结果 |
|---|---|---|
| **F-1（MAJOR）** D5-b 正常 close 风味伪代码省略共享 admission 首步 `fanout.terminateAll('runtime-close')`，且误注「现状逐字保持」——字面实现将使普通 close（idle/delete/shutdown）不再同步终止存活 ReplicationSession（违反 runtime AGENTS 与 R2-2） | §7-D5-b（伪代码重写：fanout 终止上提为两风味**共享同步首步**；正常风味注记更正为「fanout 终止 + 静默收口（现状逐字保持）」；附「为何共享首步不可省」根因段）；§7-D5-c（单次 admission 恰执行一次的补述）；§5-B-T3-3（机制枚举前置 ⓪ 共享首步，标注现状保持）；§3.1（接线描述补全首步）；§10（close 路径调用方行修正——现状处理 = fanout 终止 + 静默 shutdown）；§11 runtime.ts ②（预期改动补述）；§12（新增 R2-2 家族回归锚行）；§13-R5/R6（表述消歧与回归门） | **已落实**。修订后两种风味均显式含 fanout 终止；B-T3-3 冻结值与机制骨架（终止先于 force-release 入队 + 投递结算并入 close 承诺 + registry 零改动）零变化；C1–C11 验收映射零影响；验收 = 修订后伪代码两风味均含 fanout 终止 + 既有 session-termination-on-close 契约族（`runtime-replication-session-round2.test.ts` R2-2 族）与 phase5 全套在实现切片全绿（§12 新增行） |
| N-1（非阻断）reset 风味 barrier reject 时跳过后置防御性 `watchHub.shutdown()` | §7-D5-b 实现注记 | 已登记为实现注释要求（良性：terminated 已摘除、集合空、lifecycle='closed' 拒新订阅；禁止补出可 reject 的第二承诺链） |
| N-2（非阻断）reset armed 后 archive 失败：`doc-replaced` 已投递而旧 doc 字节仍在 | §13 follow-up 输入登记 | 已登记为 T5 #391 文档措辞输入（「doc-replaced = 所订阅 generation 的终结信号」，不以 archive 成败为条件）；机制零改动 |
| N-3（非阻断）同文本 `replaceSchema` 本地仍终止（无 text 门）vs peer 仅 text 变化才终止的不对称 | §7-D3 不对称注记；§12 AC2 本地路径行 fixture 注记 | 已登记：两读法均与 ADR 0030 §4 相容（本地挂点无 text 条件、peer 的 text 门来自 re-arm 上游）；fixture 须用 text 实变信封，勿设零终止断言 |
| N-4（非阻断）「风味由首调用者固定」的缓存细节未展开 | §7-D5-c 补述 | 已补述（缓存已置位后第二入口直接复用同一实例、不重跑任何风味体；admission 恰执行一次；phase5 T2 双向 same-promise 断言为既有锚） |
| N-5（非阻断）容量豁免断言建议尽量落为非可选 | §12 容量豁免行 | 升格为「优选落盘」（SA2 裁定非阻断，落盘裁量归实现切片；B-T3-4/T4 边界唯一行为锚） |

---

## 15. 是否需要设计后 ADR 冲突复查

**是（`requiresConflictRecheck = true`）**。理由：

1. 本设计触碰**生命周期次序**（reset 关闭 admission 内嵌终止投递 vs lease
   force-release / close barrier；close 承诺缓存语义微调）、**失败语义**（B-T3-2：peer
   re-arm fatal 分支也发 watch-end）、**状态机段挂点**（S5.5 / R5.6 入队时机）与
   **公共通知行为**（watch-end 首次产出、unsubscribe 在 terminated 态的 no-op 语义）——
   均属 SA8 冲突报告 §10 所列触发条件（其复查门现为 true，待实现后按 §8-3 清单 ①–⑦
   闭合）。
2. SA8 §8-1 明示「B-T3-3 的 SA1 冻结机制落盘后亦须按 §8-1 对账」——本设计 §5-B-T3-3
   即该机制落盘，须对账。
3. 本设计**不需要 ADR 修订**：全部裁定是 ADR 0030/0018 既定义务的兑现或文本缺口
   实例化（与 SA8 §6/§7 结论一致）；未推翻任何已接受决策、未新增 reason/origin 词表
   成员、未改 wire/持久化/schema 面。
4. F-1 修订**不新增 ADR 冲突面**：共享首步 `fanout.terminateAll('runtime-close')`
   即现状共享 admission 组成（SA8 摘录 `task_issue-389_relevant_decisions.md` L138–139
   已记载；SA2 评审附记同证）；SA8 已登记的复查门（实现后按 §8-3 ①–⑦）不受影响、
   无需因本评审轮追加。
