# task_issue-447 SA9 标准审查 —— γ-T1：公共异步会话工厂 + 延迟注入异步 FIFO 管道夹具 + 首个跨缝协议回合

- 审查对象：已提交最终交付 `52e634b`（`feat(ws-replication): add gamma async session host`；16 个代码/测试/模块文档文件 + 7 份 wiki/raw 上游产物）；权威基线 = PR #446 head `spec/445-gamma-async-seam` @ `c86ccbc`（fetch 后稳定，本席逐文件 diff 复核）。
- 评审人：SA9（独立 Standards 审查；不审 Issue 需求完整性（SA10 职责），不修改代码/设计/测试，不运行测试/服务，唯一写入产物 = 本文件）。
- Issue 评论 REST 快照为空（dispatch 明示）——无 Owner 追加要求可映射。
- **Verdict：`approve`**（无 BLOCKER / 无 MAJOR；6 条非阻断 MINOR 观察 M1–M6，见 §9）。
- `requiresConflictRecheck = false`（设计 §15 申报集合已由 SA8 实现复审 `task_issue-447_implementation_conflict_report.md`（verdict `clear`，其 §10 置 false）逐项闭合；本审查未发现其外的新决策面）。

---

## 1. Reviewed inputs

| 输入 | 位置 | 状态 |
|---|---|---|
| Host 任务简报 | `wiki/raw/task_issue-447.md` | 已读（AC×6；Comments 空） |
| 批准设计（修订版 668 行） | `wiki/raw/task_issue-447_design.md` | 已读全文（§7-D1–D12、§8、§11 ALLOW/DENY、§12、§14、§15） |
| SA2 设计评审（第 2 轮 `approve`） | `wiki/raw/task_issue-447_sa2_review.md` | 已读（F1/F2 闭合核验 §5a/§12a；O1–O7 处置） |
| SA8 设计后冲突报告（iteration 1 `clear`） | `wiki/raw/task_issue-447_design_conflict_report.md` | 已读（E1/E2 闭合、E3 裁决读法、R1–R5 实现期义务） |
| SA8 实现复审（`clear`，recheck=false） | `wiki/raw/task_issue-447_implementation_conflict_report.md` | 已读（22 项对照；偏差 1–4 裁决） |
| SA6 验收契约（`approve`） | `wiki/raw/task_issue-447_sa6_contract.md` | 已读（GAP/ORACLE/NC、§12 契约条目、§15-B1 归因） |
| SA3 实现报告 | `wiki/raw/task_issue-447_sa3_impl.md` | 已读（Changed paths / Deviations 1–5 / Verification） |
| SA4 实现静态审查（`approve`） | `wiki/raw/task_issue-447_sa4_review.md` | 已读（N1–N8 非阻断观察） |
| 规范权威 | `docs/adr/0032-*.md:55-99`（A4.1–A4.8）、`docs/protocols/instance-replication-v1.md:1091-1154`（§24.1–§24.8）、`CONTEXT.md` γ 段/序回执词条 | 本席原文复读（非转抄上游结论） |
| 模块契约 | `packages/ws-replication/AGENTS.md`（交付版 :17 含 γ 登记句；Verification :26） | 已读；diff 逐字符核对（既有枚举句逐字保留 + append-only 补句） |
| 根纪律 | 根 `AGENTS.md`（模块指引/typed-access 纪律适用范围）、`docs/agents/issue-tracker.md`、`vitest.config.ts:14-23`、根 `package.json:11-13` | 已读 |
| 交付 diff | `git diff c86ccbc..52e634b` 全量（10 生产/文档修改 + 5 新测试文件 + 1 冻结表插入） | 逐文件审读；关键机械（§8.6.1 判据、三态锚、回执路由、t0 携带）逐点源码复核 |
| 验证证据 | `artifacts/sa3-issue447-gamma-suites.log`（3 files/30 tests 绿 + test-d 零错误）、`artifacts/sa3-issue447-package-suite-and-typecheck.log`（94 files/855 tests 绿 + 包/根 tsc exit 0） | 已读（SA9 不运行测试；日志结论与 SA3/SA4 报告一致，计数与磁盘文件一致：8+7+15=30） |

缺失输入不阻断：`task_issue-447_relevant_decisions.md` / 前置 `_conflict_report.md` 不存在（上游各报告均已声明，决策集以 SA8 两报告 §2 盘点为准）；SA7 动态终验报告尚不存在（见 §9-M3）。

