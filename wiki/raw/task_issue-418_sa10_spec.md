# SA10 Spec 审查 — issue #418：`HubConnectionImpl` 拆分 Edge/SessionHost + 单体进程内组合（ADR 0032 决策 1 / spec #415 T2）

- Dispatch：`sa-9b10161f-e75e-4f4f-91ce-e680f50870c3`（mabf-sa10 / spec-review / iteration 0）
- 审查对象：worktree `/home/wangjian/nomicore-fix-issue-418`（分支 `mabf/issue-418`，HEAD `27e012b6606e48797842a79e11e3505819c34cc6`）内**当前交付 diff**（未提交）：`hub-split.ts`（127 行，新增）/`hub-edge.ts`（790，新增）/`hub-session.ts`（293，新增）+ `hub-connection.ts`（改写，1145→469）+ `frame-io.ts`（+57/-13）+ `backpressure.ts`（+54）+ 3 个新测试文件 + codec 守卫测试
- Owner comments：派工单明示 REST comments read 返回 `[]`；简报 §Comments 为空 ⇒ **无 owner 追加要求**，需求全集 = Issue body 5 条 AC + ADR 0032 决策 1~5
- **Verdict：`approve`**（5/5 AC 全部可验证达成；无遗漏、无部分实现、无错误实现、无 scope creep；登记残余项全部已在上游产物披露且为非阻断 MINOR）

---

## 1. 审查输入与亲读面

| 输入 | 状态 |
| --- | --- |
| `wiki/raw/task_issue-418.md`（Host 简报；Issue body 5 AC） | 全文读取 |
| `wiki/raw/task_issue-418_sa6_contract.md`（SA6 验收契约，approve；C0a~C0d + C1~C6 + U1~U5） | 全文读取 |
| `wiki/raw/task_issue-418_design.md`（SA1 iteration 2 批准设计，736 行） | 全文读取 |
| `wiki/raw/task_issue-418_sa2_review.md`（SA2 iteration 2：approve，finding 集空） | 全文读取 |
| `wiki/raw/task_issue-418_sa3_impl.md`（SA3 iteration 2 原位版实现报告） | 全文读取 |
| `wiki/raw/task_issue-418_sa4_review.md`（SA4：approve；O1~O4 非阻断观察） | 全文读取 |
| `wiki/raw/task_issue-418_sa7_report.md`（SA7：approve；F-1 非阻断复证） | 全文读取 |
| `wiki/raw/task_issue-418_design_conflict_report.md`（SA8 设计后复查：clear + 注 C'） / `task_issue-418_implementation_conflict_report.md`（SA8 实现后复查：clear，R9' 六项闭合） | 全文读取 |
| `docs/adr/0032-transport-decoupling-edge-session-split.md`（已接受） | 本轮亲读全文（决策 1~5 + 否决备选） |
| 源码亲读 | `hub-split.ts` / `hub-edge.ts`（全 790 行）/ `hub-session.ts`（全 293 行）/ `hub-connection.ts`（全 469 行）/ `frame-io.ts`（全 206 行）全文；`backpressure.ts` diff 逐行 |
| 工作区核验（本轮亲跑） | `git status --porcelain`、`git diff --stat HEAD`、DENY 面逐项零 diff、`git diff --name-only HEAD -- packages/ws-replication/test` = 0、新测试文件零 skip/only/todo、符号残留 grep、文件 mtime、证据日志 tail/head 复核（§4） |

SA10 未修改任何代码/设计/测试，未运行测试/服务；唯一产物为本文件。

## 2. AC 逐条核验（Issue body §Acceptance criteria）

### AC1：连接级与 namespace 级状态机成为两个可独立实例化的内部模块，单体 = 进程内组合 —— ✅ MET

