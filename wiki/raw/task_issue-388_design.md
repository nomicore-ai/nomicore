# SA1 实现设计 — issue #388：谓词订阅与宁多勿漏判定（变更订阅 T2）

- 任务类型：**feature**（在 T1 无谓词通路上叠加 `where` 谓词订阅；纯加法 + 新失败语义）
- 规范权威：ADR 0030（`docs/adr/0030-change-subscription.md`，HEAD `28faeae` 零 diff）决策 2（§2 谓词
  词表）/ 决策 5（§5 宁多勿漏）；CONTEXT.md L65–67「变更订阅」词条同口径
- 上游输入：SA6 验收契约 `wiki/raw/task_issue-388_sa6_contract.md`（approve；§12 绑定表 B-1–B-10、
  判定矩阵 N1–N15 / E1–E11、§15 五项 ★SA1 冻结）+ SA8 前置门禁
  `wiki/raw/task_issue-388_conflict_report.md`（clear；§8 六条 required actions）+
  `wiki/raw/task_issue-388_relevant_decisions.md` + 评审修订输入
  `wiki/raw/task_issue-388_sa2_review.md`（iteration 1；verdict `reject`，1 × MAJOR = SA2-1，
  已逐条落实——§16；核心判定算法/门⑥/类型面/矩阵/测试结构经攻击成立，本设计冻结裁定
  F-1–F-6 与 §7–§10 主体零改动）
- 本设计角色：把 SA6 契约默认值**冻结为实现绑定**（含 §15 全部 ★ 项裁定），给出接口/判定算法/
  门次序/文件范围/测试结构；**不含实现代码与测试代码**（实现相位交付）
- 基线：worktree `/home/wangjian/nomicore-fix-issue-388`，branch `mabf/issue-388`，HEAD `28faeae`
  （T1 #387 已合入）；SA6 基线证据：T1 行为 21/21、T1 类型面 2/2、registry 41 文件/496 用例、
  根 `pnpm typecheck` 全绿（`artifacts/sa6-issue388-baseline-*.log`）

---

## 0. SA1 冻结裁定总表（SA6 §15 ★ 项，一次收口）

| # | 待裁项（SA6 §15） | **冻结裁定** | 依据与章节 |
|---|---|---|---|
| F-1 | AC7 保守分支执行粒度（N2/N6） | **按 AC7 逐字保守**：C-2 嵌套事件（live Y.Map 条目内部变更）→ 恒保守通知（前提 = T1 真变判定通过）；精确抑制只发生在旧态可判的三处：C-1 `add`（旧态=缺席）、C-1 `update`/`delete` 且 `oldValue` 为 plain 快照。N2/N6 = **必须通知**（非「允许静默」） | §7.1 |
| F-2 | 标量域闭包（union / scalar:null / unknown） | 接受：`scalar{string\|number\|boolean}`、`enum`、`pattern`、`int`、`range`（ref 追尽 + optional 透明后）；**fail-closed 拒绝**：`object` / `array` / `xml` / 一切 `union`（含全标量成员）/ `scalar{'null'}` / `scalar{'unknown'}` / ref 追尽失败。附加冻结：**条目无统一值域（封闭对象 map 无 `<key>` 字段）→ 一切 field 拒绝**（E5b 推广） | §7.2 |
| F-3 | `where` 形态错误的处置 | **全部 fail-closed → `WATCH_MAP_OPTIONS_INVALID`**：缺算子 / 双算子 / 未知键 / `field` 非 string / `equals` 值非标量 / `in` 非数组 / `in` 成员非标量 / `in` 空数组 / options·where 敌意形状（非 plain 对象、accessor、Proxy/原型陷阱、未知键） | §7.3 |
| F-4 | 标量相等边界（NaN / ±0） | **SameValue（`Object.is`）单源比较**，`equals` 与 `in` 共用同一比较函数（`in` = 存在量词线性扫描，不用 `Set`）：NaN=NaN 匹配、-0≠+0。对齐仓内先例 `replication-session.ts` L972/L992 值投影相等（primitive SameValue）。承重断言仍只用无歧义标量；边界行进矩阵为非承重文档行 | §7.4 |
| F-5 | options 别名与标量类型命名 | `NamespaceRuntimeWatchMapOptions` / `NamespaceLeaseWatchMapOptions`（options 袋）+ `NamespaceRuntimeWatchMapScalarValue` / `NamespaceLeaseWatchMapScalarValue`（= `string \| number \| boolean`）。**否决裸名 `ScalarValue`**（违反两包 `Namespace{Runtime,Lease}*` 前缀卫生）；`where` 联合类型为模块内部类型（不经 index 导出，结构上经 Options 可达） | §7.5 |
| F-6 | （设计自增）N9/N10 fixture 面 | plain 条目面 = **Y.Map 容器 + plain 条目值**（raw 构造期 `container.set(key, plainValue)` 保 plain）；驱动 = fixture doc 上的 **raw `Y.Doc` 事务**（非受控写——受控写按载体纪律物化 Y.Map，实测 A1/B1）。SA6 §12.3 草图中的 plain **容器**面是死面（整容器替换 = 父路径 C-3 事件，T1 零条目定位符，实测 `-probe-plain-replace.log` N1；父路径编排归 T4 #390），本设计将其修正为 plain **条目**面 | §8.4 / §10.1 |

---

## 1. 任务模型（feature：能力缺口）

### 目标

在 T1 交付的 `watchMap(path, listener)` 无谓词信号面上叠加：

1. **公共 API 纯加法加宽**：`watchMap(path, listener, options?)`，`options.where` 谓词（封闭词表
   `{field, equals}` / `{field, in}`，值域恒标量）；
2. **建立期判定**：谓词非法（field 不存在 / 非标量域 / `in` 空数组 / 形态错误）→ 同步 throw
   `WatchMapError('WATCH_MAP_OPTIONS_INVALID', …)`，失败零订阅登记；建立后通知流零参数错误；
3. **通知期宁多勿漏判定**：`changes` 的 key 集合按谓词逐 key 过滤——同值写仍由 T1 真变判定过滤，
   匹配/退出匹配集通知，非匹配且旧态可判的变更静默，旧态不可判保守通知；
4. **类型面**：runtime/registry 两包新增 options/标量别名（type-only），Equal 锁与 surface 契约更新。

### 非目标（不得越界；SA6 §12.1 非目标段 + ADR 0030 备选）

- `watch-end` 终止编排与 `'replication'` origin 验收断言（T3 #389）；
- 队列溢出 testing 注入与父路径删除/容器整替编排（T4 #390——plain 容器整替的父路径事件本设计
  显式不产出条目定位符，见 F-6）；
- 文档缝（T5 #391；CONTEXT L65–67 已覆盖谓词口径，本票零文档改动）；
- `notEquals` / `and` / key 级过滤 / 数组载体 `watchArray` / 含值通知 / version·rev（ADR 备选 L78–L84
  已否决；新增算子属词表演进须过设计评审，ADR L31）；
- 通知载荷、三 kind 闭集、队列、分发、生命周期面的任何改动（ADR §4/§6 冻结；SA8 §5）。

---

## 2. 当前行为与证据锚点（HEAD `28faeae` 实读）

| 面 | 现状 | 锚点 |
|---|---|---|
| T1 建立六门（全同步、次序冻结） | ① lifecycle（`RuntimeReadDisabledError`）→ ② listener 形状（`TypeError`）→ ③ schema 可用（`WATCH_MAP_SCHEMA_UNAVAILABLE`）→ ③b ROOT 载体（`WATCH_MAP_CARRIER_MISMATCH`）→ ④ path 单次快照（`normalizeReadPath`，敌意收敛 null）→ ⑤ schema 分类（`resolveSchemaAtPath` + `resolveCarrierKind`，纯 schema 侧，零 live 探测；非 `object` kind → `WATCH_MAP_CARRIER_MISMATCH`）→ ⑥ 登记 | `packages/namespace-runtime/src/watch-map.ts` L416–476 |
| 稳定码注册 | `WatchMapErrorCode = CARRIER_MISMATCH \| SCHEMA_UNAVAILABLE` 两码；`WatchMapError` 构造器自动前缀 `${code}: `；message 常量单点在 watch-map.ts | `packages/namespace-runtime/src/errors.ts` L241–271；`watch-map.ts` L108–123 |
| 事务级推导 | `collectChanges(events, containerPath)`：C-1 容器本体事件逐键 `isRealChange`；C-2 嵌套事件 `isNestedEntryChanged`（任一键真变或键集空 → 真）；C-3 父路径事件不产出条目定位符；`Map<key>` 首见序去重 | `watch-map.ts` L262–290 |
| 真变判定 | add/delete 恒真变；update 两侧均 plain → `plainDataEquals`（undefined 键过滤），相等过滤；任一侧 live Y 载体/非 plain → 保守通知 | `watch-map.ts` L220–233（`isRealChange`） |
| 零 throw 红线 | 观察器整体 try/catch 吞没（throw 会经 `transactGuarded` 收编 DOCRT-E203 写 fatal） | `watch-map.ts` L374–392 |
| 分发 | 每订阅 FIFO 有界队列（默认 16）+ 单飞微任务泵（每项投递前让步 20 微任务）；listener 逐投递 try/catch 静默隔离；溢出 → 清队 + 单条 `invalidate-all` | `watch-map.ts` L98–103、L310–341、L397–413 |
| runtime 公共面 | `NamespaceRuntime.watchMap: (path, listener) => Handle`（恰 2 参）；wiring `watchMap: (path, listener) => watchHub.watchMap(path, listener)` | `packages/namespace-runtime/src/runtime.ts` L309–312、L753 |
| registry lease 面 | `watchMap(path, listener)`：released 短路（`NamespaceLeaseReleasedError`）→ runtime 透传 → 双幂等包装句柄 + `activeWatches` 登记；lease 恰 16 键 | `packages/namespace-registry/src/lease.ts` L342–363；`types.ts` L740–752 |
| 类型别名 | 三别名（Notification/Change/Handle）单源同义 + Equal 锁（含 `Parameters` 成员锁）；**无 Options 别名**（注释明文「T2 #388 随 `{where}` 加法引入」） | `types.ts` L490–502；`lease.ts` L499–515、L569–573；两包 `index.ts` |
| 谓词能力 | **不存在**：`where` 全树零实现（仅注释）；arity=2、第三参被忽略；六种谓词形态静默建立；非匹配变更照常通知 | SA6 §5 证据 1/4（`artifacts/sa6-issue388-probe-gap.log`） |

