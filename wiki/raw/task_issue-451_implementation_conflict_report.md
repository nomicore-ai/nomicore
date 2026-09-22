# SA8 冲突门禁报告（implementation 复查）— issue #451（γ-T5）：已完成实现与最终 diff × ADR/协议 §24/架构约束

- SA8 dispatch：`sa-ec8cb7cb-9529-45ed-bb9f-70a11a42969c`（mabf-sa8 / conflict-gate / iteration 0）
- 复查基准 worktree：`/home/wangjian/nomicore-fix-issue-451`（分支 `mabf/issue-451`，HEAD **`68ab9f5bfe4df66a54faddf759709a76914332d0`** —— 本复查 `git rev-parse` 核验，与设计头部 / SA6 rev2 §4 / `rev-root-test-2nd.log` 首部备案一致，**未前移**）
- 触发依据：Controller 派工明示「implementation 复查（final diff × ADR / 协议 §24 / 架构约束）」；且实际 diff 触碰决策集收录面（`packages/ws-replication/AGENTS.md` 为模块决策收录文本；新增公共面契约 test-d 冻结 ADR 0032 `:112` append-only 面）——满足 skill 的 implementation 复查触发条件；SA8 iter-2 §8 移交登记①②（终验门禁复跑留证 / EV-7 收尾核对）即本复查的核对对象。
- 本报告只裁决被审对象与既有决策集（ADR 全集 + CONTEXT.md + 协议文档 + 模块 AGENTS 收录决策）的冲突；不裁设计优劣（SA2 域）、不验实现/测试质量与验收完成度（SA4/SA7 域）、不重跑测试、不修改任何被审对象或决策文档。

---

## 1. Reviewed subject

**implementation**。被审对象 = issue #451 的**已完成实现与最终 diff**（worktree 相对 HEAD `68ab9f5` 的全部变更面），本复查逐项核对：

| # | Diff 项 | 形态 | 本复核事实 |
|---|---|---|---|
| D-1 | `packages/ws-replication/test/ws-replication-issue451-gamma-observability-anchor.test.ts` | **新增**（untracked） | **432 行 / 9 用例**，sha256 `4a8556bbecb775fd70a054051ee6599f9600ea01e9a26700a4818ad683bc3b4c`（本复查 `sha256sum`+`wc -l` 复验，与设计 §7-D1 / SA6 §12.1 / SA3 §2 / SA2 r2 §1 四方备案一致）；rev2 边界在位：`anchorProjection` `:118-133` 键集 = `type/side/namespaceId/sequence`（**无 `bytes`**）、`payloadBytesAt` `:139-145` 缺帧响亮 throw（`:141-143`）、ORDER-C1 投影 `toEqual` `:371` + 逐轮单轮自证 `:372-389` + `acked.sequence === sent.sequence` `:388`、ORDER-C2 因果门 `:398-431`；全文 5 处 `bytes` 断言（`:173`/`:202`/`:277`/`:381`/`:385`）全部对本轮 wire 载荷自证，**零跨 boot 字节相等断言** |
| D-2 | `packages/ws-replication/test/ws-replication-issue451-gamma-surface-freeze.test-d.ts` | **新增**（untracked） | 74 行 / 3 编译期用例 + 2 活体 `@ts-expect-error` 负控（`:66`/`:72`），sha256 `ef897240096c78a0b45e04cb5cc77f777a351b744a720f86c72a892520c42184`（复验一致）；断言 `keyof HubAsyncSessionHost = 'open'`、β 监听器同步返回 `number`、`asyncDataAdmissionFatal: true \| undefined` |
| D-3 | `packages/ws-replication/AGENTS.md` | **修改**（tracked，**+1 insertion / 0 deletion**，`git diff --numstat` = `1 0`；`git diff --check` exit 0） | D2 收官登记 bullet 落于 `:18`：γ 桥宿主运输义务（专用 FIFO 通道对 / 回执盖章点同步投递 / `ACK_STATE_VIOLATION` 1002 / §24.2.6）+ observer 两侧注入纪律（含 edge 拒绝路径复刻事件括注）+ 跨线程无全序「never merged-array order」纪律句 + 参考夹具引用；引用符号 `handleReceipt`（`hub-session-async-host.ts:70`）/ `ACK_STATE_VIOLATION` 1002（`hub-namespace.ts:693-700`，本复核 grep 命中）/ 夹具 `test/issue447-async-seam.ts` 全部可解析 |
| D-4 | `artifacts/sa6-issue451-*`（44 文件：43 `.log` + `clientid-probe.mjs`）+ `wiki/raw/task_issue-451_*`（8 份，含本报告） | **新增**（untracked） | 证据与过程产物；关键日志尾行/首部抽验全部相符（§5 冻结面表） |
| D-5 | 生产实现 `packages/ws-replication/src/**` | **零改动** | `git status --short packages/ws-replication/src/` = **空**（本复核） |
| D-6 | `docs/protocols/**`、`docs/adr/**`、`CONTEXT.md` | **零改动** | 全仓 tracked 修改仅 D-3 一处（`git status --porcelain | grep -v '^??'` 复核） |

