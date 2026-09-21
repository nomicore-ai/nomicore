# SA9 Standards Review — issue #418：`HubConnectionImpl` 拆分 Edge/SessionHost + 单体进程内组合（ADR 0032 决策 1 / spec #415 T2）

- Dispatch：`sa-2371d304-cc89-42b9-a5c0-d97d043c6828`（mabf-sa9 / standards-review / iteration 0）
- 审查对象：worktree `/home/wangjian/nomicore-fix-issue-418`（分支 `mabf/issue-418`，HEAD `27e012b6606e48797842a79e11e3505819c34cc6`）内的**当前交付 diff**（SA3 iteration 2 产物）+ 证据链
- Owner comments：REST comments 读取返回 `[]`（派工单明示）；简报 §Comments 为空 ⇒ 无 owner 追加要求
- **Verdict：`approve`**（0 BLOCKER / 0 MAJOR；4 条非阻断 MINOR 观察见 §9；`requiresConflictRecheck: false`——SA8 设计后复查与实现后复查均已存在且 `clear`，本轮未发现新的决策冲突面）
- 审查范围声明：本报告只判断仓库与工程标准（AGENTS/ADR/模块责任/架构惯例/单一事实源/生命周期对称/文件范围/测试质量）；Issue 需求是否完整实现属 SA10，不在本报告裁决面。

---

## 1. Reviewed inputs

| 输入 | 状态 |
| --- | --- |
| `wiki/raw/task_issue-418.md`（简报；5 AC；§Comments 空） | 读取 |
| `wiki/raw/task_issue-418_design.md`（SA1 iteration 2 批准设计，736 行：D1~D8、§11 ALLOW/DENY、§12 验收映射） | 全文读取并逐节对照实现 |
| `wiki/raw/task_issue-418_sa2_review.md`（SA2 iteration 2：approve，finding 集空，N1'~N5'） | 全文读取 |
| `wiki/raw/task_issue-418_sa3_impl.md`（SA3 iteration 2 原位版，成功路径） | 全文读取；§3/§5/§6/§8 宣称逐项与实际 diff、日志核对 |
| `wiki/raw/task_issue-418_sa4_review.md`（SA4：approve；O1~O4 观察） | 全文读取 |
| `wiki/raw/task_issue-418_sa7_report.md`（SA7：approve；F-1 = SA4 O1 动态复证） | 全文读取 |
| `wiki/raw/task_issue-418_design_conflict_report.md` + `task_issue-418_implementation_conflict_report.md`（SA8 两阶段复查：均 clear） | 全文读取 |
| `wiki/raw/task_issue-418_sa6_contract.md`（SA6 approve；C0a~C0d/C1~C6/U1~U5） | 全文读取 |
| 规范面 | `AGENTS.md`（根）、`packages/ws-replication/AGENTS.md`、`packages/replication-protocol/AGENTS.md`、`docs/AGENTS.md`、`docs/adr/0032-transport-decoupling-edge-session-split.md`、`docs/protocols/instance-replication-v1.md`（约束面）、`CONTEXT.md`（:225-235 词条） |
| 源码亲读（本轮） | `hub-split.ts`（127）/`hub-edge.ts`（790）/`hub-session.ts`（293）/`hub-connection.ts`（469）全文；`frame-io.ts`/`backpressure.ts` diff 逐行；HEAD `hub-connection.ts`（`git show`：`dispatchReady`/`onOpenNamespace`/`withChannel`/channelHost 内联/五路收口/drain）逐段比对；`hub-namespace.ts:52-100`（`HubChannelHost` 24 成员）；`types.ts:182-186`（`HubConnection` 公共面） |
| 测试亲读 | 两 ALLOW 测试文件关键断言面（到达点断言、C0c 导出面、M1-revoke 重定基）；codec 守卫测试头 |
| 证据日志 | `artifacts/sa3-issue418-*-iter2.log` 5 份、`artifacts/sa7-issue418-package-suite.log`、`-post-removal-focused.log` tail 复核 |
| 工作区核验 | `git diff --stat HEAD`、`git diff --name-only HEAD -- packages/ws-replication/test`、`git diff --check HEAD`、`git stash list`、残留符号 grep、skip/only/todo grep、源码字符串断言 grep |

SA9 未修改任何生产代码、设计或测试；未运行测试/服务；唯一产物为本文件。

## 2. 标准符合性总账

