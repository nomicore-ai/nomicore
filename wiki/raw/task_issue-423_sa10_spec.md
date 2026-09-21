# SA10 Spec 审查报告 — issue #423（spec #415 T6）：observer 发射点拆分与降级口径

- 审查人：SA10（独立 spec 审查；只读复核，未修改代码/设计/测试，未运行测试，未启动服务）
- 审查对象：最终已提交交付 diff = `1f5809b001c984e63fac3bafd4c1f3febc76e8a8..a2c8d34c8032ef695eab2a1d4af7ec7ca58edc10`（分支 `mabf/issue-423`，单提交 `feat(ws-replication): split observer emission ownership`，工作树干净）
- 基线核对：`git merge-base HEAD origin/spec/415-replication-transport-decoupling` = `1f5809b` = 父 PR #416 新解析 head（与 Host 声明逐字一致）
- Issue 原文复核：`gh issue view 423 --json title,body,state,comments` —— body 与任务简报逐字一致（What to build + 6 条 AC + Blocked by #421）；**comments = []**（无 owner 要求，与 Host 简报一致）

## 结论速览

**verdict = approve**。6 条 AC 全部满足（无 unmet/partial/unachievable）；What-to-build 七项义务逐项落实；
无 scope creep（改动面 = 设计 §11 ALLOW LIST 精确落位 + 上游契约/证据产物）；DENY LIST 全零改动经
`git diff --name-only` 实测。两处 MINOR 观察（不阻断）与 PR 必须披露的未达成项见 §4/§5。

## 1. 输入与上游门禁状态

| 输入 | 状态 | 消费方式 |
|---|---|---|
| `wiki/raw/task_issue-423.md`（简报）+ issue #423 原文 | 一致 | AC/What-to-build 逐条对照实际 diff |
| `task_issue-423_design.md`（SA1） | 在场 | §D1–D6、§11 ALLOW/DENY 对照 |
| `task_issue-423_sa6_contract.md`（approve）+ 契约测试 21 用例 | 在场 | 验收契约；3 红基线 {EM-C2a/C4a/C4b} 结构复核 |
| `task_issue-423_sa2_review.md` | approve，0 BLOCKER/MAJOR | O1–O5 落码核对（SA4 已逐项验证，本审查抽核一致） |
| `task_issue-423_design_conflict_report.md` / `_implementation_conflict_report.md`（SA8） | 双 clear；`requiresConflictRecheck=false` | 冻结面清单对照实际 diff |
| `task_issue-423_sa3_impl.md` / `_sa4_review.md`（approve）/ `_sa7_report.md`（approve） | 在场 | 验证声明与 diff 静态一致性核对（SA10 不复跑测试） |
| 规范面 | ADR 0032 决策 5/4/2（:30/:26/:18）、协议 §17/§22/§23.1–23.4 | 逐字对照 |

## 2. AC 逐条裁决（对照已提交 diff 的静态证据）

| AC | 裁决 | 证据（已提交快照实测） |
|---|---|---|
| AC1 每型发射侧有测试锚定；字段集与 §23 注册表逐字一致 | **met** | EM-C1a–e（edge 归属 + 双向零越界负控）+ EM-C4a/b/c（`update-sent` 侧归属）；`SECTION_23_FIELDS`（契约 :168-260）逐行对照协议 §23.1 现行 17 型表（:726-783）——required/optional 拆分逐字吻合（唯一偏差见 §4-M1，惰性）；`assertSection23Shape`（键集 ⊆ 注册集 + 必填在场 + 零二进制/零 Error/零异常原文）贯穿全部用例；`types.ts` 零改动 |
| AC2 缺面降级（shim 无 bufferedAmount/onPong ⇒ 字段缺失，非 0/非 undefined 值；conformance 断言） | **met** | EM-C3a（`'bufferedAmount' in ev === false`）/ C3b 正控（0 与 12 真实读数在场）/ C3c（缺 clock ⇒ `sendQueueMs` 整键缺席）/ C3d（无 ping/onPong ⇒ 零 liveness 事件）；新面同纪律：宿主直驱帧 `sendQueueMs` 整键缺席（`hub-edge.ts:867` 条件展开；OG-5a 两态断言） |
| AC3 授权拒绝路径 namespace-error/namespace-failed 由 edge 发射且字段正确（connectionId 在场纪律） | **met** | `hub-edge-host.ts:610/626/637` 三发射点统一 `...cidField(this.port.connectionId())`（`observer.ts:113-118` 单点，零改动）；EM-C2a 取值断言 `toBe(connectionKey)`、EM-C2b throw 族键集 ⊆ §23 + SENTINEL 零泄漏、EM-C2c pre-connection 无键负控；EM-C1b 恰一 + wire ERROR 帧锚 |
| AC4 observer throw 隔离两侧成立（dispatchReplicationObserver 单点语义不变） | **met** | `observer.ts` 不在 diff（实测）；新发射点 `emitUpdateSentAtStamp` 经同一单点分发（`hub-edge.ts:861-870`）；EM-C5a（edge 公共出面，全抛 observer wire 逐帧相等）/ EM-C5b（单体组合业务收敛不变） |
| AC5 maxConcurrentAssembliesPerConnection 分片口径写入协议/ADR；listen 计数口径不变（回归锚） | **met** | 协议 §17:582 新增子条目（聚合上界 = limits × worker 数，与 ADR 0032:30 逐字；listen 保持 per-connection，符号引用 `inboundAssemblySlots` 实存）；ADR 0032:45 后果节注记（决策区 hunk 零触碰实测）；运行时零改动（`tryBeginInboundAssembly`/`inboundAssemblySlots` 不在 diff）；EM-C6a/b listen 回归锚（limit 键驱动、释放再纳、缺省 4→第 5 拒） |
| AC6 单体组合形态事件序列与拆分前逐字一致（无重复/无缺失/无乱序断言） | **met** | EM-C7a/b：`PRE_SPLIT_LIVE_GOLDEN`（10 项，含 `update-sent|bytes,connectionId,namespaceId,sendQueueMs,sequence,side/type` 行 + sequence=7）与 `PRE_SPLIT_DENIED_GOLDEN`（4 项）逐字相等断言 + 显式无重复（Set 尺寸）/无缺失（长度）重述；次序恒等结构性论证（新发射点与旧点同一同步栈、两点间零 observer 事件）落码于 `update-channel.ts:355-362` 注释 |

