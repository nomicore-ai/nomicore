# task_issue-447 SA6 诊断与验收契约 — γ 公共会话工厂 + 异步 FIFO 管道夹具 + 首个跨缝协议回合（γ-T1）

- Issue：#447（标题「Ticket(ws-replication): γ-T1 公共会话工厂 + 延迟注入异步管道夹具 + 首个跨缝协议回合（OPEN→bootstrap→close）」；Parent = PR #446 `spec/445-gamma-async-seam`；Comments REST 快照为空）
- 任务类型：**Feature（能力缺口 + 验收契约）**——缺口 = γ 公共工厂/句柄面、γ 缝词汇与两相记账/三态锚、延迟可注入异步 FIFO 管道夹具、跨缝 OPEN→bootstrap→close 的 β 逐字节 parity 证据**全部缺位**；**不是**生产行为缺陷（β/α 现行行为无缺陷，见 §4 基线）。
- HEAD：`c86ccbcc98e01a95ded732f6a9ad06aa8828bc53`（`Spec #445：γ 真 worker 形态设计工件（ADR 0032 附录 A4 + 协议 §24 + 词表）`）
- 结论：**`approve`** —— 能力缺口 6/6 运行期证据化；目标行为 oracle 4/4 在 HEAD 实测可达（真 peer + 真 Registry/Runtime + 公共工厂真身）；契约条目可执行、测试入口真实（runner 发现性实测 + 类型门实测）、断言经负控与变异证明敏感；未解决项集中登记于 §15。
- 本文件是唯一固定报告；可执行证据 = `wiki/raw/task_issue-447_sa6_capability_probe.mts`（6 GAP + 4 ORACLE/NC）与 `artifacts/sa6-issue447-*.log`（8 份，见 §13）。
- 本轮**未写入任何生产实现与交付测试**（dispatch 明示「produce only your acceptance-contract artifact」）；`packages/**` 零改动（§16）。

---

## 1. Task type and inputs

**读了什么**

| 输入 | 位置 | 用途 |
|---|---|---|
| Host 任务简报 | `wiki/raw/task_issue-447.md:9-32` | Issue 正文：Parent、What to build（γ 公共工厂/句柄、缝词汇、两相记账、三态锚、异步 FIFO 夹具、宿主桥样例、OPEN→bootstrap→close 回合与 β wire 等价）、AC 勾选项 6 条、Blocked by = None、Comments 空 |
| ADR 0032 附录 A4 | `docs/adr/0032-transport-decoupling-edge-session-split.md:55-99` | A4.1 载体与公共面（新工厂/句柄类型，`src/index.ts` append-only；缝消息词汇闭集合）、A4.2 保序契约（每会话一对专用通道；盖章点**同步**投回执；`bootstrapSnapshotSeq`/`ownStep2Seq`/`onAck` 三锚零改动；pending 两相记账 + 三态扩面）、A4.3 流控单点化（无拒纳词汇；1011 收口）、A4.4 推-FIFO pacing、A4.5 生命周期单规则、A4.6 回执 ≠ 接纳信号、A4.8 验收纪律（延迟可注入内存管道、零 worker_threads；既有矩阵全绿为硬门） |
| 协议规范 §24 | `docs/protocols/instance-replication-v1.md:1091-1154` | γ 缝契约规范文本：§24.1 载体与拓扑（每 (connectionKey, namespaceId) 一对专用通道）、§24.2 宿主传输义务 6 条（FIFO 不丢不重不乱序；回执条款；tag 会话域单调唯一纯 JSON；违契 = 响亮收口）、§24.3 缝消息词汇表（append-only 闭集合）、§24.4 序号回执与两相记账（pending 计入 `maxInFlightUpdates`；tag→seq 换键不换槽；保序条款 ⇒ ACK 到达时回执已登记）、§24.5 流控/拒纳/内存安全、§24.6 pacing、§24.7 生命周期、§24.8 观测口径 |
| 词表 | `CONTEXT.md:230-235` | SessionHost 词条 γ 段（「公共面为独立的新工厂/句柄类型（β 同步冻结签名逐字保留，包导出 append-only）」）+ 新增「序回执（sequence receipt）」词条及其 `_Avoid_` 反模式 |
| β 冻结面与现存实现 | `packages/ws-replication/src/{index,hub-session-host,hub-edge-host,hub-split,hub-edge,frame-io,backpressure,hub-namespace,update-channel,round-engine,testing}.ts` | 缺口岗位事实与 oracle（§5/§8/§9）；β 冻结签名与既有缝类型逐字基线 |
| 既有验收族与夹具 | `packages/ws-replication/test/{driver,harness,issue420-shim-hub,issue424-sharded-hub}.ts`、`ws-replication-issue418/420/421/422/424-*.test{,d}.ts` | 可复用基建（真 peer boot 注入缝、wire 字节捕获、`framesHexEqual`/`skeletonOf`/`docStateOf`/`parityOf`、fake timer、微任务 settle）与 test-d 先例 |
| Runner / 门禁 | `vitest.config.ts:14-23`、根 `package.json:11,13`、`.github/workflows/ci.yml:44,80`、`tsconfig.typecheck.json`、`packages/ws-replication/tsconfig.json` | 发现规则（`packages/*/test/**/*.test.ts`；`typecheck.include = **/*.test-d.ts`）、单文件命令、类型门双面（vitest typecheck + tsc） |

**缺失输入（→ §15）**：SA8 产物 `wiki/raw/task_issue-447_relevant_decisions.md`、`task_issue-447_conflict_report.md`、`task_issue-447_design.md` **均不存在**（目录内除 Host 简报外无 #447 产物）；Issue 评论 REST 快照为空（无 Owner 追加要求）。契约由简报 AC + ADR A4 + 协议 §24 + 前序票冻结事实（#418/#420/#421/#422/#424）+ 源码与运行期实测推导；事实缺口不阻断本轮（无 Issue 评论亦无 SA8 门禁产物可依，按简报 AC 全文推导）。

**为什么是 Feature 而非 Bug**：探针在 HEAD 上证明——β/α 现行实现自洽且全绿（§4）；缺的是 γ 交付物本身：公共 γ 工厂/句柄面、缝词汇与回执机械、异步 FIFO 夹具、跨缝 parity 证据。**不虚构 Bug 根因**；γ 红灯只能来自「能力面缺位 + 夹具缺位」，并由 ORACLE/NC 证明契约断言在既有实现上敏感（§6/§9）。

