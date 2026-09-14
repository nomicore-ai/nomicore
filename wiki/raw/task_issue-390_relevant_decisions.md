# SA8 前置门禁相关决策摘录 — issue #390：溢出降级与父路径删除（变更订阅 T4）

- 任务简报：`wiki/raw/task_issue-390.md`（issue #390，open；Parent PR #386；Blocked by #387）
- 摘录范围：只摘录与 #390 被审行为相关的决策条款与关联点；不重写原义、不作业务设计。
- 决策集状态：`docs/adr/` 全 28 篇均为「已接受」，无被 supersede 的在约束 ADR（0016/0024 的修订谱系属 readData 投影面，与 #390 无关）。
- 源码/类型/测试在本文中只用于标注「当前事实」，不替代决策文本。

## A. 规范权威（issue 自称）：ADR 0030 决策 4 / 6

`docs/adr/0030-change-subscription.md`（2026-09-14 已接受；影响包 `@nomicore/namespace-runtime`、`@nomicore/namespace-registry`；**既有 readData / 窗口读 / 复制面零改动**）

### 决策 4（通知流）——`docs/adr/0030-change-subscription.md` L41–53

- 三 kind 冻结形状：`{kind:'data', origin, changes:[{path,key}]}` / `{kind:'invalidate-all', origin}` / `{kind:'watch-end', reason}`；
- L50：**`invalidate-all`（订阅存活）：触发源 = 通知队列溢出、父路径删除（容器删除/重建期间订阅横跨缺席期，重建后条目照常到达）**；
- L51：订阅终结只有三因：lease 释放、schema 变更、doc 替换；**数据缺席与删除从不终结订阅**；`watch-end` 统一进通知流保证 FIFO；
- L52：`origin: 'local' | 'replication'` 两态；
- L53：无 `version` / `rev` 字段（备选已否决：丢失检测唯一信号本就是 `invalidate-all`）。

### 决策 6（分发）——同文 L62–67

- L64：挂点 = **写序列器事务提交后异步分发**（沿诊断日志「sequencer slot 之外」纪律）——全覆盖本地受控写、复制 apply、schema 安装三种来源；
- L65：回调 throw 静默隔离（通知失败不是业务失败，不改变写结果与 sequencer 行为）；
- L66：**有界队列，溢出 → `invalidate-all`（消费面是读，全量重拉即自愈，无需 ReplicationSession 的 needs-resync 重协商）；数值不进公共契约——语义进契约，数值是构造参数 + 实现默认**；
- L67：合并 / 节流归桥接层；引擎只保证事务级原子通知 + FIFO。

### 决策 3（建立判定，缺席语义的另一半）——同文 L33–39

- L38：**数据缺席合法**：schema 已声明的容器未物化/已删除均可订阅；读对缺席诚实报错（`WINDOW_TARGET_ABSENT`），订阅对缺席宽容等待；
- 备选已否决（L84）：「订阅目标缺席响亮拒绝」——迫使消费方编排时序；订阅生命周期与数据在场性解耦。

### 决策 5（宁多勿漏唯一不变量）——同文 L55–60

- 漏 = 不可接受、多 = 可接受；通知语义 = 「这个位置的条目状态可能与你所知不同」；消费协议 v1 = 建立后先全量拉一次、之后按 key 幂等拉终态自辨（溢出后「全量重拉一次即自愈」的协议依据）。

### 决策 7（分层）——同文 L69–73

- runtime：订阅簿记、谓词求值、宁多勿漏判定、**异步分发与有界队列**；registry：lease 公共面、类型别名与透传；**通知不出进程：复制协议（instance-replication-v1）零改动**。

### 验收（缝）——同文 L88–97

- L94：「生命周期：……**队列溢出（testing 工厂注入小上限）→ `invalidate-all` 且订阅存活**、回调 throw 隔离（不影响写结果）」；
- L91：建立判定矩阵含「数据缺席可订阅（**含容器删除后订阅横跨重建**）」；
- L96：先例 = 窗口读（issue #369）lease 契约三件套。

## B. 术语基准：CONTEXT.md「变更订阅」词条

`CONTEXT.md` L65–67：

- 「`invalidate-all`（**溢出 / 父路径删除，订阅存活**）」；「**数据缺席合法**——订阅生命周期与数据在场性解耦，只与 lease 和 schema 耦合（读对缺席报错、订阅宽容等待）」；
- 「挂点 = 写序列器事务提交后异步分发……回调 throw 静默隔离，**有界队列溢出降级 `invalidate-all`（数值不进契约）**」；
- _Avoid_（L67）：observer 撞词、泛 watch/推送/事件流（暗示含值或可靠投递）、把订阅当数据快照或增量日志、effect 分型、version/rev 序号、与 subscribeOwnedUpdates / 诊断变更日志混用。

