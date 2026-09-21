# SA4 实现红队评审 — issue #420：SessionHost 公共工厂 + 内存管道完整协议回合（spec #415 T3）

- 派工（iteration 0，implementation-review）：`sa-4aac664b-5533-4b6c-a3d1-b8481d57d71b`
- 派工（iteration 1，implementation-review，本产品当前轮）：`sa-4d29edc8-7c00-45a1-9661-e3b7bbb6b498`（role `mabf-sa4`，phase implementation-review，iteration 1）——评审对象 = **SA3 iteration 1 finalization-repair 证据归并变更**（交付提交 `a315e70` 之后工作区遗留证据集的 C1 归一化 + 归档补齐 + 证据日志），原位更新本文件
- 评审对象与基线：
  - iteration 0：worktree `/home/wangjian/nomicore-fix-issue-420`（branch `mabf/issue-420`，基线 HEAD `7039f6d…`）上的 SA3 未提交实现 + TDD/验证证据；该实现已由 Controller 以 `a315e70`（`feat(ws-replication): expose session host factory`，父 `7039f6d`）承载提交
  - iteration 1：交付提交 `a315e70` 之后工作区的 18 条候选路径（2 tracked-modified + 16 untracked，本轮 `git status --porcelain -uall` 亲验 = 恰这 18 条，无其它改动）
- 评审方式：静态开卷（源码 + diff + 测试源码 + 证据日志逐项核对 + 独立 sha256/C1/blob-identity 复算）；SA4 不运行测试、不修改实现/设计/测试。唯一可写产物 = 本文件
- Owner 评论：无（两轮派工均明文 none；REST comments = `[]`——与 SA6 §2/SA8/SA1/SA2/SA3 五方同口径；iteration 1 无逐条评论映射可建，与 SA3 报告口径一致）

---

## 2. Verdict

### iteration 1（finalization repair）：**`approve`**（0 × BLOCKER；0 × MAJOR；新增 6 条 MINOR 非阻断观察 O8–O13，见 §B-10/§B-12；iteration 0 遗留 O1–O7 状态见 §B-12 尾）

核心判断（本轮全部独立复核，非采信自述）：

1. **零业务面字节变化——亲证**。13 条 ALLOW 路径（设计 §11）`git hash-object` vs `git ls-tree HEAD` **13/13 IDENTICAL**；`git diff HEAD --stat -- packages docs CONTEXT.md .editorconfig vitest.config.ts package.json` **空**。交付语义与 `a315e70` 逐字节相同。
2. **归一化仅空白且当前态 C1 全清——亲证**。18 条候选路径逐一扫描：trailing-ws=0、CR=0、末字节恰一 LF（前一字节均为内容字节，即无 EOF 空行）；tracked diff `git diff --check` RC=0。被归一化行号抽查（M2 :37/:52/:67/:82/:97/:124/:139/:154 现为 `    269|` 无尾随空白；sa6-runner :22/:34/:46/:82 现为 `      5|`/`      4|` 无尾随空白）与 gate 诊断的 `{WS}` 行形态逐一吻合。
3. **哈希声明全部对上——亲证**。SA3 报告 iteration-1 表格的 16 个 after sha256[:16] 与当前文件逐一相同；`artifacts/sa3-issue420-evidence-reconcile.log` 全量 sha256 = `4f893393b9fba731b8d843666472abb9d0eda554d17114d811abf884b2b0d2fe`、53056 B / 656 行，与报告声明全同；§7.3 全量 sha256 表与实测前缀逐一相符。
4. **生命周期零副作用——亲证**。真实 index 未被写（`git diff --cached --stat` 空 = index ≡ HEAD）；`git reflog` HEAD@{0} = `a315e70`（交付后无任何 commit）；无 push。SA3 只写了 13 条归一化路径 + 证据日志 + 其报告的 iteration-1 节，与 §7.1 声明一致。
5. **引用完备性（SA9 §10-M3 闭合判据）独立复现成立**。本轮对 HEAD 六份交付报告 grep 全部 `issue420` artifact 引用并逐条解析：全部为「committed at HEAD」或「本轮 18 条 staging set」；唯一不在场的 `artifacts/sa6-issue420-smoke.mts` 在 SA6 契约 §16（HEAD :413）明文登记为已删除临时脚本（非证据缺口）。SA9 §10-M3 列举的未跟踪路径清单（mutation ×7 + design-letter-divergence + red-contract + sa6-runner-trigger-red + sa7 两日志 + 任务简报 = 13 条）与被 C1 归一化的 13 条路径**恰好同一集合**；3 条零改动补档（SA9/SA10 终审 + SA8 iteration-6 报告）符合 #418/#419/#421 交付归档先例。
6. **无 hash registry 破坏——亲证**。HEAD 六份 420 报告 40/64-hex 扫描仅命中基线 commit OID `7039f6d…`（空白归一化不可触及），无任何 artifact sha256 注册被改写。

**iteration 1 未引入新的 ADR 冲突面**（决策文本、ADR、CONTEXT 零字节变化），本轮不提交 `requiresConflictRecheck`；iteration 0 评审曾提交的 ADR 0032 附录 A2 β 措辞对齐问题已由 HEAD 上的 SA8 implementation 复查（iteration 0 裁决表行 4/5/11，`implements-existing-decision`）裁决闭合；当前在册的 `requiresConflictRecheck: true`（SA8 implementation 冲突报告 iteration 6，窄域 = rebase 后公共 API 并集面未落树）是 Controller 拥有的 rebase 门，与本轮证据归并无涉（见 §B-12-O11）。

### iteration 0（原 verdict，维持）：**`approve`**（0 × BLOCKER；0 × MAJOR；6 × MINOR 非阻断观察 O1–O7）

核心判断（含派工点名的 **design-letter divergence**，SA3 报告 Deviation 1）：

