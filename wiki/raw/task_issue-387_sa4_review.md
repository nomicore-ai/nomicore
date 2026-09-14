# SA4 实现静态审查 — issue #387：watchMap 无谓词形态垂直通路（变更订阅 T1 / tracer bullet）

- 被审对象：**implementation**（branch `mabf/issue-387`，HEAD `6df1c61`，实现未提交；
  工作树实读 = 19 处已跟踪修改 + 4 个新源/契约文件，与 SA3 报告 / SA8 复核的清单一致）。
- 审查轮：iteration 0（SA8 实现后冲突门已清——`_implementation_conflict_report.md`
  verdict **clear**、`requiresConflictRecheck=false`——之后的 SA4 实现质量复核）。
- 方法：SA4 不运行测试 / 不启动服务 / 不修改实现；全部结论基于本轮独立实读
  （watch-map.ts 488 行全文、runtime.ts / errors.ts / index.ts / types.ts / lease.ts /
  ws-replication testing.ts 全量 diff、四处键集守卫与十处结构实现点 diff、契约三件套
  全文、ADR 0030 全文、p0.ts / read-schema-projection.ts / resolve-schema-at-path.ts /
  mutation-local.ts / replication-session.ts 关键段、SA3 artifact 日志 tail、独立五类
  模式全树 grep）。

---

## 1. Reviewed inputs

