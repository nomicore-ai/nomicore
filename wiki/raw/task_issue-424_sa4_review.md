# task_issue-424 SA4 实现静态审查（Red Team）— 分片形态端到端等价性验收（spec #415 T7）

- 被审对象：SA3 迭代 1 实现（test-only：`packages/ws-replication/test/issue424-sharded-hub.ts` + 4 个 `ws-replication-issue424-*.test.ts` + `artifacts/issue424-*.log` ×4 + 本票 wiki 产物）
- 实施设计：`wiki/raw/task_issue-424_design.md`（迭代 1，SA2 复审 `approve`，F-R1 已关闭）
- Worktree / HEAD：`/home/wangjian/nomicore-fix-issue-424` / `cab3e8c245ef189da1d823719370a68459939316`（与 SA6 §1、SA8 两报告、SA2、SA3 一致，亲验）
- dispatch：`sa-79f3dde1-667c-47a8-bb6b-1b1895a58058`（role=mabf-sa4，phase=implementation-review，iteration=0）；Issue 评论 REST 快照为空（`[]`）——无 Owner 评论要求可映射（与 SA6/SA8/SA2/SA1 四方结论一致）
- 审查方式：静态审查（源码/测试/设计/契约/SA8 报告/证据日志/git 状态逐点亲验）；未运行测试、未启动服务、未修改任何实现/测试/设计文件

---

## 1. Reviewed inputs

| 输入 | 位置 | 状态 |
|---|---|---|
| 任务简报 | `wiki/raw/task_issue-424.md`（AC1–AC6，Comments 空） | 全读 |
| SA6 验收契约 | `wiki/raw/task_issue-424_sa6_contract.md`（§12.0–§12.8、负控 NC1–NC4、硬门定义、GATE） | 全读 |
| SA1 批准设计（迭代 1） | `wiki/raw/task_issue-424_design.md`（642 行；重点 §7.2/§7.3/§7.4/§7.5/§8.1–§8.5/§11/§12/§14） | 全读 |
| SA2 设计评审 | `wiki/raw/task_issue-424_sa2_review.md`（approve；F-R1 关闭 + N1–N7 + O1–O3） | 全读 |
| SA3 实现报告 | `wiki/raw/task_issue-424_sa3_impl.md`（Changed paths / SA2 Finding 落实 / D1–D6 deviations / Verification） | 全读 |
| SA8 前置门禁 + 相关决策 + 设计复审 | `task_issue-424_conflict_report.md`、`_relevant_decisions.md`、`_design_conflict_report.md`（含 §8-2①/② 两处精度裁定——D5 处置的直接依据） | 全读/抽验 |
| SA6 探针（保留件） | `wiki/raw/task_issue-424_sa6_capability_probe.mts`（DENY 保留，SA3 未覆写/未重跑——mtime 08:52–08:53 早于 SA3 产物 10:09–10:19，亲验） | 存在性核验 |
| 实现（被审对象） | 5 个新文件（841 + 257 + 212 + 215 + 340 行） | 全读 |
| 生产源码（只读核验） | `src/{types,defaults,hub-edge-host,hub-session-host,index}.ts`（`ResolvedTimeouts` 非空扩展、DEFAULT 常量值、sink/egress/connection 成员、工厂签名、`open()` 重复键 throw） | 逐点亲验 |
| 测试基建（只读核验） | `test/{harness,driver}.ts`（boot 注入缝 L516-526、`Run.hubNode` L217、writeHub/snapshotDoc/rootValue 全绑 hubNode L409-470、`advanceMs` 只推 peer 侧 L618-621、collectUnhandledRejections、makeHubNamespace/StubPersistence/settle 常量） | 逐点亲验 |
| Runner/CI/类型面 | `vitest.config.ts`（include `packages/*/test/**/*.test.ts`、typecheck `.test-d.ts`、maxWorkers 1）、`packages/ws-replication/tsconfig.json`（include `test/**/*.ts`）、`.github/workflows/ci.yml` L44（全量 vitest run） | 亲验 |
| SA3 证据日志 | `artifacts/issue424-{focused-determinism,gate-full-suite,gate-scope,gate-typecheck}.log` | 全读/抽验 |
| git 状态 | `git status --short`（22 条，全部 `??`）+ `git diff --stat HEAD`（空） | 亲验 |

无缺失输入；评审可完整判断实现安全性。

## 2. Verdict

