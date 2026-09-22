# SA2 设计评审 — Issue #451（γ-T5）：观测面锚定与全量回归收官（iteration 2 / r2，rev2 对齐修订版设计复审）

- Dispatch：`sa-50de17a3-4dbb-4344-9e2a-b1522571b1ad`（mabf-sa2 / design-review / **iteration 2**）
- 评审对象：**SA1 修订版设计** `wiki/raw/task_issue-451_design.md`（iteration 1 原位修订，2026-09-22 22:09Z 落笔；修订动因 = SA2 iteration-1 `reject`（F-1 BLOCKER 12 项 + F-2 MAJOR + N-1 MINOR）+ SA8 iteration-1 `reject`（R-1a/R-1b/R-1c + R-2/R-3）+ SA6 rev2 §15 B-1 / §12.5 EV-8 + SA3 §7.5）。
- 评审基线：HEAD `68ab9f5`（本评审 `git rev-parse` 复验 = `68ab9f5bfe4df66a54faddf759709a76914332d0`，未前移）。
- 产物形态说明：本派工明示「Do not modify artifacts」——iteration 1 评审文件（`task_issue-451_sa2_review.md`，22:01Z）作为历史产物原样保留，本轮评审按仓库多轮评审既定惯例（`task_persistence-typed-errors_sa2_review_r2.md`、`task_namespace-lease-replication-session_sa2_review_r2.md` 等）落为新文件 `task_issue-451_sa2_review_r2.md`。唯一写入即本文件。
- 前版 finding 处置预览：**F-1（BLOCKER，12 项）、F-2（MAJOR）、N-1（MINOR）全部闭合**（§6/§14 逐项映射核验）；N-2'/N-3'/N-4'/N-5' 维持非阻断登记。本轮新发现仅 4 条 MINOR 观察项（§14），无 BLOCKER/MAJOR。

## 1. Reviewed inputs

| 输入 | 状态 | 核验方式 |
|---|---|---|
| `wiki/raw/task_issue-451.md`（Host 简报，5 AC + Blocked by #449/#450） | 存在 | 逐条读取（unchanged） |
| `wiki/raw/task_issue-451_design.md`（SA1 **修订版**，iteration 1，22:09Z，381 行） | 存在 | 全文精读 + 定向 grep（stale 短语扫描：`3 连绿`/`green-repeat`/`400 行`/`内容冻结、零改动`/`原样成为最终验收面` 仅余于合法历史引用位——rev1 废止描述、R-2 的「已被证伪」引述，零处活体陈述） |
| `wiki/raw/task_issue-451_sa6_contract.md`（SA6 **rev2**，21:52Z） | 存在 | 全文精读；EV-1..EV-8、§12.5 裁定、§0 对照表、§15 B-1 逐条对设计核验 |
| `wiki/raw/task_issue-451_sa2_review.md`（SA2 iteration 1，`reject`，22:01Z） | 存在 | 全文精读；F-1 12 项清单 + F-2 + N-1 的修订映射逐项复核（§14） |
| `wiki/raw/task_issue-451_design_conflict_report.md`（SA8 iteration 1，`reject` + `requiresConflictRecheck: true`，22:01Z） | 存在 | 全文精读；R-1a①②③/R-1b/R-1c/R-2/R-3 逐条对设计核验（§5） |
| `wiki/raw/task_issue-451_sa3_impl.md`（SA3，`reject` + `requiresConflictRecheck: true`，21:26Z） | 存在 | 全文精读；§7 根因链 / §7.4 三备选 / §7.5 复查裁定的设计承接核验 |
| `wiki/raw/task_issue-451_relevant_decisions.md` / `_conflict_report.md` / `_sa4_review.md` / `_sa7_report.md` | 不存在 | 目录清单核验；设计头部「缺席输入（非阻塞）」登记如实；规范权威替代链 = ADR 0032 附录 A4 + 协议 §23.1/§24（存在且逐锚核验） |
| Owner 评论 | REST 快照 **`[]`** @2026-09-22T13:57Z（本次 dispatch 提供） | 连续第八个空快照（12:33/12:35/12:43/12:53/13:13/13:39/13:48Z + 13:57Z）；设计自记 13:48Z 为第七个，无冲突 |
| 契约工件 | 在位，**sha 三方一致** | 本评审 `sha256sum` 复验：anchor = `4a8556bbecb775fd70a054051ee6599f9600ea01e9a26700a4818ad683bc3b4c`（**432 行** / 9 用例，与 SA6 §12.1 / 设计 §2-A8 / `rev-root-test-2nd.log` 首部一致）；surface-freeze = `ef897240096c78a0b45e04cb5cc77f777a351b744a720f86c72a892520c42184`（**74 行** / 3 用例 + **2** 处活体 `@ts-expect-error`（:66/:72；第 3 处命中为 :5 头注释散文），负控在位） |
| 证据日志 | **32 个文件 = 31 份 `.log` + `clientid-probe.mjs`**（本评审 `ls` 精确计数；设计 §2-A9 的「32」为准确值——iteration 1 评审曾记 33，系前版计数误差，设计已静默修正为准确数） | 关键日志逐份抽验（§5/§12）：focused-40x 尾行 `totals: FAIL=0 PASS=40`；suite-3x 3× `105 passed (105)`/`945 passed (945)`/`no errors`；root-test-2nd 首部备案 HEAD + revised sha、`468 passed (468)`/`5675 passed (5675)`/`no errors` 且逐文件列出 anchor (9 tests) + surface-freeze TS (3 tests)；mutations M1=`5 failed / 4 passed`、M2=`4 failed / 5 passed`、M3=`3 failed / 6 passed` + `[restore] identical=True`；M3-boundary-compare：rev1 边界 = `2 failed … red IDs=['ANCHOR-EDGE']` vs rev2 边界 = `3 failed … red IDs=['ANCHOR-EDGE','ANCHOR-ORDER']`；clientid-probe：宽度 1..5 ⇒ 15/18/21/24/27、`clientIDByteRuns=3`、`width 4: p=0.061595 (12319)`/`width 5: p=0.937915 (187583)`；probe2：`240 boots`、`pairs=238`、(i) 含 bytes 22 不匹配 / (ii) 不含 bytes 0 / 宽度差 22 对 = bytes 差 22 对；flake-samples `FAIL=4 PASS=26`；listen-beta-matrix `20 passed (20)`/`273 passed (273)`；order-audit A/B 零命中结论在案 |
| 源码/规范锚点 | — | 本评审独立复验全部命中：`hub-edge.ts:284-288`（盖章→`sequence > 0` 门→发射）、`:869-886`（`emitUpdateSentAtStamp`：无 observer 首行门 + `updateFrameProbe` 型门 + dormant 注释）、`hub-namespace.ts:1458-1462`（`onUpdateSent` 普通帧 `:1462` 零发射）、`:1416-1440`（`onUpdateAcked`）、`hub-session-async-host.ts:47-84`（`HubAsyncSessionHandle` **6 成员** :66-79 / `HubAsyncSessionHost` 恰一成员 `open`）、`:114`（`asyncSendTickets: true` 唯一设置点）、`hub-edge-host.ts:186`（`asyncDataAdmissionFatal?: true` 精确类型）、`:982`（前置门派生）、`src/index.ts:9`（工厂导出）+ `:105-109`（**5 类型**）、`git diff c86ccbc..HEAD -- src/index.ts` = **+11/−0**、`types.ts:1036-1048`（`SendAnchorState` 三态 + round 锚）、`namespace-registry/create-document.ts:67/74`（两 `createInitialDocument` 汇入点）、`doc-runtime/create-initial-document.ts:160`（裸 `new Y.Doc()`）、`test/issue447-async-seam.ts:519-546`（:539 `★ A4.2/§24.2.3` 同步段回执注释 + `sequence === 0` 不投回执分支）、`#424:16`（ORACLE-2「禁止把数据帧（Yjs 载荷帧）的字节相等写成断言」）、`#418:21,117-119,460`（「payload 逐字节不可跨进程冻结」「跨进程长度可能 ±1…不钉长度」）、协议 `:833-846`（§23.1 归属表，edge `update-sent` 行 :840）、`:1149-1154`（§24.8，无全序条款 :1153）、ADR 0032 `:59-65`（A4.1）/`:67-75`（A4.2）/`:77-79`（A4.3）/`:93-95`（A4.7）/`:97-99`（A4.8）/`:114`（决策 5 注记「`bytes`/`namespaceId` 由帧字节定偏移判定」）、`CONTEXT.md:224-239`（γ/序回执/路由键词汇在案）、`packages/ws-replication/AGENTS.md:17`（γ 装配义务）+ **`:18`（D2 bullet 落地在案**，含 `handleReceipt` / `ACK_STATE_VIOLATION` 1002 / `never merged-array order` / 参考夹具引用）+「Verification」:25-27 |
| anchor 契约行锚（设计 §2-A8 自验锚） | — | 逐锚复验：头注释边界说明 `:105-117`（`/**` 起 :105、`*/` 止 :117）；`anchorProjection` `:118-133`（键集 = `type/side/namespaceId/sequence`，**无 `bytes`**）；`payloadBytesAt` `:139-145`（throw 块 `:141-143`，`判据面缺失即响亮 throw` 原文在 :142）；ANCHOR-ORDER-C1 `it` `:333`（块 `:333-396`；投影 `toEqual` `:371`；逐轮自证循环 `:372-389`；`acked.sequence === sent.sequence` `:388`；投影回指 wire 序 `:390-395`）；ANCHOR-ORDER-C2 `it` `:398`（块 `:398-431`，文件共 432 行）——**设计自验行锚全部精确命中**（SA6 §5.2 的 `:379-388` / SA8 的 `:380-388` 漂移确如设计 §5.2 所记，设计采自验锚的处理正确） |
| 生产零改动不变量 | 成立 | 本评审 `git status --short packages/ws-replication/src/` = **空**（0 行输出）；`git diff --stat packages/ws-replication/AGENTS.md` = **1 insertion**（SA3 D2）；`test/` 目录 `zz-` 前缀零残留 |

