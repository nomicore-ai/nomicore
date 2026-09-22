# 实现设计 — Issue #450（γ-T4）：γ 流控与生命周期收口——1011、close 冲刷 pending、revoke/settled 跨缝

- Dispatch：`sa-5f081ddf-4f9a-45a4-88ea-02f06052ebf5`（mabf-sa1 / design / **iteration 1**——SA2 评审修订版；首版 dispatch `sa-9109aa0a-…`）
- Baseline worktree：`/home/wangjian/nomicore-fix-issue-450`，HEAD **`444c1665fdb35b618bbb378a5b6bcefacfd288a7`**（= SA6 契约基线；γ-T1/T2 已在 HEAD；SA2 评审基线核对一致）
- 上游输入：`wiki/raw/task_issue-450.md`（Host 简报；`## Comments` 空——REST snapshot 为空，无 owner 追加要求）、`wiki/raw/task_issue-450_sa6_contract.md`（已批准验收契约）、`wiki/raw/task_issue-450_sa2_review.md`（**本次修订的评审输入**，verdict `reject`：MAJOR F-1 + N1–N6）、`wiki/raw/task_issue-450_design_conflict_report.md`（**SA8 设计后冲突门报告**，iteration 0 verdict `clear`、R1–R6 实现期核对义务——本修订按其 T1 残留义务 R5 与 §8 清单承接，并在 §16 新增一项规范解释问题）
- 缺席输入（非阻塞）：`task_issue-450_relevant_decisions.md` / `task_issue-450_conflict_report.md` 不存在（SA6 §3 / SA2 同判）
- 规范权威：`docs/adr/0032-transport-decoupling-edge-session-split.md` 附录 A4（A4.3 :77-79 / A4.5 :85-87 / A4.8 :97-99）、`docs/protocols/instance-replication-v1.md` §24（§24.3 :1108-1120 / §24.5 :1130-1139 / §24.7 :1145-1147）与 §4/§17 水位条目（:587 / :589 / :600）；前序票设计 `wiki/raw/task_issue-447_design.md` §9.1（:488 行，0 值语义登记）
- **本版相对首版的实质变化**：F-1 裁定——分叉从「守卫失败动作单点」**延伸至 egress 前置门暂停项**（D1 两翼 / D1.5 定案，§7）；公共面文档声明、0 值语义格、调用方矩阵、验收锚集（新增 `BPK-C4`/`BPK-NC2`）、内存最坏账论证与风险表同步改写；N1–N6 逐条落实（§14 映射表）

---

## 1. 任务类型、目标和非目标

**任务类型**：Feature 的能力缺口收口（γ 异步缝的流控与生命周期收口语义落地 + 四条已交付腿的验收锚）。

**目标**：

1. **AC1/AC7（红→绿，全传输形态）**：建立 γ 特有的连接终局分叉——edge 连接账本投影越界 ⇒ `CONNECTION_BACKPRESSURE`(1011) 收口整条连接（无逐帧拒纳、无 deferred、无 ns 级 send-failed resync）；分叉覆盖**两个先制面**：(i) `tryEmitDataFrame` 两条守卫的失败动作（首版已有），(ii) egress 前置门的水位暂停项（**本版新增**，F-1 裁定）——γ 装配下数据帧恒达账本守卫，慢连接最坏账 = `maxQueuedBytesPerConnection` + `maxQueuedControlBytes` 后连接死亡释放（在暴露 `bufferedAmount` 的生产传输上同样成立）。
2. **AC2（红→绿）**：单帧超连接级上限 ⇒ 配置错误定性 ⇒ 响亮收口 + 诊断（连接级 `ERROR{FRAME_TOO_LARGE}` + close 1009 + observer `connection-failed`；零新错误码）。
3. **AC3/AC4/AC5（绿腿补锚）**：收口后 session→edge 丢弃、close 整体冲刷 pending（含在管帧）、`terminateUnauthorized` 不溯及已推帧、`settled` 晚到 drain 与 `closeTimeoutMs` 逃生舱——HEAD 已具备（SA6 P3–P6 绿），本票交付**回归哨兵锚**，零生产改动。
4. **AC6（白盒→γ permutation）**：OPEN 水位（≤16 帧/连接、≤4 并发 OPEN）在注入跨线程延迟（F2 deferred resolver）下的 γ 缝 permutation 复核——原值不误收口、打穿响亮收口（故障参数定性，非流控调参）。
5. **β/α 行为逐字节不变**（硬门）：分叉 γ 门控，缺省零传 ⇒ 全部新分支死码（含前置门：标记缺席 ⇒ 门前置次序逐字保留）。
6. 验收测试/夹具策略落地（SA6 §12.1/§15-3 的 F1–F4 裁定；本版 F1 增加「生产拓扑 permutation」职责——`BPK-C4`/`BPK-NC2`）。

**非目标**：

- T3（#449）的分块 transfer 全回合、reconcile、drain 第三触发点；
- T5（#451）的 `update-sent` 总归属矩阵与根 `pnpm typecheck`/`pnpm test` **全量回归归属**（本票实现阶段仍须过模块 AGENTS 的根门禁，§12.2）；
- wire 格式与协议语义改动（§24 是 host-facing 契约；wire 零变化）；**规范文本零改动**（§24.5/A4.3 已登记目标语义，实现追平规范；见 §16 的解释问题专递）；
- session 侧（`hub-session-async-host.ts`/`hub-session.ts`/`hub-namespace.ts`/`update-channel.ts` 等）任何生产行为改动——AC3/AC4/AC5 机械已在 T1 交付且运行时验证绿；session 半边的乐观发送（`dataGateOpen: () => true` dormant）已由 T1 落地，本票不改；
- 流控调参（OPEN 水位原值不动；`maxQueuedBytesPerConnection`/`highWater`/`lowWater` 缺省与链式校验不动）；
- 新错误码 / 新 observer 事件型 / 新缝词汇（§24.3 闭集合、§13.1 注册表 append-only）。

---

## 2. 当前行为与证据锚点（HEAD = 444c1665；行锚经 SA2 评审逐条复核）

| # | 面 | 符号 / 行锚 | HEAD 行为 | 与本票关系 |
|---|---|---|---|---|
| A1 | 字节形态 data admission（承重点①） | `src/backpressure.ts:165-173` `ConnectionSender.tryEmitDataFrame`；`:167` 单帧守卫、`:171` 账本投影守卫 | 两条守卫失败动作**均只有 `return 0`**——不调用 `onBackpressureExhausted`、无任何连接级信号 | AC1/AC2/AC7 缺口之一；D1-翼(i) 改动点 |
| A2 | 1011 既有触发面（control 侧） | `src/backpressure.ts:115-126`（`sendControl` 暂停态额度）、`:149-158`（`sendControlFrame` 同构）→ `src/hub-edge.ts:214` `onBackpressureExhausted: () => this.connectionFatal('CONNECTION_BACKPRESSURE', 1011)` | control 保留额度耗尽 ⇒ 1011 收口（α/β/γ 三形态共有） | AC1 目标机制既有单点——复用其码与收口拓扑 |
| A3 | edge 连接级收口单点 | `src/hub-edge.ts:673-698` `connectionFatal`（ERROR 直发豁免 + transport.close + `connection-failed` observer + `requestSinkClose` + `cleanupAll`；`closedFlag` 幂等）；`wsCloseCodeFor`（`:112-116`）已含 `FRAME_TOO_LARGE → 1009` | 五路收口同构 | AC1/AC2 响亮面与诊断面——零新拓扑（D4） |
| A4 | edge egress 前置门（承重点②，**F-1 本体**） | `src/hub-edge-host.ts:691-699` `HostEdgeConnection.egress.sendDataFrame`：`port.connectionState()==='closed' \|\| !port.dataGateOpen() ? 0 : port.sendDataFrame(frame)`；→ `src/hub-edge.ts:272`（port `dataGateOpen → sender.dataGateOpen`）→ `src/backpressure.ts:193-196`（`dataGateOpen = observeWater() 后 !paused`）→ `:286-295`（`observeWater`：`observe() > highWater` ⇒ `enterPause`） | **水位暂停项结构性先于账本守卫**：暴露 `bufferedAmount` 的传输上（γ 生产拓扑的 ws socket），慢对端使水位越过 `highWater`（缺省 512 KiB）即关闸 ⇒ data 帧在前置门弹回 0（帧未达守卫、无 fatal、连接存活）；tag 停留 pending ⇒ ackTimeout ⇒ **ns 级 resync**——恰是 AC1 宣称「γ 不可达」的逐帧拒纳形态（SA2 SM-5/ER-5） | AC1/AC7 缺口之二；D1-翼(ii) 改动点（D1.5 裁定） |
| A5 | 水位机械与缺省值 | `src/backpressure.ts:286-328`（`observeWater`/`enterPause`/`resume`/poll；`observe()` :350-389 对账退休）；`src/defaults.ts` `DEFAULT_REPLICATION_LIMITS`（`maxQueuedBytesPerConnection` 8 MiB、`highWater` 512 KiB、`lowWater` 64 KiB）；`src/validate.ts` 链式不变量（`lowWater < highWater ≤ maxQueuedBytesPerConnection`，注释「可恢复暂停阈值必须先于终止性 1011 阈值」）；`src/hub-edge.ts:792-795` `readBufferedAmount`（缺面/非法 → 0） | hysteresis 暂停/恢复 + poll；水位对账以 `bufferedAmount` 为证据；缺面 = 0（水位不可观察） | A4 的机制底座；γ 下暂停状态对 control 额度仍有效（不动），对 data 前置门被 D1-翼(ii) 移除 |
| A6 | 盖章点与观测 | `src/hub-edge.ts:267-271`（`port.sendDataFrame` 单漏斗；`sequence>0` 才发 `update-sent`）；`src/frame-io.ts:184-197` `emitOne` 盖章单点 | hub 侧全部 data 帧（session 组装路径 + 分块族 + 宿主直驱）经本成员（#423 注释在场） | OVS-C1 经直驱面锚定后由单漏斗论证覆盖 session 路径（D6/F3） |
| A7 | γ session 半边（乐观发送已交付） | `src/hub-session-async-host.ts:215-222`（adapterPort：`dataGateOpen: () => true` **dormant**、`bufferedAmount: () => undefined`、`onDataQueued → selfDrain`）、`:197-202`（close ⇒ `unresolvedTags.clear()` + `sink.close()`）、`:256-264` `emitSeam`（tag 分配；未注册 sink ⇒ 0） | T1 交付：session 半边**已**按 A4.3 删除前置检查（乐观发送）；流控单点留给 edge 账本 | 零改动（DENY）；A4 的前置门是 γ data 路径上**残留的最后一个** `dataGateOpen` 前置检查（D1.5 论证） |
| A8 | β 同步缝 session 半边（对照） | `src/hub-session-host.ts:176-190`（β 工厂 adapterPort 同样 `dataGateOpen: () => true` dormant，注释「决策 5 dormant：宿主传输水位闸门休眠」）；`src/hub-session.ts:216-230`（session 核心 `sendData`：`closed` 门前置 → `dataGateOpen` 门前置 → `port.sendDataFrame`，α 组合根经真实 port 承接水位） | β 拆分形态 session 路径不经前置门（dormant）直入 `port.sendDataFrame` → `tryEmitDataFrame`（无暂停检查）⇒ 越界 0 → `send-failed` ns 级 resync（`update-channel.ts:440-446`）；α（listen 组合根）经真实闸门保留水位暂停 | β 登记差的现行机械；**前置门暂停项的实际咬合面只剩宿主直驱帧与 γ 桥**（都走 `egress.sendDataFrame`）——D1-翼(ii) 的影响面据此收窄（§10） |
| A9 | 两相记账与冲刷 | `src/update-channel.ts:447-461`（γ async 分支：tag 入 `pendingSends` 占窗）、`:440-446`（β 分支 0 ⇒ `send-failed`）、`:671-686` `abandonInFlight`、`:692-703` `teardown`（按未发送清算）、`:710-721`（合并占用判据 ackTimer） | T1 交付；P4 冲刷零泄漏已证 | 零改动（DENY）；AC3/AC7 锚的观察对象 |
| A10 | 生命周期信号 | `src/hub-session.ts:283-297`（close/terminateNamespace → 通道 quiesce）；`src/hub-namespace.ts:1241-1258`（幂等）；`src/hub-edge.ts:743-780`（drain；`:758-764` `closedFlag` 二道闸）、`:333-350`（GOAWAY `drainTimeoutMs=closeTimeoutMs`） | T1/既有机械；P5/P6 已证 | 零改动；AC4/AC5 锚的观察对象 |
| A11 | OPEN 准入水位 | `src/hub-edge-host.ts:187`（`MAX_PENDING_FRAMES_PER_CONNECTION=16`）、`:191`（`MAX_CONCURRENT_OPEN_ADMISSIONS=4`）、`:295/:331/:335/:379`（打穿 ⇒ `connectionFatal('CONNECTION_POLICY_VIOLATION', 1008)`）；`src/hub-upgrade-admission.ts:26` | 实现完整、白盒有锚（OAP-C4c/C4d/C5a/C5b：**1 OPEN + 15 缓冲帧**到 16 帧边界、4 并发 OPEN 到并发闸） | 零改动；AC6 只缺 γ 缝 + deferred resolver permutation（D7/F2，N4 措辞已正） |
| A12 | 观测码闭集合 | `src/observer.ts:48-53`（白名单 = 注册表键 ∪ 2 内部码）；`packages/replication-protocol/src/errors.ts:105`（`FRAME_TOO_LARGE` config/1009）、`:116`（`CONNECTION_BACKPRESSURE` yes/1011） | 两码均已在白名单与注册表 | AC2 收口码零扩展 |
| A13 | 缝夹具面 | `test/issue447-async-seam.ts`（FIFO 通道对/显式释放泵/扣留与 drop 旋钮/宿主桥 `:498-517`：`egress ≤ 0 ⇒ 不投回执`、`unsealed++`）；`test/issue448-live-seam.ts`（`bootLiveRound`） | γ 编排公共面；SA6 P1–P6 全部基于它 | F1/F2 的 append-only 扩展宿主（D6） |
| A14 | β 对照面与合成帧注入面 | `test/issue424-sharded-hub.ts` `makeShardedReplicationFacade`（β 公共装配）；`test/ws-replication-issue421-open-admission-pipeline.test.ts:250-330`（`acceptTrusted` + 本地 wire `inject` + deferred 工具 + 记录型 sink） | β 负控载体；OPENWP 白盒编排面 | `BPK-NC1` 载体；D7 复用注入模式 |
| A15 | `bufferedAmount` 测试先例 | `test/issue137-driver.ts:139-156` `applyPressure`（`Object.defineProperty(transport,'bufferedAmount',{get})`）；harness `makeWire`（`test/harness.ts:647-756`）无 `bufferedAmount` 面 | 可注入水位面有直接先例；缺省 harness 传输 = 账本零退休（永久慢对端等价，`readBufferedAmount` 缺面 → 0） | F1 旋钮的实现范式；`BPK-C1`（无面）与 `BPK-C4`（有面不 advance）两种压力形态的依据 |

