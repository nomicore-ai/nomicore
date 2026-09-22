# task_issue-421 实现冲突报告（SA8 implementation 复查）

- 迭代：**1**（原位更新：迭代 0 复审 SA3 迭代 1 diff → clear；SA4 迭代 1 review 以 F1/F2 两项 MAJOR `reject` → SA3 迭代 2 修复 → 本轮复审**修复后的当前 diff**。本报告只反映当前被审对象，不堆叠历史结论）
- 被审对象：SA3 修复后实现工作树 diff 的当前实际状态（`git status`/`git diff HEAD` 全量亲测：4 个修改文件 + 2 个新源文件 + 7 个新测试文件 + `CONTEXT.md` 2 行；修复集中在 `hub-edge-host.ts` 单点 + OAP-C11 测试追加；基线 HEAD `7039f6dae8e7d29f0c929492f0ca2119bc63afaa`）
- 触发依据：SA4 迭代 1 `reject`（F1「no-sink 重解析绕过两道上界」/F2「no-sink 结算帧预算泄漏」——两者均落在 ADR 0032:22 准入上界决策面 = 技能「SA4/SA9 发现新决策面」触发条件）+ 本轮 dispatch 明示「recheck the repaired SA3 implementation diff」；Owner 评论 REST 快照空（dispatch 明示 `[]`）——无评论级要求、无 override 来源
- 复审范围：修复后 diff vs 决策集（ADR/协议/CONTEXT/三级 AGENTS）+ F1/F2 修复的决策面核对（新 fatal 站点/账目回路）+ 四类授权 diff 复核 + R8'' 清单闭合 + 冻结面实际 diff 逐项复核；不做行为/测试充分性评审（SA4/SA7 职）、不运行测试（SA8 纪律；§7 表内绿灯数字均为 SA3 报告值）

## 1. Reviewed subject: implementation

SA3 报告 `wiki/raw/task_issue-421_sa3_impl.md`（**迭代 2**）所述修复 diff 的当前实际状态。修复触碰面（相对迭代 1）：`packages/ws-replication/src/hub-edge-host.ts` 三处——① `openNamespace` `case 'no-sink'`（`:323–346`）在记录建立**之前**镜像两道上界检查（`pendingOpenCount >= MAX_CONCURRENT_OPEN_ADMISSIONS` 与 `pendingFrameCount >= MAX_PENDING_FRAMES_PER_CONNECTION`，超界均 `port.connectionFatal('CONNECTION_POLICY_VIOLATION', 1008)` 并 `return`）；② `runResolveInner` no-sink 结算（`:459–467`）`discardBuffer` **先于** `table.set(no-sink)`；③ `discardBuffer` 守卫（`:495–499`）由 phase 判定改为 `'buffer' in record` 缓冲在场判定；④ 测试文件追加 OAP-C11a–d 四用例（`:1046–1214`，纯追加，既有 36 用例零触碰）。**DENY 面零 diff 亲测成立**：`packages/replication-protocol/**`、`hub-edge.ts`/`hub-split.ts`/`hub-session.ts`/`hub-namespace.ts`/`frame-io.ts`/`backpressure.ts`/`liveness.ts`/`observer.ts`/`defaults.ts`/`validate.ts`/`types.ts`/`plugin.ts`/`peer-connection.ts`/`peer-namespace.ts`/`testing.ts`、`docs/adr/**`、`docs/protocols/**`、`apps/**` 均不在 `git status` 修改清单；`hub-connection.ts`/`index.ts`/contract.test/`CONTEXT.md` 四个 tracked 修改与迭代 1 逐字一致（本轮零触碰）。

