# SA7 动态验证报告 — Issue #450（γ-T4：γ 流控与生命周期收口——1011、close 冲刷 pending、revoke/settled 跨缝）

- Dispatch：`sa-8dad6455-b174-4ccc-9d9d-204f2d710a98`（mabf-sa7 / final-verification / iteration 0）
- 验证对象：**未提交的 Issue #450 最终交付**（worktree `/home/wangjian/nomicore-fix-issue-450`，branch `mabf/issue-450`，HEAD `444c1665fdb35b618bbb378a5b6bcefacfd288a7` + 未提交 diff：3 个 src 文件 + `AGENTS.md` + 2 新建测试/夹具 + 2 append-only 测试面）。
- 验证焦点（派工）：γ 数据流与生命周期/状态机行为的**真实运行链路**——可观察的 connection-fatal 行为（1011/1009）、close/pending 生命周期后果、缺省 β 行为保持。
- 上游门状态：SA4 implementation review verdict **`approve`**（无 BLOCKER/MAJOR）⇒ SA7 在其上独立动态验证；本轮**未发现任何 fail**。
- Owner 要求：REST snapshot 空（派工明示）——无 owner 追加要求；需求全集 = Issue 7 AC（SA6 §2 同判）。
- **结论：`verdict: approve`** —— 全部设计声明改变的数据流按设计变化（两翼分叉在无面/有面两形态运行时兑现）；全部声明保持的数据流保持不变（β 登记差、缺省前置门、γ 下水位机械保留面、四条生命周期腿、101 既有文件全量）；状态机转换与关键值正确、禁止转换未出现；错误与 cleanup 到达 quiescence；临时诊断已清理并复跑确认。

---

## 1. Inputs（固定输入，均已读）

| 输入 | 状态 / 用途 |
|---|---|
| `wiki/raw/task_issue-450.md` | Host 简报；7 AC；`## Comments` 空 |
| `wiki/raw/task_issue-450_design.md` | SA1 iteration 1（517 行）——D1 两翼/D1.5/D2–D9、§8.1 接口、§8.2 状态机、§8.3 路线表、§12 验收映射 |
| `wiki/raw/task_issue-450_sa6_contract.md` | 已批准验收契约——§5 P1–P6 探针读数、§12.2 契约清单（BPK/OVS/DROP/FLUSH/REVOKE/DRAIN/OPENWP/MEM） |
| `wiki/raw/task_issue-450_sa3_impl.md` | 实现证据（12 份 `artifacts/sa3-issue450-*.log`；Deviation 1–4） |
| `wiki/raw/task_issue-450_sa4_review.md` | verdict `approve`；§11 四项后续动态验证项（本轮逐项处置，见 §8/§10） |
| `wiki/raw/task_issue-450_design_conflict_report.md` | SA8 iteration 1 `clear`（读法 A 确认；协议边界不可改变） |
| `wiki/raw/task_issue-450_sa2_review.md` / `_dispatch.md` / `_implementation_conflict_report.md` | 评审/派工/冲突工件（识别边界用） |
| 生产 diff + 交付测试 | `src/backpressure.ts`、`src/hub-edge.ts`、`src/hub-edge-host.ts`、`AGENTS.md`、`test/issue450-flow-seam.ts`（新）、`test/ws-replication-issue450-flow-lifecycle.test.ts`（新，22 用例）、`test/issue447-async-seam.ts`（append +49/−0 语义）、`test/ws-replication-issue421-edge-factory-api.test-d.ts`（append） |

## 2. Runtime environment

- `node v24.13.0` / `pnpm 10.28.2` / `vitest 3.2.7` / `typescript 5.9.3`；worktree `node_modules` 已就绪（SA3 安装态延续，零安装改动、零 lockfile 改动）。
- 运行入口 = 仓库既有 vitest 配置（`NODE_OPTIONS=--conditions=nomicore-source` 条件导出）；时间 = 虚拟调度器 `advanceBy`、延迟 = 显式 release（A4.8 纪律，SA7 未引入任何真实 timer / wall-clock / 网络 / 长驻进程；全部命令前台或受控后台 job，收尾无遗留进程）。
- SA7 **零生产/测试代码改动**：仅新增 1 个临时探针测试文件（§7，已删除）；`git diff --check` exit 0。

