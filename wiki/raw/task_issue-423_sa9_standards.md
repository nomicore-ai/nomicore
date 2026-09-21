# SA9 标准符合性审查 — issue #423（spec #415 T6）：observer 发射点拆分与降级口径

- **dispatch**: sa-7a217a8e-d6b1-4173-b87e-a0c7c228f63e（mabf-sa9 / standards-review / iteration 0）
- **被审对象**: **已提交最终交付**——commit `a2c8d34c8032ef695eab2a1d4af7ec7ca58edc10`（`feat(ws-replication): split observer emission ownership`，单提交）vs 基线 `1f5809b001c984e63fac3bafd4c1f3febc76e8a8`（Parent PR #416 head `spec/415-replication-transport-decoupling`，Host 点名并实测逐字一致）的全量 diff（21 文件，+4007/−45）
- **Owner-feedback 记录**: REST comments endpoint 返回 `[]`（无适用 owner 要求）——与任务简报 §Comments / SA6 §2（`gh issue view 423 --json comments` 复核 = 0）/ SA2 §4 / SA3 头部 / SA4 头部一致
- **裁决**: **approve**（无 BLOCKER / 无 MAJOR；5 条 MINOR 观察不阻断）
- **SA9 纪律声明**: 本审查为纯静态独立复核（交付全量 diff 逐 hunk 实读 + 规范文本逐字程序化比对 + 单漏斗/发射点/导出面 grep 取证 + DENY 面 name-status 取证）；未修改代码、设计或测试，未运行测试，未启动服务，未调度其他 SA，未 commit/push/PR/finalize。SA3/SA7 报告中的运行结果（契约 21/21 ×3、守卫 10/10、包级 86→87 files / 717→722 tests 全绿、包级与根 typecheck exit 0）作为引用证据对待；本审查结论独立建立在静态可核验事实上。

---

## 1. Reviewed inputs

| 输入 | 状态 | 用途 |
|---|---|---|
| commit `a2c8d34` 全量 diff（21 文件）+ `git diff --check` / name-status / `git log --format='%H %P'` 取证 | 逐 hunk 实读 | 被审实体 |
| `wiki/raw/task_issue-423.md` / `_design.md` / `_sa2_review.md` / `_sa3_impl.md` / `_sa4_review.md` / `_sa6_contract.md` / `_sa7_report.md` / `_design_conflict_report.md` / `_implementation_conflict_report.md` | 实读 | 上游产物链（设计 §D1–§D6、ALLOW/DENY、各 SA 裁决与登记） |
| 根 `AGENTS.md`、`packages/ws-replication/AGENTS.md`、`docs/AGENTS.md` | 实读 | 仓库与模块标准（边界、observer 隔离、导出面、验证门、文档权威分层） |
| `docs/adr/0032-transport-decoupling-edge-session-split.md`（决策 2/3/4/5、否决备选、后果节） | 实读 + 决策区 1–44 行 diff 取证 | 目标 ADR 的冻结面与义务面 |
| `docs/protocols/instance-replication-v1.md` §17(:581-582)/§22(:704)/§23.1(:745,:833-847)/§23.3/§23.4 | 实读 + 行级前缀程序化比对 | wire 唯一权威与事件词汇冻结行 |
| `packages/ws-replication/src/{hub-edge,hub-edge-host,hub-split,hub-session,hub-namespace,update-channel,observer,types,backpressure,frame-io}.ts`（HEAD） | 实读 | 发射点/缝/隔离单点/盖章单点/键集形状核验 |
| `packages/replication-protocol/src/{index,constants}.ts` | 实读 | `MESSAGE_TYPES`/`ENVELOPE_HEADER_BYTES` 公共导出单源核验 |
| 三个新测试文件（契约 1165 行 / 守卫 352 行 / SA7 动态 444 行）+ 根 `vitest.config.ts` | 实读 + grep 取证 | 测试质量与 runner 发现面核验 |
| `artifacts/sa6-issue423-contract-evidence.log` | 头/尾实读 | SA6 红灯基线证据（只读输入） |

## 2. Verdict

**approve。** 已提交最终交付在全部九个标准维度上符合仓库与工程标准，无 BLOCKER / 无 MAJOR：

