# SA4 实现静态评审 — issue #448（γ-T2）：γ 异步缝 live update 数据面（verification-only 契约落盘）

- Dispatch：`sa-ba0ba2ef-dd90-4df4-af29-edb6d2b9c04b`（mabf-sa4 / implementation-review / iteration 0）
- 评审对象：本 worktree 当前实现态（SA6 契约工件 + SA3 落盘/守门结果），对照批准设计 `wiki/raw/task_issue-448_design.md` 与验收契约 `wiki/raw/task_issue-448_sa6_contract.md`
- 评审方式：静态审查（源码/测试/夹具/证据日志/git 只读实查；逐行读回契约 686 行全文、夹具 133 行全文、`issue447-async-seam.ts` diff 与关键装配段、生产锚点源码、根/包 runner 配置、5 份证据日志）。**未运行测试、未启动服务、未修改任何实现/设计/测试文件**。
- 基线实查：HEAD `321d951`（`Merge pull request #453`）、branch `mabf/issue-448`、`52e634b`（T1）/`c86ccbc`（spec）在 log 中可见——与设计/SA6/SA8/SA3 各方声明一致。

---

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-448.md`（任务简报：Issue 正文 6 AC + `Blocked by #447` + Parent PR #446；Comments 空） | 在场，已读 |
| `wiki/raw/task_issue-448_design.md`（SA1 设计，318 行；§7-D1 verification-only 裁定 / §7-D2 契约落盘 / §7-D3 夹具 append-only / §7-D5 验证门 / §11 ALLOW-DENY） | 在场，全文已读 |
| `wiki/raw/task_issue-448_sa2_review.md`（SA2 设计评审 `approve`；O1 类型门证据 / O2 措辞 / O3 权限 / O4 登记缺面） | 在场，全文已读 |
| `wiki/raw/task_issue-448_sa6_contract.md`（SA6 反向诊断 + 13 条锚契约，`approve`） | 在场，全文已读 |
| `wiki/raw/task_issue-448_design_conflict_report.md`（SA8 设计后复审 `clear`；§8-R1 落盘期复核义务） | 在场，全文已读 |
| `wiki/raw/task_issue-448_sa3_impl.md`（SA3 实现报告：落盘/守门 + V0–V4 证据） | 在场，全文已读 |
| 契约工件本体：`ws-replication-issue448-live-data-plane.test.ts`（686 行，实数恰 13 个 `it(`）、`issue448-live-seam.ts`（133 行）、`issue447-async-seam.ts`（diff `+10/-0`） | 全文逐行已读 |
| 证据日志 ×5（`artifacts/sa6-issue448-contract-run.log` 53 行 / `-repeat5.log` 145 行 / `-package-suite.log` 494 行 / `-package-suite-precontract.log` 249 行 / `-package-tsc.log` 8 行） | 全部已读，数字自洽性核验 |
| 生产锚点源码（`update-channel.ts`、`hub-session-async-host.ts`、`hub-namespace.ts`、`hub-edge.ts` 关键段）、根 `vitest.config.ts`、包 `tsconfig.json`、`tsconfig.base.json`、`packages/ws-replication/AGENTS.md` | 实读 |
| `wiki/raw/task_issue-447_design.md`（前序票，引用链核对） | 在场（经设计/SA2/SA8 引用链；本评审抽核 D4/D6 相关节） |
| Owner comments | 简报 `## Comments` 空 + 派工明示 REST 读取为空数组 ⇒ 无 owner 评论要求可映射（双确认，与 SA2/SA6/SA8/SA3 一致） |
| #448 的 SA8 task 门产物（`relevant_decisions`/`conflict_report`） | 确认缺席（与设计 §6 声明一致；SA8 设计后复审在场替代） |
| `wiki/raw/task_issue-448_sa4_review.md`（本产物前版） | 不存在（本次新建） |

---

## 2. Verdict

**`approve`**

