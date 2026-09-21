# SA6 诊断与验收契约 — issue #418：`HubConnectionImpl` 拆分 Edge/SessionHost + 单体进程内组合（ADR 0032 决策 1 / spec #415 T2）

- Dispatch（建立，iteration 0）：`sa-38205503-ee01-44b8-9952-2c7dcdd3e3ee`（mabf-sa6 / acceptance-contract）
- Dispatch（**本轮原位复审，iteration 1**）：`sa-842c3217-435a-4365-9bb5-545a6077a4e2`（mabf-sa6 / acceptance-contract）；复审对象 = 已完成实现（SA3 iteration 2）+ SA7 动态验证（approve）+ 已批准的 SA9 标准审查（approve）/ SA10 spec 审查（approve）；REST comments `[]`（派工单明示），无 owner 追加要求。
- 任务类型：**wide refactor**（派工与 issue 明文：零新公共 API、零配置变化、wire 逐字节不变）⇒ 按 skill「Refactor：建立当前行为基线和必须保持的回归契约；基线可以初始为绿，不伪称红灯」执行：**本报告不虚构 Bug 根因、不伪造红灯**；AC1/AC3 的「两个可独立实例化的内部模块」在 iteration 0 是**真实能力缺口**（§5/§8），本轮复审确认该缺口已由实现以设计落定的 `hub-split.ts`/`hub-edge.ts`/`hub-session.ts` 闭合（C0a~C0d 可执行，§12.1/§17）。
- 基线 worktree：`/home/wangjian/nomicore-fix-issue-418`，分支 `mabf/issue-418`，HEAD `27e012b6606e48797842a79e11e3505819c34cc6`（`docs(adr): 改号 0031→0032（0031 已由 PR #403 占用）`）——复审时 HEAD 与工作区实现集均与 SA7/SA9/SA10 会话一致（§17.1）。
- 结论：**`verdict: approve`**（复审保持）。C1~C6 冻结契约在最终实现上**未改而全绿**（17/17，§17.2）；C0a~C0d 由实现交付 `…structure.test.ts` 9 用例落地且绿（缺口闭合）；M1/M2/M3 矩阵 25/25 且对 HEAD stash 基线一致（SA3/SA7）；全量门禁包 75/75 文件 569/569 用例、根 439/439 文件 5299/5299 用例（`Type Errors: no errors`）、包/protocol/根 typecheck 全 EXIT=0；DENY 面零 diff、既有测试零修改、SA6 契约文件未被实现期触碰。残余 MINOR（类型违约授权器角落）与跨票义务（R4''/R5''/R7''/R8''）在 §15/§17.5 显式登记并按 SA10 口径须在 PR 描述披露，不软化、不跳过。

---

## 1. Task type and inputs

| 输入 | 路径 | 状态 / 关键内容 |
| --- | --- | --- |
| Host 任务简报 | `wiki/raw/task_issue-418.md` | 存在；Issue #418 body：Parent PR #416（spec/415-replication-transport-decoupling），What to build（沿 `HubChannelHost` 内缝劈为 edge/session、单体 = 进程内组合、零新公共 API/零配置变化/wire 逐字节不变、入站 sequence 由 edge 校验、出站帧 session 以 sequence=0 占位编码 + edge 定偏移盖章），5 条 AC，Blocked by None |
| Owner comments | 派工单：「REST comments read returned []」；简报 §Comments 为空 | **无 owner 追加要求** ⇒ 需求全集 = Issue body 5 条 AC + ADR 0032 决策 1~5 |
| relevant_decisions | `wiki/raw/task_issue-418_relevant_decisions.md` | **不存在**（本任务未生成；非阻塞——ADR 0032 即设计权威） |
| conflict_report | `wiki/raw/task_issue-418_conflict_report.md` | **不存在**（非阻塞） |
| SA8 产物 | `wiki/raw/task_issue-418_design_conflict_report.md`（设计后复查：clear + 注 C'）、`task_issue-418_implementation_conflict_report.md`（实现后复查：clear，R9' 六项闭合） | **iteration 0 时不存在**（§3 当时以 ADR + 协议 + 模块 AGENTS.md + CI 为约束）；**复审时两份均已存在且 clear**，其裁决与 R4''/R5''/R7''/R8'' 义务纳入 §3/§15/§17 |
| 下游产物（复审输入） | `task_issue-418_design.md`（736 行，SA1 iteration 2 批准）、`task_issue-418_sa2_review.md`（approve）、`task_issue-418_sa3_impl.md`（SA3 iteration 2 完成）、`task_issue-418_sa4_review.md`（approve，O1~O4）、`task_issue-418_sa7_report.md`（动态验证 approve，F-1 非阻断）、`task_issue-418_sa9_standards.md`（标准审查 approve，M-1~M-4 非阻断）、`task_issue-418_sa10_spec.md`（spec 审查 approve，5/5 AC） | 复审逐份读取；AC 映射与残余义务见 §17.3/§17.5 |
| 权威决策 | `docs/adr/0032-transport-decoupling-edge-session-split.md`（状态：已接受；需求 #414，spec #415，实现 PR #416 已合入 ADR 文本） | 决策 1（沿既有内缝拆分，两半都是 nomicore 代码）、2（缝只过 `Uint8Array` + 纯 JSON；出站 sequence=0 占位 + edge 重写 `[8..12]`）、3（authorize 在 edge 端调用、OPEN 全解码；「未授权 OPEN 不过缝 / 回放预授权投影」经 SA8 注 C' **目的读法**裁决为「到达点投递 + 拉取式消费」——见 S3 行注）、4（帧路由键定偏移：namespaceId 恒在 `[21..56]`，UPDATE_CHUNK `[22..57]`）、5（降级与观测纪律平移；`listen:false` 与 SessionHost 服务面留待后续票） |
| 规范 wire 契约 | `docs/protocols/instance-replication-v1.md` §1 不变量 2/5、§3 固定 envelope、§13.1、§14、§16/§17/§18、§23 | §1-2「每条正常 frame 都消费本发送方向的 sequence；对端严格按期望值接收」；§1-5「HELLO_ACK 前不得发送 namespace frame」；§3 sequence 位于 `[8..12]`、`payloadLength [12..16]`、`byteLength ≡ 20 + payloadLength`；§13.1 `SEQUENCE_VIOLATION` fatal → §14 close 1002 |
| 模块规约 | `packages/ws-replication/AGENTS.md`（FSM 不变量、序列不回绕、observer 隔离、注入 seam、testing 面纪律）；根 `AGENTS.md`（worktree 纪律、门禁） | §3 |
| 被测实现 | **HEAD（iteration 0 基线口径）**：`src/hub-connection.ts`（`HubConnectionImpl` 1145 行，模块私有；`HubChannelHost` 内联实现 512~555；`onMessage` 666~695；`dispatchReady` 787；`connectionFatal` 954；`wsCloseCodeFor` 1141）、`src/hub-namespace.ts`（`HubChannelHost` 52~100；`HubNamespaceChannel` 104+；`startOpen` 335）、`src/frame-io.ts`（`OutboundQueue.emitOne` 157~174 单点分配）、`src/backpressure.ts`、`src/plugin.ts`。**最终实现（复审口径）**：新增 `src/hub-split.ts`（缝契约）、`src/hub-edge.ts`（连接 FSM 唯一实现 + `writeBe32At` 盖章 mux）、`src/hub-session.ts`（通道容器/组装/shim），改写 `hub-connection.ts`（1145→469 行，组合根 + 服务面）、`frame-io.ts`（+57/-13）、`backpressure.ts`（+54） | §5/§8/§17 |
| 既有测试 | `packages/ws-replication/test/**` 既有 **72** 个 `*.test.ts`（零修改）；包 `*.test.ts` 契约前 72 → 契约后 73 → **最终实现 75**（+structure、+matrix）；`scripts/ci-test-shard.mjs` 按磁盘枚举分片 | §4/§14/§17.4 |
| 本报告新增产物 | `packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts`（17 用例，初始全绿）；复审新增 `artifacts/sa6-issue418-revalidation-*.log` **5 份** | §12/§13/§17 |

**范围界定**。在范围内 = hub 侧连接级/namespace 级两半的可独立实例化、单点出站 sequence 的 edge 盖章位置、入站 expectedSeq 的收口位置、wire/公共 API/配置的逐字节与逐值不变、既有全量测试与 typecheck 门禁。不在范围内 = peer 侧对称拆分（ADR 0032 后果节明示留待后续）、`listen:false` / `nomicoreHubSessionHost` / `createHubReplicationEdge` 导出面（issue 明示「后续票在其上导出面」；本票零新公共 API）、worker_threads 依赖（ADR 决策 2：nomicore 不依赖，传输实现属宿主）。

---

## 2. Owner comment mapping

- 派工单：REST comments snapshot 返回 `[]`；简报 §Comments 为空 ⇒ **无超出 Issue body 的 owner 追加要求**。
- 契约必达项 = Issue body 5 条 AC + ADR 0032 决策 1~5：

