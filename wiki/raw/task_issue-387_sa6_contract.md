# SA6 诊断与验收契约 — issue #387 watchMap 无谓词形态垂直通路（变更订阅 T1 / tracer bullet）

- 任务类型：**feature**（能力缺口证明 + 目标行为验收契约；不虚构 Bug 根因）
- 被审对象：issue #387「watchMap 无谓词形态垂直通路（变更订阅 T1/tracer bullet）」
  （brief `wiki/raw/task_issue-387.md`；Parent PR #386 = ADR 0030 设计基座；spec #385）
- Worktree / 基线：`/home/wangjian/nomicore-fix-issue-387`，branch `mabf/issue-387`，
  HEAD `6df1c6129ede45aa187964bd558bf552a143a299`（`docs(adr): 0030 变更订阅——watchMap 键容器变更信号`）
- 原始 dispatch 明确「Diagnose issue #387 and produce its verifiable acceptance contract for the
  no-predicate watchMap tracer bullet」；Issue 评论 **0 条**（REST 实读 `comments: []`）。
- **恢复轮（round 3，2026-09-14 20:14–20:38）**：上一会话在根全量运行中被打断（未提交
  structured result；临时探针未按 §16 计划清理）。本轮在 HEAD 不变、生产实现零改动的前提下
  对 §5/§6/§13/§14 的关键证据**全部重新实跑**（§17），并借**首次完整根跑**发现并修复契约集合
  的一处缺陷（NC1 内联 readData 四键字面量触发仓库守卫门 #333/#336/#364；§17 R13–R16）；
  诊断、绑定表与断言语义**维持不变**。
- 结论：**`approve`（附 SA1 冻结条件，恢复轮复核后维持）**——能力缺口稳定可证；契约三件套已
  落盘且红灯精确落在「能力存在性 / 建立能力缺失」而非环境、fixture、超时或入口；负控 NC1 在
  HEAD 即绿；类型契约经假想实现**可满足性 + 负例敏感度**双重验证；唯一承重开放项
  **B-2 订阅回调绑定**必须由 SA1 冻结后方可进入实现（§12.1/§15-1）。

---

## 1. Task type and inputs

| 输入 | 用途 | 状态 |
|---|---|---|
| `wiki/raw/task_issue-387.md` | Host brief：What-to-build + AC1–AC10 + 演示场景 + Blocked by（None） | 在场 |
| `wiki/raw/task_issue-387_relevant_decisions.md` | SA8 决策摘录（固定位置） | **缺席**（本轮实查不存在） |
| `wiki/raw/task_issue-387_conflict_report.md` | SA8 前置/设计冲突报告（固定位置） | **缺席**（本轮实查不存在） |
| `artifacts/sa8-conflict-gate-issue-387*.md` | SA8 门禁产物 | **缺席**（`ls artifacts` 零命中） |
| `docs/adr/0030-change-subscription.md` | **规范权威**：§1 公共面 / §3 建立判定 / §4 通知流 / §5 判定纪律 / §6 分发 / §7 分层 | 在场（HEAD） |
| `CONTEXT.md` L65–67「变更订阅（change subscription）」词条 | 词表、边界与 `_Avoid_` 禁用措辞 | 在场（HEAD） |
| spec #385（REST 实读全文） | User Stories 1–25、Implementation/Testing Decisions、Out of Scope | 在场 |
| issue #387 comments / labels | 0 条评论；labels `[in-progress]` | 实读（REST） |
| `packages/namespace-registry/AGENTS.md`、`packages/namespace-runtime/AGENTS.md` | 公共面纪律（仅 `src/index.ts` 加公共 API）、包边界、验证门 | 在场 |
| issue #369 lease 窗口读三件套（fixture / red / surface） | **先例**（契约三件套形态、装配口径、断言纪律）；HEAD 全绿 33 用例 | 在场且绿 |
| #369 后 lease 15 键公共面 + 窗口读语义 | 负控冻结面（AC10「纯加法 / 零改动」） | 在场且可用 |

Issue 评论 **0 条**（`gh issue view 387 --json comments` → `[]`）→ 无 owner override / 无范围收缩，
需求源 = issue body AC1–AC10 + ADR 0030 + spec #385。

**SA8 产物缺席的处置**（skill：输入缺失时用任务简报、源码、日志与现有测试继续）：
本轮以任务简报 + ADR 0030 + spec #385 + CONTEXT 词条 + 源码事实 + 探针证据建立契约；
把本应由设计门裁定的空白（§12.1 绑定表 B-2/B-3/B-4/B-5）显式登记为 **SA1 冻结项**，
不阻塞诊断与契约建立，但阻塞实现前冻结（见 Verdict 条件）。

## 2. Owner comment mapping

- issue #387 评论数 = **0**（REST 实读；dispatch 原文明示无 owner 条款需并入）。
- 因此无 owner 条款需映射；需求源 = issue body「What to build」+ AC1–AC10 + ADR 0030 决策 1/3/4/5/6/7。
- 与既有票的边界（spec #385 Out of Scope，写进本契约非目标）：谓词（T2 #388）、复制来源与
  订阅终止（T3 #389）、溢出降级与父路径删除（T4 #390）、三方 agent 文档面（T5 #391）、
  数组载体订阅 `watchArray`（v2）、含值通知 / 序号 / 对账（v2）。

## 3. SA8 constraints（无 SA8 产物时的替代约束面）

| 约束（来源） | 本契约落点 | 证据 |
|---|---|---|
| §1 公共面 = lease 层 `watchMap`；`unsubscribe` 幂等、主动退订零通知；载体面 = 键容器（Y.Map + plain object，对齐 readMap） | §12.1 B-1/B-2；E1/E2/L1 | ADR L16–18 |
| §3 建立判定全部由 active schema 完成：无 active schema 整体不可用（含无谓词）；非键容器 → `WATCH_MAP_CARRIER_MISMATCH`（message 区分原因）；**数据缺席合法** | E1–E5；B-3/B-4 | ADR L34–39；issue AC1–AC3 |
| §4 通知三 kind；`data` 的 `changes` 为 `{path,key}` 定位符列表，`[...path,key]` 直接补拉；同事务同 key 合并；`origin: 'local' \| 'replication'` | N1–N4；B-6/B-7 | ADR L43–53；issue AC4/AC5 |
| §4 一事务一通知（批量信封 ADR 0026 `ops` 原子可见） | B1/B2/P2 | ADR L49/§6；issue AC5 |
| §6 挂点 = 写序列器事务提交后**异步分发**（槽之外）；回调 throw 静默隔离 | D1/D2/X1 | ADR L64–65；issue AC6/AC7 |
| §7 分层：runtime 订阅簿记/判定/异步分发与队列；registry lease 公共面 + 类型别名；读/复制面零改动 | §10 影响面；P1/NC1 | ADR L70–73；issue AC10 |
| #369 先例纪律：公共 API 仅经 `src/index.ts`；类型别名跟随（Equal 锁）；形状断言集中化 | P1/NC1；类型契约 | `packages/namespace-registry/AGENTS.md`；`lease.ts` L426–515 |
| spec #385 Testing Decisions：**唯一主接缝 = NamespaceLease 公共面**；三件套 = fixture schema + 行为 red + `*.test-d.ts` | §12.4 测试路径 | spec #385 |
| 无 SA8 决策摘录/冲突报告 | 绑定表 B-2/B-3/B-4/B-5 交 SA1 冻结（§15） | §1 输入表 |