1. **载体提交（carrier commit）偏离设计 §7 D7 字面是证据驱动、最小面、契约优先的正确取舍，不构成 MAJOR。** 设计 D7 `namespaceFrame` 行的字面机制（routing 相位非 OPEN 帧入 pending 窗口、路由完成后冲刷）与**冻结 AC3 硬门不相容**：`ws-replication-ac7-faults.test.ts:29-53`（SA3 报告引用 :32-56）在授权门闩悬挂期注入 UPDATE 并**在 `release()` 之前**断言 wire 出现 `NAMESPACE_STATE_VIOLATION`；字面机制把投递推迟到结算之后 ⇒ 该用例必红。SA3 以 `artifacts/sa3-issue420-design-letter-divergence.log` 实证（`Tests 2 failed | 51 passed`，红项正是该用例 + 反空跑），随后落地的替代机制（相位 `routing` 的非 OPEN 帧立即提交 `denialSink` = 生产 splice + 真 port；OPEN 帧仍走分支 ② 有界 pending 窗口）满足逐字节一致纪律。**iteration 0 独立源码重放证实其等价性论据**：listen 形态下此类帧到达的是首 OPEN 到达点已建成的生产通道（`hub-session.ts:83-93` 同步建 + `startOpen`），由通道自身状态机判定违例（`hub-namespace.ts:839-851`：'opening' 非 accepted ⇒ `sendNsError('NAMESPACE_STATE_VIOLATION')` + `finalize('failed')`，**ns 级 ERROR 非连接 fatal**）；载体提交复用的是**同一生产机械同一 port**，违例帧在同一到达形态下被同一 FSM 判定。入窗 OPEN 条目随提交丢弃与 listen 同构（`finalize` 不应答 openWaiters——亲读 :1676-1694，waiters 悬置即「静默丢弃」）。夹具仍零协议决策（不合成应答、不选错误码、无 FSM）；不触公共冻结签名/DENY 面/port 17 成员集/验收语义；改动面限 ALLOW LIST 既有夹具文件。已按 skill「实现必要偏离设计 ⇒ 记录证据 + 建议路由」由 SA3 报告 Deviation 1 + 夹具头注双登记，提请 SA8 implementation 复查裁决——**回流目标 = design（D7 `namespaceFrame` 行文本修订）+ SA8 impl 复查**，不需要返工实现。该裁决已由 HEAD 上 SA8 iteration 0 复查作出（`implements-existing-decision` + RA1'' 设计文本补正登记）；设计 §7 D7 文本本身尚未修订 ⇒ SA4-O1 维持在册（非阻断）。
2. **冻结面全部逐字落地**：`hub-session-host.ts` 公共声明与 SA6 §12.1 逐字段一致（逐成员比对，含 JSDoc 语义；adapterPort 17 成员与 D5 表逐行对齐）；`hub-namespace.ts`/`hub-edge.ts`/`src/testing.ts`/协议文本/7 矩阵文件/`package.json` 零 diff；`index.ts` append-only 恰 +1 值 + 7 类型。
3. **TDD/验证证据自洽且可复核**：红（V1 8×TS2305 + TS2307、V2 3 files failed）→ 绿（V3 63/63、V4 80 files/651 tests、V6 根 typecheck、V7 根 443/5381）与基线（77/588）增量吻合（+3 文件/+63 = 588+63）；变异 M2/M3/M4/M5/M7/M7b 实跑红、M1 内建红臂 A12 按设计 §12 落地；矩阵断言体零编辑（文件零 diff）。

---

# Part A — iteration 0 实现评审（原位保留；实现字节 = HEAD `a315e70`，本轮 13/13 blob 身份复核后继续成立）

## A-3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
| --- | --- | --- |
| Issue 正文：导出 SessionHost 公共工厂，`open()` 输入含六字段（connectionKey/remoteInstanceId/namespaceId/authorization 预授权投影/selectedCapabilities/可选 connectionId） | `src/hub-session-host.ts:55-89`（逐字 SA6 §12.1）+ `src/index.ts` 追加导出；test-d 正控逐字段 `toEqualTypeOf` | 落实 |
| Issue 正文：句柄 `handleFrame`（fire-and-forget）/`onFrame`（出帧，sequence=0 占位）/`close` | `:119-171`；占位编码留在内部 sink（`hub-session.ts:256-262`），listener 收到的帧占位 0（round A8/C4c 断言）；`close` 幂等（sink closeTail 单 promise） | 落实 |
| Issue 正文：authorize 不在 session 侧调用——闭包回放预授权投影 | adapterPort `openAdmission` 恒 `Promise.resolve({outcome:'authorized', authorization: input.authorization})`（`:178-182`）；test-d 负控禁 `authorize`/`transport`/`port` 键 | 落实 |
| Issue 正文：内存管道对驱动完整协议回合，无 socket 无 worker | round 测试 A1–A12 全绿（V3）；`makeWire` 内存双端；零跨线程面 API（grep 0 命中，C4a 结构门） | 落实 |
| AC1 test-d 锁定 + 导出恰增一名 | V3（63 tests + Type Errors 0）+ V5（tsc 绿，负控全触发无 TS2578）+ `FROZEN_PRODUCTION_EXPORTS` +`'createHubSessionHost'` 字母序单行插入 | 落实 |
| AC2 OPEN→bootstrap→live→reconcile→CLOSE 完整回合 | A4–A9 逐项（OPEN_OK 恰一 + authorize 恰一次、快照/ACK 回指、SYNC 族 + doc 收敛、双向 UPDATE/ACK + 零 resync、CLOSE_OK 回指 + settled 恰一） | 落实 |
| AC3 矩阵 shim 重跑 + 通道零改动 + 状态机零 fork | 机制 (a)：`vi.mock` 仅替换 `createHubReplication` + 动态 import 7 文件（断言体零编辑，diff 亲证）；`hub-namespace.ts` 零 diff；V4 651 全绿含 shim 臂 53 | 落实（D7 字面机制偏离见 §A-4/§2——登记回流，不弱化 AC） |
| AC4 缝两侧只过 Uint8Array 与纯 JSON；零 worker 依赖/类型 | C4a（src+package.json 0 命中）/C4b（structuredClone + JSON 往返 + DataCloneError 负控）/C4c（字节 + 占位/wire 序）/C4d（无 live 对象） | 落实 |
| AC5 session 侧零重检入站 sequence | C5a（回退序 2 经 `handleFrame` 仍被消费 + `CLOSE_OK{ackedSequence:2}` + 零 fatal）/C5b（edge 单点负控）/C5c（结构门 0 命中）/C5d=M5（变异 9 红，含 C5a/C5c） | 落实 |
| SA2-F1（已解决项）三分支路由 | `HostBridge.openNamespace`：① authorized → 句柄转发不重调 `open()`（`reopenForwarded`）；② routing → OPEN 入有界 pending 按到达序同步冲刷（`pendingFlushed`）；③ denied → `denialSink.openNamespace`；矩阵 `:212`/`:240` 两用例 shim 臂断言逐字不变绿；M7/M7b 变异分别使两用例红（V9/V10） | 落实 |
| SA2 N1'（closed 守卫下挂起 terminate 的归宿） | `routeAdmission` `finally → settleTerminateWaiters`：closed/续体异常 → no-op resolve；denied → denialSink；authorized → 句柄 | 落实（夹具 :341-353/:397-415） |
| SA2 N2'（冲刷须在续体同一同步段） | `flushAuthorized`/`flushDenied` 在相位置位后同步调用、无 await 间隔；头注登记不变量；M7b 反证 | 落实 |
| SA2 N3'（Map 键模板笔误） | 键 = `` `${connectionKey}\u0000${namespaceId}` ``（`hub-session-host.ts:248`） | 落实 |
| SA8 RA1'（附录 + CONTEXT 同变更集） | ADR 0032 澄清附录 +23 行（A1 信号词汇/A2 三载体/A3 dormant+U8）+ `CONTEXT.md:229-231` 词条 + _Avoid_ 一项 | 落实（对齐风险见 §2/A-12-O1，SA8 iter-0 已裁决） |
| SA8 RA2'（deny 断言族 + W2 修正负控） | 矩阵 shim 臂 deny 族绿；round A4-W2：PEER_OWNER → 零 OPEN_OK + `NAMESPACE_NOT_FOUND` + 注册表零成功打开 + authorize 恰一次 | 落实 |
| SA8 RA3'（零 diff/导出恰增/S2 有界/observer 单点/反空跑/M1–M7/重命名纯机械） | 逐项独立复核全部成立（见 §A-5–§A-7、§A-9） | 落实 |
| SA8 RA6'(i)–(vi) | (i) 三分支 + 相位单调 + E10 try/catch + closed 守卫在夹具落地；(ii) 两用例 shim 臂绿；(iii) 两 suite 均有 unhandled 哨兵（round A11 + matrix afterAll）；(iv) `sessionsOpened` 断言在 clean 回合 = 1（多连接角见 §A-12-O3）；(v) M7 实跑登记；(vi) R11/R12 头注登记（夹具 :38-45） | 落实 |
| SA6 §12.6 两处授权编辑 | contract 测试 +1 行零删除零重排；structure 测试 7 行机械跟随（`:551` 全等断言形态不变） | 落实（diff 逐行核对） |

