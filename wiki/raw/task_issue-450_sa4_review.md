# SA4 Implementation Review — Issue #450（γ-T4：γ 流控与生命周期收口）

- Dispatch：`sa-daa25c6f-b77a-4d0c-ac8c-76525f54c782`（mabf-sa4 / implementation-review / iteration 0）
- 审查对象：SA3 交付（`wiki/raw/task_issue-450_sa3_impl.md`，dispatch `sa-018ababa-…`）——worktree `/home/wangjian/nomicore-fix-issue-450`，branch `mabf/issue-450`，HEAD `444c1665`（= SA6/SA1/SA2/SA8 基线）+ 未提交实现 diff。
- 审查方式：实现静态审查（本技能纪律）——逐行核对生产 diff（3 个 src 文件 + AGENTS.md）与测试/夹具（2 新建 + 2 append），交叉核对 SA6 契约、SA1 设计 iteration 1、SA2 iteration 1（`approve`）、SA8 冲突门 iteration 1（`clear`，读法 A 确认）与 12 份 `artifacts/sa3-issue450-*.log` 证据。**未运行测试、未启动服务、未修改任何实现/设计/测试。**

---

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-450.md`（Host 简报；7 AC；`## Comments` 空） | 在场，已读 |
| Owner 评论 | 派工明示 REST snapshot 空——无 owner 追加要求 |
| `wiki/raw/task_issue-450_sa6_contract.md`（已批准验收契约） | 在场，已读（§5–§14 逐条对照） |
| `wiki/raw/task_issue-450_design.md`（SA1 iteration 1，517 行） | 在场，已读（D1–D9/§8.1/§11/§12） |
| `wiki/raw/task_issue-450_sa2_review.md`（iteration 1 `approve`；F-1 关闭 + O1–O4） | 在场，已读 |
| `wiki/raw/task_issue-450_design_conflict_report.md`（SA8 iteration 1 `clear`；读法 A 确认；R1–R7） | 在场，已读 |
| `wiki/raw/task_issue-450_sa3_impl.md` | 在场，已读（含 Deviations 1–4） |
| `wiki/raw/task_issue-450_dispatch.md` | 在场，已读 |
| 生产 diff：`src/backpressure.ts` / `src/hub-edge.ts` / `src/hub-edge-host.ts` / `AGENTS.md`；测试：`issue450-flow-seam.ts`（新）、`ws-replication-issue450-flow-lifecycle.test.ts`（新，22 用例/8 describe）、`issue447-async-seam.ts`（append）、`ws-replication-issue421-edge-factory-api.test-d.ts`（append） | 逐行核对 |
| 证据：`artifacts/sa3-issue450-{red-focused,red-typecheck,focused-green,focused-typecheck,gamma-family,421-suite,package-suite,package-tsc,root-typecheck,root-test,mutation-wing2,focused-repeat3}.log` | 逐份核对（计数/断言消息/时间戳自洽） |
| 缺席（非阻塞）：`task_issue-450_relevant_decisions.md` / `_conflict_report.md` | 实查不存在（SA6/SA2 同判） |

## 2. Verdict

