# task_issue-447 SA4 实现静态审查 — γ-T1：公共异步会话工厂 + 异步 FIFO 管道夹具 + 首个跨缝协议回合

- Issue：#447（Parent = PR #446）；实现基线 HEAD `c86ccbc`；审查对象 = SA3 工作区 diff（9 个 tracked 修改 + 6 个新文件）
- 评审人：SA4（实现静态审查；不运行测试/服务、不修改实现/设计/测试；本文件为唯一写入产物）
- Verdict：**`approve`**（无 BLOCKER / 无 MAJOR；8 条非阻断观察 N1–N8、6 项后续动态验证项；见 §10/§11/§12）
- `requiresConflictRecheck = false`（本轮未发现设计 §15 / SA8 §10 已申报集合之外的新 ADR 冲突风险；实现按已登记读法落地）

---

## 1. Reviewed inputs

| 输入 | 位置 | 状态 |
|---|---|---|
| Host 任务简报 | `wiki/raw/task_issue-447.md` | 已读（AC 6 条；`## Comments` 空，dispatch 明示无 owner requirements） |
| 批准设计（修订版 668 行） | `wiki/raw/task_issue-447_design.md` | 已读全文（§7-D1–D12、§8.1–§8.10、§11 ALLOW/DENY、§12 验收映射、§14 修订映射、§15） |
| SA2 设计评审 | `wiki/raw/task_issue-447_sa2_review.md` | 已读（verdict `approve`；F1/F2 闭合核验 §5a/§12a；O1–O7 处置） |
| SA8 设计后冲突报告 | `wiki/raw/task_issue-447_design_conflict_report.md` | 已读（iteration 1 verdict `clear`；22 项对照；R1–R5 实现期复核义务） |
| SA6 诊断与验收契约 | `wiki/raw/task_issue-447_sa6_contract.md` | 已读（§12 条目 PUB/SEAM/PIPE/PEND/ANCHOR/ROUND/TD；§12.0 纪律；§13 golden trace；§14 runner 证据） |
| SA3 实现报告 | `wiki/raw/task_issue-447_sa3_impl.md` | 已读（Changed paths / SA2 落实 / Verification / Deviations 1–5） |
| 规范权威 | `docs/adr/0032-*.md`（A4）、`docs/protocols/instance-replication-v1.md`（§24）、`CONTEXT.md:229-241` | 经设计与 SA6/SA8 报告锚点复核（本轮零文本改动，`git diff` 证实） |
| 实现源码（逐行） | `src/{hub-session-async-host(index 新建),hub-split,hub-session,hub-namespace,round-engine,types,update-channel,bulk-transfer}.ts` 全 diff + `test/{issue447-async-seam,4 个 test 文件}` 全文 | 已读全文并逐点核对（证据见 §4–§9 各表） |
| β 冻结面与既有夹具 | `src/hub-session-host.ts`、`test/{driver,harness,issue424-sharded-hub,issue420-shim-hub}.ts` | `git status` 零改动证实；关键段（deliverFrame/handleFrame 分派/egress 返回值/LIMITS 硬编码）逐点比对 |
| 验证证据 | `artifacts/sa3-issue447-{gamma-suites,package-suite-and-typecheck}.log` | 已读；日志时间戳（15:13:30/15:15:39）晚于全部源码/测试文件 mtime（最晚 15:13:00）——**绿灯证据对应磁盘当前态**，测试计数 15+7+8=30 与文件一致 |

缺失输入：`task_issue-447_relevant_decisions.md` / `_conflict_report.md`（前置门禁产物）不存在——设计与 SA2/SA8 均已声明，决策集以 SA8 报告 §2 盘点 + SA6 §3 硬约束补位；不构成审查阻断。

## 2. Verdict

**`approve`**。核验结论：

- **上游要求（简报 6 条 AC）全部落实**且有可执行断言背书（§3）；
- **设计决策 D1–D12 逐项落位**，包括 SA2-F1 的 §8.6.1 合并占用判据（源码逐点核对：产生/消灭/拆除三面全部计入 `pendingSends`，α/β 谓词逐值退化）、SA2-F2 的真实分块硬门（CHUNK-C1/C2/C3 + 两条变异负控）、SA8-E1 的 `pushedAt` 推送边界采样（两写点 `pushedAt ?? sampleAckT0()`）、SA8-E2 的 AGENTS.md append-only 登记句（同变更集落盘）；
- **文件范围**：ALLOW 15 行逐行吻合、DENY 全部零触碰（`git status` + 逐文件 `git diff` 证实）；唯一越 ALLOW 项 = 418 冻结表 3 行插入（SA3 Deviation-1）——经独立核查为 **ALLOW 行 2（index.ts append-only 导出）授予面的机械牵连**（PUB-C1 的 16 值导出与该表 `toEqual` 全等断言在字面上互斥），本表内 #422「一次性授权编辑」先例 + `task_issue-254` SA4 判例（N6：机械牵连完成 ≠ 范围越界）均成立，零断言弱化、透明申报 → 判可接受偏离（N1，非阻断）；
- **4 项申报偏差**（SA3 Deviations 1–4）逐项独立核查：#1 可接受（上述）；#2 `abandonedTags` 是使设计 §8.6.1「被弃 tag 迟到回执 = zombie 同构」在 γ 下**逐值成立**的必要补全（没有它，PEND-C3 ② 场景中迟到的 `UPDATE_ACK` 会落 `onAck` 'violation' ⇒ 恢复期连接被良性 ACK 杀死——与设计 §9.1 直接冲突）；#3/#4 有 #424 夹具客观限制佐证（`issue424-sharded-hub.ts:607/:636/:661` 无协商位解码 + `:187 limits: LIMITS` 硬编码，本席实测复核）；
- **测试质量**：30 测试 + test-d 全绿证据与磁盘态一致；断言全部为运行期行为（wire 原字节/`[8..12]`/`ackedSequence` 回指/缝消息对象/窗口计数/单事件字段值）；两条变异负控真实可执行且恢复语义正确（`finally` 还原 + 根 `maxWorkers:1` 无并行干扰）；零 skip/only/todo（grep 证实）。