## A-4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
| --- | --- | --- | --- |
| D1 新模块 + 冻结面（逐字 SA6 §12.1）+ 内部复用 splice + 响亮前置 | `hub-session-host.ts` 全文；`open()` 前置 throw（空 connectionKey / 重复 (connectionKey, ns)）；`createHubSessionSink({port: adapterPort,…})` 单份组装 | 逐字段一致；公共名经 splice 重命名让出（D9） | — |
| D2 `handleFrame`：解码无 `expectedSequence`、capability 透传、OPEN→`openNamespace`、连接级/方向域静默、其余→`namespaceFrame(message, header.sequence)` | `:119-148`；switch 显式列名静默集合（HELLO/HELLO_ACK/OPEN_OK/BOOTSTRAP_SNAPSHOT/IDENTITY_CHANGED/GOAWAY），default→`namespaceFrame` | 与内部分派壳净行为等价（未知 kind 经内部 default 静默）；解码失败 → `connection-fatal{code ?? MALFORMED_FRAME}`（E2 fail-loud） | — |
| D3 `onFrame`：至多一 sink、后注册替换、退订置空、无 sink ⇒ 0、throw 同步传播、lane 区分 | `:150-155`/`:215-219`（`deliverFrame` 直接调用 listener） | 落实；占位 0 + 返回序承重由 A8/A12/M1 锚定 | — |
| D4 信号面：`settled` 恰一次经通道单调性、`connection-fatal` 丢 `wsCloseCode` 只发 code、`close`/`terminateUnauthorized` 委托 sink | `:164-171`/`:221-235`；桥侧 `settled → realPort.onChannelSettled`、`connection-fatal → realPort.connectionFatal(code)` | 落实；等价论据成立（通道仅两点恒 1002，重验 `hub-namespace.ts:662,1099`） | — |
| D5 adapterPort 17 成员映射 | `makePort()`（`:175-210`）逐一对照 D5 表：`dataGateOpen` 恒 true、`bufferedAmount` 恒 undefined、assembly per-session 单槽（`size>=1` 拒纳）、`emitObserver`=`dispatchReplicationObserver` 单点复用、`now` observer 门控 + `safeNow`、`connectionState` 两态投影 | 17/17 对齐；`HubSessionEdgePort` 成员集零增删（`hub-split.ts` diff 仅头注） | — |
| D6 U3 = edge 侧处置（denialSink = 生产 sink 直连真 port） | 夹具 `:217-226`/`:387-393`；denied/throw 续体投递 `denial.openNamespace` | 落实；drain 簿记（denied 终态 → 真 port `onChannelSettled`）保真 | — |
| **D7 宿主桥：三分支路由 + 有界 pending + 路由续体 E10 + closed 守卫 + terminate 相位挂起** | `HostBridge`（`:248-353`/`:357-476`） | **除一处已登记偏离外全部落实**：`namespaceFrame` 相位 `routing` 的**非 OPEN** 帧不走 pending 窗口（设计字面）而走**载体提交**（`commitToProduction`，`:316-327`）；OPEN 帧仍按分支 ② 入窗（SA2-F1 原样） | **SA4-O1（MINOR，登记回流）**：证据 = `sa3-issue420-design-letter-divergence.log`；等价性源码重放证实；SA8 iter-0 复查已裁 `implements-existing-decision`；设计 §7 D7 文本待 SA1 补正 |
| D7 续体：closed 守卫先查、`route.phase !== 'routing'` 次查、`finally` 收口 terminate 挂起 | `:357-400` | 落实（双守卫次序正确；E10 catch → `connectionFatal('INTERNAL_ERROR', 1011)`） | — |
| D7 pending 有界：≤16 帧/ns + 单帧 ≤ maxFrameBytes + 溢出 1008 响亮 | `enqueue`（`:464-476`）+ `MAX_PENDING_FRAMES=16` | 落实（镜像 `hub-connection.ts:54` 先例）；矩阵全程 `pendingOverflow===0` 断言在场 | — |
| D7 shim hub 服务面 + 早到帧有界缓冲 + auth timer | `ShimHubImpl`（`:527-729`）；`installEarlyFrameAdmission` 镜像 | 落实；门链保真度差异清单 + R11 + R7 按头注登记 | — |
| D8 机制 (a)：`vi.mock` 仅替换 `createHubReplication` + 动态 import + 末位反空跑 | `ws-replication-issue420-shim-matrix.test.ts`；夹具仅深路径 import（逐 import 核对：`../src/*.js`，零包入口引用） | 落实；`maxWorkers:1` + 按文件隔离 ⇒ mock 无跨文件泄漏 | — |
| D9 重命名（5 文件机械） | `hub-session.ts`/`hub-connection.ts`/`hub-split.ts`（仅头注）/#418 两测试 | 纯机械（diff 逐行）；`docs/**`/`CONTEXT.md` 对旧名零残留引用 | — |
| D10 RA1 文本（E1/E2 线 + dormant/U8） | ADR 附录 A1/A2/A3 + CONTEXT 词条 | 落实；A2 β 措辞对齐缺口已由 SA8 iter-0 裁决登记 | — |

