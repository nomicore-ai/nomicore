# 设计 — issue #390：溢出降级与父路径删除（变更订阅 T4）

- 分支 `mabf/issue-390`，HEAD `28faeae`（T1 #387 已合入；ADR 0030 已在库 `6df1c61`）
- 输入：`wiki/raw/task_issue-390.md`（简报）、`wiki/raw/task_issue-390_sa6_contract.md`（SA6 验收契约，verdict = approve）、
  `wiki/raw/task_issue-390_relevant_decisions.md`（SA8 摘录）、`wiki/raw/task_issue-390_conflict_report.md`（SA8 前置门禁，verdict = clear）
- 本设计为 iteration 0 全新产物（`task_issue-390_design.md` 此前不存在；无 `task_issue-390_sa2_review.md` 评审输入）

---

## 1. 任务类型、目标与非目标

**任务类型：feature**（SA6 §1 同判）。T1（#387）已交付订阅簿记 / 真变判定 / 槽外泵 / 溢出降级**机制**；本任务补齐两个**装配与编排缺口** + 一个验收缝。

**目标**

1. **AC1/AC5 容量注入缝**：`NamespaceRegistryTestingOverrides` 加法式可选字段，经 internal 装配缝真达
   `createWatchHub` 第三参（既有构造参数位）；缺省 = runtime 实现常量；数值不进公共契约。
2. **AC2 溢出验收可达**：注入小上限（capacity=1）+ 同步段两次写 → 恰一条 `{kind:'invalidate-all', origin}`、订阅存活、
   后续写恢复 `data`（全量重拉即自愈——无需 ReplicationSession needs-resync 重协商）。
3. **AC3 父路径删除编排**：订阅容器路径的严格祖先被删（delete）或整替（update，旧子树消失）→ 恰一条两键
   `invalidate-all`、订阅存活；条目级删除仍为 `data`（不噪声化）。
4. **AC4 横跨缺席期（回归边界）**：删除 → 重建 → 条目写照常以 `data` 到达，零重新订阅——数据在场性从不终结订阅。
5. **AC6 槽外红线**：降级信号（清队 + 入队 + 泵调度）保持观察器内有界同步操作；零 sequencer 内 await；通知异常零外泄。

**非目标（SA6 §12.1「非目标」+ SA8 §3 逐项确认）**

- 谓词 `where` 与 `WATCH_MAP_OPTIONS_INVALID`（T2 #388）；`watch-end` 两 reason 与 `origin:'replication'` 的复制 apply
  验收（T3 #389）；文档词条面（T5 #391）。
- 复制面（ReplicationSession / instance-replication-v1 / needs-resync）任何改动；`readData` / 窗口读 / 诊断日志 / wire /
  持久化零改动；sequencer 槽序零触碰。
- 数组载体订阅（`watchArray` v2）、含值通知、序号/对账（ADR 0030 开放问题）。
- 容量默认值的契约化（B-6：不断言数值）。

---

## 2. 当前行为与证据锚点（HEAD 实读核对）

以下锚点全部在本 worktree 现场核对（与 SA6 §4 / SA8 §F 的引用一致，**零矛盾**）：

| # | 事实 | 锚点 |
|---|---|---|
| 1 | 溢出降级**机制已在**：`enqueueData` 见 `queue.length >= queueCapacity` → 清空在队 data → 入队单条 `invalidate-all`（origin = 触发事务 origin） | `watch-map.ts` L397–413 |
| 2 | 容量构造参数位已在：`createWatchHub(doc, state, queueCapacity = WATCH_QUEUE_CAPACITY_DEFAULT)`，默认常量 16（实现常量，数值不进公共契约） | `watch-map.ts` L365–369、L96–98 |
| 3 | 祖先事件被前缀检查丢弃：`isPathPrefix(containerPath, eventPath)` 对 `eventPath.length < containerPath.length` 恒 false → L270 `continue`；C-3 注释明文「父路径删除编排属 T4 #390——落入无命中」 | `watch-map.ts` L238–247、L270、L286–287 |
| 4 | **容量装配面缺席**：`runtime.ts` L576 `createWatchHub(doc, state)` 两参调用（第三参无人传） | `runtime.ts` L576 |
| 5 | **注入位缺席**：`NamespaceRegistryTestingOverrides` 无容量字段（SA6 类型探针 TS2353）；testing 工厂即 `createNamespaceRegistryForTesting` | `testing.ts` L36–64、L119–170 |
| 6 | internal 装配缝：缺省 `runtimeFactory = createNamespaceRuntimeForRegistry`；三处调用点统一 `factory(handle, notifyDirty, runtimeOptionsFor(namespaceId))` | `registry.ts` L799–802、L1310 / L1563 / L1707 |
| 7 | 第三参通道形态：`runtimeOptionsFor` → `RegistryRuntimeOptions`（emitter/clock/replicationObservability）→ `RuntimeForRegistryDiagnostic` → seam input 条件展开 | `registry.ts` L210–220、L832–860；`runtime.ts` L901–905、L914–932 |
| 8 | 槽外分发已在：单飞微任务泵、每项投递前让步 20 微任务、逐 listener try/catch 静默隔离、handler 整体 try/catch 零 throw 硬红线 | `watch-map.ts` L318–341、L374–392 |
| 9 | 订阅簿记为冻结 path 快照、建立判定纯 active schema 侧零 live 载体探测（缺席合法的结构保证） | `watch-map.ts` L127–137、L440–456 |
| 10 | internal seam arity 冻结：type-guard 断言 `Parameters<工厂> extends [DocHandle, () => Promise<void>, unknown?]`（两参/三参形，单对象形禁 p0Gate/compile）；重载「两参居末」使 `Parameters` 见两参 | `internal.ts` L43–63；`runtime-registry-internal-type-guard.test-d.ts` |
| 11 | 数值可选注入的校验先例：`resolveIdleTimeoutMs` 单点（undefined → 缺省；非 number → TypeError；非整数/越界 → RangeError；稳定 message 在 `types.ts`） | `registry.ts` L182–193；`types.ts` L81–84 |
| 12 | 生产入口字段逐一转发（结构性不含未知字段）：`createNamespaceRegistry` 从 `CreateNamespaceRegistryOptions` 显式构造 internal options | `registry.ts` L2303–2319 |
| 13 | lease 面 16 键（含 T1 `watchMap`）冻结；registry/plugin config 键集冻结 `{idleTimeoutMs?}` | `registry-open.test.ts` L941–942；`plugin.ts` L146–154 |
| 14 | 采集面就绪：`vitest.config.ts` L15 `packages/*/test/**/*.test.ts`、L20 + `tsconfig.typecheck.json` 含 `*.test-d.ts` | `vitest.config.ts` L15/L20 |

