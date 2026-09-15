# SA9 标准符合性审查 — issue #388：谓词订阅与宁多勿漏判定（变更订阅 T2）

- 被审对象：**committed final delivery** = HEAD `60cda9cfe41ee3b6e8aeffdc8f5a0c4011c2b3de`
  （`fix(#388): watchMap 谓词订阅与宁多勿漏判定（变更订阅 T2）`，单笔提交，19 文件，
  4413+/49− = 10 代码/测试文件 + 9 wiki 产物）；基准 = `28faeae`（T1 #387 已合入，
  dispatch 确认稳定）。工作树仅余未跟踪证据日志与任务简报（两态惯例，见 §8）；
  `git diff HEAD --check` exit 0。
- 审查轮：iteration 0（dispatch `sa-dfc82363-b985-4827-8cd0-ca067652c9fd`）。
- Owner feedback 快照：**空**（无 owner 要求 / comment ID / updated_at——本轮与
  SA6 §2 / SA8 §2/§4 / SA3 / SA4 / SA7 六处独立同口径）；需求源 = issue body
  「What to build」+ AC1–AC8 + ADR 0030 决策 2/3/5 + CONTEXT L65–67。
- 职责边界：只判**当前实现**是否符合仓库 AGENTS / ADR / 模块责任 / 既有架构惯例 /
  单一事实源 / 生命周期对称性 / 文件范围 / 测试质量标准；不审查需求完整性（SA10），
  不修改代码、不运行测试、不调度其他 SA。
- 方法：对最终交付全量 diff（`28faeae..60cda9c`，`git diff --numstat` 全量对账）
  逐文件实读——watch-map.ts 831 行全文实读（含门⑥ a–d、`predicateKeepsContainerChange`、
  C-1/C-2 谓词层、观察器零 throw 红线）+ 其余 9 文件 diff 逐 hunk 实读；DENY 全清单
  23 条路径 `git diff --name-only` 逐条实证零命中；关键惯例点（值导出面、append-only
  注册、Equal 锁、敌意通道零 `[[Get]]`、别名前缀公式、测试弱化词、`@ts-expect-error`
  计数、证据日志计数链）独立 grep + 实读复核；SA3/SA4/SA7/SA8 报告行号锚点对最终代码
  逐点抽核（见 §10 M-1 溯源）。

---

## 1. Verdict

**approve（0 × BLOCKER，0 × MAJOR；3 × MINOR 不阻断）。**

交付是 ADR 0030 决策 2/3/5 的忠实、守纪实现：公共 API 纯加法加宽（第三参 `options?`，
lease 恰 16 键原位加宽不新增键）、建立门⑥ 全同步纯 schema 侧 fail-closed、判定合取
宁多勿漏（C-1 add/plain 快照精确、live 载体与 C-2 嵌套保守）、稳定码 append-only
注册、单一事实源保持（追尽循环单点化、SameValue 单源比较、别名 Equal 锁）、生命周期
三条退订路径零触碰继承、文件范围零越界（ALLOW 全清单落位、DENY 23 条零 diff）、
测试质量全符仓库纪律（三件套 + 红绿独立复现 + 反伪绿分档 + 集中化形状断言）。
SA2（approve）/ SA3（红绿 + 三门禁全绿）/ SA4（approve）/ SA7（approve）/ SA8
前置与实现后复查（均 clear，`requiresConflictRecheck=false`）的结论经本轮独立复核
**全部与盘面一致**。

## 2. Reviewed inputs

