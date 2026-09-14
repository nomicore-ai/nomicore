# SA8 相关决策摘录 — issue #389：复制来源与订阅终止（变更订阅 T3）

- 任务类型：feature（ADR 0030 既有决策的 T3 实现切片）
- 被审对象：issue #389 验收契约 = 任务简报 `wiki/raw/task_issue-389.md`（What-to-build + AC1–AC7）
  + 已批准的 SA6 验收契约 `wiki/raw/task_issue-389_sa6_contract.md`（C1–C11 / NC1–NC6 / B-T3-0–B-T3-6 / §12.6 红线）
- 摘录纪律：只摘录相关决策、条款与关联点，不重写原义、不做业务设计。
  规范权威 = `docs/adr/`（28 篇均「已接受」；0007 部分取代于 0008、0016/0024 交付条款经 0027 修订、
  0010 的「Peer reset/重启才能切 schema」条款经 0018 §7 废止——被取代条款与本票均无接触面）
  + `CONTEXT.md` 术语 + 模块 AGENTS 收录决策面 + `docs/protocols/instance-replication-v1.md`。
  源码仅用于确认当前事实，不替代决策文本。

---

## 1. ADR 0030《变更订阅——watchMap 的键容器变更信号》（规范权威；Parent PR #386）

### §4 通知流（L41–53）——本票核心条款

- 三 kind 封闭（L43–47）：`data` `{kind,origin,changes:[{path,key}]}` / `invalidate-all` `{kind,origin}` /
  `watch-end` `{kind,reason}`；`data.changes` 定位符恰两键，`[...path,key]` 直接拼下一轮读路径；
  同事务同 key 合并。
- **`watch-end`（流末条，此后静默）**（L51）：`reason: 'schema-changed'`（**本地 `replaceSchema` 或
  Peer re-arm**）| `'doc-replaced'`（**reset / bootstrap import / genesis 一族**）。统一进通知流
  （不走独立回调）保证与滞留 data 通知的 FIFO。**订阅终结只有三因：lease 释放、schema 变更、
  doc 替换；数据缺席与删除从不终结订阅。**
- `origin: 'local' | 'replication'`（L52）——self-echo 抑制刚需（**消费方**过滤自己触发的写）；
  实现上 Yjs transaction origin 天然可区分。
- 备选节已否决（L80/L85/L86）：**onEnd 独立终止回调**（与队列相对顺序无保证）；**schema 变更作为
  通知 kind**（静默存活最坏结局是 field 缺失恒不匹配的静默死亡——「终止信号（`watch-end`）+
  消费方重建才是机制正确形态」）；**origin 含 'admin'**（其全部承载场景 reset / import / schema
  安装都走 `watch-end`，收敛两态）。
- **关联点**：issue AC1（origin 两态）、AC2（schema-changed 两路径）、AC3（doc-replaced）、
  AC4（流末条静默/幂等退订）、AC5（FIFO）；SA6 C1–C8、B-T3-4、§12.6 红线 3/4/5。

### §5 判定纪律（L55–60）

- 宁多勿漏唯一不变量：漏 = 消费方永久持有过时数据（不可接受）；**绝不按 origin 过滤**（通知条件
  与过滤面均不涉 origin——过滤责任在消费方）。消费协议 v1 = 建立后先全量拉一次、之后按 key 幂等拉终态自辨。
- **关联点**：AC1（本地/远端同一套通知）、SA6 NC3（无过滤回归锁）。

### §6 分发（L62–67）

- 挂点 = **写序列器事务提交后异步分发**（沿诊断日志「sequencer slot 之外」纪律）——
  **全覆盖本地受控写、复制 apply、schema 安装三种来源**；回调 throw 静默隔离；有界队列溢出 →
  `invalidate-all`（订阅存活，数值不进公共契约）；合并/节流归桥接层。
- **关联点**：AC1（复制 apply 驱动面）、AC5、SA6 B-T3-1（入队点位）、NC4、§12.6 红线 3。

### §7 分层与契约归属（L69–73）

- runtime：订阅簿记、谓词求值、宁多勿漏判定、异步分发与有界队列（写序列器挂点、
  **schema 安装 / doc 替换的终止编排**）；registry：lease 公共面、类型别名与透传；
  **通知不出进程：复制协议（instance-replication-v1）零改动**。
- **关联点**：AC7（零新接缝）、SA6 §10 影响面、§12.6 红线 1/2。

### 验收缝（L88–97）

- 主缝 = **lease 公共面（零新接缝，`@nomicore/namespace-registry` 契约测试家族）**；通知流验收明示
  「`watch-end` 两 reason（**含 Peer re-arm 路径**）与流末条静默」；先例 = #369 窗口读三件套、
  replication-session lease 面家族；生命周期验收含 lease 释放清理、退订幂等无回声。
