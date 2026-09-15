# SA8 实现后冲突复查报告 — issue #388：谓词订阅与宁多勿漏判定（变更订阅 T2）

- 复审对象：**implementation**（未提交 diff：7 个 `src` 文件 +462/−49、3 个新契约测试文件；
  及其 SA3 产物 `wiki/raw/task_issue-388_sa3_impl.md`）
- 复审轮：2026-09-15（iteration 1；dispatch `sa-d45a4f7f-89b3-4bab-af48-90492e153d0a`）
- Worktree：`/home/wangjian/nomicore-fix-issue-388`（branch `mabf/issue-388`，HEAD `28faeae` ——
  与设计/SA2/SA6/SA3 基线同一 commit；`docs/adr/**`、`CONTEXT.md`、`docs/protocols/**` 相对
  HEAD 零 diff，规范基准未被实现触碰）
- 触发条件：设计 §15 `requiresConflictRecheck = true`（前置门禁同 flag）+ 实际 diff 触碰
  runtime/registry 公共 API 面与稳定码注册面——按技能「implementation 复查」运行
- 结论速览：**verdict = clear**；28 项对照 = 14 × implements-existing-decision +
  14 × no-conflict；0 hard-conflict；0 evolution-required；0 override；
  前置门禁六条 required actions 全部闭环；**requiresConflictRecheck = false**
  （本报告即实现后复查，其待核对项已逐项闭合）

---

## 1. Reviewed subject

**implementation**——issue #388 的已实现 diff（工作树未提交改动）及其 SA3 产物：

- `packages/namespace-runtime/src/{watch-map,errors,runtime,index}.ts`（+439/−53 区域）；
- `packages/namespace-registry/src/{types,lease,index}.ts`（+72/−15 区域）；
- 新契约三件套 `packages/namespace-registry/test/issue-388-watch-map-predicate-{fixture,red.test,surface.test-d}.ts`
  （fixture 433 行 / 行为 851 行 29 用例 / 类型 164 行 3 用例）；
- SA3 产物：`wiki/raw/task_issue-388_sa3_impl.md`（150 行；§5 验证 9 行证据 +
  `artifacts/sa3-issue388-verify-*.log` 8 份 + red/green 家族日志在场）。

SA4/SA9 产物：**不存在**（本轮 `ls wiki/raw | grep 388` 复核）——不构成本轮输入；
其后续若发现新决策面，属新触发条件。

## 2. Inputs and decision set

| 输入 | 状态 | 用途 |
|---|---|---|
| **实际 diff**（`git diff HEAD` + 未跟踪三件套；`git status --porcelain` 全量） | 在场（本轮逐 hunk 实读） | 被审对象 |
| `wiki/raw/task_issue-388_sa3_impl.md` | 在场（150 行全文） | 被审对象（实现自述 + 验证证据链） |
| `docs/adr/0030-change-subscription.md` | **规范权威**（已接受；HEAD 零 diff，本轮实读 107 行全文） | §2 词表 / §3 建立判定 / §5 宁多勿漏 / §6 分发 / §7 分层 / 备选 / 验收逐条款对照 |
| ADR 0008/0009/0010/0013/0022/0023/0025/0026/0027/0028、0011/0014、0016/0024 | 已接受（摘录承 `task_issue-388_relevant_decisions.md`） | 稳定码注册 / lease 生命周期 / 复制 wire 冻结 / 服务字面量冻结 / guard 信封 / readData 四键 / 窗口读面 / 诊断不混用 |
| `CONTEXT.md` L65–67「变更订阅」（含 `_Avoid_` 面） | 在场（本轮实读） | 术语一致性核对 |
| `packages/namespace-runtime/AGENTS.md`、`packages/namespace-registry/AGENTS.md` | 在场（本轮实读） | 模块决策面（sequencer FIFO / 槽外 / 公共 API 仅经 index / detached projections / root typecheck+test 门） |
| `wiki/raw/task_issue-388.md`（任务简报 AC1–AC8） | 在场 | 需求源对账 |
| `wiki/raw/task_issue-388_conflict_report.md`（前置门禁 clear + 6 required actions + 冻结面清单） | 在场 | 本轮闭环对照基准 |
| `wiki/raw/task_issue-388_design.md`（670 行 iteration 1，F-1–F-6 冻结） | 在场 | 实现绑定基准（SA8 不裁设计优劣，仅作语义对账基准） |
| `wiki/raw/task_issue-388_sa2_review.md`（iteration 1 复评 `approve`；SA2-1 已解决 + O1–O10） | 在场 | 评审面确认（调用面闭包 / 验证门） |
| `wiki/raw/task_issue-388_sa6_contract.md`（approve，500 行） | 在场 | 契约先例族对账（非 SA8 职权，仅缝口径核对） |
| `artifacts/sa3-issue388-verify-*.log`（8 份）+ red/green 家族 | 本轮 tail/grep 实读 | 证据充分性（exit code / 用例计数 / HEAD 同基线） |
| issue #388 owner feedback | **空快照**（dispatch 明示 REST comments read returned none；无 comment ID / updated_at） | 无 Owner override 权威在场 |

