# SA2 设计评审 — Issue #450（γ-T4）：γ 流控与生命周期收口

- Dispatch：`sa-0030c7fb-e368-4f71-a038-cea6e71dcdf5`（mabf-sa2 / design-review / **iteration 1**）
- 评审对象：`wiki/raw/task_issue-450_design.md`（SA1 **iteration 1 修订版**，517 行——F-1 裁定 = 备选 (A)：分叉延伸至 egress 前置门暂停项「两翼」+ §16 规范解释专递 + `BPK-C4`/`BPK-NC2` 新锚）
- 基线核对：worktree HEAD `444c1665fdb35b618bbb378a5b6bcefacfd288a7` 与设计/SA6/SA8 声明一致（`git log` 实查）；`git status` 仅 `wiki/raw/task_issue-450*` 与 `artifacts/sa6-issue450-*.log` 未跟踪——生产面零改动。
- 方法：全部 finding 以源码/规范原文逐行核验（行锚见各表）；本版重点 = **翼(ii) 前置门分叉的新机制面**（承重改动，iteration 0 未审）；未修改任何设计/生产/测试文件；未运行测试或服务。
- 上轮处置：iteration 0 verdict `reject`（MAJOR F-1 + N1–N6）——**本版逐条核验全部落实**（见「上轮 finding 处置核验」）；F-1 关闭，不再列为阻断项。

## Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-450.md`（Host 简报，7 条 AC） | 在场，已读 |
| `wiki/raw/task_issue-450_sa6_contract.md`（已批准验收契约） | 在场，已读（§2/§3/§5/§8/§12/§15 逐条核对） |
| `wiki/raw/task_issue-450_design.md`（**iteration 1 修订版**，评审对象） | 在场，通读；§14 修订映射逐条对勘实际文本 |
| `wiki/raw/task_issue-450_sa2_review.md`（iteration 0 本评审前身） | 在场——本文件即其原位更新 |
| `wiki/raw/task_issue-450_design_conflict_report.md`（SA8 冲突门，iteration 0，verdict `clear`/R1–R6） | 在场，已读；**其审阅对象为首版（436 行，守卫单点分叉），未含前置门分叉**——设计 §15-2 已如实申报，§16 新解释问题待并行派发的 SA8 iteration 1 裁定 |
| Owner comments | REST snapshot 为空（派工明示 + 简报 `## Comments` 空）——无 owner 追加要求 |
| `task_issue-450_relevant_decisions.md` / `_conflict_report.md` | 不存在（实查；SA6 §3 / 设计头部同判；非阻塞） |
| 规范权威：`docs/adr/0032-*.md` 附录 A4（A4.3 :77-79 / A4.5 / A4.8）、`docs/protocols/instance-replication-v1.md` §24（§24.3/§24.5 :1130-1139/§24.7）+ §4/§17 水位条目（:587/:589/:600） | 已读原文逐字核对（含本版新增引用的 §4/§17 行） |
| 前序设计 `wiki/raw/task_issue-447_design.md` §9.1（egress ≤ 0 行，:488 带 dormant 限定原文） | 已读原文核对 |
| 源码实查（本版新增/重点）：`backpressure.ts` 全文（守卫/水位/poll/退休/teardown）、`hub-edge-host.ts`（:110-114 resolver / :151-167 options 九成员 / :674 dataFacetOf / :681-700 HostEdgeConnection+前置门 / :909-948 allocate 单构造点 / :958-962 公共工厂）、`hub-edge.ts`（:112-116/:203-217 十三项/:214/:267-272/:673-698/:743-780/:792-794）、`frame-io.ts:150-205`（emitFrame/emitOne 全返回路径）、`hub-session-async-host.ts:196-264`、`hub-session-host.ts:176-190`、`hub-session.ts:210-268`、`validate.ts` 链式校验、`defaults.ts`、`observer.ts:48-53`、`errors.ts:100-118`、`hub-connection.ts:331-352`、`peer-connection.ts:373-384`、`hub-upgrade-admission.ts:26` | 设计 §2/§7-D1/§8.1 全部行锚逐条命中（结果见各表） |
| 测试面实查：`issue447-async-seam.ts`（:298-345 AsyncSeamHost/AsyncFacadeOptions、:434/:582-583 工厂与 acceptTrusted、:490-517 桥回执条款）、`issue137-driver.ts:139-156`（applyPressure 先例）、`ws-replication-issue421-open-admission-pipeline.test.ts:607-622`（OAP-C4d 实际模式）、421 test-d（:15/:123「九成员」）、`harness.ts`（grep `bufferedAmount` = 0 处） | F1/F2/F3/D7 可行性与 N4 事实核对 |