1. **交付身份正确**：HEAD = 点名交付 commit `a2c8d34`，parent = 点名的 Parent PR head `1f5809b`（`git log -1 --format='%H %P'` 实测逐字一致）；单提交、空白检查绿（`git diff --check 1f5809b..a2c8d34` exit 0 零输出）。
2. **文件范围**：21 文件 = 设计 ALLOW 九项精确落位（6 src M + 2 docs M + 1 新守卫测试 A）+ SA6 契约测试（A，SA6 固定验收产物）+ SA7 动态测试（A，仓库 `*-sa7-dynamic` 惯例）+ SA6 证据日志（A，`artifacts/sa*-*` 既定命名惯例）+ 9 个 wiki/raw 过程产物（A，tracked-wiki 惯例）；DENY 面经 name-status 全量比对**零命中**（§6 实测）。
3. **规范一致性**：发射点拆分与 ADR 0032 决策 5 逐字同读（出站 sequence 事件在 edge、namespace 域在 session、字段集 append-only、缺面 dormant、per-session 计数口径）；协议 §17 注记公式与 ADR :30 **逐字一致**（「聚合上界 = limits 值 × worker 数」程序化比对）；§23.1 `update-sent` 行编辑 = 行尾追加注记，原字段声明文本逐字保留（程序化前缀比对）；ADR 决策区 1–44 行逐字节不变（diff 取证）。
4. **模块责任**：observer 隔离单点 `dispatchReplicationObserver` 零改动且新发射点经同一单点；公共导出面零变化（`index.ts`/`testing.ts` 零 diff，`HubSendAccounting` grep 零导出）；FSM/认证/HELLO 门/背压/assembly 槽位零触碰；注入 seam 纪律保持（accounting = 调用栈瞬态值，零新生命周期构件）。
5. **架构惯例**：单漏斗结构实测成立（hub 侧 `tryEmitDataFrame` 唯一直调点 = port 包装自身；`port.sendDataFrame` 三调用方 = session UPDATE/UPDATE_CHUNK + 工厂 egress；消息形态 `tryEmitData` 仅 peer）；`cidField` 单点复用（缺口 A 三发射点）与 edge 文件既有条件展开风格（6 处先例）一致；定偏移判定 = ADR 决策 4 `routingKeyOf` 纪律的扩展适用 + 守卫测试锚定。
6. **单一事实源**：`sequence` = 盖章返回值同点派生；`connectionId` = edge `connectionIdValue`（HELLO 置位单点）经 `cidField`/port 投影；`bytes`/`namespaceId` = 帧字节定偏移判读（防投影说谎）；`sendQueueMs` = session 时钟域差值（只过差值不过绝对时间戳）；`MESSAGE_TYPES`/`ENVELOPE_HEADER_BYTES` 公共导出单源消费。
7. **生命周期对称性**：零新增 acquire/release；accounting 瞬态值随拒帧弃置；无持久化/缓存/跨连接状态；观测面失败 = dormant 零 throw 零事件（D6），绝不改变协议结果（§23.4）。
8. **测试质量**：三新文件零 skip/only/todo/env override（grep 实测）、零 `console.*`、行为断言（wire 原字节/observer 事件对象/返回值/缝上留痕）；正负控成对（OG-2 型门、OG-5a 两态、EM-C2c pre-connection 负控、EM-C3a/b 缺面/在场互控）；EM-C7 金标精确键集 + 次序逐字相等；守卫跨 varUint 1/2/3 字节边界 vs `decodeMessage`；SA7 缝上跳点级证据（占位序边界、真实驻留差值、缺面 `undefined`）；runner 发现面 = 根 `vitest.config.ts` include 天然命中。
9. **文档标准**：纯追加编辑（§17 子条目/§22 资产锚/§23.1 行尾注记 + 表组后归属表小节/ADR 后果节单行）；§23.2/§23.3/§23.4 hunk 零触碰；引用的符号/文件/锚（`inboundAssemblySlots`、两测试文件、EM-C6a/b）全部实存；ADR 注记自declare「不修改决策」符合显式修订纪律。

5 条 MINOR 见 §8（均不阻断）。上游裁决链 SA6 approve / SA2 approve（0 B/M）/ SA8 设计 clear / SA8 实现 clear（`requiresConflictRecheck=false`）/ SA4 approve（0 B/M）/ SA7 approve 与本审查独立复核结论一致。

## 3. 仓库 AGENTS / ADR / 文档权威分层符合性

