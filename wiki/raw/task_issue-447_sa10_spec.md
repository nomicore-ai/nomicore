# task_issue-447 SA10 规范符合性终审 — γ-T1：公共异步会话工厂 + 异步 FIFO 管道夹具 + 首个跨缝协议回合

- Issue：#447（Parent = PR #446 `spec/445-gamma-async-seam`）
- 权威基线：`c86ccbcc98e01a95ded732f6a9ad06aa8828bc53`（origin/spec/445-gamma-async-seam，评审前已 fetch 稳定）
- 被审交付：HEAD `52e634b`（`feat(ws-replication): add gamma async session host`，基线之上恰 1 个 commit；`git log origin/spec/445-gamma-async-seam..HEAD` 核实）
- Issue 评论 REST 快照：**空**（无 Owner 追加要求；Owner 要求 = 简报正文 6 条 AC）
- 评审人：SA10（独立 spec 审查；只判实现是否忠实满足 Issue 正文/Owner 评论/验收契约/规范；不审通用架构风格（SA9 域），不运行测试，不修改任何文件；本文件为唯一写入产物）
- Verdict：**`approve`**（6/6 AC 达成且有可执行证据；无关键 AC partial/unmet/unachievable；10 项 MINOR 披露项见 §5，均不阻断）

---

## 1. 评审输入

| 输入 | 位置 | 状态 |
|---|---|---|
| Host 任务简报（Issue 正文 + AC×6，Comments 空） | `wiki/raw/task_issue-447.md` | 已读 |
| 规范权威：ADR 0032 附录 A4（A4.1–A4.8） | `docs/adr/0032-transport-decoupling-edge-session-split.md:55-99` | 已读原文 |
| 规范权威：协议 §24（§24.1–§24.8） | `docs/protocols/instance-replication-v1.md:1091-1154` | 已读原文 |
| SA6 验收契约（approve；PUB/SEAM/PIPE/PEND/ANCHOR/ROUND/TD 条目 + §15 未决登记） | `wiki/raw/task_issue-447_sa6_contract.md` | 已读 |
| 批准设计（修订版；SA2 二轮 approve、SA8 设计后 iteration 1 clear） | `wiki/raw/task_issue-447_design.md`、`task_issue-447_design_conflict_report.md` | 已读 |
| SA3 实现报告（5 项申报偏差） | `wiki/raw/task_issue-447_sa3_impl.md` | 已读 |
| SA4 实现静态审查（approve；N1–N8） | `wiki/raw/task_issue-447_sa4_review.md` | 已读 |
| SA8 实现后冲突报告（clear；22 项对照全落 no-conflict/implements-existing-decision） | `wiki/raw/task_issue-447_implementation_conflict_report.md` | 已读 |
| 实现源码 | `src/{hub-session-async-host(新),index,hub-split,hub-session,hub-namespace,round-engine,types,update-channel,bulk-transfer}.ts` 全 diff（c86ccbc..52e634b） | 逐 diff 独立核对 |
| 测试与夹具 | `test/issue447-async-seam.ts`（889 行）+ 4 个新测试文件 + 418 契约测试 diff | 关键断言逐段核对 |
| 验证证据 | `artifacts/sa3-issue447-{gamma-suites,package-suite-and-typecheck}.log`、`artifacts/sa6-issue447-*.log` | 已读（SA10 不运行测试，采信留档日志并做 git/grep 级独立复核） |

独立复核动作（本席亲测，非转述）：`git diff --stat c86ccbc..HEAD` 对全部 DENY 面文件为空；`grep -rEn "worker_threads|MessageChannel|MessagePort" packages/ws-replication/src/ package.json` 零命中；`git rev-parse origin/spec/445-gamma-async-seam` === 权威基线。

## 2. AC 逐条判定（简报 6 条 = 唯一 Owner 要求）