**承重时序事实（SA6 §7-1，10/10 轮实测）**：同一同步段两次 un-awaited `mutateData`，两次事务提交恒先于该订阅泵的首次投递
（`minCommitsBeforeFirstDelivery = 2`）、同步段回调数恒 0 ⇒ capacity=1 时第二次入队必见 `queue.length >= 1`，溢出触发零时序竞猜。

---

## 3. 能力缺口（承接 SA6 §8，feature 语义）

| 缺口 | 表现（HEAD） | 证据 |
|---|---|---|
| G-父删/祖先删/整替/同事务删 = 零通知 | 消费方持有已消失条目的视图且永不被告知（事件在场、通知缺席 = 编排缺席，非 Yjs 不报事件） | SA6 §5 G-1..G-4、探针 A/B 日志（`artifacts/sa6-issue390-probe-{a,b}.log`） |
| G-注入位双缺席 | 类型面 TS2353 + 运行面字段被静默忽略（capacity 仍为默认常量）⇒ ADR 0030 L94 指定的验收触发不可执行；默认容量下溢出投递序列不可确定（S10b：N20 → data 3 + 失效 1；N60 → data 9 + 失效 3） | SA6 §5 G-5、`-type-probe.log`、`-probe-c.log`、§7-3 |

机制健全性已被 SA6 因果实验隔离（X-1..X-4：模块面直驱 capacity=1 → 恰一条 invalidate-all + 自愈；FIFO；缺省容量 17 同步事务
→ 恰一条）——缺的是**装配接线**与**父删编排**，不是机制。

---

## 4. Owner要求落实

REST `issues/390/comments` = **[]（0 条）**（Host 简报与 SA6 §2 / SA8 §2 三方一致）——无 Owner 评论、无 override 载体。

| Comment ID | Updated at | Requirement | Design section |
|---|---|---|---|
| （无） | — | 无 owner-scoped 要求；全部要求由 issue 正文 6 条 AC + ADR 0030 决策 3/4/6 + 验收缝导出 | §1 目标 ↔ AC1–AC6；§7 决策 ↔ ADR 0030；§12 验收映射 |

---

## 5. 复现和根因承接

| 上游事实 | 证据位置 | 设计响应 |
|---|---|---|
| 父删/祖先删/整替/同事务批量删 = 零通知；raw 事件恒在祖先路径（`path=[]` 或 `['groups']` 级，action ∈ {delete,update}，无深层事件） | SA6 §5 G-1..G-4、§9 X-7 | §7-D3：在祖先事件上按路径前缀推导结构性失效（`detectStructuralInvalidation`） |
| 溢出机制健全（capacity=1 → 恰一条两键 invalidate-all + 排空后 data 自愈；capacity=2 → `[data(f1), invalidate-all]` FIFO；origin 两态保真；缺省容量清队语义成立） | SA6 §9 X-1..X-4、探针 B | §7-D4：降级入队单点化（`enqueueInvalidateAll`），溢出分支与结构性失效共用；机制零改动 |
| 注入位类型 + 运行双缺席（TS2353 / 字段被忽略） | SA6 §5 G-5、§13 | §7-D2：testing overrides 加法字段 → internal 装配缝 → `createWatchHub` 第三参全链接线 |
| 触发确定性（同步段两写 10/10 先提交后投递） | SA6 §7-1、X-5 | §12 验收：A2 采用 B-2 触发模式；断言 `syncCallbacks === 0`；禁 sleep 竞猜 |
| AC4/A7/A8/A9 与 NC1–NC6 为基线绿（回归边界，不得伪称红灯） | SA6 §11-H7、§13 | §12 回归守卫清单；§7-D3 的 `add` 旁路保证 N4/S4/S8 逐字节不漂移 |
| 必填字段整删被写面拒绝（`ok:false`，零事务零通知）——契约正例必须用可选容器 | SA6 NC4、§11-H2 | §12 fixture：`optionalTasks?` / `optionalGroups?` 为正例载体，`tasks` 为必填负控 |

上游事实与源码**零矛盾**（§2 全部锚点现场核对一致）。

---

## 6. SA8约束落实

