# SA8 冲突复查报告（iteration 2，R-2 修订后复查）— issue #451（γ-T5）：修订后 SA1 设计 × ADR/协议 §24/rev2 契约边界

- SA8 dispatch：`sa-93a41c45-dfd3-448a-8120-6c1fd6bbce85`（mabf-sa8 / conflict-gate / iteration 2）
- 复查基准 worktree：`/home/wangjian/nomicore-fix-issue-451`（分支 `mabf/issue-451`，HEAD **`68ab9f5bfe4df66a54faddf759709a76914332d0`** 未前移——本复查 `git rev-parse` 核验，与 SA6 rev2 §4 / `rev-root-test-2nd.log` 首部备案一致）
- 本报告性质：**原位更新**——取代 iteration 1 报告（dispatch `sa-60950833-…`，verdict `reject`：R-1a/R-1b/R-1c + R-2/R-3）的全部结论位；iteration 1 报告文本仅作输入事实引用，不构成当前结论。本次即其 **R-2「修订后复查」** 的执行与闭合。
- 触发链时序（本地时刻，mtime 核验）：SA1 设计 iteration 0 20:56 → SA8 iter-0 21:03（clear）→ SA2 iter-0 21:06 → SA3 实施 21:26（reject）→ SA6 契约 rev2 21:52 → SA2 iter-1 22:01:25（reject，F-1 十二项清单）→ SA8 iter-1 22:01:32（reject，R-1/R-2/R-3）→ **SA1 设计修订 iteration 1 22:09:54（本次被审对象）** → SA8 iteration 2（本报告）
- 复查时点 worktree 事实：tracked 修改**仅** `packages/ws-replication/AGENTS.md`（**+1 insertion / 0 deletion** = D2，`git diff --stat` 核验）；`git status --short packages/ws-replication/src/` **恒空**；其余全部为 untracked（两契约文件、`artifacts/sa6-issue451-*` 32 文件、wiki 产物 6 份）；`test/` 目录零 `zz-*` 残留

---

## 1. Reviewed subject

**design（修订后复审）**。被审对象 = **SA1 设计修订版**：`wiki/raw/task_issue-451_design.md`（iteration 1，rev2 契约对齐修订，2026-09-22 22:09:54 落笔，mtime 晚于其全部修订义务来源：SA6 rev2 21:52 / SA2 iter-1 22:01:25 / SA8 iter-1 22:01:32）。复审四检查面（SA8 iter-1 R-2 定义）：① 设计-契约-证据同变更集一致；② 语义相符；③ 无范围扩大；④ 陈旧引用清零。

附带核对其锚定的事实面：**rev2 `ANCHOR-ORDER-C1` 契约边界本体**（`packages/ws-replication/test/ws-replication-issue451-gamma-observability-anchor.test.ts`，sha256 `4a8556bbecb775fd70a054051ee6599f9600ea01e9a26700a4818ad683bc3b4c`，432 行 / 9 用例——本复查 `sha256sum` + `wc -l` + `grep -c 'it('` 三重复核）。iteration 1 报告对 rev2 边界本体的逐条裁决（implements-existing-decision ×2 + no-conflict ×7，无 hard-conflict、无需 override）已核验成立且本轮复核不变，不再重复展开；本轮增量 = 设计修订版对这些裁决与 R-1 义务的兑现状态。

本报告只裁决被审对象与既有决策集（ADR + CONTEXT + 协议 + 模块 AGENTS 收录决策）的冲突，不裁设计优劣（SA2 域）、不验实现/测试质量（SA4/SA7 域）、不重跑测试。