无 BLOCKER、无 MAJOR。verification-only 裁定下的实现态（契约工件原样落盘 + 夹具 append-only + 证据追加）与批准设计、SA6 契约、SA2 Required revisions（为空）、SA8 §8-R1 落盘期义务逐项吻合；文件范围严格落在 ALLOW LIST 内，DENY 面零 diff；13 条锚全部为真实运行时行为断言且判据口径未被削弱；证据日志内部数字自洽（884+13=897、100+1=101、30+13=43）。5 条非阻塞观察见 §12。

---

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| Issue AC1 data 面 pending/receipt 全链；在途记账精确（无伪造序号、无 pending 泄漏） | LIVE-WINDOW-C1/C2（`:68-137`）：`maxInFlightUpdates=2` 扣留下写 ×3 → 恰 2 帧过缝；`receipt.sequence ≡ 盖章序`逐序配对（`:99-112`）；第 4 笔全结算后直推（`:134-137` = 无泄漏锚） | **满足**（锚为可执行形态；生产锚点 `update-channel.ts:135-138/:169-173/:198-209` SA4 实读一致） |
| AC2 pending 计入 `maxInFlightUpdates`；乐观发送不击穿上界（延迟注入锚） | LIVE-WINDOW-C1/C2（回执 rekey 不释放槽 `:114-119`；ACK 后第 3 帧 `:121-131`）+ LIVE-WINDOW-C3 变异负控（`:139-171`：占用判据去 `pendingSends` ⇒ 断言第 3 帧必越界，`finally` 恢复） | **满足**；变异负控对 γ 直发判据（`deliver` live 分支实读确以 `effectiveInFlightCount` 为窗口判据）真实敏感 |
| AC3 保序锚 + `onAck` 三类判别与单体同构 | LIVE-ORD-C1（`:177-227`：`delivered()` 消费序 receiptIndex < ackIndex）、LIVE-ORD-C2（乱序注入 ⇒ 响亮 `ACK_STATE_VIOLATION`）、LIVE-ACK-C2（violation）/C3（zombie 良性 + `RESYNC_REQUIRED` 恰一次）；三类判别锚定 `update-channel.ts:287-323` 单份 `onAck`（SA4 实读：ok/zombie/violation 三分支与合并占用拆除判据在场） | **满足**；「与单体同构」由单份实现结构性成立（γ/α/β 共享同一函数，`pendingSends` 为无条件私有字段） |
| AC4 自驱 drain 两触发点；无 busy loop | 入队触发 = LIVE-DRAIN-C1（`:463-542` kind=0 transfer 逐 chunk 过缝占 1 槽）+ LIVE-WINDOW-C1 第 3 帧（ACK 触发）；LIVE-DRAIN-C2（`:544-574`：`advanceBy(100)` 零新帧、`scheduler.pending()` 不增、重复泵零越界、结算后额外泵零新增） | **满足**；第三触发点（末 chunk 回执）在 LIVE-DRAIN-C1 结算续推段一并覆盖，全回合编排显式归 #449（边界登记一致） |
| AC5 `update-acked` 发射点 + `ackLatencyMs` t0 = §24.8 | LIVE-ACK-C1（`:271-305`：k=7/m=5 ⇒ `ackLatencyMs = 12`）+ 变异负控（`:307-362`：rekey 重采样 ⇒ `= m` 必红，`finally` 恢复）+ LIVE-OBS-C1（`:364-396`：`update-sent` 在 edge（wire 序/载荷长/无 `sendQueueMs`）、`update-acked` 在 session 同序） | **满足**；t0 采样点锚定 `sendAndRegister` 推送同步段（实读 `:429` `sentAt = safeNow(...)` 在 `sendUpdateFrame` 之前采样）+ `hub-session-async-host` `now()` 观测面门（observer 在场才取钟——测试均配 `hubObserver+hubClock`，自洽） |
| AC6 live 成功路径与 β wire 逐字节等价 | LIVE-PARITY-C1（`:595-648`：控制帧两方向逐字节等 + `kind#sequence` 骨架两方向全等 + 数据帧文档语义等 + 双 hub ROOT 快照逐值 + peer 收敛 43）+ NC1 内容变异 | **满足**；复用 #424 ORACLE-2 helpers（`issue424-sharded-hub.ts` 六导出逐一实存），无第二套判据 |
| SA2 Required revisions（BLOCKER/MAJOR） | 无（SA2 §13 为空） | 无需修订 |
| SA2 O1（tsc 证据空文件/无 exit code；vitest `Type Errors` 不覆盖两新文件） | SA3 落实：`-package-tsc.log` 追加命令 + 零诊断 + 显式 `exit=0`（SA4 读回在场）；SA4 复核 vitest `typecheck.include` 确仅覆盖 `*.test-d.ts`（`vitest.config.ts:20`），故 tsc 门是两新文件的唯一类型证据——已补齐 | **已落实**（残余证据形态观察见 §12-O1） |
| SA2 O3（两份新工件 0600） | `stat` 实查：两份新测试文件 + 5 日志全部 `664` | **已落实** |
| SA2 O2（设计 §11 DENY 措辞） | 未处理——落在设计文件，不在 SA3 ALLOW；SA3 登记按范围不处理 | **接受**（语义无歧义；见 §12-O5） |
| SA8 §8-R1 落盘期义务（判据不削弱 / 夹具 append-only 缺省零传 / 基线证据保留不替换） | 13 用例判据口径与 SA6 契约 §12.3 一致（见 §9 测试质量审查）；夹具 diff `+10/-0` 纯新增、条件展开缺省零传（见 §6）；`-repeat5.log`/`-package-suite-precontract.log` 无 SA3 段（基线原样），其余 3 日志为**追加**（SA6 段保留在上方） | **全部满足** |
| Owner comments（Comment ID × updated_at 核对） | 空数组（派工 REST + 简报双确认）；无可映射评论，无旧评论覆盖风险 | **无遗漏** |

