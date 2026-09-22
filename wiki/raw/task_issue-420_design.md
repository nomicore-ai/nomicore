# SA1 实现设计 — issue #420：SessionHost 公共工厂 + 内存管道完整协议回合（spec #415 T3）

- 派工：`sa-96bda0bc-8d05-49f9-8f96-937a2cad9ef7`（role `mabf-sa1`，phase design，iteration 1——SA2 评审修订轮）
- 输入：任务简报 `wiki/raw/task_issue-420.md`（Issue #420，Owner comments = `[]`）、已批准 SA6 验收契约 `wiki/raw/task_issue-420_sa6_contract.md`、SA8 冲突门禁 `wiki/raw/task_issue-420_conflict_report.md`（verdict **clear**，RA1–RA5）与 `wiki/raw/task_issue-420_relevant_decisions.md`、SA8 design 复查 `wiki/raw/task_issue-420_design_conflict_report.md`（verdict **clear**，RA1'–RA5'，W1/W2 读法确认）、SA2 设计攻击评审 `wiki/raw/task_issue-420_sa2_review.md`（verdict **reject**，1 × MAJOR = SA2-F1；本修订的对象）
- 基线：HEAD `7039f6dae8e7d29f0c929492f0ca2119bc63afaa`（= PR #426 merge，含 #418 拆分）；包基线 77 files / 588 tests 全绿（`artifacts/sa6-issue420-baseline-package-suite.log`）
- 设计产物：本文件。SA1 不实现代码、不编写测试、不运行验证命令

---

## 1. 任务类型、目标和非目标

**任务类型：Feature（能力缺口，无 Bug 根因）**——公共 byte-seam SessionHost 工厂缺失 + 内存管道完整回合不可达（SA6 §5 G1–G7）。

**目标**

1. 新公共模块 `packages/ws-replication/src/hub-session-host.ts`：导出 `createHubSessionHost` 工厂 + 7 个类型（签名**逐字采用 SA6 §12.1 冻结声明**，见 §7 D1），经 `src/index.ts` 追加导出；`open()` 描述子为纯 JSON（含 edge 已结算 ok-预授权投影），句柄提供 `handleFrame`（fire-and-forget 入帧）/`onFrame`（出帧 sink，返回被分配 wire 序）/`onSignal`/`terminateUnauthorized`/`close`。
2. 内部 splice 机械重命名让出公共名：`hub-session.ts` 的 `createHubSessionHost`→`createHubSessionSink`、`HubSessionHostConfig`→`HubSessionSinkConfig`、删除 `HubSessionHost = HubSessionSink` 别名（SA6 §12.6 授权编辑；零行为）。
3. 测试夹具 `test/issue420-shim-hub.ts`：宿主桥 + shim hub（真 edge + 内存管道 + 公共 session 工厂 + 真 Registry fixture），只搬运字节/JSON 与 port 成员、按准入结局路由；桥的 `openNamespace` 为**三分支路由**（authorized 已完成 → 经既有句柄转发；authorized 在途 → 入有界 pending 窗口；denied → 投递 denialSink）——覆盖再 OPEN 与在途 OPEN（SA2-F1，§7 D7）。
4. 三个新验收测试文件（AC1 test-d / AC2+AC5 回合 / AC3 shim 矩阵重跑）。
5. RA1 文本修订：ADR 0032 澄清附录（E1/E2 两线）+ `CONTEXT.md:229-231` 词条更新，与实现同变更集落地。

**非目标**（SA6 §10 + SA8 行 13 一致）

- peer 侧拆分；真 worker/`MessageChannel`/异步序回传形态（U2：本票只冻结**同步宿主 pipe**——`onFrame` 同步返回被分配序，E1 证明承重）；`listen:false` 插件服务轨（`nomicoreHubSessionHost` 服务）；跨进程 revoke 全链路；wire 格式 / 错误码 / 事件词汇任何变化；`hub-namespace.ts` 任何 diff（硬门）。

---

## 2. 当前行为与证据锚点（源码事实）

| # | 事实 | 锚点 |
| --- | --- | --- |
| B1 | 公共入口现有 11 个运行时导出 + 类型，**无任何 SessionHost 形态工厂** | `src/index.ts`（全文 69 行）；SA6 §4 G1/G2 探针 |
| B2 | 唯一 session 半边工厂吃**函数承载** `HubSessionEdgePort`（17 成员）+ **已解码消息**（`openNamespace(message)` / `namespaceFrame(message, sequence)`），无字节入帧面 | `src/hub-session.ts:30-39,84-172,291-293`；`src/hub-split.ts:54-99,101-127` |
| B3 | edge 在首个 OPEN **到达点**：① `beginAdmission`（台账 + 唯一真实 authorize）→ ② 无条件 `sink.openNamespace(message)`；台账缺失 ⟹ `port.openAdmission` 响亮 reject；台账 ⟺ 通道在场（锁步，C0d 断言） | `src/hub-edge.ts:323-360,362-369`；`src/hub-split.ts:12-21` |
| B4 | authorize shim = **拉取**已结算结局：`authorized`→完整 ok-投影逐字回放、`denied`→`{ok:false}`、`throw`→reject（→`INTERNAL_ERROR`） | `src/hub-session.ts:97-111`；`src/hub-split.ts:35-51` |
| B5 | 出站帧 = `sequence=0` 占位编码（session 侧），edge `OutboundQueue.emitOne` mux 点重写 `[8..12]` 并返回分配序；`sendControlFrame/sendDataFrame(frame): number`「0 = 未发送/被拒」 | `src/hub-session.ts:203-263`；`src/frame-io.ts:139-197`；`src/hub-edge.ts:213-251` |
| B6 | 入站 sequence 纪律**单点在 edge**：`decodeInbound(bytes,{expectedSequence})`；codec 的 `expectedSequence` 是**可选**项（缺省 = 不检查） | `src/hub-edge.ts:373-402`；`packages/replication-protocol/src/limits.ts:24`、`envelope.ts:81,127-128` |
| B7 | 通道→连接收口既有路径：`ACK_STATE_VIOLATION` → `host.connectionFatal(code, 1002)` | `src/hub-namespace.ts:662,1099`；`src/hub-edge.ts:619-645`（code→close code 映射 `wsCloseCodeFor` 单点在 edge） |
| B8 | 回合承重性已被 SA6 因果探针证明：control 面 0 回传 ⇒ `ACK_STATE_VIOLATION`；data 面 0 回传 ⇒ `resync-required{send-failed, send-frame-rejected}`；桥中继 `encode(decode(frame),{sequence})` 逐字节保真（14 帧 0 mismatch）；SA6 探针 stub port 即 `dataGateOpen:()=>true, onDataQueued/requestDataDrain: no-op` 且全回合绿 | `artifacts/sa6-issue420-{causality,bridge-relay-fidelity,sequence-discipline}-probe.{mts,log}` |
| B9 | 单体 listen 组合根：`createEdge` 以 `sessionFactory(port)=>createHubSessionHost({port,...})` 装配；`HubReplicationOptions` 提供 registry/authorize/timer/verifyToken/observer/clock | `src/hub-connection.ts:429-463,153-168`；`src/types.ts:145-159` |
| B10 | 驱动器有 `createHub` 注入缝且默认 import 包入口；7 个矩阵文件不传 `createHub`、不触 `run.hub.*`（仅 ac7 值导入 `createPeerReplication`、ac3/ac4 仅类型导入） | `test/driver.ts:8,196,516`；矩阵文件 import 段（grep 核对） |
| B11 | runner 发现面：根 `vitest.config.ts` `include: packages/*/test/**/*.test.ts`、`typecheck.include: packages/*/test/**/*.test-d.ts`；别名 `@nomicore/ws-replication` → `packages/ws-replication/src/index.ts` | `vitest.config.ts:7-24` |
| B12 | 冻结锚：`FROZEN_PRODUCTION_EXPORTS`（11 名，字母序，`:551` 断言 `Object.keys().sort()` 全等）；结构测试 C0c 期望 `sessionModule` 导出 = `['createHubSessionHost']` | `test/ws-replication-issue418-edge-session-split-contract.test.ts:144-156,548-552`；`…structure.test.ts:614-619` |
| B13 | `registry.open` 主人不符 → `NAMESPACE_NOT_FOUND`（零存在性泄露）；通道映射 `opened.code==='NAMESPACE_NOT_FOUND' ? 'NAMESPACE_NOT_FOUND' : 'INTERNAL_ERROR'`；`!authz.ok ∨ !permissions.read` → `NAMESPACE_UNAUTHORIZED`（在 `registry.open` 之前短路） | `packages/namespace-registry/src/types.ts:438`；`src/hub-namespace.ts:346-376` |
| B14 | ConnectionSender 对 `facetOf(ns)===undefined` 安全（wheel 移除 / 记 0 字节）；`tryEmitDataFrame` 承接字节形态 data 帧（单帧守卫 + 总压 admission + 盖章） | `src/backpressure.ts:165-178,255-280,430-470` |
| B15 | 单一 observer 分发/时钟折叠单点：`dispatchReplicationObserver` / `safeNow`（observer.ts 导出，可复用） | `src/observer.ts:36,162` |
| B16 | **再 OPEN 投递语义**：edge `onOpenNamespace` 对台账命中（已投递）ns 的再 OPEN **仍无条件** `sink.openNamespace`（头注明文「已投递（台账命中）的再 OPEN 只投递 → 通道 `onOpen` 重开矩阵（零 authorize）」）；sink `openNamespace` 通道在场 → `channel.onOpen`，不在场 → 到达点建通道 + `startOpen`；重开矩阵 = 'opening'→`openWaiters` 合流再答 / 已建立（bootstrapping/reconciling/live/needs-resync）→立即再答 OPEN_OK / 'closing'→收口后答 / 终态（closed/conflicted/failed）→`NAMESPACE_REOPEN_REQUIRES_RECONNECT`；sink `channels` 表**永不删除**条目（全仓零 `channels.delete`）——连接存活期内已建通道恒在场 | `src/hub-edge.ts:318-328`；`src/hub-session.ts:84-94`；`src/hub-namespace.ts:289-330`；grep `channels.delete` 零命中；`test/ws-replication-ac1-ac2-open.test.ts:231/:245`（两用例实测驱动该路径；`injectPeerFrame` :46-48） |

---

## 3. 能力缺口（= SA6 §8 承接，不自行复现）

症状：AC1–AC5 的验收形态在 HEAD 上不可达。直接缺口：公共入口无 shard 形态工厂（G1/G2）。结构原因：内部 splice 缝面（17 函数成员 + 已解码消息）与 ADR 决策 2 的字节缝（`Uint8Array` + 纯 JSON）不同构（G3/G4）。更深根因：#418 进程内组合把缝实现为同步函数调用，出站 wire 序经返回值回传；公共形态拆成字节帧 + 宿主 pipe 后必须重新定义「序的回传路径」，否则回合在首个 ACK 处断裂（SA6 §9 E1：control 0 回传 ⇒ bootstrap 永不结算；data 0 回传 ⇒ `send-frame-rejected` resync）。触发条件：任何真实（非 mock）回合。

**未证实假设（承接 SA6 §8）**：(i) 真 worker 异步序回传形态（本票不冻结）；(ii) 拒绝路径归属 —— **本设计裁决为 §7 D6**。

---

## 4. Owner 要求落实

派工明文：Owner feedback requirements = none；REST Issue comments = `[]`（任务简报 `## Comments` 为空）。无逐条评论映射表可建。Issue 正文要求与设计落位：

