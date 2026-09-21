# SA4 实现红队评审 — issue #420：SessionHost 公共工厂 + 内存管道完整协议回合（spec #415 T3）

- 派工：`sa-4aac664b-5533-4b6c-a3d1-b8481d57d71b`（role `mabf-sa4`，phase implementation-review，iteration 0）
- 评审对象：worktree `/home/wangjian/nomicore-fix-issue-420`（branch `mabf/issue-420`，基线 HEAD `7039f6dae8e7d29f0c929492f0ca2119bc63afaa`，零 commit / 零 push —— 本轮 `git log` 复核）上的 SA3 未提交实现 + TDD/验证证据
- 评审方式：静态开卷（源码 + diff + 测试源码 + 证据日志逐项核对）；SA4 不运行测试、不修改实现/设计/测试。唯一可写产物 = 本文件
- Owner 评论：无（派工明文 none；REST comments = `[]`——与 SA6 §2/SA8/SA1/SA2/SA3 五方同口径）

---

## 1. Reviewed inputs

| 输入 | 状态 |
| --- | --- |
| `wiki/raw/task_issue-420.md`（Issue #420 正文，AC1–AC5，comments 空） | 已读 |
| `wiki/raw/task_issue-420_sa6_contract.md`（**冻结验收契约**：§12.1 逐字签名、§12.2 A1–A12、§12.3 AC3 机制 (a)、§12.4 C4a–d、§12.5 C5a–d、§12.6 两处授权编辑、§12.7 M1–M7、§12.0 运行命令） | 已读（全文） |
| `wiki/raw/task_issue-420_design.md`（SA1 设计 iteration 1：§7 D1–D10、§11 ALLOW/DENY、§12 验收映射、§14 SA2-F1 修订映射） | 已读（全文） |
| `wiki/raw/task_issue-420_sa2_review.md`（design-review **approve**；SA2-F1 已解决；N1'–N3' 非阻断） | 已读 |
| `wiki/raw/task_issue-420_conflict_report.md` / `task_issue-420_relevant_decisions.md`（SA8 前置门禁 clear，RA1–RA5） | 已读（要点） |
| `wiki/raw/task_issue-420_design_conflict_report.md`（SA8 design 复查 **clear**，35 项对照，RA1'–RA6'、`requiresConflictRecheck: true` 已武装 implementation 段） | 已读（全文） |
| `wiki/raw/task_issue-420_sa3_impl.md`（SA3 实现报告 iteration 0：V1–V16、Deviations 1–4） | 已读（全文） |
| 实现源码（本轮开卷）：`src/hub-session-host.ts`（263 行全文）、`src/hub-session.ts`（292 行全文）、`src/hub-split.ts`（缝契约 + diff）、`src/index.ts`（diff）、`src/hub-connection.ts`（diff）、`src/hub-edge.ts`（:40-268/:310-410/:490-570/:686-735 重点：`wsCloseCodeFor`、`makePort.connectionFatal(code, wsCloseCode ?? 1002)`、`onOpenNamespace` 无条件投递、`beginAdmission` 唯一 authorize、`dispatchReady` 台账命中才 `sink.namespaceFrame`、`isChunkedNegotiated`）、`src/hub-namespace.ts`（重点：`onOpen` 重开矩阵 :289-331、`startOpen` :334-346、`finishOpenError`/`finalize`/`flushOpenWaitersOk` :474-500/:1674-1694、`onUpdate` :839-861、`onCloseRequest` :1115-1135、quiet/terminal 守卫） | 已读 |
| 测试源码（本轮开卷）：`test/issue420-shim-hub.ts`（740 行全文）、`test/ws-replication-issue420-session-host-api.test-d.ts`（131 行全文）、`test/ws-replication-issue420-session-host-round.test.ts`（486 行全文）、`test/ws-replication-issue420-shim-matrix.test.ts`（92 行全文）、`test/ws-replication-ac1-ac2-open.test.ts`（:200-258）、`test/ws-replication-ac7-faults.test.ts`（:1-80）、`test/ws-replication-ac5-live.test.ts`（:133-150）、`test/driver.ts`（API 面 grep 核对）、#418 contract/structure 两锚文件（diff 逐行）、`vitest.config.ts`、`packages/ws-replication/tsconfig.json` | 已读 |
| 证据日志（抽查）：`sa3-issue420-{green-contract,package-suite,root-test,root-typecheck,package-tsc,red-contract,red-package-tsc}.log`、`sa3-issue420-design-letter-divergence.log`（关键——见 §4 D7 行）、`sa3-issue420-mutation-{M1-a12-red-arm,M2,M3,M4,M5,M7,M7b}.log` | 已核对 |
| grep 独立复核 | `worker_threads\|MessageChannel\|MessagePort` 在 `src/**`+`package.json` **0 命中**；DENY 全表 `git diff --stat` **空**；7 矩阵文件零 diff；新三测试文件 + 夹具零 `.skip/.only/.todo`；`createHubSessionHost` 引用面封闭（定义/再导出/契约测试）；`FROZEN_PRODUCTION_EXPORTS` 恰 +1 行字母序 |

## 2. Verdict

**`approve`**（0 × BLOCKER；0 × MAJOR；6 × MINOR 非阻断观察，见 §10/§12）。

核心判断（含派工点名的 **design-letter divergence**，SA3 报告 Deviation 1）：