## A-5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
| --- | --- | --- | --- |
| 协议 FSM（含重开矩阵/违例判定） | `hub-namespace.ts`（零 diff） | 零 diff 通道；公共工厂与夹具均注入消费 | ✓ |
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
| 出站帧字节快照 vs mux 就地盖章 | —（新面） | `deliverOutbound` 投递前快照字节 + 采样占位序 | — | 正确处理缝内时刻语义 |

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
| `open()` 同步建句柄 | `close()` 幂等（sink closeTail 单 promise；round A11 断言） | connection-fatal → closed 投影 + 出站 0 | ✓ |
| `onFrame`/`onSignal` 注册 | 退订函数（退订仅当当前 listener 匹配） | 监听者 throw 隔离 | ✓ |
| 桥 per-connection | edge `requestSinkClose` → fan-out（句柄 + denialSink） | dropConnection 回调 | ✓ |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
| --- | --- | --- | --- |
| 第二 FSM / 错误码表 / codec 语义 | — | 无（违例/拒绝应答全部由零 diff 通道产出；中继经 `encodeMessage` 单一 codec） | ✓ |
| 桥 accept 门链 | `hub-connection.ts` accept | test 夹具镜像 + 差异清单头注登记（R12） | 允许（test-only + 结构必然） |
| 公共 host `sessions` 表 vs sink `channels` 表 | listen：sink channels 永不删除 | host sessions 永不删除（`hub-session-host.ts:239-256`） | 登记见 §A-12-O4 |

## A-6. 文件范围审查（iteration 0；= 交付提交 `a315e70` 的 13 条 ALLOW 路径）

| Changed path | ALLOW entry | Purpose | Assessment |
| --- | --- | --- | --- |
| `packages/ws-replication/src/hub-session-host.ts`（新增） | ALLOW 第 1 条 | D1–D5 唯一新生产代码 | ✓ |
| `packages/ws-replication/src/index.ts` | ALLOW 第 2 条 | append-only 追加 1 值 + 7 类型 | ✓（既有 11 名零变化） |
| `packages/ws-replication/src/hub-session.ts` | ALLOW 第 3 条 | 重命名 + 别名删除 + 头注（零行为） | ✓ |
| `packages/ws-replication/src/hub-connection.ts` | ALLOW 第 4 条 | import/调用点/头注跟随 | ✓（3 处） |
| `packages/ws-replication/src/hub-split.ts` | ALLOW 第 5 条（仅头注） | 注释真实性 | ✓ |
| `packages/ws-replication/test/issue420-shim-hub.ts`（新增） | ALLOW 第 6 条 | D6/D7 夹具 | ✓（仅深路径 import） |
| `packages/ws-replication/test/ws-replication-issue420-session-host-api.test-d.ts`（新增） | ALLOW 第 7 条 | AC1 | ✓ |
| `packages/ws-replication/test/ws-replication-issue420-session-host-round.test.ts`（新增） | ALLOW 第 8 条 | AC2/AC4/AC5 | ✓ |
| `packages/ws-replication/test/ws-replication-issue420-shim-matrix.test.ts`（新增） | ALLOW 第 9 条 | AC3 | ✓ |
| `…issue418-edge-session-split-contract.test.ts` | ALLOW 第 10 条（§12.6 编辑 1） | 冻结表 +1 行 | ✓ |
| `…issue418-edge-session-split-structure.test.ts` | ALLOW 第 11 条（§12.6 编辑 2） | 机械跟随 | ✓（7 行） |
| `docs/adr/0032-…md` | ALLOW 第 12 条 | RA1 附录 | ✓（+23 行，决策文本未改） |
| `CONTEXT.md` | ALLOW 第 13 条 | RA1 词条 | ✓ |

DENY 核对：`hub-namespace.ts`、`hub-edge.ts`、`src/testing.ts`、其余 src 单点、协议文本、7 矩阵文件、上游包、`apps`/`domains`/`package.json` —— **全部零 diff**。无 ALLOW 外改动。

## A-7. 契约连锁审查（iteration 0）

| Contract | Caller | Actual handling | Risk | Finding |
| --- | --- | --- | --- | --- |
| `src/index.ts` 追加导出 | plugin.ts / nomic-server / 外部宿主 | append-only；`:551` 全等断言兼容；V8 node 侧 12 名实测 | 无 | — |
| `createHubSessionHost`→`createHubSessionSink` 重命名 | `hub-connection.ts:18/:449` + structure 测试锚 | 调用面封闭（旧名仅存于 `artifacts/sa6-*.mts` 诊断探针，不在任何 gate include 面） | 无（gate 面） | §A-12-O6 |
| `HubSessionSink` 面（edge → 桥代理） | `hub-edge.ts` | 六成员全实现；`openNamespace` 三分支 + 载体提交覆盖 edge 全部投递形态 | 无 | — |
| edge 台账 ⟺ route 在场锁步 | `dispatchReady` R-delivered 仅台账命中 | 桥对 route 缺失的 `namespaceFrame` 走响亮 `INTERNAL_ERROR`(1011)——结构上不可达 | 无 | §A-12-O2 |
| 公共句柄 listener 替换语义 | 宿主（夹具） | 后注册替换、退订仅当前匹配时置空 | 无 | — |
| `terminateUnauthorized`（revoke 链） | `ShimHubImpl.revoke` → edge → 桥 | 相位路由 + 挂起 + finally 收口；R11 时序观测边界维持登记 | 无（登记面） | — |
| matrix 文件二次注册 | `vi.mock` 动态 import | 断言体零编辑；ac7 值导入 `createPeerReplication` 经 `...actual` 保真 | 无 | — |

## A-8. 错误、恢复与并发（iteration 0）

