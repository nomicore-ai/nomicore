# SA4 Implementation Review — issue #449（γ-T3）：reconcile 与分块 transfer 跨缝

- Dispatch：`sa-9d7f3006-076d-4cf0-97f9-83d9d4989cbe`（mabf-sa4 / implementation-review / iteration 0）。
- Worktree：`/home/wangjian/nomicore-fix-issue-449`，branch `mabf/issue-449`，HEAD `444c166`。
- **Verdict：`approve`**（无 BLOCKER/MAJOR；2 项 MINOR 见 Non-blocking observations，不阻断）。
- 审查方法：静态实现审查 + 证据日志逐份读回 + 断言面与生产源码逐点交叉核对。未运行任何测试/服务/临时进程；未修改任何工件（本文件为 SA4 固定产物，新建）。

---

## 1. Reviewed inputs

| 输入 | 路径 | 状态 |
|---|---|---|
| 任务简报 | `wiki/raw/task_issue-449.md` | 在场；6 条 AC；Comments 空（派工明示 REST read = empty array） |
| 批准设计（SA1） | `wiki/raw/task_issue-449_design.md` | 在场；§0/§7-D1..D6/§8.1/§11/§12/§13 为审查基准 |
| SA6 验收契约 | `wiki/raw/task_issue-449_sa6_contract.md` | 在场；§12.3 15 条目矩阵 = 条目权威规格 |
| SA3 实现报告 | `wiki/raw/task_issue-449_sa3_impl.md` | 在场；含逐条目映射、验证门证据、7 项偏差登记 |
| SA2 评审 / SA8 产物 | `wiki/raw/task_issue-449_sa2_review.md` 等 | 不存在（iteration 0；设计 §6/§14 已登记同款事实，非阻塞） |
| 实现本体 | `packages/ws-replication/test/ws-replication-issue449-gamma-reconcile-chunked.test.ts`（1129 行，14 用例） | 实读全文 |
| 证据日志 | `artifacts/sa3-issue449-*.log`（9 份）+ `artifacts/sa6-issue449-*.log`（5 份） | 逐份读回 |
| 生产源码锚点 | `round-engine.ts`、`hub-namespace.ts`、`hub-session-async-host.ts`、`update-channel.ts`、`bulk-transfer.ts`、`defaults.ts`、`validate.ts` | 逐段实读交叉核对 |
| 夹具 / 助手 | `test/issue447-async-seam.ts`、`driver.ts`、`harness.ts`、447/448 既有测试 | 实读（API 面与先例判据） |
| 模块规约 | `packages/ws-replication/AGENTS.md`（Boundary/Verification）、ADR 0032 A4、协议 §24 | 经设计 §6 约束表核对 |

## 2. Verdict

**approve**。核心理由（逐项证据见下文各表）：

1. **文件范围零违规**：`git status --porcelain` 实查 = 仅 ALLOW 清单内新增（1 测试文件 + 9 份 `sa3-issue449-*` 证据日志）+ 流水线 wiki 工件；**零 tracked 文件改动**（`packages/ws-replication/src/**`、夹具、既有测试、docs、根配置全部零 diff）——verification-only（设计 §7-D1）忠实落实。
2. **契约 15 条目 → 14 用例全覆盖且判据未削弱**：CHUNK3-C2 并入 ROUND3-C1 为设计 §7-D2 明文允许的同构合并（用例标题显式并列双 ID，判据未合并删减）；其余 14 条目逐一映射，恰 N 帧/恰一事件/strict 先行/`unsealed === 0`/`transferId === 1`/无 `sequence` 键/`[8..12]` 原字节等判据逐条在场。
3. **著写纪律全部满足**：零 skip/only/todo（grep 实查零命中）、零 env override、零真实 timer/网络/wall-clock、变异 `finally` 恢复原型；30s/60s 用例超时与 447/448 既有惯例一致（15/13/14 处）。
4. **7 项偏差（D1–D7）逐项核实为事实性校正或加强，无一放宽判据**（详见 §4 表）。
5. **敏感性有牙**：4/4 隔离生产变异被目标用例检出（exit=1、目标用例红、生产树逐例恢复干净）；CHUNK3-P1 内嵌 NC-1 内容变异；DRAIN3-D1 变异生效计数 > 0。
6. **验证门证据真实可复核**：单文件 14/14 ×3、γ 五文件 57/57（43 基线 + 14 新增，日志逐文件列出）、包全量 102 文件/911 用例、vitest typecheck「no errors」；`tsconfig.json` include 含 `test/**/*.ts` ⇒ tsc 门覆盖新文件。