---

## Verdict

**`approve`** —— iteration 0 的 MAJOR F-1 已按备选 (A) 完整落地并经源码逐行核验为真修订：前置门分叉（翼 ii）与守卫失败动作分叉（翼 i）合并后，γ data 路径的失败语义唯一（连接终局），「egress 0 ⟺ 已收口」成为与代码逐形态一致的真陈述（含 `emitOne` 序号耗尽的响亮 throw 路径核查）；AC1 适用域扩至一切传输形态并以 `BPK-C4`（有面慢对端 ⇒ 1011）/`BPK-NC2`（缺省前置门弹回负控）双锚落地；N1–N6 逐条核验落实。新增机制面（`pausePreGate` 构造期常量、单构造点、缺省路径语义逐字保留）无状态机/并发/调用方/架构缺口。**一项规范解释问题（A4.3 删除清单是否覆盖 edge egress 前置门）以 §16 窄框架专递冲突门**——翼(ii) 的去留系于该裁定（R9 降级路径已预写、最小影响面已界定）；本 approve 不预断该裁定，按 `requiresConflictRecheck: true` 移交。

---

## 需求覆盖

| Requirement（Issue AC） | Design section | Assessment |
|---|---|---|
| AC1 账本溢出 → 1011 收口锚；逐帧拒纳/ns 级 resync 在 γ 不可达 | §7-D1（两翼）/D1.5、§8；验收 `BPK-C1`（无面）+ **`BPK-C4`（有面不 advance = 生产拓扑慢对端，本版新增）** + `BPK-C2`（扩双形态）+ `BPK-NC1`（β）+ **`BPK-NC2`（缺省前置门，本版新增）** | 成立（F-1 闭合）：翼(ii) 移除前置门暂停项后帧恒达守卫、投影含 `observe()` 自行判死（源码核验：`tryEmitDataFrame` 投影公式 :168-170 逐字、`emitDataFrameBytes` :184-190 无隐藏闸门——缺宿主成员 = 响亮 throw 非静默 0）；「不可达」在无面（C1）与有面（C4）两形态均被锚，负控成对（NC1/NC2） |
| AC2 单帧超限 → 响亮收口 + 诊断（配置错误定性） | §7-D3、§8；验收 `OVS-C1/NC1/NC2`（NC1 按 N2 校准：cap 64KiB + `advance(level())` 清账双保险） | 成立（iteration 0 已核，本版 NC1 校准后判据充分） |
| AC3 close 后丢弃锚 + close 冲刷 pending 无泄漏 | §7-D5、§12 `DROP-C1/FLUSH-C1/FLUSH-C2` | 成立（零生产改动 + 回归哨兵；前置门 `closed` 项保留 = A4.5 丢弃机械，与翼(ii) 无冲突） |
| AC4 `terminateUnauthorized` 不溯及已推帧锚 | §7-D5、§12 `REVOKE-C1/NC1` | 成立（不变） |
| AC5 `settled` 晚到 drain 锚；`closeTimeoutMs` 不变 | §7-D5、§12 `DRAIN-C1/NC1` | 成立（不变） |
| AC6 OPEN 水位延迟复核 | §7-D7（N4 正措辞）、§12 `OPENWP-C1/C2` | 成立：两到界形态分列（4 deferred OPEN / 1 OPEN + 15 缓冲帧）与 OAP-C4c/C4d 实际模式一致（:607-622 实查：`openFrame` + `MAX_PENDING_FRAMES_PER_CONNECTION - 1` 缓冲帧）；γ 注入面可行性核验（`AsyncSeamHost.acceptTrusted` :308-311 在场、facade 内部经公共 `createHubReplicationEdge` :434 组装 ⇒ 标记/deferred 转发缝真实可达） |
| AC7 内存安全链锚 | §7-D1（两翼）、§9.4、§12 `MEM-C1/C2/NC1` | 成立（本版强化）：翼(ii) 使「死亡兑现」在有证据传输上可达；最坏账 = cap + control 后死亡释放的论证闭合点（teardown 清零 :238-251、`onEmitted` tornDown 早退 :208-209、`connectionFatal` 先 teardown 后 ERROR 直发 :676-679）全部实查成立；socket 驻留上界从 ≈highWater 升至 ≤cap 的取舍已登记（R8 + D1.5） |
| 目标/非目标未静默扩大 | §1 | 成立（非目标新增「规范文本零改动」与 §16 专递一致；session 侧仍全 DENY） |