| 决议或义务（`task_issue-390_conflict_report.md`） | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|
| §8-1 注入只经 `NamespaceRegistryTestingOverrides` 加法式新字段 + internal 装配缝（registry 缺省 runtimeFactory / runtime.ts L576 接线）；不得新开公共 API 或第二 testing seam | §7-D2、§11 | 字段仅落 testing surface + internal options；经 `runtimeOptionsFor` 第三参 → seam → `createWatchHub` 第三参；arity / 公共入口 / 子路径零变化 | 复查项 ①（见 §15） |
| §8-2 失效信号形状恒 `{kind:'invalidate-all', origin}`；与在队/在途 data 相对顺序保 FIFO；删除→重建→`data` 恢复不要求重建订阅；宁多勿漏加强不得削弱既有真变过滤 | §7-D3/D4、§9 | 恰两键 `Object.freeze`；清队只清**未投递** data（B-7 授权）；簿记零摘除；真变判定复用 `isRealChange`（含容器级 update 的 plain→plain 同值过滤） | 复查项 ③④ |
| §8-3 槽外红线：溢出降级（清队 + 入队 + 泵调度）观察器内有界同步操作；零 sequencer 内 await；通知异常零外泄 | §7-D4、§9 | 降级单点全同步有界；复用既有槽外泵；handler 零 throw 红线不变 | 复查项 ⑤ |
| §8-4 实现后复查清单（① 字段不泄漏公共契约 ② 默认容量仍为实现常量、不套用复制 fanout 冻结常量纪律 ③ 三 kind 形状逐键不变 ④ 两触发源订阅存活 ⑤ sequencer/槽序 diff 零触碰 ⑥ 复制面零改动 ⑦ T2/T3 未顺带实现） | §11 DENY LIST、§12、§15 | 设计逐项映射（§15 表）；DENY LIST 显式排除 sequencer/复制/谓词/watch-end 面 | 是（本设计提交 `requiresConflictRecheck: true`） |
| §3 冻结面：三 kind 形状 / 数值不进公共契约 / `watchMap` lease 签名 / `WATCH_MAP_*` append-only / 复制 wire / 写序列器单 FIFO / 谓词与 watch-end 词表 | §7、§11 | 全部零触碰；无新错误条件（零新 `WATCH_MAP_*` 码） | 复查项 ②③⑥⑦ |
| ADR 0030 决策 3（缺席合法、宽容等待）/ 决策 4（L50 触发源、L51 终结三因）/ 决策 6（L64–67 挂点、L66 有界与数值治理、L67 事务级原子 + FIFO） | §7-D3/D4、§9 | 父删 invalidate-all + 订阅存活 = L50 原义兑现；数值治理 = 构造参数 + 实现默认（与 ADR 0010 L267 复制 fanout 冻结常量为相反纪律，互不套用） | 复查项 ② |

---

## 7. 设计决策与主要备选方案

### D1【SA1 必裁①·B-1】注入字段名/形态：采纳契约默认 `watchQueueCapacity?: number`

- 落点：`NamespaceRegistryTestingOverrides`（`@nomicore/namespace-registry/testing`）**加法式可选字段**；
- 语义：正整数（≥1、有限、整数）；缺省不传 = runtime 实现常量（`WATCH_QUEUE_CAPACITY_DEFAULT = 16`，数值不进公共契约）；
- 依据：ADR 0030 L66（构造参数 + 实现默认）+ L94（testing 工厂注入小上限）+ SA8 §8-1；命名与 `createWatchHub` 第三参
  `queueCapacity` 对位、`watch` 前缀在 overrides 对象内消歧、与 `idleTimeoutMs` 命名风格一致；
- 裁决结果 = 契约默认 ⇒ **无需回写 SA6 §12.1**（其 §12.6-7 仅在另择时要求回写）；fixture 单点
  `WATCH_TEST_INJECTION_BINDING = { watchQueueCapacity: N }` 承载绑定。

### D2【承重】容量注入通路：第三参对象加法字段链（arity 冻结面零触碰）

唯一通路（每跳均为**加法可选字段**，无任何签名/arity/导出变化）：

```
NamespaceRegistryTestingOverrides.watchQueueCapacity?        (testing.ts —— 唯一注入面)
  → NamespaceRegistryInternalOptions.watchQueueCapacity?      (registry.ts internal options)
  → resolveWatchQueueCapacity 单点校验                         (registry.ts，resolveIdleTimeoutMs 同款)
  → runtimeOptionsFor(namespaceId) 返回对象携带                 (registry.ts L832——三处 factory 调用点共享)
  → RuntimeFactory 第三参 diagnostic 对象加法字段               (RegistryRuntimeOptions / RuntimeForRegistryDiagnostic)
  → createNamespaceRuntime 条件展开进 seam input               (runtime.ts L914–932 既有模式)
  → NamespaceRuntimeSeamInput.watchQueueCapacity? + captureSeamInput 捕获
  → createWatchHub(doc, state, captured.watchQueueCapacity)    (runtime.ts L576——undefined 触发缺省参数=实现常量)
```

- **备选 A（否决）**：`createNamespaceRuntimeForRegistry` 增第四可选位置参——破坏 type-guard 冻结面
  `[DocHandle, () => Promise<void>, unknown?]`（issue #109 AC2 形状锁，`runtime-registry-internal-type-guard.test-d.ts`），
  且需改冻结测试，违反 append-only 纪律；
- **备选 B（否决）**：testing.ts 内包一层缺省 factory 闭包注入——偏离 SA8 §8-1 点名的装配点（registry 缺省
  runtimeFactory / runtime L576），且使 testing.ts 新增 internal seam **值**导入（现状仅 registry.ts 持有该工厂值）；
  第三参通道（clock / replicationObservability 先例）是既有加法路线；
- **组合语义**：同时提供 `runtimeFactory` 覆盖与 `watchQueueCapacity` 时，容量随第三参到达自定义工厂；自定义工厂自行决定
  消费与否（忽略 = 无效果，无错误）。容量粒度 = per-Registry（其构造的全部 Runtime/Hub 共享），不提供 per-namespace 粒度
  （非需求，testing 控件）；
- **公共契约零泄漏的结构保证**：生产入口 `createNamespaceRegistry`（L2303–2319）从 `CreateNamespaceRegistryOptions` **逐一
  显式转发**字段——新字段不在其中 ⇒ 生产面结构性不可达；plugin config 键集冻结 `{idleTimeoutMs?}` 不动。

### D3【承重】C-3 结构性失效编排：严格祖先事件 + 链上键 delete/update 真变 → invalidate-all

`watch-map.ts` 新增模块内函数（零导出变化），在 handler 内每订阅**先于** `collectChanges` 执行：