**`approve`** —— 无 BLOCKER、无 MAJOR。实现忠实落实批准设计（迭代 1）与 SA6 验收契约：**adopted-registry boot 约束按 F-R1 修订三重闭合**（签名不可表达错位 / 每形态 boot 后引用同一性前提断言前置 / 头注明文）；契约条目 AUTH-C1~C5、ROUND-C1~C4、SHARD-C1~C3、SEQ-C1、TERM-C1~C3、REVOKE-C1~C3、REAUTH-C1~C2、GATE-C1~C3 与全部负控（NC1–NC4、AUTH-C5(a)(b)(c)、REAUTH-C2、TERM-C3、SD-2(b) 退化负控、ROUND 装配前提）逐条落点且判据无削弱；文件范围严格落在 ALLOW（DENY 面零 diff 零触碰，git 亲验 + SA3 双段日志一致）；SA2 N1–N7/O1–O3 全部落实；D1–D6 六项已登记差异全部为 test-only 增补或 SA8 §8-2① 预制裁定的类型收窄，零验收语义变更。MINOR 观察见 §12（不阻断）。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| AC1 四态授权等价矩阵逐帧一致 | `auth-parity` 7 用例：AUTH-C1（L1 hex 逐帧 + L3 骨架 + L2 文档语义 + authorize 恰一次 + 恰一会话）、C2/C3（全轨迹 hex 逐帧 + 零会话/零解析 + 连接存活）、C4（deny/throw 双形态闩锁恰一帧逐字节等 + authorize 恰一次）、C5(a)(b)(c)、NC2、NC4 | ✔ 全覆盖；硬门定义原文写进头注（契约 §12.1「必须写进测试注释」义务） |
| AC2 跨缝完整协议回合（含 UPDATE_CHUNK 两形态） | `cross-seam-round` 5 用例：ROUND-C1（OPEN_OK×1/BOOTSTRAP×1/BOOTSTRAP_ACK 回指/SYNC 三段/live/`encodeStateAsUpdate` 收敛）、C2（双向 UPDATE+ACK 回指 + ROOT 更新 + 零 resync）、C3（CLOSE_OK 回指 L375 + settled 恰一次经缝）、C4（协商形态全回合复跑 + HELLO_ACK 位 + 描述子位 = SD-4 最小读法）、boot TERM 收尾 | ✔ 全覆盖；协商深度按 SD-4 最小读法（超限分块归既有 #243/#246 资产锚——SA8 §3 SD-4 行认可） |
| AC3 一条连接多 ns 多 host demux/mux + 出站序严格递增 | `multi-worker` 4 用例：SHARD-C1（resolves/opens/sessions 各归其位 + 同 connectionKey）、C2（覆盖两 ns + 每 ns OPEN_OK 恰一 + 协议序）、C3（NC1 合成 `NAMESPACE_STATE_VIOLATION` + 连接存活 + 不落任一 worker + 双形态逐字节等）、SEQ-C1（`[8..12]`=1..N 严格递增 + 注入序 + 同工厂第二连接首帧序=1 + 首连接不受影响） | ✔ 全覆盖；SEQ-C1 采纳 N4 加严构图（同一 ShardedHost 双 pipe 双连接，强于探针 O6 形态） |
| AC4 终结传播 + 无泄漏 | `lifecycle` TERM-C1（closeCalls≥1 ×2 + 推进 30s 零新出站）、TERM-C2（per-worker scheduler pending 不增 + handle.close() 同 promise + 零 unhandled）、TERM-C3（连接隔离负控）；boot 形态面由 cross-seam-round 收尾用例覆盖（`run.hubNode.scheduler.pending()` + facade.close 同 promise + 零新出站） | ✔ 全覆盖（两种形态都落点） |
| AC5 revoke/reauth 经 edge 路由 + wire 与单体一致 | REVOKE-C1（末帧与单体 `hub.revoke` 逐字节等 + terminate 恰一次 + ns ERROR）、C2（跨 worker 零外溢）、C3（未知/已终态幂等）、REAUTH-C1（GOAWAY 恰一帧 + drainTimeoutMs>0 + drain 提前完成 close(1001) + 零推进判据）、REAUTH-C2（阴性对照） | ✔ 全覆盖 |
| AC6 收官门禁 | GATE-C1（459 文件/5584 测试 = 基线 +4 文件/+25 测试，只增 ✓，4 新套件同轮——gate-full-suite.log L393/416/424/560 亲验）、GATE-C2（根 typecheck exit 0 ×2 复跑 + 包 tsc exit 0）、GATE-C3（双段证据 + 全仓 status + 纪律扫描命中 0） | ✔ 证据齐备且与我的独立 git 亲验一致 |
| SA2 F-R1（MAJOR，已由设计关闭） | facade `registry` 必填（`ShardedFacadeOptions.registry` 无 `?`）、无 route 参数、内部恰一个 `AdoptedWorker`（`createSessionHost(options.registry, options.timer)`，issue424-sharded-hub.ts:451-456）；迭代 0 路由形态 facade 未实现；`bootRound()` 每形态 boot 后 `expect(sharded.worker.registry).toBe(run.hubNode.registry)`（cross-seam-round L56-59，场景前置执行） | ✔ 已关闭（三重闭合全部落地；与 driver.ts:516-526/L217 源码事实吻合——boot 恒传 `hubNode.registry`/`hubNode.scheduler`，ROUND 测试未用 `wrapHubRegistry`） |
| SA2 N1 行锚回写 | 4 个套件头注写入 L57/L114/L137/L159/L176/L375/L415/L424/L425/L430/L442/L456-465/L684/L701/L838-845 引用组 | ✔ 已落实（我对协议原文 sed 抽验 L57/L137/L176/L375/L425/L684/L701/L838-845 逐行属实） |
| SA2 N2 instanceId 钉死 + 两半边同组冻结值 | 夹具 L104-110（LIMITS=DEFAULT_REPLICATION_LIMITS；TIMEOUTS 收窄）+ 工厂 `instanceId: HUB_INSTANCE`（L316/L186）；edge 侧不传 limits/timeouts（工厂内 resolve 同组缺省）；未用 harness `CONTRACT_*` | ✔ 已落实（含 D5 收窄，见下） |
| SA2 N3 GATE-C3 双段 | gate-scope.log 段1（契约原命令空）+ 段2（全 DENY 面 status 空）+ 段3（全仓 status 仅 ALLOW 面）+ 段5 纪律扫描 0 | ✔ 已落实 |
| SA2 N4 SEQ-C1 构图 | multi-worker L198-211：同一 host 两次 acceptTrusted、键互异、第二连接首帧序=1、首连接序列不变 | ✔ 已落实 |
| SA2 N5 推进面按侧精确 | pipe 形态直接 `worker.scheduler.advanceBy(30_000)`（lifecycle L112-113/L183）；boot 形态 `run.hubNode.scheduler.pending()` + `advanceMs` 只推 peer 侧（driver.ts:618-621 亲验） | ✔ 已落实 |
| SA2 N7 / O1 / O2 | 夹具头注第 2 条（0 跳 resolver 细分）/第 5 条尾（未包装 registry 假定 + cross-seam 头注 L17）/import 面全自公共入口与 harness（纪律扫描深路径命中 0，亲验 grep exit=1） | ✔ 已落实 |
| Owner 评论 | REST 快照 `[]`——无评论 id/updated_at 可映射；实现与报告一致未引入评论要求 | ✔ 无遗漏面 |
| SD-1 停手协议 | 无 `artifacts/issue424-deviation-*.log`（无偏差现场）；套件未软化任何断言 | ✔ 未触发（全绿无偏差）；前置甄别（ROUND 前提断言）已在位 |
| SD-2(a)/(b)、SD-3、SD-4 | (a) 单点登记权威（`register()` 唯一写点 + resolver 取不到即抛）；(b) 退化负控 1 条（lifecycle 末用例）；SD-3 每场景一工厂 + instanceId 钉死 + D6 每轨迹新建 worker；SD-4 最小读法 | ✔ 四项裁决全部按设计 §7.6 边界落实 |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| §8.1 夹具签名面（ShardedWorker/RoutableWorker/AdoptedWorker/ShardedHost/facade/RecordingPipe/语料与判据助手/两形态轨迹驱动/parityOf） | `issue424-sharded-hub.ts` 全量对应；`ShardedHost` 增补 `accept`（D1，登记权威共享的必要扩面——boot dial = `hub.accept`（driver.ts:535 亲验），facade 不复制登记逻辑 = 无第二写点） | ✔ 忠实；增补面全部有登记与理由 | 无 |
| §8.3.1 boot 形态 registry 同一性约束（F-R1 核心） | 签名闭合（registry 必填、无 route）+ 前提断言（cross-seam L56-59）+ 头注第 5 条（含 wrapHubRegistry 假定——SA8 §8-2② 精度注记落地） | ✔ 三重闭合全部在位；`AdoptedWorker.registry = options.registry` 直引无副本 | 无 |
| §8.3.2 adopt 构造序（进入即建 AdoptedWorker → makeShardedHost(() => worker) 共享桥路径） | L451-461 逐字对应（`createSessionHost(options.registry, options.timer)` → `makeShardedHost(() => worker, config)`） | ✔ 与探针 O8 唯一 green 装配同构 | 无 |
| §8.3.3 facade 成员表（accept/acceptTrusted/connections/revoke/requestReauth/close） | L463-490：revoke 按 authenticatedInstanceId 过滤 + Promise.all 归一；requestReauth → beginReauth；close 幂等 tail（1001 'hub-shutdown'）+ settle 汇流 | ✔ 同构（单体语义镜像）；close 被 ROUND 收尾用例实测（同 promise） | 无（revoke/requestReauth 见 §12-O4） |
| §8.2 宿主桥投影表（四成员投影 + onFrame 回传序零改写 + 信号二态 + resolver→登记→route→open 描述子） | L323-400 逐行对应：OPEN `encodeMessage(message, {sequence: 0})`；非 OPEN 带 wire 序；`sendControlFrame/sendDataFrame` 原样回传返回值；`settled`→`namespaceSettled`、fatal→`connectionFatal`；`selectedCapabilities` 唯一事实源 = `chunkedUpdateNegotiated()`；零应答合成/零缓冲/零重试 | ✔ 忠实（与生产接口 hub-edge-host.ts:91-149 逐成员吻合，亲验） | 无 |
| §7.2 三层硬门（L1/L2 枚举白名单 + L3 骨架；禁 L2 字节断言；observer 不入 parity） | L619-697：CONTROL_KINDS/DATA_KINDS 与设计枚举逐一相同；`framesHexEqual`/`skeletonOf`/`docStateOf`/`parityOf`；auth-parity 头注硬门原文 | ✔ 无放宽无加严（SA8 §8-2 禁令遵守）；AUTH-C5(a) 负控冻结 L2 排除 | 无 |
| §7.4 SD-3 每场景一工厂 + instanceId 钉死 HUB_INSTANCE | 夹具内部构造工厂（L315-321）、`instanceId: HUB_INSTANCE`；每轨迹/每场景新 worker（D6）防撞键——重复键由 `hub-session-host.ts:243-253` 响亮 throw 守卫（亲验） | ✔ 忠实 | 无 |
| §7.7 语料与身份确定性（同源字节脚本 + seeded randomBytes + 虚拟时间） | `HELLO_NONCE` 固定 + `helloFrame/openFrame/closeNsFrame` 一次构造两形态重放；`makeSeededRandomBytes`（16 字节纪律，非 16 即 throw）；`makeAccountingTimer` 记账不触发；测试内 `expect(worker.namespaceId).toBe(scriptNamespaceId(script))` 逐场景锚同源前提 | ✔ 忠实（同 seed 同 ns 身份有逐场景断言防漂移） | 无 |
| §7.8 套件不含变异开关 | 4 套件零 env 读取、零条件跳过（grep 亲验：skip/only/todo/process.env 命中 0；唯一 `setTimeout(` 命中 = 假 timer 接口方法实现） | ✔ 忠实 | 无 |
| §12.0 判据表逐行（含「ROUND 装配前提」设计追加行） | 见 §3 表；每条判据在对应用例中可指认（上文逐条） | ✔ 无削弱；部分用例强于契约（SHARD-C3 附双形态 parity、AUTH-C1 附精确骨架串） | 无 |
| D5 TIMEOUTS 类型收窄 | L109-110：`SessionHostTimeouts = Parameters<typeof createHubSessionHost>[0]['timeouts']`；`DEFAULT_REPLICATION_TIMEOUTS as SessionHostTimeouts` | ✔ **SA8 预裁定的合法选项**：设计复审 §8-2①（本轮亲读）明示「实现票取 TIMEOUTS resolved 形应走 `resolveTimeouts(undefined)`（值 = 同一组冻结值）**或显式类型断言**」——SA3 取后者；我对源码亲验：`ResolvedTimeouts` 确把 ping/pong/assembly 三字段重声明为必填（types.ts:1010-1015），而常量声明类型 `Readonly<ReplicationTimeouts>` 三字段可选（types.ts:73-79）⟹ 裸赋必不过 typecheck；冻结**值**含三字段（defaults.ts:40-52：30000/10000/30000）⟹ 收窄零取值分叉、零 fallback 复制。SA3 的「设计文本精度差」归因成立（设计 §2.1 把 TIMEOUTS 与 LIMITS 并述为空扩展，对 TIMEOUTS 不准确）；放宽常量声明类型归新票（DENY）正确 | 无（MINOR 见 §12-O3） |
| D2/D3/D4 探针面增补（authorizeCalls/handles/Trace.resolves/makeAccountingTimer 导出） | L114-141/L247-260/L709-720 | ✔ 纯观察面增补，契约条目承重（AUTH-C1/C4 分片侧恰一次、TERM-C2 同 promise、SHARD-C1 resolves），无语义变化 | 无 |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| 协议状态机（连接级/namespace 级/准入台账） | 生产 edge/session 半边（ADR 0032 决策 1） | 夹具零自写：桥只投影四成员 + 信号搬运；被装配对象恒为公共工厂真身（`createHubReplicationEdge`/`createHubSessionHost`/真 Registry） | ✔ 无 fork |
| authorize / 拒绝帧 / 准入管线 / drain 门 | edge（决策 3） | 夹具 authorize wrapper 只记录调用序后直 delegation（L318-321），不复制拒绝路径 | ✔ |
| 出站序盖章 | edge mux 单点（决策 2） | 桥 `sendControlFrame/sendDataFrame` 原样透传 + 回传返回值零改写（L370-377） | ✔ |
| 连接→egress 登记 | 测试装配态单点（SD-2(a)） | `register()` 唯一写点（accept/acceptTrusted 返回后第一动作，L403-421）；resolver 只读、取不到即抛；facade 与 pipe 共享同一实现 | ✔ 无第二写点 |
| boot 形态 hub 文档事实源 | boot `hubNode.registry` | adopt 装配直引（无镜像/无副本）+ 前提断言防回归 | ✔ |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| edge↔session 宿主桥 | `test/issue420-shim-hub.ts`（内部 edge 模块 + 单 registry） | 新夹具走公共工厂形态 | 有据分叉 | 设计 §7.0 A'' 显式否决复用（被测缝形态不同；G2 实测旧夹具不可跨 worker 路由） |
| SA6 探针桥/facade | probe `makeShardedHost`/facade/store() | 交付化（去变异开关、增探针面、facade 改 adopt 形态） | 一致 | adopt = 探针 O8 唯一 green 用法的结构化（设计 §14/F-R1 论证） |
| 内存双端 transport | `src/testing.ts` createMemoryDuplexTransport、harness makeWire、probe makePipe | `makeRecordingPipe`（出站记录 + 入站注入 + close info） | 一致 | 断言面需要帧记录与 close 观察；无平行通道语义 |
| 测试驱动 | `driver.ts` boot/`createHub` 缝、`harness.ts` settle | 仅 import 零修改（git 亲验：无任何 tracked 文件修改） | 一致 | DENY 遵守 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| wire 出站序 | edge OutboundQueue | `sinkReturns` 探针只镜像 | 低（零改写） |
| 会话生命周期 | session 半边句柄 | sessions/handles 计数包裹（delegate 原句柄） | 低 |
| 连接登记 | `connections` Map（register 唯一写点） | resolver 只读 | 低 |
| HELLO 协商位 | edge `chunkedUpdateNegotiated()` | 描述子 `selectedCapabilities` 由桥投影 | 低 |
| boot hub 文档 | `run.hubNode.registry` | adopt 直引 + 前提断言 | 低（F-R1 闭合） |
| 两半边限值/超时 | 公共 DEFAULT 冻结常量 | LIMITS 直赋 / TIMEOUTS 同值收窄 / edge 侧工厂 resolve 缺省 | 低（无第二组值；见 §12-O3） |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| accept/acceptTrusted → register | connection.close()/settle → adapter onConnectionClosed → handle.close()（幂等同 promise，TERM-C2 实测） | 迟归归一（生产）；reject 归一（生产适配器） | ✔ |
| host.open() → wrapped handle | handle.close() delegate raw | 幂等 | ✔ |
| boot + facade 进入即建 AdoptedWorker | facade.close() 幂等 tail + run.peer.stop + unhandled dispose（ROUND 收尾实测：pending 不增/零新出站/零 unhandled） | — | ✔ |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 第二套准入/重试/缓冲 | 生产 edge 准入管线 | 无（resolver 取不到即抛；SD-2(b) 负控冻结响亮收口） | 无平行 ✔ |
| 第二 boot worker 构造入口 | facade 单入口 | 无独立 `adoptShardedWorker` 导出（按设计 §14 拒绝第二入口） | 无平行 ✔ |
| 第二 cleanup/日志/状态 | settle/close 幂等尾 | 复用 | 无平行 ✔ |
| 仅服务单票的通用抽象 | — | 夹具限定 424 命名空间 + 头注登记非规范宿主样例 | 可接受（test-only） ✔ |

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/ws-replication/test/issue424-sharded-hub.ts`（新增） | §11 行 1 | T-1 夹具 | ✔ |
| `packages/ws-replication/test/ws-replication-issue424-auth-parity.test.ts` | §11 行 2 | AC1 | ✔ |
| `packages/ws-replication/test/ws-replication-issue424-cross-seam-round.test.ts` | §11 行 3 | AC2 | ✔ |
| `packages/ws-replication/test/ws-replication-issue424-multi-worker.test.ts` | §11 行 4 | AC3 | ✔ |
| `packages/ws-replication/test/ws-replication-issue424-lifecycle.test.ts` | §11 行 5 | AC4/AC5 + SD-2(b) | ✔ |
| `artifacts/issue424-{focused-determinism,gate-full-suite,gate-scope,gate-typecheck}.log` | §11 行 6（`artifacts/issue424-*.log`） | GATE + 确定性证据 | ✔ |
| `wiki/raw/task_issue-424_*.md`（sa3_impl 等） | §11 行 7 | 流水线产物 | ✔ |
| （保留件）`wiki/raw/task_issue-424_sa6_*`、`artifacts/sa6-issue424-*.log` | DENY「保留件不覆写」 | SA6 证据 | ✔ mtime 亲验早于 SA3 产物，未覆写 |

DENY 核验：`git diff --stat HEAD` 空（零 tracked 修改 ⟹ `packages/ws-replication/src/**`、协议包、registry 包、apps、domains、docs、配置、既有 455 测试文件全部零触碰）；`git status --short` 22 条全部为上表 ALLOW/保留件/流水线产物，无 ALLOW 外路径。与 gate-scope.log 三段一致（我的独立亲验复现其结论）。基线只增断言面：455→459 文件、5559→5584 测试，恰为 +4 文件/+25 测试。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| `boot({ createHub })` 注入缝（driver.ts:196/516-526） | facade | `HubReplicationOptions` → `ShardedFacadeOptions` 结构可赋（registry/authorize/timer 必填互恰、verifyToken 必填→可选兼容）；`registry`/`timer` 被结构性采纳（不再丢弃）；`verifyToken` 透传 `factory.accept`（boot dial = token 路径 driver.ts:535 亲验）；`instanceId` 钉死同值安全（boot 硬编码 HUB_INSTANCE，BootOptions 无覆写项，driver.ts:517 亲验） | 低 | 无 |
| `createHubSessionHost` 全量 resolved 配置 | 夹具/worker | LIMITS 直赋（ResolvedLimits 空扩展，types.ts:1009 亲验）；TIMEOUTS 同值收窄（§4-D5） | 低 | 无 |
| `HubNamespaceSessionSink` 四成员 / `HubSessionSinkResolver` 三分返回 | 桥 | 逐成员投影；resolver throw → 生产连接级 INTERNAL_ERROR + 1011（SD-2(b) 负控实测） | 低 | 无 |
| `HubReplicationEdgeConnection.egress` 五成员 | 桥 | 全部消费且返回值零改写 | 低 | 无 |
| `@nomicore/ws-replication` 公共入口 | 夹具 | 只消费（三工厂 + 两 DEFAULT 常量 + 公共类型），零变更 | 低 | 无 |
| 既有 455 测试文件 / harness / driver / #420 shim | 新文件 | 仅 import 零修改；独立命名空间；`registerDeferPump` 等既有 seam 不触碰 | 低 | 无 |
| 下游消费者（宿主样例读者） | 夹具头注 | 「非规范宿主样例」+ SD-2/SD-3/boot 约束边界登记（头注 1–7） | 低 | 无 |
| CI 入口 | `.github/workflows/ci.yml` L44 | 全量 `vitest run`（include 命中新 4 文件）⟹ 新套件被 CI 真实触发 | 低 | 无 |

## 8. 错误、恢复与并发

- **失败语义全继承生产**：桥零新增吞没点（sink 同步 throw → 生产防御 catch → connectionFatal；reject 归一；登记缺失 → 响亮收口并有负控）。夹具 `routeByNamespace` 无命中即 throw（无静默兜底）；`makeSeededRandomBytes` 非 16 字节请求即 throw。
- **无静默 fallback**：boot 装配错位被签名 + 前提断言双重关闭（错位不可表达/可表达即前置红）。
- **幂等实测**：handle.close() 同 promise（TERM-C2）、revoke 未知/已终态幂等（REVOKE-C3）、facade.close 同 promise（ROUND 收尾）。
- **并发**：runner maxWorkers 1；连接隔离（SEQ-C1/TERM-C3 同工厂双连接实测互扰为零）；SD-2(a) 登记时序为微任务深度结构事实（SA2 逐跳验证 + SA8 核可），SD-2(b) 负控守住退化面。
- **时间纪律**：全虚拟（假 timer 记账不触发 + 测试 scheduler + settle/settleUntil）；推进面按侧精确（N5）；唯一 `setTimeout(` 文本命中 = 假 timer 接口实现（非真实定时器）。
- **静态无法确认项**：见 §10（运行期语义以 SA3 同轮日志 + SA6 探针 14/14 为证据，SA4 未复跑）。

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| auth-parity 7 用例 | 四态 parity（L1/L2/L3）+ 负控 (a)(b)(c) + NC2/NC4 + authorize 恰一次 + 零会话/恰一会话 | 根 `pnpm test` / CI ci.yml L44（include 亲验）| 无削弱；(a) 依赖 Yjs clientID 随机性（碰撞 2^-32 时负控**红**——失败方向安全，见 §12-O5） | 无 |
| cross-seam-round 5 用例 | 装配前提断言 + ROUND-C1~C4 + boot TERM 收尾 | 同上 | 无削弱；前提断言在每形态场景前置执行（含协商形态） | 无 |
| multi-worker 4 用例 | SHARD-C1~C3 + SEQ-C1（含 NC1 双形态对照、同工厂双连接） | 同上 | 无削弱；SEQ-C1 断言 `sequences` 恰为 `[1..N]`（强于「严格递增」） | 无 |
| lifecycle 9 用例 | TERM-C1~C3 + REVOKE-C1~C3 + REAUTH-C1~C2 + SD-2(b) | 同上 | 无削弱；`timer.fires()` 为常量 0 的恒真断言（判据实际由「永不触发的 timer 下观察到 close(1001)」承载——判别力成立，见 §12-O1） | 无 |
| 夹具（非 .test.ts） | — | 包 `tsc -p packages/ws-replication`（tsconfig include `test/**/*.ts` 亲验）；GATE-C2 exit 0 | 不入 runner 面 = 设计意图（§8.1） | 无 |

- **SA6 红灯断言保持**：NC1–NC4、AUTH-C5、REAUTH-C2、TERM-C3、SD-2(b) 全部在位（§3 表逐条）；无任何既有断言被修改（git 零 tracked diff）。
- **无 skip/only/todo/env override/源码字符串断言**（grep + 通读亲验）；断言全部读运行时行为（wire 原字节/`[8..12]`/close code+reason/会话计数/描述子 JSON/文档语义/scheduler pending/unhandled）。
- **fixture 隔离与清理**：每用例新建 worker/host/pipe（无跨用例共享可变态）；`collectUnhandledRejections` 在 finally dispose。
- **发现面**：vitest include 同构 + SA6 §14 占位实测 + 本轮 CI 入口亲验；455→459 文件恰增 4。
- **确定性证据**：3 轮聚焦重复逐行一致 + 全量同轮绿（SA3 日志；SA4 未复跑，见 §10）。

## 10. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| SA3 自证门禁的可复现性（SA4 纪律不运行测试） | Controller 路由的动态验证（如 SA7） | 复跑 `NODE_OPTIONS=--conditions=nomicore-source pnpm test` 与 `pnpm typecheck` | 非 459/5584 全绿或 exit ≠ 0 |
| 聚焦套件长时间稳定性（Yjs clientID 随机性、微任务深度假设随 Node 版本演进） | 动态验证多轮重复 | 25/25 恒绿 | 间歇红（尤其 AUTH-C5(a) 负控或 SD-2(b) 时序类用例） |
| `DEFAULT_REPLICATION_TIMEOUTS as SessionHostTimeouts` 收窄在生产类型面演进时的脆弱性 | 后续生产票（放宽常量声明类型，见 §12-O3） | 新票后夹具可去 cast 且 typecheck 绿 | 若生产把三字段语义改掉（非纯声明面），此处需重审 |

## 11. Required revisions

无。未发现 BLOCKER/MAJOR。

## 12. Non-blocking observations

| ID | Observation | Evidence | Suggested handling |
|---|---|---|---|
| O1 | `AccountingTimer.fires()` 返回硬编码 0——REAUTH-C1 中 `expect(timer.fires()).toBe(0)` 是结构性恒真断言，无独立判别力。实际判别力由「timer 永不触发回调（结构事实）+ 观察到 close(1001) ⟹ 只能来自 drain 提前完成」承载，测试仍会在 drain 未提前完成时正确红（hubCloseInfo 为 undefined）。与设计 §9「零 scheduler 推进判据」一致 | issue424-sharded-hub.ts:139；lifecycle L287 | 后续若想让 fires() 成为真观察点，可让 setTimeout 保存 callback 并由 `advanceBy` 显式触发计数；本票无需改 |
| O2 | `docStateOf` 只 apply `BOOTSTRAP_SNAPSHOT.snapshot` 与 `UPDATE/SYNC_STEP2.update`；L2 白名单含 `UPDATE_CHUNK` 但其分块载荷不会被 apply。当前语料（SD-4 最小读法）不产生 UPDATE_CHUNK 帧，判据 inert；若未来扩 chunk 语料需同步扩 judge | issue424-sharded-hub.ts:658-679 | follow-up 扩语料时处理；本票无需改 |
| O3 | D5 的 `as SessionHostTimeouts` 是单点显式断言（SA8 设计复审 §8-2① 预裁定的两个合法选项之一），值同一性经源码亲验（defaults.ts 三字段值在位）。设计 §2.1「常量可直接赋」对 TIMEOUTS 的表述为文本精度差（SA3 已如实登记为 D5）。生产侧放宽 `DEFAULT_REPLICATION_TIMEOUTS` 声明类型（如直接声明为 `ResolvedTimeouts`）可消除该 cast——属 `packages/ws-replication/src` 变更，本票 DENY，正确留给新票 | issue424-sharded-hub.ts:107-110；types.ts:1010-1015；defaults.ts:40-52 | follow-up 新票（SA3 已在 Deferred 4 登记）；非本票阻断 |
| O4 | facade 的 `revoke`/`requestReauth` 服务成员无套件直接驱动（契约 REVOKE-C1/REAUTH-C1 钉在 connection 级 `revokeNamespace`/`beginReauth`——实现与契约一致）；facade `close()` 被 ROUND 收尾实测。facade revoke 底层就是同一 `connection.revokeNamespace` 循环 | issue424-sharded-hub.ts:469-482 | 无需动作（无契约条目要求 facade 级 revoke/reauth 断言）；登记备查 |
| O5 | AUTH-C5(a)「单体 vs 单体全轨迹不等」依赖两次独立 `Y.Doc` 的 clientID 随机不碰撞（≈2^-32）。碰撞时该负控会**红**（失败方向安全，不会假绿） | auth-parity L200-204 | 可接受；若未来追求完全确定性可注入 Yjs 测试 clientID（SA6 §15-4 follow-up 票范围） |
| O6 | `runShardTrace`/若干 pipe 场景未显式 close 连接（closeAtEnd 未置时）——残留对象全部为进程内 per-test 新建（无真实 timer/句柄），maxWorkers 1 串行下无跨用例干扰；释放路径由 TERM 组与 ROUND 收尾专测 | issue424-sharded-hub.ts:784-826 | 可接受（既有套件同款生命周期风格）；登记备查 |

## 附：结论与证据基线

- verdict：**`approve`**（无 BLOCKER/MAJOR；O1–O6 全部 MINOR 不阻断）
- `requiresConflictRecheck = false`：本轮未发现新的 ADR 冲突风险（SD-1~SD-4 落位与 SA8 两报告 adjudication 一致；D5 为 SA8 §8-2① 预裁定选项）。设计 §15 自行声明的 SA8 设计后复查义务（迭代 1 修订增量）属既有义务链，由 SA8 履行，非本评审新增。
- 唯一可写产物 = 本文件；未修改任何实现/测试/设计文件；未运行测试/启动服务/创建临时进程。
