# SA4 实现静态审查 — issue #418：`HubConnectionImpl` 拆分 Edge/SessionHost + 单体进程内组合

- Dispatch：`sa-f47a340e-10ea-4e55-9b1a-4bcd0ad69296`（mabf-sa4 / implementation-review / iteration 0）
- 审查对象：worktree `/home/wangjian/nomicore-fix-issue-418`（分支 `mabf/issue-418`，HEAD `27e012b6606e48797842a79e11e3505819c34cc6`）内 SA3 iteration 2 实现 diff + 其证据链
- 基线对照：HEAD `hub-connection.ts`/`frame-io.ts`/`backpressure.ts`（`git show` 逐段亲读比对）；批准设计 iteration 2；SA6 契约；SA2/SA8 裁决
- **Verdict：`approve`**（无 BLOCKER / 无 MAJOR；4 条非阻断观察见 §12；`requiresConflictRecheck: false`——SA8 实现后复查已以独立报告闭合（§1），本轮未发现新的 ADR 冲突面）

---

## 1. Reviewed inputs

| 输入 | 状态 |
| --- | --- |
| `wiki/raw/task_issue-418.md`（简报；Issue body 5 AC；§Comments 空） | 读取；无 owner 追加要求（派工单明示 REST comments `[]`） |
| `wiki/raw/task_issue-418_design.md`（SA1 iteration 2 批准设计，736 行） | 全文读取，逐节对照实现（D1~D8、§11 ALLOW/DENY、§12 验收映射、附录 A/B） |
| `wiki/raw/task_issue-418_sa3_impl.md`（SA3 iteration 2 原位版实现报告） | 全文读取；其 §3/§5/§6/§8 宣称逐项与实际 diff、日志核对 |
| `wiki/raw/task_issue-418_sa6_contract.md`（SA6 契约 approve；C0a~C0d + C1~C6 + U1~U5） | 全文读取 |
| `wiki/raw/task_issue-418_sa2_review.md`（SA2 iteration 2：approve；F1~F5 闭合 + N1'~N5'） | 全文读取 |
| `wiki/raw/task_issue-418_design_conflict_report.md`（SA8 设计后复查：clear + 注 C' + §8-R1~R9'） | 全文读取 |
| `wiki/raw/task_issue-418_implementation_conflict_report.md`（SA8 **实现后**复查：clear + R9' 六项闭合，本轮补充发现） | 全文读取；SA4 质量轴与其裁决轴独立、结论一致 |
| 源码亲读 | `hub-split.ts`（127）/`hub-edge.ts`（790）/`hub-session.ts`（293）/`hub-connection.ts`（469）全文；`frame-io.ts`/`backpressure.ts` diff 逐行；`hub-namespace.ts`（startOpen :335-375、isOpenAborted :529-531、HubChannelHost :52-100——零 diff 核验）；HEAD 侧 `onMessage/onHello/dispatchReady/onOpenNamespace/withChannel/channelHost/close 五路/beginReauth/maybeFinishDrainEarly/cleanupAll/setConnState` 逐段比对 |
| 测试亲读 | 两 ALLOW 测试文件全文（structure 777 行 / matrix 762 行）；SA6 契约文件（零 seam 引用 grep=0）；codec 守卫测试（5 用例） |
| 证据日志 | `sa3-issue418-{m1-head-baseline,acceptance-tests,package-suite,typechecks,root-test}-iter2.log` 逐个 tail/head 复核（§9）；两锚在包全量日志中绿 |
| 工作区核验 | `git status` / `git diff --stat HEAD`：DENY 面全部零 diff；`git stash list` 空；mtime 时间线（§6 注） |

SA4 未修改任何生产代码、设计或测试；未运行测试/服务；唯一产物为本文件。

## 2. Verdict

**`approve`**。核验结论（逐轴）：