---

## 3. 能力缺口（承接 SA6 §8，并按 F-1 补全边界）

**总判（修订）**：HEAD 的 γ 缝具备 T1 交付的**生命周期机械**（收口后丢弃、close 冲刷、revoke、drain）与 session 半边**乐观发送**，但缺「流控越界 → 连接级死亡」的 γ 语义，且缺口有**两处**：

根因链（SA6 §8 S1–S7 + 本版新增 S8）：

| 环节 | 事实 | 证据 |
|---|---|---|
| 症状 | γ 连接在慢对端/大突发下「帧消失但连接存活」；越界由 ackTimeout 兜底成 ns 级 resync | SA6 §5-P1：`outboundData=80 / wireUpdates=48 / unsealed=32`，`fatal=[]`，`RESYNC_REQUIRED=1` |
| 直接故障点① | `tryEmitDataFrame` 两条守卫失败动作只有 `return 0`（无连接级信号），且 0 在 γ 缝上不可观察（桥不投回执 ⇒ tag 停留 pending） | A1；`test/issue447-async-seam.ts:498-517` |
| 直接故障点②（S8，F-1） | egress 前置门含 `!port.dataGateOpen()` 暂停项：**有 `bufferedAmount` 证据的传输上**（γ 生产拓扑），水位 > `highWater` 即弹回 0——帧未达守卫、无 fatal、连接存活；慢性拥塞形态下 data 投影被钉在 `highWater`（缺省 512 KiB ≪ cap 8 MiB），「投影越界 ⇒ 1011」在该形态结构性不可达（SA2 SM-5/ER-5/需求覆盖 AC1·AC7 行） | A4/A5；`#447 设计 §9.1`（:488）原文自带限定「水位暂停路径在**无 `bufferedAmount` 传输上** dormant」——首版设计引用该行时丢弃了限定（F-1 证据） |
| 最深根因 | 拆分后 β 与 γ 共享 edge 字节路径（`tryEmitDataFrame` / `HostEdgeConnection.egress`），A4.3 要求的「γ=连接死亡 / β=ns resync」分叉点尚未建立；γ data 路径上 `dataGateOpen` 前置检查未按 A4.3 删除清单清理干净 | SA6 §15-1【核心裁定】交本设计；A7/A8 |
| 放大因素 | 无冲刷证据的 harness 传输使账本只增；单帧路径零诊断（observer 全静默） | SA6 §5-P1/P2 |

**排除项**（SA6 §11，维持）：H1–H8 均排除；特别地 H3（session 侧 send-failed 兜底可诊断）在 γ 不可达（tag 应答面），H4–H7（四腿机械）已由 P3–P6 证明。

---

## 4. Owner 要求落实

- 派工与 Host 简报双确认：**本 Issue 的 owner-comment REST snapshot 为空；简报 `## Comments` 亦空 ⇒ 无 owner 评论可映射**。需求全集 = Issue 正文 7 条 AC + ADR 0032 A4.3/A4.5 + 协议 §24.5/§24.7（SA6 §2 / SA2「Owner评论覆盖」同判）。

| Issue AC | 本设计落点 | 生产/测试定性 |
|---|---|---|
| AC1 账本溢出 → 1011 收口锚；逐帧拒纳/ns 级 resync 在 γ 不可达 | §7-D1（两翼）/D3/D5、§8；验收 `BPK-C1`（无证据传输）+ **`BPK-C4`（bufferedAmount 在场慢对端——生产拓扑 permutation，本版新增）** + `BPK-C2`（两形态合一断言）+ β 负控 `BPK-NC1` + 分叉负控 **`BPK-NC2`**（本版新增） | **生产改动（edge 分叉，两处）+ 新锚** |
| AC2 单帧超限 → 响亮收口 + 诊断（配置错误定性） | §7-D3（FRAME_TOO_LARGE/1009 零新码）；验收 `OVS-C1/NC1/NC2`（NC1 本版按 N2 校准） | **生产改动（同 D1-翼(i)）+ 新锚** |
| AC3 close 后丢弃锚 + close 冲刷 pending 无泄漏 | 零生产改动（A7/A9/A10 已交付）；验收 `DROP-C1/FLUSH-C1/FLUSH-C2` | **纯回归哨兵锚** |
| AC4 `terminateUnauthorized` 不溯及已推帧锚 | 零生产改动；验收 `REVOKE-C1/NC1` | **纯回归哨兵锚** |
| AC5 `settled` 晚到 drain 锚；`closeTimeoutMs` 不变 | 零生产改动；验收 `DRAIN-C1/NC1` | **纯回归哨兵锚** |
| AC6 OPEN 水位延迟复核（原值不误收口；打穿响亮收口） | 零生产改动 + 夹具 F2（deferred resolver）；验收 `OPENWP-C1/C2`（D7 编排按 N4 正措辞：16 帧形态 = 1 OPEN + 15 缓冲帧） | **夹具扩展 + γ permutation 锚** |
| AC7 内存安全链锚（逐跳有界；死亡释放） | AC1 分叉（两翼）使「死亡释放」在**一切传输形态**成立；验收 `MEM-C1/C2/NC1`（含 F1 及时消费对照；C2 可选计数直锚见 N6） | **生产改动（同 AC1）+ 新锚** |

---

## 5. 复现和根因承接

| 上游事实（SA6） | 证据位置 | 设计响应 |
|---|---|---|
| P1 账本越界（cap=4KiB + 300 笔 + 泵；无 `bufferedAmount` 面）⇒ 32/80 帧静默拒纳、连接存活、ackTimeout 后 ns 级 `RESYNC_REQUIRED×1` | `artifacts/sa6-issue450-probe.log`（3/3 确定性） | §7-D1-翼(i)：越界守卫失败动作改为 γ 连接终局（1011）——`BPK-C1` 红→绿 |
| P2 单帧超限（cap=16KiB + 20480B 直驱）⇒ `egressReturn=0`、零 ERROR/零 observer/零 close | 同上 | §7-D3：oversize 守卫失败动作改为 `FRAME_TOO_LARGE` 收口（1009）——`OVS-C1` 红→绿 |
| P3 收口后 session→edge 后到帧零盖章/零回执/零字节 | 同上（绿） | 零改动；`DROP-C1` 回归哨兵 |
| P4 close 冲刷 pending（在管+队内）零 ack-timeout 声明 | 同上（绿） | 零改动；`FLUSH-C1` + `FLUSH-C2` 负控 |
| P5 revoke 不溯及；P6 settled 未达 drain + `closeTimeoutMs` 逃生舱 | 同上（绿） | 零改动；`REVOKE-C1/NC1`、`DRAIN-C1/NC1` |
| §8 根因链 S1–S7 | SA6 契约 | §3 承接；S8（前置门先制）为本版按 F-1 补全 |
| §12.2 契约清单（BPK/OVS/DROP/FLUSH/REVOKE/DRAIN/OPENWP/MEM） | SA6 契约 | §12 逐条落点；本版新增 `BPK-C4`/`BPK-NC2` 并校准 `OVS-NC1`（N2） |
| §12.1 F1–F4 夹具需求 + §15-3 裁定 | SA6 契约 | §7-D6 定案；F1 职责扩展为「双压力形态」（无面 / 有面不 advance）+「及时消费对照」 |
| §14 采集面（新测试文件逐字命中根 vitest glob） | SA6 契约 | §12 规划路径沿用（`ws-replication-issue450-flow-lifecycle.test.ts`） |

---

## 6. SA8 约束落实

#450 无前置 SA8 决议产物（`relevant_decisions`/`conflict_report` 缺席）；**设计后冲突门报告已在 iteration 0 后产出**（`wiki/raw/task_issue-450_design_conflict_report.md`，verdict `clear`、无 override、无 hard-conflict、R1–R6 实现期核对义务）。该报告审阅对象为首版设计（守卫单点分叉）；本版把分叉延伸至 egress 前置门（F-1 裁定），属其 #1（A4.3 implements-existing-decision）同一义务的**加深**而非改向，并把一个规范解释问题专递冲突门（§16）。逐条落实：

