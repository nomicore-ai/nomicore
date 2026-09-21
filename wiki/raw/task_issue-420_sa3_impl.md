# SA3 Implementation Report — issue #420：SessionHost 公共工厂 + 内存管道完整协议回合（spec #415 T3）

- 派工：`sa-21b8addd-f3ef-41b2-a768-c5530fc7c893`（role `mabf-sa3`，phase implementation，iteration 0）
- worktree / branch：`/home/wangjian/nomicore-fix-issue-420`，`mabf/issue-420`
- 基线 HEAD：`7039f6dae8e7d29f0c929492f0ca2119bc63afaa`（= PR #426 merge）；实施期间零 commit / 零 push
- Owner 评论：无（派工明文 none；REST comments = `[]`）⇒ 无逐条评论映射可建

---

## Inputs consumed

| 输入 | 用途 |
| --- | --- |
| `wiki/raw/task_issue-420.md` | Issue 正文 AC1–AC5、非目标 |
| `wiki/raw/task_issue-420_sa6_contract.md` | **冻结契约**：§12.1 公共签名逐字、§12.2 A1–A12、§12.3 AC3 机制 (a)、§12.4 C4a–C4d、§12.5 C5a–C5d、§12.6 两处授权编辑、§12.7 M1–M7、§12.0 运行命令 |
| `wiki/raw/task_issue-420_design.md`（iteration 1） | ALLOW/DENY LIST、§7 D1–D10、§12 验收映射、§14 SA2-F1 修订映射 |
| `wiki/raw/task_issue-420_sa2_review.md` | verdict **approve**（SA2-F1 已解决；N1'–N3' 非阻断观察） |
| `wiki/raw/task_issue-420_conflict_report.md` | SA8 前置门禁 **clear**（RA1–RA5、S1–S6） |
| `wiki/raw/task_issue-420_relevant_decisions.md` | ADR 0032 决策 1–5、CONTEXT.md:225-235、协议 §4/§7.1/§8-11/§13/§14/§17/§19/§23.1 |
| `wiki/raw/task_issue-420_design_conflict_report.md` | SA8 design 复查 **clear**（RA1'–RA6'，35 项对照） |
| `artifacts/sa6-issue420-*`（16 项） | 能力缺口/因果/序列纪律/纯度/中继保真探针与基线日志 |
| 源码开卷核对 | `src/{index,hub-session,hub-split,hub-edge,hub-connection,hub-namespace,frame-io,observer,defaults,validate,types}.ts`；`test/{harness,driver}.ts`、7 矩阵文件、#418 两冻结锚文件、`vitest.config.ts`、`packages/*/tsconfig*`、`package.json` |

---

## Existing worktree reconciliation

| 项 | 事实 |
| --- | --- |
| 既有 `wiki/raw/task_issue-420_sa3_impl.md` | **不存在**（本轮首次实现；`ls` 核对） |
| 未提交实现残留 | **无**：初始 `git status --short` 仅显示 SA6 诊断产物（`artifacts/sa6-issue420-*`）与 wiki 输入（`??`）；`packages/**`/`docs/**` 零 diff |
| SA6 诊断资产 | 原样保留（未修改）；其中 3 个 `.mts` 引用被本轮授权重命名替换的内部名——登记见「Deviations」第 2 条 |
| 授权编辑核对 | #418 contract 测试 `FROZEN_PRODUCTION_EXPORTS` 由 11 → 12 名（仅插入 `'createHubSessionHost'`，字母序零重排）；structure 测试仅机械跟随重命名 |
| 决策面核对 | 公共冻结签名逐字采用 SA6 §12.1；`hub-namespace.ts`/`hub-edge.ts`/`src/testing.ts`/协议文本/上游包 **零 diff**（见 Verification V8） |

---

## Changed paths

