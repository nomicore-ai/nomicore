# SA6 诊断与验收契约 — issue #423（spec #415 T6）：observer 发射点拆分与降级口径

- HEAD：`1f5809b001c984e63fac3bafd4c1f3febc76e8a8`（`mabf/issue-423`；`#421` 合并后、`#423` 未开工）
- 任务类型：**Feature（能力缺口 + 验收契约）**，内含一处既有实现与 ADR/简报不一致的**字段缺口**（Bug 面），
  以同一份红灯契约承载（skill：Feature 必须证明能力缺失，不得虚构 Bug 根因；本票两者共存，逐条标注）。
- 固定产物：本报告 + `packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts`
  （SA6 新增验收契约；生产实现零改动）+ `artifacts/sa6-issue423-contract-evidence.log`（证据日志）。
- 契约执行：`NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts`
  ⇒ **18 passed / 3 failed**（3 条红灯 = 目标断言处失败），包级门禁 **704 passed / 3 failed / 84+1 files，Type Errors: no errors**。

---

## 1. Task type and inputs

| 输入 | 路径 / 来源 | 说明 |
|---|---|---|
| 任务简报 | `wiki/raw/task_issue-423.md`（Host 提供，untracked） | issue #423 正文：What to build + 6 条 AC |
| issue 原文 | GitHub issue #423（`gh issue view 423`） | 与简报一致；**comments = 0**（REST 读回 `[]` 复核一致） |
| 规范父票 | issue #415（spec/415，`gh issue view 415`） | Solution / D1–D14 / Testing Decisions；本票 = spec 交付清单第 ⑥ 项「observer 发射点拆分文档化」扩展 |
| 兄弟票 | #414（需求）、#416（设计工件）、#418（T2 拆分，已合并）、#419（T1，已合并）、#421（T4 edge 工厂，已合并、本票 Blocker）、#420（T3）/ #422（T5）/ #424（T7）（**仍 OPEN**） | T3/T5 未实现直接影响 AC2/AC5 的「分片形态」运行时锚 |
| 规范文档 | `docs/adr/0032-transport-decoupling-edge-session-split.md`（决策 5） | 「发射点 = 拥有事实的一侧（连接域与出站 sequence 事件在 edge，namespace 域事件在 session），事件字段集 append-only 不变」；缺面 dormant；`maxConcurrentAssembliesPerConnection` 分片形态 per-session 计数 |
| 协议契约 | `docs/protocols/instance-replication-v1.md` §23.1/§23.2/§23.3/§23.4 | 36 型事件词表与字段集、稳定码闭联合、safe-field、隔离语义 |
| 既有 SA6 契约 | `wiki/raw/task_issue-418_sa6_contract.md`（§S5）、`wiki/raw/task_issue-421_sa6_contract.md`（§12.6/§56） | #418 明示「本票不新增 observer 面」⇒ 发射点拆分的落点在本票；#421 已给 edge 复现拒绝路径的观测面（本次诊断证实其缺 `connectionId`） |
| 缺失输入 | `task_issue-423_relevant_decisions.md` / `_conflict_report.md` / `_design.md` / SA8 门 | **不存在**（iteration 0；`ls wiki/raw` 核对）。不影响复现与契约建立（本报告 §3 用 ADR/协议/既有契约替代 SA8 约束面） |

## 2. Owner comment mapping

**无 owner 要求**：issue #423 comments = 0（Host 简报明文「No owner requirements apply: REST comment read returned []」），
本次以 `gh issue view 423 --json comments` 复核仍为 0。契约全部条目均源自简报 AC + ADR 0032 + 协议 §23，无外部 owner 追加面。

## 3. SA8 constraints

#423 无 SA8 工件（iteration 0）。可用的规范约束面：

| 来源 | 约束 |
|---|---|
| ADR 0032 决策 5 | 发射点 = 拥有事实的一侧：连接域 + **出站 sequence 事件在 edge**、namespace 域事件在 session；字段集 append-only；缺面 dormant；`maxConcurrentAssembliesPerConnection` 分片形态降级 per-session、listen 模式不变 |
| ADR 0032 决策 2/3 | 缝只过 `Uint8Array` 帧 + 纯 JSON；未授权 OPEN 不过缝，**edge 复现 `NAMESPACE_UNAUTHORIZED` wire 行为并持拒绝闩锁** |
| 协议 §23.3 | `connectionId` 是 §6.2 受控 observability id：「握手完成前字段不存在」——反向即握手完成后在场；事件树禁二进制/Error/原始异常文本 |
| 协议 §23.4 | 回调同步投递、throw 隔离（绝不改变协议状态/关闭分类/写入结果）、缺 clock = latency 整键缺失 |
| 协议 §23.1 | 36 型字段集是 append-only 冻结面（本契约 `SECTION_23_FIELDS` 表逐字取自该节，仅限本契约触及的型） |
| #421 SA6 §12.6 / #418 SA6 §S5 | edge 公共出面已复刻 deny/throw 观测面；#418 明示 observer 发射点拆分留待后续票（= 本票） |

