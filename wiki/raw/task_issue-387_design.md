# SA1 设计 — issue #387：watchMap 无谓词形态垂直通路（变更订阅 T1 / tracer bullet）

- 任务类型：**Feature**（能力缺口；垂直通路从未交付——SA6 契约 §8「最深根因」已证）
- 需求源（优先级序）：issue #387 正文（What-to-build + AC1–AC10）→ ADR 0030（规范权威，
  HEAD `6df1c61`）→ spec #385 → SA6 契约 `wiki/raw/task_issue-387_sa6_contract.md`（§12 绑定表）
- 本设计的**第一职责**：按 dispatch 冻结 SA6 遗留的 **B-2 / B-3 / B-4 / B-5** 四项绑定
  （§7 冻结表），并给出可直接实现的设计（§8–§10）
- Worktree：`/home/wangjian/nomicore-fix-issue-387`（branch `mabf/issue-387`，HEAD `6df1c61`；
  **SA3 iteration 0 实现已落盘未提交**——本修订版全文与该实现语义一致，§14 记录对账）
- **修订轮：iteration 2（2026-09-14）**——落实 SA3 实现报告（`_sa3_impl.md`，verdict
  **reject：范围不足**）的 **B-1**（F-1 影响面清单遗漏 3 处 `NamespaceRuntime`/`NamespaceLease`
  结构实现点：① registry-open `makeRuntime`〔路径已在 ALLOW，实现轮已修〕、② issue-369 契约
  `makeStubRuntime`〔原 DENY 明文、需改判〕、③ ws-replication `decorateLease`〔原 ALLOW 外〕）
  与 **B-2**（§2.14「lease 侧无第二实现点」、§10「#369 契约族零改动」两处事实陈述被实现否决），
  并把实现轮 A-1 缺陷修复（**ROOT 载体门 ③b**）吸收为设计内容（§7-D10、§8-B/§8-G）；
  门禁计数与 ALLOW/DENY 面同步更新（§11/§12）。修订映射见 §14。
- iteration 1 修订（SA2 评审 F-1/F-2 两 MAJOR）已并入正文；SA2 复审 verdict **approve**
  （0 BLOCKER/MAJOR，Required revisions = 无）。
- 上游输入在场性：SA6 契约在场；SA2 评审（approve）在场；SA3 实现报告（iteration 0，
  reject：范围不足）在场——本轮修订依据；SA8 **设计后**冲突复审在场
  （`wiki/raw/task_issue-387_design_conflict_report.md`，verdict clear、
  `requiresConflictRecheck=true`——其 §8-1/§8-4 清单按 iteration 1 文本写就，本轮计数修订后
  须按 §2.12/§2.13 修订清单对账执行，见 §6/§15）；SA8 **前置**决策摘录/冲突报告
  （`task_issue-387_relevant_decisions.md`、`_conflict_report.md`）仍缺席 → 前置约束面以
  ADR 0030 + 两包 AGENTS.md + 仓内先例替代（§6），缺口由 SA8 设计后复审 + 设计后冲突复查闭合。

---

## 1. 任务模型：目标与非目标

### 目标（本票交付的垂直切片）

1. **lease 公共面**：`NamespaceLease.watchMap(path, listener) → { unsubscribe }`（B-1/B-2
   冻结形态；registry lease 15 → 16 键，纯加法）。
2. **runtime 公共面**：`NamespaceRuntime.watchMap`（14 → 15 键；ADR 0030 §7「registry 透传」
   的前提面——与 readData/readMap 同款同名透传对偶，非 internal seam；理由与备选见 §7-D5）。
3. **runtime 订阅簿记 + 建立判定（含 ③b ROOT 载体门，§7-D10）+ 事务级信号推导 + 槽外异步
   分发**（新模块 `packages/namespace-runtime/src/watch-map.ts`）。
4. **lease 生命周期登记**：release 同步段自动退订全部该 lease 的订阅（AC8/L2）。
5. **稳定码与类型别名**：`WATCH_MAP_SCHEMA_UNAVAILABLE`（B-4 冻结）+ `WatchMapError`
   （B-3 冻结：同步 throw）+ `Namespace{Runtime,Lease}WatchMap{Notification,Change,Handle}`
   三别名对（B-5 冻结）。
6. **契约转绿 + 影响面守卫同步**：SA6 落盘的三件套（fixture / 行为 red / lease surface
   `*.test-d.ts`）由 20+1 红转绿；**F-1 全清单**同步——键集守卫四处（lease 15→16 一处、
   runtime 14→15 三处）+ `NamespaceRuntime`/`NamespaceLease` **结构实现点十处**补最小
   `watchMap` 成员（七桩 + registry-open `makeRuntime` + issue-369 `makeStubRuntime` +
   ws-replication `decorateLease`；§2.12/§2.13/§2.14、§11）——十处缺任一即设计自身门禁
   ①③ 结构性红（iteration 2 修订核心，SA3 B-1）。

### 非目标（SA6 §12.1 非目标逐条承接，不得越界）

- 谓词 `where` 词表与 `WATCH_MAP_OPTIONS_INVALID`（T2 #388；本票**不注册该码**、不收
  options 参数——见 §7-B2 的 T2 加宽路径）。
- **复制来源的验收覆盖与 `watch-end` 终止编排**（T3 #389）。**F-2 修订（择读法 A）**：本票
  **不做 origin 过滤**——hub 对一切触及订阅容器的事务推导通知（ADR 0030 §6「挂点……全覆盖
  本地受控写、复制 apply、schema 安装三种来源」；ROOT `observeDeep` 构造期单挂点下，复制 apply
  经 `Y.applyUpdate(doc, bytes, applyOrigin)` 写入 ROOT 子树时事件**结构性直达观察器，不存在
  任何需要 T3 接线的槽位**），origin 按 §8-C 分类；因此复制启用中的 namespace 上 peer apply
  触及已订阅容器时，T1 交付态**会**产出 `origin:'replication'` 的 data 通知。T1 契约只断言
  `'local'`（fixture 无复制面）；`'replication'` 的断言编排（经 `openReplicationSession` 驱动）
  与 `watch-end` 属 T3 #389——**T3 补齐的是验收与终止编排，不是 apply 信号接线**。
- `invalidate-all` 的**触发编排**（队列溢出测试注入、父路径删除信号）与 `watch-end` 流末条
  （T4 #390；本票实现有界队列 + 溢出降级的 ADR §6 语义但无验收断言）。
- 三方 agent 文档面（T5 #391；本票零文档改动——CONTEXT「变更订阅」词条已在 HEAD）。
- `watchArray`（数组载体订阅，v2）；含值通知 / 序号 / 对账（ADR v2 开放问题）。
- 同值写过滤的**Y 载体条目精确判定**（本票对可判定面精确过滤、不可判定面保守通知——
  §8-D；全量语义投影比较属后续精化，见 §13 残余 R3）。

## 2. 当前行为与证据锚点

| # | 事实 | 锚点 |
|---|---|---|
| 2.1 | lease 恰 15 键、无 `watchMap`（`typeof 'undefined'`、调用 `TypeError`） | SA6 §5 证据 1（`artifacts/sa6-issue387-probe-final.log`、round 3 复跑 `-r3-probe-387.log`）；`packages/namespace-registry/src/lease.ts` L305–415（键字面量） |
| 2.2 | runtime 恰 14 键、无 `watchMap` | 同上 `-r3-probe-387b.log`；`packages/namespace-runtime/src/runtime.ts` L704–835（十四键字面量） |
| 2.3 | 两包公共入口零 watch 名目；类型面 TS2724×3 + TS2339×2 | SA6 §5 证据 2（`-r3-type-probe.log`）；`packages/namespace-{registry,runtime}/src/index.ts` 实读 |
| 2.4 | 行为契约红 20 failed / 1 passed（唯一绿 = NC1 既有读面负控）；类型契约 1 failed | SA6 §13 R4/R5；根全量终跑红面恰为契约两文件（`-r3-root-test-final.log`） |
| 2.5 | 写槽结构：`runRootWriteSlot` S5 单事务（`applyValidatedMutation`）→ S6 await notifyDirty → S7 槽释放；本地图解导航要求 map 步载体为 Y.Map（“不实例化不匹配载体”） | `packages/namespace-runtime/src/write.ts` L94–230；`packages/doc-runtime/src/mutation-local.ts` L143–152 |
| 2.6 | 局部写事务 origin 为 null（`doc.transact(body)` 无 origin）；复制 apply 以 per-session symbol 为 origin 经 `Y.applyUpdate(host.doc, bytes, ctx.applyOrigin)` 进入同一 doc | `packages/doc-runtime/src/fatal.ts` L64–67；`packages/namespace-runtime/src/replication-session.ts` L764（本轮实读复核） |
| 2.7 | Yjs 13.6.32 事件面：`observeDeep(handler)` 收 `[YEvent]`（每次事务恰一次回调）；`event.path`（观察型→变更型路径）、`event.changes.keys: Map<key,{action:'add'\|'update'\|'delete', oldValue}>`、`event.transaction.origin` 在产 | `node_modules/.pnpm/yjs@13.6.32/.../src/types/AbstractType.js` L236/L379、`src/utils/YEvent.js` L16–80（本 worktree 实读） |
| 2.8 | 仓内既有“事务捕获 → 槽外异步分发”先例：`createSessionFanout`——`doc.on('update')` 恰一监听、有界队列（容量 16）、单飞微任务泵（让步 20 次）、逐 listener try/catch 自捕获 | `packages/namespace-runtime/src/replication-session.ts` L188–334 |
| 2.9 | observer 内 throw 的后果：`transactGuarded` 把事务调用栈异常收编为 DOCRT-E203 写 fatal（committed:true、写永久禁用）→ **watch 观察器零 throw 是硬红线** | `packages/doc-runtime/src/fatal.ts` L64–77 |
| 2.10 | schema 路径分类原语在产：`resolveSchemaAtPath(derived, path)`（无预算重载）→ ok:true 携带 `valueSchema`（Record/封闭 map = `'object'`、数组 = `'array'`、标量 = `'scalar'`、类型引用 = `'ref'`；ref 闭包随 `aliases` 携带）或 ok:false `SCHEMA_PATH_NOT_FOUND / SCHEMA_PATH_INVALID` | `packages/vfsl/src/resolve-schema-at-path.ts` L199–290；SA6 §5 探针（`-probe.md`：tasks=object、workRecords=array、title=scalar、nope=NOT_FOUND）；`packages/vfsl/src/derived.ts` L44–58 |
| 2.11 | 敌意 path 单次快照纪律在产：`normalizeReadPath`（迭代纯度 + 段域校验 → 快照或 null） | `packages/namespace-runtime/src/read-schema-projection.ts` L237–255 |
| 2.12 | **键集守卫四处**（F-1 全清单；全树 grep `Object.keys(runtime|lease)` + 逐处实读）：lease 15 键一处（`registry-open.test.ts` L924 起 `Object.keys(lease).sort()` 精确清单）；runtime 14 键**三处**——`runtime-registry-internal-seam.test.ts` L276、`runtime-phase5-reset-fence-r2.test.ts` L127–141、`runtime-close-lifecycle.test.ts` L155–176（精确 `toEqual` 十四键清单） | 实读（§11 ALLOW LIST 对应）；close-lifecycle L500 另有 `getStatus()` 键集断言，不涉 runtime 键面、零影响 |
| 2.13 | **结构实现点十处（iteration 2 修订；SA3 B-1/B-2）——`NamespaceRuntime` 九处（测试侧）+ `NamespaceLease` 一处（工具侧）**。检索模式（B-2 教训后扩为五类）：`implements NamespaceRuntime` / `: NamespaceRuntime = {` / `satisfies` / **`): NamespaceRuntime`（函数返回类型注解 + return 字面量）** / **`): NamespaceLease`（装饰器包装）**。逐处：<br>①–⑤ 五处 `implements NamespaceRuntime` class 桩——`registry-idle.test.ts` L238、`registry-sa7-concurrency.test.ts` L168、`registry-sa7-hostile.test.ts` L162、`registry-sa7-rev1.test.ts` L207、`registry-shutdown.test.ts` L186；<br>⑥–⑦ 两处 `const runtime: NamespaceRuntime = {` 全量字面量——`registry-readdata-budget-passthrough.test.ts` L112、`registry-readdata-projection-text-red.test.ts` L102；<br>⑧ `registry-open.test.ts` `makeRuntime(…): NamespaceRuntime` 返回字面量（L182 签名 / L183 起）——iteration 1 漏记（iteration 1 只以三类模式检索，未含返回类型注解形态），实现轮发现并**已在 ALLOW 路径内修复**（watchMap throw stub 现于 L191）；<br>⑨ `issue-369-window-read-lease-contract-red.test.ts` `makeStubRuntime(…): NamespaceRuntime` 返回字面量（L870 签名 / L871 起）——iteration 1 漏记且被原 DENY「无需也无法改」错误覆盖；<br>⑩ `ws-replication/src/testing.ts` `decorateLease(…): NamespaceLease` 装饰器字面量（L38 签名 / L44 `Object.freeze({`）——**lease 侧除 lease.ts 本体外唯一结构实现点**（iteration 1 §2.14「无第二实现点」陈述撤回，见 2.14）。<br>**非结构实现点的命中（排除依据，编译器实证零 TS2741）**：`okLease(...): NamespaceLease` 全族为 `as` 类型收窄断言（非构造）；`proxyLease`（ws-replication-issue256 L164）为 `Object.create(lease) as` 原型委托（成员经原型链继承，加必填成员不红）；`createBudgetRuntimeFromHandle` / `createWindowRuntimeFromHandle` / `internal.ts` 两工厂 / `runtime-replication-schema-lifecycle` `makeRuntime` / `registry-phase5-replication-*` `runtimeFactory` 箭头全部经 `createNamespaceRuntime(WithSeam/ForRegistry)` 委托（非字面量）。**接口加必填成员即十处 TS2741（缺属性）编译红**；类型门 = `tsconfig.typecheck.json`（include `packages/*/test/**`，⑩ 经 ws-replication 测试 import 图入程序）+ 根 `pnpm typecheck`（14 包 `src/**`，覆盖 ⑩）。**仲裁者 = 编译器，grep 只是线索**：iteration 1 的 grep 模式漏掉「返回类型注解 + return 字面量」与「装饰器包装」两种形态（B-2 教训，登记入 §13-R8） | 本轮独立复检：全树 grep 五类模式 + 逐文件实读 + 编译器仲裁（`artifacts/sa3-issue387-test-tsc2.log`：补七桩+⑧后余 ⑨⑩ 恰 2 处 TS2741；`artifacts/sa3-issue387-root-typecheck.log`：余 ⑩ 恰 1 处 TS2741）；runtime.ts L745 / lease.ts L330 本体字面量在 ALLOW（主实现） |
| 2.14 | lease 侧结构实现点恰两处：`lease.ts` L330 本体（ALLOW）+ **`ws-replication/src/testing.ts` `decorateLease` L44（第二实现点，iteration 2 修订）**。iteration 1「lease 侧无第二实现点」陈述**撤回**——该陈述建立在 `implements`/字面量赋值 grep 上，漏掉装饰器包装形态（SA3 B-2）。全树无 `keyof NamespaceLease` 穷举断言 | 本轮 grep + 编译器仲裁（同 2.13）；SA2 §9 原判同被推翻 |
| 2.15 | **Runtime 构造对 ROOT 载体形态零依赖（frozen 契约）**：P0 不读取或验证 ROOT——ROOT 载体非 Y.Map（Y.Text）仍照常 ready；权威 = ADR 0008「读取能力」节「普通 open 不执行 schema、ROOT 载体或 logical validation」 | `packages/namespace-runtime/test/runtime-p0-sequencer.test.ts` L148（AC5 冻结契约锚点，文件头 L14 引 ADR 0008）；SA3 A-1（`artifacts/sa3-issue387-root-test.log` 首跑红 = 本契约） |