## 3. 上游要求落实

Issue comments = 空（派工明示 + 简报 `## Comments` 空）⇒ 无 owner 评论要求可映射。Issue 6 条 AC → 设计 §4 → SA6 §12.3 → 用例的链路核对：

| Issue AC | 契约条目（SA6 §12.3） | 实现证据（用例 @ 行） | Assessment |
|---|---|---|---|
| AC1 `ownStep2Seq` 三态 + β 逐字节等价 | ROUND3-C1/C2/C3 + CHUNK3-P1 | ROUND3-C1 @316-389（含 CHUNK3-C2 并列）；C2 @391-438；C3 @440-522；P1 @829-880 | 落实。三态判别经 C2（ownStep1Seq pending 面，真 `pending(tag)`）+ C3（分块 ownStep2Seq idle 面）+ 正路 stamped 面锚定；`anchorSequenceOf` 对 idle∨pending 同构（源码 `round-engine.ts:143-145` 实读）⇒ 判别单点被两侧夹击。P1 以 T3 多 chunk 构型补齐 parity（见 D1 裁定） |
| AC2 SYNC_APPLIED / BOOTSTRAP_ACK 保序锚 | ANCHOR3-C1/N1、ROUND3-C3 | C1 @528-625（三步步进 + 头部在场断言 + 消费序 strict 先行 + `ackLatencyMs = k+m`）；N1 @627-655；C3 @440-522（交换点在场断言 + `reorderNext` + 消费序 ACK 先于回执证据） | 落实。设计 §7-D4 的交换点在场断言逐字落地（@484-492：head=末 chunk 回执 ∧ second=SYNC_APPLIED ∧ 回指序校验） |
| AC3 kind=0 全回合（中间零 inFlight/零事件、末回执结算） | CHUNK3-C0 | @661-768 | 落实。中间回执零占位/零新事件 + 末回执换键不换槽（仍 1 槽、data 帧数不变）+ ACK 结算恰一（`k+m`、无 `sequence` 键）+ 第 2 笔恰一次续推（新 transferId、chunkIndex 0 起）。M4 变异证明「零新事件」计数断言有牙 |
| AC4 kind=1/2 全回合 | CHUNK3-C1、CHUNK3-C2(=ROUND3-C1) | C1 @770-827 | 落实。每 chunk 独立 tag（Set 去重断言）、每 tag 恰一回执、`receipt.sequence = wire [8..12]` 原字节读回、中间回执零 sent、末回执 sent 恰一、ACK 回指、live+收敛 |
| AC5 连接死亡整体 abort / 无洞 / 不续传 | ABORT3-C1/C2/C3/N1 | C1 @886-918；C2 @920-945；C3 @947-1004；N1 @1006-1022 | 落实。零增长（缝出站/wire/session→edge 三面）、零 settled、`unsealed === 0`、零 chunked-sent/acked、非 live；C1 追加放行被扣 close 后二次断言（D6 加强）；C3 重连新作用域 `transferId === 1` ∧ chunkIndex 严格 0 起 ∧ 旧 transfer 零续传；N1 存活对照证明 abort 断言非空 |
| AC6 drain 第三触发点 | DRAIN3-C1/D1 | C1 @1028-1068；D1 @1070-1128 | 落实（按设计 §7-D3 dormant 登记）：末回执结算后零新增 data 帧/`scheduler.pending()` 不增/零 acked；ACK 放行 ⇒ 第 2 笔恰一次（`UPDATE` 恰 1）；D1 隔离变异轨迹逐值相同 + 生效计数 > 0 + `finally` 恢复 |