| 决议或义务 | 出处 | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|---|
| 缝词汇闭集合（§24.3）：无拒纳/闸门/信用词汇；`connection-fatal{code}` 既有、code→close code 映射单点留 edge | A4.1/A4.6、§24.3 | §7-D1/D4 | 零新增缝消息；γ 收口经 edge 既有 `connectionFatal`（映射仍单点）；前置门分叉是 edge 内部行为，不上缝 | 否 |
| 流控单点 = edge；账本投影越界 ⇒ 1011 收口整条连接；单帧超限 = 配置错误 ⇒ 响亮收口 + 诊断；**无逐帧拒纳/deferred/ns 级 send-failed resync** | A4.3、§24.5 | §7-D1（两翼）/D3/D5、§8 | 守卫失败动作 = 连接终局（翼 i）+ **前置门暂停项在 γ 下移除（翼 ii）**——两翼合并后「无逐帧拒纳」在 γ data 路径无例外成立（有/无 `bufferedAmount` 传输一致） | **是**（§16 规范解释问题：A4.3 删除清单是否覆盖 edge egress 前置门——本设计按「覆盖」读法推进，SA8 确认/否决） |
| A4.3「session 乐观发送，删除 `dataGateOpen`/`connectionState`/`bufferedAmount` 前置检查」 | A4.3 :77-79 | §7-D1.5 | session 半边已由 T1 落地（A7）；本票清理 γ data 路径残留的最后一个前置检查（A4 前置门暂停项；`closed` 项保留 = A4.5 收口后丢弃规则的机械，非流控前置检查） | **是**（同上，§16） |
| β/γ 显式行为差登记：β data 溢出 = ns 级 `send-failed` resync、连接存活；β 行为不变 | A4.3、§24.5 | §7-D1/D2（缺省零传 ⇒ α/β 逐字节不变，含前置门次序）、§12 `BPK-NC1/NC2` | 可选钩子+前置门分叉全部 γ 门控；`BPK-NC1`（β 语义）与 `BPK-NC2`（缺省装配前置门仍弹回）双负控 | 是（公共面 append，§15） |
| 生命周期单规则（A4.5/§24.7） | A4.5、§24.7 | §7-D6-保留、§12 锚 | 既有机械（A7/A9/A10）；新收口触发点汇入同一 close 拓扑 ⇒ 四腿语义自动适用于 1011/1009 收口 | 否 |
| OPEN/pending 水位 = 故障参数：打穿 = 响亮收口，不作流控调参 | A4.3、§24.5 | §7-D7、§12 `OPENWP-C1/C2` | 原值（16/4）不动；γ permutation 仅补锚（N4 措辞修正） | 否 |
| 内存安全链逐跳有界；慢连接最坏账 = `maxQueuedBytesPerConnection` + `maxQueuedControlBytes` 后**连接死亡释放** | §24.5 :1137 | §7-D1、§9.4、§12 `MEM-C1/C2/NC1` | 翼(ii) 使「死亡兑现」在有证据传输上可达（首版论证缺口，F-1）；上界论证：严格大于判据 ⇒ 已放行 ≤ cap，收口 ERROR 直发零记账（`backpressure.ts:208-209` tornDown 早退） | 否（结论强化，无新义务） |
| §4/§17 水位条目（:587「socket 缓冲不可撤回，由水位暂停与 1011 承接」；:589「> high-water 暂停 dequeue，降至 low-water 恢复」「缺面视为 0……数据总量仍受准入与 1011 收口」；:600 链式不变量） | 协议 §4/§17、`validate.ts` | §7-D1.5（取舍登记） | 水位暂停机械**原样保留**（α 组合根、β/γ control 额度、缺省装配前置门）；仅 γ 装配的 data 前置门项让位于账本终局判死；链式校验 `low < high ≤ cap` 零改动（对 γ 仍约束 control 侧与配置合法性） | **是**（§16：水位条目与 §24.5「无逐帧拒纳」在 γ data 路径的优先级解释） |
| A4.8 验收纪律（延迟可注入显式异步内存管道、零 worker_threads/真实 timer、既有矩阵全绿硬门） | A4.8 | §7-D6、§12 | 全部夹具 = #447 通道对 + 显式释放 + 虚拟调度器；成功路径等价由既有 parity 族 + 缺省零传背书 | 否 |
| 公共面 append-only（后果 :112）；`connection-fatal` 公共化不新增错误码 | ADR 0032 后果节 | §7-D2/D3、§8 | 唯一公共面变化 = `HubReplicationEdgeOptions` 可选成员 append；前置门分叉为内部行为（无类型面变化）；错误码取既有 `FRAME_TOO_LARGE` | **是**（SA8 报告 #6 已裁 no-conflict；本版无新增公共面，维持申报） |
| SA8 设计冲突报告 R1–R6 实现期义务（append 核对 / 分叉机械核对 / 冻结面核对 / 规范零改动核对 / **R5 AGENTS.md 方向性登记句** / R6 #449 边界） | `task_issue-450_design_conflict_report.md` §8 | §7-D8、§11、§12.2 | R5 落实于 D8 登记句（本版按 N3 补**双向**误用面）；R1–R4/R6 纳入 §12.2 验证门与 §11 范围 | 否（实现期核对，归属不变） |

---

## 7. 设计决策与主要备选方案

### D1【核心】β/γ 分叉 = **两翼**，同一装配标记门控（SA6 §15-1 裁定落定 + F-1 修订）

γ 装配（edge 工厂 option `asyncDataAdmissionFatal: true`，D2）下：

- **翼(i) 守卫失败动作**（首版已有）：`ConnectionSenderHost` append-only 可选成员 `onDataFrameAdmissionFatal?: (reason: 'ledger-overflow' | 'oversize') => void`；`tryEmitDataFrame` 两条守卫在 `return 0` 前同步调用该钩子。守卫本身、判定次序（oversize 先）、严格大于判据、投影口径零变化——变化的只有失败动作。
- **翼(ii) egress 前置门暂停项移除**（**本版新增，F-1 裁定**）：`HostEdgeConnection.egress.sendDataFrame` 的前置门在 γ 装配下**仅保留 `connectionState()==='closed'` 项**，`!port.dataGateOpen()` 暂停项不参与判定——γ data 帧**恒达** `port.sendDataFrame → tryEmitDataFrame` 守卫；账本投影含 `observe()`（socket `bufferedAmount`，缺面 → 0）自行判死。标记缺席（α/β/缺省）⇒ 前置门「closed ∨ ¬gate」次序**逐字保留**（`hub-session.ts:216-230` 等价镜像不动）。
- **设置链（γ 装配唯一来源）**：公共工厂 option（D2）→ `HubReplicationEdgeFactoryImpl.allocate` 双落点转发：(a) 内部 `HubReplicationEdgeConfig.asyncDataAdmissionFatal` → `HubReplicationEdgeImpl` 构造器条件挂接钩子（reason→码映射 D3）；(b) `new HostEdgeConnection(edge, adapter, pausePreGate)` 的 `pausePreGate = (options.asyncDataAdmissionFatal !== true)` → egress 装配闭包（§8.1-⑥）。α 组合根（`hub-connection.ts:331-352`）与 peer（`peer-connection.ts:373-384`）不传 ⇒ 新分支结构性不可达。
- **两翼缺一不可**（F-1 的教训）：只做翼(i) 时，有 `bufferedAmount` 传输上暂停项先制守卫，1011 data 分叉不可达（§3-S8）；只做翼(ii) 时，帧虽达守卫但失败仍是静默 0。两翼合并后 γ data 路径的失败语义唯一：**连接终局**。
- **否决备选**：
  - **(a) 宿主桥判 0 合成收口**：违反 F4（收口必须 edge 发起、桥零协议决策）；0 值无因判别。否决。
  - **(b) γ 专用 egress 面或第二份 ConnectionSender**：fork 协议状态机（ADR 0032 决策 1「单份实现」）。否决。
  - **(c) 改 `tryEmitDataFrame` 返回 reason 联合类型**：内部签名面破坏，收益不高于可选钩子。否决。
  - **(d) γ session 半边自检 fatal**：破坏流控单点（A4.3）；session 无账本事实。否决。
  - **(e)（F-1 备选 B）维持守卫单点分叉 + 文本登记暂停边界**：在暴露 `bufferedAmount` 的生产传输上（γ 生产拓扑的 ws socket，协议 :589「生产 Adapter 必须暴露三面」）慢性压力形态 = 逐帧弹回 + ns 级 resync + 连接存活——与 §24.5「无逐帧拒纳、无 ns 级 send-failed resync」「γ = 连接级死亡」的可观察承诺直接冲突，且使「最坏账 = cap + control 后死亡释放」的兑现机制不可达。文本登记不能修复规范冲突。**否决（保留为 SA8 裁定相反时的降级路径，§13-R9）**。
  - **(f)（第三形态）暂停边沿在 γ 下也 fatal（highWater ⇒ 死）**：把「可恢复暂停阈值」当终止阈值——`validate.ts` 链式注释明文 `highWater` 为**可恢复**阈值、`cap` 为终止 1011 阈值；例行突发（如 2 MiB sync diff 越过缺省 512 KiB highWater）即杀死连接，语义漂移为 flappy。A4.3 删除清单的动词是「删除前置检查」而非「fatal 化」。否决。
- **与 #447 设计 §9.1 的衔接（修正后的准确表述）**：#447 §9.1（:488）登记「γ 装配下 egress 的 0 仅来自单帧超限（→响亮收口）或账本越界（→1011 连接级死亡）」为目标形态，其自附限定「水位暂停路径在**无 `bufferedAmount` 传输上** dormant」暴露了该目标形态在首版分叉下**只在无证据传输上成立**。本设计两翼落地后，该句的限制性从句对 γ data 帧失效——0 值在 γ 下**无条件**仅来自：oversize 守卫（fatal 已发起）/ ledger-overflow 守卫（fatal 已发起）/ 前置 `closed` 闸（收口后丢弃域，DROP-C1）——三种形态全部伴随连接已收口（§8.1 doc append 与 §10 同步改写）。

### D1.5【F-1 裁定书】前置门暂停项为何必须让位于账本判死（取舍与规范依据）

**取舍**：γ 装配下，瞬时/慢性 socket 压力**不再经暂停闸缓冲**（不再在 `highWater` 处弹回等待 `lowWater` 恢复），data 帧持续放行使 socket 账目向 `cap` 逼近，投影越界即 1011 死亡。每慢连接的 socket 侧最坏驻留从 ≈`highWater`（+暂停循环）变为 ≤`cap`——这正是 §24.5 登记的最坏账形态（`maxQueuedBytesPerConnection` + `maxQueuedControlBytes` 后**连接死亡释放**）；暂停形态驻留更低但连接**永不死亡**、以 ns 级 resync churn 长存，恰是 γ 定义所反对的 β 形态（A4.3「用恢复粒度换内存安全的单点可论证性」）。

**规范依据**（四点，详式见 §16）：

1. A4.3 明文删除清单点名 `dataGateOpen`（「session 乐观发送，删除 `dataGateOpen`/`connectionState`/`bufferedAmount` 前置检查」）；γ data 路径上该前置检查仅残存于 egress 前置门（A7/A8 证实 session 半边已 dormant）。
2. §24.5 禁止清单「无逐帧拒纳、无 deferred、无 ns 级 send-failed resync」三项 = 暂停项在 `bufferedAmount` 传输上的**逐项可观察产物**（0 弹回 / tag pending 占窗 deferred / ackTimeout ns 级 resync 存活）。
3. §24.5 内存链「edge 账本 → 越界即死；慢连接出站最坏账 = cap + control 后死亡释放」以死亡为释放机制，前置门使该机制在慢性形态不可达。
4. 协议 :589「缺面视为 0——背压水位退化为不可观察，**数据总量仍受准入与 1011 收口**」确立 1011 为数据总量终局界，水位为可观察性/pacing 优化。

**保留面**（水位机械不动）：α 组合根的真实闸门（`hub-session.ts:226` 经真实 port）；β/γ **control** 侧额度（`sendControl`/`sendControlFrame` 自带 `observeWater`，暂停态 control 记账与其 1011 耗尽收口原样）；缺省装配的 egress 前置门（β 直驱宿主）；`send-paused`/`send-resumed` observer 事件（经 control 发送与 poll 的 `observeWater` 边沿照常发射，语义 = 水位事实，非接纳决策）；`validate.ts` 链式校验。γ 下 `dataGateOpen()` 在 egress 不再被调用 ⇒ 暂停边沿的观察点收敛到 control 发送与 poll——control 帧（ACK/GOAWAY/ERROR）持续在场，观察节奏有保障；纯出站无 control 的极端形态下暂停状态不进入，但 data 死亡判据不依赖 `paused`（投影独立判死），control 额度耗尽路径的 `observeWater` 自观察不变（`sendControlFrame` 入口自带）。

### D2 分叉语义键 = 装配形态标记（工厂级 option），非逐帧策略；命名 `asyncDataAdmissionFatal?: true`