## 2. Inputs and decision set

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-451.md`（Host 简报，issue open，5 AC + Blocked by #449/#450） | 在案 |
| `wiki/raw/task_issue-451_design.md`（**SA1 iteration 1 修订版**，被审对象） | 在案（22:09:54；全文精读） |
| `wiki/raw/task_issue-451_sa6_contract.md`（SA6 rev2，§12.5 边界裁定 + EV-1..EV-8 + §15 B-1） | 在案（21:52:31） |
| `wiki/raw/task_issue-451_sa2_review.md`（SA2 iteration 1：reject——F-1 BLOCKER 十二项清单 + F-2 MAJOR + N-1 MINOR） | 在案（22:01:25） |
| `wiki/raw/task_issue-451_sa3_impl.md`（SA3：reject + requiresConflictRecheck true；§7 根因链 / §7.4 三备选 / §7.5 复查触发；D2 落地报告） | 在案（21:26:12） |
| SA8 iteration 1 报告（本文件前版：reject + R-1a/R-1b/R-1c/R-2/R-3） | 已被本报告原位取代；其 R-1 义务清单为本轮复核基准 |
| `wiki/raw/task_issue-451_relevant_decisions.md` / `task_issue-451_conflict_report.md`（前置门禁产物） | 不存在（本票无前置门禁产物；iteration 0/1 同判，非阻塞——规范权威继承链 = spec #445 → ADR 0032 A4 + 协议 §24 在案已读） |
| Owner 评论 | REST 快照 **`[]`** @2026-09-22T13:57Z（本次 dispatch 提供；此前 12:33/12:35/12:43/12:53/13:13/13:39/13:48Z 七个时点连续为空）⇒ **无 owner override 权威在场**；需求全集 = Issue 正文 5 条 AC |
| ADR 全集（`docs/adr/`） | 状态行读毕：**0032 已接受**（本案架构权威）；0010/0013/0022/0023 已接受；0015 为「提议」不构成约束；无触及复制面的 superseded 整文 ADR |
| 协议 `docs/protocols/instance-replication-v1.md` | §23.1 发射侧归属表（:833-846，edge `update-sent` 行 :840、session 行）/ §24 全节（§24.2 宿主运输义务 :1099-1106 / §24.3 :1108-1120 / §24.5 / §24.8 观测口径 :1149-1154，无全序条款 :1153）逐条读毕；**零 tracked 修改** |
| `CONTEXT.md`（:224-239） | 复制 Edge / SessionHost（γ 异步形态）/ 序回执（保序条款）/ 路由键契约词汇已登记；零修改 |
| 模块决策收录 `packages/ws-replication/AGENTS.md` | 读毕：γ 装配义务 bullet `:17` + **D2 落地 bullet `:18`**（本复查重读：专用 FIFO 通道对 / 回执盖章点同步投递 / `ACK_STATE_VIOLATION` 1002 + §24.2.6 / observer 两侧注入纪律（含 edge 拒绝路径复刻事件括注）/「cross-thread observer events have no total order, so tests assert per-side facts and causal gates, never merged-array order」纪律句 / 参考夹具引用）+「Verification」`:25-27`；tracked diff = +1 行 |
| 源码 / 测试 / artifacts | 仅用于**确认当前事实**（下方事实核对登记），不替代决策文本 |

**事实核对登记（本复查逐点重验，全部成立）**：anchor 契约 sha256 = `4a8556bb…bc3b4c` / 432 行 / 9 用例，`anchorProjection` `:118` 键集 = `type/side/namespaceId/sequence`（**无 `bytes`**），`payloadBytesAt` `:139-145` 缺帧响亮 throw（:141-143），ANCHOR-ORDER-C1 `:333-396`（投影 `toEqual` :371 + 逐轮 `sent/acked.bytes === payloadBytesOfFrame(round, seq)` 自证 :372-389 + `acked.sequence === sent.sequence` :388 + 投影回指 wire 序 :390-395），ANCHOR-ORDER-C2 因果门 `:398-431`；surface-freeze test-d sha256 = `ef897240…c42184` / 74 行（零改动）；`git diff c86ccbc..HEAD -- src/index.ts` = **+11/−0**；`HubAsyncSessionHandle` = **6 成员**（`hub-session-async-host.ts:66-79`，本复查逐一计数）/ `HubAsyncSessionHost` 恰一成员 `open` / `asyncSendTickets: true` `:114`；`hub-edge.ts:284-288`（盖章 → `sequence > 0` 门 → 发射）与 `:869-886`（`emitUpdateSentAtStamp` 无 observer 首行门 + `updateFrameProbe` 型门）；`hub-namespace.ts:1458-1462`（普通帧 `info.chunked === undefined → return`，:1462 零发射）与 `:1416-1440`（`onUpdateAcked`）；`hub-edge-host.ts:186`（`readonly asyncDataAdmissionFatal?: true`）；`doc-runtime/create-initial-document.ts:160`（裸 `new Y.Doc()`，RNG 源）；`issue447-async-seam.ts:539`（回执盖章点同一同步段投递，★ A4.2/§24.2.3 注释在场）；仓库字节判据口径在场（`#424:16`「禁止把数据帧（Yjs 载荷帧）的字节相等写成断言」；`#418:21,117-119,460`「payload 逐字节不可跨进程冻结」）。证据日志抽验全部相符：聚焦 40/40（`rev-postfix-focused-40x.log` 末行 `totals: FAIL=0 PASS=40`）、包套件 3× 105/945 + `Type Errors: no errors`（`rev-postfix-suite-3x.log`）、根 `pnpm test` 2× 468/5675（`rev-root-test.log`/`-2nd.log`，run2 首部备案 HEAD `68ab9f5…` + revised sha `4a8556bb…`，两 #451 契约文件被逐文件列出）、M1=5/9 / M2=4/9 / M3=3/9 红（`rev-mutations-M1-M2-M3.log`）、M3 边界对照 rev1=2 红（`red IDs=['ANCHOR-EDGE']`，ORDER-C1 绿）vs rev2=3 红（`red IDs=['ANCHOR-EDGE','ANCHOR-ORDER']`）（`rev-M3-boundary-compare.log`）、clientID 宽度分布 P(宽4)=0.061595 / P(宽5)=0.937915 ⇒ 不匹配率 0.116521（`clientid-probe.log`）、240 轮真 boot pairs=238（边界 (i) 含 bytes 22 不匹配 / (ii) 调度不变量 0 不匹配；`sequence=[7]`、`side=["hub"]`、单 nsId 恒定）（`order-rng-probe2.log`）、修订前红灯采样 4/30（`rev-flake-samples.log`）与 SA3 包套件 3/7（`sa3-suite-repro.log`）。

