# SA9 标准评审 — issue #449（γ-T3）：reconcile 与分块 transfer 跨缝（verification-only 契约落盘）

- Dispatch：`sa-0e89226b-fc83-490e-9714-ba9cb0bc3bbc`（mabf-sa9 / standards-review / iteration 0）
- 评审对象：branch `mabf/issue-449` 的最终提交 diff——commit `d166fd298b8272ea55b1c7b06ec42eb8f328a309`（`test(ws-replication): cover gamma reconcile chunk transfer`），父 = `444c1665fdb35b618bbb378a5b6bcefacfd288a7`（= 派工声明的 Parent PR #446 权威头，`git log`/`git diff` 实查解析一致、为 HEAD~1）
- 评审方式：独立只读静态复核。SA9 实读任务简报、设计、SA6 契约、SA3 实现记录、SA4 评审、SA8 实现冲突报告全文，逐行读回提交内的全部代码改动（契约测试 1129 行 / 恰 14 `it(`），抽核规范原文（协议 §24.1–§24.8 :1091-1154、ADR 0032 附录 A4.1–A4.8 :55-99、模块 `AGENTS.md`、根 `vitest.config.ts`）、生产锚点源码（round-engine/update-channel/bulk-transfer/hub-session-async-host/validate/defaults）、仓库惯例（命名/超时/变异先例/artifacts 入库/提交信息格式）与 git 事实（diff 清单、文件模式、whitespace gate、scope diff）。未运行测试、未启动服务、未修改任何文件。
- Owner 评论：派工明示 REST 读取为空数组 + 简报 `## Comments` 空——无可映射的 owner 追加要求。

---

## 1. Verdict

**`approve`**（0 BLOCKER / 0 MAJOR；3 条 MINOR 见 §9，均不阻断）。

提交为纯增量（6 个新增文件 / 2213 insertions / 0 deletions / 0 modifications），严格落在批准设计 §11 ALLOW LIST 内，DENY 面零触碰；verification-only 裁定（零生产实现面）经 SA9 独立抽核与仓库事实无矛盾；测试质量、单一事实源、生命周期对称性、架构惯例各项标准逐项满足（§3–§8）。

---

## 2. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-449.md`（简报：Issue 正文 6 AC + `Blocked by #448` + Parent PR #446；Comments 空） | 在场（untracked，见 §9-M3），全文已读 |
| `wiki/raw/task_issue-449_design.md`（SA1；§0/§7-D1 verification-only、§7-D2 新著交付物、§7-D3 dormant 登记、§7-D4 编排裁定、§7-D5 夹具冻结、§7-D6 验证门、§11 ALLOW-DENY） | 在场（提交内），全文已读 |
| `wiki/raw/task_issue-449_sa6_contract.md`（SA6；`approve`；反向诊断 + §12.3 十五条目矩阵 + NC1–NC8） | 在场（提交内），全文已读 |
| `wiki/raw/task_issue-449_sa3_impl.md`（SA3；条目→用例映射 + 验证门 + D1–D7 偏差登记） | 在场（提交内），全文已读 |
| `wiki/raw/task_issue-449_sa4_review.md`（SA4；`approve`，0B/0M，O-1/O-2） | 在场（提交内），全文已读 |
| `wiki/raw/task_issue-449_implementation_conflict_report.md`（SA8 实现后 `clear`、`requiresConflictRecheck: false`） | 在场（提交内），全文已读 |
| `wiki/raw/task_issue-449_sa2_review.md` / SA8 设计阶段产物（`relevant_decisions`/`design_conflict_report`） | **不存在**（iteration 0；设计 §6/§14 已登记同款事实并以规范权威原文替代，非阻塞） |
| 提交内代码面：`packages/ws-replication/test/ws-replication-issue449-gamma-reconcile-chunked.test.ts`（1129 行 / 14 用例 / 五族） | 逐行读回 |
| 证据日志 ×14（worktree untracked：`artifacts/sa3-issue449-*.log` ×9、`sa6-issue449-*.log` ×5） | 尾部与关键数字读回，自洽（见 §8） |
| 规范原文：`docs/protocols/instance-replication-v1.md` §24 全节、`docs/adr/0032-…md` A4 全条、`packages/ws-replication/AGENTS.md`、根 `AGENTS.md`、根 `vitest.config.ts`、包 `tsconfig.json` | 实读对照 |