- **形态**：`HubReplicationEdgeOptions`（公共、冻结面 append-only 演进）可选成员，缺省缺位。不接受 per-connection/per-call 覆盖、不接受运行时切换——γ/β 是装配期事实（与 `listen: false` 精确值、`asyncSendTickets` 单点置位同款纪律）。
- **命名裁定**：`asyncDataAdmissionFatal`（行为命名：async 缝形态下 data admission 越界 = 连接终局）。否决 `asyncSessionSeam`（形态命名易误读为 session 侧知识）、`fatalDataAdmission`（语序不达 γ 限定）。
- **误用面登记（双向，N3 修订）**：(i) 标记加到 β 同步装配 ⇒ 该连接 data 越界连接死亡而非 ns 级 resync；(ii) **γ 异步缝装配漏置标记 ⇒ 该连接静默保留 β 语义（本票要消灭的形态）且零诊断**——方向 (ii) 更隐蔽，以 option doc + AGENTS.md 登记句的**方向性义务**（「γ 装配 ⇒ 应置位」，SA8 报告 R5）+ `BPK-NC2`（漏置位形态的可执行负控）双锚。工厂无法感知 sink 形态（`HubSessionSinkResolver` 对 β/γ 同一契约，`hub-edge-host.ts:110-114`），不做运行时 policing（装配期知识纪律）。

### D3 收口码与诊断（SA6 §15-2 裁定落定，零新码零新事件型）

| reason | wire ERROR 码 | WS close code | observer | 定性依据 |
|---|---|---|---|---|
| `'ledger-overflow'`（账本投影越界 = 慢性拥塞） | `CONNECTION_BACKPRESSURE` | **1011** | `connection-failed{code:'CONNECTION_BACKPRESSURE', wsCloseCode:1011}` 恰一 | A4.3「连接账本投影越界即 CONNECTION_BACKPRESSURE(1011) 收口整条连接」；与 control 额度耗尽同码同拓扑（A2 既有单点） |
| `'oversize'`（单帧 > cap，与拥塞无关） | `FRAME_TOO_LARGE` | **1009**（`wsCloseCodeFor` 既有映射） | `connection-failed{code:'FRAME_TOO_LARGE', wsCloseCode:1009}` 恰一 | 注册表 `retryable:'config'` = 「配置错误定性」逐字；零新码（A12） |

映射单点放 edge（`hub-edge.ts` 装配处）；判定次序保持 oversize 先（既有次序已给出「与拥塞无关」分类，不动）。

### D4 收口执行 = 既有 `connectionFatal` 单点（零新拓扑）

钩子回调即 `connectionFatal`：清 drain 句柄 → `sender.teardown()` → ERROR 直发（豁免额度、绕过 sender）→ `closedFlag`/`setConnState('closed')` → `requestSinkClose()`（同步 quiesce 前缀）→ `transport.close(wsCloseCode,'protocol-error')` → `connection-failed` observer → `cleanupAll`。幂等由 `closedFlag` 承载。收口后丢弃/close 冲刷/revoke/drain 四腿机械（A7/A9/A10）自动适用于新触发点。

### D5 AC3/AC4/AC5：零生产改动，纯回归哨兵锚

P3–P6 运行时已证绿（§5）；session 侧文件全部 DENY。锚策略见 §12（`DROP/FLUSH/REVOKE/DRAIN` 族）。

### D6 夹具 F1–F4 定案（SA6 §12.1/§15-3 裁定；F1 职责本版扩展）

- **F1 慢对端/账本压力旋钮（双压力形态 + 及时消费对照）**：`issue450-flow-seam.ts` 新夹具在 `createHub` 返回的 `replication.accept/acceptTrusted` 外包一层——对进场 hub 侧 transport 施加 `Object.defineProperty(transport, 'bufferedAmount', { get })`（#137 `applyPressure` 先例，A15），暴露 `{ level(): number; advance(n: number): void }` 控制面：水位上界 = `transport.send` 累计字节数，`advance(n)` 显式制造冲刷证据（对端消费 ⇒ 水位下降 ⇒ `observe()` 退休 ⇒ 账本回落）。三种编排形态：**(α) 无面**（缺省不定义属性 = dormant）⇒ 账本零退休 = 永久慢对端等价（`BPK-C1`，夹具头注登记该等价性——SA6 F1 最小替代的正式登记）；**(β) 有面不 advance** ⇒ 水位只增 = **生产拓扑慢对端等价**（`BPK-C4`——F-1 修订后新增的关键形态：证明暂停门移除后该形态也以 1011 死亡收口）；**(γ) 持续 advance** ⇒ 及时消费 ⇒ 零越界零死亡（`BPK-C3`/`MEM-NC1`）。
- **F2 deferred sink 解析旋钮**：`issue447-async-seam.ts` 的 `AsyncFacadeOptions` append-only 增 `deferSinkResolve?: boolean`（缺省 false = #447 行为逐字不变）；置位时 `resolveSessionSink` 返回挂起 promise 并登记到闸门，`AsyncSeamHost` 暴露 `resolveSink(namespaceId)` / `pendingSinks()` 显式 resolve 泵——AC6「跨线程延迟」注入面。
- **F3 单帧超限载荷面（SA6 二选一 → 定案：公共 egress 宿主直驱面）**：`OVS-C1` 经 `HubReplicationEdgeEgress.sendDataFrame`（ADR 0032 决策 5 登记面；SA6 P2 先例）注入。载荷 = **确定性合法 UPDATE 占位帧构造器**（`makeLargeUpdateFrame(namespaceId, minFrameBytes)`：scratch `Y.Doc`（`clientID` 钉死）→ `Y.encodeStateAsUpdate` → `encodeMessage({kind:'UPDATE',…},{sequence:0,…})`，帧长 ≥ minFrameBytes 且 codec 合法）——负控需要该帧可真实出站且对端可无害消费。**session 组装路径覆盖论证**：`port.sendDataFrame` 单漏斗（A6）覆盖 session 组装 + 分块族 + 直驱，守卫共享；「经 `writeHub` 产生 >cap UPDATE」受 ROOT schema 限制不另建宽松 schema 夹具（越界：域测试基建，非本票）。
- **F4 桥纪律不变**：#447 桥只做中继 + 回执条款（`egress ≤ 0 ⇒ 不投回执`）；收口一律 edge 发起，夹具不得在宿主侧合成 1011/1009/错误码——登记于 #450 夹具头注。
- **组装复用**：`issue450-flow-seam.ts` 提供 `bootFlowRound(opts)`（镜像 `bootLiveRound` 形状 + `makeAsyncReplicationFacade` 增量 options + F1 accept 装饰），不改 `issue448-live-seam.ts`。

### D7 OPENWP γ permutation 编排（AC6；N4 措辞修正）

复用 #421 合成帧面（A14）× γ 装配：白盒编排 = `makeAsyncReplicationFacade({ asyncDataAdmissionFatal: true, deferSinkResolve: true, … })` + 本地 wire（`makeWire` + 注入端包装，同 #421 `inject` 模式）+ `acceptTrusted` → 注入 HELLO → 两种到界形态：**(i) 并发 OPEN 闸**：注入 4 个不同 ns 的 OPEN（经 F2 deferred resolver 挂起解析）→ 恰 4 并发零收口；第 5 个 ⇒ 恰一 `ERROR{CONNECTION_POLICY_VIOLATION}` + close 1008 + quiesce；**(ii) pending 帧闸（16）**：**1 个 OPEN + 15 个缓冲早期帧**（OAP-C4c/C4d 实际模式，`ws-replication-issue421-open-admission-pipeline.test.ts:607-622`）——「注入 N 个不同 ns 的 OPEN」到不了 16 帧边界（第 5 个 OPEN 先撞 4 并发闸），16 帧形态必须用单 OPEN + 缓冲帧注入。断言键 = wire 帧/close info/observer/`closeCalls`（与 OAP-C4c/C4d/C5a/C5b 同判据，换 γ 缝 + 真延迟 permutation）。

### D8 规范文档：零改动（实现追平规范）；模块 AGENTS.md append-only 登记（含 SA8-R5 方向性义务与 N3 双向误用）

`docs/protocols/instance-replication-v1.md` §24.5/§24.7、ADR 0032 A4.3/A4.5、`CONTEXT.md` SessionHost 条目已是目标语义——本票使实现与规范一致，规范文本零改动（§16 的解释问题若 SA8 裁定与本题取读法相反，按其结论另行处理）。`packages/ws-replication/AGENTS.md` 缝纪律条款（:17）append-only 补一句：**「γ 异步缝装配（`createHubAsyncSessionHost` 桥）⇒ 应在 edge 工厂置位 `asyncDataAdmissionFatal: true`（方向性义务：漏置位 = 该连接退回 β 语义且零诊断；误加于 β 装配 = data 越界由 ns resync 变连接死亡）；置位后 data admission 越界 = 连接终局（账本投影越界 → CONNECTION_BACKPRESSURE 1011；单帧超限 → FRAME_TOO_LARGE 1009），且 egress 前置门仅保留 closed 项（水位暂停不再拦截 γ data 帧，A4.3/§24.5）；缺省 α/β 语义不变。」**

### D9 类型面 append 与类型锚

`HubReplicationEdgeOptions` 新可选成员自动经 `src/index.ts:90` 类型再导出流动（index.ts 零改动）；`ws-replication-issue421-edge-factory-api.test-d.ts` append-only 增成员类型行（`expectTypeOf<HubReplicationEdgeOptions['asyncDataAdmissionFatal']>().toEqualTypeOf<true | undefined>()`）并把头注「九成员」措辞更新为十成员（既有断言全保留）。前置门分叉无公共类型面（`HostEdgeConnection` 为内部类）。生产内部类型（`ConnectionSenderHost` **13 成员**（`backpressure.ts:43-69`，N1 订正）/`HubReplicationEdgeConfig`）append-only 可选成员，peer host 零改动。

---

## 8. 接口、状态机和数据流

### 8.1 生产接口变化（全部 append-only / 内部行为分叉）