## 4. Environment and baseline

| 项 | 值 |
|---|---|
| 环境 | Linux；node `v24.13.0`；pnpm `10.28.2`；vitest `3.2.7`；typescript `5.9.3`；`maxWorkers: 1` |
| 依赖 | 仓内 `node_modules` 就绪（零安装动作；探针/测试直跑） |
| 根 typecheck（基线） | `pnpm typecheck` → **exit 0**，14 个 tsconfig 全过（`artifacts/sa6-issue387-baseline-typecheck.log`） |
| #369 窗口读 lease 契约（基线） | `vitest run .../issue-369-window-read-lease-contract-red.test.ts --typecheck.enabled=false` → **33/33 绿**、exit 0（`artifacts/sa6-issue387-baseline-window-read.log`） |
| #369 lease surface 类型测试（基线） | `vitest run --typecheck .../issue-369-window-read-lease-surface.test-d.ts` → **2 tests passed / Type Errors: no errors**（`artifacts/sa6-issue387-baseline-surface.log`） |
| 恢复轮复核（round 3） | 上列根 typecheck / #369 契约 / runner 采集在本轮**重新实跑**：`pnpm typecheck` → exit 0；`npx tsc -p tsconfig.typecheck.json` → 6 error 全在类型契约文件、其余 test 文件零错误；#369 → 33/33 绿；`vitest list` 实命中两契约文件（§13/§17；日志 `artifacts/sa6-issue387-r3-*.log`） |
| 测试入口 | `vitest.config.ts` L15 runtime include `packages/*/test/**/*.test.ts`；L20 typecheck include `packages/*/test/**/*.test-d.ts`；`tsconfig.typecheck.json` include `packages/*/test/**/*.ts` |
| 本轮新增产物 | 契约三件套（§12.4）+ 本报告 + 诊断日志；**零生产实现改动**（§16） |
| 基线—红灯边界 | 基线在契约文件落盘**之前**采集；落盘后根 `pnpm test` 因本契约文件在 HEAD 必红（预期状态：实现后转绿）。round 1/2 的根全量运行被会话中断截断（日志缺 vitest 汇总段与 exit 行）；**round 3 首次完整跑通**并暴露「本契约 NC1 触发仓库守卫门（#333/#336/#364）」缺陷，已当场修复并复跑（§17 R13–R16） |

## 5. Positive reproduction（能力缺口；feature 的「正例」= 目标能力整体不存在）

**证据 1 — 运行时公共面（探针，真实 Registry 装配；`artifacts/sa6-issue387-probe-final.log`）**：

```text
lease.keys  ["bumpReplicationEpoch","enableReplication","getActiveSchema","getMetadata","getSchema",
             "getStatus","mutateData","namespaceId","openReplicationSession","owner","readArray",
             "readData","readMap","release","replaceSchema"]            // 恰 15 键，无 watchMap
lease.watchMap.type   "undefined"
lease.watchMap.invoke {"threw":true,"name":"TypeError","message":"lease.watchMap is not a function"}

runtime.keys ["bumpReplicationEpoch","close","enableReplication","getActiveSchema","getMetadata",
              "getSchema","getStatus","mutateData","namespaceId","owner","readArray","readData",
              "readMap","replaceSchema"]                                // 恰 14 键，无 watchMap
runtime.watchMap.type "undefined"
```

- schema 路径分类原语在产（建立判定可行性锚；`artifacts/sa6-issue387-probe.log`）：
  `tasks` = object、`tasks.t1` = ref、`meta` = object、`ghost` = object、`workRecords` = array、
  `title` = scalar、`nope` = `SCHEMA_PATH_NOT_FOUND`。
- 两包公共入口零 watch 名目：`grep -rn "watchMap\|WatchMap" packages/*/src/index.ts packages/*/src/types.ts` → **零命中**。

**证据 2 — 类型面（独立 tsc 探针；`artifacts/sa6-issue387-type-probe-final.log`）**：

```text
TS2724 ×3：'NamespaceLeaseWatchMapOptions' / 'NamespaceLeaseWatchMapResult'（registry）
           / 'NamespaceRuntimeWatchMapResult'（runtime）不存在（Did you mean ...ReadMap...）
TS2339 ×2：Property 'watchMap' does not exist on type 'NamespaceLease' / 'NamespaceRuntime'
exit 2（同文件内 readData / readMap / readArray 阳性对照零错误 → 装置敏感）
```

**证据 3 — 契约形红灯（本轮落盘文件，HEAD 首因）**：

```text
AssertionError: 能力缺口：lease.watchMap 应为 lease 公共方法（ADR 0030 §1；issue #387 AC1）
                ——HEAD 实际 undefined: expected 'undefined' to be 'function'
建立类用例首因：code="WATCH_MAP_MISSING" message="lease.watchMap is not a function（ADR 0030 §1 能力缺席）"
```

（命令与统计见 §13；红灯原因 = 方法缺席，非 fixture/环境/入口。）

**恢复轮（round 3）复核**：证据 1/2 重新实跑逐字同值——`artifacts/sa6-issue387-r3-probe-387.log`
（lease 恰 15 键、`lease.watchMap.type "undefined"`）、`-r3-probe-387b.log`（runtime 恰 14 键、
`runtime.watchMap.type "undefined"`）、`-r3-type-probe.log`（TS2724×3 + TS2339×2、exit 2）；
证据 3 由 `-r3-verify-red.log`（20 failed / 1 passed、exit 1）与 `-r3-verify-type-red.log`
（1 failed / 1 passed、Type Errors 1 failed、exit 1）复现，首因与 round 1 逐字同构。

## 6. Negative control（当前全绿；实现后必须保持全绿）

