# SA3 Implementation Report — issue #388 谓词订阅与宁多勿漏判定（变更订阅 T2）

- 角色：SA3（TDD 执行者）；dispatch：`sa-9900a86d-36d8-4692-b742-d5b8cf6624fe`（iteration 0）
- Worktree：`/home/wangjian/nomicore-fix-issue-388`（branch `mabf/issue-388`，HEAD `28faeae`）
- 设计基准：`wiki/raw/task_issue-388_design.md`（当前唯一有效版本，含 F-1–F-6 冻结与 §16 对 SA2-1 的落实）；
  SA2 复评 `approve`（0 × BLOCKER / 0 × MAJOR）；SA6 契约 `approve`；SA8 冲突报告 `clear` + 6 条 required actions
- Owner feedback：issue #388 评论 = **0**（Host dispatch「REST comments read returned none」；SA6 §2 / SA8 §2/§4 独立同口径）
  ⇒ **无 owner 要求、comment ID 或 updated_at 条款需并入**；需求源 = issue body + AC1–AC8 + ADR 0030 决策 2/3/5
- 结论：**实现与设计一致、红灯契约转绿、规定验证全绿**（见 §5）；无阻塞项

---

## 1. Inputs consumed

| 输入 | 用途 | 状态 |
|---|---|---|
| `wiki/raw/task_issue-388.md` | Host brief：What to build + AC1–AC8 | 在场（35 行） |
| `wiki/raw/task_issue-388_sa6_contract.md` | 验收契约：B-1–B-10 / E1–E11 / N1–N15 / §12.5 断言纪律 / §12.4 测试路径 | 在场（500 行） |
| `wiki/raw/task_issue-388_design.md` | **实现绑定**：F-1–F-6、§8.1 签名/类型、§8.2 门⑥ a–d、§8.3 判定算法、§8.5 分层落点、§9 矩阵、§10 测试结构、§11 ALLOW/DENY | 在场（670 行） |
| `wiki/raw/task_issue-388_sa2_review.md` | SA2 复评 `approve` + §14 O1–O7/O9/O10 非阻断观察 | 在场（24717 B） |
| `wiki/raw/task_issue-388_conflict_report.md` / `_relevant_decisions.md` | SA8 前置门禁（clear；6 条 required actions；冻结面清单） | 在场 |
| `docs/adr/0030-change-subscription.md`、`CONTEXT.md` L65–67 | 规范权威（§2 词表 / §3 建立判定 / §5 宁多勿漏 / §7 分层） | 只读（零改动） |
| `packages/namespace-{runtime,registry}/AGENTS.md` | 模块验证门（root `pnpm typecheck` + root `pnpm test`；公共 API 仅经 `src/index.ts`） | 实读 |
| 既有实现（未提交） | 本 worktree 前序 SA3 pass 落盘的 7 源文件 + 3 测试文件 + 证据日志 | 在场（本轮核对，见 §2） |

## 2. Existing worktree reconciliation

进入时 worktree 已存在**未提交实现**（7 个 `src` 修改 + 3 个新测试文件 + `artifacts/sa3-issue388-*.log`），
但**无** `wiki/raw/task_issue-388_sa3_impl.md` ⇒ 按技能「未提交实现 = 当前待修订状态」处理：

1. **逐文件核对设计**：7 个源文件改动逐条对照设计 §8.1/§8.2/§8.3/§8.5/§8.6、§11 ALLOW 行——
   门⑥ 位置（⑤ 之后、⑦ 登记之前）、C-1/C-2 判定分支、六条 message 常量、2+2 类型别名、
   lease 第三参透传、errors.ts append-only，全部一致；**未发现过时/冲突/不完整实现**。
2. **保留全部既有改动**（含前序红灯/绿灯证据日志）；本轮**零源码修改**，只新增独立验证日志与本报告。
3. **独立重跑全部验证**（§5），其中红灯证据在**独立 scratch worktree**（HEAD `28faeae`，源码零 diff）复现，
   证明契约确为红→绿，而非前序日志的孤立声明；scratch worktree 已删除（`git worktree list` 复原）。
4. 临时预言机探针（`packages/namespace-registry/test/sa3-tmp-oracle-probe.test.ts`）运行后即删，
   `git status` 复核无残留（§5 行 8）。

