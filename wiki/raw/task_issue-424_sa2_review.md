# task_issue-424 SA2 设计攻击评审（Wallfacer）— 分片形态端到端等价性验收（spec #415 T7）

- 被审对象：`wiki/raw/task_issue-424_design.md`（SA1，**迭代 1**，642 行全文逐条；本轮为 F-R1 修订后的复审）
- 评审人立场：独立攻击设计；不替 SA1 修订设计、不实现、不运行测试、不启动服务
- Worktree / HEAD：`/home/wangjian/nomicore-fix-issue-424` / `cab3e8c245ef189da1d823719370a68459939316`（与设计 §0、SA6 §1、SA8 两报告一致，亲验）；`git status` 仅 `wiki/raw/task_issue-424*` 与 `artifacts/sa6-issue424-*.log`（生产/测试源码零触碰，亲验）
- 评审日期基线：Issue updated at 2026-09-22T00:33:11Z；Issue 评论 REST 快照 = `[]`（dispatch 明示）
- 评审谱系：迭代 0 评审（本文件前一版）verdict=`reject`（1 MAJOR：F-R1）+ 非阻断 N1–N7；SA1 据此修订为迭代 1（§14 修订映射）；本轮独立复审修订质量

---

## 1. Reviewed inputs

| 输入 | 位置 | 状态 |
|---|---|---|
| 任务简报 | `wiki/raw/task_issue-424.md`（AC1–AC6） | 全读 |
| SA6 验收契约 | `wiki/raw/task_issue-424_sa6_contract.md`（approve，340 行） | 全读（本轮重读，重点 §10/§12.0–12.7 与 F-R1 修订面的相容性） |
| SA6 探针 | `wiki/raw/task_issue-424_sa6_capability_probe.mts`（1186 行） | 全读；本轮重点复核 O8 装配段（L961–1003）与 facade/host 实现（L355–593）——F-R1 修订的运行期依据 |
| SA1 设计（被审对象） | `wiki/raw/task_issue-424_design.md`（迭代 1，642 行） | 全读；逐条核对 §0/§2.1/§5/§8.1/§8.3/§8.4/§10/§12.0/§13/§14 的 F-R1 修订落点 |
| SA8 前置门禁 | `wiki/raw/task_issue-424_conflict_report.md`（clear、requiresConflictRecheck=true） | 全读（§3 SD 边界 / §8 / §10） |
| SA8 相关决策摘录 | `wiki/raw/task_issue-424_relevant_decisions.md` | 全读 |
| SA8 设计复审 | `wiki/raw/task_issue-424_design_conflict_report.md`（clear；§8-2 两处行锚精度修正） | 全读；本轮核对其 §8-2 行锚要求是否已回写设计 |
| 生产源码 | `packages/ws-replication/src/{hub-edge-host,hub-edge,hub-session-host,hub-connection,types,index,defaults}.ts` | 逐点亲验（见 §6/§9 各表；本轮新增核验 `types.ts:145-159 HubReplicationOptions`、`types.ts:1009-1014 Resolved* 空扩展`、`defaults.ts:16-69`、`hub-session-host.ts:30-89/238-263`、`hub-edge-host.ts:196-238/385-459/505-530/555-575/745-752/860-962`、`hub-edge.ts:222-241/395-402`） |
| 测试基建 | `packages/ws-replication/test/{harness.ts,driver.ts,issue420-shim-hub.ts}` | 逐点亲验（本轮重点：`driver.ts:180-214 BootOptions`/`217 Run.hubNode`/`409-470 writeHub·doc·bumpHubEpoch`/`489-549 boot 装配`/`600-646 advanceMs·collectUnhandledRejections`；`harness.ts:43-84 CONTRACT_* 旧形`/`160-181 常量`/`249-268 settle`/`488-534 ReplicaNode·makeNode·makeHubNamespace`） |
| Runner/配置 | `vitest.config.ts`、`packages/ws-replication/{tsconfig.json,package.json}` | 亲验（include/alias/maxWorkers:1、`test/**/*.ts` 入包 typecheck） |
| 决策基准 | `docs/adr/0032`、`docs/protocols/instance-replication-v1.md` §3/§5/§6/§12/§13/§17/§21/§22/§23.1、根 `CONTEXT.md` L205–236 | 抽验；本轮亲验 §12 L370-377（CLOSE_OK.ackedSequence = **L375**）、§13.2 L419-430（REOPEN→closed = **L424**；UNAUTHORIZED→failed = **L425**）、§22 三层断言段——设计回写后的行锚逐行属实 |
| SA6 运行日志 | `artifacts/sa6-issue424-*.log`（4 份） | 存在性亲验（`git status`） |

无缺失输入：SA6/SA8/SA8-recheck 三份固定产物齐备，F-R1 修订的每一处声明都有可核证据，评审可完整判断设计安全性。

---

## 2. Verdict