## 4. Environment and baseline

- 环境：Node `v24.13.0`、pnpm `10.28.2`、vitest `3.2.7`、typescript `5.9.3`；`pnpm install --offline`（store 命中，零网络）。
- 基线（HEAD，本契约文件加入前）：包套件 **84 files / 686 tests 全绿**；`tsc -p packages/ws-replication/tsconfig.json` exit 0。
- 契约加入后：**85 files / 707 tests：704 passed、3 failed（本契约 3 条红灯）**，`Type Errors: no errors`（日志 §S5）。
- 时序/规模条件：全部夹具为 fake timer / 内存管道 / 手动单调时钟；零 real sleep、零真实网络、零 worker。
  session 侧夹具为**真实 Registry/Runtime**（`makeNode` + `makeHubNamespace` + `createHubSessionHost`），
  edge/工厂侧为内存双端 transport + 真实 production 工厂（`createHubReplicationEdge`）/ 内部 `createHubReplicationEdge`（`hub-edge.ts`）。
- 复现率：契约文件 **连续 5 次运行结果完全一致**（3 red / 18 green，见日志 §S0 稳定性轮）；红灯集合与断言文本逐轮相同。

## 5. Positive reproduction

### 5.1 缺口 A（字段面，Bug 型）：edge 复现拒绝路径的两事件缺 `connectionId`

最小输入（EM-C2a，工厂形态）：

1. `createHubReplicationEdge({ instanceId:'hub-omega', authorize:()=>{ok:false}, resolveSessionSink, observer })`；
2. `acceptTrusted(hubEnd, { peerInstanceId:'peer-alpha' })` → 注入 HELLO（seq 1）→ 注入 `OPEN_NAMESPACE`（seq 2）；
3. 观测：`namespace-error{code:'NAMESPACE_UNAUTHORIZED', direction:'sent'}` + `namespace-failed{cause:'open-failed'}`。

实际（HEAD）：两事件键集 = `{type,side,namespaceId,code,direction}` / `{type,side,namespaceId,cause}` —— **无 `connectionId`**（实测 A1）。
期望：`connectionId === 句柄 connectionKey === 'hub-omega-conn-0'`（同一次运行里同一对象已将该值发射在 `connection-state-changed` 上）。
对照（同一协议路径的单体 listen 形态，实测 A2）：`namespace-error{...,connectionId:'hub-omega-conn-0',...}`、
`namespace-failed{...,connectionId:'hub-omega-conn-0',...}` —— **两形态字段集不一致**，直接违反 §23.3 在场纪律与 ADR 决策 5「字段集 append-only 不变」。

### 5.2 缺口 B（能力面，Feature 型）：出站 sequence 事件（`update-sent`）发射侧错位且 edge 面缺席

最小输入（EM-C4a，工厂形态）：

1. 同上握手 + 授权通过的 OPEN（`authorize → ok`、`resolveSessionSink` 返回宿主 sink）→ 会话建立；
2. 宿主 sink 经 `connection.egress.sendDataFrame(encodeMessage({kind:'UPDATE', namespaceId:NS_A, update:23B}, {sequence:0}))` 出站一帧；
3. 观测：返回值 `stamped=3 > 0`，wire 帧 `[8..12]==3`（盖章确实发生），但 **edge observer 零 `update-sent`**（实测 A1：`after-host-update` 与 `denied` 事件集完全相同）。

对照（EM-C4b，独立 session 半边 + stub seam port，真实 Registry）：一条 live UPDATE 经 `port.sendDataFrame` 出站后，
**session 侧观测面收到 `update-sent{connectionId,namespaceId,bytes,sequence}`** —— 即该事件今天的发射侧是 session，
而简报 What to build 明文把「依赖盖章后 sequence 的出站事件（update-sent 族）」列为 **edge** 发射项，ADR 0032 决策 5 同文
（「出站 sequence 事件在 edge」）。缺口 = 典型「事实所有者 ≠ 发射者」：sequence 由 edge 在 mux 点盖章（`frame-io.ts` `[8..12]` 单点），
事件却由拿到返回值的 session 发射；分片形态下 edge 侧对该事实**零观测面**（宿主 sink 自己拿不到 observer）。