---

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| §7-D1 verification-only（零生产实现面） | `git status --porcelain`：`packages/ws-replication/src/**` 零 diff；docs/CONTEXT.md/根配置/`pnpm-lock.yaml` 零 diff（SA4 分路径复查为空） | **落实**——工作树改动面 = 1 夹具 append-only + 2 新测试文件 + 5 日志 + wiki 产物，与设计声明逐项对应 | 无 |
| §7-D2 契约工件原样落盘（13 用例语义不削弱） | 契约文件 686 行恰 13 `it(`；判据口径逐条与 SA6 §12.3 对上（恰 N 帧 / k+m / 消费序 strict 先行 / `not.toHaveProperty` / 逐字节控制帧 / 骨架全等 / 文档语义）；零 `skip/only/todo`、零 `process.env`（grep 实查 exit 1） | **落实** | 无 |
| §7-D2 变异负控 `finally` 恢复纪律 | LIVE-WINDOW-C3（`:168-170`）与 LIVE-ACK-C1 变异（`:359-361`）均 `try/finally` 恢复生产原型；变异仅改内存 prototype，无生产文件触碰；根配置 `maxWorkers: 1`（串行）消除跨文件并行污染面 | **落实** | 无 |
| §7-D3 夹具 append-only +10（缺省零传 = #447 逐字不变） | `git diff` = `+10/-0` 纯新增：7 行 doc-comment+`edgeObserver?: ReplicationObserver` 成员 + 3 行条件展开 `...(options.edgeObserver === undefined ? {} : { observer: options.edgeObserver })`；既有行零改写 | **落实**；键位审读：session 宿主（`:394-402`）与 edge 工厂（`:434-446`）是**两个对象字面量**，`observer` 键互不遮蔽；append 前 edge 工厂调用本就不传 `observer` ⇒ 缺省路径逐字等价 | 无 |
| §7-D4 `sendQueueMs` 整键缺席守门 | LIVE-OBS-C1 `:388-390` `not.toHaveProperty('sendQueueMs')`（`update-sent`）+ `:395`（`update-acked`）；生产面 `hub-edge.ts:852-868` 实读一致（仅 `accounting?.sendQueueMs` 在场时携带） | **落实**（登记缺面固化，非实现主张） | 无 |
| §7-D5/§12 验证门（V1–V4） | 证据日志逐项核验：V1 13/13（`contract-run.log` SA3 段 `[1]`，`exit=0`）、V2 43/43（四文件 15+13+7+8，`[2]` `exit=0`）、V3 101 文件/897 用例（`package-suite.log` SA3 段，新契约文件在列 `(13 tests)`，`exit=0`）、V4 tsc `exit=0`（`package-tsc.log`）；数字自洽（precontract 100/884 + 13 = 101/897） | **落实**（静态核验证据在场且自洽；SA4 依纪律不重跑，动态复验见 §11） | 无 |
| §2 锚点表 ↔ 源码（SA4 抽核） | `update-channel.ts`（`pendingSends:135-138`/`effectiveInFlightCount:169-173`/`hasUnsettledSends`/`onReceipt:198-209`/deliver 判据/`onAck:287-323`/`latencyMs`/`sendAndRegister` γ 分支/`pullAndSendOne` 判据/末 chunk γ 分支）、`hub-session-async-host.ts`（`tagCounter:96`/`handleFrame:121-`/`handleReceipt:161-177`/`dataGateOpen:()=>true:219`/`onDataQueued`+`requestDataDrain:221-222`/`emitSeam:256-264`/`selfDrain while:271-277`）、`hub-namespace.ts`（`onUpdateAck` violation⇒1002/`onUpdateAcked` chunked 改道无 sequence 键）、`hub-edge.ts`（`emitUpdateSentAtStamp`）——SA4 逐段实读全部命中且语义与设计表一致 | **一致**（SA2 14/14、SA8 全量复核之上 SA4 独立抽核关键 10 处全中） | 无 |
| §10 调用方矩阵（生产调用方逐字节不变 / #447 三套件复跑 / 新消费方装配 / CI 采集） | 生产零 diff；43/43 证据含 #447 三套件 30 用例；`issue448-live-seam.ts:100-108` 装配前提断言（facade 被 boot 调用 / registry 同一性 / 连接数恰 1）；根 `vitest.config.ts:15` include 逐字命中（SA4 实读恰在第 15 行） | **落实** | 无 |
| §13-R1/R2 缓解措施 | 变异/负控在场（见上）；R4/R5 触发条件未激活（本轮无反证证据、无 `sendQueueMs` 增补） | **维持** | 无 |