### 判定可行性事实（SA6 探针，本设计的因果地基）

| 事实 | 内容 | 证据 |
|---|---|---|
| Yjs-1 | 嵌套 in-place 字段写 → **条目级事件**（path=`[…container, key]`），`changes.keys` 携带**逐字段** `oldValue` | `-probe-yjs-facts.log` Y1；`-probe-judgeability.log` Z3 |
| Yjs-2 | 同值写仍产生载体 delta（`oldValue` aliases current）→ T1 `isRealChange` 语义过滤在产 | Y2；NC5（R5=0） |
| Yjs-3 | 整值 set / delete 一个 live `Y.Map` 条目 → **容器级事件**（`action:'update'/'delete'`），`oldValue` 引用在场但 Yjs **已清空其内容**（`get()`=undefined、`toJSON()`={}）→ 旧态不可判 | Y3/Y5；`-probe-oldvalue-identity.log` W1/W2；`-probe-judgeability.log` Z1 |
| Yjs-4 | raw `container.set(key, plainValue)` 条目值**保持 plain**（受控 mutateData 才物化 Y.Map）；plain 条目整值替换 → 容器级 `update`，`oldValue` 为 **plain 快照**（两态皆可读 → 精确判定） | `-probe-plain-oldvalue.log`；`-probe-plain-entry.log` A1/B1；SA6 §15-6 |
| Yjs-5 | plain **容器**整替换 → 父路径事件（ROOT 级 key=`tasks`）→ 对该容器的订阅零条目定位符（C-3） | `-probe-plain-replace.log` N1 + raw events 行 |
| Schema-1 | `resolveSchemaAtPath(derived, ['tasks'])` → `{kind:'object', fields:[{name:'<key>', value:{kind:'ref',name:'Task'}}]}`——Record 物化位在值侧 object schema 上是名为 `<key>` 的字段；`['tasks','k','status']` → ref→`Status`→`scalar{string}`（别名闭包 `values.Status`）；`state` → `enum`；`nested` → `object`；`tags` → `array`；`note` → `optional(scalar)`；`missing` → `SCHEMA_PATH_NOT_FOUND` | `-probe-schema-facts.log` |
| Schema-2 | `resolveSchemaAtPath` 返回的 `aliases` = `collectAliasClosure(derived.values, …)`——**值侧**别名闭包（`aliases[n] = values[n]` 原样引用）；`resolveCarrierKind` 已按此追尽 ref/optional | `packages/vfsl/src/resolve-schema-at-path.ts` L309/L314/L755–796；`watch-map.ts` L148–169 |
| 敌意通道纪律先例 | options 类对象校验：`Object.keys` + `Object.getOwnPropertyDescriptor` 取值（全程零 `[[Get]]`、accessor 显形拒绝、原型须 plain、trap 异常整体收编 `{ok:false}`）；path 数组：迭代器同一性 + 段域检查 + try/catch 收敛 null | `packages/namespace-runtime/src/window-read.ts` L198–250（`canonicalWindowBudget`）；`read-schema-projection.ts` L237–255（`normalizeReadPath`） |

---

## 3. 能力缺口（feature 的「根因」）

T2 从未交付：`watchMap` 无 options 参数（arity=2）、无谓词求值与新旧匹配态判定、无建立期谓词校验、
`WATCH_MAP_OPTIONS_INVALID` 未注册、两包无 `*WatchMapOptions` 类型。T1 有意留白（`watch-map.ts`
L36–38 与 registry `types.ts` L493 明文预留 T2 加法位）。放大因素：非法谓词今日**静默建立**（配置
错误伪装成恒不过滤的死订阅——ADR L29/L85 的静默死亡形态）；无谓词时降噪/补拉成本全部转嫁消费方。
上游缺口证据链承接见 §5。

---

## 4. Owner 要求落实

| Comment ID | Updated at | Requirement | Design section |
|---|---|---|---|
| —（issue #388 评论 = 0） | — | 无 owner 要求/override 需并入（Host dispatch owner feedback「REST comments read returned none」；SA6 §2 与 SA8 §2/§4 两处独立确认 `comments:[]`） | 需求源 = issue body「What to build」+ AC1–AC8 + ADR 0030 决策 2/3/5 + CONTEXT L65–67（简报自锚） |

无 owner 评论 ⇒ 无「最新 owner 要求 vs 旧设计」冲突面，亦无 ADR 覆盖诉求。

---

## 5. 复现和根因承接（SA6 契约 → 设计响应）

| 上游事实（SA6） | 证据位置 | 设计响应 |
|---|---|---|
| 运行时缺口：arity=2、第三参被忽略、六种 where 形态静默建立、非匹配变更 notify=7 | SA6 §5 证据 1（`-probe-gap.log`） | §8.1 签名加宽 + §8.2 建立第⑥门（谓词校验）+ §8.3 判定算法 |
| 精确降噪三首红行：N7（新增非匹配条目应零通知）、N8（混合 add 应恰含匹配 key）、N9（plain 快照旧态可判应零通知）在 HEAD 多通知 | SA6 §5 证据 2/3、§13 | §8.3 C-1 `add` 精确判定 / 逐 key 过滤；C-1 `update` plain oldValue 精确判定 |
| 保守行 N2/N6 在 HEAD 行为已等于目标（谓词被忽略 → 一律通知）——不构成红证据，只作 AC7 语义矩阵行 | SA6 §11-5/§11-7、§12.5-6 | §7.1 冻结保守分支（必须通知），测试分档「允许保守」改记「必须通知（保守面）」 |
| 建立门次序负控绿且必须保持：P2 载体门先、P5 released 先、P6 schema 门先 | SA6 §6 NC3（`-probe-mixed-gates.log`） | §8.2 谓词门 = 第⑥门（在既有五门之后、登记之前）；门内子序冻结 |
| 旧态不可判两来源：① 嵌套部分更新（条目级事件但容器浅 delta 无条目级 oldValue——按 ADR 口径）；② live Y.Map 整替/删除后 oldValue 内容被清空 | SA6 §9-3（W1/W2） | §7.1/§8.3：来源② 走「plain 才可判」判据；来源① 走保守（不利用字段级 oldValue 精确化） |
| plain 快照 oldValue 仅当条目值是 plain 时出现；受控写物化 Y.Map ⇒ N9/N10 驱动 = raw 事务/复制 apply | SA6 §15-6 | F-6：fixture = Y.Map 容器 + plain 条目（raw 构造）；测试驱动 = raw `Y.Doc` 事务 |
| 谓词校验可纯 schema 侧完成（ref 追尽 + optional 透明 + `<key>` 字段承载元素域），零 live 载体探测 | SA6 §9-4（`-probe-schema-facts.log`） | §8.2 门⑥-c 元素域/成员域解析（复用 gate ⑤ 已得的 `resolved.valueSchema` + `resolved.aliases`，零二次解析、零数据探测） |
| 类型面全缺席（第三参 / `*Options` / 新码） | SA6 §5 证据 4 | §8.1/§8.5 类型与导出面 + §10 测试结构（surface 契约） |
| 等待纪律：`expect.poll`（5ms/2s）+ 屏障（后续事务或第二订阅），禁 sleep 竞猜 | SA6 §7/§12.5-3 | §10.3 测试纪律（原样承接） |
| readData 四键形状断言必须经集中化 helper `expectReadDataOkKeys` | SA6 §12.5-8 | §10.3（oracle 纪律，禁内联四键字面量） |

上游事实与源码矛盾：**未发现**。SA6 探针事实与本次源码实读一致（§2 表）。

---

## 6. SA8 约束落实（前置门禁六条 required actions + 冻结面）