SA2 评审不存在（iteration 0）⇒ 无 SA2 Required revisions 可映射；设计内固化的前序约束（E1 fix-before-green、E4/E5 断言不削弱）按 §4 表核对落实。

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| §7-D1 verification-only（零生产 diff） | `git status`：`src/**` 零 tracked 改动；变异 M1–M4 逐例「reverted clean」+ 汇总日志「生产树恢复干净」 | 落实。变异是临时注入且即时恢复，最终生产树与本票交付一致 | — |
| §7-D2 按矩阵新著单文件 + 逐条目映射 | 测试文件五族 14 用例；impl 报告「契约条目 → 用例映射」表 | 落实。15→14 合并仅 CHUNK3-C2⊂ROUND3-C1（设计明文允许）；映射表逐条可对到用例行号 | — |
| §7-D2 著写纪律（零 skip/only/todo/env/真实 timer；变异 finally 恢复；零跨线程事件序断言） | grep 全文零命中禁用模式；`makeManualClock`/显式 `release`/微任务泵；事件断言全为单事件字段值；D1 @1121-1127 `try/finally` 恢复 | 落实。`microPump` 的 catch 仅吸收自调 `settleUntil(预算耗尽)`（实读 `harness.ts:257-268`），非吞断言 | — |
| §7-D3 dormant 保险丝登记（零行为变更） | DRAIN3-D1 诊断条目照 P-C 同构型落盘（kind=1、`onReceipt` 返回值隔离）；触发点③源码在場未动（`hub-session-async-host.ts:174-176` 实读：`settledTransferLastChunk === true ⇒ selfDrain()`） | 落实。未删除、未使承重、诚实登记非承重 | — |
| §7-D4 ROUND3-C3 编排（步进 + 交换点在场断言 + reorder + release(1)） | @444-522 | 落实，含 D2 事实性校正：细粒度出站放行（每步 `sessionToEdge.release(1)`）使设计步骤 2 的 head/second 断言**逐字可满足**（批量放行下 `pending()[1]` 会是对端 chunk 帧——SA3 以确定性复现实查并留证）。判据未削弱，反假绿装置在场 | — |
| §7-D5 夹具冻结 + 文件内局部 boot | `issue447-async-seam.ts`/`issue448-live-seam.ts`/`harness.ts`/`driver.ts` 零 diff；`bootGamma` @119-166 自带局部 boot（`waitFor:'none'` + `random: () => 0.5` + registry 同一性前提断言 + 唯一连接键断言，#447 `bootAsyncRound` 先例同款） | 落实。测试所用夹具 API（`setHeld`/`release`/`pending`/`delivered`/`dropped`/`setDropPredicate`/`reorderNext`/`withholdEdgeToSession`/`dropReceipts`/probes 五面/解码族）逐一经 fixture 源实读确认**全部既有**（@141-246、@600-616） | — |
| §7-D6 五道验证门 + 证据重建（R3） | 9 份 `sa3-issue449-*` 日志：单文件 14/14 ×3（stability-3x 三段输出）、γ 57/57、包 102/911、tsc（空输出）、mutation-summary + M1–M4 | 落实。日志内部自洽（逐文件列表、计数行、exit 码）；SA6 基线 5 份日志读回未改（101/897、43/43、probe 7/7 与契约 §4/§5 声明一致） | — |
| §13-R6 构型约束链（过 `validate.ts:238-262` 门） | 四组限额常量 @55-91；`defaults.ts:30` `maxChunksPerUpdate: 64` ⇒ 64≤64×1、1024≤64×64、4096≤64×64、1024≤64×16 全部满足 | 落实 | — |
| §13-R1/R2 反假绿 / 著写漂移防线 | 交换点/缓冲头在场断言（C3 @484-492、ANCHOR3-C1 @569-573/584-590、CHUNK3-C0 @717-723）；M1–M4 变异检出 | 落实（一处判据代换未宣告，见 Non-blocking observations O-1） | MINOR |
| D1–D7 偏差（impl 报告登记） | 逐项核实见下 | 全部为事实性校正或只加强不削弱 | — |

**偏差核实明细**（SA4 独立源码/日志验证）：