---

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| tag 分配/校验、回执入口、自驱 drain | γ session 句柄 | `hub-session-async-host.ts`（验证对象，零改动） | 正确 Owner，无复制 |
| 两相记账/窗口/onAck 判别 | `UpdateChannel` 单份实现 | `update-channel.ts`（γ/α/β 共享；`asyncSendTickets` 位分叉） | 正确；无第二状态机 |
| wire 序盖章 + `update-sent` | edge mux | `hub-edge.ts:852-868` | 正确（§24.5/§24.8 单点） |
| 违契收口 | edge `connection-fatal` / namespace 漏斗 | `hub-session-async-host.ts:161-171`、`hub-namespace.ts:1162-1169` | 正确 |
| 测试编排/观测投影 | test-only 夹具 | `issue448-live-seam.ts` 仅 boot adopt + 前提断言 + 投影（零协议决策、零应答合成） | 正确（应用层编排不复制状态机） |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| γ 窗口/超时/时延锚 | #447 PEND/ANCHOR 族（`issue447-async-session-round.test.ts`，含同款 `import('../src/update-channel.js')` 变异先例 `:443`） | LIVE 族复用同一夹具与装配面（`makeAsyncReplicationFacade`/`pumpUntil`/`makeManualClock`） | 一致 | LIVE-* 是 PEND 族的 AC 专属场景扩展，非平行机制；直接 src import 为 #447 既有变异负控惯例 |
| β parity 判据 | #424 ORACLE-2（`issue424-sharded-hub.ts:451-686` 六 helper） | import 复用（动态 import + 结构类型投影） | 一致 | 不重写等价性判据 |
| verification-only 姿态 | #316（能力已交付 → 绿色契约 → approve） | 同构 | 一致 | 不伪称红灯；历史红依据 = pre-T1 `c86ccbc`（git 实查在 log） |
| `update-sent` 可观察性 | 生产 `createHubReplicationEdge` 的 `observer` 选项 | 夹具 append-only 接线（缺省零传） | 一致 | 补接线而非新观测通道 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| wire 序 | edge 盖章返回值（`probes.stamps` 记录事实） | 回执、事件 `sequence`、测试断言全部回读 | 无第二事实源 |
| 窗口占用 | `effectiveInFlightCount` 单点 | 契约以帧数/事件数外部观察，不镜像内部账本 | 无 |
| tag↔序配对 | 盖章记录 + 回执缓冲 | 断言回读配对，不推导 | 无 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| boot round（每用例独立 registry/scheduler/wire） | 无显式 teardown（同 #447 套件先例；全内存、`maxWorkers:1` 串行、每回合独立 scheduler） | 变异负控 `finally` 恢复原型（对称）；夹具前提断言失败即红 | 可接受（测试卫生观察见 §12-O3，非阻断） |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 第二套 γ 夹具 | `issue447-async-seam.ts` | `issue448-live-seam.ts` thin 复用（registry 同一性断言防漂移） | 非重复 |
| 第二套 parity 判据 | #424 helpers | import 复用 | 非重复 |
| 第二观测通道 | edge `observer` 生产选项 | 夹具注入既有选项 | 非重复 |

