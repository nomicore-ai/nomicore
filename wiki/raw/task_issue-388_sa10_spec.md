# SA10 Spec Review — issue #388：谓词订阅与宁多勿漏判定（变更订阅 T2）

- 被审对象：**已提交最终 diff** —— delivery commit `60cda9cfe41ee3b6e8aeffdc8f5a0c4011c2b3de`
  （`fix(#388): watchMap 谓词订阅与宁多勿漏判定（变更订阅 T2）`），其父逐字 = T1 基线
  `28faeae7a0c619e1352f05d19a83ba46e562879c`（`fix(#387)… (#395)`）——`git rev-parse 60cda9c^`
  与 `git merge-base --is-ancestor` 本轮实证；代码/测试面 = 7 个 `src` 文件（+462/−49）+
  新契约三件套（fixture 433 / red 851 / surface 164 行），另含 wiki 相位产物文档。
- 审查基准：issue #388 正文（Host brief `task_issue-388.md`：What-to-build + AC1–AC8）+
  ADR 0030（规范权威，HEAD 零 diff；决策 2 谓词词表 / 决策 3 建立判定 / 决策 5 宁多勿漏 /
  §7 分层 / 备选与验收缝）+ SA6 验收契约（`_sa6_contract.md` §12.1 绑定 B-1–B-10、§12.2
  判定矩阵 N1–N15/E1–E11、§12.5 断言纪律、§12.6 红线）+ CONTEXT.md L65–67「变更订阅」
  词条（本轮实读对账一致——词条已覆盖谓词口径，本票零文档改动合规）。
- Owner 要求：**无**（dispatch owner-feedback 快照为空：无 owner 要求 / comment ID /
  updated_at；与 SA6 §2、SA8 §2/§4、SA3、SA4、SA7 六方独立同口径）→ 无 owner override
  需映射，无「最新 owner 要求 vs 交付」冲突面。
- 方法：SA10 独立实读交付 diff 全部关键面（`watch-map.ts` 交付态全文分段实读：类型面 /
  门⑥ a–d / `readMemberScalar` / `matchPredicate` / `predicateKeepsContainerChange` /
  `collectChanges` C-1/C-2/C-3 / 分发与生命周期；`errors.ts`/`runtime.ts`/两包 `index.ts`/
  registry `types.ts`/`lease.ts` 全量 diff；契约三件套测试结构与断言抽查）+ 冻结面
  `git diff --stat 28faeae..60cda9c` 实证 + 证据日志 tail/grep 复核（**本轮日志在树**——
  `artifacts/sa3-issue388-*.log`/`sa6-issue388-*.log`/`sa7-issue388-*.log` 未跟踪但在场，
  已做 tail 级复核）；**不运行测试**，红→绿门禁数值取日志实证 + 树内结构计数对账。
- 结论：**approve** —— AC1–AC8 全部满足且有行为/类型断言锚定；SA6 绑定表 B-1–B-10
  逐项兑现；ADR 0030 决策 2/3/5 忠实（含 AC7 按 F-1 冻结的逐字保守粒度）；非目标
  （T3/T4/T5 分期面与 ADR 备选否决项）零越界；冻结面零 diff（本轮 git 实证）；红→绿
  证据链完整（独立 scratch worktree 红复现 13 failed/16 passed + 类型 1 failed →
  实现后 29/29 + 3/3 转绿）。关键 AC 无 partial/unmet/unachievable；未达成项 = 无；
  仅 4 条 MINOR 观察（承 SA4，均不阻断）与已登记的分期披露项（T3–T5，各有其票）。

---

## 1. Issue AC ↔ 交付映射（逐条裁决）

