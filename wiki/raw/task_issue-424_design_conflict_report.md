# 冲突门禁报告 — Issue #424 设计复审（SA1 迭代 1：adopted-registry boot 约束 + SD-1~SD-4）

## 1. Reviewed subject: design（设计后复审，原位更新至迭代 1）

- 被审对象：`wiki/raw/task_issue-424_design.md`（**迭代 1**，642 行全文逐条）——dispatch 指定面：**adopted-registry boot 形态约束（§8.3.1，F-R1 修订核心）与 SD-1~SD-4 四项裁决（§7.1/§7.3/§7.4/§7.5）**，及其在 §6/§8/§11/§12/§14/§15 的落点。本报告只反映迭代 1 当前结论（取代迭代 0 版本；迭代 0 结论已被本轮全量重核，不堆叠）。
- 修订链：SA1 迭代 0 → SA2 攻击评审（verdict=`reject`，1 MAJOR F-R1 + N1–N7）→ **SA1 迭代 1**（逐条落实 F-R1 与 N1–N7，§14 修订映射）→ 本复审（前置门禁 §8-4 / 迭代 0 报告对修订增量的指定复核义务）。
- Issue 评论 REST 快照为空（dispatch 明示 `[]`；任务简报 §Comments 空）——无 Owner override 可映射。
- 上游链：SA6 契约（approve）→ SA8 前置门禁 `task_issue-424_conflict_report.md`（clear、requiresConflictRecheck=true、SD-1~SD-4 边界）→ SA1 迭代 0 → SA2 评审 → SA1 迭代 1 → 本报告。
- 本报告不评价设计优劣/断言充分性（SA2 域），只裁决：修订后设计与既有决策集的冲突等级；adopted-registry 约束是否引入新决策面；SD-1~SD-4 裁决是否仍在门禁 adjudication 内；硬门纪律是否漂移。

## 2. Inputs and decision set

- 冲突基准（全读，与前置门禁同一集合，亲验未漂移）：
  - `docs/adr/` 全集 **31 文件**（0001–0030 + 0032，无 0031）。除 0015 为「提议」外全部 accepted；复制域（0010/0012/0013/0022/0032）无 superseded。母法 = ADR 0032 全文亲验：决策 1–5（L14/L18/L22/L26/L30）、附录 A1（L38–41）/A2-β（L47–49）/A3（L53）、否决备选（L57–60）、后果冻结（L64–67）。
  - 根 `CONTEXT.md` 复制域亲验：复制 Edge L225–227（含 Avoid「在宿主缝外自建连接级准入管线」「宿主自实现连接级协议 = fork」）、SessionHost L229–231（含 Avoid「session 侧重检入站 sequence」「引入 worker_threads/MessagePort 类型」）、路由键契约 L233–235、namespaceId 128-bit CSPRNG L186。
  - `docs/protocols/instance-replication-v1.md` 条款亲验：§3 L57（sequence 从 1 严格递增）、§5 L114（0x42 仅协商后）、§6.1 L137（`CAP_CHUNKED_UPDATE=0x00000001`）、§6.3 L159（drain 提前完成/deadline 1001）、§7.1 L176（OPEN 矩阵）、§12 L370–375（CLOSE_OK.ackedSequence 字段行 = **L375**）、§13.1 L415（INTERNAL_ERROR→1011）、§13.2 L424/L425/L430/L442（REOPEN→closed = L424；UNAUTHORIZED→failed = **L425**；STATE_VIOLATION→failed = L430；ns INTERNAL_ERROR→failed = L442）、§17 L582（分片 per-session 计数口径为已登记差异）、§21 L684（drain 硬 deadline）、§22 L700–703（三层确定性断言 + 分块资产锚 #243/#246/#300/#301 逐条在库）、§23.1 L838–846（发射侧归属表 + 未授权 OPEN 无 `channel-state-changed` 为文档化差异）。
  - `packages/ws-replication/AGENTS.md`（测试纪律 + 验证门）+ 根 `AGENTS.md`「Instance replication」节。
