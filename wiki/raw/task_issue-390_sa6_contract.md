# SA6 诊断与验收契约 — issue #390 溢出降级与父路径删除（变更订阅 T4）

- 任务类型：**feature**（在 T1 #387 之上补齐通知面的背压降级与结构性失效；红灯 = 目标能力缺口，非回归）
- 诊断基线：分支 `mabf/issue-390`，HEAD `28faeae`（T1 #387 已合入；ADR 0030 已在库）
- 上游证据：`wiki/raw/task_issue-390.md`（简报）、`wiki/raw/task_issue-390_relevant_decisions.md`、
  `wiki/raw/task_issue-390_conflict_report.md`（SA8 前置门禁 **verdict = clear**、`requiresConflictRecheck = true`）
- 本轮范围（dispatch 明令）：**只做诊断与契约**——不实现、不落测试；契约测试路径与断言边界在 §12 冻结，
  由实现阶段落盘并复跑红灯/绿灯。红灯证据 = 与契约逐条同构的诊断探针（§13）。
- 结论速览：**verdict = approve**。能力缺口稳定可复现（父路径删除 / 祖先删除 / 容器整替 = 零通知；
  小容量注入位缺席），契约可执行（触发模式经 10 轮时序实测确定化），负控全绿，基线健康。

## 1. Task type and inputs

| 项 | 内容 |
|---|---|
| Issue | #390「溢出降级与父路径删除（变更订阅 T4）」（open；Parent PR #386；Blocked by #387 → CLOSED） |
| What to build | 在 T1 之上补齐：有界队列溢出 → 显式降级 `invalidate-all`；父路径删除发全失效且订阅存活横跨缺席期；溢出经既有 testing 工厂 overrides 注入小上限触发；降级分发仍在写序列器槽之外 |
| 规范权威 | `docs/adr/0030-change-subscription.md` 决策 3/4/6 + 验收缝（L38 缺席合法 / L50 `invalidate-all` 触发源 / L51 终结三因 / L66 有界队列与注入 / L94 testing 工厂注入小上限）；纪律面 = ADR 0008（sequencer 槽序）、ADR 0011（调用点槽外） |
| 决策集状态 | `docs/adr/` 全 28 篇「已接受」，无被 supersede 的在约束 ADR；无 override 载体 |
| 相关决策摘录 | `wiki/raw/task_issue-390_relevant_decisions.md`（A–F 段，本报告直接引用其行号锚） |
| 现有测试/fixture | `packages/namespace-registry/test/issue-387-watch-map-{fixture,tracer-red.test,lease-surface.test-d}.ts`（T1 契约，HEAD 21/21 绿） |
| 诊断产物 | `artifacts/sa6-issue390-probe-a.log`（registry lease 公共面）、`-probe-b.log`（watchHub 模块面）、`-probe-c.log`（注入位被忽略）、`-type-probe.log`（TS2353）、`-runner-list.log`、基线三份日志 |

## 2. Owner comment mapping

- REST `issues/390/comments` = **[]（0 条）**——承接 SA8 §2 复核结论，与本 dispatch 现场一致。
- 映射结果：**无 Owner 评论 → 无 owner-scoped 要求、无 override 载体**。契约全部由 issue AC（6 条）+
  ADR 0030 决策 3/4/6 + 验收缝 + SA8 §8 非阻塞约束导出，零外部口头约束。

## 3. SA8 constraints（前置门禁对本契约的强制面）

| # | SA8 约束（`task_issue-390_conflict_report.md`） | 契约落点 |
|---|---|---|
| 1 | 注入路径只经 `NamespaceRegistryTestingOverrides` **加法式**新字段 + internal 装配缝（`registry.ts` L799–802 缺省 `runtimeFactory` / `runtime.ts` L576 接线）；不得新开公共 API 或第二 testing seam | §12.1 B-1、A1；§12.6-2 |
| 2 | 失效信号形状恒 `{kind:'invalidate-all', origin}`；与在队/在途 data 的相对顺序须保 FIFO；容器删除→重建→`data` 恢复不得要求重建订阅；判定纪律维持宁多勿漏（C-3「无命中」改判为失效信号属**加强**，不得同时削弱既有真变过滤） | §12.1 B-3/B-5/B-7；A3/A3b/A4/A5/A6；NC1 |
| 3 | 槽外红线：溢出降级（清队 + 入队 + 泵调度）保持观察器内有界同步操作；零 sequencer 内 await；通知异常零外泄 | §12.1 B-1；A7；§12.6-4 |
| 4 | 三 kind 形状逐键未变；testing override 字段未泄漏进公共契约/主入口导出；默认容量仍为实现常量（**不得**套用 ADR 0010 L267 复制 fanout 冻结常量纪律）；父删/溢出两触发源均「订阅存活」；sequencer/槽序零触碰；复制面零改动；T2/T3 范围未顺带实现 | A8/A9；§12.6-1/3/5/6 |

## 4. Environment and baseline

- 环境：Node v24.13.0 / pnpm 10.28.2 / vitest 3.2.7 / typescript 5.9.3；`pnpm install --offline --frozen-lockfile`
  （store 复用，exit 0）；测试与探针统一 `NODE_OPTIONS=--conditions=nomicore-source`（仓内既有约定）。
