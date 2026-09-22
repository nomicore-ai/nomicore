# SA2 设计攻击评审 — issue #420：SessionHost 公共工厂 + 内存管道完整协议回合（spec #415 T3）

- 派工：`sa-2a0f8385-4952-45b9-ae7f-69a69cc592ab`（role `mabf-sa2`，phase design-review，iteration 1——SA2-F1 修订轮）
- 评审对象：`wiki/raw/task_issue-420_design.md`（SA1 设计，iteration 1 = SA2-F1 修订版：§7 D7 三分支路由重写 + 路由相位状态 + E10 容错 + §5/§6/§8/§9/§12/§13/§14 联动）
- 评审方式：全新视角独立攻击；所有源码锚点本轮逐一开卷核对（文件 + 行号见各表），不采信设计自述。iteration 0 的 SA2-F1（MAJOR）为上一轮产物；本轮核验其修订是否真实、完整、且未引入新缺口。
- 产物：本文件（唯一可写产物；设计/生产代码/测试零改动）。

## 1. Reviewed inputs

| 输入 | 状态 |
| --- | --- |
| `wiki/raw/task_issue-420.md`（任务简报，Issue #420，AC1–AC5，comments 空；本轮经 `gh issue view 420 --json` 复核 body/labels/state/comments 与简报一致，REST comments = `[]`） | 已读 |
| `wiki/raw/task_issue-420_design.md`（iteration 1 修订版，525 行，全文） | 已读 |
| `wiki/raw/task_issue-420_sa6_contract.md`（已批准验收契约 §12 冻结面/断言矩阵/红绿期望，全文） | 已读 |
| `wiki/raw/task_issue-420_conflict_report.md`（SA8 task 门禁，verdict clear，RA1–RA5，全文） | 已读 |
| `wiki/raw/task_issue-420_relevant_decisions.md`（SA8 决策摘录，全文） | 已读 |
| `wiki/raw/task_issue-420_design_conflict_report.md`（SA8 design 复查，verdict clear，30 项对照，RA1'–RA5'，全文） | 已读 |
| 源码（本轮开卷核对）：`hub-session.ts`（293 行全读，重点 :84-94/:97-111/:115-172/:203-263/:269-287）、`hub-split.ts`（127 行全读，17 成员逐一清点）、`hub-edge.ts`（:40-268/:280-590/:588-790，重点 :47/:75/:101-105/:173/:201-209/:213-251/:318-369/:373-402/:490-567/:619-645/:686-735）、`hub-namespace.ts`（重点 :289-508/:525-530/:655-670/:1090-1105/:1124-1125/:1175-1200/:1736-1748）、`hub-connection.ts`（:44-60/:240-340/:425-465）、`backpressure.ts`（:160-185/:250-285）、`frame-io.ts`（:139-197）、`index.ts`、`vitest.config.ts`（根）、`envelope.ts`+`limits.ts`（replication-protocol）、`namespace-registry/src/types.ts`（:425-445/:880-890） | 已读 |
| 测试（本轮开卷核对）：`ws-replication-ac1-ac2-open.test.ts`（全文 293 行，重点 :39-48/:212-250）、`ws-replication-ac4-reconcile.test.ts`（全文，observer/哨兵/injectPeer 用例）、`ws-replication-ac5-live.test.ts`（import 段 + fan-out 用例）、ac3/ac7 import 段、`driver.ts`（:1-12/:190-200/:360-390/:510-520/:625）、`…issue418-edge-session-split-{contract,structure}.test.ts`（:140-160/:545-555/:610-625 冻结锚） | 已读 |
| grep 独立复核 | `channels.delete|channels.clear` 全仓 src+test 零命中；7 矩阵文件对 `revoke|requestReauth|run\.hub\.|createHub` 零命中；`src/**` 对包入口自引用零命中（仅注释）；`collectUnhandledRejections` 在 driver.ts:625 + ac3/ac4 在用；`docs/**`/`CONTEXT.md` 对两名引用未变（沿用 SA8 门禁轮 grep） |
| `artifacts/sa6-issue420-*`（16 项，本轮 `ls` 全部在场：探针 5 组 .mts+.log + type-lock-probe + 6 份 .log） | 已核对 |
| Owner 评论 | 无（派工明文 none；REST `[]`；简报 `## Comments` 空——本轮 `gh` 直查复核） |
| HEAD | `7039f6dae8e7d29f0c929492f0ca2119bc63afaa`（= PR #426 merge）——与 SA6/SA8/设计三方自述一致 |

## 2. Verdict

**`approve`**（0 × BLOCKER；0 × MAJOR）。

iteration 0 的唯一阻断项 **SA2-F1 已被修订真实、完整、结构性解决**，且修订未引入新缺口：