| AC | 判定 | 证据（独立核对要点） |
|---|---|---|
| **AC1** 新 γ 公共工厂/句柄面导出（append-only）；β 冻结签名与行为逐字不动（既有 issue420 矩阵全绿） | **MET** | `src/index.ts:7-9` 值导出 `createHubAsyncSessionHost`（15→16）+ `:103-110` 五类型，既有名零改名零删除；`hub-session-host.ts` 零改动（git diff 空）；PUB-C1 运行期断言（16 值导出逐名 typeof）；TD-C2 β 面逐字类型锁定；包全量 94 files/855 tests 绿（含 420 族；SA3 日志） |
| **AC2** 缝消息词汇落地（7 消息闭集合；无拒纳/闸门/信用词汇） | **MET** | 生产面：`HubAsyncSessionFrame{tag,bytes,lane}` / `HubAsyncSessionReceipt{tag,sequence}`（键集恰二键）/ 句柄方法承载 `close`/`terminateUnauthorized` / `onSignal` 承载 `settled`/`connection-fatal` / `handleFrame` 承载入站 `frame{bytes}`；SEAM-C1 闭集合断言 + 集合外词汇（sent/deferred/rejected/credit/gate/paused）负控可执行红；SEAM-C3 receipt 键集恰 `{tag,sequence}` + 判别键注入负控。注：γ port 的 `dataGateOpen: () => true` 是既有内部 port 面的 dormant 实现（A3/A4.3），非缝消息词汇 |
| **AC3** session 控制面 pending 两相记账；`bootstrapSnapshotSeq` 三态；BOOTSTRAP_ACK 到达时锚已回填（保序结构性保证，非 park） | **MET** | `types.ts` 新增 `SendAnchorState`（pending/stamped）；`hub-namespace.ts:134` 锚载体三态化，判别语义逐字保持（idle ∨ pending ∨ 不等 ⇒ `ACK_STATE_VIOLATION`，禁 park）；`update-channel.ts` `pendingSends` 独立 tag 键空间计入 `effectiveInFlightCount`、回执 `onReceipt` 换键不换槽；保序结构性保证 = 桥在 egress 盖章返回值**同一同步段**投回执 + 同通道 FIFO（`issue447-async-seam.ts:499-502`）；ANCHOR-C1（ACK 回指 + 复位后 unsolicited ACK 响亮）/ANCHOR-C2（扣回执 + 直投 ACK ⇒ `connection-fatal{ACK_STATE_VIOLATION}` + ERROR + close 1002，零 park）实测绿 |
| **AC4** 延迟可注入异步 FIFO 管道夹具（每会话一对通道；FIFO/不丢/不重；零 worker_threads） | **MET** | `test/issue447-async-seam.ts`：`FifoSeamChannel`（enqueue 零投递 / `release(n)` 确定投递 / pending/delivered 断言面）+ `SeamHub` 每 (connectionKey, namespaceId) 一对 + `reorderNext`/`dropReceipts`/`withholdEdgeToSession` 旋钮；PIPE-C1（序=入队序、恰一次、零串道、reorder 变异红）/PIPE-C2（不释放零投递、投递数=释放步函数、零真实 timer）/PIPE-C3（结构门零命中——本席 grep 独立重申）；夹具头注登记「零协议决策」纪律（只中继/搬运） |
| **AC5** OPEN→bootstrap→close 回合与 β wire 逐字节等价（复用 issue424 cross-seam 断言族） | **MET**（一处手段层 MINOR 偏差，见 §5-3） | ROUND-C1（单帧 + 协商位两形态；骨架 = SA6 §13 golden trace 7 帧）；ROUND-C2 单帧构型**逐字复用** #424 原族（`framesHexEqual`/`skeletonOf`/`docStateOf` + NC-1 内容变异负控 + peer `random:()=>0.5` 钉死）；ROUND-C3 receipt↔wire `[8..12]` 配对 + 全连接严格递增；分块构型 parity 走能力感知等价物 + β 单体参照（偏差 3/4，已裁决）；CHUNK-C1/C2 真实 kind=1/kind=2 改道（小限额注入）含 ANCHOR-C1 全量断言 |
| **AC6** 新公共面 test-d 快照（按 issue420 `api.test-d` 先例） | **MET** | `ws-replication-issue447-async-session-api.test-d.ts`（193 行）：TD-C1 工厂签型/句柄六成员/两消息键集逐项 `toEqualTypeOf` 锁定 + 8 条 `@ts-expect-error` 负控（≥3 要求）；TD-C2 β 15 值导出 + 4 类型逐字不变；双面门（包 tsc exit 0 + vitest typecheck 新文件零错误；SA3 日志） |

**结论：无关键 AC partial/unmet/unachievable。**

## 3. 规范符合性核对（ADR 0032 A4 / 协议 §24，逐条独立核码）

