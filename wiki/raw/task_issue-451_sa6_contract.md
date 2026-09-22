# SA6 诊断与验收契约（rev2）— issue #451（γ-T5）：观测面锚定与全量回归收官

- 任务：`wiki/raw/task_issue-451.md`（GitHub issue #451，`open`，body 快照 2026-09-22T12:33:27Z）
- worktree：`/home/wangjian/nomicore-fix-issue-451`（分支 `mabf/issue-451`，HEAD `68ab9f5` = Merge PR #459）
- 本报告性质：**rev2 原位修订**（rev1 落于 2026-09-22T12:48Z，SA3 于 21:26Z 交回 `reject` + `requiresConflictRecheck: true`）。修订动因 = SA3 §7 记录的 `ANCHOR-ORDER-C1` 非确定性红灯（`bytes` 24 vs 27，根因 = live Y.Doc `clientID` 未钉死）。
- 本票生产者边界：**零生产实现改动**（`git status --short packages/ws-replication/src/` 恒空，§13/§16）。SA6 契约面只修订 `packages/ws-replication/test/ws-replication-issue451-gamma-observability-anchor.test.ts` 的 `ANCHOR-ORDER-C1` 断言边界；夹具、矩阵既有测试、`src/**`、协议/ADR/CONTEXT 零触碰。

## 0. 修订摘要（rev2）：裁定、落地与证据

| 项 | rev1（已废止的断言边界） | rev2（本报告裁定并落地） |
|---|---|---|
| `ANCHOR-ORDER-C1` 跨调度投影 | `type/side/namespaceId/sequence/**bytes**` + `toEqual` | `type/side/namespaceId/sequence` + `toEqual`（**调度不变量字段**）；`bytes` 改为**每轮对本轮 wire 载荷单轮自证** |
| 非确定性 | 两轮独立 boot 的 `clientID` 宽度抽签 ⇒ `bytes` 24/27 随机不等；实测 4/30 进程运行红（13.3%），SA3 包套件 3/7 红 | 0/40 进程运行红、包套件 3/3 绿、根 `pnpm test` 全绿；抽签变量彻底移出契约 |
| 断言强度 | 跨轮字节相等（对「两轮 +1」型字节说谎**不敏感**） | 逐轮 `bytes === 本轮 wire 载荷长`（M3 mutation 3/9 红，**新增**对字节事实说谎的敏感性；见 §9 E11/E12） |
| 规范一致性 | 违反仓库既有 `#424 ORACLE-2 口径`（数据帧字节相等禁用——`ws-replication-issue424-auth-parity.test.ts:16`） | 回到既有口径：数据帧判据 = 语义/单轮自证，跨进程字节长度不入判据（`issue418-edge-session-split-contract.test.ts:21,118,460` 同款） |
| 生产行为 | 无缺陷（`clientID` 随机是 Yjs 正常行为） | 无缺陷、零改动；缺的是**契约边界**而非实现 |

**结论**：`approve`（诊断可信、契约可执行、入口真实、证据充分）。下游需要 SA1 修订设计 §7-D1/DENY 与 §12 AC4-a 口径（本报告 §12.5/§15 明列），SA8 复查触发条件 `true`。

## 1. Task type and inputs

**Task type：Refactor / 验收收官（行为基线 + 回归契约）＋ 本轮契约缺陷修订（合同诊断）。** 生产行为在 HEAD 上已由 γ-T1~T4（#447–#450）落地；本票缺口是验收面缺口（γ 形态发射侧归属矩阵、跨线程无全序的断言纪律、公共面增量冻结、全量回归收官证据）。rev2 额外证明：rev1 的 `ANCHOR-ORDER-C1` 断言**超出 AC1-c 语义边界**（把 RNG 抽签量当作调度事实），构成**契约自身的确定性缺陷**——按 skill 纪律修订契约而非生产实现。

原样输入：

| 输入 | 状态 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-451.md` | 存在（Host 简报；5 条 AC + Blocked by #449/#450） | 需求全集 |
| `wiki/raw/task_issue-451_design.md`（SA1） | 存在 | D1 冻结裁定（本轮被证伪，待 SA1 修订）、D2/D3/D4 |
| `wiki/raw/task_issue-451_sa2_review.md`（SA2） | 存在（`approve`；N-1/N-2/N-3 MINOR） | 设计评审核验面 |
| `wiki/raw/task_issue-451_design_conflict_report.md`（SA8） | 存在（`clear`；§10 复查重启条件第 2 条 =「门禁复跑发现需改生产/契约才能转绿」） | 冲突结论 + 复查触发条件 |
| `wiki/raw/task_issue-451_sa3_impl.md`（SA3） | 存在（`reject`；§7 非确定性根因链 + §7.4 三备选修法） | 本轮修订的直接输入 |
| `wiki/raw/task_issue-451_relevant_decisions.md` / `_conflict_report.md` / `_sa4_review.md` / `_sa7_report.md` | **不存在** | 无 |
| owner 评论 | REST 快照 `[]` @2026-09-22T13:13Z（SA6 复读；SA3 12:53Z / SA6 12:33Z / SA1 12:35Z 同判空） | 无 owner 追加要求 |

规范性输入：`docs/adr/0032-transport-decoupling-edge-session-split.md` 附录 A4（A4.1–A4.8）＋ `docs/protocols/instance-replication-v1.md` §23.1（发射侧归属表）/§24（24.1–24.8）；`packages/ws-replication/AGENTS.md`「Verification」；仓库既有测试口径 `#424 ORACLE-2`（数据帧字节相等禁用——`test/ws-replication-issue424-auth-parity.test.ts:16`、`test/ws-replication-issue418-edge-session-split-contract.test.ts:21,118,460`）。

## 2. Owner comment mapping

| Owner 要求 | 来源 | 映射 |
|---|---|---|
| （无） | REST 评论快照 `[]` @2026-09-22T13:13Z | 无 owner 追加约束；AC 全集 = 简报 5 条，无口径冲突。rev2 修订属验收契约自身的一致性修复，不引入 owner 隐含面 |

## 3. SA8 constraints