## 3. Decision analysis

| Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| 协议 §24.8 首句 + §23.1 edge 行 + ADR 0032 A4.7 / 决策 5 注记 `:114` | `update-sent` 发射点 = edge 盖章点；`bytes`/`namespaceId` 由帧字节定偏移判定（事件字段回指**本轮**真实帧字节事实） | 设计修订版 §2-A1/A2 锚定该归属矩阵并钉 rev2 契约为可执行载体；rev2 的「每轮 `bytes === 本轮 wire 载荷长`」正是对本条款的直接可执行检验，且经 M3 证明严格强于 rev1 边界（rev1 2/9 vs rev2 3/9 含 ORDER-C1） | **implements-existing-decision** | 协议 `:1151`、`:840`；ADR 0032 `:114`、A4.7（:93-95）；测试 `:372-389`；`rev-M3-boundary-compare.log`；设计 §2-A1/A2/A8、§7-D1 依据 1 | 无 |
| 协议 §24.8 第三句；ADR 0032 A4.7；模块 AGENTS.md `:18`（D2 纪律句） | 跨线程 observer 事件**无全序**；金标适用域 = α/β；测试断言 per-side facts 与因果门，**never merged-array order** | 设计 §8 第三行数据流（rev2 观测口径）+ §12 AC1-c：跨调度投影只取调度不变量字段（`type/side/namespaceId/sequence` + 计数恰一）、无合并下标、`bytes` 单轮自证——rev2 ORDER-C1/C2 逐字兑现该条款 | **implements-existing-decision** | 协议 `:1153`；ADR 0032 `:93-95`；模块 AGENTS.md `:18`；测试 `:118`、`:333-431`；`order-rng-probe2.log`（240 轮 0 假红）；设计 §2-A8、§8 | 无 |
| 仓库测试判据口径（`#424` ORACLE-2 `:16`；`#418` `:21,117-119,460`） | 数据帧（Yjs 载荷帧）字节/长度**禁**跨进程/跨 boot 相等断言——**仓库实践证据，SA8 作旁证不作约束基准** | 设计 §2-A12 把该口径登记为 rev2 边界的规范依据之一，并对未来 γ/数据面测试新增断言施加同口径约束；rev1 的跨 boot 字节相等判据不出现在任何 ADR/协议/CONTEXT/模块决策文本中（本复核重读确认），rev2 是回归而非放松 | **no-conflict** | `#424:16`；`#418:21,117-119,460`；SA6 rev2 §8.2 S7/§12.5；设计 §2-A12、§7-D1 边界规则 | 无 |
| ADR 0032 A4.1 + 后果 `:112`；协议 §24.3 | γ 公共面 append-only；β `HubSessionFrameListener` 冻结签名逐字不动；缝词汇闭集合 | 设计 §2-A3/A5 登记公共面事实（`HubAsyncSessionHandle` 6 成员——iteration 0 的 5 成员笔误已按 SA2 N-1 修正，本复核逐一计数属实）；surface-freeze test-d sha 不变；`src/index.ts` 自 spec `c86ccbc` 起 +11/−0 | **no-conflict** | ADR 0032 `:59-65`、`:112`；协议 `:1108-1120`；sha 复验（§2 登记）；`git diff c86ccbc..HEAD`；设计 §2-A3/A5、§11 DENY | 无 |
| ADR 0032 A4.2 / 协议 §24.2（含 §24.2.3 回执条款、§24.2.6 违契响亮收口） | 宿主运输义务（专用 FIFO 通道对 / 每方向 FIFO / 回执盖章点同步投递 / 违契 = 宿主 bug 响亮收口） | 设计 §2-A7 / §7-D2 登记 D2 **已落地态**（`AGENTS.md:18`，+1 行）：登记内容与 §24.2/§24.2.6/A4.2 语义精确对齐（本复核对照协议原文）；引用规范不复制规则本体（docs/AGENTS.md 纪律） | **no-conflict**（既有规范的登记，无语义变化） | 协议 `:1099-1106`；ADR 0032 `:67-75`；`AGENTS.md:18` + `git diff --stat` = 1 insertion；`issue447-async-seam.ts:539`；设计 §2-A7、§7-D2 | 无 |
| ADR 0032 A4.3 / 协议 §24.5 | 流控单点 = edge；γ 装配 `asyncDataAdmissionFatal: true` 方向性义务 | 设计 §2-A4 登记 `hub-edge-host.ts:186` 精确 `true` 标记 + `:982` 前置门派生；ANCHOR-EDGE-NC1 以该装配为前提；零改动 | **no-conflict** | ADR 0032 `:77-79`；协议 `:1130-1139`；`hub-edge-host.ts:186,982`；设计 §2-A4 | 无 |
| ADR 0032 A4.8 + 模块 AGENTS「Verification」`:25-27` | 成功路径 β wire 等价硬门 + listen/β 矩阵 + 包 typecheck + 根 `pnpm typecheck`/`pnpm test` 门集；缝变更须另跑 edge/session 契约、OPEN 准入、route-key/wire parity guard | 设计 §12 按收官口径全量执行该门集（EV-1..EV-8 口径：聚焦 ≥30 次、包套件 ≥3 次、根 test ≥2 独立样本）；现状证据全绿（§2 登记）；终验阶段复跑留证 | **no-conflict**（门集义务的登记与现状达标） | ADR 0032 `:97-99`；模块 AGENTS `:25-27`；`rev-postfix-*`/`rev-root-test*`/`-listen-beta-matrix.log`；设计 §12 | 无 |
| ADR 0010（observer 词汇 append-only、throw 零协议影响）；协议 §23.1-23.4 | 事件型/字段/稳定码闭集合 append-only；observer throw 隔离 | 零事件面变化；契约判据面缺失 = 测试进程内响亮 throw（`payloadBytesAt` :141-143），不触生产 observer 面 | **no-conflict** | ADR 0010 已接受；协议 `:833-860`；测试 `:139-145`；设计 §8/§9 | 无 |
| 派工「do not implement changes」+ SA6 §3/§16 生产者边界 | 本票零生产实现改动（`src/**` 恒空） | 成立：本复查 `git status --short packages/ws-replication/src/` = 空；M1/M2/M3 mutation 临时且已复位（SA6 §16；src status 空双证）；设计 §1 非目标 / §11 DENY / EV-7 全程贯穿 | **no-conflict** | dispatch；SA6 §3/§16；本复查 git status；设计 §11 | 无 |
| CONTEXT.md 词汇 `:224-239`；ADR 0023（冻结服务表面构造纪律） | 共享词汇已登记；服务对象构造纪律 | 设计修订零新词、零词义变化、零 src 改动（备选 F 同判不更新 CONTEXT） | **no-conflict** | CONTEXT.md `:224-239`；ADR 0023 已接受；git status | 无 |
| **SA8 iteration-1 R-1a①②③ / R-1b / R-1c（同变更集设计修订义务，上轮唯一 evolution-required 项）** | R-1a① §7-D1 冻结裁定重锚 rev2（钉 sha）+「实现阶段不得再改」；② §11 DENY 该行改「契约本体 = SA6 rev2（sha）；再修改须 SA6 边界裁定 + 门禁证据链」；③ §12 AC1-c/AC4-a 口径承认「跨轮断言不得含 RNG 派生量；`bytes` 属单轮自证事实」；R-1b 不得弱于 rev2 边界（EV-5：M3 ≥3/9 红且含 ORDER-C1）；R-1c header/§2-A8/§5/§14/§15 一致性收尾 | **全部兑现**（本复核逐条比对原文口径）：① §7-D1 裁定段 + sha 双钉（`4a8556bb…` / `ef897240…`）+「终验阶段不得再改动两文件（EV-7 sha 门）」；② §11 DENY 行 2 逐字含「再修改须 SA6 边界裁定 + 门禁证据链」+ 一次性例外已闭合表述；③ §12 AC1-c 行「判据面无 RNG 派生量（跨轮断言不得含 live doc `clientID` varint 宽度派生量——SA8 R-1a③ 口径）」+ EV-1/EV-5 行；R-1b 三级防线（§7-D1 禁止回退段 + §12 EV-5 + §13 R-7 + §1 非目标 3）；R-1c 五处全改（头部四产物登记 / §2-A8 rev2 锚点自验 / §2-A9 + §5.1 rev2 族 / §14 三方 finding 映射表 / §15 = true 并路由 R-2） | **implements-existing-decision**（已登记义务的兑现；本复查确认闭合） | SA8 iter-1 §8 R-1a/b/c；设计 `:128-134`（§6 表逐行）、`:151-177`（§7-D1）、`:281`（§11 DENY）、`:301,305,306,313`（§12）、`:331`（§13 R-7）、`:342-369`（§14）、`:373-381`（§15）；本报告 §2 事实核对 | 无（R-2 即本报告，闭合） |