## 3. 根因 / 能力缺口（承接 SA6 §8）

T1 tracer 垂直通路从未交付：lease 公共面（ADR §1/§7 第三层）与 runtime 分发层（§7 第二层）
均不存在；#369 交付的窗口读只是读面，无信号面（SA6 §8 表逐行承接，无矛盾）。本设计不
重新复现，直接消费 SA6 的能力缺口链与红灯证据（§5 承接表）。

## 4. Owner 要求落实

| Comment ID | Updated at | Requirement | Design section |
|---|---|---|---|
| （无） | — | issue #387 评论数 = **0**（REST 实读 `comments: []`；iteration 1/2 dispatch 均确认 "Owner requirements: none; current issue comments REST snapshot is empty ([])"）→ 无 owner 条款需映射 | 需求源 = issue 正文 AC1–AC10 + ADR 0030 决策 1/3/4/5/6/7 + SA6 §12 绑定表，逐条落于 §7（冻结）、§8（机制）、§12（验收映射） |

## 5. 复现和根因承接

| 上游事实（SA6 契约） | 证据位置 | 设计响应 |
|---|---|---|
| 能力缺口稳定可证：lease 15 键 / runtime 14 键均无 watchMap；类型面 5 处红；契约红 20/21 首因全部 = `WATCH_MAP_MISSING` / 能力存在性 | §5/§13（三轮同构；round 3 复跑 R1–R16） | §7 公共面冻结（lease `watchMap` 第 16 键 + runtime `watchMap` 第 15 键）+ §8 机制；红灯转绿路径见 §12 |
| Yjs 机制实验：批量信封两键 set → 1 事务 / 键级 delta `[t3,t4]`；同条目兄弟路径 → 1 事务、父容器只报外层 key；无效写 → 零事务 | §9.2（`-probe.log`） | §8-C 事务级推导（observeDeep 每事务恰一次回调 → 一事务一通知结构性成立；同 key 合并 = 事务内按 key 去重） |
| 浅/深观察分野：直改容器条目 → 父 YMapEvent `keys=[t3,t4]`；嵌套字段写 → 事件落嵌套 map（path `['t1']`） | §9.3（`-probe-c.log`） | §8-C 路径前缀匹配三分支（容器本体 / 容器内嵌套 / 容器级事件）——N3 哨兵由此覆盖 |
| readMap oracle：封闭对象 YMap（meta）与 plain object 容器（tasks）均被接受 | §9.4（`-probe-e.log`） | §8-B 建立判定 = **纯 schema 侧**（valueSchema `'object'`），不看 live 载体——数据缺席合法 + 载体面与 readMap 对齐（E2/E3） |
| 类型契约可满足性（NC5）：假想实现（B-2 位置参数绑定）16 断言 + 4 负例全过 | §6 NC5 / §13（`-r3-mock-contract.log`） | §7-B2 冻结与 SA6 默认一致 → fixture `WATCH_MAP_BINDING` 单点与类型契约**零改动**即满足 |
| 守卫门合规：NC1 已改 `expectReadDataOkKeys`；根全量红面恰为契约两文件 | §17 R13–R16 | 本票实现不动契约断言（除 §12 可选的 B-4 逐字化收紧）；`readdata-ok-shape` helper 面零触碰 |
| 仓库守卫门 #333/#336/#364：readData 形状断言禁内联四键字面量 | §12.5-8 | 本票零 readData 形状新断言；不引入违规面 |

## 6. SA8 约束落实（SA8 设计后冲突复审在场 + 前置产物缺席的替代约束面）

| 决议或义务（来源） | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|
| **SA8 设计后复审**（`_design_conflict_report.md`，verdict clear、26 项对照、0 hard-conflict、0 override；`requiresConflictRecheck=true`） | 全文 | 三条分期义务（T4 队列上限构造参数注入、T2/T5 签名简写对账、R3/R4 后续精化过评审）由 §8-E（O-1 单参数位预留）/§1 非目标/§13 R3-R4 承接；ADR 0008 L101（窄读 + ADR 0030 后法授权）与 ADR 0023（返回值不受访问器纪律约束）裁决与源码事实相容 | 是（SA8 §10 自标 true：公共面增长 + 新失败语义/生命周期钩子尚待实现核对；**iteration 2 增量见下两行**） |
| **SA8 §8-1 计数修正（F-1 ④；iteration 2 再修正）**：SA8 复审按 iteration 1 文本写「四处键集 + 七结构桩」；iteration 2 修订为**四处键集 + 十结构实现点**（七桩 + ⑧ registry-open `makeRuntime` + ⑨ issue-369 `makeStubRuntime` + ⑩ ws-replication `decorateLease`，§2.13/§2.14——SA3 B-1 实测编译红指认） | §2.12/§2.13/§2.14、§11、§12 | SA8 报告为只读输入不予改动；本设计以 §2.12/§2.13/§2.14 为准确清单，实现后复查（SA8 §8-4 清单②「七桩补齐后测试树 tsc exit 0」）**按十处清单执行**：十处补齐后 `tsconfig.typecheck.json` 与根 `pnpm typecheck` 双 exit 0 | 是（复查清单按十处清单对账；⑨⑩ 属原 DENY/ALLOW 外路径的范围改判——见下行） |
| **ALLOW/DENY 范围改判（SA3 B-1②③；iteration 2 新增）**：⑨ 位于原 DENY 明文行（`issue-369-*.ts`「无需也无法改」——该事实前提被实现否决，SA3 B-2）；⑩ 位于原「wire/协议/持久化包」DENY 行覆盖域。两处改判均为**纯类型面一行同步**（⑨ D9 throw stub / ⑩ 装饰器透传），断言与行为面零改动 | §11（ALLOW 新两行 + DENY 两行改判 + 同路径重叠优先序）、§10、§14 | ⑨：issue-369 契约文件**断言零改动**、33/33 保持全绿（负控基线语义不变——改的只是替身的类型满足性，非被测行为）；⑩：ws-replication 仅 `src/testing.ts` 装饰器类型面同步，wire 帧/协议/导出面零改动 | 是（范围改判触及 SA8 §8-1/§8-4 所列冻结面清单——SA3 报告同判 true） |
| **ROOT 载体门 ③b（SA3 A-1 吸收为设计；iteration 2 新增）**：frozen 契约 P0 AC5（ADR 0008「读取能力」节）禁止构造期验证 ROOT 载体 → hub 构造期对异型 ROOT 容错捕获（零抛、零副作用），`watchMap` 建立场 ③b 对「ROOT 同名异型载体」响亮拒绝（复用 `WATCH_MAP_CARRIER_MISMATCH` 码 + 专属 message，**不新增稳定码**） | §2.15、§7-D10、§8-B（③b + ROOT_CARRIER_MESSAGE）、§8-G | 与 ADR 0030 §3「非键容器 → CARRIER_MISMATCH（message 区分）」同族（ROOT = 全部键容器的载体；异型载体 = 通知面结构不可达的载体失配）；fail loud 而非静默建立永不投递的订阅 | 是（新增建立拒绝分支属失败语义面——虽然复用既有稳定码，仍入实现后复查清单） |
| **SA8 复审第 6 行陈述修订（F-2）**：SA8 评「T1 产出 data + 溢出 invalidate-all；origin 分类机制就位、T1 只产 `'local'`」——iteration 0 §1 同款陈述被 SA2 F-2 判内部矛盾；本设计修订为**无过滤全事务推导**（§1/§7-D8/§8-C） | §1 非目标、§7-D1②/D8、§8-C/E | 修订方向与 SA8 第 6 行所引 ADR §4/§6 条款本身一致（ADR §6 明文「全覆盖……复制 apply……三种来源」、§5 宁多勿漏唯一不变量）；被修订的只是「T1 只产 'local'」这一范围陈述 | **是**（origin 产出语义修订改变了 SA8 所评陈述——设计后冲突复查须对照 ADR §6 全覆盖条款复核） |
| ADR 0030 §1：公共面 = lease 层 watchMap；`{unsubscribe}` 幂等；载体面 = 键容器（对齐 readMap）；订阅是 lease 调用方 capability | §7-B1、§8-A/B | 实现原文；无修订 | 否（忠实实现） |
| ADR 0030 §3：建立判定全部由 active schema 完成；无 active schema 整体拒绝；非键容器 → `WATCH_MAP_CARRIER_MISMATCH`（message 区分）；数据缺席合法；全部参数校验在建立时刻 | §8-B | 实现原文；拒绝面 = 同步 throw（B-3，§7 论证 `_handleKeys` 型锁迫使 throw）；③b 门为该码族的 doc 级载体失配分支（§7-D10——不触碰「数据缺席合法」：缺席容器无载体，③b 不触发） | 否（码字 ADR 逐字；面为文本缺口解释） |
| ADR 0030 §4：data 通知恰三键、定位符恰两键、`[...path,key]` 可读、同事务同 key 合并、origin 两态 | §8-A/C/E | 实现原文 | 否 |
| ADR 0030 §5：宁多勿漏——通知条件 = 投影值真变 ∧ 无谓词（本票形态）；旧态不可判保守通知 | §8-D、**§7-D8** | 可判定面（标量字段 / plain 值）精确比较过滤；Y 载体整值替换 = 不可判 → 保守通知；**宁多勿漏同样否决 origin 过滤**（对复制启用 namespace 蓄意漏通知 = 违反唯一不变量——D8） | 是（B-2 对 ADR §1 简写的解释性冻结 + §5 精确比较的实现边界属新裁决面，见 §15） |
| ADR 0030 §6：挂点 = 写序列器事务提交后异步分发（槽外）；**全覆盖本地受控写、复制 apply、schema 安装三种来源**；回调 throw 静默隔离；有界队列溢出 → invalidate-all（数值不进契约） | §8-E、**§7-D8** | 捕获在事务观察器内（零 throw、只入队）、投递在单飞微任务泵（槽外）；队列容量 16 实现常量（`createWatchHub` 单参数位、默认 16——T4 注入纯加法预留）；溢出降级语义实现、验收留 T4 | 是（同上；origin 产出语义见上行） |
| ADR 0030 §7：runtime 簿记/判定/分发；registry lease 公共面 + 类型别名与**透传**；读/复制面零改动 | §7-D5、§8-A/F、§11 | runtime 公共 `watchMap`（透传前提）+ registry 别名与 Equal 锁 | 是（公共面纯加法触发复查，见 §15） |
| `packages/namespace-registry/AGENTS.md`：公共 API 仅经 `src/index.ts`；lease 为独立调用方 capability；release 幂等 | §8-F、§11 | index.ts type-only 追加；lease release 同步段清订阅 | 否 |
| `packages/namespace-runtime/AGENTS.md`：严格 FIFO 边界（读不进 sequencer）；公共面仅 detached 投影；lifecycle close 同步停接纳 | §8-B/E/G | watch 观察器不进 sequencer 队列（事件驱动）；通知为纯数据（不含值/载体引用）；close 同步段 hub 关停 | 否 |
| #369 先例纪律：公共 API 仅经 `src/index.ts`、类型别名跟随（Equal 锁）、先例 = `_readMapAlias` | §7-B5、§8-F | 逐款照搬 | 否 |
| spec #385 Testing Decisions：唯一主接缝 = NamespaceLease 公共面；三件套形态 | §12 | 契约已落盘，本设计以转绿为验收 | 否 |

