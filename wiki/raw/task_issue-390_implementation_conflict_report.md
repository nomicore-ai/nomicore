# SA8 实现后冲突复查报告 — issue #390：溢出降级与父路径删除（变更订阅 T4）

- 复审对象：**implementation**（当前 worktree 未提交 diff：5 个 tracked 源文件 + 3 个新增契约测试文件；对照 ADR 0030 与规范架构逐项核对）
- 复审轮：iteration 1（dispatch `sa-488ed3f4-9fed-40e3-810b-03c2431cdb38`；分支 `mabf/issue-390`，基线 HEAD `28faeae`）
- 复审动因：前置门禁（iteration 0）`requiresConflictRecheck = true` + SA1 设计 §15 同判——通知面失败语义（溢出降级、结构性失效）与 testing 面增量落地后须按 §8-4 清单逐项闭合
- 结论速览：**verdict = clear**；15 项对照 = 5 × implements-existing-decision + 10 × no-conflict；**0 hard-conflict；0 override；0 evolution-required**；**requiresConflictRecheck = false**（§8-4 清单①–⑦对实际 diff 全部闭合；先例：T1 #387 实现复查闭合）

## 1. Reviewed subject

**implementation**。被审对象 = 当前 worktree 实际改动（`git diff --stat` = 5 files / 177 insertions / 19 deletions）：

- `packages/namespace-runtime/src/watch-map.ts`（`detectStructuralInvalidation` L278–296、handler 前置短路 L425–430、降级单点 `enqueueInvalidateAll` L452–460、`enqueueData` 溢出分支改调单点 L468–472、头注/C-3 注释更新）
- `packages/namespace-runtime/src/runtime.ts`（seam input 加法字段 L128–130、L581 第三参接线、`RuntimeForRegistryDiagnostic` 加法字段 L910–912、条件展开 L936–939、`captureSeamInput` 形状门 L1161–1178）
- `packages/namespace-registry/src/registry.ts`（`resolveWatchQueueCapacity` 单点 L205–218、internal options 加法字段 L461–466、构造期调用 L826、`runtimeOptionsFor` 两路注入 L878–900）
- `packages/namespace-registry/src/testing.ts`（`NamespaceRegistryTestingOverrides.watchQueueCapacity?` L66–71、透传 L177–181）
- `packages/namespace-registry/src/types.ts`（两条稳定 message 常量 L89–95）
- 新增三件套：`issue-390-watch-invalidation-fixture.ts` / `-red.test.ts`（A1–A9 + NC1–NC6，14 用例）/ `-surface.test-d.ts`

不重审任务简报与设计优劣（iteration 0 已 clear、SA2 已 approve）；不评实现质量与测试充分性（SA6/SA7 面）；只裁决 diff 与既有决策集的语义/架构冲突。

## 2. Inputs and decision set

- 决策基准：`docs/adr/` 全集（28 篇全部「已接受」，无被 supersede 的在约束 ADR）+ `CONTEXT.md`（「变更订阅」词条 L65–66）+ 模块 AGENTS 明确收录契约（runtime / namespace-registry）。规范权威 = `docs/adr/0030-change-subscription.md` 决策 3/4/5/6/7 + 验收缝 L88–97；纪律来源 = ADR 0008 L38–57（唯一 FIFO write sequencer / 槽序）、ADR 0011 L20/L123–128/L159（槽外调用点纪律，ADR 0030 §6 明文援引）。
- 流程输入：`task_issue-390.md`（简报）、`task_issue-390_relevant_decisions.md`、`task_issue-390_conflict_report.md`（前置门禁 §8-1..8-4 义务）、`task_issue-390_design.md`（§7-D1–D8、§11 ALLOW/DENY、§15）、`task_issue-390_sa2_review.md`（approve、零 BLOCKER/MAJOR、M1–M4 非阻断）、`task_issue-390_sa3_impl.md`（实现报告 + §8-4 自证表）、`task_issue-390_sa6_contract.md`（B-1–B-7 / A1–A9 / NC1–NC6）。**SA4/SA9 产物不存在**（本任务无该两角色 dispatch）——以其职责面由 SA6 契约 + SA2 攻击评审 + SA3 实现报告覆盖为输入现状，不构成证据缺口。
- Owner 评论：REST `issues/390/comments` = **[]（0 条）**（本 dispatch 现场复核，与简报/SA6/SA1/SA2/SA3 五方记录一致）——无 override 载体。
- 实现证据：`artifacts/sa3-issue390-*-recheck.log`（红 8 failed/6 passed、红 typecheck 恰 2 错、绿 14/14、surface 3 passed + no type errors、#387 回归 21/21、根 typecheck exit 0、两包全量 95 files/1020 tests、确定性复跑 ×3）——SA8 只读核对，未运行任何测试。
- 文件身份锚点（sha256 前 16 位）：watch-map `fcd2a1a8f68788b7` / runtime `d33f404fcf08e7c6` / registry `64753410c1206995` / testing `d76f8b76faae1cf4` / types `ef9840a12d496293`。

