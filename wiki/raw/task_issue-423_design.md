# SA1 实现设计 — issue #423（spec #415 T6）：observer 发射点拆分与降级口径

- 上游输入：`wiki/raw/task_issue-423.md`（任务简报）、`wiki/raw/task_issue-423_sa6_contract.md`（SA6 诊断与验收契约，verdict = approve）、
  `packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts`（红灯契约，21 用例，3 红 / 18 绿）。
- 基线 HEAD：`1f5809b001c984e63fac3bafd4c1f3febc76e8a8`（`mabf/issue-423`；#421 已合并）。
- SA8 / SA2 产物：**不存在**（iteration 0，`ls wiki/raw` 核对无 `task_issue-423_relevant_decisions.md` / `_conflict_report.md` / `_sa2_review.md`）。
  约束面以 ADR 0032 + 协议 §23 替代承接（见 §SA8 约束落实）；无评审输入，故无评审修订映射章。

---

## 1. 任务类型、目标与非目标

**类型**：Feature（观测面能力缺口）内含一处字段面 Bug——与 SA6 §1 判定一致，两缺口共存、逐条标注。

| 缺口 | 型 | 一句话 |
|---|---|---|
| 缺口 A | Bug（#421 已交付面的字段缺口，本票 AC3 收口） | 工厂（分片）形态授权拒绝路径的 `namespace-error{sent}` / `namespace-failed{open-failed}` 缺 `connectionId`，与单体形态字段集不一致 |
| 缺口 B | Feature（简报 What-to-build 明文） | `update-sent`（family 中唯一携盖章后 `sequence` 者）今天由 session 发射；edge（盖章事实所有者）侧零观测面 |

**目标**（全部由既有红灯契约 `ws-replication-issue423-observer-emission-split.test.ts` 锚定，本设计不新增验收语义）：

1. 缺口 A：edge 复刻拒绝/合成路径的三个发射点按「在场即携带」纪律补 `connectionId`（值 = 端口 `connectionId()` = 句柄 `connectionKey`）。
2. 缺口 B：`update-sent` 的发射点迁到 edge 侧单点（连接级 data 帧出面），恰一（session 侧零发射）、
   `sequence` = wire `[8..12]`、`bytes` = 出站 UPDATE 载荷长度、`namespaceId` = 帧路由键；
   listen 形态 `sendQueueMs` append-only 保留；宿主直驱 data 帧 `sendQueueMs` 整键缺席。
3. AC5 文档面：`maxConcurrentAssembliesPerConnection` 分片形态 per-session 口径 + 发射侧归属表写入协议与 ADR 对应章节；listen 计数口径不变（EM-C6 回归锚，运行时零改动）。

**非目标**：

