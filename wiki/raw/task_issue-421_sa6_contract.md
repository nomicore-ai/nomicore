# task_issue-421 SA6 验收契约 — Edge 公共工厂：accept 双入口 + OPEN 准入管线 + sequence 盖章（spec #415 T4）

- Issue：#421（标题「Edge 公共工厂：accept 双入口 + OPEN 准入管线 + sequence 盖章（spec #415 T4）」，state=open，Issue updated at 2026-09-21T18:08:39Z）
- 任务类型：**Feature**（能力缺口 = 连接级半边**无公共出面**：工厂未导出、无 accept/acceptTrusted 双入口、无宿主 `resolveSessionSink` 回调、OPEN 准入管线四个分支无岗位）
- HEAD：`7039f6dae8e7d29f0c929492f0ca2119bc63afaa`（`Merge pull request #426 from ... mabf/issue-418`；#418 T2 拆分重构与 #419 T1 路由键守卫均已在本基线内）
- 结论：**`approve`**——能力缺口 7/7 可运行证据化，验收契约可执行且经变异证明敏感（7/7 期望命中），测试入口真实（发现性 + 类型层红实测）；范围决策 SD-1~SD-6 留给 SA8/SA2
- 本文件是唯一固定报告；可执行证据 = `wiki/raw/task_issue-421_sa6_capability_probe.mts`（探针，7 GAP + 15 ORACLE/NC）、`wiki/raw/task_issue-421_sa6_mutation_driver.mts`（变异驱动，7 变异）、`artifacts/sa6-issue421-*.log`（4 份）
- 本轮**未写入任何生产实现与交付测试**（dispatch 明示「Do not implement code or tests」）：`git diff -- packages/` 为空；`packages/replication-protocol` 与 `packages/ws-replication` 的 `src/`、`test/` 零改动（§16）

---

## 1. Task type and inputs

**读了什么**

| 输入 | 位置 | 用途 |
|---|---|---|
| Host 任务简报 | `wiki/raw/task_issue-421.md`（33 行） | Issue 正文：Parent（PR #416 spec/415）、What to build、AC1–AC6、Blocked by #418、Comments 空 |
| ADR 0032（已接受） | `docs/adr/0032-transport-decoupling-edge-session-split.md` L12–44 | 决策 1（两半边拆分）、2（缝只过 Uint8Array + 纯 JSON、出站盖章在 mux 点）、3（authorize 在 edge、未授权 OPEN 不过缝、OPEN 准入管线全为 edge 职责）、4（路由键定偏移、ERROR 有界 mini-decode）、5（观测纪律）；后果节「edge 以普通工厂导出」（L41） |
| 协议规范 | `docs/protocols/instance-replication-v1.md` §1/§3/§5/§6/§13/§14/§22 | 身份文法、20-byte envelope、消息注册表 scope、close 分类、ERROR 字段序、conformance 清单 |
| 前序票设计（T2，#418） | `wiki/raw/task_issue-418_design.md`（§654 Follow-up 行）、`wiki/raw/task_issue-418_sa6_contract.md`（§28 范围、§110 复审、§351 U4） | 本票范围 = T2 明示留给后续票的部分：worker 形态、**跨线程 pending 有界缓冲义务重新进入**、`createHubReplicationEdge` 公共导出面；T2 只交付内部模块 |
| 前序票验收（T1，#419） | `wiki/raw/task_issue-419_sa6_contract.md`、`packages/replication-protocol/test/codec-route-key-guard.test.ts` | ERROR mini-decode 的**布局事实源**与其预算登记（`ERROR_NS_PREFIX_BUDGET = 64`，L67/L322；实测最坏 46） |
| 生产源码 | `packages/ws-replication/src/{index,hub-edge,hub-split,hub-session,hub-connection,frame-io,liveness,defaults,validate,types}.ts`；`packages/replication-protocol/src/{errors,payloads,constants}.ts` | 能力缺口的岗位事实与现行语义 oracle（§5/§8） |
| 既有测试 | `packages/ws-replication/test/{ws-replication-issue418-*,ws-replication-issue190-guard,ws-replication-observer-red,ws-replication-issue246-interop-matrix}.test.ts`、`ws-replication-api.test-d.ts` | 既有最接近覆盖（T2 内部半边白盒、早到帧/单体验证）；测试入口与类型层冻结面 |
| Runner / 配置 | `vitest.config.ts`、`tsconfig.base.json`、`tsconfig.typecheck.json`、`packages/ws-replication/{package.json,tsconfig.json}` | 发现规则（`packages/*/test/**/*.test.ts`；`--typecheck` include `**/*.test-d.ts`）、exports 条件（`nomicore-source` → `src/index.ts`） |

**缺失输入（→ §15）**：SA8 固定位置产物（`task_issue-421_design.md` / `_design_conflict_report.md` / `_relevant_decisions.md`）**均不存在**；Issue 评论 REST 快照为空（dispatch 明示 `[]`）。故契约由简报 AC + ADR 0032 + 协议规范 + T1/T2 已冻结事实 + 源码/运行期实测推导。

**为什么是 Feature 而非 Bug**：ADR 0032 决策 1 的「两半边可独立实例化」已由 #418 交付（内部模块级），但**连接级半边的公共出面与宿主接入缝在 HEAD 上不存在**（§5 G1–G7）。现行单体与内部半边的协议语义本身**正确**（§5 探针 O1–O8 全绿），因此不存在「旧实现行为失败」的红灯；红灯必须、且只能来自**能力缺失**（类型层无导出、运行期无入口、T4 形态不可构造），并由变异矩阵（§9）证明目标断言敏感而非恒真。

## 2. Owner comment mapping

Issue 评论 REST 快照为空（`[]`）——无评论 id/时间戳可映射，**无 Owner 附加要求**。Owner 要求 = 简报正文。逐项映射：

| 简报条目（原文要点） | 契约条目 | 可执行证据（本轮实测） |
|---|---|---|
| AC1：edge 工厂从包公共入口导出，签名经 test-d 锁定 | EF-C1/EF-C2/GATE-C2 | G1（运行期 undefined）、§14 §4/§4c（类型层 TS2724，exit 2）、§14 §5（消费者路径 undefined） |
| AC2：OPEN 准入管线按序执行并有独立测试（HELLO/drain 门 → 全解码 → authorize → pending 有界缓冲 → 并发 OPEN 上界 → sink 解析失败响亮收口 → 已建立会话转发） | OAP-C1~OAP-C8 | G4/G5/G6/G7（四个分支无岗位）、O6/O7（现行门与 drain 语义）、M1–M5 变异（管线各段敏感） |
| AC2 内嵌语义：拒绝 = NAMESPACE_UNAUTHORIZED + 拒绝闩锁，重 OPEN 拒答 NAMESPACE_REOPEN_REQUIRES_RECONNECT；未授权 OPEN 不过缝 | OAP-C3 | G4（denied OPEN 直达 session）+ 源码事实 `hub-namespace.ts:299,305,357`（闩锁/拒绝码单点） |
| AC3：路由键文法校验两分支逐字节复现单体语义（违例 → MALFORMED_FRAME fatal 1002；合法无 sink → 合成 NAMESPACE_STATE_VIOLATION，连接存活） | RK-C1/RK-C2/RK-C3 | O1/O2/NC1/NC4（内部半边 + 单体逐字节） |
| AC4：ERROR 帧 mini-decode 有界扫描路由正确（连接级 ERROR 不路由） | ER-C1/ER-C2/ER-C3 | O3/O4/NC3、T1 守卫 `ERROR_NS_PREFIX_BUDGET = 64` |
| AC5：出站盖章后 wire 帧与单体输出逐字节一致（同输入序列对比测试） | WS-C1/WS-C2/WS-C3 | O5/O5b/O1b/O2b（同输入序列 hex 相等）+ NC2（per-connection） |
| AC6：liveness/GOAWAY/reauth/drain 提前完成观测在 edge 单测覆盖（settled 信号驱动） | LC-C1~LC-C4 | O6（settled 驱动提前 1001，deadline 未 fire）、O8（liveness 凭据/超时） |
| 「入口复刻现有双形态：`accept(transport, { token })`（内部跑注入的 verifyToken）与 `acceptTrusted(transport, identity)`」 | EF-C2/EF-C3 | G2（半边无入口；双入口只在服务层 `hub-connection.ts:242,336`）、M-neutral 对照组 |
| 「宿主回调 `resolveSessionSink(connectionKey, namespaceId, authorization)` 在 OPEN 授权通过后调用」 | OAP-C3/C4/C6/C8 + SD-1/SD-4 | G3（T4 形态构造抛错、回调零调用）、G4（无「授权后」岗位） |
| 「出站 sequence 盖章对外可见（多会话并发帧经 mux 后 per-connection 严格递增）」 | WS-C1 | O5（内部半边 4 帧交织 1..5）+ NC2（两连接各自从 1） |
| 「ERROR mini-decode（消费 T1 守卫的布局契约）」 | ER-C1 | O4 + T1 守卫文件（同源消费，预算单点） |