夹具（`issue447-async-seam.ts` / `issue450-flow-seam.ts` / `harness.ts` / `driver.ts`）与既有 issue418–424 测试全部 tracked 且未修改；`test/` 目录零 `zz-*` 残留。

## 2. Inputs and decision set

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-451.md`（Host 简报；issue open，5 AC + Blocked by #449/#450；Comments 空） | 在案 |
| `wiki/raw/task_issue-451_design.md`（SA1 iteration 1，rev2 对齐修订，22:09Z） | 在案（全文精读；实现依据 = §7-D1 冻结裁定（钉 sha）/ §11 ALLOW·DENY / §12 EV-1..EV-8 验收映射 / §13 风险） |
| `wiki/raw/task_issue-451_sa6_contract.md`（SA6 **rev2**：§12.5 边界裁定 + EV-1..EV-8 + §12.4 18 条款一致性核对 + §15 B-1） | 在案 |
| `wiki/raw/task_issue-451_sa2_review.md`（iter-1 `reject`：F-1 十二项 + F-2 + N-1）/ `_sa2_review_r2.md`（iter-2 `approve`，无 BLOCKER/MAJOR） | 在案 |
| `wiki/raw/task_issue-451_sa3_impl.md`（SA3 iteration 1：实现面与批准设计/rev2 契约一致，本轮零新增代码改动，门禁复跑留证） | 在案 |
| `wiki/raw/task_issue-451_design_conflict_report.md`（SA8 iteration 2 = R-2 修订后复查：`clear`，`requiresConflictRecheck=false`） | 在案（其 §8 移交登记①②③为本复查核对对象） |
| `task_issue-451_relevant_decisions.md` / `_conflict_report.md`（前置门禁产物）/ `task_issue-451_sa4_review.md` / `_sa9_*` / `_sa7_report.md` | **不存在**（本复查目录清单核验）。非阻塞：SA8 iter-1/iter-2 同判——规范权威继承链 = spec #445（ADR 0032 附录 A4 + 协议 §23.1/§24 + 词表）+ 上游票 #447–#450 的 SA6/SA8 结论已随 PR #453/#455/#456/#459 合入 HEAD |
| Owner 评论 | REST 快照 **`[]`** @2026-09-22T14:29Z（本次 dispatch 提供；此前 12:33–13:57Z 八个时点连续为空）⇒ **无 owner override 权威在场**；需求全集 = Issue 正文 5 条 AC |
| ADR 全集（`docs/adr/`，31 份） | 状态行读毕：**0032 已接受**（`状态：已接受`，本案架构权威）；0010/0012/0013/0022/0023/0027–0030 等已接受；**0015 为「提议」不构成约束**；无触及复制面的 superseded ADR |
| 协议 `docs/protocols/instance-replication-v1.md` | §23.1 发射侧归属表（`:833-846`，edge `update-sent` 行 `:840`、拒绝路径复刻行、session 行）/ §23.2 稳定码闭集合 / §24 全节逐条读毕（§24.2 `:1099-1106` / §24.3 `:1108-1120` / §24.4 / §24.5 / §24.8 `:1149-1154`，无全序条款 `:1153`）；**零 tracked 修改** |
| `CONTEXT.md`（`:224-239`） | 复制 Edge / SessionHost（γ 异步形态）/ 序回执（保序条款）/ 路由键契约词汇已登记；零修改 |
| 模块决策收录 `packages/ws-replication/AGENTS.md` | 读毕：γ 装配义务 bullet `:17` + **D2 落地 bullet `:18`（本 diff D-3）** + 「Verification」`:25-27` 门集 |
| 源码 / 测试 / 日志 | 仅用于**确认当前事实**（§1 复核事实 + §5 冻结面表），不替代决策文本 |

## 3. Decision analysis

| Decision | Clause | Subject behavior（diff 实现） | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| 协议 §24.8 首句（`:1151`）+ §23.1 edge 行（`:840`）+ ADR 0032 A4.7（`:93-95`）/ 决策 5 注记（`:114`「`bytes`/`namespaceId` 由帧字节定偏移判定」） | `update-sent` 发射点 = edge 盖章点；事件字段回指**本轮**真实帧字节事实 | D-1 契约 ANCHOR-EDGE-C1/C2/NC1/NC2 逐条 enforce：恰一 / `sequence` = wire 序（直驱判别面 `:182-203`）/ `seq=0` 门零事件（`:205-227`）/ 型门（`:229-252`）；`bytes` 断言全部 = `payloadBytesOfFrame(本轮)`（单轮自证）——「事件字段回指本轮帧字节事实」的可执行兑现 | **implements-existing-decision** | 协议 `:1151`、`:840`；ADR 0032 `:114`、`:93-95`；测试 `:150-252`、`:372-389`；源码锚复核 `hub-edge.ts:284-288`（盖章→`seq>0` 门→发射）与 `:869-886`（`emitUpdateSentAtStamp` 无 observer 首行门 + `updateFrameProbe` 型门） | 无 |
| 协议 §24.8 第三句（`:1153`；跨线程无全序、金标适用域 = α/β）；ADR 0032 A4.7；模块 AGENTS.md `:18` 纪律句 | 测试断言 per-side facts 与因果门，never merged-array order | D-1 ORDER-C1/C2：调度不变量投影（`type/side/namespaceId/sequence` + 计数恰一）`toEqual`（`:361-371`）、逐轮 `bytes === 本轮 wire 载荷长`（`:372-389`）、扣留期单侧在场 + `pending() > 0` 因果门（`:398-431`）——无任何合并数组下标断言 | **implements-existing-decision** | 协议 `:1153`；ADR 0032 `:93-95`；模块 AGENTS.md `:18`；测试 `:118-133`、`:333-431`；`order-rng-probe2.log`（240 轮 0 假红） | 无 |
| 协议 §24.8 首句后半 + §23.1 session 行 | `update-acked` / chunked 族在 session 回执/结算点；session 观测面零 `update-sent` | D-1 ANCHOR-SESSION-C1/C2、BOTH-C1：镜像负控（仅 session observer ⇒ 零 `update-sent`、零连接域型）、chunked 族恰一在 session、双 observer 共 recorder 无双发、两事件回指同一 wire 序 | **implements-existing-decision** | 协议 `:1151`、§23.1 session 行（`:843-845`）；源码锚复核 `hub-namespace.ts:1462`（普通帧 `info.chunked === undefined → return` 零发射）与 `:1416-1440`（`onUpdateAcked`） | 无 |
| ADR 0032 A4.1（`:59-65`）+ 后果（`:112`「公开面一经发布即冻结、演进只能 append-only」）+ 协议 §24.3（`:1108-1120` 缝词汇闭集合） | γ 公共面 append-only；β `HubSessionFrameListener` 同步返回 `number` 冻结签名逐字不动；缝词汇无拒纳/闸门/信用 | D-2 test-d 三用例 + 两负控（γ 冒充 β / `false` 标记 ⇒ TS2578 红）冻结 `keyof HubAsyncSessionHost = 'open'`、β 签名、`asyncDataAdmissionFatal` 精确 `true`；公共导出面自 spec `c86ccbc` 起 `git diff` = **+11/−0**（本复核 stat）；worktree `src/**` 零 diff ⇒ 面未动 | **implements-existing-decision**（冻结面决策的可执行复核载体） | ADR 0032 `:59-65`、`:112`；协议 `:1108-1120`；测试 `:40-57`、`:62-74`；`git diff c86ccbc..HEAD -- src/index.ts` = 11 insertions；源码面复核 `hub-session-async-host.ts:47-84`（词汇闭集合 + Handle 6 成员 + Host 恰一 `open`）、`:114`（`asyncSendTickets: true` 唯一设置点）、`hub-edge-host.ts:186`（`readonly asyncDataAdmissionFatal?: true`） | 无 |
| ADR 0032 A4.2（`:67-75`）/ 协议 §24.2（`:1099-1106`，含 §24.2.3 回执条款与 §24.2.6 违契响亮收口） | 宿主运输义务（专用 FIFO 通道对 / 每方向 FIFO / 回执盖章点同步投递 / 违契 = 宿主 bug 响亮收口） | D-3 把该义务**登记**进模块 AGENTS `:18`：引用规范源（§24.2/§24.8、A4.2/A4.7）而非复制规则本体，符合 `docs/AGENTS.md`「link to authoritative source」纪律；bullet 语义与协议原文逐点对齐（本复核对照：FIFO 对 = §24.2.1-2、同步段回执 = §24.2.3、`ACK_STATE_VIOLATION` 1002 + §24.2.6 = 协议原文 + `hub-namespace.ts:693-700` 源码锚）；引用符号全部可解析 | **implements-existing-decision**（既有规范的登记与参考实现指引，无语义变化、无新决策） | ADR 0032 `:67-75`；协议 `:1099-1106`；`AGENTS.md:18` + `git diff --numstat` = `1 0`；`issue447-async-seam.ts:539`（★ A4.2/§24.2.3 同步段回执注释在场，本复核）；`sa3-r2-doc-check.log` | 无 |
| ADR 0032 A4.3（`:77-79`）/ 协议 §24.5（`:1130-1139`） | 流控单点 = edge；γ 装配 `asyncDataAdmissionFatal: true` 方向性义务；单帧超限 = 响亮收口 | 零改动；D-1 ANCHOR-EDGE-NC1 以该装配为前提断言 `FRAME_TOO_LARGE` 收口 + 零 `update-sent` + 零 wire 字节——对既有决策的 enforcement，非行为变化 | **no-conflict** | ADR 0032 `:77-79`；协议 `:1130-1139`；`hub-edge-host.ts:186,982`；测试 `:205-227` | 无 |
| ADR 0032 A4.8（`:97-99`「验收测试用延迟可注入的显式异步内存管道，不引入 worker_threads；既有 listen 与 β 公共工厂测试矩阵全绿为硬门」）+ 模块 AGENTS「Verification」`:25-27` | 验收纪律与门集 | D-1/D-2 走注入调度器（`settle`/`pumpUntil`/`pumpSteps`）+ 显式扣留释放，零真实 timer / 零网络 / 零 worker_threads；门禁证据在案：聚焦 40/40（`rev-postfix-focused-40x.log` 尾行 `totals: FAIL=0 PASS=40` + SA3 r2 复跑 40/40）、包套件 3× 105/945 + `Type Errors: no errors`（`rev-postfix-suite-3x.log`）、根 test 2× 468/5675（`rev-root-test{-2nd}.log`，run2 首部备案 HEAD + revised sha，两 #451 契约被逐文件列出）、矩阵 20/273（`-listen-beta-matrix.log`）、包 tsc + 根 typecheck exit 0 | **no-conflict**（门集义务的兑现与证据在位；SA8 不裁测试充分性，仅核决策面） | ADR 0032 `:97-99`；模块 AGENTS `:25-27`；`vitest.config.ts:15,20`（两契约被真实入口发现：`packages/*/test/**/*.test.ts` / `.test-d.ts`）；各日志本复核抽验 | 无 |
| ADR 0010（已接受；observer 词汇 append-only、throw 零协议影响）+ 协议 §23.1-23.3 | 事件型/字段/稳定码闭集合 append-only；observer 隔离 | 零事件面变化：D-1 只改对**既有字段**的断言方式；契约内 `throw`（`payloadBytesAt :141-143`）是测试进程内判据面缺失的响亮路径，不触生产 observer 面 | **no-conflict** | ADR 0010 状态行；协议 `:833-860`；测试 `:139-145`；零 src diff | 无 |
| 仓库测试判据口径（`#424` ORACLE-2 `:16`「禁止把数据帧（Yjs 载荷帧）的字节相等写成断言」；`#418` `:21,117-119,460`「payload 逐字节不可跨进程冻结」）——**实践证据，SA8 作旁证不作约束基准**（承 iter-1/iter-2 裁定） | 数据帧禁跨进程/跨 boot 字节相等断言 | D-1 rev2 边界与该口径同构：全部 `bytes` 断言单轮自证；被剔除的「跨 boot 字节相等」判据不出现在任何 ADR/协议/CONTEXT/模块决策文本中（本复核重读确认）⇒ 修订无需 override | **no-conflict** | `ws-replication-issue424-auth-parity.test.ts:16`；`ws-replication-issue418-edge-session-split-contract.test.ts:21,117-119,460`；测试 `:109-117`（边界注释）、`:372-389` | 无 |
| 模块 AGENTS.md 变更边界 + `docs/AGENTS.md` 文档纪律 | 模块决策收录文本的修改须与规范一致、不发明实现行为 | D-3 = 单 bullet +1 行；`git diff --check` exit 0；bullet 全部陈述可解析到协议原文/源码锚/夹具（§1 D-3 复核清单）；「documentation-only wording changes must not invent implementation behavior」满足——每句均有着落 | **no-conflict** | `docs/AGENTS.md`（Authority/Editing/Verification）；`packages/ws-replication/AGENTS.md:18`；`sa3-r2-doc-check.log`（符号核对 + bullet 计数 + `zz-` 零残留） | 无 |
| 派工「do not implement changes」+ 设计 §11 DENY（`src/**` 恒空、两契约 sha 钉死、协议/ADR/CONTEXT/夹具零触碰）+ SA6 §3/§16 生产者边界 | 本票零生产实现改动；契约本体 = SA6 rev2（钉 sha） | 成立：`src/**` status 空、两契约 sha = 钉死值（`4a8556bb…` / `ef897240…`，本复核 `sha256sum`）、协议/ADR/CONTEXT 零 tracked 修改、夹具 tracked 未修改、`test/` 零 `zz-` 残留、HEAD 未前移 | **no-conflict** | dispatch；设计 §11；SA6 §3/§16；本复查 §1 D-5/D-6 + 复核命令输出 | 无 |
| CONTEXT.md 词汇 `:224-239`（γ 异步形态 / 序回执 / 路由键契约）+ ADR 0023（冻结服务表面构造纪律） | 共享词汇已登记；服务对象构造纪律 | D-1–D-3 零新词、零词义变化、零 src 改动；测试注释用词与 CONTEXT 词条一致（「序号事实回传而非接纳信号」同款表述见 `hub-session-async-host.ts:59`） | **no-conflict** | CONTEXT.md `:224-239`；ADR 0023 状态行；git status | 无 |
| **SA8 iter-2 §8 移交登记①②**（终验阶段按设计 §12 EV-1..EV-8 复跑门禁留证；EV-7 收尾核对 src 恒空 / 两契约 sha / HEAD 未前移） | 已登记义务 | 已由 SA3 iteration 1 执行并留证（`sa3-r2-*` 9 份日志）：EV-1 40/40、EV-2 3× 105/945、EV-3 2× 468/5675、EV-6 探针复跑、EV-7 门禁前后双核对（src 空 / sha 不变 / HEAD `68ab9f5`）；本复查抽验日志尾行/首部全部相符 | **implements-existing-decision**（登记义务的兑现） | SA8 iter-2 §8；SA3 §6；`sa3-r2-contract-determinism.log`（`totals: FAIL=0 PASS=40`）、`sa3-r2-package-suite-3x.log`、`sa3-r2-root-typecheck-test.log`（2× 468/5675 + no errors）、`sa3-r2-doc-check.log` | 无 |