| Path | Design section | Change |
| --- | --- | --- |
| `packages/ws-replication/src/hub-session-host.ts` | §7 D1–D5 | **新增**（280 行）：公共冻结面（1 工厂 + 7 类型，逐字 SA6 §12.1）+ 句柄实现 + adapterPort（17 成员：闭包回放 ok-投影、字节出入、占位/回传序、dormant 面、observer 单点复用、信号面） |
| `packages/ws-replication/src/index.ts` | §7 D9 / AC1 / S5 | 追加 1 值导出 `createHubSessionHost` + 7 类型导出（append-only，11 → 12 值） |
| `packages/ws-replication/src/hub-session.ts` | §7 D9（U1） | 机械重命名：`createHubSessionHost`→`createHubSessionSink`、`HubSessionHostConfig`→`HubSessionSinkConfig`、删 `HubSessionHost = HubSessionSink` 别名、`HubSessionSinkImpl`；头注补公共工厂指引（零行为） |
| `packages/ws-replication/src/hub-connection.ts` | §7 D9 | import/调用点/头注机械跟随（3 行） |
| `packages/ws-replication/src/hub-split.ts` | §7 D9（仅头注） | 头注「绝不进 src/index.ts」→ 三工厂现状（成员/类型零变化） |
| `packages/ws-replication/test/issue420-shim-hub.ts` | §7 D6/D7 | **新增**（夹具）：宿主桥（三分支路由 + 有界 pending + 载体提交 + E10 兜底 + closed 守卫 + terminate 相位挂起）+ shim hub（accept/acceptTrusted 门链镜像 + 早到帧有界缓冲 + 真 edge 装配）+ 探针 |
| `packages/ws-replication/test/ws-replication-issue420-session-host-api.test-d.ts` | §12.1 / AC1 | **新增**：冻结签名正控全集 + 负控 `@ts-expect-error` ×6（denied 投影 / authorize / transport / port / `namespaceFrame` / `onFrame` 无 number） |
| `packages/ws-replication/test/ws-replication-issue420-session-host-round.test.ts` | §12.2 / §12.4 / §12.5 | **新增**：A1–A12 + C4a–C4d + C5a–C5c（内存管道对完整回合，无 socket 无 worker） |
| `packages/ws-replication/test/ws-replication-issue420-shim-matrix.test.ts` | §12.3（机制 (a)） | **新增**：`vi.mock` 仅替换 `createHubReplication` + 动态 import 7 矩阵文件（断言体零编辑）+ 末位反空跑 describe + 同 run unhandled rejection 哨兵 |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts` | §12.6 授权编辑 1 | `FROZEN_PRODUCTION_EXPORTS` 插入 1 行（零删除零重排） |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-structure.test.ts` | §12.6 授权编辑 2 | 7 行机械跟随（:13 注释、:39 导入、:421/:528/:571/:594 调用、:618 期望列表） |
| `docs/adr/0032-transport-decoupling-edge-session-split.md` | §7 D10 / RA1（E1+E2） | 澄清附录 +23 行：A1 信号词汇公共面映射（含 `connection-fatal` 公共化登记、同步 pipe 边界）、A2 决策 3 三载体调和（α/β/γ + 重 OPEN 语义）、A3 决策 5 dormant 降级 + U8 登记 |
| `CONTEXT.md`（:229-231） | §7 D10 / RA1（E2） | 「SessionHost」词条补公共工厂轨形态（描述子字段、句柄成员、denied/throw 不过公共缝、内部 splice 拉取式）与 _Avoid_ 一项 |

---

## SA2 Finding落实

