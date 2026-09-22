# 冲突门禁报告 — Issue #424 实现复审（SA3 test-only 交付 × ADR/协议/架构 + SD-1~SD-4 已实现边界）

## 1. Reviewed subject: implementation

- 被审对象：SA3 迭代 1 交付的 **test-only 实现**（`wiki/raw/task_issue-424_sa3_impl.md` 报告 + 实际 diff）：
  - `packages/ws-replication/test/issue424-sharded-hub.ts`（841 行夹具，全读）
  - `packages/ws-replication/test/ws-replication-issue424-auth-parity.test.ts`（257 行，7 用例）
  - `packages/ws-replication/test/ws-replication-issue424-cross-seam-round.test.ts`（212 行，5 用例）
  - `packages/ws-replication/test/ws-replication-issue424-multi-worker.test.ts`（215 行，4 用例）
  - `packages/ws-replication/test/ws-replication-issue424-lifecycle.test.ts`（340 行，9 用例）
  - `artifacts/issue424-{gate-full-suite,gate-typecheck,gate-scope,focused-determinism}.log`（证据，只读）
- dispatch 指定面：**SD-1~SD-4 已实现边界条件**逐项核对；ADR/规范协议/架构冲突裁决。本报告只反映当前交付物结论。
- Issue 评论 REST 快照为空（`[]`，dispatch 明示）——无 Owner override 可映射、无被忽略的 Owner 要求（与前置门禁 §4、设计复审 §4、SA2 §4、SA3 §Inputs 四方一致）。
- 本报告不评价测试充分性/断言强度（SA2/SA4 域）、不重跑测试（SA4/SA7 域）；只裁决实现与既有决策集的冲突等级。SA4/SA9 评审产物尚不存在（本门禁为设计复审 §10-1 登记的实现交付核对义务的先行闭合，输入面为设计 + SA2 + SA3 + 实际 diff）。

## 2. Inputs and decision set

- 冲突基准（全读，与前两轮同一集合，亲验未漂移）：
  - `docs/adr/` 全集 31 文件（0001–0030 + 0032，无 0031；除 0015 提议外全部 accepted；复制域无 superseded）。母法 **ADR 0032 全文亲验**：决策 1–5（L14/L18/L22/L26/L30）、附录 A1（L38–41）/A2-β（L47–49）/A3（L53）、否决备选（L57–60）、后果冻结（L64–67）、#423 观测注记（L68）。
  - `docs/protocols/instance-replication-v1.md` 条款亲验：§3（sequence 从 1 严格递增）、§5（`0x42` 仅协商后）、§6.1（`CAP_CHUNKED_UPDATE=0x00000001`）、§6.3（drain 提前完成/deadline 1001/REAUTH 窗口静默丢弃）、§7.1（OPEN 矩阵）、§12（CLOSE_OK.ackedSequence）、§13.1（INTERNAL_ERROR→1011）、§13.2（REOPEN→closed / UNAUTHORIZED→failed / STATE_VIOLATION→failed / ns INTERNAL_ERROR→failed）、§14（close code 分类）、§17（分片 per-session 计数口径为文档化差异）、§21（drain 硬 deadline）、§22（三层确定性断言 + 分块资产锚 #243/#246/#300/#301）、§23.1（发射侧归属表 + 未授权 OPEN 无 `channel-state-changed` 为文档化差异）。
  - `CONTEXT.md` 复制域亲验：复制 Edge（L225–227，含 Avoid「在宿主缝外自建连接级准入管线」「宿主自实现连接级协议 = fork」）、SessionHost（L229–231，含 Avoid「session 侧重检入站 sequence」「引入 worker_threads/MessagePort 类型」「两服务入口并存」）、路由键契约（L233–235）。
  - `packages/ws-replication/AGENTS.md`（模块收录决策）+ 根 `AGENTS.md`「Instance replication」节。