| 决议或义务（SA8 冲突报告） | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|
| Action 1 设计轮签名对账：ADR §1 简写 `watchMap(path, {where?})` vs T1 冻结绑定——明示纯加法路径 + 两别名引入 | §8.1、§7.5 | 冻结 `watchMap(path, listener, options?)` 第三位置参数（T1 设计 §7-B2 冻结延续；registry `types.ts` L493 预留位兑现）；ADR 简写 = 省略回调位的记法，非参数序变更 | 是（复查面之一） |
| Action 2 新码 append-only 注册：`WATCH_MAP_OPTIONS_INVALID`；既有两码零改动；message 含码前缀、非空、可区分、零 path/身份回显 | §8.2（message 表）、§8.6（errors.ts 改动） | 码常量 + 联合成员 append-only 进 `WatchMapErrorCode`；六条 cause 区分 message 单点常量在 watch-map.ts（沿 T1 拆分：errors.ts 只放码，message 在 watch-map.ts）；构造器前缀机制复用 | 是（新失败语义） |
| Action 3 建立门次序不回退：谓词校验前置登记、schema/载体门次序保持、数据缺席宽容不得引入 live 载体探测 | §8.2 | 谓词门 = ⑥（⑤ 之后、⑦ 登记之前）；门⑥ 全程纯 schema 侧（仅用 gate ⑤ 已解析产物）；失败零登记、零 observer 变更 | 是 |
| Action 4 判定矩阵完备性：AC 全集锚定；AC5 ∧ AC7 合取边界须有显式矩阵行 | §9 判定矩阵（N 行全集 + 保守/精确分档） | 矩阵行 N2/N6（保守面）与 N7/N8/N9（精确静默面）对偶成行；每行标注「必须通知/必须静默/保守」 | 是（矩阵红绿核对） |
| Action 5 槽外与零 throw 纪律延续：谓词求值 = 观察器内纯读，不进 sequencer 槽、零 observer 内 throw | §8.3（逐 key try/catch → 保守）、§8.7 | 谓词求值全部在 `onRootTransaction` 观察器内的 `collectChanges` 路径；逐 key try/catch：单 key 求值异常 → 该 key 保守通知，不影响同事务其他 key；外层 T1 整体吞没红线保持 | 是 |
| Action 6 实现后复查清单：公共 API 加宽 / 新失败语义 / 矩阵红绿 / DENY 面零 diff | §11（DENY LIST）、§12（验收映射）、§15 | 本设计 `requiresConflictRecheck = true`；复查项逐条落在 §15 | 是（本设计即提交该 flag） |
| 冻结面：readData 四键 / 窗口读三码与面 / 复制 wire / 通知三 kind 与 data 形状 / 谓词封闭词表 / WATCH_MAP 既有两码 / lease 生命周期 / 诊断面 / Registry 服务字面量 / guard 信封面 | §11 DENY LIST；§8.3（载荷零改动） | 全部零接触：谓词只改「是否通知」与 `changes` 的 key 集合；lease 恰 16 键（签名原位加宽，不新增键）；`registry.ts` 不动 | 是（零 diff 复核） |
| ADR 0008 L101 窄读（后法特定授权）+ 词汇收口注册纪律 | §8.6 | 新码按 `errors.ts` append-only 段注册；通知面恒三 kind 闭集 | — |

---

## 7. 设计决策与主要备选方案

### 7.1 F-1：AC7 保守分支执行粒度 —— 按逐字保守冻结（承重裁定）

**裁定**：带谓词订阅的通知条件（在 T1 真变判定之后合取）：

```
notify(key) ⟺ realChange(key)  ∧  ( 无谓词
                                   ∨ oldMatch(key)
                                   ∨ newMatch(key)
                                   ∨ 旧态不可判(key) → 保守通知 )
```

其中「旧态可判性」按**事件形状**判（§8.3 判定表）：

| 事件形状 | 旧态来源 | 可判性 | 处置 |
|---|---|---|---|
| C-1 `add` | 缺席（缺失恒不匹配，ADR §2 L28） | **可判** | 精确：`newMatch ? 通知 : 静默` |
| C-1 `update`，`oldValue` 为 plain 数据 | plain 快照（两态皆可读，Yjs-4） | **可判** | 精确：`oldMatch ∨ newMatch` |
| C-1 `update`，`oldValue` 为 live Y 载体 | 内容已被 Yjs 清空（Yjs-3 W1/Z1） | **不可判** | 保守：通知 |
| C-1 `delete`，`oldValue` 为 plain 数据 | plain 快照 | **可判** | 精确：`oldMatch`（新态缺席恒不匹配） |
| C-1 `delete`，`oldValue` 为 live Y 载体 | 内容已清空（W2） | **不可判** | 保守：通知 |
| C-2 嵌套事件（条目为 live `Y.Map`，任意深度） | **AC7 逐字：不可判** | 冻结为不可判 | 保守：通知（真变前提成立时） |

**为何不取精确分支**（SA6 §15-1 允许的替代：利用 Yjs-1 字段级 `oldValue` 或「字段未变更 ⇒ 旧态=现态」
精确抑制 N2）：

1. **规范逐字**：issue AC7 与 ADR L59 均明文「嵌套 Y.Map 部分更新 → 保守通知」；SA8 行 11 按
   implements-existing-decision 归类。精确抑制会把公共通知语义收紧到 ADR/issue 均未承诺的面。
2. **实现耦合风险**：精确分支依赖「谓词字段 ∉ 本事件 keys ⇒ 该字段本事务未变」与 Yjs 事件形状
   （字段级 oldValue 在场性）的实现级事实——该事实未被 ADR 冻结；Yjs 升级或事件投递形状变化时，
   精确抑制直接退化为**静默漏通知**（宁多勿漏下唯一不可接受结局）。
3. **不对称代价**：保守多通知 = 消费方多拉一次（可接受，ADR L58）；错误精确 = 消费方永久持有过时
   数据（不可接受）。
4. **观察器最小侵入**：保守分支下 C-2 路径**零新增 live 读**（不需要从 ROOT 走树读条目现值）；
   C-1 的新值读复用 `isRealChange` 已做的 `event.target.get(key)`。
5. **契约稳定性**：SA6 矩阵 N2/N6 默认值即「必须通知」；实现与契约默认一致，测试不漂移。

降噪收益保留面：C-1 侧（add/update-plain/delete-plain）全部精确——新增条目、plain 条目整替/删除
这些高频降噪场景仍被精确过滤（N7/N8/N9 首红行）；保守面只剩嵌套 in-place 写与 live 载体整替/删除
（后者本就是全量替换场景，消费方拉终态成本与条目数无关）。

**与 AC4/AC5 的相容性核验**：同值写（含谓词字段自身的同值写，Yjs-2）由 T1 `isRealChange` 前置过滤，
保守分支不复活它；AC5「不匹配不通知」仅在旧态可判处成立（SA8 行 9 合取解释），与本表一致。

### 7.2 F-2：标量域闭包 —— fail-closed 收口

门⑥-c 的域分类（全部在 ref 追尽 + `optional` 透明之后，复用 `resolved.aliases` 值侧闭包）：

| 追尽后 kind | 裁定 | 说明 |
|---|---|---|
| `scalar{type:'string'|'number'|'boolean'}` | **接受** | ADR L27「string / number / boolean」 |
| `enum`（字面量联合） | **接受** | ADR L27「字面量」 |
| `pattern`（string 域）/ `int` / `range`（number 域） | **接受** | 数值约束叶子（`derived.ts` L50–55），值域恒标量 |
| `object` / `array` / `xml` | **拒绝**（非标量域 message） | 容器/不透明终态 |
| `union`（**一切** union，含全标量成员） | **拒绝**（非标量域 message） | ADR 未冻结；接受属纯放宽演进（未来加法，须过设计评审——ADR L31 同款治理）；fail-closed 防成员漂移 |
| `scalar{'null'}` / `scalar{'unknown'}` | **拒绝**（非标量域 message） | null 域恒不匹配=死谓词；unknown 域无标量保证 |
| ref 追尽失败（环/目标缺席） | **拒绝**（field 不存在 message） | 防御面（T1 `resolveCarrierKind` 同款收敛） |

**附加冻结（E5b 推广）**：谓词 field 的解析基准 = 订阅容器值域的**统一条目值域**，其载体是值侧
object schema 上名为 `<key>` 的字段（Schema-1；Record 物化位）。容器值域（追尽后）为 object kind 但
**无 `<key>` 字段**（封闭对象 map，如 T1 fixture `meta`）⇒ 条目值域不统一（各成员各异）⇒ **一切
field → `WATCH_MAP_OPTIONS_INVALID`**（条目无统一值域 message）。理由：① 与 SA6 E5b（标量条目
容器任意 field 拒绝）同构统一——标量条目容器追尽后 `<key>` 字段存在但值为标量（无成员可查），
封闭 map 则连统一元素域都不存在，两者都是「条目无成员语义」的 loud 拒绝；② 替代案（对封闭 map
逐成员求 field 存在性并按「缺失恒不匹配」静默吞掉无该字段的成员）会制造 field 拼写错误的静默死面
（部分成员恒不匹配），违背「建立后零参数错误 + 非法响亮拒绝」精神；③ 封闭 map 的条目键是固定
小集，key 级消费方过滤一行可得（ADR L30 同款理由）。`Record<string, 标量>` 容器：`<key>` 字段
追尽后为标量 kind（非 object）⇒ 同样拒绝（条目无成员）。

### 7.3 F-3：`where` 形态错误 —— 封闭小集 fail-closed

词形（类型面与运行时门双重收口）：

```ts
where?: { field: string; equals: ScalarValue } | { field: string; in: ScalarValue[] }
```

运行时门⑥-a/b 逐条收敛到 `WATCH_MAP_OPTIONS_INVALID`（六条 cause 区分 message，§8.2）：
`options` 非法（缺省/undefined 之外的：非 plain 对象 / 数组 / accessor 属性 / 未知键 / Proxy 陷阱）；
`where` 非法（非 plain 对象 / 未知键 / 缺 `field` / 缺算子 / 双算子 / `field` 非 string / `equals` 值
非标量 / `in` 非数组 / `in` 成员非标量）；`in: []`（ADR L29 空数组响亮拒绝）；schema 侧三情形
（§7.2）。理由：封闭小集 + 「建立后通知流零参数错误」（ADR L39）的必然延伸——静默接受任何
词表外形态 = 接受一个语义未定义的死订阅（ADR L85 静默死亡形态的对偶预防）；对齐
`WINDOW_OPTIONS_INVALID` 规则非法拒绝风格（ADR L29 明文对齐要求）。

### 7.4 F-4：标量相等 —— SameValue 单源

- 恰一个比较函数 `scalarSame(a, b) = Object.is(a, b)`（NaN=NaN、-0≠+0），`equals` 与 `in` 共用；
- `in` 成员判定 = 存在量词线性扫描 `values.some(m => Object.is(m, candidate))`——**不用 `Set`**
  （Set 为 SameValueZero，±0 语义与 equals 撕裂；词表为小闭集，线性扫描无成本意义差异）；
- 顺序无关、去重由存在量词自然成立（N12 两形态逐字同构）；
- 先例对齐：`replication-session.ts` L972/L992 值投影 primitive 相等即 SameValue（「NaN=NaN、
  -0≠0——round-1 语义延续」）——仓内既有语义，非新造；
