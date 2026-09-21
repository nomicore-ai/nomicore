# SA10 Spec 审查报告 — Issue #420（SessionHost 公共工厂 + 内存管道完整协议回合，spec #415 T3）

> SA10（独立 Spec 审查者）spec-review 轮产物。dispatch `sa-d91f8fb1-4463-49a3-a323-f17a78a0455b`，
> role `mabf-sa10`，phase spec-review，iteration 0。
> **被审对象**：commit `a315e7077576951cf0330596cdc588afbeca51be`（= 当前 HEAD，本轮 `git rev-parse HEAD`
> 亲证一致；branch `mabf/issue-420`）的完整交付 diff（52 文件，+6898/−24：13 个 ALLOW 路径的代码/测试/
> 文档改动 + SA2/SA3/SA4/SA6/SA7/SA8 过程产物与证据日志）。
> **Issue 评论输入**：派工明示 Owner feedback requirements = none；REST Issue comments = `[]`（任务简报
> `wiki/raw/task_issue-420.md` Comments 节为空）⇒ 无逐条 Owner 评论映射面。
> **输入产物（全部亲读）**：Issue #420 正文（AC1–AC5、Blocked by #418）、`task_issue-420_sa6_contract.md`
> （冻结验收契约 §12.1–§12.7）、`task_issue-420_design.md`（iteration 1，D1–D10 + ALLOW/DENY + §12 验收映射）、
> `task_issue-420_sa2_review.md`（approve）、`task_issue-420_sa3_impl.md`（V1–V16 + Deviations 1–4）、
> `task_issue-420_sa4_review.md`（approve，O1–O7）、`task_issue-420_sa7_report.md`（approve，P1–P3 探针）、
> `task_issue-420_conflict_report.md` / `_design_conflict_report.md` / `_implementation_conflict_report.md`
> （SA8 三段全 clear，impl 段 `requiresConflictRecheck: false`）、`task_issue-420_relevant_decisions.md`、
> 规范面（ADR 0032 全文 + 本票附录、CONTEXT.md:225-235、`docs/protocols/instance-replication-v1.md` 相关节、
> `packages/ws-replication/AGENTS.md`、`docs/AGENTS.md`）。
> **独立核验方式（本轮全部亲读/亲跑只读命令，非转述）**：被审 commit 的全量 `git show` diff 亲读；
> 冻结签名逐字段比对（`src/hub-session-host.ts` 全文 263 行 vs SA6 §12.1 逐字声明）；三个新测试文件 +
> 夹具（740 行）全文亲读；DENY 面 `git diff 7039f6d..a315e70 --stat`（20+ 路径含 7 矩阵文件/协议文本/上游包）
> **本轮自跑为空**；AC4 结构门 `grep worker_threads|MessageChannel|MessagePort`（`src/**`+`package.json`）
> **本轮自跑 0 命中**；AC5 结构门 `grep expectedSequence src/hub-session-host.ts` **本轮自跑 0 命中**；
> 新测试文件零 `.skip/.only/.todo`（本轮自跑 grep）；#418 两处授权编辑逐 hunk 亲读；提交内绿/红证据日志
> 尾段亲验（63/63、80 files/651 tests、443 files/5381 tests、tsc/typecheck exit 0）；未提交变异日志
> （M2/M3/M4/M5/M7/M7b）抽查失败计数与报告一致。
> **边界**：零代码/设计/测试/文档改动；未运行测试、未启动服务；零 commit/push/PR；唯一写入 = 本文件。

---

## Verdict

**approve**（`requiresConflictRecheck: false`）。

**核心理由**：Issue #420 的五条 AC 逐项核验全部满足（§1–§5），无遗漏、无部分实现、无错误实现、无实质
scope creep（§6）。冻结契约（SA6 §12.1 公共签名、§12.2 A1–A12、§12.3 AC3 机制 (a)、§12.4/§12.5 判据、
§12.6 两处授权编辑）逐字落地并经本轮独立取证复核；规范面（ADR 0032 决策 1–5、CONTEXT.md 词条、协议 v1
§4/§7.1/§13/§14/§17/§19/§23.1）零违约，E1/E2 两条 evolution-required 修订线以澄清附录在本变更集闭合
（docs/AGENTS.md 显式修订纪律满足）。SA3 登记的设计字面偏差（载体提交）与反空跑锚替换均经 SA8
implementation 复查裁决为 implements-existing-decision / no-conflict，并有 SA7 A/B 逐字节相等动态证据
（19/19，3× 一致）——不构成 spec 偏离，但按「PR 必须披露」纪律列入 §7 披露清单。残余事项全部为已登记的
非目标/跨票义务/MINOR 内务（§7），不阻断 approve。