| 标准 | 要求 | 交付实况 | 裁决 |
|---|---|---|---|
| 根 AGENTS「Domain docs」 | 单上下文布局：CONTEXT.md + docs/adr/ | CONTEXT.md 零 diff；交付未引入新领域词（edge/session/缝/缺面 dormant/在场纪律均为既有词汇）；SA8 两轮登记「路由键契约」词条作用域注记（egress 判定不在 demux 词条域内，词条无需演进，一行 append 留后续票）——非阻断登记 | **符合** |
| 根 AGENTS「Module guidance」 | 改 packages/ 前遵守最近嵌套 AGENTS.md | `packages/ws-replication/AGENTS.md` 边界逐条核验（见 §4） | **符合** |
| 根 AGENTS「Instance replication」 | 触碰 observer/namespace 面时以 ADR 0010 + 协议为权威；chunked 面以 ADR 0013/0022 为契约 | 交付以 ADR 0032 决策 5 + 协议 §23 为唯一字段/归属来源；`chunked-update-sent` 键集与 ADR 0013 L89 逐字一致（改道分支构造体零变化）；SA8 双 clear 互证 | **符合** |
| 根 AGENTS「Typed Namespace writes」 | 新 mutation 路径须 typed 适配 | **不适用**——零新生产 Namespace 写入路径；SA7 测试夹具经共享 `driver.ts`/`harness.ts` 助手使用 `mutateData`（37 个既有测试文件同款惯例），非本交付新设面 | N/A |
| 根 AGENTS「diagnostic change log」 | ADR 0011/0014 面 | **不适用**——诊断日志面零触碰 | N/A |
| ADR 0032 决策 5（:30） | 发射点 = 拥有事实的一侧；字段集 append-only；缺面 dormant；per-session 计数口径 | `update-sent` hub 侧唯一发射点迁至 edge 盖章点（`hub-edge.ts:861` grep 实测唯一）；session 普通帧抑制（`hub-namespace.ts:1402`）；chunked 留 session；peer 原样；`types.ts` 零 diff；§17 注记公式逐字 | **符合（implements-existing-decision）** |
| ADR 0032 决策 2（:18） | 缝只过帧 + 纯 JSON；四控制信号 | `HubSendAccounting { sendQueueMs? }` = 纯 JSON 有限数值差值；`sendDataFrame` 追加可选参（append-only、结构化兼容）；零新控制信号、零帧形态变化 | **符合** |
| ADR 0032 决策 4（:26） | 定偏移只读、O(帧头)、同步维护契约 + 守卫测试 | `updateFrameProbe` ≤5 字节 varUint 定偏移 + 双长度交叉校验；守卫测试 10 用例锚定 codec 对齐（漂移即红）；布局依赖登记 §23.1 注记 + ADR 注记 | **符合** |
| ADR 0032 状态/后果（:4/:43/:44） | wire 零变化、listen 逐字节不变、公共面 append-only、peer 不拆分 | `replication-protocol/**`/`hub-connection.ts`/peer 面零 diff；EM-C7 金标（引用证据）；egress 公共签名零变化（#421 test-d 冻结面 `[frame: Uint8Array]` 不受影响） | **符合** |
| 协议 §23 preamble + §23.1 | 事件词表/字段表 append-only 冻结 | 零新型/字段/错误码；edge 构造体键集 = {type,side,connectionId?,namespaceId,bytes,sequence,sendQueueMs?} ⊆ `types.ts:514-528`；§23.1 唯一行编辑 = `update-sent` 行尾追加（原行文本程序化前缀比对通过）；新增归属表小节自declare不改词表 | **符合** |
| 协议 §23.3 | `connectionId` 握手完成前不存在、完成后在场；禁二进制/Error/异常原文 | 缺口 A 三发射点统一 `cidField(this.port.connectionId())` 条件展开（单点复用，HELLO 门后恒在场）；pre-connection `auth-upgrade-rejected` 无键形态保持（diff 零触碰 :775-790） | **符合** |
| 协议 §23.4 | throw 隔离；决策落定后发射；缺 clock 整键缺失；无 observer = 零构造/零字段读取/零时钟调用；绝对时间戳不入事件 | `emitUpdateSentAtStamp` 首行 observer 门（判定亦不执行）；发射在 `seq>0` 后（帧已出站）；`port.now` observer 门 + `safeNow` 折叠链路原样（`hub-edge.ts:300-303`、`hub-session.ts:80`）；缝只过差值不过绝对时间戳 | **符合** |
| docs/AGENTS.md「Editing」 | 仓库词汇；显式修订 ADR；链接权威源；行为变化同步受影响规范文档；`git diff --check` | ADR 唯一编辑 = 后果节追加注记且自declare「决策 1–5 与否决备选原文零改动」；协议四处编辑 = ADR 既定语义落文 + 资产登记；受影响规范面（§17/§22/§23.1）全部同步、无契约变化面零改动；`git diff --check` exit 0（本审查实跑） | **符合** |

