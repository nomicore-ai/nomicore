# task_issue-421 SA4 实现静态评审 — Edge 公共工厂：accept 双入口 + OPEN 准入管线 + sequence 盖章（spec #415 T4）

- 迭代：**2**（SA4 迭代 1 `reject`（F1/F2 两 MAJOR）→ SA3 返工 → 本轮复核修复 + 聚焦回归；本文件原位更新）
- 被审对象：worktree `/home/wangjian/nomicore-fix-issue-421` @ HEAD `7039f6d` 之上的 SA3 实现（`wiki/raw/task_issue-421_sa3_impl.md` 迭代 2 所列全部 diff）
- 评审方式：静态审查——逐行读取修复面（`hub-edge-host.ts` 全文 955 行）与新增 OAP-C11 回归块（4 用例全文）及其 fixture/harness 依赖、只读 git diff/status、与设计 §7-D3/§8.2/§9.3 与 SA6 契约 OAP-C4/C5/C8 逐锚点互证；未运行测试、未启动服务、未修改任何实现/设计/测试
- Verdict：**`approve`**（迭代 1 的 F1/F2 两 MAJOR 均已按 SA4 §10 required change 修复并有达标回归；无新增 BLOCKER/MAJOR；MINOR 观察见 §12）

---

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-421.md`（Issue 正文 + AC1–AC6；Owner 评论 REST 快照空数组 = 无评论级要求，dispatch 明示） | 已读 |
| `wiki/raw/task_issue-421_design.md`（迭代 1，732 行；本轮重点亲核 §7-D3（L258–298，SD-5 全文）、§8.2 伪码（L376–454）、§9.3（L566–580）） | 已读 |
| `wiki/raw/task_issue-421_sa6_contract.md`（§5 G1–G9、§12.2 OAP-C1..C10、§12.0 SD-2/SD-3；本轮重点 OAP-C4/C5/C8 语义基线） | 已读 |
| `wiki/raw/task_issue-421_sa2_review.md`（approve；R1–R6/N1–N6） | 已读（迭代 1 已全读，本轮对照维持） |
| `task_issue-421_design_conflict_report.md`（clear）+ `_conflict_report.md`（clear）+ `_relevant_decisions.md` + `_implementation_conflict_report.md` | 已读 |
| `wiki/raw/task_issue-421_sa3_impl.md`（迭代 2 报告：§3 变更清单、§5 SA4 Finding 落实表、§6 范围、§7 验证含红灯基线、§8 deferred 两项、§9 deviations） | 已读 |
| `wiki/raw/task_issue-421_sa4_review.md`（迭代 1 本产物：F1/F2 required change 与验收标准） | 已读（作为本轮返工契约） |
| 生产源码：`hub-edge-host.ts`（955 行全文重读——修复面 L323–346/L459–468/L484–499 与其余全部岗位就地复核）；`hub-upgrade-admission.ts`/`hub-edge.ts`/`hub-split.ts`/`hub-connection.ts`/`index.ts`/CONTEXT.md（迭代 1 全读，本轮 git diff/stat 复核 = 与迭代 1 逐字节同集） | 已读并互证 |
| 测试：`ws-replication-issue421-open-admission-pipeline.test.ts`（1214 行全文——fixture L60–366 + 既有 36 用例抽查（OAP-C4c/C4d/C5a/C5b/C8d 亲读）+ OAP-C11 新块 L1046–1213 全文）；`test/harness.ts` `settle`/`settleUntil`（L249–268）与 `test/driver.ts` 依赖复核；其余 6 个 issue421 测试（迭代 1 全读，零改动） | 已读 |
| 只读 git 证据：`git status --porcelain`（4 M + 25 ??——与迭代 1 同集 + 本 review 自身）、`git diff --stat`（4 tracked 文件 ± 与迭代 1 完全一致：CONTEXT.md 4±、hub-connection.ts −110/+5、index.ts +16、contract test +1）；纪律 grep（7 个 issue421 测试文件零 skip/only/todo/readFileSync/源码串断言）；`vitest.config.ts` include（L15/L20——OAP 文件与 test-d 均被真实入口发现） | 已核 |

缺失输入：无。Owner 评论快照为空——无评论级要求需要核对。

## 2. Verdict

**`approve`**。

迭代 1 的两个 MAJOR 均已按 SA4 §10 的 required change 精确修复，且各带达标的聚焦回归：

- **F1（已修复）**：no-sink 重 OPEN 分支（`hub-edge-host.ts:323–346`）现于**记录建立/计数/`runResolve` 之前**镜像两道上界——`pendingOpenCount >= MAX_CONCURRENT_OPEN_ADMISSIONS`（L330）与 `pendingFrameCount >= MAX_PENDING_FRAMES_PER_CONNECTION`（L334），超界均 `port.connectionFatal('CONNECTION_POLICY_VIOLATION', 1008)` 并 return：被拒重 OPEN 保持 no-sink、零计数变化、零 `resolveSessionSink` 调用、不建会话。与首开分支（L295）/`pushPending`（L378）同码同拓扑，落实设计 §7-D3 SD-5「并发重解析受阶段 5 上界约束」+ §9.3「两者溢出均响亮收口」，SA6 G6/OAP-C5 威胁面（无界 in-flight OPEN 放大宿主资源）在该路径上关闭。回归 OAP-C11a（并发上界满 + 重 OPEN → 恰一帧连接级 `CONNECTION_POLICY_VIOLATION` + close(1008) + 零新解析 + 迟归 authorize R4b 静默）、OAP-C11b（帧预算满 + 重 OPEN 占位项 → 同码收口）、OAP-C11c（负控：上界内重解析照常建会话、authorize 恰一次 = grant 复用）逐条命中 SA4 验收标准 (a)/(b) 与占位项预算条款。
- **F2（已修复）**：no-sink 结算（`hub-edge-host.ts:459–468`）把 `this.discardBuffer(namespaceId)` 移到 `table.set(no-sink)` phase 迁移**之前**；`discardBuffer`（L495–499）守卫由 phase 判定改为**缓冲在场**判定（`!('buffer' in record)`，对齐设计 §8.2 L441 `rec.buffer.length === 0` 早退语义）——迁移前记录仍携带 buffer，唯一递减点 `releaseBuffer`（L486）照常执行，`pendingFrameCount` 在每次 no-sink 终局足额归还。回归 OAP-C11d（17 轮「重 OPEN → undefined」零虚假收口 + authorize 恰一次；随后新 ns 窗口 1 占位 + 15 帧满额可用；第 17 项仍响亮收口 = 上界未被禁用；迟归解析零新 wire）逐条命中 SA4 验收标准。

账目全量复盘（本轮新增核验）：递增点恰三处（首开占位 L305、`pushPending` L385、no-sink 重开占位 L344），递减单点 `releaseBuffer` 经四路到达（`flushPending`/`discardBuffer`/`finishTerminal`/`finishTerminalSilently`）；`releaseBuffer` 清零 buffer（幂等）、每个 buffer 数组只隶属一条记录、记录不再复活已释放 buffer → 无剩余泄漏路径、无双重递减路径。established 终局次序（table.set 先于 flush）无泄漏——flush 直接持有旧记录 buffer 引用释放，与新表态无关。

红灯纪律（SA3 报告值，静态一致性核验）：修复前 `-t 'OAP-C11'` 3 failed | 1 passed——C11a `expected 'ready' to be 'closed'`（= F1 静默进入 pending 的静态预测）、C11b/d 负控窗被虚假 `[{code:1008}]` 收口（= F2 预算泄漏的静态预测：C11b 首个 no-sink 结算泄漏 1 项使 16 项负控窗提前触界；C11d 17 轮后新 ns 首帧即收口）、C11c 修复前后皆绿（负控不依赖缺陷）。失败形态与缺陷静态模型逐点吻合；SA4 不运行测试，GATE 独立复算保留在 §11。

修复面集中在 `HostSessionAdapter` 单点（两道上界 + 一处次序 + 一行守卫），架构主线（内部 edge 零 diff）、冻结面、门序、既有 36 个 OAP 用例断言（OAP-C4c/C4d/C5a/C5b/C8d 亲读复核）零触碰。未发现任何新增 BLOCKER/MAJOR。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| AC1：工厂从公共入口导出、签名经 test-d 锁定 | `src/index.ts` +16（迭代 1，零改动本轮）；`edge-factory-api.test-d.ts` 逐成员锁定 | 落实（维持迭代 1 结论） |
| AC2：OPEN 准入管线按序全分支 | 七阶段岗位齐备（迭代 1 §3 已核）；本轮修复后**阶段 4/5 上界在 no-sink 重解析路径同样生效（F1）**、**阶段 4 账目在 no-sink 终局足额归还（F2）** | **落实**（迭代 1 的「部分落实」升格） |
| AC2 内嵌：拒绝闩锁 + 重 OPEN 拒答 + 未授权不过缝 | `finishTerminal` 闩锁；`NAMESPACE_REOPEN_REQUIRES_RECONNECT` 仅 wire 帧；deny 路径零回调（OAP-C3a） | 落实 |
| AC3：路由键两分支逐字节复现单体语义 | 内部 `routingKeyOf`/R-none 零改动复用 + RK-C3 hex 逐字节 | 落实 |
| AC4：ERROR mini-decode 有界扫描路由 | 内部特例零改动 + ER-C1a..d | 落实 |
| AC5：出站盖章与单体逐字节一致 | egress 五成员 port 等价 + WS-C1..C3 | 落实 |
| AC6：liveness/GOAWAY/reauth/drain 提前完成观测 | LC-C1..C4 全组 | 落实 |
| 宿主回调 `resolveSessionSink` 授权通过后调用 | `runResolveInner`（`Promise.resolve` 包裹；grant = ok 投影） | 落实 |
| SA2 R1–R6 / SA8 A1'(a)–(d) / A5 | 迭代 1 全部落实（本轮 git diff 复核同集零变化） | 落实 |
| **SA4 F1（迭代 1 MAJOR）** | `hub-edge-host.ts:323–346` 两道上界前置 + 同码收口；OAP-C11a/b/c | **已修复**（见 §2/§10） |
| **SA4 F2（迭代 1 MAJOR）** | `hub-edge-host.ts:459–468` 释放先于迁移 + `:495–499` 缓冲在场守卫；OAP-C11d | **已修复**（见 §2/§10） |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| D1 Architecture-C / D2 / D3 阶段 1–3、6、7 / D4 门序 / D5 / D6 / D7 | 迭代 1 §4 全表已核；本轮源码就地复核零变化 | 落实 | — |
| D3 阶段 4/5：**no-sink 重解析受两道上界约束**（SD-5 + §9.3） | `openNamespace` `case 'no-sink'`：两检查（L330/L334）先于 `table.set`（L338）/计数（L343–344）/`runResolve`（L345）；超界 `CONNECTION_POLICY_VIOLATION`/1008 与首开/`pushPending` 同码 | **落实**（迭代 1 F1 关闭） | — |
| D3 SD-5：undefined → no-sink 终态 + settled + 缓冲静默丢弃（含账目归还） | `runResolveInner` L459–468：`discardBuffer` → `table.set(no-sink)` → `pendingOpenCount--` → `onChannelSettled`；`discardBuffer` 守卫 = 缓冲在场（L497，= 设计 §8.2 L441 语义） | **落实**（迭代 1 F2 关闭；合流 OPEN 零应答 = §13-1(b) 登记选择，OAP-C4b-no-sink 保持） | — |
| §8.2 伪码 vs 实现残余差异 | (i) 伪码 L390–391 no-sink 行无上界注记——**实现按规范正文（§7-D3/§9.3）补齐**，正文优先于伪码属正确取舍；(ii) 伪码 L381–385 首开分支同样只查并发上界、帧占位直接 `++`——实现与伪码逐形一致（见 §12-M6 裁决） | 落实（差异均为伪码级，非实现偏离） | M6/M7（MINOR） |
| §8.6 观测面 / §8.1 构造期校验 | 迭代 1 结论维持（M1/M2 观察） | 落实（设计枚举面内） | M1/M2 |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| 连接级 FSM / authorize 单点 / 早到帧 admission 单点 | 内部 edge / `hub-upgrade-admission.ts` | 零 diff（git status 复核） | 正确 |
| 准入管线岗位（缓冲/上界/解析/收口/账目） | edge 侧适配器（决策 3） | `HostSessionAdapter` 单点——本轮修复未引入第二 FSM/第二账本（递减仍单点 `releaseBuffer`） | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| admission 有界先例（`MAX_EARLY_FRAMES` 账法） | 溢出同码 1008 | no-sink 重开两道检查与首开/`pushPending` 同码同拓扑 | 一致（迭代 1 破口已闭合） | F1 修复后三处入口同纪律 |
| deny/throw 应答复刻 / 出站字节缝 | 单体 waiter 语义 / `hub-session.ts` sendData | 复刻保持（本轮零触碰） | 一致 | OAP-C4b/WS 组回归在档 |

### 单一事实源 / 生命周期对称性 / 平行机制检查

- 单一事实源：与迭代 1 相同四项（edge 台账 / connectionKey / OutboundQueue / settled 集），本轮修复未新增派生状态——上界检查读的就是账本计数本身（无第二计数器）。
- 生命周期对称性：准入记录四类终局（denied/failed/no-sink/established）+ 迟归卫生路径**全部归还帧预算**（迭代 1 唯一不对称点 = no-sink 终局，本轮闭合）；`pendingOpenCount` 对称（重开 +1 / 终局 −1；收口连接冻结）。
- 平行机制：无新增（两处 helper/白盒导出维持迭代 1 处置）。

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/ws-replication/src/hub-edge-host.ts`（936 → 955 行，+19 = 修复 + 注释） | §10 行 1 | F1 两道上界 + F2 次序/守卫（`HostSessionAdapter` 单点） | 合规 |
| `packages/ws-replication/test/ws-replication-issue421-open-admission-pipeline.test.ts`（1040 → 1214 行，+174 = 纯追加） | §10 行 8（SA4 §10 要求「新增回归测试」） | 文件头覆盖清单 +1 行（L29–32）；文件尾 OAP-C11 describe 四用例（L1046–1213）；既有 36 用例断言零变化 | 合规 |
| `hub-upgrade-admission.ts` / `index.ts` / `hub-connection.ts` / #418 contract test / `CONTEXT.md` / 其余 6 个 issue421 测试 | §10 行 2–7、9–12 及末行 | 本轮零改动（git diff --stat 与迭代 1 逐字节同集：4±/−110+5/+16/+1） | 合规 |
| `wiki/raw/task_issue-421_sa3_impl.md` / 本 review | 技能固定产物 | 报告 | 合规 |