## 3. 上游要求落实

Issue 评论 REST 快照为空（简报 `## Comments` 空；dispatch 明示）——无评论 id/updated_at 可映射。Owner 要求 = 简报正文 6 条 AC：

| Requirement or finding（简报 AC） | Implementation evidence | Assessment |
|---|---|---|
| AC1 新 γ 公共工厂/句柄面导出（append-only）；β 冻结签名与行为逐字不动（既有 issue420 矩阵全绿） | `src/index.ts:7-9`（值导出 15→16）+ `:102-108`（5 类型）；`hub-session-host.ts` 零改动（`git status`）；PUB-C1（api.test.ts：16 值导出逐名 typeof）+ PUB-C2（包全量 94 files/855 tests 绿 + 包/根 tsc exit 0，日志证实）+ TD-C2（test-d β 面逐字锁定） | 落实。`hub-session-host.ts`/`hub-edge*.ts`/`frame-io.ts`/`backpressure.ts`/`hub-connection.ts`/`plugin.ts`/`peer-*.ts`/`src/testing.ts` 全部零改动（逐文件 diff 核实） |
| AC2 缝消息词汇落地（7 消息闭集合，无拒纳/闸门/信用词汇） | `hub-session-async-host.ts:47-64`（`HubAsyncSessionFrame{tag,bytes,lane}` / `HubAsyncSessionReceipt{tag,sequence}`）；SEAM-C1（闭集合 + lane 判别 + 集合外词汇负控）、SEAM-C3（receipt 键集恰 `{tag,sequence}` + 注入判别键负控） | 落实。词汇名单点提取（`messageNameOf`）非夹具自记字段 |
| AC3 session 侧第三种 port 形态 + pending 两相记账（控制面先行）；`bootstrapSnapshotSeq` 三态；BOOTSTRAP_ACK 到达时锚已回填（保序结构性保证，非 park） | γ adapterPort（`hub-session-async-host.ts:206-243`，17 成员逐项与 β `:175-209` 比对仅差 `onDataQueued/requestDataDrain → selfDrain` 与 `handleReceipt` 面）；`SendAnchorState` 三态（types.ts）+ 三锚写点/判别/回填（hub-namespace/round-engine）；`pendingSends` 两相记账 + §8.6.1（update-channel）；PEND-C1/C2/C3 + ANCHOR-C1/C2 + ROUND-C1 | 落实。pending-at-ACK = 响亮违例（`hub-namespace.ts:694-702` anchor 判别、`round-engine.ts:211-215/227-231` `anchorSequenceOf` 判别），零 park/等待/缓冲 |
| AC4 延迟可注入异步 FIFO 管道夹具（每会话一对通道；FIFO/不丢/不重；零 worker_threads；夹具零协议决策） | `test/issue447-async-seam.ts`（`FifoSeamChannel`：enqueue 零投递/release(n) 确定性/pending/delivered；`SeamHub` 每键一对；`reorderNext/dropReceipts/withholdEdgeToSession` 旋钮）；PIPE-C1/C2/C3（含 420 结构门重申）；`src/hub-session-async-host.ts` 零跨线程 token（grep 0 命中） | 落实。桥只做字节/JSON 中继与信号搬运，回执条款在 egress 返回值同一同步段入队（`issue447-async-seam.ts:488-507`），零协议决策 |
| AC5 OPEN→bootstrap→close 回合与 β wire 逐字节等价（复用 issue424 断言族） | ROUND-C1（单帧 + CAP 两种协商位形态）、ROUND-C2（单帧：#424 原族 `framesHexEqual/skeletonOf/docStateOf` + NC-1 内容变异负控 + peer `random:()=>0.5` 钉死）、ROUND-C3（receipt↔`[8..12]` 配对 + 序严格递增）；骨架 = SA6 §13 golden trace 7 帧（日志证实） | 落实。分块构型 parity 经能力感知等价物 + β 单体参照（偏差 #3/#4，见 §12-N3）——#424 原族字面复用仅在单帧构型成立（客观限制已核） |
| AC6 新公共面 test-d 快照（#420 先例） | `ws-replication-issue447-async-session-api.test-d.ts`：TD-C1（工厂签型/句柄六成员/两消息键集/监听者双参型）+ 8 条 `@ts-expect-error` 负控 + TD-C2（β 15 值导出 + 4 类型逐字不变）；vitest typecheck 面 0 错误 + 包/根 tsc exit 0（日志） | 落实。双面门达成；既有 421 test-d vitest 面 4 红按 B1 归因另票（SA6 §15-B1），不据此判 #447 |