## 3. SA8 constraints

无 SA8 设计产物可读（§15-2）。契约继承的硬约束（全部已在库、不可协商）：

1. **ADR 0032 决策 2（wire 零变化）**：缝上只有 namespace 域帧 + 纯 JSON + 4 控制信号；入站 sequence 由 edge 校验（header-only）；出站帧 session 侧以 sequence=0 占位编码、edge 在 mux 点重写 `[8..12]`——**wire 逐字节不变**（L18）。本契约的 WS-C2/RK-C3 以「同输入序列与单体逐字节相等」落实该约束。
2. **ADR 0032 决策 3（authorize 在 edge 单点，未授权 OPEN 不过缝）**：edge 全解码后调用宿主注入的 `NamespaceAuthorizer`；未授权 OPEN 不过缝、拒绝闩锁；「OPEN 准入管线（pending 有界缓冲、并发 OPEN 上界、sink 失败响亮连接收口、drain 门、session 对象随连接存活）全部为 edge 规范职责」（L22）。→ OAP 全组。
3. **ADR 0032 决策 4（路由键 O(帧头) + ERROR 例外）**：namespace 域帧 `[21..56)`、UPDATE_CHUNK `[22..57)`、ERROR 走**有界 mini-decode**；「违例 → MALFORMED_FRAME fatal；合法无 sink → 合成 NAMESPACE_STATE_VIOLATION」；「路由键布局与 codec 字段序登记为同步维护契约」→ T1 守卫（#419）已落地，预算 `≤ 64` 字节。→ RK/ER 组。
4. **ADR 0032 决策 5（降级与观测纪律）**：observer 发射点 = 拥有事实的一侧（连接域与出站 sequence 事件在 edge）；缺面 = dormant；免 listen 表达为显式 `listen: false`；SessionHost 服务仅免 listen 模式提供。→ LC/GATE 组（本票不要求 listen:false/session 服务，那属后续票）。
5. **ADR 0032 后果节（公共面冻结，append-only）**：`createHubReplicationEdge` 以普通工厂导出（非 Cordis 插件、无 Registry 依赖）；「公开面一经发布即按 SA6 纪律冻结，演进只能 append-only」（L41–43）。→ EF-C1/GATE-C4。
6. **协议 §13/§14（错误码与 close 分类 append-only）**：`INTERNAL_ERROR`（连接域）= fatal/retryable/1011（`errors.ts:117`）；`NAMESPACE_UNAUTHORIZED`（`errors.ts:123`）、`NAMESPACE_REOPEN_REQUIRES_RECONNECT`（`errors.ts:122`）、`NAMESPACE_STATE_VIOLATION`（`errors.ts:128`）。本票**零新错误码**（简报明示）。
7. **包边界（`packages/ws-replication/AGENTS.md`）**：生产 API 经 `src/index.ts` 导出；协议状态机单份、不 fork；hub 连接绑定 pre-upgrade 可信身份；保持 admission 有界（handshake/ready/backpressure/drain 全窗口）。
8. **测试纪律（SA6 契约）**：无 skip/only/todo、无 env override、无 fallback、无吞错、无源码字符串/正则断言；断言只观察运行时行为（出站帧字节、close code、宿主回调/缝侧到达序列、settled 信号）。

## 4. Environment and baseline

| 项 | 值（本轮亲测） |
|---|---|
| 运行环境 | node `v24.13.0`、pnpm `10.28.2`、vitest `3.2.7`、tsx `4.23.12`、tsc `5.9.3` |
| 依赖安装 | `pnpm install --frozen-lockfile --offline` → exit 0（17 workspace projects，65 包全 reuse，零下载） |
| 工作树 / HEAD | `/home/wangjian/nomicore-fix-issue-421` / `7039f6dae8e7d29f0c929492f0ca2119bc63afaa` |
| 包全量套件基线 | `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/ws-replication` → **77 文件 / 588 测试全绿 / Type Errors: no errors**（42.23s） |
| 包类型检查基线 | `pnpm exec tsc -p packages/ws-replication/tsconfig.json` → **exit 0**（§14 §4c） |
| 探针基线 | 真实源码上 **gaps=7/7 + oracle+nc=15/15，exit 0**；重复 5 次逐行一致（§7/§14） |
| 生产源码改动 | **零**：`git diff -- packages/` 为空（§16） |

证据：`artifacts/sa6-issue421-runner-trigger.log`（§1 基线 / §2 发现性 / §3 占位参与 / §4 类型层红 / §5 消费者路径 / §6 收尾）、`artifacts/sa6-issue421-probe-green.log`（5 轮）、`artifacts/sa6-issue421-structural-evidence.log`。

## 5. Positive reproduction — 能力缺口（可运行证据 7/7）

探针 `wiki/raw/task_issue-421_sa6_capability_probe.mts` 在真实源码上实测（完整输出 = `artifacts/sa6-issue421-probe-green.log`）：

```text
GAP G1 ABSENT entry=ws-replication/src/index.ts exports=11 个；createHubReplicationEdge 未导出
GAP G2 ABSENT 连接级半边无 accept/acceptTrusted（双入口仅存在于服务层组合根 HubReplicationImpl）
GAP G3 ABSENT T4 形态构造抛错（config.sessionFactory is not a function）；合法配置下 resolveSessionSink 调用 0 次
GAP G4 ABSENT 授权拒绝下 OPEN 仍投递到 session 半边（opens=["ns-…01"]，pulls=[{…,"outcome":"denied"}]）
GAP G5 ABSENT sink 未解析（authorize 在途）期帧即刻投递、零缓冲、零上界收口（无 pending 状态可测）
GAP G6 ABSENT 8 个 in-flight OPEN 全部到达 session 半边，零收口（无并发 OPEN 上界岗位）
GAP G7 ABSENT sink 装配失败 = 构造期同步抛错（sa6: sink unavailable），wire 零帧零 close——连接级 INTERNAL_ERROR+1011 不可达
```

**类型层红（同一缺口的第二观察面，经真实 runner 入口）**：临时 test-d fixture（`packages/ws-replication/test/ws-replication-issue421-api.test-d.ts`，运行后已删）内容为 `import { createHubReplicationEdge } from '@nomicore/ws-replication'`：

```text
TypeCheckError: '"@nomicore/ws-replication"' has no exported member named 'createHubReplicationEdge'.
Did you mean 'createHubReplication'?   （vitest --typecheck，EXIT_NEGATIVE_TYPECHECK=1）
TSC_EXIT_NEGATIVE=2（pnpm exec tsc -p packages/ws-replication/tsconfig.json，同一条 TS2724）
TSC_EXIT_CLEAN=0（删除 fixture 后）
```

**消费者路径红（真 node_modules 链接解析）**：`apps/yjs-server` 上下文临时脚本 `await import('@nomicore/ws-replication')`：