## 2. Verdict

**`approve`** —— 无 BLOCKER / MAJOR finding；iteration 1 的 F-1（BLOCKER，12 项完备清单）、F-2（MAJOR）、N-1（MINOR）经逐项复核**全部闭合**，SA8 R-1a①②③/R-1b/R-1c 逐字落实，SA6 EV-1..EV-8 全映射，设计正文 / 裁定 / DENY / 风险册 / 验收映射 / 自评结论六个层面与 rev2 契约、worktree 现状、证据族零矛盾（iteration 1 §6 失配表 C-1..C-8 逐项清零）。本轮独立复验 30+ 事实锚点（sha ×2、行锚 ×20+、日志尾行/首部 ×10+、源码链 ×8）**全部命中**。残余 4 条 MINOR 观察项（§14）不阻断安全实施。

分项总判：

- **需求 / Owner / 上游事实覆盖**：5 条 AC 全部有可执行落点且定性如实（零生产改动 + 门禁复跑 + 收官登记已完成态 + 人工移交）；owner 评论连续八快照为空，无隐含面；SA8 六项义务与 SA6 八项 EV 逐条兑现。
- **设计内部一致性**：stale 语句扫描零活体命中；rev1 仅以「已废止形态 + sha 谱系 + 授权链」身份出现在修订史表（§7-D1）——这正是防「契约从未改过」误读的正确写法；§15 与 SA3 §7.5 / SA6 §15 B-1 / SA8 §10 三处 `true` 对齐。
- **状态机 / 并发 / 错误恢复**：零生产状态机变化（复验成立）；契约确定性攻击面已由 rev2 结构性闭合（本评审对 probe2 的 240 轮 / 238 对 / 22 对宽度差 = 22 对 bytes 差 / 0 反例数据复认）；「ORDER-C1 再红 = 阻塞上报、禁止重跑碰运气」纪律（§7-D4 / §9 ER-2 / §13 R-2）是本轮修订最重要的错误恢复路径修正，已按 iteration 1 F-1⑨ 要求重写到位。
- **架构一致性**：责任归属链（SA6 契约 owner 修订 → SA1 设计收口 → SA3 D2 落地 → SA8 R-2 复查 → 人工合并）零越权；sha 钉死 + EV-7 门构成单一事实源；无平行机制。
- **文件范围**：ALLOW 三行与实际改动面相容（设计文件本尊 / AGENTS.md 维持态 / artifacts 同族证据）；DENY 理由全部重写为 rev2 事实，实现者不会再把 rev2 契约文件误判为违约产物（iteration 1 C-2 的直接危害已消除）。
- **验收设计**：每条 AC/EV 有命令、入口、预期观察三件套；AC3 的 20 文件枚举与目录实况**逐一相符**（418×3 + 420×3 + 421×7 + 423×3 + 424×4 = 恰 20，本评审 `ls` 复核）；issue422 两文件由 R-3 显式登记为 AC4 全量覆盖。

