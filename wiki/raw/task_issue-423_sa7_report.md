# SA7 动态验证报告 — issue #423（spec #415 T6）：observer 发射点拆分与降级口径

- 阶段：final-verification（iteration 0；本票首份 SA7 报告，无既有报告可更新）。
- 验证对象：当前工作树实现 diff（基线 HEAD `1f5809b`，分支 `mabf/issue-423`）——与 SA4 审查对象同一快照（`git status --short` 复核：8 个 ALLOW 路径修改 + 契约/守卫测试与 wiki 产物未跟踪，DENY 路径零改动）。
- 上游门禁：SA4 verdict = **approve**（无 BLOCKER/MAJOR）；SA8 实现冲突复查 **clear**（`requiresConflictRecheck = false`）。SA7 在此基础上独立动态验证，仅可独立发现 fail。
- 固定产物：本报告 + `packages/ws-replication/test/ws-replication-issue423-sa7-dynamic.test.ts`（SA7 补充动态测试，5 用例，仓库 `*-sa7-dynamic` 惯例）+ 证据记录（§Commands and Evidence 内联命令与实测值）。

---

## Inputs

| 输入 | 状态 | 消费方式 |
|---|---|---|
| `wiki/raw/task_issue-423.md`（任务简报） | 在场 | What-to-build + 6 条 AC 的动态观察面映射 |
| `wiki/raw/task_issue-423_design.md`（SA1 批准设计） | 在场 | §8 数据流路线表（3 条改变路线）= Changed 面清单；§D2–§D6 关键跳点；§11 ALLOW/DENY；非目标（peer/chunked/公共面零变化）= Preserved 面清单 |
| `wiki/raw/task_issue-423_sa6_contract.md` + `artifacts/sa6-issue423-contract-evidence.log` | 在场 | 验收契约（21 用例）判据与 §13 执行命令；红灯基线 {EM-C2a, EM-C4a, EM-C4b} |
| `packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts`（SA6 契约） | 在场（只读，零改动） | 复跑 + 作为既有动态证据源 |
| `wiki/raw/task_issue-423_sa3_impl.md`（SA3 实现报告） | 在场 | 复跑其验证声明（契约 21/21、守卫 10/10、包级 86/717、typecheck） |
| `wiki/raw/task_issue-423_sa4_review.md`（SA4，approve） | 在场 | §11「后续动态验证项」逐条承接（见 Dynamic Evidence Matrix）；§12 非阻断观察 N1–N5 不属动态面 |
| `wiki/raw/task_issue-423_design_conflict_report.md` / `_implementation_conflict_report.md`（SA8，双 clear） | 在场 | 识别不可改变边界：wire/§23.1 词表/§23.2–23.4/隔离单点/缝四控制信号/公共 API/peer 面/listen 计数 = Preserved 不变量来源 |
| `wiki/raw/task_issue-423_sa2_review.md`（approve） | 在场 | O1–O5 中动态可证项（O2 透传断链即 EM-C4c 红；O5 畸形输入零 throw/零事件/返回值不变 → 守卫 OG-3/4 复跑） |
| Owner 要求 | **无** | Host 简报「No owner requirements apply: REST comment read returned []」；SA6 §2 复核 comments = 0 |

## Runtime environment

- worktree：`/home/wangjian/nomicore-fix-issue-423`（git HEAD `1f5809b` + 未提交实现 diff）。
- Node `v24.13.0`、pnpm `10.28.2`、vitest `3.2.7`、TypeScript `5.9.3`（与 SA6 §4 环境一致）；依赖已安装（`node_modules` 在场，零网络）。
- 契约执行口径：`NODE_OPTIONS=--conditions=nomicore-source npx vitest run <files>`（源码直连条件，SA6 §13 同款）。
- 全部夹具为内存双端 transport / 真实 Registry+Runtime / fake scheduler + fake timer；**唯一真实时间使用** = SA7 动态测试注入的真实高分辨率时钟（`performance.now`，观测仪器）与 D-SEAM1b 的 120ms 有界真实驻留（观测仪器；断言用宽界防 flake）。零真实网络、零 worker 进程、零常驻服务（vitest 进程自退；后台 job 均已收口）。

## Changed Data Flow Verification

