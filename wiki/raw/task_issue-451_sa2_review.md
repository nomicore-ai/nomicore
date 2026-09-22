# SA2 设计评审 — Issue #451（γ-T5）：观测面锚定与全量回归收官（iteration 1，rev2 契约 + 设计修订需求）

- Dispatch：`sa-37634d48-1d8e-4526-bc96-e3acd8f3268d`（mabf-sa2 / design-review / **iteration 1**）
- 评审对象（双对象，按派工）：
  1. **SA6 验收契约 rev2**：`wiki/raw/task_issue-451_sa6_contract.md`（原位修订版，2026-09-22 21:52 落笔；修订动因 = SA3 `reject` 的 `ANCHOR-ORDER-C1` 非确定性）；
  2. **SA1 设计修订**（SA6 rev2 §15 B-1 / §12.5 EV-8 明列的必改项）：`wiki/raw/task_issue-451_design.md` —— **本评审时点仍为 iteration 0 原文（20:56 落笔后零修订）**，这是本轮的核心裁决对象。
- 评审基线：HEAD `68ab9f5`（SA6 rev2 §4 / `rev-root-test-2nd.log` 首部备案 `68ab9f5bfe4df66a54faddf759709a76914332d0`；SA2 按纪律不运行 `git diff`/`git status`，全部锚点以只读源码/文档/测试/日志核验）
- 评审日期：2026-09-22（worktree `/home/wangjian/nomicore-fix-issue-451`）
- 前版：iteration 0（dispatch `sa-50207155-ffd4-46a0-bc8a-cf7089f78ce0`，`approve` + N-1/N-2/N-3 MINOR）。本版**原位更新**：N-2/N-3 已由 SA3 落地（见 §15），从当前 finding 面移除；N-1 保留并入修订清单。

## 1. Reviewed inputs

| 输入 | 状态 | 核验方式 |
|---|---|---|
| `wiki/raw/task_issue-451.md`（Host 简报，5 AC + Blocked by #449/#450） | 存在 | 逐条读取（unchanged） |
| `wiki/raw/task_issue-451_design.md`（SA1，**iteration 0 未修订**） | 存在 | 全文精读 + 定向 grep（`:3/:28/:46/:124/:231/:247/:268/:282/:288` 全部仍为 rev1 口径；零处提及 rev2/clientID/M3）——mtime 20:56，早于 SA3（21:26）与 SA6 rev2（21:52） |
| `wiki/raw/task_issue-451_sa6_contract.md`（**rev2**） | 存在 | 全文精读；其实质声明逐条对 worktree 复验（见 §5/§7/§10/§12） |
| `wiki/raw/task_issue-451_design_conflict_report.md`（SA8，`clear`） | 存在 | 全文精读；§10 复查重启条件第 2 条原文核验：「门禁复跑发现需改生产/契约才能转绿」 |
| `wiki/raw/task_issue-451_sa3_impl.md`（SA3，`reject` + `requiresConflictRecheck: true`） | 存在 | 全文精读；§7 根因链与 §7.4 三备选、§7.5 复查裁定核验 |
| `wiki/raw/task_issue-451_relevant_decisions.md` / `_conflict_report.md` / `_sa4_review.md` / `_sa7_report.md` | 不存在 | 目录清单核验；规范权威链 = spec #445 → ADR 0032 A4 + 协议 §24（存在且已读） |
| Owner 评论 | REST 快照 `[]` @2026-09-22T13:39Z（本次派工提供） | 无 owner 追加要求；此前 12:33/12:35/12:43/12:53/13:13Z 五次快照同判空 |
| 契约工件 | 在位 | `anchor.test.ts` = 432 行 / 9 用例，sha256 `4a8556bb…b3b4c`（与 SA6 §12.1、`rev-root-test-2nd.log` 首部三方一致）；`surface-freeze.test-d.ts` = 74 行，sha256 `ef897240…c42184`（与 SA3 §2 落地态备案一致 = 本轮零改动）；`zz-sa6-*` 临时探针测试文件已删除（`test/` 目录清单核验零命中） |
| 证据日志 | 33 份 `artifacts/sa6-issue451-*.log` 在位 | 抽验关键日志（§5/§12）：40/40、3×105/945、4/30 红、M1=5/9、M2=4/9、M3=3/9（含 ORDER-C1）、M3 边界对照 rev1=2/9 vs rev2=3/9、240 轮探针（pairs=238，宽度↔字节 1:1，0 反例）、根测试 run2 468/5675（revised sha 备案） |
| 源码/规范锚点 | — | `hub-edge.ts:278-293`（盖章→`seq>0` 门→发射，复验）、`:862-887`（`emitUpdateSentAtStamp` 无 observer 首行门 + `updateFrameProbe` 型门）、`hub-namespace.ts:1412-1466`（`onUpdateAcked` / `onUpdateSent` 普通帧 `:1462` 零发射）、`doc-runtime/create-initial-document.ts:158-160`（裸 `new Y.Doc()`）、`namespace-registry/create-document.ts`（两分支均走 `createInitialDocument`）、`#424 ORACLE-2`（`ws-replication-issue424-auth-parity.test.ts:16-19`）、`#418 C3`（`ws-replication-issue418-edge-session-split-contract.test.ts:19-22,117-120,458-461`「Yjs 载荷帧 payload 逐字节不可跨进程冻结」）、协议 §23.1 归属表（:833-846）/§24.8（:1149-1154）、`AGENTS.md:17-18`（D2 bullet 已落地于 :18） |