| # | 断言 | 证明什么 | 本轮实测 |
|---|---|---|---|
| NC1 | `readData(['tasks'])` 成功面恰四键 `{ok,value,schema,truncated}`、`schema` 为投影文本；`readMap(['tasks'],{n,orderBy})` 条目在产；`readMap(['workRecords'])` → `WINDOW_CARRIER_MISMATCH`；`getStatus().lease === 'active'` | 既有读面 / 窗口读冻结面零改动（AC10）；装置健康 | **绿**（契约测试 NC1 用例；round 3 复跑同值 `-r3-verify-red.log`） |
| NC2 | 探针负控段：readData 恒四键 / readMap 键面 / `WINDOW_CARRIER_MISMATCH` + `WINDOW_TARGET_ABSENT` 在产 / lease 15 键含 readArray+readMap | 红灯不在既有面；#369 交付面在产 | **PASS**（`NEGATIVE-CONTROLS PASS` → 随后 T1 目标断言 FAIL；round 1 `-red-probe-run3.log`，round 3 复跑 `-r3-red-probe.log`，exit 1） |
| NC3 | 基线 33/33（#369 lease 契约）+ 根 typecheck exit 0 | 纯加法前的全网健康锚；无预存在红 | 绿（§4；round 3 复跑：根 typecheck exit 0 `-r3-baseline-typecheck.log`、#369 33/33 `-r3-baseline-window-read.log`） |
| NC4 | fixture 前提矩阵（探针 E）：`readMap(['meta'])` ok、plain object 容器 `readMap(['tasks'])` ok、可选容器 delete 合法且删除后 `WINDOW_TARGET_ABSENT`、`ghost` 创建 + 追加条目写合法、同条目兄弟路径批量合法、嵌套字段写合法 | 红灯不来自 fixture 构造错误 | 绿（round 1 `-probe-e.log`；**round 3 针对最终 fixture 字节重跑 4/4 绿** `-r3-premise-probe.log`——round 1 探针早于 fixture 定稿，已由本轮覆盖） |
| NC5 | 类型契约**可满足性 + 负例敏感度**（假想实现，B-2 绑定）：16 条 `AssertTrue` 全过；4 条 `@ts-expect-error` 各自命中、无 unused directive | 类型断言不互斥、实现后不假红；负例不是「因缺成员而假绿」 | **exit 0**（`packages/namespace-registry/.sa6-387/type-probe/mock-contract.ts`，临时；round 3 复编译 exit 0 `-r3-mock-contract.log`，收尾删除） |
| NC6 | 写失败零通知对照：无效写（schema 拒绝）零事务/零 update（探针证据），契约 P2 以「无效写 + 后续合法写」屏障断言 | 一事务一通知的反面（零事务零通知） | 实现后判据；当前 P2 红于能力缺席 |

## 7. Stability, scale and timing

- **确定性复现**：行为红灯 3 轮同构（run2 = final 的 20 个失败用例身份**逐字一致**，仅 E4 标题因
  加固改名；`diff` 仅 1 行标题差异）；探针输出与类型探针多次重跑逐字相同。纯同步/微任务级进程内
  行为，零时钟、零网络、零外部服务。
- **无竞猜等待**：异步分发等待一律 = `expect.poll`（5ms 间隔 / 2s 上限，重入场景 5s）+ **屏障**
  （同路径第二订阅的通知、或后续事务的通知）；「零通知」断言不用 sleep，而用屏障证明该事务分发已完成。
- **规模/时序条件**：fixture 规模 = 2–3 条目/容器（tracer 最小输入）；无性能断言（避免 CI 抖动）。
- **反伪绿过程（实测）**：run3 曾暴露 E4（无 active schema）在 HEAD **假绿**——因为「方法缺席」
  也表现为 `ok:false`；修法 = E4 内加「schema-ready 同场阳性对照」，缺席即红、实现后对照与拒绝
  两侧同时承重（§13）。最终 run 中 HEAD 唯一绿用例 = NC1（既有读面负控）。
- **恢复轮复跑稳定性（round 3，`-r3-*.log`）**：同一 HEAD、同一契约字节下重跑——行为红灯
  20 failed / 1 passed、类型红灯 1 failed / 1 passed，失败用例身份与首因（`WATCH_MAP_MISSING` /
  `expected 'undefined' to be 'function'`）与 round 1/2 **逐字同构**；探针与类型探针输出同值。

## 8. Capability gap chain（feature：能力缺口链）

| Step | 事实 | 证据 | 置信度 |
|---|---|---|---|
| 症状 | 消费方只有拉模式：`readData` / 窗口读无任何变更信号面；agent 全量重拉或持过时数据、UI 只能轮询 | ADR 0030 背景节；CONTEXT 词条为设计基线无实现 | 高（决策 + 实测） |
| 直接缺口 | `NamespaceLease`（15 键）与 `NamespaceRuntime`（14 键）均无 `watchMap`；`typeof === 'undefined'`；调用 → `TypeError` | §5 证据 1 | 高（实测） |
| 实现层缺口 | 无订阅簿记 / 谓词求值 / 异步分发 / 有界队列；两包公共入口零 watch 名目；类型面 TS2724×3 + TS2339×2 | §5 证据 1/2 | 高（实测） |
| 触发条件 | 需要「语义定位的实时变更信号」而三条既有变更流各有其主（raw bytes / 离线日志 / lifecycle observer） | ADR 0030 背景节；spec #385 Problem Statement | 高（决策） |
| 最深根因（本票） | T1 tracer 垂直通路从未交付：lease 公共面（ADR §1/§7 第三层）与 runtime 分发层（§7 第二层）均不存在；#369 交付的窗口读只是读面，无信号面 | ADR §1/§7；issue #387 What-to-build | 高 |
| 放大因素 | 无信号面时，桥接层无法做失效地图合并，消费方要么全量重拉（预算/窗口读的选择器价值被抵消）要么直依 Yjs 观察（失去 lease 生命周期与 released 通道） | ADR 决策 6/§6；CONTEXT「窗口读」分工句 | 高 |
| 未证实假设/待冻结 | **B-2 订阅回调绑定**（ADR/CONTEXT/spec/issue 的 `watchMap(path, { where? })` 简写均省略回调位，而 ADR §6/spec US20 明示存在「订阅回调」）；B-3 拒绝面；B-4 无 schema 码；B-5 别名名 | §12.1；§15-1..4 | 高（文本缺口实测确认） |
| 已排除项 | 能力已存在但命名不同 / 红灯来自环境或 fixture / 依赖未满足 —— 见 §11 | §11 | 高 |

## 9. Causal experiments（控制变量 / 反证）

1. **同装配控制变量**：同一次 registry 装配中 15 个 lease 键、14 个 runtime 键全部在位（含
   `readData`/`readArray`/`readMap`），仅 `watchMap` 为 `undefined`；类型面亦仅 watch 名目报错。
   差异只可能来自订阅能力缺失，排除安装/条件导出（`nomicore-source` 条件生效）。
2. **Yjs 事务机制（一事务一通知 / 定位符可行性）**（`artifacts/sa6-issue387-probe.log`）：
   批量信封两键 set → **1 事务 / 1 update / 键级 delta `[t3,t4]`**；两次分开写 → 2 事务 2 update；
   同条目兄弟路径（t1.title + t1.priority）→ 1 事务、父容器只报外层 key `t1`；无效写 →
   零事务 / 零 update / 零 notifyDirty。⇒ 事务级原子通知与同 key 合并有机制基础。
3. **浅观察 vs 深观察判别**（`artifacts/sa6-issue387-probe-c.log`）：直改容器条目 → 父 YMapEvent
   `keys = [t3,t4]`（可还原定位符）；嵌套条目字段写 → 事件落在**嵌套 map**（`path:['t1']`），父容器
   无条目级 delta。⇒ 无谓词订阅的 N3（嵌套字段）必须由深观察（`observeDeep` 等价面）+ 首段路径
   还原 key 覆盖，本契约以 N3 作为该分野的行为哨兵。
4. **readMap oracle 对齐**（`artifacts/sa6-issue387-probe-e.log`）：封闭对象 `YMap`（`meta`）与
   plain object 容器（`tasks`）**均**被 `readMap` 接受 → ADR「对齐 readMap 定义」在契约内以
   `readMap` 为独立预言机（E2 先验 oracle 再断言 watchMap 建立）。
