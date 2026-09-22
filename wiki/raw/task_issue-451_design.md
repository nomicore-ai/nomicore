# 实现设计 — Issue #451（γ-T5）：观测面锚定与全量回归收官（iteration 1，rev2 契约对齐修订）

- Dispatch：`sa-6d1d6761-7867-4f6e-8cee-7cf0a2786ff5`（mabf-sa1 / design / **iteration 1**）
- 本版性质：**原位修订** iteration 0（dispatch `sa-ff9d8237-4359-4a15-829a-5f1077eaea6d`，2026-09-22 20:56Z 落笔）。修订动因 = 验收契约本体发生 rev1→rev2 演进：SA3 实施期发现 `ANCHOR-ORDER-C1` 非确定性红灯（包套件 3/7 红，根因 = live Y.Doc `clientID` CSPRNG varint 宽度抽签），SA6（契约 owner）依 SA8 iteration-0 §10 复查重启条件第 2 条裁定并落地 **rev2 断言边界**；iteration 0 设计的「内容冻结 + 确定性已证」前提被证伪，全文按 rev2 契约与 worktree 现状重写为当前一致设计（不保留历史矛盾表述；修订映射见 §14）。
- Baseline worktree：`/home/wangjian/nomicore-fix-issue-451`（分支 `mabf/issue-451`，upstream `origin/spec/445-gamma-async-seam`），HEAD **`68ab9f5`**（Merge PR #459 / `mabf/issue-450`；γ-T1~T4 已在 HEAD，全程未前移——本设计 `git rev-parse` 复核）
- 上游输入（**全部在案**，本设计逐份精读）：
  - `wiki/raw/task_issue-451.md`（Host 简报；issue `open`，body 快照 2026-09-22T12:33:27Z，5 条 AC）
  - `wiki/raw/task_issue-451_sa6_contract.md`（**SA6 rev2**，2026-09-22 21:52Z：诊断 + `ANCHOR-ORDER-C1` 边界裁定 §12.5 + 下游证据义务 EV-1..EV-8 + 全部 rev2 门禁证据）
  - `wiki/raw/task_issue-451_sa2_review.md`（SA2 评审 **iteration 1**：`reject`——F-1 BLOCKER「设计修订缺席」含 12 项完备清单、F-2 MAJOR「SA6 枚举不全」、N-1 MINOR 计数笔误；iteration 0 的 N-2/N-3 已由 SA3 落地移除）
  - `wiki/raw/task_issue-451_design_conflict_report.md`（SA8 冲突复查 **iteration 1**：`reject` + `requiresConflictRecheck: true`；R-1a/R-1b/R-1c 为本修订的阻塞义务，R-2 = 修订后复查，R-3 = R-1/R-2 完成前不进 SA4/SA7 终验）
  - `wiki/raw/task_issue-451_sa3_impl.md`（SA3 实施报告：`reject` + `requiresConflictRecheck: true`；§7 非确定性根因链 + §7.4 三备选 + D2 已落地登记）
- Owner 评论：REST 快照 **`[]`**（2026-09-22T13:48Z，本次 dispatch 提供；此前 12:33/12:35/12:43/12:53/13:13/13:39Z 六个时点快照连续为空）——无 owner 追加要求，需求全集 = Issue 正文 5 条 AC
- 缺席输入（非阻塞）：前置门禁产物 `task_issue-451_relevant_decisions.md` / `task_issue-451_conflict_report.md` 与 `task_issue-451_sa4_review.md` / `_sa7_report.md` 均不存在（本设计核验；规范权威替代链见 §6）
- 规范权威：`docs/adr/0032-transport-decoupling-edge-session-split.md` 附录 A4（A4.1–A4.8）、`docs/protocols/instance-replication-v1.md` §23.1 发射侧归属表（:833-846）/ §24（:1091-1154，含 §24.2 宿主运输义务 :1099-1106 / §24.8 观测口径 :1149-1154）；模块门 = `packages/ws-replication/AGENTS.md`「Verification」；**仓库既有字节判据口径**（rev2 新增强约束）：`ws-replication-issue424-auth-parity.test.ts:16`（ORACLE-2「禁止把数据帧（Yjs 载荷帧）的字节相等写成断言」）+ `ws-replication-issue418-edge-session-split-contract.test.ts:21,117-119,460`（「payload 逐字节不可跨进程冻结」）——本设计逐条重读核对在位
- Worktree 现状（本设计逐项复核，2026-09-22 22:0xZ）：anchor 契约 = **432 行 / 9 用例**，sha256 `4a8556bbecb775fd70a054051ee6599f9600ea01e9a26700a4818ad683bc3b4c`；surface-freeze test-d = 74 行，sha256 `ef897240096c78a0b45e04cb5cc77f777a351b744a720f86c72a892520c42184`（零改动）；`git status --short packages/ws-replication/src/` **恒空**；`packages/ws-replication/AGENTS.md` tracked diff = **+1 行**（D2 已由 SA3 落地于 :18）；证据面 = `artifacts/sa6-issue451-*` **32 个文件**（31 份 `.log` + `clientid-probe.mjs` 探针，含 rev2 的 `rev-*` 族与 SA3 的 `sa3-*` 族）

---

## 1. 任务类型、目标和非目标

**任务类型**：Refactor / 验收收官（行为基线 + 回归契约 + 收官文档登记）＋ **验收契约确定性缺陷的边界修订收口**。生产行为在 HEAD 上已由 γ-T1~T4（#447–#450）落地且经 SA6 判定无缺陷（rev2 §8 重申：`clientID` 随机是 Yjs 正常语义，缺陷在 rev1 契约的断言边界，不在实现）。本票闭合的是**验收面缺口**（含契约自身的确定性缺陷，已由 SA6 rev2 修复）与**收官登记缺口**（D2 已落地）；本设计修订（iteration 1）闭合的是**设计文本与 rev2 契约/证据/授权链的同变更集一致性**（SA2 F-1 / SA8 R-1）。

**目标**：

1. **AC1（已可执行，载体 = SA6 rev2 契约）**：γ 异步缝上 `update-sent` 发射点 = edge 盖章点、其余 namespace 域事件（`update-acked` / chunked 族）= session 结算点的**单侧 observer 隔离归属矩阵**，以及「跨线程事件无全序 ⇒ 断言只依赖单侧事实与因果门」的调度无关性契约——由 `ws-replication-issue451-gamma-observability-anchor.test.ts`（rev2，432 行 / 9 用例）承载。其中 **`ANCHOR-ORDER-C1` 采用 rev2 边界**（§7-D1）：跨调度投影只比较**调度不变量**字段（`type/side/namespaceId/sequence` + 计数恰一），`bytes` 为**单轮自证事实**（每轮 `bytes === 本轮 wire 载荷长`，判据面缺失响亮 throw）。
2. **AC2（已可执行，零改动维持）**：新公共面 test-d append-only 复核——由 `ws-replication-issue451-gamma-surface-freeze.test-d.ts`（74 行 / 3 编译期用例 + 2 `@ts-expect-error` 负控，sha `ef897240…`）承载，冻结 γ 宿主面成员集与 β 非回退。
3. **AC3（门禁复跑）**：listen 与 β 矩阵（issue418/420/421/423/424 全套 20 文件）+ route-key / wire parity guard 全绿——rev1 证据（20/273）保持有效（此后零相关改动）；实现/终验阶段按 §12 命令集复跑并留证。
4. **AC4（门禁复跑，口径升级）**：包 typecheck + 根 `pnpm typecheck` / `pnpm test` 全绿——验收口径采纳 SA6 EV-2/EV-3：包套件 ≥3 次、根 `pnpm test` **≥2 次独立样本**（rev2 已达标：3× 105/945、2× 468/5675，见 §2-A9）。
5. **AC5（收官登记 + 人工移交）**：PR #446 实现与 ADR 0032 附录 A4 / 协议 §24 的同支一致性核对**结论 = SA6 §12.4（18 条款全「一致」，§24.8 行已按 rev2 边界更新表述）**；收官登记项 O-1/O-2 **已由 SA3 落地**为 `packages/ws-replication/AGENTS.md:18` 单 bullet（+1 行，含 SA2 N-2/N-3 润色版文案）；「转人工合并」（不自动合 main）为人工动作，非任何 SA 权限（§7-D3）。
6. **（本设计修订的目标）设计-契约同变更集收口**：把 rev2 边界、sha 谱系、授权链（SA8 iteration-0 §10 条件 2 → SA6 裁定 → 复查触发）、rev2 证据族与「不得回退边界」纪律写进设计的裁定/事实/范围/验收/风险各节，消除 iteration 0 的全部失配陈述（SA2 §6 失配表 C-1..C-8 清零）。

**非目标**：

- 任何 `packages/ws-replication/src/**` 生产改动（本票不变量：`git status --short packages/ws-replication/src/` 恒空；SA6 备选 A「钉死 live seed 文档 clientID」正是因需生产改动/旁路生产文档生命周期而被否决——见 §7 备选表）；
- 修改 SA6 rev2 契约两文件的断言语义、用例集或夹具（rev2 已批准 + 聚焦 40/40 + 包套件 3× + 根 test 2× 全绿 + M1/M2/M3 三路敏感性反证在案；**rev1→rev2 的一次性修订例外已完成并闭合**，此后任何再修改须 SA6 边界裁定 + 门禁证据链 + 冲突复查，见 §11 DENY）；
- 回退或弱化 rev2 边界（SA8 R-1b / SA6 EV-5：M3 下 ≥3/9 红且含 ORDER-C1——rev1 边界仅 2/9，不得复活跨 boot 字节相等断言）；
- 修改 `docs/protocols/instance-replication-v1.md` / `docs/adr/0032-*.md` / `CONTEXT.md`（规范与词汇已完备；SA8 iteration-1 §3/§6 判无需修订，§7 备选 A 维持否决）；
- 自动合并 PR #446 或任何 `git add/commit/push`（生命周期归 Runner Host / 人工）；
- T1~T4 各票已验收的机制面重复验收（#447 缝/工厂、#448 数据面、#449 reconcile+分块、#450 流控/生命周期——SA6 §12.3 边界登记）；
- 重跑 M1/M2/M3 mutation（证据已闭合于 `rev-mutations-M1-M2-M3.log` + `rev-M3-boundary-compare.log`；重跑违反生产零改动纪律——EV-4 只在怀疑退化时按 SA6 边界重做）。

---

## 2. 当前行为与证据锚点（HEAD = `68ab9f5`；行锚经本设计逐条重读核对；`src/**` 自 iteration 0 起零改动，源码锚点全部维持有效）