## 2. Verdict

**`reject`** —— 存在 1 条 BLOCKER + 1 条 MAJOR（§13）。

分项总判：

- **SA6 rev2 契约本体：核验通过。** 修订的根因链（live `Y.Doc` `clientID` CSPRNG 宽度抽签 ⇒ 载荷长 {24,27} ⇒ 跨轮字节相等断言 = 11.65%/对 的抽签检测）经本评审对源码链、探针日志、仓库既有口径（#424 ORACLE-2 / #418 C3）与 M3 边界对照独立复核**全部成立**；rev2 边界（调度不变量投影 + 每轮对本轮 wire 载荷自证）与 AC1-c 语义精确对齐，且对字节事实说谎的敏感性**严格增强**（E13：rev1 边界下 M3 仅 2/9 红，rev2 下 3/9 红且新增 ORDER-C1 判据面）；`requiresConflictRecheck: true` 依 SA8 §10 条件 2 正确触发；零生产改动、临时探针零残留、sha 备案三方一致。
- **SA1 设计修订：缺席（BLOCKER）。** 设计仍为 iteration 0 原文：其核心裁定 D1（内容冻结）的「确定性已证」前提、§11 DENY 理由、§13 R-2、§12 现有证据列、§14 输入登记与 §15 `requiresConflictRecheck = false` 均被 SA3 §7 / SA6 rev2 证伪或过时，且与 worktree 现状（契约已合法演进为 rev2、D2 已落地、rev2 证据族在位）直接矛盾。SA6 rev2 §15 B-1 明言「设计侧文本留待 SA1 原位修订」——该修订是本轮派工的评审对象之一，尚未发生。

## 3. 需求覆盖

| Requirement（Issue AC） | SA6 rev2 落点 | 设计（iteration 0 原文）落点 | Assessment |
|---|---|---|---|
| AC1-a `update-sent` 留 edge 盖章点锚；`update-acked`/chunked 族 session 侧锚 | §12.2 矩阵 8 用例（rev2 下逐字保持）+ §5.3；源码锚本评审复验成立 | §2-A1/A2 + §7-D1 + §12 行 1–2 | 契约面覆盖成立。设计行锚仍准确，但承载其「冻结」裁定的证据列（green-repeat 3 连绿）已被证伪为抽样运气（3 连绿概率 ≈ 69%） |
| AC1-b γ 断言不依赖跨线程事件相对顺序 | §12.2 ANCHOR-ORDER-C1（rev2 边界）+ ORDER-C2 + NC-6（RNG 边界负控，240 轮）+ order-audit | §12 行 3 | **契约面覆盖且较 rev1 更精确**：跨轮判据只含调度不变量字段，RNG 派生量结构性移出。设计的「两调度投影逐字相同」表述需同步收窄为「调度不变量投影」（见 F-1 清单第 8 项） |
| AC2 新公共面 test-d append-only 复核 | §12.1（surface-freeze sha 不变，本轮零改动） | §2-A3/A4/A5 + §12 行 4 | 覆盖（unchanged；sha 双源一致核验） |
| AC3 listen + β 矩阵 + parity guard 全绿 | §13/§14 矩阵 20 files / 273 tests（rev1 证据保持，本轮零相关改动） | §12 行 5 | 覆盖（文件集算术 iteration 0 已逐一对目录核验，本轮复认） |
| AC4 包 typecheck + 根 `pnpm typecheck`/`pnpm test` 全绿 | §13/§14：包 3×105/945、包 tsc 0、根 typecheck 0、根 test **2 次独立样本** 468/5675（EV-3 采纳 ≥2） | §12 行 6–9（单次根测试；证据列指向 rev1 日志族） | 契约面覆盖。设计需采纳 EV-1..EV-7 口径并重指 rev2 证据族（F-1 清单第 8/10 项） |
| AC5 PR #446 与 ADR A4/§24 一致性核对 + 收官转人工合并 | §12.4（18 条款全「一致」，§24.8 行已按 rev2 边界更新表述）+ §12.3 人工合并边界 | §3/§7-D2（**已由 SA3 落地**于 `AGENTS.md:18`，本评审核验在场且 N-2/N-3 润色已并入）/§7-D3 | 覆盖。D2 落地状态需在设计修订中如实登记（设计原文以「本设计落笔」将来时表述） |