- `wiki/raw/task_issue-451_*` 无 SA8 relevant-decisions 产物；约束继承链：spec #445（ADR 0032 附录 A4 + §24 + 词表）为规范文本；上游票 #447/#448/#449/#450 的 SA6/SA8 结论已随 PR #453/#455/#456/#459 合入 HEAD（各票边界见 `task_issue-447…450_sa6_contract.md`）。
- SA8 设计后复查 `clear`，其 §10 明列复查重启触发条件第 2 条 =「门禁复跑发现需改生产/契约才能转绿」。SA3 §7.5 判定该情形成立 ⇒ **`requiresConflictRecheck: true`**（rev2 确认，见 §15）。
- 模块门（`packages/ws-replication/AGENTS.md`「Verification」）：缝变更须跑 edge/session 契约、OPEN 准入、route-key/wire parity guard，再跑包 typecheck + 根 `pnpm typecheck`/`pnpm test`；本票零生产面变更仍按收官口径全量执行。
- 上游 SA6 移交本票的面（逐字）：#448 §12.2「#451 = `update-sent` 总归属 + test-d 复核 + 根门禁全量回归」；#449 §12.2、#450 §12.3 同款。
- 既有仓库口径（rev2 新增约束）：数据帧（Yjs 载荷）**禁止**跨进程/跨 boot 字节相等断言（`#424 ORACLE-2`；`issue418` C3 边界；`issue447/448/449` 语义判据先例）——rev1 的 ORDER-C1 与该口径冲突，是本轮修订的规范依据。

## 4. Environment and baseline

