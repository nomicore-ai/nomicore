# 冲突门禁报告（设计后复审）— issue #447

**被审对象**：SA1 设计 `wiki/raw/task_issue-447_design.md`（**修订版，668 行**：γ-T1 公共异步会话工厂 + 延迟注入异步 FIFO 管道夹具 + 首个跨缝协议回合）
**门禁类型**：设计后复审（design 复查；SA2 攻击评审不在 SA8 职责内）
**门禁轮次**：iteration 1（dispatch `sa-e988c060-03b2-4e18-a64f-3f4b47fba3ba`；对 iteration 0 报告的原位更新——只反映当前被审对象，历史结论以「闭环核验」形式并入）
**基线**：worktree HEAD `c86ccbc`（`Spec #445：γ 真 worker 形态设计工件`）；设计基线声明一致；规范文本（ADR 0032 A4 / 协议 §24 / CONTEXT.md）零改动（git status 证实仅 wiki/raw 与 artifacts 为未跟踪新增）。

---

## 1. Reviewed subject

- subject = **design**（`wiki/raw/task_issue-447_design.md` 修订版全文逐节审读；§14 修订映射声明 F1/F2/SA8-E1/E2/E3 + O1–O7 全部落实）。
- 上游输入：Host 简报 `wiki/raw/task_issue-447.md`（Issue #447 正文 + AC×6）；SA6 契约 `task_issue-447_sa6_contract.md`（approve；GAP-1..6 + ORACLE/NC；探针日志 `artifacts/sa6-issue447-*.log` 8 份，本轮抽查 GAP-1/ORACLE-3 原文）。
- 评审输入：SA2 攻击评审 `task_issue-447_sa2_review.md`（verdict `reject`：F1 ackTimeout 计时器哑火 + F2 γ 分块机械零可执行覆盖；O1–O7；明示其 F1/F2 与 SA8 E1/E2 互补、修订应四项合并）；SA8 iteration 0 报告（本文件前身，verdict `reject`：E1 时序契约 + E2 词汇登记两项阻塞）。
- 前置门禁产物 `task_issue-447_relevant_decisions.md` / `task_issue-447_conflict_report.md` 仍不存在（dispatch 明示本轮为设计后复审；决策集盘点以本报告 §2 为准）。
- **Issue 评论 REST 快照为空**（简报 `## Comments` 节空 + dispatch 明示）⇒ **无 Owner override 权威可用**；Owner 要求 = 简报正文。
- **闭环核验义务**（dispatch 指定）：iteration 0 两项阻塞发现——E1（时序契约：分块族 `chunkedAckT0` t0 口径）与 E2（词汇：模块 AGENTS.md 缝词汇登记缺位）——是否在修订版中按合格路径闭合。结论：**均闭合**（见 §3 #14/#19 与 §6）。

## 2. Inputs and decision set

决策集读取（全部现行为准，非转抄设计声明；本轮对修订版新增落点逐条重核原文）：

| 决策源 | 状态 | 相关条款 |
|---|---|---|
| `docs/adr/0032-transport-decoupling-edge-session-split.md` | 已接受（含附录 A1–A4） | 决策 2（:18 零 worker_threads）、决策 5（:30 观测纪律）、A1（:41 β 同步签名冻结）、后果（:112 公共面发布即冻结 append-only、:113 #423 sendQueueMs dormant 注记）、A4.1–A4.8（:59-99：载体/词汇 :61-65、保序与两相记账/三态锚 :69-75、流控 :79、pacing :83、生命周期 :87、回执≠接纳 :91、**观测口径 :95（t0 = 推送时刻）**、验收 :99） |
| `docs/protocols/instance-replication-v1.md` §24（:1091-1154） | 规范文本（§24 头注：host-facing 契约，非 wire 契约） | §24.1（:1097）、§24.2 义务 6 条（:1101-1106）、§24.3 词汇闭集合（:1108-1120）、**§24.4 两相记账 + 三态锚 + 「ackTimeout 锚定与单体内核同构」（:1126-1128，:1127）**、§24.5（:1130-1139）、§24.6（:1141-1143）、§24.7（:1145-1147）、**§24.8 观测口径（:1149-1154，:1152 t0 = 推送时刻）** |
| 同上 §3（:16/:23）、§17、§18、§21、§23.1 事件表（:741-757） | 已接受 | 序号纪律；账本/轮转；`closeTimeoutMs`；事件字段冻结（update-sent :745、update-acked :747、chunked-update-acked :751、chunked-snapshot-acked :754、chunked-sync-acked :757——:751 的「ACK 处理时刻 − 末 chunk 出站时刻」为 α/β 语义，γ 读法由 §24.8:1152 补充） |
| `CONTEXT.md` | 现行词表 | 「SessionHost（复制会话宿主）」:229-231（含 γ 段与 `_Avoid_`）、「序回执（sequence receipt）」:233-235（含 `_Avoid_`）——本轮重核原文 |
| `packages/ws-replication/AGENTS.md` | 模块契约（模块 AGENTS 明确收录的决策入决策集） | :17 缝纪律条款（词汇枚举句，git log 证实最后修改 `feb9ec5`、早于 A4 落入的 `c86ccbc`）；:20 工厂 append-only；:22 生产 API 经 `src/index.ts`；:26 验证纪律（every changed state-machine path 聚焦测试） |
| `docs/AGENTS.md` | 文档纪律 | 「When code behavior changes, update every normative document whose stated contract changed」（E2 的义务依据） |
| 其余 ADR 全集 | 无 superseded 影响本票 | ADR 0010/0012/0013/0022 经模块 AGENTS 引入为背景权威；本票不改 wire/分块/身份语义 |

