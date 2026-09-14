# SA8 实现后冲突复查 — issue #387：watchMap 无谓词形态垂直通路（变更订阅 T1 / tracer bullet）

- 复审对象：**implementation**（branch `mabf/issue-387`，HEAD `6df1c61`，实现未提交；工作树实读
  = 19 处已跟踪文件修改 + 4 个新源/契约文件；对照基准 = 设计 iteration 2（649 行，被执行的冻结设计））
- 复审轮：2026-09-14（implementation 复查 iteration 1；dispatch `sa-59b804da-acc4-4b52-80d1-32885553599b`；
  本报告为 issue #387 首份 implementation 冲突报告——原位新建，不堆叠历史 iteration）
- 触发依据：SA8 设计后复审（iteration 2，verdict **clear**、`requiresConflictRecheck=true`）§8-3
  实现后复查清单 ①–⑪ + SA3 实现报告（iteration 1 重试轮）§Verification 的证据对账请求
  （「清单闭合裁决属 SA8」——本报告即该裁决）；SA3 复核的 SA2 评审（iteration 2，approve）在场。
- 结论速览：**verdict = clear**；25 项对照 = 12 × implements-existing-decision + 13 × no-conflict；
  0 hard-conflict；0 override；0 未规划的 evolution-required；
  **§8-3 清单 ①–⑪ 逐项闭合**（⑨⑩ 两行 ALLOW 改判项已按逐行冻结形态落盘并核验）；
  **requiresConflictRecheck = false**（设计复审布防的四类触发条件——公共 API 增长 / 失败语义 /
  生命周期钩子 / 正式范围改判——均已实现核对闭合）

---

## 1. Reviewed subject

**implementation**。被审对象 = 工作树当前 diff（相对 HEAD `6df1c61`）：

- 新增：`packages/namespace-runtime/src/watch-map.ts`（488 行，runtime 侧唯一实现载体）+ SA6 契约三件套
  （fixture / tracer-red / lease-surface `test-d`，SA3 零改动——mtime 19:09–20:25 早于本轮编辑 22:19–23:06，实证）；
- 修改 19 处：runtime 3（runtime.ts / errors.ts / index.ts）+ registry 3（types.ts / lease.ts / index.ts）
  + ws-replication 1（src/testing.ts 恰一行）+ 测试守卫 12（四处键集 + 十处结构实现点所在文件）；
- SA3 报告（iteration 1 重试轮）声明的工作面 = iteration 0 十八处 + 本轮恰 2 文件（⑨⑩）——
  经 `git status` / `git diff --numstat` 全量对账一致（⑨ = +6/−1，⑩ = +1/−0）。

SA8 纪律声明：本门只读裁决，未运行任何测试/门禁命令；门禁证据取自 SA3 artifact 日志
（`artifacts/sa3-issue387-retry-gate{1,2,3}-*.log`、`-retry-contract-and-negctl.log`），代码事实全部经本轮独立实读。

## 2. Inputs and decision set