- **关联点**：AC7、SA6 C11（lease 恰 16 键 / runtime 恰 15 键——继承 #387 冻结 B-1–B-7）。

## 2. ADR 0018《Peer schema 热重装与 re-arm fatal 语义》

- **§1 apply 槽提交后 schema 同步段**（L24–42）：Peer 复制 apply 槽在 live 事务提交之后、
  `await notifyDirty()` 之前插入同步段（比对四键投影 → 编译 → 原子安装切换 active identity）；
  槽继续：dirty notification、UPDATE_ACK / SYNC_APPLIED 照常；不产生新槽类型、不插队，
  strict FIFO 不变量零改动。
  **关联点**：issue AC2 第二路径（Peer 复制 apply 槽的 schema re-arm）；SA6 B-T3-1 peer 位
  （`replication-session.ts` R5.6 同段）、§12.5-4 前置 oracle（`schemaRearm.kind==='applied'` + 指纹一致）。
- **§3 失败语义**（L55–73）：编译失败 = 确定性 fatal 双码（`NSRT-FATAL-SCHEMA-REARM-INVALID/INTERNAL`，
  `errors.ts` append-only）；**tools 保持旧的不动；apply 本身不回滚**（失败发生在 live 提交之后）；
  该 Runtime 写永久禁用、读保留；Peer 主动 CLOSE_NAMESPACE。
  **关联点**：SA6 B-T3-2（re-arm **失败**是否仍发 `watch-end`——决策文本未覆盖的缺口，SA1 必裁）。
- **§4 宿主通知**（L75–109）：复用 observer 注册表（`schema-rearm-applied/failed`）与拉取 seam；
  **ADR 0008「v1 不提供公共事件订阅」边界不破：不加 lease 级 promise/事件**（通知面归 observer/status，
  与 watchMap 通知流是两个面）。**关联点**：B-T3-2 裁决不得借道新增 lease 级事件面。
- **§6 明确不动**（L120–131）+ **§7 取代**（L133–141）：wire 协议零变更；Hub 行为不变；Peer 无 SCHEMA
  写权不变；废止 ADR 0010「Peer 必须 reset/重启才能切 schema」条款。
  **关联点**：SA6 §12.6 红线 1（复制协议与 session 公共面零改动）。

## 3. CONTEXT.md 词条（术语一致性基准）

- **L65–67「变更订阅」**：三 kind、`watch-end`（schema 变更 / doc 替换，流末条）、origin 两态、
  「挂点 = 写序列器事务提交后异步分发（**本地写 / 复制 apply 全覆盖**）」、「订阅生命周期与数据在场性
  解耦，**只与 lease 和 schema 耦合**」、宁多勿漏、有界队列。_Avoid_：observer（Registry 诊断 seam 撞词）、
  泛 watch/push/事件流、把 watchMap 与 subscribeOwnedUpdates / 诊断变更日志混用。
  **关联点**：issue AC6（终止后重建——生命周期只与 lease 和 schema 耦合）、AC1、AC4、AC5。
- **L121「active schema」**：SCHEMA write transaction 成功后（Hub）或复制 apply 槽 **re-arm 成功后**
  （Peer）同步切换。**关联点**：B-T3-2 的「成功才切换」读法输入。
- **L123–124「schema re-arm」**：提交 SCHEMA 变化后同步重装；失败属 fatal、Peer 主动关闭 channel。
- **L186「ReplicationSession」**：lease 打开的受信任 duplex 会话；`applyRemoteUpdate` 进本地唯一
  write sequencer。**关联点**：AC1 驱动面（经 lease `openReplicationSession` + `applyRemoteUpdate`）。

## 4. ADR 0008（Runtime/写序列器）与 ADR 0009（Registry/Lease）

- ADR 0008 L101：「v1 不提供公共事件订阅；队列进度和内部事件属于日志、metrics 与 trace」——
  语境为 status 可观测性段；watchMap 为 ADR 0030（后法、特定授权）的业务信号面（#387 SA8 已裁决窄读）。
- ADR 0008 修订节：单一严格 FIFO write sequencer、完整槽序（… → 单 Yjs transaction → 同步投影 →
  `await notifyDirty()`）不变；稳定码以 `errors.ts` append-only 注册表为准。**关联点**：B-T3-1
  （watch-end 入队进同步段、分发槽外——不新增槽类型）。
- ADR 0009 §NamespaceLease + #134 修订节：lease 独立 capability；release 幂等；首调同步段标记
  released；released lease 后续操作走既有 `NAMESPACE_LEASE_RELEASED` 通道；release 同步段调用活跃
  session `close()`、不追踪在途。**关联点**：B-T3-5（doc-replaced 后重建 = 重新 open；re-watch 得
  released 通道）；B-T3-3（force-release 与终止投递的次序约束之一）。
