# SA10 Spec 审查报告 — Issue #450（γ-T4：γ 流控与生命周期收口——1011、close 冲刷 pending、revoke/settled 跨缝）

- Dispatch：`sa-c3b4e526-af40-4b28-986b-8fe255c6a413`（mabf-sa10 / spec-review / iteration 0）
- **被审对象**：**已提交**的 Issue #450 最终 diff——worktree `/home/wangjian/nomicore-fix-issue-450`，branch `mabf/issue-450`，HEAD **`02194881cf487088210ddf7ee7b433e6f41f1513`**（`fix(ws-replication): close gamma flow-control failures`），基线 = `444c166`（= SA6/SA1/SA2/SA8 共同基线）。`git status` 实查**干净**；提交 diff（`444c166..HEAD`）= 37 文件（+4913/−117）：`packages/` 恰 8 个 ALLOW 文件 + 12 份 SA3 证据日志 + 3 份 SA6 证据日志 + 3 份 SA7 证据日志 + 9 份 `wiki/raw/task_issue-450*` 工件。
- **Parent PR #446 base**：`spec/445-gamma-async-seam` @ `38b772f64afe1f0a927637922978240b3cb66850`（实查有效；merge-base(38b772f, HEAD) = `444c166`——本分支在 #449 合入前派生，双点 diff 中 #449 文件呈「删除」纯为分叉假象；**本提交自身零触碰任何 #449 文件**，实查 `444c166..HEAD -- '*issue-449*' '*issue449*'` = 0 命中）。
- **Owner 评论**：无——派遣明示 REST read 返回空数组；简报 `## Comments` 空。需求全集 = Issue 正文 7 条 AC + ADR 0032 A4.3/A4.5 + 协议 §24.5/§24.7。
- **输入产物（全部亲读）**：`task_issue-450.md`（简报）、`_sa6_contract.md`（批准契约）、`_design.md`（SA1 iteration 1，517 行两翼版）、`_sa2_review.md`（iteration 1 `approve`）、`_design_conflict_report.md`（SA8 iteration 1 `clear`，§16 读法 A 裁定）、`_sa3_impl.md`、`_implementation_conflict_report.md`（SA8 实现复查 `clear`，R1–R7 闭合、`requiresConflictRecheck: false`）、`_sa4_review.md`（`approve`，无 BLOCKER/MAJOR，O-1~O-5 MINOR）、`_sa7_report.md`（`approve`）、`_dispatch.md`。
- **独立核验方式（本轮全部亲读/亲跑只读命令，非转述）**：生产 diff 逐 hunk 亲读（4 文件）；验收测试 778 行全文亲读；夹具 427 行全文亲读；两份 append diff 亲读；规范原文 ADR 0032 A4（:55-114）与协议 §24（:1091-1154）逐字亲读对勘；提交范围/规范零改动/#449 边界 `git diff --name-only` 亲证；行锚（`backpressure.ts:82/:185/:192`、`hub-edge.ts:93/:118/:224-231/:691-704`、`hub-edge-host.ts:186/:712/:721/:982`）源码亲证；证据日志抽查（红聚焦 / 绿聚焦 / 变异负控 / SA7 包全量 / SA3 根门禁尾段逐字核对）；`issue447-async-seam.ts:70` 未用导入亲证（grep 全文件 1 次 = 仅导入行）；`createEdgeConnection` 全仓调用点 grep 亲证唯一（`hub-edge-host.ts:947`）。
- **边界**：零业务代码/设计/测试改动；未运行测试、未启动服务；零 commit/push/PR；唯一写入 = 本文件。

---

## Verdict

**`approve`**

Issue 正文 7 条 AC 逐项核验**全部满足**（§1），无遗漏、无部分实现、无错误实现、无实质 scope creep；SA6 验收契约条目全集（含设计新增的 `BPK-C4`/`BPK-NC2` 与 PUB）逐条有对应用例（22/22）；适用规范（ADR 0032 A4.3/A4.5、协议 §24.5/§24.7）逐字对勘一致，且规范文本零改动（实现追平规范，SA8 §16 读法 A 裁定被忠实执行）。PR 必须披露的未达成项 = §5 五条（全部非 AC 缺口、不阻断 approve）。

---

## 1. Issue AC 逐条核验（独立取证）

### AC1 — 账本溢出 → 1011 收口锚（慢对端 + 大突发编排）；逐帧拒纳 / ns 级 send-failed resync 路径在 γ 不可达 ✅

