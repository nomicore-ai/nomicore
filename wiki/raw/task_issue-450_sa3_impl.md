# SA3 Implementation Report — Issue #450（γ-T4：γ 流控与生命周期收口）

- Dispatch：`sa-018ababa-7198-4561-b785-c8bafda7a2eb`（mabf-sa3 / implementation / iteration 0）
- Baseline worktree：`/home/wangjian/nomicore-fix-issue-450`，HEAD `444c1665fdb35b618bbb378a5b6bcefacfd288a7`（= SA6 契约基线；SA1 设计 iteration 1 / SA2 iteration 1 `approve` / SA8 iteration 1 `clear` 均以此基线核验）
- 实现范围：**D1 两翼**（翼(i) data admission 守卫失败动作分叉 + 翼(ii) γ egress 前置门暂停项移除）、D2 公共面 append、D3 码映射、D8 AGENTS.md 登记句、F1/F2/F3/D7 夹具与全部 `BPK/OVS/DROP/FLUSH/REVOKE/DRAIN/OPENWP/MEM/PUB` 验收锚

---

## Inputs consumed

| 输入 | 状态 / 用途 |
|---|---|
| `wiki/raw/task_issue-450.md`（Host 简报，7 条 AC，`## Comments` 空） | 已读；需求全集映射（无 owner 评论） |
| `wiki/raw/task_issue-450_sa6_contract.md`（已批准验收契约） | 已读；§6 NC-1/§12.1/§12.2 契约条目逐条落地为测试 |
| `wiki/raw/task_issue-450_design.md`（SA1 **iteration 1** 修订版 517 行） | 实施依据（D1 两翼/D1.5/D2–D9、§8.1 接口、§11 文件范围、§12 验收映射） |
| `wiki/raw/task_issue-450_sa2_review.md`（SA2 **iteration 1** verdict `approve`；无 BLOCKER/MAJOR） | F-1 已关闭核验；N1–N6 落实；O1–O4 观察项 |
| `wiki/raw/task_issue-450_design_conflict_report.md`（SA8 **iteration 1** verdict `clear`；§8 R1–R7 实现期复核义务） | §16 读法 A 确认（翼(ii) = 既有决策实现，R9 降级路径关闭）；R1–R7 逐条核对（见下） |
| `wiki/raw/task_issue-450_dispatch.md`（dispatch log，REST snapshot 空） | 无 owner 追加要求 |
| 缺席（非阻塞）：`task_issue-450_relevant_decisions.md` / `task_issue-450_conflict_report.md` | 实查不存在 |
| 规范权威：`docs/adr/0032-*.md` 附录 A4、`docs/protocols/instance-replication-v1.md` §24/§17 | 逐字核对；**零文本改动**（实现追平规范） |

## Existing worktree reconciliation

