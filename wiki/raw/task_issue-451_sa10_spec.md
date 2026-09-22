# SA10 Spec 审查 — issue #451（γ-T5）：观测面锚定与全量回归收官（spec-review，iteration 0）

- SA10 dispatch：`sa-ba8ae684-43a5-463d-a9c7-c55f9758fb0e`（mabf-sa10 / spec-review / iteration 0）
- 审查对象：**已提交的最终交付** = commit `b40bca8b2b5d07b084297c6965af7b9927cb8744`（`test(ws-replication): anchor gamma observability contracts`，分支 `mabf/issue-451`），直接落于权威父 PR #446 头 `spec/445-gamma-async-seam` @ `68ab9f5bfe4df66a54faddf759709a76914332d0` 之上（本审查 `git merge-base --is-ancestor` 复核成立；`git ls-remote` 复核父分支头未前移）
- Owner 反馈：**无**（REST 评论快照 `[]` @2026-09-22T14:40Z，dispatch 提供）⇒ 需求全集 = Issue 正文 5 条 AC
- 审查基准：Issue 正文（`wiki/raw/task_issue-451.md`，body 快照 2026-09-22T12:33:27Z）+ 批准的 **SA6 rev2 验收契约**（`wiki/raw/task_issue-451_sa6_contract.md`）+ 适用规范（ADR 0032 附录 A4、协议 §23.1/§24、模块 `packages/ws-replication/AGENTS.md`）
- 审查方式：纯静态（交付 diff、契约文件逐行重读、源码锚点重读、`sha256sum`/`git status`/`git diff` 只读复核、证据日志尾行抽验）；未运行测试、未启动服务、未修改任何产物。唯一写入 = 本文件
- 交付 diff 面（`git show --stat b40bca8` 复核）：`packages/ws-replication/AGENTS.md` **+1/−0**；`test/ws-replication-issue451-gamma-observability-anchor.test.ts` **新增 432 行**；`test/ws-replication-issue451-gamma-surface-freeze.test-d.ts` **新增 74 行**；wiki 过程产物 7 份（设计 iteration 1、SA2 r2、SA3 impl、SA4 review、SA6 rev2 契约、SA8 设计/实现两份冲突报告）。**`packages/ws-replication/src/**` 零 diff**（`git diff 68ab9f5..HEAD -- packages/ws-replication/src/` = 空）

---

## 1. Verdict

**`approve`** —— 5 条 AC 全部落实且无 partial/unmet/unachievable；交付与 SA6 rev2 契约、ADR 0032 A4 / 协议 §24 逐条相符；无 scope creep。须在 PR 披露的未达成项 = AC5 尾句「转人工合并」为**设计上的人工动作**（非缺口，见 §5 D-1）；另有 4 条 MINOR 观察项（§6），不阻断。

## 2. 独立复核事实（本审查亲自执行，非转引上游结论）