`approve` 仅覆盖设计面；SA4/SA7 对实现与活链路的终验仍不可替代，且按 SA8 R-3 须待 SA8 R-2 修订后复查通过方可进入。

## 3. 需求覆盖

| Requirement（Issue AC） | Design section | Assessment |
|---|---|---|
| AC1-a `update-sent` 留 edge 盖章点锚 | §2-A1/A2/A8/A11/A12（事实锚，本评审全部复验命中）+ §7-D1（rev2 冻结裁定，钉 sha）+ §12 行 1 | 覆盖成立。零生产改动定性正确（HEAD 行为已被 SA6 §8 判无缺陷）；被测事实的单漏斗 / seq>0 门 / 型门 / 抑制点四要素在源码锚上逐一在场 |
| AC1-b `update-acked` / chunked 族 session 侧锚 | §2-A2 + §7-D1 + §12 行 2 | 覆盖成立（SESSION-C1/C2、BOTH-C1 镜像 + M2=4/9 敏感性证据复验） |
| AC1-c γ 断言不依赖跨线程事件相对顺序 | §2-A8（rev2 边界锚）+ §3-G3/G6 + §7-D1 边界规则 + §12 行 3（**EV 口径**：调度不变量投影 + 计数恰一 + 每轮 `bytes` 单轮自证 + `acked.sequence === sent.sequence` + 扣留期单侧在场 + `pending() > 0`） | 覆盖成立且较 iteration 0 精确收窄。SA8 R-1a③ 的「跨轮断言不得含 RNG 派生量；`bytes` 属单轮自证事实」口径逐字进入 §12 AC1-c 行与 §7-D1 |
| AC2 新公共面 test-d append-only 复核 | §2-A3（**6 成员**，N-1 已修，本评审对 :66-79 复验恰 6）/A4/A5 + §12 行 4 | 覆盖成立（sha 不变 + `--typecheck` 与 `tsc -p` 双入口 + 2 活体负控在 :66/:72） |
| AC3 listen + β 矩阵 + parity guard 全绿 | §12 行 5（**20 文件逐名枚举**，本评审与目录逐一相符；引号前缀过滤器防漏 2 个 `.test-d.ts` 的教训已固化进命令）+ §13 R-3（issue422 登记为 AC4 覆盖） | 覆盖成立。rev1 证据（20/273）「保持有效（此后零相关改动）」的定性经 src 恒空 + 契约 sha 不变双重支撑 |
| AC4 包 typecheck + 根 `pnpm typecheck` / `pnpm test` 全绿 | §12 行 6–10（EV-2 包套件 ≥3 次、EV-3 根 test ≥2 次独立样本、EV-1 聚焦 ≥30 次；rev2 已达标 3×105/945、2×468/5675，日志复验一致） | 覆盖成立，口径采纳 SA6 EV-1..EV-3（iteration 1 F-1⑧⑩ 闭合） |
| AC5 PR #446 与 ADR A4 / §24 一致性核对 + 收官转人工合并 | §12 行 AC5-a（采信 SA6 §12.4 18 条款全「一致」）/ AC5-b（D2 已完成态 + 终验收尾复核项）/ AC5-c（§7-D3 人工移交，SA 全程零 git 生命周期操作） | 覆盖成立。D2 的「已完成态」登记废止了 iteration 0 的将来时表述（F-1⑪ 闭合）；R-4 登记 HEAD 前移时按同表重核 |

非目标未静默扩大：`src/**` 恒空、两契约文件冻结（sha 钉死 + 一次性例外闭合声明）、协议/ADR/CONTEXT 零触碰、不自动合并、mutation 不重跑——全部维持且理由已换为 rev2 事实（F-1⑫ 闭合）。新增的目标 6（设计-契约同变更集收口）即 SA8 R-1 义务本体，非范围扩张。

## 4. Owner评论覆盖

