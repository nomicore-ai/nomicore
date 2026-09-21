# SA9 Standards Review — issue #420：SessionHost 公共工厂 + 内存管道完整协议回合（ADR 0032 决策 2/3 公共面 / spec #415 T3）

- Dispatch：`sa-4b9bc74a-76bb-42fd-989b-c28f59266c13`（mabf-sa9 / standards-review / iteration 0）
- 审查对象：worktree `/home/wangjian/nomicore-fix-issue-420`（分支 `mabf/issue-420`）的**已提交最终交付 diff** = commit `a315e7077576951cf0330596cdc588afbeca51be`（`feat(ws-replication): expose session host factory`，父 = `7039f6d` PR #426 merge）+ 证据链
- Owner comments：派工明文 none；REST Issue comments = `[]`；简报 `## Comments` 空 ⇒ 无 owner 追加要求
- **Verdict：`approve`**（0 BLOCKER / 0 MAJOR；7 条非阻断 MINOR 观察见 §10，全部已有在册处置或登记；`requiresConflictRecheck: false`——SA8 设计后复查与实现后复查均已存在且 `clear`、后者已置 `requiresConflictRecheck: false`，本轮未发现新的决策冲突面）
- 审查范围声明：本报告只判断仓库与工程标准（AGENTS/ADR/模块责任/既有架构惯例/单一事实源/生命周期对称性/文件范围/测试质量标准）；Issue 需求是否完整实现属 SA10，不在本报告裁决面。

---

## 1. Reviewed inputs

| 输入 | 状态 |
| --- | --- |
| `wiki/raw/task_issue-420.md`（简报；AC1–AC5；§Comments 空） | 读取 |
| `wiki/raw/task_issue-420_sa6_contract.md`（SA6 批准契约：§12.1 冻结签名逐字、§12.2 A1–A12、§12.3 AC3 机制 (a)、§12.4/§12.5、§12.6 两处授权编辑、§12.7 M1–M7、§15 U1–U10） | 全文读取 |
| `wiki/raw/task_issue-420_design.md`（SA1 iteration 1 批准设计：D1–D10、§11 ALLOW/DENY、§12 验收映射、§14 SA2-F1 修订映射、§15 recheck 武装） | 全文读取并逐节对照实现 |
| `wiki/raw/task_issue-420_sa2_review.md`（SA2 iteration 1：**approve**；SA2-F1 已解决；N1'–N3' 非阻断） | 全文读取 |
| `wiki/raw/task_issue-420_sa3_impl.md`（SA3 iteration 0：V1–V16、Deviations §1–§4） | 全文读取；宣称逐项与实际 diff、日志核对 |
| `wiki/raw/task_issue-420_sa4_review.md`（SA4：**approve**；0 BLOCKER/0 MAJOR；O1–O7） | 全文读取 |
| `wiki/raw/task_issue-420_sa7_report.md`（SA7：**approve**；载体提交 A/B 逐字节相等 19/19、全回合跳点 23/23、错误清理 19/19，各 3× 一致） | 全文读取 |
| `wiki/raw/task_issue-420_conflict_report.md`（SA8 task 门禁 clear，RA1–RA5）+ `_design_conflict_report.md`（clear，RA1'–RA6'）+ `_implementation_conflict_report.md`（**clear**，23 项对照，`requiresConflictRecheck: false`，RA1''–RA4''） | 全文读取 |
| `wiki/raw/task_issue-420_relevant_decisions.md`（SA8 决策摘录） | 全文读取 |
| 规范面（本轮读取） | 根 `AGENTS.md`、`packages/ws-replication/AGENTS.md`、`docs/AGENTS.md`、`docs/adr/0032-transport-decoupling-edge-session-split.md`（决策 1–5 + 本轮新增澄清附录 A1/A2/A3 全文）、`CONTEXT.md`（:225-235 词条，含本轮 diff）、`docs/protocols/instance-replication-v1.md`（约束面，经 SA8 三份报告援引条款复核） |
| 源码亲读（本轮） | commit 全量 diff：`src/hub-session-host.ts`（263 行全文）、`src/index.ts`/`src/hub-session.ts`/`src/hub-connection.ts`/`src/hub-split.ts` diff 逐行；`src/hub-split.ts` 全文（17 成员 port + sink 面）；`src/types.ts`（`HubConnectionState` 四态）；`packages/ws-replication/tsconfig.json`、`vitest.config.ts`（发现面）；DENY 面 `git diff --stat` 独立核验 |
| 测试亲读（本轮） | 三个新测试文件全文（test-d 131 行 / round 486 行 / shim-matrix 92 行）+ 夹具 `issue420-shim-hub.ts`（740 行全文）+ #418 两授权编辑 diff 逐行 |
| 证据日志（本轮 tail 复核） | `artifacts/sa3-issue420-{green-contract,package-suite,package-tsc,root-test,root-typecheck}.log`（均在 commit 内；数字与 SA3 报告 V3–V7 一致） |
| 工作区核验（本轮独立执行） | `git diff --check HEAD~1 HEAD`（exit 0）；重命名残留符号 grep；skip/only/todo grep；`expectedSequence` 计数；`worker_threads\|MessageChannel\|MessagePort` grep；7 矩阵文件 `git diff --name-only` 计数；`artifacts/` include 面 grep；commit vs 工作区证据文件计数 |

