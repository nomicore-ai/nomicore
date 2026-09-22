# SA2 设计攻击评审 — issue #423（spec #415 T6）：observer 发射点拆分与降级口径

- 评审对象：`wiki/raw/task_issue-423_design.md`（iteration 0 首版设计）
- 基线 HEAD：`1f5809b001c984e63fac3bafd4c1f3febc76e8a8`（本次评审实测 `git log -1` 一致）
- 评审人：SA2（独立攻击视角；未修改设计/生产代码/测试，未运行测试或服务）

---

## 1. Reviewed inputs

| 输入 | 状态 | 核验方式 |
|---|---|---|
| `wiki/raw/task_issue-423.md`（任务简报） | 在场 | 全文读取；6 条 AC + What-to-build 逐条对照 |
| `wiki/raw/task_issue-423_sa6_contract.md`（SA6 契约，verdict=approve） | 在场 | 全文读取；§5/§8/§9/§12.4/§15 与设计承接逐条对照 |
| `packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts`（红灯契约，21 用例） | 在场 | 读取关键用例（EM-C1a–e/C2a–c/C3a–d/C4a–c/C6/C7）与 `SECTION_23_FIELDS`、`makeStubPort`、金标常量 |
| `artifacts/sa6-issue423-contract-evidence.log` | 在场 | 头部 + S0 稳定性轮核对（3 failed 集合 `{EM-C2a, EM-C4a, EM-C4b}`） |
| `task_issue-423_relevant_decisions.md` / `_conflict_report.md` / 既有 `_sa2_review.md` | **不存在**（iteration 0，`ls wiki/raw` 核对） | 与设计 §头部声明一致；以 ADR 0032 + 协议 §23 替代约束面 |
| 源码锚点核验 | —— | 设计 §2/§D1–D6 引用的 ~35 处行号/符号逐一对着 HEAD 源码复核（详见 §6） |
| 规范文档 | —— | ADR 0032（决策 2/4/5、否决备选、后果节）、协议 §17(:581)/§22/§23.1/§23.3/§23.4 逐节定位 |

## 2. Verdict

**approve** —— 无 BLOCKER、无 MAJOR finding。设计的全部关键事实主张经源码独立复核成立；
缺口 A/B 的机制满足 SA6 §12.4-2 的六项期望（恰一/sequence/bytes/namespaceId/listen sendQueueMs
保留/宿主直驱缺面），两处红灯的实现路径已被 SA6 mutation（M1、E2）证明可达绿；回归面（精确
`sendQueueMs`/`ackLatencyMs` 值断言、键集白名单、拆分前金标）的保持论证经逐栈核对成立。5 条
不阻断观察项见 §14。`pass` 仅指设计层面可安全进入实现；实现与活链路仍由 SA4/SA7 验证。

## 3. 需求覆盖