- **生产改动亲证（两翼）**：
  - 翼(i)：`backpressure.ts:185/:192`——`tryEmitDataFrame` 两条守卫在 `return 0` 前同步调用可选钩子 `onDataFrameAdmissionFatal?.('oversize' | 'ledger-overflow')`；判定次序（oversize 先）、严格大于判据、投影公式（`observe() + pendingDataHandoff + controlPendingHandoff + totalQueuedBytes() + frameBytes`）与 HEAD 逐字一致（diff 亲读）。钩子装配单点 `hub-edge.ts:224-231`：`'ledger-overflow' → connectionFatal('CONNECTION_BACKPRESSURE', 1011)`（与 control 额度耗尽同码同拓扑）。
  - 翼(ii)：`hub-edge-host.ts:721`——egress 前置门 `port.connectionState() === 'closed' || (pausePreGate && !port.dataGateOpen()) ? 0 : …`；`pausePreGate = options.asyncDataAdmissionFatal !== true`（`:982`，构造期常量、单一 option 派生）。γ 装配 ⇒ 仅 `closed` 项（A4.5 丢弃机械保留）；缺省 ⇒ `(true && ¬gate) ≡ ¬gate`，与 HEAD `closed || !gate` 逐字节等价。SA8 §16 读法 A 裁定（删除清单覆盖 egress 前置门水位暂停项）被逐要素落实。
- **验收锚亲证**：`BPK-C1`（test:156，无 `bufferedAmount` 面 = 永久慢对端等价，300 笔大突发 ⇒ 恰一 `ERROR{CONNECTION_BACKPRESSURE}` + close `{1011,'protocol-error'}` + `connection-failed{code,1011}` 恰一 + 缝 `'close'` 恰一 + `closeCalls=1`）；`BPK-C4`（test:169，**生产拓扑形态**：F1 旋钮置位水位只增 ⇒ 判别性观察「盖章时刻水位 > highWater 仍有帧放行」+ 随后恰一 1011）；`BPK-C2` 共享断言组 `assertNoGammaRejection`（test:103-123：全泵 + `ackTimeoutMs+1` 后零 wire `RESYNC_REQUIRED`、零 `resync-required`/`update-dropped` observer、零缝 `connection-fatal` 信号、缝词汇 ⊆ §24.3 闭集合）——「逐帧拒纳 / deferred / ns 级 send-failed resync 在 γ 不可达」以负向运行观察锚定，两形态（C1/C4）同断言。
- **负控成对**：`BPK-NC1`（test:224，β 同步缝 ⇒ ns 级 `RESYNC_REQUIRED{send-failed, send-frame-rejected}` + 连接存活 + 零 1011——登记差不动）；`BPK-NC2`（test:269，漏置位形态 ⇒ 前置门弹回 `unsealed>0` + 存活 + ackTimeout 后 `resync-required{cause:'ack-timeout'}`——翼(ii) 分叉真实且仅 γ 门控）。
- **敏感性证据**：SA3 红聚焦日志亲验 = `4 failed | 18 passed`，失败恰为设计预言缺口（BPK-C1/C2、BPK-C4、OVS-C1、MEM-C1b/C2）；变异负控日志亲验 = `pausePreGate` 恒 true 时 `BPK-C4` 恰在判别性断言红（test:188，`expected 0 to be greater than 0`）——锚有判别力。

### AC2 — 单帧超连接级上限 → 响亮收口 + 诊断（配置错误定性） ✅

- **生产亲证**：`hub-edge.ts:228` `'oversize' → connectionFatal('FRAME_TOO_LARGE', wsCloseCodeFor('FRAME_TOO_LARGE'))`；`wsCloseCodeFor`（`:118`）既有映射 = 1009；`errors.ts:105` `FRAME_TOO_LARGE` = `retryable:'config'`（「配置错误定性」逐字成立）；**零新错误码**（`packages/replication-protocol` 零触碰，diff 亲证）。
- **验收锚亲证**：`OVS-C1`（test:307：cap 16384 + 20480B 合法 UPDATE 帧经公共 egress 直驱 ⇒ 返回 0 **且**恰一 `ERROR{FRAME_TOO_LARGE}` + close 1009 + observer 恰一 + `'close'` 送达 + 零 `update-sent` + 零 wire UPDATE 字节——「返回 0 且连接存活」的静默形态被断言不存在）；`OVS-NC1/NC2`（test:324：cap 65536 + 注入前 `advance(level())` 清账 ⇒ 同帧返回 >0 且帧字节达 wire 记录面；界内小帧放行——严格大于判据不变的界内对照）。
- 载荷构造器 `makeLargeUpdateFrame`（夹具 :309-324）亲读：Yjs `clientID` 钉死 424242、帧长下界判据（非逐字节金标）、8 次未达下界响亮 throw——确定性纪律成立。

