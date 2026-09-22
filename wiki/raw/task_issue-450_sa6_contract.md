# SA6 诊断与验收契约 — issue #450（γ-T4）：γ 流控与生命周期收口——1011、close 冲刷 pending、revoke/settled 跨缝

- Dispatch：`sa-3509a429-d024-4b11-bb53-8a7a9ab0290f`（mabf-sa6 / acceptance-contract / iteration 0）
- 任务类型：**Feature 的能力缺口诊断 + 验收契约**（γ-T4 语义：账本越界收口、单帧配置错误收口、close 丢弃/冲刷、revoke 不溯及、settled/drain、OPEN 水位、内存安全链）。
- Baseline worktree：`/home/wangjian/nomicore-fix-issue-450`，branch `mabf/issue-450` 派生基线，HEAD **`444c1665fdb35b618bbb378a5b6bcefacfd288a7`**（`Merge pull request #455 from nomicore-ai/mabf/issue-448`；γ-T1 `52e634b` + γ-T2 `0c92b3e` 已在 HEAD）。
- 结论：**`verdict: approve`** —— 诊断可稳定复现（3/3 确定性）、根因/缺口以运行时行为证实（P1/P2 红）、四条已交付腿以运行时锚复证（P3–P6 绿）、契约可执行且入口真实；**不伪称整票红灯**：AC1/AC2/AC7 属真缺口（红），AC3/AC4/AC5/AC6 在 HEAD 已具备、剩余缺口是「锚覆盖」（绿回归契约）。
- 派工约束遵守：**本票未实现任何生产代码，也未落地任何验收测试**（临时诊断探针收尾删除，§16）；交付物 = 本报告 + 4 份运行证据日志。

---

## 1. Task type and inputs

| 输入 | 路径 | 状态 / 关键内容 |
|---|---|---|
| Host 任务简报 | `wiki/raw/task_issue-450.md` | 在场；Issue #450 body：What to build + AC1–AC7 + `Blocked by #448` + Parent PR #446；`## Comments` 空 |
| Owner comments | 派工明示「REST snapshot 为空：无 owner 要求」；简报 Comments 亦空 | **无 owner 追加要求**——需求全集 = Issue body 7 条 AC + ADR 0032 A4.3/A4.5 + 协议 §24.5/§24.7 |
| `task_issue-450_relevant_decisions.md` | `wiki/raw/` | **不存在**（非阻塞，§3 以规范权威替代） |
| `task_issue-450_conflict_report.md` | `wiki/raw/` | **不存在**（非阻塞） |
| SA8 产物（#450） | `wiki/raw/`、`artifacts/` | **不存在**（#450 无 design/sa2/sa3 产物；实查） |
| 规范权威（本票需求原文） | `docs/adr/0032-transport-decoupling-edge-session-split.md:55-114`（附录 A4）、`docs/protocols/instance-replication-v1.md:1091-1154`（§24） | 已读原文；A4.3（流控单点/拒纳语义）、A4.5（生命周期单规则）、§24.5、§24.7 逐字 |
| 前序票设计（γ 机械出处） | `wiki/raw/task_issue-447_design.md` §8.3/§8.6/§8.6.1/§9.1/§9.2/§9.4 | 在场；γ 缝、两相记账、close 冲刷、0 值语义、内存链读法 |
| 前序票验收契约 | `wiki/raw/task_issue-447_sa6_contract.md`、`wiki/raw/task_issue-448_sa6_contract.md` | 在场；T1/T2 绿灯沿革与边界登记 |
| 模块规约 | `packages/ws-replication/AGENTS.md`（缝纪律 + Verification）、根 `AGENTS.md`、`docs/AGENTS.md` | 已读；γ append-only 纪律、规范文档同步义务、验证门 |
| 相邻票边界 | Issue #449（γ-T3 reconcile+分块，`Blocked by #448`）、#451（γ-T5 观测面+全量回归） | 本契约边界见 §12.3；#449 未合入 HEAD（不影响本票，T3 无依赖关系但共享 transfer 面） |

**范围（in scope）**：γ 缝流控与生命周期收口语义的可执行锚——账本越界 → 1011 连接死亡、单帧超限 → 配置错误收口、收口后 session→edge 静默丢弃、close 冲刷 pending（含在管帧）、`terminateUnauthorized` 不溯及、`settled` 晚到 drain 与 `closeTimeoutMs` 逃生舱、OPEN 水位（16 帧/4 并发）延迟复核、逐跳内存有界与死亡释放。
**不在范围（out of scope）**：任何生产实现与测试落地（派工明示「do not implement code or tests」）；T3 的分块 transfer 全回合与 drain 第三触发点（#449）；T5 的 `update-sent` 总归属与根门禁全量回归（#451）；wire 格式与协议语义改动（§24 是 host-facing 契约，wire 零变化）。

---

## 2. Owner comment mapping

- 派工明文：本 Issue 的 REST comments 快照为空；简报 `## Comments` 亦空 ⇒ **无 owner 追加要求可映射**。
- Owner 要求 = 简报正文 7 条 AC。AC → 契约条目 → HEAD 状态：