**`approve`** —— 无 BLOCKER、无 MAJOR。实现忠实落实批准设计（D1 两翼 + D2/D3/D8 + F1–F4/D7 + 全部契约锚），文件范围严格在 ALLOW 内、DENY 零触碰，β/α 缺省语义经 `BPK-NC1`/`BPK-NC2`/PUB 与 102 文件包全量 + 根门禁（465 文件/5649 用例）双向锚定；红灯（4 用例恰为设计预言缺口）与变异负控（`pausePreGate` 恒 true ⇒ `BPK-C4` 判别性断言红）证明测试敏感性。MINOR 观察项见 §12（不阻断）。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| AC1 账本溢出 ⇒ 1011 收口锚；逐帧拒纳/ns 级 resync 在 γ 不可达 | 翼(i) `backpressure.ts:184-194`（`ledger-overflow` → 钩子）+ 翼(ii) `hub-edge-host.ts:713-716`（`pausePreGate`）；`BPK-C1`（无面）+ `BPK-C4`（有面不 advance，生产拓扑形态）+ `BPK-C2` 共享断言组（零 `RESYNC_REQUIRED`/零 `resync-required`/零 `update-dropped`/零缝 `connection-fatal`/词汇闭集合）；红证据 `sa3-issue450-red-focused.log`（BPK-C1/C2、BPK-C4 红） | 落实 |
| AC2 单帧超限 ⇒ 响亮收口 + 诊断（配置错误定性） | `OVS-C1`：返回 0 + 恰一 `ERROR{FRAME_TOO_LARGE}` + close 1009 + `connection-failed` 字段锚 + 零 `update-sent` + 零 wire 字节；`OVS-NC1/NC2` 负控（cap 充裕 + 清账 + 界内小帧）；码取既有注册表（`wsCloseCodeFor('FRAME_TOO_LARGE')`=1009，零新码） | 落实 |
| AC3 close 后丢弃锚 + close 冲刷 pending 无泄漏 | `DROP-C1`（收口前放行对照 + 收口后零盖章/零回执/零 wire/零事件/状态 closed）+ `FLUSH-C1`（幂等同 promise、closeCalls=1、冲刷后零 `RESYNC_REQUIRED`、迟到回执良性）+ `FLUSH-C2` 判别力负控；1011 收口后丢弃域另由 `MEM-C1b/C2` 的死亡后零新观测锚定 | 落实 |
| AC4 `terminateUnauthorized` 不溯及已推帧 | `REVOKE-C1`（回执 FIFO 位 strict 先于 terminate、恰一 `NAMESPACE_UNAUTHORIZED`、ns failed、连接存活）+ `REVOKE-NC1` 幂等负控 | 落实 |
| AC5 `settled` 晚到 drain + `closeTimeoutMs` 不变 | `DRAIN-C1` 三形态（未达到点恰 1001 'hub-reauth' / 早达提前收口 / 收口后晚达零二次）+ `DRAIN-NC1`（注入 2× 窗口 ⇒ 收口时刻随配置移动 + GOAWAY `drainTimeoutMs` 字段锚） | 落实 |
| AC6 OPEN 水位延迟复核（原值不误收口；打穿响亮收口） | `OPENWP-C1/C2` ×2 形态（4 并发 deferred OPEN / 1 OPEN + 15 缓冲帧 = 恰 16；第 5 / 第 17 ⇒ 恰一 `CONNECTION_POLICY_VIOLATION` + close 1008）；F2 `deferSinkResolve` + `resolveSink` 泵真实注入跨缝延迟；常量直接 import 生产值（`MAX_*`） | 落实（帧闸形态的「按序冲刷」观察缺失 ⇒ O-1，MINOR） |
| AC7 内存安全链锚（逐跳有界；死亡释放） | `MEM-C1`（session 队列跳 = queue-overflow ns 级存活）与 `MEM-C1b/C2`（edge 账本跳 = 1011 死亡 + 死亡后零 pending 泄漏/零新观测）判然两分 + `MEM-NC1`（= `BPK-C3` 及时消费零死亡）；计数直锚为 SA6 §7/N6 可选项，未落地（SA3 Deferred-1 如实申报） | 落实（主锚齐；可选增强缺席不阻断） |
| SA6 §12.2 全部契约条目 | BPK-C1/C2/C3/C4、BPK-NC1/NC2、OVS-C1/NC1/NC2、DROP-C1、FLUSH-C1/C2、REVOKE-C1/NC1、DRAIN-C1/NC1、OPENWP-C1/C2、MEM-C1/C2/NC1、PUB——逐条有对应用例（22/22） | 落实 |
| SA2 O1–O4 | O1（doc 次序措辞按装配分形态——`hub-edge-host.ts:121-131` 已改写）；O2（`BPK-NC2` 钉 `cause:'ack-timeout'` 与 NC1 `send-failed` 判别——test:296）；O3 未加专属断言（SA3 记录理由：BPK-C4 编排即纯 data 极端形态，判据不依赖 `paused`；保留面发射点未动）；O4（SA8 读法 A 确认 ⇒ 翼(ii) 落地，R9 关闭） | 落实（O3 为登记不处理，非阻断） |
| SA8 R1–R7 实现期义务 | R1 公共面 append（`?: true` 精确形状、allocate 双落点 :971-982、index.ts 零改动）；R2 两翼机械（守卫仅增可选调用、次序/判据/投影逐字、`pausePreGate` 构造期常量单构造点 :982、`closedFlag` 幂等、`tornDown` 零记账 `backpressure.ts:232`）；R3 冻结面（102 文件全绿 + NC1/NC2 + γ 族 65/65）；R4 规范零改动（`git status`/`git diff --check` 本审查复核实清）；R5 AGENTS.md append-only 登记句（方向性义务 + 双向误用 + 前置门声明，同一变更集）；R6 `update-channel`/`bulk-transfer` 零触碰；R7 公共 doc 真陈述（γ 0 值三来源穷尽核验：前置 `closed` 闸 / oversize 守卫 / ledger-overflow 守卫；`emitFrame`→`emitOne` 序号耗尽为响亮 throw 非静默 0） | 落实 |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| D1-翼(i) 守卫失败动作分叉（钩子同步回调后仍 `return 0`；判定次序 oversize 先、严格大于、投影口径逐字不变） | `backpressure.ts:182-196` | 与 §8.1-② 逐字一致：两条守卫各增一行可选调用，`projected` 公式与 HEAD 逐字符相同 | 无 |
| D1-翼(ii) egress 前置门 γ 分叉（仅保留 `closed` 项；缺省 `closed ∨ ¬gate` 逐字保留） | `hub-edge-host.ts:705-716`（构造器参数 `pausePreGate` + egress 闭包） | 与 §8.1-⑥ 一致；`pausePreGate = options.asyncDataAdmissionFatal !== true` 单一派生（无第二标记） | 无 |
| D1 设置链（公共 option → `HubReplicationEdgeConfig` → 构造器条件挂接 + `HostEdgeConnection` 参数） | `hub-edge-host.ts:971-982`（双落点转发）、`hub-edge.ts:224-231`（条件挂接） | 条件展开缺省零传 ⇒ α/β/peer 新分支结构性不可达；`createEdgeConnection` 全仓唯一调用点（grep 复核） | 无 |
| D1.5 前置门暂停项让位（取舍 + 规范四点依据；SA8 读法 A 已确认） | 翼(ii) 落地；`BPK-C4` 判别性观察（`levelAtStamp > highWater` 仍盖章）+ 变异负控（`pausePreGate` 恒 true ⇒ 红，`sa3-issue450-mutation-wing2.log` 恰在该断言失败） | 落实且判别力被证明 | 无 |
| D3 码映射单点（ledger-overflow → 1011；oversize → `FRAME_TOO_LARGE` + `wsCloseCodeFor` 1009） | `hub-edge.ts:224-231` | 零新码（`errors.ts` 注册表零改动；`FRAME_TOO_LARGE` 在 `CONNECTION_OBSERVER_CODES` 白名单 = 注册表键 ∪ 2 内部码，`observer.ts:48-53` 复核） | 无 |
| D4 收口执行 = 既有 `connectionFatal` 单点 | `hub-edge.ts:690-716`（未改动；钩子汇入） | 零新拓扑；清 drain 句柄 → teardown → ERROR 直发 → closedFlag/close → requestSinkClose → transport.close → observer → cleanupAll 次序原样 | 无 |
| D5 AC3/AC4/AC5 零生产改动 | `git status`：`hub-session-async-host.ts`/`hub-session.ts`/`update-channel.ts`/`hub-namespace.ts` 等零改动 | 纯回归哨兵锚（DROP/FLUSH/REVOKE/DRAIN 族） | 无 |
| D6 F1–F4 夹具 | `issue450-flow-seam.ts`（427 行：F1 `decoratePressure` 旋钮 `level/advance/sentBytes/levelBeforeLastSend`、`bootFlowRound`、F3 `makeLargeUpdateFrame`、D7 `bootInjectionFlow`/`helloFrame450`/`openFrame450`、F4 头注零协议决策登记） | F1 三形态（无面/有面不 advance/持续 advance）齐；`Object.defineProperty` #137 先例；F3 clientID 钉死 + 帧长下界判据（R5）；未改 `issue448-live-seam.ts`（accept 装饰路线，DENY 尊重） | 无 |
| D7 OPENWP 白盒编排（4 并发 deferred OPEN / 1 OPEN + 15 缓冲帧两到界形态） | test:626-704 | 与 #421 OAP-C4c/C4d 实际模式一致（N4）；常量 import 生产单点 | O-1（见 §12） |
| D8 AGENTS.md append-only 登记句 | `AGENTS.md` diff：既有 bullet 句尾追加一句（方向性义务 + 双向误用 + 1011/1009 + 前置门仅 closed 项 + 缺省逐字不变） | 纯 append（原句逐字保留）；D8 全文要素齐 | 无 |
| D9 类型面 append | `ws-replication-issue421-edge-factory-api.test-d.ts`：`toEqualTypeOf<true \| undefined>()` + `satisfies` 置位/缺省 + `@ts-expect-error false`；头注/用例名 九→十 | 既有断言全保留；红型证据 `sa3-issue450-red-typecheck.log`（TS2339/TS2353/TS2344 恰在新锚） | 无 |
| §8.1 doc append（0 值语义按装配分形态真陈述） | `hub-edge-host.ts:121-134` | γ 三来源穷尽核验成立；缺省形态语义保持（SA2-O1 同步落实） | 无 |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| 流控单点（越界判死决策） | edge（A4.3） | `hub-edge.ts` 构造器 reason→码映射 + `connectionFatal` 单点 | 正确——session 半边零改动，无第二决策点 |
| 水位机械（暂停/恢复/poll/退休） | `ConnectionSender` | 未触碰（`observeWater`/`enterPause`/`resume`/poll 原样） | 正确——γ 下仅 egress 不再消费 data 闸门，control 侧/poll/α 闸门保留 |
| γ 装配标记语义 | 宿主装配期知识（工厂 option） | `HubReplicationEdgeOptions.asyncDataAdmissionFatal`（工厂级、无 per-call 覆盖） | 正确——与 `listen: false`/`asyncSendTickets` 同款装配期纪律 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| 1011 连接收口 | control 保留额度耗尽 → `onBackpressureExhausted` → `connectionFatal('CONNECTION_BACKPRESSURE', 1011)`（`backpressure.ts:129-140/163-172`、`hub-edge.ts:219`） | data 守卫钩子汇入**同一** `connectionFatal` 同码同拓扑 | 一致 | 复用既有单点（A2），零平行机制 |
| 可选宿主钩子分叉 | `onSendPaused?`/`onSendResumed?`（可选 observer 接线 = 零回调） | `onDataFrameAdmissionFatal?` 同款可选成员模式 | 一致 | 模块既有惯例 |
| β/γ 行为差登记（缺省零传死分支） | `asyncSendTickets`（`hub-session.ts:43`，γ 工厂唯一设置点） | `asyncDataAdmissionFatal`（edge 工厂 option，宿主置位） | 一致 | 同款 append-only opt-in 纪律 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| γ 装配形态 | 公共工厂 option（唯一设置点） | 翼(i) config 条件挂接 + 翼(ii) `pausePreGate = option !== true` | 无——单一开关派生两翼（SA8-R2 核对面），无第二标记 |
| 连接收口事实 | `closedFlag` + `setConnState('closed')`（`connectionFatal` 同步前缀） | egress 前置 `closed` 闸 / `isEmitAllowed` | 无——钩子回调返回前已置位（R7 doc 真陈述成立） |
| OPEN 水位（16/4） | `hub-edge-host.ts` 生产常量 | 测试 import 同一常量（非复制字面量） | 无 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| 无新增资源（钩子无状态；`pausePreGate` 构造期常量） | `connectionFatal` → `sender.teardown()`（账本/wheel/poll 清零，`backpressure.ts:261-274`）+ `cleanupAll` | `closedFlag` 幂等；守卫重复触发/多帧连撞收敛恰一收口；fatal 后迟到消息由既有 closed 闸/`requestSinkClose` 幂等承接 | 对称——零新增不对称面 |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 第二 data 收口拓扑 | `connectionFatal` 单点 | 钩子直调该单点 | 无平行 |
| γ 专用 sender/egress 面 | 单份 `ConnectionSender`/`HostEdgeConnection` | 构造期布尔分叉（无 fork） | 无平行（ADR 0032 决策 1 保持） |
| 夹具侧合成错误码 | — | F4 头注明令禁止；`BPK-C2` 断言缝上零 `connection-fatal` 信号佐证 | 无违反 |

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/ws-replication/src/backpressure.ts`（modified） | §11 ALLOW-1 | 翼(i) 钩子 + 两守卫调用 + 模块头注 | 在范围；diff = 纯新增（守卫体仅包裹化，判据零变化） |
| `packages/ws-replication/src/hub-edge.ts`（modified） | §11 ALLOW-2 | config append + 条件挂接 + 码映射 | 在范围 |
| `packages/ws-replication/src/hub-edge-host.ts`（modified） | §11 ALLOW-3 | option append + 双落点 + 前置门分叉 + doc append | 在范围 |
| `packages/ws-replication/AGENTS.md`（modified） | §11 ALLOW-4 | D8 append-only 登记句 | 在范围（纯句尾追加，既有句逐字保留） |
| `packages/ws-replication/test/issue450-flow-seam.ts`（untracked 新建） | §11 ALLOW-5 | F1–F4/D7 夹具 | 在范围 |
| `packages/ws-replication/test/ws-replication-issue450-flow-lifecycle.test.ts`（untracked 新建） | §11 ALLOW-6 | 验收契约本体（22 用例） | 在范围；路径逐字命中根 vitest glob（SA6 §14） |
| `packages/ws-replication/test/issue447-async-seam.ts`（modified） | §11 ALLOW-7（append-only） | 标记转发 + F2 闸门 | 在范围；`git diff -w --numstat` = **+49/−0**（语义 append-only，本审查独立复算）；resolver 抽取 `build` 闭包仅缩进重排，#447 三套件复跑绿背书 |
| `packages/ws-replication/test/ws-replication-issue421-edge-factory-api.test-d.ts`（modified） | §11 ALLOW-8（append-only） | PUB 类型锚 + 九→十 | 在范围；既有断言全保留 |
| `artifacts/sa3-issue450-*.log` ×12（untracked） | 证据落盘（设计 §12.2 惯例；SA6 `artifacts/sa6-*` 先例） | 运行证据 | 在惯例内 |
| `wiki/raw/task_issue-450*.md`（untracked） | Host/各 SA 固定产物 | 流程工件 | 非实现改动 |

DENY 核对（`git status` 逐项）：`hub-session-async-host.ts`、`hub-session.ts`、`hub-namespace.ts`、`update-channel.ts`、`round-engine.ts`、`bulk-transfer.ts`、`types.ts`、`hub-session-host.ts`、`hub-connection.ts`、`plugin.ts`、`peer-*.ts`、`frame-io.ts`、`hub-upgrade-admission.ts`、`index.ts`、`testing.ts`、`issue448-live-seam.ts`、既有 `*.test{,d}.ts` 族、`packages/replication-protocol/**`、`docs/adr/0032`、`docs/protocols/instance-replication-v1.md`、`CONTEXT.md`、其余包/根配置——**零触碰**。`git diff --check` 清（本审查复跑）。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| `ConnectionSenderHost` append 可选成员 | `hub-edge.ts:203`（hub host）、`peer-connection.ts`（peer host，零改动） | peer 不设钩子 ⇒ 缺席分支死码；hub 条件挂接 | 无 | 无 |
| `HubReplicationEdgeConfig.asyncDataAdmissionFatal` | `HubReplicationEdgeFactoryImpl.allocate`（唯一调用 `createEdgeConnection` 处） | 条件转发；其他 `createHubReplicationEdge` 直接消费者（#424 facade、#421 测试、α 组合根、peer）不传 ⇒ 行为逐字节不变 | 无（`BPK-NC1/NC2` + PUB + 102 文件全量运行期证明） | 无 |
| `HostEdgeConnection` 构造器第 3 参 | 单构造点 `:982` | 构造期常量，无运行时切换 | 无 | 无 |
| 公共 `HubReplicationEdgeOptions`（第 10 可选成员） | 类型经 `src/index.ts` 既有再导出流动（index 零改动）；421 test-d 锁型 | append-only 通道（SA8 #6 裁定）内 | 无 | 无 |
| `HubReplicationEdgeEgress.sendDataFrame` 0 值语义收窄（γ） | γ 桥（`issue447-async-seam.ts` 中继 + 回执条款）与未来 nomic-server 直驱宿主 | doc 真陈述：γ 下 0 ⟺ 已收口（三来源穷尽本审查源码复核）；桥 `egress ≤ 0 ⇒ 不投回执` 条款不变——收口后 tag 随 close 冲刷，无悬挂 | 无 | 无 |
| observer 消费者 | `connection-failed.code` 取值 | `FRAME_TOO_LARGE` 已在白名单（注册表键）；`send-paused/resumed` 发射点未动 | 无 | 无 |
| wire / 错误注册表 | peer/对端 | 零 wire 格式变化、零新码（`replication-protocol` 零改动） | 无 | 无 |

## 8. 错误、恢复与并发

- **重入安全（SM-1 复核）**：钩子在 `tryEmitDataFrame` 栈内同步执行 `connectionFatal`（含 `sender.teardown()` 与 ERROR 直发）；回调返回后仅 `return 0`，不读 sender 状态（`backpressure.ts:184-194` 源码复核）。收口 ERROR 经 `outbound.sendControl` 直发，`onEmitted` 因 `tornDown` 早退 ⇒ 账本零增长（`:232`）。
- **幂等**：`closedFlag` 早退（`hub-edge.ts:691`）使守卫重复触发、fatal 后再调钩子、多帧连撞收敛恰一收口（`BPK-C1/C4` 恰一断言 + MEM-C2 零新观测）。
- **fatal 与缝在途消息并发**：同一 release 循环内后续帧撞 egress `closed` 闸返回 0（夹具 `unsealed++`，设计 R3 已登记不计失败）；session 侧 close 送达前 ackTimer 先火 ⇒ resync 帧经已关 transport 零 wire 字节（`assertNoGammaRejection` 任意释放次序成立）。
- **`pausePreGate` 并发面**：构造期常量，无竞态；γ 下 `dataGateOpen()` 不再被 egress 调用，`observeWater` 调用点收敛到 control 发送/poll（既有单线程同步段）。
- **错误不吞**：翼(i) 失败动作从静默 0 升级为响亮收口 + 诊断恰一；夹具 `resolveSink` 对无挂起解析响亮 throw（无静默兜底）；`makeLargeUpdateFrame` 8 次未达下界 throw。
- **静态无法确认项**：真实 ws socket（协议 §17 三面 Adapter）上的 `bufferedAmount` 动态与 peer 重连 backoff 幅度——列入 §11 动态验证项。

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| BPK-C1/C2（test:156） | 恰一 `ERROR{CONNECTION_BACKPRESSURE}` + close 1011 + observer 字段 + close 送达恰一 + 冲刷 + 零 RESYNC/零声明/零缝 fatal/词汇闭集合 | 根/包 vitest glob（实采集 102 文件内） | 无 | 红证据在 HEAD 复现（red log 恰此用例红） |
| BPK-C4（test:169） | `level() > highWater` 时仍有盖章（判别性）+ 恰一 1011 + `assertNoGammaRejection` | 同上 | 无——变异负控（`pausePreGate` 恒 true）恰使判别断言红 | 敏感性已证 |
| BPK-C3/MEM-NC1（test:193） | 持续 advance ⇒ 60 帧全盖章、存活、零收口、stamp 配对 | 同上 | 无 | — |
| BPK-NC1（test:224） | β 同步缝：`RESYNC_REQUIRED{send-failed, send-frame-rejected}` 必达 + 存活 + 零 1011 | 同上 | 载体 = #420 shim 桥（`createHubSessionHost` 同步缝）——SA6 §6/§12.2 明列允许载体；断言键与契约逐字一致 | 无（SA3 Deviation-1 成立） |
| BPK-NC2（test:269） | 漏置位：unsealed>0 + 存活 + 零收口 + ackTimeout 后 ns 级 resync（cause=ack-timeout） | 同上 | 无（O2 落实：cause 与 NC1 判别） | — |
| OVS-C1（test:307） | 返回 0 + 恰一 `FRAME_TOO_LARGE`/1009 + 零 update-sent + 零 wire 字节 | 同上 | 无 | 红证据在 HEAD |
| OVS-NC1/NC2（test:324） | cap 充裕 + 清账 ⇒ 同帧出站（记录面隔离）+ 界内小帧放行 + 零收口 | 同上 | 无（N2 校准：64KiB + `advance(level())` 双保险） | — |
| DROP-C1（test:357） | 收口前放行对照 + 收口后零盖章/回执/wire/事件 + settled 落账零收口 | 同上 | 无 | — |
| FLUSH-C1/C2（test:407/459） | close 幂等同 promise + closeCalls=1 + 冲刷后零声明 + 迟到回执良性；无 close 必达 ack-timeout×1 | 同上 | 无（判别力负控在票内） | — |
| REVOKE-C1/NC1（test:484/524） | 回执 FIFO strict 先于 terminate + 恰一 ns ERROR + 存活；重复 revoke 零第二帧 | 同上 | 无 | — |
| DRAIN-C1×2 / NC1（test:551/586/603） | 到点恰 1001 'hub-reauth' + close 恰一 + 晚达零二次 + 早达提前 + 注入窗口移动（GOAWAY `drainTimeoutMs` 字段锚） | 同上 | 无 | — |
| OPENWP-C1/C2 ×2（test:626-704） | 恰 4/恰 16 零收口 + pendingSinks 台账 + 第 5/第 17 恰一 1008 + quiesce | 同上 | 帧闸形态 resolve 后仅断言台账归还与零收口，「按序冲刷」无直接观察（#421 OAP-C4d 白盒锚在生产同码上存在） | O-1（MINOR） |
| MEM-C1/C1b/C2（test:710/732） | 两跳判然两分（queue-overflow ns 级存活 vs 1011 死亡）+ 死亡后零新盖章/回执/wire + closeCalls=1 | 同上 | 计数直锚（可选）未落地（SA3 Deferred-1 申报） | O-2（MINOR） |
| PUB 缺省不变性（test:765） | 缺省零传成功路径逐字节正常 | 同上 | 无 | — |
| 421 test-d append | `true \| undefined` 型锁 + satisfies 置位/缺省 + `@ts-expect-error false` | vitest typecheck include（`*.test-d.ts`）实跑 8 用例绿 | 无（红型证据 TS2339/2353/2344 恰在新锚） | — |

-runner 触发真实性：新文件被包全量（102 文件/919 用例，恰 +1 文件/+22 用例）与根门禁（465 文件/5649 用例）实际采集执行；3 次复跑逐值相同。零 skip/only/todo（grep 复核）、零 env override、零源码字符串断言（断言面 = wire 帧/close info/observer 字段/返回值/缝消费序/句柄计数）。

## 10. Required revisions

无（无 BLOCKER/MAJOR）。

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| 真实 ws socket 上的 γ 收口（协议 §17「生产 Adapter 必须暴露三面」；F1 旋钮为内存等价模型） | 真实传输动态验证（后续阶段/SA7 面） | 真慢对端 + γ 装配 ⇒ 恰一 1011（wire ERROR + close code + observer），无逐帧弹回长存 | 出现暂停弹回 + ns 级 resync 存活（= 翼(ii) 在真实传输上失效）或重复收口 |
| 1011/1009 后 peer 重连行为（backoff 幅度与新连接噪音；测试以 conn-0 域 + 不推进 peer 调度器隔离，R2 登记） | 长时运行动态验证 | 重连后新连接正常建立，旧连接资源（账本/wheel/poll）零残留 | 重连风暴或句柄/定时器泄漏 |
| γ 下 `send-paused`/`send-resumed` 经 control/poll 边沿的可观测性（O3 无专属断言；BPK-C4 为纯 data 极端形态） | 带 control 流量的 γ 编排动态观察 | 水位越过 high/low 时水位事件仍可达、字段不变（§23.1） | γ 下水位事件永不发射（观察点意外死区） |
| `teardown` 内存释放的堆级确认（MEM-C2 以行为代理断言；SA6 §7 明示不做真实堆测量） | 内存 profile | 收口后连接对象可回收，账目计数归零 | 泄漏趋势 |

## 12. Non-blocking observations

| ID | Severity | Observation | Evidence | Suggested change |
|---|---|---|---|---|
| O-1 | MINOR | `OPENWP-C1`（帧闸形态）用例名宣称「resolve 后按序冲刷」，但仅观察台账归还（`pendingSinks()===0`）与零收口；15 缓冲帧向 session 的按序投递无直接观察。缓冲机械为 #421 已锚生产同码（OAP-C4d 白盒断言了投递序），γ permutation 缺该面 | test:665-688 vs `ws-replication-issue421-open-admission-pipeline.test.ts:608-622` | 后续票（#451 观测面或 #447 夹具维护时）补 `edgeToSession.delivered()` 序列断言，或将用例名收窄为已断言面 |
| O-2 | MINOR | `MEM-C2` 计数直锚（`pendingSends`/`inFlight` 清零）未落地——SA6 §7/N6 定为可选增强，SA3 Deferred-1 如实申报；主锚（行为代理）已绿 | SA3 报告 Deferred-1；test:732-759 | 可选：经夹具探针暴露计数后在 #451 补 |
| O-3 | MINOR | O3（γ 下水位事件可达性专属断言）未加——SA3 记录理由（BPK-C4 即纯 data 极端形态，判据不依赖 `paused`；`enterPause`/`resume` 发射点零改动）。D1.5「保留面」声明在 γ 形态仍为 doc-only | SA3 报告 O3 行；`backpressure.ts:320-337` | 可选增强，见 §11 动态项 |
| O-4 | MINOR | `BPK-C2` 的缝词汇闭集合检查遍历**夹具自身** `host.log` 的 `name` 字段——验证的是运行期桥行为无意外词汇，而非生产类型面（后者已由 `SeamMessageName` 联合类型静态锁死）；断言强度有限但符合契约字面 | test:111-122；`issue447-async-seam.ts:265-272` | 无需动作（登记断言强度） |
| O-5 | info | `BPK-NC1` 载体偏离设计括注（`makeShardedReplicationFacade` → #420 shim 桥）：前者 `ShardedFacadeOptions` 不收 limits（实查），SA6 §6/§12.2 明列「监听单体或 `createHubSessionHost` 同步缝」为合法载体；断言键与契约逐字一致 | SA3 Deviation-1；`issue420-shim-hub.ts` 头注（真 edge + 公共 `createHubSessionHost` + 真 peer） | 无需动作 |
| O-6 | info | `issue447-async-seam.ts` 语义 append-only（`git diff -w` = +49/−0，本审查独立复算）但带缩进重排；#447 三套件 + #448 + 包全量复跑绿背书行为零变化 | `git diff -w --numstat`；`sa3-issue450-gamma-family.log`（65/65） | 无需动作 |
| O-7 | info | 全部 #450 用例 `timeout: 30_000`——对虚拟调度器编排偏宽裕，无准确性影响 | test 各用例 | 无需动作 |

## 13. 复核说明

- 本审查未运行任何测试/服务/临时进程；所有运行期结论引自 SA3 落盘证据与静态源码核对（证据日志计数链自洽：γ 族 43+22=65、包 101+1=102 文件、897+22=919 用例、421 套件 98、根 465/5649；红 4 失败恰为设计预言缺口；变异负控恰在判别断言失败）。
- 生产 diff 与设计 §8.1 代码草案逐行比对一致（含注释锚）；DENY 面与规范文档零触碰经 `git status`/`git diff --check` 本审查复跑确认。
- 未发现新的 ADR 冲突风险（实现 = SA8 iteration 1 已 `clear` 的读法 A 之忠实落地；规范文本零改动；缝词汇/错误注册表/wire 零扩展）⇒ `requiresConflictRecheck` 不提交。