| 标准轴 | 结论 | 证据（节） |
| --- | --- | --- |
| 根 AGENTS + 模块 AGENTS（`ws-replication`、`replication-protocol`） | ✅ 符合 | §3 |
| ADR 0032 决策 1~5 + 关联 ADR（0010/0012/0013/0022/0023） | ✅ 符合（SA8 两阶段 clear；本轮独立复核一致） | §4 |
| 模块责任（D2 劈分总账落地） | ✅ 符合 | §5 |
| 既有架构惯例 | ✅ 符合 | §6 |
| 单一事实源 | ✅ 符合 | §7 |
| 生命周期对称性 | ✅ 符合 | §8 |
| 文件范围（ALLOW/DENY） | ✅ 符合（git 逐项核验零越界） | §5/§8 |
| 测试质量标准 | ✅ 符合（断言仅增强不弱化；runner 收集；零违禁形态） | §8/§9 |

## 3. AGENTS 规约核验

### 3.1 根 AGENTS.md

| 条款 | 核验 | 结论 |
| --- | --- | --- |
| 「Instance replication」：改连接/namespace 状态机、背压、shutdown drain 须以 ADR 0010 + `docs/protocols/instance-replication-v1.md` 为规范契约，并读最近包 AGENTS | 设计 §2/§6、SA8 两份报告逐条援引协议 §1/§3/§6.3/§7.1/§13/§14/§15.2/§17/§19/§21/§23 裁决；wire 零变化（契约 17 用例 + 金标绿） | ✅ |
| 「Git worktrees」：worktree 归属 `.worktrees/` | 属 Host 环境布置，非本交付 diff 的控制面 | 不适用（不立项） |

### 3.2 `packages/ws-replication/AGENTS.md`

| 条款 | 核验 | 结论 |
| --- | --- | --- |
| 「Export production APIs through `src/index.ts`…」 | 两工厂（`createHubReplicationEdge`/`createHubSessionHost`）与缝类型仅**模块级导出**，`index.ts`/`testing.ts` 零 diff。该条款约束**公共**生产 API；本票 issue 明文「零新公共 API」（AC + ADR 0032 后果节「导出面留后续票」），且仓库既有先例成立：`hub-namespace.ts` 模块级导出 `HubNamespaceChannel` 不进 index、`frame-io`/`backpressure` 内部模块测试相对导入。C0c 断言（structure 测试 :616-619）钉死：hub-connection=`['createHubReplication']`、edge/session 各单工厂、缝模块零运行时导出 | ✅（惯例一致，非条款规避） |
| 「Keep admission bounded across handshake, ready, backpressure, and drain windows」 | ready 窗口**零缓冲**（窗口帧到达点即时投递，无窗口日志——M1 到达点断言 + C0d 绿）；唯一新增 admission 面 = per-ns 一次性 `{promise}` 台账（`hub-edge.ts:141`），基数 ≤ `channels` Map（同阶锁步，listen 只增不减）；handshake（早到帧 ≤16，组合根原样）/backpressure（额度账本）/drain（drain 门）三窗口零变化 | ✅ |
| 「Use injected transport, scheduler, randomness, and optional observer/clock seams」 | 全部经 `HubReplicationEdgeConfig`/`HubSessionHostConfig` 注入；零 worker_threads/MessageChannel 依赖（ADR 决策 2）；`now` 经 `safeNow` 折叠（hub-edge.ts:246-249） | ✅ |
| 「Bind Hub connections to the trusted identity…」 | `peerInstanceId` = 认证身份（accept 门 5 / acceptTrusted 门 2 原样），HELLO 恒等校验在 edge（hub-edge.ts:417-424 = HEAD 逐行） | ✅ |
| 「Preserve protocol ordering and FSM invariants」 | HELLO 门（handshaking 仅 HELLO）、入站 expectedSeq 先于 payload、出站序列不回绕（耗尽 → 1008）、终态通道 REOPEN_REQUIRES_RECONNECT——全部随符号逐行迁移 | ✅ |
| 「Route namespace ownership…through public Registry leases…transport layer never reaches into Runtime」 | Registry open 仍由零 diff 通道在 session 半边发起；edge 无 Registry 依赖（工厂签名不含 registry） | ✅ |
| 「Role-specific Cordis plugins…teardown upstream services at the composition root」 | `plugin.ts` 零 diff；组合根（`hub-connection.ts`）只做装配与服务面 | ✅ |
| 「Preserve shutdown safety…§21」 | 五路收口同构（hub-edge.ts:255-266/590-684 vs HEAD 逐行比对）：closedFlag 先置 → setConnState（或 L1 直赋）→ 清句柄 → sender.teardown → `sink.close()` 同步 quiesce 前缀（transport.close **之前**）→ transport.close → cleanupAll → settleTail → onConnectionDropped | ✅ |
| 「Verification」：changed state-machine path 聚焦测试 + 包 typecheck + 根 typecheck/test | SA3 §6：聚焦 56/56、包 75/75-569/569、三 typecheck EXIT=0、根 439/439-5299/5299 `Type Errors no errors`（日志本轮 tail 复核） | ✅ |

