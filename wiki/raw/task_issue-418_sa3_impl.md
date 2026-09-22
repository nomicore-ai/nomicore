# SA3 Implementation Report — issue #418：`HubConnectionImpl` 拆分 Edge/SessionHost + 单体进程内组合

- Dispatch：`sa-528d3b0b-a9fc-44b4-a24c-fb298e086867`（mabf-sa3 / implementation / iteration 1）
- 基线 worktree：`/home/wangjian/nomicore-fix-issue-418`，分支 `mabf/issue-418`，HEAD `27e012b6606e48797842a79e11e3505819c34cc6`
- 本报告为**原位版本**：替换 iteration 0 的 `reject` 报告（其 §7 BLOCKER = 「D5.1/D5.2 结算段回放 vs AC4 不改而绿」，已被 iteration 2 设计以方案 A 整体解决）。
- **结构化结论：实现完成，红灯契约全绿，无 `verdict`（成功路径）**。
- 核心：把 worktree 内的 iteration 0 实现按 iteration 2 设计（D5 整体重写：**到达点建通道 + 异步 edge-owned admission 拉取**）修订——删除二相 OpenEntry / PendingEvent 窗口日志 / 结算段回放 / 强制结算 / `revoked` 结局 / session 投影存储；新增 edge admission 台账 + `beginAdmission` + `port.openAdmission` 拉取面 + `openNamespace` 无参到达点投递 + 三案路由 + 两量 drain 判定 + 无条件 revoke。

---

## 1. Inputs consumed

| 输入 | 状态 |
| --- | --- |
| `wiki/raw/task_issue-418.md`（Host 简报 / Issue body 5 AC；§Comments 空） | 读取；**无 owner 追加要求**（派工单明示 REST comments `[]`） |
| `wiki/raw/task_issue-418_design.md`（SA1 **iteration 2** 批准设计，736 行：D1~D8、§11 ALLOW/DENY、§12 验收映射、附录 A/B） | 全文读取并逐节落实 |
| `wiki/raw/task_issue-418_sa2_review.md`（SA2 **iteration 2 评审：approve**；F1~F5 全解决、当前 finding 集空、N1'~N5' 非阻断观察） | 全文读取；N1'（thenable 前设）与 N2'（结构断言形态）随实现落地（§8） |
| `wiki/raw/task_issue-418_design_conflict_report.md`（SA8 **iteration 2 复查：clear** + 注 C' + §8-R1/R2/R3/R4'/R5/R7'/R9'） | 全文读取；R1/R2/R3 交付证据（§6），R9' 逐项自检（§8） |
| `wiki/raw/task_issue-418_sa6_contract.md`（SA6 契约 approve；C0a~C0d + C1~C6 + U1~U5） | 全文读取；C0 白盒按 §12 更新交付，契约文件**未改**（DENY） |
| `wiki/raw/task_issue-418_sa3_impl.md`（iteration 0 报告：**reject** §7 + A1~A6 登记项） | 原位替换为本报告；其 §7 方案 A 即本版实现蓝本 |
| `docs/adr/0032-transport-decoupling-edge-session-split.md`、`docs/protocols/instance-replication-v1.md`、`packages/ws-replication/AGENTS.md` | 约束面读取 |
| 源码锚点（本轮亲读） | HEAD `hub-namespace.ts:280-540`（onOpen/startOpen 同步前缀/D-H1/finishOpenError/isOpenAborted）、iteration 0 `hub-edge.ts`/`hub-session.ts`/`hub-split.ts`、`hub-connection.ts` 组合根、两锚测试 `ws-replication-ac7-faults.test.ts`、`ws-replication-issue171-red.test.ts` |

## 2. Existing worktree reconciliation

