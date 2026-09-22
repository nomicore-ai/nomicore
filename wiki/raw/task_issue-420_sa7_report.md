# SA7 动态验证报告 — issue #420：SessionHost 公共工厂 + 内存管道完整协议回合（spec #415 T3）

- 派工：`sa-4e7e4cd7-4dc2-4a54-8283-575a6d8050f9`（role `mabf-sa7`，phase final-verification，iteration 0）
- 验证对象：worktree `/home/wangjian/nomicore-fix-issue-420`（branch `mabf/issue-420`，基线 HEAD `7039f6dae8e7d29f0c929492f0ca2119bc63afaa`）上的 **SA3 未提交实现**（本轮 `git status` 复核 = 13 个 ALLOW 路径，与 SA3/SA4/SA8 三方记录一致；SA7 零实现改动）
- 上游门禁状态：SA4 verdict **approve**（0 BLOCKER / 0 MAJOR / 6 MINOR）；SA8 implementation 复查 **clear**（23 项对照、`requiresConflictRecheck: false`）。本报告在该基础上做**独立动态验证**，重点 = 派工点名的**已评审载体提交（carrier-commit）读法**与真实运行链路。

---

## 1. Inputs

| 输入 | 用途 |
| --- | --- |
| `wiki/raw/task_issue-420.md` | Issue 正文 AC1–AC5（Owner comments = `[]`，无逐条评论映射面） |
| `wiki/raw/task_issue-420_sa6_contract.md` | 冻结验收契约（§12.1 签名、§12.2 A1–A12、§12.3 AC3、§12.4 C4a–d、§12.5 C5a–d、§12.7 M1–M7） |
| `wiki/raw/task_issue-420_design.md`（iteration 1） | §7 D1–D10、§8 数据流路线 R1–R6/R3b、§8.1 状态机投影、§9 E1–E10、§11 ALLOW/DENY |
| `wiki/raw/task_issue-420_sa3_impl.md` | 实现报告（V1–V16、Deviations §1–§4——**载体提交偏差**为本轮动态复核重点） |
| `wiki/raw/task_issue-420_sa4_review.md` | SA4 评审（approve；§2.1 载体提交等价性论据、§10 SA4-O1/O5、§11 后续动态验证项——本轮逐项承接） |
| `wiki/raw/task_issue-420_implementation_conflict_report.md` | SA8 impl 复查（clear；行 11 载体提交裁决 = implements-existing-decision；冻结面清单） |
| `wiki/raw/task_issue-420_conflict_report.md` / `_design_conflict_report.md` / `_relevant_decisions.md` | 协议边界识别（wire 序 §4、错误码 §13/§14、事件词汇 §23.1、ADR 0032 决策 1–5） |
| 实现源码（开卷） | `src/hub-session-host.ts`（263 行全文）、`test/issue420-shim-hub.ts`（740 行全文）、三个新测试文件、`test/{driver,harness}.ts` 观测面 |
| SA6 证据资产 | `artifacts/sa6-issue420-*`（基线 77 files/588 tests、矩阵 52 tests、因果/序列/纯度/中继探针） |

SA7 不消费 SA9/SA10 产物（本票无）；不等待 PR CI、不读远端 CI 日志、不运行全仓回归（SA3 V6/V7 已覆盖根级面，本报告不重复）。

## 2. Runtime environment

| 项 | 值 |
| --- | --- |
| worktree / branch | `/home/wangjian/nomicore-fix-issue-420`，`mabf/issue-420`（实施期零 commit——与 SA3/SA4 口径一致） |
| 工具链 | node `v24.13.0`、pnpm `10.28.2`、vitest `3.2.7`（`NODE_OPTIONS=--conditions=nomicore-source`） |
| 被验证态 | SA3 未提交工作树（13 ALLOW 路径）；本轮开始/结束 `git status` 对 `packages/**`/`docs/**` 完全一致（SA7 零改动，见 §7） |
| 驱动面 | 既有 vitest 套件（包全量 + 聚焦）+ **3 个新增外部探针**（`artifacts/sa7-issue420-*.mts`，tsx 前台一次性运行，不进任何 vitest/tsconfig include 面；零源码/测试改动） |
| 长驻服务/后台作业 | 无（全部前台命令；唯一后台作业 = 包全量套件，已完结） |

## 3. Changed Data Flow Verification