- 承重断言只用无歧义标量（`'open'`、`1`、`true`）；NaN/±0 边界进矩阵为**非承重文档行**
  （N12b：`equals: NaN` 匹配字段值 NaN；`-0` 与 `+0` 互不匹配）。

### 7.5 F-5：命名与导出面 —— 前缀公式，最小充分导出

- runtime：`NamespaceRuntimeWatchMapOptions`（options 袋 interface）、
  `NamespaceRuntimeWatchMapScalarValue`（= `string | number | boolean`）；`where` 联合类型
  （`NamespaceRuntimeWatchMapWhere`）定义于 `watch-map.ts` 模块内但**不经 index 导出**（沿窗口读
  先例——只导出 Options 袋；消费方结构可达 `NonNullable<Options['where']>`）；
- registry：`NamespaceLeaseWatchMapOptions` / `NamespaceLeaseWatchMapScalarValue` 单源同义别名 +
  `lease.ts` Equal 锁（§8.5）；
- 否决裸名 `ScalarValue`：两包 index 全部 `Namespace{Runtime,Lease}*` 前缀（实读导出面），裸名违反
  命名卫生且与 ADR 文中记法（非导出名）混淆；
- 值导出面不变：两包 index 值导出仍恰原有键（type-only 追加）。

### 7.6 主要备选方案与弃选理由（汇总）

| 备选 | 弃选理由 |
|---|---|
| 嵌套事件精确抑制（字段级 oldValue / 未变更即旧态） | §7.1 五点；公共语义耦合 Yjs 事件内部形状，漏通知风险不可收回 |
| `union` 全标量成员接受 | ADR 未冻结；纯放宽演进留待设计评审（ADR L31）；fail-closed 默认可后向加法放宽 |
| `in` 用 `Set` 判成员 | SameValueZero 与 equals 的 Object.is 撕裂（±0）；单源比较优先 |
| 封闭 map 逐成员 field 求值 | 制造静默死面（§7.2 附加冻结理由②） |
| options 袋承载更多旋钮（如容量/节流） | 数值不进公共契约（ADR §6）；T4 的注入位是构造参数，不是 options |
| 谓词在 registry lease 层求值 | ADR §7 分层：谓词求值属 runtime；lease 零解释原样透传（SA8 行 19） |
| 建立后按快照缓存条目匹配态 | 订阅是机制不是数据快照（ADR §3）；判定只依赖事件内新旧两态 + 现值读，零缓存零状态 |

---

## 8. 设计：接口、状态机、数据流

### 8.1 公共 API 与类型（纯加法加宽）

**签名冻结（B-1 对账，SA8 Action 1）**：

```ts
// runtime（watch-map.ts 模块面 + runtime.ts 成员面 + index 导出）
watchMap(
  path: readonly (string | number)[],
  listener: (notification: NamespaceRuntimeWatchMapNotification) => void,
  options?: NamespaceRuntimeWatchMapOptions,
): NamespaceRuntimeWatchMapHandle;

export type NamespaceRuntimeWatchMapScalarValue = string | number | boolean;

export interface NamespaceRuntimeWatchMapOptions {
  readonly where?:
    | { readonly field: string; readonly equals: NamespaceRuntimeWatchMapScalarValue }
    | { readonly field: string; readonly in: readonly NamespaceRuntimeWatchMapScalarValue[] };
}
```

- 省略 `options` / `undefined` / `{}` / `{where: undefined}`（present-undefined 剥离）⇒ **无谓词，
  T1 行为逐字不变**（E10/NC1）；
- 类型面 fail-closed：对象字面量 excess property 检查使未知算子/未知键/双算子在 `tsc` 下红
  （surface 负例）；动态构造绕过类型面时由运行时门⑥ 收口；
- registry 侧同形加宽（`types.ts` lease 成员 + 别名；`lease.ts` 透传），lease 恰 16 键不变。

### 8.2 建立状态机：第⑥门（谓词校验）—— 全同步、次序冻结、失败零登记

在 T1 既有 ① lifecycle → ② listener → ③ schema → ③b ROOT 载体 → ④ path 快照 → ⑤ schema 分类
之后、⑦ 登记之前插入（B-9；SA8 Action 3；P2/P5/P6 负控保持）：

```
⑥-a options 敌意形状校验（零 [[Get]] 纪律，镜像 canonicalWindowBudget）：
    undefined → 无谓词，跳至 ⑦
    非 plain 对象 / 数组 / 原型非 Object.prototype|null / accessor 属性 / 未知键（键集恰 {where}）
    / 取描述符期 trap 异常 → throw OPTIONS_INVALID（options 形状 message）
    present-undefined 的 where 剥离（≡ 缺席）
⑥-b where 敌意形状校验（同款零 [[Get]] 纪律）：
    非_plain/数组/原型/accessor/未知键 → throw（where 词形 message）
    键集必须恰 {field} ∪ 恰一算子键：缺 field / field 非 string / 缺算子 / 双算子
    / equals 值非 string|number|boolean → throw（where 词形 message）
    in 必须 Array.isArray 且逐成员（索引读，try/catch 收编陷阱）为标量 → 否则 throw
    （where 词形 message；成员级陷阱异常同收）
    in.length === 0 → throw（in 空数组 message）
⑥-c field 的 schema 侧解析（纯 schema，零 live 载体探测；仅用门⑤ 已得
    resolved.valueSchema + resolved.aliases，零二次 resolveSchemaAtPath 调用）：
    container 值域 ref/optional 追尽（复用 resolveCarrierKind 同款循环）→ object kind
    （门⑤ 已保证）→ 查 fields 中名 '<key>' 的字段：
      无 '<key>' 字段（封闭 map）→ throw（条目无统一值域 message）   [F-2 附加冻结]
      有 → 元素域 = 该字段 value，ref/optional 追尽：
        非 object kind（标量条目容器）→ throw（条目无统一值域 message）[E5b]
        object kind → 查 fields 中名 === field 的成员：
          无 → throw（field 不存在 message）                         [E4]
          有 → 成员域 ref/optional 追尽：
            §7.2 接受集 → 通过；拒绝集 → throw（非标量域 message）    [E5]
            追尽失败（环/缺席）→ throw（field 不存在 message）
⑥-d 编译冻结谓词（快照纪律——绝不保留调用方对象）：
    { op:'equals', field, value } 或 { op:'in', field, values: Object.freeze([...去重副本]) }
    深冻结普通对象；此后订阅存续期只读
⑦ 登记（订阅对象新增 readonly predicate: CompiledWatchPredicate | undefined）
```

**message 常量表**（单点于 watch-map.ts；`WatchMapError` 构造器自动 `${code}: ` 前缀；全部非空、
互相可区分、零 path/field/值回显）：

| cause | message 要义 |
|---|---|
| options 形状 | options 形状非法（封闭形状 `{where?}`、own-property 语义、零 accessor——对齐窗口读 options 敌意通道纪律）；本调用零订阅建立 |
| where 词形 | where 词形非法（封闭小集 `{field, equals}` \| `{field, in}` 恰一算子；未知键/缺算子/双算子/field 非 string/算子值非标量 fail-closed）；本调用零订阅建立 |
| in 空数组 | in 为空数组（恒不匹配的订阅是配置错误——响亮拒绝，对齐 WINDOW_OPTIONS_INVALID 规则非法拒绝风格）；本调用零订阅建立 |
| field 不存在 | 谓词 field 不在条目值域中（建立判定全部由 active schema 完成）；本调用零订阅建立 |
| 条目无统一值域 | 容器条目无统一值域（封闭对象 map / 标量条目容器——条目无成员语义，key 级过滤不在词表）；本调用零订阅建立 |
| 非标量域 | 谓词 field 值域非标量（值域恒标量：string/number/boolean/字面量；容器/联合/unknown 域拒绝）；本调用零订阅建立 |

门内子序冻结（测试锚定）：options 形状 → where 形状 → in 空数组 → field 不存在 → 条目无统一值域
→ 非标量域（形态错误优先于 schema 侧错误；同码异 message，E7/E4/E5b/E6 行按此可判）。

### 8.3 通知期判定算法（观察器内纯读；零 throw；槽外）

`collectChanges(events, containerPath, predicate?)` —— T1 骨架不变，C-1/C-2 分支各加谓词层；
逐 key 判定包 try/catch（**单 key 求值异常 → 该 key 保守通知**，同事务其他 key 不受影响；外层
观察器整体吞没红线保持——SA8 Action 5）：

```
值读取与匹配（纯函数）：
  readMemberScalar(entryValue, field):
    Y.Map 实例        → entryValue.get(field)        // 现值读（事务已提交，观察器期安全）
    plain record      → Object.hasOwn → own 值        // 零原型链读
    其他（标量条目值/array/Y.Array/undefined/null/…）→ 无成员 → 恒不匹配
    结果仅当 typeof ∈ {string,number,boolean} 才是比较候选；null/undefined/对象/Y 载体 → 恒不匹配（ADR §2 L28）
  match(candidate): op=equals → Object.is(candidate, value)
                    op=in     → values.some(m => Object.is(m, candidate))   [F-4]

C-1 容器本体事件（eventPath.length === depth），逐 [key, info] of event.changes.keys：
  isRealChange(target, key, info) 为假 → 跳过（T1 前置，AC4 不变）
  无谓词 → 产出定位符（T1 逐字）
  有谓词：
    action='add'    : newMatch = match(readMemberScalar(target.get(key))) → 命中才产出   [N7/N8]
    action='update' : prev = info.oldValue
                      isPlainData(prev)（T1 同模块单源复用）
                        → oldMatch = match(readMemberScalar(prev))；newMatch = match(readMemberScalar(next))
                        → (oldMatch ∨ newMatch) 才产出                                   [N9/N10]
                      否则（live Y 载体，内容已清空 Yjs-3）→ 保守产出                     [N6]
    action='delete' : isPlainData(prev) → oldMatch 才产出；否则保守产出                  [W2 对偶]

C-2 嵌套事件（eventPath.length > depth；entryKey = eventPath[depth] 须 string）：
  isNestedEntryChanged(event) 为假 → 跳过（T1 前置）
  无谓词 → 产出（T1 逐字）
  有谓词 → **保守产出**（F-1 冻结；不做字段级精确化、不新增走树读）                      [N2]

C-3 父路径事件 → 不产出条目定位符（T1 边界保持；T4 #390）                                [F-6]

同 key 多事件：产出取向单调（任一事件判定产出即产出）——保守/精确合取下无次序敏感；
byKey 首见序去重、一事务一通知、队列/溢出/泵/载荷全部零改动（SA8 冻结面；谓词只改
「是否通知」与 changes 的 key 集合）。
```