## Owner评论覆盖

派工与简报双确认 REST snapshot 为空，无 owner 评论可映射（设计 §4 同判，核验一致）。需求全集 = Issue 正文 7 条 AC + ADR 0032 A4.3/A4.5 + 协议 §24.5/§24.7——已在「需求覆盖」逐条核对。

## 上游事实与SA8约束

#450 无前置 SA8 决议产物；设计后冲突门报告（iteration 0，`clear`/R1–R6）已产出。**逐条读原文核验**（非仅转引设计）：

| Fact or constraint | Design response | Assessment |
|---|---|---|
| A4.3（:77-79 原文）：「session 乐观发送，**删除 `dataGateOpen`/`connectionState`/`bufferedAmount` 前置检查**……连接账本投影越界即 1011 收口整条连接——**无逐帧拒纳、无 deferred、无 ns 级 send-failed resync**」 | §7-D1 两翼 + D1.5 四点依据 + §16 读法 A | 原文逐字核验在（含删除清单点名 `dataGateOpen`）；设计读法 A 的关键事实前提**经源码证实**：γ data 路径上 `dataGateOpen` 前置检查仅残存于 egress 前置门（γ session port dormant `hub-session-async-host.ts:219`、β 工厂 port dormant `hub-session-host.ts:186`、α 经真实 port `hub-session.ts:226`）；禁止清单三项 = 暂停项在有面传输的逐项可观察产物（0 弹回/tag pending/ackTimeout resync 存活）。**读法 A/B 的规范裁定归 SA8（§16 专递），本评审不预断**——两读法下翼(i)/D3/AC2–AC6 锚集均不受影响（设计 §16 裁定影响面声明核验一致） |
| §24.5（:1130-1139 逐字）：越界即 1011；β 差登记；单帧超限 = 配置错误；内存链「越界即死……最坏账 = cap + control 后死亡释放」；OPEN 水位 = 故障参数 | §7-D1/D3/§9.4/D7 | 原文在；翼(ii) 使死亡释放机制在有面传输可达 = §24.5 :1137 的兑现路径闭合（iteration 0 F-1 指出的不可达性被本版消除） |
| §4/§17 水位条目（:587「socket 缓冲不可撤回，由水位暂停与 1011 承接」；:589「> high-water 暂停 dequeue……缺面视为 0——数据总量仍受准入与 1011 收口」） | §7-D1.5（保留面）+ §16 读法 B 如实呈现 | 原文在；设计未隐藏对立条款而是窄框架专递（§16 读法 B 引文准确）；水位机械保留面（α 闸门/control 额度/缺省前置门/链式校验/水位事件）与源码一致（`sendControl`/`sendControlFrame` 暂停态额度 :115-126/:149-158、poll 仅暂停期武装 :316-328、`validate.ts` `lowWater < highWater ≤ cap` + 「可恢复暂停阈值先于终止性 1011 阈值」注释实查在场） |
| A4.5/§24.7 生命周期单规则 | §7-D5 零改动 + 锚 | 原文在；`closedFlag` 二道闸（:759）、close 冲刷（async host :196-202）实查在场 ✓ |
| A4.1/§24.3 缝词汇闭集合 | §6/D1/D4 零新缝消息 | 翼(ii) 为 edge 内部行为（构造期布尔 + 门前置项），不上缝、无新词汇 ✓ |
| ADR 后果 :112 公开面 append-only | §7-D2/D9 option append（9→10 成员） | `hub-edge-host.ts:151-167` 实查恰九成员；前置门分叉无公共类型面（`HostEdgeConnection` 内部类不导出）✓ |
| SA8 报告 R1–R6（iteration 0） | §6 末行/§11/§12.2-7 | R5 方向性登记句落实于 D8（含 N3 双向误用）；R1–R4/R6 纳入验证门；设计如实申报 iteration 0 报告未审翼(ii)（§15-2）✓ |
| #447 设计 §9.1 egress ≤ 0 行（:488） | §7-D1 衔接段（修正后表述） | 原文核验：该行自带「水位暂停路径在**无 `bufferedAmount` 传输上** dormant」限定；本版两翼使该限定从句对 γ data 帧失效——衔接声明与原文及新机制一致（首版「丢弃限定」的失真已修复）✓ |
| A4.8 验收纪律 | §7-D6/§12 | 全部夹具 = 通道对 + 显式释放 + 虚拟调度器；F1 有面形态经 #137 `applyPressure` 先例（:139-146 `Object.defineProperty` 实查）✓ |