1. **设计落实（§4）**：D1~D8 逐项与代码对上——D5 重写（到达点投递 + admission 台账 + 拉取 shim）由构造成立：`onOpenNamespace` ①台账先建→②无条件投递（hub-edge.ts:323-328），`startOpen` 同步前缀在 ② 内同步执行至 `await this.host.authorize(...)`（hub-namespace.ts:335-344，零 diff 亲证），shim 在该点同步调 `port.openAdmission` 命中 ① 的台账——I13 两锚（ac7-faults:53 / issue171-red:183）由构造转绿，包全量日志证实（12/12、5/5）。
2. **冻结面（§6）**：DENY 清单 `git diff --stat HEAD` 逐项为空（`hub-namespace.ts`、index/testing/types/defaults/validate/plugin、peer-*.ts、session 机械件 9 文件、`replication-protocol/src/**`、docs/CONTEXT/apps/根配置）；既有 73 测试文件零修改（`git diff --name-only HEAD -- packages/ws-replication/test` = 0）；SA6 契约文件未被触碰（mtime 2026-09-21 22:31 = SA6 会话；零 seam 引用）。
3. **TDD 覆盖（§9）**：C0a~C0d 白盒（到达点断言 + 四形态 admission 臂含 reject 响亮臂 + 锁步 + 结算段零回放行为证明）、M1 十臂×{ok,deny}**加到达点断言**（镜像 I13a）、M1-revoke 臂对 **HEAD stash 基线**重定基（断言强度增强非弱化）、M2/M3 维持；全部经真实 runner 触发（vitest include `packages/*/test/**/*.test.ts`，日志含文件行）；零 skip/only/todo、零源码字符串断言。
4. **回归（§9）**：包全量 75/75 文件 569/569 用例（对照 iteration 0 的 73/75、567/569——唯二红即两锚，本轮已转绿）；根 `pnpm test` 439/439 文件 5299/5299 用例 + `Type Errors: no errors`；包/protocol/根 typecheck 三 EXIT=0；HEAD 基线（stash 采集）25/25 绿。日志头部（`RUN v3.2.7 /home/wangjian/nomicore-fix-issue-418`）与 mtime 序（matrix 更新 00:48:51 → 基线日志 00:49:08 → 源码复原 00:49:11 → 结构测试 00:57:42 → 全量 01:05:59）与 SA3 §6 方法论自洽。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
| --- | --- | --- |
| Issue AC1 两半可独立实例化 + 单体组合 | `createHubReplicationEdge`（hub-edge.ts:788，注入 transport/authorize/sessionFactory，零 Registry 依赖）+ `createHubSessionHost`（hub-session.ts:291，注入 port/registry）+ 组合根 `createEdge`（hub-connection.ts:429-463，D7 装配逐成员对上）；C0a/C0b/C0c 绿 | ✅ |
| Issue AC2 出站单点盖章在 edge、入站 expectedSeq 在 edge | `emitOne` 耗尽检查→`writeBe32At(bytes,8,seq)` 单点盖章（frame-io.ts diff）；入站 `decodeInbound(expectedSequence)` 先于分派（hub-edge.ts:373-402，与 HEAD :666-695 逐行一致）；C1/C2 契约绿 | ✅ |
| Issue AC3 通道零改动 | `git diff HEAD -- hub-namespace.ts` 为空；authorize 仍经注入 `HubChannelHost.authorize`（session 组装 24 成员逐名迁移，authorize 成员换 D5.3 拉取 shim、签名不变） | ✅ |
| Issue AC4 既有全量不改而绿（含两锚） | 既有测试文件零修改（git 核验）；两锚 + SA6 契约 17 用例 + 73 文件全量在 `package-suite-iter2.log` 绿（569/569） | ✅ |
| Issue AC5 三门禁 | `typechecks-iter2.log`（pkg/protocol/root 三 EXIT=0）+ `root-test-iter2.log`（439/439、5299/5299、Type Errors no errors） | ✅ |
| 零新公共 API / 零配置 | index/testing/types/defaults/validate 零 diff；两工厂 + 缝类型仅模块级导出（C0c 断言 hub-connection=['createHubReplication']、edge/session 各单工厂、缝模块零运行时导出——绿）；C5a/C5b 绿 | ✅ |
| SA3 §7 BLOCKER（iteration 0 reject 主证） | 方案 A 落地：两锚由构造绿（§2.1）；M1 到达点断言钉死窗口效应 | ✅ 已消解 |
| SA2 N1'（thenable 前设） | `Promise.resolve(authorize(...))` 包裹落地（hub-edge.ts:345）——plain-object 非法返回值按值结算 = HEAD `await` 宽容语义；残余 undefined/null 角落见 §12-O1（非阻断） | ✅（带观察） |
| SA2 N2'（结构断言形态） | 行为证明交付：C0a/C0d 到达点投递 + 锁步 + 迟归结算后序列不变（:763-764）⟹ 无窗口日志/二相 entry/结算回放；零源码文本扫描 | ✅ |
| SA2 N3'（次序注释固化） | hub-edge.ts 文件头 :14-19 + `onOpenNamespace`/`beginAdmission` 注释逐句固化「①先于② = shim 拉取前提」「调用点前移 = 同段不可分辨」 | ✅ |
| SA8 §8-R1~R3/R9'（实现证据/冻结门/必做测试/新缝面核对） | 逐项闭合（SA8 实现后复查 §3/§5/§8，clear）；SA4 本轮独立复核一致 | ✅ |
| SA6 C0 白盒判据（§12.1） | C0a~C0d 全部按更新后判据交付且绿（§9） | ✅ |
| Owner comments | REST `[]` + 简报 §Comments 空——无遗漏 | ✅ 无适用项 |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
| --- | --- | --- | --- |
| D1 缝契约（`HubOpenAdmission` 三态无 revoked / port 17 成员含 `openAdmission` / `openNamespace` 无 admission 参数 / channels 观测投影注释） | hub-split.ts 全文逐成员比对设计 §7 D1 代码块 | ✅ 逐项一致 | — |
| D1 文件头同步不变量（delivered⇒在场 / 只增不减 / settled 单调 / 台账⟺通道 / 恰一次 authorize） | hub-split.ts:7-22 | ✅ | — |
| D2 劈分总账（逐符号归属） | 连接 FSM/liveness/reauth/五路收口/mux→hub-edge；通道容器/channelHost 组装/分派壳/shim→hub-session；服务面/accept 门/早到帧 admission→hub-connection 原样（§5 服务层 diff 仅 `new HubConnectionImpl`→`createEdge` 换装） | ✅ | — |
| D3 出站：session 占位编码 + 闸门前置；edge mux 盖章 | `encodePlaceholder`（hub-session.ts:257-263，sequence=0）；`sendData`：connectionState→dataGateOpen→编码→缝（:210-216）；`sendControlFrame/tryEmitDataFrame`（backpressure.ts diff：observeWater→暂停态配额 byteLength 判据→出队；单帧守卫+统一账本 byteLength 判据）；`emitOne` 盖章单点；与 HEAD `sendControl`/`tryEmitData`（git show :110-136）逐路径比对 | ✅ 次序账逐路径对上；R4' 登记角落维持（见 §12-O2 peer 侧波及注记） | — |
| D4 入站：edge 单点全解码 + 定偏移三案路由 | `routingKeyOf`（hub-edge.ts:558-567：chunk `[22,57)`/`[21]`、标准 `[21,56)`/`[20]`、读数≠解码值→MALFORMED 响亮）；ERROR 特例（无 nsId/无台账→静默 :526-531）；R-none 逐符号复现 HEAD withChannel（:570-586 vs HEAD :896-922）；drain 门先于路由且成员集与 HEAD 逐 kind 一致 | ✅ | — |
| D5.1 到达点投递（①台账→②无条件投递） | hub-edge.ts:323-328；session `openNamespace` = HEAD :880-894 原样（hub-session.ts:84-94） | ✅ 由构造成立（`startOpen` 同步前缀亲证） | — |
| D5.2 edge 结算（台账先写 / 恰一次 authorize / 三态映射 / 同步+异步 throw 吸收 / 迟归无条件传播） | hub-edge.ts:338-360（`admissions.set` 先于 authorize 调用；`.then` 双回调 + sync catch） | ✅（undefined-resolving 授权器角落见 §12-O1） | — |
| D5.3 shim 拉取（两态映射 / 台账缺失 reject 响亮） | hub-session.ts:105-111（authorized→投影、denied→`{ok:false}`、throw→reject）；hub-edge.ts:363-369（缺失 reject） | ✅ C0b 四形态臂绿 | — |
| D5.4 drain 两量判定（`∀ keys ⊆ settledNames`，settled 信号单触发） | hub-edge.ts:689-710；与 HEAD `maybeFinishDrainEarly`（:640-647）同构论证复核成立（settledNames ⊆ 台账 keys；opening ⟺ 未 settled） | ✅ M2 绿 | — |
| D5.5 revoke 无条件 `sink.terminateNamespace` | hub-edge.ts:300-302；hub-session.ts:278-282（无通道 no-op resolve = HEAD :437-441 形态） | ✅ M1-revoke 臂绿 | — |
| D5.6/D5.7 窗口收口/never-settling | `cleanupAll` 不摘台账（:610 注释 + 代码）；迟归结算照常传播（`.then` 闭包独立于连接状态） | ✅ H1 锚（issue171-red:194）绿 | — |
| D6 信号映射（4 控制信号 + openAdmission 拉取） | `requestSinkClose` 单点幂等（:201-204）；`sink.close` 同步 quiesce 前缀 + 异步尾（hub-session.ts:269-275）；settled 信号（:689） | ✅ | — |
| D7 组合根 | hub-connection.ts:429-463 装配与设计 §7 D7 伪代码逐成员一致；edge 构造序（状态→outbound/sender→port→session→hello timer→订阅→早到帧重放）与 HEAD 构造序逐点对应 | ✅ | — |
| D8 行为冻结（L1 两处直赋 / onLivenessLost 不调 clearDrainHandles / drainDeadline 不迁移） | hub-edge.ts:280（`state='draining'` 直赋）、:656（`state='closed'` 直赋）；onLivenessLost :652-662 无 clearDrainHandles；全文件无 `drainDeadline` | ✅ M3a/M3b 绿 | — |
| 五路收口拓扑 | close/:255-266、onTransportClosed/:590-597、connectionFatal/:619-645、onLivenessLost/:652-662、onSequenceExhausted/:665-684 与 HEAD 逐行比对（closedFlag/setConnState/清句柄/teardown/quiesce/transport.close/事件/cleanupAll 次序逐点一致） | ✅ | — |
| cleanupAll（句柄清理→sink.close 汇入 settleTail→stopLiveness→摘监听→await→drop） | hub-edge.ts:599-617 vs HEAD :932-951：异步尾（`onConnectionClosed` promises）启动点由「stopLiveness/摘监听之后」变为 `sink.close()` 首调点（可能早于 stopLiveness）——两者均在同一同步块内、无微任务可插入、stopLiveness/摘监听零事件零帧副作用 ⟹ 不可观察（§11 动态项 V1 复核） | ✅（等价论证成立） | — |
| 已删机制零残段 | `grep -rn 'OpenEntry|PendingEvent|settlePending|sunkNames|pendingNames|dropPendingEntries|authorizeFirstOpen|replayAuthorization|projections' src/` = 零命中；`revoked` 仅 hub-split.ts:45 注释（说明其不存在） | ✅ | — |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
| --- | --- | --- | --- |
| 连接 FSM / 序列 / HELLO / liveness / GOAWAY / 连接级背压 | edge（决策 1） | hub-edge.ts 唯一实现（连接 FSM 符号在组合根/ session 零出现——hub-connection 现 import 面仅两工厂 + observer 单点） | ✅ |
| 通道全部生命周期 / Registry open / session 驱动 | session（决策 1） | hub-session.ts（容器 + 组装）+ 零 diff hub-namespace.ts（FSM 唯一） | ✅ |
| 真实 authorize（恰一次）+ 准入结算管线 | edge（决策 3） | `beginAdmission` 单点；shim 仅拉取（结构性不可达授权器——shim 只消费已结算 promise） | ✅ |
| 路由事实源 | edge 台账（D4b） | 路由（:529/:541/:547）与 drain（:706）均读 `admissions`；`channels` 仅 :207-209 只读投影 accessor | ✅ |
| 服务面（accept/revoke/requestReauth/close） | 组合根 | 与 HEAD 代码级逐行相同（modulo 注释，diff 仅类型名 `HubConnectionImpl`→`HubReplicationEdge` 与分配点换装） | ✅ |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
| --- | --- | --- | --- | --- |
| 内部模块 + 测试相对导入 | frame-io/backpressure/hub-namespace 先例 | 两工厂仅模块级导出 | 一致 | 仓库惯例（SA6 GAP1 判据） |
| 接缝注入风格 | `HubChannelHost`/`ConnectionSenderHost` | `HubSessionEdgePort`/`HubSessionSink` 同款类型缝 | 一致 | `openAdmission` 为 SA8 已裁决的决策 3 载体（注 C'） |
| 连接级 Map 台账 | 早到帧 admission / inboundAssemblySlots | admission 台账（per-ns 一次性、只增） | 一致 | 同款生命周期形态，基数 ≤ channels Map |
| 出站队列双形态（message+bytes） | HEAD 单形态 | message 薄包装复用同一 `emitOne` | 一致（设计 D3.2 明文） | peer 侧与 6 个直构测试零改动（日志绿） |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
| --- | --- | --- | --- |
| 通道在场性 | session `channels` Map | edge admission 台账 | 低：锁步在 D5.1 同一同步段成立（①先于②、②内同步建 + startOpen 同步前缀同步拉取）；C0d/M1/I13b 三重锚 |
| 授权决定 | edge 单次 authorize 结算 | admission promise 三态投影 | 低：至多结算一次；单分支折叠 = HEAD 唯一出口 |
| drain 完成判定 | 通道终态（HEAD）→ settledNames ⊆ 台账 keys（本版） | 两量单调 | 低：SM-4'' 同构论证复核成立 |
| `channels` 投影 | session Map | edge face 同引用只读 | 低：纯观测（13 既有白盒锚），路由/drain 不读 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
| --- | --- | --- | --- |
| edge 构造（sessionFactory）→ 早到帧同管线重放 | 五路收口同构（quiesce 前缀在 transport.close 前）→ cleanupAll → onConnectionDropped | 迟归 admission 无条件传播 → isOpenAborted / D-H1 回收 | ✅ 对称（H1 锚绿） |
| admission 台账（只增） | 随连接对象 GC（无独立清理面） | 台账不摘除 = 迟归续体依赖（注释 + 代码一致） | ✅（iteration 0 的 dropPendingEntries 不对称面已删） |
| registry lease/session | 零 diff 通道收口链 | denied/throw 在 registry.open 之前短路（C0b 零调用臂）；revoke-窗口-ok transient + 回收（M1-revoke 对 HEAD 基线） | ✅ |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
| --- | --- | --- | --- |
| 第二套窗口等待/回放 | openWaiters | （已删）窗口帧零缓冲 | 已消除 ✓ |
| 第二套 authorize/拒绝面复现 | host.authorize/finishOpenError | edge 单点 + 零 diff 通道原生 | 已避免 ✓ |
| 第二套 drain 判定 | maybeFinishDrainEarly 迭代通道 | edge 两量判定（单触发点保持） | 形态换轨但同构 + 单点 ✓ |
| 第二套字节 mux | OutboundQueue.emitOne | 复用同一 emitOne（盖章单点跨连接级/ns 域帧） | 已避免 ✓ |
| session 防御性未知 ns 分支（withChannel 同形） | edge R-none 合成 | hub-session.ts:175-199 保留 | 登记为防御分支（edge 唯一调用方下不可达；与设计 D2「防御性保留」一致）✓ |

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
| --- | --- | --- | --- |
| `packages/ws-replication/src/hub-split.ts`（新增 127 行） | 行 1 | D1 缝契约 | ✅ 内容逐成员 = 设计 |
| `packages/ws-replication/src/hub-edge.ts`（新增 790 行） | 行 2 | edge 半边 | ✅ |
| `packages/ws-replication/src/hub-session.ts`（新增 293 行） | 行 3 | session 半边 | ✅ |
| `packages/ws-replication/src/hub-connection.ts`（改写 vs HEAD；本迭代仅头注释 vs iteration 0） | 行 4（「相对 SA3 现状零功能改动，仅头注释」） | 组合根 | ✅ 服务面/accept 门与 HEAD 代码级相同；`createEdge` = D7 装配（iteration 0 已就位面） |
| `packages/ws-replication/src/frame-io.ts`（+57/-13） | 行 5（维持 SA3 现状） | 字节形态 + 盖章 | ✅ 本迭代零改动（iteration 0 产物，diff 与设计 D3.2 逐行对上） |
| `packages/ws-replication/src/backpressure.ts`（+54） | 行 6（维持 SA3 现状） | 字节形态成员 + 可选宿主成员 | ✅ 同上；可选成员缺失响亮 throw |
| `packages/ws-replication/test/…structure.test.ts`（777 行） | 行 7 | C0a~C0d | ✅ |
| `packages/ws-replication/test/…pending-window-matrix.test.ts`（762 行） | 行 8 | M1/M2/M3 | ✅ |
| `packages/replication-protocol/test/codec-namespace-routing-key-offset.test.ts` | 行 9（维持） | 决策 4 守卫 | ✅ 5/5 绿 |
| `artifacts/sa3-issue418-*-iter2.log`、`wiki/raw/*` | 证据（非源码） | 验证 | ✅ |