**`approve`** —— 迭代 0 唯一 MAJOR（F-R1：boot 形态 ROUND 套件装配路径不闭合）**已解决并经本轮独立验证关闭**；非阻断观察 N1–N7 全部被吸收（逐条核验见 §6-N 表）；修订未引入新的 BLOCKER/MAJOR；需求、上游事实、SA8 约束、状态机、错误恢复、调用方、架构一致性、文件范围与验收设计均足以安全实施。

F-R1 关闭的独立验证（要点，全链见 §6「F-R1 复核」与 §12）：

1. **签名使错位装配不可表达**（修订强于评审要求的下限）：`ShardedFacadeOptions.registry` 必填、facade 无 route 参数、迭代 0 路由形态 facade 被删除且给出理由（第二入口可被遗忘绕过）；设计文本中路由形态仅存于 §14 修订映射的历史记述，无残留活引用（全文 grep 亲验）。
2. **adopt 装配与源码事实吻合**：`boot` 恒传 `{instanceId: HUB_INSTANCE, registry: hubNode.registry, timer: hubNode.scheduler, verifyToken: wrappedVerifier, …}`（driver.ts:516-526 亲验）；`HubReplicationOptions`（types.ts:145-159）结构可赋 `ShardedFacadeOptions`（registry/authorize/timer 必填齐备、verifyToken 必填→可选兼容）——`(options) => makeShardedReplicationFacade(options).replication` 作为 `createHub` 注入按图施工 typecheck 可过。
3. **hub 侧观察面同源**：`writeHub`/`snapshotDoc('hub')`/`rootValue`/`bumpHubEpoch` 全绑 boot `hubNode`（driver.ts:409-470 亲验）；adopt 后复制会话驱动同一 registry 的文档 ⟹ ROUND-C1 收敛与 ROUND-C2 hub→peer UPDATE 可绿——这正是探针 O8 唯一 green 装配（probe L971-1003，worker 建于 `options.registry`/`options.timer`，L979-984 亲验），O8 已实测 OPEN_OK/BOOTSTRAP/SYNC/live/双向 UPDATE+ACK/CLOSE_OK/settled/收敛全绿 ×3。
4. **可观察兜底成立**：`Run.hubNode` 公有只读（driver.ts:217），`sharded.worker.registry === run.hubNode.registry`（`AdoptedWorker.registry = options.registry` = 同一对象引用）前提断言可表达且在默认 boot（无 `wrapHubRegistry`）下恒真（driver.ts:518 亲验）。
5. **约束正文明文**：§8.3.1 全文（约束 + 四点依据链 + 失败模式分析）、§8.4 R7/R8、§12.0「ROUND 装配前提」断言行、夹具头注要求——评审要求的三处落点齐备。

N1–N7 吸收验证：N1 行锚 L375/L425 已回写（本轮对协议原文逐行亲验正确）；N2 `DEFAULT_REPLICATION_LIMITS/TIMEOUTS` 选型依据成立（`ResolvedLimits` 空扩展 types.ts:1009、`CONTRACT_LIMITS` 确缺 5 个分块字段 harness.ts:43-55 亲验）；N3 GATE-C3 双段证据命令入 §12.6；N4 同工厂双连接构图要求入 SEQ-C1 判据；N5 `advanceMs` 只推 peer scheduler（driver.ts:618-621 亲验）已在 §7.7/§9 按侧精确化；N6/N7 登记佐证。

---

## 3. 需求覆盖

| Requirement（简报 AC） | Design section | Assessment |
|---|---|---|
| AC1 四态授权等价矩阵逐帧一致（pass/deny/throw/闩锁重 OPEN） | §7.2（三层硬门）、§8.1（runMonolithTrace/runShardTrace/parityOf）、§12.0 AUTH-C1~C5 | 覆盖。判据与 SA6 §12.1 逐条对应；L1 白名单 = 契约五种控制帧、L2 = 四种数据帧；负控 AUTH-C5(a)(b)(c) 保留；pipe 形态不经 boot——不受 F-R1 影响 |
| AC2 跨缝完整协议回合（含 UPDATE_CHUNK 协商/非协商两形态） | §8.3（boot 形态约束 + adopt 装配）、§8.4 R7/R8、§12.0 ROUND-C1~C4 + 「ROUND 装配前提」行、§7.5（SD-4 最小读法） | **覆盖且装配路径闭合**（F-R1 关闭）：ROUND-C1/C2 的 hub 侧观察（`run.writeHub`/`snapshotDoc('hub')`）经 adopt 装配与复制会话同源（O8 实测同款）；每形态 boot 后引用同一性前提断言 |
| AC3 一条连接多 ns 多 host：demux/mux + 出站序严格递增 | §8.2 投影、§8.4 R4、§12.0 SHARD-C1~C3 + SEQ-C1 | 覆盖（pipe 驱动、不经 boot；route 返回类型放宽为最小面 `RoutableWorker` 不改变路由语义） |
| AC4 连接终结传播 + 无泄漏 | §8.4 R6、§9、§12.0 TERM-C1~C3 | 覆盖；TERM-C2 按形态分写观察面（pipe = `ShardedWorker.scheduler.pending()`；boot = `run.hubNode.scheduler.pending()`，与被采纳 timer 同一对象）——N5 吸收后可执行性更精确 |
| AC5 revoke/reauth 经 edge 路由 + wire 与单体一致 | §8.3.3 facade revoke/requestReauth、§8.4 R5/R6、§12.0 REVOKE-C1~C3 + REAUTH-C1~C2 | 覆盖（末帧 L1 逐字节判据、跨 worker 零外溢、drain 提前完成 + 阴性对照；facade revoke 语义与探针实现同构） |
| AC6 全量套件 + 根 typecheck/test 绿灯 | §11、§12.6（GATE-C1~C3 命令） | 覆盖；GATE-C3 双段证据命令覆盖全 DENY 面（N3 吸收） |
| 「内存管道 + 一条连接、多 namespace、多会话宿主」拓扑 | §7.0 D-A、§8.1 | 覆盖（进程内内存管道为载体抽象；worker_threads 备选显式否决，合 ADR 0032 L18） |
| 「证明 ADR 0032 语义等价承诺」 | §2.2 O1–O10 承接表、§6、§12 全组 | 覆盖（等价性 = wire 面 + 状态机行为，observer 面按 H8 排除——正确） |