| 场景 | 实现行为 | Assessment |
| --- | --- | --- |
| E1 出站 listener 缺席/返回 0 | `deliverFrame` 返 0 → 通道既有响亮失败；A12 红臂断言 `ACK_STATE_VIOLATION` + `close(1002,'protocol-error')` + onSignal 命中 + 回合不可达 live | ✓ |
| E2 `handleFrame` 解码失败 | `connection-fatal{code ?? 'MALFORMED_FRAME'}`，零吞帧 | ✓ |
| E3 连接级/方向域 kind | 静默（显式列名 + default 转发至内部壳后同样静默） | ✓ 净行为等价 |
| E4 pending 溢出 | `CONNECTION_POLICY_VIOLATION`(1008) 响亮 + 窗口清空 | ✓ |
| E5 `open()` 前置违反 | 同步 throw（M7 变异日志含 `重复开启` 签名） | ✓ |
| E6 信号/observer 监听者 throw | `emitSignal` 逐监听者 try/catch；observer 经 `dispatchReplicationObserver` 单点 | ✓ |
| E7 `close`/`terminateUnauthorized` 幂等 | sink closeTail 单 promise；terminate 无通道 resolve | ✓ |
| E8 并发 | 同步 pipe；续体单异步段；pending 冲刷在同步段内；相位互斥单调；JS 单线程 | ✓（SA2 N2' 头注 + M7b 反证） |
| E9 恢复/重试 | 无新增重试面；resync/reauth/revoke 走零 diff 通道 | ✓ |
| E10 续体非预期 throw | 整段 try/catch → `connectionFatal('INTERNAL_ERROR', 1011)`；零无承载 reject；两 suite unhandled 哨兵绿 | ✓ |
| 载体提交 × admission 迟归结算 | 续体 `route.phase !== 'routing'` 早退；authorized 结局下该 ns 由生产 splice 完整承载 | ✓（登记见 O1/O5） |
| 载体提交丢弃入窗 OPEN 条目 | 与 listen `finalize` 不应答 openWaiters 同构 | ✓ |
| 桥 closed 后迟归帧 | 句柄通道已 quiesce → quiet/terminal 守卫吸收 | ✓ |

## A-9. 测试质量审查（iteration 0）

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
| --- | --- | --- | --- | --- |
| `…session-host-api.test-d.ts` | 冻结签名正控全集 + 负控 `@ts-expect-error` ×6 | `vitest --typecheck` + 包 tsconfig 双面 | 无（TS2578 敏感性由 V5 绿背书） | — |
| `…session-host-round.test.ts`（10 用例） | A1–A11 运行时/wire 原字节断言 + A12 红臂 + C5a/C5b/C5c + C4a–C4d | 根 vitest include | 无 skip/only/todo；A12 `waitFor:'none'` 为红臂设计形态 | — |
| `…shim-matrix.test.ts` | 7 文件断言体零编辑二次执行 + 末位反空跑 + afterAll 零 unhandled | 同上 | 反空跑锚 `settled`（ac5-live `ACK_STATE_VIOLATION` 用例为 peer 侧 fatal，亲读 :132-150）；connection-fatal 正控由 A12 红臂承载；SA6 冻结要件全在场 | §A-12-O5 |
| 变异 M1–M7/M7b | M2 丢 OPEN（9 红）、M3 二次盖章（7 红）、M4 关 shim（恰反空跑红）、M5 session 重检序（9 红）、M7/M7b（2 红）、M1 内建红臂 | 日志 `artifacts/sa3-issue420-mutation-*.log` | M1 以夹具内建开关承载 = 设计 §12 A12 行明示形态 | §A-12-O7 |
| 红阶段证据 | V1 8×TS2305+TS2307、V2 3 failed | `sa3-issue420-red-*.log` | 红因 = 能力缺口 | — |
| 基线对账 | 77/588 → 80/651（+3 文件/+63） | package-suite / baseline 日志 | 数字自洽 | — |

---

# Part B — iteration 1 finalization repair 评审（本轮）

## B-1. Reviewed inputs

| 输入 | 状态 |
| --- | --- |
| `wiki/raw/task_issue-420_sa3_impl.md`（iteration 1 节：触发、C1 规范形、18 条变更路径表、V17–V21b、staging 清单） | 已读（全文） |
| `artifacts/sa3-issue420-evidence-reconcile.log`（656 行冻结证据日志：§0 诊断复现 + pre-state 字节事实、§1 命令、§2 内容保持证明、§3/§4 staged C1 扫描与 gate、§5 业务面保持、§6 V17–V20 重跑、§7 范围/引用完备性/终态哈希/staging 清单/post-commit 期望/残余项） | 已读（全文，逐节核对） |
| Git 只读复核：`git status --porcelain -uall`、`git diff --cached --stat`、`git diff HEAD --stat -- packages docs CONTEXT.md .editorconfig vitest.config.ts package.json`、`git diff --check`、`git reflog -5`、`git ls-tree HEAD` × 13 ALLOW 路径 + `git hash-object` 逐一比对、`git show HEAD:wiki/raw/task_issue-420_{design,sa2_review,sa3_impl,sa4_review,sa6_contract,sa7_report}.md` 引用普查 | 已执行 |
| 独立哈希/C1 复算：18 条候选路径 sha256（[:16] 全对 + reconcile 日志全量 64-hex）、字节数、行数、trailing-ws/CR/末字节扫描；被归一化行号内容抽查（cat -A） | 已执行 |
| `wiki/raw/task_issue-420_sa9_standards.md`（§10-M3 原文、verdict approve、requiresConflictRecheck: false）与 `wiki/raw/task_issue-420_sa10_spec.md`（verdict approve） | 已读（要点） |
| `wiki/raw/task_issue-420_implementation_conflict_report.md`（工作区版 = SA8 iteration 6 rebase 就绪终认；diff vs HEAD 亲读；requiresConflictRecheck: true 窄域） | 已读（要点） |
| `wiki/raw/task_issue-420_sa6_contract.md`（HEAD 版 §16 :413 smoke.mts 已删除登记；§12 冻结面） | 已读（要点） |
| `.editorconfig`（C1 规则三行亲证）+ #419 先例 commit `bd75a2c`（`test(replication-protocol): canonicalize evidence contract` 亲证存在） | 已核对 |
| SA3 iteration 0 报告（V1–V16、Deviations 1–4、iteration 1 追记） | 已读（全文） |

## B-2. Verdict（iteration 1）

**`approve`**（0 × BLOCKER；0 × MAJOR；6 × MINOR 非阻断观察 O8–O13）。

判定链（全部为本轮独立复核证据，非采信 SA3 自述）：