| 输入 | 状态 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-387.md`（brief） | 在场 | AC1–AC10 + 演示场景；评论 0 条（dispatch 确认 REST `[]`） |
| `wiki/raw/task_issue-387_design.md`（SA1 iteration 2，649 行） | 在场 | 被执行的冻结设计（B-2–B-7 / D1–D10 / §8-A–G / §11 ALLOW-DENY / §12 三门禁） |
| `wiki/raw/task_issue-387_sa2_review.md`（iteration 2，approve） | 在场 | Required revisions = 无；N-2「剩余缺口恰两行」为重试轮验收面 |
| `wiki/raw/task_issue-387_sa3_impl.md`（iteration 1 重试轮） | 在场 | Changed paths / File scope / V1–V7 证据索引 |
| `wiki/raw/task_issue-387_sa6_contract.md` | 在场 | 绑定表 B-1–B-7、红灯基线（20 红 / 1 绿 + 类型红）、非目标边界 |
| `wiki/raw/task_issue-387_implementation_conflict_report.md`（SA8，clear） | 在场 | §8-3 清单 ①–⑪ 裁决——本轮逐项独立复核的对象 |
| `docs/adr/0030-change-subscription.md`（零 diff） | 在场 | 规范权威（§1/§3/§4/§5/§6/§7 + 验收节逐条款对照） |
| `packages/namespace-{runtime,registry}/AGENTS.md`、`packages/ws-replication/AGENTS.md` | 在场 | 模块契约（公共 API 仅经 index / FIFO 边界 / testing surface） |
| 工作树 diff + `git status`（本轮独立对账） | 在场 | 文件范围 / DENY 零触碰证据 |
| SA3 artifact 日志（`artifacts/sa3-issue387-retry-*` 等，本轮 tail 复核） | 在场 | 三门禁与契约转绿的运行证据（SA4 不复跑，只核对日志与盘面一致性） |
| Owner 要求 | 无（REST `[]`） | 无条款需映射 |

## 2. Verdict

**approve（0 × BLOCKER，0 × MAJOR；Required revisions = 无）**

实现对设计 iteration 2 冻结面与 ADR 0030 T1 切片忠实：公共面纯加法（lease 15→16 /
runtime 14→15，type-only 两 index）、建立状态机六门顺序与冻结序逐位一致（含 ③b ROOT
载体门）、事务级推导一事务一通知 + 同 key 首见序去重、无过滤 origin 两态分类、
单飞微任务泵槽外分发 + 逐 listener 隔离、有界队列溢出降级、lease 释放同步段清理、
close 收口对称；十处结构实现点按 D9(a)/(b) 冻结形态全部落盘且经编译器双门禁
（exit 0）仲裁完备；DENY 域零 diff；SA6 契约三件套零改动且 20 红/1 绿 → 21/21 转绿。
本轮多角度攻击（泵丢失唤醒 / 重入 / 退订竞态 / 关停竞态 / 溢出 / 敌意 path / 载体
分界 / plain 容器漏通知假设 / origin 分类全量枚举）均未击穿。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| AC1 建立成功 + 恰 `{unsubscribe}`；数据缺席合法 | `watch-map.ts` ⑤ 纯 schema 侧判定（L440–454，`resolveSchemaAtPath` + `resolveCarrierKind` 零 live 探测）＋ ⑥ 返回 `Object.freeze({unsubscribe})`（L466–475）；契约 E1/E2/E3 绿（`-retry-contract-and-negctl.log` 21/21） | 落实 |
| AC2 无 active schema 整体拒绝 | ③ 门 `schemaState !== 'ready' ∨ activeTools 缺席` → `WatchMapError(WATCH_MAP_SCHEMA_UNAVAILABLE_CODE)`（L426–429）；fatal 期 schemaState 停留 preparing 被 `!== 'ready'` 覆盖 | 落实（E4 含 schema-ready 同场阳性对照） |
| AC3 载体失配 + message 区分 + 建立时刻校验穷尽 | ③b/④/⑤ 六拒绝位（L430–454），六 message 常量互异、零 path 回显（L109–123）；`WatchMapError` message 恒 `${code}: …` 前缀（errors.ts） | 落实（E5 三例逐字码 + message 区分断言绿） |
| AC4 定位符 `{path,key}`、不含值、`[...path,key]` 可读、与窗口读同构 | `makeChange`（L294–299）：新鲜冻结副本；通知深冻结（L406–410）；契约 N1 哨兵断言 + N2 readData/窗口读双预言机回环绿 | 落实 |
| AC5 一事务一通知 / 同 key 合并 / FIFO / 无效写零通知 | `onRootTransaction` 单回调 → `collectChanges` `Map<key>` 首见序去重（L262–290）；无效写零事务（`prepareMutation` 先于 transact）→ 零事件；契约 N1/B1/B2/P2 绿 | 落实 |
| AC6 槽外异步分发、不阻塞后续写 | 构造期单挂点 `root.observeDeep`（L395）只入队；泵每项投递前让步 20 微任务（L318–341，镜像 `createSessionFanout`）；`write.ts`/`sequencer.ts` 零 diff；契约 D1/D2 绿（D2 含回调内重入写接纳） | 落实 |
| AC7 回调 throw 静默隔离 | 泵内逐投递 try/catch（L328–332）+ handler 整体吞没（L380–391，DOCRT-E203 红线）；契约 X1 绿 | 落实 |
| AC8 退订幂等零通知 / lease 释放清理 | hub 句柄幂等（L466–473：标志 + 清队 + 摘订阅）；lease `activeWatches` + `doRelease` 首调同步段清理（lease.ts L232–246，`entry.leases.delete` 后、`dispatchObserver`/`onReleased` 前，逐句柄 try/catch 隔离）；契约 L1/L2 绿 | 落实 |
| AC9 契约三件套 | fixture / tracer-red / lease-surface `test-d` 在树且 SA3 零改动（mtime + SA8 对账）；runner 实命中（`vitest.config.ts` include + `-runner-list-final.log`） | 落实 |
| AC10 纯加法 / 既有面零改动 | 四处键集守卫 +1 行（16/15/15/15）；十结构实现点补最小成员；readData/窗口读/复制面/诊断/wire/持久化零 diff（本轮 `git status` 全量对账）；#369 负控 33/33 | 落实 |
| SA2 N-2（重试轮剩余缺口恰 ⑨⑩ 两行） | ⑨ `issue-369` `makeStubRuntime` throw stub + 计数注释（diff = +6/−1，零断言触碰）；⑩ `testing.ts` `watchMap: lease.watchMap.bind(lease),` 恰一行 | 落实（本轮 diff 逐行复核与 D9(a)/(b) 逐字一致） |
| SA8 §8-3 清单 ①–⑪ | 本轮独立复核全部成立：①16/15 键四处审计 ②十点 + 双 tsc exit 0 ③两码 append-only ④三 kind 闭集不含值 ⑤`classifyOrigin` 零过滤分支（L305–308）⑥doRelease 时序 ⑦观察器整体吞没 + 泵外层兜底 ⑧released throw 在场 ⑨两 index type-only（exports-audit 绿）⑩E3 + P0 7/7 ⑪#369 33/33 + 断言 diff=0 + ws-replication 导出面零 diff | 全部属实（SA8 裁决与盘面一致） |
| Owner 评论 | 0 条 | 无映射义务 |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| B-2 回调绑定 `(path, listener)` 恰两参 | runtime 接口 L285–288、lease 接口 types.ts L740–753、hub L85–88 | 与冻结一致；T2 options 槽位未占用 | — |
| B-3 同步 throw 面（`WatchMapError` 不进 index） | errors.ts 新类（code+message 消费）；runtime/lease/index 三处均不导出该类 | 一致；`_handleKeys` 恰一键的决定性依据成立 | — |
| B-4 `WATCH_MAP_SCHEMA_UNAVAILABLE` | errors.ts L241–247 + ③ 门 | 一致；与写域 `SCHEMA_UNAVAILABLE` 不混淆（D7） | — |
| B-5 三对别名（不设 Result/Options） | runtime index type-only 三名；registry types.ts 单源别名 + lease.ts 五条 Equal 锁（入 `LeaseTypeAssertions`） | 与 #369 先例同款 | — |
| B-6/B-7 通知/定位符形状 | watch-map.ts L60–81 类型 + 运行时深冻结构造 | 逐字段一致（含 readonly） | — |
| D1 事务事件驱动（非信封驱动） | `observeDeep` handler 消费 `event.transaction.origin` 与键级 delta | 一致；单挂点天然覆盖三来源 | — |
| D2 每 Runtime 恰一次 ROOT `observeDeep` | 构造期 L395 单次挂接；零订阅快路径 L381；`shutdown` 守卫摘除 L480 | 一致 | — |
| D3 纯 schema 侧判定 + optional 透明解包 | `resolveCarrierKind` L148–169（ref 追尽 / optional 解包 / 环与缺席 → `'unknown'` fail-closed 拒绝） | 一致；N-5 设计文本微瑕（optional 解包未写入规格文本）由实现侧补齐且为 E3 绿所必需——SA1 文本同步已登记，非实现问题 | — |
| D4 真变判定（plain 深比较、不可判保守） | `isPlainData`/`plainDataEquals`/`isRealChange` L176–233；深度上限 32；与 `logicalValuesEqual` 互指注释在场（O-2 兑现） | 一致；深度耗尽 → 判不等 → 保守通知方向正确 | — |
| D5 runtime 公共第 15 键（非 seam） | runtime.ts 接口 + 字面量透传 L751–753；生产装配经 `createNamespaceRuntimeForRegistry → createNamespaceRuntime → WithSeam`（internal.ts L61 / runtime.ts L918）均获得 hub | 一致 | — |
| D6 lease 句柄登记 + runtime 幂等退订 | lease.ts L226–228 / L347–362；doRelease L232–246 | 一致；双幂等包装（本层标志 + hub 标志） | — |
| D8 无过滤全事务推导 | `classifyOrigin`（null→local、symbol→replication、其余→local 两态收敛）+ `onRootTransaction` 零过滤分支 | 一致；本轮枚举全部 `transact`/`applyUpdate` 源：本地图写 `transactGuarded`（无 origin）、复制 apply（per-session symbol，replication-session.ts L764）、META 写（replication-write.ts，不触 ROOT）——分类面闭合 | — |
| D9 十处结构实现点两类形态 | 五 class 桩（+import `NamespaceRuntimeWatchMapHandle`）+ ⑧⑨ 字面量 throw stub + ⑥⑦ 字面量一行 + ⑩ `.bind(lease)` 透传 | 逐字一致；本轮独立五类模式 grep：剩余命中全为工厂委托 / `as` 收窄 / 原型委托（抽查 4 处实读确认），编译器双门禁 exit 0 仲裁清单完备 | — |
| D10 ROOT 载体门 ③b | `captureRootMap` L353–359（try/catch → undefined，构造零抛零副作用）+ ③b L430–434（复用 `WATCH_MAP_CARRIER_MISMATCH` 码 + 专属 message，不新增注册表条目）+ `shutdown` `root !== undefined` 守卫 | 一致；P0 AC5 锚 7/7 保持绿（`-retry-contract-and-negctl.log`）；与「数据缺席合法」分界成立（③b 只看构造期 doc 级事实，⑤ 零 live 探测） | — |
| §8-E 有界队列 + 溢出降级 | `enqueueData` L397–413：`>= capacity` 清队 + 单条 `invalidate-all`（origin = 触发事务分类）；容量单参数位默认 16（L98/L368） | 一致；T4 注入与验收为已登记分期义务 | — |
| §8-G close 收口 | `closeAfterFence` 与 `fanout.terminateAll` 并置 `watchHub.shutdown()`（runtime.ts L628–636）；普通 close（L876）与 reset fence（L641 `createBeginResetFence(…, closeAfterFence)`）双入口汇合同一 admission | 一致；静默关停（无 watch-end）与 ADR §4 终结三因不含 runtime close 一致 | — |

设计明确但实现缺失：**无**（T1 非目标清单——where 词表 / replication 断言编排 / watch-end /
溢出注入与父路径删除编排 / watchArray / 含值通知——均未越界实现，也未提前实现）。

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| 订阅簿记 / 建立判定 / 推导 / 分发 / 关停 | runtime（doc 生命周期 Owner，ADR 0030 §7） | `watch-map.ts` 全量 | 正确 |
| lease 公共面 / released 通道 / capability 清理 | registry lease | `lease.ts` 纯透传 + 登记 + doRelease 清理 | 正确（lease 零判定零解释） |
| registry 编排 | registry（不动） | `registry.ts`/`observer.ts` 零 diff | 正确（透传无需编排） |
| 测试替身成员同步 | 各测试文件自身 | 十处就地补齐 | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| 单飞微任务泵 + 有界队列 + 逐 listener 隔离 | `createSessionFanout`（replication-session.ts L188–334，容量 16 / 让步 20） | `schedulePump` 同款泵形、同常数、同纪律 | 一致（设计明令镜像） | 语义信号面与 session bytes 面分属两泵，非重复机制（ADR §7 分层） |
| 敌意 path 单次快照 | `normalizeReadPath`（read-schema-projection.ts） | 直接复用（L436） | 一致 | 零第二实现 |
| schema 路径分类 | `resolveSchemaAtPath`（vfsl） | 直接复用 + `resolveCarrierKind` 薄追尽层 | 一致 | ref/optional 解包是消费侧职责 |
| 恒 throw 测试桩 | #369 readArray/readMap stub | D9(a) 同款式（注释 + 响亮拒绝） | 一致 | 先例照搬 |
| 停接纳 lifecycle 通道 | `RuntimeReadDisabledError`（getter 词表） | 词表 append-only 加 `'watchMap'`（additive） | 一致 | 既有调用点零影响（gate③ exit 0） |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 订阅集合 | hub `subscriptions`（runtime） | lease `activeWatches`（仅句柄登记，非订阅状态副本） | 无（清理经同一 unsubscribe 入口，无双事实） |
| schema 判定 | activeTools.derived（每次建立现算） | 无缓存 | 无 |
| origin 分类 | `event.transaction.origin`（每事务现读） | 无 | 无 |
| 公共面形状 | 接口 + 四处键集断言 | 无从文件/标签反推 | 无 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| `observeDeep` 构造期一次挂接 | `shutdown` 守卫摘除（幂等 `shutdownDone`） | 异型 ROOT → 不挂接 + ③b 响亮拒绝 | 对称 |
| `watchMap` 登记 + 句柄 | `unsubscribe` 幂等（标志 + 清队 + 摘订阅）/ lease release 同步段全清 / close 同步段防御性收口 | 失败路径零登记零 observer 变更（校验全前置） | 三条退订路径全幂等、零通知回声 |
| 泵启动（单飞守卫） | 让步点重检 `unsubscribed`/空队退出，finally 复位守卫 | listener throw 逐个吞没；泵体最外层兜底 | 对称（丢失唤醒分析见 §8） |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 第二套泵 | `createSessionFanout` | `schedulePump` | 非重复：ADR 0030 §7 明文 runtime 分发层；常数与泵形刻意同源（R2），语义面（三 kind 定位符）与 session bytes 面正交 |
| 深比较第三副本 | doc-runtime `logicalValuesEqual` | `plainDataEquals` | 已登记维护债（O-2：单点副本 + 互指注释 + 漂移时同步复查义务）；R3 后续精化过评审 |
| 第二评论读取 / marker / 旁路 RPC | — | — | 无 |

## 6. 文件范围审查

`git status`（本轮全量对账）：19 处已跟踪修改 + 4 新文件，逐行核对 ALLOW：

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/namespace-runtime/src/watch-map.ts`（新） | §11 第 1 行 | 唯一新实现载体 | 在允许内 |
| `packages/namespace-runtime/src/runtime.ts` | 第 2 行 | 第 15 键 + hub 装配 + close 收口 | 在允许内（diff 恰三段 + import） |
| `packages/namespace-runtime/src/errors.ts` | 第 3 行 | 两码 + `WatchMapError` + getter 词表 additive | 在允许内（纯追加 + 词表行） |
| `packages/namespace-runtime/src/index.ts` | 第 4 行 | type-only 三别名 | 在允许内 |
| `packages/namespace-registry/src/types.ts` | 第 5 行 | 第 16 键 + 三别名 | 在允许内 |
| `packages/namespace-registry/src/lease.ts` | 第 6 行 | 实现 + 登记 + 清理 + 五锁 | 在允许内 |
| `packages/namespace-registry/src/index.ts` | 第 7 行 | type-only 三别名 | 在允许内 |
| `registry-open.test.ts` | 第 8 行 | 键集 15→16 + ⑧ stub | 在允许内 |
| `runtime-registry-internal-seam.test.ts` | 第 9 行 | 键集 14→15 | 在允许内 |
| `runtime-phase5-reset-fence-r2.test.ts` | 第 10 行 | 键集 + it 标题计数（R5 可选项） | 在允许内 |
| `runtime-close-lifecycle.test.ts` | 第 11 行 | 键集（负向事件订阅词表未动、watchMap 未加入——正确） | 在允许内 |
| 五个 class 桩测试（idle/sa7-concurrency/sa7-hostile/sa7-rev1/shutdown） | 第 12–16 行 | D9(a) 成员 + import | 在允许内 |
| `registry-readdata-budget-passthrough.test.ts` / `registry-readdata-projection-text-red.test.ts` | 第 17–18 行 | 字面量桩一行 | 在允许内 |
| `issue-369-window-read-lease-contract-red.test.ts` | ALLOW ⑨ 行 | D9(a) stub + 计数注释；断言零改动（diff 实读确认） | 在允许内（逐行级改判未扩大） |
| `packages/ws-replication/src/testing.ts` | ALLOW ⑩ 行 | 恰一行 `.bind(lease)` 透传 | 在允许内（导出面/wire 零改动） |
| 契约三件套（fixture / tracer-red / test-d，未跟踪新文件） | SA6 落盘产物 | 验收契约 | SA3 零改动（mtime 19:09–20:25 早于 SA3 编辑 22:19–23:06） |