---

## 6. 文件范围审查

`git status --porcelain` 实查（HEAD `321d951`）：

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `M packages/ws-replication/test/issue447-async-seam.ts`（`+10/-0`） | ALLOW 第 3 项（append-only，既有行不得改写） | `update-sent`（edge 盖章点）可观察性最小注入面 | **合规**：diff 纯新增、条件展开缺省零传；既有行零改写 |
| `?? packages/ws-replication/test/ws-replication-issue448-live-data-plane.test.ts`（686 行） | ALLOW 第 1 项 | 契约本体（13 锚） | **合规**（SA6 制品原样落盘，SA3 零内容改动；模式 664） |
| `?? packages/ws-replication/test/issue448-live-seam.ts`（133 行） | ALLOW 第 2 项 | test-only 夹具 | **合规**（同上） |
| `?? artifacts/sa6-issue448-{contract-run,repeat5,package-suite,package-suite-precontract,package-tsc}.log` | ALLOW 第 4 项（「可追加新运行证据」） | SA6 运行证据 + SA3 追加段 | **合规**：3 份为追加（SA6 段保留上方）、2 份（repeat5/precontract）原样未触碰 |
| `?? wiki/raw/task_issue-448.md` / `_design.md` | ALLOW 第 5 项 + Host 简报位 | 简报/设计固定产物 | **合规** |
| `?? wiki/raw/task_issue-448_{sa2_review,sa3_impl,sa6_contract,design_conflict_report}.md` | 下游流水线产物（各自 dispatch 授权；设计 §11 注记） | 各阶段报告 | **合规**（本 SA4 报告同属此类） |

DENY 核查：`packages/ws-replication/src/**`、`docs/**`、`CONTEXT.md`、`packages/ws-replication/AGENTS.md`、`packages/replication-protocol/**`、根 `vitest.config.ts`/`tsconfig*.json`/`package.json`、`pnpm-lock.yaml`、#447 三个 `.test.ts` 本体——分路径 `git status --porcelain` 复查**全部为空**；#449/#450/#451 范围面零触碰。**无越界、无未列改动。**