```ts
// ① packages/ws-replication/src/backpressure.ts —— ConnectionSenderHost append-only
export interface ConnectionSenderHost {
  // …既有 13 成员零变化（limits/timer/ackTimeoutMs/readBufferedAmount/emitControl/emitData/
  //   emitControlFrame?/emitDataFrame?/facetOf/isEmitAllowed/onBackpressureExhausted/
  //   onSendPaused?/onSendResumed?）…
  /** issue #450（ADR 0032 A4.3 / 协议 §24.5，γ 异步缝行为差）：字节形态 data admission
   *  越界的连接终局分叉点。可选成员；缺席（α/β/peer）⇒ 两条守卫维持「return 0」既有
   *  语义（β：ns 级 send-failed resync、连接存活——登记差不动）。在场（γ 装配，唯一
   *  设置链 = edge 工厂 asyncDataAdmissionFatal）⇒ 守卫触发时同步回调后仍返回 0
   *  （连接已在回调内收口，0 值不再独立承载语义）：
   *  - 'ledger-overflow'：连接账本投影越界（慢性拥塞）→ CONNECTION_BACKPRESSURE(1011)；
   *  - 'oversize'：单帧超连接级上限（与拥塞无关的配置错误）→ FRAME_TOO_LARGE(1009)。 */
  onDataFrameAdmissionFatal?: (reason: 'ledger-overflow' | 'oversize') => void;
}

// ② tryEmitDataFrame（翼(i)：守卫失败动作分叉；判定次序/判据/投影口径逐字不变）
tryEmitDataFrame(frame: Uint8Array): number {
  const frameBytes = frame.byteLength;
  if (frameBytes > this.host.limits.maxQueuedBytesPerConnection) {
    this.host.onDataFrameAdmissionFatal?.('oversize');       // ← 唯一新增行
    return 0;
  }
  const projected =
    this.observe() + this.pendingDataHandoff + this.controlPendingHandoff
    + this.totalQueuedBytes() + frameBytes;
  if (projected > this.host.limits.maxQueuedBytesPerConnection) {
    this.host.onDataFrameAdmissionFatal?.('ledger-overflow'); // ← 唯一新增行
    return 0;
  }
  return this.emitDataFrameBytes(frame);
}

// ③ packages/ws-replication/src/hub-edge.ts —— HubReplicationEdgeConfig append-only
export interface HubReplicationEdgeConfig {
  // …既有成员零变化…
  /** issue #450：γ 异步缝装配标记（唯一设置点 = 公共工厂 option 转发）。在场 ⇒ 本连接
   *  data admission 越界 = 连接终局（A4.3）；缺席 ⇒ α/β 既有语义。 */
  readonly asyncDataAdmissionFatal?: true;
}

// ④ hub-edge.ts 构造器 sender host 装配（条件挂接；reason→码映射单点在 edge）
this.sender = new ConnectionSender({
  // …既有 13 项零变化…
  onBackpressureExhausted: () => this.connectionFatal('CONNECTION_BACKPRESSURE', 1011),
  ...(config.asyncDataAdmissionFatal === true
    ? {
        onDataFrameAdmissionFatal: (reason: 'ledger-overflow' | 'oversize') =>
          reason === 'oversize'
            ? this.connectionFatal('FRAME_TOO_LARGE', wsCloseCodeFor('FRAME_TOO_LARGE')) // 1009
            : this.connectionFatal('CONNECTION_BACKPRESSURE', 1011),
      }
    : {}),
  // …其余零变化…
});

// ⑤ packages/ws-replication/src/hub-edge-host.ts —— 公共 option append-only
export interface HubReplicationEdgeOptions {
  // …既有九成员零变化…
  /** issue #450（ADR 0032 A4.3 / 协议 §24.5）：γ 异步缝装配标记（宿主以 γ 桥装配
   *  `createHubAsyncSessionHost` 时**应置位**——漏置位 = 该连接退回 β 语义且零诊断；
   *  误加于 β 同步装配 = data 越界由 ns 级 resync 变连接死亡）。在场 = 本工厂分配连接的
   *  data 帧连接级 admission 越界按 γ 语义收口整条连接（账本投影越界 →
   *  CONNECTION_BACKPRESSURE 1011；单帧超上限 → FRAME_TOO_LARGE 1009），无逐帧拒纳，
   *  且 egress 前置门仅保留 closed 项（水位暂停不再拦截 γ data 帧）；缺席（缺省）=
   *  α/β 既有语义逐字不变。 */
  readonly asyncDataAdmissionFatal?: true;
}

// ⑥ hub-edge-host.ts —— HostEdgeConnection egress 装配（翼(ii)：前置门 γ 分叉，F-1）
class HostEdgeConnection {
  constructor(
    private readonly edge: HubReplicationEdge,
    private readonly adapter: HostSessionAdapter,
    /** γ 装配 ⇒ false：前置门仅保留 closed 项（A4.3 删除 dataGateOpen 前置检查）。
     *  缺省 ⇒ true：门前置 → 守卫 → 账本次序逐字保留（hub-session.ts:216-230 镜像）。 */
    pausePreGate: boolean,
  ) {
    const port = adapter.port;
    this.egress = {
      sendControlFrame: (frame) => port.sendControlFrame(frame),
      sendDataFrame: (frame) =>
        port.connectionState() === 'closed' || (pausePreGate && !port.dataGateOpen())
          ? 0
          : port.sendDataFrame(frame),
      // …其余四成员零变化…
    };
  }
}
// HubReplicationEdgeFactoryImpl.allocate 双落点转发：
//   const edge = createEdgeConnection({ …,
//     ...(this.options.asyncDataAdmissionFatal === true ? { asyncDataAdmissionFatal: true as const } : {}) });
//   return new HostEdgeConnection(edge, created, this.options.asyncDataAdmissionFatal !== true);
```

**Doc append（公共面 0 值语义，修正后的真陈述）**：`HubReplicationEdgeEgress.sendDataFrame` 注释补——γ 装配（`asyncDataAdmissionFatal`）下 data 帧返回 0 **⟺ 连接已收口**：oversize / ledger-overflow 守卫触发 ⇒ fatal 已在同一同步段由 edge 发起（FRAME_TOO_LARGE/1009 或 CONNECTION_BACKPRESSURE/1011）；或前置 `closed` 闸 ⇒ 收口后丢弃域。**水位暂停不再是 γ data 帧的 0 值来源**（前置门暂停项在该装配下移除；`send-paused`/`send-resumed` 仍作为水位事实事件照常发射）。缺省装配下 0 值语义不变（`0 = 拒纳`：closed 闸 / 水位暂停弹回 / 守卫静默拒纳）。`backpressure.ts` 模块头注 append issue #450 一句。

### 8.2 状态机（连接级，触发点新增、拓扑零新增；SM-5 形态改判）

```
ready ──(data admission 守卫命中 ∧ asyncDataAdmissionFatal)──► connectionFatal(reason→code)
        │                                                       ├─ sender.teardown()（账本/轮/poll 清零）
        │                                                       ├─ ERROR{code} 直发（豁免额度；tornDown ⇒ onEmitted 零记账）
        │                                                       ├─ closedFlag = true; state → 'closed'
        │                                                       ├─ requestSinkClose() → HostSessionAdapter.close()
        │                                                       │      └─ sink.onConnectionClosed() → 桥沿同道 FIFO 入队 'close'
        │                                                       │             └─ session handle.close()：unresolvedTags.clear() + 通道 quiesce
        │                                                       │                    + UpdateChannel.teardown()（pendingSends/inFlight/queued 清零）
        │                                                       ├─ transport.close(1011 | 1009, 'protocol-error')
        │                                                       └─ connection-failed observer 恰一 → cleanupAll
        ├──(水位 > highWater，γ)──► 【不再拦截 data 帧】（前置门暂停项移除；暂停状态机照常运行，
        │                                 仅作用于 control 额度记账；data 由上分支在 projected > cap 时判死）
        └──(control 额度耗尽 / 协议 fatal / GOAWAY deadline / …)──► 既有五路（零变化）
```

- **SM-5 改判（F-1 修订核心）**：ready + 慢对端 + `bufferedAmount` 在场且增长——修订前（首版设计保留的前置门）：`> highWater` ⇒ 前置门 0 弹回、帧未达守卫、无 fatal、ackTimeout ns 级 resync 存活（β 形态泄漏进 γ）；修订后：帧恒达守卫，投影（含 `observe()`）随 socket 账目增长，`> cap` ⇒ 恰一 1011 收口（`BPK-C4` 锚）。多帧连撞/重复触发由 `closedFlag` 幂等收敛恰一收口（SM-2 不变）。
- 其余攻击面结论维持 SA2 评审：SM-1（守卫栈内同步 fatal 重入安全：回调后仅 `return 0` 不读 sender 状态）、SM-3（fatal 后 ackTimer 先火 ⇒ resync 帧经已关 transport 零 wire 字节）、SM-4（`settled` 晚达 `closedFlag` 二道闸）、SM-6（OPEN 水位既有台账）、SM-7（`advance` 退休回落）全部由既有机械承接，无设计缺口。

### 8.3 数据流路线（改变面 = hub 出站 data 帧的 γ admission 终局分支，含前置门）

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| R1 γ data 帧正常放行 | hub 写 → 通道 deliver → selfDrain pull → `sendAndRegister` | `pendingSends.set(tag)`（占窗） | `emitSeam`：tag + `frame{tag,bytes,'data'}` 入 session→edge FIFO | 显式 release 内存通道（宿主桥） | 桥 → `egress.sendDataFrame` →（γ：前置门仅 closed 项）→ `tryEmitDataFrame` 守卫 | 放行 ⇒ `emitOne` 盖章 → wire 字节 + `onEmitted` 账本 + `receipt{tag,sequence}` → rekey → ACK 结算 | 守卫命中 ⇒ R2/R3 | `BPK-C3`/`OVS-NC1/NC2` |
| R2 γ 账本投影越界（新；**双形态**） | 同 R1，但 `projected > cap`——形态 A：无 `bufferedAmount` 面 ⇒ handoff 只增（P1 机制）；形态 B：有面不 advance ⇒ `observe()` 随 socket 账目增长越过 cap（生产拓扑慢对端，SM-5 修订） | 无新写点（失败动作） | 守卫 → `onDataFrameAdmissionFatal('ledger-overflow')` → `connectionFatal`（§8.2 拓扑） | wire：`ERROR{CONNECTION_BACKPRESSURE}` 恰一 + `transport.close(1011)`；缝：`'close'` 同道 FIFO | peer（ERROR+close）；observer `connection-failed` 恰一；session `closeCalls=1` + pending 冲刷 | 连接死亡；账本随 teardown 清零；最坏账 ≤ cap + maxQueuedControlBytes | 收口后 session→edge 后到一切静默丢弃（既有）；迟到回执终态门静默 | 形态 A `BPK-C1`；形态 B **`BPK-C4`**；`MEM-C1/C2` |
| R3 γ 单帧超限（新） | 宿主直驱 `egress.sendDataFrame(bigFrame)`（或任意 >cap data 帧——单漏斗） | 无新写点 | 守卫 → `('oversize')` → `connectionFatal('FRAME_TOO_LARGE', 1009)` | wire：`ERROR{FRAME_TOO_LARGE}` + `close(1009)`；observer 恰一 | 同 R2 | 配置错误定性响亮收口；`update-sent` 零发射（`sequence>0` 门） | 同 R2 | `OVS-C1`（+ 421 test-d 类型面） |
| R4 缺省装配 data 路径（零变化） | β 直驱宿主 / α listen / peer | — | 前置门「closed ∨ ¬gate」与守卫 `return 0` 逐字保留 | — | — | β：0 ⇒ `send-failed` ns 级 resync 存活；α：水位暂停缓冲 | — | `BPK-NC1`（β）/ **`BPK-NC2`**（缺省装配前置门仍弹回） |
| R5 close 冲刷 / revoke / drain（零变化，锚面） | edge→session `'close'` / `'terminateUnauthorized'` / GOAWAY deadline | `unresolvedTags.clear()`、`pendingSends` 清、`settledNames` 记账 | A7/A9/A10 既有机械 | 同道 FIFO + 虚拟调度器 | 缝 delivered() 序、wire、observer、nsState | P4/P5/P6 已证行为 | 迟到回执/信号良性 no-op | `DROP-C1`、`FLUSH-C1/C2`、`REVOKE-C1/NC1`、`DRAIN-C1/NC1` |

无其余运行时数据创建/写入/存储路径变化（peer 侧、入站方向、控制面记账零变化；γ 下 edge 无 facets（`hub-edge-host.ts:674` `dataFacetOf(): undefined`）⇒ wheel/shed 机械结构性 inert，无干扰面）。

---

## 9. 错误、恢复、并发和幂等

### 9.1 新失败语义（γ 门控；0 值语义格按形态列全）

| 触发 | 判别点 | 可观察结果（γ） | α/β（标记缺席） |
|---|---|---|---|
| 账本投影越界（形态 A 无面 / 形态 B 有面慢对端） | `tryEmitDataFrame` `:171`（严格大于；触发帧不发送） | `ERROR{CONNECTION_BACKPRESSURE}` + close **1011** + `connection-failed` 恰一 + close 冲刷；**零** wire `RESYNC_REQUIRED`、零 `send-frame-rejected`/`update-too-large` 诊断、零 session→edge `connection-fatal` | `return 0` ⇒ β：ns 级 `send-failed` resync 存活（`BPK-NC1`）；α：水位暂停缓冲（`BPK-NC2` 前置门负控） |
| 单帧 > cap | `tryEmitDataFrame` `:167` | `ERROR{FRAME_TOO_LARGE}` + close **1009** + `connection-failed` 恰一（config 定性） | `return 0` 静默（P2 红 = 缺口本体） |
| **egress 返回 0（γ data 帧）** | 前置 `closed` 闸 ∨ 守卫触发后回调返回 | **0 ⟺ 连接已收口**（fatal 已在守卫点同步发起，或 closed 丢弃域）——公共 doc 陈述与代码逐形态一致（§8.1 doc append） | 缺省：0 ∈ {closed 闸, 水位暂停弹回（存活）, 守卫静默拒纳}——语义不变 |
| **水位 > highWater（γ）** | `dataGateOpen` 暂停态 | **不再是 data 帧失败源**：data 持续放行至 cap 判死；`send-paused`/`send-resumed` 事件照常（水位事实）；control 额度记账照常（暂停态 `controlUnflushed` 累积、耗尽 ⇒ 既有 1011） | α/β/缺省：暂停弹回 0（存活）——`BPK-NC2` 锚 |

### 9.2 恢复、并发与幂等