1. **载体提交（carrier commit）偏离设计 §7 D7 字面是证据驱动、最小面、契约优先的正确取舍，不构成 MAJOR。** 设计 D7 `namespaceFrame` 行的字面机制（routing 相位非 OPEN 帧入 pending 窗口、路由完成后冲刷）与**冻结 AC3 硬门不相容**：`ws-replication-ac7-faults.test.ts:29-53`（SA3 报告引用 :32-56）在授权门闩悬挂期注入 UPDATE 并**在 `release()` 之前**断言 wire 出现 `NAMESPACE_STATE_VIOLATION`；字面机制把投递推迟到结算之后 ⇒ 该用例必红。SA3 以 `artifacts/sa3-issue420-design-letter-divergence.log` 实证（`Tests 2 failed | 51 passed`，红项正是该用例 + 反空跑），随后落地的替代机制（相位 `routing` 的非 OPEN 帧立即提交 `denialSink` = 生产 splice + 真 port；OPEN 帧仍走分支 ② 有界 pending 窗口）满足逐字节一致纪律。**本轮独立源码重放证实其等价性论据**：listen 形态下此类帧到达的是首 OPEN 到达点已建成的生产通道（`hub-session.ts:83-93` 同步建 + `startOpen`），由通道自身状态机判定违例（`hub-namespace.ts:839-851`：'opening' 非 accepted ⇒ `sendNsError('NAMESPACE_STATE_VIOLATION')` + `finalize('failed')`，**ns 级 ERROR 非连接 fatal**）；载体提交复用的是**同一生产机械同一 port**，违例帧在同一到达形态下被同一 FSM 判定。入窗 OPEN 条目随提交丢弃与 listen 同构（`finalize` 不应答 openWaiters——本轮亲读 :1676-1694，waiters 悬置即「静默丢弃」）。夹具仍零协议决策（不合成应答、不选错误码、无 FSM）；不触公共冻结签名/DENY 面/port 17 成员集/验收语义；改动面限 ALLOW LIST 既有夹具文件。已按 skill「实现必要偏离设计 ⇒ 记录证据 + 建议路由」由 SA3 报告 Deviation 1 + 夹具头注双登记，提请 SA8 implementation 复查裁决——**回流目标 = design（D7 `namespaceFrame` 行文本修订）+ SA8 impl 复查（与已武装的 `requiresConflictRecheck` 合并），不需要返工实现**。
2. **冻结面全部逐字落地**：`hub-session-host.ts` 公共声明与 SA6 §12.1 逐字段一致（本轮逐成员比对，含 JSDoc 语义；adapterPort 17 成员与 D5 表逐行对齐）；`hub-namespace.ts`/`hub-edge.ts`/`src/testing.ts`/协议文本/7 矩阵文件/`package.json` 零 diff（本轮 `git diff --stat` 亲证）；`index.ts` append-only 恰 +1 值 + 7 类型。
3. **TDD/验证证据自洽且可复核**：红（V1 8×TS2305 + TS2307、V2 3 files failed）→ 绿（V3 63/63、V4 80 files/651 tests、V6 根 typecheck、V7 根 443/5381）与基线（77/588）增量吻合（+3 文件/+63 = 588+63）；变异 M2/M3/M4/M5/M7/M7b 实跑红、M1 内建红臂 A12 按设计 §12 落地；矩阵断言体零编辑（文件零 diff）。
4. 唯一需要跨 SA 流转的文本面：载体提交使「authorized 结局 + 在途违例帧」的 ns 也由生产 splice 承载（相位落入吸收态、不建公共句柄）——与刚落地的 ADR 0032 附录 A2 β 措辞「宿主桥**按准入结局**把该 ns 交给生产 sink 承载」存在**未描述的第三种路由判据（按帧到达形态）**。这不是已证实的 ADR 文本冲突（附录的「至多一个承载机械、路由相位单调」仍成立），但构成新的 ADR 文本对齐风险 ⇒ 本轮提交 `requiresConflictRecheck: true`（与设计 §15 既有武装合并到同一次 SA8 implementation 复查，不新增轮回）。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
| --- | --- | --- |
| Issue 正文：导出 SessionHost 公共工厂，`open()` 输入含六字段（connectionKey/remoteInstanceId/namespaceId/authorization 预授权投影/selectedCapabilities/可选 connectionId） | `src/hub-session-host.ts:55-89`（逐字 SA6 §12.1）+ `src/index.ts` 追加导出；test-d 正控逐字段 `toEqualTypeOf` | 落实 |
| Issue 正文：句柄 `handleFrame`（fire-and-forget）/`onFrame`（出帧，sequence=0 占位）/`close` | `:119-171`；占位编码留在内部 sink（`hub-session.ts:256-262`），listener 收到的帧占位 0（round A8/C4c 断言）；`close` 幂等（sink closeTail 单 promise） | 落实 |
| Issue 正文：authorize 不在 session 侧调用——闭包回放预授权投影 | adapterPort `openAdmission` 恒 `Promise.resolve({outcome:'authorized', authorization: input.authorization})`（`:178-182`）；test-d 负控禁 `authorize`/`transport`/`port` 键 | 落实 |
| Issue 正文：内存管道对驱动完整协议回合，无 socket 无 worker | round 测试 A1–A12 全绿（V3）；`makeWire` 内存双端；零跨线程面 API（grep 0 命中，C4a 结构门） | 落实 |
| AC1 test-d 锁定 + 导出恰增一名 | V3（63 tests + Type Errors 0）+ V5（tsc 绿，负控全触发无 TS2578）+ `FROZEN_PRODUCTION_EXPORTS` +`'createHubSessionHost'` 字母序单行插入 | 落实 |
| AC2 OPEN→bootstrap→live→reconcile→CLOSE 完整回合 | A4–A9 逐项（OPEN_OK 恰一 + authorize 恰一次、快照/ACK 回指、SYNC 族 + doc 收敛、双向 UPDATE/ACK + 零 resync、CLOSE_OK 回指 + settled 恰一） | 落实 |
| AC3 矩阵 shim 重跑 + 通道零改动 + 状态机零 fork | 机制 (a)：`vi.mock` 仅替换 `createHubReplication` + 动态 import 7 文件（断言体零编辑，本轮 diff 亲证）；`hub-namespace.ts` 零 diff；V4 651 全绿含 shim 臂 53 | 落实（D7 字面机制偏离见 §4/§2.1——登记回流，不弱化 AC） |
| AC4 缝两侧只过 Uint8Array 与纯 JSON；零 worker 依赖/类型 | C4a（src+package.json 0 命中）/C4b（structuredClone + JSON 往返 + DataCloneError 负控）/C4c（字节 + 占位/wire 序）/C4d（无 live 对象） | 落实 |
| AC5 session 侧零重检入站 sequence | C5a（回退序 2 经 `handleFrame` 仍被消费 + `CLOSE_OK{ackedSequence:2}` + 零 fatal）/C5b（edge 单点负控）/C5c（结构门 0 命中）/C5d=M5（变异 9 红，含 C5a/C5c） | 落实 |
| SA2-F1（已解决项）三分支路由 | `HostBridge.openNamespace`：① authorized → 句柄转发不重调 `open()`（`reopenForwarded`）；② routing → OPEN 入有界 pending 按到达序同步冲刷（`pendingFlushed`）；③ denied → `denialSink.openNamespace`；矩阵 `:212`/`:240` 两用例 shim 臂断言逐字不变绿；M7/M7b 变异分别使两用例红（V9/V10） | 落实 |
| SA2 N1'（closed 守卫下挂起 terminate 的归宿） | `routeAdmission` `finally → settleTerminateWaiters`：closed/续体异常 → no-op resolve；denied → denialSink；authorized → 句柄 | 落实（夹具 :341-353/:397-415） |
| SA2 N2'（冲刷须在续体同一同步段） | `flushAuthorized`/`flushDenied` 在相位置位后同步调用、无 await 间隔；头注登记不变量；M7b 反证 | 落实 |
| SA2 N3'（Map 键模板笔误） | 键 = `` `${connectionKey}\u0000${namespaceId}` ``（`hub-session-host.ts:248`） | 落实 |
| SA8 RA1'（附录 + CONTEXT 同变更集） | ADR 0032 澄清附录 +23 行（A1 信号词汇/A2 三载体/A3 dormant+U8）+ `CONTEXT.md:229-231` 词条 + _Avoid_ 一项 | 落实（对齐风险见 §2.4/§12-O1） |
| SA8 RA2'（deny 断言族 + W2 修正负控） | 矩阵 shim 臂 deny 族绿；round A4-W2：PEER_OWNER → 零 OPEN_OK + `NAMESPACE_NOT_FOUND` + 注册表零成功打开 + authorize 恰一次 | 落实 |
| SA8 RA3'（零 diff/导出恰增/S2 有界/observer 单点/反空跑/M1–M7/重命名纯机械） | 本轮逐项独立复核全部成立（见 §5–§7、§9） | 落实 |
| SA8 RA6'(i)–(vi) | (i) 三分支 + 相位单调 + E10 try/catch + closed 守卫在夹具落地；(ii) 两用例 shim 臂绿；(iii) 两 suite 均有 unhandled 哨兵（round A11 + matrix afterAll）；(iv) `sessionsOpened` 断言在 clean 回合 = 1（多连接角见 §12-O3）；(v) M7 实跑登记；(vi) R11/R12 头注登记（夹具 :38-45） | 落实 |
| SA6 §12.6 两处授权编辑 | contract 测试 +1 行零删除零重排；structure 测试 7 行机械跟随（`:551` 全等断言形态不变） | 落实（diff 逐行核对） |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
| --- | --- | --- | --- |
| D1 新模块 + 冻结面（逐字 SA6 §12.1）+ 内部复用 splice + 响亮前置 | `hub-session-host.ts` 全文；`open()` 前置 throw（空 connectionKey / 重复 (connectionKey, ns)）；`createHubSessionSink({port: adapterPort,…})` 单份组装 | 逐字段一致（本轮比对）；公共名经 splice 重命名让出（D9） | — |
| D2 `handleFrame`：解码无 `expectedSequence`、capability 透传、OPEN→`openNamespace`、连接级/方向域静默、其余→`namespaceFrame(message, header.sequence)` | `:119-148`；switch 显式列名静默集合（HELLO/HELLO_ACK/OPEN_OK/BOOTSTRAP_SNAPSHOT/IDENTITY_CHANGED/GOAWAY），default→`namespaceFrame` | 与内部分派壳净行为等价（未知 kind 经内部 default 静默）；解码失败 → `connection-fatal{code ?? MALFORMED_FRAME}`（E2 fail-loud） | — |
| D3 `onFrame`：至多一 sink、后注册替换、退订置空、无 sink ⇒ 0、throw 同步传播、lane 区分 | `:150-155`/`:215-219`（`deliverFrame` 直接调用 listener） | 落实；占位 0 + 返回序承重由 A8/A12/M1 锚定 | — |
| D4 信号面：`settled` 恰一次经通道单调性、`connection-fatal` 丢 `wsCloseCode` 只发 code、`close`/`terminateUnauthorized` 委托 sink | `:164-171`/`:221-235`；桥侧 `settled → realPort.onChannelSettled`、`connection-fatal → realPort.connectionFatal(code)` | 落实；等价论据成立（通道仅两点恒 1002，本轮重验 `hub-namespace.ts:662,1099`） | — |
| D5 adapterPort 17 成员映射 | `makePort()`（`:175-210`）逐一对照 D5 表：`dataGateOpen` 恒 true、`bufferedAmount` 恒 undefined、assembly per-session 单槽（`size>=1` 拒纳）、`emitObserver`=`dispatchReplicationObserver` 单点复用、`now` observer 门控 + `safeNow`、`connectionState` 两态投影 | 17/17 对齐（本轮清点）；`HubSessionEdgePort` 成员集零增删（`hub-split.ts` diff 仅头注） | — |
| D6 U3 = edge 侧处置（denialSink = 生产 sink 直连真 port） | 夹具 `:217-226`/`:387-393`；denied/throw 续体投递 `denial.openNamespace` | 落实；drain 簿记（denied 终态 → 真 port `onChannelSettled`）保真 | — |
| **D7 宿主桥：三分支路由 + 有界 pending + 路由续体 E10 + closed 守卫 + terminate 相位挂起** | `HostBridge`（`:248-353`/`:357-476`） | **除一处已登记偏离外全部落实**：`namespaceFrame` 相位 `routing` 的**非 OPEN** 帧不走 pending 窗口（设计字面）而走**载体提交**（`commitToProduction`，`:316-327`：相位置吸收态 `denied` + 清 pending + `denial.openNamespace(firstOpen)` + `denial.namespaceFrame`）；OPEN 帧仍按分支 ② 入窗（SA2-F1 原样） | **SA4-O1（MINOR，登记回流）**：证据 = `sa3-issue420-design-letter-divergence.log`（字面机制 2 红）；等价性本轮源码重放证实（见 §2.1）；夹具零协议决策维持；建议 SA1 把 D7 `namespaceFrame` 行修为「非 OPEN 帧在 routing 相位即时提交生产承载；在途 OPEN 入有界 pending 窗口」+ SA8 impl 复查连带裁 ADR 附录 A2 β 措辞对齐 |
| D7 续体：closed 守卫先查、`route.phase !== 'routing'` 次查（载体已提交 ⇒ 放弃）、`finally` 收口 terminate 挂起 | `:357-400` | 落实（双守卫次序正确；E10 catch → `connectionFatal('INTERNAL_ERROR', 1011)`，本轮重验 `makePort` 显式传参优先 ⇒ 1011 生效） | — |
| D7 pending 有界：≤16 帧/ns + 单帧 ≤ maxFrameBytes + 溢出 1008 响亮 | `enqueue`（`:464-476`）+ `MAX_PENDING_FRAMES=16` | 落实（镜像 `hub-connection.ts:54` 先例）；矩阵全程 `pendingOverflow===0` 断言在场 | — |
| D7 shim hub 服务面（accept/acceptTrusted/connections/revoke/requestReauth/close）+ 早到帧有界缓冲 + auth timer | `ShimHubImpl`（`:527-729`）；`installEarlyFrameAdmission` 镜像 | 落实；门链保真度差异清单 + R11 + R7 按头注登记（RA6'(vi)） | — |
| D8 机制 (a)：`vi.mock` 仅替换 `createHubReplication` + 动态 import + 末位反空跑 | `ws-replication-issue420-shim-matrix.test.ts`；夹具仅深路径 import（本轮逐 import 核对：`../src/*.js`，零包入口引用） | 落实；`maxWorkers:1` + 按文件隔离 ⇒ mock 无跨文件泄漏 | — |
| D9 重命名（5 文件机械） | `hub-session.ts`/`hub-connection.ts`/`hub-split.ts`（仅头注）/#418 两测试 | 纯机械（本轮 diff 逐行）；`docs/**`/`CONTEXT.md` 对旧名零残留引用 | — |
| D10 RA1 文本（E1/E2 线 + dormant/U8） | ADR 附录 A1/A2/A3 + CONTEXT 词条 | 落实；A2 β 措辞与载体提交的对齐缺口见 SA4-O1 | — |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
| --- | --- | --- | --- |
| 协议 FSM（含重开矩阵/违例判定） | `hub-namespace.ts`（零 diff） | 零 diff 通道；公共工厂与夹具均注入消费 | ✓（载体提交的违例 ERROR 由通道 `onUpdate` 非 accepted 分支产出——本轮亲读） |
| 连接级纪律/序分配/close code 映射 | 真 edge | `createHubReplicationEdge` + `wsCloseCodeFor` 单点 | ✓ |
| authorize 唯一真实调用 | edge 台账 | `beginAdmission` 恰一次（台账首建）；桥/公共面只消费结局 | ✓ |
| 拒绝路径 wire 行为 | 生产代码 | denialSink（生产 splice + 真 port） | ✓ |
| 路由相位（装配状态） | test 夹具 | `HostBridge.routes` | ✓（非协议 FSM；头注明示） |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
| --- | --- | --- | --- | --- |
| session 半边组装 | 内部 splice（`createHubSessionSink`） | 公共工厂内部复用同一 splice（第二种 port 形态） | 一致 | 单份组装代码 |
| 早到/在途有界缓冲 | `MAX_EARLY_FRAMES=16` + 1008/1009 拒绝（`hub-connection.ts:54`） | pending 窗口同界同族收口 | 一致 | 同码同界镜像 |
| 拒绝路径承载 | `hub-namespace.ts:346-376` 生产通道 | denialSink 直连真 port | 一致 | 决策 1 分布式实例化 |
| observer 隔离/时钟折叠 | `dispatchReplicationObserver`/`safeNow` | 公共面与信号分发同款复用（`emitSignal` try/catch 逐监听者） | 一致 | SA8 行 23 锚 |
| 出站帧字节快照 vs mux 就地盖章 | —（新面） | `deliverOutbound` 投递前快照字节 + 采样占位序 | — | 正确处理了「edge mux 就地改写 `[8..12]`」的缝内时刻语义 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
| --- | --- | --- | --- |
| admission 结局 | edge 台账（只写不删、promise 多播） | 描述子 ok-投影（不可变快照） | 低 |
| 通道表 | 各 sink 的 `channels`（公共/拒绝互斥命名空间） | edge `.channels` 只读投影（shim 下仅拒绝侧，R7 登记） | 低 |
| wire 序分配 | edge `OutboundQueue.emitOne` | 无（session 占位 0；桥原样回传返回值） | 低 |
| 路由相位 | 桥内 per-ns 单份 | 无第二份 | 低（互斥单调不可逆 + 双守卫单一放弃点） |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
| --- | --- | --- | --- |
| 首 OPEN → routing 相位 | authorized → 公共句柄（随连接存活）/ denied 或载体提交 → denialSink 通道 | E10 1011 收口；closed 守卫放弃 | ✓ |
| `open()` 同步建句柄 | `close()` 幂等（sink closeTail 单 promise；round A11 `expect(close()).toBe(first)` 断言） | connection-fatal → closed 投影 + 出站 0 | ✓ |
| `onFrame`/`onSignal` 注册 | 退订函数（退订仅当当前 listener 匹配） | 监听者 throw 隔离 | ✓ |
| 桥 per-connection | edge `requestSinkClose` → fan-out（句柄 + denialSink） | dropConnection 回调 | ✓ |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
| --- | --- | --- | --- |
| 第二 FSM / 错误码表 / codec 语义 | — | 无（违例/拒绝应答全部由零 diff 通道产出；中继经 `encodeMessage` 单一 codec） | ✓ |
| 桥 accept 门链 | `hub-connection.ts` accept | test 夹具镜像 + 差异清单头注登记（R12） | 允许（test-only + 结构必然） |
| 公共 host `sessions` 表 vs sink `channels` 表 | listen：sink channels 永不删除 | host sessions 永不删除（`hub-session-host.ts:239-256`） | 登记见 §12-O4（冻结语义「session 随连接存活」的字面兑现；夹具内 host 按连接一对一创建 ⇒ 无运行时影响） |

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
| --- | --- | --- | --- |
| `packages/ws-replication/src/hub-session-host.ts`（新增） | ALLOW 第 1 条 | D1–D5 唯一新生产代码 | ✓ |
| `packages/ws-replication/src/index.ts` | ALLOW 第 2 条 | append-only 追加 1 值 + 7 类型 | ✓（既有 11 名零变化） |
| `packages/ws-replication/src/hub-session.ts` | ALLOW 第 3 条 | 重命名 + 别名删除 + 头注（零行为） | ✓（diff 机械；`HubSessionHost=HubSessionSink` 别名已删） |
| `packages/ws-replication/src/hub-connection.ts` | ALLOW 第 4 条 | import/调用点/头注跟随 | ✓（3 处） |
| `packages/ws-replication/src/hub-split.ts` | ALLOW 第 5 条（仅头注） | 注释真实性（三工厂现状） | ✓（本轮过滤 diff 证实仅注释行变化，成员/类型零变化；SA2 N2 交付说明单列已兑现——SA3 报告 Changed paths 表） |
| `packages/ws-replication/test/issue420-shim-hub.ts`（新增） | ALLOW 第 6 条 | D6/D7 夹具 | ✓（仅深路径 import） |
| `packages/ws-replication/test/ws-replication-issue420-session-host-api.test-d.ts`（新增） | ALLOW 第 7 条 | AC1 | ✓ |
| `packages/ws-replication/test/ws-replication-issue420-session-host-round.test.ts`（新增） | ALLOW 第 8 条 | AC2/AC4/AC5 | ✓ |
| `packages/ws-replication/test/ws-replication-issue420-shim-matrix.test.ts`（新增） | ALLOW 第 9 条 | AC3 | ✓ |
| `…issue418-edge-session-split-contract.test.ts` | ALLOW 第 10 条（§12.6 编辑 1） | 冻结表 +1 行 | ✓（零删除零重排） |
| `…issue418-edge-session-split-structure.test.ts` | ALLOW 第 11 条（§12.6 编辑 2） | 机械跟随 | ✓（7 行） |
| `docs/adr/0032-…md` | ALLOW 第 12 条 | RA1 附录 | ✓（+23 行，决策文本未改） |
| `CONTEXT.md` | ALLOW 第 13 条 | RA1 词条 | ✓（:229-231 + _Avoid_ 一项） |
| （未跟踪）`artifacts/sa3-issue420-*.log`、`wiki/raw/task_issue-420_*.md` | 过程产物（非 ALLOW 管辖面） | 证据/评审产物 | ✓（SA6 资产原样保留；SA3 新日志与报告一致） |