- 基线（全部在本 worktree 现场复跑，日志在 `artifacts/`）：

| 基线 | 命令 | 结果 |
|---|---|---|
| T1 契约（#387） | `vitest run packages/namespace-registry/test/issue-387-watch-map-tracer-red.test.ts --typecheck.enabled=false` | **21/21 绿**、exit 0（`sa6-issue390-baseline-issue387-contract.log`） |
| 根 typecheck | `pnpm typecheck` | **EXIT=0**（`sa6-issue390-baseline-root-typecheck.log`） |
| 测试树 typecheck | `npx tsc -p tsconfig.typecheck.json --noEmit` | **EXIT=0**、零 error（`sa6-issue390-baseline-test-tsc.log`） |
| runner 采集 | `npx vitest list packages/namespace-registry --filesOnly` | 52 文件被采集；#387 契约在清单第 5 行、`*.test-d.ts` 在第 45 行（`sa6-issue390-runner-list.log`） |

- HEAD 事实（源码锚，§5/§8 引用）：`watch-map.ts` L98（默认容量实现常量）、L270 + L286–287（C-3 分支
  「父路径事件 → 无命中」）、L365–369（`createWatchHub(doc, state, queueCapacity = 默认)`）、L397–413（溢出清队 +
  单条 `invalidate-all`）、L318–341（单飞微任务泵，槽外）；`runtime.ts` **L576 `createWatchHub(doc, state)`（容量未接线）**、
  L753（lease 透传）；`testing.ts` L36–64（`NamespaceRegistryTestingOverrides` 无容量位）；
  `registry.ts` L799–802（缺省 `runtimeFactory = createNamespaceRuntimeForRegistry`）。

## 5. Positive reproduction（能力缺口：目标行为在 HEAD 的缺席）

**正例 = 目标能力的负向存在性**（feature 任务的「复现」）：同一最小场景在 HEAD 下**断言不可满足**。
全部经**真实 registry lease 公共面**（`createNamespaceRegistryForTesting` + 缺省 production runtimeFactory 通路）观测，
时间窗排空 80ms（微任务 + 宏任务边界）+ 后续写屏障；`artifacts/sa6-issue390-probe-a.log`。

| # | 最小输入（HEAD 实际） | 期望（契约目标） | 实际（HEAD） | 判定 |
|---|---|---|---|---|
| G-1 | 订阅 `['optionalTasks']`（已物化）→ `mutateData({op:'delete', path:['optionalTasks']})` = **合法写**（`ok:true`） | 恰一条 `{kind:'invalidate-all', origin:'local'}` | **零通知**（`notificationsAfterDelete: []`，`invalidateAllObserved:false`）；raw ROOT 事件在场：`path=[] key=optionalTasks action=delete` | **红（AC3）** |
| G-2 | 订阅 `['optionalGroups','og1']` → `delete ['optionalGroups']`（合法） | 恰一条 invalidate-all | **零通知**；raw 事件：`path=[] key=optionalGroups action=delete`（**祖先删除只产 ROOT 级单事件**，无深层事件） | **红（AC3）** |
| G-3 | 订阅 `['optionalTasks']` → `set ['optionalTasks'] = {z1:…}`（整替既有容器；读面证 `{r1:…}` → `{z1:…}` 内容替换） | 恰一条 invalidate-all（旧条目全部消失 = 漏不可接受） | **零通知**；raw 事件：`path=[] key=optionalTasks action=update` | **红（AC3 整替变体）** |
| G-4 | 单事务批量 `[delete ['optionalTasks'], set ['meta','content']]`（合法，`ok:true`） | 该订阅恰一条 invalidate-all（事务级原子） | **零通知**；raw 事件：ROOT 删 + meta 更新同事务 | **红（AC3 原子性）** |
| G-5 | `createNamespaceRegistryForTesting(p, { clock, scheduler, randomBytes, watchQueueCapacity: 1 })` + 2 次同步受理写 | 注入生效 → 溢出 → 恰一条 invalidate-all + 订阅存活 | 注入位**不存在**：类型面 TS2353；运行面字段被**静默忽略**（capacity 仍为默认常量）→ 两条 `data`、零 invalidate-all（`sa6-issue390-probe-c.log`） | **红（AC1/AC2/AC5）** |

**非红（基线绿，T4 不得打破）**：G-6 重建后条目写 → `data {path:['optionalTasks'],key:'r1'}`（S4/S8 绿）；
G-7 条目级删除 → `data key 'r2'`（S5 绿）；G-8 无关路径写 → 零通知（S6 绿）；G-9 必填字段整删 → 写面拒绝
（`ok:false`、零事务零通知，S2 绿）；G-10 lease 面 16 键（含 T1 `watchMap`）不变（S0/S13 绿）。

## 6. Negative control（当前全绿；实现后必须保持全绿）

