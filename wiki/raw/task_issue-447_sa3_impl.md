# SA3 Implementation Report — task_issue-447

- Issue：#447（γ-T1：公共异步会话工厂 + 延迟注入异步 FIFO 管道夹具 + 首个跨缝协议回合
  OPEN→bootstrap→close）
- 实现基线 HEAD：`c86ccbc`（`Spec #445：γ 真 worker 形态设计工件`）
- 最新批准设计：`wiki/raw/task_issue-447_design.md`（修订版 668 行；SA2 `approve`、SA8 `clear`）
- 红灯契约：`wiki/raw/task_issue-447_sa6_contract.md`（§12 条目 PUB/SEAM/PIPE/PEND/ANCHOR/ROUND/CHUNK/TD）
- 本文件为 SA3 唯一实现产物：新公共 γ 面 + 三态锚 + 两相记账 + ackTimeout 合并占用判据 +
  分块回执结算 + 异步 FIFO 夹具 + 四个验收测试文件 + 模块契约登记句。

---

## Inputs consumed

| 输入 | 位置 | 用途 |
|---|---|---|
| Host 任务简报 | `wiki/raw/task_issue-447.md` | AC 6 条；Comments 空（无 Owner 追加要求） |
| 最新批准设计（修订版） | `wiki/raw/task_issue-447_design.md` | §8.1–§8.10 接口/状态机、§11 ALLOW/DENY、§12 验收映射、§14 修订映射 |
| SA2 设计评审 | `wiki/raw/task_issue-447_sa2_review.md` | F1/F2 均「已闭合」；O1–O7 处置核对；SA2-O3/O4/O7 落实 |
| SA8 设计后冲突报告 | `wiki/raw/task_issue-447_design_conflict_report.md` | E1/E2 合格路径（D9 路线 a、D12 登记句）；R1/R2/R3 实现期复核义务 |
| SA6 验收契约 | `wiki/raw/task_issue-447_sa6_contract.md` | §12 条目断言要点、§12.0 纪律、§13 β golden trace、§14 runner/类型门双面 |
| 规范权威 | `docs/adr/0032-*.md:55-99`（A4）、`docs/protocols/instance-replication-v1.md:1091-1154`（§24）、`CONTEXT.md:229-235` | 缝词汇闭集合、保序条款、两相记账/三态锚义务、观测口径 |
| 包模块契约 | `packages/ws-replication/AGENTS.md` | 缝纪律条款（:17）与验证纪律（:26）；D12 登记落点 |
| 既有实现与验收族 | `src/{index,hub-session-host,hub-session,hub-split,hub-namespace,round-engine,update-channel,bulk-transfer,types}.ts`、`test/{driver,harness,issue424-sharded-hub}.ts`、418/420/421/422/424 族 | 冻结面基线、夹具纪律镜像、parity 判据复用 |

## Existing worktree reconciliation

- 实现前 worktree 无未提交实现（`git status` 仅见上游 `wiki/raw/*` 与 `artifacts/sa6-*` 证据，
  均为前序 SA 产物）；本报告为首次落地，无「待修订实现」需要协调。
- 上游设计/契约内部一致、ALLOW/DENY 明确、SA2 F1/F2 已在设计内闭合、SA8 E1/E2 合格路径可实施
  ——无阻塞，按设计编码。