DENY 域零 diff：`write.ts`/`sequencer.ts`/`schema-write.ts`/`replication-write.ts`/
`replication-session.ts`/`window-read.ts`/`read-schema-projection.ts`/`schema-rearm.ts`/
registry `registry.ts`/`observer.ts` 等、`docs/**`、`CONTEXT.md`、`vitest.config.ts`、
`package.json`、`issue-387-watch-map-fixture.ts`、ws-replication `src/index.ts`、
replication-protocol / persistence——`git status` 零命中。两项可选授权（E4 逐字码收紧、
B-5 别名 Equal 锁追加）未取用（保守侧，合规）。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| `NamespaceRuntime` 必填第 15 键 | 十处结构实现点（五类形态） | 全部补齐；编译器双门禁（`tsconfig.typecheck.json` 含 `packages/*/src/**`+`test/**`、根 `pnpm typecheck` 14 包）exit 0 = 完备性仲裁；本轮独立 grep 剩余命中全为委托/收窄（抽查实读） | 无 | — |
| `NamespaceLease` 必填第 16 键 | lease.ts 本体 + ws-replication `decorateLease` | 均落盘；全树无 `keyof NamespaceLease` 穷举断言（本轮 grep 零命中） | 无 | — |
| `RuntimeReadDisabledError` 词表加宽 | 既有 getter 三名调用点 | additive 联合加宽，既有调用点类型不变；watchMap 通道 message 含 getter 名可区分 | 无 | — |
| `WatchMapError`（类不进 index） | 消费方以 `code`/`message` 字符串消费 | 契约经面中性归一读 `error.code`——兼容 | 无 | — |
| 错误码注册表 append-only | 稳定码消费方 | 仅追加两常量 + 类；既有码零改动；③b 复用 CARRIER_MISMATCH 不新增条目 | 无 | — |
| 复制 wire / 协议 / 持久化 | ws-replication / replication-protocol / persistence | 零 diff（⑩ 仅 testing surface 成员行）；通知不出进程 | 无 | — |
| readData 四键 / 窗口读 / 诊断冻结面 | 全部既有消费者 | 零 diff；NC1 + #369 33/33 + readdata 守卫门 24/24 绿（gate② 内） | 无 | — |
| registry 服务构造 / observer seam | ADR 0023 访问器纪律 | `registry.ts`/`observer.ts` 零 diff | 无 | — |