| Issue AC | 契约条目（§12.2） | HEAD 状态 | 依据 |
|---|---|---|---|
| AC1 账本溢出 → 1011 收口；逐帧拒纳 / ns 级 send-failed resync 在 γ 不可达 | `BPK-C1`、`BPK-C2`、`BPK-NC1` | **缺口（红）**：越界 ⇒ 静默丢帧 32/80、连接存活、ackTimeout 后 ns 级 `RESYNC_REQUIRED`×1 | §5-P1、§8 |
| AC2 单帧超连接级上限 → 响亮收口 + 诊断（配置错误定性） | `OVS-C1`、`OVS-NC1/N2` | **缺口（红）**：`sendDataFrame` 返回 0、零 ERROR/零 observer/零 close | §5-P2、§8 |
| AC3 close 后 session→edge 丢弃锚；close 冲刷 pending 无泄漏 | `DROP-C1`、`FLUSH-C1`、`FLUSH-C2` | **已具备（绿）+ 锚缺失**：P3 零盖章/零回执/零字节；P4 冲刷后零 ack-timeout 声明 | §5-P3/P4 |
| AC4 `terminateUnauthorized` 不溯及已推帧锚 | `REVOKE-C1`、`REVOKE-NC1` | **已具备（绿）+ 锚缺失**：P5 已推帧序 7 在 wire、回执 FIFO 先于 terminate | §5-P5 |
| AC5 `settled` 晚到 drain 锚；`closeTimeoutMs` 行为不变 | `DRAIN-C1`、`DRAIN-NC1` | **已具备（绿）+ 锚缺失**：P6 未到点不误收口、到点 1001 'hub-reauth' | §5-P6 |
| AC6 OPEN 水位延迟复核：原值不误收口；打穿响亮收口 | `OPENWP-C1/C2` | **已具备（白盒锚）+ γ 延迟 permutation 缺失**：OAP-C4c/C4d/C5a/C5b 白盒覆盖 16/4 | §10、§12.2 |
| AC7 内存安全链锚：逐跳有界；最坏账 = 上限后连接死亡释放 | `MEM-C1/C2` | **缺口（红）**：有界（admission 守卫）但「死亡释放」不成立；静默丢帧充当上限 | §5-P1、§8 |

---

## 3. SA8 constraints

- #450 **无 SA8 产物**（`relevant_decisions` / `conflict_report` / design 均缺席）⇒ 可执行约束取自规范权威（A4 与 §24 是 spec #445 / PR #446 的冻结面）与前序票设计，逐条如下：

| 约束 | 出处 | 本契约落点 |
|---|---|---|
| 缝词汇闭集合：`frame{tag,bytes,lane}` / `settled` / `connection-fatal{code}` / `frame{bytes}` / `receipt{tag,sequence}` / `close` / `terminateUnauthorized`；**无拒纳/闸门/信用词汇** | §24.3 / A4.1、A4.6 | 契约零新增缝消息；`BPK-C2`/`OVS-C1` 的收口经 `connection-fatal` 既有信号 |
| 流控单点 = edge；session 乐观发送；账本投影越界 ⇒ `CONNECTION_BACKPRESSURE`(1011) 收口整条连接；单帧超限 = 配置错误 ⇒ 响亮收口 + 诊断；**无逐帧拒纳、无 deferred、无 ns 级 send-failed resync** | §24.5 / A4.3 | `BPK-C1/C2`、`OVS-C1`（红）；`BPK-NC1` 钉死 β 差不动 |
| 回执在盖章点同一同步段投递（保序结构事实）；违契响亮收口 | §24.2 / A4.2 | `DROP-C1`、`REVOKE-C1` 的 FIFO 序判据 |
| 生命周期单规则：edge 决定收口起 session→edge 后到一切静默丢弃；close 沿同道 FIFO；session 收 close ⇒ pending 整体冲刷（按未发送清算）+ quiesce；`terminateUnauthorized` 不溯及已推帧；`settled` 晚到只使 drain 多等、`closeTimeoutMs` 不动 | §24.7 / A4.5 | `DROP-C1`、`FLUSH-C1`、`REVOKE-C1`、`DRAIN-C1` |
| OPEN 准入水位（≤16 早期帧/连接、≤4 并发 OPEN）与 pending 水位 = **故障参数**：打穿 = 宿主传输异常 = 响亮收口，不作流控调参 | §24.5 / A4.3 | `OPENWP-C1/C2`（原值不误收口 / 打穿响亮） |
| 内存安全链逐跳有界；慢连接最坏账 = `maxQueuedBytesPerConnection` + `maxQueuedControlBytes` 后连接死亡释放；分块无「洞中」形态 | §24.5 | `MEM-C1/C2` |
| γ 成功路径与 β wire 逐字节等价；拒纳路径**显式分叉并登记**（不等价属有意行为差）；β 行为不变 | A4.8 / §24.5 | `BPK-NC1`（β 负控 = 登记差的可执行锚） |
| 验收测试用**延迟可注入的显式异步内存管道**，不引入 worker_threads / 真实 timer | A4.8 | §7：全部夹具为显式 release + 虚拟调度器 |
| 公共面 append-only（`createHubReplicationEdge`/`createHubSessionHost`/`createHubAsyncSessionHost` 冻结签名）；`connection-fatal` 公共化**不新增错误码** | ADR 0032 A4.1 / 后果节 | §15-2：AC2 的收口码必须取既注册表码（`FRAME_TOO_LARGE` 配置类，1009），不得新增 |
| β/monolith 行为逐字节不变（硬门） | A4.8、模块 AGENTS.md | §12.2 `BPK-NC1` + §14 既有 101 文件全量绿 |
| 模块验证门：每个改动的状态机路径聚焦测试；缝变更另跑 edge/session 契约与 wire parity；生命周期改动须跑包 typecheck + 根 `pnpm typecheck`/`pnpm test` | `packages/ws-replication/AGENTS.md`「Verification」 | §14；包级证据在本次采集，根门禁归 #451/T4 实现阶段 |

---

## 4. Environment and baseline

- 环境：`node v24.13.0`、`pnpm 10.28.2`、`vitest 3.2.7`、`typescript 5.9.3`；worktree 初始无 `node_modules`，`pnpm install --frozen-lockfile` 完成（lockfile 零改动，exit 0）。
- HEAD 基线实跑（本票改动前，`git status` 生产面零改动）：
  - γ 前序票聚焦套件（#447 三文件 + #448 一文件）= **4 文件 / 43 用例绿、`Type Errors no errors`**（`artifacts/sa6-issue450-gamma-suites.log`）；
  - 包全量 `npx vitest run packages/ws-replication/test` = **101 文件 / 897 用例绿、`Type Errors no errors`、exit 0**（`artifacts/sa6-issue450-baseline-package-suite.log`）；
  - 采集时点未包含任何新增文件（101/897 与 #448 SA6 基线逐值一致）。
- 运行命令（可复现）：
  ```bash
  pnpm install --frozen-lockfile
  NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication/test
  ```

---

## 5. Positive reproduction（运行时行为，3/3 确定性）