| 项 | 事实与判定 |
| --- | --- |
| 既有未提交实现 | iteration 0 的 SA3 实现（`hub-split.ts`/`hub-edge.ts`/`hub-session.ts` 新增；`frame-io.ts`/`backpressure.ts`/`hub-connection.ts` 改写）——**D1/D2/D3/D4/D6/D7/D8 机制按设计附录 B 全量复用**（零改动或仅注释） |
| 需回收的过时机制 | iteration 1 的 D5 族：二相 `OpenEntry`（pending/sunk）+ `PendingEvent` 窗口日志 + `settlePending` 结算段回放 + `dropPendingEntries` 强制丢弃 + `revokeNamespace` 的 terminate 标记/`revoked` 结局 + session 侧 `projections` 投影存储 + `replayAuthorization` ——**整体删除**（设计 §7 D5 明文删除线清单）；全文扫描确认零残段（`grep` 无 `OpenEntry/PendingEvent/settlePending/sunkNames/revoked` 现行符号） |
| 既有冻结产物 | SA6 契约测试文件（17 用例）与 SA6 基线日志保持未改（DENY；`git status` 确认未触碰，mtime 仍为 22:31） |
| 保留判定 | `frame-io.ts`（字节形态 + `[8..12]` 盖章）与 `backpressure.ts`（字节形态 + 可选宿主成员）本轮**零改动**（设计 ALLOW「维持 SA3 现状」）；`hub-connection.ts` 仅头注释 |

## 3. Changed paths