| # | 面 | 符号 / 行锚 | HEAD 行为 | 与本票关系 |
|---|---|---|---|---|
| A1 | edge 盖章点单漏斗 | `src/hub-edge.ts:284-288`（`port.sendDataFrame`：`tryEmitDataFrame` 盖章 → **`sequence > 0` 门**（:286-287）→ `emitUpdateSentAtStamp` → 返回序）；`:869-886`（`emitUpdateSentAtStamp`：无 observer 首行门 → `updateFrameProbe` 型门/定偏移 → `dispatchReplicationObserver`） | hub 侧全部 data 帧（session 组装路径 + UPDATE_CHUNK 分块族 + 宿主 egress 直驱）经本成员；`seq=0`（未发送/被拒）⇒ 零事件；非 UPDATE 型（含 `0x42`）dormant 零事件 | AC1 锚的**被测事实**；ANCHOR-EDGE-C1/C2/NC1/NC2 与 M1/M3 mutation 靶位；零改动（DENY） |
| A2 | session 抑制点与结算点 | `src/hub-namespace.ts:1458-1462`（`onUpdateSent`：普通帧 `info.chunked === undefined → return`（:1462），**零发射**；chunked 在场 → `chunked-update-sent`）；`:1416-1440`（`onUpdateAcked`：`update-acked` / `chunked-update-acked`） | 防双发的结构性第二点；namespace 域结算事实发射点在 session | AC1 镜像锚（ANCHOR-SESSION-C1/C2、ANCHOR-BOTH-C1、M2 mutation 靶位）；零改动（DENY） |
| A3 | γ 公共面 | `src/hub-session-async-host.ts:47-84`（`HubAsyncSessionFrame{tag,bytes,lane}` / `HubAsyncSessionFrameListener`（void）/ `HubAsyncSessionReceipt{tag,sequence}` / `HubAsyncSessionHandle`（**6 成员**：`handleFrame`/`handleReceipt`/`onFrame`/`onSignal`/`terminateUnauthorized`/`close`，:66-79）/ `HubAsyncSessionHost`（**恰一成员 `open`**））；`:114`（`asyncSendTickets: true` 唯一设置点） | γ 新公共面 append-only；β 同步冻结面（`HubSessionFrameListener` 返回 `number`）不动 | AC2 锚的被测事实（SURFACE-C1..C3 + 2 负控）；零改动（DENY）。〔iteration 0 误记「5 成员」，本版按 SA2 N-1 修正为 6 成员——无断言依赖该计数，SURFACE 冻结对象是 `keyof HubAsyncSessionHost`〕 |
| A4 | 流控装配标记 | `src/hub-edge-host.ts:186`（`readonly asyncDataAdmissionFatal?: true`——精确 `true`，非 boolean）；`:982`（`HostEdgeConnection(edge, created, options.asyncDataAdmissionFatal !== true)` 前置门派生） | #450 落地的 append-only 第 10 可选成员；缺席 ⇒ α/β 语义逐字不变 | AC2 ③ 的被测事实；ANCHOR-EDGE-NC1 的装配前提；零改动（DENY） |
| A5 | 包公共导出面 | `src/index.ts`（`createHubAsyncSessionHost` :9 + 5 类型 :105-109）；`git diff c86ccbc..HEAD -- …/index.ts` = **+11 / −0**（SA8 iteration-1 复核） | 自 spec #445（`c86ccbc`）起纯增——append-only 事实成立 | AC2 的一致性底座（SA6 H6）；零改动（DENY） |
| A6 | 宿主桥（回执条款具现） | `test/issue447-async-seam.ts:519-546`：`sessionToEdge.onDeliver` 中 `egress.sendDataFrame` 盖章返回值 > 0 ⇒ **同一同步段** `seam.edgeToSession.enqueue({tag, sequence})`（:539 注释「★ A4.2/§24.2.3」）；`sequence === 0` ⇒ 不投回执 | §24.2.3 宿主运输义务在测试夹具的参考实现 | O-1 登记内容的**事实源**；夹具零改动（DENY） |
| A7 | 模块 γ 义务文档（**D2 已落地**） | `packages/ws-replication/AGENTS.md:17`（γ 段：缝词汇闭集合 + `asyncDataAdmissionFatal: true` 方向性义务 + 流控收口语义）；**:18（D2 新 bullet，SA3 落地，`git diff --stat` = +1 行）**：γ 桥宿主运输义务（专用 FIFO 通道对 / 回执盖章点同步投递 / 违契响亮收口 `ACK_STATE_VIOLATION` 1002、§24.2.6）+ observer 两侧注入纪律（含 edge 侧拒绝路径复刻事件括注——SA2 N-3 润色）+ 跨线程无全序纪律句 | 三条义务（装配标记 / 宿主运输 / 观测纪律）在模块文档层并列可见，权威源引用 §24.2/§24.8 | **收官登记已完成态**（iteration 0 的「本设计落笔」将来时表述废止）；本设计只登记落地事实，无进一步改动（§11 ALLOW 行 2 改为维持态） |
| A8 | 既成验收面（**SA6 rev2**） | `test/ws-replication-issue451-gamma-observability-anchor.test.ts`：**432 行 / 9 用例**，sha256 `4a8556bb…bc3b4c`（本设计 `sha256sum` 复核，与 SA6 §12.1 / SA3 §2 / `rev-root-test-2nd.log` 首部三方一致）。rev2 边界锚点（本设计逐行核对）：头注释边界说明 `:105-117`；`anchorProjection` `:118-133` **键集 = `type/side/namespaceId/sequence`（无 `bytes`）**；`payloadBytesAt` `:139-145`（缺帧即响亮 throw，:141-143）；ANCHOR-ORDER-C1 `:333-396`（投影 `toEqual` :371 + 逐轮 `sent/acked.bytes === payloadBytesOfFrame(round, seq)` :372-389 + `acked.sequence === sent.sequence` :388 + 投影回指 wire 序 :390-395）；ANCHOR-ORDER-C2 `:398-431`（因果门，未动） | AC1 可执行载体。**rev1（sha `3088fb7b…b3cb0c`，400 行）已废止**：其 ORDER-C1 把 `bytes` 纳入跨两轮独立 boot 的按型投影 `toEqual`，实为 RNG 抽签检测（§3-G6）。其余 8 用例（ANCHOR-EDGE-C1/C2/NC1/NC2、SESSION-C1/C2、BOTH-C1、ORDER-C2）与 rev1 语义一致 | AC1/AC2 的可执行载体；**冻结基线 = rev2 内容（钉 sha）**（§7-D1、§11 DENY） |
| A9 | 门禁证据（**rev2 族**，SA6 采集，本设计抽验日志尾行/首部一致） | `artifacts/sa6-issue451-rev-postfix-focused-40x.log`（聚焦契约独立进程 **40/40 绿**，`totals: FAIL=0 PASS=40`）；`-rev-postfix-suite-3x.log`（包套件 **3× 105 files / 945 tests 全绿 + Type Errors: no errors**）；`-rev-root-test.log` / `-rev-root-test-2nd.log`（根 `pnpm test` **2 次独立样本 468/5675 全绿**；run2 首部备案 HEAD + revised sha）；`-rev-package-tsc-root-typecheck.log`（包 tsc exit 0 + 根 typecheck 15 段链 exit 0）；`-rev-mutations-M1-M2-M3.log`（**M1=5/9、M2=4/9、M3=3/9 红**）；`-rev-M3-boundary-compare.log`（**M3 边界对照：rev1 边界 2 红（ORDER-C1 绿）vs rev2 边界 3 红（含 ORDER-C1）**）；`-clientid-probe.log`/`.mjs`（E8：clientID 宽度 1..5 ⇒ 载荷长 15/18/21/24/27，`clientIDByteRuns=3`；200k 抽样 P(宽4)=0.061595、P(宽5)=0.937915 ⇒ 两轮宽度不等概率 0.116521）；`-order-rng-probe.log`/`-order-rng-probe2.log`（E9：240 轮真 γ boot，宽4⇒24B/宽5⇒27B 零反例，调度不变量投影 0 不匹配、逐轮自证 0 失败）；修订前红灯采样 `-rev-flake-samples.log`（聚焦 4/30 红）+ SA3 族 `-sa3-suite-repro.log`（包套件 3/7 红）；rev1 历史证据（`-green-repeat1..3`、`-package-suite`、`-root-test` 等）保留为历史不冒充现状；`-listen-beta-matrix.log`（20/273）与 `-order-audit.log`（A/B 零命中）rev1 证据保持（此后零相关改动） | AC3/AC4 的现状证据（rev2 族为准）；AC1-c 确定性与 AC4-a 口径的依据；实现/终验阶段按 §12 复跑更新 |
| A10 | 规范权威 | 协议 §24.2（:1099-1106 宿主运输义务清单）/ §24.3（:1108-1120 缝词汇闭集合）/ §24.8（:1149-1154 观测口径，无全序条款 :1153）；§23.1 发射侧归属表（:833-846，edge 行 :840）；ADR 0032 A4.1–A4.8；`CONTEXT.md:224-239`（γ / 序回执 / 路由键词汇已登记） | 规范文本与 HEAD 实现一致（SA6 §12.4 18 条款逐条核对全「一致」，§24.8 行已按 rev2 边界表述） | AC5 一致性结论的依据；O-1/O-2 登记的引用源（不复制规则本体——docs/AGENTS.md「link to authoritative source」） |
| A11 | live 文档 clientID（**RNG 源**，rev2 根因锚） | `packages/namespace-registry/src/create-document.ts:67/74`（两分支均汇入 `createInitialDocument`）→ `packages/doc-runtime/src/create-initial-document.ts:160`（**裸 `new Y.Doc()`**，本设计重读核对在位） | `clientID` 由 Yjs/lib0 CSPRNG 抽签（32 位均匀），varint 宽度 ∈ {4,5} 概率 ≈ 0.0616/0.9379；写入出站 UPDATE 载荷 3 处 ⇒ 宽度差 ⇒ 载荷长 ±3 | **生产行为，正确且零改动**（Yjs 正常语义）；rev2 边界的存在理由——跨独立 boot 的字节长度是 RNG 派生量，不得入契约判据（§7-D1）；SA6 备选 A「钉死它」被否决的锚点 |
| A12 | 仓库字节判据口径（rev2 规范依据） | `test/ws-replication-issue424-auth-parity.test.ts:16`（ORACLE-2：「**禁止**把数据帧（Yjs 载荷帧）的字节相等写成断言：Yjs `clientID` 由 Yjs 自身随机生成」）；`test/ws-replication-issue418-edge-session-split-contract.test.ts:21,117-119,460`（「payload 逐字节不可跨进程冻结」「跨进程长度可能 ±1…不钉长度」） | 仓库已成文的数据帧判据纪律：语义/单轮自证可以，跨进程字节相等禁止 | rev1 ORDER-C1 实质**违反**该口径（SA2 §5 判「实质违反本仓已成文的两处先例」）；rev2 回归口径是规范一致性修复而非放松（§6 约束行） |