```text
typeof createHubReplicationEdge = undefined
exports = DEFAULT_REPLICATION_BACKOFF,…,createHubReplication,createHubReplicationPlugin,createPeerReplication,createPeerReplicationPlugin,requireHubReplication,requirePeerReplication
```

**结构性补充**（`artifacts/sa6-issue421-structural-evidence.log`，属证据补充而非行为断言）：`hub-edge.ts` 配置面 13 个成员中无 `verifyToken`/`resolveSessionSink`（`HubReplicationEdgeConfig` L56–78；grep 命中 14 行含接口 L84 的只读投影）；`hub-edge.ts` 内 `accept(`/`acceptTrusted`/`verifyToken`/`resolveSessionSink`/pending 缓冲区符号零命中（唯一 `pending` 是 L701 注释「无需独立 pending 集」）；`src/index.ts`/`src/testing.ts` 无两工厂；`limits` 无 OPEN 并发上界键（`types.ts:48` 仅有 `maxConcurrentAssembliesPerConnection`＝分块 assembly 上界）；连接级 `INTERNAL_ERROR`（1011）在 hub 半边零发射点（`hub-edge.ts` 全部命中均为注释；`peer-connection.ts:740` 是 peer 侧）。

## 6. Negative control

**相近负控（探针内，观察面 = 缝另一侧 stub 记录与出站帧字节；现行实现上全绿——实现票必须原样保留）**：

| id | 断言 | 为什么是负控 |
|---|---|---|
| NC1 | 已建立 ns 的合法帧（CLOSE_NAMESPACE）必须投递到 session、零 ERROR、连接存活 | 对照 RK-C2 的「无 sink → NAMESPACE_STATE_VIOLATION」；证明该断言不是「任何 ns 帧都报违例」的恒真断言 |
| NC2 | 两条独立连接的出站序列各自 `[1,2]` | 对照 WS-C1：per-connection 语义，不是全局计数；断言过宽（全局单调）会红 |
| NC3 | 未知 ns 的 namespace 级 ERROR 静默丢弃（零投递、零出站、连接存活） | 对照 ER-C2（连接级不路由）与 ER-C1（已建立 ns 路由）；证明「ERROR 不路由」不是「ERROR 一律不路由」 |
| NC4 | 已建 ns A 时 ns B 的帧不投递，违例帧点名 ns B | 对照 OAP-C7/RK-C2：账本按 ns 键隔离，无跨 ns 外溢 |

**变异侧负控**：NM1（`asciiAt` 等价改写）、NM2（`routingKeyOf` 语句重排）→ 失败集 = `[]`（全绿），证明断言面只锁运行时行为、不锁实现写法（§9）。

**空评论快照负控**：本契约零评论引用（dispatch 明示 `[]`）——不存在被忽略的 Owner override。

## 7. Stability, scale and timing

- 探针 = 微任务驱动 + 假 timer + 手工结算的 authorize 门闩，**零真实时间、零网络、零文件 IO**（`settle()` = 6 次微任务轮转；timer 由 `fireNext(delayMs)` 手工触发）→ 确定性。**重复 5 次：5/5 `gaps=7/7 oracle+nc=15/15`、exit 0、逐行一致**（`artifacts/sa6-issue421-probe-green.log`）。
- 变异矩阵**重复 2 轮**：两轮均 `MUTATION_RESULT 7/7 expected`，且每轮每条变异实际失败集与期望集逐项相同（`artifacts/sa6-issue421-mutation-sensitivity.log`）。
- 规模/时序条件：无竞态面需要压测——本票断言面是**连接级确定性状态机**；探针用 8 并发 in-flight OPEN（G6）与 4 帧交织（O5）覆盖最小规模；帧字节级断言与规模无关。
- 套件耗时：包全量 `--typecheck` 42s（transform 1.4s / collect 12s / tests 21s / typecheck 2.1s），适合每轮实现迭代全跑。

## 8. Capability gap（替代 Bug 根因链）

| id | 缺口 | 证据 | 影响（目标行为不可达的后果） | Confidence |
|---|---|---|---|---|
| G1 | 公共入口 `src/index.ts` 未导出 `createHubReplicationEdge`（`createHubReplicationEdge` 仅 `hub-edge.ts:788` 模块级导出） | G1；§14 §4/§4c/§5；#418 SA10 §3 导出面行「导出面留后续票…未提前导出」 | 宿主（nomic-server ingress 线程）无消费入口；ADR 0032 后果节「edge 以普通工厂导出」未落地 | 确定（实测） |
| G2 | 连接级半边无 `accept`/`acceptTrusted` 双入口（`HubReplicationImpl` 的六道门在服务层组合根） | G2；`hub-connection.ts:242,336` | 「入口复刻双形态」无岗位：宿主无法在同一半边完成 token 验证/可信身份接纳并拿到连接级句柄 | 确定（实测） |
| G3 | 无宿主回调 `resolveSessionSink(connectionKey, namespaceId, authorization)`：`sessionFactory(port)` 在**构造期**一次性装配唯一 sink | G3（T4 形态构造抛 `config.sessionFactory is not a function`；合法配置下回调 0 次）；`hub-edge.ts:75,173` | namespace 会话无法按 (连接, namespace) 解析（worker 分片的唯一接入缝缺失）；「授权通过后调用」无岗位 | 确定（实测） |
| G4 | 未授权 OPEN 仍直达 session 半边（到达点无条件投递） | G4（deny 下 `opens=[ns]`、`pulls=[denied]`）；`hub-edge.ts:323-328` | ADR 决策 3「未授权 OPEN 不过缝」在公共缝上不可表达（T2 进程内等价形态不可平移到宿主边界） | 确定（实测） |
| G5 | 无 pending 有界缓冲/序保冲刷（构造期即有唯一 sink ⟹ 无「未解析」状态） | G5（authorize 在途期 CLOSE 帧即刻投递、零收口）；`hub-edge.ts:139-144`（准入台账只增不减、无帧缓冲）+ `hub-edge.ts:701`（注释「无需独立 pending 集」）+ `hub-split.ts:53`（worker 形态由后续票重塑）；#418 design §654「跨线程 pending 有界缓冲义务重新进入」 | 宿主解析窗口内的 ns 帧无缓冲位置：要么丢帧、要么无界积压（有界性义务失守） | 确定（实测 + 文档） |
| G6 | 无并发 OPEN 上界收口 | G6（8 个 in-flight OPEN 全部到达、零收口）；`limits` 无对应键 | 恶意/异常 peer 可用无界 in-flight OPEN 放大宿主侧资源；ADR 决策 3 明示其为 edge 规范职责 | 确定（实测） |
| G7 | sink 解析失败无响亮连接收口（连接级 `INTERNAL_ERROR` + 1011 在 hub 半边零发射点） | G7（构造期同步抛错、wire 零帧零 close）；结构证据 A | 宿主解析失败时失败被静默吞进构造栈（或跨线程不可见），连接停在半开状态 | 确定（实测） |
| G8 | 目标行为（RK/ER/WS/LC 语义）**只在内部半边/单体上被验证**，公共工厂形态零覆盖 | O1–O8 全绿但均以 `../src/hub-edge.js` 相对导入或单体驱动（#418 白盒先例） | 公共工厂落地时无回归网：语义漂移（盖章、路由、drain）不会在任何公共面测试上显形 | 确定（实测） |
| G9 | 本票测试入口/文件不存在（`packages/ws-replication/test/ws-replication-issue421-*.test.ts` 零命中） | §14 §2（占位发现性绿）、§6 收尾（issue421 文件数 0） | 交付面缺位；契约条目（§12）无落点 | 确定（实测） |

**放大因素**：(a) `hub-edge.ts` 的 `sessionFactory` 是**构造期单点**，任何按 ns 解析的形态都必须先重建这一装配序（T2 设计 §7 D5.1 的「台账 → 投递」同步不变量是结构前提，worker 形态需重新过 SA8，#418 design §654）；(b) `HubOpenAdmission` 的三种结局（`authorized`/`denied`/`throw`）已被 T2 冻结（`hub-split.ts:48-51`），T4 的「不过缝」必须在**到达点之前**表达（否则结局语义仍要经缝）;(c) `channels` 只读投影（`hub-edge.ts:207-209`）与 `dataFacetOf` 是进程内组合成员，worker 形态按决策 5 降级（D6 注记）。