设计 §8.2 声明改变的路线逐条验证（Runtime driver：P2 全回合探针 `artifacts/sa7-issue420-fullround-hop-probe.mts` 23/23；观测值取自该探针 hop dump 与既有探针面 `ShimHubProbes`）：

| Route | Design change | Runtime driver | Observed hops | Expected result | Actual result | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| R1 入站数据 | wire → 真 edge（序单点校验）→ 桥 `encodeMessage(message,{sequence})` → `handleFrame` 字节 → 解码**无 expectedSequence** → 零 diff 通道 | P2 探针 | `seamFramesIn = [OPEN_NAMESPACE#0, BOOTSTRAP_ACK#3, SYNC_STEP1#4, SYNC_STEP2#5, SYNC_APPLIED#6]`；每个非 OPEN 缝帧（kind, sequence）逐项回指 wire `peerToHub` 原帧；OPEN 中继序 = 合成 0（登记例外） | 非 OPEN 缝帧带 wire 序；OPEN 合成 0；kind ⊆ namespace 域 | 与期望逐项一致（含 live 期 UPDATE/CLOSE：`sinkReturns` 对账到 CLOSE_OK#10） | ✅ |
| R2 出站数据 | 通道 → 内部 sink 占位 0 编码 → adapterPort → listener(frame, lane) → 桥 → 真 port `send*Frame` → edge mux 盖章 → wire；**返回序同步回传** | P2 探针 | 9 个出站缝帧全部 `placeholderSequence===0`（lane：control×6, **data×1（UPDATE#8）**, control×2）；`sinkReturns=[2,3,4,5,6,7,8,9,10]` === 剔除 edge 自身 `HELLO_ACK#1` 后的 hub→peer wire 序列 `[2..10]` **逐帧相等** | 占位 0 不漏 wire；lane 区分；回传值 = 被分配 wire 序 | 完全一致；`UPDATE` 走 data lane、控制帧走 control lane（既有分叉保持） | ✅ |
| R3 OPEN 准入 | edge `beginAdmission` 唯一 authorize → 桥拉取结局 → 纯 JSON 描述子跨缝 `host.open()` → OPEN 字节转发 | P2 探针 | 描述子实测：`{connectionKey:"hub-omega-conn-0", remoteInstanceId:"peer-alpha", namespaceId:"ns-…01", authorization:{ok:true,localOwner:{userId:"hub-owner-9f38"},permissions:{read:true,submit:true}}, selectedCapabilities:0, connectionId:"hub-omega-conn-0"}`；`authorize` 恰 1（edge spy）；`OPEN_OK` 恰 1；`sessionsOpened=1` | 描述子纯 JSON 六字段；authorize 恰一次于 edge | 与 SA6 §12.1 冻结声明逐字段一致（`structuredClone` 深等由 round 测试 A2 承载，聚焦重跑绿） | ✅ |
| R3b 再 OPEN / 在途帧 | 相位三分支：① authorized → 句柄转发（不重入 `open()`）；② routing → OPEN 入有界 pending 按到达序同步冲刷；③ denied/载体提交 → 生产 splice | P3 探针 S2/S5 + P1 探针 | S2（routing→authorized）：`pendingFlushed=1`、`reopenForwarded=0`、release 后 `OPEN_OK×2`（openWaiters 合流）、`sessionsOpened=1`、authorize 恒 1。S5（authorized 相位）：`reopenForwarded=1`、`OPEN_OK` 1→2、`sessionsOpened=1`、authorize 恒 1 | 再 OPEN 不重开公共句柄、不二次授权；重开矩阵由零 diff 通道产出应答 | 三分支全部按设计可达且关键值正确（矩阵 `:212/:240` shim 臂 53 用例绿为断言面证据） | ✅ |
| **R3b′ 载体提交（已评审偏差）** | routing 相位**非 OPEN** ns 域帧 → 立即提交 `denialSink`（生产 splice + 真 port）；迟归 authorized 续体放弃 | **P1 探针（A/B 对照）** | 见 §3.1 专表 | 与 listen 逐字节一致；release 后零额外输出 | **wire 时间线两臂逐字节相等**（3 个检查点） | ✅ |
| R4 控制信号 | `settled`/`connection-fatal` 纯 JSON 跨缝 → 桥映射真 port | P2/P3 探针 | `settled` 恰 1 次 `{type:'settled',namespaceId}`（CLOSE 终态）并转发 edge（`hub.close()` drain resolve 佐证）；`connection-fatal` 两臂观察：`{code:'BAD_MAGIC'}` / `{code:'MALFORMED_FRAME'}` → wire `close(1002,'protocol-error')`（code→close code 映射单点在 edge） | settled 恰一次；fatal 码原样、映射归 edge | 一致 | ✅ |
| R5 生命周期 | `close()` 幂等（同一 promise）+ drain；`terminateUnauthorized` revoke 链 | P2 探针 + round A10（聚焦重跑） | `hub.close()===hub.close()`（同一 promise 引用）；resolve；wire `1001 hub-shutdown`；scheduler pending 1→0；`advanceMs(30s)` 后 hub→peer 帧数不变（零残留 timer 召回） | 幂等 + quiescence | 一致；A10 terminateUnauthorized 双方终态零 fatal（聚焦跑绿） | ✅ |
| R6 观测 | namespace 域事件在 session 侧发射，`dispatchReplicationObserver` 单点隔离 | P2 探针 + P3 S4 | 通道 FSM 边 + `update-applied/update-sent/update-acked/bootstrap-snapshot-sent/sync-*` 全事件族经同一注入 observer 到达；敌意监听者 throw（S4）不改协议结果 | 事件族与 listen 一致；监听者 throw 隔离 | 一致（listen 臂同族事件在矩阵基线绿） | ✅ |