## 3. Decision analysis

| Decision | Clause | Subject behavior（实际 diff） | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| ADR 0030 决策 4（L50） | `invalidate-all`（订阅存活）触发源 = 通知队列溢出、**父路径删除** | 父删编排落地：`detectStructuralInvalidation`（严格祖先 `eventPath.length < depth` + 链上前缀 `isPathPrefix(eventPath, containerPath)` + 链上键 delete/update 真变）→ handler 内先于 `collectChanges` 短路 → 单条 `invalidate-all`；溢出降级改经同一单点（与 T1 L404–412 逐字节等价重构） | implements-existing-decision | `watch-map.ts` L278–296、L425–430、L452–477；绿证据 A3/A3b/A4/A5（`sa3-issue390-green-behavior-recheck.log` 14/14）；红侧同 4 例超时（真实缺口） | 无（已兑现） |
| ADR 0030 决策 4（L51） | 订阅终结只有三因（lease 释放 / schema 变更 / doc 替换）；**数据缺席与删除从不终结订阅** | 两触发源均零摘除：`subscriptions` 集与 `unsubscribed` 标志的写入点零改动；降级仅为队列事件（清队 + 单条入队），不发 `watch-end`；重建后 `data` 照常（`add` 旁路 + C-1 事件） | implements-existing-decision | diff 中 `watchMap`/`shutdown`/`unsubscribe` 路径零触碰（L480–551 原样）；A2/A3/A4/A5/A6 存活断言 + `not.toContain('watch-end')` 全绿 | 无（已兑现） |
| ADR 0030 决策 3（L38）+ 决策 4（L50 括注） | 数据缺席合法、订阅宽容等待；容器删除后订阅横跨重建、重建后条目照常到达 | 簿记仍为冻结 path 快照（L520）、建立判定纯 active schema 侧零 live 载体探测（L499–518 未动）；A6：删除 → 失效信号 → 重建 → 条目写以 `{path:['optionalTasks'],key:'r1']}` 形 `data` 到达、零重新订阅 | implements-existing-decision | `watch-map.ts` L127–137、L499–520；`-red.test.ts` A6（L406–445）绿 | 无（已兑现） |
| ADR 0030 决策 4（L44–53） | 三 kind 冻结形状；`invalidate-all` 恰 `{kind, origin}`；无 version/rev | 降级信号单点构造 `Object.freeze({ kind: 'invalidate-all', origin })` 恰两键；`data` 恰三键 + 定位符恰两键（`makeChange` 未动）；零新字段 | no-conflict | `watch-map.ts` L458、L473–475、L333–338；A9/NC6 `toStrictEqual` + surface `_invalidateAllKeys`/`_invalidateAllNo{Reason,Changes,Version,Rev}` 绿 | 无 |
| ADR 0030 决策 5（L55–60） | 宁多勿漏唯一不变量；真变过滤（同值写不通知） | 真变复用而非第二套判定：祖先级 update 复用 `isRealChange`（delete 恒真变；两侧 plain 深比较相等 → 过滤；live 载体 → 保守失效）；条目级语义零漂移（`>= depth` 事件照旧走 C-1/C-2）；链途径序列段保守失效（宁多方向）；无关路径零通知 | no-conflict | `watch-map.ts` L286–294（复用 L223–234 `isRealChange`、L239–248 `isPathPrefix`）；NC2（条目删除仍 `data`）/NC3（无关零通知）绿 | 无 |
| ADR 0030 决策 6（L64–65）+ ADR 0008（L38–57）+ ADR 0011（L20/L123–128/L159） | 挂点 = 写序列器事务提交后异步分发（sequencer slot 之外）；回调 throw 静默隔离；不得改变槽序与写结果 | 分发面零触碰：单飞微任务泵 L357–380 原样；降级三步（清队 + push + 泵调度）全为观察器内有界同步操作，零 sequencer 内 await；handler 整体 try/catch 零 throw 红线不变；`sequencer.ts`/`write.ts`/`schema-write.ts` 零改动 | no-conflict | `git diff --name-only` 恰 5 文件（无 sequencer 族）；`watch-map.ts` L414–437、L452–477；A7（`syncCallbacks === 0`、写全 `ok:true`）绿 | 无 |
| ADR 0030 决策 6（L66） | **有界队列**，溢出 → `invalidate-all`；**数值不进公共契约**——语义进契约，数值是构造参数 + 实现默认 | `WATCH_QUEUE_CAPACITY_DEFAULT = 16` 实现常量单点未动（全仓唯一出现处 `watch-map.ts` L99/L408）；容量仍为 `createWatchHub` 第三构造参数位（L405–408 签名零变化）；注入链 7 跳全部为加法可选字段，数值不出现在 lease 面/公共类型/主入口/plugin config；不套用 ADR 0010 L267 复制 fanout 冻结常量（16、不可配置）的相反纪律——本面保持可注入构造参数 | implements-existing-decision | grep 实证 `watchQueueCapacity` 仅现于 types/testing/registry/runtime 四文件内部；两包 `index.ts`、`lease.ts`、`plugin.ts`（config 键门仍 `{idleTimeoutMs?}` L154）零改动；surface `_productionEntryNoCapacity`/`_leaseNoCapacity`/`_testingOverridesNotOnMainEntry` + A8（lease 恒 16 键、runtime status 投影无该键）绿 | 无（已兑现） |
| ADR 0030 验收缝（L94） | 生命周期：**队列溢出（testing 工厂注入小上限）→ `invalidate-all` 且订阅存活**、回调 throw 隔离 | 注入缝落地：`NamespaceRegistryTestingOverrides.watchQueueCapacity?`（唯一注入面）→ internal options → `resolveWatchQueueCapacity` → `runtimeOptionsFor` 第三参两路 → `RuntimeForRegistryDiagnostic`/seam input → `captureSeamInput` 捕获 → `createWatchHub(doc, state, captured.watchQueueCapacity)`；undefined 触发缺省参数（生产行为逐字节不变）；A1/A2：capacity=1 + 同步段两次 un-awaited 写 → 恰一条两键 `invalidate-all`、零 data 越过、后续 `data` 自愈；NC1 反伪绿（不注入 → 零失效信号）证明断言对注入敏感 | implements-existing-decision | `testing.ts` L66–71/L177–181、`registry.ts` L205–218/L826/L878–900、`runtime.ts` L128–130/L581/L936–939/L1161–1191；fixture 走缺省生产 factory 通路（不提供 `runtimeFactory` 覆盖）；绿 14/14 + 复跑 ×3 | 无（已兑现） |
| ADR 0030 决策 6（L67） | 引擎只保证事务级原子通知 + FIFO | 结构性失效**短路**条目聚合（同事务至多一条通知）；清队只清在队未投递通知，已投递序不被越过（B-7 授权：`invalidate-all` 语义上包摄一切条目定位符）；泵仍 FIFO 出队 | no-conflict | `watch-map.ts` L427–430（短路）、L457（清队）、L365（shift FIFO）；A3b（同事务删 + 无关写 → 恰一条、零无关通知）、A3（`data` 先于失效信号）绿 | 无 |
| ADR 0030 决策 7（L71–72） | runtime：订阅簿记、宁多勿漏判定、异步分发与有界队列；registry：lease 公共面、类型别名与透传 | 分层归属正确：检测/降级全部落 runtime `watch-map.ts` 模块内（零导出变化）；注入控件落 registry 显式 testing surface（模块 AGENTS「hostile/test 控件留在显式 testing surface」）；`lease.ts` 零改动（透传面不变）；生产装配经既有 internal seam（`internal.ts` 零改动，type-guard 冻结面不触） | no-conflict | `git diff --name-only`（无 lease.ts/internal.ts/index.ts）；`runtime.ts` L581 为既有 seam 通道加法；`-red.test.ts`/fixture 仅 import 公共入口 + testing 子路径（零直连 `createWatchHub`/internal seam） | 无 |
| ADR 0030 决策 7（L73） | 通知不出进程：复制协议（instance-replication-v1）零改动 | `replication-*.ts`、`ws-replication`、协议文档零触碰；溢出自愈不触发 needs-resync（无任何复制状态标记挂接） | no-conflict | `git diff --name-only` 5 文件均非复制面；diff 全文无 needs-resync/wire 接触 | 无 |
| ADR 0030 决策 2（L20–31）+ 决策 4（L51 watch-end）+ errors 面 | 谓词词表 / `WATCH_MAP_OPTIONS_INVALID` / watch-end 两 reason 分属 T2 #388 / T3 #389；`WATCH_MAP_*` append-only | 零顺带实现：无 `where` 参数、无 watch-end 编排、零新 `WATCH_MAP_*` 码（`errors.ts` 零改动，码族仍恰 CARRIER_MISMATCH / SCHEMA_UNAVAILABLE 两码）；A9 明断零 watch-end（本任务范围外） | no-conflict | diff 中 `watch-end` 唯一命中为头注边界说明行；`errors.ts` L241–255 原样；`git status` 无 errors.ts | 无 |
| registry / runtime 模块 AGENTS（决策集收录） | 公共 API 只经 `src/index.ts` 增长；公共 API 只暴露 detached 投影；生产构造与测试 seam 保持内部 | 两包 `index.ts` 零改动（公共面零增长）；`RuntimeForRegistryDiagnostic` 新字段经 internal.ts 既有 type re-export 随行（受 restricted seam 约束的 registry 专用通道，非公共契约）；`resolveWatchQueueCapacity` 为 registry 模块私有（零值导出面扩张） | no-conflict | `git diff --name-only`；`internal.ts` L77 既有 re-export 原样；registry.ts diff 无新 export | 无 |
| CONTEXT.md「变更订阅」词条（L65–66）+ docs/AGENTS（代码行为变更须同步规范文档） | 术语与已述契约：`invalidate-all`（溢出 / 父路径删除，订阅存活）、数值不进契约、宁多勿漏、消费协议 v1 | 实现兑现的语义与词条/ADR 0030 L50 **已述文本零漂移**——父路径删除 → 失效信号本就是 L50 与词条明文承诺，本 diff 是兑现而非变更 ⇒ 无规范文档修订义务（文档缝细化属 T5 #391）；代码注释用词（降级、结构性失效、订阅存活、宁多勿漏）与词条一致，无 observer/推送/含值/version 撞词 | no-conflict | `CONTEXT.md` L65–66、`docs/adr/0030-change-subscription.md` L50/L66 原文 vs `watch-map.ts` 头注 L26–33；两文档零改动（`git status`） | 无 |
| #112 冻结文本先例 + fail-loud 纪律（D5 裁决④，SA2 ER-1 核验） | testing 控件垃圾值不得静默 fallback（「恒溢出」静默运行 = 静默降级，违反 fail-loud） | 构造期二分门：`resolveWatchQueueCapacity`（undefined→undefined；非 number→TypeError；域违例→RangeError；message 零插值零值回显，types.ts 稳定常量）+ seam 侧 `captureSeamInput` 形状门（统一 TypeError，防御面）；throw 前置于 enqueue、零副作用；**超出契约断言面**（SA6 §15-4：契约只需 `1` 被兑现）但方向为加门不缩面，无既有决策禁止 | no-conflict | `registry.ts` L205–218、`types.ts` L89–95、`runtime.ts` L1161–1178；registry 门排位 idleTimeoutMs 之后、randomBytes 之前（既有门禁文案/顺序零漂移 L820–826） | 无（契约断言缺席不构成冲突；动态锚定属 SA7 自由裁量） |