**为何 update/delete 的旧态判据是 `isPlainData(oldValue)`**：Yjs-3 实测 live `Y.Map` 的
oldValue 引用在场但内容已被清空——对它做 `get(field)` 会得到 undefined，把「旧态可能匹配」误判为
「缺失不匹配」= 漏通知；故旧态只在 plain 快照上求值，live 载体一律保守。

### 8.4 数据流路线

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| 建立流 | 调用方 `lease.watchMap(path, listener, options)` | 无写入（登记 `subscriptions` 集合 + `activeWatches`） | released 短路 → runtime 六门（⑥ 谓词门本设计新增）→ ⑥-d 编译冻结谓词 | 进程内订阅簿记（无持久化、无 wire） | 无 | 成功：恰 `{unsubscribe}` 句柄；失败：同步 throw `WATCH_MAP_OPTIONS_INVALID`（six cause message），零登记 | 失败路径零订阅登记、零 observer 变更；throw 原样上抛 lease 面 | E1–E11 |
| 通知流（谓词过滤） | 任意 ROOT 事务（本地受控写 / raw 事务 / 复制 apply——无过滤，T1 D8） | 事务提交（观察器只读） | `collectChanges` 逐 key：T1 真变判定 → §8.3 谓词层（逐 key try/catch → 保守） | 每订阅 FIFO 有界队列（容量/溢出语义零改动） | 单飞微任务泵槽外投递；listener 收到的 `data` 通知恰三键、定位符恰两键、不含值 | `changes` key 集合 = 通过判定的 key（首见序）；一事务一通知 | 溢出 → invalidate-all（不变）；listener throw 静默隔离（不变）；求值异常 → 该 key 保守，订阅存活 | N1–N15 |
| 旧态快照边界 | Yjs 事件 `oldValue` | Yjs 事务机（清空 live 载体内容 / 保留 plain 快照引用） | `isPlainData(oldValue)` 分流：plain → 精确；live → 保守 | 进程内瞬态（仅观察器回调期可达） | §8.3 旧态求值 | 保守/精确两分支（§7.1 表） | 读失败/异常 → 保守通知 | N6/N9/W2 行 |
| 谓词编译快照 | 门⑥-d | 订阅对象 `predicate` 字段（深冻结） | 调用方对象在读值校验后即弃（不保留引用——hostile 对象不可在通知期触达） | 进程内订阅存续期只读 | 观察器 §8.3 | 存续期判定语义恒定（schema 后续变更不重校验——T3 watch-end 边界） | 退订/释放随订阅对象一并回收（T1 生命周期面） | N14 |

无跨进程/持久化数据流变化：复制 wire、持久化、诊断日志面零接触（SA8 §5 冻结面）。

### 8.5 分层落点（ADR §7）

| 包/文件 | 改动 |
|---|---|
| `packages/namespace-runtime/src/watch-map.ts` | ⑥ 谓词门 + 编译类型 + §8.3 判定算法 + message 常量 + L36–38 边界注释更新（谓词已交付；T3/T4/T5 边界保留） |
| `packages/namespace-runtime/src/errors.ts` | append-only：`WATCH_MAP_OPTIONS_INVALID_CODE` 常量 + `WatchMapErrorCode` 联合成员（既有两码零改动） |
| `packages/namespace-runtime/src/runtime.ts` | `watchMap` 成员类型加宽（L309–312）+ wiring 加透传（L753）+ JSDoc 补谓词语义 |
| `packages/namespace-runtime/src/index.ts` | type-only +2 导出（Options / ScalarValue）+ 头注释增量段（值导出面不变） |
| `packages/namespace-registry/src/types.ts` | lease `watchMap` 成员加宽（L749–752）+ 2 别名 + L490–493 注释块更新（Options 别名已引入） |
| `packages/namespace-registry/src/lease.ts` | 透传加 `options` 位（released 短路先于透传，L347–363）+ Equal 锁新增（Options 别名 / ScalarValue 别名；`_watchMapMemberAlias` 随 Parameters 自动加宽，L499–515/L569–573 更新注册表成员） |
| `packages/namespace-registry/src/index.ts` | type-only +2 导出 + 头注释增量段 |

### 8.6 错误与注册纪律

- 新码 `WATCH_MAP_OPTIONS_INVALID` 以 append-only 进 `WatchMapErrorCode`（ADR 0008 词汇收口
  注册纪律；SA8 Action 2）；类不进 index（code+message 字符串消费——沿 `WatchMapError` 先例）；
- 既有 `WATCH_MAP_CARRIER_MISMATCH` / `WATCH_MAP_SCHEMA_UNAVAILABLE` 零改动；
- 失败全部**同步 throw**（T1 B-3 面），失败路径零订阅登记、零 observer 变更。

### 8.7 并发、幂等、生命周期

- 单线程观察器 + `maxWorkers: 1`（T1 已验证）：谓词求值在观察器同步段内完成，无交错；
- 谓词为建立期深冻结快照：存续期判定恒定，零可变状态、零缓存失效面；
- 退订幂等 / lease 释放清理 / runtime close 防御性收口全部继承 T1（谓词订阅无独立生命周期面，
  ADR 0009 + ADR 0030 §1 L18；SA8 行 23）；
- schema 变更 / doc 替换下的订阅终结（watch-end）属 T3 #389——T2 订阅在 schema 变更后沿用建立期
  编译谓词（ADR L85 已知形态，由 T3 终结信号收口；本设计不引入任何 schema-变更期重校验或静默死亡
  之外的中间态）。

---

## 9. 判定矩阵（实现相位的契约行规范；承 SA6 §12.2，按 §7 冻结更新分档）

记号：容器 `tasks: Record<string, Task>`；`Task = YMap<{ title; status?: YLeaf<string>;
state: "open"|"done"; priority: YLeaf<number>; sub?: YMap<{x}>; tags?: YLeaf<string>[] }>`；
谓词 P = `{field:'status', equals:'open'}`（除注明外）。「分档」= 必须通知 / 必须静默 / 保守（=
必须通知的保守面）。HEAD 实测 = `28faeae` 第三参被忽略。

### 通知矩阵（N 行）

| 行 | 触发（最小输入） | 判定依据 | HEAD | 目标断言 | 分档 |
|---|---|---|---|---|---|
| N1 | t1.status='open'，in-place 改 `t1.title`（C-2 嵌套） | 真变 ∧ 保守 | notify=1 `[t1]` | **通知** `[t1]` | 保守（F-1） |
| N2 | t2.status='done'，in-place 改 `t2.title`（C-2） | 真变 ∧ 保守（AC7 逐字） | notify=1 `[t2]` | **通知** `[t2]` | 保守（F-1；SA6 ★默认采纳） |
| N3 | t1.status 'open'→'done'（C-2，字段级） | oldMatch（AC6 退出匹配集） | notify=1 | **通知** `[t1]` | 必须通知 |
| N4 | t2.status 'done'→'open'（C-2） | newMatch（进入） | notify=1 | **通知** `[t2]` | 必须通知 |
| N5 | t2.status='open' 同值写（C-2） | T1 真变判定 = 假 | notify=0 | **零通知** | 必须静默（AC4） |
| N6 | t2（done）整值替换为 Y.Map `{status:'closed'}`（C-1 update，oldValue=被清空 Y.Map） | 旧态不可判（Yjs-3） | notify=1 `[t2]` | **通知** `[t2]` | 保守（F-1） |
| N7 | 新增 t9 `status:'done'`（C-1 add） | 旧态缺席可判 ∧ newMatch=false | notify=1 `[t9]` | **零通知** | 必须静默（**首红行**） |
| N8 | 同事务批量 add：t9（匹配）+ t10（非匹配） | 逐 key 精确过滤 | notify=1 `[t9,t10]` | **通知恰 `[t9]`**（t10 剔除） | 必须静默面（**首红行**；排序后 toStrictEqual） |
| N9 | plain 条目 t3（done）raw 整值替换 `{status:'closed'}`（C-1 update，oldValue=plain 快照） | 两态可读 → 精确 | notify=1 `[t3]` | **零通知** | 必须静默（**首红行**） |
| N9b | plain 条目 t3（非匹配）raw delete | oldValue plain 可判 ∧ new 缺席 | （同机制） | **零通知** | 必须静默 |
| N10 | plain 条目 t3 'done'→'open' / 反向（raw） | old/new 可读 | notify=1 | **通知** `[t3]` | 必须通知 |
| N10b | plain 条目 t3（status='open' 匹配态）raw delete | oldMatch=true | （同机制） | **通知** `[t3]` | 必须通知（退出/删除面） |
| N11 | 条目无 `status`（缺失）或值 null：in-place 改兄弟字段 / 整值替换 / 新增 | 缺失·null 恒不匹配（AC3，不抛） | notify=1（in-place/替换） | in-place/替换 → **通知**（保守）；add/plain → 按各自行静默；**零 error kind、零 throw** | 边界（保守 + 精确并存行） |
| N12 | `in:['open','open','blocked']` vs `in:['blocked','open']` 全行同学；`in:[]` 建立拒绝 | 存在量词（顺序无关、去重） | 两形态均建立且不过滤 | 两形态行为**逐字节同构**；空数组 → `WATCH_MAP_OPTIONS_INVALID` | 必须静默面 + 建立拒绝（AC1） |
| N12b | `equals:NaN` × 字段值 NaN；`equals:0` × 字段值 -0 | SameValue（F-4） | —（今日无谓词） | NaN 匹配 NaN；±0 互不匹配 | 非承重文档行（冻结语义锚） |
| N13 | 任意匹配行通知载荷 | 冻结面零改动 | 三键/两键形状在产 | `{kind,origin,changes}` 恰三键、定位符恰两键、JSON 不含值、kind ∈ 三 kind 闭集 | 必须不变 |
| N14 | 建立后 `unsubscribe()` 重复调用 / lease 释放后写 / 释放清理谓词订阅 | T1 生命周期 | 21/21 绿 | 退订幂等零回声；释放清理含谓词订阅（T1 行保持） | 必须不变 |
| N15 | 谓词求值期数据异常：raw 写入标量条目值 / `status` 字段值为对象（数据偏离 schema）/ 深层嵌套数据 + 后续合法写 | 槽外零 throw 红线（SA8 Action 5） | mutateData ok；写不 fatal | 求值不抛、逐 key 异常 → 该 key 保守、写结果不变、通知流无 error kind、订阅存活（后续匹配变更照常通知） | 必须不变 |

