# SA10 Spec Review — issue #449（γ-T3）：reconcile 与分块 transfer 跨缝（`ownStep2Seq` 三态、chunked kind 0/1/2）

- Dispatch：`sa-317258f5-f6fc-41d5-8bc3-35b4fb0bbbb1`（mabf-sa10 / spec-review / iteration 0）。
- Worktree：`/home/wangjian/nomicore-fix-issue-449`，branch `mabf/issue-449`。
- 审查对象 = **committed final delivery diff `444c166..d166fd2`**（`d166fd2 test(ws-replication): cover gamma reconcile chunk transfer`，父提交 = Parent PR #446 head `444c1665fdb35b618bbb378a5b6bcefacfd288a7`，与派工声明一致，`git log` 实查）。
- Owner comments：派工明示 REST read = 空数组；简报 `## Comments` 空 ⇒ 无 owner 追加要求可映射。
- 审查方法：静态 spec 符合性审查——交付 diff、Issue 6 条 AC、批准 SA6 契约（§12.3 15 条目矩阵）、批准设计（§7-D1..D6）、规范权威（协议 §24 / ADR 0032 附录 A4 / 模块 AGENTS.md）、SA3/SA4/SA8 产物与证据日志逐项读回并对生产源码独立抽查。未运行任何测试/服务；未修改任何工件（本文件为 SA10 固定产物，新建）。
- **Verdict：`approve`**（0 BLOCKER；2 项 MINOR 不阻断，连同裁定性披露项一并列入 §7「PR 必须披露」）。

---

## 1. Reviewed inputs

| 输入 | 路径 | 状态 |
|---|---|---|
| 任务简报（Issue 正文 + 6 条 AC） | `wiki/raw/task_issue-449.md` | 在场；Comments 空 |
| SA6 验收契约（批准） | `wiki/raw/task_issue-449_sa6_contract.md` | 在场；`verdict: approve` + 反向诊断 + §12.3 15 条目矩阵（条目权威规格） |
| 批准设计（SA1） | `wiki/raw/task_issue-449_design.md` | 在场；§0 verification-only 裁定、§7-D2 交付物、§8.1 著写规格、§11 ALLOW/DENY |
| SA3 实现记录 | `wiki/raw/task_issue-449_sa3_impl.md` | 在场；15→14 逐条目映射 + D1–D7 偏差登记 + 验证门证据 |
| SA4 实现评审 | `wiki/raw/task_issue-449_sa4_review.md` | 在场；`approve` + 2 项 MINOR（O-1/O-2） |
| SA8 实现冲突复查 | `wiki/raw/task_issue-449_implementation_conflict_report.md` | 在场；`clear`（0 hard-conflict / 0 evolution-required）、`requiresConflictRecheck: false` |
| 实现本体 | `packages/ws-replication/test/ws-replication-issue449-gamma-reconcile-chunked.test.ts`（1129 行、5 describe、14 用例，grep 实数一致） | 全文实读 |
| 证据日志 | `artifacts/sa3-issue449-*.log`（10 份）+ `artifacts/sa6-issue449-*.log`（5 份） | 逐份读回（§5） |
| 规范权威 | `docs/protocols/instance-replication-v1.md` §24（:1091-1160）、`docs/adr/0032-transport-decoupling-edge-session-split.md` A4（:55-99）、`packages/ws-replication/AGENTS.md` | 原文实读 |
| 生产源码锚点 | `types.ts`、`round-engine.ts`、`hub-namespace.ts`、`hub-session-async-host.ts`、`update-channel.ts`、`bulk-transfer.ts` | 独立抽查（§4） |

## 2. 交付 diff 范围核实（scope creep 检查）

`git diff 444c166..d166fd2` 实查：