| Path | Design section | Change |
| --- | --- | --- |
| `packages/ws-replication/src/hub-split.ts` | D1（缝契约） | `HubOpenAdmission` 删 `revoked`（三态：authorized/denied/throw）；`HubSessionEdgePort` 增 `openAdmission(namespaceId)`（首成员，契约注释含「至多结算一次、除台账缺失外永不 reject」）；`HubSessionSink.openNamespace(message)` 删 admission 参数；文件头同步不变量重写（delivered ⇒ 到达点在场 / listen 只增不减 / settled 单调 / 台账 ⟺ 通道在场 / 恰一次 authorize）；`channels` 注释定为观测类投影（非路由判据） |
| `packages/ws-replication/src/hub-edge.ts` | D2/D4b/D5/D6 | 删 `PendingEvent`/`OpenEntry`/`entries`/`pendingNames`/`sunkNames`/`authorizeFirstOpen`/`settlePending`/`dropPendingEntries`；增 `AdmissionRecord` + `admissions` 台账 + `beginAdmission`（台账先写、`Promise.resolve()` 包裹、同步 throw 吸收）+ `openAdmission`（缺失响亮 reject）；`onOpenNamespace` = ①先建台账 ②无条件到达点投递；路由三案（台账命中 → R-delivered 即时投递；未命中 → R-none 合成；ERROR 未知 ns → 静默）；`revokeNamespace` 无条件化；drain 判定两量化（`∀ keys ⊆ settledNames`）；L1 两处无事件直赋、五路收口、liveness、reauth、mux 不动 |
| `packages/ws-replication/src/hub-session.ts` | D2/D3.1/D5.3 | 删 `projections` 投影存储与 `replayAuthorization`；`openNamespace(message)` = HEAD `onOpenNamespace` :880-894 原样（`new` + `channels.set` + `startOpen`）——到达点建通道；`authorize` shim = `port.openAdmission(nsId)` 拉取 + 三态映射（authorized → 投影；denied → `{ok:false}`；throw → reject）；channelHost 组装/分派壳/占位编码/闸门前置/close/terminate/facet 不动 |
| `packages/ws-replication/src/hub-connection.ts` | D7 | **仅头注释口径**（+5 注释行 = 464 → 469；零代码行改动）：说明「到达点建 admission 台账 + 立即投递 + 异步拉取」；组合根不感知准入机制（全文件无 D5 机制符号） |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-structure.test.ts` | §12 C0a/C0b/C0c/C0d | stub 适配新缝：stub sink `openNamespace(message)` 无 admission 参数 + 经 `port.openAdmission` **拉取**（记录 pulls）；stub port `openAdmission` 四形态臂（ok/denied/throw/**reject**）；C0a 改 deferred authorizer（**到达点断言**：authorize 未结算时 stub 已收 OPEN 且通道在场；拉取得 authorized）；C0a-负控 = deny 拉取；C0b 三臂改由 port 脚本驱动 + fail-loud 臂 = reject；C0d 到达点锁步 + **结算段零回放**行为证明；`terminateNamespace` 桩对齐 session 无通道 no-op 语义 |
| `packages/ws-replication/test/ws-replication-issue418-pending-window-matrix.test.ts` | §12 M1/M2/M3 | 每臂新增 `arrival` 期望 + `runArm` 到达点断言（wire/事件效应在 `resolve()` 之前已产出——镜像 I13a）；首 OPEN 后断言 `channelState === 'opening'`（到达点建通道）；M1-revoke 臂**重定基为 HEAD 基线**：新增 registry spy（`registry.open` 恰一次 transient + `lease-released.remainingLeases` 恰一次且终值 1）与「revoke 本身零资源唤起」断言；文件头等价判据更新（窗口效应回到到达点） |
| `packages/ws-replication/src/frame-io.ts`、`packages/ws-replication/src/backpressure.ts` | D3 | **本迭代零改动**（维持 iteration 0 现状；§8 复用判定） |
| `packages/replication-protocol/test/codec-namespace-routing-key-offset.test.ts` | 决策 4 守卫 | **本迭代零改动**（维持 iteration 0 现状，5 用例全绿） |

## 4. SA2 Finding 落实（iteration 2 评审：F1~F5 全解决，无新 finding）

| Finding | 实现 | 结果 |
| --- | --- | --- |
| **SA3 §7 BLOCKER**（iteration 0 reject：结算段回放 vs AC4） | 采纳方案 A：**到达点建通道 + 异步 edge-owned admission**（D5 整体重写）。两锚由构造转绿：ac7-faults:53（窗口 UPDATE 经 R-delivered 到达点进入在场 `'opening'` 通道 → 同步产出 ns ERROR）与 issue171-red:183（`channels.set` 在 `openNamespace` 返回前完成） | ✅ **两锚转绿**（§6：包全量 75/75、569/569；根 439/439、5299/5299） |
| F1（窗口帧等价，iteration 0 BLOCKER） | D4b 三案路由：R-pending 随窗口日志删除；台账命中（含 authorize 在途）→ 到达点即时投递；§2.2 矩阵逐行由零 diff 通道原生承载（M1 到达点断言 + 合计序列双断言） | ✅ M1 25/25 绿（HEAD 基线亦 25/25） |
| F2（drain 判定漏 pending，MAJOR） | D5.4 两量判定 `∀ keys ∈ admissions ⊆ settledNames`（pending 包含式收编：`'opening'` 未 settled 天然阻塞）；单触发点 `onChannelSettled` 保持 | ✅ M2 绿（结算前不提前 1001，结算后收口） |
| F3（证据表不符，MINOR） | L1 两处无事件直赋逐点保留（`beginReauth` 的 `state='draining'`、`onLivenessLost` 的 `state='closed'`）；`drainDeadline` 死字段不迁移；onLivenessLost 不调 `clearDrainHandles` | ✅ M3a/M3b 绿（直赋零 `connection-state-changed`） |
| F4（次序翻转，MINOR） | D3.1 闸门前置 + D3.3 逐路径次序（本轮未触碰出站面）；R4' 双不可达角落维持登记、不伪造测试 | ✅ 既有额度/耗尽族（issue169/231/直构 6 文件）全绿 |
| F5（revoked shim 形态矛盾，MINOR） | `revoked` 结局与强制结算机制整体删除——矛盾载体不复存在；shim 形态唯一（denied/throw 两态） | ✅ 消解（全文无矛盾残段） |
| A1（`channels` 只读投影） | 保留为观测类投影（组合根 face）；**路由与 drain 判定读 edge 自身 `admissions` 台账**，不读投影（R9'(ii)） | ✅ 13 个既有白盒锚绿；结构证据见 §8 |
| A2（F5 调和） | 随 `revoked` 删除消解（无第三形态） | ✅ |
| A3（routingKeyOf 定偏移 ≈ 解码值一致性） | 维持（读数 ≠ 解码值 → `MALFORMED_FRAME` 响亮）；守卫测试维持 | ✅ 5/5 绿 |
| A4（`requestSinkClose` 单点幂等） | 维持（四收口路径单点、`close` 幂等；C0d 断言 sink.close 恰一次） | ✅ |
| A5（R4' 登记不伪造测试） | 维持登记（非暂停控制帧「耗尽 ∧ 编码必败」双不可达角落） | ✅ 登记 |
| A6（R2/R5/R7 义务账） | R2 就地了结（零新增缓冲面：窗口帧零缓冲、台账 ≤ 通道数）；R5/R7' 存续（跨票义务，§8） | ✅ 如实陈述 |
| N1'（thenable 前设） | `beginAdmission` 以 `Promise.resolve(authorize(...))` 包裹：非 thenable 违约宿主落到同一 `throw` 结局（= HEAD `await` 宽容语义），注释登记 | ✅ 落地 |
| N2'（结构断言形态） | 优先**行为证明**（到达点投递 + 锁步 + 结算段零回放），未加源码文本扫描（本测试文件自身纪律 + SA6 S9） | ✅ 落地（§8） |
| N3'（authorize 调用点前移成文） | `hub-edge.ts` 文件头 + `beginAdmission` 注释固化「① 先于 ② = shim 拉取前提」「调用点前移 = 同段不可分辨」 | ✅ 落地 |
| N4'/N5' | 未为消跳数做特化（维持自然 3 跳）；N5' 为 SA8 裁决面证据补充，非实现面 | — |

## 5. File scope check

| Changed path（本迭代实际写） | ALLOW entry | Purpose |
| --- | --- | --- |
| `packages/ws-replication/src/hub-split.ts` | ALLOW 行 1 | 缝契约适配（D1） |
| `packages/ws-replication/src/hub-edge.ts` | ALLOW 行 2 | edge 半边 D5 重写 + 路由/revoke/drain |
| `packages/ws-replication/src/hub-session.ts` | ALLOW 行 3 | session 半边去投影 + 拉取 shim + 到达点 openNamespace |
| `packages/ws-replication/src/hub-connection.ts` | ALLOW 行 4 | 组合根（仅头注释；零功能改动） |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-structure.test.ts` | ALLOW 行 7 | C0a~C0d 白盒（§12 更新） |
| `packages/ws-replication/test/ws-replication-issue418-pending-window-matrix.test.ts` | ALLOW 行 8 | M1/M2/M3（到达点强化 + M1-revoke 重定基） |
| `artifacts/sa3-issue418-*-iter2.log`、`wiki/raw/task_issue-418_sa3_impl.md` | 证据与报告（非源码路径） | 验证证据 |