### 建立矩阵（E 行）

| 行 | 触发 | 目标断言 | HEAD |
|---|---|---|---|
| E1 | `{field:'title', equals:'alpha'}`（标量叶） | 建立成功，句柄恰 `{unsubscribe}` | 静默建立（但不过滤） |
| E2 | `{field:'priority', in:[9,2]}`（非空乱序） | 建立成功 | 同上 |
| E3 | alias 字段（`status?: Status`→scalar）/ 字面量域（`state` enum）/ 可选标量（`optional` 透明） | 三类均建立成功 | 建立成功（P3/P4） |
| E4 | `{field:'missing', equals:'x'}` | **`WATCH_MAP_OPTIONS_INVALID`** + 零登记（后续匹配变更零通知佐证零登记） | 静默建立 ← 红 |
| E5 | `{field:'sub', equals:'n'}`（object 域）；同族 `tags`（array 域） | **同码拒绝**（非标量域 message） | 静默建立 ← 红 |
| E5b | 封闭对象 map `meta` 上任意 field；`Record<string,标量>` 容器上任意 field | **同码拒绝**（条目无统一值域 message） | 静默建立 ← 红 |
| E6 | `{field:'status', in:[]}` | **同码拒绝**（in 空数组 message） | 静默建立 ← 红 |
| E7 | 形态族：无算子 / 双算子 / 未知键（`notEquals`）/ `field` 非 string / `equals` 值对象 / `in` 非数组 / `in` 成员含对象 / options 未知键 / `where` 非对象 | **同码拒绝**（where 词形 / options 形状 message；门内子序：形态先于 schema 侧） | 静默建立 ← 红 |
| E8 | 门次序：released + 非法谓词 / 无 active schema + 非法谓词 / 非法 path + 非法谓词 | 抛更早门的既有码（`NAMESPACE_LEASE_RELEASED` / `WATCH_MAP_SCHEMA_UNAVAILABLE` / `WATCH_MAP_CARRIER_MISMATCH`） | 绿（P2/P5/P6；必须保持） |
| E9 | 数据缺席容器（`ghost?` 未物化 / 已删除）+ 合法谓词 | 建立成功（纯 schema 侧，零 live 探测） | 绿（T1 E3 同位） |
| E10 | 省略 options / `undefined` / `{}` / `{where:undefined}` | T1 行为逐字不变（无谓词全通知） | 21/21 绿（必须保持，NC1） |
| E11 | 码与 message 纪律 | thrown `.code === 'WATCH_MAP_OPTIONS_INVALID'`；message 以码为前缀、非空；六 cause message 互相可区分；零回显（message 不含 field 名、容器路径段） | 码缺席 ← 红 |

---

## 10. 测试结构（实现相位落盘；本设计不落盘测试）

### 10.1 文件与采集

| 路径 | 内容 | 采集 |
|---|---|---|
| `packages/namespace-registry/test/issue-388-watch-map-predicate-fixture.ts` | 共享 fixture（§10.2）；非测试文件 | 不被收集（include 只收 `*.test.ts`/`*.test-d.ts`，`vitest.config.ts` L15/L20） |
| `packages/namespace-registry/test/issue-388-watch-map-predicate-red.test.ts` | 行为契约：§9 E/N 全行 + 负控 | `packages/*/test/**/*.test.ts` |
| `packages/namespace-registry/test/issue-388-watch-map-predicate-surface.test-d.ts` | 类型契约（§10.4） | `packages/*/test/**/*.test-d.ts`（typecheck） |

### 10.2 fixture（T1 fixture 形态延续 + 单点）

- schema：§9 记号（`Status` 别名 / 可选 `status` / enum `state` / `priority` / 嵌套 `sub` / array 域
  `tags`；ROOT：`tasks` + `ghost?`（缺席面）+ `workRecords`（数组载体）+ `title`（根标量）+ `meta`
  （封闭 map））。**plain 面修正（F-6）**：`tasks` 为 Y.Map 容器，构造期以 raw
  `tasks.set('t3', {title:'gamma', status:'done', …})` 种入 **plain 条目**（不用独立 plain 容器——
  整容器替换是父路径 C-3 死面，实测 `-probe-plain-replace.log` N1）；
- 装配：沿 T1 `openWatchLease` 同款（`createNamespaceRegistryForTesting` + StubPersistence +
  deterministicRandomBytes + runtimeFactory 保留引用 + schema settle poll）；可复用 T1 fixture 已导出
  的 `NotificationSink`（import，不复制）；
- **单点**：本 fixture 自持 `watchMapOf` / `attemptEstablishWatch` / `establishWatch` 的
  **options 位版本**（T1 文件零改动 → NC1 锚稳定）；另提供 raw 驱动 helper
  （`rawTransact(fixture, fn)` = `fixture.doc.transact(fn)`，标注「非受控来源」）；
- oracle：谓词匹配预言机 = `lease.readData([...path, key])` 投影值的 field 在场性/null 判定
  （成功形状断言必须经 `expectReadDataOkKeys`——`packages/namespace-runtime/test/helpers/readdata-ok-shape.ts`，
  #333/#336/#364 验收门，禁内联四键字面量）。

### 10.3 行为契约（red）纪律（SA6 §12.5 全款承接）

1. 只观察 lease 公共面运行时行为（建立结果 / thrown `code` / 通知对象与序列），零 grep/源码文本断言；
2. 精确形状：通知恰三键、定位符恰两键、句柄恰 `{unsubscribe}`、失败 code 逐字相等；零
   `expect.anything()`、零吞错、零 skip/only/todo、零 env override；
3. 异步确定性：`expect.poll`（5ms/2s）+ 屏障（后续事务或第二订阅）表达「送达」与「零通知」；禁 sleep；
4. 逐 key 断言：混合事务行对 `changes` key 集合排序后 `toStrictEqual`，不用「至少含」软化承重行；
5. 分档标注：每行注明必须通知/必须静默/保守；**红证据只取** N7/N8/N9(+N9b)/E4–E7/E5b/E11 +
   类型面（N2/N6 保守行 HEAD 已绿，不作为能力缺口证据——反伪绿）；
6. describe/it 结构：`组 E（建立判定）`、`组 N（判定矩阵）`、`边界行（SameValue）`、
   `负控（NC：门次序 / 同值写 / 读面冻结 / lease 16 键 / T1 无谓词回归引用）`——行号注释映射 §9；
7. NC 行：门次序（P2/P5/P6 同构）、同值写零通知、readData 四键 helper + readMap 在产 +
   `WINDOW_CARRIER_MISMATCH` 零改动、lease 恰 16 键（`watchMap` 原位加宽不新增键）、
   「T1 三件套不改且全绿」由 runner 既有文件自身保证（不在本文件重复实现）。

### 10.4 类型契约（surface）内容

- 正例：三参调用 `{ where: { field:'status', equals:'open' } }` / `{ where: { field:'status',
  in:['open'] } }` 编译通过并返回 `{unsubscribe}`；两参调用仍编译（T1 兼容）；
- 别名 Equal 锁：`Equal<NamespaceLeaseWatchMapOptions, Parameters<NamespaceLease['watchMap']>[2]>`、
  `Equal<NamespaceLeaseWatchMapScalarValue, string|number|boolean>`、options 袋键集恰 `['where']`、
  `where` 两成员判别窄化（`'equals' in w` / `'in' in w`）；
- 负例 `@ts-expect-error`：未知算子（`notEquals`）/ 双算子 / 缺算子 / `field` 非 string /
  `equals` 对象值 / `in` 非数组 / `in` 成员含对象 / options 未知键。

