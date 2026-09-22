# 冲突门禁报告 — Issue #424 分片形态端到端等价性验收（SA6 契约 + SD-1~SD-4）

## 1. Reviewed subject: task（前置门禁）

- 任务：Issue #424「分片形态端到端等价性验收（spec #415 T7）」，Parent = PR #416（spec/415-replication-transport-decoupling）。
- 被审对象：**已接受 SA6 契约** `wiki/raw/task_issue-424_sa6_contract.md`（340 行全文逐条）——含其约束集 §3、验收契约 §12.0–§12.7、硬门定义、以及 **§12.8 四个未决范围决策 SD-1~SD-4**。
- 简报：`wiki/raw/task_issue-424.md`（AC1–AC6）；Issue 评论 REST 快照为空（dispatch 明示 `[]`）——**无 Owner override 可映射，也无被忽略的 Owner 要求**。
- 本报告不重审 SA6 的证据质量/断言充分性（SA2 域），只裁决其**与既有决策集的冲突等级**。

## 2. Inputs and decision set

- 冲突基准（全读，无抽样）：
  - `docs/adr/` 全集 **31 文件**（0001–0030 + 0032；**无 0031**）。状态盘点：除 0015 为「提议」（非约束）外全部 accepted；0007 open/read 条款、0016 交付条款、0024 截断清单通道分别被 0008/0027 修订——**复制域（0010/0012/0013/0022/0032）无 superseded**。
  - 根 `CONTEXT.md` 全部术语条目（重点：复制 Edge L225–227、SessionHost L229–231、路由键契约 L233–235、分块族 L205–223）。
  - `docs/protocols/instance-replication-v1.md`（规范 wire 契约）§3/§5/§6/§7/§12/§13/§14/§17/§21/§22/§23。
  - `packages/ws-replication/AGENTS.md`（模块收录决策）+ 根 `AGENTS.md`「Instance replication」节。