临时探针（`packages/ws-replication/test/sa6-issue450-probe.test.ts`，**收尾删除**；原始输出 `artifacts/sa6-issue450-probe.log`、`artifacts/sa6-issue450-probe-repeat3.log`）复用 #447/#448 公共夹具（真 peer、真 Registry/Runtime、真公共工厂、显式 release FIFO 管道、虚拟调度器；零 wall-clock / 零真实 timer）。断言全部为运行时行为（wire 帧 / `[8..12]` 盖章 / 缝消息消费序 / observer 事件 / `sendDataFrame` 返回值），零源码 grep。

| 探针 | 编排（最小输入） | 观察到的 HEAD 行为 | 判定 |
|---|---|---|---|
| **P1** 账本越界（`maxQueuedBytesPerConnection=4096`、`lowWater=1024`、`highWater=2048`、`maxInFlightUpdates=32`；300 笔 hub 写入 + 泵） | 无冲刷证据（harness transport 无 `bufferedAmount` ⇒ 账本只增，等价「慢对端」） | `outboundData=80` 过缝，`wireUpdates=48` 达 wire ⇒ **32 帧被静默拒纳**；`fatal=[]`、`connectionFailedEvents=0`、`hubTransportClosed=false`；推进 `ackTimeoutMs+1` ⇒ `RESYNC_REQUIRED=1`（ns 级 ack-timeout），连接仍存活 | **缺口（红）**：越界未收口 + 逐帧静默丢帧 + ns 级 resync —— 正是 A4.3 登记的 **β 语义** |
| **P2** 单帧超连接级上限（`maxQueuedBytesPerConnection=16384`；20480B 单帧经公共 egress 宿主直驱） | ADR 决策 5 登记的宿主直驱 data 帧面；同一 `tryEmitDataFrame` 单帧守卫也服务 session 组装路径 | `egressReturn=0`；`fatal=[]`、`connectionFailedEvents=0`、`updateSentEvents=0`、`hubTransportClosed=false` | **缺口（红）**：**零诊断的静默吞帧**，无响亮收口 |
| **P3** edge 决定收口后 session→edge 后到帧（扣留 session→edge，关 hub 侧传输，先送 close 再放行） | 收口决定前已推、决定后到达的 1 帧 | `stamps 5→5`、`receipts 5→5`、`wire 6→6`、`fatal=[]` | **已具备（绿）**：A4.5 静默丢弃成立 |
| **P4** close 冲刷 pending（`maxInFlightUpdates=1` + 扣留 edgeToSession + 关传输） | 1 帧在管（pending 占窗）+ 1 帧队内 | `closeCalls=1`；冲刷后推进 `ackTimeoutMs+1` ⇒ `RESYNC_REQUIRED=0`、`fatal=[]` | **已具备（绿）**：pending/在管整体按未发送清算、无泄漏 |
| **P5** `terminateUnauthorized` 不溯及已推帧（扣留 edgeToSession 延迟 revoke 信号） | 已推帧盖章（tag6→seq7）后 revoke，再放行信号 | 已推帧仍在 wire（`updateSeqs=[7]`）；回执 FIFO 位 10 **先于** `terminateUnauthorized` 位 11；wire `ERROR{NAMESPACE_UNAUTHORIZED}` 恰一类；`nsState=failed`、连接存活、`fatal=[]` | **已具备（绿）**：不溯及 + 撤销 = ns 级终局（非连接死亡） |
| **P6** `settled` 未达的 reauth drain + 逃生舱 | `requestReauth` → GOAWAY×1；虚拟推进 `closeTimeoutMs-1` / 再 +2 | `closeTimeoutMs-1` 时未收口；到点 `closeInfoAfterDeadline={code:1001, reason:'hub-reauth'}`；`fatal=[]` | **已具备（绿）**：原值不误收口、到点 1001 收口（逃生舱不动） |

**关键读数**：P1 的「32/80 帧静默拒纳 + ns 级 resync + 连接存活」与 A4.3 的文字要求（γ = 连接级死亡；β = ns 级 `send-failed` resync、连接存活）**逐条反向**——HEAD 的 γ 在此退化为 β 语义。P3–P6 证明 T1 已交付的生命周期机械在γ缝上成立，缺的是本票的**验收锚**（verification gap）。

---

## 6. Negative control

| # | 负控 | 断言 | 状态 |
|---|---|---|---|
| NC-1（β 差） | `BPK-NC1`：同 P1 编排走 β（监听单体或 `createHubSessionHost` 同步缝） | ns 级 `RESYNC_REQUIRED{send-failed}` + 连接存活 = **登记差不动**；证明 γ 契约断言键在「缝形态」而非「越界事实」 | 待实现阶段落地（既有 β 证据：#169/#172/#137-R2 族锚定 1011=control 耗尽） |
| NC-2（配置键） | `OVS-NC1`：同 20480B 帧在 cap 充裕配置（cap ≥ 帧长）下 | 正常盖章出站、零收口 ⇒ 证明 AC2 断言键在**配置错误**而非「大帧」本身 | 待实现阶段落地 |
| NC-3（界内） | `BPK-C3`/`OVS-NC2`：账本未越界 / 帧 ≤ cap | 零收口、帧正常盖章（严格大于判据不变） | 待实现阶段落地（P1 中越界前 48 帧即天然界内对照） |
| NC-4（冲刷非恒真） | `FLUSH-C2`：无 close 的同一扣留编排（`maxInFlightUpdates=1`） | 必达 `RESYNC_REQUIRED{ack-timeout}×1`（= #447 `PEND-C3` 既有绿锚）⇒ 证明 P4 的「零声明」不是恒真 | **已证**（既有用例 + P1 的 ack-timeout 声明面） |
| NC-5（撤销幂等） | `REVOKE-NC1`：重复 revoke | 零第二次 `NAMESPACE_UNAUTHORIZED`、零新收口（P5 的 `terminateIndex` 单点） | 部分已证（P5）；重复调用待实现阶段补 |
| NC-6（水位边界） | `OPENWP-C1`：恰 4 并发 OPEN / 恰 16 pending 帧 | 零收口（原值不误收口）——即 C2 收口断言的反向对照 | 白盒已证（OAP-C4d/C5a）；γ 延迟 permutation 待落地 |
| NC-7（逃生舱敏感） | `DRAIN-NC1`：注入非缺省 `closeTimeoutMs` | 收口时刻随配置移动（参数未被 γ 改值/软化为常量） | 待实现阶段落地 |

