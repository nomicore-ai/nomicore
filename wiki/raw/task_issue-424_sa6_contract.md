# task_issue-424 SA6 诊断与验收契约 — 分片形态端到端等价性验收（spec #415 T7）

- Issue：#424（标题「分片形态端到端等价性验收（spec #415 T7）」，state=open，Issue updated at 2026-09-22T00:33:11Z；Parent = PR #416 `spec/415-replication-transport-decoupling`）
- 任务类型：**Feature / 阶段收官验收**（能力缺口 = **验收装配与等价性证据缺位**：无「一条连接 × 多 session host 实例」的 ingress/worker 分片 harness，无单体 vs 分片四态授权逐字节 parity 套件，无经**公共工厂**的跨缝完整回合与生命周期证据；**不是**生产行为缺陷）
- HEAD：`cab3e8c245ef189da1d823719370a68459939316`（`Merge pull request #431 … mabf/issue-422`；#418/#419/#420/#421/#422/#423 全在该基线内）
- 结论：**`approve`** —— 能力缺口 4/4 可运行证据化；目标行为 oracle 14/14 在 HEAD 实测可达（真 Registry/Runtime + 真 peer）；验收契约可执行、测试入口真实（runner 发现性实测）、断言经 5 条红臂证明敏感；范围决策 SD-1~SD-4 留 SA8/设计。
- 本文件是唯一固定报告；可执行证据 = `wiki/raw/task_issue-424_sa6_capability_probe.mts`（探针：4 GAP + 14 ORACLE/NC + 5 红臂变异开关）、`artifacts/sa6-issue424-{baseline,probe-green,mutation-sensitivity,runner-trigger}.log`（4 份）。
- 本轮**未写入任何生产实现与交付测试**（dispatch 明示「Do not implement or author tests」）：`git status` 仅见 `wiki/raw/task_issue-424*` 与 `artifacts/sa6-issue424-*.log`；`packages/**` 零改动（§16）。

---

## 1. Task type and inputs

**读了什么**

| 输入 | 位置 | 用途 |
|---|---|---|
| Host 任务简报 | `wiki/raw/task_issue-424.md`（35 行） | Issue 正文：Parent（PR #416）、What to build（内存管道 + edge/多 session host 分片拓扑 + 授权等价性 + 跨缝回合 + 多 worker 序列）、AC1–AC6、Blocked by #420/#421/#422、Comments 空 |
| ADR 0032（已接受） | `docs/adr/0032-transport-decoupling-edge-session-split.md` L12–68 | 决策 1（单体 = 进程内组合，协议状态机单份）、2（缝只过字节 + 纯 JSON、出站占位 + mux 点盖章、wire 逐字节不变）、3（authorize 在 edge、未授权 OPEN 不过缝、准入管线 edge 职责）、4（路由键定偏移 + ERROR mini-decode）、5（观测归属 + dormant 降级）、澄清附录 A1–A3（信号词汇公共化、载体三分 α/β/γ、降级面登记） |
| 协议规范 | `docs/protocols/instance-replication-v1.md` §6/§7/§13/§14/§17/§21/§22/§23 | 身份与序纪律、OPEN/CLOSE 回合、错误码与 close 分类、admission 有界、shutdown/reauth drain、conformance、观测§23.1 登记差异（未授权 OPEN 无 `channel-state-changed`） |
| 前序票设计/契约（T3–T6） | `wiki/raw/task_issue-420_design.md`、`task_issue-420_sa6_contract.md`、`task_issue-421_design.md`、`task_issue-421_sa6_contract.md`、`task_issue-422_sa6_contract.md`、`task_issue-423_*` | 公共面冻结事实：`createHubSessionHost`（#420）、`createHubReplicationEdge`（#421）、`listen:false` 服务（#422）、发射点归属（#423）；各自明示留给 T7 的验收面 |
| 生产源码 | `packages/ws-replication/src/{index,hub-edge, hub-edge-host,hub-session-host,hub-session,hub-split,hub-connection,plugin,testing,defaults,validate,types}.ts`；`packages/namespace-registry/src/{testing,create-document}.ts` | 能力缺口岗位事实与目标行为 oracle（§5/§8） |
| 既有测试与夹具 | `packages/ws-replication/test/{harness.ts,driver.ts,issue420-shim-hub.ts,ws-replication-issue42*.test.ts}` | 最接近覆盖（#420 单例 host 桥、#421 edge stub sink、#422 插件 teardown）、可复用基建（真 Registry/Runtime、内存 wire、`boot()` 注入缝） |
| Runner / 配置 | `vitest.config.ts`、`tsconfig.base.json`、`tsconfig.typecheck.json`、`packages/ws-replication/{package.json,tsconfig.json}` | 发现规则（`packages/*/test/**/*.test.ts`；`--typecheck` include `**/*.test-d.ts`）、exports 条件（`nomicore-source` → `src/index.ts`） |

**缺失输入（→ §15）**：SA8 固定位置产物（`task_issue-424_design.md` / `_design_conflict_report.md` / `_relevant_decisions.md`）**均不存在**；Issue 评论 REST 快照为空（dispatch 明示 `[]`）。契约由简报 AC + ADR 0032 + 协议规范 + 前序票已冻结事实 + 源码/运行期实测推导。

**为什么是 Feature（阶段收官验收）而非 Bug**：ADR 0032 拆分的两半边及其公共出面（#418 → #421）已交付；探针在 HEAD 上把简报要求的拓扑**手工装配后实测**：四态授权 wire 的控制帧语料逐字节相等（O1/O2/O2-latch）、多 worker demux/mux 与 per-connection 严格递增（O3/O6）、终结传播（O4）、revoke/reauth 路由（O5/O9）、真 peer 完整回合（O8）——**现行实现无行为缺陷**。缺的是**验收交付物本身**：分片 harness、四态 parity 套件、跨缝回合套件与收官门禁记录（§5 G1–G4）。因此红灯只能来自「验收证据缺位」（发现面 0 + 无装配面），并由红臂变异证明契约断言敏感（§9）；**不虚构 Bug 根因**。

## 2. Owner comment mapping

Issue 评论 REST 快照为空（`[]`）——**无 Owner 附加要求**，无评论 id/时间戳可映射。Owner 要求 = 简报正文。逐项映射：

