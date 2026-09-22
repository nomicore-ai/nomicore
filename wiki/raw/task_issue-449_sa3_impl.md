# SA3 Implementation Report — issue #449（γ-T3）：reconcile 与分块 transfer 跨缝（verification-only 交付）

- Dispatch：`sa-6f3fe4dd-bba9-4ff1-ae57-20dfa6421bf9`（mabf-sa3 / implementation / iteration 0）。
- Worktree：`/home/wangjian/nomicore-fix-issue-449`，branch `mabf/issue-449`，HEAD `444c166`（与本票设计 §Baseline 一致）。
- 结论：**按批准设计 §7-D2 新著契约测试文件并全绿**；生产面零改动（`git diff -- packages/ws-replication/src` 为空）；夹具/既有测试零改动。契约矩阵 15 条目 → 14 用例（`CHUNK3-C2` 与 `ROUND3-C1` 同构，合并于同一用例并按矩阵逐条断言，未合并削弱判据）。

---

## Inputs consumed

| 输入 | 路径 | 状态 |
|---|---|---|
| 任务简报 | `wiki/raw/task_issue-449.md` | 在场；6 条 AC + `Blocked by #448`（已合并）+ Comments 空 |
| 批准设计（本票权威规格） | `wiki/raw/task_issue-449_design.md` | 在场；§0 裁定 verification-only、§7-D2 交付物、§8.1 著写规格、§11 ALLOW/DENY、§7-D6 验证门、§13-R6 构型链 |
| SA6 诊断与验收契约 | `wiki/raw/task_issue-449_sa6_contract.md` | 在场；§12.3 15 条目矩阵 = 条目权威规格；§5 探针 7/7 期望值；§6 负控矩阵 |
| SA2 设计评审 | `wiki/raw/task_issue-449_sa2_review.md` | **不存在**（iteration 0 尚无评审输入；设计 §14 同款登记） |
| SA8 产物（`relevant_decisions` / `conflict_report`） | `wiki/raw/` | **不存在**（设计 §6 以规范权威原文替代；非阻塞） |
| 上游证据日志 | `artifacts/sa6-issue449-*.log`（5 份） | 在场，只读复用（未改写） |
| 夹具 / run 助手 | `test/issue447-async-seam.ts`、`issue448-live-seam.ts`、`harness.ts`、`driver.ts` | 只读使用；**零改动**（H8/§7-D5） |
| Owner 评论要求 | Issue comments REST read = empty array（派工明示） | 无追加要求可映射（设计 §4） |

## Existing worktree reconciliation