5. **缺席对偶**（同日志）：物化 `optionalTasks` → `delete` 合法 → `readMap` 响亮
   `WINDOW_TARGET_ABSENT`；订阅侧要求建立成功（E3）——「读对缺席报错、订阅宽容等待」的方向性对偶。
6. **类型契约可满足性 + 敏感度**（NC5）：以假想实现（B-2 绑定）满足 16 条结构断言；4 条负例
   各自命中。⇒ 契约在目标语义下**可满足**（实现后不假红）且负例**敏感**（非因缺成员假绿）。
7. **红灯归因**：20 个红用例首因全部 = `WATCH_MAP_MISSING`（能力存在性/建立能力），无一红于
   fixture 构造、超时、入口或环境；唯一绿用例 NC1 = 既有读面负控。

## 10. Impact surface

| 面 | 预计改动 | 约束 |
|---|---|---|
| `packages/namespace-runtime/src/{runtime,index}.ts` | 订阅簿记、无谓词通知判定、事务提交后异步分发、有界队列、schema 变更/doc 替换终止编排；runtime 公共面新增分发入口（或 internal seam） | 读路径零改动；分发不进 sequencer 槽；回调 throw 隔离 |
| `packages/namespace-registry/src/{types,lease,index}.ts` | `NamespaceLease` +`watchMap`（15 → 16 键）；类型别名（B-5）；`index.ts` type-only 追加 | 「原样透传 + released 短路」先例；公共 API 仅经 `src/index.ts` |
| 既有守卫测试（实现期同步更新） | lease 键集守卫（`registry-open.test.ts` 等 15 → 16）；runtime 键集守卫（若 runtime 公共面增长）；`registry-data-interface.test-d.ts` 类类型面 | 既有键全数保留；值导出面不变 |
| 冻结面（零改动） | `readData` / 窗口读（`readArray`/`readMap`）/ 复制面（`subscribeOwnedUpdates`、`ReplicationSession`）/ 诊断日志 / wire / 持久化 | §12.6 红线；NC1 |
| 测试面 | 新契约三件套（§12.4）；全域套件在实现前因本契约文件呈红（预期） | 不得 skip/only/todo、不得 env override |
| 文档面（T5 #391 正位） | CONTEXT 词条已在（HEAD）；skill/集成指南属 T5 | 本票零文档改动 |

## 11. Ruled-out hypotheses

| 假设 | 结论 | 反证 |
|---|---|---|
| 1. watchMap 已存在，只是命名/绑定不同 | **排除** | lease/runtime `typeof === 'undefined'`；调用 `TypeError`；两包 `index.ts/types.ts` 零 watch 名目；tsc TS2724×3 + TS2339×2 |
| 2. 红灯来自环境/安装/测试入口 | **排除** | 基线根 typecheck exit 0、#369 契约 33/33 绿；探针负控段 PASS 后目标段才 FAIL；同一 fixture 读面全绿 |
| 3. 红灯来自 fixture 构造错误 | **排除** | 探针 E 逐条验证 fixture 前提（meta/plain 容器可读、可选删除合法、ghost 创建+追加写合法、批量兄弟路径合法、嵌套字段写合法） |
| 4. 契约红在「断言写错」而非能力缺失 | **排除** | 类型契约经假想实现满足性验证（NC5）；行为断言仅依赖 ADR 冻结形状（三 kind、`{path,key}`、`{unsubscribe}`、`WATCH_MAP_CARRIER_MISMATCH`） |
| 5. 「回调绑定」在固定输入中已冻结 | **排除** | ADR §1/§4、CONTEXT 词条、spec #385、issue #387/#388 的签名简写均只写 `(path, { where? })`；而 ADR §6「回调 throw 静默隔离」与 spec US20「订阅回调的异常被静默隔离」证明回调存在 → 属**文本缺口**，登记为 B-2 交 SA1 冻结（非矛盾、非本报告臆造行为） |
| 6. 异步分发的不确定性使契约不可判 | **排除** | 全部等待经 `expect.poll` + 屏障；红灯 3 轮身份稳定；无 sleep 竞猜、无墙钟断言 |
| 7. 无 active schema 拒绝与「方法缺席」不可区分 | **排除（加固）** | run3 实测 E4 曾假绿；加固 = 同场 schema-ready 阳性对照（§7/§13） |
| 8. 契约可用源码字符串/正则断言替代行为验证 | **排除** | 全部断言锚定 lease 公共面运行时结果、通知流对象与类型系统；零 grep/源码文本断言 |

## 12. Acceptance contract and test paths

### 12.1 契约绑定表（SA1 冻结；语义断言不随绑定变化）

| # | 绑定 | 契约默认取值 | 依据 / 若 SA1 另择的处置 |
|---|---|---|---|
| B-1 | 方法名 / 参数序 / 返回 | `watchMap(path, listener, options?) → { unsubscribe }`；`path` 同 `readMap` 路径面；`unsubscribe` 幂等 | ADR §1（名与返回形态冻结）；**回调位置见 B-2** |
| B-2 | **【承重，SA1 必裁】订阅回调绑定** | **位置参数第二参**（`(path, listener, options?)`）；`listener: (notification) => void` 恰一参、返回 void | ADR §6「回调 throw 静默隔离」+ spec US20；先例 `subscribeOwnedUpdates(listener)`。若改 `(path, { where?, onNotification })` 等：改 **fixture `watchMapOf`/`establishWatch` 单点** + 类型契约「绑定块」+ 本表 |
| B-3 | 建立失败的面 | **面中性**断言：同步 throw 携带 string `code`（默认，镜像 `NamespaceLeaseReleasedError` 先例）**或** 失败信封 `{ok:false, code}`；承重断言 = 响亮 + 稳定 code + message | ADR §3「响亮拒绝」未冻结面；`attemptEstablishWatch` 归一（§12.5） |
| B-4 | 无 active schema 的稳定码 | **未命名**（ADR/issue 只逐字冻结 `WATCH_MAP_CARRIER_MISMATCH`）；契约断「非空稳定 code + 非空 message + 禁止静默建立」 | ADR §3 第一条；SA1 冻结码字后升级为逐字断言 |
| B-5 | 类型别名命名 | **未预设**：类型契约只用成员名 `watchMap` 做结构推导（`Parameters`/`ReturnType`/`Extract`）；SA1 冻结 `NamespaceLeaseWatchMap*` 名后追加 Equal 锁（AC10 的别名导出面） | ADR §7；#369 `_readMapAlias` 先例 |
| B-6 | 通知形状 | `data` 恰三键 `{kind:'data', origin, changes}`；`changes` 为定位符数组；**不含值** | ADR §4；issue AC4；N1 以 payload 哨兵断言 |
| B-7 | 定位符形状与语义 | 恰两键 `{path, key}`；`path` = 订阅容器路径；`[...path, key]` 直接可读；同事务同 key 合并 | ADR §4/§5；N2/N3/B1；issue AC4/AC5 |

