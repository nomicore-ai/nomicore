# 冲突门禁报告（设计后复审）— issue #450

**被审对象**：SA1 修订版设计 `wiki/raw/task_issue-450_design.md`（iteration 1，517 行：**F-1 修订**——分叉从守卫失败动作单点延伸至 egress 前置门水位暂停项（D1 两翼 / D1.5 裁定书），并按 SA2 要求把规范解释问题专递冲突门（§16））
**门禁类型**：设计后复审（design 复查；SA2 iteration-0 评审 `task_issue-450_sa2_review.md` 已在场——verdict `reject`（MAJOR F-1 + N1–N6），本报告核对其修订落实，不评审设计优劣）
**门禁轮次**：iteration 1（dispatch `sa-a3b97828-861b-4d43-8b4d-8843cb2fae08` / mabf-sa8 / conflict-gate；首版报告为 iteration 0，本报告**原位更新**，只反映当前被审对象）
**基线**：worktree HEAD `444c166`（= 设计/SA2/SA6 声明，git log 证实）；`git status` 证实仅 `wiki/raw/task_issue-450*` 与 `artifacts/sa6-issue450-*.log` 为未跟踪新增，**规范文本（ADR/协议/CONTEXT）零改动**。

---

## 1. Reviewed subject

- subject = **design**（修订版全文逐节审读；重点 = §7-D1-翼(ii)/D1.5、§8.1-⑥/doc append、§8.2 SM-5 改判、§9.1 0 值格、§16 规范解释问题专递）。
- 上游输入：Host 简报 `wiki/raw/task_issue-450.md`（AC×7，`## Comments` 空）；SA6 契约 `task_issue-450_sa6_contract.md`（抽查 §8/§12/§15——**§15-1【核心裁定】明文把 `tryEmitDataFrame` 与 `HostEdgeConnection.egress.sendDataFrame`（`hub-edge-host.ts:694-695`）并列为 β/γ 共享字节路径的分叉点**，并登记该 egress 静默闸「掩盖 AC1/AC2 的失败」）；SA2 评审 `task_issue-450_sa2_review.md`（F-1 证据链核对）。
- **Issue 评论 REST 快照为空**（简报 + dispatch + 本 dispatch 三方一致）⇒ **无 Owner override 权威可用**；需求全集 = Issue 正文 AC + ADR 0032 A4.3/A4.5 + 协议 §24.5/§24.7（设计 §4 同判，核实成立）。
- 前置门禁产物 `task_issue-450_relevant_decisions.md` / `_conflict_report.md` 仍不存在（非阻塞；决策集盘点以本报告 §2 为准）。

## 2. Inputs and decision set

决策集（全部现行为准、本轮逐条重核原文与源码锚点；ADR 编号到 0032 止，无 0031、无更高编号、无 supersede）：

| 决策源 | 状态 | 相关条款 |
|---|---|---|
| `docs/adr/0032-transport-decoupling-edge-session-split.md` | 已接受（无 supersede） | 决策 1（:14 单份实现）、决策 2（:18 缝无接纳信号 + 1011 终局兜底）、决策 5（:30 缺面 dormant 纪律）、A1（:40-41 `connection-fatal` 公共化）、A3（:53 **`dataGateOpen` 恒 true（水位闸门休眠；连接级总量保护收敛 edge + 1011 终局）**）、A4.1（:61-65 缝词汇闭集合）、**A4.3（:77-79 流控单点化与拒纳语义：session 乐观发送删除 `dataGateOpen`/`connectionState`/`bufferedAmount` 前置检查（A3 缺面 dormant 先例）；账本投影越界即 1011 收口整条连接——无逐帧拒纳、无 deferred、无 ns 级 send-failed resync；γ = 连接级死亡、β 行为不变；内存安全链逐跳有界）**、A4.4（:83 pacing 非流控；γ 不保持 RR 公平性）、A4.5（:85-87 生命周期单规则）、A4.6（:89-91）、A4.7（:93-95）、A4.8（:97-99）、后果（:112 公开面冻结、演进只能 append-only、:113 #423 注记） |
| `docs/protocols/instance-replication-v1.md` §24（:1091-1154） | 规范文本（:1093 host-facing 契约；决策权威 = ADR 0032 A4；α/β 不受影响、行为逐字节不变） | **§24.5:1132 主句「流控只由 edge 单点负责；session 不过问闸门与连接状态（无前置检查、无状态镜像），乐观发送」；:1134「edge 及时消费管道——管道不成为蓄水池；连接账本投影（§17 严格接纳口径）越界即 CONNECTION_BACKPRESSURE(1011) 收口整条连接：无逐帧拒纳、无 deferred、无 ns 级 send-failed resync」；:1135 β/γ 显式行为差（γ = 连接级死亡）；:1137 内存链 + 最坏账 cap + control 后死亡释放**；§24.3:1120 缝上无拒纳/闸门/信用词汇；§24.6:1143 γ 不保持 §17 RR 公平性（显式接受）；§24.7:1147；§24.8 |
| 同上 **§17 背压、公平调度与上限**（:564-617） | 已接受 | :587（总队列记账含 socket `bufferedAmount`；shed 只作用排队侧——**socket 缓冲不可撤回，由水位暂停与 1011 承接**；严格接纳；control 保留额度耗尽 = 1011）；**:589（「超过 high-water 暂停 dequeue，降至 low-water 恢复」；`bufferedAmount` 缺面视为 0——水位退化为不可观察，数据总量仍受准入与 1011 收口；**生产 Adapter 必须暴露三面**）**；:600 链式不变量 `maxQueuedBytesPerConnection >= highWater`（:609 `low < high`） |
| 同上 §3/§13.1/§14/§18/§21/§23 | 已接受 | 序号纪律；17 连接码冻结（`FRAME_TOO_LARGE` config/1009、`CONNECTION_BACKPRESSURE` yes/1011）；**§23.1:775 `send-paused`/`send-resumed` 字段 = `connectionId?`、`bufferedAmount`；:839 连接级事实（……水位……）在 edge**；§23.2 append-only |
| `CONTEXT.md` | 现行词表 | 「SessionHost」γ 段：「流控单点在 edge（**账本溢出即 1011，无拒纳/闸门/信用词汇**）……」；Avoid：「在 γ 缝上加拒纳/闸门/信用词汇（流控是 edge 单点职责）」 |
| `packages/ws-replication/AGENTS.md` | 模块契约 | :17 缝纪律（γ append-only 句 + 「still no rejection/gate/credit vocabulary」+ β 冻结）；:20 工厂 append-only；:22 生产 API 经 index；:24-26 验证纪律 |
| ADR 0013:52 / 0022:49（背景权威） | 已接受 | chunk 逐帧经**既有 data 路径**出站：独立 sequence、独立受 `dataGateOpen` 与 RR 调度、control reserve 不承载 chunk |
| `wiki/raw/task_issue-447_design.md` §9.1（证据级，非规范） | 前序票登记 | 桥纪律行：「egress ≤ 0 ⇒ **不投回执**；该 tag 停留 pending 占窗。γ 装配下 egress 的 0 仅来自单帧超限……或账本越界……，**水位暂停路径在无 `bufferedAmount` 传输上 dormant**（§9.4）——非终局形态下由 §8.6.1 ackTimeout 有界兜底」 |