### 3.1 载体提交（carrier-commit）A/B 专项 —— 派工点名重点

探针 `artifacts/sa7-issue420-carrier-commit-ab-probe.mts`（19/19，3× 一致）：同一 driver、同一 Registry/Runtime fixture、同一注入序（镜像 `ac7-faults` 首用例：authorize 首调用门闩悬挂 → 注入 OPEN → OPEN_OK 前注入 UPDATE → release），**唯一变量 = hub 装配**（listen 单体 vs shim = 真 edge + 宿主桥 + 公共工厂）；随机 seam 注入同种子 LCG（排除 HELLO challenge nonce 的无关字节差异——首轮未注种时差异仅在该 16 字节 nonce，协议帧已逐字节相等）。

| 检查点 | listen 臂观察 | shim 臂观察 | 判定 |
| --- | --- | --- | --- |
| 违例即时性（release 前） | wire 出现 `hub-to-peer:ERROR(NAMESPACE_STATE_VIOLATION)#2` | 同左（同帧同序） | 两臂一致——违例应答由零 diff 通道在同一到达点产出 |
| release 后 | wire 帧数 5→5（零增长） | 同左 | 迟归 authorized 续体放弃，零额外输出 |
| 计时器冲刷（advanceMs 30s）后 | 5→5（零增长） | 同左 | 无残留 timer 召回出帧 |
| **wire 时间线（方向+原字节 hex）** | 5 帧完整时间线 | **逐字节相等**（atViolation / atRelease / afterTimers 三检查点） | **载体提交与 listen 逐字节同构（动态证实）** |
| authorize | 恰 1（edge spy） | 恰 1 | 零二次授权 |
| shim 路由投影 | — | `carrierCommitted=1`、`sessionsOpened=0`、`denialRouted=0`、`pendingFlushed=0`、`pendingOverflow=0`、零 connection-fatal 信号 | 相位吸收态正确：不建公共句柄、无 INTERNAL_ERROR 签名 |
| unhandled rejection | 空 | 空 | 零无承载 reject（E10 面同构） |

结论：SA3 Deviations §1 / SA4-O1 / SA8 行 11 的**已评审载体提交读法**在真实运行链路上成立——shim 装配对该敌意角落产生的 wire 输出与 listen 单体**逐字节相同**，且迟归续体、计时器、授权计数、unhandled 面全部与 listen 同构。SA4 §11 第 3 行（载体提交角落的 authorized 结局全回合）动态复跑通过。

## 4. Preserved Data Flow Verification