---

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| 生产公共面（`src/index.ts` 导出、wire 帧、缝词汇、错误码、事件字段集） | Registry/SessionHost 组装、edge mux、peer 面、Cordis 插件 | 零 diff ⇒ 逐字节不变；契约只读观察 | 无 | 无 |
| `AsyncFacadeOptions`（新增可选 `edgeObserver`） | #447 三套件（不传该键）+ `issue448-live-seam.ts`（传） | 缺省零传 = `{}` 展开 = 不出现 `observer` 键 = append 前逐字等价（SA4 读回装配段确认 edge 工厂调用无其他 `observer` 键，无键遮蔽）；复跑证据 30/30 在 43/43 内 | 无 | 无 |
| edge 工厂 `observer` 选项 | `createHubReplicationEdge`（`hub-edge-host.ts` 既有选项） | 夹具只补接线（生产选项，非新 API、不经 `src/index.ts`、非缝词汇） | 无 | 无 |
| CI/根门禁采集 | 根 `vitest.config.ts:15` `include` | 新测试文件路径逐字命中；夹具为被导入模块（非 `*.test.ts`）不入采集——与 #447 夹具同规 | 无 | 无 |
| 类型门 | 包 `tsconfig.json` `include = ["src/**/*.ts","test/**/*.ts"]` | 覆盖两新文件；vitest `typecheck.include` 仅 `*.test-d.ts`（已由 SA2 O1 识别，SA3 以 V4 tsc 补齐证据） | 低（证据形态观察见 §12-O1） | 无 |
| γ 缝词汇闭集合（§24.3） | 协议文本/模块 AGENTS | 夹具改动零新增缝消息/事件型/错误码；`edgeObserver` 为测试选项 | 无 | 无 |

遗漏关键 caller：未发现（生产面零改动 ⇒ 生产调用方集合不变；测试面唯一被触碰文件的消费方均有复跑证据）。

---

## 8. 错误、恢复与并发

| 检查面 | 证据 | Assessment |
|---|---|---|
| 静默失败 | 违契路径全响亮：伪造序/未知/重复 tag ⇒ `CONNECTION_POLICY_VIOLATION`（`hub-session-async-host.ts:161-177`）；未登记序 ACK ⇒ `ACK_STATE_VIOLATION`(1002)（`hub-namespace.ts:1162-1169`）；不可解码 ⇒ `MALFORMED_FRAME`（`:128-131`）；NC-1/NC-2 注入证明响亮而非恒真 | 无吞错、无伪成功（zombie 为 β 同构登记语义，非降级） |
| 部分完成诚实报告 | 发送拒绝（seq≤0）⇒ 失败明细采样 → `discardQueued` + `send-failed` resync（`update-channel.ts:437-445`，实读在场） | 既有语义，契约不改 |
| 幂等/终止性 | `selfDrain` 无工作即 no-op、每 pull 必进展（消费队列项或发一 chunk）、`while` 必然终止（`hub-session-async-host.ts:271-277` 实读）；LIVE-DRAIN-C2 锚定时间推进零驱动 | 禁 busy loop 可执行 |
| 重试/回滚/清理 | 弃置路径 `abandonInFlight` → `abandonedTags` → 迟到回执 `zombieSeqs` no-op → 迟到 ACK zombie（LIVE-ACK-C3 全链锚定）；变异恢复 `finally` 对称 | 真实、无残留 |
| 进程重启/事务中断 | N/A（零生产改动；γ 账本内存态随连接收口清空） | 不适用 |
| 并发/竞态 | γ 单会话单句柄；测试显式 release + 手动时源（`makeManualClock` 只改读数不驱动 timer）+ 微任务泵（`pumpUntil` 40 轮有界、超时抛错）消除竞态窗口；`withholdEdgeToSession` 经 `setHeld(true)` 门控使 `releaseAll` 对扣留通道零投递（扣留语义在泵内保持，SA4 读回 `FifoSeamChannel` 实现确认） | 静态无可疑竞态；运行时确定性由 5/5 复跑佐证 |
| 静态无法确认项 | — | 见 §11 后续动态验证项 |

---

## 9. 测试质量审查