DENY 面零触碰：`packages/replication-protocol/**`、`hub-edge.ts`、`hub-split.ts`、`hub-session.ts`、`hub-namespace.ts`、`frame-io.ts`、`backpressure.ts`、`liveness.ts`、`observer.ts`、`defaults.ts`、`validate.ts`、`types.ts`、`plugin.ts`、`peer-*`、`testing.ts`、`docs/**`、`apps/**`、既有测试（唯 C5a 一处）全部不在本轮 changed path。未创建 ALLOW 之外路径（无临时脚本/marker/日志目录；`artifacts/sa6-*` 为 Host/SA6 资产，迭代 1 在档）。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| （迭代 1 §7 前六行：导出面/模块键面/新公共缝/egress 面/序列纪律/单体 listen 路径） | — | 本轮零变化 | 无 | — |
| no-sink 重解析放大面 | 宿主 resolver | 两道上界前置收口；被拒重 OPEN 零解析调用（OAP-C11a 断言 `resolveCalls` 不变） | 低（已闭合） | — |
| pending 帧预算（连接级 16） | 后续一切 pending 窗口 | no-sink 终局足额归还（OAP-C11d：17 轮后新窗口满额可用）；三递增点全部过界检查（首开占位的 +1 有界角见 M6） | 低（已闭合） | M6（MINOR） |

