# SA9 Standards Review — Issue #450（γ-T4：γ 流控与生命周期收口）

- Dispatch：`sa-3cd84fe4-ae1e-434c-9ca1-b7eef468deba`（mabf-sa9 / standards-review / iteration 0）
- 审查对象：**已提交的 Issue #450 最终 diff** = commit `02194881cf487088210ddf7ee7b433e6f41f1513`（`fix(ws-replication): close gamma flow-control failures`），即权威基线 `spec/445-gamma-async-seam` @ `38b772f64afe1f0a927637922978240b3cb66850` 的三点 diff（merge-base `444c166` → HEAD；分支自 444c166 分叉，449 的测试合入基线但与本 diff 文件集零重叠——`07aeb98`/`d166fd2` 仅触 `issue449` 新测试文件 + artifacts + wiki）。
- Owner comments：无（派工明示 REST read 为空数组；简报 `## Comments` 空——三方一致）。
- 审查方式：静态审查（本技能纪律）——逐行核对提交的生产 diff（3 src + 模块 AGENTS.md）与测试/夹具（2 新建 + 2 append），交叉核对规范原文（ADR 0032 附录 A4、协议 §24）、模块/根/docs AGENTS、既有惯例与固定位置的设计/SA2/SA3/SA4/SA8×2/SA7 产物；抽样核对提交的证据日志内部计数自洽。**未运行测试、未启动服务、未修改任何文件（本报告除外）、未调度其他 SA、未 commit/push。**
- 审查范围声明：按 SA9 职责只判断**仓库与工程标准符合性**；Issue 需求是否完整实现属 SA10，不在本报告裁定面。

---

## Verdict

**`approve`** —— 无 BLOCKER、无 MAJOR。实现与批准设计（SA1 iteration 1）逐行一致，并经 SA2 iteration 1 `approve`、SA8 设计门 iteration 1 `clear`（§16 读法 A 显式裁定）、SA8 实现门 `clear`（`requiresConflictRecheck: false`）、SA4 `approve`、SA7 `approve` 全链路闭合；本审查独立复核以下各维度全部符合仓库与工程标准。三项 MINOR 观察不阻断（§8）。

## 1. AGENTS / 模块契约符合性

| 标准 | 出处 | 交付事实（独立复核） | 判定 |
|---|---|---|---|
| 模块契约阅读义务（改动 edge/session 拆分、OPEN 准入、公共工厂前读 ADR 0032；改动 backpressure/lifecycle 前读 ADR 0010/协议） | `packages/ws-replication/AGENTS.md:5` | 设计/SA2/SA8 报告均以 ADR 0032 A4.3/A4.5、协议 §24.5/§24.7、§17 行锚逐字核对（本审查复原文 `:55-99`、`:1130-1147` 命中） | 符合 |
| 缝纪律（缝词汇闭集合；无拒纳/闸门/信用词汇；edge 盖章单点；β 冻结面逐字不动） | 模块 AGENTS.md:17 | 零新缝消息（分叉 = edge 内部构造期常量，不上缝）；`hub-session-host.ts` 零触碰（diff stat 实证）；盖章单点 `frame-io.ts`/`hub-edge.ts` mux 零改动 | 符合 |
| 模块 AGENTS.md 同步义务（行为变化时同集登记） | 模块 AGENTS.md:17 + `docs/AGENTS.md`「code behavior changes ⇒ update every normative document whose stated contract changed」 | 同一 commit 内 :17 bullet **句尾 append-only** 一句（方向性义务「γ 装配 ⇒ 应置位」+ 双向误用面 + 1011/1009 + 前置门仅 `closed` 项 + 缺省逐字不变）；既有句逐字保留（diff = 单行替换、纯追加）；规范文本（ADR 0032/协议/CONTEXT.md）已是目标语义、零改动正确（git diff 实证 `docs/` 零触碰） | 符合 |
| 公共面 append-only（工厂一经发布只增不改） | 模块 AGENTS.md:20 + ADR 0032 后果 :112 | 唯一公共面变化 = `HubReplicationEdgeOptions` 第 10 可选成员 `readonly asyncDataAdmissionFatal?: true`（`hub-edge-host.ts:177-186`）；`src/index.ts` **零改动**，类型经既有再导出 `:90` 流动；内部类型 `HubReplicationEdgeConfig`/`ConnectionSenderHost`/`HostEdgeConnection` 均不经 index 导出（grep 实证） | 符合 |
| 生产 API 经 index.ts；测试控制面与生产分离 | 模块 AGENTS.md:22 | 新夹具落 `test/`（test-only 纪律，头注登记）；`src/testing.ts` 零触碰；无新值导出 | 符合 |
| 模块验证门（聚焦 + 缝契约/OPEN admission/wire parity + 包 typecheck + 根 `pnpm typecheck`/`pnpm test`） | 模块 AGENTS.md:24-26 | 证据日志随集落盘且计数链自洽：聚焦 22/22、γ 族 5 文件/65、#421 家族 7 文件/98（含 test-d 8 类型用例）、包全量 **102 文件/919**（基线 101/897 ⇒ 恰 +1/+22）、根 test **465 文件/5649** 全绿、根 typecheck exit 0；红证据 4 failed|18 passed 恰为设计预言缺口；3 次复跑逐值相同 | 符合（文本核对，SA9 不复跑） |
| 根 AGENTS 杂项（worktree、schema、typed access 等） | 根 `AGENTS.md` | 本 diff 不触 `domains/`、Namespace 数据面、第三方宿主集成、诊断日志包；无适用义务被触发 | 符合 |

