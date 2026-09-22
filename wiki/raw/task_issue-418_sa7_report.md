# SA7 动态验证报告 — issue #418：`HubConnectionImpl` 拆分 Edge/SessionHost + 单体进程内组合（ADR 0032 决策 1 / spec #415 T2）

- Dispatch：`sa-074814eb-6185-4295-838e-65e21a052a6c`（mabf-sa7 / final-verification / iteration 0）
- 被验对象：worktree `/home/wangjian/nomicore-fix-issue-418`（分支 `mabf/issue-418`，HEAD `27e012b6606e48797842a79e11e3505819c34cc6`）内的 SA3 iteration 2 实现（`hub-split.ts`/`hub-edge.ts`/`hub-session.ts` 新增 + `frame-io.ts`/`backpressure.ts`/`hub-connection.ts` 改写，未提交 diff）
- **Verdict：`approve`**（全部设计声明改变的数据流按设计变化；全部声明不变的数据流保持不变；连接/通道状态机转换与关键值正确；禁止转换未出现；错误与 cleanup 符合设计并到达 quiescence；临时诊断已清理。1 条 finding 为 SA4 §12-O1 已登记角落的动态复证（非阻断，路由已定），见 §Deviations/F-1）

---

## 1. Inputs

| 输入 | 状态 |
| --- | --- |
| `wiki/raw/task_issue-418.md`（简报；5 AC；§Comments 空；派工单明示 REST comments `[]`） | 读取；无 owner 追加要求 |
| `wiki/raw/task_issue-418_design.md`（SA1 iteration 2 批准设计，736 行） | 全文读取；§2.2 窗口矩阵 / §7 D1~D8 / §8 数据流路线 1~8 / §12 验收映射为验证基准 |
| `wiki/raw/task_issue-418_sa6_contract.md`（SA6 契约，approve） | 全文读取；C0a~C0d / C1~C6 / U1~U5 |
| `wiki/raw/task_issue-418_sa3_impl.md`（SA3 iteration 2 原位版实现报告） | 全文读取；§3/§6 宣称与实际运行核对 |
| `wiki/raw/task_issue-418_sa4_review.md`（SA4 实现静态审查，**approve**） | 全文读取；§11 V1~V4 后续动态验证项为本报告必答项；§12-O1/O2/O3 观察 |
| `wiki/raw/task_issue-418_implementation_conflict_report.md`（SA8 实现后复查，clear） | 读取；仅用于识别不可改变的协议边界（R4''/R5''/R7''/R8'' 义务面） |
| `wiki/raw/task_issue-418_sa2_review.md`、`task_issue-418_design_conflict_report.md` | 读取（背景裁决） |
| 源码亲读 | `hub-edge.ts`（790）/`hub-session.ts`（293）/`hub-split.ts`（127）全文；`frame-io.ts`/`backpressure.ts` diff 逐行；`hub-namespace.ts` 零 diff 亲证（startOpen :335-459、quiesceConnection :1174-1182、terminateUnauthorized :1186-1191、onConnectionClosed :1197-1205）；两 ALLOW 测试文件全文 |

SA7 未修改任何生产代码、设计或既有测试；本报告为唯一持久产物（另有两份运行日志入 `artifacts/`）。

## 2. Runtime environment

| 项 | 值 | 证据 |
| --- | --- | --- |
| worktree / 分支 / HEAD | `/home/wangjian/nomicore-fix-issue-418`、`mabf/issue-418`、`27e012b` | `pwd`、`git branch --show-current`、`git rev-parse HEAD` |
| 运行时 | node `v24.13.0`、pnpm `10.28.2`、vitest `3.2.7`、tsc `5.9.3` | `node -v` 等；`RUN v3.2.7 /home/wangjian/nomicore-fix-issue-418`（日志头） |
| 依赖 | 既有 `node_modules`（SA6 `pnpm install --frozen-lockfile` 安装态延续） | `ls node_modules/.bin/vitest` |
| 驱动形态 | fake scheduler（`createRegistryTestScheduler` / harness `settle`/`settleUntil`）+ 真实 TCP/真实 timer（既有 real-transport 套件）；SA7 探针 = **真实生产两半的进程内组合**（`createHubReplicationEdge` + `createHubSessionHost` + 真 Registry/Runtime/`HubNamespaceChannel`），缝两侧仅加**纯观测包装**（记录并原样转发，零行为改动） | §6/§8 |
| DENY 面（SA7 会话前后） | `git diff --stat HEAD` 仅 `backpressure.ts`/`frame-io.ts`/`hub-connection.ts`（SA3 既有实现面）；`hub-namespace.ts`、index/testing/types/defaults/validate/plugin、peer-*.ts、`replication-protocol/src/**`、docs/CONTEXT/apps/根配置**全部零 diff**；既有测试文件零修改 | §6 命令输出 |

## 3. Changed Data Flow Verification