```ts
/** C-3 结构性失效检测：订阅容器路径的严格祖先事件触及本链下一键且为 delete/update 真变
 *  → 该订阅本事务的信号 = invalidate-all（B-4；Yjs 对整棵被删/被替子树只产一个祖先级事件）。 */
function detectStructuralInvalidation(
  events: ReadonlyArray<Y.YEvent<Y.Map<unknown>>>,
  containerPath: readonly (string | number)[],
): boolean {
  const depth = containerPath.length;
  if (depth === 0) return false;                    // ROOT 订阅（watchMap([])）无严格祖先——结构不可达
  for (const event of events) {
    const eventPath = event.path;
    if (eventPath.length >= depth) continue;        // 只看严格祖先（C-1/C-2 分支照旧处理 ≥ depth 的事件）
    if (!isPathPrefix(eventPath, containerPath)) continue; // 事件不在本订阅链上 → 无关（保 NC3）
    const nextSeg = containerPath[eventPath.length];
    if (typeof nextSeg !== 'string') return true;   // 链途径序列载体：祖先级序列事件不可判（delta 无键级
                                                    // oldValue）且下标锚定身份不稳定 → 保守失效（宁多勿漏）
    const info = event.changes.keys.get(nextSeg);
    if (info === undefined) continue;               // 键容器祖先事件未触碰本链下一键 → 无关
    if (info.action === 'add') continue;            // 容器创建（缺席→在场）：T1 N4 边界——kind 不钉，
                                                    // C-1/C-2 行为与 T1 逐字节一致（本分支完全旁路）
    if (isRealChange(event.target, nextSeg, info)) return true; // delete 恒真变；update 复用真变判定
  }
  return false;
}
```

handler 内编排（一事务一通知不变——结构性失效**短路**条目聚合，B-7）：

```ts
for (const subscription of subscriptions) {
  if (subscription.unsubscribed) continue;
  if (detectStructuralInvalidation(events, subscription.containerPath)) {
    enqueueInvalidateAll(subscription, origin);     // C-3：含结构性删除的事务该条 = invalidate-all
    continue;
  }
  const changes = collectChanges(events, subscription.containerPath);
  if (changes.length === 0) continue;
  enqueueData(subscription, origin, changes);
}
```

要点与裁决：

- **前缀判据复用**：`isPathPrefix(eventPath, containerPath)`（既有 helper 交换实参 = 「事件路径是容器路径的前缀」），
  加 `eventPath.length < depth` 收紧为严格祖先；与 L270 的 `isPathPrefix(containerPath, eventPath)`（容器路径是事件路径
  的前缀）方向相反、互不干扰；
- **真变复用而非恒真**：祖先级 `update`（整替）复用 `isRealChange` —— 两侧均 plain 且深比较相等 → 过滤（不噪声）；
  任一侧 live Y 载体（正常容器整替的 oldValue 即 live `Y.Map`）→ 不可判 → 保守失效。此为宁多勿漏矩阵在容器级键上的同一
  纪律，**不新增第二套判定**（SA8 §8-2「加强不得削弱真变过滤」）；
- **`add` 旁路（SA1 裁决）**：容器创建不编排失效信号——依据 T1 N4「创建事件本身的信号 kind 不钉」+ AC4 承重断言为
  「重建后**条目写**到达 data」；旁路使创建事务行为与 T1 逐字节一致（写面「物化 + 填充」若产嵌套事件则照旧走 C-1/C-2），
  是对 21 个绿用例最小漂移的选择。注：宁多勿漏允许在 `add` 上多发（多可接受），本设计冻结**最小噪声**档并显式记录边界；
- **【SA1 必裁②·A5】容器整替纳入范围（保留为承重用例）**：issue AC3 字面仅「父级删除」，但 Yjs 把整替上报为祖先级
  `update`、旧子树条目全部消失——排除它等于保留同一个漏通知洞（SA6 G-3：零通知）。整替与删除共用同一检测分支、零额外
  面，属 ADR 0030 L50「父路径删除」+ §5「漏不可接受」的直接结论，非范围扩张；
- **序列载体段保守失效**：仅当订阅链**途径**序列容器（`nextSeg` 非 string，终端数组在建立期已拒）且祖先事件落在链上时
  触发；条目级/无关路径负控（NC2/NC3）不受影响。

### D4 降级入队单点：`enqueueInvalidateAll`（溢出与结构性失效共用）

```ts
/** 降级入队单点：清空在队通知 → 入队单条恰两键 invalidate-all → 槽外泵调度。
 *  B-7：已投递序不被降级信号越过；在队未投递 data 允许被清（invalidate-all 语义上包摄一切条目定位符）。 */
function enqueueInvalidateAll(subscription: WatchSubscription, origin: 'local' | 'replication'): void {
  if (subscription.unsubscribed) return;
  subscription.queue.length = 0;
  subscription.queue.push(Object.freeze({ kind: 'invalidate-all', origin }));
  schedulePump(subscription);
}

function enqueueData(subscription, origin, changes): void {
  if (subscription.unsubscribed) return;
  if (subscription.queue.length >= queueCapacity) {
    enqueueInvalidateAll(subscription, origin);     // 溢出降级（T1 语义，单点化——行为逐字节等价）
    return;
  }
  subscription.queue.push(Object.freeze({ kind: 'data', origin, changes: Object.freeze([...changes]) }));
  schedulePump(subscription);
}
```

- 溢出分支改调单点（清队 + 单条 + 调度，与原 L404–412 逐字节等价）；结构性失效复用同一单点 ⇒ 恰一条待投递
  invalidate-all（连续多事务结构性删除自然折叠：清队含上一条未投递 invalidate-all，语义等价——消费方全量重拉一次即自愈）；
- **备选（否决）**：结构性失效仅 append 不清队——允许多条待投递 invalidate-all 堆积、且在队旧 data（描述已被删除条目的
  定位符）滞后投递徒增消费方拉取；清队为 B-7 显式授权的更优形态，并与溢出降级统一；
- 形状冻结：`Object.freeze({ kind, origin })` 恰两键，无 reason/changes/version/rev（ADR L44–53、NC6）。

### D5 容量合法性门（fail-loud，registry 单点 + seam 捕获形状门）

- `registry.ts` 新增 `resolveWatchQueueCapacity(config): number | undefined`（`resolveIdleTimeoutMs` 同款单点）：
  `undefined` → `undefined`（未注入 → runtime 缺省）；非 number → `TypeError`；非整数 / `< 1` / `> 2_147_483_647` /
  非有限 → `RangeError`。稳定 message 常量落 `types.ts`（#112 先例：零插值、零值回显）：
  - `NAMESPACE_REGISTRY_WATCH_QUEUE_CAPACITY_TYPE: watchQueueCapacity 必须是 number（1..2147483647 有限整数）`
  - `NAMESPACE_REGISTRY_WATCH_QUEUE_CAPACITY_RANGE: watchQueueCapacity 必须是 1..2147483647 的有限整数（缺省 = runtime 实现常量——数值不进公共契约）`