目标/非目标无静默扩大：F-R1 修订全部落在既有 ALLOW 文件的装配设计内（§11 明示「本轮零范围变化」，亲验属实）；新增非目标「夹具不提供 limits/timeouts 覆盖面」（N2 吸收的对称面）不缩小任何契约条目。

## 4. Owner评论覆盖

Issue 评论 REST 快照 = `[]`（dispatch 明示，SA6 §2/SA8 前置 §4/SA8 设计复审 §1 三方同款结论）——**无 Owner 评论要求、无评论 id/updated_at 可映射、不存在被忽略的 Owner override**。设计 §4 表述与快照一致。✔

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| SA6 G1–G4（验收装配/证据缺位，非生产缺陷） | §3 缺口链逐项响应；交付 = test-only 五文件 | 一致；Feature/收官验收定性正确（SA6 §11-H9） |
| SA6 oracle O1–O10 + NC1–NC4（HEAD 实测 14/14） | §2.2 承接表逐条映射（O8 行增补「唯一 green boot 装配 = worker 采纳 boot registry」事实） | 一致；O8 行的增补与探针 L971-1003 逐行吻合（本轮亲验） |
| 红臂 5/5（断言敏感性） | §7.8：变异开关不进交付套件，敏感性由负控 + 保留探针/日志承载 | 合规（SA6 §12.7 同款义务；探针与日志列 DENY 保留件 ✔） |
| O7：全轨迹逐字节连单体自身不成立（clientID） | §7.2 三层硬门 + AUTH-C5(a) 负控 | 正确套用协议 §22 纪律；未放宽未加严 |
| O10：登记缺失 → 连接级 INTERNAL_ERROR + 1011 + 零会话 | §7.3 SD-2(b) 冻结为退化路径 + lifecycle 负控 | 与源码亲验一致（`hub-edge-host.ts:442-451` `runResolveInner` catch → `connectionFatal('INTERNAL_ERROR', 1011)`） |
| **O8 boot 装配形态唯一性（F-R1 的运行期依据）** | §2.2 O8 行、§5 表新增行、§8.3.1 依据链第 4 点、§8.1/§8.3.2 结构化采纳 | **一致且已核验**：probe L971-1003 唯一 green 装配 = `makeSessionHost(options.registry, options.timer)`（L979-984）；迭代 1 的 `AdoptedWorker` 构造与之同构 |
| SD-3 撞键（探针开发期实测重复开启拒绝） | §7.4 每场景一工厂；守卫靠 `hub-session-host.ts:248-253` 响亮拒绝 | 边界内（`open()` 重复 `(connectionKey, namespaceId)` throw 亲验于 L243-253）；facade adopt 模式下每 facade 恰一内部工厂 + 恰一 session host，跨 boot 场景各自新建 hubNode/工厂——键空间不交叉 |
| SA8 前置门禁 §8-1：显式裁决 SD-1~SD-4 | §7.1/§7.3/§7.4/§7.5 + §7.6 核对表 | 四项裁决逐条落在 adjudication 内（迭代 0 经 SA8 设计复审核 clear；**迭代 1 未改任何裁决**，§6 明示） |
| SA8 §8-2：硬门纪律不得放宽/加严 | §7.2 枚举白名单（黑名单→白名单） | 帧种类划分与 SA6 §12.1 完全一致；白名单对契约语料行为等价、对新 kind 保守落 L3——非放宽非加严 ✔ |
| SA8 设计复审 §8-2：两处行锚精度（CLOSE_OK → §12 **L375**；UNAUTHORIZED→failed → §13.2 **L425**） | §12.0 AUTH-C2 行（L425）、ROUND-C3 行（L375）、§12.1 引用组（L424=REOPEN/L425=UNAUTHORIZED 注明） | **已回写（N1 关闭）**：本轮对协议原文 sed 逐行亲验——L375 = `ackedSequence | varUint | CLOSE_NAMESPACE sequence`、L424/L425 = REOPEN→closed / UNAUTHORIZED→failed，全部正确 |
| SA8 两报告 requiresConflictRecheck=true | 设计 §15 同向声明（true）+ 理由（含迭代 1 修订增量主动交 §8-4 复核） | 一致且诚实（删除路由形态 facade 作为第三处裁量显式登记交复审——比静默修订更好） |
| ADR 0032 决策 1–5 + A1–A3 + 协议条款 | §6 逐行映射表（含条款行锚） | 抽验行锚属实（决策 1-5/A1-A3/后果冻结 + 协议 §3/§5/§6.1/§6.3/§7.1/§12/§13.1/§13.2/§21/§22/§23.1） |
| 模块 AGENTS 测试纪律（注入 seam、真实入口、无 skip/only、验证门） | §7.7/§7.8/§9/§12.6 | 逐句对应 ✔ |