代码事实独立核实（代码只作当前事实确认，不替代决策文本；修订版新增行锚逐项对勘）：

- **A4 前置门本体**：`hub-edge-host.ts:694-695` `sendDataFrame: (frame) => port.connectionState() === 'closed' || !port.dataGateOpen() ? 0 : port.sendDataFrame(frame)`，注释自证判定次序 = `hub-session.ts:210-216` 镜像（门前置 → 守卫 → 账本）；`:272`（hub-edge.ts）`dataGateOpen: () => this.sender.dataGateOpen()` → `backpressure.ts:193-196`（`observeWater` 后 `!paused`）→ `:286-295`（`observe() > highWater ⇒ enterPause`；`:292-294` 暂停段 `≤ lowWater` 才恢复）。**水位暂停项结构性先于账本守卫**成立。
- **γ data 路径上最后一个 `dataGateOpen` 前置检查**：session 半边 T1 已 dormant（`hub-session-async-host.ts:219` `dataGateOpen: () => true`，注释「D5/A4.3 dormant 面：流控单点在 edge 账本」；`:239` `bufferedAmount: () => undefined`）；β 工厂同样 dormant（`hub-session-host.ts`「决策 5 dormant：宿主传输水位闸门休眠（连接级总量保护收敛 edge）」）；α 真实镜像保留（`hub-session.ts:225-226` `closed` 门 → `dataGateOpen` 门 → `port.sendDataFrame`）。设计 A7/A8/D1.5-① 事实链核实成立。
- **守卫与收口单点**：`backpressure.ts:165-173` 两守卫失败动作均只 `return 0`（缺口本体）；`hub-edge.ts:203-217` host 对象 **13 项**（N1 订正属实）、`:214` `onBackpressureExhausted → connectionFatal('CONNECTION_BACKPRESSURE', 1011)`（control 侧既有 1011 单点）；`connectionFatal`（:673-698）同步前缀含 `closedFlag = true; setConnState('closed')`（:683-684）——**回调返回时连接已处 closed**（§8.1 doc append「0 ⟺ 已收口」的字面成立前提）；`sendControl`/`sendControlFrame`（:115-158）暂停态 control 额度耗尽路径原样（设计保留面属实）；`onEmitted` tornDown 早退（:208-209）。
- **投影含 socket 证据**：`tryEmitDataFrame` 投影 = `observe() + pendingDataHandoff + controlPendingHandoff + totalQueuedBytes() + frameBytes`（:168-171），`observe()` 读 `bufferedAmount` 并对账退休（:350-389）——「投影含 `observe()` 自行判死」的机制底座在场。
- **公共面**：`hub-edge-host.ts:151-167` 现恰 9 成员；egress 面 doc 现状「0 = 拒纳」（:118-130，doc append 的改写对象）；`:674` `dataFacetOf(): undefined`（工厂形态 wheel/shed 结构性 inert）；α 组合根（`hub-connection.ts:331-352`）与 peer（`peer-connection.ts:373-390` 自有 host，无钩子成员）不传新标记 ⇒ 新分支结构性不可达。
- **配置面**：`validate.ts` 链式不变量 `lowWater < highWater ≤ maxQueuedBytesPerConnection`（注释「§3.4/A2-3：可恢复暂停阈值必须先于终止性 1011 阈值」）；`defaults.ts:24-26` cap 8 MiB / highWater 512 KiB / lowWater 64 KiB。
- **AGENTS.md**：:17 现无水位措辞（D8 append 句为新增登记面，无既有句改写）。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | **ADR 0032 A4.3 + 协议 §24.5:1132-1134（§16 专递问题本体）** | :77-79/:1132-1134 「session 乐观发送，删除 `dataGateOpen`/`connectionState`/`bufferedAmount` 前置检查」+「无逐帧拒纳、无 deferred、无 ns 级 send-failed resync」的适用范围是否覆盖 edge egress 前置门水位暂停项 | **D1-翼(ii)**：γ 装配（工厂 option `asyncDataAdmissionFatal: true`）下前置门仅保留 `connectionState()==='closed'` 项，`!port.dataGateOpen()` 暂停项不参与判定——γ data 帧恒达账本守卫，投影含 `observe()` 自行判死；标记缺席 ⇒ 门前置次序逐字保留（`pausePreGate` 构造期常量，§8.1-⑥）；`closed` 项保留 = A4.5 收口后丢弃规则的机械载体 | **implements-existing-decision**（**§16 读法 A 确认**，裁定书见下） | 设计 §7-D1/D1.5/§8.1-⑥/§16；A4.3:79；§24.5:1132-1134；`hub-edge-host.ts:694-695`；`hub-session-async-host.ts:219`；SA6 §15-1（egress 面列为分叉点） | —（实现期核对 = §8-R2/R7） |
| 2 | ADR 0032 A4.3 + §24.5:1134 | 账本投影越界即 1011 收口整条连接 | **D1-翼(i)**：`ConnectionSenderHost` append-only 可选钩子 `onDataFrameAdmissionFatal`，两守卫 `return 0` 前同步回调 ⇒ `connectionFatal('CONNECTION_BACKPRESSURE', 1011)`；判据/次序/投影口径零变化 | implements-existing-decision（iteration 0 #1 裁定承接；守卫面修订版零变化） | 设计 §7-D1/§8.1-②④；`backpressure.ts:165-173`；`hub-edge.ts:214/:673-698` | §8-R2 |
| 3 | ADR 0032 A4.3 + §24.5:1135/:1137 | β/γ 显式行为差（γ = 连接级死亡）；慢连接最坏账 = cap + control 后死亡释放 | 两翼合并后「无逐帧拒纳」在 γ data 路径无例外成立（有/无 `bufferedAmount` 传输一致）；`BPK-C4` 落生产拓扑正锚、`BPK-NC2` 固化缺省前置门负控；§9.4 上界论证在有证据传输上闭合（首版缺口，F-1） | implements-existing-decision | 设计 §7-D1.5/§9.4/§12 `BPK-C4`/`BPK-NC2`/`MEM-*`；§24.5:1135/:1137 | §8-R2/R3 |
| 4 | 协议 §24.5:1136 + §13.1/§14 | 单帧超限 = 配置错误 → 响亮收口 + 诊断 | D3：`FRAME_TOO_LARGE` + 既有 1009 映射 + `connection-failed` 恰一；零新码（SA6 §15-2） | implements-existing-decision（iteration 0 #2 承接） | 设计 §7-D3；`errors.ts:105`；`hub-edge.ts:112-116` | — |
| 5 | **协议 §17:587-589/:600-609（水位机械）** | 「超过 high-water 暂停 dequeue，降至 low-water 恢复」；「socket 缓冲不可撤回，由水位暂停与 1011 承接」；链式不变量 | **保留面原样**：α 真实闸门（`hub-session.ts:226`）、β/γ **control** 侧暂停态额度记账与耗尽 1011（`sendControl`/`sendControlFrame` 自带 `observeWater`）、缺省装配 egress 前置门（`pausePreGate=true` 逐字，`BPK-NC2` 锚）、`validate.ts` 链式校验零改动；**仅 γ 装配的 data 前置门项让位于账本终局判死**（#1 裁定：§17 暂停语义的「dequeue 队列 + 恢复」前提在 γ data 路径结构性不存在，见裁定书理由②） | **no-conflict**（§17 条款在其余适用面逐字兑现；γ data 面的位移由 §24.5 特别条款支撑，非契约修订） | 设计 §7-D1.5 保留面/§13-R8；`backpressure.ts:115-158/:286-334`；`validate.ts` 链；`hub-session.ts:225-226` | §8-R3（`BPK-NC2` 运行期证明） |
| 6 | 协议 §23.1:775/:839 + §23.2 | `send-paused`/`send-resumed` = 连接级**水位事实**事件（字段 `connectionId?`/`bufferedAmount`），发射点在 edge；事件型 append-only | γ 下 `dataGateOpen()` 不再被 egress 调用 ⇒ 水位边沿观察点收敛到 control 发送（ACK/GOAWAY/ERROR 持续在场）与 poll；事件照常发射、字段零变化；data 死亡判据不依赖 `paused` | no-conflict（事件注册语义 = 水位事实非接纳决策，与 §23.1:839「连接级事实……水位……在 edge」一致） | 设计 §7-D1.5 保留面；`backpressure.ts:297-314`（`enterPause`/`resume` 发射点）；§23.1:775/:839 | §8-R7（γ 下事件仍可达的运行期核对） |
| 7 | 协议 §24.3:1108-1120 + A4.1/A4.6 | 缝词汇 append-only 闭集合；无拒纳/闸门/信用词汇；receipt 恒 `{tag,sequence}` | 前置门分叉为 **edge 内部行为**（构造期常量），不上缝、无新缝消息；收口仍经既有 edge→session `close`；`BPK-C2` 断言词汇 ⊆ 闭集合 | no-conflict（iteration 0 #5 承接；翼(ii) 无新词汇面） | 设计 §7-D1/§8.1-⑥；§24.3:1120；`issue447-async-seam.ts:490-517` | — |
| 8 | ADR 0032 后果:112 + 模块 AGENTS:20/:22 | 公开面一经发布即冻结，演进只能 append-only | 唯一公共面变化仍 = `HubReplicationEdgeOptions` 第 10 可选成员 `asyncDataAdmissionFatal?: true`（精确 `true`、装配期事实、无运行时切换）；**翼(ii) 无公共类型面**（`HostEdgeConnection` 内部类 + `pausePreGate` 构造参数）；内部 `HubReplicationEdgeConfig`/`ConnectionSenderHost` append-only；index.ts 零改动；421 test-d append 行 | no-conflict（注册的 append-only 通道内；iteration 0 #6 承接，本版无新增公共面） | 设计 §7-D2/D9/§8.1/§11；ADR 0032:112；`hub-edge-host.ts:151-167`；`index.ts:90` | §8-R1 |
| 9 | ADR 0032 A4.5 + §24.7 | 生命周期单规则（收口后丢弃/close 冲刷/revoke 不溯及/settled 晚到/`closeTimeoutMs` 不动） | D5 零生产改动 + 四腿回归哨兵锚；新收口触发点汇入既有 `connectionFatal` 拓扑（`requestSinkClose` 同步 quiesce 前缀）⇒ 四腿自动适用；前置门 `closed` 项 = 丢弃规则的机械载体（SA6 P3 绿） | implements-existing-decision（iteration 0 #8 承接） | 设计 §7-D4/D5/§12；A4.5:87；§24.7:1147 | §8-R3 |
| 10 | ADR 0032 A4.3 + §24.5:1139 | OPEN/pending 水位 = 故障参数，原值不动 | D7 原值 16/4 不动；γ + F2 deferred resolver permutation 锚（N4 措辞已正：16 帧形态 = 1 OPEN + 15 缓冲帧） | no-conflict（iteration 0 #9 承接） | 设计 §7-D7/§12 `OPENWP-*`；`hub-edge-host.ts:187/:191/:295-339` | — |
| 11 | ADR 0032 A4.8 | 成功路径 wire 逐字节等价；拒纳路径显式分叉登记；延迟可注入显式异步内存管道；既有矩阵全绿硬门 | F1–F4 = #447 通道对 + 显式释放 + 虚拟调度器；分叉登记 = `BPK-NC1` + `BPK-NC2` + AGENTS.md 句；F1 扩展「双压力形态」（无面/有面不 advance）+ `BPK-C4` 生产拓扑 permutation | implements-existing-decision | 设计 §7-D6/§12；A4.8:99 | §8-R3 |
| 12 | ADR 0032 A4.7 + §24.8 | `update-sent` 发射点 = edge 盖章点；直驱帧 `sendQueueMs` 整键缺席 | 单漏斗 `port.sendDataFrame`（`hub-edge.ts:267-270`）覆盖 session 组装/分块族/直驱；`seq>0` 门零变化 | no-conflict（iteration 0 #11 承接） | 设计 §2-A6/§8.3；`hub-edge.ts:267-270` | — |
| 13 | ADR 0032 决策 1 + 决策 2 | 协议状态机单份实现；缝无接纳信号、1011 终局兜底 | 否决备选 (b)（γ 专用 egress 面或第二份 ConnectionSender）——不 fork；翼(ii) = 同一 egress 装配闭包内的构造期参数分叉；wing (ii) 强化 1011 终局在 γ data 面的可达性（决策 2 兜底语义的兑现） | no-conflict | 设计 §7-D1(b)/§8.1-⑥；ADR 0032:14/:18 | — |
| 14 | ADR 0013:52 / 0022:49 | chunk 逐帧经既有 data 路径出站，独立受 `dataGateOpen` 与 RR 调度 | chunk 仍经同一单漏斗（守卫共享，F3 覆盖论证）；不新建第二 data 路径；「受 dataGateOpen/RR 调度」的措辞描述的是该两 ADR 时点的**单体 data 路径**形态——其 RR 半在拆分工厂形态已结构性缺席（edge 无 facets，`hub-edge-host.ts:674`；A4.4 显式登记 γ 不保持 RR），其闸门半按 #1 裁定在 γ data 面位移；β session 路径自 #420 起亦已 dormant（决策 5 登记，两 ADR 文本未随之修订的先例） | no-conflict（「既有 data 路径」的实质 = 复用同一路径与纪律，非冻结各形态的调度细节；chunked 义务面——独立 sequence、control reserve 不承载、窗口槽——零触碰） | 设计 §7-D6-F3/§8.3；ADR 0013:52；ADR 0022:49；`hub-edge-host.ts:674` | — |
| 15 | SA6 契约 §15-1【核心裁定】（已批准验收契约） | `tryEmitDataFrame` 与 `HostEdgeConnection.egress.sendDataFrame`（:694-695）为 β/γ 共享字节路径，A4.3 要求 γ=连接死亡/β=ns resync；设计必须显式引入分叉 | 修订版在**两处**共享路径均落分叉（首版只落守卫面 = SA2 F-1 的缺口）；分叉载体 = append-only 连接选项（SA6 列举的合法形态之一） | implements-existing-decision | SA6 契约 :265/:173；设计 §7-D1 | §8-R2 |
| 16 | `task_issue-447_design.md` §9.1 桥纪律行（证据级） | 「egress ≤ 0 ⇒ 不投回执；tag 停留 pending 占窗……水位暂停路径在无 `bufferedAmount` 传输上 dormant」 | 修订版引用该行**保留限定从句**并论证两翼落地后限制性从句对 γ data 帧失效（0 值在 γ 下无条件仅来自已收口三形态）；缺省装配语义不变；§8.1 doc append 使公共面陈述与代码一致 | no-conflict（前序票证据一致性；wiki/raw 非规范契约，无修订义务；规范承载面 = egress 公共 doc + AGENTS.md，均在变更集内） | 设计 §7-D1 衔接段/§8.1 doc append；#447 设计 §9.1 | §8-R7（doc 真陈述核对） |
| 17 | CONTEXT.md「SessionHost」γ 段 | 流控单点在 edge（账本溢出即 1011，无拒纳/闸门/信用词汇）；Avoid「在 γ 缝上加拒纳/闸门/信用词汇」 | 零 CONTEXT 改动；翼(ii) **移除** γ data 路径上事实存在的闸门拦截 ⇒ 实现向词条收敛；词汇面零扩展 | no-conflict | 设计 §7-D8/§11 DENY；CONTEXT.md SessionHost 条目 | — |
| 18 | 模块 AGENTS:17/:20-26 + docs/AGENTS.md | 缝纪律 append-only 登记；验证门；行为变化时同步规范文档 | D8：规范文本零改动（§24.5/A4.3/CONTEXT 已是目标语义——本轮逐字复核成立）；`packages/ws-replication/AGENTS.md` append-only 一句（γ 装配标记语义 + **双向**误用面 + 方向性置位义务 + 前置门仅 closed 项声明）；§12.2 六道验证门 | implements-existing-decision（文档同步义务在变更集内承接） | 设计 §7-D8/§11/§12.2；AGENTS:17-26；docs/AGENTS.md | §8-R4/R5 |