**裁决分布**：no-conflict × 8；implements-existing-decision × 3；evolution-required × 0；hard-conflict × 0。（iteration 1 的唯一 evolution-required 项——设计侧同变更集修订——已由 SA1 执行、由本复查验证闭合，故本轮降计为已兑现义务。）

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| （无） | （无——Owner 评论 `[]` @2026-09-22T13:57Z，连续第八个空快照；无新 ADR 修订/废弃；无协议版本升级；无决策文本自允演进条款被援引） | — | — |

特别记录（承 iteration 1 裁定，本轮复核维持）：SA6 rev2 的契约修订与 SA1 的设计原位修订**均不是也不需要 override**——被剔除的「跨 boot 字节相等」判据不出现在任何 ADR/协议/CONTEXT/模块 AGENTS 决策文本中（rev1 契约自设的过强断言）；修订路径 = SA8 iteration-0 §10 条件 2 预登记的重启授权 + 契约 owner SA6 裁定 + SA1 设计同变更集收口 + 本复查背书。SA8 不替 Owner 或 SA1 创建 override。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| wire 格式与协议语义 | γ 下 wire 逐字节不变（帧字节 `[8..12]` 由 edge 单点重写） | ADR 0032 决策 2；协议 §24 引言 | **未变**（rev2 = 纯测试断言边界修订 + 设计文本修订；src 零 diff） |
| γ 缝消息词汇闭集合 | `frame{tag,bytes,lane}`/`settled`/`connection-fatal`/`frame{bytes}`/`receipt{tag,sequence}`/`close`/`terminateUnauthorized`；无拒纳/闸门/信用词汇 | 协议 §24.3（:1108-1120）；ADR 0032 A4.1 | **未变**（`hub-session-async-host.ts:47-84` 复核） |
| β 公共工厂冻结签名 | `HubSessionFrameListener` 同步返回 `number` 逐字不动 | ADR 0032 A4.1（:61）；模块 AGENTS `:17` | **未变**（SURFACE ② + 负控在位，test-d sha 不变） |
| 包公共导出面 | `src/index.ts` append-only | ADR 0032 `:112`；协议 §24 | **未变**（+11/−0；worktree 零 src diff） |
| observer 事件型/字段/稳定码 | §23.1 词表 + §23.2 闭集合 append-only | 协议 `:833-860`；ADR 0010 | **未变**（rev2 只改对既有字段的断言方式） |
| 错误码族 | `ACK_STATE_VIOLATION`/`FRAME_TOO_LARGE`/`CONNECTION_BACKPRESSURE` 等语义 | 协议 §13/§23.2；A4.2/A4.3 | **未变**（D2 登记为引用，非新增） |
| 协议 §24 / ADR 0032 / CONTEXT.md 文本 | 规范权威零改动 | 设计 §11 DENY；docs/AGENTS.md | **未变**（git status：tracked 修改仅 AGENTS.md +1 行；设计 §2-A10 的「§24.8 行已按 rev2 边界表述」指 SA6 §12.4 核对表该行的判读措辞，非协议文本编辑——本复查读协议原文确认无改动） |
| SA6 契约两文件 | rev2 为冻结基线（钉 sha）；再修改须 SA6 边界裁定 + 门禁证据链 + 冲突复查 | 设计 §7-D1/§11 DENY；SA6 §12.5 | **未变**（anchor = `4a8556bb…bc3b4c` 432 行 / surface-freeze = `ef897240…c42184` 74 行，本复查 sha256sum 复验与三方备案一致；夹具 `issue447-async-seam.ts` 等零改动） |
| 模块 AGENTS.md 变更边界 | D2 = 单 bullet +1 行，符号引用与 HEAD 一致 | 设计 §7-D2/§11 ALLOW 行 2 | **维持**（+1 insertion / 0 deletion；`handleReceipt`/`ACK_STATE_VIOLATION` 1002/§24.2.6/夹具路径引用经本复核与 HEAD/协议一致） |
| 生产实现 `src/**` | 恒空不变量 | 派工 + SA6 §3/§16 + 设计 §11 | **未变**（本复查 git status 复验为空） |