### 3.3 `packages/replication-protocol/AGENTS.md`

codec 生产码 `src/**` 零 diff（git 核验）；守卫测试仅进 `test/`（新增 `codec-namespace-routing-key-offset.test.ts`，5 用例，断言面 = 真实编码字节）；「Add public APIs only through `src/index.ts`」零触碰。✅

## 4. ADR / 协议符合性核验

| 决策 | 实现面 | 结论 |
| --- | --- | --- |
| ADR 0032 决策 1（沿内缝拆分、两半皆 nomicore、listen=进程内组合、**FSM 单份**；否决双实现并存） | 连接 FSM 唯一在 `hub-edge.ts`；通道 FSM 唯一在**零 diff** `hub-namespace.ts`；session 只做容器 + 组装 + 分派壳 + shim（无 FSM 复现）；iteration 1 被删机制（OpenEntry/PendingEvent/settlePending/sunkNames/dropPendingEntries/authorizeFirstOpen/replayAuthorization/projections）`grep` src 零命中，`revoked` 仅存于注释（说明其不存在）；组合根 `createEdge`（hub-connection.ts:429-463）与 D7 伪代码逐成员一致 | ✅ |
| 决策 2（缝只过 `Uint8Array` + 纯 JSON + 4 控制信号；fire-and-forget；入站 edge 校验；出站占位 + `[8..12]` 盖章） | `emitOne` 单点耗尽检查→`writeBe32At(bytes,8,seq)` 盖章（frame-io.ts diff）；message 形态薄包装复用同一字节路径（peer 侧与 6 个直构测试零改动）；`HubOpenAdmission` 纯 JSON 三态；`openAdmission` 为每 (连接,ns) 一次性授权结局载体——**非**被否决的逐帧出站接纳回执；该新缝面成员经设计 §15.1 诚实登记、SA8 设计（注 C'）与实现两阶段复查均 clear，未静默扩缝 | ✅ |
| 决策 3（authorize 在 edge、OPEN 全解码、被拒零会话资源、通道零改动、准入管线 edge 职责） | 真实 authorize 单点 `beginAdmission`（hub-edge.ts:338-360：台账先写、恰一次、入参 = HEAD 逐值、`Promise.resolve` 包裹 + try/双回调吸收同步 throw/异步拒绝）；shim 仅拉取已结算结局（hub-session.ts:105-111，结构性不可达授权器）；denied → `{ok:false}` → 零 diff 通道 `!authz.ok` 短路在 `registry.open` 之前（C0b 零调用臂绿）；闩锁/失败面由零 diff 通道原生 | ✅（注 C' 目的读法，SA8 已裁） |
| 决策 4（定偏移路由键、两分支复现、codec 守卫） | `routingKeyOf`（hub-edge.ts:558-567：chunk `[22,57)`/`[21]`、标准 `[21,56)`/`[20]`；读数 ≠ 解码值 → MALFORMED 响亮）；R-none 合成 = HEAD `withChannel` 未知 ns 分支逐符号（`namespaceErrorFrame` 产出与 HEAD 内联字面逐键相同——safeMessageFor 同源）；ERROR 特例静默；守卫测试 5/5 | ✅ |
| 决策 5（观测归属与 append-only；缺面 dormant） | 零新事件型/字段；namespace 域事件由零 diff 通道经 port 在到达点原生次序产出；隔离语义仍在 `dispatchReplicationObserver` 单点；L1 两处**无事件直赋**逐点保留（hub-edge.ts:280 `:656`），M3a/M3b 零 `connection-state-changed` 绿；`drainDeadline` 死字段未迁移；onLivenessLost 不调 clearDrainHandles（= HEAD 形态） | ✅ |
| ADR 0010/0012/0013/0022/0023 + 协议 §21 | SA8 实现后复查 §3 行 8/11/13/15 no-conflict；peer 侧零 diff；`plugin.ts` 服务构造零 diff；本轮独立复核一致 | ✅ |
| `docs/AGENTS.md`「Amend or supersede explicitly」 | 决策文本面（`docs/**`/`CONTEXT.md`）零 diff；机制句/词条表述差按 R7'' 登记存续（deadline = worker 形态票 SA8 前置门禁之前或之中），未产生静默矛盾 | ✅ |