**非目标（不得越界）**：谓词 `where` 词表与 `WATCH_MAP_OPTIONS_INVALID`（T2 #388）；`origin:'replication'`
与 `watch-end`（T3 #389）；`invalidate-all` / 队列溢出 / 父路径删除编排（T4 #390）；文档面（T5 #391）；
数组载体订阅、含值通知、序号/对账（ADR v2 开放问题）。

### 12.2 Issue AC ↔ 可执行用例映射

| Issue AC | 用例 | 关键可观察断言 |
|---|---|---|
| AC1 建立成功 + 返回 `{unsubscribe}`；数据缺席合法 | T1/E1/E2/E3/N4 | `typeof lease.watchMap === 'function'`；恰 `{unsubscribe}`；Y.Map/封闭对象/plain 容器建立成功；未物化 + 已删除容器建立成功；横跨创建后条目写到达定位符 |
| AC2 无 active schema 整体拒绝 | E4 | 同场 schema-ready 对照建立成功；legacy（`getActiveSchema() === null`）响亮拒绝（稳定 code + message） |
| AC3 非键容器 → `WATCH_MAP_CARRIER_MISMATCH`；建立时刻校验完；通知流零参数错误 | E5/E6 | 数组/标量/偏离 schema 三例逐字码；message 区分原因（数组 vs 偏离）；通知 kind ∈ 三 kind 闭集 |
| AC4 本地写定位信号；`changes` 与窗口读条目同构 | N1–N4 | 恰三键 + 定位符恰两键；`origin === 'local'`；`[...path,key]` → `readData` 值与写入 `toStrictEqual`；窗口读条目同 key 同值；通知 JSON 不含 payload 哨兵 |
| AC5 一事务一通知；同 key 合并 | N1/B1/B2/P2 | 批量两键恰 1 条通知 2 定位符；同条目兄弟路径恰 1 定位符；两事务恰 2 条且 FIFO；无效写零通知 |
| AC6 写序列器槽之外异步分发、不阻塞后续写 | D1/D2 | `mutateData` 同步段零回调；后续写即时成功；回调内重入写被接纳并完成（槽内实现会死锁/拒绝） |
| AC7 回调 throw 静默隔离 | X1 | 坏消费者被调用但写结果 ok；其它订阅照常收到；后续写仍 ok 且通知继续 |
| AC8 退订幂等零通知；lease 释放清理 | L1/L2 | 重复 `unsubscribe()` 零 throw；退订后两屏障断言零通知；双 lease 场景释放后同 namespace 写不达旧订阅 |
| AC9 契约测试三件套 | §12.4 | fixture + 行为 red + `*.test-d.ts`（runner 实采集，§14） |
| AC10 registry 公共面纯加法 | P1/NC1 | lease 恰 15 + `watchMap` = 16 键、既有键全保留；readData/窗口读/复制面行为零改动 |

### 12.3 最小输入与期望（旧实现 vs 目标实现）

**最小 fixture**（`issue-387-watch-map-fixture.ts`，VFSL）：

```vfsl
type Task = YMap<{ /** 任务标题 */ title: YLeaf<string>; /** 优先级 */ priority: YLeaf<number>; }>;
type ROOT = YMap<{
  /** 任务表（Record 键空间，Y.Map 载体） */ tasks: Record<string, Task>;          // t1(alpha,2) t2(beta,9)
  /** 声明但未物化（数据缺席合法） */         ghost?: Record<string, Task>;         // 缺席
  /** 可选容器（可删除：订阅横跨缺席期） */   optionalTasks?: Record<string, Task>; // 缺席/物化后删除
  /** 数组载体（非键容器） */                 workRecords: YLeaf<number>[];         // [30,10,20]
  /** 根标量（非容器） */                     title: YLeaf<string>;                 // 'root-title'
  /** 封闭对象 map */                         meta: YMap<{ content: YLeaf<string>; extra: YLeaf<number>; }>;
}>;
```

**最小调用**：`open lease` → `lease.watchMap(['tasks'], sink.listener)` →
`lease.mutateData({ ops: [set ['tasks','t3'], set ['tasks','t4']] })` → 恰一条
`{kind:'data', origin:'local', changes:[{path:['tasks'],key:'t3'},{path:['tasks'],key:'t4'}]}` →
`lease.readData([...change.path, change.key])` 补拉成功。

**旧实现（HEAD `6df1c61`）对照**：`typeof lease.watchMap === 'undefined'` → 目标断言
**红于能力存在性**（T1 断言失败；其余用例于 `establishWatch` 首因 `WATCH_MAP_MISSING`）；负控 NC1 绿。
任何以别名、runtime 直挂或内部函数冒充的实现，会在 T1（lease 面成员）/P1（16 键纯加法）/
类型契约（lease 类型面）/L2（lease 释放清理）处同样红。

### 12.4 测试路径（本轮**已**落盘）

| 路径 | 内容 | 采集 |
|---|---|---|
| `packages/namespace-registry/test/issue-387-watch-map-fixture.ts` | 共享 fixture：schema/文档构造、真实 Registry 装配（runtimeFactory 保留 runtime 引用）、通知 sink、建立面中性适配（B-2/B-3 单点） | 非测试文件（不被收集） |
| `packages/namespace-registry/test/issue-387-watch-map-tracer-red.test.ts` | 主契约：T1 + E1–E6 + N1–N4 + B1–B2 + D1–D2 + X1 + L1–L2 + P1/P2 + NC1（21 用例） | `packages/*/test/**/*.test.ts`（vitest.config.ts L15） |
| `packages/namespace-registry/test/issue-387-watch-map-lease-surface.test-d.ts` | 类型契约：成员存在 + 结构推导 16 条 AssertTrue + 正例窄化/回环 + 4 条负例 | `packages/*/test/**/*.test-d.ts`（L20） |

### 12.5 断言纪律与反伪绿防线

1. **精确形状**：通知恰三键、定位符恰两键、句柄恰 `{unsubscribe}`、lease 恰 16 键，全部
   `toStrictEqual`；失败 code 逐字字符串相等；零 `expect.anything()`、零吞错、零 skip/only/todo、零 env override。
2. **信号不含值**：写入 payload 带哨兵串，断言 `JSON.stringify(通知)` 不含哨兵（行为级「不含值」验证）。
3. **异步确定性**：`expect.poll` + 屏障（第二订阅/后续事务）表达「最终送达」与「零通知」；
   禁止 sleep 竞猜。
4. **建立失败面中性归一**：`attemptEstablishWatch` 归一 throw / 失败信封（B-3），承重断言 = 响亮 +
   稳定 code；`WATCH_MAP_MISSING` 仅为本仓适配器的「能力缺席」占位码（实现后不可能出现）。
5. **oracle 不漂移**：键容器判定以同场 `readMap` 为独立预言机（E2）；定位符回环以 `readData` +
   窗口读条目为预言机（N2）。
6. **红灯归因可判**：建立类用例的红首因固定为 `WATCH_MAP_MISSING`；能力存在性用例固定为
   `expected 'undefined' to be 'function'` —— 首因可机械区分能力缺席与 fixture/环境错误。