| 项 | 值 |
|---|---|
| Node / pnpm / vitest / tsc | v24.13.0 / 10.28.2 / 3.2.7 / 5.9.3 |
| 依赖安装 | `pnpm install --offline --frozen-lockfile`（store 命中，零网络） |
| 测试入口 | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run …`（root `pnpm test` = `vitest run --typecheck`；`maxWorkers: 1`；`typecheck.include = packages/*/test/**/*.test-d.ts`） |
| 诊断 HEAD | `68ab9f5`（`git rev-parse HEAD`，全程未前移） |
| 基线（rev1 契约落地时） | 包套件 105 files / 945 tests；`src/**` 零 diff；SA3 D2 = `packages/ws-replication/AGENTS.md` 单 bullet（`git diff --stat` = 1 insertion） |
| 本轮初始红灯 | 包套件间歇红，红灯恒为 `ANCHOR-ORDER-C1`（SA3 7 次 3 红；本会话聚焦文件 30 次 4 红） |
| 时钟/网络/worker | 零真实 timer（注入调度器）、零网络、零 `worker_threads`/`MessageChannel` |

## 5. Positive reproduction

### 5.1 非确定性复现（rev1 契约，修订前）

| # | 入口 | 样本 | 结果 |
|---|---|---|---|
| R-1 | `npx vitest run packages/ws-replication`（真实包门禁） | SA3 7 次 | **3 红 / 4 绿**；红灯恒 `ANCHOR-ORDER-C1`；`- Expected "bytes": 24 / + Received "bytes": 27`（方向翻转出现过） |
| R-2 | 同上（SA6 本会话） | 3 次 | 3 绿（与 11.65%/对的抽签率相容：3 连绿概率 ≈ 69%） |
| R-3 | 聚焦契约文件（独立进程 ×30） | 30 次 | **4 红 / 26 绿（13.3%）**；红灯恒 `ANCHOR-ORDER-C1`（18–19ms），其余 8 用例恒绿 |
| R-4 | 单文件连跑（SA3） | 16 次 | 16 绿（抽样运气：0.883^16 ≈ 13.6%） |

日志：`artifacts/sa6-issue451-rev-flake-samples.log`（R-3）、`artifacts/sa6-issue451-sa3-suite-repro.log`（SA3 R-1）、`artifacts/sa6-issue451-rev-prefix-suite-samples.log`（R-2）。

### 5.2 修订后的正控（rev2 契约，运行时行为）

修订后的 `ANCHOR-ORDER-C1`（文件 `:333-397`）正控 = 两种合法缝调度下：

1. 调度不变量投影（`type/side/namespaceId/sequence`，无合并数组下标）逐字相同（`:371`）；
2. 每轮 `update-sent.bytes` 与 `update-acked.bytes` **各自等于本轮 wire UPDATE 载荷长**（`:379-388`，`payloadBytesOfFrame` 缺帧即响亮 throw）；
3. 扣留期 edge 侧事实在场、session 侧缺席、`edgeToSession.pending() > 0`（ORDER-C2，未改动）。

其余 8 用例（ANCHOR-EDGE-C1/C2/NC1/NC2、SESSION-C1/C2、BOTH-C1、ORDER-C2）与 rev1 逐字相同，语义未动。

### 5.3 rev1 其余正控（保持，不重复举证）

`ANCHOR-EDGE-C1`（仅 edge observer 恰一 `update-sent`，seq/bytes 对 wire 自证）、`ANCHOR-EDGE-C2`（egress 直驱判别面）、`ANCHOR-EDGE-NC1`（未盖章零发射 + `FRAME_TOO_LARGE` 收口）、`ANCHOR-EDGE-NC2`（型门/R21）、`ANCHOR-SESSION-C1/C2`（镜像隔离 + chunked 归 session）、`ANCHOR-BOTH-C1`（无双发）在 rev2 下逐条保持（§13 无 mutation 运行 9/9 绿）。

## 6. Negative control

| 负控 | 形态 | 期望 | 结果 |
|---|---|---|---|
| NC-1（锚点方向） | `ANCHOR-EDGE-NC1`：未盖章帧（返回 0/收口） | 零 `update-sent`；连接域事实在场（记录器活的判据） | 绿 |
| NC-2（型门/R21） | `ANCHOR-EDGE-NC2`：分块族盖 data 章但型为 `UPDATE_CHUNK` | 零普通族 `update-sent`；chunked 族只在 session | 绿 |
| NC-3（镜像隔离） | `ANCHOR-SESSION-C1`：仅 session observer | 零 `update-sent`、零连接域事件（发射点回退 session 即红，M2 实测） | 绿 |
| NC-4（记录器活性元判据） | 每个「零命中」断言同场必有正命中 | 零 ≠ 记录器未接线 | 绿 |
| NC-5（β/α 边界未越界） | 监听矩阵 / β 公共工厂矩阵 `issue418/420/421/423/424` 全套 + route-key/wire parity guard | 全绿 | 绿（§13） |
| NC-6（**RNG 边界负控**，rev2 新增） | 跨轮投影中不得存在 RNG 派生量 | 240 轮独立 boot：`bytes` 仅随 clientID 宽度取 {24,27}；调度不变量投影 238 对 0 不匹配；逐轮自证 0 失败 | 绿（§9 E9；`artifacts/sa6-issue451-order-rng-probe2.log`） |

## 7. Stability, scale and timing

- 确定性：零真实 timer/wall-clock；缝推进 = 显式 `release`/`pumpUntil`；随机源钉死 `random: () => 0.5`（背压/退避面）；**唯一未钉死量 = live Y.Doc `clientID`（CSPRNG）**——rev2 已将其移出契约判据面。
- 修订前：聚焦文件 4/30 红（13.3%，95% CI 约 [3.8%, 30.7%]）；理论不匹配率 11.6521%（§9 E8）；包套件 SA3 3/7 红。
- 修订后：聚焦文件 **40/40 绿**（独立进程，`artifacts/sa6-issue451-rev-postfix-focused-40x.log`）；包套件 **3/3 绿**（105 files / 945 tests，`Type Errors: no errors`）；根 `pnpm test` 见 §13。若旧机制仍在，40 连绿概率 ≈ 0.7%（0.883479^40）——修订是因果修复而非运气。
- 规模条件：live UPDATE 帧 ≤ 数百字节；分块用例 `maxUpdateBytes:16` + `maxChunkedUpdateBytes:1024`（2~3 chunk）；收口用例 20480B 单帧；240 轮 boot 采样总耗时 812ms（每 boot ≈ 3.4ms）。
- 调度扰动（ORDER-C1）证明：扣留/释放时序不改变**调度不变量事实集**；字节长度按轮自证——即 §24.8「跨线程事件无全序」在可执行面上的不变量保持。

## 8. Root-cause chain / capability gap

### 8.1 rev1 验收面缺口（G1–G5，保持）

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| G1 | γ 形态缺**单侧 observer 隔离矩阵**：既有 `#448 LIVE-OBS-C1` 用同一 recorder 同时装两半边，只断「恰一」不能判「哪侧发射」 | `ws-replication-issue448-live-data-plane.test.ts:364-396` | 高 |
| G2 | 逐半边隔离此前只在同步 α/β 工厂形态存在 | `ws-replication-issue423-observer-emission-split.test.ts:548-690,803-892` | 高 |
| G3 | 缺 γ 的「跨线程事件无全序」可执行契约（§24.8 第三项）：既有 γ 套件无合并数组下标断言，但也没有调度扰动不变性契约 | `artifacts/sa6-issue451-order-audit.log`（A/B 零命中；C 的 8 处 `findIndex` 全在单方向 `delivered()`） | 高 |
| G4 | 公共面 append-only 复核有 Δ：`keyof HubAsyncSessionHost` 未冻结（#447 TD-C1 只锁 `open` 签名） | `ws-replication-issue447-async-session-api.test-d.ts:52-96`；`ws-replication-issue421-edge-factory-api.test-d.ts:185-206` | 高 |
| G5 | 无收官门禁的同支证据：listen/β 矩阵 + 包/根门禁 + ADR A4/§24 一致性核对缺可复核记录 | §12.4 + §13/§14 + `artifacts/sa6-issue451-*.log` | 高 |

### 8.2 `ANCHOR-ORDER-C1` 非确定性根因链（rev2 新增）

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| S1 症状 | 门禁间歇红，红灯恒为**唯一**用例 `ANCHOR-ORDER-C1`；`bytes` 24 vs 27，方向可翻转 | SA3 §7.1；`rev-flake-samples.log` 4/30；`sa3-suite-repro.log` 3/7 | 高 |
| S2 直接故障点 | 断言 `expect(projectionB).toEqual(projectionA)`（rev1 文件 `:357`）把 `bytes` 纳入**跨两轮独立 boot** 的按型投影（rev1 `:119-120`） | rev1 文件；SA3 §7.1 | 高 |
| S3 机制 | `bytes` = 出站 UPDATE 载荷长 = `encodeStateAsUpdate(liveDoc, remoteSV)`；Yjs 把 `clientID` 写入载荷 **3 处**，varint 宽度 4→5 ⇒ 载荷长 **+3** | 探针：clientID 宽度 1..5 ⇒ 15/18/21/**24**/**27**，每宽度类恒等且 `clientIDByteRuns=3`；同宽度异值仅 3 个 clientID 字节位不同（offset [2,9,19]）——`artifacts/sa6-issue451-clientid-probe.log` | 高 |
| S4 最深根因 | live 文档 `clientID` **未被生产者钉死**：`registry.create` → `packages/namespace-registry/src/create-document.ts:67/74` → `packages/doc-runtime/src/create-initial-document.ts:160` 裸 `new Y.Doc()` → `lib0/random.uint32()` → `crypto.getRandomValues`（32 位均匀） | 源码链 + 200k 抽样：P(宽 4)=0.061595、P(宽 5)=0.937915 ⇒ 两轮宽度不等概率 **0.116521**（= 契约不匹配率）；`artifacts/sa6-issue451-clientid-probe.log` | 高 |
| S5 触发条件 | 两轮各自独立 boot（A 即时释放 / B 扣留后释放），宽度抽签不等即红；与调度无关（方向翻转即证） | 240 轮实测：宽 4 ⇒ 24B、宽 5 ⇒ 27B，零反例；238 对中 22 对不等 = 22 对宽度不等 | 高 |
| S6 放大因素 | rev1 的 `toEqual` 还同时比较 `acked.bytes`（同一载荷长）——一处抽签放大为 `sent`+`acked` 两个失配面 | `artifacts/sa6-issue451-order-rng-probe.log`（120 轮 `sent==wire==acked` 恒真） | 高 |
| S7 契约缺陷定性 | AC1-c 只要求「γ 测试断言不依赖跨线程事件相对顺序」；跨轮**载荷字节相等**既非顺序事实、也非调度事实，是**超出 AC 语义的过强断言**；且与仓库既有 `#424 ORACLE-2` 口径（数据帧字节相等禁用）冲突 | 简报 AC1 第三句；`ws-replication-issue424-auth-parity.test.ts:16`；`issue418-edge-session-split-contract.test.ts:21,118,460`；SA3 §7.3 | 高 |
| U1 未证实假设（不需要） | 「存在 clientID 之外的载荷差源」 | 240 轮仅 {24,27}；hex 级差仅 clientID 字节位；同宽度异值长度恒等 ⇒ 无第二差源 | 高（已排除） |
| R1 排除项 | 缝调度（即时/扣留）是变量 | 方向翻转 + 两调度各自恰一（M2/M1 mutation 下仍按归属红） | 高 |
| R2 排除项 | timer/wall-clock/并发时序 | 零真实 timer、显式泵；240 轮 boot 在单进程内串行，仍出现双值 | 高 |
| R3 排除项 | 夹具 `harness.ts:306 makeSeedDoc`（SA3 §7.2-3 的归因） | 该 helper 不在 flow round 路径：`bootFlowRound` → `driver.boot` → `harness.makeHubNamespace` → `registry.create` → doc-runtime 自持 `new Y.Doc()`；实测 clientID 与载荷长 1:1（rev2 修正 SA3 的归因，不影响其结论） | 高 |