DENY 核对（本轮 `git diff --stat` 逐项）：`hub-namespace.ts`、`hub-edge.ts`、`src/testing.ts`、其余 src 单点（frame-io/backpressure/…）、`docs/protocols/instance-replication-v1.md`、7 矩阵文件、`packages/replication-protocol/**`、`packages/namespace-registry/**`、`apps/**`、`domains/**`、`packages/ws-replication/package.json` —— **全部零 diff**。无 ALLOW 外改动。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
| --- | --- | --- | --- | --- |
| `src/index.ts` 追加导出 | plugin.ts / nomic-server / 外部宿主 | append-only；`:551` 全等断言兼容（sort 形态）；V8 node 侧 12 名实测 | 无 | — |
| `createHubSessionHost`→`createHubSessionSink` 重命名 | `hub-connection.ts:18/:449` + structure 测试锚 | 调用面封闭（本轮 grep：旧名仅存于 `artifacts/sa6-*.mts` 诊断探针——SA3 Deviation 2 已登记，不在任何 tsconfig/vitest include 面） | 无（gate 面） | §12-O6 |
| `HubSessionSink` 面（edge → 桥代理） | `hub-edge.ts`（openNamespace/namespaceFrame/terminateNamespace/close/dataFacetOf/channels） | 六成员全实现；`openNamespace` 三分支 + 载体提交覆盖 edge 全部投递形态（首 OPEN/台账命中再 OPEN/在途 OPEN/在途非 OPEN 帧） | 无 | — |
| edge 台账 ⟺ route 在场锁步 | `dispatchReady` R-delivered 仅台账命中（本轮 :495-546 亲读） | 桥对 route 缺失的 `namespaceFrame` 走响亮 `INTERNAL_ERROR`(1011)——结构上不可达 | 无（防御分支形态差异见 §12-O2） | — |
| 公共句柄 listener 替换语义 | 宿主（夹具） | 后注册替换、退订仅当前匹配时置空 | 无 | — |
| `terminateUnauthorized`（revoke 链） | `ShimHubImpl.revoke` → edge → 桥 | 相位路由 + 挂起 + finally 收口；R11 时序观测边界维持登记（7 矩阵零 revoke 用例、A10 live 直调——本轮 grep 复核） | 无（登记面） | — |
| matrix 文件二次注册 | `vi.mock` 动态 import | 断言体零编辑；ac7 值导入 `createPeerReplication` 经 `...actual` 保真 | 无 | — |