**未证实假设**：无（全部缺口为运行期实测或文档明示）。**排除项**：现行协议语义缺陷（排除，§5 探针 O1–O8 全绿）、wire/注册表缺陷（排除，T1 守卫 + 本契约 ER 组绿）、环境缺失（排除，§4 基线绿 + §14 发现性绿）。

## 9. Causal experiments（生产源码零改动）

**变异矩阵**：把 `packages/ws-replication/src` 复制到 `.scratch/sa6-421/mutants/<id>/src`（symlink 包内 `node_modules` 供 bare import 解析），单点替换后以 `SA6_EDGE_SRC` 指认副本运行探针；运行后删除副本。**真实 `src/` 从未被写入**（收尾 `git diff -- packages/` 为空）。两轮输出 = `artifacts/sa6-issue421-mutation-sensitivity.log`。

| 变异 | 漂移语义 | 期望红（探针 id） | 实测红 | 因果读数 |
|---|---|---|---|---|
| M1 `route-key-domain-offset` | 路由键定偏移右移 1 字节（域帧 `[21..56)` → `[22..57)`） | G5, NC1, NC4, O2, O2b, O5b | **逐项相同** | 合法帧被误判违例 → 无 sink 合成消失（O2/O2b）、已建 ns 不投递（NC1/NC4）、未解析期投递消失（G5）、双形态字节不再相等（O5b）；违例案（O1）**仍绿**——两类分支可判别 |
| M2 `connection-error-broadcast` | 连接级 ERROR 广播到 session 半边 | O3 | **相同** | 「连接级 ERROR 不路由」断言敏感且**单点**（只有 O3 红）——NC3/O4 不受影响，证明该断言宽度恰当 |
| M3 `stamp-no-increment` | 出站盖章恒 `sequence=1` | NC2, O1b, O2b, O5, O5b | **相同** | 盖章断言（O5）与两条同输入序列逐字节对比（O1b/O2b/O5b）同时点亮；per-connection 独立性（NC2）红 |
| M4 `no-sink-silent-drop` | 合法无 sink 帧静默丢弃 | NC4, O2, O2b, O5b | **相同** | R-none 合成是单体语义的一部分：删掉即双形态字节不等 + 违例帧消失；与 O3 解耦后（本轮修订：存活实证改用违例帧）O3 不再受牵连 |
| M5 `drain-gate-removed` | drain 门失效（REAUTH 窗口新 OPEN 继续进入 session） | O6 | **相同** | settled 驱动提前完成断言组对「窗口纪律」敏感 |
| NM1 `ascii-at-equivalent-rewrite` | `asciiAt` 循环 → `Array.from/join`（字节恒等） | 无（全绿） | **[]** | 断言不锁实现写法 |
| NM2 `routing-key-statement-reorder` | `routingKeyOf` 语句重排（行为不变） | 无（全绿） | **[]** | 同上；排除「断言过紧」 |

**因果实验补充**（均为同一缺口的第二/第三观察面）：

1. **类型层控制变量**（§14 §4/§4c）：唯一变量 = fixture 是否 import `createHubReplicationEdge`。导入即 TS2724（`vitest --typecheck` + `tsc -p` 双入口一致），删除即 `TSC_EXIT_CLEAN=0` ⟹ 红与「测试入口错误/环境」无关。
2. **消费者路径控制变量**（§14 §5）：唯一变量 = 解析上下文（`apps/yjs-server` 真 node_modules 链接 vs 相对源码导入）。两条路径一致给出 `undefined` ⟹ 不是探针的相对导入错误。
3. **T4 形态构造实验**（G3）：唯一变量 = 配置面（`resolveSessionSink` vs `sessionFactory`）。前者抛 `config.sessionFactory is not a function` ⟹ 契约要求的宿主回调形态在 HEAD 完全不存在（而非「存在但未调用」）。
4. **文档因果链**：#418 设计 §654 Follow-up 行明示本票范围（导出面 + 跨线程 pending 有界缓冲义务重新进入 + 入站缝形态重新过 SA8）⟹ 缺口是**前序票显式推迟**的结构性结果，不是实现遗漏。

## 10. Impact surface

| 面 | 预期变化（实现票，非本契约） | 本契约的约束 |
|---|---|---|
| 新增生产面 | `src/hub-edge.ts` 扩展/新增边工厂公共出面；`src/index.ts` append-only 新增导出（`createHubReplicationEdge` + 其配置/句柄类型） | EF-C1/GATE-C4；既有 11 个运行时导出与类型面零改名零删除 |
| 宿主缝 | 新成员 `resolveSessionSink(connectionKey, namespaceId, authorization)`（T4 形态） | OAP-C3/C4/C6/C8；SD-1/SD-4 |
| 缝类型/装配 | `hub-split.ts` 可能新增类型（pending/解析态）；`hub-connection.ts:429-463` 的单体组合根**行为不变**（可选择性换装内部实现，但入站序列 → 出站序列必须逐字节不变） | RK-C3/WS-C2/GATE-C3 |
| 零改动面 | `packages/replication-protocol/**`（错误注册表/消息注册表/codec）、协议文档 wire 语义、peer 侧（ADR 后果节：peer 不拆分）、`plugin.ts` 服务面 | GATE-C4 |
| 测试面 | 新增 `packages/ws-replication/test/ws-replication-issue421-*.test.ts`（6 文件）+ `ws-replication-issue421-edge-factory-api.test-d.ts`（1 文件）；既有 77 文件/588 测试保持绿 | §12.0/§12.8 |
| 下游消费者 | nomic-server ingress 线程（宿主）；`apps/yjs-server` 现有消费面不变（`createHubReplication` 路径零变化） | GATE-C3 |
| 观测面 | 连接域事件仍在 edge（ADR 决策 5）；新增解析/收口路径必须复用既有稳定码（未知 string 折叠 `INTERNAL_ERROR`，`observer.ts:69-80`） | OAP-C5/C6（零新错误码） |

## 11. Ruled-out hypotheses

| 假设 | 结论 | 依据 |
|---|---|---|
| H1「能力已存在，只是没有测试」 | **排除**：公共入口运行期 `undefined`（消费者路径实测）、类型层 TS2724、T4 形态构造抛错、宿主回调零调用 | G1/G3、§14 §4/§5 |
| H2「现行内部半步行为有 Bug，契约应在当前代码变红」 | **排除**：O1–O8 + NC1–NC4 在 HEAD 全绿（15/15，5 轮一致）；任何在当前内部半边/单体上「红」的断言都只能是假红 | §5/§7、probe-green.log |
| H3「本票需要改 wire/协议/错误注册表」 | **排除**：ADR 0032 决策 2「wire 逐字节不变」；本票零新错误码；同输入序列逐字节对比在 HEAD 已可执行且相等 | O1b/O2b/O5b、ADR L18/L41-43 |
| H4「未授权 OPEN 不过缝 = T2 已达成（进程内等价），公共形态无需改动」 | **排除**：T2 的等价形态依赖**构造期唯一 sink**（`hub-edge.ts:75,173`）；宿主边界上「不过缝」必须表达为「不调用宿主解析回调/不建会话」，HEAD 无该岗位 | G3/G4、`hub-edge.ts:139-144,701`、`hub-split.ts:53` |
| H5「pending 缓冲可以由宿主自行实现」 | **排除**：ADR 决策 3 明示 pending 有界缓冲是 edge 规范职责；且 #418 design §654 把「跨线程 pending 有界缓冲义务」列为重新进入项；有界性/溢出收口若不属 edge，则无人对连接级总量负责 | ADR L22、#418 design §654 |
| H6「合法无 sink 帧应当静默丢弃（故 NAMESPACE_STATE_VIOLATION 断言过强）」 | **排除**：单体语义为合成 NAMESPACE_STATE_VIOLATION 且连接存活（O2 实测）；M4 变异证明删除合成会破坏双形态逐字节等价 | O2/O2b、M4 |
| H7「ERROR 可以用统一 `[21..56)` 定偏移提取」 | **排除**：ERROR 的 namespaceId 在变长字段后（T1 守卫登记：最坏 46 字节、预算 ≤64）；本契约 ER-C1 以解码值一致 + 预算见证 | T1 守卫 `codec-route-key-guard.test.ts:67,322`、O4 |
| H8「红是环境/fixture/入口问题」 | **排除**：同一 runner 同一路径的占位测试 1 文件/1 测试绿（§14 §2）；删除负向 fixture 后 `TSC_EXIT_CLEAN=0`；基线 588 测试全绿 | §14 §1–§4c |
| H9「连接级 INTERNAL_ERROR 已有发射点，G7 不成立」 | **排除**：hub 半边零发射点；`peer-connection.ts:740` 属 peer 侧，与 hub edge 无关 | 结构证据 A |
| H10「本票与 #418「零新公共 API」约束冲突」 | **排除**：#418 是本票的 Blocked-by 前置，其 SA6 §28 与 §351 U4 明示导出面属**后续票**；本票正是该后续票（ADR 后果节 L41） | #418 SA6 §28/§351 U4、#418 SA10 §3 导出面行 |

