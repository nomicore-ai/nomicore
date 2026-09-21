# task_issue-421 冲突报告（SA8 前置门禁 + SA6 验收契约证据复审）

- 迭代：0（无前序同类报告，本报告为首份）
- 报告日期基线：HEAD `7039f6dae8e7d29f0c929492f0ca2119bc63afaa`（与 SA6 契约 §4 声明一致，git 亲测）
- 裁决对象：任务简报 + SA6 验收契约（`wiki/raw/task_issue-421_sa6_contract.md`，372 行）及其可执行证据

## 1. Reviewed subject: task

**task 前置门禁**（简报 vs 决策集）+ **SA6 验收契约证据复核**（dispatch 指定）。无 design 产物（`task_issue-421_design.md` 不存在——SA6 §15-2 已如实登记）；本门禁先于设计，设计后复审另出 `task_issue-421_design_conflict_report.md`。本轮零实现（`git status --porcelain` 仅 SA6 资产 + Host 简报 + 本报告家族；`git diff -- packages/` 为空——SA6 §16 声明经亲测成立）。

## 2. Inputs and decision set

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-421.md`（简报：Parent PR #416、AC1–AC6、Blocked-by #418） | 已读 |
| `wiki/raw/task_issue-421_sa6_contract.md` + 探针 `…_capability_probe.mts` + 变异驱动 `…_mutation_driver.mts` + `artifacts/sa6-issue421-{probe-green,mutation-sensitivity,runner-trigger,structural-evidence}.log` | 已读；sha256 六项前缀与契约 §17 登记逐一相符（亲算） |
| 决策集：`docs/adr/**` 全量扫描（0001–0030+0032 无整体 superseded；0031→0032 为纯改号，commit `27e012b`）、`CONTEXT.md`（:225–235 三词条）、`docs/protocols/instance-replication-v1.md`（§1/§2/§3/§13/§14/§19/§22）、两包 `AGENTS.md`、`docs/AGENTS.md` | 已读；摘录见 `task_issue-421_relevant_decisions.md` |
| 前序票：#418 design §642/§654、#418 SA6 §28/§351 U4、#418 SA10 §3 导出面行、**#418 SA8 implementation 冲突报告 §8-R4''/R5''/R7''/R8''（跨票义务账）**；#419 SA6 + T1 守卫测试 | 已读、锚点亲测 |
| 生产源码锚点复核 | 见 §3 各行 Evidence 列（全部亲测） |
| Owner 评论 | REST 快照为空（dispatch 明示）——无评论级要求，无 override 来源 |
| spec #415 全文 | **库内确不存在**：`remotes/origin/spec/415-replication-transport-decoupling` 分支 tip == HEAD（`git diff` 为空）且全树无 `*415*` 文件——SA6 §15-3 的实质结论（简报「What to build」是 T4 唯一规范文本）成立；其「分支不可读」措辞不准（分支可读，只是不含 spec 文档）——见行动 A4 |

## 3. Decision analysis

| # | Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0032 决策 1 | L12–14（协议状态机单份；宿主自写连接级半边 = fork，否决） | EF 组把 `createHubReplicationEdge` 定义为**连接级半边的宿主出面**（复刻 accept 双入口 + 注入 authorize/verifyToken），不让宿主实现协议；NM1/NM2 中性变异证明断言不锁实现写法 | **no-conflict** | ADR 0032:12–14；CONTEXT.md:226–227 _Avoid_；契约 §12.1/§12.7 SD-1 | 无 |
| 2 | ADR 0032 决策 2 | L16–18（wire 逐字节不变；出站 sequence=0 占位 + mux 点重写 `[8..12]`；零 worker_threads 依赖） | WS-C1..C3（per-connection 从 1 严格递增、盖章字节 == `encodeMessage(…,{sequence:k})`、连接隔离）+ RK-C3/WS-C2（同输入序列与单体 hex 逐字节相等）+ GATE-C4（`packages/replication-protocol/src` 零 diff）兑现该义务 | **implements-existing-decision** | ADR 0032:16–18；协议 §3（sequence `[8..12]`）；O1b/O2b/O5b + M3 变异（probe-green.log / mutation-sensitivity.log 亲读）；`hub-edge.ts` OutboundQueue + `writeBe32At` 盖章 | 实现票按 GATE 落地 |
| 3 | ADR 0032 决策 3 | L20–22（authorize 在 edge；未授权 OPEN 不过缝 + 拒绝闩锁；**pending 有界缓冲、并发 OPEN 上界、sink 失败响亮连接收口、drain 门、session 随连接存活全部为 edge 规范职责**） | OAP-C1..C8 全组按序落这些职责；G3–G7 证明 HEAD 上「宿主缝形态」无岗位（`resolveSessionSink` 不存在、构造期唯一 `sessionFactory`、无 pending 状态、无 OPEN 上界、连接级 `INTERNAL_ERROR`(1011) hub 半边零发射点——结构日志亲核） | **implements-existing-decision** | ADR 0032:20–22；`hub-edge.ts:75,139-144,173,323-328,701`；`hub-split.ts:48-53`；`hub-namespace.ts:299-312,355-359`；契约 §5/§12.2 | 实现票落地；SD-2/SD-3/SD-6 约束级裁决见 §8-A1 |
| 4 | ADR 0032 决策 3 机制句 ↔ CONTEXT.md:230 表述差（#418 SA8 R7'' 存续义务） | #418 SA8 impl 报告 L87/L100（R7''：deadline = worker 形态票 SA8 前置门禁之前或之中；**在此之前任何票不得援引机制句字面**迫使回到「缓冲丢弃/edge 复现/结算回放」形态） | SA6 OAP-C3① 以**宿主缝可观察行为**定义（wire 上 ns 级 `NAMESPACE_UNAUTHORIZED` + 宿主回调零调用 + 不建会话），不指定内部发射点、不强制内部「edge 复现」形态；§8 放大因素 (b) 的「到达点之前表达」指宿主缝（回调门控）而非内部缝——合规 | **no-conflict**（义务按期存续） | #418 SA8 impl 报告 R7''/R8''；#418 design §654；契约 §12.2/§15-1/§15-4；`hub-namespace.ts:355-359`（现行 deny 帧产点） | 见 §8-A2 |
| 5 | ADR 0032 决策 4 | L24–26（路由键定偏移 `[21..56)`/`[22..57)`；两分支逐字节复现单体；ERROR 有界 mini-decode；布局与 codec 字段序同步维护 + 结构性守卫） | RK-C1（违例 → 连接级 `MALFORMED_FRAME` + 1002 + 零投递）/RK-C2（合法无 sink → 合成 ns 级 `NAMESPACE_STATE_VIOLATION` + 连接存活）/ER-C1..C3（路由目标 = `decodeMessage` 回读值；**消费** T1 守卫登记的 `ERROR_NS_PREFIX_BUDGET = 64`）——T1 守卫已随 #419 在基线内 | **implements-existing-decision** | ADR 0032:24–26；`codec-route-key-guard.test.ts:67,~322`（亲读）；`hub-edge.ts:526-532`（ERROR I5 静默丢弃）；O1–O4/NC3/NC4 + M1/M2/M4 变异 | 无 |
| 6 | ADR 0032 决策 5 | L28–30（观测纪律：连接域事件在 edge；缺面 = dormant；`listen:false` 显式；SessionHost 服务仅免 listen） | LC-C1..C4（settled 信号驱动提前收口、drain 门、ping/pong 凭据、缺面 dormant）与「连接域事实在 edge」一致；**本票不含 listen:false/`nomicoreHubSessionHost` 服务面**（简报未要求；#418 SA6 §28 明示属后续票）——无遗漏义务 | **no-conflict** | ADR 0032:28–30,41–42；契约 §3.4/§12.6；`hub-edge.ts:437,695-710`（dormant/提前收口判定） | 后续票跟踪（§8-A6 备注） |
| 7 | ADR 0032 后果节 | L41–43（edge 以普通工厂导出、非 Cordis 插件、无 Registry 依赖；**公开面一经发布即冻结、演进 append-only**） | EF-C1（`src/index.ts` 导出 + test-d 锁签名；`Object.keys` 相对 HEAD 11 运行时导出**只增不减**）——首发布发生在本票，冻结自发布起算，不溯及 | **implements-existing-decision** | ADR 0032:41–43；`src/index.ts`（亲数 11 个运行时导出、无工厂）；`hub-edge.ts:788`（仅模块级导出）；契约 §12.1/§12.8 | 实现后逐项核对 |
| 8 | 协议 §13.1/§13.2 + §14 + replication-protocol AGENTS | 注册表 append-only、深冻结；close 粗分类（1002/1008/1009/1011） | 本票**零新错误码**（简报明示）；OAP-C6 = 连接级 `INTERNAL_ERROR`（fatal/yes/**1011**）；SD-2 候选 `CONNECTION_POLICY_VIOLATION`（fatal/config/**1008**）与 `INTERNAL_ERROR` 均在册且元数据相符；EF-C3 沿用 1008/1009 既有升级门语义 | **no-conflict** | `errors.ts:101-158`（117/114/122/123/128 逐行亲核 = 契约引用无误）；协议 §13–14；`hub-connection.ts:54,88-133`（`MAX_EARLY_FRAMES=16`、1009/1008 分支）；`rejectUpgrade` → 1008 | SD-2 选码 = 设计自由，须登记理由（§8-A1） |
| 9 | 协议 §1 不变量 2/4/5 + §3 + §2 | L15–22/L35–52（sequence 纪律；同连接同 ns 唯一生命周期；HELLO 门；Upgrade 受信身份、HELLO 自述不采信） | WS 组按 per-connection 序号断言；OAP-C3②（重 OPEN → ns 级 `NAMESPACE_REOPEN_REQUIRES_RECONNECT`、authorize 仍恰一次）= 不变量 4 的既有闩锁表达；EF-C2（`acceptTrusted` 绑定受信身份、HELLO 后 `peerInstanceId = authenticatedInstanceId`——亲核） | **no-conflict** | 协议 §1/§2/§3；`hub-edge.ts:~440`；`hub-namespace.ts:299-312`；`hub-connection.ts:242-360`（六道门亲读）；`errors.ts:109,122` | 无 |
| 10 | 协议 §19 | L637–652（adapter 形状：`allowed{localOwner, permissions}`；授权只在 OPEN 检查；revoke 走在场通道） | OAP-C3（每 (连接,ns) 恰一次 authorize + 闩锁）、OAP-C8（`authorization` 参数 = ok 投影 `localOwner`/`permissions`，非摘要）、EF-C2 句柄 `revokeNamespace` | **no-conflict** | 协议 §19；`hub-split.ts:38-49`；契约 §12.2 | 无 |
| 11 | CONTEXT.md 词条（复制 Edge :225–227 / SessionHost :229–231 / 路由键契约 :233–235） | 词条职责边界与 _Avoid_ 清单 | 契约 §3 的八条硬约束与三词条逐条同义；无术语误用、无第二事实源主张 | **no-conflict** | CONTEXT.md:225–235（亲读） | 实现票若引入 `resolveSessionSink`/`connectionKey` 域术语须同步 CONTEXT（docs/AGENTS 义务，§8-A5） |
| 12 | `packages/ws-replication/AGENTS.md` | 生产 API 经 `src/index.ts`；状态机单份；受信身份绑定；admission 四窗口有界 | 契约 §3.7 引用属实；§10 零改动面（peer 侧、`plugin.ts`、replication-protocol）与 AGENTS 边界一致；OAP-C4/C5 新增有界面沿「admission bounded」纪律 | **no-conflict** | `packages/ws-replication/AGENTS.md`（系统注入版亲读）；契约 §3.7/§10 | 无 |
| 13 | ADR 0012（身份单一真相/插件所有权）+ ADR 0010（拓扑与 ACK 语义，上下文） | ADR 0012 全文；ADR 0010 决策节 | 工厂为非 Cordis 插件（无 Registry 依赖）与 0012 的插件所有权矩阵正交兼容；本票零触碰 0010 条款 | **no-conflict** | ADR 0012:1–12；ADR 0010:1–30；ADR 0032:41 | 无 |
| 14 | ADR 0013/0022（分块传输） | UPDATE_CHUNK kind 首字段；`maxConcurrentAssembliesPerConnection` = 分块 assembly 上界 | RK-C1 语料含 UPDATE_CHUNK kind-first；G6/OAP-C5 的「并发 OPEN 上界」是**新 admission 面**，与 assembly 槽位面（types.ts:44–52）判然两分、互不重定义 | **no-conflict** | ADR 0013/0022；`types.ts:44-52`；契约 §12.2/§12.7 SD-3 | 无 |
| 15 | #418 SA8 跨票义务账（R4''/R5''/R7''/R8''，wiki/raw 证据——流程义务，非决策文本） | #418 SA8 impl 报告 L100–101；#418 design §642/§654 | R4''（pending 缓冲义务）**在本票正当重新进入**：`resolveSessionSink` 造成真实「解析在途」窗口，AC2 明示 pending 有界缓冲——与 #418 design §13 R2 的重入条件（「引入真实 pending 状态」）相符，兑现 ADR 0032:22 列举职责；R5''（worker 形态门禁）维持 T5；R8'' 对 SD-1 构成硬约束（触碰内缝成员集/结局词汇/DENY 面 → 重触发 SA8） | **no-conflict**（义务按期进入/存续） | #418 SA8 impl 报告 §8；#418 design §642/§654；契约 §12.2 OAP-C4/§12.7 SD-1/§15-1/§15-4 | 见 §8-A2/A3 |
| 16 | SA6 证据 vs 决策面事实（本轮独立复核） | 契约 §3–§5/§8/§14/§17 的全部决策相关引证 | HEAD 一致；六项 sha256 前缀相符；`gaps=7/7 ×5`、`MUTATION_RESULT 7/7 ×2`、`Tests 588 passed`、TS2724 诊断行、消费者路径 `undefined`、`issue421 test files: 0` 均在档亲核；源码锚点（11 导出、`sessionFactory:75/173`、台账 `139-144`、无条件投递 `323-328`、`connectionId:441`、ERROR I5 `526-532`、pending 注 `701`、工厂 `788`、deny 闩锁 `hub-namespace:299/305/355-359`、早到帧门 `hub-connection:88-133`、`rejectUpgrade` 1008、注册表行号、`observer.ts` 未知折叠 `INTERNAL_ERROR`）逐点属实。两处证据注记（§15-3 措辞、§14 §4c TSC 退出码）见 §8-A4，不影响任何决策面结论 | **no-conflict** | 本报告 §2；四份日志 + 两脚本亲读；`git`/`grep` 亲测 | §8-A4（非阻断） |

**裁决分布**：no-conflict ×12、implements-existing-decision ×4、evolution-required ×0、hard-conflict ×0。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| —（无） | — | — | — |

无合法 override 亦无需 override：Owner 评论快照为空；无新 ADR/修订；无协议版本升级；被审对象未触碰任何决策文本。SA6 对 ADR 0032 的使用均为「兑现已列举义务」而非改约。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| wire 帧格式（20B envelope、`[8..12]` sequence、消息注册表、ERROR 字段序） | ADR 0032:4/18/26；协议 §3/§5/§13 | 契约 GATE-C4（replication-protocol/src 零 diff）+ O1b/O2b/O5b parity 断言 | 本轮零实现——实现后逐项核对 |
| 错误注册表（17 连接 + 26 namespace 码及元数据） | `errors.ts:100-158` 深冻结 append-only；协议 §13；replication-protocol AGENTS | 零新错误码（简报 + OAP-C5/C6 + SD-2/SD-3 硬约束） | 同上 |
| WS close 分类（1000/1001/1002/1008/1009/1011） | 协议 §14 | OAP-C6=1011、RK-C1=1002、EF-C3=1008/1009（均注册表映射） | 同上 |
| 公共入口导出面（HEAD 11 运行时导出 + 全部类型导出） | ADR 0032:43（发布后 append-only）；ws-replication AGENTS（经 `src/index.ts`） | EF-C1 只增不减 + `ws-replication-issue421-edge-factory-api.test-d.ts` 锁签名 | 同上 |
| 单体 `createHubReplication` 行为（listen 模式逐字节） | ADR 0032:4（「listen 模式行为逐字节不变」） | GATE-C3 + `hub-connection.ts:429-463` 组合根（亲读，构造序逐点对应） | 同上 |
| peer 侧（`peer-connection`/`peer-namespace`） | ADR 0032:4/L44（peer 不拆分） | 契约 §10 零改动面；结构日志（`peer-connection.ts:740` 属 peer 侧，亲核） | 同上 |
| `plugin.ts` 服务面 / `nomicoreHubReplication` 服务 | ADR 0032:41–42；ADR 0012 | 契约 §10 零改动面 | 同上 |
| 内缝契约 `hub-split.ts`（4 控制信号、`HubOpenAdmission` 三结局词汇、delivered⇒channels 锁步、台账先于投递） | #418 已合并面 + R8'' 重触发清单 | SD-1 裁决前视为冻结；**触碰任一条 → SA8 implementation 复查重触发** | 条件性（本轮未触碰） |
| 路由键布局 ↔ codec 字段序同步维护 | ADR 0032:26 + T1 守卫（#419 在基线） | ER-C1 消费 `ERROR_NS_PREFIX_BUDGET=64`，零改布局 | 计划面（实现后核对） |

## 6. Evolution requirements

**无条件 evolution-required：无。** 被审对象（简报 + SA6 契约）不要求修改任何 ADR/CONTEXT/协议文本。

**条件性义务**（挂到设计票，SA6 §15-1 已如实预告）：

- 若 SD-1 选择「重构 T2 内部工厂签名/缝类型」路径（而非包装保留）：该设计即触碰 `hub-split.ts` 缝契约与 #418 C0a/C0b 结构测试，属**契约演进**——须同变更集交付完整修订计划（修订文件、新旧语义、兼容与迁移、失败语义、版本、验证锚、保持不变的冻结面），且 R7'' 文本调和附录（ADR 0032:22 ↔ CONTEXT.md:230）**提前至该变更集**落地。计划缺失或不全 → 该设计复审 `reject`。
- 若 SD-3 选择新增 `limits` 键：按 append-only 配置面演进（`validateLimits` 启动期响亮校验 + 文档注释登记 + 内存上界推导，比照 `maxConcurrentAssembliesPerConnection` 先例）；属配置面 append-only，不需 ADR 修订，但须在设计登记推导。

## 7. Hard conflicts

**无。** 未发现与既有决策不兼容且无 override 的条目；被审对象未引入静默决策矛盾（`docs/AGENTS.md`「Amend or supersede explicitly」核验：本轮零决策文本 diff）。

## 8. Required actions

- **A1（设计票 SA1，SD-1~SD-6 落定）**：断言面已被 SA6 按可观察行为定义，设计只需在决策约束内选形。约束级裁决：SD-2/SD-3 的收口码限**既有注册表码**（候选含 `INTERNAL_ERROR`(1011)/`CONNECTION_POLICY_VIOLATION`(1008)；`CONNECTION_BACKPRESSURE`(1011) 亦在册——ADR 0032:18 名义的缝有界性终局，与本面（ingress 准入）是否同码由设计登记理由裁决）；SD-4 复用 `connectionId`（`${instanceId}-conn-${n}`，`hub-edge.ts:441`，HELLO 后赋值——早于首个 OPEN 授权，时序满足）可满足「同连接恒定、跨连接互异」；SD-5 二分（`undefined` = 合法无 sink → RK-C2；throw/reject → OAP-C6）与决策 3/4 相容；SD-6 维持 T2 登记（`hub-split.ts:42-43`：throw → ns 级 `INTERNAL_ERROR`、连接存活）为缺省，改连接级收口会翻转 OAP-C3④ 存活期望 → 须重过 SA8。
- **A2（设计票）**：R7'' 禁令遵守——设计**不得援引 ADR 0032:22 机制句字面**作为内部形态依据；宿主缝语义以 wire 可观察行为 + 回调门控定义（SA6 已示范）。文本调和附录 deadline 维持 **worker 形态票（T5）SA8 前置门禁之前或之中**；Host 自愿先行 documentation-only 附录仍为可选推荐。若 SD-1 走重构路径 → deadline 提前（见 §6）。
- **A3（实现票）**：R8'' 重触发清单对实现同样生效：port 成员集增删、`HubOpenAdmission` 词汇变化、promise reject 面扩大、路由/drain 事实源改读 channels 投影、DENY 面（含 `hub-namespace.ts`）diff、决策文本变更——任一触碰即重跑 SA8 implementation 复查。
- **A4（SA6 证据卫生，非阻断）**：两处修正建议——(i) §14 §4c 的 `TSC_EXIT_NEGATIVE=2` 与存档日志不符（`runner-trigger.log` §4b 段显示 TS2724 诊断行后 `TSC_EXIT=0`，疑为管道退出码捕获伪影；类型层红结论仍由同段 TS2724 诊断 + `EXIT_NEGATIVE_TYPECHECK=1` + 消费者路径 `undefined` 三面独立支撑）；建议修正陈述或补存正确退出码证据。(ii) §15-3「分支不可读」改为「分支在档（tip == HEAD）但不含 spec 文档、全树无 *415* 文件」。
- **A5（实现票 docs-sync）**：公共面首发布时，若 `resolveSessionSink`/`connectionKey` 构成域术语，按 `docs/AGENTS.md` 义务同步 `CONTEXT.md`；新 `limits` 键（若采）随 SD-3 登记推导。
- **A6（范围跟踪，非本票义务）**：`listen:false`、`nomicoreHubSessionHost` 服务面、peer 侧对称拆分、R5'' worker 形态门禁——维持后续票跟踪，防丢账（本票不预留、不提前实现）。

## 9. Verdict

**clear**。

- 全部 16 项对照为 no-conflict（12）或 implements-existing-decision（4）；无 hard-conflict；无无条件 evolution-required。
- SA6 契约对决策集的使用忠实：EF/OAP/RK/ER/WS/LC/GATE 各组均有决策条款直接支撑（ADR 0032 决策 1–5 + 后果节、协议 §1/§2/§3/§13/§14/§19、CONTEXT 三词条、两包 AGENTS）；证据链经本轮独立复核成立（§3 行 16）；两处证据注记（A4）不触及任何决策面结论。
- 范围决策 SD-1~SD-6 的**硬约束面**全部与决策集相容，选形自由留给设计（A1）；条件性演进义务（§6）已按 SA6 §15-1 预告挂到设计票。

## 10. requiresConflictRecheck

**true**。理由：公共 API 面首发布（EF-C1，append-only 冻结自发布起算）、连接级状态机/生命周期/失败语义（OAP-C5/C6 的收口码与上界、LC 组）尚待实现核对；SD-1 若走内缝重构路径触发 §6 条件性演进 + R7'' 提前；R8'' 清单任一触碰需 implementation 复查；§5 冻结面需在实现 diff 上逐项核对。
