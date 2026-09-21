# task_issue-421 SA10 Spec 审查 — Edge 公共工厂：accept 双入口 + OPEN 准入管线 + sequence 盖章（spec #415 T4）

- 迭代：**0**（一次性 spec-review dispatch）
- 被审对象：committed final delivery = `f40d0165962d1e4f4f96e12b7463b5cd6a8abb24`（`feat(ws-replication): add hub replication edge factory`）；基线 Parent PR #416 head `7039f6dae8e7d29f0c929492f0ca2119bc63afaa` 亲测是其 ancestor（`git merge-base --is-ancestor` exit 0）
- Owner 评论 REST 快照 = `[]`（dispatch 明示）——无评论级附加要求、无 override 来源；Owner 要求 = Issue 正文
- 审查方式：静态审查——Issue 正文 AC1–AC6 与 SA6 契约（EF/OAP/RK/ER/WS/LC/GATE）逐条映射到 delivery diff 的生产/测试落点并亲读关键实现与断言；git diff/name-only/grep 亲测范围与冻结面；上游产物（SA2 approve / SA4 迭代 2 approve / SA8 task·设计·实现三报告 clear）沿认。未运行测试、未启动服务、未修改任何产物
- Verdict：**`approve`**（AC1–AC6 全部忠实落地，无遗漏、无部分实现、无错误实现、无 scope creep；MINOR 登记项不阻断）

---

## 1. 交付面清点（delivery diff 亲测）

`git diff 7039f6d..f40d016 --name-only` 全量 27 文件，业务面恰为设计 §10 ALLOW LIST 全表：

| 类别 | 路径 | 亲测结果 |
|---|---|---|
| 新生产模块 | `src/hub-edge-host.ts`（955 行：公共工厂 + `HostSessionAdapter` + 连接句柄 + 两常数 + 8 公共类型） | 在 ALLOW 行 1；实现与设计 §7-D1..D7/§8.2 伪码逐点一致（含 SA4 F1/F2 修复位 `:323–346`/`:459–467`/`:495–499`） |
| 新生产模块 | `src/hub-upgrade-admission.ts`（123 行，四符号逐字搬迁） | 在 ALLOW 行 2；与 `hub-connection.ts` 删除段逐字一致（diff 亲读）；不进 index/testing |
| 公共入口 | `src/index.ts`（+16：值导出恰 +1 `createHubReplicationEdge` + 8 `export type`） | append-only；既有 11 运行时导出零改名零删除（C5a 绿证 + EF-C1 运行时断言） |
| 单体组合根 | `src/hub-connection.ts`（−110/+5 = 纯导入迁移） | 行为/模块运行时键面零变化（`^export` 单键保持 → structure.test L616 兼容） |
| 冻结契约测试 | `test/…-issue418-…-contract.test.ts`（+1 行） | 恰为 SA2 R1 授权的 append-only 一名（`:151`，字典序位，断言语义零变化） |
| 新测试 | 6×`.test.ts` + 1×`.test-d.ts`（issue421 家族，共 90 runtime 用例 + 8 类型用例） | 恰为 SA6 §12.0 七路径；条目数 588→678（runtime）+8（test-d）= 686、文件 77→84 与 SA3 报告值逐项对账一致 |
| docs-sync | `CONTEXT.md`（「复制 Edge」词条 2 行） | 限该词条；SessionHost/路由键词条零触碰（SA8 A5 边界内） |
| 流程文档 | `wiki/raw/task_issue-421_*`（8 份）+ `artifacts/sa6-issue421-*.log`（3 份） | SA 资产归档，非业务面 |

**DENY 面零 diff 亲测**：`packages/replication-protocol/**`（GATE-C4）、`hub-edge.ts`/`hub-split.ts`/`hub-session.ts`/`hub-namespace.ts`/`frame-io.ts`/`backpressure.ts`/`liveness.ts`/`observer.ts`/`defaults.ts`/`validate.ts`/`types.ts`/`plugin.ts`/`testing.ts`、`docs/**`、`apps/**` 全部不在 changed 清单。既有测试面唯 C5a 一处授权例外。**scope creep：零。**

## 2. Issue AC 逐条判定