| NC | 输入 | HEAD 实际 | 作用 |
|---|---|---|---|
| NC1 | 同 G-5 的两次 un-awaited 写，但**不注入**容量（默认实现常量） | 两条 `data`（x1、x2）、**零** invalidate-all（probe C C1） | 反伪绿：证明 A2 的失效断言对「注入位是否真的控制上界」敏感——实现若恒发失效信号，本负控必红 |
| NC2 | 条目级删除 `delete ['optionalTasks','r2']` | `data`（key `r2`，恰三键） | 防「父删编排」把条目级删除一并升级为失效（宁多勿漏不得退化为**噪声**/破坏既有真变过滤） |
| NC3 | 无关路径写 `set ['meta','content']` | 零通知 | 防过宽通知 |
| NC4 | 必填字段整删 `delete ['tasks']` | 写面领域校验拒绝（`ok:false`，`issues` 非空；`MutateDataResult` 无 `code` 字段）、零事务零通知 | 写面校验零改动；契约正例必须用**可选**容器 |
| NC5 | 非法批量 `[set ['optionalTasks','q2'], delete ['optionalTasks']]` | 写被拒（`ok:false`）、零通知 | 与 NC4 同族：契约不得把非法事务当触发源 |
| NC6 | 通知流 kind 闭集 + `invalidate-all` 恰两键 | 观测到的全部通知 kind ∈ {data, invalidate-all}，无 watch-end；`rawKeys = ['kind','origin']` | 三 kind 形状冻结（ADR §4 L44–53） |

## 7. Stability, scale and timing

1. **溢出触发确定性（承重）**：`sa6-issue390-probe-a.log` S10a——同一同步段两次 un-awaited `mutateData`
   （均 `ok:true`）**10/10 轮**两次事务提交都先于该订阅泵的首次投递（`minCommitsBeforeFirstDelivery = 2`），
   且同步段回调数恒 0。⇒ 注入 capacity=1 时，第二次入队必见 `queue.length >= 1` → **溢出触发零时序竞猜**。
2. **机制存在性/严格性**（`-probe-b.log`，模块面直驱 `createWatchHub`，仅诊断）：
   capacity=1 + 同同步段两事务 → 恰一条 `{kind:'invalidate-all',origin:'local'}`（恰两键）、零 data；
   排空后再写 → `data` 恢复（订阅存活）；capacity=2 → `[data(f1), invalidate-all]`（FIFO）；
   origin 两态保真（`local` / symbol → `replication`）；缺省容量 + 17 个同步事务 → 恰 1 条 invalidate-all、0 条 data（清队语义）。
3. **默认容量下溢出「可达但不可确定化」**（S10b）：20 次 un-awaited 写 → 20/20 写成功、投递 4 条
   （data 3 + invalidate-all 1）；60 次 → 60/60 写成功、投递 12 条（data 9 + invalidate-all 3）。
   ⇒ HEAD 的溢出通路**真实可达**，但「投递几条 data 后才失效」由微任务时序决定，**不能**作为验收触发；
   这正是 ADR L94「testing 工厂注入小上限」的验收理由（也是 AC5 的语义，不是测法偏好）。
4. **规模/等待纪律**：全部「零通知」断言以宏任务排空窗 + 后续写屏障（同订阅）表达；契约测试须用
   `expect.poll` + 同订阅后续事务屏障，禁止 sleep 竞猜与墙钟断言。
5. **无资源泄漏/挂起**：探针全部 exit 0（A/B/C 三支），无 unhandled rejection、无轮询链。

## 8. Capability gap chain（feature：能力缺口链）

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| 1 症状 | 订阅容器路径的**祖先**发生结构性删除/替换（容器被删/整替）时，该订阅收到**零通知**：消费方持有已消失条目的视图且永不被告知 | §5 G-1/G-2/G-3/G-4（探针 A）+ 探针 B E5a/E5b/E5f | 高（raw 事件在场 + 零投递，反复一致） |
| 2 直接故障点 | `collectChanges` 的 C-3 分支丢弃父路径事件：`isPathPrefix(containerPath, eventPath)` 对「事件路径短于订阅路径」恒 false（`watch-map.ts` L270 `continue`），L286–287 明文「父路径删除编排属 T4 #390——落入无命中」 | 源码 + 探针 B E5a/E5b（事件 `path=[]`、`action=delete` 与订阅路径 `['tasks']` / `['groups','g1']` 无交集） | 高 |
| 3 触发条件 | 任何事务在**订阅容器路径的严格祖先**上删除（`action:'delete'`）或整替（`action:'update'`，旧子树被删除）该键；Yjs 对整棵被删子树只产出**一个**祖先级事件（无深层事件） | 探针 A S3/S7/S9/S12 raw 事件；探针 B E5a/E5b/E5f | 高 |
| 4 能力缺口（注入） | 有界队列机制已在（T1，`watch-map.ts` L397–413），但**容量装配面缺席**：`createWatchHub` 第三参无人传（`runtime.ts` L576 两参），`NamespaceRegistryTestingOverrides` 无字段（TS2353），运行期字段被忽略 | 类型探针 TS2353（`-type-probe.log`）+ 探针 C（capacity 被忽略 → 无溢出） | 高 |
| 5 放大因素 | 无任何外部路径能改变容量 ⇒ ADR L94 指定的验收触发（testing 工厂注入小上限）不可执行；默认容量下的溢出投递序列不可确定 | §7-3；SA8 §8-1 | 高 |
| 6 未证实假设 | 无（本缺口不依赖任何未验证假设） | — | — |
| 7 已排除 | 环境/fixture/入口/时序/schema 校验/Yjs 不报事件（详见 §11） | 基线 §4 + 探针负控 | 高 |

