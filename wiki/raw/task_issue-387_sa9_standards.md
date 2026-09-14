# SA9 标准符合性审查 — issue #387：watchMap 无谓词形态垂直通路（变更订阅 T1 / tracer bullet）

- 被审对象：**committed final delivery** `363cc476557fd4a55ee0cded08bc7a478f345719`
  （`feat(registry): add watchMap subscriptions`）；基准 = PR #386 base `6df1c6129ede…`
  （`docs(adr): 0030 变更订阅`，dispatch 确认稳定）。
- 审查轮：iteration 0（dispatch `sa-7104e069-79fe-4874-afc1-9f8c72177693`）。
- 职责边界：只判**当前实现**是否符合仓库 AGENTS / ADR / 模块责任 / 既有架构惯例 /
  单一事实源 / 生命周期对称性 / 文件范围 / 测试质量标准；不审查需求完整性（SA10），
  不修改代码、不运行测试、不调度其他 SA。
- 方法：对交付 commit 与 base 的全量 diff 逐文件实读（23 个代码/测试文件 +
  8 个 wiki 产物 = 31 文件，4288+/6−），与 SA3/SA4/SA7/SA8 报告的「19 处已跟踪修改
  + 4 新文件 + wiki 产物」清单逐字对账；关键惯例点（键集守卫、值导出面、错误码注册表、
  别名 Equal 锁、泵先例、冻结面）独立 grep + 实读复核；`git diff --check` 干净（exit 0）。

---

## 1. Verdict

**approve（0 × BLOCKER，0 × MAJOR；3 × MINOR 不阻断）。**

交付是 ADR 0030 T1 切片的忠实、守纪实现：分层责任正确、公共面纯加法、错误码注册表
append-only、单一事实源保持、生命周期三条退订路径对称幂等、文件范围零越界
（ALLOW 全清单落位、DENY 域零 diff）、测试质量全符仓库纪律（三件套 + 负控 +
守卫门 + 集中化形状断言）。SA2（approve）/ SA3（三门禁全绿）/ SA4（approve）/
SA7（approve）/ SA8 设计后复审与实现后复查（均 clear，`requiresConflictRecheck=false`）
的结论经本轮独立复核**全部与盘面一致**。

## 2. Reviewed inputs

| 输入 | 状态 | 用途 |
|---|---|---|
| 交付 diff `6df1c61..363cc47`（31 文件） | 本轮逐文件实读 | 被审对象 |
| `docs/adr/0030-change-subscription.md`（零 diff） | 在场 | 规范权威 §1/§3/§4/§5/§6/§7 逐条对照 |
| 根 `AGENTS.md` + `packages/namespace-{runtime,registry}/AGENTS.md` + `packages/ws-replication/AGENTS.md` + `docs/AGENTS.md` | 在场 | 模块契约与文件纪律 |
| `wiki/raw/task_issue-387_design.md`（SA1 iteration 2，649 行） | 在场 | ALLOW/DENY、冻结表 B-2–B-7/D1–D10、R5 计数措辞登记 |
| `wiki/raw/task_issue-387_sa2_review.md`（approve）/ `_sa3_impl.md`（三门禁全绿）/ `_sa4_review.md`（approve）/ `_sa7_report.md`（approve）/ `_sa6_contract.md` / `_design_conflict_report.md`（clear）/ `_implementation_conflict_report.md`（clear） | 在场 | 上游审查结论与证据索引（本轮只做一致性复核，不复跑） |
| issue #387 正文（AC1–AC10）+ 评论 REST `[]` | 在场 | Owner 要求 = 无 |
| ADR 0008/0009/0023/0025/0026/0027/0028 交叉决策面 | 在场 | 稳定码注册表 / lease 生命周期 / 访问器纪律 / 信封原子 / readData 形状 / 窗口读冻结面 |

## 3. AGENTS.md 符合性