决策集状态核查：ADR 全集 28 篇均「已接受」，无整篇 superseded；0007/0016/0024 部分条款被
0008/0027 修订（被取代条款与本 diff 无接触面）。源码/类型/测试仅用于确认当前事实，不替代决策文本。

## 3. Decision analysis

对照单元 = 实际 diff 行为面（非设计意图）。每行引用决策路径与具体条款。

| # | Decision | Clause | Subject behavior（实际 diff） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0030 §2（L23–25） | 谓词词形封闭小集：`{ field, equals } \| { field, in }` | `NamespaceRuntimeWatchMapWhere` 联合恰两成员（`watch-map.ts` L107–110）；门⑥-b 运行时同判据收口（键集恰 `{field}` ∪ 恰一算子键） | **implements-existing-decision** | `watch-map.ts` L107–110、L318–361（`readWatchWhere`） | 无 |
| 2 | ADR 0030 §2（L27） | `field` 单段属性名；值域恒标量（string / number / boolean / 字面量） | `field` 必须 string；`equals` 值 / `in` 成员逐个 `isScalarValue`（string/number/boolean）；schema 侧域闭包（F-2）：`scalar{3 型}` / `enum`（字面量）/ `pattern` / `int` / `range` 接受，`object`/`array`/`xml`/一切 `union`/`scalar{null\|unknown}` 拒绝 | **implements-existing-decision** | `watch-map.ts` L364–376（`isScalarValueDomain`）、L273（field string 门）、L348–356（成员标量门） | 无（union 全标量成员拒绝 = ADR 未冻结处的 fail-closed 缺省，见 §6） |
| 3 | ADR 0030 §2（L29 前半）+ 备选（L82） | `in` 集合语义（顺序无关、去重）；`notEquals`/`and`/key 过滤不进词表 | `in` = 存在量词线性扫描（`values.some(m => Object.is(m, candidate))`）——顺序无关、去重自然成立；编译期按 SameValue 去重并深冻结；未知键（含 `notEquals`）一律 shape 拒绝 | **implements-existing-decision** | `watch-map.ts` L538–545（`matchPredicate`）、L416–424（⑥-d 去重冻结）、L322（未知键拒绝） | 无 |
| 4 | ADR 0030 §2（L29 后半）+ §3（L37） | `in` 空数组响亮拒绝（对齐 `WINDOW_OPTIONS_INVALID` 规则非法拒绝风格）→ `WATCH_MAP_OPTIONS_INVALID` | `values.length === 0` → 专属 cause `'empty-in'` → `PREDICATE_IN_EMPTY_MESSAGE` 同码 throw | **implements-existing-decision** | `watch-map.ts` L357（空数组分支）、L175–177（message 常量） | 无 |
| 5 | ADR 0030 §2（L28） | 缺失 / null 恒不匹配，所有算子一视同仁；NULL 三值逻辑不存在 | `readMemberScalar`：缺失/null/对象/Y 载体/非标量一律 `undefined`；`matchPredicate` 对 `undefined` 恒 false——两算子同路径，无 NULL 特例 | **implements-existing-decision** | `watch-map.ts` L500–516（`readMemberScalar`）、L527（undefined → false） | 无 |
| 6 | ADR 0030 §2（L30–31） | 不做 `and` / key 级过滤；新增算子属词表演进须过设计评审 | 词表零加宽：类型面 excess property + 运行时未知键拒绝双收口；无组合子、无 key 参数 | no-conflict | `watch-map.ts` L322；surface 契约 9 条 `@ts-expect-error` 负例 | 无 |
| 7 | ADR 0030 §3（L35） | 无 active schema 的 namespace 整体不可用 watchMap（含无谓词形态） | T1 门③ 原样在场且先于谓词门（`state.schemaState !== 'ready'` → `WATCH_MAP_SCHEMA_UNAVAILABLE`）；谓词门 ⑥ 在其后——无回退 | no-conflict（T1 义务延续，实现未触碰） | `watch-map.ts` L764–767（门③）/ L793–796（门⑥ 位置）；契约 NC3 行（schema 门先于谓词门）锚定 | 无 |
| 8 | ADR 0030 §3（L36） | path 非键容器（偏离 schema / 数组载体）→ `WATCH_MAP_CARRIER_MISMATCH`（message 区分原因） | T1 门③b/④/⑤ 原样在场（ROOT 载体 / path 快照 / `resolveCarrierKind` 分类）；`resolveCarrierKind` 重构为 `chaseValueSchema` 包装但语义恒等（`undefined → 'unknown'`） | no-conflict（T1 义务延续；重构等价性本轮实读） | `watch-map.ts` L227–233（`resolveCarrierKind` 包装）、L768–792（③b/④/⑤ 原序） | 无 |
| 9 | ADR 0030 §3（L37） | 谓词非法三情形 → `WATCH_MAP_OPTIONS_INVALID` | field 不存在（L398）/ 条目无统一值域（L394/L396 两分支）/ 非标量域（L401）+ 形态族与 `in` 空数组（行 4）→ 同码六 cause，message 互相可区分、零 path/field/值回显 | **implements-existing-decision** | `watch-map.ts` L393–401、L163–189（六 message 常量，本轮逐条复读——泛化文案、无回显） | 无 |
| 10 | ADR 0030 §3（L38） | 数据缺席合法：纯 schema 侧判定，零 live 载体探测 | 门⑥-c 仅消费门⑤ 已得 `resolved.valueSchema` + `resolved.aliases`（`compileWatchPredicate` 全函数零 `.get()` / 零 doc 访问）；`ghost?` 缺席容器可订阅（契约 E9 行锚定） | **implements-existing-decision** | `watch-map.ts` L379–401（⑥-c 全文实读——参数仅 schema 对象与别名表） | 无 |
| 11 | ADR 0030 §3（L39） | 全部参数校验在建立时刻完成——建立后通知流零参数错误 | ⑥-d 编译冻结谓词（`Object.freeze` 深冻结快照，绝不保留调用方对象）；通知路径只读 compiled 谓词（field 字符串 + 冻结值集），结构上零参数再校验、零参数错误 | **implements-existing-decision** | `watch-map.ts` L404–424（⑥-d）、L519–545（通知路径纯读） | 无 |
| 12 | ADR 0030 §5（L57 前半） | 同值写过滤：载体 delta 存在但条目投影值未变 → 语义投影比较过滤 | T1 `isRealChange` 前置原样（`collectChanges` C-1 逐键先过真变判定再进谓词层——`if (!isRealChange(...)) continue`）；`isRealChange`/`plainDataEquals` 本体零改动 | no-conflict（T1 判定原样延续，谓词层只在其后合取） | `watch-map.ts` L600–601（前置保留）、L466–495（isRealChange 区域 diff 零触碰）；契约 N5 行 | 无 |
| 13 | ADR 0030 §5（L57 条件式） | 通知 ⟺ 真变 ∧（无谓词 ∨ 新旧匹配态任一成立 ∨ 旧态不可判保守） | `predicateKeepsContainerChange` 判定表逐支实现：`add` → `newMatch`（旧态=缺席恒不匹配，可判精确）；`update` plain oldValue → `oldMatch ∨ newMatch`；`update` live 载体 → 保守；`delete` plain → `oldMatch`；`delete` live → 保守 | **implements-existing-decision** | `watch-map.ts` L547–573；契约 N3/N4/N7/N8/N9/N9b/N10/N10b 行锚定（首红行 N7/N8/N9 于 HEAD 红、实现后绿——`verify-red-repro.log` 13 failed / `verify-behavior.log` 29/29） | 无 |
| 14 | ADR 0030 §5（L58） | 通知 = 信号不承诺方向/真变；多通知可接受 | 载荷零改动（仅 `changes` key 集合被过滤）；保守分支（live 旧态 / C-2）向多通知方向收敛；无方向字段、无 effect 分型 | no-conflict | `watch-map.ts` L736–751（`enqueueData` diff 零触碰）；备选 L78 未触碰 | 无 |
| 15 | ADR 0030 §5（L59） | 嵌套 Y.Map 部分更新（容器浅 delta 无条目级 oldValue）→ 保守通知；plain object 条目整值替换（oldValue 恒在场）→ 恒精确判定 | C-2 分支：`isNestedEntryChanged` 真变成立即产出（谓词在场**恒保守**，不做字段级精确化）；plain 判据 = `isPlainData(oldValue)`（快照两态可读 → 精确；live Y 载体被 Yjs 清空 → 保守） | **implements-existing-decision** | `watch-map.ts` L613–622（C-2 保守）、L558–573（plain/live 分流）；契约 N1/N2/N6（保守面）+ N9/N9b（plain 精确静默）对偶行 | 无 |
| 16 | ADR 0030 §5（L60） | 消费协议 = 消费方按 key 幂等拉终态自辨（用既有读面） | 定位符 `{path, key}` 形状与 `[...path, key]` 拼接语义零改动；readData/窗口读面零 diff（消费面不变） | no-conflict | `watch-map.ts` `makeChange` diff 零触碰；`git status` 复核 read 面零 diff | 无 |
| 17 | ADR 0030 §4（L44–53） | 三 kind 闭集 + data 形状 `{kind, origin, changes:[{path,key}]}` + origin 两态 + 无 version/rev | `NamespaceRuntimeWatchMapNotification` 联合 diff 零触碰（三 kind 原样）；谓词只改「是否通知」与 key 集合，载荷构造零改动；无新增 kind、无序号字段 | no-conflict | `watch-map.ts` L74–79（类型原样）；`enqueueData`/`classifyOrigin` diff 零触碰；契约 N13 载荷行 | 无 |
| 18 | ADR 0030 §6（L64–67） | 挂点 = 写序列器事务提交后异步分发（槽外）；回调 throw 静默隔离；有界队列溢出 → invalidate-all；数值不进公共契约 | 分发面零改动：队列/泵/溢出/让步全部 T1 原样；谓词求值在观察器同步段内（与 T1 真变判定同路径，纯读、零 sequencer 槽位工作）；逐 key try/catch → 该 key 保守（不外抛）；观察器整体吞没红线保持 | no-conflict | `watch-map.ts` L602–611（逐 key try/catch）、L712–733（观察器整体 try/catch 原样）、L735–751（enqueue 原样） | 无 |
| 19 | ADR 0030 §7（L69–73） | runtime：谓词求值 + 宁多勿漏判定；registry：lease 公共面 + 类型别名透传；复制协议零改动、通知不出进程 | 谓词全部在 `watch-map.ts`（runtime 唯一载体）；`lease.ts` options **raw 引用直传、零解释**（released 短路先于透传）；ws-replication/replication-protocol/persistence 全部零 diff | **implements-existing-decision** | `lease.ts` L355–357（raw 透传）；`git status --porcelain` DENY 面零命中 | 无 |
| 20 | ADR 0030 验收（L90–L96） | 主缝 = lease 公共面 registry 契约测试家族；判定纪律矩阵行全集；先例 = 窗口读三件套 | 三件套落 `packages/namespace-registry/test/`（fixture/red/surface）；矩阵行 E1–E11 + N1–N15（含 N10b/N12b）+ NC1/2/3/5/6/7 在场（本轮 grep 逐标记核对）；被既有 include 正则采集（`verify-runner-list.log`） | **implements-existing-decision** | 测试文件标记 grep 全集；`artifacts/sa3-issue388-verify-runner-list.log` | 无（测试充分性归 SA4/SA7） |
| 21 | ADR 0008（L101 窄读 + 词汇收口注册 L121–131） | 稳定码 append-only 注册、区分域靠 message；通知面恒业务信号（非进度/内部事件） | `errors.ts` 仅追加：`WATCH_MAP_OPTIONS_INVALID_CODE` 常量 + 联合成员 append-only（既有 `CARRIER_MISMATCH`/`SCHEMA_UNAVAILABLE` 两码逐字零改动）；message 常量单点在 watch-map.ts、构造器自动码前缀；通知面仍三 kind 闭集零夹带 | **implements-existing-decision** | `errors.ts` diff（+9/−1，纯追加 hunk）；`watch-map.ts` L163–189 | 无 |
| 22 | ADR 0023（L41/L45） | 冻结服务表面 = `ctx.provide` 服务对象；返回值（NamespaceLease 等）不受影响 | `registry.ts` 零 diff；改动全部落 lease 返回值面与类型面 | no-conflict | `git status` 复核 `registry.ts` 零命中 | 无 |
| 23 | ADR 0009 + ADR 0030 §1（L16–18） | lease = 调用方 capability；释放即全部订阅清理；退订幂等零回声 | lease 恰 16 键（签名原位加宽不新增键——`watchMap` 成员第三参，键名不变）；释放清理/退订幂等 T1 代码零触碰；订阅对象新增 `predicate` 字段随退订/释放一并回收 | no-conflict | `types.ts` diff（成员原位加宽）；`lease.ts` doRelease 区域 diff 零触碰；契约 N14/NC 键集行 | 无 |
| 24 | ADR 0027（+0024/0016）+ ADR 0028 | readData 四键形态、投影文本 ✂ 段、窗口读面与三码冻结 | `window-read.ts`、`read-schema-projection.ts`、`plain-data.ts`、readData 路径全部零 diff（谓词层复用 `isPlainData` 同模块单源，只 import 不改） | no-conflict | `git status` 复核；`watch-map.ts` 内 `isPlainData` 为本模块自有 T1 副本零改动 | 无 |
| 25 | ADR 0010/0013/0022 + `docs/protocols/instance-replication-v1.md` | 复制 wire / chunked 冻结；通知不出进程 | `packages/ws-replication/**`（含 `src/testing.ts` 装饰门面——SA2-1 兼容依据 `.bind` 保形，本轮零 diff 复核）、`packages/replication-protocol-v1/**`、`packages/persistence/**`、协议文档全部零 diff | no-conflict | `git status --porcelain` 全量复核 | 无 |
| 26 | ADR 0011/0014 | 诊断日志不混用为通知通道；emit 永不抛；slot 外 | `packages/namespace-diagnostic-log/**` 零 diff；实现零诊断接触 | no-conflict | `git status` 复核 | 无 |
| 27 | ADR 0025/0026（guard / 信封面） | `{path, equals}` / `{path, absent}` 词表与原子信封零改动 | `write.ts` / `mutation.ts` / guard 面零 diff；`where.equals` 恒标量为 watch 自有门（不复用 guard 结构深相等全域） | no-conflict | `git status` 复核 | 无 |
| 28 | CONTEXT.md L65–67 + 模块 AGENTS（runtime/registry） | 「变更订阅」词条口径（含 `_Avoid_`）；模块边界（sequencer FIFO 不动、公共 API 仅经 index、detached projections、root typecheck+test 门） | 实现术语与词条逐项一致（宁多勿漏 / 定位信号 / 拉终态自辨 / 三 kind / 无 version / 无 effect 分型）；`_Avoid_` 面零触碰（无泛 watch、无 subscribeOwnedUpdates 混用）；新类型全部经两包 `src/index.ts` type-only 导出（值导出面不变）；通知仍纯定位符（detached）；root `pnpm typecheck` + root `pnpm test` 证据在场（`verify-typecheck.log` 14 tsconfig、`verify-root-test.log` 396 文件/4785 用例 passed + Type Errors no errors） | no-conflict | 两包 `index.ts` diff（type-only）；`artifacts/sa3-issue388-verify-{typecheck,root-test}.log` 本轮 tail 实读 | 无 |