## 8. 错误、恢复与并发

| 场景 | 实现行为 | Assessment |
| --- | --- | --- |
| E1 出站 listener 缺席/返回 0 | `deliverFrame` 返 0 → 通道既有响亮失败；A12 红臂断言观察到 `ACK_STATE_VIOLATION` + `close(1002,'protocol-error')` + onSignal 命中 + 回合不可达 live | ✓（断言绿/回合红，与冻结 A12 形态一致） |
| E2 `handleFrame` 解码失败 | `connection-fatal{code ?? 'MALFORMED_FRAME'}`，零吞帧 | ✓ |
| E3 连接级/方向域 kind | 静默（显式列名 + default 转发至内部壳后同样静默） | ✓ 净行为等价 |
| E4 pending 溢出 | `CONNECTION_POLICY_VIOLATION`(1008) 响亮 + 窗口清空 | ✓（码/映射本轮重验） |
| E5 `open()` 前置违反 | 同步 throw（M7 变异日志含 `重复开启` 签名——证明 throw 面真实） | ✓ |
| E6 信号/observer 监听者 throw | `emitSignal` 逐监听者 try/catch；observer 经 `dispatchReplicationObserver` 单点 | ✓ |
| E7 `close`/`terminateUnauthorized` 幂等 | sink closeTail 单 promise；terminate 无通道 resolve | ✓（A11 断言同一 promise） |
| E8 并发 | 同步 pipe；续体单异步段（await 台账 promise 后一次执行）；pending 冲刷在同步段内；相位互斥单调；JS 单线程 ⇒ 无竞态 | ✓（SA2 N2' 不变量头注登记 + M7b 反证） |
| E9 恢复/重试 | 无新增重试面；resync/reauth/revoke 走零 diff 通道 | ✓ |
| E10 续体非预期 throw | 整段 try/catch → `connectionFatal('INTERNAL_ERROR', 1011)`；`void` 调用 + 永不 reject ⇒ 零无承载 reject；两 suite unhandled 哨兵绿 | ✓ |
| 载体提交 × admission 迟归结算 | 续体 `route.phase !== 'routing'` 早退（不 `open()`、不二次投递、`finally` 收口 terminate 挂起）；authorized 结局下该 ns 由生产 splice 完整承载（`startOpen` 拉取台账 → OPEN_OK/live，与 listen 逐字节一致） | ✓（本轮源码重放；登记见 SA4-O1/O5） |
| 载体提交丢弃入窗 OPEN 条目 | 与 listen `finalize` 不应答 openWaiters 同构（本轮亲读 :1676-1694 无 waiter 冲刷） | ✓ |
| 桥 closed 后迟归帧 | 句柄通道已 quiesce → quiet/terminal 守卫吸收；`realPort.connectionFatal` 在 closedFlag 早退 | ✓ |