## 3. Changed paths

| Path | Design section | Change | 规模 |
|---|---|---|---|
| `packages/namespace-runtime/src/watch-map.ts` | §8.2 / §8.3 / §8.5 | 门⑥ a–d（options/where 敌意形状 → `in` 空数组 → 纯 schema 侧 field 解析 → 编译冻结）+ `CompiledWatchPredicate` + `NamespaceRuntimeWatchMapWhere`/`Options`/`ScalarValue` 类型 + C-1（add/update/delete 精确或保守）与 C-2（保守）谓词层 + 逐 key try/catch + 六条 message 常量 + 边界注释更新 + `import type * as Y` → `import * as Y`（`instanceof` 判据需要） | +397/−49 行区域 |
| `packages/namespace-runtime/src/errors.ts` | §8.6 | `WATCH_MAP_OPTIONS_INVALID_CODE` 常量 + `WatchMapErrorCode` 联合成员（**append-only**；既有两码逐字零改动；`WatchMapError` 前缀机制复用） | +9/−1 |
| `packages/namespace-runtime/src/runtime.ts` | §8.1 / §8.5 | `NamespaceRuntime.watchMap` 成员第三参加宽 + 谓词语义 JSDoc + wiring 透传 `(path, listener, options) => watchHub.watchMap(path, listener, options)` | +21/−3 |
| `packages/namespace-runtime/src/index.ts` | §7.5 / §8.5 | type-only +2 导出（`Options` / `ScalarValue`）+ 头注释增量段（值导出面不变） | +12 |
| `packages/namespace-registry/src/types.ts` | §8.1 / §8.5 | lease `watchMap` 成员第三参加宽 + `NamespaceLeaseWatchMapOptions` / `NamespaceLeaseWatchMapScalarValue` 别名 + 注释块更新（含 `WATCH_MAP_OPTIONS_INVALID` JSDoc，SA2-O5） | +33/−8 |
| `packages/namespace-registry/src/lease.ts` | §8.5 | options raw 透传（released 短路先于透传）+ Equal 锁 +3（Options 别名 / Options≡成员第三参 / ScalarValue 别名）并注册进 `LeaseTypeAssertions` | +32/−7 |
| `packages/namespace-registry/src/index.ts` | §8.5 | type-only +2 导出 + 头注释增量段 | +7 |
| `packages/namespace-registry/test/issue-388-watch-map-predicate-fixture.ts` | §10.2 | 新建共享 fixture（433 行）：schema（别名/可选/字面量/嵌套/数组/union/xml 域 + `meta` 封闭 map + `counters` 标量条目容器 + `ghost?` 缺席面）、live 条目与 plain 条目双载体、`rawTransact` helper、options 位单点 `watchMapOf`/`attemptEstablishWatch`/`establishWatch`；`NotificationSink`/`openSecondLease` 从 T1 fixture import 复用 | 新增 433 行 |
| `packages/namespace-registry/test/issue-388-watch-map-predicate-red.test.ts` | §9 / §10.3 | 新建行为契约（851 行）：E1–E11 + N1–N15 + NC（29 用例），逐 key 排序 `toStrictEqual`、`expect.poll` + 屏障、readData 四键经集中化 helper | 新增 851 行 |
| `packages/namespace-registry/test/issue-388-watch-map-predicate-surface.test-d.ts` | §10.4 | 新建类型契约（164 行）：三参正例 / 两参兼容 / 双源 Equal 锁 / 成员第三参锁 / 判别窄化 / 9 条 `@ts-expect-error` 负例 | 新增 164 行 |
| `artifacts/sa3-issue388-*.log`、`wiki/raw/task_issue-388_sa3_impl.md` | 技能固定产物位 | 证据日志 + 本报告（非源码面） | 见 §5 |

`git diff --stat`（源文件）：**7 files changed, 462 insertions(+), 49 deletions(-)**。

## 4. SA2 Finding落实