非目标未静默扩大：rev2 契约面只修订单一断言边界（§0 表），生产 `src/**` 零改动不变量贯穿；设计非目标原文无扩大，但其第 2 条的**理由**（「已 3 连绿」）已失真（F-1 清单第 12 项）。

## 4. Owner评论覆盖

| Comment ID | Updated at | Design section | Assessment |
|---|---|---|---|
| （无评论） | REST 快照 `[]` @2026-09-22T13:39Z（最新；12:33/12:35/12:43/12:53/13:13Z 同判空） | 设计 §4 / SA6 §2 | 无 owner 追加约束可映射；rev2 修订属验收契约自身确定性缺陷的修复，不引入 owner 隐含面 |

## 5. 上游事实与SA8约束

| Fact or constraint | SA6 rev2 响应 | 本评审独立复核 | Assessment |
|---|---|---|---|
| SA3 §7：`ANCHOR-ORDER-C1` 间歇红（包套件 3/7，红灯恒为该用例，`bytes` 24 vs 27 方向可翻转）；单文件 16 连绿 = 抽样运气 | §5.1 R-1..R-4 + §8.2 S1/S5 | `rev-flake-samples.log` run 27 红（`1 failed | 8 passed`，红 = ORDER-C1）复验；`sa3-suite-repro/samples` 在位 | 成立 |
| 根因 S3/S4：载荷长含 `clientID` varint 宽度；`clientID` 源 = 裸 `new Y.Doc()` | §8.2 + §10 RNG 源行 | `create-initial-document.ts:160` 裸 `new Y.Doc()` 复验；registry `create-document.ts` 两分支均汇入 `createInitialDocument`；`order-rng-probe2.log`：240 boots，宽度 ∈ {4,5}，w4→24B / w5→27B，**pairs=238 中 22 对宽度不等 = 22 对字节不等，0 反例**（同宽度异字节 0、异宽度同字节 0） | 成立。机制-证据闭合，非时序/环境归因（H8 排除成立：单进程串行 boot 仍双值） |
| SA3 §7.2 对夹具 `makeSeedDoc` 的归因 | rev2 R3 修正：live 文档走 `registry.create` 生产路径，`makeSeedDoc` 不在 flow round 路径 | 与源码链一致；且备选 A 否决理由①（钉死 = 生产改动）与此修正互洽 | 修正成立，不影响 SA3 结论 |
| 仓库既有口径：数据帧禁用跨进程字节相等 | §3 末行 + §12.5 裁定依据 | `#424 ORACLE-2`（`auth-parity.test.ts:16`「**禁止**把数据帧（Yjs 载荷帧）的字节相等写成断言：Yjs clientID 由 Yjs 自身随机生成」）；`#418 C3`（`edge-session-split-contract.test.ts:19-22` + `:117-120`「payload 逐字节不可跨进程冻结」+ `:458-461` 同款注释） | **成立——rev1 的 ORDER-C1 实质违反了本仓已成文的两处先例口径**；rev2 回归口径是规范一致性修复，非放松 |
| SA8 §10 复查重启条件第 2 条：「门禁复跑发现需改生产/契约才能转绿」 | §3/§15：`requiresConflictRecheck: true` | SA8 报告原文核验；SA3 §7.5 同判 true | 成立。契约侧修订先于设计侧文本更新发生，但 SA8 预登记的重启条件正是对这一情形的授权路径；SA6 作为契约所有者执行修订，归属正确（§10） |
| SA6 rev2 §12.5 EV-1..EV-8：下游证据义务 | 已列 8 条 | EV-8（设计修订）**未执行**——见 F-1；EV-1..EV-7 本轮已由 SA6 自证（§13 各行日志在位，本评审抽验一致） | EV-8 是唯一未闭合项 |
| 生产零改动边界（派工 + SA6 §3） | §16 + mutation 复位证据 | 两契约 sha 备案一致；`rev-mutations` 日志 M1/M2/M3 后各有复位核对记录；当前 `src` 锚点内容与设计 §2 行锚逐点相符 | 成立 |

上游事实与源码矛盾：**无**（rev2 全部行锚经重读核对；SA6 §5.2 引 `:379-388`、§12.2 ORDER-C1 边界描述与文件实际 `:372-389` 有 1–2 行锚位漂移，属笔误级，见 N-3'）。

## 6. 设计内部一致性（本轮核心：设计 ↔ rev2 契约 ↔ worktree 现状）

**总判：设计（iteration 0 原文）与已批准的 rev2 契约及 worktree 现状存在系统性失配——正文、裁定、DENY、风险册、验收映射与自评结论五个层面互相印证的旧前提未被撤销。**逐点：