## 8. 错误、恢复与并发

静态攻击与结论（全部代码级推演，未能击穿的项才放行）：

1. **泵丢失唤醒**：唯一生产者 = `onRootTransaction`（同步）。泵退出检查（while 条件）
   与 `finally` 复位 `pumpScheduled` 处于同一无 await 同步段 ⇒ 生产者要么在该段前
   （泵继续消费）、要么在该段后（`pumpScheduled` 已 false → 新泵）——第三种交错不存在。
   listener 内重入写的事务若在 listener 返回前提交（同步链内），此刻 `pumpScheduled`
   仍 true → while 重检接续消费；若异步提交则新泵。无丢失唤醒。
2. **退订竞态**：`unsubscribe()`（用户调用 / lease release 遍历 / shutdown 置位三条路径
   同一入口语义）设标志 + 清队；泵在让步后重检退出——退订后零投递（L1 双屏障断言绿）。
   Set 迭代中 delete 当前元素为 JS 合法操作，release 清理无跳漏。
3. **关停竞态**：`shutdown` 幂等（`shutdownDone`）；摘 observer 后事务观察器不再触发；
   在途泵经 `unsubscribed` 标志于下一让步点退出；普通 close 与 reset fence 汇合同一
   `closeAfterFence`（runtime.ts L628–641/L876），无第二关停路径。