- 源码辅助核验（事实确认，不构成独立基准；本轮针对 F-R1 修订新增面逐点亲验）：
  - **§8.3.1 依据链全部属实**：`driver.ts:409-417`（`writeHub` 经 `hubFixture.lease`）、`driver.ts:419-425`（`doc('hub')`/`snapshotDoc`/`rootValue`/`metaValue` 经 `hubNode.persistence.peek`）、`driver.ts:463-470`（`bumpHubEpoch` 经 fixture lease）、`driver.ts:498-505`（`makeHubNamespace(hubNode,…)`）、`driver.ts:516-526`（`createHub` 注入缝）、`driver.ts:512-521`（wrappedVerifier）、`driver.ts:535`（dial = `hub.accept(wire.hubEnd,{token})`）、`driver.ts:217`（`Run.hubNode` 公有只读）、`driver.ts:618-621`（`advanceMs` 只推进 `peerNode.scheduler`——N5 措辞属实）。精度注记见 §8-2②：L518 实为 `opts.wrapHubRegistry?.(hubNode.registry) ?? hubNode.registry`（存在包装 seam，设计场景未用且被 §12.2 断言前置拦截）。
  - 探针 O8 装配形态属实：`task_issue-424_sa6_capability_probe.mts` L971-1003（createHub 闭包内 `worker = {registry: options.registry, host: makeSessionHost(options.registry, options.timer), …}`，L979-984）+ `makeSessionHost` L359-367（`createHubSessionHost({registry, instanceId: HUB_INSTANCE, limits, timeouts, timer})`）+ `store()` 单点登记权威 L542-553——设计 §8.3 adopt 形态 = 该唯一 green 装配的结构化。
  - 公共面亲验：`hub-edge-host.ts:91-100`（`HubNamespaceSessionSink` 四成员）/`110-114`（resolver 三分返回 + 同步 throw 同归解析失败）/`118-130`（egress 五成员，回传盖章序 0=拒）/`133-149`（连接句柄）/`151-167`（工厂 options，limits/timeouts 为 Partial）/`958-962`（工厂导出，注释明示「每次 accept 分配一个独立内部 edge 实例」）；`hub-session-host.ts:44-52`（**resolved 全量形必填**）/`55-62`（描述子纯 JSON）/`243-253`（重复 `(connectionKey,namespaceId)` 响亮 throw）/`261-263`（工厂）；`hub-edge-host.ts:749`（connectionCounter 初值 0）+ `914-916`（键 = `${instanceId}-conn-${n}`）+ `872-899`（acceptTrusted 单同步段零 await，L882 注释原文）+ `345/396-398`（no-sink 重 OPEN：resolver 调用本身 0 跳同步——实参求值先于 `Promise.resolve` 包裹，结算异步）+ `405-436`（settleAdmission 经 `await openAdmission` 后才 runResolveInner）+ `442-451`（解析失败 → `connectionFatal('INTERNAL_ERROR', 1011)`，注释「无静默 fallback」）；`hub-edge.ts:227-232`（构造尾部同步重放早到帧 ≤16）/`399`（authorize 恒经 `Promise.resolve(...).then`）；`hub-connection.ts:282-299`（单体 revoke/requestReauth 按认证实例身份遍历连接——facade 镜像语义属实）+ `1001,'hub-shutdown'`（单体 close 码——facade `close()` 镜像属实）；`index.ts:22-26`（DEFAULT 两常量公共导出）；`types.ts:161-180`（`HubReplication` 面 = accept/acceptTrusted?/connections/revoke/requestReauth/close——facade 成员表全覆盖）。
  - 基建亲验：`defaults.ts:16-51`（DEFAULT 冻结值含 5 个分块纪元字段；`DEFAULT_REPLICATION_TIMEOUTS` 值含 ping/pong/assembly 三字段）、`types.ts:1009-1012`（`ResolvedLimits` 空扩展；**`ResolvedTimeouts` 非空扩展**——ping/pong/assembly 在 base 为可选、在 Resolved 必填，见 §8-2①）、`test/harness.ts:43-57`（`CONTRACT_LIMITS` 旧形缺 5 个分块字段——「不可赋 ResolvedLimits」属实）、`@nomicore/namespace-registry/testing` 导出 `createNamespaceRegistryForTesting`/`createRegistryTestScheduler`、`vitest.config.ts` include/maxWorkers:1、`packages/ws-replication/tsconfig.json` include `test/**/*.ts`（新夹具入包 typecheck 不入 runner）。