| Finding ID | Implementation | Result |
|---|---|---|
| **SA2-1（MAJOR，设计面已修订）**：调用方闭包与验证门 | 实现面影响 = 调用面兼容零改动：① ws-replication `src/testing.ts` `decorateLease` 的 `lease.watchMap.bind(lease)` 门面随源类型自动加宽（`.bind` 保形，DENY 面零改动）；② 9 个 registry 测试替身少参 `watchMap()` 实现恒可赋值给宽签名；③ 4 处键审计表与参数加宽正交（lease 16 键不变）；④ 设计新增的 root `pnpm test` 门已实跑 | **落实**：`pnpm typecheck` exit 0（含 ws-replication tsconfig）+ root `pnpm test` 396 文件 / 4785 用例全绿、Type Errors no errors，且上述 DENY 路径 `git diff` 零改动（§5 行 5/6、§6） |
| O1：N11 按载体拆行 | 行为契约 N11 内含 (a) 缺失+in-place（保守通知）/ (b) 缺失+live 整替（保守）/ (c) 缺失+add（精确静默）/ (d) plain null→匹配（通知）四个载体分支 | 已落实（内联标注） |
| O2：更正不存在的「E12」引用 | 新契约测试零 `E12` 引用（grep 零命中），形态族统一由 E7 承担 | 已落实 |
| O3：E3 可选标量锚 | fixture 补 `note?: YLeaf<string>`；E3 断言「别名域 / 字面量域 / 可选标量」三形态建立成功 | 已落实 |
| O4：门⑥-b `in` 成员索引读纪律 | `readWatchWhere` 对 `in` 逐索引 `Object.getOwnPropertyDescriptor` 读值（稀疏位 / accessor 位 → fail-closed shape 拒绝），全程零 `[[Get]]` | 已落实 |
| O5：`types.ts` lease 成员 JSDoc | lease `watchMap` JSDoc 补 `WATCH_MAP_OPTIONS_INVALID`（第六门）与 options 加宽说明 | 已落实 |
| O6：去重机制明示 | 门⑥-d 按 `Object.is` 对 `in` 值集去重并 `Object.freeze`，注释明示「SameValue 去重、不用 Set」 | 已落实 |
| O7：Yjs「同事务新建 type 不发自有事件」事实补记 | 该事实的落点（设计 §2/§14 事实表）不在本任务 ALLOW LIST（设计文档 DENY），故不改设计文本；实现面不依赖该事实——C-1 `add` 分支读 `target.get(key)` 事务提交后现值，无论嵌套 type 是否发自有事件判定一致（N7/N8 锚定）。事实记于本报告 §7-3 | 落实（以报告补记替代改设计） |
| O9：iteration 计数口径（MINOR） | 文档面问题，与实现无关；本报告采用「设计 iteration / 评审 iteration」双口径表述 | 不适用（非实现面） |
| O10：root `pnpm test` 断言缺实跑日志（MINOR） | 本轮实跑 root `pnpm test`（exit 0，396/4785、Type Errors no errors）并留存日志 | 已闭环 |

## 5. Verification