| Comment ID | Updated at | Design section | Assessment |
|---|---|---|---|
| （无评论） | REST 快照 `[]` @2026-09-22T13:57Z（本次 dispatch；此前 12:33/12:35/12:43/12:53/13:13/13:39/13:48Z 七个时点连续为空——设计自记 13:48Z 为第七个，无冲突） | 设计 §4（空映射表 + 「需求全集 = Issue 正文 5 条 AC」） | 无 owner 追加约束可映射；rev2 契约修订属验收契约自身确定性缺陷的修复，不引入 owner 隐含面（SA6 §2 同判，本评审复认） |

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| SA6 rev2 §12.5 边界裁定（调度不变量投影 + `bytes` 单轮自证；跨独立 boot 字节相等 = RNG 抽签检测不得入契约） | §7-D1 边界规则逐字采纳 + 钉 sha + 「不是放宽」（E13 2/9→3/9）+ 禁止回退三级防线 | 落实。裁定文本、量化判据、否决备选（A/C'/D）与 SA6 §12.5 逐项对应 |
| SA6 rev2 §8.2 根因链 S1–S7 / U1 / R1–R3 + §9 E8–E13 | §5.1 第 2–3 行全量承接（含 R3 对 SA3 §7.2 `makeSeedDoc` 归因的修正）；§2-A11 锚点复验命中（`create-document.ts:67/74` → `create-initial-document.ts:160` 裸 `new Y.Doc()`） | 落实。F-1⑤ 闭合；本评审对源码链与探针日志（宽度类 1:1、200k 抽样率、240 轮 0 反例）独立复认成立 |
| SA6 EV-1..EV-8 下游证据义务 | §12 逐行映射：EV-1（≥30 次聚焦）、EV-2（≥3 包套件）、EV-3（≥2 根样本）、EV-4/EV-5（历史证据闭合 + 退化疑点重做条件）、EV-6（探针可复跑）、EV-7（sha + HEAD + src 恒空门）、EV-8（= 本设计修订 + SA8 R-2） | 落实。EV-8 的枚举采用 iteration 1 F-2 的推荐路径（SA1 按 F-1 十二项完备清单执行，SA6 文本不改）——C-1..C-8 逐项清零（§6） |
| SA8 R-1a①（§7-D1 冻结裁定重锚 rev2） | §7-D1：裁定 + 两文件 sha 钉死 + 「终验阶段不得再改动」+ 五项依据（契约-规范逐字对应 / M1/M2/M3 三路 / 结构性确定性 / 真实入口发现 / 零改动纪律） | 逐字落实（设计 §6 表引 SA8 原文并核对相符） |
| SA8 R-1a②（§11 DENY 重写） | §11 DENY 行 2：契约本体 = rev2（sha）；rev1→rev2 = SA6 依 SA8 §10 条件 2 授权的**一次性例外，已闭合**；此后任何再修改须 SA6 边界裁定 + 门禁证据链 + 冲突复查；EV-7 收尾核对 | 逐字落实。iteration 1 C-2 的危害（实现者误判 rev2 为违约产物）被 §10 调用方矩阵行 4 显式消除（「不得把 rev2 文件误判为 DENY 违约产物」） |
| SA8 R-1a③（§12 AC1-c / AC4-a 口径） | §12 行 1–3 与行 6：判据面无 RNG 派生量、`bytes` 单轮自证的期望观察逐字进入 | 逐字落实 |
| SA8 R-1b（禁止回退：M3 ≥3/9 且含 ORDER-C1） | §7-D1 禁止回退段 + §12 EV-5 行 + §13 R-7 + §1 非目标第 3 条（三级防线 + 非目标条） | 落实为四级防线（多出非目标层），无弱化 |
| SA8 R-1c（header/§2-A8/§5/§14/§15 一致性收尾） | 头部输入清单（四产物在案 + 缺席面如实）/ §2-A8 自验锚 / §5.1 rev2 族 / §14 三方 finding 映射表 / §15 `true` + 三点理由 | 落实。§14 映射表 23 行逐行核对本评审全部复认（唯一瑕疵见 N-B：N-5' 行的位置指针） |
| SA8 R-2（修订后复查）+ R-3（R-1/R-2 前不进终验） | §15 登记「由 SA8 执行（非 SA1 权限）」；§7-D3 路由顺序：本修订 → SA8 R-2 → （如派工）终验 → 人工合并 | 落实。设计不自判 R-2 通过（本评审时点 SA8 R-2 尚未执行，时序诚实） |
| SA8 iteration-0 §10 条件 1/3 继续武装 | §6 末行：条件 2 的消费记录 = rev1→rev2 修订链；条件 1（D2 偏离规范语义）经核对其纪律句与 §24.8/§23.1 相符现不触发；条件 3（HEAD 前移）现不触发 | 落实。本评审复验 D2 bullet 语义与协议 §23.1/§24.8 原文对齐（含拒绝路径复刻事件括注与归属表 edge 行逐字对应） |
| 仓库字节判据口径（#424 ORACLE-2 / #418 C3） | §2-A12 采纳为「rev2 规范依据」+ §6 约束行（「未来任何 γ/数据面测试新增断言同受此口径约束」） | 落实。两处先例文本本评审逐行复验在场（:16 / :21,117-119,460）；rev2 回归口径而非放松的定性成立 |
| 模块门（AGENTS.md「Verification」） | §6 模块门行 + §12 门禁集（本票零缝变更仍按收官口径全量执行；AC3/AC4 命名集为其子集的超集闭合） | 落实 |
| SA3 §7（reject 驱动）/ §7.4（三备选修法交裁定）/ §10（交付顺序） | §3 G6 / §5.1 / §7-D1 修订史表 / §9 ER-2 / §13 R-2 / §7 备选表 A/C' 行 / §7-D3 | 落实。SA3 的阻塞上报纪律被确认正确并维持（「红灯定性从『环境/抽样』改判『契约确定性缺陷』」的改判有 SA6 根因链支撑） |

上游事实与源码矛盾：**无**。设计 §5.2 声明的两处报告级笔误（SA6 §5.2 `:379-388` vs 实际 `:372-389`；SA6 §10 `:869-885` vs 实际 `:869-886`）经本评审对文件实况核验**均属实**，设计一律采用自验行锚的处理正确（N-2' 闭合）。

## 6. 设计内部一致性（iteration 1 C-1..C-8 清零复核）

| # | iteration 1 失配点 | 修订版现状 | 本评审复验 |
|---|---|---|---|
| C-1 | §7-D1「原样冻结 rev1」 | 冻结基线重锚 rev2（sha `4a8556bb…` + 修订史表 + 授权链 + M1/M2/M3 三路） | **清零**（§7-D1 全节 + 本评审 sha 复验） |
| C-2 | §11 DENY 理由失真（3 连绿/不可修订） | 钉 sha + 一次性例外闭合 + 再修改三条件（SA6 裁定 + 证据链 + 复查） | **清零** |
| C-3 | §13 R-2「确定性已证」安抚文 | 重写为结构性论证（RNG 派生量移出判据面）+ 阻塞上报纪律 + 历史教训（16 连绿差点掩盖 3/7 红） | **清零** |
| C-4 | §15 `requiresConflictRecheck = false` | 翻转为 `true` + 三点理由（三处一致武装 / 条件 2 已消费 / 冻结面文本被重写须复查背书） | **清零**，与 SA3 §7.5 / SA6 §15 B-1 / SA8 §10 对齐 |
| C-5 | §2-A8 记 rev1 形态（400 行/3 连绿/M1/M2） | 432 行 / 9 用例 / rev2 sha + 边界锚点自验行锚 | **清零**（行锚逐点复验命中） |
| C-6 | §2-A9/§5/§12 现状证据指 rev1 日志族 | rev2 `rev-*` 族为现状证据；rev1 日志显式定位为「历史不冒充现状」 | **清零**（31 份日志逐名在位，引用与实况一致） |
| C-7 | §14/头部「SA2 评审不存在」 | 四上游产物全部在案登记 + 缺席面（sa4/sa7/前置门禁）如实 | **清零** |
| C-8 | §1 非目标理由失真 / §7-D2 将来时 / §3 G-doc「本设计落笔」 | 理由换 rev2 事实；D2 = 已完成态（落地内容清单 + 终验收尾复核项 + 「再编辑需新裁定」）；G-doc 行改已完成态 | **清零**（`AGENTS.md:18` bullet 在场且内容与 §7-D2 清单逐点对应） |