**环境基线**（SA6 rev2 §4，承接）：Node v24.13.0 / pnpm 10.28.2 / vitest 3.2.7 / tsc 5.9.3；依赖 `pnpm install --offline --frozen-lockfile`（store 命中，零网络）；测试入口 `NODE_OPTIONS=--conditions=nomicore-source npx vitest run …`；根 `pnpm test` = `vitest run --typecheck`（`maxWorkers: 1`）；零真实 timer（注入调度器）/零网络/零 `worker_threads`——**唯一未钉死量 = live Y.Doc `clientID`（CSPRNG），rev2 已将其移出契约判据面**。

---

## 3. 能力缺口承接（根因链——非 Bug 票，按验收面缺口表述）

**总判**：生产行为无缺陷（SA6 rev2 §8：`clientID` 随机是 Yjs 正常语义，载荷长差 3 字节是合法编码差）。本票缺口 = 验收面缺口（G1–G5）+ **契约自身确定性缺陷（G6，已由 SA6 rev2 闭合）** + 收官登记缺口（G-doc，已由 SA3 D2 闭合）：

| 上游缺口（SA6 §8.1/§8.2） | 闭合载体 | 本设计处置 |
|---|---|---|
| G1 γ 缺单侧 observer 隔离矩阵（#448 共用 recorder 只能断「恰一」不能判「哪侧发射」） | ANCHOR-EDGE-C1/C2 + ANCHOR-SESSION-C1/C2 + BOTH-C1（单侧注入判别 + 镜像负控 + 无双发） | 裁定维持（rev2 下逐字保持）；门禁复跑（§12） |
| G2 逐半边隔离此前只在 α/β 形态（#423 EM 族） | 同上（γ 缝形态） | 同上 |
| G3 缺「跨线程事件无全序」可执行契约 | **ANCHOR-ORDER-C1（rev2 边界）** + ORDER-C2 + `order-audit.log`：调度扰动不变性以**调度不变量投影**（`type/side/namespaceId/sequence` + 计数）逐字相同承载；`bytes` 以**每轮对本轮 wire 载荷单轮自证**承载（缺帧响亮 throw） | 裁定维持 rev2 边界；O-2 文档纪律已落地（AGENTS.md:18「never merged-array order」句） |
| G4 公共面 append-only 复核有 Δ（`keyof HubAsyncSessionHost` 未冻结） | SURFACE-C1..C3 + 2 `@ts-expect-error` 负控（γ→β 冒充、`false` 标记） | 裁定维持（sha 不变）；门禁复跑 |
| G5 无收官门禁的同支证据 | §12.4 一致性核对表（18 条款全「一致」）+ 全部门禁日志（rev2 族） | 终验阶段复跑更新证据（§12）；AC5 尾句移交人工（§7-D3） |
| **G6（rev2 新增判定，已闭合）rev1 `ANCHOR-ORDER-C1` 是确定性缺陷**：跨两轮独立 boot 的按型投影含 `bytes` 且 `toEqual`，而载荷长内含 live doc `clientID` varint 宽度（CSPRNG）⇒ 该断言只检测抽签运气（两轮宽度不等概率 0.116521），实测聚焦 4/30 红、包套件 3/7 红；同时超出 AC1-c 语义边界（跨轮载荷字节相等既非顺序事实也非调度事实）并违反仓库 #424 ORACLE-2 / #418 C3 口径 | **SA6 rev2 契约修订**（单文件断言边界）：投影剔除 `bytes`、改逐轮自证；证据 = 40/40 + 3×945 + 2×468/5675 + E8/E9/E10（240 轮 0 假红）+ E13（M3 敏感 2/9→3/9，严格更强） | **本设计采纳并钉死**：§7-D1 冻结基线重锚 rev2 + sha；§12 验收口径按 EV-1..EV-8；§11 DENY 理由重写；R-1b 禁止回退 |
| **G-doc（已闭合）** 模块 γ 桥义务段缺 §24.2 宿主运输义务与 §24.8 observer 两侧注入纪律 | **SA3 D2 已落地**：`AGENTS.md:18` 单 bullet（+1 行，含 N-2/N-3 润色版） | 本设计登记**已完成态**（§2-A7）；无进一步落笔义务 |

**排除项**（SA6 §11，维持全判 + rev2 新增 H8–H10）：H1（γ 上 `update-sent` 由 session 发射）H2（双发射被掩盖）H3（`sendQueueMs` 应在场）H4（γ 套件已有跨半边序断言）H5（分块族应发普通族 `update-sent`）H6（公共面有破坏性改动）H7（全量回归有既有红灯）H8（**rev1 flake 是时序/并发/环境问题**——240 轮单进程串行 boot 仍双值、宽度↔字节长 1:1、理论率与实测一致，是 RNG 抽签）H9（**flake 源于夹具 `makeSeedDoc`**——live 文档走 `registry.create` 生产路径，SA3 §7.2 归因经 SA6 R3 修正，结论不变）H10（**移出 `bytes` 会放过字节事实回归**——E13：M3 在 rev2 下 3/9 红（含 ORDER-C1）> rev1 边界 2/9，严格更强）。

---

## 4. Owner 要求落实

Owner 评论 REST 快照为空（**`[]` @2026-09-22T13:48Z**，连续第七个空快照）；简报 `## Comments` 亦空 ⇒ **无 owner 评论可映射**。需求全集 = Issue 正文 5 条 AC（rev2 契约修订属验收契约自身确定性缺陷的修复，不引入 owner 隐含面——SA6 §2 同判）：

| Comment ID | Updated at | Requirement | Design section |
|---|---|---|---|
| （无评论） | — | — | — |

| Issue AC | 本设计落点 | 定性 |
|---|---|---|
| AC1 `update-sent` 留 edge 盖章点锚；`update-acked`/chunked 族 session 侧锚；γ 断言不依赖跨线程事件相对顺序 | §2-A1/A2/A8/A11/A12 事实锚 + §7-D1（rev2 契约冻结裁定）+ §12 行 1–3（ANCHOR-EDGE/SESSION/ORDER rev2 口径 + order-audit） | **零生产改动**；可执行面已落地（rev2），门禁复跑 |
| AC2 新公共面 test-d append-only 复核 | §2-A3/A4/A5 + §7-D1 + §12 行 4（SURFACE 3+2，sha 不变） | **零生产改动**；同上 |
| AC3 listen 与 β 矩阵（issue418/420/421/423/424 全套）+ route-key / wire parity guard 全绿 | §12 行 5（20 文件集 = 418×3 + 420×3 + 421×7 + 423×3 + 424×4，含 route-key-parity / wire-parity / 2 个 `.test-d`；issue422 两文件不在 AC3 命名集，由 AC4 更宽门禁覆盖——§13 R-3 登记） | **门禁复跑**（rev1 证据 20/273 保持，此后零相关改动） |
| AC4 包 typecheck + 根 `pnpm typecheck` / `pnpm test` 全绿 | §12 行 6–10（**EV-2 包套件 ≥3 次、EV-3 根 test ≥2 次独立样本**；rev2 已达标） | **门禁复跑**（口径升级） |
| AC5 PR #446 与 ADR A4 / §24 一致性核对完成，收官转人工合并 | 一致性结论 = SA6 §12.4（18 条款全「一致」）；O-1/O-2 登记**已由 SA3 落地**（§2-A7）；§7-D3 人工移交边界；SA8 R-2/R-3 完成前不进终验 | **docs 登记（已完成）+ 移交**（无自动合并） |

---

## 5. 复现和根因承接

### 5.1 上游事实承接（SA6 rev2 / SA3）

| 上游事实 | 证据位置 | 设计响应 |
|---|---|---|
| SA3 §7：`ANCHOR-ORDER-C1` 间歇红（包套件 7 次 3 红，红灯恒为该用例，`bytes` 24 vs 27 方向可翻转）；单文件 16 连绿 = 抽样运气（0.883^16 ≈ 13.6%）；SA3 按 §7-D4 阻塞上报（`reject`）而非修断言 | SA3 §7.1 + `artifacts/sa6-issue451-sa3-suite-repro.log` / `-sa3-suite-samples.log` | §7-D4 纪律被实际遵守，维持不变；红灯定性从「环境/抽样」改判「契约确定性缺陷」（G6） |
| **rev2 根因链 S1–S7**（症状 S1 → 故障点 S2（rev1 `:357` 把 `bytes` 纳入跨两轮 boot 的 `toEqual`）→ 机制 S3（clientID 写入载荷 3 处，varint 宽度 4→5 ⇒ +3B）→ 最深根因 S4（`create-initial-document.ts:160` 裸 `new Y.Doc()` ⇒ CSPRNG，两轮宽度不等概率 0.116521）→ 触发 S5（与调度无关，方向翻转即证）→ 放大 S6（`sent`+`acked` 双失配面）→ 定性 S7（超出 AC1-c 语义 + 违反 #424 ORACLE-2 口径））+ U1（无第二差源）+ R1–R3（排除调度/timer/夹具归因） | SA6 rev2 §8.2 + `clientid-probe.log` + `order-rng-probe2.log` | **采纳为设计事实**（§2-A11 锚点、§3-G6 缺口、§7-D1 边界裁定的根因依据）；备选 A（钉 clientID）与 D（归一化掩码）的否决理由随之采纳（§7 备选表） |
| **rev2 因果实验 E8–E13**：E8 宽度类钉死探针（1:1 机制）；E9 240 轮真 boot（0 假红）；E10 三边界评分（(i) 含 bytes 22/238 不匹配 / (ii) 不含 bytes 0/238 / (iii) 逐轮自证 0/240 失败 ⇒ 采纳 (ii)+(iii)）；E11 M1=5/9 红；E12 M2=4/9 红；E13 M3=3/9 红（rev1 边界下仅 2/9——rev2 严格更强） | SA6 rev2 §9 + `rev-mutations-M1-M2-M3.log` + `rev-M3-boundary-compare.log`（本设计抽验尾行：rev1=`2 failed … red IDs=['ANCHOR-EDGE']`、rev2=`3 failed … red IDs=['ANCHOR-EDGE','ANCHOR-ORDER']`） | 敏感性依据升级为 **M1/M2/M3 三路**（§7-D1 依据 2）；EV-4/EV-5 验收行（§12）；R-1b 禁止回退的量化判据 |
| **rev2 正控/负控/稳定性**：正控 = 调度不变量投影逐字相同（:371）+ 逐轮自证（:372-389）+ 因果门（ORDER-C2）；NC-6 RNG 边界负控（240 轮）；稳定性 = 聚焦 40/40、包 3×945、根 2×4675 | SA6 rev2 §5.2/§6/§7 + 各日志 | §12 验收映射的现状证据列；EV-1/EV-2/EV-3 复跑口径 |
| **SA6 §12.4 AC5 一致性核对**（§24.2.1/24.2.3/24.3–24.8 + A4.1–A4.8 全「一致」；§24.8 行已按 rev2 边界表述「跨线程无全序的可执行判据只含调度不变量事实」） | SA6 rev2 §12.4 | AC5 核对结论直接采信；O-1/O-2 已由 SA3 D2 落地（§2-A7） |
| **SA6 §15 B-1 / §12.5 EV-8**：设计侧修订义务（§7-D1 / §11 DENY / §12 AC4-a 口径）+ `requiresConflictRecheck: true`（SA8 §10 条件 2 触发） | SA6 rev2 §15 | **本设计即该义务的兑现**：§7-D1 重锚 rev2、§11 DENY 重写、§12 口径升级、§15 翻转为 `true`；并按 SA2 F-1 的 12 项完备清单执行（§14 映射表） |
| SA6 §16 临时诊断清理（M1/M2/M3 复位、`zz-sa6-*` 探针已删、`src/**` 零残留） | SA6 rev2 §16 + 本设计 `git status --short packages/ws-replication/src/` 复核 = 空 | 生产零改动不变量在本设计核对下仍成立；终验阶段维持 |
| SA3 D2 落地（`AGENTS.md:18` +1 行；N-2/N-3 润色；符号核对 `handleReceipt` / `ACK_STATE_VIOLATION` 1002 / 夹具路径与 HEAD 一致） | SA3 §3/§4/§6 + 本设计 §2-A7 重读 | 收官登记**已完成态**；§11 ALLOW 行 2 改为维持态 |