## 3. Changed Data Flow Verification（设计声明改变的路线）

| Route | Design change | Runtime driver | Observed hops | Expected result | Actual result | Verdict |
|---|---|---|---|---|---|---|
| R1 γ data 帧正常放行（含界内压力） | 翼(ii)：前置门仅 `closed` 项，帧恒达守卫 | `BPK-C3/MEM-NC1`（F1 旋钮持续 `advance` = 及时消费，60 笔写入 + 泵） | writeHub → 通道 → selfDrain → `emitSeam{tag,'data'}` → FIFO → 桥 → `egress.sendDataFrame` → 守卫放行 → 盖章 → wire + `receipt{tag,sequence}` 配对 | 零收口、全部帧盖章、连接存活 | 60/60 UPDATE 达 wire；`dataLaneStamps` 恰 60 且与 data 帧配对；state `ready`；零 `connection-failed`（本轮实跑绿） | ✅ |
| R2a γ 账本投影越界（**无证据传输形态**）⇒ 1011 | 翼(i)+翼(ii)：守卫失败动作 = 连接终局 | `BPK-C1/C2`（cap 4096/high 2048/low 1024，300 笔大突发 + 泵；缺省无 `bufferedAmount` 面 = 永久慢对端等价） | 守卫命中 → `onDataFrameAdmissionFatal('ledger-overflow')` → `connectionFatal` → ERROR 直发 → `closedFlag`/state `closed` → `requestSinkClose` → transport.close → observer → cleanupAll | 恰一 `ERROR{CONNECTION_BACKPRESSURE}`；close `{1011,'protocol-error'}`；`connection-failed{code,wsCloseCode:1011}` 恰一；缝 `'close'` 恰一 + `closeCalls=1`；全泵 + `ackTimeoutMs+1` 后零 `RESYNC_REQUIRED` | 全部逐值命中（本轮实跑绿；含 `assertNoGammaRejection`：零 resync-required / 零 update-dropped / 零缝 `connection-fatal` / 缝词汇 ⊆ §24.3 闭集合） | ✅ |
| R2b γ 账本投影越界（**生产拓扑形态**：`bufferedAmount` 在场不 advance）⇒ 1011 | 翼(ii) 判别性落正面（F-1 核心） | `BPK-C4`（cap 8192/high 4096/low 2048 + F1 旋钮 ON，水位 = Σ已发送字节只增；真 peer 持续 ACK 窗口周转） | **中间跳点**：`stampSamples().levelAtStamp > highWater` 的盖章样本存在（帧越过水位仍达守卫——前置门暂停项已让位）；随后投影 > cap 判死 | 压力期 `level() > highWater` 且仍有盖章；随后恰一 1011 收口 + 无 γ 拒纳形态 | `level=…>4096` 成立、`above.length > 0` 成立、恰一 1011 + `assertNoGammaRejection` 全绿（本轮实跑绿；SA3 变异负控 `pausePreGate` 恒 true 恰使该判别断言红——判别力已被独立证明） | ✅ |
| R3 γ 单帧超限（配置错误）⇒ 1009 | 翼(i) `'oversize'` → `FRAME_TOO_LARGE` + 既有 1009 映射 | `OVS-C1`（cap 16384；20480B 合法 UPDATE 占位帧经公共 egress 直驱） | 直驱 → 前置门（仅 closed 项，ready 放行）→ 单帧守卫 → 钩子 → `connectionFatal('FRAME_TOO_LARGE',1009)` → 返回 0（同一同步段，fatal 已发起） | 返回 0 且恰一 `ERROR{FRAME_TOO_LARGE}` + close 1009 + observer 恰一 + `'close'` 送达 + pending 冲刷；零 `update-sent`；零 wire UPDATE 字节；不存在「返回 0 且存活」形态 | 全部命中（本轮实跑绿；`OVS-NC1/NC2` 负控：cap 65536 + 注入前清账 ⇒ 同帧返回 >0 且 wire 记录面命中、界内小帧放行、存活零收口） | ✅ |
| R4 收口触发点汇入既有 close 拓扑（新触发点 × 既有四腿） | D4：零新拓扑 | `DROP-C1`/`FLUSH-C1`/`REVOKE-C1`/`DRAIN-C1` 全部在 `asyncDataAdmissionFatal: true` 装配下运行 | fatal 后：`unresolvedTags.clear()` + 通道 quiesce + `UpdateChannel.teardown()`（pending/inFlight/queued 清零） | 新触发点的 close/pending 后果与既有腿一致（见 §4/§5） | 全绿（本轮实跑） | ✅ |