| 模块条款 | 实现落点 | 裁决 |
|---|---|---|
| runtime AGENTS：严格 FIFO 唯一、reads 不进 sequencer | watch 观察器事件驱动、零槽位占用（handler 只入队）；投递全在槽外单飞微任务泵；`write.ts`/`sequencer.ts`/`schema-write.ts`/`replication-write.ts` **零 diff**（本轮对账） | 符合 |
| runtime AGENTS：公共 API 只暴露 detached 投影；owned handle/live Y.Doc/writable roots/queues/fanout host 保持 internal | 通知为深冻结纯数据（`Object.freeze` 四层：通知/changes/定位符/path——watch-map.ts L294–299/L406–410）；`createWatchHub`/`NamespaceRuntimeWatchHub` 不经 index 导出（grep 实证 index 只 type-only 转三别名） | 符合 |
| runtime AGENTS：`close()` 同步停接纳、幂等；`getStatus()` 全程可观测 | `closeAfterFence` 同步段 `watchHub.shutdown()`（幂等 `shutdownDone` 守卫）与 `fanout.terminateAll` 并置（runtime.ts L628–636）；停接纳经 `RuntimeReadDisabledError('watchMap')`；`getStatus` 零触碰 | 符合 |
| registry AGENTS：lease 为独立调用方 capability；release 幂等 | 每 lease `activeWatches` 登记 + `doRelease` **首调同步段**清理（`entry.leases.delete` 后、`dispatchObserver`/`onReleased` 前，逐句柄 try/catch 隔离——lease.ts L232–246）；清理恰一次（`releasePromise === undefined` 守卫） | 符合 |
| registry AGENTS：公共 API 仅经 `src/index.ts` | 三别名进既有 `export type` 块；值导出面不变 | 符合 |
| ws-replication AGENTS L18：test controls 归 explicit testing surface | `src/testing.ts` `decorateLease` 恰一行 `.bind(lease)` 透传（与其余 15 成员同款）；不进 `src/index.ts`（文件头自证 + grep 零引用） | 符合 |
| docs AGENTS：docs/adr 为规范、wiki/raw 为 evidence；代码行为变更须同步规范文档 | ADR 0030 已在 base 在场且本交付**零 docs diff**——规范先行的正确形态（文档面 T5 #391 既有分期，非缺口） | 符合 |

## 4. ADR 符合性