1. **三分支路由落地且与源码逐点吻合**。本轮独立重放了两个必红用例在修订后桥路由下的完整路径：(a) `ac1-ac2-open.test.ts:212-238`（authorize 门闩下注入第二个 OPEN）——首 OPEN 触发真台账（`hub-edge.ts:323-328` `beginAdmission` 先于投递）、桥入 `routing` 相位、第二 OPEN 入 pending 窗口（edge 对台账命中 ns 的非首 OPEN 仍无条件 `sink.openNamespace`，`hub-edge.ts:321` 注释明文）；`release()` 后 authorized 续体同步段完成 `open()` → 注册 → 首 OPEN 转发（`hub-session.ts:84-94` 同步 `channels.set` + `startOpen`）→ 冲刷 pending（第二 OPEN 经句柄转发 → 通道在场 → `onOpen` → 'opening' → `openWaiters.push`，`hub-namespace.ts:309-313`）→ 通道 open 完成时 `flushOpenWaitersOk` 按 waiter 数逐个再答（`:474-481`）⇒ `OPEN_OK`×2 + authorize 恰一次（真台账单点），与 listen 逐字节一致；(b) `:240-250`（conflicted 后再 OPEN）——相位 `authorized` → 分支 ① 经既有句柄转发（不再调 `open()`）→ 通道终态（`channels` 永不删除，本轮 grep 零命中）→ `onOpen` 终态分支 → `NAMESPACE_REOPEN_REQUIRES_RECONNECT`（`:295-300`）。两用例 shim 臂断言逐字不变可绿。
2. **在途 denied + 再 OPEN 的隐含一致性也成立**（无矩阵用例直接驱动，但设计主张「与 listen 逐字节一致」覆盖之）：denied 续体内 `denialSink.openNamespace(首 OPEN)` 同步建通道后，其 authorize 拉取（真台账已结算 denied）悬停在微任务边界——续体内**同步**冲刷的 pending OPEN 条目必然命中仍处 'opening' 的通道 → openWaiters 合流 → `finishOpenError` 按 waiter 数逐个发 `NAMESPACE_UNAUTHORIZED`（`:483-488`），与 listen 下「再 OPEN 于 denied 结算前到达」同形同量。
3. **故障面闭合**：E10 续体整段 try/catch → `realPort.connectionFatal('INTERNAL_ERROR', 1011)`——本轮核对 `makePort` 的 `connectionFatal(code, wsCloseCode ?? 1002)`（`hub-edge.ts:222`）显式传参优先 ⇒ 1011 生效（协议 §13 `INTERNAL_ERROR`→1011 在册映射）；E5 重复 `open()` throw 面被相位路由结构性避开（三分支均不重入 `open()`）；M7 变异（退化为 iteration 0 缺陷）被登记为 `:231/:245` 红 + `collectUnhandledRejections()` 非空（ac4 :173 既有哨兵同款采集面）。
4. **不触决策面**：公共冻结签名、DENY 面（`hub-namespace.ts`/`hub-edge.ts` 零 diff）、port 17 成员集、D6/U3 裁决方向、RA1 附录要素全部原样——SA8 design 复查（clear）的裁决对象未变，修订方向 = 收紧（shim 更贴近 listen 语义）。

残余为 3 条非阻断观察（§14），不构成实施风险。

## 3. 需求覆盖

| Requirement（Issue 正文 / AC） | Design section | Assessment |
| --- | --- | --- |
| 导出 SessionHost 公共工厂；`open()` 输入含 connectionKey/remoteInstanceId/namespaceId/authorization 预授权投影/selectedCapabilities/可选 connectionId | §7 D1（签名逐字 = SA6 §12.1；iteration 0 已逐字符比对，本轮复核未变）；`authorization: Extract<NamespaceAuthorization,{ok:true}>` 与 `src/types.ts:116-122` 联合型吻合，投影 JSON-safe（`localOwner:{userId}` 等，registry types) | 覆盖 |
| 句柄 `handleFrame`（fire-and-forget）/`onFrame`（出帧，sequence=0 占位）/`close` | §7 D2/D3/D4 | 覆盖；`onSignal`/`terminateUnauthorized` 补齐依据 = SA6 §12.1 追加项声明 ①②③（settled 是 edge drain 唯一提前判据 `hub-edge.ts:686-710` 本轮亲验；`connection-fatal` 是通道既有收口路径 `hub-namespace.ts:662/:1099` 恰两点恒 1002 本轮亲验；terminate 是 ADR 决策 2 信号） |
| authorize 不在 session 侧调用——闭包回放预授权投影 | §7 D1（adapterPort.`openAdmission` 恒回放）+ test-d 负控 | 覆盖；与 `hub-session.ts:105-111` 拉取 shim 的 ok-投影回放臂同构（本轮全读） |
| 内存管道对驱动完整协议回合，无 socket 无 worker | §7 D7/D8 + §12 AC2（A1–A12） | 覆盖（iteration 1 起 AC3 依赖的桥路由缺口已闭合，见 §7/§12 本轮攻击结论） |
| AC1 test-d 锁定 + 公共导出恰增 `createHubSessionHost` | §7 D1/D9 + §11/§12 | 覆盖；`FROZEN_PRODUCTION_EXPORTS` 11 名字母序 + 插入位（`createHubReplicationPlugin` < `createHubSessionHost` < `createPeerReplication`）本轮核对 contract test :144-156/:551-552；structure test :618 现 `['createHubSessionHost']` → 改 `['createHubSessionSink']` 机械成立 |
| AC2 完整回合 | §12 AC2 行（A1–A12 + W2 修正负控） | 覆盖；A8 已采 W1/RA4' 修正读法（出站占位 0 / 入站非 OPEN wire 序） |
| AC3 矩阵 shim 重跑（通道零改动 + 状态机零 fork） | §7 D8（机制 (a)）+ §7 D7（三分支路由）+ §12 | **iteration 1 起覆盖**：本轮核对机制可行性证据链全部成立（别名同 id `vitest.config.ts:13`、src 零自引用、driver.ts:8/:516 默认吃 mock、7 矩阵文件零 `createHub`/`run.hub.` 引用本轮 grep 复核、ac7 值导入 `createPeerReplication` 经 `...actual` 展开保真、`maxWorkers:1` + 默认按文件隔离 ⇒ mock 无跨文件泄漏面） |
| AC4 缝两侧只过字节/纯 JSON；零 worker 依赖 | §12 AC4（C4a–C4d） | 覆盖；`package.json` 现零 worker 依赖（结构门须保持） |
| AC5 session 侧零重检入站 sequence | §7 D2 + §12 AC5（C5a–C5d/M5） | 覆盖；`DecodeOptions.expectedSequence` 可选、缺省不检查本轮复核（`envelope.ts:127-128` 字面 `expectedSequence !== undefined && …`） |
| 非目标未被静默扩大 | §1（peer 拆分/真 worker/服务轨/wire 变化/hub-namespace diff 均排除） | 与 SA6 §10、SA8 行 13 一致；SA2-F1 修订未扩大范围（§11 明示文件范围不变） |