7. **类型契约双验证**：假想实现满足性（NC5）+ 负例敏感度（`@ts-expect-error` 4 条无 unused）。
8. **仓库守卫门合规（round 3 修复项）**：`readData` 成功形状断言必须经集中化 helper
   `expectReadDataOkKeys`（issue #333 T0 / #336 T3 / #364 验收门；
   `packages/namespace-runtime/test/helpers/readdata-ok-shape.ts`，先例 = #369 契约同款导入），
   **禁止内联四键/退役五键字面量**。round 3 首次完整根跑曾因此门红（清单逐字指向本文件 NC1），
   已改为 helper 调用并复跑门转绿（§17 R14/R15）。

### 12.6 实现期红线（交 SA1/SA3/SA7 复核，非本契约执行）

1. `readData` / 窗口读（`readArray`/`readMap`）/ 复制面 / 诊断日志 / wire / 持久化零改动（NC1 承重）。
2. 公共 API 仅经各包 `src/index.ts`；值导出面不变（registry 增 `watchMap` 方法 + type-only 别名）。
3. lease 既有 15 键全数保留（16 键面），同步更新既有键集守卫测试。
4. 分发在写序列器槽之外；回调 throw 隔离；通知不含值（不得夹带值/投影文本）。
5. 不得为过契约修改本报告 §12.1 绑定；若 SA1 冻结不同绑定（B-2/B-3/B-4/B-5），只改
   fixture 单点 + 类型契约绑定块并回写本表。

## 13. Red/green evidence

| 运行 | 命令 | 结果 |
|---|---|---|
| 能力/ oracle 探针（round 1/3） | `NODE_OPTIONS=--conditions=nomicore-source npx tsx packages/namespace-registry/.sa6-387/probe-387.ts`（临时；round 3 复跑后收尾删除，§16） | lease 恰 15 键、无 watchMap、调用 `TypeError`；schema 路径分类在产；批量 1 事务 / 分开写 2 事务 / 无效写零事务（round 1 `-probe-final.log`；round 3 `-r3-probe-387.log` 同值） |
| runtime 面探针（round 1/3） | 同 tsx（probe-387b.ts，临时） | runtime 恰 14 键、`watchMap` undefined；别名/ref 路径分类在产（`-probe-b-final.log`；round 3 `-r3-probe-387b.log` 同值） |
| Yjs 机制探针 | probe-387c/d.ts（临时） | 浅/深事件分野；双 lease + 释放后写路径；legacy/invalid schema 的 active schema 为 null（`-probe-c.log` / `-probe-d.log`） |
| fixture 前提探针（round 1/3） | 临时 vitest 探针（round 1 用后即删；round 3 以最终 fixture 字节重建运行后即删） | meta/plain 容器 readMap 绿、可选删除合法、ghost 创建 + 追加写合法、批量兄弟路径合法、嵌套字段写合法（`-probe-e.log`；**round 3 4/4 绿** `-r3-premise-probe.log`） |
| 契约形红灯探针（round 1/3） | `npx tsx .sa6-387/probe-387-red.ts`（临时） | 负控段 `NEGATIVE-CONTROLS PASS` → T1 断言 **FAIL**（`typeof 'undefined'`）、exit 1（round 1 `-red-probe-run1..3.log`；round 3 `-r3-red-probe.log`） |
| 类型面缺口探针（round 1/3） | `npx tsc --noEmit -p .sa6-387/type-probe/tsconfig.json`（临时） | TS2724×3 + TS2339×2、exit 2；同文件 readData/readMap/readArray 零错误（`-type-probe-final.log`；round 3 `-r3-type-probe.log` 同值） |
| 行为红灯契约（主，round 1/2/3） | `vitest run .../issue-387-watch-map-tracer-red.test.ts --typecheck.enabled=false` | **20 failed / 1 passed**（21 用例）；唯一绿 = NC1（既有读面）；20 个红首因 = `WATCH_MAP_MISSING` / 能力存在性断言；exit 1（`-red-final.log`、`-i2-verify-red.log`、`-r3-verify-red.log` 逐字同构；§7） |
| 类型红灯契约（round 1/2/3） | `vitest run --typecheck .../issue-387-watch-map-lease-surface.test-d.ts` | **Type Errors**（TS2339×2 + TS7006 + TS2344×3，全部同源能力缺席）、1 failed / 1 passed、exit 1（`-type-red.log`、`-i2-verify-type-red.log`、`-r3-verify-type-red.log`） |
| 测试树全量类型检查（round 1/3） | `npx tsc -p tsconfig.typecheck.json --noEmit` | 6 error 全在类型契约文件；**其余 test 文件零错误**（fixture/行为契约类型干净）（`-test-tsc-final.log`；round 3 `-r3-test-tsc.log` 同值） |
| 类型契约可满足性（NC5，round 1/3） | `npx tsc --noEmit --strict ... .sa6-387/type-probe/mock-contract.ts`（临时） | **exit 0**：16 断言满足 + 4 负例命中（round 3 `-r3-mock-contract.log` 同值） |
| 基线（#369 契约，round 1/2/3） | `vitest run .../issue-369-window-read-lease-contract-red.test.ts --typecheck.enabled=false` | 33/33 绿、exit 0（`-baseline-window-read.log`、`-i2-baseline-window-read.log`、`-r3-baseline-window-read.log`） |
| 基线（根 typecheck，round 1/3） | `pnpm typecheck` | exit 0（`-baseline-typecheck.log`；round 3 `-r3-baseline-typecheck.log`） |
| 根全量（round 1/2/3） | `pnpm test` | round 1/2 均被会话中断截断（日志无 vitest 汇总段与 exit 行）——这正是本轮恢复重跑的原因；**round 3 首次完整跑通**：`Test Files 3 failed / 391 passed (394)`、`Tests 22 failed / 4731 passed (4753)`、exit 1（`-r3-root-test.log`） |
| 仓库守卫门（修复前，同上根跑内） | `vitest run .../readdata-shape-assertion-consolidation-gate.test.ts`（#333/#336/#364） | 1 failed：family B 清单逐字指向**本契约** NC1 的四键字面量（`-r3-root-test.log` 第 1052–1080 行）——round 1/2 被截断的根跑未曾暴露此缺陷 |
| 仓库守卫门（修复后） | 同命令（NC1 改用 `expectReadDataOkKeys`） | **24/24 绿、exit 0**（`-r3-gate-after-fix.log`） |
| 根全量（修复后终跑） | `pnpm test` | **2 failed / 392 passed (394)**、**21 failed / 4732 passed (4753)**、exit 1；红面恰为本契约两文件，其余零红（`-r3-root-test-final.log`，§17-R16） |

**旧实现失败点（目标契约首红位）**：能力存在性（`typeof lease.watchMap === 'function'`）与建立能力
（`WATCH_MAP_MISSING`）——所有 AC1–AC8/AC10 目标断言在旧实现下**均不可达**，符合「红在能力缺失而非
环境/fixture/超时/入口」。

## 14. Runner trigger evidence