- 入场时 `git status --porcelain` = 5 份 SA6 证据日志 + 简报 + SA6 契约 + 设计（untracked）；`packages/ws-replication/src/**`、夹具、既有 `*.test.ts` 零 diff ⇒ 与设计 §2/§16 声明一致。
- 无 `wiki/raw/task_issue-449_sa3_impl.md`、无遗留未提交实现 ⇒ 本次为首版实现，无待修订前版。
- 校准期临时探针（`.scratch/sa3-*`）与 4 个隔离变异脚本在收尾前**全部删除**（`.scratch/` 仅剩仓库既有 `vfsl-v1-parser/spec.md`）；变异后生产树经 `git checkout --` 恢复并逐例复核 `git diff --quiet` 为空。

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/ws-replication/test/ws-replication-issue449-gamma-reconcile-chunked.test.ts` | §7-D2 / §8.1（ALLOW 唯一可执行交付物） | **新增**（1129 行）：ROUND3 / ANCHOR3 / CHUNK3 / ABORT3 / DRAIN3 五族 14 用例，覆盖 SA6 §12.3 全 15 条目；零 skip/only/todo、零 env override、零真实 timer/网络/wall-clock；隔离变异 `finally` 恢复原型 |
| `artifacts/sa3-issue449-gamma-suites.log` | §7-D6 门 2 | 新增（γ 五文件 57/57） |
| `artifacts/sa3-issue449-package-suite.log` | §7-D6 门 3 | 新增（包全量 102 文件 / 911 用例） |
| `artifacts/sa3-issue449-package-tsc.log` | §7-D6 门 4 | 新增（exit 0，空输出） |
| `artifacts/sa3-issue449-stability-3x.log` | §7-D6 门 5 | 新增（契约单文件连续 3 次全绿） |
| `artifacts/sa3-issue449-mutation-summary.log` + `-mutation-M1..M4-*.log` | §12「敏感性证据（替代红灯的判别力证明）」/ R3 证据重建 | 新增（4 个隔离变异逐例检出；生产树逐例恢复） |
| `artifacts/sa3-issue449-beta-reference.log` | §8.1 CHUNK3-P1 参照面 | 新增（β 参照选择的事实证据，见「Deviations」D1） |

本票**未**改动：`packages/ws-replication/src/**`（零生产 diff）、`test/issue447-async-seam.ts`、`test/issue448-live-seam.ts`、`test/harness.ts`、`test/driver.ts`、其余既有 `*.test.ts`/`*.test-d.ts`、`docs/**`、`CONTEXT.md`、根配置与 lockfile。

## SA2 Finding落实

- iteration 0 无 `task_issue-449_sa2_review.md` ⇒ **无 SA2 BLOCKER/MAJOR/MINOR 可映射**（设计 §14 已登记同款事实）。
- 设计中已固化的前序约束按原样落实：E1「fix before green」（先落盘契约再断言全绿，无红灯伪造）、E4「bootstrap single-frame / parity 判据不削弱」、E5「**原始断言不得削弱**」（逐条从严：恰 N 帧 / 恰一事件 / strict 先行 / `unsealed === 0` / `transferId === 1` / chunked 族无 `sequence` 键）。

## 契约条目 → 用例映射（设计 §7-D2 要求的逐条目映射；SA6 §12.3 为权威）

| SA6 §12.3 条目 | 用例（本文件 `it` 标题前缀） | 关键判据（运行时行为，逐条按矩阵） |
|---|---|---|
| `ROUND3-C1` | ROUND3 第 1 例 | 单帧 `SYNC_STEP2` 双向恒 0；双向 `chunkIndex 0..k-1`（k=2）、`chunkCount=k`、单 `transferId`；双向 `SYNC_APPLIED.ackedSequence` = 对端末 chunk 序；`chunked-sync-sent/-applied/-acked` 各恰一（无 `sequence` 键、字节字段在场）；live + 文档收敛 |
| `CHUNK3-C2` | 同上（同构；用例标题显式并列） | 同上（kind=2 全回合），不另设弱化副本 |
| `ROUND3-C2` | ROUND3 第 2 例 | 按 tag 丢弃 hub `SYNC_STEP1` 回执（`dropped()` 证据）⇒ `ERROR{SYNC_STATE_VIOLATION}` + namespace `failed`；对端引用帧已过缝（反假绿）；零 `chunked-sync-acked`；有限泵内必达（零 park） |
| `ROUND3-C3` | ROUND3 第 3 例 | 步进至队列头 = 末 kind=2 chunk 回执**且**次位 = 对端 `SYNC_APPLIED`（in-place 断言，编排漂移即红）；`reorderNext()` + `release(1)` ⇒ `ERROR{SYNC_STATE_VIOLATION}` + `failed`；`delivered()` 消费序证据（ACK 先于其锚回执）；零 acked |
| `ANCHOR3-C1` | ANCHOR3 第 1 例 | 三步：① 中间回执 ⇒ 零 `chunked-snapshot-sent`/`acked` + 缓冲头 = 末 chunk 回执；② 末回执 ⇒ sent 恰一 + 零 acked + 缓冲头 = `BOOTSTRAP_ACK`；③ ACK ⇒ acked 恰一（`ackLatencyMs = k + m`，t0 = 推送时刻）+ 回指末 chunk 序 + 消费序 strict 先行 + live/收敛 |
| `ANCHOR3-N1` | ANCHOR3 第 2 例 | 丢全部 kind=1 chunk 回执后放 ACK ⇒ `connection-fatal{ACK_STATE_VIOLATION}` + `ERROR{ACK_STATE_VIOLATION}` + 非 live + 零 acked（零静默接受） |
| `CHUNK3-C0` | CHUNK3 第 1 例 | kind=0 步进：中间回执 ⇒ 零占位变化/零新事件/第 2 笔不过缝；末回执 ⇒ 换键不换槽（仍 1 槽）+ 零 acked；ACK ⇒ `chunked-update-acked` 恰一（`ackLatencyMs = k + m`、无 `sequence` 键）+ `UPDATE_ACK` 回指末 chunk 序 + 第 2 笔恰一次续推（新 transferId、`chunkIndex` 从 0） |
| `CHUNK3-C1` | CHUNK3 第 2 例 | 每 chunk 独立 tag ∧ 每 tag 恰一回执 ∧ `receipt.sequence = 该帧 wire[8..12]`（原字节读回）；中间回执 no-op（零 sent/acked）；末回执 sent 恰一；`BOOTSTRAP_ACK` 回指末 chunk 序；live + 收敛 |
| `CHUNK3-P1` | CHUNK3 第 3 例 | T3 多 chunk 构型 γ vs β：控制帧逐字节等 + 全轨迹骨架等（含 `UPDATE_CHUNK` 帧型/帧序）+ 数据帧文档语义等；NC-1 内容变异必报差异 |
| `ABORT3-C1` | ABORT3 第 1 例 | kind=1 在途 + `closePeerSide(1006)` ⇒ 死后缝出站/`hubToPeer`/`sessionToEdge` 零增长、零 settled、`unsealed === 0`、零 `chunked-snapshot-sent`、非 live；追加放行被扣缓冲（含 close）后仍零新出站、零未盖章洞 |
| `ABORT3-C2` | ABORT3 第 2 例 | kind=2 在途 + 断链 ⇒ 同上 + 零 `chunked-sync-sent`/`-acked`（末 chunk 回执未结算） |
| `ABORT3-C3` | ABORT3 第 3 例 | `advanceMs(run, 5000)` 重连 ⇒ 新会话独立收敛 live；旧 session 投递/死连接 wire 零增长（零续传）；新作用域 `transferId === 1` ∧ `chunkIndex` 从 0 严格递增；`unsealed === 0`；重连后收敛 |
| `ABORT3-N1` | ABORT3 第 4 例 | 存活对照：同编排全放行 ⇒ sent/acked 各恰一 + live + 零响亮 + 收敛（证明 abort 断言非空） |
| `DRAIN3-C1` | DRAIN3 第 1 例 | kind=2 在途 + ACK 扣留 + 队列第 2 笔 ⇒ 末回执结算后零新增 data 帧、`scheduler.pending()` 不增、零 acked、第 2 笔不过缝；ACK 放行 ⇒ 第 2 笔恰一次推出 + `chunked-sync-acked` 恰一 |
| `DRAIN3-D1` | DRAIN3 第 2 例 | 隔离变异 `BulkTransferSender.prototype.onReceipt`（照常结算但 `return false`）⇒ 轨迹/事件/收敛**逐值相同**；变异生效计数 > 0（证明隔离确被行使）；`finally` 恢复原型 |

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/ws-replication/test/ws-replication-issue449-gamma-reconcile-chunked.test.ts` | §11 ALLOW 第 1 行（新增，本票唯一可执行交付物） | AC1–AC6 可执行验收锚 |
| `artifacts/sa3-issue449-gamma-suites.log` | §11 ALLOW 第 3 行（本票前缀新日志） | §7-D6 门 2 证据（R3 证据重建） |
| `artifacts/sa3-issue449-package-suite.log` | 同上 | §7-D6 门 3 证据 |
| `artifacts/sa3-issue449-package-tsc.log` | 同上 | §7-D6 门 4 证据 |
| `artifacts/sa3-issue449-stability-3x.log` | 同上 | §7-D6 门 5 证据（≥3 次稳定） |
| `artifacts/sa3-issue449-mutation-summary.log`、`-mutation-M1..M4-*.log` | 同上 | 负控判别力证据（§12 敏感性/§13-R4 反证纪律） |
| `artifacts/sa3-issue449-beta-reference.log` | 同上 | CHUNK3-P1 β 参照选择的事实证据（D1） |

DENY LIST 逐项核对：`src/**` 零 diff；`issue447-async-seam.ts`/`issue448-live-seam.ts`/`harness.ts`/`driver.ts` 零 diff；既有 `*.test.ts`/`*.test-d.ts` 零 diff；`docs/**`、`CONTEXT.md`、`AGENTS.md`、`replication-protocol/**`、根配置/lockfile 零 diff；未触 #450/#451 面。

## Verification

| Command | Result | Evidence |
|---|---|---|
| `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication/test/ws-replication-issue449-gamma-reconcile-chunked.test.ts` | **14/14 passed**、`Type Errors no errors`、exit 0 | `artifacts/sa3-issue449-stability-3x.log`（连续 3 次同结果，§7-D6 门 1+5） |
| 同上 + 447 三套件 + 448 套件（γ 五文件） | **57/57 passed**（43 基线 + 14 新增）、`Type Errors no errors`、exit 0 | `artifacts/sa3-issue449-gamma-suites.log`（§7-D6 门 2） |
| `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication/test` | **102 文件 / 911 用例 passed**（基线 101/897 + 新文件 14）、`Type Errors no errors`、exit 0 | `artifacts/sa3-issue449-package-suite.log`（§7-D6 门 3） |
| `npx tsc -p packages/ws-replication/tsconfig.json` | **exit 0**（空输出） | `artifacts/sa3-issue449-package-tsc.log`（§7-D6 门 4） |
| 隔离变异 M1：`onBootstrapAck` 接受一切（静默接受无锚 ACK） | 目标用例 `ANCHOR3-N1` **红**（`pumpUntil 未达谓词（响亮 connection-fatal）`）；生产树即时恢复 | `artifacts/sa3-issue449-mutation-M1-*.log`、`-mutation-summary.log` |
| 隔离变异 M2：`anchorSequenceOf` 把 pending 当 stamped（pending 被引用静默接受） | 目标用例 `ROUND3-C2` **红**（`pumpUntil 未达谓词（响亮收口 ERROR）`）；生产树即时恢复 | `-mutation-M2-*.log` |
| 隔离变异 M3：`onApplied` 在 ACK 到达时回填未回填的 chunked 锚（保序条款禁止形态） | 目标用例 `ROUND3-C3` **红**（`pumpUntil 未达谓词（响亮收口 ERROR）`）；生产树即时恢复 | `-mutation-M3-*.log` |
| 隔离变异 M4：`effectiveInFlightCount` 去 `pendingSends`（窗口裸占用） | 目标用例 `CHUNK3-C0` **红**（`中间回执零新 sent 事件: expected … to have a length of 1 but got 2`）；生产树即时恢复 | `-mutation-M4-*.log` |
| 变异后生产树一致性 | 4/4 恢复后 `git diff --quiet -- packages/ws-replication/src` 成立（`git diff --stat` 为空） | `-mutation-summary.log` 尾部「生产树恢复干净」 |

补充事实（证据重建口径，R3）：SA6 的 P-A…P-G 运行时证据来自已删除探针；本票以**落盘测试 + 上表重跑日志**重建同等证据面。契约矩阵在 baseline（HEAD）**预期全绿**（验收 + 回归哨兵），不伪称红灯；判别力由负控 + 上表隔离变异承担。

## Deferred verification（不在 SA3 职责内，显式移交）

1. 根门禁全量 `pnpm test` / `pnpm typecheck`（含 `*.test-d.ts` 类型套件）——CI/Host 收尾门与 #451（γ-T5）登记范围；本票仅按设计 §7-D6 跑包级门。
2. SA6/SA7 复跑（验收 / 标准复核）以本文件为可复跑证据面。
3. `#450`（γ-T4）面（连接账本 1011、close 冲刷 pending、`terminateUnauthorized`、OPEN 水位）未被本票锚定/触碰。
4. 设计 §13-R8 follow-up（γ `sendQueueMs` 携带、触发点③承重化）均另票；本票零钩子。

## Deviations or blockers

无阻塞（`verdict` 不提交）。实现阶段对设计/契约措辞的**事实性校正**与编排裁定如下（均未放宽任何判据，且逐条留证）：

- **D1（CHUNK3-P1 的 β 参照面）**：设计 §8.1 写「γ vs β（`issue424-sharded-hub` 同场同限额）」，但该夹具按其自身纪律（头注 6 / SA2-N2）**恒用公共冻结缺省 limits**，无法表达本票 T3 多 chunk 构型：实测其 hub→peer 在该构型下 `UPDATE_CHUNK = 0`（`artifacts/sa3-issue449-beta-reference.log`），用它作参照会退化为「两侧皆单帧」的平凡 parity。故 β 参照改用**进程内组合根单体**（`boot` 不传 `createHub` ⇒ 真 `createHubReplication`；与既有 #447 `CHUNK-C1/ROUND-C2 parity` 在分块构型下的选择同款），实测 hub→peer `UPDATE_CHUNK = 2`，parity 判据（控制帧逐字节 + 骨架 + 文档语义 + NC-1）逐条保留。
- **D2（ROUND3-C3 的步进粒度）**：设计 §7-D4 步骤 2 要求「队列头 = 末 kind=2 chunk 回执 ∧ `pending()[1]` = 对端 SYNC_APPLIED」。实查（确定性复现）：若 `sessionToEdge` 整批放行，hub 的两只 kind=2 chunk 与对端两只 chunk 会交错，`pending()[1]` 是**对端 chunk 帧**而非 SYNC_APPLIED。故用例改用**细粒度出站放行**（每步 `sessionToEdge.release(1)` + 微任务泵），使末 chunk 回执与其后到达的 SYNC_APPLIED **相邻**——设计 D4 的 in-place 断言（回执 tag 配对 + 次位帧 kind/回指序校验）因此逐字成立；违契注入（`reorderNext()` + `release(1)`）与「消费序 ACK 先于锚回执」断言不变。
- **D3（CHUNK3-C0 的「中间回执零 chunked-update-*」读法）**：`chunked-update-sent` 的发射点 = **末 chunk 出站结算**（`noteUpdateSent{chunked}`；SA6 §12.3 AC3 同款「末 chunk 回执结算，事件语义不变」），必然早于任何回执可放行的时刻。故该判据锚定为「中间回执**不新增**任何 chunked 事件（`sent` 仍恰一 + `acked` 恒 0）+ 零占位变化」，未以「sent 恒 0」这一与条款自相矛盾的读法削弱实现语义；`CHUNK3-C1`（kind=1）侧则严格断言中间回执 ⇒ **零 sent**（其 sent 发射点确实在末回执结算点）。
- **D4（DRAIN3-C1 的 kind 选择）**：契约 §12.3 允许 kind=1/2。用例取 **kind=2 单 chunk** 变体，使「队列第 2 笔」为单帧 live `UPDATE`，从而「ACK 放行 ⇒ 第 2 笔**恰一次**推出」可精确计数（kind=1/2 多 chunk 变体下第 2 笔会被再次分块，计数噪声掩盖判据）。DRAIN3-D1 诊断条目仍用 kind=1（与 SA6 P-C 同构型）。
- **D5（锚相位表述澄清，写入测试文件头注）**：分块形态（kind=1/2）下 γ 的锚在**末 chunk 回执结算回调**里才落 `stamped`，此前为 idle（undefined）而非 `pending(tag)`；判别单点 `anchorSequenceOf` 对 idle ∨ pending 同构 ⇒ 引用性 ACK 同样响亮。故 `ROUND3-C2/C3`、`ANCHOR3-N1` 的「pending 面」实质锚定 idle/pending 的**共同响亮判别**；单帧 `pending(tag)` 面由既有 #447 `ANCHOR-C2`/`CHUNK-C2` 锚定（不重复）。
- **D6（ABORT3-C1/C2 的收口补强）**：契约的零增长断言在「扣留缓冲未放行（close 信号不可达）」时点测量（与 SA6 P-B 编排一致）；用例**追加**放行被扣缓冲后的二次断言（仍零新出站、`unsealed === 0`、非 live），只加强不削弱。
- **D7（证据日志命名）**：本票新证据统一 `artifacts/sa3-issue449-*` 前缀；SA6 的 5 份基线日志保留未改（设计 §7-D2 末段）。

## Suggested commit message（仅供 Controller 选用；SA3 不执行 commit）

```text
test(ws-replication): anchor gamma reconcile and chunked transfer seam (#449)

- add packages/ws-replication/test/ws-replication-issue449-gamma-reconcile-chunked.test.ts
  (ROUND3 / ANCHOR3 / CHUNK3 / ABORT3 / DRAIN3; 14 cases covering SA6 §12.3 all 15 entries)
- zero production diff; fixture/harness/driver untouched
- evidence: contract file 14/14 (×3 stable), gamma 5-file 57/57, package 102 files/911 tests,
  package tsc exit 0, 4/4 isolated mutations detected (source restored clean)
```