代码事实独立核实（本轮针对修订版新增机制重核；代码只作当前事实确认，不替代决策文本）：

- **E1 落点**：`bulk-transfer.ts:213` `state.request.onLastChunkSent(seq, this.settlementOf(state))` 现为两参回调、末 chunk 出站同步栈触发（:209-218）+ kind=2 自持 timer（:217/:253-265）；`hub-namespace.ts:608`（kind=1）/`:780`（kind=2）两处 `this.chunkedAckT0 = this.sampleAckT0()` 均在回调内（:603-608/:775-780）⇒ 设计的 append-only 第三参 `pushedAt?` + `chunkedAckT0 = pushedAt ?? this.sampleAckT0()` 物理可行，α/β 下 `pushedAt` 缺省 ⇒ 采样点/时点均逐字节不变。普通族先例：`update-channel.ts` `onAck` 的 `entry.sentAt` 差值机制（:239-243）——设计 pendingSends 条目 `sentAt`（§8.6）为其镜像。
- **F1 落点**：`update-channel.ts:607` `if (this.inFlight.size > 0) this.abandonInFlight()`（计时器回调守卫）、`:229` `if (this.inFlight.size === 0) this.disarmAckTimer()`（拆除判据）、`:231-235` wasOldest 重锚——与设计 §8.6.1 扩展点逐点对应；`pendingSends` 为无条件私有字段 ⇒ α/β 谓词逐值退化（合并占用判据在 `pendingSends ≡ ∅` 时与既有判据等值）。
- **E2 落点**：`packages/ws-replication/AGENTS.md:17` 枚举句原文核实；句内 `(and the append-only \`connection-fatal\` signal)` 即既有 append-only 登记先例——设计 D12 的追加句同形。
- 其余沿用 iteration 0 已核事实并抽查：`src/index.ts` 15 值导出（SA6 探针 GAP-1 运行期证实：`artifacts/sa6-issue447-probe.log`）；`hub-session-host.ts:64-66` β `(frame, lane) => number` 冻结签名；`hub-edge-host.ts:118-127` egress 返回盖章序（0 = 未发送/被拒）；`hub-namespace.ts:128`（锚两态载体）/:665-673（判别+复位）；`types.ts:1029-1030` + `round-engine.ts` 全部 `ownStep1/2Seq` 出现点（grep 重证：仅此两文件，peer 零命中）。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0032 A4.1 + 后果 | `:59-61` 新工厂/句柄类型、`src/index.ts` append-only；`:112` 发布即冻结 | §8.1 新模块 + **6 个新导出（1 值 + 5 类型，计数已按 SA2-O1 统一；值导出 15 → 16）**；既有 15 值导出与类型零改名零删除；TD-C2 非回退块 | implements-existing-decision | 设计 §8.1/§11/§12（PUB-C1 断言 16 值导出口径已定死）；`src/index.ts` + GAP-1 探针 | — |
| 2 | ADR 0032 A1 + A4.1 | `:41` β 同步签名冻结；`:61` γ 不修改 β 面 | D1 独立新工厂/句柄；`hub-session-host.ts` 入 DENY；γ 监听者 fire-and-forget 返回 void，0 值语义与 β 逐字同构；`onFrame` 监听者 throw 原样传播（β `deliverFrame` 镜像，SA2-O7 落实） | implements-existing-decision | 设计 D1/§8.1/§8.3/§11 DENY；`hub-session-host.ts:64-66`；ORACLE-3 | — |
| 3 | 协议 §24.3 + A4.1 | `:1110-1119` 七消息闭集合；`:1120` 无拒纳/闸门/信用词汇 | §8.2 逐字落地 7 消息；SEAM-C1（type 键集 ⊆ 闭集合）、SEAM-C3（receipt 键集恰 `{tag,sequence}`）；无任何拒纳/闸门/信用词；词汇的模块契约登记随实现落盘（D12，见 #19） | implements-existing-decision | 设计 §8.2/§12；§24.3 表 | — |
| 4 | 协议 §24.2.3 + A4.2 | `:1103` 盖章点同步投回执、先于后续 socket 数据 | D3/§8.7：桥在 egress 返回值同一同步段 enqueue `receipt`；同通道 FIFO ⇒ 回执先于 ACK；生产 edge/`frame-io` 零改动（`hub-edge-host.ts:118-127` 公共返回值契约兑现） | implements-existing-decision | 设计 D3/§8.7/§8.9；`hub-edge-host.ts:118-127`；SA6 H4 | — |
| 5 | 协议 §24.2.4 + A4.1 | `:1104` tag 由 session 分配、会话域内单调唯一、纯 JSON | D2：每句柄计数器自 1 严格递增；tag 校验单点在 γ port 层；否决「宿主分配」「复用 wire 序号空间」 | implements-existing-decision | 设计 D2/§8.3；CONTEXT「序回执」`_Avoid_` | — |
| 6 | 协议 §24.1/§24.2.1-2 | `:1097/:1101-1102` 每会话一对专用通道；FIFO 不丢不重不乱序 | §8.8 `SeamHub` 按二元组键控通道对；PIPE-C1/C2；零自动投递（显式 release） | implements-existing-decision | 设计 §8.8/§12 | — |
| 7 | 协议 §24.2.6 + A4.2 | `:1106` 违契响亮收口、无静默降级 | §8.3/§9.1：未知/重复 tag、非法 sequence ⇒ `CONNECTION_POLICY_VIOLATION` → 既有 1008 单点映射；ANCHOR-C2 扣回执 + 直投 ACK ⇒ `ACK_STATE_VIOLATION` 1002 零 park；已 close/fatal 与 abandon 后迟到回执的防御性 no-op 沿 iteration 0 #7 裁决（终态后无剩余收口对象；abandon 后 no-op = β zombie 同构，§23.1:751「弃置后 zombie 迟到 ACK 零事件」同族） | implements-existing-decision | 设计 §8.3/§9.1/§9.3/§12；`hub-edge.ts` `wsCloseCodeFor`；§23.1:751 | — |
| 8 | 协议 §24.4 + A4.2 | `:1126-1128` pending 自推送占窗、回执换键不换槽、三态锚；`:1127`「ACK 结算、**ackTimeout 锚定与单体内核同构**」 | §8.5 三态锚（判别语义不变：idle ∨ pending ∨ 不等 ⇒ 违例，非 park）+ §8.6 `pendingSends` 独立 tag 键空间计入 `effectiveInFlightCount`（D4）；PEND-C1 语义澄清（槽位于 ACK 释放）以 §24.4 为权威 | implements-existing-decision | 设计 §8.5/§8.6/D4/D7；§24.4:1126-1128；A4.2:75 | — |
| 9 | **协议 §24.4:1127（ackTimeout 锚定同构）——修订版新增机械（SA2-F1 落点）** | 「入 in-flight 账（ACK 结算、ackTimeout 锚定与单体内核同构）」 | §8.6.1：`hasUnsettledSends() = inFlight.size + pendingSends.size > 0` 统一计时器回调判据与 `onAck` 拆除判据（D10）；**不含 activeTransfer**——与单体内核管辖面逐点同构（β 判据 `inFlight.size` 本就不含 transfer 槽；kind=1/2 载体各有自持/宿主 timer，代码核实 `bulk-transfer.ts:253-265`、`hub-namespace.ts` bootstrap timer）；谓词不 γ 门控（`pendingSends` 无条件字段、α/β 恒空 ⇒ 逐值退化为既有判据，单份实现/FSM 零分叉）；「占用非零 ⇒ 武装」经产生/消灭点归纳论证；PEND-C3 行为断言 + 变异负控。pending-only 弃置后 `declareHubResync('ack-timeout')` 恢复链 = 既有单漏斗（`hub-namespace.ts:1290-1327`） | implements-existing-decision（实现 §24.4:1127 明文同构义务；设计已列入 §15-3 复查项，处置恰当） | 设计 D10/§8.6.1/§9.1/§12 PEND-C3；`update-channel.ts:601-609/:224-235` 现状核实；§24.4:1127 | — |
| 10 | ADR 0032 A4.3 + 协议 §24.5 | `:79/:1132-1139` 流控单点 edge；session 乐观发送；越界 1011；无逐帧拒纳 | D5：γ adapterPort `dataGateOpen:()=>true`/`bufferedAmount:()=>undefined`（A3 dormant 先例，A4.3 自引）；§9.4 内存安全链逐跳有界 + pending 占窗经 ackTimeout 释放（§8.6.1 使该链机械成立）；「egress ≤0 不投回执」登记于 §9.1 | implements-existing-decision | 设计 D5/§9.1/§9.4；A4.3:79；§24.5 | — |
| 11 | ADR 0032 A4.4 + 协议 §24.6 | `:83/:1143` 自驱 drain 三触发点；推完即停；公平性显式放弃 | D6：触发点①入队 ②每条入站缝消息消费后（「ACK 到达」保守超集，幂等 no-op）③transfer 末 chunk 回执结算；无 busy loop；公平性放弃为 A4.4 显式接受 | implements-existing-decision | 设计 D6/§8.3/§8.10；A4.4:83；§24.6:1143 | — |
| 12 | ADR 0032 A4.5 + 协议 §24.7 | `:87/:1147` 生命周期单规则 | §9.2：close 同道 FIFO；pending 整体冲刷按未发送清算（teardown + pending 清空 + `unresolvedTags.clear()`）；`terminateUnauthorized` 幂等不溯及；`settled` 晚到只多等；`closeTimeoutMs` 不动 | implements-existing-decision | 设计 §9.2；A4.5:87 | — |
| 13 | ADR 0032 A4.6 + §24.3 | `:91/:1116` receipt = 序号事实回传，非接纳信号 | §8.2/§8.6：receipt 只 `{tag,sequence}`；消费面 = rekey/锚回填/触发既定 drain；发送决策在 edge 盖章点同步完成 | implements-existing-decision | 设计 §8.2/§8.6；A4.6:91 | — |
| 14 | **ADR 0032 A4.7 + 协议 §24.8 + §23.1（时序契约）——iteration 0 E1 闭环核验** | `:95/:1152`「`ackLatencyMs` 的 t0 = **推送时刻**（含管道与 edge 等待，口径略宽于 β）」；§23.1:747/751/754/757 字段冻结 | **修订版已按路线 (a) 闭合**：D9——① update/chunked-update 族：`pendingSends` 条目 `sentAt` 推送同步段采样、回执 rekey 携带（镜像既有 `onAck` sentAt 差值机制）⇒ t0 = 推送时刻；② 分块 snapshot/sync 族：`BulkTransferSender` γ async 分支在**推送调用边界**采样 `pushedAt` 携于 `pendingLastChunkTag = {tag, pushedAt}`，末 chunk 回执结算经 `onLastChunkSent(sequence, settlement, pushedAt?)`（append-only 可选第三参——代码核实现状恰两参，扩展面成立）回传，`hub-namespace.ts:608/:780` 写 `chunkedAckT0 = pushedAt ?? this.sampleAckT0()` ⇒ γ t0 = 末 chunk 推送时刻，**逐字符合 §24.8:1152 / A4.7:95 登记（含管道与 edge 等待、口径略宽于 β）**；③ α/β：`pushedAt` 缺省 ⇒ `sampleAckT0()` 仍在末 chunk 出站同步栈回调内触发，采样点与时点逐字节不变（§23.1:751 α/β 语义与既有 301 族断言零触碰）；④ 「已知精化点/follow-up」表述删除（R4 划线闭合）、规范文本零改动（§11 DENY）、CHUNK-C3 为行为断言落点（含「t0 改回执时刻 ⇒ 红」变异负控与 β 不回归断言）。iteration 0 要求的二择一以 (a) 达成，无 follow-up 让渡、无 amendment 需求 | **implements-existing-decision（E1 闭合）** | 设计 D9/§8.6（bulk 段）/§8.9/§9.5/§11 ALLOW（bulk-transfer.ts/hub-namespace.ts 行）/§12 CHUNK-C3/§13-R4/§14；§24.8:1152；A4.7:95；§23.1:747/751/754/757；`bulk-transfer.ts:209-218`、`hub-namespace.ts:603-608/:775-780`、`update-channel.ts:239-243` 现状核实 | —（实现期核对代码路径与登记文本一致 = §10 复查项） |
| 15 | ADR 0032 A4.8 | `:99` 成功路径与 β wire 逐字节等价；延迟可注入显式异步内存管道、零 worker_threads；既有矩阵全绿硬门 | §8.8 显式 release 通道对 + §12 ROUND-C1/C2/C3（**单帧与真实分块两构型各跑**，ROUND-C2 parity 含分块形态）+ PUB-C2（271 + 825 全绿硬门）+ PIPE-C3 结构门 | implements-existing-decision | 设计 §8.8/§8.9/§12；A4.8:99 | — |
| 16 | ADR 0032 决策 2 + A4.1 + 模块 AGENTS:17 | `:18/:61` 零 worker_threads/MessageChannel 依赖或类型 | 非目标明示；夹具纯内存零线程零真实 timer；PIPE-C3 结构门（420 门自动覆盖新 src 文件） | implements-existing-decision | 设计 §1 非目标/§8.8/§12 | — |
| 17 | 协议 §24 头注 + A1 | `:1093` host-facing 非 wire 契约；`:40` 不新增 wire 面/错误码/事件型 | 非目标明示；`CONNECTION_POLICY_VIOLATION`（→1008）为既有码复用（新触发面 §15-3 登记）；映射单点留 edge；事件字段集零变化（tag 不得进入任何事件键集——D9 末条 + TD-C1 锁定） | no-conflict | 设计 §1/§8.3/§9.5/§15-3；§24:1093；A1:40 | — |
| 18 | ADR 0032（peer 不拆分） | 状态行；后果 `:113` | DENY peer 文件；`ownStep1/2Seq` 类型替换后 peer 写点仍走 stamped 分支（本轮 grep 重证：仅 `types.ts:1029-1030` + `round-engine.ts` 出现） | no-conflict | 设计 §8.5/§10/§11 DENY；本门禁 grep 复核 | — |
| 19 | **`packages/ws-replication/AGENTS.md:17` + `docs/AGENTS.md` 纪律（词汇登记）——iteration 0 E2 闭环核验** | :17「the seam carries only namespace-domain frames … plus the `close`/`terminateUnauthorized`/`settled`/`closed` control signals (and the append-only `connection-fatal` signal)」；docs/AGENTS.md「When code behavior changes, update every normative document whose stated contract changed」 | **修订版已闭合**：D12 + §6 + §8.2 末段 + **§11 ALLOW 新行**——`packages/ws-replication/AGENTS.md` append-only 补一句 γ 缝词汇登记（出站帧携 `tag`/`lane`、edge→session 增 `receipt{tag,sequence}` 序回执；引 ADR 0032 A4 + 协议 §24；仍无拒纳/闸门/信用词汇），既有枚举句与冻结面零改写，与 γ 代码**同变更集**落盘；备选（改写枚举句/另立票）均否决且理由成立。iteration 0 要求的合格路径（ALLOW 纳入 + append-only 登记 + 同变更集）逐项满足；登记句为既有 `connection-fatal` append-only 先例同形。**落盘本身属实现变更集动作**（本文件仍为 `feb9ec5` 原文——与 E2 合格路径一致，非缺口） | **implements-existing-decision（E2 闭合，设计面）** | 设计 D12/§6/§8.2/§11 ALLOW/§13-R7；`packages/ws-replication/AGENTS.md:17`（原文 + git log `feb9ec5`）；`docs/AGENTS.md` 纪律 | —（登记句随实现落盘 = §10 复核项） |
| 20 | ADR 0032 A4.1 与 A4.2 措辞张力（iteration 0 E3） | A4.1:61「`HubNamespaceChannel` 零改动：全部变化在 port 实现、sink 组装层与 edge」 vs A4.2:75/§24.4:1128 明文三态锚/两相记账载体 | 修订版按 iteration 0 裁决登记执行：§8.5 末注全文登记读法（「零改动」= 判别逻辑/因果不变量保持；载体扩三态为 A4.2 明文命令；FSM 零分叉、单份实现、α/β/peer 逐字节不变、825+271 硬门）；如需措辞调和走显式 amendment（R3），本票不改 ADR | no-conflict（裁决已登记，维持 iteration 0 #9/E3 结论） | 设计 §6/§8.5 注/§13-R1；ADR 0032:61 vs :75；§24.4:1128 | —（可选 amendment 仍留后续 docs 票） |
| 21 | `CONTEXT.md` SessionHost / 序回执词条 | `:229-235` 含 `_Avoid_`（不重检 sequence、伪造序号、序号分配权下放、回执分道、γ 缝拒纳/闸门/信用词汇） | 全部保持：`handleFrame` 不重检；盖章单点留 edge；回执同通道 FIFO；无拒纳词汇；词汇与 γ 段/序回执词条逐字相容（本轮重核 CONTEXT 原文）。γ 工厂名（`createHubAsyncSessionHost`）规范未锁名——iteration 0 R4 的可选登记（实现落名后在 CONTEXT γ 段登记）维持非阻塞 | no-conflict | 设计 §8.1-§8.3；CONTEXT.md:229-235；SA6 §15-3 | 非阻塞（可选登记，维持 iteration 0 R4） |
| 22 | 包 AGENTS:26 验证纪律 + SA6 §15-2（修订版新增验收面，SA2-F2 落点） | 「Run the focused tests for every changed state-machine path」；SA6 §15-2「γ 需兼容 chunked 族」 | D11 路线 (a)：真实分块 γ 场景为**硬门**——`boot({ limits })` 既有注入面调小 `maxBootstrapBytes`/`maxSyncDiffBytes` 使小载荷真实走 kind=1/kind=2 改道（#256/#300/#301 先例；构型约束链 R6 对齐 `validate.ts` 启动期校验）；CHUNK-C1/C2/C3 断言末 chunk 回执结算锚、BOOTSTRAP_ACK/SYNC_APPLIED 回指、ANCHOR-C1 全量、ROUND-C2 parity 含分块形态、t0 口径断言；「超大载荷增强项」旧案删除；descope 备选因与 A4.4 触发点③「transfer 末 chunk 回执」及简报 AC 冲突而否决（理由成立） | implements-existing-decision（兑现包验证纪律；非决策冲突面） | 设计 D11/§8.9/§12 CHUNK 行/§13-R6；`packages/ws-replication/AGENTS.md:26`；SA6 契约 :249 | — |