| 偏差 | SA4 核实证据 | 结论 |
|---|---|---|
| D1（β 参照改进程内组合根单体） | `sa3-issue449-beta-reference.log`：issue424 夹具在该构型下 hub→peer 骨架 `UPDATE_CHUNK = 0`（无法表达 T3 多 chunk）；组合根单体 `UPDATE_CHUNK = 2`；#447 既有 `CHUNK-C1/ROUND-C2 parity（分块构型）`（@547）本就用组合根 β —— 同款先例。测试内**前置断言 β 侧 `UPDATE_CHUNK ≥ 2`**（@843-846）防平凡 parity；控制帧逐字节 + 骨架 + 文档语义 + NC-1 判据逐条保留 | 合理，不削弱 |
| D2（ROUND3-C3 细粒度步进） | 设计 §7-D4 步骤 2 的 head/second 在场断言在测试中逐字成立（@484-492 含回指序校验）；交换注入与消费序断言不变 | 合理（编排手段修正，判据不动） |
| D3（kind=0「中间回执零事件」= 零**新**事件） | 生产事实：`update-channel.ts` `sendOneChunk` isLast 分支在**推送同步段**即 `noteUpdateSent({chunked})`（实读 @585-612）⇒ 中间回执可放行时 sent 必已=1；契约原文「零 chunked-update-*」在该发射点下自相矛盾，SA3 读法保留判牙——M4 变异下断言红（「expected 1 but got 2」）证明计数断言敏感。kind=1 侧则严格断言中间回执 ⇒ 零 sent（@807，其发射点确在末回执结算，`hub-namespace.ts` `onLastChunkSent` 实读） | 合理，判牙经变异证明 |
| D4（DRAIN3-C1 取 kind=2 单 chunk） | 契约 §12.3 该条目明文「kind=1/2 在途」任选；单 chunk 使「第 2 笔恰一次」可精确计数（`UPDATE` 恰 1，@1066）；D1 诊断条目仍用 kind=1（与 P-C 同构） | 合理 |
| D5（分块形态锚为 idle 非 pending） | 生产事实：`sendStep2` 出站前清锚、分块分支由末 chunk 回执结算回调回填（`round-engine.ts:293-311` + `noteChunkedStep2Outbound` 头注明示「γ 下调用点迁至末 chunk 回执结算」）；`anchorSequenceOf` 对 idle∨pending 同构 ⇒ 判别单点不变；单帧 `pending(tag)` 面由既有 #447 `ANCHOR-C2`（@225）/`CHUNK-C2 负控`（@609）锚定（实读在场）。测试头注 @307-313 诚实披露 | 合理（与设计 §2 锚点表自身一致；SA6 矩阵「pending 面」措辞为宽松指称） |
| D6（abort 后放行 close 二次断言） | @911-917 仅追加断言（仍零新出站/`unsealed===0`/非 live） | 只加强 |
| D7（日志前缀） | 中性事实 | — |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| 契约矩阵落盘（本票唯一交付面） | 实现阶段（设计 §7-D2） | 新测试文件单点承载，无第二实现 | ✓ |
| 三态锚/结算/abort/drain 语义 | 生产代码（#447 T1 交付面） | 零改动；测试只观察 | ✓ 未越权替产线修任何面 |
| 编排能力 | 既有夹具（H8 冻结面） | 全部复用既有 API，零 append | ✓ |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| γ 回合测试 boot 形态 | #447 `bootAsyncRound`（`waitFor:'none'` + registry 同一性断言） | `bootGamma` 同款 + 唯一连接键断言 | 一致 | 设计 §7-D5 指定先例 |
| β parity 判据（分块构型） | #447 `CHUNK-C1/ROUND-C2 parity`（组合根 β 单体） | CHUNK3-P1 同款判据（逐字节/骨架/语义/NC-1） | 一致 | D1 偏差即以此先例为据 |
| 隔离变异诊断 | SA6 P-C 探针（原型变异 + finally 恢复） | DRAIN3-D1 同构落盘 | 一致 | 探针临时证据转正为可复跑工件 |
| 乱序注入 | #448 `LIVE-ORD-C2`（reorderNext） | ROUND3-C3 复用同款注入 | 一致 | 设计 §6/§7-D4 指定 |
| 测试直读 `../src/*` | issue169/issue423/guard-proxy 既有测试 | DRAIN3-D1 动态 `import('../src/bulk-transfer.js')` | 一致 | 仓库既有惯例（grep 实证） |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| tag↔sequence 配对 | `probes.stamps`/`probes.outbound`（edge 盖章事实） | 测试内 `stampOfSequence`/`tagOfOutboundKind` 只读查询 | 无（只读，不改行为） |
| 消费序 | `edgeToSession.delivered()` | 断言面 | 无 |
| 违契注入事实 | `dropped()`/`setDropPredicate` | ROUND3-C2 ①断言 | 无 |