SA9 未修改任何生产代码、设计或测试；未运行测试/服务；唯一产物为本文件。

## 2. 标准符合性总账

| 标准轴 | 结论 | 证据（节） |
| --- | --- | --- |
| 根 AGENTS + 模块 AGENTS（`ws-replication`） | ✅ 符合 | §3 |
| `docs/AGENTS.md`（显式修订、CONTEXT 同步、不复制规则） | ✅ 符合 | §4.3 |
| ADR 0032 决策 1–5 + 澄清附录 A1/A2/A3 + 关联 ADR（0010/0012）与协议冻结面 | ✅ 符合（SA8 三阶段 clear；本轮独立复核一致） | §4 |
| 模块责任 | ✅ 符合 | §5 |
| 既有架构惯例 | ✅ 符合 | §6 |
| 单一事实源 | ✅ 符合 | §7 |
| 生命周期对称性 | ✅ 符合 | §8 |
| 文件范围（ALLOW/DENY + 授权编辑） | ✅ 符合（本轮 git 逐项核验零越界） | §9 |
| 测试质量标准 | ✅ 符合 | §9.4/§10 关联项 |

## 3. AGENTS 规约核验

### 3.1 根 AGENTS.md

| 条款 | 核验 | 结论 |
| --- | --- | --- |
| 「Domain docs」：root CONTEXT.md + docs/adr/ | 「SessionHost」词条随公共工厂轨同步更新（本轮 diff 亲读）；ADR 0032 落澄清附录而非新 ADR/静默改文 | ✅ |
| 「Module guidance」：改 `packages/` 前读最近嵌套 AGENTS | 全流水线（SA6/SA1/SA3/SA4/SA8）均援引 `packages/ws-replication/AGENTS.md` 条款裁决；本轮复核 §3.2 | ✅ |
| 「Instance replication」：ADR 0010 + `instance-replication-v1.md` 为规范；分块另见 ADR 0013/0022 | SA8 三份报告逐条援引协议 §4/§7.1/§13/§14/§17/§19/§21/§23.1 裁决；本票零 wire/错误码/事件变化（协议文本零 diff，本轮 `git diff --stat` 空）；分块面零触碰（`CAP_CHUNKED_UPDATE` 位判据复用既有式） | ✅ |
| 「Git worktrees」：worktree 归属 `.worktrees/` | Host 环境布置，非本交付 diff 控制面 | 不适用（不立项） |

### 3.2 `packages/ws-replication/AGENTS.md`