### AC3 — close 后 session→edge 方向丢弃规则锚；close 冲刷 pending（含在管帧）无泄漏 ✅

- **零生产改动**（session 侧 DENY 文件 `git diff` 亲证零触碰）；T1 既有机械 + 本票回归哨兵锚。
- **验收锚亲证**：`DROP-C1`（test:357：收口前放行同帧 ⇒ 正常盖章（自身前置对照）；对端断链收口 + close 先送达 ⇒ 后到帧/`settled` 零新盖章、零新回执、零新 wire 字节、零新 observer、状态保持 `closed`）；`FLUSH-C1`（test:407：`maxInFlightUpdates=1` + 在管 1 帧 + 队内 1 帧 ⇒ close 恰一送达、`close()` 同 promise 幂等、冲刷后 `ackTimeoutMs+1` 零 `RESYNC_REQUIRED` 零 fatal、迟到回执良性 no-op——「含在管帧、按未发送清算、无泄漏」）；`FLUSH-C2`（test:459 判别力负控：无 close 同编排必达 `RESYNC_REQUIRED{ack-timeout}×1`——冲刷断言非恒真）。

### AC4 — `terminateUnauthorized` 不溯及已推帧锚（信号到达前已推帧正常盖章） ✅

- **验收锚亲证**：`REVOKE-C1`（test:484：扣留 edgeToSession ⇒ 已推帧盖章（序在 wire）⇒ revoke ⇒ 放行；其 receipt 在 delivered() FIFO 中 **strict 先于** `terminateUnauthorized`（`receiptIndex < terminateIndex`）；恰一 `ERROR{NAMESPACE_UNAUTHORIZED}` + ns `failed` + 连接存活 `ready` + 零 `connection-failed`）；`REVOKE-NC1`（test:524：重复 revoke 零第二帧、零新收口字节——幂等）。

### AC5 — `settled` 晚到 drain 锚；`closeTimeoutMs` 行为不变 ✅

- **验收锚亲证**：`DRAIN-C1` 缺省形态（test:551：reauth ⇒ GOAWAY 恰一；`advanceBy(closeTimeoutMs-1)` 不收口、`+2` 到点恰 `{1001,'hub-reauth'}` 且 close 恰一次；收口后晚达 `settled` ⇒ 零二次收口、零新事件）；`DRAIN-C1` 早达形态（test:586：drain 窗口内 revoke ⇒ settled 早达 ⇒ 提前收口同码，零时间推进）；`DRAIN-NC1`（test:603：注入 `closeTimeoutMs: 10_000`（2× 缺省）⇒ GOAWAY `drainTimeoutMs` 字段 = 10000、9999 时未收口、+2 后恰 1001——逃生舱参数未被 γ 软化/改值，SA6 NC-7 落实）。

### AC6 — OPEN 水位（≤16 帧/连接、≤4 并发 OPEN）在注入跨线程延迟下的故障参数复核：原值不误收口；打穿 = 响亮收口 ✅

- **夹具亲证**：F2 `deferSinkResolve` 经 `issue447-async-seam.ts` append-only 闸门（`sinkGate` + `pendingSinks()`/`resolveSink()`，未挂起 ⇒ 响亮 throw）；`bootInjectionFlow`（夹具 :374-420）= γ facade（`asyncDataAdmissionFatal: true` + `deferSinkResolve: true`）× 本地内存 wire × 公共 `acceptTrusted`——「跨线程延迟」真实注入面（解析挂起到显式 resolve 泵）。
- **验收锚亲证**：并发闸形态（test:626/645：恰 4 个 deferred OPEN ⇒ 零收口、`pendingSinks()===4`；第 5 个 ⇒ 恰一连接级 `ERROR{CONNECTION_POLICY_VIOLATION}` + `close(1008)` + state `closed`）；帧闸形态（test:665/690：1 OPEN + 15 缓冲帧 = 恰 16 ⇒ 零收口 + resolve 后台账归还；第 17 项 ⇒ 恰一 1008）。常量直接 import 生产值（`MAX_CONCURRENT_OPEN_ADMISSIONS`/`MAX_PENDING_FRAMES_PER_CONNECTION`，test:51-54——非复制字面量，无漂移面）。故障参数定性（打穿 = 响亮收口，非流控调参）成立。
- **MINOR（不阻断）**：帧闸形态用例名宣称「resolve 后按序冲刷」，实际断言面 = 台账归还 + 零收口；15 缓冲帧向 session 的按序投递无直接观察（SA4 O-1）。生产同码的投递序由 #421 OAP-C4d 白盒锚在既有套件锚定 ⇒ AC6 本体（不误收口 / 打穿响亮收口）不受影响。登记于 §5-披露项 2。