设计 §8 声明的唯一运行时数据流变化 = `update-sent` 事件对象的构造点/构造者迁 edge + 缺口 A 三发射点补 `connectionId`。逐路线动态验证（关键中间跳点均有运行时证据，非仅最终值）：

| Route | Design change | Runtime driver | Observed hops | Expected result | Actual result | Verdict |
|---|---|---|---|---|---|---|
| 1. listen：业务写 → UPDATE 帧 → edge 事件（设计 §8 行 1） | `sentAt`/`sendQueueMs` 采样点前移至发送调用边界（session）；差值经缝 append-only 投影过缝；edge 定偏移判定 + 单点发射；session 观测面零该型 | 契约 EM-C4b/C4c、issue238 精确断言、**SA7 D-SEAM1a/b/c（缝上 `(frame, accounting)` 逐笔留痕）+ D-BURST1（5 笔连发）** | ① 缝上帧 = 占位序 UPDATE：`rawSequence(frame) === 0`（盖章发生在缝后 edge 侧——事实所有权边界，D-SEAM1a）；② 缝上 `accounting.sendQueueMs` 在场且 = 真实时钟域残差 **0.077ms**（同栈直发，D-SEAM1a）；③ 闸门关闭入队 + 真实驻留 120ms 后出站 ⇒ 缝上差值 **121.157ms**（≥100——真实队列驻留差值、采样点已在发送调用边界算好，非常数/垃圾值，D-SEAM1b）；④ 无 clock 面 ⇒ 缝上 `accounting === undefined`（零对象构造，D-SEAM1c）；⑤ session 半边观测面零 `update-sent`（D-SEAM1a/EM-C4b）；⑥ listen 组合形态 5 笔写 ⇒ 事件数 === wire UPDATE 帧数 = 5、逐帧 `sequence === wire [8..12]`（seq 7,8,9,10,11）、严格递增、键集逐事件恒等 = 金标行 `bytes,connectionId,namespaceId,sendQueueMs,sequence,side,type`、残差 0.007–0.028ms（D-BURST1）；⑦ 手动时钟域精确差值 `[0, 4_000]`（issue238 合并构型复跑绿） | 缝过帧字节 + 纯 JSON 差值；edge 恰一发射；键集/次序/值恒等 | 与预期逐项一致（数值见 Observed hops） | **pass** |
| 2. 工厂：宿主直驱 data 帧 → edge 事件（设计 §8 行 2） | 宿主 egress 帧无 session 记账 ⇒ `sendQueueMs` 整键缺席；`bytes`/`namespaceId`/`sequence` 由帧字节与盖章返回值判定 | 契约 EM-C4a（+ control 负控）、守卫 OG-1/OG-2/OG-5 | 恰一事件（`sequence == stamped == wire [8..12]`、`bytes == decoded.update.byteLength`）；`sendQueueMs` 键缺席（缺面非 0）；control/UPDATE_CHUNK/OPEN_OK 型门负控零事件；跨 varUint 1/2/3 字节边界判定 === codec decoded 长度 | 同左 | 复跑全绿（契约 21/21 + 守卫 10/10） | **pass** |
| 3. 工厂：拒绝路径事件（设计 §8 行 3） | 三发射点统一 `cidField(port.connectionId())` 在场投影 | 契约 EM-C2a/b/c（+ EM-C1b/c） | `namespace-error{sent}` / `namespace-failed{open-failed}` 携 `connectionId === connectionKey`（取值断言非键存在）；authorize throw 同族键集 ⊆ §23；pre-connection `auth-upgrade-rejected` 无键负控 | 同左 | 复跑全绿；#418/#421 拒绝路径族 10 文件 149 用例全绿（既有投影断言无精确键集钉死，补键不触红——与设计 §2.3 预判一致） | **pass** |

旧路径不再被调用的运行时证据：session 侧 `onUpdateSent` 普通分支抑制（EM-C4b：帧已出站（stub.data = 1）而 session 事件面 `update-sent` 空集）；hub src 内 `type:'update-sent'` 构造仅剩 edge 单点 + peer 面（SA4 grep；动态面由 EM-C7a 金标「恰一 + 键集」拦截双发）。

## Preserved Data Flow Verification

设计声明不变的路线（非目标 + SA8 冻结面），动态验证保持不变：