裁决分布：**14 × implements-existing-decision（行 1–5、9–11、13、15、19–21）+
14 × no-conflict；0 hard-conflict；0 evolution-required；0 override。**

### 前置门禁六条 required actions 闭环核验（`task_issue-388_conflict_report.md` §8）

| Action | 闭环证据（本轮实读） | 状态 |
|---|---|---|
| 1 签名对账（ADR §1 简写 vs T1 冻结绑定） | `watchMap(path, listener, options?)` 第三参加宽：runtime 成员面（`runtime.ts` L323）+ hub 面 + lease 成员面（`types.ts`）三处同形；`Namespace{Runtime,Lease}WatchMap{Options,ScalarValue}` 别名引入并经 index type-only 导出；Equal 锁 5→8（`lease.ts` `_watchMapOptionsAlias`/`_watchMapOptionsMemberAlias`/`_watchMapScalarValueAlias` + 注册表成员） | **闭合** |
| 2 新码 append-only 注册 | `errors.ts` 纯追加 hunk；既有两码逐字零改动；六 message 单点常量、码前缀、非空、互相可区分、零 path/field/值回显（本轮逐条复读文案）；类不进 index | **闭合** |
| 3 建立门次序不回退 | ①–⑤ T1 门原序原样，⑥ 谓词门在 ⑤ 之后、⑦ 登记之前（`watch-map.ts` L754–807 实读）；失败零登记（throw 先于 `subscriptions.add`）；门⑥ 全程纯 schema 侧零 live 探测 | **闭合** |
| 4 判定矩阵完备性（AC5 ∧ AC7 合取边界显式成行） | E1–E11 + N1–N15b + NC 全标记在场；保守行（N1/N2/N6「必须通知」）与精确静默行（N7/N8/N9/N9b）对偶成行；首红行 N7/N8/N9(+E4–E7/E5b/E11) 于 HEAD 红（13 failed）→ 实现后 29/29 绿 | **闭合**（矩阵红绿证据 `verify-red-repro.log` / `verify-behavior.log`） |
| 5 槽外与零 throw 纪律延续 | 谓词求值全在观察器同步段（与 T1 真变判定同路径）；逐 key try/catch → 该 key 保守（L602–611）；观察器整体吞没原样（L712–733）；零 sequencer 槽位工作；契约 N15 行锚定 | **闭合** |
| 6 实现后复查清单 | 公共 API 加宽 ✓ / 新失败语义 ✓ / 矩阵红绿 ✓ / DENY 面零 diff ✓（本报告 §5 逐项）——即本报告 | **闭合**（本报告） |

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| —（无） | — | — | — |