| 条款 | 核验 | 结论 |
| --- | --- | --- |
| 「Export production APIs through `src/index.ts`; keep programmable adapters and test controls in the explicit testing surface」 | 新公共工厂 `createHubSessionHost` + 7 类型**只**经 `src/index.ts` 追加（append-only：既有 11 值导出零变化，插入位字母序正确——本轮 diff 亲读）；shim 桥/夹具只落 `test/`；`src/testing.ts` 零 diff | ✅ |
| 「Keep admission bounded across handshake, ready, backpressure, and drain windows」 | 桥 pending 窗口每 ns ≤16 帧 + 单帧 ≤ `maxFrameBytes` + 溢出 `CONNECTION_POLICY_VIOLATION`(1008) 响亮收口（夹具 :464-476，镜像 `hub-connection.ts` `MAX_EARLY_FRAMES=16` 先例）；shim accept 早到帧有界缓冲同款；drain 门/背压账本零改动（dormant 降级 = ADR 决策 5 明文） | ✅ |
| 「Use injected transport, scheduler, randomness, and optional observer/clock seams. Observer or adapter failures must follow their documented isolation…」 | 工厂配置注入 registry/timer/limits/timeouts/observer/clock；`emitObserver` 复用 `dispatchReplicationObserver` 单点、`now` 经 `safeNow` 折叠且 observer 门控（`hub-session-host.ts:201-208`）；`onSignal` 分发同款逐监听者 try/catch 隔离（:227-235） | ✅ |
| 「Preserve protocol ordering and FSM invariants」 | 协议 FSM 唯一在零 diff `hub-namespace.ts`；session 侧重检入站 sequence 的代码不存在（`decodeMessage` 不传 `expectedSequence`——本轮 grep 计数 0；C5a 行为锚 + C5b edge 负控 + M5 变异红）；出站占位 0 + edge mux 盖章单点不动 | ✅ |
| 「Route namespace ownership…through public Registry leases…transport layer never reaches into Runtime」 | Registry open 仍由零 diff 通道发起；公共工厂只组装既有 splice，不接 Runtime/Persistence/Y.Doc | ✅ |
| 「Preserve shutdown safety…§21」 | `close()` 幂等单 promise（内部 sink closeTail 原样承接）；drain/收尾由 A11 断言（`hub.close()` resolve + 同一 promise + 零残留 timer 出帧 + 零 unhandled rejection） | ✅ |
| 「Bind Hub connections to the trusted identity…HELLO self-report never becomes authentication evidence」 | `remoteInstanceId` = edge 认证后身份（shim `accept` 在构造 edge 前经 `verifyToken` 结算，夹具 :581-613）；公共工厂只消费该值 | ✅ |
| 「Verification」：聚焦 + 包 typecheck + 根 typecheck/test | SA3 V3–V7：契约三路径 63/63、包 80 files/651 tests、包 tsc exit 0、根 typecheck 15 tsconfig exit 0、根 443 files/5381 tests——本轮对 commit 内日志 tail 复核数字一致；SA7 C1–C3 独立复跑一致（80/651、63/63、listen 矩阵 7/52） | ✅ |

## 4. ADR / 协议符合性核验

### 4.1 ADR 0032 决策 1–5

| 决策 | 实现面（本轮独立核验） | 结论 |
| --- | --- | --- |
| 决策 1（沿内缝拆分、两半皆 nomicore、**FSM 单份**、只允许分布式实例化） | 公共工厂内部复用重命名后的内部 splice（`createHubSessionSink`，`hub-session-host.ts:106-115`）——一条组装代码、两种 port 形态；denialSink/载体提交承载 = 生产 splice 直连真 port（夹具 :218-226）；夹具零应答合成/零错误码选择/零 FSM；`hub-namespace.ts`/`hub-edge.ts` 零 diff（本轮 `git diff --stat` 空） | ✅ |
| 决策 2（缝只过 `Uint8Array` 帧与纯 JSON；零 worker 依赖/类型；入站 edge 校验；出站占位 + mux 盖章；fire-and-forget 无接纳信号） | 描述子纯 JSON（C4b `structuredClone` 深等 + 掺函数 `DataCloneError` 负控）；`handleFrame` 字节入帧且无 `expectedSequence`；出站占位 0 由内部 sink 原样保留、listener 返回被分配 wire 序（0=未发送/被拒——E1/A12 承重锚，非被否决的逐帧接纳信号；协议 §23.1 `send-frame-rejected` 为规范锚）；本轮 grep `worker_threads\|MessageChannel\|MessagePort` 于 `src/**`+`package.json` = **0 命中** | ✅ |
| 决策 3（authorize 在 edge、OPEN 全解码、投影「仍传入，语义是 edge 授权结果的传递」） | `authorization: Extract<NamespaceAuthorization,{ok:true}>` 经 `open()` 描述子传入；adapterPort `openAdmission` 闭包恒回放 ok-投影（:178-182）；authorize 恰一次于 edge 台账（A4 `run.authorizer.calls.length===1`）；test-d 负控禁 `authorize`/`transport`/`port` 键；denied/throw 不过公共缝，wire 行为由生产 sink 承载（D6 裁决 (i)，SA8 行 5/11 裁 implements-existing-decision） | ✅ |
| 决策 4（路由键契约） | edge demux/路由与 #419 守卫零触碰（DENY diff 空） | ✅ |
| 决策 5（dormant 降级 + observer 发射点 = 拥有事实的一侧；事件 append-only） | adapterPort 17 成员与 `hub-split.ts:57-102` 逐一清点对齐：`dataGateOpen` 恒 true、`bufferedAmount` 恒 undefined、assembly per-session 单槽（size≥1 拒纳）、`chunkedUpdateNegotiated` 位判据与 `hub-edge.ts` 同式、`connectionState` 两态投影（行为面仅判 `==='closed'`，与 `hub-session.ts:211,251` 消费面一致）、零新事件型 | ✅ |
| 后果节（公开面 append-only 冻结；SessionHost 双轨之工厂轨） | 恰 +1 值 + 7 类型；`FROZEN_PRODUCTION_EXPORTS` 单行插入字母序位（既有 11 名零删除零重排，`:551` 全等断言形态不变）；test-d 一经锁定即冻结（S6/RA3'' 跨票账） | ✅ |