| 输入 | 状态 | 用途 |
|---|---|---|
| 交付 diff `28faeae..60cda9c`（19 文件；本轮 numstat 全量对账） | 本轮逐文件实读 | 被审对象 |
| `docs/adr/0030-change-subscription.md`（零 diff，本轮实证 107 行全文） | 在场 | 规范权威 §1–§7 / 备选 / 验收逐条对照 |
| 根 `AGENTS.md` + `packages/namespace-{runtime,registry}/AGENTS.md` + `docs/AGENTS.md` | 在场（本轮实读） | 模块契约与文件纪律 |
| `wiki/raw/task_issue-388.md`（任务简报，35 行，AC1–AC8，Comments 空） | 在场 | 需求源 |
| `wiki/raw/task_issue-388_design.md`（SA1，670 行，F-1–F-6 冻结 + §16 对 SA2-1 落实） | 在场 | ALLOW/DENY（§11 本轮逐行核对）、判定矩阵、测试结构 |
| `wiki/raw/task_issue-388_sa2_review.md`（approve）/ `_sa3_impl.md` / `_sa4_review.md`（approve）/ `_sa7_report.md`（approve）/ `_sa6_contract.md`（approve）/ `_conflict_report.md`（clear）/ `_implementation_conflict_report.md`（clear）/ `_relevant_decisions.md` | 在场 | 上游审查结论与证据索引（本轮一致性复核，不复跑） |
| `artifacts/sa3-issue388-*.log`（两个 log 家族）+ `sa6-issue388-*` + `sa7-issue388-*` | 本轮 tail/grep 实读 | 红绿/门禁/采集证据链与计数一致性 |
| ADR 0008/0009/0023/0025/0026/0027/0028 交叉决策面 | 在场 | 稳定码注册表 / lease 生命周期 / 服务字面量 / 信封面 / 读面冻结 |
| `node_modules` 在场（yjs `^13.6.30` 为 runtime 生产依赖） | 本轮实核 | `import * as Y` 值导入惯例与依赖面 |

## 3. AGENTS.md 符合性

| 模块条款 | 实现落点 | 裁决 |
|---|---|---|
| runtime AGENTS：严格 FIFO 唯一、reads 不进 sequencer | 谓词求值全在 ROOT `observeDeep` 观察器同步段（与 T1 真变判定同路径，纯读零槽位）；`write.ts`/`sequencer.ts`/`schema-write.ts`/`replication-write.ts` **零 diff**（本轮 DENY 对账） | 符合 |
| runtime AGENTS：公共 API 只暴露 detached 投影；owned handle/live Y.Doc/queues/fanout host internal | 通知仍深冻结纯数据；谓词为 ⑥-d 编译深冻结快照（`Object.freeze({op,field,value})` / 新建数组 + SameValue 去重 + 双层 freeze），绝不保留调用方对象/数组引用（本轮实读 L404–424）；`CompiledWatchPredicate`/`NamespaceRuntimeWatchMapWhere`/`createWatchHub` 不经两 index 导出（grep 实证；包 `exports` 仅 `.` 与 `./internal`，本轮实读 package.json） | 符合 |
| runtime AGENTS：`close()` 同步停接纳、幂等；`getStatus()` 全程可观测 | close/shutdown/getStatus 代码**零 diff**；谓词订阅经 T1 既有 hub `shutdown` 防御性收口 | 符合 |
| runtime AGENTS 验证节：root `pnpm typecheck` + `pnpm test` 强制门 | `verify-typecheck.log`（14 tsconfig exit 0）+ `verify-root-test.log`（396 文件/4785 用例 + Type Errors no errors）在场；SA7 增补 registry 包 42/525（本轮 tail 实读） | 符合 |
| registry AGENTS：lease 为独立调用方 capability；release 幂等 | lease 第 16 键 released 短路先于 raw 透传（lease.ts L355→L356 实读）；`doRelease` 区域零 diff；谓词随订阅对象回收（零独立生命周期面） | 符合 |
| registry AGENTS：公共 API 仅经 `src/index.ts` | 两别名进既有 `export type` 块（type-only +2）；值导出两 `export {` 块零改动（本轮 grep 实证） | 符合 |
| docs AGENTS：代码行为变更须同步规范文档 | ADR 0030 已在 base 在场且本交付**零 docs diff**——规范先行正确形态；CONTEXT L65–67「变更订阅」词条已含谓词口径（本轮实读：词表 `equals`/`in` 恒标量、缺失/null 恒不匹配、宁多勿漏合取式逐字在场）；文档缝属 T5 #391 既有分期 | 符合 |

## 4. ADR 符合性