**旧路径死亡证明（γ 形态）**：`assertNoGammaRejection` 在 1011/1009 收口后全泵 + `advanceBy(ackTimeoutMs+1)`：wire `RESYNC_REQUIRED` = 0、observer `resync-required` = 0、`update-dropped` = 0、缝 `connection-fatal` 信号 = 0——逐帧拒纳 / deferred / ns 级 send-failed resync 三种 β 形态在 γ data 路径运行时不可达（AC1 的「不可达」以负向观察锚定）。

## 4. Preserved Data Flow Verification（设计声明不变的路线）

| Route | Preserved invariant | Runtime driver | Baseline observation | Current observation | Verdict |
|---|---|---|---|---|---|
| β 同步缝 data 溢出 = ns 级 resync、连接存活（登记差不动） | `BPK-NC1`（#420 shim 桥 = `createHubSessionHost` 同步缝，同 BPK-C1 limits） | SA6 §5-P1 家族 / #169/#172 历史锚 | 本轮实跑：`RESYNC_REQUIRED ≥1` + `resync-required{cause:'send-failed', reason:'send-frame-rejected'}` + `hubEnd.closed=false` + 零 `connection-failed{CONNECTION_BACKPRESSURE}` | ✅ |
| 缺省装配 egress 前置门「closed ∨ ¬gate」逐字保留（漏置位形态） | `BPK-NC2`（γ 桥 + 不置位标记 + F1 压力） | HEAD 缺省行为（SA2 SM-5 实证的 β 泄漏形态） | 本轮实跑：`level() > highWater` 后 `unsealed > 0`（前置门弹回）、state `ready`、零 `connection-failed`、零 1011；`ackTimeoutMs+1` ⇒ `RESYNC_REQUIRED ≥1` 且 `resync-required{cause:'ack-timeout'}`（与 NC1 的 `send-failed` 判别）——翼(ii) 分叉真实且仅 γ 门控 | ✅ |
| **γ 下水位机械保留面**（D1.5：`enterPause`/`resume`/poll、control 侧额度、`send-paused`/`send-resumed` 事件；观察点收敛到 control 发送/poll 边沿）——SA4 §11-3/O-3 指出契约内无专属断言 | **SA7 临时探针 `WATER-γ`**（本轮新增后删；读数全文见 §7） | 设计声明（doc-only；无既有运行锚） | 实测四阶段：(1) 纯 data 压力 `level=4227 > highWater=4096` ⇒ `send-paused`=**0**（data 路径不再消费水位闸——翼(ii) 的另一运行时证据）；(2) peer 写 ⇒ hub `UPDATE_ACK`（control lane 过缝，seamControl 5→6）⇒ `sender.sendControlFrame → observeWater → enterPause` ⇒ `send-paused` 恰一 `{bufferedAmount:4227}`；(3) 暂停态 data 帧仍放行盖章（UPDATE 40→41）；(4) `advance(level)` 消费 ⇒ 下一个 ACK 边沿 ⇒ `send-resumed` 恰一 `{bufferedAmount:0 ≤ lowWater}`；全程 state `ready`、零 fatal、零 RESYNC | ✅（保留面在 γ 装配下运行时可达且字段不变——SA4 §11-3 动态项关闭） |
| γ 缝既有行为（#447/#448 夹具被 append 后逐字不变） | γ 族复跑：#447 三文件 + #448 + #450 | SA6 §4 基线 43/43 | 本轮实跑 5 文件 / **65 用例** + `Type Errors no errors`（43+22） | ✅ |
| edge 工厂契约 / wire parity / route-key parity / OPEN 准入管线（缝邻接） | #421 全家族 7 文件 | SA6 §4 基线（101 文件含之） | 本轮实跑 7 文件 / **98 用例**（含 test-d 8 类型用例）+ `Type Errors no errors` | ✅ |
| 缺省 α/β 全量不变（硬门） | 包全量 `npx vitest run packages/ws-replication/test` | SA6 基线 101 文件/897 用例；SA3 102/919 | 本轮实跑（清理探针后）：**102 文件 / 919 用例全绿 + `Type Errors no errors`，exit 0**（两次独立全量运行同值） | ✅ |
| 缺省零传成功路径 | `PUB`（γ 桥不置位标记） | HEAD 语义 | UPDATE×1 全链结算（`update-acked`）、`ready`、零 `connection-failed` | ✅ |