### 5.2 上游事实与源码矛盾

**无**。本设计对 §2 全部锚点（A1–A12）重读核对，与 SA6 rev2 / SA3 描述一致。两处已知偏差均为报告级笔误、无实质影响（SA2 N-2'）：① SA6 §5.2 引 ORDER-C1 自证为 `:379-388`、实际 `:372-389`（SA8 记 `:380-388` 亦微漂）——本设计一律采用自验行锚（§2-A8）；② SA6 §10 引 `emitUpdateSentAtStamp` 为 `:869-885`、实际块为 `:869-886`。SA3 §7.2 对夹具 `makeSeedDoc` 的归因经 SA6 R3 修正（live 文档走 `registry.create` 生产路径）——修正成立且不影响 SA3「契约缺陷」结论。

---

## 6. SA8 约束落实

SA8 产物在案：`wiki/raw/task_issue-451_design_conflict_report.md`（**iteration 1**，原位取代 iteration 0 的 `clear` 报告；verdict `reject`——拒的是变更集一致性状态，非方向；`requiresConflictRecheck: true`）。前置门禁产物（`relevant_decisions` / `conflict_report`）仍缺席；规范权威继承链 = spec #445（ADR 0032 附录 A4 + 协议 §24 + 词表）→ 上游票 #447–#450 的 SA6/SA8 结论已随 PR #453/#455/#456/#459 合入 HEAD。逐条落实：

| 决议或义务 | 出处 | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|---|
| **SA8 R-1a①**：§7-D1 冻结裁定改为「验收契约 = SA6 rev2（§12.5 边界：跨调度投影不含 RNG 派生量、`bytes` 单轮自证）；实现阶段不得再改」 | SA8 iter-1 §8 R-1a | §7-D1 | 已按原文落实（钉 sha `4a8556bb…`） | 见最末行（R-2 汇总） |
| **SA8 R-1a②**：§11 DENY 该测试文件行改为「契约本体 = SA6 rev2（sha）；再修改须 SA6 边界裁定 + 门禁证据链」 | 同上 | §11 DENY | 已按原文落实 | 同上 |
| **SA8 R-1a③**：§12 AC4-a（及 AC1-c）验收口径承认「跨轮断言不得含 RNG 派生量（live doc `clientID` varint 宽度）；`bytes` 属单轮自证事实」 | 同上 | §12 行 1–3/6 | 已按原文落实 | 同上 |
| **SA8 R-1b（禁止回退）**：修订后口径不得弱于 rev2 边界（EV-5：M3 下 ≥3/9 红且含 ORDER-C1——rev1 边界仅 2/9，不得复活） | SA8 iter-1 §8 R-1b | §7-D1 边界裁定第 3 段、§12「EV-5」行、§13 R-7 | 已落实为三级防线（裁定/验收/风险） | 同上 |
| **SA8 R-1c（同修订一致性收尾）**：header 输入指向 SA6 rev2；§2-A8 更新；§5 补 rev2 族；§14 落 SA2 评审映射（N-1 顺手修正、N-2/N-3 已落地登记）；§15 自判改 `true` | SA8 iter-1 §8 R-1c | 头部、§2、§5、§14、§15 | 全部落实（§14 含 SA2/SA3/SA8 三方 finding 映射） | 同上 |
| **SA8 R-2**：修订后复查（SA8）——确认设计-契约-证据同变更集一致、语义相符、无范围扩大、陈旧引用清零 | SA8 iter-1 §8 R-2 | §15 | 本修订提交后由 SA8 执行（非 SA1 权限） | **是（这正是复查本体）** |
| **SA8 R-3（下游顺序）**：R-1/R-2 完成前本票不进 SA4/SA7 终验 | SA8 iter-1 §8 R-3 | §7-D3 收官路由 | 设计明示路由顺序：本修订 → SA8 R-2 复查 → （如派工）终验 → 人工合并 | — |
| §24.8 / A4.7：`update-sent` = edge 盖章点；`update-acked` / chunked 族 = session；跨线程 observer 事件无全序（判据只含调度不变量事实） | ADR 0032 A4.7（:93-95）、协议 §24.8（:1149-1154）、§23.1（:833-846） | §2-A1/A2、§7-D1 | rev2 契约**逐字实现该条款**（SA8 判 implements-existing-decision ×2）；零生产改动 | 否（对条款的 enforcement） |
| A4.1 / §24.3：γ 公共面 append-only；β 冻结签名逐字不动 | A4.1（:59-65）、§24.3（:1108-1120） | §2-A3/A5、§7-D1 | SURFACE 冻结面只验证不修改（sha 不变）；`index.ts` 纯增 +11/−0 | 否 |
| A4.3 / §24.5：流控单点 = edge；γ 装配 `asyncDataAdmissionFatal: true` 方向性义务（AGENTS.md:17 已登记） | A4.3（:77-79）、§24.5（:1130-1139） | §2-A4、§2-A7 | 零改动；ANCHOR-EDGE-NC1 以该装配为前提 | 否 |
| §24.2 宿主运输义务（专用通道对 / 每方向 FIFO / 回执盖章点同步投递 / 违契响亮收口） | §24.2（:1099-1106）、A4.2（:67-75） | §2-A7（已落地 :18） | **docs 登记已完成**（SA3 D2；引用规范不复制规则本体） | 否（登记既有规范，无语义变化） |
| **仓库字节判据口径**（rev2 新增约束）：数据帧（Yjs 载荷）禁止跨进程/跨 boot 字节相等断言（#424 ORACLE-2、#418 C3） | SA6 rev2 §3 末行；`#424:16`、`#418:21,117-119,460` | §2-A12、§7-D1 边界规则 | 设计采纳为契约边界判据的规范依据之一；未来任何 γ/数据面测试新增断言同受此口径约束 | 否（既有纪律的回归） |
| 模块门（`packages/ws-replication/AGENTS.md`「Verification」）：缝变更须跑 edge/session 契约、OPEN 准入管线、route-key/wire parity guard，再包 typecheck + 根 `pnpm typecheck`/`pnpm test` | 模块 AGENTS.md「Verification」段 | §12 门禁集 | 本票零缝变更（rev2 为纯测试断言边界修订），但按收官口径**全量执行**该门集（AC3/AC4 命名集即其子集的超集闭合） | 否 |
| 生产实现冻结（派工「do not implement changes」+ SA6 §3 生产者边界） | 派工 / SA6 §3/§16 | §1 非目标、§11 DENY | `src/**` 恒空不变量贯穿终验阶段（EV-7） | 否 |
| A4.8：成功路径 β wire 逐字节等价；listen/β 矩阵全绿为硬门 | A4.8（:97-99） | §12 行 5 | 矩阵门禁复跑 | 否 |
| SA8 iteration-0 §10 复查重启条件（条件 2「门禁复跑发现需改生产/契约才能转绿」已触发并消费；条件 1/3 继续武装） | SA8 iter-0 §10（经 iter-1 §10 引用维持） | §15 | 条件 2 的消费记录 = rev1→rev2 修订链（§7-D1）；D2 已落地且经核对其纪律句与 §24.8/§23.1 相符（条件 1 现不触发）；HEAD 未前移（条件 3 现不触发） | —（由 R-2 复查统一裁） |

---

## 7. 设计决策与主要备选方案

### D1 — 验收契约裁定（本票核心裁定，**iteration 1 重锚 rev2**）

**裁定**：本票 AC1/AC2 的最终可执行验收面 = **SA6 rev2 契约内容**，以 sha256 钉死：

- `packages/ws-replication/test/ws-replication-issue451-gamma-observability-anchor.test.ts` = `4a8556bbecb775fd70a054051ee6599f9600ea01e9a26700a4818ad683bc3b4c`（432 行 / 9 用例）
- `packages/ws-replication/test/ws-replication-issue451-gamma-surface-freeze.test-d.ts` = `ef897240096c78a0b45e04cb5cc77f777a351b744a720f86c72a892520c42184`（74 行，自落地起零改动）

**终验阶段不得再改动两文件**（断言/用例/夹具均冻结；EV-7 sha 门）。依据：

1. **契约与规范逐字对应**（ANCHOR-EDGE ↔ §23.1 edge 行 + §24.8 首句；ANCHOR-SESSION ↔ §23.1 session 行 + R21 改道；**ANCHOR-ORDER-C1（rev2）↔ §24.8 第三句「无全序」——可执行判据只含调度不变量事实 + `bytes` 单轮自证（§24.8 首句「事件字段必须回指本轮真实帧字节事实」的直接检验）**；SURFACE ↔ A4.1 append-only + #450 增量成员）。SA8 iteration-1 对 rev2 边界判 **implements-existing-decision**（两处）+ no-conflict，无 hard-conflict、无需 override（被剔除的「跨 boot 字节相等」判据不出现在任何 ADR/协议/CONTEXT/模块决策文本中）。
2. **敏感性三路反证**：M1（edge 发射关闭）= 5/9 红；M2（session 发射恢复）= 4/9 红；**M3（`update-sent.bytes + 1` 对称说谎）= 3/9 红且含 ORDER-C1**——rev1 边界下 M3 仅 2/9（ORDER-C1 对对称字节膨胀不敏感），rev2 严格更强（E13/H10）。
3. **确定性已结构性成立**：RNG 派生量（live doc `clientID` varint 宽度 ⇒ 载荷长）移出判据面后，聚焦契约独立进程 40/40 绿（旧机制下 40 连绿概率 ≈ 0.7%）、240 轮真 boot 探针 0 假红（E9）。
4. 已被仓库真实入口发现（包套件 3× 105/945、根 2× 468/5675 逐文件列出；`.test-d` 被 `vitest --typecheck` + `tsc -p` 双入口覆盖）。
5. 生产零改动边界下，任何「顺手加固」都违反派工与 SA6 §3，且置 β parity 于无谓风险。