## 6. Evolution requirements

**无未决项。** iteration 1 唯一的 evolution-required 项（同变更集的设计原位修订）按其完整修订计划（SA6 §12.5 EV-8 + SA8 iter-1 R-1a/b/c + SA2 F-1 十二项完备清单）**已由 SA1 执行完毕**，本复查按 SA8 iter-1 R-2 四检查面逐项核验：

| 检查面 | 结果 | 证据 |
|---|---|---|
| ① 设计-契约-证据同变更集一致 | ✓ 成立：设计钉死的 sha / 行数 / 用例数 / 边界锚点（§2-A8：`anchorProjection` :118 键集无 bytes、自证 :372-389、缺帧 throw :141-143、ORDER-C2 :398-431）与契约文件实体、SA6 §12.1、`rev-root-test-2nd.log` 首部三方一致；证据族（40/40、3×945、2×4675、M1/M2/M3、边界对照、双探针）经本复查抽验日志尾行/首部全部相符 | 本报告 §2 事实核对登记 |
| ② 语义相符 | ✓ 成立：设计 §7-D1 边界规则与 SA6 §12.5 裁定逐字同义（调度不变量投影 + `bytes` 单轮自证 + 跨独立 boot 字节相等禁入契约）；§12 AC1-c 期望与 rev2 断言面一一对应；R-1a①②③ 口径逐字落入 | 设计 `:151-177`、`:301`；SA6 §12.5 |
| ③ 无范围扩大 | ✓ 成立：ALLOW 三行（本设计 / AGENTS.md 维持态 / artifacts 族）与实际变更面相容（tracked 仅 AGENTS.md +1；untracked 为契约/证据/wiki 产物）；DENY 全列入位；无新生产/协议/CONTEXT/夹具改动 | 本报告 §2 worktree 事实；设计 §11 |
| ④ 陈旧引用清零 | ✓ 成立：定向检索「400 行 / 3 连绿 / green-repeat / rev1 sha」全部仅存于历史谱系语境（rev1 废止登记、修订史表、「保留为历史不冒充现状」、风险教训引述），无任何 rev1 口径被表述为现状；SA2 §6 失配表 C-1..C-8 经 §14 映射逐项清零；§15 自判已翻转为 `true` | 设计 `:55,56,168,326`（历史语境仅存）；`:344-369`（§14 映射）；`:373-381`（§15） |