---

## 1. AC1 — SessionHost 工厂从包公共入口导出，签名经 test-d 锁定（SA6 冻结纪律）：**满足**

| 核验点 | 本轮独立取证 | 判定 |
| --- | --- | --- |
| 公共入口导出 | `src/index.ts` diff：恰 +1 值导出 `createHubSessionHost`（插入 `createHubReplicationPlugin` 与 `createPeerReplication` 之间，字母序保持）+ 7 类型导出（`HubSessionFrameLane/FrameListener/Handle/Host/HostConfig/OpenInput/Signal`）；既有 11 名零删除零重排（append-only，ADR 0032 后果节 + S6） | ✅ |
| 冻结签名逐字 | `src/hub-session-host.ts:43-89,260-263` 与 SA6 §12.1 冻结声明**逐字段一致**（本轮逐成员比对）：config 7 成员（registry/instanceId/limits/timeouts/timer/observer?/clock?）；描述子 6 字段（connectionKey/remoteInstanceId/namespaceId/authorization=`Extract<NamespaceAuthorization,{ok:true}>`/selectedCapabilities/connectionId?）；`HubSessionFrameLane='control'\|'data'`；listener `(Uint8Array, lane) => number`；信号联合两态；句柄 5 方法（handleFrame/onFrame/onSignal/terminateUnauthorized/close）；`open` 同步返回句柄 | ✅ |
| test-d 锁定 | `test/ws-replication-issue420-session-host-api.test-d.ts`（131 行）：正控全集（工厂参数/返回、`open` 参数/返回、各句柄成员签名、`authorization` 精确 `toEqualTypeOf<Extract<…,{ok:true}>>`、`connectionId: string\|undefined`、listener 返回 `number`）+ **6 项 `@ts-expect-error` 负控**（denied 投影 / 配置掺 authorize / transport / port / 句柄 `namespaceFrame` 面 / `onFrame(()=>undefined)`）——超过 SA6 §12.1 四项下限，无弱化；负控敏感性由 TS2578 机制自证（未触发即红） | ✅ |
| 运行时导出面恰增一名 | §12.6 授权编辑 1：#418 contract 测试 `FROZEN_PRODUCTION_EXPORTS` **仅插 1 行** `'createHubSessionHost'`（字母序、零删除零重排，diff 亲读）；`:551` 全等断言形态不变 | ✅ |
| 红→绿证据 | 提交内 `sa3-issue420-red-package-tsc.log`（8×TS2305+TS2307，`[tsc exit: 2]`，红因=能力缺口，与 SA6 type-lock-red 同形）→ `sa3-issue420-green-contract.log`（**3 files/63 tests/Type Errors no errors/exit 0**，含 `TS …api.test-d.ts` 行=test-d 被 `--typecheck` 发现）+ `sa3-issue420-package-tsc.log`（`[tsc exit: 0]`） | ✅ |

## 2. AC2 — 内存管道对驱动 OPEN→bootstrap→live update→reconcile→CLOSE 完整回合：**满足**