- **include 正则**（实读 `vitest.config.ts`）：L15 runtime `packages/*/test/**/*.test.ts`；
  L20 typecheck `packages/*/test/**/*.test-d.ts`；`tsconfig.typecheck.json` include `packages/*/test/**/*.ts`。
- **采集实证**：`NODE_OPTIONS=--conditions=nomicore-source npx vitest list packages/namespace-registry --filesOnly`
  → 非空清单含：
  - `packages/namespace-registry/test/issue-387-watch-map-tracer-red.test.ts`（第 5 行）
  - `packages/namespace-registry/test/issue-387-watch-map-lease-surface.test-d.ts`（第 45 行）
  （`artifacts/sa6-issue387-runner-list-final.log`；registry 包共 52 个文件被采集）。
  **round 3 复跑**（`-r3-runner-list.log`，exit 0）：同为第 5 行与第 45 行、逐字同构——采集性未受恢复轮影响。
- **零 skip/only/todo、零 env override**：契约文件无 skip/only/todo；唯一环境量是仓内既有
  `NODE_OPTIONS=--conditions=nomicore-source`（#369 契约同款，非本契约引入）。

## 15. Unknowns and blockers

1. **【承重，SA1 必裁】B-2 订阅回调绑定**：ADR §1/§4、CONTEXT、spec #385、issue #387/#388 的
   `watchMap(path, { where? })` 简写均未写回调位，而 ADR §6 + spec US20 明示「订阅回调」存在 →
   默认冻结为 `watchMap(path, listener, options?)`（先例 `subscribeOwnedUpdates(listener)`）。
   实现前必须冻结；变更只需改 fixture `watchMapOf/establishWatch` 单点 + 类型契约绑定块（§12.1/§12.6-5）。
2. **B-3 建立失败的「面」**（同步 throw vs 失败信封）未由 ADR 冻结；契约以面中性归一保持可执行，
   SA1 冻结后可将归一收窄为单一面（不改变语义断言）。
3. **B-4 无 active schema 的稳定码字**未命名；契约断「响亮 + 非空稳定 code + message」。
4. **B-5 类型别名命名**未冻结；类型契约只做结构推导；SA1 冻结后追加别名 Equal 锁
   （AC10 的「type 别名」导出面）。
5. **runtime 层公共面形态**（公共 `watchMap` vs internal seam）不作契约断言：垂直通路由 lease 面
   通知行为证明（lease 无存储，必须经 runtime 分发）；若 runtime 公共面增长，实现期同步更新其键集守卫。
6. **E2 的封闭对象 Y.Map（meta）**：以 `readMap` 为 oracle 判定为键容器（ADR「对齐 readMap 定义」）；
   若 SA1 将键容器收窄为 Record 形态，删除该子断言并回写本表。
7. **N4 创建事件本身的信号 kind 不钉**（data / invalidate-all 属 T3/T4 编排）；承重断言 =
   缺席期订阅在容器出现后仍交付条目定位符（ADR §4「重建后条目照常到达」）。
8. **P1 恰 16 键**：若 SA1 除 `watchMap` 外再增公共键，需同步该断言与既有守卫（纯加法语义不变）。

**无阻塞项**：能力缺口稳定可复现（探针 3 轮 + 契约 3 轮同构），红灯精确落在能力存在性，
负控 NC1 绿且基线健康，契约可执行、入口真实、绑定面明确 → 可在 SA1 冻结 §12.1（尤其 B-2）后进入实现。

## 16. Temporary diagnostics cleanup

- **零生产实现改动**：`git status --short` 仅显示未跟踪的契约三件套、诊断日志、Host 既有输入
  （`wiki/raw/task_issue-387.md`）与本报告；`git diff` 对 HEAD **零改动**（`packages/**/src/**`、
  `docs/**`、`vitest.config.ts`、`package.json` 全部原样；契约测试/fixture 均为新增未跟踪文件）。
- **临时诊断清理（round 3 实际执行）**：`packages/namespace-registry/.sa6-387/` 整目录删除
  （probe-387{,b,c,d}.ts、probe-387-red.ts、type-probe/probe.ts、type-probe/mock-contract.ts 及
  tsconfig）——round 1/2 会话中断未执行该步，恢复轮先复跑取证、再删除；临时 vitest 前提探针
  `test/issue-387-premise-probe.test.ts`（round 3 新建）运行后即删（复核：`ls test/ | grep issue-387`
  → 仅契约三件套）。
- **保留证据（仅日志）**：`artifacts/sa6-issue387-*.log`（基线、探针、类型、红/绿、runner、根全量、
  仓库守卫门 before/after；含 round 3 `-r3-*` 全套）。
- **零服务/后台残留**：全部为同步脚本或有限时长 vitest 运行；无 nohup/setsid/PID 文件/轮询 marker；
  收尾时后台 job 全部结算。
- 收尾核对：本报告写入固定路径 `wiki/raw/task_issue-387_sa6_contract.md`；删除后 `git status` 复核
  仅剩契约三件套 + 报告 + 日志（+ Host 输入）。

---

## 17. Recovery re-establishment（round 3，2026-09-14 20:14–20:38）

**触发**：上一会话在根 `pnpm test` 全量运行中被中断（`-i2-root-test.log` 无 vitest 汇总段与 exit 行），
未提交 child-scoped structured result，且 §16 声明的临时探针清理未执行。本轮目的 = 在**不改变诊断、
契约与绑定表**的前提下重新取证，确认 verdict 是否仍成立。

**不变量（本轮实查）**：HEAD `6df1c61…` 未变；`git status` 零 tracked 修改（生产实现零改动）；
issue #387 评论仍为 0（无 owner override）；ADR 0030（HEAD）§1/§3/§4/§6 文本与报告 §3 映射逐条一致。