| Route | Preserved invariant | Runtime driver | Baseline observation | Current observation | Verdict |
| --- | --- | --- | --- | --- | --- |
| listen 单体回合 | 7 矩阵文件断言逐字不变全绿（SA6 基线 7 files/52 tests） | `vitest run`（7 文件，本轮实跑） | SA6 `baseline-matrix.log`：7/52，exit 0 | `sa7-issue420-listen-matrix-baseline.log`：**7 files / 52 tests / exit 0** | ✅ 不变 |
| 包全量（listen 臂 + 新三文件） | SA6 基线 77 files/588 tests 零回归 | `vitest run --typecheck packages/ws-replication/test`（本轮实跑） | SA6/SA3：77/588 → 80/651 | `PROBE` 本轮：**80 files / 651 tests / Type Errors no errors / exit 0**（+3 文件/+63 恰为新增面，零回归） | ✅ 不变 |
| wire 格式/序纪律 | 序自 1 严格 +1（两方向独立）、零 0 占位泄漏（协议 §4） | round 测试 A8（聚焦重跑绿）+ P2 探针 | SA6 `bridge-relay-fidelity` 14 帧 0 mismatch | 聚焦跑 63/63 绿；P2 `sinkReturns=[2..10]` 全正、出站占位全 0 | ✅ 不变 |
| 入站 sequence 单点在 edge | 同一非法序：edge → `SEQUENCE_VIOLATION` + close(1002) + 零缝投递（C5b） | round 测试 C5b（聚焦重跑绿） | SA6 E2-A 探针 2/2 | 聚焦跑绿；`hub-session-host.ts` grep `expectedSequence` = 0（C5c 结构门亦绿） | ✅ 不变 |
| 拒绝路径（deny 族） | `NAMESPACE_UNAUTHORIZED`×1 由生产通道产出、authorize 恰 1、注册表零打开 | 矩阵 ac1-ac2 shim 臂（包全量内）+ round A4-W2 | SA6 §12.3 | 矩阵 shim 臂 53 用例绿（`denialRouted≥1` 反空跑锚在场）；A4-W2 `NAMESPACE_NOT_FOUND` 负控绿 | ✅ 不变 |
| `hub-namespace.ts`/`hub-edge.ts` 等 DENY 面 | 逐字节零 diff | 本轮 `git diff --stat`（20 个 DENY 路径 + 7 矩阵文件） | SA3/SA4/SA8 三方核对空 | **本轮独立核对空**（见 §9 命令清单） | ✅ 不变 |

## 5. State Machine Verification

| Initial state | Trigger | Expected transitions | Observed transitions | Forbidden transitions absent | Verdict |
| --- | --- | --- | --- | --- | --- |
| 通道 FSM（零 diff 单份实现） | 完整回合（OPEN→bootstrap→reconcile→live→CLOSE） | opening→bootstrapping→reconciling→live→closing→closed | P2 探针 observer 边序列实测 = `["opening→bootstrapping","bootstrapping→reconciling","reconciling→live","live→closing","closing→closed"]` | 零 `resync-required`/`connection-failed` 事件（clean 回合）；禁序未出现 | ✅ |
| 桥路由相位 routing→authorized | 门闩 release（S2） | routing → authorized（续体同步段：open()→注册→首 OPEN 转发→冲刷） | `pendingFlushed=1`、`sessionsOpened=1`、`OPEN_OK×2`（合流）、authorize 恒 1 | 未出现：二次 `open()`（`sessionsOpened` 恒 1）、INTERNAL_ERROR 信号、重复 authorize | ✅ |
| 桥路由相位 routing→denied（吸收态，载体提交） | routing 期非 OPEN 帧（P1/S3） | routing → denied 吸收（生产 splice 承载；迟归续体放弃） | P1：`carrierCommitted=1`、`sessionsOpened=0`、release 后零输出；S3：closed 守卫下 `sessionsOpened=0`、零信号、零新帧 | 未出现：续体重入 `open()`、双承载机械（authorize 仍恰 1） | ✅ |
| authorized 相位再 OPEN（S5） | live 后重复 OPEN | 分支 ① 句柄转发 → 通道 `onOpen` 已建立 → 立即再答 OPEN_OK | `reopenForwarded=1`、`OPEN_OK` 1→2、`sessionsOpened=1`、authorize 恒 1 | 未出现：路由回退到 routing、重开公共句柄 | ✅ |
| 句柄本地态 open→closed | `close()` 或 connection-fatal 发射（S1/P2） | ready → closed；close 幂等同一 promise | S1 两臂 fatal 后出站转 0 值语义（连接已收口）；P2 `close()===close()` 且 resolve | 未出现：fatal 后继续有效发送 | ✅ |
| 终态通道行为 | conflicted 后同连接再 OPEN（矩阵 `:240`） | `NAMESPACE_REOPEN_REQUIRES_RECONNECT`，不重开 | 矩阵 shim 臂断言逐字不变绿（53 用例内） | 未出现：终态复活 | ✅ |