另核（无独立冲突点，证据沿用 iteration 0 + 本轮抽查）：§3 序号纪律（占位 + mux 单点重写 `[8..12]`）；§17 账本与 OPEN 水位定性；§18/§21 生命周期参数不动；ADR 0010/0012/0013/0022（wire/身份/分块 abort 语义零变化——§8.6 transfer 槽位语义与「洞中 transfer 结构性不存在」γ 读法同构保持：awaiting-ack 相位槽位持续占用、连接死亡 ⇒ quiesce 整体 abort）；ADR 0023（γ 工厂为普通工厂非服务表面）；§24.6 `sendQueueMs` 整键缺席 = 缝词汇无 accounting 载体的 dormant 形态（§23.1:745「宿主直驱 ⇒ 整键缺席」+ ADR 0032:113 注记同族，iteration 0 #14 已裁）。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| （无） | — | — | — |

无任何合法 override：Issue 评论 REST 快照为空（无 Owner 评论）；无新 ADR 修订/废弃；无协议版本升级。修订版亦未主张 override——E1 以「按登记口径实现」（路线 a）、E2 以「文档同步落盘」闭合，均无需 override，处置正确。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（设计面） |
|---|---|---|---|
| β 公共工厂/句柄面 | `createHubSessionHost`/`HubSessionHostConfig`/`HubSessionOpenInput`/`HubSessionHandle`/`HubSessionSignal`/`HubSessionFrameListener` 签名与行为逐字 | A4.1:61；A1:41；后果:112 | 保持（DENY + TD-C2 非回退块 + γ 复用纯 JSON 描述子） |
| 公共导出面 | `src/index.ts` 15 值导出 + 全部类型只增不改 | 后果:112；A4.1:61 | 保持（+6 append-only；PUB-C1 口径 16 值导出，O1 计数已统一） |
| wire 格式与序号纪律 | envelope/帧型/错误码/事件型/§3 每连接从 1 严格递增、`[8..12]` mux 单点盖章 | §24 头注:1093；决策 2:18；§3 | 保持（占位编码原样；ROUND-C2 逐字节 parity 含分块构型） |
| 缝词汇闭集合 | §24.3 七消息 + 无拒纳/闸门/信用词 | §24.3:1108-1120；A4.6 | 保持（SEAM-C1/C3 判据；AGENTS.md 登记为 append-only、不改写既有枚举句） |
| α/β/peer 行为 | 与 HEAD 逐字节等价；271 + 825 全绿为硬门 | A4.8:99；§24 头注 | 设计承诺 + PUB-C2 硬门 + §8.6.1 谓词退化同构 + D9 `pushedAt` 缺省退化 + CHUNK-C3 β 不回归断言（实现期复核） |
| peer 侧 | 不拆分、`ownStep1/2Seq` 消费点零改动 | ADR 状态行；后果:113 | 保持（本轮 grep 重证） |
| 错误码注册表与映射单点 | 不新增错误码；code→WS close code 单点 `wsCloseCodeFor` | A1:40；§24:1114 | 保持（复用既有 `CONNECTION_POLICY_VIOLATION`→1008） |
| observer 事件字段集 | append-only 不变；`ackLatencyMs?`/`sendQueueMs?` 在场纪律；tag 不得进入事件键集 | 决策 5:30；§23.1:745-757 | 键集不变；tag 不入事件（D9 末条 + TD-C1）；**t0 口径已按 §24.8 登记实现（#14）——α/β 侧 §23.1 语义逐字节不动** |
| §18/§21 生命周期参数与停机语义 | `closeTimeoutMs` 等不动；停机语义不变 | §24.7:1147 | 保持（§9.2 明示不动） |
| 规范文本 | ADR 0032 / 协议 §24 / CONTEXT.md 本票零改动 | §24 为 A4 的规范文本；E1 路线 (a) 无需 amendment | 保持（§11 DENY；git status 证实零改动） |
| 前序票冻结面（#420/#421/#422/#423） | 各公共面只增不改 | 模块 AGENTS:20；设计 §11 DENY | 保持（DENY 覆盖 edge/连接/插件轨/发射点归属） |