| 输入 | 状态 | 用途 |
|---|---|---|
| `docs/adr/0030-change-subscription.md` | **规范权威**（已接受，工作树相对 HEAD 零 diff） | §1/§3/§4/§5/§6/§7/验收节逐条款对照 |
| ADR 全集其余 27 篇 | 已接受（0007 部分取代于 0008；0016/0024 交付条款经 0027 修订——本轮复核状态行，被取代条款与本实现无接触面） | 决策集交叉面（0008 L18/L101/L131/修订节 L139、0009+#134 修订节、0010/0013/0022、0011/0014、0018、0023、0025/0026、0027、0028） |
| `CONTEXT.md` L65–67（变更订阅词条）、L69–70（ROOT：map 形规范形态，物化为 `getMap('ROOT')`） | 在场，零 diff | 术语一致性裁决（D8 全覆盖口径 / ③b 异型 = doc 数据级偏离态） |
| `wiki/raw/task_issue-387_design.md`（iteration 2，被执行的冻结设计） | 在场 | §7 冻结表（B-2/B-3/B-4/B-5/B-6/B-7、D1–D10）、§8 规格、§11 ALLOW/DENY、§12 三门禁 |
| `wiki/raw/task_issue-387_design_conflict_report.md`（SA8 iteration 2，clear） | 在场 | **§8-3 复查清单 ①–⑪ = 本报告核心裁决对象**；§5 冻结面表 |
| `wiki/raw/task_issue-387_sa3_impl.md`（iteration 1 重试轮） | 在场（evidence） | Changed paths / File scope check / V1–V7 门禁证据索引 |
| `wiki/raw/task_issue-387_sa2_review.md`（iteration 2，approve） | 在场（evidence） | Required revisions = 无；N-1 指回 SA8 §8-3 |
| `wiki/raw/task_issue-387_sa6_contract.md` | 在场（evidence，非规范） | 绑定表 B-1–B-7、非目标边界 |
| `packages/namespace-runtime/AGENTS.md`、`packages/namespace-registry/AGENTS.md`、`packages/ws-replication/AGENTS.md`（L18） | 在场 | 模块决策面（FIFO/读槽外/detached 投影/close 同步；公共 API 仅经 index；test controls 归 testing surface） |
| 工作树源码 / diff / SA3 artifact 日志 | 本轮独立实读 | §3 各行 Evidence 列 |
| issue #387 评论（Owner 要求） | REST 快照 `[]`（dispatch 确认 Owner requirements: none） | 无 owner 条款需映射 ⇒ 无 override 权威来源 |

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（implementation diff） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0030 §1（L14–18） | lease 层公共面 `watchMap → {unsubscribe}`；退订幂等、主动退订零通知；订阅是 lease capability、释放即清理 | `lease.ts` 第 16 键：released throw → `entry.runtime.watchMap` 透传 → `activeWatches` 登记 + 双幂等包装句柄（`Object.freeze({unsubscribe})`）；hub 句柄幂等（标志守卫 + 清队列 + 摘订阅，零通知） | **implements-existing-decision** | `lease.ts` watchMap 实现段（L342–361 增量）；`watch-map.ts` handle L466–475；registry-open 键集 16 键含 `'watchMap'`（L924–944 实读） | 无 |
| 2 | ADR 0030 §3（L33–39） | 建立判定全部由 active schema；无 active schema 整体拒绝；非键容器 → `WATCH_MAP_CARRIER_MISMATCH`（message 区分原因）；数据缺席合法；参数校验全在建立时刻 | 建立状态机全同步且顺序与设计 §8-B 逐位一致：①lifecycle 门（`RuntimeReadDisabledError('watchMap', lifecycle)`；`p0.ts` L53 `lifecycle: 'ready'\|'closing'\|'closed'` 收窄后类型闭合）→ ②listener 形状门（TypeError）→ ③schema 可用门（`WATCH_MAP_SCHEMA_UNAVAILABLE`，覆盖 legacy/preparing/unavailable/fatal）→ ④path 单次快照（`normalizeReadPath` null → CARRIER_MISMATCH）→ ⑤schema 分类（`resolveSchemaAtPath` 纯 schema 侧 + `resolveCarrierKind` ref 追尽/optional 透明解包，零 live 载体探测——缺席容器〔ghost/optionalTasks〕照常建立）→ ⑥登记；六个稳定 message 互可区分、零 path 回显 | **implements-existing-decision** | `watch-map.ts` L416–476 逐门实读；message 常量 L109–123（恰六位，与设计 §8-B 文案表逐字对齐）；tracer-red E3（L157–172）+ E2 绿（`-retry-contract-and-negctl.log` 21/21） | 无 |
| 3 | ADR 0030 §3 码族 + 数据缺席合法（③b 面已由设计复审 row 28 裁决为缺口实例化） | CARRIER_MISMATCH 码字 ADR 逐字；缺席合法不触碰 | ③b ROOT 载体门：`root === undefined`（构造期 `captureRootMap` 容错捕获缺席 = ROOT 同名异型载体）→ throw `WatchMapError('WATCH_MAP_CARRIER_MISMATCH', ROOT_CARRIER_MESSAGE)`；**复用既有码、不新增注册表条目**；位于 ③ 与 ④ 之间（单次构造期既定事实判定，非参数校验、非 live 探测）；缺席容器无载体不触发（⑤ 纯 schema 侧，E3 判定面零触碰） | no-conflict（实现与裁决过的设计 D10 逐条一致） | `watch-map.ts` L353–359（captureRootMap 零副作用 try/catch）+ L372 + L395（条件挂接）+ L430–434（③b throw 位）；`errors.ts` diff 无第三码；P0 7/7 绿（`-retry-contract-and-negctl.log`） | 无 |
| 4 | ADR 0030 §4（L43–53） | 三 kind 词表；data 恰三键；定位符恰两键、`[...path,key]` 可读；同事务同 key 合并；origin 两态 | 类型联合现在即冻结全词表（`watch-end` 类型在场、T1 不产出）；运行时仅构造 `data`/溢出 `invalidate-all`，均为深冻结纯数据；`collectChanges` 以 `Map<key>` 首见序去重；`makeChange` 产 `{path: 新鲜冻结副本, key}` 不含值 | **implements-existing-decision** | `watch-map.ts` L60–81（三类型）+ L262–299（collectChanges/makeChange）+ L398–413（enqueueData）；契约 N1/N3 断言（恰三键/恰两键/同 key 合并）绿 | 无 |
| 5 | ADR 0030 §5（L57–59） | 宁多勿漏：真变判定（可判定面语义比较过滤、不可判保守通知）；漏不可接受 | `isRealChange`：add/delete 恒真变；update 且新旧均 plain → `plainDataEquals` 深比较（undefined 键过滤、深度上限 32）相等才过滤；任一侧 live Y 载体/非 plain/超深 → 不可判 → 保守通知；嵌套事件「任一变更键真变或不可判」聚合到条目级（`changes.keys` 为空 → 保守通知） | **implements-existing-decision** | `watch-map.ts` L176–233（isPlainData/plainDataEquals/isRealChange）+ L252–259（嵌套聚合）；与 `mutation.ts` `logicalValuesEqual` 纪律互指注释在场（O-2 兑现） | 无 |
| 6 | ADR 0030 §6（L64–67）+ 验收节 L94 | 挂点 = 写序列器事务提交后异步分发（槽外）；全覆盖本地写/复制 apply/schema 安装；回调 throw 静默隔离；有界队列溢出 → invalidate-all（数值不进公共契约） | 构造期每 Runtime 恰一次 ROOT `observeDeep`（零订阅快路径）；handler **只入队不投递**且整体 try/catch 吞没；投递在单飞微任务泵（每项前让步 20 次微任务，镜像 fanout）——listener 调用全部移出事务栈与写序列器槽；逐 listener 逐投递 try/catch（X1）；每订阅 FIFO 有界队列，容量 = `createWatchHub` 单一构造参数位（默认 16，T4 注入纯加法），溢出清队 + 单条 `invalidate-all`（origin = 触发降级事务分类） | **implements-existing-decision**（溢出注入与验收 = T4 #390 既有分期义务，见 §6） | `watch-map.ts` L318–341（schedulePump）+ L376–392（onRootTransaction）+ L397–413（enqueueData）+ L98/L103（常量不进公共契约）；AC6/AC7 断言绿（gate② 全量 4753/4753） | 无 |
| 7 | ADR 0030 §7（L69–73） | runtime 簿记/判定/分发；registry lease 公共面 + 别名 + 透传；**通知不出进程：复制协议零改动** | runtime 新模块 `watch-map.ts` + `runtime.ts` 第 15 键透传对偶（`watchMap: (path, listener) => watchHub.watchMap(...)`）；registry `types.ts` 三单源别名 + `lease.ts` 透传 + 五条 Equal 锁（入 `LeaseTypeAssertions`）；wire/协议面零改动 | **implements-existing-decision** | runtime.ts diff（接口 JSDoc + 字面量 + `createWatchHub` 装配 + `closeAfterFence` 并置 `watchHub.shutdown()`）；lease.ts diff（Equal 锁五条逐字与设计 §8-F 一致）；`git status`：ws-replication 仅 testing.ts、replication-protocol/persistence 零 diff | 无 |
| 8 | ADR 0030 验收节（L88–97） | 主缝 = lease 公共面契约家族；先例 = #369 三件套；类型面 `*.test-d.ts` | 三件套全绿：tracer-red 21/21（含 E1–E6/N1–N4/B1/B2/P0/P2/X1/L1/L2）、lease-surface `test-d` 2/2（`--typecheck` 模式）；非目标面零越界（无 `'replication'` 断言、无 watch-end/invalidate-all 断言——契约 grep 复核） | **implements-existing-decision**（分期验收条款按 T2–T5 票交付，见 §6） | `artifacts/sa3-issue387-retry-contract-and-negctl.log`（4 files / 63 tests / Type Errors no errors / exit 0）；tracer-red 实读（L35 三 kind 闭集、L157 E3、L236 N1） | 无 |
| 9 | ADR 0008 L101 | 「v1 不提供公共事件订阅；队列进度和内部事件属于日志、metrics 与 trace」 | watchMap 通知 = 业务数据信号面（三 kind 闭集、无队列进度/内部事件夹带）；close-lifecycle 负向事件订阅词审计（L183：on/off/subscribe/unsubscribe/emit/addEventListener/removeEventListener/once）**原样未动、`watchMap` 未加入**（设计 §10 明令「不得加入」） | no-conflict（窄读 + ADR 0030 后法特定授权——设计复审 row 13 裁决维持） | close-lifecycle.test.ts diff 实读（词表零改动，仅键集 +`'watchMap'` + 注释）；`watch-map.ts` 通知构造面仅 data/invalidate-all | 无 |
| 10 | ADR 0008 + 修订节（完整槽序不变；reads 不进 sequencer） | 严格 FIFO 写序列器 / 槽序冻结 | watch 观察器事件驱动零槽位占用（handler 只入队）；投递全在槽外微任务泵；`write.ts`/`sequencer.ts`/`schema-write.ts`/`replication-write.ts` 等 DENY 清单**零 diff** | no-conflict | `git status` 对账（runtime src 仅 runtime.ts/errors.ts/index.ts/watch-map.ts）；gate② 全量绿（含 sequencer/写路径全部既有契约） | 无 |
| 11 | ADR 0008 词汇收口注册（L131） | 稳定码以 `errors.ts` append-only 注册表为准；区分域靠 message | `errors.ts` 纯追加：`WATCH_MAP_CARRIER_MISMATCH_CODE`（ADR 逐字）/ `WATCH_MAP_SCHEMA_UNAVAILABLE_CODE`（B-4）/ `WatchMapErrorCode` / `WatchMapError`（类不进 index）；既有码与既有类零改动（唯一次既有面触碰 = `RuntimeReadDisabledError` getter 词表 +`'watchMap'`——additive 联合加宽，既有调用点不受影响）；③b 无新注册表条目 | **implements-existing-decision** | errors.ts diff 实读（+36/−2：−2/+2 为 getter 注释与联合词表行，其余纯追加）；gate③ 根 typecheck exit 0（词表加宽编译期验证） | 无 |
| 12 | ADR 0008 L18「读取能力」+ 修订节 L139 + P0 冻结契约 AC5 | 「普通 open 不执行 schema、ROOT 载体或 logical validation」；P0 AC5「ROOT 载体非 Y.Map（Y.Text）仍照常 ready」 | D10 兑现：`captureRootMap` try/catch 容错捕获——异型载体捕获为 `undefined`，**构造零抛、零副作用**，不挂接 observer；`shutdown` 以 `root !== undefined` 守卫对称摘除；P0 文件 7/7 保持全绿（构造与 ROOT 载体形态解耦的运行证据） | **implements-existing-decision** | `watch-map.ts` L353–359/L395/L480；`runtime-p0-sequencer.test.ts` 零 diff（`git status` 对账）；`-retry-contract-and-negctl.log` P0 7/7 | 无 |
| 13 | ADR 0009 §NamespaceLease + #134 修订节 | lease 独立 capability；release 幂等；release 同步段清理先例；release 不追踪在途 | `activeWatches: Set<() => void>` + 双幂等包装；`doRelease` **首调同步段**清理（`releasePromise === undefined` 守卫内）：`entry.leases.delete` 之后 → 遍历退订（逐句柄 try/catch 隔离）→ `dispatchObserver('lease-released')` → `onReleased?.()`；次调直接返回同 Promise（清理恰一次） | **implements-existing-decision** | lease.ts L228–275 实读（清理块 L235–244 位于 delete〔L231〕与 dispatchObserver〔L246〕/onReleased〔L272〕之间——**清单⑥ 时序逐字成立**）；L2 断言绿（gate②） | 无 |
| 14 | ADR 0009 L95 | Registry observer seam「v1 不提供公共事件订阅」 | observer seam 零触碰（`registry.ts`/`observer.ts` 在 DENY，`git status` 零 diff）；watchMap 为 ADR 0030 背景节明文的业务信号第四面 | no-conflict | `git status` 对账；设计复审 row 17 裁决维持 | 无 |
| 15 | ADR 0023（L41） | `ctx.provide` 服务对象访问器纪律；返回值不受影响 | `registry.ts` 服务字面量零触碰；`Object.freeze({unsubscribe})` 为方法返回值（豁免条款） | no-conflict | `git status`：registry.ts 零 diff | 无 |
| 16 | ADR 0026 | `ops` 批量信封 = 单 Yjs 事务、原子可见 | 一事务一通知结构性成立（observeDeep 每事务恰一次回调 → 每订阅至多一条 data；`Map<key>` 去重） | **implements-existing-decision** | `watch-map.ts` onRootTransaction → collectChanges 单聚合；契约 B1（同事务同 key 合并）/B2（FIFO）绿 | 无 |
| 17 | ADR 0027 + 仓库守卫门 #333/#336/#364 | readData 恒四键；形状断言不内联字面量 | `read-schema-projection.ts`/`read.ts` 零 diff；通知不含值/投影文本；零 readData 形状新断言 | no-conflict | `git status` 对账；readdata-* 测试族全绿（gate②） | 无 |
| 18 | ADR 0028 + #369 契约族（负控基线，evidence） | 窗口读 API 与词表冻结；`issue-369-*.ts` 为 #369 验收负控 | `window-read.ts` 零 diff；⑨ 落盘形态 = 恰一成员 throw stub（+2 行注释）+ 1 行 section 计数注释替换（「14 键面」→「15 键面」，R5 可选项）；**断言 diff = 0**（本轮逐行审计 diff：零 expect/it/describe 触碰）；33/33 保持全绿 | no-conflict（改判 = 纯类型面成员在场性同步，设计复审 row 30 裁决维持） | issue-369 diff 实读（+6/−1 全文）；`-retry-contract-and-negctl.log` 33/33 | 无 |
| 19 | ADR 0010/0013/0022 + `docs/protocols/instance-replication-v1.md` | 复制 wire 帧/错误码/reason 冻结 | ws-replication 包改动恰 `src/testing.ts` 一行成员透传；`src/index.ts` 零 diff（grep 零 testing 引用）；wire 帧/协议消息/持久化零触碰 | no-conflict | `git status` + `git diff --numstat`（testing.ts 1/0）；index.ts grep 实读 | 无 |
| 20 | ws-replication AGENTS L18 | 「Export production APIs through `src/index.ts`; keep programmable adapters and test controls in the explicit testing surface」 | ⑩ 落位 = `src/testing.ts` `decorateLease` 一行 `watchMap: lease.watchMap.bind(lease),`（D9(b) 装饰器诚实透传，与其余 15 成员同款）——testing surface、不进生产 API | no-conflict | AGENTS L18 实读；testing.ts diff 恰一行；gate③ 根 typecheck exit 0（⑩ 落盘后 TS2741 消失的编译器证据） | 无 |
| 21 | registry AGENTS（「Add public APIs only through `src/index.ts`」）+ runtime 公共面纪律 | 公共 API 仅经 index；detached 投影 only | 两 index 均为 **type-only** 追加（runtime：三别名 `export type {}` 新块；registry：既有 type 块 +3 名）；值导出面不变——runtime 值导出仍恰 `RuntimeWriteFatalError` 一键（`runtime-acceptance-exports-audit.test.ts` 绿）、registry 值导出审计绿；通知为深冻结纯数据（detached） | **implements-existing-decision** | 两 index diff 实读；gate② 日志含 exports-audit 4/4 与 phase5 值导出审计断言绿 | 无 |
| 22 | runtime AGENTS（FIFO 边界 / close 同步停接纳 / detached） | close 同步收口；reads/信号在 FIFO 之外 | `closeAfterFence` 同步段 `fanout.terminateAll('runtime-close')` 旁并置 `watchHub.shutdown()`（幂等守卫；摘 observer + 清全部订阅，静默——ADR §4 终结三因不含 runtime close）；watch 观察器不进 sequencer 队列 | no-conflict | runtime.ts diff（closeAfterFence 块）；close-lifecycle / phase5 / internal-seam 键集 15 键三处全绿（gate②） | 无 |
| 23 | CONTEXT.md L65–67「变更订阅」词条 | 挂点/三 kind/origin 两态/宁多勿漏/有界队列/数据缺席合法/消费协议 | 实现机制与词条逐项一致（含「（本地写 / 复制 apply 全覆盖）」——⑤ 无过滤，见清单行）；词条签名简写 `watchMap(path, { where? })` 的回调位对账 = **既有登记的 T2/T5 义务**（设计复审 Required action 5），非本票义务 | no-conflict | CONTEXT 实读（零 diff）；`classifyOrigin` L305–308 无过滤分支 | 无 |
| 24 | 设计 §11 ALLOW/DENY + 同路径重叠优先序（执行面核对） | 逐行冻结改动形态；DENY 覆盖域零触碰 | 全部 19 处已跟踪修改 + 4 新文件均在 ALLOW 行内；⑨ = 恰一 stub 成员 + 注释 + 计数注释（取用 R5 可选项）；⑩ = 恰一行透传；未取用两项可选授权（E4 逐字码 / B-5 别名锁追加）——契约文件零改动（保守侧）；DENY 域（write/sequencer/replication-session/window-read/read-schema-projection/registry.ts/observer.ts/docs/CONTEXT/vitest.config/package.json/`issue-387-watch-map-fixture.ts`）**零 diff** | no-conflict | `git status` 全量对账；⑨⑩ diff 逐行实读；SA3 File scope check 表与本轮独立对账一致 | 无 |
| 25 | issue #387 AC1–AC10 | 任务简报验收条款（含 AC10「纯加法 + 既有面零改动」） | AC1–AC9 机制落点 + 契约绿（21/21）；AC10：lease 15→16 / runtime 14→15 纯加法（既有键语义零改动——diff 仅加键，四处键集守卫 +1 行）；readData/窗口读/复制面零改动实证 | no-conflict | AC↔设计 §12 映射经设计复审 row 25 裁决；本轮以 diff + gate 日志复核实现面 | 无 |