| # | 设计位置 | 当前原文（摘要） | 与 rev2/现状的矛盾 |
|---|---|---|---|
| C-1 | §7-D1（:124-133，核心裁定） | 「两个契约文件**原样**成为最终验收面，不做任何断言改动」＋依据 2「敏感性已双向反证（M1/M2）」 | anchor 文件已被合法修订（rev2，432 行 / sha `4a8556bb…`）；敏感性现为三路（M1/M2/**M3**）。D1 的冻结对象必须重锚到 rev2 内容 + sha，否则「原样」指向一个已不存在的形态 |
| C-2 | §11 DENY（:231） | 「已批准 SA6 契约 + 3 连绿 + M1/M2 敏感性在案；改断言 = 破坏已批准验收面」 | 「3 连绿」被证伪为抽样运气（P≈69%）；「已批准契约」实为 rev2（批准面本身包含这次修订）。DENY 继续成立但理由与锚定物（sha）必须重写，否则实现者会把 rev2 文件误判为违约产物 |
| C-3 | §13 R-2（:268） | 「确定性已证（零真实 timer、显式泵、随机钉死；契约 3 连绿）」 | ** falsified**：唯一未钉死量 = live `Y.Doc` `clientID`（CSPRNG），rev1 判据 11.65%/对 假红率；3 连绿不是确定性证据。确定性新依据 = RNG 派生量结构性移出判据 + 40/40 + 240 轮探针 0 假红 |
| C-4 | §15（:288） | `requiresConflictRecheck = false` | 与 SA3 §7.5、SA6 rev2 §15 B-1 的 `true` 裁定直接相反；SA8 §10 条件 2 已事实触发（契约为转绿而改）。设计自评若不翻转，会误导 Controller 跳过冲突复查 |
| C-5 | §2-A8（:46） | 「400 行 / 9 用例…3 连跑 9/9 绿…M1 5/9 红、M2 4/9 红」 | 现状 432 行 / 9 用例 / sha `4a8556bb…`；证据族应为 rev2 族（40/40、3×945、M1/M2/M3）；「内容冻结（DENY）」措辞需按 C-1/C-2 重锚 |
| C-6 | §2-A9 / §5 / §12 现有证据列（:47/:93/:247 等） | 引 `green-repeat1..3.log`、`-package-suite.log` 等 rev1 日志族为现状证据 | rev1 日志仍是合法历史证据，但「现状/复跑口径」应指向 `rev-*` 族与 EV-1..EV-7；SA3 的 `sa3-*` 族 10 份亦在位可引 |
| C-7 | §14（:282） | 「`task_issue-451_sa2_review.md` 不存在（iteration 0 无评审输入）」 | SA2 iteration-0 评审、SA8 冲突报告、SA3 实现报告均已存在；头部的「缺席输入」登记（:7）同样过时 |
| C-8 | §1 非目标第 2 条理由（:28）/ §7-D2 将来时表述（:135-）/ §3 G-doc「本设计落笔」 | 「已 3 连绿 + M1/M2」「D2 = 本设计裁定落地」 | 理由失真（同 C-2）；D2 **已由 SA3 落地**于 `AGENTS.md:18`（含 N-2/N-3 润色），设计应改为已完成态登记并引用 landed bullet |

**SA6 rev2 契约内部一致性**：正文（§0 修订摘要）↔ §5.2 正控描述 ↔ §12.2 矩阵 ORDER-C1 行 ↔ 契约文件实体（`:333-396` 投影 `toEqual` 于 `:371` + 逐轮自证 `:372-389`；`anchorProjection` `:118-133` 只取 `type/side/namespaceId/sequence`；`payloadBytesAt` `:139-145` 缺帧响亮 throw）↔ sha 备案，四方一致；§12.4 §24.8 行已按 rev2 边界更新表述；「其余 8 用例语义未动」与 iteration-0 评审逐行核验的 rev1 断言面 + 当前文件逐例重读相符。

## 7. 状态机与并发攻击

本票生产状态机零变化（rev2 复核成立）。本轮攻击面 = **契约自身的确定性/调度不变性**：

| ID | Initial state | Trigger | Expected behavior | Design/contract gap | Required revision |
|---|---|---|---|---|---|
| SM-1 | rev1 判据（跨两轮独立 boot 的投影含 `bytes` + `toEqual`） | 两轮 clientID 宽度抽签不等（P≈11.65%/对） | 间歇假红，与调度无关 | 无（rev2 已移除：投影字段 `type/side/namespaceId/sequence` 全为确定性量——240 轮探针 `sequence=[7]`、`side=["hub"]`、单 nsId 恒定） | — |
| SM-2 | rev2 ORDER-C1 | 即时释放 vs 扣留后释放两调度 | 调度不变量投影逐字相同 + 计数恰一 + 每轮 `sent/acked.bytes === 本轮 wire 载荷长` | 无（`:361-395` 断言面逐行核验；缺帧即 throw，无 fallback） | — |
| SM-3 | 扣留期（edge→session held） | ACK 已达 edge 但被扣留 | sent ×1 在场、acked ×0、`pending()>0` | 无（ORDER-C2 未动，`:398-431` 核验） | — |
| SM-4 | 对称字节说谎攻击（两轮事件 `bytes` 同时 +1） | M3 mutation | rev2：EDGE-C1/C2 + **ORDER-C1** 三处红（3/9）；rev1 边界下 ORDER-C1 绿（2/9） | 无——`rev-M3-boundary-compare.log` 双边界对照复验；rev2 严格更强（H10 成立） | — |
| SM-5 | 编码器级真实膨胀攻击（wire 载荷本身系统性 +N 字节） | 假想回归 | 本契约不断言绝对载荷长 | **非缺口**：按 #424 ORACLE-2 / #418 C3 口径，Yjs 载荷绝对长度本就不可断言（clientID 合法随机）；rev1 的跨轮相等对该攻击的检出力仅 11.65% 且与假红不可区分——rev2 放弃的是一张彩票，换来确定性 + M3 级说谎检测 | —（攻击已运行并排除，记录在案） |
| SM-6 | 其余 8 用例 | 单侧注入/直驱/型门/超限/分块/双发 | 见 §12.2 矩阵；M1=5/9、M2=4/9 红 | 无（`rev-mutations-M1-M2-M3.log` 复验，红灯落点均为归属断言） | — |

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| ER-1 | 任一门禁非绿 | 设计 §7-D4：阻塞上报，禁缩小/skip/only/env/改断言换绿 | 纪律本身正确，且已被 SA3 实际遵守（遇红即 reject 而非修断言） | 维持；修订时不得弱化 |
| ER-2 | **ORDER-C1 再红（如未来回归引入新 RNG 派生量）** | 设计 R-2 现文以「确定性已证 + 3 连绿」安抚 ⇒ 实现者可能误判为「环境/抽样问题」而重跑碰运气 | **中——这是 stale 设计最危险的错误恢复路径**（SA3 正是靠 16 连绿差点被误导，幸有包套件 7 次采样揭穿） | F-1 清单第 9 项：R-2 重写为 rev2 确定性依据（结构性移除 + 40/40 + 探针），并明示「再红 = 真回归或新 RNG 派生量混入，阻塞上报」 |
| ER-3 | 契约判据面缺失（wire 无对应 UPDATE 序） | `payloadBytesAt` 响亮 throw（`:141-143`） | 无 fallback 掩盖 | — |
| ER-4 | 「零命中」断言空转 | NC-4 元判据：同场正命中（P-1 `update-sent`、P-3 `connection-failed` 等） | 无伪绿 | — |
| ER-5 | mutation/探针残留 | SA6 §16：M1/M2/M3 复位（M3 两轮各验一次）、`zz-sa6-*` 已删除、`/tmp` 不随交付 | 本评审核验：`test/` 零 `zz-` 残留；`clientid-probe.mjs` 为 artifacts 内可复跑探针（§12.1 声明在案，属证据面非残留） | — |
| ER-6 | HEAD 前移/证据过期 | 设计 R-4 + SA6 EV-7（sha + HEAD 备案；前移即按 §12 重核） | 低——`rev-root-test-2nd.log` 首部 sha+HEAD 双备案是正确实践 | 设计修订应把 EV-7 的 sha 锚定吸收为设计不变量（F-1 清单第 7 项） |

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| anchor 契约文件内容演进（rev1→rev2）的消费者：vitest 运行器（包/根/`--typecheck`） | 无——glob `packages/*/test/**/*.test.ts` 持续命中；9 用例计数不变（105/945、468/5675 计数在 rev2 下复验一致） | `rev-postfix-suite-3x.log`、`rev-root-test-2nd.log` 逐文件列出 anchor (9 tests) | — |
| CI（全量 typecheck/test） | 无——无配置面变化 | 同上 | — |
| 实现阶段对契约完整性的核验 | **设计未提供锚定物**：D1「原样冻结」无可验证参照（rev1 已不存在） | 两契约 sha 在 SA6 §12.1 / SA3 §2 / rev2 根测日志首部三源一致 | F-1 清单第 2/7 项：DENY 行钉 rev2 sha，实现收尾按 EV-7 核对 |
| 未来读设计者（SA4/SA7/人工合并者） | **有**：设计 C-1..C-8 失配会传导错误前提（「契约从未改过」「确定性已证」「无需冲突复查」） | §6 失配表 | F-1（整表） |
| `packages/ws-replication/AGENTS.md` 读者 | 无——D2 bullet 已落地（:18），N-2/N-3 润色后与 §24.2.6/§24.4/§23.1 三行归属语义精确对齐（本评审对照协议原文核验） | AGENTS.md:17-18；协议 :833-846/:1149-1154 | 设计登记 D2 已落地（F-1 清单第 11 项） |
| wire/schema 消费者 | 无——host-facing 契约非 wire 契约，零 wire 变化 | 协议 §24 引言 | — |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | 实际 location | Assessment |
|---|---|---|---|
| 验收契约断言边界的诊断与修订 | SA6（契约/诊断事实所有者） | SA6 rev2 §12.5 裁定 + 契约文件修订 | **正确**：SA3 拒绝越权（不改 DENY 面）、上报矛盾；SA6 以根因链 + 三备选裁决（A/D 否决理由充分：A = 生产改动或「验证夹具强制的巧合」、D = 掩盖事实）执行修订；权限链与 SA8 §10 条件 2 预登记的重启路径吻合 |
| 设计文本与契约一致性维护 | SA1 | **缺席**（iteration 0 原文） | F-1：设计必须原位修订；SA6 明言「设计侧文本留待 SA1 原位修订」 |
| 一致性核对结论 | SA6 §12.4 | 采信不复制 | 正确 |
| 「转人工合并」 | 人 | SA6 §12.3 / 设计 §7-D3 | 正确，无 SA 越权 |

### 相似能力与扩展点

| Similar capability | Existing implementation | Proposed/actual design | Consistent or divergent | Reason |
|---|---|---|---|---|
| 数据帧字节判据口径 | `#424 ORACLE-2`（L2 白名单语义判据）、`#418 C3`（payload 不可跨进程冻结） | rev2：跨调度投影不含 `bytes` + 每轮单轮自证 | **一致（回归口径）** | rev1 是口径违例；rev2 与两处成文先例及 `issue447/448/449` 语义判据先例同构 |
| 已有单轮自证断言形态 | rev1 的 EDGE-C1（`:173`）/C2（`:202`）/SESSION-C1（`:277-279`）本就对本轮 wire 自证 | rev2 把同款形态引入 ORDER-C1 | 一致 | 复用既有断言模式，无新机制 |
| 收官证据落档 | `artifacts/sa6-*.log` 固定位置族 | rev2 新增 `rev-*`/`clientid-probe`/`order-rng-probe` 同族 | 一致 | 同通道，无平行机制 |
| 夹具复用 | `issue447-async-seam.ts` / `issue450-flow-seam.ts` / `harness.ts` / `driver.ts` | rev2 零夹具改动（备选 A 否决） | 一致 | 修订面最小化为单文件断言边界 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 验收契约当前内容 | 契约文件实体 + sha `4a8556bb…`（SA6 §12.1 / SA3 §2 / 根测日志三源一致） | 设计/报告中的描述 | **当前高**（设计仍描述 rev1 形态）→ F-1 修订后低：设计 DENY 钉 sha，收尾按 EV-7 核对 |
| 非确定性根因 | SA6 rev2 §8.2 + 探针日志 | 测试文件头注释（:109-116）摘要 | 低——注释引用探针日志为源 |
| rev1→rev2 修订史 | SA6 rev2 §0/§12.5 | 各报告引用 | 低——rev1 证据日志保留为历史，不冒充现状 |
| 生产零改动 | `src/**` 恒空门（设计 §12 末行） | 各报告声明 | 无 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| （无运行时面——零生产改动；契约修订为纯文件演进） | — | rev2 单文件回退 = 恢复 rev1 边界（但会复活 11.65% 假红，非合理回退路径；D2 bullet 单行 revert 即回滚） | 不适用面无对称性缺口 |

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 第二套确定性探针通道 | `artifacts/` 日志族 + `clientid-probe.mjs`（可复跑） | 无新增（临时 `zz-*` 探针已删） | 无平行 |
| 第二套验收入口 | 包/根门禁 + vitest glob | rev2 全走仓库真实入口（§14） | 无平行 |
| 契约修订绕过批准链 | SA8 §10 重启条件 | rev2 主动触发 `requiresConflictRecheck: true` 并留全证据 | 无绕过 |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| SA6 rev2 实际变更面：anchor 契约文件（rev2 边界）+ `artifacts/sa6-issue451-rev-*/clientid-probe/order-rng-probe*`（新增证据）+ SA6 报告本身 | §16「最终 worktree 变更面」声明与目录实况相符（33 份日志在位、`zz-*` 零残留、surface-freeze sha 不变） | 无——变更面与声明一致，且全部落在任务既有 ALLOW 族（契约文件属 SA6 职责产物、artifacts 属证据族） |
| SA3 变更面：`AGENTS.md:18` 单 bullet + `sa3-*` 日志 10 份 + 实现报告 | §3/§5 与实况相符（:18 bullet 在场，N-2/N-3 润色版） | 无——在设计 ALLOW 第 2/3 行内 |
| 设计 ALLOW（§11）：本设计 / AGENTS.md bullet / `artifacts/sa6-issue451-*.log` 族 | 三行 ALLOW 与实际改动面相容（rev2 新日志属同族「可新增同名族证据」） | 无 |
| 设计 DENY anchor 契约文件行 | **理由失真**（C-2）：以被证伪的「3 连绿/已批准不可修订」为据 | F-1 清单第 7 项：重写为「rev2 内容（sha `4a8556bb…`）为冻结基线；rev1→rev2 修订由 SA6 依 SA8 §10 条件 2 执行并已触发复查；此后任何改动仍 DENY」 |
| DENY `src/**`、夹具、矩阵既有测试、协议/ADR/CONTEXT、`.git` | rev2/SA3 均零触碰（sha/行锚/日志复核） | 无 |
| follow-up 伪装检查 | 无（R-6 为既有 ADR 留待项；本票必要项 = F-1 设计修订，未被伪装成 follow-up——SA6 明列为 EV-8 必改项） | 无 |