| Route | Preserved invariant | Runtime driver | Baseline observation | Current observation | Verdict |
|---|---|---|---|---|---|
| chunked 族留 session | `chunked-update-sent`（无 sequence 键，R21 改道）仍在 session 末 chunk 结算恰一发射；UPDATE_CHUNK 0x42 被 edge 型门排除（无双发） | `issue243-ac-red`（6）/`issue245-ac-red`（10）+ 守卫 OG-2a | SA6 S0 基线绿（18 绿成员） | 复跑全绿（59/59 含两套件）；OG-2a 型门负控绿 | **pass** |
| peer 侧发射面 | peer `update-sent{side:'peer'}` / chunked 族发射点原样（共享 UpdateChannel 采样点前移对 peer 同栈恒等） | `observer-red`（32，双侧键集白名单 + wire 载荷一致） | SA6 S5 基线绿 | 复跑全绿 | **pass** |
| listen `sendQueueMs` 值域 | 手动时钟域逐值不变（发送栈零时钟读 ⇒ 采样点前移值恒等） | `issue238-segmented-observation`（8）：直发 `[0,0,0,0,0]`、合并 `[0, 4_000]` 精确断言 | SA6 S5 基线绿 | 复跑绿（精确值保持） | **pass** |
| 观测键集白名单 | hub/peer `update-sent` 键集 ⊆ `['type','side','connectionId','namespaceId','bytes','sequence','sendQueueMs']` 且与 wire 一致 | `observer-red`（32） | 基线绿 | 复跑绿；D-BURST1 真实时钟下键集逐事件恒等 = 金标行 | **pass** |
| listen 计数口径 | `maxConcurrentAssembliesPerConnection` per-connection（limits 键驱动、释放再纳、缺省 4→第 5 拒） | 契约 EM-C6a/b | 基线绿 | 复跑绿（运行时零改动——`inboundAssemblySlots` 不在 diff） | **pass** |
| observer 隔离单点 | `dispatchReplicationObserver` try/catch 静默隔离，两侧成立；throw 零 wire/状态影响 | 契约 EM-C5a/b（全抛 observer 双跑 wire 逐帧相等） | 基线绿 | 复跑绿（新发射点经同一单点） | **pass** |
| 单体事件序列（AC6） | 型 + 精确键集 + 稳定字面量 == 拆分前金标（`e9cd7eb` 采集） | 契约 EM-C7a/b | 基线绿（E3） | 复跑绿（次序恒等：新发射点与旧点同一同步栈、两点间零 observer 事件） | **pass** |
| 出站 wire 面 | 帧字节/序/关闭分类零变化（`replication-protocol/**`、`frame-io.ts` 零改动） | EM-C5a 双跑逐帧相等 + `issue421-wire-parity`（8） | 基线绿 | 复跑绿 | **pass** |
| 缺面 dormant 既有语义 | 无 `bufferedAmount` ⇒ 键缺席；可观测 ⇒ 真实读数；缺 clock ⇒ `sendQueueMs` 整键缺席；无 ping/onPong ⇒ 零 liveness | 契约 EM-C3a–d | 基线绿 | 复跑绿；D-SEAM1c 补缝上 `accounting === undefined` 跳点级证据 | **pass** |

## State Machine Verification

设计 §8 声明状态机零变化（连接/通道 FSM、准入、drain、背压、assembly 槽位不动）。动态验证转换与禁止态：