- 基线亲验：HEAD `cab3e8c245ef189da1d823719370a68459939316` 与设计 §0 一致；`git status` 仅 `wiki/raw/task_issue-424*` 与 `artifacts/sa6-issue424-*.log`——设计阶段（含迭代 1）零被审对象外触碰。
- SA2 评审输入已并入：`task_issue-424_sa2_review.md` 全读；其 §13 F-R1 与 §14 N1–N7 与设计 §14 修订映射逐条对照（见 §3 行 6-8 与 §8-1）。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（迭代 1 设计行为） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0032 决策 1：协议状态机单份，只许分布式实例化；宿主自写连接级半边 = fork，否决 | `0032` L14、否决备选 L57 | §7.0/§8.1/§8.2/§8.3.2：harness 只装配公共工厂真身（`createHubReplicationEdge`/`createHubSessionHost`/真 Registry/Runtime/真 peer）；桥只做字节/JSON 中继与信号搬运（§8.2 非目标明列不合成应答/不选错误码/不缓冲重试/不复制准入管线/不感知 drain）；§8.5「全部复用，零新状态机」；**adopt 形态只是装配位置变化（会话宿主建于 boot 传入 registry 之上），被装配对象仍是公共工厂**（§6 行 1 的自我定性经本轮独立核验属实） | **implements-existing-decision** | L14「协议状态机保持单份实现，只允许分布式实例化」；迭代 1 修订未增减任何自写协议行为 | 无 |
| 2 | ADR 0032 决策 2：缝只过字节与纯 JSON；入站序 edge 校验；出站 `sequence=0` 占位 + mux 重写 `[8..12]`；wire 逐字节不变；零 worker_threads 依赖/类型 | `0032` L18 | §7.0 D-A 进程内内存管道（备选 A' 真 worker_threads 显式否决并引 L18）；§8.2 入站 `encodeMessage(message,{seq})` 重组、出站原样透传占位帧并原样回传被分配序（零改写）；§7.2 断言读 `[8..12]` 原字节；§1 非目标「不引入 worker_threads/MessageChannel 依赖或类型」 | **implements-existing-decision** | L18 逐点对应；protocol §3 L57 | 无 |
| 3 | ADR 0032 决策 3 + A2-β：authorize 在 edge 单点；未授权 OPEN 不过缝；OPEN 准入管线（含 sink 失败响亮收口）全为 edge 规范职责 | `0032` L22/L47-48；CONTEXT.md L226/L230 | §8.2/§7.3：harness 不建第二准入管线；SD-2(a) 显式否决 resolver 侧等待/缓冲/重试；AUTH-C2/C3「零 resolveSessionSink 调用 + 分片零会话」直接观察；adopt 形态不绕过 authorize（facade 的 authorize 恒交工厂、经同一 edge 单点） | **implements-existing-decision** | L22/L47-48 原文对应；源码 L405-451 亲验（denied/throw 终态闩锁在 edge 收口；解析失败响亮连接收口） | 无 |
| 4 | ADR 0032 决策 4 + CONTEXT.md 路由键契约：定偏移路由；合法无 sink → 合成 `NAMESPACE_STATE_VIOLATION`；违例 fatal | `0032` L26；CONTEXT.md L233-235 | §12.0 SHARD-C3 只观察合成帧与连接存活；路由由公共 edge 内部完成，harness 零实现 | **implements-existing-decision** | L26 逐句对应；源码 L350-372 亲验（no-sink/无记录两分支合成违例） | 无 |
| 5 | ADR 0032 决策 5 + A1/A3：观测发射点归属、dormant 降级、`onFrame` 同步回传被分配序（0=被拒）、`settled`/`connection-fatal` 载体、code→WS 映射单点留 edge | `0032` L30/L38-41/L53 | §8.2 投影表逐成员映射（OPEN 投递不带 wire 序、回传序零改写、信号二态按 A1 载体）；§7.2 observer 不入 parity | **implements-existing-decision** | 源码 L87-130 亲验逐行吻合；红臂 `no-sequence-return` 佐证回执承重面 | 无 |
| 6 | **adopted-registry boot 形态约束（§8.3.1；F-R1 修订核心）**：boot 形态下 ROUND 会话宿主必须建于 `options.registry`（≡ `run.hubNode.registry`）与 `options.timer` 之上 | 既有事实集：`driver.ts:409-470/498-526`（boot 观察面全绑 boot 节点 + 注入缝）、探针 O8 L971-1003（唯一 green 装配）；决策基准无条款被触碰 | 约束正文 + 依据链四点 + 失败模式分析（错位装配 → ROUND-C1/C2 必红且形似生产偏差）；结构性落实（facade registry 必填 + 无 route 参数，错位不可表达）；可观察兜底（§12.2 引用同一性前提断言）。**约束是对既有 `boot`/`driver` 测试基建事实的承接，不是新协议语义、不是新生命周期所有权**——单体的 Registry 绑定本就存在（`hub-connection.ts` 组合根同款），ADR 0032 对「哪份 Registry 喂 SessionHost」无规定（edge 工厂无 Registry 依赖，SessionHost 工厂必填 registry——§8.3.2 构造序即其正当消费） | **no-conflict** | 依据链 1-4 全部亲验属实（§2 源码核验段）；探针 O8 = 运行期实证；「hub 文档事实源 = boot hubNode.registry」承接而非改写 | 无（行锚精度注记见 §8-2②） |
| 7 | **facade adopt 模式 + 删除路由形态 facade + `AdoptedWorker`/`RoutableWorker`（§8.1 签名变更 1-3、§8.3.2 构造序）** | `0032` L64-66（公共面 append-only，仅约束 `src/index.ts` 出面）；SA6 §12.0 test-only | `ShardedFacadeOptions.registry` 必填；facade 内建恰一个 AdoptedWorker 并路由全部 resolveSessionSink 到它；桥/登记/探针代码路径与 pipe 形态共享（`makeShardedHost(() => worker, config)`）；路由形态 facade 删除（错位装配不可表达）。全部为 **test-only 夹具面收窄**：新面不经 `src/index.ts` 导出、零公共 API/wire/schema/持久化变更；§11 ALLOW/DENY 零范围变化（修订全落既有 ALLOW 文件内，亲验） | **no-conflict** | §11「本轮（F-R1）零范围变化」声明与 ALLOW 表逐行核对属实；`hub-session-host.ts:44-45` 工厂消费 registry 属设计内正当用法 | 无 |
| 8 | **ROUND 装配前提断言（§12.0 新增行 + §7.1 偏差前置甄别）** | 前置门禁 §8-2（硬门纪律不得放宽/加严）；SA6 §12.7（负控原样保留）；SD-1 认可立场（前置门禁 §3 SD-1 行） | 每形态 boot 后断言 `sharded.worker.registry === run.hubNode.registry`（引用同一性）；设计追加断言、不削弱任何契约条目；ROUND 红灯先核装配前提再按 SD-1 分类（防伪偏差误触停手） | **no-conflict** | 断言面向测试装配态（非 wire/非状态机断言），不构成对硬门口径的加严或放宽；SD-1 处置链被精化而非扩大 | 无 |
| 9 | **SD-1 裁决（§7.1，含 F-R1 追加的偏差前置甄别）** | `0032` 后果 L66（公共面 append-only）+ 协议 wire 冻结；前置门禁 §3 SD-1 行、§6-1、§8-3 | 停手协议：保留现场落 `artifacts/issue424-deviation-*.log`、按「实现向 ADR 对齐 = implements-existing-decision（新修复票）/ 改 wire 语义 = evolution-required（同变更集修订+重过门禁）」分类上报；否决「就地修生产」；前置甄别（§8 行 8）只防止伪偏差上报，不改变分类学 | **no-conflict** | 与前置门禁 SD-1 行认可立场逐字同向；分类词表沿用本门禁；§11 DENY 封死 `packages/**/src/**` | 无（触发时按前置门禁 §6-1 重过门禁——设计已登记） |
| 10 | **SD-2 裁决 (a)**（§7.3）：单点登记权威 + 微任务深度论证 + no-sink 0 跳细分 | `0032` 决策 3 L22；CONTEXT.md L227 Avoid | `ShardedHost`/facade 唯一 `connectionKey→连接` 登记表；`accept*` 返回后第一动作登记（探针 `store()` 模式亲验 L542-553）；resolver 只查表取不到即抛；否决 resolver 侧等待/缓冲/重试；时序论证锚定源码结构（acceptTrusted 单同步段 + 构造尾同步重放 vs `openAdmission` 异步链 ≥2 跳，authorize `.then` L399 + `await` L408 亲验）；§7.3-4 no-sink 重 OPEN 的 resolver 0 跳细分（L345/396-398 亲验：调用同步、结算异步；该路径仅在首 OPEN 已固定登记后可达） | **no-conflict** | 论证前提逐点亲验属实；不建第二准入管线 = 决策 3 职责归属的遵守 | 无 |
| 11 | **SD-2 裁决 (b)**（§7.3）：响亮收口冻结为退化路径（夹具头注 + 一条设计追加负控） | `0032` 决策 3 L22「sink 失败响亮连接收口」；CONTEXT.md L226；协议 §13.1 L415 + §14；前置门禁 SD-2 行边界「(b) 限测试文档冻结」 | 冻结在测试文档层：夹具头注登记分界（含 0 跳细分 + boot 形态 registry 同一性约束一并登记，§8.1 尾）；lifecycle 套件 `SD-2(b) degenerate` 负控（不登记 → `HELLO_ACK`×1 + 连接级 `ERROR(INTERNAL_ERROR)` + `close(1011,'protocol-error')` + 零会话）；显式不写入 `docs/**`（follow-up 新票） | **implements-existing-decision** | 源码 L442-451 亲验（`Promise.resolve` 包裹 + catch → `connectionFatal('INTERNAL_ERROR', 1011)`，注释「无静默 fallback」）；落在 ALLOW LIST 文件内、不削弱契约条目；未越「限测试文档」边界 | 无 |
| 12 | **SD-3 裁决（§7.4）**：每场景一工厂（harness 侧约定，零生产改动） | `0032` A2-β L48 + 后果 L66；前置门禁 SD-3 行「处置留 harness 侧；生产侧改键/加工厂选项须新票」 | 每场景恰一工厂（夹具内部构造、不外注）；`instanceId` 钉死 `HUB_INSTANCE`（N2 落实）；否决「每工厂换 instanceId」规避（破坏同源语料）；误用守卫靠既有响亮拒绝（源码亲验）；不改键格式、不加工厂选项、宿主指引 = follow-up | **no-conflict** | 全部处置留 harness 侧；A2-β 唯一性作用域是 (连接, namespace)（前置门禁同款认定）；connectionCounter 初值 0/键格式/重复 throw 三点亲验 | 无 |
| 13 | **SD-4 裁决（§7.5）**：协商形态最小读法（回合完整 + 协商位可见） | 协议 §22 L700-703（资产锚）+ §5 L114 + §6.1 L137；前置门禁 SD-4 行「协商位断言不得删」 | ① ROUND-C1~C3 协商形态复跑；② `HELLO_ACK.selectedCapabilities & CAP_CHUNKED_UPDATE ≠ 0`；③ 描述子协商位（「NC4 断言不得删」显式兑现）；深读法否决理由登记（重复冻结 + 混淆验收主张） | **no-conflict** | 前置门禁「两读法均不违约，择一并记录理由」——理由已记录；资产锚 #243/#246/#300/#301 亲验在库（协议 L700-703 逐条对应） | 无 |
| 14 | **硬门三层判据（§7.2 枚举白名单）** | 协议 §22 L701；SA6 §12.1；前置门禁 §8-2「不得放宽或加严」 | L1 = {HELLO_ACK, OPEN_OK, ERROR, CLOSE_OK, GOAWAY}、L2 = {BOOTSTRAP_SNAPSHOT, UPDATE, UPDATE_CHUNK, SYNC_STEP2}——与契约 §12.1 帧种类集逐一相同；黑名单→白名单对契约语料行为等价（SA2 N6 独立佐证被吸收登记）、新 kind 保守落 L3；`SYNC_STEP1` 不入 L1；禁 L2 字节断言（AUTH-C5(a) 负控）；硬门定义原文写进 auth-parity 头注；observer/assembly 口径不入 parity | **implements-existing-decision** | 契约 §12.1 本以正面清单表述——白名单即契约定义本身；L701 纪律逐层对应；迭代 1 未改 §7.2 判据 | 无（头注原文落位交实现票） |
| 15 | 观测面不入 parity（H8） | 协议 §23.1 L838-846 + §17 L582；ADR 0032 决策 5/A3 | §7.2 明列排除；§12 判据表显式排除；风险表登记 | **implements-existing-decision** | L838-846/L582 亲验（发射侧归属表 + 两处文档化差异） | 无 |
| 16 | 协议条款断言引用（§12.0/§12.1；N1 行锚回写） | §12 L375、§13.2 L425、§13.1 L415、§7.1 L176、§6.3 L159、§21 L684、§5 L114、§6.1 L137、§3 L57 | 迭代 1 已按迭代 0 报告 §8-2 裁定回写：AUTH-C2 行 L425、ROUND-C3 行 L375、§12.1 引用组注明 L424=REOPEN/L425=UNAUTHORIZED——本轮亲验协议原文：L375 = CLOSE_OK `ackedSequence` 字段行、L425 = `NAMESPACE_UNAUTHORIZED→failed` 行，**两处修正后的锚位正确** | **implements-existing-decision** | `sed -n '370,376p;423,427p'` 亲验（L370 节头/L375 字段行；L424 REOPEN/L425 UNAUTHORIZED） | 无 |
| 17 | 公共面冻结 append-only（#420/#421/#422 前序票 + 本票零公共面变更） | `0032` L64-66；SA6 §12.0；前置门禁 §5 | §11 DENY 全列禁改（src/协议包/registry 包含 testing seam/apps/domains/docs/配置/既有 455 测试）；ALLOW 仅 5 个 test-only 新文件 + 流水线证据；**迭代 1 零范围变化**（亲验：修订全落既有 ALLOW 文件的装配设计内）；GATE-C3 双段证据命令（N3 落实：全 DENY 面 `git status --short` 空） | **no-conflict** | 冻结被遵守而非触碰；亲验当前工作树零生产 diff | 无 |
| 18 | 规范文档零改动 | `docs/**` 为决策/规范权威（前置门禁 §6/§7） | 设计全文零 `docs/**` 写入主张；SD-2(b)/SD-3 规范化显式 follow-up 新票（§13）；boot 形态约束只写设计/夹具头注，不写规范 | **no-conflict** | 任何决策文本演进走显式新票路径 | 无 |
| 19 | 测试纪律（模块 AGENTS + SA6 §12.0） | `packages/ws-replication/AGENTS.md`（注入 seam、真实入口、无 skip/only、验证门）；SA6 §12.0/§12.7 | §7.7 时间纪律按侧精确化（N5 落实：boot 形态 hub 侧 = `run.hubNode.scheduler.pending()`、pipe 形态 = `ShardedWorker.scheduler.advanceBy`，`advanceMs` 只推 peer 侧亲验属实）；§7.8 零变异开关/零 env/零条件跳过；§9 失败语义全继承生产、无静默兜底；负控全保留（AUTH-C5/NC1-NC4/REAUTH-C2/TERM-C3/SD-2(b)/ROUND 前提断言）；GATE-C1~C3 同轮命令与模块验证门同款 | **implements-existing-decision** | 模块 AGENTS 逐句对应；SA6 §12.7 义务被 §13「任务内必要条件」吸收 | 无 |
| 20 | 语料与身份确定性（§7.7） | CONTEXT.md L186；协议 §3 L57；模块 AGENTS 注入纪律 | 同源 `Uint8Array` 脚本两形态重放；seeded randomBytes（仅 128-bit 请求）同 seed 同 ns 身份；Yjs clientID 不控制（O7 归因）；全虚拟时间；禁真实 timer/sleep/网络/IO | **no-conflict** | 测试侧确定性纪律，不触任何决策条款 | 无 |