| Issue AC | 契约条目 | HEAD 状态 |
| --- | --- | --- |
| AC1 连接级/namespace 级状态机成为两个可独立实例化的内部模块，单体 = 进程内组合 | C0（§12.1 结构契约）+ C1/C2/C4（组合后的行为面） | **能力缺口**（§5/§8：无独立实例化入口；单体即唯一实现） |
| AC2 出站 sequence 单点分配在 edge（盖章语义）、入站 expectedSeq 校验在 edge | C1a~C1d（单点序列/盖章字节/记账一致）、C2a~C2d（分派前收口）、C6（敏感性反证） | **行为面已满足于单体**（单点分配已在 `OutboundQueue`，收口已在 `onMessage`）；拆分后必须保持同一可观察事实（edge 归属由 C0 白盒证据补足） |
| AC3 通道实现零改动（authorize 仍经注入 host 接口调用） | C2c（re-OPEN authorize 恰一次）、C2d（authorize 入参/次数） | **行为面已满足**（authorize spy 经 `HubChannelHost.authorize` 注入路径）；`hub-namespace.ts` 零 diff 属实现期结构门禁（C0） |
| AC4 既有全量测试逐字节绿灯（golden vectors、real-transport、fault 注入、observer 锚、auth/HELLO/backpressure/liveness/close/GOAWAY/epoch） | C3a~C3c + §13 全量套件 | **基线绿**（72/72 文件、518/518 用例） |
| AC5 包 typecheck + 根 `pnpm typecheck` 与 `pnpm test` 绿灯 | §13 门禁清单 | **基线绿**（包 tsc 0；根 tsc 0；根 `pnpm test` 结果见 §13） |

**复审状态（最终实现，iteration 1）**：AC1 = **已达成**（C0a~C0d 9/9；两工厂仅模块级导出；单体 = 进程内组合；协议 FSM 单份）；AC2 = **已达成**（C1~C6 17/17；出站盖章单点 `frame-io.ts:192` 的 `writeBe32At`；入站收口 `hub-edge.ts:377-389`）；AC3 = **已达成**（`hub-namespace.ts` 零 diff；authorize 经注入面恰一次）；AC4 = **已达成**（既有 72 文件零修改 + 包 75/75 文件 569/569 用例；I13 两锚由构造转绿）；AC5 = **已达成**（包/protocol/根 typecheck 与根 `pnpm test` 全 `EXIT=0`）。逐条证据与 SA9/SA10 裁决对齐见 §17.3。

---

## 3. SA8 constraints（iteration 0 时无 418 专属 SA8 产物；复审时 SA8 两阶段复查均已存在且 `clear`——约束来自 ADR 0032 + 协议 + 模块规约 + CI + SA8 裁决与义务账）

| # | 约束来源 | 内容 | 契约落点 |
| --- | --- | --- | --- |
| S1 | ADR 0032 决策 1 | 沿既有 `HubChannelHost` 内缝劈为 `HubReplicationEdge`（连接级：envelope/sequence、HELLO 与 capability、liveness、GOAWAY/reauth、连接级背压）与 `HubSessionHost`（namespace 级：`HubNamespaceChannel` 全部）；单体 listen = 两者进程内组合，**协议状态机单份实现**（宿主自实现 edge = fork，否决） | C0（结构契约）；C1/C2/C4（组合行为不变） |
| S2 | ADR 0032 决策 2 | 缝上只有 namespace 域帧 + 4 控制信号；入站 sequence 由 edge 校验；出站帧 session 以 sequence=0 占位编码、edge 在 mux 点重写帧字节 `[8..12]`；wire 逐字节不变；fire-and-forget 无接纳信号 | C1（raw `[8..12]` 单点 1..N + 无 0 泄漏）、C6（占位泄漏必被接收侧拒） |
| S3 | ADR 0032 决策 3 | edge 对 OPEN 全解码并调用 `NamespaceAuthorizer`；**注 C'（SA8 设计后复查）目的读法**：本票进程内形态 = 「到达点建通道 + 结局产出前过缝 + session 拉取预授权投影」，机制句「未授权 OPEN 不过缝」字面经 SA8 两道门禁裁决**不具规范力**（字面读法必破「wire 逐字节不变」或「单份 FSM」之一）；`HubNamespaceChannel` 零改动；authorize 每 (连接, namespace) 仅首次 OPEN 调用一次（重 OPEN 经 shim 拉取合流）；R7'' 文本调和义务存续（§15 U7） | C2a/C2b（**错序帧**不过缝：零 authorize/零 OPEN_OK）、C2c（re-OPEN authorize 恰一次）、C2d（authorize 入参）、C0b（被拒结局由零 diff 通道原生承接：零 `registry.open`） |
| S4 | ADR 0032 决策 4 | namespaceId 文法 35 字节 ASCII ⇒ 长度前缀 1 字节；namespace 域帧 namespaceId 恒在 `[21..56]`（UPDATE_CHUNK `[22..57]`）；路由键布局 = 同步维护契约，codec 侧加结构性守卫测试 | C4a/C4b（raw 定偏移读取 == 解码命名空间；双 namespace 无歧义） |
| S5 | ADR 0032 决策 5 | observer 发射点 = 拥有事实的一侧，事件字段集 append-only；降级（缺 `bufferedAmount`/ping/onPong → dormant）；免 listen 表达留待后续票 | §13 全量套件（observer/fault/real-transport 锚）；本票不新增 observer 面 |
| S6 | 协议 §1/§3/§13.1/§14 | 每帧消费单向 sequence、对端严格按期望值接收；envelope 头字节纪律；`SEQUENCE_VIOLATION` = connection fatal → close 1002；HELLO_ACK 前不得发 namespace frame | C1a（envelope 字节纪律）、C2a/C2b（fatal 分类与 close code） |
| S7 | `packages/ws-replication/AGENTS.md` | FSM 不变量（HELLO 门、每连接每 namespace 单生命周期、计数不回绕）、拓扑静态、注入 seam、生产 API 只经 `src/index.ts`、可编程适配器留在 testing 面 | C5a（导出面冻结）；C2c（单生命周期/合流）；§13 全量套件 |
| S8 | 根 `AGENTS.md` + `.github/workflows/ci.yml` | 全部 worktree 在 `.worktrees/`（本任务由 Host 固定 worktree）；typecheck 作业 = `pnpm typecheck` + `vitest --typecheck.only`；test 作业 = 6 分片 `*.test.ts`（`--typecheck.enabled=false`） | §14（入口证据） |
| S9 | 派工（SA6 权限） | 只改测试/fixture/最小复现脚本 + 固定报告；**不得改生产实现**；不得 skip/only/todo/env override/fallback/源码字符串断言 | 本文件全部断言 = 运行时行为 + wire 原字节；`git status` 只含新测试与报告（§16） |
| S10 | SA8 实现后复查（`task_issue-418_implementation_conflict_report.md`，`clear`） | 15 项决策面全 no-conflict/implements-existing-decision；冻结面（wire/错误码/observer/公共 API/配置/通道实现/既有测试/peer/决策文本）全部保持；R4''/R5''/R7''/R8'' 为跨票义务与重触发条件 | 复审按 S10 核对 C1~C6 与 C0 的落地证据（§17.3）；跨票义务登记 §15 U6/U7，不构成本票 AC 缺口 |

---

## 4. Environment and baseline

| 项 | 值 | 命令 / 证据 |
| --- | --- | --- |
| worktree | `/home/wangjian/nomicore-fix-issue-418`（Host 固定） | `pwd`、`git branch --show-current` = `mabf/issue-418` |
| HEAD | `27e012b6606e48797842a79e11e3505819c34cc6` | `git rev-parse HEAD` |
| 运行时 | node `v24.13.0`、pnpm `10.28.2`、vitest `3.2.7`、typescript `5.9.3` | `node -v`、`pnpm -v`、安装后 `node_modules/.bin` |
| 依赖安装 | `pnpm install --frozen-lockfile --prefer-offline` → 65 包 483ms，lockfile up-to-date | 安装日志（§16 记录） |
| 包测试基线（契约文件加入前） | **72 文件 / 518 用例全绿**，43.48s，`EXIT=0` | `artifacts/sa6-issue418-baseline-ws-replication.log` |
| 包 typecheck 基线 | `tsc -p packages/ws-replication/tsconfig.json` → `EXIT=0` | `artifacts/sa6-issue418-baseline-pkg-typecheck.log` |
| 包测试（契约文件加入后） | **73 文件 / 535 用例全绿**，`EXIT=0` | `artifacts/sa6-issue418-final-package-suite.log` |
| 根 typecheck | `pnpm typecheck`（15 个 tsconfig 串行）→ `EXIT=0`；契约文件最终形态复核 `EXIT=0` | `artifacts/sa6-issue418-root-typecheck.log`、`artifacts/sa6-issue418-root-typecheck-final.log` |
| 根全量测试 | `pnpm test`（`vitest run --typecheck`，含 `*.test-d.ts`）→ **436 文件 / 5260 用例全绿，`Type Errors: no errors`，407.63s，`EXIT=0`** | `artifacts/sa6-issue418-root-test.log` |
| 新契约文件单独运行 | 17/17 用例绿，连续 3 次运行一致；含 tsc 通过 | `pnpm exec vitest run packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts --typecheck.enabled=false` |
| **复审：最终实现聚焦（SA6 契约 17 + C0 结构 9）** | **26 用例全绿，1.58s，`EXIT=0`**（SA6 契约文件字节未改，mtime 2026-09-21 22:31） | `artifacts/sa6-issue418-revalidation-focused.log` |
| **复审：最终实现包全量** | **75 文件 / 569 用例全绿，44.55s，`EXIT=0`**（含 real-transport/liveness/backpressure/GOAWAY 族与 I13 两锚：`ac7-faults` 12/12、`issue171-red` 5/5） | `artifacts/sa6-issue418-revalidation-package-suite.log` |
| **复审：包 / protocol typecheck** | 两者 `EXIT=0` | `artifacts/sa6-issue418-revalidation-pkg-typecheck.log`（`PKG_EXIT=0`、`PROTO_EXIT=0`） |
| **复审：根 `pnpm typecheck`** | 15 个 tsconfig 串行 `EXIT=0` | `artifacts/sa6-issue418-revalidation-root-typecheck.log` |
| 复审：根 `pnpm test`（AC5 全量门） | **439 文件 / 5299 用例全绿，`Type Errors: no errors`，427.19s，`EXIT=0`**（含契约 17 + 结构 9 + 矩阵 25 + codec 守卫 5） | `artifacts/sa6-issue418-revalidation-root-test.log` |