| 简报条目（原文要点） | 契约条目 | 本轮可执行证据（probe id） |
|---|---|---|
| AC1：授权等价性矩阵逐帧一致：通过 / `NAMESPACE_UNAUTHORIZED` 拒绝 / authorizer 抛错 `INTERNAL_ERROR` / 闩锁期重 OPEN 拒答，四形态单体 vs 分片 wire 逐字节相同 | AUTH-C1~AUTH-C5（§12.1） | O1-O2-four-forms（pass/deny/throw 控制帧逐字节等）、O2-latch（闩锁拒答逐字节等）、NC2/NC3（重开矩阵与 authorize 恰一次） |
| AC2：跨缝完整协议回合绿灯：OPEN→bootstrap→live→reconcile→CLOSE，含 `UPDATE_CHUNK` 协商与非协商两形态 | ROUND-C1~ROUND-C4（§12.2） | O8（真 peer 非协商整回合：OPEN_OK/BOOTSTRAP/SYNC_STEP1-2-APPLIED/live/CLOSE_OK/settled）；NC4（协商形态 OPEN 相 parity + 描述符协商位；**协商形态的完整回合**待实现票按 ROUND-C4 落地） |
| AC3：一条连接复用多 namespace 分属不同 session host 实例：帧 demux/mux 正确、出站 sequence 严格递增 | SHARD-C1~SHARD-C3 + SEQ-C1（§12.3） | O3（w0/w1 各恰一描述子与会话；出站序 [1..5] 严格递增）、O6（第二连接 per-connection 重新起算） |
| AC4：连接终结传播：edge 关闭 → 全部 session close 信号到达且资源释放（无泄漏断言） | TERM-C1~TERM-C3（§12.4） | O4（close 后 2/2 session closeCalls ≥1、state=closed、零新出站、零 unhandled） |
| AC5：revoke/reauth 经 edge 入口路由到正确 session（`terminateUnauthorized` 信号）且 wire 行为与单体一致 | REVOKE-C1~REVOKE-C3 + REAUTH-C1~C2（§12.5） | O5（末帧逐字节等 + terminateCalls=1 + 跨 worker 零外溢）、O9（GOAWAY→drain 提前完成 1001） |
| AC6：既有 listen 模式全量套件 + 根 `pnpm typecheck`/`test` 绿灯（阶段收官门禁） | GATE-C1~GATE-C3（§12.6） | §4 基线（455 文件/5559 测试/0 类型错误/exit 0；根 typecheck exit 0） |
| 「用内存管道把 edge 与多个 session host 实例按『一条连接、多 namespace、多会话宿主』拓扑接线（模拟 nomic-server ingress/worker 分片）」 | 交付路径 §12.0 + SHARD 组 | G1–G4（现有装配面缺位）、O3/O8（探针装配证明可接线） |
| 「证明 ADR 0032 的语义等价承诺」 | AUTH 组（授权等价）+ ROUND 组（语义等价） | O1–O10 |

## 3. SA8 constraints

无 SA8 设计产物可读（§15-1）。契约继承的硬约束（全部已在库、不可协商）：

1. **ADR 0032 决策 1（协议状态机单份）**：单体 listen 模式 = `HubReplicationEdge` + `HubSessionSink` 的**进程内组合**（`hub-connection.ts`）；分片形态只能分布式实例化同一实现，**不得**产生第二份连接级状态机（L14）。→ 分片 harness 只许装配公共工厂，不许自写协议行为。
2. **决策 2（wire 逐字节不变）**：缝上只有 namespace 域帧（`Uint8Array`）+ 纯 JSON；入站 sequence 由 edge 校验（header-only）；出站帧 session 侧以 `sequence=0` 占位编码、edge 在 mux 点重写 `[8..12]`（L18）。→ AUTH/SEQ 组的逐字节硬门与出站序判据。
3. **决策 3（authorize 在 edge 单点，未授权 OPEN 不过缝）**：edge 全解码 OPEN 后调宿主注入的 `NamespaceAuthorizer`；`denied`/`throw` 的 wire 行为由 edge（公共形态）/生产通道（listen 形态）产出；「pending 有界缓冲、并发 OPEN 上界、sink 解析失败响亮收口、drain 门、session 对象随连接存活」均为 edge 职责（L22）。→ AUTH-C2/C3 的「零会话」断言与 REVOKE 路由断言。
4. **决策 4（路由键 O(帧头)）**：合法无 sink → 合成 `NAMESPACE_STATE_VIOLATION`；违例 → `MALFORMED_FRAME` fatal（L26）。→ NC1/NC-parity 语料。
5. **决策 5 + 澄清附录 A1/A2/A3**：observer 发射点 = 拥有事实的一侧（连接域在 edge、namespace 域在 session）；`dataGateOpen`/`bufferedAmount`/assembly 槽在公共 byte-seam 形态按 dormant/per-session 降级（A3）；`settled`/`closed`/`connection-fatal` 的公共载体已登记（A1）；未授权 OPEN 的 `channel-state-changed` 形态差异已登记（协议 §23.1）——**本契约只锁 wire，不锁 observer 事件集**（否则会制造假红，§11-H8）。
6. **协议 §21 + ADR 0010（shutdown/reauth）**：GOAWAY(REAUTH_REQUIRED, drain>0) + drain 提前完成（`∀ ns ∈ admissions: settled`）+ deadline 1001 兜底；terminateNamespace = ns `NAMESPACE_UNAUTHORIZED` + failed 终局。→ REVOKE/REAUTH 组。
7. **包边界（`packages/ws-replication/AGENTS.md`）**：生产 API 经 `src/index.ts`；不 fork 协议状态机；admission 全窗口有界；测试入口真实、无 skip/only/todo/env override/源码字符串断言。
8. **前序票冻结面（append-only）**：#420 `createHubSessionHost`（`HubSessionHostConfig`/`HubSessionOpenInput`/`HubSessionHandle`）、#421 `createHubReplicationEdge`（`HubReplicationEdgeOptions`/`HubReplicationEdgeConnection.egress`/`HubSessionSinkResolver`）、#422 `listen:false` 服务。**本票零公共面变更**（§12.0 DENY）。

## 4. Environment and baseline

| 项 | 值（本轮亲测；证据 `artifacts/sa6-issue424-baseline.log`） |
|---|---|
| 运行环境 | node `v24.13.0`、pnpm `10.28.2`、vitest `3.2.7`、tsx `4.23.12`、tsc `5.9.3` |
| 依赖安装 | `pnpm install --offline --frozen-lockfile` → exit 0（17 workspace projects，65 包全 reuse，零下载） |
| 工作树 / HEAD | `/home/wangjian/nomicore-fix-issue-424` / `cab3e8c245ef189da1d823719370a68459939316` |
| 根全量套件基线 | `NODE_OPTIONS=--conditions=nomicore-source pnpm test` → **455 文件 / 5559 测试全绿 / Type Errors: no errors / exit 0**（424.19s） |
| 根类型检查基线 | `pnpm typecheck` → **exit 0**（15 个 tsconfig 串行） |
| 包类型检查基线 | `pnpm exec tsc -p packages/ws-replication/tsconfig.json` → **exit 0** |
| 探针基线 | 真实源码上 **gaps=4/4 + oracles=14/14，exit 0**；重复 3 次逐行一致（`artifacts/sa6-issue424-probe-green.log`） |
| 生产/测试源码改动 | **零**：`git status` 无 `packages/**` 条目（§16） |