## 12. Acceptance contract and test paths

### 12.0 交付路径与门禁

**目标测试文件（实现票新增；SA6 本轮不留半成品，§14 §2 的占位文件已删除）**：

| 文件（`packages/ws-replication/test/`） | 覆盖条目 |
|---|---|
| `ws-replication-issue421-edge-factory-api.test-d.ts` | EF-C1/EF-C2（类型层签名锁定；含 `accept`/`acceptTrusted` 参数与返回句柄的 `expectTypeOf` 断言） |
| `ws-replication-issue421-edge-accept.test.ts` | EF-C2/EF-C3（双入口 + verifyToken 注入 + 认证门/早到帧 parity） |
| `ws-replication-issue421-open-admission-pipeline.test.ts` | OAP-C1…C8 |
| `ws-replication-issue421-route-key-parity.test.ts` | RK-C1/RK-C2/RK-C3 |
| `ws-replication-issue421-error-routing.test.ts` | ER-C1/ER-C2/ER-C3 |
| `ws-replication-issue421-wire-parity.test.ts` | WS-C1/WS-C2/WS-C3 |
| `ws-replication-issue421-edge-lifecycle.test.ts` | LC-C1…LC-C4 |

**发现性**：`vitest.config.ts` include `packages/*/test/**/*.test.ts` + `typecheck.include packages/*/test/**/*.test-d.ts` → 目标路径实测被发现（§14 §2：占位 1 文件/1 测试绿；§14 §3：占位参与全量套件 589 测试）。**门禁命令**：

```bash
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/ws-replication   # GATE-C1
pnpm exec tsc -p packages/ws-replication/tsconfig.json                                               # GATE-C2
git diff --stat -- packages/replication-protocol/src                                                 # GATE-C4（必须为空）
```

**旧实现 vs 目标实现的期望（防「红在错误原因」）**：

- **EF 组 + OAP-C3/C4/C5/C6/C8 的旧实现期望 = 红，红因 = 能力缺失**：类型层 TS2724 / 运行时 `undefined` / T4 形态构造抛错（§5 实测）。
- **RK/ER/WS/LC 组的旧实现期望 = 红，红因与上一条同源**（公共入口不存在，测试无法编译/运行）；但这些条目的**语义**已由 O1–O8 + NC1–NC4 在内部半边/单体上实测为绿。实现票必须保证这些条目在工厂落地后**直接绿**；若落地后仍红，即为实现引入的语义漂移，不得以「红灯转绿」当作新能力。
- **负控（NC1–NC4）与中性变异（NM1/NM2）必须始终绿**。

### 12.1 EF — Edge 工厂公共出面（AC1）

| id | 输入 | 可观察断言 | 负控 | 旧/目标 |
|---|---|---|---|---|
| **EF-C1** | `import { createHubReplicationEdge } from '@nomicore/ws-replication'`（类型层 + 运行期） | 类型层可解析为函数；运行期 `typeof === 'function'`；`Object.keys(publicEntry)` 相对 HEAD 11 个导出**只增不减**（append-only） | 既有 `createHubReplication`/`createPeerReplication`/插件族导出仍在且类型不变 | 旧：TS2724 + `undefined`（§5）；目标：绿 |
| **EF-C2** | 工厂返回句柄：`accept(transport, { token })` 与 `acceptTrusted(transport, identity)` | 两成员均为函数；`accept` 路径 `verifyToken` **恰一次**（入参 = token），`acceptTrusted` 路径 `verifyToken` **零调用**；`acceptTrusted` 绑定 `identity.peerInstanceId` 为认证身份（HELLO 自报不得覆盖）；成功返回连接级句柄暴露 T2 `HubReplicationEdge` 面（`state`/`peerInstanceId`/`authenticatedInstanceId`/`channels`/`close`/`settle`/`beginReauth`/`revokeNamespace`） | 缺 token/非串 → `close(1008,'upgrade-unauthorized')` 且 `verifyToken` 零调用、零连接分配；`verifyToken` 返回 `null`/畸形/抛错/`ok!==true` → 同 1008；instanceId 文法违例 → 同 1008（复刻 `hub-connection.ts:250-315,345-349` 可见语义） | 旧：半边无入口（G2）；目标：绿 |
| **EF-C3** | 两入口的早到帧准入（HELLO 前帧） | 有界缓冲 ≤16 帧且按序重放；第 17 帧 → `close(1008,'upgrade-frame-limit')`；单帧 > `limits.maxFrameBytes` → `close(1009,'upgrade-frame-limit')`（既有 #138/#190 语义原样） | 合规单帧 HELLO 早到必须成功且 HELLO_ACK 正常 | 旧：服务层已有（`hub-connection.ts:89-133`），公共工厂入口不存在；目标：工厂入口等价 |

### 12.2 OAP — OPEN 准入管线（AC2，按序执行）