| # | 声明 | 独立复核结果 |
| --- | --- | --- |
| 1 | 工作区改动恰为 18 条 staging 清单路径 | `git status --porcelain -uall` = 2 M + 16 ??，与 §7.4 清单**逐条相同**，无第八条以外改动 |
| 2 | 零业务面字节变化 | 13 条 ALLOW 路径 `git hash-object` vs `git ls-tree HEAD` **13/13 IDENTICAL**；`git diff HEAD --stat -- packages docs CONTEXT.md …` 空 |
| 3 | 归一化仅空白、终态 C1 全清 | 18 路径 trailing-ws=0 / CR=0 / 末字节恰一 LF 且前字节为内容字节；`git diff --check` RC=0；行号抽查与 gate `{WS}` 诊断吻合 |
| 4 | after 哈希声明真实 | 报告表 16 个 after sha256[:16] 与实测全同；reconcile 日志全量 sha256/53056 B/656 行全同；§7.3 全量表前缀逐条相符 |
| 5 | 真实 index 零写入、无 commit/push | `git diff --cached --stat` 空；reflog HEAD@{0} = `a315e70`（交付后无 commit） |
| 6 | 引用完备性（SA9 §10-M3 闭合） | HEAD 六报告 issue420 artifact 引用逐条解析：全部 committed-at-HEAD 或在本 staging set；唯一例外 `sa6-issue420-smoke.mts` = SA6 §16 :413 登记的已删除临时脚本；SA9 §10-M3 未跟踪清单（12 artifact + 简报）与被归一化 13 路径**恰同一集合** |
| 7 | 无 hash registry 破坏 | HEAD 六报告 40/64-hex 扫描仅命中 `7039f6d…` commit OID，零 artifact sha256 注册 |
| 8 | 归档补齐符合先例 | SA9（approve）/SA10（approve）终审 + Host 简报 + SA8 iteration-6 报告随交付归档 = #418/#419/#421 同款惯例；#419 规范化先例 commit `bd75a2c` 在库 |
| 9 | 内部一致性 | §0 pre-state（bytes/lines/sha）↔ §2 Δbytes 算术 ↔ 当前实测三方吻合（如 M2 10921→10912 = −9 = 8 行 × 1 尾空白 + 1 EOF LF；M3 −8；M5 −9；sa6-runner −4 无 EOF 项）；census 29+13=42 artifacts、10+3=13 wiki 条目吻合 |
| 10 | 重跑验证（V17–V20） | 冻结日志内命令行 + exit 码齐全（63/63、tsc 0、80 files/651 tests、根 typecheck 0），与 iteration 0 同口径零回归声明自洽；SA4 不重跑测试，以日志完备性 + 业务面零字节变化为判定基础 |

## B-3. 上游要求落实（iteration 1）

| Requirement or finding | Implementation evidence | Assessment |
| --- | --- | --- |
| finalization repair 派工目标：把交付提交后遗留工作区的证据集归并为**可提交（gate-clean）**，不改已批准实现语义 | 13 路径 C1 归一化（§0 诊断 39 findings / 13 路径 → §4 GATE_RC=0）；13 ALLOW 路径 blob 身份 13/13 | 落实（本轮亲证） |
| SA9 §10-M3：commit 证据集不完整——finalize/提交方在同一交付归档中补齐（#418 先例含任务简报） | 18 条 staging 清单覆盖 M3 全部列举路径 + SA9/SA10 终审 + SA8 报告；引用普查 UNRESOLVED=0（本轮独立复现） | 落实 |
| Owner 评论 | 两轮派工均 none、REST `[]`——无逐条映射义务 | 无遗漏 |
| SA6 §16 保留诊断资产原样 | 3 个 `.mts` 探针 import 旧名维持原状（SA3 Deviation 2 迭代 1 追记继续有效；不在任何 gate include 面——iteration 0 已核） | 维持登记（§B-12-O6） |
| SA9 §10-M7 / SA4 O7（变异日志缺命令行） | 本轮**不重写**历史日志正文（仅 C1 空白）——§7.6 R4 登记；reconcile 日志自身带命令行（部分改善增量证据卫生） | 维持登记 |

## B-4. 设计落实审查（iteration 1：对派工目标的落实）

| 目标要素 | 实现位置 | Assessment | Finding |
| --- | --- | --- | --- |
| C1 规范形 = `.editorconfig [*]` 三规则 + 门规则 | `.editorconfig` 亲证三行在册；18 路径全部满足（1）LF 前无 [ \t]（2）EOF 无 [ \t]（3）恰一末尾 LF | 落实 | — |
| 归一化命令幂等且可复算 | `perl -0777 -i -pe 's/[ \t]+(?=\n)//g; s/\n+\z/\n/'`（§1 逐路径记录）；当前态重放为零改动（C1 态即幂等不动点，本轮扫描等价证明） | 落实 | — |
| 3 条本已 C1 路径零改动 | impl_conflict_report / sa9_standards / sa10_spec：§0 pre-state sha = 当前 sha（`590ef35d…`/`434fd836…`/`fba2b74a…`），本轮实测相同 | 落实 | — |
| reconcile 日志自身 C1 | tw=0、恰一末尾 LF；`{WS}` 嵌入约定（:29-30）避免日志自违 | 落实 | — |
| V21a/V21b 终态 gate（17→18 路径含报告自身） | 声明 GATE_RC=0 / C1 18/18（报告 §V21b）；本轮以文件级 C1 扫描独立复现同一事实（18/18 清） | 落实（判定不依赖该次实跑记录） | — |
| post-commit 锚 | §7.5：`git show HEAD:<path> | sha256sum` 对照 §7.3 全量表——Controller 可机械复核 | 落实 | — |

## B-5. 架构一致性与惯例（iteration 1）

| 检查面 | 事实 | Assessment |
| --- | --- | --- |
| 归档惯例对照 | #419 `bd75a2c`（canonicalize evidence contract）同款 C1 归并先例；#418/#421 归档范围（简报 + SA9/SA10 + SA8 报告）同族 | 一致 |
| 单一事实源 | 证据字节终态唯一登记于 reconcile §7.3 + SA3 报告表（两处一致，本轮比对）；无第二份哈希账 | 无漂移 |
| 生命周期对称性 | 无新增资源；scratch index 是临时只读验证面，真实 index 未触碰 | ✓ |
| 平行机制 | 无新增 cleanup/worker/包装；归并是对既有证据文件的原位规范化 | 无 |

## B-6. 文件范围审查（iteration 1）