**目标能力（契约要求）**：`invalidate-all` 的第三/第四触发源落地——父路径删除与容器整替 → 恰一条
`{kind:'invalidate-all', origin}`（订阅存活、FIFO、事务级原子）；容量经既有 testing 工厂 overrides 加法式注入并
真达 `createWatchHub`；降级信号与既有 data 通知同泵槽外分发。

## 9. Causal experiments（因果实验，控制变量/反证）

| # | 实验 | 结论 |
|---|---|---|
| X-1 | 模块面直驱 `createWatchHub(doc, state, 1)`：单事务→data；同同步段两事务→恰一条 invalidate-all；排空后再写→data | 溢出→降级→自愈机制**本身健全**；缺的是装配接线与父删编排（把「能力不存在」与「机制有缺陷」区分开） |
| X-2 | 同 X-1 但 origin 分别用 `undefined` 与 symbol | invalidate-all 的 origin 保真两态 → 契约可断 origin='local'（本地删），不引入第三态 |
| X-3 | capacity=2：先让 f1 投递，再三同步事务 | 序 = `[data(f1), invalidate-all]` → FIFO（已投递通知不被降级信号越过） |
| X-4 | 缺省容量 + 17 个同步事务 | 恰 1 条 invalidate-all、0 data → 有界队列在**实现默认**上同样成立（数值本身不进契约） |
| X-5 | registry 面两次 un-awaited 写 + 同段私有 ROOT `observeDeep` 记账 ×10 轮 | 两次提交恒先于首次投递（min=2）→ 把契约触发模式钉成确定事件序（§7-1） |
| X-6 | 经 testing overrides 传 `watchQueueCapacity:1`（运行 + 类型双探针），对照不传 | 运行：字段被忽略 → 两条 data；类型：TS2353；对照文件（`idleTimeoutMs`）零错误 → 红因是**注入位缺席** |
| X-7 | 父删的 raw 事件取证（容器删 / 祖先删 / 整替 / 同事务批量） | 事件均在**祖先**路径上（`path=[]` 或 `['groups']` 级），action ∈ {delete, update}；无深层事件 ⇒ 实现必须在祖先事件上按路径前缀推导结构性失效 |
| 反证 | 若「父删已实现」：raw 事件在场却零投递、且 C-3 注释明文留 T4 —— 排除 | — |

## 10. Impact surface

- **实现面（设计决定具体形态；本契约只约束可观察行为与注入面）**：
  `packages/namespace-runtime/src/watch-map.ts`（祖先路径结构性事件 → 失效编排；复用 L397–413 入队与泵）；
  `packages/namespace-runtime/src/runtime.ts` L576（容量接线）；
  `packages/namespace-registry/src/testing.ts`（overrides 加法式字段）+ internal 装配缝（`registry.ts` L799–802 缺省工厂）。
- **必须保持绿的既有守卫**：`packages/namespace-registry/test/registry-open.test.ts`（lease 16 键集）、
  `issue-387-watch-map-{tracer-red.test,lease-surface.test-d}.ts`（21 用例 + 类型面）、`issue-369-*`（窗口读契约）、
  各包公共面审计与 import 图守卫、根 `pnpm typecheck` / 测试树 `tsc -p tsconfig.typecheck.json`。
- **零涉面（T4 红线）**：复制面（ReplicationSession / instance-replication-v1 / needs-resync）、`readData` /
  窗口读、诊断日志、sequencer 槽序、谓词与 `WATCH_MAP_*` 错误码族、文档词条（T5 #391）。

## 11. Ruled-out hypotheses

| 假设 | 结论 | 反证 |
|---|---|---|
| H1 父删已实现，只是没等够 | **排除** | 80ms 排空窗 + 同订阅后续写屏障后仍零通知（S3/S7）；raw 事件同时在场（事件到、通知不到 = 编排缺席） |
| H2 必须删必填字段才触发，所以场景非法 | **排除** | 必填字段删除被写面拒绝（S2，零事务）；**可选**容器删除合法（S3 `ok:true`、S7 `ok:true`）且仍零通知 ⇒ 与合法性无关 |
| H3 零通知源于 Yjs 不产深事件 | **排除** | 祖先删除仅产 ROOT 级单事件（`path=[] key action=delete`，E5a/E5b）——事件在场，是消费方漏读 |
| H4 溢出机制不存在 | **排除** | X-1/X-4：capacity=1 恰一条 invalidate-all；缺省容量 17 同步事务恰一条（清队） |
| H5 注入位已存在只是没文档 | **排除** | 类型面 TS2353（`NamespaceRegistryTestingOverrides` 无该字段）+ 运行面字段被忽略（probe C）；`runtime.ts` L576 两参调用 |
| H6 契约红在环境/fixture/入口/超时 | **排除** | 基线：根 typecheck exit 0、测试树 tsc exit 0、#387 契约 21/21 绿；探针负控全绿后才在目标断言处红 |
| H7 AC4（横跨缺席期）也是红的 | **排除（纠正）** | 删除→重建→条目写 → `data` 已在 HEAD 绿（S4/S8、E5e）⇒ AC4 是**回归边界**（基线绿），#390 的红在**删除信号本身**与注入位 |
| H8 默认容量爆发可替代注入做契约触发 | **排除** | S10b：投递条数随时序漂移（N20 → data 3 + 失效 1；N60 → data 9 + 失效 3）⇒ 不可作确定性验收；ADR L94 明定注入缝 |
| H9 契约可用源码/正则断言替代行为验证 | **排除** | 本契约全部断言锚定 lease 公共面运行时通知流、类型系统与 raw 事件面；零 grep/源码文本断言 |