## 设计内部一致性

- §1 目标 1（两翼）↔ §2-A4（前置门 = F-1 本体）↔ §3-S8 ↔ §7-D1/D1.5 ↔ §8.1-⑥/doc append ↔ §8.2 SM-5 改判 ↔ §8.3-R2/R4 ↔ §9.1 0 值格 ↔ §9.4 ↔ §10 三行 ↔ §12 `BPK-C4/NC2` ↔ §13-R8/R9 ↔ §14 映射 ↔ §16：**十五处逐点同声，无前后相反、无死引用、无「附录承认正文未改」的伪修订**。
- §8.1 伪码与源码同构性核验：-② 与 `backpressure.ts:165-173` 逐行同构（仅增两行可选调用；投影口径/次序/严格大于判据逐字）；-⑥ 与 `hub-edge-host.ts:685-699` 现行构造同构（增第三参 `pausePreGate`，缺省 `true` 时 `closed ∨ (true && ¬gate)` ≡ 现行 `closed ∨ ¬gate`，短路次序保留）；-④ 条件挂接与 `hub-edge.ts:203-217`（**13 项**，实数核准）相容。
- 0 值语义格（§9.1）逐形态对代码核验为真：γ 下 0 ∈ {closed 闸（:683-684 setConnState 先于返回）、oversize fatal、ledger fatal}——三者全部伴随已收口；`emitFrame → emitOne`（`frame-io.ts:184-205`）唯一非正常路径（序号耗尽）= 响亮 throw + 1008 收口（`onSequenceExhausted` :719-738），**无静默 0 漏网形态** ⇒「0 ⟺ 已收口」doc append 为真陈述。
- §14 修订映射表：F-1/N1–N6 声明的修订位置逐一对勘实际文本，全部命中；无「映射表声称但正文缺席」项。

