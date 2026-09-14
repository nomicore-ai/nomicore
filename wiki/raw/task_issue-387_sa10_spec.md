# SA10 Spec Review — issue #387：watchMap 无谓词形态垂直通路（变更订阅 T1 / tracer bullet）

- 被审对象：**已提交最终交付** —— delivery commit `363cc476557fd4a55ee0cded08bc7a478f345719`
  （`feat(registry): add watchMap subscriptions`），直接落在 Parent PR #386 基座
  `6df1c6129ede45aa187964bd558bf552a143a299`（ADR 0030）之上；基座与 dispatch 声明逐字一致。
- 审查基准：issue #387 正文（What-to-build + 演示场景 + AC1–AC10）+ SA6 验收契约
  （`_sa6_contract.md` §12 绑定表 B-1–B-7、§12.6 红线）+ ADR 0030（T1 切片规范权威）。
  Owner 要求：**无**（issue 评论 REST 快照 `[]`）→ 无 owner override 需映射。
- 方法：SA10 独立实读交付物全部源码 diff（watch-map.ts 488 行全文 + runtime/errors/index/
  lease/types/两 index/testing.ts 全量 diff + 四处键集守卫与十处结构实现点 diff + 契约
  三件套全文）与 ADR 0030/CONTEXT 词条；不运行测试（证据链取 SA3/SA7 落盘日志 tail 复核）。
- 结论：**approve**——AC1–AC10 全部满足且有行为/类型断言锚定；SA6 绑定表逐项兑现；
  ADR 0030 T1 切片忠实；非目标零越界；冻结面零 diff；红→绿证据链完整（20 红/1 绿 →
  21/21 + 类型契约零错误；根门禁 394 文件 / 4753 用例 / exit 0）。未达成项 = 无；
  仅 MINOR 级观察（不阻断），与已登记的分期义务（T2–T5，各有其票）须在 PR 披露。

---

## 1. Issue AC ↔ 交付映射（逐条裁决）