基线口径：本票是重构，**基线绿是预期事实**（skill：Refactor 契约记录为何基线应为绿），因此新增契约文件在 HEAD 上初始全绿即为「回归契约成立」的证据；其红灯形态应由实现期违反任一 C1~C6 时出现（§12/§13 给出敏感性反证）。

---

## 5. Positive reproduction（能力缺口的事实复现：拆分入口不存在）

任务类型为重构 ⇒ 无「用户可见故障」可复现；本节复现的是 **ADR 决策 1/2 所要求的能力在当前 HEAD 确实缺失**（不是缺陷，而是能力缺口）。证据来自临时运行时探针（§16 已删除）：

```
GAP1 {"productionExports":[DEFAULT_REPLICATION_*, NOMICORE_*_SERVICE, createHub[Peer]Replication,
       createHub[Peer]ReplicationPlugin, requireHub[Peer]Replication],
      "hubConnectionModuleExports":["createHubReplication"],
      "hubNamespaceModuleExports":["HubNamespaceChannel"],
      "hasEdgeFactory":false,"hasSessionFactory":false}
GAP2 {"hostMembersAccessed":["authorize","limits","observerPresent","peerInstanceId","timeouts"]}
```

事实链（源码符号）：

1. `src/hub-connection.ts` 只有 `createHubReplication` 一个导出；承载连接级 FSM 的 `HubConnectionImpl`（451 行起）是**模块私有类**——没有任何导出面能独立构造连接级半边（envelope/sequence、HELLO、liveness、GOAWAY/reauth、连接级背压全在该类内联实现）。
2. 连接级与 namespace 级之间**已存在**的接口是 `HubChannelHost`（`hub-namespace.ts:52-100`），但它由 `HubConnectionImpl` 以**内联对象字面量**实现（`hub-connection.ts:512-555`）——缝是类型，不是模块；`HubNamespaceChannel` 要跑起来必须由调用方手写一整套连接级语义（`sendControl/sendData/sendUpdateChunk/chunkedUpdateNegotiated/dataGateOpen/onDataQueued/requestDataDrain/connectionFatal/onChannelSettled/tryBeginInboundAssembly/…`）。
3. GAP2 探针（Proxy host + `new HubNamespaceChannel(...)` + `startOpen`）显示 namespace 半边在实例化/开通道即读取连接级职责成员；按 ADR 决策 1，宿主自写这套语义 = fork 协议实现（被否决）⇒ 现状**无合法的独立实例化路径**。
4. 于是 ADR 背景所列的宿主诉求（nomic-server 按 `hash(namespaceId)` 把 namespace 的 registry/runtime/persistence 分片到 worker_threads，session CPU 落 home worker）在当前结构下不可达：唯一公共缝 `accept`/`acceptTrusted` 是**整条连接粒度**（`types.ts:161-180`）。

**复审状态（iteration 1，缺口已闭合）**：上述缺口是 HEAD `27e012b` 的**基线事实**，不是失败行为；最终实现按设计 D1 交付两个独立内部模块——`createHubReplicationEdge`（`hub-edge.ts`，注入 transport/authorize/sessionFactory，零 Registry 依赖）与 `createHubSessionHost`（`hub-session.ts`，注入 port/registry），缝类型在 `hub-split.ts`，单体 `hub-connection.ts` 以函数调用组合两半。缺口闭合的可执行证据 = `ws-replication-issue418-edge-session-split-structure.test.ts`（C0a~C0d，9 用例，本轮复跑全绿，§17.2/§17.3）；`grep` 复核 `HubConnectionImpl` 仅存于 3 处注释（无活符号），iteration 1 被删机制（`OpenEntry`/`PendingEvent`/`settlePending`/`sunkNames`/`pendingNames`/`dropPendingEntries`/`authorizeFirstOpen`/`replayAuthorization`）在 `src/` 零命中。

---

## 6. Negative control

契约文件内建 4 组负控（全绿）：

| 负控 | 输入 | 期望（并实测） |
| --- | --- | --- |
| C2d | 正确序列的 OPEN_NAMESPACE（seq 2） | authorize 恰一次（`peer-alpha`,`ns-…0001`）+ OPEN_OK + 连接保持可用（后续 CLOSE_NAMESPACE→CLOSE_OK）+ 零 ERROR + 零 close |
| C2c | 同 namespace 第二次 OPEN_NAMESPACE（seq 3） | 第二个 OPEN_OK；authorize **仍恰一次**（合流；ADR 决策 3）；零 fatal |
| C3c | hub-only fixture 复现 driver 全栈的 HELLO_ACK | 与冻结 hex 逐字节相等（跨 harness 路径可复现 ⇒ 金标非偶然） |
| C6a | 未变异 HELLO_ACK 按 expectedSequence=1 | 解码成功（`undefined`）；变异后（expectedSequence=2 / 占位 0 / 撞序）→ `SEQUENCE_VIOLATION` |

**复审补充（iteration 1，最终实现）**：C0 结构测试与矩阵的负控同样全绿——C0a-负控（deny 授权器 → 拉取 `{outcome:'denied'}`、零 OPEN_OK）；C0b-denied（`NAMESPACE_UNAUTHORIZED` + 3 事件 + settled 且 `registry.open` **零调用**）、C0b-throw（`INTERNAL_ERROR` + 零 `registry.open`）、C0b-fail-loud（`openAdmission` reject〔台账缺失〕→ 响亮 `INTERNAL_ERROR`，非静默）；C0d 负控（未投递 ns 的 ERROR 静默、无通道 revoke no-op、close 幂等）；codec 守卫 2 个例外负控（namespace-scope ERROR 定偏移非 nsId、HELLO_ACK 不上 ns 路由表）；M1 十臂 `resolve-ok`/`resolve-deny` 对照 + M1-revoke 对 HEAD stash 基线。以上均在本轮 R1/R2/R5 中绿（§17.2）。

---

## 7. Stability, scale and timing

| 项 | 观察 | 证据 |
| --- | --- | --- |
| 契约文件稳定性 | 17/17 绿，连续 3 次独立进程运行结果一致（`Test Files 1 passed`、`Tests 17 passed`）；**复审在最终实现上复跑 3 次一致（26/26，含结构 9）** | §13 命令 4/8、`artifacts/sa6-issue418-revalidation-focused.log` |
| 全量包套件稳定性 | 基线 518 用例（iteration 0）与契约后 535 用例（iteration 0）各 `EXIT=0`；**最终实现 75 文件/569 用例 `EXIT=0`（复审）**；单 worker（`maxWorkers:1`，`vitest.config.ts`） | §4 日志、§17.2 R2 |
| 序列/帧计划跨进程稳定 | 单 ns 场景 hub→peer 帧计划 `HELLO_ACK 69 → OPEN_OK 91 → BOOTSTRAP_SNAPSHOT → SYNC_STEP1 → SYNC_STEP2 61 → SYNC_APPLIED 58 → UPDATE_ACK 57` 在 ≥6 次独立进程采集中 kind 序列与 raw `[8..12]` 恒为 1..N；非 Yjs 帧 hex（HELLO_ACK/OPEN_OK/UPDATE_ACK/ERROR/GOAWAY/CLOSE_OK）逐字节一致 | §9 E3 |
| **不可冻结边界** | Yjs 载荷帧（BOOTSTRAP_SNAPSHOT / SYNC_STEP1 / peer UPDATE）的 payload 字节**跨进程不稳定**（Yjs `clientID` 由库内部随机生成；同一进程两次采集亦不同）；其帧长在 6/6 次采集中一致但按 varint 长度存在理论 ±1 风险 ⇒ 契约只锚定 envelope + 解码语义，不冻结该 payload（**不软化**：同帧的 `byteLength ≡ 20 + payloadLength`、kind、namespaceId、sequence 全部仍被断言） | §9 E3、C3a 注释 |
| 时序/规模 | 全部断言在 fake scheduler + 显式 defer 泵下进行（零真实 sleep、零 wall-clock 依赖）；双 namespace 场景用 `settleUntil` 谓词推进（预算 3000 轮，实测 <20ms） | `harness.ts:250-268`、C1c/C4b |
| 规模面 | 契约覆盖 1 连接 ×（1 与 2 个 namespace）、控制帧与数据帧混排、入站 gap/repeat/正常三类；更大规模（多连接、chunked 传输、真实 TCP）由既有 72 文件 + 本票 3 新文件（最终 75 文件/569 用例）套件承担（§10、§17.2 R2） | §10、§13 |

---

## 8. Capability-gap chain（重构能力缺口，非缺陷根因）