owner feedback 快照为空（无评论、无 comment ID、无 updated_at）；无新 ADR 修订 / 废弃、
无协议版本升级、无决策文本自授权演进条款被援引。实现全部行为面均在 ADR 0030 既有条款
内或其未冻结处的 fail-closed 缺省侧（§6），**不存在任何 override 诉求**。

## 5. Frozen surfaces

逐项核对实际 diff（`git status --porcelain` 全量 + 逐 hunk 实读）：

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| readData 交付形态 | 恒四键 `{ok, value, schema, truncated}`、截断事实唯一载体 = ✂ 段 | ADR 0027 + ADR 0030 状态行 | **不变**（readData 路径零 diff） |
| 窗口读公共面 | `readArray`/`readMap` 签名与 `WINDOW_*` 三码、窗口语义 | ADR 0028 | **不变**（`window-read.ts` 零 diff；契约负控行在产） |
| 复制 wire | instance-replication-v1 全帧/状态机/错误码；chunked 冻结；通知不出进程 | ADR 0010/0013/0022 + ADR 0030 §7 | **不变**（ws-replication/replication-protocol/persistence 零 diff） |
| 通知三 kind 词表与 data 形状 | `{kind:'data', origin, changes:[{path,key}]}` / `invalidate-all` / `watch-end`；无 version/rev、无 effect 分型、无含值 | ADR 0030 §4 + 备选；CONTEXT `_Avoid_` | **不变**（通知构造 diff 零触碰；谓词只过滤 key 集合） |
| 谓词封闭词表 | 恰 `equals` / `in`；无 `notEquals`/`and`/key 过滤/数组载体 | ADR 0030 §2 + 备选 | **不变**（词表恰两算子，词表外一律拒绝） |
| WATCH_MAP 既有稳定码 | `WATCH_MAP_CARRIER_MISMATCH` / `WATCH_MAP_SCHEMA_UNAVAILABLE` 逐字零改动；新码 append-only | `errors.ts` + ADR 0008 注册纪律 | **不变**（diff 纯追加；两码原样） |
| lease 生命周期语义 | 释放即全部订阅清理、退订幂等零回声、lease 恰 16 键 | ADR 0009 + ADR 0030 §1 | **不变**（签名原位加宽；生命周期代码零触碰） |
| 诊断变更日志面 | 不混用为通知通道；emit 永不抛；slot 外 | ADR 0011/0014 + ADR 0030 验收 | **不变**（零诊断接触） |
| Registry Cordis 服务字面量 | `ctx.provide` 服务对象冻结（返回值面除外） | ADR 0023 | **不变**（`registry.ts` 零 diff） |
| guard / mutation 信封面 | `{path, equals}`/`{path, absent}` 词表与原子信封 | ADR 0025/0026 | **不变**（write/mutation 零 diff） |
| T1 契约三件套（回归锚） | `issue-387-watch-map-*` 零改动且全绿 | 设计 DENY + NC1 | **不变且绿**（零 diff；`verify-t1.log` 23/23） |
| 决策与术语文档 | `docs/adr/**`、`CONTEXT.md`、`docs/protocols/**` 零 diff | SA8 冻结面 + docs/AGENTS | **不变**（git status 零命中；文档缝属 T5 #391） |