### AC1（edge 工厂从包公共入口导出，签名经 test-d 锁定）— ✅ 达成

- 运行期：`index.ts:9` 值导出 `createHubReplicationEdge`；EF-C1 测试（`edge-accept.test.ts:258–283`）断言 `typeof === 'function'` + 11 个 legacy 名全在场 + 只增不减；C5a 冻结清单含新名后精确等值绿。
- 类型层：`ws-replication-issue421-edge-factory-api.test-d.ts`（329 行，8 用例）逐成员 `expectTypeOf` 锁定工厂/双入口/Options 九成员（含 `verifyToken` 可选性的无键字面量 `satisfies` 证明）/Resolver 三参/`NamespaceAuthorizationGrant` = ok 投影/sink 四成员/句柄十成员（含 D7 负断言 `not.toHaveProperty('channels')`）/egress 五成员；`@ts-expect-error` 锁定 `ReplicationMessage` 不转出口。SA6 EF-C1/EF-C2 全落实。
- 形态：普通工厂、非 Cordis 插件、无 Registry 依赖（ADR 0032:41 后果节兑现）。

### AC2（OPEN 准入管线按序执行并有独立测试）— ✅ 达成

独立测试文件 `…-issue421-open-admission-pipeline.test.ts`（1214 行，40 用例，全部经公共入口 + 内存双工 transport 驱动）覆盖七阶段全分支：

| 管线阶段 | 实现落点 | 关键测试证据（亲读） |
|---|---|---|
| HELLO/drain 门 | 内部 edge 零 diff 承接（OAP-C1a/C1b） | pre-HELLO OPEN → `HELLO_REQUIRED`+1002、authorize/回调零调用；drain 窗口 OPEN 零 authorize 零回调，CLOSE 族照常路由（负控） |
| 全解码（畸形收口） | 内部 edge 零 diff（OAP-C2a..C2d） | 坏 magic/截断/seq gap → 注册表码 + 1002，零回调零会话；合法 OPEN 进 authorize（负控） |
| authorize | 内部 edge 单点 + 适配器 `port.openAdmission` 拉取结局 | **C3a（亲读 `:464–489`）**：deny → ns 级 `NAMESPACE_UNAUTHORIZED`（点名该 ns）+ `resolveCalls` 恰为 `[]`（未授权 OPEN 不过宿主缝）+ 不建会话 + 连接存活（后续帧仍处理）；**C3b**：重 OPEN → `NAMESPACE_REOPEN_REQUIRES_RECONNECT` 仅 wire 帧、authorize 累计恰一次（拒绝闩锁）；**C3c**：throw → ns `INTERNAL_ERROR` 连接存活；**C3d**：跨 ns 拒绝零互染 |
| pending 有界缓冲（序保冲刷） | `HostSessionAdapter` 缓冲 + `flushPending` 按 kind 分派 | C4a 到达序缓冲→同序冲刷（OPEN→`openNamespace`、帧→`namespaceFrame(msg,seq)`）；C4b 直投负控；C4c 第 17 项 → 恰一帧 `CONNECTION_POLICY_VIOLATION`+1008 不静默丢帧；C4d 恰 16 项不收口（负控）；C4b-established/denied/throw/no-sink 合流 OPEN 三态投递面/应答帧数收敛单体 waiter 语义 |
| 并发 OPEN 上界 | `MAX_CONCURRENT_OPEN_ADMISSIONS = 4` | C5a 4 个 in-flight 全通过（负控）；C5b 第 5 个 → 恰一帧连接级码 + close(1008) + 已建会话 quiesce + 不建会话 |
| sink 解析失败响亮收口 | `runResolveInner` catch → `connectionFatal('INTERNAL_ERROR', 1011)` | C6a/C6b throw 与 reject 两形态 → 恰一帧连接级 `INTERNAL_ERROR` + close(1011)；C6c `undefined` 不走收口（负控）；注册表零 diff（零新错误码） |
| 已建立会话转发 | 按 ns 键隔离投递 | C7a 该 ns sink 投递含 wire 序、他 ns 零污染；C7b 未 OPEN ns 零投递（NC4 形态） |