| Requirement | Design section | Assessment |
|---|---|---|
| What-to-build：edge 发连接域事件（8 型） | 非目标（既有面，EM-C1a 绿锚） | 正确——现状已由 edge 发射（`hub-edge.ts` setConnState/liveness 等实测事件集佐证），本票零改动是事实而非遗漏 |
| What-to-build：依赖盖章后 sequence 的出站事件（update-sent 族）归 edge | §D2（发射点）、§D3（sendQueueMs 承载）、§D4（session 抑制） | 覆盖；发射点 = `makePort().sendDataFrame` 包装（单漏斗实测三调用方：`hub-session.ts:213/253`、`hub-edge-host.ts:688`），恰一性结构性成立 |
| What-to-build：授权拒绝事件 edge 复现 + `connectionId` 在场 | §D1（三发射点 `cidField` 投影） | 覆盖；`hub-edge-host.ts:605/618/634` 实测为仅有的三处缺 `connectionId` 发射点（grep 全文仅 4 处 emitObserver，含 :23 注释） |
| What-to-build：session 发 namespace 域事件（update-acked 留 session） | §D4.1（只抑制非 chunked `update-sent`） | 覆盖；`update-acked`/`chunked-update-sent`/bootstrap/sync 族零触碰（源码 grep：`type: 'update-sent'` 仅 `hub-namespace.ts:1397`、`peer-namespace.ts:1571` 两处，抑制面完备） |
| What-to-build：字段集 append-only 不变 | §1 非目标、§6 末行、DENY `types.ts` | 覆盖；零事件型/字段编辑，edge 构造体键集 ⊆ `types.ts:514-528` 既有形状 |
| What-to-build：缺面 dormant 纪律平移（bufferedAmount/ping/onPong） | §1 非目标（EM-C3 全绿保持） | 正确——SA6 §12.1 AC2 行实测「已平移、保持绿」，设计按回归面处置有据 |
| What-to-build：`maxConcurrentAssembliesPerConnection` 分片口径文档化 | §D5（协议 §17 + ADR 后果节）；运行时零改动 | 覆盖 AC5 文档面；分片运行时锚依 SA6 U4 留待 T3/T5（#420/#422 仍 open，登记为 follow-up 而非本票必要项——与简报 AC5 只要求「写入文档 + listen 回归锚」一致） |
| AC1 每型发射侧测试锚定 + 字段集逐字一致 | §D2/D4 + 契约 EM-C1a–e/EM-C4（既有） | 覆盖；36 型全覆盖边界由 SA6 U3 登记（稀有故障族由既有逐型套件承载），设计不弱化 |
| AC2 缺面降级 conformance | 零改动 + EM-C3a–d 回归 | 覆盖；宿主直驱帧 `sendQueueMs` 整键缺席由 §D3.3 承载 |
| AC3 拒绝路径 edge 发射且字段正确 | §D1 | 覆盖（EM-C2a 红灯本体） |
| AC4 throw 隔离两侧成立 | DENY `observer.ts`；§D2.2 单点消费 | 覆盖；`dispatchReplicationObserver`（`observer.ts:36-46`）零改动，新发射点经同一单点 |
| AC5 分片口径写入文档 + listen 计数回归锚 | §D5 + EM-C6a/b（零运行时改动） | 覆盖 |
| AC6 单体序列与拆分前逐字一致 | §D2.5（次序）+ §D3.4（键集）+ EM-C7 金标 | 覆盖；论证经本次独立复核成立（见 §7/§12） |
| 目标/非目标无静默扩大 | §1 | peer 不拆分、族不全迁、T3/T5 运行时面显式排除——均有 ADR 0032:44 / SA6 U1/U4 依据，非遗漏 |

## 4. Owner评论覆盖