**rev1→rev2 修订史与授权链**（设计层登记，防「契约从未改过」误读）：

| 环节 | 事实 | 证据 |
|---|---|---|
| rev1（废止） | sha `3088fb7b…b3cb0c`，400 行 / 9 用例；ORDER-C1 投影含 `bytes`（`type/side/namespaceId/sequence/bytes`）+ 跨两轮独立 boot `toEqual` | SA3 §2 备案；SA8 iter-1 §1 sha 谱系 |
| 缺陷暴露 | SA3 包套件 7 次 3 红（恒为 ORDER-C1，`bytes` 24 vs 27 方向翻转）；SA3 按纪律 `reject` + `requiresConflictRecheck: true` 而非修断言 | SA3 §7.1/§7.5；`sa3-suite-repro.log` |
| 根因裁定 | live Y.Doc `clientID` CSPRNG 宽度抽签（S1–S7）；生产行为无缺陷，缺陷在契约断言边界 | SA6 rev2 §8.2；`clientid-probe.log`、`order-rng-probe2.log` |
| 授权路径 | SA8 iteration-0 §10 复查重启条件第 2 条「门禁复跑发现需改生产/契约才能转绿」预登记该情形；SA6 作为契约 owner 在其权限内原位修订（**无需 override**——无决策文本被违背） | SA8 iter-1 §3 末行/§4；SA6 rev2 §12.5 |
| rev2（现行） | sha `4a8556bb…bc3b4c`，432 行 / 9 用例；投影键集 `type/side/namespaceId/sequence`（:118-133）；逐轮 `bytes === payloadBytesOfFrame(round, seq)`（:372-389，缺帧响亮 throw :141-143） | 本设计 §2-A8 复核 |
| 复查触发 | `requiresConflictRecheck: true`（SA3 §7.5 / SA6 §15 B-1 / SA8 iter-1 §10 三处一致） | §15 |

**边界规则（SA6 §12.5 裁定，设计采纳为本票及其后 γ 契约的判据纪律）**：跨调度（跨线程无全序）契约**只允许**比较**调度不变量**事实：每型事件的 `type`/`side`（归属侧）/`namespaceId`/`sequence` 与计数；`bytes` 属**单轮自证事实**（每轮 `bytes === 本轮 wire 载荷长`）。**任何跨独立 boot 的字节相等断言，在生产者未钉死编码输入（此处 = live doc `clientID`）时都是 RNG 抽签检测，不得进入契约**——该裁定与仓库既有 #424 ORACLE-2 / #418 C3 口径同构。**该裁定不是放宽**：以「同轮 wire 自证」替代「跨轮抽签相等」，对字节事实说谎的敏感性由 E13 证明为增强（2/9 → 3/9）；**禁止回退**（SA8 R-1b / EV-5——任何复活跨 boot 字节相等断言的「简化」都使 M3 检出力跌回 2/9 且重引入 11.65%/对 假红，一律拒绝）。

**终验阶段的动作 = 门禁复跑 + 证据落档**（§12，EV-1..EV-8 口径），不是改测试。

### D2 — 收官登记：**已完成态**（iteration 0 的将来时表述废止）

`packages/ws-replication/AGENTS.md` Boundaries 段 γ 桥义务 bullet **已由 SA3 落地于 :18**（`git diff --stat` = +1 insertion / 0 deletion；本设计重读核对在位）。落地内容覆盖 SA6 O-1/O-2 全部要点 + SA2 iteration-0 N-2/N-3 润色：

- 宿主运输义务：专用 FIFO 通道对 per (connectionKey, namespaceId) + 回执盖章点同步投递（egress `sendDataFrame` 返回 wire sequence，同一同步段桥回 session 入站通道为 `receipt{tag, sequence}`，先于后续 socket 数据）；
- 违契响亮收口（N-2 精确形态）：「an ACK referencing a sequence whose receipt has not been registered fails loudly on the session side (`ACK_STATE_VIOLATION` 1002; violating transport obligations 1–3 is a host bug, §24.2.6)」——never degrade silently；
- observer 两侧注入纪律：`update-sent` 与连接域类型只经 edge 工厂 `observer`（N-3 括注：拒绝路径复刻事件 `namespace-error{direction:'sent'}`（授权拒绝 / throw / openAdmission / no-sink 合成）与 `namespace-failed{cause:'open-failed'}` 亦在 edge 观测面）；session 域结算事件（`update-acked`、chunked 族）只经会话宿主 `observer`；跨线程 observer 事件无全序 ⇒ 测试断言 per-side facts 与因果门，never merged-array order；
- 参考实现引用：`test/issue447-async-seam.ts`。

**定性**：docs-only、已完成；本设计修订后**无进一步落笔义务**（§11 ALLOW 行 2 改为维持态；再编辑需新裁定）。**验证（终验收尾核对项）**：`git diff --stat packages/ws-replication/AGENTS.md` = 1 insertion；bullet 引用符号（`handleReceipt`（`hub-session-async-host.ts:70`）/ `ACK_STATE_VIOLATION` 1002（`hub-namespace.ts:693-700`）/ 夹具路径）与 HEAD 一致（SA3 §4 已核；SA2/SA8 复核判语义与 §24.2.6/§24.4/§23.1 精确对齐）。

### D3 — AC5 尾句「转人工合并」的收官路由（含 SA8 R-3 顺序约束）

- 一致性核对**结论**已闭合（SA6 §12.4，18 条款全「一致」；O-1/O-2 已落地为 D2）；
- **路由顺序**（SA8 R-3）：本设计修订（R-1，本文件）→ **SA8 修订后复查（R-2）** → （如 Controller 派工）SA4/SA7 终验 → 人工合并。R-1/R-2 完成前本票**不进终验**——否则全量门禁会以过期设计为依据；
- 合并动作（PR #446 → main 的 merge）为**人工动作**：所有 SA 不执行 `git add/commit/push`、不开 PR、不合并（SA6 §12.3 同判）；终验产物（rev2 契约 + rev2 证据族 + 本设计 + AGENTS.md 登记）即移交材料；
- 收官判定链：§12 全部门禁绿（EV-1..EV-7 口径）+ D2 落地在案 + SA6 §12.4 结论在案 + SA8 R-2 复查通过 ⇒ 票面 AC1–AC4 可勾、AC5 的核对半句可勾；「转人工合并」半句在移交说明中登记为待人工。

### D4 — 门禁与证据集（终验阶段执行口径）

见 §12（命令、入口、预期观察逐行；EV-1..EV-8 对齐）。补充纪律：任一门禁非绿即**阻塞上报**（含与本票无关的既有红灯），不得通过缩小测试集、加 skip/only、env override 或改断言换取绿——失败时如实报告，不静默降级。**ORDER-C1 再红 ≠ 抽样问题**：rev2 判据面已无 RNG 派生量（40/40 + 240 轮 0 假红），再红只能是真回归或新 RNG 派生量混入判据面——一律阻塞上报并按 EV-4/EV-5 重做 mutation 定位，**不得以「重跑碰运气」处理**（历史教训：SA3 单文件 16 连绿 vs 包套件 3/7 红，见 §13 R-2）。

### 主要备选方案（否决记录）

| 备选 | 否决理由 |
|---|---|
| **A. 夹具钉死 live 文档 `clientID`**（SA3 §7.4-A；仿 `issue450-flow-seam.ts:311`） | **SA6 §12.5 否决**（设计采纳）：① flow round 的 live 文档由生产路径 `doc-runtime/create-initial-document.ts:160` 创建，钉死 = 生产改动（违反零生产边界）；② 测试侧钉死需经共享夹具/registry testing seam 或直改 live `Y.Doc` 内部——前者波及 #447–#450 契约与并行 boot 机制，后者使断言依赖私有夹具内部与文档生命周期旁路；③ 断言将验证「夹具强制的巧合」而非生产可观察不变量；④ SA3 对 `harness.ts:306 makeSeedDoc` 的归因经 SA6 R3 修正后不成立（该 helper 不在 flow round 路径） |
| **B'. 回退 rev2 边界、恢复 rev1 跨轮字节相等断言** | **SA8 R-1b 明令禁止**：重引入 11.65%/对 假红（聚焦 4/30、包套件 3/7 红），且 M3 检出力跌回 2/9（ORDER-C1 对对称字节说谎不敏感）——确定性与敏感性双输；rev1 形态已废止（sha 谱系在案） |
| **C'. 归一化/掩码载荷中 clientID 字节后再比较**（SA6 §12.5-D） | 需解析 Yjs 编码内部（脆弱、版本耦合），且是「掩盖事实」而非「断言正确不变量」——SA6 否决，设计采纳 |
| **D. 把 O-1/O-2 登记进协议 §24 / ADR 0032 正文** | 规范文本已含该义务（§24.2.3 / §24.8 原文在场）；复制规则本体违反 docs/AGENTS.md「link to authoritative source」；改规范文本会把 docs-only 票升级为规范变更，需 SA8 复查，收益为零（SA8 iter-1 §3/§6 同判无需修订） |
| **E. 在协议 §22 Conformance 追加 #451 测试资产锚** | §22 锚的是 wire/golden/互通类一致性资产；γ 收官票 #447–#450 均未登记 §22；#451 是观测面归属 + 回归收官，非 wire 一致性面；跟随先例不登记（SA8 N2 同判） |
| **F. 更新 `CONTEXT.md`** | γ 异步形态与序回执词汇已登记（:224-239）；本票不引入/更改领域词 |
| **G. 生产侧「加固」发射点/加守卫** | 行为已与规范一致（P-1~P-9 + E-1~E-13 判别性证明）；任何 src 改动违反生产冻结边界并置 β parity 于风险，无需求来源 |
| **H. 把剩余收官项留作 follow-up 票** | 收官票自身的必要条件不得伪装成后续工作：D2 已落地、设计修订即本文件、门禁复跑属终验动作；唯一 follow-up = R-6（既有 ADR 留待项） |

---

## 8. 接口、状态机和数据流

**接口变化：无。** 公共面（`src/index.ts` 导出集）、缝词汇（§24.3 闭集合）、observer 事件型/字段（§23.1）全部零变化；rev2 为纯测试断言边界修订，本设计修订为纯文档收口（SA8 iter-1 §6「不适用面明确：无 wire/API/schema/持久化面」）。

**状态机：无变化，以下为验收面钉住的不变量**（被测事实，非新设计）：