R-1b（禁止回退）专项：修订后口径未弱于 rev2 边界——EV-5 判据（M3 ≥3/9 红且含 ORDER-C1）被登记为验收行与风险行，rev1 形态明示废止且「复活」被列为非目标与否决备选 B'。

## 7. Hard conflicts

**无。** 全部对照项为 no-conflict / implements-existing-decision；未发现与 accepted 决策不兼容且无合法路径的行为。（0015 为「提议」状态，不构成约束基准；无 superseded 复制面 ADR。）

## 8. Required actions

- **无阻塧行动。** iteration 1 的 R-1 已兑现、R-2 即本报告（闭合）、R-3 下游顺序已满足（R-1 完成 + R-2 通过 ⇒ 本票可按 Controller 派工进入 SA4/SA7 终验）。
- 移交登记（非冲突义务）：终验阶段按设计 §12（EV-1..EV-8 口径）复跑门禁并留证；EV-7 收尾核对（src 恒空 / 两契约 sha / HEAD 未前移）；AC5 尾句「转人工合并」为人工动作，非任何 SA 权限。
- 谱系警戒条件（非当前义务，保持武装）：若终验门禁再红（rev2 判据面已无 RNG 派生量，再红 = 真回归或新 RNG 派生量混入——按设计 §9 ER-2 阻塞上报，禁止重跑碰运气）、或 HEAD 前移引入新 γ 决策面、或 D2 文本再编辑偏离规范语义，则按本谱系重启冲突复查。
- 无需 ADR/协议/CONTEXT 修订（§3）；无需 owner override（§4）。