---

## 3. 仓库 AGENTS 与模块责任

| 标准 | 证据 | 判定 |
|---|---|---|
| 根 AGENTS「改动前读最近嵌套 AGENTS.md」 | `packages/ws-replication/AGENTS.md`（Boundary/Verification 段）经各上游阶段与本评审实读；设计 §6 约束表逐条落实 | **符合** |
| 模块 Boundary：γ 缝 append-only、β 同步冻结逐字不动、缝词汇闭集合无拒纳/闸门/信用词汇 | 提交对 `packages/ws-replication/src/**` **零 diff**（`git diff 444c1665..HEAD --name-status` 全文件清单实查：6 项全为 `A`）；缝词汇零新增——测试仅消费既有夹具 API（`withholdEdgeToSession`/`release`/`setHeld`/`setDropPredicate`/`reorderNext`/`dropReceipts`/`probes.*`，fixture :141-321/:600-616 实读全部既有导出） | **符合** |
| 模块 Boundary：生产 API 经 `src/index.ts`；测试控制在显式测试面 | 新文件在 `packages/ws-replication/test/`；生产导出面零触碰 | **符合** |
| 模块 Verification 门：状态机路径改动跑聚焦测试；缝变更加跑拆分契约/parity；wire/生命周期变更加跑根门禁 | 本票零生产/零 wire/零生命周期改动 ⇒ 根门禁触发条件不满足；设计 §7-D6 仍指定并已执行包级门：契约单文件 14/14 ×3、γ 五文件 57/57、包全量 102 文件/911 用例、包 tsc exit 0——**超出 test-only 改动的最低要求**；根 `pnpm test`/`pnpm typecheck` 显式登记 defer 至 CI 与 #451（设计 §7-D6 末段、SA3 Deferred verification 表） | **符合**（deferral 已登记，见 §9-M3 旁注） |
| 根 AGENTS Typed Namespace writes 强制条款 | 不适用——本票零 Namespace 写路径代码；测试经既有 driver 的 `writeHub` 业务写驱动，不触碰 `mutateData`/schema 投影面 | **N/A** |
| 根 AGENTS worktree 纪律（仓库本地 `.worktrees/`） | worktree gitdir = `/home/wangjian/nomicore/.git/worktrees/nomicore-fix-issue-449`（`.git` 指针实读） | **符合** |
| docs/AGENTS「wiki/raw 历史工件是证据而非规范」 | 提交内 5 份 wiki 文档均为流水线证据工件；规范文本（ADR/协议/CONTEXT/AGENTS）零 diff——零语义变化 ⇒ 无文档同步义务（设计 §11 DENY 同向） | **符合** |
| 责任归属：测试只编排/观测，零协议决策、不替产线修任何面 | 测试全文实读：仅 boot adopt 装配 + 前提断言（registry 同一性 :139-142、连接数恰 1 :143-145）+ 缝编排（扣留/放行/丢弃/reorder）+ 运行时观测（wire 帧/回执/事件/文档快照）；不合成应答帧、不选错误码、不复制状态机；dormant 裁定（§7-D3）落实为 DRAIN3-D1 诊断条目，未使触发点③承重、未删除 | **符合** |

---

## 4. ADR 与规范一致性

