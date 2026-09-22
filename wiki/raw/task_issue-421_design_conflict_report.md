# task_issue-421 设计冲突报告（SA8 设计后复审）

- 迭代：1（**修订版复审**——原位更新迭代 0 报告，只反映当前被审对象 `wiki/raw/task_issue-421_design.md` 迭代 1 修订版，732 行；不堆叠历史结论）
- 被审对象：设计迭代 1（逐条落实 SA2 R1–R6 与本 SA8 迭代 0 的 A1–A5；映射见设计 §15）
- 基线：HEAD `7039f6dae8e7d29f0c929492f0ca2119bc63afaa`（亲测 `git log`；与设计 §0 声明一致；工作树零实现——`git status --porcelain` 仅 SA6 资产 + 简报/设计/评审/报告家族）
- 复审范围：修订面与新增决策面逐项裁决 + 迭代 0 阻断项（A1/A2）解决核对 + 登记/非阻断项（A3/A4）与实现票义务（A5）存续核对；不做设计优劣评审（SA2 职）、不做实现核对（实现 diff 落地后另出 implementation 报告）

## 1. Reviewed subject: design

设计复审（design vs 决策集），本轮被审对象含四类新增/修订决策面：(1) 早到帧 admission 符号族搬迁（SA8-A1 选项 α）；(2) #418 契约测试 C5a 冻结清单的限定性 append-only 更新（SA2 R1）；(3) 准入管线冲刷/结算/异常纪律修订（SA2 R3/R4/R5）；(4) upgrade 门 6/7 次序对齐（SA2 R6）。