### 解释裁定专项（设计 §16 专递问题 → **读法 A 确认**）

**问题**：A4.3（:77-79）与 §24.5（:1132-1134）的适用范围是否覆盖 edge 侧公共 egress 面前置门中的水位暂停项（`!port.dataGateOpen()`）？**裁定：覆盖——γ 装配下该前置门应仅保留 `closed` 项，翼(ii) 为既有决策登记目标语义的实现，非契约变更。** 理由六点：

1. **制度级登记而非单点响应形态**。A4.3 节标题即「流控单点化与**拒纳语义**」，首句「拒纳的实质是流控；流控只由 edge 单点负责」；§24.5:1134 的三个否定式（无逐帧拒纳/无 deferred/无 ns 级 send-failed resync）与 :1135 的 β/γ **可观察行为差**登记（「γ = 连接级死亡——用恢复粒度换内存安全的单点可论证性」）共同定义 γ 的拒纳语义**制度**：γ 的 data 体量流控形态唯一 = 账本投影 + 1011 死亡。读法 B 把三个否定式收缩为「越界触发点的响应形态」，将使 :1135 登记的行为差在慢性压力形态退化为不可观察——与同节登记直接矛盾。
2. **读法 B 的「可恢复流控阶段」在 γ data 路径结构性不可实现**。§17:589 的暂停语义 =「暂停 **dequeue**，降至 low-water **恢复**」——前提是被暂停的帧存活于某个出队队列并最终发出。γ data 路径无此面：桥纪律（#447 §9.1 登记 + `issue447-async-seam.ts:498-517`）为「egress ≤ 0 ⇒ **不投回执**，tag 停留 pending 占窗」——弹回帧在 edge 边界即被丢弃，无再入队面；§24.5:1134 自身「edge 及时消费管道——**管道不成为蓄水池**」禁止宿主桥停拉/囤积待闸门重开；§24.3:1120 禁止缝上任何闸门/保持词汇（无通道告知 session 暂停）。三重封堵下，γ 前置门暂停项**只能**表现为：0 弹回（逐帧拒纳）+ tag pending 占窗（deferred）+ ackTimeout ns 级 resync 且连接存活（β 可观察形态）——恰为 A4.3/§24.5 三否定式的逐项产物（SA2 SM-5/ER-5 实证）。可恢复阶段真实存在的面——α session 队列、β/γ control 侧额度记账——设计全部原样保留（#5/#6）。
3. **生产拓扑强制「有面」，读法 B 使规范自相矛盾**。§17:589「**生产 Adapter 必须暴露三面**」⇒ γ 生产拓扑（edge 持 ws socket）恒为有 `bufferedAmount` 传输；缺省 highWater 512 KiB < cap 8 MiB 且链式不变量（:600/:609）保证 highWater ≤ cap ⇒ 暂停项结构性先制账本守卫。读法 B 成立 ⇒ :1135 行为差、:1137「最坏账 = cap + control 后**连接死亡释放**」在生产拓扑系统性不可达/不可观察，§24.5 的 γ 登记在唯一部署形态被其一般条款反噬。规范体系的一致读法：§24 为 γ 特别条款（:1093「决策权威 = ADR 0032 附录 A4；本节是规范文本」；§24.6 示范了 γ 对 §17 机械的显式位移模式），其注册的 γ data 体量机制 = 账本 + 1011；§17 暂停在前提成立的面继续适用。
4. **删除清单的引用先例自洽指向功能范围**。A4.3 删除句自引「（**A3 缺面 dormant 先例**）」，A3 的登记含义 =「`dataGateOpen` 恒 true（水位闸门休眠；**连接级总量保护收敛 edge + 1011 终局**）」——闸门移除/休眠后，总量保护收敛到 edge + 1011。γ data 路径上唯一残存的活 `dataGateOpen` 前置检查即 egress 前置门（session 半边 T1 已 dormant、β 工厂同 dormant、α 真实镜像在另一路径）——按位置学读法（删除句语法主语是 session 半边）将使同一句登记的三否定式被自己保留的检查推翻；按功能读法（γ data 路径）全部自洽。§24.5:1132 的对应句「**session** 不过问闸门与连接状态」恰证明该义务的语法主语是 session 半边，而其上一句「流控只由 edge 单点负责」+ :1134 三否定式才是对 γ 流控**形态**的制度约束——翼(ii) 正是把形态约束落到 edge 自己的装配上。
5. **`closed` 项保留与删除清单不冲突**。删除清单指向的是流控观察面（`dataGateOpen`/`bufferedAmount`）；前置门 `connectionState()==='closed'` 项是 A4.5/§24.7「收口后 session→edge 后到的一切静默丢弃」的机械载体（SA6 S6 登记、P3 运行时绿），属生命周期规则非流控前置检查。设计「删流控项、留生命周期项」的切分与条款功能一致。
6. **备选 (f) 的否决佐证裁定边界**。A4.3 的动词是「**删除**前置检查」而非「fatal 化」；若把暂停边沿致命化（highWater ⇒ 死），将以 `validate.ts` 链式注释明文的「可恢复暂停阈值」充当终止阈值，例行突发（2 MiB diff 越缺省 512 KiB highWater）即杀连接。翼(ii) 保持 cap 为唯一终止界，界内突发照常放行（`BPK-C3`/`MEM-NC1` 锚）——与「删除」语义及链式不变量登记的阈值分工（highWater = pacing、cap = 终局）一致。