**裁决分布**：implements-existing-decision × 6；no-conflict × 7；evolution-required × 0；hard-conflict × 0。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| （无） | （无——Owner 评论 `[]` @2026-09-22T14:29Z，连续第九个空快照；无新 ADR 修订/废弃；无协议版本升级；无决策文本自允演进条款被援引） | — | — |

特别记录（承 SA8 iter-1/iter-2 裁定，本复核对**最终 diff** 维持）：SA6 rev2 的契约修订与 D-3 的模块文档登记**均不是也不需要 override**——被剔除的「跨 boot 字节相等」判据不出现在任何决策文本（rev1 契约自设的过强断言）；rev1→rev2 的授权链 = SA8 iteration-0 §10 复查重启条件第 2 条（预登记「门禁复跑发现需改生产/契约才能转绿」）+ 契约 owner SA6 §12.5 裁定 + SA1 设计同变更集修订 + SA8 iteration-2 R-2 复查 `clear`——链路闭合于本复查之前，最终 diff 即该批准边界的实体。SA8 不替 Owner 或 SA1 创建 override。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（本复查逐项核对实际 diff） |
|---|---|---|---|
| wire 格式与协议语义 | γ 下 wire 逐字节不变（帧字节 `[8..12]` edge 单点重写；host-facing 契约非 wire 契约） | ADR 0032 决策 2 / 状态行；协议 §24 引言 | **未变**（`src/**` 零 diff；diff 全集 = 测试 + 文档 + 证据） |
| γ 缝消息词汇闭集合 | `frame{tag,bytes,lane}` / `settled` / `connection-fatal{code}` / `frame{bytes}` / `receipt{tag,sequence}` / `close` / `terminateUnauthorized`；无拒纳/闸门/信用词汇 | 协议 §24.3（`:1108-1120`）；ADR 0032 A4.1（`:63-65`） | **未变**（`hub-session-async-host.ts:47-84` 复核逐成员一致；D-2 只断言不改面） |
| β 公共工厂冻结签名 | `HubSessionFrameListener` 同步返回 `number` 逐字不动 | ADR 0032 A4.1（`:61`）；模块 AGENTS `:17` | **未变**（D-2 用例② + 负控④-a 在位；零 src diff） |
| 包公共导出面 | `src/index.ts` append-only | ADR 0032 `:112` | **未变**（`c86ccbc..HEAD` +11/−0；worktree 零 src diff） |
| observer 事件型/字段/稳定码 | §23.1 词表 + §23.2 闭集合 append-only；事件字段回指本轮帧字节事实 | 协议 `:833-860`；ADR 0010；ADR 0032 `:114` | **未变**（D-1 只改对既有字段的断言方式；`sendQueueMs` 整键缺席断言与 §24.3 无 accounting 键一致——H3 排除在案） |
| 错误码族 | `ACK_STATE_VIOLATION` 1002 / `FRAME_TOO_LARGE` / `CONNECTION_BACKPRESSURE` 1011 语义与稳定码 | 协议 §13/§23.2；A4.2/A4.3 | **未变**（D-1 断言既有码、D-3 引用既有码；无新增/改名） |
| 协议 §24 / ADR 0032 / CONTEXT.md 文本 | 规范权威零改动 | 设计 §11 DENY；`docs/AGENTS.md` | **未变**（全仓 tracked 修改仅 `AGENTS.md` +1；协议/ADR/CONTEXT git status 零命中） |
| SA6 契约两文件 | rev2 = 冻结基线（钉 sha）；再修改须 SA6 边界裁定 + 门禁证据链 + 冲突复查 | 设计 §7-D1/§11 DENY；SA6 §12.5 | **未变**（anchor = `4a8556bb…bc3b4c` 432 行 / surface = `ef897240…c42184` 74 行，本复查 sha256sum 复验 = 批准值；M1/M2/M3 mutation 临时且 `[restore] identical=True`，src 恒空双证） |
| 模块 AGENTS.md 变更边界 | D2 = 单 bullet +1 行，符号引用与 HEAD 一致，`git diff --check` 干净 | 设计 §7-D2/§11 ALLOW 行 2 | **维持**（+1 insertion / 0 deletion；`handleReceipt` / `ACK_STATE_VIOLATION` 1002 / 夹具路径全部解析；无重复登记） |
| 生产实现 `src/**` | 恒空不变量 | 派工 + SA6 §3/§16 + 设计 §11/EV-7 | **未变**（本复查 git status 空） |
| HEAD / 基线 | `68ab9f5…` 不前移（前移 ⇒ 设计 §13 R-4 全表重核） | 设计头部 / §12 EV-7 | **未前移**（`git rev-parse` 复核） |