## 5. Positive reproduction — 能力缺口（可运行证据 4/4）

探针 `wiki/raw/task_issue-424_sa6_capability_probe.mts` 在真实源码上实测（完整输出 = `artifacts/sa6-issue424-probe-green.log`）：

```text
GAP G1 CONFIRMED 验收文件发现数=0（ws-replication/test 下 *424* 命中 0；wiki/raw 的 issue-424 产物 3 件 = 简报/契约/探针，非验收套件）
GAP G2 CONFIRMED 现有夹具单 registry 装配：foreign-worker ns=ns-b9b4e0da…无法路由到其 home worker（wire=HELLO_ACK#1 ERROR(NAMESPACE_NOT_FOUND)#2；零跨 worker 装配面）
GAP G3 CONFIRMED 公共工厂既有覆盖文件 16 件：issue421/* 的宿主 sink 全为 stub（无真 Registry/Runtime）；issue420/* 回合走内部 edge 模块 + 单例 host（单 registry）。「公共 edge 工厂 + 多公共 SessionHost」的真 Registry 组合零覆盖
GAP G4 CONFIRMED 四态授权 parity / 多 worker demux-mux 序列 / 终结传播 / revoke 路由的分片形态断言零落点（见 §O 实测：行为可达、无断言）
```

**G1 的观察面**：与 `vitest.config.ts` include 规则同构的目录观察——`packages/ws-replication/test/` 下 `*424*` 命中 **0**（本票验收套件不存在）；`wiki/raw` 下的 issue-424 产物是本报告与探针，**不是** runner 可发现的验收套件。

**G2 的运行期实证**：把 namespace 建在「另一个 worker 的 registry」里，用现有唯一宿主桥夹具（`test/issue420-shim-hub.ts`）驱动 → 该 ns 只能落 `ERROR(NAMESPACE_NOT_FOUND)`（夹具装配面 = 单 `HubReplicationOptions.registry` + 单 `createHubSessionHost`），**跨 worker registry 不可路由**。

**G3/G4 的性质**：发现性清单（显式标注为清单证据，非行为断言）：issue42x 覆盖文件 16 件的装配形态逐族核对——`issue421/*` 的 `resolveSessionSink` 全为 stub（无真 Registry/Runtime），`issue420/*` 的回合经 `../src/hub-edge.js`（内部模块）+ 单例 host（单 registry）。目标拓扑（公共 edge 工厂 + ≥2 公共 SessionHost + 真 Registry/Runtime）在任何既有验收面零覆盖。

**能力缺口的边界（诚实登记）**：缺口**只在验收交付面**——探针用同一批公共工厂 + 真 Registry/Runtime 手工装配后，简报要求的行为全部可达（§O 14/14 绿）。因此实现票的交付物是 **test-only** 的 harness + 套件 + 门禁证据，**不是**生产改动（除非套件暴露真实偏差 → §12.8 SD-1）。

## 6. Negative control

**探针内负控（观察面 = wire 原字节 / 会话计数；HEAD 全绿——实现票必须原样保留）**：

| id | 断言 | 为什么是负控 |
|---|---|---|
| NC1 | 从未 OPEN 的 ns 帧（`CLOSE_NAMESPACE`）→ 合成 `NAMESPACE_STATE_VIOLATION`、连接存活、**双形态逐字节相等** | 对照 AUTH 组「已授权 ns 正常应答」：证明 parity 断言不是「任何帧都相等/都报违例」的恒真断言 |
| NC2 | 通过形态 live 后重 OPEN → **`OPEN_OK`×2**（而非 `NAMESPACE_REOPEN_REQUIRES_RECONNECT`） | 对照闩锁形态（deny/throw 重 OPEN 拒答）：证明「重 OPEN 断言」区分建立态与闩锁态 |
| NC3 | deny 形态 **零会话**（未授权 OPEN 不过缝）；pass 形态恰一会话 | 对照 AUTH-C2/C3：证明「恰一次 authorize / 拒答」断言不是「一律建会话」 |
| NC4 | 已协商（`CAP_CHUNKED_UPDATE`）与非协商两形态 parity 均成立；描述符 `selectedCapabilities` 携带协商位 | 对照 AC2「两形态」：证明 parity 语料不依赖单一 HELLO 协商形态 |
| **O7（语料因果负控）** | 单体 vs **单体**（两个独立建文档的同 seed 命名空间）：控制帧逐字节等、**全轨迹不等**（第 2 帧起）、文档语义等 | 证明「全轨迹逐字节相等」在独立文档下**连单体自身都不成立**（Yjs clientID 随机性）——把硬门限定在确定性控制帧语料，避免制造假红 |
| 红臂对照（§9） | 5 条探针侧宿主桥单点变异各自点亮预期 ORACLE | 证明契约条目**敏感**（非空转）：不回传序→O8、错误路由→O3、不收口→O4/O8、settled 不过缝→O9、重 OPEN 不转发→AUTH/NC2/O5 |

**空评论快照负控**：本契约零评论引用（dispatch 明示 `[]`）——不存在被忽略的 Owner override。

## 7. Stability, scale and timing

- 探针 = 微任务驱动 + 假 timer + 真 Registry/Runtime（受控 clock/scheduler/randomBytes），**零真实时间、零网络、零文件 IO**（`settle()` = 300 次微任务轮转；`settleUntil` 预算内轮询）→ 确定性。**重复 3 次：3/3 `gaps=4/4 oracles=14/14`、exit 0、逐行一致**。
- 红臂矩阵**每条各跑 1 轮**（§9）；`none` 臂与绿臂逐行一致。
- 规模/时序条件：O3 用「1 连接 × 2 namespace × 2 worker」最小分片规模；O8 用真 peer 完整回合（bootstrap/reconcile/live/CLOSE）；O9 用 reauth drain 提前完成（**未 fire deadline timer**，判据 = 假 timer 零推进下 close(1001)）。无竞态压测需求——断言面是**确定性状态机 + 字节级**，与并发规模无关；有界性/背压已由 #190/#231/#300 既有套件覆盖。
- 套件耗时：根全量 `pnpm test` 424s（适合每轮实现迭代全跑）；包内新套件预计 <10s（同 #420 回合用例量级）。
- **验收套件的时间纪律**（交付约束）：只许用注入 timer/scheduler + 微任务 `settle()/settleUntil()` 驱动；禁真实 `setTimeout`/sleep/网络。