| Finding ID | Implementation | Result |
| --- | --- | --- |
| **SA2-F1（MAJOR，设计 iter 1 已解决）** 桥 `openNamespace` 缺「同连接再 OPEN / authorized 在途 OPEN」分支 | 夹具 `HostBridge.openNamespace` 落**三分支路由**：① 相位 `authorized` → 不再调 `open()`，OPEN 帧字节经既有句柄 `handleFrame` 转发（`reopenForwarded` 探针）；② 相位 `routing` → 入与 `namespaceFrame` 同一有界 pending 窗口（≤16 帧/ns + 单帧 ≤ `maxFrameBytes`，溢出 `CONNECTION_POLICY_VIOLATION`(1008) 响亮收口），authorized 续体**同步段内**冲刷（`pendingFlushed` 探针）；③ 相位 `denied` → `denialSink.openNamespace`（生产 `onOpen` 承接重开矩阵）。路由相位互斥、单调、不可逆；closed 守卫放弃在途路由 | **已落实**。证据：矩阵 `ac1-ac2-open.test.ts:212`（opening 中重复 OPEN → `OPEN_OK`×2 + authorize 恰一次）与 `:240`（conflicted 后再 OPEN → `NAMESPACE_REOPEN_REQUIRES_RECONNECT`）在 shim 臂**断言逐字不变**全绿（V3/V4）；变异 M7（再 OPEN 重入 `open()` → 重复前置 throw）与 M7b（丢弃在途 OPEN）分别使两用例转红（V9/V10） |
| N1'（非阻断）closed 守卫放弃在途路由时挂起的 `terminateNamespace` promise 归宿未明示 | `terminateNamespace` 相位 `routing` → 挂起至路由完成（`settleTerminateWaiters` 按结局委托句柄/denialSink）；桥 closed 或续体异常 → **no-op resolve**（镜像 listen quiet 语义） | 已落实（A10 live 直调绿；该角落无验收路径触达，登记为 R11 同族） |
| N2'（非阻断）「pending 冲刷必须在续体同一同步段内完成」为隐式不变量 | `flushAuthorized`/`flushDenied` 在续体同步段内调用（相位置位后、无 await 间隔）；头注登记该不变量 | 已落实（矩阵 `:212` 用例即其载荷路径；M7b 反证） |
| N3'（非阻断）设计 :188 Map 键模板排版笔误 | 实现按语义落 `${connectionKey}\u0000${namespaceId}` | 已落实 |
| N1/N2/N3/N5/N6（iteration 0 遗留） | N1 → 夹具头注登记 accept 门链保真度差异清单；N2 → 本报告「Changed paths」单列 `hub-split.ts` 头注；N3 → 句柄连接投影头注登记 {ready, closed} 两态；N5/N6 → 维持登记 | 已按设计 §14 处置 |

---

## File scope check

| Changed path | ALLOW entry | Purpose |
| --- | --- | --- |
| `packages/ws-replication/src/hub-session-host.ts` | ALLOW 第 1 条（新增） | D1/D2/D3/D4/D5 唯一新生产代码 |
| `packages/ws-replication/src/index.ts` | ALLOW 第 2 条（追加导出） | AC1/S5 append-only |
| `packages/ws-replication/src/hub-session.ts` | ALLOW 第 3 条（重命名 + 别名删除 + 头注） | D9/U1 |
| `packages/ws-replication/src/hub-connection.ts` | ALLOW 第 4 条（机械跟随） | D9 |
| `packages/ws-replication/src/hub-split.ts` | ALLOW 第 5 条（**仅头注**） | D9（注释真实性；SA2 N2 单列登记） |
| `packages/ws-replication/test/issue420-shim-hub.ts` | ALLOW 第 6 条（新增夹具） | D6/D7；仅深路径 import（D8 mock 安全） |
| `packages/ws-replication/test/ws-replication-issue420-session-host-api.test-d.ts` | ALLOW 第 7 条（新增） | AC1 类型冻结 |
| `packages/ws-replication/test/ws-replication-issue420-session-host-round.test.ts` | ALLOW 第 8 条（新增） | AC2 A1–A12 + AC5 C5a–C5c + AC4 C4a–C4d |
| `packages/ws-replication/test/ws-replication-issue420-shim-matrix.test.ts` | ALLOW 第 9 条（新增） | AC3 机制 (a) + 反空跑 + 零 unhandled rejection |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts` | ALLOW 第 10 条（§12.6 授权编辑 1） | 冻结导出表插 1 行 |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-structure.test.ts` | ALLOW 第 11 条（§12.6 授权编辑 2） | 机械跟随内部重命名 |
| `docs/adr/0032-transport-decoupling-edge-session-split.md` | ALLOW 第 12 条（澄清附录 E1/E2） | RA1 |
| `CONTEXT.md`（:229-231） | ALLOW 第 13 条（词条更新） | RA1/E2 |