**裁定影响**：读法 A 成立 ⇒ 设计 §7-D1（两翼）/D1.5 为规范要求形态，`BPK-C4/NC2` 为其验收锚；**§13-R9 降级路径不触发**（无需 revert 翼(ii)、无需改回三来源 0 值格、无需限定 AC1 适用域）；D1-翼(i)/D3/AC2–AC6 不受影响（与设计 §16 自评一致）。本裁定是**解释性确认**（既有文本已登记目标语义），**不构成、亦不需要任何 override**（见 §4）。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| （无） | — | — | — |

无任何合法 override，亦无需要：Issue 评论 REST 快照为空（无 Owner 评论）；无新 ADR 修订/废弃；无协议版本升级。§16 裁定为**解释性确认**——现有文本（A4.3/§24.5/§17/CONTEXT）按一致读法已登记翼(ii) 的目标语义，SA8 不替 Owner 或 SA1 创设 override；公共面扩张仍走 ADR 0032:112 自身 append-only 演进条款（非 override 通道）。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（设计面） |
|---|---|---|---|
| β 公共工厂/句柄面 | `createHubSessionHost` 冻结签名逐字 | A4.1:61；AGENTS:17 | 保持（`hub-session-host.ts` 入 DENY） |
| 公共导出面与工厂签名 | `src/index.ts` 值导出零增删；三工厂签名零变化；类型只增不改 | 后果:112；AGENTS:20/:22 | 保持（option 经 `index.ts:90` 再导出流动；PUB test-d append） |
| wire 格式与序号纪律 | envelope/帧型/`[8..12]` mux 单点盖章/§3 严格递增 | §24 头注:1093；决策 2:18 | 保持（非目标明示；parity 族 + 缺省零传） |
| 缝词汇闭集合 | §24.3 七消息 + 无拒纳/闸门/信用词汇 + receipt 恒 `{tag,sequence}` | §24.3:1108-1120；A4.6:91 | 保持（翼(ii) 为 edge 内部行为，零新缝消息） |
| **缺省装配 egress 前置门**（本版新增行） | `closed ∨ ¬gate` 判定次序逐字（`hub-session.ts:216-230` 等价镜像）；α 真实闸门行为 | `hub-edge-host.ts:693-695` 注释；设计 §7-D1-翼(ii)/§8.1-⑥ | 保持（`pausePreGate` 构造期常量、标记缺席恒 true；**`BPK-NC2`** 可执行负控；α/β 逐字节不变硬门） |
| α/β/peer 行为 | 与 HEAD 逐字节等价；101 文件全绿 | A4.8:99；§24 头注:1093 | 设计承诺 + `BPK-NC1`/`BPK-NC2` + §12.2-6 硬门（实现期复核） |
| **§17 水位机械（γ 位移外全量）** | α 闸门、control 侧暂停额度与耗尽 1011、`send-paused`/`send-resumed` 事件型与字段、链式校验、水位缺省值 | §17:587-589/:600-609；§23.1:775 | 保持（D1.5 保留面；事件发射点 `enterPause`/`resume` 原样；流控调参非目标） |
| 错误注册表与映射单点 | 17 连接码冻结；code→close code 单点 | §13.1；A1:40 | 保持（零新码；D3 映射单点在 edge） |
| observer 事件型与字段集 | `connection-failed` 既有形状；§23.2 append-only | §23.2:848 | 保持（两码均在白名单；水位事件字段零变化） |
| §18/§21 参数与停机语义 | `closeTimeoutMs` 等不动 | §24.7:1147 | 保持（D5 + `DRAIN-NC1` 敏感性锚） |
| 规范文本 | ADR 0032 / 协议 / CONTEXT.md 零改动 | D8；本轮 git status 证实 | 保持（§11 DENY；§16 裁定后无修订需求） |
| 前序票冻结面（#418/#420-#424/#447/#448） | 公共面只增不改；#447/#448 夹具 append-only 除外行为逐字 | AGENTS:20；设计 §11 | 保持（`issue447-async-seam.ts` append + 缺省零传 + 复跑绿为门；421 test-d append-only） |
| peer 侧 | 不拆分、消息形态路径零改动 | 后果:113 | 保持（`peer-connection.ts` DENY；peer host 无钩子） |