| 核验点 | 本轮独立取证 | 判定 |
| --- | --- | --- |
| 装配形态（无 socket 无 worker） | `test/issue420-shim-hub.ts` + round 测试：真 peer ↔ `makeWire()` 内存双端 ↔ 真 `createHubReplicationEdge` + 宿主桥 + 公共 `createHubSessionHost` + 真 Registry/Runtime；夹具只深路径 import（mock 安全） | ✅ |
| OPEN 段（A4） | round 测试 `:173-179`：wire 恰一 `OPEN_OK` + `run.authorizer.calls` 恰一次（edge 侧）+ `sessionsOpened===1`；A4-W2 负控（`:254-296`）：ok-投影 localOwner 不符 → 零 OPEN_OK + `NAMESPACE_NOT_FOUND` + 注册表零成功打开 + authorize 恰一次 | ✅ |
| bootstrap 段（A5） | `:181-189`：`BOOTSTRAP_SNAPSHOT` 恰一 + `BOOTSTRAP_ACK(ackedSequence=快照帧 wire 序)` + 通道达 `reconciling`（序回传承重锚） | ✅ |
| reconcile 段（A6） | `:191-199`：`SYNC_STEP1/2/SYNC_APPLIED` 齐备 + 双方 `live` + `encodeStateAsUpdate` 双向收敛 | ✅ |
| live update 段（A7） | `:201-222`：peer→hub UPDATE 落盘 + `UPDATE_ACK` 回指入站 wire 序；hub 真实写 → UPDATE 出帧 + peer ACK 结算（`update-acked` 在场、零 `resync-required`） | ✅ |
| CLOSE 段（A9） | `:298-322`：`CLOSE_OK(ackedSequence=入站 wire 序)` + `settled` 信号恰一次经 `onSignal` 转发 + 通道终态 + 零 fatal | ✅ |
| 序纪律（A8） | `:224-251`：wire 两方向自 1 严格 +1、无 0 占位泄漏；出站缝帧恒占位 0、入站非 OPEN 帧携带 wire 序逐帧回指 wire 原帧；OPEN 中继序 = 桥合成 0（SA6 E3 登记例外，协议无消费者） | ✅ |
| revoke/drain（A10/A11） | `:324-359`：`terminateUnauthorized()` → 双方终态零 fatal；`close()` 幂等同一 promise + resolve + 1001 + 零残留 timer 出帧 + 零 unhandled rejection | ✅ |
| 红臂（A12 = M1 内建） | `:361-381`：宿主强制 0 回传 → 断言绿（`ACK_STATE_VIOLATION` + `close(1002,'protocol-error')` + onSignal 命中）/ 回合红（不可达 live）——证明 A5/A7 对「无回传」敏感 | ✅ |
| 绿证据 | 提交内 `sa3-issue420-green-contract.log`：round 测试 **10/10 绿**；SA7 聚焦复跑 63/63（`sa7-issue420-focused-420-tests.log`，worktree 在案） | ✅ |

## 3. AC3 — 现有 hub-namespace 测试矩阵在 shim 上重跑绿灯（通道零改动 + 状态机零 fork）：**满足**

| 核验点 | 本轮独立取证 | 判定 |
| --- | --- | --- |
| 同一断言体 shim 重跑 | `test/ws-replication-issue420-shim-matrix.test.ts`（机制 (a)，SA6 §12.3 推荐）：`vi.mock('@nomicore/ws-replication')` **仅替换 `createHubReplication`**（`...actual` 展开真面，ac7 的 `createPeerReplication` 值导入保真）+ 顶部动态 import **7 个矩阵文件**（ac1-ac2-open/ac3-bootstrap/ac4-reconcile/ac5-live/ac6-resync-close/ac7-faults/periodic-reconcile）——断言体零编辑 | ✅ |
| 矩阵文件零编辑 | 本轮 `git diff 7039f6d..a315e70 --stat -- <7 矩阵文件>` **为空**（亲跑） | ✅ |
| 通道零改动 | `hub-namespace.ts` **零 diff**（本轮 DENY 全表 `git diff --stat` 为空，含 `hub-edge.ts`/`src/testing.ts`/`package.json`/协议文本/上游包/apps/domains） | ✅ |
| 状态机零 fork | 夹具亲读：无应答合成、无错误码选择、无 FSM（唯一装配状态 = 路由相位表，头注明示非协议 FSM）；唯一变换 = `encodeMessage` 消息↔字节中继（SA6 E3 证逐字节保真）+ port 成员搬运；违例/拒绝应答全部由零 diff 通道产出（SA8 impl 行 11 源码亲验 `hub-namespace.ts:839-849`）；denialSink = 生产 splice 直连真 port | ✅ |
| 重跑计数自洽 | SA6 基线 `sa6-issue420-baseline-matrix.log` = 7 files/52 tests（listen）；提交内 `sa3-issue420-green-contract.log`：shim-matrix **53 tests**（52 矩阵用例 + 1 反空跑）；`sa3-issue420-package-suite.log`：**80 files/651 tests/exit 0**（= 基线 77/588 + 3 文件/+63：round 10 + shim 52 + 反空跑 1 + test-d 0 运行时）——listen 臂 52 用例断言逐字不变保持绿 | ✅ |
| 反空跑（非恒真） | 末位反空跑 describe：计数阈值（connectionsOpened≥2/sessionsOpened≥2/缝双向各≥20 帧/非 OPEN 入缝序非 0/denialRouted≥1/reopenForwarded≥1/pendingFlushed≥1/pendingOverflow===0/carrierCommitted≥1）+ `settled≥1` + 全 run 零 `INTERNAL_ERROR` + afterAll 零 unhandled rejection；**M4 变异负控**（关 shim → 恰反空跑 1 红、52 listen 仍绿，`sa3-issue420-mutation-M4-disable-shim.log` 在案）证明判据非恒真 | ✅ |
| SA2-F1 再 OPEN 覆盖 | 矩阵 `ac1-ac2-open` 的 opening-重复-OPEN（OPEN_OK×2 + authorize 恰一次）与 conflicted-再 OPEN（`NAMESPACE_REOPEN_REQUIRES_RECONNECT`）两用例在 shim 臂断言逐字不变绿；M7/M7b 变异分别使其转红（日志在案） | ✅ |

