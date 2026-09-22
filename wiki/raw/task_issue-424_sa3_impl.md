# SA3 Implementation Report

- 任务：Issue #424「分片形态端到端等价性验收（spec #415 T7）」（Parent = PR #416；Blocked by #420/#421/#422 三票均已在基线内）
- Worktree / HEAD：`/home/wangjian/nomicore-fix-issue-424` / `cab3e8c245ef189da1d823719370a68459939316`（与 SA6 §1、SA8 两报告、SA2 复审一致）
- 迭代：**1**（被实施设计 = `wiki/raw/task_issue-424_design.md` 迭代 1，SA2 复审 `approve`、F-R1 已关闭）
- dispatch：`sa-3b854c62-1f20-4699-a3d5-ff44326de8da`（role=mabf-sa3，phase=implementation，iteration=0）
- 结论：**实现完成，规定验证全绿**（聚焦 4 套件 25/25 绿 ×3 轮一致；包 tsc exit 0；根 `pnpm typecheck` exit 0；根全量 `pnpm test` 459 文件/5584 测试全绿、0 类型错误、exit 0；DENY 面零 diff/零触碰）。无 SD-1 偏差、无阻塞。

## Inputs consumed

| 输入 | 位置 | 用途 |
|---|---|---|
| 任务简报 | `wiki/raw/task_issue-424.md` | AC1–AC6；Comments 空（无 Owner 评论要求） |
| 最新批准设计（迭代 1） | `wiki/raw/task_issue-424_design.md`（642 行，全读） | §7.2 硬门、§7.3/§7.4 SD-2/SD-3、§8.1/§8.2/§8.3 夹具签名与 adopt 装配、§11 ALLOW/DENY、§12 验收映射与门禁命令 |
| SA2 设计评审 | `wiki/raw/task_issue-424_sa2_review.md` | verdict=`approve`；F-R1 关闭复核 + N1–N7 + O1–O3 |
| SA6 验收契约 + 探针 | `wiki/raw/task_issue-424_sa6_contract.md`、`wiki/raw/task_issue-424_sa6_capability_probe.mts`（1186 行，全读） | 契约条目 §12.1–§12.6、负控 NC1–NC4、语料/判据/驱动的可运行参考 |
| SA8 相关决议 + 两报告 | `wiki/raw/task_issue-424_relevant_decisions.md`、`_conflict_report.md`、`_design_conflict_report.md` | ADR 0032 决策 1–5 + A1–A3、协议条款行锚、SD-1~SD-4 边界 |
| 生产源码（只读） | `src/{index,types,defaults,hub-edge-host,hub-session-host}.ts` | 公共面签名、缝投影、`ResolvedTimeouts` 实际声明、冻结常量 |
| 测试基建（只读） | `test/{harness,driver,issue420-shim-hub}.ts` | `boot({createHub})` 注入缝与 hub 侧观察面绑定、真 Registry/Runtime、`settle/settleUntil`、`collectUnhandledRejections` |

Issue 评论 REST 快照为空（`[]`，dispatch 明示）——**无 Owner 评论要求可映射**，无需纳入实现（与 SA6/SA8/SA2 三方结论一致）。

## Existing worktree reconciliation