## 8. 错误、恢复与并发

| 检查点 | 结论 |
|---|---|
| 错误吞没/伪装成功 | deny/throw/reject 响亮；F1 被拒重 OPEN 响亮收口且零副作用；F2 修复消除「账目静默漂移 → 虚假 1008」面 |
| 部分完成诚实报告 | `finishTerminal` 应答失败仍有闩锁/丢弃/settled；fatal 后迟归 authorize/解析 R4b 静默（OAP-C11a/d 尾段断言零新 wire） |
| 重试幂等 | authorize 每 (连接,ns) 恰一次（OAP-C11c/d 断言 grant 复用）；pending 合流不新增解析；no-sink 重开恰一次新解析 |
| 有界性 | 早到帧 16 ✓；pending 帧 16（三入口全查，首开占位 +1 有界角 = M6）✓；并发 OPEN 4（两入口全查）✓；内存随连接释放 ✓ |
| TOCTOU/双写/迟到回调 | 单线程到达序 + 同步段建立记录；上界检查与计数在同一同步段（无让位窗口）；迟归终局静默、迟归 sink 卫生通知恰一次——迭代 1 结论维持 |
| 账目回路（本轮专项） | 递增三处 / 递减单点四路到达 / buffer 清零幂等 / 每 buffer 单属一记录 → 无泄漏、无双降（§2 复盘） |

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| OAP-C11a（新增） | 4 in-flight 首开恰满负控（零收口、ready）→ no-sink 重 OPEN = 第 5 个 → `closed` + `closes=[{1008,'protocol-error'}]` + **恰一帧**连接级 `CONNECTION_POLICY_VIOLATION`（`namespaceId` undefined）+ `resolveCalls` 保持 1（零新解析）+ `namespaces.size=0` + 迟归 authorize 零新 wire（R4b） | vitest include（同文件既有入口） | 无——正例/负控/迟到三分齐备，全部运行时行为断言（wire 字节解码/close/回调计数） | — |
| OAP-C11b（新增） | NS_A no-sink 结算归还预算（零收口负控）→ NS_B 占位 + 15 帧恰满 16 负控 → 重 OPEN 占位 = 第 17 项 → 同码收口 + 零新解析 + 零会话 | 同上 | 无——专测 no-sink 分支的**帧预算**道 | — |
| OAP-C11c（新增，负控） | 3 in-flight + no-sink 重开 = 第 4 个 → 允许：重解析建会话（`namespaces={NS_A}`、reSink.opens）、`resolveCalls(NS_A)=2`、`authorizeCalls(NS_A)=1`（grant 复用）；收尾迟归闸门结算零收口、连接存活 | 同上 | 无——防「修复过紧杀死合法重解析」的假绿 | — |
| OAP-C11d（新增） | 17 轮「重 OPEN → undefined」：`resolveCalls=17`、`authorizeCalls=1`、零 close、ready（预算逐轮归还）→ 新 ns 窗口 1+15=16 满额零收口 → 第 17 项仍 `closed`+1008+恰一帧（上界未被禁用）→ 迟归解析零新 wire | 同上 | 无——泄漏复现 + 满额可用 + 界仍在，三段一体 | — |
| 既有 36 OAP 用例 | 迭代 1 §9 结论（抽查 OAP-C4c/C4d/C5a/C5b/C8d 亲读复核断言未动） | 同上 | 无（纯追加；SA3 报告 40/40） | — |
| 其余 6 文件 + test-d | 迭代 1 结论（零改动） | vitest/typecheck include | 无 | — |
| 纪律面 | 零 skip/only/todo/readFileSync/源码串断言（7 文件 grep 复核）；stub 只在宿主缝另一侧；OAP-C11 全经公共入口 `createHubReplicationEdge` + `createMemoryDuplexTransport('/testing')`；`settle()` 300 微任务泵足量驱动 fire-and-forget 链 | — | 无 | — |

