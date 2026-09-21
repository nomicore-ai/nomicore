# SA6 诊断与验收契约 — issue #420：SessionHost 公共工厂 + 内存管道完整协议回合（spec #415 T3）

**Summary (EN).** Task type = **Feature** (capability gap, no bug root cause claimed). At HEAD `7039f6d` the package
public entry (`src/index.ts`) exports **no SessionHost factory**: the only session-half factory
(`hub-session.ts:createHubSessionHost`) consumes a **function-bearing** `HubSessionEdgePort` (17 members) and
**decoded messages**, so it cannot be driven from a pure-JSON descriptor + byte frames. Five runtime probes confirm the
gap (10/10), that the outbound frame's *assigned wire sequence* is load-bearing (a `void`/`0`-return breaks the round
loudly: bootstrap ACK → `ACK_STATE_VIOLATION`; live UPDATE → `send-frame-rejected` resync), and that inbound-sequence
discipline exists **only** at the edge (the session consumes wire sequences as-is = AC5 anchor). This report freezes the
public surface verbatim (types + per-member semantics), the acceptance test paths, the assertion matrix, red/green
expectations, and the SA8/ADR obligations carried from #418 (`R2''/R5''/R7''/R8''`). Red is at the right reason:
`TS2305` on the type lock and `typeof createHubSessionHost === 'undefined'` on the runtime capability gate, while the
same runner/fixture keeps the listen-mode round green (negative control). Verdict: **approve** (contract executable and
enterable for design).

---

## 1. Task type and inputs

| 项 | 值 |
| --- | --- |
| 任务类型 | **Feature**（目标能力缺失：公共 byte-seam SessionHost 工厂 + 内存管道完整回合）——不虚构 Bug 根因 |
| 派工 | `sa-dcb7d6ad-6435-4376-9892-993b747b8d87`，role `mabf-sa6`，phase `acceptance-contract`，iteration 0 |
| 任务简报 | `wiki/raw/task_issue-420.md`（issue #420：ADR 0032 决策 2/3 的 namespace 半边出面；AC1~AC5；Blocked by #418） |
| 规范权威 | `docs/adr/0032-transport-decoupling-edge-session-split.md`（决策 1~5 + 否决备选 + 后果节）；`CONTEXT.md:225-235`（复制 Edge / **SessionHost** / 路由键契约词条）；`docs/protocols/instance-replication-v1.md` §4.1（连接序）、§7~§11（OPEN/bootstrap/round/UPDATE/CLOSE）、§23（事件面） |
| 前序证据 | `wiki/raw/task_issue-418_design.md`（§7 D1/D2/D5/D6 + §13 R2、§15.1、Follow-up）、`wiki/raw/task_issue-418_sa6_contract.md`、`wiki/raw/task_issue-418_sa10_spec.md`（§9 行 4/5）、`wiki/raw/task_issue-418_sa9_standards.md`、`wiki/raw/task_issue-419_sa6_contract.md`（T1 守卫） |
| 源码锚点 | `packages/ws-replication/src/{index,hub-session,hub-split,hub-edge,hub-connection,hub-namespace,frame-io,backpressure,update-channel,defaults,testing}.ts`；`packages/ws-replication/test/{harness,driver}.ts` 与 `ws-replication-issue418-*.test.ts`（C0a~C0d 既有缝形态） |
| 缺失输入（不阻断） | `wiki/raw/task_issue-420_relevant_decisions.md` 与 `wiki/raw/task_issue-420_conflict_report.md` **不存在**（已 `ls` 核对；#418/#419 有对应物 → 本票决策输入直接取 ADR 0032 + #418 设计义务账）；**无 #420 的 SA8 产物**（见 §3、§15 U5）；REST Issue comments = `[]`（无 Owner 评论） |
| 角色边界 | 本次只产出本报告 + 证据脚本/日志；**不实现生产代码、不新增交付测试**（临时红灯/负控探针已在收尾前删除，见 §16） |

## 2. Owner comment mapping

派工明文：**Owner feedback requirements: none; current REST Issue comments are empty ([])**。因此无逐条评论映射；派工自带的四条执行要求逐条落位：

| 派工要求 | 落位 |
| --- | --- |
| 「establish the diagnosis」 | §5 正复现（能力缺口）、§8 缺口链、§9 因果实验、§11 排除项 |
| 「frozen acceptance contract」 | §12（AC1~AC5 冻结签名 + 测试路径 + 断言矩阵 + 红/绿期望 + 变异敏感性） |
| 「for the SessionHost public factory and complete in-memory protocol round」 | §12.1（公共工厂签名逐字冻结）、§12.2（内存管道完整回合验收） |
| 「Produce the required SA6 artifact only; do not implement code or tests」 | 交付物 = 本报告 + `artifacts/sa6-issue420-*` 证据；`packages/**` 零改动（§16 `git status` 证据） |

## 3. SA8 constraints

本票**尚无** SA8 设计前/实现后产物（`wiki/raw/` 无 `task_issue-420_*`；对比 #418/#419 均有 SA8 报告）。可适用的约束来自 **#418 的 SA8 义务账**（跨票存续，`task_issue-418_sa10_spec.md:90-91`、`task_issue-418_design.md` §15.1/§13）与本票的规范输入：

| # | 约束 | 对本票的含义（必须被 SA10/SA8 承接） |
| --- | --- | --- |
| S1（R5''，门禁性） | worker 形态票必须重新过 SA8：**入站缝形态**（`Uint8Array` 帧 vs #418 的「已解码消息 + 序号」）+ `openAdmission` 拉取形态 + `channels`/`dataFacetOf` 组合成员重塑 | 本契约 §12.1 冻结的公共面即该「新缝面」的输入；实现合入前必须有一次 SA8 复查（本票**未**做该复查 → §15 U5） |
| S2（R2''） | 跨线程 pending 有界缓冲义务在 worker 形态票**重新进入** | 本契约把 pending 窗口定为**宿主桥**职责并要求有界 + 顺序保真（§12.2），禁无界缓冲 |
| S3（R7''/R8''） | ADR 0032:22 机制句与 CONTEXT.md:230 词条的描述差（「未授权 OPEN 不过缝 + 闭包回放投影」 vs #418 的「到达点投递 + 拉取」）必须在 worker 形态票 SA8 前置门禁之前或之中落 ADR 修订/澄清附录 | 本契约 §12.1 明确：**公共带外形态回到 ADR 字面**（session 只消费已结算 ok-投影）；拒绝路径归属由设计定（§15 U3），listen 形态零变化 |
| S4 | ADR 0032 决策 5：worker 侧 shim 无 `bufferedAmount`/ping/onPong → dormant 降级（水位闸门休眠、liveness 休眠）；`maxConcurrentAssembliesPerConnection` 降级为 per-session 计数；observer 发射点 = 拥有事实的一侧 | §12.1 冻结：water gate dormant（true）、`bufferedAmount` 缺席、assembly 槽 per-session、namespace 域 observer 事件在 session 侧（工厂配置注入 observer） |
| S5 | 模块 `AGENTS.md`：生产 API 只经 `src/index.ts`；可编程适配器/测试控制留在 `/testing` | §12.0：公共工厂经 `src/index.ts`（追加）；桥/夹具只放 `test/`；`/testing` 零改动 |
| S6 | ADR 0032 后果节：公开面一经发布即 **append-only** | §12.1 的签名一经 test-d 锁定即冻结；后续（async worker / revoke 之外的信号）只能追加（§15 U2） |