- **一处上游未预见的机械冲突（已处置，见「Deviations」）**：`ws-replication-issue418-…-contract.test.ts`
  的 `FROZEN_PRODUCTION_EXPORTS` 冻结表把运行时导出名集**全等**断言，而 PUB-C1 要求 append-only
  新增 1 个值导出——二者不可同时字面成立；按该文件既有先例（#422 §12.8「一次性授权编辑」注释）
  做排序插入式最小追加。

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/ws-replication/src/hub-session-async-host.ts` | §8.1/§8.2/§8.3（D1/D2/D3/D5/D6） | **新建**：γ 公共工厂/句柄/第三种 port 形态/tag 分配与校验/`handleReceipt`/`selfDrain`/缝消息类型 |
| `packages/ws-replication/src/index.ts` | §8.1（PUB-C1） | append-only：值导出 `createHubAsyncSessionHost` + 5 类型（值导出 15 → 16） |
| `packages/ws-replication/src/hub-split.ts` | §8.4（D4） | `HubSessionSink.onReceipt?` 新可选成员；`HubSessionEdgePort` 返回值语义 doc 追加（tag 形态） |
| `packages/ws-replication/src/hub-session.ts` | §8.4 | `HubSessionSinkConfig.asyncSendTickets?`；channelHost 透传；`onReceipt` fan-out（唯一通道） |
| `packages/ws-replication/src/hub-namespace.ts` | §8.5/§8.6/§9.1（D9/D11） | `bootstrapSnapshotSeq` 三态化（写点/判别/复位）；`onSendReceipt` fan-out 单点；`asyncSendTickets` 透传三子宿主；`chunkedAckT0 = pushedAt ?? sampleAckT0()`（两写点） |
| `packages/ws-replication/src/round-engine.ts` | §8.5 | `ownStep1/2Seq` 三态化（`anchorOf`/`anchorSequenceOf`）、`onSendReceipt` 回填、`noteChunkedStep2Outbound` 落 stamped |
| `packages/ws-replication/src/types.ts` | §8.5 | 新增 `SendAnchorState`（内部）；`RoundState.ownStep1/2Seq` 类型替换 |
| `packages/ws-replication/src/update-channel.ts` | §8.6/§8.6.1（D10，SA2-F1） | `pendingSends` 两相键空间 + `onReceipt` rekey + `effectiveInFlightCount` 计入 + async 分支（`sendAndRegister`/`sendOneChunk`）+ `hasUnsettledSends` 合并占用判据（计时器回调/`onAck` 拆除）+ `abandonInFlight` 清 pending 与弃置 tag 序回收 + `teardown` 冲刷 |
| `packages/ws-replication/src/bulk-transfer.ts` | §8.6/D9（SA8-E1、SA2-F2） | `pendingLastChunkTag = {tag, pushedAt}`（推送边界采样）+ `onReceipt` 末 chunk 结算 + `onLastChunkSent` append-only 第三参 `pushedAt?` + host `asyncSendTickets`/`now` |
| `packages/ws-replication/AGENTS.md` | D12（SA8-E2/R2） | seam 纪律条款 append-only 补 γ 缝词汇登记句（`frame{tag,bytes,lane}` + `receipt{tag,sequence}`；引 A4/§24；无拒纳/闸门/信用词汇） |
| `packages/ws-replication/test/issue447-async-seam.ts` | §8.7/§8.8 | **新建**：FIFO 通道对夹具 + 故障旋钮（reorder/dropReceipts/withhold）+ 宿主桥样例 + γ facade + `pumpUntil`/`pumpSteps` + 能力感知 parity 助手 + observer/clock 桩 |
| `packages/ws-replication/test/ws-replication-issue447-async-session-api.test.ts` | §12（PUB-C1/C3、SEAM-C3） | **新建**：导出面/句柄成员/幂等/响亮负控 + receipt 键集 + 跨缝违契收口 |
| `packages/ws-replication/test/ws-replication-issue447-async-seam-fixture.test.ts` | §12（PIPE-C1/C2/C3、SEAM-C1/C2） | **新建**：FIFO/不丢/不重/零串道/零投递-显式释放 + 词汇闭集合 + tag/回执配对 + 结构门 |
| `packages/ws-replication/test/ws-replication-issue447-async-session-round.test.ts` | §12（ROUND-C1/C2/C3、ANCHOR-C1/C2、PEND-C1/C2/C3、CHUNK-C1/C2/C3） | **新建**：真 peer + 真 Registry/Runtime 的 γ 整回合、β/γ parity（单帧 + 分块）、锚/窗口/分块/t0 断言与变异负控 |
| `packages/ws-replication/test/ws-replication-issue447-async-session-api.test-d.ts` | §12（TD-C1/C2） | **新建**：γ 面类型锁定 + β 非回退块 + 8 条 `@ts-expect-error` 负控 |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts` | —（越 ALLOW，见 Deviations） | `FROZEN_PRODUCTION_EXPORTS` 排序插入 `createHubAsyncSessionHost`（1 行 + 2 行注释） |
| `artifacts/sa3-issue447-{gamma-suites,package-suite-and-typecheck}.log` | —（证据日志，非源码） | 验证命令与原始输出留档 |