## 12. Acceptance contract and test paths

### 12.1 契约绑定表（SA1 冻结/必裁；语义断言不随绑定变化）

| # | 绑定 | 契约默认取值 | 依据 / 若 SA1 另择的处置 |
|---|---|---|---|
| B-1 | **【承重】容量注入位** | `NamespaceRegistryTestingOverrides`（`@nomicore/namespace-registry/testing`）**加法式可选字段** `watchQueueCapacity?: number`（正整数、≥1），经 internal 装配缝真达 `createWatchHub` 第三参；缺省 = runtime 实现常量 | ADR L66（构造参数 + 实现默认）+ L94（testing 工厂注入小上限）+ SA8 §8-1。若 SA1 另择字段名/形态：只改 fixture 单点 `WATCH_TEST_INJECTION_BINDING`（§12.4）+ 类型契约绑定块 + 本表；**不得**新开第二 testing seam / 公共 API |
| B-2 | **【承重】溢出触发模式** | 注入 capacity=1；同一**同步段**两次 un-awaited `mutateData`（合法条目写；均 `ok:true`）；断言 `syncCallbacks === 0` | §7-1（10/10 轮实测事件序确定）；T1 D1「同步段零回调」同款纪律 |
| B-3 | `invalidate-all` 形状 | 恰两键 `{kind:'invalidate-all', origin}`；`origin ∈ {'local','replication'}` = 触发事务 origin；无 `changes`/`reason`/`version`/`rev` | ADR L44–53、L52–53；issue AC2 原文逐字；探针 B E1/E3 `rawKeys=['kind','origin']` |
| B-4 | 父路径删除语义（失效触发源） | 订阅容器路径的**严格祖先**被删（`action:'delete'`）或**整替**（`action:'update'`，旧子树消失）→ invalidate-all；容器**创建**（原缺席）不钉 kind（T1 N4 边界） | ADR L50「父路径删除」+ §5 漏不可接受 + SA8 §8-2「父路径 + 本条键 = 容器创建/删除/整替」 |
| B-5 | 订阅存活 | 溢出/父删/整替后订阅**不摘除**：无 `watch-end`、无 `unsubscribe` 反作用；重建后条目变更照常 `data` | ADR L38/L51（数据缺席与删除从不终结订阅） |
| B-6 | 容量默认值 | **不断言数值**；只断言「默认容量下 2 次 un-awaited 写不溢出」（NC1）与「注入 1 时必溢出」 | ADR L66「数值不进公共契约」；SA8 §8-4②（不得套用复制 fanout 冻结常量纪律） |
| B-7 | 事务级原子 + FIFO | 一事务对该订阅**至多一条**通知；含结构性删除的事务该条 = invalidate-all；**已投递**序不被降级信号越过（在队未投递 data 允许被清） | ADR L51（统一进流保 FIFO）、L67（事务级原子通知）；#387 AC5/B1；SA8 §8-2 |

**非目标（不得越界）**：谓词 `where` 与 `WATCH_MAP_OPTIONS_INVALID`（T2 #388）；`watch-end` 两 reason 与
`origin:'replication'` 的复制 apply 验收（T3 #389）；文档词条（T5 #391）；数组载体订阅、含值通知、序号/对账（ADR v2）。

### 12.2 Issue AC ↔ 可执行用例映射（用例 ID 供实现阶段落盘）