## 7. 设计决策与冻结（本 dispatch 的核心职责）

### 冻结表：SA6 §12.1 B-2/B-3/B-4/B-5 → 本设计裁决

| # | 绑定 | **冻结结果** | 依据与论证 |
|---|---|---|---|
| B-2（承重） | 订阅回调绑定 | **`watchMap(path, listener)`——listener 为第二位置参数，恰一参（通知对象）、返回 `void`；T1 不收第三参（options 槽位为 T2 #388 预留加宽位）** | ① ADR §6「回调 throw 静默隔离」+ spec #385 US20「订阅回调」证明回调存在，而 ADR/CONTEXT/issue 四处 `watchMap(path, { where? })` 简写均省略回调位（SA6 §11-5 实测文本缺口）→ 简写中的 `{where?}` 只能落位 options；② 仓内全部订阅面先例均为位置参数 listener（`subscribeOwnedUpdates(listener)`——`types.ts` L657、`lease.ts` L267；fanout listeners）；③ SA6 NC5 已以该绑定验证类型契约可满足（16 断言 + 4 负例，exit 0）——换绑定即推翻该验证；④ 类型契约负例 `lease.watchMap(['tasks'])`（缺回调 fail-closed）只在位置参数形态下成立。**后果**：fixture `WATCH_MAP_BINDING` 单点与类型契约绑定块**零改动**。T2 加宽路径：`watchMap(path, listener, options?: NamespaceRuntimeWatchMapOptions)` 纯加法（`_twoArgCallAccepted` 的 `[Path, Listener] extends Parameters<...>` 恒真不受影响） |
| B-3 | 建立失败的「面」 | **同步 throw：`WatchMapError`（Error 子类，`readonly code` + 非空 message；类不进两包 index，code+message 字符串消费——沿 `RuntimeReadDisabledError`/`ReplicationSessionClosedError` 先例）** | **决定性证据**：SA6 类型契约 `_handleKeys: Equal<keyof WatchHandle, 'unsubscribe'>`（`ReturnType<watchMap>` 恰一键）——失败信封若入返回类型，`keyof` 联合 `ok/code/message` 即红；该断言已过 NC5 可满足性验证 ⇒ 契约本身已排除信封面。配套通道：released lease → `NamespaceLeaseReleasedError`（getter 域 throw 先例，`lease.ts` L318–326）；runtime closing/closed → `RuntimeReadDisabledError`（getter 词表加 `'watchMap'`，additive）；listener 非函数 → 同步 `TypeError`（`subscribeOwnedUpdates` 形状门禁先例，`replication-session.ts` L472–477）。fixture `attemptEstablishWatch` 面中性归一对 throw 面天然兼容（catch 读 `error.code`）。**测试/工具侧结构实现点同面**（F-1/B-1）：替身类实现点（①–⑨）补的 `watchMap` 最小成员 = 恒同步 throw（D9）；装饰器类实现点（⑩）= 诚实透传（D9 装饰器条款） |
| B-4 | 无 active schema 稳定码 | **`WATCH_MAP_SCHEMA_UNAVAILABLE`**（覆盖 legacy / preparing / unavailable / fatal 期 `getActiveSchema() === null` 的全部无 active schema 态） | ADR §3 第一条明文行为（整体不可用、含无谓词）但未命码；沿 WATCH_MAP_* 前缀族（`WATCH_MAP_CARRIER_MISMATCH` ADR 逐字、`WATCH_MAP_OPTIONS_INVALID` T2 预留）append-only 注册；语义自描述且不与写域 `SCHEMA_UNAVAILABLE`（root 写槽 issue 内码，`errors.ts` L75）混淆。**收紧授权**：SA6 §12.1 B-4「SA1 冻结码字后升级为逐字断言」——实现期可将 E4 的非空断言升级为 `toBe('WATCH_MAP_SCHEMA_UNAVAILABLE')`（可选、非必须，见 §12 注） |
| B-5 | 类型别名命名 | **runtime 三别名：`NamespaceRuntimeWatchMapNotification` / `NamespaceRuntimeWatchMapChange` / `NamespaceRuntimeWatchMapHandle`；registry 三别名：`NamespaceLeaseWatchMapNotification` / `NamespaceLeaseWatchMapChange` / `NamespaceLeaseWatchMapHandle`（= runtime 同名单源别名）**；**不设** `*Result` 与 `*Options` | ① 窗口读先例（`NamespaceRuntimeReadMapOptions/Result` → `NamespaceLeaseReadMap*`，registry `types.ts` L470–485）的命名公式 `Namespace{Runtime,Lease}WatchMap*`；② 失败走 throw（B-3）⇒ `ReturnType<watchMap>` 即 handle——单独的 `Result` 别名只是 handle 的重复名，不设；③ T1 无 options 参数（B-2）⇒ 不设 `Options`，T2 随 `{where}` 加法引入；④ lease 别名 = runtime 单源 type-only 别名（`NamespaceLeaseReadMapOptions = NamespaceRuntimeReadMapOptions` 同款）+ lease.ts Equal 锁（`_readMapAlias` 同款，§8-F）。实现期可在类型契约追加别名 Equal 锁（SA6 §12.1 B-5 授权，可选）。**结构实现点的 stub 类型引用同源**（`NamespaceRuntimeWatchMapHandle` 经 runtime `src/index.ts` 导出后可用——F-1） |
| B-6/B-7（复核维持） | 通知 / 定位符形状 | data 通知恰三键 `{kind:'data', origin, changes}`；定位符恰两键 `{path, key}`；不含值 | ADR §4 逐字 + issue AC4；本设计 §8-A 类型面与此逐字段一致（含 `readonly` 与冻结纪律） |

### 其余关键决策（D-编号，均含被否备选）

- **D1（推导机制）＝ 事务事件驱动，非信封驱动**：订阅信号从 `doc.getMap('ROOT').observeDeep`
  事务事件推导（见 §8-C），不从 mutation 信封路径推导。理由：① ADR §4 明示「实现上 Yjs
  transaction origin 天然可区分，零额外成本」——作者预期的即事务观察面；② 单一挂点天然
  覆盖 ADR §6 的三来源（本地写 / 复制 apply / schema 安装）——origin 分类直接读
  `event.transaction.origin`（零额外槽位；复制 apply 事务结构性直达观察器，见 D8）；
  **T3 #389 的增量是复制来源的验收编排（经 `openReplicationSession` 驱动的契约断言）与
  `watch-end` 终止编排，不是 apply 信号的接线**（F-2 修订措辞）；③ 信封驱动只在
  `runRootWriteSlot` 内可得，会把信号面锁死在 ROOT 写单源。**否决备选**：写槽内信封推导
  （覆盖面窄 + 复制路径需二次实现）。
- **D2（观察挂点）＝ 每 Runtime 恰一次 ROOT `observeDeep`，构造期挂接（异型 ROOT 容错捕获，
  见 D10）**：镜像 `createSessionFanout` 的「每 Runtime 恰一次 `doc.on('update')` 监听——
  INV-S2」纪律；零订阅时空集合快路径（handler 先查订阅集再工作）。**否决备选**：按订阅逐容器
  `observeDeep`（缺席容器 ghost 无法挂接、容器重建需重挂、退订重挂簿记复杂——N4 横跨缺席期
  场景直接不可达）；按事务 `transaction.changed` 裸读（无 `oldValue`——yjs 13.6.32 实测
  `changed: Map<type, Set<string>>`，真变判定所需 oldValue 只在 YEvent `changes.keys`）。
- **D3（建立判定）＝ 纯 active schema 侧（`resolveSchemaAtPath`），零 live 载体探测**：
  valueSchema（ref 经 aliases 闭包追尽）`'object'` → 键容器；`'array'` → CARRIER_MISMATCH
  （数组载体 message）；其余 kind（scalar/pattern/enum/int/range/xml/union）→
  CARRIER_MISMATCH（非键容器 message）；`SCHEMA_PATH_NOT_FOUND` → CARRIER_MISMATCH（偏离
  schema message）；`SCHEMA_PATH_INVALID` / 敌意 path → CARRIER_MISMATCH（形状/敌意 message）。
  数据缺席合法（不触 live 数据，E3 天然成立）；载体面与 readMap 对齐（Record 与封闭 map 同
  为 `'object'`，E2 天然成立）。**与 D10（③b ROOT 载体门）的分界**：D3 的「零 live 载体探测」
  指**订阅容器路径级**的 per-path 探测（那会违反「数据缺席合法」）；③b 是**构造期一次性**
  的 doc 级载体事实（ROOT 本身是否 Y.Map——异型时 ROOT 子树事务结构不可产生），不是对
  「schema 已声明但未物化」容器的探测——缺席容器无载体，③b 不触发，E2/E3 判定面不变。
  **否决备选**：live 载体探测（违反「数据缺席合法」）。
  已知限制：union 值形态按非键容器拒（T1 fixture 无 union；开放属词表演进面，过设计评审）。
  **空路径边界（O-3 采纳）**：map 形 ROOT 下 `resolveSchemaAtPath(derived, [])` 返回
  kind `'object'`（脊柱初值 = ROOT 值节点，`resolve-schema-at-path.ts` L262）→ `watchMap([])`
  建立合法，通知流 C-1 产出 `{path: [], key}` 定位符（`[...path, key]` 即根级条目路径）。
  语义自洽（ROOT 本身是键容器），**显式承认该边界为合法行为**（实现期在 §8-B⑤ 注释或
  契约注释落一句，防误报缺陷；不新增断言、不扩 ALLOW 面）。
- **D4（真变判定边界）**：`action:'add'|'delete'` 恒真变；`'update'` 且新旧值均 plain
  数据（标量或 plain object/array）→ 结构深比较（undefined 键过滤，`logicalValuesEqual`
  同款纪律；深度上限 32——环/超深归「不可判」走保守通知）相等则过滤；任一侧为 live Y
  载体 / 非 plain → **不可判 → 保守通知**（ADR §5 原文授权）。嵌套字段写（事件落在条目内）
  以「任一字段真变或不可判」聚合到条目级。**否决备选**：全量语义投影比较（对 live Y 载体
  条目需双投影，事件处理器内成本与复杂度失衡；宁多勿漏下保守通知可接受——残余 R3）。
- **D5（runtime 公共面形态）＝ 公共第 15 键，非 internal seam**：① ADR §7 registry 职责
  原文「lease 公共面、类型别名与**透传**」——透传以 runtime 同名成员为前提（readData/
  readArray/readMap 均为同名透传对偶）；② lease.ts Equal 锁需要
  `Parameters<NamespaceRuntime['watchMap']>` 型锚；③ SA6 §10 已预判「runtime 键集守卫（若
  runtime 公共面增长）」同步更新。**否决备选**：internal seam（`openReplicationSessionCore`
  式 deps 注入）——那是 lease 需要重包公共面的场景；`{unsubscribe}` 可安全直透，seam 反而
  增加 registry.ts 接线与 import 图审计面。**代价（F-1/B-1 入账，iteration 2 计数）**：必填
  公共成员使 **十处**结构实现点 TS2741 编译红 + 四处键集断言红——全部入 ALLOW（§2.12/
  §2.13/§2.14、§11），改动形态 = 键清单 +1 行 / 实现点补最小成员（D9），不引入行为面。
- **D6（lease 释放清理）＝ lease 侧句柄登记 + runtime 侧幂等退订**：lease 持
  `activeWatches: Set<() => void>`；`watchMap` 透传后包一层「退订 + 摘登记」幂等包装句柄；
  `doRelease` 首调同步段遍历退订（隔离 try/catch，位于 `entry.leases.delete` 之后、
  `onReleased` 之前——guaranteed cleanup 路径）。**否决备选**：runtime 按 lease 分组簿记
  （runtime 不识 lease——分层正确性；订阅是 lease capability，清理责任随 capability）。