## 4. Environment and baseline

| 项 | 值 |
| --- | --- |
| worktree / branch | `/home/wangjian/nomicore-fix-issue-420`，`mabf/issue-420` |
| HEAD | `7039f6dae8e7d29f0c929492f0ca2119bc63afaa`（= PR #426 merge，含 #418 拆分；父链含 #419） |
| 工具链 | node `v24.13.0`，pnpm `10.28.2`，vitest `3.2.7`，typescript `5.9.3`；`pnpm install --frozen-lockfile` → `Packages: +65 … Done in 515ms`，exit 0（worktree 初始无 `node_modules`） |
| 包基线（全量 ws-replication） | **Test Files 77 passed (77) / Tests 588 passed (588) / Type Errors no errors / 48.83s / exit 0** → `artifacts/sa6-issue420-baseline-package-suite.log` |
| hub-namespace 测试矩阵基线（7 文件） | **7 passed / 52 tests / exit 0**：ac7-faults 12、ac1-ac2-open 12、ac6-resync-close 7、ac5-live 7、periodic-reconcile 5、ac4-reconcile 5、ac3-bootstrap 4 → `artifacts/sa6-issue420-baseline-matrix.log` |
| 公共入口运行时导出（11 名） | `DEFAULT_REPLICATION_{BACKOFF,LIMITS,TIMEOUTS}`、`NOMICORE_{HUB,PEER}_REPLICATION_SERVICE`、`createHubReplication`、`createHubReplicationPlugin`、`createPeerReplication`、`createPeerReplicationPlugin`、`requireHubReplication`、`requirePeerReplication`（探针 INFO，`artifacts/sa6-issue420-capability-gap-probe.log`） |
| 模块级导出 | `hub-session.ts`=`['createHubSessionHost']`、`hub-edge.ts`=`['createHubReplicationEdge']`、`hub-split.ts`=`[]`（零运行时导出）——与 #418 C0c（`…structure.test.ts:616-619`）一致 |
| 既有公共面冻结锚 | `…issue418-edge-session-split-contract.test.ts:144-156`（`FROZEN_PRODUCTION_EXPORTS`/`FROZEN_TESTING_EXPORTS`）+ `:551-552` 全集合相等断言 ⇒ **AC1 追加导出必然使 C5a 红**（本契约 §12.6 明确授权的一次性追加编辑） |
| 零源码字符串断言纪律 | 既有 #136/#418 测试族头注「零源码 grep 断言」；本契约把 grep 类判据限制为 **AC4/AC5 的补充结构门**（AC 明文要求「零依赖/代码不存在」），行为验证仍由运行时断言承载（§12.4/§12.5） |

## 5. Positive reproduction（能力缺口的事实复现）

探针：`artifacts/sa6-issue420-capability-gap-probe.mts`（10/10 PASS，3 次重复一致）→ 日志 `artifacts/sa6-issue420-capability-gap-probe.log`。

| # | 事实（运行时观察） | 证据 |
| --- | --- | --- |
| G1 | 公共入口**无**任何 SessionHost 形态工厂：`createHubSessionHost` / `createHubNamespaceSession` / `createHubSession` 均 `undefined` | `PASS A.public.*.absent` |
| G2 | 公共入口**无**任一导出是「工厂 → `open()` → `{handleFrame,onFrame,close}`」形态（构造扫描 `shardLike === 0`） | `PASS D.noShardFactoryInPublicEntry` |
| G3 | 内部 splice 工厂 `hub-session.ts:createHubSessionHost` 在场，但其缝面是 **17 个函数成员**的 `HubSessionEdgePort`（`hub-split.ts:54-99`）：`openAdmission` 异步拉取 + 4 条发送/查询函数 + 6 条连接级函数 + observer/clock 等；`JSON.stringify` 会丢函数 ⇒ **不能由纯 JSON 描述子驱动** | 探针 `C.spliceFactoryConstructible`、`INFO portMembersTouchedByOpen ["observerPresent","onChannelSettled","openAdmission","sendControlFrame"]` |
| G4 | 内部 splice 的投递面是 **已解码消息**（`openNamespace(message)` / `namespaceFrame(message, sequence)`），**无字节入帧面**：对象表面 `handleFrame`/`onFrame` 均缺席 | `PASS C.spliceHasNoByteInbound`、`INFO internalSpliceSurface` |
| G5 | 类型层目标形态不可表达（AC1 的 test-d 现在必红）：`artifacts/sa6-issue420-type-lock-probe/probe.ts`（冻结签名逐字）经 tsc → **8 × TS2305**（`createHubSessionHost`/`HubSessionFrameLane`/`HubSessionFrameListener`/`HubSessionHandle`/`HubSessionHost`/`HubSessionHostConfig`/`HubSessionOpenInput`/`HubSessionSignal` 全缺）+ 3 × TS7006 + 4 × TS2578（负控 `@ts-expect-error` 尚不可达） | `artifacts/sa6-issue420-type-lock-red.log`（`[tsc exit: 2]`） |
| G6 | runner 层红灯原因无歧义：契约路径上的临时运行探针在同一 runner 内 `expected 'undefined' to be 'function'`；`--typecheck` 侧报 3 条 `TypeCheckError: Module '"@nomicore/ws-replication"' has no exported member …` | `artifacts/sa6-issue420-runner-trigger-red.log` |
| G7 | 现有 7 文件矩阵**无法**在 shim 装配上重跑：shim 装配需要公共工厂（G1/G2），且内部 splice 需要函数承载 port（G3） | G1~G4 + AC3 现状（无 shim 夹具） |

## 6. Negative control

| 负控 | 观察 | 结论 |
| --- | --- | --- |
| N1 同一导入机制下的既有公共工厂 | 同一探针用**同一动态导入路径**取到 `createHubReplication` / `createPeerReplication` / `createHubReplicationPlugin` 均为 `function` | G1/G2 的缺席是**真缺席**，非解析/环境故障（`PASS B.*`） |
| N2 同一 runner + 同一 fixture 的 listen 全回合 | 临时负控文件在同一 vitest run 内 2/2 绿：既有公共工厂在场 + `boot()` 驱动的完整回合（OPEN→bootstrap→live→reconcile→CLOSE + `hub.close()`） | runner/harness/fixture 均正常；G6 的红是能力缺口（`artifacts/sa6-issue420-runner-trigger-red.log`） |
| N3 结构门基线 | `packages/ws-replication/{src,package.json}` 对 `worker_threads|MessageChannel|MessagePort` 命中 0（AC4 当前即绿，属「实现后必须保持」的不变量） | `PASS A.zeroWorkerApiReferences`（`artifacts/sa6-issue420-seam-purity-gate-probe.log`） |
| N4 纯 JSON 判据的敏感性 | 冻结描述子 `structuredClone` 深等成功；掺入函数闭包 → `DataCloneError` | 验收里的「纯 JSON」断言不是恒真（`PASS B.d1/B.negativeControl_d2`） |
| N5 入站 sequence 纪律的对照 | 同类非法序：edge → `SEQUENCE_VIOLATION` + `close(1002,'protocol-error')` + 零缝投递；session（零 diff 通道）→ 照常消费并以其序回帧 | AC5 的正/负对照同时成立（§9 E2） |
| N6 字节中继前提 | 真实回合中 14 帧 namespace 域帧：`encode(decode(frame), {sequence}) == frame` 逐字节相等（0 mismatch） | 宿主桥「消息→字节」中继保真（§9 E3） |