**生产行为无缺陷、零改动**：`clientID` 随机是 Yjs 正常语义；载荷长度差 3 字节是**合法编码差**而非行为缺陷。缺陷在 rev1 契约的断言边界。

## 9. Causal experiments

| # | 实验 | 控制变量 | 观察 | 结论 |
|---|---|---|---|---|
| E1 | 仅 edge observer（EDGE-C1） | 只改 observer 注入点 | `update-sent` 在场、session 域零命中 | 发射侧 = edge |
| E2 | 仅 session observer（SESSION-C1） | 注入点对调 | `update-acked` 在场、`update-sent` 零命中 | 结算事实发射侧 = session |
| E3 | 宿主直驱（EDGE-C2） | 移除 session 路径（零 data tag） | `update-sent` 仍恰一、`sequence` = 直驱返回值 | 锚 = 盖章点（因果判别） |
| E4 | 双 observer 共 recorder（BOTH-C1） | 两注入点同时在场 | 每事实恰一 | 恰一由「单漏斗 + session 抑制」结构性保证 |
| E5 | 调度扰动（ORDER-C1/C2） | 只改缝释放时序 | 调度不变量投影逐字相同；扣留期两侧事实独立可观察 | 断言不依赖跨半边事件相对顺序 |
| **E8** | **宽度类钉死探针**（纯 Yjs）：同一内容、`doc.clientID` 取 1..5 字节类 | 唯一变量 = clientID | 载荷长 15/18/21/24/27，步长 3；clientID 出现 3 次；同宽度异值仅 clientID 字节位不同 | 载荷长 = f(clientID 宽度)，机制成立（`clientid-probe.log` part 1/2） |
| **E9** | **240 轮真 γ boot 采样** | 唯一变量 = 各轮 CSPRNG 抽签 | 宽 4 ⇒ 24B、宽 5 ⇒ 27B（零反例）；调度不变量投影 238 对 **0** 不匹配；逐轮自证 **0** 失败；旧全投影 22 对不匹配（= 22 对宽度不等） | 非确定性 100% 由 clientID 宽度解释；rev2 判据 0 假红（`order-rng-probe2.log`） |
| **E10** | **边界备选评分**（同 E9 数据） | 三种投影边界 | (i) 含 bytes：22/238 不匹配；(ii) 不含 bytes：0/238；(iii) 逐轮自证：0/240 失败 | 采纳 (ii)+(iii)；剔除 (i) |
| E11 | mutation M1：注释 `hub-edge.ts:286` 的 `emitUpdateSentAtStamp` 调用 | 生产面临时改动，收尾恢复 | **5 failed / 4 passed**（EDGE-C1/C2、BOTH-C1、ORDER-C1/C2） | 发射点消失 ⇒ 正控敏感（与 rev1 一致） |
| E12 | mutation M2：恢复 `hub-namespace.ts:1462` 的 session 侧 `update-sent` 发射 | 同上 | **4 failed / 5 passed**（SESSION-C1、BOTH-C1、ORDER-C1/C2） | 发射点回退 ⇒ 镜像/恰一/顺序断言敏感（与 rev1 一致） |
| **E13** | **mutation M3：edge `bytes: probe.updateBytes + 1**` | 同上 | rev2 契约 **3/9 红**（EDGE-C1/C2 + **ORDER-C1**）；同场用 rev1 边界临时复刻文件 = **2/9 红**（ORDER-C1 绿） | 跨轮相等对**对称字节膨胀**不敏感；rev2 的逐轮自证**新增**敏感性、非弱化 |
| E14 | 恢复核对 | — | `hub-edge.ts`/`hub-namespace.ts` 与原文逐字节相同；临时复刻文件已删除；`src/**` status 空 | 诊断零残留 |

日志：`artifacts/sa6-issue451-rev-mutations-M1-M2-M3.log`（E11–E12）、`artifacts/sa6-issue451-rev-M3-boundary-compare.log`（E13）、`artifacts/sa6-issue451-clientid-probe.log`（E8）、`artifacts/sa6-issue451-order-rng-probe.log` + `-order-rng-probe2.log`（E9/E10）。

## 10. Impact surface（证据触点，HEAD 行号）

| 面 | 代码触点 | 语义 |
|---|---|---|
| edge 盖章点单点 | `src/hub-edge.ts:284-288`（`port.sendDataFrame`：stamp → `seq>0` 门 → 发射）、`:869-885`（`emitUpdateSentAtStamp`：定偏移 `updateFrameProbe`，非 UPDATE 型 dormant） | `update-sent` 唯一发射点（§24.8 / A4.7 / §23.1 edge 行） |
| session 抑制点 | `src/hub-namespace.ts:1453-1462`（普通帧 `info.chunked === undefined → return`，零发射） | 防双发；chunked 族仍在 session |
| session 结算点 | `src/hub-namespace.ts:1416-1440`（`onUpdateAcked`） | §23.1 session 行 |
| live 文档 clientID（**RNG 源**） | `packages/namespace-registry/src/create-document.ts:67/74` → `packages/doc-runtime/src/create-initial-document.ts:160`（裸 `new Y.Doc()`） | 载荷字节长度含其 varint 宽度；生产行为，正确且零改动 |
| 既有字节判据口径 | `test/ws-replication-issue424-auth-parity.test.ts:16`；`test/ws-replication-issue418-edge-session-split-contract.test.ts:21,118,460`；`issue447/448/449` 语义判据先例 | 数据帧禁用跨进程字节相等；rev2 回归该口径 |
| γ 公共面 / 三态锚 / 流控 / 自驱 drain | `src/index.ts`、`src/hub-session-async-host.ts:49-137,114,150/175/267`、`src/types.ts:1024-1048`、`src/update-channel.ts:198-208,450-455`、`src/hub-edge-host.ts:186,982` | 未触碰（rev1 记录保持） |
| 契约触点（本票） | `test/ws-replication-issue451-gamma-observability-anchor.test.ts`（rev2 sha256 `4a8556bb…b3b4c`；9 用例）、`test/ws-replication-issue451-gamma-surface-freeze.test-d.ts`（sha256 `ef897240…c42184`，本轮零改动） | AC1/AC2 可执行载体 |