- **D7（B-4 码域与 `SCHEMA_UNAVAILABLE` 关系）**：不复用写域内码 `SCHEMA_UNAVAILABLE`
  （它ride在写 issue message 里、语义是「本次写零提交」）；watch 建立拒绝需要独立可断言
  码，且 ADR §3 的 watch 码族（CARRIER_MISMATCH/OPTIONS_INVALID）要求前缀一致。
- **D8（origin 产出语义）＝ 无过滤全事务推导（F-2 择读法 A；iteration 1 新增冻结）**：
  hub 对**一切**触及已订阅容器的事务推导通知，不做 origin 过滤；`origin` 仅作为通知的
  分类字段（`event.transaction.origin == null → 'local'`；symbol origin（复制 apply）→
  `'replication'`）。依据：① ADR §6 明文「挂点 = 写序列器事务提交后异步分发……**全覆盖
  本地受控写、复制 apply、schema 安装三种来源**」与 CONTEXT L66「（本地写 / 复制 apply
  全覆盖）」——复制 apply 属挂点的覆盖面而非后续票的接线对象；② D2 的挂点是每 Runtime
  恰一次的 ROOT `observeDeep`（构造期）——复制 apply 经 `Y.applyUpdate(doc, bytes,
  applyOrigin)`（replication-session.ts L764）写 ROOT 子树时事件自动到达该观察器，
  **结构性零接线即可见，不存在可供 T3「接线」的槽位**；③ ADR §5 宁多勿漏为唯一不变量
  （「漏 = 消费方永久持有过时数据（不可接受）」）——对启用复制的活命名空间过滤掉
  replication-origin 事务即蓄意漏通知，直接违反该不变量。**T1/T3 边界（修订后唯一读法）**：
  T1 交付机制（无过滤 + origin 分类在产）但**契约只断言 `'local'`**（fixture 无复制面）；
  T3 #389 交付 `'replication'` 的断言编排（经 `openReplicationSession` + `applyRemoteUpdate`
  驱动）与 `watch-end` 终止编排。**否决备选（读法 B：origin 过滤，suppressed 非本源事务）**：
  违反 ADR §5 唯一不变量（Peer 场景 UI/agent 对远端变更失明——恰为 #389 What-to-build 要
  消灭的形态）；制造一个 T3 无计划拆除的未登记过滤面；且在 D2 单挂点下无实现动机（分类
  读 transaction.origin 的成本为零，过滤反而是额外代码）。
- **D9（结构实现点最小成员形态；F-1 冻结、iteration 2 扩面至十处 + 装饰器条款）**：
  实现点分两类，成员形态不同——
  **（a）替身类（①–⑨：测试假 runtime / 假 lease）＝ 恒同步 throw 的最小成员**，样式沿
  #369 的 readArray/readMap stub（「issue #NNN（ADR 0030）：15/16 键面新增成员——本替身
  不消费订阅」注释 + 响亮拒绝），但返回面不同——read 族 stub 返回结果联合失败成员，
  `watchMap` 返回 handle（B-3 拒绝面 = 同步 throw）⇒ 桩形态为：
  class 桩 `watchMap(): NamespaceRuntimeWatchMapHandle { throw new Error('stub: watch 订阅未接线'); }`
  （+ import `NamespaceRuntimeWatchMapHandle`）；字面量桩（含 ⑧⑨ 返回类型注解形态）
  `watchMap: () => { throw new Error('stub: watch 订阅未接线'); }`。throw-only 函数体推断
  `never`、对任何返回类型可赋值——类型恰可满足且零行为面（这些测试从不调用 watchMap，
  与 readArray/readMap stub 从不被消费同构）。**否决备选**：返回哑 handle
  `{unsubscribe(){}}`（假装建立成功、语义不诚实）；跳过补桩改用 `// @ts-expect-error`
  （压制而非满足接口、污染后续真实缺成员错误的检出）。
  **（b）装饰器类（⑩ `ws-replication/src/testing.ts` `decorateLease`）＝ 诚实透传**：
  `watchMap: lease.watchMap.bind(lease),` 一行——与该装饰器对其余 15 个成员的处理完全
  同款（全部 `.bind(lease)` 透传、`openReplicationSession` 单独包装注入探针）。**理由**：
  装饰器包装的是**真实 lease**（探针目的 = 统计 session close，非伪造能力面）——被包装
  对象真有该能力，透传即最小且诚实的形态；与 (a) 的 throw stub 形成对照：替身没有能力故
  响亮拒绝，装饰器下的能力真实存在故原样转发。零行为面（ws-replication 测试均不调用
  watchMap；即便未来调用，得到的就是真 lease 的真实行为）。**否决备选**：throw stub
  （对真实能力的伪造性拒绝——装饰器语义不诚实，且若 T3 #389 复用该 harness 驱动
  replication 断言将直接被桩挡死）；`as unknown as NamespaceLease` 整体断言（类型谎言，
  掩盖未来真实缺成员）。
- **D10（ROOT 载体门 ③b；iteration 2 新增——吸收 SA3 A-1 实现缺陷修复为设计冻结）**：
  **构造期容错捕获 + 建立期响亮拒绝**。hub 构造时 `captureRootMap(doc)`：try/catch 包住
  `doc.getMap('ROOT')`——正常文档返回 live `Y.Map` 并挂接 `observeDeep`（每 Runtime 恰一次）；
  **同名异型载体**（ROOT 已被定义为 Y.Text 等——`getMap` 抛「已用不同构造器定义」）捕获为
  `undefined`，**构造零抛、零副作用**（不创建、不替换既有载体），不挂接 observer；
  `shutdown` 以 `root !== undefined` 守卫对称摘除。`watchMap` 建立状态机在 ③ 与 ④ 之间加
  **③b 门**：`root === undefined` → `throw WatchMapError('WATCH_MAP_CARRIER_MISMATCH',
  ROOT_CARRIER_MESSAGE)`——复用既有稳定码（**不新增码注册表条目**，append-only 纪律不破），
  message 专属可区分（§8-B 文案表）。**依据**：① frozen 契约 `runtime-p0-sequencer.test.ts`
  AC5「P0 不读取或验证 ROOT——ROOT 载体非 Y.Map（Y.Text）仍照常 ready」（ADR 0008「读取
  能力」节「普通 open 不执行 schema、ROOT 载体或 logical validation」）**禁止**构造期对
  异型 ROOT 抛错（iteration 1 §8-G「构造期挂接」的字面实现会在 Y.Text-ROOT 文档上构造即抛，
  被 P0 契约实测击破——SA3 A-1、`artifacts/sa3-issue387-root-test.log` 首跑红）；② 此类
  文档上 ROOT 子树事务**结构上不可产生**（写槽载体纪律拒绝非 Y.Map 载体——证据 2.5），
  订阅通知面不可达 → 静默建立一个永不投递的订阅 = 为「本应始终存在的正常路径不变量」设计
  静默 fallback，违反 fail-loud 纪律；③ 拒绝码归属 `WATCH_MAP_CARRIER_MISMATCH` 家族自洽
  （ADR §3「message 区分原因」：ROOT 是全部键容器的载体，ROOT 异型 = 最粗粒度的载体失配，
  与数组载体/非键容器/偏离 schema/形状敌意四类 message 并列第五类）。**与 AC1「数据缺席
  合法」无冲突**：③b 触发条件是 ROOT 本身异型（doc 数据级损坏态），不是容器缺席——
  schema 已声明未物化/已删除的容器（ghost/optionalTasks）在 map 形 ROOT 下照常建立（E3
  判定面零触碰，见 D3 分界）。**否决备选**：构造期抛错（直接违反 P0 AC5 frozen 契约）；
  静默不挂接、订阅照常建立（永不投递的死订阅——静默 fallback，消费方无从得知）；惰性
  挂接（首次 watchMap 时再 `getMap`——把构造期不变量推迟到建立期重算，且异型判定逻辑
  二处分散）。

## 8. 接口、状态机与数据流（实现规格）

### A. 类型面（冻结形状；`readonly` + 冻结对象纪律）

```ts
// packages/namespace-runtime/src/watch-map.ts（新模块；type-only 经 index 转出）
export type NamespaceRuntimeWatchMapNotification =
  | { readonly kind: 'data'; readonly origin: 'local' | 'replication';
      readonly changes: readonly NamespaceRuntimeWatchMapChange[] }
  | { readonly kind: 'invalidate-all'; readonly origin: 'local' | 'replication' }
  | { readonly kind: 'watch-end'; readonly reason: 'schema-changed' | 'doc-replaced' };

export interface NamespaceRuntimeWatchMapChange {
  readonly path: readonly (string | number)[];   // = 订阅容器路径（新鲜副本）
  readonly key: string;                          // [ ...path, key ] 直接可读
}

export interface NamespaceRuntimeWatchMapHandle {
  unsubscribe(): void;                            // 幂等；零通知副作用
}
```

- 三 kind 联合**现在即冻结**（ADR §4 全词表；T1 产出 `'data'`（origin 含 `'replication'`，
  见 D8——契约只断言 `'local'`）与溢出降级的 `'invalidate-all'`（无验收断言），
  `'watch-end'` T3/T4 产出——类型先行防 T2–T5 破坏性加宽）。
- 运行时构造的通知为**深冻结纯数据**（不含值 / 载体引用 / 投影文本——「信号不含值」；
  `path` 为新鲜普通数组副本，N3 的 `toStrictEqual(['tasks'])` 与窗口读条目同构由此成立）。

```ts
// runtime 公共面第 15 键（runtime.ts；NamespaceRuntime 接口 + 对象字面量同步）
watchMap(
  path: readonly (string | number)[],
  listener: (notification: NamespaceRuntimeWatchMapNotification) => void,
): NamespaceRuntimeWatchMapHandle;

// registry lease 第 16 键（types.ts NamespaceLease + lease.ts 实现）
watchMap(
  path: readonly (string | number)[],
  listener: (notification: NamespaceLeaseWatchMapNotification) => void,
): NamespaceLeaseWatchMapHandle;
```

- 类型契约对偶校验（SA6 `*.test-d.ts` 逐条推演通过）：`_pathMirrorsReadMap`
  （= `Parameters<NamespaceLease['readMap']>[0]`）、`_listenerArity` 恰 `[notification]`、
  `_listenerReturnsVoid`、`_handleKeys` 恰 `'unsubscribe'`、`_dataKeys` 恰三键、
  `_changeKeys` 恰两键、`_changePath = WatchPath`、`_changePathComposes`（`[...path, key]`
  可拼）；负例 4 条（缺 path / 缺回调 / 非函数回调 / 非数组 path）在两必填参签名下全部
  编译期 fail-closed。

### B. 建立状态机（`watchMap(path, listener)`，全同步；顺序冻结）

```
① lifecycle 门（runtime 侧）   state.lifecycle ≠ 'ready' → throw RuntimeReadDisabledError('watchMap', lifecycle)
② listener 形状门              typeof listener ≠ 'function' → throw TypeError（subscribeOwnedUpdates 先例）
③ schema 可用门                state.schemaState ≠ 'ready' ∨ activeTools 缺席
                                   → throw WatchMapError('WATCH_MAP_SCHEMA_UNAVAILABLE')   [B-4]
③b ROOT 载体门（D10）          构造期容错捕获缺席（ROOT 同名异型载体）
                                   → throw WatchMapError('WATCH_MAP_CARRIER_MISMATCH')（ROOT 载体 message）
④ path 单次快照                normalizeReadPath(path) → null
                                   → throw WatchMapError('WATCH_MAP_CARRIER_MISMATCH')（path 形状/敌意 message）
⑤ schema 分类                  resolveSchemaAtPath(activeTools.derived, snapshot)
                                   ├ ok:false SCHEMA_PATH_NOT_FOUND → CARRIER_MISMATCH（偏离 schema message）
                                   ├ ok:false SCHEMA_PATH_INVALID   → CARRIER_MISMATCH（形状 message；④之后的防御位）
                                   ├ valueSchema(ref 追尽后).kind = 'object' → 通过（Record/封闭 map 同过；空路径同过——D3 边界）
                                   ├ kind = 'array'                 → CARRIER_MISMATCH（数组载体 message）
                                   └ 其余 kind                      → CARRIER_MISMATCH（非键容器 message）
⑥ 登记                         订阅记录 {containerPath: 冻结快照副本, listener, queue: [], pumpScheduled, unsubscribed}
                                   入 hub.subscriptions；返回 Object.freeze({ unsubscribe })（幂等包装）
```

- lease 侧前置：`released → throw new NamespaceLeaseReleasedError()`（getter 域通道），
  之后透传 runtime 并登记（§8-F）。
- **全部参数校验在建立时刻完成**（②④⑤）——建立后通知流零参数错误（E6；通知对象由 hub
  构造，kind 恒在三 kind 闭集）。③b 为构造期既定事实的单次判定（非参数校验、非 live 探测，
  见 D3/D10 分界）。