## 4. AC4 — 缝两侧只过 Uint8Array 与纯 JSON；包内零 worker_threads/MessageChannel/MessagePort 依赖或类型：**满足**

| 判据 | 本轮独立取证 | 判定 |
| --- | --- | --- |
| C4a 结构门 | **本轮自跑** `grep -rnE 'worker_threads\|MessageChannel\|MessagePort' packages/ws-replication/src packages/ws-replication/package.json` = **0 命中**（exit 1）；round 测试 `:445-457` 以单一模式常量 + `node:fs` 在测试内复锁该门 | ✅ |
| C4b 描述子纯 JSON | round `:125-140` / `:459-468`：`structuredClone` 深等 + JSON 往返等值 + 掺函数 → `DataCloneError` 负控（判据非恒真） | ✅ |
| C4c 帧即字节 | round `:142-148` / `:469-478`：缝内进出项 `instanceof Uint8Array`；出站恒占位 0（解码复核 `header.sequence===0`）、入站非 OPEN 帧带 wire 序 | ✅ |
| C4d 无 live 对象过缝 | round `:149-152` / `:479-483`：描述子值无 `HubNamespaceChannel` 实例、无函数 | ✅ |
| 依赖面 | `packages/ws-replication/package.json` 零 diff（本轮 DENY 核对）；无新依赖 | ✅ |

## 5. AC5 — session 侧重检入站 sequence 的代码不存在（防御性断言或测试锚）：**满足**

| 判据 | 本轮独立取证 | 判定 |
| --- | --- | --- |
| C5a 行为正锚（主判据） | round `:403-439`：回合已消费至 wire 序 ≥5 后，经公共 `handleFrame` 投递**回退序** `CLOSE_NAMESPACE(seq=2)` → 仍被消费 + `CLOSE_OK{ackedSequence:2}` + 零 ERROR/零 fatal/零 connection-fatal 信号 | ✅ |
| C5b 行为负控 | round `:387-401`：同一非法序（跳序）在 edge → `SEQUENCE_VIOLATION` + `close(1002,'protocol-error')` + **零缝投递**（`seamFramesIn` 计数不变）——edge 单点纪律对照 | ✅ |
| C5c 补充结构门 | **本轮自跑** `grep expectedSequence src/hub-session-host.ts` = **0 命中**；实现 `:122-125` 的 `decodeMessage` 仅传 `maxFrameBytes`/`selectedCapabilities`（capability 门控透传，与 edge 同源判据），wire 序经 `namespaceFrame(message, header.sequence)` 原样进记账 | ✅ |
| C5d 变异敏感性（M5） | `sa3-issue420-mutation-M5-session-resequence-check.log` 在案：给 session 解码加重检 → **9 failed**（含 C5a/C5c） | ✅ |

