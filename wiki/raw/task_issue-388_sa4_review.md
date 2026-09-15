# SA4 Implementation Review — issue #388：谓词订阅与宁多勿漏判定（变更订阅 T2）

- 角色：SA4（实现红队静态审查）；dispatch：`sa-6dc3ff0f-a869-4183-9579-aff68cd8223f`（iteration 0，implementation-review）
- 审查对象：worktree `/home/wangjian/nomicore-fix-issue-388`（branch `mabf/issue-388`，HEAD `28faeae`）未提交 diff
  （7 个 `src` 文件 +462/−49 + 3 个新契约测试文件）及其 SA3 产物
- 上游相位：SA8 实现后冲突门 `clear`（`task_issue-388_implementation_conflict_report.md`，
  28 项对照 = 14 implements-existing-decision + 14 no-conflict，`requiresConflictRecheck = false`）
- Owner feedback 快照：**空**（无评论 / comment ID / updated_at —— 与 SA6/SA8/SA3 三方独立同口径）；
  需求源 = issue body AC1–AC8 + ADR 0030 决策 2/3/5
- 审查方法：逐 hunk 实读 diff + 对照设计冻结（F-1–F-6 / §8.1–§8.7 / §9 矩阵 / §10 测试结构 / §11 范围）
  + 证据日志实读核对 + 安装版 yjs@13.6.32 事件聚合源码实读（见 §8 附注）；**未修改任何实现、设计或测试**

---

## 1. Reviewed inputs