## 6. 设计内部一致性

逐项检查正文/伪代码/接口/投影表/数据流/调用方矩阵/ALLOW-DENY/验收映射/风险结论：

| 检查点 | 结论 |
|---|---|
| **F-R1 修订落点自洽**（§0/§2.1/§5/§8.1/§8.3/§8.4/§10/§12.0/§13/§14 十处） | **一致**：§0 迭代声明、§2.1「boot 观察面绑定」证据行（driver.ts:409-470/498-526 逐锚亲验属实）、§5 上游事实新行、§8.1 adopt 签名、§8.3 三小节、§8.4 R2/R3/R7/R8、§10 boot 缝行、§12.0 前提断言行、§13 风险行关闭、§14 映射——各处对「registry ≡ run.hubNode.registry、timer ≡ hubNode.scheduler」的表述逐字同向，无前后矛盾 |
| 路由形态 facade 残留检查 | 全文 grep：迭代 0 路由形态仅出现在 §14 修订映射的历史记述与 §8.1 变更说明 2 的删除理由中，无任何活引用/活签名残留 ✔ |
| §8.2 投影表 vs 生产接口 | 逐成员与 `hub-edge-host.ts:91-149`/`hub-session-host.ts:55-89` 吻合（`openNamespace` 不带 wire 序、`onFrame` 回传被分配序、信号二态、resolver 三分返回）；与探针桥（probe L425-496）逐行同构；route 返回 `RoutableWorker`（桥只消费 index/host）与投影表一致 ✔ |
| §8.3.3 facade 成员表 vs `HubReplication`（types.ts:161-180） | accept/acceptTrusted?/connections/revoke/requestReauth/close 全覆盖；`HubReplicationEdgeConnection` 结构满足 `HubConnection`；与探针 facade（probe L548-591）同构 ✔ |
| §8.3.2 构造序类型可行性 | `HubReplicationOptions`（types.ts:145-159）→ `ShardedFacadeOptions` 结构可赋（registry/authorize/timer 必填互恰、verifyToken 必填→可选兼容）；boot 注入形态 `(options) => makeShardedReplicationFacade(options).replication` typecheck 可过（返回 `HubReplication`）✔ |
| §2.1 源码锚点（≥25 处，含新增 boot 绑定行） | 亲验全部属实（本轮新增：types.ts:1009-1014 空扩展、defaults.ts:16-69、hub-session-host.ts:44-52/243-263、hub-edge-host.ts:749-752 计数器初值、driver.ts:217/409-470/512-526/535/618-621、harness.ts:43-84/129-157/168-181/488-534）✔ |
| §7.3 微任务深度论证 | 成立（迭代 0 已逐跳验证；本轮复核关键锚：authorize 恒经 `Promise.resolve(...).then`（hub-edge.ts:399-400）+ `settleAdmission` await 续体（hub-edge-host.ts:405-435）⟹ resolver ≥2 跳；登记在 accept 返回后 ≤1 跳且队列序在前；no-sink 重 OPEN 0 跳细分（L345 `runResolve` + L396-398）已在 §7.3-4 登记）✔ |
| §12.0 判据表 vs SA6 §12.1–12.5 | 逐条对应；新增「ROUND 装配前提」行为**设计追加断言**（不削弱任何契约条目——与 SA8 对 SD-2(b) 追加负控的同款认定一致）；行锚 L375/L425 已按 SA8 §8-2 回写（本轮对协议原文亲验正确）✔ |
| §11 ALLOW/DENY vs §12 落点 | 一致（5 文件 + artifacts/issue424-* + wiki/raw/task_issue-424_*；SA6 证据保留件；「本轮零范围变化」亲验属实——修订全部在既有 ALLOW 文件的装配设计内）✔ |
| §13 风险表 vs 正文 | 一致；F-R1 风险行以删除线 + 「已关闭（迭代 1）」+ 三重关闭机制登记（签名不可表达 / 前提断言前置红 / 正文明文）——与正文实际落点相符，非伪关闭 ✔ |
| §14 修订映射 | 对 F-R1 与 N1–N7 的处置逐条如实（含对 SA2 建议第一分支「不采用」的理由陈述——理由成立：独立导出会成为可被遗忘绕过的第二入口，而必填 registry + 删除 route 是更强关闭）✔ |