- 源码辅助核验（事实确认，不构成独立基准；本轮逐点亲验）：
  - `hub-edge-host.ts`：文件头注（双入口/OPEN 准入管线归属/出站盖章）、`HubNamespaceSessionSink` 四成员与 resolver 三分返回（含「同步 throw 与异步拒绝同归解析失败」）、`settleAdmission`（denied→`NAMESPACE_UNAUTHORIZED`、throw→`INTERNAL_ERROR`、仅 authorized→`runResolveInner`）、`runResolveInner`（解析失败 → `connectionFatal('INTERNAL_ERROR', 1011)`，注释「无静默 fallback」）、no-sink 重 OPEN 的同步 `runResolve` 调用、connectionCounter/`${instanceId}-conn-${n}` 键生成——**SA3 SD-2(b)/SD-3/N7 依赖的全部生产事实属实**。
  - `hub-session-host.ts`：`HubSessionHostConfig` 要求**resolved 全量形** limits/timeouts；`HubSessionOpenInput` 描述子纯 JSON（`authorization` 只接受 ok-投影 = A2-β）；重复 `(connectionKey, namespaceId)` 响亮 throw。
  - `types.ts:1008-1012`：`ResolvedLimits` 空扩展；**`ResolvedTimeouts` 把 ping/pong/assembly 三字段重声明为必填**；`defaults.ts:40` `DEFAULT_REPLICATION_TIMEOUTS: Readonly<ReplicationTimeouts>`——**D5 的事实主张亲验属实**（常量值满足形状、声明类型不满足）。
  - `index.ts:22-26` DEFAULT 两常量公共导出；`hub-connection.ts:140` 单体 close `1001,'hub-shutdown'`（facade 镜像语义属实）。
