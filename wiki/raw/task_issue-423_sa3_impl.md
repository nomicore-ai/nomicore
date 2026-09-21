# SA3 Implementation Report

- 任务：issue #423（spec #415 T6）observer 发射点拆分与降级口径
- worktree：`/home/wangjian/nomicore-fix-issue-423`；基线 HEAD `1f5809b001c984e63fac3bafd4c1f3febc76e8a8`
- 阶段：implementation（iteration 0；本票首份 SA3 报告，工作树无既有 `_sa3_impl.md`、无未提交实现）

## Inputs consumed

| 输入 | 状态 | 消费方式 |
|---|---|---|
| `wiki/raw/task_issue-423.md`（任务简报） | 在场 | What-to-build + 6 条 AC 逐条对照实现面 |
| `wiki/raw/task_issue-423_design.md`（SA1 批准设计） | 在场 | **实现契约**：§D1（缺口 A）、§D2/§D3/§D4（缺口 B）、§D5（文档面）、§11 ALLOW/DENY、§12 验收映射 |
| `wiki/raw/task_issue-423_sa2_review.md`（SA2 评审，verdict = approve，0 BLOCKER/0 MAJOR） | 在场 | §13 无必需修订；§14 O1–O5 非阻断观察逐条落实（见下表） |
| `wiki/raw/task_issue-423_design_conflict_report.md`（SA8 设计冲突复查，verdict = clear） | 在场 | §8 Required actions 1–4 + §10 三项待闭合触发面逐条核对（见「SA8 约束落实」） |
| `wiki/raw/task_issue-423_sa6_contract.md` + `artifacts/sa6-issue423-contract-evidence.log` | 在场 | 验收契约（只读）；3 红基线 + 判据不可软化纪律 |
| `packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts` | 在场 | 红灯契约（21 用例，修改前 3 红 / 18 绿） |
| Owner 要求 | **无** | Host 简报「No owner requirements apply: REST comment read returned []」；SA6 §2 复核 comments = 0 |
| `_relevant_decisions.md` / `_conflict_report.md` / 旧 `_sa3_impl.md` / SA4 / SA7 报告 | 不存在 | 无返工输入、无 SA8 前置决议；约束面按 SA8 设计复查报告承接 |

## Existing worktree reconciliation

实现前工作树只含未跟踪的上游产物（简报/设计/SA2/SA6/SA8 报告、SA6 契约测试文件、SA6 证据日志），
**无既有实现改动、无待修订 `_sa3_impl.md`**（`git status --short` 核对）。本轮为首次实现，无需保留/回退。

红灯基线复现（实现前，与 SA6 §13 S0 逐字一致）：