## 3. What-to-build 逐项裁决与关键实现事实（独立静态复核）

| 义务 | 裁决 | 关键事实（grep/diff 实测） |
|---|---|---|
| edge 发连接域事件（5 型列举） | met（既有面保持 + 锚定） | `setConnState`/liveness/水位事件均不在 diff；EM-C1a + EM-C1e 负控（session 半边零连接域事件 ∩ 8 型集合） |
| 依赖盖章后 sequence 的出站事件（update-sent 族）归 edge | met | src 内 `type:'update-sent'` 构造仅剩 `hub-edge.ts:861`（hub）与 `peer-namespace.ts:1571`（peer，零改动）；发射点 = `port.sendDataFrame` 包装（`hub-edge.ts:267-271`，`seq>0` 门后）；**单漏斗实测**：hub data 帧调用方 = `hub-session.ts:221`（UPDATE）/`:262`（UPDATE_CHUNK）/`hub-edge-host.ts:695`（egress 直驱）三路汇聚，`tryEmitDataFrame` 直调仅包装自身，消息形态 `tryEmitData` 仅 peer——恰一性结构性成立；族作用域裁决（仅 `update-sent` 携 `sequence` 键；chunked/bootstrap/sync 族不迁）经 SA6 U1/设计 D4.2/SA8 IA-12 三方同判并文档化（§23.1 归属表） |
| 授权拒绝事件 edge 复现 + connectionId 在场 | met | 见 AC3；缺口 A（#421 遗留字段缺口）收口 |
| session 发 namespace 域事件、update-acked 留 session | met | `hub-namespace.ts` diff 仅 `onUpdateSent` 抑制普通分支 + 透传签名；`update-acked`/bootstrap/sync/resync 发射体零触碰；EM-C1d 负控 |
| 字段集 append-only 不变 | met | `types.ts` 零改动；edge 构造体键集 {type,side,connectionId?,namespaceId,bytes,sequence,sendQueueMs?} ⊆ §23.1:745 行；金标行键齐 |
| 缺面 dormant 纪律平移 | met | `sendFailureContext`/shim 面零触碰；新增 egress 面无 accounting ⇒ 整键缺席（OG-5a/EM-C4a 锚） |
| maxConcurrentAssembliesPerConnection 分片 per-session 口径文档化 | met | 协议 §17 + ADR 0032 后果节双登记；公式逐字；listen 不变（EM-C6 锚） |

**实现正确性抽核（probe 判定纪律）**：codec 字段序实测 `payloads.ts:627-634`（UPDATE = `writeVarString(namespaceId)` + `writeVarUint8Array(update)`）；`NAMESPACE_ID_RE = /^ns-[0-9a-f]{32}$/`（35 ASCII ⇒ 前缀恒 1 字节）；probe（`hub-edge.ts:885-906`）= 型门 `[5]===0x40` + `[20]===35` + id 窗口 `[21,56)`（与 `routingKeyOf:612-620` 同 `asciiAt` 同窗口先例）+ varUint ≤5 字节定偏移读 + 双长度交叉校验（`byteLength===20+payloadLength ∧ payloadLength===1+35+varUintBytes+updateLen`）；`ENVELOPE_HEADER_BYTES=20`、`MESSAGE_TYPES.UPDATE=0x40` 单源 import。校验不过 ⇒ dormant 零 throw 零事件（守卫 OG-3/4a/b/c 锚定），符合 §23.4「观测面失败不改变协议结果」。