## 6. Evolution requirements

**无剩余 evolution-required 项。**

- §16 裁定（读法 A）成立 ⇒ 翼(ii) 与翼(i) 同属 A4.3/§24.5 **已登记目标语义的实现追平**，规范文本零修订需求（本轮逐字复核 §24.5:1132-1139、A4.3:79、§17、CONTEXT 词条均已是目标语义或不受影响面）。
- §17 水位条款不构成翼(ii) 的修订义务：其「暂停 dequeue/恢复」前提在 γ data 路径结构性不存在（裁定书理由②），在前提成立的面（α/control/缺省装配）设计逐字保留（#5）；γ data 面的位移由 §24.5 特别条款支撑，属规范内部一致性解释，非条款改写。
- 公共面扩张（`HubReplicationEdgeOptions` +1 可选成员、内部两类型 +1 可选成员、`HostEdgeConnection` 构造参数）落在 ADR 0032:112 注册的 append-only 条款内，无修订计划义务。
- 模块 AGENTS.md 登记句（D8，含前置门声明）为 docs/AGENTS.md 文档同步义务的变更集内承接，非决策演进。

## 7. Hard conflicts

无。18 项对照全部落在 no-conflict / implements-existing-decision；§16 专递问题经六点论证裁定为读法 A（既有义务的实现），无 hard-conflict、无 override 需求；修订版未与任何 accepted 决策、协议条款、CONTEXT 词条或模块 AGENTS 契约对撞；SA2 F-1 指出的首版「无条件 0 ⇒ 已收口」不真陈述已被本版改写为与代码逐形态一致（§8.1 doc append/§9.1/§10），N1–N6 修订映射（§14）逐条核对属实。