| 规范条款 | 提交落点 | SA9 抽核 |
|---|---|---|
| ADR 0032 附录 A4 / 协议 §24 是被锚定的权威，非被修订对象 | `docs/**` 零 diff | **符合**——零语义变化 ⇒ 无文档同步义务 |
| §24.2.3 / A4.2 保序条款（回执恒先于引用该序的 ACK；违契响亮） | ANCHOR3-C1 消费序 strict 先行断言（:605-619）；ROUND3-C3 `reorderNext` 注入 ⇒ `SYNC_STATE_VIOLATION` + `failed` + 消费序 ACK 先于锚回执证据（:495-521）；ANCHOR3-N1 丢回执 ⇒ `connection-fatal{ACK_STATE_VIOLATION}` + ERROR（:647-652） | **符合**（协议 :1103/:1106 实读逐句对上） |
| §24.4 / A4.2 两相记账与三值锚（未发/pending/已盖章；idle∨pending 同构响亮） | ROUND3-C2 锚真 `pending(tag)` 面（丢弃 STEP1 回执 ⇒ 响亮 + dropped 集事实 + 引用帧过缝反假绿 :412-437）；ROUND3-C3/ANCHOR3-N1 锚分块 idle 面；生产锚点实读一致（`round-engine.ts:135-145` `anchorOf`/`anchorSequenceOf`） | **符合**（:1124-1128 实读一致；SA3-D5 措辞精确化经 SA8 §3-行 8 裁为 no-conflict，判别语义不变） |
| §24.5 / A4.3 无「洞中 transfer」：连接死亡 ⇒ 通道 quiesce 整体 abort | ABORT3-C1/C2 死后缝出站/wire/sessionToEdge 三面零增长、零 settled、`unsealed === 0`、零 chunked 事件、非 live（:900-944）；ABORT3-C3 重连新作用域 `transferId === 1` ∧ chunkIndex 从 0 严格递增 ∧ 旧 transfer 零续传（:977-999）；ABORT3-N1 存活对照证明断言非空 | **符合**（:1138 实读一致） |
| §24.6 / A4.4 自驱 drain 三触发点；推完即停、禁 busy loop | DRAIN3-C1 末回执结算后零新增 data 帧、`scheduler.pending()` 不增、零 acked；ACK 放行 ⇒ 第 2 笔恰一次（:1050-1067）；DRAIN3-D1 隔离变异轨迹逐值不变（dormant 诚实登记）+ 生效计数 > 0 + `finally` 恢复；生产触发点③在场实读（`hub-session-async-host.ts` `handleReceipt`：`settledTransferLastChunk === true ⇒ selfDrain()`） | **符合**（:1143 实读一致；未触碰 §24.4 占用守恒——承重化属另票 amendment，设计 §13-R8 登记） |
| §24.8 / A4.7 观测口径：chunked 族事件在 session 回执/结算点；`ackLatencyMs` t0 = 推送时刻；跨线程事件无全序 | 全部顺序断言仅在单通道 `delivered()` 消费序上（零跨线程事件序断言）；`not.toHaveProperty('sequence')` 键集冻结锚定（:377/:745）；`ackLatencyMs = k + m`：kind=1（ANCHOR3-C1 :600）、kind=0（CHUNK3-C0 :746）；kind=2 面缺口见 §9-M1 | **符合**（:1149-1153 实读一致；M1 为 MINOR） |
| A4.8 验收纪律：延迟可注入显式异步内存管道、零 worker_threads；成功路径与 β wire 逐字节等价 | grep 实查零 `worker_threads/MessageChannel/setTimeout/setInterval/Date.now/Math.random/process.env`；CHUNK3-P1（T3 多 chunk 构型）：β 前置断言 `UPDATE_CHUNK ≥ 2` 防平凡 parity（:843-846）+ 控制帧逐字节 + 全轨迹骨架（含 UPDATE_CHUNK 帧型/帧序）+ 数据帧文档语义 + NC-1 内容变异必报差异（:868-879） | **符合**（ADR :97-99 实读一致；β 参照载体选择经 SA8 §3-行 11 裁为 #447 既定先例、A4.8 实质零削弱） |
| 配置链校验门（§17 / validate.ts） | 五组构型常量（:55-91）逐一推演过门：`maxChunksPerUpdate` 缺省 64（`defaults.ts:30` 实读）⇒ 64≤64×1、1024≤64×64、1024≤64×16、4096≤64×64 全部满足（`validate.ts:238-262` 链式校验实读） | **符合**（设计 §13-R6 落实） |

---

## 5. 既有架构惯例