## 6. Evolution requirements

**无剩余 evolution-required 项。** iteration 0 的两项经修订版核验闭合：

- **E1（时序契约）→ 闭合（#14）**：修订版采路线 (a)——分块 snapshot/sync 族 t0 = 末 chunk 推送时刻，经 `pendingLastChunkTag.pushedAt` + `onLastChunkSent` append-only 第三参实现，逐字符合 §24.8:1152 / A4.7:95 登记口径；α/β 逐字节不变；「follow-up 精化」让渡删除；规范文本零改动 ⇒ **不构成决策演进，无修订计划义务**。合格路径判定：iteration 0 要求的 (a)/(b) 二择一以 (a) 满足，且机制落点（两参回调现状 + 两处 `chunkedAckT0` 写点 + sentAt 先例）经代码核实物理可行。
- **E2（词汇登记）→ 闭合（#19，设计面）**：`packages/ws-replication/AGENTS.md` 已入 §11 ALLOW，append-only γ 词汇登记句（引 ADR 0032 A4 + §24）与 γ 代码同变更集落盘（D12）；登记形态与该文件既有 `connection-fatal` append-only 先例同形，冻结面零触碰 ⇒ 文档同步义务在设计层面已完整承接，非决策演进。
- **E3（A4.1/A4.2 措辞张力）→ 维持非阻塞裁决（#20）**：调和读法已按 iteration 0 裁决登记于设计（§8.5 注），无需 ADR 修订即可实施；可选措辞调和留显式 amendment（不构成本票义务）。