4. **溢出恢复**：`>= capacity` 清队 + 单条 `invalidate-all`（订阅存活，消费面全量重拉
   自愈——ADR §6）；降级后到达的 data 通知追加于 invalidate-all 之后，语义自洽。
5. **观察器零 throw（R1 红线）**：handler 整体 try/catch 吞没（含零订阅快路径在内）；
   泵 async 体另有最外层兜底 + finally 复位——任何内部异常不得升级 DOCRT-E203 写 fatal。
   行为级故障注入用例属 T4 #390（O-5 登记）。
6. **无效写 / 敌意输入**：无效写零事务 → 零通知（P2 绿）；敌意 path 经 `normalizeReadPath`
   迭代纯度守卫收敛 null → CARRIER_MISMATCH（PATH_SHAPE_MESSAGE），Proxy/getter 陷阱零外泄。
7. **TOCTOU / 双写 / stale generation**：建立期快照后不再读调用方输入；`state` 闭包活读
   （lifecycle/schemaState 每调用现值）；无缓存态可陈旧。
8. **plain object 容器漏通知假设——证伪**：`mutation-local.ts` 导航纪律要求 map 步载体为
   Y.Map（「不实例化不匹配载体」），嵌套写进 plain 容器在写面即被拒绝 ⇒ 无「数据已变而
   通知缺失」的通路；plain 容器唯一可达变更 = 整值替换 = C-3（T4 已登记边界）。