| 惯例 | 证据 | 判定 |
|---|---|---|
| 测试命名 `ws-replication-issueNNN-*.test.ts` | `ws-replication-issue449-gamma-reconcile-chunked.test.ts` 与 issue447 三件套/issue448 同款成排 | **符合** |
| describe 题名 `issue #NNN 族 — …` / 用例标题携条目 ID 与 AC 锚 | 与 #448 `LIVE-WINDOW/LIVE-ORD/…` 同款（五族 ROUND3/ANCHOR3/CHUNK3/ABORT3/DRAIN3） | **符合** |
| 显式用例超时 30s/60s | 14/14 用例携带（13× `30_000` + DRAIN3-D1 `60_000`）；#447/#448 套件 15/13 处同款 | **符合** |
| 变异敏感性负控形态（`await import('../src/*.js')` prototype 注入 + `finally` 恢复） | DRAIN3-D1（:1101-1127）与 #447 :443/:719、#448 :140/:308 同款先例；进程内单测 + 根 `maxWorkers: 1` 串行 ⇒ 无跨文件污染面 | **符合** |
| `run.hubNode.scheduler.pending()` / `probes.sessions` 观测面 | #448 :554/:560 同款；`probes.sessions` fixture :275/:368/:472 实读在场 | **符合** |
| 文件内局部 boot（`waitFor:'none'` + `random: () => 0.5` 钉死 + registry 同一性/唯一连接键前提断言） | `bootGamma`（:119-166）= #447 `bootAsyncRound` 先例同款（设计 §7-D5 指定）；夹具/既有测试/助手全部零 diff | **符合** |
| `artifacts/` 证据日志入库 | 仓库已跟踪 447/448 票日志（`artifacts/sa3-issue447-*.log`、`sa6-issue448-*.log` 等，`git ls-files` 实查）；本票 14 份日志在场但未入库——见 §9-M3 | **部分**（MINOR） |
| 提交信息格式 | `test(ws-replication): cover gamma reconcile chunk transfer`——conventional 格式与历史同款 | **符合** |
| 验证环境开关 | 仅 `NODE_OPTIONS=--conditions=nomicore-source`（仓库既有测试脚本同款条件导出，非伪造开关） | **符合** |

---

## 6. 单一事实源与生命周期对称性

**单一事实源**（测试只回读权威事实，不镜像、不推导）：

| Fact | Authoritative source | 测试读法 | 判定 |
|---|---|---|---|
| tag↔wire 序配对 | edge 盖章事实（`probes.stamps`/`probes.outbound`） | `stampOfSequence`/`tagOfOutboundKind` 只读查询（:179-188） | **无第二事实源** |
| 消费序 | `edgeToSession.delivered()`（夹具投递记录） | 下标 strict 先行/先后断言 | **无** |
| 违契注入事实 | `dropped()`/`setDropPredicate` | ROUND3-C2 ①断言回读 | **无** |
| wire 序字节 | 帧字节 `[8..12)` big-endian（§3） | `rawSequenceOf`（:170-172）与 CHUNK3-C1 逐 chunk 原字节核对（:785-797） | **无** |
| 窗口/槽位占用 | 生产账本（不镜像） | 外部观察（过缝帧数/事件数恰 N、第 2 笔是否过缝） | **无** |

**生命周期对称性**：

| Acquire | Release | 判定 |
|---|---|---|
| DRAIN3-D1 变异 prototype 注入 | `finally` 恢复原引用（:1121-1127 实读）+ 生效计数 > 0（证明隔离确被行使） | **对称** |
| SA3 阶段 4 个生产树变异（M1–M4） | 逐例 `git checkout --` 恢复 + `git diff --quiet` 复核；`-mutation-summary.log` 尾部「生产树恢复干净」读回一致 | **对称**（提交内生产面零 diff 为终证） |
| 每用例 `bootGamma` 独立装配（registry/scheduler/wire/缝通道全内存） | 无显式 teardown——与 #447/#448 套件同款先例；进程内内存管道 + fake scheduler，进程结束即回收 | **可接受**（既有惯例维持） |
| 生产生命周期 | 零生产改动 ⇒ 零影响 | **N/A** |

---

## 7. 文件范围

提交全文件清单（`git diff 444c1665..HEAD --name-status` / `git show d166fd2 --stat --raw` 实查）对照设计 §11：