**未改但列入 ALLOW 的文件**（设计「维持 SA3 现状」）：`frame-io.ts`、`backpressure.ts`、`packages/replication-protocol/test/codec-namespace-routing-key-offset.test.ts`。

**DENY 面零 diff 核验**（§6 命令输出）：`git diff --stat` 对 `hub-namespace.ts`、`index.ts`、`testing.ts`、`types.ts`、`defaults.ts`、`validate.ts`、`plugin.ts`、`peer-connection.ts`、`peer-namespace.ts`、session 机械件（`update-channel`/`bulk-transfer`/`round-engine`/`fence-watchdog`/`update-transfer`/`liveness`/`observer`/`error-mapping`/`lifecycle-queue`）、`packages/replication-protocol/src/**`、`docs/**`、`CONTEXT.md`、`apps/**`、根配置（`vitest.config.ts`/`tsconfig*`）**全部为空**；既有 73 个 ws-replication 测试文件**零修改**（`git diff --name-only -- packages/ws-replication/test` = 0；SA6 契约文件未触碰）。

## 6. Verification

| Command | Result | Evidence |
| --- | --- | --- |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/ws-replication/test/ws-replication-issue418-pending-window-matrix.test.ts --typecheck.enabled=false`（**HEAD 基线：stash 实现后，含新增到达点断言与 M1-revoke 资源 spy 的重定基版**） | **25/25 passed，EXIT=0** | `artifacts/sa3-issue418-m1-head-baseline-iter2.log` |
| 4 个 #418 验收文件（C0 结构 9 + SA6 契约 17 + M1/M2/M3 25 + codec 守卫 5） | **56/56 passed，EXIT=0** | `artifacts/sa3-issue418-acceptance-tests-iter2.log` |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/ws-replication`（包全量） | **75/75 文件、569/569 用例 passed，EXIT=0**（对照 iteration 0：73/75、567/569——两锚已转绿） | `artifacts/sa3-issue418-package-suite-iter2.log` |
| `pnpm exec tsc -p packages/ws-replication/tsconfig.json` | EXIT=0 | `artifacts/sa3-issue418-typechecks-iter2.log:2` |
| `pnpm exec tsc -p packages/replication-protocol/tsconfig.json` | EXIT=0 | 同上 `:4` |
| `pnpm typecheck`（根，15 tsconfig 串行） | **EXIT=0** | 同上 `:10` |
| `pnpm test`（根全量，含 `--typecheck`） | **439/439 文件、5299/5299 用例 passed，`Type Errors no errors`，EXIT=0** | `artifacts/sa3-issue418-root-test-iter2.log` |
| 冻结面零 diff 门禁（§5 清单） | 全部为空（既有测试文件零修改） | 本节命令输出（`git diff --stat` / `git status --porcelain`） |
| 两锚定点：`ws-replication-ac7-faults.test.ts` + `ws-replication-issue171-red.test.ts` | **17/17 passed**（iteration 0 下 2 红） | 包全量日志同源；单独运行亦绿 |