## 4. 模块责任（packages/ws-replication/AGENTS.md 逐条）

| 边界条款 | 交付实况 | 裁决 |
|---|---|---|
| 拓扑/认证绑定/HELLO 门/FSM 不变量 | 零 wire/认证/握手改动；连接/通道 FSM、准入台账、drain、背压、assembly 槽位零新转移（diff 仅含观测面接线与缝可选参） | **符合** |
| Registry lease/session 路由、transport 不触 Runtime 内部 | 零改动面（新代码只读帧字节与缝瞬态投影；`routingKeyOf` 同纪律只读不解析） | **符合** |
| ACK = sequenced live apply + dirty 语义 | `update-acked` 族零触碰（留在 session，与简报明文一致）；`sentAt` 一读两用（inFlight t0 语义同步栈内等价，注释钉死） | **符合** |
| 注入 transport/scheduler/randomness/observer/clock seam；observer/adapter 失败按文档化隔离与关闭分类 | 全部新发射经 `dispatchReplicationObserver` 单点（`observer.ts` 零 diff）；probe 自身零 throw 可能（全边界检查，D6 dormant）；零新 seam | **符合** |
| Cordis 插件/服务面 | 插件面零 diff（`plugin.ts` DENY 零命中） | **符合** |
| 关闭安全（§21 权威） | 关闭路径零 diff；D-CLOSE1（SA7 动态，引用证据）close 后观测面零复活 | **符合** |
| 公共 API 经 `src/index.ts` 导出 | `index.ts`/`testing.ts` **零 diff**；`HubSendAccounting` 仅存 `hub-split.ts`（模块头「不导出任何运行时值」纪律区），grep 公共入口零命中 | **符合** |
| 验证门 | SA3（契约 21/21 ×3、守卫 10/10、包级 86/717、包+根 typecheck exit 0）与 SA7（31/31、59/59、149/149、包级 87/722、tsc exit 0）记录在案（引用证据；本审查不重复运行） | **符合** |

## 5. 架构惯例、单一事实源与生命周期对称性

### 5.1 发射点结构与恰一性（HEAD 实测）

| 面 | 位置 | 结构性保证 |
|---|---|---|
| `update-sent`（hub）唯一发射点 | `hub-edge.ts:861`（`emitUpdateSentAtStamp`；grep 实测 src 内该型构造仅此 + peer + types 声明） | 单漏斗（`tryEmitDataFrame` 唯一直调点 = port 包装 `hub-edge.ts:268`；三调用方 `hub-session.ts:221/:262`、`hub-edge-host.ts:695` 实测）+ 型门（0x40 单源 `MESSAGE_TYPES`）+ `seq>0` 门 + session 抑制（`hub-namespace.ts:1402`）四点结构性恰一 |
| `chunked-update-sent`（session 保留） | `hub-namespace.ts:1403-1410` | 构造体逐字节保持（diff 仅早退合并 + 注释）；UPDATE_CHUNK 0x42 被 edge 型门排除 ⇒ 无双发（守卫 OG-2a 锚） |
| 拒绝/合成复刻（edge） | `hub-edge-host.ts:608/624/637` | 三发射点统一 `cidField(this.port.connectionId())`；码集 {NAMESPACE_UNAUTHORIZED, INTERNAL_ERROR, NAMESPACE_STATE_VIOLATION} 与 §23.1 归属表逐字一致 |
| peer `update-sent` | `peer-namespace.ts:1571` | **零 diff**（DENY 面）；共享 `UpdateChannel` 采样点前移对 peer 同栈恒等（同一同步栈、同一差值公式） |

### 5.2 单一事实源