| 提交内路径 | ALLOW/DENY 对照 | 判定 |
|---|---|---|
| `packages/ws-replication/test/ws-replication-issue449-gamma-reconcile-chunked.test.ts`（新增 1129 行） | ALLOW 第 1 项（本票唯一可执行交付物） | **合规** |
| `wiki/raw/task_issue-449_design.md`（新增 353 行） | ALLOW 第 4 项 | **合规** |
| `wiki/raw/task_issue-449_{sa6_contract,sa3_impl,sa4_review,implementation_conflict_report}.md`（新增 ×4） | §11 末段注记（下游流水线产物各自 dispatch 授权） | **合规** |
| DENY 面：`packages/ws-replication/src/**`、夹具 `issue447-async-seam.ts`/`issue448-live-seam.ts`/`harness.ts`/`driver.ts`、既有 `*.test.ts`/`*.test-d.ts`、`docs/**`、`CONTEXT.md`、模块/根 `AGENTS.md`、`packages/replication-protocol/**`、根 `vitest.config.ts`/`tsconfig*.json`/`package.json`、`pnpm-lock.yaml`、#450/#451 范围面 | 提交清单逐项核对：**0 deletions、0 modifications**；`ABORT3` 编排仅用 `closePeerSide(1006)` 异常断链 + 重连新作用域（未触 revoke/close 冲刷/1011/`update-sent` 归属面） | **全部零 diff，无越界、无未列改动、无临时/_scratch 文件混入** |
| 文件模式 | `git show --raw`：新增全部 `100644` | **合规** |
| 白空格门禁 | `git show d166fd2 --check` **exit 0** | **合规** |

---

## 8. 测试质量标准

| 标准 | SA9 实查 | 判定 |
|---|---|---|
| 零 `skip/only/todo`、零 `process.env`、零真实 timer/网络/wall-clock/worker_threads | grep 实查全部无命中；时源为注入式 `hubClock` + `makeManualClock` 面（非全局 fake timer） | **符合** |
| 断言 = 运行时行为（非源码 grep 式） | 14 用例逐条实读：wire 帧 kind/序、`[8..12)` 原字节配对、`ackedSequence` 回指、缝消费序下标、observer 单事件字段值、文档快照逐值、信号面（fatal/settled） | **符合** |
| 断言非恒真（负控/变异有牙） | 文件内负控：ROUND3-C2/C3（违契注入 ⇒ 响亮 + dropped/消费序反假绿）、ANCHOR3-N1、CHUNK3-P1 NC-1 内容变异必报差异、ABORT3-N1 存活对照、DRAIN3-D1 生效计数 > 0；生产变异 M1–M4 逐例被目标用例检出（`-mutation-summary.log`：4× exit=1 + 恢复干净） | **符合** |
| 反假绿编排纪律 | 交换点/缓冲头在场断言逐字落地（ROUND3-C3 :484-492 含回指序校验、ANCHOR3-C1 :569-573/:584-590、CHUNK3-C0 :717-723）；编排漂移即红（设计 §7-D4/§13-R1 落实） | **符合** |
| 契约条目覆盖 | SA6 §12.3 十五条目 → 14 用例；`CHUNK3-C2` 并入 `ROUND3-C1` 为设计 §7-D2 明文允许的同构合并（用例标题显式并列双 ID :316，判据逐条按矩阵、未合并削弱）；SA3 映射表逐条可对到行号 | **符合**（一处判据代换见 §9-M1） |
| 测试入口真实 | 根 `vitest.config.ts:15` `include = ['packages/*/test/**/*.test.ts', …]` 逐字命中；包 `tsconfig.json` `include` 含 `test/**/*.ts` ⇒ tsc 门覆盖新文件；包全量日志实列 102 文件（= 101 基线 + 本文件，数字自洽） | **符合** |
| 证据链诚实 | 契约在 baseline 即绿——**不伪称红灯**；历史红依据（pre-T1 `c86ccbc` 零 γ 公共面/夹具）为 git 级事实（设计 §2 复跑双零）；日志读回自洽：单文件 14/14 ×3（stability-3x 三段输出）、γ 五文件 57/57（= 43 基线 + 14 新增）、包 102/911、`Type Errors no errors`（package-suite 含 `typecheck 2.42s` 时长）、tsc exit 0 | **符合**（日志未入库见 §9-M3） |
| 确定性/无竞态 | 显式 `release`/扣留/丢弃/reorder + 手动时源 + 有界微任务泵（`pumpUntil`/`microPump`/`settle`）；`microPump` 的 catch 仅吸收自调 `settleUntil(预算耗尽)`（`harness.ts:257-268` 实读唯一 throw 形态），非吞断言 | **符合** |
| 断言诊断信息 | 每条 `expect` 携中文判据说明（条目锚 + 预期语义 + 实际值描述） | **良好实践** |