## 2. ADR / 协议符合性（规范原文逐条复核）

| 条款 | 交付事实 | 判定 |
|---|---|---|
| A4.3 / §24.5 流控单点在 edge；账本投影越界 ⇒ `CONNECTION_BACKPRESSURE`(1011) 收口整条连接；无逐帧拒纳/无 deferred/无 ns 级 send-failed resync | 翼(i)：`backpressure.ts:82` 可选钩子 + `:182-196` 两守卫各增一行可选调用后仍 `return 0`——**判据（严格大于）、次序（oversize 先）、投影公式逐字未动**（diff 逐行核对）；翼(ii)：`hub-edge-host.ts:712/:721` 构造期常量 `pausePreGate`，γ 装配前置门仅 `closed` 项；收口汇入既有 `connectionFatal` 单点（零新拓扑） | 符合（§16 读法 A 已由 SA8 iteration 1 显式裁定，本审查不重复裁定规范解释，仅确认交付与裁定逐要素一致） |
| A4.3 / §24.5 β/γ 显式行为差；β 行为不变 | 标记缺席 ⇒ `(true && ¬gate) ≡ ¬gate` 缺省前置门逐字节等价 + 钩子缺席 = 死分支；`BPK-NC1`（β ns 级 resync 存活）+ `BPK-NC2`（漏置位形态弹回存活）+ PUB 缺省不变性三重负控在案 | 符合 |
| §24.5 单帧超限 = 配置错误 ⇒ 响亮收口 + 诊断；§13.1 注册表冻结 | `'oversize' → FRAME_TOO_LARGE + wsCloseCodeFor 1009`（映射 `:118` 基线已存在，实证非本票新增）；`packages/replication-protocol` 零触碰；两码均在 observer 白名单 | 符合 |
| A4.5 / §24.7 生命周期单规则（收口后丢弃/close 冲刷/revoke 不溯及/settled 晚到/`closeTimeoutMs` 不动） | session 侧生产文件全部零触碰（diff stat 实证 DENY 面）；新收口触发点汇入既有 close 拓扑，四腿自动适用；`DROP/FLUSH/REVOKE/DRAIN` 族锚 + `DRAIN-NC1`（2× 逃生舱敏感性负控）在案 | 符合 |
| A4.1/A4.6/§24.3 缝词汇闭集合；receipt 恒 `{tag,sequence}` | 零新缝消息、零新词汇；桥 `egress ≤ 0 ⇒ 不投回执` 条款语义零改动 | 符合 |
| ADR 0032 决策 1（单份实现，不 fork 协议状态机） | 无第二份 ConnectionSender/egress 面；分叉 = 同一装配闭包内构造期参数 + 可选钩子 | 符合 |
| A4.8 验收纪律（延迟可注入显式异步内存管道、零 worker_threads/真实 timer、既有矩阵全绿硬门） | 夹具头注逐条登记；grep 实证新测试/夹具零 `setTimeout/setInterval/Date.now/Math.random/process.env`；peer `random: () => 0.5` 钉死（fixture `:199`、test `:227`）；102 既有文件全绿硬门证据在案 | 符合 |
| OPEN 水位 = 故障参数（原值 16/4 不动、打穿响亮收口） | 常量与收口点零触碰；γ permutation 锚 `OPENWP-C1/C2`（恰 4 并发/恰 16 帧零收口；第 5/第 17 ⇒ 恰一 1008） | 符合 |

## 3. 模块责任归属