| ADR 条款 | 实现 | 裁决 |
|---|---|---|
| ADR 0030 §1 lease 公共面 + capability 释放即清理 | 签名纯加法 `watchMap(path, listener, options?)`（runtime 成员面 + hub 面 + lease 成员面三处同形，diff 实读）；退订/释放代码零触碰 | 符合 |
| ADR 0030 §2 封闭词表两算子、值域恒标量、缺失/null 恒不匹配、`in` 集合语义、空数组响亮拒绝 | `readWatchWhere` 键集恰 `{field}` ∪ 恰一算子（缺/双算子/未知键/非标量值 fail-closed）；`readMemberScalar` 缺失/null/对象/载体 → undefined → `matchPredicate` 恒 false（两算子同路径，无 NULL 三值逻辑）；`in` = 存在量词线性扫描（顺序无关、去重自然成立）+ ⑥-d SameValue 去重；`values.length===0` → 专属 cause → `PREDICATE_IN_EMPTY_MESSAGE` | 符合 |
| ADR 0030 §3 建立判定全由 active schema；数据缺席合法；全部校验在建立时刻 | 门序 ①→②→③→③b→④→⑤ 原样 → **⑥ 谓词门 → ⑦ 登记**（watch-map.ts L754–807 全文实读）；⑥-c 仅消费门⑤ 已得 `resolved.valueSchema`+`resolved.aliases`（零二次 resolve、零 `.get()`/零 doc 访问——`compileWatchPredicate` 全文实读）；失败 throw 先于 `subscriptions.add`（零登记、零 observer 变更）；通知路径只读 compiled 谓词（结构上零参数再校验） | 符合 |
| ADR 0030 §4 三 kind 闭集、data 形状、同事务同 key 合并、origin 两态 | 通知类型联合/`makeChange`/`enqueueData`/`classifyOrigin` diff **零触碰**；谓词只改「是否通知」与 changes key 集合；`Map<key>` 首见序去重原样 | 符合 |
| ADR 0030 §5 宁多勿漏（同值写过滤 ∧（无谓词 ∨ 新旧匹配 ∨ 不可判保守）） | `isRealChange` 前置原样（`if (!isRealChange(...)) continue` 先于谓词层，本体零改动）；`predicateKeepsContainerChange` 判定表逐支：add → newMatch；update/delete plain 快照 → oldMatch∨newMatch / oldMatch；live 载体旧态（Yjs 清空）→ 保守；C-2 嵌套 → 逐字保守（零字段级精确化、零新增走树读）；同 key 产出取向单调（`continue` 不回退已产出） | 符合 |
| ADR 0030 §6 槽外异步分发、回调隔离、有界队列溢出 invalidate-all、数值不进契约 | 队列/泵/溢出/让步全部零 diff；逐 key try/catch → 该 key 保守（L602–611 实读），观察器整体吞没红线原样（L718–729 实读） | 符合 |
| ADR 0030 §7 分层（runtime 求值/判定；registry 别名透传；复制零改动） | 谓词全部在 watch-map.ts（runtime 唯一实现载体）；`lease.ts` options raw 引用直传零解释；ws-replication（含 `src/testing.ts` 门面）/replication-protocol/persistence **零 wire diff** | 符合 |
| ADR 0008 词汇收口：稳定码 append-only、区分域靠 message | `errors.ts` 纯追加 hunk（`WATCH_MAP_OPTIONS_INVALID_CODE` 常量 + 联合成员，本轮 numstat +8/−1 对账）；既有 `CARRIER_MISMATCH`/`SCHEMA_UNAVAILABLE` 两码逐字零改动；`WatchMapError` 类不进 index、构造器自动 `${code}: ` 前缀（实读 L271–281）；六 message 单点常量、非空、互相可区分、零 path/field/值回显（E11 探针行锚定，本轮逐条复读文案） | 符合 |
| ADR 0009 lease release 幂等 / ADR 0023 `ctx.provide` 冻结面 / ADR 0025/0026 信封面 / ADR 0027/0028 读面冻结 | `registry.ts`/guard/write/mutation/readData/window-read/plain-data **零 diff**（DENY 对账）；lease 恰 16 键（原位加宽）；NC 行锚定 readData 四键（集中化 helper）+ `readMap` 在产 + `WINDOW_CARRIER_MISMATCH` 零改动 | 符合 |

## 5. 模块责任与既有架构惯例