- 盖章门：`sendDataFrame` → `tryEmitDataFrame` 返回 `sequence`；`> 0` 才发 `update-sent`（未发送/被拒 ⇒ 零事件；ANCHOR-EDGE-NC1）；
- 型门：`updateFrameProbe` 非 UPDATE（含 `0x42` 分块族）⇒ dormant（ANCHOR-EDGE-NC2 / R21）；
- 抑制点：session `onUpdateSent` 普通帧零发射（防双发第二点；ANCHOR-BOTH-C1 / M2 敏感）；
- 三态锚：`SendAnchorState`（`src/types.ts:1036-1048`，未发 / pending / 已盖章）+ 两相记账（`update-channel.ts` tag→seq 换键不换槽；`hub-session-async-host.ts:114` `asyncSendTickets` 单点）——ANCHOR-ORDER-C2 的 `pending() > 0` 判据底座；
- 收口语义：`asyncDataAdmissionFatal: true` 装配下单帧超限 = 返回 0 + `FRAME_TOO_LARGE` 收口 + 零 `update-sent` + 零 wire 字节（ANCHOR-EDGE-NC1）。

**数据流路线：本票零运行时数据流变化**（无生产改动——依据：§11 DENY `src/**` + worktree `src/` diff 恒空）。验收面**观测**的事实流（锚定对象，供评审对照；第三行为 rev2 边界修订后的观测口径）：

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| 出站序事实 | session 推 `frame{tag,bytes,lane}` 过缝 / 宿主直驱 | edge mux 盖章（`[8..12]` 单点） | `sequence>0` 门 + `updateFrameProbe` 型门 | observer 派发（edge 侧） | edge 工厂 `observer` | `update-sent{sequence,bytes,namespaceId}` 恰一；`bytes` = 本轮载荷长（单轮自证）；`sendQueueMs` 整键缺席 | 未盖章 ⇒ 零事件；observer throw 零协议影响（§23.4 隔离） | ANCHOR-EDGE-C1/C2/NC1/NC2 |
| 结算事实 | peer UPDATE_ACK / 末 chunk 回执过缝 | session `onUpdateAcked` / `onUpdateSent(chunked)` | R21 改道（普通族 `update-sent` 归零） | observer 派发（session 侧） | 会话宿主 `observer` | `update-acked{sequence,bytes}` / `chunked-update-{sent,acked}` 恰一 | 改道失效 ⇒ 契约红（M2 实测 4/9） | ANCHOR-SESSION-C1/C2、BOTH-C1 |
| 跨线程无全序（**rev2 观测口径**） | 缝调度（即时 / 扣留后释放），两轮各自独立 boot | 两侧独立派发 | 断言只取**调度不变量**按型投影（`type/side/namespaceId/sequence`，无合并下标、**无 `bytes`**）；`bytes` 逐轮对本轮 wire 载荷自证（`payloadBytesAt` 缺帧即响亮 throw） | 内存 recorder（同一 recorder 双注入点） | 同一 recorder | 两调度投影逐字相同 + 计数恰一 + 每轮 `sent/acked.bytes === 本轮载荷长` + `acked.sequence === sent.sequence`；扣留期单侧在场 + `pending() > 0` | 判据面缺失即响亮 throw；对称字节说谎 ⇒ 红（M3 实测 3/9 含 ORDER-C1） | ANCHOR-ORDER-C1（rev2 :333-396）/ C2（:398-431） |

---

## 9. 错误、恢复、并发和幂等

- **失败语义（被钉住，非新设计）**：γ 装配 `asyncDataAdmissionFatal: true` 下，单帧超限 = 配置错误 ⇒ 响亮收口（`ERROR{FRAME_TOO_LARGE}` + close 1009 + `connection-failed` observer）；账本投影越界 ⇒ `CONNECTION_BACKPRESSURE` 1011；无逐帧拒纳 / deferred / ns 级 send-failed resync（#450 已验收）。宿主桥违契（回执缺失/迟到）⇒ session 侧 `ACK_STATE_VIOLATION` 1002 响亮路径（D2 已登记，§24.2.6）。
- **正常路径不变量缺失 = fail loud**：契约测试的判据面缺失即 `throw`（`payloadBytesAt` :141-143「wire 无 UPDATE 序 …（判据面缺失即响亮 throw）」）；「零命中」断言同场必有正命中（NC-4 记录器活性元判据）——无静默 fallback。
- **确定性依据（rev2，重写）**：全部用例零真实 timer / 零网络 / 零 `worker_threads`；缝推进 = 显式 `release`/`pumpUntil`；随机源钉死 `random: () => 0.5`（背压/退避面）；**live Y.Doc `clientID`（CSPRNG）仍在生产路径自由抽签，但 rev2 已把其一切派生量（载荷字节长度）结构性移出契约判据面**——这是确定性成立的机制依据，辅证 = 聚焦 40/40（旧机制下概率 ≈ 0.7%）+ 240 轮真 boot 探针 0 假红（E9）+ 宽度↔字节长 1:1 零反例（E8）。
- **ORDER-C1 再红处置（ER-2 纪律）**：rev2 判据面无 RNG 派生量 ⇒ 再红只能是（a）归属/发射回归（M1/M2 面）或（b）字节事实回归（M3 面）或（c）未来修订把新 RNG 派生量混入判据面——三者一律**阻塞上报**并按 EV-4/EV-5 重做 mutation 定位；**禁止以「重跑碰运气」处理**（历史教训：SA3 单文件 16 连绿未能揭穿、包套件 7 次采样才揭穿——单样本绿灯不是确定性证据）。
- **幂等**：observer 派发幂等性由「恰一」断言钉住（双发 ⇒ 红，M2 实测）；`close` 幂等、收口后丢弃既有机械不被本票触碰。
- **D2 文档（已落地）**：无运行时语义，不存在错误/恢复面；质量门 = `git diff --check` + 符号引用核对（SA3 已过，终验收尾复核）。
- **阶段失败处理**：门禁非绿 = 阻塞上报（§7-D4），不缩小范围换绿。

---

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| vitest 运行器（root `pnpm test` / 包套件 / `--typecheck`） | 已发现两个 #451 契约文件（rev2 内容；9 用例计数不变，105/945、468/5675 计数在 rev2 下复验一致） | 不变（文件保留，glob `packages/*/test/**/*.test.ts` / `.test-d.ts` 持续命中） | 无 | `vitest.config.ts` include；`rev-postfix-suite-3x.log`、`rev-root-test-2nd.log` 逐文件列出 anchor (9 tests) |
| CI（GitHub workflow） | 全量 `pnpm typecheck`/`pnpm test` | 不变（rev2 并入全量，无配置面） | 无 | `rev-root-test{-2nd}.log` |
| 未来模块 agent / 宿主集成方（读 `packages/ws-replication/AGENTS.md` 装配 γ 桥） | 三条义务并列可见（:17 装配标记 / **:18 宿主运输义务 + 观测纪律（含跨线程无全序「never merged-array order」句）**），权威源引用 §24.2/§24.8 | 不变（D2 已落地；本设计只登记事实） | 无 | `AGENTS.md:17-18`（本设计重读）；SA2 §9 判「与 §24.2.6/§24.4/§23.1 三行归属语义精确对齐」 |
| **SA4/SA7 终验（如派工）** | —（SA8 R-3：R-1/R-2 完成前不进终验） | 消费材料 = rev2 契约（钉 sha）+ rev2 证据族 + 本设计（iteration 1）+ D2 落地态 + §12 门禁口径（EV-1..EV-8）；不得把 rev2 文件误判为 DENY 违约产物 | 无代码改动；按 §12 复跑门禁 | SA8 iter-1 §8 R-3；SA3 §10 交付顺序提示 |
| 未来读设计/契约者（防错误前提传导） | iteration 0 曾传导「契约从未改过 / 确定性已证 / 无需复查」三个错误前提 | 本设计消除：修订史 + 授权链 + sha 谱系在 §7-D1 登记；确定性新依据在 §9；复查翻转在 §15 | 无 | SA2 §6 失配表 C-1..C-8（本版逐项清零，见 §14 映射） |
| PR #446 人工合并者 | —（等待收官材料 + SA8 R-2 复查结论） | 消费材料 = SA6 rev2 契约 + §12.4 一致性结论 + 本设计 + D2 登记 + 全绿证据 | 无代码改动；人工 merge 动作 | SA6 §12.3；§7-D3 |
| 生产代码任何调用方（`src/**` 全部消费者） | HEAD 行为 | **逐字节不变**（零 src diff 不变量） | 无 | worktree `git status --short packages/ws-replication/src/` = 空 |

无未覆盖调用方：本票（含 rev2 契约修订与本设计修订）不改任何函数签名、返回值、抛错或异步时序。