| Step | Fact | Evidence | Confidence |
| --- | --- | --- | --- |
| 1 | 连接级 FSM（envelope/sequence、HELLO/capability、liveness、GOAWAY/reauth、连接级背压）与 namespace 级 FSM 目前同处一个模块私有类 | `hub-connection.ts:451-1145`（`HubConnectionImpl`，class 未导出）；`hub-namespace.ts:104+`（`HubNamespaceChannel`） | 高 |
| 2 | 两者之间的缝只是**接口**：`HubChannelHost` 由 `HubConnectionImpl` 内联对象实现，非可独立实例化模块 | `hub-namespace.ts:52-100` vs `hub-connection.ts:512-555` | 高 |
| 3 | 运行时无任何独立实例化入口（无 edge/session 工厂，`hub-connection` 模块仅导出 `createHubReplication`） | GAP1 探针（§5） | 高 |
| 4 | namespace 半边的实例化必须由调用方手写连接级职责面（GAP2：`authorize/limits/timeouts/peerInstanceId/observerPresent` 等被读取） | GAP2 探针（§5） | 高 |
| 5 | 因此 ADR 决策 1/2 的目标形态（两半可独立实例化、单体 = 进程内组合、协议状态机单份）当前**不存在**；公共缝只有整连接粒度的 `accept`/`acceptTrusted` | `types.ts:161-180`；ADR 0032 背景节 | 高 |
| 6 | 拆分必须保持的可观察事实（sequence 单点、分派前收口、wire 字节、API/配置面）在 HEAD 已成立，故属「保持」而非「修复」 | C1~C6 全绿（§13） | 高 |

放大/风险因素（供设计期定风险位）：出站 sequence 若被 session 侧二次记账（占位 0 或 per-session 计数）⇒ 接收侧 `SEQUENCE_VIOLATION`（C6 反证）；入站校验若被推到 session 之后 ⇒ authorize/namespace 副作用先于收口（C2a/C2b 断言零 authorize、零 OPEN_OK）；edge 若对每次 OPEN 都调用 authorize ⇒ C2c 红；路由键偏移若被 codec 字段序变更破坏 ⇒ C4 红。

**复审闭合（iteration 1）**：Step 1~5 描述的缺口已由实现闭合（§5 复审状态、§12.1、§17.3）；Step 6 的「保持面」在最终实现上由 C1~C6 未改全绿 + 包/根全量套件 + DENY 面零 diff 证实。四个放大风险位均有反向运行时证据：session 二次记账 → C1a~C1c 绿（`[8..12]` 恒 1..N、占位 0 不上线，C6a 反证）；入站校验后移 → C2a/C2b 绿（零 authorize、零 OPEN_OK）；edge 每 OPEN 重复 authorize → C2c 绿（恰一次）；路由偏移被破坏 → C4a/C4b + codec 守卫 5/5 绿。

---

## 9. Causal experiments

| # | 实验 | 方法 | 结论 |
| --- | --- | --- | --- |
| E1 | 模块面探针 | `await import('../src/hub-connection.js')` / `'../src/hub-namespace.js'` / `src/index.js` + 生产入口 `import *` | 无 edge/session 工厂；连接级半边不可独立实例化（§5 GAP1） |
| E2 | 依赖面探针 | Proxy host 传给 `new HubNamespaceChannel` 并 `startOpen`，记录被读取的宿主成员 | namespace 半边依赖连接级职责成员；独立实例化需手写连接半边（§5 GAP2） |
| E3 | 逐字节可冻结性判定（控制变量：同进程/跨进程、注入 peer 随机源） | driver `boot({random: () => 0.5})` ×6 独立进程 + hub-only fixture ×3 | 非 Yjs 帧跨进程逐字节稳定 ⇒ 可金标；Yjs 载荷帧（`clientID` 随机）不可跨进程冻结 ⇒ C3 边界（§7） |
| E4 | re-OPEN 合流语义 | hub-only：HELLO → OPEN(seq2) → OPEN(seq3) | 第二个 OPEN_OK + authorize 调用数恒 1（ADR 决策 3 现状事实）⇒ C2c |
| E5 | 失败形态反证 | 重写真实 HELLO_ACK 的 `[8..12]`（0 占位 / 撞序）后喂 codec | 均 `SEQUENCE_VIOLATION` ⇒ C1 的 1..N 断言是 wire 义务而非装饰（C6a） |
| E6 | 既有套件全量运行 | 包 72 文件（基线）/73 文件（+契约） | 基线全绿且加入契约后仍全绿 ⇒ 契约未改变任何生产行为（§13） |
| E7 | **复审：最终实现独立复跑**（iteration 1） | 契约+结构聚焦 ×3（26/26 一致）；包全量（75/75-569/569）；codec 守卫（5/5，根日志内）；包/protocol/根 typecheck；根全量（439/439-5299/5299，`Type Errors no errors`） | 契约在最终实现上未改全绿、C0 缺口闭合；AC4/AC5 门限独立复现（§17.2 R1~R5） |

---

## 10. Impact surface

| 面 | 内容 | 契约约束 |
| --- | --- | --- |
| 生产实现（实现期改动，SA6 不改） | **最终实现（复审口径）**：`src/hub-connection.ts`（1145→469，组合根 + 服务面 + 头注释）、`src/hub-namespace.ts`（**零 diff**，AC3）、`src/hub-edge.ts` / `src/hub-session.ts` / `src/hub-split.ts`（新增内部模块）；`frame-io.ts`（+57/-13 占位/盖章）、`backpressure.ts`（+54 字节形态） | C0 结构契约 + C1~C4 行为；§17.4 交付清单 |
| 消费方 | `src/plugin.ts`（Cordis 插件装配/服务发布，**零 diff**）、`apps/yjs-server/src/app.ts`（`acceptTrusted` 唯一生产 caller，零 diff）、`src/testing.ts`（测试面工厂，零 diff） | C5a（导出面冻结）；S7 |
| 公共契约面 | `src/index.ts` 11 个运行时导出 + `/testing` 5 个运行时导出 + 服务常量 + `DEFAULT_*` 三常量（16+10+3 值） | C5a/C5b（增删/改值即红） |
| 既有测试（必须保持逐字节绿灯） | 既有 72 文件（**零修改**）覆盖：golden/codec 互操作（issue246 interop）、real-transport 动态（sa7-r1/r2、issue243/287 real-transport）、fault 注入矩阵（ac7-faults、issue169/170/171/254）、observer 契约锚（observer-red、issue172、issue238）、auth/HELLO（auth-lifecycle-red、issue168）、backpressure（issue169、issue231）、liveness（issue170）、close/GOAWAY（issue174/175/176、reauth-lifecycle）、epoch/schema rearm（issue287）、chunked 矩阵（issue243/244/245/300/301）、API 类型（`ws-replication-api.test-d.ts` 33KB + `issue299-api.test-d.ts`）；**最终实现：包 75/75 文件 569/569 用例、根 439/439 文件 5299/5299 用例（含新测试），I13 两锚由构造转绿** | §13/§17.2 全量套件；AC4 枚举面全覆盖 |
| 非目标 | peer 侧（`peer-connection.ts`/`peer-namespace.ts`）、wire 格式、`docs/protocols` 文本 | §1 范围界定 |

---

## 11. Ruled-out hypotheses

| 假设 | 判定 | 依据 |
| --- | --- | --- |
| 「这是 Bug 任务，存在可复现缺陷」 | **排除** | 任务类型 = wide refactor（简报标题/正文）；基线 518/518 + 契约 17/17 全绿；无失败行为可复现 |
| 「出站 sequence 目前不是单点分配，拆分前需先修」 | **排除** | `OutboundQueue.emitOne`（`frame-io.ts:157-174`）在出帧时单点分配并编码；C1a/C1c 证明 raw `[8..12]` 恒 1..N 且跨 namespace 共用 |
| 「入站 expectedSeq 目前不在分派前校验」 | **排除** | `HubConnectionImpl.onMessage`（`hub-connection.ts:666-682`）先 `decodeInbound(expectedSequence)` 后 `expectedSeq = sequence + 1`，再分派；C2a/C2b 证明 gap/repeat 零 namespace 副作用 + close 1002 |
| 「`HubChannelHost` 缝已足以独立实例化两半（无需模块化）」 | **排除** | GAP1/GAP2（§5/§9 E1/E2）：缝是接口而非模块，实现内联于模块私有类 ⇒ 宿主自写 = 协议 fork（ADR 明示否决） |
| 「本票会引入新公共 API / 新配置」 | **排除** | issue 明文零新公共 API/零配置变化；C5a/C5b 冻结运行时导出名集合与 DEFAULT_* 全值 |
| 「wire 字节会随拆分变化（如序列占位落线）」 | **排除为不可接受态** | C1/C3/C6 把非 Yjs 帧逐字节 + 全部帧 envelope/序列钉死；占位泄漏在接收侧必被拒（C6a） |
| 「Yjs 载荷帧也可逐字节冻结」 | **排除** | E3：`clientID` 随机 ⇒ payload 跨进程不稳定；契约以 envelope + 解码语义锚定（§7 边界，已在测试头注释显式登记） |
| 「peer 侧需同步拆分」 | **排除** | ADR 0032 后果节：peer 侧对称拆分留待后续（non-goal） |
| 「C0a~C0d 在实现后仍不可执行 / 契约在拆分后失效」 | **排除（复审 iteration 1）** | 结构测试 9/9 + SA6 契约 17/17 在最终实现上未改全绿（§17.2）；契约文件字节/mtime 未变；实现导入面与设计 D1 命名一致 |
| 「实现期改动了既有测试面或 SA6 契约文件」 | **排除（复审）** | `git diff --name-only HEAD -- packages/ws-replication/test` = **0**（既有 72 文件）；契约文件零 seam 引用、mtime 2026-09-21 22:31；SA10 §2 AC4 独立核验一致 |