裁决分布：**implements-existing-decision × 12**（行 1/2/4/5/6/7/8/11/12/13/16/21）、
**no-conflict × 13**（行 3/9/10/14/15/17/18/19/20/22/23/24/25）。
每项均引用决策路径与具体条款；无一项以「符合 ADR」了结。

### §8-3 实现后复查清单（①–⑪）逐项裁决

| # | 清单项 | 本轮独立核验 | 裁决 |
|---|---|---|---|
| ① | lease 恰 16 键 / runtime 恰 15 键且既有键语义零改动；`Object.keys` 审计四处 | registry-open L924–944（16 键实读）；close-lifecycle L160–180 / phase5 / internal-seam（15 键实读，三处清单一致）；diff = 纯加行（既有键零触碰）；四处守卫文件在 gate② 全量内绿 | **闭合** |
| ② | 十处结构实现点补齐后门禁① tsc exit 0 与根 typecheck exit 0 | 十处全在 diff（①–⑤ class 桩 + ⑥⑦ 字面量桩 + ⑧ registry-open makeRuntime + ⑨ issue-369 makeStubRuntime + ⑩ ws-replication decorateLease，形态与 D9(a)/(b) 逐字一致）；`-retry-gate1-test-tsc.log` exit 0 零输出、`-retry-gate3-root-typecheck.log` exit 0（14 包含 ws-replication src/**） | **闭合** |
| ③ | `WATCH_MAP_*` 两码 append-only、无既有码改动、③b 无新注册表条目 | errors.ts diff 纯追加段（变更订阅域注释 + 两常量 + 错误类型 + 类）；既有码/类零改动（唯一触碰 = getter 词表 additive 加宽，非码注册）；③b throw 复用 `WATCH_MAP_CARRIER_MISMATCH_CODE` | **闭合** |
| ④ | 通知面恒三 kind 闭集、无队列进度/内部事件夹带、不含值 | 类型联合闭集；运行时仅构造 `data`/`invalidate-all`（深冻结、定位符无值键）；契约 E6（kind 闭集）/N1（恰三键、不含值哨兵）绿 | **闭合** |
| ⑤ | D8 无过滤行为：实现不得引入任何 origin 过滤面 | `classifyOrigin`（null→'local'、symbol→'replication'、其余→'local' 两态收敛）+ `onRootTransaction` 对一切事务推导——**全代码零过滤分支**；`'replication'` 断言编排按已裁决分期属 T3 #389（机制在产） | **闭合**（行为断言面 = T3 既登记义务） |
| ⑥ | doRelease 清理时序（`entry.leases.delete` 后、`onReleased` 前） | lease.ts 实读：L231 delete → L235–244 清理（隔离 try/catch）→ L246 dispatchObserver → L272 `onReleased?.()`；首调同步段守卫（`releasePromise === undefined`）保证恰一次 | **闭合** |
| ⑦ | 观察器零 throw（DOCRT-E203 红线） | `onRootTransaction` 整体 try/catch 吞没（含零订阅快路径在内的一切路径）；泵 async 体另有最外层兜底 try/catch + finally 复位单飞守卫 | **闭合** |
| ⑧ | released lease → `NamespaceLeaseReleasedError` | lease.ts watchMap 首行 `if (released) throw new NamespaceLeaseReleasedError();`（getter 域通道先例同款）；契约绿 | **闭合** |
| ⑨ | 两 index type-only 追加、值导出面不变 | 两 index diff 均仅 type 面；exports-audit（runtime 一键）与 registry 值导出审计在 gate② 绿 | **闭合** |
| ⑩ | ③b 分界行为：map 形 ROOT 下缺席容器建立成功（E3）+ P0 7/7 保持全绿 | E3 在 tracer-red（ghost/optionalTasks 双例，21/21 内绿）；P0 文件零 diff 且 7/7 绿（`-retry-contract-and-negctl.log`）；③b 仅 `root === undefined` 触发、⑤ 纯 schema 侧——分界与 D3/D10 一致 | **闭合** |
| ⑪ | 负控不变式：issue-369 33/33 且断言 diff = 0；ws-replication 导出面/wire 帧 diff = 0（⑩ 仅一行成员） | issue-369 diff 逐行审计 = 注释 + 恰一 stub 成员，零断言触碰；33/33 绿；ws-replication 包内改动恰 testing.ts 一行、index.ts 零 diff、wire 帧零 diff | **闭合** |

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| —（无） | — | — | — |

无任何 override 被使用或被需要：issue #387 评论 = 0（Owner requirements: none）；无新 ADR 修订/废弃；
无协议版本升级。设计 §11 的 ⑨⑩ 两处范围改判对象是设计自身的范围冻结文件（iteration 2 已裁决为
非规范面改判），其落盘形态（恰一行 stub / 恰一行透传）经本轮逐行核验与冻结形态逐字一致——
改判未扩大（DENY 对两路径其余覆盖域零触碰）。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（工作树实读） |
|---|---|---|---|
| readData 交付形状 | 恒四键 `{ok,value,schema,truncated}` | ADR 0027；守卫门 #333/#336/#364 | **保持**（read-schema-projection.ts / read 路径零 diff；通知不含值/投影文本） |
| 窗口读 API 与词表 | `readArray`/`readMap`、`WINDOW_*` 三码、条目身份 | ADR 0028；CONTEXT L62 | **保持**（window-read.ts 零 diff；⑨ 断言 diff = 0） |
| #369 负控契约断言 | `issue-369-*.ts` 断言与被测行为零改动（33/33） | 设计 §11 DENY 改判行不变量 | **保持**（逐行 diff = 注释 + 一 stub 成员；33/33 绿） |
| 复制 wire / 协议 / 持久化与 ws-replication 导出面 | instance-replication-v1 帧/错误码/reason；`src/index.ts` 导出面 | ADR 0010/0013/0022；ADR 0030 §7 L73 | **保持**（testing.ts 恰一行、index.ts 零 diff、replication-protocol/persistence 零 diff） |
| 诊断变更日志 | emission/record schema/retention/槽外纪律 | ADR 0011/0014 | **保持**（diagnostic 路径零 diff；纪律仅被镜像） |
| 持久化格式 | snapshot docstore 语义 | ADR 0006 | **保持**（持久化包零 diff） |
| lease 既有 15 键 / runtime 既有 14 键语义 | released/角色通道、幂等、FIFO、槽序 | ADR 0008/0009 + 修订节 | **保持**（纯加法第 16/15 键；守卫 +1 行；十实现点补最小成员〔替身恒 throw / 装饰器透传〕——零行为面） |
| P0 构造契约（AC5） | 构造/ready 不依赖 ROOT 载体形态 | ADR 0008 L18/L139；runtime-p0-sequencer L148 | **保持**（captureRootMap 容错捕获构造零抛零副作用；P0 7/7 绿） |
| close-lifecycle 负向事件订阅词审计 | on/off/subscribe/… 词表不含 `watchMap` | ADR 0008 L101 窄读（行 9） | **保持**（L183 词表原样未动） |
| Registry `ctx.provide` 服务构造 | 访问器属性纪律 | ADR 0023 | **保持**（registry.ts 零 diff） |
| 稳定码注册表 | errors.ts append-only、既有码零改动 | ADR 0008 L131 | **保持**（纯追加两码 + WatchMapError；getter 词表 additive；③b 无新条目） |
| mutation 信封语义 | 单/批两形态、guard 组合 | ADR 0025/0026 | **保持**（watch 只观察不介入写路径；写路径零 diff） |

## 6. Evolution requirements

**无新增 evolution-required 项**：实现未改变任何已决定契约——全部改动为 ADR 0030 既定条款的
兑现（12 × implements-existing-decision）或在已裁决边界内的实例化（13 × no-conflict）；
无需随本变更集修订任何 ADR/CONTEXT/协议文档。

分期兑现义务（**既有决策的实现分期**，各有其票，沿设计复审 §6 登记防丢失——非 evolution）：

| 义务 | 权威条款 | 承接票 | 本实现预留 |
|---|---|---|---|
| 谓词 `where` 词表 + `WATCH_MAP_OPTIONS_INVALID` + options 槽（含 CONTEXT/ADR §1 签名简写回调位对账） | ADR 0030 §2/§3 | T2 #388 | B-2 第三参加宽路径；码族前缀已立 |
| `'replication'` 断言编排（经 `openReplicationSession` 驱动）与 `watch-end` 终止编排（含 Peer re-arm，ADR 0018） | ADR 0030 §4/§6 + 验收节 | T3 #389 | D8 无过滤机制在产（⑤）；三 kind 类型冻结；⑩ 装饰器透传留好真实行为面 |
| 队列上限 testing 工厂注入 + 溢出/父路径删除验收（含 handler 注入 throw 红线用例，R1/O-5） | ADR 0030 §6 + 验收节 L94；spec US21 | T4 #390 | `createWatchHub` 单参数位（默认 16）+ invalidate-all 语义在产 |
| 三方文档面（含 R9 消费指引） | ADR 0030 验收节「文档缝」 | T5 #391 | 本票零文档改动（docs/** 零 diff） |
| 设计文本微瑕 N-5（`optional` 透明解包未写入 §7-D3/§8-B⑤ 规格文本） | 设计文档面（非规范） | SA1 后续文本同步 | 实现侧 `resolveCarrierKind` 已做解包且 E3 正例绿（分属两轮已登记） |

## 7. Hard conflicts

**无。** 实现对 ADR 0030 为忠实交付（T1 切片），对交叉决策集（ADR 0008/0009/0010/0013/0018/0022/
0023/0025/0026/0027/0028、CONTEXT L65–70、三包 AGENTS、spec #385、issue AC、T2–T5 票面）无任何
不兼容点：

- **公共面增长**：纯加法第 16/15 键 + type-only 两 index，四处键集守卫与十处结构实现点全部同步
  （编译器双门禁 exit 0 = 同步完备性的仲裁证据）；
- **⑨⑩ 范围改判落盘**：与 iteration 2 冻结的逐行形态逐字一致，两条不变式（断言 diff = 0 /
  导出面零 diff）实测成立，负控基线与 wire 冻结面未受削弱；
- **③b 新失败语义分支**：复用既有码、专属 message 可区分，与「数据缺席合法」（E3 绿）和 P0
  构造契约（7/7 绿）的双分界经代码与运行证据双重确认；
- **D8 origin 产出语义**：零过滤分支（代码级确认），与 ADR §5/§6 及 CONTEXT 词条「（本地写 /
  复制 apply 全覆盖）」一致，`'replication'` 行为断言按已裁决分期留给 T3 #389；
- **生命周期钩子**：lease release 同步段清理时序与 runtime close 同步段 hub 关停均按设计落位。

## 8. Required actions

1. ~~⑨⑩ 两行落盘~~——**已闭合**（本轮逐行核验；三门禁证据 `artifacts/sa3-issue387-retry-gate{1,2,3}-*.log`
   全 exit 0）。
2. ~~实现期红线执行~~——**已闭合**（DENY 域零 diff 对账）。
3. ~~实现后冲突复查清单 ①–⑪~~——**已闭合**（本报告 §3 逐项裁决表）。
4. **T4 义务登记（沿袭，未闭合）**：#390 必须交付队列上限 testing 工厂注入与溢出验收断言
   （ADR §6 + 验收节 + spec US21）——否则变更订阅 phase 关账时该条款悬空。
5. **T2/T5 对账义务（沿袭，未闭合）**：#388 落 options 槽时（或 #391 文档面）补 ADR 0030 §1 与
   CONTEXT「变更订阅」词条签名简写的回调位，保持规范文本与 B-2 冻结绑定一致。
6. **后续精化过评审（沿袭，未闭合）**：R3（Y 载体条目精确双投影比较）与 R4（union 值形态容器
   接纳）属词表/判定演进面，须过设计评审后方可实施；N-5 设计文本同步归 SA1。
7. **实现收尾（非本门职责，移交总控）**：实现未提交（无 `git add`/commit/push）；SA4 实现质量
   复核与 SA7 最终动态验证不在 SA8 职责内，按流程由总控调度。

## 9. Verdict

**clear** —— 实现是 ADR 0030（T1 tracer bullet）的忠实交付，且设计复审布防的全部复查触发面
经本轮逐项核验闭合：

- **门禁证据链完整自洽**：三门禁（测试树 tsc / 根 typecheck / 根 `pnpm test` 394 files ·
  4753 tests · Type Errors 0）+ 契约四文件（tracer-red 21/21、lease-surface `test-d` 2/2、
  #369 负控 33/33、P0 7/7）全绿，且与工作树 mtime 序（契约三件套 19:09–20:25 早于本轮
  22:19–23:06 编辑） mutually consistent；
- **清单 ①–⑪ 闭合**：键集 16/15、十实现点、码注册 append-only、三 kind 闭集、D8 无过滤、
  doRelease 时序、观察器零 throw、released 通道、type-only 导出、③b 分界、负控双不变式——
  每项均经本轮代码实读独立确认（不依赖 SA3 陈述）；
- **§11 ALLOW/DENY 零越界**：19 修改 + 4 新文件全在 ALLOW；⑨⑩ 与冻结形态逐字一致且未扩大；
  DENY 覆盖域零触碰；
- **决策集零冲突**：25 项对照全部 no-conflict / implements-existing-decision，无 override、
  无 hard-conflict、无缺失的修订计划；分期义务（T2/T3/T4/T5 + N-5）全部有承接位并沿袭登记。

## 10. requiresConflictRecheck

**false**。设计复审（iteration 2）标 true 的四类触发条件——公共 API 增长（lease 16 / runtime 15
+ 两 index）、失败语义（两新码 + `WatchMapError` throw + ③b 分支）、生命周期钩子（release 清理 /
close 关停）、正式范围改判（⑨⑩ 落盘形态）——**均已完成实现核对并闭合**（§3 清单表 + §5 冻结面
表）。剩余事项均为已登记的后续票义务（T2 #388 / T3 #389 / T4 #390 / T5 #391 / N-5 文本同步），
其各自的实现届时自当触发其票的门禁与冲突检查，不在本票保持悬挂。