**边界裁决记录（非冲突，已在前序轮显式钉界，本轮核对未被无声扩大）**：

1. **整替（祖先级 update）纳入失效触发**：Yjs 将容器整替上报为祖先级事件、旧子树条目全部消失——排除即保留漏通知洞（ADR §5「漏不可接受」+ L50「父路径删除」的直接结论）；实现以 `isRealChange` 复用过滤同值整替（不噪声化）。与 SA6 B-4 / 设计 §7-D3 A5 裁决 / SA2 §3 核验一致。
2. **`add` 旁路（容器创建事务不编排失效信号）**：T1 N4「创建事件 kind 不钉」边界；ADR L50 括注只承诺「重建后条目照常到达」，未承诺创建信号——不通知不在 ADR 义务集内，且设计 §13 残余 + SA2 M3 已显式记录。实现与 T1 行为逐字节一致（A6 不断言重建事务 kind）。
3. **双触发源叠加折叠**：同一降级单点，连续结构性失效自然折叠为一条待投递（清队含旧失效信号，语义幂等）——SC-3/SC-4 攻击线 SA2 已推演，实现形态一致。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| （无） | — | — | — |

无合法 override 在场亦无 override 诉求：REST `issues/390/comments` = []（本 dispatch 现场复核）；无新 ADR 修订/废弃；无协议版本升级；ADR 0030 无自携演进条款被援引。实现兑现既有决策，不请求任何豁免。