**SA6 rev2 契约内部一致性**（迭代复核）：§0 对照表 ↔ §5.2 正控 ↔ §12.2 矩阵 ORDER-C1 行 ↔ 契约文件实体（`:118-133` 键集 / `:371` `toEqual` / `:372-389` 逐轮自证 / `:141-143` 响亮 throw）↔ sha 备案，五方一致；「其余 8 用例语义未动」与 SA8 iteration-1 的交叉证实（rev1 文件未保留，以门禁与 M3 边界对照日志互证）采信。

**修订映射表（§14）核验**：23 行映射中 22 行的位置指针与修订内容经本评审逐一相符；唯一瑕疵 = N-5' 行声称「§2-A8 登记为已知观察」而 §2-A8 正文未载该观察（详见 N-B，MINOR）。

## 7. 状态机与并发攻击

本票生产状态机零变化（§8 明示「无变化，以下为验收面钉住的不变量」；src 恒空复验成立）。攻击面 = 契约自身的确定性 / 调度不变性 / 判据面完备性：

| ID | Initial state | Trigger | Expected behavior | Design/contract gap | Required revision |
|---|---|---|---|---|---|
| SM-1 | rev2 ORDER-C1 判据面（调度不变量投影） | 两轮 clientID 宽度抽签不等（P≈11.65%/对） | 投影不含 `bytes` ⇒ 判据面零 RNG 派生量，不红 | 无（probe2：238 对 0 不匹配复验；`sequence=[7]` 单值、`side=["hub"]` 单值、单 nsId——四字段全为确定性量） | — |
| SM-2 | 即时释放 vs 扣留后释放两调度 | 缝调度扰动 | 调度不变量投影逐字相同 + 计数恰一 + 每轮 `bytes === 本轮 wire 载荷长` + `acked.sequence === sent.sequence` | 无（`:333-396` 断言面逐行复验；缺帧即 throw 无 fallback） | — |
| SM-3 | 扣留期（edge→session held） | ACK 已达 edge 但被扣留 | sent ×1 在场、acked ×0、`pending() > 0` | 无（ORDER-C2 `:398-431` 未动，复验成立） | — |
| SM-4 | 对称字节说谎攻击（两轮事件 `bytes` 同时 +1） | M3 mutation | rev2 三处红（EDGE-C1/C2 + ORDER-C1 = 3/9）；rev1 边界下 ORDER-C1 绿（2/9） | 无（`rev-M3-boundary-compare.log` 双边界对照复验：`red IDs=['ANCHOR-EDGE']` vs `['ANCHOR-EDGE','ANCHOR-ORDER']`——rev2 严格更强的量化主张成立） | — |
| SM-5 | 编码器级真实膨胀攻击（wire 载荷系统性 +N） | 假想回归 | 本契约不断言绝对载荷长 | 非缺口（#424 ORACLE-2 / #418 C3 口径下 Yjs 载荷绝对长度本不可断言；rev1 的跨轮相等对此攻击检出力仅 11.65% 且与假红不可区分——iteration 1 SM-5 判定维持，设计 §2-A12/§7-D1 已把口径收编为规范依据） | — |
| SM-6 | 未来修订把新 RNG 派生量混入判据面 | 假想契约演进 | 依 §7-D1 边界规则 + EV-5 判据（M3 ≥3/9 且含 ORDER-C1）拦截 | 无（三级防线 + `再红只能是 (a) 归属回归 (b) 字节回归 (c) 新 RNG 派生量混入 ⇒ 一律阻塞上报` 的 §9 ER-2 分类处置） | — |
| SM-7 | `payloadBytesOfFrame` 判据面缺失（wire 无对应 UPDATE 序） | 断言执行时帧缺席 | 响亮 throw（`:141-143`） | 无（复验成立；§9「正常路径不变量缺失 = fail loud」明文） | — |
| SM-8 | HEAD 前移（收官前集成分支进 commit） | 证据过期 | 按 §13 R-4 + EV-7：sha/HEAD 备案为设计不变量，前移 ⇒ §12 全表 + AC5-a 同口径重核 | 无（`rev-root-test-2nd.log` 首部 HEAD+sha 双备案实践在案，本评审复验一致） | — |

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| ER-1 | 任一门禁非绿 | §7-D4：阻塞上报（含与本票无关的既有红灯），禁缩小测试集 / skip / only / env override / 改断言换绿 | 纪律正确且经 SA3 实际遵守验证（遇红 reject 而非修断言） | 维持（修订未弱化，逐字在场） |
| ER-2 | ORDER-C1 再红 | §9 ER-2 + §7-D4 + §13 R-2：确定性依据 = 结构性论证（RNG 派生量移出判据面 + 40/40 + 240 轮探针 0 假红）；再红三分类（归属回归 / 字节回归 / 新 RNG 派生量混入）⇒ 一律阻塞上报并按 EV-4/EV-5 重做 mutation 定位；**明示禁止「重跑碰运气」**并引历史教训（SA3 单文件 16 连绿 vs 包套件 3/7 红） | 低——iteration 1 判定的「最危险错误恢复路径」已被完整重写（F-1⑨ 闭合） | — |
| ER-3 | 契约判据面缺失 | `payloadBytesAt` 响亮 throw（`:141-143` 原文复验） | 无 fallback 掩盖 | — |
| ER-4 | 「零命中」断言空转 | NC-4 元判据（同场正命中）；ANCHOR-EDGE-NC1 的 `connection-failed` 正命中在场 | 无伪绿 | — |
| ER-5 | mutation / 探针残留 | SA6 §16 复位记录 + 本评审复验：`src` 恒空、`test/` 零 `zz-` 残留、`clientid-probe.mjs` 为 artifacts 内可复跑探针（§12.1 声明在案） | 零残留 | — |
| ER-6 | 证据过期 / 伪现状 | rev1 日志显式定位「历史不冒充现状」；`rev-prefix-suite-samples.log`（修订前 3 绿）在案支撑「3 连绿与抽签率相容」的反证叙事 | 低 | — |
| ER-7 | D2 文档与规范漂移 | §13 R-1：已闭合定性 + 终验收尾仅复核 diff 维持 +1 行与符号可解析 + 「再编辑需新裁定」 | 低（本评审对照协议 §23.1/§24.8 原文复核 :18 bullet 语义精确，含拒绝路径复刻事件与归属表逐字对应） | — |
| ER-8 | 收官判定链断裂（门禁绿但 SA8 R-2 未过即宣称收官） | §7-D3 判定链：§12 全绿 + D2 在案 + SA6 §12.4 在案 + **SA8 R-2 复查通过** ⇒ AC1–AC4 可勾、AC5 核对半句可勾；「转人工合并」半句登记为待人工 | 低（路由顺序显式，无越权面） | — |

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| vitest 运行器（包 / 根 / `--typecheck`）对两 #451 契约文件的发现 | 无——glob 持续命中；9 用例计数不变；`rev-root-test-2nd.log` 逐文件列出 anchor (9 tests) + surface-freeze TS (3 tests)（本评审复验） | §10 行 1 | — |
| CI（全量 typecheck/test） | 无——无配置面变化 | §10 行 2 | — |
| 未来模块 agent / 宿主集成方（读 AGENTS.md 装配 γ 桥） | 无——三条义务并列可见（:17 装配标记 / :18 宿主运输 + 观测纪律含「never merged-array order」句），权威源引用 §24.2/§24.8 不复制规则本体 | §10 行 3；本评审重读 :17-18 | — |
| SA4/SA7 终验（如派工） | 无——消费材料四件套显式（rev2 契约钉 sha + rev2 证据族 + 本设计 + D2 落地态 + §12 口径）；「不得把 rev2 文件误判为 DENY 违约产物」的防误导读法在场（iteration 1 C-2 危害的显式消除） | §10 行 4；SA8 R-3 | — |
| 未来读设计/契约者 | 无——iteration 0 曾传导的三个错误前提（契约从未改过 / 确定性已证 / 无需复查）由修订史表 + 授权链 + §15 翻转分别消除 | §10 行 5；§7-D1 修订史表 | — |
| PR #446 人工合并者 | 无——移交材料清单 + 前置条件（SA8 R-2 通过）显式 | §10 行 6；§7-D3 | — |
| 生产代码全部调用方 | 无——`src/**` 逐字节不变（本评审 status 复验为空） | §10 行 7 | — |