---

## 12. Acceptance contract and test paths

### 12.1 C0 — 结构契约（AC1/AC3；**可执行形态依赖设计期模块命名**）

本票要求零新公共 API ⇒ 两半只能是**内部模块**；`packages/ws-replication` 既有先例是测试直接相对导入内部模块（`../src/frame-io.js`、`../src/backpressure.js`、`../src/update-channel.js`、`../src/liveness.js` 等），因此实现必须交付以下**白盒证据**（SA6 不在命名前硬编码；设计与实现期落地，SA7/SA6 复审时按此口径核对）：

| 编号 | 要求 | 验收判据（运行时行为，非源码字符串） |
| --- | --- | --- |
| C0a | edge 半边可**单独实例化**（普通工厂 + 注入 transport），不依赖 Registry/authorizer/完整 hub 服务 | 独立测试构造 edge + stub session sink，跑完 HELLO→OPEN→ns 帧脚本，产出帧与本文件 C3a 金标逐字节相等、序列 raw `[8..12]` 恒 1..N |
| C0b | session 半边可**单独实例化**（注入 edge 提供的 seam 实现：sendControl/sendData/dataGateOpen/onDataQueued/requestDataDrain/channelSettled…），authorize 结果以投影注入 | 独立测试构造 session + stub edge host，驱动一个 namespace 全生命周期（OPEN_OK→BOOTSTRAP→SYNC→CLOSE_OK），namespace 域帧字节/序列与 C1d/C3a 对齐；`HubNamespaceChannel` 生产代码零 diff（AC3） |
| C0c | 单体 listen 路径 = 两半的**进程内组合**（函数调用缝），协议状态机单份 | C1~C4 在上述组合下保持全绿；无「单体分支 vs 拆分分支」双实现（结构审阅 + 无重复 FSM 符号） |
| C0d | 缝上只有 namespace 域帧 + 4 控制信号；连接级帧（HELLO/HELLO_ACK/GOAWAY/连接级 ERROR）不上缝 | 白盒断言：edge→session 投递序列中不含连接级 kind；连接级帧由 edge 直接出站（C3b GOAWAY/C2a ERROR 金标为外部对照） |

C0 的现状（iteration 0）：**缺口成立**（§5/§8），基线不提供可执行红灯；C0a~C0d 是进入设计与实现的门禁口径，不是伪红。

C0 的现状（**复审 iteration 1：已闭合**）：实现交付 `packages/ws-replication/test/ws-replication-issue418-edge-session-split-structure.test.ts`（9 用例；本轮复跑 9/9 绿，§17.2），按上表逐项落地——C0a 2 用例（到达点投递〔authorize 未结算〕+ `port.openAdmission` 拉取 authorized + `FROZEN_HELLO_ACK_HEX`/`FROZEN_OPEN_OK_HEX` 逐字节 + raw `[8..12]==[1,2]` + authorize 恰一次；负控 = deny 拉取零 OPEN_OK）、C0b 4 用例（stub port 四形态臂：authorized 全生命周期 `OPEN_OK→BOOTSTRAP_SNAPSHOT→SYNC_STEP2→SYNC_APPLIED→CLOSE_OK` + 占位帧 `[8..12]==0`；denied/throw 零 `registry.open` + 真实通道 ERROR/事件族/settled；reject 台账缺失 → 响亮 `INTERNAL_ERROR`）、C0c 2 用例（`hub-connection` 导出面 `['createHubReplication']`、edge/session 各单工厂、缝模块零运行时导出；单体 `acceptTrusted` 产物暴露 edge 面）、C0d 1 用例（缝投递序列零连接级 kind、到达点锁步、窗口帧零缓冲零回放、revoke 在场/no-op、close 幂等）。C0d 的「无二相 entry/无结算回放」以**行为证明**交付（设计 §12 明文「源文本扫描或行为证明」二选一，SA2 N2' 建议优先行为证明）；FSM 单份的静态面由 SA8/SA9 亲读裁决（`hub-edge` 连接 FSM 唯一、`hub-namespace` 通道 FSM 唯一零 diff），复审复核 `HubConnectionImpl` 无活符号、被删机制零残段（§5 复审状态）。C0 在 HEAD 无红灯为设计事实（重构语义等价），不伪称红灯。

### 12.2 C1~C6 可执行契约（本报告唯一新增测试文件）

`packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts`（17 用例，HEAD 全绿）：

| 编号 | 用例 | 最小输入 | 可观察断言（运行时/wire 原字节） | 负控/敏感性 |
| --- | --- | --- | --- | --- |
| C1a | 单点出站序列 + envelope 字节纪律 | driver `boot({random:0.5})` + peer 写 | 帧计划（kind/长度）+ raw `[8..12]` == 1..N + magic/version/flags/reserved/长度一致性 + 序列含连接级与 namespace 域帧 | C6a（撞序/占位 → 接收侧拒） |
| C1b | 会话记账序 == wire 序 | 同上 | `BOOTSTRAP_ACK.ackedSequence == 3`（hub 快照 raw 序）、`SYNC_APPLIED.ackedSequence == 5`（hub STEP2 raw 序） | 若 session 记占位序 → 红 |
| C1c | 单分配点跨 namespace | 一条连接 + 2 个 hub namespace | 全帧 raw 序 == 1..N；两个 namespaceId 共用同一序列；各 ns 完成 OPEN_OK→BOOTSTRAP→SYNC_APPLIED | 若 per-session 计数 → 撞序 → 红 |
| C1d | CLOSE_OK 记账与出站序 | hub-only：HELLO/OPEN/CLOSE_NAMESPACE | 出站序 [1,2,3,4]；`CLOSE_OK.ackedSequence == 3`（入站 raw 序）；CLOSE_OK 全帧 hex 冻结 | 入站记账若丢/错 → 红 |
| C2a | 入站 gap → 连接级 fatal | hub-only：HELLO(seq1) + OPEN(seq5) | ERROR `SEQUENCE_VIOLATION`（**无 namespaceId**）+ 全帧 hex 冻结 + close(1002,'protocol-error') + authorize 0 次 + 零 OPEN_OK | 正控 C2d |
| C2b | 入站 repeat → 同款 fatal | HELLO(seq1) + OPEN(seq1) | 同上（ERROR 序列恰 1 个） | — |
| C2c | re-OPEN 合流 | HELLO + OPEN(seq2) + OPEN(seq3) | 2×OPEN_OK；authorize 恰 1 次；零 ERROR；零 close；序列 [1,2,3,4] | 若 edge 每 OPEN 都 authorize → 红 |
| C2d | 控制组（正控） | HELLO + OPEN(seq2) | OPEN_OK hex 冻结 + authorize 恰 1 次（入参身份+namespaceId）+ 零 ERROR + 连接可用（CLOSE→CLOSE_OK） | — |
| C3a | 非 Yjs 帧逐字节 | driver 单 ns 场景 | HELLO_ACK/OPEN_OK/UPDATE_ACK 全帧 hex == 冻结值；快照 envelope/解码语义；全帧 `byteLength ≡ 20+payloadLength` | 任一字节改动 → 红 |
| C3b | GOAWAY 逐字节 | hub-only + `requestReauth` | GOAWAY 全帧 hex == 冻结值；`reasonCode == REAUTH_REQUIRED`；`drainTimeoutMs == closeTimeoutMs`；raw 序 == 帧序号 | — |
| C3c | 跨 harness 可复现 | hub-only HELLO | HELLO_ACK hex == driver 金标 | — |
| C4a | 路由键定偏移（单 ns） | driver 单 ns 场景 | 每个 namespace 域帧 raw `[21..56]` == nsId 且 `[20] == 35`；连接级帧负控不等于 nsId | ADR 决策 4 |
| C4b | 路由键定偏移（双 ns） | 一条连接 + 2 ns | 定偏移读取 == 解码 namespaceId，集合 == {nsA, nsB} | — |
| C5a | 公共 API 面冻结 | `import *` 生产入口 + `/testing` | 运行时导出名排序集合 == 冻结列表；两个服务常量值冻结 | 新增/删除导出 → 红 |
| C5b | 配置面冻结 | `DEFAULT_*` | 三常量全值 `toEqual` 冻结字面量 + `Object.isFrozen` | 任一键增删/改值 → 红 |
| C5c | 重复采集一致 | 两次独立 `boot` | 非 Yjs 帧 hex 列表相等 + kind 计划相等 + 第二次 raw 序 1..N | — |
| C6a | 契约敏感性反证 | 真实 HELLO_ACK 字节变异 | 未变异 + expected 1 → 解码成功；变 expected 2 / 占位 0 / 撞序 → `SEQUENCE_VIOLATION` | 证明 C1 断言 = wire 义务 |

**旧实现（HEAD 单体）与目标实现（拆分后）预期结果**：C1~C6 在两态**均须全绿**（重构语义等价）——复审在最终实现上已证实（17/17）；C0a~C0d 在 HEAD **缺口**、在目标实现后必须可执行且绿——复审亦已证实（structure 9/9，§12.1 复审段）。两者差异仅结构，不产生新行为断言——这正是本报告的诚实口径（不伪造红灯）。

---

## 13. Red/green or baseline evidence