### F-R1 复核（本轮核心）

| 验证维度 | 结果 |
|---|---|
| 评审要求的修订分支 2（facade 在 registry 在场时内建单 worker）是否落实 | ✔ 落实且加严：registry **必填**（非「在场时」）、route 参数**删除**（错位装配在夹具签名面不可表达，强于「忽略外部 route」） |
| ROUND-C1~C4 在所述观察面上按图施工可绿 | ✔ adopt 装配 = O8 唯一 green 形态的结构化（O8 实测：OPEN_OK×1/BOOTSTRAP×1/BOOTSTRAP_ACK 回指/SYNC_STEP1-2-APPLIED/live/双向 UPDATE+ACK/`writeHub`→hub→peer UPDATE/CLOSE_OK/settled/收敛 `encodeStateAsUpdate` 相等/timer 零泄漏/零 unhandled——即 ROUND-C1/C2/C3 + TERM-C2 boot 面的全量前证）；ROUND-C4 协商形态 = 同装配 + `chunkedUpdate:true`（NC4 已证协商位 parity 与描述子携带） |
| boot 形态装配约束在正文有明文 | ✔ §8.3.1 约束全文 + 四点依据链（源码锚点逐点亲验属实）+ 失败模式分析（伪偏差→SD-1 误触路径已被 §7.1 前置甄别关闭——E7 处置落地） |
| 无新增生产/公共面触碰 | ✔ §11 零范围变化；facade 只消费 `options.registry`/`options.timer`/`options.verifyToken`/`options.authorize`，不新增任何公共成员 |
| 接受条件全部满足 | **F-R1 关闭** |