## 5. State Machine Verification

| Initial state | Trigger | Expected transitions | Observed transitions | Forbidden transitions absent | Verdict |
|---|---|---|---|---|---|
| ready | 账本投影越界（γ 标记在场，无面形态） | ready → `connectionFatal`（同步前缀 `closedFlag`/`state='closed'` → teardown → ERROR 直发 → sink close → transport.close(1011) → observer 恰一 → cleanupAll）→ closed | `BPK-C1`：ERROR/close/observer/`'close'` 送达各**恰一**、`closeCalls=1`；多帧连撞收敛（300 笔突发） | 无第二次收口；无 ns 级 resync 复活（ackTimeout+1 后零 RESYNC/零 wire 字节）；无缝上 `connection-fatal`（收口恒 edge 发起） | ✅ |
| ready | 账本投影越界（有面慢对端，生产拓扑形态） | 同上（帧先越过 highWater 仍放行 = 暂停态不拦截 data） | `BPK-C4`：`levelAtStamp > highWater` 样本 >0 后恰一 1011 | 同上 + 「水位暂停弹回长存」形态缺席（连接最终死亡） | ✅ |
| ready | 单帧 > cap（γ） | ready → `connectionFatal('FRAME_TOO_LARGE',1009)` → closed；egress 同步段返回 0 | `OVS-C1`：返回 0 + 恰一 1009 族收口 | 无「返回 0 且存活」静默形态；零 `update-sent`（未盖章） | ✅ |
| ready（未暂停） | 水位 > highWater（γ，**control 发送边沿**） | ready+paused（`send-paused` 事件；仅作用 control 额度；data 不受拦截） | `WATER-γ` 探针：恰一 `send-paused{4227}`；暂停期 data 照常盖章 | data 帧不因暂停被弹回（翼(ii) 语义）；无 fatal | ✅ |
| paused | 对端消费（`bufferedAmount` 下降 ≤ lowWater）+ 下一 control 边沿 | paused → ready（`send-resumed` + drain） | `WATER-γ`：恰一 `send-resumed{0}` | 无重复 resume；无死亡 | ✅ |
| ready | 恰 4 并发 deferred OPEN / 恰 16 pending 帧（γ + F2 真延迟） | 零收口、台账挂起、连接存活 | `OPENWP-C1`×2：`closes=[]`、state `ready`、`pendingSinks()=4` / 帧闸 resolve 后归还 | 无误收口 | ✅ |
| ready | 第 5 并发 OPEN / 第 17 pending 帧 | 恰一 `ERROR{CONNECTION_POLICY_VIOLATION}` + close `{1008,'protocol-error'}` + quiesce | `OPENWP-C2`×2：closes 恰 `[{1008}]`、连接级 ERROR 恰一、state `closed` | 无流控调参形态（打穿 = 响亮收口） | ✅ |
| ready（drain 窗口） | GOAWAY 后 settled 未达 / 早达 / 收口后晚达 | 未达 ⇒ `closeTimeoutMs` 到点恰 `close(1001,'hub-reauth')`；早达 ⇒ 提前收口同码；晚达 ⇒ 零二次 | `DRAIN-C1`×2：到点前 `hubClosed=false`、到点/提前收口逐值命中；收口后 `namespaceSettled` ⇒ `closeEvents` 仍 1、零新事件 | 无二次收口；settled 不触发连接级 fatal（`fatalSignals=0`） | ✅ |
| ready（参数注入） | `closeTimeoutMs: 10_000`（2× 缺省） | 收口时刻随配置移动；GOAWAY `drainTimeoutMs` 字段 = 注入值 | `DRAIN-NC1`：9_999 时未收口、+2 后恰 1001；GOAWAY `drainTimeoutMs=10000` | 逃生舱未被 γ 软化 | ✅ |
| ready | `revokeNamespace`（已推帧在途） | 已推帧序保留在 wire；receipt 在 FIFO 消费序 strict 先于 `terminateUnauthorized`；ns `failed`；连接存活 | `REVOKE-C1`：`receiptIndex < terminateIndex`、恰一 `NAMESPACE_UNAUTHORIZED`、state `ready` | 不溯及已推帧；无连接死亡 | ✅ |
| ready | 重复 revoke | 零第二次 ERROR、零新 wire 字节 | `REVOKE-NC1`：逐值命中 | 无重复终局 | ✅ |
| closed（收口后） | 后到帧 / `settled` / 迟到回执 | 全部静默丢弃/良性 no-op；state 保持 closed | `DROP-C1`：零新盖章/回执/wire/事件；`FLUSH-C1`：迟到回执零二次 close 送达 | 无复活路径 | ✅ |