设计 §8 路线 1~8（本版行为面变更 = D5 到达点建通道 + 异步 edge-owned admission 拉取 + D3 占位编码/盖章 + D4b 三案路由）。运行时驱动：既有验收测试（不改而绿）+ SA7 组合层探针（缝跳点直接观测，trace 见 `artifacts/sa7-issue418-dataflow-probe.log`）。

| Route | Design change | Runtime driver | Observed hops | Expected result | Actual result | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 1. 入站 ns 域帧（已投递 ns，**含 authorize 窗口**） | 窗口帧到达点即时投递进在场 `'opening'` 通道（零缓冲、零结算段回放）；效应在 authorize 结局产出之前 | M1 十臂×{ok,deny}（25/25）+ 探针 P2 + `ws-replication-ac7-faults.test.ts`（12/12，I13a 锚） | P2 trace：`authorize(NS)#1 → sink.openNamespace(NS) → port.openAdmission(NS)#1 → post-openNamespace(channels.has=true state=opening) → sink.namespaceFrame(UPDATE seq=3) → port.sendControlFrame(ERROR) placeholderSeq=0→stamped=2 → port.onChannelSettled(NS)`——**全部先于** `admission settled (NS): outcome=authorized` | 到达点投递 + §2.2 矩阵行（UPDATE → STATE_VIOLATION ns ERROR + 3 事件 + failed + settled）；旧路径（缓冲/回放/edge 复现）不得出现 | 与预期逐点一致：窗口 UPDATE 在 authorize 未结算时已产出 wire/事件；投递序列中 namespaceFrame 先于 admission 结算；ac7-faults:53 到达点 ERROR 锚绿 | ✅ |
| 2. 入站 OPEN（authorize ok） | ① `beginAdmission`（台账先写 + 唯一真实 authorize）→ ② 无条件到达点投递 → 通道同步建立 + `startOpen` 同步前缀同步拉取 → 结局以纯 JSON 经 port 拉取过缝 → registry.open/lease/session → OPEN_OK | 探针 P1 + C0a（9 用例族）+ M1-0 ok 臂 + auth-lifecycle-red（20/20） | P1 trace：`authorize(peer-alpha,NS) #1 → sink.openNamespace(NS) → port.openAdmission(NS) #1 → post-openNamespace: channels.has=true state=opening`（同一同步段，pull 在 openNamespace 返回前）；resolve 后 `admission settled outcome=authorized → sendControlFrame(OPEN_OK) placeholderSeq=0→stamped=2 → BOOTSTRAP_SNAPSHOT …→stamped=3` | 到达点锁步（I13b）；authorize 恰一次入参逐值；结局经拉取（非参数推送）；OPEN_OK/bootstrap 流转 | 与预期逐点一致：calls==[(peer-alpha,NS)] 恰一次；pull 恰一次且先于 post-open 日志；wire 在 resolve 前仅 HELLO_ACK；通道 opening→bootstrapping | ✅ |
| 3. 入站 OPEN（denied / throw） | denied → shim `{ok:false}` → 零 diff 通道 `!ok` 短路（registry.open 之前）→ `finishOpenError`（N waiter N 帧 + 恰一事件族 + settled）；throw → shim reject → INTERNAL_ERROR | 探针 P3 + C0b-denied/throw/fail-loud（4 用例）+ M1-0 deny 臂 + issue172/observer-red 族 | P3：`admission settled outcome=denied`（拉取面）→ wire `ERROR:NAMESPACE_UNAUTHORIZED:ns` + 3 事件（namespace-error sent / opening->failed / namespace-failed:open-failed）→ `port.onChannelSettled(NS)` 恰一次；`registry.open` **零调用**（资源 spy） | 被拒 ns 零会话资源唤起；失败面由零 diff 通道原生产出 | 与预期逐点一致：registryOpenCalls==0；settledSignals==[NS]；pull outcome=='denied' | ✅ |
| 4. 出站控制帧（session 来源） | session 占位编码（sequence=0）→ 缝 → edge `sendControlFrame`（observeWater + 暂停态配额 byteLength 判据）→ `emitOne` 盖章 `[8..12]` | 探针 P1/P2/P3/P8 + C1d/C0b + issue169/231 族（包套件绿） | P1：占位帧 `OPEN_OK`/`BOOTSTRAP_SNAPSHOT` 的 `placeholderSeq==0`，edge 盖章返回 `stamped==2/3`；返回序供通道记账（`bootstrapSnapshotSeq`） | 占位 0 不上线；盖章单点；序号回传逐值 | wire 序恒 1..N 连续；`placeholders.every(placeholderSeq===0)` 成立 | ✅ |
| 5. 出站数据帧（drain 轮转） | data 路径：session 闸门前置（connectionState→dataGateOpen）→ 占位编码 → 缝 → edge `tryEmitDataFrame`（单帧守卫 + 统一账本 byteLength 判据）→ 盖章 | C1c（多 ns 单计数器）+ C0b（占位帧序号）+ issue137/169/295/301 族（包套件 569/569 内全绿；真实 TCP data 面） | 既有断言面（本报告 §6 命令 3 全绿）；单点计数器跨连接级/ns 域帧（C1c：两 ns 共用同一序列） | data 准入判据与 HEAD 逐路径等价（D3.3 账） | 全绿；无占位 0 泄漏（C6a 反证 + C1a 1..N） | ✅ |
| 6. 连接级出站帧（edge 自有） | HELLO_ACK/GOAWAY/连接级 ERROR/R-none 合成走 edge 消息形态管线，与 session 字节路径汇流同一 `emitOne`；不跨缝 | 探针 P1/P4/P6/P7 + C3a/C3b/C3c 金标（契约 17/17） | P1：HELLO_ACK stamped=1 且 **port 零占位记录**；P4：GOAWAY stamped=2 同样不跨缝；P6：conn ERROR 直发；P7：R-none 合成 ns ERROR + `namespace-error{sent}` | 连接级帧由 edge 直接出站（C0d）；单一序列分配点跨两类帧 | wire 序 [1(HELLO_ACK),2(OPEN_OK),3(BOOTSTRAP)] 证明单计数器；GOAWAY/ERROR 同构 | ✅ |
| 7. 连接收口（五路） | closedFlag 先置位 → setConnState → 清句柄 → teardown → `sink.close()`（同步 quiesce 前缀 + 异步尾）→ transport.close → cleanupAll → drop | 探针 P5/P6/P4 + issue171-red（5/5，H1 锚）+ RT-F1 真实 TCP GOAWAY drain + issue174/175/176/reauth-lifecycle 族 | P5：close 期间 admission 在途 → `sink.close() #1 → onConnectionDropped`，通道 opening→closing→closed，wire 零 ns 帧；scheduler 再推进 120s **零新帧零新事件**（quiescence） | 五路同构；句柄必清；close 幂等（sink.close 恰一次）；迟归续体不复活连接 | sinkCloses==1（P4/P5 各证一次幂等）；deadline/liveness/fatal/transport 各路分类正确（M3b/issue170/171 real-transport 绿） | ✅ |
| 8. revoke / reauth | revoke → edge 无条件 `sink.terminateNamespace`（窗口期在场通道响亮；无通道/quiet → no-op）；reauth → GOAWAY + drain 判定两量化 + deadline | 探针 P4/P8 + M1-revoke（重定基 HEAD）+ M2 + issue175 D1 真实 TCP | P8：`sink.terminateNamespace(NS) → sendControlFrame(ERROR) placeholderSeq=0→stamped=2 → onChannelSettled(NS)`；无通道 ns 与终态 ns 均 no-op resolve；P4：drain 窗口内 `'opening' 未 settled ⇒ 不提前收口，deadline 到点 close(1001)（不被 pending 阻塞） | 到达点 NAMESPACE_UNAUTHORIZED + protocol-violation + settled；迟归 ok = HEAD 原生 D-H1；drain 不跨 pending、deadline 不等通道 | M1-revoke：迟归 ok → registry.open 恰一次 transient + lease 恰一次释放 + 零新帧零新事件；P4 deadline 收口且 admission 仍 pending | ✅ |

关键中间跳点均有运行时证据（不能只看最终返回值）：admission 台账写入先于投递（P1 trace 次序）、shim 同步拉取发生在 `openNamespace` 返回前（pull 日志先于 post-open 日志）、窗口帧投递先于结局结算（P2 trace 次序）、占位 0 → 盖章 N 的字节变换（P1 placeholder/stamped 对）、settled 单调至多一次（P3/P8 settledSignals）。

## 4. Preserved Data Flow Verification

| Route | Preserved invariant | Runtime driver | Baseline observation | Current observation | Verdict |
| --- | --- | --- | --- | --- | --- |
| wire 逐字节（非 Yjs 载荷帧） | 全帧 hex 金标；envelope 纪律 | SA6 契约 C3a/C3b/C3c/C5c（17/17，本会话新跑）+ 探针 P1 字节等价检查 | HEAD 基线金标（SA6 冻结值） | 契约全绿；P1 逐帧「decode → 按真实序 re-encode → hex 相等」全过（**占位编码 + `[8..12]` 盖章 ≡ 单次编码**的直接运行时证明，含 BOOTSTRAP_SNAPSHOT Yjs 载荷帧） | ✅ |
| 出站序列单点分配 | 每帧序 = lastSeq+1，控制恒先，跨连接级/ns 域/多 ns 单计数器，无 0 泄漏 | C1a/C1b/C1c/C1d + 探针 P1 | HEAD：`OutboundQueue.emitOne` 单点（SA6 C1 全绿） | 同绿；P1：HELLO_ACK(edge 消息形态)=1、OPEN_OK/BOOTSTRAP(session 字节路径)=2/3 同一计数器；C6a 反证维持（占位/撞序 → SEQUENCE_VIOLATION） | ✅ |
| 入站 expectedSeq 收口先于一切 ns 效应 | 解码准入（序列检查先于 payload）→ 失败 `SEQUENCE_VIOLATION` fatal 1002，零 authorize/零 OPEN_OK | C2a/C2b + 探针 P6 | HEAD：`onMessage` 单点（C2 绿） | P6：gap 序 → `ERROR:SEQUENCE_VIOLATION:conn` + close(1002,'protocol-error') + `connection-failed:SEQUENCE_VIOLATION`；calls/sinkOpens/sinkDeliveries 全空 | ✅ |
| authorize 经注入 host 接口、恰一次、入参逐值 | `HubChannelHost.authorize` 24 成员注入面形状不变；re-OPEN 合流零重复 authorize | C2c/C2d + 探针 P1/P2/P3/P8 + M1 再 OPEN 臂 | HEAD：恰一次（C2c/C2d 绿） | 每场景 calls==[(peer-alpha, ns)] 恰一次；P2 迟归 ok 后仍恰一次（拉取面不触达真实授权器）；M1 再 OPEN 臂 deny → 2 waiter 2 帧 | ✅ |
| 通道实现零改动 | `hub-namespace.ts` 零 diff；注入面由 session 组装 | `git diff --stat HEAD -- …/hub-namespace.ts`（本会话复跑） | HEAD blob | 空 diff（内容逐字节相同；SA4 O3 的 mtime 观察不构成内容差） | ✅ |
| 公共 API / 配置冻结 | index 11 + /testing 5 导出；DEFAULT_* 三常量 | C5a/C5b（17/17 内） | HEAD 冻结面 | 同绿；两工厂/缝类型仅模块级导出（C0c 断言绿） | ✅ |
| 连接状态迁移面（L1） | `setConnState` 带事件四路；`beginReauth` draining 与 `onLivenessLost` closed 两处**无事件直赋**保留 | M3a/M3b + 探针 P4 | HEAD 基线（SA3 stash 采集 25/25） | M3a/M3b 绿；P4：beginReauth 后 connection-state-changed 仍仅 [handshaking->ready]，deadline 路径恰补 draining->closed | ✅ |
| 观测事件面 | 36 型 append-only、零新增 | 包全量 observer/fault 套件 + M3 + 契约 | HEAD | 569/569 绿；探针各场景事件描述子与 HEAD 形态一致（namespace-error/channel-state-changed/namespace-failed/connection-failed/resync-required） | ✅ |
| GOAWAY drain 语义（协议 §6.3/§21） | drain 门先于路由；提前完成仅经 settled 信号；deadline 不检查通道 | M2 + 探针 P4 + RT-F1（真实 TCP） | HEAD | M2 绿（pending 阻塞 → 结算后提前 1001）；P4：deadline 在 admission 永不结算时照常收口 | ✅ |
| peer 侧零改动 | `peer-connection.ts`/`peer-namespace.ts` 零 diff；message 形态原签名 | git diff + 包套件 peer 族 | HEAD | 空 diff；peer 全量绿 | ✅ |

## 5. State Machine Verification

| Initial state | Trigger | Expected transitions | Observed transitions | Forbidden transitions absent | Verdict |
| --- | --- | --- | --- | --- | --- |
| handshaking | HELLO（身份/版本/capability 通过） | → ready；HELLO_ACK；liveness 武装；hello timer 清 | P1：ready + HELLO_ACK(stamped=1)；issue170 real-transport：ping/pong 生效 | 非 HELLO 帧即 fatal（auth-lifecycle 族绿） | ✅ |
| ready | 首 OPEN（authorize 在途） | 通道同步建立 `'opening'`；零 wire 副作用 | P1/P2/P4/P5/P8：post-open state=opening，wire 仅 HELLO_ACK | OPEN_OK 先于 authorize 结算（未出现：resolve 前 wire 恒仅 HELLO_ACK）；第二通道实例（channels 唯一写入点） | ✅ |
| opening | resolve ok | → bootstrapping（mode 0）/ reconciling（mode 1）；OPEN_OK + 快照 | P1：OPEN_OK/BOOTSTRAP_SNAPSHOT 出站、state 离开 opening（bootstrapping/live 族） | deny 后继续流转（未出现） | ✅ |
| opening | resolve deny / throw | → failed（open-failed）；N waiter N 帧；settled 恰一次 | P3/M1-0/C0b：ERROR:NAMESPACE_UNAUTHORIZED + 3 事件 + settledSignals==[ns] | registry.open 被调用（未出现：0 次） | ✅ |
| opening（窗口） | UPDATE/UPDATE_CHUNK/BOOTSTRAP_ACK | 到达点 → failed(protocol-violation) + ns ERROR | P2/M1 各臂逐帧逐事件一致 | 静默丢弃/延迟回放（未出现：效应先于 resolve） | ✅ |
| opening（窗口） | UPDATE_ACK | 到达点连接级 `ACK_STATE_VIOLATION` fatal 1002 | M1 臂：ERROR:ACK_STATE_VIOLATION:conn + ready->closed + connection-failed + 异步尾 closing->closed | 连接存活（未出现） | ✅ |
| opening（窗口） | CLOSE_NAMESPACE | → closing → closed；CLOSE_OK{acked=入站序}；此后续体静默 | M1 臂：CLOSE_OK:3 + 2 迁移 | 迟归 ok 再发 OPEN_OK（M1 合计序列不含） | ✅ |
| opening（窗口） | RESYNC_REQUIRED | → needs-resync（非终态）；ok 结算不被中止 → OPEN_OK → bootstrapping | M1 臂逐事件一致 | needs-resync 被当作终态（未出现） | ✅ |
| opening（窗口） | revoke | → failed(protocol-violation) + NAMESPACE_UNAUTHORIZED + settled；迟归 ok = D-H1 transient registry.open + lease 回收 | P8 + M1-revoke（registry.open 恰一次、lease-released 恰一次 remainingLeases=1、零新帧零新事件） | revoke 唤起会话资源（revoke 时点 0 调用）；迟归后新帧/新事件 | ✅ |
| opening（窗口） | 连接收口（close/fatal） | → closing → closed（quiesce 前缀 + 异步尾）；迟归 admission 照常结算 → isOpenAborted 吸收 / H1 lease 回收 | P5：closing→closed、120s 推进零复活、迟归 ok → admission settled + registry.open 1 + lease 释放 1、零新帧零新事件；issue171-red:194 同构 | 迟归续体复活连接/重开通道（未出现） | ✅ |
| opening（never-settling） | reauth drain | draining 直赋零事件；GOAWAY；settled 缺席 ⇒ 不提前收口；deadline 到点 close(1001) | P4：draining 无事件、sink.close 未提前、advanceBy(5000) → close(1001,'hub-reauth')、admission 仍 pending、收口后 120s 推进零复活 | deadline 被 pending 阻塞（未出现）；draining 发射 connection-state-changed（未出现） | ✅ |
| ready/draining | 重复触发（重复 close/重复 revoke/再 OPEN） | 幂等：sink.close 恰一次、terminate 对无通道/quiet no-op、再 OPEN 合流零 authorize | P4（sinkCloses==1）、P8（no-op resolve ×2）、M1 再 OPEN 臂 | 二次收口副作用/重复 authorize（未出现） | ✅ |
| ready | 入站 gap/repeat 序 | 连接 fatal（SEQUENCE_VIOLATION 1002），零 ns 副作用 | P6（gap）；C2b（repeat，契约绿） | 先投递后收口（未出现：零 authorize/零投递） | ✅ |
| ready | 未知 ns 域帧 | R-none 合成 ns ERROR + namespace-error{sent}；ERROR 无 nsId/未知 ns → 静默 | P7：ERROR:NAMESPACE_STATE_VIOLATION（带该 nsId）+ 事件；未知 ns ERROR 零帧零事件；零缝投递/零 authorize | 帧进入 session/误路由（未出现：sinkDeliveries 空） | ✅ |

## 6. Error and Cleanup Flow

| 场景 | 预期 | 实际观察 | 结果 |
| --- | --- | --- | --- |
| denied/throw admission | NAMESPACE_UNAUTHORIZED / INTERNAL_ERROR；被拒零资源；闩锁后静默 | P3/C0b/M1-0：分类与事件族逐点一致；registry.open 0 次 | ✅ |
| 台账缺失（不变量破坏） | `port.openAdmission` reject → shim → INTERNAL_ERROR 响亮 | C0b-fail-loud 臂绿（本会话 structure 9/9） | ✅ |
| 解码失败（序列/结构/超限） | 连接 fatal + wsCloseCodeFor 分类；零 ns 副作用 | P6 + C2a/C2b + ac7-faults 矩阵（12/12） | ✅ |
| 窗口期连接收口 | 通道随 sink.close 收口；迟归 admission 无条件传播；H1 lease 回收；无复活 | P5：admission settled 发生在 onConnectionDropped **之后**（trace 次序）且零副作用泄漏；lease 配对（1 开 1 放） | ✅ |
| drain deadline（pending 阻塞面） | deadline 不等通道；close(1001) | P4：admission 永不结算下 deadline 照常收口 | ✅ |
| 收口后 quiescence | 句柄全清、零 timer 复活、零新帧零新事件 | P4/P5：advanceBy(120_000) 后 frames/events 计数不变；sink.close 恰一次；RT-F1（真实 TCP）lease-released 恰一次 + watchdog 零空转 | ✅ |
| 错误不伪成功 | 每条失败路径产出对应 wire/事件/资源回收 | 全部断言通过；无吞错 fallback 面（台账缺失/可选成员缺失均响亮） | ✅ |
| 类型违约授权器（undefined 结算） | （SA4 O1 登记）fulfillment TypeError → admission 永不结算 → 通道 'opening' 停放、零 wire 零事件、进程级 unhandledRejection；HEAD 同输入为 INTERNAL_ERROR | 探针 V2 动态复证：`TypeError: Cannot read properties of undefined (reading 'ok')` @ `hub-edge.ts:348`；channelState=opening、frames==[HELLO_ACK]、零 namespace 事件、连接 ready；vitest 捕获 1 条 unhandled rejection | ⚠️ 与 SA4 O1 描述逐点一致（见 F-1，非本票阻断） |

## 7. Temporary Diagnostics

| 项 | 内容 | 处置 |
| --- | --- | --- |
| 添加项 | 2 个临时探针测试文件：`packages/ws-replication/test/zz-sa7-issue418-dataflow-probe.test.ts`（8 用例：P1~P8，真实两半组合 + 缝观测包装 + `[SA7-DATAFLOW]` 前缀 trace）与 `zz-sa7-issue418-authorizer-violation-probe.test.ts`（1 用例：V2）；**零生产码改动**（观测包装只在 sessionFactory 注入点包 port/sink，记录并原样转发） | 已删除 |
| 运行证据 | `artifacts/sa7-issue418-dataflow-probe.log`（8/8 绿，EXIT=0）、`artifacts/sa7-issue418-authorizer-violation-probe.log`（断言 1/1 绿；EXIT=1 仅因 vitest 将预期的 unhandled rejection 计为 error——即 F-1 的观察本体） | 保留为运行日志；**不入 artifactPaths**（临时诊断纪律） |
| 删除后复跑 | 聚焦 5 文件（matrix 25 + structure 9 + contract 17 + ac7-faults 12 + issue171-red 5）= **68/68 绿，EXIT=0**，与探针加入前结果一致（§8 命令 5） | 通过 |
| 残留检查 | `grep -rn "SA7-DATAFLOW" packages/ --include="*.ts"` = 0；`git diff HEAD | grep -c SA7-DATAFLOW` = 0；`git diff --stat HEAD` 与 SA7 会话前完全相同（仅 SA3 实现面三文件） | 通过 |

## 8. Dynamic Evidence Matrix

| Source | Requirement or risk | Driver | Expected | Actual | Evidence | Result | Suggested routing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Design（D5.1/D5.2/D5.3） | 异步 admission：到达点建通道 + 台账先写 + 恰一次 authorize + 拉取形态 | 探针 P1/P2（真实组合缝 trace） | authorize→openNamespace→pull 同步段；结局纯 JSON 过缝 | trace 次序逐点命中；calls/pulls 恰一次 | `artifacts/sa7-issue418-dataflow-probe.log` | ✅ | — |
| Design（D3） | 占位编码 sequence=0 + edge `[8..12]` 盖章；wire 逐字节不变 | 探针 P1（placeholder/stamped + 逐帧 re-encode hex 等价）+ C1/C3/C6 契约 | 占位 0 / wire 1..N / 字节等价 | 全过（含 Yjs 载荷帧） | 同上 + 契约 17/17 | ✅ | — |
| Design（D4b） | 三案路由：R-delivered 即时投递 / R-none 合成 / ERROR 特例静默；路由读台账不读投影 | 探针 P2/P7 + C4a/C4b + C0d | 投递仅命中台账 ns；未知 ns 零缝投递 | sinkDeliveries 仅含已开 ns；P7 零投递零 authorize | 同上 | ✅ | — |
| Design（D5.4）/SA4 V4 | never-settling × drain deadline：deadline 不被 pending 阻塞 | 探针 P4 | close(1001) 到点收口 | 到点收口；admission 仍 pending；收口后零复活 | 同上 | ✅ | — |
| Design（D5.5） | revoke 无条件 terminate；无通道/quiet no-op | 探针 P8 + M1-revoke | 响亮终结 + D-H1 迟归回收 | 逐点一致（registry.open 1 + lease 1） | 同上 + matrix 25/25 | ✅ | — |
| Design（D5.6/D5.7/H1） | 窗口收口 + 迟归结算传播 + lease 回收 | 探针 P5 + issue171-red | settled 在 dropped 后仍传播；零新帧零新事件 | trace 次序 + 资源配对验证 | 同上 + issue171-red 5/5 | ✅ | — |
| SA4（§11 V1） | cleanupAll 内 session 异步尾启动点前移是否产生可观察漂移 | 探针 P5 + M1 ACK 臂 + RT-F1/issue171-real-transport（真实 timer） | 事件序与 HEAD 一致、句柄全清 | P5 事件序 [ready->closed, opening->closing, closing->closed]；quiescence 120s 零漂移；real-transport 族绿 | 探针日志 + `artifacts/sa7-issue418-package-suite.log` | ✅（SA4 静态等价论证获动态佐证） | — |
| SA4（§11 V2/§12-O1） | 类型违约授权器（结算 undefined/null）角落 | 探针 V2 | （登记面）admission 永不结算 + 'opening' 停放 + unhandledRejection；≠ HEAD 的 INTERNAL_ERROR | 与 SA4 O1 描述逐点一致（TypeError@hub-edge.ts:348） | `artifacts/sa7-issue418-authorizer-violation-probe.log` | ⚠️ 复证成立（F-1） | implementation（后续小改，SA4 已路由；非本票阻断） |
| SA4（§11 V3） | 真实传输动态无漂移 | 既有 real-transport 套件（本会话新跑） | 序列/收口/重连行为不漂移 | sa7-r1/r2、issue170/171/243/287 real-transport、issue175 D1（真实 TCP GOAWAY/reauth）、issue137/169 背压全绿 | `artifacts/sa7-issue418-package-suite.log` | ✅（CI 分片观察不在 SA7 职责内） | — |
| SA4（§11 V4） | never-settling × deadline 交叉 | 探针 P4 | deadline close(1001) 不被 pending 阻塞 | 成立 | 探针日志 | ✅ | — |
| SA6（C1~C6/C0） | 契约全绿（两态等价） | 本会话新跑契约 + structure | 17+9 绿 | 26/26 绿 | `artifacts/sa7-issue418-post-removal-focused.log` | ✅ | — |
| SA6（I13 两锚） | ac7-faults:53 到达点 ERROR / issue171-red:183+:194 | 本会话新跑 | 12/12、5/5 绿 | 绿 | 同上 | ✅ | — |
| Design（§12 AC4 门） | 包全量不改而绿 | 本会话新跑包全量 | 75 文件 569 用例 EXIT=0 | 75/75、569/569、45.36s、EXIT=0 | `artifacts/sa7-issue418-package-suite.log` | ✅ | — |

## 9. Commands and Evidence

```text
# 环境
node -v                     # v24.13.0
pnpm -v                     # 10.28.2
git rev-parse HEAD          # 27e012b6606e48797842a79e11e3505819c34cc6（分支 mabf/issue-418）