- **重试/恢复**：连接死亡 ⇒ peer 重连恢复（§10.3/§21 既有；「分块无洞中」：连接死亡 ⇒ 通道 quiesce 整体 abort，A4.3）。hub 侧无自动重试（1011/1009 均终局）。
- **幂等**：`connectionFatal` 以 `closedFlag` 早退——守卫重复触发、fatal 后再调钩子、多帧连撞均收敛恰一收口；`requestSinkClose` 幂等（同 promise）；`terminateUnauthorized` 幂等（quiet no-op）。
- **重入安全**：钩子在 `tryEmitDataFrame` 栈内同步执行 `connectionFatal`（含 `sender.teardown()`）；回调返回后仅 `return 0`，不读 sender 状态。收口 ERROR 经 `outbound.sendControl` 直发，`onEmitted` 因 `tornDown` 早退 ⇒ 账本零增长（§9.4 闭合点）。
- **fatal 后时序角落**：fatal 与缝上在途消息并发——edge 侧 closedFlag 早退、egress 前置 `closed` 闸 0（DROP-C1）；session 侧 close 送达前 ackTimer 先火 ⇒ resync 帧经已关 transport 零字节（`BPK-C2` 任意释放次序成立）。
- **前置门分叉的并发面**：`pausePreGate` 是构造期常量（装配事实），无运行时切换 ⇒ 无竞态；γ 下 `dataGateOpen()` 不再被 egress 调用，`observeWater` 的调用点收敛到 control 发送/poll，均为既有单线程同步段。
- **并发 OPEN 水位**：既有 `pendingOpenCount`/`pendingFrameCount` 单点账目 + 1008 收口；F2 只把解析延迟化，账目语义不变。

### 9.3 资源所有权与清理

连接级账本/wheel/poll 句柄归 `ConnectionSender`（`teardown` 单点清零）；session 侧 pending/未决 tag 归 γ 句柄 + `UpdateChannel`（close/teardown 冲刷）；`cleanupAll → settleTail → onConnectionDropped` 汇流既有。无新增所有权。

### 9.4 内存安全链（AC7 读法，修订后在**一切传输形态**闭合）

session 队列（`maxQueuedUpdateCount/Bytes` 既有 queue-overflow 纪律）→ 管道（宿主及时消费 = 测试泵 / `bufferedAmount` 冲刷证据）→ edge 账本（`maxQueuedBytesPerConnection` 严格接纳 + `maxQueuedControlBytes` 独立额度）。慢连接最坏账：严格大于判据 ⇒ 已放行 data ≤ cap；control ≤ `maxQueuedControlBytes`；越界 ⇒ **死亡** ⇒ `teardown` 清零 + 连接对象随 `cleanupAll` 释放。**首版论证缺口（F-1）已闭合**：有证据传输上 data 侧不再被暂停闸钉在 `highWater`，「越界即死」在无面（`BPK-C1`）与有面（`BPK-C4`）两形态均可达且被锚——「以静默丢帧/暂停长存充当上限」的形态被消除。socket 侧瞬时驻留上限从 ≈`highWater` 升至 ≤`cap`，与 §24.5 登记最坏账逐字一致（D1.5 取舍）。

---

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| `ConnectionSender` 宿主实现 ×2 | hub-edge.ts:203（**13 项** host 对象，N1 订正）、peer-connection.ts:373（自有 host，13 成员面零变化） | 可选成员缺席 ⇒ peer 零变化；hub-edge 条件挂接（§8.1-④） | hub-edge.ts（ALLOW）；peer 零改动 | `backpressure.ts:43-69`（13 成员）、`hub-edge.ts:203-217` |
| `createHubReplicationEdge` 宿主（β：#424 facade、#421 测试；γ：#447/#448 夹具、未来 nomic-server） | 不传新 option | 缺省 = 行为逐字节不变（含前置门）；γ 装配方显式置位获得 A4.3 语义 | 零（宿主自选）；γ 装配指南 = option doc + AGENTS.md 方向性义务 | `hub-edge-host.ts:151-167`、`src/index.ts:90` |
| γ 桥（宿主/夹具） | `egress ≤ 0 ⇒ 不投回执`；0 = 拒纳 | 同机械；γ 装配下 data 帧 0 ⟺ 连接已收口（fatal 由 edge 发起，桥零决策）——**真陈述**（§8.1 doc append 与代码一致） | 零（F4 登记） | `issue447-async-seam.ts:498-517` |
| β 直驱宿主（缺省装配） | 前置门 closed ∨ ¬gate ⇒ 0 | **零变化**（`pausePreGate=true` 逐字保留；`BPK-NC2` 锚） | 零 | `hub-edge-host.ts:694-695` |
| α 组合根（`hub-connection.ts:331-352`） | 不传内部标记；session 经真实闸门 | 新分支结构性不可达；α 水位暂停不动 | 零 | `hub-connection.ts:331-352`、`hub-session.ts:226` |
| `HubSessionSink`/通道/`UpdateChannel`/`RoundEngine`/`BulkTransferSender` | T1 交付机械 | 零变化（DENY）；新收口触发点汇入既有 close 拓扑 | 零 | §2 A7/A9/A10 |
| `HubReplicationEdgeEgress` 直驱宿主（γ 装配） | `0 = 拒纳` | data 帧面零签名变化；0 值语义收窄为「已收口」（doc append）；水位暂停不再弹回 | 零（文档面） | `hub-edge-host.ts:118-130/694-695` |
| 既有测试全家族（418/420/421/422/423/424/447/448 等 101 文件） | 绿 | 缺省零传 ⇒ 全绿为硬门；仅 421 test-d append 成员行 | 421 test-d（ALLOW，append-only） | SA6 §4 基线 |
| observer 消费者 | `connection-failed.code` ∈ 白名单；`send-paused/resumed` 事件 | 取值面不变；γ 下 data 侧新增可达 1011 序列；水位事件照常（经 control/poll 边沿） | 零 | `observer.ts:48-53`、`errors.ts:105/:116`、`hub-edge.ts:215-216` |
| replication-protocol 注册表 | 17 连接码冻结 | 零改动（无新码） | 零 | `errors.ts:100-118` |

---

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/ws-replication/src/backpressure.ts` | `ConnectionSenderHost` append 可选成员 `onDataFrameAdmissionFatal`；`tryEmitDataFrame` 两守卫各加一行可选调用；模块头注 append | D1-翼(i) 分叉点（AC1/AC2/AC7 生产缺口之一） |
| `packages/ws-replication/src/hub-edge.ts` | `HubReplicationEdgeConfig` append `asyncDataAdmissionFatal?: true`；构造器 sender host 条件挂接 + reason→码映射（D3）；doc append | D1 设置链落点(a) + D3 码单点 |
| `packages/ws-replication/src/hub-edge-host.ts` | `HubReplicationEdgeOptions` append `asyncDataAdmissionFatal?: true`；`allocate` 双落点转发；`HostEdgeConnection` 构造器增 `pausePreGate` 参数 + egress 装配前置门 γ 分叉（§8.1-⑥）；`sendDataFrame` doc append | D2 公共面 append + **D1-翼(ii) 前置门分叉（F-1 修订本体）** |
| `packages/ws-replication/AGENTS.md` | **append-only** 一句：γ 装配标记语义 + 方向性置位义务 + 双向误用面 + 前置门仅 closed 项（D8 全文） | 模块契约随行为变化同步（SA8-R5 方向性义务；docs/AGENTS.md 义务） |
| `packages/ws-replication/test/issue450-flow-seam.ts` | **新建**：`bootFlowRound`（F1 accept 装饰 + facade 增量 options）、F1 旋钮（`level`/`advance`）、`makeLargeUpdateFrame`（F3）、OPENWP 白盒编排助手（D7）、F4 头注登记 | 契约工件（SA6 §12.1） |
| `packages/ws-replication/test/ws-replication-issue450-flow-lifecycle.test.ts` | **新建**：验收契约本体（§12 全部条目，含 `BPK-C4`/`BPK-NC2`） | 契约工件（SA6 §12.1） |
| `packages/ws-replication/test/issue447-async-seam.ts` | **append-only**：`AsyncFacadeOptions.asyncDataAdmissionFatal?: true`（转发工厂）与 `deferSinkResolve?: boolean` + 闸门 API；缺省零传 = #447 行为逐字不变；改后 #447 三套件复跑绿 | F2 注入面 + 工厂标记转发缝（SA6 §12.1 预告） |
| `packages/ws-replication/test/ws-replication-issue421-edge-factory-api.test-d.ts` | **append-only**：新成员类型断言行 + 头注「九成员」→「十成员」措辞同步 | D9 类型锚 + 文档同步义务（既有断言全保留） |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/ws-replication/src/hub-session-async-host.ts` | γ session 半边 | AC3/AC4/AC5 机械已交付（P3–P6 绿）；乐观发送已由 T1 落地（A7）；流控单点在 edge（A4.3）——session 侧零改动 |
| `packages/ws-replication/src/hub-session.ts`、`hub-namespace.ts`、`update-channel.ts`、`round-engine.ts`、`bulk-transfer.ts`、`types.ts` | session 侧机械 | 同上（D5）；亦避免与 #449（T3）变更集重叠 |
| `packages/ws-replication/src/hub-session-host.ts` | β 冻结工厂 | β 冻结签名逐字不动（ADR A4.1/模块 AGENTS） |
| `packages/ws-replication/src/hub-connection.ts`、`plugin.ts` | α 组合根/插件轨 | α 行为逐字节不变（新分支 config 缺席即不可达；α 真实闸门不动） |
| `packages/ws-replication/src/peer-connection.ts`、`peer-namespace.ts` | peer 侧 | peer 不拆分（ADR 0032）；`tryEmitData` 消息形态路径不受本票影响 |
| `packages/ws-replication/src/frame-io.ts`、`hub-upgrade-admission.ts` | 盖章单点/早到帧准入 | 盖章与 admission 单点不动（#418/#421 冻结面） |
| `packages/ws-replication/src/index.ts` | 公共入口 | 无新值导出；类型经既有再导出流动（D9） |
| `packages/ws-replication/src/testing.ts` | 生产测试面 | #450 夹具 test-only、落 `test/`（SA6 §12.1 夹具工件路径；§16 test-only 纪律——N5 订正引用） |
| `packages/ws-replication/test/issue448-live-seam.ts` | T2 夹具 | F1 经 accept 装饰实现（D6），无需扩展；保持 T2 面冻结 |
| `packages/ws-replication/test/{driver,harness,issue420-shim-hub,issue424-sharded-hub,issue137-driver}.ts` 与其余既有 `*.test{,d}.ts` | 既有验收族 | 全绿是硬门；β 对照经既有 #424 facade 消费，零改动 |
| `packages/replication-protocol/**` | 错误注册表/codec | 零新码、wire 零变化（D3） |
| `docs/adr/0032-*.md`、`docs/protocols/instance-replication-v1.md`、`CONTEXT.md` | 规范权威 | §24.5/§24.7/A4.3/CONTEXT 已登记目标语义——实现追平规范，零文本改动（D8；SA8-R4 核对面；§16 解释问题若裁定相反按其结论另行处理） |
| `packages/` 其余包、`domains/`、`apps/`、根配置 | 无关 | 越界 |

---

## 12. 验收与验证映射

统一纪律（承接 SA6 §12.0 + #447 §12）：断言 = 运行期行为（wire 帧原字节/`[8..12]` 序/缝消息对象与消费序/observer 单事件字段值/`sendDataFrame` 返回值/close info/句柄计数）；零源码 grep 断言；零 skip/only/todo/env override；peer `random: () => 0.5` 钉死；时间 = 虚拟调度器 `advanceBy`；延迟 = 显式 release；3 次复跑逐值确定。

### 12.1 契约条目 → 测试落点