| 规范条款 | 实现落点 | 判定 |
|---|---|---|
| §24.1 每 (connectionKey, namespaceId) 一对专用通道；缝只过 `Uint8Array`+纯 JSON；零 worker_threads/MessageChannel 依赖或类型 | 夹具 `SeamHub` 通道对；生产面类型仅 `number/Uint8Array/string` 键；grep 零命中（本席重申） | 符合 |
| §24.2.2 FIFO 不丢不重不乱序 | `FifoSeamChannel` 显式 release；PIPE-C1/C2 | 符合（夹具即宿主传输义务的测试兑现） |
| §24.2.3 回执条款（盖章点同步投回执、先于后续 socket 数据） | 桥 `sessionToEdge.onDeliver`：egress 返回值同一同步段 `edgeToSession.enqueue({tag,sequence})`（`issue447-async-seam.ts:488-507`）；`sequence ≤ 0` 不投 | 符合（生产 edge 零改动，回执生产属宿主——D3） |
| §24.2.4 tag 由 session 分配、会话域内单调唯一、纯 JSON | `emitSeam`：`++tagCounter` 自 1 严格递增；未决集一次性消费（`hub-session-async-host.ts:256-264`） | 符合 |
| §24.2.6 违契响亮收口、零静默降级 | `handleReceipt`：非法 sequence / 未知或重复 tag ⇒ `connection-fatal{CONNECTION_POLICY_VIOLATION}`（既有码复用，映射单点留 edge）；PUB-C3 跨缝实测连接级 ERROR + 不 live | 符合 |
| §24.3 七消息闭集合；无拒纳/闸门/信用；receipt 非接纳信号（A4.6） | 生产 + 夹具消息联合恰为闭集合；回执消费面恰 = rekey/锚回填/既定 drain 触发，无发送决策路径；SEAM-C1/C3 | 符合 |
| §24.4 两相记账：pending 自推送占窗；tag→seq 换键不换槽；三态锚；ackTimeout 与单体内核同构 | `pendingSends` 计入 `effectiveInFlightCount`；`onReceipt` delete+set 不触碰计时器；`hasUnsettledSends() = inFlight + pendingSends` 统一计时器回调与 `onAck` 拆除判据（α/β 恒空退化）；PEND-C1/C2/C3（含判据变异负控红） | 符合 |
| §24.5 流控单点 edge；session 乐观发送；无逐帧拒纳 | γ port `dataGateOpen:()=>true`/`bufferedAmount:()=>undefined`（dormant，共享闸门代码零改动）；egress ≤0 不投回执，pending 占窗由 ackTimeout 有界兜底 | 符合 |
| §24.6 pacing：自驱 drain 三触发点；推完即停；不保持轮转公平 | `selfDrain`：① `onDataQueued`/`requestDataDrain` ② 每条入站缝消息消费后 ③ 末 chunk 回执结算后；`while (pullAndSendOne())` 至 false | 符合 |
| §24.7 生命周期单规则 | `close()` 幂等 + 未决 tag 整体冲刷 + 通道 quiesce；迟到 receipt/frame 终态静默；`terminateUnauthorized` 不溯及 | 符合 |
| §24.8 观测口径：`ackLatencyMs` t0 = 推送时刻 | `bulk-transfer.ts` γ 分支推送边界采样 `pushedAt` → `pendingLastChunkTag` 携带 → `onLastChunkSent` append-only 第三参回传 → `hub-namespace.ts` 两写点 `pushedAt ?? sampleAckT0()`；α/β 缺省逐字节不变；CHUNK-C3 断言 `k+m` + 变异负控（不携 ⇒ 退化为 m）红 | 符合（SA8-E1 路线 a 代码闭合） |
| A4.8 验收纪律：wire 与 β 逐字节等价；既有矩阵全绿硬门 | ROUND-C2 两构型 parity；855/855 绿 + 包/根 tsc exit 0 | 符合 |

**冻结面独立核实（git diff c86ccbc..HEAD 为空）**：`hub-session-host.ts`（β 冻结工厂）、`hub-edge.ts`/`hub-edge-host.ts`/`frame-io.ts`/`backpressure.ts`/`hub-upgrade-admission.ts`、`hub-connection.ts`/`plugin.ts`、`peer-connection.ts`/`peer-namespace.ts`、`src/testing.ts`、`docs/**`、`CONTEXT.md`、其余包/域/应用/根配置——全部零改动。规范文本零改动正确（SA8-E1 经路线 a 按登记口径实现，无需 amendment）。

## 4. Owner 评论映射

Issue 评论 REST 快照为空（dispatch 明示 + 简报 `## Comments` 空）——无 Owner 追加要求可映射。Owner 要求 = 简报正文 6 条 AC，全部 MET（§2）。

## 5. PR 必须披露的未达成/偏差项（全部 MINOR，不阻断 approve）