起始时 worktree 仅含未跟踪的 SA6/SA1/SA2/SA8 工件与 `artifacts/sa6-issue450-*.log`，`packages/` 生产面与测试面**零改动**（`git status` 实查）——无待修订的历史实现，本次为首次实现。

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/ws-replication/src/backpressure.ts` | §8.1-①②（翼 i） | `ConnectionSenderHost` append 可选成员 `onDataFrameAdmissionFatal?(reason)`；`tryEmitDataFrame` 两条守卫各增一行可选调用（判定次序/严格大于判据/投影口径零变化）；模块头注 append issue #450 段 |
| `packages/ws-replication/src/hub-edge.ts` | §8.1-③④（设置链 a + D3 码单点） | `HubReplicationEdgeConfig` append `asyncDataAdmissionFatal?: true`；构造器 sender host 条件挂接 + reason→码映射（oversize → `FRAME_TOO_LARGE` + `wsCloseCodeFor` 1009；ledger-overflow → `CONNECTION_BACKPRESSURE` 1011） |
| `packages/ws-replication/src/hub-edge-host.ts` | §8.1-⑤⑥（设置链 b + 翼 ii + doc append） | `HubReplicationEdgeOptions` append 第 10 可选成员 `asyncDataAdmissionFatal?: true`；`allocate` 双落点转发（edge 配置 + `pausePreGate = options.asyncDataAdmissionFatal !== true`）；`HostEdgeConnection` 构造期常量 `pausePreGate` + egress 前置门 γ 分叉；`sendDataFrame` 公共 doc 0 值语义 append（并同步 SA2-O1 指出的「次序 = hub-session.ts 等价」措辞为按装配分形态） |
| `packages/ws-replication/AGENTS.md` | §7-D8（SA8-R5 方向性义务 + N3 双向误用 + 前置门声明） | 缝纪律条款 **append-only** 一句（γ 装配 ⇒ 应置位；漏置位 = 退回 β 语义且零诊断；误加于 β = 连接死亡；置位后越界 = 连接终局（1011/1009）且前置门仅保留 `closed` 项；缺省 α/β 逐字不变）；既有枚举句与冻结面零改写 |
| `packages/ws-replication/test/issue450-flow-seam.ts` | §7-D6（F1–F4）/D7/§12.1 | **新建**：`bootFlowRound`（F1 accept 装饰 + 增量 facade options + `timeouts` 注入）、F1 压力旋钮（`level`/`advance`/`sentBytes`/`levelBeforeLastSend`）、`stampSamples`（盖章时刻水位活数组）、`makeLargeUpdateFrame`（F3）、`helloFrame450`/`openFrame450`/`bootInjectionFlow`（D7 白盒注入面）、F4 头注登记 |
| `packages/ws-replication/test/ws-replication-issue450-flow-lifecycle.test.ts` | §12.1 契约条目 | **新建**：22 用例（BPK-C1/C2/C4/C3、BPK-NC1/NC2、OVS-C1/NC1/NC2、DROP-C1、FLUSH-C1/C2、REVOKE-C1/NC1、DRAIN-C1×2/NC1、OPENWP-C1×2/C2×2、MEM-C1/C1b/C2/NC1、PUB 缺省不变性） |
| `packages/ws-replication/test/issue447-async-seam.ts` | §11 ALLOW（append-only） | append-only：`AsyncFacadeOptions.asyncDataAdmissionFatal?: true`（转发工厂）+ `deferSinkResolve?: boolean`（F2）；`AsyncSeamHost.pendingSinks()/resolveSink()` 闸门 API；`sinkGate` + resolver 抽取为 `build` 闭包。语义 diff = **+49 / −0**（`git diff -w` 实查）；其余行为逐字不变（#447 三套件复跑绿） |
| `packages/ws-replication/test/ws-replication-issue421-edge-factory-api.test-d.ts` | §7-D9（PUB 类型锚） | append-only：`HubReplicationEdgeOptions['asyncDataAdmissionFatal']` = `true \| undefined` 锁定 + `satisfies` 缺省/置位字面量 + `@ts-expect-error` 非法值（`false`）形态；头注与用例名「九成员」→「十成员」；既有断言全保留 |
| `artifacts/sa3-issue450-*.log`（红/绿/族/421/包全量/tsc/根门禁/变异负控） | §12.2 证据落盘 | 运行证据（见 Verification） |

DENY LIST 路径零改动：`hub-session-async-host.ts` / `hub-session.ts` / `hub-namespace.ts` / `update-channel.ts` / `round-engine.ts` / `bulk-transfer.ts` / `types.ts` / `hub-session-host.ts` / `hub-connection.ts` / `plugin.ts` / `peer-*.ts` / `frame-io.ts` / `hub-upgrade-admission.ts` / `index.ts` / `testing.ts` / `issue448-live-seam.ts` / `packages/replication-protocol/**` / 规范文档（ADR 0032、协议、CONTEXT.md）/ 其余包与根配置（`git status` 实查）。

## SA2 Finding落实

| Finding ID | Implementation | Result |
|---|---|---|
| **F-1（MAJOR，iteration 0；iteration 1 已关闭）**：水位暂停闸先于账本守卫 | 翼(ii) 落地：`HostEdgeConnection.egress.sendDataFrame` 在 γ 装配下仅保留 `closed` 项（构造期常量 `pausePreGate`，单一 option 派生）；`BPK-C4` 判别性观察（`levelAtStamp > highWater` 仍盖章）+ `BPK-NC2` 缺省前置门负控；doc/0 值语义按装配分形态真陈述 | **闭合**：γ 生产拓扑形态以 1011 死亡收口；缺省装配前置门弹回形态仍绿（`BPK-NC2`）；变异负控（`pausePreGate` 恒 true）使 `BPK-C4` 判别性断言红（证据 `sa3-issue450-mutation-wing2.log`） |
| N1（成员计数 17→13） | 未改计数注释（新增成员注释不复制计数）；`hub-edge.ts` host 挂接为条件展开 | 一致（无失真计数引入） |
| N2（`OVS-NC1` 校准：cap 64KiB + 清账） | `OVS-NC1/NC2` 按 cap 65536 + 注入前 `pressure.advance(level())` + `dropNextHubFrame` 记录面 | 已落实（绿） |
| N3（双向误用登记） | option doc 双向（漏置位 ⇒ 静默 β + 零诊断；误加于 β ⇒ 连接死亡）+ AGENTS.md 登记句 + `BPK-NC1`/`BPK-NC2` 双向可执行负控 | 已落实 |
| N4（OPENWP 两到界形态） | `OPENWP-C1/C2`：并发闸 = 4 deferred OPEN；帧闸 = 1 OPEN + 15 缓冲帧（恰 16）；第 5 / 第 17 ⇒ 1008 | 已落实（绿） |
| N5（`testing.ts` 引用订正） | 夹具落 `test/`，零 `src/testing.ts` 改动 | 已落实 |
| N6（`MEM-C2` 行为代理 + 可选计数直锚） | 行为代理为主锚（零 pending 泄漏 + 零新盖章/回执/wire + `closeCalls=1`）；计数直锚（可选）未实现（见 Deferred） | 已落实（主锚绿） |
| O1（egress doc「次序镜像」措辞过期） | 同一 doc append 变更集内改为按装配分形态（缺省 = 等价次序保留；γ = 仅 `closed` 项 + 守卫直达） | 已落实 |
| O2（`BPK-NC2` cause 精确化） | 断言钉 `resync-required{cause:'ack-timeout'}`（与 `BPK-NC1` 的 `send-failed` 判别） | 已落实（绿） |
| O3（水位事件可达性可选增强） | **未实现**：设计 D1.5 保留面登记「纯出站无 control 的极端形态下暂停状态不进入」——BPK-C4 编排即该形态，`send-paused` 不必然可达；判据不依赖 `paused`。保留面零改动（`enterPause`/`resume` 发射点原样） | 记录不处理理由（非阻断） |
| O4（§16 裁定依赖） | SA8 iteration 1 裁定读法 A（覆盖）⇒ 翼(ii) 落地、R9 降级路径关闭 | 已按裁定实现 |

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/ws-replication/src/backpressure.ts` | §11 ALLOW 第 1 行 | 翼(i) 钩子 + 两守卫调用 + 头注 |
| `packages/ws-replication/src/hub-edge.ts` | §11 ALLOW 第 2 行 | config append + 条件挂接 + reason→码映射 |
| `packages/ws-replication/src/hub-edge-host.ts` | §11 ALLOW 第 3 行 | option append + allocate 双落点 + 前置门分叉 + doc append |
| `packages/ws-replication/AGENTS.md` | §11 ALLOW 第 4 行 | D8 append-only 登记句 |
| `packages/ws-replication/test/issue450-flow-seam.ts` | §11 ALLOW 第 5 行（新建） | F1/F2/F3/D7 夹具 + F4 登记 |
| `packages/ws-replication/test/ws-replication-issue450-flow-lifecycle.test.ts` | §11 ALLOW 第 6 行（新建） | 验收契约本体 |
| `packages/ws-replication/test/issue447-async-seam.ts` | §11 ALLOW 第 7 行（append-only） | 标记转发 + F2 闸门 |
| `packages/ws-replication/test/ws-replication-issue421-edge-factory-api.test-d.ts` | §11 ALLOW 第 8 行（append-only） | PUB 类型锚 + 九→十措辞 |
| `artifacts/sa3-issue450-*.log` | 证据落盘（设计 §12.2-5「证据落盘」） | 运行证据 |

无 ALLOW 外实现改动；无 DENY 触碰；无生产 env override / fallback / skip / only / todo。

## Verification

| Command | Result | Evidence |
|---|---|---|
| **1 红契约（实现前）** `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication/test/ws-replication-issue450-flow-lifecycle.test.ts --typecheck.enabled=false` | **红**：`Tests 4 failed \| 18 passed (22)`——恰为设计预言的 4 条缺口（`BPK-C1/C2` 零 1011、`BPK-C4` 零「> highWater 放行」观察、`OVS-C1` 零 `FRAME_TOO_LARGE`、`MEM-C1b/C2` 零死亡） | `artifacts/sa3-issue450-red-focused.log` |
| **1' 类型面红（实现前）** `npx tsc -p packages/ws-replication/tsconfig.json`（生产三文件临时还原至 HEAD 复现，随后原样恢复） | **红**：`TS2339`（成员不存在）+ `TS2353`（字面量未知属性）+ `TS2344`（`toEqualTypeOf<true>` 实为 `false`）——全部集中在 421 test-d 新类型锚；既有断言与夹具本体零错误；exit 2 | `artifacts/sa3-issue450-red-typecheck.log` |
| **2 聚焦绿（SA6 §12.2-1 命令）** `npx vitest run …issue450-flow-lifecycle.test.ts --typecheck.enabled=false` | **绿**：22/22 | `artifacts/sa3-issue450-focused-green.log` |
| **2' 聚焦带类型门** 同文件（默认 `--typecheck`） | **绿**：22/22 + `Type Errors no errors`；exit 0 | `artifacts/sa3-issue450-focused-typecheck.log` |
| **3 γ 族复跑（§12.2-2）** #447 三文件 + #448 一文件 + #450 | **绿**：5 文件 / **65 用例** + `Type Errors no errors`（基线 43 + 新 22） | `artifacts/sa3-issue450-gamma-family.log` |
| **4 缝邻接（§12.2-3）** #421 全套件（edge 工厂契约 + test-d + accept/lifecycle/error-routing/wire-parity/route-key-parity） | **绿**：7 文件 / **98 用例**（含 test-d 8 类型用例）+ `Type Errors no errors` | `artifacts/sa3-issue450-421-suite.log` |
| **5 包全量 + 包 tsc（§12.2-4）** `npx vitest run packages/ws-replication/test` / `npx tsc -p packages/ws-replication/tsconfig.json` | **绿**：**102 文件 / 919 用例** + `Type Errors no errors`，exit 0（基线 101/897 ⇒ 恰 +1 文件/+22 用例）；包 tsc exit 0 | `artifacts/sa3-issue450-package-suite.log`、`artifacts/sa3-issue450-package-tsc.log` |
| **6 根门禁（§12.2-5）** `pnpm typecheck` | **绿**：exit 0（全包 tsc 链通过） | `artifacts/sa3-issue450-root-typecheck.log` |
| **6' 根门禁** `pnpm test` | **绿**：**465 文件 / 5649 用例** + `Type Errors no errors`，exit 0（含全部既有族） | `artifacts/sa3-issue450-root-test.log` |
| **7 β/α 硬门（§12.2-6）** 既有 102 文件全绿（上表 5）+ `BPK-NC1`（β 语义）+ `BPK-NC2`（缺省前置门）+ `PUB`（缺省零传成功路径） | **绿** | 同 5 / 2 |
| **8 变异负控（翼(ii) 判别力）** 临时把 `pausePreGate` 恒置 `true` 后单跑 `BPK-C4` | **红**：恰在「水位 > highWater 后仍放行盖章」判据失败 ⇒ 判别性观察真实；源码已还原（`git diff` 实查 `options.asyncDataAdmissionFatal !== true`） | `artifacts/sa3-issue450-mutation-wing2.log` |
| **9 聚焦确定性复跑** `#450` 套件 ×3 | **绿**：3/3 = 22/22 逐值相同（零 flake） | `artifacts/sa3-issue450-focused-repeat3.log` |
| **10 规范零改动核对（SA8-R4）** `git status --short` / `git diff --check` | ADR 0032 / 协议 / CONTEXT.md **零触碰**；`index.ts` 零改动；`git diff --check` exit 0 | `git status` / `git diff --check` 实查 |

### 根门禁结果

- `pnpm typecheck`：exit 0（全包 tsc 链；`artifacts/sa3-issue450-root-typecheck.log`）。
- `pnpm test`（全仓 `vitest run --typecheck`）：**465 文件 / 5649 用例全绿**、`Type Errors no errors`、exit 0（`artifacts/sa3-issue450-root-test.log`）。
- 聚焦确定性复跑：`#450` 套件 3 次连续运行 **3/3 = 22/22 逐值相同**（零 flake）。
- `git diff --check`：exit 0（零空白错误）。

### SA8 R1–R7 实现期复核

| # | 复核点 | 结果 |
|---|---|---|
| R1 | 公共 API append：`asyncDataAdmissionFatal?: true` 恰 `true \| undefined`；allocate 双落点；缺省对象字面量零 cast 通过；PUB/test-d「九→十」；`index.ts` 零改动 | **通过**（421 test-d 8 类型用例绿；`index.ts` 未触碰） |
| R2 | 两翼机械：翼(i) 仅新增可选调用（次序 oversize 先、严格大于、投影口径逐字）；翼(ii) `pausePreGate` 构造期常量、γ 仅 `closed` 项、缺省 `closed ∨ ¬gate` 逐字保留；`closedFlag` 幂等恰一收口；`tornDown` 收口 ERROR 零记账 | **通过**（源码 diff 逐行核对 + `BPK-C1/C4` 恰一 + `MEM-C2` 零新记账） |
| R3 | 冻结面：102 文件全绿 + `BPK-NC1`/`BPK-NC2` + #447/#448/#450 γ 族 + wire 断言；α 闸门/control 额度/水位事件不受扰 | **通过**（包全量绿；#418 pending-window/矩阵与水位族在包全量内绿） |
| R4 | 规范零改动 + §12.2 六道门证据落盘 | **通过**（`git status`；证据日志 12 份 `artifacts/sa3-issue450-*.log`） |
| R5 | AGENTS.md append-only 登记句（方向性义务 + 双向误用 + 前置门声明） | **通过**（同一变更集落盘；既有句零改写） |
| R6 | #449 边界（`update-channel`/`bulk-transfer` 未触碰） | **通过**（ALLOW 不含；`git status` 实查） |
| R7 | 公共 doc 真陈述：γ data 帧 0 值来源穷尽 = oversize 守卫 / ledger-overflow 守卫 / 前置 `closed` 闸；`connectionFatal` 同步前缀 `closedFlag`/`setConnState('closed')` 次序未动；缺省 doc 语义保持；γ 下 `send-paused`/`send-resumed` 经 control/poll 边沿仍可达、字段不变 | **通过**（`emitOne` 非正常路径 = 响亮 throw + 1008，无静默 0 漏网；`connectionFatal` 未改；水位发射点未动） |

## Deferred verification（不属 SA3 职责，交后续阶段）

1. `MEM-C2` 的可选**计数直锚**（经夹具探针暴露 `pendingSends`/`inFlight` 计数）未落地——SA6 §7/N6 定为可选增强；主锚（行为代理）已绿。
2. `O3` 的水位事件可达性专属断言未加（见上，非缺口）。
3. 根门禁全量回归的**归属矩阵**仍属 #451（T5）；本票仅按模块 AGENTS 跑根门禁。
4. SA4/SA7 的动态/真实链路验证不在 SA3 范围；本报告不改验收语义。

## Deviations or blockers

1. **`BPK-NC1` 载体替换（设计 §12.1 括注 vs SA6 §6/§12.2）**：设计把 β 负控载体括注为 `makeShardedReplicationFacade`（`issue424-sharded-hub.ts`），但该 facade 的 `ShardedFacadeOptions` **不接受 limits 注入**（实查 :426-433），无法编排「同 `BPK-C1` limits（cap 4KiB）越界」；SA6 §6 NC-1 与 §12.2 `BPK-NC1` 行明确允许「**监听单体或 `createHubSessionHost` 同步缝**」。本实现采用既有 #420 shim 桥（`createShimHubForTesting(options).replication`，**零改动复用**；其内部即 `createHubSessionHost` + edge egress 序回传的 β 同步缝形态），经 `HubReplicationOptions` 注入同款 limits。**断言键完全一致**：ns 级 `RESYNC_REQUIRED` 必达 + `resync-required{cause:'send-failed', reason:'send-frame-rejected'}` + 连接存活 + 零 `connection-failed{CONNECTION_BACKPRESSURE}`。DENY 面（不修改既有验收族）未触碰。
2. **`bootFlowRound` 的 `timeouts` 注入**：`LiveRoundOptions` 无 timeouts 旋钮且 #447 facade 的 `(options.timeouts ?? TIMEOUTS) as AsyncHostTimeouts` 要求 **resolved 形**；`bootFlowRound` 内部先 `{...TIMEOUTS, ...partial}` 归一后同时喂 `boot` 与 facade（缺省零传语义不变）。`DRAIN-NC1` 依赖该旋钮（逃生舱敏感性）。
3. **「盖章时刻水位」的观察方式**：F1 旋钮记录 `levelBeforeLastSend()`（同一同步段内该 data 帧的出站即最近一次 send），断言侧据此过滤 `> highWater`；控制帧不计入判别样本（`stampSamples` 仅采 data lane，且要求该 tag 已有正序盖章）。
4. **`issue447-async-seam.ts` 的 diff 形状**：语义为 append-only（`git diff -w` = **+49 / −0**），但 resolver 体抽取为 `build` 闭包带来**缩进级重排**（非缩进视图 263 行变动）。行为零变化由 #447 三套件 + 包全量复跑绿背书。
5. **无阻塞项**：设计内部一致、ALLOW/DENY 明确、SA2 无 BLOCKER/MAJOR、SA8 无 hard-conflict/override；实施过程未修改设计或验收语义，未新增依赖。

## Suggested commit message

```
feat(ws-replication): γ data admission 越界 = 连接终局（1011/1009）

issue #450（ADR 0032 A4.3 / 协议 §24.5，γ-T4）：
- 翼(i)：ConnectionSenderHost append 可选钩子 onDataFrameAdmissionFatal；
  tryEmitDataFrame 两条守卫在返回 0 前上报（次序/判据/投影口径不变）
- 翼(ii)：HostEdgeConnection egress 前置门构造期常量 pausePreGate——
  γ 装配仅保留 closed 项（水位暂停不再拦截 γ data 帧）
- 设置链：HubReplicationEdgeOptions append asyncDataAdmissionFatal?: true
  （第 10 可选成员；allocate 双落点转发；缺省零传 ⇒ α/β 逐字不变）
- 码映射单点（D3）：ledger-overflow → CONNECTION_BACKPRESSURE 1011；
  oversize → FRAME_TOO_LARGE 1009（零新错误码）
- AGENTS.md append-only 方向性义务与双向误用登记（D8）
- 新验收契约 #450（22 用例：BPK/OVS/DROP/FLUSH/REVOKE/DRAIN/OPENWP/MEM/PUB）
  与 #450 夹具（F1 压力旋钮 / F2 延迟解析 / F3 大帧 / D7 注入面）；
  #447/#448/#421 夹具与类型面 append-only 扩展

验证：聚焦 22/22；γ 族 65/65；421 98/98；包全量 102 文件/919 用例；
包 tsc + 根 typecheck/根 test 门禁；缺省装配前置门与 β 语义由 NC1/NC2 双向锚定
```