裁决分布：**no-conflict 10 项（#6/#7/#8/#9/#10/#12/#13/#17/#18/#20）、implements-existing-decision 10 项（#1/#2/#3/#4/#5/#11/#14/#15/#16/#19）；evolution-required 0、hard-conflict 0、override 0**。

### SD 裁决 × 前置门禁边界核对（dispatch 指定面）

| SD | 迭代 1 裁决 | 前置门禁允许边界（conflict_report §3） | 落点核对 |
|---|---|---|---|
| SD-1 | 停手报 SA8/设计；偏差现场 + 分类上报；**前置甄别（ROUND 红灯先核装配前提断言再分类）**（§7.1） | 「停手报 SA8」为认可立场；修复票按分类重过门禁 | **边界内**（未采「就地修」；前置甄别只滤伪偏差，不改变分类学与上报义务） |
| SD-2 | (a) 单点登记权威 + 微任务深度论证 + no-sink 0 跳细分登记；(b) 夹具头注 + 一条设计追加负控冻结退化路径（§7.3） | (a) no-conflict；(b) implements-existing-decision，**限测试文档冻结** | **边界内**（(b) 落 ALLOW LIST 文件与头注、未入 docs/**；未把退化路径当正常路径；设计追加负控不削弱任何契约条目） |
| SD-3 | 每场景一工厂；instanceId 钉死 HUB_INSTANCE；零生产改动；守卫靠既有响亮拒绝；指引文档 = follow-up（§7.4） | 处置必须留 harness 侧；生产侧改键/加工厂选项 = 新票 | **边界内**（零生产/零 docs 触碰） |
| SD-4 | 最小读法；NC4/ROUND-C4 协商位断言保留；深读法否决理由登记（§7.5） | 两读法均不违约，择一并记录；协商位断言不得删 | **边界内**（断言显式保留） |

### F-R1 修订增量 × 指定复核面（本轮新增核对）

| 修订增量 | 与决策集的关系 | 核对结论 |
|---|---|---|
| §8.3.1 boot 形态 registry 同一性约束（正文 + 依据链 + 失败模式） | 承接既有测试基建事实（driver 绑定链 + 探针 O8 唯一 green 装配），非新协议语义/非新生命周期所有权；ADR 0032 对「哪份 Registry 喂 SessionHost」无规定（SessionHost 工厂本必填 registry，`hub-session-host.ts:44-45`） | **无冲突**；依据链四点全部亲验属实 |
| §8.1/§8.3.2 facade adopt 模式（registry 必填 + 无 route + AdoptedWorker）+ 删除路由形态 facade | test-only 夹具面收窄；零公共面/零 wire/零决策文本；「删除比运行时守卫更强的关闭方式」是工程选择（SA2 建议分支的加严采纳，不采第一分支的理由已登记——独立导出会成为可绕过的第二入口） | **无冲突**；属决策 1「只装配公共工厂」的兑现型 |
| §12.0「ROUND 装配前提」断言行 + §12.2 前提断言 | 设计追加断言（超出契约最小清单、不削弱任何契约条目）；观察面 = 测试装配态引用同一性，非 wire 断言——不构成硬门加严 | **无冲突** |
| §8.1 `RoutableWorker` 最小结构面（route 返回类型放宽） | 桥只消费 `index`/`host` 两成员；`ShardedWorker`/`AdoptedWorker` 均结构满足——夹具内接口收窄 | **无冲突** |
| N1-N7 吸收（§14 映射逐条） | 行锚 L375/L425 回写正确（亲验协议原文）；N2/N3/N4/N5/N7 均为设计内登记或措辞精确化；N6 无需改动 | 全部处置属实，无范围扩大 |

硬门核对（迭代 0 结论维持并重验）：设计 §7.2 与 SA6 §12.1 硬门定义的帧种类划分**完全一致**（L1 五种 / L2 四种）；白名单为新 kind 保守落 L3，非放宽亦非加严；observer 事件集与 assembly 口径持续排除在 parity 外（§23.1 L838-846 / §17 L582）。迭代 1 未触碰 §7.2 判据。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| — | — | — | — |

无 override 需求：Issue 评论快照为空（`[]`）——无 Owner 评论可作覆盖权威；设计零决策文本修订、零公共面变更；adopted-registry 约束、SD-1~SD-4 裁决、硬门判据全部在既有决策边界内闭合。设计 §4「不存在被忽略的 Owner override」与 dispatch 快照一致。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（迭代 1 设计计划的接触方式） |
|---|---|---|---|
| Wire envelope + sequence | 20 字节固定头；`[8..12]` uint32 BE 从 1 严格递增（per connection） | 协议 §3 L49-61 | 套件只观察（SEQ-C1 读原字节）；零改动 |
| 消息注册表 / HELLO 协商 | 消息码 append-only；`0x42` 仅协商后；`CAP_CHUNKED_UPDATE=0x00000001` | 协议 §5 L91-116、§6.1 L137 | 只观察（NC4/ROUND-C4 断言协商位）；零改动 |
| 错误注册表 + WS close code | §13.1/§13.2 全码表（INTERNAL_ERROR→1011、UNAUTHORIZED→failed 等）+ §14 分类 append-only | 协议 §13/§14 | 只观察（AUTH/REVOKE/SD-2(b) 断言既有码与收口号）；零改动 |
| GOAWAY/drain 语义 | drain 提前完成 / deadline 1001；REAUTH 窗口 OPEN 静默丢弃 | 协议 §6.3 L159、§21 L684 | 只观察（REAUTH-C1/C2）；零改动 |
| ADR 0032 决策 1-5 + A1-A3 | 缝词汇、载体三分、dormant 降级、发射侧归属 | `0032` 全文 | harness 装配兑现（含 adopt 形态——装配位置变化，被装配对象仍为公共工厂真身），零修订 |
| 公共工厂面（#420/#421/#422） | `createHubSessionHost`/`createHubReplicationEdge`/`createHubReplicationPlugin({listen:false})` 签名冻结、演进仅 append-only | `0032` L64-66；CONTEXT.md L226/L230 | 零公共面变更（§11 DENY；GATE-C3 空 diff）；adopt 形态只**消费** `options.registry`，不新增公共成员 |
| `boot({createHub})` 注入缝（测试基建） | 既有注入契约：`{instanceId, registry, authorize, timer, verifyToken, limits?, timeouts?, observer?, clock?}`；hub 侧观察面绑定 boot 节点 | `driver.ts:196/489-537` | 按既有契约消费（§10 调用方矩阵）；registry/timer 结构性采纳（不再丢弃）；`instanceId`/`observer`/`clock`/`limits`/`timeouts` 不消费——钉死 `HUB_INSTANCE`、DEFAULT 限值、零 observer（H8），属消费侧选择，非缝变更 |
| Observer 36 型词表 + 发射侧归属 | append-only；未授权 OPEN 无 `channel-state-changed` 为文档化差异 | 协议 §23.1 L838-846 | 不入 parity（H8）；零改动 |
| 路由键布局 / assembly 口径 | 定偏移事实集 + 守卫测试；listen per-connection vs 分片 per-session | CONTEXT.md L233-235；协议 §17 L582 | 只观察（SHARD-C3）；口径差不入断言 |
| 生产源码 / 规范文档 / 既有测试 | `packages/ws-replication/src/**`、协议包、registry 包（含 `src/testing.ts`）、`apps/**`、`domains/**`、`docs/**`、既有 455 测试文件（含 harness/driver/issue420 夹具）零 diff | SA6 §12.0；前置门禁 §5 | ALLOW LIST 全部 test-only + 流水线证据；亲验当前零 diff；夹具 DEFAULT 常量替代 `CONTRACT_*` 的选择不改 harness |
| SD-2 退化路径语义 | 「sink 解析失败响亮连接收口」= Edge 规范职责（不可被「修」成静默 fallback） | `0032` L22；CONTEXT.md L226；`hub-edge-host.ts:442-451` | 设计以负控**加固**该冻结面，方向与决策一致 |

## 6. Evolution requirements

**无 evolution-required 项**：迭代 1 设计（含 adopted-registry boot 约束与 facade adopt 模式）不改任何 ADR/CONTEXT/协议条款、零公共面变更、零新决策面——§15-4 自述与逐条核验一致；boot 形态约束是对既有 `boot`/`driver` 事实与探针 O8 装配的承接，非新语义。

条件性边界登记（继承前置门禁 §6，本设计均未触发，触发时须重过门禁）：

1. SD-1 触发（套件暴露真实偏差，且经 §7.1 前置甄别确认为非装配错位）→ 修复票分类：实现向 ADR 对齐 = implements-existing-decision；改 wire/协议语义 = evolution-required（同变更集修订 + 重过门禁）。设计 §7.1 已按此协议登记。
2. SD-3 走向生产侧（改 connectionKey 格式 / 加工厂选项）= 公共面 append-only 演进（`0032` L66），新票重过 SA8。设计明确不做。
3. SD-2(b) 规范化（写入 `docs/**`，含早到 OPEN 收口/宿主登记义务）= 超出本票 DENY 面，须扩 ALLOW 并检查决策面新增。设计明确列为 follow-up 新票。
4. 「boot 形态 + 多会话宿主」夹具形态（多 host 共享同一被采纳 registry 的路由参数化，§13-5）= 未来扩夹具需求；扩 parameterization 时 §8.3.1 约束必须保持不变（多 host 仍须共享同一被采纳 registry）——若未来需求要求突破该约束（如 hub 侧观察面跨 registry），即超出 test-only 装配裁量，须重过本门禁。
5. 确定性 clientID 注入（若未来要全轨迹逐字节硬门）= 超出 DENY 面的新票（协议 §22 L701 纪律使当前三层判据为正解）。设计明确不做。

## 7. Hard conflicts

**无**。逐项对照见 §3：adopted-registry boot 约束（F-R1 修订核心）是对既有测试基建事实的承接且零决策文本触碰；SD-1~SD-4 四项裁决全部落在前置门禁 adjudication 边界内（迭代 1 未改裁决，SD-1 仅增前置甄别仍边界内）；硬门三层判据与协议 §22 L701 及 SA6 §12.1 完全一致；缝投影、冻结面、测试纪律均为既有决策的兑现或边界内裁量；未发现任何无 override 的不兼容。设计引用的全部源码结构事实（boot 绑定链、注入缝、connectionKey 生成、acceptTrusted 单同步段、构造尾重放、openAdmission 异步链、no-sink 0 跳细分、解析失败响亮收口、重复开启响亮拒绝、egress 回传序、resolved 形必填、单体 revoke/close 镜像语义、runner/tsconfig 发现面）经本轮逐点亲验属实；上游事实与源码无矛盾。

## 8. Required actions

（非阻塞；交实现票执行）

1. **TIMEOUTS resolved 形取得方式修正（本轮新发现，引用精度类，同迭代 0 §8-2 性质）**：设计 §8.1 注释「`ResolvedLimits`/`ResolvedTimeouts` 为空扩展（types.ts:1009-1010），常量可直接赋」对 **TIMEOUTS 不准确**——`ResolvedLimits` 确为空扩展（LIMITS 可直接赋），但 `ResolvedTimeouts` 在 base 可选的 `pingIntervalMs`/`pongTimeoutMs`/`assemblyTimeoutMs` 上加了**必填**约束（types.ts:1009-1012），而 `DEFAULT_REPLICATION_TIMEOUTS` 声明类型为 `Readonly<ReplicationTimeouts>`（defaults.ts:40）——冻结**值**满足形状、声明**类型**不满足（`resolveTimeouts` 自身即需 `as ResolvedTimeouts`，defaults.ts:69）。实现票取 TIMEOUTS resolved 形应走 `resolveTimeouts(undefined)`（值 = 同一组冻结值）或显式类型断言；两半边同值纪律不受影响（edge 工厂侧不传 = 工厂内 resolve 同值）。夹具注释按此落笔，不得裸赋常量给 `ResolvedTimeouts` 导致 typecheck 假绿/红。
2. **§8.3.1 依据链 2 行锚精度注记**：「boot 恒传 `registry: hubNode.registry`」应注记 `driver.ts:518` 实为 `opts.wrapHubRegistry?.(hubNode.registry) ?? hubNode.registry`（存在 `wrapHubRegistry` 包装 seam，driver.ts:212）。设计 ROUND 场景未用该 seam，且 §12.2 引用同一性前提断言会把任何包装形态**前置红**（指向装配）——约束在设计场景集内成立；实现票在夹具头注按精确事实落笔即可，无需设计修订。
3. **硬门定义原文落位**（继承迭代 0 §8-1）：`ws-replication-issue424-auth-parity.test.ts` 头注必须写入 §7.2 硬门定义（L1/L2 白名单、L2 禁字节断言、observer 不入 parity）。实现票不得省略。
4. **实现票复审义务（已登记，非本轮）**：交付后按前置门禁 §10-2 / 设计 §15-3 核对——套件未 fork 状态机、未越 DENY 面、硬门口径未漂移、负控（NC1-NC4 + AUTH-C5 + REAUTH-C2 + TERM-C3 + SD-2(b) + ROUND 装配前提断言）原样在位；GATE-C3 双段证据（含全 DENY 面 `git status --short` 空）同轮落 `artifacts/issue424-*.log`。
5. SD-1 停手协议按设计 §7.1 执行（含前置甄别）：任一断言暴露真实生产偏差 → 保留现场、登记上报，不得就地修生产或软化断言。

## 9. Verdict

**clear**

- 20 项对照全部为 no-conflict（10）或 implements-existing-decision（10）；hard-conflict 0、override 0、evolution-required 0。
- **adopted-registry boot 形态约束（F-R1 修订核心）经独立核验无冲突**：依据链四点（boot 观察面绑定、注入缝传参、同源当且仅当论证、探针 O8 唯一 green 装配）逐点亲验属实；约束承接既有测试基建事实与公共面既有形态（SessionHost 工厂必填 registry 的正当消费），非新决策面；结构性落实（registry 必填 + 无 route）与前提断言均留 test-only 边界内。
- **SD-1~SD-4 四项裁决全部仍落在前置门禁 adjudication 边界内**（§3 核对表逐行核对，零越界项；SD-1 新增前置甄别为边界内精化）；硬门断言无漂移（帧种类划分与契约/协议完全一致，迭代 1 未触碰判据）。
- SA2 评审 F-R1 与 N1-N7 的落实经 §14 修订映射逐条核对属实：N1 行锚（L375/L425）回写经协议原文亲验正确；N2/N3/N4/N5/N7 均已登记；无范围扩大、无生产/公共面触碰（§11「本轮零范围变化」亲验成立）。
- 两处引用精度事项（§8-1①/§8-2②）不构成 reject 事由：语义引用正确、影响面为零（修正方式已给出），与迭代 0 §8-2 行锚修正同性质。
- 设计引用的源码结构事实经本轮全量重验属实；上游事实与源码无矛盾。
- 总控可继续派发实现票（SA2 对迭代 1 的重审/批准属 SA2 流程裁量，非本门禁前置）。

## 10. requiresConflictRecheck

**true**

理由：

1. **实现尚待交付核对**：契约锁定的 wire/状态机/生命周期/失败语义断言面（AUTH/SEQ/ROUND/TERM/REVOKE/REAUTH 六组 + SD-2(b) 负控 + ROUND 装配前提断言）尚待实现票落地——须核对套件未 fork 状态机、未越 DENY 面、硬门口径与负控未漂移、GATE-C3 双段证据在位（前置门禁 §10-2、设计 §15-3 双双登记此义务）。
2. **SD-1 为条件性触发面**：若套件经 §7.1 前置甄别后确认暴露真实生产偏差，修复路径的分类（implements-existing-decision vs evolution-required）须按前置门禁 §6-1 重过门禁。
3. 本轮设计复审（迭代 1 增量）义务已闭合；设计自身零冻结面触碰、零新决策面，但纯 no-conflict 且无未决决策面/未交付冻结面核对的情形才置 false——本设计的断言面（生命周期/失败语义/wire 序）的实现交付核对尚在前方。