9. **同事务 delete-then-set / set-then-delete**：键级 delta 最终动作（update/delete）两态
   均判真变或深比较——方向恒为宁多勿漏，无漏路径。
10. **部分完成诚实性**：建立失败零登记零 observer 变更（校验全前置）；release 清理失败
    逐句柄隔离不阻断 `onReleased`；无半建立态。

静态无法确认的运行风险列入 §11。

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| `issue-387-watch-map-tracer-red.test.ts`（21 用例：T1/E1–E6/N1–N4/B1–B2/D1–D2/X1/L1–L2/P1/P2/NC1） | AC1–AC8+AC10 全行为面；成功形状逐键 `toStrictEqual`；哨兵断言通知不含值；`expect.poll`+屏障零 sleep 竞猜；E4 schema-ready 同场阳性对照（反假绿） | `vitest.config.ts` L15 include（registry test 目录）；SA6/SA3 `vitest list` 实命中 | 无 skip/only/todo（本轮 grep）；无 env override；无源码字符串断言 | — |
| `issue-387-watch-map-lease-surface.test-d.ts` | 16 条结构断言（绑定/路径同源/句柄一键/三键/两键/回环）+ 4 条 `@ts-expect-error` 负例（fail-closed） | typecheck include（L20）+ `tsconfig.typecheck.json`；`--typecheck` 模式 2/2 | 无 unused directive；负例敏感度经 NC5 假想实现预验证 | — |
| `issue-387-watch-map-fixture.ts` | 非测试文件（B-2/B-3 面中性单点适配） | 不收集（设计如此） | — | — |
| 四处键集守卫（registry-open / internal-seam / phase5 / close-lifecycle） | 16/15/15/15 精确清单；close-lifecycle 负向事件订阅词审计原样未动且 watchMap 未入词表 | gate② 全量内绿 | 纯 +1 行，无弱化 | — |
| #369 负控（33/33） | 既有窗口读冻结面零回归 | gate② 内绿 | 断言 diff = 0（本轮 diff 实读：仅注释 + 一 stub 成员） | — |
| `runtime-p0-sequencer.test.ts`（AC5，零 diff） | 异型 ROOT 构造照常 ready（③b 分界锚点） | 7/7 绿 | 未动 | — |
| SA6 红灯保持性 | 实现前 20 红 / 1 绿（`-red-baseline.log` tail 复核：`20 failed \| 1 passed`，exit 1）→ 实现后 21/21（`-retry-contract-and-negctl.log`：4 files / 63 tests / no type errors，exit 0） | — | 红灯基线与转绿证据链完整；红灯断言未被修改（契约文件零改动） | — |
| 三门禁 | ① `tsc -p tsconfig.typecheck.json` exit 0；② `pnpm test` 394 files / 4753 tests / no errors / exit 0；③ 根 `pnpm typecheck` exit 0 | 日志 tail 本轮复核：三个 EXIT MARKER 均为 exit=0，计数与 SA3 报告一致 | 无 | — |
| 缺口（非弱化） | released lease 调 `watchMap` → `NamespaceLeaseReleasedError` 通道已实现（lease.ts L352）但无直接断言（L2 只证清理）；③b/敌意 path 两个 message 位无行为断言（设计 §12 明示非目标边界 R10）；E5 message 区分只断言一对 | — | 记录为 Non-blocking observations §12 | MINOR |