## 6. Negative control

| 负控 | 断言 | 结果 |
|---|---|---|
| EM-C2c | pre-connection `auth-upgrade-rejected` **无** `connectionId`（§23.3 只允许握手完成前缺席）→ 证明 EM-C2a 不是「无条件加字段」，而是「在场纪律」 | 绿 |
| EM-C1d | edge 半边**零** namespace 域成功族越界发射（channel-state-changed / bootstrap-* / sync-* / update-applied / update-acked / resync-required 型零出现） | 绿 |
| EM-C1e | 独立 session 半边**零**连接域事件（8 型连接域集合逐一断言不在场） | 绿 |
| EM-C3a vs C3b | 缺 `bufferedAmount` → 键缺失；可观测（0 / 12）→ 键在场且 = 真实读数（0 不折叠为缺面） | 绿（互为正负控） |
| EM-C4a 内嵌 | control 帧（`sendControlFrame`）不得产出 `update-sent`（非「任何帧都发」） | 绿 |
| EM-C4c | listen 组合形态恰一 `update-sent`（无重复）+ `sequence == wire [8..12]` | 绿 |
| EM-C6b | 缺省 4 → 第 5 个 distinct ns 超额（非 per-namespace 无限、非常量旁路） | 绿 |
| EM-C3d / EM-C4b | 「场景确实触达」非空断言（data 帧数 / 事件数）防止负控恒真 | 绿 |

## 7. Stability, scale and timing

- 契约 21 用例**连续 5 轮**结果同一（日志 §S0）：3 failed / 18 passed，失败集合 `{EM-C2a, EM-C4a, EM-C4b}` 稳定，无 flake。
- 全部断言在**同一微任务排空预算**内确定（fake timer 从不 fire；`settleUntil` 只作有界排空，不做时间推进）；
  唯一的时间语义 = 手动 `ReplicationClock`（`ManualClock`）。
- 事件序列金标（EM-C7a/b）跨进程复跑相等（见 §9 实验 E3）：数值测量字段（bytes/latency/hash）有意排除在结构投影外，
  其余「型 + 精确键集 + 稳定字面量字段」逐字比较 ⇒ 排除 Yjs 随机 clientID 造成的跨进程伪红（与 #418 SA6 §15 边界同口径）。
- 规模：单连接、单 namespace（金标场景）+ 单连接 5 distinct ns（计数口径锚）；无性能/规模曲线类断言需求（本票无性能 AC）。

## 8. Root-cause chain or capability gap

### 8.1 缺口 A 根因链（Bug 面）

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| 症状 | 工厂（分片）形态拒绝路径的两事件字段集与单体形态不一致（缺 `connectionId`） | 实测 A1 vs A2；EM-C2a 红 | 确定（实测） |
| 直接故障点 | `packages/ws-replication/src/hub-edge-host.ts` 的 `HostSessionAdapter.emitNamespaceErrorSent` / `emitNamespaceFailed` 构造事件对象时**无 `connectionId` 成员**（同文件 `synthesizeStateViolation` 亦同形；`finishTerminal` 是唯一调用点） | 事件键集实测（`{type,side,namespaceId,code,direction}`）；#421 设计 §8.6 声称「逐事件复刻 `hub-namespace.ts:483–503,1696–1706,1820`」，而该三处均经 `cidField(this.host.connectionId())` 携带在场值 | 确定（实测 + 源码符号） |
| 触发条件 | 授权拒绝（`{ok:false}` / ok 但无 `read`）或 authorize throw / `openAdmission` reject，且**握手已完成**（`connectionId` 有值） | EM-C2a/EM-C2b 场景；`finishTerminal` 分支 | 确定（实测） |
| 最深根因 | edge 公共出面的观测复刻面只对齐了「事件型/必填字段」，未对齐 §23.3 的**在场纪律**：edge 端口已有 `connectionId()`（`hub-split.ts:91-92`），但复刻点未消费它 | 端口成员在场 + 事件缺字段（实测） | 确定（实测） |
| 放大因素 | 分片形态下 `namespace-error`/`namespace-failed` 是拒绝路径**唯一**观测信号（未授权 OPEN 不过缝、无 session、无 `channel-state-changed`），缺 `connectionId` 使多连接部署无法关联到连接键 | ADR 决策 3「未授权 OPEN 不过缝」；实测 A1 事件集无 `channel-state-changed` | 高（规范推理 + 实测事件集） |
| 未证实假设 | —— | 无 | — |
| 排除项 | 观察者隔离、fixture、时序（见 §11） | mutation M1 反向证明：仅补 `connectionId` 即 EM-C2a 转绿，其余 19 绿保持 | 确定（实测） |