## 状态机与并发攻击

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| SM-1 | ready | 守卫栈内同步回调 `connectionFatal`（含 `sender.teardown()`） | 回调后 `tryEmitDataFrame` 仅 `return 0`、不读 sender 状态；与既有 `sendControl → onBackpressureExhausted → connectionFatal` 同型重入 | 无（`connectionFatal` :673-698 全序同步段核验：teardown → ERROR 直发 → closedFlag → state → sinkClose → transport.close → observer → cleanup） | — |
| SM-2 | 收口中/已收口 | 多帧连撞守卫；钩子重入；control 耗尽并发 | `closedFlag` 幂等恰一收口（:674）；后续帧撞 `closed` 前置闸 0（DROP-C1 域） | 无 | — |
| SM-3 | 已 fatal、'close' 在缝上在途 | session 侧 ackTimer 先火 | resync 控制帧经已关 transport ⇒ 零 wire 字节（`hub-edge.ts:196-197` 发送门） | 无 | — |
| SM-4 | drain 窗口 | `settled` 收口后晚达 | `maybeFinishDrainEarly` 的 `closedFlag` 二道闸（:759）零二次收口 | 无 | — |
| **SM-5（改判核验）** | ready、慢对端、`bufferedAmount` 在场且增长 | 修订前：`> highWater` ⇒ 前置门 0 弹回（帧未达守卫）；修订后（翼 ii）：前置门仅 `closed` 项 ⇒ 帧恒达守卫，投影含 `observe()` 随 socket 账目增长，`> cap` ⇒ 恰一 1011 | `BPK-C4` 锚 + 判别性观察（`level() > highWater` 时仍有帧放行盖章——highWater 4096 < cap 8192 存在可观察窗口）；多帧连撞由 SM-2 收敛 | 无 | — |
| **SM-8（新）** | ready、γ、data 持续放行、control 发送触发 `observeWater` 进入 paused | 暂停态下 data 帧继续到达 | paused 仅作用于 control 额度记账（`sendControl`/`sendControlFrame` :115-126/:149-158）与 drainData（:256，hub edge 无 facets ⇒ 结构性 inert，`dataFacetOf(): undefined` :674 实查）——**不作用于 `tryEmitDataFrame`**（源码核验：该方法无 paused/isEmitAllowed 检查）；终局 = data 投影越界（新钩子 1011）或 control 额度耗尽（既有 1011），均连接受口 | 无（设计 §9.1 水位行/§8.2 与代码一致） | — |
| **SM-9（新）** | 装配期 | `pausePreGate = options.asyncDataAdmissionFatal !== true` 构造期定值 | 常量布尔 ⇒ 无运行时切换/竞态；单构造点（:947 实查）⇒ 无第二实例漂移 | 无 | — |
| SM-6/SM-7 | OPEN 挂起 / F1 advance | 迟到 resolve / 水位下降 | 既有台账不摘除 + 1008；`observe()` delta<0 退休回落（:370-388） | 无 | — |

## 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| ER-1 | 账本投影越界（无面/有面两形态） | 1011 终局：ERROR + close + observer + close 冲刷；hub 无自动重试、peer 重连恢复 | 无（目标语义，双形态锚定） | — |
| ER-2 | 单帧 > cap | FRAME_TOO_LARGE/1009 终局；`update-sent` 零发射（`sequence>0` 门 :267-271） | 无 | — |
| ER-3 | egress 返回 0（γ data 帧） | **修订后为真陈述**：0 ⟺ 已收口（三形态均伴随收口；序号耗尽 = throw + 1008 非静默 0——`frame-io.ts:184-205` 核验） | 无（iteration 0 的文档谎言风险消除） | — |
| ER-4 | 收口 ERROR 直发记账 | `onEmitted` tornDown 早退（:208-209）+ `connectionFatal` 先 teardown 后直发（:676-679）⇒ 账本零增长 | 无（§9.4 上界闭合） | — |
| ER-5 | 慢连接持续压力（有面传输） | **修订后消除**：翼(ii) 使该形态以 1011 死亡收口（`BPK-C4`），β 形态泄漏仅存于漏置位装配（`BPK-NC2` 固化为可执行负控 + D2/AGENTS.md 方向性义务） | 无（iteration 0 的未登记例外面已闭合） | — |
| ER-6（新） | 桥释放循环中段 fatal：残余 sessionToEdge 消息撞 closed 闸返回 0（夹具 `unsealed++`） | R3 预期行为登记 + 断言指南区分三种 0 值来源 | 无（编排风险已登记，非生产风险） | — |