## 2. Verdict

**`approve`**。独立复核结论：

- **规范一致性**：交付逐字落在 ADR 0032 A4 / 协议 §24 的登记口径内（§3 逐条对照），规范文本零改动（`git diff` 对 `docs/`、`CONTEXT.md` 为空）；
- **模块责任**：γ 全部差量收在新模块 `hub-session-async-host.ts`（公共面 + 第三 port 形态）与各事实所有者的 append-only 载体扩展内，无职责错位（§4）；
- **既有架构惯例**：镜像 β 工厂/#424 facade/#420 test-d/#256/#300 小限额注入/#422 冻结表先例（§5）；
- **单一事实源与生命周期对称**：无第二事实源、无平行计时器/状态机/cleanup 循环；open/close/注册/冲刷全面对称（§6/§7）；
- **文件范围**：ALLOW 15 行全命中、DENY 面 git 实证零触碰；唯一越 ALLOW 编辑为已申报、最小化、有先例的机械牵连（§8-M1）；
- **测试质量**：断言全为运行期行为、结构门仅补充、零 skip/only/todo、零真实 timer/wall-clock、负控与两条可执行变异测试承重、证据留档与磁盘态一致（§8）。

## 3. 规范一致性（ADR 0032 A4 / 协议 §24；本席逐条复读原文后对照代码）

| 规范条款 | 交付落点 | 本席复核 |
|---|---|---|
| A4.1 / §24.1：公共面 = 独立新工厂/句柄类型；`src/index.ts` append-only | `hub-session-async-host.ts`（新模块 324 行）；`index.ts` +1 值 +5 类型（15→16），既有名零改名零删除 | ✓（diff 实证；PUB-C1/TD-C2 断言面） |
| A4.1 / A1：β `createHubSessionHost` 冻结面逐字不动 | `hub-session-host.ts` 不在改动面（git 实证）；γ 复用其纯 JSON 类型（`HubSessionHostConfig`/`HubSessionOpenInput`/`HubSessionSignal`/`HubSessionFrameLane`）而不修改 | ✓ |
| §24.3 / A4.6：七消息闭集合；无拒纳/闸门/信用词汇；receipt 键集恰 `{tag, sequence}` | 生产类型 `HubAsyncSessionFrame{tag,bytes,lane}`/`HubAsyncSessionReceipt{tag,sequence}`；夹具联合 `SessionToEdgeMessage`/`EdgeToSessionMessage` 恰为闭集合；diff 全文无 sent/deferred/rejected/credit/gate/paused | ✓（SEAM-C1/C3 断言 + 负控） |
| §24.2.3 / A4.2：盖章点同步投回执、先于后续 socket 数据 | test-only 宿主桥在 egress 返回值**同一同步段** enqueue receipt（`issue447-async-seam.ts:499-506`）；≤0 不投（回执只承载盖章事实）；edge/frame-io 生产代码零改动 | ✓ |
| §24.2.4：tag 由 session 分配、句柄域单调唯一 | `emitSeam` 每句柄 `++tagCounter` 自 1；校验单点在 `handleReceipt`（域校验 + 未决集一次性成员资格） | ✓ |
| §24.2.6 / §24.4：违契响亮收口；pending 两相记账、换键不换槽、ackTimeout 锚定同构 | 未知/重复 tag、非法 sequence ⇒ `connection-fatal{CONNECTION_POLICY_VIOLATION}`（既有码复用，映射单点留 edge）；`pendingSends` 独立 tag 键空间计入 `effectiveInFlightCount`；`onReceipt` 换键不换槽不触碰计时器；`hasUnsettledSends()` 合并占用统一计时器回调与 `onAck` 拆除判据（α/β 恒空逐值退化） | ✓（SA2-F1 落点逐点核对：`update-channel.ts` 产生点 `sendAndRegister`/`sendOneChunk` 两处 set 后同点 arm；消灭点三处均合并归零/清空后拆——归纳前提成立） |
| A4.3 / §24.5：流控单点 edge；session 乐观发送 | γ port `dataGateOpen:()=>true`、`bufferedAmount:()=>undefined`（A3 dormant 先例）；共享闸门代码零改动 | ✓ |
| A4.4 / §24.6：自驱 drain 三触发点、推完即停 | `selfDrain` 触发点 ①入队 ②入站消息消费后 ③末 chunk 回执结算后；`while (pullAndSendOne())` 有界 | ✓ |
| A4.5 / §24.7：生命周期单规则 | `close()` 幂等（终态门 + `unresolvedTags.clear()` + sink 既有 quiesce/teardown 清 pending/abandonedTags）；迟到回执/帧终态静默；`terminateUnauthorized` 不溯及 | ✓ |
| A4.7 / §24.8：`ackLatencyMs` t0 = 推送时刻；tag 不入事件键集 | `bulk-transfer.ts` γ 分支推送调用边界采样 `pushedAt`（`asyncSendTickets === true ? host.now?.() : undefined`——α/β 零新增时钟读）→ `pendingLastChunkTag` 携带 → `onLastChunkSent` append-only 第三参回传 → `hub-namespace.ts` 两写点 `pushedAt ?? sampleAckT0()`；`onUpdateSent` 普通帧早退、chunked 族键集恰 `transferId/chunkCount/totalBytes`（本席源码复核 `:1453-1473`） | ✓（SA8-E1 路线 a 代码闭合；CHUNK-C3 k+m 断言 + 变异负控背书） |
| A4.8：wire 与 β 逐字节等价；零 worker_threads；既有矩阵全绿硬门 | ROUND-C2 parity（单帧 = #424 原族逐字复用；分块 = 能力感知等价物 + β 单体同限额参照，等价性由单帧构型两套判据同结论互证）；PIPE-C3 结构门 0 命中（本席 grep 独立重申：生产面仅测试断言文件含该词汇）；855 包测试绿日志 | ✓ |
| A4.2 三态锚 + SA8-E3 裁决读法 | `SendAnchorState`（types.ts，内部类型——本席核实不经 `index.ts` 导出）；判别语义逐字保持（`anchor.phase !== 'stamped'` ∨ 不等 ⇒ 既有响亮违例，禁 park）；FSM 零分叉 | ✓ |
| 模块 AGENTS.md 文档同步（docs/AGENTS.md 纪律；SA8-E2） | `:17` 既有枚举句逐字保留 + append-only γ 登记句（引 A4/§24；无拒纳词汇；β 冻结面声明），与 γ 代码同变更集落盘 | ✓（diff 逐字符核对） |