# 1) 聚焦：M1/M2/M3 窗口矩阵（设计 §12 必做）
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run \
  packages/ws-replication/test/ws-replication-issue418-pending-window-matrix.test.ts \
  --typecheck.enabled=false --passWithNoTests=false
#   Tests 25 passed (25)  EXIT=0

# 2) 聚焦：C0a~C0d 结构白盒 + SA6 契约 C1~C6
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run \
  packages/ws-replication/test/ws-replication-issue418-edge-session-split-structure.test.ts \
  packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts \
  --typecheck.enabled=false --passWithNoTests=false
#   Tests 26 passed (26)  EXIT=0

# 3) 聚焦：I13 两锚
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run \
  packages/ws-replication/test/ws-replication-ac7-faults.test.ts \
  packages/ws-replication/test/ws-replication-issue171-red.test.ts \
  --typecheck.enabled=false --passWithNoTests=false
#   Tests 17 passed (17)  EXIT=0

# 4) SA7 探针（真实两半组合 + 缝观测包装；临时，已删除）
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run \
  packages/ws-replication/test/zz-sa7-issue418-dataflow-probe.test.ts \
  --typecheck.enabled=false --passWithNoTests=false
#   Tests 8 passed (8)  EXIT=0   → artifacts/sa7-issue418-dataflow-probe.log
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run \
  packages/ws-replication/test/zz-sa7-issue418-authorizer-violation-probe.test.ts \
  --typecheck.enabled=false --passWithNoTests=false