## 8. Capability gap chain（能力缺口链，非缺陷根因）

| id | 缺口 | 证据 | 影响（目标验收不可达的后果） | Confidence |
|---|---|---|---|---|
| G1 | #424 验收套件不存在（`packages/ws-replication/test/**` 零 `*424*`） | G1；§14 发现性占位实测（占位可被发现→规则真实，删除后 0） | AC1–AC6 无落点；阶段收官无证据 | 确定（实测） |
| G2 | 无「一条连接 → ≥2 session host 实例」装配 harness：现有唯一桥（#420 夹具）绑定**内部** edge + 单 registry + 单 host | G2（foreign-worker ns → `NAMESPACE_NOT_FOUND`）；`test/issue420-shim-hub.ts` L227–235（单 `createHubSessionHost`）、L692（`../src/hub-edge.js`） | 分片拓扑（模拟 ingress/worker 分片）不可表达；多 worker 断言（AC3/AC5）无载体 | 确定（实测 + 源码） |
| G3 | 公共工厂（#421 `createHubReplicationEdge` + #420 `createHubSessionHost`）与**真 Registry/Runtime** 的组合零运行时证据（#421 用例 sink 全 stub；#420 回合走内部模块 + 单例 host） | G3 清单；`ws-replication-issue421-*.test.ts` 的 stub sink；`ws-replication-issue420-session-host-round.test.ts` 装配头注 | 「分片形态语义等价」承诺无端到端证据；公共面漂移不可见 | 确定（实测清单） |
| G4 | 四态授权 parity / 多 worker demux-mux 序列 / 终结传播 / revoke-reauth 路由在分片形态**零断言落点** | G4；§O 14/14（行为可达但只有本轮探针在观察） | 阶段收官门禁缺位；后续改动可在无声中破坏 ADR 0032 承诺 | 确定（实测） |

**放大因素**：(a) 分片形态的宿主桥必须自行把 `HubNamespaceSessionSink` 四成员（`openNamespace`/`namespaceFrame`/`terminateUnauthorized`/`onConnectionClosed`）投影到 `HubSessionHandle`（`handleFrame`/`onFrame`/`terminateUnauthorized`/`close`）——这段装配今天只存在于 #420 夹具（内部 edge 形态），公共工厂形态下**尚无任何在库样例**，宿主（nomic-server ingress）无参照实现；(b) `connectionKey` 由 edge 工厂内部计数器生成（`${instanceId}-conn-${n}`），宿主必须在 resolver 调用点已能按该键取到 `egress`（§9 因果实验 3 记录了登记缺失时的响亮收口）；(c) 观测面差异（未授权 OPEN 的 `channel-state-changed`、dormant 面）已由 ADR 0032 A3/协议 §23.1 登记——验收语料必须是 **wire 面**，否则制造假红。

**未证实假设**：无（缺口全为运行期实测或发现性清单）。**排除项**：生产半边行为缺陷（排除，§O 14/14）、wire/错误注册表缺陷（排除，控制帧逐字节等 + 既有 455 文件全绿）、环境缺失（排除，§4 基线全绿 + §14 发现性绿）。

## 9. Causal experiments（生产源码零改动）

**因果实验 1 —— 字节语料的 clientID 归因（O7，关键）**：

| 对照 | 控制帧语料 | 全轨迹 | 文档语义（ROOT/META） | 结论 |
|---|---|---|---|---|
| 单体 vs 分片（同 inbound 字节脚本） | **逐字节相等** | 第 2 帧（BOOTSTRAP_SNAPSHOT 载荷）起不同 | 相等 | 差异只在 Yjs 载荷内部的 clientID |
| **单体 vs 单体**（同 seed、独立建文档） | **逐字节相等** | **同样不同** | 相等 | 差异与拓扑无关 ⟹ 「逐字节」硬门必须限定为**确定性控制帧语料**；数据帧按文档语义等值判定 |

**因果实验 2 —— 断言敏感性（红臂矩阵；`artifacts/sa6-issue424-mutation-sensitivity.log`）**：变异只落在**探针侧宿主桥**（不加/删生产行为；`SA6_PROBE_MUTATION` 开关）。

| 红臂 | 变异语义 | 期望红 | 实测红 |
|---|---|---|---|
| `none` | 正常臂 | 无 | **[]**（4/4 + 14/14，exit 0） |
| `no-sequence-return` | 出站缝不回传被分配序（恒 0；= #420 A12 承重面） | O8 | **O8**（回合停在 `opening`） |
| `route-all-to-first-worker` | 全部 ns 路由到 worker0（无视分片） | O3 | **O3**（w0 描述子数 ≠ 1） |
| `no-close-on-close` | 'close' 信号不投影到 session 句柄 | O4 | **O4 + O8**（closeCalls=[0,0] / [0]） |
| `no-settled-forward` | 'settled' 不过缝 | O9 | **O9**（drain 未提前完成，hubClose=undefined） |
| `reopen-not-forwarded` | 已建会话的重 OPEN 不转发 | AUTH/NC2 | **AUTH(pass) + NC2 + O5**（控制帧数不同 + revoke 序偏移） |

**因果实验 3 —— 宿主登记缺失（含早到 OPEN 形态）的失败语义（O10，SD-2 观察）**：探针用同一批公共工厂装配，但**故意不把连接登记进宿主 resolver 映射**（模拟「第一个 OPEN 的 `resolveSessionSink` 调用点先于宿主登记」，例如对端抢发 HELLO+OPEN 使 OPEN 在 `accept*()` resolve 前被重放）→ 实测：`HELLO_ACK#1` 后**连接级** `ERROR(INTERNAL_ERROR)#2` + `close(1011,'protocol-error')`、**零会话建立**（响亮收口，无静默 fallback）。交付 harness 必须显式选定处置（§12.8 SD-2）：预登记 `connectionKey`，或把该响亮收口冻结为文档行为。协议合规 peer 的 OPEN 恒在 HELLO_ACK 之后，故正常回合路径不触。