## SA2 Finding 落实

| Finding ID | Implementation | Result |
|---|---|---|
| SA2-F1（ackTimeout pending-only 哑火） | `UpdateChannel.hasUnsettledSends() = inFlight.size + pendingSends.size > 0` 统一计时器回调判据（§8.6.1）与 `onAck` 拆除判据；`abandonInFlight` 清 `pendingSends`；不 γ 门控 ⇒ α/β 谓词逐值退化 | 落实；PEND-C3 ①（timer 推进 ⇒ `RESYNC_REQUIRED`×1 + `resync-required{ack-timeout}` + 槽位释放 + 恢复 round 后新帧可再推）绿；PEND-C3 变异负控（`hasUnsettledSends` 恢复 β 裸判据 ⇒ 计时器哑火 ⇒ 零 `RESYNC_REQUIRED`）可执行且红 |
| SA2-F2（γ 分块机械零可执行覆盖） | 真实 kind=1/kind=2 改道经 `boot({limits})` 小限额注入；末 chunk 回执结算锚/`chunkedAckT0`；CHUNK-C1/C2/C3 三条硬门 + 两条负控 | 落实；CHUNK-C1（`UPDATE_CHUNK`×7、`BOOTSTRAP_SNAPSHOT` 0 条、ACK 回指末 chunk 帧序、live/收敛/close/settled）、CHUNK-C2（两侧 `SYNC_STEP2` 0 条、kind=2 族、`SYNC_APPLIED` 回指）、CHUNK-C3（t0 = k+m）全绿 |
| SA8-E1/R1（t0 = 推送时刻） | `BulkTransferSender` γ 分支在推送调用边界采样 `pushedAt`（镜像 `sentAt` 机制）、携于 `pendingLastChunkTag`、经 `onLastChunkSent(sequence, settlement, pushedAt?)` 回传；`hub-namespace` 两写点 `chunkedAckT0 = pushedAt ?? sampleAckT0()` | 落实（路线 a，零规范改动）；CHUNK-C3 断言 `ackLatencyMs === k + m`；变异负控（结算不携 `pushedAt` ⇒ 值退化为 m）可执行且红；α/β 缺省 ⇒ 既有采样点不变（301 族全绿） |
| SA8-E2/R2（模块契约登记） | `packages/ws-replication/AGENTS.md:17` 后 append-only 补 γ 缝词汇句 | 落实，与 γ 代码同一变更集落盘；既有枚举句零改写 |
| SA8-E3/R3（A4.1/A4.2 读法登记） | 三态载体仅扩「载体形态」，判别/因果不变量保持（`anchor.phase !== 'stamped'` ⇒ 既有响亮违例）；FSM 零分叉 | 落实（按裁决读法执行，零 ADR 文本改动） |
| SA2-O1（导出计数） | 值导出 15 → 16（1 值 + 5 类型） | 落实；PUB-C1 断言计数 16 绿 |
| SA2-O2（调用点证据） | 无调用点改动：`createHubSessionSink` 新增成员皆**可选/追加**，α/β 三调用点零改动 | 落实（包全量 855 测试绿） |
| SA2-O3（`takeItems` 裸口径） | 保持裸口径（仅贪心合并宽度） | 落实（PEND-C2「换键不换槽」断言锁定窗口不变量） |
| SA2-O4（回执序入口不拦截） | 入口只做域校验 + 未决集成员判别；错配序交下游锚/ACK 判别 | 落实（SEAM-C2/ROUND-C3 配对断言 + ANCHOR-C2 响亮路径绿） |
| SA2-O5（kind=2 自持 timer 角落） | 武装点保持末 chunk 推送；CHUNK-C2 负控：丢弃末 chunk 回执 + 虚拟推进 ⇒ 载体弃置 + `RESYNC_REQUIRED`；迟到 `SYNC_APPLIED` ⇒ 响亮 `SYNC_STATE_VIOLATION` | 落实（CHUNK-C2 负控绿） |
| SA2-O6（sessions Map 累积） | 与 β 同形（follow-up 登记，不扩 scope） | 未处理（按设计 §13-R10 登记） |
| SA2-O7（throw 传播/tag 不入事件） | `emitSeam` 监听者 throw 原样传播；`noteUpdateSent({sequence: tag})` 的 tag 只作内部记账（hub 侧普通帧早退、chunked 族键集不含 tag） | 落实 |

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `src/hub-session-async-host.ts` | ALLOW 第 1 行 | γ 公共面与第三种 port 形态 |
| `src/index.ts` | ALLOW 第 2 行 | append-only 导出 |
| `src/hub-split.ts` | ALLOW 第 3 行 | 回执 fan-out 载体 + doc 追加 |
| `src/hub-session.ts` | ALLOW 第 4 行 | sink 组装层 γ 分支 |
| `src/hub-namespace.ts` | ALLOW 第 5 行 | 三态锚 + 回执 fan-out + t0 写点 |
| `src/round-engine.ts` | ALLOW 第 6 行 | ownStep1/2 三态 + 回填 |
| `src/types.ts` | ALLOW 第 7 行 | `SendAnchorState` |
| `src/update-channel.ts` | ALLOW 第 8 行 | pending 两相记账 + §8.6.1 |
| `src/bulk-transfer.ts` | ALLOW 第 9 行 | 分块回执结算 + `pushedAt` |
| `AGENTS.md` | ALLOW 第 10 行 | D12 词汇登记（append-only） |
| `test/issue447-async-seam.ts` | ALLOW 第 11 行 | 夹具/桥/facade |
| `test/ws-replication-issue447-async-session-api.test.ts` | ALLOW 第 12 行 | PUB/SEAM 运行期面 |
| `test/ws-replication-issue447-async-seam-fixture.test.ts` | ALLOW 第 13 行 | PIPE/SEAM 夹具面 |
| `test/ws-replication-issue447-async-session-round.test.ts` | ALLOW 第 14 行 | ROUND/ANCHOR/PEND/CHUNK |
| `test/ws-replication-issue447-async-session-api.test-d.ts` | ALLOW 第 15 行 | TD-C1/C2 |
| `test/ws-replication-issue418-edge-session-split-contract.test.ts` | **越 ALLOW（见 Deviations-1）** | 冻结表 1 行排序插入（PUB-C1 ∪ PUB-C2 的机械必然） |
| `artifacts/sa3-issue447-*.log` | 证据日志（非源码；同 SA6 证据约定） | 验证留档 |