**DENY 面零 diff 核验**（本轮 `git diff --stat HEAD` 输出为空）：`hub-namespace.ts`、`index.ts`、`testing.ts`、`types.ts`、`defaults.ts`、`validate.ts`、`plugin.ts`、`peer-connection.ts`、`peer-namespace.ts`、session 机械件（update-channel/bulk-transfer/round-engine/fence-watchdog/update-transfer/liveness/observer/error-mapping/lifecycle-queue）、`packages/replication-protocol/src/**`、`docs/**`、`CONTEXT.md`、`apps/**`、根配置。既有 73 测试文件零修改；SA6 契约文件（DENY）mtime 保持 2026-09-21 22:31（SA6 会话）未被触碰。

> 注（完整性观察，非违规）：`hub-namespace.ts` 的 mtime 为 2026-09-22 00:00:28（SA3 iteration 2 会话窗口内），但内容与 HEAD **逐字节相同**（git blob 比对为空）——AC3 门禁是内容命题，判定**通过**；该写入动作无法由 stash 往返解释（无 diff 文件不入 stash），疑似编辑器/格式化触碰后复原，仅作透明记录（§12-O3）。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
| --- | --- | --- | --- | --- |
| `OutboundQueue.emit/sendControl`（message 形态，编码点移至入队） | `peer-connection.ts`（:389/:856，零改动）+ hub-edge 自有帧 + 6 个直构测试 | 原签名/返回语义不变；行为差仅 R4' 登记角落（§12-O2） | 低 | 无（登记面） |
| `ConnectionSender`（新增可选 `emitControlFrame?`/`emitDataFrame?` + 字节方法） | peer host（不提供可选成员——peer 不用字节路径）；hub edge（必持） | 缺失 → 首用响亮 throw（:169-190） | 低 | 无 |
| `HubChannelHost` 24 成员注入面 | update-channel/bulk-transfer/round-engine/fence-watchdog（经注入面） | session 组装逐名迁移（typecheck 绿 + 全量绿证明形状不变）；`authorize` 成员签名不变 | 低 | 无 |
| `HubConnection` 公共面（state/peerInstanceId/close）+ 白盒 `channels` 读 | plugin.ts / apps/yjs-server / 13 个白盒测试 | `HubReplicationEdge` 为超集；服务面代码级相同；投影窗口期即有值（I13b 回到 HEAD） | 低 | 无 |
| 服务层 `revoke`/`requestReauth`/`close` promise 语义 | 服务层调用方 | 逐行相同（§5）；revoke = 无条件 terminateNamespace（D5.5 = HEAD 形态） | 低 | 无 |
| `HubReplicationEdgeConfig.authorize` 返回值前设 | 宿主授权器 | `Promise.resolve` 包裹：plain-object 非法返回按值结算（= HEAD）；undefined/null 角落 → fulfillment 回调 TypeError → **admission 永不结算**（≠ HEAD 的 INTERNAL_ERROR） | 低（仅类型违约宿主可达，无既有测试面） | §12-O1（MINOR） |
| `port.openAdmission` reject 面 | shim（唯一调用方） | → startOpen catch → INTERNAL_ERROR 响亮（C0b-fail-loud 臂绿） | 低 | 无 |
| SA6 契约文件（DENY） | CI 全量 | 未改 + 17/17 绿（缝形态无关：零 seam 引用本轮 grep 复核） | 低 | 无 |