## 6. Error and Cleanup Flow

| 场景 | 设计行为 | 运行观察（driver） | 判定 |
| --- | --- | --- | --- |
| E1 出站 0 回传（变异正控） | bootstrap ACK 处响亮 `ACK_STATE_VIOLATION` 收口 | round 测试 A12 红臂（聚焦重跑绿）：`suppressSequenceReturn` → 断言绿（观察到 ERROR + `close(1002,'protocol-error')` + onSignal 命中）/ 回合红（不可达 live） | ✅ |
| E2 缝解码失败 | `connection-fatal{code: err.code ?? 'MALFORMED_FRAME'}`，零吞帧 | P3 S1 两臂：magic 失配 → `{code:'BAD_MAGIC'}`（codec 码原样传播）；reserved≠0（offset 16）→ `{code:'MALFORMED_FRAME'}`；两臂 wire `close(1002,'protocol-error')` | ✅ |
| E4 pending 溢出 | `CONNECTION_POLICY_VIOLATION`(1008) 响亮收口，无静默丢弃 | P3 S3：18 个 OPEN（首 = firstOpen，2–17 = 16 条界内，#18 溢出）→ wire ERROR `CONNECTION_POLICY_VIOLATION` + `close(1008)`、`pendingOverflow=1`；release 后 closed 守卫放弃在途路由（`sessionsOpened=0`、零信号、零新帧） | ✅ |
| E6 信号监听者 throw | 隔离，不改协议状态 | P3 S4：敌意 onSignal 监听者 throw 1 次；CLOSE_OK 仍回指入站 wire 序（7↔7）、settled 仍转发、`hub.close()` drain resolve | ✅ |
| E7 幂等 | close 同一 promise；terminate 无通道 resolve | P2 R5（`close()===close()`）；round A10 terminateUnauthorized（聚焦跑绿） | ✅ |
| 载体提交 × 迟归 authorized 结局 | 续体早退（不 open、不二次投递、丢弃 pending） | P1/S3：release 后零额外 wire 帧、零 unhandled、零 INTERNAL_ERROR | ✅ |
| 清理 quiescence | drain 后无残留 timer/未决 promise | P2：scheduler pending 1→0；advanceMs(30s) 零新帧；**全部 9 个探针场景 + 3 个测试面 unhandled collector 均为空** | ✅ |

## 7. Temporary Diagnostics

| 项 | 处置 |
| --- | --- |
| 源码/测试内临时日志 | **零添加**（`git diff` 全文 grep `SA7-DATAFLOW` = 0；本轮开始/结束 `git status` 对 `packages/**`/`docs/**` 完全一致——SA7 未修改任何实现/测试/设计文件） |
| 观察手段 | 优先使用既有面：`ShimHubProbes`（seamFramesIn/Out、sinkReturns、signals、openInputs、计数器）、driver/harness wire 时间线（原始字节）、observer 事件流、`collectUnhandledRejections`。不足处（A/B 字节对照、错误臂、相位计数）以 **3 个外部探针**补足：`artifacts/sa7-issue420-{carrier-commit-ab,fullround-hop,error-cleanup}-probe.mts`（+ `.log`）——不进任何 vitest/tsconfig include 面（镜像 SA6 探针纪律），保留为证据资产 |
| 已删除项 | 2 个 `/tmp` 调试脚本（P2 排障用，已删） |
| 移除后复跑 | 包全量套件在探针落盘**之前**运行（80/651 绿）且探针不在 include 面 ⇒ 套件结果与探针存在性无关；聚焦三文件 + listen 矩阵在探针定稿后重跑绿（源码零改动，等价于移除后复跑） |

## 8. Dynamic Evidence Matrix