| 事实 | 权威源 | 派生 | 漂移风险 |
|---|---|---|---|
| wire sequence | edge `OutboundQueue` 盖章 `[8..12]`（`frame-io.ts`，DENY 零 diff） | 事件 `sequence` = `tryEmitDataFrame` 返回值 | 无——同点派生 |
| `connectionId` | edge `connectionIdValue`（HELLO 置位单点） | `cidField`/port `connectionId()` 投影 | 无——单链；无第二事实源（设计否决构造态副本并落实） |
| `bytes`/`namespaceId` | 帧字节（codec 布局契约） | 定偏移判读（与 `routingKeyOf` 同窗口同 `asciiAt`） | 低——守卫测试跨 varUint 边界 vs `decodeMessage` 锚定，漂移即红 |
| `sendQueueMs` | session 时钟域差值（`sentAt − oldestQueuedAt`） | 缝投影（调用栈瞬态，零存活） | 无——采样点前移值恒等论证（发送栈零时钟读）经 SA2/SA4 逐栈核对，注释钉死防「顺手还原」 |
| 型码/头长常量 | `MESSAGE_TYPES`/`ENVELOPE_HEADER_BYTES`（codec 公共导出） | import 消费 | 无——单源 |
| BE32 读取 | 本地 `readBe32At`（`hub-edge.ts:126-134`） | —— | 无——与 `frame-io.ts:201-206` 写侧同款本地分层（SA2 O1 落实），未 import 协议模块私有函数 |

### 5.3 生命周期对称性

| Start/acquire | Stop/release | 裁决 |
|---|---|---|
| accounting 对象（发送调用边界构造） | 随帧交付 edge 后零存活；拒帧（seq≤0）随帧弃置 | **对称充分**——调用栈瞬态值，无泄漏路径；`HubSendAccounting` 纯类型零运行时构件 |
| 观测发射（同步回调） | dispatch 隔离吞 throw；probe 失败 = dormant 零事件 | **对称**——零新增 acquire；无 observer ⇒ 零构造/零判定/零时钟调用 |
| 既有生命周期面（连接/通道/drain/assembly） | —— | **对称保持**——全部 DENY 零 diff |

### 5.4 平行机制检查

第二 observer 分发（无——`dispatchReplicationObserver` 单点复用）、第二帧解析（无——决策 4 豁免的定偏移 ≤5 字节读取，整帧 `decodeMessage` 被设计显式否决且守卫锚定）、第二 data 漏斗（无——§5.1 grep 实测）、第二布局守卫（无——`issue421-route-key-parity` 守 id 窗口 demux 面，新守卫守 egress varUint/型门/防御分支，判定面不同且按 issue-scoped 惯例）、第二条件展开逻辑（无——`cidField` 单点 + edge 文件既有内联风格 6 处先例）、仅服务单 Issue 的过度抽象（无——`HubSendAccounting` 单可选成员最小投影）。**全部无平行。**

## 6. 文件范围审查（交付 21 文件全量对账）

| 路径 | 状态 | 对账 |
|---|---|---|
| `packages/ws-replication/src/hub-edge-host.ts`（M +9） | ALLOW 1 | 范围内——缺口 A 三发射点 `cidField` 投影 + import + 注释 |
| `packages/ws-replication/src/hub-edge.ts`（M +118） | ALLOW 2 | 范围内——port 包装 + `emitUpdateSentAtStamp` + `updateFrameProbe` + 模块级助手/常量 + import |
| `packages/ws-replication/src/hub-split.ts`（M +25） | ALLOW 3 | 范围内——`HubSendAccounting` 纯类型 + `sendDataFrame` 可选参（append-only） |
| `packages/ws-replication/src/hub-session.ts`（M +15） | ALLOW 4 | 范围内——accounting 三参透传（SA2 O2 绑定箭头 + 注释） |
| `packages/ws-replication/src/hub-namespace.ts`（M +63/−45） | ALLOW 5 | 范围内——接口可选参 + 绑定箭头 + `onUpdateSent` 普通帧抑制（chunked 分支构造体逐字节保持） |
| `packages/ws-replication/src/update-channel.ts`（M +39/−16） | ALLOW 6 | 范围内——采样点前移 + accounting 生产点（读数次数不变：1 次，两用） |
| `packages/ws-replication/test/ws-replication-issue423-update-offset-guard.test.ts`（A 352 行，10 用例） | ALLOW 7 | 范围内——定偏移布局守卫（varUint 边界/型门/id 窗口/D6 防御分支/记账两态） |
| `docs/protocols/instance-replication-v1.md`（M +19/−1） | ALLOW 8 | 范围内——§17 子条目/§22 资产锚/§23.1 行尾注记 + 归属表小节（唯一 −1 = 行尾注记的行内追加形态） |
| `docs/adr/0032-transport-decoupling-edge-session-split.md`（M +1） | ALLOW 9 | 范围内——后果节单行注记；决策区 1–44 行 diff 取证逐字节不变 |
| `packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts`（A 1165 行，21 用例） | SA6 契约（DENY 语义：不得软化） | 预期存在——SA6 固定验收产物随交付入库；断言文本与 SA6 §12.3/证据日志逐字吻合（EM-C2a/C4a/C4b 标题实测）；SA4 mtime 序 + SA7 复跑 21/21 互证零软化 |
| `packages/ws-replication/test/ws-replication-issue423-sa7-dynamic.test.ts`（A 444 行，5 用例） | SA7 固定产物 | 预期存在——仓库 `issue243/244-sa7-dynamic` 命名惯例；缝上跳点级动态证据 |
| `artifacts/sa6-issue423-contract-evidence.log`（A 141 行） | SA6 证据产物 | 预期存在——`artifacts/sa*-*` 既定惯例；S0 五轮 3 红稳定基线（只读输入） |
| `wiki/raw/task_issue-423*.md`（A ×9） | 各 SA skill 固定产物 | 预期存在——wiki/raw 全仓跟踪惯例 |