DENY 面核对：`hub-session-host.ts`（β 冻结工厂）、`hub-edge*.ts`/`frame-io.ts`/`backpressure.ts`、
`hub-connection.ts`/`plugin.ts`、`peer-*.ts`、`src/testing.ts`、`docs/adr/0032-*.md`、
`docs/protocols/instance-replication-v1.md`、`CONTEXT.md`、其余包/域/应用/根配置 —— **零改动**
（`git status` 证实）。

## Verification

| Command | Result | Evidence |
|---|---|---|
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/ws-replication/test/ws-replication-issue447-async-session-api.test.ts …-async-seam-fixture.test.ts …-async-session-round.test.ts --typecheck.enabled=false --passWithNoTests=false` | **3 files / 30 tests 全绿**（PUB-C1/C3、SEAM-C1/C2/C3、PIPE-C1/C2/C3、ROUND-C1/C2/C3、ANCHOR-C1/C2、PEND-C1/C2/C3、CHUNK-C1/C2/C3 + 3 条变异/负控） | `artifacts/sa3-issue447-gamma-suites.log` |
| `… vitest run …issue447-async-session-api.test-d.ts`（vitest typecheck 面） | **Type Errors: no errors**（新 test-d 自身零错误；8 条 `@ts-expect-error` 全部被触发） | `artifacts/sa3-issue447-gamma-suites.log` |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck.enabled=false --passWithNoTests=false packages/ws-replication` | **94 files / 855 tests 全绿**（PUB-C2 硬门；基线 91/825 + 新 3 文件/30 测试；418/420/421/422/423/424 与 243/295/300/301 族全绿） | `artifacts/sa3-issue447-package-suite-and-typecheck.log` |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsc -p packages/ws-replication/tsconfig.json` | **exit 0**（零输出） | 同上 |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsc -p tsconfig.typecheck.json --noEmit` | **exit 0**（根级类型门；含新 test-d） | 同上 |
| γ 回合 wire 骨架（运行时观测） | `HELLO_ACK#1 OPEN_OK#2 BOOTSTRAP_SNAPSHOT#3 SYNC_STEP1#4 SYNC_STEP2#5 SYNC_APPLIED#6 CLOSE_OK#7` —— 与 SA6 §13 β golden trace 逐帧一致 | ROUND-C1/C3 断言 + ROUND-C2 parity |
| ROUND-C2 parity（单帧构型，同场 β sharded vs γ） | 控制帧子集逐字节等（`framesHexEqual === undefined`，两方向）+ 骨架全等 + 数据帧 `docStateOf` 语义等 + NC-1 内容变异敏感性绿 | ROUND-C2 测试 |
| ROUND-C2/CHUNK parity（分块构型，同限额 β 单体 vs γ） | 控制帧逐字节等 + 骨架全等（含 `UPDATE_CHUNK` 帧型与帧序）+ 分块重组后的文档语义等 | CHUNK-C1 parity 测试 |
| PEND-C3 变异负控 | `UpdateChannel.prototype.hasUnsettledSends` 运行期置为 β 裸判据 ⇒ 计时器哑火、零 `RESYNC_REQUIRED`（① 断言必红）——证明合并占用判据承重 | PEND-C3 变异测试 |
| CHUNK-C3 变异负控 | 末 chunk 结算回调不携 `pushedAt` ⇒ `ackLatencyMs` 退化为 m（应得 k+m）——证明 t0 携带承重 | CHUNK-C3 变异测试 |
| CHUNK-C2 负控 | 丢弃末 chunk 回执 + 虚拟推进 ⇒ 载体弃置 + `RESYNC_REQUIRED`×1；随后迟到 `SYNC_APPLIED` ⇒ 响亮 `SYNC_STATE_VIOLATION`（零 park） | CHUNK-C2 负控测试 |
| ANCHOR-C2 | 扣回执（`dropReceipts(2)`）+ 直投 `BOOTSTRAP_ACK` ⇒ `connection-fatal{ACK_STATE_VIOLATION}` + 连接级 `ERROR` + namespace 不 live；被扣回执零投递 | ANCHOR-C2 测试 |
| PIPE-C3 结构门 | `package.json` + `src/**`（29 文件）对 `worker_threads\|MessageChannel\|MessagePort` 命中 0 | PIPE-C3 测试 |