| Source | Requirement or risk | Driver | Expected | Actual | Evidence | Result | Suggested routing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SA6 §12.2 A1–A12（AC2 完整回合） | 内存管道对驱动 OPEN→bootstrap→live→reconcile→CLOSE | 聚焦 vitest（三契约路径） | 63/63 绿 | 63/63 绿、Type Errors 0 | `sa7-issue420-focused-420-tests.log` | ✅ | — |
| SA6 §12.3（AC3 shim 矩阵重跑） | 7 文件断言逐字不变 + 反空跑 + 零 unhandled | 聚焦 + 包全量 | shim 臂 53 绿 | 53 绿（含 `:212/:245` 再 OPEN 两用例、反空跑、afterAll 零 unhandled） | 同上 + 包全量运行 | ✅ | — |
| SA6 §12.5（AC5 session 零重检） | 回退序经 handleFrame 仍消费 + edge 单点负控 | 聚焦（C5a/C5b/C5c 用例） | 绿 | 绿；结构门 0 命中（本轮 grep 复核） | 同上 | ✅ | — |
| **SA4 §2.1/§10 SA4-O1（载体提交）** | 偏离设计 D7 字面的机制与 listen 逐字节等价 | **P1 A/B 探针** | 等价 | 三检查点 wire 时间线逐字节相等；违例即时；release/计时器后零输出；authorize 恰 1；零 unhandled | `sa7-issue420-carrier-commit-ab-probe.log`（3× 一致） | ✅ | 无返工（SA8 已裁 clear；RA1'' 文本补正归 Controller/SA1） |
| SA4 §11 行 1（vi.mock 平台稳定性——本轮环境） | shim 臂非静默空转 | 聚焦 shim-matrix 运行 | 反空跑绿 | 53 用例 + 反空跑绿（本轮 vitest 3.2.7 实测） | `sa7-issue420-focused-420-tests.log` | ✅（升级 vitest 时须复跑——维持 SA4 登记口径） | 后续回归 |
| SA4 §11 行 3（载体提交 authorized 结局全回合） | release 后零额外 wire 帧/零 unhandled | P1 探针 | 与 listen 同 | 5→5→5 帧零增长；unhandled 空 | `sa7-issue420-carrier-commit-ab-probe.log` | ✅ | — |
| Design §8.2 R1/R2（缝跳点 + 序回传承重） | 关键中间值（占位/回传序/描述子） | P2 探针 | 见 §3 表 | `sinkReturns=[2..10]` ≡ session 源 wire 序；占位全 0；描述子六字段实测 | `sa7-issue420-fullround-hop-probe.log`（3× 一致） | ✅ | — |
| Design §9 E2/E4/E6/E7 | 错误分类/清理/隔离/幂等 | P3 探针 | 见 §6 表 | 19/19（两 E2 臂 + 溢出 1008 + 守卫放弃 + throw 隔离 + close 幂等） | `sa7-issue420-error-cleanup-probe.log`（3× 一致） | ✅ | — |
| Design §8.1 路由相位状态机 | 互斥/单调/不可逆；禁态不出现 | P1/P3 探针 | 见 §5 表 | routing→authorized（S2）/→denied 吸收（P1/S3）/authorized 不重入（S5）全部实测；零二次 open、零 INTERNAL_ERROR | 三探针日志 | ✅ | — |
| SA8 §5 冻结面 | DENY 零 diff、导出恰增一名 | 本轮 `git diff --stat` + 包全量 | 空/绿 | 空；80/651 绿（含 C5a 导出面断言） | §9 命令清单 | ✅ | — |
| SA4 §11 行 4（多连接 `probes.handles` 键冲突） | 未来使用前先修键 | 本轮未使用多连接句柄断言 | 不触及 | 未触及（P2/P3 单连接场景；与 SA4 O3 登记口径一致） | — | 登记 | 未来测试扩展时 |

## 9. Commands and Evidence

全部在 worktree 根执行；日志为 worktree-relative：