- 调用点：`createRegistryInternal` 内紧随 `resolveIdleTimeoutMs`（L789）之后、randomBytes 门之前——字段在全部既有调用方
  缺席 ⇒ 既有门禁文案/顺序零漂移；
- `captureSeamInput` 对该可选字段做形状门（提供则必须 ≥1 有限整数，否则构造期同步 `TypeError`——INV-N4 前置于 enqueue、
  throw 路径零副作用；与本文件 p0Gate/compile/notifyDirty 逐字段形状门纪律一致）。registry 单点已挡 ⇒ seam 门仅为直连
  seam 调用方（runtime 包内测试）的防御面；
- **【SA1 必裁③】默认容量数值**：契约不断言（B-6/SA6 §15-3）；`WATCH_QUEUE_CAPACITY_DEFAULT = 16` 保持实现常量，不出现在
  lease 公共面 / 公共类型 / 文档契约；与 ADR 0010 L267 复制 fanout 冻结常量（16、不可配置）为**相反**数值治理纪律，互不套用；
- **【SA1 裁决④】校验超出契约断言面**（SA6 §15-4：契约只需 `1` 被兑现）——本设计仍加门：testing 控件传入垃圾值若静默
  按「恒溢出」运行属静默 fallback，违反 fail-loud 纪律；门不约束契约触发值 `1`。

### D6 【SA1 必裁⑤】契约文件形态：新三件套（不扩展 #387 fixture）

- 新文件：`issue-390-watch-invalidation-fixture.ts`（非测试文件，不被收集）+ `issue-390-watch-invalidation-red.test.ts`
  （L15 采集）+ `issue-390-watch-invalidation-surface.test-d.ts`（L20 + typecheck include）——SA6 §12.4 默认；
- **否决备选**（扩展 `issue-387-watch-map-fixture.ts`）：该 fixture 的 `openWatchLease` 使用 **runtimeFactory 覆盖**
  （`createNamespaceRuntimeWithSeam` 直连），而 #390 注入必须走**缺省生产 factory 通路**（G-5 探针面、§12.5-6「注入只经
  既有 seam」）；扩展需改其装配形态 ⇒ 触碰冻结契约支撑文件，耦合 #387 的 21 用例。新 fixture 自包含（sink/排空屏障助手
  就地小拷贝，不 import #387 fixture），对 T1 契约零接触；
- fixture 承载：`WATCH_TEST_INJECTION_BINDING` 单点（B-1）；schema 按 SA6 §12.3（`tasks` 必填 / `optionalTasks?` 可选
  已物化 / `optionalGroups?` 两级嵌套 / `meta` 封闭对象 YMap）；`openWatchLease({ watchQueueCapacity })` 走缺省
  factory 通路（**不提供 runtimeFactory 覆盖**）；`expect.poll` + 同订阅后续事务屏障助手。

### D7 订阅存活（簿记零摘除）

两触发源（溢出/父删）均不动 `subscriptions` 集、不置 `unsubscribed`、不发 `watch-end`——降级只是**队列事件**，不是生命周期
事件（ADR L50/L51：终结三因 = lease 释放 / schema 变更 / doc 替换）。删除→重建→条目写链路：`delete`（祖先事件 →
invalidate-all）→ 重建（`add` 旁路）→ 条目写（C-1/C-2 → `data`）——AC4 全程零重新订阅。

### D8 注释与文档面

- `watch-map.ts` 头注 L26–32（E 分发：降级单点化 + 结构性失效）、L36–38（边界：移除「父路径删除编排（T4 #390）」的
  T1 非目标标注）、L286–287（C-3 注释改为已编排）随实现同步更新——源文件注释属实现面，允许且应当更新；
- `CONTEXT.md`「变更订阅」词条与 ADR 0030 已含全部语义（溢出/父路径删除、数值不进契约）——**零改动**（文档面属 T5 #391）。

---

## 8. 接口、状态机和数据流

### 8-A 接口变化总表（全部加法式可选字段，无签名/arity/导出变化）

| 面 | 变化 | 公共性 |
|---|---|---|
| `NamespaceRegistryTestingOverrides`（testing.ts） | `+ watchQueueCapacity?: number` | testing 子路径（测试控件显式面） |
| `NamespaceRegistryInternalOptions`（registry.ts） | `+ watchQueueCapacity?: number` | 包内（主入口不 re-export，既有纪律） |
| `RegistryRuntimeOptions` / `RuntimeForRegistryDiagnostic` | `+ watchQueueCapacity?: number` | 包内 / runtime 包内类型（第三参对象加法） |
| `NamespaceRuntimeSeamInput`（runtime.ts） | `+ watchQueueCapacity?: number` | 包内 seam（不经任何 package entry 导出） |
| `createWatchHub` 第三参 | **签名零变化**（既有 `queueCapacity: number = 16`）；唯一变化 = L576 调用点开始传值 | 包内模块面 |
| `watchMap` lease/runtime 公共签名、lease 16 键、三 kind 形状、`WATCH_MAP_*` 码族 | 零变化 | 冻结面 |
| `types.ts` | `+ 2 条稳定 message 常量` | 值导出沿既有先例（types.ts 非公共入口） |

### 8-B 状态机（订阅级；唯一新增迁移 = 队列内容的降级态，无新生命周期状态）

```
active ──事务提交(observeDeep)──┬─ 无命中 ──────────────────────→ 队列不变
  │                            ├─ 条目真变 ─────────────────────→ 入队 data（容量未满）/ 溢出→降级
  │                            └─ 结构性失效(D3) ────────────────→ 清队 + 入队单条 invalidate-all
  │  溢出（queue.length ≥ capacity）────────────────────────────→ 同上降级（D4 单点）
  └─ 泵（微任务、每项让步 20）──→ FIFO 投递 → listener（throw 静默隔离）
退订/关停（既有）→ 队列清空、不再投递 —— 降级不改变任何既有迁移
```