**DENY 面零命中**（name-status 全量比对）：`src/index.ts`、`src/testing.ts`、`src/types.ts`、`src/observer.ts`、`src/frame-io.ts`、`src/backpressure.ts`、`src/hub-connection.ts`、`src/peer-connection.ts`、`src/peer-namespace.ts`、`src/hub-upgrade-admission.ts`、`src/liveness.ts`、`src/plugin.ts`、`src/defaults.ts`、`src/validate.ts`、`packages/replication-protocol/**`、全部既有测试文件——**全部不在 diff**。无 tmp/探针/bisect 残留；零 debug 残留（新增行 `console.*`/`debugger`/`FIXME`/`XXX` grep 零命中；`SA7-DATAFLOW` 仅出现在 SA7 报告对**已删除**临时日志的登记文本中，非代码残留）。

## 7. 测试质量标准

| 维度 | 实测 | 裁决 |
|---|---|---|
| 契约纪律 | 三新文件零 `.(only|skip|todo)(`、零 `process.env`、零 `console.*`（grep 实测）；无源码字符串/快照断言；断言 = 运行时行为（wire 原字节/observer 事件对象/返回值/缝上留痕） | **符合** |
| 红灯真实性 | SA6 证据日志：3 红断言文本指向缺失事实本身（EM-C2a 缺 `connectionId` / EM-C4a `expected [] to have a length of 1` / EM-C4b session 侧发射），五轮稳定；M1/E2 mutation 证明可满足（引用证据） | **符合** |
| 正负控成对 | OG-2a/b 型门负控（UPDATE_CHUNK/OPEN_OK 零事件且返回值不受影响）；OG-5a 两态（在场取值透传 / 缺省**整键缺席** `'sendQueueMs' in ev === false`）；EM-C2c pre-connection 负控；EM-C3a/b 缺面/在场互控；非空断言防恒真（EM-C4b `stub.data` 帧数前置、OG-1a 场景断言） | **符合** |
| 键集白名单 | 契约 `SECTION_23_FIELDS` + `assertSection23Shape` 贯穿；OG-1a `Object.keys().sort()` 精确键集锚；EM-C7 金标行 `update-sent|bytes,connectionId,namespaceId,sendQueueMs,sequence,side,type`（双发/丢键/乱序皆红） | **符合** |
| 值语义锚 | OG-1a 判定值 === `decodeMessage(...).update.byteLength`（跨 127/128、16383/16384/16385 + 确定性取样）；EM-C4a `sequence == stamped == wire [8..12]`；EM-C2a `toBe(connectionKey)` 取值断言（非键存在） | **符合** |
| 清理与隔离 | 守卫 `closeFixture` ×全用例（close + settle）；SA7 真实时钟/120ms 有界驻留为观测仪器（宽界护栏防 flake），fake timer/内存管道为主；零真实网络/服务/常驻进程 | **符合** |
| Runner 覆盖 | 三新文件命中根 `vitest.config.ts` include `packages/*/test/**/*.test.ts`（配置实测）；SA7 文件命名/位置与 issue243/244 惯例一致 | **符合** |
| 回归面 | 既有测试全部零 diff（DENY 实测）；#421 test-d 冻结面 `[frame: Uint8Array]` 不受影响；SA3 包级 86/717 → SA7 87/722 全绿（引用证据） | **符合** |