## 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| `HubReplicationEdgeOptions` append（九→十，实查 :151-167 恰九成员） | 无缺口：421 test-d append（:15/:123「九成员」实查在场，D9 改写义务真实）；`src/index.ts:90` 类型再导出流动、index 零改动 | 同左 | — |
| `ConnectionSenderHost` append（**13 成员**，接口与 hub-edge host 对象字面量双侧实数核准——N1 订正落实） | 可选成员缺席 ⇒ peer（:373-384 自有 host、无字节形态成员）零变化 | `backpressure.ts:43-69`、`hub-edge.ts:203-217` | — |
| `HostEdgeConnection` 构造器增参（内部类） | 单构造点（:947）+ 构造期常量 ⇒ 无其他调用方；内部类不导出 ⇒ 无公共面变化 | `hub-edge-host.ts:681-700/:909-948` | — |
| `HubReplicationEdgeEgress.sendDataFrame` doc（0 值语义 append） | 无缺口：γ 形态陈述与代码逐形态一致（ER-3 核验）；缺省形态「0 = 拒纳」三来源保留原语义 | `hub-edge-host.ts:121-123/:694-695`、`frame-io.ts:184-205` | O1（见 non-blocking） |
| γ 桥 0 值消费 | 无缺口：桥机械不变（:498-517 实查 `sequence > 0` 才投回执、`unsealed++`）；F4 禁桥合成收口 | `issue447-async-seam.ts:498-517` | — |
| β 直驱宿主（缺省装配） | 零变化（`pausePreGate=true` 语义逐字保留）；`BPK-NC2` 锚 | `hub-edge-host.ts:694-695` | — |
| α 组合根 / peer | α 经**内部** `createHubReplicationEdge`（`hub-connection.ts:331-352` 实查，不经公共工厂 allocate ⇒ 不构造 HostEdgeConnection、前置门不在其路径；α 水位经 session 真实 port `hub-session.ts:226` 保留）；peer 自有 host | 同左 | — |
| observer 消费者 | 取值面不变（两码白名单 `observer.ts:48-53`、注册表 `errors.ts:105/:116` 实查）；水位事件经 control/poll 边沿照常（极端纯 data 无 control 形态设计已登记） | 同左 | — |
| `AsyncFacadeOptions` append ×2（`asyncDataAdmissionFatal` 转发 + `deferSinkResolve`） | 可行性核验：facade 内部经公共工厂组装（:434）、`AsyncSeamHost.acceptTrusted` 在场（:582-583/:308-311）⇒ D7 白盒编排真实可达 | `issue447-async-seam.ts:298-345/:434` | — |

## 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| 流控越界判死（守卫 + 前置门两处） | edge（A4.3 流控单点） | 翼(i) 钩子汇入 edge `connectionFatal`；翼(ii) 前置门分叉在 edge 装配闭包（`pausePreGate` 构造期由工厂 option 决定） | ✓ 两翼均在 edge 半边；session 半边零改动（DENY）；否决备选 (d) 维持 |
| reason→码映射 | edge（§24.3 单点） | §8.1-④ 构造器条件挂接 | ✓ |
| 收口执行 | edge `connectionFatal` 单点 | §7-D4 复用（:673-698 拓扑逐点核验） | ✓ |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| control 额度耗尽 → 1011 | `backpressure.ts:121/153` → `hub-edge.ts:214` | data admission 两翼同码同拓扑 | 一致 | 零新拓扑 |
| 装配期形态标记 | `listen: false` 精确值、`asyncSendTickets` 单点置位、`edgeObserver`（#448 append 先例，`AsyncFacadeOptions` 实查在场） | `asyncDataAdmissionFatal?: true`（工厂 option → allocate 双落点） | 一致 | 同款「装配期知识、不运行时 policing」纪律；allocate 单构造点支撑双落点（:909-948 实查） |
| 水位暂停机械 | `observeWater`/poll/退休（`backpressure.ts:286-388`） | 原样保留（α 闸门/control 额度/缺省前置门/链式校验/水位事件）；仅 γ data 前置门项让位 | 一致（有据分叉） | 无平行机制：不新建第二套水位/调度；暂停状态机照常运行，仅其 data 前置消费点在 γ 下移除 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| γ/β 形态 | 工厂 option（装配期单点） | `pausePreGate` 构造期常量 + 钩子条件挂接（同一 option 派生两翼，无第二开关） | 低；漏置位方向已双锚（AGENTS.md 方向性义务 + `BPK-NC2`） |
| 连接账本 | `ConnectionSender` 单台账 | 无第二台账；前置门分叉不引入记账 | 无 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| 连接建立（allocate） | `connectionFatal`/close → teardown + requestSinkClose + cleanupAll | `closedFlag` 幂等；drain 句柄清理；poll 随 teardown 清除（:238-251） | ✓ 全部既有单点复用，翼(ii) 无新句柄 |

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 第二发送调度 / γ 专用 egress | `ConnectionSender` + `HostEdgeConnection.egress` | 否决备选 (b) 维持；翼(ii) = 同一 egress 装配的条件项 | ✓ |
| 桥侧合成收口 | edge 发起 | 否决备选 (a)，F4 维持 | ✓ |
| 第二测试管道 | #447 通道对 + 显式 release | `bootFlowRound` 镜像 `bootLiveRound` + accept 装饰（F1 旋钮，#137 `applyPressure` 先例） | ✓ 不触碰 `issue448-live-seam.ts`（DENY），比 SA6 §12.1 预告更窄且理由成立（iteration 0 已判，维持） |