| 事实 | 结果 |
|---|---|
| 变更文件全集 | 1 测试文件（新增 1129 行）+ 5 份流水线 wiki 文档（设计/SA6 契约/SA3/SA4/SA8，新增） |
| tracked 文件修改（`--diff-filter=M`） | **0** |
| 删除行 | **0**（2213 insertions / 0 deletions） |
| `packages/ws-replication/src/**`、夹具（`issue447-async-seam.ts`/`issue448-live-seam.ts`/`harness.ts`/`driver.ts`）、`docs/**`、`CONTEXT.md`、`vitest.config.ts`、lockfile | **零 diff**（逐路径实查） |

⇒ 与设计 §7-D1 verification-only 裁定、§11 ALLOW LIST 逐项吻合；**无 scope creep**。证据日志（`artifacts/sa3-issue449-*`/`sa6-issue449-*`）在场但**未提交**（untracked）——是否随 PR 提交属 Host/Controller finalize 决定（#447 先例 `ea19c2b` 曾提交证据），非 spec 缺口，中性登记。

## 3. Issue AC 逐条核对（AC → 契约条目 → 交付用例 → 独立核实）

| Issue AC | SA6 §12.3 条目 | 交付用例（行号实读） | SA10 Assessment |
|---|---|---|---|
| AC1 `ownStep2Seq` 三态；sync round 全回合与 β wire 逐字节等价 | ROUND3-C1/C2/C3 + CHUNK3-P1（+ 既有 ROUND/CHUNK 族回归哨兵） | ROUND3 三例 @316-522；CHUNK3-P1 @829-880 | **满足**。三态载体（`types.ts:1036-1038` `SendAnchorState = pending(tag) ∨ stamped(sequence)`，idle=undefined；`round-engine.ts:135-145` 判别单点 `anchorSequenceOf` 对 idle∨pending 同构响亮）经 C1（stamped 正路：双向 `SYNC_APPLIED.ackedSequence` = 对端末 chunk 序）+ C2（`ownStep1Seq` 真 pending(tag) 面：丢回执 ⇒ `SYNC_STATE_VIOLATION` + failed + dropped 集事实 + 引用帧已过缝反假绿）+ C3（`ownStep2Seq` 分块 idle 面：reorder 注入 ⇒ 响亮 + 消费序 ACK 先于锚回执证据）三面相夹。β 逐字节等价经 CHUNK3-P1（T3 多 chunk 构型：控制帧逐字节 + 骨架含 UPDATE_CHUNK 帧型/帧序 + 文档语义 + NC-1 内容变异必差 + β 侧 UPDATE_CHUNK≥2 前置防平凡 parity）+ 既有 447 parity 回归锚定 |
| AC2 SYNC_APPLIED / BOOTSTRAP_ACK 保序锚（延迟注入编排：锚回填恒先于引用帧序的回答帧） | ANCHOR3-C1/N1、ROUND3-C3 | ANCHOR3 两例 @528-655；ROUND3-C3 @440-522 | **满足**。§24.2.3 保序条款的两面均锚：正路 C1 三步步进（① 中间回执仍 awaiting-ack 零 sent；② 末回执 stamped + sent 恰一；③ ACK 结算）+ `edgeToSession.delivered()` 消费序**末 chunk 回执 strict 先于** BOOTSTRAP_ACK（@605-619）；违契面 N1（丢全部 kind=1 chunk 回执 ⇒ `connection-fatal{ACK_STATE_VIOLATION}` + ERROR + 非 live）与 C3（乱序注入 ⇒ `SYNC_STATE_VIOLATION`）。编排 = 纯延迟注入（扣留/放行/reorder/丢回执），符合 AC 括号要求 |
| AC3 chunked kind 0 全回合：中间 chunk 零 inFlight / 零事件，末 chunk 回执结算（`chunked-update-sent`/`-acked` 语义不变） | CHUNK3-C0（+ 既有 `LIVE-DRAIN-C1`） | @661-768 | **满足**。中间回执：零占位变化（第 2 笔不过缝，`dataFramesOut` 不变）+ 零**新**事件（sent 恒恰一、acked 恒 0）；末回执：换键不换槽（仍 1 槽）；ACK：`chunked-update-acked` 恰一（`ackLatencyMs = k+m`、无 `sequence` 键）+ `UPDATE_ACK` 回指末 chunk 序 + 第 2 笔恰一次续推（新 transferId、chunkIndex 0 起）。「零新事件」读法的生产事实基础独立核实：`update-channel.ts:585-598` sent 发射于末 chunk**推送**结算同步段（`noteUpdateSent{chunked}`），中间 chunk（`:618-619`）零注册零事件——与 §23.1 键集/发射点冻结逐字同向（SA3-D3 校正成立）；M4 变异（去 `pendingSends` ⇒ 断言红「expected 1 but got 2」）证明判牙 |
| AC4 chunked kind 1/2（bootstrap / sync diff）全回合 | CHUNK3-C1/C2（=ROUND3-C1） | @770-827；@316-389 | **满足**。kind=1：每 chunk 独立 tag（Set 去重）∧ 每 tag 恰一回执 ∧ `receipt.sequence = wire [8..12]` 原字节读回；中间回执 no-op（零 sent——kind=1 sent 发射点确在末回执结算，`bulk-transfer.ts:262-275` 实读）；末回执 sent 恰一；BOOTSTRAP_ACK 回指；live+收敛。kind=2 多 chunk 全回合见 AC1 行（双向 chunkIndex 0..k-1/chunkCount=k/单 transferId/双向回指/事件恰一/live+语义等） |
| AC5 连接死亡 → transfer 整体 abort；无洞中 transfer 形态锚（连接存活 ⟹ 逐 chunk 已盖章） | ABORT3-C1/C2/C3/N1 | @886-1022 | **满足**。§24.5/A4.3 两形态均锚：死亡面（`closePeerSide(1006)`）——kind=1（C1）与 kind=2（C2）在途均为：缝出站/hub→peer wire/session→edge 三面零增长、零 `settled`、`unsealed === 0`、零 chunked-sent/acked、非 live；C1 追加放行被扣 close 后二次断言（只加强）；C3 重连新作用域（`transferId === 1` ∧ chunkIndex 0 起严格递增 ∧ 旧 transfer 零续传 ∧ 新会话独立收敛 live）。存活对照 N1（结算恰一 + live + 零响亮 + `unsealed===0`）证明 abort 断言非空；「连接存活 ⟹ 逐 chunk 已盖章」另由 CHUNK3-C1 逐 chunk 回执配对锚定 |
| AC6 drain 第三触发点（末 chunk 回执）落地 | DRAIN3-C1/D1 | @1028-1128 | **满足（按批准设计的 dormant 裁定）**。触发点③结构性在场（`hub-session-async-host.ts:174-176` 实读：`settledTransferLastChunk === true ⇒ selfDrain()`；§24.6 明文命令「触发点 = 入队 / ACK 到达 / transfer 末 chunk 回执」的在场性兑现）。C1 锚行为边界（末回执结算后零新增 data 帧、`scheduler.pending()` 不增、零 acked、第 2 笔不过缝；ACK 放行 ⇒ 第 2 笔恰一次推出）；D1 锚承重性诊断（隔离变异 `BulkTransferSender.prototype.onReceipt` 照常结算但 `return false` ⇒ 轨迹/事件/收敛**逐值相同**，变异生效计数 > 0，`finally` 恢复原型）。**披露义务**：触发点③在现态机**非承重**（dormant 保险丝，规范超集读法，承 #448 SA10 D2 先例；欲承重须 §24.4 amendment 另票）——见 §7-D1 |