## 6. Error and Cleanup Flow

- **错误分类正确**（γ）：ledger-overflow ⇒ 1011（慢性拥塞）；oversize ⇒ 1009 + `FRAME_TOO_LARGE`（config 定性）——两码均为既有注册表码，wire ERROR 恰一、close code 经 `wsCloseCodeFor` 既有映射（运行时字段断言绿）。
- **无伪成功**：越界/超限的失败动作从「静默 0」升级为响亮收口；`OVS-C1` 显式断言不存在「返回 0 且连接存活」形态。
- **cleanup 到 quiescence**：`MEM-C1b/C2`——1011 死亡后全泵 + `ackTimeoutMs+1`：零 `RESYNC_REQUIRED`（pending 无泄漏）、零新盖章/回执/wire 字节、`closeCalls=1`；`FLUSH-C1`——close 冲刷（在管 + 队内）后零声明、`close()` 同 promise 幂等；`FLUSH-C2` 负控证明「零声明」非恒真（无 close ⇒ 必达 `RESYNC_REQUIRED{ack-timeout}×1`）。
- **逐跳有界两分**：`MEM-C1`（session 队列跳：小 `maxQueuedUpdateBytes` ⇒ 既有 queue-overflow 声明、ns 级、连接存活）与 `MEM-C1b`（edge 账本跳：1011 死亡）判然两分——「静默丢帧充当上限」形态在 edge 跳被消灭。
- **重入/并发角落**：钩子在守卫栈内同步 fatal，回调后仅 `return 0`；fatal 与缝在途消息并发 ⇒ closed 闸 0（`DROP-C1` 域）；fatal 后 ackTimer 先火 ⇒ 零 wire 字节（`assertNoGammaRejection` 任意释放次序成立）。

## 7. Temporary Diagnostics（动态日志协议执行记录）

- **添加项**：`packages/ws-replication/test/sa7-issue450-water-probe.test.ts`（1 用例 `WATER-γ`，观测设计 D1.5 保留面——γ 下水位事件经 control 发送边沿的可观察性；SA4 §11-3/O-3 指出契约无专属断言）。探针内 4 条 `[SA7-DATAFLOW]` 最小字段日志（route/step/level/事件计数/字段值），零 secret、零 live 对象 dump、零控制流改变。
- **探针读数（逐字）**：
  - `route=WATER-gamma step=1-pure-data-pressure level=4227 highWater=4096 pausedEvents=0 updateStamps=40`
  - `step=2-debug peerUpdates=1 hubAcks=1 seamControl=6 seamData=40 kinds=UPDATE_ACK`
  - `step=2-control-edge-pause pausedEvents=1 bufferedAmount=4227`
  - `step=3-data-while-paused updateStampsBefore=40 updateStampsAfter=41`
  - `step=4-consume-resume resumedEvents=1 bufferedAmount=0 lowWater=2048`