- 基线亲验：HEAD `cab3e8c245ef189da1d823719370a68459939316`；`git diff --stat` **空**（零 tracked 文件改动）；`git status --short` 仅 21 个 untracked 文件 = 5 个 test-only 新文件 + 4 份 SA3 门禁日志 + 4 份 SA6 保留日志 + 8 个 wiki 流水线产物。**DENY 面（src/协议包/registry 包/apps/domains/docs/配置/既有 455 测试）零 diff 零触碰，亲验成立**（SA3 GATE-C3 段 1/2/3/5 与本人独立核验一致）。
- 纪律扫描（本人独立执行）：新 5 文件零 `.skip/.only/.todo`、零 `process.env`、零 `worker_threads/MessageChannel/require`；唯一 `setTimeout` 命中 = `makeAccountingTimer` 的**注入式假 timer 成员实现**（只记账永不触发——模块 AGENTS「Use injected … seams」的正确兑现，非真实 timer）；import 面 = 包公共入口 ×3 + `./harness.js`/`./driver.js`/`./issue424-sharded-hub.js` + `vitest` + `yjs`，**零深路径生产模块 import**。
- 上游链：SA6 契约（approve）→ SA8 前置门禁（clear，SD-1~SD-4 边界划定）→ SA1 迭代 1 → SA2 评审（**approve**，F-R1 关闭，`requiresConflictRecheck=false`）→ SA8 设计复审（clear，§8-1~§8-5 交付义务登记）→ SA3 实现（本报告对象）。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（实际实现行为） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0032 决策 1：协议状态机单份，只允许分布式实例化；宿主自写连接级半边 = fork，否决 | `0032` L14、L57-60 | 夹具只装配公共工厂真身：`createHubReplicationEdge`（ingress）/`createHubSessionHost`（worker，×真 Registry/Runtime via testing seam）/`createHubReplication`（单体对照）/真 peer（`boot`→`createPeerReplication`）；桥（`makeShardedHost` resolveSessionSink 闭包）只做查表→路由→`open()`→四成员 sink 投影与信号搬运，**零应答合成、零错误码选择、零缓冲/重排/重试、零准入管线复制、零 drain 感知**（代码逐行核验；唯一 throw = 登记缺失响亮，非协议决策） | **implements-existing-decision** | L14「协议状态机保持单份实现，只允许分布式实例化」——验收套件正是该义务的证据化；`route()` 是宿主侧 ns→worker 分派（ADR 背景明示宿主职责），非 edge wire 路由的复制 | 无 |
| 2 | ADR 0032 决策 2：缝只过字节与纯 JSON；入站序 edge 校验；出站 `sequence=0` 占位 + mux 重写 `[8..12]`；零 worker_threads 依赖/类型 | `0032` L18 | 入站 `openNamespace`→`encodeMessage(message,{sequence:0})`（OPEN 不带 wire 序——与生产头注「OPEN 投递不携带 wire 序」逐字一致）、`namespaceFrame`→`{sequence}` 重组；出站原样透传占位帧给 `egress.sendControlFrame/sendDataFrame`；断言读 `[8..12]` 原字节（`rawSequence`）；全进程内内存管道（`queueMicrotask` 投递）；扫描零 worker_threads/MessageChannel | **implements-existing-decision** | L18 逐点对应；协议 §3；CONTEXT.md SessionHost Avoid「引入 worker_threads/MessagePort 类型」未被触碰 | 无 |
| 3 | ADR 0032 决策 3 + A2-β：authorize 在 edge 单点；未授权 OPEN 不过缝（denied/throw 由 edge 处置）；OPEN 准入管线全为 edge 规范职责 | `0032` L22/L47-48；CONTEXT.md L226/L230 | 夹具 authorize 包装只记录后委托（真实调用单点仍经 `createHubReplicationEdge` 配置注入，非夹具自发调用）；AUTH-C2/C3 断言分片侧 `sessions=0 ∧ opens=0 ∧ resolves=0`（denied/throw 零过缝）、AUTH-C4 闩锁重 OPEN 恰一帧 `NAMESPACE_REOPEN_REQUIRES_RECONNECT` 且 authorize 恰一次（两形态）；`HubSessionOpenInput.authorization` 只收 ok-投影（类型面由生产锁定） | **implements-existing-decision** | 源码 `settleAdmission` 亲验：denied→finishTerminal(UNAUTHORIZED)、throw→finishTerminal(INTERNAL_ERROR)、仅 authorized→runResolveInner；测试骨架断言 `HELLO_ACK#1 ERROR(NAMESPACE_UNAUTHORIZED)#2 ERROR(NAMESPACE_REOPEN_REQUIRES_RECONNECT)#3` 与协议 §13.2 终局表吻合 | 无 |
| 4 | 协议 §7.1 OPEN 矩阵 | L176 | NC2：pass 形态重 OPEN → `OPEN_OK×2`（每请求收答，合流不重复）；AUTH-C4：闩锁期恰一帧拒答、authorize 恰一次 | **implements-existing-decision** | L176「重复 OPEN 合流……每个请求都收到 OPEN_OK 或 ERROR」原文对应；ADR 决策 3 自文「重 OPEN 经 openWaiters 合流不重复 authorize」 | 无 |
| 5 | ADR 0032 决策 4 + CONTEXT.md 路由键契约：定偏移路由；合法无 sink → 合成 `NAMESPACE_STATE_VIOLATION`；违例 fatal | `0032` L26；CONTEXT.md L233-235 | SHARD-C3/NC1：从未 OPEN 的第三 ns CLOSE 帧 → 观察**生产合成**的 `ERROR(NAMESPACE_STATE_VIOLATION)`、连接存活、零会话、不落任一 worker、双形态逐字节等；夹具零路由偏移实现（路由由公共 edge 内部完成） | **implements-existing-decision** | L26 逐句对应；断言只观察 wire 与存活态 | 无 |
| 6 | ADR 0032 决策 5 + A1：缝词汇公共载体（close/terminateUnauthorized/settled/connection-fatal）；`onFrame` 同步回传被分配 wire 序（0=被拒）；code→WS 映射单点留 edge | `0032` L30/L38-41 | 投影表逐成员实现：`onFrame`→`sendControlFrame/sendDataFrame` 按 lane 分派并**原样回传返回值**（`sinkReturns` 探针只记录不改写）；`onSignal`：`settled`→`namespaceSettled(ns)`、`connection-fatal`→`connectionFatal(code)`（映射留 edge）；`terminateUnauthorized`/`onConnectionClosed`→句柄幂等成员 + 计数探针包裹（返回值零改写） | **implements-existing-decision** | 源码 `hub-edge-host.ts` 缝接口与 A1 载体逐行吻合；reject 归一由生产适配器承担（头注冻结条款），夹具未复制 | 无 |
| 7 | 协议 §3 序纪律 | L57（`sequence` uint32 BE 从 1 严格递增） | SEQ-C1：出站 `[8..12]` BE = `1..N` 严格递增（断言 `sequences === [1..N]`，无跳/重/回退）；每 ns 首帧序 = OPEN 注入序；**同工厂第二连接首帧序 = 1**（per-connection 重起算，同 `ShardedHost` 双 pipe 构图 = 设计 N4 加严形态）；首连接序列不受第二连接影响 | **implements-existing-decision** | L57 + ADR 0010 L147 同款；rawSequence 读原字节非解码值 | 无 |
| 8 | 协议 §13.1/§13.2/§14 错误注册表 + WS close code | §13.1 L415（INTERNAL_ERROR→1011）、§13.2（L424/L425/L430/L442）、§14 | AUTH-C2 `UNAUTHORIZED→failed` + 闩锁 `REOPEN→closed`；AUTH-C3 namespace 域 `INTERNAL_ERROR` 非连接 fatal（断言 `state≠closed ∧ hubClose undefined`）；SD-2(b) 连接级 `INTERNAL_ERROR` → `close(1011,'protocol-error')`（断言 `{code:1011, reason:'protocol-error'}`）；全部只观察既有码，零新码零改码 | **implements-existing-decision** | §13/§14 注册表逐行吻合；REVOKE-C1 revoke 末帧 `UNAUTHORIZED` 与单体逐字节等 | 无 |
| 9 | 协议 §6.3/§21 + ADR 0010 L179/L684：GOAWAY drain | §6.3 L159、§21 L684 | REAUTH-C1：`beginReauth()` → GOAWAY 恰一帧（`reasonCode=REAUTH_REQUIRED ∧ drainTimeoutMs>0`）→ drain 窗口内 CLOSE_NAMESPACE → `settled` 恰一次 → **提前完成** `close(1001)`（判据 = 注入 timer `fires()===0`，零 deadline 推进）；REAUTH-C2 阴性对照：不发起 reauth 则不关闭 | **implements-existing-decision** | L159/L684「全部 channel 终态时提前完成 drain；否则 deadline 到达以 1001 关闭」逐句兑现；`settled` 经缝转发断言在位 | 无 |
| 10 | 协议 §12：CLOSE_OK.ackedSequence 回指 | §12 CLOSE_OK 字段行（L375，经设计复审 §8-2 修正锚位） | ROUND-C3：`CLOSE_NAMESPACE×1 → CLOSE_OK×1`，断言 `ackedSequence === CLOSE_NAMESPACE.sequence`；REAUTH-C1 同构断言 CLOSE_OK 在场 | **implements-existing-decision** | 字段行「ackedSequence \| varUint \| CLOSE_NAMESPACE sequence」亲验 | 无 |
| 11 | 协议 §22 互通矩阵三层确定性纪律 | L701（「跨会话字节/长度全等因 Yjs 随机 doc client id 不适用」） | 判据助手按**枚举白名单**实现：L1 `{HELLO_ACK,OPEN_OK,ERROR,CLOSE_OK,GOAWAY}` hex 逐帧全等；L2 `{BOOTSTRAP_SNAPSHOT,UPDATE,UPDATE_CHUNK,SYNC_STEP2}` 按 `Y.applyUpdate` 后 ROOT/META JSON 语义等值（`docStateOf`，零字节断言）；L3 全轨迹 `kind(code)#seq` 骨架；AUTH-C5(a) 负控把「数据帧字节不可全等」冻结为语料属性（单体 vs 单体全轨迹必不等）；**硬门定义原文写入 auth-parity 头注**（设计复审 §8-3 义务兑现） | **implements-existing-decision** | L701 三层断言纪律 + 前置门禁 §8-2「不得放宽或加严」——白名单划分与 SA6 §12.1/设计 §7.2 完全一致，零漂移 | 无 |
| 12 | 协议 §23.1 观测形态差异 + H8 | L838-846（发射侧归属表 + 未授权 OPEN 无 `channel-state-changed` 为文档化差异） | 全部 25 用例零 observer 事件断言入 parity；观察面 = wire 原字节/序/会话计数/描述子 JSON/文档语义/信号探针（信号探针是缝上信号，非 observer 事件型） | **implements-existing-decision** | L844 文档化差异条款；ADR 决策 5/A3；前置门禁 §8-2 禁令被遵守 | 无 |
| 13 | 协议 §17 分片计数口径 | L582（listen per-connection / 分片 per-session，已登记差异） | 套件不对 assembly 计数口径作任何断言（口径差不入 parity） | **no-conflict** | L582 条款为文档化差异登记；测试面不触碰 | 无 |
| 14 | 协议 §5/§6.1 + **SD-4 已实现边界**：协商形态最小读法（回合完整 + 协商位可见；NC4/ROUND-C4 协商位断言不得删） | §5 L114（0x42 仅协商后）、§6.1 L137（`CAP_CHUNKED_UPDATE=0x00000001`）；前置门禁 §3 SD-4 行 | NC4：协商形态 parity 成立 + `HELLO_ACK.selectedCapabilities & CAP_CHUNKED_UPDATE ≠ 0` + **描述子 `opens[0].selectedCapabilities` 携带该位**（断言在位未删）；ROUND-C4：协商形态（`chunkedUpdate:true`）全回合复跑 C1~C3 + 双协商位断言；未做深读法（超限分块端到端）——与设计 §7.5 择一裁决一致，理由（资产锚 #243/#246/#300/#301 已承载）已在设计记录 | **implements-existing-decision** | 前置门禁「两读法均不违约，择一并记录；协商位断言不得删」——择最小读法且断言显式在位；`selectedCapabilities` 唯一事实源 = `connection.egress.chunkedUpdateNegotiated()`（edge 协商位），描述子纯 JSON | 无 |
| 15 | **SD-1 已实现边界**：套件暴露真实生产偏差 → 停手报 SA8/设计，不就地修生产 | 前置门禁 §3 SD-1 行、§6-1、§8-3；设计 §7.1 | **未触发**：全量同轮 459 文件/5584 测试绿（SA3 GATE-C1 日志 exit 0），零偏差现场、零 `artifacts/issue424-deviation-*.log`；实现零生产改动（git diff 空）；断言未因任何红灯被软化/删改（负控 AUTH-C5/NC1-NC4/REAUTH-C2/TERM-C3/SD-2(b)/ROUND 前提断言全部在位）；**前置甄别已实现**：ROUND 每形态 boot 后先跑 `worker.registry === run.hubNode.registry` 引用同一性前提断言（错误信息指向装配而非生产） | **no-conflict** | 「停手报 SA8」为前置门禁认可立场；未触发 = 无需停手；若未来触发，修复票按 §6-1 分类重过门禁（条件性边界未激活） | 无 |
| 16 | **SD-2(a) 已实现边界**：单点登记权威 + 微任务深度论证（不建第二准入管线） | 前置门禁 §3 SD-2 行 (a)（no-conflict 分支）；设计 §7.3 | `ShardedHost.accept/acceptTrusted` = 唯一登记写点（`register()` 在 await 返回后第一动作写入 `connections`）；resolver 只查表、取不到即**同步 throw**（生产侧同归解析失败响亮收口）；零 resolver 侧等待/缓冲/重试；`facade.accept` 与 pipe 形态共享同一登记实现（D1——避免第二写点）；no-sink 重 OPEN 0 跳细分登记于夹具头注第 2 条 | **no-conflict** | 装配纪律留 harness 侧（前置门禁边界）；登记表是宿主侧 egress 路由事实，非连接级准入管线（CONTEXT.md L226 Avoid 项不被触碰——authorize/准入台账/OPEN 管线全部仍在公共 edge 内） | 无 |
| 17 | **SD-2(b) 已实现边界**：响亮收口冻结为退化路径（限测试文档层，不入 docs/**） | 前置门禁 §3 SD-2 行 (b)（implements 分支，「限测试文档冻结」）；CONTEXT.md L226「sink 解析失败响亮连接收口」= Edge 规范职责；协议 §13.1 L415 + §14 | lifecycle `SD-2(b) degenerate` 负控：故意经 `host.factory.acceptTrusted` 直连（绕过登记）→ 断言 `HELLO_ACK×1` + 连接级 `ERROR(INTERNAL_ERROR)`（namespaceId 缺席）×1 + `close(1011,'protocol-error')` + 零会话；夹具头注第 3 条登记退化路径分界；**未写入 `docs/**`**（docs 零 diff 亲验）——该负控方向与决策 3 一致（防未来把该路径「修」成静默 fallback） | **implements-existing-decision** | 生产 `runResolveInner` 亲验：`Promise.resolve` 包裹 + catch → `connectionFatal('INTERNAL_ERROR', 1011)`——断言的是**既有生产行为**（零 diff 生产代码产出），测试只镜像观察；边界「限测试文档」被遵守 | 无 |
| 18 | **SD-3 已实现边界**：每场景一工厂 + instanceId 钉死（处置留 harness 侧；生产侧改键/加工厂选项须新票） | 前置门禁 §3 SD-3 行；ADR 0032 A2-β L48 + 后果 L66 | `makeShardedHost`/`makeShardedReplicationFacade` 各内部构造恰一个 edge 工厂、`instanceId` 钉死 `HUB_INSTANCE`（两形态语料同源前提）；每条轨迹/每场景各自建 worker+工厂（D6——防 `(connectionKey,namespaceId)` 跨轨迹撞键，撞键守卫 = 生产 `open()` 响亮 throw 亲验）；SEQ-C1/TERM-C3 同场景第二连接复用同工厂（键后缀互异断言在位）；**零生产键格式改动、零工厂选项新增**（src 零 diff） | **no-conflict** | 全部处置留 harness 侧；A2-β 唯一性作用域 (连接, namespace) 不被触碰；「写入宿主指引文档」未发生（docs 零 diff）——前置门禁边界逐项落界 | 无 |
| 19 | ADR 0032 后果 L64-66：公共面（edge/session 工厂与服务签名）发布即冻结，演进 append-only；DENY 面（SA6 §12.0） | `0032` L64-66；前置门禁 §5；设计 §11 | `git diff --stat` 空 + `git status` 仅 untracked 新文件（本人独立核验）：`packages/ws-replication/src/**`、协议包、registry 包（含 testing seam）、`apps/**`、`domains/**`、`docs/**`、`vitest.config.ts`、`tsconfig*.json`、package.json、既有 455 测试文件（含 harness/driver/issue420 夹具）**全部零改动**；夹具只**消费**公共面（三工厂 + DEFAULT 两常量 + 类型导入），零新公共导出 | **no-conflict** | 冻结被遵守而非触碰；GATE-C3 双段证据 + 本人独立 git 核验三方一致 | 无 |
| 20 | 模块 AGENTS 测试纪律（注入 seam、真实入口、无 skip/only、验证门） | `packages/ws-replication/AGENTS.md`；SA6 §12.0/§12.7 | 注入面：假 timer（`makeAccountingTimer` 只记账零触发）、seeded randomBytes（仅 128-bit 请求，同 seed 同 ns 身份）、registry 测试 scheduler、`StubPersistence`；时间全虚拟（pipe 形态 `ShardedWorker.scheduler.advanceBy`、boot 形态 `run.hubNode.scheduler.pending()`、`advanceMs` 只推 peer 侧——N5 精确落实）；扫描零 skip/only/todo/env（本人独立扫描命中 0）；门禁证据落 `artifacts/issue424-*.log`（GATE-C1 全量 exit 0 / GATE-C2 typecheck exit 0 / GATE-C3 空 diff） | **implements-existing-decision** | 模块 AGENTS 逐句对应；「Use injected transport, scheduler, randomness, and optional observer/clock seams」兑现 | 无 |
| 21 | **D5 偏差**：`DEFAULT_REPLICATION_TIMEOUTS as SessionHostTimeouts` 类型收窄 | 根 AGENTS「writes 禁 scatter any/casts through **business code**」；SA8 设计复审 §8-1（预授权「`resolveTimeouts(undefined)` **或显式类型断言**」两路之一） | 对**同一冻结常量对象**的一次显式类型收窄（`SessionHostTimeouts` = session host 工厂参数面的结构类型），零取值分叉、零 fallback 复制、零生产改动；test-only 夹具代码非业务代码；头注第 6 条登记理由（`ResolvedTimeouts` 三字段必填 vs 常量声明可选的**源码事实**，本人亲验 `types.ts:1008-1012`/`defaults.ts:40` 属实） | **no-conflict** | 两半边同值纪律不受影响（edge 侧不传 = 工厂内 resolve 同组 DEFAULT 值）；SA8 设计复审 §8-1 预授权路径之内；若未来要放宽常量公共声明类型 = 公共面 append-only 演进新票（SA3 已登记 follow-up） | 无（新票触发时重过门禁） |
| 22 | **D1-D4/D6 偏差** × 决策集 | SA6 §12.0 test-only 边界；设计 §8.1/§8.2/§7.4 | D1（`ShardedHost` 增补 `accept`：facade 拨号路径与 pipe 共享同一登记权威——**避免第二登记写点**，与决策 3 职责归属同向）；D2/D3（探针面增 `authorizeCalls`/`handles`、`Trace` 增 `resolves`/`handles`：纯观察面，契约条目承重）；D4（`makeAccountingTimer`：注入假 timer 纪律的具名化）；D6（每轨迹各建 worker：SD-3 键空间不交叉纪律的落实）——全部落在 ALLOW 的 test-only 文件内，零 wire/状态机/公共面影响 | **no-conflict** | 逐项与设计文本/SD 裁决对照：D1 是 §8.3.2-2「代码路径完全共享」的必要落实；D6 是 §7.4 明文约定；无一软化契约条目 | 无 |

### SD-1~SD-4 已实现边界 × 前置/设计门禁 adjudication 核对（dispatch 指定面）

| SD | 已实现形态 | 前置门禁允许边界 | 设计裁决 | 落点核对 |
|---|---|---|---|---|
| SD-1 | 未触发（全绿、零偏差现场、零生产改动）；前置甄别断言在位（ROUND 前提） | 「停手报 SA8」认可；触发时修复票按 §6-1 分类重过门禁 | §7.1 停手协议 + 前置甄别 | **边界内**（未采「就地修」；断言零软化） |
| SD-2(a) | 单点登记权威；resolver 取不到即抛；零第二管线 | (a) no-conflict（harness 装配纪律） | §7.3(a) | **边界内** |
| SD-2(b) | 退化负控 + 夹具头注冻结；零 docs/** 写入 | (b) implements-existing-decision，**限测试文档冻结** | §7.3(b) | **边界内**（断言的是零 diff 生产行为；未把退化路径当正常路径） |
| SD-3 | 每场景/轨迹一工厂 + 钉死 `HUB_INSTANCE` + D6；零生产键/选项改动 | 处置留 harness 侧；生产侧 = 新票 | §7.4 | **边界内** |
| SD-4 | 最小读法：协商形态全回合复跑 + 双协商位断言（未删）+ 描述子位 | 两读法均不违约；择一记录；**协商位断言不得删** | §7.5 | **边界内**（NC4/ROUND-C4 断言在位亲验） |

裁决分布：**no-conflict 7 项（#13/#15/#16/#18/#19/#21/#22）、implements-existing-decision 15 项（#1–#12/#14/#17/#20）、evolution-required 0、hard-conflict 0、override 0**。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| — | — | — | — |

无 override 需求：Issue 评论快照为空（`[]`）——无 Owner 评论可作覆盖权威；实现零决策文本修订、零公共面变更、零 wire/协议语义变化；D1–D6 偏差全部为 test-only 装配/观察面裁量，在前置门禁与设计复审已划定的边界内。

## 5. Frozen surfaces

（implementation 复审：逐项对照实际 diff——本人独立 git 核验：tracked diff 为空、status 仅 ALLOW 面 untracked 新文件）

| Surface | Must remain unchanged | Evidence | Actual result（实际 diff 核验） |
|---|---|---|---|
| Wire envelope + sequence | 20 字节固定头；`[8..12]` uint32 BE 从 1 严格递增 | 协议 §3 | **零改动**；套件只读原字节（`rawSequence`/hex 断言） |
| 消息注册表 / HELLO 协商 | 消息码 append-only；`0x42` 仅协商后；`CAP_CHUNKED_UPDATE=0x00000001` | 协议 §5、§6.1 | **零改动**；只观察协商位（NC4/ROUND-C4） |
| 错误注册表 + WS close code | §13.1/§13.2 全码表 + §14 分类 append-only | 协议 §13/§14 | **零改动**；断言既有码/收口号（AUTH/REVOKE/SD-2(b)） |
| GOAWAY/drain 语义 | drain 提前完成 / deadline 1001；REAUTH 窗口 OPEN 静默丢弃 | 协议 §6.3/§21 | **零改动**；REAUTH-C1/C2 只观察 |
| ADR 0032 决策 1-5 + A1-A3 | 缝词汇、三载体、dormant 降级、发射侧归属 | `0032` 全文 | **零修订**（docs 零 diff）；harness 装配兑现（§3 行 1/2/5/6） |
| 公共工厂面（#420/#421/#422 冻结） | `createHubSessionHost`/`createHubReplicationEdge`/`createHubReplicationPlugin({listen:false})` 签名冻结、append-only | `0032` L64-66 | **零 diff**（`src/index.ts` 未触碰）；夹具纯消费 |
| `boot({createHub})` 注入缝 | 既有注入契约与 hub 侧观察面绑定 | `driver.ts`（未改动） | **零改动**；按既有契约消费（registry/timer 结构性采纳 = facade 内部装配，非缝变更） |
| Observer 36 型词表 + 发射侧归属 | append-only；形态差异为文档化差异 | 协议 §23.1 | **零改动**；observer 不入 parity（H8 遵守） |
| 路由键布局 / assembly 口径 | 定偏移事实集 + 守卫测试；listen/分片双口径 | CONTEXT.md L233-235；协议 §17 L582 | **零改动**；口径不入断言 |
| 生产源码 / 规范文档 / 既有测试 | `packages/ws-replication/src/**`、协议包、registry 包、`apps/**`、`domains/**`、`docs/**`、配置、既有 455 测试零 diff | SA6 §12.0；GATE-C3 | **空 diff / 空 status 亲验成立**（SA3 日志 + 本人对 `git diff --stat`/`git status` 独立核验一致） |
| SD-2 退化路径语义 | 「sink 解析失败响亮连接收口」不可被修成静默 fallback | `0032` L22；CONTEXT.md L226 | 生产零改动；负控**加固**该冻结面（方向与决策一致） |
| SD-6 探针/红臂保留件 | `task_issue-424_sa6_*` + `artifacts/sa6-issue424-*` 不覆写 | 设计 §11 DENY | **保留在位未覆写**（git status 与设计阶段同集） |

## 6. Evolution requirements

**无 evolution-required 项**：实现零 ADR/CONTEXT/协议修订、零公共面变更、零 wire/schema/持久化/状态机变更（test-only + 零 tracked diff）；D1–D6 偏差全部在既有决策与两级门禁 adjudication 边界内；D5 走设计复审 §8-1 预授权的「显式类型断言」路径。

条件性边界登记（继承前置 §6/设计复审 §6；**本轮全部未触发**，触发时为**新票新门禁**，非本对象待办）：

1. SD-1 触发（经前置甄别确认的真实生产偏差）→ 修复票分类重过门禁（实现向 ADR 对齐 = implements-existing-decision；改 wire/协议语义 = evolution-required 同变更集修订）。
2. SD-3 生产侧化（改 connectionKey 键格式 / 加工厂选项）或 `DEFAULT_REPLICATION_TIMEOUTS` 公共声明类型放宽（D5 follow-up）= 公共面 append-only 演进新票。
3. SD-2(b)/SD-3 规范化入 `docs/**` = 扩 ALLOW 新票。
4. γ 真 worker（worker_threads/异步序回传）形态、确定性 clientID 注入、「boot 形态 + 多会话宿主」夹具参数化 = 各自新票（多 host 仍须共享同一被采纳 registry，突破即重过门禁）。

## 7. Hard conflicts

**无**。逐项对照见 §3：22 项对照全部为既有决策的兑现或边界内 test-only 裁量；SD-1~SD-4 已实现形态逐项落在前置门禁与设计复审划定的 adjudication 边界内（核对表零越界项）；硬门三层判据与协议 §22 L701/SA6 §12.1 完全一致且负控在位；DENY 面与全部冻结面零 diff（本人独立 git 核验）；实现引用的生产结构事实（sink 解析失败收口、denied/throw 闩锁、重复开启响亮拒绝、connectionKey 生成、resolved 形必填、resolvedTimeouts 三字段必填）经本轮逐点亲验属实；上游事实（SA6 探针 O1–O10/SA2 评审）与源码无矛盾。

## 8. Required actions

（非阻塞；交接登记）

1. **SA4/SA7 独立验证与 CI 裁决照常进行**：本报告只闭合冲突门禁义务（套件未 fork 状态机、未越 DENY 面、硬门口径未漂移——前置 §10-2/设计复审 §8-4 登记义务本轮已核）；测试充分性/断言强度（如 `AccountingTimer.fires()` 结构性恒 0 的判据强度）属 SA2/SA4 域，不由本门禁裁决。
2. **D5 follow-up 维持登记**：若未来出现放宽 `DEFAULT_REPLICATION_TIMEOUTS` 公共声明类型的生产票，属公共面 append-only 演进，须新票重过 SA8（SA3 已登记；本报告 §6-2 同款）。
3. SD-2(b)/SD-3 规范化、γ 形态、确定性 clientID、多会话宿主夹具扩展 = follow-up 新票（§6 条件性边界），不得在本票内就地发生。

## 9. Verdict

**clear**

- 22 项对照：no-conflict 7 + implements-existing-decision 15；hard-conflict 0、override 0、evolution-required 0。
- **SD-1~SD-4 已实现边界逐项落界**（§3 核对表）：SD-1 未触发且停手协议/前置甄别在位；SD-2(a) 单点登记权威无第二管线；SD-2(b) 退化负控断言零 diff 生产行为且未入 docs/**；SD-3 处置全留 harness 侧；SD-4 最小读法且协商位断言未删。
- 硬门纪律零漂移：L1/L2 白名单与契约/协议逐 kind 一致、数据帧零字节断言、AUTH-C5(a) 负控在位、observer/口径差持续排除；硬门定义原文在 auth-parity 头注（设计复审 §8-3 义务兑现）。
- 设计复审 §8-1（TIMEOUTS resolved 形取得）按预授权路径落实（D5，事实主张亲验属实）；§8-2（wrapHubRegistry 精确事实）已落夹具/套件头注；N1-N7 落实与 SA3 报告陈述一致。
- test-only 边界经本人独立 git 核验成立：tracked diff 为空、新增仅 ALLOW 面文件、DENY 面零触碰、SA6 保留件未覆写。
- 实现可作为 Issue #424 的阶段收官验收证据交付（AC1–AC5 断言面 + AC6 门禁证据在位）；后续 SA4/SA9/SA7 流程不受本门禁结果豁免。

## 10. requiresConflictRecheck

**false**

理由：

1. 全部对照项为 no-conflict 或 implements-existing-decision，无 evolution-required、无正式 override；条件性边界（SD-1 触发、SD-3 生产侧化、SD-2(b) 规范化等）**全部未触发**——未来触发形态是**新票重过门禁**（新审查事件），不是本对象的待核对遗留。
2. 前置门禁 §10-2 / 设计复审 §10-1 登记的实现交付核对义务（套件未 fork 状态机、未越 DENY 面、硬门口径未漂移、负控在位、GATE-C3 证据在位）**已在本轮对实际 diff 逐项闭合**——「实现后复查已闭合」即 false 的构成情形。
3. 实现零公共 API/wire/schema/持久化/状态机/生命周期所有权/失败语义的生产面变更（零 tracked diff），无尚待实现核对的冻结面。