## 7. Stability, scale and timing

| 项 | 观察 |
| --- | --- |
| 重复性 | 5 个探针各跑 3 轮，逐轮 rc=0 且 `PROBE_RESULT` 逐字一致（capability 10/10、causality 7/7、sequence-discipline 2/2、seam-purity 4/4、relay-fidelity 2/2）→ `artifacts/sa6-issue420-stability-3x.log` |
| 时序纪律 | 全部探针零 real sleep：微任务 `settle()/settleUntil()` + 注入 fake scheduler（`createRegistryTestScheduler`）+ 显式 defer 泵；与既有 #136 测试族同款 |
| 规模/时长 | 探针 ~1–3 s/个；聚焦矩阵 3.38 s；包全量 48.83 s（含 typecheck 11.65 s）；单 namespace/单连接回合（内存管道无 socket 无 worker） |
| 平台 | node 24 / linux x64；无网络依赖（除 `pnpm install`） |

## 8. Capability gap chain（能力缺口链，非缺陷根因）

| Step | 事实 | 证据 | 置信度 |
| --- | --- | --- | --- |
| 1（症状） | issue #420 的验收形态（内存管道驱动完整回合、shim 上重跑矩阵、test-d 锁签名）在当前实现上**不可达** | §5 G1~G7 | 高 |
| 2（直接缺口） | 公共入口无 shard 形态 SessionHost 工厂（`open()→会话句柄`），公开面只有整连接 listen 工厂 | §5 G1/G2 | 高 |
| 3（结构原因） | 唯一 session 半边工厂吃「函数承载 port + 已解码消息」，其缝形态与 ADR 决策 2 的字节缝（`Uint8Array` + 纯 JSON）**不同构**；且其配置必须内联 17 个函数成员（无法过 JSON 描述子） | `hub-session.ts:30-39,50-79`；`hub-split.ts:54-99`；§5 G3/G4 | 高 |
| 4（更深根因） | #418 的进程内组合把「缝」实现为**同步函数调用**：出站帧的被分配 wire 序经返回值得以回传（`sendControlFrame/sendDataFrame: number`），而公共形态把它拆成**字节帧 + 宿主 pipe** ⇒ 必须重新定义「序的回传路径」，否则协议回合在首个 ACK 处断裂（§9 E1） | `hub-edge.ts:216-244`、`frame-io.ts:150-197`、`hub-namespace.ts:631,659-662`、`update-channel.ts:346-358` | 高 |
| 5（放大因素） | 若只导出「可构造」面而不冻结 `onFrame` 的返回语义，实现会在 bootstrap/live 两处响亮失败（resync/connection fatal）——失败点远离根因，易被误判为夹具/超时问题 | §9 E1 臂 A/C | 高 |
| 6（触发条件） | 任何真实（非 mock）回合：OPEN→bootstrap 必触发；live UPDATE 必触发 | §9 E1 | 高 |
| 未证实假设 | （i）真 worker（异步 pipe）下序回传的最终形态（本期只冻结**同步宿主 pipe** 面）；(ii) 拒绝路径（denied/throw）在 shim 形态由 edge 还是 session 承载（§15 U3） | 见 §15 | 中 |
| 排除项 | 环境/runner/fixture 故障、导入解析故障、既有 listen 回合回归（§6 N1/N2） | §6 | 高 |

## 9. Causal experiments

**E1 — 出站序回传是承重事实**（`artifacts/sa6-issue420-causality-probe.mts`，7/7，3×一致）。控制变量 = 同一真实 Registry/Runtime fixture + 同一零 diff 通道，唯一变量 = stub edge port 的 `send*Frame` 返回值：

| 臂 | 变量 | 观察（运行时） | 结论 |
| --- | --- | --- | --- |
| A | control 面返回 0（= 「fire-and-forget 无回传」） | 帧头占位 `[8..12]==0` ✓；对端视图 `BOOTSTRAP_ACK(ackedSequence=2)` → `connectionFatal('ACK_STATE_VIOLATION', 1002)`，通道未达 `reconciling` | 无回传 ⇒ bootstrap 永不结算（回合断裂） |
| B | control 面返回递增序 | 同输入 → `fatal=[]` 且 `bootstrapping→reconciling` | 回传 ⇒ 回合继续 |
| C | data 面返回 0（control 有回传） | live 期真实 hub 写 → UPDATE 出帧但通道判 `resync-required{cause:'send-failed',reason:'send-frame-rejected'}` | data 面同构承重（响亮，不静默） |
| D | data 面返回递增序 | UPDATE 出帧（占位仍为 0）+ 以回传序投递 `UPDATE_ACK(ackedSequence)` → `update-acked{sequence}` 命中在途条目，零 resync | 回传 ⇒ 窗口/ACK 簿记正确 |

**E2 — 入站 sequence 纪律单点**（`artifacts/sa6-issue420-sequence-discipline-probe.mts`，2/2）：

| 臂 | 输入 | 观察 | 结论 |
| --- | --- | --- | --- |
| A（edge） | `HELLO(seq1)` → `OPEN_NAMESPACE(seq3)`（期望 2） | wire `['HELLO_ACK','ERROR']` + `SEQUENCE_VIOLATION` + `close(1002,'protocol-error')`；sink 投递 `[]` | edge 是唯一 sequence 执行点（AC5 的负控） |
| B（session/零 diff 通道） | 依次消费 seq 2/3/4/5 后，以**回退序 2** 投递 `CLOSE_NAMESPACE` | `CLOSE_OK{ackedSequence: 2}` + `settled=[ns]` + `fatal=[]` | session 半边**零重检**：wire 序被原样消费（AC5 的正锚，当前已在通道内成立，缺的是公共字节入口） |

**E3 — 宿主桥中继保真**（`artifacts/sa6-issue420-bridge-relay-fidelity-probe.mts`，2/2）：真实回合（含 live 双向 UPDATE、periodic reconcile、CLOSE）14 帧 namespace 域帧，`encode(decode(frame), {sequence})` 与原帧**逐字节相等**（`peerToHub` 7 帧 / `hubToPeer` 7 帧，0 mismatch）⇒ 桥可用「解码消息 → 重编码」把 #418 的已解码缝面搬运到 `handleFrame(bytes)`，不引入第二份 codec 语义。**边界登记**：`openNamespace(message)` 不带 seq（`hub-split.ts:109`）⇒ OPEN 帧的中继序为桥合成值（协议上无消费者：通道 OPEN 路径不读 seq）；真 worker 形态应由 edge 直接交原始帧字节（§15 U2 的一部分）。

**E4 — 纯 JSON/字节判据的敏感性**（`artifacts/sa6-issue420-seam-purity-gate-probe.mts`，4/4）：见 §6 N3/N4；另 `encodeMessage(..., {sequence:0})` 解码 `header.sequence === 0` ⇒ 占位语义可运行时断言。

## 10. Impact surface

**交付面（目标实现，供 SA10 细化）**