## Deferred verification

（SA3 职责外；沿设计 §12/§15 交 SA4/SA7/SA8）

1. **全仓 `pnpm typecheck` / `pnpm test`**：本票只跑 `packages/ws-replication` 包套件 + 包/根
   `tsc`（含全部受影响文件）。跨包（apps/yjs-server、domains/*）未触达，根 `tsc` 已覆盖类型面。
2. **`vitest run --typecheck`（CI 形态）全门**：HEAD 既有 421 test-d 4 条红（SA6 §15-B1 已归因，
   另票）。本票新 test-d 在该面零错误（已实测），但全门仍会因既有红失败。
3. **SA8-R5 重跑与实现期复核项**（另门禁）：实现期逐项落点已就绪（§8-R1 的 `pushedAt` 路径与
   `chunkedAckT0` 两写点、§8-R2 的 AGENTS.md 登记句、§8-R3 冻结面核对）。
4. **R4（可选）**：`CONTEXT.md` γ 段登记厂名 `createHubAsyncSessionHost`——非义务，未做（CONTEXT.md 属 DENY）。
5. **R5/R10/R11 follow-up**：β 工厂形态 facet dormant、γ `sessions` Map 无终态移除、回执序单调加固
   ——按设计登记为 follow-up，本票不扩 scope。

## Deviations or blockers

1. **越 ALLOW 的最小必要编辑（已成事实，请 SA8/SA4 复核）**：
   `packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts` 的
   `FROZEN_PRODUCTION_EXPORTS` 表（`:144-162`）把生产入口运行时导出名集做 **`toEqual` 全等**断言；
   PUB-C1 要求 append-only 新增值导出 `createHubAsyncSessionHost` ⇒ 该断言与 PUB-C2「既有矩阵全绿」
   在设计侧不可同时字面成立（设计 §8.1 明言「值导出 15 → 16」，但未预见该冻结表）。
   **处置**：按该文件既有先例（`:149/:159` 的「issue #422 契约 §12.8 一次性授权编辑」注释）做
   排序插入式最小追加（1 行 + 2 行出处注释），未改断言语义、未改任何既有名单项。
   新增行：`'createHubAsyncSessionHost'`（含 `// issue #447（PUB-C1 一次性授权编辑；同 #422 §12.8 先例）`）。
   **影响面**：仅冻结表快照，不涉行为；如团队判定该编辑不在本票授权内，替代处置 = 由 SA1 在原设计
   ALLOW 清单补该文件（本报告即为该扩张的依据记录）。
2. **`abandonedTags` 序回收（实现级补全，非设计变更）**：设计 §8.6.1 末段声明「被弃 tag 的迟到回执
   = 良性 no-op，与 β『abandon 后迟至 ACK = zombie 良性』同构」。字面实现只覆盖「回执良性」，但 γ 下
   被弃 pending 条目的 wire 序在弃置时未知 ⇒ 随后的迟到 `UPDATE_ACK` 会落 `onAck` 'violation' ⇒ 响亮
   `ACK_STATE_VIOLATION`，与 §9.1「迟到回执 = 良性 no-op（不 fatal）；恢复 round 修复」及 PEND-C3 ②
   直接冲突（实测复现）。实现按保序条款（同通道 FIFO ⇒ 回执必先于 ACK）在 `onReceipt` 命中被弃 tag 时
   把回执揭示的 wire 序登记进 `zombieSeqs`，使 β 同构声明在 γ 下**逐值成立**：
   - 仅对 `abandonInFlight` 弃置过的 tag 生效（`abandonedTags` 集合），不改变「未知序 ACK = 响亮违例」的
     既有判别范围；
   - α/β 无 `onReceipt` 调用面 ⇒ 零行为变化（包全量 855 测试绿为证）；
   - 位置：`update-channel.ts`（`abandonedTags` 字段 + `onReceipt` miss 分支 + `abandonInFlight`/`teardown` 维护）。
3. **分块构型 parity 判据的能力感知等价物**：SA6 §12 ROUND-C2 要求「复用 issue424 cross-seam 断言族」，
   但该族的 `controlFramesOf`/`skeletonOf`/`docStateOf` 以**无协商位**调用 `decodeMessage`（遇
   `UPDATE_CHUNK` 响亮拒绝）且按单帧载荷取用（分块族会静默跳过）。分块构型下因此改用同判据的能力感知
   等价物（`wireControlFrames`/`wireSkeleton`/`wireDocState`，后者按 `transferId` 重组分块载荷），
   单帧构型仍用 #424 原族；两套判据在同一回合上给出相同结论（单帧构型 parity 绿 = 等价性证据）。
   该 #424 夹具在 DENY 内，未修改。
4. **分块构型 parity 的 β 参照 = 单体组合根**：`makeShardedReplicationFacade`（#424 夹具，DENY）不采纳
   `boot({limits})`（内部恒用 `DEFAULT_REPLICATION_LIMITS`），无法在小限额构型下做分块改道；分块 parity
   因此以 β **单体** `createHubReplication` 为参照（同限额、同非协商/协商位），单帧 parity 仍为
   β sharded vs γ（两者互为佐证）。
5. **无阻塞项**：设计可实施、范围（除偏差 1）满足、红灯契约与设计一致、无环境阻塞。

## Suggested commit message

```
fix(#447): γ 异步缝公共会话工厂 + 三态锚/两相记账 + 分块回执结算 + 异步 FIFO 夹具与跨缝回合

- 新公共面（append-only）：createHubAsyncSessionHost + HubAsyncSession{Handle,Host,Frame,
  FrameListener,Receipt}（src/index.ts 值导出 15 → 16；β createHubSessionHost 冻结面逐字不动）
- 缝词汇落地：frame{tag,bytes,lane} / receipt{tag,sequence} / close / terminateUnauthorized /
  settled / connection-fatal；tag 句柄域自 1 单调唯一；违契（未知 tag/非法序）响亮收口
- 三态锚：SendAnchorState（pending/stamped）+ bootstrapSnapshotSeq/ownStep1/2Seq 载体扩展；
  pending-at-ACK = 既有响亮违例（禁 park，保序条款结构性保证）
- 两相记账：UpdateChannel.pendingSends（tag 键空间）+ 回执换键不换槽 + 计入窗口；
  ackTimeout 合并占用判据（inFlight ∪ pendingSends）与 onAck 拆除判据统一（α/β 逐值退化）
- 分块族：Kind=1/2 末 chunk 回执结算 + pushedAt 推送边界采样（t0 = 推送时刻，§24.8/SA8-E1 路线 a）
- 夹具（test-only）：每 (连接, namespace) 一对 FIFO 通道 + 显式 release + reorder/drop/withhold
  旋钮；零 worker_threads；宿主桥在盖章返回值同一同步段投回执
- 验收：ROUND-C1/C2/C3（β 逐字节 parity，单帧 + 分块两构型）、ANCHOR-C1/C2、PEND-C1/C2/C3
  （含变异负控）、CHUNK-C1/C2/C3、PIPE-C1/C2/C3、SEAM-C1/C2/C3、PUB-C1/C3、TD-C1/C2
- 模块契约：packages/ws-replication/AGENTS.md append-only 登记 γ 缝词汇（ADR 0032 A4 / 协议 §24）
- 验证：包全量 94 files / 855 tests 绿；包 tsc 与根 tsc exit 0；新 test-d 两面零错误
```

---

## 附：实现与设计的逐条对照（关键不变量）

| 设计条款 | 实现落点 | 断言证据 |
|---|---|---|
| §8.1 六新导出（1 值 + 5 类型） | `index.ts` append-only 段 | PUB-C1（16 值导出 + typeof）、TD-C1 |
| §8.2 词汇闭集合 | `hub-session-async-host.ts` 类型面 + 夹具日志 | SEAM-C1（闭集合 + 负控）、SEAM-C3（receipt 键集） |
| §8.3 tag 分配/未决集/响亮收口 | `emitSeam`/`handleReceipt` | PUB-C3（同 promise 幂等、未知 tag/非法序）、SEAM-C2 |
| §8.4 sink 装配层 γ 分支 | `hub-session.ts` `asyncSendTickets`/`onReceipt` | PEND/CHUNK 全族（bit 唯一设置点 = γ 工厂） |
| §8.5 三态锚（idle/pending/stamped） | `types.ts` + `round-engine.ts` + `hub-namespace.ts` | ANCHOR-C1/C2、ROUND-C1（ACK 回指）、CHUNK-C1/C2 |
| §8.6 pending 两相记账 | `update-channel.ts` + `bulk-transfer.ts` | PEND-C1（扣留期恰 1 帧）、PEND-C2（只放回执仍不过缝） |
| §8.6.1 ackTimeout 有界性 | `hasUnsettledSends` + `abandonInFlight` + `abandonedTags` | PEND-C3 ①②③④ |
| §8.7 宿主桥（盖章点同段投回执） | `issue447-async-seam.ts` `sessionToEdge.onDeliver` | ROUND-C3（receipt.sequence === wire `[8..12]`）、ANCHOR-C2 |
| §8.8 延迟可注入 FIFO 夹具 | `SeamChannel`/`SeamHub` 旋钮 | PIPE-C1/C2/C3 |
| §8.9 回合数据流（单帧 + 分块） | `round.test.ts` 装配 | ROUND-C1/C3 + CHUNK-C1/C2 |
| D9 t0 = 推送时刻 | `bulk-transfer.ts` `pushedAt` + `hub-namespace.ts` 两写点 | CHUNK-C3（k+m）+ 变异 |
| D12 模块契约登记 | `AGENTS.md` 追加句 | 文档落盘（同变更集） |