## 9. Verdict

**clear** —— 修订后 SA1 设计（iteration 1）与既有决策集**零冲突**，且上轮裁定的全部修订义务已兑现：

1. **R-1a①②③ / R-1b / R-1c 逐条落实**（§3 末行 + §6 四检查面）：冻结裁定重锚 rev2（钉 sha）、DENY 理由重写、验收口径承认 RNG 派生量禁入跨轮断言、禁止回退三级防线、五处一致性收尾——设计文本与 rev2 契约、worktree 现状、证据族同变更集一致，陈旧引用清零，无范围扩大。
2. **rev2 `ANCHOR-ORDER-C1` 契约边界经本轮复核维持 iteration 1 裁决**：调度不变量投影 + `bytes` 单轮自证是协议 §24.8 首句/第三句与 ADR 0032 A4.7/`:114` 的正确可执行兑现（implements-existing-decision），与仓库 #424/#418 字节判据口径同构（no-conflict），敏感性经 E13 证明严格强于 rev1；被剔除的判据不出现在任何决策文本中，无需 override。
3. 全部冻结面未变（§5）：wire/词汇/β 面/事件面/错误码/规范文本/契约 sha/`src/**` 恒空/AGENTS.md +1 行——生产零改动不变量成立，HEAD 未前移。

## 10. requiresConflictRecheck

**false**。理由：

1. **本报告即 R-2 修订后复查，已闭合**：iteration 1 唯一的 evolution-required 项（设计侧同变更集修订）已执行并经本复查四检查面验证闭合；设计 §15 的 `true` 自判所指向的复查义务即本报告，随本报告 clear 而结清。
2. **无尚待实现核对的决策面**：公共 API（append-only +11/−0）、wire、schema、持久化、状态机、生命周期、失败语义全部零变化且已在案核验；无正式 override。剩余工作（§12 门禁复跑 + 证据落档 + 人工合并移交）不触碰任何 ADR/协议/冻结面，不满足 implementation 复查的任一触发条件（design 不再要求复查——其 §15 指向的复查已执行；SA4/SA9 未发现新决策面；实际 diff 不触碰 ADR/协议/冻结面）。
3. §8 所列谱系警戒条件为**条件性重启触发器**（门禁真红 / HEAD 前移引入新决策面 / D2 再编辑偏离），非当前未决义务——触发时按谱系重开冲突复查，不依赖本标志位。