订阅自始至终保持 `active`（D7）；`invalidate-all` 是队列事件而非状态迁移。

### 8-C 数据流路线

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| ① 溢出降级 | lease `mutateData` ×2（同一同步段、un-awaited、均 `ok:true`；hub 容量 1） | 写序列器事务提交（既有）→ `ROOT.observeDeep` handler ×2 | 第 1 事务入队 data；第 2 事务 `enqueueData` 见 `length ≥ 1` → `enqueueInvalidateAll`（清队 + 单条） | 仅进程内订阅队列（零持久化/零 wire） | 槽外微任务泵投递 | 恰一条 `{kind:'invalidate-all', origin:'local'}`（两键）、零 data；排空后再写 → `data`（自愈） | listener throw 静默隔离；写结果零影响；泵零 unhandled rejection | A2/A1、NC1、A7 |
| ② 父删/祖先删/整替 | `delete ['optionalTasks']` / `delete ['optionalGroups']`（订阅 `['optionalGroups','og1']`）/ `set ['optionalTasks'] = {…}` / 同事务批量 | 同上（单事务，Yjs 只产祖先级单事件） | `detectStructuralInvalidation`：严格祖先前缀 + 链上键 delete/update 真变 → 短路条目聚合 → 降级单点 | 同上 | 同上 | 恰一条两键 invalidate-all（origin = 触发事务 origin）；订阅存活；条目级删除仍 `data` | 同上 | A3/A3b/A4/A5、NC2/NC4/NC5 |
| ③ 容量注入装配 | 测试经 `createNamespaceRegistryForTesting(p, { …, watchQueueCapacity: 1 })` | 构造期一次成型：internal options → `resolveWatchQueueCapacity` 门 → `runtimeOptionsFor` → factory 第三参 → seam input 捕获 | 纯构造期数据流；undefined 触发 `createWatchHub` 缺省参数 | 仅内存构造（零持久化） | runtime 构造栈 L576 | 该 Registry 构造的全部 watch hub 以注入容量运行 | 门失败 = 构造期同步 TypeError/RangeError（零副作用） | A1（类型 + 运行）、A8（零泄漏） |
| ④ 横跨缺席期 | 删除（路线②）→ 重建 `set ['optionalTasks'] = {…}`（祖先 `add`）→ 条目写 `set ['optionalTasks','r1']` | 重建 = `add` 旁路（零通知、行为同 T1）；条目写 = C-1 事件 | 簿记为冻结 path 快照，删除/重建不动订阅 | 同上 | 同上 | 条目写到达 `{path:['optionalTasks'], key:'r1'}` 形 `data`，零重新订阅 | 同上 | A6（基线绿，回归边界）、A9 |

跨模块/跨进程边界：**无新增**（通知不出进程——ADR 0030 §7；零 wire/持久化接触）。

---

## 9. 错误、恢复、并发和幂等

- **错误面零扩张**：零新错误码（`WATCH_MAP_*` append-only 不动）；新增仅两条构造期稳定 message（TypeError/RangeError，
  testing 控件门）。通知路径维持零 throw 硬红线：检测与降级全同步有界、handler 整体 try/catch 收编不变；
- **恢复语义**：溢出/父删的降级信号即**自愈指令**——消费方全量重拉一次即自愈（消费协议 v1；无需 needs-resync 重协商，
  复制面零接触）；订阅存活，后续条目写恢复 `data`；
- **并发/单线程论证（沿 T1）**：队列只在观察器内入队、只在泵内出队；降级清队发生在观察器上下文，泵在让步点重检
  `queue.length === 0 → return`、`finally` 同步段复位 `pumpScheduled`（无丢失唤醒）——既有交错安全论证原样延伸到
  「观察器清队」这一新写入形态；溢出触发确定性由 §2 时序事实（10/10 先提交后投递）承担，非时序竞猜；
- **幂等**：连续结构性失效折叠为一条待投递 invalidate-all（语义幂等：重复全量重拉无差别）；`unsubscribe` 幂等不变；
- **失败可重试性**：注入门失败 = 构造期同步拒绝（修复入参后重试）；降级路径无失败分支（纯内存同步操作）。

---

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| `runtime.ts` 构造栈（`createWatchHub` 唯一调用方） | L576 两参调用（容量恒默认） | 传 `captured.watchQueueCapacity`（undefined → 缺省参数，生产行为逐字节不变） | seam input/捕获/第三参类型加法字段（D2） | §2 #4/#7 |
| `registry.ts` 三处 factory 调用点（L1310/L1563/L1707） | 第三参 = `runtimeOptionsFor(...)` | 同签名；第三参对象多一可选字段（`runtimeOptionsFor` 单点注入） | `runtimeOptionsFor` 两条返回路径 + internal options 加法字段（D2/D5） | §2 #6/#7 |
| `testing.ts` `createNamespaceRegistryForTesting` | overrides 逐字段拷贝 | 增一字段拷贝 | 加法字段（D1/D2） | §2 #5 |
| `lease.ts` `watchMap`（16 键面） | 透传 `entry.runtime.watchMap` | 零变化 | 无 | §2 #13 |
| 生产入口 `createNamespaceRegistry` / plugin | 显式逐字段转发；config 键集冻结 | 零变化（新字段结构性不可达） | 无 | §2 #12/#13 |
| 既有 `runtimeFactory` 覆盖式测试（含 #387 fixture） | 两参/三参函数 | 兼容（第三参可选字段可忽略；容量对其无效果，属自定义工厂自辖） | 无 | `testing.ts` L37；`issue-387-watch-map-fixture.ts` L218 |
| 既有契约家族（#387 21 用例 / #369 / registry-open 16 键 / imports 审计 / exports 审计 / type-guard） | 全绿基线 | 保持全绿（D3 `add` 旁路 + D4 逐字节等价 + arity 零触碰） | 无（实现阶段复跑） | SA6 §4 基线 |
| 消费方（watchMap listener） | 收 data/invalidate-all | 父删/溢出时收恰两键 invalidate-all；在队未投递 data 可能被清（B-7 授权，消费协议拉基） | 无（协议 v1 已覆盖：全量重拉自愈） | ADR 0030 L60/L66 |