| AC | 要求 | 交付落点（本轮实读） | 契约锚 | 裁决 |
|---|---|---|---|---|
| AC1 | 谓词词表 `{field,equals}`/`{field,in}`；值域恒标量（string/number/boolean/字面量）；`in` 集合语义（顺序无关、去重） | `NamespaceRuntimeWatchMapWhere` 联合恰两成员（watch-map.ts L107–110）；⑥-b `readWatchWhere` 键集恰 `{field}` ∪ 恰一算子键、算子值逐成员 `isScalarValue`；⑥-d `in` 值集按 SameValue（`Object.is`）去重并 `Object.freeze`；`matchPredicate` 存在量词线性扫描（不用 Set，F-4） | E1/E2/E3（标量叶/乱序非空 `in`/别名·字面量·可选标量三形态建立）；N12（`['open','open','blocked']` 与 `['blocked','open']` 行为**逐字节同构**断言）；N12b（SameValue 边界文档行）；E6（空数组拒绝） | **met** |
| AC2 | 建立时按 active schema 裁决：field 不存在 / 非标量域 / `in` 空数组 → `WATCH_MAP_OPTIONS_INVALID`；建立后通知流零参数错误 | 门⑥（a options 敌意形状 → b where 词形 → `in` 空数组 → c 纯 schema 侧 field 解析[仅用门⑤ 已得 `resolved.valueSchema`+`resolved.aliases`，零 live 探测、零二次 resolve] → d 编译冻结快照）位于 ①–⑤ 之后、⑦ 登记之前（L793–807 实读）；失败**同步 throw 先于 `subscriptions.add`** = 零登记；新码 `WATCH_MAP_OPTIONS_INVALID` append-only 注册（errors.ts diff 纯追加，既有两码逐字零改动）；六 cause message 单点常量、码前缀、互可区分、零 path/field/值回显；通知路径只读深冻结 compiled 谓词——结构上零参数再校验 | E4/E5/E5b/E6/E7（五族拒绝 + 零登记佐证）；E8（门次序负控：released/schema/载体门先抛既有码）；E11（码 + message 纪律） | **met** |
| AC3 | 缺失 / null 恒不匹配，所有算子一视同仁（无 NULL 三值逻辑） | `readMemberScalar`：Y.Map→`get`、plain record→`Object.hasOwn` own 读、其余（标量条目/数组/null/undefined）→ 无成员；结果仅当 `typeof ∈ {string,number,boolean}` 为候选，否则 `undefined`；`matchPredicate(undefined)` 恒 false——两算子同一路径，无特例 | N11 (a)–(d) 四载体分支（缺失+in-place 保守 / 缺失+live 整替保守 / 缺失+add 精确静默 / plain null→匹配通知）；零 throw、零 error kind 断言 | **met** |
| AC4 | 同值写不通知：载体 delta 存在但条目投影值未变 → 语义比较过滤 | T1 `isRealChange` 前置**原样保留**（`collectChanges` C-1 逐键 `if (!isRealChange(...)) continue` 先于谓词层，L600–601 实读；`isRealChange`/`plainDataEquals` 本体 diff 零触碰）——谓词层是其后**合取**，同值写不被谓词复活 | N5（谓词字段同值写：进入通知 + 屏障恰 2 条、同值写零贡献）；NC5 | **met** |
| AC5 | 匹配条目变更 → 通知；不匹配条目变更 → 不通知（降噪存在理由） | 按 ADR L57 条件式的合取解释（SA6 §11-5 / SA8 action 4 裁决）：`predicateKeepsContainerChange`——`add`→`newMatch`（旧态=缺席可判，精确）；`update`+plain oldValue→`oldMatch ∨ newMatch`；`delete`+plain→`oldMatch`；旧态不可判（live 载体/C-2）→ 保守通知 | N7（新增非匹配**零通知**，首红行）；N8（批量 add 同事务 changes **恰 `[t9]`**，t10 剔除，首红行）；N9（plain 快照两非匹配态精确静默，首红行）；N4（进入匹配集通知） | **met** |
| AC6 | **退出匹配集也通知**：旧值匹配、新值不匹配 → 收到信号，消费方拉终态自辨删除视图项 | update/plain：`oldMatch ∨ newMatch` 覆盖退出；delete/plain：`oldMatch` 覆盖删除出集；live 条目字段级迁移走 C-2 保守面（旧态不可判→必通知）——三种事件形状下退出均不可静默 | N3（t1 open→done 退出**必通知**）；N10（plain 双向迁移通知）；N10b（plain delete 旧态匹配通知） | **met** |
| AC7 | 嵌套 Y.Map 部分更新（容器浅 delta 无条目级 oldValue）→ 保守通知（宁多勿漏）；plain object 条目整值替换（oldValue 恒在场）→ 恒精确判定 | 按 F-1 冻结（SA6 §15-1 ★项 SA1 裁定）**逐字保守**：C-2 分支谓词在场恒保守产出（真变前提 `isNestedEntryChanged` 保留，L613–622 实读）；C-1 精确抑制只在旧态可判处（add / plain 快照 update/delete——`isPlainData(oldValue)` 分流，live Y 载体旧态内容被 Yjs 清空→保守） | N1/N2（C-2 匹配+非匹配均**必通知**）；N6（live 整替保守通知）；N9/N9b（plain 精确静默）与 N6 对偶成行 | **met** |
| AC8 | 判定矩阵契约测试锚定全部行为（先例 = 窗口读 lease 契约家族；场景矩阵基于 ADR 0030 记录的 Yjs 事实） | 三件套落 `packages/namespace-registry/test/`：fixture（433 行，非收集——名不匹配 include；schema 覆盖别名/可选/enum/嵌套/array/union/xml/封闭 map/标量条目容器/缺席面；plain 条目面 = Y.Map 容器 + raw 构造 plain 条目 + `rawTransact` 驱动，F-6）+ red（851 行，**恰 29 个 `it(`** = E1–E11 + N1–N15b + NC；零 skip/only/todo 本轮 grep 实证）+ surface（164 行，**恰 3 个 `it(`**）；被既有 include 正则采集（`verify-runner-list.log` 第 6/47 行）；readData 四键经 `expectReadDataOkKeys` 集中化 helper（L29/L836） | 本审查实数：29 + 3 与 SA3/SA4/SA7 记录逐字吻合；红→绿：scratch worktree（HEAD `28faeae`、源码零 diff）行为 13 failed/16 passed + 类型 1 failed/2 passed（`verify-red-repro.log` tail 实证）→ 实现后 29/29 + 3/3（`verify-behavior.log`/`verify-surface.log` tail 实证） | **met** |