SA2 F1/F2、SA8 E1/E2/E3、SA2-O1–O7 的落实核对并入 §4 设计落实审查（逐行见 SA3 报告「SA2 Finding 落实」表——本席对 F1/E1/E2/E3/O3/O4/O7 做了源码级复核，全部属实）。

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| D1 γ 独立新工厂/句柄（复用 β 纯 JSON 类型） | `hub-session-async-host.ts:87-116/296-324`；配置复用 `HubSessionHostConfig`、描述子 `HubSessionOpenInput`、信号 `HubSessionSignal` | 落实；β 文件零改动；`open()` 守卫（空 connectionKey / 重复键响亮 throw）与 β `:243-257` 同形 | — |
| D2 tag 句柄域自 1 单调；分配/校验单点归 port 层 | `emitSeam`（`:256-264`：`++tagCounter`、未决集登记、throw 原样传播、未注册 sink ⇒ 0 且零登记）；`handleReceipt` 域校验（`:161-177`：closed 门 → sequence ∈ [1,0xffffffff] 整数 → 未决集命中，未知/重复 ⇒ `CONNECTION_POLICY_VIOLATION` 响亮） | 落实；与设计 §8.3 伪码逐行同构；SEAM-C2/PUB-C3 断言背书 | — |
| D3 回执生产点 = 宿主桥消费 egress 返回值；edge 生产代码零改动 | 桥 `issue447-async-seam.ts:488-507`（盖章返回值同一同步段 enqueue receipt；≤0 不投）；edge/frame-io `git diff` 空 | 落实；§24.2.3 保序条款经「同段入队 + 同通道 FIFO」兑现 | — |
| D4 异步性 = bit + 三态锚 + 独立 tag 键空间 | `asyncSendTickets` 单点设置（γ 工厂 `:114`）→ sink 组装层（hub-session.ts:85-86）→ 三子宿主（hub-namespace.ts:219/260/285 条件展开）；`pendingSends` 独立键空间（update-channel.ts:135-138）；`SendAnchorState`（types.ts:1034-1038） | 落实；α/β 缺省 ⇒ 新分支全死（三处条件展开均 `=== true` 判别，包 855 绿背书） | — |
| D5 流控 dormant 面 | γ port `dataGateOpen:()=>true`、`bufferedAmount:()=>undefined`、`connectionState` 本地两态投影（`:219/238-239`） | 落实；与 β 工厂 port `:186/205-206` 逐字同形 | — |
| D6 selfDrain 三触发点 | ① `onDataQueued/requestDataDrain → selfDrain`（`:221-222`）；② `handleFrame` 分派返回后（`:152`）；③ 末 chunk 回执结算后（`:176`）；循环 `pullAndSendOne()` 至 false（`:271-277`） | 落实；②为「ACK 到达」保守超集，幂等 no-op；无 busy loop | — |
| D7 pending-at-ACK 响亮违例（非 park） | bootstrap 单帧锚判别（hub-namespace.ts:694-702）+ round 锚判别（round-engine.ts:211-215/227-231 `anchorSequenceOf`）+ ANCHOR-C1 收尾（unsolicited ACK 响亮）/ANCHOR-C2（扣回执 + ACK ⇒ fatal 1002）测试 | 落实；判别机械与 β 同一套（idle ∨ pending ∨ 不等 ⇒ 违例） | — |
| D8 夹具显式 release + 故障旋钮 | `FifoSeamChannel`（enqueue 零投递/release(count?)/pending/delivered/dropped）+ `reorderNext`（下次 release 交换前两条）+ `dropReceipts(n)` + `withholdEdgeToSession`（setHeld）；`pumpUntil`（有界 40 轮 × 显式释放 + 微任务冲刷，未达谓词 throw）/`pumpSteps` | 落实；零真实 timer/wall-clock；PIPE-C1/C2 断言投递序 = 入队序、计数守恒、零串道 | — |
| D9 t0 = 推送时刻（SA8-E1 路线 a） | `bulk-transfer.ts:202-205`（推送调用边界采样，仅 γ 分支，β 零新增时钟读）+ `:119-121/239-243`（`pendingLastChunkTag{tag,pushedAt}`）+ `onLastChunkSent` append-only 第三参（`:68-77`）；`hub-namespace.ts:628/:840` 两写点 `pushedAt ?? sampleAckT0()`；α/β 缺省 ⇒ 原调用点/取值逐字节不变（β 分支代码原样，301 族在 855 内绿） | 落实；CHUNK-C3 断言 `ackLatencyMs === k+m` + 变异负控（不携 pushedAt ⇒ 退化为 m）证明携带承重；tag 不入任何公共事件键集（`onUpdateSent` 普通帧早退 hub-namespace.ts:1462、chunked 键集仅 transferId/chunkCount/totalBytes） | — |
| D10 ackTimeout 合并占用判据（SA2-F1） | `hasUnsettledSends() = inFlight.size + pendingSends.size > 0`（update-channel.ts:186-188，不 γ 门控）；`armAckTimer` 回调判据（`:719`）；`onAck` 拆除判据（`:295`，wasOldest 重锚原子原样 `:297-301`）；`abandonInFlight` 清 pending（`:680-681`） | 落实；产生点封闭（`sendAndRegister:450-461`/`sendOneChunk:585-598` 均 set 后 arm）、消灭点三处均在合并归零/清空后拆——「占用非零而计时器已拆」中间态结构性排除；α/β 谓词逐值退化（pendingSends 无条件字段恒空）；PEND-C3 ①②③④ 全绿（含变异负控） | — |
| D11 真实分块覆盖 = 小限额注入（SA2-F2） | CHUNK-C1（`maxBootstrapBytes:8/maxChunkedBootstrapBytes:1024/maxUpdateBytes:64` ⇒ 快照 431B 真实 kind=1 改道：`BOOTSTRAP_SNAPSHOT` 0 条 + `UPDATE_CHUNK` ≥2（日志 7）+ ACK 回指末 chunk 帧序）；CHUNK-C2（`maxSyncDiffBytes:1/…:4096` ⇒ 双侧 kind=2 + `SYNC_APPLIED` 回指对端末 chunk）；构型链满足 `validate.ts`（4096 ≤ 64×64） | 落实；「假分块」（仅切 CAP 位）会因 `BOOTSTRAP_SNAPSHOT 单帧 0 条` 判据必红 | — |
| D12 模块契约 append-only 登记（SA8-E2） | `packages/ws-replication/AGENTS.md:17`：既有枚举句逐字保留 + 句尾追加 γ 缝词汇句（`frame{tag,bytes,lane}` / `receipt{tag,sequence}`；引 A4/§24；无拒纳/闸门/信用；β 冻结面逐字不动） | 落实；与 γ 代码同变更集（同一 diff）；冻结面零触碰 | — |
| §8.9 回合数据流（单帧 + 分块） | ROUND-C1 断言族（OPEN_OK×1 / bootstrap 载荷恰一组 / ACK 回指 / SYNC 三段 / live / 文档收敛 hex 全等 / CLOSE_OK 回指 / settled 恰一次经缝）；分块形态同族（assertRoundC1 chunked 分支） | 落实；骨架与 SA6 §13 golden trace 逐帧一致（日志） | — |
| §9.1 违例/超时矩阵（7 行） | 逐行核对：伪序/未知 tag（PUB-C3 ✓）、ANCHOR-C2（✓）、数据面 ACK violation（既有 onAck 'violation' 机械保持 ✓）、缝扣留（PEND-C3 ✓）、egress ≤0 不投回执（桥 `:503-506` + `unsealed` 探针 ✓）、kind=2 自持 timer 角落（CHUNK-C2 负控 ✓）、不可解码帧（decode catch → MALFORMED_FRAME 族，β 同款 ✓） | 落实 | — |
| §9.2 生命周期（A4.5） | `close()`：closed 置位 → `unresolvedTags.clear()` → `sink.close()`（幂等同 promise，PUB-C3 断言）；迟到回执/帧终态静默（`:121/:162` 双门）；`terminateUnauthorized` 不清未决集（不溯及已推帧）；`teardown` 清 pending+abandonedTags | 落实 | — |
| §10 调用方矩阵 | `createHubSessionSink` 生产 2 调用点 + 测试调用点零改动（git 证实）；`HubSessionSink.onReceipt?` 可选方法（α/β 实现不定义不受影响）；peer 侧 `ownStep*Seq` 消费点全在 round-engine（grep 证实 peer-namespace 零命中）；edge 零改动 | 落实 | — |