### AC7 — 内存安全链锚：session 队列 → 管道 → edge 账本逐跳有界；慢连接最坏账 = 预算上限后连接死亡释放 ✅

- **验收锚亲证**：`MEM-C1`（test:710：session 队列跳——小 `maxQueuedUpdateBytes/Count` 构型 ⇒ 既有 `resync-required{cause:'queue-overflow'}` 恰一、ns 级、连接存活）；`MEM-C1b/C2`（test:732：edge 账本跳——同 `BPK-C1` 编排 ⇒ 1011 死亡且 session 队列跳零声明（两跳判然两分）；死亡后全泵 + `ackTimeoutMs+1` ⇒ 零 `RESYNC_REQUIRED`（无 pending 泄漏）、零新盖章/回执/wire 字节、`closeCalls=1`——「以静默丢帧充当上限」的形态被消灭，「死亡释放」以行为代理锚定）；`MEM-NC1`（= `BPK-C3`，test:193：F1 持续 `advance` = 及时消费 ⇒ 60 帧全盖章、存活、零收口——及时消费 ⇒ 零越界零死亡的对照）。
- **规范对勘**：§24.5 :1137「慢连接出站最坏账 = `maxQueuedBytesPerConnection` + `maxQueuedControlBytes` 后连接死亡释放」——翼(ii) 使「死亡兑现」在有 `bufferedAmount` 证据的传输形态（生产拓扑）可达（`BPK-C4`），首版设计的论证缺口（SA2 F-1）已闭合。

---

## 2. SA6 验收契约条目覆盖核验

SA6 §12.2 契约清单 → 交付测试逐条对号（亲读全文）：

| 契约条目 | 测试落点 | 状态 |
|---|---|---|
| `BPK-C1` / `BPK-C2` / `BPK-C3` | test:156 / 共享断言组 :103-123 / test:193（与 MEM-NC1 合用例） | ✅ |
| `BPK-NC1`（β 登记差） | test:224 | ✅（载体偏差见 §4-1，契约许可通道内） |
| `OVS-C1` / `OVS-NC1` / `OVS-NC2` | test:307 / test:324（N2 校准：cap 64KiB + 清账双保险） | ✅ |
| `DROP-C1` | test:357 | ✅ |
| `FLUSH-C1` / `FLUSH-C2` | test:407 / test:459 | ✅ |
| `REVOKE-C1` / `REVOKE-NC1` | test:484 / test:524 | ✅ |
| `DRAIN-C1` / `DRAIN-NC1` | test:551 + test:586（早达形态）/ test:603 | ✅ |
| `OPENWP-C1` / `OPENWP-C2` | test:626/665（C1 两形态）/ test:645/690（C2 两形态） | ✅ |
| `MEM-C1` / `MEM-C2` / `MEM-NC1` | test:710 / test:732 / test:193 | ✅（C2 可选计数直锚未落地 = §5-披露项 1，N6 可选项） |
| 设计新增 `BPK-C4` / `BPK-NC2` / PUB | test:169 / test:269 / test:765 | ✅ |

用例计数亲证：`grep -c "it('"` = **22**（与 SA3/SA4/SA7 三方申报一致）。零 skip/only/todo（亲查）；零 env override；断言面 = wire 帧/close info/observer 字段/返回值/缝消费序/句柄计数，零源码字符串断言。

## 3. 适用规范对勘（逐字亲读）