| 输入 | 状态 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-388.md`（任务简报，35 行） | 在场 | AC1–AC8 需求源对账 |
| `wiki/raw/task_issue-388_design.md`（670 行，iteration 1，F-1–F-6 冻结） | 在场 | 实现绑定基准（逐节对照） |
| `wiki/raw/task_issue-388_sa2_review.md`（approve；SA2-1 已解决 + O1–O10） | 在场 | 评审修订落实核对 |
| `wiki/raw/task_issue-388_sa6_contract.md`（approve；B-1–B-10 / N·E 矩阵 / §12.5 纪律 / §12.6 红线） | 在场 | 验收契约对账 |
| `wiki/raw/task_issue-388_sa3_impl.md`（150 行） | 在场 | 被审对象自述 + 证据链 |
| `wiki/raw/task_issue-388_implementation_conflict_report.md`（SA8 实现后，clear） | 在场 | 冲突门前置确认 + 4 条非阻塞转交项 |
| `wiki/raw/task_issue-388_conflict_report.md` / `_relevant_decisions.md`（前置门禁） | 在场 | 六条 required actions 闭环基准 |
| 实际 diff（`git status --porcelain` 全量 + 逐 hunk 实读） | 在场 | 被审对象 |
| `docs/adr/0030-change-subscription.md`、`CONTEXT.md` L65–67 | 在场（零 diff） | 规范权威 |
| `packages/namespace-{runtime,registry}/AGENTS.md` | 在场 | 模块验证门（root typecheck + root test） |
| `artifacts/sa3-issue388-verify-*.log`（9 份）+ `sa6-issue388-*`（基线/探针） | 本轮实读（tail/grep） | 证据充分性独立复核 |
| `node_modules/.pnpm/yjs@13.6.32/.../YEvent.js`、`YMap.js` | 本轮实读 | C-1 精确分支的事件聚合语义地基（§8） |
| `wiki/raw/task_issue-388_sa4_review.md` | 本轮新建 | 本产物 |

## 2. Verdict

**`approve`** —— 0 × BLOCKER / 0 × MAJOR / 4 × MINOR（Non-blocking observations）。

实现与设计 F-1–F-6 冻结、§8 门⑥/判定算法、§9 矩阵、§10 测试结构逐项一致；文件面与 §11 ALLOW 逐行
精确匹配、DENY 面零 diff（本轮 `git diff` 复核）；红灯证据在独立 scratch worktree（HEAD `28faeae`、
源码零 diff）复现且红行集合与能力缺口逐条对应（反伪绿分档成立）；规定验证门（root typecheck 14
tsconfig exit 0、root test 396 文件 / 4785 用例 + Type Errors no errors）日志在场且与自述一致。
SA8 转交的 4 条非阻塞事项经本轮独立裁处（§12）。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| AC1 谓词词表 `{field,equals}`/`{field,in}`、值域恒标量、`in` 集合语义 | `watch-map.ts` `NamespaceRuntimeWatchMapWhere` 联合恰两成员；`readWatchWhere` 键集恰 `{field}` ∪ 恰一算子；`matchPredicate` 存在量词线性扫描（顺序无关、去重自然成立）；⑥-d 按 SameValue 去重并 `Object.freeze` | **落实**（E1/E2/E3/E12→N12/N12b 行锚定，29/29 绿） |
| AC2 建立期 schema 裁决 → `WATCH_MAP_OPTIONS_INVALID`；建立后零参数错误 | 门⑥ a–d 全同步、失败 throw 先于 `subscriptions.add`；⑥-d 深冻结快照（通知路径纯读 compiled 谓词，结构上零参数再校验） | **落实**（E4–E7/E5b/E11 + 零登记佐证行） |
| AC3 缺失 / null 恒不匹配、无 NULL 三值逻辑 | `readMemberScalar`：缺失/null/对象/Y 载体/非标量一律 `undefined`；`matchPredicate` 对 `undefined` 恒 false——两算子同路径 | **落实**（N11 (a)–(d) 四载体分支，O1 已按 SA2 路由拆行） |
| AC4 同值写不通知（载体 delta 在、投影值未变） | T1 `isRealChange` 前置原样保留（`if (!isRealChange(...)) continue` 先于谓词层）；`isRealChange`/`plainDataEquals` 本体零改动 | **落实**（N5 行 + 代码 diff 核对零触碰） |
| AC5 匹配通知 / 不匹配（可判时）静默 | `predicateKeepsContainerChange`：add → newMatch；update plain → oldMatch ∨ newMatch；delete plain → oldMatch | **落实**（N7/N8 首红行于 HEAD 红、实现后绿——独立复现日志核对） |
| AC6 退出匹配集也通知 | C-2 保守面（N3）+ plain delete oldMatch（N10b）+ plain 进入（N10） | **落实** |
| AC7 嵌套 Y.Map 部分更新保守 / plain 整值替换精确 | C-2 谓词在场恒保守产出（AC7 逐字）；plain 判据 = `isPlainData(oldValue)`，live 载体（Yjs 整替/删除后内容清空）保守 | **落实**（F-1 逐字；N1/N2/N6 保守与 N9/N9b 精确对偶成行） |
| AC8 判定矩阵契约测试（先例 = 窗口读家族） | 三件套落 `packages/namespace-registry/test/`，29 行为 + 3 类型用例；include 正则采集（`vitest list` 56 文件日志） | **落实**（见 §9 测试质量审查） |
| SA2-1（已解决）调用面闭包 + root `pnpm test` 门 | ws-replication `testing.ts` L50 `lease.watchMap.bind(lease)` 零 diff（bind 保形自动加宽）；9 替身 / 4 键审计零 diff；root test 4785 用例全绿（含 ws-replication 套件实跑门面） | **落实**（兼容性经实跑验证，非仅静态推断） |
| SA2 O1–O7 / O10（实现相位项） | O1 N11 拆四载体分支 / O2 零 `E12` 引用（grep 零命中）/ O3 `note?: YLeaf<string>` + E3 三形态 / O4 `in` 逐索引 descriptor 读 / O5 lease 成员 JSDoc / O6 SameValue 去重注释 / O7 事实记于 SA3 报告 §7-3（设计文档不在 ALLOW）/ O10 root test 日志闭环 | **全部落实**（逐项本轮复核） |
| SA8 实现后报告 4 条非阻塞转交 | ①oracle 固化 ②union 全标量子情形 ③Proxy trap 子情形 ④T3–T5 分期边界 | 逐项裁处于 §12（均不构成阻断） |
| Owner 评论（空快照） | 无 comment ID / updated_at 条款可并入 | 无遗漏面 |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| §8.1 签名 `watchMap(path, listener, options?)` 纯加法 | `runtime.ts` 成员面 + wiring `watchMap: (path, listener, options) => ...`；hub 面；`types.ts` lease 成员第三参；`lease.ts` raw 透传（released 短路先于透传） | 一致（三处同形） | — |
| §8.2 门⑥ 位置（⑤ 之后、⑦ 登记之前）与门内子序 | `watch-map.ts` L754–807：①–⑤ T1 原序原样 → `compileWatchPredicate` → 登记；子序 options 形状 → where 词形 → in 空数组 → field 不存在 → 条目无统一值域 → 非标量域 | 一致（E7/E8 行按子序可判） | — |
| §8.2 ⑥-a/b 零 `[[Get]]` 敌意通道纪律 | `readWatchMapOptions`/`readWatchWhere`：`Object.keys` + `Object.getOwnPropertyDescriptor` 取值、accessor 显形拒绝、原型须 plain、整体 try 收编 trap、`in` 成员逐索引 descriptor 读（稀疏位 fail-closed） | 一致（镜像 `canonicalWindowBudget` 先例；E7 访问器/敌意形态行锚定） | — |
| §8.2 ⑥-c 纯 schema 侧（零 live 探测、零二次 resolve） | `compileWatchPredicate` 仅消费门⑤ 已得 `resolved.valueSchema` + `resolved.aliases`；全函数零 `.get()`/零 doc 访问；`chaseValueSchema` 单点追尽循环（`resolveCarrierKind` 重构为其薄包装，`?.kind ?? 'unknown'` 语义恒等） | 一致（E9 数据缺席行锚定） | — |
| F-2 域闭包（标量/enum/pattern/int/range 接受；object/array/xml/一切 union/scalar null/unknown/封闭 map/标量条目容器拒绝） | `isScalarValueDomain` switch 默认分支 fail-closed；⑥-c 无 `<key>` 字段或元素域非 object → 条目无统一值域 | 一致（E5 四域族 + E5b 两形态） | — |
| §8.2 ⑥-d 编译冻结快照（不保留调用方对象） | equals → `Object.freeze({op,field,value})`（值恒原始标量）；in → 新建数组 + SameValue 去重 + 双层 `Object.freeze`（调用方数组不保留引用） | 一致 | — |
| §8.3 C-1 判定表（add/update/delete × plain/live） | `predicateKeepsContainerChange` 三分支逐字实现；逐 key try/catch → 异常该 key 保守 | 一致（**附注**：见 §8 对 yjs@13.6.32 聚合语义的独立源码核证——同事务 delete-then-set 聚合为 `update`、新键 set-then-delete 被整体省略，精确分支无漏通知形态） | — |
| §8.3 C-2 嵌套保守（F-1 逐字） | `collectChanges` C-2 分支谓词在场无条件产出（真变前提 `isNestedEntryChanged` 保留） | 一致（N1/N2 行） | — |
| §8.3 同 key 多事件产出取向单调 | `byKey` 只增不删（`Map<key>` 首见序去重原样），过滤分支 `continue` 不回退已产出 key | 一致 | — |
| §8.5 分层落点（runtime 求值 / registry 透传 / 复制零接触） | 谓词全部在 `watch-map.ts`；`lease.ts` L355–357 raw 直传零解释；ws-replication/replication-protocol/persistence 零 diff | 一致 | — |
| §8.6 错误注册 append-only | `errors.ts` 纯追加 hunk（`WATCH_MAP_OPTIONS_INVALID_CODE` + 联合成员）；既有两码逐字零改动；六 message 单点常量、码前缀、互相可区分、零 path/field/值回显（本轮逐条复读文案） | 一致（E11 六 cause 可区分 + 探针零回显断言绿） | — |
| §8.7 并发/生命周期（零新状态面、谓词随订阅回收） | 谓词为 `WatchSubscription.predicate` 只读字段；退订/释放/shutdown 代码零改动；观察器单线程同步段求值 | 一致 | — |
| F-5 命名与导出（两包 Options/ScalarValue 别名；`where` 联合模块内部） | 两包 `index.ts` type-only +2；`NamespaceRuntimeWatchMapWhere` 定义于 watch-map.ts 但不经 index 导出；Equal 锁 +3 并注册 `LeaseTypeAssertions` | 一致（surface 契约双源 Equal 锁绿） | — |
| F-6 plain 条目面（Y.Map 容器 + plain 条目值 + raw 驱动） | fixture `plainTasks` 容器 raw 构造 plain 条目 + `rawTransact` 驱动；受控写/纯 plain 两载体物理分离（SA8 §8-3 已裁知悉：受控写校验拒绝混合载体，双容器构造保持 F-6 语义） | 一致（构造差异已由 SA8 备案，语义无偏离） | — |
| §10.2 fixture 自持 options 位单点 + T1 零改动 | fixture 自持 `watchMapOf`/`attemptEstablishWatch`/`establishWatch` 三参版；`NotificationSink`/`openSecondLease` 从 T1 fixture import 复用（零复制） | 一致；**§10.2 oracle helper 一项未落 fixture**（见 O-A） | MINOR |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| 谓词求值与宁多勿漏判定 | runtime（ADR 0030 §7） | `watch-map.ts` 唯一载体 | 正确 |
| lease options 透传与生命周期登记 | registry lease 面（零解释） | `lease.ts` released 短路 → raw 直传 → 双幂等句柄 | 正确 |
| 稳定码注册 | runtime `errors.ts`（ADR 0008 词汇收口） | append-only 段；类不进 index | 正确 |
| 类型别名单源 | runtime 单源 + registry 同名跟随 | `types.ts` 别名 + `lease.ts` Equal 锁 | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| options 敌意通道校验 | `window-read.ts` `canonicalWindowBudget`（零 `[[Get]]` + 描述符 + try 收编） | `readWatchMapOptions`/`readWatchWhere` 同款纪律 | 一致 | 仓内既有纪律复用（设计 §2 敌意通道先例行明示） |
| ref/optional 追尽 | T1 `resolveCarrierKind` 循环 | 单点化为 `chaseValueSchema`，`resolveCarrierKind` 变薄包装 | 一致（消除第二副本） | 值域追尽单源；T1 语义恒等（`?.kind ?? 'unknown'`） |
| 标量 SameValue 相等 | `replication-session.ts` 值投影相等 | `Object.is` 单源、两算子共用、`in` 不用 Set | 一致 | F-4 对齐仓内先例 |
| plain 判据 | `plain-data.ts` `isPlainRecord` + 模块内 `isPlainData` | 只 import / 同模块单源复用，零改动 | 一致 | 冻结面纪律（DENY `plain-data.ts` 零 diff） |
| 窗口读 lease 契约三件套（fixture/red/surface） | `issue-369-window-read-*` / T1 `issue-387-*` | `issue-388-watch-map-predicate-*` 同构 | 一致 | AC8 先例族延续 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 谓词语义（存续期） | ⑥-d 深冻结 `CompiledWatchPredicate` | 无派生态（判定只读 compiled） | 无（设计 §7.6 明确否决快照缓存态，实现遵守） |
| 载体/域追尽 | `chaseValueSchema` 单循环 | `resolveCarrierKind`（包装） | 无（单点） |
| 错误 message | watch-map.ts 六常量单点 | 无 | 无 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| 登记（⑦；含 predicate 字段） | `unsubscribe` 幂等 / lease 释放清理 / hub shutdown 清空 | 门⑥ throw 零登记（throw 先于 `subscriptions.add`） | 对称（谓词无独立生命周期面，随订阅对象回收；N14 行锚定） |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 第二套域追尽 | T1 `resolveCarrierKind` | 重构合并为 `chaseValueSchema` 单点 | 非平行（副本消除） |
| 第二套标量相等 | `Object.is` 单源函数 | 同 | 非平行 |
| 第二队列/泵/状态机 | T1 enqueue/pump | 零触碰（diff 核对） | 非平行 |
| lease 层谓词解释 | runtime 门⑥ | `lease.ts` raw 直传零解释 | 非平行 |

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/namespace-runtime/src/watch-map.ts`（+397/−49 区域） | §11 行 1 | 门⑥ + 判定算法 + message 常量 + 注释 | 在范围 |
| `packages/namespace-runtime/src/errors.ts`（+9/−1） | §11 行 2 | 新码 append-only | 在范围（纯追加 hunk） |
| `packages/namespace-runtime/src/runtime.ts`（+21/−3） | §11 行 3 | 成员加宽 + JSDoc + wiring 透传 | 在范围 |
| `packages/namespace-runtime/src/index.ts`（+12） | §11 行 4 | type-only +2 + 头注释 | 在范围（值导出面不变） |
| `packages/namespace-registry/src/types.ts`（+33/−8） | §11 行 5 | lease 成员加宽 + 2 别名 + JSDoc | 在范围 |
| `packages/namespace-registry/src/lease.ts`（+32/−7） | §11 行 6 | options 透传 + Equal 锁 +3 | 在范围 |
| `packages/namespace-registry/src/index.ts`（+7） | §11 行 7 | type-only +2 + 头注释 | 在范围 |
| `packages/namespace-registry/test/issue-388-watch-map-predicate-fixture.ts`（新 433 行） | §11 行 8 | 共享 fixture | 在范围（非测试文件，不被收集——符合设计） |
| `packages/namespace-registry/test/issue-388-watch-map-predicate-red.test.ts`（新 851 行） | §11 行 9 | 行为契约 29 用例 | 在范围 |
| `packages/namespace-registry/test/issue-388-watch-map-predicate-surface.test-d.ts`（新 164 行） | §11 行 10 | 类型契约 3 用例 | 在范围 |
| `artifacts/sa3-issue388-*.log` / `sa6-issue388-*.log` | 技能固定产物位 | 证据日志 | 在范围（先例同 T1/SA6） |
| `wiki/raw/task_issue-388_*.md` | 技能固定产物位 | 各相位产物 | 在范围 |