| 路径 | 变更类型 | 内容 |
| --- | --- | --- |
| `packages/ws-replication/src/hub-session-host.ts` | 新增 | 公共 SessionHost 工厂 + 冻结类型 + 宿主 pipe 适配（内部复用 `hub-session.ts` 的 splice + 字节解码/占位编码） |
| `packages/ws-replication/src/index.ts` | 追加 | 值导出 `createHubSessionHost` + 类型导出（`HubSessionHostConfig`/`HubSessionHost`/`HubSessionOpenInput`/`HubSessionHandle`/`HubSessionFrameLane`/`HubSessionFrameListener`/`HubSessionSignal`） |
| `packages/ws-replication/src/hub-session.ts` | 重命名（零行为） | `createHubSessionHost`→`createHubSessionSink`；`HubSessionHostConfig`→`HubSessionSinkConfig`；删 `HubSessionHost = HubSessionSink` 别名（直接用 `HubSessionSink`） |
| `packages/ws-replication/src/hub-connection.ts` | 机械 | 上条重命名的 import/调用点（1 处） |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-structure.test.ts` | 机械 | C0b 相对导入/调用点 + C0c 期望列表（`:13,:39,:421,:528,:571,:594,:618`）；断言其余逐字不变 |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts` | 追加一行 | `FROZEN_PRODUCTION_EXPORTS` += `createHubSessionHost`（`:144-156`）；零删除零重排（其余断言不变） |
| `packages/ws-replication/test/issue420-shim-hub.ts`（建议名） | 新增（夹具） | 宿主桥 + shim hub：`accept/acceptTrusted`（宿主职责：verifyToken→identity）+ 真 edge + 内存管道 + 公共 session 工厂；仅搬运字节/JSON，无协议决策 |
| `packages/ws-replication/test/ws-replication-issue420-session-host-round.test.ts` | 新增 | AC2/AC5 回合验收（§12.2/§12.5） |
| `packages/ws-replication/test/ws-replication-issue420-session-host-api.test-d.ts` | 新增 | AC1 类型冻结（§12.1） |
| `packages/ws-replication/test/ws-replication-issue420-shim-matrix.test.ts`（或 AC3 备选机制） | 新增 | AC3 shim 矩阵重跑 + 反空跑断言（§12.3） |
| `packages/ws-replication/src/testing.ts` | **零改动** | 桥/夹具不得进 `/testing`（S5） |

**零 diff 要求**：`hub-namespace.ts`（通道）必须逐字节不变（AC3「通道零改动」的硬证据）；`frame-io.ts`/`backpressure.ts`/`round-engine.ts`/`update-*.ts`/`bulk-transfer.ts`/`liveness.ts`/`observer.ts`/`validate.ts` 的 diff 需在交付说明中逐项论证且全量套件绿。

**调用方影响**：nomic-server（宿主：ingress=edge、namespace home worker=公共 session 工厂 + 宿主 pipe）；`listen:false` 插件与 `nomicoreHubSessionHost` 服务**不在本票范围**（ADR 决策 5 的「双轨」之服务轨留后续票，与 #418 SA10 §9 行 4 留白一致）。

**非目标**：peer 侧拆分；真 worker/`MessageChannel` 传输；`listen:false` 插件服务；重认证/主动 revoke 的完整 shard 形态（本契约只冻结 handle 成员可达性，不承诺 edge↔session 跨进程 revoke 全链路）；wire 格式变更。

## 11. Ruled-out hypotheses

| 假设 | 判定 | 依据 |
| --- | --- | --- |
| H1「缺口只是少一行 re-export（把内部工厂导出即可）」 | **否决** | 内部 splice 实参含 17 个函数成员（E1/G3），公共形态要求纯 JSON 描述子（AC4）+ 字节入帧面（AC2）⇒ 形态不同，不是 re-export 问题 |
| H2「内部工厂可由 JSON 描述子驱动（函数可注入桩）」 | **否决** | `JSON.stringify`/`structuredClone` 丢函数（N4）；（真 worker 里根本没有函数可注入） |
| H3「`onFrame` 可以用 `void` 监听器（fire-and-forget）」 | **否决** | E1：control 面 0 回传 ⇒ `ACK_STATE_VIOLATION` 连接级致命；data 面 0 回传 ⇒ `send-frame-rejected` resync；两者都让 AC2 回合不可能绿 |
| H4「现有矩阵已经覆盖 shim 形态」 | **否决** | 77 文件全绿只覆盖 listen 单体现状；无任何测试构造公共字节缝（G7） |
| H5「AC5 已被现有测试锚定」 | **部分否决** | 通道内「零重检」行为已成立（E2-B），但**公共字节入口不存在** ⇒ 该 AC 的锚点在目标形态上仍缺（且新入口最易犯错：给解码器传 `expectedSequence`） |
| H6「AC4 是空条目（当前已绿）」 | **修正** | 结构门当前绿（N3），但它是**实现后必须保持**的不变量 + 运行时纯 JSON/字节面需新增断言；且本条是唯一允许以结构扫描为**补充**判据的 AC（行为判据同时在场） |
| H7「稳定失败是环境问题」 | **否决** | N1/N2：同 runner/同导入机制/同 fixture 下既有面全绿；探针 3× 一致 |

## 12. Acceptance contract and test paths

### 12.0 交付路径与门禁

- 新增测试一律落在 `packages/ws-replication/test/`（根 `vitest.config.ts:17` 的 `include` 覆盖）；类型冻结落 `*.test-d.ts`（同文件 `test.typecheck.include:21`）。
- 夹具（宿主编译的 shim hub / 内存管道）只落 `test/`；生产公共面只经 `src/index.ts`；`src/testing.ts` 零改。
- 运行命令（实现后逐条执行并把日志登记进交付说明）：
  - `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/ws-replication/test`
  - `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/ws-replication/test/ws-replication-issue420-session-host-round.test.ts`
  - `pnpm exec tsc -p packages/ws-replication/tsconfig.json`
  - `pnpm test`（根：`--conditions=nomicore-source vitest run --typecheck`）与 `pnpm typecheck`（15 tsconfig 串行）
- 纪律：`skip/only/todo`、env override、fallback、吞错、软化断言全部禁止；断言必须观察运行时行为/wire 原字节。

### 12.1 AC1 — 冻结公共面（test-d 锁定）

**冻结声明（逐字，实现必须逐字段一致）**：