无第二缓存/marker/状态反推；无旁路 RPC。

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| `bootGamma` 建连/会话/observer | ABORT 族锚 close/quiesce/teardown；D1 变异 `finally` 恢复原型 | 断言失败即红，无吞错 | ✓ 测试自身无遗留资源（进程内内存管道 + fake scheduler，进程结束即回收；`settleUntil` 泵在 `driver.ts` 注册的 defer pump 由 run 持有） |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 第二 boot 助手 | `bootAsyncRound`（447 文件内） | `bootGamma` 为**本文件局部**助手（设计 §7-D5 明文要求文件内局部 boot，非公共夹具 append） | 非平行机制（设计指定形态；不触碰冻结夹具面） |
| 第二事件观察面 | `makeAsyncObserver`（夹具既有） | 复用 | ✓ |
| 第二时源 | `makeManualClock` | 测试内联 clock 对象（`hubClock` 注入 seam 既有） | 可接受（等价于手动时钟；经既有 `clock` seam 注入，非新时源词汇） |

## 6. 文件范围审查

`git status --porcelain` 实查（HEAD `444c166`，branch `mabf/issue-449`）：**零 tracked 文件修改**；untracked 全集如下。

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/ws-replication/test/ws-replication-issue449-gamma-reconcile-chunked.test.ts` | §11 ALLOW 第 1 行（唯一可执行交付物） | AC1–AC6 验收锚 | ✓ 新增（1129 行） |
| `artifacts/sa3-issue449-{gamma-suites,package-suite,package-tsc,stability-3x,mutation-summary,mutation-M1..M4-*,beta-reference}.log`（9 份） | §11 ALLOW 第 3 行（本票前缀新日志） | §7-D6 证据重建 + 敏感性 | ✓ 新增 |
| `wiki/raw/task_issue-449{,_design,_sa6_contract,_sa3_impl}.md` | 流水线产物（设计 §11 末段：各自 dispatch 授权） | 简报/设计/契约/实现报告 | ✓ 非本 dispatch 改动面 |

DENY LIST 逐项：`src/**` 零 diff；`issue447-async-seam.ts`/`issue448-live-seam.ts`/`harness.ts`/`driver.ts` 零 diff；既有 `*.test.ts`/`*.test-d.ts` 零 diff；`docs/**`/`CONTEXT.md`/`AGENTS.md`/`replication-protocol/**`/根配置/lockfile 零 diff；SA6 五份基线日志内容读回与契约声明一致（未被改写）；`.scratch/` 仅剩仓库既有 `vfsl-v1-parser/spec.md`（SA3 临时探针已删，与报告声明一致）。**无越界。**

## 7. 契约连锁审查

本票零生产改动 ⇒ 生产 caller 面逐字节不变（设计 §10）。测试工件自身的「连锁」：

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| 根 vitest 采集（`include = ['packages/*/test/**/*.test.ts', …]`，实读 `vitest.config.ts:15`） | 新文件逐字命中；包全量日志实列 102 文件含本文件 | 无配置改动 | 无 | — |
| 类型门（`packages/ws-replication/tsconfig.json` include 含 `test/**/*.ts`，实读） | `tsc -p` 门覆盖新文件；vitest typecheck「no errors」双证 | 无 | 无 | — |
| γ 五文件回归面（43 基线） | 57/57（43+14） | 夹具零改动 ⇒ 无回归源 | 无 | — |
| 事件键集冻结（chunked 族无 `sequence` 键；§24.8） | ROUND3-C1/CHUNK3-C0 `not.toHaveProperty('sequence')` 断言 | 锚定而非破坏 | 无 | — |
| #450/#451 边界 | ABORT3 仅 `closePeerSide(1006)` 异常断链 + 重连新作用域；未触 revoke/1011/`update-sent` 归属 | 无越界 | 无 | — |