**DENY 面零 diff 复核**（`git status --porcelain` 全量 + `git diff HEAD --stat` 定向）：
`docs/adr/**`、`CONTEXT.md`、`docs/protocols/**`、`packages/ws-replication/**`（含 `src/testing.ts` 门面）、
`packages/replication-protocol-v1/**`、`packages/persistence/**`、`packages/vfsl/**`、
`packages/namespace-diagnostic-log/**`、`window-read.ts`/`read-schema-projection.ts`/`plain-data.ts`、
`registry.ts`、T1 三件套（`issue-387-watch-map-*`）、`readdata-ok-shape.ts`、`vitest.config.ts`、
`tsconfig*.json`、根 `package.json`、`apps/**`、`domains/**`、`scripts/**` —— **全部零改动**。
未跟踪面仅新三件套 + 日志 + wiki 产物；临时探针 `sa3-tmp-oracle-probe.test.ts` 已删（本轮 `git status` 复核无残留）；
scratch worktree 已移除（`git worktree list` 无 `388` 相关临时项）。**无越界。**

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| `watchMap` 第三参加宽（lease/runtime 两面） | `ws-replication/src/testing.ts` `decorateLease`（shipped `./testing` 出口） | `lease.watchMap.bind(lease)` 保形：绑定引用类型随源签名自动加宽，门面零改动兼容 | 无（root typecheck 含 ws-replication tsconfig + ws-replication 套件 root test 实跑全绿——静态+动态双证） | — |
| 同上 | 9 个 registry 测试替身（少参 `watchMap()` mock） | TS 少参实现恒可赋值给宽签名；零改动 | 无（root test 4785 用例含九替身全绿） | — |
| `watchMap` 键名 | 4 处键审计表（runtime ×3 + lease ×1） | 原位加宽不新增键（lease 恰 16 键，NC 行断言在产） | 无 | — |
| `Parameters<NamespaceLease['watchMap']>` Equal 锁 | `lease.ts` 类型断言 + T1 surface 契约 | `_watchMapMemberAlias` 双源对偶自动保持；新增 Options/ScalarValue 两锁注册 | 无（typecheck 绿） | — |
| 新错误语义 `WATCH_MAP_OPTIONS_INVALID` 同步 throw | lease 消费方（失败面不是结果联合，`ReturnType` 恰 handle） | throw 原样上抛 lease 面；B-3 冻结保持；类型面 `types.ts` JSDoc 已列（O5） | 无 | — |
| 通知三 kind / data 形状 / 队列 / 分发 / 生命周期 | 全部既有订阅消费方 | 载荷构造与分发面 diff 零触碰；谓词只过滤 key 集合（N13/N14 锚定） | 无 | — |
| `collectChanges` 内部签名 +1 参 | 仅 `onRootTransaction` 单调用点 | 同步更新，无其他调用方（模块私有） | 无 | — |
| `import * as Y`（type→值导入，`instanceof` 判据） | runtime 包打包面 | yjs 既是 runtime 既有依赖，无新依赖面 | 无 | — |