## 7. Hard conflicts

无。全部 22 项对照落在 no-conflict / implements-existing-decision；iteration 0 的两项 evolution-required 均已按合格路径闭合；修订版新增机械（§8.6.1 合并占用判据、D9 第三参、D11 分块硬门、D12 登记句）未引入任何与决策集不兼容的对撞。

## 8. Required actions

| # | 级别 | 行动 | 归属 |
|---|---|---|---|
| R1 | 复核义务（实现期） | E1 代码路径与登记文本一致性核对：`pushedAt` 采样点 = 推送调用边界、`chunkedAckT0 = pushedAt ?? sampleAckT0()` 两写点、α/β `pushedAt` 缺省路径逐字节不变；CHUNK-C3（含变异负控 + β 301 族不回归）为断言落点 | SA8 implementation 复查 / 总控 |
| R2 | 复核义务（实现期） | E2 落盘核对：`packages/ws-replication/AGENTS.md` γ 词汇登记句随 γ 代码同变更集 append-only 落盘（既有枚举句与冻结面零改写） | SA8 implementation 复查 / 总控 |
| R3 | 复核义务（实现期） | §5 冻结面逐项核对：β 矩阵 271 + 包套件 825 全绿、TD-C2 非回退、peer 零改动、wire parity（单帧 + 分块两构型）、§8.6.1 谓词 α/β 退化同构（PEND-C3 ④ 变异负控）、公共导出面 15→16 append-only | SA8 implementation 复查 / 总控 |
| R4 | 非阻塞（可选） | 实现落名后在 CONTEXT.md「SessionHost」词条 γ 段登记 γ 工厂名（规范未锁名，不构成义务——维持 iteration 0 R4） | 实现票 |
| R5 | 非阻塞（可选） | A4.1 措辞调和（如团队欲做）走显式 amendment，不得静默改 ADR（维持 iteration 0 R3/E3） | 后续 docs 票 |