| AC | 要求 | 交付落点 | 契约锚 | 裁决 |
|---|---|---|---|---|
| AC1 | `watchMap(path)` 无谓词在键容器（Y.Map / plain object）建立成功，返回恰 `{unsubscribe}`；数据缺席合法 | `watch-map.ts` ⑤ 纯 schema 侧判定（`resolveSchemaAtPath` + `resolveCarrierKind`，ref 追尽 / optional 透明解包，零 live 探测）+ ⑥ 返回 `Object.freeze({unsubscribe})`（L415–476）；lease 透传同款句柄 | T1（能力存在）、E1（Y.Map + 恰一键句柄）、E2（封闭 map `meta` + plain object `tasks`，readMap oracle 对齐）、E3（未物化 `ghost` + 已删除 `optionalTasks`）、N4（横跨创建后条目到达） | **met** |
| AC2 | 无 active schema 整体拒绝（含无谓词） | ③ 门 `schemaState !== 'ready' ∨ activeTools 缺席` → 同步 throw `WatchMapError('WATCH_MAP_SCHEMA_UNAVAILABLE')`（B-4 冻结码字已在 errors.ts append-only 注册）；fatal 期 schemaState 停留 `'preparing'` 被 `!== 'ready'` 覆盖 | E4（legacy 拒绝 + 同场 schema-ready 阳性对照反假绿） | **met** |
| AC3 | 偏离 schema / 非键容器（含数组）→ `WATCH_MAP_CARRIER_MISMATCH`（message 区分）；校验全在建立时刻；通知流零参数错误 | ④⑤ 门四路同码异 message（数组 / 标量非键容器 / 偏离 schema / 形状敌意）+ ③b ROOT 载体门专属 message + ② listener 形状 TypeError；六 message 常量互异、零 path 回显；通知对象由 hub 构造，kind 恒三 kind 闭集 | E5（三例逐字码 + 数组 vs 偏离 message 区分断言）、E6（通知流 kind ∈ 闭集） | **met** |
| AC4 | 本地写定位信号：`changes` = `{path,key}` 列表，与窗口读条目同构，`[...path,key]` 可直接读 | `collectChanges` C-1（容器本体逐键真变）/ C-2（嵌套归条目 key）；`makeChange` 新鲜冻结副本；通知深冻结纯数据 | N1（恰三键/恰两键/origin local/哨兵不外泄）、N2（readData + 窗口读双预言机回环 toStrictEqual）、N3（嵌套字段归 `t1`） | **met** |
| AC5 | 一事务一通知（批量 `ops` 单事务 → 单通知）；同事务同 key 合并 | `observeDeep` 每事务恰一次回调 → 每订阅至多一条 data；`Map<key>` 首见序去重；队列 FIFO | N1（两键批量恰 1 条 2 定位符）、B1（同条目兄弟路径恰 1 定位符）、B2（两事务恰 2 条 FIFO）、P2（无效写零通知） | **met** |
| AC6 | 槽外异步分发、不阻塞后续写 | handler 只入队（事务栈内零投递）；单飞微任务泵每项前让步 20 微任务（镜像 `createSessionFanout` 常数）；write.ts/sequencer.ts 零 diff | D1（mutateData 同步段零回调）、D2（回调内重入写被接纳并完成） | **met** |
| AC7 | 回调 throw 静默隔离 | 泵内逐投递 try/catch + handler 整体吞没（DOCRT-E203 红线——observer throw 会收编写 fatal） | X1（坏消费者被调用但写 ok、健康订阅照常、后续写 ok） | **met** |
| AC8 | 主动 `unsubscribe` 幂等零通知；lease 释放自动清理 | hub 句柄标志幂等 + 清队 + 摘订阅；lease `activeWatches` 登记 + 双幂等包装 + `doRelease` 首调同步段遍历退订（`entry.leases.delete` 后、`onReleased` 前，逐句柄隔离） | L1（双次退订零 throw + 双屏障零通知）、L2（跨 lease 屏障：释放后旧订阅零到达） | **met** |
| AC9 | 契约测试三件套（fixture + 行为 red + `*.test-d.ts`；#369 先例） | 三文件在交付 commit 内：`issue-387-watch-map-fixture.ts`（381 行，非收集）+ `issue-387-watch-map-tracer-red.test.ts`（623 行 / 21 用例）+ `issue-387-watch-map-lease-surface.test-d.ts`（113 行 / 16 结构断言 + 4 负例）；SA6 §14 runner 实命中 | 本审查实数：tracer-red 恰 21 个 `it(`；零 skip/only/todo/env override（grep 零命中） | **met** |
| AC10 | registry 公共面纯加法；既有 readData / 窗口读 / 复制面零改动 | lease 15→16 / runtime 14→15（纯加行）；两 index 均 type-only 追加（值导出面不变：runtime 仍恰 `RuntimeWriteFatalError` 一键）；三对单源别名 + lease.ts 五条 Equal 锁入 `LeaseTypeAssertions`；十处结构实现点按 D9(a) throw stub / D9(b) 装饰器透传补齐；`git diff` 实证 write/sequencer/window-read/read-schema-projection/replication-session/registry.ts/observer.ts/replication-protocol/persistence/ws-replication index/docs/CONTEXT/vitest.config/package.json **零 diff** | P1（恰 16 键 + 既有 15 键全保留）、NC1（readData 经 `expectReadDataOkKeys` 集中化 helper + 窗口读 + `WINDOW_CARRIER_MISMATCH` + active 状态）；#369 负控 33/33 且断言 diff = 0 | **met** |

**演示场景（What-to-build）**：open → `watchMap(['tasks'])` → 单事务两 set → 恰一条
`{kind:'data',origin:'local',changes:[{path,key}×2]}` → `readData([...path,key])` 补拉成功
——由 N1+N2 合并覆盖；SA7 探针 A1 动态验证通知 JSON 逐字命中且四层 `Object.isFrozen` 全 true。**met**。

## 2. SA6 验收契约绑定表兑现（B-1–B-7）