## 8. 错误、恢复与并发

| 面 | 核验 | Assessment |
| --- | --- | --- |
| 静默失败 | 唯一新吞咽点 = `beginAdmission` fulfillment 回调抛出（undefined-resolving 授权器）→ 未结算 + 未处理拒绝（§12-O1，类型违约宿主专属）；其余：台账缺失 reject 响亮、port 可选成员缺失响亮、routingKey 读数不一致 MALFORMED 响亮、sink 未装配 fail-loud | ✅（一观察项） |
| 部分完成诚实报告 | finishOpenError N waiter→N 帧 + 恰一事件（零 diff 通道原生，M1 deny 臂逐臂绿） | ✅ |
| 错误分类稳定 | `wsCloseCodeFor` 三分类原样；shim throw/台账缺失均 → 既有 INTERNAL_ERROR；零新码 | ✅ |
| 幂等 | closedFlag/reauthRequested/settledNotified/openInFlight 随符号迁移；`requestSinkClose` `??=` 单点（C0d sink.close 恰一次）；admission 至多结算一次；同 ns 再 OPEN 零 authorize（台账命中 + openWaiters 合流，M1 再 OPEN 臂绿） | ✅ |
| 竞态 | ①→② 同步段无外部事件可插入（startOpen 同步前缀亲证）；窗口期 revoke/收口/迟到 settlement 三竞态 = HEAD 原生（M1-revoke/H1/M2 锚）；TOCTOU 无新面（路由读自持台账，锁步） | ✅ |
| timer 纪律 | hello/reauth deadline/poll/liveness 句柄清理点随符号迁移（cleanupAll 单点清 reauthDeadlineHandle；onLivenessLost 不调 clearDrainHandles = HEAD 形态）；`drainDeadline` 死字段未迁移 | ✅ |
| 背压/有界 | 窗口帧零缓冲（到达点投递）；台账 ≤ 通道数（AGENTS「admission bounded」四窗口均既有面承载） | ✅ |
| 同步重入 | drain→facet→通道→缝→sender 同栈重入与 HEAD 同构；投递段内建通道 + startOpen 同步前缀 + shim 同步拉取无外部事件插入 | ✅ |

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
| --- | --- | --- | --- | --- |
| `…edge-session-split-structure.test.ts`（C0a/C0a-负控，2 用例） | 到达点投递（authorize 未结算 stub 已收 OPEN 且通道在场、拉取 pending、wire 仅 HELLO_ACK）→ resolve → 全帧 hex == SA6 冻结金标、raw `[8..12]`==[1,2]、authorize 恰一次入参逐值；deny 臂零 OPEN_OK | vitest（include glob 自动收集；`acceptance-tests-iter2.log`/`package-suite-iter2.log` 文件行证实） | 无——断言为**增强**（时点断言 + 拉取形态锚） | 无 |
| C0b（4 用例） | 真实 Registry/Runtime 全生命周期（OPEN_OK→BOOTSTRAP→SYNC→CLOSE_OK + settled）；占位帧 `[8..12]==0` + 返回序 port 递增；denied/throw 臂 NAMESPACE_UNAUTHORIZED/INTERNAL_ERROR + 3 事件 + `registry.open` 零调用；**reject 臂 INTERNAL_ERROR 响亮** | 同上 | 无——四形态臂全覆盖（SA8 R1 判据） | 无 |
| C0c（2 用例） | 模块运行时导出面（组合根不新增、缝模块零运行时导出）；单体产物暴露 edge 面 | 同上 | 无 | 无 |
| C0d（1 用例） | 投递序列零连接级 kind；`openNamespace` 必先于该 ns 任何 `namespaceFrame`；台账 ⟺ 通道在场（`edge.channels.get(nsA)).toBe(scripted.channels.get(nsA))` 同引用）；窗口 5 帧 authorize 未结算时**已全部到达点投递**（零缓冲）；迟归结算后 opens/frames 序列不变（**结算段零回放行为证明** = SA2 N2' 优选形态）；terminate 无通道 no-op；close 幂等（sink.close 恰一次 + transport.close 恰一次） | 同上 | 无——锁步断言升级为到达点 | 无 |
| `…pending-window-matrix.test.ts` M1（10 臂 × {ok,deny} + M1-0） | 每臂：OPEN 后通道 `'opening'` + authorize 恰一次 → 窗口帧**到达点断言**（效应在 `resolve()` 之前已在 wire/事件——镜像 I13a；iteration 1 形态下必红）→ 合计帧序/事件序逐描述子相等；UPDATE_ACK 臂连接级 fatal + close(1002)；CLOSE_NAMESPACE 臂 CLOSE_OK:3 + 2 迁移；再 OPEN 合流臂 deny → 2 waiter 2 帧 | 同上 + **HEAD 基线对照**（`m1-head-baseline-iter2.log`：stash 实现（含新增到达点断言与 revoke spy 的重定基版）后 25/25 绿 = 期望值为 HEAD 真值） | 无——M1 到达点断言为新增强化 | 无 |
| M1-revoke（1 用例） | 窗口期 revoke：到达点 NAMESPACE_UNAUTHORIZED + opening→failed + protocol-violation + settled 且此刻 `registry.open` 零调用；迟归 ok → `registry.open` 恰一次 transient + `lease-released` 恰一次（remainingLeases 终值 1）+ 零新帧零新事件 | 同上（HEAD 基线先行采集） | 无——重定基方向 = 钉 HEAD 真实资源行为（断言**增强**：从 iteration 1 的「零调用」扩为恰一次 + lease 配对）；wire/事件断言不变 | 无 |
| M2（1 用例） | pending nsA + nsB 自然收口 → 不提前 1001；nsA deny 结算 → 才提前 close(1001,'hub-reauth')（D5.4 包含式收编行为锚） | 同上 | 无 | 无 |
| M3a/M3b（2 用例） | beginReauth（ready→draining）与 pong 超时（→closed）全程零新增 `connection-state-changed`；deadline 路径恰一 draining→closed | 同上 | 无 | 无 |
| SA6 契约（17 用例，DENY 未改） | C1~C6 wire/序列/路由/API 冻结 | 全量日志 17/17 | 无（未被触碰） | 无 |
| codec 守卫（5 用例，ALLOW 维持） | 定偏移窗口/前缀字节结构守卫 | 全量日志 5/5 | 无 | 无 |
| 两锚（DENY 未改） | ac7-faults:53 到达点 ns ERROR / issue171-red:183 通道在场 + :194 lease 释放 | 包全量 12/12、5/5 | 无——「不改而绿」证实 | 无 |