---

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因（正文锚点） |
|---|---|---|
| `packages/namespace-runtime/src/watch-map.ts` | 门⑥（a–d）+ 编译谓词类型 + §8.3 C-1/C-2 谓词层 + 逐 key try/catch + 六条 message 常量 + 边界注释（L36–38）与头注释更新 | §8.2/§8.3 |
| `packages/namespace-runtime/src/errors.ts` | append-only 追加 `WATCH_MAP_OPTIONS_INVALID_CODE` + `WatchMapErrorCode` 联合成员（仅此两行级改动） | §8.6；SA8 Action 2 |
| `packages/namespace-runtime/src/runtime.ts` | `watchMap` 成员类型/JSDoc 加宽（L285–312）+ wiring 透传（L753） | §8.1/§8.5 |
| `packages/namespace-runtime/src/index.ts` | type-only +2 导出 + 头注释增量段 | §7.5/§8.5 |
| `packages/namespace-registry/src/types.ts` | lease 成员加宽 + 2 别名 + L490–493 注释更新 | §8.1/§8.5 |
| `packages/namespace-registry/src/lease.ts` | options 透传 + Equal 锁新增/成员注册更新 | §8.5 |
| `packages/namespace-registry/src/index.ts` | type-only +2 导出 + 头注释增量段 | §8.5 |
| `packages/namespace-registry/test/issue-388-watch-map-predicate-fixture.ts` | 新建共享 fixture（§10.2） | §10 |
| `packages/namespace-registry/test/issue-388-watch-map-predicate-red.test.ts` | 新建行为契约（§9/§10.3） | §10 |
| `packages/namespace-registry/test/issue-388-watch-map-predicate-surface.test-d.ts` | 新建类型契约（§10.4） | §10 |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `docs/adr/0030-change-subscription.md`、`docs/adr/`（全集） | 规范权威 | SA8 判定全部 implements-existing-decision，零 evolution-required；设计不得改判决策文本 |
| `CONTEXT.md` | 文档缝 | T5 #391；词条已覆盖谓词口径（L65–67） |
| `docs/protocols/instance-replication-v1.md`、`packages/ws-replication/**`、`packages/replication-protocol-v1/**`、`packages/persistence/**` | 复制 wire/持久化冻结面 | 通知不出进程（ADR §7 L73）；SA8 §5 零 diff 复核面。**ws-replication 并非零消费**（SA2-1）：`src/testing.ts` `decorateLease` L50 以 `lease.watchMap.bind(lease)` 组装 `NamespaceLease` 型门面并经 `exports['./testing']` 发布——`.bind` 保形使签名加宽**零改动兼容**（依据见 §13 行 4），DENY 维持（兼容性来自 bind 保形，非零消费） |
| `packages/vfsl/**` | schema 解析被消费方 | `resolveSchemaAtPath`/`derived` 现有能力已满足门⑥（Schema-1/2）；零 vfsl 改动防规范面漂移 |
| `packages/namespace-diagnostic-log/**` | 诊断面 | 不混用为通知通道（ADR 验收 L97；SA8 行 26） |
| `packages/namespace-runtime/src/window-read.ts`、`read-schema-projection.ts`、`plain-data.ts` | 读面/共享工具冻结 | 只 import 复用（isPlainRecord/isPlainData 同模块单源）；窗口读面零改动 |
| `packages/namespace-registry/src/registry.ts` | Registry 服务字面量 | ADR 0023 冻结面；本任务落 lease 返回值面（SA8 行 22） |
| `packages/namespace-registry/test/issue-387-watch-map-*.ts`（三件套） | T1 回归锚 | NC1 基线（21/21 须在实现后原样保持绿）；fixture 单点在新文件自持（§10.2） |
| `packages/namespace-runtime/test/helpers/readdata-ok-shape.ts` | 集中化形状 helper | 只 import；#333/#336/#364 验收门 |
| `vitest.config.ts`、`tsconfig*.json`、根 `package.json` | 测试/类型入口 | include 正则已覆盖新三件套（SA6 §14 采集实证）；零入口改动 |
| `packages/`（其余包）、`apps/**`、`domains/**`、`scripts/**` | 无接触面 | 零关联 |

---

## 12. 验收与验证映射

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1 谓词词表 + `in` 集合语义 | SA6 §5 证据 1（今日静默建立） | E1/E2/E3/E12 + N12/N12b | 两算子建立成功；`in` 乱序/去重同构；空数组/词表外形态同码拒绝 |
| AC2 建立期裁决 + 建立后零参数错误 | SA6 §5 证据 1/4；`-probe-mixed-gates.log` | E4–E8/E11 + N15 | 三情形 + 形态族同步 throw `WATCH_MAP_OPTIONS_INVALID`；门次序不回退（E8）；通知流零 error kind（N15） |
| AC3 缺失/null 恒不匹配 | ADR L28；`-probe-semantics.log` A 行 | N11 | 不抛、不产生 error kind；通知按载体行分档 |
| AC4 同值写不通知 | NC5（R5=0 在产） | N5 | 谓词形态下同值写仍零通知（真变判定前置） |
| AC5 匹配通知 / 不匹配（可判时）静默 | SA6 §11-5 合取解释 | N1/N4/N7/N8 | 合取边界显式成行；降噪面（N7/N8）精确静默 |
| AC6 退出匹配集通知 | `-probe-semantics.log` C 行 | N3/N10/N10b | 旧匹配新不匹配 → 通知（含 plain delete 面） |
| AC7 保守分支（F-1 冻结粒度） | Yjs-3（W1/W2/Z1）；`-probe-judgeability.log` | N2/N6（保守必须通知）+ N9/N9b（plain 精确静默）对偶行 | 嵌套/live 整替保守；plain 快照两态精确 |
| AC8 判定矩阵契约测试（先例 = 窗口读家族） | SA6 §14（runner 采集 54 文件实证） | §10 三件套 + 实现后 `vitest list` 采集行 | 三件套被 include 正则采集；红→绿全档 |
| SA8 Action 1 签名对账 | T1 设计 §7-B2；`types.ts` L493 | surface 正例/别名 Equal 锁 | 三参编译 + 两参兼容 + 两包别名 Equal |
| SA8 Action 5 槽外零 throw | T1 红线（`watch-map.ts` L374–392） | N15 | 求值异常 → 该 key 保守；写结果不变；订阅存活 |
| 纯加法不回退 | SA6 §4 基线全绿 | T1 三件套（不改）+ E10/NC 行 + registry 包全量 + **根 `pnpm typecheck` + 根 `pnpm test`**（模块 AGENTS 强制门，逐字：「Run root `pnpm typecheck` and `pnpm test` before completing any runtime or replication contract change」——`packages/namespace-runtime/AGENTS.md` 验证节；本设计改 runtime 公共契约，直接适用；`packages/namespace-registry/AGENTS.md` 同款） | T1 21/21、registry 41 文件/496+新增、typecheck exit 0（14 包 tsconfig）、**root `pnpm test`（`vitest run --typecheck` 全 workspace）全绿**——含 ws-replication 套件、九替身与四审计文件 |
| SA2-1 调用面兼容（ws-replication testing 门面 / registry 九测试替身 / 四键审计表） | 本设计 §13 行 4–6（兼容性依据：`.bind` 保形 / 少参实现恒可赋值 / 键审计与类型加宽正交）；HEAD 全树 grep 89 命中分类收口 | 根 `pnpm typecheck`（含 `tsc -p packages/ws-replication/tsconfig.json`，include `src/**/*.ts` 覆盖 testing.ts 门面）+ 根 `pnpm test`（`vitest run --typecheck`，聚合程序 `tsconfig.typecheck.json` include 同时覆盖 `packages/*/src/**/*.ts` 与 `packages/*/test/**/*.ts`——九替身在程序内；ws-replication 套件含 `ws-replication-auth-lifecycle-red.test.ts` 实跑 `createHubReplicationForTesting` 装饰门面） | **零改动兼容**：ws-replication 与全部替身/审计文件零 diff 全绿（§11 DENY 维持）；门面经 bind 自动携带加宽后签名 |
| lease 16 键不变 | T1 P1 | NC 行 | `Object.keys(lease)` 恰 16 键 |
| 冻结面零 diff | SA8 §5 | 实现后 diff 复核 | readData/窗口读/复制/诊断面零改动 |
| 首红证据（实现前） | SA6 §13 | N7/N8/N9 + E4–E7/E5b/E11 + surface 负例在 HEAD 红 | 红=能力缺口（静默建立/多通知/类型缺席），非环境噪声 |

---

## 13. 调用方影响矩阵

`watchMap` 在 HEAD 的全树调用面（本设计实读 grep 89 命中，分类收口；修正 iteration 0 的
「生产消费方为零」错误断言——SA2-1）：