SA4 不运行测试，只审测试源码与真实触发入口。

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| LIVE-WINDOW-C1/C2 | 恰 2 帧过缝；rekey 不释放槽（零结算事件）；ACK 后恰第 3 帧；三 ACK 各恰一；第 4 笔直推恰一次；每序回执 ≡ 盖章序 | 根 `vitest run packages/ws-replication/test`（include 逐字命中；包全量日志实含 `(13 tests)`） | 无（中间态断言用 `pumpSteps(3)` 有界推进后断「不该发生」） | 无 |
| LIVE-WINDOW-C3（变异） | 剥 `pendingSends` 后**断言第 3 帧必过缝（=3）**——负控自带反向断言，变异无效即自红；`finally` 恢复 | 同上 | 无（自我验证式负控：若变异未生效则 `2≠3` 红） | 无 |
| LIVE-ORD-C1 | 单通道**消费序**（`delivered()` 下标）receiptIndex < ackIndex；登记点零事件；零 fatal | 同上 | 无（符合 §24.8「跨线程无全序」⇒ 仅单通道序断言，零跨线程事件序断言） | 无 |
| LIVE-ORD-C2（负控） | `reorderNext` 乱序 ⇒ fatal 含 `ACK_STATE_VIOLATION` + 零结算 | 同上 | 无 | 无 |
| LIVE-ACK-C1 | `ackLatencyMs === k+m`；恰一次；序 = wire 序；ACK 帧回指 | 同上 | 无 | 无 |
| LIVE-ACK-C1 变异 | rekey 重采样 ⇒ 断言 `=== m`（生产下必红）；`finally` 恢复 | 同上 | 无（变异对被测路径忠实：场景内 tag 未弃置，`abandonedTags` 分支不可达不构成稻草人） | 无 |
| LIVE-OBS-C1 | `update-sent` 恰一次（sequence=wire 序、bytes=载荷长、无 `sendQueueMs`）；`update-acked` 恰一次同序无 `sendQueueMs` | 同上 | 单 recorder 双挂：恰一次断言可捕双发；归属值判别的理论巧合残余见 §12-O2（非阻断） | 无 |
| LIVE-ACK-C2/C3 | violation 响亮零结算；zombie 零 fatal、被弃序零 `update-acked`、`RESYNC_REQUIRED` 恰一次 | 同上 | 无 | 无 |
| LIVE-DRAIN-C1 | 单 transferId、chunkIndex 0..k-1、transferKind=0、transfer 占 1 槽、`chunked-update-sent/acked` 各恰一次、无 sequence 键、`ackLatencyMs=k+m`、ACK 回指末 chunk 序、零 `update-acked`（改道）、结算后续推 | 同上 | 无 | 无 |
| LIVE-DRAIN-C2 | `advanceBy(100)` 零新帧；`scheduler.pending()`（harness:235 真实 getter）不增；重复泵零越界；结算后额外泵零新增 | 同上 | 无 | 无 |
| LIVE-PARITY-C1 | 两方向控制帧逐字节 + 骨架全等 + 数据帧文档语义 + ROOT 快照逐值 + peer 收敛 | 同上 | 无（#424 helper import 复用，判据非本票新造） | 无 |
| LIVE-PARITY-NC1 | 内容变异 ⇒ 语义比对必差异、控制帧仍等 | 同上 | 无 | 无 |

横切纪律：零 `skip/only/todo`、零 `process.env`（grep 实查）；断言全为运行时行为（帧/序/事件/消费序/快照），零源码 grep 式断言；每用例 30s 超时（确定性手动时源下宽裕，不构成弱化）；负控/变异均在同一次运行内（13/13 含 6+1 条负控/变异）。**验收未被弱化；测试入口真实。**

---

## 10. Required revisions

无 BLOCKER / 无 MAJOR finding。无需修订。