**AC 结论：6/6 满足**（AC6 按批准设计 §7-D3 的 dormant 登记口径满足；该口径已经 SA8 冲突门裁 `no-conflict`，本审查独立核对 §24.6 原文确认其只命令触发点在场 + 推完即停，未命令承重性）。

## 4. 规范符合性独立抽查（SA10 亲自读源，非转述上游）

| 规范条款 | 抽查点 | 结果 |
|---|---|---|
| §24.4 / A4.2（两相记账、锚三态、换键不换槽、违契响亮禁 park） | `round-engine.ts:135-161`（anchorOf/anchorSequenceOf/onSendReceipt）、`hub-namespace.ts:738-746`（onSendReceipt 四面 fan-out）、`types.ts:1036-1048` | 与契约/设计声称逐点一致；三态判别单点真实承重（M2/M3 变异检出佐证） |
| §24.2.3（回执恒先于引用该序的 ACK） | ANCHOR3-C1 消费序 strict 先行断言 @605-619；ROUND3-C3 违契消费序证据 @505-521 | 断言口径 = 单通道 `delivered()` 消费序，符合 §24.8「跨线程事件无全序」的适用域限定 |
| §24.5 / A4.3（无洞中 transfer：存活 ⟹ 逐 chunk 盖章；死亡 ⟹ quiesce 整体 abort） | ABORT3 四例 + `probes.unsealed === 0` 三面断言 | 一致 |
| §24.6 / A4.4（drain 三触发点；推完即停禁 busy loop） | `hub-session-async-host.ts:150-152`（②）、`:174-176`（③）、`:271-277`（`while(pullAndSendOne())`）实读；DRAIN3-C1 `scheduler.pending()` 不增断言 | 一致；触发点③非承重为诚实登记（非条款修订） |
| §24.8 / A4.7（chunked 族事件在 session 回执/结算点；`ackLatencyMs` t0=推送时刻；键集冻结） | ANCHOR3-C1 @600（k+m）、CHUNK3-C0 @746（k+m）、`not.toHaveProperty('sequence')` @377/:745 | 一致（kind=2 的 `ackLatencyMs` 在场断言缺席 = O-1，§6） |
| A4.8（成功路径 β wire 逐字节等价；延迟可注入显式异步内存管道、零 worker_threads；既有矩阵全绿硬门） | CHUNK3-P1 + γ 五文件 57/57 + 包全量 102/911；grep 实查测试文件零 `skip/only/todo`、零 `process.env`、零真实 timer/`worker_threads`/`Date.now` | 一致 |
| §24.3 / A4.1（缝词汇 append-only 闭集合；β 冻结） | 交付 diff 零生产/零夹具改动 ⇒ 词汇面、β 面逐字节不动 | 一致 |
| 模块 AGENTS「Verification」（缝变更另跑拆分契约/parity；wire/lifecycle 变更跑根门禁） | 零生产/wire/lifecycle 变更 ⇒ 根门禁触发条件不满足；SA3 已超额跑包级门；根门禁移交 CI/#451 已登记 | 一致 |
| §10.3（transferId 作用域 (连接,方向,namespace)，新作用域从 1 严格递增） | ABORT3-C3 @989-998 | 一致 |