## 5. 模块责任与文件范围

### 5.1 责任归属（对设计 D2 总账逐行核验）

| 职责 | 设计归属 | 实际位置 | 结论 |
| --- | --- | --- | --- |
| 连接 FSM / 入站序列校验 / HELLO / liveness / GOAWAY / reauth / 连接级背压 / 五路收口 / 出站盖章 mux / drain 判定 | edge | `hub-edge.ts` 唯一实现（组合根与 session 零 FSM 符号） | ✅ |
| `channels` 容器 / `HubChannelHost` 24 成员组装 / 通道全生命周期 / Registry open / 消息组装 + 占位编码 + 闸门前置 / 分派壳 / authorize shim | session | `hub-session.ts`（24 成员逐名 = `hub-namespace.ts:52-100` 接口形状；authorize 成员签名不变、实现换拉取） | ✅ |
| accept/acceptTrusted 门 / 有界早到帧 admission / 服务面（revoke/requestReauth/close/connections）/ dropConnection | 组合根 | `hub-connection.ts` 与 HEAD 代码级相同（modulo 注释与分配点换装）；`HubReplicationEdge` 为 `HubConnection`（types.ts:182-186）结构超集 | ✅ |
| 真实 authorize（恰一次）+ admission 台账 + 路由事实源 | edge | `beginAdmission`/`admissions` Map；路由（:529/:541/:547）与 drain（:706）**只读台账**，不读 `channels` 投影（全文件 grep：投影仅 :207-209 只读 accessor） | ✅ |

### 5.2 文件范围（git 逐项核验）

- **实际改动**：`hub-split.ts`/`hub-edge.ts`/`hub-session.ts`（新增 3）、`hub-connection.ts`（改写）、`frame-io.ts`（+57/-13）、`backpressure.ts`（+54）、`test/…structure.test.ts`、`test/…pending-window-matrix.test.ts`（新增 2）——全部在设计 §11 ALLOW 清单内，逐行对得上 ALLOW 目的列。
- **DENY 零 diff 核验**：`hub-namespace.ts`、`index.ts`、`testing.ts`、`types.ts`、`defaults.ts`、`validate.ts`、`plugin.ts`、`peer-connection.ts`、`peer-namespace.ts`、session 机械件 9 文件、`packages/replication-protocol/src/**`、`docs/**`、`CONTEXT.md`、`apps/**`、根配置（`vitest.config.ts`/`tsconfig*`/`package.json`）——`git diff --stat` **全部为空**；既有测试文件 `git diff --name-only HEAD -- packages/ws-replication/test` = **0**（SA6 契约文件与两锚均未触碰）；`git diff --check HEAD` 干净；`git stash list` 空（HEAD 基线采集已复原）。
- codec 守卫测试新增在 `replication-protocol/test/`（ALLOW 行 9 维持项的 iteration 0 产物），不触碰 codec 生产码。

## 6. 既有架构惯例

| 惯例 | 既有先例 | 本实现 | 结论 |
| --- | --- | --- | --- |
| 内部模块 + 测试相对导入 | `frame-io`/`backpressure`/`hub-namespace` | 两工厂 + 缝类型模块级导出 | ✅ 一致 |
| 类型缝注入风格 | `HubChannelHost`/`ConnectionSenderHost` | `HubSessionEdgePort`/`HubSessionSink` + 工厂注入 | ✅ 一致 |
| 连接级 Map 台账（生命周期内只增） | 早到帧 admission / `inboundAssemblySlots` | `admissions`（per-ns 一次性） | ✅ 一致 |
| 出站队列单点序列 | `OutboundQueue.emitOne` | message 薄包装 + 字节路径复用**同一** `emitOne`（无第二分配器） | ✅ 一致 |
| 可选宿主成员缺失 fail-loud | `ConnectionSenderHost` 纪律 | `emitControlFrame?`/`emitDataFrame?` 缺失 → 首用响亮 throw（backpressure.ts:176-190） | ✅ 一致 |
| 中文 doc 注释 + 文件头契约块 | 全仓惯例 | 三新模块文件头均固化职责与同步不变量（hub-split.ts:1-22 缝纪律、hub-edge.ts:14-19 OPEN 时序承重次序） | ✅ 一致 |