---

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| 证据日志为静态文本（含 SA3 追加段），SA4 未独立重跑 | Controller/后续阶段机械复跑 §12 四条命令（`NODE_OPTIONS=--conditions=nomicore-source`；tsc 段建议 `cmd; echo exit=$?` 原样落盘） | 13/13、43/43、101 文件/897 用例、tsc exit 0 复现 | 任一数字/退出码不符 ⇒ 重开 §8-R1 落盘期义务 |
| LIVE-OBS-C1 归属判别在 tag≡wire 序巧合下的残余敏感度 | 若后续重构移动 `update-sent` 发射点：#423 edge 锚测试 + 本契约恰一次断言联合复跑 | 双发 ⇒ 计数红；错侧发射 ⇒ #423 族红 | 两族同时绿而发射点漂移（理论残余） |
| 变异负控对**未来**生产形态漂移的敏感度（锚点移动） | 每次触及 ws-replication 的变更复跑包全量（契约自然在内） | NC-4/NC-5/NC-6 变异下正断言必红 | 变异下正断言仍绿 ⇒ 判据失效，按 §13-R1 处置 |
| 重复 tag 回执 / 伪造序回执注入旋钮（SM-1/SM-2 响亮语义的运行时锚） | 若 #450 需要可顺势补锚（SA2 O4 登记） | 注入 ⇒ `CONNECTION_POLICY_VIOLATION` 响亮 | 静默或崩溃（当前源码实读为响亮，非缺口） |

---

## 12. Non-blocking observations

- **O1（MINOR，证据形态）**：`artifacts/sa6-issue448-package-tsc.log` 的 SA3 段为人工整理的摘要（命令 + 「零诊断」+ `exit=0` 行）而非机械原样捕获——tsc 成功时本就零输出，故内容可接受；建议后续统一 `echo exit=$?` 机械化追加，避免摘要与实跑的形态差。
- **O2（MINOR，判别力残余）**：LIVE-OBS-C1 以单 recorder 双挂断言 edge/session 双侧归属；「恰一次」计数可捕双发，但「错侧单发」的判别依赖 `sequence` 值 = wire 序（session 侧 γ 分支只有 tag）。tag 与 wire 序值域重叠，理论巧合下值判别降级——由恰一次断言 + #423 族 edge 发射点既有锚共同兜底，且 §24.8 禁跨线程事件序断言使单事件字段值断言成为规范内正确形态。登记不改。
- **O3（TRIVIAL，测试卫生）**：各用例 boot 的 round 无显式 teardown（#447 套件同款先例）；全内存、`maxWorkers: 1` 串行、每回合独立 scheduler/timer，无跨用例干扰面（5/5 复跑佐证）。维持惯例即可。
- **O4（登记，非缺口）**：重复 tag / 伪造序回执两类宿主违契无注入旋钮（SA2 SM-1/SM-2/O4 同判）——源码响亮收口在场，非本票 AC；#450 可顺势补锚。
- **O5（登记）**：SA2 O2 的设计 §11 DENY 措辞修订仍未落（属设计文件，SA3 无权限；语义无歧义，不影响实施与验收）。

---

## 13. 结论

- 实现态与批准设计（§7-D1–D5）、SA6 契约（13 锚 + 负控/变异）、SA2 Required revisions（空）、SA8 §8-R1 落盘期义务**逐项一致**；verification-only 裁定的三路证据经 SA4 独立抽核（生产锚点 10 处实读全中、git 事实、证据日志数字自洽）无矛盾。
- 文件范围合规（ALLOW 全命中、DENY 零触碰）；夹具 append-only 缺省零传经 diff 与装配段双重核验，无键遮蔽连锁。
- 测试质量：13 条全为真实行为断言、入口真实（根 include + 包全量实跑证据）、负控/变异有牙且自我验证、无弱化痕迹。
- **Verdict：`approve`**（0 BLOCKER / 0 MAJOR；5 条非阻塞观察如上）。
- `requiresConflictRecheck: false`——本票零生产语义变化，SA4 复审未发现新增协议决策或 ADR 冲突风险（与 SA8 设计后复审 `clear`/`false` 同向）。