## 5. Frozen surfaces（对实际 diff 逐项核对）

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| 通知三 kind 冻结形状 | `data` 恰三键 / `invalidate-all` 恰两键 / `watch-end` 两 reason；零 version/rev | ADR 0030 L44–53；CONTEXT L66 | **未变**——`Object.freeze({kind,origin})` 单点构造（L458）；A9/NC6 + surface 类型断言绿 |
| 队列数值不进公共契约 | 默认值不出现在 lease 面/公共类型/主入口/plugin/文档；testing override 属测试控件面 | ADR 0030 L66 | **未泄漏**——`16` 唯一现于 `watch-map.ts` L99 实现常量；`watchQueueCapacity` 仅现于 4 个内部文件；两包 index.ts/lease.ts/plugin.ts 零改动；A8 + surface 负锚绿 |
| `watchMap` lease 公共面 | `watchMap(path, listener) → { unsubscribe }`；16 键；registry 只透传 | ADR 0030 L14–18/L72；registry-open 16 键 | **未变**——lease.ts 零改动；A8 恒 16 键绿 |
| `WATCH_MAP_*` 错误码族 | append-only；不删不改；零新错误条件零新码 | errors.ts L241–255 | **未变**——errors.ts 零改动，码族仍恰两码 |
| 复制 wire 与 needs-resync 语义 | instance-replication-v1 / ReplicationSession 全不变 | ADR 0030 L66/L73；ADR 0010 L113/L151 | **未变**——diff 无任何复制面文件；无复制状态标记 |
| 写序列器单 FIFO 与槽序 | 通知分发恒在 sequencer slot 之外；槽序与写结果不变 | ADR 0008 L38–57；ADR 0011 L159 | **未变**——sequencer/write 族零触碰；泵原样；A7 同步段零回调、写全 ok |
| internal seam arity / type-guard | `Parameters extends [DocHandle, () => Promise<void>, unknown?]`；第三参对象加法不触断言 | internal.ts L43–63 + type-guard 测试 | **未变**——internal.ts 零改动；registry+runtime 全量族 95 files/1020 tests 绿（含 type-guard） |
| 谓词词表与 watch-end 词表 | `equals`/`in` 恒标量；watch-end 两 reason——T2/T3 面 | ADR 0030 L20–31/L51 | **未触碰**——无 where、无 watch-end 编排 |
| 文档缝现状 | ADR 0030 / CONTEXT.md 词条不因 #390 改动（T5 #391 范围） | 设计 §7-D8 | **零改动**——git status 无 docs/adr、CONTEXT.md |