无未覆盖调用方；本票（含 rev2 契约修订与本设计修订）不改任何函数签名、返回值、抛错或异步时序。

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| 验收契约断言边界的诊断与修订 | SA6（契约 owner） | rev2 已由 SA6 执行（设计只登记修订史与授权链，不复制裁定本体） | **正确**——SA6 §12.5 裁定 + 备选否决理由（A：钉 clientID = 生产改动/验证夹具强制的巧合；C'：掩码 = 掩盖事实）被设计 §7 备选表忠实采纳 |
| 设计文本与契约同变更集一致性 | SA1 | 本修订（唯一授权方，SA8 R-1） | **正确** |
| 收官登记（O-1/O-2） | SA3 落地 / 设计登记已完成态 | §7-D2 + §2-A7 | **正确**（不重复落笔；「再编辑需新裁定」防重复登记漂移） |
| 修订后复查 | SA8 R-2 | §15 登记「非 SA1 权限」 | **正确**（设计不自判闭合） |
| 合并 PR #446 | 人工 | §7-D3 | **正确**（SA 全程零 git 生命周期操作） |

### 相似能力与扩展点

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| 数据帧字节判据口径 | `#424 ORACLE-2`、`#418 C3`（两处成文先例，本评审逐行复验在场） | rev2 边界（调度不变量投影 + 单轮自证） | **一致（回归口径）** | rev1 是口径违例；rev2 与先例及 `issue447/448/449` 语义判据同构 |
| 单轮自证断言形态 | rev1 的 EDGE-C1/C2、SESSION-C1 本就对本轮 wire 自证 | rev2 把同款形态引入 ORDER-C1 | 一致 | 复用既有断言模式，无新机制 |
| 收官证据落档 | `artifacts/sa6-*.log` 固定位置族 | rev2 新增 `rev-*` / 双探针同族 | 一致 | 同通道无平行机制（`clientid-probe.mjs` 为 artifacts 内可复跑探针，§12.1 声明在案） |
| 收官 docs 登记 | 模块 AGENTS.md Boundaries 段 bullet 惯例 | D2 单 bullet（:18，+1 行） | 一致 | link-to-authoritative-source（docs/AGENTS.md 惯例）；备选 D（复制规则本体进协议/ADR）正确否决 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 验收契约当前内容 | 契约文件实体 + sha `4a8556bb…`（设计 §7-D1/§11 与 SA6 §12.1/SA3 §2/根测日志首部多方一致） | 设计/报告中的描述 | **低**（iteration 1 判「高」；本轮 DENY 钉 sha + EV-7 收尾门后闭合——本评审 sha 复验三方一致） |
| rev1→rev2 修订史 | SA6 rev2 §0/§12.5 + sha 谱系（`3088fb7b…` → `4a8556bb…`） | 设计 §7-D1 修订史表（登记而非第二事实源——全部字段引 SA6/SA8 原始出处） | 低 |
| 非确定性根因 | SA6 §8.2 + 探针日志 | anchor 文件头注释摘要（:105-117） | 低（注释引探针日志为源；N-5' 的 probe1/probe2 指向瑕疵为非阻断已登记） |
| 生产零改动 | `src/**` 恒空门（§12 末行 + EV-7） | 各报告声明 | 无 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| （无运行时面——零生产改动；契约与设计均为纯文件演进） | — | 设计修订 = 单文件原位替换（wiki 产物无运行时）；D2 = 单 bullet revert 即回滚；rev2 的「回滚」= 恢复 rev1 边界——设计明确定性为**非合理回退路径**（复活 11.65% 假红 + M3 检出力降级，SA8 R-1b 禁止；灾难恢复以 git 历史为准） | 不适用面无对称性缺口 |

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 第二套确定性探针通道 | `artifacts/` 日志族 + `clientid-probe.mjs` | 无新增（临时 `zz-*` 已删，本评审 `test/` 零 `zz-` 复验） | 无平行 |
| 第二套验收入口 | 包 / 根门禁 + vitest glob | 全走仓库真实入口 | 无平行 |
| 契约修订绕过批准链 | SA8 §10 重启条件 | rev2 主动触发复查并留全证据链；设计 §7-D1 把「一次性例外已闭合」写死 | 无绕过 |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW 行 1（设计文件本尊，原位修订载体） | 本次落笔即该行；SA2 F-1 / SA8 R-1 的修订义务载体 | 无 |
| ALLOW 行 2（AGENTS.md 维持态，无预期进一步改动） | 本评审 `git diff --stat` = 1 insertion（与 SA3 D2 落地一致）；「再编辑需新裁定」防重复登记 | 无 |
| ALLOW 行 3（`artifacts/sa6-issue451-*.log` 族复跑更新/新增） | 31 份日志在位；rev1 历史证据保留为修订史证据不删 | 无（EV-4/EV5 的「无需重跑」与该行「EV-1..EV-7」的范围引用略宽松——见 N-D，非阻断） |
| DENY `src/**` | 本评审 status 复验恒空；备选 A/G 的否决理由把「顺手加固/钉死」全部挡在生产边界外 | 无 |
| DENY 两契约文件（钉 sha + 一次性例外闭合） | sha 复验一致；rev2 轮零触碰 surface-freeze | 无 |
| DENY 夹具 / 矩阵既有测试 / 协议 / ADR / CONTEXT / 其他 SA 产物 / doc-runtime / namespace-registry / `.git` | 全部零触碰（sha / 行锚 / status 复验）；`CONTEXT.md:224-239` γ 词汇在案支撑「无需更新」非目标 | 无 |
| ALLOW 无理由扩张 / follow-up 伪装必要项 | 无（唯一 follow-up R-6 为既有 ADR 留待项；任务内必要项清单 §13 尾段自洽：设计修订 + D2 + 门禁复跑 + R-2 复查 + D3 移交） | 无 |