| ADR 条款 | 实现 | 裁决 |
|---|---|---|
| ADR 0030 §1 lease 公共面 `watchMap → {unsubscribe}`、退订幂等零通知、lease capability 释放即清理 | lease 第 16 键（types.ts L740–753 + lease.ts L342–362）；句柄恰 `{unsubscribe}` 双幂等包装；释放同步段全清 | 符合 |
| ADR 0030 §3 建立判定全由 active schema；无 schema 整体拒绝；`WATCH_MAP_CARRIER_MISMATCH`（message 区分）；数据缺席合法；参数校验全在建立时刻 | 六门同步状态机（watch-map.ts L416–454）：①lifecycle ②listener 形状 ③schema 可用（`WATCH_MAP_SCHEMA_UNAVAILABLE`）③b ROOT 载体 ④path 快照（`normalizeReadPath` 复用）⑤schema 分类（`resolveSchemaAtPath` + ref/optional 追尽，**零 live 探测**）；六 message 互异、零 path 回显（L109–123） | 符合 |
| ADR 0030 §4 三 kind 词表；data 恰三键；定位符恰两键、`[...path,key]` 可读；同事务同 key 合并；origin 两态 | 类型联合现在即冻结全词表（L60–67）；`collectChanges` `Map<key>` 首见序去重（L262–290）；`makeChange` 新鲜冻结副本不含值；`classifyOrigin` 两态收敛（L305–308） | 符合 |
| ADR 0030 §5 宁多勿漏（可判精确过滤、不可判保守通知） | `isRealChange`：add/delete 恒真变；双侧 plain 深比较（undefined 键过滤、深度上限 32）相等才过滤；任一侧 live 载体/非 plain/超深 → 保守通知；嵌套事件聚合到条目级（L176–259） | 符合 |
| ADR 0030 §6 槽外异步分发全覆盖三来源；回调 throw 静默隔离；有界队列溢出 → invalidate-all；数值不进公共契约 | 构造期每 Runtime 恰一次 ROOT `observeDeep`（D8 无过滤——复制 apply 结构性直达）；handler 整体 try/catch 吞没（DOCRT-E203 红线）；泵逐 listener 隔离；容量收 `createWatchHub` 单参数位默认 16（L98/L368，T4 注入纯加法） | 符合 |
| ADR 0030 §7 分层：runtime 簿记/判定/分发；registry lease 公共面 + 别名 + 透传；复制协议零改动 | runtime 新模块 watch-map.ts（488 行唯一实现载体）+ 第 15 键同名透传对偶；registry 三单源别名 + 五 Equal 锁；ws-replication/replication-protocol/persistence **零 wire diff** | 符合 |
| ADR 0008 L131 词汇收口：稳定码 `errors.ts` append-only 注册表、区分域靠 message | 纯追加两常量 + `WatchMapError` 类（不进 index）；既有码/类零改动；③b 复用 `WATCH_MAP_CARRIER_MISMATCH` 不新增条目；唯一既有面触碰 = getter 词表 `+'watchMap'`（additive 联合加宽，既有调用点类型不变） | 符合 |
| ADR 0008 L18/L139 + P0 AC5（构造与 ROOT 载体形态解耦） | `captureRootMap` try/catch 容错捕获——异型 ROOT 捕获为 undefined，构造零抛零副作用、不挂接 observer；`shutdown` 以 `root !== undefined` 守卫对称摘除；建立场 ③b 响亮拒绝而非静默死订阅；P0 契约文件零 diff | 符合 |
| ADR 0008 L101（v1 无公共事件订阅） | close-lifecycle 负向事件订阅词审计**原样未动**、`watchMap` 未入词表（本轮实读 L177–183）；通知面恒三 kind 闭集、无队列进度/内部事件夹带 | 符合 |
| ADR 0009 lease release 幂等 / 同步段清理先例 / 不追踪在途 | 见 §3 registry 行；退订清队列使在途投递于下一让步点停止（不追踪在途语义一致） | 符合 |
| ADR 0023 `ctx.provide` 访问器纪律 | `registry.ts`/`observer.ts` 零 diff；`Object.freeze({unsubscribe})` 为方法返回值（豁免面） | 符合 |
| ADR 0025/0026 信封原子（批量 = 单事务） | 一事务一通知结构性成立（observeDeep 每事务恰一次回调 → 每订阅至多聚合一条）；无效写零事务 → 零通知（P2） | 符合 |
| ADR 0027 + 守卫门 #333/#336/#364（readData 形状断言集中化） | 读面零 diff；契约 NC1 经 `expectReadDataOkKeys` 集中化 helper（不内联四键字面量——本轮实读 tracer-red L586–590） | 符合 |
| ADR 0028 + #369 负控冻结面 | `window-read.ts` 零 diff；#369 契约文件 diff = 恰一 stub 成员 + 注释（+6/−1），**断言零触碰**（本轮逐行复核） | 符合 |

## 5. 模块责任与既有架构惯例

| 维度 | 复核 | 裁决 |
|---|---|---|
| 责任归属 | runtime（doc 生命周期 Owner）承载全部订阅簿记/判定/推导/分发/关停；lease 纯透传 + 登记 + 清理（零判定、零参数解释、零载体知识）；registry 编排零触碰；替身补成员归各测试文件自身；装饰器透传归 ws-replication testing surface | 正确 |
| 泵先例镜像 | `schedulePump` 与 `createSessionFanout` 同泵形（单飞守卫 + 自延伸链 + 每项投递前让步 20 微任务 + 逐 listener try/catch），常数同源且注释互指（R2 论证落实）；语义信号面与 session bytes 面分属两泵，非重复机制 | 符合 |
| 敌意 path 纪律 | `normalizeReadPath` 直接复用（零第二实现） | 符合 |
| schema 分类原语 | `resolveSchemaAtPath` 直接复用 + `resolveCarrierKind` 薄追尽层（ref 闭包/optional 透明解包/环与缺席 fail-closed → `'unknown'`）——消费侧职责的正确形态 | 符合 |
| #369 stub 先例 | 十处结构实现点两类形态逐字照搬：替身类（①–⑨）恒同步 throw + 注释；装饰器类（⑩）诚实透传——「替身无能力故响亮拒绝 / 装饰器下能力真实故原样转发」的语义诚实性成立 | 符合 |
| 错误面先例 | `WatchMapError` 同步 throw、类不进 index、code+message 字符串消费——沿 `RuntimeReadDisabledError`/`ReplicationSessionClosedError` 同款 | 符合 |
| 别名跟随先例 | `Namespace{Runtime,Lease}WatchMap{Notification,Change,Handle}` 命名公式沿窗口读 `ReadMap*`；lease 别名 = runtime 单源同名 + 五条 Equal 锁入 `LeaseTypeAssertions`（`_readMapAlias` 同款） | 符合 |
| 接口/字面量形态 | `readonly watchMap: (...) => ...` 声明样式与 `readArray`/`readMap` 完全一致；接口与对象字面量同位次（readMap 后）同步加键 | 符合 |