```text
# 1) 安装（worktree 无 node_modules）
pnpm install --frozen-lockfile --prefer-offline          # 65 包 / 483ms / exit 0

# 2) 包测试基线（契约文件加入前，HEAD 27e012b）
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/ws-replication \
  --typecheck.enabled=false --passWithNoTests=false
#   Test Files  72 passed (72)
#   Tests       518 passed (518)
#   Duration    43.48s
#   EXIT=0                                  → artifacts/sa6-issue418-baseline-ws-replication.log

# 3) 包 typecheck
pnpm exec tsc -p packages/ws-replication/tsconfig.json   # EXIT=0
                                            → artifacts/sa6-issue418-baseline-pkg-typecheck.log

# 4) 新增契约文件（17 用例；3 次独立运行一致）
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run \
  packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts \
  --typecheck.enabled=false --passWithNoTests=false
#   Test Files  1 passed (1) / Tests 17 passed (17)   ×3

# 5) 包测试（契约文件加入后，全量集成）
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/ws-replication \
  --typecheck.enabled=false --passWithNoTests=false
#   Test Files  73 passed (73)
#   Tests       535 passed (535)
#   EXIT=0                                  → artifacts/sa6-issue418-final-package-suite.log

# 6) 根 typecheck（15 个 tsconfig 串行）
pnpm typecheck                                           # EXIT=0
                                            → artifacts/sa6-issue418-root-typecheck.log

# 7) 根全量测试（vitest run --typecheck，含 *.test-d.ts）
pnpm test
#   Test Files  436 passed (436)
#   Tests       5260 passed (5260)
#   Type Errors no errors
#   Duration    407.63s
#   EXIT=0                                  → artifacts/sa6-issue418-root-test.log
#   含本契约文件：…issue418-edge-session-split-contract.test.ts (17 tests)
```

```text
# 8) 复审（iteration 1，最终实现 + SA7/SA9/SA10 已批准；SA6 契约文件字节未改）
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run \
  packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts \
  packages/ws-replication/test/ws-replication-issue418-edge-session-split-structure.test.ts \
  --typecheck.enabled=false --passWithNoTests=false
#   Test Files  2 passed (2)
#   Tests       26 passed (26)   1.58s   EXIT=0
#   → artifacts/sa6-issue418-revalidation-focused.log

NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/ws-replication \
  --typecheck.enabled=false --passWithNoTests=false
#   Test Files  75 passed (75)
#   Tests       569 passed (569)   44.55s   EXIT=0
#   → artifacts/sa6-issue418-revalidation-package-suite.log
#   含 I13 两锚：ac7-faults (12) / issue171-red (5)

pnpm exec tsc -p packages/ws-replication/tsconfig.json          # PKG_EXIT=0
pnpm exec tsc -p packages/replication-protocol/tsconfig.json    # PROTO_EXIT=0
#   → artifacts/sa6-issue418-revalidation-pkg-typecheck.log

pnpm typecheck                                                  # EXIT=0（15 tsconfig 串行）
#   → artifacts/sa6-issue418-revalidation-root-typecheck.log

pnpm test
#   Test Files  439 passed (439)
#   Tests       5299 passed (5299)
#   Type Errors no errors
#   Duration    427.19s   EXIT=0
#   → artifacts/sa6-issue418-revalidation-root-test.log
#   含本契约文件 (17) + structure (9) + matrix (25) + codec 守卫 (5)
```

根全量测试（AC5）结果（iteration 0 基线）：**436 文件 / 5260 用例全绿，`Type Errors: no errors`，407.63s，`EXIT=0`**（含本契约文件 `…edge-session-split-contract.test.ts (17 tests)`；日志 `artifacts/sa6-issue418-root-test.log`）。根 typecheck 在契约文件最终形态上复核：`EXIT=0`（`artifacts/sa6-issue418-root-typecheck-final.log`）。

**复审结论（AC4/AC5 最终态，iteration 1）**：SA6 契约文件**未被实现期触碰**（mtime 2026-09-21 22:31，内容零 seam 引用），在最终实现上 17/17 全绿；结构与矩阵两新增测试文件 34（9+25）用例在包全量内绿；包 75/75 文件、根 439/439 文件 5299/5299 用例、`Type Errors: no errors`、包/protocol/根 typecheck 全 `EXIT=0` —— 与 SA3 §6、SA7 §8/§9、SA9 §8.2、SA10 §2 的既有证据**独立复现一致**（§17.2）。

---

## 14. Runner trigger evidence

| 项 | 证据 |
| --- | --- |
| 收集模式 | `vitest.config.ts` `test.include = ['packages/*/test/**/*.test.ts', …]` ⇒ 新文件 `…edge-session-split-contract.test.ts`、`…edge-session-split-structure.test.ts`、`…pending-window-matrix.test.ts`、`packages/replication-protocol/test/codec-namespace-routing-key-offset.test.ts` 自动落入收集面 |
| 实跑入口 | 上表命令 4/5/7（iteration 0）与命令 8（iteration 1 复审）均通过仓库真实入口（根 `pnpm exec vitest` / `pnpm test`）执行；包过滤器 `packages/ws-replication` 在最终实现命中 **75 文件 / 569 用例** |
| CI 门禁 | `.github/workflows/ci.yml`：typecheck 作业 = `pnpm typecheck` + `vitest run --typecheck.only`；test 作业 = `scripts/ci-test-shard.mjs` 6 分片（磁盘枚举，新文件自动入片，`--passWithNoTests=false` 防假绿）；contract-gates 作业含显式契约步骤 |
| 文件计数 | 契约前 72 个 `*.test.ts` → 契约后 73 个 → **最终实现 75 个**（+structure、+matrix；`ls packages/ws-replication/test/*.test.ts | wc -l`）；根全量 436 → **439** 文件（+3） |
| 类型面 | `packages/ws-replication/tsconfig.json` include `test/**/*.ts` ⇒ 契约/结构/矩阵三文件受包 typecheck 与根 typecheck 覆盖（复审全 `EXIT=0`） |
| 无伪门 | 契约/结构/矩阵/codec 守卫四文件零 `skip/only/todo`、零 env override、零 fallback、零源码字符串断言（断言面 = 运行时行为 + wire 原字节；复审 grep 复核 = 0 命中） |

---

## 15. Unknowns and blockers

| # | 事项 | 影响 | 处置 |
| --- | --- | --- | --- |
| U1 | 无 418 专属 SA8 设计产物（模块名/工厂签名/缝类型未定） | C0a~C0d 的白盒测试无法在命名前落盘 | **已闭合（复审 iteration 1）**：设计 §7 D1 落定命名（`hub-split.ts`/`hub-edge.ts`/`hub-session.ts` + 两工厂），实现交付 `…edge-session-split-structure.test.ts`（C0a~C0d 9 用例），SA7/SA9/SA10 已按同一口径裁决，复审 9/9 绿（§12.1/§17.2） |
| U2 | Yjs 载荷帧 payload 跨进程不可逐字节冻结（`clientID` 随机） | 「wire 逐字节不变」在 Yjs 载荷上不能以跨进程金标证明 | **边界保持、已缓解**：契约锚定 envelope + 解码语义（C3a 注释/§7）；同场景**同进程**字节稳定性由 C5c 覆盖；SA7 探针 P1 追加「逐帧 decode → 按真实序 re-encode → hex 相等」的同进程等价证明（含 BOOTSTRAP_SNAPSHOT Yjs 载荷帧），C3 金标维持冻结面 |
| U3 | `src/hub-namespace.ts`「零改动」（AC3）属结构命题 | 无法用行为测试直接证明「未改」 | **已闭合（复审）**：`git diff --stat HEAD -- …/hub-namespace.ts` 为空（内容命题；SA9 M-4 记录 mtime 触碰非内容差）；C0b 白盒 + C2c/C2d 语义锚绿 |
| U4 | `listen:false` / SessionHost 服务面 / `createHubReplicationEdge` 导出 | issue 声明后续票导出；若实现期提前导出则 C5a 会红 | **已闭合（复审）**：实现**未提前导出**——两工厂/缝类型仅模块级导出，`index.ts`/`testing.ts` 零 diff，C5a/C0c 绿（SA10 §3 确认无 scope creep） |
| U5 | 根 `pnpm test` 全量套件（436 文件/5260 用例）在 iteration 0 写作时仍在运行 | AC5 最后一格证据 | **已闭合**（iteration 0）；**复审在最终实现上复跑**：439/439 文件、5299/5299 用例、`Type Errors: no errors`、`EXIT=0`（§13 命令 8） |
| U6 | 非阻断残余（SA4 O1/O2/O4、SA7 F-1、SA9 M-1/M-2/M-3、R4'） | 类型违约授权器角落、双不可达角落、注释/排版——**均非本票 AC 缺口** | 维持上游裁决：M-1（fulfillment try/catch 兜底 + 注释修正）与 M-2/M-3（注释/排版）路由 implementation 后续小改；R4' 为登记不伪造测试；SA10 §5 要求按口径在 PR 描述披露 |
| U7 | 跨票义务：R4''（有界缓冲重入）、R5''（worker 前置裁决）、R7''（ADR 0032:22 / CONTEXT.md:230 文本调和 deadline）、R8''（重触发条件） | 不构成本票缺口；worker 形态票的前置门禁 | 按 SA8 实现后复查 §8 原文存续并跟踪；R7'' deadline = worker 形态票 SA8 前置门禁之前或之中；本票未触碰 docs（DENY 零 diff，合规） |
| U8 | 本地交付的暂存约束：生产新增源码为**未跟踪**文件 | `git commit -am`/`git add -u` 会漏掉 3 个新 src 模块 ⇒ 导入失败、构建/测试全红 | **必须显式入暂存**（§17.4 清单）：3 新增 src + 4 新增测试；证据日志/wiki 报告按仓库既有惯例（1635 个 `wiki/raw`、223 个 `artifacts` 已跟踪）一并纳入或由 Controller 显式裁定排除 |