### 4.2 澄清附录 A1/A2/A3（本变更集新增文本）与实现一致性

本轮对附录逐句与实现比对：A1 四信号载体映射（close/terminateUnauthorized=句柄方法、settled=`onSignal`、closed=close() promise）+ `connection-fatal{code}` 公共化登记（code→close code 映射单点留 edge——夹具 :383 映射到真 port，`wsCloseCodeFor` 不动）+ 同步宿主 pipe 边界（`onFrame` 同步返回被分配序，异步形态留后续票）——与 `hub-session-host.ts` 逐句一致；A2 三载体（α 拉取 / β 描述子传入 + edge 侧处置 / γ 后续票）+ 重 OPEN 语义（至多一承载机械、路由相位单调、每请求收答、authorize 恒恰一次）——与 D6/D7 及夹具落地一致；A3 dormant 面 + U8 语义差登记——与 adapterPort 实现一致。附录自文「不修改决策 1~5 的机制要求」，经比对未发明实现所无的行为（`docs/AGENTS.md`「documentation-only wording changes must not invent implementation behavior」）。β 句「按准入结局」未覆盖载体提交的「按帧到达形态」第三判据——SA4 §2.4 提出、SA8 impl 复查行 11 已裁非冲突（附录的不变量句仍成立），措辞对齐随 RA1'' 登记（§10-M2）。

### 4.3 `docs/AGENTS.md`

| 条款 | 核验 | 结论 |
| --- | --- | --- |
| 「Amend or supersede prior decisions explicitly instead of silently contradicting them」 | R7''/R8'' 文本调和义务（#418 跨票账）在本变更集以**显式澄清附录 + CONTEXT 词条更新**闭合（SA8 impl 复查 §6 逐要素核对清偿）；非静默矛盾 | ✅ |
| 「update CONTEXT.md when introducing or changing a domain term」 | 「SessionHost」词条补公共工厂轨形态 + _Avoid_ 增「把公共描述子喂入 authorize/transport 面」（本轮 diff 亲读） | ✅ |
| 「Link to the authoritative source instead of copying its rules」 | 词条/附录援引 ADR 0032 与源码锚，未把协议规则复制成第二份规范文本 | ✅ |
| 「run `git diff --check`」 | 本轮 `git diff --check HEAD~1 HEAD` exit 0 | ✅ |

### 4.4 关联 ADR / 协议冻结面

ADR 0010（复制架构权威）/0012（实例身份）：零 wire/生命周期变化；`remoteInstanceId` = 认证身份；ACK = sequenced live apply（A7 口径）——SA8 行 18 no-conflict，本轮复核一致。协议 §4（序自 1 严格 +1：A8 两方向断言 + 无 0 泄漏）、§7.1（先 authorize 后 Registry open；零存在性泄露——A4-W2 `NAMESPACE_NOT_FOUND` 负控）、§13/§14（错误/close 码注册表零新增零改号：全部用在册码 `MALFORMED_FRAME`/`CONNECTION_POLICY_VIOLATION`→1008/`ACK_STATE_VIOLATION`→1002/`INTERNAL_ERROR`→1011/`NAMESPACE_REOPEN_REQUIRES_RECONNECT`）、§17/§19/§23.1（背压缺面 dormant、revoke 链、事件词汇 append-only）——全部保持，协议文本零 diff。

## 5. 模块责任