无未覆盖调用方；「调用方自行适配」不适用于本设计（零公共签名变化）。

---

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/namespace-runtime/src/watch-map.ts` | 新增 `detectStructuralInvalidation` + `enqueueInvalidateAll`；`enqueueData` 溢出分支改调单点；handler 每订阅先检测后聚合；头注/C-3 注释更新（D8） | D3/D4——父删编排与降级单点 |
| `packages/namespace-runtime/src/runtime.ts` | `NamespaceRuntimeSeamInput` / `RuntimeForRegistryDiagnostic` 加法字段；`createNamespaceRuntime` 条件展开；`captureSeamInput` 捕获 + 形状门；L576 第三参接线；注释 | D2——容量装配缝的 runtime 侧 |
| `packages/namespace-registry/src/testing.ts` | `NamespaceRegistryTestingOverrides` 加法字段 + internal 透传 + 头注增量 | D1/D2——唯一注入面 |
| `packages/namespace-registry/src/registry.ts` | `NamespaceRegistryInternalOptions` 加法字段；`resolveWatchQueueCapacity` 单点 + `createRegistryInternal` 调用；`runtimeOptionsFor` 注入；注释 | D2/D5——internal 装配缝 |
| `packages/namespace-registry/src/types.ts` | 两条稳定 message 常量（TYPE/RANGE） | D5——#112 冻结文本先例 |
| `packages/namespace-registry/test/issue-390-watch-invalidation-fixture.ts` | 新增（实现阶段落盘）：schema per SA6 §12.3、`WATCH_TEST_INJECTION_BINDING` 单点、缺省 factory 通路 `openWatchLease({watchQueueCapacity})`、sink/排空屏障助手 | D6——AC5 注入缝与确定性触发 |
| `packages/namespace-registry/test/issue-390-watch-invalidation-red.test.ts` | 新增（实现阶段落盘）：A1–A9 + NC1–NC6 行为契约 | §12 验收映射 |
| `packages/namespace-registry/test/issue-390-watch-invalidation-surface.test-d.ts` | 新增（实现阶段落盘）：override 字段在场 + 负例 `@ts-expect-error` + 失效信号两键类型面 + 公共面零泄漏负锚 | A1/A8 类型面 |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/namespace-runtime/src/internal.ts` | 生产构造 seam | arity/重载冻结；第三参对象加法无需改动本文件（type-guard 保持绿正是本设计路线） |
| `packages/namespace-runtime/src/index.ts`、`packages/namespace-registry/src/index.ts` | 公共入口 | 公共面零增长（AC1 数值不进公共契约；exports 审计冻结） |
| `packages/namespace-registry/src/lease.ts` | lease 公共面 | 16 键冻结（A8） |
| `packages/namespace-registry/src/plugin.ts` | Cordis 插件面 | config 键集冻结 `{idleTimeoutMs?}`；生产无容量配置面 |
| `packages/namespace-runtime/src/sequencer.ts`、`write.ts`、`schema-write.ts`、`replication-session.ts`、`replication-write.ts`、`window-read.ts`、`read-schema-projection.ts`、诊断日志族 | 槽序/写面/复制/读面/观测 | SA6 §10 零涉面红线（sequencer 槽序、复制 wire、needs-resync、readData/窗口读） |
| `packages/namespace-runtime/src/errors.ts` | `WATCH_MAP_*` 码族 | append-only；本任务零新错误条件 |
| `packages/namespace-runtime/test/runtime-registry-internal-type-guard.test-d.ts` 及全部既有测试 | 冻结守卫/既有契约 | 设计路线即为保持其绿；回归边界（#387 21 用例、registry-open、#369、审计族） |
| `docs/adr/0030-change-subscription.md`、`CONTEXT.md`、`docs/protocols/instance-replication-v1.md` | 规范权威 | 语义已冻结在库；文档面属 T5 #391；本设计兑现而非修订决策 |
| `vitest.config.ts`、`package.json`（两包）、`tsconfig*.json` | 采集/导出/类型面 | 新测试路径已被既有 include 覆盖（§2 #14）；exports 零变化 |
| `packages/namespace-runtime/test/**`、`packages/namespace-registry/test/issue-387-*` | 既有测试 | 回归守卫；#390 契约用新三件套（D6） |

---