## 6. 单一事实源

| 事实 | 权威源 | 复核 |
|---|---|---|
| 通知/定位符/句柄形状 | runtime watch-map.ts 类型定义；registry 别名 = 单源 type-only 跟随 + Equal 锁编译期强制 | 无第二形状 |
| 订阅状态 | hub `subscriptions` 唯一权威；lease `activeWatches` 仅句柄登记（非订阅状态副本），清理经同一 unsubscribe 入口 | 无双事实 |
| schema 判定 | `state.activeTools.derived` 每次建立现算；无缓存、无快照陈旧面 | 符合 |
| origin 分类 | `transaction.origin` 每事务现读 | 符合 |
| 公共面形状 | 接口 + 四处键集断言（lease 16 / runtime 15，本轮实读四处清单逐字一致） | 符合 |
| 深比较纪律 | `plainDataEquals` 为 watch 面单点副本，与 doc-runtime `logicalValuesEqual` 注释互指（O-2 兑现，漂移同步义务已登记） | 受控副本（已登记的维护债，非违规） |

## 7. 生命周期对称性

| Start / acquire | Stop / release | 复核 |
|---|---|---|
| ROOT `observeDeep` 构造期恰一次挂接（root ≠ undefined 条件） | `shutdown` 守卫摘除（幂等 `shutdownDone`） | 对称；异型 ROOT 不挂接 + ③b 拒绝的降级路径对称成立 |
| `watchMap` 登记 + 冻结句柄 | 主动 `unsubscribe`（标志 + 清队 + 摘订阅，幂等零 throw）/ lease release 同步段全清 / runtime close 防御性收口 | 三条退订路径同一入口语义、全幂等、零通知回声 |
| 泵启动（单飞守卫） | 让步点重检 `unsubscribed`/空队退出；`finally` 复位守卫与 while 退出检查同一同步段（无丢失唤醒） | 对称 |
| 建立失败 | 校验全前置 → 零登记、零 observer 变更 | 无半建立态 |

## 8. 文件范围

- **交付完整性**：commit 内容 = SA4/SA7 已审工作树状态逐字一致（19 已跟踪修改 +
  4 新源/契约文件 + 8 wiki 产物；`git diff --numstat` 与 SA3 File scope 表逐行对账吻合）。
- **ALLOW 落位**：23 个代码/测试文件逐一命中设计 §11 ALLOW 行（含 ⑨⑩ 两行逐行级
  改判：⑨ issue-369 `makeStubRuntime` 恰一 stub 成员 + 注释 + 计数注释、断言零改动；
  ⑩ testing.ts 恰一行透传）；两项可选授权（E4 逐字码、B-5 别名锁追加）未取用——
  保守侧合规。
- **DENY 零 diff**（本轮对账）：runtime 写面/sequencer/window-read/read-schema-projection/
  replication-session/p0/close 等 18 文件、registry `registry.ts`/`observer.ts`/errors、
  `docs/**`、`CONTEXT.md`、`vitest.config.ts`、三包 `package.json`、replication-protocol/
  persistence、ws-replication `src/index.ts`、SA6 fixture 字节（mtime 证据链与 diff
  一致——SA3 零改动）。
- **值导出面不变**：runtime index 值导出仍恰 `RuntimeWriteFatalError` 一键（grep 实证）；
  registry 值导出审计面零改动；两 index 均 type-only 追加。
- `git diff --check` exit 0。

## 9. 测试质量标准