| # | 项 | 性质与处置状态 |
|---|---|---|
| 1 | **418 契约测试 `FROZEN_PRODUCTION_EXPORTS` 冻结表 3 行排序插入**（`'createHubAsyncSessionHost'` + 出处注释）越设计 ALLOW 字面 | SA3 Deviation-1 已申报；PUB-C1（16 值导出）与该表 `toEqual` 全等断言机械互斥，无第三解；断言语义零弱化（仍全等真实导出集）；#422 §12.8 同表先例；SA4-N1 与 SA8 §3-#16 均裁可接受；**待 SA1/总控在设计记录追认 ALLOW 扩张**（SA8-R1，记录动作） |
| 2 | **`abandonedTags` zombie 序登记**（`update-channel.ts`）为设计文本外的实现级补全 | SA3 Deviation-2 已申报；无它则 γ 下被弃 pending 条目的迟到 `UPDATE_ACK` 落 `ACK_STATE_VIOLATION` 杀死恢复期连接，与设计 §9.1「迟到回执良性 no-op」及 §23.1:751 zombie 纪律直接冲突；实现使声明语义逐值成立；α/β 无回执调用面零行为变化；SA4-N2/SA8 §3-#17 裁 implements-existing-decision；建议设计文本回填（design 路由，登记性质） |
| 3 | **AC5 手段层偏差**：分块构型 parity 未逐字复用 #424 断言族——该族无协商位解码遇 `UPDATE_CHUNK` 响亮拒绝、`makeShardedReplicationFacade` 硬编码 `LIMITS` 不可小限额改道（SA4 实测复核属实）；分块构型改用同判据能力感知等价物（`wireControlFrames`/`wireSkeleton`/`wireDocState`，按 `transferId` 重组）+ β **单体**同限额参照 | SA3 Deviations-3/4 已申报；单帧构型逐字复用 #424 原族（AC 字面满足）且两套判据在单帧构型同结论互证；SA4-N3 MINOR、SA8 §3-#18 no-conflict |
| 4 | γ `UpdateChannel.sendOneChunk` async 分支（kind=0 分块 live update）无专用可执行 γ 场景 | SA4-N4；机械与已覆盖路径（单帧 PEND 族 + β kind=0 301 族）同构共享；列入后续动态验证项 |
| 5 | `HubNamespaceChannel.bootstrapAnchorPending` 只读访问器无任何消费者（包内不导出） | SA4-N5；设计未要求；建议删除或接入断言（一行级） |
| 6 | 设计列举的两条变异（ANCHOR-C1 park 化、CHUNK-C1 末 chunk 结算变异）未落成显式变异测试 | SA4-N6；敏感性由有界 `pumpUntil`（停摆即 throw）+ ANCHOR-C2/CHUNK-C2 响亮断言（同一判别机械）结构性保证 |
| 7 | γ `emitSeam` 未注册 sink ⇒ 返回 0 且零登记路径无专行断言 | SA4-N7（SA2-O2 沿革）；后续一行级补断言 |
| 8 | ROUND-C3 对 `close`/`connection-fatal` 缝消息生命周期次数未逐条断言（SA6 契约 ROUND-C3 子句部分覆盖） | SA4-N8；`settled` 恰一次已断言；两信号在 PUB-C3/ANCHOR-C2 场景各断言恰一次 |
| 9 | （本席新发现，琐碎）`ws-replication-issue447-async-session-round.test.ts:550` 注释引用「`issue447-async-seam.ts` 头注 9」，但夹具头注编号只到 8；能力感知等价物的说明实为 `:701` 起的独立 doc 块 | 注释交叉引用陈旧，零行为影响；建议后续顺手修正 |
| 10 | 已登记 follow-up（设计 §13/SA3 Deferred，明示不在本票 scope）：β 工厂形态 facet dormant（R5）、γ `sessions` Map 无终态移除（R10，β 同形）、回执序单调加固（R11）、CONTEXT.md γ 段厂名登记（可选，CONTEXT.md 属 DENY 未做）、既有 421 test-d vitest typecheck 4 条红（B1，HEAD 既有、SA6 §9-E5 已归因、另票） | 登记在案，不属本票 AC；PR 披露其「另票/follow-up」状态即可 |

## 6. 范围蔓延核对

无 scope creep：生产/测试 diff 全在设计 ALLOW 15 行内 + 唯一越 ALLOW 项（§5-1，已裁决）；无未申报的新公共面、新错误码、新事件型、新 wire 面；peer 侧零改动；规范文本零改动；commit 内 `wiki/raw/*` 为流程产物（与本仓先例一致）；证据日志 untracked 未提交。

## 7. 结论

**`approve`**。简报 6 条 AC 全部达成且每条有可执行行为断言背书（30 新测试 + test-d 全绿，包全量 855 测试 + 双 tsc exit 0 留档）；ADR 0032 A4 与协议 §24 全部承重条款（保序、两相记账、三态锚、流控单点、无拒纳词汇、生命周期、t0 口径）逐条核码符合；冻结面与 DENY 面经本席 git/grep 独立复核零回退。§5 十项全部为 MINOR 级披露项（已申报偏差 4 项 + SA4 观察 5 项 + 本席琐碎注释发现 1 项 + 登记 follow-up 1 组），无一项构成关键 AC 的 partial/unmet/unachievable。

---

- 本报告为纯 spec 符合性审查：未运行测试/服务（绿灯证据 = SA3 留档日志 + SA4 时间戳/计数一致性核验 + 本席 git/grep 级独立复核）；未修改任何实现、设计、测试或规范文件；未 commit/push/PR/finalize；唯一写入产物 = 本文件。