## 8. 错误、恢复与并发

| 面 | 实现事实 | Assessment |
|---|---|---|
| 观察器零 throw 红线 | 外层整体 try/catch 原样（L718–729）；谓词逐 key try/catch → 该 key 保守（`keeps = true`），同事务其他 key 不受影响 | 一致（SA8 Action 5；N15 行） |
| 求值零 throw 设计 | `readMemberScalar` 全量分类（Y.Map → get；plain → own 读；其余 → 无成员），数据偏离 schema 恒不匹配而非抛 | 一致（N15 三类偏离数据行） |
| 部分完成诚实性 | 失败建立 = 零登记零 observer 变更；通知过滤只影响 key 集合，不伪造成功/吞变更 | 一致 |
| 幂等 | 退订双幂等原样；谓词无独立可重复入口（建立期一次性编译） | 一致 |
| 重启/事务中断 | 无持久化新增面；谓词为进程内订阅态 | 一致 |
| 并发 | 单线程观察器 + `maxWorkers: 1`（T1 事实）；谓词求值在观察器同步段，零交错面 | 一致 |
| **C-1 精确分支的事件形状地基** | 本轮实读安装版 `yjs@13.6.32` `YEvent.js` `get keys()` 聚合源码：同事务 delete-then-set → 聚合为 `update`（oldValue = 事务前值）；新键 set-then-delete → **键整体省略**（nop）；`delete` 仅当事务末缺席、`add` 仅当事务初缺席 | **精确分支无漏通知形态**：`delete` 分支的 oldMatch 精确判定不可能错过「事务末仍在场且新值匹配」的 key（该形态恒聚合为 `update`，走 oldMatch ∨ newMatch）。设计 §14 已列「Yjs 行为变化 → 矩阵行红即报警」的对冲，N6/N9 系列行即该报警器 |
| stale generation / 双写 | 无缓存态（F-1 零状态判定），无双写面 | 一致 |