红/绿纪律：SA3 报告修复前 3 failed | 1 passed（失败形态 = 缺陷静态预测，见 §2）、修复后 4/4、全文件 40/40、GATE-C1 84 文件/686 测试、GATE-C2 tsc exit 0、GATE-C4 零 diff——SA4 不运行测试，独立复算保留 §11。

## 10. Required revisions

| Finding ID | Severity | Evidence | Problem | Required change | Acceptance | Suggested routing |
|---|---|---|---|---|---|---|
| ~~F1~~（迭代 1 MAJOR） | — | `hub-edge-host.ts:323–346`；OAP-C11a/b/c | **已修复关闭**：两道上界前置 + 同码收口 + 被拒重 OPEN 零副作用；回归齐备且负控在档 | 无 | 已达标（OAP-C11a 恰一帧+1008+零解析+quiesce；C11c 上界内重解析照常） | — |
| ~~F2~~（迭代 1 MAJOR） | — | `hub-edge-host.ts:459–468` + `:495–499`；OAP-C11d | **已修复关闭**：释放先于 phase 迁移 + 缓冲在场守卫（= 设计 §8.2）；账目回路无剩余泄漏/双降路径 | 无 | 已达标（C11d 17 轮零虚假收口 + 新窗口满额 + 第 17 项仍响亮） | — |