## 7. 单一事实源

| 事实 | 权威源 | 派生态 | 漂移风险评估 |
| --- | --- | --- | --- |
| 通道在场性 | session `channels` Map（唯一写入点 = 首个 OPEN 投递） | edge `admissions` 台账（edge **自身投递动作**的记录，非镜像对侧容器） | 低：锁步不变量在 `onOpenNamespace` ①→② 同一同步段成立（hub-edge.ts:323-328；`startOpen` 同步前缀在 ② 内同步拉取——零 diff 通道代码亲证）；C0d 锁步断言 + I13b 锚钉死 |
| 出站序列 | `OutboundQueue.emitOne`（单点跨连接级帧与 ns 域帧） | 无派生 | 低：C1a~C1d 契约绿；占位 0 不上线（C6a 反证） |
| 授权决定 | edge 单次真实 authorize 结算 | admission promise 三态投影（至多结算一次） | 低：denied 单分支折叠 = HEAD 唯一出口；shim 两态唯一（revoked 载体删除） |
| drain 完成判定 | 通道终态 ⟺ settled 通知（零 diff 通道 I12） | edge 两量（`admissions.keys ⊆ settledNames`，单调） | 低：单触发点 `onChannelSettled`（= HEAD :529 同构）；M2 锚绿 |
| `channels` 只读投影 | session Map | edge face 同引用 | 低：纯观测（13 个既有白盒锚），路由/drain 零读取 |

无第二套窗口等待/回放、无第二套 authorize/拒绝面、无第二套 drain 判定、无第二套字节 mux——平行机制检查全部闭合（含 iteration 1 最大平行面随 D5 删除）。

## 8. 生命周期对称性与测试质量

### 8.1 生命周期对称

| 获取/开始 | 释放/停止 | 失败恢复 | 结论 |
| --- | --- | --- | --- |
| edge 构造（`sessionFactory` 建 session）→ 早到帧同管线重放 | 五路收口 → `sink.close()`（同步 quiesce 前缀 + 异步尾，`??=` 幂等单点）→ transport.close → cleanupAll → onConnectionDropped | 迟归 admission 无条件传播（`.then` 闭包独立于连接状态；cleanupAll 不摘台账——H1 lease 回收依赖，issue171-red:194 锚绿） | ✅ 对称 |
| admission 台账（只增不减） | 随连接对象 GC（无独立清理面，无悬挂义务） | 台账缺失 = 不变量破坏 → `openAdmission` reject → INTERNAL_ERROR **响亮**（C0b fail-loud 臂） | ✅ |
| registry lease/session（通道收口链，零 diff） | denied/throw 在 `registry.open` 之前短路（C0b 零调用臂）；revoke-窗口-ok transient + 回收 = HEAD 原生 D-H1（M1-revoke 对 HEAD 基线） | isOpenAborted 静默吸收 | ✅ |
| timer 句柄（hello/reauthDeadline/liveness/通道） | cleanupAll 单点清 reauthDeadlineHandle；onLivenessLost 不调 clearDrainHandles（= HEAD）；`drainDeadline` 死字段未迁移 | stale fire 零副作用 | ✅ |

### 8.2 测试质量

| 标准 | 核验 | 结论 |
| --- | --- | --- |
| runner 触发（非悬空文件） | `vitest.config.ts` include `packages/*/test/**/*.test.ts` 自动收集；包 tsconfig 覆盖 typecheck；日志含文件行 | ✅ |
| 零 skip/only/todo | 三新测试文件 grep = 0 | ✅ |
| 零源码字符串断言 | 两 ALLOW 测试文件 grep（readFileSync/源文件名引用）= 0；C0c/C0d 结构判据以**行为证明 + 运行时导出面断言**交付（结构测试 :616-619） | ✅ |
| 断言强度只增不弱 | M1 新增**到达点断言**（效应在 `resolve()` 前上 wire——镜像 I13a）；M1-revoke 资源断言从「零调用」扩为「恰一次 transient + lease 恰一次释放」并**先在 HEAD（stash）采集基线 25/25 绿**（钉 HEAD 真值，非为拆分形态定制）；C0b 新增 reject 响亮臂 | ✅ 增强 |
| 既有面不改而绿 | 既有 73 测试文件零修改；包全量 75/75-569/569（两锚 12/12、5/5 在內）；根 439/439-5299/5299 `Type Errors no errors` | ✅ |
| 临时诊断清理 | SA7 两探针文件已删（`zz-` 前缀文件现存 0）；`SA7-DATAFLOW` 残留 grep = 0；删除后复跑 68/68 一致 | ✅ |
| 验证门（AC5） | 包/protocol/根 typecheck 三 EXIT=0；根 `pnpm test` EXIT=0（日志 tail 复核） | ✅ |