| # | Command | Result | Evidence |
|---|---|---|---|
| 1 | **红灯独立复现**（scratch worktree `HEAD 28faeae` + 新契约三件套，源码 `git diff` 零）：`npx vitest run .../issue-388-watch-map-predicate-red.test.ts --typecheck.enabled=false`；`npx vitest run --typecheck .../issue-388-watch-map-predicate-surface.test-d.ts` | 行为 **13 failed / 16 passed（29）exit 1**；类型 **1 failed / 2 passed（3）+ Type Errors 1 failed exit 1**；红行 = E4/E5/E5b/E6/E7/E11 + N7/N8/N9/N9b/N11/N12/N12b + surface 三参正例（四例 TS2554「Expected 2 arguments, but got 3」）；scratch worktree 已 `remove --force` + `prune`，`git worktree list` 复原 | `artifacts/sa3-issue388-verify-red-repro.log` |
| 2 | **行为契约转绿**：`npx vitest run packages/namespace-registry/test/issue-388-watch-map-predicate-red.test.ts --typecheck.enabled=false` | **29/29 passed**，exit 0 | `artifacts/sa3-issue388-verify-behavior.log` |
| 3 | **类型契约转绿**：`npx vitest run --typecheck packages/namespace-registry/test/issue-388-watch-map-predicate-surface.test-d.ts` | **3/3 passed，Type Errors: no errors**，exit 0 | `artifacts/sa3-issue388-verify-surface.log` |
| 4 | **T1 回归（NC1）**：`npx vitest run .../issue-387-watch-map-tracer-red.test.ts .../issue-387-watch-map-lease-surface.test-d.ts` | **23/23 passed（21 行为 + 2 类型），Type Errors: no errors**，exit 0 | `artifacts/sa3-issue388-verify-t1.log` |
| 5 | **根 typecheck**（模块 AGENTS 门）：`pnpm typecheck` | **exit 0**（14 个 tsconfig 全过；含 `packages/ws-replication/tsconfig.json` 的 testing 门面） | `artifacts/sa3-issue388-verify-typecheck.log` |
| 6 | **根全量测试**（设计 §12 / 模块 AGENTS 门）：`NODE_OPTIONS=--conditions=nomicore-source npx vitest run --typecheck` | **exit 0**：396 文件 / 4785 用例 passed，Type Errors: no errors，629.44s（含 ws-replication 套件、九替身、四审计文件；root-typecheck 之外的类型面） | `artifacts/sa3-issue388-verify-root-test.log` |
| 7 | **runner 采集**：`npx vitest list packages/namespace-registry --filesOnly` | exit 0，56 文件；新行为契约第 6 行、新类型契约第 47 行被既有 include 正则采集 | `artifacts/sa3-issue388-verify-runner-list.log` |
| 8 | **独立预言机交叉核对**（临时探针，运行后删除）：`npx vitest run packages/namespace-registry/test/sa3-tmp-oracle-probe.test.ts --typecheck.enabled=false` | **2/2 passed**，exit 0：以 `lease.readData([...path,key])` 投影值为独立预言机（形状经 `expectReadDataOkKeys`），核对「oracle 非匹配 → 静默」「oracle 匹配 → 通知」「退出/进入匹配集 → 通知」在 live 与 plain 两载体上一致 | `artifacts/sa3-issue388-verify-oracle-probe.log` |
| 9 | 契约内负控行（同套件内含）：readData 四键（集中化 helper）/ `readMap` 在产 / `WINDOW_CARRIER_MISMATCH` 零改动 / lease 恰 16 键 / 通知三键两键形状 / 同值写零通知 / 门次序 P2-P5-P6 同构 | 全绿（含在行 2 的 29/29 内） | `artifacts/sa3-issue388-verify-behavior.log` |

**TDD 序列闭环**：行 1（红：能力缺口 = 静默建立 + 多通知 + 类型缺席）→ 行 2/3（绿：实现使契约转绿）；
红灯行集合与 SA6 §13「旧实现失败点」逐条对应，且保守行（N1/N2/N6/N10）在 HEAD 亦绿灯被显式分档，未作红证据（反伪绿）。

## 6. File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/namespace-runtime/src/watch-map.ts` | §11 ALLOW 行 1 | 门⑥ + 判定算法 + message 常量 + 注释 |
| `packages/namespace-runtime/src/errors.ts` | §11 ALLOW 行 2 | 新码 append-only（仅码 + 联合成员） |
| `packages/namespace-runtime/src/runtime.ts` | §11 ALLOW 行 3 | 成员加宽 + JSDoc + wiring 透传 |
| `packages/namespace-runtime/src/index.ts` | §11 ALLOW 行 4 | type-only +2 导出 + 头注释 |
| `packages/namespace-registry/src/types.ts` | §11 ALLOW 行 5 | lease 成员加宽 + 2 别名 + 注释 |
| `packages/namespace-registry/src/lease.ts` | §11 ALLOW 行 6 | options 透传 + Equal 锁 |
| `packages/namespace-registry/src/index.ts` | §11 ALLOW 行 7 | type-only +2 导出 + 头注释 |
| `packages/namespace-registry/test/issue-388-watch-map-predicate-fixture.ts` | §11 ALLOW 行 8 | 新建共享 fixture |
| `packages/namespace-registry/test/issue-388-watch-map-predicate-red.test.ts` | §11 ALLOW 行 9 | 新建行为契约（29 用例） |
| `packages/namespace-registry/test/issue-388-watch-map-predicate-surface.test-d.ts` | §11 ALLOW 行 10 | 新建类型契约（3 用例） |
| `artifacts/sa3-issue388-*.log` | 技能固定产物位（同 T1/SA6 先例） | 红/绿/静态门证据日志 |
| `wiki/raw/task_issue-388_sa3_impl.md` | 技能固定产物位 | 本报告 |