（SA2 按纪律未运行 `git diff`/`git status`；范围审查基于设计/契约声明与只读文件面 + sha/目录清单核验。）

## 12. 验收设计审查

| Requirement or risk | Proposed evidence（rev2） | Gap | Required revision |
|---|---|---|---|
| 契约确定性（AC1-c 载体） | EV-1：聚焦文件 ≥30 次独立进程（本轮 40/40，`rev-postfix-focused-40x.log` 复验） | 设计 §12 无对应行（仍以 green-repeat 3 连绿为证） | F-1 清单第 8 项 |
| 包门禁 | EV-2：≥3 次 105/945 全绿（`rev-postfix-suite-3x.log` 复验） | 同上 | 同上 |
| 根门禁 | EV-3：`pnpm test` ≥2 独立样本（本轮 2 次 468/5675，`rev-root-test{-2nd}.log`，run2 首部 revised sha + HEAD 备案） | 设计 §12 行 9 仍单次 | F-1 清单第 10 项 |
| 归属敏感性 | EV-4：M1=5/9、M2=4/9 红（日志复验） | 设计「敏感性维持」行只列 M1/M2 | 补 M3（同下） |
| 字节事实敏感性 | EV-5：M3 ≥3/9 红且含 ORDER-C1（实测 3/9；rev1 边界对照 2/9——不得回退边界，`rev-M3-boundary-compare.log` 复验） | 设计无 M3 面 | F-1 清单第 8 项 |
| RNG 根因回归 | EV-6：`clientid-probe.mjs` + ≥200 轮真 boot（本轮 240 轮，1:1 零反例） | 设计无对应行 | 同上 |
| 不变量 | EV-7：src 恒空 + 两契约 sha + HEAD | 设计有 src 恒空门、无 sha 门 | F-1 清单第 7 项 |
| 设计/规范收口 | EV-8：SA1 修订 §7-D1/§11/§12 口径；SA8 复查 | **未执行**——且 EV-8/§15 B-1 的枚举（§7-D1、§11 DENY、§12 AC4-a 三处）**不完整**：漏 §15 requiresConflictRecheck 翻转、§13 R-2 重写、§2-A8/A9、§5、§14/头部输入登记、§1 非目标理由、D2 已落地态登记（完整清单见 F-1；逐字执行 EV-8 三处会留下 §15=false 与 R-2 假前提存活） | F-1 + F-2 |
| 测试落点 | 两契约文件在 `packages/ws-replication/test/`，被包/根门禁真实发现（日志逐文件列出复验） | 无 | — |