| # | 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|---|
| 1 | lease 消费方（DSH agent / 宿主 UI，未来时态） | `watchMap(path, listener)` 无谓词全通知 | 可传第三参 `{where}`；不传则行为逐字不变 | 零强制（纯加法） | §8.1；E10/NC1 |
| 2 | T1 契约三件套（既有测试 + fixture） | 两参调用断言；fixture `watchMapOf` 的结构提取位已含 `options?: unknown` 第三位（L273） | 两参行为不变；`[Path, Listener] extends Parameters` 仍真（可选参尾加宽）；结构位对宽签名恒可满足 | **零改动**（DENY 保持） | `issue-387-watch-map-lease-surface.test-d.ts` L32/L105–111；`issue-387-watch-map-fixture.ts` L269–274；NC1 |
| 3 | `runtime.ts` wiring / `lease.ts` 透传 | 2 变量透传 | 3 变量透传（options raw 引用直传，lease 层零解释） | ALLOW 内同步改 | `runtime.ts` L753；`lease.ts` L347–363 |
| 4 | **`@nomicore/ws-replication/testing` 装饰门面（`decorateLease`）——shipped 签名消费方**：src 文件（非测试目录），经 `packages/ws-replication/package.json` `exports['./testing']` 发布 | L50 `watchMap: lease.watchMap.bind(lease)` 组入返回类型为 `NamespaceLease` 的 `Object.freeze` 门面；由 `createHubReplicationForTesting`（L90–114）装配 hub 复制测试 registry Proxy | **`.bind` 保形**：绑定引用的 TS 类型 = `NamespaceLease['watchMap']` 当前全签名，成员加宽时门面成员类型随源类型**自动同步加宽**，对象字面量对 `NamespaceLease` 的结构可赋值性保持；第三参经绑定函数原样透传底层 lease（门面零解释，与 lease 层同纪律） | **零改动**（§11 DENY 维持——兼容性来自 bind 保形，**非零消费**） | `packages/ws-replication/src/testing.ts` L38–50/L88（门面返回 `NamespaceLease`）；`package.json` `"./testing"` 出口；套件消费方 `ws-replication/test/ws-replication-auth-lifecycle-red.test.ts`（root `pnpm test` 实跑） |
| 5 | **registry 测试替身（9 文件 mock runtime `watchMap` 实现）**：方法形零参 `watchMap(): NamespaceRuntimeWatchMapHandle { throw }` × 5（`registry-sa7-hostile` L191 / `registry-idle` L268 / `registry-shutdown` L215 / `registry-sa7-rev1` L236 / `registry-sa7-concurrency` L193）+ 属性形 `watchMap: () => { throw }` × 4（`registry-readdata-projection-text-red` L113 / `registry-readdata-budget-passthrough` L123 / `registry-open` L191 / `issue-369-window-read-lease-contract-red` L887） | 零参实现恒 throw（替身不消费订阅；注释自证「键集义务纯加法，既有断言零改动」） | **TS 少参可赋值性**：`() => Handle` 恒可赋值给加宽后的 `(path, listener, options?) => Handle`——替身对象对宽 `NamespaceRuntime` 形状的满足不依赖参数个数 | **零改动** | 上列 9 文件 9 行（本设计实读逐一核对） |
| 6 | **键审计表（4 处字符串键集断言）**：runtime 键集 × 3（`runtime-close-lifecycle.test.ts` L179、`runtime-registry-internal-seam.test.ts` L292、`runtime-phase5-reset-fence-r2.test.ts` L145）+ lease 键集 × 1（`registry-open.test.ts` L942） | `'watchMap'` 作为**键名**进 `toStrictEqual` 排序键集 | 签名**原位加宽不新增键**（§8.1：lease 恰 16 键不变）⇒ 键集断言与参数类型正交，零影响 | **零改动** | 上列 4 文件 4 行（本设计实读） |
| 7 | `lease.ts` Equal 锁（编译期断言） | 5 个 watchMap 锁 | `_watchMapMemberAlias` 随 Parameters 自动加宽；新增 Options/ScalarValue 两锁 | ALLOW 内同步改 | `lease.ts` L499–515/L569–573 |
| 8 | 观察器内部（`collectChanges`/`isRealChange`） | 真变判定 | 加谓词层（真变判定不动） | ALLOW 内同步改 | §8.3 |
| 9 | 复制 / 持久化 / 诊断 / 窗口读消费方（运行时行为面） | 无接触 | 无接触（谓词不出 runtime 订阅面；ws-replication 的**签名面**消费单列行 4） | 零 | ADR §7 L73；SA8 §5 |

**收口结论（SA2-1 修订）**：HEAD 调用面全集 = lease/runtime wiring（行 3，ALLOW 内改）+
T1 测试族（行 2）+ ws-replication testing 门面（行 4，**shipped 签名消费方**）+ 9 个 registry
测试替身（行 5）+ 4 处键审计表（行 6）。除行 3/7/8（ALLOW 内同步改）外全部**零改动兼容**，
依据：`.bind` 保形（行 4）、少参实现恒可赋值（行 5）、键审计与类型加宽正交（行 6）。兼容性
验证门 = 根 `pnpm typecheck` + 根 `pnpm test`（§12 两行明列；模块 AGENTS 强制）。iteration 0 的
「生产消费方为零（T2 即首次交付该能力）」表述**作废并更正**为：谓词**能力**（第三参语义）确为
T2 首次交付，但签名消费方在 HEAD 已存在（行 4–6），这正是 §12 验证集必须含 root `pnpm test` 的原因。

---

## 14. 风险、回滚和残余问题

| 风险 | 评级 | 处置 |
|---|---|---|
| 保守分支对嵌套非匹配条目多通知（降噪不全） | 低（接受） | 宁多勿漏下恒安全（ADR L58）；精确化属词表演进须过设计评审（ADR L31 同款治理），非本票 |
| C-1 旧态判据依赖 Yjs「live oldValue 内容清空」行为 | 中 | W1/W2/Z1 三探针实测锚定 + N6/N9 矩阵行钉死；若 Yjs 行为变化，矩阵行红即报警（fail-loud 而非静默漏） |
| 敌意 options/where 的 [[Get]] 陷阱 | 低 | 门⑥-a/b 零 [[Get]] 描述符纪律 + 整体 try 收编（`canonicalWindowBudget` 同款）；索引读成员值逐个标量校验 |
| 动态构造对象绕过类型面 excess property | 低 | 运行时门⑥ 同判据 fail-closed（分层收口） |
| 数据偏离 schema（标量条目值 / 字段值对象）下的求值异常 | 低 | `readMemberScalar` 全量分类 + 逐 key try/catch → 保守；N15 行锚定 |
| SameValue 语义与未来消费方直觉差异（±0） | 低 | 仓内先例对齐（replication-session L972）；N12b 文档行冻结 |
| 回滚 | 低 | 单变更集 revert 即可：无持久化/无 wire/无既有码改动；新码 append-only 回滚 = 移除联合成员（「无消费方」限定指 `WATCH_MAP_OPTIONS_INVALID` 新码在 HEAD 零存在——与 §13 行 4–6 的既有**签名**消费方不冲突：门面/替身/审计消费的是 `watchMap` 成员形状，与新错误码无关） |

**残余 / follow-up（不属本票）**：T3 #389 `watch-end`（schema 变更下谓词订阅的终结编排——本设计
显式不引入 schema-变更期重校验，沿用建立期编译谓词直至 T3 交付终结信号）；T4 #390 溢出注入 +
父路径删除/容器整替编排；T5 #391 文档缝；v2 开放问题（`watchArray`/`notEquals`/`and`/key 过滤/
含值通知/versioned read，ADR L99–107）。本票内无未解决必要条件——SA6 §15-8「无阻塞」经 §7 全项
冻结后成立。

---

## 15. 是否需要设计后 ADR 冲突复查

**需要（`requiresConflictRecheck = true`）**，与 SA8 门禁结论一致（冲突报告 §10）。理由与复查清单：

1. **公共 API 加宽**：lease/runtime `watchMap` 第三参 + 两包各 +2 type-only 导出 + Equal 锁（SA8
   Action 1/6）；
2. **新失败语义**：`WATCH_MAP_OPTIONS_INVALID` 稳定码 + 谓词非法三分支扩展为六 cause + 建立门
   ⑥（SA8 Action 2/3）；
3. **判定语义进入实现核对面**：谓词求值进通知推导路径（零 throw/槽外/逐 key 保守收编——SA8
   Action 5），矩阵红绿（Action 4）须实现后核对；
4. **DENY 面零 diff** 复核：readData / 窗口读 / 复制 / 诊断 / 持久化 / T1 三件套 / `registry.ts`。

本设计未触碰任何 ADR 冻结面或修订既有决策（SA8 0 hard-conflict / 0 evolution / 0 override 维持）；
F-1–F-6 全部冻结值落在 ADR 0030 既有条款的「逐字兑现」或「ADR 未冻结处的 fail-closed 缺省」侧，
不构成决策演进——其中 F-2 的 union/scalar-null 拒绝与 F-4 的 SameValue 若未来放宽，属加法演进、
须另行设计评审。

---

## 16. 评审修订映射

评审输入：`wiki/raw/task_issue-388_sa2_review.md`（iteration 1，verdict `reject`：1 × MAJOR
SA2-1；§7/§8 攻击记录确认核心判定算法、门⑥、AC7 保守语义、类型面、测试结构成立）。

| Finding | 修订位置 | 处理结果 |
|---|---|---|
| **SA2-1（MAJOR）**：§13 普适断言「无未覆盖调用方…生产消费方为零」为假——`packages/ws-replication/src/testing.ts` `decorateLease` 以 `lease.watchMap.bind(lease)` 构造 shipped `NamespaceLease` 型门面，另有 9 个 registry 测试替身 mock `watchMap()` 与 4 处键审计表未列；§12 验证计划漏模块 AGENTS 强制的 root `pnpm test` 门，SA4/SA7 复核面被错误收窄 | ① §13 全表重列：行 4（ws-replication testing 门面，兼容依据 = `.bind` 保形）/ 行 5（九替身，兼容依据 = 少参实现恒可赋值给宽签名）/ 行 6（四键审计表，兼容依据 = 键集断言与类型加宽正交，原位加宽不新增键）+ 收口结论替换原普适断言（「生产消费方为零」表述作废并更正）；② §12：「纯加法不回退」行验证集补 **root `pnpm test`**（`packages/namespace-runtime/AGENTS.md` 验证节逐字引用）+ 新增「SA2-1 调用面兼容」行（root typecheck + root test 的覆盖路径逐项列明）；③ §11 DENY ws-replication 行改注「testing 门面 bind 保形零改动（非零消费）」；另：头部输入清单补评审文件、§14 回滚行「无消费方」限定收窄（防同类误读） | **已落实**（①②③ 全项 + 两处一致性收口）；冻结裁定 F-1–F-6 与 §7/§8/§9/§10 判定算法/矩阵/测试结构**零改动**（按评审 §13 修订路由「不动 §7/§8/§9/§10」） |
| O1–O8（§14 non-blocking observations） | 不在本轮修订范围 | SA2 评审自明「非阻断」；本 dispatch 范围 = 仅 SA2-1。O1（N11 按载体拆行）/ O2（§12 AC1 行 E12 死引用更正）/ O3（E3 可选字段锚）/ O4（in 成员 own-descriptor 读）/ O5（types.ts 成员 JSDoc）/ O6（去重机制明示）/ O7（Yjs 同事务新建 type 不发自有事件——`addChangedTypeToTransaction` 时钟门控——补记 §2/§14 事实表）均为实现相位改进建议，转实现角色参考；不构成设计阻塞，亦不改变任何冻结裁定 |

历史：iteration 0 首产无评审输入（无 finding 可映射）；iteration 1 = 本节（SA2-1 单项落实）。
本文件为当前唯一有效设计版本，§13/§12/§11 修订处即正文现行内容，无附录式增补。