---

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `wiki/raw/task_issue-451_design.md` | 本设计（iteration 1 原位修订，本次落笔） | SA1 设计产物（本文件）；SA2 F-1 / SA8 R-1 的修订义务载体 |
| `packages/ws-replication/AGENTS.md` | **已落地（+1 行，SA3 D2）——维持态，无预期进一步改动**；终验收尾仅复核 `git diff --stat` = 1 insertion 与符号引用 | 收官登记已完成；再编辑需新裁定（防止重复登记/漂移） |
| `artifacts/sa6-issue451-*.log`（既有 32 文件族：rev1 历史证据 + rev2 `rev-*` 族 + `clientid-probe.mjs`/`.log` + `order-rng-probe*` + SA3 `sa3-*` 族） | 终验阶段按 §12 复跑更新/新增同族证据（EV-1..EV-7） | AC3/AC4 收官证据的新鲜度；rev1 日志保留为历史不删（修订史证据） |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/ws-replication/src/**` | 生产行为已在 HEAD 达成规范 | 派工「do not implement changes」+ SA6 §3 生产者边界；`git status --short` 恒空不变量；行为无缺陷（SA6 §8，clientID 随机是 Yjs 正常语义） |
| `packages/ws-replication/test/ws-replication-issue451-gamma-observability-anchor.test.ts` | AC1 契约本体 | **契约本体 = SA6 rev2（sha256 `4a8556bbecb775fd70a054051ee6599f9600ea01e9a26700a4818ad683bc3b4c`，432 行 / 9 用例）**。rev1（`3088fb7b…b3cb0c`）→rev2 修订是**一次性例外**：由契约 owner SA6 依 SA8 iteration-0 §10 条件 2（门禁复跑发现需改契约才能转绿）授权执行，已完成并触发冲突复查（SA3 §7.5 / SA6 §15 B-1 / SA8 iter-1）——**该例外已闭合，不再开放**。此后任何再修改须 SA6 边界裁定 + 门禁证据链 + 冲突复查；终验收尾按 EV-7 核对 sha 不变 |
| `packages/ws-replication/test/ws-replication-issue451-gamma-surface-freeze.test-d.ts` | AC2 契约本体 | sha `ef897240…c42184` 自落地零改动（SA3/SA6/SA2 三源备案一致）；rev2 轮亦零触碰；EV-7 sha 门 |
| `packages/ws-replication/test/issue447-async-seam.ts`、`issue450-flow-seam.ts`、`harness.ts`、`driver.ts` 及其余全部夹具 | 契约复用面 | SA6 §12.1「夹具复用（零新增协议决策）」；rev2 明确零夹具改动（备选 A 否决理由之一）；改夹具会波及 #447–#450 已验收契约 |
| `packages/ws-replication/test/` 下 issue418/420/421/422/423/424 等既有测试 | AC3 矩阵对象 | 收官只验不改；矩阵红 = 阻塞上报而非修断言 |
| `docs/protocols/instance-replication-v1.md` | 规范权威 | §24 已含目标语义；SA8 iter-1 §3/§6 判无需修订（§7 备选 D 否决） |
| `docs/adr/0032-transport-decoupling-edge-session-split.md` | 决策权威 | 无新决策、不修订既有决策（SA8 iter-1：rev2 修订不需 override） |
| `CONTEXT.md` | 共享词汇 | γ / 序回执词汇已登记（:224-239）；无新词 |
| `wiki/raw/task_issue-451_sa6_contract.md` / `_sa2_review.md` / `_sa3_impl.md` / `_design_conflict_report.md` | 上游产物（SA6/SA2/SA3/SA8） | 其他 SA 的产物是 SA1 的只读输入；修订责任归属各 owner |
| `packages/doc-runtime/**`、`packages/namespace-registry/**` | clientID RNG 源所在（§2-A11） | 生产行为正确；SA6 备选 A（钉死 clientID）已否决——任何「顺手钉死」都是生产改动 |
| 其余全部包 / `apps/` / `domains/` / `scripts/` | 无关 | 范围外；全量回归只消费不修改 |
| `.git`（commit/push/PR/merge） | 生命周期 | Runner Host / 人工拥有；AC5 尾句 = 人工合并 |

---

## 12. 验收与验证映射（EV-1..EV-8 口径对齐；「本轮」= SA6 rev2 会话已达标，终验阶段复跑取新鲜样本）

| 需求或风险 | 现有证据（rev2 族） | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1-a `update-sent` 锚 = edge 盖章点 | `rev-postfix-focused-40x.log`（40/40）+ `rev-postfix-suite-3x.log`（3× 含本文件 9/9） | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication/test/ws-replication-issue451-gamma-observability-anchor.test.ts` | `9 passed`（含 C1 恰一/序/长（单轮自证）、C2 直驱判别、NC1 未盖章零、NC2 型门零） |
| AC1-b `update-acked`/chunked 族锚 = session | 同上 | 同上（SESSION-C1/C2、BOTH-C1） | `9 passed`（镜像零 `update-sent`、零连接域、无双发、同 wire 序回指） |
| **AC1-c 断言不依赖跨线程相对顺序（rev2 口径）** | 同上 + `order-audit.log`（A/B 零命中） | 同上（ORDER-C1/C2） | `9 passed`：**调度不变量投影（`type/side/namespaceId/sequence`）逐字相同 + 计数恰一；每轮 `sent/acked.bytes === 本轮 wire 载荷长`（单轮自证）+ `acked.sequence === sent.sequence`；扣留期单侧在场 + `pending() > 0`**。判据面无 RNG 派生量（跨轮断言不得含 live doc `clientID` varint 宽度派生量——SA8 R-1a③ 口径） |
| AC2 公共面 append-only 复核 | `rev-postfix-suite-3x.log`（Type Errors: no errors；sha 不变） | `npx vitest run --typecheck packages/ws-replication/test/ws-replication-issue451-gamma-surface-freeze.test-d.ts`；另被 `npx tsc -p packages/ws-replication/tsconfig.json` 覆盖 | `3 passed`（TS）；2 处 `@ts-expect-error` 均被触发（无 TS2578 = 负控失效即红） |
| AC3 listen + β 矩阵 + parity guard | `-listen-beta-matrix.log`（20 files / 273 tests，rev1 证据保持——此后零相关改动） | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run --typecheck 'packages/ws-replication/test/ws-replication-issue418' 'packages/ws-replication/test/ws-replication-issue420' 'packages/ws-replication/test/ws-replication-issue421' 'packages/ws-replication/test/ws-replication-issue423' 'packages/ws-replication/test/ws-replication-issue424'`（**引号前缀过滤器**交 vitest 匹配——shell glob `*.test.ts` 会漏 2 个 `.test-d.ts`；文件集 = 418×3 + 420×3 + 421×7 + 423×3 + 424×4 = 恰 20：`issue418-{edge-session-split-contract,edge-session-split-structure,pending-window-matrix}`、`issue420-{session-host-api.test-d,session-host-round,shim-matrix}`、`issue421-{edge-accept,edge-factory-api.test-d,edge-lifecycle,error-routing,open-admission-pipeline,route-key-parity,wire-parity}`、`issue423-{observer-emission-split,sa7-dynamic,update-offset-guard}`、`issue424-{auth-parity,cross-seam-round,lifecycle,multi-worker}`；夹具 `issue420-shim-hub.ts` / `issue424-sharded-hub.ts` 非 `.test.*` 不入集；复跑以运行输出的逐文件清单核对 20/273） | `273 passed`；`Type Errors: no errors`（issue422 两文件不在 AC3 命名集，由行 9 全量覆盖——§13 R-3 登记） |
| AC4-a₁ 包 tsc | `-rev-package-tsc-root-typecheck.log`（exit 0） | `npx tsc -p packages/ws-replication/tsconfig.json` | exit 0（零输出） |
| **AC4-a₂ 包套件（EV-2：≥3 次）** | `-rev-postfix-suite-3x.log`（3× 105/945 全绿 + Type Errors: no errors） | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication` ×≥3 | 每次均 `105 files / 945 tests` 全绿；**跨运行零红灯（确定性——EV-1 同源要求）** |
| **EV-1 契约确定性** | `-rev-postfix-focused-40x.log`（40/40；修订前对照 4/30 红） | 聚焦契约文件独立进程 ≥30 次 | 0 红（任一红 = 阻塞上报并按 §9 ER-2 定位，不得重跑碰运气） |
| AC4-b 根 typecheck | `-rev-package-tsc-root-typecheck.log`（15 段链 exit 0） | `pnpm typecheck` | exit 0 |
| **AC4-c 根全量测试（EV-3：≥2 次独立样本）** | `-rev-root-test.log` + `-rev-root-test-2nd.log`（2× 468/5675 全绿；run2 首部备案 HEAD + revised sha） | `pnpm test` ×≥2 | 每次 `468 files / 5675 tests` 全绿；`Type Errors: no errors`；两契约文件被逐文件列出；日志首部备案 HEAD + anchor sha |
| AC5-a ADR A4 / §24 一致性核对 | SA6 §12.4（18 条款全「一致」，§24.8 行按 rev2 边界表述） | 静态核对表（已完成；HEAD 前移则按同表重核——§13 R-4） | 全「一致」维持；无条款回退 |
| AC5-b O-1/O-2 收官登记（**已完成态**） | SA3 D2 落地（`AGENTS.md:18`，+1 行；`sa3-doc-diff.log`：`git diff --check` exit 0 + 符号核对） | 终验收尾复核：`git diff --stat packages/ws-replication/AGENTS.md` = 1 insertion / 0 deletion；bullet 引用符号（`handleReceipt` / `ACK_STATE_VIOLATION` 1002 / 夹具路径）与 HEAD 一致 | 单 bullet 增量 diff 维持；引用符号可解析；无重复登记 |
| AC5-c 转人工合并 | SA6 §12.3 边界登记 + SA8 R-3 顺序 | 无可执行面（人工动作） | 移交说明登记「待人工 merge PR #446」（前置：SA8 R-2 复查通过）；SA 全程零 git 生命周期操作 |
| **EV-4 归属敏感性（历史证据，不重跑）** | `rev-mutations-M1-M2-M3.log`（M1=5/9、M2=4/9 红；恢复后 `src/**` 逐字节复位） | 无需重跑（证据闭合；重跑违反生产零改动纪律）；仅在 ORDER-C1 再红等退化疑点出现时按 SA6 边界重做 | M1=5/9、M2=4/9 红且红灯落对应归属断言 |
| **EV-5 字节事实敏感性 + 禁止回退（SA8 R-1b）** | `rev-mutations-M1-M2-M3.log`（M3=3/9 红，含 ORDER-C1）+ `rev-M3-boundary-compare.log`（rev1 边界 = 2 红（ORDER-C1 绿）vs rev2 边界 = 3 红） | 无需重跑；**判据纪律**：任何未来契约修订不得使 M3 检出力 < 3/9 或丢失 ORDER-C1 判据面、不得重引入跨独立 boot 字节相等断言 | rev2 边界维持：M3 ≥3/9 红且含 ORDER-C1 |
| **EV-6 RNG 根因回归（可复跑探针）** | `clientid-probe.log`（E8：宽度 1..5 ⇒ 15/18/21/24/27，clientID 出现 3 次；200k 抽样宽度分布）+ `order-rng-probe.log`/`-probe2.log`（E9：240 轮 1:1 零反例、0 假红） | `node artifacts/sa6-issue451-clientid-probe.mjs` + 真 boot 采样（≥200 轮，如需重证） | clientID 宽度 ↔ 载荷长 1:1、零反例；契约判据零假红 |
| **EV-7 不变量（sha 门）** | 本设计头部备案的三方一致 sha + HEAD | 终验收尾：`git status --short packages/ws-replication/src/`（恒空）；`sha256sum` 两契约文件；`git rev-parse HEAD` | src 空；anchor = `4a8556bb…bc3b4c`、surface-freeze = `ef897240…c42184`；HEAD 未前移（前移 ⇒ §12 全表 + AC5-a 按同口径重核） |
| **EV-8 设计/规范收口** | 本设计（iteration 1） | SA1 修订（本文件）+ SA8 R-2 修订后复查 | 设计全文与 rev2 契约/sha/证据族零矛盾；§15 = `true`；SA2 §6 失配表 C-1..C-8 逐项清零（§14 映射） |
| 生产零改动不变量 | worktree `src/` status 空（本设计复核） | 终验各阶段收尾 `git status --short packages/ws-replication/src/` | 恒空 |

---

## 13. 风险、回滚和残余问题

| # | 风险/残余 | 定性 | 处置 |
|---|---|---|---|
| R-1 | D2 文档措辞与规范漂移 | 低（已闭合） | bullet 已落地并经 SA2/SA8 对照 §24.2.6/§24.4/§23.1 原文核验语义精确；终验收尾仅复核 diff 维持 +1 行与符号可解析；再编辑需新裁定 |
| **R-2（重写）** | **ORDER-C1 再红被误判为抽样/环境问题** | 中（错误恢复路径风险；iteration 0 的「确定性已证 + 3 连绿」安抚文已被证伪为误导——SA3 单文件 16 连绿曾差点掩盖包套件 3/7 红） | 确定性依据已换为**结构性论证**：RNG 派生量移出判据面（§9）+ 40/40 + 240 轮探针 0 假红；§7-D4/§9 明示「再红 = 真回归或新 RNG 派生量混入 ⇒ 阻塞上报，按 EV-4/EV-5 重做 mutation 定位，禁止重跑碰运气」 |
| R-3 | AC3 命名集不含 issue422 两文件（listen:false 服务入口面） | 覆盖登记（非缺口） | issue422-* 在包套件（105 文件）与根全量（468 文件）内被 AC4 覆盖；此处显式登记避免「矩阵=全部」误读 |
| R-4 | HEAD 前移（收官前集成分支再进 commit）导致证据过期 | 低 | 终验以复跑日志为准；AC5-a 一致性表按同表重核；EV-7 把 sha + HEAD 备案为设计不变量（`rev-root-test-2nd.log` 首部实践） |
| R-5 | 人工合并动作悬置（AC5 尾句不可由 SA 完成） | 移交项（非任务内缺口） | §7-D3 移交说明；不伪装成 follow-up 技术票 |
| R-6 | 后续 γ 义务演进（如真 worker 形态、peer 侧对称拆分——ADR 0032 后果节留待项） | 明确 follow-up（非本票） | 已在 ADR 登记；本票不触碰 |
| **R-7（新增）** | **rev2 边界被未来「简化」回退**（重引入跨独立 boot 字节相等断言，或把 RNG 派生量混回判据面） | 低（有量化门） | 三级防线：§7-D1 边界规则（裁定层）+ §12 EV-5（验收层：M3 ≥3/9 且含 ORDER-C1）+ 本行（风险层）；rev1 形态已废止且 sha 谱系在案；任何此类提议须 SA6 边界裁定 + 冲突复查 |
| R-8 | SA6 报告行锚笔误级漂移（N-2'：`:379-388` 实为 `:372-389` 等）与 240 轮配对口径未定义（N-3'：238 对） | 极低（非阻断，SA2 判定） | 本设计一律采用自验行锚（§2-A8/§5.2）；引用 SA6 数字时保持原报告口径不改写 |

**回滚**：本设计修订 = 单文件原位替换（wiki 产物，无运行时）；D2 = 单 bullet 的 revert 即恢复；anchor 契约 rev2 的「回滚」= 恢复 rev1 边界——**非合理回退路径**（复活 11.65%/对 假红 + M3 检出力降级，SA8 R-1b 禁止；灾难恢复场景以 git 历史为准）。生产面无回滚需求（零改动）。

**任务内解决项 vs follow-up**：任务内 = 本设计修订（本文件）+ D2 落地（已完成）+ §12 门禁复跑（终验动作）+ SA8 R-2 复查 + D3 移交说明；follow-up = R-6（既有 ADR 留待项）。无未解决的任务内必要条件。

---

## 14. 评审修订映射

本次修订的输入 = SA2 评审 iteration 1（`reject`：F-1 BLOCKER + F-2 MAJOR + N-1 MINOR）、SA8 冲突报告 iteration 1（`reject`：R-1a/R-1b/R-1c + R-2/R-3）、SA3 实施报告（`reject`：§7 根因 + §7.4 备选 + §7.5 复查裁定）、SA6 契约 rev2（§15 B-1 + §12.5 EV-8）。逐条：

| Finding | 修订位置 | 处理结果 |
|---|---|---|
| **SA2 F-1①**（BLOCKER，12 项之①：头/§14 重登记输入） | 头部「上游输入」全部在案清单 + §14 本表 | 已落实：SA6 rev2 / SA2 iter-1 / SA8 iter-1 / SA3 四产物登记，缺席面更新（sa4/sa7/前置门禁产物） |
| **SA2 F-1②**（§2-A8 → 432 行 / 9 用例 / sha rev2） | §2-A8 | 已落实（含 rev2 边界锚点 :118-133/:139-145/:333-396/:398-431，自验行锚） |
| **SA2 F-1③**（§2-A9 补 rev2 族 + probe） | §2-A9 | 已落实（40/40、3×945、2×4675、M1/M2/M3、边界对照、双探针、修订前红灯采样、rev1 历史证据定位） |
| **SA2 F-1④**（§3 G3 行补契约缺陷闭合） | §3 G3 行 + 新增 G6 行 | 已落实（G3 按 rev2 口径重写；G6 独立登记缺陷-修复链） |
| **SA2 F-1⑤**（§5 重接 rev2 §8.2 根因链 + E8–E13） | §5.1 第 2–3 行 | 已落实（S1–S7/U1/R1–R3 + E8–E13 全量承接，含 R3 对 SA3 归因的修正） |
| **SA2 F-1⑥**（§7-D1 重锚 rev2 + sha + 修订史/授权链 + M1/M2/M3） | §7-D1（裁定 + sha 钉死 + 修订史表 + 边界规则 + 禁止回退段） | 已落实 |
| **SA2 F-1⑦**（§11 DENY 该行重写） | §11 DENY 行 2 | 已落实（钉 sha；一次性例外已闭合；再修改须 SA6 裁定 + 证据链 + 复查） |
| **SA2 F-1⑧**（§12 AC1-c 口径 + AC4 证据改 rev-* + 敏感性行补 M3/EV-5） | §12 行 2（AC1-c）、行 6–8、EV-4/EV-5 行 | 已落实 |
| **SA2 F-1⑨**（§13 R-2 重写） | §13 R-2 | 已落实（结构性确定性依据 + 阻塞上报纪律 + 历史教训） |
| **SA2 F-1⑩**（§12 AC4-c 采纳 EV-3 ≥2 样本） | §12 AC4-c 行 | 已落实（≥2 次独立样本 + 日志首部 sha/HEAD 备案） |
| **SA2 F-1⑪**（§7-D2/§3 改已落地态） | §7-D2（已完成态 + 落地内容 + 终验复核项）、§2-A7、§3 G-doc 行、§4 AC5 行、§11 ALLOW 行 2 | 已落实（将来时表述全部废止） |
| **SA2 F-1⑫**（§1 非目标第 2 条理由同步） | §1 非目标第 2 条 | 已落实（rev2 已批准 + 40/40 + 包 3× + 根 2× + M1/M2/M3；并新增「不得回退」非目标条） |
| **SA2 F-2**（MAJOR：SA6 EV-8 枚举不全 → 按 F-1 十二项完备清单执行） | 全文（本表 ①–⑫） | 已落实（选 SA2 推荐路径：SA1 按 F-1 完备清单执行，SA6 文本无需改）；F-2 验收口径 = §6 失配表 C-1..C-8 清零：C-1→§7-D1、C-2→§11、C-3→§13 R-2/§9、C-4→§15、C-5→§2-A8、C-6→§2-A9/§5/§12、C-7→§14/头部、C-8→§1/§7-D2/§3，逐项改写 |
| **SA2 N-1**（MINOR：§2-A3 `HubAsyncSessionHandle` 计数笔误） | §2-A3 | 已修正：**6 成员**（`hub-session-async-host.ts:66-79` 自验；无断言依赖该计数） |
| **SA2 N-2'**（SA6 行锚漂移，非阻断） | §2-A8/§5.2/§13 R-8 | 已按 SA2 建议处理：设计引用一律采用本设计自验行锚 |
| **SA2 N-3'**（240 轮/238 对配对口径未定义，非阻断） | §12 EV-6 行 | 保持 SA6 原报告数字口径不改写（0 反例是判据主体；SA2 判数字自洽） |
| **SA2 N-5'**（anchor 文件头注释引 probe1 120 轮 vs 决定性 probe2 240 轮，非阻断） | §2-A8 登记为已知观察 | **不修改测试文件**（rev2 冻结；两探针结论一致，SA2 判非阻断）；如未来 SA6 再开契约修订可顺手改注释指向 probe2 |
| **SA8 R-1a①②③**（EV-8 核心三项） | §7-D1 / §11 DENY 行 2 / §12 AC1-c 与 AC4-a₂ | 已按 SA8 原文落实（口径逐字包含：「跨调度投影不含 RNG 派生量、`bytes` 单轮自证」「再修改须 SA6 边界裁定 + 门禁证据链」「跨轮断言不得含 RNG 派生量；`bytes` 属单轮自证事实」） |
| **SA8 R-1b**（禁止回退） | §7-D1 禁止回退段 + §12 EV-5 行 + §13 R-7 + §1 非目标第 3 条 | 已落实为三级防线 |
| **SA8 R-1c**（header/§2-A8/§5/§14/§15 一致性收尾） | 头部 / §2-A8 / §5 / 本节 / §15 | 已落实（五处全部改写） |
| **SA3 §7**（reject 驱动：AC4-a 非确定性 + 不能在 DENY 内修复的裁定） | §3 G6、§5.1 行 1–2、§7-D1 修订史表、§9 ER-2、§13 R-2 | 已承接：定性改判「契约确定性缺陷（已由 rev2 闭合）」；SA3 的阻塞上报纪律被确认正确并维持 |
| **SA3 §7.4**（三备选修法交裁定） | §7 备选表 A/C' 行 | 已承接：SA6 §12.5 裁决（B+C 采纳、A/D 否决）登记为设计否决记录 |
| **SA3 §10**（交付顺序：修复+设计修订前不进终验） | §7-D3 路由顺序 | 已承接（与 SA8 R-3 合并为同一顺序约束） |
| SA2 iter-0 N-2/N-3（D2 文案润色） | §7-D2 落地内容清单 | 已闭合（SA3 落地时并入；SA2 iter-1 从 finding 面移除——本表仅登记闭环事实） |

---

## 15. 是否需要设计后 ADR 冲突复查及理由

**结论：需要（`requiresConflictRecheck = true`）。**（iteration 0 的 `false` 判定废止——该判定以「契约内容冻结、无既有决策修订」为前提，前提已被 rev1→rev2 演进证伪。）

理由：

1. **三处一致武装**：SA3 §7.5、SA6 rev2 §15 B-1、SA8 iteration-1 §10 均裁定 `true`；SA8 §8 R-2 明列修订后复查的四个检查面（设计-契约-证据同变更集一致、语义相符、无范围扩大、陈旧引用清零）。本设计修订是 SA8 裁定的 `evolution-required` 项（同变更集设计侧文本）的兑现，其闭合必须经同一复查确认。
2. **触发条件的性质**：SA8 iteration-0 §10 复查重启条件第 2 条（「门禁复跑发现需改生产/契约才能转绿」）已事实触发并被消费——验收契约的断言边界在本票变更集内被修订（rev1 → rev2，sha 谱系在案）。这属于「修订既有验收面/冻结面」类别，即便修订方向经 SA8 判为 implements-existing-decision（回归 §24.8 与仓库口径、无需 override），同变更集的设计侧收口仍需复查背书，不能由 SA1 自判闭合。
3. **本设计修订自身的面**：虽然仍是零生产/wire/schema/API/状态机语义变化，但它重写了冻结裁定（D1）、DENY 理由与验收口径（§11/§12）——这些正是 iteration-0 SA8 报告 §5 曾背书的冻结面文本；按「修订既有决策产物需复查」纪律提交 `true`，由 SA8 R-2 统一裁（条件 1/3——D2 偏离规范语义 / HEAD 前移引入新决策面——现均不触发，随复查一并复核）。