## 2. Inputs and decision set

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-421.md`（Issue 正文 AC1–AC6；Comments 空） | 已读；Owner 评论 REST 快照空 = 无评论级要求、无 override 来源 |
| `wiki/raw/task_issue-421_design.md`（迭代 1，732 行） | 已读关键节全文：§7-D3（SD-5 `:298`）+ §8.2 伪码（`:375–455`，含 `discardBuffer` `:439–441` 与 no-sink 行 `:390–391`）+ §9.3 语义（`:568`「两者溢出均响亮收口」）+ §13 分歧族 + §10 ALLOW/DENY |
| `wiki/raw/task_issue-421_sa2_review.md`（approve；R1–R6 + M1–M5） | 已读 |
| `wiki/raw/task_issue-421_sa3_impl.md`（**迭代 2** 修复报告：§3 变更、§5 F1/F2 落实、§6 文件范围、§7 验证、§8 deferred、§9 deviations） | 已读；全部声明逐项对当前 diff 复核（§3/§8） |
| `wiki/raw/task_issue-421_sa4_review.md`（迭代 1 `reject`：F1/F2 MAJOR + §11 动态项 + §12 M1–M5） | 已读；F1/F2 required change 与验收断言逐条对照修复（§3 行 18） |
| `wiki/raw/task_issue-421_sa6_contract.md`（approve；EF/OAP/RK/ER/WS/LC/GATE）+ `task_issue-421_relevant_decisions.md`（R4''/R5''/R7''/R8'' 义务账） | 已读关键节；义务账沿认 |
| 前序 SA8 产物：task 门禁（clear）+ 设计后复审（clear，§8-A1' 四类 diff 义务）+ 迭代 0 实现复审（clear） | 已读；A1' 义务与冻结面清单沿本轮 diff 复核 |
| 决策集：`docs/adr/0032-transport-decoupling-edge-session-split.md` 全文 44 行亲读（状态行「已接受」；决策 1–5 + 否决备选 + 后果节）；`docs/protocols/instance-replication-v1.md` §1/§2/§3/§13/§14/§19；`CONTEXT.md:225–237`（diff 后状态）；根/`docs`/`packages/ws-replication` 三级 `AGENTS.md` | 已读（ADR 目录清点：0001–0030 + 0032，无 superseded 标记；0031 不存在 = 纯改名沿革） |
| 生产源码锚点复核 | §3 Evidence 列全部亲测（git diff/status、逐行读码 `:255–599`/`:1–70`、错误码全量大写字面量审计、导出面清点） |

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（修复后实际 diff） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0032 决策 1 | :12–14（协议状态机单份；宿主自写连接级半边 = fork，否决） | 修复零触碰架构主线：`hub-edge.ts`/`hub-split.ts` 零 diff（git status 亲测）；F1/F2 全部落在经构造期缝注入的 `HostSessionAdapter`（edge 产品的准入管线组成部分，非第二 FSM——SA4 §5 责任归属行 80 已裁决）；公共工厂仍以 `sessionFactory` 包装未改动的内部 `HubReplicationEdgeImpl` | **implements-existing-decision** | `hub-edge-host.ts:1–23`（模块头装配声明）；`git status`（hub-edge/hub-split 不在修改清单） | 无 |
| 2 | ADR 0032 决策 2 | :16–18（缝只过 ns 域帧 + 纯 JSON + 4 控制信号；wire 逐字节不变；零 worker_threads） | 修复不涉缝与 wire；新源文件 grep `worker_threads\|MessageChannel\|MessagePort` = 零命中；egress 盖章单点仍在内部 `OutboundQueue` | **implements-existing-decision** | grep 亲测；`hub-edge-host.ts:24–46`（import 清单全为协议包/包内模块） | 无 |
| 3 | ADR 0032 决策 3 | :20–22（OPEN 准入管线——**pending 有界缓冲、并发 OPEN 上界**、sink 失败响亮收口、drain 门、session 随连接存活——全部为 edge 规范职责） | **F1 修复兑现上界义务**：no-sink 重 OPEN 分支在记录建立前执行两道检查（并发 4 + 帧预算 16），超界 `connectionFatal('CONNECTION_POLICY_VIOLATION', 1008)` + `return`——被拒重 OPEN 不建会话、零新 `resolveSessionSink` 调用、计数零变化；上界内重解析照常（缓存 grant 复用）。**F2 修复兑现有界账目义务**：no-sink 结算先 `discardBuffer`（归还 `pendingFrameCount`）再迁移 phase，`discardBuffer` 守卫按缓冲在场判定——迭代 1 的「无界 in-flight 重解析 + 预算永久泄漏（累积后健康窗口虚假 1008）」两处缺口闭合，上界语义在**全部** OPEN 到达路径（首开/合流/重开）一致有界 | **implements-existing-decision**（迭代 1 缺口 = 本票内首次交付面的实现偏差，本轮闭合） | `hub-edge-host.ts:323–346`（F1 两道守卫亲读）；`:459–467`（F2 释放次序亲读）；`:485–499`（`releaseBuffer` 唯一递减点 + 缓冲在场守卫亲读）；`:295–307`（首开分支对照）；设计 §7-D3 SD-5 `:298`「并发重解析受阶段 5 上界约束」+ `:568`「两者溢出均响亮收口」亲读 | 无（边界观察见 §8-O3） |
| 4 | ADR 0032 决策 4 | :24–26（路由键定偏移；两分支逐字节复现单体；ERROR 有界 mini-decode；布局同步维护契约） | 修复零触碰：`routingKeyOf`/ERROR 特例/no-sink 合成全在零 diff 的 `hub-edge.ts:523–592` 与适配器 `:368–372/:596+`（本轮未改）；T1 守卫 `codec-route-key-guard.test.ts` 零触碰；`packages/replication-protocol` 零 diff | **implements-existing-decision** | git status/diff 亲测 | 无 |
| 5 | ADR 0032 决策 5 | :28–30（观测纪律：连接域事件在 edge；事件字段集 append-only；缺面 = dormant） | 修复新增的两个 fatal 站点全部经 `port.connectionFatal` 单点 → 内部 edge 五路收口拓扑原样（收口帧 + `close(1008,'protocol-error')` + `connection-failed` 事件带 `stableConnectionCode('CONNECTION_POLICY_VIOLATION')`）；零新事件型、零新 close reason、零新错误码 | **no-conflict** | `hub-edge-host.ts:330–337`；`hub-edge.ts:619–645`（connectionFatal 体亲读：reason 恒 `'protocol-error'`、`connectionErrorFrame(code)` 连接级无 nsId）；`observer.ts` 折叠单点零 diff | 无 |
| 6 | ADR 0032 后果节 | :41–43（edge 普通工厂导出、无 Registry 依赖；公开面发布即冻结 append-only） | 修复零公共面变化：`index.ts` diff 与迭代 0 报告 §3.1-(a) 记载逐字一致（值导出恰 +1 `createHubReplicationEdge` + 8 `export type`；既有 11 运行时导出零改名零删除）；`hub-edge-host.ts` 模块级导出清单不变（8 类型 + 2 常数 + `HostSessionAdapter`/Config + 工厂，不进 index/testing）；C5a 冻结清单恰一行 | **no-conflict** | `git diff -- src/index.ts` 亲读；`grep '^export' hub-edge-host.ts` 清点（`:71–262/:951`）；C5a diff 单行 | 无 |
| 7 | 协议 §1 不变量 2/4/5 | :15–25（sequence 严格递增；同连接同 ns 唯一生命周期、终态后重开须重建连接；HELLO_ACK 前禁 ns 帧） | 上界内 no-sink 重解析照常允许（设计报告 §3 行 8 窄读法沿认：no-sink 无会话生命周期曾开始，不落入不变量 4 禁字母表）；超界重 OPEN fatal 收口后对端重建连接 = 与不变量家族一致；sequence/HELLO 门全在零 diff 内部 edge | **no-conflict** | `hub-edge-host.ts:323–346`；协议 §1 亲读；OAP-C11c（上界内重解析建会话 + grant 复用）在档 | 无 |
| 8 | 协议 §2 | :35–46（Upgrade 前受信身份；HELLO 自述不采信；缺受信身份响亮拒绝） | 修复零触碰双入口门序（`:773+` 本轮未改）；`acceptTrusted` 绑定受信身份、verifyToken 恰一次均维持 | **no-conflict** | git diff（hub-connection.ts 仅导入迁移，本轮零增量） | 无 |
| 9 | 协议 §3/§13/§14 | envelope 20B `[8..12]`；错误注册表 append-only 深冻结；WS close 粗分类（1002/1008/1009/1011） | 零 wire 变更（replication-protocol 零 diff）；修复所用收口码全部在册亲核：`CONNECTION_POLICY_VIOLATION`=fatal/config/**1008**（`errors.ts:114`）、`INTERNAL_ERROR`=fatal/yes/**1011**（`errors.ts:117`）；新源 + 7 测试文件全量大写字面量审计 = 25 个值全部落在注册表（§13.1 17 连接码 + §13.2 26 namespace 码）与既有消息 kind/服务名/默认值常量内，**零新码** | **no-conflict** | `errors.ts:14–60/114/117` 亲读；`grep -o "'[A-Z_]\{4,\}'"` 全量审计亲测；协议 §13/§14 亲读 | 无 |
| 10 | 协议 §19 | :637–652（授权只在 OPEN 检查；adapter ok 投影；revoke 走在场通道） | no-sink 重解析**不重复 authorize**（缓存 grant 复用——台账每 (连接,ns) 恰一次在零 diff 内部 edge）；回调第三参仍为 `NamespaceAuthorizationGrant` ok 投影（`:74` 本轮未改）；OAP-C11c/d 断言 `authorizeCalls` 恰 1 | **no-conflict** | `hub-edge-host.ts:74,338–345`；`hub-edge.ts` 台账零 diff；测试 `:1157/:1185` 亲读 | 无 |
| 11 | CONTEXT.md 域术语义务（`docs/AGENTS.md` Authority/Editing） | 引入/更改域术语须更新 CONTEXT.md | diff 与迭代 1 逐字一致：限「复制 Edge」词条正文 + `_Avoid_` 2 行（宿主出面句 + 「在宿主缝外自建连接级准入管线」增补）；SessionHost 词条与路由键词条零触碰；新增文本零处援引 ADR 0032:22 机制句字面（R7'' 禁令）——修复本轮零 CONTEXT 增量 | **implements-existing-decision** | `git diff -- CONTEXT.md` 亲读（本轮复核）；`CONTEXT.md:225–237` diff 后亲读 | 无 |
| 12 | #418 完成门冻结面 | structure.test L616–619（模块键面）/ C5a（公共导出面精确等值）/ 588 基线 | `hub-connection.ts` 本轮零增量（迭代 1 的 import 迁移 + 符号族删除；`grep '^export'` = `createHubReplication` 单行）→ 模块运行时键面不变；C5a 恰一行；structure.test 本体零触碰；既有测试零触碰（唯 contract.test 授权例外）；迭代 1 基线 682 → 686（+4 = OAP-C11，SA3 报告值）条目只增 | **no-conflict** | grep/git diff 亲测；SA3 §7 GATE-C1 在档（SA4/SA7 复算） | 无 |
| 13 | `packages/ws-replication/AGENTS.md` | 「Keep admission bounded across handshake, ready, backpressure, and drain windows. Control/data accounting… are observable concurrency contracts」+「Export production APIs through `src/index.ts`」 | F1 恢复 no-sink 重解析路径的有界性（并发 4 + 帧预算 16 两道，超额响亮 1008——与既有 `MAX_EARLY_FRAMES` 同码同分类的 admission 惯例）；F2 恢复帧账目回路（`releaseBuffer` 唯一递减点在 flush/discard/terminal 三处闭合）——「accounting 是可观察并发契约」在修复后成立；生产 API 仍经 index.ts 单点导出 | **implements-existing-decision** | `hub-edge-host.ts:323–346/:485–499`；`hub-upgrade-admission.ts:26`（MAX_EARLY_FRAMES=16 同界惯例）；包 AGENTS（系统注入版亲读） | 无 |
| 14 | 跨票义务 R4''（pending 有界缓冲） | #418 SA8 impl 报告 + 前置门禁 §5（本票重新进入） | 就地了结且**账目正确**：`resolveSessionSink` 在途窗口的缓冲（16 帧、序保、按 kind 分派、溢出 1008）+ 结算归还（established flush / no-sink discard / terminal release 三路全部经 `releaseBuffer` 单点）——迭代 1 的 no-sink 泄漏点闭合 | **implements-existing-decision** | `hub-edge-host.ts:337–373,459–467,485–499,547,566` | 无 |
| 15 | 跨票义务 R5''/R7'' | worker 形态 T5 门禁；机制句禁令 + 附录 deadline = T5 | R5''：零 worker_threads（grep NONE）+ 公共面零跨线程预设；R7''：CONTEXT 增量零机制句援引、SessionHost 词条零触碰、附录未提前未推迟——修复零相关触碰 | **no-conflict**（义务按期存续） | grep/git diff 亲测 | T5 边界维持（§8-O5） |
| 16 | 跨票义务 R8''（重触发清单） | port 成员集增删 / `HubOpenAdmission` 词汇 / promise reject 面扩大 / 路由·drain 事实源改读 channels / DENY 面（含 `hub-namespace.ts`）diff / 决策文本变更 | 逐项亲测零触发：`hub-split.ts`/`hub-edge.ts`/`hub-session.ts`/`hub-namespace.ts` 零 diff（git status）；新守卫为 void 回调 + `return`（不新增 promise reject 面；fire-and-forget 续体 `.catch` 兜底原样）；路由/drain 事实源零变化；`docs/**` 零 diff | **no-conflict**（清单闭合，无重触发） | git status/diff 亲测；`hub-edge-host.ts:330–337`（同步回调非 promise 面） | 无 |
| 17 | SA3 Deviations §9-1..6（修复轮） | SA3 报告 §9 | (1) 内部模块级导出面不变（非公共面）；(2) C5a 单行维持；(3) 收口后幽灵序继承面维持；(4)–(6) 承迭代 1 登记；**新增 (5)**：`discardBuffer` 守卫 phase→缓冲在场——与设计 §8.2 `:439–441`（`rec.buffer.length === 0` 早退）语义一致，联合类型下等价（仅 pending 记录携带 buffer），根因消除 F2 类隐患——经当前 diff 亲核属实 | **no-conflict** | SA3 §9 逐条 vs diff/源码亲核；设计 §8.2 `:439–441` 亲读 | 无 |
| 18 | SA4 迭代 1 F1/F2 required change（返工契约） | SA4 §10 两行 | **F1**：no-sink 分支镜像首开两道检查，超界先于记录建立 fatal（`:330–337` 先于 `:338–345`）——被拒重 OPEN 记录保持 no-sink、零 resolver 调用；**F2**：双保险落地（释放次序 + 守卫双修，SA4 给的「之一」被两条同时满足）；**验收断言**：OAP-C11a（并发满 + 重开收口 + 零新解析 + 迟归静默）/C11b（帧预算满 + 占位过界同码）/C11c（负控：上界内重解析照常 + grant 复用）/C11d（17 轮结算预算归还 + 新窗口满额 + 第 17 项仍响亮 = 上界未被禁用）四用例在档且含两组负控——纯追加、真实公共入口驱动（`createHubReplicationEdge` + 内存双工 transport）、零 skip/only/源码字符串断言 | **no-conflict**（返工在 SA4 授权单点范围内，未扩大触碰面） | `hub-edge-host.ts:323–346/:459–467/:495–499`；测试 `:1046–1214` 亲读；SA4 §10 F1/F2 行亲读比对 | 无 |

**裁决分布**：no-conflict ×11、implements-existing-decision ×7、evolution-required ×0、hard-conflict ×0。

### 3.1 SA8 设计报告 §8-A1' 四类授权 diff 逐项复核（修复轮零新授权 diff）

| 项 | 授权边界 | 实测结果（当前 diff） |
|---|---|---|
| (a) `index.ts` append-only | 值导出恰 +1、零改名零删除、8 类型 | **符合且本轮零增量**（diff 与迭代 0 记载逐字一致） |
| (b) `hub-connection.ts` 仅导入迁移 | 模块运行时导出面单键、门序零变化 | **符合且本轮零增量**（`^export` = `createHubReplication` 单行） |
| (c) `hub-upgrade-admission.ts` 搬迁逐字性 | 注释随迁、两消费方共享、不进 index/testing | **符合且本轮零增量**（消费点 = `hub-connection.ts` import + `hub-edge-host.ts` import） |
| (d) contract.test C5a 恰一行 | 字典序位、零删除、断言语义不变 | **符合且本轮零增量**（diff = `+  'createHubReplicationEdge',` 单行） |

修复新增的触碰仅两处，均在设计 §10 ALLOW LIST 内（`hub-edge-host.ts` = 行 1；OAP 契约测试 = 行 8），SA4 §10 F1/F2 明示授权；无 ALLOW 之外路径（`git status --porcelain` 与迭代 1 同一集合，本轮新增 changed path = 0）。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| —（无） | — | — | — |

无 override 亦无需 override：Owner 评论快照为空（dispatch 明示 `[]`）；无新 ADR/协议版本。修复把迭代 1 缺口收敛**回**决策要求（ADR 0032:22 + 包 AGENTS admission-bounded），不构成对任何决策的偏离，自然无需 override。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（修复后 diff 亲测） |
|---|---|---|---|
| wire 帧格式 / 消息与错误注册表 / codec | ADR 0032:4/18/26；协议 §3/§13；GATE-C4 | `git diff --stat -- packages/replication-protocol` = 空 | **零 diff**（全量大写字面量审计零新码，§3 行 9） |
| WS close 分类（1002/1008/1009/1011）与 close reason | 协议 §14 | `errors.ts:114/117`；`hub-edge.ts:619–645`（reason 恒 `'protocol-error'`） | **保持**（新增 fatal 站点全部经注册表映射 + 单点 reason） |
| 内部 edge 收口拓扑（五路） | ADR 0032 决策 1 单份 FSM | `hub-edge.ts` 零 diff；`port.connectionFatal` 单点 | **保持**（修复两站点经 port 委托，零第二实现） |
| 公共入口运行时导出面（11 → append-only 12） | ADR 0032:43；包 AGENTS；C5a | `index.ts` 静态清点 + C5a diff | **12 只增不减，本轮零增量** |
| `/testing` 导出面 | contract.test 第二断言 | git status：testing.ts 零 diff | **零触碰** |
| `hub-connection.ts` 模块运行时键面 | structure.test L616 | `grep '^export'` 单行 | **单键保持** |
| `hub-edge.ts`/`hub-split.ts`/`hub-session.ts`/`hub-namespace.ts`（+叶子件） | R8'' 清单 + L617–619 + DENY LIST | git status | **零 diff** |
| 单体 `createHubReplication` listen 行为（逐字节） | ADR 0032:4；GATE-C3 | `hub-connection.ts` diff 仅导入迁移 | **保持** |
| 既有测试面 | GATE-C1/C3；设计 §10 DENY | git status + OAP 文件头/尾 | **唯授权例外一处**（C5a 一行）；OAP 文件追加不触碰既有 36 用例 |
| peer 侧 / `plugin.ts` / Cordis 服务面 | ADR 0032:4/44 | git status | **零 diff** |
| ADR / 协议文本 | 本票兑现既有决策；R7'' deadline = T5 | git status（docs/** 零修改） | **零 diff** |
| `CONTEXT.md` SessionHost 词条机制措辞 | R7''（调和 = T5 附录） | `git diff -- CONTEXT.md` | **零触碰**（改动限「复制 Edge」词条 2 行） |
| 路由键布局 ↔ codec 字段序同步维护 | ADR 0032:26 + T1 守卫 | replication-protocol 零 diff；T1 守卫零触碰 | **保持** |

## 6. Evolution requirements

**无条件 evolution-required：无。** 修复不要求修订任何 ADR/CONTEXT/协议文本：两处 fatal 站点复用在册错误码与既有收口拓扑；账目修复是实现层偏差收敛。两项 SA1 裁决项（§8-O2 伪码注记 / §8-O3 首开占位边界）均为**设计文档内部一致性**事项，任一裁决结果都不需要触动 ADR/协议/CONTEXT（O3 若裁「镜像检查」则设计正文 `:568`「两者溢出均响亮收口」已授权，无需决策文本演进；若裁「登记差异」则只动设计伪码），故不构成 evolution-required。

## 7. Hard conflicts

**无。** 修复对决策集的全部触碰均为既有义务的兑现与缺口闭合；四类授权 diff 零增量且边界内（§3.1）；零静默决策矛盾（零决策文本 diff）；SA4 F1/F2 返工在授权单点范围内完成且未扩大。

## 8. Required actions

- **O1（非阻断观察，转 SA4/SA7 验证面，沿认迭代 0）**：适配器发射的 `namespace-error{sent}`/`namespace-failed` 事件不带可选字段 `connectionId`（SA4 M1 同案）——字段集 append-only 不变，不构成决策冲突；SA3 §8 维持登记不改行为，动态验收裁决归 SA4/SA7。
- **O2（非阻断，转 SA1——设计文档内部一致性）**：设计 §8.2 伪码 no-sink 行（`:390–391`）仍无两道上界检查注记，而设计正文 SD-5（`:298`）+ `:568` 明文要求；实现按**正文**落地（SA4 §10 F1 备注「可选：SA1 补注记」+ SA3 §8 deferred 第 1 条已登记）。建议 SA1 以设计修订补齐伪码注记，防止后续实现者按伪码倒退；**本轮无决策文本受扰，不阻塞**。
- **O3（非阻断，转 SA1/SA4——首开占位帧预算边界）**：首开分支（`:293–307`，与设计伪码 `:383–384` 一致）只查并发上界，占位项 `pendingFrameCount++` 不过帧预算检查：可达 `pendingFrameCount==16 且 pendingOpenCount≤3` 时新 ns 首开占位成第 17 项而不响亮收口（SA3 §8 deferred 第 2 条登记）。**决策层裁决**：有界性义务（ADR 0032:22「pending 有界缓冲」+ 包 AGENTS admission-bounded）仍成立——占位受并发上界 4 约束，账目硬上界 = 16+4 常数界，非无界放大；「恰在 16 处响亮」的精确阈值语义属设计/契约措辞层（设计正文 `:568` 与 SA6 OAP-C4「溢出 → 响亮收口」的读法），SA6 契约为 wiki/raw 验收产物、不构成 SA8 自动阻塞依据。SA3 未自行扩大改动面（SA4 required change 明确限定 no-sink 路径）= 处置正确；建议 SA1/SA4 裁决「镜像检查入首开分支」或「设计显式登记差异」。**若裁决落为代码变更，该 diff 应重过 SA8 implementation 复查**（失败语义变更）。
- **O4（流程登记，非阻断）**：SA4 §11 动态验证项（GATE 独立复算、根级门禁、非 memory transport、极小 maxFrameBytes、connectionId 决策）+ SA7 验收未做——本报告只闭合冲突面；§7 表内绿灯数字（GATE-C1 84 文件/686 测试、tsc exit 0、SA6 oracle 15/15）均为 SA3 报告值，未由 SA8 复算。
- **O5（范围跟踪，防丢账）**：T5 边界维持——`listen:false`/`nomicoreHubSessionHost` 服务面、worker 形态（R5'' 门禁 + R7'' 附录 deadline）、上界常数 → limits 键升级、egress 观测类成员 append-only 追加、工厂级服务面聚合、peer 侧对称拆分；本实现未预留、未提前实现任何一项。

## 9. Verdict

**clear。**

- 18 项对照全部为 no-conflict（11）或 implements-existing-decision（7）；evolution-required ×0、hard-conflict ×0。
- SA4 迭代 1 F1/F2 两项 MAJOR 的 required change 在授权单点范围内逐条兑现（§3 行 18）：F1 两道上界检查先于记录建立、被拒重 OPEN 零会话零解析调用；F2 释放次序 + 缓冲在场守卫双落地，`releaseBuffer` 唯一递减点在 flush/discard/terminal 三路闭合——ADR 0032:22 准入上界与账目义务、包 AGENTS admission-bounded 惯例在全部 OPEN 到达路径一致成立。
- 四类授权 diff 零增量且边界内（§3.1）；冻结面表（§5）全部「保持/零 diff/只增不减」；R8'' 六条零触发、R4'' 就地了结、R7'' 禁令与 A5 边界维持（§3 行 14–16）。
- SA3 迭代 2 报告的全部声明（§3 变更/§5 落实/§6 范围/§9 deviations）经当前 diff 逐条复核属实；DENY 面零 diff 亲测成立。
- 残余三项（§8-O1/O2/O3）均为非阻断观察且已具名路由（SA4/SA7 验证面、SA1 设计注记、SA1/SA4 边界裁决），不构成决策冲突。

## 10. requiresConflictRecheck

**false。** 理由：迭代 0 复审标记的全部待核对项（公共 API 首发布逐成员、四类授权 diff、生命周期/失败语义、R8''、冻结面）在本轮对修复后 diff 复核后**维持闭合且零增量**；F1/F2 修复是既有决策义务（ADR 0032:22）的兑现，不引入新公共 API/wire/schema/持久化/状态机/生命周期/失败语义面——修复所调的 no-sink 重 OPEN 失败语义属于**本变更集内首次发布**的公共面（ADR 0032:43 冻结自发布起算），变更集内收敛不触发发布后复查；本票剩余工作（SA4 复审动态复算、SA7 验收、SA1 对 O2/O3 的设计层裁决）是行为/质量/设计一致性事项而非决策冲突核对。唯 O3 若裁出代码变更，该新 diff 自带新一轮 SA8 implementation 复查（§8-O3 已注明），无需本报告预置标记。