静态无法确认的运行风险列入 §11。

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
| --- | --- | --- | --- | --- |
| `…session-host-api.test-d.ts` | 冻结签名正控全集 + 负控 `@ts-expect-error` ×6（denied/authorize/transport/port/namespaceFrame/onFrame-void） | `vitest --typecheck`（`typecheck.include` 命中 `.test-d.ts`）+ 包 tsconfig（include `test/**/*.ts`）双面 | 无（TS2578 自证敏感性由 V5 绿背书——未用指令会红） | — |
| `…session-host-round.test.ts`（10 用例） | A1–A11 运行时/wire 原字节断言 + A12 红臂 + C5a/C5b/C5c + C4a–C4d | 根 vitest include `packages/*/test/**/*.test.ts` | 无 skip/only/todo（本轮 grep 0 命中）；A12 `waitFor:'none'` 为红臂设计形态（断言绿/对象红）非软化 | — |
| `…shim-matrix.test.ts` | 7 文件断言体零编辑二次执行 + 末位反空跑（计数阈值 + 非 OPEN 缝入序非 0 + `settled≥1` + 零 INTERNAL_ERROR + `carrierCommitted≥1` + `pendingOverflow===0`）+ afterAll 零 unhandled | 同上 | 反空跑锚 `settled`（替换设想的 connection-fatal 锚）：经核实 ac5-live `ACK_STATE_VIOLATION` 用例确为 **peer 侧** fatal（`injectHub` 注入，本轮 :133-150 亲读），不经桥 `onSignal`；connection-fatal 正控由 A12 红臂承载（断言 `probes.signals` 含 connection-fatal）。SA6 §12.3 冻结的反空跑要件（计数/双向帧/序非 0/M4 负控）全在场，非弱化 | §12-O5（SA3 报告 Deviation 3 对 SA6 措辞的出处引用不准确） |
| 变异 M1–M7/M7b | M2 丢 OPEN（9 红）、M3 二次盖章（7 红）、M4 关 shim（恰反空跑 1 红、52 listen 仍绿 ⇒ 判据非恒真）、M5 session 重检序（9 红，含 C5a/C5c）、M7 再 OPEN 重入（2 红 + `重复开启` 日志签名）、M7b 丢弃在途 OPEN（2 红）、M1 内建红臂 | 日志 `artifacts/sa3-issue420-mutation-*.log`（本轮抽查尾部计数一致） | M1 以夹具内建开关（`suppressSequenceReturn`）承载 = 设计 §12 A12 行明示形态（「同文件第二用例」），非软化 | §12-O7（M1 日志 `9 skipped` 为 `-t` 聚焦运行痕迹且未记录命令行——证据卫生） |
| 红阶段证据 | V1 8×TS2305+TS2307、V2 3 failed | `sa3-issue420-red-*.log` | 红因 = 能力缺口（与 SA6 type-lock-red 同形） | — |
| 基线对账 | 77/588 → 80/651（+3 文件/+63：round 10 + shim-matrix 53 + test-d 0 运行时） | `sa3-issue420-package-suite.log` / `sa6-issue420-baseline-package-suite.log` | 数字自洽 | — |