## 5. 证据日志核实（逐份读回）

| 日志 | 声称 | SA10 读回结果 |
|---|---|---|
| `sa3-issue449-stability-3x.log` | 契约单文件 14/14 ×3、Type Errors no errors | 三段输出逐段一致 ✓（§7-D6 门 1+5） |
| `sa3-issue449-gamma-suites.log` | γ 五文件 57/57（43 基线 + 14 新增） | 逐文件列出（14+13+15+7+8=57）、exit 绿 ✓（门 2） |
| `sa3-issue449-package-suite.log` | 包全量 102 文件/911 用例、Type Errors no errors | 计数行在场、逐文件列表含本票文件、typecheck 2.42s ✓（门 3） |
| `sa3-issue449-package-tsc.log` | exit 0 | **空文件（0 字节）**——单独不足证 exit 0；两份套件日志的 vitest typecheck「no errors」+ 包 tsconfig 含 `test/**` 构成充分旁证（SA4 同款观察；证据留档质量 MINOR，见 §6-O3） |
| `sa3-issue449-mutation-summary.log` + M1–M4 | 4/4 隔离生产变异被目标用例检出（exit=1）、生产树逐例恢复干净 | 四段「reverted clean」+ 尾部「生产树恢复干净」在场 ✓（敏感性有牙：M1→ANCHOR3-N1、M2→ROUND3-C2、M3→ROUND3-C3、M4→CHUNK3-C0） |
| `sa3-issue449-beta-reference.log` | D1 偏差的事实证据 | issue424 夹具在 T3 构型下 UPDATE_CHUNK=0（平凡 parity）vs 组合根单体 UPDATE_CHUNK=2 ✓ |
| `sa6-issue449-*.log`（5 份基线） | 43/43、101/897、probe 7/7×3 | 在场未被改写；本票交付后基线由 SA3 日志重建（57/57、102/911）✓（R3 证据重建立账） |