| Initial state | Trigger | Expected transitions | Observed transitions | Forbidden transitions absent | Verdict |
|---|---|---|---|---|---|
| ready（listen，live 通道） | 连续 5 笔业务写（重复触发） | 每帧恰一事件、seq 严格递增、无重复/乱序 | 5 帧 / 5 事件、seq 7→11 严格递增、逐帧 == wire（D-BURST1） | 双发（事件数 > 帧数）、乱序、seq 重复均未出现 | **pass** |
| ready（工厂，会话建立） | `egress.sendDataFrame(UPDATE)` | `seq > 0` → 恰一事件；wire 恰一 UPDATE 帧 | stamped > 0、1 事件、1 wire 帧（D-CLOSE1 正控 + EM-C4a） | 零事件但帧出站（漏发）未出现 | **pass** |
| ready → closed（工厂） | `connection.close()` 后再 `egress.sendDataFrame(UPDATE)` | 发送被拒（返回 0，非伪成功）；零新事件；零新 wire 帧；观测面不复活 | 返回 0、`update-sent` 增量 = 0、wire 增量 = 0（D-CLOSE1） | close 后事件复活 / 半发射未出现 | **pass** |
| live 通道（session 半边） | 发送被拒（`seq ≤ 0`） | 零事件（`seq > 0` 门）+ 既有 F4/`send-frame-rejected` 分支原样；记账随拒帧弃置 | 守卫 OG-5b（额度 64 拒绝 ⇒ seq=0 + 零事件 + 零出站）+ `issue231-send-failure` 套件绿（包级 722 内） | 拒帧仍发事件未出现 | **pass** |
| ready（工厂） | 帧字节畸形（id 前缀腐蚀/短帧/长度不自洽/非规范 varUint） | dormant：零 throw、零事件、返回值 = wire `[8..12]` 不受影响（D6 防御分支——观测面失败不改变协议结果） | 守卫 OG-3/OG-4a/b/c 全绿 | throw 外溢 / 协议结果改变未出现 | **pass** |
| 全生命周期 | 重启/恢复面 | 观测面无持久化/缓存（纯瞬态）——无重启恢复语义需验证（设计 §9：accounting = 调用栈瞬态值，零存活） | 实现面无新持久化构件（diff 复核）；无需动态场景 | — | **pass**（不适用面已证不存在） |

## Error and Cleanup Flow

- **observer throw 隔离（两侧）**：EM-C5a（edge 公共出面：全抛 observer 双跑 wire 逐帧 hex 相等、连接 ready 存活、零 unhandledRejection）+ EM-C5b（单体组合：业务收敛不变）复跑绿——新发射点 `emitUpdateSentAtStamp` 经同一 `dispatchReplicationObserver` 单点，throw 不外溢协议路径。
- **错误沿设计路径传播**：发送拒绝（seq=0）⇒ 零事件 + F4 分支原样（OG-5b + issue231 套件）；`OutboundExhaustedError` 传播路径不变（SA4 静态复核；实践不可达，无动态断言面——与设计 §9 口径一致）。
- **cleanup 到达 quiescence**：D-CLOSE1 close 后增量 = 0（事件/wire 双面）；EM-C5a 关闭分类双跑相等；无进程/端口/常驻服务残留（本轮全部 vitest 前台/后台 job 均已收口，见 §Temporary Diagnostics）。
- **无伪成功**：close 后 egress 返回 0（D-CLOSE1）；拒帧 seq=0（OG-5b）——错误路径不伪造正返回值。

## Temporary Diagnostics

| 项 | 内容 | 处置与证据 |
|---|---|---|
| 测试内临时度量日志（`[SA7-DATAFLOW]` × 4 行） | 仅加入 SA7 自有测试文件（console.log 输出残差/驻留/连发实测值：0.0766ms / 121.157ms / 0.0071–0.0280ms×5），用于报告取证；**从未进入生产源码或既有测试** | 已删除（备份恢复 + `grep -c "SA7-DATAFLOW"` = 0）；`git diff \| grep -c "SA7-DATAFLOW"` = 0（无命中）；删除后复跑：SA7 文件 3 连跑 5/5 绿 + 包级 87 files / 722 tests 全绿（结果与带日志时一致） |
| 后台 job | 包级全量 × 2（`bash-27`、`bash-28`） | 均正常完成（exit 0）并已读取收口；无残留进程 |
| worktree / 服务 / 端口 | 未创建任何 worktree、未启动任何服务、未占用端口（全部内存夹具） | `git worktree list` 仅主 worktree（未新增）；无需清理 |

SA7 补充测试文件 `ws-replication-issue423-sa7-dynamic.test.ts` 为**持久交付物**（仓库 `ws-replication-issue243/244-sa7-dynamic` 惯例；断言 = 运行时行为，无临时日志），非临时诊断，不入上表清理面。

## Dynamic Evidence Matrix