静态无法确认项 → §11 后续动态验证项。

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| `issue-388-watch-map-predicate-red.test.ts`（29 用例：E1–E11 + N1–N15b + NC） | 建立判定（六 cause 同码异 message、零登记）、判定矩阵（保守/精确/静默分档）、载荷/生命周期/键集负控 | `vitest.config.ts` include `packages/*/test/**/*.test.ts`；CI `ci.yml` `vitest run`（分片）+ `vitest list` 采集实证（56 文件日志） | 无 skip/only/todo（grep 零命中）；零源码字符串断言；`expect.poll`（5ms/2s）+ 屏障事务，零 sleep；混合行排序后 `toStrictEqual` 零「至少含」软化；readData 四键经 `expectReadDataOkKeys` 集中 helper（零内联字面量） | — |
| 红灯独立复现 | `verify-red-repro.log`：scratch worktree HEAD `28faeae` + 源码 `git diff` 零 → 行为 13 failed / 16 passed（exit 1）+ 类型 1 failed / 2 passed + Type Errors 1 failed | 日志实读：红行 = E4/E5/E5b/E6/E7/E11 + N7/N8/N9/N9b/N11/N12/N12b + surface 三参正例；保守行（N1–N6/N10/N13–N15）HEAD 绿被显式分档不取红证据 | **反伪绿成立**（红行集合 = SA6 §13 能力缺口逐条对应；非环境噪声） | — |
| 绿灯 + 回归 | 行为 29/29、类型 3/3 + no errors、T1 三件套 23/23、root typecheck（14 tsconfig）exit 0、root test 396 文件 / 4785 用例 + Type Errors no errors（629.44s） | `artifacts/sa3-issue388-verify-*.log` 九份本轮 tail/grep 实读，计数与 SA3 §5 自述一致 | 无弱化迹象；`--passWithNoTests` 门在 CI 侧（ci.yml 明示防静默假绿） | — |
| `issue-388-watch-map-predicate-surface.test-d.ts`（3 用例） | 三参正例 / 两参兼容 / 双源 Equal 锁 ×4 / options 键集 / 判别窄化 / 9 条 `@ts-expect-error` 负例 | typecheck include `packages/*/test/**/*.test-d.ts`（`tsconfig.typecheck.json` 含 `packages/*/test/**`；`exactOptionalPropertyTypes: true` 使 present-undefined 负例真实） | 双算子负例**诚实缺席**：文件头注 TS 联合 excess-property 语义会吸收 `{field,equals,in}` 使 `@ts-expect-error` 失真 → 运行时 E7「双算子」行承担（在场且红→绿）。不写会失真的断言是正确取舍 | — |
| 负控族 | NC1（E10 四形态无谓词逐字不变）/NC2（readData 四键 + 窗口读在产 + `WINDOW_CARRIER_MISMATCH` 零改动 + lease 恰 16 键）/NC3（E8 门次序 P2/P5/P6）/NC5（N5）/NC6（E9）/NC7（N13） | 同上 | NC4 为实现前全网健康锚（性质 = 基线，非契约行），root test 全绿已覆盖其意图 | — |
| oracle 纪律 | SA6 §12.5-5：readData 投影值为独立预言机 | 矩阵行采用字面 fixture 期望（种子在 fixture 显式声明，与实现逻辑无关）；readData 仅 NC 行经 helper；临时探针交叉核对 2/2 后删除（日志在场） | 期望独立性实质保持（字面期望非循环）；但 §10.2 的 readData oracle helper 未固化进契约文件 | MINOR（O-A） |