- **两个内部模块成立**：`createHubReplicationEdge(config)`（hub-edge.ts:788，注入 transport/authorize/sessionFactory，零 Registry 依赖）与 `createHubSessionHost(config)`（hub-session.ts:291，注入 port/registry）——均为**模块级导出**，不进 `src/index.ts`/`src/testing.ts`（两文件本轮核验零 diff），符合「内部模块 + 零新公共 API」。
- **可独立实例化**：C0a（stub session sink 拉取 `port.openAdmission`）/C0b（stub port 四形态臂含 reject 响亮臂 + 真实 Registry 全生命周期）白盒测试 9 用例绿（`acceptance-tests-iter2.log` 56/56）。
- **单体 = 进程内组合**：`hub-connection.ts` `createEdge`（:429-463）按设计 D7 逐成员装配 edge + sessionFactory；缝 = 函数调用（`HubSessionEdgePort` 17 成员 / `HubSessionSink` 6 成员，hub-split.ts）。
- **协议状态机单份**：`HubConnectionImpl` 已解体（全仓 7 处引用全部为注释，无活符号）；连接 FSM 唯一在 hub-edge.ts，通道 FSM 唯一在零 diff `hub-namespace.ts`；已删机制（OpenEntry/PendingEvent/settlePending/sunkNames/pendingNames/dropPendingEntries/authorizeFirstOpen/replayAuthorization）源码 grep 零残段；无「单体 vs 拆分」双实现。

### AC2：出站 sequence 单点分配在 edge 半边（盖章语义），入站 expectedSeq 校验在 edge 半边 —— ✅ MET

- **出站盖章**：session 半边以 `sequence=0` 占位编码（hub-session.ts:257-263 `encodePlaceholder`；编码异常同步经缝传播回 `sendChecked` catch——O6 保持）；edge 的 `OutboundQueue.emitOne`（frame-io.ts:184-197）为唯一分配点——耗尽检查先于盖章、`writeBe32At(bytes, 8, sequence)` 重写 `[8..12]`，连接级帧（message 形态薄包装 `sendControl`/`emit`）与 namespace 域帧（字节形态 `sendControlFrame`/`emitFrame`）汇流同一 mux。envelope sequence 为固定 4 字节大端 ⇒ 占位+盖章 ≡ 单次编码逐字节相等（SA7 探针 P1 逐帧 re-encode hex 等价运行时证明，含 Yjs 载荷帧）。
- **入站收口**：hub-edge.ts `onMessage`（:373-402）`decodeInbound({expectedSequence,…})` 单点校验先于一切分派；`expectedSeq = sequence + 1`（:389）先于 handshaking 门与 dispatchReady；gap/repeat → `SEQUENCE_VIOLATION` fatal 1002 且零 authorize/零 OPEN_OK/零 ns 投递（C2a/C2b 契约绿）。
- 证据：SA6 契约 C1a~C1d（单点序列/记账一致/跨 ns 单计数器/CLOSE_OK 记账）、C2a/C2b、C6a（占位 0/撞序必被接收侧拒）17/17 绿。

### AC3：通道实现零改动（authorize 仍经注入的 host 接口调用） —— ✅ MET

- 本轮核验 `git diff --stat HEAD -- packages/ws-replication/src/hub-namespace.ts` **为空**（AC3 为内容命题；SA4-O3 记录的 mtime 触碰不构成内容差——git blob 比对空）。
- authorize 仍经注入面：session 组装 24 成员 `HubChannelHost`（hub-session.ts:51-79），`authorize` 成员签名不变、实现换为拉取 shim（:60 → :105-111 `pullAuthorization`）；真实 authorize 单点在 edge（`beginAdmission` hub-edge.ts:338-360，入参 = HEAD `host.authorize(host.peerInstanceId(), nsId)` 逐值），session 结构性不可达真实授权器。
- 证据：C2c（re-OPEN 合流 authorize 恰一次）/C2d（入参逐值）绿；13 个既有白盒 `hub.connections[0].channels` 锚绿（包全量内）。

### AC4：既有全量测试逐字节绿灯（golden vectors、real-transport、fault 注入、observer 锚、auth/HELLO/backpressure/liveness/close/GOAWAY/epoch 全路径） —— ✅ MET