| 维度 | 复核 | 裁决 |
|---|---|---|
| 责任归属 | runtime 承载谓词门/求值/宁多勿漏判定（watch-map.ts 唯一载体）；lease 纯透传 + Equal 锁（零判定、零解释、零载体知识）；替身/键审计零改动兼容（SA2-1 闭包：9 替身少参恒可赋值、4 键审计与加宽正交、`.bind` 保形——本轮对 10 个改动文件外的全树零 diff 实证兜底） | 正确 |
| 敌意通道纪律先例 | `readWatchMapOptions`/`readWatchWhere` 镜像 `canonicalWindowBudget`：`Object.keys` 键空间 + `Object.getOwnPropertyDescriptor` 取值（accessor 显形拒绝、原型须 plain、整体 try 收编 trap）；`in` 成员逐索引 descriptor 读（稀疏位/accessor 位 fail-closed——O4 落实，全程零 `[[Get]]`）；`normalizeReadPath` 直接复用（零第二实现） | 符合 |
| 命名与导出公式 | `Namespace{Runtime,Lease}WatchMap{Options,ScalarValue}` 前缀公式沿窗口读 `ReadMap*` 先例（F-5）；`where` 联合模块内部（不经 index，结构经 Options 可达）；两 index type-only +2，值导出面不变 | 符合 |
| 别名 Equal 锁先例 | lease.ts 锁 5→8：新增 `_watchMapOptionsAlias` / `_watchMapOptionsMemberAlias`（Options ≡ 成员第三参）/ `_watchMapScalarValueAlias` 并注册 `LeaseTypeAssertions`；`_watchMapMemberAlias` 随 `Parameters` 双源对偶自动加宽（漏改单侧即编译期红——fail-loud 结构保持） | 符合 |
| 错误面先例 | 新失败语义 = 同步 throw `WatchMapError`（B-3 面），类不进 index、code+message 字符串消费——沿 `RuntimeReadDisabledError` 同款；lease JSDoc 已列 `WATCH_MAP_OPTIONS_INVALID`（O5 落实，types.ts diff 实读） | 符合 |
| 接口/字面量形态 | `readonly watchMap: (...) => ...` 声明样式与 `readArray`/`readMap` 一致；接口与对象字面量同位次同步加宽；`import * as Y` 值导入沿 `projection.ts`/`replication-session.ts`/`window-read.ts` 既有惯例（`instanceof` 判据所需；yjs 生产依赖，本轮实核） | 符合 |
| TDD/契约先例族 | 三件套落 `packages/namespace-registry/test/`（fixture 非收集文件 + 行为 red + surface `test-d.ts`）——#369/#387 先例族同构；fixture 自持 options 位单点、`NotificationSink`/`openSecondLease` 从 T1 fixture import 复用（零复制、T1 三件套 DENY 零 diff）；深导入 `../../namespace-runtime/src/runtime.js` 沿 T1 fixture 同款 | 符合 |

## 6. 单一事实源

| 事实 | 权威源 | 复核 |
|---|---|---|
| 值域追尽循环 | `chaseValueSchema` 单循环（ref 闭包查表 + optional 透明 + 环/缺席 fail-closed）；T1 `resolveCarrierKind` 重构为其薄包装（`?.kind ?? 'unknown'` 语义恒等，本轮逐行对照 T1 原循环）——**副本消除**而非第二实现；门⑤ 与门⑥-c 共用同一循环 | 符合（单点化改进） |
| 谓词语义（存续期） | ⑥-d 编译深冻结 `CompiledWatchPredicate` 快照（零缓存匹配态、零调用方引用——F-4/快照纪律）；判定只依赖事件内新旧两态 + 现值读 | 符合 |
| 标量相等 | `Object.is` 单源比较，`equals`/`in` 共用；`in` 线性扫描不用 `Set`（SameValueZero ±0 撕裂预防）；对齐 `replication-session.ts` 值投影先例 | 符合 |
| 错误 message | 六常量单点于 watch-map.ts；构造器前缀机制复用 | 符合 |
| 公共面形状 | runtime 类型定义单源；registry 别名 = 单源 type-only 跟随 + Equal 锁编译期强制；lease 键集 16 由 NC 行断言 + 4 处既有键审计（零 diff） | 符合 |
| schema 判定 | `state.activeTools.derived` 每次建立现算；门⑥ 零二次 resolve | 符合 |

## 7. 生命周期对称性