## 12. 验收与验证映射

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1/A1 注入位在场且被消费 | SA6 `-type-probe.log`（TS2353 红）+ `-probe-c.log`（运行忽略红） | `openWatchLease({watchQueueCapacity:1})` 后 A2 触发；类型面字段在场 + `@ts-expect-error`（`watchQueueCapacity:'1'`）负例 | 注入改变上界（NC1 对照敏感）；类型红转绿 |
| AC2/A2 溢出 → invalidate-all + 存活 | 探针 B X-1（机制健全）；probe C（装配红） | B-2 触发模式：capacity=1 + 同同步段两次 un-awaited 写 + 断言 `syncCallbacks===0` → `expect.poll` 两键 `toStrictEqual` → 再写 `set ['tasks','x3']` | 恰一条 `{kind:'invalidate-all',origin:'local'}`、零 data；后续 `data` 到达（自愈、零重建订阅） |
| AC3/A3/A3b/A4/A5 父删/同事务/祖先删/整替 | SA6 §5 G-1..G-4（全红：零通知） | 可选容器已物化 → 订阅 → 条目写正控 → 祖先 delete / 同事务 delete+无关写 / 两级嵌套外层删 / 整替 set | 每变体恰一条两键 invalidate-all（origin local）；无 watch-end；条目级删除仍 `data`（NC2） |
| AC4/A6 横跨缺席期 | T1 S4/S8 + SA6 H7（基线绿） | 删除 → invalidate-all → 重建 → 条目写 | 条目写以 `data`（`{path:['optionalTasks'],key:'r1'}` 嵌套形态）到达，零重新订阅 |
| AC5/A1 零新接缝 | SA6 §13 红灯位② | 契约文件仅 `import { createNamespaceRegistryForTesting } from '@nomicore/namespace-registry/testing'` | 无直连 `createWatchHub`/内部 seam；无新 import/子路径/公共 API |
| AC6/A7 槽外 + 不阻塞写 | 探针全部 exit 0；T1 泵纪律 | 触发写全部 `ok:true`；同步段回调 0；后续写照常完成；kind 闭集 | 写结果与通知分发解耦；三 kind 闭集恒成立 |
| A8 公共面零泄漏 | registry-open 16 键绿 | `Object.keys(lease)` 恒 16；主入口/公共类型无 capacity 字段（类型负锚）；internal seam 值导出恰两键 | 公共契约零污染（SA8 §8-4①） |
| A9/NC6 形状冻结 | NC6 绿（回归边界） | `invalidate-all` 恰两键；`data` 恰三键 + 定位符恰两键；kind 闭集；零 version/rev | 三 kind 逐键不变（SA8 §8-4③） |
| NC1 反伪绿 | probe C C1 | 同 A2 输入但不注入容量 | 两条 `data`、零 invalidate-all（断言对注入敏感） |
| NC2/NC3/NC4/NC5 不噪声化/无关/非法事务 | SA6 §6 全绿 | 条目级删除 / 无关路径写 / 必填整删 / 非法批量 | 分别 = `data`（key r2）/ 零通知 / 写面拒绝零通知 / 写面拒绝零通知 |
| 回归边界 | #387 契约 21/21 绿、根 typecheck exit 0、测试树 tsc exit 0（SA6 §4 基线三件套） | 实现后复跑：`vitest run packages/namespace-registry/test/issue-387-watch-map-tracer-red.test.ts --typecheck.enabled=false`、`pnpm typecheck`、`npx tsc -p tsconfig.typecheck.json --noEmit`、registry/runtime 全量测试族 | 全绿不漂移 |

断言纪律（SA6 §12.5 冻结，实现阶段遵循）：零 skip/only/todo、零源码字符串断言、零通知断言必带同订阅后续写屏障、精确
`toStrictEqual` 形状、注入只经既有 seam。SA1 不落盘、不运行测试（dispatch 明令）。

---

## 13. 风险、回滚和残余问题

| 风险 | 等级 | 缓解 | 回滚条件 |
|---|---|---|---|
| T1 21 用例回归（`add` 场景 / 泵纪律） | 中 | D3 `add` 完全旁路（创建事务行为与 T1 逐字节一致）；D4 溢出分支逐字节等价重构；实现后复跑 #387 契约 | 任一 #387 用例红即回滚 watch-map.ts 分支 |
| type-guard / arity 冻结面破坏 | 低 | D2 全链为对象加法字段，arity 零触碰；设计已对照 guard 断言逐条核验 | type-guard 或 exports 审计红即回滚装配路线 |
| 降级清队语义超出消费方预期（在队未投递 data 被清） | 低 | B-7 显式授权；消费协议 v1 为拉基（invalidate-all 包摄一切定位符）；设计中显式记录 | 无需回滚（语义正确）；若评审另裁 append 形态，改 D4 单点两行 |
| 结构性检测误报（宁多勿漏方向） | 低 | 真变复用（plain→plain 同值 update 过滤）；前缀 + 链上键双条件；NC2/NC3 负控在契约内 | NC2/NC3 红即回滚检测分支 |
| 检测成本 O(订阅 × 事件) | 极低 | 每事件常量工作；订阅与事件规模小；全同步有界 | 无需处理 |
| 双触发源叠加（溢出 + 父删同事务） | 极低 | 同一降级单点，自然折叠恰一条 | 无需处理 |

**残余 / follow-up（非本任务内必要条件）**：T2 #388（谓词）、T3 #389（watch-end / 复制 origin 验收）、T5 #391（文档词条）；
`watchArray` 与含值通知、对账序号（ADR 0030 开放问题 v2）；容器**创建**信号的编排仍不钉（T1 N4 边界，本设计最小噪声档，
如有消费方需求须新 AC）。无伪装成 follow-up 的任务内前置项。

---

## 14. 评审修订映射

`wiki/raw/task_issue-390_sa2_review.md` 不存在（iteration 0，无评审输入）——无 finding 可映射。收到评审后在此表逐条
落实并同步修订正文对应章节。

---

## 15. 设计后 ADR 冲突复查

**结论：需要（`requiresConflictRecheck: true`）。**

理由：SA8 前置门禁即以 `true` 布防（通知面失败语义与 testing 面增量尚待核对，§10）；本设计兑现 ADR 0030 决策 3/4/6
（无修订、无 override），但落地的 `invalidate-all` 第三触发源编排（父删/整替 → 清队语义）与 testing 注入面增量属
「通知面失败语义 + testing 面」实现核对范围。设计已按 SA8 §8-4 清单逐项自证，复审按同清单闭合后可落 false
（先例：T1 #387 设计复审 true → 实现复查闭合 false）：

| SA8 §8-4 项 | 设计自证位置 |
|---|---|
| ① override 字段未泄漏公共契约/主入口 | §7-D2（生产入口结构性不可达）、§10、§12-A8、§11 DENY（index/lease/plugin） |
| ② 默认容量仍为实现常量（不套用复制 fanout 冻结常量纪律） | §7-D5、§5（ADR 0010 L267 对照） |
| ③ 三 kind 形状逐键不变 | §7-D4（恰两键 freeze）、§12-A9/NC6 |
| ④ 父删/溢出两触发源订阅存活（簿记不摘除） | §7-D7、§8-B |
| ⑤ sequencer/槽序 diff 零触碰 | §7-D4（观察器内同步有界）、§11 DENY（sequencer/write 族）、§9 |
| ⑥ 复制面零改动 | §1 非目标、§11 DENY（replication 族） |
| ⑦ T2/T3 范围未顺带实现 | §1 非目标、§11 DENY（errors.ts / 既有谓词面零触碰） |