## 4. 模块责任归属

| Behavior | 应有归属 | 实际位置 | Assessment |
|---|---|---|---|
| γ 公共工厂/句柄/第三 port 形态 | 新模块（不污染 β） | `hub-session-async-host.ts`（只组装 `createHubSessionSink`，FSM 唯一实现仍在 `hub-namespace.ts`） | 正确 |
| tag 分配/校验/未决集 | session 侧 γ port 层 | `emitSeam`/`handleReceipt` 单点 | 正确（§24.2.4） |
| wire 序盖章 | edge mux 单点 | `frame-io.ts` 零改动 | 正确 |
| 回执生产 | 宿主传输义务（§24.1） | test-only 桥样例（生产零侵入） | 正确 |
| pending 记账/窗口/ackTimeout | `UpdateChannel`（事实所有者） | §8.6/§8.6.1 全在通道内；无 γ 层 watchdog | 正确 |
| 三锚 | channel/engine/transfer 载体内部 | append-only 载体扩展 + γ 门控写点 | 正确 |
| 延迟注入管道 | test-only 夹具 | `test/issue447-async-seam.ts`；`src/testing.ts` 零改动（DENY 保持） | 正确 |

## 5. 既有架构惯例对照

| 先例 | 本交付 | 一致性 |
|---|---|---|
| β 公共工厂/句柄（`hub-session-host.ts`） | γ 镜像 + 回执面；port 成员逐项同形，仅 γ 授权差量 | 一致 |
| #424 `makeShardedReplicationFacade`（`boot({createHub})` 集成点、SD-2(a)/SD-3/registry 采纳纪律） | `makeAsyncReplicationFacade` 同集成点同纪律（头注 1–8 镜像） | 一致 |
| #420/#421/#422 test-d 双面门 + 负控 | 新 test-d（TD-C1 类型锁定 + 8 条 `@ts-expect-error` + TD-C2 β 非回退） | 一致 |
| #420 结构门（worker_threads 0 命中） | PIPE-C3 重申同款 | 一致 |
| #256/#300/#301 小限额分块构型 | `boot({limits})` 双侧注入（CHUNK_BOOTSTRAP_LIMITS/CHUNK_SYNC_LIMITS；构型链满足 `validate.ts`） | 一致 |
| #422 §12.8「一次性授权编辑」（冻结表排序插入 + 出处注释） | 418 冻结表同款处置（M1） | 一致 |
| 既有测试超时参数形态（`, 30_000)`） | 同形态（15 处，与 300/243/246 族同款） | 一致 |