## 6. Evolution requirements

**无。** 实现未改变任何既有契约，无需 ADR / CONTEXT / 协议文档修订计划。

ADR 未冻结处的实现缺省（均已在设计 §7 冻结为 fail-closed 缺省，本轮确认实现与冻结一致，
且缺省方向均为「响亮拒绝」或「向多通知收敛」——不制造静默漏通知面，不与任何条款矛盾）：

1. **F-2 域闭包**：一切 `union`（含全标量成员）、`scalar{null}`、`scalar{unknown}`、封闭对象
   map / 标量条目容器（条目无统一值域）拒绝——ADR L27「非标量域」的收窄读法；未来放宽属
   纯加法演进、须过设计评审（ADR L31 同款治理），非本票义务。
2. **F-4 标量相等 = SameValue（`Object.is`）单源**：ADR 未冻结相等函数；SameValue 与仓内
   先例（`replication-session.ts` 值投影相等）同源，且在 ±0/NaN 边界上向「多通知」侧收敛
   （漏通知不可接受方向的保守选择）。
3. **F-3 形态族扩展同码拒绝**：ADR L37 三情形之外的词形错误（缺/双算子、未知键、非标量值、
   敌意形状）同码 fail-closed——「封闭小集」+ L39「建立后零参数错误」的必然延伸；静默接受
   词表外形态才是冲突面（ADR L85 静默死亡形态的对偶预防）。