设计明确但实现缺失：未发现。实现必要偏离设计：4 项（= SA3 Deviations 1–4，处置评估见 §6/§12）。

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| tag 分配/校验/未决集 | γ session 侧（§24.2.4） | γ port 单点（emitSeam/handleReceipt） | 正确 |
| wire 序盖章 | edge mux 单点 | 零改动（frame-io `emitOne`） | 正确 |
| 回执生产 | 宿主传输义务（§24.1/§24.2.3） | test-only 桥样例（egress 返回值同段） | 正确（生产零侵入） |
| pending 记账/窗口/ackTimeout | `UpdateChannel`（事实所有者） | §8.6/§8.6.1 全在通道内，单份实现、不 γ 门控分支化 | 正确（无第二 watchdog/计时器） |
| 三锚 | channel/engine/transfer 载体内部 | append-only 载体扩展 + γ 门控写点 | 正确（A4.1 张力按 SA8-E3 裁决读法执行，判别语义逐字保持） |
| 流控/pacing | edge 单点 / session 自驱 | D5 dormant / D6 selfDrain | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| β 公共工厂/句柄 | `hub-session-host.ts` | γ 镜像 + 回执面 + selfDrain | 一致 | port 17 成员逐项比对（`hub-session-host.ts:175-209` vs `hub-session-async-host.ts:206-243`）：仅 `onDataQueued/requestDataDrain`（β no-op → γ selfDrain，D6 授权）与出站返回值语义为 γ 差量；`handleFrame` 分派 switch 逐 case 同构（多 closed 门，A4.5 防御面） |
| 宿主桥/facade | #424 `makeShardedReplicationFacade`（`boot({createHub})` 注入） | `makeAsyncReplicationFacade` 同一集成点、SD-2(a)/SD-3/registry 采纳同纪律 | 一致 | 头注 1–8 镜像 #424 §8.1–§8.3 纪律；ROUND 前提断言 registry 同一性 |
| test-d 快照 | #420/#421/#422 `*.test-d.ts` | 双面门 + 负控 | 一致 | |
| 内存管道 | `src/testing.ts` 单次 queueMicrotask | 显式 release 通道对（test-only） | 一致（有意分叉已声明） | 简报明示 test-only；DENY `src/testing.ts` 保持 |
| 小限额分块构型 | #256/#300/#301 | 同构注入（`boot({limits})` 双侧，driver.ts:522/:550） | 一致 | |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| wire 序 | edge mux 盖章 | receipt（事实回传） | 无 |
| tag | γ port 计数器 | — | 无 |
| 窗口占用 | `effectiveInFlightCount()`（pending 计入，唯一口径） | `takeItems` avail 裸口径（例外注记 O3 保持，仅合并宽度） | 低 |
| 锚 | channel/engine/transfer 载体 | `bootstrapAnchorPending` 只读投影（未使用，见 N5） | 无 |
| ackTimer 武装状态 | `ackTimerArmed` 单字段 | — | 无 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| `open()`（重复键响亮 throw） | `close()`（幂等同 promise；unresolvedTags 冲刷 + 通道 quiesce） | 迟到回执/帧终态静默；`closeTimeoutMs` 逃生舱不动 | 对称 |
| `onFrame`/`onSignal` 注册 | 退订函数（api.test 断言生效） | onFrame throw 原样传播 / onSignal 隔离（β 镜像） | 对称 |
| 夹具 `enqueue` | `release`（显式） | 不释放 = 零投递（PIPE-C2） | 对称 |
| γ host `sessions` Map | 无终态移除 | — | β 同形（设计 §13-R10 follow-up 登记，不阻断） |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 第二 cleanup/重试循环 | 无 | 无（回执消费单点 + selfDrain 幂等 + 记忆化 resync 漏斗复用） | 无平行 |
| 第二状态机 | channel/engine 单份 | γ 门控分支 + 载体扩展，FSM 零分叉 | 无平行 |
| 第二计时器体系 | UpdateChannel/BulkTransferSender/bootstrap timer 三锚 | 判据统一而非新增计时器；`abandonedTags` 是 zombie 同构的键桥接（非第二账本——值仍单点登记进 `zombieSeqs`） | 无平行 |
| 仅服务单 Issue 的抽象 | 无过度泛化 | — | 无 |

## 6. 文件范围审查