## 6. Evolution requirements

**无未决项。** 本票唯一曾裁为 evolution-required 的事项（rev1→rev2 验收契约断言边界的同变更集演进）已完成其全部修订计划要素并经复查闭合：

| 计划要素 | 状态 | 证据 |
|---|---|---|
| 修订文件 | ✓ 契约本体（anchor 文件 rev2，钉 sha）+ 设计 §7-D1/§11/§12 同变更集收口 + 模块登记 D-3 | 本报告 §1 D-1/D-3；设计 iteration 1 |
| 新旧语义 | ✓ 新 = 调度不变量投影 + `bytes` 单轮自证；旧（跨 boot 字节相等）明示废止且 sha 谱系在案（rev1 `3088fb7b…b3cb0c`） | SA6 §0/§12.5；设计 §7-D1 修订史表 |
| 兼容与迁移 | ✓ 纯测试断言边界修订，无运行时/数据迁移面；被剔除判据不出现在任何决策文本 | SA6 §8.2 S7；SA8 iter-2 §4 特别记录 |
| 失败语义 | ✓ 判据面缺失 = 测试进程内响亮 throw（`:141-143`）；再红 = 阻塞上报（设计 §9 ER-2），禁止重跑碰运气 | 测试 `:139-145`；设计 §9/§7-D4 |
| 版本 / 验证 | ✓ EV-1..EV-8 全兑现（40/40、3×945、2×4675、M1/M2/M3、边界对照、双探针、sha 门、设计-规范收口） | 本报告 §3 末行；各日志本复核抽验 |
| 冻结面保持 | ✓ §5 全表未变 | 本报告 §5 |