## 6. Evolution requirements

无 `evolution-required` 项。实现不改变任何已接受决策的契约语义：全部行为（溢出降级验收、父删/整替失效编排、容量注入缝、订阅横跨缺席期）均由 ADR 0030 决策 3/4/5/6/7 + 验收缝直接授权；fail-loud 构造门为 testing 控件的加门防御面（#112 先例同构），无决策文本被违反或需修订。规范文档（ADR 0030 L50、CONTEXT.md L66）已含全部落地语义——兑现型实现，零文档演进义务。

## 7. Hard conflicts

无。15 项对照全部为 no-conflict 或 implements-existing-decision；未发现与任何已接受决策、模块 AGENTS 收录契约或 CONTEXT 术语不兼容且无 override 的行为。实现与设计（D1–D8）、SA6 契约（B-1–B-7）、SA2 评审约束逐条一致；红灯证据（8 failed 恰为两条独立缺口）与绿灯证据（14/14 + 回归 21/21 + 两包 1020/1020 + 双 typecheck exit 0）互洽。

## 8. Required actions（前置门禁 §8-4 复查清单闭合记录 + 非阻塞观察）

§8-4 清单（iteration 0 布防）对实际 diff 的闭合裁决：

| 项 | 闭合证据（SA8 独立核对，非转引 SA3 自证） | 裁决 |
|---|---|---|
| ① override 字段未泄漏公共契约/主入口 | grep 实证 4 文件内部边界；index/lease/plugin 零改动；A8 + surface `_productionEntryNoCapacity`/`_leaseNoCapacity`/`_testingOverridesNotOnMainEntry` 绿 | **闭合** |
| ② 默认容量仍为实现常量、未套用复制 fanout 冻结常量纪律 | `WATCH_QUEUE_CAPACITY_DEFAULT = 16` 单点未动且全仓唯一；容量仍可注入（构造参数位保持）——与 ADR 0010 L267「冻结不可配置」为相反纪律，未互相套用 | **闭合** |
| ③ 三 kind 形状逐键未变 | freeze 恰两键构造单点；A9/NC6 `toStrictEqual` + 类型面 13 断言绿 | **闭合** |
| ④ 父删/溢出两触发源订阅存活（簿记零摘除） | `subscriptions`/`unsubscribed` 写入点零改动；A2 自愈 data、A3/A4/A5 删除/祖删/整替后 data 恢复、A6 横跨缺席期零重订阅 | **闭合** |
| ⑤ sequencer/槽序 diff 零触碰 | `git diff --name-only` 恰 5 文件，无 sequencer/write 族；降级路径全同步有界、分发仍在既有槽外泵 | **闭合** |
| ⑥ 复制面零改动 | diff 无 replication 族；无 needs-resync/wire 接触 | **闭合** |
| ⑦ T2/T3 范围未顺带实现 | 零新 `WATCH_MAP_*` 码、无 where/watch-end/errors.ts 改动 | **闭合** |