## 9. Verdict

**`clear`**

依据：技能 verdict 规则——「clear：全部为 no-conflict 或 implements-existing-decision」。本轮 22 项对照全部为 implements-existing-decision 或 no-conflict；iteration 0 两项 reject 依据（E1/E2）经修订版逐条核验按合格路径闭合：

1. **E1（时序契约）**：D9 路线 (a) 以 `pushedAt` 携带机制在本变更集内实现 §24.8:1152 / A4.7:95 登记的推送时刻 t0，规范文本零改动、α/β 逐字节不变、follow-up 让渡删除（§13-R4 划线闭合），CHUNK-C3 锁行为断言；
2. **E2（词汇登记）**：D12 把 `packages/ws-replication/AGENTS.md` 纳入 ALLOW 并以 append-only 登记句（同变更集落盘）兑现 docs/AGENTS.md 文档同步纪律，冻结面零触碰。

修订版同时并入的 SA2-F1（§8.6.1 合并占用判据，兑现 §24.4:1127 ackTimeout 锚定同构义务）与 SA2-F2（D11 真实分块硬门，兑现包验证纪律 + A4.8）均落在既有决策的 implements-existing-decision 区间，未开新决策面；A4.1/A4.2 张力维持 E3 裁决登记。iteration 0 §9 预期「R1/R2 闭合后本门禁预期转 `clear`（含 `requiresConflictRecheck: true`）」——本轮核验证实该预期成立。

## 10. requiresConflictRecheck

**true**。设计面冲突已闭合，但以下面尚待**实现期**核对（技能规则：公共 API、状态机、生命周期、失败语义尚待实现核对时为 true）：

1. 公共 API append-only 扩张（发布即冻结）：15 → 16 值导出 + 5 新类型，PUB-C1/TD-C2 落地核对；
2. 新生命周期/失败语义触发面：tag 违例响亮收口（既有码新触发面）、egress ≤0 不投回执、§8.6.1 合并占用判据（共享计时器语义扩展，设计 §15-3 自报）；
3. 三态锚/pending 两相记账/自驱 drain 的 γ 门控实现与 α/β/peer 逐字节不变（PUB-C2/ROUND-C2 硬门）；
4. E1 代码路径与 §24.8/A4.7/§23.1 登记文本一致性（CHUNK-C3）；
5. E2 登记句随实现变更集落盘（§8-R2）。

纯 no-conflict 项（#17/#18/#20/#21）不产生独立复查义务；上述 1–5 全部核对闭合后，implementation 复查可将本标志置 false。