实现后复查确认（skill 义务）：文档与代码同变更集（设计钉死的 sha = 实体 sha = 日志备案 sha 三方一致）、语义一致（§3 表逐条）、override 未扩大（§4 空）、旧引用已更新（rev1 仅以废止谱系身份存于修订史，无活体口径；SA2 r2 stale 扫描零活体命中 + 本复核抽验一致）。

## 7. Hard conflicts

**无。** 全部对照项为 no-conflict / implements-existing-decision；未发现与 accepted 决策不兼容且无合法路径的行为。（ADR 0015 为「提议」状态，不构成约束基准；无 superseded 复制面 ADR。）

非冲突观察登记（不计入裁决分布，供终验/人工合并参考）：

1. anchor 契约头注释 `:113` 引「实测 120 轮」（probe1）而决定性证据为 probe2 240 轮——SA2 r2 N-5' MINOR 已登记；两探针结论一致（宽度↔字节长 1:1 零反例），且文件按设计 §11 DENY 冻结（sha 钉死），不得为注释措辞再开修订。非决策冲突。
2. 前置门禁产物（`_relevant_decisions.md` / `_conflict_report.md`）与 SA4/SA9 产物缺席——规范权威继承链（spec #445 → ADR 0032 A4 + 协议 §23.1/§24 + 上游票已合入结论）在本复查中直接重读原始决策文本替代，非阻塞。