| Issue AC | 用例 | 关键可观察断言 | HEAD 判定 |
|---|---|---|---|
| AC1 有界（构造参数 + 实现默认，数值不进公共契约） | **A1**（类型 + 注入生效）、**A8**（公共面零泄漏）、NC1 | 字段类型在场且被消费；`Object.keys(lease)` 恒 16 键（T1 纯加法后）；公共入口零 capacity 导出；无注入时 2 写不溢出 | 红（A1）/ 绿（A8/NC1） |
| AC2 溢出 → `invalidate-all` + 订阅存活 | **A2**、NC1 | 恰一条 `{kind:'invalidate-all',origin:'local'}`（两键）；排空后再写 → `data`（自愈，无需重建订阅）；NC1 证明断言对注入敏感 | 红 |
| AC3 父级删除 → `invalidate-all` + 订阅存活 | **A3**（容器删）、**A3b**（同事务删+无关写）、**A4**（祖先删）、**A5**（整替）、NC2 | 恰一条两键 invalidate-all（origin local）；无 watch-end；订阅存活；条目级删除仍为 `data` | 红（A3/A3b/A4/A5） |
| AC4 订阅横跨缺席期（删→重建→条目 `data`） | **A6** | 删除后重建容器 → 条目写到达 `{path:['optionalTasks'],key:'r1'}`/嵌套形态；零重新订阅 | **绿（基线，回归边界）** |
| AC5 溢出可测：既有 testing 工厂 overrides 注入小上限（零新接缝） | **A1**、**A2** | 仅 `createNamespaceRegistryForTesting(..., { watchQueueCapacity: 1 })`；无新 import/子路径/公共 API | 红（字段缺席：TS2353 + 运行忽略） |
| AC6 溢出不阻塞写、降级分发同样在写序列器槽之外 | **A7** | 触发写全部 `ok:true`；同步段零回调；后续写照常完成；通知流三 kind 闭集 | 绿（无溢出时）/ 红（降级路径随 A2 不可达） |
| ADR §4 形状冻结 + 零无关 kind | **A9** | `invalidate-all` 恰两键；`data` 恰三键、定位符恰两键；kind 闭集；零 `watch-end`/version/rev | 绿（回归边界） |

### 12.3 最小输入与期望（旧实现 vs 目标实现）

**最小 fixture（建议 schema；实现阶段落盘，命名可调）**：

```vfsl
type Task = YMap<{
  /** 任务标题 */
  title: YLeaf<string>;
  /** 优先级 */
  priority: YLeaf<number>;
}>;
type ROOT = YMap<{
  /** 任务表（必填——非法删正例） */
  tasks: Record<string, Task>;
  /** 可选任务表（合法删除 = 父路径删除正例；已物化 e1/e2） */
  optionalTasks?: Record<string, Task>;
  /** 两级嵌套：内层订阅 + 外层删除（祖先删除正例） */
  optionalGroups?: Record<string, Record<string, Task>>;
  /** 无关路径负控 */
  meta: YMap<{
    /** 备注内容 */
    content: YLeaf<string>;
  }>;
}>;
```

**最小溢出触发（A2 + A1，承重）**：
`openWatchLease({ watchQueueCapacity: 1 })` → `watchMap(['tasks'], sink.listener)` →
同一同步段 `p1 = mutateData(set ['tasks','x1'])`、`p2 = mutateData(set ['tasks','x2'])`（不 await）→
断言同步段回调 0 → `await Promise.all([p1,p2])` 均 `ok:true` →
`expect.poll` 至出现 `{kind:'invalidate-all', origin:'local'}`（`toStrictEqual` 恰两键）→
再写 `set ['tasks','x3']` → 等待 `data`（订阅存活/自愈）。

**最小父删触发（A3）**：`optionalTasks` 已物化（e1/e2）→ 订阅 → `set ['optionalTasks','e3']` 得 `data` 正控 →
`delete ['optionalTasks']`（`ok:true`）→ 恰一条 invalidate-all → 重建 + 条目写 → `data`（A6）。

**旧实现（HEAD `28faeae`）对照**：
- A1：`watchQueueCapacity` → **TS2353**（`overrides-missing-field.ts(17,3)`）；运行期字段被忽略；
- A2：两次写 → `[data(x1), data(x2)]`、零 invalidate-all（probe C）；红灯首因 = 「注入位缺席 ⇒ 无失效信号」，非时序/环境；
- A3/A3b/A4/A5：零通知（探针 A S3/S12/S7/S9、探针 B E5a/E5b/E5f）；
- A6/A7/A8/A9/NC1–NC6：绿（回归边界保持）。

### 12.4 测试路径（**本轮未落盘**；dispatch 明令不落测试，交实现阶段；vitest 采集同 #387 先例）

| 路径 | 内容 | 采集 |
|---|---|---|
| `packages/namespace-registry/test/issue-390-watch-invalidation-fixture.ts` | 共享 fixture：含可选容器的 schema/文档、`openWatchLease({ watchQueueCapacity })` 注入单点（B-1）、通知 sink、排空/屏障助手（`expect.poll` + 同订阅后续事务屏障） | 非测试文件（`*.ts` 未被 `*.test.ts` 通配命中） |
| `packages/namespace-registry/test/issue-390-watch-invalidation-red.test.ts` | 行为契约：A1–A9 + NC1–NC6 | `packages/*/test/**/*.test.ts`（`vitest.config.ts` L15） |
| `packages/namespace-registry/test/issue-390-watch-invalidation-surface.test-d.ts` | 类型契约：override 字段在场 + 正/负例（`@ts-expect-error` 无 unused）+ 失效信号两键类型面 | `packages/*/test/**/*.test-d.ts`（L20 + `tsconfig.typecheck.json` include） |

> 备选（SA1 可择）：把注入字段与可选容器 fixture 追加进既有 `issue-387-watch-map-fixture.ts`（加法式、单点），
> 但**不得**改动 #387 契约文件既有断言（21/21 必须保持绿）。

### 12.5 断言纪律与反伪绿防线