`git status --porcelain` 全集核对（tracked 9 + untracked 新文件 6 + artifacts 证据 + wiki 上游产物）：

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `src/hub-session-async-host.ts`（新建） | ALLOW 行 1 | γ 公共面/第三 port 形态/tag/回执/selfDrain | 吻合（D1/D2/D3/D5/D6；头注引 A4 + §24 + #447） |
| `src/index.ts` | ALLOW 行 2 | append-only 1 值 + 5 类型（15→16） | 吻合（值导出计数实测 16；PUB-C1/TD 断言） |
| `src/hub-split.ts` | ALLOW 行 3 | `onReceipt?` + 返回值语义 doc 追加 | 吻合（纯 append，冻结签名零改） |
| `src/hub-session.ts` | ALLOW 行 4 | `asyncSendTickets?` + 透传 + `onReceipt` fan-out | 吻合 |
| `src/hub-namespace.ts` | ALLOW 行 5 | 三态锚 + onSendReceipt + 透传 + t0 写点 | 吻合（多出 `bootstrapAnchorPending` 只读访问器，包内不导出——见 N5） |
| `src/round-engine.ts` | ALLOW 行 6 | ownStep1/2 三态 + 回填 + host bit | 吻合 |
| `src/types.ts` | ALLOW 行 7 | `SendAnchorState` + 类型替换 | 吻合（内部类型不经 index 导出） |
| `src/update-channel.ts` | ALLOW 行 8 | pendingSends + onReceipt + 计入 + async 分支 + §8.6.1 + `abandonedTags` | 吻合（`abandonedTags` = Deviation-2，文件授予面内，见 N2） |
| `src/bulk-transfer.ts` | ALLOW 行 9 | `pendingLastChunkTag` + `onReceipt` + 第三参 + host bits | 吻合（#300 冻结锚 L195 兼容：尾参可省略） |
| `packages/ws-replication/AGENTS.md` | ALLOW 行 10 | D12 append-only 登记句 | 吻合（既有枚举句逐字保留——diff 逐字符核对） |
| `test/issue447-async-seam.ts`（新建） | ALLOW 行 11 | 夹具/桥/facade/旋钮/泵 | 吻合 |
| `test/ws-replication-issue447-async-session-api.test.ts`（新建） | ALLOW 行 12 | PUB-C1/C3、SEAM-C3 | 吻合 |
| `test/ws-replication-issue447-async-seam-fixture.test.ts`（新建） | ALLOW 行 13 | PIPE-C1/C2/C3、SEAM-C1/C2 | 吻合 |
| `test/ws-replication-issue447-async-session-round.test.ts`（新建） | ALLOW 行 14 | ROUND/ANCHOR/PEND/CHUNK | 吻合 |
| `test/ws-replication-issue447-async-session-api.test-d.ts`（新建） | ALLOW 行 15 | TD-C1/C2 | 吻合 |
| `test/ws-replication-issue418-edge-session-split-contract.test.ts` | **不在 ALLOW（既有测试族 DENY 面内）** | `FROZEN_PRODUCTION_EXPORTS` 表排序插入 `'createHubAsyncSessionHost'`（1 行 + 2 行出处注释） | **可接受机械牵连（N1）**：ALLOW 行 2 的 16 值导出与该表 `toEqual` 全等断言字面互斥（无第三解：不导出违反 AC1/PUB-C1；表不更新则 PUB-C2 硬门必红）；本表 #422 §12.8「一次性授权编辑」先例同形同注；零断言语义弱化（表仍与真实导出集全等——冻结快照表的**必要维护**）；`task_issue-254` SA4 判例（N6）对同类项已裁定「ALLOW 授予面的机械牵连完成，非范围越界」；SA3 透明申报并给出替代处置（SA1 补 ALLOW） |
| `artifacts/sa3-issue447-*.log`（2 份，untracked） | 证据日志（SA6 §13/§16 同约定） | 验证留档 | 惯例内 |

DENY 面核对（全部零改动，git diff 逐文件证实）：`hub-session-host.ts`、`hub-edge.ts`/`hub-edge-host.ts`/`frame-io.ts`/`backpressure.ts`/`hub-upgrade-admission.ts`、`hub-connection.ts`/`plugin.ts`、`peer-connection.ts`/`peer-namespace.ts`、`src/testing.ts`、`test/{driver,harness,issue420-shim-hub,issue424-sharded-hub}.ts` 与全部既有 `*.test{,d}.ts`（418 一处除外，见上）、`docs/adr/0032-*.md`、`docs/protocols/instance-replication-v1.md`、`CONTEXT.md`、其余包/域/应用/根配置。ALLOW 中未修改的路径：无（15 行全部命中）。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| `src/index.ts` 值导出 15→16 + 5 类型 | 宿主/测试 import 公共面；`apps/yjs-server`（唯一外部消费者，公共 API） | append-only；既有名零变化（PUB-C1 逐名 typeof + TD-C2） | 无 | — |
| `createHubSessionSink` 新可选 `asyncSendTickets` | 生产调用点 `hub-connection.ts`/`hub-session-host.ts` + 测试调用点（420-shim 等 5 处） | 全部不传 ⇒ 新分支全死（三处条件展开 `=== true` 判别）；包 855 绿 | 无 | — |
| `HubSessionSink.onReceipt?`（可选方法） | α splice/β HostSessionAdapter 实现者 | 不定义即不受影响；唯一调用点 = γ 句柄 `sink.onReceipt?.()` | 无 | — |
| `RoundState.ownStep1/2Seq` 类型替换 | peer 侧（peer-namespace 等） | grep 证实消费点全在 round-engine/types 两文件；peer 写点走 `anchorOf` stamped 分支（asyncSendTickets 缺省） | 无 | — |
| `bootstrapSnapshotSeq` 载体替换 | 仅 hub-namespace 内部（私有字段） | 写点/判别/复位三面改造 + `onSendReceipt` 回填；判别语义逐字保持 | 无 | — |
| `onLastChunkSent` append-only 第三参 | #300 冻结锚 `issue300-bulk-edge-ac.test.ts` L195（绑定 `number \| undefined`） | 尾参可省略，既有绑定不变（tsc 双面绿 + 301 族在 855 内绿） | 无 | — |
| `UpdateChannel` 计时器判据扩展 | α/β/peer 全部共享路径 | `pendingSends` 无条件字段恒空 ⇒ `hasUnsettledSends`/拆除判据/窗口口径逐值退化为既有判据；PEND-C3-③ 变异负控证明判据真实接入；825 基线 + 30 新测全绿 | 无 | — |
| edge 公共面（egress 返回值/盖章） | 宿主桥（新消费者） | egress 返回值 = 既有公共契约（`hub-edge-host.ts:118-130`「返回盖章后 wire 序；0 = 未发送/被拒」）；γ 桥按 §9.1 规则消费（>0 投回执 / ≤0 不投） | 无 | — |
| 新错误触发面 `CONNECTION_POLICY_VIOLATION`（tag 违例） | edge `connectionFatal` → 既有 code→close code 映射单点 | 既有码新触发面（非新码）；PUB-C3 跨缝测试断言连接级 ERROR + 收口 | 无（SA8 §10-2 已列入实现期复查集合） | — |
| γ `emitSeam` 未注册 sink ⇒ 0 | 通道 0 值语义消费点（send-failed 声明族） | 与 β `deliverFrame` 逐字同构（返回 0 前不分配 tag/不登记） | 低（SA2-O2 建议的专行断言未落，N7） | N7 |
| 重复/错配 sequence（合法域内）回执 | `UpdateChannel.onReceipt` rekey | 同序不同 tag 会覆盖 inFlight 条目（占用漂移 1）→ 终局经第二次 ACK 'violation' 响亮；**设计 §13-R11 已显式登记该类为 follow-up**（SEAM-C2/ROUND-C3 配对断言锁定检测面） | 低（已登记） | — |