- 每个实际 changed path 均有 ALLOW 条目；**无 ALLOW 外改动**（V8 全量审计）。
- DENY LIST 逐项零 diff：`hub-namespace.ts`/`hub-edge.ts`/`src/testing.ts`/其余 src 单点/协议文本/上游包/`apps`/`domains`/`package.json`/7 矩阵文件（后者仅经 `vi.mock` 二次执行，零编辑）。

---

## Verification

> 全部命令在 worktree 根执行；日志 `artifacts/sa3-issue420-*.log`（worktree-relative）。最终冻结态顺序重跑（无并发变异探针）。

| # | Command | Result | Evidence |
| --- | --- | --- | --- |
| V1 | `pnpm exec tsc -p packages/ws-replication/tsconfig.json`（**红阶段**，实现前） | **红**：8 × `TS2305`（7 类型 + 工厂缺）+ `TS2307`（模块缺）+ 级联；`[tsc exit: 2]` | `artifacts/sa3-issue420-red-package-tsc.log` |
| V2 | `vitest run --typecheck <三契约路径>`（**红阶段**） | **红**：`Test Files 3 failed`、`Errors 7 errors`、`vitest exit: 1`（红因 = 能力缺口/模块缺席，与 SA6 `type-lock-red` 同形） | `artifacts/sa3-issue420-red-contract.log` |
| V3 | `vitest run --typecheck <三契约路径>`（**绿**） | **绿**：`Test Files 3 passed (3)` / `Tests 63 passed (63)` / `Type Errors no errors` / `[vitest exit: 0]` | `artifacts/sa3-issue420-green-contract.log` |
| V4 | `vitest run --typecheck packages/ws-replication/test`（包全量；listen 臂 + 新三文件） | **绿**：`Test Files 80 passed (80)` / `Tests 651 passed (651)` / `Type Errors no errors` / exit 0（SA6 基线 77/588 ⇒ +3 文件/+63 用例，零回归） | `artifacts/sa3-issue420-package-suite.log` |
| V5 | `pnpm exec tsc -p packages/ws-replication/tsconfig.json`（绿） | **绿**：`[tsc exit: 0]`（含 test-d 负控 `@ts-expect-error` 全部被触发，无 TS2578） | `artifacts/sa3-issue420-package-tsc.log` |
| V6 | `pnpm typecheck`（根，15 tsconfig 串行） | **绿**：`[typecheck exit: 0]` | `artifacts/sa3-issue420-root-typecheck.log` |
| V7 | `NODE_OPTIONS=--conditions=nomicore-source pnpm test`（根全量） | **绿**：`Test Files 443 passed (443)` / `Tests 5381 passed (5381)` / `Type Errors no errors` / `[root test exit: 0]` | `artifacts/sa3-issue420-root-test.log` |
| V8 | 结构/范围独立复核：`git diff --stat <DENY 全表>`（空）；`git diff --check`（clean）；`grep -rlE 'worker_threads\|MessageChannel\|MessagePort' packages/ws-replication/src packages/ws-replication/package.json \| wc -l` → `0`；node 侧 `Object.keys(@nomicore/ws-replication).sort()` → 12 名（11 冻结名 + `createHubSessionHost`，字母序位于 `createHubReplicationPlugin` 与 `createPeerReplication` 之间） | **符合**：DENY 零 diff、AC4 结构门 0 命中、导出恰增一名 | 本报告 §File scope check + V7/V3（C4a 结构门在测试内亦绿） |
| V9 | 变异 **M7**（再 OPEN 重入 `open()` → 重复前置 throw；临时改动，已复原）：`vitest run <shim 矩阵>` | **红**：`Tests 2 failed \| 51 passed`；`:240` 用例失败（`REPLICATION_ID_MISMATCH` ≠ `NAMESPACE_REOPEN_REQUIRES_RECONNECT`）+ 反空跑（`INTERNAL_ERROR` 签名）+ 日志含 `hub-session-host: (connectionKey, namespaceId) 重复开启` | `artifacts/sa3-issue420-mutation-M7-reopen-reentry.log` |
| V10 | 变异 **M7b**（丢弃在途 OPEN，取消分支 ②；已复原） | **红**：`:212` 用例失败（`opening 中重复 OPEN` 无第二 `OPEN_OK`）+ 反空跑 | `artifacts/sa3-issue420-mutation-M7b-drop-inflight-open.log` |
| V11 | 变异 **M4**（关闭 shim 替换，矩阵臂跑回 listen；已复原） | **红**：`Tests 1 failed \| 52 passed`——恰好末位反空跑 describe 红（52 listen 用例仍绿 ⇒ 反空跑判据非恒真） | `artifacts/sa3-issue420-mutation-M4-disable-shim.log` |
| V12 | 变异 **M5**（session 解码自行重检入站序；已复原） | **红**：`Tests 9 failed`，含 C5a 正锚与 C5c 结构门（`expectedSequence` 出现在 `src/hub-session-host.ts`） | `artifacts/sa3-issue420-mutation-M5-session-resequence-check.log` |
| V13 | 变异 **M2**（桥丢弃首 OPEN 转发；已复原） | **红**：`Tests 9 failed \| 1 passed`（A4 无 `OPEN_OK` 起全回合断言链断） | `artifacts/sa3-issue420-mutation-M2-drop-open.log` |
| V14 | 变异 **M3**（桥二次盖章序列；已复原） | **红**：`Tests 7 failed \| 3 passed`（含 A4–A8 缝序/wire 序纪律） | `artifacts/sa3-issue420-mutation-M3-restamp-sequence.log` |
| V15 | **M1**（内建红臂 A12：宿主不回传被分配序） | **绿/红按设计**：断言绿（观察到 `ACK_STATE_VIOLATION` 连接级 ERROR + `close(1002,'protocol-error')` + onSignal 命中），被断言对象红（回合不可达 `live`） | `artifacts/sa3-issue420-green-contract.log`（A12 用例）+ `artifacts/sa3-issue420-mutation-M1-a12-red-arm.log` |
| V16 | **M6**（公共入口去掉导出 = HEAD 态） | 已由 V1/V2 承载（红因 = 缺导出/缺模块） | `artifacts/sa3-issue420-red-*.log` |