以上三项若未来演进，届时须按技能纪律携完整修订计划另行评审；当前不构成 evolution-required。

## 7. Hard conflicts

**无。** 实际 diff 与 ADR 0030 决策 2 / 3 / 5 及冻结面逐条款一致（§3 行 1–5、9–11、13、15、
19–21 为逐字级兑现；其余为零触碰面）；未发现与任何现行 ADR、CONTEXT 术语、模块 AGENTS
决策面或协议文档的不兼容点。SA3 自述「零源码偏离设计」经本轮逐 hunk 独立复核成立。

## 8. Required actions

全部为非阻塞事项（不构成 gate 停止条件）：

1. **SA4/SA7 后续动态验证**（SA3 §7-5 已登记）：本轮仅核冲突与证据充分性，实现质量、
   测试充分性与 CI 裁决归 SA4/SA7。
2. **SA3 §7 观察项转交**（均非冲突面）：① 契约矩阵行采用字面 fixture 期望（`readData`
   oracle 以临时探针补足后删除）——若 SA4/SA7 要求把 oracle 断言固化进契约文件，属 ALLOW
   测试面增补；② union 全标量成员子情形无专属测试行（实现按 fail-closed 默认分支结构恒成立）；
   ③ Proxy trap 子情形无专属测试行（门⑥ 整体 try 收编，fail-closed 方向安全）。