## 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW 8 项 vs 正文触点 | 逐项核对：3 个 src（backpressure 守卫+头注 / hub-edge 配置+挂接+映射 / hub-edge-host option+allocate 双落点+**前置门分叉**+doc append）+ AGENTS.md append（D8 全文）+ 2 新测试文件 + `issue447-async-seam.ts` append（标记转发 + F2 双旋钮）+ 421 test-d append——§7/§8/§12 所需触点**无遗漏、无越界**；`hub-edge-host.ts` 行本版扩至前置门分叉与 F-1 修订本体一致 | — |
| DENY 与正文冲突 | 无冲突：session 侧/`hub-connection`/peer/`frame-io`/`index.ts`/`testing.ts`/`issue448-live-seam.ts`/规范文档全零改动，正文声明一致；`testing.ts` 行引用已按 N5 订正（SA6 §12.1 + §16） | — |
| follow-up 掩盖必要项 | 无（T3/T5 归属明确；§16/R9 是规范裁定 contingency 非顺延；根门禁 §12.2-5 照跑） | — |

## 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1 红→绿双形态（`BPK-C1` 无面 / `BPK-C4` 有面不 advance） | 恰一 ERROR/1011/close/observer + 全泵后零 RESYNC_REQUIRED；**C4 判别性观察**（`level() > highWater` 时仍有帧放行盖章）+ limits 链式满足（2048<4096≤8192） | 无（虚拟调度器 + 显式 release ⇒ 确定性可编排；真 peer ACK ⇒ 窗口周转，R2 重连噪音已登记） | — |
| AC1 负控成对 | `BPK-NC1`（β：`RESYNC_REQUIRED{send-failed}` + 存活）+ `BPK-NC2`（缺省装配 + γ 桥 = 漏置位形态：前置门弹回 + `unsealed++` + 存活 + ns 级 resync） | 无（NC2 使翼(ii) 分叉真实性与仅 γ 门控双性质可执行验证） | O2（cause 精确化建议） |
| AC2（`OVS-C1/NC1/NC2`） | 直驱面 + `makeLargeUpdateFrame` 合法大帧构造器；NC1 = cap 64KiB + `advance(level())` 清账双保险（N2 落实） | 无 | — |
| AC3/AC4/AC5 回归哨兵 | DROP/FLUSH/REVOKE/DRAIN 族与 P3–P6 同构；FLUSH-C2 判别力引 #447 PEND-C3 | 无 | — |
| AC6（OPENWP γ permutation） | D7 两到界形态（4 deferred OPEN / 1 OPEN + 15 缓冲帧，N4 正措辞与 OAP-C4c/C4d 实际模式一致）；γ 注入面可行性实查成立 | 无 | — |
| AC7（MEM 双形态） | 两跳判然两分（session queue-overflow ns 级存活 vs edge 1011 死亡）+ 行为代理主锚 + 计数直锚可选（N6 落实） | 无 | — |
| PUB 类型面 | test-d append 成员行 + 「九→十」措辞 + `@ts-expect-error` 非法值 ≥1 + 缺省字面量 satisfies 保持 | 无 | — |
| 采集面/纪律 | §12.0 统一纪律 + 根 vitest glob（SA6 §14 已以同目录探针实证） | 无 | — |

---

## Required revisions

**无（本版无 BLOCKER/MAJOR）。**

### 上轮 finding 处置核验（iteration 0 → 1）