零负控失败；无 skip/only/todo、无 env override、无 fallback（探针中的「应当失败」面以显式期望值断言现状，非吞错）。

---

## 7. Stability, scale and timing

- **确定性**：P1–P6 探针连续 3 次运行 **3/3 全绿，读数逐值相同**（`P1: outboundData=80 / wireUpdates=48 / unsealed=32`；`P2: egressReturn=0`）——见 `artifacts/sa6-issue450-probe-repeat3.log`。
- **零不确定源**：异步性 = 夹具显式 `release()` 的 FIFO 通道；时间 = `makeManualClock` / 虚拟调度器 `advanceBy`（精确决定 ackTimeout / closeTimeout 边界）；零真实 timer、零 wall-clock、零 sleep、零网络。
- **规模/时序条件**：P1 以 cap=4KiB + 300 笔小写入在最小步数内到达账本上界（吞吐 ≈ 40B/帧）；P2 以 cap=16KiB + 20KiB 单帧一发生效；P6 以 `closeTimeoutMs` 的 ±1ms 虚拟推进卡边界。所有阈值可显式注入，不依赖缺省值。
- **性能面**：本票无性能断言（非目标）；内存安全链以**账目/队列计数**（`pendingSends`/`inFlight`/handoff/queued）为可观察代理，不做真实堆测量。

---

## 8. Capability gap / root-cause chain

**总判**：HEAD 的 γ 缝具备 T1 交付的**生命周期机械**（收口后丢弃、close 冲刷、revoke、drain），**缺**「流控越界 → 连接级死亡」这一 γ 特有语义（A4.3 与 β 的显式行为差），且四个已有腿**无验收锚**。

| Step | 事实 | Evidence | Confidence |
|---|---|---|---|
| S1 | γ 数据帧的 edge 入口 = `HubReplicationEdgeEgress.sendDataFrame` → `ConnectionSender.tryEmitDataFrame`；该字节路径的**唯一失败动作是返回 0** | `hub-edge-host.ts:694-695`、`backpressure.ts:165-174` | 高 |
| S2 | 单帧守卫（`frameBytes > cap`）与账本投影守卫（`projected > cap`）**都不调用 `onBackpressureExhausted`**；1011 只由 control 保留额度耗尽（暂停态）触达 | `backpressure.ts:167,171` vs `:121,:153`；`hub-edge.ts:214` | 高 |
| S3 | 0 ⇒ 宿主桥**不投回执**（receipt 只承载盖章事实）⇒ session 侧 tag 停留 pending、占窗，无任何连接级信号 | 夹具桥 `issue447-async-seam.ts:498-517`（§24.2.3/§24.3 的忠实中继）；`hub-session-async-host.ts:256-264` | 高 |
| S4 | pending 占窗由 ackTimeout 有界兜底 ⇒ **ns 级** `RESYNC_REQUIRED{ack-timeout}`，连接存活 | P1 读数；`update-channel.ts:719` → `abandonInFlight`（`:671`） | 高（运行时已证） |
| S5 | 单帧超限同样静默：0 返回、零 observer、零 ERROR、连接存活 | P2 读数；`hub-edge.ts:267-271`（`emitUpdateSentAtStamp` 仅 `sequence>0`） | 高（运行时已证） |
| S6 | 收口后丢弃/close 冲刷/revoke/drain 已由 T1 机械交付：edge egress 的 `connectionState()==='closed'` 闸、session `unresolvedTags.clear()+sink.close()`、channel `teardown()` 清 pending/inFlight/queued、`settledNames`+drain deadline | `hub-edge-host.ts:694-695`、`hub-session-async-host.ts:197-202`、`hub-session.ts:284-297`、`update-channel.ts:692-703`、`hub-edge.ts:743-780`；P3–P6 绿 | 高（运行时已证） |
| S7 | OPEN 水位（16/4）已实现且白盒有锚，但**无 γ 缝延迟注入 permutation** | `hub-edge-host.ts:187,191,296,331,335,379`；`hub-upgrade-admission.ts:26,88-92`；OAP-C4c/C4d/C5a/C5b | 高 |

**症状 → 直接故障点 → 触发条件 → 最深根因 → 放大因素**（Feature 缺口链，不虚构 Bug 根因）：

| 环节 | 内容 |
|---|---|
| 症状 | γ 连接在慢对端/大突发下出现「帧消失但连接存活」；越界后由 ackTimeout 兜底成 ns 级 resync |
| 直接故障点 | 字节形态 data admission 的失败语义只有 `return 0`（无 `onBackpressureExhausted`），且 0 在 γ 缝上不可观察 |
| 触发条件 | 账本投影越界（慢性拥塞）或单帧 > cap（配置错误）；两者共用同一守卫，均不产生任何连接级结果 |
| 最深根因 | 拆分后 **β 与 γ 共享 edge 字节路径**（`ConnectionSender`/`HostEdgeConnection.egress`），A4.3 要求的「γ=连接死亡 / β=ns resync」的分叉点尚未建立——`tryEmitDataFrame` 从未被赋予「失败即连接终局」的语义 |
| 放大因素 | receipt 词汇只承载盖章事实（§24.3 闭集合，正确设计）⇒ session 在 γ 侧**无法**把「无回执」判定为连接级事实；无冲刷证据的传输使账本只增（P1 构造），越界可达性提高；单帧路径零诊断（observer 全静默），可运维性为零 |
| 已排除 | 见 §11 |

---

## 9. Causal experiments