## 8. Required actions

- **无阻塧行动。** 实现与最终 diff 对既有决策集零冲突；SA8 iter-2 移交登记①②已兑现（§3 末行）、登记③维持（AC5 尾句「转人工合并 PR #446」为人工动作，非任何 SA 权限——SA3 §7 同判）。
- 移交登记（非冲突义务）：人工合并时以「rev2 契约（钉 sha）+ rev2/SA3-r2 证据族 + 设计 iteration 1 + D2 落地态 + 本报告」为收官材料；合并后若后续变更集再触碰 γ 面，按模块 AGENTS「Verification」门集 + 设计 §12 口径复跑。
- 谱系警戒条件（条件性重启触发器，保持武装，非当前义务）：① 终验/CI 阶段 ORDER-C1 或任一 #451 契约真红（rev2 判据面无 RNG 派生量，再红 = 真回归或新 RNG 派生量混入——阻塞上报并按 EV-4/EV-5 重做 mutation 定位，禁止重跑碰运气）；② HEAD 前移引入新 γ 决策面（按设计 §13 R-4 重核）；③ D-3 文本再编辑偏离 §24.2/§24.8/§23.1 语义。触发任一 ⇒ 重开冲突复查。
- 无需 ADR / 协议 / CONTEXT / 模块 AGENTS 修订；无需 owner override。