## 10. Required revisions

**无阻断 finding**（0 × BLOCKER / 0 × MAJOR）。以下为登记回流项（不阻断 approve，实现无需返工）：

| Finding ID | Severity | Evidence | Problem | Required change | Acceptance | Suggested routing |
| --- | --- | --- | --- | --- | --- | --- |
| SA4-O1 | MINOR（登记回流） | `artifacts/sa3-issue420-design-letter-divergence.log`（设计字面机制 ⇒ ac7 用例 2 红）；`test/issue420-shim-hub.ts:311-327`（载体提交）+ 头注 :27-36；本轮源码重放（§2.1） | 实现偏离设计 §7 D7 `namespaceFrame` 行字面（routing 相位非 OPEN 帧即时提交生产 splice 而非入 pending 窗口）；且刚落地的 ADR 0032 附录 A2 β 以「按准入结局」描述载体选择，未覆盖「按帧到达形态」的第三判据 | SA1 把 D7 `namespaceFrame` 行修为「非 OPEN 帧在 routing 相位即时提交生产承载；在途 OPEN 入有界 pending 窗口」；SA8 implementation 复查连带核对附录 A2 β 措辞与实现的对齐（必要时补一句登记） | 设计文本与夹具行为一致；AC3 七文件 shim 臂维持断言逐字不变全绿；SA8 impl 复查对 divergence 出具明确裁决 | design（文本修订）+ SA8 impl 复查（裁决；`requiresConflictRecheck` 已提交） |
| SA4-O5 | MINOR（登记回流） | `test/issue420-shim-hub.ts:322`（`route.phase='denied'` 吸收态）；round A4 `sessionsOpened===1` 仅覆盖 clean 回合 | 载体提交使「authorized 结局 + 在途违例帧」的 ns 不经公共句柄（相位标签 `denied` 语义扩大为「承载 = 生产 splice」）；该角落仅由敌意 peer 触发且 wire 行为与 listen 逐字节一致，但 RA6'(iv) 的 `sessionsOpened` 断言不覆盖此角落 | 随 SA4-O1 的设计文本修订一并把相位命名/语义写清（如 `carrier-committed`）；可选：夹具探针区分 `carrierCommitted` 的 admission 结局计数 | 设计/夹具注释无歧义；现有验收面不弱化 | design |

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
| --- | --- | --- | --- |
| `vi.mock` 别名同 id 双注册在 vitest 升级后的稳定性（机制 (a) 的平台依赖） | SA7/后续回归（升级 vitest 时全量跑） | shim-matrix 53 用例 + 反空跑绿；矩阵 listen 臂不重复执行 | shim 臂静默退化为 listen 空转而反空跑未红（M4 判据失敏） |
| R11 在途 revoke 时序边界（listen 立即 ns ERROR vs shim 挂起至路由完成） | 未来矩阵若加该场景（须先扩设计——RA6'(vi) 已锁） | 语义（ns ERROR + failed 终局）一致，仅时序偏移 | 出现应答丢失或 double-answer |
| 载体提交角落的 authorized 结局全回合（`NAMESPACE_STATE_VIOLATION` 后 release 门闩） | SA7 可选动态复跑（ac7 首用例已覆盖至 release 后 `settle()`） | release 后零额外 wire 帧/零 unhandled（与 listen 同） | 迟归续体在 shim 下产生 listen 没有的输出 |
| 多连接同 ns 场景下 `probes.handles` 键冲突（见 O3） | 未来使用该探针的新测试前先修键 | `(connectionKey, ns)` 复合键可取到两个句柄 | 取到错误连接的句柄 |
| `suppressSequenceReturn` 红臂开关误用于非 A12 场景 | 评审纪律（已限于夹具 option + 单用例） | 仅 A12 传入 | 其它用例静默吃到 0 回传 |