**DENY 面零改动复核**（`git status --porcelain` 逐项）：`docs/adr/**`、`CONTEXT.md`、
`packages/ws-replication/**`（含 `src/testing.ts` 门面）、`packages/vfsl/**`、
`packages/namespace-diagnostic-log/**`、`packages/namespace-runtime/src/{window-read,read-schema-projection,plain-data}.ts`、
`packages/namespace-registry/src/registry.ts`、T1 三件套（`issue-387-watch-map-*`）、
`packages/namespace-runtime/test/helpers/readdata-ok-shape.ts`、`vitest.config.ts`、`tsconfig*.json`、
根 `package.json`、`apps/**`、`domains/**`、`scripts/**` —— **全部零 diff**（未跟踪面仅新三件套 + 日志 + 报告）。

## 7. Deferred verification / 观察项（非阻塞，不属 SA3 职责）

1. **oracle 纪律的机制差异**：设计 §10.2 建议矩阵行以 `readData` 投影值作独立预言机；落盘契约的矩阵行
   采用**字面 fixture 期望**（种子数据在 fixture 显式声明，期望值与实现逻辑无关），`readData` 仅用于负控行
   （四键经集中化 helper，零内联四键字面量）。为补足该纪律，SA3 以临时探针做了独立 oracle 交叉核对（§5 行 8，
   双向一致后删除）。若 SA4/SA7 要求把 oracle 断言固化进契约文件，属后续增补（属 ALLOW 测试面）。
2. **`union` 全标量成员子情形**：F-2 冻结「一切 union 拒绝（含全标量成员）」；契约 E5 锚定的是
   「含容器成员的 union（`detail`）+ object/array/xml」。实现按 `isScalarValueDomain` 默认分支对**任何** union
   拒绝（fail-closed，结构上恒成立），但该子情形无专属测试行。
3. **Proxy 陷阱**：E7 锚定 accessor / 非对象 / 未知键等形态；「trap 抛异常的 Proxy」由门⑥-a/b 的
   整体 try 收编 → `WATCH_MAP_OPTIONS_INVALID`（设计 §8.2），实现成立但无专属测试行（fail-closed 方向安全）。
4. **SA6 非目标面**（T3 `watch-end`/复制 origin 验收、T4 溢出注入与父路径/容器整替编排、T5 文档缝、
   `watchArray`/`notEquals`/`and`/key 过滤/含值通知）未实现、未验证——按设计与契约属后续票。
5. **后续验证义务**：SA4/SA7 的最终动态验证与 CI 裁决（SA3 不承担）。

## 8. Deviations or blockers

- **无阻塞项**；**零源码偏离**设计 §7/§8/§9/§10 冻结裁定（F-1 逐字保守、F-2 fail-closed 收口、
  F-3 封闭小集、F-4 SameValue、F-5 前缀命名、F-6 plain 条目 fixture 修正均逐项落实）。
- **轻微澄清（非偏离）**：`NamespaceRuntimeWatchMapWhere` 在 `watch-map.ts` 模块内为 `export type`，
  但**未经 `src/index.ts` 导出**；runtime 包 `exports` 仅 `.` 与 `./internal`，故公共可达面与设计
  §7.5「模块内部类型、结构经 Options 可达」一致（消费者用 `NonNullable<Options['where']>` 命名）。
- SA2-1（MAJOR）无遗留；O1–O7/O10 全部落实（§4）；O9 为文档口径问题，不涉实现。

## 9. Suggested commit message

```text
fix(#388): watchMap 谓词订阅与宁多勿漏判定（变更订阅 T2）

- 公共面纯加法：watchMap(path, listener, { where }?) + 两包 Options/ScalarValue 类型别名
- 建立第⑥门（登记前、既有五门后）：封闭词表 {field,equals}|{field,in}、in 空数组、
  field 不存在/条目无统一值域/非标量域 → 同步 throw WATCH_MAP_OPTIONS_INVALID（零登记）
- 通知判定合取宁多勿漏：C-1 add/plain 快照精确，live 载体旧态与 C-2 嵌套保守通知
- 契约三件套（E1–E11 / N1–N15 / surface）+ T1 回归 23/23 + root typecheck/test 全绿
```

（SA3 不执行 `git add`/`commit`/`push`；提交信息仅供 Controller 选择。）