| 实验 | 变量 | 对照 | 结论 |
|---|---|---|---|
| X1 越界归因 | 账本压力（cap=4KiB + 300 笔 vs 缺省 8MiB） | P1 | 越界后行为 = 静默丢帧 + ns 级 resync + 连接存活；**与 β 登记语义一致**，与 γ 目标相反 |
| X2 失败语义归因 | 单帧 > cap（P2）vs 账本投影越界（P1） | 两分支 | 两条守卫都返回 0、都不触发 1011 ⇒ 缺口是**守卫的失败动作**，不是某一分支遗漏 |
| X3 收口丢弃归因 | 收口前放行 vs 收口后放行（P3） | 自身前后 | 收口后 0 盖章/0 回执/0 字节/0 信号 ⇒ 丢弃规则由 edge egress 的 `closed` 闸承接，成立 |
| X4 冲刷归因 | 有 close（P4）vs 无 close（#447 PEND-C3） | 互为对照 | 有 close ⇒ 零 ack-timeout 声明；无 close ⇒ 必达声明 ⇒ 「冲刷」断言有判别力 |
| X5 不溯及归因 | 信号到达前已推帧（P5） | 缝 FIFO 消费序 | 回执位 10 先于 terminate 位 11、帧仍在 wire ⇒ 不溯及为**结构事实**（盖章点先于信号入队） |
| X6 逃生舱归因 | `closeTimeoutMs-1` vs `+2`（P6） | 虚拟时间 | 到点前零收口、到点恰 1001 'hub-reauth' ⇒ deadline 驱动，非事件驱动 |
| X7 β/γ 分叉（待实现阶段） | 同编排换缝形态（γ vs β） | `BPK-NC1` | 目标：γ=1011 连接死亡、β=ns resync 存活；HEAD 两者同相（=β） |

---

## 10. Impact surface（证据触点，HEAD 行号）

| 面 | 符号 / 行 | 与本票 AC 的关系 |
|---|---|---|
| 字节形态 data admission（承重点） | `src/backpressure.ts:165-174`（`tryEmitDataFrame`：`:167` 单帧守卫、`:171` 账本投影守卫，均 `return 0`） | AC1/AC2/AC7 缺口所在（**设计阶段唯一应改动点候选**） |
| 1011 既有触发面 | `src/backpressure.ts:121,153`（control 保留额度耗尽）→ `src/hub-edge.ts:214`（`connectionFatal('CONNECTION_BACKPRESSURE', 1011)`） | AC1 的目标机制（既有机械，复用） |
| edge 连接级收口 | `src/hub-edge.ts:673-698`（`connectionFatal`：ERROR 帧 + close + observer `connection-failed`）、`:112-116`（`wsCloseCodeFor`） | AC1/AC2 的响亮面与诊断面；`FRAME_TOO_LARGE` → 1009（`:113`） |
| egress 静默闸 | `src/hub-edge-host.ts:694-695`（`port.connectionState()==='closed' \|\| !port.dataGateOpen() ? 0 : ...`） | AC3 丢弃规则（绿）；同时掩盖 AC1/AC2 的失败（0 语义） |
| 盖章点与观测 | `src/hub-edge.ts:267-271`（`sendDataFrame` 单漏斗；`sequence>0` 才发 `update-sent`）、`src/frame-io.ts:184-197`（`emitOne` 盖章单点） | AC2 诊断缺失（P2：零 `update-sent`） |
| session 缝句柄 | `src/hub-session-async-host.ts:96-98`（tag/未决集）、`:197-202`（close 冲刷）、`:219-222`（dormant 闸/自驱 drain）、`:256-264`（`emitSeam`） | AC3/AC4 |
| 两相记账与冲刷 | `src/update-channel.ts:122-145`（inFlight/pendingSends/abandonedTags）、`:450-470`（async 分支）、`:671-703`（`abandonInFlight`/`teardown`） | AC3/AC4/AC7 |
| 生命周期信号 | `src/hub-session.ts:284-297`（close/terminateNamespace）、`src/hub-namespace.ts:1241-1258`（`quiesceConnection`/`terminateUnauthorized`） | AC3/AC4 |
| drain 与逃生舱 | `src/hub-edge.ts:743-766`（`onChannelSettled`→`maybeFinishDrainEarly`）、`:768-780`（`finishDrain`→`close(1001,'hub-reauth')`）、`:333-350`（GOAWAY `drainTimeoutMs=closeTimeoutMs`） | AC5 |
| OPEN 水位 | `src/hub-edge-host.ts:187`（pending 16）、`:191`（并发 4）、`:296,331,335,379`（1008 收口）；`src/hub-upgrade-admission.ts:26,88-92`（早期帧 16 → `early-frame-limit`） | AC6 |
| 观测码闭集合 | `src/observer.ts:48-56`（连接域白名单 = 注册表键 ∪ 内部码）、`packages/replication-protocol/src/errors.ts:100-118`（`FRAME_TOO_LARGE`=`config`/1009、`CONNECTION_BACKPRESSURE`=1011） | AC2 的配置类码不新增（§15-2） |
| 既有锚（复用/对照） | `test/ws-replication-issue421-open-admission-pipeline.test.ts`（OAP-C4c/C4d/C5a/C5b、C6）、`test/ws-replication-issue447-async-session-round.test.ts`（PEND-C3/E、ROUND-C1 close 段）、`test/ws-replication-issue448-live-data-plane.test.ts` | AC6 白盒锚、AC3 负控、AC1/AC2 的 β 对照 |
| 夹具面 | `test/issue447-async-seam.ts`（899 行：通道对/释放泵/探针/桥）、`test/issue448-live-seam.ts`（bootLiveRound） | 本契约全部编排的公共面 |

---

## 11. Ruled-out hypotheses