当前无 BLOCKER/MAJOR finding。

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| GATE 独立复算（SA4 不运行测试） | `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/ws-replication`；`pnpm exec tsc -p packages/ws-replication/tsconfig.json`；`git diff --stat -- packages/replication-protocol/src` | 84 文件/686 测试全绿（含 OAP-C11 4 例）、Type Errors no errors、tsc exit 0、空 diff | 任一红/非零/非空 |
| F1/F2 复现驱动的独立复跑（公共面用例已覆盖，形态交叉验证） | 非 memory 的 DuplexTransport（如 TCP adapter）驱动 OAP-C11a/d 同型序列 | 与 memory 形态一致（恰一帧 1008 / 17 轮零虚假收口） | 行为差 |
| 根级门禁与下行消费者 | 根 `pnpm typecheck` / `pnpm test`；`apps/yjs-server` 冒烟 | 全绿（append-only 导出面静态无破坏） | 任一红 |
| M6 角落可达性见证（可选） | 3 条 pending 记录灌满 16 项（3 OPEN + 13 帧）后第 4 个新 ns 首开 | 占位成第 17 项且无收口（= 设计伪码形态，M6 登记）；后续任一 push 收口 | 出现 >17 项或重复放大 |
| 极小 maxFrameBytes 下的 ns ERROR 应答（M3 角） | 工厂 `limits.maxFrameBytes` < ~150B + deny 流程 | best-effort 不逃逸（try/catch 在位） | 异常逃逸 |
| 观测事件 connectionId 决策（M1） | observer 记录 deny/throw/no-sink 事件 | 产品决策：补附或登记现状 | 无（决策项） |