| 职责 | 应有归属 | 实际位置 | 结论 |
| --- | --- | --- | --- |
| 协议 FSM（含 OPEN 重开矩阵/违例判定/收口） | `hub-namespace.ts`（零 diff） | 零 diff（本轮 git 核验）；公共工厂与夹具均注入消费 | ✅ |
| 连接级纪律（入站序校验/出站盖章/close code 映射/admission 台账/authorize 唯一真实调用） | edge | `createHubReplicationEdge` 零改动；shim 装配用真 edge | ✅ |
| namespace 级组装（channels 容器/channelHost 组装/authorize shim） | session 半边 | 公共工厂复用 `createHubSessionSink` 单份组装 + adapterPort 第二 port 形态 | ✅ |
| 拒绝路径 wire 行为 | 生产代码 | denialSink = 生产 splice 直连真 port（D6 (i)；夹具零 ERROR 合成） | ✅ |
| 宿主桥（装配路由：按结局/按帧到达形态选既有承载机械 + 有界 pending + 字节中继） | **test 夹具**（非生产面） | `test/issue420-shim-hub.ts`；仅深路径 import（mock 安全，本轮逐 import 核对：全 `../src/*.js`，零包入口引用）；头注登记「非规范宿主样例」与保真度差异清单 | ✅ |
| 公共 byte-seam 面（描述子/句柄/信号） | 新生产模块 + `src/index.ts` | `src/hub-session-host.ts`（唯一新生产代码）+ index.ts append-only | ✅ |

无责任错位：生产侧新增面只有公共工厂模块；一切协议判定仍由零 diff 通道产出；桥只落 `test/`。

## 6. 既有架构惯例

| 惯例 | 核验 | 结论 |
| --- | --- | --- |
| 工厂命名/装配惯例（`createHubReplication`/`createHubReplicationEdge`/`createPeerReplication`） | `createHubSessionHost` 同形；配置对象注入 + 可选 observer/clock | ✅ |
| 内部重命名让出公共名（SA6 §12.6/U1 明文授权） | `createHubSessionHost→createHubSessionSink`、`HubSessionHostConfig→HubSessionSinkConfig`、删 `HubSessionHost = HubSessionSink` 别名、类名 `HubSessionSinkImpl`——本轮 diff 逐行亲读确认纯机械 + 头注同步；残留符号 grep：`HubSessionHostConfig` 仅存于新公共面引用面（index.ts re-export + test-d）、src 内旧工厂名零命中、旧别名零命中 | ✅ |
| 注释真实性（`docs/AGENTS.md` 精神延伸） | `hub-split.ts` 头注「绝不进 src/index.ts」旧陈述被本票推翻 → 同步更新为三工厂现状（仅头注，成员/类型零变化——本轮过滤 diff 证实）；SA2 N2 要求的交付说明单列已在 SA3 Changed paths 表兑现 | ✅ |
| 测试族命名/布局（`ws-replication-issueNNN-*`、`test/` 夹具） | 三个新测试文件 + 夹具命名与 #418/#136 族一致；头注纪律（职责/判据/边界登记）同款 | ✅ |
| 有界窗口先例（`MAX_EARLY_FRAMES=16`） | 桥 pending 同界同族收口码（1008）镜像 | ✅ |
| commit 惯例 | 信息 `feat(ws-replication): expose session host factory` 与 git log 风格一致；单内聚变更集；`git diff --check` 净 | ✅ |
| 过程产物归档惯例（#418 先例：wiki/raw 入 commit） | 本 commit 含 wiki/raw 全套 SA 产物 + 29 个 artifacts 证据文件（含探针 `.mts`）——探针不在任何 tsconfig/vitest/package include 面（本轮 grep 零命中），与 SA6/SA7 探针纪律一致；部分证据日志仍未跟踪 → §10-M3 | ✅（附 MINOR） |

## 7. 单一事实源