## 11. Ruled-out hypotheses

| 假设 | 排除依据 |
|---|---|
| H1「γ 缝上 `update-sent` 由 session 发射」 | E1/E2/E3：仅 edge observer 恰一、仅 session observer 零、直驱仍恰一 |
| H2「双发射被共用 recorder 掩盖」 | E4 恰一；E12 mutation 下变 2 ⇒ 断言拦双发 |
| H3「`update-sent{sendQueueMs}` 在 γ 应在场」 | γ 公共缝词汇无 accounting 键（§24.3 闭集合）；EDGE-C1 断言整键缺席 |
| H4「γ 套件已存在跨半边事件序断言」 | 审计 A/B 零命中；C 的 8 处全在单方向 `delivered()`（FIFO 契约内） |
| H5「分块族应发普通族 `update-sent`」 | EDGE-NC2 / SESSION-C2：型门 + R21 改道 |
| H6「公共面有破坏性改动」 | `src/index.ts` 自 spec `c86ccbc` 起 diff = 纯增（+11/−0） |
| H7「全量回归存在与 γ 无关的既有红灯」 | 包套件 105/945、矩阵 20/273、包 tsc/根 typecheck/根 test 全绿（§13） |
| **H8「rev1 的 flake 是时序/并发/环境问题」** | E9：240 轮单进程串行 boot 仍双值；宽度↔字节长 1:1；单文件独立进程 4/30 红；理论率 11.65% 与实测一致 ⇒ 是 RNG 抽签而非时序 |
| **H9「flake 源于夹具 `makeSeedDoc`」** | R3：flow round 的 live 文档由 `registry.create` → doc-runtime 自持 `new Y.Doc()` 创建；`makeSeedDoc` 不在该路径（SA3 归因修正，结论不变） |
| **H10「把 bytes 移出跨调度投影会放过字节事实回归」** | E13：M3（`update-sent.bytes + 1`）在 rev2 下 3/9 红（含 ORDER-C1），在 rev1 边界下仅 2/9 红——rev2 严格更强 |

## 12. Acceptance contract and test paths

### 12.1 契约工件（worktree-relative，可执行）

| 工件 | sha256 / 规模 | 覆盖 |
|---|---|---|
| `packages/ws-replication/test/ws-replication-issue451-gamma-observability-anchor.test.ts` | `4a8556bbecb775fd70a054051ee6599f9600ea01e9a26700a4818ad683bc3b4c`（432 行 / 9 用例） | AC1：`ANCHOR-EDGE-C1/C2`、`NC1/NC2`、`SESSION-C1/C2`、`BOTH-C1`、`ORDER-C1/C2` |
| `packages/ws-replication/test/ws-replication-issue451-gamma-surface-freeze.test-d.ts` | `ef897240096c78a0b45e04cb5cc77f777a351b744a720f86c72a892520c42184`（74 行 / 3 用例 + 2 负控；本轮零改动） | AC2：γ 宿主面成员集冻结 + β 非回退 + `asyncDataAdmissionFatal` 精确 `true` |
| `artifacts/sa6-issue451-order-audit.log` | rev1（保持） | AC1 第三句：γ 套件跨半边事件序依赖审计（零命中） |
| `artifacts/sa6-issue451-listen-beta-matrix.log` | rev1（保持） | AC3：`issue418/420/421/423/424` 全套 + route-key/wire parity guard |
| `artifacts/sa6-issue451-clientid-probe.mjs` + `.log` | 本轮新增（可复跑） | rev2 根因：clientID 宽度 ↔ 载荷长（纯 Yjs 因果探针） |
| `artifacts/sa6-issue451-order-rng-probe.log`、`-order-rng-probe2.log` | 本轮新增 | rev2 根因：120/240 轮真 γ boot 相关性与边界评分 |
| `artifacts/sa6-issue451-rev-*.log` | 本轮新增 | 修订前后采样、M1/M2/M3、门禁（§13） |

夹具复用（零新增协议决策）：`test/issue447-async-seam.ts`、`test/issue450-flow-seam.ts`、`test/harness.ts`、`test/driver.ts`（本轮零改动）。

### 12.2 契约矩阵（最小输入 / 可观察断言 / 负控 / 旧实现预期 / HEAD 预期）

| ID | 最小输入 | 可观察断言（运行时） | 负控 | 旧实现（锚回退/双发）预期 | HEAD 预期 |
|---|---|---|---|---|---|
| ANCHOR-EDGE-C1 | live UPDATE + 仅 edge observer | `update-sent` ×1；`sequence` = wire 序；`bytes` = **本轮**载荷长；session 域 8 型 ×0 | NC-1/NC-4 | 发射点回 session ⇒ ×0 ⇒ 红 | 绿 |
| ANCHOR-EDGE-C2 | egress 直驱 UPDATE | `update-sent` ×1；`sequence` = 返回值；零 data tag | 同上 | 锚在 session ⇒ 直驱零事件 ⇒ 红 | 绿 |
| ANCHOR-EDGE-NC1 | 20480B 直驱 + cap 16384 + γ 标记 | 返回 0；`connection-failed{FRAME_TOO_LARGE}` ×1；`update-sent` ×0 | 正命中 `connection-failed` | `seq=0` 仍发射 ⇒ 红 | 绿 |
| ANCHOR-EDGE-NC2 | kind=0 分块（`maxUpdateBytes:16`） | 每 chunk 盖章；普通族 `update-sent` ×0；`chunked-update-sent` ×1 | 同场 chunk 戳记在场 | 型门失效 ⇒ 红 | 绿 |
| ANCHOR-SESSION-C1 | live UPDATE + 仅 session observer | `update-acked` ×1（seq/bytes 对本轮 wire 自证）；`update-sent` ×0；连接域 6 型 ×0 | 记录器活性 | 发射点回 session ⇒ `update-sent` ×1 ⇒ 红（E12 实测） | 绿 |
| ANCHOR-SESSION-C2 | kind=0 分块 + 仅 session observer | `chunked-update-sent/acked` ×1；普通族 ×0；连接域 ×0 | 同上 | 改道失效 ⇒ 红 | 绿 |
| ANCHOR-BOTH-C1 | 双 observer 共 recorder | 两型各 ×1，同 wire 序 | 同场双型在场 | 双发 ⇒ ×2 ⇒ 红（E12 实测） | 绿 |
| **ANCHOR-ORDER-C1**（rev2 边界） | 即时 vs 扣留两调度 | **调度不变量投影**（`type/side/namespaceId/sequence`）逐字相同 + 计数恰一；**每轮** `sent/acked.bytes === 本轮 wire 载荷长`、`acked.sequence === sent.sequence` | 两调度各自恰一 + 逐轮自证（E9：0 假红） | 调度敏感（漏发/重发/错侧）⇒ 红；两轮对称字节说谎 ⇒ 红（E13，rev2 新增） | 绿 |
| ANCHOR-ORDER-C2 | 扣留期 + 释放 | 扣留：sent ×1 / acked ×0 且 `pending()>0`；释放：各 ×1 同序 | `pending()>0` | 依赖相对位置/顺序的断言 ⇒ 红 | 绿 |
| SURFACE-C1..C3 | 类型层（编译期） | `keyof HubAsyncSessionHost = 'open'`；β 监听器返回 `number`；`asyncDataAdmissionFatal = true \| undefined` | 2 条 `@ts-expect-error` | 破坏性改名/γ 回灌 β/放宽 boolean ⇒ 红 | 绿 |
| GATE-PKG / GATE-ROOT | 仓库真实入口 | 包套件 + 包 tsc + 根 tsc + 根 test 全绿 | — | — | 绿（§13） |
| CONSISTENCY（AC5） | ADR A4.1–A4.8 / §24.1–24.8 逐条 | 代码触点 + 既有测试锚 + 本票契约锚（§12.4） | 登记 2 条非缺陷观察（§15 O-1/O-2，已由 SA3 D2 落地） | — | 一致 |