| # | 假设 | 判定 | 证据 |
|---|---|---|---|
| H1 | 「账本越界 → 1011」已由既有机械覆盖，只是缺锚 | **排除** | P1：`fatal=[]`、`connectionFailedEvents=0`、连接存活；`tryEmitDataFrame` 两条守卫均 `return 0`（S1/S2） |
| H2 | 单帧超限已响亮收口，只是事件在别处 | **排除** | P2：`egressReturn=0`、零 `update-sent`、零 `connection-failed`、零 close（S5） |
| H3 | 越界帧由 session 侧 `send-frame-rejected`/`update-too-large` 兜底（可诊断） | **排除** | γ 端口以 **tag** 应答（`hub-session-async-host.ts:215-217`），edge 的 0 不经该面；P1 的丢帧仅以静默 pending + ackTimeout 收尾 |
| H4 | 收口后 session→edge 后到帧仍被盖章/回执 | **排除** | P3：`stamps/receipts/wire` 零新增（egress `closed` 闸） |
| H5 | close 冲刷不覆盖「在管帧」，存在 pending 泄漏 | **排除** | P4：`closeCalls=1`，其后 ackTimeout 零声明；`teardown()` 清 pending/inFlight/queued（`update-channel.ts:692-703`） |
| H6 | `terminateUnauthorized` 会撤回/作废已推帧 | **排除** | P5：已推帧序 7 在 wire、回执先于 terminate、连接存活 |
| H7 | `settled` 晚到会二次收口或使 deadline 失效 | **排除** | P6：到点前零收口、到点恰 1001；`maybeFinishDrainEarly` 有 `closedFlag` 第二道闸（`hub-edge.ts:759`） |
| H8 | OPEN 水位（16/4）在 γ 下不可达/未实现 | **排除** | 白盒锚 OAP-C4c/C4d/C5a/C5b 全绿；常量与收口点在场（S7） |
| H9 | 探针红灯源于环境/fixture/超时错误 | **排除** | 3/3 逐值复现；同夹具同编排的 P3–P6 全绿；无真实 timer/网络；`git status` 生产面零改动 |

---

## 12. Acceptance contract and test paths

### 12.1 契约工件（worktree-relative；实现阶段落地，本票不落地）

| 工件 | 作用 |
|---|---|
| `packages/ws-replication/test/ws-replication-issue450-flow-lifecycle.test.ts` | **验收契约本体**（`BPK/OVS/DROP/FLUSH/REVOKE/DRAIN/OPENWP/MEM` 条目） |
| `packages/ws-replication/test/issue450-flow-seam.ts` | #450 夹具：装配复用 `issue447-async-seam.ts` + `issue448-live-seam.ts`；新增旋钮（F1–F3）全部 **append-only**、缺省零传 ⇒ T1/T2 行为逐字不变 |
| 既有夹具的 append-only 扩展（仅当必要） | `issue448-live-seam.ts`（慢对端/延迟注入面）、`issue447-async-seam.ts`（deferred sink resolver 面）——改后 #447/#448 全量用例复跑必须绿 |

**夹具需求（设计阶段裁定，非本票实现）**：

- **F1 慢对端/账本压力旋钮**：可注入 `transport.bufferedAmount` + 显式「冲刷证据」推进（模拟对端消费），使「及时消费 ⇒ 不越界」与「慢对端 ⇒ 越界」两态都可编排。最小可行替代（P1 已用）：无 `bufferedAmount` 的既有 harness 传输 ⇒ 账本无退休、等价永久压力——**须在夹具注记中登记该等价性**。
- **F2 延迟 sink 解析旋钮**：`resolveSessionSink` 可返回 deferred promise + 显式 resolve 泵（AC6 的「跨线程延迟」注入面；当前夹具同步解析 ⇒ `pendingOpenCount` 结构性 ≤1）。
- **F3 单帧超限载荷面**：现有 `SCHEMA_ENVELOPE`/ROOT 只允许 `{n, extra}` 数值 ⇒ 无法经 `writeHub` 产生 >cap 的 UPDATE。需专用命名空间夹具（宽松 schema）或经公共 egress 宿主直驱面（ADR 决策 5 登记面，P2 已用）二选一；契约必须固定其一。
- **F4 桥纪律不变**：宿主桥只做中继（零协议决策）；收口必须由 edge 发起，测试不得在宿主侧合成 1011/错误码。

### 12.2 契约清单（最小输入 / 可观察断言 / 负控 / 旧实现 / 目标实现）