- 零 wire 变更、零新事件型、零新事件字段、零新错误码、零公共 API 变化（`src/index.ts` / `src/testing.ts` 零改动；§23.1 冻结字段表零编辑）。
- peer 侧不拆分（ADR 0032：44「peer 侧对称拆分…本期 non-goal」）——peer 的 `update-sent` 发射点（`peer-namespace.ts onUpdateSent`）**原样保留**。
- 「update-sent 族」全域搬迁：`chunked-update-sent` / `bootstrap-snapshot-sent` / `sync-step2-sent`（均无 `sequence` 键，结算事实在 session）不迁（裁决见 D4）。
- 分片形态 per-session 计数的**运行时**实现与运行时锚：依赖 T3(#420)/T5(#422)（SA6 U4），本票交付文档面。
- 观察者隔离、缺面 dormant 既有语义、listen 计数行为：不变（EM-C3/EM-C5/EM-C6 全绿保持）。

## 2. 当前行为与证据锚点

### 2.1 缺口 A 现场（工厂形态拒绝路径）

| 事实 | 锚点 |
|---|---|
| edge 复刻拒绝路径的三个发射点构造事件时无 `connectionId` 成员 | `packages/ws-replication/src/hub-edge-host.ts:614-625`（`emitNamespaceErrorSent`）、`:627-635`（`emitNamespaceFailed`）、`:597-612`（`synthesizeStateViolation`，no-sink 合成违例路径） |
| 端口已有 `connectionId()`（值 = edge `connectionIdValue`，HELLO 完成时置位） | `hub-split.ts:91-92`（缝成员）；`hub-edge.ts:242`（实现）、`hub-edge.ts:441`（HELLO 置位 = `${instanceId}-conn-${counter}`） |
| `connectionKey` 与 observability `connectionId` 同串（单一键系统） | `hub-edge-host.ts:900-909`（`allocate` 注释 + 构造）；EM-C2a 断言 `connectionId === connection.connectionKey` |
| 单体（listen）同协议路径两事件**在场携带**（形状 = `cidField(this.host.connectionId())` 条件展开） | `hub-namespace.ts:483-503`（`finishOpenError` → `emitNsErrorSent` + `emitNamespaceFailed`）、`hub-namespace.ts:1696-1706`、`hub-namespace.ts:1820` 一带；`observer.ts:113-117`（`cidField` 单点） |
| edge 自身的 R-none 合成已按在场纪律携带 | `hub-edge.ts:570-586`（`synthesizeNamespaceStateViolation`：`...(connectionIdValue !== undefined ? { connectionId } : {})`）——host 适配器的同名复刻是唯一漏点 |
| pre-connection `auth-upgrade-rejected` 无 `connectionId` 是 §23.3 文档化形态（非缺口） | `hub-edge-host.ts:775-790`；协议 §23.1 auth 行「pre-connection：无 connectionId 字段」；EM-C2c 负控锚定 |

### 2.2 缺口 B 现场（`update-sent` 发射侧错位）

| 事实 | 锚点 |
|---|---|
| 盖章单点 = `OutboundQueue.emitOne` 重写帧字节 `[8..12]`（大端，per-connection 自 1 严格递增；控制/数据、连接级/namespace 域共用） | `frame-io.ts:184-197`（`:192` `writeBe32At(bytes, 8, sequence)`）；`frame-io.ts:200-206` |
| hub 侧全部 data 帧（UPDATE / UPDATE_CHUNK / 分块族）经**唯一漏斗** `HubSessionEdgePort.sendDataFrame` | `hub-edge.ts:217`（port 实现 → `sender.tryEmitDataFrame`）；调用方：`hub-session.ts:210-216`（`sendData`）、`:220-254`（`sendUpdateChunk`）、`hub-edge-host.ts:684-693`（工厂 egress）；消息形态 `sender.tryEmitData` 仅 peer 使用（`peer-connection.ts:798-841`），hub 零调用 |
| session 半边今天发射 `update-sent`：`UpdateChannel.sendAndRegister` 在 send 返回后采样 `sentAt`、算 `sendQueueMs`、`noteUpdateSent` → `HubNamespaceChannel.onUpdateSent` → `host.emitObserver`（经 `port.emitObserver` 仍是 edge 单点 dispatch，但事件对象由 session 构造） | `update-channel.ts:346-371`（seq / sentAt / inFlight / sendQueueMs / noteUpdateSent）；`hub-namespace.ts:1375-1405`（`onUpdateSent`：普通族 `update-sent` + `chunked-update-sent` 改道）；`hub-namespace.ts:1330`（`host.sendData` 调用点） |
| `sendQueueMs` 口径 = 帧出队时刻 − 帧内最旧业务项入队时刻（session 时钟域差值；clock 缺省/无 observer ⇒ undefined ⇒ 键缺席） | `update-channel.ts:356-370`、`:417-419`（合并帧取 `items[0].queuedAt`）；协议 §23.1 `update-sent` 行、§23.4；`hub-edge.ts:245-249`（`port.now` = observer 门 + `safeNow` 折叠） |
| 工厂形态宿主直驱 data 帧：宿主 sink 无 observer 面、无 session 记账——edge 对出站 sequence 事实零观测 | `hub-edge-host.ts:684-693`（egress）；SA6 实测 A1（host 数据帧 → edge 零事件）；EM-C4a 红 |
| envelope 布局：`[5]` = messageType（UPDATE=0x40 / UPDATE_ACK=0x41 / UPDATE_CHUNK=0x42），`[8..12]` sequence，`[12..16]` payloadLength，payload 自 `[20]` 起；namespace 域帧 id 长度前缀 `[20]`=35、id 窗口 `[21,56)`（半开；UPDATE_CHUNK 因 kind 首字段在 `[22,57)`）；UPDATE payload = namespaceId varString + update varUint8Array（varUint 长度前缀 + 字节，前缀起于偏移 56） | `replication-protocol/src/envelope.ts:172-186`、`constants.ts:14-18`；`messages.ts:61-63`（码值，公共导出 `MESSAGE_TYPES`，`index.ts:24-52`）；协议 §3/§5/§10.1；`hub-edge.ts:553-567`（`routingKeyOf` 同窗口先例，ADR 决策 4「定偏移只读提取，不解析 payload」） |
| listen 形态 = edge + session 进程内组合（缝 = 函数调用），observer/clock 自组合根同实例注入两侧 | `hub-connection.ts:324-358`（`createEdge` 组合）；`hub-session.ts:78`（`now: () => port.now?.()`——session 时钟即 edge 时钟，同域） |
| 事件隔离/缺面/金标既有面全绿（本设计不得回退） | SA6 §13 S0/S2/S5：EM-C1a-e / C2b / C2c / C3a-d / C5a / C5b / C6a / C6b / C7a / C7b 绿；拆分前金标 = `e9cd7eb` 采集（EM-C7 常量） |

### 2.3 既有测试对 `update-sent` 的依赖面（实现后必须保持绿）

- `ws-replication-issue238-segmented-observation.test.ts:244-245`：listen 形态断言 `sendQueueMs` **精确值** `[0, 4_000]`（ManualMonotonicClock，仅显式 `advance()` 推进——同步栈内零时钟推进，见 §D3 采样点论证）。
- `ws-replication-observer-red.test.ts:477-497, 1236`：hub/peer 双侧 `update-sent` 键集白名单 `['type','side','connectionId','namespaceId','bytes','sequence','sendQueueMs']` 与 wire 载荷一致断言（listen 形态）。
- `ws-replication-issue238-repro.test.ts`、`ws-replication-issue230-incremental-mutation.test.ts`：listen 形态 `update-sent` 序列关联断言。
- `ws-replication-issue245-ac-red.test.ts` / `ws-replication-issue243-*`：`chunked-update-sent`（本设计不迁移，session 侧原样）。
- #418/#421 套件对拒绝事件按 type/code 投影断言（`ws-replication-issue418-pending-window-matrix.test.ts:271-639`、`issue421-open-admission-pipeline.test.ts:343-360`、`issue418-edge-session-split-structure.test.ts:535-555`）——无精确键集钉死（grep 核对 `Object.keys`/`sort` 断言零命中）；补 `connectionId` 不触红。
- 独立 session 半边对 `update-sent` 的断言：仅 EM-C4b（红灯本体，转绿目标）。

## 3. 根因 / 能力缺口（承接 SA6 §8）

| 项 | SA6 结论 | 设计承接 |
|---|---|---|
| 缺口 A 根因 | edge 公共出面的观测复刻面只对齐了「事件型/必填字段」，未对齐 §23.3 **在场纪律**（edge 端口已有 `connectionId()`，复刻点未消费） | §D1：三发射点统一经 `cidField(this.port.connectionId())` 投影 |
| 缺口 B 能力缺口 | 「事实所有者 ≠ 发射者」：sequence 由 edge 在 mux 点盖章，事件却由拿到返回值的 session 发射；分片形态下宿主 sink 无 observer，edge 侧零观测面 | §D2/D3/D4：发射点迁 edge data 帧出面 + 缝上 append-only 记账投影 + session 抑制 |
| 设计约束（SA6 §8.2 U2） | `sendQueueMs` 在 send **之后**才算得出 ⇒ edge 需经 append-only 的 send-accounting 投影（纯 JSON）或等价 edge 可判事实才能不丢字段发射；朴素搬运被 EM-C4c/C7a 拦（E2） | §D3：session 侧预计算差值经缝可选参数携带（采样点前移至发送调用边界，同一同步栈 ⇒ 手动时钟域逐值不变） |
| 作用域裁决（SA6 §11 H3 / §15 U1） | 简报限定语「依赖盖章后 sequence 的」⇒ family 中唯一携 `sequence` 键的 `update-sent`；chunked 族排除 | §D4 采纳并给出独立论证（键集事实 + 事实归属 + R21 改道域） |

## 4. Owner要求落实

**无 owner 要求**：issue #423 comments = 0（Host 简报明文「No owner requirements apply: REST comment read returned []」；SA6 §2 以 `gh issue view 423 --json comments` 复核一致）。

| Comment ID | Updated at | Requirement | Design section |
|---|---|---|---|
| ——（无评论） | —— | 无 | 全部需求源自简报 AC + ADR 0032 决策 5 + 协议 §23（映射见 §12 验收表） |

## 5. 复现和根因承接

| 上游事实 | 证据位置 | 设计响应 |
|---|---|---|
| 契约 3 红稳定复现（5 轮同集合）：`{EM-C2a, EM-C4a, EM-C4b}` | SA6 §13 S0；证据日志 `artifacts/sa6-issue423-contract-evidence.log` | 三红逐一由 §D1（C2a）、§D2+D5（C4a）、§D4（C4b）落绿；不软化断言 |
| M1（补 `connectionId`）⇒ 仅 EM-C2a 转绿、其余 19 绿保持 | SA6 §9 E7 | §D1 的改动面 = M1 的定型化（三发射点 + `cidField` 单点化），无连带失败 |
| M3+M4（朴素搬发射点）⇒ EM-C4a/b 转绿、EM-C4c/C7a 红（`sendQueueMs` 丢失、金标键集变化） | SA6 §9 E2 | §D3 承载机制就是为消解该红灯：缝投影携带差值 ⇒ listen 形态键集/在场与金标逐字一致 |
| AC6 基线绿：拆分未漂移（`e9cd7eb` vs HEAD 结构序列逐字相等） | SA6 §9 E3 / §13 S2 | 设计保证组合形态事件**键集与次序**不变（§D2.5、§D3.4），金标继续成立 |
| 缺面 dormant 断言敏感（M6 ⇒ EM-C3a 红）；listen 计数锚定 `limits` 键（M5 ⇒ EM-C6a 红）；隔离单点敏感（M2 ⇒ EM-C5a/b 红） | SA6 §9 E4/E5/E6 | 本设计零触碰 `sendFailureContext` / `tryBeginInboundAssembly` / `dispatchReplicationObserver` 三面（DENY LIST） |
| HEAD 上游事实与源码矛盾：未发现（SA6 引用的行号/符号与本次源码核对一致） | §2 锚点复核 | 无需矛盾登记 |

## 6. SA8约束落实

SA8 产物不存在（iteration 0）。以下以规范约束面替代（skill 纪律：缺 SA8 ⇒ 读取相关 ADR 并标记设计后冲突复查）：

| 决议或义务 | 来源 | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|---|
| 发射点 = 拥有事实的一侧：连接域 + 出站 sequence 事件在 **edge**，namespace 域事件在 session；字段集 append-only 不变 | ADR 0032 决策 5（:30） | §D2（edge 发射）、§D4（session 抑制与归属划分） | **实现**该决策（现状代码偏离 ADR，本票对齐）；零字段集变化 | 是（见 §15） |
| 缝只过 `Uint8Array` 帧 + 纯 JSON；四控制信号；连接级帧不上缝 | ADR 0032 决策 2（:18）、`hub-split.ts:7-22` | §D3 | 记账投影 = 纯 JSON 可选参数（有限数值差值），append-only；零新控制信号、零帧形态变化 | 是（缝签名 append） |
| 路由键定偏移提取、O(帧头) 不解析 payload；布局与 codec 字段序为同步维护契约 + 结构守卫测试 | ADR 0032 决策 4（:26） | §D2.3 | `bytes`/`namespaceId` 判定沿用同一纪律（固定偏移 + varUint ≤5 字节 + 长度一致性交叉校验）；补守卫测试（ALLOW LIST） | 否（同一契约的扩展适用） |
| `maxConcurrentAssembliesPerConnection` 分片形态 per-session（聚合上界 = limits × worker 数）、listen 不变 | ADR 0032 决策 5；SA6 §12.4-3 | §D5（文档面）；运行时零改动（EM-C6 锚既有） | 协议 §17 + ADR 注记登记 | 是（规范文档编辑） |
| `connectionId` 受控 observability id：握手完成前字段不存在（反向 = 完成后在场）；事件树禁二进制/Error/异常原文 | 协议 §23.3；`observer.ts:110-117`（`cidField`） | §D1（A）、§D2.4（B） | 条件展开单点复用；事件键集 ⊆ §23 注册集（契约 `assertSection23Shape` 全程锚定） | 否 |
| 回调同步投递、throw 隔离（`dispatchReplicationObserver` 单点）、缺 clock = 差值整键缺失、无 observer = 零构造零读取 | 协议 §23.4；`observer.ts:36-46, 162-168` | §D2.2（observer 门前置）、§D3.3（clock 缺面链路原样） | 隔离单点零改动；构造与帧判定全部 observer 门后 | 否 |
| 36 型字段集 append-only 冻结 | 协议 §23.1；SA6 §12.2 | 全设计 | 零事件型/字段编辑；§23 文档只**追加注记**（发射侧归属 + 缺面口径），不改字段表 | 是（§23 触碰即复查） |

## 7. 设计决策与主要备选方案

### D1（缺口 A）：edge 复刻拒绝/合成路径的 `connectionId` 在场投影

`hub-edge-host.ts` 三个发射点——`emitNamespaceErrorSent`、`emitNamespaceFailed`、`synthesizeStateViolation`——事件对象统一追加
`...(cidField(this.port.connectionId()))`（`cidField` 自 `./observer.js` 导入，与单体发射体同单点）。

- **值与在场**：`port.connectionId()` = edge `connectionIdValue`（HELLO 完成置位）= 工厂 `connectionKey` 同串。三条路径均在 HELLO 门之后（OPEN/namespace 帧被 HELLO 门拦），故运行时恒在场；条件展开保留「握手前 undefined ⇒ 键缺席」的防御形状（与单体 `hub-namespace.ts` 逐字同构），不引入无条件字段。
- **不改动**：pre-connection `auth-upgrade-rejected`（§23.3 文档化形态，EM-C2c 负控）；edge 自身 R-none 合成（已在场）；listen 形态 session 通道拒绝路径（`finishOpenError` 族，已在场）。
- **备选否决**：把 `connectionId` 硬编入 `HostSessionAdapter` 构造参数——否决：端口成员已在场（`hub-split.ts:91-92`），加构造态副本引入第二事实源，且丢失「握手前缺席」的动态形状。

### D2（缺口 B 发射点）：edge 连接级 data 帧出面成为 `update-sent` 唯一发射点

**D2.1 落点**：`hub-edge.ts` `makePort()` 的 `sendDataFrame` 实现由直通改为包装：

```ts
sendDataFrame: (frame, accounting) => {
  const seq = this.sender.tryEmitDataFrame(frame);
  if (seq > 0) this.emitUpdateSentAtStamp(frame, seq, accounting); // observer 门在方法首行
  return seq;
},
```

私有助手 `emitUpdateSentAtStamp(frame, sequence, accounting)`：

1. 首行 `if (this.connectionObserver() === undefined) return;`（§23.4「无 observer = 零事件构造、零字段读取、零时钟调用」——判定亦不执行）。
2. **型判定**：`frame[5] === MESSAGE_TYPES.UPDATE`（0x40，公共导出单源；非 UPDATE——含 UPDATE_CHUNK 0x42 与一切经 data 面出站的其它型——直接返回，零事件）。控制帧走 `sendControlFrame` 面，结构性不触达（EM-C4a 负控）。
3. **路由键判定**：`frame[20] === 35` 且 ascii `[21,56)`（35 字节，半开区间——与 `routingKeyOf` 标准帧窗口同一布局契约，ADR 决策 4）提取 `namespaceId`。
4. **载荷长度判定**：偏移 56 起读 lib0 varUint（≤5 字节，续位 `0x80`、7bit 组 LSB 先）得 `updateLen`；交叉校验
   `frame.byteLength === 20 + readBe32(frame,12) ∧ readBe32(frame,12) === 1 + 35 + varUintByteCount + updateLen`。
   校验不过 ⇒ 不发射（见 D6 防御分支裁决）。
5. **构造与分发**（决策已落定后发射——帧已实际出站、序已分配，满足 §23.4 时序）：

```ts
dispatchReplicationObserver(this.connectionObserver(), {
  type: 'update-sent',
  side: 'hub',
  ...(this.connectionIdValue !== undefined ? { connectionId: this.connectionIdValue } : {}),
  namespaceId,
  bytes: updateLen,
  sequence,
  ...(accounting?.sendQueueMs !== undefined ? { sendQueueMs: accounting.sendQueueMs } : {}),
});
```

**D2.2 单漏斗论证**（恰一的结构性保证）：hub 侧全部 data 帧唯一出口 = `port.sendDataFrame`（§2.2 表：listen session 组装路径、UPDATE_CHUNK/分块族路径、工厂 egress 直驱路径三路汇聚；消息形态 `tryEmitData` 仅 peer 使用）。发射点在 admission 成功（`seq > 0`）之后 ⇒ 「未发送/被拒零事件」保持；被拒帧（0）无事件，与既有「seq>0 每帧恰一」语义同构（`hub-namespace.ts:1370` 注释口径平移）。

**D2.3 判定纪律**：`bytes`/`namespaceId` 由**帧字节**判定（SA6 §5.2「在帧字节上可判」、§12.4-2③④），不由 session 投影供给——单一代码路径同时服务 session 帧与宿主直驱帧（后者无 session），且与路由键同源防「投影说谎」。整帧 `decodeMessage` 否决：O(payload) + `readVarUint8ArrayCopy` 分配，违背决策 4 头部纪律；定偏移 varUint 读取 ≤5 字节。守卫测试（ALLOW LIST）锚定跨 1/2/3 字节 varUint 边界的 update 长度、id 窗口与型门，防 codec 字段序漂移（ADR 决策 4 同步维护契约的扩展适用）。

**D2.4 备选否决**：
- *在 `OutboundQueue.emitOne`（mux 盖章点本体）发射*——否决：`OutboundQueue` 是 kind 无关的字节管线且与 `ConnectionSender` 共同被 peer 复用，发射需把 kind 判定/observer/accounting 穿透共享层，peer 将双发；`emitOne` 对控制帧同样触发，仍需型门。port 出面 = 「连接级 mux 或**等价的 edge 侧单点**」（SA6 §12.4-2 允许项）：同一同步栈、唯一漏斗、observer/`connectionId`/accounting 全部已在作用域。
- *session 构造事件、edge 仅 dispatch（新增 port 成员转发）*——否决：工厂形态无 session（EM-C4a 红灯本体即证明必须 edge 自构）；分片形态下 session 无法观测盖章序；违反「发射点 = 事实所有者」的决策语义（仅满足 listen 形态的字面断言）。

**D2.5 组合形态次序不变论证**（AC6）：现发射点（`sendAndRegister` 内 `noteUpdateSent`）与新发射点（port 包装内）位于**同一同步栈**，且两 point 之间既有的唯一动作 `inFlight.set` / `armAckTimer` 零 observer 事件；数据路径 `tryEmitDataFrame` 只调 `observe()`（无水位边沿事件）。⇒ 组合观测面事件序列逐字不变（键集由 D3 保证、次序由本条保证、无重复由 D2.2/D4 保证）。

### D3（缺口 B 承载机制，SA6 U2 裁决）：缝上 append-only 发送记账投影

**D3.1 投影形状**：`hub-split.ts` 新增纯类型 + `sendDataFrame` 追加可选参数（append-only，内部缝，不进公共面）：

```ts
/** issue #423（ADR 0032 决策 5/2）：出站 data 帧的 session 侧发送记账投影（纯 JSON）。
 *  sendQueueMs = 帧出队时刻 − 帧内最旧业务项入队时刻（session 时钟域差值；
 *  clock 缺省/无 observer ⇒ 成员缺席）。宿主直驱帧无记账 ⇒ 整个参数缺席。 */
export interface HubSendAccounting {
  readonly sendQueueMs?: number;
}
// HubSessionEdgePort:
sendDataFrame(frame: Uint8Array, accounting?: HubSendAccounting): number;
```

线程（全部 append-only 可选参数；结构化类型兼容——少参实现仍可赋值）：

| 层 | 成员 | 改动 |
|---|---|---|
| `update-channel.ts:26` | `UpdateChannelHost.sendUpdateFrame` | `(bytes: Uint8Array, accounting?: Readonly<{ sendQueueMs?: number }>) => number`（结构内联，零 import；peer 实现 `(bytes) => number` 原样兼容） |
| `hub-namespace.ts:65` | `HubChannelHost.sendData` | 追加同形可选参数；`sendUpdateFrame(bytes, accounting)`（:1324-1337）透传 `host.sendData(nsId, bytes, accounting)` |
| `hub-session.ts:210-216` | `sendData` | 透传 `port.sendDataFrame(encodePlaceholder(...), accounting)` |
| `hub-split.ts:69-71` | `sendDataFrame` | 见上 |

**D3.2 采样点前移**（`update-channel.ts sendAndRegister` 唯一语义改动点）：

```ts
// issue #423：sentAt 采样点 = 发送调用边界（同一同步栈；发送栈零时钟读 ⇒ 手动时钟域逐值不变）。
const sentAt = safeNow(() => this.host.now?.());
const sendQueueMs =
  sentAt !== undefined && oldestQueuedAt !== undefined ? sentAt - oldestQueuedAt : undefined;
const seq = this.host.sendUpdateFrame(
  bytes,
  sendQueueMs !== undefined ? { sendQueueMs } : undefined,
);
if (seq <= 0) { /* 既有失败分支原样（记账随帧弃置——无帧出站即零事件） */ }
this.inFlight.set(seq, { bytes: bytes.byteLength, ...(sentAt !== undefined ? { sentAt } : {}) });
this.host.noteUpdateSent({ sequence: seq, bytes: bytes.byteLength, ...(sendQueueMs !== undefined ? { sendQueueMs } : {}) }); // peer 消费 sendQueueMs 照旧；hub 消费方见 D4
this.armAckTimer();
```

- **值恒等论证**：发送栈（`hub-session.sendData` → `port.sendDataFrame` → `tryEmitDataFrame` → `emitOne` → `transport.send`）零时钟读；手动时钟仅显式 `advance()` 推进 ⇒ 前移采样与现后置采样在测试时钟域**逐值相同**（`issue238-segmented-observation` 的 `[0, 4_000]` 精确断言保持绿）。真实时钟域残差 = 同步栈时长（微秒级），无契约断言绝对值。
- **`sentAt` 复用**：同一采样同时是 `inFlight` 的 ACK 时延 t0（§23.4 `ackLatencyMs` 锚）——一次读数两用，读数次数不变（1 次），ACK 时延语义「帧实际出站时刻」在同步栈内等价。
- **clock 域纯净性（分片前瞻）**：`oldestQueuedAt` 与 `sentAt` 同为 session 时钟域读数 ⇒ 差值是纯 session 进程内事实（§23.4「发送方进程内精确」）；缝传**差值**而非绝对时间戳（§23.3「绝对时间戳不入事件」同源纪律；跨 worker 部署时不会混用两个时钟域的零点——这是否决「传 `oldestQueuedAt` 由 edge 采样」的原因：edge 时钟与 session 时钟在分片形态是不同实例，跨域减法产生垃圾值）。
- **observer/clock 门不变**：session 侧 `host.now` = `port.now`（`hub-edge.ts:245-249`，observer 门 + `safeNow` 折叠）⇒ 无 observer ⇒ `undefined` ⇒ 无 `sendQueueMs` ⇒ 无 accounting 对象构造；clock-throw ⇒ 同折叠（§23.4 B1 纪律原样）。EM-C3c（缺 clock 键缺席）/EM-C4c（clock 在场键在场）链路不变。

**D3.3 宿主直驱帧（⑥）**：工厂 `egress.sendDataFrame(frame)`（`hub-edge-host.ts:684-693`）公共签名**零变化**，调用 port 时不传 accounting ⇒ `sendQueueMs` 整键缺席（缺面 = 键缺失，非 0/undefined——与 AC2 同纪律）。EM-C4a 期望形状即此。

**D3.4 键集不变论证**（AC6/EM-C7a 金标行 `update-sent|bytes,connectionId,namespaceId,sendQueueMs,sequence,side,type`）：edge 构造体恰好产出 type/side/connectionId(握手后)/namespaceId/bytes/sequence/sendQueueMs(clock 在场)——与金标键集逐字一致；listen 形态 accounting 在场 ⇒ 键齐。

### D4（缺口 B 抑制 + U1 作用域裁决）：session 侧普通族抑制、chunked 族留 session

**D4.1 抑制**：`HubNamespaceChannel.onUpdateSent`（`hub-namespace.ts:1375-1405`）非 chunked 分支删除 `update-sent` 发射体（方法保留、`observerOn` 早退保留）；chunked 分支（`info.chunked` 在场 ⇒ `chunked-update-sent`）**原样**。`noteUpdateSent` 回调链与 info 形状不变（peer 侧 `peer-namespace.ts:304,1549` 照旧发射其 `update-sent{side:'peer'}`——UpdateChannel 双侧对称、零条件分支）。

**D4.2 U1 裁决论证**（简报「依赖盖章后 sequence 的出站事件（update-sent 族）」的作用域 = 仅 `update-sent`）：

1. **键集事实**：§23.1 中 family 内唯一携带 `sequence` 键的是 `update-sent`；`chunked-update-sent`（DD1 键集冻结：无 `sequence`/`sendQueueMs`）、`bootstrap-snapshot-sent`、`sync-step2-sent` 均无 sequence 键——不属「依赖盖章后 sequence」的出站事件。
2. **事实归属**：三者的结算事实（transfer 完成 / 快照编码 / round diff 编码）与字节数记账都在 session 侧（`update-channel.ts:489-493`、`bulk-transfer.ts`、`round-engine.ts`）；edge 帧字节只能见到逐 chunk/逐帧，无从判定「transfer 完成」「Step2 与 round 关联」——迁移即引入 session→edge 的整组投影，违背最小缝原则且无 AC 支撑。
3. **简报对照**：明文以「`update-acked{sequence}` 关联**入站** sequence ⇒ 留在 session」作对照——归属判据是「sequence 事实的所有权方向」，出站盖字幕序归 edge、入站/无 sequence 者归 session，与 ADR 决策 5 同读。
4. **EM-C4b 契约面**：现实现已把 `chunked-update-sent` 排除在 session 零发射断言外（测试 :855-856 注释）——本裁决与契约兼容；若后续裁决改全域搬迁，属 append-only 扩展（新票），不弱化本票。

### D5（AC5 文档面）：协议 + ADR 对应章节

| 文档 | 位置 | 追加内容（不改既有行语义，只追加注记） |
|---|---|---|
| `docs/protocols/instance-replication-v1.md` | §17 `maxConcurrentAssembliesPerConnection` 条目（:581） | 分片（worker）形态下降级为 per-session 计数：每 SessionHost 进程各自计数，聚合上界 = 本值 × worker 数；listen/进程内组合形态保持 per-connection（edge 连接级槽位单点，`hub-edge.ts` `inboundAssemblySlots`）——口径差异源自缝的跨进程化（ADR 0032 决策 5），非配置语义变化 |
| 同 | §23.1 `update-sent` 行尾 | hub 侧发射点注记：edge 连接级 data 帧出面（盖章事实所有者，ADR 0032 决策 5）；session 经缝以 append-only 发送记账投影（纯 JSON `{sendQueueMs?}`）携带差值（采样点 = 发送调用边界，session 时钟域）；宿主直驱 data 帧（edge 工厂 egress）无 session 记账 ⇒ `sendQueueMs` 整键缺席（缺面纪律，与 AC2 同款）；peer 侧不拆分、发射点不变 |
| 同 | §23.1 表组后追加「发射侧归属表（hub 拆分形态）」小节 | edge：连接域 8 型 + `update-sent` + 授权拒绝路径复刻的 `namespace-error{sent}` / `namespace-failed{open-failed}`（含 no-sink 合成违例）；session：其余 namespace 域型（channel-state-changed/bootstrap/sync/applied/acked/resync/chunked 族）。**形态差异登记（U5）**：未授权 OPEN 不产生 `channel-state-changed`（无 session 通道，ADR 决策 3「未授权 OPEN 不过缝」的自然结果）——与单体形态事件集不同，属文档化差异，非缺失 |
| 同 | §22 conformance 清单 | 追加 #423 资产锚：`packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts`（发射侧归属 / 在场纪律 / 缺面降级 / 隔离 / listen 计数回归 / 拆分前金标六面） |
| `docs/adr/0032-transport-decoupling-edge-session-split.md` | 「后果」节追加实现注记 | 决策 5 观测面已落地（issue #423）：`update-sent` hub 侧发射点 = edge data 帧出面，`sendQueueMs` 经缝记账投影承载；拒绝复刻路径 `connectionId` 在场纪律收口；per-session 计数口径已登记协议 §17 |

### D6 防御分支裁决（D2.1 第 4 步校验不过）

到达 `port.sendDataFrame` 的 UPDATE 型帧由 `encodeMessage` 产出（编码器对畸形输入响亮 throw，先于任何字节出站）⇒ 固定偏移判定对 codec 产出帧**结构性可达成功**；校验不过仅当调用方绕过 codec 自构字节（宿主缺陷域，帧已上 wire，观测面无从补救）。裁决：**跳过发射（dormant）+ 注释标记结构不可达**，不 `connectionFatal`——§23.4 钉死观测面失败绝不改变协议结果；型门（非 UPDATE 跳过）已是同款「条件不满足即零事件」语义。正常路径不变量（codec 产出帧必可判定）由 D2.3 守卫测试锚定，不存在静默 fallback 面。

## 8. 接口、状态机和数据流

**接口变化全集**（零公共 API、零 wire、零事件词表变化）：

| 接口 | 变化 | 性质 |
|---|---|---|
| `HubSessionEdgePort.sendDataFrame` | 追加可选参数 `accounting?: HubSendAccounting` | 内部缝 append-only；既有实现/桩（单参）类型兼容 |
| `HubSendAccounting`（新增纯类型，`hub-split.ts`） | `{ sendQueueMs?: number }` | 纯 JSON 投影；不进 `src/index.ts` |
| `HubChannelHost.sendData` / `UpdateChannelHost.sendUpdateFrame` | 追加同形可选参数 | 内部；peer 实现零改动兼容 |
| `HubNamespaceChannel.onUpdateSent` | 非_chunked 分支移除发射（行为变化，非签名变化） | 缺口 B 抑制面 |
| `hub-edge-host.ts` 三发射点 | 事件追加 `connectionId` 条件成员 | §23.3 在场纪律对齐 |

**状态机**：零变化（连接/通道 FSM、准入台账、drain、背压、assembly 槽位全部不动）。

**数据流路线**（唯一运行时数据流变化 = `update-sent` 事件对象的构造点与构造者）：

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| listen：业务写 → UPDATE 帧 → edge 事件 | Runtime dirty → session `UpdateChannel.enqueue`（`queuedAt`）→ drain `pullAndSendOne` → `sendAndRegister` | `sentAt` 采样 + `sendQueueMs` 计算（session）；`encodePlaceholder`（session）；edge `emitOne` 盖章 `[8..12]` | 缝边界①：`port.sendDataFrame(frame, accounting)`（帧字节 + 纯 JSON 差值）；edge 定偏移判定（型/路由键/载荷长度） | wire 帧出站（`transport.send`，单次） | edge `emitUpdateSentAtStamp` 构造事件 → `dispatchReplicationObserver` 同步投递 | 恰一 `update-sent{side:hub, connectionId, namespaceId, bytes=载荷长, sequence=[8..12], sendQueueMs?}`；session 观测面零该型 | admission 拒绝（seq=0）⇒ 零事件 + 既有失败分支；observer throw ⇒ 单点隔离；accounting 随拒帧弃置 | EM-C4c、EM-C3c、EM-C7a、issue238 精确差值断言 |
| 工厂：宿主直驱 data 帧 → edge 事件 | 宿主 `connection.egress.sendDataFrame(占位帧)` | edge 盖章（同上） | 无 accounting（宿主域无 session 记账） | wire 出站 | 同上（判定同一代码路径） | 恰一 `update-sent{..., sendQueueMs 整键缺席}` | 同上 | EM-C4a（含 control 负控） |
| 工厂：拒绝路径事件 | 宿主 `authorize → {ok:false}` / throw / openAdmission reject | `HostSessionAdapter.finishTerminal` | `cidField(port.connectionId())` 投影 | —（本地 seam） | `port.emitObserver` → edge 单点 dispatch | 两事件携 `connectionId == connectionKey`；键集 ⊆ §23 | 迟归/收口路径 `finishTerminalSilently` 零 wire 零事件（原样） | EM-C2a/b、EM-C1b/c |

无持久化/缓存/最终一致性面；事件对象不可变（readonly 类型面沿用 `types.ts`，零改动）。

## 9. 错误、恢复、并发和幂等

- **失败语义零变化**：发送拒绝（`seq ≤ 0`）⇒ 既有 F4/`send-frame-rejected` 分支原样（`update-channel.ts:347-355`）；`OutboundExhaustedError`（实践不可达）在 `tryEmitDataFrame` 内抛出 ⇒ 包装点不拦截（传播路径与今天一致，`hub-namespace.sendUpdateFrame` catch → 0），发射因 seq 未返回而跳过。
- **隔离**：edge 构造/分发经 `dispatchReplicationObserver`（`observer.ts:36-46`）——observer throw 静默隔离，wire/状态/记账零影响（EM-C5a 双跑逐帧相等锚定）；帧判定自身零 throw 可能（定偏移读 + 边界校验，D6）。
- **并发/幂等**：恰一性由单漏斗 + `seq > 0` 门 + session 抑制三点结构性成立；同一连接内 `sequence` 严格递增不重复 ⇒ 事件天然幂等键；无跨连接/持久化状态。
- **资源所有权**：accounting 对象为调用栈内瞬态值，零存活；`HubSendAccounting` 无运行时构件（纯类型）。
- **回滚**：6 个 src 文件 + 2 个文档单提交可整体回退；无数据迁移、无 wire 代际、无配置键。

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| `hub-session.ts` `sendData` | 2 参组帧 + `port.sendDataFrame(frame)` | 3 参透传 accounting | 本票 ALLOW LIST | `hub-session.ts:210-216` |
| `hub-session.ts` `sendUpdateChunk` | `port.sendDataFrame(frame)`（UPDATE_CHUNK） | 不变（edge 型门排除） | 零 | `hub-session.ts:220-254` |
| `hub-namespace.ts` `sendUpdateFrame`/`onUpdateSent` | 透传 2 参；非_chunked 发射 `update-sent` | 透传 3 参；非_chunked 不再发射 | 本票 ALLOW LIST | `hub-namespace.ts:1324-1337, 1375-1405` |
| `update-channel.ts` `sendAndRegister` | send 后采样 + `noteUpdateSent` 全量 | send 前采样 + accounting 入参 + `noteUpdateSent` 保留（peer 消费） | 本票 ALLOW LIST | `update-channel.ts:319-371` |
| `peer-namespace.ts`（peer 侧） | `sendUpdateFrame(bytes)` + `onUpdateSent` 发射 `update-sent{side:'peer'}` | **零改动**（少参实现兼容新可选参） | 零 | `peer-namespace.ts:294, 1549-1577` |
| `peer-connection.ts` | `sender.tryEmitData`（消息形态） | 不触达（hub 才有 port 包装） | 零 | `peer-connection.ts:792-841` |
| `hub-edge-host.ts` `HostSessionAdapter` 三发射点 | 事件无 `connectionId` | `cidField` 投影 | 本票 ALLOW LIST | `hub-edge-host.ts:597-635` |
| 工厂宿主（egress 消费者） | `egress.sendDataFrame(frame): number` | 签名零变化；新增副作用 = 每 UPDATE 帧恰一 observer 事件（observer 在场时） | 零（观测面新增即本票目标） | `hub-edge-host.ts:118-130, 684-693`；EM-C4a |
| `hub-connection.ts`（listen 组合根） | 透传 observer/clock 至 edge；session 经 port | 零改动（同实例时钟域 ⇒ 差值有效） | 零 | `hub-connection.ts:324-358` |
| 测试桩（`HubSessionEdgePort` 字面量实现，#418/#421/契约文件） | 单参 `sendDataFrame` | 类型兼容（可选参）；`emitObserver` 桩面不变 | 零 | 契约 `makeStubPort:414-418`；`issue418-edge-session-split-structure.test.ts` |
| 既有断言面（§2.3 列举） | listen 形态恰一 `update-sent`、精确 `sendQueueMs`、键集白名单 | 键集/次序/值恒等（D2.5/D3.2/D3.4） | 零 | `observer-red.test.ts:477-497,1236`；`issue238-*:244-245` |

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/ws-replication/src/hub-edge-host.ts` | 三发射点追加 `cidField(port.connectionId())` 投影（+ import） | 缺口 A（§D1） |
| `packages/ws-replication/src/hub-edge.ts` | `makePort().sendDataFrame` 包装 + `emitUpdateSentAtStamp` 助手 + 定偏移判定（+ `MESSAGE_TYPES` import） | 缺口 B 发射点（§D2） |
| `packages/ws-replication/src/hub-split.ts` | 新增 `HubSendAccounting` 类型 + `sendDataFrame` 可选参数 | 缝投影（§D3.1） |
| `packages/ws-replication/src/hub-session.ts` | `sendData` 透传 accounting | 投影线程（§D3.1） |
| `packages/ws-replication/src/hub-namespace.ts` | `HubChannelHost.sendData` 可选参 + `sendUpdateFrame` 透传 + `onUpdateSent` 非_chunked 抑制 | 投影线程 + 抑制面（§D3.1/§D4.1） |
| `packages/ws-replication/src/update-channel.ts` | `UpdateChannelHost.sendUpdateFrame` 可选参 + `sendAndRegister` 采样点前移/accounting/记账 | 投影生产点（§D3.2） |
| `packages/ws-replication/test/ws-replication-issue423-update-offset-guard.test.ts`（新增） | 守卫：随机 UPDATE 载荷长度跨 varUint 1/2/3 字节边界 ×（edge 定偏移判定 === `decodeMessage(...).update.byteLength`）、id 窗口、型门（UPDATE_CHUNK/control 不发） | ADR 决策 4 布局同步维护契约的扩展（§D2.3/D6） |
| `docs/protocols/instance-replication-v1.md` | §17 计数口径注记、§23.1 `update-sent` 行注记 + 发射侧归属表（含 U5 形态差异）、§22 资产锚 | AC5（§D5） |
| `docs/adr/0032-transport-decoupling-edge-session-split.md` | 「后果」节实现注记 | AC5（§D5） |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/ws-replication/src/index.ts` / `src/testing.ts` | 公共面 | 零新公共 API（SA6 §10「公开面零变化」；缝类型不上公共入口） |
| `packages/ws-replication/src/types.ts` | 事件词表/字段类型 | §23.1 append-only 冻结面零编辑（零新型/字段） |
| `packages/ws-replication/src/observer.ts` | 隔离单点/`cidField`/`safeNow` | AC4 单点语义不变（M2 敏感性已证）；D1 仅消费既有单点 |
| `packages/ws-replication/src/frame-io.ts` | 盖章单点 | 发射点在 port 出面（D2.4 裁决），盖章/记账 internals 零改动 |
| `packages/ws-replication/src/backpressure.ts` | admission/水位/shed | 判定次序与账本零变化；peer 复用层不引入 hub 观测面 |
| `packages/ws-replication/src/hub-connection.ts` | listen 组合根 | 组合形态零改动（AC6 逐字一致的前提） |
| `packages/ws-replication/src/peer-connection.ts` / `peer-namespace.ts` | peer 侧 | ADR 0032：peer 不拆分；peer 发射点原样 |
| `packages/ws-replication/src/hub-upgrade-admission.ts` / `liveness.ts` / `plugin.ts` / `defaults.ts` / `validate.ts` | 认证/活性/插件/配置 | 无涉（pre-connection 形态、活性、服务面、配置零变化） |
| `packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts` | SA6 验收契约 | SA6 固定产物；3 红经实现转绿，不得改契约（§12.3 不可软化） |
| `wiki/raw/task_issue-423_sa6_contract.md` / `artifacts/sa6-issue423-contract-evidence.log` | 上游证据 | 只读输入 |
| `packages/replication-protocol/**` | codec | 零 wire/codec 变化（`MESSAGE_TYPES` 公共导出已够用） |
| 既有测试文件（§2.3 列举及其余） | 回归面 | 全绿保持是验收前提；如实现中发现过窄断言与 §23.3 冲突，回报 Controller 裁决，不静默改测试 |

## 12. 验收与验证映射

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC3 / EM-C2a（拒绝路径 `connectionId`） | 红（缺字段） | 契约文件既有用例（零改动） | 两事件 `connectionId === connectionKey`；M1 已证可满足 |
| AC1 出站 sequence / EM-C4a（工厂直驱） | 红（edge 零事件） | 契约既有 | 恰一 `update-sent`，`sequence == stamped == wire [8..12]`、`bytes == UPDATE 载荷长度`、`sendQueueMs` 键缺席；control 负控不触 |
| AC1 / EM-C4b（session 零发射） | 红（session 发射） | 契约既有 | session 观测面 `update-sent` 空集；`chunked-update-sent` 不在断言面（D4 裁决） |
| AC1/AC6 / EM-C4c + EM-C3c（listen 恰一 + `sendQueueMs` 两态） | EM-C4c 绿 / EM-C3c 绿 | 契约既有 | clock 在场键在场、缺 clock 整键缺席；恰一无重复；`sequence == wire` |
| AC6 / EM-C7a/b（拆分前金标） | 绿（E3 基线） | 契约既有 | 结构序列逐字相等（键集 D3.4 + 次序 D2.5） |
| AC1 / EM-C1a-e、AC2 / EM-C3a/b/d、AC4 / EM-C5a/b、AC5 / EM-C6a/b | 全绿 | 契约既有（回归） | 全绿保持 |
| `sendQueueMs` 精确值不回归 | `issue238-segmented-observation:244-245` 绿 | 既有套件复跑 | `[0, 4_000]` 保持（D3.2 值恒等论证） |
| 观测键集白名单不回归 | `observer-red.test.ts:1236` 绿 | 既有套件复跑 | edge 构造键集 ⊆ 白名单 |
| 定偏移判定 vs codec 布局（新风险） | 无（新增耦合） | 新增守卫测试（ALLOW LIST） | 跨 varUint 边界长度判定 === decoded 值；型门/窗口守卫 |
| peer 侧零回归 | peer 套件绿 | 既有套件复跑 | peer `update-sent{side:'peer'}` 照旧 |
| 包级门禁 | S5：704 绿 / 3 红 | `vitest run packages/ws-replication`（含 typecheck） | 全绿；`tsc -p` exit 0 |
| 根门禁 | Host 流程（SA6 U6） | 根 `pnpm typecheck` / `pnpm test` | 全绿（Host 执行） |

SA1 不编写/运行测试；上表为后续角色（实现/验证）的证据需求，契约执行命令 = SA6 §13（`NODE_OPTIONS=--conditions=nomicore-source npx vitest run <契约文件>`）。

## 13. 风险、回滚和残余问题

| 风险 | 等级 | 缓解 | 残余 |
|---|---|---|---|
| 定偏移判定与 codec 字段序漂移（UPDATE 布局耦合） | 中 | 守卫测试 + 长度交叉校验 + ADR 决策 4 既有同步契约；`MESSAGE_TYPES` 单源 | codec 若改 UPDATE 字段序属破坏 append-only 的代际事件，守卫即红 |
| `sentAt` 采样点前移的值域变化 | 低 | 手动时钟域逐值恒等（发送栈零时钟读）；真实域微秒残差且无绝对值断言 | 无 |
| 既有套件存在未探明的精确键集断言（deny 事件 / session `update-sent`） | 低 | grep 证据（§2.3：零命中）；M1/E2 的包级绿背书 | 实现期若浮现：按 §23.3 在场纪律修正过窄断言并回报（不静默改） |
| 组合形态事件次序漂移（AC6） | 低 | D2.5 同步栈论证；EM-C7 金标即守卫 | 无 |
| 分片形态（跨 worker）前瞻：accounting 差值含跨线程 handoff 时延 | 信息 | 差值仍为 session 进程内事实（D3.2 时钟域论证）；语义边界写入 §23.1 注记 | T3/T5 落地后按实测复核文档措辞（follow-up，非本票必要条件） |

**明确的 follow-up（非本票必要条件）**：T3(#420)/T5(#422) 落地后补分片形态运行时锚（per-session 计数端到端 + 正式 session shim 面；SA6 U4）；T7(#424) 复用本契约工厂夹具。**任务内无未解决必要条件**。

## 14. 评审修订映射

不存在 `wiki/raw/task_issue-423_sa2_review.md`（iteration 0，design 阶段首版）——无适用 finding，本章为空占位；后续评审输入到达时按 skill §10 逐条落实并填表。

## 15. 是否需要设计后ADR冲突复查及理由

**需要（`requiresConflictRecheck: true`）**，理由：

1. **SA8 产物缺失**：iteration 0 无 `relevant_decisions` / `conflict_report`——本设计自行承接 ADR 0032 + 协议 §23 约束面并对 SA6 登记的 U1（族作用域）/U2（缝承载机制）作出裁决；该两类裁决 SA6 原文标注「留待 SA2/SA8」，应经冲突复查确认不与既有 ADR/协议冻结面相抵。
2. **规范文档触碰**：协议 §17（limits 键口径注记）、§23.1（发射侧归属表 + `update-sent` 发射点/缺面注记）、§22（资产锚）与 ADR 0032（后果节注记）均被编辑——§23 是 append-only 冻结面，追加注记虽不改字段表，仍属复查范围。
3. **内部缝签名 append**：`HubSessionEdgePort.sendDataFrame` 追加可选参数（跨模块契约面，虽非公共 API 且类型兼容）。

无 wire/schema/持久化/状态机语义变化；无公共 API 变化；无新生命周期所有权或失败语义（D6 防御分支遵循观测面隔离纪律而非新失败语义）。