| Source | Requirement or risk | Driver | Expected | Actual | Evidence | Result | Suggested routing |
|---|---|---|---|---|---|---|---|
| SA4 | §11 行 2：契约 + 守卫 + 包级复跑独立性 | 契约 21 + 守卫 10 + 包级全量 | 21/21、10/10、全绿 | 21/21 绿；10/10 绿；86 files/717 绿（SA7 文件加入前）/ 87 files/722 绿（加入后）；`Type Errors: no errors` | 本轮 vitest 运行（§Commands） | 一致 | 无 |
| SA4 | §11 行 3：真实时钟域 `sendQueueMs` 残差（发送栈被引入新时钟读 ⇒ 毫秒级漂移） | SA7 D-SEAM1a（同栈直发）+ D-BURST1（5 笔连发，真实高分辨率时钟） | 差值 ≈ 同步栈时长（亚毫秒），无毫秒级漂移 | 0.077ms（单帧）/ 0.007–0.028ms（5 帧）——全部亚毫秒 | SA7 动态测试实测（临时日志取证后删除；断言 `< 50ms` 护栏常驻） | 通过 | 无 |
| SA4 | §11 行 6：close/dispose 后行为（观测面不复活） | SA7 D-CLOSE1 | 返回 0、零事件、零 wire 帧 | 三项全部观察到位 | SA7 动态测试 | 通过 | 无 |
| SA4 | §11 行 5：sequence 耗尽边界（实践不可达） | —（`OutboundExhaustedError` 路径静态不可达；无动态断言面） | — | 不适用（设计 §9 同判） | — | 登记 | 无（与 SA4/设计口径一致） |
| SA4 | §11 行 1/4：根全仓门禁 / 分片（worker）形态运行时锚 | — | Host 执行 / T3(#420)+T5(#422) 落地后 | 不属 SA7 职责（skill：不运行全仓回归）；SA8 §8-2 同判 follow-up | — | 登记 | Host（根门禁）；后续票（T3/T5） |
| SA6 | EM-C2a/C4a/C4b 三红经实现转绿且契约零软化 | 契约文件复跑（mtime/内容零改动） | 21/21 绿 | 21/21 绿（断言文本/用例数与 SA6 §12.3 一致） | 本轮 vitest 运行 | 通过 | 无 |
| SA6 | §12.4-2 ①–⑥（恰一/序/长度/路由键/sendQueueMs 保留/缺面） | 契约 EM-C4a/b/c + 守卫 OG-5a + SA7 D-SEAM1b | 逐项可观察 | 逐项绿；缝上差值 121.157ms 证明承载机制真实过缝 | 契约/守卫/SA7 动态测试 | 通过 | 无 |
| Design | §8 路线 1 关键中间跳点（缝边界①：帧 + 纯 JSON 差值） | SA7 D-SEAM1a/b/c | 缝上可观察 `(frame, accounting)`；帧占位序；差值语义正确 | 全部到位（含缺面 `undefined`） | SA7 动态测试 | 通过 | 无 |
| Design | §D2.5/§D3.4：组合形态次序/键集恒等（AC6） | EM-C7a/b 金标 + SA7 D-BURST1 键集断言 | 逐字/逐事件恒等 | 双绿 | 契约 + SA7 动态测试 | 通过 | 无 |
| Design | §D5 文档面落点存在性（动态报告引用锚） | `grep` 存在性核对 | §17:582 / §22:704 / §23.1:745+833 / ADR0032:45 在场 | 四处全部在场（内容审查属 SA4/SA8，已 approve/clear） | 本轮 grep 输出 | 通过 | 无 |

额外发现（不扩大验证范围，仅登记）：无。本轮未发现任何与批准设计/SA4 结论冲突的运行时行为。

## Commands and Evidence

| # | Command | Result |
|---|---|---|
| V1 | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts packages/ws-replication/test/ws-replication-issue423-update-offset-guard.test.ts` | **31 passed (31)**（契约 21 + 守卫 10）、`Type Errors: no errors`（05:18:39） |
| V2 | 同上口径，锚定套件 ×6：`issue238-segmented-observation` / `issue238-repro` / `observer-red` / `issue230-incremental-mutation` / `issue243-ac-red` / `issue245-ac-red` | **59 passed (59)**（8/1/32/2/6/10；含 `sendQueueMs` 精确断言 `[0, 4_000]`）（05:18:53） |
| V3 | 同上口径，#418/#421 族 ×10（split-contract/structure/pending-window-matrix、edge-accept/factory-api/edge-lifecycle/error-routing/open-admission-pipeline/route-key-parity/wire-parity） | **149 passed (149)**、`Type Errors: no errors`（05:19:02） |
| V4 | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication`（后台 job `bash-27`，SA7 文件加入前） | **86 files / 717 tests 全绿**、`Type Errors: no errors`——与 SA3 报告逐字一致（05:19:08） |
| V5 | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication/test/ws-replication-issue423-sa7-dynamic.test.ts` | 首跑 4/5（D-SEAM1b 场景构造缺陷：闸门开启下 `deliver` 同栈直发，驻留未进通道队列——**夹具问题非实现问题**）；修正为闸门关闭入队（`deliver` 有界队列分支）+ `settleUntil` 冲刷 defer 泵后：**5 passed (5)**，3 连跑稳定 5/5（05:23:34 起） |
| V6 | 临时度量日志轮（`[SA7-DATAFLOW]` 取证） | 实测：缝上同栈残差 **0.0766ms**；闸门驻留 120ms ⇒ 缝上差值 **121.157ms**；连发 5 帧残差 **0.0071 / 0.0103 / 0.0088 / 0.0071 / 0.0101ms**（seq 7–11、bytes 28）；日志随后删除（§Temporary Diagnostics） |
| V7 | `npx tsc -p packages/ws-replication/tsconfig.json` | exit 0（`TSC-EXIT-0`） |
| V8 | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication`（后台 job `bash-28`，SA7 文件加入后、日志删除后） | **87 files / 722 tests 全绿**、`Type Errors: no errors`（05:24:28）——移除日志后结果不变 |
| V9 | `git diff \| grep -c "SA7-DATAFLOW"`；`grep -c "SA7-DATAFLOW" <SA7 测试文件>` | 0 / 0（无临时诊断残留） |
| V10 | 文档锚存在性：`grep -n "分片形态计数口径\|发射侧归属表\|issue #423 发射点注记\|决策 5 观测面落地注记" docs/protocols/instance-replication-v1.md docs/adr/0032-*.md` | §17:582、§23.1:745 + :833、§22:704、ADR 0032:45 全部在场 |

## Deviations

- **无验证范围偏离**：全部动态面源自设计 §8/§12、SA6 契约、SA4 §11 登记项；未消费 SA9/SA10 产物、未运行全仓回归、未读远端 CI、未做静态代码审查（SA4 已完成）。
- D-SEAM1b 首版红灯为**夹具构造缺陷**（闸门开启时 `deliver` 走同栈直发分支，驻留发生在 runtime dirty 态而非通道队列——`sendQueueMs` 口径本就不含该段，行为正确）；按 `update-channel.ts` `deliver` 分支语义改为「闸门关闭入队 → 真实驻留 → 重开闸门 drain」后转绿。该红灯不构成对实现的否证，反而确认了「sendQueueMs = 通道队列驻留（非 runtime dirty 驻留）」的 §23.1 口径。
- 根 `pnpm typecheck` / `pnpm test` 与分片（worker）形态运行时锚未执行（SA6 U6 / SA4 §11 行 1/4：Host 职责与 T3/T5 follow-up）——登记非阻塞。
- 未新增 `[SA7-DATAFLOW]` 生产日志（既有事件/返回值/stub 留痕已足够观察全部关键跳点）。

## Verdict

**approve**

- 设计声明改变的三条数据流路线全部按设计变化，关键中间跳点（缝上 `(frame, accounting)`、占位序边界、edge 定偏移判定、恰一发射、拒绝路径 `connectionId`）均有运行时证据；
- 设计声明不变的路线（chunked 留 session、peer 面、listen 计数、隔离单点、缺面 dormant、键集白名单、拆分前金标、wire 面）全部保持；
- 状态机转换与关键值正确（恰一、严格递增、seq=0 零事件、close 后零复活、畸形帧 dormant），禁止状态未出现；
- 错误与 cleanup 符合设计（throw 隔离、拒帧弃置记账、close quiescence、无伪成功）；
- SA3 验证声明全部独立复现（契约 21/21、守卫 10/10、包级 86→87 files 全绿、typecheck exit 0）；临时诊断已清理且移除后结果不变；
- SA4 = approve 且本轮无独立 fail 发现；无 owner 要求追加面。