**红灯基线可满足性（静态）**：EM-C2a 断言的 `connectionId` 在基线三发射点确实缺席（diff 即补该三处）；EM-C4a 断言的 edge `update-sent` 在基线不存在（diff 新增发射点）；EM-C4b 断言的 session 零发射在基线不成立（diff 删除 session 发射体）——3 红指向缺失事实本身，非契约不可满足。契约/守卫/SA7 测试文件无 skip/only/todo/env override（grep 零命中）；`git diff --check` exit 0。

**SA3/SA7 验证声明与 diff 一致性**：契约 21/21 ×3、守卫 10/10、包级 86→87 files（717→722）全绿、包级+根 typecheck exit 0、SA7 独立复跑（31/31、59/59、149/149、722/722）——声明的测试文件与断言面均实存且与本审查静态核对一致；本角色按纪律不复跑。

## 4. MINOR 观察（不阻断 approve）

| id | 观察 | 影响面 |
|---|---|---|
| M1 | 契约 `SECTION_23_FIELDS` 的 `update-dropped` 行把 §23.1:774 中无 `?` 的字段（updateBytes/maxUpdateBytes/queued*/channelState/connectionState）归类为 optional——对该行的 required/optional 拆分不严格「逐字」 | 惰性：该型在契约全部场景中零触发（golden 亦无此行），断言永不消费该注册行；已发射事件的精确键集由 EM-C7 金标与 `observer-red` 白名单锚定。建议后续票收紧该行（非本票义务） |
| M2 | AC1「每型」字面覆盖边界：契约逐型断言覆盖场景可达型 + 侧归属不变量双向零越界；稀有故障族（connection-backoff-scheduled/goaway-received/schema-rearm-*/identity-conflicted/chunked-aborted/timer 族）由既有逐型套件承载而非本契约逐型重锚 | 已登记裁决（SA6 U3，下游 SA2/SA4/SA8 均接受）；36 型归属映射已由 §23.1 新增「发射侧归属表」文档化补齐语义面 |

另注（非 finding，已裁决记录）：§23.1 `update-sent` 行编辑为**行尾追加注记**（原文逐字保留为前缀，diff hunk 实测），SA8 两轮报告均裁为 append-only 合规；SA4 N1–N5 非阻断观察与 SA8 §6 两条登记性措辞 follow-up 维持原判。

## 5. PR 必须披露的未达成项/边界（均非本票 AC 必要条件，已逐级登记）

1. **分片（worker）形态运行时锚未交付**：per-session 计数端到端实测、正式 session 侧 transport shim 出面、宿主直驱帧在真实跨进程部署下的观测，依赖 T3(#420)/T5(#422)（仍 OPEN）——SA6 U4、设计 §13、SA3 Deferred-2、SA7 登记一致；本票 AC5 的交付面 = 文档口径 + listen 回归锚（已交付），AC2 等价面经内部缝夹具建立。
2. **根全仓门禁**：根 `pnpm test`（14 包 + apps/yjs-server）按流程由 Host 执行（SA6 U6）；SA3 已跑受影响包全量套件 + 根 `pnpm typecheck` exit 0，SA7 包级 722 全绿。
3. **真实时钟域 `sendQueueMs` 残差**：同步栈微秒级残差无绝对值断言；SA7 实测 0.007–0.121ms（亚毫秒/真实驻留两态），手动时钟域精确值 `[0, 4_000]` 由 issue238 套件锚定。
4. **follow-up 登记（非义务）**：CONTEXT.md「路由键契约」词条是否并入 egress 判定面（SA8 §6-1）；§23.1 注记是否显式覆盖 peer 侧采样点措辞（SA8 §6-2）；SA4 N4 `HubSendAccounting` 三处同形拼写在扩第二成员时抽中类型。

## 6. 范围与冻结面核对

- **ALLOW 落位精确**：6 src（hub-edge-host +9 / hub-edge +118 / hub-namespace +63−45 / hub-session +15 / hub-split +25 / update-channel +39−16）+ 1 新守卫测试 + 2 文档；契约测试与 SA7 动态测试为上游/惯例产物；wiki/artifacts 为流程证据（与既有票提交惯例一致）。
- **DENY 零改动（实测 `git diff --name-only`）**：`index.ts`/`testing.ts`（公共面）、`types.ts`（事件词表）、`observer.ts`（隔离单点/cidField）、`frame-io.ts`（盖章单点）、`backpressure.ts`、`hub-connection.ts`、`peer-connection.ts`/`peer-namespace.ts`（peer 不拆分）、`hub-upgrade-admission.ts`/`liveness.ts`/`plugin.ts`/`defaults.ts`/`validate.ts`、`packages/replication-protocol/**`（零 wire/codec 变化）、SA6 契约与证据日志。
- **无 scope creep**：零新事件型/字段/错误码/公共 API/wire 变化；缝 append 为内部纯 JSON 可选参数（`HubSendAccounting` 不进公共入口，实测 `index.ts`/`testing.ts` 零改动）。