## 12. Non-blocking observations

| # | 观察 | 依据 | 建议 |
| --- | --- | --- | --- |
| O2 | 桥 `namespaceFrame` 对 route 缺失的防御分支用 `connectionFatal('INTERNAL_ERROR', 1011)`，而内部 splice 的同位防御分支（`withChannel` 未知 ns）发 ns 级 `NAMESPACE_STATE_VIOLATION` 帧 + observer（`hub-session.ts:174-198`）。两者均结构不可达（edge 台账锁步，本轮 :495-546 亲读）且均响亮，无验收面触及 | `test/issue420-shim-hub.ts:288-292` | 若追求防御分支逐点同构可改为镜像 `withChannel` 形态；维持现状可接受（登记即可） |
| O3 | 夹具探针 `handles: Map<string, HubSessionHandle>` 仅以 namespaceId 为键；同一 shim 多连接开同一 ns（ac5 fan-out 场景真实存在）时后开者覆盖先开者。当前断言（A10/C5a 单连接）不受影响 | `test/issue420-shim-hub.ts:133/:378` | 未来多连接断言使用前改为 `(connectionKey, ns)` 复合键 |
| O4 | 公共 host 的 `sessions` Map 无删除路径（`close()` 不摘除）——冻结语义「session 对象随连接存活（终态不拆）」的字面兑现；夹具内 host 按连接一对一创建 ⇒ 无运行时影响；跨多连接复用单一 host 的未来宿主会累积条目 | `src/hub-session-host.ts:239-256` | 后续服务轨/宿主接线票（非目标）明确 host 生命周期约定 |
| O5 | （见 §10，与 O1 关联）相位 `denied` 在载体提交路径下语义扩大为「承载 = 生产 splice」（authorized 结局亦落入） | `test/issue420-shim-hub.ts:316-327` | 随 O1 设计修订澄清命名/语义 |
| O6 | SA6 三个诊断探针 `.mts` 因授权重命名 import 旧名（SA3 Deviation 2 已登记；不在任何 gate include 面——本轮核对 tsconfig/vitest/package.json 零引用） | `artifacts/sa6-issue420-{capability-gap,causality,sequence-discipline}-probe.mts` | SA6/Controller 重跑探针时改 import `createHubSessionSink` |
| O7 | `sa3-issue420-mutation-M1-a12-red-arm.log` 显示 `1 passed \| 9 skipped` 且未记录命令行——`-t` 聚焦运行的报告形态（源码零 skip 已核实），非源级 skip；但日志缺命令行降低可复核性 | 该日志全文；round 测试源码 grep 0 命中 skip/only | 后续变异日志统一带命令行回显（证据卫生，不影响本次判定——A12 绿已由 `green-contract.log` 10/10 承载） |

---

**结论**：`approve`。实现忠实落实批准契约（SA6 §12 冻结面逐字、矩阵断言零编辑、DENY 零 diff、append-only 导出、RA1'–RA6' 落地），TDD 红绿证据链自洽可复核。唯一实质性设计字面偏离（载体提交）为证据驱动的最小取舍、经本轮独立源码重放证实与 listen 逐字节等价、且已双登记提请 SA8 裁决——按 skill「实现必要偏离设计 ⇒ 记录证据 + 建议路由」处理为登记回流项（SA4-O1/O5），不构成阻断。`requiresConflictRecheck: true`：载体提交与刚落地的 ADR 0032 附录 A2 β「按准入结局」措辞存在未描述的第三路由判据，需 SA8 implementation 复查一并裁决（与设计 §15 既有武装合并，不新增轮回）。