| # | 复核项 | 命令/方式 | 结果 |
|---|---|---|---|
| V-1 | 两契约文件 sha256 与 SA6 rev2 §12.1 / 设计 §7-D1 钉死值 | `sha256sum` + `wc -l` | anchor = `4a8556bbecb775fd70a054051ee6599f9600ea01e9a26700a4818ad683bc3b4c`（**432 行**）；surface-freeze = `ef897240096c78a0b45e04cb5cc77f777a351b744a720f86c72a892520c42184`（**74 行**）——逐字相同 |
| V-2 | 生产零改动 | `git diff 68ab9f5..HEAD -- packages/ws-replication/src/`；`git status --short packages/ws-replication/src/` | 均**空**（交付 commit 与当前 worktree 双重核对） |
| V-3 | 交付拓扑 | `git merge-base --is-ancestor 68ab9f5 HEAD`；`git ls-remote origin spec/445-gamma-async-seam` | 父 PR 头 `68ab9f5` 是 HEAD 的直系祖先；远端父分支头未前移——「不自动合 main / 转人工合并」的分支态成立 |
| V-4 | edge 盖章点单点 | 重读 `src/hub-edge.ts:284-288`、`:869-886` | `sendDataFrame` = `tryEmitDataFrame` 盖章 → **`sequence > 0` 门**（:286）→ `emitUpdateSentAtStamp`；后者含无 observer 首行门（:874）+ `updateFrameProbe` 型门（:875-876，非 UPDATE 型 dormant）——与契约 EDGE-C1/C2/NC1/NC2 的被测事实一致 |
| V-5 | session 抑制点与结算点 | 重读 `src/hub-namespace.ts:1453-1462`、`:1416-1440` | `onUpdateSent` 普通帧 `info.chunked === undefined → return`（:1462，**零发射**，注释明确「发射点 = edge」）；chunked 在场 → `chunked-update-sent`；`onUpdateAcked` 发 `update-acked` / `chunked-update-acked`——与契约 SESSION-C1/C2、BOTH-C1 的被测事实一致 |
| V-6 | 公共面 append-only 底座 | `git diff c86ccbc..HEAD --numstat -- src/index.ts` | **+11/−0**（纯增）；`hub-edge-host.ts:186` = `readonly asyncDataAdmissionFatal?: true`（精确 `true`）；`hub-session-async-host.ts:114` = `asyncSendTickets: true` 唯一设置点 |
| V-7 | 契约 9 用例与纪律 | 逐行重读 anchor 契约全文（432 行）；grep `it(` 计数；grep `skip/only/todo` | `it(` = **9**（EDGE-C1/C2/NC1/NC2、SESSION-C1/C2、BOTH-C1、ORDER-C1/C2）；零 skip/only/todo/env override；每用例 30s 超时 + 显式泵（`pumpUntil`/`pumpSteps`/`settle`），零真实 timer |
| V-8 | rev2 边界在位（SA6 §12.5 裁定） | 重读 `:118-133`/`:139-145`/`:333-396` | `anchorProjection` 键集 = **`type/side/namespaceId/sequence`（无 `bytes`）**；跨调度 `toEqual`（:371）；逐轮 `sent/acked.bytes === payloadBytesOfFrame(round, seq)`（:372-389）+ `acked.sequence === sent.sequence`（:388）；`payloadBytesAt` 缺帧即响亮 throw（:141-143）；全文 5 处 `bytes` 断言（:173/:202/:277/:381/:385）**全部单轮自证**，零跨 boot 字节相等断言残留 |
| V-9 | 夹具双侧注入判别面 | 重读 `test/issue450-flow-seam.ts:180-208` | `bootFlowRound` 按 `edgeObserver`/`hubObserver` 选项把**同一 `makeAsyncObserver()` recorder** 分别注入 edge facade / session 宿主——单侧隔离归属判别机制真实在位 |
| V-10 | 规范原文 | 重读协议 §23.1（:833-846）/ §24.8（:1149-1154） | §23.1 归属表 edge 行 = `update-sent`（盖章事实在 edge mux 点、session 不再发射）、session 行 = `update-acked`/chunked 族等 namespace 域型、拒绝路径复刻行在场；§24.8 首句（发射归属）、第三句（跨线程 observer 事件**无全序**、金标适用域 = α/β）——契约逐字 enforce 这些条款 |
| V-11 | AC3 证据 | 读 `artifacts/sa6-issue451-sa3-r2-matrix-and-tsc.log` 尾行 + `-sa3-r2-file-set.log` | **20 files / 273 tests passed；Type Errors: no errors；exit 0**；逐文件清单含 `issue421-route-key-parity`、`issue421-wire-parity`（AC 点名的 parity guard 在集）；文件集 = 418×3+420×3+421×7+423×3+424×4 = 恰 20 |
| V-12 | AC4 证据 | 读 `-sa3-r2-root-typecheck-test.log`、`-sa3-r2-package-suite-3x.log`、`-sa3-r2-contract-determinism.log` 尾行 | 包 tsc exit 0；根 typecheck 15 段链 exit 0；根 `pnpm test` **2 次独立样本 468 files / 5675 tests 全绿**（两 #451 契约被逐文件列出：anchor 9 tests / surface TS 3 tests）；包套件 **3× 105/945 全绿**；聚焦契约 **40/40 绿**（`totals: FAIL=0 PASS=40`） |
| V-13 | D2 登记（AC5 O-1/O-2） | 重读 `packages/ws-replication/AGENTS.md:18`；`git diff --numstat` | 单 bullet **+1/−0** 在位：γ 桥宿主运输义务（专用 FIFO 通道对 / 回执盖章点同一同步段投递 / `ACK_STATE_VIOLATION` 1002 / §24.2.6）+ observer 两侧注入纪律（含 edge 拒绝路径复刻事件括注）+ 跨线程无全序「never merged-array order」纪律句 + 参考夹具 `test/issue447-async-seam.ts`——语义与 §24.2/§24.8/§23.1 原文逐点对齐 |
| V-14 | 上游闭环链 | 精读 SA2 r2（`approve`）、SA8 iter-2（`clear`）、SA8 实现冲突门禁（`clear`）、SA4（`approve`，无 BLOCKER/MAJOR） | 设计-契约-证据同变更集一致性已经 SA8 R-2 复查背书；实现后冲突门禁 `clear`；SA4 静态审查 `approve` |