### 12.3 边界登记（与相邻票分工）

- #447（T1 缝/工厂）、#448（T2 数据面）、#449（T3 reconcile+分块）、#450（T4 流控/生命周期）：机制与逐片验收已由各自契约承载；本票只做总归属矩阵 + 收官门禁 + 本轮 ORDER-C1 边界修订，不重复其数据面矩阵，不修改其断言。
- AC5「转人工合并」：本票只产出可复核的一致性结论与证据；合并动作（PR 流程）非 SA6 权限，移交人工收口。

### 12.4 AC5 一致性核对表（ADR 0032 A4 / 协议 §24 同支核对，HEAD 68ab9f5）

| 条款 | 要求（摘要） | 代码触点（HEAD） | 验收锚 | 判读 |
|---|---|---|---|---|
| §24.2.1 | 每 (connectionKey, namespaceId) 一对专用通道；每方向 FIFO | 宿主桥（`issue447-async-seam.ts:432-455` FifoSeamChannel）+ 会话 `open` 描述子 | #447 SEAM/PIPE 族 | 一致（宿主义务） |
| §24.2.3 | edge 在盖章点**同步**投回执（先于后续 socket 数据） | `issue447-async-seam.ts:527-546` ＋ edge 返回 stamp（`hub-edge.ts:284-288`） | #448 LIVE-ORD、#449、ORDER-C1/C2 | 一致（宿主义务） |
| §24.3 | 缝词汇闭集合 | `hub-session-async-host.ts` 公共类型；夹具 `SEAM_VOCABULARY` 判据 | `ws-replication-issue447-async-seam-fixture.test.ts:183` | 一致 |
| §24.4 | pending→登记两相记账、rekey 换键不换槽、ACK 保序因果 | `update-channel.ts:198-208,450-455`；`hub-session-async-host.ts:161-176` | #447 窗口族、#448 LIVE-WINDOW/ACK、#449 | 一致 |
| §24.5 | 流控单点（edge）；越界 = 连接终局；β 逐字不变 | `hub-edge-host.ts:186,982`；`backpressure.ts` | #450 BPK/OVS/MEM | 一致 |
| §24.6 | session 自驱 drain，推完即停 | `hub-session-async-host.ts:150,175,267-…` | #448 LIVE-DRAIN、#449 CHUNK3、#450 | 一致 |
| §24.7 | 收口后静默丢弃；close 同道 FIFO；terminate 不溯及已推帧 | 会话句柄 close/terminate + 信号面 | #450 DROP/FLUSH/TERM | 一致 |
| §24.8 | `update-sent` = edge 盖章点；`update-acked`/chunked 族 = session；跨线程无全序 | `hub-edge.ts:286,869`；`hub-namespace.ts:1416,1462` | #423 EM-C4、#448 LIVE-OBS-C1、**ANCHOR-\***（rev2 边界） | 一致（rev2 修订后：跨线程无全序的可执行判据只含调度不变量事实） |
| A4.1 | γ 公共面 append-only；β 冻结签名逐字不动 | `index.ts` 纯增 diff；`hub-session-async-host.ts:49-137` | #447 TD-C1/C2、#421 EF-C2、SURFACE | 一致 |
| A4.2 | 三态锚 + 回执 rekey；违契响亮收口 | `types.ts:1024-1048`；`update-channel.ts:198-208` | #448 LIVE-ACK-C2/C3 | 一致 |
| A4.3 | γ 与 β 显式行为差登记；水位前置门删除 | `hub-edge-host.ts:124-133,982` | #450 BPK-C1/C4 vs NC1/NC2 | 一致 |
| A4.4 | 推-FIFO pacing；γ 不保持跨 session 轮转公平 | `hub-session-async-host.ts:220,267` | #448 LIVE-DRAIN、#449/#450 | 一致 |
| A4.5 | 生命周期单规则 | §24.7 触点 | #450 | 一致 |
| A4.6 | 回执 ≠ 接纳信号 | 句柄无 accept 面 | #447 TD-C1 负控 ⑤ | 一致 |
| A4.7 | 观测口径登记（同 §24.8） | 同 §24.8 | 同 §24.8 + 本票 | 一致 |
| A4.8 | 成功路径 β wire 等价；listen/β 矩阵硬门 | — | #448 LIVE-PARITY、#424 ORACLE、矩阵日志 | 一致 |

### 12.5 契约修订裁定：`ANCHOR-ORDER-C1` 的正确可执行边界（dispatch 交办）

**裁定**：跨调度（跨线程无全序）契约**只允许**比较**调度不变量**事实：每型事件的 `type`/`side`（归属侧）/`namespaceId`/`sequence` 与计数；`bytes` 属**单轮自证事实**（每轮 `bytes === 本轮 wire 载荷长`）。**任何跨独立 boot 的字节相等断言**，在生产者未钉死编码输入（此处 = live doc `clientID`）时都是 RNG 抽签检测，**不得进入契约**。该裁定不是放宽：它以「同轮 wire 自证」替代「跨轮抽签相等」，对字节事实说谎的敏感性由 E13 证明为**增强**。