---

## 9. Findings（全部 MINOR，不阻断）

- **M1（MINOR，判据代换未宣告 + 注释/断言不符）**：SA6 §12.3 `ROUND3-C1` 判据含「`ackLatencyMs` 在场」，新文件未在 kind=2 族任何用例断言该字段（ROUND3-C1/DRAIN3-C1 均未注入 `hubClock`）；且测试 :369 行内注释自称「ackLatencyMs 在场（clock 面）」而实际断言语句不含该字段——注释与断言不符。SA3 映射表以「字节字段在场」代换契约判据且未在映射表宣告（仅在 SA4 评审 O-1 被点出）。缓解事实：t0 = 推送时刻语义已由 kind=1（ANCHOR3-C1 `k+m` 算术 + 既有 #447 CHUNK-C3 含变异负控）与 kind=0（CHUNK3-C0 `k+m`）锚定，kind=2 事件发射点为同一结算回调形态（SA4 §12-O-1 实读论证），实际覆盖缺口小。建议后续以一行补强（kind=2 用例注入 `hubClock` 断言 `ackLatencyMs = k+m` 或其在场）并修正行内注释。Routing 建议：implementation（follow-up 性质，不阻断本票验收）。
- **M2（MINOR，死观察变量）**：`ABORT3-C1` :893 采样 `timers: round.run.hubNode.scheduler.pending()` 但用例未对其断言（计时器面断言由 DRAIN3-C1 承载）。无判力影响，建议清理或补一条不增断言。
- **M3（MINOR，证据/简报未入库的流水线漂移）**：本票 14 份证据日志（`artifacts/sa3-issue449-*.log` ×9、`sa6-issue449-*.log` ×5）与任务简报（`wiki/raw/task_issue-449.md`）在 worktree 在场但**未随提交入库**（untracked）；提交内的设计/SA6/SA3/SA4/SA8 文档引用了这些路径 ⇒ 提交态树内引用悬空。#448 先例（提交 `0c92b3e`）将简报与证据日志随交付提交一并入库，且其 SA9/SA10 复审文档由后续 docs 提交补齐（`40f1b85`）——同一收尾机制适用于本票。设计 §11 将新日志标为「可选」、简报为 Host 工件，故不构成文件范围违规；登记以便收尾方一并提交，消除悬空引用。

（登记而非 finding：SA4 §12 观察①——SA6 契约 §2/§6-NC7 出现的「ANCHOR3-C2/N2」标签为契约早期草稿残留，权威清单 §12.3/§12.4 不含之，交付物覆盖权威映射即满足 AC2；SA4 §12 观察②——`sa3-issue449-package-tsc.log` 为空文件，单独不足以证明 exit 0，已由两份套件日志的 vitest typecheck「Type Errors no errors」+ 包 tsconfig 覆盖 `test/**` 构成充分旁证。）

---

## 10. 结论

- 提交 `d166fd2` 在仓库 AGENTS/模块规约、ADR 0032 附录 A4 与协议 §24、单一事实源、生命周期对称性、文件范围（ALLOW 全命中 / DENY 零触碰）、测试质量（行为断言、负控/变异有牙、反假绿编排、入口真实、证据诚实自洽）各维度**全部符合标准**。
- 与上游链条（SA6 `approve`、SA8 实现后 `clear`、SA4 `approve`）一致；SA9 独立抽核未发现与仓库事实的矛盾。三条 MINOR 均为 follow-up/收尾性质，不阻断。
- **Verdict：`approve`**；`requiresConflictRecheck: false`（零生产语义变化、零规范/夹具 diff、无新增协议决策——与 SA8 实现后门禁同向）。