| 规范条款 | 实现/交付 | 判定 |
|---|---|---|
| ADR 0032 A4.3（:77-79）：流控 edge 单点；删除 `dataGateOpen`/`connectionState`/`bufferedAmount` 前置检查；账本投影越界即 1011 收口整条连接——无逐帧拒纳、无 deferred、无 ns 级 send-failed resync；单帧超限 = 配置错误 → 响亮收口 + 诊断；β/γ 显式行为差；OPEN 水位 = 故障参数 | 两翼分叉（§1-AC1）；γ session 半边 T1 已 dormant（本票零改动）；`BPK-C2` 三否定式运行锚；`OVS-C1` 响亮收口 + `FRAME_TOO_LARGE` config 定性；`BPK-NC1` 登记差不动；OPENWP 原值不动 | 一致 |
| 协议 §24.5（:1132-1139）：同 A4.3 各句 + 内存链「越界即死……最坏账 cap + control 后死亡释放」 | §1-AC1/AC2/AC7 锚逐条对应 | 一致 |
| ADR 0032 A4.5 + 协议 §24.7（:1147）：收口后丢弃 / close 冲刷 / revoke 不溯及 / settled 晚到 / `closeTimeoutMs` 不动 | 零生产改动 + DROP/FLUSH/REVOKE/DRAIN 族锚（§1-AC3/AC4/AC5）；新收口触发点汇入既有 `connectionFatal` 拓扑（`:690-704` 亲证零改动）⇒ 四腿自动适用 | 一致 |
| §24.3 缝词汇闭集合；§13.1 错误注册表冻结；ADR 后果 :112 公共面 append-only | 零新缝消息（分叉 = edge 内部构造期常量）；零新码；唯一公共面变化 = `HubReplicationEdgeOptions` 第 10 可选成员 `asyncDataAdmissionFatal?: true`（`:186`；`index.ts` 零改动亲证；421 test-d append 锁型 `true \| undefined` + `@ts-expect-error false`） | 一致（注册通道内） |
| A4.8：β/α 逐字节不变硬门；延迟可注入显式异步内存管道、零真实 timer | 缺省零传 ⇒ 新分支结构性不可达（钩子缺席 + `(true && ¬gate) ≡ ¬gate` 常量折叠等价）；三重负控（NC1/NC2/PUB）+ 包全量 102 文件/919 用例绿（SA3/SA7 两份独立证据亲验尾段）；夹具 = 显式 release + 虚拟调度器 | 一致 |
| 规范文本零改动义务（SA8-R4） | `git diff 444c166..HEAD -- docs/ CONTEXT.md` 亲证**空** | 一致 |

**上游门禁链**（供闭环核对，均在场）：SA2 设计评审 iteration 1 `approve`（F-1 关闭、N1–N6 落实）→ SA8 设计冲突门 iteration 1 `clear`（§16 读法 A 裁定）→ SA4 实现评审 `approve`（无 BLOCKER/MAJOR）→ SA8 实现复查 `clear`（R1–R7 逐项闭合、`requiresConflictRecheck: false`）→ SA7 动态验证 `approve`（含 `WATER-γ` 临时探针关闭 SA4 §11-3，探针已删、复跑逐值一致）。本 SA10 的全部关键结论仍以上述 §1–§3 独立取证为准，非转述。

## 4. 偏差登记（全部已在上游如实申报；均在契约/设计许可通道内，非 spec 违反）

1. **`BPK-NC1` 载体替换**（SA3 Deviation-1；SA4 O-5 info）：设计 §12.1 括注 `makeShardedReplicationFacade`，其实 `ShardedFacadeOptions` 不接受 limits 注入（无法编排同 limits 越界）；实现改用 #420 shim 桥（`createShimHubForTesting`，亲证其内部 = 真 `createHubReplicationEdge` + 公共 `createHubSessionHost` β 同步缝，`issue420-shim-hub.ts:56-59/:227/:692`）。SA6 §6 NC-1 与 §12.2 明文允许「监听单体或 `createHubSessionHost` 同步缝」；断言键与契约逐字一致。**合规偏差**。
2. **`issue447-async-seam.ts` 缩进重排**（SA3 Deviation-4；SA4 O-6 info）：语义 diff = +49/−0（resolver 抽取 `build` 闭包带来缩进级重排）；行为零变化由 #447 三套件 + #448 + 包全量复跑绿背书。**合规**。
3. **`issue447-async-seam.ts:70` 未用类型导入 `NamespaceAuthorizationGrant`**（SA8 实现报告 A1 登记）：本轮亲证——全文件仅 1 次出现（导入行本身）。lint 级残留、零行为面（type-only 导入擦除；`noUnusedLocals` 未启用；SA3 包 tsc 与根 typecheck 双绿）。**建议**合并前顺手清理；不阻断。
4. **`bootFlowRound` 的 `timeouts` 归一注入**（SA3 Deviation-2）：内部先 `{...TIMEOUTS, ...partial}` 归一后同喂 boot 与 facade（facade 同步解析路径要求 resolved 形）；缺省零传语义不变。**合规**。