---

## 16. Temporary diagnostics cleanup

| 临时产物 | 用途 | 状态 |
| --- | --- | --- |
| `packages/ws-replication/test/zz-sa6-probe.test.ts` | wire 逐字节/帧计划采集（§9 E3） | **已删除** |
| `packages/ws-replication/test/zz-sa6-gap-probe.test.ts` | 模块面/依赖面能力缺口探针（§5 GAP1/GAP2） | **已删除** |
| `packages/ws-replication/test/zz-sa6-reopen-probe.test.ts` | re-OPEN authorize 合流探针（§9 E4） | **已删除** |
| 生产实现 | SA6 未做任何改动（含临时日志/probe）；复审同样零触碰 | iteration 0：`git status --porcelain` 仅含新增契约测试与报告；**复审**：`packages/ws-replication/src/**` 的三改三增均为 SA3 实现产物（非 SA6），SA6 复审只运行测试与写固定报告 |
| 常驻服务/后台进程 | 无（全部测试为零真实 sleep、fake scheduler；无端口/服务） | 后台 Job 全部收口（日志已落 `artifacts/`） |
| **复审（iteration 1）临时产物** | 未新增任何临时测试/探针/fixture；仅 **5 份**证据日志 `artifacts/sa6-issue418-revalidation-{focused,package-suite,pkg-typecheck,root-typecheck,root-test}.log` | `find packages -name "zz-*" -o -name "*probe*.test.ts"` 无 #418 残留（命中项均为其他包的既有跟踪测试）；`git stash list` 空 |
| SA7 探针残留复核 | SA7 两探针测试文件（`zz-sa7-issue418-*`）已由 SA7 删除 | 当前 worktree `zz-sa7*` 零存在；仅留 2 份运行日志 `artifacts/sa7-issue418-{dataflow,authorizer-violation}-probe.log`（SA7 声明不入 artifactPaths，见 §17.4 交付清单的排除建议） |
| 复审后台作业 | `pnpm typecheck`（bash-13）与 `pnpm test`（bash-14）两个后台 Job | 均已收口：`EXIT=0`；无残留进程/端口 |

---

## 17. Acceptance-contract revalidation（iteration 1：最终实现 + SA7 验证 + 已批准 SA9/SA10）

### 17.1 Revalidation scope and frozen state

本轮 = SA6 契约对**已完成实现**（SA3 iteration 2）在 SA7 动态验证与 SA9/SA10 终审已批准后的**原位复审**：核对契约条目是否仍成立、C0 缺口是否闭合、验收证据是否齐备、以及本地交付所需的 changed-path/staging 约束。

| 项 | 复审值 | 证据 |
| --- | --- | --- |
| worktree / 分支 / HEAD | `/home/wangjian/nomicore-fix-issue-418`、`mabf/issue-418`、`27e012b6606e48797842a79e11e3505819c34cc6` | `git rev-parse HEAD`、`git branch --show-current` |
| 实现 diff（生产面） | 3 改写：`hub-connection.ts`（790 行变更，主体为删除）、`frame-io.ts`（+57/-13）、`backpressure.ts`（+54）——合计 `3 files changed, 155 insertions(+), 746 deletions(-)`；3 新增未跟踪：`hub-edge.ts`、`hub-session.ts`、`hub-split.ts` | `git status --porcelain`、`git diff --stat HEAD`（§17.4 清单） |
| 测试面 | 既有 `packages/ws-replication/test` 72 文件**零修改**（`git diff --name-only` = 0）；新增 3 个 ws-replication 测试 + 1 个 replication-protocol 守卫测试；包 `*.test.ts` 72 → 75 | §17.4 |
| SA6 契约文件 | **未被实现期触碰**：mtime `2026-09-21 22:31:13`（早于实现冻结 `00:49:11`）；全文 seam 引用 grep = 0；`skip/only/todo`/env override/`readFileSync` 源码字符串断言 = 0 命中 | 本轮亲跑 grep/stat |
| DENY 面 | `hub-namespace.ts`、`index.ts`、`testing.ts`、`types.ts`、`defaults.ts`、`validate.ts`、`plugin.ts`、`peer-*.ts`、`replication-protocol/src/**`、`docs/**`、`CONTEXT.md`、`apps/**`、`vitest.config.ts`/`tsconfig*`/`package.json` —— `git diff --stat` **全空**；`git diff --check HEAD` 干净；`git stash list` 空 | 本轮亲跑 |
| 结构一致性 | `HubConnectionImpl` 仅存 3 处注释（无活符号）；iteration 1 被删机制（`OpenEntry`/`PendingEvent`/`settlePending`/`sunkNames`/`pendingNames`/`dropPendingEntries`/`authorizeFirstOpen`/`replayAuthorization`）在 `src/` **零命中**；出站盖章单点 `frame-io.ts:192`；入站 `expectedSeq` 收口 `hub-edge.ts:377-389` | 本轮亲跑 grep |

### 17.2 Revalidation runs（SA6 独立复跑，最终实现）

| # | 命令（真实仓库入口） | 结果 | 日志 |
| --- | --- | --- | --- |
| R1 | `vitest run …edge-session-split-contract.test.ts …edge-session-split-structure.test.ts --typecheck.enabled=false` | **2 文件 / 26 用例绿**（契约 17 + 结构 9），1.58s，`EXIT=0` | `artifacts/sa6-issue418-revalidation-focused.log` |
| R2 | `vitest run packages/ws-replication --typecheck.enabled=false` | **75 文件 / 569 用例绿**，44.55s，`EXIT=0`；含矩阵 25、契约 17、结构 9、I13 两锚（`ac7-faults` 12、`issue171-red` 5） | `artifacts/sa6-issue418-revalidation-package-suite.log` |
| R3 | `tsc -p packages/ws-replication/tsconfig.json`；`tsc -p packages/replication-protocol/tsconfig.json` | `PKG_EXIT=0`、`PROTO_EXIT=0` | `artifacts/sa6-issue418-revalidation-pkg-typecheck.log` |
| R4 | `pnpm typecheck`（15 tsconfig 串行） | `EXIT=0` | `artifacts/sa6-issue418-revalidation-root-typecheck.log` |
| R5 | `pnpm test`（`vitest run --typecheck`，含 `*.test-d.ts`） | **439 文件 / 5299 用例绿**，`Type Errors no errors`，427.19s，`EXIT=0`；含契约 17、结构 9、矩阵 25、codec 守卫 5 | `artifacts/sa6-issue418-revalidation-root-test.log` |
| R6 | 引用（不重跑）：SA3 HEAD stash 基线矩阵 | 25/25 绿（重定基后的到达点断言与 M1-revoke 资源断言 = HEAD 真值） | `artifacts/sa3-issue418-m1-head-baseline-iter2.log` |

R1~R5 与 SA3 §6、SA7 §8/§9、SA9 §8.2、SA10 §2/§4 的既有证据**独立复现一致**（用例计数与文件计数逐项相同）。

### 17.3 AC-by-AC revalidation

| Issue AC | 契约条目 | 复审证据（运行时/wire） | 下游裁决 | 状态 |
| --- | --- | --- | --- | --- |
| AC1 两半可独立实例化 + 单体 = 进程内组合 | C0a/C0b/C0c/C0d（§12.1） | 结构测试 9/9（R1/R2/R5）：C0a 2（到达点投递 + 拉取 + 冻结金标 + deny 负控）、C0b 4（全生命周期 + denied/throw 零 `registry.open` + reject 响亮）、C0c 2（导出面冻结/单体暴露 edge 面）、C0d 1（缝纪律 + 锁步 + 零回放 + 幂等）；结构复核：无活 `HubConnectionImpl`、被删机制零残段 | SA7 §3/§5 数据流与状态机全 ✅；SA9 §5 责任归属/文件范围 ✅；SA10 AC1 ✅ | **MET** |
| AC2 出站 sequence 单点盖章在 edge、入站 expectedSeq 校验在 edge | C1a~C1d、C2a~C2d、C6a（§12.2） | 契约 17/17（R1/R2/R5）；`writeBe32At` 单点 `frame-io.ts:192`；`expectedSeq` 收口 `hub-edge.ts:377-389`；占位 0/撞序被接收侧拒（C6a 反证） | SA7 §3 路线 4/5/6 ✅（placeholder 0 ↔ stamped N）；SA10 AC2 ✅ | **MET** |
| AC3 通道实现零改动（authorize 经注入 host） | C2c/C2d + `git diff` 门禁 | `git diff --stat HEAD -- hub-namespace.ts` 空（本轮亲跑）；C2c（恰一次）/C2d（入参逐值）绿；C0b 经 stub port 拉取（session 不可达真实授权器） | SA7 §4 零 diff 复核 ✅（SA4 O3/SA9 M-4 裁定 mtime 非内容差）；SA10 AC3 ✅ | **MET** |
| AC4 既有全量测试逐字节绿灯（含 I13 两锚） | C1~C6 + §13 全量套件 | 既有 72 文件零修改；包 75/75、569/569（R2）；矩阵 25/25 对 HEAD 基线一致；两锚 12/12、5/5 由构造转绿；非 Yjs 帧金标 C3a/C3b/C3c 绿 | SA7 §4 保持面全 ✅；SA9 §8.2 ✅；SA10 AC4 ✅ | **MET** |
| AC5 包 typecheck + 根 typecheck/test 绿灯 | §13 门禁清单 | R3/R4/R5 全 `EXIT=0`（包/protocol tsc；根 15 tsconfig；根 439/5299 无类型错误） | SA9 §8.2 验证门 ✅；SA10 AC5 ✅ | **MET** |