| Finding | 处置 | 核验结论 |
|---|---|---|
| **F-1（MAJOR）** | 采用备选 (A)：翼(ii) 前置门分叉 + `BPK-C4`/`BPK-NC2` 双锚 + doc/0 值格/调用方矩阵/内存论证同步改写 + §16 规范解释专递 + R8 取舍登记 + (e)/(f) 否决理由 + R9 降级路径 | **已关闭**：三处无条件「0 ⇒ 已收口」声明全部改写为逐形态真陈述（ER-3 源码级核验含 throw 路径）；暂停边界由「未裁定」变为「裁定 + 落地 + 可执行锚」；AC1 适用域 = 一切传输形态且有正负控成对；规范解释按上轮要求移交 SA8（§16） |
| N1（17→13 成员计数） | §7-D9/§8.1-①/§10 订正 | 已落实（双侧实数 13 核准） |
| N2（OVS-NC1 校准） | cap 64KiB + advance 清账 + 原因注明 | 已落实 |
| N3（双向误用登记） | D2/§8.1-⑤/D8/R1 + `BPK-NC2` | 已落实 |
| N4（OPENWP 措辞） | D7/OPENWP 行两形态分列 | 已落实（与 :607-622 实际模式一致） |
| N5（testing.ts 引用） | DENY 行改引 SA6 §12.1 + §16 | 已落实 |
| N6（MEM-C2 代理） | 行为代理主锚 + 计数直锚可选 | 已落实 |

## Non-blocking observations

| ID | Observation | Evidence | Suggested change |
|---|---|---|---|
| O1 | egress `sendDataFrame` 既有 doc/内部注释的「**次序 = `hub-session.ts:210–216` 等价**（门前置 → 守卫 → 账本）」措辞在 γ 装配下不再成立（仅剩 closed 项）——设计 §8.1 doc append 只声明改写 0 值语义，未点名该次序镜像句 | `hub-edge-host.ts:121-123`（公共 doc）与 `:693`（内部注释） | 实现时在同一 doc append 变更集内把该句改为按装配分形态（缺省 = 等价次序保留；γ = 仅 closed 项 + 守卫直达），避免镜像陈述过期存活 |
| O2 | `BPK-NC2` 断言「ns 级 `RESYNC_REQUIRED`（β 形态）」未钉 cause——漏置位形态的 cause 是 `ack-timeout`（tag 停留 pending），与 `BPK-NC1` 的 `send-failed` 不同；两负控同称「β 形态」易在实现时误抄断言键 | `update-channel.ts` γ/β 分支差异；`BPK-NC1` 行自身已钉 `{cause:'send-failed', reason:'send-frame-rejected'}` | `BPK-NC2` 行补注 cause = `ack-timeout`（与 NC1 判别），断言键各自精确 |
| O3 | D1.5「`send-paused`/`send-resumed` 照常发射（经 control 发送与 poll 边沿）」目前无专属断言；γ data 路径不再消费 `dataGateOpen` 后，水位事件的可观察性完全依赖 control 侧观察点 | `backpressure.ts:116/:150/:194/:316-328`（observeWater 调用点收敛） | 可选增强：`BPK-C4` 编排在 `edgeObserver` 面追加断言「压力期水位事件仍可达（非依赖 data 前置门）」——设计已登记极端纯 data 形态，非缺口，仅为使保留面声明可执行 |
| O4 | §16 裁定依赖登记：翼(ii) 与 `BPK-C4/NC2` 的语义系于 SA8 iteration 1 对读法 A/B 的裁定；R9 降级路径（单点 revert + 0 值格回三来源 + AC1 适用域限定）已预写、无设计空窗 | 设计 §16/§13-R9 | 流程性：实现阶段启动翼(ii) 落地前确认冲突门 iteration 1 结论；若裁定为 B，按 R9 执行并回本评审映射 |

---

## 复核说明

- 本 approve 的边界：F-1 修订（备选 A）在**设计层面**完整、一致、可验收锚定；翼(ii) 的规范正当性由 §16 专递的 SA8 裁定终决（`requiresConflictRecheck: true`）——若裁定为读法 B，R9 是已界定的最小修订（翼(ii) revert + 文本形态回退），不触及翼(i)/D3/AC2–AC6 锚集。
- SA8 iteration 0 报告的 `clear` 结论覆盖首版（守卫单点分叉）；其 R1–R5 实现期义务对本版仍然有效（§6 末行承接），R5 方向性登记句的措辞义务以 D8 全文为准（含 N3 双向误用）。
- `pass`/approve 不替代 SA4/SA7 对实现与活链路的验证；§12.2 六道门（聚焦/γ 族/缝邻接/包全量/根门禁/β-α 硬门）为实现阶段硬门。