- **不改而绿**：本轮核验 `git diff --name-only HEAD -- packages/ws-replication/test` = **0**（既有 72 文件零修改，含 SA6 契约文件——mtime 2026-09-21 22:31 = SA6 会话、全文零 seam 引用 grep=0）。
- **全量绿**：包套件 75/75 文件、569/569 用例 EXIT=0（`sa3-issue418-package-suite-iter2.log`；SA7 于 01:21:21 在最终形态复跑同绿 `sa7-issue418-package-suite.log`，含 real-transport/liveness/backpressure/GOAWAY 族）。
- **I13 两锚**（iteration 0 下唯二红、本版由构造转绿）：`ws-replication-ac7-faults.test.ts` 12/12、`ws-replication-issue171-red.test.ts` 5/5（包全量日志行）。
- **金标**：C3a/C3b/C3c（HELLO_ACK/OPEN_OK/UPDATE_ACK/GOAWAY 全帧 hex 冻结）绿；M1 矩阵 25/25 且对 HEAD stash 基线（`m1-head-baseline-iter2.log` 25/25）逐帧逐事件一致——期望值为 HEAD 真值，非为拆分形态定制。

### AC5：包 typecheck + 根 pnpm typecheck 与 pnpm test 绿灯 —— ✅ MET

- `sa3-issue418-typechecks-iter2.log`：包 tsc EXIT=0、protocol tsc EXIT=0、根 `pnpm typecheck`（15 tsconfig 串行）EXIT=0。
- `sa3-issue418-root-test-iter2.log`：根 `pnpm test` 439/439 文件、5299/5299 用例、`Type Errors no errors`、EXIT=0（436+3：SA6 契约 + 本票 structure/matrix/codec 守卫 3 新文件自动入收集面）。

## 3. 冻结面与 scope 核验

| 面 | 要求 | 本轮核验结果 |
| --- | --- | --- |
| 零新公共 API | index.ts 11 + /testing 5 运行时导出冻结 | `git diff` 零变更；C5a 绿；两工厂/缝类型仅模块级导出（C0c 断言绿） |
| 零配置变化 | DEFAULT_* 三常量 + validate.ts | 零 diff；C5b 绿 |
| wire 逐字节 | 非 Yjs 帧全帧金标 + envelope 纪律 + Yjs 载荷 envelope/解码语义 | C1/C3/C6 绿；占位编码+盖章字节等价（SA7 P1） |
| observer 面 | 36 型 append-only、发射点归属 | 零新事件型/字段；L1 两处无事件直赋保留（M3a/M3b 绿） |
| peer 侧 | 非目标（ADR 后果节） | peer-connection/peer-namespace 零 diff；message 形态原签名保留 |
| 导出面留后续票 | listen:false / nomicoreHubSessionHost / createHubReplicationEdge 公共导出（SA6 U4 冲突信号） | **未提前导出**——C0c/C5a 绿；无 scope creep |
| docs/CONTEXT/apps/根配置 | 零变化 | 全部零 diff |
| 既有测试面 | 不改而绿 | 0 文件修改（本轮核验） |

**Diff 范围**严格落在设计 §11 ALLOW LIST（3 改写 + 3 新增 src + 3 新增测试 + codec 守卫测试 + 证据/报告），无任何无理由扩张。

## 4. 证据完整性核验（本轮独立复核）

- 日志头均为真实 vitest 输出（`RUN v3.2.7 /home/wangjian/nomicore-fix-issue-418`）；mtime 序与 SA3 §6 方法论自洽（matrix 更新 00:48:51 → HEAD 基线 00:49:07 → 源码复原 00:49:11 → structure 00:57:42 → 全量 01:05:59/01:21:21）；`git stash list` 为空。
- 新测试文件零 `skip/only/todo`（grep=0）；契约文件未被实现期触碰。
- 用例计数一致：contract 17 + structure 9 + matrix 25（10 臂×2 + M1-0/revoke/M2/M3a/M3b）+ codec 守卫 5 = 56/56（`acceptance-tests-iter2.log`）；SA7 探针删除后聚焦复跑 68/68 不变（`post-removal-focused.log`）。
- 当前 worktree 状态 == 各报告所述交付态（git status 逐行比对一致）。

## 5. 已登记残余与 PR 必须披露项（全部非阻断，上游已裁决）