| Comment ID | Updated at | Design section | Assessment |
|---|---|---|---|
| ——（无评论） | —— | 无 | 简报明文「No owner requirements apply: REST comment read returned []」；SA6 §2 以 `gh issue view 423 --json comments` 复核 = 0。两源一致，无 owner 追加面 |

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| SA8 产物不存在（iteration 0） | 设计 §6 以 ADR 0032 + 协议 §23 替代承接，并自行登记「需要设计后冲突复查」（§15） | 纪律正确；本评审对替代约束面逐条独立复核（下三行），未发现设计与 ADR/协议相抵 |
| ADR 0032 决策 5「发射点 = 拥有事实的一侧；出站 sequence 事件在 edge；字段集 append-only」 | §D2/§D4 实现（现状代码偏离 ADR，本票对齐） | ADR 原文（决策 5 节）核对一致；「update-sent 族」作用域限定的读法见下 U1 行 |
| ADR 0032 决策 2「缝只过帧 + 纯 JSON」 | §D3 记账投影 = 纯 JSON 可选参数 `{sendQueueMs?}`（有限数值差值） | 合规；零新控制信号、零帧形态变化；差值（非绝对时间戳）经缝传递与 §23.3「绝对时间戳不入事件」同源，且规避分片形态跨时钟域减法——论证成立 |
| ADR 0032 决策 4「定偏移只读提取 + 布局同步维护契约 + 结构守卫测试」 | §D2.3 沿用同纪律 + 新守卫测试（ALLOW LIST） | 合规且为扩展适用：`routingKeyOf`（`hub-edge.ts:558-567`）先例同窗口 `[21,56)`/前缀 `[20]`；namespaceId 文法固定 35 字节（`constants.ts:32` `^ns-[0-9a-f]{32}$`）使定偏移判定协议性可靠，非实现巧合 |
| 协议 §23.3 connectionId 在场纪律 / §23.4 隔离与 clock 缺面 | §D1（`cidField` 单点复用）、§D2.2（observer 门前置）、§D3.2（clock 域链路原样） | 与 `observer.ts:113-117`、§23.1 optional 拆分（契约 `SECTION_23_FIELDS` `update-sent` 行）一致 |
| SA6 §8.2 U2「sendQueueMs send 后才算得出 ⇒ 缝承载机制留设计裁决」 | §D3：采样点前移至发送调用边界 + 缝可选参数携带差值 | 裁决成立：发送栈（`sendAndRegister`→`host.sendData`→`port.sendDataFrame`→`tryEmitDataFrame`→`emitOne`→`transport.send`）实测零时钟读（`observe()` 只读 bufferedAmount），手动时钟域逐值恒等——`issue238-segmented-observation:161/245` 的 `[0,0,0,0,0]`/`[0,4_000]` 与 `issue238-repro:172` 的 `ackLatencyMs [5_000..1_000]` 精确断言的保持论证经逐栈核对成立 |
| SA6 §15 U1「update-sent 族作用域留 SA2/SA8 裁决」 | §D4.2 四点独立论证（键集事实/事实归属/简报对照/契约兼容） | **SA2 采纳该裁决**：family 内唯一携 `sequence` 键者 = `update-sent`（§23.1 表 + `chunked-update-sent` DD1 键集冻结「无 sequence/sendQueueMs」实测一致）；简报限定语「依赖盖章后 sequence 的」在词表上只能命中 `update-sent`；契约 :855-856 已把 `chunked-update-sent` 排除在 EM-C4b 断言面外——裁决与验收契约无张力。SA8 半边的确认并入冲突复查（§15） |
| SA6 §9 E2「朴素搬运被 EM-C4c/C7a 拦（sendQueueMs 丢失/金标键集变化）」 | §D3 机制即消解该红灯 | 一致；金标行 `update-sent|bytes,connectionId,namespaceId,sendQueueMs,sequence,side,type`（契约 :1110）要求 listen 形态键齐——D3.4 构造体恰好产出该键集 |
| SA6 §13 S0/S2 三红稳定 + AC6 基线绿 | §5 承接表 | 一致；证据日志实测核对（3 failed 集合稳定） |

## 6. 设计内部一致性

对设计 §2 全部代码锚点做了独立复核（抽样清单）：`hub-edge-host.ts:597-635`（三发射点无
connectionId）、`:684-693`（egress 门序）、`:775-790`（pre-connection 无 cid，§23.3 文档形态）、
`:900-909`（connectionKey 单一键系统）；`hub-edge.ts:217/242/246-249/441/553-567/570-586`；
`hub-split.ts:54-99`（缝现状无 accounting）；`hub-session.ts:62/78/210-216/220-254`；
`hub-namespace.ts:65/251/483-503/1324-1337/1370-1405/1696-1706/1820`；
`update-channel.ts:26/169-191/319-371/419/449-499`；`peer-namespace.ts:294/304/1492/1549-1579`；
`peer-connection.ts:798-841`（hub 零调用 `tryEmitData` 实测成立）；`frame-io.ts:184-197`（盖章单点
`[8..12]`）；`envelope.ts:172-186` + `messages.ts:45-67` + `payloads.ts:617-636`（布局/码值/字段序：
`[5]`=型、`[8..12]`=序、`[12..16]`=载荷长、payload=`varString(nsId)`+`varUint8Array(update)`）。
**全部锚点与 HEAD 源码一致，未发现死引用、旧 API 或前后相反描述**；D2.1 第 4 步的长度交叉校验
公式（`payloadLength === 1 + 35 + varUintByteCount + updateLen`）与 codec 字段序推导逐项吻合。
正文与 ALLOW/DENY/验收映射无矛盾；§14 评审修订映射为如实空占位（本文件是首份评审输入）。