## 8. Required actions

| # | 级别 | 行动 | 归属 |
|---|---|---|---|
| R1 | 复核义务（实现期） | 公共 API append 核对：`asyncDataAdmissionFatal?: true` 恰 `true \| undefined` 形状、`allocate` 双落点转发、缺省对象字面量零 cast 通过（PUB/test-d append + 「九→十」措辞同步、既有断言全保留）、`src/index.ts` 零改动 | SA8 implementation 复查 / 总控 |
| R2 | 复核义务（实现期） | **两翼**分叉机械核对：翼(i) 两守卫仅新增可选钩子调用（次序 oversize 先、严格大于判据、投影口径逐字不变；钩子同步 `connectionFatal` 后 `return 0`）；**翼(ii) `pausePreGate` 为构造期常量**（无运行时切换）、γ 下前置门仅 `closed` 项、缺省下 `closed ∨ ¬gate` 次序逐字保留；`closedFlag` 幂等恰一收口；`tornDown` 收口 ERROR 零记账 | SA8 implementation 复查 / 总控 |
| R3 | 复核义务（实现期） | 冻结面逐项核对：101 文件全绿 + `BPK-NC1`（β 语义）+ **`BPK-NC2`（缺省前置门弹回 + 漏置位形态）** + #447 三套件/#448 复跑绿（夹具 append 缺省零传）+ γ 族 wire 断言（`BPK-C1/C4/C2`、`OVS-C1`）+ α 闸门/control 额度/水位事件（§23.1 字段）不受扰 | SA8 implementation 复查 / 总控 |
| R4 | 复核义务（实现期） | 规范零改动核对：`docs/adr/0032-*.md`、`docs/protocols/instance-replication-v1.md`、`CONTEXT.md` 在实现 diff 中零触碰；§12.2 六道验证门证据落盘 | SA8 implementation 复查 / 总控 |
| R5 | 复核义务（实现期） | `packages/ws-replication/AGENTS.md` append-only 登记句：承载「γ 异步缝装配（`createHubAsyncSessionHost` 桥）⇒ 应在 edge 工厂置位」的**方向性义务** + 双向误用面（本版 N3）+ **「置位后 egress 前置门仅保留 closed 项（水位暂停不再拦截 γ data 帧，A4.3/§24.5）」的前置门声明（D8 全文，本版新增要素）**；既有枚举句与冻结面零改写、同变更集落盘 | SA8 implementation 复查 / 总控 |
| R6 | 非阻塞（登记） | 排程依赖（#449 T3 未合入）：本票 ALLOW 不含 `update-channel.ts`/`bulk-transfer.ts`；若 #449 先合入，实现期按 SA6 §15-5 登记边界 | 总控 |
| R7 | 复核义务（实现期，本版新增） | **公共 doc 真陈述核对**：egress `sendDataFrame` doc append 的「γ data 帧 0 ⟺ 连接已收口」须字面成立——`connectionFatal` 同步前缀在守卫回调返回前置位 `closedFlag`/`setConnState('closed')`（`hub-edge.ts:683-684` 次序不被实现改动破坏）；γ data 路径 0 值来源穷尽 = oversize 守卫 / ledger-overflow 守卫 / 前置 `closed` 闸（无第四来源——水位暂停项已移除）；缺省装配 doc 语义「0 = 拒纳」保持；γ 下 `send-paused`/`send-resumed` 经 control 发送/poll 边沿仍可达且字段不变 | SA8 implementation 复查 / 总控 |