## 8. 错误、恢复与并发

被锚定的既有失败语义（验证对象）与测试工件的失败纪律：

- **响亮收口锚定**：ROUND3-C2/C3（`SYNC_STATE_VIOLATION` + `failed` + 有限泵必达 `pumpUntil`）、ANCHOR3-N1（`connection-fatal{ACK_STATE_VIOLATION}` + ERROR + 非 live）——零 park/零静默接受均有对抗性证据（dropped 集事实 + 引用帧已过缝 + 消费序 ACK 先于锚回执）。
- **abort 非空断言**：ABORT3-N1 存活对照（结算恰一 + live + 零响亮）排除「断言恰好没观察到」。
- **确定性并发**：全部编排 = 同步内存队列 + 显式 `release` + 微任务泵；SA3 逐用例读回的关键顺序（如 `driveChunkedStep2` 在 `transferSettledOutbound` 判定后**先于**下一次 `releaseHeld` 返回 ⇒ 末 chunk 回执必不被误放行；ROUND3-C2 循环在 tag 判定后退出 ⇒ STEP1 回执必留扣留缓冲）经 SA4 源序核对成立，且各用例以头部在场断言自证。
- **不可重试逻辑**：断言失败即红；无 flaky 容忍（stability 3× + 包全量实跑佐证）。
- **变异恢复**：M1–M4 逐例「reverted clean」+ 汇总「生产树恢复干净」；D1 in-test 变异 `finally` 恢复。

静态无法确认项：无（本票全部断言面均有运行时证据日志 + 源码双锚；见 §9）。

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| ROUND3-C1（含 CHUNK3-C2） | 单帧 STEP2 恒 0 双向；chunkIndex 0..k-1/chunkCount=k/单 transferId；双向 SYNC_APPLIED 回指对端末 chunk 序（逐帧 `.sequence` 比对）；sent/applied/acked 各恰一 + 无 `sequence` 键 + 字节字段；live + 文档收敛 + 零 fatal | 根 vitest（包全量日志实列） | 「ackLatencyMs 在场」判据未锚（kind=2 无一用例断言；见 O-1） | MINOR |
| ROUND3-C2 | 按名 tag 丢 STEP1 回执 ⇒ ERROR{SYNC_STATE_VIOLATION} + failed；dropped 集事实 + 引用帧过缝反假绿；零 acked | 同上 | 无（M2 变异检出） | — |
| ROUND3-C3 | 交换点在场断言 + reorder + release(1) ⇒ 响亮 + 消费序 ACK 先于回执证据 | 同上 | 无（M3 变异检出） | — |
| ANCHOR3-C1 | 三步步进 + 缓冲头身份断言 + `ackLatencyMs = k+m` + 消费序 strict 先行 + live | 同上 | 无 | — |
| ANCHOR3-N1 | 丢全部 kind=1 回执后放 ACK ⇒ fatal{ACK_STATE_VIOLATION} + ERROR + 非 live + 零 acked | 同上 | 无（M1 变异检出） | — |
| CHUNK3-C0 | 中间回执零占位/零新事件；末回执 1→1 槽；ACK `k+m` + 无 sequence 键 + UPDATE_ACK 回指；第 2 笔恰一次（新 transferId/chunkIndex 0） | 同上 | 无（M4 变异检出：got 2） | — |
| CHUNK3-C1 | 每 chunk 独立 tag/恰一回执/`[8..12]` 原字节；中间零 sent；末回执 sent 恰一；ACK 回指；live+收敛 | 同上 | 无 | — |
| CHUNK3-P1 | β 前置断言 UPDATE_CHUNK ≥ 2 + 控制帧逐字节 + 骨架双向 + 文档语义 + NC-1 变异必差 | 同上 | 无 | — |
| ABORT3-C1/C2/C3/N1 | 三面零增长/零 settled/`unsealed===0`/零事件/非 live；C1 收口二次断言；C3 重连新作用域 `transferId===1`/chunkIndex 0 起/旧 transfer 零续传；N1 存活对照 | 同上 | C1 的 `timers` 采样变量未被断言（死观察，见 O-2） | MINOR |
| DRAIN3-C1/D1 | 末回执后零新增 data 帧/`scheduler.pending()` 不增/零 acked；ACK 后第 2 笔恰一次；D1 轨迹逐值相同 + 生效计数>0 + finally 恢复 | 同上 | 无 | — |