## 7. 状态机与并发攻击

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| SC1 | 新连接（未登记） | 对端抢发 HELLO+OPEN 同批（构造尾部同步重放，hub-edge.ts:228-232 亲验） | 登记恒先于 resolveSessionSink；若登记缺失 → 连接级 INTERNAL_ERROR + 1011 + 零会话（O10） | 无缺口：微任务论证经逐跳验证成立；SD-2(b) 负控冻结退化路径 | 无 |
| SC2 | no-sink 终态记录 | no-sink 后重 OPEN | 缓存 grant 重解析（`runResolve` 0 跳，hub-edge-host.ts:345/396-398 亲验）且 authorize 不重复 | 无缺口：该路径仅在首个 OPEN 已固定登记状态后可达；§7.3-4 已登记该细分 | 无 |
| SC3 | 同工厂多连接 | 第二次 acceptTrusted | connectionKey `-conn-1` 互异（计数器 `connectionCounter` 初值 0，hub-edge-host.ts:749-752 亲验）；出站序 per-connection 从 1 重起算 | 无缺口；SEQ-C1 已含同工厂双 pipe 双连接构图要求（N4 吸收） | 无 |
| SC4 | 跨工厂共享 SessionHost | 误用：两工厂同键路由进同一 host 同 ns | `open()` 重复键响亮 throw（hub-session-host.ts:243-253 亲验） | 无缺口 | 无 |
| SC5 | pending 期 | 并发重 OPEN / 在途帧 | 合流入缓冲（准入台账五态 pending/denied/failed/established/no-sink，hub-edge-host.ts:196-238 亲验） | 无缺口：全部为生产 edge 职责，harness 不复制 | 无 |
| SC6 | deny/throw 终态闩锁 | 闩锁期重 OPEN | 恰一帧 `NAMESPACE_REOPEN_REQUIRES_RECONNECT`，authorize 不重复 | 无缺口（AUTH-C4） | 无 |
| SC7 | 连接收口后 | 迟归 resolver/迟归结算 | 归一卫生通知 + 缓冲丢弃，零 wire 零事件（hub-edge-host.ts:453-457/555-569 `finishTerminalSilently` 亲验） | 无缺口 | 无 |
| SC8 | drain 窗口 | CLOSE_NAMESPACE → settled 过缝 | drain 提前完成 close(1001)，deadline 不 fire | 无缺口（REAUTH-C1 假 scheduler 零推进判据） | 无 |
| SC9（新增，F-R1 修订面） | ROUND 套件 boot 装配 | 实现者误把会话路由到自建 registry worker（迭代 0 的错位形态） | 错位**不可表达**（facade 无 route、registry 必填）；即使绕过签名手工构造，§12.0 前提断言在场景前置即红（错误信息指向装配） | 无缺口：三重关闭（签名/断言/正文）覆盖实现期与维护期两层风险 | 无 |

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| E1 | resolver throw / 返回 undefined 后路由失败 | 连接级 INTERNAL_ERROR + 1011 响亮收口或测试直接红；§9 明令无静默兜底 | 低（源码亲验：`runResolveInner` catch → `connectionFatal('INTERNAL_ERROR', 1011)`） | 无 |
| E2 | route 返回 undefined（pipe 形态） | TypeError → 同 E1 路径响亮 | 低 | 无 |
| E3 | sink 同步 throw（openNamespace/namespaceFrame） | 投递点防御 catch → `connectionFatal('INTERNAL_ERROR', 1011)`（hub-edge-host.ts:509-524 `deliverOpen`/`deliverFrame` 亲验） | 低 | 无 |
| E4 | onConnectionClosed/terminateUnauthorized reject | 适配器归一（`Promise.resolve(...).catch(() => undefined)`，亲验）；close/revoke 幂等 | 低 | 无 |
| E5 | 信号/observer 监听 throw | 隔离；不改变协议状态 | 低 | 无 |
| E6 | 套件暴露真实生产偏差 | SD-1 停手协议：保留现场 → 分类上报；**迭代 1 增补前置甄别**：ROUND 红灯先核 §12.2 装配前提断言（已过）再分类 | 低（E7 的伪偏差路径被双重关闭：签名不可表达 + 前提断言） | 无 |
| E7（迭代 0 提出） | ROUND 套件 hub 侧观察错位 | **已处置**：F-R1 修订三重关闭 | 已关闭 | — |

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| `boot({ createHub })` 注入缝（driver.ts:196/516-526） | 无：facade 满足 `HubReplication` 面；**`options.registry`/`options.timer` 被结构性采纳为 AdoptedWorker 的 registry/timer（不再被丢弃）**；`verifyToken`（wrappedVerifier）透传 `factory.accept`（boot dial = token 路径 driver.ts:535）；`instanceId` 不消费但 boot 恒传 `HUB_INSTANCE`（driver.ts:517 硬编码、BootOptions 无覆写项）⟹ 钉死同值安全；`limits/timeouts/observer/clock` 不消费（两半边恒 DEFAULT 同组冻结值）| driver.ts:516-526/180-214 亲验；types.ts:145-159 可赋性亲验 | 无 |
| `createHubSessionHost` 全量 resolved 配置 | §8.3.2 构造序传 `limits: LIMITS, timeouts: TIMEOUTS`（= 公共 DEFAULT 常量；`ResolvedLimits/Timeouts` 空扩展可直接赋，types.ts:1009-1014 亲验） | hub-session-host.ts:44-52 亲验 | 无 |
| `HubReplicationEdgeOptions.limits/timeouts`（可选 Partial） | §8.1 纪律：edge 侧不传 → 工厂内 resolve 缺省 = 同一组 DEFAULT（defaults.ts:61-69 合并模式亲验）⟹ 两半边恒一致 | defaults.ts:61-69 | 无 |
| 既有 455 测试文件 / harness / driver / #420 shim | 仅被 import，零修改；新文件独立命名空间 | §10/§11 | 无 |
| `@nomicore/ws-replication` 公共入口 | 只消费（三工厂 + DEFAULT 两常量 + 公共类型），零变更 | §10/§11；index.ts:5-26/81-99 亲验 | 无 |
| 下游消费者（nomic-server 宿主） | 获得非规范宿主样例；头注登记边界**含 boot 形态 registry 同一性约束**（宿主自建 hub 侧观察面须知同源前提） | §8.1 尾/§10；SA6 §10 | 无 |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| 协议状态机（连接级/namespace 级/准入台账） | 生产 edge/session 半边（ADR 0032 决策 1） | §8.5「全部复用，零新状态机」；harness 只装配 | ✔（adopt 模式只是装配位置变化——被装配对象仍是公共工厂真身，§6 决策 1 行的表述准确） |
| authorize / 拒绝帧 / 准入管线 / drain 门 | edge（决策 3） | §8.2 非目标明列不复制 | ✔ |
| 出站序盖章 | edge mux 单点（决策 2） | §8.2 出站行「原样透传 + 回传返回值，零改写」 | ✔ |
| 连接登记（connectionKey→egress） | 宿主（测试装配态） | §7.3(a) ShardedHost/facade 单点登记权威；facade adopt 形态经 `makeShardedHost(() => worker, …)` 与 pipe 形态**共享同一路径**（§8.3.2-2）——无第二套登记代码 | ✔ |
| boot 形态 hub 文档事实源 | boot `hubNode.registry`（既有 driver 事实） | §8.4 尾「事实源」行：adopt 装配使复制会话与之同源 | ✔（修订消除了迭代 0 的潜在第二事实源——worker 自建 registry 与 boot registry 的分叉） |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| edge↔session 宿主桥（内部缝形态） | `test/issue420-shim-hub.ts`（单 registry + 单 host + 内部 edge 模块，L224-238/688-696 亲验） | 新夹具走公共工厂形态 | 有据分叉 | 被测缝形态不同（内部 vs 公共 byte-seam）；§7.0 A'' 显式否决复用扩展并给理由 ✔ |
| SA6 探针桥/facade | probe `makeShardedHost`/`makeShardedFacade`/`store()` | §8.1/§8.2 是其交付化（去变异开关、增探针面）；**facade 由探针的路由形态改为 adopt 形态**——探针 O8 的用法本就是把「建于 options.registry 的 worker」喂给路由闭包，adopt 形态是把该 O8-only-green 用法结构化为唯一用法 | 一致（分叉有运行期依据：O8 唯一 green 装配） | ✔ |
| 测试运行器/驱动 | `test/driver.ts` boot/createHub 缝、`test/harness.ts` 真 Registry/settle | 复用不 fork（§10 调用方矩阵） | 一致 | ✔ |
| 内存双端 transport | `src/testing.ts` `createMemoryDuplexTransport`、harness `makeWire`、probe `makePipe` | §8.1 `makeRecordingPipe` | 一致 | 无平行通道 ✔ |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| wire 出站序 | edge `OutboundQueue` 盖章单点 | `sinkReturns` 探针只镜像返回值 | 低（零改写；红臂 no-sequence-return 证敏感） |
| 会话生命周期 | session 半边句柄 | `sessions`/`opens` 计数探针 | 低 |
| 连接→egress 映射 | harness 登记表（唯一写点 = accept 返回第一动作） | resolver 只读 | 低（SD-2(a)；facade 与 pipe 共享同一登记实现） |
| HELLO 协商位 | edge `chunkedUpdateNegotiated()` | 描述子 `selectedCapabilities` 由桥按其投影 | 低 |
| **boot 形态 hub 文档** | boot `hubNode.registry` | adopt 装配使复制会话直连该源（无镜像/无副本） | **低（F-R1 修订直接消除分叉面；引用同一性前提断言防回归）** |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| factory.accept/acceptTrusted → 登记 | connection.close()/settle → adapter.close() → 全 established sink onConnectionClosed | 迟归归一 + 缓冲丢弃（生产） | ✔ |
| host.open() → 会话句柄 | handle.close()（幂等同 promise） | reject 归一 | ✔ |
| boot（defer 泵注册）+ facade 进入即建 AdoptedWorker | run.peer.stop + facade.close 幂等 tail + unhandled dispose | — | ✔（O8 teardown 段佐证；AdoptedWorker 无独立资源面——registry/timer 均为 boot 侧既有对象，随 run 生命周期收口） |

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 第二套准入/重试/缓冲 | 生产 edge 准入管线 | §7.3(a) 显式否决 resolver 侧等待/缓冲/重试 | 无平行 ✔ |
| 第二 boot 形态 worker 构造入口（SA2 建议分支 1 的风险） | — | 设计显式**不设**独立 `adoptShardedWorker` 导出，采纳构造只经 facade 单一入口 | 无平行 ✔（理由成立：第二入口可被遗忘绕过） |
| 第二 cleanup worker / 任务状态 / 日志格式 | settle/close 幂等尾 | 复用生产 | 无平行 ✔ |
| 仅服务单票的通用抽象 | — | 夹具限定 424 命名空间 + 头注登记非规范样例 | 可接受（test-only） |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW 5 文件 + `artifacts/issue424-*.log` + `wiki/raw/task_issue-424_*.md` | §11；与 SA6 §12.0 一致；SA6 证据列 DENY 保留件不覆写；「F-R1 修订零范围变化」亲验属实 | 无 |
| DENY 覆盖 src/协议包/registry 包（含 testing seam）/apps/domains/docs/配置/既有测试 | §11；无无理由扩张；正文涉及路径全部在 ALLOW | 无 |
| GATE-C3 双段证据命令（契约原命令 + 全 DENY 面 `git status --short` 空输出） | §12.6；覆盖 `packages/replication-protocol packages/namespace-registry apps domains docs vitest.config.ts` | 无（N3 已吸收；`packages/ws-replication/src` 由第一段 `git diff --stat` 覆盖） |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AUTH-C1~C5 | L1 hex 逐帧 + L3 骨架 + L2 文档语义；负控 (a)(b)(c) | 无（判据可执行、观察面 = wire 原字节/会话计数） | 无 |
| **ROUND 装配前提**（设计追加） | 每形态 boot 后 `sharded.worker.registry === run.hubNode.registry`（引用同一性） | 无：`Run.hubNode` 公有只读（driver.ts:217）、`AdoptedWorker.registry = options.registry` = boot 所传同一对象（driver.ts:518，默认无 wrap 时恒真）；断言在场景前置执行，错误信息指向装配（SD-1 前置甄别） | 无（附注见 §14-O1） |
| ROUND-C1~C4 | boot({createHub: adopt facade}) + 真 peer；`run.*` 观察（全绑 `run.hubNode`，同源性由 adopt 装配 + 前提断言保证） | 无（= O8 唯一 green 装配的结构化；ROUND-C4 两形态各自独立 boot + 前提断言） | 无 |
| SHARD-C1~C3 + SEQ-C1 | pipe 驱动 + probes.opens/resolves + `[8..12]` 原字节；同工厂双连接构图要求入判据 | 无 | 无 |
| TERM-C1~C3 | closeCalls/state/零新出站/scheduler.pending()/collectUnhandledRejections；按形态分写推进面与观察面 | 无 | 无 |
| REVOKE-C1~C3 + REAUTH-C1~C2 | 末帧 L1 逐字节 vs 单体 `hub.revoke`；GOAWAY/drain + 阴性对照 | 无 | 无 |
| SD-2(b) 负控 | 不登记 → HELLO_ACK×1 + 连接级 ERROR（无 namespaceId）+ 1011 + 零会话；经 `host.factory` 直连 accept 构造 | 无（与源码收口路径逐字吻合；`ShardedHost.factory` 公开暴露使该构造可行） | 无 |
| GATE-C1~C3 | 同轮全量 + 双 typecheck + 双段零 diff 证据 | 无 | 无 |
| 红/绿口径 | 红 = 验收缺位（G1–G4）；敏感性由红臂日志 + 负控承载 | 诚实且与 SA6 §12.7 一致 | 无 |