```ts
// packages/ws-replication/src/hub-session-host.ts（新模块）→ src/index.ts 追加导出
import type { NamespaceRegistry } from '@nomicore/namespace-registry';
import type {
  NamespaceAuthorization,
  ReplicationClock,
  ReplicationObserver,
  ReplicationTimer,
  ResolvedLimits,
  ResolvedTimeouts,
} from './types.js';

/** 工厂配置：宿主本进程/worker 内事实（**不跨缝**；可含函数，但不得含 authorize/transport/缝 port）。 */
export interface HubSessionHostConfig {
  readonly registry: NamespaceRegistry;
  readonly instanceId: string;              // hub 实例 id（HELLO 绑定/本地 owner 判定）
  readonly limits: ResolvedLimits;          // 组合根 resolve+validate 后注入（既有纪律）
  readonly timeouts: ResolvedTimeouts;
  readonly timer: ReplicationTimer;
  readonly observer?: ReplicationObserver;  // namespace 域事件发射面（决策 5：拥有事实的一侧）
  readonly clock?: ReplicationClock;        // now() 采样（无 observer 零采样，既有纪律）
}

/** 单 (连接, namespace) 会话开启描述子：**纯 JSON**（可 structuredClone，无函数/live 对象）。 */
export interface HubSessionOpenInput {
  readonly connectionKey: string;           // 宿主连接身份（不透明；非空；nomicore 不解释）
  readonly remoteInstanceId: string;        // edge 认证后的对端 instanceId（= edge.authenticatedInstanceId）
  readonly namespaceId: string;
  readonly authorization: Extract<NamespaceAuthorization, { ok: true }>; // edge 已结算预授权投影
  readonly selectedCapabilities: number;    // HELLO capability 交集位图
  readonly connectionId?: string;           // 连接域 observability id（握手前 undefined）
}

export type HubSessionFrameLane = 'control' | 'data';
/** 出站 sink：同步收帧，返回**被分配的 wire 序**（0 = 未发送/被拒）。 */
export type HubSessionFrameListener = (frame: Uint8Array, lane: HubSessionFrameLane) => number;

/** 会话→edge 控制信号（纯 JSON；ADR 决策 2 的 session→edge 半边在字节缝上的载体）。 */
export type HubSessionSignal =
  | { readonly type: 'settled'; readonly namespaceId: string }
  | { readonly type: 'connection-fatal'; readonly code: string };

export interface HubSessionHandle {
  /** 入站（fire-and-forget）：namespace 域 wire 帧；序列已由 edge 校验——本半边**不得**再校验。 */
  handleFrame(frame: Uint8Array): void;
  /** 出站 sink 注册（同步）；至多一个 sink 生效：后注册者替换先注册者；返回退订函数。 */
  onFrame(listener: HubSessionFrameListener): () => void;
  /** 会话→edge 控制信号观察（纯 JSON；可多监听，返回值忽略）。 */
  onSignal(listener: (signal: HubSessionSignal) => void): () => void;
  /** 'terminateUnauthorized' 控制信号（revoke 链；幂等；无通道则 resolve）。 */
  terminateUnauthorized(): Promise<void>;
  /** 'close' 控制信号：同步前缀 quiesce + 异步尾 cleanup；幂等（重复返回同一 promise）。 */
  close(): Promise<void>;
}

export interface HubSessionHost {
  /** 同步开启一个 (连接, namespace) 会话（同一 handle 只服务该 ns；(connectionKey, namespaceId) 唯一属宿主前置条件）。 */
  open(input: HubSessionOpenInput): HubSessionHandle;
}

export function createHubSessionHost(config: HubSessionHostConfig): HubSessionHost;
```

**逐成员语义（冻结）**：

| 成员 | 冻结语义 | 依据 |
| --- | --- | --- |
| `open` | 同步返回句柄（宿主可在任何帧到达前注册 sink）；描述子纯 JSON；前置条件：`connectionKey` 非空且 (connectionKey, namespaceId) 在宿主侧唯一（**违反属宿主契约违反，不在本票验收面**；设计可自行选择响亮拒绝，无需断言）；session 对象随连接存活（终态不拆）；`authorization` 只接受 ok-投影（denied/throw **不过缝**，由 edge 处置） | ADR 决策 2/3；CONTEXT.md:230；issue 正文 |
| `handleFrame` | 解码 namespace 域帧（`selectedCapabilities` 作为 capability 门控透传，与 `hub-edge.ts:378-386` 同源判据）；**禁止传 `expectedSequence`**（AC5）；分派与 #418 `namespaceFrame` 同构：`OPEN_NAMESPACE`→通道 OPEN 矩阵（authorize shim = 闭包回放 `authorization`；`registry.open(authorization.localOwner, nsId)`）、其余 namespace 域 kind→既有通道处理器；连接级/方向域 kind 静默（与内部 default 分支同构）；fire-and-forget（无接纳信号/无回压） | `hub-namespace.ts:346-362`；`hub-session.ts:115-172`；ADR 决策 2 |
| `onFrame` | 出站帧为 **sequence=0 占位编码**；`lane` 区分控制/数据（宿主据此调 `sendControlFrame`/`sendDataFrame`）；**返回被分配的 wire 序**（0=未发送/被拒），该值即 session 侧发送记账结果（bootstrap/live ACK 结算依赖它）；至多一个 sink | E1；`frame-io.ts:139-197`；`hub-edge.ts:216-217` |
| `onSignal` | `settled`：通道进入终态时**恰一次**（edge 的 drain 提前完成判据 `hub-edge.ts:689-707`）；`connection-fatal`：请求 edge 执行连接级致命（ERROR + close；**code→close code 映射归 edge**）——`ac5-live.test.ts:133-142` 的 `ACK_STATE_VIOLATION` 场景必须可经此到达 wire | `hub-namespace.ts:662,1099`；`hub-edge.ts:619-644,689-707` |
| `terminateUnauthorized` | ≈ 内部 `terminateNamespace(nsId)`（revoke 链；`hub-session.ts:278-282`）；幂等、无通道 resolve | ADR 决策 2/5 |
| `close` | ≈ `HubSessionSink.close()`（同步 quiesce + 异步 cleanup 汇流；幂等） | `hub-session.ts:269-275` |

**test-d 锁定文件**：`packages/ws-replication/test/ws-replication-issue420-session-host-api.test-d.ts`，至少含：

1. 正向：`expectTypeOf(createHubSessionHost).parameter(0).toMatchTypeOf<HubSessionHostConfig>()`；`.returns.toMatchTypeOf<HubSessionHost>()`；`HubSessionHost['open']` 参数 `HubSessionOpenInput`、返回 `HubSessionHandle`；`handleFrame(Uint8Array)→void`；`onFrame(HubSessionFrameListener)→()=>void`；`HubSessionFrameListener` 返回 `number`；`close()/terminateUnauthorized()→Promise<void>`；`onSignal` 参数 `(signal: HubSessionSignal) => void`；`HubSessionOpenInput['authorization']` 精确等于 `Extract<NamespaceAuthorization,{ok:true}>`；`connectionId: string | undefined`。
2. 负控（**`@ts-expect-error` 必填**，以「未使用指令报 TS2578」自证敏感性）：
   - `authorization: { ok: false }` 不得通过（denied 不过缝）；
   - 工厂配置掺 `authorize`/`transport`/`port` 键不得通过（authorize 不在 session 侧调用）；
   - 句柄 `namespaceFrame(...)`（已解码消息面）不得存在；
   - `onFrame(() => undefined)`（无 number 返回）不得通过。
3. 运行时导出面：`Object.keys(公共入口)` 相对 #418 冻结集**恰增 `createHubSessionHost`**（其余 11 名不变）——由 C5a 追加行承载（§12.6）。

> **SA6 追加项声明（超出 issue 正文枚举的三处，逐条附硬证据）**：issue 只点名 `handleFrame`/`onFrame`/`close`。
> 本契约补齐的 `onSignal`（`settled`/`connection-fatal`）与 `terminateUnauthorized` **不是**自由发明：
> ① `settled` 是 ADR 决策 2 明文列出的 session→edge 控制信号，且是 edge 提前收 drain 的唯一判据（`hub-edge.ts:689-707`）；
> ② `connection-fatal` 是零 diff 通道的既有出站信号（`hub-namespace.ts:662,1099`），且被矩阵文件
> `ws-replication-ac5-live.test.ts:133-142`（`ACK_STATE_VIOLATION` connection fatal）实际触发 ⇒ 缺它 AC3 必红；
> ③ `terminateUnauthorized` 是 ADR 决策 2 的 edge→session 信号（revoke 链），缺它 shard 形态无法 revoke。
> 三者都保持「纯 JSON / 字节」的缝纪律，且公共同步面一经 test-d 锁定即 append-only（S6）。