## 8. Non-blocking observations

| ID | Severity | Observation | 建议处理 |
|---|---|---|---|
| M-1 | MINOR | §23.1 `update-sent` 行编辑形态：原行文本（除表尾 ` |` 终止符外）逐字保留为前缀，注记插入在终止符之前——程序化比对 `prefix == old[:-2]` 成立、语义文本 100% 保留，但严格字面「原行整行是前行的前缀」不成立（终止符位置移动）。SA8 实现复查 IA-7 已裁决为追加注记（clear），SA4 N2 同判登记 | 无需改动；后续票对冻结表行尾追注可统一为表外脚注形态以消歧（SA4 N2 同建议） |
| M-2 | MINOR | `HubSendAccounting` 形状三处拼写（`hub-split.ts` 具名类型 + `UpdateChannelHost.sendUpdateFrame`/`HubChannelHost.sendData` 内联结构类型）：append-only 扩成员时结构化兼容不会在生产端产生类型错误（静默不产出新成员）。三处互指「同形同步维护」注释已落（SA2 O3 落实），SA4 N4 同判 | 无需改动；若该投影长出第二成员，抽到 peer/hub 中立模块具名类型 |
| M-3 | MINOR | 采样点前移使拒帧路径多一次 observer 门后的时钟读（hub）/纯时钟读（peer）——SA2 O4①、SA8 §7.3 双双登记为 §23.4 合规微差（无 observer ⇒ 零时钟调用链路不变；有 observer 时额外读数不产生事件、无绝对时间戳入事件、无契约断言受影响）；实现注释已钉死 | 无需改动；已充分登记 |
| M-4 | MINOR | SA2 O2 要求两处绑定箭头各留注释：`hub-session.ts:62-63` 注释在位于箭头本体；`hub-namespace.ts` 侧注释落在被调方法 `sendUpdateFrame`（:1340）而非装配箭头（:248）本体——兜底语义（透传链 + EM-C4c 检测）在场，SA4 已验收为落实 | 无需改动；纯注释落点精度 |
| M-5 | MINOR | 交付 commit message 未携 issue 引用（`feat(ws-replication): split observer emission ownership`）；近期 MABF 交付惯例两种并存（`f40d016 feat(ws-replication): add hub replication edge factory`、`1278fd3 refactor(ws-replication): split hub edge and session host` 同样无引用）。类型/范围前缀符合 conventional-commit 惯例 | 无需改动；后续交付可携 `#NNN` 引用增强可追溯性 |

## 9. 结论

已提交最终交付（commit `a2c8d34`，单提交、parent = 点名 Parent PR head、空白检查绿）在全部标准维度符合仓库与工程标准：

- **规范逐字一致**：发射点拆分落地 ADR 0032 决策 5 既定语义（本票是兑现义务而非决策演进）；协议 §17 公式逐字、§23.1 行原文保留、§23.2/23.3/23.4 零触碰、ADR 决策区逐字节不变；字段集 append-only 冻结面零编辑（`types.ts` 零 diff）；
- **模块责任正确**：隔离单点零触碰且新发射点经同一单点、公共导出面零变化、缝类型内部化、FSM/认证/背压/关闭面零改动；
- **架构惯例自洽**：单漏斗恰一性四点结构性成立（grep 实测）、`cidField`/定偏移/本地 BE32 分层均复用既有先例、无平行机制；
- **单一事实源与生命周期对称**：sequence/connectionId/bytes/sendQueueMs 全部同源派生、跨缝只过差值；零新增 acquire、accounting 瞬态无泄漏路径；
- **文件范围精确**：21 文件 = ALLOW 九项 + 各 SA 固定产物，DENY 面 name-status 全集零命中，无临时/debug 残留；
- **测试质量达标**：契约零软化（mtime 序 + 复跑互证）、行为断言与正负控成对、精确键集/取值锚、守卫锚定新耦合面、runner 发现面真实。

SA6（approve）/ SA2（approve）/ SA8（设计 clear + 实现 clear，`requiresConflictRecheck=false`）/ SA4（approve）/ SA7（approve）的上游裁决链与本审查的独立静态复核结论一致。**approve。**

*SA9 只读审查：未修改代码、设计或测试；未运行测试；未启动服务；未调度其他 SA；未 commit/push/PR/finalize；唯一产出为本文件。*