**What-to-build 总纲**（`watchMap(path,{where})` 只收匹配条目变更信号且守宁多勿漏）：
签名兑现为纯加法第三参 `options?`（ADR §1 简写 vs T1 冻结绑定的文本缺口，SA8 action 1
裁决为缺口实例化、设计 §8.1 冻结——非参数序变更）；宁多勿漏不变量 = ADR L57 合取式逐行
锚定（§1 表 AC4–AC7 行）。**met**。

## 2. SA6 验收契约绑定表兑现（B-1–B-10）

| 绑定 | SA6 默认 / ★冻结 | 交付兑现（本轮实读） | 裁决 |
|---|---|---|---|
| B-1 签名纯加法 | `watchMap(path, listener, options?) → {unsubscribe}`；无 options = T1 逐字不变 | runtime 成员面 + hub 面 + lease 成员面三处同形第三参加宽；省略/`undefined`/`{}`/`{where:undefined}` 四形态无谓词逐字不变 | 兑现（E10 四形态行；T1 三件套零 diff + 23/23 绿——`verify-t1.log` tail 实证） |
| B-2 `where` 词形封闭小集（★F-3） | 恰两算子互斥必居其一；未知键/缺算子/双算子 fail-closed | 类型面联合恰两成员 + 运行时门⑥-b 同判据双收口；双算子类型面失真由文件头诚实声明、运行时 E7 行承担（正确取舍） | 兑现 |
| B-3 `field` 单段属性名；解析基准 = 条目值 schema | ref 追尽 + optional 透明 | ⑥-c 仅消费门⑤ 产物；`chaseValueSchema` 单点追尽（`resolveCarrierKind` 重构为其薄包装，`?.kind ?? 'unknown'` 语义恒等） | 兑现 |
| B-4 标量域闭包（★F-2） | scalar{3型}/enum/pattern/int/range 接受；object/array/xml/**一切 union**/scalar null/unknown 拒绝；封闭 map/标量条目容器 → 条目无统一值域 | `isScalarValueDomain` switch 默认分支 fail-closed；`<key>` 字段缺席或元素域非 object → 专属 message | 兑现（E5 四域族 + E5b 两形态） |
| B-5 标量相等（★F-4） | SameValue（`Object.is`）单源；`in` 存在量词线性扫描不用 Set | `matchPredicate` 逐字一致；仓内先例（replication-session 值投影相等）对齐 | 兑现（N12b 非承重文档行） |
| B-6 判定条件（★F-1 粒度） | 通知 ⟺ 真变 ∧（无谓词 ∨ oldMatch ∨ newMatch ∨ 旧态不可判保守） | `predicateKeepsContainerChange` 判定表 + C-2 恒保守 + 逐 key try/catch → 该 key 保守（同事务其他 key 不受影响） | 兑现（§1 AC4–AC7 行） |
| B-7 新失败语义 | 同步 throw `WatchMapError('WATCH_MAP_OPTIONS_INVALID', …)`；message 纪律 | 六 cause 同码异 message 单点常量；构造器自动码前缀；零回显 | 兑现（E11） |
| B-8 类型别名（★F-5） | `Namespace{Runtime,Lease}WatchMap{Options,ScalarValue}`；否决裸名 | 两包 index type-only +2（值导出面不变）；`where` 联合模块内部不经 index；lease.ts Equal 锁 +3 入 `LeaseTypeAssertions` | 兑现（surface 双源 Equal 锁 3/3 绿） |
| B-9 建立门次序 | ①→…→⑤→⑥谓词→⑦登记；失败零登记 | L754–807 实读逐位一致；throw 先于 `subscriptions.add` | 兑现（E8 门次序负控 + E4/E6 零登记佐证） |
| B-10 通知载荷零改动 | 三 kind 闭集 / data 恰三键 / 定位符恰两键 / 不含值；谓词只改「是否通知」与 key 集合 | 通知联合类型与 `enqueueData`/`makeChange` diff 零触碰 | 兑现（N13 载荷行） |