## 10. Required revisions

无（0 × BLOCKER / 0 × MAJOR）。

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| CI 分片实跑新三件套（本地全量绿 ≠ CI 环境绿） | CI `ci.yml`（typecheck job + vitest 分片 + `--typecheck.only`） | 新两测试文件被分片采集并绿；typecheck job exit 0 | CI 上新文件未被采集或红 |
| 谓词订阅在复制 apply 事务下的判定（`origin='replication'`） | 双 doc 复制场景（T3 #389 验收面；T2 仅保证零 origin 过滤 + 判定同路径） | 复制 apply 产生的 plain/live 变更按同一判定矩阵分档；`origin` 投影 `'replication'` | 复制路径判定与本地路径分叉 |
| 故障注入下的逐 key 保守收编（`readMemberScalar` 设计为零 throw，真实 throw 仅可经 mock/调试器构造） | fault-injection（T4 #390 testing 注入位附近属后续票） | 单 key 求值异常 → 该 key 通知、同事务其他 key 不受影响、订阅存活 | 异常升级为 observer 外抛或写 fatal |
| yjs 升级下精确分支地基（`YEvent.keys` 聚合 + live oldValue 清空两事实） | 依赖升级窗口 | N6/N9/N9b/N10 系列行维持绿（行为锚定即报警器） | 精确静默行变红（聚合/清空语义漂移） |
| schema 替换后既有谓词订阅沿用编译谓词（T2 无 watch-end） | `replaceSchema` 后触发匹配/非匹配变更 | 按建立期谓词继续判定（ADR L85 已知形态，T3 #389 收口） | 静默死亡或建立期语义漂移 |