| 条目 | 编排（最小输入） | 可观察断言（目标实现） | 负控 | HEAD 状态 |
|---|---|---|---|---|
| `BPK-C1` 账本越界 → 1011（AC1，无证据传输形态） | `bootFlowRound({ asyncDataAdmissionFatal: true, edgeObserver: true, limits: { maxQueuedBytesPerConnection: 4096, lowWater: 1024, highWater: 2048, maxInFlightUpdates: 32 } })` → `awaitLive` → 300× `writeHub({n:i})` + 泵（F1 无面缺省 = 慢对端等价，头注登记） | wire `ERROR{CONNECTION_BACKPRESSURE}` **恰一**；`hubSideCloseInfo = {code:1011, reason:'protocol-error'}`；observer `connection-failed{…1011}` 恰一；缝 `'close'` 送达恰一 + `closeCalls=1`；全泵 + `advanceBy(ackTimeoutMs+1)` 后 wire `RESYNC_REQUIRED` **零** | `BPK-C3` | **红**（P1） |
| **`BPK-C4` 账本越界 → 1011（AC1，生产拓扑形态——本版新增，F-1 落正面）** | 同 limits（`cap 8192 / highWater 4096 / lowWater 2048`，链式满足）+ **F1 旋钮 ON 不 advance**（`bufferedAmount` = Σ已发送字节，只增）+ 持续写入与泵（真 peer 持续 ACK ⇒ 窗口周转） | 压力期**至少一帧在 `level() > highWater` 时仍被放行盖章**（暂停门已移除的判别性观察）；随后 `projected > cap` ⇒ `ERROR{CONNECTION_BACKPRESSURE}` 恰一 + close 1011 + observer 恰一 + `'close'` 送达 + pending 冲刷；`advanceBy(ackTimeoutMs+1)` 后 `RESYNC_REQUIRED` **零**、连接死亡 | `BPK-NC2`（同压力、标记缺席 ⇒ 前置门弹回 + 存活） | **红**（首版设计下该形态 = 前置门 0 弹回 + ns resync 存活——SA2 SM-5） |
| `BPK-C2` 拒纳/resync 在 γ 不可达（AC1） | 同 `BPK-C1` **与** `BPK-C4` 两形态（本版扩为双形态断言） | 两形态各自：wire 零 `RESYNC_REQUIRED`（任意释放次序）；observer 零 `resync-required{send-failed}`、零 `update-dropped{update-too-large}`；`probes.signals` 零 `connection-fatal:*`（收口由 edge 发起）；缝消息词汇 ⊆ §24.3 闭集合 | `BPK-NC1/NC2` | **红**（P1：`RESYNC_REQUIRED=1`） |
| `BPK-C3` 界内不收口（AC1/AC7） | F1 旋钮持续 `advance(已发送字节)`（及时消费）；同 limits 有界写入 | 零 fatal、零 close、全部帧盖章（stamps/receipts 配对）、连接存活；账本投影回落可观察（持续放行） | 自反（撤 `advance` ⇒ 退化为 C1/C4） | 绿（P1 越界前 48 帧天然对照；旋钮使其成为真对照） |
| `BPK-NC1` β 登记差（AC1 对照） | 同 C1 limits 编排走 β 同步缝（`makeShardedReplicationFacade`，A14；不传新 option） | ns 级 `RESYNC_REQUIRED{send-failed}` + observer `resync-required{cause:'send-failed', reason:'send-frame-rejected'}`；连接存活、零 `connection-failed{CONNECTION_BACKPRESSURE}` | 与 `BPK-C1` 互为正负 | 绿（既有语义） |
| **`BPK-NC2` 前置门分叉负控（本版新增）** | 同 `BPK-C4` 压力编排（F1 ON 不 advance、`highWater` 小值），**标记缺席**（缺省装配 + γ 桥——即「漏置位」形态） | `level() > highWater` 后 data 帧在前置门弹回：桥 `unsealed` 递增、零盖章零回执；**零** `connection-failed`、transport 不 close、连接存活（暂停弹回形态为缺省装配保留）；`advanceBy(ackTimeoutMs+1)` ⇒ ns 级 `RESYNC_REQUIRED`（β 形态） | 与 `BPK-C4` 同压力互反 | 绿（= HEAD 缺省行为；证明翼(ii) 分叉真实且仅 γ 门控） |
| `OVS-C1` 单帧超限 → 配置错误收口（AC2） | `bootFlowRound({ asyncDataAdmissionFatal: true, edgeObserver: true, limits: { maxQueuedBytesPerConnection: 16384, highWater: 8192, lowWater: 4096 } })` → live → `connection.egress.sendDataFrame(makeLargeUpdateFrame(nsId, 20480))` | 返回 0 且：wire `ERROR{FRAME_TOO_LARGE}` 恰一 + `close(1009)` + observer `connection-failed{FRAME_TOO_LARGE,1009}` 恰一 + `'close'` 送达 + pending 冲刷；断言**不存在**「返回 0 且连接存活」形态；`update-sent` 零新增 | `OVS-NC1/NC2` | **红**（P2） |
| `OVS-NC1` cap 充裕对照（AC2；N2 校准） | 同帧、`maxQueuedBytesPerConnection: 65536, highWater: 32768, lowWater: 16384`（链式满足），且**注入前 F1 `advance(level())` 清账**（缺省夹具账本零退休 ⇒ 投影含 Σ已出站字节——cap 恰 20480 会以 ledger-overflow 误红；64KiB + 清账双保险） | 返回 >0；帧字节达 wire（可配 `dropNextHubToPeer` 旁路记录面隔绝对端消费）；零 ERROR/零 close/连接存活 | 与 `OVS-C1` 同帧互反 | 绿 |
| `OVS-NC2` 帧 ≤ cap 界内放行（AC2） | 常规小帧（`BPK-C3` 场景共享） | 正常盖章出站、零收口（严格大于判据不变） | — | 绿 |
| `DROP-C1` 收口后 session→edge 静默丢弃（AC3） | 扣留 session→edge → 触发 1011（`BPK-C1/C4` 编排）或对端断 → 先送达 `'close'` 再放行后到帧/settled/connection-fatal | 后到一切：零盖章、零回执、零新 wire 字节、零新 observer；`settled` 落账但零收口（drain 闸） | 收口前放行同帧 ⇒ 正常盖章 | 绿（锚缺失→补） |
| `FLUSH-C1` close 冲刷 pending 无泄漏（AC3） | `maxInFlightUpdates: 1` + 扣留 edgeToSession（在管 1 帧 + 队内 N 帧）→ 送达 `'close'` | `close()` 幂等（同 promise）；`closeCalls=1`；冲刷后 `advanceBy(ackTimeoutMs+1)` ⇒ 零 `RESYNC_REQUIRED`、零 fatal；迟到回执良性 no-op | `FLUSH-C2` | 绿（P4） |
| `FLUSH-C2` 冲刷非恒真（AC3） | 无 close 的同扣留编排 | 必达 `RESYNC_REQUIRED{ack-timeout}×1`（= #447 `PEND-C3` 判别力） | 与 `FLUSH-C1` 互反 | 绿 |
| `REVOKE-C1` 不溯及已推帧（AC4） | 扣留 edgeToSession → 已推帧盖章 → `revokeNamespace` → 放行 | 已推帧序在 wire；其 receipt 在 delivered() FIFO 中 **strict 先于** `'terminateUnauthorized'`；revoke 恰一 `ERROR{NAMESPACE_UNAUTHORIZED}` + ns `failed`；连接存活 | `REVOKE-NC1` | 绿（P5） |
| `REVOKE-NC1` 撤销幂等（AC4） | 重复 `revokeNamespace` ×2 | 零第二次 `NAMESPACE_UNAUTHORIZED`、零新收口 | — | 部分已证（P5）；重复调用补锚 |
| `DRAIN-C1` settled 晚到 + 逃生舱（AC5） | `requestReauth` → GOAWAY；settled 未达 / 早达 / 收口后晚达三形态；`advanceBy(closeTimeoutMs±1)` | 未达 ⇒ 到点恰 `close(1001,'hub-reauth')`；早达 ⇒ 提前收口（< deadline）；收口后晚达 ⇒ 零二次收口/零新事件 | `DRAIN-NC1` | 绿（P6） |
| `DRAIN-NC1` 逃生舱敏感（AC5） | 注入非缺省 `closeTimeoutMs`（如 2× 缺省） | 收口时刻随配置移动（参数未被 γ 改值/软化） | 与缺省值互反 | 待落地（SA6 NC-7） |
| `OPENWP-C1` 原值不误收口（AC6） | D7 白盒编排：γ facade + `deferSinkResolve` + 合成帧注入——形态(i) 恰 4 并发 OPEN（F2 挂起）；形态(ii) **1 OPEN + 15 缓冲早期帧**（N4：多 ns OPEN 到不了 16 帧边界） | 两形态各自：零收口、零 ERROR、连接存活；resolve 后按序冲刷（台账/缓冲语义不变） | `OPENWP-C2` | 白盒绿（OAP-C4d/C5a）；γ permutation 新锚 |
| `OPENWP-C2` 打穿响亮收口（AC6） | 同上第 5 并发 OPEN / 第 17 pending 帧 | 恰一 `ERROR{CONNECTION_POLICY_VIOLATION}` + `close(1008)` + quiesce——故障参数定性 | `OPENWP-C1` | 白盒绿（OAP-C4c）；γ permutation 新锚 |
| `MEM-C1` 逐跳有界（AC7） | 同 `BPK-C1`/`BPK-C4` 编排（慢对端 + 大突发至上限，两形态） | session 队列跳：小 `maxQueuedUpdateBytes` 构型下越界 = 既有 queue-overflow 声明（ns 级、连接存活）可观察；edge 账本跳：越界 ⇒ 1011 死亡；两跳判然两分 | `MEM-NC1` | edge 跳**红**→绿；session 跳既有绿 |
| `MEM-C2` 死亡释放（AC7） | `BPK-C1`/`BPK-C4` 收口后全泵 + `advanceBy(ackTimeoutMs+1)` | 零 `RESYNC_REQUIRED`（无 pending 泄漏）、零新盖章/回执/wire 字节、`closeCalls=1`；账目归零以行为代理观察（SA6 §7 纪律）；**可选增强（N6）**：经夹具探针/handle 暴露 `pendingSends`/`inFlight` 计数直锚「清零」 | `FLUSH-C2` 反证占窗确实存在 | **红**→绿 |
| `MEM-NC1` 及时消费零死亡（AC7） | F1 旋钮持续 `advance`（= `BPK-C3` 同编排） | 零越界、零死亡、持续放行 | 撤 `advance` ⇒ `BPK-C1/C4` | 待落地（依赖 F1） |
| PUB 类型面（AC 附加） | `ws-replication-issue421-edge-factory-api.test-d.ts` append | `asyncDataAdmissionFatal: true \| undefined` 类型锁定；缺省对象字面量仍通过（可选性证明，零 cast）；既有 β 冻结断言全保留 | `@ts-expect-error` 非法值形态 ≥1 | 新增（append） |

### 12.2 实现阶段验证门（模块 AGENTS「Verification」+ SA6 §14 + SA8 报告 R1–R4）

1. **聚焦**：`NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication/test/ws-replication-issue450-flow-lifecycle.test.ts --typecheck.enabled=false`（目标实现全绿；旧实现红 = P1/P2/SM-5 复现）。
2. **γ 族复跑**：#447 三文件 + #448 一文件 + #450（夹具 append 后 #447 行为逐字不变的证明）。
3. **缝邻接**：#421 全套件（edge 工厂契约 + test-d）+ #418/#420/#422/#423/#424 wire parity 守卫。
4. **包全量**：`npx vitest run packages/ws-replication/test`（101+1 文件）+ 包 `tsc`（`Type Errors no errors`）。
5. **根门禁**（生命周期改动，模块 AGENTS 要求；全量回归**归属**仍留 #451）：根 `pnpm typecheck` + `pnpm test`。
6. **β/α 硬门**：既有 101 文件全绿 + `BPK-NC1`（β 语义）+ `BPK-NC2`（缺省前置门）绿（缺省零传的运行期证明，含翼(ii)）。
7. **SA8-R1/R2 复核面**：append 形状（`true | undefined`、allocate 双落点、test-d「九→十」）；两守卫仅增可选调用、前置门分叉仅 γ 门控（`pausePreGate` 构造期常量）；规范文本 diff 零触碰。

---

## 13. 风险、回滚和残余问题