**验收契约覆盖**：AC1（V3 类型冻结 + V8 导出面）、AC2 A1–A12（V3/V15：A2 纯 JSON+`DataCloneError` 负控、A3 kind ⊆ namespace 域、A4 `OPEN_OK`×1 + authorize×1 + W2 `NAMESPACE_NOT_FOUND` 负控、A5 快照序回指 + reconciling、A6 双向收敛、A7 双向 UPDATE/ACK + `update-acked` 零 resync、A8 wire 严格 +1 无 0 泄漏 + 出站占位 0/入站 wire 序、A9 `CLOSE_OK` 回指 + settled 恰一次、A10 revoke 收口零 fatal、A11 `close()` 幂等 drain + 零 unhandled、A12 红臂）、AC3（V4 60 用例 shim 臂 + 反空跑 + 零 unhandled；V11 负控）、AC4（C4a 结构门 + C4b/c/d）、AC5（C5a 回退序仍被消费 + `CLOSE_OK{ackedSequence:2}`、C5b edge 单点、C5c 结构门；V12 变异）。

---

## Deferred verification

| 项 | 归属 |
| --- | --- |
| 回归面扩大（真实 transport 动态、registry/scheduler 家族、backpressure/shed 族、跨包集成） | SA4/SA7（本报告只跑 SA6 指定面 + 全量套件，不承担最终动态验证） |
| SA8 implementation 段冲突复查（R8''/RA3'/RA6'：零 diff 核对、导出恰增、S2 有界事实、observer 隔离单点、反空跑与 M1–M7 实跑登记、重命名纯机械） | SA8（触发条件三合一已在实现 diff 后成立） |
| 真 worker / 异步序回传形态、跨线程 pending 义务重入 | 后续票（U2/RA5'；本票只冻结同步宿主 pipe） |
| `listen:false` 插件 + `nomicoreHubSessionHost` 服务轨、peer 侧拆分、nomic-server 宿主接线、跨进程 revoke 全链路 | 后续票（设计 §1 非目标） |
| R6（`selectedCapabilities` 单 bit 反推）、R7（authorized 通道不投影 edge `.channels`）、R11（在途 revoke 时序观测边界）、R12（accept 门链保真度差异） | 已在夹具/设计登记；未来矩阵扩场景前须先扩设计 |