**关键行为证据（逐条对齐设计 §12 / SA8 §8-R1）**

- **C0a（edge 独立实例化）**：deferred authorizer；OPEN 到达 → `settle()` 后 authorize 未结算而 stub sink 已收 `openNamespace(message)`（**无 admission 参数**）且通道在场、`port.openAdmission` 拉取 pending、wire 仅 HELLO_ACK；resolve → 拉取得 `{outcome:'authorized'}` → HELLO_ACK/OPEN_OK 全帧 hex 与 SA6 冻结金标逐字节相等、raw `[8..12] == [1,2]`、authorize 恰一次（入参 `{instanceIdentity:'peer-alpha', namespaceId}`）。
- **C0a-负控**：deny → 到达点投递 + 拉取得 `{outcome:'denied'}`；零 OPEN_OK；authorize 恰一次。
- **C0b（session 独立实例化，stub port 四形态臂）**：authorized → `OPEN_OK → BOOTSTRAP_SNAPSHOT → SYNC_STEP2 → SYNC_APPLIED → CLOSE_OK` 全生命周期 + `admissionPulls == [ns]` + 占位帧 `[8..12] == 0`；denied → 真实零 diff 通道产出 `NAMESPACE_UNAUTHORIZED` + 3 事件 + settled 且 `registry.open` **零调用**；throw → `INTERNAL_ERROR` + 零 registry.open；**reject（台账缺失）→ 响亮 `INTERNAL_ERROR`**（非静默）。
- **C0c**：`hub-connection` 运行时导出面 `['createHubReplication']` 不变；三新模块导出面各为单工厂；缝类型模块零运行时导出；单体 `acceptTrusted` 产物暴露 edge 面。
- **C0d（缝纪律 + 到达点锁步 + 结算段零回放）**：投递序列零连接级 kind；未投递 ns → edge 合成 `NAMESPACE_STATE_VIOLATION`（零缝投递）；ERROR 未知 ns → 静默；OPEN（authorize 在途）→ `openNamespace` 返回即 `sink.channels.has(nsA) === true`（**锁步**：台账命中 ⟺ 通道在场）；窗口 5 帧（UPDATE/SYNC_STEP1/BOOTSTRAP_ACK/UPDATE_ACK/CLOSE_NAMESPACE）在 authorize 未结算时**已全部到达点投递**（零缓冲）；迟归结算后投递序列与 `opens` 数**不变**（零回放、无二重通道）；revoke 在场通道 → `terminateNamespace`，无通道 → no-op；`close` 幂等（sink.close 恰一次）。
- **M1（十臂 × {resolve-ok, resolve-deny}）**：每臂在 `resolve()` **之前**断言到达点效应（UPDATE/UPDATE_CHUNK kind0/BOOTSTRAP_ACK → `NAMESPACE_STATE_VIOLATION` + 3 事件；字段超限 → `UPDATE_TOO_LARGE`；kind2 → `SYNC_STATE_VIOLATION`；CLOSE_NAMESPACE → `CLOSE_OK:3` + 2 迁移；ERROR → received + failed(remote-error)；UPDATE_ACK → 连接级 ERROR + `ready->closed` + `connection-failed` + fatal close 1002；RESYNC → needs-resync 且 ok 结算不被中止；再 OPEN → 合流零帧/零 authorize），随后合计序列与 HEAD 基线逐帧逐事件一致；authorize 恒恰一次。
- **M1-revoke（重定基 HEAD 基线）**：窗口期 revoke → 到达点 `NAMESPACE_UNAUTHORIZED` + `opening->failed` + `protocol-violation` + settled，且此刻 `registry.open` 零调用；迟归 authorize(ok) → **`registry.open` 恰一次 transient 调用 + `lease-released` 恰一次（remainingLeases 终值 1 = fixture lease）**、零新帧零新事件（= HEAD 原生 D-H1 路径，iteration 1 的 R7 微差消除）。
- **M2**：deferred nsA + 自然收口 nsB → drain 不提前 1001；nsA 结算（deny）→ 通道 failed+settled → 才提前 `close(1001,'hub-reauth')`。
- **M3a/M3b**：`beginReauth`（ready→draining）与 pong 超时（→closed）全程 observer 计数零新增 `connection-state-changed`；deadline close 路径恰一 `draining->closed`。