## 13. Required revisions

| Finding ID | Severity | Evidence | Problem | Required change | Acceptance |
|---|---|---|---|---|---|
| **F-1** | **BLOCKER** | 设计 mtime 20:56 / iteration 0 原文；定向 grep 证实 `:3/:28/:46/:124/:231/:247/:268/:282/:288` 全为 rev1 口径、零处提及 rev2/clientID/M3；SA6 rev2 §15 B-1 + §12.5 EV-8 明列设计修订为必改项；SA3 §7.5 同判 | **SA1 设计修订缺席**：设计核心裁定 D1 的「确定性已证」前提已被证伪，DENY 理由、R-2、§12 证据列、§14 输入登记、§15 `requiresConflictRecheck=false` 与已批准 rev2 契约及 worktree 现状（契约已演进、D2 已落地、rev2 证据族在位）系统性矛盾。按现文实施会把 rev2 契约文件误判为 DENY 违约产物、把未来 ORDER-C1 真红误导为「抽样/环境问题」（ER-2）、并误导 Controller 跳过已触发的 SA8 复查 | SA1 原位修订设计，**最小完备清单**（12 项）：① 头部/§14 重登记输入（SA2 评审、SA8 冲突报告、SA3 reject、SA6 **rev2** 在案）；② §2-A8 更新为 432 行 / 9 用例 / sha `4a8556bb…`，证据改指 rev2 族；③ §2-A9 补 rev2 证据族与 `clientid-probe.mjs`；④ §3 G3 行补契约缺陷闭合（调度不变量投影 + 单轮自证）；⑤ §5 重接 SA6 rev2 §8.2 根因链（S1–S7/R1–R3/U1）与 E8–E13 为上游事实；⑥ §7-D1 重锚：冻结基线 = rev2 内容（含 sha），记录 rev1→rev2 修订史与授权链（SA8 §10 条件 2 → SA6 裁定 → 复查触发），敏感性依据改 M1/M2/M3 三路；⑦ §11 DENY 该行重写（钉 rev2 sha；修订例外仅此一次且已完成）；⑧ §12 AC1-c 期望改「调度不变量投影逐字相同 + 每轮 bytes 单轮自证」、AC4 证据改指 `rev-*` 族、「敏感性维持」行补 M3=3/9（含 ORDER-C1）与 EV-5「不得回退边界」；⑨ §13 R-2 重写（结构性移除 RNG 派生量 + 40/40 + 240 轮探针为确定性依据；再红 = 阻塞上报）；⑩ §12 AC4-c 采纳 EV-3 ≥2 次独立根测试样本；⑪ §7-D2/§3 改为已落地态（`AGENTS.md:18`，含 N-2/N-3 润色版文案）；⑫ §1 非目标第 2 条理由同步（rev2 已批准 + 40/40 + M1/M2/M3） | 修订后设计全文无任何与 rev2 契约/sha/证据族相矛盾的陈述；§15 与 SA3/SA6 的 `requiresConflictRecheck: true` 对齐（或给出经 SA8 复查确认的取代理由）；D1/DENY 以 sha 锚定 rev2；F-1 清单 12 项逐项可勾 |
| **F-2** | MAJOR | SA6 rev2 §15 B-1 与 §12.5 EV-8 的修订枚举仅列「§7-D1、§11 DENY、§12 AC4-a」三处 | **修订范围欠枚举**：SA1 若逐字执行该清单，§15 `= false`、§13 R-2 假前提、§2-A8/A9、§5、§14 等失配将存活——设计仍不能安全实施（F-1 的部分执行形态） | 二选一（任一即闭合）：SA1 按 F-1 的 12 项完备清单执行（推荐，SA6 文本可不改）；或 SA6 在 EV-8/B-1 补全枚举。本评审的 F-1 清单即为完备参照 | 设计修订完成后，以 §6 失配表 C-1..C-8 逐项对照为零命中 |
| N-1（承 iteration 0） | MINOR | 设计 §2-A3「`HubAsyncSessionHandle`（5 成员）」；实际 6 成员（`hub-session-async-host.ts:66-79`），#447 test-d 注释「六成员」 | 计数笔误，无断言依赖（SURFACE 冻结对象是 `HubAsyncSessionHost` 的 keyof） | 随 F-1 修订顺带改「6 成员」或删计数 | 锚点表与 HEAD 一致 |