| # | 风险/残余 | 定性 | 缓解 |
|---|---|---|---|
| R1 | 标记误用（**双向**，N3 修订）：(i) 加到 β 同步装配 ⇒ data 越界连接死亡；(ii) **γ 装配漏置位 ⇒ 静默保留 β 语义（本票要消灭的形态）且零诊断** | 接受（工厂无法感知 sink 形态；装配期知识纪律） | option doc + AGENTS.md **方向性义务**登记句（SA8-R5）+ `BPK-NC2` 固化漏置位形态 + `BPK-NC1` 固化 β 语义 |
| R2 | `BPK-C1/C4` 中真 peer 在 1011 后按 backoff 重连产生新连接噪音 | 编排风险（非生产） | 断言限定 conn-0 的 seam/wire/observer；不推进 peer 调度器过 backoff；新连接键天然互异（`-conn-1`） |
| R3 | fatal 在桥释放循环中段触发：残余 sessionToEdge 缓冲消息撞 closed 闸返回 0（夹具 `unsealed++`） | 预期行为（DROP-C1 域） | 断言指南：post-close unsealed 不计失败；夹具注记区分「缺省装配暂停弹回（合法）」与「收口后丢弃（合法）」与「γ 装配守卫前弹回（应已消灭——`BPK-C4` 判别）」三种 0 值来源 |
| R4 | `issue447-async-seam.ts` append（F2/标记转发）引入 #447 回归 | 测试基建风险 | 缺省零传 + #447/#448 全量复跑绿为门（§12.2-2） |
| R5 | `makeLargeUpdateFrame` 的 Yjs 字节非确定（clientID/内容） | 测试确定性风险 | `clientID` 钉死 + 定长内容；帧长断言用 `byteLength` 区间/下界而非逐字节金标 |
| R6 | 与 #449（T3，未合入 HEAD）变更集潜在重叠 | 排程依赖 | 本票 ALLOW 不含 `update-channel`/`bulk-transfer`（DENY）；若 #449 先合入，实现阶段按 SA6 §15-5 登记边界（SA8-R6） |
| R7 | 根门禁在 #450 实现阶段的全量时长 | 流程 | 模块 AGENTS 义务照跑（§12.2-5）；全量回归归属矩阵仍属 #451（T5） |
| **R8**（新） | 翼(ii) 取舍：γ 下瞬时/慢性 socket 压力不再经暂停闸缓冲，data 直接向 cap 逼近——每慢连接 socket 侧最坏驻留从 ≈`highWater` 升至 ≤`cap`；例行突发不再有「暂停等待恢复」形态（连接要么吸收要么死亡） | **有意取舍**（§24.5 登记最坏账 = cap + control 后死亡释放；D1.5 论证；暂停长存形态 = γ 所反对的 β 形态） | `BPK-C3`/`MEM-NC1`（及时消费 ⇒ 零死亡）锚证非压力路径不受影响；cap 可由宿主配置收紧（链式校验保护）；§16 交 SA8 确认取读法 |
| **R9**（新） | SA8 对 §16 解释问题若裁定为 B 读法（前置门暂停项应保留） | 规范裁定 contingency（非当前设计主张） | 降级路径 = 单点 revert 翼(ii)（`pausePreGate` 恒 true，其余两翼保留）+ 恢复 SA2 备选 B 的文本形态（0 值语义格改回三来源、AC1 适用域限定为无证据传输/编排等价模型、§13 登记「有证据传输上暂停闸先制」边界）——该文本形态已在本版 §9.1 表与 R9 预写，无设计空窗 |

**回滚**：生产改动 = γ 门控分叉两翼（3 个 src 文件的可选成员/条件挂接/前置门参数）；revert 即恢复 HEAD 语义（α/β 路径从未被触碰——缺省零传的既有套件全绿 + `BPK-NC1/NC2` 即回滚安全证明）。**任务内无未解决必要条件**；follow-up：#449（T3）、#451（T5）按既有票归属推进。

---

## 14. 评审修订映射

评审输入：`wiki/raw/task_issue-450_sa2_review.md`（verdict `reject`——1 MAJOR + 6 nonblocking；全部 finding 逐条处理如下）：

| Finding | 修订位置 | 处理结果 |
|---|---|---|
| **F-1（MAJOR）**：水位暂停闸先于账本守卫拦截 γ 数据帧；首版「egress 的 0 只伴随连接已收口」三处无条件声明被保留代码证伪；AC1 可达性未裁定 | §1-目标1/§2-A4·A5·A8/§3-S8/§4-AC1·AC7 行/§7-D1（两翼）+**D1.5（裁定书）**/§8.1-⑥ + doc append 重写/§8.2（SM-5 改判）/§8.3-R2·R4/§9.1（0 值格·水位行）/§9.4/§10（γ桥行·直驱宿主行·β 直驱行）/§11 ALLOW（hub-edge-host 增前置门分叉）/§12（新增 `BPK-C4`/`BPK-NC2`；`BPK-C2` 扩双形态）/§13-R8·R9/§16 | **采用 SA2 备选 (A)**（分叉延伸至 egress 前置门暂停项）：γ 装配下前置门仅保留 `closed` 项，帧恒达账本守卫、投影含 `observe()` 自行判死；「瞬时压力不再经暂停闸缓冲、直接向 cap 逼近」的取舍与四点规范依据已登记（D1.5）；无条件「0 ⇒ 已收口」声明改写为与代码逐形态一致的真陈述（§8.1 doc append/§9.1/§10）；AC1 适用域 = **一切传输形态**，并以 `BPK-C4`（有面慢对端 ⇒ 1011 死亡）落生产拓扑锚、`BPK-NC2` 固化缺省前置门；备选 (B) 与第三形态（暂停 fatal 化）作为否决备选 (e)/(f) 记录理由，B 保留为 R9 降级路径；规范解释问题按 SA2 要求专递冲突门（§16） |
| N1：`ConnectionSenderHost`「17 成员」计数错误（实为 13） | §7-D9、§8.1-① 注释、§10 第一行 | 订正为 13（`backpressure.ts:43-69` 逐成员列出） |
| N2：`OVS-NC1`「cap ≥ 20480」不充分——缺省夹具账本零退休 ⇒ 投影含 Σ已出站字节，cap 恰 20480 时同帧触发 ledger-overflow 误红 | §12.1 `OVS-NC1` 行 | cap 取 64 KiB + 注入前 F1 `advance(level())` 清账（双保险），并注明原因 |
| N3：R1 误用登记只覆盖「β 误加」方向；「γ 漏置位 ⇒ 静默 β 语义 + 零诊断」更值得登记 | §7-D2、§8.1-⑤ doc、§13-R1、D8 登记句、§12 `BPK-NC2` | 双向登记 + 方向性义务（SA8-R5）+ 漏置位形态可执行负控 |
| N4：D7「注入 N 个不同 ns 的 OPEN」到不了 16 帧边界；16 帧形态需 1 OPEN + 15 缓冲帧 | §7-D7、§12.1 `OPENWP-C1/C2` 行 | 两到界形态分列：并发闸 = 4 deferred OPEN；帧闸 = 1 OPEN + 15 缓冲早期帧（OAP-C4c/C4d 模式） |
| N5：DENY 表 `testing.ts` 行引用「SA6 §15-5」错位（该条是 #449 边界） | §11 DENY `testing.ts` 行 | 改引 SA6 §12.1（夹具落 `test/`）+ §16（test-only 纪律） |
| N6：`MEM-C2` 行为代理可接受；计数代理（`pendingSends`/`inFlight`）为 SA6 §7 允许的可选增强 | §12.1 `MEM-C2` 行 | 行为代理维持主锚；计数直锚登记为可选增强（不阻断） |

---

## 15. 是否需要设计后 ADR 冲突复查

**结论：需要（`requiresConflictRecheck: true`）。** 理由：

1. **公共 API 变化**：`HubReplicationEdgeOptions` append 可选成员（SA8 报告 #6 已裁 no-conflict——注册通道内；本版无新增公共面，维持该裁定）。
2. **新失败语义落地 + §16 规范解释问题**：γ 形态下 data admission 越界 = 连接终局（1011/1009）是 A4.3 登记目标语义的实现首次落地；**本版把分叉延伸至 egress 前置门暂停项（F-1 裁定）**——该延伸依据本设计对 A4.3/§24.5 的读法（D1.5 四点），SA8 iteration 0 报告未审阅此前置门分叉；§16 的规范解释问题（A4.3「删除前置检查」清单与 §4/§17 水位条目在 γ data 路径的适用边界）需冲突门显式确认或否决。
3. **零冲突项申报**：wire/协议语义零变化；缝词汇闭集合零扩展；错误注册表零新码；β/α 逐字节不变（缺省零传 + `BPK-NC1/NC2`）；AC3/AC4/AC5 机械零触碰；水位机械（α 闸门 / control 额度 / 缺省前置门 / 链式校验 / 水位事件）原样保留。

---

## 16. 规范解释问题（SA8 冲突门专递；narrow framing）

**问题**：ADR 0032 A4.3（:77-79）「session 乐观发送，**删除 `dataGateOpen`/`connectionState`/`bufferedAmount` 前置检查**」与协议 §24.5（:1134）「连接账本投影越界即 `CONNECTION_BACKPRESSURE`(1011) 收口整条连接：**无逐帧拒纳、无 deferred、无 ns 级 send-failed resync**」——两条款的适用范围是否覆盖 **edge 侧公共 egress 面（`HubReplicationEdgeEgress.sendDataFrame`，`hub-edge-host.ts:694-695`）前置门中的水位暂停项**（`!port.dataGateOpen()`）？

- **读法 A（本设计采用）**：覆盖。γ 装配下该前置门应仅保留 `connectionState()==='closed'` 项（closed 项 = A4.5 收口后丢弃规则的机械，非流控前置检查），γ data 帧恒达账本投影守卫（投影含 socket `bufferedAmount`，缺面 → 0），持续慢对端压力以 1011 连接死亡收口。依据：① A4.3 删除清单**点名** `dataGateOpen`，而 γ data 路径上该前置检查仅残存于此（session 半边已 dormant，`hub-session-async-host.ts:219`）；② §24.5 禁止清单三项 = 暂停项在 `bufferedAmount` 传输上的逐项可观察产物（0 弹回 / tag pending 占窗 / ackTimeout ns 级 resync 存活——SA2 SM-5 实证）；③ §24.5 :1137「edge 账本 → 越界即死；慢连接出站最坏账 = `maxQueuedBytesPerConnection` + `maxQueuedControlBytes` 后**连接死亡释放**」以死亡为释放机制，前置门使该机制在慢性形态不可达；④ 协议 :589「缺面视为 0——背压水位退化为不可观察，**数据总量仍受准入与 1011 收口**」确立 1011 为数据总量终局界。
- **读法 B（对立）**：不覆盖。§24.5 禁止清单仅约束「账本投影越界」触发点的响应形态；§4/§17 水位条目（:587「socket 缓冲……由水位暂停与 1011 承接」、:589「> high-water 暂停 dequeue」）与 `validate.ts` 链式注释（`highWater` = 「可恢复暂停阈值」，先于「终止性 1011 阈值」）登记了一个**可恢复流控阶段**，可与 1011 并存；其代价 = 暴露 `bufferedAmount` 的生产传输上 data admission 1011 分叉被前置门结构性先制（慢性压力退化为逐帧弹回 + ns 级 resync + 连接存活）。
- **裁定影响面**：读法 A 成立 ⇒ 本设计两翼分叉即为规范要求形态（§7-D1/D1.5），`BPK-C4/NC2` 为其验收锚；读法 B 成立 ⇒ 翼(ii) revert（§13-R9 降级路径），AC1 适用域显式限定为无证据传输/编排等价模型，公共 doc 0 值语义格改回三来源形态。**两读法下 D1-翼(i)（守卫失败动作）、D3（码映射）、AC2–AC6 全部锚集均不受影响**——裁定的最小影响面 = 翼(ii) 的去留与 AC1 的适用域措辞。
- **无 Owner override 权威可用**（REST snapshot 为空）；无新 ADR/协议版本。本设计不等待裁定推进读法 A（必要设计选择已按规范证据强度作出，§7-D1.5），冲突门结论直接决定 R9 是否触发。