- 辅助核验（事实确认，不构成独立基准）：`packages/ws-replication/src/hub-edge-host.ts`（`allocate()` 的 connectionKey 生成 ≈L915、denied/throw 终态闩锁 L211–216/L416–425、sink 解析失败收口 L15–20/L81/L108——SA6 SD-2/SD-3 引用属实）、`hub-session-host.ts` `open()` 重复 (connectionKey, namespaceId) 响亮拒绝 L247–253（SA6 SD-3 引用属实）、`src/index.ts` 公共导出、`hub-connection.ts` L48 `createHubReplication`。
- 基线亲验：HEAD `cab3e8c245ef189da1d823719370a68459939316` 与 SA6 §1 声明一致；`git status` 仅 SA6 工件（wiki/raw/task_issue-424*、artifacts/sa6-issue424-*.log），`packages/**` 零改动——SA6 §16「test-only、零生产改动」属实。
- 条款摘录与行号锚见 `wiki/raw/task_issue-424_relevant_decisions.md`（本报告关联产物）。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0032 决策 1：协议状态机单份，只允许分布式实例化 | `0032-….md` L14；否决备选 L57–60 | SA6 harness 只装配公共工厂（真 `createHubReplicationEdge`/`createHubSessionHost`/Registry/Runtime），零自写协议行为（§10/§12.0 纪律） | **implements-existing-decision** | L14「协议状态机保持单份实现，只允许分布式实例化」；验收任务正是该「分布式实例化」义务的证据化 | 无 |
| 2 | ADR 0032 决策 2 + 协议 §3（L57）| `0032` L18；协议 L49–61 | SEQ-C1：出站 envelope `[8..12]` BE = 1..N 严格递增、per-connection 重起算；入站序 edge 校验；硬门 hex 逐帧 | **implements-existing-decision** | L18「edge 在 mux 点重写帧字节 `[8..12]`」；协议 L57「从 1 严格递增」；ADR 0010 L147「每方向 sequence 从 1 严格递增，不回绕」 | 无 |
| 3 | ADR 0032 决策 3 + A2-β + CONTEXT.md SessionHost | `0032` L22/L47–48；CONTEXT.md L230 | AUTH-C2/C3：denied/throw 分片侧**零 session 建立**、wire 逐字节等 | **implements-existing-decision** | 「未授权 OPEN 不过缝」；「denied/throw 不过公共缝，由 edge 侧处置」；源码佐证：`hub-edge-host.ts` L420–425 终态闩锁在 edge 收口、`resolveSessionSink` 仅授权通过后调用（L17–18） | 无 |
| 4 | 协议 §7.1 OPEN 矩阵 + ADR 0032 决策 3 | 协议 L176；`0032` L22 | AUTH-C1/C4、NC2：pass 重 OPEN → OPEN_OK×2（每请求收答）；闩锁期重 OPEN → `NAMESPACE_REOPEN_REQUIRES_RECONNECT`；authorize 恰一次 | **implements-existing-decision** | L176「重复 OPEN 合流……每个请求都收到 OPEN_OK 或 ERROR；closed/conflicted/failed 后返回 NAMESPACE_REOPEN_REQUIRES_RECONNECT」；`0032` L22「重 OPEN 经 openWaiters 合流不重复 authorize」 | 无 |
| 5 | 协议 §13.2 注册表 | 协议 L424/L425/L430/L442 | 四态语料错误码/终局：NAMESPACE_UNAUTHORIZED→failed、namespace INTERNAL_ERROR→failed、NAMESPACE_STATE_VIOLATION→failed | **implements-existing-decision** | §13.2 注册表逐行吻合（SA6 §3.4/§3.6 引用属实） | 无 |
| 6 | ADR 0032 决策 4 + CONTEXT.md 路由键契约 | `0032` L26；CONTEXT.md L233–235 | SHARD-C3/NC1：从未 OPEN 的 ns 帧 → 合成 `NAMESPACE_STATE_VIOLATION`、连接存活、双形态逐字节等 | **implements-existing-decision** | L26「合法无 sink → 合成 NAMESPACE_STATE_VIOLATION；违例 → MALFORMED_FRAME fatal」 | 无 |
| 7 | 协议 §22 互通矩阵等同性纪律 | 协议 L701 | 硬门定义：逐字节断言只落无 Yjs 载荷控制帧；数据帧按 kind#seq 骨架 + `Y.applyUpdate` 语义等值（O7 证明全轨迹逐字节连单体自身都不成立） | **implements-existing-decision** | L701「跨会话字节/长度全等因 Yjs 随机 doc client id 不适用——三层确定性断言」——SA6 硬门口径是该既登纪律的直接套用，非自创放宽 | 无 |
| 8 | ADR 0032 决策 5/A3 + 协议 §23.1 | `0032` L30/L53；协议 L838–845 | H8：契约只锁 wire、不锁 observer 事件集（未授权 OPEN 无 `channel-state-changed` 为已登记文档化差异） | **implements-existing-decision** | 协议 L844「工厂/分片形态下未授权 OPEN 不产生 channel-state-changed……属文档化差异，非事件缺失」；L838–841 发射侧归属表 | 无 |
| 9 | 协议 §6.3/§21 + ADR 0010 L179/L684 | 协议 L159/L684 | REAUTH-C1/C2：GOAWAY(REAUTH_REQUIRED) 恰一帧、drain 提前完成 close(1001)、阴性对照归因 | **implements-existing-decision** | L159/L684「全部 channel 终态时提前完成 drain；否则 deadline 到达以 WS 1001 关闭」 | 无 |
| 10 | 协议 §19/§12 + ADR 0032 A1 | 协议 L647–651/L366–371；`0032` L38–39 | REVOKE-C1~C3/ROUND-C3：terminateUnauthorized 恰一次、末帧与单体逐字节等、CLOSE_OK.ackedSequence 回指、settled 恰一次、幂等无副作用 | **implements-existing-decision** | §19 revoke 触发 namespace 终止 ERROR + cleanup；A1 `terminateUnauthorized` 幂等、`settled` = drain 提前完成判据 | 无 |
| 11 | 协议 §5/§6.1 + CONTEXT.md 分块族 | 协议 L114/L137；CONTEXT.md L213–215 | NC4/ROUND-C4：协商/非协商两形态 parity；协商形态断言 `selectedCapabilities & CAP_CHUNKED_UPDATE ≠ 0` 与描述子协商位 | **implements-existing-decision** | §5「0x42 只有经 HELLO 协商后才能使用」；§6.1 bit 值 `0x00000001` 锁定 | 无 |
| 12 | 协议 §17 计数口径 + ADR 0032 A3 | 协议 L582 | 契约不把分片形态 per-session assembly 计数当违约（观测面不锁） | **no-conflict** | L582 已登记 listen（per-connection）/分片（per-session）双口径为文档化差异 | 无 |
| 13 | ADR 0032 后果节公共面冻结 + 模块 AGENTS | `0032` L64–66；ws-replication/AGENTS.md | §12.0：本票零公共面变更、DENY LIST 覆盖 src/协议包/apps/domains/docs；GATE-C3 要求 src 零 diff | **no-conflict** | L66「公开面……一经发布即按 SA6 纪律冻结，演进只能 append-only」——冻结被遵守而非触碰 | 无 |
| 14 | ws-replication/AGENTS.md 测试纪律 | AGENTS「Use injected transport, scheduler…」+ 验证门 | §7 时间纪律（注入 timer/scheduler + 微任务、禁真实 timer/网络）；GATE-C1/C2 根全量 + typecheck 同轮绿；测试入口真实、无 skip/only/env override | **implements-existing-decision** | 模块 AGENTS 逐句对应；根 AGENTS.md 验证门同款 | 无 |
| **SD-1** | ADR 0032 后果 L66 + 协议 wire 冻结 | — | SA6 立场：套件暴露真实生产偏差时**停手报 SA8/设计**，不就地修生产（ALLOW LIST test-only） | **no-conflict** | 偏差 = 实现偏离 ADR 0032「wire 逐字节不变」承诺；修复只能新变更集：对齐实现 = implements-existing-decision，改契约 = evolution-required（须同变更集修订 ADR/协议）——SA6 立场即冻结纪律的正确执行 | 设计采纳「停手报 SA8」路径；若偏差成真，修复票按 #16 分类重过门禁 |
| **SD-2** | ADR 0032 决策 3 L22「sink 失败响亮连接收口」+ CONTEXT.md 复制 Edge L226 + 协议 §13.1 L415 | — | 早到 OPEN（宿主登记先于 `accept*()` resolve）双处置：(a) harness 预登记 connectionKey；(b) 冻结响亮收口（连接级 INTERNAL_ERROR + close 1011）为文档行为 | (a) **no-conflict**；(b) **implements-existing-decision** | (b) 的实测形态（`hub-edge-host.ts` L20/81/108）逐字兑现「sink 解析失败响亮连接收口」这一 Edge **规范职责**（CONTEXT.md L226），错误码/收口码吻合 §13.1/§14；(a) 为测试侧装配纪律，键格式 `${instanceId}-conn-${n}` 属实现内部事实、非 ADR 冻结面 | 设计二选一并记录；(b) 只能作为**退化路径处置**冻结在测试文档——若要把该形态或宿主登记义务写入规范文档（docs/**），超出 test-only DENY 面，须另行演进检查 |
| **SD-3** | ADR 0032 A2-β L48「同一 (连接, namespace) 至多一个承载机械」+ 后果 L66 | — | 同进程多 edge 工厂（同 instanceId）+ 共享 SessionHost 撞键：交付 harness「每场景一工厂」或按工厂维度加键前缀；是否写入宿主指引留设计 | **no-conflict** | 撞键场景（多工厂同 instanceId）不违反任何决策条款——A2-β 的唯一性作用域是 (连接, namespace)，生产拓扑（每 hub 实例单 ingress edge）不要求跨工厂全局唯一；`hub-session-host.ts` L247–253 的重复开启响亮拒绝恰是 A2-β 义务的执行 | 处置必须留在 harness 侧；**生产侧改键格式/加工厂选项 = 公共面 append-only 演进**（ADR 0032 L66），在本票 DENY 面之外，须新票重过 SA8；若设计认定需写入宿主指引文档，须先扩 ALLOW LIST（docs/** 现为 DENY） |
| **SD-4** | 协议 §22 L701（分块深度/全矩阵资产锚已登记：#243/#246/#300/#301 套件）+ §5/§6.1 | — | SA6 推荐：本票只锁「协商形态回合完整 + 协商位可见」；chunk 深度矩阵归既有套件，避免重复冻结 | **no-conflict** | §22 已把分块 conformance 义务锚定到既有资产（codec golden / issue246 interop / issue300 / issue301）——最小读法不留 conformance 缺口；深读法（超限 UPDATE 端到端分块）也只是兑现 ADR 0013 义务，两读法均不违约 | 设计择一并记录理由；无论择何，协商形态必须真协商（NC4/ROUND-C4 的协商位断言不得删） |

裁决分布：**no-conflict 8 项（含 SD-1/SD-2a/SD-3/SD-4）、implements-existing-decision 11 项（含 SD-2b）、evolution-required 0、hard-conflict 0**。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| — | — | — | — |

无 override 声明需求：Issue 评论快照为空（`[]`），无 Owner 评论可作覆盖权威；SA6 契约不修改任何决策文本；四项 SD 的全部合法分支均在既有决策边界内，无需 override。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（task 门禁：本票计划接触方式） |
|---|---|---|---|
| Wire envelope + sequence | 20 字节固定头；`[8..12]` uint32 BE 从 1 严格递增（per connection） | 协议 §3 L49–61 | 套件只观察，零改动 |
| 消息注册表 | 消息码 append-only；`0x42` kind 首字段单形态、仅协商后可用 | 协议 §5 L91–116 | 只观察 |
| HELLO/HELLO_ACK | 字段序 + `CAP_CHUNKED_UPDATE = 0x00000001` + selectedCapabilities 交集语义 | 协议 §6.1–6.2 L133–149 | 只观察（NC4/ROUND-C4） |
| 错误注册表 + WS close code | §13.1/§13.2 全码表（含 INTERNAL_ERROR→1011、NAMESPACE_UNAUTHORIZED→failed）append-only；§14 分类 | 协议 §13/§14 | 只观察 |
| GOAWAY/drain 语义 | drain 提前完成 / deadline 1001；REAUTH 窗口 OPEN 静默丢弃 | 协议 §6.3/§21 | 只观察（REAUTH-C1/C2） |
| ADR 0032 决策 1–5 + A1–A3 | 缝词汇、三载体 α/β/γ、dormant 降级面、发射侧归属 | `0032` 全文 | harness 装配兑现，零修订 |
| 公共工厂面 | `createHubSessionHost` / `createHubReplicationEdge` / `createHubReplicationPlugin({listen:false})` 签名冻结、演进仅 append-only | `0032` L64–66；CONTEXT.md L226/L230 | 本票零公共面变更（§12.0 DENY） |
| Observer 36 型词表 | append-only；发射侧归属表；未授权 OPEN 无 channel-state-changed 为文档化差异 | 协议 §23.1 | 契约不锁 observer 集（H8），零改动 |
| 路由键布局 | 定偏移事实集 + 结构性守卫测试 | CONTEXT.md L233–235 | 零改动 |
| assembly 计数口径 | listen = per-connection / 分片 = per-session（文档化差异） | 协议 §17 L582 | 零改动（不纳入 parity 硬门） |
| 生产源码/规范文档 | `packages/ws-replication/src/**`、`packages/replication-protocol/**`、`apps/**`、`domains/**`、`docs/**` 零 diff | SA6 §12.0 DENY；GATE-C3 | 计划即 test-only；已亲验 HEAD 基线零生产改动 |
| 既有 455 测试文件 | 既有断言不得修改以就范 | SA6 §12.0 纪律 | 零改动 |

## 6. Evolution requirements

**无 evolution-required 项**：SA6 契约（含其推荐立场）不改变任何 ADR/CONTEXT/协议条款；SD-1~SD-4 的全部合法分支在既有决策边界内闭合。

条件性边界登记（**不是**当前演进项，触发时须重过门禁）：

1. SD-1 触发（套件暴露真实偏差）→ 修复票若为「实现向 ADR 对齐」= implements-existing-decision；若需改 wire/协议语义 = evolution-required，须同变更集修订协议/ADR 并重过本门禁。
2. SD-3 若走向生产侧（改 connectionKey 生成格式 / 加工厂选项）= 公共面 append-only 演进（ADR 0032 L66），新票重过 SA8。
3. SD-2(b) 若要把早到 OPEN 响亮收口或宿主登记义务写入规范文档（docs/**）= 超出本票 DENY 面，须扩 ALLOW LIST 并检查是否构成决策面新增。
4. SA6 §15-4 已自行登记：若设计坚持「全轨迹逐字节」硬门，需确定性 clientID 注入方案 = 超出 DENY 面的新票——本报告确认该判断（与协议 §22 L701 纪律一致）。

## 7. Hard conflicts

**无**。逐项对照见 §3：被审契约的约束集、硬门定义与四项 SD 均为既有决策（ADR 0032 五决策 + A1–A3、协议 §3/§5–§7/§12–§14/§17/§21–§23、CONTEXT.md 复制域术语、模块 AGENTS）的兑现或边界内裁量，未发现任何无 override 的不兼容。

## 8. Required actions

（非阻塞；交设计/下游执行，均在本报告裁决边界内）

1. **设计必须显式裁决 SD-1~SD-4**（SA6 §15-1 已登记设计产物缺位）：四项裁决落点须在本报告 §3 对应行的边界内——SD-1 采「停手报 SA8」；SD-2 择 (a)/(b) 并记录（(b) 限测试文档冻结）；SD-3 处置留 harness 侧；SD-4 择深度并记录「分块 conformance 由既有资产锚承载」的理由（若采最小读法）。
2. **硬门纪律不得在设计中被放宽或加严**：逐字节断言只落控制帧、数据帧语义等值（协议 §22 L701）；observer 事件集不入 parity（协议 §23.1 L844）——违反任一即制造假红/假绿，属对既登纪律的偏离。
3. **ALLOW LIST 纪律**：任何生产/规范文档改动（含 SD-1 修复、SD-3 生产化、SD-2(b) 规范化）都不得在本票内就地发生，须新票 + 重过冲突门禁。
4. 设计产物落位后按流程做 design 复审（`task_issue-424_design_conflict_report.md`），核对四项 SD 裁决与 harness 装配是否仍在本 adjudication 内。

## 9. Verdict

**clear**

- 19 项对照全部为 no-conflict（8）或 implements-existing-decision（11）；hard-conflict 0、override 0、evolution-required 0。
- SA6 契约对 ADR 0032 的解读经逐条款核验准确（决策 1–5、A1–A3、三载体、观测归属、形态差异登记均有原文对应；其引用的源码事实 connectionKey 生成/重复开启拒绝/收口路径亲验属实）。
- 任务可为 Feature/阶段收官验收（test-only）：交付物是既有决策义务的验收证据化，无新决策面。
- 总控可按本报告继续派发 SA1 设计（SD-1~SD-4 待设计裁决，边界已划定）。

## 10. requiresConflictRecheck

**true**

理由：

1. 被审对象自身携带**四个未决范围决策（SD-1~SD-4）**，其中 SD-2 涉及生命周期/失败语义处置（早到 OPEN 收口形态）、SD-1/SD-3 含可越出 test-only 边界的合法分支——设计阶段的抉择与实现票的交付须再核对是否落在本报告边界内（§8-1/§8-3）。
2. 契约锁定的 wire/状态机/生命周期/失败语义断言（AUTH/SEQ/ROUND/TERM/REVOKE/REAUTH 六组）尚待实现票交付验收套件后核对：套件不得 fork 状态机、不得越 DENY 面、硬门口径不得漂移。
3. 纯 no-conflict 且无未决决策面的既有义务兑现才会置 false——本任务不满足该条件（未决 SD 显式在案）。