## 7. 状态机与并发攻击

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| SM-1 | live 通道，队列有项 | drain `pullAndSendOne` → UPDATE 帧出站 | 恰一 `update-sent`，`sequence` = 盖章序 | 无——单漏斗（`port.sendDataFrame` 唯一 data 出口，三调用方实测）+ 型门（0x40）+ `seq>0` 门 + session 抑制四重结构性保证 | 无 |
| SM-2 | activeTransfer 在场 | `sendOneChunk` 出 UPDATE_CHUNK（0x42） | 零 `update-sent`；末 chunk 由 session 发 `chunked-update-sent` | 无——型门排除 + D4.1 保留 chunked 分支（`update-channel.ts:489-493` chunked 标记链路不动） | 无 |
| SM-3 | 会话建立（工厂形态） | 宿主 `egress.sendDataFrame` 直驱 UPDATE 占位帧 | 恰一 `update-sent`、`sendQueueMs` 整键缺席 | 无——D3.3 公共签名零变化、不传 accounting（EM-C4a 期望形状） | 无 |
| SM-4 | 出站 admission 拒绝（`seq≤0`） | 背压/闸门/编码异常折叠 | 零事件 + 既有 F4/`send-frame-rejected` 分支原样 | 无——包装点只在 `seq>0` 后判定；`OutboundExhaustedError` 传播路径不变（`hub-namespace.sendUpdateFrame` catch→0 实测在位） | 无 |
| SM-5 | observer 全抛 | 任一 `update-sent`/拒绝事件分发 | throw 静默隔离，wire/状态零影响 | 无——新发射点经 `dispatchReplicationObserver` 单点（EM-C5a 双跑锚定） | 无 |
| SM-6 | 同步栈内新旧发射点之间 | 事件次序（AC6） | 组合观测面序列逐字不变 | 无——两点间既有动作仅 `inFlight.set`/`armAckTimer`/`observe()`，实测均零 observer 事件（`tryEmitDataFrame` 只调 `observe()`，不调 `observeWater()`——无 send-paused/resumed 边沿） | 无 |
| SM-7 | 跨连接/重启 | 无新共享状态 | 无漂移面 | 无——accounting 为调用栈瞬态值，零存活（§9）；`HubSendAccounting` 纯类型 | 无 |

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| ER-1 | 到达 `port.sendDataFrame` 的 UPDATE 帧布局交叉校验不过（宿主绕过 codec 自构字节） | D6：跳过发射（dormant）+ 注释标记结构不可达，不 `connectionFatal` | 低——帧已上 wire，观测面无从补救；§23.4 钉死观测失败绝不改变协议结果；与入站路由的 fail-loud（MALFORMED_FRAME）不对称但有充分理由（入站在投递前可拒，出站判定在发送后）且设计已显式论证 | 无（阻断级无）；建议守卫测试补短帧/截断用例（§14 O5） |
| ER-2 | session 产帧路径校验失败可达性 | `encodePlaceholder`/`encodeMessage` 对畸形输入先于出站响亮 throw（`payloads.ts`/`envelope.ts` 实测），结构性不可达 | 低——守卫测试（ALLOW）锚定 codec 对齐，漂移即红 | 无 |
| ER-3 | 发送被拒（seq≤0）时 accounting 已构造 | 记账随帧弃置，零事件 | 低——瞬态对象，无泄漏面 | 无 |
| ER-4 | clock throw / clock 缺省 / observer 缺省 | `safeNow` 折叠 + `port.now` observer 门（`hub-edge.ts:246-249` 实测）⇒ 无 `sendQueueMs` ⇒ 键缺席；无 observer ⇒ 判定整体不执行 | 低——与 §23.4 既有纪律同构，EM-C3c/C4c 两态锚定 | 无 |
| ER-5 | 部分完成伪成功 | 不存在——事件只在帧实际出站且序已分配后发射（「决策已落定后发射」），无提前/事后伪成功面 | 低 | 无 |
| ER-6 | 回滚 | 6 src + 1 test + 2 docs 单提交整体回退；无迁移/wire 代际/配置键 | 低 | 无 |

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| `HubSessionEdgePort.sendDataFrame` 追加可选参 | 无——结构化类型兼容：契约 `makeStubPort:414-418` 单参桩、#418/#421 桩少参可赋值；内部缝不经 `src/index.ts`/`testing.ts`（grep 零导出；`issue418-structure:619` `Object.keys(splitModule)===[]` 只钉运行时值，type-only 导出 `HubSendAccounting` 不破） | 实测源码 + 测试 | 无 |
| `HubReplicationEdgeEgress.sendDataFrame` 公共签名 | 无——设计保持零变化（D3.3）；`issue421-edge-factory-api.test-d.ts:316` 钉死 `[frame: Uint8Array]` 参数表，不受内部缝变化影响 | 实测 test-d | 无 |
| `UpdateChannelHost.sendUpdateFrame` / `HubChannelHost.sendData` 追加可选参 | 弱点（非缺失）：两处**绑定箭头**（`hub-session.ts:62` channelHost `sendData`、`hub-namespace.ts` ~:251 facet `sendUpdateFrame`）改为透传后类型检查**不会强制**（少参箭头恒可赋值）——漏改时静默丢 accounting，仅靠红灯契约 EM-C4c/C7a 兜底 | TS 结构化赋值规则 + 源码 :62/:251 | 无阻断；建议 D3.1 线程表显式点名两处绑定（§14 O2） |
| peer 侧（`peer-namespace.ts:294/1549-1579`） | 无——peer 少参实现兼容；peer `update-sent{side:'peer'}` 照旧经 `noteUpdateSent` 发射（UpdateChannel 双侧对称保留） | 实测源码 | 无 |
| 既有断言面（`observer-red:477-497/1236`、`issue238-segmented:161/245`、`issue238-repro:172`、`issue230`） | 无——键集 ⊆ 白名单；精确值断言由「发送栈零时钟读 ⇒ 手动时钟域逐值恒等」覆盖（逐栈核对：`observe()` 只读 bufferedAmount；`measureFrame` 探针编码无时钟） | 实测测试 + 源码 | 无 |
| #418/#421 拒绝事件断言面 | 无——grep 全仓 `Object.keys(...).sort()).toEqual` 零命中 deny 两事件精确键集（唯一事件级钉死 = 契约 EM-C2c auth-upgrade-rejected，pre-connection 面，设计不动） | grep 实测 | 无 |
| EM-C1d 负控禁列 | 无——禁列（:634-642）不含 `update-sent`，实现后 edge 新增发射不触红（该用例自身驱动 egress 数据帧，事件集变化在预期内） | 契约实测 | 无 |
| 外部消费者（apps/、其他包） | 无——`UpdateChannelHost`/`HubChannelHost`/`HubSessionEdgePort` 在 ws-replication src/test 之外零引用（grep 实测） | grep 实测 | 无 |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| `update-sent` 发射（盖章事实） | edge（ADR 决策 5） | §D2 `hub-edge.ts` port 包装 | 正确——`[8..12]` 盖章单点在 edge mux（`frame-io.ts:192`），发射随事实 |
| `sendQueueMs` 计算（session 时钟域记账事实） | session（§23.1/§23.4「发送方进程内精确」） | §D3.2 `update-channel.ts` 采样 + 缝投影 | 正确——差值在事实侧计算，经纯 JSON 过缝；edge 只消费不重算（不混时钟域） |
| `bytes`/`namespaceId` 判定 | edge 帧字节（防投影说谎） | §D2.3 定偏移判定 | 正确——与 `routingKeyOf` 同源纪律，单一代码路径同服务 session 帧与宿主直驱帧 |
| 拒绝路径 `connectionId` 在场 | edge 端口（值所有者） | §D1 `cidField(port.connectionId())` | 正确——复用单点，不加构造态副本（备选否决成立：防第二事实源） |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| 定偏移帧字节判定 | `hub-edge.ts:558-567` `routingKeyOf`（ADR 决策 4，前缀/窗口/交叉校验） | `emitUpdateSentAtStamp` 型门 + id 窗口 + varUint 长度交叉校验 | 一致 | 同一布局契约的扩展适用；守卫测试延续 `issue421-route-key-parity` 先例（新文件按 issue-scoped 命名惯例，非平行机制） |
| 条件字段展开 | `observer.ts:113-117` `cidField` | D1/D2.4 消费同一单点 | 一致 | 零新展开逻辑 |
| observer 隔离分发 | `dispatchReplicationObserver`（`observer.ts:36-46`） | 新发射点经同一单点 | 一致 | DENY `observer.ts` 保证不fork |
| 盖章后事件的「恰一」语义 | `hub-namespace.ts:1370` 注释口径（seq>0 每帧恰一） | D2.2 同构平移到 port 出面 | 一致 | 门条件与计数不变量逐字继承 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| wire sequence | edge `OutboundQueue.lastSeq`（`[8..12]` 单点） | 事件 `sequence` = 盖章返回值 | 无——同点派生 |
| `connectionId` | edge `connectionIdValue`（HELLO 置位单点） | 事件条件成员经 `cidField`/port 投影 | 无——单链派生 |
| `bytes`/`namespaceId` | 帧字节 | 定偏移判定 | 低——守卫测试锚定 codec 对齐（漂移即红） |
| `sendQueueMs` | session 时钟域差值 | 缝投影（瞬态） | 无存活副本；类型拼写三处见 §14 O3（非事实源问题） |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| 无新生命周期构件（accounting = 调用栈瞬态；`HubSendAccounting` = 纯类型） | —— | 帧被拒 ⇒ 记账随帧弃置 | 对称性不适用且无新增不对称面；零 register/dispose/subscribe 新面 |

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 第二发射通道 | `dispatchReplicationObserver` 单点 | 复用 | 非平行 |
| 第二帧解析 | `decodeMessage`（O(payload)） | 定偏移 ≤5 字节 varUint + 头部读（O(1)） | 非平行——决策 4 明确豁免 payload 解析；整帧 decode 已被设计显式否决（D2.3） |
| 第二 cleanup/重试/状态机 | 无 | 无新增 | 非平行 |
| 第二布局守卫 | `issue421-route-key-parity`（id 窗口） | 新增 #423 守卫（varUint 长度/型门） | 非平行——判定面不同（bytes 判定是新耦合），文件按仓库 issue-scoped 惯例 |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW LIST 9 项 vs 正文触面 | §D1–D5 涉及的每个实现/测试/文档路径均在 ALLOW（6 src + 1 新测试 + 2 文档）；DENY 与正文无冲突（`observer.ts` 仅 import `cidField`、`frame-io.ts` 零改动、`replication-protocol/**` 仅 import 公共 `MESSAGE_TYPES`） | 无 |
| DENY `frame-io.ts` vs D2.1 引用 `readBe32` | `readBe32` 是 `envelope.ts` 模块私有函数（非导出，实测）；实现需在 `hub-edge.ts` 内做本地 BE32 读（`frame-io.ts` 的 `writeBe32At` 同款本地先例） | 无阻断；精度注记见 §14 O1 |
| `update-channel.ts` 不在 SA6 §10 影响面表 | SA6 U2 明文「机制留设计裁决、契约不预设」；D3.2 的采样点前移是该裁决的最小实现线程，属简报 What-to-build 的必要项而非范围扩张 | 无 |
| 契约文件/SA6 工件只读 | DENY 明列；§12.3 不可软化纪律继承 | 无 |
| follow-up（T3/T5 运行时锚、T7 夹具复用） | 均为 SA6 U4/既有票登记的后续票依赖，未掩盖本票必要项（AC5 文档面本票交付） | 无 |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC3/EM-C2a | 契约既有用例零改动；M1 已证单补 `connectionId` 即绿且无连带失败 | 无 | 无 |
| AC1/EM-C4a（工厂直驱恰一 + sequence/bytes/缺面） | 契约既有；`bytes` 断言 = `decoded.update.byteLength`，与 D2.1 varUint 判定产出同值（codec 字段序实测） | 无 | 无 |
| AC1/EM-C4b（session 零发射） | 契约既有（stub port 事件面）；抑制面 grep 完备（hub 侧唯一发射体 = `hub-namespace.ts:1397`） | 无 | 无 |
| AC1+AC6/EM-C4c + EM-C3c（listen 恰一 + 两态键） | 契约既有；四层透传任一断链即红（sendQueueMs 缺失/金标键集变化）——红灯即检测器 | 类型检查不强制两处绑定箭头（§9 第 3 行）——契约兜底在位 | 无阻断（O2） |
| AC6/EM-C7a/b（拆分前金标） | 契约既有；键集（D3.4）+ 次序（D2.5）论证经独立复核（SM-6） | 无 | 无 |
| 精确值回归（issue238 两文件 [0,4_000]/ackLatencyMs 阶梯） | 既有套件复跑；值恒等论证（发送栈零时钟读）经逐栈核对 | 无 | 无 |
| 新增耦合（定偏移 vs codec 字段序） | 新守卫测试（ALLOW）：跨 varUint 1/2/3 字节边界 + id 窗口 + 型门 | 未显式列短帧/截断 UPDATE 输入的「零 throw + 零事件」防御锚 | 无阻断（O5） |
| peer 零回归 / 包级门禁 / 根门禁 | §12 表（peer 套件、`vitest run packages/ws-replication`、根 typecheck/test 由 Host 执行） | 无（SA6 U6 同口径） | 无 |
| 测试观察行为而非源码文本 | 契约 + 守卫均为行为断言（事件形状/wire 字节/decoded 交叉）；SA2 核对契约无 skip/only/todo | 无 | 无 |