**SA6 §12.6 实现期红线**：① 谓词求值观察器内纯读、零 sequencer 槽、零 observer 内 throw
（外层整体吞没原样 + 逐 key try/catch 保守收编——N15 行 + SA7 P6 偏离数据动态实证）；
② 门次序不回退（E8/NC3）；③ 谓词校验纯 schema 侧零 live 探测（E9/NC6）；④ 载荷/kind/
队列/分发/生命周期零改动（N13/N14 + diff 实证）；⑤ 公共 API 仅经 `src/index.ts`、lease
恰 16 键原位加宽不新增键、既有两码零改动（NC 键集行 + diff 实证）。**全部遵守**。

## 3. ADR 0030 决策符合性

| ADR 条款 | 交付行为 | 裁决 |
|---|---|---|
| §2 谓词词表（封闭小集、值域恒标量、缺失/null 恒不匹配、`in` 集合语义、空数组响亮拒绝、不做 and/key 过滤、词表演进治理） | 逐项落盘（§1 AC1–AC3 行）；词表零加宽（无 notEquals/and/key 参数） | 符合 |
| §3 建立判定全部由 active schema 完成（无 schema 整体拒绝 T1 延续 / 载体分类 T1 延续 / 谓词非法 → OPTIONS_INVALID / **数据缺席合法** / 建立后零参数错误） | 门③/③b/④/⑤ 原样在前；门⑥ 纯 schema 侧；`ghost?` 未物化容器 + 合法谓词建立成功（E9）；编译冻结快照使通知流结构性零参数错误 | 符合 |
| §5 判定纪律（通知 ⟺ 真变 ∧（无谓词 ∨ 新旧匹配态任一 ∨ 旧态不可判保守）；漏不可接受/多可接受；旧态不可判两来源；plain 恒精确；消费方拉终态自辨协议） | 合取式逐支实现；两来源各归其位（C-2 保守；live oldValue 内容清空→`isPlainData` 分流保守）；plain 快照两态可读精确；定位符形状零改动支撑 `[...path,key]` 补拉协议 | 符合（F-1 逐字保守 = SA6 ★默认采纳，SA8 按 implements-existing-decision 归类） |
| §7 分层（runtime 簿记/求值/判定；registry lease 面 + 别名透传；通知不出进程、复制协议零改动） | 谓词全部在 `watch-map.ts`；`lease.ts` options raw 直传零解释（released 短路先于透传）；ws-replication/replication-protocol/persistence 零 diff（git 实证） | 符合 |
| §4/§6 冻结面（三 kind / data 形状 / origin 两态 / 无 version-rev；槽外分发 / throw 隔离 / 有界队列溢出 invalidate-all / 数值不进契约） | 全部 T1 原样零触碰（diff 实证）；谓词求值在观察器同步段（槽外纪律同 T1 真变判定路径） | 符合 |

**非目标边界（issue 非目标段 + SA6 §12.1 + 设计 §1 三处一致；本轮 diff/grep 实证零越界）**：
`watch-end` 终止编排与 `'replication'` 验收断言（T3 #389）——通知流无 watch-end 产出路径
新增、契约零 origin 断言行；队列溢出 testing 注入与父路径删除/容器整替编排（T4 #390）——
C-3 分支保持 T1 零条目定位符；文档缝（T5 #391）——docs/CONTEXT 零 diff；`notEquals`/`and`/
key 过滤/`watchArray`/含值通知/version·rev（ADR 备选已否决）——词表与载荷零加宽。
**零 scope creep、零提前实现**。