宿主回调 `resolveSessionSink(connectionKey, namespaceId, authorization)` 在授权通过后调用：C8a `authorization` = ok 投影（`localOwner`/`permissions`，非摘要）；C8b `connectionKey` 同连接恒定/跨连接互异；C8c 锁步 + 重 OPEN 不新增解析调用；调用序 `authorize → resolveSessionSink → 首帧投递` 在记录桩断言面内。

### AC3（路由键文法校验两分支逐字节复现单体语义）— ✅ 达成

- RK-C1a：违例帧（`[20]` 长度前缀 0x23→0x22）→ 恰一帧连接级 `MALFORMED_FRAME` + close(1002,'protocol-error') + 零投递零回调；RK-C1b 单字节差分负控。
- RK-C2a/C2b：「从未 OPEN」「宿主返回 `undefined`」两语料 → 合成 ns 级 `NAMESPACE_STATE_VIOLATION` + 连接存活；RK-C2c 已建 ns 投递负控。
- **RK-C3a/C3b（亲读 `:445–491`）**：工厂 `acceptTrusted` vs 单体 `createHubReplication(...).acceptTrusted` 同输入序列（HELLO+违例帧 / HELLO+两笔无 sink 帧）→ 出站帧 hex 数组逐字节相等 + close code/reason 相等，差异容忍度为零；两形态分支一致性先行断言防「两支皆空」假绿。

### AC4（ERROR 帧 mini-decode 有界扫描路由正确）— ✅ 达成

- ER-C1a..d：已建 ns 的 ns 级 ERROR（relatedSequence 有无、最长稳定码、长 safeMessage 变体）→ 投递目标 = `decodeMessage` 回读 `namespaceId`、携带 wire 序、连接存活；**帧内 namespaceId 起点 ≤ 64 预算见证**（`expectNamespaceBudget`，消费 T1 守卫登记的 `ERROR_NS_PREFIX_BUDGET`）。
- ER-C2a/C2b：连接级 ERROR（无 namespaceId）→ sink 零投递、wire 零回显、连接存活；同连接内「连接级不路由而 ns 级必须路由」判别性负控。
- ER-C3a/C3b：未知 ns（无台账）与 no-sink 态的 ns 级 ERROR → 零投递零出站静默丢弃，连接存活；非 ERROR 帧必须合成违例（负控）。
- 实现侧：路由/ERROR 特例零 diff 复用内部 edge（`hub-edge.ts` 不在 changed 清单），T1 守卫零触碰——布局契约同步维护义务保持。

### AC5（出站盖章后 wire 帧与单体输出逐字节一致）— ✅ 达成（附 1 项登记口径）

- WS-C1a（亲读 `:305–368`）：双 ns 控制/data 占位帧交织注入同一 mux 点 → `[8..12]` 大端序 1..N 严格递增（无跳号/重复/回退）、交织序 = 出队序、egress 返回值 = 盖章后 wire 序（盖章**对外可见**）；WS-C1b 入站 expectedSeq 不受盖章影响（SEQUENCE_VIOLATION 负控）。
- WS-C2a/b/c：每帧 hex == `encodeMessage(同一占位消息, { sequence: k })` hex，`[8..12]` 以外字节零触碰（占位编码 + mux 重写 ≡ 单次真实编码的运行时等价）。
- WS-C3a/b/c：两连接各自从 1 起（per-connection 非全局）；收口后零新出站且不扰邻接连接；对端 close → state='closed' + sink 收 `onConnectionClosed`。
- **同输入序列对比测试**：RK-C3a/C3b 以工厂 vs 单体同输入序列 hex 逐字节相等落实 AC 的对比要求（见 AC3）。
- **登记口径（非阻断，SA3 deviation §9-6 / SA4·SA8 已沿认）**：单体公共句柄 `HubConnection` 无宿主出站缝（无 egress 注入点），宿主发起帧的「与单体逐字节对比」结构性不可构造；WS-C2c 文件头显式登记——该面以占位≡codec 等价结构性覆盖，单体逐字节对比面落在入站驱动帧（RK-C3）。不构成未达成项：AC 要求的同输入序列对比测试存在且通过（RK-C3），SA6 WS-C2 的断言面（占位等价 + 同输入序列逐字节）均有落点。