（本评审未运行 `git diff` 于设计声明核验之外的生产面；sha/status/stat 仅用于复验设计的事实声明。）

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1-a/b（归属锚） | §12 行 1–2：聚焦命令 + 9 passed 预期（C1 恰一/序/长、C2 直驱判别、NC1 未盖章零、NC2 型门零、SESSION 镜像、BOTH 无双发） | 无 | — |
| AC1-c（无全序判据，rev2 口径） | §12 行 3：期望观察四件套（调度不变量投影逐字相同 + 计数恰一 / 每轮单轮自证 + 序回指 / 扣留期单侧在场 + `pending() > 0`）+ 判据面无 RNG 派生量声明 | 无（口径与 SA8 R-1a③ 逐字对齐） | — |
| AC2（公共面冻结） | §12 行 4：`--typecheck` + `tsc -p` 双入口；3 passed + 2 负控触发（无 TS2578 = 负控失效即红） | 无 | — |
| AC3（矩阵） | §12 行 5：**20 文件逐名枚举**（本评审与目录逐一相符）+ 273 passed 预期 + 引号前缀过滤器防 `.test-d.ts` 漏跑 + issue422 R-3 登记 | 无 | — |
| AC4（门禁全量） | §12 行 6–10：包 tsc exit 0 / 包套件 ≥3 次 / EV-1 聚焦 ≥30 次 0 红 / 根 typecheck exit 0 / 根 test ≥2 独立样本 + 日志首部 sha/HEAD 备案 | 无（EV-2/EV-3 口径采纳完成） | — |
| AC5（一致性 + 登记 + 移交） | §12 行 AC5-a（采信 SA6 §12.4 + HEAD 前移重核条件）/ AC5-b（diff 维持 +1 行 + 符号可解析复核项）/ AC5-c（无可执行面，移交说明登记待人工） | 无 | — |
| EV-4/EV-5（敏感性） | 历史证据闭合（M1=5/9、M2=4/9、M3=3/9 含 ORDER-C1 + 边界对照 2/9 vs 3/9——本评审日志复验一致）；重做条件 = 退化疑点出现 | 无 | — |
| EV-6（RNG 根因回归） | 探针命令 + ≥200 轮 + 1:1 零反例判据；现有证据（E8/E9 日志）在案 | 措辞层面「如需重证」为条件化表述（SA6 EV 表为下游 required evidence 集；现有证据列 + R-4 过期重核逻辑实质闭合该行）——见 N-C，非阻断 | — |
| EV-7（不变量 sha 门） | 终验收尾：src 恒空 + 两契约 sha + HEAD 三查；前移 ⇒ §12 全表重核 | 无（iteration 1 F-1⑦ 的「sha 门缺失」已补） | — |
| EV-8（设计/规范收口） | 本设计修订 + SA8 R-2 复查；验收口径 = C-1..C-8 清零（§6 本评审逐项复认） | 无 | — |
| 测试落点真实性 | 两契约文件被包 / 根门禁真实发现（`rev-root-test-2nd.log` 逐文件列出，本评审复验）；无 skip/only/todo、无 env override、无断言软化 | 无 | — |
| 「旧实现真红」判据（Refactor 收官票形态） | M1/M2/M3 三路 mutation 历史 red 证据 + 修订前 flake 采样（4/30）作为「旧判据/被破坏行为会红」的可复核记录 | 无 | — |