## 6. 偏差与 MINOR 项（均不阻断；列入 PR 披露）

**SA3 D1–D7 偏差逐项复核**（对照源码/先例独立验证）：全部为事实性校正或只加强不削弱——D1（β 参照改进程内组合根单体：issue424 夹具结构性无法表达多 chunk 构型，有日志留证；**#447 `CHUNK-C1/ROUND-C2 parity（分块构型）` 同款先例**，该用例标题实读 @547 确认；测试内 β 侧 UPDATE_CHUNK≥2 前置断言防平凡 parity；A4.8 判据实质零削弱）、D2（ROUND3-C3 细粒度步进：使设计 §7-D4 的交换点在场断言逐字可满足，判据不动）、D3（kind=0「中间回执零事件」= 零**新**事件：生产发射点事实 @update-channel.ts:585-598 实读确认，契约字面读法自相矛盾，M4 变异证明判牙）、D4（DRAIN3-C1 取 kind=2 单 chunk：契约明文允许 kind=1/2，使「第 2 笔恰一次」可精确计数；D1 诊断条目仍用 kind=1 与 P-C 同构）、D5（分块形态锚相位澄清：idle 非 pending，`round-engine.ts:293-311` 实读确认；判别单点同构 ⇒ 判据未削弱；单帧真 pending 面由既有 #447 锚 + 本票 ROUND3-C2 锚定；测试头注 @307-314 诚实披露）、D6（ABORT3-C1 追加收口二次断言：只加强）、D7（日志前缀：中性）。

**MINOR / 观察项**：

- **O-1（MINOR，承接 SA4 O-1，本审查独立确认）**：SA6 §12.3 `ROUND3-C1` 判据含「`ackLatencyMs` 在场」，交付的 kind=2 族用例（ROUND3-C1/DRAIN3-C1）未注入 `hubClock`（`driver.ts:525` 实读：仅显式传入才注入 clock）⇒ 该字段结构性缺席、无任何 kind=2 用例断言之；impl 映射表以「字节字段在场」未宣告地代换此判据（著写漂移轻量实例）。实际覆盖缺口小：t0=推送时刻语义已由 kind=1（ANCHOR3-C1 `k+m`）与 kind=0（CHUNK3-C0 `k+m`）锚定，kind=2 事件发射点为同构回调形态。**AC1/AC4 本体不受影响**（AC 未要求该字段）；属契约判据的单断言缺口。处置：PR 披露 + follow-up 补强（一行：kind=2 用例注入 `hubClock` 断言 `ackLatencyMs` 在场或 `= k+m`），routing = implementation follow-up，不阻断本票验收。
- **O-2（MINOR，承接 SA4 O-2，实读确认）**：ABORT3-C1 @893 采样 `timers: scheduler.pending()` 但未对其断言（死观察变量；计时器面断言由 DRAIN3-C1 承载）。无判力影响，建议清理。
- **O-3（证据留档质量，非 finding）**：`sa3-issue449-package-tsc.log` 为空文件，未记录命令与 exit 码；旁证充分（§5），建议后续留档在日志头部记录命令与 exit 码。
- **观察（非 finding）**：SA6 §2/§6-NC7 的「ANCHOR3-C2/N2」标签在权威清单 §12.3/§12.4 不存在（契约草稿残留）；交付覆盖 §12.4 权威映射即满足 AC2。SA6 「pending 面」措辞在分块场景实为 idle（D5 已在测试头注诚实登记，SA8 注记 2 同款登记），后续引用契约时应以该登记为准。