| # | 事项 | 登记位置 | 判定 |
| --- | --- | --- | --- |
| 1 | **R4'**：非暂停控制帧「出站序列耗尽（≥0xffffffff）∧ 消息编码必败」双不可达角落错误类归属与 HEAD 不同（OutboundExhausted+close 1008 vs MALFORMED→ns ERROR+failed）——issue 明文机制（session 占位编码/edge 盖章）的结构性后果；SA4-O2 注记 peer 侧经共享队列同获此次序面（无回归，peer 全量绿） | 设计 §13 R4'；SA4 §12-O2；SA8 R4'' | 双不可达、登记不伪造测试；接受性经 SA2/SA8 确认 |
| 2 | **R6'**：authorize 结算续体微任务跳数 1→约 3——帧/事件序在到达点已固定，不可观察；全套件显式泵预算吸收 | 设计 §13 R6'；SA2 SM-5'' | 无 wall-clock 依赖面 |
| 3 | **SA4 §12-O1 / SA7 F-1（MINOR）**：类型违约授权器（返回/结算 undefined/null）→ fulfillment TypeError → admission 永不结算 + 进程级 unhandledRejection（≠ HEAD 的 INTERNAL_ERROR）。仅类型契约违约宿主可达、无既有测试面；路由 = implementation 后续小改（try/catch 兜底 throw 结局 + 注释修正），非本票阻断 | SA4 §12-O1；SA7 §10 F-1 | MINOR 已路由；实现与批准设计一致（设计的 throw 结局未声明覆盖违约返回值语义） |
| 4 | **R7''/R8'' 文本调和义务**：ADR 0032:22 机制句（「未授权 OPEN 不过缝，edge 复现…」）与 CONTEXT.md:230 词条（「消费 edge 传入的预授权投影」）与实现的「OPEN 结局产出前过缝 + 拉取式消费」存在措辞差——SA8 注 C' 目的读法下裁决 `implements-existing-decision`，义务 = worker 形态票 SA8 前置门禁之前或之中正式落 ADR 修订/澄清附录；Host 可自愿先行 documentation-only 附录（推荐非阻断）；在此之前任何票不得援引机制句字面迫使回退形态 | SA8 设计报告注 C'；SA8 实现报告 §8-R7'' | 跨票义务按期存续；本票未触碰 docs（DENY 零 diff，合规） |
| 5 | **R5'' worker 形态前置门禁（存续）**：入站缝形态 + openAdmission 拉取形态 + channels/dataFacetOf 组合成员重塑须随 worker 形态票重新过 SA8；**R4''**：pending 有界缓冲义务对「本票新增面」关闭（零窗口缓冲、台账 ≤ 通道数），worker 票重新进入 | SA8 实现报告 §8-R4''/R5'' | 后续票义务，非本票缺口 |

**关键说明**：SA10 特别复核了 ADR 0032 决策 3 机制句字面（「未授权 OPEN 不过缝」）与实现形态（结局产出前过缝）的差距——该差距已经 SA8 两道门禁（设计后复查注 C' + 实现后复查 §3 行 4）正式裁决为合法解释性裁决（字面读法迫使「wire 逐字节不变」或「单份 FSM」必破其一，且通道在场性/到达点效应本身是 DENY 保护的既有测试面 I13 两锚），并以 R7''/R8'' 登记文本调和义务。Issue body 本身不含该机制句字面（其 What-to-build 仅要求沿内缝拆分 + 单体进程内组合 + 入站 sequence edge 校验 + 出站占位/盖章），故本项**不构成对 Issue 需求的偏离**，但 PR 描述应如实引用上述登记口径。

## 6. 结论

**`approve`**。

1. 5/5 AC 全部达成且各有运行时/wire 原字节级证据锚；AC1 的「两个可独立实例化内部模块」由 C0a/C0b 白盒 + 模块级工厂落地，「单体 = 进程内组合 + 协议状态机单份」由组合根与零残段核验证实。
2. 无遗漏（What-to-build 全部要点落地：内缝拆分、单体组合、零新公共 API/零配置/wire 不变、入站 edge 校验、出站占位+盖章）；无部分实现；无错误实现；无 scope creep（导出面/worker 形态/peer 侧均正确留待后续票）。
3. Owner 评论为空，无追加要求未落实。
4. 登记残余 5 项（§5）全部已在上游产物显式披露、经 SA2/SA4/SA7/SA8 裁决为非阻断，须在 PR 描述中按 §5 口径披露——不构成本票 AC 的 partial/unmet。
5. 交付 diff 与证据链自洽（mtime 序、日志头、git 状态、用例计数交叉一致），既有测试面零修改，SA6 冻结契约未被触碰。

## 附：artifactPaths（worktree-relative）

- `wiki/raw/task_issue-418_sa10_spec.md`（本报告）