## 13. Required revisions

无。迭代 0 的 F-R1（MAJOR）已解决（验证见 §6「F-R1 复核」）；无新增 BLOCKER/MAJOR。

## 14. Non-blocking observations

| ID | Observation | Evidence | Suggested handling |
|---|---|---|---|
| O1 | 「ROUND 装配前提」断言用**引用同一性**（`===`），强于行为等值：若未来把 ROUND 与 `wrapHubRegistry`（#256 故障注入 seam，driver.ts:518 会包裹传给 createHub 的 registry）组合，断言会红虽然底层文档仍经包装共享。当前 ROUND 测试不使用该 seam，无实际影响 | driver.ts:212/518；§12.0 前提行 | 夹具头注补一句「前提断言假定未包装的 boot registry」；或实现时改为断言 `sharded.worker.registry === (boot 实际传入对象)` 的闭包捕获形态 |
| O2 | §8.1 草图的 import 清单未列 `createRegistryTestScheduler`（`ShardedWorker.scheduler` 类型引用）与 `NamespaceRegistry`/`HubSessionHost`/`DuplexTransport`/`ReplicationTimer` 等类型导入——草图层 omission，公共入口与 `@nomicore/namespace-registry/testing` 均有提供（harness.ts:30 同源先例） | §8.1 代码块 vs index.ts:46-99 类型导出 | 实现票补全 import 面；维持「零深路径 import 生产模块」纪律即可 |
| O3 | facade 不消费 `options.instanceId`（钉死 HUB_INSTANCE）依赖「boot 恒传 HUB_INSTANCE」这一 driver 事实（driver.ts:517 硬编码、BootOptions 无覆写项）——当前安全；若未来 driver 开放 hub instanceId 覆写，钉死与注入将分叉 | driver.ts:180-214/517；§10 | 可在 §10 该行加半句「以 driver 恒传 HUB_INSTANCE 为前提」；非必须 |
| N1–N7（迭代 0） | 全部已吸收：N1 行锚 L375/L425 回写（协议原文亲验正确）；N2 DEFAULT 常量 + CONTRACT_* 缺 5 分块字段理由（harness.ts:43-55/defaults.ts 亲验成立）；N3 双段 GATE-C3；N4 同工厂双连接构图；N5 advanceMs 按侧精确（driver.ts:618-621 亲验）；N6 白名单等价登记；N7 0 跳细分登记 | §14 修订映射 | 已关闭，无需动作 |

---

## 附：证据与可复现

- 本评审全部结论基于静态证据：设计（迭代 1 全文）/契约/探针/SA8 三报告 + 生产源码与测试基建逐点亲验（行锚见各表；本轮重点亲验 driver.ts boot 装配链、types.ts 可赋性、hub-edge-host.ts 准入/解析/防御链、hub-session-host.ts 配置与重复开启、defaults.ts 常量、harness.ts 节点/夹具、探针 O8 段与 facade 实现、协议 L375/L424/L425 行锚、vitest/tsconfig 发现面、git status 零生产触碰）；未运行测试、未启动服务、未修改任何生产/测试/设计文件。
- 唯一可写产物 = 本文件（`wiki/raw/task_issue-424_sa2_review.md`，原位更新以反映迭代 1 设计）。
- verdict：`approve`（F-R1 已解决并独立验证关闭；无 BLOCKER/MAJOR）；`requiresConflictRecheck = false`——本轮无新发现引入新决策面或 ADR 冲突风险；设计 §15 自行声明的 SA8 §8-4 复核义务（针对迭代 1 修订增量：adopt 模式、删除路由形态 facade、新增 AdoptedWorker/RoutableWorker 面）属 SA8 既有义务链的延续，不因本评审而新增。