## 6. 单一事实源与平行机制

- wire 序：edge mux 盖章唯一事实源；receipt 仅事实回传（不参与发送决策）——无漂移面。
- tag：γ port 计数器单点；tag/seq 分键空间（`pendingSends` vs `inFlight`）结构性消除值域碰撞。
- 窗口占用：`effectiveInFlightCount()` 唯一口径（pending 计入）；`takeItems` 裸口径例外仅贪心合并宽度，设计 §8.6 注记、SA2-O3 已核。
- 计时器体系：三锚（channel ackTimer / bulk 自持 timer / bootstrap timer）各司其职，§8.6.1 只统一**判据**不新增计时器；「占用非零 ⇒ 武装」经产生/消灭点归纳成立（本席复核点封闭性属实）。
- `abandonedTags`（SA3 Deviation-2）：弃置 tag 的成员资格桥接集，值仍单点登记进既有 `zombieSeqs`——使 §23.1 zombie 纪律在 γ 下逐值成立；非第二账本（SA8 实现复审 §3-#17 同判，本席同意）。
- 无第二状态机/第二 cleanup 循环/仅服务单 Issue 的过度抽象。

## 7. 生命周期对称性

| Acquire/Start | Release/Stop | Failure recovery | Assessment |
|---|---|---|---|
| `open()`（重复键/空键响亮 throw） | `close()` 幂等同 promise；`unresolvedTags` 冲刷 + 通道 quiesce + teardown 清 pending/abandonedTags | 迟到回执/帧终态静默（A4.5）；`closeTimeoutMs` 逃生舱不动 | 对称 |
| `onFrame`/`onSignal` 注册 | 退订函数（PUB-C3 断言生效） | onFrame throw 原样传播 / onSignal 隔离（β 镜像） | 对称 |
| 夹具 `enqueue` | 显式 `release(count?)`（确定性投递数） | 不释放 = 零投递（PIPE-C2）；旋钮（reorder/drop/withhold）单点 | 对称 |
| γ host `sessions` Map | 无终态移除 | — | β 同形先例（设计 §13-R10 / SA4 §5 登记 follow-up；非本票引入的不对称） |

## 8. 文件范围与测试质量

**文件范围**（`git diff c86ccbc..HEAD --name-only` 全集核对）：ALLOW 15 行全部命中且内容吻合；DENY 面（β 冻结工厂、edge/frame-io/backpressure、α 组合根/插件轨、peer 侧、`src/testing.ts`、规范文本、其余包/域/应用/根配置、既有测试族与夹具）**零改动**（git 实证）。唯一越 ALLOW 项见 M1。wiki/raw 上游产物 7 份随交付同 commit 落盘（与 `2e579e0`/`8fdb43f` 等前例同族）。

**测试质量**（逐文件审读 5 个新测试/夹具文件）：

- 断言全部 = 运行期行为（导出名集/typeof、句柄成员集、缝消息对象键集、wire 原字节 `[8..12]`、`ackedSequence` 回指、文档收敛 hex、窗口计数、单事件字段值）；PIPE-C3 结构门为唯一源码 grep 类断言且明示「补充非替代」（#420 先例同款）。
- 零 skip/only/todo/env override（grep 实证）；零真实 timer/wall-clock（延迟 = 显式 release 步 + 虚拟 scheduler 推进 + 手动时钟）。
- 负控与变异真实可执行：reorder/drop 负控、NC-1 内容敏感性、PEND-C3 变异（`hasUnsettledSends` 置回 β 裸判据 ⇒ 哑火红）与 CHUNK-C3 变异（结算不携 `pushedAt` ⇒ 少 k）均为原型补丁 + `finally` 还原，根 `maxWorkers:1` 无并行污染。
- 运行器入口真实：`vitest.config.ts:15-21` include/typecheck.include 自动发现全部新文件；SA3 日志计数与磁盘文件一致（8+7+15=30）。
- SA4 §9 已核的缺口（N4/N6/N7/N8）本席复核属实，均为非阻断（见 §9-M4 及登记）。