**因果实验 4 —— 文档因果链**：#418（内部拆分）→ #420（session 半边公共工厂 + 单例 host 桥）→ #421（edge 公共工厂 + 准入管线）→ #422（免 listen 服务）→ #423（观测归属）逐票把公共面与语义就位，T7 的缺口 = 前序票显式推迟的**验收装配**（#420 设计 §7-D7 的宿主桥仅覆盖内部形态；#421 契约显式登记 parity 语料不含 denied/throw 在途缓冲项）。⟹ 缺口是结构性收尾结果，非实现遗漏。

## 10. Impact surface

| 面 | 预期变化（实现票，非本契约） | 本契约的约束 |
|---|---|---|
| 新增测试夹具 | `packages/ws-replication/test/issue424-sharded-hub.ts`（worker 分片 + ingress↔worker 桥 + `HubReplication` facade） | 只许字节/JSON 中继与信号搬运；零协议决策；零 mock 被测对象（真 `createHubReplicationEdge`/`createHubSessionHost`/Registry/Runtime） |
| 新增验收套件 | `ws-replication-issue424-{auth-parity,cross-seam-round,multi-worker,lifecycle}.test.ts`（4 文件，§12.0） | 断言 = 运行时行为（wire 原字节 / `[8..12]` 序 / 会话计数 / close code / 文档语义）；零源码 grep、零 skip/only/todo、零 env override |
| 零改动面 | `packages/ws-replication/src/**`、`packages/replication-protocol/**`、`apps/**`、`docs/**`、协议 wire 语义、既有 455 文件/5559 测试 | §12.0 DENY；如套件暴露真实偏差 → 停手报 SA8/设计（SD-1），不得就地改生产 |
| 门禁面 | AC6：既有 listen 全量套件 + 根 `pnpm typecheck`/`pnpm test` + 新套件同轮绿 | GATE-C1~C3；证据落 `artifacts/` |
| 观测面 | 公共 byte-seam 形态的 dormant/per-session 降级（ADR A3）、未授权 OPEN 的 `channel-state-changed` 差异 | 契约**不锁** observer 事件集；只锁 wire（§11-H8） |
| 下游消费者 | nomic-server ingress/worker（宿主）；本票为其提供可参照的**验收形态**宿主桥 | 夹具头注须登记「非规范宿主样例」边界（同 #420 夹具纪律） |

## 11. Ruled-out hypotheses

| 假设 | 结论 | 依据 |
|---|---|---|
| H1「生产半边缺能力，本票要补实现（新 API/新缝）」 | **排除**：公共 edge 工厂 + 公共 session host + 真 Registry/Runtime 在探针里组装后，简报要求的全部行为可达 | §O 14/14；G3 清单 |
| H2「四态授权 parity 在 HEAD 有真实 wire 偏差」 | **排除**：deny/throw/latch 全轨迹逐字节相等；pass 形态控制帧语料逐字节相等 | O1/O2/O2-latch |
| H3「分片形态无法表达多 worker / 公共面不足以装配」 | **排除**（可装配）：探针以 `resolveSessionSink` 按 ns 路由到 2 个 `createHubSessionHost` 实例并实测通过；但**验收面缺失**（G2/G3） | O3/O5（跨 worker 零外溢段） |
| H4「多 worker 出站序会乱/回退」 | **排除**：1 连接 × 2 ns × 2 worker 出站序 `[1,2,3,4,5]` 严格递增；第二连接从 1 重新起算 | O3/O6 |
| H5「终结传播在分片形态断裂（句柄不 close/泄漏）」 | **排除**：close 后 2/2 会话 `closeCalls≥1`、state=closed、零新出站、零 unhandled；reauth drain 提前完成 | O4/O9 |
| H6「revoke 会广播或跨 worker 外溢」 | **排除**：revoke B → 仅 B 的 host `terminateCalls=1`、A 零 ERROR；末帧与单体逐字节相等 | O5（含跨 worker 零外溢段） |
| H7「红是环境/fixture/入口问题」 | **排除**：依赖离线装齐、根套件与双 typecheck 全绿、发现性占位经真实 runner 发现（运行后删除） | §4/§14 |
| H8「分片形态 observer 事件必须与单体逐字节一致（否则算违约）」 | **排除**：ADR 0032 A3 与协议 §23.1 已登记形态差异（未授权 OPEN 无 `channel-state-changed`、dormant 面）；把 observer 纳入 parity 会制造**假红** | ADR L30/L53、协议 §23.1 |
| H9「本票应为 Bug 型红灯（旧实现行为失败）」 | **排除**：目标行为在 HEAD 已绿（O1–O9）；红灯只能来自验收证据缺位（G1–G4）与断言敏感性证明（红臂） | §5/§8/§9 |
| H10「可以靠源码字符串/结构断言代替行为验证」 | **排除**：契约条目全部要求运行时行为观察；发现性清单只作证据、不作断言 | §12.0 纪律 |

## 12. Acceptance contract and test paths

### 12.0 交付路径与门禁

**目标测试文件（实现票新增；SA6 本轮零交付测试，§16）**：

| 文件 | 覆盖 | 内容 |
|---|---|---|
| `packages/ws-replication/test/issue424-sharded-hub.ts` | 全部 | **test-only 夹具**：worker 分片（每 worker = 真 `createNamespaceRegistryForTesting` + 公共 `createHubSessionHost`）、ingress↔worker 桥（`HubNamespaceSessionSink` ↔ `HubSessionHandle` 四成员投影 + 信号搬运）、`HubReplication` facade（供 `boot({ createHub })` 注入）、探针面（opens/sessions/signals） |
| `packages/ws-replication/test/ws-replication-issue424-auth-parity.test.ts` | AC1 | AUTH-C1~C5 |
| `packages/ws-replication/test/ws-replication-issue424-cross-seam-round.test.ts` | AC2 | ROUND-C1~C4 |
| `packages/ws-replication/test/ws-replication-issue424-multi-worker.test.ts` | AC3 + 序列 | SHARD-C1~C3 + SEQ-C1 |
| `packages/ws-replication/test/ws-replication-issue424-lifecycle.test.ts` | AC4/AC5 | TERM-C1~C3 + REVOKE-C1~C3 + REAUTH-C1~C2 |

**ALLOW LIST（实现票）**：上述 5 个文件；`wiki/raw/task_issue-424_*`；`artifacts/sa6-issue424-*`。
**DENY LIST**：`packages/ws-replication/src/**`、`packages/namespace-registry/src/**`、`packages/replication-protocol/**`、`apps/**`、`domains/**`、`docs/**`、协议文档 wire 语义、既有 455 个测试文件（不得修改既有断言以就范）。
**纪律**：零 skip/only/todo；零 env override/fallback/吞错/软化断言；零源码字符串或正则**行为**断言；断言只观察运行时行为（wire 原字节、`[8..12]` 值、close code/reason、会话生命周期计数、描述子 JSON、文档语义）；stub 只允许在宿主缝另一侧（authorize 桩、假 timer）；被测对象（edge 工厂/session host/Registry/Runtime）恒为真身。