---

## Deviations or blockers

### 1（落实偏差，已登记，需 SA8 impl 复查裁决）：夹具「载体提交」替换设计 §7 D7 中「routing 相位非 OPEN 帧入 pending 窗口」的字面机制

- **事实**：设计 §7 D7 的 `namespaceFrame` 行规定相位 `routing` 的非 OPEN 帧入有界 pending 窗口（并自注「实践不可达：守规 peer 在 OPEN_OK 前零后续帧」）。但**冻结契约 AC3 的七文件矩阵中 `ws-replication-ac7-faults.test.ts:32-56` 故意注入该形态**：授权门闩悬挂时注入 UPDATE 并**在门闩释放之前**断言 wire 上出现 `NAMESPACE_STATE_VIOLATION`。字面实现下该帧留在窗口、ERROR 被推迟到结算之后 ⇒ 该用例红。
- **实测证据**：按设计字面实现的变体跑 shim 矩阵 → `Tests 2 failed | 51 passed`，失败项正是 `AC7 …错序：OPEN_OK 之前的 UPDATE → NAMESPACE_STATE_VIOLATION`（`artifacts/sa3-issue420-design-letter-divergence.log`）。
- **落地机制**（`test/issue420-shim-hub.ts`，夹具内装配路由）：相位 `routing` 下的**非 OPEN** ns 域帧改为**立即把该 ns 提交给 `denialSink`**（= 生产内部 splice + 真 port，与 listen 在首 OPEN 到达点建成的通道**同一生产机械**）：`denialSink.openNamespace(firstOpen)` → `denialSink.namespaceFrame(frame, sequence)`；相位置吸收态（不再创建公共句柄），入窗 OPEN 条目随提交放弃（listen：abort 时 `openWaiters` 静默丢弃）。OPEN 帧仍走上文分支 ② 的有界 pending 窗口（SA2-F1 要求原样）。
- **为何不是新架构/新协议决策**：① 承载机械仍是 nomicore 生产代码（决策 1「分布式实例化」许可），夹具零应答合成、零错误码选择、零 FSM；② 结果与 listen **逐点同构**（违例 ERROR 由通道自身状态机在同一到达点产出；后续帧由生产通道 quiet/terminal 守卫吸收；重 OPEN 落 `NAMESPACE_REOPEN_REQUIRES_RECONNECT`）；③ 不触公共冻结签名、DENY 面、port 17 成员集、U3 裁决方向、验收语义与任何断言；④ 改动面限于 ALLOW LIST 内夹具文件。
- **影响与请求**：请求 SA8 implementation 复查把本条与设计 §7 D7 文本差异一并裁决（建议方向：把 D7 的 `namespaceFrame` 行补成「非 OPEN 帧在 routing 相位即时提交生产承载；在途 OPEN 入有界 pending 窗口」）。SA3 不改设计文件（按 skill 边界）。