## 13. Required revisions

**无 BLOCKER / MAJOR finding。** iteration 1 的 F-1（BLOCKER，十二项完备清单）、F-2（MAJOR）、N-1（MINOR）经本评审逐项复核全部闭合：

| 前版 Finding | 闭合核验 |
|---|---|
| F-1①–⑫（BLOCKER） | §14 映射表的十二项位置指针与修订内容逐项相符（①头部/§14 ②§2-A8 ③§2-A9 ④§3-G3/G6 ⑤§5.1 ⑥§7-D1 ⑦§11 DENY ⑧§12 ⑨§13 R-2 ⑩§12 AC4-c ⑪§7-D2/§2-A7/§3/§4/§11 ⑫§1 非目标）；acceptance 判据「修订后全文无 rev2 矛盾陈述 / §15 对齐 true / D1-DENY 以 sha 锚定 / 12 项可勾」四条全中（§6 C-1..C-8 清零 + stale 扫描零活体 + sha 复验一致） |
| F-2（MAJOR） | 推荐路径执行（SA1 按 F-1 完备清单，SA6 文本未改）；C-1..C-8 零命中 |
| N-1（MINOR） | §2-A3 修正为 6 成员；本评审对 `hub-session-async-host.ts:66-79` 复验恰 6（`handleFrame`/`handleReceipt`/`onFrame`/`onSignal`/`terminateUnauthorized`/`close`） |

## 14. Non-blocking observations

| ID | 位置 | 观察 | 建议 | 接受条件 |
|---|---|---|---|---|
| N-A | 设计 §7-D1 依据 1（引号文本） | 「§24.8 首句『事件字段必须回指本轮真实帧字节事实』的直接检验」——该短语非 §24.8 首句原文（§24.8 首条 bullet 为发射点归属句）；它是 SA8 iteration-1 §3 行 2 对「§24.8 首句 + §23.1 edge 行 + ADR 0032 `:114`」三处的综合表述，其字面依据在 ADR 0032 `:114`（「`bytes`/`namespaceId` 由帧字节定偏移判定」，本评审复验在场） | 语义主张成立且判决集支撑充分（SA8 判 implements-existing-decision），仅引用归位不精确；未来如再开设计修订，可把引语归位为「ADR 0032 `:114` 决策 5 注记 + §23.1 edge 行」；本轮可留给 SA8 R-2 复查一并核 citation | 引语可字面定位到决策文本即闭合 |
| N-B | 设计 §14 N-5' 行 | 该行声称「§2-A8 登记为已知观察」，但 §2-A8 正文未载 probe1/probe2 注释指向观察（实际仅在 §14 自身登记）——映射表位置指针级笔误 | 非阻断：处置本体（不修改冻结测试文件、两探针结论一致、SA2 iteration-1 判非阻断）正确且与冻结纪律一致；未来修订时可把半句观察移入 §2-A8 或改指针指向 §14 | 指针与正文一致即闭合 |
| N-C | 设计 §12 EV-6 行 | 「（≥200 轮，如需重证）」把复跑条件化；SA6 EV 表将 EV-6 列入「下游 required evidence」集。实质无缺口：现有证据列（E8/E9 日志在案且本评审复验）+ R-4 过期重核 + EV-7 sha/HEAD 门已覆盖证据新鲜度 | 可在终验执行口径中把 EV-6 的复跑触发条件显式等同于 R-4/EV-7 的过期判据（HEAD / 依赖 / 契约 sha 任一前移即重证），消除「required vs 如需」的措辞张力 | 终验收尾时 EV-6 行的证据引用与触发条件自洽即闭合 |
| N-D | 设计 §11 ALLOW 行 3 | 「复跑更新/新增同族证据（EV-1..EV-7）」的范围引用与 EV-4/EV-5「无需重跑（证据闭合）」的正文口径略宽松（EV-4/EV-5 仅在退化疑点时重做） | 无实质影响（ALLOW 行描述的是可写面而非必跑集）；终验执行时以 §12 各行口径为准即可 | 口径以 §12 为准即闭合 |
| N-E（承 iteration 1，维持登记） | SA6 rev2 §5.2/§10 行锚 1–2 行漂移（`:379-388` 实为 `:372-389`；`:869-885` 实为 `:869-886`）与 240 轮/238 对配对口径未定义 | 设计 §5.2/§13 R-8 的处置（一律采用自验行锚、保持 SA6 原报告数字不改写）本评审复验正确且已执行 | 维持 | — |
| N-F（承 iteration 1，维持登记） | anchor 文件头注释 `:113`「实测 120 轮」引 probe1，决定性证据为 probe2 240 轮 | 设计 §14 处置：不修改冻结文件（rev2 冻结纪律优先），两探针结论一致 | 维持；如未来 SA6 再开契约修订可顺手改注释指向 | — |

## 15. 附注

- **requiresConflictRecheck = false（本评审自身）**：本轮 finding 全部为 MINOR 引用/措辞级观察，不引入新的 ADR 冲突面（零生产/wire/schema/API/状态机语义变化）。设计侧已声明的 `requiresConflictRecheck = true`（§15）与 SA8 R-2 修订后复查保持武装——该复查是 rev1→rev2 契约演进 + 本设计修订的同变更集收口背书，**必须执行完毕**，本评审不新增触发理由、亦不替代之。
- **对 Controller 的路由提示**：SA8 R-1（设计修订，本对象）已完成并经本评审 `approve`；下一步 = SA8 R-2 修订后复查 →（如派工）SA4/SA7 终验（按 §12 口径复跑门禁）→ 人工合并 PR #446。R-2 完成前不进终验（SA8 R-3）。
- 本评审未修改任何设计、生产代码、测试或 SA6/SA3/SA8/SA2(前版) 产物；唯一写入为本文件（新文件，遵循仓库多轮评审 `_r2` 命名惯例，履行派工「Do not modify artifacts」约束）。
- `approve` 仅约束设计面；实现与活链路验证仍归 SA4/SA7，活链路结论以终验复跑日志为准。