**备选与裁决**：

| 备选（SA3 §7.4 编号） | 内容 | 裁决 | 理由 |
|---|---|---|---|
| A | 夹具钉死 live seed 文档 `clientID`（仿 `issue450-flow-seam.ts:311`） | **否决** | ① flow round 的 live 文档由**生产路径** `doc-runtime/create-initial-document.ts:160` 创建，钉死 = 生产改动（违反本票零生产改动边界）；② 测试侧钉死需经共享夹具/registry testing seam（`namespace-registry/src/testing.ts:140-145`）或直改 live `Y.Doc` 内部（`persistence.peek`）——前者波及 #447–#450 契约与并行 boot 机制，后者使断言依赖私有夹具内部与文档生命周期旁路；③ 断言将验证「夹具强制的巧合」而非生产可观察不变量；④ SA3 对该路径的归因（`harness.ts:306 makeSeedDoc`）经 R3 修正后不成立 |
| B | `bytes` 移出跨调度投影，每轮对**本轮自身** wire 载荷断言 | **采纳** | 最小、单文件、零生产改动；与仓库既有 `#424 ORACLE-2` 口径一致；E9/E10 证明 0 假红；E13 证明字节敏感性由 EDGE-C1/C2 + ORDER-C1 三层承载 |
| C | 折中：跨调度断言投影键集相等 + 各自 `bytes === payloadBytesOfFrame(round, seq)` | **采纳**（与 B 合并） | 即 rev2 形态：`toEqual` 于调度不变量投影 + 逐轮自证；键集随投影字段固定（`anchorProjection` 定义） |
| D（本报告新增） | 归一化/掩码载荷中的 clientID 字节后再比较 | **否决** | 需解析 Yjs 编码内部（脆弱、版本耦合），且是「掩盖事实」而非「断言正确不变量」 |

**下游 required evidence（设计修订后重跑实现阶段的验收证据集）**：

| # | 证据 | 入口/命令 | 通过判据 |
|---|---|---|---|
| EV-1 | 契约确定性 | 聚焦契约文件独立进程 ≥30 次 | 0 红（本轮 40/40；修订前 4/30） |
| EV-2 | 包门禁 | `npx vitest run packages/ws-replication` ≥3 次 | 105 files / 945 tests 全绿，`Type Errors: no errors`（本轮 3/3） |
| EV-3 | 根门禁 | `pnpm typecheck`；`pnpm test` ≥1（SA3 已指出单样本风险，建议 ≥2） | exit 0；468 files / 5675 tests 全绿（本轮见 §13） |
| EV-4 | 敏感性（归属） | M1（edge 发射关闭）、M2（session 发射恢复）复跑 | M1 = 5/9 红、M2 = 4/9 红，红灯落对应归属断言；恢复后 `src/**` 逐字节复位（本轮已做） |
| EV-5 | 敏感性（字节事实） | M3（`update-sent.bytes + 1`） | ≥3/9 红且含 ORDER-C1（rev1 边界下仅 2/9——不得回退该边界） |
| EV-6 | RNG 根因回归 | `node artifacts/sa6-issue451-clientid-probe.mjs` + 真 boot 采样（≥200 轮） | clientID 宽度 ↔ 载荷长 1:1、零反例；契约判据零假红 |
| EV-7 | 不变量 | `git status --short packages/ws-replication/src/`；两契约文件 sha256；HEAD | src 恒空；surface-freeze sha 不变；HEAD 未前移（或前移后按 §12 重核） |
| EV-8 | 设计/规范收口 | SA1 修订 §7-D1（冻结裁定）、§11 DENY（该测试文件的处置）、§12 AC4-a 口径；SA8 按 §10 触发复查 | 契约不再被表述为「内容冻结不可修订」；AC4-a 验收口径承认「无 RNG 派生量的跨轮断言」 |

## 13. Red/green or baseline evidence

| 证据 | 命令/入口 | 结果 | 文件 |
|---|---|---|---|
| 修订前·聚焦文件采样 | `npx vitest run …issue451-gamma-observability-anchor.test.ts` ×30 | **4 failed / 26 passed**（红灯恒 ORDER-C1；13.3%） | `artifacts/sa6-issue451-rev-flake-samples.log` |
| 修订前·包套件采样 | `npx vitest run packages/ws-replication` ×3 | 3 绿（与抽签率相容） | `artifacts/sa6-issue451-rev-prefix-suite-samples.log` |
| 修订前·SA3 包套件采样 | 同上 ×7 | 3 红 / 4 绿 | `artifacts/sa6-issue451-sa3-suite-repro.log`、`-sa3-suite-samples.log` |
| **修订后·聚焦文件采样** | 同上 ×40（独立进程） | **40/40 绿**（`Tests 9 passed (9)`） | `artifacts/sa6-issue451-rev-postfix-focused-40x.log` |
| **修订后·包套件** | 同上 ×3 | **3× 105 files / 945 tests 全绿；Type Errors: no errors** | `artifacts/sa6-issue451-rev-postfix-suite-3x.log` |
| **mutation M1（红）** | 临时注释 `hub-edge.ts:286` 发射调用 | **5 failed / 4 passed** | `artifacts/sa6-issue451-rev-mutations-M1-M2-M3.log` |
| **mutation M2（红）** | 临时恢复 `hub-namespace.ts:1462` session 发射 | **4 failed / 5 passed** | 同上 |
| **mutation M3（红）** | 临时 `bytes: probe.updateBytes + 1` | **3 failed / 6 passed**（EDGE-C1/C2 + ORDER-C1） | 同上 |
| M3 边界对照 | 同 M3，另跑 rev1 边界临时复刻文件 | rev1 = **2 failed**（ORDER-C1 绿）；rev2 = **3 failed** | `artifacts/sa6-issue451-rev-M3-boundary-compare.log` |
| 包 tsc | `npx tsc -p packages/ws-replication/tsconfig.json` | exit 0（零输出） | `artifacts/sa6-issue451-rev-package-tsc-root-typecheck.log` |
| 根 typecheck | `pnpm typecheck`（15 段链） | exit 0 | 同上 |
| 根 test（run 1） | `pnpm test`（`vitest run --typecheck`，maxWorkers 1） | **468 files / 5675 tests 全绿；Type Errors: no errors**；两 #451 文件被真实入口发现 | `artifacts/sa6-issue451-rev-root-test.log` |
| 根 test（run 2，独立样本） | 同上 | **468 files / 5675 tests 全绿；Type Errors: no errors**（revised sha 在日志首部备案） | `artifacts/sa6-issue451-rev-root-test-2nd.log` |
| 生产零改动 | `git status --short packages/ws-replication/src/` | 空（诊断后、mutation 恢复后各核一次） | §16 |