## 2. Inputs and decision set

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-421_design.md`（迭代 1，732 行） | 已读全文 |
| `wiki/raw/task_issue-421_sa2_review.md`（216 行，verdict=reject，R1–R6 + N1–N6） | 已读全文；其冻结面发现（R1/R2）本轮独立复核 |
| `wiki/raw/task_issue-421.md` + `wiki/raw/task_issue-421_sa6_contract.md`（§12.7 SD-1~SD-6、§15-8、OAP-C3/C8、H4 逐字核对） | 已读关键节 |
| 决策集：`docs/adr/0032`（全文 44 行亲读；决策 1–5 + 否决备选 + 后果节）、其余 ADR 0001–0030 无关面（前序 `task_issue-421_relevant_decisions.md` §0 全量盘点沿认：无整体 superseded；0031→0032 纯改号）、`docs/protocols/instance-replication-v1.md` §1/§2/§3/§13/§14/§19（§1 不变量 4 与 §2 括注本轮逐字复读）、`CONTEXT.md:225–235` 三词条（亲读）、`packages/ws-replication/AGENTS.md`、`docs/AGENTS.md` | 已读 |
| 前序 SA8 产物：`task_issue-421_conflict_report.md`（task 门禁 clear）+ `task_issue-421_relevant_decisions.md`（R4''/R5''/R7''/R8'' 义务账逐条复读） | 已读；义务账沿认 |
| #418 冻结面实测：`contract.test.ts:50`（`import * as productionApi`）、`:144–156`（`FROZEN_PRODUCTION_EXPORTS` 11 名 + `FROZEN_TESTING_EXPORTS`）、`:551`（`toEqual` 精确等值）；`structure.test.ts:34`（四模块 import）、`:616–619`（C0c 四条模块键面断言，亲读） | 亲测（见 §3/§5） |
| 生产源码锚点复核 | 设计引用的关键锚点逐点亲测（见 §3 Evidence 列与下文）；`hub-connection.ts:44–151` 符号族自包含性逐行亲读 |
| 全测试面扫描：`grep -rln createHubReplicationEdge|installEarlyFrameAdmission|hub-connection test/` → 4 文件；其中 3 个 `*-red` 测试仅注释引用 `hub-connection.ts`（无 import/无模块面断言） | 亲测（无第三处冻结面） |
| Owner 评论 | REST 快照为空（dispatch 明示）——无 override 来源、无评论级要求 |
| spec #415 | 库内不存在（前序报告 §2 已证）；简报正文 = T4 唯一规范文本 |

**迭代 0 证据勘误（本轮更正入档）**：迭代 0 报告 §3 行 7/§5 曾记「无测试锁定 index 桶导出面（grep 亲测）」——该证据错误：#418 契约测试 C5a 以 `toEqual(FROZEN_PRODUCTION_EXPORTS)` 精确冻结公共运行时导出面（本轮 + SA2 R1 双重证实）。迭代 0 的 verdict=reject 依据（行 16，L616 击穿）不受影响且独立成立；但该勘误说明迭代 1 将 C5a 纳入授权面是必要而非可选。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（设计迭代 1） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0032 决策 1 | :12–14（协议状态机单份；宿主自写连接级半边 = fork，否决） | D1 Architecture-C 维持：`hub-edge-host.ts` 包装**未改动**的 `HubReplicationEdgeImpl`（每 accept 一实例经 `sessionFactory` 注入 `HostSessionAdapter`）；连接级 FSM 零复现。**修订**：早到帧 admission 四符号（`MAX_EARLY_FRAMES`/`EarlyFrameAdmission`/`installEarlyFrameAdmission`/`closeAdmission`）逐字搬迁至新内部模块 `hub-upgrade-admission.ts`（不进 index.ts），`hub-connection.ts` 与 `hub-edge-host.ts` 两消费方共享同一实现——#190「同一机制单点」保持 | **implements-existing-decision** | ADR 0032:12–14；设计 §7-D1；`hub-connection.ts:44–151` 逐行亲读（符号族自包含：仅依赖 `DuplexTransport`/`ResolvedLimits` 类型与 `transport.close`，`closeAdmission` 仅被 `installEarlyFrameAdmission` 内部调用 2 处——搬迁可行性成立）；`hub-connection.ts:429–463` 组合根 `sessionFactory = createHubSessionHost`（工厂注入 `HostSessionAdapter` 结构同构，亲读） | 无（实现后核对搬迁逐字性与两消费点） |
| 2 | ADR 0032 决策 2 | :16–18（缝只过 Uint8Array 帧 + 纯 JSON + 4 控制信号；出站 sequence=0 占位 + mux 点重写 `[8..12]`；wire 逐字节不变） | D2 egress 面成员等价重暴露 `HubSessionEdgePort`；**修订（SA2 R3）**：sink 投递面按 kind 分派——`{kind:'open'}` → `openNamespace(message)`（不带 wire 序）、`{kind:'frame'}` → `namespaceFrame(message, sequence)`（带 wire 序），与内部缝契约逐字对齐 | **implements-existing-decision** | ADR 0032:16–18；`hub-split.ts:105–112` 亲读（`openNamespace(message: OpenNamespaceInbound)` 无序 / `namespaceFrame(message, sequence)` =「非 OPEN 的 namespace 域帧…sequence = wire 序」）；`hub-session.ts:210–216`（sendData 判定次序）+ `backpressure.ts:149–178`（sendControlFrame/tryEmitDataFrame）亲读，与设计 §7-D2 等价表一致；`frame-io.ts:178–205`（`emitOne` → `writeBe32At(bytes, 8, seq)` 盖章单点）亲读 | 无 |
| 3 | ADR 0032 决策 3 | :20–22（authorize 在 edge 单点；未授权 OPEN 不过缝 + 闩锁；pending 有界缓冲/并发 OPEN 上界/sink 失败响亮收口/drain 门/session 随连接存活 = edge 规范职责） | D3 管线阶段 1–7 全职责；**修订（SA2 R4）**：`settleAdmission` 补 `openAdmission` reject 处理（→ ns `INTERNAL_ERROR`，对齐单体 shim 路径）与 `connectionClosed` 前置守卫（迟归 → `finishTerminalSilently` 零 wire 零事件零 settled）；`runSettle`/`runResolve` 入口 `.catch` 兜底零 unhandled rejection | **implements-existing-decision** | ADR 0032:20–22；设计 §7-D3/§8.2；`hub-edge.ts:323–328`（台账先于投递）、`338–369`（beginAdmission 唯一 authorize / openAdmission 台账缺失 reject）亲读；`hub-split.ts:57–64`（openAdmission 契约原文：「台账缺失 ⟹ 不变量破坏 → reject（响亮 fail-loud → startOpen catch → INTERNAL_ERROR，零静默 fallback）」）亲读——设计 R4a 落点兑现该缝契约已登记语义；`hub-namespace.ts:505–527`（finishOpenSilently 零 wire 零迁移）亲读 | 无 |
| 4 | ADR 0032 决策 4 | :24–26（路由键定偏移 + 两分支逐字节复现单体 + ERROR 有界 mini-decode + 布局同步维护契约） | §8.5 零改动复用内部 `routingKeyOf`/ERROR 特例；no-sink 合成落点在适配器（形状复刻 edge 侧 R-none）；消费 T1 守卫 `ERROR_NS_PREFIX_BUDGET=64` | **implements-existing-decision** | ADR 0032:24–26；`hub-edge.ts:558–567`（`routingKeyOf`：ns 帧 `start=21,end=56`、UPDATE_CHUNK `start=22,end=57`、前缀字节 + 解码一致性）、`526–532`（ERROR 特例）、`570–586`（R-none 合成 + `namespace-error{sent}`）亲读；`frame-io.ts:45–53`（`namespaceErrorFrame` 的 `relatedSequence` 可选、调用点不传）亲读 | 无 |
| 5 | ADR 0032 决策 5 | :28–30（观测纪律：连接域事件在 edge；缺面 = dormant；字段集 append-only） | §8.6 观测面逐事件登记；**修订**：deny/throw 应答按缓冲 OPEN 数（waiter 语义）+ `namespace-error{sent}` 恰一（HB2）+ `namespace-failed` 恰一；已收口迟归结算零事件面；`dataFacetOf(): undefined` 降级；零新事件类型 | **no-conflict** | ADR 0032:28–30；`hub-namespace.ts:483–503` 亲读（`finishOpenError`：`for (const _waiter of waiters) sendChecked(namespaceErrorFrame(...))` 逐 waiter 帧 + `emitNsErrorSent(code)` 注释「HB2：…不按 waiter 数」+ `emitNamespaceFailed` 仅真实迁移 failed 时恰一 + `notifySettled()`）；`hub-edge.ts:704–710`（`maybeFinishDrainEarly` 的 `closedFlag` 早退——迟归静默不通知 settled 的观测等价论证成立，亲读） | 无 |
| 6 | ADR 0032 后果节 | :41–43（edge 以普通工厂导出、非 Cordis 插件、无 Registry 依赖；公开面发布即冻结、演进只能 append-only） | §10：`index.ts` append-only（运行时导出 11 → 12 + 8 公共类型 `export type`——类型导出不产生运行时键）；**新增（SA2 R1）**：#418 契约测试 C5a 冻结清单获**限定性 append-only 更新**（追加 `'createHubReplicationEdge'` 一名、零删除、按字典序、断言语义 `toEqual` 不变）纳入 ALLOW LIST 并登记授权理由 | **implements-existing-decision**（附完成门同步裁决，见 §4/行 7） | ADR 0032:41–43 亲读（:41 明文「edge 以普通工厂（`createHubReplicationEdge`）导出」——发布本身是决策文本授权面）；`index.ts` 亲数 11 运行时导出、无工厂名；contract.test `:50/:144–156/:551` 亲读（`import * as productionApi` + 11 名清单 + `Object.keys(productionApi).sort()).toEqual(...)`）；字典序核验：`createHubReplication` < `createHubReplicationEdge` < `createHubReplicationPlugin`（'E'<'P'）——插入位置明确；包 AGENTS「Export production APIs through `src/index.ts`」 | 实现后逐项核对（§5/§8-A1'） |
| 7 | #418 完成门冻结面（非决策文本）：C0c structure.test L616 + C5a contract.test | structure.test `:616`：`Object.keys(hubConnectionModule).sort()` == `['createHubReplication']`；contract.test `:551`：公共导出面精确等值 | **L616**：选项 α 下 `hub-connection.ts` 改为 import 消费（import 不进模块命名空间键）→ 模块运行时导出面保持单键，**零测试改动保持绿**（迭代 0 行 16 违规消除）；**L617–619**：edge/session/split 三模块零 diff → 键面不变；**C5a**：append-only 一名同步（行 6 授权链） | **no-conflict**（完成门同步已显式裁决落档；决策文本层零冲突） | structure.test `:34,616–619` 亲读（四条断言原文）；`hub-connection.ts:153–154`（模块唯一导出 `createHubReplication`）亲读；全测试面扫描（§2）：无第三处冻结面（3 个 `*-red` 测试仅注释引用）；设计 §10 ALLOW/DENY 限定行 + §11 矩阵行 + §13-8 回滚 + §14-4 复核面四处一致（迭代 0 A2 指出的证据链失真已修正，见 §3.1） | 实现后核对四类 diff（§8-A1'） |
| 8 | 协议 §1 不变量 4 | :25（「closed、conflicted 或 failed 后不得重新 open，重新 add 必须重建连接」——亲读原文） | SD-5 维持：no-sink 态重 OPEN → 重解析（缓存 grant；authorize 恰一次由 T2 冻结台账保证）；窄读法沿认：重开禁令明文限定生命周期终态，no-sink = 无会话生命周期曾开始，不落入禁字母表 | **no-conflict**（读法登记维持） | 协议 §1 不变量 4 原文本轮逐字复读；`hub-edge.ts:323–328`（台账只在首个 OPEN 建立）；SA6 OAP-C8 负控措辞「重复 OPEN：不新增解析调用（闩锁）」；设计 §7-D3 SD-5 + §13-2 回退方案在档 | 登记于案（SA2 行为面攻击权保留） |
| 9 | 协议 §1 不变量 2/5 + §3 | :15–22/:47–52（每方向 sequence 严格递增；HELLO_ACK 前禁 ns 帧；envelope 20B、sequence `[8..12]` 从 1 起） | 出站盖章经单 `OutboundQueue` 单点（§8.4）；HELLO 门/drain 门零改动继承（阶段 1）；`hub-edge.ts:391–397`（HELLO_REQUIRED 1002）、`495–499`（drain 窗口 OPEN 丢弃）亲读 | **no-conflict** | 协议 §1/§3；`frame-io.ts` `emitOne`（`lastSeq + 1` 不回绕 + 耗尽响亮收口）亲读 | 无 |
| 10 | 协议 §2 | :35–46（Upgrade 受信身份；HELLO 自述不采信；「宿主 accept 未提供受信身份即接线缺陷——实现必须响亮拒绝（同步 TypeError）」——亲读原文） | D4 双入口门序复刻；**A3 读法登记已落档设计正文**（§6 行 + §7-D4 门 2 全文）：§2 硬核成立；「同步 TypeError」形态在工厂面不可达且不应达（`verifyToken` 双入口条件依赖 + 「accept 永不 reject」冻结不变量）；单体运行期形态 = 1008 + `verifier-missing`（纵深防御层），工厂逐字节复刻；`verifyToken` 类型可选 ≠ 运行时容错（N2 措辞补全） | **no-conflict** | 协议 §2 原文；`hub-connection.ts:263–267` 亲读（门 2 原文 + 注释「类型必填 + §2.3 构造期 TypeError 后的纵深防御——JS 调用方绕过类型」——两层读法与源码注释一致）；§8.1 构造期 TypeError 限于无条件必填成员（`instanceId`/`timer`/`authorize`/`resolveSessionSink`）——与单体 §2.3 构造层同形 | 无 |
| 11 | 协议 §13.1/§13.2 + §14 | 注册表 append-only 深冻结；close 粗分类（1002 协议错/1008 policy/1009 超限/1011 内部错或 control backpressure） | 零新错误码；SD-2 选 `CONNECTION_POLICY_VIOLATION`(1008)（并发超额 + pending 溢出，理由登记）；OAP-C6/R5 sink 投递 throw → `INTERNAL_ERROR`(1011)；升级拒绝闭集复刻 | **no-conflict** | `errors.ts:114,116,117,122,123,128` 亲核（五码元数据与设计 §2.3 表一致；`CONNECTION_BACKPRESSURE`=1011 出站额度终局与入站准入分立的理由成立）；`hub-connection.ts:116–121`（第 17 帧 → 1008 先例）亲读；§14 分类语义匹配（宿主 sink 缺陷 = hub 侧内部错 → 1011；对端灌帧 = policy 违例 → 1008） | 无 |
| 12 | 协议 §19 | :637–652（adapter 形状；授权只在 OPEN 检查；revoke 走在场通道） | 回调第三参 = ok 投影（`Extract<NamespaceAuthorization, {ok:true}>`）；authorize 每 (连接, ns) 恰一次；`revokeNamespace` → established sink `terminateUnauthorized()`（**R5：reject 归一恒 resolve**），无会话态无副作用 resolve | **no-conflict** | 协议 §19；`hub-split.ts:33–53`（`HubOpenAdmission` authorized 结局携带 ok 投影）亲读；`hub-namespace.ts:1717–1734`（`terminationSettled` = `cleanupTail.then(()=>undefined,()=>undefined)` 吞清理异常）亲读——R5/ER-4 归一与单体纪律同形 | 无 |
| 13 | CONTEXT.md 三词条 + `docs/AGENTS.md` | :225–235（亲读：复制 Edge :226–228 / SessionHost :229–231 / 路由键契约 :233–235）；docs/AGENTS 域术语同步义务 | ALLOW LIST 含 `CONTEXT.md`「复制 Edge」词条追加宿主出面句 + `_Avoid_` 增补；**改动限于该词条**（不触 SessionHost 词条机制措辞、不复述 ADR 0032:22 机制句——A5 边界在设计 §10 行明文） | **implements-existing-decision** | 设计 §10 ALLOW LIST 末行；`docs/AGENTS.md` Authority/Editing 节；词条行号亲核 | 实现票按 A5 边界落地（§8-A1'） |
| 14 | 跨票义务 R4'' | #418 SA8 impl 报告 R4''；前序报告 §3 行 15 | `resolveSessionSink` 造成真实解析在途窗口 ⟹ 阶段 4 有界缓冲（≤16 帧连接级共享 + 序保冲刷 + 溢出 1008 响亮）就地兑现；**账目单点化（N4）**：`flushPending`/`discardBuffer` 单点递减 | **implements-existing-decision** | 设计 §7-D3 阶段 4/SD-3；SD-3 模块常数分支（内存上界推导 16 × maxFrameBytes 比照 `MAX_EARLY_FRAMES` 账法——`hub-connection.ts:44–54` 注释原文同款账法亲读）；`types.ts:44–52`（`maxConcurrentAssembliesPerConnection` = 分块 assembly 面，与 OPEN 准入并发判然两分）亲读 | 无 |
| 15 | 跨票义务 R5''/R7''/R8'' | 同上 | R5''：公共面不预设跨线程实现（§1 非目标）；R7''：全程以「宿主缝可观察行为 + 回调门控」定义「不过缝」，未援引 ADR 0032:22 机制句字面（全文检索核对），附录 deadline 维持 T5；R8''：`hub-split.ts`/`hub-edge.ts`/`hub-session.ts`/`hub-namespace.ts` 零 diff——`hub-connection.ts` 导入迁移不在 R8'' 清单任何条目（清单不含该文件模块面，迭代 0 已核） | **no-conflict**（义务按期存续） | 设计 §1/§6/§7-D1/§10 DENY LIST；R8'' 清单原文（relevant_decisions §5） | 实现后按 R8'' 清单核对 diff（§8-A1'） |
| 16 | SA6 契约面（非决策文本；wiki/raw = 证据） | SA6 §12.7 SD-1~SD-6、§15-8、EF-C2、OAP-C8 | SD-1~SD-6 落定均在 SA6 授权带内；D7 `channels` 显式不提供（`namespaces` 替代）——SA6 §15-8 原文授权「若设计判定不可提供，须显式裁决并同步 #418 既有测试」（设计裁决 + 证白盒锚全落单体路径零同步）；OAP-C8 负控窄读法（pending 合流 + 闩锁；no-sink 重解析除外——行 8 裁决） | **no-conflict** | SA6 §15-8 原文亲读；`hub-connection.ts:429–463`（白盒锚 `hub.connections[0].channels` 落 `HubReplicationImpl` 单体路径——本票零改动）亲读；SA2 §6「经核验成立」同判 | 无 |

**裁决分布**：no-conflict ×9、implements-existing-decision ×7、evolution-required ×0、hard-conflict ×0。迭代 0 的冻结完成门违规（行 16）已消除（行 7）。

### 3.1 前序 SA8 发现解决核对（A1–A5）

| 行动 | 迭代 0 要求 | 迭代 1 落实 | 核对结果 |
|---|---|---|---|
| **A1（阻断）** | 消除 L616 击穿；推荐选项 α（符号族搬迁新内部模块） | 选项 α 采纳：`hub-upgrade-admission.ts` 新增（ALLOW LIST 行），`hub-connection.ts` 改导入迁移；β/γ 否决理由登记（§7-D1） | **已解决**——L616 保持绿零测试改动（import 不进模块键，亲证）；符号族自包含性逐行亲读成立；#190 单点保持 |
| **A2（阻断）** | 修正四处证据链失真（「组合根零改动」「C0a–C0d 零改动绿」「仅引 L617 漏 L616」「清单略 C0c」） | D1 理由 2 重写（「冻结面触碰收敛到两处显式授权点」+ L616–619 逐条绿声明）；§11 引 L616–619 全块 + C5a 消费者行补列；§10 hub-connection.ts 行 = 「导入路径迁移」非零 diff；§13-9 回滚含迁移还原 + C5a 还原 | **已解决**——四处口径统一且与 ALLOW/DENY/GATE/矩阵/回滚/复核面六处一致（本轮逐处核对） |
| A3（非阻断） | 协议 §2「（同步 TypeError）」括注读法登记 | §6 行 + §7-D4 门 2 读法登记全文（含单体两层形态源码依据） | **已落档**（行 10 核对） |
| A4（非阻断） | 两项自登记分歧裁决落档 | §7-D3 SD-5 引行 8 裁决；§13-1 分歧族三态完整化（(i) 收敛 (ii) 已登记 (iii) 显式登记 + 收敛回退） | **已落档**（行 8；R3 将可收敛部分收敛——established 投递面、deny/throw 应答数） |
| A5（实现票义务） | CONTEXT.md 边界 + 冻结面实现 diff 核对 | §10 边界行 + §14-4 四类 diff 核对面 | **已挂实现票**（§8-A1' 细化） |

### 3.2 SA2 冻结面发现解决核对（R1/R2；R3–R6 的决策文本一致性并入上行表）

R1（C5a 击穿）→ 行 6/7 授权同步收口；R2（L616 击穿）→ 行 7 选项 α 收口；R3（kind 分派 + waiter 应答数）→ 行 2/5 与单体源码逐点一致（`hub-split.ts:105–112` 契约 + `hub-namespace.ts:474–503` waiter 语义亲读）；R4（reject 处理 + 迟归守卫）→ 行 3 与缝契约登记语义一致；R5（sink 异常纪律）→ 行 11/12 注册表与单体纪律一致（发布即冻结条款属新面首发布自有定义，无既有冻结面被改）；R6（门 6/7 次序）→ `hub-connection.ts:304–315` 亲读证实单体次序 = 微任务让位 + 迟拒复查**先于** instanceId 文法——设计步骤 6/7 已对齐。N1–N6 均有落点（设计 §15 映射本轮逐条核对属实）。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| —（无） | — | — | — |

无 override 亦无需 override：Owner 评论快照为空；无新 ADR/协议版本；设计对决策集的使用均为兑现既有义务。**C5a 清单更新不是 override**：#418 契约测试是仓内完成门而非决策文本（docs/AGENTS.md：wiki/raw 与测试均非规范决策面）；其修订 authority 链 = ADR 0032:41（决策文本明文授权 `createHubReplicationEdge` 公共发布——不更新清单则该决策不可实施）+ ADR 0032:43（公开面「演进只能 append-only」——清单 +1/零删除正是该演化纪律的测试侧记录）+ Issue #421 正文 AC1（Owner 要求「从包公共入口导出」）+ 包 AGENTS（生产 API 经 `src/index.ts`）。同步已按「显式契约同步裁决」标准落档：ALLOW LIST 限定行 + 授权理由 + §14-4 复核面 + §13-8 回滚 + 本报告即重过门。SA8 不替 Owner 或 SA1 创建 override——本条不创建任何 override。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（设计层核对） |
|---|---|---|---|
| wire 帧格式 / 消息注册表 / 错误注册表 / close 分类 | ADR 0032:4/18/26；协议 §3/§13/§14；GATE-C4 | `errors.ts:114–128` 亲核；设计 §2.3 表与源码一致 | **合规**（零新码、零 wire 变更；replication-protocol 在 DENY LIST） |
| 公共入口运行时导出面（HEAD 11 名） | ADR 0032:43 append-only；包 AGENTS；contract.test C5a | `src/index.ts` 亲数 11 名；C5a `:144–156/:551` 亲读 | **合规**（append-only 11→12：值导出恰 +1，类型导出不产生运行时键；C5a 清单同步 = 该冻结纪律的测试侧记录，见 §3 行 6） |
| `hub-connection.ts` 模块运行时导出面 == `['createHubReplication']` | #418 C0c structure.test L616 | L616 亲读；选项 α 下 import 不进模块键 | **合规**（迭代 0 违规消除；零测试改动保持绿） |
| `hub-edge.ts`/`hub-split.ts`/`hub-session.ts`/`hub-namespace.ts` | R8'' 清单 + structure.test L617–619 + DENY LIST | L617–619 亲读（edge/session/split 三键面 + split 零运行时导出） | **合规**（四文件零 diff 计划） |
| 既有 77 测试文件 / 588 测试（语义、条目数、断言强度） | GATE-C1/C3；设计 §10 DENY LIST（77 文件亲数） | 全测试面扫描：唯二冻结面 = C5a/L616（均已有处置）；3 个 `*-red` 测试仅注释引用 `hub-connection.ts` | **合规（含一处授权例外）**：C5a 期望值 +1（断言强度 `toEqual` 不变、条目数不变、零删除）；L616–619 零改动；其余 76 文件零触碰 |
| `FROZEN_TESTING_EXPORTS`（/testing 面） | contract.test C5a 第二断言 | `:552` 亲读；testing.ts 在 DENY LIST | **合规**（零触碰） |
| 单体 `createHubReplication` listen 行为（逐字节） | ADR 0032:4；GATE-C3 | `hub-connection.ts:429–463` 组合根亲读 | **合规且声明准确**（迭代 0「零改动」失真已修正为「导入路径迁移、行为零变化」——A2 收口） |
| peer 侧 / `plugin.ts` / `testing.ts` | ADR 0032:4/44；SA6 §10 | 设计 §10 DENY LIST | **合规** |
| ADR / 协议文本 | 本票兑现既有决策；R7'' deadline = T5 | 设计 §10 DENY LIST | **合规**（零决策文本变更） |
| `CONTEXT.md` SessionHost 词条（:229–231）机制措辞 | R7''（文本调和 = T5 附录，不提前） | 设计 §1 非目标/§6/§10 | **合规**（仅计划改「复制 Edge」词条；机制句零援引——全文核对） |

## 6. Evolution requirements

**无条件 evolution-required：无。** 设计不要求修订任何 ADR/CONTEXT/协议文本；`CONTEXT.md`「复制 Edge」词条追加为既有 docs-sync 义务（行 13），非演进。C5a 期望更新是仓内完成门同步（§4），不是决策文本演进。

前序报告 §6 两条条件性义务核对：SD-1 走包装路径（`hub-split.ts` 缝类型零改动）→ 未触发；SD-3 模块常数 + 推导（升级 limits 键的 append-only 路径与 `validateLimits` 义务已在 §7-D3/§13 Follow-up (d) 登记）→ 未触发。

## 7. Hard conflicts

**无。** 未发现与 ADR/协议/CONTEXT 不兼容且无合法 override 的条目；设计未引入静默决策矛盾（零决策文本 diff 计划）；迭代 0 唯一阻断项（L616 击穿）已由选项 α 消除且证据链同步修正。

## 8. Required actions

- **A1'（实现票义务，随设计放行）**：四类授权 diff 逐项核对——(a) `index.ts` append-only（值导出恰 +1 `createHubReplicationEdge`、零改名零删除、8 类型 `export type`）；(b) `hub-connection.ts` 仅导入迁移（模块运行时导出面保持 `['createHubReplication']`、accept/acceptTrusted 逻辑零变化、行为零变化）；(c) `hub-upgrade-admission.ts` 搬迁逐字性（注释随迁、`hub-connection.ts` 与 `hub-edge-host.ts` 两消费点共享、不进 index.ts）；(d) contract.test C5a 恰一行追加（字典序位置、零删除、断言语义不变、零其他断言/条目触碰）。另：R8'' 清单对实现 diff 生效；`CONTEXT.md` 改动限于「复制 Edge」词条（不触 SessionHost 词条、不复述机制句）；公共 API 首发布逐成员核对（ADR 0032:43，含 R5 异常纪律条款文案）；structure.test L616–619 与 588 基线保持绿。
- **A2'（非阻断，登记）**：(i) 迭代 0 证据勘误已入档（§2）——「无测试锁定 index 桶导出面」为误，后续轮次以 C5a 为既知冻结面；(ii) 措辞微瑕：设计 §7-D1「三个消费点」与同节「两消费方」计数口径不一（消费点 4 处/消费模块 2 个）——纯文字问题，不构成任何裁决面变化，修订可选。

## 9. Verdict

**clear。**

- 16 项对照全部为 no-conflict（9）或 implements-existing-decision（7）：ADR 0032 决策 1–5 + 后果节、协议 §1/§2/§3/§13/§14/§19、CONTEXT 三词条、R4''/R5''/R7''/R8''、#418 完成门两面全部相容；evolution-required ×0、hard-conflict ×0。
- 迭代 0 阻断项 A1/A2 已解决并逐点核实（§3.1）：选项 α 使 L616 零改动保持绿（符号族自包含性亲证）；四处证据链失真全部修正、六处口径一致。A3/A4 读法与分歧登记落档；A5 挂实现票（§8-A1'）。
- 新增决策面裁决：C5a append-only 同步 = ADR 0032:41+43 授权链下的完成门同步（非 override，§4），授权与边界（一名/零删除/断言语义不变/回滚在档）充分；R3/R4/R5/R6 修订均与缝契约、单体纪律、注册表逐点一致（§3.2）。
- SA2 R1–R6 + N1–N6 全部有修订落点且与本门决策集核对不冲突（设计 §15 映射逐条属实）；设计余下分歧（§13-1 (ii)(iii)、§13-2 no-sink 重解析）维持已登记状态，收敛回退方案在档，SA2 行为面攻击权保留。

## 10. requiresConflictRecheck

**true**。理由：

1. **公共 API 面首发布**：`index.ts` append-only + 8 公共类型 + 工厂/句柄/egress/sink 面发布即冻结（ADR 0032:43），须在实现 diff 上逐成员核对（含 R5 sink 异常纪律契约条款文案——新失败语义随首发布定形）；
2. **四类授权 diff 尚待实现核对**（§8-A1' (a)–(d)）：C5a 一行、`hub-connection.ts` 导入迁移、搬迁逐字性、L616–619/588 基线保持——任何超出授权边界的 diff 即重触发；
3. **新增生命周期所有权与失败语义**（OAP-C5 `CONNECTION_POLICY_VIOLATION`/1008、OAP-C6 与 R5 `INTERNAL_ERROR`/1011、settled 账目、迟归守卫、fire-and-forget 续体零 unhandled rejection）尚待实现核对；
4. R8'' 清单 + §5 冻结面（含 `CONTEXT.md` 词条边界）须 implementation 复查逐项闭合。