## 9. Non-blocking observations（MINOR；均不阻断 approve）

| ID | 观察 | 依据与处置建议 |
|---|---|---|
| M1 | 418 冻结表 3 行插入越设计 ALLOW 字面（`FROZEN_PRODUCTION_EXPORTS` 排序插入 `'createHubAsyncSessionHost'`） | 机械必然（PUB-C1 的 16 值导出与该表 `toEqual` 全等断言字面互斥，无第三解）；断言语义零弱化（仍全等真实导出集）；本文件 #422 §12.8 先例同形同注；SA3 Deviation-1 透明申报；SA4-N1 与 SA8 实现复审 §3-#16/§8-R1 均已裁可接受并留追认路由。建议后续设计 ALLOW 模板把「公共导出面变更连带冻结快照表维护」写入授予面（design 路由） |
| M2 | `HubNamespaceChannel.bootstrapAnchorPending` 只读访问器零消费者（本席 grep 实证：全仓仅定义点 1 命中） | 设计未要求的未行使诊断面；一行级删除或接入断言（implementation 路由；SA4-N5 同判） |
| M3 | 模块 AGENTS.md Verification 末句（「root `pnpm typecheck` + `pnpm test` for any wire or lifecycle change」）的全仓门证据不在仓内：SA3 实测面 = 包套件 855 绿 + 新套件 30 绿 + 包 tsc + 根 `tsconfig.typecheck.json` tsc 双 exit 0；根 15 链 typecheck 与全仓 `vitest run --typecheck` 未跑（SA3 Deferred-1/2、SA4 §11 登记交 SA7/CI）。注：根 `pnpm test` 在 HEAD 因既有 421 test-d vitest typecheck 4 红（SA6 §15-B1 已归因、另票）本就不可能全绿，非 #447 归因 | finalize 前由 SA7/CI 补齐全仓门并维持 B1 归因；append-only 面静态上不可能破坏下游编译，风险低 |
| M4 | γ `sendOneChunk` async 分支（kind=0 分块 live update 的 pendingSends 记账）无专用 γ 可执行场景；设计列举的两条变异（ANCHOR-C1 park 化、CHUNK-C1 结算改单帧锚）未落成显式变异测试；γ `emitSeam` 未注册 sink ⇒ 0 路径无专行断言；ROUND-C3 未逐条断言 close/connection-fatal 缝消息次数 | SA4-N4/N6/N7/N8 同判；机械与已覆盖路径同构共享，敏感性由有界 `pumpUntil` 与 ANCHOR-C2/CHUNK-C2 响亮断言结构性保证；建议后续补测，非本票阻断 |
| M5 | 证据日志（`artifacts/sa3-issue447-*.log`、`artifacts/sa6-issue447-*.log`）与 SA6 探针 `task_issue-447_sa6_capability_probe.mts` 仍 untracked，而引用它们的 wiki 报告已 commit | 证据链完整性属 finalize 动作：按 `8fdb43f`（#422 evidence retention）前例补 commit 或在报告中内嵌关键输出 |
| M6 | 交付 commit 标题 `feat(ws-replication): add gamma async session host` 未携 `#447` 出处 | 历史两种形态并存（`fix(#412): …` vs `55609d5 feat(ws-replication): add hub session-only plugin mode`）；cosmetic，不要求改写历史 |

## 10. 收尾声明

- 本审查为纯静态标准核对：未运行任何测试/服务，未修改任何代码/设计/测试；绿灯事实采信 SA3 留档日志 + SA4 时间戳/计数一致性核验 + 本席对 diff 与规范原文的逐点比对。
- SA8 两道门禁（设计后 iteration 1 `clear`；实现复审 `clear` 且 `requiresConflictRecheck=false`）已覆盖 ADR 冲突面；本席未发现设计 §15 / SA8 §10 申报集合之外的新决策面，本产物 `requiresConflictRecheck = false`。
- M1–M6 全部非阻断；交付在仓库 AGENTS、ADR/协议规范、模块责任、既有惯例、单一事实源、生命周期对称性、文件范围与测试质量八个标准面均判**符合**。