## 12. Non-blocking observations

| ID | 严重度 | 观察 | 处置建议（路由） |
|---|---|---|---|
| O-A | MINOR | 设计 §10.2 描述的 readData 投影 oracle helper 未落进 fixture/契约（SA6 §12.5-5 纪律的固化形态）；矩阵行以字面 fixture 期望替代 + 一次性探针核对（2/2 绿、日志在场）后删除。期望独立性实质未弱化（字面期望源自 fixture 显式种子、非实现输出循环），且设计 §10.3 逐行纪律（1–7）不含 oracle 项、全部满足；SA8 §8-2 已将「是否固化」裁权交 SA4 | 不阻断。建议后续票（或 T3/T4 契约增补时）在 ALLOW 测试面加一行永久 oracle 行（readData 经 `expectReadDataOkKeys` 交叉断言一条匹配/一条非匹配），把 SA6 §12.5-5 从「探针证据」升为「在产契约」（acceptance-contract / implementation 测试面增补，非本票义务） |
| O-B | MINOR | union 全标量成员子情形无专属测试行（F-2 冻结「一切 union 拒绝」；`isScalarValueDomain` 默认分支结构上恒拒，E5 锚定的是含容器成员的 `detail` union） | 不阻断（fail-closed 方向结构恒成立）。可随 O-A 增补一行 `type Scalar = "a" \| "b"` 全标量 union 的 E5 族行 |
| O-C | MINOR | 「trap 抛异常的 Proxy」子情形无专属测试行（门⑥-a/b 整体 try 收编 → 同码拒绝；E7 锚定 accessor/非对象/未知键/数组形态） | 不阻断（fail-closed 方向安全）。可在 E7 形态族补一例 throwing-Proxy |
| O-D | MINOR | `readWatchMapOptions`/`readWatchWhere` 经 `Object.keys` 不可见 Symbol 键（带 Symbol 键的 options 对象被按 `{}`/词形处理）——与 `canonicalWindowBudget` 先例同口径，Symbol 键不构成语义通道（封闭形状契约为 `{where?}`） | 不阻断。如需绝对一致性可在注释明示「Symbol 键非形状通道」 |

### 与 SA8 转交项的裁处对账

| SA8 转交（§8） | 本轮裁处 |
|---|---|
| ① oracle 固化裁决 | O-A：不阻断 + 建议后续增补 |
| ② union 全标量子情形 | O-B：不阻断 + 可选增补 |
| ③ Proxy trap 子情形 | O-C：不阻断 + 可选增补 |
| ④ fixture 双容器构造说明 | 已知悉（§4 F-6 行）：受控写校验拒绝混合载体 ⇒ `tasks`/`plainTasks` 双 Y.Map 容器为必要构造，F-6 冻结语义完整保持 |

---

## 复核声明

本轮零实现/设计/测试改动、零测试运行、零服务启动、零临时进程与 marker；唯一写产物 = 本文件。
SA8 `requiresConflictRecheck = false` 维持——本轮未发现新的决策面或 ADR 冲突风险（C-1 精确分支的
Yjs 事件聚合地基经安装版源码独立核证，落在 ADR 0030 §5 既有条款与设计 §14 已识别风险行内）。