## 8. 错误、恢复与并发

静态逐项核对（SA2 SM-1..SM-11 / ER-1..ER-7 矩阵在实现上的落点）：

- **SM-1/SM-1b（pending-only 计时器哑火——F1 场景）**：`hasUnsettledSends` 合并判据 + 产生点封闭（`sendAndRegister:450-461`、`sendOneChunk:585-598` 两处 set 后同点 arm）+ 消灭点三处（onAck/onAck 判据、abandon 清空后拆、teardown 清空后拆）+ rekey 不触碰计时器 ⇒ 归纳成立；混合态（inFlight 空 pending 非空）保持武装。✓ PEND-C3 ①–④。
- **SM-2/SM-3（锚 pending/idle 收 ACK）**：响亮 `ACK_STATE_VIOLATION`（1002）/round `SYNC_STATE_VIOLATION`，零 park；ANCHOR-C1 收尾 + ANCHOR-C2 实测（fatal 恰一次 + ERROR + 不 live + 被扣回执零投递）。✓
- **SM-4（回执违例）**：域校验 + 未决集单点；重复投递（tag 已出集）⇒ 响亮。✓ PUB-C3。
- **SM-5（终态后迟到消息）**：`connectionStateValue === 'closed'` 双门（handleFrame/handleReceipt）⇒ 静默；A4.5。✓
- **SM-6（重复会话键）**：响亮 throw（β 同款）。✓ api.test。
- **SM-7（selfDrain 重入/终止）**：每 pull 消费队列项或一 chunk；触发点均在同步消息处理边界；显式 release 夹具下出站只入缓冲——结构上排除重入环。✓
- **SM-8（kind=2 自持 timer 先于末 chunk 回执）**：武装点 = 末 chunk 推送（β 同点）；触发 ⇒ `disposeCurrent` + `onBulkTransferAckTimeout → declareHubResync('ack-timeout')`；迟到回执 = `current === undefined` ⇒ false 良性；迟到 `SYNC_APPLIED` ⇒ 锚未回填 ⇒ 响亮 `SYNC_STATE_VIOLATION`。✓ CHUNK-C2 负控全链实测。
- **SM-9（egress ≤0）**：桥不投回执（`unsealed` 探针）；tag 停留 pending 占窗 ⇒ §8.6.1 有界兜底 / 终局随 close 冲刷。✓（γ 装配下 egress 0 仅来自单帧超限/账本越界——§9.1 登记分析成立）
- **SM-10（kind=1 回执扣留）**：bootstrap timer 武装点前移至 enqueue（既有），BOOTSTRAP_ACK 等待 ⊇ 回执等待 ⇒ 有界终局。✓
- **ER-1..ER-7**：缝扣留（PEND-C3）/decode 失败（β 同款 catch）/伪造回执（PUB-C3）/错配序（R11 登记）/egress throw（桥同步传播）/发送被拒（0 值语义路径保持）/β 基线（855 + tsc 双面）——全部落位。✓
- **abandonedTags 补全（Deviation-2）正确性**：`abandonInFlight` 把 pending 键迁入 `abandonedTags`（不清 unresolvedTags）；迟到回执命中 ⇒ `zombieSeqs.add(回执揭示序)` ⇒ 随后迟到 `UPDATE_ACK` 落 'zombie' 良性——与 β「abandon 后迟至 ACK 良性」**逐值同构**；保序条款保证回执先于 ACK 抵达（FIFO），登记先于消费成立。无它则 PEND-C3 ② 场景恢复期会被良性 ACK 以 `ACK_STATE_VIOLATION` 杀死连接——与设计 §9.1「迟到回执良性 no-op；恢复 round 修复」冲突。实现是设计不变量的必要落实（N2）。✓
- **进程内竞态**：γ 全同步消费（显式 release 驱动 + 微任务冲刷），无真实并发面；迟到回调族全部经终态门或 zombie/no-op 良性路径收口。✓