- 零源码字符串断言（断言全部为 wire/事件/文档/信号运行时形态）；零 skip/only/todo/env override（grep 零命中）。
- fixture/异步资源隔离：每用例独立 `bootGamma` 装配；无跨用例共享可变状态（唯一跨用例操作 = D1 原型变异，finally 恢复）。
- 触发入口真实：根 vitest include 逐字命中 + 包全量日志列名该文件；类型门经包 tsconfig（含 `test/**`）+ vitest typecheck 双覆盖。
- 敏感性：4/4 隔离生产变异检出（M1→ANCHOR3-N1、M2→ROUND3-C2、M3→ROUND3-C3、M4→CHUNK3-C0），NC-1 内容变异 in-test，D1 生效计数——判别力充分，无恒真断言。

## 10. Required revisions

无（无 BLOCKER/MAJOR）。

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| O-1 补强后的 kind=2 时延锚（若采纳） | 单用例注入 `hubClock` + k/m 步进（复用 ANCHOR3-C1 手法） | `chunked-sync-acked.ackLatencyMs === k + m` | 值 ≠ k+m（t0 采样点漂移） |
| CI 收尾门（根 `pnpm test`/`pnpm typecheck` 全量含 test-d） | CI/Host（impl 报告 Deferred §1 已显式移交；#451 登记范围） | 全绿 | 任何红 |
| 长期稳定性（本票 3× + 包全量为现有证据面） | SA6/SA7 复跑（Deferred §2） | 同基线全绿 | 计数漂移/偶发红 |

## 12. Non-blocking observations

- **O-1（MINOR）**：SA6 §12.3 `ROUND3-C1` 判据含「`ackLatencyMs` 在场」，新文件未在 kind=2 族任何用例断言该字段（ROUND3-C1/DRAIN3-C1 均未注入 `hubClock`，字段结构性缺席；driver 仅在显式传 `hubClock` 时注入 clock——`driver.ts:525` 实读）。t0=推送时刻语义已由 kind=1（ANCHOR3-C1 `k+m` + 既有 CHUNK-C3 含变异负控）与 kind=0（CHUNK3-C0 `k+m`）锚定，且 kind=2 事件发射点为同一回调形态（`hub-namespace.ts:786-793` 与 `onLastChunkSent` 采样同构），故实际覆盖缺口小；但 impl 报告映射表以「字节字段在场」**未宣告地代换**了契约的「ackLatencyMs 在场」，属设计 §13-R2 所指著写漂移的轻量实例。建议：后续以一行补强（kind=2 用例注入 `hubClock` 断言 `ackLatencyMs = k+m` 或其在场）并在实现记录宣告。Routing 建议：implementation（follow-up 性质，不阻断本票验收）。
- **O-2（MINOR）**：`ABORT3-C1` @893 采样 `timers: round.run.hubNode.scheduler.pending()` 但用例未对其断言（死观察变量；计时器面断言由 DRAIN3-C1 承载）。无判力影响，建议清理。
- **观察（非 finding）**：SA6 契约 §2 表与 §6-NC7 出现的「ANCHOR3-C2/N2」标签在权威清单 §12.3 与 §12.4 AC 映射中不存在（契约早期草稿残留）；交付物覆盖 §12.4 权威映射（ANCHOR3-C1/N1 + ROUND3-C3）即满足 AC2，非 SA3 缺口。
- **观察（非 finding）**：`sa3-issue449-package-tsc.log` 为空文件，单独不足以证明 exit 0；但两份套件日志的 vitest typecheck「Type Errors no errors」（package-suite 含 `typecheck 2.42s` 时长）+ 包 tsconfig 覆盖 `test/**` 构成充分旁证。后续证据留档建议在日志头部记录命令与 exit 码。