- 建立不回放历史（「订阅是机制不是数据快照」；消费协议 = 建立后先全量拉一次——ADR §5）。
- message 文案（非空、互相可区分、零 path/身份回显——沿 RUNTIME_WRITE_DISABLED 族纪律；
  六个稳定拒绝位）：
  - `WATCH_MAP_SCHEMA_UNAVAILABLE: 无 active schema（legacy/preparing/unavailable/fatal 期）——watchMap 整体不可用（机制由 schema 定义，ADR 0030 §3）；本调用零订阅建立`（O-7 采纳：fatal 期 schemaState 停留 'preparing'——p0.ts L140–147 实证「schema.state 保持 'preparing'」；③门对 fatal 期同样拒绝，文案枚举补齐）
  - `WATCH_MAP_CARRIER_MISMATCH: ROOT 载体非键容器（非 Y.Map，本 Runtime 无键容器事务面）——本调用零订阅建立`（**③b / D10，iteration 2 新增**——ROOT 同名异型载体为 doc 数据级损坏态，写槽载体纪律下 ROOT 子树事务结构不可产生，响亮拒绝而非静默建立死订阅）
  - `WATCH_MAP_CARRIER_MISMATCH: path 终点为数组载体（序列容器不属键容器订阅面；watchArray 属 v2）——本调用零订阅建立`
  - `WATCH_MAP_CARRIER_MISMATCH: path 偏离 active schema——建立判定全部由 active schema 完成（ADR 0030 §3）；本调用零订阅建立`
  - `WATCH_MAP_CARRIER_MISMATCH: path 终点为非键容器（标量/终态形态）——本调用零订阅建立`
  - `WATCH_MAP_CARRIER_MISMATCH: path 形状非法或敌意（段域 string|number）——本调用零订阅建立`

### C. 事务信号推导（`ROOT.observeDeep` handler；每事务恰一次调用）

对每次回调的 `events: YEvent[]`（事务已提交、observer 栈内、**只入队不投递**），对每条
event 与每个活跃订阅 S（容器路径 `C`）：

| 分支 | 判据 | 推导 |
|---|---|---|
| C-1 容器本体 | `event.path` 段逐位 === `C` | 对 `event.changes.keys` 每个 `(key, info)` 做真变判定（§8-D）→ 通过者产出定位符 `{path: C 副本, key}` |
| C-2 容器内嵌套 | `event.path.length > C.length` 且 `C` 为其前缀 | 条目 key = `event.path[C.length]`；「任一变更键真变或不可判」→ 产出定位符（N3/B1） |
| C-3 容器级事件 | `event.path` === `C[0..len-2]` 且 `changes.keys` 含 `C.last` | 容器创建/删除/整替——**T1 不产出条目定位符**（N4 注：创建事件 kind 不钉；父路径删除编排属 T4） |
| C-4 无关 | 其余 | 忽略 |

- **一事务一通知**：handler 单次调用 = 单事务 → 每订阅至多聚合**一条** data 通知；
  `changes` = 该事务全部通过判定的定位符，按 key 去重（`Map<key>` 首见序——N1 两键 / B1
  同 key 合并）。两事务 = handler 两次调用 = 两条通知，队列 FIFO（B2）。
- **origin（F-2 修订后唯一读法——无过滤，D8）**：`event.transaction.origin == null →
  'local'`（本地图写 `doc.transact(body)` 无 origin——证据 2.6）；symbol origin（复制
  apply，`Y.applyUpdate(host.doc, bytes, ctx.applyOrigin)`——replication-session.ts L764，
  证据 2.6）→ `'replication'`。分类在 T1 即生效且**不过滤任何来源**：复制启用中的
  namespace 上 peer apply 触及已订阅容器 → 产出 `origin:'replication'` 的 data 通知
  （ROOT `observeDeep` 单挂点下结构性直达，无槽可接线——ADR §6 三来源全覆盖）。T1 契约
  只断言 `'local'`（fixture 无复制面）；`'replication'` 断言与 `watch-end` 编排属 T3 #389。
- handler **整体 try/catch 吞没**（零 throw 硬红线——throw 会经 `transactGuarded` 收编
  DOCRT-E203 写 fatal，永久禁写，直接违反 AC7 与「emit never throws」纪律）。

### D. 真变判定（宁多勿漏；ADR §5 的 T1 实现边界）

```
info.action = 'add' | 'delete'                       → 真变（新条目 / 删除）
info.action = 'update':
  new = event.target.get(key)                          // observer 期事务已提交，读安全
  old = info.oldValue
  两侧均 plain 数据（标量或 plain object/array）        → 结构深比较（undefined 键过滤）；
                                                           相等 → 过滤（同值写不通知）
  任一侧 live Y 载体 / 非 plain                          → 不可判 → 保守通知
```

### E. 分发（槽外异步、隔离、有界——`createSessionFanout` 泵先例逐款镜像）

- 每订阅 **FIFO 有界队列**：容量收在 `createWatchHub` 的**单一构造参数位**（默认 16 =
  实现常量，镜像 `FANOUT_CHANNEL_QUEUE_CAPACITY`；**数值不进公共契约**——ADR §6）。
  O-1 采纳：以单参数位而非「永久冻结常量」注释定形，使 T4 #390 的构造注入为纯加法。
  溢出：清空在队 data 通知 → 入队单条 `{kind:'invalidate-all', origin}`（origin = 触发
  本次降级的事务 origin——§8-C 同一分类、无过滤；ADR §6 语义；T1 实现之、T4 #390 补注入
  构造参数与验收）。
- **单飞微任务泵**（`pumpScheduled` 守卫 + 自延伸链 + 每项投递前让步 20 次微任务，镜像
  `FANOUT_DELIVERY_DEFERRAL_MICROTASKS`）：listener 调用全部移出事务栈与写序列器槽
  （D1 同步段零回调；D2 回调内重入写被接纳且不阻塞后续写——泵在槽外，sequencer 空闲或
  至多排队）。
- **逐 listener 逐投递 try/catch 吞没**（X1 静默隔离；T1 无 status 计数面——不对齐
  session 的 `observerFailures`，该面属 session 独有）。
- `unsubscribe()`：幂等（`unsubscribed` 标志）；摘订阅、清队列；泵在下一让步点经标志退出；
  恒 `void`、零 throw、退订后零通知（L1）。

### F. registry lease 侧（`lease.ts`）

```ts
watchMap(path, listener) {
  if (released) throw new NamespaceLeaseReleasedError();        // getter 域通道（B-3 配套）
  const handle = entry.runtime.watchMap(path, listener);        // 透传（读面先例）
  const unsubscribe = () => { handle.unsubscribe(); activeWatches.delete(unsubscribe); }; // 双幂等
  activeWatches.add(unsubscribe);
  return Object.freeze({ unsubscribe });
}
// doRelease 首调同步段（entry.leases.delete 之后、onReleased 之前）：
//   for (const u of activeWatches) { try { u(); } catch { /* 隔离 */ } }
//   activeWatches.clear();
```

类型锁（lease.ts，`_readMapAlias` 同款；加入 `LeaseTypeAssertions`）：

```ts
type _watchMapNotificationAlias = AssertTrue<Equal<NamespaceLeaseWatchMapNotification, NamespaceRuntimeWatchMapNotification>>;
type _watchMapChangeAlias       = AssertTrue<Equal<NamespaceLeaseWatchMapChange, NamespaceRuntimeWatchMapChange>>;
type _watchMapHandleAlias       = AssertTrue<Equal<NamespaceLeaseWatchMapHandle, NamespaceRuntimeWatchMapHandle>>;
type _watchMapMemberAlias       = AssertTrue<Equal<Parameters<NamespaceLease['watchMap']>, Parameters<NamespaceRuntime['watchMap']>>>;
type _watchMapResultAlias       = AssertTrue<Equal<ReturnType<NamespaceLease['watchMap']>, NamespaceRuntimeWatchMapHandle>>;
```

registry `types.ts` 别名（L470–485 窗口读别名同款单源跟随）：

```ts
export type NamespaceLeaseWatchMapNotification = NamespaceRuntimeWatchMapNotification;
export type NamespaceLeaseWatchMapChange = NamespaceRuntimeWatchMapChange;
export type NamespaceLeaseWatchMapHandle = NamespaceRuntimeWatchMapHandle;
```

### G. runtime 装配与生命周期（`runtime.ts`）