## 3. AC 逐条判定

| AC | 要求 | 交付落实 | 判定 |
|---|---|---|---|
| **AC1** | `update-sent` 留 edge 盖章点锚；`update-acked`/chunked 族在 session 侧锚；γ 测试断言不依赖跨线程事件相对顺序 | anchor 契约 9 用例（V-7）：EDGE-C1 恰一 + `sequence`=wire 序 + `bytes`=本轮载荷长 + `sendQueueMs` 整键缺席 + session 域 8 型零命中；EDGE-C2 直驱判别面（锚=盖章点的因果证据）；EDGE-NC1 未盖章零事件（seq>0 门）+ 记录器活性正命中；EDGE-NC2 型门/R21；SESSION-C1 镜像负控（零 `update-sent`、零连接域 6 型）；SESSION-C2 chunked 族归 session；BOTH-C1 无双发；**ORDER-C1（rev2 边界）= 调度不变量投影逐字相同 + 计数恰一 + 逐轮字节自证**（V-8）；ORDER-C2 因果门（扣留期 sent×1/acked×0/`pending()>0`）。源码锚 V-4/V-5 全部在位；敏感性由 M1=5/9、M2=4/9、M3=3/9 三路 mutation 反证（SA6 §9 E11–E13，日志在案） | **met** |
| **AC2** | 新公共面 test-d append-only 复核 | surface-freeze test-d（74 行）：`keyof HubAsyncSessionHost = 'open'`（:41）、β 监听器同步返回 `number`（:48）、`asyncDataAdmissionFatal = true \| undefined`（:54-56）+ 2 处活体 `@ts-expect-error`（:66/:72，未触发即 TS2578 红）；append-only 底座 V-6（`index.ts` +11/−0 纯增）；双入口发现（`vitest --typecheck` + `tsc -p`，根测/包 tsc 日志均 exit 0） | **met** |
| **AC3** | listen 与 β 矩阵（issue418/420/421/423/424 全套）+ route-key / wire parity guard 全绿 | V-11：20 files / 273 tests 全绿（SA3 r2 新鲜复跑 + SA6 rev1 证据双重在案），route-key-parity / wire-parity 两 guard 文件在集 | **met** |
| **AC4** | 包 typecheck + 根 `pnpm typecheck` / `pnpm test` 全绿 | V-12：包 tsc exit 0、根 typecheck exit 0、根 test 2× 468/5675 全绿、包套件 3× 105/945、聚焦 40/40——达到并超过 SA6 EV-1/EV-2/EV-3 口径（≥30/≥3/≥2） | **met** |
| **AC5** | PR #446 实现与 ADR A4 / §24 一致性核对完成，阶段收官转人工合并 | 一致性核对 = SA6 §12.4（§24.2.1–A4.8 共 18 条款全「一致」，§24.8 行按 rev2 边界表述）；本审查对 §23.1/§24.8 原文与契约 enforce 面抽验相符（V-10）；O-1/O-2 登记 = D2 已落地（V-13）；「不自动合 main」分支态成立（V-3）；尾句「转人工合并」为人工动作，移交登记在案（§5 D-1） | **met（核对半句）+ 人工移交（尾句，设计内）** |

**Blocked by 核验**：#449（PR #456）、#450（PR #459）均已合入 HEAD 祖先链（git log 复核），阻塞关系已消解。

## 4. SA6 rev2 契约符合性（专项）

rev1→rev2 修订的授权链与边界裁定是本票的核心争议面，本审查专项复核：

1. **修订史与授权在案**：rev1（sha `3088fb7b…`，已废止）把 `bytes` 纳入跨两轮独立 boot 的 `toEqual`，实为 live Y.Doc `clientID` CSPRNG varint 宽度抽签检测（两轮不等概率 ≈ 11.65%；实测聚焦 4/30 红、包套件 3/7 红）；SA6 作为契约 owner 依 SA8 iteration-0 §10 条件 2 原位修订为 rev2（sha `4a8556bb…`），SA8 iter-1/iter-2 判 implements-existing-decision、无需 override。交付文件 = rev2 实体（V-1）。
2. **边界裁定逐字在位**（V-8）：跨调度只比较调度不变量（`type/side/namespaceId/sequence` + 计数）；`bytes` = 单轮自证事实；判据面缺失响亮 throw。与仓库既有口径同构（`#424 ORACLE-2 :16` 数据帧字节相等禁用、`#418 :21,117-119,460` 不跨进程冻结载荷——本审查重读两先例原文在场）。
3. **非弱化证据成立**：M3（`update-sent.bytes + 1` 对称说谎）在 rev2 下 3/9 红（含 ORDER-C1）> rev1 边界 2/9（`rev-M3-boundary-compare.log` 尾行本审查抽验相符）——rev2 严格更强，SA8 R-1b「禁止回退」的量化判据在案。
4. **确定性结构性成立**：判据面已剔除唯一 CSPRNG 派生量；40/40 聚焦（旧机制下概率 ≈ 0.7%）+ 240 轮真 boot 探针 0 假红 + 根/包门禁多样本全绿（V-12）。
5. **契约矩阵其余行**（§12.2 全表：EDGE/SESSION/BOTH/ORDER/SURFACE/GATE/CONSISTENCY）逐行与交付面核对，无遗漏、无偏差。