| id | 管线阶段 | 可观察断言 | 负控 | 旧/目标 |
|---|---|---|---|---|
| **OAP-C1** | HELLO/drain 门 | HELLO 前 OPEN → 连接级 `HELLO_REQUIRED` + `close(1002)`，`authorize` 零调用、宿主回调零调用；REAUTH drain 窗口内 OPEN → 零 authorize、零宿主回调、零新会话（连接随后按 drain 规则收口） | drain 窗口内 **CLOSE_NAMESPACE/CLOSE_OK** 仍按既有门放行语义处理（窗口不是全静默） | 旧：内部半边已绿（O6/O7）；工厂入口不存在 → 红 |
| **OAP-C2** | 全解码（畸形 ingress 收口） | 畸形 OPEN（坏 magic / 截断 / namespaceId 文法违例 / seq gap）→ 连接级 ERROR（`BAD_MAGIC`/`MALFORMED_FRAME`/`SEQUENCE_VIOLATION` 之一，注册表码）+ 对应 close code（1002），零 authorize、零宿主回调、零会话 | 合法 OPEN 必须解码成功并进入 authorize（不得误判畸形） | 旧：O7 绿（内部半边）；工厂入口红 |
| **OAP-C3** | authorize（拒绝/重开/闩锁） | ① 授权拒绝 → wire 上 namespace 级 `NAMESPACE_UNAUTHORIZED`（scope=namespace、点名该 ns）+ **宿主回调零调用**（未授权 OPEN 不过缝）+ 不建立会话；② 同 ns 重 OPEN → namespace 级 `NAMESPACE_REOPEN_REQUIRES_RECONNECT`，`authorize` 仍恰一次（拒绝闩锁）；③ `authorize` 抛错 → 不得静默：至少一帧 ERROR 且不建会话（映射依 T2 登记 `hub-split.ts:42-43`：`throw` → ns `INTERNAL_ERROR`；作用域/码若偏离须 SA8 显式裁决）；④ 连接在 ①–③ 后保持存活（除另有 fatal） | 授权通过 → 宿主回调**恰一次**（见 OAP-C8）；不同 ns 的拒绝不得互相影响 | 旧：内部半边由 session 侧产出（`hub-namespace.ts:299,305,357`）但仍直达 session（G4）；工厂形态红 |
| **OAP-C4** | pending 有界缓冲（序保冲刷） | 宿主解析在途时到达该 ns 的帧：按**到达序**缓冲、解析成功后按**同序**投递到宿主返回 sink（观察 sink 侧 `namespaceFrame` 序列 = 到达序，含 wire 序）；缓冲**有界**（上界来源见 SD-3），溢出 → 响亮连接收口（零新错误码）且不静默丢帧 | 解析成功后到达的帧直投（不经过缓冲，序仍单调）；无解析在途的 ns 帧不受该缓冲影响 | 旧：无该状态（G5）；目标：绿 |
| **OAP-C5** | 并发 OPEN 上界 | 超过上界的 in-flight OPEN → 恰一帧连接级 ERROR（**既有**注册表码，码选择见 SD-2；ws close code = 该码注册表映射）+ transport close + 已建立会话按既有 quiesce 路径终结 + 不为被拒 OPEN 建立会话 | 未超上界的 N 个并发 OPEN（N=上界）全部正常解析、零收口 | 旧：无上界（G6，8/8 全部到达）；目标：绿 |
| **OAP-C6** | sink 解析失败响亮收口 | `resolveSessionSink` **throw 或 reject** → 恰一帧**连接级** `INTERNAL_ERROR`（`fatal=true`,`retryable='yes'`）+ `transport.close(1011, …)`（`errors.ts:117` 注册表映射）+ 不建立该 ns 会话 + 无静默 fallback；`CONNECTION_ERRORS`/`NAMESPACE_ERRORS` 注册表**零 diff**（零新错误码） | 解析成功 / 合法无 sink（返回 `undefined`）**不得**走本收口路径（后者落 RK-C2） | 旧：wire 零帧零 close（G7）；目标：绿 |
| **OAP-C7** | 已建立会话转发 | 解析成功后该 ns 的帧投递到宿主返回的该 ns sink（含 wire 序）；其他 ns 的 sink 零污染 | 未 OPEN 的 ns 帧不得投递任何 sink（NC4 形态） | 旧：内部半边绿（O4/NC4）；工厂形态红 |
| **OAP-C8** | 阶段次序（单同步段可判定） | 记录型宿主断言调用序列：`authorize` → `resolveSessionSink` → 首帧投递/会话建立；`resolveSessionSink` 的 `authorization` 参数 = authorize 的 ok-投影（`localOwner`/`permissions`，非摘要）；`connectionKey` 在同一连接内恒定、跨连接互异（形态见 SD-4） | 拒绝案：`resolveSessionSink` 零调用（OAP-C3①）；重复 OPEN：不新增解析调用（闩锁） | 旧：无回调（G3）；目标：绿 |

### 12.3 RK — 路由键两分支（AC3）

| id | 输入 | 可观察断言 | 负控 | 旧/目标 |
|---|---|---|---|---|
| **RK-C1** | 路由键违例帧（定偏移前缀 ≠ `0x23`/截断/与解码值不一致） | 恰一帧**连接级** `MALFORMED_FRAME` + `close(1002,'protocol-error')` + 零投递 + 零宿主回调；不得静默误路由 | 合法帧（含 UPDATE_CHUNK kind-first 与 ERROR 例外）不得落本分支 | 旧：O1 绿（内部半边，字节 `[20]=0x22` 实测）；工厂形态红 |
| **RK-C2** | 合法帧 + **无已解析 sink** | 合成 namespace 级 `NAMESPACE_STATE_VIOLATION`（scope=namespace、点名该 ns）+ 连接**存活**（后续帧继续处理）+ 零投递；语料含「从未 OPEN」「宿主返回 `undefined`」两形态 | 已建立 ns 的同类帧必须投递（NC1） | 旧：O2 绿；工厂形态红 |
| **RK-C3** | 同输入序列逐字节对比（公共工厂 vs 单体 `createHubReplication.acceptTrusted`） | HELLO + {违例帧 / 无 sink 帧 ×2} 序列下，两形态出站帧序列 **hex 逐字节相等**，close code/reason 相等 | 差异容忍度为零：单帧任一字节不同即红 | 旧：O1b/O2b/O5b 绿（内部半边 vs 单体）；工厂形态红 |

### 12.4 ER — ERROR mini-decode（AC4）

| id | 输入 | 可观察断言 | 负控 | 旧/目标 |
|---|---|---|---|---|
| **ER-C1** | namespace 级 ERROR（已建立 ns；含 `relatedSequence` 有无、最长 safeMessage/最长码变体） | 路由目标 ns **等于** `decodeMessage` 回读的 `namespaceId`；投递含 wire 序；namespaceId 位置在 ERROR payload 前 **≤64 字节**（消费 T1 守卫登记的 `ERROR_NS_PREFIX_BUDGET`，`codec-route-key-guard.test.ts:67,322`）；连接存活 | 未建立 ns 的 ns 级 ERROR → 静默丢弃（NC3）；连接级 ERROR → 零投递（ER-C2） | 旧：O4/NC3 绿；工厂形态红 |
| **ER-C2** | 连接级 ERROR | session/sink **零投递**、wire **零回显**（除既有序列外无新帧）、连接存活（后续帧仍处理） | ns 级 ERROR 必须路由（ER-C1）——「不路由」仅限连接级 | 旧：O3 绿；工厂形态红 |
| **ER-C3** | 未知 ns 的 ns 级 ERROR（登记项） | 与单体一致：零投递、零出站、连接存活（单体 I5 语义；`hub-edge.ts:526-532` 注释与实现） | — | 旧：NC3 绿；工厂形态红（若 SA8 判定 T4 改语义须显式裁决，不得默默偏离） |

### 12.5 WS — 出站盖章（AC1/AC5）

| id | 输入 | 可观察断言 | 负控 | 旧/目标 |
|---|---|---|---|---|
| **WS-C1** | 多会话（多宿主 sink）并发帧经 mux | per-connection `[8..12]` 从 1 **严格递增**（无重复/无回退/无跳号），无论帧来自哪个 ns/sink；交织序 = 出队序 | 入站 sequence 不受影响（入站仍按 expectedSeq 校验） | 旧：O5 绿（内部单 sink 4 帧交织 1..5）；工厂多 sink 形态红 |
| **WS-C2** | 盖章字节等价 | 每帧 == `encodeMessage(同一占位消息, { sequence: k })` 的 hex；与单体同输入序列出站序列**逐字节相等** | 单帧任一字节不同即红（含 `[8..12]` 以外的 payload 字节） | 旧：O5/O5b 绿；工厂形态红 |
| **WS-C3** | 连接隔离 | 两条连接各自从 1 起；连接收口后零新出站（盖章计数不再推进） | 非全局计数（NC2 形态） | 旧：NC2 绿；工厂形态红 |

### 12.6 LC — 生命周期观测（AC6，settled 信号驱动）