## 2. Owner comment mapping

Issue 评论 REST 快照为空（dispatch 明示）——**无 Owner 附加要求**，无评论 id/时间戳可映射。Owner 要求 = 简报正文（`wiki/raw/task_issue-447.md:15-32`）。逐项映射：

| 简报条目（原文要点） | 契约条目（§12） | 本轮可执行证据 |
|---|---|---|
| AC1 新 γ 公共工厂/句柄面导出（append-only）；β 冻结签名与行为逐字不动（既有 issue420 矩阵全绿） | PUB-C1~PUB-C4 | GAP-1（运行时导出 15 = β 冻结集，γ 候选 0）、GAP-2（β 句柄公共成员恰 5）、§4 基线（420/424 族 271 测试 + 包套件 825 测试全绿） |
| AC2 缝消息词汇落地：`frame{tag,bytes,lane}` / `receipt{tag,sequence}` / `frame` / `close` / `terminateUnauthorized` / `settled` / `connection-fatal`——无拒纳/闸门/信用词汇 | SEAM-C1~SEAM-C3 | GAP-3（`src/**` 27 文件零命中 receipt/tag/frame{tag…）、GAP-4（夹具面零命中）、§12 词汇闭集合（规范锚 §24.3） |
| AC3 session 控制面 pending 两相记账；`bootstrapSnapshotSeq` 三态；BOOTSTRAP_ACK 到达时锚已回填（保序条款结构性保证，非 park 机制） | PEND-C1/C2、ANCHOR-C1/C2 | GAP-6（两态、写点、唯一 `undefined` 判别）、ORACLE-3（保序条款被违反 ⇒ 响亮 `ACK_STATE_VIOLATION`，证明「非 park」断言在既有实现上敏感）、GAP-5（回执生产点 = mux 钩子） |
| AC4 延迟可注入异步 FIFO 管道夹具（每会话一对通道；FIFO/不丢/不重；零 worker_threads） | PIPE-C1~PIPE-C4 | GAP-4（无任何延迟可注入管道/每会话通道对；全部内存传输 = 单次 `queueMicrotask`）、GAP-3（`src/**` 跨线程面命中 0，约束现状保持） |
| AC5 OPEN→bootstrap→close 回合与 β wire 逐字节等价（复用 issue424 cross-seam 断言族） | ROUND-C1~ROUND-C3 | ORACLE-1（β golden trace：7+7 帧、控制帧子集 sha256 跨 run 稳定 `d14774a62139f504`）、ORACLE-2（控制帧逐字节等 + skeleton 等 + Yjs 数据帧语义等口径）、NC-1（内容变异 ⇒ 差异可判，断言非恒真） |
| AC6 新公共面 test-d 快照（按 issue420 `api.test-d` 先例） | TD-C1/TD-C2 | GAP-4（#447 验收文件 0）、§4 类型门实测（`tsc -p tsconfig.typecheck.json` exit 0；vitest `--typecheck.only` 存在 4 条**既有**错误，见 §4/§15-B1） |

## 3. SA8 constraints

无 SA8 设计产物可读（§15-1）。契约继承的硬约束（全部已在库、不可协商）：

1. **β 冻结面逐字不动（append-only 演进）**：`createHubSessionHost` / `HubSessionHostConfig` / `HubSessionOpenInput` / `HubSessionHandle` / `HubSessionSignal` / `HubSessionFrameListener`（`src/index.ts:91-99`、`hub-session-host.ts:44-89`）。A4.1 明言：β 的 `HubSessionFrameListener` **同步返回序号**的签名无法 append-only 演进为异步回执模型，故 γ 必须是**独立新工厂/句柄类型**（`docs/adr/0032-…md:61`）。
2. **缝只过 `Uint8Array` + 纯 JSON；nomicore 零 worker_threads/MessageChannel/MessagePort 依赖或类型**（ADR 决策 2 / A4.1；`docs/protocols/instance-replication-v1.md:1097`）。既有结构门已锁：`ws-replication-issue420-session-host-round.test.ts:445-457` 对 `package.json` + `src/**` 断言零命中——γ 必须继续保持（异步性来自宿主侧队列/延迟，不来自线程）。
3. **盖章单点 = edge 出站 mux**（`frame-io.ts:184-197` `emitOne` 写 `[8..12]`）；session 侧恒 `sequence=0` 占位（`hub-session.ts:264-271`）；协议 §3 序号纪律（每连接、从 1、严格递增）不变。
4. **保序契约（A4.2 / §24.2.3）**：每 (connectionKey, namespaceId) 一对专用通道、每方向 FIFO；edge 在盖章点**同步**投回执（先于处理后续 socket 数据）；违契 = 宿主 bug → 响亮收口，不允许静默降级（§24.2.6：无缓冲重排、无重试、无第二套准入管线）。
5. **三锚零改动语义**：`UpdateChannel.onAck` violation 判别（`update-channel.ts:224-256`）、`bootstrapSnapshotSeq`（`hub-namespace.ts:128,605,638,665-673`）、`ownStep2Seq`（`types.ts:1030`；`round-engine.ts:191-192,244,260,263`）——γ 下两锚由二值扩三值（未发 / pending / 已盖章），判别语义不变；「合法 SYNC_APPLIED 在锚回填前结构性不可达」的因果论证（`round-engine.ts:241-245`）依据从进程内同步改判为保序条款（A4.2）。
6. **两相记账（§24.4）**：pending 帧计入 `maxInFlightUpdates` 窗口（占用自推送时刻起算）；`receipt` 到达 tag→seq **换键不换槽**；窗口口径 = `UpdateChannel.effectiveInFlightCount()`（`update-channel.ts:141-146,198,431`）。
7. **流控单点 + 无拒纳词汇（A4.3 / §24.5）**：session 乐观发送，无 `dataGateOpen`/`connectionState`/`bufferedAmount` 前置检查；连接账本越界即 `CONNECTION_BACKPRESSURE`(1011) 收口整条连接；**缝上无 sent/deferred/rejected/credit/gate**（A4.6：`receipt` 是序号事实回传，非接纳信号）。
8. **观测口径（A4.7 / §24.8）**：`update-sent` 发射点留 edge 盖章点；`update-acked`/chunked 族在 session 回执/结算点；跨线程 observer 无全序 ⇒ §23 事件序金标适用域 = α/β，**不适用 γ**（契约不得把事件序逐字不变写成 γ 断言）。
9. **包边界（`packages/ws-replication/AGENTS.md`）**：生产 API 经 `src/index.ts`；测试入口真实、无 skip/only/todo/env override/源码字符串断言（行为判据优先；结构门只作补充登记）。
10. **前序票公共面（append-only，本票不改）**：#420 `createHubSessionHost` 族、#421 `createHubReplicationEdge`/`HubReplicationEdgeConnection.egress` 族、#422 `listen:false` 服务、#423 发射点归属。本票新增面**只增不改**。

## 4. Environment and baseline

| 项 | 值（本轮亲测；证据见 §13 日志） |
|---|---|
| 环境 | node v24.13.0；pnpm 10.28.2；vitest 3.2.7；typescript 5.9.3；worktree `/home/wangjian/nomicore-fix-issue-447` |
| 依赖安装 | `pnpm install --offline --frozen-lockfile` → exit 0（65 包全部来自本地 store；esbuild postinstall 被 pnpm 忽略但 vitest 正常运行）；**无网络依赖** |
| 运行期条件 | `NODE_OPTIONS=--conditions=nomicore-source`（包 `exports` 把 `src/index.ts` 门在该条件下，`packages/ws-replication/package.json:5-16`） |
| β 公共工厂矩阵（既有硬门） | 16 文件 / **271 测试全绿**，exit 0（418×3 + 420×2 + 421×6 + 422 + 424×4），`artifacts/sa6-issue447-baseline-beta-matrix.log` |
| 包全量套件 | 91 文件 / **825 测试全绿**，exit 0，51.6s，`artifacts/sa6-issue447-baseline-package-suite.log` |
| 根级类型检查 | `tsc -p tsconfig.typecheck.json --noEmit` → exit 0（0 行输出），`artifacts/sa6-issue447-typecheck.log` |
| 类型测试门（CI 形态） | `vitest run --typecheck.only --passWithNoTests=false` → **1 failed | 49 passed；4 条错误全部位于既有文件 `ws-replication-issue421-edge-factory-api.test-d.ts`**（`artifacts/sa6-issue447-typecheck-gate.log`）——**HEAD 既有红，非 #447 归因**（同一文件 `tsc` 干净；同风格最小临时 fixture 在 vitest typecheck 下零错误，§9-E5/§11-H6） |
| 探针稳定性 | `task_issue-447_sa6_capability_probe.mts` 连跑 3 次：`gaps=6/6 oracles=4/4`、exit 0（`artifacts/sa6-issue447-probe.log` + `-probe-rerun.log`）；控制帧子集摘要跨 run 恒等 `sha256=d14774a62139f504` |

## 5. Positive reproduction（能力缺口，GAP-1~GAP-6）

全部为**运行期/事实**证据，命令：

```
NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-447_sa6_capability_probe.mts
```

| id | 断言（缺口事实） | 实测输出（探针原文） |
|---|---|---|
| GAP-1 | `src/index.ts` 运行时导出**恰为 β 冻结集 15 个**，γ 候选（`/receipt|async|gamma|tag|pipe|fifo/i`）为 0 | 15 个；`["DEFAULT_REPLICATION_BACKOFF",…,"requirePeerReplication"]`；γ 候选 `[]` |
| GAP-2 | β 句柄公共成员恰 5 个且**无回执消费面**；`handleReceipt`/`onReceipt` 缺席（第三 port 形态 = 0） | `["close","handleFrame","onFrame","onSignal","terminateUnauthorized"]` |
| GAP-3 | `src/**`（27 文件）γ 缝词汇零命中：`receipt` / `handleReceipt` / `\btag\b` / `frame{tag` / `tag: <type>`；跨线程面 API 亦零命中（约束保持） | 命中 0 / 0 |
| GAP-4 | `src/testing.ts` 无管道/延迟类导出（5 个导出）；`test/**`（96 文件）无 `receipt`/延迟管道夹具痕迹；**无 #447 验收文件** | pipe-like `[]`；fixture 命中 0；#447 文件 `[]` |
| GAP-5 | 盖章点 `OutboundQueue.emitOne → emitRaw(bytes, sequence)` **同步**提供被分配序号（hooks `[[64,1],[48,2]]`，`[8..12]` 与之一致），而 `hub-edge.ts` 的 `emitRaw` 只接 `(bytes) => transport.send(bytes)` ⇒ **序号被丢弃、缝上无回执生产点** | `mux 钩子同步拿到盖章序（[[64,1],[48,2]]）…无回执生产点` |
| GAP-6 | `bootstrapSnapshotSeq` 为**两态**（`undefined | number`）：声明 `hub-namespace.ts:128`；写点 3 处（`:605` `lastChunkSequence`、`:638` `seq > 0 ? seq : undefined`、`:673` 复位 `undefined`）；`undefined` 判别仅 1 处（`:665-671` → `ACK_STATE_VIOLATION`）⇒ 无 pending 中间态 | 写点/判别点逐点命中 |

**最接近覆盖（非缺口）**：β 公共工厂 + 进程内 sharded fixture 已能跑通 OPEN→bootstrap→live→reconcile→close（`ws-replication-issue424-cross-seam-round.test.ts`，5 测试绿）；其宿主桥为**同步**形态（`issue424-sharded-hub.ts:370-377`：`raw.onFrame((frame, lane) => connection.egress.send…` 同步返回序号）——即 γ 要替换的那一条缝。

## 6. Negative control（负控 3 条，全部运行期）

| id | 负控内容 | 实测结果（探针原文） | 证明什么 |
|---|---|---|---|
| ORACLE-3 | **β 同步签名不可承载异步中继**：把宿主桥改成「帧异步中继（`queueMicrotask` 后真实投给 edge）+ 对 session 立即回 0」，跑真 peer 回合 | `ERROR=["ACK_STATE_VIOLATION"]`，`close=1002/protocol-error`，fatal 信号 `["connection-fatal:ACK_STATE_VIOLATION"]`，namespace 未 live | ① 缺口的**语义**根因（0 = 未发送/被拒，不是「异步已发送」）；② γ 负控「保序条款被违反 ⇒ 响亮失败而非 park」的断言在既有实现上**敏感可达**（同一判别机械） |
| ORACLE-2 | **parity 断言不得恒真/恒假**：同场景复跑两套 β 装配，控制帧逐字节比对 + skeleton 比对 | 控制帧逐字节**等**；skeleton 等；全帧差异 = 第 2 帧字节不同（Yjs `clientID` 随机，符合 #424 口径 `ws-replication-issue424-auth-parity.test.ts:8-19`） | 逐字节 parity 必须限定在**控制帧**子集；数据帧按 skeleton + `docStateOf` 语义判等（否则制造假红） |
| NC-1 | **内容敏感性**：场景变异（`hubRoot.n` 42→43）后全帧比对必须给出差异 | 差异「第 2 帧字节不同」且摘要变化；控制帧仍逐字节等 | 逐字节比对**不是恒真断言**；同时控制帧不受数据内容影响 = 正确的 parity 判据 |

## 7. Stability, scale and timing

- **重复性**：探针连跑 3 次全部 `gaps=6/6 oracles=4/4`（exit 0）；控制帧子集摘要跨进程恒等（`d14774a62139f504`）；数据帧摘要每次不同（Yjs `clientID`）——与本仓既有口径一致。
- **时序条件**：全部微任务驱动（`harness.settle()` 300×`await Promise.resolve()`、`settleUntil` 谓词 + `DeferPump`），fake/记账 timer（`makeAccountingTimer` 只记账不触发）；**零真实时间/网络**。γ 夹具的「延迟」必须是**可注入的显式释放步骤**（§12 PIPE-C2），不得引入真实 timer 或 wall-clock 等待。
- **规模条件**：本票验收场景 = 1 连接 × 1..2 namespace × 1..2 会话；窗口压测用 `maxInFlightUpdates=1`（最小规模 + 最大判别力），不进大流量规模（无性能面）。
- **确定性前提（实测发现）**：跨装配逐字节比对必须**钉死 peer 连接 nonce**——`peer-connection.ts:409-413` 用注入 `random()` 生成 16 字节 `connectionNonce`，HELLO_ACK 回显之；探针在未钉死时首帧（HELLO_ACK）字节即不同（§9-E1）。`boot({ random: () => 0.5 })` 后跨 run 控制帧字节稳定。

## 8. Root-cause chain / capability gap

**症状**：简报要求的 γ 纵切（工厂/夹具/回合）在 HEAD 完全不可执行；宿主无法把 session 放到异步传输之后。

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| 1 症状 | `src/index.ts` 无 γ 工厂/句柄导出；15 个运行时导出 = β 冻结集 | GAP-1（运行期导出表） | 高（实测） |
| 2 直接故障点 | β 句柄无回执消费成员（公共成员恰 5），β 签名要求监听者**同步返回 wire 序** | GAP-2；`hub-session-host.ts:65-66,215-219`；`index.ts:91-99` | 高（实测 + 源码） |
| 3 直接故障点 | 缝上无回执生产点：mux 盖章点已同步携带序号（`emitRaw(bytes, sequence)`），但 edge 把该钩子接成只发字节、丢弃序号 | GAP-5（钩子参数实测）+ `hub-edge.ts:195-202` | 高（实测 + 源码） |
| 4 直接故障点 | 控制面锚为两态，无 pending 中间态；`bootstrapSnapshotSeq` 的 `undefined` 兼表「未发」与「已回填后复位」 | GAP-6 + `hub-namespace.ts:128,605,638,665-673`；`round-engine.ts:191-192,244,260,263` | 高（源码逐点） |
| 5 直接故障点 | 窗口槽位在 `seq > 0` 之后才建立（推送时刻不占槽）；无 tag/pending 键空间 | `update-channel.ts:118-121,141-146,198,367-385,431,500-506` | 高（源码逐点） |
| 6 触发条件 | 宿主把 session 放到异步字节传输之后（跨线程/异步管道）——β 的同步回执模型在此**不可表达** | ORACLE-3（返回 0 ⇒ 响亮 `ACK_STATE_VIOLATION`）；ADR A4.1:61 | 高（实测） |
| 7 直接故障点 | 夹具缺位：无「每 (连接, namespace) 一对专用 FIFO 通道 + 延迟可注入」的内存管道；全部现存内存传输 = 单次 `queueMicrotask`、无延迟参数 | GAP-4；`harness.ts:584-619,647-756`；`issue424-sharded-hub.ts:504-555`；`src/testing.ts:18-31` | 高（实测 + 源码） |
| 8 最深根因（能力缺口） | γ 公共面与缝机械**整体未交付**：规范（A4/§24）已冻结，实现零行 | GAP-1..6 全覆盖；`src/**` 27 文件零命中 γ 词汇 | 高 |
| 9 放大因素 | 保序条款是承重条款（三锚零改动的前提）；若不显式钉死「回执先于 ACK」，γ 会把 ACK 判别退化为 park/静默（A4.2 明言非 park） | §24.2.3/§24.4；ORACLE-3 | 中-高（规范 + 实测类比） |
| 10 未证实假设 | γ 工厂导出名、句柄非 `handleReceipt` 成员的命名、夹具延迟模型 API、宿主桥样例归属 | §15-3/4/5 | — |

**结论**：这是**能力缺口**（规范已定、实现为零、夹具为零），不是生产缺陷；「红」只能来自目标面缺位，且必须由 GAP 组证据承载（不得用编译失败制造假红，§12.0）。

## 9. Causal experiments

| id | 实验 | 控制变量 | 观察 | 结论 |
|---|---|---|---|---|
| E1 | 跨 run 逐字节比对 HELLO_ACK | 两套 β 装配，同场景；唯一变量 = 是否注入 `random: () => 0.5` | 未钉死：首帧字节不同（16 字节 nonce 段 `414d0e…` vs `e15ee4…`）；钉死后：控制帧子集摘要跨 run 恒等 `d14774a62139f504` | parity 断言必须钉死 peer nonce，否则假红（§7） |
| E2 | 异步中继宿主桥（`queueMicrotask` 中继 + 回 0） | 其余同 β 真装配（真 peer/Registry/Runtime） | `ERROR=ACK_STATE_VIOLATION`、close 1002、`connection-fatal` 信号恰发 | β 同步签名≠异步载体；γ 必须新 port 形态（ADR A4.1 的运行时证明） |
| E3 | mux 钩子可用性 | `OutboundQueue` 直构，emit 两帧 | `emitRaw` 同步收到 `[[64,1],[48,2]]`；`[8..12]` 与之一致 | 回执条款的落点**已存在**（盖章点同步），缺的是 edge 侧接线与会话侧 tag 配对 |
| E4 | 内容变异敏感性 | 仅 `hubRoot.n` 42→43 | 全帧比对给出差异；控制帧仍等 | parity 断言敏感非恒真 |
| E5 | 类型门归因 | 既有 421 test-d 的 4 条错误 vs 最小同风格临时 fixture（同 `toEqualTypeOf<[config: A, overrides?: B]>` 形态） | 前者 4 条错误、`tsc` 同文件干净；后者在 vitest typecheck 下零错误 | 该红为 **HEAD 既有**、文件特异，非 #447 归因（§15-B1）；#447 类型门以 `tsc` 为准 |

## 10. Impact surface

**生产面（γ 交付将触及，设计阶段裁定；SA6 只登记影响面）**

| 面 | 现锚 | γ 预期影响 |
|---|---|---|
| 公共入口 | `src/index.ts:1-99` | append-only 新增 γ 工厂/句柄/消息类型导出；β 条目零改名零删除（PUB-C1） |
| session 半边 | `hub-session-host.ts`（β 同步形态） | 新增第三 port 形态（回执消费）与其工厂；β 文件与本文件冻结面不动；内部 `createHubSessionSink`（`hub-session.ts`）零改动原则保持 |
| 缝类型 | `hub-split.ts:75-123`（17 成员 port，`sendControlFrame/sendDataFrame → number`） | γ 需要异步回执的 port/消息承载；`HubSessionEdgePort` 与 `HubSessionSink` 的演进方式（新类型 vs 可选成员）由设计裁定（§15-3） |
| 盖章点/edge | `frame-io.ts:184-197`、`hub-edge.ts:193-217,258-280` | 在盖章点同步投 `receipt{tag,sequence}`（回执条款）；序号分配仍单点 |
| session 记账 | `update-channel.ts:118-146,198,367-394,431,500-506`；`hub-namespace.ts:128,605,638,665-673`；`round-engine.ts:191-192,244,260,263`；`types.ts:1030` | pending 两相键（tag→seq 换键不换槽，计入 `maxInFlightUpdates`）；两锚三态；判别语义与因果不变量保持不变 |
| 流控 | `backpressure.ts:110-205` | session 侧删前置闸门检查（乐观发送），edge 单点 1011 收口（A4.3）；β 行为不变 |
| 测试基建 | `test/{harness,driver,issue420-shim-hub,issue424-sharded-hub}.ts`、`src/testing.ts` | 新增「每 (连接, namespace) 一对 FIFO 通道 + 延迟可注入」fixture 与宿主桥样例（test-only）；既有夹具零行为变更 |

**必须保持绿的回归面**：418/420/421/422/423/424 全部套件（本轮实测 271 测试 + 包套件 825 测试）；`tsc -p packages/ws-replication/tsconfig.json` 与根 `tsc -p tsconfig.typecheck.json`；结构门「`src/**` + package.json 零跨线程面」。

## 11. Ruled-out hypotheses

| id | 假设 | 排除依据 |
|---|---|---|
| H1 | 「β 的同步监听者可以承载异步中继（先返回 0，稍后补序号）」 | ORACLE-3：回 0 触发 `ACK_STATE_VIOLATION`（`0 = 未发送/被拒`，`hub-split.ts:87-95`）——语义上不可用；ADR A4.1 同判 |
| H2 | 「β/γ 两套装配可跨 run 直接逐字节比对全部帧（含 HELLO_ACK）」 | E1：peer `connectionNonce` 随机（`peer-connection.ts:409-413`）⇒ 未钉死即假红；必须 `random: () => 0.5` |
| H3 | 「数据帧（Yjs 载荷）可逐字节比对」 | ORACLE-2 + #424 先例（`ws-replication-issue424-auth-parity.test.ts:8-19`）：`clientID` 随机 ⇒ 只能控制帧逐字节 + skeleton + `docStateOf` 语义 |
| H4 | 「回执需要在 edge 新增一个 mux 点/钩子」 | E3：盖章点已同步携带序号（`emitRaw(bytes, sequence)`），缺口是**接线与回传配对**，不是新钩子点 |
| H5 | 「γ 需要 `worker_threads`/`MessageChannel` 才能异步」 | ADR A4.1 + §24.1 明文禁止；既有结构门（`ws-replication-issue420-session-host-round.test.ts:445-457`）现状零命中；异步性 = 宿主侧队列/延迟（§12 PIPE-C2） |
| H6 | 「`vitest --typecheck.only` 的 4 条错误由本票/本环境安装引入」 | E5 + §4：错误全部位于既有 421 test-d；`tsc` 同文件干净；最小同风格 fixture 零错误；`git status` 对 `packages/**` 零改动 |
| H7 | 「γ 下 §23 事件序金标仍可逐字断言」 | A4.7/§24.8：跨线程 observer 无全序，事件序金标适用域 = α/β（契约不得写此法） |

## 12. Acceptance contract and test paths

**§12.0 契约纪律（先声明）**

1. 断言 = **运行期行为**（缝消息、wire 原字节、`[8..12]` 序值、`ackedSequence` 回指、`onSignal` 信号、通道计数、文档收敛、窗口计数）；**零源码 grep 断言**（源码扫描只作诊断探针与补充结构门，见 §12.5 PIPE-C3）。
2. 零 skip/only/todo/env override/fallback/吞错；不得用静态 import 缺失制造「编译失败假红」——γ 面实现前，本契约的红灯证据 = `GAP-1..6`（运行期/事实），实现票落地时新测试文件与生产面**同批**进红→绿（先例：#421 test-d 同批）。
3. 负控必须真实存在且可执行（§6 三条为模板），关键断言需有变异敏感性证据（#420 `suppressSequenceReturn` 先例：`issue420-shim-hub.ts:155-157`）。
4. 确定性前提：peer 侧 `random` 钉死；timer 用记账/虚拟 timer；延迟由显式释放步骤驱动；全部微任务可冲刷。

**§12.1 契约条目（→ 测试文件 `packages/ws-replication/test/ws-replication-issue447-*.test.ts` + `-api.test-d.ts`）**

| 条目 | 最小输入 | 可观察断言（目标实现预期） | 负控 / 敏感性 | 今日状态（红） |
|---|---|---|---|---|
| **PUB-C1** γ 公共面 append-only | 载入 `@nomicore/ws-replication` 运行时导出表 | 导出集 ⊇ β 冻结 15 名（逐名 + `typeof` 不变）∪ {γ 工厂}；γ 工厂为函数；`HubSessionHandle`（β）类型逐字不变（test-d 块） | 负控：删/改名任一 β 导出 ⇒ 断言红；γ 工厂不存在 ⇒ 红 | **红**（GAP-1：γ 候选 0） |
| **PUB-C2** β 冻结行为不回退 | 既有 418/420/421/422/424 套件 | 271 测试 + 包套件 825 测试全绿；`tsc -p packages/ws-replication/tsconfig.json` exit 0 | 负控：β `HubSessionFrameListener` 若被改成异步签名，420 test-d 的 `@ts-expect-error`/`toEqualTypeOf` 即红 | 绿（基线，须保持） |
| **PUB-C3** γ 句柄成员语义 | γ 工厂 + `open(纯 JSON 描述子)` | 句柄具备：字节入帧；出站帧 sink（**fire-and-forget**，无同步序号契约）；**`handleReceipt(tag, sequence)`**（消费序回执）；`onSignal`（`settled`/`connection-fatal` 既有词汇）；`terminateUnauthorized()`/`close()` 幂等 | 负控：缺 `handleReceipt` ⇒ 红；重复 tag / 未知 tag 的宿主 bug ⇒ 响亮收口（非静默） | **红**（GAP-2：无回执成员） |
| **SEAM-C1** 词汇闭集合 | γ 回合 + 夹具消息日志 | 缝上出现的消息**恰属** §24.3 集合：session→edge `frame{tag,bytes,lane}`/`settled`/`connection-fatal`；edge→session `frame{bytes}`/`receipt{tag,sequence}`/`close`/`terminateUnauthorized`；`lane ∈ {control,data}` | 负控：出现集合外消息名（如 `sent`/`deferred`/`rejected`/`credit`/`gate`/`paused`）⇒ 红 | **红**（GAP-3/GAP-4：词汇零命中） |
| **SEAM-C2** tag 纪律与回执配对 | 同上一回合（含 ≥2 出站帧） | 每出站帧携 tag；tag 会话域内**单调唯一**、纯 JSON；每个 tag 恰收到一条 `receipt{tag,sequence}`；`sequence` = 该帧 wire 字节 `[8..12]` 实际盖章值（`rawSequence` 复核），且全连接严格递增 | 变异：夹具故意重排/丢失一条回执 ⇒ 断言红；重复 tag ⇒ 红 | **红**（无回执机械） |
| **SEAM-C3** 回执非接纳信号 | 捕获的 `receipt` 消息对象 | `receipt` 只含 `{tag, sequence}` 事实键，**不含** sent/deferred/rejected 判别键（A4.6/§24.3） | 负控：注入判别键 ⇒ 断言红（键集比对） | **红**（无回执） |
| **PEND-C1** pending 占用窗口（自推送时刻） | `maxInFlightUpdates = 1`；延迟管道**暂不释放**回执；连推 2 笔 update | 缝上**只出现 1 条**出站 `frame{tag,…}`（第一帧已盖章；第二帧不得过缝）；释放第一条回执后第二帧才过缝 | 变异：把 pending 改为不占槽（盖章后才占）⇒ 第二帧立刻过缝 ⇒ 断言红 | **红**（GAP-6 + 现行为：槽位只在 `seq>0` 后建立，`update-channel.ts:367-385`） |
| **PEND-C2** tag→seq 换键不换槽 | 同 PEND-C1，随后释放回执、再等 ACK | 回执到达后窗口占用数不增（换键不换槽）；第 2 笔「推送」而非「ACK」后即可过缝；`maxInFlightUpdates` 不被双计 | 变异：回执时重复占槽 ⇒ 第 2 笔被无谓阻塞 ⇒ 断言红 | **红**（无 tag 键空间） |
| **ANCHOR-C1** 三态锚 + 保序正路 | γ 回合（回执按序先到） | OPEN→bootstrap→close 全回合：`BOOTSTRAP_ACK` 到达时锚已回填（回执已登记）⇒ `ackedSequence` 回指被接受、回合到 live；收 ACK 后锚复位（再来一次 unsolicited `BOOTSTRAP_ACK` ⇒ `ACK_STATE_VIOLATION`） | 变异：把「回执先于 ACK」改成 park/等待 ⇒ 回合在有限冲刷内无法完成或超时 ⇒ 断言红（禁 park） | **红**（GAP-6：两态，无 pending；无 γ 面） |
| **ANCHOR-C2** 违契响亮收口（非 park） | 宿主 bug 注入：**扣住** `BOOTSTRAP_SNAPSHOT` 的回执，直接投 `BOOTSTRAP_ACK` | 响亮收口：`connection-fatal{code:'ACK_STATE_VIOLATION'}` + 连接级 `ERROR` + close 1002；**不**静默接受、**不**park 等待（有限冲刷内必达结局） | 敏感性：既有 β 实现已在同判别机械上实测响亮收口（ORACLE-3）——断言非空转 | **红**（无 γ 面；判别机械本身已绿，见 §6） |
| **PIPE-C1** FIFO/不丢/不重/不乱序 | 每 (connectionKey, namespaceId) 一对通道；enqueue N 条（含**乱序释放时刻**的注入参数） | 每方向投递序 == 入队序；每条恰一次；零丢失（计数守恒）；跨会话零串道（A 的消息绝不出现在 B 的通道） | 变异：夹具 `reorder` 开关打开 ⇒ 断言红（#420 `suppressSequenceReturn` 先例） | **红**（GAP-4：无通道对夹具） |
| **PIPE-C2** 延迟可注入且显式驱动 | 夹具延迟注入参数（释放步/投递门） | **不调用释放 ⇒ 零投递**（延迟真实存在）；投递数 = 释放步数的函数（确定性）；**零真实 timer/wall-clock**（`vi.useFakeTimers` 之外不得依赖真实睡眠） | 负控：延迟参数置为「立即」时投递即时发生（参数有效，非恒零/恒满） | **红**（GAP-4） |
| **PIPE-C3**（补充结构门，非替代） | `package.json` + `src/**` 文本 | `worker_threads|MessageChannel|MessagePort` 命中 0（沿用 #420 先例；γ 保持） | — | 绿（现状 0 命中，须保持） |
| **ROUND-C1** γ round 行为面 | 真 peer + 真 Registry/Runtime + γ 装配；场景同 #424 ROUND-C1/C3 | `OPEN_OK`×1、`BOOTSTRAP_SNAPSHOT`×1、peer `BOOTSTRAP_ACK`×1（回指快照帧序）、SYNC 三段齐备、namespace `live`、hub/peer 文档 `encodeStateAsUpdate` 逐字节收敛、`CLOSE_NAMESPACE`×1 → `CLOSE_OK`×1（回指）、`settled` 经缝恰一次 | 负控：装配前提断言（会话宿主 registry === boot hub registry，`issue424-…:56-60` 同款）在场景前置即红 | **红**（无 γ 面） |
| **ROUND-C2** 与 β 逐字节 parity | 同场景两套装配：β（`makeShardedReplicationFacade` 模板）与 γ；peer `random` 钉死 | 控制帧子集（`HELLO_ACK/OPEN_OK/ERROR/CLOSE_OK/GOAWAY`）**逐字节相等**（`framesHexEqual` 返回 `undefined`）；`skeletonOf` 每方向全等；数据帧按 `docStateOf` 语义等；出站序 1..N 严格递增且两形态一致 | 负控：内容变异（`hubRoot.n` 42→43）⇒ 全帧比对必报差异（NC-1）；控制帧仍等（证明判据正确） | **红**（无 γ 面；β 侧 oracle 已实测，§13） |
| **ROUND-C3** 回执序与 wire 序一致 | 同 ROUND-C2，夹具记录 `(tag, receipt.sequence)` 与 wire `rawSequence` | 每条 receipt 的 sequence == 对应帧（同 tag）wire `[8..12]`；同一会话内不重不跳；三条控制信号（`settled`/`close`/`connection-fatal`）在生命周期内的次数与 §24.7 一致 | 变异：伪造 receipt 序号 ⇒ 断言红 | **红**（无回执） |
| **TD-C1** γ 公共面 test-d 快照 | `packages/ws-replication/test/ws-replication-issue447-<x>-api.test-d.ts` | 按 #420 先例：γ 工厂类型 `toEqualTypeOf<(options: …) => …>`；句柄/消息类型逐成员精确锁定；γ 消息词汇键集类型锁定 | `@ts-expect-error` 负控 ≥3 条：异步监听者赋给 β `HubSessionFrameListener`；γ 配置缺必填键；`lane` 非法字面量 | **红**（无 γ 类型面） |
| **TD-C2** β 冻结面非回退块 | 同 test-d 文件 | 既有 15 导出与 `HubSessionHost`/`HubSessionHandle`/`HubSessionSignal` 逐字类型不变（append-only 证明） | 与 420/421 test-d 同款负控 | 绿（基线，须保持） |

**§12.2 场景最小输入（ROUND/PEND/ANCHOR 共用）**

- 装配：`boot({ createHub: <γ 宿主桥>, random: () => 0.5, waitFor: 'live' })`（真 peer + 真 Registry/Runtime；γ 桥以 `frame{tag,…}` 出站、以 `handleReceipt` 回执）。
- 会话：1 连接 × 1 namespace（`ns-…` 文法）；`authorization` = edge 已结算 ok 投影（read/submit）；`selectedCapabilities` ∈ {0, CAP_CHUNKED_UPDATE} 两形态至少各跑一次（对齐 #424 ROUND-C4）。
- 管道：每会话一对通道；释放步骤显式；PEND 组用 `maxInFlightUpdates = 1`。
- 断言面：夹具消息日志（tag/receipt/词汇键集）+ wire `timeline()` 原字节 + `Run.hubFrames/peerFrames` + `namespaceState` + `snapshotDoc` 收敛 + `onSignal` 信号 + 通道/窗口计数。

**§12.3 旧实现（HEAD）预期结果**

γ 测试文件在 HEAD 上**不可运行**（无 γ 面）⇒ 按 §12.0-2，本契约的红灯证据由 GAP-1..6 承载：导出面 0、回执成员 0、词汇 0、夹具 0、钩子未接线、锚两态。**不得**把「静态 import 失败」写成红灯证据后就此声明契约达成。

**§12.4 目标实现预期结果**

全部条目绿：β 矩阵不回退（271 + 825 测试）；γ 回合达 live 并 close；控制帧与 β 逐字节相等；pending 窗口与三态锚行为如 §12.1；夹具 FIFO/延迟可注入且零线程；test-d 双面（`tsc -p packages/ws-replication/tsconfig.json` + `vitest run --typecheck`）绿——**类型门的既有 421 红须先归因**（§15-B1）。

**§12.5 契约不覆盖（明确 DENY）**

- 不锁 observer 事件集/事件序（A4.7/§24.8：γ 无全序；只锁「发射点归属」既有登记）。
- 不锁跨 session 轮转公平性（A4.4 显式放弃）。
- 不新增 wire 帧/错误码/事件型（决策 2；γ 是 host-facing 缝，非 wire 契约）。
- 不锁 γ 工厂/句柄/消息的**具体命名**（除 `handleReceipt` 由简报固定）——命名 = 设计裁定（§15-3）。

## 13. Red/green or baseline evidence

| 证据 | 文件 | 结果 |
|---|---|---|
| 能力缺口探针（6 GAP + 4 ORACLE/NC） | `wiki/raw/task_issue-447_sa6_capability_probe.mts`；`artifacts/sa6-issue447-probe.log`、`-probe-rerun.log` | `gaps=6/6 oracles=4/4`、`SA6_PROBE_VERDICT=CONFIRMED`、exit 0（连跑 3 次一致） |
| β 既有硬门矩阵 | `artifacts/sa6-issue447-baseline-beta-matrix.log` | 16 文件 / 271 测试全绿，exit 0 |
| ws-replication 包全量套件 | `artifacts/sa6-issue447-baseline-package-suite.log` | 91 文件 / 825 测试全绿，exit 0 |
| 根级类型检查 | `artifacts/sa6-issue447-typecheck.log` | `tsc -p tsconfig.typecheck.json --noEmit` exit 0，0 行输出 |
| 类型测试门（CI 形态） | `artifacts/sa6-issue447-typecheck-gate.log` | 1 failed \| 49 passed；4 条错误全在既有 421 test-d（**HEAD 既有**，§15-B1） |
| runner 发现性 | `artifacts/sa6-issue447-runner-trigger.log` | 临时 `ws-replication-issue447-runner-trigger-probe.test.ts` 被自动发现并 1/1 通过，exit 0；文件已删除 |

**β golden trace oracle（ROUND-C2 的期望值，实测）**：`OPEN→bootstrap→reconcile→live→CLOSE` 整回合，hub→peer 7 帧 / peer→hub 7 帧；`skeleton(hub→peer) = HELLO_ACK#1 OPEN_OK#2 BOOTSTRAP_SNAPSHOT#3 SYNC_STEP1#4 SYNC_STEP2#5 SYNC_APPLIED#6 CLOSE_OK#7`；**控制帧子集 sha256 = `d14774a62139f504…`（跨 run 恒等，peer nonce 钉死后）**；全帧摘要每次不同（数据帧含 Yjs `clientID`）。γ 测试应**同场对比** β 与 γ 两套装配（而非硬编码摘要），并要求控制帧逐字节相等。

## 14. Runner trigger evidence

- 发现规则：`vitest.config.ts:16` `include: ['packages/*/test/**/*.test.ts', …]` ⇒ `packages/ws-replication/test/ws-replication-issue447-*.test.ts` 自动落入，无需改配置；`typecheck.include`（`:20`）覆盖 `*.test-d.ts`。
- 单文件命令（实测模板）：

```
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run \
  packages/ws-replication/test/ws-replication-issue447-<name>.test.ts \
  --typecheck.enabled=false --passWithNoTests=false
```

- 实测：临时文件 `ws-replication-issue447-runner-trigger-probe.test.ts` → `Test Files 1 passed (1) / Tests 1 passed (1)`，exit 0（`artifacts/sa6-issue447-runner-trigger.log`）；随后删除（§16）。
- 类型层：`pnpm exec vitest run --typecheck`（或 `--typecheck.only`）与 `tsc -p packages/ws-replication/tsconfig.json` 是**双面门**（#420 test-d 头注先例）；CI 形态见 `.github/workflows/ci.yml:44`（typecheck）与 `:80`（分片 run，`--typecheck.enabled=false`）。
- 本票新增文件必须同时满足双面门；vitest typecheck 面的既有 421 红先归因（§15-B1），不得据此判 #447 红/绿。

## 15. Unknowns and blockers

| id | 事项 | 状态 / 建议 |
|---|---|---|
| 1 | SA8 产物（`task_issue-447_{relevant_decisions,conflict_report,design}.md`）均不存在；Issue 评论空 | 非阻断：契约由简报 AC + A4/§24 + 源码/实测推导；设计阶段落地后本契约按 §12 细化（命名/端口形态/夹具 API） |
| 2 | γ 需兼容 chunked 族（`UPDATE_CHUNK` 末 chunk 回执触发 drain；A4.4「transfer 末 chunk 回执」） | 契约已含「协商位两形态各跑一次」；分块族的 pending/回执细节留设计（不改本契约条目结构） |
| 3 | **γ 工厂/句柄/消息类型的具体导出名**未被任何规范固定（除简报固定的 `handleReceipt(tag, sequence)`） | 设计裁定；本契约按语义 + 词汇闭集合锁定。名字一经设计冻结，SA6 须原位补可执行的 γ 测试文件（§12.0-2） |
| 4 | 夹具延迟模型 API（释放步 vs 注入 ms vs 两者） | 规范只要求「延迟可注入、零 worker_threads」；契约锁**可观察性质**（PIPE-C2：不释放即零投递、投递数 = 释放步函数），不锁 API 形状 |
| 5 | 「宿主桥样例（ingress 同步取盖章序、异步投回执）」归属（生产 `src/testing.ts` vs test-only fixture） | 简报明示 test-only；契约按 test-only 要求（PIPE 组），是否需要 `src/testing.ts` 导出留设计 |
| B1 | **HEAD 既有类型门红**：`vitest run --typecheck.only` 在 `ws-replication-issue421-edge-factory-api.test-d.ts` 报 4 条 `TypeCheckError`（`toEqualTypeOf<[config: …, overrides?: …]>()` 处，TS2554），而 `tsc -p tsconfig.typecheck.json`/`-p packages/ws-replication/tsconfig.json` 对同一文件 exit 0 | 非阻断（与本票无关，已 §9-E5 归因）。**风险登记**：实现票的 test-d 验收若以「vitest typecheck 门全绿」为条件会误判；建议以 `tsc` 为准并先行修复/豁免 421 既有红（属独立缺陷，需另票） |
| 6 | `bootstrapSnapshotSeq` 三态无公共可观察面 | 契约只以行为断言（ANCHOR-C1/C2）覆盖；不得为断言新增公共 getter（会扩大冻结面） |

## 16. Temporary diagnostics cleanup

- 临时文件 `packages/ws-replication/test/ws-replication-issue447-runner-trigger-probe.test.ts`（runner 发现性实验）**已删除**；`packages/ws-replication/test/tmp-sa6-447-typecheck-repro.test-d.ts`（类型门归因实验）**已删除**。
- 未添加任何临时日志/probe 到生产源码；`packages/**` 零改动（`git status --porcelain` 仅见本票产物）。
- 探针脚本与证据日志为**契约交付物**（非临时物），保留在 `wiki/raw/` 与 `artifacts/`。
- 本轮未启动常驻服务（纯微任务/虚拟 timer），无进程/端口遗留；无 nohup/setsid/PID 文件/轮询 marker。
- 收尾状态：`git status --porcelain` = `?? wiki/raw/task_issue-447.md`（Host 简报，非本票产物）、`?? wiki/raw/task_issue-447_sa6_capability_probe.mts`、`?? wiki/raw/task_issue-447_sa6_contract.md`、`?? artifacts/sa6-issue447-*.log`（8 份）；未 commit/push/PR/finalize。

---

### 附：SEAM 词汇闭集合（§24.3 逐字，契约 SEAM-C1 的判据来源）

| 方向 | 消息 | 语义 |
|---|---|---|
| session→edge | `frame{tag, bytes, lane}` | 出站 namespace 域帧（`sequence=0` 占位，edge 在 mux 点重写 `[8..12]`）；`lane ∈ {'control','data'}` |
| session→edge | `settled{namespaceId}` | 通道终态恰一次（drain 提前完成判据） |
| session→edge | `connection-fatal{code}` | 通道→连接收口（code→WS close code 映射单点留 edge） |
| edge→session | `frame{bytes}` | 入站 namespace 域帧（sequence 已由 edge 校验，session 不得重检） |
| edge→session | `receipt{tag, sequence}` | 序回执：tag 对应帧在 mux 点被分配的 wire 序（**序号事实回传，非接纳信号**） |
| edge→session | `close` | 连接收口（幂等；session 侧 pending 整体冲刷 + 通道 quiesce） |
| edge→session | `terminateUnauthorized` | revoke 链（幂等；不溯及已推帧） |