| # | 复核项 | 命令（凡引用 `.sa6-387/` 临时探针者，收尾均已删除，§16） | 结果 | 日志 |
|---|---|---|---|---|
| R1 | 能力存在性（lease 面） | `npx tsx packages/namespace-registry/.sa6-387/probe-387.ts` | lease 恰 15 键、无 `watchMap`、`typeof 'undefined'`、exit 0 | `artifacts/sa6-issue387-r3-probe-387.log` |
| R2 | 能力存在性（runtime 面） | 同 tsx（probe-387b.ts） | runtime 恰 14 键、无 `watchMap`、exit 0 | `-r3-probe-387b.log` |
| R3 | 类型面缺口 | `npx tsc --noEmit -p .sa6-387/type-probe/tsconfig.json` | TS2724×3 + TS2339×2、exit 2 | `-r3-type-probe.log` |
| R4 | 行为红灯契约 | `vitest run ...issue-387-watch-map-tracer-red.test.ts --typecheck.enabled=false` | **20 failed / 1 passed**、exit 1；唯一绿 = NC1 | `-r3-verify-red.log` |
| R5 | 类型红灯契约 | `vitest run --typecheck ...issue-387-watch-map-lease-surface.test-d.ts` | **1 failed / 1 passed**、Type Errors 1 failed、exit 1 | `-r3-verify-type-red.log` |
| R6 | 契约形红灯探针 | `npx tsx .sa6-387/probe-387-red.ts` | 负控段 `NEGATIVE-CONTROLS PASS` → T1 FAIL、exit 1 | `-r3-red-probe.log` |
| R7 | fixture 前提（最终字节） | 临时 vitest 探针 4 用例 | **4/4 绿**（Y.Map/封闭 map/plain 容器 readMap、ghost 缺席→创建→追加、可选删除对偶、双 lease） | `-r3-premise-probe.log` |
| R8 | 负控基线（#369 契约） | `vitest run ...issue-369-window-read-lease-contract-red.test.ts --typecheck.enabled=false` | **33/33 绿**、exit 0 | `-r3-baseline-window-read.log` |
| R9 | 根 typecheck | `pnpm typecheck` | **exit 0**（14 个 tsconfig 全过、零 TS error） | `-r3-baseline-typecheck.log` |
| R10 | 测试树类型检查 | `npx tsc -p tsconfig.typecheck.json --noEmit` | 6 error 全在类型契约文件、其余 test 文件零 error、exit 2 | `-r3-test-tsc.log` |
| R11 | 类型契约可满足性 | `npx tsc --noEmit --strict ... .sa6-387/type-probe/mock-contract.ts` | **exit 0**（16 断言满足 + 4 负例 directive 无 unused） | `-r3-mock-contract.log` |
| R12 | runner 采集 | `vitest list packages/namespace-registry --filesOnly` | 两契约文件实命中（L5 / L45）、exit 0 | `-r3-runner-list.log` |
| R13 | 根全量（首次完整跑通） | `pnpm test` | `Test Files 3 failed / 391 passed (394)`、`Tests 22 failed / 4731 passed (4753)`、exit 1；3 个红文件 = 本契约两文件 + 守卫门（见 R14） | `-r3-root-test.log` |
| R14 | **缺陷发现**（只有完整根跑才暴露）：仓库守卫门因本契约 NC1 红（#333 T0 / #336 T3 / #364 readData 形状集中化门） | 根跑内 `readdata-shape-assertion-consolidation-gate.test.ts`（test：family B） | family B 清单逐字指向 `issue-387-watch-map-tracer-red.test.ts:585` 的四键字面量——契约文件此前内联形状断言、未走集中化 helper（#369 先例则已合规） | `-r3-root-test.log`（1052–1080 行） |
| R15 | **缺陷修复**：NC1 改用 `expectReadDataOkKeys`（`../../namespace-runtime/test/helpers/readdata-ok-shape.js`） | 门单跑 + 行为红契约复跑 | 门 **24/24 绿、exit 0**；行为红契约仍 **20 failed / 1 passed**（NC1 仍绿）、exit 1；test 树 tsc 6 error 仍全在类型契约文件 | `-r3-gate-after-fix.log`、`-r3-verify-red.log`、`-r3-test-tsc.log` |
| R16 | 根全量（修复后终跑） | `pnpm test` | **Test Files 2 failed / 392 passed (394)**、**Tests 21 failed / 4732 passed (4753)**、Type Errors 1 failed、exit 1——红面**恰为本契约两文件**（行为 20 failed + 类型 1 failed），其余 392 文件零红 | `-r3-root-test-final.log` |

**注（round 3 的非语义修正）**：行为契约文件头注释原写「runtime 15 键」，与实测（runtime 恰 14 键）
不符；本轮改为「runtime 恰 14 键」——**纯注释、断言与语义零改动**，R4 红证据即在修正后字节上重跑。
**注（round 3 的测试内修复）**：R14/R15 的 NC1 改动是**断言表达方式**的合规化（同一「恰四键」断言，
改经仓库统一 helper），断言面与语义不变；修复后行为红契约与守卫门双侧复跑留证。

**R13/R14 意义**：round 1/2 的根全量均被会话中断截断（恰好停在 apps/yjs-server 动态段），因此
「契约文件是否触发仓库既有守卫门」从未被验证——恢复轮的首次完整跑把它暴露为**契约集合的真实缺陷**
（实现后 watchMap 转绿而该门会持续红，属不可接受残留）。修复后契约集合与仓库守卫门兼容。

**R16 结果**：`Test Files 2 failed / 392 passed (394)`、`Tests 21 failed / 4732 passed (4753)`、
`Type Errors 1 failed`、exit 1——红面**恰为本契约两文件**（行为契约 20 failed / 1 passed（NC1 仍绿）
+ 类型契约 1 failed / 1 passed），其余 392 个文件、4732 个用例零红；仓库守卫门在内且绿。
⇒ 契约红精确落在「能力存在性 / 建立能力缺失」，无其他预存在红、无环境/fixture/入口伪红——
完全符合 feature 契约在旧实现下的预期状态。

**恢复结论**：R1–R12 全部复现 round 1/2 结论（同值 / 逐字同构）；R7 补齐了 round 1 前提探针早于
fixture 定稿的时间差；生产实现、契约文件语义与 §12.1 绑定表零改动 →
**原 `approve` verdict 与 SA1 冻结条件维持有效**（§15 未知项 1–8 不变）。

---

## Verdict

**approve（附 SA1 冻结条件）** —— issue #387 watchMap 无谓词 tracer 的能力缺口稳定可证
（lease 恰 15 键 / runtime 恰 14 键均无 watchMap；`typeof === 'undefined'` + 调用 `TypeError`；
类型面 TS2724×3 + TS2339×2；两包公共入口零 watch 名目）；契约三件套已落盘并由真实 runner 采集
（`vitest list` 实命中），行为红灯 20/21（唯一绿 = NC1 既有读面负控），类型红灯 6 处且全部同源于
能力缺席——红灯精确落在「能力存在性 / 建立能力缺失」而非环境、fixture、超时或入口；
类型契约经假想实现满足性（NC5）+ 负例敏感度双重验证；绑定表 §12.1 与 AC 映射 §12.2 可执行。

**实现前置条件**：SA1 必须冻结 **B-2 订阅回调绑定**（唯一承重开放项；默认
`watchMap(path, listener, options?)`），并顺带冻结 B-3（拒绝面）/B-4（无 schema 码字）/B-5（类型别名
命名）；冻结结果需与本报告 §12.1 对账后回写。若 SA1 判定 B-2 采用其它绑定，只需改测试侧单点
（fixture 适配器 + 类型契约绑定块），语义断言不变。

**恢复轮复核（round 3，§17）**：上述全部结论在 HEAD 不变、生产实现零改动的前提下经 R1–R16 重新
实跑确认——行为红灯 20 failed / 1 passed、类型红灯 1 failed / 1 passed 与 round 1/2 逐字同构；
#369 契约 33/33 绿、根 typecheck exit 0、runner 实命中、类型契约可满足性 exit 0、最终 fixture 前提
4/4 绿；根全量终跑 **2 failed / 392 passed（394）** 且红面恰为本契约两文件（R13 首次完整跑曾暴露
「NC1 内联四键字面量触发仓库守卫门 #333/#336/#364」缺陷，R15 已改用 `expectReadDataOkKeys`
并复跑门 24/24 绿）；临时探针已在收尾前实际清理（§16）。**原 verdict 维持 `approve`**，SA1 冻结条件不变。