**runner 触发证据**：`vitest.config.ts` include `packages/*/test/**/*.test.ts` 覆盖三新测试文件；CI 6 分片按磁盘枚举自动入片（SA6 §14 机制）；包 tsconfig include `test/**/*.ts` → 受包/根 typecheck 覆盖（三 EXIT=0）。零 skip/only/todo（grep=0）、零源码字符串断言（两文件全文亲读）、fixture 经 fake scheduler 显式泵（零真实 sleep）。

**日志证据复核**：`m1-head-baseline-iter2`（25/25，Start at 00:49:07 = stash 窗口内）、`acceptance-tests-iter2`（4 文件 56/56）、`package-suite-iter2`（75 文件 569/569，含两锚 + 契约行）、`root-test-iter2`（439/439、5299/5299、Type Errors no errors）、`typechecks-iter2`（pkg/protocol/root 三 EXIT=0）。均为真实 vitest 输出（`RUN v3.2.7 /home/wangjian/nomicore-fix-issue-418`）。

## 10. Required revisions

无 BLOCKER / 无 MAJOR / 无 MINOR 阻断项。

| Finding ID | Severity | Evidence | Problem | Required change | Acceptance | Suggested routing |
| --- | --- | --- | --- | --- | --- | --- |
| —（空） | — | — | — | — | — | — |

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
| --- | --- | --- | --- |
| V1：cleanupAll 内 session 异步尾（`onConnectionClosed` promises）启动点早于 stopLiveness/摘监听（HEAD 为其后）——静态论证不可观察（同同步块、无事件面） | SA7 动态面 / CI 真实 timer 下跑 close/GOAWAY/issue171-176 族 | 全通道 closed、句柄全清、事件序与 HEAD 基线一致 | 出现任何相对 HEAD 的 observer 事件序漂移或句柄泄漏 |
| V2：类型违约授权器（返回/结算 undefined/null）→ admission 永不结算 + 未处理拒绝（§12-O1） | 若采纳 O1 修订则以单测驱动；否则宿主集成期观察 | （现状）通道 'opening' 停放、零 wire、进程级 unhandledRejection | ——（登记风险，非验收面） |
| V3：CI 分片与真实 TCP 长跑（SA3 §7 deferred 项） | CI test 作业 6 分片 + SA7 real-transport | 新文件入片全绿；real-transport 动态无漂移 | 任一分片红 / real-transport 序列漂移 |
| V4：never-settling 授权器 × drain deadline 交叉（fake scheduler 下 M2 已锚定 deny 路径；never-settling 路径无测试面 = HEAD 同款缺位） | SA7 动态面（可选） | deadline 到点 close(1001)（台账未 settled 不阻塞 deadline——与 HEAD deadline 不检查通道一致） | deadline 被 pending admission 阻塞 |