## 9. Verdict

**`clear`**

依据：技能 verdict 规则——「clear：全部为 no-conflict 或 implements-existing-decision」。本轮 18 项对照全部落在该两区：

1. **§16 专递问题裁定为读法 A**（裁定书六点）：γ 装配下 egress 前置门仅保留 `closed` 项、水位暂停项让位于账本终局判死，是 A4.3/§24.5 登记的 γ 拒纳语义制度（三否定式 + γ=连接级死亡 + 最坏账死亡释放）的实现要求，**不是契约变更**——读法 B 在 γ data 路径产生规范自相矛盾（生产拓扑强制有面 + 可恢复阶段结构性不存在），不予采纳；§13-R9 降级路径关闭。
2. 核心生产面（#1–#3、#15）：两翼分叉 = SA6 §15-1 明文列名的两处共享字节路径上 A4.3 目标语义的实现首次落地，规范文本零改动（实现追平规范）。
3. §17 水位机械（#5/#6）在 γ 位移外的全部适用面逐字保留；缝词汇（#7）、公共面（#8，append-only 通道内）、生命周期（#9）、观测（#12）、chunked 背景权威（#14）、CONTEXT（#17）零冲突。
4. 首版报告 T1 张力（opt-in γ 标记）的残留义务以 R5 承接并扩至前置门声明；本版 `BPK-NC2` 把「漏置位」形态固化为可执行负控，张力面收窄。