## 9. Findings 与非阻断观察

**BLOCKER：无。MAJOR：无。**

| # | 严重度 | 事项 | 证据 | 处置建议（非本票阻断） |
| --- | --- | --- | --- | --- |
| M-1 | MINOR（继承 SA4 O1 / SA7 F-1，动态已复证） | 类型违约授权器（返回/结算 `undefined`/`null`，违反 `Promise<NamespaceAuthorization>` 契约）时，`beginAdmission` fulfillment 回调读 `.ok` 抛 TypeError → admission 永不结算 + 进程级 unhandledRejection；HEAD 同输入得 `INTERNAL_ERROR` + failed。仅类型违约宿主可达、零既有测试面；该处注释对 `Promise.resolve` 包裹效果的表述亦失准（plain-object 非法返回是按值结算 = HEAD 宽容语义，正确；undefined/null 落到「永不结算」而非 throw 结局） | `hub-edge.ts:345-356`；SA4 §12-O1；SA7 §6/§8 V2 探针 | 后续小改：fulfillment 回调体内 try/catch 兜底 `settle({outcome:'throw'})` 并修正注释（SA4 已路由 implementation 后续票） |
| M-2 | MINOR（文档性） | `settleAfterClose` 的 `await Promise.resolve()` 丢失了 HEAD 的解释注释（「锁住 reauth→hub.close 同 tick 的结算竞态」）——行为逐行一致，但该微妙并发惯用法缺注释易被未来维护者「简化」掉 | `hub-edge.ts:309-312` vs HEAD `hub-connection.ts`（git show 比对） | 后续票顺手补回一行注释 |
| M-3 | MINOR（排版，继承 SA4 O4） | `hub-session.ts:50` 构造器签名与解构语句同行，与仓库排版惯例不符 | `hub-session.ts:50` | 后续票顺手整理 |
| M-4 | 透明记录（非违规，继承 SA4 O3） | `hub-namespace.ts` mtime 落在 SA3 会话窗口内但内容与 HEAD 逐字节相同（git blob 比对空）——AC3 门禁为内容命题，判定**通过** | `git diff --stat HEAD -- hub-namespace.ts` 为空（本轮复核） | 无需处置 |

## 10. Verdict

**`approve`**。

1. **规约面**：根/模块 AGENTS 各条款逐条符合——注入 seam、bounded admission（窗口零缓冲 + 台账 ≤ 通道数）、§21 停机拓扑、公共面经 `index.ts` 的条款以「零新公共 API + 内部模块先例」方式正确满足；验证门（聚焦 + 包/根 typecheck + 根 test）真实执行且全绿。
2. **决策面**：ADR 0032 决策 1~5 逐项落地；新增缝面成员 `openAdmission` 经设计诚实登记 + SA8 两阶段复查（均 clear）正规门禁，未静默扩缝；决策/规范文本零 diff，表述差按 R7'' 登记存续，无静默矛盾。
3. **结构面**：模块责任与 D2 总账逐行对上；单一事实源（channels Map / emitOne / 单次 authorize / 单触发 drain）全部成立且无平行机制；生命周期五路对称、迟归结算传播与 H1 回收路径保全。
4. **范围与测试面**：ALLOW 零越界、DENY 零 diff（git 逐项核验）；测试断言仅增强（到达点断言、reject 臂、revoke 对 HEAD 基线重定基），零 skip/only/todo、零源码字符串断言、runner 自动收集。
5. 4 条 MINOR 观察（§9）均非阻断，路由已定（后续票）。

`requiresConflictRecheck: false`——SA8 设计后复查与实现后复查已对本变更集闭合（均 clear），本轮标准复核未发现新的 ADR/协议/规约冲突面。

## 附：artifactPaths（worktree-relative）

- `wiki/raw/task_issue-418_sa9_standards.md`（本报告）