**当前红灯状态（已实测）**：该文件现在必然红（`artifacts/sa6-issue420-runner-trigger-red.log` 的 3 条 `TypeCheckError`，及 `artifacts/sa6-issue420-type-lock-red.log` 的 8 × TS2305）。

### 12.2 AC2 — 内存管道对驱动完整回合

**文件**：`packages/ws-replication/test/issue420-shim-hub.ts`（夹具）+ `packages/ws-replication/test/ws-replication-issue420-session-host-round.test.ts`。

**装配（无 socket 无 worker）**：真 `createPeerReplication` ↔ `makeWire()`（内存双端）↔ hub 侧 = 真 `createHubReplicationEdge`（连接级半边，`createHubReplicationEdge`） + **内存管道对**（夹具桥） + 公共 `createHubSessionHost`（session 半边）+ 真 Registry/Runtime fixture。夹具职责（**只搬运**）：`accept/acceptTrusted`（宿主职责：`verifyToken`→identity）、`sessionFactory(port)` 返回 `HubSessionSink` 代理；首 OPEN 到达点：`port.openAdmission(ns)` 取已结算投影 → `open(descriptor)`（纯 JSON）→ 转发 OPEN 帧字节；后续帧 `encodeMessage(message,{sequence})` → `handleFrame(bytes)`（顺序保真 + 有界 pending 窗口，S2）；`onFrame((frame,lane)=>port.sendControlFrame/sendDataFrame(frame))` 原样回传返回序；`onSignal` → `port.onChannelSettled` / `port.connectionFatal(code)`；`close()`/`terminateNamespace()` → 句柄方法。

**必需断言（全部为运行时行为/wire 原字节）**：

| # | 断言 | 目标期望 |
| --- | --- | --- |
| A1 | 能力门：公共入口 `typeof createHubSessionHost === 'function'` | 绿 |
| A2 | 缝纯度：描述子 `structuredClone` 深等（纯 JSON）；`handleFrame` 收到的每一项 `instanceof Uint8Array`；sink 返回 `number` | 绿 |
| A3 | 缝纪律：`handleFrame` 观察到的 kind 全集 ⊆ namespace 域 kind；无 `HELLO`/`HELLO_ACK`/`GOAWAY`/方向域帧 | 绿 |
| A4 | OPEN：wire 恰一 `OPEN_OK`；`authorize` 恰一次且**发生在 edge 侧**（`run.authorizer.calls.length===1`）；session 侧结构性无授权器（§12.1 的 `@ts-expect-error` 负控）；描述子换 `PEER_OWNER`（`registry.open` 主人不符）→ 无 `OPEN_OK` 且 `NAMESPACE_UNAUTHORIZED` | 绿 |
| A5 | bootstrap：wire 恰一 `BOOTSTRAP_SNAPSHOT`；对端 `BOOTSTRAP_ACK(ackedSequence = 快照帧 wire 序)` → 通道 `bootstrapping→reconciling`（**序回传承重锚**，E1 臂 A/B 对照） | 绿 |
| A6 | reconcile：`SYNC_STEP1/2/SYNC_APPLIED` 齐备 → hub/peer 双方 live；`peer doc` 与 `hub doc` 收敛（`encodeStateAsUpdate` 等价） | 绿 |
| A7 | live 双向往返：peer→hub `UPDATE` 落盘 + `UPDATE_ACK(ackedSequence = 入站 wire 序)`；hub 侧真实写 → `UPDATE` 出帧 + peer ACK 结算（`update-acked`，零 `resync-required`） | 绿 |
| A8 | sequence 单点：全部 wire 帧 `[8..12]` 自 1 严格 +1、**无 0 占位泄漏**；`handleFrame` 收到的帧仍带占位 0（缝内占位语义） | 绿 |
| A9 | CLOSE：peer `CLOSE_NAMESPACE` → `CLOSE_OK(ackedSequence = 入站 wire 序)`；`settled` 信号恰一次（桥记录）并转发至 edge；通道终态 | 绿 |
| A10 | revoke：`handle.terminateUnauthorized()` → 该 namespace 离开 live（双方终态/收口帧），零 connection-fatal | 绿 |
| A11 | drain/收尾：`hub.close()` resolve；`settle()` 后无残留 timer/未决 promise；`collectUnhandledRejections` 为空 | 绿 |
| A12 | **红臂（变异正控，同文件第二用例）**：把桥 sink 改为返回 0 → 同一回合必须在 bootstrap ACK 处响亮失败——**断言（绿）= 观察到 `ACK_STATE_VIOLATION` connection fatal / 连接收口；被断言的对象（回合结果）= 红**。证明 A5 对「无回传」敏感 | 断言绿 / 回合红 |

### 12.3 AC3 — 现有 hub-namespace 矩阵在 shim 上重跑绿灯

**必需（硬）**：`ac1-ac2-open`(12) / `ac3-bootstrap`(4) / `ac4-reconcile`(5) / `ac5-live`(7) / `ac6-resync-close`(7) / `ac7-faults`(12) / `periodic-reconcile`(5) 七文件在默认（listen）运行中**断言逐字不变**且全绿（基线 52 tests，§4）；同时这些**同一批场景体**必须在 shim 装配上执行并全绿——机制由设计三选一（交付说明须写明选了哪个）：

- (a) **推荐**：`ws-replication-issue420-shim-matrix.test.ts` 用 `vi.mock('@nomicore/ws-replication', …)` 仅替换 `createHubReplication` 为 shim hub 工厂后动态 `import('./ws-replication-ac1-ac2-open.test.js')` 等七个文件 ⇒ 同一份断言代码在 shim 装配下第二次注册/执行（零改矩阵文件）。
- (b) vitest 项目/别名：新增 shim 项目 + `issue420-shim-alias.ts`（re-export 全量、仅换 `createHubReplication`），同一批文件在 shim 项目下重跑。
- (c) 矩阵文件参数化：`describe.each([{assembly:'listen'},{assembly:'shim'}])`，断言体逐字不变、listen 臂保留。

**反空跑（必需）**：shim 运行必须自证真的走了 shim——夹具记录 `connectionsOpened` / `sessionsOpened` / `seamFramesIn/Out`，runner 断言 ≥ 期望（例如每 ns 每连接 ≥1 `open()`、缝内双向 ≥N 帧、全部 wire 序列非 0）。**负控**：把替换关掉（或指向 listen 工厂）时该断言必须失败（M4）。

**零 fork（必需）**：`git diff` 中 `packages/ws-replication/src/hub-namespace.ts` **零 diff**；夹具内无协议决策（无 `selectCapabilities`/`decodeInbound`+`expectedSequence`/序列分配/路由键偏移/FSM），唯一变换 = 已解码消息↔字节的中继（E3 证明逐字节保真）+ port 成员搬运。

**runner 层证据（当前已实测，映射本契约路径）**：`artifacts/sa6-issue420-runner-trigger-red.log`——契约路径的临时运行探针被 vitest 发现并红在能力缺口（`typeof === 'undefined'`），同 run 的负控（既有工厂 + listen 全回合）2/2 绿。

### 12.4 AC4 — 缝两侧只过 `Uint8Array` 与纯 JSON；包内零 worker 依赖/类型