- 实现前 `git status` 只有 SA6/SA1/SA2/SA8 的流水线产物（`wiki/raw/task_issue-424_*`、`artifacts/sa6-issue424-*.log`），**不存在** `wiki/raw/task_issue-424_sa3_impl.md`，也不存在未提交实现。
- 本轮 = 迭代 1 的**首次**实现；无需修正/删除过时实现。SA6 证据件（探针 + 4 份日志）按 DENY 保留，未覆写、未重跑。

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/ws-replication/test/issue424-sharded-hub.ts` | §8.1/§8.2/§8.3（T-1） | 新增 test-only 夹具：worker 分片（真 Registry/Runtime + 公共 `createHubSessionHost`）、宿主桥（`HubNamespaceSessionSink` ↔ `HubSessionHandle` 四成员投影 + 信号搬运 + SD-2(a) 单点登记权威）、**adopt 形态 facade**（`registry` 必填、无 route 参数）、探针面、内存管道、语料/三层硬门判据助手、两形态轨迹驱动 |
| `packages/ws-replication/test/ws-replication-issue424-auth-parity.test.ts` | §12.0 AUTH-C1~C5、§7.2 头注 | 新增 7 用例（含 NC2/NC3/NC4） |
| `packages/ws-replication/test/ws-replication-issue424-cross-seam-round.test.ts` | §12.0 ROUND-C1~C4、「ROUND 装配前提」、§8.3.1 | 新增 5 用例（adopt 装配 + 引用同一性前提断言 + boot 形态 TERM 收尾） |
| `packages/ws-replication/test/ws-replication-issue424-multi-worker.test.ts` | §12.0 SHARD-C1~C3 + SEQ-C1 | 新增 4 用例（含 NC1 双形态对照） |
| `packages/ws-replication/test/ws-replication-issue424-lifecycle.test.ts` | §12.0 TERM-C1~C3、REVOKE-C1~C3、REAUTH-C1~C2、§7.3 SD-2(b) | 新增 9 用例（含设计追加的退化路径负控） |
| `artifacts/issue424-gate-full-suite.log` | §12.6 GATE-C1 | 新增：根全量套件同轮日志（459 文件/5584 测试/exit 0） |
| `artifacts/issue424-gate-typecheck.log` | §12.6 GATE-C2 | 新增：根 `pnpm typecheck` 日志（exit 0；文件冻结后复跑一次） |
| `artifacts/issue424-gate-scope.log` | §12.0 GATE-C3（双段 + SA2 N3 补充段） | 新增：DENY 面零 diff/零触碰证据 + 纪律扫描 |
| `artifacts/issue424-focused-determinism.log` | §7.7/§9 确定性纪律 | 新增：聚焦 4 套件 3 轮重复 + 包 tsc |
| `wiki/raw/task_issue-424_sa3_impl.md` | — | 本报告（原位新建） |

**零生产/公共面/协议/规范文档改动**：`packages/ws-replication/src/**`、`packages/replication-protocol/**`、`packages/namespace-registry/**`、`apps/**`、`domains/**`、`docs/**`、`vitest.config.ts`、`tsconfig*.json`、`package.json` 全部零触碰（GATE-C3 双段空输出）。

## SA2 Finding 落实

| Finding | 实现落点 | Result |
|---|---|---|
| **F-R1（MAJOR）** boot 形态 ROUND 装配路径不闭合 | `makeShardedReplicationFacade(options)`：`ShardedFacadeOptions.registry` **必填**、**无 route 参数**、facade 内建恰一个 `AdoptedWorker`（`createHubSessionHost({registry: options.registry, instanceId: HUB_INSTANCE, LIMITS, TIMEOUTS, timer: options.timer})`）并把全部 `resolveSessionSink` 路由到它；迭代 0 的路由形态 facade **未实现**（错位装配不可表达）。ROUND 套件每形态 boot 后先跑前提断言 `sharded.worker.registry === run.hubNode.registry` | **已关闭**：ROUND-C1~C4 + TERM 收尾 5 用例全绿（含两形态）；前提断言在场景前置执行，错位即前置红（信息指向装配而非生产 → SD-1 前置甄别成立） |
| N1 行锚精度回写 | 4 个套件头注写入规范引用组：协议 §3 L57 / §7.1 L176 / §13.1 L415 / §13.2 L424/L425/L430 / §12 L375 / §6.3 L159 / §21 L684 / §22 L701 / §23.1 L838-845 / §5 L114 / §6.1 L137 + ADR 0032 决策 1/3/4 + A1/A2-β | 已落实 |
| N2 instanceId 钉死 + 两半边同组冻结限值 | 夹具 `LIMITS = DEFAULT_REPLICATION_LIMITS`、`TIMEOUTS = DEFAULT_REPLICATION_TIMEOUTS`（公共常量；edge 侧不传 limits/timeouts → 工厂内 resolve 同组缺省；session host 侧直接赋）；`instanceId` 钉死 `HUB_INSTANCE`；**未使用** harness `CONTRACT_*` 旧形（缺 5 个分块纪元字段） | 已落实（含 1 处必要收窄，见 Deviations D5） |
| N3 GATE-C3 双段证据 | `artifacts/issue424-gate-scope.log` 段 1（契约原命令）+ 段 2（全 DENY 面 `git status --short` 空）+ 段 3 全仓 status + 段 5 纪律扫描 | 已落实 |
| N4 SEQ-C1 同工厂双连接构图 | SEQ-C1 用同一 `ShardedHost` 场景实例两次 `acceptTrusted`（双 pipe），断言第二连接首帧序 = 1、`connectionKey` 互异、首连接序列不受影响 | 已落实 |
| N5 推进面按侧精确 | pipe 形态直接 `ShardedWorker.scheduler.advanceBy(30_000)`；boot 形态 hub 侧断言用 `run.hubNode.scheduler.pending()`（被采纳 timer）、`advanceMs(run, …)` 只推 peer 侧 | 已落实 |
| N6 白名单等价性 | 判据用**枚举白名单**：L1 `{HELLO_ACK,OPEN_OK,ERROR,CLOSE_OK,GOAWAY}`、L2 `{BOOTSTRAP_SNAPSHOT,UPDATE,UPDATE_CHUNK,SYNC_STEP2}`、其余落 L3；头注登记 | 已落实 |
| N7 no-sink 重 OPEN 的 0 跳 resolver 细分 | 夹具头注第 2 条登记（登记不变量不被该路径破坏的理由） | 已落实 |
| SA2 O1 前提断言假定未包装 registry | 头注第 5 条与 ROUND 套件头注各登记一句 | 已落实 |
| SA2 O2 import 面补全 | 夹具 import 面含 `createRegistryTestScheduler`/`NamespaceRegistry`/`HubSessionHost`/`DuplexTransport`/`ReplicationTimer` 等；**零深路径 import 生产模块**（纪律扫描命中 0） | 已落实 |

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/ws-replication/test/issue424-sharded-hub.ts` | §11 ALLOW 行 1 | T-1 夹具 |
| `packages/ws-replication/test/ws-replication-issue424-auth-parity.test.ts` | §11 ALLOW 行 2 | AC1 |
| `packages/ws-replication/test/ws-replication-issue424-cross-seam-round.test.ts` | §11 ALLOW 行 3 | AC2 |
| `packages/ws-replication/test/ws-replication-issue424-multi-worker.test.ts` | §11 ALLOW 行 4 | AC3 |
| `packages/ws-replication/test/ws-replication-issue424-lifecycle.test.ts` | §11 ALLOW 行 5 | AC4/AC5 + SD-2(b) |
| `artifacts/issue424-*.log`（4 份） | §11 ALLOW 行 6 | GATE-C1~C3 + 确定性证据 |
| `wiki/raw/task_issue-424_sa3_impl.md` | §11 ALLOW 行 7（流水线产物） | 本报告 |

无 ALLOW 外新增路径；无 DENY 面触碰（段 1/段 2 空输出）。

## Verification

| Command | Result | Evidence |
|---|---|---|
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/ws-replication/test/ws-replication-issue424-*.test.ts`（×3 轮） | **4 文件 / 25 测试全绿，Type Errors no errors，exit 0；3/3 轮逐行一致**（设计 §7.7 确定性纪律） | `artifacts/issue424-focused-determinism.log` |
| `pnpm exec tsc -p packages/ws-replication/tsconfig.json`（GATE-C2） | **exit 0**（新夹具 + 4 套件入包 include） | 同上 + `artifacts/issue424-gate-typecheck.log` |
| `pnpm typecheck`（GATE-C2，根 15 个 tsconfig 串行） | **exit 0**（文件冻结后复跑一次，同样 exit 0） | `artifacts/issue424-gate-typecheck.log` |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm test`（GATE-C1，根全量 `--typecheck`） | **Test Files 459 passed (459) / Tests 5584 passed (5584) / Type Errors no errors / exit 0**（基线 455 文件/5559 测试 ⟹ 只增：+4 文件/+25 测试，与 SA6 §4 基线同轮） | `artifacts/issue424-gate-full-suite.log`（4 个新套件同轮 ✓：auth-parity 7 / cross-seam-round 5 / lifecycle 9 / multi-worker 4） |
| GATE-C3 段 1/2/3/5 | **`packages/ws-replication/src` + `packages/replication-protocol/src` diff 空；全 DENY 面 `git status --short` 空；全仓 status 仅 ALLOW 面新增；纪律扫描命中 0** | `artifacts/issue424-gate-scope.log` |

契约条目 → 套件落点（全部绿，同轮）：

| 契约条目 | 套件 | 关键观察 |
|---|---|---|
| AUTH-C1 | auth-parity | 控制帧 hex 逐帧等（`HELLO_ACK#1 OPEN_OK#2 OPEN_OK#4`）+ 骨架等 + `BOOTSTRAP_SNAPSHOT#3` 文档语义等；两形态 authorize 各恰一次、分片恰一会话 |
| AUTH-C2 | auth-parity | 全轨迹 hex 逐帧等（`UNAUTHORIZED#2` + `REOPEN_REQUIRES_RECONNECT#3`）；分片零会话/零解析 |
| AUTH-C3 | auth-parity | 全轨迹 hex 逐帧等（`INTERNAL_ERROR#2` + 重开拒答#3）；零会话；连接存活 |
| AUTH-C4 | auth-parity | 闩锁重开恰一帧且逐字节等；authorize 恰一次（两形态、deny/throw 两形） |
| AUTH-C5 (a)(b)(c) | auth-parity | 单体 vs 单体全轨迹**不等**（clientID 语料属性）；pass 单体 vs deny 分片控制帧**不等**；deny 零会话 vs pass 恰一会话 |
| NC2 / NC3 / NC4 | auth-parity | pass 重开 = `OPEN_OK×2`；deny 零会话；协商形态 parity 成立 + `HELLO_ACK.selectedCapabilities` 与描述子协商位可见 |
| ROUND 装配前提 | cross-seam-round | 每形态 boot 后 `worker.registry === run.hubNode.registry`（引用同一性） |
| ROUND-C1/C2/C3/C4 | cross-seam-round | `OPEN_OK×1`/`BOOTSTRAP×1`/`BOOTSTRAP_ACK` 回指/SYNC 三段齐备/live/`encodeStateAsUpdate` 收敛；双向 live UPDATE + ACK 回指 + 两侧 ROOT 更新（零 resync）；`CLOSE_OK` 回指 + `settled` 恰一次；协商形态全回合复跑 + 协商位 |
| ROUND 收尾（boot TERM 面） | cross-seam-round | `facade.close()` 幂等（同 promise）+ 会话全收口 + `run.hubNode.scheduler.pending()` 不增 + 推进 30s 零新出站 + 零 unhandled |
| SHARD-C1 / C2 / C3（NC1） | multi-worker | A/B 各恰一次解析、A→w0/B→w1、同 `connectionKey`；出站覆盖两 ns、每 ns `OPEN_OK` 恰一且先于 `BOOTSTRAP_SNAPSHOT`；未 OPEN 的第三 ns → 合成 `NAMESPACE_STATE_VIOLATION` + 零会话 + 连接存活 + 不落任一 worker + 双形态逐字节等 |
| SEQ-C1 | multi-worker | `[8..12]` = `1..N` 严格递增；每 ns 首帧序 = OPEN 注入序；同工厂第二连接首帧序 = 1 |
| TERM-C1 / C2 / C3 | lifecycle | close → `state=closed`、两会话 `closeCalls≥1`、推进 30s 零新出站；pending 不增 + 句柄 `close()` 同 promise + 零 unhandled；连接隔离负控（关其一 → 另一零 close/零新出站） |
| REVOKE-C1 / C2 / C3 | lifecycle | 末帧与单体 `revoke` 逐字节等 + `terminateCalls=1` + ns `UNAUTHORIZED` 帧；跨 worker 零外溢；未知/已终态 ns 幂等无副作用 |
| REAUTH-C1 / C2 | lifecycle | `GOAWAY(REAUTH_REQUIRED, drainTimeoutMs>0)`×1 → `CLOSE_NAMESPACE` → `settled`×1 → `close(1001)` 且零 deadline 触发；阴性对照不关闭 |
| SD-2(b) 退化负控 | lifecycle | factory 直连 accept（不登记）→ `HELLO_ACK×1` + 连接级 `ERROR(INTERNAL_ERROR)×1` + `close(1011,'protocol-error')` + 零会话 |

## Deferred verification

以下项**不属 SA3 验证范围**，留待后续角色（登记以便交接）：

1. **SA4/SA7 独立验证与 CI 裁决**：本报告的门禁日志是 SA3 自证；同轮全量套件与 DENY 面零 diff 的最终裁决归 SA4/SA7（含「套件未 fork 状态机、未越 DENY 面、硬门口径未漂移」的核对——SA8 前置 §10-2 义务）。
2. **SA6 探针与红臂**：`wiki/raw/task_issue-424_sa6_capability_probe.mts` + `artifacts/sa6-issue424-mutation-sensitivity.log` 按 DENY 保留、本轮**未重跑**（敏感性义务由负控 NC1–NC4 + AUTH-C5 与保留日志承载，设计 §7.8）。
3. **设计 §13 明确 follow-up（本票不做）**：SD-2/SD-3 约定的宿主指引规范化（`docs/**`）；γ 真 worker（worker_threads）形态；确定性 clientID 注入；「boot 形态 + 多会话宿主」夹具形态；以及若未来出现 `DEFAULT_REPLICATION_TIMEOUTS` 公共类型面调整的生产票（见 D5）。
4. **SA1 设计 §15 的 SA8 设计后复查义务**（迭代 1 修订增量：adopt 模式、删除路由形态 facade、`AdoptedWorker`/`RoutableWorker`）仍待 SA8 履行——本报告未代行。

## Deviations or blockers

无阻塞（无 SD-1 偏差：套件未暴露任何生产 wire/状态机偏差——全量同轮全绿）。实现与设计文本的**已登记差异**如下（全部落在 ALLOW 的 test-only 文件内，零契约条目削弱、零验收语义变更）：

| id | 差异 | 理由 |
|---|---|---|
| D1 | 夹具 `ShardedHost` 除 `acceptTrusted` 外**增补 `accept`**（设计 §8.1 草图只列 `acceptTrusted`） | facade 的 `accept` 是 boot 拨号路径（`driver.ts:535`），必须与 pipe 形态共享**同一**登记权威实现（§8.3.2-2「桥/登记/探针代码路径完全共享」）；否则 facade 需复制登记逻辑 = 第二写点 |
| D2 | `ShardedProbes` 在设计的 5 成员外增补 `authorizeCalls`（AUTH-C1/C4 的**分片侧**「authorize 恰一次」观察点）与 `handles`（TERM-C2「`close()` 幂等（同 promise）」观察点） | 两条契约条目在该观察面上承重；不增补则断言只能退化为间接推断 |
| D3 | `Trace` 增补 `resolves` 与 `handles` 字段 | SHARD-C1 判据原文引用 `probes.resolves`；TERM-C2 需要句柄面 |
| D4 | 夹具导出 `makeAccountingTimer()`（设计 §7.7 允许「注入假 timer」，§8.1 未列举） | 每个 pipe 场景都需注入 timer；REAUTH-C1 的「deadline 未 fire」判据 = `fires()===0` |
| D5 | `TIMEOUTS` 需一次**同值类型收窄**：`DEFAULT_REPLICATION_TIMEOUTS as SessionHostTimeouts` | 设计 §2.1/§8.1 称「`ResolvedTimeouts` 为空扩展、常量可直接赋」，但源码 `types.ts` 的 `ResolvedTimeouts` 把 `pingIntervalMs`/`pongTimeoutMs`/`assemblyTimeoutMs` **重声明为必填**，而常量声明类型 `Readonly<ReplicationTimeouts>` 三字段可选 ⟹ 直接赋值不过 typecheck。收窄的是**同一冻结对象**（零取值分叉、零 fallback/默认值复制、零深路径 import、零生产改动）；`LIMITS` 侧设计陈述成立、无需收窄。此项为**设计文本与源码类型面的精度差**，不是可就地修的生产缺陷（`packages/ws-replication/src/types.ts` 属 DENY；如需放宽常量声明类型应走新票） |
| D6 | 每场景/每轨迹各建 worker（同 seed 复用 ns 身份），而非跨轨迹复用同一 `ShardedWorker` | 落实 SD-3/§7.4 的「跨场景各自建工厂且各自建 SessionHost/Registry，键空间不交叉」——复用同一 SessionHost 会让第二个轨迹撞 `(connectionKey, namespaceId)` 重复键（`hub-session-host.ts:247-253` 响亮 throw） |

## Suggested commit message

```
test(ws-replication): add sharded-form end-to-end equivalence acceptance suites (#424)

Implement the approved SA1 iteration-1 design (spec #415 T7, issue #424) as test-only
deliverables; zero production/public-API/protocol/normative-doc changes.

- test/issue424-sharded-hub.ts: in-memory-pipe harness wiring the public
  createHubReplicationEdge (ingress) to >=2 public createHubSessionHost shards over
  real Registry/Runtime, with the SD-2(a) single registration authority, the four-member
  sink projection, probe faces, and the three-layer parity judges (L1 control-frame bytes,
  L2 data-frame document semantics, L3 full-trace skeleton). The HubReplication facade is
  adopt-shaped (registry required, no route) so boot-form misassembly is inexpressible and
  the hub-side observation surface stays same-source (design 8.3.1 / F-R1).
- test/ws-replication-issue424-{auth-parity,cross-seam-round,multi-worker,lifecycle}.test.ts:
  25 cases covering AUTH-C1..C5, ROUND-C1..C4 (+ premise assertion + boot teardown),
  SHARD-C1..C3, SEQ-C1, TERM-C1..C3, REVOKE-C1..C3, REAUTH-C1..C2 and the SD-2(b)
  degenerate-path negative control, with NC1..NC4 preserved.
- artifacts/issue424-*.log: same-round gate evidence (full suite 459 files / 5584 tests
  green, root + package typecheck exit 0, full DENY-surface zero diff), plus 3x
  determinism evidence for the focused suites.
```