1. **零伪红/伪绿工具**：无 skip/only/todo、无 env override（仅仓内既有 `NODE_OPTIONS=--conditions=nomicore-source`）、
   无吞错、无 fallback、无软化断言。
2. **行为面断言**：全部锚定 lease 公共面运行时通知流与类型系统；**禁止**源码字符串/正则断言。
3. **触发确定性**：A2 的两次写必须在**同一同步段**受理（B-2），并断言该同步段回调 0——禁止 `setTimeout` 竞猜。
4. **零通知断言有屏障**：先做同订阅的后续合法写并等到其 `data`，再断言「此前无失效信号」；
   不得只 sleep。
5. **精确形状**：`invalidate-all` 恰两键 `toStrictEqual({kind:'invalidate-all',origin:'local'})`；`data` 恰三键 +
   定位符恰两键；kind 闭集断言恒在场。
6. **注入只经既有 seam**：契约文件只 `import { createNamespaceRegistryForTesting } from '@nomicore/namespace-registry/testing'`；
   禁止直连 `createWatchHub`/内部 seam 触发（模块面直驱仅本轮诊断探针用过，不入契约）。
7. **反伪绿三重**：NC1（无注入不溢出 ⇒ 断言对注入敏感）+ NC2（条目级删除不得升级 ⇒ 不噪声化）+
   NC4/NC5（非法事务不作触发源）+ A9（kind 闭集，防新 kind/字段混入）。
8. **类型契约双验证**：字段在场断言 + 负例敏感度（`@ts-expect-error` 无 unused）+ 假想实现满足性自查
   （SA1 先例：mock-contract 编译通过）。

### 12.6 实现期红线（交 SA1/SA3/SA7 复核，非本契约执行）

1. 零涉面：`readData` / 窗口读 / 复制面（含 needs-resync 语义）/ 诊断日志 / wire / 持久化零改动。
2. 注入只在显式 testing surface（`NamespaceRegistryTestingOverrides` 加法式字段）+ internal 装配缝；
   **不得**新开公共 API / 新 testing 子路径 / 第二 seam；主入口零 re-export。
3. 三 kind 形状逐键不变；`invalidate-all` 不得夹带 reason/changes/version/rev；`data` 仍不含值。
4. 分发恒在写序列器槽之外；溢出不阻塞写；通知异常零外泄（`watch-map.ts` 零 throw 硬红线）。
5. 不得顺带实现 T2（`where` / `WATCH_MAP_OPTIONS_INVALID`）与 T3（`watch-end` / 复制 origin 验收）范围。
6. 不得削弱既有真变过滤（NC2）：条目级删除/同值写过滤语义零漂移（#387 契约 21/21 保持绿）。
7. 若 SA1 冻结不同绑定（B-1 字段名/形态），只改 fixture 单点 + 类型契约绑定块 + 回写 §12.1；
   语义断言与用例映射不变。

## 13. Red/green evidence

| 运行 | 命令 | 结果 |
|---|---|---|
| registry 公共面契约形探针（A/红+负控） | `NODE_OPTIONS=--conditions=nomicore-source npx tsx packages/namespace-registry/.sa6-390/probe-a-registry-capability-gap.ts`（临时；收尾删除） | exit 0；**G-1..G-4 失效信号缺席（`notificationsAfterDelete: []` / `invalidateAllObserved:false`）**；G-6..G-10 与 NC1–NC5 全绿；S10a 10/10 触发序确定（`sa6-issue390-probe-a.log`） |
| watchHub 模块面机制探针（B） | 同 tsx `probe-b-watchhub-mechanics.ts`（临时） | exit 0；capacity=1 → 恰 1 条 invalidate-all（两键）+ 自愈；FIFO；origin 两态；缺省 17 事务 → 恰 1 条 + 0 data；父删/祖先删/整替 **零通知** + raw 事件形状（`sa6-issue390-probe-b.log`） |
| 注入位运行面探针（C/红） | 同 tsx `probe-c-injection-ignored.ts`（临时） | exit 0；`watchQueueCapacity:1` 被忽略 → `[data,data]`、`invalidateAllObserved:false`、lease 16 键（`sa6-issue390-probe-c.log`） |
| 注入位类型面探针（红） | `npx tsc --noEmit -p packages/namespace-registry/.sa6-390/type-probe/tsconfig.json`（临时） | **exit 2**：`overrides-missing-field.ts(17,3): error TS2353: … 'watchQueueCapacity' does not exist in type 'NamespaceRegistryTestingOverrides'`；对照文件（`idleTimeoutMs`）零错误（`sa6-issue390-type-probe.log`） |
| 基线 T1 契约 | `vitest run …/issue-387-watch-map-tracer-red.test.ts --typecheck.enabled=false` | **21/21 绿**、exit 0（`sa6-issue390-baseline-issue387-contract.log`） |
| 基线根 typecheck | `pnpm typecheck` | EXIT=0（`sa6-issue390-baseline-root-typecheck.log`） |
| 基线测试树 tsc | `npx tsc -p tsconfig.typecheck.json --noEmit` | EXIT=0（`sa6-issue390-baseline-test-tsc.log`） |
| runner 采集 | `npx vitest list packages/namespace-registry --filesOnly` | 52 文件；#387 行为契约第 5 行、类型契约第 45 行（`sa6-issue390-runner-list.log`） |