**红/绿判读**：基线为绿（Refactor 收官票，如实呈现）；rev1 的跨轮字节相等断言在 11.65%/对 的抽签率下间歇红（契约缺陷）；rev2 移除 RNG 派生判据后 40 连绿（旧机制下概率 ≈ 0.7%），且 M1/M2/M3 双向+字节三路 mutation 反证断言仍敏感（红灯落点正确）。

## 14. Runner trigger evidence

- 运行期契约：`NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication/test/ws-replication-issue451-gamma-observability-anchor.test.ts` → 被 `vitest.config.ts` 的 `include: ['packages/*/test/**/*.test.ts', …]` 发现（包套件/根测试日志逐文件列出 `…issue451-gamma-observability-anchor.test.ts (9 tests)`）。
- 类型期契约：`npx vitest run --typecheck …/ws-replication-issue451-gamma-surface-freeze.test-d.ts` → 被 `test.typecheck.include: ['packages/*/test/**/*.test-d.ts']` 发现（根测试日志 `✓ TS … (3 tests)`）；同一文件亦被 `tsc -p packages/ws-replication/tsconfig.json`（`include: test/**/*.ts`）与根 `pnpm typecheck` 覆盖。
- 门禁入口 = 仓库真实脚本：包 `npx tsc -p`、根 `pnpm typecheck`、根 `pnpm test`。无 skip/only/todo、无 env override、无 fallback、无断言软化（唯一改动 = 移除 RNG 派生跨轮量与新增逐轮自证，见 §12.5）。

| 门禁 | 命令 | 结果 |
|---|---|---|
| 包套件 | `npx vitest run packages/ws-replication` ×3 | 105 files / 945 tests 全绿 |
| 包 tsc | `npx tsc -p packages/ws-replication/tsconfig.json` | exit 0 |
| 根 typecheck | `pnpm typecheck` | exit 0（15 段链全过） |
| 根 test | `pnpm test` | 2 次独立样本：均 468 files / 5675 tests 全绿；`Type Errors: no errors` |
| 矩阵 | 20 文件（issue418/420/421/423/424 + parity） | 273 tests 全绿（rev1 证据保持；本轮零相关改动） |

## 15. Unknowns and blockers（交设计/收官裁定）

- **O-1（非缺陷，登记项）§24.2.3「回执在盖章点同步投递」是宿主义务**：nomicore 公共面只提供 edge 盖章返回值与 `HubAsyncSessionHandle.handleReceipt(tag, sequence)`；两者之间的桥（同步入队）在宿主侧（本仓以夹具 `issue447-async-seam.ts:527-546` 具现）。会话侧对缺回执有响亮路径（`ACK_STATE_VIOLATION`）。**已由 SA3 D2 落地**为 `packages/ws-replication/AGENTS.md` 的 γ 桥义务 bullet（本报告不重复落笔）。
- **O-2（文档面）observer 两侧注入纪律**：已并入 D2 同一 bullet（事实所有权 + 跨线程无全序纪律）。
- **B-1（必须由 SA1 处理，非本报告权限）**：设计 §7-D1「既成验收面内容冻结、零改动」与 §11 DENY（该测试文件）以「确定性已证」为前提，该前提被 SA3/本报告证伪；§12 AC4-a 的验收口径需按 §12.5 修订。**`requiresConflictRecheck: true`**（SA8 §10 第 2 条触发：门禁复跑发现需改契约才能转绿）。本报告已完成契约侧修订与全部证据；设计侧文本留待 SA1 原位修订。
- **R-1（采样说明）**：根 `pnpm test` 单次运行无法完全排除同源 flake 的历史风险；rev2 已结构性移除 RNG 判据（40 连绿 + E9 0 假红），并按 §12.5 EV-3 建议 ≥2 次复跑（本轮 run 2 见 `artifacts/sa6-issue451-rev-root-test-2nd.log`）。
- 无阻塞：全部门禁可在本环境离线复现（store 命中）；无缺失环境。

## 16. Temporary diagnostics cleanup

| 临时改动 | 用途 | 清理 | 证据 |
|---|---|---|---|
| `src/hub-edge.ts:286` 注释发射调用（M1） | 敏感性反证 | 原文逐字节复位；`git status --short packages/ws-replication/src/` 空 | `artifacts/sa6-issue451-rev-mutations-M1-M2-M3.log` |
| `src/hub-namespace.ts:1462` 恢复 session 发射（M2） | 镜像敏感性反证 | 同上 | 同上 |
| `src/hub-edge.ts` `bytes + 1`（M3） | 字节事实敏感性反证 | 同上（M3 两轮均复位：`rev-mutations` 与 `rev-M3-boundary-compare` 各验一次） | 同上 + `-rev-M3-boundary-compare.log` |
| `test/zz-sa6-temp-order-rng-probe.test.ts`（120/240 轮采样探针） | 真 γ boot 相关性 | **已删除**（收尾核对不存在） | `artifacts/sa6-issue451-order-rng-probe*.log` |
| `test/zz-sa6-old-boundary-probe.test.ts`（rev1 边界临时复刻） | M3 边界对照（E13） | **已删除**（脚本内 `unlink` + 收尾核对） | `artifacts/sa6-issue451-rev-M3-boundary-compare.log` |
| `/tmp/sa6-*.sh`、`/tmp/*.out`、mutation 脚本 | 编排 | 临时文件在 `/tmp`（非 worktree），不随交付 | — |

**最终 worktree 变更面**：`packages/ws-replication/test/ws-replication-issue451-gamma-observability-anchor.test.ts`（rev2 边界修订，9 用例）、`artifacts/sa6-issue451-*.log`（证据）、`artifacts/sa6-issue451-clientid-probe.mjs`（最小复现探针）、`wiki/raw/task_issue-451_sa6_contract.md`（本报告）、`packages/ws-replication/AGENTS.md`（SA3 D2，本会话零改动）。生产实现零改动。

> **根门禁出口码**（定稿采信）：包 tsc = 0；根 typecheck = 0；根 test 2 次独立样本均 = 0（468/5675，`Type Errors: no errors`）；见 §13 各行日志。