| 判据 | 形态 | 当前 |
| --- | --- | --- |
| C4a 结构门（**补充**结构判据，AC 明文要求） | `packages/ws-replication/src/**` + `package.json` 对 `worker_threads|MessageChannel|MessagePort` 命中 0（测试内以 `node:fs` 读源扫描，单一模式常量） | 绿（`PASS A.zeroWorkerApiReferences`，须保持） |
| C4b 描述子纯 JSON | `structuredClone(input)` 深等 + `JSON.stringify` 往返等值；负控：掺函数 → `DataCloneError` | 机制已证（N4） |
| C4c 帧即字节 | 缝内进出项 `instanceof Uint8Array` 且 header 占位 0（出）/wire 序（入） | 机制已证（E4） |
| C4d 无 live 对象过缝 | 缝上不出现 `HubNamespaceChannel`/`NamespaceLease`/`Y.Doc`/`ReplicationSession`（以 `structuredClone` + `instanceof` 断言，夹具侧记录） | 目标白盒断言 |

> 纪律说明：C4a 是本契约唯一以「源码扫描」为**补充**的判据（AC 字面即要求「零依赖或类型」）；行为面由 C4b/C4c/C4d 与 §12.2 A2/A3/A8 承载，二者不得互相替代。

### 12.5 AC5 — session 侧重检入站 sequence 的代码不存在

| 判据 | 形态 | 期望 |
| --- | --- | --- |
| C5a 行为正锚（**主判据**） | 回合进入 live 后，经桥以**回退/重复序**投递 namespace 域帧（如 `CLOSE_NAMESPACE` seq=2，此前已消费 5）→ 该帧仍被消费，回帧/ACK 携带**该**序；零 fatal、零额外 close | 绿（通道行为已证：E2-B；目标形态须经 `handleFrame` 可达） |
| C5b 行为负控 | 同一非法序在 **edge** 侧 → `SEQUENCE_VIOLATION` + `close(1002,'protocol-error')` + 零缝投递 | 绿（E2-A，已实测） |
| C5c 补充结构门 | `hub-session-host.ts` 的解码调用不含 `expectedSequence`（模式命中 0） | 目标绿 |
| C5d 敏感性 | M5：给 session 解码加 `expectedSequence` → C5a 必红 | 变异必做 |

### 12.6 红/绿期望矩阵与既有冻结锚的**授权编辑**

| 验收件 | 旧实现（HEAD 7039f6d） | 目标实现 | 实测证据 |
| --- | --- | --- | --- |
| AC1 test-d | **红**：TS2305 ×8（+ vitest `TypeCheckError`） | 绿：零类型错误 + 负控 `@ts-expect-error` 全部被触发 | `artifacts/sa6-issue420-type-lock-red.log`；`…runner-trigger-red.log` |
| AC2 回合测试 | **红**：能力门 `typeof === 'undefined'`（加载期即缺导出） | 绿：A1~A11 全绿；A12 红臂按预期红 | `…runner-trigger-red.log` |
| AC3 shim 矩阵 | **红**：无公共工厂 ⇒ 无法装配 shim hub（G1~G4/G7） | 绿：listen 52 tests 保持 + shim 臂同场景数全绿 + 反空跑断言绿 | `…baseline-matrix.log`（listen 基线） |
| AC4 结构门 | 绿（须保持） | 绿 | `…seam-purity-gate-probe.log` |
| AC5 锚 | 通道行为已在（E2-B），公共入口缺 ⇒ 目标断言红 | 绿（C5a~C5c） | `…sequence-discipline-probe.log` |

**授权的一次性编辑（除此外既有测试文件不得改动）**：

1. `…issue418-edge-session-split-contract.test.ts:144-156`：`FROZEN_PRODUCTION_EXPORTS` **追加** `createHubSessionHost`（零删除、零重排；`:551` 断言形态不变）。
2. `…issue418-edge-session-split-structure.test.ts`：机械跟随内部重命名（`:13` 注释、`:39` 导入、`:421/:528/:571/:594` 调用、`:618` 期望列表 → `['createHubSessionSink']`）；其余断言逐字不变。

> 重命名理由：公共面必须叫 `createHubSessionHost`（ADR 决策 5「SessionHost 双轨（工厂 + 免 listen 插件服务）」的工厂轨；与 `/testing` 及服务名 `nomicoreHubSessionHost` 命名对称）。若内部 splice 保留同名，包内将出现**两个同名不同形**的工厂（一个吃 `HubSessionEdgePort`、一个吃 `HubSessionHostConfig`），且新模块内部要复用 splice ⇒ 自引用/误用风险；重命名是零行为机械改动，其安全性由「全量 588 tests + 结构测试绿」背书（#418 已把模块面命名交给实现票维护）。
> 备选（记录但**否决**）：公共名取 `createHubNamespaceSession` 以回避重命名——与 ADR/宿主预期名不符，且把「工厂轨」的名字从公共面上抹掉。

### 12.7 变异敏感性（交付说明必须登记实跑结果）

| 变异 | 期望 |
| --- | --- |
| M1 桥 sink 返回 0 | AC2 A5/A7 红（bootstrap ACK 违约 / `send-frame-rejected` resync）（E1 已证机制） |
| M2 桥丢弃/迟发 OPEN 帧 | A4 红（无 `OPEN_OK`） |
| M3 桥自行分配/二次盖章序列 | A8 红（占位泄漏或连续性断裂） |
| M4 关闭 shim 替换（矩阵臂跑回 listen） | AC3 反空跑断言红 |
| M5 session 解码传 `expectedSequence` | C5a 红 |
| M6 公共入口去掉导出 | AC1/AC2 红（= 当前 HEAD 状态，已实测） |

## 13. Red/green or baseline evidence

| 证据 | 文件 | 结果 |
| --- | --- | --- |
| 包全量基线 | `artifacts/sa6-issue420-baseline-package-suite.log` | 77 files / 588 tests passed，Type Errors no errors，exit 0 |
| hub-namespace 矩阵基线 | `artifacts/sa6-issue420-baseline-matrix.log` | 7 files / 52 tests passed，exit 0 |
| 能力缺口探针（含负控） | `artifacts/sa6-issue420-capability-gap-probe.log` | `PROBE_RESULT 10/10`，能力缺口 CONFIRMED |
| 类型层红灯 | `artifacts/sa6-issue420-type-lock-red.log` | 8 × TS2305 + 4 × TS2578，`[tsc exit: 2]` |
| runner 触发 + 红因 + 负控 | `artifacts/sa6-issue420-runner-trigger-red.log` | 临时契约路径文件被 runner 发现：回合探针红（`undefined`）/ test-d 红（3 TypeCheckError）/ 负控 2 tests 绿 |
| 因果（序回传承重） | `artifacts/sa6-issue420-causality-probe.log` | `7/7`，LOAD-BEARING |
| 因果（sequence 单点） | `artifacts/sa6-issue420-sequence-discipline-probe.log` | `2/2`，edge 单点 + session 零重检 |
| AC4 结构门/纯度 | `artifacts/sa6-issue420-seam-purity-gate-probe.log` | `4/4`，基线绿（须保持） |
| 桥中继保真 | `artifacts/sa6-issue420-bridge-relay-fidelity-probe.log` | `2/2`，14 帧逐字节相等 |
| 3× 稳定性 | `artifacts/sa6-issue420-stability-3x.log` | 15 次运行逐轮一致 |

## 14. Runner trigger evidence