| 标准 | 复核 | 裁决 |
|---|---|---|
| 契约三件套（fixture + 行为 red + lease surface `test-d.ts`，#369 先例） | 三文件在场、被 runner 采集面覆盖（vitest include + tsconfig.typecheck include）；fixture 非测试文件、绑定单点 `WATCH_MAP_BINDING` 与面中性归一 `attemptEstablishWatch` 设计正确 | 符合 |
| 无弱化 | 全量 grep：零 `skip`/`only`/`todo`；无 env override；无源码字符串断言；契约文件自 SA6 落盘后零改动（红→绿非靠改断言） | 符合 |
| 异步纪律 | `expect.poll`（5ms/2s，重入 5s）+ 屏障（另一订阅/后续事务的通知）证明「零通知」，零 `setTimeout` 竞猜 | 符合 |
| 断言强度 | 成功形状逐键 `toStrictEqual`；payload 哨兵断言「信号不含值」；E4 schema-ready 同场阳性对照（反假绿）；负例 4 条 `@ts-expect-error` fail-closed | 符合 |
| 负控保持 | #369 33/33 断言 diff = 0；NC1 经集中化 helper；P0 AC5 锚文件零 diff | 符合 |
| 守卫同步 | 四处键集守卫 +1 行精确清单（16/15/15/15）；close-lifecycle 负向词表不动；两处 it 标题计数措辞同步（R5 可选项取用） | 符合 |
| 证据链 | 红基线（20 failed/1 passed + 类型红）→ 转绿（21/21 + 2/2 + 33/33 + 7/7 + 三门禁 exit 0）日志链完整且与盘面一致（SA4/SA7 已核，本轮对账文件清单与 mtime 陈述） | 符合 |

## 10. Findings（MINOR，不阻断 approve）

- **M-1（MINOR·注释计数漂移）**：`packages/namespace-runtime/src/runtime.ts` 自身注释
  仍存「十四键」陈旧计数 4 处——文件头 L2「Runtime 构造与十四键公共面」、L28
  「第十三/十四键」、L186「…= 十四键」、L642「十四键闭包对象」。设计 R5 把该漂移类
  判为低风险「可选同步」并登记了 close-lifecycle/phase5/issue-369 三处测试侧与
  `replication-session.ts`（DENY 不动），但**漏列 runtime.ts 本体**。新增 `watchMap`
  成员的接口 JSDoc 本身准确完备；漂移仅限历史计数措辞，零行为/契约影响。registry 侧
  （index.ts/lease.ts/types.ts 15→16 表述）均正确。建议下一触该文件的票顺手同步，
  不阻塞本交付。
- **M-2（MINOR·文案语义微偏，沿 SA4 N-2）**：`RuntimeReadDisabledError` message 尾注
  「close 已停止接纳公共数据投影读取」对 `getter='watchMap'` 语义略偏（订阅建立非投影
  读取；「本调用不触碰 live Y.Doc」对 watchMap 门序仍属实）。稳定消费面（code +
  getter 名 + lifecycle 三元组）不受影响。
- **M-3（MINOR·commit 规整度）**：commit header `feat(registry): add watchMap
  subscriptions`——scope 标 registry 而主实现载体在 runtime（watch-map.ts 488 行新模块
  + runtime 第 15 键）；header 未带 issue/PR 引用（仓内 `#376`/`#377` 等票有引用先例，
  亦有裸 header 先例，非强制）。不改任何代码事实。

**观察（非 finding）**：任务简报 `wiki/raw/task_issue-387.md` 与 sa3/sa6/sa7 证据日志
（`artifacts/*issue387*`）保持未跟踪——仓内既有票对此两类产物跟踪与否本就两态并存
（`task_191_dispatch.md` 跟踪、早期 issue337 日志跟踪；近期多票未跟踪），无强制惯例，
不判违规；设计/评审/契约等承重产物已全部随交付入库。

## 11. 结论

实现对仓库 AGENTS 模块契约、ADR 0030 及全部交叉 ADR 条款、分层责任、既有先例
（泵/ stub/ 别名 Equal 锁 / 错误面 / type-only 导出）、单一事实源、生命周期对称性、
ALLOW/DENY 文件范围与测试质量标准**全部符合**；三项 MINOR 均为注释/文案/规整度
级别，不触碰任何承重面。按 SA9 规则（无 BLOCKER/MAJOR ⇒ approve；MINOR 不阻断），
**verdict = approve**。