**Runner 入口**：`vitest.config.ts` → `include: ['packages/*/test/**/*.test.ts', …]`，`typecheck.include: ['packages/*/test/**/*.test-d.ts']`；命令 `NODE_OPTIONS=--conditions=nomicore-source pnpm test`（根全量）或 `… pnpm exec vitest run packages/ws-replication/test/ws-replication-issue424-*.test.ts`（聚焦）。本票**无新类型面**（零公共 API 变更），故不要求新增 `*.test-d.ts`。

### 12.1 AUTH — 授权等价性矩阵（AC1，硬门）

**语料构造（两形态共用同一 `Uint8Array` 脚本，逐字节同源）**：`HELLO#1`（`expectedHubInstanceId=HUB_INSTANCE`、`protocolVersions=[1]`、固定 16 字节 nonce）→ `OPEN_NAMESPACE(ns)#2` → 重 `OPEN_NAMESPACE(ns)#3`。

**两形态**：① 单体 listen = `createHubReplication({instanceId, registry, authorize, timer, verifyToken, limits, timeouts})` + `acceptTrusted`；② 分片 = 公共 `createHubReplicationEdge({instanceId, timer, authorize, resolveSessionSink, limits, timeouts})` + `acceptTrusted`，`resolveSessionSink` 建真 `createHubSessionHost` 会话（真 Registry/Runtime，同 seed 同 ns 身份）。

| id | 四态 | 判据（全部为运行时观察） |
|---|---|---|
| AUTH-C1 | **通过**：authorize → `{ok:true, read:true, submit:true}` | 控制帧语料 **hex 逐帧相等**（`HELLO_ACK#1`、`OPEN_OK#2`、`OPEN_OK#4`）；全轨迹骨架（kind#seq）相等；数据帧（`BOOTSTRAP_SNAPSHOT#3`）文档语义相等 |
| AUTH-C2 | **`NAMESPACE_UNAUTHORIZED` 拒绝**：authorize → `{ok:false}` | 全轨迹 **hex 逐帧相等**（`HELLO_ACK#1`、`ERROR(NAMESPACE_UNAUTHORIZED)#2`、`ERROR(NAMESPACE_REOPEN_REQUIRES_RECONNECT)#3`）；分片侧 **零 session 建立**（未授权 OPEN 不过缝） |
| AUTH-C3 | **authorizer 抛错 `INTERNAL_ERROR`**：authorize → throw | 全轨迹 hex 逐帧相等（`ERROR(INTERNAL_ERROR)#2` + 重开拒答 `#3`）；分片侧零 session 建立；连接存活 |
| AUTH-C4 | **闩锁期重 OPEN 拒答** | 与 AUTH-C2/C3 重开帧同源：恰一帧 `ERROR(NAMESPACE_REOPEN_REQUIRES_RECONNECT)`（逐字节等），且**不重复** authorize（恰一次） |
| AUTH-C5 | **负控（对照组）** | (a) 同脚本单体 vs 单体独立文档：控制帧逐字节等、全轨迹**不等**（登记 clientID 随机性，§9 实验 1）；(b) pass 单体 vs deny 分片：控制帧**不等**（parity 断言非恒真）；(c) deny 形态分片零会话（NC3） |

**硬门定义（必须写进测试注释）**：`逐字节` = 出站帧 `Uint8Array` → hex 全等且顺序全等；适用面 = **无 Yjs 载荷的控制帧**（`HELLO_ACK`/`OPEN_OK`/`ERROR`/`CLOSE_OK`/`GOAWAY`）；数据帧（`BOOTSTRAP_SNAPSHOT`/`UPDATE`/`UPDATE_CHUNK`/`SYNC_STEP2`）判据 = 帧 kind+seq 骨架相等 ∧ `Y.applyUpdate` 后 `ROOT`/`META` 语义相等。**禁止**把数据帧字节相等写成断言（O7 证明其不成立且非拓扑归因）。

### 12.2 ROUND — 跨缝完整协议回合（AC2）

| id | 断言 |
|---|---|
| ROUND-C1 | 真 peer（`createPeerReplication`）经 `boot({ createHub: shardedFacade })` 经分片装配完成 `OPEN→bootstrap→reconcile→live`：`OPEN_OK`×1、`BOOTSTRAP_SNAPSHOT`×1 + peer `BOOTSTRAP_ACK`×1（`ackedSequence` 回指快照帧序）、`SYNC_STEP1/SYNC_STEP2/SYNC_APPLIED` 各 ≥1、`getNamespaceState()==='live'`、hub/peer `encodeStateAsUpdate` 逐字节相等（收敛） |
| ROUND-C2 | live 双向：peer 业务写 → `UPDATE`（peer→hub）×1 + `UPDATE_ACK`（hub→peer，`ackedSequence` 回指入站序）+ hub ROOT 更新；hub 业务写 → `UPDATE`（hub→peer）×1 + peer ROOT 更新（零 `resync-required`） |
| ROUND-C3 | CLOSE 回合：`CLOSE_NAMESPACE`×1 → `CLOSE_OK`×1（`ackedSequence` 回指入站序）+ `settled` 信号恰一次（经 session→edge 缝转发） |
| ROUND-C4 | **两形态**：`chunkedUpdate` 缺省（非协商）与 `true`（协商）各跑一遍 ROUND-C1~C3；协商形态额外断言 `HELLO_ACK.selectedCapabilities & CAP_CHUNKED_UPDATE ≠ 0` 且会话描述子 `selectedCapabilities` 携带该位（`UPDATE_CHUNK` 深度矩阵归 #243/#246 既有套件，本票只锁「协商形态下回合仍完整」） |

### 12.3 SHARD / SEQ — 多 worker 分派与出站序（AC3）

| id | 断言 |
|---|---|
| SHARD-C1 | 1 连接 × 2 namespace（分属 2 个不同 registry 的 worker shard）：`resolveSessionSink` 对 A/B 各恰一次；A 的会话只建在 w0、B 只建在 w1（描述子含 `connectionKey` 相同 = 同一连接） |
| SHARD-C2 | demux/mux 正确：出站帧的 namespaceId 覆盖 A/B；A/B 的 `OPEN_OK` 与 `BOOTSTRAP_SNAPSHOT` 均按到达序出现；每 ns 的 `OPEN_OK` 恰一 |
| SHARD-C3 | 负控：从未 OPEN 的第三 ns 帧 → 合成 `NAMESPACE_STATE_VIOLATION`、零会话建立、连接存活（不得回落到任一 worker） |
| SEQ-C1 | 出站 envelope `[8..12]` 大端序 = 1..N **严格递增**（无跳号/重复/回退），交织序 = 注入序；第二连接（同工厂再次 `acceptTrusted`）首帧序 = 1（per-connection，非全局计数） |