| 绑定 | SA6 默认 / 授权 | SA1 冻结 | 交付兑现 | 裁决 |
|---|---|---|---|---|
| B-1 方法名/参数序/返回 | `watchMap(path, listener, options?) → {unsubscribe}`，unsubscribe 幂等 | T1 = `(path, listener)`；options 槽 T2 纯加法加宽 | 与冻结逐字一致（runtime 接口 L285 区 / lease types.ts L740 区 / hub L85–88） | 兑现 |
| B-2【承重】回调绑定 | 位置参数第二参（SA6 必裁项；NC5 已按此验证可满足） | 维持默认：positional listener、恰一参、返回 void | 逐字一致；类型契约绑定块与 fixture `WATCH_MAP_BINDING` 单点零改动即转绿 | 兑现 |
| B-3 拒绝面 | 面中性（throw 或信封）；承重 = 响亮 + 稳定 code + message | 收窄为**同步 throw** `WatchMapError`（SA6 授权收窄；决定性依据 = 类型契约 `_handleKeys` 恰一键） | `WatchMapError`（code+message，类不进 index——沿 `RuntimeReadDisabledError` 先例）；fixture `attemptEstablishWatch` 归一器天然兼容；配套通道 released → `NamespaceLeaseReleasedError`、closing/closed → `RuntimeReadDisabledError`（getter 词表 append-only +`'watchMap'`）、非函数 listener → `TypeError` | 兑现 |
| B-4 无 schema 码 | 未命名；断「非空稳定 code + message + 禁止静默建立」 | `WATCH_MAP_SCHEMA_UNAVAILABLE` | errors.ts append-only 注册并 throw；E4 断言（非空 code+message+阳性对照）绿 | 兑现 |
| B-5 别名命名 | 未预设（结构推导）；冻结后授权追加 Equal 锁（可选） | `Namespace{Runtime,Lease}WatchMap{Notification,Change,Handle}` 三对；不设 Result/Options | 逐字一致：runtime index type-only 三名、registry types.ts 三名单源别名、lease.ts 五条 Equal 锁（含 `Parameters`/`ReturnType` 对偶锁） | 兑现 |
| B-6 通知形状 | data 恰三键 `{kind,origin,changes}`；不含值 | 复核维持 | 类型联合 + 运行时深冻结构造；N1 哨兵断言 `JSON.stringify` 不含 payload | 兑现 |
| B-7 定位符形状 | 恰两键 `{path,key}`；`[...path,key]` 可读；同事务同 key 合并 | 复核维持 | `makeChange` 新鲜副本；N2/N3 回环断言；`Map<key>` 去重 | 兑现 |

**SA6 §12.6 实现期红线**：① 冻结面零改动（git 实证，见 §4）② 公共 API 仅经 `src/index.ts`、
值导出面不变（diff 实证）③ lease 既有 15 键全保留 + 守卫同步（四处键集守卫 +1 行）④ 槽外
分发 / throw 隔离 / 不含值（实现 + X1/N1 断言）⑤ 未为过契约修改绑定（契约三件套**零改动**——
SA4 mtime 实证 + SA3 声明 + 本轮 diff 复核三件套仅作为新文件入库）。**全部遵守**。

## 3. ADR 0030 T1 切片符合性

| ADR 条款 | 交付行为 | 裁决 |
|---|---|---|
| §1 lease 层 `watchMap → {unsubscribe}`；退订幂等零通知；载体面对齐 readMap；lease capability 释放即清理 | 逐项落盘（见 AC1/AC8）；回调位 = B-2 解释性冻结（ADR 简写省略回调位的文本缺口，SA6 §11-5 实证、SA1 冻结、SA8 两轮裁决为缺口实例化而非矛盾） | 符合 |
| §3 建立判定全由 active schema；无 schema 整体拒绝；CARRIER_MISMATCH message 区分；数据缺席合法；校验全在建立时刻 | 建立状态机六门（①lifecycle ②listener 形状 ③schema 可用 ③b ROOT 载体 ④path 快照 ⑤schema 分类 ⑥登记）全同步、顺序与设计冻结逐位一致 | 符合 |
| §4 data 恰三键 / 定位符恰两键 / 同 key 合并 / origin 两态 | 逐字段一致；`watch-end` 类型在联合内但 T1 不产出（类型先行防 T2–T5 破坏性加宽，设计 §8-A 明文）；`invalidate-all` 仅溢出分支产出 | 符合 |
| §5 宁多勿漏 | `isRealChange`：add/delete 恒真变；update 双侧 plain → 深比较（undefined 键过滤、深度上限 32）相等才过滤；任一侧 live 载体/非 plain/超深 → 保守通知；嵌套聚合「任一真变或不可判」 | 符合 |
| §6 槽外异步分发；回调 throw 隔离；有界队列溢出 → invalidate-all（数值不进契约） | 泵镜像 fanout 同常数同泵形；容量收 `createWatchHub` 单参数位（默认 16，T4 注入纯加法预留）；溢出清队 + 单条 invalidate-all（origin = 触发事务分类）——实现之、无验收断言（T4 #390 既有分期） | 符合 |
| §7 runtime 簿记/判定/分发；registry lease 面 + 别名 + 透传；通知不出进程、复制协议零改动 | 分层逐字一致；ws-replication 仅 `src/testing.ts` 装饰器恰一行透传（testing surface，不进生产 API）；wire/协议/持久化零 diff | 符合 |