静态无法确认的运行期风险列入 §11（不猜测通过）。

## 9. 测试质量审查

Runner 真实触发：`vitest.config.ts:16` include `packages/*/test/**/*.test.ts` 自动发现 3 个新 `.test.ts`；`typecheck.include`（`:20`）覆盖新 `.test-d.ts`；SA3 日志证实全部被执行（3 files/30 tests + test-d 0 错误 + 包全量 94/855 + 双 tsc exit 0）；日志 mtime 晚于全部测试文件 mtime（证据对应磁盘当前态）。

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| api.test.ts PUB-C1 | 16 值导出逐名在场 + typeof + γ 工厂 function + `open` function | vitest run（日志 ✓） | 无 | — |
| api.test.ts PUB-C3（×3） | 句柄成员恰 6；close 幂等同 promise；未决集外 tag / 非法 sequence / 终态后静默；跨缝注入 ⇒ 连接级 ERROR + fatal 信号 + 不 live | 同上 | 无 | — |
| api.test.ts SEAM-C3（×2） | receipt 键集恰 `{tag,sequence}` + 判别键负控；observer/clock 下 `sendQueueMs` 整键缺席 | 同上 | 无 | — |
| seam-fixture.test.ts PIPE-C1/C2/C2 回合面/C3 | FIFO/不丢/不重/零串道/零投递-显式释放/投递数确定性/扣留面/结构门 0 命中 | 同上 | 无 | — |
| seam-fixture.test.ts SEAM-C1/C2 + 负控 | 闭集合 + lane 判别 + 集合外词汇负控；tag 自 1 严格单调唯一、每 tag 恰一 receipt、`sequence === wire [8..12]`、全连接严格递增；dropReceipts(1) ⇒ 配对必红；reorder ⇒ 投递序 ≠ 入队序 | 同上 | 无 | — |
| round.test.ts ROUND-C1（×2）+ ANCHOR-C1 收尾 + ANCHOR-C2 | OPEN_OK/bootstrap 载荷/ACK 回指/SYNC 三段/live/文档 hex 收敛/CLOSE 回指/settled 恰一次；CAP 两形态各跑；unsolicited ACK 响亮 | 同上 | 无 | — |
| round.test.ts ROUND-C2 + NC-1 | 控制帧逐字节（#424 原族）+ 骨架全等 + docState 语义等 + 内容变异敏感性 + nonce 钉死 | 同上 | 无 | — |
| round.test.ts ROUND-C3 | receipt↔wire 配对 + 同会话不重不跳 + tag 严格单调 | 同上 | close/connection-fatal 信号次数未逐条断言（settled 已断言恰一次）——低风险 | — |
| round.test.ts PEND-C1/C2 | `maxInFlightUpdates=1` + 扣留：扣留期恰 1 data 帧；**只放回执中间态第 2 帧仍不过缝**（rekey 不释放槽位，SA2-O4 建议的显式中间态步已落）；ACK 结算后推送过缝、两笔各恰一 ACK | 同上 | 无 | — |
| round.test.ts PEND-C3 + 变异负控 | ① RESYNC_REQUIRED×1（记忆化）+ `resync-required{ack-timeout}` 恰一次 + 槽位释放（恢复后新帧可再推）；② 迟到回执零 fatal 零新信号零重复声明；③ `hasUnsettledSends` 运行期置回 β 裸判据 ⇒ 零 RESYNC（证明断言敏感）；④ β 矩阵 855 绿 | 同上 | 无（③ 原型补丁 `finally` 还原；根 `maxWorkers:1` 无并行污染） | — |
| round.test.ts CHUNK-C1 + parity | kind=1 真实改道（单帧 0 + chunk ≥2 + ACK 回指末 chunk）+ 每 chunk 独立 tag/恰一 receipt + ANCHOR-C1 全量 + close/settled + 同限额 β 单体 parity（控制帧逐字节 + 骨架含 UPDATE_CHUNK + docState 重组语义） | 同上 | 无 | — |
| round.test.ts CHUNK-C2 + 负控 | kind=2 双侧改道 + `SYNC_APPLIED` 回指对端末 chunk + live/收敛；负控：扣回执 + 虚拟推进自持 timer ⇒ RESYNC×1 + 直投 SYNC_APPLIED ⇒ 响亮 `SYNC_STATE_VIOLATION` 零 park | 同上 | 无 | — |
| round.test.ts CHUNK-C3 + 变异负控 | `ackLatencyMs === k+m`（t0 = 推送时刻含管道等待）；变异（结算不携 pushedAt）⇒ 退化为 m（证明携带承重）；扣留期零 acked 事件 + 回执结算不发射（发射点 = ACK 处理） | 同上 | 无 | — |
| api.test-d.ts TD-C1/C2 | 类型锁定 + 8 条 `@ts-expect-error`（含双向监听者不可互换）+ β 冻结面逐字不变 | vitest typecheck + tsc 双面（日志 ✓） | 无 | — |
| 既有 418/420/421/422/423/424 族 | PUB-C2 硬门 | 包全量 94/855（日志 ✓） | 418 冻结表经授权插入（N1）——非弱化（表仍全等真实导出集） | N1 |

测试缺口（非阻断，详见 §12）：γ `sendOneChunk` async 分支（kind=0 分块 live update）无专用可执行 γ 场景（N4）；ANCHOR-C1 park 变异 / CHUNK-C1 结算变异两条设计列举的变异负控未做成显式测试——敏感性由有界 `pumpUntil`（停摆即 throw）+ ANCHOR-C2/CHUNK-C2 响亮断言结构性保证（N6）；`emitSeam` 未注册 sink ⇒ 0 路径无专行断言（SA2-O2 沿革，N7）。

## 10. Required revisions