**HEAD 基线方法论（设计 §12 / 附录 A 第 5 步）**：本迭代先以 `git stash push -u -- packages/ws-replication/src` 回到 HEAD 采集重定基后的矩阵基线（25/25 绿，`-iter2` 日志），再 `git stash pop` 复原实现（4 文件 md5 逐一校验 OK，`git stash list` 为空）。⇒ 新增的到达点断言与 revoke 资源断言均为 **HEAD 真值**（非为拆分形态定制），实现后保持全绿。

## 7. Deferred verification

- SA4/SA7 动态面与真实传输复核、SA6 契约复审、SA8 **实现后复查（R9' 六项：缝落地逐项 / 路由与 drain 读台账 / R4' 登记面 / R7 消除 / R6' 泵预算 / M1~M3+C0+C1~C6+三门禁）**。
- CI 分片、真实 TCP 长跑、worker 形态前置门禁（R5，含 `openAdmission` 拉取形态与「结局前过缝」重新裁决）。
- **R8' 文本调和义务存续且差扩大**（ADR 0032:22 机制句 + `CONTEXT.md:230` 词条）——docs/CONTEXT 属 DENY，本票未触碰；须在 worker 形态票 SA8 前置门禁之前或之中落 ADR 修订/澄清附录（Host 可在本变更集自愿先行 documentation-only 附录，推荐非阻断）。
- 采集体积：`artifacts/` 下不带 `-iter2` 后缀的 `sa3-issue418-*.log` 为 iteration 0 证据（设计 §5 引用其证明 BLOCKER）；本迭代证据一律带 `-iter2` 后缀。

## 8. Deviations or blockers