## 7. PR 必须披露的未达成/裁定项（disclosure checklist）

1. **D1（裁定性披露）**：AC6「drain 第三触发点落地」按批准设计 §7-D3 交付为 **dormant 保险丝**——触发点结构性在场且被调用（§24.6 明文命令满足），但在现态机**非承重**（末 chunk 回执不释放槽位：§24.4 换键不换槽 = 占用守恒；facet 仲裁 `hasWork()` 挡住续推）；DRAIN3-D1 隔离变异证明轨迹逐值不变。使其承重 = §24.4 amendment，**另票另裁**（设计 §13-R8 登记）。此为「规范命令超集 ⇒ 规范内满足」读法（#448 SA10 D2 先例，SA8 两轮 no-conflict）。
2. **D2（MINOR 缺口披露）**：kind=2 族 `ackLatencyMs` 在场断言缺席（O-1）——契约判据的单断言缺口，AC 本体满足；建议 follow-up 补强。
3. **D3（ deferred verification 披露）**：根门禁全量 `pnpm test` / `pnpm typecheck`（含 `*.test-d.ts`）未在本票执行——按分工属 CI/Host 收尾门与 #451（γ-T5）登记范围（SA3 §Deferred-1；模块 AGENTS 根门触发条件「wire 或 lifecycle 变更」本票不满足）；SA6/SA7 复跑以落盘测试为证据面（§Deferred-2）。
4. **D4（边界披露）**：#450（γ-T4：连接账本 1011、close 冲刷 pending、`terminateUnauthorized`、OPEN 水位）面未被本票锚定/触碰——ABORT3 仅锚 `closePeerSide(1006)` 异常断链形态 + 重连新作用域（设计 §11 DENY 固化，防越界）。
5. **D5（证据形态披露）**：运行时证据 = 落盘测试 + SA3 重跑日志；SA6 探针（P-A…P-G）为已删除临时脚本的运行记录，已由落盘测试重建同等证据面（R3 闭合）。`artifacts/sa3-issue449-*`/`sa6-issue449-*` 日志在 worktree 在场但**未提交**（是否随 PR 提交属 finalize 决定）。
6. **D6（偏差披露）**：SA3 D1–D7 七项事实性校正/编排裁定（§6 首段），其中对契约/设计字面措辞有偏离的为 D1（β 参照载体）、D3（kind=0 零事件读法）、D5（锚相位措辞）——均经 SA4/SA8 核实为吻合规范/既定先例/只加强，本审查独立复核确认。

## 8. 结论

- 交付 diff 忠实满足 Issue #449 全部 6 条 AC（AC6 按批准设计的 dormant 登记口径）、SA6 §12.3 全 15 条目（15→14 用例的同构合并经设计 §7-D2 明文允许且判据未合并削弱）、规范权威 §24/A4 逐项吻合（独立抽查 10 条款全部一致）。
- 无遗漏、无错误实现、无 scope creep（纯新增：1 测试文件 + 流水线文档；零 tracked 修改、零生产 diff、零夹具 diff）。
- 2 项 MINOR（O-1 kind=2 `ackLatencyMs` 断言缺口、O-2 死观察变量）+ 1 项证据留档质量观察（O-3）——均不阻断 approve，已全部列入 §7 披露清单。
- **Verdict：`approve`**。