## 13. Required revisions

无 BLOCKER / MAJOR finding。（评审过程中攻击过的全部面——单漏斗恰一性、次序不变、值恒等、
类型兼容、公共签名冻结、金标键集、负控禁列、外部消费者——均在设计或既有契约中找到结构性
答案，见 §7–§12 各表。）

## 14. Non-blocking observations

| ID | 观察 | 建议 |
|---|---|---|
| O1 | D2.1 伪代码引用 `readBe32(frame,12)`，但 `readBe32` 是 `replication-protocol/src/envelope.ts` 的模块私有函数；`frame-io.ts`（`writeBe32At` 所在）在 DENY LIST | 实现时在 `hub-edge.ts` 内加本地 BE32 读（同 `frame-io.ts:201-206` 本地先例）；ALLOW 已覆盖，仅精度注记 |
| O2 | accounting 透传链上有两处**绑定箭头**（`hub-session.ts:62` channelHost `sendData` 绑定、`hub-namespace.ts` ~:251 facet `sendUpdateFrame` 绑定）：接口加可选参后，少参箭头仍可赋值——**typecheck 不会强制**这两处改为透传，漏改 = 静默丢 `sendQueueMs`，只能靠红灯契约（EM-C4c/EM-C7a）兜底 | D3.1 线程表显式点名两处绑定为改动点，并在实现时各留一行注释（「accounting 透传——缺失即 EM-C4c 红」），把兜底从契约前移到实现自检 |
| O3 | `HubSendAccounting` 形状拼写三处（hub-split 具名类型 + `UpdateChannelHost`/`HubChannelHost` 内联结构类型）。分层动机成立（peer 共享层不 import hub-split），但未来 append-only 扩成员时，只改具名类型不会在生产端产生类型错误（结构化兼容 ⇒ 静默不产出新成员） | 三处各加互指注释钉死「同形同步维护」；若该投影未来长出第二成员，再抽到 peer/hub 中立模块 |
| O4 | D3.2 把 `sentAt` 采样移到发送之前：① `seq≤0` 拒绝路径现在也会发生一次 observer 门后的时钟读（今天不发生——§23.4 只约束无 observer 面，合规，但行为面有微差）；② `update-sent` 现在先于 `inFlight.set`/`armAckTimer` 到达 observer（文档化 seam 不暴露 inFlight，不可观察） | 实现处加注释钉死「采样点 = 发送调用边界，值恒等依赖发送栈零时钟读」与「事件先于 inFlight 注册」两个事实，防后续「顺手还原」破坏值恒等论证 |
| O5 | D6 防御分支（交叉校验不过 ⇒ dormant 跳过）缺显式测试锚：守卫测试清单（varUint 边界/id 窗口/型门）未列短帧（byteLength < 57）与非规范 varUint 续位的输入 | 守卫测试补 2–3 条畸形输入用例，断言「零 throw + 零事件 + 返回值不受影响」，把 D6 的「判定自身零 throw」从设计主张变成回归锚 |

## 15. 冲突复查信号

本评审对设计 §15 的三点理由独立复核并**确认成立**：① SA8 从未运行（iteration 0），U1（族作用域）
/U2（缝承载机制）两项 SA6 原文标注「留待 SA2/SA8」的裁资本评审已就 SA2 半边采纳（§5），SA8
半边仍待冲突检查确认；② §17/§22/§23.1 与 ADR 0032 的编辑触及 append-only 冻结面（追注不改字段表，
仍属复查范围）；③ `HubSessionEdgePort.sendDataFrame` 内部缝签名 append。故随本评审提交
`requiresConflictRecheck = true`（与设计 §15 同向，非新增冲突面）。