3. **fixture 双容器构造说明**（本轮观察，非偏离）：设计 §10.2 原文为「`tasks` 种入 plain 条目」，
   fixture 因受控写校验拒绝混合载体而落为 `tasks`（受控写）+ `plainTasks`（raw plain 条目）
   双 Y.Map 容器——F-6 冻结语义（plain 条目面 = Y.Map 容器 + plain 条目值 + raw 驱动；
   不引入 plain 容器整替死面）完整保持，SA4 复核时知悉该构造差异即可。
4. **T3–T5 分期边界**（`watch-end`/origin 验收、溢出注入、文档缝）维持未实现——与设计/契约
   分期一致，非缺口。

## 9. Verdict

**clear**——28 项对照全部为 no-conflict 或 implements-existing-decision；前置门禁
`requiresConflictRecheck = true` 所列全部待核对项（公共 API 加宽 / 新失败语义 / 谓词判定
语义 / DENY 面零 diff）经实际 diff 逐项核对闭合；无 evolution-required、无 override、
无 hard-conflict。实现可进入 SA4/SA7 复核相位。

（`approve` 不是 SA8 verdict；本 verdict 仅表达「实现与既有决策集无冲突」，实现质量与
验收完成度属 SA4/SA7。）

## 10. requiresConflictRecheck

**false**。理由：前置门禁标记的待核对面（公共 API 加宽、新失败语义、判定语义、冻结面零 diff）
已由本次实现后复查逐项核对闭合；本 diff 不新增公共 API 之外的待实现决策面（无 wire / 持久化 /
schema / 状态机 / 生命周期变更，无正式 override）；纯 no-conflict 与 existing-decision 兑现
组合——按纪律「实现后复查已闭合时为 false」。若 SA4/SA9 后续发现新决策面，将构成新的
复查触发条件（非本报告遗留）。