| Issue 正文要求 | 设计落位 |
| --- | --- |
| 「导出 SessionHost 公共工厂——`open()` 输入含 connectionKey、remoteInstanceId、namespaceId、authorization 预授权投影（localOwner/read/submit，edge 授权结果的传递）、selectedCapabilities、可选 connectionId」 | §7 D1（签名逐字 = SA6 §12.1 冻结声明；`authorization: Extract<NamespaceAuthorization,{ok:true}>`） |
| 「会话句柄提供 `handleFrame`（fire-and-forget 入帧）/`onFrame`（出帧，sequence=0 占位）/`close`」 | §7 D2/D3/D4 + D5（信号面补齐 `onSignal`/`terminateUnauthorized`，依据 = SA6 §12.1 追加项声明 ①②③） |
| 「authorize 不在 session 侧调用——shim 以闭包回放预授权投影」 | §7 D1 adapterPort.`openAdmission` 恒回放 ok-投影；test-d 负控禁 `authorize`/`transport`/`port` 键 |
| 「内存管道对驱动完整协议回合，无 socket 无 worker」 | §7 D7/D8 夹具 + §12 AC2 断言映射 |
| AC1–AC5 | §12 验收与验证映射（含 RA4/D8 两处措辞修正） |

---

## 5. 复现和根因承接

| 上游事实（SA6） | 证据位置 | 设计响应 |
| --- | --- | --- |
| G1–G4 公共工厂缺席 + 内部缝不同构 | `artifacts/sa6-issue420-capability-gap-probe.log` | §7 D1 新模块；不改内部缝成员集（R8'' 冻结面） |
| E1 出站序回传承重（control/data 两面） | `artifacts/sa6-issue420-causality-probe.log` | §7 D3：`onFrame` listener 返回被分配 wire 序，桥原样回传 `port.send*Frame` 返回值；无 sink ⇒ 返回 0（响亮失败路径保留） |
| E2 入站 sequence 单点在 edge；session 零重检（回退序仍消费并回显） | `artifacts/sa6-issue420-sequence-discipline-probe.log` | §7 D2：`handleFrame` 解码**不含** `expectedSequence`（B6：codec 可选项缺省不检查）；分派同构 `namespaceFrame(message, header.sequence)` |
| E3 桥中继逐字节保真；OPEN 中继序为桥合成值（协议无消费者） | `artifacts/sa6-issue420-bridge-relay-fidelity-probe.log` | §7 D7：桥 = 解码消息↔字节中继；OPEN 中继序 = 合成 `0`（登记例外，无协议消费者） |
| N3/N4 结构门基线绿（须保持）+ 纯 JSON 判据敏感 | `artifacts/sa6-issue420-seam-purity-gate-probe.log` | §12 AC4：C4a 结构门保持 + C4b/C4c/C4d 行为断言 |
| 负控 N1/N2（同 runner 下既有面全绿） | `artifacts/sa6-issue420-runner-trigger-red.log` | 红因 = 能力缺口，非环境；设计不需环境侧动作 |
| SA6 §12.6 两处授权编辑 | 契约 §12.6 | §11 ALLOW LIST 第 6/7 条（逐字执行） |
| **SA2-F1**（MAJOR）：D7 桥 `openNamespace` 缺「同连接再 OPEN / authorized 在途 OPEN」分支——按 iteration 0 文本再 OPEN 会重入 authorized 路由再调 `open()`，命中 D1 重复前置 throw 且发生在异步续体内（无承载 reject），重开矩阵（openWaiters 合流 / `NAMESPACE_REOPEN_REQUIRES_RECONNECT`）不再发生 ⇒ AC3 shim 臂 `ac1-ac2` `:231/:245` 两用例必红 | `task_issue-420_sa2_review.md` §13（SA2-F1 行）+ §7 SM1/SM12、§8 ER6/ER7、§9 契约影响表；源码锚 = B16 | §7 D7 重写为**三分支路由**（authorized 已完成→句柄转发 / 在途→pending 窗口 / denied→denialSink）+ 每 ns 路由相位状态；D6 资源账补「OPEN 帧可多次到达」句；§8/§9/§12/§13 联动；验收 = 两用例 shim 臂断言逐字不变绿 + `collectUnhandledRejections()` 空 |

**上游事实与源码矛盾登记（SA1 不裁决，按决策集唯一确定的读法修正验收措辞）**

| # | 矛盾 | 裁定读法（决策集唯一相容） | 处理 |
| --- | --- | --- | --- |
| W1（= SA8 RA4） | SA6 §12.2 A8 第二分句「`handleFrame` 收到的帧仍带占位 0」 vs C4c「入=wire 序」/C5a（回退序 2 须被消费并回显）/E3（中继带 wire 序） | 决策 2「入站 sequence 由 edge 校验」+ `hub-split.ts:110-112`（`namespaceFrame(message, sequence)` 记账需要 wire 序）⇒ **入站缝帧携带 wire 序；占位 0 只在出站方向**（唯一例外：OPEN 中继序 = 桥合成值，见 W-注） | 测试按修正读法落（A8 第二分句改为「出站（`onFrame` 方向）缝帧带占位 0；入站（`handleFrame`）非 OPEN 帧携带 wire 序」）；C5a/A9/C4c 不动。**SA8 design 复查已确认（行 15/RA4'，`task_issue-420_design_conflict_report.md`）** |
| W2（iteration 0 新发现，同 RA4 处理类别） | SA6 §12.2 A4 末句「描述子换 `PEER_OWNER`（`registry.open` 主人不符）→ 无 `OPEN_OK` 且 `NAMESPACE_UNAUTHORIZED`」 vs 代码事实 B13：ok-投影 `localOwner` 与 entry owner 不符 ⇒ `registry.open` → `NAMESPACE_NOT_FOUND` ⇒ 通道映射 wire `NAMESPACE_NOT_FOUND`（listen 形态同此；`NAMESPACE_UNAUTHORIZED` 仅由 `!authz.ok ∨ !permissions.read` 产生） | 零 diff 通道 + Registry 零存在性泄露语义唯一确定：**无 `OPEN_OK` + ns 域 ERROR `NAMESPACE_NOT_FOUND` + 注册表零打开 + authorize 恰一次不变**；安全不变量（不泄露存在性）保持 | 测试按 `NAMESPACE_NOT_FOUND` 断言；**SA8 design 复查已确认（行 16/RA4'：三重锚 = 协议 :650 + registry `types.ts:438/:885-886` 零泄露 + 通道 :375 映射）**——本修订不再悬置 |

---

## 6. SA8 约束落实（`task_issue-420_conflict_report.md` RA1–RA5 + §3 S1–S6）

> **design 复查状态**：`task_issue-420_design_conflict_report.md`（verdict **clear**，30 项对照，RA1'–RA5'）已对 iteration 0 设计完成裁决——U3 = D6 形态（行 7）、W1/W2 读法确认（行 15/16/RA4'）、附录计划判完整（§6/E1/E2）。**本修订（SA2-F1）不触碰其任何裁决面**：公共冻结签名、DENY 面（`hub-namespace.ts`/`hub-edge.ts` 零 diff）、port 17 成员集、U3 裁决方向、RA1 附录要素全部原样保留；SA2 评审结论同口径（其 §14：「F1 不触决策面」）。下表按前置门禁 RA1–RA5 口径维护，design 复查增补以 RA*' 标注。

| 决议/义务 | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
| --- | --- | --- | --- |
| **RA1**：ADR 0032 修订/澄清附录 + `CONTEXT.md:229-231` 更新须与实现同变更集（E1 信号词汇 + 公共面降级登记；E2 机制句/投影载体 + U3 选定形态）；在此之前不得援引机制句字面迫使回退 | §11 ALLOW LIST（docs/adr/0032 + CONTEXT.md）+ §7 D10（附录文本要素） | 设计给出 U3 选定形态（D6）供附录定稿；实现变更集携带附录 | 是（RA1 门禁核对） |
| **RA2**：设计必须裁 U3（edge 处置 vs session 回放）并给证据；`ac1-ac2-open` deny 断言族保持绿；选定形态与 RA1 附录一致 | §7 D6（裁决 + 证据 + 备选否决） | 选 **(i) edge 侧处置（生产代码承载 wire 行为 + 桥只按结局路由）**；deny/readDeny/submitDeny 断言由零 diff 通道产出 | design 复查已完成（clear，行 7 裁 D6 形态成立）；impl 复查承接落地核对（RA2'） |
| **RA3**：R5'' 门禁承接（桥形态/组合成员重塑）；impl 复查核对零 diff/导出恰增一名/零 worker 依赖/S2 有界/observer 单点/AC3 反空跑/M1–M7 | §7 D7（桥形态，iteration 1 含三分支路由）、§11（DENY 面）、§12（M1–M7 映射） | 设计冻结桥形态与核对清单 | 是（design 报告已置 recheck（RA3'），impl 复查继续；iter 1 增补核对项见 §15 第 4 条） |
| **RA4**：A8 第二分句措辞修正（design 冻结前） | §5 W1 | 测试以修正读法为准 | 已由 SA8 裁定并经 design 复查确认（RA4'，含 W2，见 §5 两行） |
| **RA5**：U2 边界——只冻结同步宿主 pipe；公共面一经 test-d 锁定 append-only | §7 D3 + §13 R1 | 设计明确同步面范围；签名逐字冻结 | 跨票登记 |
| S1（R5''）入站缝形态变化重新过 SA8 | 本设计即该复查的 design 段输入 | §7 D1/D2 冻结新缝面 | 是 |
| S2（R4''）跨缝 pending 有界 + 顺序保真 | §7 D7（pending 窗口：每 ns ≤16 帧 + 溢出响亮收口） | 宿主桥职责兑现 | impl 复查核对 |
| S3 机制句/词条文本调和 | §7 D10 + ALLOW LIST | documentation-only 先行或同变更集 | 是（RA1） |
| S4 dormant 降级（water gate true、`bufferedAmount` 缺席、assembly per-session、namespace 域 observer 在 session） | §7 D5（逐项映射表） | 决策 5 字面兑现 | impl 复查核对 |
| S5 生产 API 只经 `src/index.ts`；桥/夹具只落 `test/`；`/testing` 零改 | §11 | ALLOW LIST 遵守 | 否 |
| S6 公开面 append-only | §7 D1 + §13 R1 | 签名一经 test-d 锁定冻结 | 是（impl 复查） |
| SA8 行 23：observer 隔离单点（`dispatchReplicationObserver`）在公共形态不得分叉 | §7 D5 | adapterPort 复用 `dispatchReplicationObserver`/`safeNow`（B15） | impl 复查锚 |
| SA8 行 30：内部重命名 = 非决策面、机械 | §7 D9 | 重命名计划 + 全量绿背书 | impl 复查确认纯机械 |

---

## 7. 设计决策与主要备选方案

### D1 — 新公共模块 `src/hub-session-host.ts`：冻结面 + 内部复用内部 splice

**公共声明逐字采用 SA6 §12.1（实现必须逐字段一致，含 JSDoc 语义）**：