### 17.4 Changed-path and staging constraints（本地交付）

**A. 必须在交付变更集内（生产 + 测试，缺失即红）**

| 路径 | 状态 | 暂存动作 |
| --- | --- | --- |
| `packages/ws-replication/src/backpressure.ts` | 已跟踪 · 修改 | `git add`（更新） |
| `packages/ws-replication/src/frame-io.ts` | 已跟踪 · 修改 | `git add`（更新） |
| `packages/ws-replication/src/hub-connection.ts` | 已跟踪 · 改写（组合根 + 服务面） | `git add`（更新） |
| `packages/ws-replication/src/hub-edge.ts` | **未跟踪 · 新增**（edge 半边，连接 FSM 唯一实现） | **显式 `git add`** |
| `packages/ws-replication/src/hub-session.ts` | **未跟踪 · 新增**（session 半边） | **显式 `git add`** |
| `packages/ws-replication/src/hub-split.ts` | **未跟踪 · 新增**（缝契约类型） | **显式 `git add`** |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts` | **未跟踪 · 新增**（SA6 契约，17 用例） | **显式 `git add`** |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-structure.test.ts` | **未跟踪 · 新增**（C0a~C0d，9 用例） | **显式 `git add`** |
| `packages/ws-replication/test/ws-replication-issue418-pending-window-matrix.test.ts` | **未跟踪 · 新增**（M1/M2/M3，25 用例） | **显式 `git add`** |
| `packages/replication-protocol/test/codec-namespace-routing-key-offset.test.ts` | **未跟踪 · 新增**（决策 4 守卫，5 用例） | **显式 `git add`** |

**关键约束**：生产新增三模块是未跟踪文件，且被 `hub-connection.ts`/`hub-edge.ts`/`hub-session.ts` 相互 import（`hub-connection` → 两工厂 + 缝类型）。若交付时使用 `git commit -am`、`git add -u` 或仅勾选已跟踪文件，**三个新 src 模块与四个新测试文件会被静默遗漏**，交付分支在 clean checkout 上立即编译/运行失败（`Cannot find module './hub-edge.js'`）。交付前必须 `git status --porcelain` 复核 `??` 项全部转为 `A `，并在 clean checkout（新 worktree / 临时 clone，含上表全部 10 个路径）上复跑 §17.2 R1/R2 作为最低门禁。

**B. 建议随交付纳入（仓库既有惯例；非生产面，但属本次任务的证据链）**

| 路径 | 依据 |
| --- | --- |
| `wiki/raw/task_issue-418*.md`（简报、design、design_conflict_report、implementation_conflict_report、sa2/sa3/sa4/sa6/sa7/sa9/sa10） | 仓库已跟踪 1635 个 `wiki/raw` 文件，同任务前例（issue-72/79 等）报告均入库 |
| `artifacts/sa3-issue418-*.log`（含 `-iter2`）、`artifacts/sa7-issue418-*.log`、`artifacts/sa6-issue418-*.log`（含本轮 `revalidation-*` 5 份） | 仓库已跟踪 223 个 `artifacts` 项（含 `local-packages/manifest.json` 与大量历史 `.log`，如 `sa6-issue299-probe.log`）；AC4/AC5 证据链需要 |

**C. 需 Controller 显式裁定（不建议默认纳入）**

| 路径 | 理由 |
| --- | --- |
| `artifacts/sa7-issue418-dataflow-probe.log`、`artifacts/sa7-issue418-authorizer-violation-probe.log` | SA7 临时诊断的**运行日志**（SA7 §7 明示「不入 artifactPaths」；其中 authorizer-violation 日志记录的是已登记 MINOR 角落的观察本体，非验收面）。若为最小化交付 diff 可排除；仓库既有 probe 日志入库惯例亦可纳入，须注意 PR 描述按 §17.5 披露 |
| `artifacts/sa3-issue418-*.log`（**无** `-iter2` 后缀，iteration 0/1 的 superseded 证据） | 记录被否决/已修复的中间态（73/75 文件 + 2 红锚）；保留可读性上属历史，但不应被引用为最终验收证据 |

**D. 禁止的暂存/交付动作**：不得为「干净 diff」而删除/改写 SA6 契约测试、既有 72 个测试文件或 DENY 面文件；不得 `git checkout --`/还原 `hub-connection.ts` 等已改写文件；`artifacts/local-packages/*.tgz` 按 `.gitignore` 排除；`.worktrees/`、`.mabf*`、`TASK.md` 按 `.gitignore` 排除。

### 17.5 Residual obligations（非阻断，PR 描述须按 SA10 §5 口径披露）

| # | 事项 | 来源 | 处置 |
| --- | --- | --- | --- |
| 1 | 类型违约授权器角落（结算 `undefined`/`null` → fulfillment TypeError → admission 永不结算 + unhandledRejection；HEAD 同输入为 `INTERNAL_ERROR`） | SA4 O1 / SA7 F-1 / SA9 M-1 | MINOR，已路由 implementation 后续小改（try/catch 兜底 `throw` 结局 + 注释修正）；不阻断本票 |
| 2 | R4' 双不可达角落（非暂停控制帧「耗尽 ∧ 编码必败」错误类归属差异；peer 侧共享队列波及面经 SA4 O2 注记） | 设计 §13 / SA4 O2 / SA8 R4'' | 登记不伪造测试；接受性经 SA2/SA8 确认 |
| 3 | R6' 结算续体微任务跳数 1→约 3 | 设计 §13 / SA2 | 无 wall-clock 可观察面；全套件泵预算吸收 |
| 4 | SA9 M-2（`settleAfterClose` 注释缺失）、M-3（`hub-session.ts:50` 排版） | SA9 | 后续票顺手整理 |
| 5 | R4''/R5''/R7''/R8''（有界缓冲重入、worker 前置裁决、ADR 0032:22 与 CONTEXT.md:230 文本调和 deadline、重触发条件） | SA8 实现后复查 §8 | 跨票义务；R7'' 须在 worker 形态票 SA8 前置门禁之前或之中落 ADR 修订/澄清附录；本票 docs 零 diff 合规 |

### 17.6 Revalidation verdict

**`approve`（复审保持）**：

1. **契约仍成立**：C1~C6 冻结契约在最终实现上**未改而全绿**（17/17）；C0 缺口由 `…structure.test.ts` 9 用例闭合（9/9），C0a~C0d 逐项可执行且判据与 SA6 §12.1 口径一致。
2. **验收证据齐备且可独立复现**：R1~R5 覆盖 AC4/AC5 全部门（包 75/569、根 439/5299、`Type Errors no errors`、三 typecheck），与 SA3/SA7/SA9/SA10 证据逐项一致；HEAD 基线矩阵 25/25 证明期望值非为拆分形态定制。
3. **下游终审一致**：SA7 `approve`（改变/保持的数据流、状态机、cleanup 全 ✅；F-1 非阻断）；SA9 `approve`（0 BLOCKER/0 MAJOR，4 MINOR 非阻断，`requiresConflictRecheck: false`）；SA10 `approve`（5/5 AC MET，无遗漏/部分实现/scope creep；残余项已披露）。
4. **无伪红/伪绿**：契约/结构/矩阵/守卫测试零 skip/only/todo、零 env override、零 fallback、零源码字符串断言；契约文件未被实现期触碰；DENY 面零 diff；临时探针零残留。
5. **交付约束已明确**：§17.4 给出必须显式暂存的 10 个路径（含 3 个未跟踪 src 模块）、建议纳入的证据路径、需裁定的 probe 日志与禁止动作；未发现阻碍本地交付的契约面问题。

因此本契约继续作为 issue #418 的验收判据；无 `reject` 依据。

---

## 附：artifactPaths（worktree-relative）

- `wiki/raw/task_issue-418_sa6_contract.md`（本报告）
- `packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts`（C1~C6 契约，17 用例）
- `artifacts/sa6-issue418-revalidation-focused.log`（复审：契约 17 + 结构 9 = 26/26，EXIT=0）
- `artifacts/sa6-issue418-revalidation-package-suite.log`（复审：包 75/75 文件、569/569 用例，EXIT=0）
- `artifacts/sa6-issue418-revalidation-pkg-typecheck.log`（复审：包/protocol tsc EXIT=0）
- `artifacts/sa6-issue418-revalidation-root-typecheck.log`（复审：根 `pnpm typecheck` EXIT=0）
- `artifacts/sa6-issue418-revalidation-root-test.log`（复审：根 439/439 文件、5299/5299 用例、`Type Errors no errors`、EXIT=0）
- `artifacts/sa6-issue418-baseline-ws-replication.log`（基线 72 文件/518 用例）
- `artifacts/sa6-issue418-baseline-pkg-typecheck.log`（包 typecheck EXIT=0）
- `artifacts/sa6-issue418-final-package-suite.log`（契约后 73 文件/535 用例）
- `artifacts/sa6-issue418-root-typecheck.log`、`artifacts/sa6-issue418-root-typecheck-final.log`（根 typecheck EXIT=0）
- `artifacts/sa6-issue418-root-test.log`（iteration 0 根 `pnpm test`：436 文件/5260 用例 + `Type Errors: no errors`）