**修正归属**：缺口 A 属「#421 已交付面的字段缺口」，本票 AC3 明文点名（「connectionId 在场纪律不变」），故由本票收口。

### 8.2 缺口 B 能力缺口链（Feature 面）

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| 现状 | `update-sent` 由 session 半边发射（`hub-namespace.ts` `onUpdateSent` ← `update-channel.ts` `noteUpdateSent`，用 `host.sendData` 的返回值 = edge 盖章序） | 源码符号 + 实测 B1（独立 session 半边收到 `update-sent`）+ 实测 C1（单体观测面 `sequence=7 == wire [8..12]`） | 确定（实测） |
| 目标（简报 + ADR） | 「edge 发 … 依赖盖章后 sequence 的出站事件（update-sent 族）」；ADR「出站 sequence 事件在 edge」 | 简报 What to build；ADR 0032 决策 5 | 确定（文本） |
| 能力缺口 | 工厂/分片形态下 edge 侧**零**出站 sequence 观测面（宿主 sink 无 observer；edge 只在 stamp 点写 `[8..12]`）；listen 形态在边缘（in-process 返回序）下「恰好可用」，不构成 edge 拥有事实的观测证据 | 实测 A1（host 数据帧 → edge 零事件）；EM-C4a 红 | 确定（实测） |
| 设计约束（留给 SA2/SA8） | 「事件在 edge 发射」与「`sendQueueMs` 是 session 侧记账事实（§23.1/§23.4）」之间存在缝的承载问题：`sendQueueMs` 在 **send 之后**才算得出（`sentAt − oldestQueuedAt`），故 edge 需经 append-only 的 send-accounting 投影（纯 JSON）才能在不丢字段的前提下发射 | EM-C4c/EM-C7a 在 M3+M4（朴素搬运）下变红 —— 见 §9 实验 E2 | 确定（实测） |
| 缺省降级 | 宿主直驱 data 帧（分片形态宿主 sink）无 session 记账 ⇒ `sendQueueMs` 按「缺面 = 整键缺席」缺席（与 AC2 同纪律），`bytes`/`sequence` 由帧与盖章点可判 | EM-C4a 期望形状（`bytes` = UPDATE 载荷长度、`sequence` = 盖章序） | 高（设计推理） |
| 未证实假设 | 无 | — | — |

## 9. Causal experiments

| id | 实验 | 输入/变量 | 观察 | 结论 |
|---|---|---|---|---|
| E1 | 工厂形态拒绝臂（A1）vs 单体形态拒绝臂（A2） | 同授权表（deny）、同 HELLO/OPEN 序 | A1 两事件无 `connectionId`；A2 两事件有 `connectionId='hub-omega-conn-0'` | 直接故障点定位到 edge 复刻点，且非环境/fixture 差异（同一 HEAD、同一 observer 注入面） |
| E2 | 目标形状 mutation（M3+M4：edge 在 mux 点发 `update-sent` + session 抑制） | 手工最小补丁（**已回退**） | EM-C4a/C4b **转绿**；EM-C4c 红（`sendQueueMs` 丢失）、EM-C7a 红（金标键集变化） | ① 两条红灯在目标形状下可达绿（非「不可满足的契约」）；② 「搬发射点但丢字段」被 append-only 金标拦住 ⇒ 契约强制完整解 |
| E3 | 拆分前金标采集与复跑 | 拆分提交 `1278fd3` 的父提交 `e9cd7eb` 独立 worktree（`.worktrees/issue423-presplit`，跑完已删）+ 同一 dumper 脚本 | 两场景结构序列在 `e9cd7eb` 与 HEAD **逐字相等**（10 项 live + 4 项 denied） | AC6 基线为绿（拆分未漂移）；金标即冻结于 EM-C7 常量，供 T6 实现后继续守住 |
| E4 | 缺面 dormant mutation（M6：`sendFailureContext` 把缺面折叠为 0） | 手工最小补丁（**已回退**） | EM-C3a 红（`'bufferedAmount' in ev` 变 true）；EM-C3b 仍绿 | 「缺面 ⇒ 整键缺席」断言敏感（非恒真） |
| E5 | 计数口径 mutation（M5：`maxConcurrentAssembliesPerConnection` 被常量 4 旁路） | 手工最小补丁（**已回退**） | EM-C6a 红（limit=2 时第 3 个 ns 未被拒）；EM-C6b 仍绿 | listen 口径锚定在 `limits` 键上（非常量、非 per-namespace） |
| E6 | 隔离 mutation（M2：`dispatchReplicationObserver` 去 try/catch） | 手工最小补丁（**已回退**） | EM-C5a/EM-C5b 双红（throw 外溢：会话未建立、wire 面被破坏） | 两侧隔离断言敏感，且单点语义是唯一屏障 |
| E7 | 工厂形态字段补丁（M1：两事件补 `connectionId`） | 手工最小补丁（**已回退**） | 仅 EM-C2a 转绿，其余 19 绿保持 | 缺口 A 的红灯精确指向缺失字段（非连带失败） |