| # | Command | Result | Evidence |
| --- | --- | --- | --- |
| C1 | `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/ws-replication/test` | **Test Files 80 passed (80) / Tests 651 passed (651) / Type Errors no errors / exit 0** | 控制台输出（本轮 47.30s；数字与 SA3 V4 一致） |
| C2 | `… vitest run --typecheck <round + shim-matrix + api.test-d 三路径>` | **3 files / 63 tests / Type Errors no errors / exit 0** | `artifacts/sa7-issue420-focused-420-tests.log` |
| C3 | `… vitest run <7 矩阵文件>`（listen 臂基线） | **7 files / 52 tests / exit 0** | `artifacts/sa7-issue420-listen-matrix-baseline.log` |
| C4 | `… pnpm exec tsx artifacts/sa7-issue420-carrier-commit-ab-probe.mts` | **PROBE_RESULT 19/19**（listen ≡ shim byte-for-byte） | `artifacts/sa7-issue420-carrier-commit-ab-probe.log` |
| C5 | `… pnpm exec tsx artifacts/sa7-issue420-fullround-hop-probe.mts` | **PROBE_RESULT 23/23** | `artifacts/sa7-issue420-fullround-hop-probe.log` |
| C6 | `… pnpm exec tsx artifacts/sa7-issue420-error-cleanup-probe.mts` | **PROBE_RESULT 19/19** | `artifacts/sa7-issue420-error-cleanup-probe.log` |
| C7 | C4–C6 各 3 轮 | 9/9 rc=0，PROBE_RESULT 逐字一致 | `artifacts/sa7-issue420-probe-stability-3x.log` |
| C8 | `git diff --stat -- <DENY 全表 20 路径 + 7 矩阵文件>` | **空**（两段分别核对） | 控制台输出（§4 末行） |
| C9 | `git diff \| grep -c SA7-DATAFLOW` → `0`；`grep -c expectedSequence src/hub-session-host.ts` → `0`；`git status` 开始/结束对 `packages/**`/`docs/**` 一致 | 零临时诊断、C5c 结构门 0 命中、SA7 零实现改动 | 控制台输出 |

## 10. Deviations

1. **探针侧修正（非实现发现）**：P1 首轮 A/B 字节对照 FAIL——差异仅 HELLO challenge nonce（16 字节随机），注入同种子确定性随机后三检查点全等；协议帧自始逐字节相等。P2 探针三处观察面修正（channelEdges 快照改为按需重算、hub.close 后 peer 重拨导致 `run.wire` 指向新线改为先取引用、CLOSE_OK 需谓词泵）；P3 S1 臂 B 的 reserved 字节偏移修正（envelope 检查序第 5 步在 offset 16，非 7——首轮命中 `UNSUPPORTED_FLAGS` 恰好反向证实 codec 检查序确定性）。以上全部为探针观察面修正，**零实现侧发现**。
2. **E2 观察值澄清（设计一致，非偏差）**：设计 E2 = `err.code ?? 'MALFORMED_FRAME'`——magic 失配臂实际传播 codec 码 `BAD_MAGIC`（`err.code` 在场时原样传播），reserved 违例臂为 `MALFORMED_FRAME`；两臂均为在册码 + `close(1002)`，无静默吞帧。与设计字面逐字一致。
3. **无阻断发现**：本轮全部动态证据（套件、聚焦、三探针 ×3 轮）与批准契约、设计 §8/§9、SA4 评审论据、SA8 裁决一致；SA4-O1/O5 的回流项（设计 D7 文本补正 + ADR 附录 A2 β 措辞对齐）属 SA8 已裁 clear 的 wiki/docs 内务（RA1''），不构成本轮动态验证的 fail 事由。

## 11. Verdict

**`approve`**。

- 设计声明改变的数据流（R1–R6/R3b，含已评审载体提交读法）全部按设计变化，关键中间跳点有运行时实测值（§3/§3.1）；
- 设计声明不变的路线（listen 矩阵、wire 序纪律、edge 序单点、deny 族、DENY 零 diff）保持不变（§4）；
- 状态机转换与关键值正确（通道 FSM 边序列、桥路由相位三分支、句柄本地态），禁止转换未出现（零二次 open、零二次 authorize、零 INTERNAL_ERROR、终态不复活）（§5）；
- 错误路径响亮且分类正确（E1/E2/E4/E6/E7 + 载体提交迟归续体 + closed 守卫），cleanup 到达 quiescence（零残留 timer 出帧、全场景零 unhandled rejection）（§6）;
- 临时诊断零注入、证据资产已固化（§7）。

## 附：artifactPaths（worktree-relative）

```text
wiki/raw/task_issue-420_sa7_report.md
artifacts/sa7-issue420-carrier-commit-ab-probe.mts
artifacts/sa7-issue420-carrier-commit-ab-probe.log
artifacts/sa7-issue420-fullround-hop-probe.mts
artifacts/sa7-issue420-fullround-hop-probe.log
artifacts/sa7-issue420-error-cleanup-probe.mts
artifacts/sa7-issue420-error-cleanup-probe.log
artifacts/sa7-issue420-probe-stability-3x.log
artifacts/sa7-issue420-focused-420-tests.log
artifacts/sa7-issue420-listen-matrix-baseline.log
```