| 事实 | 权威源 | 派生态 | 漂移风险 | 结论 |
| --- | --- | --- | --- | --- |
| 协议状态/FSM 边 | 零 diff `hub-namespace.ts` | 无第二份（公共工厂/夹具均不解释通道状态） | 无 | ✅ |
| admission 结局 | edge 台账（只写不删、promise 多播） | 描述子 ok-投影（不可变快照，闭包回放） | 低（同一结算值） | ✅ |
| wire 序分配 | edge `OutboundQueue.emitOne`（mux 盖章 `[8..12]`） | session 占位 0；桥原样回传返回值（红臂开关仅限夹具 option + A12 单用例） | 低 | ✅ |
| codec 语义 | `@nomicore/replication-protocol` 单份 | 中继经 `encodeMessage`/`decodeMessage` 同一 codec（E3：14 帧逐字节保真）；夹具无第二份帧语义 | 无 | ✅ |
| observer 分发/时钟折叠 | `dispatchReplicationObserver`/`safeNow` 单点 | 公共面与信号分发同款复用，不分叉 | 无 | ✅ |
| 通道表 | 各 sink 的 `channels`（公共/拒绝互斥命名空间；永不删除 = 既有不变量） | 桥 `channels`/`dataFacetOf` 只读投影委托 denialSink（R7 观测边界已登记） | 低 | ✅ |
| 路由相位 | 桥内 per-ns 单份 Map | 无第二份；互斥/单调/不可逆 + 双守卫（closed 先查、相位次查） | 低 | ✅ |
| 错误码/close 码映射 | 协议 §13/§14 + edge `wsCloseCodeFor` 单点 | 公共信号只载 `code`；桥/工厂不映射 close code | 无 | ✅ |

## 8. 生命周期对称性

| Start / acquire | Stop / release | Failure recovery | 结论 |
| --- | --- | --- | --- |
| `open()` 同步建句柄（前置 throw：空 connectionKey / 重复 (connectionKey, ns)——响亮，M7 变异日志含 `重复开启` 签名证明 throw 面真实） | `close()` 幂等（内部 sink closeTail 单 promise；A11 断言同一 promise 引用）；`terminateUnauthorized()` 无通道 no-op resolve | connection-fatal → 连接投影 `closed` + 出站 0 值语义（SA7 S1 实测）；`handleFrame` 解码失败 → `connection-fatal{code ?? 'MALFORMED_FRAME'}` 零吞帧 | ✅ |
| `onFrame`/`onSignal` 注册 | 返回退订函数（onFrame 退订仅当当前 listener 匹配时置空——后注册替换语义与冻结声明一致） | 监听者 throw 隔离（emitSignal 逐监听者 try/catch；observer 单点同款） | ✅ |
| 桥 per-connection（`sessionFactory` 闭包） | edge `requestSinkClose` → fan-out（句柄 + denialSink，closeTail 单 promise 幂等） | closed 守卫放弃在途路由（零可观察输出）；E10 续体整段 try/catch → `INTERNAL_ERROR`(1011) 响亮收口、**零无承载 reject**（两 suite unhandled 哨兵绿） | ✅ |
| 桥 pending 窗口（相位 routing） | 路由完成按到达序同步冲刷（flush 在续体同一同步段，无 await 间隔——SA2 N2' 不变量头注登记） | 溢出 = 1008 响亮 + 清窗（无静默丢弃）；载体提交放弃入窗 OPEN 条目（与生产 abort 语义逐点同构，SA8 行 11 源码亲验） | ✅ |
| `terminateNamespace` 相位挂起（routing 期） | `finally → settleTerminateWaiters` 按结局委托句柄/denialSink | closed/续体异常 → no-op resolve（镜像 listen quiet 语义） | ✅ |
| host `sessions` Map（无删除路径） | —（冻结语义「session 对象随连接存活（终态不拆）」字面兑现） | 夹具内 host 按连接一对一创建 ⇒ 无运行时影响；未来跨连接复用单一 host 的宿主须定生命周期约定 | ✅（§10-M6 登记） |

## 9. 文件范围与测试质量

### 9.1 ALLOW 符合性（本轮 `git show --name-only` + diff 逐项核验）

13 个交付路径全部有 ALLOW 条目：新生产模块 `hub-session-host.ts`（ALLOW 1）、`index.ts` 追加（2）、`hub-session.ts` 重命名（3）、`hub-connection.ts` 机械跟随（4）、`hub-split.ts` 仅头注（5）、夹具（6）、三新测试文件（7/8/9）、#418 两授权编辑（10/11）、ADR 附录（12）、CONTEXT 词条（13）。**无 ALLOW 外改动**；artifacts/wiki 过程产物与 #418 先例同口径（非 ALLOW 管辖面）。

### 9.2 DENY 符合性（本轮独立执行）

`git diff --stat HEAD~1 HEAD` 对以下全部为空：`hub-namespace.ts`、`hub-edge.ts`、`src/testing.ts`、其余 src 单点（frame-io/backpressure/round-engine/update-*/bulk-transfer/liveness/observer/validate/defaults/types/plugin 等——commit 文件清单不含）、`docs/protocols/`、`packages/replication-protocol/**`、`packages/namespace-registry/**`、`apps/**`、`domains/**`、`packages/ws-replication/package.json`、**7 个矩阵测试文件**（`git diff --name-only` 计数 0——断言体逐字不变，仅经 `vi.mock` 二次执行）。协议文本零 diff。