全部 mutation 均在 `git checkout --` 后核对 `git diff` 为空（日志 §S1 尾部「post-mutation source tree status」）。

## 10. Impact surface

| 面 | 影响 |
|---|---|
| `packages/ws-replication/src/hub-edge-host.ts` | 缺口 A 修复点（拒绝/合成路径两事件的 `connectionId` 在场） |
| `packages/ws-replication/src/hub-edge.ts` | 缺口 B 的实现面（mux/盖章点出站 sequence 事件；`bytes`/`namespaceId` 判定） |
| `packages/ws-replication/src/hub-session.ts` + `hub-split.ts` | 缺口 B 若需承载 `sendQueueMs` 等记账投影 ⇒ append-only 缝成员（**设计裁决**，本契约不预设机制） |
| `packages/ws-replication/src/hub-namespace.ts` | 缺口 B 的抑制面（出站 sequence 事件改由 edge 发射后不得双发） |
| `docs/protocols/instance-replication-v1.md`（§23.1/§23.4 或 §22） | AC5 文档面：`maxConcurrentAssembliesPerConnection` 分片形态 per-session 口径（聚合上界 = limits × worker 数）；建议同时登记「发射侧归属表」与宿主直驱 data 帧的 `sendQueueMs` 缺面口径 |
| `docs/adr/0032-...md`（决策 5 注记） | 同上（ADR 决策 5 已含口径，需落到「已实现/落点」章节） |
| 公开面 | 零新事件型、零新字段、零新错误码、零 wire 变更；`src/index.ts` 零变化（本契约不新增公共 API） |
| 兄弟票 | T3(#420)/T5(#422) 未实现 ⇒ 分片形态的 per-session 计数与 session 侧 shim 运行时锚留待其落地（见 §15）；T7(#424) 可复用本契约的工厂形态夹具 |

## 11. Ruled-out hypotheses

| 假设 | 排除依据 |
|---|---|
| H1「缺口 A 是观察者/夹具问题（事件根本没到 observer）」 | 同一次运行里 `connection-state-changed` 已带 `connectionId` 到达同一 observer；EM-C2b/C2c 全绿 |
| H2「工厂形态无 observer 注入面」 | `HubReplicationEdgeOptions.observer`（#421 EF-C2 test-d 冻结面）在场；A1 实测收到事件 |
| H3「`update-sent` 本就该由 session 发射（ADR 措辞可另读）」 | 简报 What to build 明文列为 edge 发射项，并以「update-acked 关联**入站** sequence ⇒ 留在 session」作对照；ADR 决策 5 同文。**作用域读法**（见 §15 U1）已登记：本契约只要求 family 中唯一携带盖章 sequence 的 `update-sent` |
| H4「缺口 B 的红是环境/契约不可满足」 | E2（M3+M4）证明目标形状下 EM-C4a/C4b 可绿；`bytes`（UPDATE 载荷长度）与 `sequence`（盖章序）在帧字节上可判 |
| H5「AC6 金标会因拆分本身已红」 | E3：`e9cd7eb` vs HEAD 结构序列逐字相等 ⇒ 基线绿，非伪红 |
| H6「缺面 dormant 断言恒真」 | E4：把缺面折叠成 0 即红；EM-C3b 的正控（0/12）证明键在场与取值口径 |
| H7「listen 计数口径锚定的是常量而非 `limits` 键」 | E5：旁路 `limits` 即红 |
| H8「observer throw 隔离只在一侧成立」 | EM-C5a（edge 公共出面，wire 逐帧对比）+ EM-C5b（单体组合，业务收敛）双绿；E6 去隔离双红 |
| H9「AC1 需要逐型覆盖全部 36 型事件才能成立」 | 本契约锚定**侧归属不变量**（连接域 8 型集合 ∩ session 观测 = ∅；namespace 域型集 ∩ edge 观测 ⊆ 拒绝/合成复刻面）+ 可达型逐一断言；稀有故障族型（backoff/goaway/schema-rearm/identity-conflicted/chunked-aborted/各 timeout 族）由既有逐型套件承载（`issue231/238/244/256/287/295/301/170/174` 等，本次全量套件绿）——登记为覆盖边界（§15 U3） |

## 12. Acceptance contract and test paths

契约文件：`packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts`（21 用例）
固定报告：`wiki/raw/task_issue-423_sa6_contract.md`（本文件）
证据日志：`artifacts/sa6-issue423-contract-evidence.log`

### 12.1 AC × 契约 × 红绿

| AC（简报） | 契约条目 | 断言（可观察） | 旧实现（HEAD） | 目标实现 |
|---|---|---|---|---|
| AC1 每型事件发射侧有测试锚定 | EM-C1a..e | 连接域事件在 edge（宿主 sink 零参与）；拒绝/合成路径在 edge；双方零越界；`update-sent` 侧归属（EM-C4） | 部分绿；`update-sent` 侧错位 | 全绿 |
| AC1 字段集与 §23 逐字一致 | `SECTION_23_FIELDS` + `assertSection23Shape`（贯穿全部用例） | 键集 ⊆ §23 注册集、必填键在场、零二进制/零 Error/零异常原文 | 除缺口 A 外绿 | 全绿 |
| AC2 缺面降级（bufferedAmount/onPong） | EM-C3a..d | 缺 `bufferedAmount` ⇒ 键缺席（非 0/非 undefined）；可观测 ⇒ 真实读数（0/12）；缺 clock ⇒ `sendQueueMs` 缺席；无 ping/onPong ⇒ 零 liveness 事件 | **绿**（既有「缺面 = 整键缺席」语义已平移） | 保持绿 |
| AC3 授权拒绝路径由 edge 发射且字段正确 | EM-C1b + **EM-C2a/b/c** | 恰一 `namespace-error{sent}` + 恰一 `namespace-failed{open-failed}`（edge 复现）；`connectionId == connectionKey`（握手后在场）；键集 ⊆ §23 + 零异常原文 | **红（EM-C2a）**：缺 `connectionId` | 绿 |
| AC4 throw 隔离两侧成立 | EM-C5a/b | 全抛 observer：wire 逐帧相等、连接存活、业务收敛不变、零 unhandledRejection | **绿** | 保持绿 |
| AC5 分片口径写入文档 + listen 回归锚 | EM-C6a/b（运行时锚）+ §12.5（文档面） | listen 缝 per-connection 跨 ns 共享槽位（limit 键驱动、释放可再纳、缺省 4→第 5 个拒纳） | **绿** | 保持绿 |
| AC6 单体事件序列与拆分前逐字一致 | EM-C7a/b（拆分前金标） | 型 + 精确键集 + 稳定字面量字段逐字相等；无重复/无缺失/无乱序 | **绿**（E3 证明基线绿） | 保持绿 |
| AC1 出站 sequence 事件（What to build 明文） | **EM-C4a/b** + EM-C4c | edge 在盖章点恰一 `update-sent{sequence==[8..12], bytes==UPDATE载荷}`；session 侧零发射；listen 形态恰一、无重复、`sendQueueMs` 保留 | **红（EM-C4a/C4b）**：edge 缺席 + session 发射；`sendQueueMs` 面在部分实现下由 C4c/C7a 拦 | 绿（机制留给设计） |

### 12.2 §23 字段注册表（契约内 `SECTION_23_FIELDS`，取自 §23.1，本契约触及的 17 型）

`connection-state-changed` / `connection-failed` / `auth-upgrade-rejected` / `send-paused` / `send-resumed` /
`event-loop-delay-sampled` / `channel-state-changed` / `bootstrap-snapshot-sent` / `sync-step2-sent` /
`sync-diff-applied` / `update-sent` / `update-applied` / `update-acked` / `resync-required` / `update-dropped` /
`namespace-error` / `namespace-failed`（逐型的 `required`/`optional` 拆分与协议表格一致；`type`/`side` 为信封成员）。

### 12.3 红/绿判据（不可软化）

- 红灯 = 断言在**目标行为**处失败，且失败文本指向缺失事实本身（`EM-C2a: namespace-error{sent} 缺 connectionId`、
  `EM-C4a: edge 盖章点必须发射恰一 update-sent: expected [] to have a length of 1`、`EM-C4b: … session 侧零发射`）。
- 绿灯 = 行为锚（非源码 grep）；负控与正控成对；非空断言防恒真；无 skip/only/todo/env override/吞错。
- 契约不得以「补一个 `connectionId: undefined` 键」或「双发 `update-sent`」通过：EM-C2a 用 `toBe(connectionKey)` 取值断言、
  EM-C4c/C7a 用「恰一 + 键集/金标」拦双发与丢字段。

### 12.4 目标实现期望（供设计/实现消费）

1. **缺口 A**：`hub-edge-host.ts` 两处复刻事件与 `synthesizeStateViolation` 统一经「在场即携带」的 `connectionId` 投影
   （值 = 端口 `connectionId()`；握手前为 `undefined` ⇒ 键缺席）。
2. **缺口 B**：`update-sent` 的发射点迁到 edge 盖章/记账点（连接级 mux 或等价的 edge 侧单点），**且**：
   ① 恰一（session 侧不再发射）；② `sequence` = `[8..12]`；③ `bytes` = 出站 UPDATE 载荷长度；④ `namespaceId` = 帧路由键；
   ⑤ listen 形态 `sendQueueMs` 保留（append-only）——承载机制（缝上 append-only JSON 记账投影，或等价的 edge 侧可判事实）
   由设计裁决；⑥ 宿主直驱帧无记账 ⇒ `sendQueueMs` 整键缺席。
3. **文档面（AC5）**：协议 §23/§22 与 ADR 决策 5 注记「分片形态 `maxConcurrentAssembliesPerConnection` = per-session 计数
   （聚合上界 = limits × worker 数）；listen 模式 per-connection 不变」，并建议登记 §8.2 的发射侧归属表（含「拒绝路径无
   `channel-state-changed`（无 session）」的形态差异说明）。

## 13. Red/green or baseline evidence

| # | 命令 | 结果 |
|---|---|---|
| S0 | 契约文件 ×5 连续 | 每轮 `3 failed / 18 passed`，失败集合稳定 = `{EM-C2a, EM-C4a, EM-C4b}`（日志 §S0） |
| S1 | M1..M6 mutation（逐一回退） | M1 ⇒ 仅 EM-C2a 转绿（2 failed）；M2 ⇒ EM-C5a/b 双红（5 failed）；M3+M4 ⇒ EM-C4a/b 转绿、EM-C4c/C7a 红（3 failed）；M5+M6 ⇒ EM-C3a、EM-C6a 红（5 failed）；回退后 `git diff` 为空 |
| S2 | AC6 金标采集（`e9cd7eb` worktree）与 HEAD 复跑 | 两场景结构序列逐字相等（10 + 4 项）；EM-C7a/b 绿 |
| S3 | `vitest list`（root include） | 21 条本契约用例被 runner 发现（§14） |
| S4 | 既有 AC5 回归锚（`issue244-ac-red` R4 + `issue244-sa7-dynamic` D-SLOT1） | 2 files / 25 tests 全绿 |
| S5 | 包级门禁 `vitest run packages/ws-replication`（含 typecheck） | `85 files / 707 tests`：**704 passed、3 failed（= 本契约红灯）**；`Type Errors: no errors` |
| S6 | `tsc -p packages/ws-replication/tsconfig.json`；根 `pnpm typecheck`（全 14 包 + `apps/yjs-server`） | 两者 exit 0（日志 §S6） |

红灯非环境原因的三重排除：① 失败断言文本指向缺失事实本身；② 同一文件内 18 条相邻断言（含同夹具、同 observer 注入面）全绿；
③ M1/E2 的目标形状 mutation 使对应红灯转绿（可满足性）。

## 14. Runner trigger evidence

- 根 `vitest.config.ts`：`include: ['packages/*/test/**/*.test.ts', …]` ⇒ 本契约路径天然被包级与根级 runner 发现。
- `NODE_OPTIONS=--conditions=nomicore-source npx vitest list packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts`
  ⇒ 列出 21 条用例（日志 §S3）。
- 包级全量运行包含该文件（`1 failed | 84 passed (85)` 中的 1 = 本契约文件），根 `pnpm test` 使用同一 include 与 `--typecheck`。

## 15. Unknowns and blockers

| id | 项 | 处置 |
|---|---|---|
| U1 | 「update-sent 族」作用域：本契约按简报限定语（「依赖盖章后 sequence 的」）只要求 `update-sent`（family 中唯一携 `sequence` 键者）；`chunked-update-sent` / `bootstrap-snapshot-sent` / `sync-step2-sent`（无 sequence 键，事实在 session 侧记账）未纳入强制面 | 登记待 SA2/SA8 裁决；若裁决为全域搬迁，EM-C4b 可 append 扩展（当前实现已把 session 侧 `chunked-update-sent` 排除在断言外，避免过度约束） |
| U2 | 缺 B 的机制：`sendQueueMs` 是 send **之后**的 session 侧差值 ⇒ 缝需 append-only 的 send-accounting 投影（纯 JSON）或等价 edge 可判事实；本契约只钉可观察结果（恰一 + 序列/长度/键集），不预设机制 | 设计裁决；E2 已证明朴素搬运被 append-only 金标拦下 |
| U3 | AC1「每型」的覆盖边界：36 型中约 20 型在本契约场景可达；稀有故障族（`connection-backoff-scheduled`/`goaway-received`/`schema-rearm-*`/`identity-conflicted`/`chunked-*`/timer 族 `namespace-failed` cause）由既有逐型套件承载（本次包级全绿） | 登记为覆盖边界；若 SA8 要求逐型锚定，按本契约 `SECTION_23_FIELDS` 扩展 |
| U4 | AC2/AC5 的「分片形态」运行时锚依赖 **T3(#420)/T5(#422)**（SessionHost 公共工厂 + `listen:false` 插件）未落地：session 侧 transport shim 的正式出面与 per-session 计数在该形态才可端到端测 | 本契约以内部缝（`createHubSessionHost` + seam port / 内部 edge 端口）建立等价面；文档面（AC5 后半）登记为设计/实现交付，待 T3/T5 落地补运行时锚 |
| U5 | 形态差异登记：未授权 OPEN 在工厂/分片形态无 `channel-state-changed`（无 session，事件不产生）——与单体形态事件集不同，属 ADR 决策 3 的自然结果 | 建议在发射侧归属表文档中显式登记（§12.4-3）；本契约不断言其存在 |
| U6 | 根 `pnpm typecheck` / 根 `pnpm test` 全仓门禁由 Host 按流程执行；本报告只保证包级（§13 S5/S6） | 无阻塞 |

无阻塞（blocker）项：诊断可稳定复现、根因/缺口已证实、契约可执行且入口真实 ⇒ verdict = approve。

## 16. Temporary diagnostics cleanup

| 临时物 | 内容 | 清理证据 |
|---|---|---|
| `packages/ws-replication/test/tmp-sa6-423-probe.test.ts` | 3 组探针（工厂形态事件键集/单体验证拒绝臂/session 半边生命周期与计数口径） | 已 `rm`；`git status` 不含该路径 |
| `packages/ws-replication/test/tmp-presplit-events.test.ts` | 拆分前金标 dumper（HEAD 复跑用） | 已 `rm` |
| `.worktrees/issue423-presplit` | `e9cd7eb` 独立 worktree（金标采集 + 临时 dumper 脚本） | `git worktree remove --force` 完成；`git worktree list` 不含该路径；空目录 `.worktrees/` 已 `rmdir` |
| 生产源码 mutation（M1–M6：`hub-edge-host.ts` / `hub-edge.ts` / `hub-namespace.ts` / `observer.ts`） | 只用于敏感性与可满足性证据，逐次即时回退 | `git diff --name-only` 为空；日志 §S1 尾部记录回退后状态 |
| 服务/长驻进程 | 无（无真实网络/服务；全部 fake timer + 内存管道；vitest 进程自退） | 无残留 job |

---

### 附：本报告结论一句话

**该拆的已拆一半**：连接域/namespace 域的发射侧归属、隔离语义、缺面 dormant、listen 计数与拆分前金标均已成立（本契约 18 条绿锚），
但 **edge 复现的授权拒绝事件缺 `connectionId`**（字段面缺口）与 **出站 sequence 事件（`update-sent`）仍在 session 侧、edge 侧零观测面**
（简报/ADR 明文归属 edge）是可稳定复现、根因已证实的两处红灯 —— 契约 3 条红灯即此二者，其余为回归护栏。