## 10. Required revisions

**无（0 × BLOCKER / 0 × MAJOR）。**

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| 溢出降级（容量 16）真实触发 | T4 #390 testing 工厂注入小上限 + 突发 >容量事务 | 清队 + 恰一条 `invalidate-all`（origin = 触发事务分类）+ 订阅存活、后续 data 恢复 | 溢出后丢订阅 / 队列未清 / origin 误分类 |
| `'replication'` 分类真实触发 | T3 #389 经 `openReplicationSession` + `applyRemoteUpdate` 驱动 peer apply 触及订阅容器 | data 通知 `origin === 'replication'`（D8 无过滤机制结构性在产——`classifyOrigin` 零过滤分支） | 过滤掉 symbol-origin 事务 / origin 误报 'local' |
| 观察器故障注入（R1/O-5 红线可测性） | T4 #390 注入 handler 内 throw | 写结果不变、无 DOCRT-E203、其余订阅照常 | 事务栈异常升级写 fatal |
| C-3 边界（容器删除/整替零信号）的消费侧风险 | T4 #390 父路径删除编排 | 现状：订阅容器被 delete/整替后**零信号**直至下次条目写——消费方持有过时视图 | 若 T4 #390 不交付，ADR §4「父路径删除 → invalidate-all」验收条款悬空（SA8 §8-4 已登记） |
| schema 替换静默窗（R9） | T3 #389 watch-end 编排 | 现状：订阅跨 `replaceSchema` 存续且无信号 | 同上（ADR §4 watch-end 条款悬空） |
| 泵公平性 / 事件循环占用 | 高频事务 + 重入 listener 压测（maxWorkers:1 环境尤甚） | 每项 20 微任务让步不产生墙钟等待；与 fanout 同常数同泵形（R2 论证同源） | 出现写槽饥饿或测试超时 |
| released 通道行为 | 追加断言（本票未断） | released lease 上 `watchMap` 同步 throw `NamespaceLeaseReleasedError`（lease.ts L352 已实现） | 任何静默建立或别的错误面 |