## 4. 冻结面与影响面核验（本轮 git 实证）

- **diff 范围**：`git diff --stat 28faeae..60cda9c` 代码/测试面**恰 10 文件**（7 src + 3 新测试），
  与设计 §11 ALLOW LIST 逐行精确匹配；DENY 面（`docs/**`、`CONTEXT.md`、`vitest.config.ts`、
  `tsconfig*`、根 `package.json`、`packages/ws-replication/**`（含 `src/testing.ts` 门面）、
  `packages/vfsl/**`、`packages/namespace-diagnostic-log/**`、`window-read.ts`/
  `read-schema-projection.ts`/`plain-data.ts`、`registry.ts`、T1 三件套
  `issue-387-watch-map-*`、`readdata-ok-shape.ts`、`apps/**`、`domains/**`、`scripts/**`）
  **零 diff**。
- **调用面兼容（SA2-1 关闭项）**：ws-replication `decorateLease` 的 `lease.watchMap.bind(lease)`
  门面零改动（bind 保形随源签名自动加宽）；9 个 registry 测试替身少参实现恒可赋值；4 处键
  审计表与类型加宽正交（lease 恰 16 键不变）。静态面 = root `pnpm typecheck` 14 tsconfig
  exit 0（含 ws-replication tsconfig——`verify-typecheck.log` tail 实证）；动态面 = root
  `pnpm test` 396 文件 / 4785 用例 passed + Type Errors no errors（`verify-root-test.log`
  tail 实证，629.44s）。
- **T1 回归锚（NC1）**：`issue-387-watch-map-*` 三件套零 diff 且 23/23（21 行为 + 2 类型）
  绿（`verify-t1.log` tail 实证）；registry 包 42 文件 / 525 用例绿（基线 41/496 + 本票
  +1 文件/+29 用例——`sa7-issue388-registry-package.log` tail 实证）。
- **错误注册纪律**：`errors.ts` diff 纯追加 hunk（`WATCH_MAP_OPTIONS_INVALID_CODE` + 联合
  成员）；`WatchMapError` 类不进 index（沿 T1 先例）；ADR 0008 词汇收口遵守。

## 5. 证据链核验（红 → 绿）

| 层 | 内容 | 本轮结果 |
|---|---|---|
| ① 日志在场复核 | 与 #387 不同，本票 `artifacts/sa3-issue388-*.log`（9 份）/ `sa6-issue388-*.log`（18 份）/ `sa7-issue388-*.log`（8 份）**在树**（未跟踪文件——git 未提交，与 T1/SA6 先例同形态） | 关键门禁日志全部 tail/grep 实读：红复现 13 failed/16 passed + 类型 1 failed（`verify-red-repro.log`）；行为 29/29（`verify-behavior.log`）；类型 3/3 + no errors（`verify-surface.log`）；T1 23/23；root typecheck exit 0；root test 4785 passed + no errors；registry 42/525；runner 采集 56 文件第 6/47 行 |
| ② 树内结构计数互洽 | red 恰 29 个 `it(`、surface 恰 3 个、零 skip/only/todo、@ts-expect-error 负例在场、fixture 433 行非收集 | 与报告记录值逐字吻合（本轮 grep 实证） |
| ③ 红证据性质（反伪绿） | 红行 = E4/E5/E5b/E6/E7/E11 + N7/N8/N9/N9b/N11/N12/N12b + surface 三参正例（四例 TS2554）；保守行（N1/N2/N6/N10）HEAD 已绿被显式分档、不取红证据 | 与 SA6 §13 能力缺口（静默建立 + 精确降噪多通知 + 类型缺席）逐条对应；scratch worktree 源码零 diff 复现，排除环境噪声 |
| ④ 动态独立验证（SA7） | 6 探针（门机跳点/编译快照不受调用方变更影响/同事务双订阅过滤/复制 apply 同分档 + origin 投影/退订时序/偏离数据清理）6/6 绿后删除，移除后复跑不变、零 `[SA7-DATAFLOW]` 残留 | `sa7-issue388-probe.log` tail 实证 6 passed |

红→绿因果链完整且独立可复现：同一契约字节在 HEAD `28faeae` 红（能力缺口），实现后转绿，
契约文件交付前零改动（SA4/SA8 mtime/diff 复核 + 本轮交付态实读自洽）。