- **发现机制**：根 `vitest.config.ts:17` `include: ['packages/*/test/**/*.test.ts', …]` ⇒ §12.2/§12.3 的 `.test.ts` 由 `pnpm test`（`NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`）与任何 `vitest run <path>` 发现；`vitest.config.ts:21` `typecheck.include: ['packages/*/test/**/*.test-d.ts']` + `tsconfig.typecheck.json`（`packages/*/test/**/*.ts`）⇒ §12.1 的类型冻结由 `--typecheck` 发现并执行。
- **实测（HEAD，契约路径）**：临时在 `packages/ws-replication/test/ws-replication-issue420-{session-host-round.test.ts,session-host-api.test-d.ts,negative-control.test.ts}` 落文件 → `vitest run --typecheck <三路径>` 报 `Test Files 2 failed | 1 passed (3)`、`Tests 1 failed | 3 passed`、`vitest exit=1`，红因逐条可读：`expected 'undefined' to be 'function'`（运行侧缺导出）与 `TypeCheckError: Module '"@nomicore/ws-replication"' has no exported member 'HubSessionHandle' / 'HubSessionHost' / 'HubSessionHostConfig'`（类型侧）。负控文件（同一 runner、同一 fixture、同一导入机制）2 tests 绿（既有公共工厂在场 + listen 全回合）⇒ 红是能力缺口而非入口/夹具错误。日志：`artifacts/sa6-issue420-runner-trigger-red.log`。**三个文件运行后已删除**（§16）。
- **探针不干扰门禁**：`artifacts/sa6-issue420-*.mts` 不在任何 include 模式内——包全量套件在探针落盘**之后**重跑仍为 77 files / 588 tests（与落盘前一致，§4 两日志对比）。
- **实现后须执行的触发命令**：见 §12.0；AC3 若选机制 (a)/(b)，须额外以 `vitest run --typecheck <shim 矩阵路径 or --project shim>` 记录 shim 臂的运行输出。

## 15. Unknowns and blockers

| # | 项 | 状态/要求 |
| --- | --- | --- |
| U1 | 公共工厂名 `createHubSessionHost` + 内部 splice 重命名为 `createHubSessionSink` | 本契约冻结（理由见 §12.6）；若 SA10/SA8 认为重命名不可接受，必须以「包内两名不同形工厂」的等值论证换取，并保持 §12.1 公共面与 test-d 锁定不变（否则按 conflict 流程回退设计） |
| U2 | **真 worker（异步 pipe）形态未解** | 本契约冻结的是**同步宿主 pipe** 面（`onFrame` 同步返回被分配序，E1 证明必需）。真 worker 需 append-only 追加「迟归序回传」机制或改判缝形态（#418 R5''/R8'' 义务）；本票不得声称已解决该形态 |
| U3 | 拒绝路径（`denied`/`throw`）在 shim 形态的归属 | 设计须二选一并给出证据：(i) edge 处置（ADR 决策 3 字面：未授权 OPEN 不过缝 → 需 edge 复现 `NAMESPACE_UNAUTHORIZED` + 拒绝闩锁）；(ii) session 回放已结算 admission（#418 现状）。无论哪种，`ac1-ac2-open` 的 deny/readDeny/submitDeny 断言（`NAMESPACE_UNAUTHORIZED` ×1、authorize 恰一次、注册表零打开）必须保持绿 |
| U4 | `connectionKey` 的消费方 | 冻结为宿主不透明连接身份（非空校验）；nomicore 不解释。若设计发现需要更强的语义（如 observer 关联键），须 append-only 记录 |
| U5 | **无 #420 的 SA8 产物** | #418 R5'' 明确 worker 形态票为**既定前置门禁**：本契约（新缝面/公共面）须作为 SA8 复查输入；实现合入前需 SA8 clear |
| U6 | ADR 0032:22 / CONTEXT.md:230 文本调和（R7''/R8''） | worker 形态票 SA8 前置门禁之前或之中须落 ADR 修订/澄清附录（本 PR 可 documentation-only 先行）；不得以机制句字面迫使回退形态 |
| U7 | AC3 的机制选择（a/b/c） | 设计择一并记录；反空跑断言 + 变异 M4 为强制项 |
| U8 | water gate 休眠降级（`dataGateOpen→true`）与 listen 形态「暂停」语义的差异 | 决策 5 已接受（连接级总量保护收敛 edge）；须在 SA10/ADR 侧显式登记，并确保 backpressure/shed 家族测试（issue137/169 等）不在 shim 矩阵臂中静默改语义（本契约的 7 文件矩阵不含该族，故不冲突） |
| U9 | `terminateUnauthorized` 场景未被 7 文件矩阵覆盖 | 由 §12.2 A10 独立承载；跨进程 revoke 全链路仍留后续票 |
| U10 | periodic reconcile / timer 归属 | 会话侧计时器一律用工厂配置注入的 `timer`（既有纪律）；shim 夹具须把同一 scheduler 交给 edge 与 session（`BootOptions.hubNode.scheduler`） |

## 16. Temporary diagnostics cleanup

| 项 | 处置 |
| --- | --- |
| 临时 vitest 探针（3 文件，位于契约测试路径） | **已删除**：`packages/ws-replication/test/ws-replication-issue420-{session-host-round.test.ts,session-host-api.test-d.ts,negative-control.test.ts}`；`ls packages/ws-replication/test | grep -c 420` = 0 |
| 临时 smoke 脚本 | 已删除（`artifacts/sa6-issue420-smoke.mts`、`/tmp/sa6-420-smoke.mts`） |
| 生产代码/交付测试 | **零改动**：`git status --short` 仅显示 `artifacts/sa6-issue420-*`（新证据）与既有未跟踪 `wiki/raw/task_issue-420.md`；`packages/**` 与 `docs/**` 无 diff |
| 长驻服务/后台作业 | 无（探针为一次性前台命令；vitest 无 watch；无 nohup/setsid/PID 文件/轮询） |
| 保留的诊断资产（非临时） | `artifacts/sa6-issue420-{capability-gap, causality, sequence-discipline, seam-purity-gate, bridge-relay-fidelity}-probe.mts` + `.log`、`artifacts/sa6-issue420-type-lock-probe/{probe.ts,tsconfig.json}`、`artifacts/sa6-issue420-{type-lock-red,runner-trigger-red,baseline-package-suite,baseline-matrix,stability-3x}.log`——复现命令见各 `.mts` 文件头（统一前缀 `NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx`） |

## 附：artifactPaths（worktree-relative）

```text
wiki/raw/task_issue-420_sa6_contract.md
artifacts/sa6-issue420-capability-gap-probe.mts
artifacts/sa6-issue420-capability-gap-probe.log
artifacts/sa6-issue420-causality-probe.mts
artifacts/sa6-issue420-causality-probe.log
artifacts/sa6-issue420-sequence-discipline-probe.mts
artifacts/sa6-issue420-sequence-discipline-probe.log
artifacts/sa6-issue420-seam-purity-gate-probe.mts
artifacts/sa6-issue420-seam-purity-gate-probe.log
artifacts/sa6-issue420-bridge-relay-fidelity-probe.mts
artifacts/sa6-issue420-bridge-relay-fidelity-probe.log
artifacts/sa6-issue420-type-lock-probe/tsconfig.json
artifacts/sa6-issue420-type-lock-probe/probe.ts
artifacts/sa6-issue420-type-lock-red.log
artifacts/sa6-issue420-runner-trigger-red.log
artifacts/sa6-issue420-baseline-package-suite.log
artifacts/sa6-issue420-baseline-matrix.log
artifacts/sa6-issue420-stability-3x.log
```