| Changed path | 授权 | 用途 | Assessment |
| --- | --- | --- | --- |
| 12 条 artifact 日志（9 sa3 + sa6-runner-trigger-red + 2 sa7） | 本轮派工（finalization repair：归并证据集使其可提交）；gate 诊断命中路径集合 | 仅 C1 空白归一化 | ✓（内容保持证明 §2 + 本轮行号抽查） |
| `wiki/raw/task_issue-420.md`（Host 简报） | 同上（#418/#419 先例归档含简报；gate 诊断命中） | 去 EOF 空行 1 字节 | ✓ |
| `artifacts/sa3-issue420-evidence-reconcile.log` | 本轮派工（证据） | 归并与验证原文（656 行） | ✓（C1 自洽） |
| `wiki/raw/task_issue-420_sa3_impl.md` | SA3 固定产物（skill：原位更新实现报告） | 登记 iteration 1 | ✓ |
| `wiki/raw/task_issue-420_{sa9_standards,sa10_spec}.md` | 非 SA3 写入（SA9/SA10 终审产物）；本轮仅纳入 staging 清单 | 交付归档补齐（SA9 §10-M3） | ✓（零字节改动） |
| `wiki/raw/task_issue-420_implementation_conflict_report.md` | 非 SA3 写入（SA8 iteration 6 原位改写，内容含其自身派工号 `sa-4515a5eb…`/mabf-sa8）；SA3 零字节改动（§0 pre-state sha = 当前 sha） | 交付归档补齐 | ✓ |
| 13 条 ALLOW 路径 + `packages/**`/`docs/**`/`CONTEXT.md`/`.editorconfig`/`vitest.config.ts`/`package.json`/`tsconfig*` | 迭代边界 | **零改动**（本轮 13/13 blob 身份 + diff 空） | ✓ |

- **无越界**：工作区全部改动 = 18 条清单内路径；SA3 无 `git add`/`commit`/`push`（index ≡ HEAD、reflog 单条交付 commit）。

## B-7. 契约连锁审查（iteration 1）

| Contract | Caller | Actual handling | Risk | Finding |
| --- | --- | --- | --- | --- |
| 证据文件字节变更 × 哈希注册面 | HEAD 六份交付报告 | 零注册（仅 commit OID）；归并不可破坏既有引用 | 无 | — |
| 证据文件字节变更 × 报告路径引用 | HEAD + 工作区报告（sa3_impl iteration-1 节、SA8 iter-6） | 全部引用路径可解析（committed 或 staging set；smoke.mts = 登记删除例外） | 无 | — |
| staging 清单 × Controller finalize | §7.4 逐行 `git add -A --` 形式 + §7.5 post-commit 复核锚 | 清单完备精确（= 工作区全部改动）；漏 stage 即阻断 finalization 的风险已由「清单 = git status 全集」消除 | 无 | — |
| 归档内 verdict 文本互操作性 | SA8 iter-6（requiresConflictRecheck: true，窄域 rebase）vs SA9/SA10（approve，false，针对 iter-0 SA8 报告作出） | SA3 零改动 verdict 文本；张力由 §7.6-R1 显式登记给 Controller | 登记面（非本轮缺陷） | §B-12-O11 |
| iteration-0 D7 裁决文本的可追溯性 | 最终归档读者 | SA8 iter-6 原位改写后，iter-0 实现复查的 D7 逐条裁决表仅存于 git 历史（`a315e70` blob `34d26e3`）；iter-6 报告以「前轮账」引用其结论（RA1''–RA4''、行 27/44/94） | 低（历史可取） | §B-12-O12 |

## B-8. 错误、恢复与并发（iteration 1）

| 场景 | 行为 | Assessment |
| --- | --- | --- |
| 归一化误伤内容字节 | §2 内容保持证明（nonws_bytes_equal / rstrip_content_equal 全 YES）+ 本轮行号/形态抽查；仅空白缺陷被移除 | ✓（before 态不可独立复算的残余见 §B-12-O8） |
| C1 形态在 commit 时再漂移 | C1 = 幂等不动点（无尾随空白 + 恰一末尾 LF，任何规范化器重放零改动）——与 #419 事故形态（raw 注册态带 EOF 空行）相对 | ✓（§7.5 注释成立） |
| Controller stage 错误字节（非当前工作区态） | §7.5 post-commit `git show … | sha256sum` 对照 §7.3 提供机械验收锚 | ✓（流程护栏） |
| 中途失败（归一化半途/scratch index 残留） | 归一化为逐文件原子 perl -i；真实 index 无涉；scratch index 在 /tmp（会话级） | ✓（交付面无残留） |
| 并发变异探针干扰重跑 | §6 声明顺序执行（无并发探针）；冻结日志时间戳连续 | ✓ |

## B-9. 测试质量审查（iteration 1）

| Test/验证 | Behavior asserted | Runner entry | Weakening or gap | Finding |
| --- | --- | --- | --- | --- |
| V17 契约三路径 | 3 files / 63 tests / Type Errors 0 / exit 0 | reconcile §6（命令行 + 输出原文冻结） | 无（与 V3 同口径） | — |
| V18 包 typecheck | tsc exit 0 | reconcile §6 | 无 | — |
| V19 包全量 | 80 files / 651 tests / Type Errors 0 / exit 0（Duration 47.45s 原文在册） | reconcile §6 | 无（与 V4 同口径，零回归声明自洽） | — |
| V20 根 typecheck | 15 tsconfig 串行 exit 0（命令链原文在册） | reconcile §6 | 无 | — |
| V21a/V21b gate | scratch-index cached gate + 逐 staged blob C1 扫描 17→18 全 PASS | SA3 报告 §V21b（实测记录） | 本轮以文件级 C1 扫描独立复现同一事实；判定不依赖该记录 | — |
| 测试源码面 | iteration 1 零测试字节变化（13 ALLOW blob 身份含 4 个测试路径 + 夹具） | `git hash-object` 亲证 | 无弱化可能（字节未动） | — |

## B-10. Required revisions

**无阻断 finding**（0 × BLOCKER / 0 × MAJOR）。登记回流项：

| Finding ID | Severity | Evidence | Problem | Required change | Acceptance | Suggested routing |
| --- | --- | --- | --- | --- | --- | --- |
| SA4-O1（承 iteration 0，仍开放） | MINOR（登记回流） | `artifacts/sa3-issue420-design-letter-divergence.log`；`test/issue420-shim-hub.ts:311-327` + 头注；SA8 iter-0 裁决（HEAD 历史 blob `34d26e3`） | 设计 §7 D7 `namespaceFrame` 行文本仍为字面 pending-窗口机制，与落地载体提交不一致（SA8 已裁 implements-existing-decision，文本滞后） | SA1 把 D7 该行修为「非 OPEN 帧在 routing 相位即时提交生产承载；在途 OPEN 入有界 pending 窗口」（ADR 附录 A2 β 措辞随裁） | 设计文本与夹具行为一致；AC3 七文件 shim 臂维持断言逐字不变全绿 | design |
| SA4-O5（承 iteration 0，仍开放） | MINOR（登记回流） | `test/issue420-shim-hub.ts:322` 相位命名 | 载体提交使相位 `denied` 语义扩大为「承载 = 生产 splice」 | 随 O1 一并澄清命名/语义（如 `carrier-committed`） | 设计/夹具注释无歧义 | design |