## 6. MINOR 观察（不阻断 approve；承 SA4 §12 裁处，本轮复核成立）

1. **M-1（O-A）**：设计 §10.2 的 readData 投影 oracle helper 未固化进契约文件——矩阵行
   采用字面 fixture 期望（种子在 fixture 显式声明、与实现逻辑无关，期望独立性实质保持），
   SA3 以一次性探针交叉核对（2/2 绿、日志在场）后删除；SA6 §12.5-5 纪律的固化形态属
   后续票可选增补（ALLOW 测试面）。
2. **M-2（O-B）**：union 全标量成员子情形无专属测试行——F-2 冻结「一切 union 拒绝」，
   `isScalarValueDomain` 默认分支结构上恒拒（fail-closed 方向恒成立）；E5 锚定含容器
   成员的 `detail` union + object/array/xml 四域族。
3. **M-3（O-C）**：trap 抛异常的 Proxy 子情形无专属测试行——门⑥-a/b 整体 try 收编 →
   同码拒绝（fail-closed 方向安全）；E7 锚定 accessor/非对象/未知键/数组形态族。
4. **M-4（O-D）**：`Object.keys` 不可见 Symbol 键（带 Symbol 键的 options 按 `{}`/词形
   处理）——与 `canonicalWindowBudget` 先例同口径，封闭形状契约 `{where?}` 下 Symbol 键
   不构成语义通道。

另注（证据形态，非缺口）：`artifacts/*issue388*.log` 为**未跟踪**文件（未提交入 git），
与 T1/SA6 先例同形态；本轮已在树做 tail 级复核（§5），但若交付清理后需日志级溯证，
建议 PR 披露该状态或按仓库惯例补存关键门禁日志。

## 7. PR 必须披露的未达成/边界项（均非本票 AC 缺口，为已裁决分期与已知边界）

- **分期义务（各有其票，本票按设计不交付）**：T3 #389 `watch-end` 终止编排（schema 变更 /
  doc 替换 / Peer re-arm）与 `'replication'` origin Hub/Peer 会话级验收断言；T4 #390 队列
  溢出 testing 工厂注入 + 父路径删除/容器整替编排（C-3 条目定位符化）+ 逐 key 故障注入
  用例；T5 #391 文档缝（CONTEXT L65–67 已覆盖谓词口径，本票零文档改动合规）。
- **T2 交付态已知边界（ADR/设计明文授权，非缺口）**：① AC7 保守粒度 = F-1 逐字保守——
  C-2 嵌套部分更新在谓词在场时**恒通知**（含非匹配条目；多通知 = 宁多勿漏下可接受方向，
  精确化属词表演进须过设计评审）；② live Y.Map 条目整替/删除旧态不可判 → 保守通知
  （Yjs 清空行为，N6 锚定）；③ schema 变更后既有订阅沿用建立期编译谓词（ADR L85 已知
  形态，T3 以 watch-end 收口；SA4 §11-5 / SA7 §8 登记，本票按非目标不驱动）；④ 容器
  整替（C-3 父路径事件）不产出条目定位符（T4）。
- **机制在产但验收断言归后续票**：复制 apply 事务下的谓词判定与本地同分档（SA7 P4
  Yjs 层 `Y.applyUpdate` 探针动态实证，origin 恒 `'replication'`；Hub/Peer 会话级编排
  归 T3）；队列溢出 → `invalidate-all` 机制 T1 已在产（注入与验收归 T4）。
- **证据形态**：门禁/探针日志未提交入 git（§6 另注），红→绿数值以在树日志 + 报告记录
  + 结构计数三层互洽为准。

## 8. Verdict

**approve** —— 交付 commit `60cda9c` 忠实满足 issue #388 正文（What-to-build + AC1–AC8）、
SA6 验收契约（B-1–B-10 全兑现、§12.6 红线全遵守、判定矩阵红→绿证据完整）与 ADR 0030
决策 2/3/5（F-1–F-6 冻结值全部落在 ADR 既有条款的逐字兑现或未冻结处的 fail-closed 缺省
侧）；无遗漏、无部分实现、无错误实现、无 scope creep；非目标零越界、冻结面零 diff
（本轮 git 实证）；Owner 快照为空（六方同口径），无 owner 要求遗漏面。仅存 4 条 MINOR
观察（均 fail-closed 安全方向的测试覆盖可选增补 + oracle 固化延后）与已裁决的 T3–T5
分期披露项，均不阻断。