### 12.4 TERM — 连接终结传播与资源释放（AC4）

| id | 断言 |
|---|---|
| TERM-C1 | `connection.close()` → `state==='closed'`；两个 worker 的 session 句柄 `close()` 各恰 ≥1 次（经 `onConnectionClosed` 投影）；此后**零新出站** |
| TERM-C2 | 无泄漏：close 后 worker 侧 registry scheduler 的 pending timer 不增长；`collectUnhandledRejections()` 为空；`close()` 幂等（同一 promise） |
| TERM-C3 | 负控（连接隔离）：两条连接各自持 ns；关闭其一 → 另一连接的 session 零 close、零新出站 |

### 12.5 REVOKE / REAUTH — 经 edge 入口的路由（AC5）

| id | 断言 |
|---|---|
| REVOKE-C1 | `connection.revokeNamespace(ns)` → 该 ns 会话的 `terminateUnauthorized` 恰一次；wire 出现 ns `ERROR(NAMESPACE_UNAUTHORIZED)`，**与单体 `revoke(instanceIdentity, ns)` 末帧逐字节相等** |
| REVOKE-C2 | 跨 worker 零外溢：revoke B → A 的会话 `terminateCalls===0`、wire 零 A 的 ERROR 帧 |
| REVOKE-C3 | 未知/已终态 ns 的 revoke → 无副作用 resolve（幂等；重复 revoke 恒 resolve） |
| REAUTH-C1 | `connection.beginReauth()` → `GOAWAY(REAUTH_REQUIRED)` 恰一帧、`drainTimeoutMs>0`；drain 窗口内 `CLOSE_NAMESPACE` → 通道 settled → **drain 提前完成 close(1001)**（不 fire deadline timer，判据 = 假 scheduler 零推进） |
| REAUTH-C2 | 阴性对照：同脚本不发起 reauth → 连接不关闭（证明 REAUTH-C1 的 1001 归因于 drain 收口） |

### 12.6 GATE — 阶段收官门禁（AC6）

| id | 门禁 | 证据 |
|---|---|---|
| GATE-C1 | 既有 listen 模式全量套件绿：`NODE_OPTIONS=--conditions=nomicore-source pnpm test`（455 文件/5559 测试基线 → 新增套件后文件/测试数只增） | `artifacts/sa6-issue424-baseline.log` + 实现票同轮日志 |
| GATE-C2 | 根 `pnpm typecheck` exit 0；`pnpm exec tsc -p packages/ws-replication/tsconfig.json` exit 0 | 同上 |
| GATE-C3 | 新套件与既有套件**同轮**全绿（不得只跑聚焦路径交差）；`git diff --stat -- packages/ws-replication/src packages/replication-protocol/src` 为空（本票 test-only） | 实现票交付日志 |

### 12.7 红/绿期望矩阵（旧实现 vs 目标）

| 契约组 | HEAD（旧实现）预期 | 目标（实现票交付后）预期 |
|---|---|---|
| AUTH-C1~C5 | **无法执行**：验收文件不存在（发现面 0，G1）；无四态 parity 语料与多 worker 装配（G2/G3）。等价行为本身已绿（O1/O2），但**无断言、无回归网** | 绿：控制帧语料逐字节相等；负控与 O7 边界按 §12.1 断言 |
| ROUND-C1~C4 | 无法执行（无公共工厂形态的分片回合套件，G3）；行为已可达（O8） | 绿：回合完整 + 收敛 + 两协商形态 |
| SHARD/SEQ-C1~C3 | 无法执行（无多 host 装配，G2）；行为已可达（O3/O6） | 绿：路由/序列/隔离断言 |
| TERM-C1~C3 | 无法执行（无分片终结断言）；行为已可达（O4） | 绿 |
| REVOKE/REAUTH-C1~C3 | 无法执行（无经 edge 入口的 revoke/reauth 分片断言）；行为已可达（O5/O9） | 绿 |
| GATE-C1~C3 | 基线绿（§4），但无本票验收件 | 绿（含新套件同轮） |

**红灯口径（诚实登记）**：本票是**阶段收官验收**，红灯 = **验收能力缺位**（G1–G4 可运行证据 + 发现面 0），**不是**旧实现行为失败（§11-H9）。契约条目的「敏感性」由红臂矩阵（§9 实验 2：5/5 点亮预期 ORACLE）与负控（NC1–NC4 + AUTH-C5）承担——实现票必须原样保留这些负控，且**不得**为了让新套件变红而改生产（DENY LIST）。

### 12.8 待 SA8 裁决的范围决策（SD）

| id | 决策点 | SA6 立场（供裁决，不预设结论） |
|---|---|---|
| SD-1 | 若新套件暴露真实生产偏差（parity 不等/序列异常/收口失败），本票是否就地修生产？ | SA6 立场：**停手报 SA8/设计**——本票 ALLOW LIST 为 test-only；生产改动必须显式扩 ALLOW LIST 并重新过契约。 |
| SD-2 | 对端抢发（HELLO+OPEN 同批早到，早于 `accept*()` resolve 的宿主登记）时，宿主桥如何取 `egress`？ | 两个合法处置：(a) harness 预登记 `connectionKey`（`${instanceId}-conn-${n}` 计数可预测）；(b) 断言**响亮收口**（连接级 `INTERNAL_ERROR` + close）为文档行为。探针已实测 (b) 的形态（§9 实验 3）。 |
| SD-3 | `connectionKey` 由 edge 工厂**实例**计数器生成（`hub-edge-host.ts:914-916`：`${instanceId}-conn-${n}`）⟹ 同进程多工厂 + 共享 session host 会撞键（`hub-session-host.ts:248-253`：重复 `(connectionKey, namespaceId)` → `open()` 响亮拒绝；探针开发期实测命中该拒绝） | 交付 harness 约定「每场景一工厂」或按工厂维度加键前缀；是否把该约束写入宿主指引由设计裁决。 |
| SD-4 | ROUND-C4 的协商形态深度（仅「回合完整」还是含超限 UPDATE 的 `UPDATE_CHUNK` 端到端） | SA6 推荐：本票只锁「协商形态回合完整 + 协商位可见」；chunk 深度矩阵归 #243/#246 既有套件，避免重复冻结。 |