## B-11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
| --- | --- | --- | --- |
| post-commit 字节锚 | Controller（finalize 时执行 §7.5） | `git show HEAD:<16 路径> | sha256sum` 与 §7.3 全量表逐条相等 | 任一不等（commit 携带了非 C1 字节或清单遗漏） |
| rebase 后证据失效重取 | Controller/SA8 RA2（§7.6-R2） | rebase 到 `1f5809b` 后按五门在新树重取证；C1 字节形仍有效、树绑定失效 | 援引 pre-rebase 证据合并交付 |
| `vi.mock` 平台稳定性 / R11 / 载体提交角落 / handles 键 / suppressSequenceReturn | 承 iteration 0 §11 各行（不变） | 同 iteration 0 | 同 iteration 0 |

## B-12. Non-blocking observations

| # | 观察 | 依据 | 建议 |
| --- | --- | --- | --- |
| O2（承 iter-0） | 桥 `namespaceFrame` 防御分支形态与内部 splice `withChannel` 不同（均结构不可达且响亮） | `test/issue420-shim-hub.ts:288-292` | 维持登记 |
| O3（承 iter-0） | 夹具 `handles` 以 namespaceId 为键，多连接同 ns 后开覆盖先开 | 夹具 :133/:378 | 未来多连接断言前改复合键 |
| O4（承 iter-0） | 公共 host `sessions` Map 无删除路径（冻结语义字面兑现） | `src/hub-session-host.ts:239-256` | 后续宿主接线票明确生命周期 |
| O6（承 iter-0 = SA9 M4） | SA6 三个诊断探针 `.mts` import 重命名前旧名，不在任何 gate include 面 | `artifacts/sa6-issue420-*-probe.mts`；§7.6-R3 | SA6/Controller 重跑探针时改 `createHubSessionSink` |
| O7（承 iter-0 = SA9 M7，部分改善） | M1 变异日志 `1 passed | 9 skipped` 无命令行回显；本轮对**归一化命令**逐路径记录（§1），历史变异日志正文未重写（§7.6-R4 明示不重写边界） | reconcile §1/§7.6-R4 | 后续变异日志统一带命令行 |
| **O8（新，iter-1）** | 13 条被归一化路径的 **before 态哈希不可独立复算**（原文件未跟踪、无外部注册表；`/tmp/sa3-420-recon/before/` 快照在 SA3 会话外不可达）。缓解：§0 gate 诊断行号与 before 行数吻合、Δbytes 算术自洽、行号内容抽查吻合、after 态全量亲证、操作幂等性在当前态等价证明 | reconcile §0/§2 vs 本轮实测 | 未来同类归并先把 pre-state 哈希落进将被提交的载体（本轮 §0/§7.3 已做到——提交后即成永久注册）；post-commit §7.5 复核闭环 |
| **O9（新，iter-1）** | iteration-1 派工原文未持久化于 worktree（触发诊断 `MABF_FINALIZE_REPAIR_REQUIRED`/`whitespaceViolations` 仅见报告引述）；跨 owner 产物（SA6/SA7 日志、Host 简报）的空白改写授权依赖该派工面 | SA3 报告 :14-15；§0 诊断命中的 13 路径恰为被改集合（含他 SA 产物）——与 gate 驱动的最小修复面一致，内容保持证明约束爆炸半径 | Controller 归档本轮时附派工/诊断原文（或其引用），使授权链可审计 |
| **O10（新，iter-1）** | Host 简报 `wiki/raw/task_issue-420.md` 被 C1 化（−1 字节 EOF 空行）——上游输入产物的字节改写；#418/#419 先例已确立「简报随交付归档」惯例，且简报正文内容行零变化（§2） | reconcile §2 末行；#419 `bd75a2c` 先例 | 维持现状（惯例内）；未来简报若引入受保护标记需在归并前显式豁免 |
| **O11（新，iter-1 = §7.6-R1）** | 归档内 verdict 标志张力：SA8 implementation 报告 iteration-6（随本轮归档）`requiresConflictRecheck: true`（窄域：rebase 后 index.ts 并集面未落树过门禁），而 SA9/SA10 终审（同批归档）`false`（针对 iter-0 SA8 报告作出）。SA3 明确零改动 verdict 文本、不预裁 rebase | SA8 iter-6 §10；SA9 :6；SA10 :32；reconcile §7.6-R1 | Controller 排序 rebase → RA2 五门重取证 → 冲突复查闭合；两标志的指称对象不同，非矛盾，需在归档说明中并陈 |
| **O12（新，iter-1）** | SA8 implementation 冲突报告被 iteration-6 原位改写后，iteration-0 的 D7 载体提交逐条裁决表（行 11 等共 8 处「载体提交」）不再在最新归档正文中，仅存 git 历史（`a315e70` blob `34d26e3`）；iter-6 以「前轮账」保结论引用 | 本轮 grep：工作区版「载体提交」×1 vs HEAD 版 ×8 | 归档说明或 reconcile 后续版补一句历史指针（`git show a315e70:wiki/raw/task_issue-420_implementation_conflict_report.md`） |
| **O13（新，iter-1）** | 本 SA4 review 的原位更新本身构成 18 条 staging 清单之外的新工作区改动（tracked-modified）；iteration-0 的同款产物由 Controller 随交付归档（`a315e70` 含 sa4_review） | 本文件；`git ls-files` 含 sa4_review | Controller 归档本轮评审产物（或并入同一次 finalize 归档），避免再次触发未跟踪/未提交证据诊断 |

---

**结论（iteration 1）**：`approve`。finalization repair 的交付完整性声明**全部经本轮独立复核成立**：业务面 13/13 ALLOW 路径与交付提交逐字节相同；工作区改动恰为 18 条精确 staging 清单；C1 归一化终态全清且与 gate 诊断、Δbytes 算术、行号内容三方自洽；真实 index 零写入、交付后零 commit/push；SA9 §10-M3 引用完备性判据独立复现闭合；无 hash registry 破坏。残余不可独立复算面（before 态哈希、派工原文持久化）均有边界证明与登记（O8/O9），不构成阻断。iteration 1 零决策文本变化，不引入新的 ADR 冲突面，本轮不提交 `requiresConflictRecheck`；在册的 rebase 门（SA8 iter-6 窄域 true）与 A2 β 措辞登记（SA4-O1 → design）维持原回流路由。