```ts
// packages/ws-replication/src/hub-session-host.ts（新模块）→ src/index.ts 追加导出
import type { NamespaceRegistry } from '@nomicore/namespace-registry';
import type {
  NamespaceAuthorization,
  ReplicationClock,
  ReplicationObserver,
  ReplicationTimer,
  ResolvedLimits,
  ResolvedTimeouts,
} from './types.js';

/** 工厂配置：宿主本进程/worker 内事实（**不跨缝**；可含函数，但不得含 authorize/transport/缝 port）。 */
export interface HubSessionHostConfig {
  readonly registry: NamespaceRegistry;
  readonly instanceId: string;              // hub 实例 id（HELLO 绑定/本地 owner 判定）
  readonly limits: ResolvedLimits;          // 组合根 resolve+validate 后注入（既有纪律）
  readonly timeouts: ResolvedTimeouts;
  readonly timer: ReplicationTimer;
  readonly observer?: ReplicationObserver;  // namespace 域事件发射面（决策 5：拥有事实的一侧）
  readonly clock?: ReplicationClock;        // now() 采样（无 observer 零采样，既有纪律）
}

/** 单 (连接, namespace) 会话开启描述子：**纯 JSON**（可 structuredClone，无函数/live 对象）。 */
export interface HubSessionOpenInput {
  readonly connectionKey: string;           // 宿主连接身份（不透明；非空；nomicore 不解释）
  readonly remoteInstanceId: string;        // edge 认证后的对端 instanceId（= edge.authenticatedInstanceId）
  readonly namespaceId: string;
  readonly authorization: Extract<NamespaceAuthorization, { ok: true }>; // edge 已结算预授权投影
  readonly selectedCapabilities: number;    // HELLO capability 交集位图
  readonly connectionId?: string;           // 连接域 observability id（握手前 undefined）
}

export type HubSessionFrameLane = 'control' | 'data';
/** 出站 sink：同步收帧，返回**被分配的 wire 序**（0 = 未发送/被拒）。 */
export type HubSessionFrameListener = (frame: Uint8Array, lane: HubSessionFrameLane) => number;

/** 会话→edge 控制信号（纯 JSON；ADR 决策 2 的 session→edge 半边在字节缝上的载体）。 */
export type HubSessionSignal =
  | { readonly type: 'settled'; readonly namespaceId: string }
  | { readonly type: 'connection-fatal'; readonly code: string };

export interface HubSessionHandle {
  /** 入站（fire-and-forget）：namespace 域 wire 帧；序列已由 edge 校验——本半边**不得**再校验。 */
  handleFrame(frame: Uint8Array): void;
  /** 出站 sink 注册（同步）；至多一个 sink 生效：后注册者替换先注册者；返回退订函数。 */
  onFrame(listener: HubSessionFrameListener): () => void;
  /** 会话→edge 控制信号观察（纯 JSON；可多监听，返回值忽略）。 */
  onSignal(listener: (signal: HubSessionSignal) => void): () => void;
  /** 'terminateUnauthorized' 控制信号（revoke 链；幂等；无通道则 resolve）。 */
  terminateUnauthorized(): Promise<void>;
  /** 'close' 控制信号：同步前缀 quiesce + 异步尾 cleanup；幂等（重复返回同一 promise）。 */
  close(): Promise<void>;
}

export interface HubSessionHost {
  /** 同步开启一个 (连接, namespace) 会话（同一 handle 只服务该 ns；(connectionKey, namespaceId) 唯一属宿主前置条件）。 */
  open(input: HubSessionOpenInput): HubSessionHandle;
}

export function createHubSessionHost(config: HubSessionHostConfig): HubSessionHost;
```

（SA6 §12.1 的逐成员语义表同时是实现的契约：`open` 同步返回、描述子纯 JSON、`authorization` 只接受 ok-投影、session 对象随连接存活；`handleFrame` 禁 `expectedSequence`；`onFrame` 占位编码 + 返回序；`onSignal` 的 `settled` 恰一次 / `connection-fatal` code→close code 映射归 edge；`terminateUnauthorized`/`close` 幂等。）