### AC6（liveness/GOAWAY/reauth/drain 提前完成观测，settled 信号驱动）— ✅ 达成

独立测试文件 `…-issue421-edge-lifecycle.test.ts`（510 行，12 用例，假 timer 手工推进 + 微任务 settle 驱动）：

- LC-C1a/b/c：ready 后 `beginReauth` → GOAWAY{REAUTH_REQUIRED, drainTimeoutMs>0} + 'draining' + deadline 到 → close(1001,'hub-reauth')；幂等零附加帧；handshaking 态直 close 不发明 GOAWAY。
- **LC-C2a（亲读 `:359–375`）**：两个已解析会话经 `egress.namespaceSettled` 逐 ns 终态通知——部分 settled 不提前（deadline 仍武装）、齐备后立即 1001 且 deadline 已清（`pendingDelays` 不再含 closeTimeoutMs）；LC-C2b authorize/解析在途阻塞提前收口；LC-C2c 空会话集等 deadline；LC-C2d 已收口连接迟归结算零 wire 零事件（R4b 观测等价）。
- LC-C3a/b：drain 窗口 OPEN 零会话零回调，非窗口零行为变化。
- LC-C4a/b/c：ping timer 武装 + 8 字节凭据、凭据逐字节匹配的 pong 清超时，不匹配/迟到/空载荷 → close(1001,'pong-timeout')；缺面 dormant 零 timer。

## 3. 规范与契约符合性（normative cross-check）

| 规范条款 | 交付符合性 | 证据 |
|---|---|---|
| ADR 0032 决策 1（协议状态机单份，禁 fork） | ✅ 工厂 = 未改动内部 `HubReplicationEdgeImpl` 的宿主化包装；`hub-edge.ts` 零 diff | `hub-edge-host.ts:1–29` 装配声明 + git diff 亲测 |
| ADR 0032 决策 2（缝纪律 + wire 逐字节不变 + 零 worker_threads） | ✅ `packages/replication-protocol` 零 diff；出站盖章仍在内部 `OutboundQueue` mux 点单点 | git diff 亲测；RK-C3/WS-C2 字节等价 |
| ADR 0032 决策 3（authorize 在 edge、未授权不过缝、管线全为 edge 职责） | ✅ authorize 真实调用在内部 edge 单点；deny 路径宿主回调零调用；pending 有界缓冲（16）+ 并发 OPEN 上界（4）+ sink 失败 1011 收口全部落地并经 OAP-C11a–d 回归加固（SA4 F1/F2 闭合） | OAP-C3a/C4c/C5b/C6a；`hub-edge-host.ts:295–307,323–346,442–468` |
| ADR 0032 决策 4（路由键定偏移 + 两分支 + ERROR mini-decode + 布局同步契约） | ✅ 零 diff 复用 + T1 守卫零触碰 + ER-C1 ≤64 预算见证 | git diff 亲测；`error-routing.test.ts:326–387` |
| ADR 0032 决策 5（观测纪律：事件在事实侧、缺面 dormant、字段集 append-only） | ✅ 拒答/合成帧事件经 `port.emitObserver` 单点（稳定码折叠）；`dataFacetOf` → undefined dormant；零新事件类型零新错误码 | `hub-edge-host.ts:605–635,666–669`；SA8 实现报告全量大写字面量审计（25 值全部在册） |
| ADR 0032 后果节（普通工厂导出、公开面发布即冻结 append-only） | ✅ 值导出 +1、类型 +8，只增不减；C5a 清单同步一名（SA2 R1 授权的唯一冻结面触碰） | `index.ts:7–9,74–85`；contract.test `:144–156,551` |
| 协议 §1/§2/§3/§13/§14/§19 | ✅ HELLO 门/受信身份绑定（HELLO 自报不覆盖）/20B envelope/错误注册表与 close 分类（1002/1008/1009/1011）零新增/授权只在 OPEN 且 grant = ok 投影 | EF-C2b、WS-C1b、OAP-C8a；`errors.ts` 零 diff |
| 包 AGENTS（生产 API 经 index.ts；admission 四窗口有界） | ✅ 单点导出；早到帧 16 + pending 16 + 并发 OPEN 4 全入口上界 | `hub-upgrade-admission.ts`；`hub-edge-host.ts:295–386` |
| SA6 GATE-C1..C4 | ✅（报告值与静态对账一致；SA10 按纪律不复算） | 84 文件/686 测试/tsc exit 0/空 diff——文件数（77+6+1）与用例数（588+90+8）逐项对账吻合；测试纪律 grep 零 skip/only/todo/readFileSync/env override（亲测） |