非阻塞观察（不构成 required action，移交后续轮次）：

1. 容器**创建**事务（`add` 旁路）对持「缺席视图」的消费方零信号、重建事务内物化的种子条目不产生通知——T1 N4 未钉边界，设计 §13 残余 + SA2 M3 已显式记录；如消费方需要须新 AC（非本轮缺陷）。
2. `resolveWatchQueueCapacity`/seam 形状门无动态契约断言（SA3 延项记录）——testing 控件防御面，动态锚定与否属 SA7 自由裁量，与冲突门禁无关。

## 9. Verdict

**clear**。实现把 iteration 0 标记的 5 项 implements-existing-decision 义务全部落地（溢出注入验收、父删/祖删/整替失效编排、横跨缺席期验收、有界队列数值治理兑现），9 项冻结面逐项核对未变；0 hard-conflict、0 override、0 evolution-required、证据充分（红/绿/回归/typecheck 四面互洽且 SA8 独立复核 diff 与公共面）。前置门禁与设计两轮布防的 conflict-recheck 义务在本轮闭合。

## 10. requiresConflictRecheck

**false**。理由：§8-4 清单①–⑦已对实际 diff 逐项闭合（§8 表）；实现为纯既有决策兑现，无新决策面（公共 API、wire、schema、持久化、状态机、生命周期、失败语义、正式 override 均零变化——fail-loud 门为 testing 控件内部防御面）；规范文档与代码同变更集零漂移（兑现型实现，文档已含语义）。先例对齐：T1 #387 实现复查闭合落 false。后续 T2 #388 / T3 #389 / T5 #391 各自走独立门禁，不继承本轮标志。