## 14. Non-blocking observations

| ID | 位置 | 观察 | 建议 | 接受条件 |
|---|---|---|---|---|
| N-2' | SA6 rev2 §5.2/§10 行锚 | 引文行锚有 1–2 行漂移（ORDER-C1 自证实际 `:372-389`，报告记 `:379-388`；`emitUpdateSentAtStamp` 实际 `:869-886`，§10 记 `:869-885`） | 无需改报告（锚块定位无歧义）；设计修订引用时以本评审复验行为准 | 行锚指向正确代码块 |
| N-3' | SA6 rev2 §7/E9 | 「240 轮 … 238 对」的配对口径未定义（239 相邻对或 120 A/B 对均非 238）；概率数字为 200k 经验抽样（P4=0.061595 vs 精确 0.061996 等），相互差 <1 se | 可在报告加半句配对口径；非阻断（22/238 与理论率在二项噪声内，0 反例是判据主体） | 数字自洽即可 |
| N-4' | 设计 §12 AC3 | issue422 两文件不在命名集的 R-3 登记（iteration 0 已核）继续有效 | 维持 | — |
| N-5' | anchor 契约文件头注释 `:113` | 「实测 120 轮」引 `clientid-probe.log`（probe1），而决定性证据为 240 轮（probe2） | 可选把注释指向 probe2；两探针结论一致，非阻断 | 注释与所引日志一致即可 |