| id | 输入 | 可观察断言 | 负控 | 旧/目标 |
|---|---|---|---|---|
| **LC-C1** | `beginReauth()` | 出站 GOAWAY `{reasonCode:'REAUTH_REQUIRED', drainTimeoutMs>0}`（= `timeouts.closeTimeoutMs`）+ 连接状态 `'draining'`；deadline 到 → `close(1001,'hub-reauth')`；幂等（重复调用零附加帧） | handshaking 态 reauth → 不发明 GOAWAY，直接 `close(1001)`（既有语义） | 旧：O6 绿（内部半边）；工厂形态红 |
| **LC-C2** | settled 信号驱动 drain 提前完成 | 全部**已建立（已解析）**会话终态通知齐备 → **立即** `close(1001,'hub-reauth')`，且 deadline timer 已清（未 fire）；任一未终态（含 authorize 在途 / 宿主解析在途 / pending 缓冲非空）→ **不**提前收口，deadline 仍武装 | 仅部分 settled → 不提前；空会话集 → 等 deadline（既有语义） | 旧：O6 绿（内部半边，含「单通道 settled 不收口」负控）；工厂形态红 |
| **LC-C3** | drain 门 | 窗口内 OPEN 不建立会话、零宿主回调；窗口内 ns 帧不进 session；CLOSE/CLOSE_OK 等既有窗口门语义不变 | 非 drain 窗口零行为变化 | 旧：O6 绿；工厂形态红 |
| **LC-C4** | liveness | `ping`/`onPong` 面齐备 → ping timer 武装（`timeouts.pingIntervalMs`）、ping 载荷 8 字节凭据；**凭据逐字节匹配**的 pong 清 pong 超时（连接存活）；不匹配/迟到/空载荷 → 超时保留 → `close(1001,'pong-timeout')`；两面缺省 → dormant（零 timer） | 匹配 pong 必须清超时（不得假超时） | 旧：O8 绿；工厂形态红 |

### 12.7 待 SA8 裁决的范围决策（SD）

| id | 问题 | 契约硬约束（不可协商） | SA6 建议 |
|---|---|---|---|
| **SD-1** | 公共工厂的配置/装配形态：简报写 `accept(transport,{token})` + `acceptTrusted(transport,identity)` + `resolveSessionSink`；T2 内部工厂是 `createHubReplicationEdge(config)`（pre-verified `peerInstanceId` + 构造期 `sessionFactory`） | EF/OAP 全部可观察行为；既有 `createHubReplication`（单体）/插件/peer 面**零行为变化**；不 fork 协议状态机（ADR 决策 1） | 公共工厂 = 连接级半边的**宿主出面**（accept 双入口 + 每次 accept 分配一个 edge 实例 + 注入 authorize/verifyToken）；T2 内部工厂可作为其实现细节保留，但其配置形态可扩展。若两条装配路径并存，须以 RK-C3/WS-C2 的双形态逐字节对比锁死等价 |
| **SD-2** | 并发 OPEN 上界的错误码/close code（简报只要求「响亮收口 + 零新错误码」） | 必须复用既有注册表码；恰一帧连接级 ERROR；ws close code = 该码注册表映射；零新错误码；不建立被拒 OPEN 的会话 | 候选：连接级 `INTERNAL_ERROR`(1011) 或 `CONNECTION_POLICY_VIOLATION`(1008)；若判为「宿主/实现故障」取前者，若判为「对端策略违例」取后者——须在设计中显式登记理由 |
| **SD-3** | pending 缓冲上界来源（新 limits 键 / 配置项 / 模块常数）与溢出语义 | 有界可证（测试以显式小上界驱动）；溢出 → 响亮连接收口（零新错误码）；序保冲刷；不得静默丢帧 | 若新增 `limits` 键，须过 `validateLimits` 响亮校验并登记为 append-only 配置；若用模块常数，须在设计中给出内存上界推导（类比 `MAX_EARLY_FRAMES` 的 16×maxFrameBytes 账） |
| **SD-4** | `connectionKey` 形态与稳定性 | 同连接内恒定、跨连接互异、与宿主连接身份可关联；宿主可在回调中用它定位连接 | 复用既有 observability `connectionId`（`${instanceId}-conn-${n}`，`hub-edge.ts:441`），避免第二套键 |
| **SD-5** | `resolveSessionSink` 返回 `undefined` 的语义 | 必须与「解析失败」区分：`undefined` = 合法无 sink → RK-C2 分支（连接存活）；throw/reject = OAP-C6 响亮收口 | 采用上述二分；设计中显式登记「无 sink ≠ 失败」 |
| **SD-6** | `authorize` 抛错的作用域/码 | 不得静默；不建立会话；至少一帧 ERROR；不新增错误码 | 维持 T2 登记（`hub-split.ts:42-43`：`throw` → ns `INTERNAL_ERROR`，连接存活）；若改为连接级收口须显式裁决（会改变 OAP-C3④ 的「连接存活」期望） |

### 12.8 GATE — 门禁与零回归

| id | 断言 | 证据形态 |
|---|---|---|
| **GATE-C1** | `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/ws-replication` 全绿（新增 7 文件计入：6 `*.test.ts` + 1 `*.test-d.ts`；Type Errors: no errors） | 可执行命令 + 日志；基线 77/588（§4） |
| **GATE-C2** | `pnpm exec tsc -p packages/ws-replication/tsconfig.json` → exit 0（`test/**/*.ts` 在 include 内，含新 test-d） | 命令退出码 |
| **GATE-C3** | 零回归：既有 77 文件/588 测试保持绿；单体 `createHubReplication` 入站序列→出站帧逐字节不变（O1b/O2b/O5b 在实现后仍绿）；peer 面零改动 | 套件 + 探针复跑 |
| **GATE-C4** | 零新错误码 + 零 wire 变更：`packages/replication-protocol/src` 零 diff；`src/index.ts` 仅 append-only 新增；无 skip/only/todo/env override | `git diff --stat`；测试文件纪律复核 |

## 13. Red/green or baseline evidence

- **已实测的红（能力缺失，非语义缺陷）**：
  1. 运行期：公共入口 `typeof createHubReplicationEdge === 'undefined'`（探针 G1 + 消费者路径 §14 §5）。
  2. 类型层：`vitest --typecheck` TypeCheckError + `tsc -p` TS2724，`EXIT_NEGATIVE_TYPECHECK=1` / `TSC_EXIT_NEGATIVE=2`（§14 §4/§4c）。
  3. 合约构造：T4 形态（`resolveSessionSink`、无 `sessionFactory`）抛 `config.sessionFactory is not a function`；合法配置下宿主回调 0 次（G3）。
  4. 管线岗位：deny 仍直达 session（G4）、无 pending 状态（G5）、8 in-flight OPEN 零收口（G6）、sink 失败 wire 零帧零 close（G7）。
- **已实测的绿（目标语义 oracle，实现后必须原样绿）**：O1–O8 + NC1–NC4 = 15/15（5 轮一致）；O1b/O2b/O5b 证明「同输入序列逐字节一致」方法在 HEAD 已可执行；NC1–NC4 证明断言可判别、不过宽。
- **反证（断言敏感度）**：M1–M5 各自点亮对应断言且失败集与期望**逐项相等**；NM1/NM2 全绿（§9）。拒绝为制造红灯而在当前内部半边/单体上写失败断言（H2——那只能是假红）。
- **假红排查**：同一 runner 的占位测试绿（§14 §2）；删除负向 fixture 后 tsc exit 0（§14 §4c）；探针相对导入与消费者真链接解析一致（§14 §5）。

## 14. Runner trigger evidence

`artifacts/sa6-issue421-runner-trigger.log`（全量原始输出）：

1. **§1 洁净基线**：`vitest run --typecheck packages/ws-replication` → `Test Files 77 passed (77)`、`Tests 588 passed (588)`、`Type Errors no errors`、42.23s。
2. **§2 发现性**：临时 `packages/ws-replication/test/ws-replication-issue421-ac.test.ts`（占位 1 用例）→ `✓ …issue421-ac.test.ts (1 test)`、`Test Files 1 passed (1)`、`Type Errors no errors`、156ms。**证明目标路径被仓库真实入口发现**；占位随即删除。
3. **§3 占位参与全量套件**：同一次全量 → `Tests 589 passed (589)`（78 文件），证明新增文件自然并入 GATE-C1。
4. **§4 类型层红（负向 fixture，真实入口）**：`import { createHubReplicationEdge } from '@nomicore/ws-replication'` →
   `TypeCheckError: '"@nomicore/ws-replication"' has no exported member named 'createHubReplicationEdge'. Did you mean 'createHubReplication'?`；`EXIT_NEGATIVE_TYPECHECK=1`；fixture 删除。