## 12. Non-blocking observations

1. **M1（观测事件缺 connectionId）**：维持迭代 1 登记——适配器三类事件不附 `connectionId`（单体/内部 edge 均附着）；本轮修复未触碰观测面。可选补 `port.connectionId()` 条件附着。
2. **M2（构造期不校验 observer/clock 形状）**：维持登记（设计 §8.1 枚举本就未含；与设计一致）。
3. **M3（ns ERROR 应答不带 limits 选项）**：维持登记；动态验证项在档。
4. **M4/M5（宿主义务注释/收口后幽灵序）**：维持迭代 1 登记（SA3 deviation 在档，与单体一致）。
5. **M6（首开分支帧占位的 +1 有界角——本轮对 SA3 §8 deferred 第 2 项的裁决）**：`openNamespace` 首开分支（L293–307）只查并发上界，`pendingFrameCount` 直接 +1——当 16 项已分布在 ≤3 条 pending 记录（3 OPEN + 13 帧）时，第 4 个新 ns 首开占位成为第 17 项而不响亮收口。**裁决：非实现偏离**——与批准设计伪码 §8.2 L381–385 逐形一致（伪码首开分支同样无帧检查）；放大有界且不复合（此后三入口全部触界收口，峰值 = 17 × `maxFrameBytes`，对文档账 16 × 的 +6.25% 单次越界）；SA3 按「保持批准设计」不扩大改动面是正确纪律。**建议（可选，routing: design）**：SA1 在设计伪码首开分支补同款检查注记（与 SD-5 注记一并），或在 SD-3 内存账显式登记 17 × 角落；实现侧无需本轮改动。
6. **M7（设计伪码 §8.2 no-sink 行缺上界注记——SA3 §8 deferred 第 1 项的确认）**：伪码 L390–391 无两道上界，规范正文（§7-D3 SD-5 + §9.3）有——实现按正文落地属正确取舍（正文优先于伪码）。**建议（可选，routing: design）**：SA1 以设计修订把伪码行补齐注记，消除设计内部不一致。不构成 ADR 冲突（不设 `requiresConflictRecheck`）。
7. **正向确认**：文件范围零越界（changed path 仅 ALLOW 两行）；DENY 面零触碰；tracked diff 与迭代 1 逐字节同集；OAP 测试纯追加（既有 36 用例断言未动，抽查亲证）；修复单点（`HostSessionAdapter`）未引入第二状态机/第二账本；OAP-C11 四用例全部真实 runner 入口发现、零纪律违例、正例 + 负控 + 迟到三分齐备；红灯基线失败形态与缺陷静态模型逐点吻合。

— SA4（Red Team），迭代 2，基线 `7039f6d` + SA3 未提交 diff（迭代 2 最小修复）。