- **删除项**：探针文件已删除（`ls` 确认不存在）；原始捕获留存 `artifacts/sa7-issue450-water-probe.log`（**不入 artifactPaths**，按技能纪律临时日志不作为交付证据工件；读数已全文录入本报告）。
- **post-removal 验证**：探针删除后聚焦套件复跑 **22/22 逐值相同**；包全量复跑（干净树）**102 文件/919 用例 + Type Errors no errors**——移除诊断后结果不变。
- **marker 核查**：`grep -rn "SA7-DATAFLOW" packages/` 零命中（`wiki/raw` 内命中全部为**其他票**的历史报告，先在文件，与本票交付无关）；`git diff --check` exit 0。
- 探针编排自查：首两次运行失败为**探针自身编排缺陷**（`writePeer` 后缺 `settle()` 微任务冲刷 ⇒ peer UPDATE 未上 wire，诊断读数 `peerUpdates=0` 自证），修正后全绿——非产品行为发现。

## 8. Dynamic Evidence Matrix

| Source | Requirement or risk | Driver | Expected | Actual | Evidence | Result | Suggested routing |
|---|---|---|---|---|---|---|---|
| SA6 §12.2 `BPK-C1/C2` | 账本越界 ⇒ 恰一 1011；γ 无拒纳/resync | 聚焦套件实跑 | 见 §3-R2a | 全绿 | 本轮运行（§9 命令 1/2） | ✅ | — |
| SA6 §12.2 `BPK-C4` | 生产拓扑形态（有面不 advance）⇒ 1011；判别性 `levelAtStamp > highWater` | 同上 | 见 §3-R2b | 全绿（判别样本 >0 + 恰一 1011） | 同上 | ✅ | — |
| SA6 §12.2 `OVS-C1/NC1/NC2` | 单帧超限 ⇒ 1009 响亮收口；cap 充裕/界内负控 | 同上 | 见 §3-R3 | 全绿 | 同上 | ✅ | — |
| SA6 §12.2 `BPK-NC1/NC2`、`PUB` | β 登记差与缺省前置门保持 | 同上 | 见 §4 | 全绿 | 同上 | ✅ | — |
| SA6 §12.2 `DROP/FLUSH/REVOKE/DRAIN/OPENWP/MEM` | 生命周期四腿 + OPEN 水位 + 内存链 | 同上 | 见 §5/§6 | 全绿（22/22） | 同上 | ✅ | — |
| SA6 §4 / SA3 验证门 | γ 族 / #421 / 包全量基线保持 | 三组套件实跑 | 65 / 98 / 102 文件 919 用例 | 逐值一致 | `artifacts/sa7-issue450-focused-gamma-421.log`、`artifacts/sa7-issue450-package-suite.log` | ✅ | — |
| SA4 §11-1（真实 ws socket 上 γ 收口） | F1 旋钮 = 生产拓扑内存等价模型（设计 D6 登记等价性） | `BPK-C4`（有面形态） | 1011 死亡、无暂停长存 | 绿 | §3-R2b | ✅（等价模型口径） | 真实 socket 集成环境复核留 nomic-server 装配方（非本仓 harness 纪律内可达；A4.8 禁真实 timer） |
| SA4 §11-2（1011/1009 后 peer 重连 backoff） | 重连噪音隔离（设计 R2：断言限定 conn-0、不推进 peer 调度器） | 交付套件按 R2 编排 | conn-0 域断言不受新连接污染 | 绿（`connectionKey` 锁 conn-0） | §9 | ✅（票内口径） | 长时运行/重连风暴观察属 #451 观测面归属 |
| SA4 §11-3（γ 下水位事件可达性） | `send-paused`/`send-resumed` 经 control/poll 边沿可达、字段不变 | **SA7 探针 `WATER-γ`** | 恰一暂停/恢复事件 + 字段 + 存活 | 全绿（§7 读数） | §7 | ✅（动态项关闭） | 可选：#451 落正式契约锚 |
| SA4 §11-4（teardown 堆级确认） | MEM-C2 行为代理（SA6 §7 明示不做堆测量） | `MEM-C1b/C2` 实跑 | 死亡后零泄漏观测 | 绿 | §6 | ✅（行为代理口径） | 堆 profile 属后续运维面 |
| Design D1.5 保留面 | 水位机械/control 额度/链式校验在 γ 下原样 | `WATER-γ` + 包全量（#418 水位族在 102 文件内） | 保留 | 绿 | §4/§7 | ✅ | — |