| 条目 | 最小输入 | 可观察断言（运行时行为） | 负控 | 旧实现（HEAD） | 目标实现 |
|---|---|---|---|---|---|
| `BPK-C1` 账本越界 → 1011（AC1） | 慢对端/无退休证据 + 大突发：`maxQueuedBytesPerConnection=4KiB`、`lowWater=1KiB`、`highWater=2KiB`、批量写至越界 | 收口由 **edge 发起**：wire 连接级 `ERROR{CONNECTION_BACKPRESSURE}` 恰一；transport close **1011**；observer `connection-failed{code:'CONNECTION_BACKPRESSURE', wsCloseCode:1011}` 恰一；edge→session `close` 恰一次生效（`closeCalls=1`）且 session 侧 pending 按未发送整体冲刷 | `BPK-C3`（未越界不收口） | **红**：零 ERROR、零 observer、连接存活、丢帧 32/80 | 绿 |
| `BPK-C2` 拒纳/resync 路径在 γ 不可达（AC1） | 同上 | 越界收口后：wire **零** `RESYNC_REQUIRED`（不出现 ns 级 resync）；零 `send-frame-rejected`/`update-too-large` 诊断；零 session→edge `connection-fatal`（方向不承载本收口）；缝词汇零新增（§24.3 闭集合） | `BPK-NC1`（β 必达 resync） | **红**：`RESYNC_REQUIRED=1`（ns 级 ack-timeout）、32 帧静默拒纳 | 绿 |
| `BPK-NC1` β 登记差（AC1 对照） | 同 `BPK-C1` 编排走 β（单体或同步缝） | ns 级 `RESYNC_REQUIRED{send-failed}` + 连接存活；**γ 断言不适用于 β** | 互为正负 | 绿（既有语义） | 绿（不得回归） |
| `OVS-C1` 单帧超限 → 配置错误收口（AC2） | 单帧 > `maxQueuedBytesPerConnection`（cap < 帧长；cap ≥ highWater 等链式约束） | 响亮收口：连接级 `ERROR{FRAME_TOO_LARGE}`（注册表 `retryable:'config'`）+ close **1009**（`wsCloseCodeFor` 既有映射）+ observer `connection-failed{code:'FRAME_TOO_LARGE', wsCloseCode:1009}`；断言**不存在**「egress 返回 0 且连接存活」的静默形态 | `OVS-NC1`（cap 充裕 ⇒ 同帧正常出站零收口）、`OVS-NC2`（帧 ≤ cap 界内放行） | **红**：`egressReturn=0`、零诊断、连接存活 | 绿 |
| `DROP-C1` 收口后 session→edge 静默丢弃（AC3） | 扣留 session→edge；edge 决定收口（1011 或对端断）；先送达 close 再放行后到帧 | 帧/settled/connection-fatal 后到：零盖章、零回执、零新 wire 字节、零新 observer/信号；`settled` 落账但不触发任何收口 | 收口前放行同帧 ⇒ 正常盖章（P3 自身前置） | **绿**（锚缺失） | 绿（回归哨兵） |
| `FLUSH-C1` close 冲刷 pending 无泄漏（AC3） | `maxInFlightUpdates=1` + 扣留回执；在管 1 帧 + 队内 N 帧；送达 close | `close()` 幂等（同 promise）；在管/队内/未决 tag 全清；其后推进 `ackTimeoutMs+1` ⇒ **零** `RESYNC_REQUIRED`、零 fatal；迟到回执良性 no-op | `FLUSH-C2` = #447 `PEND-C3`（无 close ⇒ 必达声明） | **绿**（锚缺失） | 绿（回归哨兵） |
| `REVOKE-C1` 不溯及已推帧（AC4） | 扣留 edgeToSession 延迟 revoke 信号；已推帧先盖章 | 已推帧序在 wire；其 receipt 在 edge→session FIFO 中 **strict 先于** `terminateUnauthorized`；revoke 恰一 `ERROR{NAMESPACE_UNAUTHORIZED}` + ns failed；连接存活 | `REVOKE-NC1`（重复 revoke 幂等、零第二帧） | **绿**（锚缺失） | 绿（回归哨兵） |
| `DRAIN-C1` settled 晚到 + 逃生舱（AC5） | reauth GOAWAY 后：settled 未达 / 早达 / 收口后晚达三形态；虚拟推进卡 ±1ms | 未达 ⇒ 到 `closeTimeoutMs` 恰 `close(1001,'hub-reauth')`；早达 ⇒ 提前收口（< deadline）；收口后晚达 ⇒ 零二次收口/零新事件 | `DRAIN-NC1`（注入非缺省 `closeTimeoutMs` ⇒ 收口时刻随之移动） | **绿**（锚缺失） | 绿（回归哨兵） |
| `OPENWP-C1/C2` OPEN 水位延迟复核（AC6） | γ 缝 + deferred resolver：恰 4 并发 OPEN / 恰 16 pending 帧；再 +1 | 恰 4 / 恰 16 ⇒ 零收口（原值不误收口）；第 5 / 第 17 ⇒ 恰一 `ERROR{CONNECTION_POLICY_VIOLATION}` + close **1008** + quiesce（打穿 = 故障参数定性） | C1 即 C2 的负控；白盒 OAP-C4d/C5a 同判据 | **绿**（白盒锚）+ γ permutation 缺失 | 绿 |
| `MEM-C1/C2` 逐跳有界 + 死亡释放（AC7） | 慢对端 + 大突发至上限（同 `BPK-C1`） | 每跳界限可观察：session 队列 ≤ `maxQueuedUpdateCount/Bytes`（越界 = 既有 queue-overflow 声明）、edge 账本 ≤ `maxQueuedBytesPerConnection`（+ control 独立额度）；达上限 ⇒ 连接死亡（1011）且 `teardown` 清零（wheel/handoff/pending/inFlight/queued 计数归零）——**不得**以静默丢帧充当上限 | `MEM-NC1`：及时消费（flush 证据推进）⇒ 零越界、零死亡 | **红**：死亡不存在，上限以静默丢帧实现 | 绿 |

> 「旧实现」列的红色取自本报告 §5 的运行时证据（P1/P2）；绿色项的「旧实现」= HEAD 行为正确但无专属锚 ⇒ 属回归哨兵，**不伪称红灯**。

### 12.3 边界登记（与相邻票的分工）

- **#449（γ-T3）**：分块 transfer 全回合、reconcile、drain 第三触发点（末 chunk 回执）。本契约的 `MEM-C1` 只用「整只 transfer 占 1 槽」的既有 T2 切片语义做账本压力；不重复 T3 回合。
- **#451（γ-T5）**：`update-sent` 总归属矩阵 + 根 `pnpm typecheck`/`pnpm test` 全量回归。本契约的 `OVS-C1` 只锚「单帧配置错误 ⇒ 收口」这一连接级判据，不主张 T5 的归属矩阵。
- **wire 面**：本契约全部断言为 host-facing 缝行为；wire 帧仅作**观察**（ERROR/close code），不新增/修改 wire 格式或协议语义。
- **观测面**：`connection-failed.code` 取值必须在 `CONNECTION_OBSERVER_CODES` 白名单内（注册表键 ∪ `PONG_TIMEOUT`/`OUTBOUND_SEQUENCE_EXHAUSTED`）——AC2 的 `FRAME_TOO_LARGE` 已在表内，无需扩面。

---

## 13. Red/green or baseline evidence

- **红灯（能力缺口，运行时已证）**：`BPK-C1`（P1：零 1011、32 帧静默拒纳、ns 级 resync）与 `OVS-C1`（P2：`egressReturn=0`、零诊断）在 HEAD 断言失败；`BPK-C2`/`MEM-C1` 与 `BPK-C1` 同源（同一守卫的失败动作）。
- **绿灯（已交付腿的回归哨兵）**：`DROP-C1`（P3）、`FLUSH-C1`（P4）、`REVOKE-C1`（P5）、`DRAIN-C1` 缺省形态（P6）在 HEAD 即为真；`OPENWP-C1/C2` 有白盒锚（OAP-C4c/C4d/C5a/C5b）。
- **断言敏感性（负控路径）**：`FLUSH-C2`/`BPK-NC1`/`OVS-NC1`/`OPENWP-C1`/`DRAIN-NC1` 各自给出「不设该条件则必红」的反向对照；实现阶段须把负控与正断言成对落地（禁止只有正断言）。
- **基线面**：包全量 101 文件 / 897 用例绿 + `Type Errors no errors`；γ 聚焦 43/43 绿（§4）。

---

## 14. Runner trigger evidence