**非目标边界（issue/SA6/设计三处一致）**：谓词 `where` 与 `WATCH_MAP_OPTIONS_INVALID` 未注册
（errors.ts diff 实证仅两码）；`'replication'` 验收断言编排与 `watch-end` 编排（T3 #389）；
溢出注入与父路径删除编排（T4 #390）；文档面（T5 #391，docs/CONTEXT 零 diff）；watchArray /
含值通知 / 序号对账（v2）。**零越界、零提前实现**。

## 4. 冻结面与影响面核验（本轮 git 实证）

- **零 diff 面**：`docs/**`、`CONTEXT.md`、`vitest.config.ts`、`package.json`、runtime
  `write/sequencer/window-read/read-schema-projection/replication-session/schema-rearm`、
  registry `registry.ts/observer.ts`、`packages/replication-protocol`、`packages/persistence`、
  `packages/ws-replication/src/index.ts` —— `git diff 6df1c61..363cc47 -- <清单>` 唯一命中 =
  契约 fixture 新文件（AC9 交付物本身）。
- **键集守卫四处**：registry-open lease 16 键（含 `'watchMap'` 行 + 注释）、internal-seam /
  phase5-reset-fence-r2 / close-lifecycle runtime 15 键三处（close-lifecycle 负向事件订阅词
  审计 L177–182 原样未动、`watchMap` 未入词表——ADR 0008 窄读 + ADR 0030 后法授权裁决维持）。
- **结构实现点十处**：五 class 桩（+`NamespaceRuntimeWatchMapHandle` import）+ ⑧ registry-open
  `makeRuntime` + ⑨ issue-369 `makeStubRuntime`（断言 diff = 0，33/33 保持负控）+ ⑥⑦ 字面量
  桩一行 + ⑩ ws-replication `decorateLease` 恰一行 `.bind(lease)` 诚实透传——与 D9(a)/(b)
  冻结形态逐字一致；编译器双门禁 exit 0 仲裁清单完备。
- **类型面**：`resolveCarrierKind` 引用的 `normalizeReadPath`（read-schema-projection.ts
  L237）/ `isPlainRecord`（plain-data.ts L56）/ p0 `lifecycle`/`schemaState` 收窄全部在场；
  `RuntimeReadDisabledError('watchMap', lifecycle)` 在 `!== 'ready'` 窄化块内类型闭合。

## 5. 证据链（红 → 绿；SA3/SA7 落盘日志 tail 复核）

| 证据 | 记录值 | 复核 |
|---|---|---|
| 实现前红灯基线 | tracer-red **20 failed / 1 passed**（唯一绿 = NC1），exit 1（`sa3-issue387-red-baseline.log`） | tail 一致 |
| 门禁① 测试树 tsc | `npx tsc -p tsconfig.typecheck.json --noEmit` **exit 0** 零输出（`-retry-gate1-test-tsc.log`） | EXIT MARKER exit=0 |
| 门禁② 根全量 | `pnpm test`：**Test Files 394 passed (394) / Tests 4753 passed (4753) / Type Errors no errors / exit 0**（`-retry-gate2-root-test.log`） | tail + EXIT MARKER 一致 |
| 门禁③ 根 typecheck | `pnpm typecheck`（14 包 src 树）**exit 0**（`-retry-gate3-root-typecheck.log`） | EXIT MARKER exit=0 |
| 契约四件套 | tracer-red 21/21 + lease-surface test-d 2/2 + #369 负控 33/33 + P0 7/7 = **4 files / 63 tests / Type Errors no errors / exit 0**（`-retry-contract-and-negctl.log`） | tail 一致 |
| SA7 动态验证 | 16/16 探针场景 + post-removal 63/63 同值 + 保真面 110/110（`sa7-issue387-*.log`） | 报告 §9 命令表与日志互洽 |
| SA8 实现后冲突门 | verdict **clear**、`requiresConflictRecheck=false`、§8-3 清单 ①–⑪ 逐项闭合 | 报告逐条在案 |