**内部结构**：`HubSessionHostImpl` 持 `Map<`${connectionKey}\u0000${namespaceId`, HubSessionHandleState>`。每个 `open(input)`：

1. **响亮前置检查**（宿主契约违反即 throw，不在验收面——SA6 §12.1 open 行明示「设计可自行选择响亮拒绝，无需断言」）：`connectionKey` 非空 string；`(connectionKey, namespaceId)` 未重复开启。重复 = 宿主 bug，静默复用或静默新建都被禁止（fail-loud 纪律）。
2. 构造 **adapterPort**（实现内部 `HubSessionEdgePort` 17 成员；映射见 D5 表），其中 `openAdmission(ns)` 恒 resolve `{outcome:'authorized', authorization: input.authorization}`（闭包回放——决策 3「投影仍传入，语义是 edge 授权结果的传递」的公共面兑现；denied/throw 结构性不过缝）。
3. 以 `createHubSessionSink({port: adapterPort, registry, instanceId, peerInstanceId: input.remoteInstanceId, timer, limits, timeouts})` 建内部 sink（重命名后的内部工厂），句柄方法委托该 sink（`close`→sink.close、`terminateUnauthorized`→sink.terminateNamespace(input.namespaceId)）。
4. 会话存活期 = 连接存活期：句柄不因通道终态失效（终态通道由零 diff 通道的 quiet/terminal 守卫吸收后续帧）；`close()` 幂等由 sink 的 `closeTail` 单 promise 机制承载（`hub-session.ts:269-275` 原样）。

**备选否决**：(a) 公共工厂直接内联复制 `HubSessionHostImpl`（第二份通道宿主组装代码——违背「协议状态机单份实现」精神，且把 24 成员 channelHost 组装复制两处）；(b) 把内部 splice 的配置直接扩成公共面（缝形态不同构，SA6 H1/H2 已否决）。**采用内部复用**：一条组装代码、两种 port 形态（listen = 真 edge port；公共 = adapterPort）。

### D2 — 入站字节面 `handleFrame`（AC5 主实现点）

```
handleFrame(frame: Uint8Array): void
  decoded = decodeMessage(frame, { maxFrameBytes: config.limits.maxFrameBytes,
                                   selectedCapabilities: input.selectedCapabilities })   // ← 无 expectedSequence（B6：可选项缺省 = 不检查）
  失败（throw）→ 发射 {type:'connection-fatal', code: err.code ?? 'MALFORMED_FRAME'}（响亮；见 §9 E3）并 return
  switch decoded.message.kind:
    OPEN_NAMESPACE        → sink.openNamespace(message)        // 通道 OPEN 矩阵；authorize shim 闭包回放描述子投影（B4 同构）；
                                                              // 再 OPEN → 通道在场 → onOpen 重开矩阵（B16；桥侧来源 = D7 ①/② 冲刷）
    其余 namespace 域 kind → sink.namespaceFrame(message, decoded.header.sequence)  // 与 hub-session.ts:115-172 分派壳逐分支同构
    连接级/方向域/未知     → 静默（与内部 default 分支同构，D2/D6；edge 是唯一合法调用方）
```

- **不传 `expectedSequence`**：C5c 结构门（`hub-session-host.ts` 解码调用不含该标识符）+ C5a 行为锚（回退序仍被消费并回显）+ C5d 变异 M5。capability 门控透传 `input.selectedCapabilities`（与 `hub-edge.ts:378-386` 同源判据，issue #243 DD-1.4）。
- **入站缝帧携带 wire 序**（W1/RA4 修正读法）：`header.sequence` 原样进入 `namespaceFrame` 记账（SYNC_STEP1/2、CLOSE_NAMESPACE 等需要，`hub-split.ts:110-112`）。OPEN 的中继序为桥合成值（见 D7），通道 OPEN 路径不读 seq（SA6 E3 边界注记）。

### D3 — 出站字节面 `onFrame`（E1 承重实现点）

- 句柄持有**至多一个** frame listener（后注册者替换先注册者，替换即生效于后续帧；退订函数置空）。
- adapterPort 的 `sendControlFrame(frame)` = 调 listener `(frame, 'control')` 并**原样返回其 number**；`sendDataFrame(frame)` = `(frame, 'data')` 同理。**未注册 listener ⇒ 返回 0**（=「未发送」，通道按既有 0 值语义响亮处理：bootstrap ACK 违约 / `send-frame-rejected` resync——E1 臂 A/C 的失败模式保持可达，A12 红臂依赖它）。
- listener **同步抛出 ⇒ 原样同步传播**（与内部 port 的 `OutboundExhaustedError` 传播契约同形，`frame-io.ts:184-197`；通道侧 `sendChecked`/try-catch 既有纪律吸收）。
- 占位编码保持在内部 sink 内（`hub-session.ts:257-263` `encodePlaceholder`），listener 收到的出站帧 `[8..12]===0`（C4c 出站侧断言）；wire 序由 edge mux 盖章（B5 单点不变）。
- lane 区分 control/data 供宿主选择 `sendControlFrame`/`sendDataFrame`（控制帧保留额度 vs data admission 的既有分叉，`backpressure.ts:120-178`）。

### D4 — 信号面与生命周期信号映射（ADR 决策 2 四信号 + `connection-fatal`）

| 决策 2 信号 | 公共面载体 | 内部落点 | 依据 |
| --- | --- | --- | --- |
| edge→session `close` | `handle.close(): Promise<void>` | 内部 sink `close()`（同步 quiesce 前缀 + 异步尾；幂等单 promise） | `hub-session.ts:269-275` |
| edge→session `terminateUnauthorized` | `handle.terminateUnauthorized(): Promise<void>` | 内部 sink `terminateNamespace(ns)`（无通道 no-op resolve） | `hub-session.ts:278-282` |
| session→edge `settled` | `onSignal` 事件 `{type:'settled',namespaceId}` | adapterPort.`onChannelSettled(ns)` 转发；**恰一次**由通道终态单调不变量承载（`hub-split.ts:15`）；宿主桥映射到真 port.`onChannelSettled`（edge drain 提前完成判据 `hub-edge.ts:689-707`） | SA6 §12.1 追加项 ① |
| session→edge `closed` | `close()` promise 的 resolve | 同上 close 尾 | SA8 relevant_decisions §1 决策 2 行 |
| session→edge `connection-fatal`（**新增公共化 JSON 信号**，SA8 行 6 evolution-required） | `onSignal` 事件 `{type:'connection-fatal',code}` | adapterPort.`connectionFatal(code, wsCloseCode?)` 丢弃 `wsCloseCode` 只发 `code`；宿主桥映射到真 port.`connectionFatal(code)`（默认 1002）。**等价性论据**：通道仅对 `ACK_STATE_VIOLATION` 调用且恒传 1002（`hub-namespace.ts:662,1099`），edge `wsCloseCodeFor` 对同一族 code 恒 1002（`hub-edge.ts:101-105`）⇒ 信号丢参无可观察差异；code→close code 映射单点留在 edge（SA6 §12.1 onSignal 行） | SA6 §12.1 追加项 ②；RA1/E1 附录登记 |

`onSignal` 多监听、返回值忽略；发射点在 adapterPort 侧（同步、无异常逃逸——listener throw 按观察者隔离纪律由 `dispatchReplicationObserver` 同款 try/catch 包裹或等同隔离，**不得**因信号监听者抛出改变协议状态；见 §9 E6）。

### D5 — adapterPort 17 成员映射表（决策 5 dormant 面 + 单点复用）

| `HubSessionEdgePort` 成员 | adapterPort 实现 | 依据 |
| --- | --- | --- |
| `openAdmission(ns)` | 恒 `Promise.resolve({outcome:'authorized', authorization: input.authorization})` | 决策 3 / B4；台账缺失分支结构性不可达（无台账概念） |
| `sendControlFrame(frame)` | `(frame,'control')` → listener，返回其 number（无 sink ⇒ 0） | D3 / B5 |
| `sendDataFrame(frame)` | `(frame,'data')` → listener，返回其 number | D3 / E1 臂 D |
| `dataGateOpen()` | **恒 `true`（dormant）** | 决策 5 / S4；B8 探针同款 |
| `onDataQueued(ns)` | **no-op** | 决策 2 有界性归宿主传输 + 1011；B8 探针同款（wheel 无源 ⇒ 不查询） |
| `requestDataDrain()` | **no-op** | 同上 |
| `chunkedUpdateNegotiated()` | `(input.selectedCapabilities & CAP_CHUNKED_UPDATE) !== 0`（与 `hub-edge.ts:733-735` 同一判据式） | 决策：位图经描述子传递 |
| `connectionFatal(code, wsCloseCode?)` | 发 `{type:'connection-fatal', code}` 信号；标记句柄连接态 `closed` | D4 |
| `onChannelSettled(ns)` | 发 `{type:'settled', namespaceId: ns}` | D4 |
| `tryBeginInboundAssembly(ns)` | **per-session 单槽**（布尔；同 ns 幂等 true）——单 ns 句柄下计数恒 ≤1，语义 = 决策 5 per-session 降级 | 决策 5 / S4 |
| `endInboundAssembly(ns)` | 释放单槽（幂等） | 同上 |
| `observerPresent()` | `config.observer !== undefined` | 决策 5（namespace 域事件在 session） |
| `emitObserver(event)` | `dispatchReplicationObserver(config.observer, event)`（**单点复用，不分叉**） | SA8 行 23 / B15 |
| `connectionId()` | `input.connectionId ?? undefined` | §12.1 声明 |
| `connectionState()` | 句柄本地投影：`'ready'`（open 起）→ `'closed'`（`close()` 调用或 connection-fatal 发射后） | `hub-session.ts:211,251` 仅判 `==='closed'`；#231 诊断上下文 |
| `bufferedAmount()` | **恒 `undefined`（dormant 缺面）** | 决策 5 / S4 |
| `now?()` | observer 在场 ? `safeNow(() => config.clock?.now())` : `undefined`（B1 折叠同款） | `hub-edge.ts:246-249` / B15 |

### D6 — U3 裁决：拒绝路径归属 = **(i) edge 侧处置**，以「结局路由 + 生产代码承载 wire 行为」实现（RA2）

**裁决**：未授权（denied/throw）OPEN **不过公共缝**——`HubSessionOpenInput.authorization` 的类型（`Extract<…,{ok:true}>`）与 test-d 负控（`authorization: {ok:false}` 不得通过）结构性保证。denied 的 wire 行为由 **edge 侧的生产代码**产出，宿主桥只做**按结局路由**：

- 桥的 `sessionFactory(realPort)` 返回内部 `HubSessionSink` 代理。`openNamespace(message)`（edge 到达点无条件调用，B3——**每个到达的 OPEN 都调用**）按 D7 相位三分支转发；其中**仅该 ns 的首 OPEN**（台账首建）触发 `realPort.openAdmission(ns)`（真台账，promise 多播安全）进入下述结局路由，结局路由：
  - **`authorized`** → `host.open({connectionKey, remoteInstanceId, namespaceId, authorization: 投影, selectedCapabilities, connectionId})` → `handle.onFrame/onSignal` 注册到真 port 成员 → `handleFrame(encodeMessage(message, {sequence: 0}))` 转发 OPEN 字节（D7）。
  - **`denied` / `throw`** → 投递给**同进程的第二个内部 sink**：`denialSink = createHubSessionSink({port: realPort, registry, instanceId, peerInstanceId, timer, limits, timeouts})`（真 port 直连）——`NAMESPACE_UNAUTHORIZED`/`INTERNAL_ERROR` ERROR 帧、通道 failed 终态、observer 事件族、`settled` 信号、注册表零打开全部由**零 diff 生产代码**产出（`hub-namespace.ts:346-376` + `hub-session.ts:97-111`），与 listen 形态逐字节一致。

**证据与论证**：

1. **deny 断言族保持绿**：`ac1-ac2-open` 的 `NAMESPACE_UNAUTHORIZED`×1、authorize 恰一次（真 edge 台账单点，B3）、注册表零打开（通道短路在 `registry.open` 之前）——全部由生产通道产出，无需夹具复现任何规则。
2. **零 fork**：夹具不做协议决策——不合成 ERROR 帧、不选错误码、不实现闩锁；唯一决策 = 「按准入结局选择承载机械」，属装配路由（与「port 成员搬运」同层）。
3. **drain 簿记保真**：denied 通道终态 → 真 port.`onChannelSettled` → edge `settledNames` 记账（`hub-edge.ts:689-707`）——若由夹具合成 ERROR，settled 永不发射，edge drain 提前完成判据对 denied ns 永远阻塞到 deadline（行为分叉）。
4. **资源账**：每 (连接, ns) 恰一个承载机械（admission 结局二值、至多结算一次）——authorized ns 不进 denialSink，denied ns 不进公共句柄；两机械无共享可变面（各自 channels 表互斥）。**OPEN 帧可多次到达**（B16：台账命中后 edge 仍无条件投递，协议现实；ADR 0032 决策 3 自文「重 OPEN 经 openWaiters 合流不重复 authorize」）：承载机械按 (connectionKey, ns) 至多一个且路由相位单调（D7 路由状态表）；再 OPEN 经既有机械转发（authorized → 既有句柄 `handleFrame`；denied → denialSink 通道 `onOpen` 重开矩阵）、authorized 在途 OPEN 入有界 pending 窗口按到达序冲刷——**零二次授权语义**（authorize 恒恰一次于 edge 台账，`beginAdmission` 仅台账首建时调用）。

**备选否决**：
- **(ii') 夹具合成拒绝帧**（`namespaceErrorFrame('NAMESPACE_UNAUTHORIZED',…)` + `port.sendControlFrame`）：错误码选择 = 夹具内的协议决策副本（违反 AC3「夹具内无协议决策/唯一变换 = 中继 + port 搬运」的排他措辞）；且丢失 settled/observer/终态语义（见论证 3）。SA6 §12.1 open 行「denied/throw 不过缝，由 edge 处置」与本裁决一致——「edge 侧」在 shim 拓扑中 = 真 edge + 宿主桥 + 桥内生产 sink。
- **(i') 修改生产 edge 让其在投递前处置拒绝**（机制句字面全量实现）：需要 edge 等待 admission 结局再投递 ⇒ 破坏 #418 到达点时序与「台账 ⟺ 通道在场」锁步（C0d 断言族）⇒ listen 形态 observable 分叉（wire 之外：observer 事件、channels 投影、deny 期的 opening 通道），触碰 R8'' 重触发面。**留给 ADR 附录（RA1/E2）以文字调和，不以本票改行为**——SA8 行 8 已裁定「在此之前不得援引机制句字面迫使回退」。
- **(ii'') 公共面携带 denied**：违反冻结签名（ok-投影 only）与 test-d 负控。否决。

**与 RA1 附录的一致性**：附录 E2 按 D6 形态定稿——「未授权 OPEN 不过**公共字节缝**；公共形态由 edge 侧（含宿主桥的生产 sink 承载）处置；内部进程内缝维持 #418 的结局传递 + 拉取形态」。

### D7 — 宿主桥（`test/issue420-shim-hub.ts`）：只搬运 + 按结局路由 + 有界 pending

桥 = `sessionFactory(realPort)` 返回的 `HubSessionSink` 代理 + shim hub 服务面。

**每 (connectionKey, ns) 路由相位（SA2-F1 修订核心；装配路由状态，非协议 FSM——桥仍零协议决策，D6 论证 2 不变）**：

| 相位 | 含义 | 进入时机 | 承载机械 |
| --- | --- | --- | --- |
| `routing` | 首 OPEN 已触发 `realPort.openAdmission(ns)`（真台账 promise，B3），结局未结算或 authorized 续体（`open()` + 注册 + 首 OPEN 转发）未完成 | 该 ns 首 OPEN 到达（台账首建，edge `beginAdmission` 恰一次） | 未定；后续帧入有界 pending 窗口 |
| `authorized` | 公共句柄在场 | authorized 续体完成（同步段末） | 公共工厂句柄 |
| `denied` | denialSink 通道在场 | denied/throw 续体投递 `denialSink.openNamespace` 后 | denialSink（生产 sink 直连真 port） |

不变量：相位**互斥、单调、不可逆**（`authorized`/`denied` 为吸收态；唯一例外 = 桥 closed 守卫放弃在途路由，见 `close()` 行）；承载机械至多一个（D6 资源账）；**再 OPEN 不重入路由**——`openNamespace` 按相位三分支转发，结构上不触发 D1 的重复 `open()` 前置 throw（E5 的 throw 面仅剩宿主直接违例；桥作为本工厂第一宿主结构性避开，SA2 ER6）。

**代理成员路由表**：

| 代理成员 | 行为 |
| --- | --- |
| `openNamespace(message)` | **三分支路由（SA2-F1）**：① 相位 `authorized` → **不再调 `open()`**，OPEN 帧字节经既有句柄转发 `handleFrame(encodeMessage(message, {sequence: 0}))`（与首 OPEN 同形态：**中继序为合成值，协议无消费者**，SA6 E3 边界注记；取 `0` 使其与非 wire 值域可区分，若未来出现消费者将被 C5a 族断言暴露）→ 零 diff 通道 `onOpen` 重开矩阵产出应答（B16：'opening'→openWaiters 合流再答；已建立（bootstrapping/reconciling/live/needs-resync）→立即再答 OPEN_OK；'closing'→收口后答；终态（closed/conflicted/failed）→`NAMESPACE_REOPEN_REQUIRES_RECONNECT`）；② 相位 `routing` → OPEN 帧入与 `namespaceFrame` 同一有界 pending 窗口（**按到达序**，与在途非 OPEN 帧混序；authorized 续体完成「`open()` + sink/信号注册 + 首 OPEN 转发」后冲刷——OPEN 条目按 ① 同形态经句柄转发、非 OPEN 条目 wire 序透传；denied 续体投递 denialSink 后冲刷残余，见下行）；③ 相位 `denied` → `denialSink.openNamespace(message)`（通道在场 → `onOpen` 自然承接重开矩阵：终态 → `NAMESPACE_REOPEN_REQUIRES_RECONNECT`，与 listen 同构，SA2 SM12） |
| `namespaceFrame(message, sequence)` | 相位 `authorized` → `handleFrame(encodeMessage(message, {sequence}))`（**wire 序透传**，E3 逐字节保真）；相位 `routing` → 入**有界 pending 窗口**（每 ns ≤16 帧 + 单帧 ≤ maxFrameBytes，镜像 `hub-connection.ts:54` MAX_EARLY_FRAMES 先例），路由完成后按到达序冲刷；**溢出 = 响亮收口** `realPort.connectionFatal('CONNECTION_POLICY_VIOLATION', 1008)`（既有码/映射，无静默丢弃——S2/R4'' 兑现；实践不可达：守规 peer 在 OPEN_OK 前零后续帧）；相位 `denied` → `denialSink.namespaceFrame(message, sequence)`（= listen 的 R-delivered→withChannel 同构；denied 通道常驻 sink `channels` 表——B16 零删除，终态通道由 quiet/terminal 守卫吸收后续帧，SM8） |
| `close()` | 置桥 closed 标志 + fan-out：全部公共句柄 `handle.close()` + `denialSink.close()`（edge `requestSinkClose` 单点调用，幂等）。**在途路由守卫**：相位 `routing` 的续体完成时若 closed 标志已置 → **放弃**（不 `open()`、不投递 denialSink、丢弃该 ns pending 窗口）——连接已收口、零可观察输出（listen 同构：opening 通道被 quiesce，无 wire 输出，SA2 SM9） |
| `terminateNamespace(ns)` | 相位 `authorized` → `handle.terminateUnauthorized()`；相位 `routing` → **挂起至路由完成**再按结局投递（authorized → 句柄；denied → `denialSink.terminateNamespace(ns)`）；相位 `denied` → `denialSink.terminateNamespace(ns)`。**登记（R11）**：listen 形态下 revoke 命中 'opening' 通道立即发 ns ERROR 并 failed（`hub-namespace.ts:1186-1193`：非 quiet 即发 + finalize('failed')）；shim 在途相位只能待路由完成——该角落的 wire 时序可能相对 listen 偏移（AC3 七矩阵零 revoke 用例、A10 为 live 后直调，均不触及；登记为 shim 观测边界，非行为差异主张） |
| `dataFacetOf(ns)` | `denialSink.dataFacetOf(ns)`（authorized ns 无 edge 可见 facet——决策 5 降级：连接级 wheel 无源不查询，`backpressure.ts:267-271` 对 undefined 安全，B14） |
| `channels` | `denialSink.channels`（只读投影；公共形态 authorized 通道不投影到 edge——白盒 channel 锚 = listen 专属，7 矩阵文件与回合测试均不读取，B10） |

**路由续体（首 OPEN 触发，桥唯一异步段；整段 try/catch 包裹 = E10 容错）**：`realPort.openAdmission(ns)`（真台账 promise 多播安全，重复调用返回同一 promise——B3/SA2 §5 RA2 行①核实）→ 结局二分：

- **`authorized`**：构造描述子（纯 JSON，字段来源见下）→ `host.open(descriptor)`（同步返回句柄）→ 注册 `onFrame`/`onSignal` 到真 port 成员（映射见下段）→ 转发首 OPEN 字节 `handleFrame(encodeMessage(message, {sequence: 0}))`（通道到达点建立 + `startOpen` 同步前缀拉取 adapterPort 闭包回放，B4 同构）→ 相位置 `authorized` → **按到达序同步冲刷** pending 窗口（OPEN 条目 = ① 同形态转发；非 OPEN 条目 `handleFrame(encodeMessage(message, {sequence}))`）。
- **`denied`/`throw`**：`denialSink.openNamespace(message)`（首 OPEN；`NAMESPACE_UNAUTHORIZED`/`INTERNAL_ERROR` ERROR 帧、通道 failed 终态、observer 事件族、`settled` 信号、注册表零打开全部由零 diff 生产代码产出，D6）→ 相位置 `denied` → **按到达序同步冲刷** pending 残余至 `denialSink.namespaceFrame(message, sequence)`（OPEN 条目经分派壳 `case 'OPEN_NAMESPACE'` 落 `openNamespace` → 通道在场 → `onOpen` 重开矩阵；保序）。
- **容错（E10）**：非预期 throw（宿主契约外，如描述子构造/编码异常）→ `realPort.connectionFatal('INTERNAL_ERROR', 1011)` 响亮收口（§13.1 在册码，协议 :415 映射 1011）——**结构上杜绝无承载 reject**（SA2-F1 故障面 ER7：edge 对 `sink.openNamespace` 返回 void，续体 throw 无人承载）。

**onFrame/onSignal 注册**（在 authorized 路由续体内、首 OPEN 转发之前完成）：`handle.onFrame((frame, lane) => lane === 'control' ? realPort.sendControlFrame(frame) : realPort.sendDataFrame(frame))`——**返回值原样回传**（被分配 wire 序；E1 承重闭环）。**onSignal 注册**：`settled` → `realPort.onChannelSettled(ns)`；`connection-fatal` → `realPort.connectionFatal(code)`（默认 1002，D4 等价论据）。

**selectedCapabilities / connectionId / remoteInstanceId 的取得**（描述子字段来源）：

- `remoteInstanceId`：shim `accept` 在构造 edge **之前**已从 verifyToken 结算身份——`sessionFactory` 闭包捕获该变量（不可引用构造中的 edge 对象，`hub-edge.ts:173` 构造序）。
- `selectedCapabilities`：由 `realPort.chunkedUpdateNegotiated()` 推导 `CAP_CHUNKED_UPDATE` 位（当前 capability 宇宙单 bit，`hub-edge.ts:47`）。**登记**：未来多 bit capability 需扩展内部 port 面 ⇒ R8'' 重触发 + 公共面 append-only 追加（§13 R6）。
- `connectionId`：open 时读 `realPort.connectionId()`（OPEN 恒在 HELLO 后到达，已定义）。

**shim hub 服务面**（`HubReplication` 接口满足，全部薄委托生产件）：`accept(transport, request)`（宿主职责：closed 门 → token/verifier 门 → 有界早到帧缓冲（≤16 帧/单帧 ≤ maxFrameBytes，重放经 edge 构造尾 `earlyFrames`，镜像 `hub-connection.ts:76-133` 纪律）+ auth timer（`timeouts.helloTimeoutMs`）→ `verifyToken` → `isValidInstanceId`（复用 `validate.ts` 导出）→ `createHubReplicationEdge({…, sessionFactory: 桥, onConnectionDropped})`，配置解析复用 `resolveLimits/resolveTimeouts/validateHubOptions/validateLimits/validateTimeouts`）；`acceptTrusted(transport, identity)`（同构，无验证器）；`connections`（edge 列表）；`revoke(instanceIdentity, ns)`（按认证身份过滤 → `edge.revokeNamespace`）；`requestReauth(instanceIdentity)`（→ `edge.beginReauth()`）；`close()`（全 edge `close(1001,'hub-shutdown')` + `settle()` 汇流——A11 drain 锚）。observer/clock 同时注入 edge 配置与 `createHubSessionHost` 配置（决策 5 双发射点；同一实例 ⇒ 事件面不缺不重）。timer 一律 `options.timer`（U10：与 Registry fixture 同一 scheduler）。

**探针（夹具自带，供 AC2/AC3 断言）**：`connectionsOpened` / `sessionsOpened`（公共 `open()` 计数）/ `denialRouted` / `reopenForwarded`（① 分支转发计数，SA2-F1 诊断）/ `pendingFlushed`（② 冲刷条目计数）/ `seamFramesIn{kind,sequence}[]` / `seamFramesOut{lane,placeholderSeq}[]` / `signals[]` / `handles`（`(connectionKey,ns)→handle`，A10 revoke 用）。**夹具头注登记（SA2 N1/N3 采纳）**：(a) accept 门链与 `hub-connection.ts` 的保真度差异清单——未镜像单微任务让位（`:309` A2-d）、门 5 次序纪律（摘监听→closed 复查→earlyClosed/transport.closed→构造，`:317-331`）、`rejectUpgrade`/`emitUpgradeRejected` 事件面（当前矩阵 + 回合均不触；`makeWire` 微任务投递不丢帧），防止未来把夹具误当规范宿主样例；(b) 本夹具非规范宿主样例声明。

### D8 — AC3 机制选择：**(a) `vi.mock` 替换 `createHubReplication` + 动态 import 矩阵文件**（SA6 §12.3 推荐）

`test/ws-replication-issue420-shim-matrix.test.ts`：

```ts
vi.mock('@nomicore/ws-replication', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nomicore/ws-replication')>();
  const { createShimHubForTesting } = await import('./issue420-shim-hub.js');
  return { ...actual, createHubReplication: (options) => createShimHubForTesting(options).replication };
});
// 顶部（vi.mock 提升后）依序动态 import 七个矩阵文件 —— 同一批 describe/it 断言体逐字二次注册/执行
await import('./ws-replication-ac1-ac2-open.test.js');   // … ×7（ac1-ac2/ac3/ac4/ac5/ac6/ac7/periodic-reconcile）
// 末尾注册反空跑 describe（声明序即执行序，最后运行）：断言探针计数 ≥ 阈值 + 非 OPEN 缝入帧序列非 0
```

- **mock 安全（关键实现细节）**：别名 `@nomicore/ws-replication` 与相对路径 `../src/index.ts` 解析为**同一模块 id**（`vitest.config.ts:13`）⇒ mock 注册表按键命中两者。因此 `issue420-shim-hub.ts` **只准深路径 import**（`../src/hub-edge.js`、`../src/hub-session-host.js`、`../src/validate.js`、`../src/defaults.js`、`../src/types.js`），**禁止** import 包入口（否则在 mock 工厂内递归取 mock）。mock 工厂经 `importOriginal()` 取真面并展开，`createPeerReplication` 等保持真值（ac7 值导入不受影响，B10）。
- 矩阵文件零改动（AC3 硬门）；驱动器默认 `opts.createHub ?? createHubReplication`（`driver.ts:196,516`）吃到 mock；7 文件不传 `createHub`（B10 grep 核对）。
- **反空跑**：末位 describe 断言 `connectionsOpened ≥ 连接数`、`sessionsOpened ≥ 每连接每 ns ≥1`、缝内双向帧 ≥ 阈值、非 OPEN 入缝帧 wire 序非 0；负控 M4 = 关闭替换（指回 listen 工厂）时该断言必红（变异实跑登记交付说明）。
- 备选否决：(b) vitest 项目/别名——需新增项目配置（改根 `vitest.config.ts`，超出最小面）；(c) 矩阵参数化——需编辑 7 个矩阵文件（违反「断言逐字不变」的零改门）。

### D9 — 内部重命名（SA6 §12.6 授权编辑 2 + U1 + SA8 行 30）

| 文件 | 编辑（纯机械） |
| --- | --- |
| `src/hub-session.ts` | `createHubSessionHost`→`createHubSessionSink`（:291）；`HubSessionHostConfig`→`HubSessionSinkConfig`（:30）；删除 `export type HubSessionHost = HubSessionSink`（:42）；类 `HubSessionHostImpl`→`HubSessionSinkImpl`；头注补一行「公共 byte-seam 工厂见 hub-session-host.ts（内部复用本 splice）」 |
| `src/hub-connection.ts` | import（:18）与调用点（:449）跟随；头注 :6 名称跟随 |
| `src/hub-split.ts` | **仅头注**：:4-5「两工厂仅在 hub-edge.ts / hub-session.ts 模块级导出，绝不进 src/index.ts」更新为反映三工厂现状（edge/sink 模块级 + 公共 byte-seam 工厂经 index.ts；内部缝类型仍零运行时导出）。成员/类型零变化（R8'' 冻结面不动） |
| `test/…issue418-edge-session-split-structure.test.ts` | :13 注释、:39 导入、:421/:528/:571/:594 调用、:618 期望列表 → `['createHubSessionSink']`；其余断言逐字不变 |
| `test/…issue418-edge-session-split-contract.test.ts` | `FROZEN_PRODUCTION_EXPORTS` **插入** `'createHubSessionHost'`（字母序位于 `'createHubReplicationPlugin'` 与 `'createPeerReplication'` 之间——既有条目零删除零重排，`:551` 的 `Object.keys().sort()` 全等断言形态不变） |

重命名安全性背书：全量 588 tests + 结构测试绿（SA6 §12.6 论证承接）；`docs/**`/`CONTEXT.md` 对两名零引用（SA8 §2 grep）。

### D10 — RA1 文本修订计划（与实现同变更集或先行 documentation-only）

**E1 线（决策 2 缝词汇 + 决策 5 公共面降级登记）**——`docs/adr/0032` 澄清附录：四信号枚举句修订为「公共面载体映射（`close`/`terminateUnauthorized` = 句柄方法 ×2；`settled`/`connection-fatal` = `onSignal` JSON 事件；`closed` = `close()` promise）；`connection-fatal{code}` 自 HEAD 起即为通道→连接收口的既有内部信号（`hub-namespace.ts:662,1099`），公共化不新增 wire 面；code→close code 映射单点留 edge」；决策 5 补注登记 dormant 面（water gate 恒 true、`bufferedAmount` 缺席 → undefined、assembly per-session、namespace 域 observer 经工厂配置注入）及 U8 语义差（shim 无「暂停」可观察面——连接级总量保护收敛 edge + 1011 终局）。

**E2 线（决策 3 机制句 + CONTEXT.md:230 措辞）**——机制句修订为三载体并存陈述：(α) 内部进程内缝（#418 现状：结局以值过缝 + `openAdmission` 拉取）；(β) 公共字节缝（本票：ok-投影描述子传入；denied/throw 不过缝，由 edge 侧处置——**按 D6 形态定稿**）；(γ) 真 worker 形态（后续票，序回传机制另裁）。`CONTEXT.md:229-231`「SessionHost」词条补「公共工厂轨：`createHubSessionHost`（`open()` 描述子为纯 JSON，authorize 不在 session 侧调用）」并调和「消费 edge 传入的预授权投影」措辞（公共面 = 字面传入；内部缝 = 拉取）。

---

## 8. 接口、状态机和数据流

### 8.1 状态机（新增面只做投影，零 FSM）

- 协议 FSM 唯一实现在零 diff `hub-namespace.ts`（决策 1）；公共工厂不引入第二状态机。**重开矩阵（`onOpen`，`hub-namespace.ts:289-330`）也唯一在通道内**：桥的三分支路由只决定「OPEN 帧字节进哪份既有机械」，不解释通道状态、不合成应答（SA2-F1 修订不改变零 fork 结论）。
- 句柄本地状态（非协议态）：`open（句柄可用）→ closed`；迁移触发 = `close()` 调用或 connection-fatal 信号发射；幂等（close 尾单 promise）。
- adapterPort 连接投影：`'ready' → 'closed'`（同触发；供 `sendData` 门与 #231 诊断读取）。**头注登记（SA2 N3 采纳）**：投影面 = {ready, closed} 两态，非完整连接态（'handshaking'/'draining' 压平；行为面仅判 `==='closed'`，`hub-session.ts:211/:251`）。
- 桥路由相位（非协议态，仅 test 夹具内，D7）：`routing → authorized | denied`（互斥、单调、不可逆；closed 守卫可放弃在途 `routing`）；迁移触发 = admission 结局结算 + 续体同步段完成；无重入（再 OPEN 不回 `routing`）。

### 8.2 数据流路线

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R1 入站数据 | peer 发帧 → wire（内存 transport）→ 真 edge `onMessage` | edge `expectedSeq` 记账（单点） | `decodeInbound`（含 expectedSequence + capability 门）→ 路由键三案 → 内部缝 `openNamespace`/`namespaceFrame(message, seq)` | 无持久化；进程内调用 | 桥 → `encodeMessage(message,{sequence})`（E3 保真）→ `handleFrame(bytes)` → `decodeMessage`（无 expectedSequence）→ 通道 | 通道按序消费；wire 序进记账 | edge 解码失败 ⇒ `connectionFatal`（1002 族，B6）；桥 pending 溢出 ⇒ `CONNECTION_POLICY_VIOLATION`(1008) | A3/A8/C5a/C5b |
| R2 出站数据 | 通道 `sendControl/sendData`（组装后） | 内部 sink `encodePlaceholder`（seq=0） | adapterPort → listener `(frame,lane)`（字节 + lane 跨公共缝） | 同步宿主 pipe（无队列） | 桥 → `realPort.sendControlFrame/sendDataFrame` → edge `OutboundQueue.emitOne` 盖章 `[8..12]` → wire | wire 帧严格 +1；**返回序沿调用链同步回传**至通道记账 | listener 缺席 ⇒ 0（E1 臂 A/C 响亮）；listener throw ⇒ 同步传播；编码异常 ⇒ 既有 catch 收敛 | A5/A7/A8/A12/M1/M3 |
| R3 OPEN 准入 | 首个 OPEN 到达 | edge `beginAdmission`（台账 + 唯一真 authorize，先于投递，B3） | 台账 promise 多播：桥路由 + （denied 臂）denialSink 拉取 | 进程内 promise | 桥：authorized → `open(descriptor)`（纯 JSON 跨公共缝）+ OPEN 字节；denied/throw → denialSink | OPEN_OK 或 `NAMESPACE_UNAUTHORIZED`/`INTERNAL_ERROR`（生产通道产出） | throw ⇒ `INTERNAL_ERROR`；台账缺失 reject ⇒ 同（内部缝既有语义） | A4/deny 族/D6 |
| R3b 再 OPEN / 在途帧 | peer 再发 OPEN（同连接同 ns）或 admission 在途期任意 ns 域帧 → wire → edge（台账命中 ⇒ 零再授权、仍无条件投递，B16） | 桥 pending 窗口（相位 `routing`；≤16 帧/ns + 单帧限）或零写入（相位已定） | 相位三分支：① 既有句柄 `handleFrame(encode(message,{sequence:0}))`；② 入窗按到达序、路由完成后同步冲刷（OPEN 条目 = ① 形态，非 OPEN = wire 序透传）；③ `denialSink.openNamespace`/`namespaceFrame` | 进程内（无跨缝副作用） | 零 diff 通道 `onOpen` 重开矩阵（openWaiters 合流 / 立即再答 / `NAMESPACE_REOPEN_REQUIRES_RECONNECT`） | 与 listen 逐字节一致（`OPEN_OK`×2 / REOPEN 错误码 / authorize 恒恰一次） | 窗口溢出 ⇒ 1008 收口（E4）；续体非预期 throw ⇒ E10（1011 收口，无 unhandled rejection）；桥 closed ⇒ 放弃在途路由 | 矩阵 `:231/:245` shim 臂 + SA2-F1 验收（§12） |
| R4 控制信号 | 通道终态 / 通道收口请求 | adapterPort 信号发射（`settled`/`connection-fatal`） | 纯 JSON 跨公共缝（多监听） | 同步回调 | 桥 → `realPort.onChannelSettled` / `realPort.connectionFatal(code)` | drain 提前完成 / ERROR + close(1002) | 监听者 throw ⇒ 隔离（§9 E6）；幂等由通道单调性/edge closedFlag 承载 | A9/A10/A12 |
| R5 生命周期 | edge `requestSinkClose`/`revokeNamespace`；宿主 `handle.close()/terminateUnauthorized()` | 内部 sink close 尾 / 通道 terminate | 句柄方法（edge→session 信号）跨公共缝为方法调用 | — | 内部 sink → 通道 quiesce/cleanup | CLOSE 族帧 + lease release；幂等 | 重复调用同一 promise；无通道 no-op resolve | A9/A10/A11 |
| R6 观测 | 通道/edge 事件点 | namespace 域：adapterPort.`emitObserver`（session 侧 config.observer）；连接域：edge（不变） | `dispatchReplicationObserver` 单点隔离（B15，不分叉） | — | 注入的 observer | 事件族与 listen 一致（同 observer 实例双注入） | observer throw ⇒ 隔离，零协议外溢 | SA8 行 23 锚 |

无运行时持久化变化（本票零 Persistence/Registry 写路径变化；Registry open 走既有 lease 通道）。

---

## 9. 错误、恢复、并发和幂等

| # | 场景 | 设计行为 |
| --- | --- | --- |
| E1 | 出站 listener 返回 0（未发送/被拒） | 通道既有 0 值语义响亮失败：bootstrap ACK → `ACK_STATE_VIOLATION` 连接收口；live UPDATE → `resync-required{send-failed, send-frame-rejected}`（E1/A12/M1） |
| E2 | `handleFrame` 解码失败 | edge 已验证字节在会话侧不可解码 = 缝完整性破坏 ⇒ 发 `connection-fatal{code: err.code ?? 'MALFORMED_FRAME'}`（→ edge 1002 收口）。**无静默吞帧**（skill：正常路径不变量缺失 fail loud） |
| E3 | 入站连接级/方向域 kind | 静默（与内部 default 分支同构；edge 是唯一合法供帧方，出现即契约外） |
| E4 | 桥 pending 窗口溢出（S2） | `realPort.connectionFatal('CONNECTION_POLICY_VIOLATION', 1008)`；有界（每 ns ≤16 帧 + 单帧 ≤ maxFrameBytes），无静默丢弃。窗口承载相位 `routing` 期间到达的**全部** ns 域帧（含在途 OPEN，D7 ②） |
| E5 | `open()` 前置违反（空 connectionKey / 重复 (connectionKey, ns)） | 同步 throw（宿主契约违反，响亮；不在验收面）。桥按相位路由结构性不触发重复分支（SA2 ER6：`openNamespace` ① 不调 `open()`、② 入窗、③ 走 denialSink） |
| E6 | `onSignal`/observer 监听者 throw | 隔离（不改变协议状态、不逃逸到帧路径）——`dispatchReplicationObserver` 单点纪律；信号分发同款 try/catch 包裹 |
| E7 | `close()`/`terminateUnauthorized()` 重复调用 | 幂等：close 返回同一 promise（内部 sink closeTail）；terminate 无通道/终态 → no-op resolve |
| E8 | 并发 | 同步管道（`onFrame` 同步回传序）⇒ 无跨线程竞态；路由续体为单微任务（admission promise 结算后一次执行），pending 冲刷在续体内同步完成 ⇒ 到达序保真；相位互斥单调（D7）⇒ 承载机械无竞态；多监听 onSignal 只读；句柄替换 listener 后旧引用仅退订有效（后注册者替换，SA6 §12.1 冻结语义）；`(connectionKey, ns)` 唯一性由 E5 守卫 |
| E9 | 恢复/重试 | 无新增重试面；resync/reauth/revoke 走零 diff 通道与 edge 既有路径；真 worker 异步序回传恢复形态 = 后续票（U2/RA5） |
| E10 | 桥路由续体内非预期 throw（宿主契约外） | 续体整段 try/catch：`realPort.connectionFatal('INTERNAL_ERROR', 1011)` 响亮收口（§13.1 在册 + 协议 :415 映射）——**零无承载 reject**（edge 对 `sink.openNamespace` 返回 void；SA2-F1 故障面 ER7 的兜底，验收锚 = 同 run `collectUnhandledRejections()` 空）。首 OPEN 转发/冲刷的 `handleFrame` 为 fire-and-forget 且其解码失败已在 D2 内自收口（connection-fatal 信号），不外溢 throw |

---

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
| --- | --- | --- | --- | --- |
| `src/index.ts` 消费方（plugin.ts、nomic-server、外部宿主） | 11 运行时导出 + 类型 | **append-only**：+`createHubSessionHost` 值导出 + 7 类型导出；既有 11 名零变化 | 无（纯增量；C5a 全等断言仅插入一行） | `src/index.ts`；B12 |
| `src/hub-connection.ts`（listen 组合根） | `createHubSessionHost({port,…})` | `createHubSessionSink({port,…})`（重命名跟随） | 机械 2 处 + 头注 | `hub-connection.ts:6,18,449` |
| `src/hub-edge.ts` | 经 `sessionFactory(port)=>HubSessionSink` 消费：**每个到达的 OPEN（含台账命中的再 OPEN）都调用 `sink.openNamespace`；非 OPEN ns 域帧（台账命中）调 `sink.namespaceFrame`**（B16；SA2 §9 契约影响行） | **零改动**（sink 接口不变；denied 处置不进生产 edge——D6 备选否决 (i')）；桥侧承接面 = D7 三分支路由（`openNamespace`）/相位路由（`namespaceFrame`）——iteration 1 起全覆盖，无缺失分支 | 无（生产侧）；夹具侧见下行 | `hub-edge.ts:75,173,190-209,318-328,494-545` |
| 桥代理（`test/issue420-shim-hub.ts`，`HubSessionSink` 实现方 = edge 的直接调用方） | 不存在（新夹具） | 实现 sink 面：`openNamespace` 三分支 + `namespaceFrame`/`terminateNamespace`/`close` 相位路由（D7 路由表）；`dataFacetOf`/`channels` 委托 denialSink | 新建（ALLOW LIST 既有条目，非范围扩大） | D7；SA2 §9 首行 |
| `src/hub-namespace.ts`（通道） | 24 成员 channelHost 注入 | **零改动（硬门）**；新 adapterPort 提供同构注入面 | 无 | `hub-namespace.ts:52-100` |
| `src/testing.ts` | 测试面 5 导出 | 零改动（S5） | 无 | `src/testing.ts` |
| #418 两测试文件 | 冻结断言 | §12.6 授权的两处编辑 | 见 D9 表 | B12 |
| 其余 75 测试文件 | — | 零改动（矩阵 7 文件断言逐字不变，经 vi.mock 二次执行） | 无 | B10/B11 |
| nomic-server（未来宿主） | 仅 listen/插件面 | 获得工厂轨（本票不改 nomic-server；服务轨 = 后续票） | 无（非本票范围） | SA6 §10 调用方影响 |

---

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
| --- | --- | --- |
| `packages/ws-replication/src/hub-session-host.ts` | 新增 | D1/D2/D3/D4/D5：冻结公共面 + adapterPort（唯一新生产代码） |
| `packages/ws-replication/src/index.ts` | 追加导出（1 值 + 7 类型） | AC1/S5/append-only |
| `packages/ws-replication/src/hub-session.ts` | 重命名 + 别名删除 + 头注（零行为） | D9/U1 |
| `packages/ws-replication/src/hub-connection.ts` | import/调用/头注机械跟随 | D9 |
| `packages/ws-replication/src/hub-split.ts` | **仅头注**更新（成员/类型零变化） | D9（注释真实性） |
| `packages/ws-replication/test/issue420-shim-hub.ts` | 新增（夹具：桥 + shim hub + 探针） | D6/D7；仅深路径 import（D8 mock 安全） |
| `packages/ws-replication/test/ws-replication-issue420-session-host-api.test-d.ts` | 新增 | AC1 类型冻结（SA6 §12.1 正控 + 负控全集） |
| `packages/ws-replication/test/ws-replication-issue420-session-host-round.test.ts` | 新增 | AC2（A1–A12）+ AC5（C5a/C5b） |
| `packages/ws-replication/test/ws-replication-issue420-shim-matrix.test.ts` | 新增 | AC3 机制 (a) + 反空跑 |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts` | `FROZEN_PRODUCTION_EXPORTS` 插入一行 | SA6 §12.6 授权编辑 1 |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-structure.test.ts` | :13/:39/:421/:528/:571/:594/:618 机械跟随 | SA6 §12.6 授权编辑 2 |
| `docs/adr/0032-transport-decoupling-edge-session-split.md` | 澄清附录（E1/E2 线） | RA1（docs/AGENTS.md：显式修订，不静默矛盾） |
| `CONTEXT.md` | :229-231「SessionHost」词条更新 | RA1/E2 |

> **交付说明登记（SA2 N2 采纳）**：`hub-split.ts` 仅头注更新一项不在 SA6 §10 交付面清单内——实现交付说明须单列该 diff 并援引本表理由（注释真实性：「绝不进 src/index.ts」陈述被本票推翻）；「diff 需逐项论证」纪律延伸。**SA2-F1 修订不改变文件范围**：三分支路由落在既有夹具文件 `test/issue420-shim-hub.ts` 内，无新增路径。

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
| --- | --- | --- |
| `packages/ws-replication/src/hub-namespace.ts` | 通道 FSM | **逐字节零 diff**（AC3 硬门 / R8'' DENY 面） |
| `packages/ws-replication/src/hub-edge.ts` | 连接级半边 | 设计要求零改动（denied 处置走 D6 桥路由；改动即 listen 行为分叉风险） |
| `packages/ws-replication/src/testing.ts` | 测试面 | S5（夹具不进 /testing） |
| `packages/ws-replication/src/{frame-io,backpressure,round-engine,update-channel,update-transfer,bulk-transfer,liveness,observer,validate,defaults,types,plugin,error-mapping,fence-watchdog,lifecycle-queue,peer-connection,peer-namespace}.ts` | 既有单点 | 设计不需要任何改动（全部经复用/注入；SA6 §10「diff 需逐项论证」——本设计论证为零 diff） |
| `docs/protocols/instance-replication-v1.md` | wire 契约 | 零 wire/错误码/事件变化（SA8 §5 冻结面） |
| `packages/ws-replication/test/ws-replication-ac{1,2,3,4,5,6,7}-*.test.ts`、`ws-replication-periodic-reconcile.test.ts` | AC3 矩阵 | 断言逐字不变（机制 (a) 下零编辑） |
| 其余既有测试文件 | 回归面 | §12.6 授权编辑之外零改动 |
| `packages/replication-protocol/**`、`packages/namespace-registry/**`、`apps/**`、`domains/**` | 上游/宿主 | 零依赖变化；宿主接线 = 后续票 |
| `packages/ws-replication/package.json` | 包面 | 零新依赖（AC4：零 worker_threads/MessageChannel/MessagePort 依赖或类型——C4a 保持 0 命中） |

---

## 12. 验收与验证映射

运行命令（实现后逐条执行并登记日志；SA6 §12.0）：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/ws-replication/test`、聚焦三新文件各一跑、`pnpm exec tsc -p packages/ws-replication/tsconfig.json`、根 `pnpm test` + `pnpm typecheck`。纪律：禁 skip/only/todo、env override、fallback、吞错、软化断言。

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
| --- | --- | --- | --- |
| AC1 签名锁定 | SA6 `type-lock-red.log`（8×TS2305 + 3 TypeCheckError = 红） | `…session-host-api.test-d.ts`：SA6 §12.1 正控全集（含 `authorization` 精确等于 ok-投影、`connectionId: string\|undefined`、listener 返回 number）+ 负控 `@ts-expect-error` 四项（denied 描述子 / 配置掺 authorize/transport/port / `namespaceFrame` 面缺席 / `onFrame(()=>undefined)`）；运行时导出面由 C5a 插入行承载 | 全绿；负控指令全部被触发（未用即 TS2578 红） |
| AC2 完整回合 | `runner-trigger-red.log`（能力门红 + 负控 2 绿） | `…session-host-round.test.ts`（D7 夹具装配：真 peer ↔ makeWire ↔ 真 edge + 桥 + 公共工厂 + 真 Registry）：A1 能力门；A2 描述子 `structuredClone` 深等 + 缝内 `instanceof Uint8Array` + sink 返回 number；A3 kind 全集 ⊆ namespace 域；A4 OPEN_OK 恰一 + `run.authorizer.calls.length===1` + **W2 修正负控**（描述子 localOwner 换 PEER_OWNER → 无 OPEN_OK + `NAMESPACE_NOT_FOUND` + 注册表零打开）；A5 BOOTSTRAP_SNAPSHOT 恰一 + BOOTSTRAP_ACK(acked=快照帧序) + `bootstrapping→reconciling`；A6 SYNC_STEP1/2/APPLIED + 双侧 `encodeStateAsUpdate` 收敛；A7 双向 UPDATE + UPDATE_ACK 回指 + `update-acked` + 零 resync；A8 wire `[8..12]` 自 1 严格 +1 无 0 泄漏 + **出站缝帧占位 0 / 入站非 OPEN 帧带 wire 序（W1/RA4 修正读法）**；A9 CLOSE_OK 回指 + settled 恰一次；A10 `handle.terminateUnauthorized()` → 双方终态 + 零 connection-fatal；A11 `hub.close()` resolve + `collectUnhandledRejections` 空；A12 红臂（桥 sink 强制返回 0 → 断言观察到 `ACK_STATE_VIOLATION` 收口） | 全绿（A12 = 断言绿/回合红） |
| AC3 shim 矩阵重跑 | `baseline-matrix.log`（listen 52 tests 绿） | D8 机制 (a)：7 文件断言体零改动二次执行 + 末位反空跑（计数阈值 + 非 OPEN 入缝序非 0）。**再 OPEN 原生覆盖（SA2-F1）**：`ac1-ac2-open.test.ts:231`（opening 中重复 OPEN → `OPEN_OK`×2 + authorize 恰一次）与 `:245`（conflicted 后同连接再 OPEN → `NAMESPACE_REOPEN_REQUIRES_RECONNECT`）两用例在 shim 臂**断言逐字不变**执行；同 run `collectUnhandledRejections()` 为空（A11 同款采集，覆盖路由续体 E10 面） | listen 52 保持绿 + shim 臂同场景数全绿（含再 OPEN 两用例）+ 反空跑绿 + 零 unhandled rejection；`git diff` 中 `hub-namespace.ts` 零 diff |
| AC4 缝纯度 | `seam-purity-gate-probe.log`（结构门 0 命中） | C4a 结构扫描（源码 + package.json，单一模式常量，测试内 `node:fs`）保持；C4b/C4c/C4d 行为断言（A2 承载 + 夹具记录无 live 对象过缝） | 全绿且结构门 0 命中 |
| AC5 session 零重检 | `sequence-discipline-probe.log`（E2 双臂已证） | C5a（主）：live 后经 `handleFrame` 投递回退序 CLOSE_NAMESPACE(seq=2，此前已消费 5) → 仍被消费 + CLOSE_OK{ackedSequence:2} + 零 fatal；C5b：同非法序在 edge → `SEQUENCE_VIOLATION` + close(1002) + 零缝投递；C5c：`hub-session-host.ts` 解码调用无 `expectedSequence`；C5d=M5 | 全绿 |
| 变异敏感性 M1–M7 | E1（M1 机制已证）、M6 = 当前 HEAD、M7 = iteration 0 缺陷本身 | M1 桥 sink 返回 0（A5/A7 红）；M2 桥丢 OPEN（A4 红）；M3 桥自分配序（A8 红）；M4 关闭替换（反空跑红）；M5 session 解码加 expectedSequence（C5a 红）；M6 去导出（AC1/AC2 红）；**M7 桥 `openNamespace` 退化为无条件 `host.open()` 路由（= iteration 0 SA2-F1 缺陷）——矩阵 `:231/:245` shim 臂红 + `collectUnhandledRejections()` 非空** | 交付说明登记实跑结果 |
| D6 拒绝路径 | B13/B3/B4 | deny/readDeny/submitDeny 臂（矩阵 ac1-ac2 在 shim 臂重跑即覆盖）+ 回合测试可选直接臂 | `NAMESPACE_UNAUTHORIZED`×1（真通道产出）+ authorize 恰一次 + 注册表零打开 |
| **SA2-F1 再 OPEN / 在途 OPEN 路由** | B16（本轮源码亲验：edge 无条件投递 + 通道 `onOpen` 重开矩阵 + channels 零删除）+ SA2 §7 SM1/SM12、§8 ER6/ER7 | 主判据 = AC3 shim 臂原生承载（矩阵 `:231/:245` 断言逐字不变，见上行）；可选直接臂 = 回合测试在 authorize 门闩下经 `injectPeerFrame` 注入第二 OPEN（相位 `routing` 入窗 → 冲刷 → `OPEN_OK`×2）与 conflicted 后再 OPEN（相位 `authorized` 转发 → `NAMESPACE_REOPEN_REQUIRES_RECONNECT`）；负向不变量 = 同 run 零 unhandled rejection + `sessionsOpened` 每 (连接,ns) 恰 1（再 OPEN 不重开公共句柄） | 三分支全部可达且与 listen 逐字节一致；`reopenForwarded`/`pendingFlushed` 探针计数与用例数吻合；C5a/结构测试不受影响（SA2-F1 验收列） |
| RA1 文本 | SA8 §6 要素表 | 附录 + 词条 diff 与实现同变更集 | docs 变更在 PR 内可审 |

---

## 13. 风险、回滚和残余问题

| # | 风险/残余 | 评估与缓解 |
| --- | --- | --- |
| R1 | 公共面一经 test-d 锁定即 append-only（S6）——签名错误永久化 | 签名逐字采用已批准 SA6 冻结声明（§7 D1）；SA8 design 复查在实现前再核一次；后续演进只能追加（RA5） |
| R2 | 重命名回归 | 纯机械（5 文件、影响面 grep 封闭：`hub-connection.ts` + #418 结构测试）；全量 588 tests + typecheck 背书；回滚 = revert 单提交 |
| R3 | `vi.mock` 递归/别名自命中 | D8 mock 安全纪律：夹具仅深路径 import；mock 工厂经 `importOriginal` 展开真面。若 runner 仍自命中（异常形态），退路 = 机制 (b)（项目别名），需 Controller 批准扩大 ALLOW LIST（改根 vitest.config.ts）——**不在本设计默认面内** |
| R4 | 桥 accept 早到帧竞态（HELLO 先于 verifyToken 结算） | 有界早到帧缓冲 + edge 构造尾重放（`earlyFrames` 既有纪律镜像）；矩阵/回合均不触溢出路径 |
| R5 | C5a 时序（注入帧须在发送方静默窗口） | 沿用 `injectPeer`/手工注入纪律（`driver.ts:367-385` 同款不变量注记）；回合测试在 A9 之后单独用例执行 |
| R6 | `selectedCapabilities` 来源受内部 port 单 bit 面限制 | 登记（D7）：多 bit capability 未来需扩内部 port 面 ⇒ R8'' 重触发 + 公共面 append-only；本票宇宙内等价 |
| R7 | shim 形态下 authorized 通道不投影到 `edge.channels`（白盒锚 = listen 专属） | 7 矩阵文件与回合测试均不读取（B10）；登记为 shim 观测边界，非行为差异 |
| R8 | U2 真 worker 异步序回传形态未解 | 明示非目标（RA5 跨票登记）；本票不得声称解决 |
| R9 | U8 water-gate 语义差（shim 无「暂停」可观察） | 决策 5 已接受；7 矩阵不含 backpressure/shed 族（issue137/169 不在重跑面）；D10 附录显式登记 |
| R10 | W2（A4 负控措辞）——SA8 design 复查已确认修正读法（行 16/RA4'） | 悬置消除：测试按 `NAMESPACE_NOT_FOUND` 断言落；shim 与 listen 行为逐字节相同（B13 单点决定）；无设计结构变化 |
| R11 | 在途路由期 revoke/corner：listen 形态下 revoke 命中 'opening' 通道立即发 ns ERROR；shim 相位 `routing` 只能挂起至路由完成（D7 `terminateNamespace` 行）——wire 时序可能相对 listen 偏移 | AC3 七矩阵零 revoke 用例（grep 核对）、A10 为 live 后直调，均不触及；登记为 shim 观测边界（同 R7 类别），非行为差异主张；未来矩阵若加该场景须先扩设计 |
| R12 | 桥 accept 门链保真度（SA2 N1）：单微任务让位（`hub-connection.ts:309`）、门 5 次序纪律（:317-331）、`rejectUpgrade`/`emitUpgradeRejected` 事件面未逐门镜像 | 当前 7 矩阵 + AC2 回合均不触这些路径（`makeWire` 微任务投递不丢帧）；夹具头注登记差异清单（D7 探针段采纳），防止未来把夹具误当规范宿主样例 |
| 回滚条件 | 任一授权编辑引入非机械 diff；`hub-namespace.ts` 出现 diff；全量套件/typecheck 红 | 整票回滚（单 PR 变更集，无数据迁移、无持久化兼容面） |

**任务内必要条件（非 follow-up）**：D1–D10 全部、ALLOW LIST 全部、RA1 附录。**明确 follow-up**：服务轨（`listen:false` 插件 + `nomicoreHubSessionHost`）、peer 侧拆分、真 worker 异步 pipe、跨进程 revoke 全链路、nomic-server 宿主接线。

---

## 14. 评审修订映射

评审输入：`wiki/raw/task_issue-420_sa2_review.md`（iteration 0 设计的攻击评审，verdict **reject**，1 × MAJOR）。本 iteration 1 逐条落实：

| Finding | 修订位置 | 处理结果 |
| --- | --- | --- |
| **SA2-F1（MAJOR）**：D7 桥 `openNamespace` 缺「同连接再 OPEN / authorized 在途 OPEN」分支——iteration 0 文本会把再 OPEN 无条件重入 authorized 路由再调 `host.open()`，命中 D1 重复前置 throw 且发生在异步续体（无承载 reject），重开矩阵断裂 ⇒ AC3 shim 臂 `ac1-ac2` `:231/:245` 必红 | §7 D7（核心重写：每 (connectionKey, ns) 路由相位表 + `openNamespace` 三分支路由行 + 路由续体含 E10 容错；`namespaceFrame`/`close`/`terminateNamespace` 行按相位统一）；§7 D6（资源账补「OPEN 帧可多次到达…零二次授权语义」句）；§2 新增 B16（再 OPEN 投递语义源码锚）；§5 承接表新增 SA2-F1 行；§8.1（桥路由相位投影 + 重开矩阵唯一在通道的零 fork 重申）；§8.2 新增 R3b 数据流；§9 E4/E5/E8 更新 + E10 新增；§12 AC3 行补再 OPEN 原生覆盖 + 新增 SA2-F1 验收行；§13 R11/R12 | **已落实**。required change 三项全采：① 句柄在场 → 不再调 `open()`、OPEN 帧字节经既有句柄 `handleFrame` 转发（与首 OPEN 同形态）；② authorized 在途 → OPEN 帧入与 `namespaceFrame` 同一有界 pending 窗口、按到达序在 `open()` 完成 + 首 OPEN 转发后冲刷；③ denied/throw → 维持投递 `denialSink.openNamespace` 并明示（通道在场时 `onOpen` 自然承接）。D6 资源账补句、§12 AC3 登记均按评审要求落。附加防御（超评审最低要求，均不触决策面）：路由续体 try/catch 兜底（E10，`INTERNAL_ERROR`/1011 在册码）、桥 closed 在途守卫、`terminateNamespace` 相位挂起 + R11 登记。验收对齐评审 Acceptance 列：`:231`/`:245` 两用例 shim 臂断言逐字不变全绿（`OPEN_OK`×2 / `NAMESPACE_REOPEN_REQUIRES_RECONNECT`）+ 同 run `collectUnhandledRejections()` 空 + C5a/结构测试不受影响 |
| N1（非阻断）：桥 accept 门链保真度差异未列（微任务让位/门 5 次序/rejectUpgrade 事件面） | §7 D7 探针段（夹具头注登记差异清单）+ §13 R12 | 采纳为登记项（当前验收面不触；防未来误当规范宿主样例） |
| N2（非阻断）：`hub-split.ts` 仅头注不在 SA6 §10 交付面 | §11 ALLOW LIST 后注 | 采纳：交付说明单列登记 |
| N3（非阻断）：`connectionState()` 投影把 handshaking/draining 压平为 ready | §8.1（头注登记两态投影面） | 采纳为登记项（行为面仅判 `==='closed'` 已核） |
| N4（非阻断）：W2 修正属流程义务 | §5 W2 行 + §6/§15 | 维持登记；SA8 design 复查已确认（RA4'），悬置消除 |
| N5（非阻断）：`selectedCapabilities` 单 bit 反推 | §13 R6（既有）+ D7 字段来源段（既有登记） | 维持登记（R6/R8'' 重触发条款不变） |
| N6（非阻断）：A2 纯 JSON 判据依赖 ok-投影形状保持 JSON-safe | §12 AC1/AC4 行（test-d `Extract` 精确型 + C4b 敏感性，既有） | 维持（敏感性断言已在验收面） |

---

## 15. 设计后 ADR 冲突复查

**状态更新（iteration 1）**：design 段复查**已完成**——`task_issue-420_design_conflict_report.md`（verdict **clear**，30 项对照：18 no-conflict / 10 implements / 2 evolution-required / 0 hard-conflict，RA1'–RA5'）。本修订（SA2-F1）**不触发新的 design 段复查输入**：SA2 评审结论明文「F1 不触决策面；W2 确认属已武装的 SA8 design 复查段」（其 §14）；本修订未改公共冻结签名、DENY 面、port 成员集、U3 裁决方向、RA1 附录要素——SA8 design 复查的 30 项对照对象中受 touch 的仅 D7 桥形态（行 9「桥 pending 窗口 + 溢出收口」与行 25「组合成员零重塑」的兑现细节），修订方向 = 收紧而非放宽（再 OPEN 补路由分支使 shim 更贴近 listen 语义），无新决策面。

**需要 implementation 段复查（`requiresConflictRecheck: true` 维持）**。理由（skill 触发条件逐条，与 SA8 design 报告 §10 同口径）：

1. **新公共 API 面**：工厂 + 句柄 + 信号类型一经 test-d 锁定即 append-only 冻结（S6/SA8 §10(1)）。
2. **生命周期/失败语义面**：`close`/`terminateUnauthorized`/`connection-fatal`/序回传 0 值语义 + 本修订新增的桥路由相位/在途守卫/E10 兜底待实现核对（SA8 §10(2)）。
3. **触碰 ADR 冻结文本**：RA1 附录修订 ADR 0032 + CONTEXT.md（SA8 §10(3)）；D6 的 U3 裁决已经 design 复查确认（行 7）。
4. **R5''/R8'' 重触发面**：入站缝形态已改（本设计）、port 成员/决策文本 diff 后须 implementation 复查（SA8 §10(4)）；RA3' 清单增补核对项 = 三分支路由落地 + 再 OPEN 两用例 shim 臂实跑绿 + 零 unhandled rejection。
5. ~~W2 新措辞修正提请确认~~ 已确认（design 复查行 16/RA4'）。

SA1 产出设计，不承担冲突裁决；implementation 段复查由 SA8 产物 `task_issue-420_implementation_conflict_report.md` 承接（触发条件三合一将在实现后成立，SA8 design 报告 §10 明示）。