## 5. PR 必须披露的未达成/边界项（均非 AC 缺口；不阻断 approve）

1. **`MEM-C2` 可选计数直锚未落地**（`pendingSends`/`inFlight` 计数经夹具探针直锚「清零」）：SA6 §7/N6 定为**可选增强**；主锚（行为代理：零 pending 泄漏 + 零新观测 + `closeCalls=1`）已绿。SA3 Deferred-1 如实申报；SA4 O-2（MINOR）。建议归属 #451 或夹具维护期补。
2. **`OPENWP-C1` 帧闸形态的「按序冲刷」无直接观察**（SA4 O-1，MINOR）：用例名大于断言面（实断 = 台账归还 + 零收口）；15 缓冲帧按序投递的生产同码由 #421 OAP-C4d 白盒锚覆盖。建议后续收窄用例名或补 `edgeToSession.delivered()` 序断言。
3. **γ 下水位事件（`send-paused`/`send-resumed`）可达性无常驻契约锚**（SA4 O-3/§11-3，MINOR）：SA7 以临时探针 `WATER-γ` 动态关闭（四阶段读数全绿：control 边沿恰一 pause/resume、字段不变、暂停期 data 照常盖章、连接存活；探针已删、读数录入 `task_issue-450_sa7_report.md` §7）。建议 #451 观测面落正式锚。
4. **真实 ws socket 动态未执行**（SA4 §11-1/§11-2；SA7 Deviation-2）：F1 `bufferedAmount` 旋钮是设计 D6 登记的**生产拓扑等价模型**（`BPK-C4`）；真实 socket + 真慢对端 + 1011/1009 后 peer 重连 backoff 幅度留集成环境（nomic-server 装配方）——A4.8 纪律禁止真实 timer/网络入仓。`MEM-C2` 的堆级释放确认同理属运维 profile 面（SA6 §7 明示不做真实堆测量）。
5. **根门禁全量回归的归属矩阵仍属 #451（T5）**（SA6 §12.3 边界登记）：本票已按模块 AGENTS 门实跑根门禁（SA3 证据亲验：`pnpm typecheck` exit 0；`pnpm test` 465 文件/5649 用例全绿 + `Type Errors no errors`），但「全量回归的常设归属」不是本票承诺——PR 文案不应伪称 #451 面已收口。

## 6. Scope creep 核验

- 提交 diff 的 `packages/` 面 = **恰 8 个文件**，与设计 §11 ALLOW LIST 八行逐一对应；DENY 面（session 侧生产文件、`hub-session-host.ts` 冻结工厂、`hub-connection.ts`/`plugin.ts` α 轨、`peer-*.ts`、`frame-io.ts`、`hub-upgrade-admission.ts`、`index.ts`、`testing.ts`、`issue448-live-seam.ts`、既有测试族、`packages/replication-protocol/**`、规范文档、其余包/根配置）经 `git diff --name-only 444c166..HEAD` 逐项亲证**零触碰**。
- 无越界生产改动；无隐藏重构；无规范文本改动；无新依赖；无 wire 格式变化。
- #449（T3）边界：本提交零触碰 #449 变更集；#449 自身变更集（`444c166..38b772f`）亦只含其新测试文件 + artifacts/wiki（亲证 `src/` 零改动）——SA6 §15-5 / SA8-R6 登记的「无重叠」成立；两票在父分支汇合无内容冲突面（merge 机械属 Host finalize 职责，非本审查面）。
- `artifacts/` 与 `wiki/raw/` 工件随同一提交落盘：与仓库惯例一致（前序票同款），非 spec 面。

## 7. 结论

**`approve`**。七条 AC 全部以可执行锚满足且本轮独立取证闭合；SA6 契约条目全集 22/22 对号；规范逐字一致且规范文本零改动；β/α 缺省语义经三重负控 + 全量套件双向锚定；无遗漏、无部分实现、无错误实现、无实质 scope creep。§5 五条披露项（可选计数直锚 / 用例名措辞 / 水位事件常驻锚 / 真实 socket 动态 / 根回归归属）全部已在 SA3/SA4/SA7 如实申报，均不属 AC 未达成——PR 披露文案应照录 §5，不得伪称已达成。`requiresConflictRecheck` 不提交（本审查不触碰 ADR 面；SA8 实现复查已将冲突门闭合至 `false`）。