| Behavior | 应有归属 | 实际位置 | 判定 |
|---|---|---|---|
| 流控越界判死（守卫失败动作 + 前置门） | edge（A4.3 单点） | `backpressure.ts`（edge 账本机械）+ `hub-edge.ts` 构造器挂接 + `hub-edge-host.ts` 装配闭包 | 符合——session 半边零改动，无第二决策点 |
| reason→码映射 | edge 单点（§24.3） | `hub-edge.ts:224-231` 装配处 | 符合 |
| 收口执行 | 既有 `connectionFatal` 单点 | 钩子直调；`closedFlag` 幂等恰一 | 符合 |
| γ 装配形态知识 | 宿主装配期（工厂 option） | `HubReplicationEdgeOptions.asyncDataAdmissionFatal`（无 per-call/运行时覆盖） | 符合——与 `listen: false`/`asyncSendTickets` 同款纪律 |

## 4. 既有架构惯例

- **可选宿主钩子分叉**沿用 `onSendPaused?`/`onSendResumed?` 同款可选成员模式；**条件展开挂接**（`...(cond ? {…} : {})`）使缺省路径结构性不可达——与仓内 append-only opt-in 先例一致。
- **夹具先例**：`Object.defineProperty(transport,'bufferedAmount',{get})` 沿用 #137 `applyPressure` 先例；`bootFlowRound` 镜像 `bootLiveRound` 形状 + accept 装饰，不触碰 `issue448-live-seam.ts`（DENY 尊重）。
- **证据落盘惯例**：`artifacts/*.log` 与 `wiki/raw/task_*` 随 commit 归档为既有惯例（`git ls-files`：artifacts 399 份、wiki/raw 1753 份；先例 `a596670`/`0c92b3e`/`07aeb98`）。
- 注释与 doc 均为按装配形态分述的真陈述（γ 0 值三来源穷尽：oversize 守卫 / ledger-overflow 守卫 / 前置 `closed` 闸；缺省语义保留），本审查对源码逐形态核验成立。

## 5. 单一事实源

| Fact | Authoritative source | Derived state | 漂移风险 |
|---|---|---|---|
| γ 装配形态 | 公共工厂 option（唯一设置点） | 翼(i) config 条件挂接 + 翼(ii) `pausePreGate = options.asyncDataAdmissionFatal !== true`（同一 option 派生两翼，`allocate` 单构造点） | 无第二开关；漏置位方向由 option doc + AGENTS.md 方向性义务 + `BPK-NC2` 可执行负控三锚 |
| 连接收口事实 | `closedFlag` + `setConnState('closed')`（`connectionFatal` 同步前缀） | egress `closed` 闸 / `isEmitAllowed` | 无 |
| OPEN 水位（16/4） | `hub-edge-host.ts` 生产常量 | 测试直接 import 生产常量（非复制字面量） | 无 |

## 6. 生命周期对称性

- 零新增资源：钩子无状态；`pausePreGate` 构造期常量（无运行时切换 ⇒ 无竞态）。
- 释放路径全部复用既有单点：`connectionFatal → sender.teardown()`（账本/wheel/poll 清零）→ `requestSinkClose`（同步 quiesce 前缀）→ `transport.close` → observer → `cleanupAll`；幂等由 `closedFlag` 承载（恰一收口）。
- 收口 ERROR 直发零记账（`onEmitted` tornDown 早退）——内存上界论证闭合点未被破坏。
- 无新增不对称面；错误分类正确（ledger-overflow=1011 慢性拥塞 / oversize=1009 config 定性）；无静默降级、无吞错误（守卫失败动作从静默 0 升级为响亮收口；`emitOne` 序号耗尽 = 响亮 throw 非静默 0）。

## 7. 文件范围

- 提交 diff = 设计 §11 ALLOW 八行**逐一对应**：3 src + 模块 AGENTS.md + 2 新建测试/夹具 + 2 append-only 测试面 + `artifacts/sa{3,6,7}-issue450-*.log` + `wiki/raw/task_issue-450*` 工件。
- DENY 面零触碰（diff stat 实证）：session 侧（`hub-session-async-host.ts`/`hub-session.ts`/`hub-namespace.ts`/`update-channel.ts`/`round-engine.ts`/`bulk-transfer.ts`/`types.ts`）、β 冻结工厂、α 组合根、peer、`frame-io.ts`、`hub-upgrade-admission.ts`、`index.ts`、`testing.ts`、`issue448-live-seam.ts`、`packages/replication-protocol/**`、规范文档（`docs/` diff 行为 0）、其余包与根配置。
- 越界扫描：`git diff --name-only` 过滤后 packages/ws-replication、artifacts、wiki/raw 之外**零文件**；`git diff --check` exit 0。
- `issue447-async-seam.ts` 语义 diff = **+49/−0**（`git diff -w --numstat` 本审查独立复算），append-only 声明属实；缩进重排由 resolver 抽取闭包造成，行为零变化由 #447/#448 族复跑绿背书（见 §8-M3）。

## 8. 测试质量标准