## 9. Commands and Evidence（本轮实跑清单；均 exit 0）

```bash
# 1 聚焦验收契约（SA6 §12.2-1 命令形）
NODE_OPTIONS=--conditions=nomicore-source npx vitest run \
  packages/ws-replication/test/ws-replication-issue450-flow-lifecycle.test.ts --typecheck.enabled=false
# ⇒ Tests 22 passed (22)（本轮 3 次运行：20:00:45 / 20:01:18（γ 族内）/ 20:06:44（探针删除后）逐值一致）

# 2 γ 族复跑（#447×3 + #448 + #450；SA6 §12.2-2）
# ⇒ Test Files 5 passed (5) / Tests 65 passed (65) / Type Errors no errors

# 3 缝邻接（#421 全家族 7 文件，含 test-d 类型面；SA6 §12.2-3）
# ⇒ Test Files 7 passed (7) / Tests 98 passed (98) / Type Errors no errors

# 4 包全量 + 类型门（SA6 §12.2-4；探针删除后的干净树）
NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication/test
# ⇒ Test Files 102 passed (102) / Tests 919 passed (919) / Type Errors no errors
#   （两次独立全量：20:06:42 与 20:08:04，逐值一致）

# 5 SA7 临时探针（已删除；见 §7）
NODE_OPTIONS=--conditions=nomicore-source npx vitest run \
  packages/ws-replication/test/sa7-issue450-water-probe.test.ts --typecheck.enabled=false
# ⇒ Tests 1 passed (1)（读数录入 §7；原始捕获 artifacts/sa7-issue450-water-probe.log）

# 6 清理核查
grep -rn "SA7-DATAFLOW" packages/        # ⇒ 零命中
git diff --check                          # ⇒ exit 0
```

证据工件：`artifacts/sa7-issue450-focused-gamma-421.log`（命令 1–3 汇总捕获）、`artifacts/sa7-issue450-package-suite.log`（命令 4 捕获）、`artifacts/sa7-issue450-water-probe.log`（命令 5 原始捕获，非交付证据）。

## 10. Deviations

1. **探针编排自纠**（非产品发现）：`WATER-γ` 首两次红 = 探针缺 `settle()`（peer 写的微任务冲刷），诊断读数自证（`peerUpdates=0`），修正后绿——不构成对交付的 finding。
2. **真实 ws socket 动态未执行**：harness 纪律（A4.8：延迟可注入显式异步内存管道、零真实 timer）下，生产拓扑以 F1 `bufferedAmount` 旋钮为设计登记的等价模型（`BPK-C4`）；真实 socket + 真慢对端留集成环境（SA4 §11-1 建议 routing 已登记）。
3. **SA7 未新增交付面负控**：验证基于交付的 22 用例契约 + 三组套件 + 1 个补充探针；未补一般覆盖率（技能边界）。
4. 未运行根 `pnpm test`（465 文件全仓）——SA3 已采集（`artifacts/sa3-issue450-root-test.log` 465/5649 绿）且全仓回归归属 #451（T5）；SA7 以包全量（102/919，含全部 ws-replication 既有族）覆盖「缺省 β/α 保持」的动态证明面。

## 11. Verdict

**`approve`**。

- 设计声明改变的数据流（R1 放行语义、R2a/R2b 账本越界 ⇒ 1011、R3 单帧超限 ⇒ 1009、新触发点 × 既有 close 拓扑）全部按设计变化，关键中间跳点（`levelAtStamp > highWater` 的盖章样本、egress 同步段返回值、缝 `'close'` 恰一送达、wire/observer 字段）有运行时证据。
- 设计声明保持的数据流（β 登记差、缺省前置门、γ 下水位机械保留面、#447/#448/#421 缝邻接、101 既有文件）全部保持——含 SA4 §11-3 无断言的保留面经 SA7 探针动态关闭。
- 状态机转换与关键值正确；禁止转换（γ 下 ns 级 resync、二次收口、收口后复活、暂停弹回长存、误收口）均以负向观察缺席。
- 错误与 cleanup 符合设计并到达 quiescence；临时诊断已删除并复跑确认结果不变、marker 零残留。
- `requiresConflictRecheck: false`（无设计修订；SA4 approve 基础上的独立动态确认）。