- ADR 0009 修订节 deleteNamespace：forceRelease → cancelIdleArm → close admission → 删除——
  **删除 ≠ 替换**，不在 `watch-end` reason 词表内。**关联点**：SA6 非目标（deleteNamespace 不发终止信号）。

## 5. ADR 0010（复制）+ issue #133 round-2 reset 修订

- Peer 冲突恢复使用带 `expectedLocalIdentity` 的 `resetReplica()`；bootstrap 经 Persistence 受控复制
  导入能力**排他创建**（普通 create 不得预建同 key namespace）。
- **reset 冻结次序**（issue #133 round-2 修订）：preflight 与 close admission 共享同一 Runtime FIFO
  reset-fence 槽（先核对双事实，再在槽返回前同步进入 closing）；**fence 槽绝不创建或等待 close
  barrier**；槽结算后懒 close continuation 才创建唯一 close barrier；此后 Persistence 归档 → bootstrap
  资格；身份/序号类稳定码（`NAMESPACE_RESET_*`）冻结。
  **关联点**：issue AC3、SA6 B-T3-3（doc-replaced 终止投递机制不得破坏 fence → closing → archive
  冻结次序）、§15-4（import/genesis 在「订阅存在」前提下结构性不可达——排他创建/新 doc）。
- 复制 wire / 帧格式 / 错误码 / reason 词表以 `docs/protocols/instance-replication-v1.md` 为唯一权威
  （ADR 0013/0022 冻结值同源）。**关联点**：SA6 §12.6 红线 1（零改动）。

## 6. 其余交叉决策（冻结面，零接触即可）

- ADR 0011/0014（诊断变更日志）：best-effort 观测；emit never throws；lifecycle 调用点在
  NamespaceRuntime write sequencer slot 之外——ADR 0030 §6 引用的「槽外」纪律来源；watch 通知
  不是诊断日志，不得混用。
- ADR 0023（proxy-consumable frozen service surfaces）：`ctx.provide` 服务对象访问器纪律
  （registry 构造面）。
- ADR 0027（readData 恒四键 + 投影文本 + ✂ 段；仓库守卫门 #333/#336/#364：形状断言经集中化 helper）。
- ADR 0028（窗口读 API 与词表冻结；#369 契约族 = 负控基线）。
- ADR 0025/0026（mutation 信封 / 原子可见）：一事务一通知的结构性基础。
- 模块 AGENTS：registry「Add public APIs only through `src/index.ts`」；runtime「单一 FIFO、
  公共面仅 detached 投影、`@nomicore/namespace-registry` 经 internal seam 装配」。

## 7. 事实基线（源码核验，非规范）

- `packages/namespace-runtime/src/watch-map.ts` L67：`watch-end` 类型联合成员在场（reason 两值逐字）；
  全仓 `packages/*/src` 内 `watch-end` 零产出点（仅类型字面量与注释）；L37 注释明示
  「`watch-end` 终止编排与 `'replication'` 验收断言（T3 #389）」归属本票。
- `runtime.ts` L576（createWatchHub）/ L628–635（`closeAfterFence` 同步 `fanout.terminateAll` +
  `watchHub.shutdown()`，注释明示「静默——ADR §4 终结三因不含 runtime close」）/ L753（watchMap 透传）。
- `registry.ts` L1181（`forceReleaseOutstandingLeases`）；reset 槽 continuation L1865–1866
  （`fence.startCloseAfterFence()` → `forceReleaseOutstandingLeases(current)`）；L1987 起 = deleteNamespace
  破坏性段（另一处 forceRelease，删除路径）。
- `schema-write.ts` S5.5 同步段（L282–290，`syncActiveSchemaFromCommittedDoc`，位于事务提交后、
  S6 `await notifyDirty` L308–310 之前）；`schema-rearm.ts` L122（Hub 本地路径）与 L209
  （`rearmPeerActiveSchema`，Peer R5.6）；`replication-session.ts` L9/L42/L487（apply 槽 R1–R7 含 R5.6、
  `applyRemoteUpdate`）。
- lease 恰 16 键（`registry-open.test.ts` L942 含 `'watchMap'`）；runtime 恰 15 键
  （`runtime-phase5-reset-fence-r2.test.ts` L131–146 含 `'watchMap'`，注释标 #387）。
- SA6 探针证据：`artifacts/sa6-issue389-*.log`（15 份在场：4 探针 + 复跑 + 产出面 grep + 基线 + runner）。
- `docs/` 全树（ADR 0030 除外）与 `docs/protocols/` 零 `watchMap`/`watch-end` 名目——复制 wire/
  规范文档与本票词汇零接触（本轮 grep 复核）。