- **采集规则**：根 `vitest.config.ts` `test.include = ['packages/*/test/**/*.test.ts', …]`；typecheck include = `packages/*/test/**/*.test-d.ts`。契约文件规划路径 `packages/ws-replication/test/ws-replication-issue450-flow-lifecycle.test.ts` **逐字命中**该 glob；夹具（`issue450-flow-seam.ts`）非 `*.test.ts` ⇒ 只作被导入模块。
- **实跑采集（新增文件在真实入口被发现）**：临时探针文件 `packages/ws-replication/test/sa6-issue450-probe.test.ts`（新增、位于规划路径同目录）被根配置采集并运行 = **1 文件 / 6 用例**（`artifacts/sa6-issue450-probe.log`；3 次复跑同形）；证明新契约文件无需改配置即可被 `pnpm test` / `npx vitest run` 发现。
- **既有采集面**：`npx vitest run packages/ws-replication/test` = 101 文件 / 897 用例；γ 四文件 = 43 用例；包 tsc 型门随 vitest `typecheck` 面 `no errors`。
- 无 `test.only`/`skip`/`todo`；无 env override（仅仓库既有 `NODE_OPTIONS=--conditions=nomicore-source` 条件导出）；无真实 timer/网络/长驻服务（未启动任何 job 常驻进程）。

---

## 15. Unknowns and blockers（交设计阶段裁定）

1. **【核心裁定】β/γ 分叉点**：`tryEmitDataFrame`（`backpressure.ts:165-174`）与 `HostEdgeConnection.egress.sendDataFrame`（`hub-edge-host.ts:694-695`）为 β/γ **共享**字节路径；A4.3 要求 γ=连接死亡、β=ns resync。设计必须显式引入分叉（append-only 的 egress/连接选项或缝形态标记），并以既有 β 全量套件绿证明 β 不变。**本报告不设计该分叉**（SA6 边界）。
2. **【裁定】AC2 收口码**：ADR 0032 明文「不新增错误码」；`FRAME_TOO_LARGE`（注册表 `retryable:'config'`、`wsCloseCodeFor`→1009）是语义最贴合且零扩展的候选。若设计另选码，必须在 ADR 0032 附录/§24 文本显式登记（`docs/AGENTS.md` 同步义务），契约断言随之移动。
3. **【夹具】F1–F3 三项扩展**未落地（延迟 resolver / 慢对端 bufferedAmount / 大帧载荷面）；`AC6` 的 γ permutation、`OVS-C1` 的 session 路径触发、`BPK-C1` 的「及时消费 ⇒ 不越界」对照依赖它们。F1 的最小替代（P1 的无退休账本）已在报告中登记等价性论证。
4. **#450 无 SA8 产物**：本契约以 ADR A4 + §24 + 前序票设计为可执行约束；若后续 SA8（design/conflict）产出与本契约冲突，需按 conflict gate 复核。
5. **#449 未合入 HEAD**：T3 的分块全回合/第三触发点不在本契约；实现 T4 时若与 T3 变更集重叠（`bulk-transfer`/`update-channel` async 分支），须在冲突报告中登记边界。
6. **根门禁**：本票只采集包级证据（包全量 + tsc）；根 `pnpm typecheck`/`pnpm test` 全量属 #451（T5）门禁，但实现阶段的模块 AGENTS 门（wire/lifecycle 改动跑根门禁）仍适用。

---

## 16. Temporary diagnostics cleanup

- **临时探针已删除**：诊断用 `packages/ws-replication/test/sa6-issue450-probe.test.ts` 为一次性最小复现脚本（6 条运行时断言，输出见证据日志），收尾删除；其可复现信息以 §5 读数 + 附录代码片段留存。
- **生产实现零改动**：`git status --porcelain` 仅显示本报告 + 4 份 `artifacts/` 证据日志 + Host 提供的两份 `wiki/raw/task_issue-450*.md`；`packages/**/src/**` 与任何包/域/应用/规范文档零改动（`git diff --stat` 空）。
- **无长驻资源**：零网络/零真实 timer/零 `nohup`/零 PID 文件/零遗留 job；虚拟调度器随测试进程释放。
- **无环境覆写**：仅仓库既有 `NODE_OPTIONS=--conditions=nomicore-source`；`pnpm install --frozen-lockfile` 未改 lockfile。
- **收尾状态**：包全量 101/897 绿、γ 43/43 绿、探针 3/3 确定性复现；证据日志：`artifacts/sa6-issue450-baseline-package-suite.log`、`-gamma-suites.log`、`-probe.log`、`-probe-repeat3.log`。

---

### 附：探针关键编排（删前快照，供实现阶段复现）

```ts
// P1 账本越界（慢对端等价：无冲刷证据 ⇒ 账本只增）
const round = await bootLiveRound({ limits: {
  maxQueuedBytesPerConnection: 4096, lowWater: 1024, highWater: 2048, maxInFlightUpdates: 32,
}, hubObserver: true });
await round.awaitLive();
for (let i = 1; i <= 300; i += 1) { await run.writeHub({ n: i }); if (i % 4 === 0) await pumpSteps(facade.host, 1); }
await pumpSteps(facade.host, 4);
// 读数（HEAD）：outboundData=80 / wireUpdates=48 / unsealed=32 / fatal=[] / 连接存活
await run.hubNode.scheduler.advanceBy(TIMEOUTS.ackTimeoutMs + 1);   // ⇒ RESYNC_REQUIRED=1（ns 级）

// P2 单帧超限：公共 egress 宿主直驱（ADR 决策 5 登记面）；同一 tryEmitDataFrame 守卫服务 session 路径
const connection = [...facade.host.connections.values()][0]!;
const returned = connection.egress.sendDataFrame(new Uint8Array(cap + 4096)); // = 0（静默）

// P3 收口后丢弃：扣留 session→edge → closeHubSide → 先送达 close → 再放行 ⇒ 0 盖章/0 回执/0 字节
// P5 不溯及：扣留 edgeToSession → 已推帧盖章 → revoke → 放行 ⇒ receipt 位先于 'terminateUnauthorized'
// P6 逃生舱：requestReauth → advanceBy(closeTimeoutMs-1) 不收口 → +2 ⇒ close(1001,'hub-reauth')
```