## 15. 附注

- **iteration-0 finding 处置**：N-2（D2 回执触发语义过宽）与 N-3（edge 观测面补拒绝路径事件）**已解决**——SA3 已按 SA2 建议形态落笔于 `AGENTS.md:18`（「an ACK referencing a sequence whose receipt has not been registered fails loudly … (`ACK_STATE_VIOLATION` 1002; … §24.2.6)」＋ `namespace-error{direction:'sent'}` / `namespace-failed{cause:'open-failed'}` edge 括注），本评审对照协议 §23.1/§24.2.6 原文核验语义精确；按纪律从当前阻断面移除。N-1 保留（§13 表尾）。
- **requiresConflictRecheck = false（本评审）**：本轮 finding（设计文本滞后 + SA6 修订枚举不全）不引入新的 ADR 冲突面——零生产/wire/schema/API/状态机语义变化，契约修订本身的冲突复查已由 SA3 §7.5 / SA6 rev2 §15 触发（SA8 §10 条件 2），该复查应执行完毕；SA2 无新增触发理由。F-1 修订完成后设计 §15 应与该已触发的复查状态对齐。
- 本评审未修改任何设计、生产代码、测试或 SA6/SA3/SA8 产物；唯一写入为本文件（原位更新）。
- `approve/reject` 仅约束设计面；实现与活链路验证仍归 SA4/SA7。SA6 rev2 契约本体经核验可执行、证据充分；待 F-1/F-2 闭合后本票可恢复实施路径。