```
NODE_OPTIONS=--conditions=nomicore-source npx vitest run \
  packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts
⇒ Test Files 1 failed (1); Tests 3 failed | 18 passed (21); Type Errors no errors
失败集合 = {EM-C2a（namespace-error{sent} 缺 connectionId）,
            EM-C4a（edge 盖章点零 update-sent）,
            EM-C4b（session 侧仍发射 update-sent）}
```

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/ws-replication/src/hub-edge-host.ts` | §D1 | `HostSessionAdapter` 三发射点（`synthesizeStateViolation` / `emitNamespaceErrorSent` / `emitNamespaceFailed`）统一经 `cidField(this.port.connectionId())` 条件展开追加 `connectionId`（+ `cidField` import） |
| `packages/ws-replication/src/hub-split.ts` | §D3.1 | 新增纯类型 `HubSendAccounting { readonly sendQueueMs?: number }`；`HubSessionEdgePort.sendDataFrame` 追加可选参数 `accounting?: HubSendAccounting`（append-only、结构化类型兼容） |
| `packages/ws-replication/src/hub-edge.ts` | §D2 | `makePort().sendDataFrame` 由直通改为包装（`seq > 0` 后发射）；新增 `emitUpdateSentAtStamp`（observer 门首行 + 型门/id 窗口/varUint 长度交叉校验 + `dispatchReplicationObserver` 单点分发）与模块级 `updateFrameProbe` / `readBe32At` / `readVarUintAt` / `UPDATE_FRAME_MIN_BYTES`（+ `ENVELOPE_HEADER_BYTES`、`MESSAGE_TYPES` import） |
| `packages/ws-replication/src/update-channel.ts` | §D3.2 | `UpdateChannelHost.sendUpdateFrame` 追加同形可选参数；`sendAndRegister` 采样点前移至发送调用边界（`sentAt`/`sendQueueMs` 先算后发，一次读数两用）+ accounting 透传；`noteUpdateSent` 契约注释更新（hub 侧消费方只剩 chunked 改道） |
| `packages/ws-replication/src/hub-namespace.ts` | §D3.1 / §D4.1 | `HubChannelHost.sendData` 追加同形可选参数；`sendUpdateFrame(bytes, accounting)` 透传；`UpdateChannel` 装配面 `sendUpdateFrame` 绑定箭头改双参透传；`onUpdateSent` 普通分支（`info.chunked === undefined`）**抑制发射**、chunked 分支原样 |
| `packages/ws-replication/src/hub-session.ts` | §D3.1（SA2 O2） | `channelHost.sendData` 绑定箭头与私有 `sendData(namespaceId, bytes, accounting?)` 显式三参透传至 `port.sendDataFrame(frame, accounting)` |
| `packages/ws-replication/test/ws-replication-issue423-update-offset-guard.test.ts`（新增） | §D2.3 / §D6（SA2 O5） | 布局守卫 10 用例：跨 lib0 varUint 1/2/3 字节边界的载荷长度判定 vs `decodeMessage`、id 窗口、型门、D6 畸形输入防御分支（零 throw/零事件/返回值不受影响）、记账投影两态 |
| `docs/protocols/instance-replication-v1.md` | §D5 | §17 `maxConcurrentAssembliesPerConnection` 条目**追加**分片形态 per-session 计数口径（聚合上界 = limits 值 × worker 数；listen 不变）；§23.1 `update-sent` 行尾**追加**发射点/缺面注记（字段集零变化）；§23.1 表组后**追加**「发射侧归属表（hub 拆分形态）」小节 + 形态差异登记；§22 conformance 清单**追加** #423 资产锚 |
| `docs/adr/0032-transport-decoupling-edge-session-split.md` | §D5 | 「后果」节**追加**决策 5 观测面落地注记（决策区与「否决的备选」原文零改动） |

## SA8 约束落实

SA8 设计冲突复查（`task_issue-423_design_conflict_report.md`，verdict = clear）§8/§10 的实现期义务：

| 约束 | 实现结果 | 证据 |
|---|---|---|
| §8-1 文档编辑严格**纯追加**；§23.1 字段表逐行零改动、ADR 决策区零改动 | 满足：`git diff docs/` 中 §17/§22 为新增行、ADR 为新增行；§23.1 仅 `update-sent` **行尾追加**注记（原字段声明文本逐字保留——设计 §D5 明文「行尾注记」）与表组后新增小节；`git diff --check` exit 0 | `git diff docs/`；`git diff --check` |
| §8-2 `HubSendAccounting` 保持内部（不得进 `index.ts`/`testing.ts`）；可选参形状不得收窄为必填 | 满足：类型只在 `hub-split.ts`（`src/index.ts` / `src/testing.ts` 零改动——DENY 路径 `git status` 无变化）；`sendDataFrame(frame, accounting?)` 保持可选，SA6 `makeStubPort` 单参桩与 #418/#421 桩类型兼容（全包 typecheck + 全量套件绿） | `git status --short`；`tsc -p packages/ws-replication/tsconfig.json` exit 0 |
| §8-3 DENY LIST 零改动；SA6 契约不得软化 | 满足：`observer.ts`/`frame-io.ts`/`types.ts`/`hub-connection.ts`/peer 面/`index.ts`/`testing.ts`/`replication-protocol/**` 全部零改动；契约文件零改动且 3 红经实现转绿（无 skip/only/todo/env override） | `git status --short` 仅含 ALLOW 路径；契约 3 连跑 21/21 绿 |
| §8-4 / §10 实现后复查面：键集/值恒等、EM-C7 金标、§23.3 在场纪律、公共面零变化 | 满足：EM-C4c/C7a/C7b/EM-C3c/EM-C2a 全绿；`bytes`/`sequence` 由帧字节与盖章返回值同点派生（§D2.3）；`connectionId` 经 `cidField` 单点沿用；`git diff` 无公共入口文件 | 契约与守卫测试证据；`git diff --stat` |

## SA2 Finding落实（§14 O1–O5；§13 无 BLOCKER/MAJOR）

| Finding ID | Implementation | Result |
|---|---|---|
| O1（`readBe32` 为 envelope 模块私有；需本地 BE32 读） | `hub-edge.ts` 新增模块级 `readBe32At`（与 `frame-io.ts:201-206` 写侧同款本地分层），未 import 协议内部函数 | 落实 |
| O2（两处绑定箭头 typecheck 不强制；各留一行注释） | `hub-session.ts` `sendData` 绑定箭头改显式三参 + `hub-namespace.ts` `UpdateChannel` 装配面 `sendUpdateFrame` 绑定箭头改双参透传；两处各留「缺失即 EM-C4c 红」注释 | 落实（EM-C4c 绿即证链路完整） |
| O3（三处同形拼写互指注释） | `update-channel.ts`（`UpdateChannelHost.sendUpdateFrame`）、`hub-namespace.ts`（`HubChannelHost.sendData`）、`hub-split.ts`（`HubSendAccounting`）三处注释互指「同形同步维护」 | 落实 |
| O4（钉死采样点前移的两个事实） | 实现处注释钉死：①「采样点 = 发送调用边界，值恒等依赖发送栈零时钟读」；②「edge 的 update-sent 同步发射**先于** `inFlight.set`/`armAckTimer`，两点之间零 observer 事件 ⇒ 组合序列逐字不变」 | 落实 |
| O5（守卫测试补 2–3 条畸形输入用例，断言零 throw + 零事件 + 返回值不受影响） | 守卫测试 OG-3（id 长度前缀腐蚀 ×2）、OG-4a（短帧 ×3）、OG-4b（payloadLength 不自洽）、OG-4c（非规范 varUint 续位 ×2）——全部断言零 throw、零 `update-sent`、返回值 = wire `[8..12]` | 落实 |

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/ws-replication/src/hub-edge-host.ts` | ALLOW 第 1 行 | 缺口 A（§D1）：三发射点 `connectionId` 在场投影 |
| `packages/ws-replication/src/hub-edge.ts` | ALLOW 第 2 行 | 缺口 B（§D2）：edge 盖章点单点发射 + 定偏移判定 |
| `packages/ws-replication/src/hub-split.ts` | ALLOW 第 3 行 | 缝投影类型 + 可选参 append（§D3.1） |
| `packages/ws-replication/src/hub-session.ts` | ALLOW 第 4 行 | accounting 透传（§D3.1；SA2 O2 点名绑定箭头） |
| `packages/ws-replication/src/hub-namespace.ts` | ALLOW 第 5 行 | 透传线程 + 普通帧抑制（§D3.1/§D4.1） |
| `packages/ws-replication/src/update-channel.ts` | ALLOW 第 6 行 | 投影生产点：采样点前移 + accounting（§D3.2） |
| `packages/ws-replication/test/ws-replication-issue423-update-offset-guard.test.ts` | ALLOW 第 7 行 | 定偏移布局守卫（§D2.3/§D6、SA2 O5） |
| `docs/protocols/instance-replication-v1.md` | ALLOW 第 8 行 | AC5 文档面（§D5：§17/§22/§23.1） |
| `docs/adr/0032-transport-decoupling-edge-session-split.md` | ALLOW 第 9 行 | AC5 文档面（§D5：后果节注记） |
| `wiki/raw/task_issue-423_sa3_impl.md`（本文件） | 报告产物（skill 固定输出） | 实现报告 |

**DENY LIST 核对**：`git status --short` 不含 `src/index.ts`、`src/testing.ts`、`src/types.ts`、`src/observer.ts`、
`src/frame-io.ts`、`src/backpressure.ts`、`src/hub-connection.ts`、`src/peer-connection.ts`、`src/peer-namespace.ts`、
`src/hub-upgrade-admission.ts`、`src/liveness.ts`、`src/plugin.ts`、`src/defaults.ts`、`src/validate.ts`、
`packages/replication-protocol/**`、SA6 契约测试文件、`wiki/raw/task_issue-423_sa6_contract.md`、
`artifacts/sa6-issue423-contract-evidence.log`、其余既有测试文件——**全部零改动**。

## Verification

| Command | Result | Evidence |
|---|---|---|
| `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts`（实现前） | 3 failed / 18 passed（复现 SA6 §13 S0） | 失败集合 = {EM-C2a, EM-C4a, EM-C4b}，断言文本与 SA6 §12.3 逐字一致 |
| 同上（实现后 ×3 连续） | **每轮 21 passed (21)**、`Type Errors no errors` | 3 红全部转绿且结果稳定（无 flake）；断言零软化（契约文件零改动） |
| `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication/test/ws-replication-issue423-update-offset-guard.test.ts` | **10 passed (10)**、`Type Errors no errors` | 新增守卫：varUint 1/2/3 字节边界 + 确定性取样（127\|128、16383\|16384\|16385 等 12 值）判定 === `decodeMessage(...).update.byteLength`；型门（UPDATE_CHUNK 0x42 / OPEN_OK 0x11 零事件）；id 窗口；D6 畸形输入（短帧/长度不自洽/非规范续位）零 throw 零事件且返回值 = wire `[8..12]`；记账投影两态（在场透传 / 缺省整键缺席 / seq=0 零事件） |
| `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication` | **86 files / 717 tests 全绿**、`Type Errors no errors` | 既有回归面（含 `issue238-segmented-observation` 精确 `sendQueueMs`、`observer-red` 键集白名单、`issue238-repro`/`issue230` 序列关联、`issue243`/`issue245` chunked 族、`issue418`/`issue421` 拒绝路径、peer 全套件）全绿；新增守卫文件被 runner 发现 |
| `npx tsc -p packages/ws-replication/tsconfig.json` | exit 0 | 受影响 package typecheck（含 peer 侧少参实现兼容、测试桩类型兼容） |
| `pnpm typecheck`（根，15 个 tsconfig） | exit 0 | 跨包类型面无影响（设计 §12 记为 Host 面；本次附带执行，非 SA3 职责扩张） |
| `git diff --check` | exit 0 | 无空白/冲突标记（`docs/AGENTS.md` 验证纪律） |

**AC 映射（实现面）**：AC1 → EM-C1a–e + EM-C4a/c 绿；AC2 → EM-C3a–d 绿；AC3 → EM-C2a/b/c 绿（红灯本体转绿）；
AC4 → EM-C5a/b 绿（`dispatchReplicationObserver` 单点零改动）；AC5 → 文档三处追加落地 + EM-C6a/b 绿（listen 计数口径回归锚）；
AC6 → EM-C7a/b 拆分前金标逐字相等绿。

## Deferred verification

以下**不属 SA3 职责**，登记供后续角色（SA4/SA7/Host）执行：

1. 根 `pnpm test`（全仓 14 包 + `apps/yjs-server`）——SA3 已跑受影响 package 全量套件与根 typecheck；根 test 由 Host 按流程执行（SA6 U6）。
2. 分片形态运行时锚（真正的 worker 进程 / `listen: false` SessionHost 插件端到端 + per-session 计数实测）——依赖 T3(#420)/T5(#422) 未落地（SA6 U4；设计 §13 登记为 follow-up）；本票交付文档面与内部缝等价面。
3. 真实 WebSocket / 真实时钟域下的 `sendQueueMs` 数值残差观测（同步栈时长级，微秒）——无契约断言绝对值；手动时钟域逐值恒等已由 EM-C4c/EM-C7a 与 `issue238` 精确断言锚定。
4. `requiresConflictRecheck = true`：SA8 §10 三项待闭合面中，②（缝签名 append）与 ③（冻结事件形状构造点迁移）已由本实现闭合，①（规范文档编辑为纯追加）已逐字核对；**是否将标记降为 `false` 属 SA8 裁决**，SA3 不自行裁决。

## Deviations or blockers

- **无设计偏离、无阻塞**。实现严格落在设计 §11 ALLOW LIST 内，未新增公共 API / 事件型 / 字段 / 错误码 / wire 变化。
- 一处精度说明（非偏离）：设计 §D3.1 线程表列出 5 层透传成员；实现额外把 `hub-namespace.ts` 的 `UpdateChannel` 装配绑定箭头（`sendUpdateFrame: (bytes, accounting) => …`）显式改为双参——该绑定属设计 §10 调用方影响矩阵内 `hub-namespace.ts` 改动面（SA2 O2 点名），非范围扩张。
- 一处措辞说明（非偏离）：§23.1 `update-sent` 行按设计 §D5「行尾注记」在**原行尾追加**发射点注记（原字段声明文本逐字保留、字段集零变化）；SA8 §8-1「字段表逐行零改动」的实质（事件型/字段/语义零变化）满足，行文本本身按设计 §D5 预期追加注记。

## Suggested commit message

```
feat(ws-replication): split observer emission points (issue #423)

Move hub-side `update-sent` to the edge stamping point (ADR 0032 decision 5):
edge emits exactly one event per emitted UPDATE frame from `seq > 0` in the
single data-frame funnel (`port.sendDataFrame`), deriving `sequence`/`bytes`/
`namespaceId` from the frame bytes by fixed-offset reads; the session side stops
emitting `update-sent` for plain frames while `chunked-update-sent` keeps its
session-side reroute. `sendQueueMs` rides the seam as an append-only pure-JSON
accounting projection (`HubSendAccounting`) sampled at the send call boundary in
the session clock domain; host-driven egress frames carry no accounting, so the
key is absent (dormant missing-face discipline).

Close the #421 field gap: the edge-replicated denial/synthesis emit points
(`namespace-error{sent}` / `namespace-failed{open-failed}`) now carry
`connectionId` via the `cidField` single point, matching §23.3 presence
discipline in the monolithic form.

Docs: register the per-session `maxConcurrentAssembliesPerConnection` aggregate
bound (limits × workers; listen mode unchanged) in protocol §17, annotate the
`update-sent` row, add the hub split-form emission-side attribution table
(including the no-`channel-state-changed` shape difference) in §23.1, add the
§22 conformance asset anchor, and note the landing in ADR 0032 consequences.

Tests: SA6 contract 3 red → 21 green; new fixed-offset layout guard across lib0
varUint 1/2/3 byte boundaries; package suite 86 files / 717 tests green;
package and root typecheck exit 0.
```