## 6. 规范一致性、非目标与 scope 核验

| 面 | 核验 | 判定 |
| --- | --- | --- |
| ADR 0032 决策 1（单份 FSM、分布式实例化） | 公共工厂内部复用重命名后 splice（`createHubSessionSink`，一条组装两种 port 形态）；`hub-namespace.ts` 零 diff（本轮亲证）；夹具零协议决策 | ✅ |
| ADR 0032 决策 2（字节/纯 JSON 缝、序纪律、四信号） | §4/§5；`HubSessionSignal={settled,connection-fatal}` 公共化登记入附录 A1（code→close code 映射单点留 edge）；出站占位 + edge mux 盖章保持 | ✅ |
| ADR 0032 决策 3（authorize 在 edge、投影传递） | adapterPort `openAdmission` 闭包恒回放 ok-投影（`:178-182`）；denied/throw 不过公共缝（test-d 负控 ①② + 夹具结局路由到生产 sink）；矩阵 deny 族 shim 臂绿 | ✅ |
| ADR 0032 决策 4（路由键契约） | edge demux 零触碰（DENY diff 空） | ✅ |
| ADR 0032 决策 5（dormant 降级、observer 发射点） | adapterPort 17 成员亲读对齐：`dataGateOpen` 恒 true、`bufferedAmount` 恒 undefined、assembly per-session 单槽、`emitObserver=dispatchReplicationObserver` 单点、`now` observer 门控；附录 A3 登记 U8 语义差 | ✅ |
| ADR 0032 后果节（append-only 工厂轨） | §1 导出面核验；`src/testing.ts` 零 diff | ✅ |
| E1/E2 修订线闭合（R7''/R8''） | ADR 0032 澄清附录 +23 行（A1 信号映射 + A2 三载体 α/β/γ + A3 降级登记）与 `CONTEXT.md:229-231` 词条更新**与实现同变更集**落地（diff 亲读；附录自文「不修改决策 1~5」且与实现事实一致）；`docs/AGENTS.md` 显式修订纪律满足（非静默矛盾）；`hub-split.ts` 头注旧陈述同步更新 | ✅ |
| 协议 v1（§4/§7.1/§13/§14/§17/§19/§23.1） | wire 格式/错误码/事件词汇零变化（协议文本零 diff；A8 序纪律断言；全部失败面用在册码；零新事件型） | ✅ |
| 模块 AGENTS.md | 生产 API 经 `src/index.ts`；夹具只落 `test/`（深路径 import）；admission 有界（pending ≤16 帧/ns + 单帧 ≤maxFrameBytes + 溢出 1008 响亮）；注入 timer/scheduler；§21 收口权威（A11） | ✅ |
| 非目标边界（无 scope creep） | 未触 peer 侧拆分、真 worker/MessageChannel 传输、`listen:false` 插件/`nomicoreHubSessionHost` 服务轨、跨进程 revoke 全链路、wire 格式——diff 全量亲读无越界；全部 changed paths 落在设计 ALLOW LIST 13 条内（代码/测试/文档面），其余为过程产物（wiki/artifacts） | ✅ |
| 重命名纯机械 | `hub-session.ts`（重命名 + 别名删除 + 头注）、`hub-connection.ts`（import/调用点/头注 3 行）、`hub-split.ts`（仅头注）、#418 structure 测试 7 行机械跟随——diff 逐行亲读，零行为变化；listen 臂 52 用例逐字重跑绿背书 | ✅ |

## 7. PR 必须披露的未达成/登记项（均不阻断 approve）