## 9. Verdict

**clear** —— issue #451 已完成实现与最终 diff（两个新增契约测试文件 + `AGENTS.md` +1 行 D2 登记 + 证据/过程产物；`src/**`、协议、ADR、CONTEXT、夹具零改动）与既有决策集**零冲突**：

1. **最终 diff 是既有决策的可执行兑现而非新决策面**：D-1/D-2 把协议 §24.8 三句、§23.1 归属表、ADR 0032 A4.1/A4.2/A4.7/A4.8 与 `:112`/`:114` 冻结/注记条款逐条转译为可执行判据（implements-existing-decision × 6 的主体）；D-3 按 `docs/AGENTS.md` 纪律以引用方式登记既有规范（零语义变化）。
2. **唯一演进事项（rev1→rev2 边界）授权链完整且实体一致**：批准的 rev2 边界（调度不变量投影 + `bytes` 单轮自证）与最终 diff 实体 sha 逐字相同；被剔除判据不出现在任何决策文本，无需 override；敏感性（M3 = 3/9 红含 ORDER-C1 > rev1 边界 2/9）证明是增强而非弱化——SA8 R-1b 禁止回退的边界在最终 diff 中原样在位。
3. **全部冻结面未变**（§5 十二行逐项核对：wire / 缝词汇 / β 面 / 导出面 / 事件面 / 错误码 / 规范文本 / 契约 sha / AGENTS 边界 / `src/**` / HEAD）；生产零改动不变量与门禁证据（EV-1..EV-7 口径，本复查抽验日志相符）支撑 AC1–AC4 的实现面闭合；AC5 尾句按 AC/设计 §7-D3 维持人工移交。

## 10. requiresConflictRecheck

**false**。理由：

1. **本报告即实现后复查，已闭合**：SA8 iter-2 §10 判 `false` 所依据的「剩余工作不触碰 ADR/协议/冻结面」条件，经本次对最终 diff 的逐项核对成立——design 要求的复查（其 §15 指向的 R-2）已由 iter-2 执行；SA4/SA9 无新决策面发现（产物缺席，无输入）；实际 diff 触碰的模块 AGENTS/公共面契约两面已在本报告 §3/§5 内核对完毕。
2. **无尚待实现核对的决策面**：公共 API（append-only +11/−0 且 worktree 零 diff）、wire、schema、持久化、状态机、生命周期、失败语义全部零变化且在案核验；无正式 override；rev1→rev2 演进已闭合（§6）。
3. §8 谱系警戒条件为**条件性重启触发器**（门禁真红 / HEAD 前移引入新决策面 / D2 再编辑偏离），非当前未决义务——触发时按谱系重开冲突复查，不依赖本标志位。