### 9.3 授权编辑逐字核对（SA6 §12.6）

1. contract 测试 `FROZEN_PRODUCTION_EXPORTS`：仅插 `'createHubSessionHost'` 一行，位于 `createHubReplicationPlugin` 与 `createPeerReplication` 之间（字母序），既有 11 名零删除零重排——✅（diff 亲读）。
2. structure 测试：`:13` 注释、`:39` 导入、`:421/:528/:571/:594` 调用点、`:618` 期望列表 `['createHubSessionSink']`——7 处机械跟随，其余断言逐字不变——✅（diff 亲读）。

### 9.4 测试质量标准

| 判据 | 核验 | 结论 |
| --- | --- | --- |
| 零 skip/only/todo | 本轮 grep 三个新文件 + 夹具 0 命中 | ✅ |
| 断言 = 运行时行为/wire 原字节 | round 测试全部经 driver/harness wire 时间线、observer 事件、探针缝观测断言；A8 逐帧回指 wire 原帧；无源码字符串行为断言 | ✅ |
| 结构扫描判据纪律 | C4a（零 worker 依赖）与 C5c（无 `expectedSequence`）为 AC 明文「零依赖或类型/代码不存在」授权的**补充**结构门，行为判据（A2/A3/A8、C5a/C5b）同时在场，二者不互相替代（SA6 §12.4/§12.5 纪律声明一致） | ✅ |
| test-d 类型锁定 | 正控逐项（含 `authorization` 精确 `Extract<…,{ok:true}>`、`connectionId: string\|undefined`、listener 返回 number）+ 负控 `@ts-expect-error` ×6（超出契约 4 项下限：denied 投影/authorize/transport/port/namespaceFrame 面/onFrame 无 number），未触发即 TS2578 红自证敏感性；双面发现（`vitest --typecheck` + 包 tsconfig `include: test/**/*.ts`——本轮核对） | ✅ |
| 红/绿证据链 | V1/V2 红（TS2305×8+TS2307、3 files failed，能力缺口红因）→ V3–V7 绿；基线 77/588 → 80/651（+3 文件/+63 用例，增量自洽）——本轮 tail 复核 commit 内日志 | ✅ |
| 变异敏感性 | M1（内建红臂 A12：断言绿/对象红，设计 §12 A12 明文形态，非软化）、M2/M3/M4/M5/M7/M7b 实跑红（日志在工作区；M4 = 恰反空跑 1 红而 52 listen 仍绿 ⇒ 判据非恒真） | ✅（证据归档见 §10-M3） |
| 反空跑 | 计数阈值 + 非 OPEN 缝入序非 0 + `settled≥1` + 零 `INTERNAL_ERROR` + `carrierCommitted≥1` + `pendingOverflow===0` + afterAll 零 unhandled；锚替换（`settled` 代 `ACK_STATE_VIOLATION`）经 SA8 行 22 裁为事实确定的读法更正（ac5 该用例为 peer 侧 fatal），connection-fatal 正控由 A12 更强承载——非弱化 | ✅ |
| runner 发现面 | 三文件命中根 `vitest.config.ts` include/typecheck.include（本轮核对）；机制 (a) 动态 import 7 矩阵文件同 runner 二次注册；夹具仅深路径 import ⇒ mock 工厂无递归 | ✅ |

## 10. 非阻断 MINOR 观察（全部已有在册处置；不阻断 approve）