1. **设计文本滞后一行（SA8 RA1''，wiki 内务，Controller/SA1 持有）**：实现的「载体提交」机制
   （夹具 `issue420-shim-hub.ts:311-327`：routing 相位**非 OPEN** ns 域帧即时提交生产 splice 承载）
   偏离设计 §7 D7 `namespaceFrame` 行字面（入 pending 窗口）。偏离是证据驱动的唯一相容读法——
   字面机制被冻结矩阵 `ac7-faults` 证伪（`sa3-issue420-design-letter-divergence.log`：2 failed）；
   SA8 impl 复查裁决 implements-existing-decision（行 11：承载机械=生产代码、违例应答由零 diff 通道
   状态机产出、入窗 OPEN 放弃与生产 abort 语义逐点同构）；SA7 A/B 探针动态证实与 listen **逐字节相等**
   （19/19，3× 一致）。**待办**：设计 wiki D7 行文本补正（「非 OPEN 帧在 routing 相位即时提交生产承载；
   在途 OPEN 入有界 pending 窗口」）+ ADR 附录 A2 β 措辞与「按帧到达形态」第三路由判据的对齐登记。
2. **反空跑锚替换（SA3 Deviation 3 / SA8 行 22，no-conflict）**：SA6 §12.3 设想的 `ac5-live`
   `ACK_STATE_VIOLATION` 锚经代码事实核对为 **peer 侧** fatal（不经会话缝）；实际落地锚 = `settled≥1`
   + 全 run 零 `INTERNAL_ERROR` + 计数阈值；`connection-fatal` 通路正控由 round A12 红臂以更强形式承载；
   M4 变异证明判据非恒真。验收语义未弱化。
3. **U2 真 worker 形态未解（明示非目标）**：本票只冻结**同步宿主 pipe** 面（`onFrame` 同步返回被分配
   wire 序）；异步序回传与跨线程 pending 义务留后续票并按 R4''/R5'' 重新过 SA8（ADR 附录 A1/A2 γ 句
   已明文登记）。PR 不得声称已解决真 worker 形态。
4. **服务轨/宿主接线为后续票**：`listen:false` 插件 + `nomicoreHubSessionHost` 服务、peer 侧拆分、
   nomic-server 宿主接线、跨进程 revoke 全链路 = 明示非目标（与 #418 SA10 §9 留白一致）。
5. **观测边界登记（R6/R7/R11/R12）**：`selectedCapabilities` 经内部 port 单 bit 反推（多 bit 需 R8''
   重触发）；shim 下 authorized 通道不投影 `edge.channels`；在途路由期 revoke 的 wire 时序相对 listen
   偏移（7 矩阵零 revoke 用例不触）；桥 accept 门链保真度差异清单——全部在夹具头注/设计 §13 登记，
   防误当规范宿主样例。
6. **公共 host `sessions` 表无删除路径（SA4 O4）**：冻结语义「session 对象随连接存活（终态不拆）」的
   字面兑现；夹具按连接一对一建 host ⇒ 无运行时影响；未来跨连接复用单一 host 的宿主须先明确生命周期
   约定（服务轨票）。
7. **SA6 三个诊断探针陈旧名（SA8 RA4''）**：`artifacts/sa6-issue420-{capability-gap,causality,
   sequence-discipline}-probe.mts` 仍 import 授权重命名前的旧名 `createHubSessionHost`（应改
   `createHubSessionSink`）；探针不在任何 tsconfig/vitest include 面，零 gate 影响；重跑前需更名。
8. **证据打包 MINOR**：SA3 报告引用的变异日志（M1/M2/M3/M4/M5/M7/M7b）、`sa3-issue420-red-contract.log`、
   SA6 `runner-trigger-red.log`、SA7 聚焦/listen 基线两日志当前为 **worktree 未跟踪文件**，未随
   commit a315e70 入库（本轮抽查其在案且内容计数与报告一致）；提交内已含绿/红/tsc/根套件主证据。
   建议交付说明/后续整理提交补齐，不影响 AC 判定。

## 8. 结论

五条 AC 全部满足且无部分实现；冻结契约逐字落地；规范面零违约且 E1/E2 文本义务在同变更集闭合；
无 scope creep；偏差与替换均已获 SA8 裁决并有动态等价证据。**approve**。`requiresConflictRecheck: false`
（SA8 implementation 复查已存在且 clear、已置 `requiresConflictRecheck: false`；本轮未发现新的决策冲突面，
§7 全部为在册登记项）。

## 附：artifactPaths（worktree-relative）

```text
wiki/raw/task_issue-420_sa10_spec.md
```