## 12. Non-blocking observations

- **N-1（测试缺口，MINOR）**：released lease → `NamespaceLeaseReleasedError` 通道已实现
  但契约无直接断言（SA8 清单 ⑧ 的「契约绿」实为「无红」而非阳性断言）；AC8 的清理半边
  已由 L2 覆盖。后续票（T2–T5 任一触契约面时）可补一行断言。
- **N-2（文案微瑕，MINOR）**：`RuntimeReadDisabledError` 族 message 尾注「close 已停止
  接纳公共数据投影读取」对 `getter='watchMap'` 语义略偏（订阅建立非投影读取）；码 +
  getter 名 + lifecycle 三元组仍可区分，稳定消费面（code）不受影响。
- **N-3（断言粒度，MINOR）**：E5 的 message 区分只断言「数组载体 vs 偏离 schema」一对；
  其余 message 对（标量/形状敌意/ROOT 载体）依赖构造性互异。③b 与敌意 path 两拒绝位无
  行为断言（设计 §12/R10 已声明非目标边界）。
- **N-4（plain 容器通知面，MINOR）**：plain object 载体容器只有建立断言（E2），无通知流
  断言；经查写面导航纪律（`mutation-local.ts`「不实例化不匹配载体」）嵌套写进 plain 容器
  即被拒绝，故无漏通知通路——但「plain 容器唯一可达变更 = 整值替换（C-3，T1 零信号）」
  这一交互建议在 T4 #390 编排父路径删除信号时一并覆盖。
- **N-5（沿袭项重申）**：深比较第三副本（`plainDataEquals` ↔ `logicalValuesEqual`）维护债
  （O-2 注释互指已落）；T2/T5 签名简写回调位对账、R3/R4 后续精化过评审、N-5 设计文本
  `optional` 解包同步（SA1）——均已由 SA8 §6 分期表登记，勿在后续票关账时丢失。
- **确认项（非瑕疵）**：空路径 `watchMap([])` 合法边界（O-3）已在 watch-map.ts 文件头
  注释落锚（L41–42）；`classifyOrigin` 对非 null 非 symbol origin 收敛 'local' 为两态
  闭集的全量收敛（当前仓内无第三种 origin，本轮枚举确认）。