| # | 观察 | 现状/处置 | 来源 |
| --- | --- | --- | --- |
| M1 | 设计 wiki 文本 §7 D7 `namespaceFrame` 行（routing 相位非 OPEN 帧入 pending 窗口）滞后于实落的载体提交机制——字面机制被冻结矩阵 `ac7-faults` 证伪（2 failed 日志在场），偏差经 SA8 裁 implements-existing-decision、SA7 动态逐字节等价证实 | SA8 RA1'' 登记为 wiki 内务（Controller/SA1 补正设计文本；三重登记在场：夹具头注 + SA3 Deviation 1 + SA8 行 11）；落地前不得援引 D7 旧字面指责实现 | SA3/SA4-O1/SA8 |
| M2 | ADR 0032 附录 A2 β「按准入结局」措辞未描述载体提交的「按帧到达形态」第三路由判据（非冲突——附录不变量句仍成立） | SA8 行 11 已裁；措辞对齐随 RA1'' 一并落 | SA4 §2.4/SA8 |
| M3 | commit 证据集不完整：SA3 报告引用的变异/分歧日志（`sa3-issue420-mutation-*.log` ×7、`design-letter-divergence.log`、`red-contract.log`）、SA6 `runner-trigger-red.log`、SA7 `focused-420-tests.log`/`listen-matrix-baseline.log` 及任务简报 `wiki/raw/task_issue-420.md` 仍为工作区未跟踪文件（本轮计数：commit 内 29 个 artifacts 文件 vs 工作区 40 个 sa3/6/7-issue420 条目）；文件均在场、可随时补入，不影响交付代码面 | 建议 finalize/提交方在同一交付归档中补齐（#418 先例含任务简报）；不阻断 | 本轮核验 |
| M4 | SA6 三个诊断探针 `.mts` 因授权重命名仍 import 旧名 `createHubSessionHost`（重跑前需改 `createHubSessionSink`） | SA3 Deviation 2 / SA8 RA4'' 登记转交 SA6/Controller；探针不在任何 gate include 面（本轮复核） | SA3/SA4-O6/SA8 |
| M5 | 夹具探针 `handles` 以 namespaceId 为键——多连接同 ns 场景后开者覆盖先开者（当前断言均单连接，不受影响） | SA4 O3 登记：未来多连接断言使用前改 `(connectionKey, ns)` 复合键 | SA4 |
| M6 | 公共 host `sessions` Map 无删除路径（`close()` 不摘除）——冻结语义「session 随连接存活」字面兑现；夹具内 host 按连接一对一创建 ⇒ 无运行时影响 | SA4 O4 登记：后续服务轨/宿主接线票（非目标）明确 host 生命周期约定 | SA4 |
| M7 | `sa3-issue420-mutation-M1-a12-red-arm.log` 显示 `1 passed \| 9 skipped` 且未记录命令行（`-t` 聚焦运行痕迹，源码零 skip 已核实）；A12 绿由 `green-contract.log` 10/10 承载，不影响判定 | SA4 O7 登记：后续变异日志统一带命令行回显（证据卫生） | SA4 |

## 11. 结论

**`approve`**。交付 diff 在全部标准轴上符合仓库与工程标准：

1. **AGENTS/ADR/协议**：根与模块 AGENTS 条款逐项满足；ADR 0032 决策 1–5 与澄清附录 A1/A2/A3 和实现逐句一致；#418 跨票文本调和义务（R7''/R8''）以显式附录 + CONTEXT 词条在本变更集合规闭合（非静默矛盾）；协议冻结面（wire/错误码/事件词汇/路由键/序纪律）零触碰。
2. **模块责任与单一事实源**：协议 FSM 单份（`hub-namespace.ts` 逐字节零 diff）、wire 序单点（edge mux）、codec 单份、observer 隔离单点复用、admission 台账单点；公共工厂 = 同一 splice 的第二 port 形态，无第二份状态机/组装代码。
3. **生命周期对称性**：open/close/terminate/onFrame/onSignal/pending/terminateWaiters/桥 close 全部有对称释放与响亮失败路径；幂等性有断言（同一 promise）；零无承载 reject（E10 + 两 suite unhandled 哨兵）。
4. **文件范围**：13 个交付路径全部在 ALLOW 内；DENY 面（含 7 矩阵文件与协议文本）本轮独立核验零 diff；两处 SA6 授权编辑逐字执行。
5. **测试质量**：零违禁形态；test-d 双面发现 + 6 负控自证敏感；结构门严格限于 AC 明文授权面且与行为判据并存；红绿证据链自洽（77/588 → 80/651 → 根 443/5381，commit 内日志本轮 tail 复核）；变异 M1–M7b 实跑登记；反空跑判据有 M4 负控证明非恒真。

7 条 MINOR 全部为已登记/已裁决项（设计文本滞后一行 RA1''、附录措辞对齐、证据归档补齐、探针陈旧名、探针键型、host 生命周期约定、日志命令行卫生），无一触及交付代码正确性或标准符合性，不阻断 approve。

**requiresConflictRecheck: false**——SA8 前置门禁/design/implementation 三阶段复查均 clear 且 impl 复查已闭合（`requiresConflictRecheck: false`）；本轮标准审查未发现新的决策冲突面、冻结面触碰或文本-实现矛盾。