- 构造期（V3c'''' 位、fanout 之后）：`const watchHub = createWatchHub(doc, state)`——
  hub 构造时**容错捕获** ROOT（`captureRootMap`：`doc.getMap('ROOT')` 异型载体 →
  `undefined`，构造零抛、零副作用——D10/P0 AC5），捕获成功才挂接 ROOT `observeDeep`
  （每 Runtime 恰一次；零订阅快路径）；异型载体不挂接，订阅建立于 ③b 门响亮拒绝。
- 公共面：`watchMap: (path, listener) => watchHub.watchMap(path, listener)`（第 15 键）。
- `closeAfterFence()`（共享关闭 admission，普通 close 与 reset fence 汇合点）：
  `fanout.terminateAll('runtime-close')` 旁并置 `watchHub.shutdown()`——同步摘 observer
  （`root !== undefined` 守卫）、清全部订阅（静默，无 watch-end——ADR §4 终结三因不含
  runtime close；lease force-release 已先行清理，此处为防御性收口）。
- watch 观察器**不进** write sequencer 队列（事件驱动、零槽位占用；reads/信号在 FIFO 之外
  的边界纪律保持）。

## 9. 错误、恢复、并发与幂等

| 维度 | 设计 |
|---|---|
| 建立失败 | 全部同步 throw（§8-B 六个稳定拒绝位〔含 ③b ROOT 载体门〕+ TypeError + Released/ReadDisabled 两 lifecycle 通道）；失败路径**零订阅登记、零 observer 变更**（校验全前置于登记） |
| 通知流失败 | 零参数错误（建立期校验穷尽）；listener throw 静默吞没（X1）；handler 自身零 throw（DOCRT-E203 红线，§8-C） |
| 无效写 | 领域校验失败零事务（`prepareMutation` 先于 `transactGuarded`）→ 零事件 → 零通知（P2 结构性成立，无需专门逻辑） |
| 并发 | 单线程 JS + 每 Runtime 单 hub；`mutateData` 接纳仍由既有 sequencer 定序——通知顺序 = 事务提交序（FIFO），与调用接纳序一致（同 lease 同 namespace；B2）；复制 apply 与本地写同经 doc 事务序到达观察器（D8 无过滤） |
| 重入 | listener 内重入 `mutateData`：泵在槽外调用 → 正常接纳排队（D2；sequencer 不因分发占槽） |
| 幂等 | `unsubscribe` 幂等（标志守卫）；lease `release` 幂等（既有 same-Promise + 本设计清理只在首调段执行一次）；包装句柄退订 + 摘登记双幂等 |
| 生命周期竞态 | release 同步段清订阅先于任何后续写派发；退订清队列使在途投递于下一让步点停止（L1 双屏障 / L2 跨 lease 屏障成立）；runtime close 同步段 hub 关停 |
| 溢出恢复 | 清队 + 单条 `invalidate-all`（订阅存活；消费面全量重拉自愈——ADR §6）；T4 补注入与验收 |

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| SA6 契约 fixture（`issue-387-watch-map-fixture.ts`） | `WATCH_MAP_BINDING` 适配 (path, listener[, options?])；`WATCH_MAP_MISSING` 占位码在 `attemptEstablishWatch` | B-2 冻结与 SA6 默认一致 → **零改动**；实现后 `typeof watchMap === 'function'`，占位码结构性不可达 | 无 | fixture L256–333；§7-B2 |
| SA6 行为契约（`issue-387-watch-map-tracer-red.test.ts`） | 20 红 / 1 绿（NC1） | 全部转绿；可选：E4 码断言升级为逐字 `WATCH_MAP_SCHEMA_UNAVAILABLE`（B-4 收紧授权） | 可选单点收紧 | §12 |
| SA6 类型契约（`issue-387-watch-map-lease-surface.test-d.ts`） | TS2339×2 等红 | 转绿；可选：追加 B-5 别名 Equal 锁（授权项） | 可选追加 | §12 |
| `registry-open.test.ts` lease 15 键守卫 + `makeRuntime` 替身 | 恰 15 键；`makeRuntime(…): NamespaceRuntime` 返回 14 成员字面量（L182 签名） | 16 键（+`watchMap`；既有 15 键全保留）**且** `makeRuntime` 字面量补 D9 throw stub（结构实现点⑧——iteration 2 入账；键集与替身同文件，一次改动两处义务） | 键集数组加一行（+注释行）；替身补 watchMap throw stub（+注释） | L924 起（键集，现含 `'watchMap'` L942）；L191（stub 现位）；§2.12/§2.13⑧ |
| `runtime-registry-internal-seam.test.ts` / `runtime-phase5-reset-fence-r2.test.ts` runtime 14 键守卫 | 恰 14 键 | 15 键（+`watchMap`） | 各加一行 | §2.12（internal-seam L276；phase5 L127–141） |
| **`runtime-close-lifecycle.test.ts` runtime 14 键守卫（F-1 第 4 处）** | 恰 14 键精确 `toEqual`（L160–176）；同测例尾部负向键审计断言 `on/off/subscribe/unsubscribe/emit/…` 等事件订阅词不在键面（L177–182） | 15 键（+`watchMap`）；**负向审计保持原样照绿**——`watchMap` 不在受审计词表内，且「v1 无公共事件订阅键」的语义边界已由 SA8 复审第 10 行裁决（ADR 0008 L101 窄读 = 禁队列进度/内部事件订阅；ADR 0030 后法授权业务数据信号面）——**不得**把 `watchMap` 加进该负向词表 | 键集数组加 `'watchMap'` 一行；可选同步 it 标题「恰十二键」→「恰十五键」的陈旧计数措辞（R5） | §2.12 实读（L155–182）；SA8 复审 §3 行 10 |
| **五个 `implements NamespaceRuntime` class 结构桩（F-1；①–⑤）**：`registry-idle.test.ts`（L238）、`registry-sa7-concurrency.test.ts`（L168）、`registry-sa7-hostile.test.ts`（L162）、`registry-sa7-rev1.test.ts`（L207）、`registry-shutdown.test.ts`（L186） | 14 成员全量实现（#369 时补的 readArray/readMap「stub: 窗口读未接线」响亮拒绝 stub 在桩内） | 接口加必填成员 → TS2741 缺属性编译红（`tsconfig.typecheck.json` 域内）→ 补最小 `watchMap` 成员（D9(a) 冻结形态：恒同步 throw + 注释沿 stub 先例 + import `NamespaceRuntimeWatchMapHandle`） | 每桩一段方法（~4 行）+ import 一名 | §2.13①–⑤ 逐文件实读；#369 先例（桩内 L256–263 等） |
| **两个 `: NamespaceRuntime = {` 全量字面量桩（F-1；⑥–⑦）**：`registry-readdata-budget-passthrough.test.ts`（L112）、`registry-readdata-projection-text-red.test.ts`（L102） | 14 成员全量字面量（readArray/readMap 一行 stub 在内） | 同上 TS2741 → 补一行 `watchMap: () => { throw new Error('stub: watch 订阅未接线'); }`（D9(a)；字面量桩免显式类型/import） | 每桩一行 | §2.13⑥–⑦ 逐文件实读 |
| **`issue-369-window-read-lease-contract-red.test.ts` `makeStubRuntime` 替身（B-1⑨；iteration 2 新入账）** | `makeStubRuntime(…): NamespaceRuntime` 返回 14 成员 record 型字面量（L870 签名 / L871 起，section 注释「14 键面」）——iteration 1 判「负控基线无需也无法改」**被实现否决**：加必填成员即该文件 TS2741（`artifacts/sa3-issue387-test-tsc2.log` 首行），设计门禁①结构性红 | 字面量补 D9(a) throw stub 一行（+同款注释；可选同步 section 注释「14 键面」→「15 键面」陈旧计数——R5）；**契约断言零改动**——该文件仍为 #369 负控基线且 33/33 保持全绿（SA3 V6 实测：仅类型程序需要成员在场，运行时断言不触 watchMap） | 恰一行 stub（+可选注释两处） | §2.13⑨；`-test-tsc2.log`；SA3 V6（`artifacts/sa3-issue387-affected-suites.log`） |
| **`ws-replication/src/testing.ts` `decorateLease` 装饰器（B-1⑩；iteration 2 新入账）** | `decorateLease(…): NamespaceLease` 返回 `Object.freeze({…15 成员全部 `.bind(lease)` 透传…})`（L38 签名 / L44 起）——iteration 1 判「lease 侧无第二实现点」**被实现否决**：加必填成员即 TS2741（根 `pnpm typecheck` 唯一红 = 该文件，`artifacts/sa3-issue387-root-typecheck.log`） | 补一行 `watchMap: lease.watchMap.bind(lease),`（D9(b)：装饰器诚实透传，与其余 15 成员同款）；wire 帧/协议/导出面零改动；ws-replication 测试行为零变化（均不调用 watchMap） | 恰一行 | §2.13⑩/§2.14；`-root-typecheck.log` |
| `registry-data-interface.test-d.ts` 等 lease/runtime 类型面既有断言 | 结构引用（`NamespaceRuntime['readData']` 等具名成员索引；无 `keyof NamespaceRuntime`/`keyof NamespaceLease` 穷举——全树 grep 实证） | 具名成员索引不受加成员影响、保持绿；**结构性接口满足点（十处 + runtime.ts/lease.ts 本体）除外**——iteration 0 「接口纯加成员不破坏既有引用」的绝对化断言**撤回并收窄**为：具名成员索引与成员存在性断言不受影响，必填成员的结构性实现点必须同步（F-1；iteration 2 扩至返回类型注解与装饰器形态——B-2） | 十处如上行；runtime.ts/lease.ts 本体已在 ALLOW | §2.13/§2.14 grep（17 处 `NamespaceRuntime['…']` 全为具名成员；`okLease` 全族为 `as` 收窄、`proxyLease` 为原型委托——均非结构点，编译器实证） |
| 既有 readData / 窗口读 / 复制面消费者 | 零改动（NC1/NC3 冻结面） | 零改动（本设计不触这些面；值导出面不变——registry 九键 / runtime 一键审计不受 type-only 追加影响；#369 契约 L203–209 为成员存在性断言非键集断言 → runtime 15 键下保持绿）——**唯一例外即上两行**（⑨⑩ 的类型面一行同步，SA3 B-2 澄清后的精确表述） | 除 ⑨⑩ 外无 | `registry-surface.test.ts` L56–97（值导出审计）；`runtime-acceptance-exports-audit.test.ts`；#369 契约实读 |
| 生产装配 / apps（无既有 watch 消费者） | 能力缺席 | 新能力可用；无迁移 | 无 | SA6 §5（零 watch 名目） |

## 11. 文件范围

**同路径重叠优先序（iteration 2 新增纪律）**：当 ALLOW 行与 DENY 行覆盖同一路径时，
ALLOW 行**精确列出的改动形态**（逐行级）优先；DENY 继续管辖该路径的其余一切改动。本节
⑨⑩ 两行即依此纪律对原 DENY 覆盖域做**最小、逐行级、纯类型面**的改判。

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/namespace-runtime/src/watch-map.ts` | **新增**：`createWatchHub`（簿记/建立状态机〔含 ③b ROOT 载体门〕/事件推导/真变判定/队列与泵/关停；容量单参数位默认 16——O-1）+ `captureRootMap` 容错捕获 + 三类型定义 | §8-B/C/D/E/G（含 D10）的唯一新实现载体（runtime 分层职责，ADR §7） |
| `packages/namespace-runtime/src/runtime.ts` | 第 15 键 `watchMap`（接口 + 字面量）+ hub 构造 + `closeAfterFence` 并置 `watchHub.shutdown()` | §8-G |
| `packages/namespace-runtime/src/errors.ts` | append-only：`WATCH_MAP_CARRIER_MISMATCH_CODE` / `WATCH_MAP_SCHEMA_UNAVAILABLE_CODE` 常量 + `WatchMapError` 类（不进 index） | B-3/B-4 稳定码注册表归属（该文件即「稳定 code 注册表」；§7-D7；③b 复用 CARRIER_MISMATCH 码**不新增条目**——D10） |
| `packages/namespace-runtime/src/index.ts` | type-only 追加三 watch 别名（值导出面仍恰一键） | B-5；#369 同款 |
| `packages/namespace-registry/src/types.ts` | `NamespaceLease` + `watchMap` 成员；三 lease 别名 | §8-A/F |
| `packages/namespace-registry/src/lease.ts` | `watchMap` 实现（released throw + 透传 + 登记）+ `activeWatches` + doRelease 清理 + 五条 Equal 锁（入 `LeaseTypeAssertions`） | §8-F |
| `packages/namespace-registry/src/index.ts` | type-only 追加三别名 | B-5；「公共 API 仅经 src/index.ts」 |
| `packages/namespace-registry/test/registry-open.test.ts` | ① lease 键集守卫 15 → 16（数组 +`'watchMap'` 行 + 注释）；② 同文件 `makeRuntime` 字面量补 D9(a) throw stub（+注释）——结构实现点⑧ | P1/AC10（键集）；§2.13⑧（替身；同文件双义务一次清偿） |
| `packages/namespace-runtime/test/runtime-registry-internal-seam.test.ts` | runtime 键集守卫 14 → 15 | SA6 §10 预判项 |
| `packages/namespace-runtime/test/runtime-phase5-reset-fence-r2.test.ts` | runtime 键集守卫 14 → 15（+可选 it 标题陈旧计数措辞同步——R5） | 同上 |
| `packages/namespace-runtime/test/runtime-close-lifecycle.test.ts` | runtime 键集守卫 14 → 15（+`'watchMap'` 一行；可选同步 it 标题陈旧「十二键」计数措辞；负向事件订阅词审计 L177–182 **不动**） | **F-1**：第 4 处键集断言（§2.12），iteration 0 漏记 |
| `packages/namespace-registry/test/registry-idle.test.ts` | 结构桩 `ObservableRuntime` 补最小 `watchMap` 成员（D9(a)：throw stub + import；#369 readArray/readMap stub 同款式） | **F-1**：`implements NamespaceRuntime` 桩（§2.13①），缺成员即测试树 tsc 红 |
| `packages/namespace-registry/test/registry-sa7-concurrency.test.ts` | 同上（`CountingRuntime` 桩） | **F-1**：同上（§2.13②） |
| `packages/namespace-registry/test/registry-sa7-hostile.test.ts` | 同上（`ObservableRuntime` 桩） | **F-1**：同上（§2.13③） |
| `packages/namespace-registry/test/registry-sa7-rev1.test.ts` | 同上（`ObservableRuntime` 桩） | **F-1**：同上（§2.13④） |
| `packages/namespace-registry/test/registry-shutdown.test.ts` | 同上（`ObservableRuntime` 桩） | **F-1**：同上（§2.13⑤） |
| `packages/namespace-registry/test/registry-readdata-budget-passthrough.test.ts` | 全量字面量桩补一行 `watchMap` throw stub（D9(a)；免 import） | **F-1**：`: NamespaceRuntime = {` 桩（§2.13⑥） |
| `packages/namespace-registry/test/registry-readdata-projection-text-red.test.ts` | 同上 | **F-1**：同上（§2.13⑦） |
| **`packages/namespace-registry/test/issue-369-window-read-lease-contract-red.test.ts`**（iteration 2 新增） | `makeStubRuntime` 字面量补 D9(a) throw stub **恰一行**（+同款注释；可选同步 L864 section 注释「14 键面」→「15 键面」陈旧计数——R5）；**断言零改动** | **B-1⑨**：返回类型注解形态的结构实现点（§2.13⑨）——缺成员即测试树 tsc 红（`-test-tsc2.log`）；该文件保持 #369 负控基线（33/33 全绿，SA3 V6）——改的只是替身类型满足性，非被测行为 |
| **`packages/ws-replication/src/testing.ts`**（iteration 2 新增） | `decorateLease` 补 `watchMap: lease.watchMap.bind(lease),` **恰一行**（D9(b)：装饰器诚实透传）；导出面/wire 帧/其余成员零改动 | **B-1⑩**：lease 侧第二结构实现点（§2.13⑩/§2.14）——缺成员即根 typecheck 红（`-root-typecheck.log`）；`ws-replication/tsconfig.json` include `src/**` 覆盖本文件 |
| `packages/namespace-registry/test/issue-387-watch-map-tracer-red.test.ts` | **可选**：E4 码断言升级为逐字（B-4 收紧授权，SA6 §12.1） | §7-B4 |
| `packages/namespace-registry/test/issue-387-watch-map-lease-surface.test-d.ts` | **可选**：追加 B-5 别名 Equal 锁（授权项） | §7-B5 |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/namespace-runtime/src/{write,schema-write,replication-write,replication-session,sequencer,close,p0,status,projection,plain-data,read-schema-projection,window-read,diagnostic,internal,schema-rearm}.ts` | 信号推导改为槽内/信封驱动会触碰写槽与 sequencer；schema re-arm 终止编排属 T3 | 冻结面（§12.6-1：读/窗口读/复制面/诊断日志/wire/持久化零改动）；本设计事件驱动零触碰；sequencer FIFO 链形逐字节不动（O-6 采纳：枚举补 `schema-rearm.ts`——runtime src 实际 18 文件，枚举完整性防「未列出即未禁」歧义；`replication-session.ts` L355「恰十二键」陈旧注释同不触碰——R5） |
| `packages/namespace-registry/test/issue-387-watch-map-fixture.ts` | B-2 冻结 = SA6 默认绑定 | 适配器单点无需改动；改之即偏离冻结 |
| **`packages/namespace-registry/test/issue-369-*.ts` 与既有 #369/复制面/诊断契约族**（iteration 2 改判） | 负控基线（NC1/NC3 承重——保持绿证明零回归） | **断言与被测行为零改动**；iteration 1「无需也无法改」的事实前提已被实现否决（SA3 B-1⑨/B-2）——**唯一例外** = `issue-369-window-read-lease-contract-red.test.ts` 内 `makeStubRuntime` 的 D9(a) 结构桩成员同步（§11 ALLOW 对应行，逐行级改判：恰一行 stub + 注释；该文件 33/33 保持全绿）；族内其余文件（`issue-369-window-read-fixture.ts` 经工厂委托、非结构点）零触碰 |
| **wire / 协议 / 持久化包**（`packages/ws-replication`〔除下述例外〕、`replication-protocol`、`persistence`、`dsh-persistence`、`instance-replication-v1.md`） | 复制 wire 帧/错误码/reason 冻结；持久化格式冻结 | **唯一例外** = `packages/ws-replication/src/testing.ts` 装饰器的类型面同步（§11 ALLOW 对应行，逐行级改判：恰一行透传；testing.ts 不进 `src/index.ts` 生产 API——文件头自证）；其余一切 wire/协议/持久化路径零触碰；导出面不变 |
| `packages/namespace-registry/src/{registry,plugin,observer,identity,create-document,create-diagnostic,diag-pump,testing}.ts`、`packages/namespace-registry/src/errors.ts` | lease 透传不需要 registry 编排/seam 注入；registry 错误类无需新码（watch 拒绝经 runtime 透传 throw） | §7-D5/D6 最小接线；避免 import 图与 deps 面增长 |
| `docs/**`、`CONTEXT.md`、`wiki/raw/task_issue-387*.md`（除本设计产物自身；SA2 评审/SA3 实现报告/SA6 契约/SA8 复审为只读输入） | 文档面 = T5 #391；CONTEXT「变更订阅」词条已在 HEAD 且与本设计一致（含「本地写 / 复制 apply 全覆盖」——与 D8 一致） | SA6 §10「本票零文档改动」 |
| `vitest.config.ts`、`package.json`（两包及 ws-replication） | 采集面与导出面不变 | 契约文件已被 runner 实命中（SA6 §14）；type-only 不触 exports；testing.ts 改动为成员行非导出面 |

## 12. 验收与验证映射

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1/T1/E1 能力存在 + 恰 `{unsubscribe}` | 红于 `typeof undefined` | 已落盘（`tracer-red.test.ts`） | `typeof lease.watchMap === 'function'`；句柄键恰 `['unsubscribe']` |
| AC1/E2 载体面（Y.Map + plain object + 封闭 map） | 红 | 已落盘 | 三形态建立成功（schema 侧判定，§8-B⑤） |
| AC1/E3 数据缺席合法 | 红 | 已落盘 | 未物化 `ghost` 与已删除 `optionalTasks` 建立成功（纯 schema 判定天然成立；③b 不触发——map 形 ROOT 下捕获成功，D10 分界） |
| AC2/E4 无 active schema 整体拒绝 | 红（同场阳性对照加固） | 已落盘；可选逐字收紧 | throw code `WATCH_MAP_SCHEMA_UNAVAILABLE`（B-4） |
| AC3/E5 CARRIER_MISMATCH 三例 + message 区分 | 红 | 已落盘 | 数组/标量/偏离三例同码异 message（§8-B 文案表） |
| AC3/E6 通知流零参数错误 | 红 | 已落盘 | kind ∈ 三 kind 闭集 |
| AC4/N1–N4 定位符（恰两键、不含值、同构窗口读、嵌套归 key、横跨创建） | 红 | 已落盘 | C-1/C-2 分支 + 哨兵不外泄 + `[...path,key]` readData 回环 |
| AC5/B1/B2/P2 一事务一通知、同 key 合并、FIFO、无效写零通知 | 红 | 已落盘 | §8-C 聚合去重；零事务零事件 |
| AC6/D1/D2 槽外异步分发 | 红 | 已落盘 | §8-E 泵（同步段零回调；重入写接纳完成） |
| AC7/X1 回调 throw 隔离 | 红 | 已落盘 | §8-E 逐 listener 吞没；写结果与其余订阅不受影响 |
| AC8/L1/L2 退订幂等零通知、lease 释放清理 | 红 | 已落盘 | §8-E unsubscribe + §8-F doRelease 清理；双屏障零通知 |
| **③b ROOT 载体门（D10，iteration 2 新增）** | frozen 契约在树：`runtime-p0-sequencer.test.ts` AC5（L148）——异型 ROOT（Y.Text）构造照常 ready；SA3 A-1 首跑红实证字面「构造期挂接」违反之 | 既有 P0 契约即回归锚点（无新增断言授权） | P0 文件全绿（SA3 V6b：7/7——`artifacts/sa3-issue387-p0-and-contract.log`）；异型 ROOT 文档上 `watchMap` → 同步 throw `WATCH_MAP_CARRIER_MISMATCH` + ROOT 载体 message（fail loud；实现已落，行为断言属 §12 非目标边界外既有面） |
| AC10/P1/NC1 纯加法 + 冻结面 | NC1 绿 / P1 红 | 已落盘 + **四处键集守卫更新**（F-1） | lease 恰 16 键（registry-open L924 起）；runtime 恰 15 键（internal-seam / phase5-reset-fence / close-lifecycle 三处审计一致）；readData/窗口读行为零改动 |
| **AC10/AC9 影响面完整性（F-1 + B-1；iteration 2 计数）** | §2.12/§2.13/§2.14（**四处键集 + 十结构实现点**，五类检索模式 + 逐文件实读 + **编译器仲裁**）；实现轮实测：七桩+⑧ 补齐后门禁①余恰 2 处 TS2741（⑨⑩）、门禁③余恰 1 处（⑩） | 实现后门禁命令：① `npx tsc -p tsconfig.typecheck.json --noEmit`（测试树类型门，SA6 R10 同命令）；② 根 `pnpm test`（`vitest run --typecheck`）；③ 根 `pnpm typecheck`（14 包 src 树） | ① exit 0（**十处**补齐后测试树零 TS 错误；不补则 TS2741×**10** 结构性红——iteration 2 实测插值：补七桩+⑧ 后余恰 ⑨⑩×2 = `artifacts/sa3-issue387-test-tsc2.log`）；② 全网零红——实测行为面已 4753/4753 全绿、`Type Errors: no errors`，唯一非零来源 = ⑨⑩ 的 2 处源文件类型错（`Errors 2`、exit 1 = `-root-test-final.log`）；⑨⑩ 一行修复后预期 `Test Files 394 passed / Tests 4753 passed / Errors 0 / exit 0`；③ exit 0（不补 ⑩ 则 TS2741×1 = `-root-typecheck.log`）；`Object.keys` 审计四处 = lease 16 / runtime 15 |
| AC9 三件套 | 已落盘且 runner 实命中（SA6 §14）；实现轮实测 21/21 转绿（`-contract-run2.log`，实现前 20 红 / 1 绿 = `-red-baseline.log`） | 实现后转绿 | `vitest run` 两契约文件全绿；根 `pnpm test` 零非契约红 |
| 类型面 | 类型契约红 6 处 | 已落盘（§8-A 对偶推演全过） | `--typecheck` 模式零 Type Errors；实现轮实测目标文件 2 passed / no errors（`-type-contract.log`——run 整体 exit 1 非契约断言，为 ⑨⑩ 源文件错，见上行） |
| **复制来源通知（F-2 澄清面）** | 无（T1 fixture 无复制面；本票**不新增断言**——越界 = SA6 非目标「`origin:'replication'` 与 watch-end（T3 #389）」） | T3 #389 交付：经 `openReplicationSession` + `applyRemoteUpdate` 驱动 peer apply 触及订阅容器 → `data` 通知 `origin:'replication'`；本地写恒 `'local'`（#389 AC1 原文） | T1 交付态（无过滤、无断言）：复制启用中的 namespace 上 peer apply 触及订阅容器 → 收到 `origin:'replication'` 的 data 通知（机制结构性在产——D8；T1 契约不证此面） |
| 溢出降级 / watch-end（T4/T3 前瞻） | 无（非 T1 验收） | 本票不新增断言（越界 = SA6 非目标） | 实现常量容量 16（`createWatchHub` 单参数位）+ invalidate-all 语义在产（§8-E） |

## 13. 风险、回滚和残余问题

| # | 风险 / 残余 | 等级 | 处置 |
|---|---|---|---|
| R1 | **observer throw → DOCRT-E203 写 fatal（永久禁写）**——最高风险路径 | 高 | §8-C 硬红线：handler 整体 try/catch 吞没；实现期以「handler 任意内部 throw 不改变写结果」为 review 检查项（X1 已含行为锚）；O-5 采纳登记：T4 #390 交付 testing 工厂注入时补「handler 内注入 throw → 写结果不变」故障注入用例，使红线可锚 |
| R2 | 泵微任务让步常数与既有 fanout 的公平性论证耦合（20 为 load-bearing 常数区间 [16,24]） | 中 | 直接复用同常数与同泵形（§8-E）；不新造数值 |
| R3 | Y 载体条目整值同写不触发精确过滤（保守通知） | 低 | ADR §5 授权（宁多勿漏：多拉一次可接受）；精确双投影比较登记为后续精化项（须过设计评审——词表演进面），**非本票必要条件**；O-2 采纳登记：实现期将深比较收在 watch-map.ts 单点并以注释与 `mutation.ts` `logicalValuesEqual` 互指，防三处（mutation/plain-data/watch）漂移 |
| R4 | union 值形态容器被拒（非键容器 message） | 低 | §7-D3 已知限制；T1 fixture 无 union；开放演进须过设计评审 |
| R5 | runtime 15 键面与历史计数措辞漂移（close-lifecycle L155 it 标题、phase5 L127 it 标题、`replication-session.ts` L355 注释——三处现存「十二键」字样 vs 实际 14 键；**iteration 2 增**：issue-369 契约 L864 section 注释「14 键面」 vs 15 键） | 低 | 测试侧标题/注释可选同步（close-lifecycle / phase5 / issue-369 三处均在 ALLOW；纯计数措辞，断言以数组为准）；`replication-session.ts` 在 DENY、注释不动；docs/** 零触碰 |
| R6 | 回滚 | — | 纯加法：撤销 = 移除 watch-map.ts + 两公共键 + 四守卫回退 + 十实现点摘除 watchMap 成员（七桩 + ⑧⑨ stub 行 + ⑩ 透传行）；无数据/wire/持久化迁移，零回滚协调 |
| R7 | follow-up（明确非本票）：T2 谓词加宽（options + `WATCH_MAP_OPTIONS_INVALID`）、T3 replication origin 验收编排 / watch-end、T4 溢出注入与父路径删除编排、T5 文档面 | — | 各有其票（#388/#389/#390/#391）；本设计 §8 的类型三 kind 联合与 D8 origin 分类（无过滤）为其预留非破坏性接缝——**T3 无需拆除任何 T1 面**（F-2 读法 A 的直接收益） |
| R8 | **结构实现点维护债（F-1 引入面、B-1/B-2 扩面；iteration 2 修订）**：`NamespaceRuntime`/`NamespaceLease` 每新增必填公共成员，**十处**结构实现点 + 四处键集断言必须同步，否则测试树 tsc 红 / 根 typecheck 红 / 键集红；且实现点形态不止 `implements`/字面量赋值——**返回类型注解 + return 字面量**（⑧⑨）与**装饰器包装**（⑩）同样入账 | 低 | 该债为**期望行为**（编译红即公共面漂移的响亮信号，非静默）；本票以 §2.12/§2.13/§2.14 全清单入 ALLOW 一次性清偿；**后续票守卫模式升级**（B-2 教训）：检索面 = 五类模式（`implements` / `: T = {` / `satisfies` / `): T` 返回注解 / 装饰器包装），**最终仲裁 = 编译器**（`tsconfig.typecheck.json` + 根 `pnpm typecheck` 双门禁跑通才算清单完整——grep 只是线索，iteration 1 即因 grep 模式不完备漏 3 处）；⑩ 提示 lease 面增长时 ws-replication 装饰器亦是同步点（T3 #389 驱动 replication 断言时将复用该 harness——透传形态已为其留好真实行为面，D9(b)） |
| R9 | T1–T3 间静默窗（O-4 采纳登记）：订阅跨 `replaceSchema`（含带 `root` 全量重物化）存续且无信号（watch-end 属 T3、容器级事件属 T4 C-3）——消费方在 T1 交付态可能持有过时 schema 口径数据 | 低 | 属已声明的分期边界（§1 非目标、§8-C C-3、SA6 §12.1）；T5 #391 文档面交付消费指引（「T1 切片不建议与复制/schema 变更并存使用」——登记防丢失，非本票文档改动） |
| R10 | **异型 ROOT 文档上的订阅面缺席（③b/D10 引入面）**：doc 数据级损坏态（ROOT 同名异型载体）上 `watchMap` 恒 CARRIER_MISMATCH——T1 无该形态的行为断言（frozen P0 契约只锚构造照常 ready） | 低 | fail loud 语义（专属 message 可区分）+ P0 契约回归锚点已覆盖构造面零破坏；行为断言属 §12 非目标边界（fixture 不构造异型 ROOT 文档）；若后续需验收，经 T4/T5 票过设计评审补——非本票必要条件 |

## 14. 评审修订映射

### iteration 1（SA2 评审，verdict reject → 整改后复审 approve）

评审输入：`wiki/raw/task_issue-387_sa2_review.md`（2 × MAJOR，0 × BLOCKER；7 项非阻断观察
O-1–O-7）。逐条处理结果（F-1 的清单在 iteration 2 被 SA3 B-1 进一步补全——见下表）：

| Finding | 修订位置 | 处理结果 |
|---|---|---|
| **F-1（MAJOR）**：runtime 接口必填成员 + 第 15 键的实际爆炸半径漏记 8 文件（1 精确键集断言 + 7 结构桩） | §2.12/§2.13/§7-D9/§10/§11/§12/§13-R8/§6（SA8 §8-1 计数修正行） | **已落实（iteration 1）**；**iteration 2 增补**：SA3 实现轮以编译器仲裁证明该清单仍漏 3 处（⑧⑨⑩——检索模式未含返回类型注解与装饰器形态），已按 B-1 补全为十处并更新全部计数（§2.13/§2.14/§10/§11/§12/§13-R8）——SA2 的 8 文件清单在其检索模式内精确，模式本身不完备 |
| **F-2（MAJOR）**：T1 对复制 apply 事务是否产出通知无唯一答案 | §1/§7-D1②/D8/§8-A/C/E/§12/§6/§13-R7（择读法 A 无过滤，全文唯一陈述） | **已落实**。修订后设计对 SC-8 给出唯一可实现答案：收到 data 通知，`origin === 'replication'`（无过滤；D8）；与 ADR 0030 §4/§5/§6 及 CONTEXT L66 零冲突 |
| O-1（T4 注入预留：容量单参数位） | §8-E、§11（watch-map.ts 行） | 采纳：`createWatchHub` 单一构造参数位（默认 16），T4 注入为纯加法 |
| O-2（深比较第三副本单点化 + 互指注释） | §13-R3 | 采纳登记：实现期单点化 + 与 `mutation.ts` `logicalValuesEqual` 注释互指 |
| O-3（空路径订阅边界显式承认） | §7-D3 末段、§8-B⑤ | 采纳：`watchMap([])` 合法 + C-1 产出 `{path: [], key}` 显式写明；实现期注释落一句，不加断言不扩面 |
| O-4（T1–T3 静默窗消费指引） | §13-R9 | 采纳登记：T5 #391 文档面交付「T1 切片不建议与复制/schema 变更并存使用」指引 |
| O-5（R1 红线可测性：故障注入用例） | §13-R1 | 采纳登记：T4 #390 testing 工厂注入交付时补「handler 内注入 throw → 写结果不变」用例 |
| O-6（DENY 枚举补 `schema-rearm.ts`） | §11 DENY runtime src 枚举 | 采纳：补列（本票不触；枚举完整性防「未列出即未禁」） |
| O-7（B-4 message 括号枚举补 fatal） | §8-B message 文案表 | 采纳：枚举改为 `legacy/preparing/unavailable/fatal 期` + p0.ts L140–147 实证锚点 |

### iteration 2（SA3 实现报告，verdict **reject：范围不足**——本轮修订依据）

评审输入：`wiki/raw/task_issue-387_sa3_impl.md`（iteration 0 实现轮）。逐条处理：

| Finding | 修订位置 | 处理结果 |
|---|---|---|
| **B-1①**：`registry-open.test.ts` `makeRuntime` 返回字面量为结构实现点（路径在 ALLOW，实现轮已修） | §2.13⑧（入账 + 已修状态）、§10（registry-open 行改双义务）、§11（registry-open 行改双义务） | **已落实**：入账为十清单第⑧位；实现轮已在 ALLOW 内修复（watchMap throw stub 现于 L191）并复跑（V4 首轮 3 错 → 修后 2 错，`-test-tsc2.log`）——本设计对该文件的键集 + 替身双义务合并表述 |
| **B-1②**：`issue-369-window-read-lease-contract-red.test.ts` `makeStubRuntime` 为结构实现点，且原 DENY 行「无需也无法改」事实前提被否决 | §2.13⑨、§10（新行）、§11（ALLOW 新行 + DENY `issue-369-*` 行改判）、§12（门禁①②计数与实测插值） | **已落实**：ALLOW 新增该文件行——恰一行 D9(a) throw stub + 注释（可选 L864 计数注释同步）；DENY 行改判为「断言零改动 + 逐行级例外指向 ALLOW 行」（同路径重叠优先序纪律，§11 头部）；负控基线语义不变（33/33 保持全绿——SA3 V6 实测） |
| **B-1③**：`ws-replication/src/testing.ts` `decorateLease` 为 lease 侧第二结构实现点，原 ALLOW 外 | §2.13⑩、§2.14（重写）、§10（新行）、§11（ALLOW 新行 + DENY wire/协议/持久化行改判）、§12（门禁②③） | **已落实**：ALLOW 新增该文件行——恰一行 D9(b) 透传 `watchMap: lease.watchMap.bind(lease),`；DENY 行改判为「唯一例外 = testing.ts 类型面同步，逐行级」（§11 头部优先序）；wire 帧/导出面零改动（testing.ts 不进生产 API——文件头自证） |
| **B-2**：§2.14「lease 侧无第二实现点」与 §10「issue-369-* 契约族零改动」两处事实陈述被实现否决；检索模式漏「返回类型注解 + return 字面量」与「装饰器包装」 | §2.13（检索模式扩为五类 + 非结构点排除依据）、§2.14（撤回重写）、§10（「零改动」行拆出 ⑨⑩ 两例外行）、§13-R8（守卫模式升级：编译器为最终仲裁） | **已落实**：两处陈述撤回并改写；本轮独立复检（五类模式全树 grep + 逐文件实读 + 编译器日志对账 + 工厂委托/`as` 收窄/原型委托三类非结构点排除）确认十处清单完备——剩余 grep 命中经编译器实证零 TS2741 |
| **A-1**：设计 §8-G「构造期挂接 ROOT observeDeep」字面实现与 frozen 契约 P0 AC5 冲突（异型 ROOT 构造即抛）；实现轮修复 = `captureRootMap` 容错捕获 + 建立门 ③b | §2.15（P0 AC5 锚点 + ADR 0008 权威）、§7-D10（新决策，含三个否决备选）、§8-B（③b 门 + ROOT_CARRIER_MESSAGE 文案位）、§8-G（容错捕获 + 条件挂接 + shutdown 守卫）、§9（六拒绝位）、§12（③b 行 + P0 回归锚点）、§13-R10 | **已吸收为设计冻结**（preserve implementation semantics）：③b 与 D3 的分界写明（doc 级载体事实 ≠ 容器级 live 探测；缺席容器无载体，③b 不触发，E3 判定面零触碰）；复用 `WATCH_MAP_CARRIER_MISMATCH` 码不新增注册表条目（append-only 纪律保持）；P0 文件 7/7 全绿为回归锚点（SA3 V6b） |
| SA3 最小整改请求 1（ALLOW 增两行） | §11 ALLOW（issue-369 契约文件行、ws-replication testing.ts 行） | **已采纳**（逐字对齐其请求的改动形态，并补 D9(a)/(b) 冻结依据与「恰一行」边界） |
| SA3 最小整改请求 2（DENY 两行改判） | §11 DENY（`issue-369-*` 行、wire/协议/持久化包行）+ §11 头部同路径重叠优先序 | **已采纳**（改判措辞以「断言零改动 / 导出面不变」为不变量、逐行级例外指向 ALLOW） |
| SA3 最小整改请求 3（计数修正：十处结构实现点 + lease 第二实现点 + 门禁①×10） | §2.13/§2.14/§10/§12 | **已采纳**（§12 门禁①「不补则 TS2741×10」+ 实现轮实测插值；§2.14 重写） |
| SA3 最小整改请求 4（§15/SA8 §8-4 复查清单同步） | §6（SA8 §8-1 计数行 iteration 2 再修正 + ALLOW/DENY 改判行 + ③b 行）、§15（新增复查理由 4/5） | **已采纳**（SA8 §8-4 清单②按十处清单执行；范围改判与 ③b 失败语义入复查理由） |

## 15. 是否需要设计后 ADR 冲突复查

**需要（`requiresConflictRecheck: true`）**，理由（对照 skill 触发条件 + iteration 2 修订增量）：

1. **公共 API 变化**：lease 15 → 16 键、runtime 14 → 15 键、两包 index type-only 追加——
   受键集守卫与 exports 审计冻结的公共面增长（守卫同步更新在 ALLOW LIST，但冻结面的
   任何增长都应过冲突门复核无与其他在途决策的交错）。SA8 设计后复审（在场）§10 已按
   此标 true 且列实现后复查清单（其 §8-4）——本设计 §2.12/§2.13/§2.14 的 F-1/B-1 修订
   清单（**四处键集 + 十结构实现点**）**取代其 §8-1「两文件三处」与 iteration 1 的
   「四处 + 七桩」两代计数，复查按十处清单执行（SA8 §8-4 清单②同此）。
2. **F-2 origin 产出语义修订（iteration 1 理由，维持）**：D8 把 iteration 0 的「T1 只产
   `'local'`」修订为「无过滤全事务推导（复制启用 namespace 上 peer apply →
   `origin:'replication'` data 通知为 T1 交付态行为，契约只断 `'local'`）」。该修订与
   ADR 0030 §4/§5/§6 条款本身一致（§6「全覆盖……三种来源」原文），但**改变了 SA8 设计后
   复审第 6 行所评的范围陈述**——须在重审中对照 ADR §6 全覆盖条款与 T3 #389 边界复核该
   读法（本设计不以自行解释代替冲突门裁决）。
3. **新失败语义与码注册（iteration 1 理由，维持）**：`WATCH_MAP_SCHEMA_UNAVAILABLE`
   （B-4）与 `WatchMapError` throw 面为 append-only 码注册表新增；B-2/B-3 属对 ADR 0030
   文本缺口（回调位省略、拒绝面未冻结）的**解释性冻结**而非 ADR 修订——SA8 设计后复审
   已裁决三项（第 2/5/10 行）为缺口实例化/窄读一致，维持该结论待重审确认。
4. **ALLOW/DENY 范围改判（iteration 2 新增）**：⑨（原 DENY 明文行）与 ⑩（原
   「wire/协议/持久化包」DENY 覆盖域）改判入 ALLOW——两处均为纯类型面一行同步、断言与
   行为零改动，但**改判本身触及 SA8 §8-1/§8-4 所列冻结面与复查清单的覆盖域**（SA3 报告
   同判 `requiresConflictRecheck: true`）；须在重审中确认负控基线（issue-369 契约 33/33）
   与 ws-replication 导出面不变式在改判后仍成立。
5. **③b ROOT 载体门（iteration 2 新增）**：新增建立拒绝分支（失败语义面）——虽复用既有
   稳定码 `WATCH_MAP_CARRIER_MISMATCH`（不新增注册表条目）且以 frozen 契约 P0 AC5 +
   ADR 0008「读取能力」节为依据，仍属 ADR 0030 §3 码族 message 词表的新实例化分支，
   实现后复查须核对其与「数据缺席合法」（AC1/E3）无语义冲突（D10 已给出分界论证）。

无 ADR 被修订或推翻（本设计忠实实现 ADR 0030 T1 切片；F-2 修订方向 = 更贴 ADR §6 原文；
③b = ADR §3 message 区分条款 + ADR 0008 读取能力节的联合推论）；CONTEXT「变更订阅」词条
（L65–67）与修订后设计一致（含「（本地写 / 复制 apply 全覆盖）」，本轮实读对账）。SA8
**前置**产物（`_relevant_decisions.md` / `_conflict_report.md`）缺席的缺口已由在场的 SA8
设计后复审（26 项 ADR 全集对照）替代闭合。

---

## 附：冻结结果对 SA6 §12.1 绑定表的回写对账

| SA6 绑定 | SA6 契约默认 | 本设计冻结 | 对账 |
|---|---|---|---|
| B-1 方法名/参数序/返回 | `watchMap(path, listener, options?) → {unsubscribe}` | `(path, listener) → {unsubscribe}`；options 槽位 T2 加宽 | 一致（T1 切片无 options；B-1 的 options 位属家族终态，T2 交付） |
| B-2 订阅回调绑定 | 位置参数第二参（SA6 必裁项） | **维持默认**：位置参数第二参、恰一参、返回 void | 一致——fixture/类型契约零改动 |
| B-3 拒绝面 | 面中性（throw 或信封） | **收窄为同步 throw**（`WatchMapError`，code+message） | 收窄不破坏断言（归一器本就收 throw 面）；类型契约 `_handleKeys` 为决定性依据 |
| B-4 无 schema 码 | 未命名（非空稳定 code） | **`WATCH_MAP_SCHEMA_UNAVAILABLE`** | 授权收紧 E4 为逐字断言（可选） |
| B-5 别名命名 | 未预设（结构推导） | **`Namespace{Runtime,Lease}WatchMap{Notification,Change,Handle}` 三对**；不设 Result/Options | 授权追加别名 Equal 锁（可选） |
| B-6/B-7 通知/定位符形状 | ADR 冻结 | 复核维持 | 一致 |