**旧实现失败点（目标契约首红位）**：
① 父删/祖先删/整替/同事务删 = 零失效信号（G-1..G-4，通知面）；
② `watchQueueCapacity` 注入位缺席（TS2353）且运行被忽略（G-5，seam 面）⇒ AC2 的溢出验收在 HEAD 不可达。
两条红因互相独立、均可机械区分：前者「事件在场但通知缺席」，后者「类型/装配缺席但机制在场」。
AC4/A7/A8/A9 与负控为基线绿（回归边界），**不得**伪称红灯（§11-H7）。

## 14. Runner trigger evidence

- **include 正则实读**：`vitest.config.ts` L15 `packages/*/test/**/*.test.ts`；L20 typecheck include
  `packages/*/test/**/*.test-d.ts`（tsconfig `./tsconfig.typecheck.json`，其 include 含 `packages/*/test/**/*.ts`）。
- **采集实证**：`NODE_OPTIONS=--conditions=nomicore-source npx vitest list packages/namespace-registry --filesOnly`
  → 52 文件被采集，含 `packages/namespace-registry/test/issue-387-watch-map-tracer-red.test.ts`（第 5 行）与
  `…/issue-387-watch-map-lease-surface.test-d.ts`（第 45 行）——§12.4 的 #390 三件套落在同一目录/同后缀，
  采集性由同一 include 保证（`sa6-issue390-runner-list.log`）。
- 零 skip/only/todo、零 env override：本轮未落测试文件；契约落盘时须保持同纪律（§12.5-1）。

## 15. Unknowns and blockers

1. **【SA1 必裁】B-1 注入字段名/形态**：ADR L66/L94 只冻结语义（testing 工厂注入小上限、数值不进公共契约），
   未命名字段。契约默认 `watchQueueCapacity?: number`（正整数）；若 SA1 另择，只改 fixture 单点 + 类型契约绑定块 + §12.1。
2. **A5（容器整替）范围**：issue AC3 字面只写「父级删除」；本契约将其纳入（旧子树消失 = 漏不可接受，ADR §5 + §8-2 C-3
   分支描述）。SA1 若判超范围，须在设计中记录 ADR §4/§5 的显式裁决；默认保留为承重用例。
3. **默认容量数值**：契约不断言（B-6）；实现须保持「构造参数 + 实现默认」且默认常量不出现在 lease 公共面/公共类型/文档契约。
4. **容量参数的合法性校验**（如 `>= 1` 的运行时门）不属本契约断言面；契约只需 `1` 被兑现。
5. **AC4 为基线绿**：不是缺口，是回归边界；实现若把父删做成「摘除订阅」会使 A6 红——这正是它的价值。
6. **无阻塞项**：能力缺口稳定（探针 A/B/C 三段 + 类型探针），红灯精确落在目标能力缺席，负控全绿，
   基线健康（根 typecheck/test-tree tsc/#387 契约全绿），契约可执行、入口真实、绑定面明确。

## 16. Temporary diagnostics cleanup

- **零生产实现改动**：`git status --porcelain` 对 HEAD `28faeae` 仅 12 项**未跟踪**文件（Host 输入三件、本报告、
  8 份 `artifacts/sa6-issue390-*.log`）；`git diff`（tracked）= **0 行**——`packages/**/src/**`、`tests`、`docs/**`、
  `vitest.config.ts`、`package.json`、`pnpm-lock.yaml` 全部原样。
- **临时诊断清理（已执行）**：`rm -rf packages/namespace-registry/.sa6-390`（probe-a/b/c、`type-probe/` 两文件 + tsconfig）；
  复核：`ls -d packages/namespace-registry/.sa6-390` → `No such file or directory`；
  `find . -name "*sa6-390*" -o -name "probe-*390*"`（排除 node_modules）→ 零命中；`git status` 无该目录残留。
- **保留证据**：`artifacts/sa6-issue390-{probe-a,probe-b,probe-c,type-probe,runner-list,baseline-root-typecheck,baseline-test-tsc,baseline-issue387-contract}.log`
  （非测试、非生产代码；全部为探针/基线原始输出，供实现阶段复核）。

## Verdict

**approve**。诊断可信、契约可执行：

1. 能力缺口稳定复现（父路径删除 / 祖先删除 / 整替 / 同事务删 = 零失效信号；注入位类型+运行双缺席）；
2. 目标断言在 HEAD 精确红（§13 两条独立红因），红不在环境/fixture/入口/时序（§11 全排除）；
3. 负控全绿（NC1–NC6 + 基线三件套）；
4. 验收触发模式经因果实验确定化（capacity=1 + 同同步段两写，10/10 轮事件序稳定）；
5. 契约绑定表（§12.1）把语义与 SA1 可裁项分离，测试路径与断言纪律冻结（§12.4/§12.5），可直接进入设计。

**requiresConflictRecheck 提示**：SA8 前置门禁为 `true`（通知面失败语义 + testing 面增量待实现核对）；
设计复审与实现复查应按 SA8 §8-4 清单闭合后再落 `false`（先例：T1 #387）。