设计 §15 自报「需要设计后冲突复查」三点（公共 API append、**前置门分叉延伸 + §16 解释问题**、零冲突项申报）与本裁决一一对应：三项均处注册通道内或既有义务兑现，无 evolution-required、无 hard-conflict。

## 10. requiresConflictRecheck

**true**。设计面冲突已闭合（含 §16 解释问题），但以下面尚待**实现期**核对（技能规则：公共 API、wire 邻接、状态机、生命周期、失败语义尚待实现核对时为 true）：

1. 公共 API append-only 扩张落地（9→10 可选成员 + allocate 双落点 + PUB/test-d 类型锚 + index 零改动）——§8-R1；
2. **两翼分叉机械落地**：守卫可选钩子 + 前置门 `pausePreGate` 构造期常量分叉、γ 0 值来源穷尽性、幂等恰一收口——§8-R2/R7；
3. α/β/peer 缺省逐字节不变（101 文件 + `BPK-NC1`/**`BPK-NC2`** 硬门）与 γ 生产拓扑 1011 死亡锚（`BPK-C4`）——§8-R3；
4. 生命周期触发点合并后 `DROP/FLUSH/REVOKE/DRAIN` 四腿锚 + `closeTimeoutMs` 敏感性负控——§8-R3；
5. 规范文本零改动 + 模块 AGENTS.md 登记句（含前置门声明与方向性义务）同变更集落盘 + 公共 doc 真陈述——§8-R4/R5/R7。

纯 no-conflict 项（#4/#7/#10/#12/#13/#14/#16/#17）不产生独立复查义务；上述 1–5 全部核对闭合后，implementation 复查可将本标志置 false。