## C. 槽序与分发纪律（AC6 的约束来源）

- `docs/adr/0008-namespace-runtime-read-write-capabilities-and-sequencer.md` L38–57：同一 namespace 所有受控写共享**唯一严格 FIFO write sequencer**；读取不进 sequencer；槽序 = gate → snapshot → 校验 → transaction → `notifyDirty`。
- `docs/adr/0011-best-effort-namespace-diagnostic-change-log.md` L20（日志失败不得改变 sequencer 顺序/写结果）、L123–128（时序与 sequencer：业务排序不引入第二机构、emitter 不被 await）、L159 调用点纪律援引（ADR-0014-LOG amendment：接入调用点必须位于 write sequencer slot 之外或之后）——ADR 0030 §6 明文「沿诊断日志纪律」。

## D. 复制面对照（issue 措辞「无需 needs-resync 重协商」的边界）

- `docs/adr/0010-hub-peer-websocket-ydoc-replication.md` L113：**Per-namespace 复制队列溢出只把 channel 标记为 `needs-resync`，不得阻塞 write sequencer**；L151：溢出丢弃未发送增量并进入 needs-resync——该语义属 ReplicationSession/raw-Yjs-bytes 面（subscribeOwnedUpdates 族），与 watchMap 通知面是两条独立决策线；
- L267（R2-3 澄清节）：复制 fanout 队列容量 **16 是冻结常量 `FANOUT_CHANNEL_QUEUE_CAPACITY`（不可配置）**——与 watch 队列「数值不进契约、可注入」是**相反**的数值治理纪律，不可互相套用；
- ADR 0030 §7：通知不出进程，instance-replication-v1 零改动。

## E. 模块契约（AGENTS 明确收录的边界）

- `packages/namespace-runtime/AGENTS.md`：公共 API 只暴露 detached 投影；生产构造与测试 seam 保持内部；单一 FIFO 不得被通知面进入。
- `packages/namespace-registry/AGENTS.md`：公共 API 只经 `src/index.ts` 增长；**hostile/test 控件留在显式 testing surface**（`src/testing.ts`）；生产装配经 `@nomicore/namespace-runtime/internal` 受限 seam。

## F. 当前事实（代码确认，非决策文本）

- `packages/namespace-runtime/src/watch-map.ts`：T1 已实现有界队列机制——`createWatchHub(doc, state, queueCapacity = 16)`（L98 默认常量、L365–369 构造参数位）；溢出 → 清队在队 data + 入队单条 `invalidate-all`（origin = 触发事务 origin，L397–413）；单飞微任务泵槽外分发（L318–341）。文件头注 L26–32 明文：「容量 = 构造单参数位……**T4 #390 的 testing 工厂注入为纯加法**」「溢出……T1 实现之、**T4 #390 补注入与验收**」；L36–38 边界：**父路径删除编排（T4 #390）属 T1 非目标**；L286–287（C-3 分支）：容器级事件（父路径 + 本条键）当前落入「无命中」——**父路径删除目前产出零通知**。
- `packages/namespace-runtime/src/runtime.ts` L576：`createWatchHub(doc, state)` ——容量参数尚未从任何装配面注入（生产与 testing 均未接线）。
- `packages/namespace-registry/src/testing.ts` L36–64：`NamespaceRegistryTestingOverrides` 既有字段（runtimeFactory/observer/diagnostics/clock/createDocumentFactory/scheduler/idleTimeoutMs/randomBytes/role/replicationObservability/diagnosticLog）——**尚无 watch 队列容量位**；testing 工厂 `createNamespaceRegistryForTesting`（L119）即 ADR 0030 验收所指「testing 工厂」。
- `packages/namespace-registry/src/registry.ts` L800–802：缺省 `runtimeFactory = createNamespaceRuntimeForRegistry`（internal seam 装配）。
- `packages/namespace-runtime/src/errors.ts` L241–255：`WATCH_MAP_*` 稳定码族 append-only 注册（现两码：CARRIER_MISMATCH / SCHEMA_UNAVAILABLE）。
- 分支事实：`mabf/issue-390`（HEAD `28faeae` = T1 #387 已合入；阻塞项 #387 CLOSED）；ADR 0030 已在库（`6df1c61`）。
- issue #390 评论：REST `issues/390/comments` 长度 = 0（本 dispatch 复核一致）——**无 Owner override 在场**。