| 维度 | 交付事实 | 判定 |
|---|---|---|
| 断言面 | 运行期可观察量（wire 帧/close info/observer 字段/`sendDataFrame` 返回值/缝消费序/句柄计数）；零源码 grep 断言（头注纪律 + grep 实证无 `readFileSync`/快照） | 符合 |
| 确定性 | 虚拟调度器 `advanceBy` + 显式 release；peer `random: () => 0.5` 钉死；3 次复跑逐值相同（`sa3-issue450-focused-repeat3.log`） | 符合 |
| 纪律 | 零 skip/only/todo/env override/真实 timer（grep 实证）；`timeout: 30_000` 为统一宽裕值 | 符合 |
| 红→绿证据 | 实现前红 4 failed|18 passed 恰为设计预言缺口；类型面红 TS2339/TS2353/TS2344 恰落新类型锚 | 符合 |
| 判别力 | 变异负控（`pausePreGate` 恒 true）恰使 `BPK-C4` 判别断言红（`sa3-issue450-mutation-wing2.log`）；`FLUSH-C2`/`REVOKE-NC1`/`DRAIN-NC1`/`BPK-NC1/NC2`/`OVS-NC1/NC2`/`MEM-NC1` 负控成对 | 符合 |
| 采集面 | 新文件逐字命中根 vitest glob；包全量恰 +1 文件/+22 用例实采 | 符合 |

## 9. MINOR 观察（不阻断 approve）

| ID | 级别 | 观察 | 证据 | 建议处置 |
|---|---|---|---|---|
| M1 | MINOR | `test/issue447-async-seam.ts:70` 新增的 `NamespaceAuthorizationGrant` 类型导入在文件内**无引用**（全文件仅 1 次出现 = 导入行；基线无此导入，diff 实证为本票引入）。仓库无 eslint 且无 `noUnusedLocals`，各门禁不拦截——纯 lint 级残留 | grep 计数 = 1；`git show 444c166:…` 零命中；SA8 实现报告 §8-A1 已登记同项（非阻塞，归并前清理职责） | 合并前清理删除该导入行 |
| M2 | MINOR | `OPENWP-C1`（帧闸形态）用例名宣称「resolve 后按序冲刷」，实际断言 = 台账归还（`pendingSinks()===0`）+ 零收口；15 缓冲帧向 session 的按序投递在 γ permutation 无直接观察（缓冲机械为 #421 OAP-C4d 在生产同码上的已锚面） | `ws-replication-issue450-flow-lifecycle.test.ts:665-688` vs `ws-replication-issue421-open-admission-pipeline.test.ts:607-622`；SA4 O-1 同判 | 后续票（#451 观测面）补 `edgeToSession.delivered()` 序断言，或将用例名收窄为已断言面 |
| M3 | info | `issue447-async-seam.ts` 语义 append-only（+49/−0）但带缩进级重排（plain diff 156/107）；行为零变化由 #447 三套件 + 包全量复跑绿背书 | `git diff -w --numstat` 复算；`sa3-issue450-gamma-family.log`（65/65） | 无需动作（登记供合并审阅者知悉） |

## 10. 与上游 SA 产物的一致性核对

- SA6 契约 `approve`、SA1 设计 iteration 1、SA2 iteration 1 `approve`（F-1 关闭）、SA8 设计门 iteration 1 `clear`（§16 **读法 A 显式裁定**——翼(ii) = 既有决策登记目标语义的实现追平）、SA8 实现门 `clear`（20 项对照全落 no-conflict/implements-existing-decision，`requiresConflictRecheck: false`）、SA4 `approve`（O-1–O-7 非阻断）、SA7 `approve`（22/22 + 65/65 + 98/98 + 102/919 复跑逐值一致；临时探针已删除复跑确认）。
- 本审查独立复核的关键锚点（`backpressure.ts:82/:182-196`、`hub-edge.ts:224-231`、`hub-edge-host.ts:177-186/:712/:721/:971-982`、`AGENTS.md:17` append、test-d append + `@ts-expect-error`）与上述产物申报逐项相符；未发现申报与提交内容失真。
- SA3 申报的 1 项载体替换（`BPK-NC1` 经 #420 shim 桥而非 `makeShardedReplicationFacade`）在 SA6 契约明文许可通道内、断言键逐字一致——符合契约纪律。

## 11. 复核说明

- 本审查未运行任何测试/服务；运行期结论引自随集落盘证据日志的文本核对（计数链自洽：101+1=102 文件、897+22=919 用例、43+22=65 γ 族、465/5649 根门禁）与静态源码逐行核对。
- 需求实现完整性（7 条 AC 的覆盖判定）属 SA10 职责，本报告不裁定；本 approve 仅声明：当前提交 diff 符合仓库 AGENTS、ADR/协议契约、模块责任、既有架构惯例、单一事实源、生命周期对称性、文件范围与测试质量标准。