## 4. Owner评论覆盖

无 Owner 评论（派工明文 none；本轮 `gh issue view 420 --json` 直查 comments = `[]`；简报 `## Comments` 空）——无映射表可建，与 SA6 §2/SA8 §1/设计 §4 四方同口径，无遗漏。

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
| --- | --- | --- |
| SA6 G1–G7/E1–E4/N1–N6（能力缺口、序回传承重、sequence 单点、中继保真、纯度敏感） | §5 承接表逐条落位（D1/D2/D3/D7/§12） | 核对成立；E1 承重锚本轮复核（`hub-namespace.ts:655-662` bootstrapSnapshotSeq 比对 → `ACK_STATE_VIOLATION`；`:1092-1101` onUpdateAck violation；`frame-io.ts:181-196` emitOne 盖章 `[8..12]` 并返回本帧序） |
| **B16（iteration 1 新增事实锚：再 OPEN 投递语义）** | §2 B16 + §7 D7 三分支 | **本轮逐行亲验全部成立**：`hub-edge.ts:318-328`（台账命中再 OPEN 仍无条件 `sink.openNamespace`，:321 注释「只投递 → 通道 onOpen 重开矩阵（零 authorize）」）；`hub-session.ts:84-94`（在场 → `channel.onOpen`；不在场 → 同步建 + `startOpen`）；`hub-namespace.ts:289-331`（重开矩阵五分支：终态→REOPEN 错 / closing→waiter / opening→waiter 合流 / 已建立四态→立即再答）；`channels` 零删除（grep 全仓零命中）；`ac1-ac2 :231/:245` 两用例实测驱动该路径（本轮开卷确认用例体与 `injectPeerFrame` :46-48 注入机制） |
| SA8 RA1（ADR 附录 + CONTEXT.md 同变更集） | §6 RA1 行 + §7 D10 + §11 ALLOW LIST | 覆盖；D10 E1/E2 线要素与 SA8 §6 要素表逐项对齐；修订未触碰其裁决面 |
| SA8 RA2（U3 二选一 + deny 断言族） | §7 D6（iteration 1 补「OPEN 帧可多次到达…零二次授权」句） | 裁决维持成立；补句把资源账从「admission 结算单点」扩展到「OPEN 多次到达」协议现实——与 B16/ADR 决策 3 自文（「重 OPEN 经 openWaiters 合流不重复 authorize」）相容 |
| SA8 RA3/R5''（桥形态冻结 + impl 复查清单） | §6 RA3 行（iter 1 增补核对项：三分支落地 + 再 OPEN 两用例 shim 臂实跑绿 + 零 unhandled rejection）+ §15 第 4 条 | 覆盖；增补项与本轮 §12 验收审查一致 |
| SA8 RA4'/W1/W2（两处验收措辞修正） | §5 W1/W2 + §12 A8/A4 | 已按裁定读法落实且经 SA8 design 复查确认（行 15/16）；本轮源码复核 W2 三重锚成立（registry `types.ts:437-438`「仅 live entry 的 owner 不符→NAMESPACE_NOT_FOUND 零存在性泄露」；通道 `hub-namespace.ts:355-375` 映射；协议 :650） |
| SA8 RA5/U2（同步宿主 pipe 边界 + append-only） | §1 非目标 + §7 D3 + §13 R8 | 覆盖 |
| S2/R4''（跨缝 pending 有界 + 顺序保真） | §7 D7（每 ns ≤16 + 单帧 ≤ maxFrameBytes + 溢出 `CONNECTION_POLICY_VIOLATION`(1008)） | 覆盖且码值/映射本轮核实（`wsCloseCodeFor` :101-105 对该码 1008；`MAX_EARLY_FRAMES=16` 先例 `hub-connection.ts:54` 亲读）；iteration 1 把窗口承载面显式扩为「routing 相位期间全部 ns 域帧（含在途 OPEN）」——有界性语义闭合 |
| S4/决策 5 dormant 面 | §7 D5（17 成员映射） | 逐项与 `hub-split.ts:54-99` 对齐（本轮 17 成员逐一清点，D5 表 17 行全覆盖）；`dispatchReplicationObserver(undefined,…)` 安全（observer.ts:36）；通道 `connectionState` 读取仅判 `==='closed'`（`hub-session.ts:211/:251` 亲读） |
| S5/S6（index-only / append-only） | §11 + §7 D1/§13 R1 | 覆盖 |
| #418 R2 票内 DENY（已闭合） | §6 引用 SA8 行 27 | 处理正确，不构成阻断 |