### 2（登记，非阻断）：SA6 三个诊断探针因授权重命名而陈旧

`artifacts/sa6-issue420-{capability-gap,causality,sequence-discipline}-probe.mts` 仍 import `../packages/ws-replication/src/hub-session.ts` 的旧名 `createHubSessionHost`（SA6 §16 保留的诊断资产）。该重命名由 SA6 §12.6/U1 明文授权；探针**不在任何 tsconfig/vitest/脚本 include 面**（`grep artifacts/ tsconfig*.json vitest.config.ts package.json` 零命中），不构成 gate 影响；`artifacts/**` 不在本票 ALLOW LIST ⇒ SA3 未修改，登记给 SA6/Controller（重跑探针需把 import/调用名换为 `createHubSessionSink`）。

### 3（测试锚替换，非契约软化）：AC3 反空跑中的 `ACK_STATE_VIOLATION` 锚点

SA6 §12.3 的反空跑举例含「生产信号面在场」。实测发现 `ac5-live` 的 `ACK_STATE_VIOLATION` 用例是 **peer 侧** fatal（`injectHub` 注入未知 `ackedSequence`），不经过本桥 `onSignal`；故末位 describe 改为锚 `settled`（≥1，经 `onSignal` 到达 edge）＋ 全 run 零 `INTERNAL_ERROR`（重复 `open()`/续体异常的红臂签名）＋ `carrierCommitted`/`reopenForwarded`/`pendingFlushed` 计数阈值。`connection-fatal` 通路的正控由回合测试 A12 红臂承担（断言绿/回合红）。矩阵断言体、验收语义与阈值强度未降低（V11 M4 反空跑负控仍红）。

### 4（无阻断项）：设计/ALLOW/契约均可实施，无 reject 事由

除上条 1 的机制替换外，设计 ALLOW/DENY、SA2 三项 required change、SA8 RA1'–RA6' 的落地面无阻塞；未发现需修改设计、扩大范围或改变验收语义的事项。

---

## Suggested commit message

```
feat(ws-replication): 导出 SessionHost 公共 byte-seam 工厂 + 内存管道完整回合（issue #420）

- 新增 src/hub-session-host.ts：createHubSessionHost 工厂 + 7 冻结类型 + adapterPort
  （open() 描述子纯 JSON / handleFrame 字节入帧不重检序 / onFrame 同步回传被分配 wire 序 /
  onSignal{settled,connection-fatal} / terminateUnauthorized / close 幂等；决策 5 dormant 面）
- src/index.ts 追加 1 值 + 7 类型导出（append-only，11→12）；内部 splice 机械重命名
  createHubSessionHost→createHubSessionSink（hub-session/hub-connection/hub-split 头注）
- 新增测试：AC1 test-d 类型冻结（含 6 项 @ts-expect-error 负控）、AC2+AC4+AC5 内存管道
  完整回合（A1–A12 含红臂、C4a–C4d、C5a–C5c）、AC3 机制 (a) shim 矩阵重跑（7 文件断言
  逐字不变 + 反空跑 + 零 unhandled rejection）；夹具 test/issue420-shim-hub.ts（三分支路由 +
  有界 pending + 按准入结局路由 + E10 兜底）
- #418 两处授权编辑（冻结导出表 +1 行；结构测试机械跟随）
- RA1 文本：ADR 0032 澄清附录（信号词汇公共化 + 决策 3 三载体 + 决策 5 降级登记）与
  CONTEXT.md「SessionHost」词条更新
- 验证：契约三路径 63 tests 绿、包全量 80 files/651 tests 绿、根 typecheck 绿、
  根 pnpm test 443 files/5381 tests 绿；hub-namespace.ts/hub-edge.ts 零 diff；M1–M7 变异实跑登记
```