## 13. Red/green or baseline evidence

1. **能力缺口红（可运行）**：`artifacts/sa6-issue424-probe-green.log` §G 四行 `GAP … CONFIRMED`（gaps=4/4，exit 0）。
2. **目标行为绿（可运行）**：同日志 §O 十四行 `ORACLE … PASS`（14/14）——证明契约可执行、断言面可观察（真 Registry/Runtime + 真 peer + 内存管道）。
3. **断言敏感性（红臂）**：`artifacts/sa6-issue424-mutation-sensitivity.log`——5 条变异各自点亮预期 ORACLE（实际失败集：`no-sequence-return`→{O8}；`route-all-to-first-worker`→{O3}；`no-close-on-close`→{O4,O8}；`no-settled-forward`→{O9}；`reopen-not-forwarded`→{AUTH(pass),NC2,O5}），`none` 臂 14/14 全绿。
4. **Runner 触发**：`artifacts/sa6-issue424-runner-trigger.log`——临时占位（运行时 + 类型层）经真实 runner 发现并执行（2 文件/2 测试/0 类型错误），运行后删除（§16）。
5. **门禁基线**：`artifacts/sa6-issue424-baseline.log`——455 文件/5559 测试全绿、根 typecheck exit 0、包 tsc exit 0。
6. **确定性**：绿臂 3/3 重复逐行一致。

## 14. Runner trigger evidence

- 发现规则（`vitest.config.ts`）：`test.include = ['packages/*/test/**/*.test.ts', 'domains/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts']`；`test.typecheck.include = ['packages/*/test/**/*.test-d.ts']`；`maxWorkers: 1`；`NODE_OPTIONS=--conditions=nomicore-source` 使 `@nomicore/*` 解析到 `src/`。
- 实测（日志 `artifacts/sa6-issue424-runner-trigger.log`）：临时占位 `packages/ws-replication/test/ws-replication-issue424-discovery.test.ts` + `…-discovery.test-d.ts` → `pnpm exec vitest run --typecheck <两文件>` → `Test Files 2 passed (2)`、`Tests 2 passed (2)`、`Type Errors no errors`、exit 0 → 目标路径（`ws-replication-issue424-*.test.ts`）**会被真实 runner 发现**（含类型层）。
- 占位文件运行后**已删除**（同轮收尾；`ls packages/ws-replication/test | grep -c 424` = 0）。

## 15. Unknowns and blockers

1. **SA8 设计产物缺失**：`task_issue-424_design.md` / `_design_conflict_report.md` / `_relevant_decisions.md` 均不存在——SD-1~SD-4 由设计阶段裁决；本契约不代行设计。
2. **Owner 评论为空**（dispatch 明示 `[]`）：无附加要求可映射；若后续评论到达，须重跑映射。
3. **AC2 协商形态深度**（SD-4）与 **SD-2/SD-3 宿主装配纪律**：需设计显式裁决后才能冻结为测试断言；本契约已给出可执行的最小口径。
4. **Yjs 数据帧字节不可逐字节比较**：已由 O7 因果实验证明为语料属性（非拓扑），契约以「控制帧逐字节 + 数据帧语义等值」封口；若设计坚持全轨迹逐字节，需要独立的「确定性 clientID」注入方案（超出本票 DENY 面，需新票）。
5. 无环境阻塞：依赖、runner、类型检查、真实 Registry/Runtime、内存管道均已在基线内验证。

## 16. Temporary diagnostics cleanup

- **生产实现零改动**：`git status --short` 无 `packages/**` 条目；`git diff --stat -- packages` 为空。
- **交付测试零新增**：本轮不写 `packages/ws-replication/test/**`；runner 触发用的两个临时占位文件（`.test.ts` / `.test-d.ts`）在证据采集后**已删除**，`packages/ws-replication/test/` 下 `*424*` 命中 0。
- **诊断产物（保留，属 SA6 证据）**：`wiki/raw/task_issue-424_sa6_capability_probe.mts`、本报告、`artifacts/sa6-issue424-*.log`（4 份）。探针不在 vitest include 面内（`wiki/raw/**`），不参与根测试/类型检查。
- **无后台服务/进程**：探针零网络、零真实 timer、零文件句柄；未启动任何服务；无 nohup/setsid/PID 文件。
- 探针运行可重复且无副作用：只读源码 + 内存态 fixture（每个 worker 用独立 `StubPersistence` + 受控 scheduler/random）。

## 17. 证据与可复现清单

```bash
# 环境（离线 store 装齐；exit 0）
pnpm install --offline --frozen-lockfile

# 探针（正常臂；期望 gaps=4/4 oracles=14/14，exit 0）
NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-424_sa6_capability_probe.mts

# 红臂（各期望特定 ORACLE 失败；见 §9 表）
NODE_OPTIONS=--conditions=nomicore-source SA6_PROBE_MUTATION=no-sequence-return pnpm exec tsx wiki/raw/task_issue-424_sa6_capability_probe.mts
NODE_OPTIONS=--conditions=nomicore-source SA6_PROBE_MUTATION=route-all-to-first-worker pnpm exec tsx wiki/raw/task_issue-424_sa6_capability_probe.mts
NODE_OPTIONS=--conditions=nomicore-source SA6_PROBE_MUTATION=no-close-on-close pnpm exec tsx wiki/raw/task_issue-424_sa6_capability_probe.mts
NODE_OPTIONS=--conditions=nomicore-source SA6_PROBE_MUTATION=no-settled-forward pnpm exec tsx wiki/raw/task_issue-424_sa6_capability_probe.mts
NODE_OPTIONS=--conditions=nomicore-source SA6_PROBE_MUTATION=reopen-not-forwarded pnpm exec tsx wiki/raw/task_issue-424_sa6_capability_probe.mts

# 门禁基线（期望 455 文件/5559 测试全绿、0 类型错误、exit 0）
NODE_OPTIONS=--conditions=nomicore-source pnpm test
pnpm typecheck
pnpm exec tsc -p packages/ws-replication/tsconfig.json
```

**附：artifactPaths（worktree-relative）**

```text
wiki/raw/task_issue-424_sa6_contract.md
wiki/raw/task_issue-424_sa6_capability_probe.mts
artifacts/sa6-issue424-baseline.log
artifacts/sa6-issue424-probe-green.log
artifacts/sa6-issue424-mutation-sensitivity.log
artifacts/sa6-issue424-runner-trigger.log
```