## 6. 设计内部一致性

| 检查点 | 结论 |
| --- | --- |
| iteration 1 修订的全文联动 | §5 承接表 SA2-F1 行、§7 D6 资源账补句、§7 D7 相位表 + 代理路由表 + 路由续体、§8.1 桥路由相位、§8.2 R3b 数据流、§9 E4/E5/E8 更新 + E10 新增、§10 hub-edge 行「全覆盖，无缺失分支」、§12 AC3 行 + SA2-F1 验收行、§13 R11/R12、§14 修订映射——**九处联动口径一致**，无「附录承认但正文未改」的伪修订形态 ✓ |
| D7 相位表 vs D1 前置 throw vs E5 | 一致：相位互斥单调 + 再 OPEN 不重入路由 ⇒ 桥结构性不触发重复 `open()`；E5 throw 面仅剩宿主直接违例 ✓ |
| D7 路由续体 vs B3/B4 源码时序 | 一致：首 OPEN → 真台账（`beginAdmission` 同步先于投递）→ 桥拉 `realPort.openAdmission`（promise 多播安全，`admissions` 只写不删 + `cleanupAll` 注释「台账不摘除」本轮亲读）→ authorized 续体（open/注册/转发/冲刷同同步段）/ denied 续体（denialSink 投递 + 冲刷）✓ |
| W1 修正读法贯穿（§5/§7 D2/§12 A8）+ OPEN 中继序例外登记 | 三处一致；例外（OPEN 中继序 = 合成 0）与 C5a「非 OPEN 缝入帧序列非 0」反空跑判据相容 ✓ |
| B1–B16 事实锚 | 本轮全量/抽样核对均与源码吻合（重点 B3/B4/B5/B6/B13/B14/B15/B16 行号级；B10/B11 grep 复核证实） |
| §12 断言矩阵 vs SA6 §12 | A1–A12/C4a–d/C5a–d/M1–M7 全承接；M7 为 iteration 1 新增（= iteration 0 缺陷本身作变异正控），映射成立 ✓ |
| 死引用/旧 API | 未发现；本轮复核 `hub-connection.ts` sessionFactory 调用点 :449、`createEdge` 组合序 :427-463、frame-io/:emitOne、contract/structure 锚行号全部命中 |
| §14 修订映射 vs iteration 0 Required revisions | SA2-F1 required change 三项（①句柄在场不重开/②在途入窗冲刷/③denied 投递明示）+ D6 资源账补句 + §12 AC3 登记——**逐条采纳且落位真实**；N1–N6 处置如实（采纳 3 项、维持登记 3 项）✓ |

## 7. 状态机与并发攻击