## 12. Non-blocking observations

- **O1（MINOR，error-handling corner + 注释失准）**：`beginAdmission`（hub-edge.ts:344-356）的 fulfillment 回调直接访问 `authorization.ok`——授权器**返回或结算 undefined/null**（违反 `Promise<NamespaceAuthorization>` 契约）时回调抛 TypeError：`void`-ed 链式 promise 拒绝（未处理拒绝）且 `settle` 永不调用 → admission 永 pending → 通道 `'opening'` 无限停放、零 wire 零事件；HEAD 同输入得 `INTERNAL_ERROR` + failed（`startOpen` catch）。仅类型违约宿主可达、无既有测试面（与 SA2 N1' 同类角落）。顺带：该处注释「`Promise.resolve` 包裹使非 thenable 返回值的类型违约宿主落到同一 `throw` 结局」表述失准——包裹实际使 plain-object 非法返回**按值结算**（= HEAD 宽容语义，正确行为），而 undefined/null 落到的是「永不结算」而非 throw 结局。建议后续票：fulfillment 回调体内 try/catch 兜底 `settle({outcome:'throw'})`，并修正注释。路由：implementation（后续小改，非本票阻断）。
- **O2（登记面精度注记）**：R4'（非暂停控制帧「耗尽 ∧ 编码必败」双不可达角落）的波及面含 **peer 侧**——message 形态包装（`OutboundQueue.sendControl`）编码点移至入队后，peer-connection 的非暂停控制帧同获「先编码后耗尽检查」次序翻转（peer 文件零改动、共享队列承载）。设计 §13 R4' 行措辞为通用「非暂停控制帧」，未点名 peer；登记面事实覆盖，无行为回归（peer 全量绿），仅注记登记精度。
- **O3（完整性透明记录）**：`hub-namespace.ts` mtime（2026-09-22 00:00:28）落在 SA3 iteration 2 会话窗口内，但内容与 HEAD 逐字节相同（git blob 比对空）。AC3 门禁为内容命题，判定通过；该写入动作无法由 stash 往返解释（无 diff 文件不入 stash），疑似编辑器/格式化触碰后复原。无行为影响。
- **O4（可读性微瑕）**：`hub-session.ts:50` 构造器首行与解构语句同行（`constructor(private readonly config: HubSessionHostConfig) {    const { limits, … } = config;`）——合法但与仓库排版惯例不符；后续票顺手整理即可。

---

## 附：artifactPaths（worktree-relative）

- `wiki/raw/task_issue-418_sa4_review.md`（本报告）
- `packages/ws-replication/src/hub-split.ts`、`hub-edge.ts`、`hub-session.ts`、`hub-connection.ts`、`frame-io.ts`、`backpressure.ts`
- `packages/ws-replication/test/ws-replication-issue418-edge-session-split-structure.test.ts`、`ws-replication-issue418-pending-window-matrix.test.ts`
- `artifacts/sa3-issue418-m1-head-baseline-iter2.log`、`artifacts/sa3-issue418-acceptance-tests-iter2.log`、`artifacts/sa3-issue418-package-suite-iter2.log`、`artifacts/sa3-issue418-typechecks-iter2.log`、`artifacts/sa3-issue418-root-test-iter2.log`