## 4. Owner 评论映射

REST 快照为空数组 → 无评论 id/时间戳可映射，无 Owner 附加要求，无 override 来源。Owner 要求 = Issue 正文，§2 已逐项映射完毕。

## 5. 遗漏 / 部分实现 / 错误实现 / scope creep 判定

- **遗漏**：无。Issue「What to build」全要素（公共工厂导出、双入口、verifyToken 注入、resolveSessionSink 三参回调、出站盖章对外可见、OPEN 准入管线全分支、路由键两分支、ERROR mini-decode 消费 T1 布局契约）均有生产落点 + 独立测试落点。
- **部分实现**：无。AC1–AC6 全部「达成」而非「部分达成」；SA4 迭代 1 的两处 MAJOR（F1 no-sink 重解析上界绕过 / F2 帧预算泄漏）已在交付前修复并经 OAP-C11a–d 回归闭合（SA4 迭代 2 approve、SA8 实现报告 clear 沿认）。
- **错误实现**：无。抽审的关键断言（C3a deny 零回调、C5b 恰一帧+1008+quiesce、WS-C1a 严格递增、RK-C3 零容差 parity、LC-C2a settled 驱动提前收口、ER-C1b ≤64 预算）与契约可观察断言逐点一致；测试断言全部观察运行时行为（wire 字节/close/回调计数/投递序列/settled 信号），无源码字符串断言。
- **scope creep**：零。changed 路径 = 设计 §10 ALLOW LIST 全表 + 流程文档，无越界文件；无非目标项（listen:false、SessionHost 服务面、worker 形态、limits 新键、工厂级服务面聚合、peer 侧拆分）提前落地。

## 6. 登记项（PR 披露建议；全部非阻断）

1. **WS-C2 单体对比口径**：宿主发起帧与单体逐字节对比因单体公共面无 egress 结构性不可构造——以占位≡codec 等价 + RK-C3 入站驱动逐字节对比覆盖（WS-C2c 文件头显式登记；SA3 deviation §9-6；SA4/SA8 沿认）。
2. **SA4 MINOR M1–M5/M6/M7**：适配器观测事件不附 `connectionId`（可选字段，产品决策项）；首开分支占位 +1 有界角（与批准设计伪码逐形一致，峰值 17×maxFrameBytes 单次越界有界）；设计伪码 no-sink 行注记（routing: SA1 设计层补齐，实现按规范正文落地属正确取舍）。
3. **动态复算挂账**：SA4 §11 动态验证项（GATE 独立复算、根级 `pnpm typecheck`/`pnpm test`、`apps/yjs-server` 冒烟、非 memory transport 形态交叉）属 SA7/Host 门禁面，非 spec 缺口；本报告绿灯数字为 SA3 报告值 + 静态对账（SA10 不运行测试）。
4. **内部模块级导出**：`HostSessionAdapter`/两常数模块级导出供白盒守卫测试（OAP-C9b），不进公共入口——公共面 12 名不变（SA3 deviation §9-1）。

## 7. Verdict

**`approve`**。交付 `f40d016` 忠实满足 Issue #421 正文全部验收标准（AC1–AC6 逐项达成）与 SA6 验收契约（EF/OAP/RK/ER/WS/LC/GATE 各组断言面有独立测试落点），符合 ADR 0032 决策 1–5 + 后果节与协议规范全部适用条款；零遗漏、零部分实现、零错误实现、零 scope creep；Owner 评论快照为空无附加要求。登记项均为已授权/已裁决的非阻断事项，不构成 spec 未达成项。

— SA10（独立 Spec 审查），迭代 0，delivery `f40d016` @ 基线 `7039f6d`。