iteration 1 的攻击重心 = 修订引入的**路由相位状态机**本身。以下全部用例本轮逐一推演（初始态/触发/期望/设计文本落点）：

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
| --- | --- | --- | --- | --- | --- |
| SM1（= iteration 0 SA2-F1 主案） | authorized ns 已有句柄 | 同连接同 ns 再 OPEN（`ac1-ac2 :245` 实测驱动） | 经既有句柄 `handleFrame(encode(msg,{sequence:0}))` → 零 diff 通道 `onOpen` 终态分支 → `NAMESPACE_REOPEN_REQUIRES_RECONNECT`；不再调 `open()` | 无（D7 分支 ①；本轮源码重放确认） | — |
| SM1b | authorized 路由在途（首 OPEN 已入桥、admission 未结算） | 同 ns 第二 OPEN（`ac1-ac2 :231` 实测驱动） | 入与 `namespaceFrame` 同一有界 pending 窗口（按到达序）；authorized 续体完成 `open()`+注册+首 OPEN 转发后**同步**冲刷 → 通道必仍处 'opening'（authorize shim 经 `Promise.resolve().then` 悬停）→ `openWaiters` 合流 → `flushOpenWaitersOk` 按 waiter 数再答 ⇒ `OPEN_OK`×2 + authorize 恰一次 | 无（D7 分支 ② + 路由续体；本轮对 `flushOpenWaitersOk` :474-481 与 `startOpen` :340-346 悬停点亲验） | — |
| SM1c | denied 结算在途（routing 相位，结局将为 denied） | 同 ns 再 OPEN（无矩阵用例，设计主张「与 listen 逐字节一致」覆盖） | pending 冲刷于 `denialSink.openNamespace(首 OPEN)` 之后**同一同步段**——denialSink 通道的 authorize 拉取悬停于微任务 ⇒ 冲刷命中 'opening' → waiter 合流 → `finishOpenError` 按 waiter 数发 `NAMESPACE_UNAUTHORIZED`（与 listen 下「再 OPEN 于 denied 结算前到达」同形同量） | 无（结构由「同步冲刷」纪律承载；见 §14 N2' 建议显式化为不变量） | — |
| SM2 | admission 在途 | 该 ns 后续非 OPEN 帧 | 有界 pending → 续体内按序冲刷（authorized → `handleFrame` wire 序透传；denied → `denialSink.namespaceFrame`） | 无 | — |
| SM3 | 相位任意 | 桥 `close()`（edge `requestSinkClose` 单点，`hub-edge.ts:201-204` 幂等） | closed 标志 + fan-out 全句柄 + denialSink；在途 routing 续体完成时放弃（不 `open()`、不投递、丢弃 pending）——与 listen「opening 通道被 quiesce 零 wire 输出」同构 | 无 | — |
| SM4 | 句柄任意态 | `close()`/`terminateUnauthorized()` 重复调用 | 幂等（closeTail 单 promise `hub-session.ts:269-275`；terminate 无通道 resolve `:278-282` 本轮亲读） | 无 | — |
| SM5 | 已注册 frame listener | 再注册/退订 | 后注册者替换、退订置空（SA6 冻结语义） | 无 | — |
| SM6 | 句柄 open | `handleFrame` 不可解码字节 | `connection-fatal{code}` fail-loud（`err.code ?? 'MALFORMED_FRAME'`，与 edge `onMessage` :384-387 先例同判据） | 无 | — |
| SM7 | pending 窗口将满 | 第 17 帧或超限帧 | `CONNECTION_POLICY_VIOLATION`(1008) 响亮收口（码/映射本轮核实） | 无（E4） | — |
| SM8 | 句柄 open、通道终态 | 迟到 ns 帧继续入站 | 零 diff 通道 quiet/terminal 守卫吸收（`isQuietState` = closing/closed/conflicted/failed 本轮亲读 :1742-1748；守卫遍布 onUpdateAck/onCloseRequest 等族） | 无 | — |
| SM9 | 连接收口中 | edge `requestSinkClose` → 桥 `close()` fan-out | 无循环等待：句柄 close → 通道 quiesce；出站经 closed 投影/edge `closedFlag` 双闸返 0 | 无 | — |
| SM10 | 同连接多 ns / 多连接 | 并发 `open()` 不同 ns / 不同 connectionKey | 键含 namespaceId/connectionKey 互不影响；各 ns 路由相位独立、续体同步段原子（JS 单线程）⇒ 无竞态 | 无（E8） | — |
| SM11 | 通道终态 | `settled` 信号 | 恰一次（通道单调性；edge `settledNames` 单调 + `maybeFinishDrainEarly` 只读台账本轮亲验 :686-710） | 无 | — |
| SM12（iteration 0 遗留明示项） | denied ns 已有 denialSink 通道 | 再 OPEN | `denialSink.openNamespace` → 通道在场 → `onOpen` 终态分支 → `NAMESPACE_REOPEN_REQUIRES_RECONNECT`（与 listen 同构） | 无（D7 分支 ③ 本轮明示 + 源码重放） | — |
| SM13 | 相位 `routing` | `terminateNamespace(ns)`（revoke 链） | 挂起至路由完成再按结局投递；listen 下 'opening' 非 quiet → 立即 ns ERROR + failed（`terminateUnauthorized` :1186-1193 本轮亲验，`isQuietState` 不含 'opening'）——wire 时序相对 listen 可能偏移 | 无阻断（R11 已登记观测边界；7 矩阵零 revoke 用例本轮 grep 复核、A10 为 live 后直调） | — |
| SM14 | 相位 `routing` + 桥已 closed | 迟归 admission 结算 | 续体放弃路由；**挂起中的 terminateNamespace promise 的归宿未在 D7 close 行明示**（close 行只列「不 open()/不投递/丢弃 pending」） | 文本完备性小缺口（非正确性：无验收路径触达；listen 同构语义 = quiet no-op resolve） | §14 N1'（登记，不阻断） |

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
| --- | --- | --- | --- | --- |
| ER1 | `onFrame` listener 缺席/返回 0 | adapterPort 返 0 → 通道既有响亮失败（bootstrap ACK→`ACK_STATE_VIOLATION`；live→`send-frame-rejected` resync）——A12 红臂依赖该可达性 | 无 | — |
| ER2 | listener 同步 throw | 原样同步传播（与 `OutboundExhaustedError` 契约同形，`frame-io.ts:181-184` 本轮亲验 throw 形态） | 无 | — |
| ER3 | `onSignal`/observer 监听者 throw | 隔离（`dispatchReplicationObserver` 单点 try/catch；信号分发同款包裹） | 无 | — |
| ER4 | `handleFrame` 解码失败 | connection-fatal（注册表 code） | 无 | — |
| ER5 | 桥 pending 溢出 | 1008 响亮收口（既有码/映射） | 无 | — |
| ER6 | `open()` 前置违反（宿主直接违例） | 同步 throw（SA6 §12.1 授权「可自行选择响亮拒绝」） | 无（iteration 1 起桥结构性避开：三分支均不重入 `open()`；验收锚 = `sessionsOpened` 每 (连接,ns) 恰 1） | — |
| ER7（= iteration 0 SA2-F1 故障面） | authorized 路由续体内 throw | **已闭合**：E10 续体整段 try/catch → `realPort.connectionFatal('INTERNAL_ERROR', 1011)`；本轮核实 `makePort.connectionFatal(code, wsCloseCode ?? 1002)` 显式传参优先 ⇒ 1011 与协议 §13 映射一致；验收锚 = 同 run `collectUnhandledRejections()` 空（ac4 :173 既有哨兵同款） | 无 | — |
| ER8 | admission `throw` 结局 | denialSink 拉取 → shim reject → `finishOpenError('INTERNAL_ERROR')`（`hub-namespace.ts:347-350` 本轮亲验 catch 路径） | 无 | — |
| ER9 | 续体内描述子构造/编码异常（宿主契约外） | E10 兜底 1011 收口（`INTERNAL_ERROR` §13 在册 + `wsCloseCodeFor` 默认 1002 被显式 1011 覆盖——正确） | 无 | — |
| ER10 | closed edge 上续体结算 | closed 守卫放弃（零可观察输出）；`realPort.connectionFatal` 在 `closedFlag` 已置时早退（`hub-edge.ts:620`）⇒ E10 兜底亦无害 | 无 | — |

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
| --- | --- | --- | --- |
| `sink.openNamespace`（edge→桥代理）——iteration 0 的缺口面 | **无**：三分支路由覆盖 edge 的全部投递形态（首 OPEN / 台账命中再 OPEN / 在途），每分支的承载机械与源码行为逐点对齐（本轮 §7 SM1/SM1b/SM1c 重放） | `hub-edge.ts:321-328`；`hub-session.ts:84-94/:115-121`；`hub-namespace.ts:289-331` | — |
| `sink.namespaceFrame`（edge→桥代理） | 无：相位路由三分支（authorized → `handleFrame` wire 序透传；routing → pending；denied → denialSink）；denied 冲刷的 OPEN 条目经真实分派壳 `case 'OPEN_NAMESPACE'` 落 `openNamespace`（`hub-session.ts:117-121` 本轮亲验该防御分支存在且行为正确） | `hub-session.ts:115-121` | — |
| `index.ts` 追加导出（11→12 值 + 7 类型） | 无：append-only；`sort()` 全等断言形态兼容（:551-552 本轮亲读）；plugin.ts/nomic-server 消费既有 11 名零变化 | contract test :144-156/:551 | — |
| `createHubSessionHost`→`createHubSessionSink` 重命名 | 无：调用面封闭（`hub-connection.ts:18/:449` + structure test 锚行号本轮逐一命中） | D9 表 | — |
| `HubReplicationEdgeConfig`（fixture 以 `sessionFactory` 消费） | 无：fixture 供齐全部必填成员（本轮比对 `hub-edge.ts:56-78` 配置面逐项）；`remoteInstanceId` 闭包捕获于构造前身份（`hub-edge.ts:173` 构造序约束被正确遵守——sessionFactory 在构造段内调用，桥不可引用构造中的 edge） | `hub-edge.ts:56-78/:173` | — |
| 矩阵文件（7 个）零改动 | 无：grep 复核零 `createHub`/`run.hub.`/revoke 引用；driver 默认 `opts.createHub ?? createHubReplication` 吃 mock；ac7 值导入经 `...actual` 保真 | 本轮 grep；D8 | — |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
| --- | --- | --- | --- |
| 协议 FSM（含重开矩阵） | `hub-namespace.ts`（零 diff） | DENY 硬门 + §8.1「重开矩阵唯一在通道内」重申 | ✓（修订后桥仍零协议决策——三分支只选「字节进哪份既有机械」，D6 论证 2 不变） |
| 连接级纪律 | 真 edge | 桥用 `createHubReplicationEdge` | ✓ |
| authorize 唯一真实调用点 | edge 台账 | 桥只按结局路由；`beginAdmission` 恰一次（首 OPEN 台账首建） | ✓（再 OPEN 零二次授权——台账命中不重入 `beginAdmission`，`hub-edge.ts:324` 条件亲验） |
| wire 行为（拒绝帧/错误码） | 生产代码 | denialSink 承载 | ✓ |
| 路由相位（装配状态） | 桥（test 夹具） | D7 相位表 | ✓ 归属正确：非协议 FSM，仅夹具内装配路由；§8.1 明示「非协议态」 |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
| --- | --- | --- | --- | --- |
| session 半边组装 | 内部 splice | 内部复用（两种 port 形态） | 一致 | 单份组装 |
| 早到/在途有界缓冲 | `installEarlyFrameAdmission` + `MAX_EARLY_FRAMES=16`（`hub-connection.ts:54` 亲读） | 桥 pending 镜像同界 + 溢出同族收口（1008） | 一致（test-only 镜像） | 结构必然 + 同码同界 |
| 拒绝路径承载 | `hub-namespace.ts:346-376` 生产通道 | denialSink（生产 sink 直连真 port） | 一致 | 分布式实例化（ADR 决策 1 明文允许） |
| observer 隔离/时钟折叠 | `dispatchReplicationObserver`/`safeNow` | 单点复用 | 一致 | — |
| 字节缝公共工厂 | 无先例（G1/G2） | 新模块 | —（登记：未找到可比面，设计未凭空声称惯例） | — |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
| --- | --- | --- | --- |
| admission 结局 | edge 台账（只写不删） | 描述子投影（authorized 臂不可变快照）；再 OPEN 不读投影 | 低 |
| 通道表 | 各 sink 的 `channels`（公共/拒绝互斥命名空间，D6 资源账） | edge `.channels` 只读投影（shim 下仅拒绝侧，R7 登记） | 低 |
| 路由相位 | 桥内 per-(connectionKey, ns) 单份 | 无第二份 | 低（互斥单调不可逆 + closed 守卫单一放弃点） |
| wire 序分配 | edge OutboundQueue mux | 无（session 占位 0） | 低 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
| --- | --- | --- | --- |
| 首 OPEN → routing 相位 | authorized → 句柄（随连接存活）/ denied → denialSink 通道 | E10 1011 收口；closed 守卫放弃 | ✓ 对称 |
| `open()` 同步建句柄 | `close()` 幂等单 promise | connection-fatal → closed 投影 + 出站 0 | ✓ |
| `onFrame`/`onSignal` 注册 | 退订函数 | 监听者 throw 隔离 | ✓ |
| 桥 per-connection | edge requestSinkClose → fan-out（幂等单点 `hub-edge.ts:201-204`） | dropConnection 回调 | ✓（A11 drain 锚） |

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
| --- | --- | --- | --- |
| 第二 FSM / 第二错误码表 / 第二 codec 语义 | — | 无（三分支 = 装配路由，非协议决策；中继经 E3 保真） | ✓ |
| 桥 accept 门链 | `hub-connection.ts` accept | test 夹具镜像 | 允许（test-only + 结构必然；差异清单已按 N1 采纳登记于夹具头注 + R12） |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
| --- | --- | --- |
| ALLOW LIST 13 条 vs SA6 §10 交付面 + RA1 docs | 逐条对齐；额外项 = `hub-split.ts`（仅头注，N2 已采纳交付说明单列）+ docs/CONTEXT（RA1 授权）；iteration 1 明示「SA2-F1 修订不改变文件范围」——三分支路由落既有夹具文件内，无新增路径 | 无 |
| DENY：`hub-namespace.ts` 逐字节零 diff / `hub-edge.ts` 零改动 | AC3 硬门 + R8''；D6 备选 (i') 否决维持 | ✓ |
| DENY：矩阵 7 文件 + `src/testing.ts` + 协议文本 + 上游包 + `package.json` | S5/SA8 §5 冻结面 | ✓ |
| `vitest.config.ts` 不在 ALLOW（机制 (b) 仅 R3 退路，需 Controller 批准） | D8/R3 | ✓ 收敛良好 |
| follow-up 未掩盖必要项 | §13：任务内必要条件含 D1–D10 全部 + ALLOW LIST 全部 + RA1 附录；服务轨/peer/真 worker/跨进程 revoke/nomic-server 列 follow-up | ✓ |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
| --- | --- | --- | --- |
| AC1 | test-d 正控全集 + 负控 `@ts-expect-error` 四项（TS2578 自证）+ C5a 插入行 | 无 | — |
| AC2 | A1–A12 运行时断言（A12 红臂断言绿/回合红；A4 含 W2 修正负控；A8 含 W1 修正读法） | 无 | — |
| AC3 | 机制 (a) + 反空跑（计数阈值 + 非 OPEN 缝入序非 0）+ M4 负控 + `hub-namespace.ts` 零 diff；**iteration 1 补**：`:231/:245` 两用例 shim 臂断言逐字不变执行 + 同 run `collectUnhandledRejections()` 空 | 无（本轮判定两用例在修订路由下可绿，见 §7 SM1/SM1b 重放；ac4 :121-173 已示范哨兵采集面，机制可复制） | — |
| AC4 | C4a 结构门保持 + C4b/c/d 行为断言 | 无 | — |
| AC5 | C5a 主判据 + C5b 负控 + C5c 结构门 + C5d/M5 | 无（R5 注入时序已登记） | — |
| M1–M7 变异 | 逐条映射 + 交付说明登记实跑；**M7 = iteration 0 缺陷本身**（退化必使 `:231/:245` shim 臂红 + unhandled rejection 非空）——变异正控对修订点敏感性成立 | 无 | — |
| **SA2-F1 验收行（新增）** | 主判据 = AC3 shim 臂原生承载；可选直接臂 = 门闩下注入第二 OPEN（routing 入窗→冲刷→`OPEN_OK`×2）+ conflicted 后再 OPEN（authorized 转发→REOPEN 错）；负向不变量 = 零 unhandled rejection + `sessionsOpened` 每 (连接,ns) 恰 1 + `reopenForwarded`/`pendingFlushed` 探针计数吻合 | 无 | — |
| D6 拒绝路径 | deny/readDeny/submitDeny 经矩阵 shim 臂重跑原生覆盖 + W2 修正负控 | 无 | — |
| RA1 文本 | 附录 + 词条 diff 与实现同变更集 | 无（impl 复查核对） | — |

## 13. Required revisions

无。iteration 0 的 SA2-F1（MAJOR）经本轮独立攻击验证**已解决并从阻断清单移除**（稳定 ID 保留于 §6/§14 修订映射，不再列为阻断项）：

| Finding ID | Severity | Evidence | Problem | Required change | Acceptance |
| --- | --- | --- | --- | --- | --- |
| ~~SA2-F1~~（已解决） | ~~MAJOR~~ | 修订核验 = 本文件 §2/§7 SM1/SM1b/SM1c/§8 ER7/§12；源码锚 = `hub-edge.ts:318-328`、`hub-session.ts:84-94/:115-121`、`hub-namespace.ts:289-331/:474-488`、`ac1-ac2 :212-250` | ~~桥 `openNamespace` 缺再 OPEN/在途分支~~ | 已按 iteration 0 要求三项全采（§14 修订映射与设计正文一致，无伪修订） | `:231`/`:245` shim 臂断言逐字不变绿（`OPEN_OK`×2 / `NAMESPACE_REOPEN_REQUIRES_RECONNECT`）+ 同 run 零 unhandled rejection + C5a/结构测试不受影响——**判定为设计上可达**（实现落地由 SA3/SA4/SA7 承接验证） |

## 14. Non-blocking observations

| # | 观察 | 依据 | 建议 |
| --- | --- | --- | --- |
| N1' | D7 `close()` 行的 closed 守卫列明「不 `open()`、不投递 denialSink、丢弃 pending 窗口」，但未明示**相位 `routing` 下挂起中的 `terminateNamespace` promise 的归宿**（listen 同构语义 = quiet 态 no-op resolve）。字面实现存在把 `revoke()` 挂起为永诺的读法。无验收路径触达（7 矩阵零 revoke 用例本轮 grep 复核；A10 为 live 后直调；R11 已登记同族时序边界） | `hub-connection.ts` revoke 链 → `hub-edge.ts:300-302` 无条件 `sink.terminateNamespace` → 桥相位 routing 挂起；`hub-session.ts:278-282` no-op resolve 先例 | 实现时补一句：closed 守卫放弃在途路由时，同 ns 挂起的 terminate 以 no-op resolve 收口（镜像 listen quiet 语义）；可在夹具头注登记 |
| N2' | 分支 ② 的承重不变量是**隐式**的：「pending 冲刷必须在路由续体的同一同步段内完成」——这保证在途 OPEN（含 denied 臂）必然命中仍处 'opening' 的通道、经 `openWaiters` 合流，与 listen 的在途合流逐字节一致。设计已写「同步冲刷」，但未把「冲刷不得移入 await 之后」陈述为不变量；实现者若把冲刷挪入微任务，denied 臂的在途再 OPEN 会从 `NAMESPACE_UNAUTHORIZED`（waiter 合流）漂移为 `NAMESPACE_REOPEN_REQUIRES_RECONNECT`（终态分支）——恰是设计声称「与 listen 逐字节一致」的唯一破坏面 | 本轮 §7 SM1c 推演：`flushOpenWaitersOk` :474-481 vs `finishOpenError` :483-488 的按-waiter-计数 差异；`startOpen` authorize 拉取悬停点 `hub-namespace.ts:346` | 在 D7 ② 或夹具头注显式登记该不变量（一句：「冲刷于续体同步段内完成 ⇒ 在途 OPEN 必经 openWaiters 合流」）；M7 之外可加变异 M8（冲刷挪后一微任务 → denied 臂直接断言红）作为可选敏感性 |
| N3' | §7 D1 内部结构行的 Map 键模板串有排版笔误：`` Map<`${connectionKey}\u0000${namespaceId` `` 缺第二个插值的右花括号（应为 `${namespaceId}`） | 设计 :188 | 实现时按语义落（键 = connectionKey + U+0000 + namespaceId）；纯文字修正，不影响判读 |
| N1–N6（iteration 0 遗留） | 全部处置如实：N1（accept 门链差异清单）→ 夹具头注 + R12 采纳；N2（hub-split.ts 交付说明单列）采纳；N3（connectionState 两态投影头注）采纳；N4（W2 流程义务）→ SA8 RA4' 已确认、悬置消除；N5/N6 维持登记 | 设计 §14 | 无进一步动作 |

---

**结论**：`approve`。iteration 1 设计（含 SA2-F1 三分支路由修订、路由相位状态、E10 容错、closed 在途守卫、terminateNamespace 相位挂起）在其声明的全部边界——公共冻结签名逐字采用 SA6 §12.1、`hub-namespace.ts`/`hub-edge.ts` 零 diff 硬门、D6/U3 裁决、RA1 文本线、验收矩阵（含再 OPEN 两用例 shim 臂原生覆盖与 M7 变异）——具备安全实施条件。修订不触任何 SA8 决策面（公共签名/DENY 面/port 成员集/U3 方向/RA1 要素均原样），SA8 design 复查（clear）结论不受影响，implementation 段复查维持设计 §15 既有武装。`pass` 仅代表设计通过审查；实现与活链路验证归 SA3/SA4/SA7。