5. **§4c tsc 双入口一致性**：同 fixture → `TSC_EXIT_NEGATIVE=2`（TS2724 同一行）；删除后 `TSC_EXIT_CLEAN=0`。
6. **§5 消费者路径**：`apps/yjs-server` 上下文 `await import('@nomicore/ws-replication')` → `typeof createHubReplicationEdge = undefined` + 完整导出清单（11 项）。临时脚本删除。
7. **§6 收尾复核**：`packages/ws-replication/test/` 的 issue421 文件数 = 0；`apps/yjs-server/` 的 sa6 临时文件数 = 0；`git status --porcelain` 仅 SA6 资产 + Host 简报。

## 15. Unknowns and blockers

1. **SD-1~SD-6 未裁决**（§12.7）：公共工厂装配形态（SD-1）是本票设计的核心分叉，直接影响 EF/OAP 条目的测试写法；断言面已按行为定义，故**不阻塞**契约成立，但 SA8/SA2 必须在设计中显式落定。特别地：简报文本（工厂自带 accept 双入口 + `resolveSessionSink`）与 T2 已合并内部形态（构造期 `sessionFactory`、pre-verified 身份）之间的差异**需要设计裁决**——两者可共存（公共出面 = T2 内部半边的宿主化包装），但若设计选择「重构 T2 工厂签名」，则 #418 的 C0a/C0b 结构测试与 `hub-split.ts` 缝契约将同步返工，须在设计/冲突报告中明示影响面。
2. **SA8 固定产物缺失**：`task_issue-421_design.md` / `_design_conflict_report.md` / `_relevant_decisions.md` 均不存在；本契约由简报 + ADR + 协议 + T1/T2 冻结事实 + 源码实测推导。若 SA8 后续给出不同命名/文件划分，EF/OAP/RK/ER/WS/LC/GATE 条目与变异矩阵应原样保留。
3. **spec #415 全文不在库**：PR #416 未合并，`spec/415-replication-transport-decoupling` 分支不可读；简报「What to build」是 T4 的唯一规范文本。故 T4 与 T2/T5 的边界取自 #418 设计 §654 Follow-up 行 + ADR 后果节。
4. **`resolveSessionSink` 的跨 worker 语义未建模**：本契约只锁 **连接级半边可观察行为**（宿主回调调用时机/参数/失败分类）；跨线程传输形态、入站缝形态、`openAdmission` 拉取形态是否保留，属 #418 design §654 明示的「重新过 SA8」范围（T5/后续）。本契约的 OAP-C4/C8 不预设跨线程实现。
5. **ERROR mini-decode 的实现形态未被断言**：ER 组锁「路由目标正确 + 连接级不路由 + 预算见证（≤64 字节）」；是否真的实现「定偏移扫描 vs 全解码后取值」不作断言（行为等价即可）。若 SA8 要求显式 mini-decode 结构证据，需在设计中追加（不得以源码字符串断言代替行为验证）。
6. **并发 OPEN 上界的默认值未定**：SD-2/SD-3 未裁决前，契约测试须以**显式小上界**驱动（避免依赖缺省值）；缺省值需在设计中登记并说明内存上界推导。
7. **observer 事件面**：新增解析/收口路径的 observer 事件选择（是否复用 `connection-failed`）未在简报中给出；本契约只要求「复用既有稳定码、零新码」，事件细节留给设计（不阻塞）。
8. **`channels` 只读投影在宿主解析形态下的语义**：T2 的 `channels` 是进程内组合成员（`hub-split.ts:121-126`），worker 形态若无法提供同形投影，#418 的白盒锚（既有测试 `hub.connections[0].channels.get(nsId)`）需要设计给出替代观测面——本契约的 EF-C2 把它列为句柄面成员，若设计判定不可提供，须显式裁决并同步 #418 既有测试。

## 16. Temporary diagnostics cleanup

| 临时物 | 处置 | 复核证据 |
|---|---|---|
| 发现性占位测试 `packages/ws-replication/test/ws-replication-issue421-ac.test.ts` | 运行后立即删除；**该路径留给实现票** | §14 §6：`issue421 test files: 0` |
| 负向 test-d fixture `packages/ws-replication/test/ws-replication-issue421-api.test-d.ts` | 两次运行后删除；`TSC_EXIT_CLEAN=0` 复核 | §14 §4c/§6 |
| 消费者路径探针 `apps/yjs-server/.sa6-421-consumer-probe.mts` | 运行后删除 | §14 §6：sa6 临时文件 0 |
| 变异副本 `.scratch/sa6-421/mutants/*`（含 `node_modules` symlink） | 驱动内每变异运行后删除，并在收尾删除 SA6 scratch 根 | `rm -rf .scratch/sa6-421` 后 `ls .scratch/` 仅剩仓内既有 `vfsl-v1-parser` |
| `.scratch/sa6-421/{smoke.mts,tsc-negative.log,tsc-clean.log}` | 整目录删除 | 同上 |
| 生产源码临时改动 | **从未发生**：变异只在副本上进行 | `git diff -- packages/` 为空（收尾实测） |
| 保留的诊断/契约资产（非临时） | `wiki/raw/task_issue-421_sa6_capability_probe.mts`、`wiki/raw/task_issue-421_sa6_mutation_driver.mts`、`artifacts/sa6-issue421-*.log`（4 份）、本报告 | §17 登记 |
| 工作树状态（收尾） | `git status --porcelain` = Host 简报 + 上述 SA6 资产；无其他脏文件 | 收尾实测 |

## 17. 证据与可复现清单

| 资产 | sha256（截断见括号） | 说明 |
|---|---|---|
| `wiki/raw/task_issue-421_sa6_capability_probe.mts` | `e773b72435e85bc1…` | 探针：G1–G7（能力缺口）+ O1–O8/NC1–NC4（目标语义 oracle 与负控）；`SA6_EDGE_SRC`/`SA6_EXPECT_FAIL` 供变异运行 |
| `wiki/raw/task_issue-421_sa6_mutation_driver.mts` | `37600d2ab345f65c…` | 7 变异（M1–M5/NM1/NM2）敏感性驱动，自建副本、自清理 |
| `artifacts/sa6-issue421-probe-green.log` | `cdd504aad08de66a…` | 探针 5 轮全绿（gaps=7/7、oracle+nc=15/15，逐行一致） |
| `artifacts/sa6-issue421-mutation-sensitivity.log` | `9d9c7cce14722676…` | 变异矩阵 2 轮 `MUTATION_RESULT 7/7 expected`（失败集逐项相等） |
| `artifacts/sa6-issue421-runner-trigger.log` | `90ce87e9af7bbead…` | §1 基线 / §2 发现性 / §3 占位参与 / §4 类型层红 / §4c tsc 双入口 / §5 消费者路径 / §6 收尾 |
| `artifacts/sa6-issue421-structural-evidence.log` | `ed7c82675b4cc0cb…` | 结构性补充证据（连接级 INTERNAL_ERROR 零发射点、edge 配置面、public/testing 面、limits 键） |

复现命令（本 worktree，依赖已离线安装）：

```bash
# 1) 探针（期望 gaps=7/7 oracle+nc=15/15，exit 0）
NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-421_sa6_capability_probe.mts
# 2) 变异敏感性（期望 MUTATION_RESULT 7/7 expected，exit 0）
NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-421_sa6_mutation_driver.mts
# 3) 门禁基线（期望 77 文件/588 测试/0 类型错误）
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/ws-replication
# 4) 包类型检查（期望 exit 0）
pnpm exec tsc -p packages/ws-replication/tsconfig.json
```

**结论**：能力缺口可证据化（7/7 运行期实测 + 类型层/消费者路径双观察面）、契约可执行（EF/OAP/RK/ER/WS/LC/GATE 均有可观察断言 + 负控 + 旧/目标期望）、断言敏感（7 变异 2 轮逐项命中，中性变异全绿）、测试入口真实（发现性 + 类型层红实测）。提交 `approve`。