红→绿因果链完整：同一契约字节先在 HEAD 红（能力缺席），实现后转绿，契约文件全程零改动
（两项 SA6 授权的可选收紧——E4 逐字码断言、test-d 别名 Equal 锁——**未取用**，保守侧合规）。

## 6. MINOR 观察（不阻断 approve）

1. **M-1**：E4 无 active schema 断言为「非空稳定 code + message」，未升级为逐字
   `WATCH_MAP_SCHEMA_UNAVAILABLE`（SA6 B-4 明示可选授权，未取用；码字已在源码注册并被
   SA7 探针 B3 动态实测）。
2. **M-2**：released lease 调 `watchMap` → `NamespaceLeaseReleasedError` 通道已实现
   （lease.ts 首行）但契约无阳性断言（SA4 N-1；SA7 探针 D1 动态实测 name+code）。
3. **M-3**：③b ROOT 载体门与敌意 path 两拒绝位无行为断言（设计 §12/R10 已声明非本票验收
   边界；SA7 探针 F1/B2 动态实测码 + 专属 message）。
4. **M-4**：`RuntimeReadDisabledError` message 尾注「数据投影读取」对 getter=`'watchMap'`
   语义略偏（SA4 N-2；稳定消费面 code 不受影响）。
5. **M-5**：设计文本微瑕 N-5（`optional` 透明解包未写入设计 §7-D3/§8-B⑤ 规格文本；实现侧
   `resolveCarrierKind` 已解包且 E3 绿）——属设计文档面，已登记转 SA1 文本同步。

## 7. PR 必须披露的未达成/边界项（均非本票 AC 缺口，为已裁决分期与已知边界）

- **分期义务（各有其票，本票按设计不交付）**：T2 #388 谓词 `where` 词表 + options 槽 +
  `WATCH_MAP_OPTIONS_INVALID`；T3 #389 `'replication'` 验收断言编排 + `watch-end` 终止编排
  （含 Peer re-arm）；T4 #390 队列上限 testing 工厂注入 + 溢出/父路径删除验收 + handler
  故障注入用例；T5 #391 三方文档面（含「T1 切片不建议与复制/schema 变更并存使用」消费
  指引——R9 静默窗）。
- **T1 交付态已知边界（ADR/设计明文授权）**：容器级事件（创建/删除/整替）不产出条目定位符
  （C-3；父路径删除 invalidate-all 化属 T4）；Y 载体条目整值同写不可判 → 保守通知（R3，
  宁多勿漏方向）；union 值形态容器按非键容器拒绝（R4）；空路径 `watchMap([])` 为显式承认
  的合法边界（O-3）；订阅跨无 root `replaceSchema` 存续且无信号（R9 静默窗，T3 交付
  watch-end 后闭合）。
- **机制在产但无验收断言**：复制 apply 触及订阅容器会产出 `origin:'replication'` 的 data
  通知（D8 无过滤，SA7 探针 E1 动态实测 `["local","replication"]`）；溢出降级
  `invalidate-all`（SA7 探针 G1 三次复跑同值）。两者分别为 T3/T4 的验收对象。

## 8. Verdict

**approve** —— 交付忠实满足 issue #387 正文（What-to-build + 演示场景 + AC1–AC10）、
SA6 验收契约（B-1–B-7 全兑现、§12.6 红线全遵守、契约三件套零改动红转绿）与 ADR 0030
T1 切片；无遗漏、无部分实现、无错误实现、无 scope creep；非目标零越界、冻结面零 diff、
门禁与动态证据链完整自洽。仅存 5 条 MINOR 观察（可选收紧未取用 / 非目标边界无断言 /
文案微瑕 / 设计文本同步）与已裁决的 T2–T5 分期披露项，均不阻断。