| Start / acquire | Stop / release | 复核 |
|---|---|---|
| 门⑥ 编译冻结谓词（登记前） | 谓词随订阅对象经 `unsubscribe`/lease 释放/hub shutdown 一并回收 | 谓词零独立生命周期面（ADR 0009 + ADR 0030 §1 继承）；三条退订路径代码零 diff |
| 登记（⑦，throw 先于 `subscriptions.add`） | 建立失败 = 零登记、零 observer 变更 | 无半建立态（E4/E6 零登记佐证行 + P1 动态跳点在案） |
| 观察器挂接/泵/队列（T1 面） | 原样保持 | 逐 key 异常 → 该 key 保守（不外抛）；整体吞没红线不动——求值面零 throw（`readMemberScalar` 全量分类，偏离数据恒不匹配而非抛） |
| schema 变更后的订阅存续 | 沿用建立期编译谓词（T3 #389 watch-end 收口） | ADR L85 已知形态按设计非目标边界不引入中间态，符合分期 |

## 8. 文件范围

- **交付完整性**：最终 diff = 19 文件（10 代码/测试 + 9 wiki 产物），`git diff --numstat`
  全量对账：runtime 4 文件（watch-map 370/27、errors 8/1、index 12/0、runtime 17/4）+
  registry 3 文件（types 23/10、lease 25/7、index 7/0）= src 合计 **462/49**；新契约三件套
  433+851+164；wiki 9 产物（设计/SA2/SA3/SA4/SA6/SA7/双 SA8/决策摘录）。
- **ALLOW 落位**：10 个代码/测试文件逐一命中设计 §11 ALLOW 行（含预期改动内容逐行
  对账——门⑥/判定层/message 常量/注释、append-only 两行级、成员加宽 + wiring 透传、
  type-only +2 ×2、lease 透传 + Equal 锁、三件套新建）。
- **DENY 零 diff**（本轮 `git diff --name-only` 对 23 条路径逐条实证）：`docs/**`、
  `CONTEXT.md`、ws-replication/replication-protocol-v1/persistence/vfsl/namespace-diagnostic-log
  全包、`window-read.ts`/`read-schema-projection.ts`/`plain-data.ts`、`registry.ts`、
  T1 三件套、`readdata-ok-shape.ts`、`vitest.config.ts`、`tsconfig*.json`、根
  `package.json`、`pnpm-lock.yaml`、`apps/**`、`domains/**`、`scripts/**`——**零命中**。
- **值导出面不变**：runtime index 值导出仍恰 `RuntimeWriteFatalError` 一键（grep L56→L62
  唯一 `export {` 行）；registry 两值导出块零改动；两 index 均 type-only 追加。
- 工作树未跟踪面 = 证据日志（sa3/sa6/sa7 两态惯例，387 SA9 已登记无强制）+ 任务简报
  （近期 #369/#376/#377/#387 简报同未入库惯例）；scratch worktree 与临时探针均已清除
  （SA3/SA4/SA7 三处 `git status`/`git worktree list` 复核在案，本轮盘面一致）。
- `git diff HEAD --check` exit 0。

## 9. 测试质量标准

| 标准 | 复核 | 裁决 |
|---|---|---|
| 契约三件套 + 采集（#369/#387 先例） | 三文件在场；vitest include（L15/L20）与 typecheck 程序（`tsconfig.typecheck.json` 含 src+test）零改动即采集——`verify-runner-list.log` 实证 56 文件中行为契约第 6 行、类型契约第 47 行 | 符合 |
| 无弱化 | 本轮 grep：三文件零 `.skip`/`.only`/`.todo`/env override/`setTimeout`（唯一「sleep」命中为头注自证「禁 sleep」）；零源码字符串断言；契约自 SA6 落盘后红→绿非靠改断言 | 符合 |
| 异步纪律 | `expect.poll`（fixture `waitForSchemaSettled`/`waitForCount`）+ 屏障（`barrierTransaction` 后续事务 / 第二订阅）表达「送达」与「零通知」；零 sleep 竞猜 | 符合 |
| 断言强度 | 成功形状逐键 `toStrictEqual`（通知恰三键、定位符恰两键、句柄恰 `{unsubscribe}`、lease 恰 16 键、失败 code 逐字相等）；N8 混合事务排序后 `toStrictEqual`（零「至少含」软化）；E11 六 cause 可区分 + 码前缀 + 零回显探针；N13 payload 哨兵「信号不含值」；N12 两形态逐字节同构；surface 9 条 `@ts-expect-error` fail-closed（grep 10 命中 = 9 负例 + 头注提及一次）；双算子负例**诚实缺席**（头注 TS 联合 excess-property 语义会吸收失真断言，运行时 E7 行承担——正确取舍） | 符合 |
| 集中化形状门 | readData 四键仅经 `expectReadDataOkKeys`（NC 行；零内联字面量） | 符合 |
| 反伪绿 | 红证据只取能力缺口面（E4–E7/E5b/E11 + N7/N8/N9/N9b + 类型面）；保守行（N1/N2/N6 等）HEAD 已绿显式分档不取红；红复现 = 独立 scratch worktree HEAD `28faeae` 源码零 diff → 行为 13 failed/16 passed + 类型红（`verify-red-repro.log` 本轮头尾实读），红行集合与 SA6 §13 失败点逐条对应 | 符合 |
| 证据链 | 绿：29/29 + 3/3（no errors）+ T1 23/23 + root typecheck（14 tsconfig）+ root test 396 文件/4785（no errors）+ SA7 移除探针后复跑（29/29、3/3、21/21、2/2、registry 42/525）——两个 log 家族（02:28 首产 / 09:30–09:44 复验 / 10:13–10:19 SA7）计数**完全一致**（本轮实读 tail 对账），证据覆盖最终提交代码 | 符合 |