| # | 事项 | 说明 |
| --- | --- | --- |
| D1 | C0c/C0d「edge 无 OpenEntry/PendingEvent 符号」结构断言以**行为证明**交付 | 未加源码文本扫描：结构测试文件自身纪律「零源码 grep/字符串断言」+ SA6 S9；SA2 N2' 明确建议优先行为证明。行为证明 = C0a/C0d 到达点投递（authorize 未结算即投递 ⟹ 无窗口日志缓冲）+ C0d 锁步（⟹ 无二相 entry）+ C0d 迟归结算后序列不变（⟹ 无结算段回放）+ M1 到达点断言。结构审阅项（连接 FSM 唯一在 hub-edge、通道 FSM 唯一在 hub-namespace）留 SA4 审阅面。 |
| D2 | `hub-connection.ts` 仅头注释（+5 注释行，464 → 469） | 设计 ALLOW 行 4 明文「零功能改动（仅头注释口径更新）」；全文件无 D5 机制符号（`grep` 仅早到帧 admission 与既有注释命中）。 |
| D3 | `Promise.resolve(authorize(...))` 包裹 | SA2 N1' 建议项（消「非 thenable 返回值」宿主角落与 HEAD `await` 的语义差）；不改变既有测试面（全部桩返回 Promise）。 |
| D4 | 未执行的验证 | 根 `pnpm test` 与包全量**已执行**（§6）；SA3 职责外的 CI/长跑/worker 形态列 §7。 |
| D5 | 无 blocker | 设计（iteration 2）、SA6 契约、SA2/SA8 裁决与本实现无冲突；DENY 面零 diff；红灯契约（含两锚）全绿。 |

## 9. Suggested commit message（仅供 Controller 参考；SA3 不执行 commit）

```text
refactor(#418): hub 连接拆分 Edge/SessionHost + 到达点建通道 + 异步 edge-owned admission（ADR 0032 决策 1）

- D5 按 iteration 2 设计整体重写：删除二相 OpenEntry / PendingEvent 窗口日志 / 结算段回放 /
  强制结算 / revoked 结局 / session 投影存储；edge 新增 admission 台账 + beginAdmission +
  port.openAdmission 拉取面（真实 authorize 单点恰一次、sink 结构性不可达授权器）
- 首个 OPEN 到达点同步建通道 + startOpen（= HEAD 时序）⇒ I13 两锚（ac7-faults:53、
  issue171-red:183/:194）不改而绿；D4b 三案路由（台账为路由事实源）；D5.4 两量 drain 判定；
  D5.5 revoke 无条件走 HEAD 原生 terminateUnauthorized + D-H1 续体
- hub-namespace 零 diff（AC3）；frame-io/backpressure 维持字节形态 + [8..12] 盖章；
  index/testing/types/defaults/validate/plugin 零 diff（零新公共 API / 零配置）
- 测试：C0a~C0d 白盒适配拉取缝（含 openAdmission reject 响亮臂）；M1 十臂到达点强化 +
  M1-revoke 对 HEAD 基线重定基（registry.open 恰一次 transient + lease 释放）；M2/M3 维持
- 验证：包全量 75/75 文件 569/569 用例、根 439/439 文件 5299/5299 用例（Type Errors no errors）、
  包/根 typecheck 全绿；HEAD 基线（stash 采集）25/25 绿；DENY 面 git diff 零变更
```

## 附：artifactPaths（worktree-relative）

- `wiki/raw/task_issue-418_sa3_impl.md`（本报告）
- `packages/ws-replication/src/hub-split.ts`、`hub-edge.ts`、`hub-session.ts`、`hub-connection.ts`
- `packages/ws-replication/test/ws-replication-issue418-edge-session-split-structure.test.ts`、`ws-replication-issue418-pending-window-matrix.test.ts`
- `packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts`（SA6，未改）、`packages/replication-protocol/test/codec-namespace-routing-key-offset.test.ts`（未改）
- `artifacts/sa3-issue418-m1-head-baseline-iter2.log`（HEAD 基线 25/25）
- `artifacts/sa3-issue418-acceptance-tests-iter2.log`（56/56）
- `artifacts/sa3-issue418-package-suite-iter2.log`（75/75 文件、569/569 用例）
- `artifacts/sa3-issue418-typechecks-iter2.log`（包/protocol/根 typecheck 全 EXIT=0）
- `artifacts/sa3-issue418-root-test-iter2.log`（根 439/439、5299/5299、Type Errors no errors）