无（无 BLOCKER / 无 MAJOR）。

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| 根级 `pnpm test`（全仓 + vitest typecheck 门）未由 SA3 运行（Deferred-1/2；包 AGENTS「root pnpm test」纪律的完整性面） | SA7 终验 / 总控 | 除既有 421 test-d vitest 面 4 红（B1，另票）外全绿；`apps/yjs-server` 套件零回归 | 任何 #447 归因的新红（尤其 yjs-server 公共面消费） |
| 完整 `pnpm typecheck` 15 链（SA3 只跑 ws-replication + 根 typecheck.json） | SA7 / CI | 全链 exit 0（append-only 导出面理论上零影响，静态不能替代实测） | 任何下游 tsconfig 红 |
| γ kind=0 分块 live update（UPDATE_CHUNK transferKind=0）端到端 γ 场景（N4） | 后续实现票/补测 | CAP-on γ 会话 live 后写入 > `maxUpdateBytes` 载荷：末 chunk tag 过缝、回执 rekey、`chunked-update-acked` 结算、窗口守恒 | 末 chunk pendingSends 条目错配 / chunked 事件键集异常 / 窗口双计 |
| 长寿命 γ 宿主 `sessions` Map 累积（R10） | 后续 follow-up | 与 β 同形对称（设计登记，不扩本票 scope） | — |
| 重复/错配 sequence 回执的记账漂移（R11 已登记） | follow-up 加固（每会话回执序严格递增检查，需规范依据） | 当前终局 = 第二次 ACK 'violation' 响亮（有界） | 静默漂移无终局 |
| SA8 §10-R1/R2/R3 实现期复核（t0 代码路径 / AGENTS.md 落盘 / 冻结面五项） | SA8 implementation 复查门 | 本报告 §3/§4 已给静态核对证据；SA8 按其门禁独立落章 | — |

## 12. Non-blocking observations

| ID | Severity | Observation | Suggested disposition |
|---|---|---|---|
| N1 | MINOR（可接受偏离，需记录） | 418 冻结表 3 行插入越 ALLOW 字面（SA3 Deviation-1）：PUB-C1（16 值导出）与该表 `toEqual` 全等断言机械互斥；#422 本表先例 + issue-254 SA4 判例（机械牵连 ≠ 范围越界）+ 零断言弱化 + 透明申报 ⇒ 可接受 | 建议后续设计 ALLOW 模板把「公共导出面变更连带冻结快照表维护」写入授予面（design 路由，非本票阻断）；SA3 报告已留申报记录 |
| N2 | MINOR | `abandonedTags`（SA3 Deviation-2）为实现级补全：设计 §8.6.1 只写了「被弃 tag 迟到回执 no-op」，未覆盖「弃置时序未知的 pending 条目随后收到迟到 `UPDATE_ACK`」——无此补全则 γ 下恢复期被良性 ACK 以 `ACK_STATE_VIOLATION` 杀死（与设计 §9.1 冲突）；实现使 β zombie 同构逐值成立，位置在 ALLOW 行 8 文件内 | 建议设计文本回填该机械（design 路由，登记性质）；实现保持现状 |
| N3 | MINOR | 分块构型 parity 判据用能力感知等价物 + β 单体参照（SA3 Deviations-3/4）：#424 原族无协商位解码遇 `UPDATE_CHUNK` 响亮拒绝、`makeShardedReplicationFacade` 内部硬编码 `LIMITS`（`issue424-sharded-hub.ts:187`）不可小限额改道——两限制本席实测复核属实；单帧构型仍逐字用 #424 原族（契约字面满足），分块构型判据同构加强 | 无需动作（记录在案）；若后续 #424 夹具解禁可统一 |
| N4 | MINOR | γ `UpdateChannel.sendOneChunk` async 分支（kind=0 分块 live update 末 chunk 的 pendingSends 记账 + `chunked-update-sent` 事件）无专用可执行 γ 场景；机械与单帧路径（PEND-C1/C2/C3 已覆盖）+ β kind=0 路径（301 族）同构共享 rekey/结算 | 后续补一例 CAP-on γ 会话大 update 场景（见 §11） |
| N5 | MINOR | `HubNamespaceChannel.bootstrapAnchorPending` 只读访问器无任何消费者（生产/测试 grep 零命中）——设计未要求、未被行使的诊断面 | 删除或接入断言（implementation 路由，一行级） |
| N6 | MINOR | 设计 §12 ANCHOR-C1「park 化变异 ⇒ 红」与 CHUNK-C1「末 chunk 结算变异 ⇒ 红」未落成显式变异测试；敏感性由有界 `pumpUntil`（未达谓词即 throw = park 停摆必红）+ ANCHOR-C2/CHUNK-C2 响亮收口断言（同一判别机械）结构性保证 | 可选补显式变异（低优先；现断言面已可执行且敏感） |
| N7 | MINOR | γ `emitSeam` 未注册 sink ⇒ 返回 0 且零登记路径无 §12 专行断言（SA2-O2 沿革建议；api.test 只断言退订后零投递，未断言发送面返回 0 + 后续注册不受污染） | 后续一行级补断言（PUB-C3 或 SEAM 行） |
| N8 | MINOR | ROUND-C3 对 `close`/`connection-fatal` 缝消息的生命周期次数未逐条断言（settled 已断言恰一次；两信号在 PUB-C3/ANCHOR-C2 场景各断言恰一次） | 可选补计数断言（低优先） |

---

### 收尾声明

- 本报告为纯静态实现审查：未运行任何测试/服务/进程（绿灯证据 = SA3 留档日志 + 时间戳/计数一致性核验）；未修改任何实现、设计或测试文件；唯一写入产物 = 本文件。
- SA8 §10 登记的 5 项实现期复核中，R1（t0 代码路径）、R2（AGENTS.md 落盘）、R3（冻结面五项）的静态核对证据已在本报告 §3/§4/§6 给出；SA8 门禁独立落章由总控路由。
- 不需要新的 ADR 冲突复查（实现未开设计 §15 申报集合之外的新决策面）；`requiresConflictRecheck = false`。