## 10. Findings（MINOR，不阻断 approve）

- **M-1（MINOR·已入库 wiki 产物的逐文件 numstat 陈旧）**：SA3 §3 表 / SA4 §6 表 / SA8
  实现后报告 §1 的逐文件「区域」行数（如 watch-map.ts `+397/−49`，两包合计 511/68）与
  最终提交的逐文件 numstat（watch-map.ts `+370/−27`，合计 462/49）不一致；但三份报告
  各自的**总量**行（`7 files changed, 462 insertions(+), 49 deletions(-)`）均与提交
  **逐字一致**。溯源结论：逐文件行数为前序实现迭代的陈旧快照（实现经行为中性收紧——
  两个 log 家族计数 29/29、396/4785、红 13 failed 完全一致可证行为等价），且最终代码
  锚点与评审引用吻合（SA7 引 watch-map.ts = 831 行 = 提交实况；SA8 引 lease.ts 透传
  L355–357 = 提交 L355–356）。证据链覆盖最终代码成立；陈旧仅限已入库报告的统计栏位，
  零代码/零契约影响。建议后续触该类报告时以总量为准或顺手刷新，不阻塞本交付。
- **M-2（MINOR·注释计数漂移延续，沿 387 SA9 M-1）**：`runtime.ts` 历史计数措辞
  （L2「十四键公共面」、L187「十四键」、L654「十四键闭包对象」）维持陈旧；本票 diff
  在 ALLOW 内触碰 runtime.ts 但未同步该漂移（设计 R5 登记为低风险可选项；T2 新增
  成员的 JSDoc 本身准确完备，`第十五键`表述正确）。registry 侧 16 键表述均正确。
  零行为/契约影响，建议下一触该文件的票顺手同步。
- **M-3（MINOR·测试覆盖可选增补，沿 SA4 O-A/O-B/O-C/O-D 裁处）**：readData 投影
  oracle 未固化进契约文件（矩阵行采字面 fixture 期望 + 一次性探针 2/2 交叉核对后删除，
  期望独立性实质保持）；union 全标量成员、throwing-Proxy、Symbol 键注记三子情形无专属
  测试行（均 fail-closed 方向结构恒成立）。SA4/SA8 已裁不阻断并路由后续票（ALLOW 测试面
  增补），本轮复核同意该裁处。

**观察（非 finding）**：① commit header `fix(#388): …` 带 issue 引用且 scope 正确
（388 系修复 T1 预留位的能力缺口；较 387 M-3 的规整度观察有改善）；② 证据日志与任务
简报未入库（两态/近期惯例，见 §8）；③ SA2 O9（iteration 计数口径）为文档面观察，
与实现无关。

## 11. 结论

实现对仓库 AGENTS 模块契约、ADR 0030 决策 2/3/5 及全部交叉 ADR 条款、分层责任、
既有先例（敌意通道零 `[[Get]]` / 追尽单点化 / 别名 Equal 锁 / 错误面 / type-only 导出 /
契约三件套 / 反伪绿分档）、单一事实源、生命周期对称性、ALLOW/DENY 文件范围与测试
质量标准**全部符合**；三项 MINOR 均为报告统计栏位/注释措辞/可选增补级别，不触碰任何
承重面。按 SA9 规则（无 BLOCKER/MAJOR ⇒ approve；MINOR 不阻断），**verdict = approve**。