## 5. PR 必须披露的未达成/移交项

| # | 项 | 定性 | 披露建议 |
|---|---|---|---|
| **D-1** | AC5 尾句「收官转人工合并」尚未执行：交付停留在 `mabf/issue-451` @ `b40bca8`，父 PR #446（`spec/445-gamma-async-seam` @ `68ab9f5`）未更新、未合 main | **设计内人工动作**（简报原文「不自动合 main」；非任何 SA 权限），非实现缺口 | PR 描述应明示：合并为待人工执行；收官材料 = rev2 契约两文件 + D2 登记 + 设计 iteration 1 + 全绿证据族 + SA6 §12.4 一致性结论 |
| **D-2** | 全部 AC4/AC3 绿证采集于交付内容以 untracked/工作区形态存在时（HEAD `68ab9f5` 工作区）；交付 commit `b40bca8` 为同一内容的纯新增落账（两契约 sha 逐字相同、src 零 diff、AGENTS.md 同 +1 行），证据随之有效；但**提交后未再复跑门禁** | 低风险事实登记（纯落账不改字节）；SA4 §11 已登记 CI 复跑为动态验证项 | PR 描述建议附「合并前 CI 按设计 §12 门集复跑」前置项（EV-1 ≥30×、EV-2 ≥3×、EV-3 ≥2×） |

无其他未达成项；无 partial；无 unachievable（AC 全集在SA权限内的部分全部完成）。

## 6. MINOR 观察项（不阻断 approve）

| # | 位置 | 观察 | 处置建议 |
|---|---|---|---|
| M-1 | anchor 契约头注释 `:113` | 「实测 120 轮」引 probe1；决定性证据为 probe2 240 轮（两探针结论一致） | 文件按 §11 DENY 钉 sha 冻结，**不得为注释措辞再开修订**；SA6 未来再开契约修订时顺手更新（承 SA4 N-4 / SA2 N-5'） |
| M-2 | `task_issue-451_design.md:110,348` 等 | 「根 2×4675」笔误，证据日志实为 **5675**（本审查读日志核对） | 纯文本级；未来任一产物再开修订时顺手改（承 SA4 N-1） |
| M-3 | 交付 commit 未含 `wiki/raw/task_issue-451.md`（Host 简报）与 `task_issue-451_sa2_review.md`（SA2 iteration 1，已被 r2 取代）——两者仍 untracked；证据日志 `artifacts/sa6-issue451-*`（41 文件）亦未提交 | 过程产物落账口径属 Runner Host 决策；简报与 r2 在案可满足追溯；不影响任何可执行判据 | 人工合并时按仓库惯例决定是否补记（参照 `523942f` issue-450 先例）；不要求返工 |
| M-4 | SA8 实现冲突报告 §1 D-4「44 文件」计数 vs 实际 41 | 计数笔误，无执行面影响（承 SA4 N-2） | 后续引用以 `ls` 实数为准 |

## 7. Scope creep 核查

交付 diff 全部落在设计 §11 ALLOW / SA6 §16 最终变更面内：两契约文件（SA6 契约本体）、AGENTS.md +1 行（D2 登记）、wiki 过程产物（MABF 固定产物族，与 issue-450 收官 commit `523942f` 同惯例）。**零生产改动**（V-2）、零规范文本改动、零夹具改动、零 git 生命周期越权（合并/推送均未发生，V-3）。无范围扩张。

## 8. 结论

当前实现**忠实满足** Issue #451 正文全部 5 条 AC 与 SA6 rev2 验收契约的每一契约行，与 ADR 0032 附录 A4 / 协议 §23.1/§24 同支一致；无遗漏、无部分实现、无错误实现、无 scope creep。AC5 尾句人工合并为设计内移交项（§5 D-1），连同 CI 复跑前置（D-2）须写入 PR 披露。4 条 MINOR（§6）不阻断。**`approve`**。