#   Tests 1 passed (1) + 1 unhandled error（F-1 观察本体）→ artifacts/sa7-issue418-authorizer-violation-probe.log

# 5) 探针删除后复跑（结果不变性）+ 包全量（AC4 门）+ typecheck
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run \
  packages/ws-replication/test/ws-replication-issue418-pending-window-matrix.test.ts \
  packages/ws-replication/test/ws-replication-issue418-edge-session-split-structure.test.ts \
  packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts \
  packages/ws-replication/test/ws-replication-ac7-faults.test.ts \
  packages/ws-replication/test/ws-replication-issue171-red.test.ts \
  --typecheck.enabled=false --passWithNoTests=false
#   Tests 68 passed (68)  EXIT=0   → artifacts/sa7-issue418-post-removal-focused.log
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/ws-replication \
  --typecheck.enabled=false --passWithNoTests=false
#   Test Files 75 passed (75) / Tests 569 passed (569) / EXIT=0
#   → artifacts/sa7-issue418-package-suite.log（含真实 TCP real-transport/liveness/backpressure/GOAWAY 族）
pnpm exec tsc -p packages/ws-replication/tsconfig.json        # EXIT=0（探针删除后复核）

# 6) 冻结面 / 残留检查
git diff --stat HEAD            # 仅 backpressure.ts(+54) / frame-io.ts(+57/-13) / hub-connection.ts(改写)——SA3 实现面
git diff HEAD | grep -c "SA7-DATAFLOW"                          # 0
git diff --name-only HEAD -- packages/ws-replication/test       # 0（既有测试零修改）
# hub-namespace.ts / index / testing / types / defaults / validate / plugin / peer-* /
# replication-protocol/src / docs / CONTEXT.md / apps / 根配置：全部零 diff
```

根 `pnpm typecheck` / 根 `pnpm test` 门（AC5）：SA7 未重复执行全仓回归（非 SA7 职责）；引用 SA3 §6 / SA6 §13 已采证据（包/protocol/根 typecheck 三 EXIT=0；根 439/439 文件、5299/5299 用例、`Type Errors: no errors`）。SA7 会话内包 typecheck 复核 EXIT=0。

## 10. Deviations

| # | 事项 | 说明 |
| --- | --- | --- |
| F-1 | **类型违约授权器角落（= SA4 §12-O1，动态复证，非新发现、非阻断）** | 授权器结算 `undefined`（违反 `Promise<NamespaceAuthorization>` 契约）时：`hub-edge.ts:348` fulfillment 回调抛 `TypeError`（读 `.ok`）→ admission 永不结算 → 通道 `'opening'` 停放、零 wire、零事件、连接不受影响、进程级 unhandledRejection——与 SA4 O1 的静态描述逐点一致；HEAD 同输入得 `INTERNAL_ERROR` + failed（`startOpen` catch）。仅类型违约宿主可达、无既有测试面；SA4 已裁定 MINOR 非阻断并路由 implementation 后续小改（fulfillment 回调 try/catch 兜底 `throw` 结局 + 注释修正）。SA7 记录动态证据，维持该路由建议；不影响本票 verdict（实现与批准设计一致——设计的 throw 结局覆盖「授权器抛出」，未声明覆盖违约返回值语义）。 |
| D-2 | R4'（非暂停控制帧「耗尽 ∧ 编码必败」双不可达角落）未动态触发 | 设计 A5/SA8 R9'(iii) 明文「登记不伪造测试」；`lastSeq ≥ 0xffffffff` 与 codec 字段上限违例需同时成立，实践不可达。维持登记，不新增伪测试。 |
| D-3 | R6'（authorize 结算续体微任务跳数 1→约 3）未做逐跳计时 | 无 wall-clock 依赖面；探针 P2 以两次 `settle()` 泵过续体，事件/帧序与 HEAD 基线一致（M1 合计序列双断言绿）——跳数差不可观察的既有论证获运行时佐证。 |
| D-4 | CI 分片与真实 TCP 长跑不在 SA7 执行面 | SA7 不等待 PR CI、不读远端 CI 日志；真实传输动态以包内 real-transport 套件（真实 TCP + 真实 timer）本会话新跑全绿为证据；CI 观察归 Controller/后续门。 |

## 11. Verdict

**`approve`**。

1. **改变的数据流按设计变化**（§3 路线 1~8 全 ✅）：到达点建通道 + 零缓冲投递（P2 trace：窗口帧效应先于 admission 结算）、异步 edge-owned admission 拉取（P1 trace：authorize→openNamespace→pull 同步段锁步、结局纯 JSON 过缝、恰一次真实调用）、占位编码 + mux 盖章（P1：placeholder 0 ↔ stamped 2/3、单计数器跨连接级/ns 帧、逐帧 re-encode hex 等价）、三案路由读台账（P7：未知 ns 零缝投递）。
2. **声明不变的数据流保持不变**（§4 全 ✅）：wire 金标/字节等价、序列单点、入站收口先于效应、authorize 注入面恰一次、`hub-namespace.ts` 零 diff、公共 API/配置冻结、L1 两处直赋、观测面、drain/peer 语义。
3. **状态机转换与关键值正确、禁止转换未出现**（§5 全 ✅）：连接 FSM（含 draining/closed 直赋零事件、五路收口同构、幂等）、通道 FSM（opening 全矩阵行、settled 至多一次、re-OPEN 合流）、竞态三态（窗口 revoke/收口/迟归结算）全部与 HEAD 基线逐点一致；无 OPEN_OK 先行、无二次 authorize、无占位 0 上线、无连接级帧上缝、无 deadline 被 pending 阻塞、无收口复活。
4. **错误与 cleanup 符合设计并到达 quiescence**（§6 ✅）：失败分类/事件族/资源配对（registry.open ↔ lease-released）逐点正确；窗口收口后 120s scheduler 推进零新帧零新事件；sink.close 恰一次。
5. **临时诊断已清理**（§7）：两探针文件已删、聚焦面复跑 68/68 与前一致、`[SA7-DATAFLOW]` 零残留、生产码零触碰。
6. F-1 为 SA4 已登记 MINOR 角落的动态复证（路由已定，非本票阻断）；D-2~D-4 为登记面/职责边界如实陈述。

## 附：artifactPaths（worktree-relative）

- `wiki/raw/task_issue-418_sa7_report.md`（本报告）
- `artifacts/sa7-issue418-package-suite.log`（包全量 75/75 文件、569/569 用例，EXIT=0；含 real-transport/liveness/backpressure/GOAWAY 族逐文件行）
- `artifacts/sa7-issue418-post-removal-focused.log`（探针删除后聚焦复跑 68/68，EXIT=0）
