# SA9 Standards Review — issue #420：SessionHost 公共工厂 + 内存管道完整协议回合（**第二段 rebase 后最终交付**轮）

- Dispatch：`sa-b90a6cb6-bb34-476b-9644-b74a5b13b834`（mabf-sa9 / standards-review / iteration 1）
- 审查对象：worktree `/home/wangjian/nomicore-fix-issue-420`（分支 `mabf/issue-420`）的 **rebased 最终交付谱系**（父基 = 派工指定权威 Parent PR #416 head `25c51cd45a3e4ec1cf8bcdbdcb33ff1f13d1b0df` = PR #428 merge，issue #423）：
  - `4e5ff0ab20d610aec14ecef85b6615590a0386e5`（`feat(ws-replication): expose session host factory`，父 = `25c51cd…`）——`9d2500d` 的第二段重放（SA8 iteration 5 授权 `git rebase --onto 25c51cd 1f5809b`，预期零冲突零手工消解）
  - `eb5ec096742762b9b1b5e6d9c037e163c1b21174`（`chore: archive issue 420 verification evidence`，20 路径证据归档 = `52a9e56` 重放）
  - `aff4bc0bceb15e6b1cc7638e73a68fd58138606b`（`chore: archive issue 420 rebase verification`，5 路径追加归档 = SA8 iteration 5 报告 + SA9/SA10 第一轮 rebase 复审 + SA3 iteration 3 报告 + rebase-prep 日志）
- Owner requirements：派工明文 none；REST Issue comments = `[]`（base check 重读）；简报 `## Comments` 空 ⇒ 无 owner 追加要求
- **Verdict：`approve`**（0 BLOCKER / 0 MAJOR；9 条非阻断 MINOR 见 §8——7 条前轮已登记项原样存续、2 条状态更新；`requiresConflictRecheck: true`，理由见 §9）
- 审查范围声明：本报告只判断仓库与工程标准（AGENTS/ADR/模块责任/既有架构惯例/单一事实源/生命周期对称性/文件范围/测试质量标准）；Issue 需求是否完整实现属 SA10（其 iteration 1 报告本轮在工作区在册，approve）；rebase 后五门重取的形式闭合属 SA8 RA2'（Controller + SA4/SA7 证据链）——本报告对二者只做状态登记与事实核验，不越权裁决。

---

## 1. Reviewed inputs（本轮读取/核验）

| 输入 | 状态 |
| --- | --- |
| `wiki/raw/task_issue-420.md`（简报；AC1–AC5） | 读取 |
| `wiki/raw/task_issue-420_design.md`（SA1 iteration 1：D1–D10、ALLOW/DENY、§12 验收映射） | 全文读取 |
| `wiki/raw/task_issue-420_implementation_conflict_report.md`（SA8 iteration 5：**clear**；二段 rebase 路线终认；双层 merge-tree RC=0（`7b5c1cbc…`/`2cee6d03…`）；`index.ts` 并集 blob `08fa49a1…` 原样过继；RA1'–RA6'；窄域 `requiresConflictRecheck: true`） | 全文读取 |
| `wiki/raw/task_issue-420_sa3_impl.md`（iteration 3：脏面裁定 × `25c51cd` 零冲突复认 × 5 条可提交面） | 全文读取 |
| `wiki/raw/task_issue-420_sa4_review.md`（iteration 1：approve；O8–O13） | 全文读取 |
| `wiki/raw/task_issue-420_sa7_report.md`（approve；载体提交 A/B 逐字节相等动态证据） | 全文读取 |
| `wiki/raw/task_issue-420_sa10_spec.md`（工作区版 = iteration 1：二段 rebase 后 spec 复审 **approve**；归档口径 25 路径在册） | 全文读取（工作区活文档，见 §2.7） |
| 前轮 SA9 报告（`1f5809b` 基 rebase 轮，approve，9 MINOR） | 全文在册（HEAD `aff4bc0` 携带）；本轮逐轴复核其结论在新基树上的存续性 |
| SA6 契约 / SA2 / SA8 三阶段报告 / relevant_decisions | 前轮已全文审；本轮按需复核引用面 |
| 规范面 | 根 `AGENTS.md`、`packages/ws-replication/AGENTS.md`（本轮 Host 提示重读）、`docs/AGENTS.md`、ADR 0032（#420 澄清附录 :32–51 × #423 决策 5 注记 :68 并存） |
| 本轮独立 git/源码核验 | 见 §2/§3/§5 全部命令级事实（父 OID、树 OID、blob hash、逐路径逐字节比对、交付侧/父侧双向 diff、DENY 面、whitespace 门、归档纯度、缝签名交互 grep） |

SA9 未修改任何生产代码、设计或测试；未运行测试/服务；唯一产物为本文件（原位覆盖前轮报告）。

## 2. Rebase 保真性核验（本轮核心新增面，全部独立重取，不采信自述）

### 2.1 谱系与零冲突落地的逐位核验

| 判据 | 期望（SA8 iteration 5 RA1'） | 本轮实测 | 结论 |
| --- | --- | --- | --- |
| 重放交付父基 | `25c51cd45a3e4ec1cf8bcdbdcb33ff1f13d1b0df`（全 OID） | `git log`：`4e5ff0a` 父 = `25c51cd45a3e4ec1cf8bcdbdcb33ff1f13d1b0df` 逐位相同 | ✅ |
| 零冲突零手工消解 | 双层 merge-tree RC=0 预演（交付级树 `7b5c1cbc…`、全 tip 树 `2cee6d03…`） | `git rev-parse 4e5ff0a^{tree}` = **`7b5c1cbc3bb77ea98e7b8669f09896624fde76c4`**；`eb5ec09^{tree}` = **`2cee6d03f05fb61f12a37c2a9a41170e60fbef86`**——与预演树**逐位相同** ⇒ 落地树 = 纯机械 auto-merge 结果，**零手工内容的铁证**（树同一性排除一切手工编辑/顺手改动空间） | ✅ |
| `index.ts` 并集原样过继 | blob = `08fa49a1fb84321b92a4cae2da7ee401afdc7ce1`（旧「手工写并集」配方作废，零重算零手工） | `git rev-parse 4e5ff0a:…/index.ts` = `08fa49a1fb84321b92a4cae2da7ee401afdc7ce1` 逐位相同 | ✅ |
| 重放集 | 恰 `9d2500d`+`52a9e56` 两 commit | 谱系 = `4e5ff0a`（52 路径，与 `9d2500d` 路径集 `diff` 逐名相同）+ `eb5ec09`（20 路径，与 `52a9e56` 逐名相同）+ `aff4bc0`（5 路径追加归档，与 SA3 iteration 3 staging 清单逐名相同） | ✅ |
| 反方位交错/改名/重排/顺手改动 | 禁止 | 树 OID 逐位 = 预演 ⇒ 无任何偏离空间 | ✅ |
| 父 head 前移即停 | 前移须先复认 | 父 = 授权 OID 未前移（`25c51cd` 与派工明文逐位相同） | ✅ |

### 2.2 交付路径逐字节矩阵（第一段 rebase 后 `9d2500d` vs 第二段 rebase 后 `4e5ff0a`）

| 类别 | 路径 | 结论 |
| --- | --- | --- |
| 逐字节同一（10） | `hub-session-host.ts`（公共工厂 263 行）、`index.ts`（并集 blob）、`hub-connection.ts`、`issue420-shim-hub.ts`（夹具）、#420 test-d / round / shim-matrix 三测试、#418 两冻结锚测试、`CONTEXT.md` | 前轮 approve 的实质分析面**逐字节存续**，无需重审即成立 |
| auto-merge（3，hunk 不交叠） | ADR 0032、`hub-session.ts`、`hub-split.ts` | 本轮双向 diff 核验两侧内容俱在、零丢失（§2.3） |

### 2.3 三个 auto-merge 路径的双向内容核验（本轮亲验）

交付侧增量（`git diff 25c51cd 4e5ff0a`）= **恰为授权的 #420 改动**：

- **ADR 0032**：+23 行澄清附录（A1 信号词汇公共面映射 / A2 决策 3 三载体调和 α/β/γ / A3 决策 5 dormant 降级 + U8 登记），决策 1–5 与否决备选原文零改动——append-only 修订形态正确。
- **`hub-session.ts`**：纯机械重命名（`createHubSessionHost`→`createHubSessionSink`、`HubSessionHostConfig`→`HubSessionSinkConfig`、删 `HubSessionHost = HubSessionSink` 别名、`HubSessionSinkImpl`、头注补公共工厂指引）——零行为。
- **`hub-split.ts`**：仅头注（三工厂现状陈述；成员/类型零变化）。

父侧增量（`git diff 9d2500d 4e5ff0a`，应恰为 #423 内容）= **逐行确认**：

- **`hub-session.ts`**：#423 记账透传（:61–63 三参箭头 `sendData(namespaceId, bytes, accounting)`；:207–222 `sendData` 可选参与 `port.sendDataFrame(frame, accounting)` 传递）俱在。
- **`hub-split.ts`**：#423 `HubSendAccounting`（纯 JSON `{sendQueueMs?}`，:53–70 文档块）与 `sendDataFrame(frame, accounting?)` append-only 可选参（:91–95）俱在；「不进 `src/index.ts`/`src/testing.ts`」声明与公共面一致（§2.4 导出 13 名无该型）。
- **ADR 0032**：#423 决策 5 观测面落地注记（:68，明文「决策 1–5 与否决备选原文零改动」）追加于 #420 附录之后——双注册并存、无互斥文本。

### 2.4 rebased 树上的 DENY 面 / 卫生门（本轮独立执行）

- `git diff --stat 25c51cd 4e5ff0a --` 对以下全部为空：`hub-namespace.ts`、`hub-edge.ts`、`hub-edge-host.ts`（#421 模块本体）、`hub-upgrade-admission.ts`、`src/testing.ts`、`frame-io/backpressure/round-engine/update-channel/update-transfer/bulk-transfer/liveness/observer/validate/defaults/types/plugin/error-mapping/fence-watchdog/lifecycle-queue/peer-connection/peer-namespace.ts`、`docs/protocols/**`、`packages/replication-protocol/**`、`packages/namespace-registry/**`、`apps/**`、`domains/**`、`packages/ws-replication/package.json`、7 个 listen 矩阵文件 + `ws-replication-periodic-reconcile.test.ts`、全部 `test/*issue421*`/`test/*issue423*` 文件。
- 交付 commit 路径集 = `9d2500d` 逐名同一（§2.1）；归档 commit `eb5ec09` 20 路径 = RA6 口径；`aff4bc0` 5 路径 = SA3 iteration 3 清单——**零越界**。
- `git diff --check 25c51cd 4e5ff0a`、`4e5ff0a eb5ec09`、`eb5ec09 aff4bc0` 三串 RC=0。
- 归档 commit 业务面纯度：`eb5ec09` 与 `aff4bc0` 仅触 `wiki/raw/` + `artifacts/`（stat 亲验）⇒ 纯证据归档。

### 2.5 冻结面与公共导出（本轮亲验）

- `FROZEN_PRODUCTION_EXPORTS` = 13 项（:144–158），`createHubReplicationEdge` 与 `createHubSessionHost` 同列且字母序位正确，既有 11 名零删除零重排。
- 并集 `index.ts`（95 行亲读）：值导出 13 = 基线 11 + `createHubSessionHost` + `createHubReplicationEdge`；类型面 = types.js 31 + plugin 15 + edge 8 + session 7；零逻辑、零改名零删除；`HubSendAccounting` 等内部缝类型**不在**公共面（#423 守约）。
- `hub-split.ts` 头注「三工厂现状」陈述与 rebased 树现实一致（edge 模块级 / sink 模块级 / 公共工厂经 `src/index.ts`）。

### 2.6 测试质量与缝纯度结构门（本轮 grep 重取）

- 三新测试文件 + 夹具：`it/describe/test.(skip|only|todo)` = **0**。
- `hub-session-host.ts`：`expectedSequence` = **0**（C5c 结构门存续）。
- `src/**` + `package.json`：`worker_threads|MessageChannel|MessagePort` = **0**（AC4/C4a 存续）。
- #420 测试与夹具：`sendQueueMs` = **0**、`update-sent` 断言 = **0** ⇒ #423 发射点迁移与记账投影对 #420 断言面零结构性冲突（行为面归 RA2' 重跑，见 §8-M9）。
- test-d 负控 `@ts-expect-error` ×6（denied 投影 / authorize / transport / port / `namespaceFrame` / `onFrame` 无 number）字节存续。
- 夹具仅深路径 import（`../src/{hub-edge,hub-namespace,hub-session-host,hub-session,hub-split,defaults,validate,types}.js` + 外部包），**零包入口引用**——D8 mock 安全纪律存续。

### 2.7 工作区现状（本轮亲验）

- HEAD = `aff4bc0`；工作区唯 1 条 tracked-modified = `wiki/raw/task_issue-420_sa10_spec.md`（SA10 iteration 1 报告：二段 rebase 后 spec 复审 approve——归档 commit 之后的活性编辑，与前轮 SA9/SA10 同款「活报告待 Controller 追加归档」形态，RA6' 账目延续，非缺陷）；零未跟踪、零暂存、业务面零 diff。
- 本报告写盘后将与该 SA10 活报告一并成为下轮归档对象（同 #418/#419/#421 先例）。

## 3. 标准符合性总账（rebased 树）

| 标准轴 | 结论 | 依据 |
| --- | --- | --- |
| 根 AGENTS + `packages/ws-replication/AGENTS.md` | ✅ 符合 | §4 |
| `docs/AGENTS.md`（显式修订/CONTEXT 同步/不复制规则/diff-check） | ✅ 符合 | §4.3 |
| ADR 0032 决策 1–5 + #420 澄清附录 × #423 决策 5 注记 + 关联 ADR/协议冻结面 | ✅ 符合 | §5 |
| 模块责任 | ✅ 符合 | §6.1 |
| 既有架构惯例 | ✅ 符合 | §6.2 |
| 单一事实源 | ✅ 符合 | §6.3 |
| 生命周期对称性 | ✅ 符合 | §6.4 |
| 文件范围（ALLOW/DENY/授权编辑/零冲突过继纪律） | ✅ 符合（本轮逐字节核验） | §2/§7 |
| 测试质量标准 | ✅ 符合 | §2.6/§7.3 |

说明：10/13 交付路径与前轮 approve 面**逐字节同一**（§2.2），前轮 SA9 §3–§9 的实质判定在 rebased 树上不因其承载字节而变化；本轮对全部「与父增量相交」的面（ADR 0032、`hub-session.ts`、`hub-split.ts`）、全部流程面（二段 rebase 零冲突落地、双归档、卫生门）与全部 **#420×#423 交互面**（§5）做了独立重取。

## 4. AGENTS 规约核验（rebased 树）

### 4.1 根 AGENTS.md

| 条款 | 核验 | 结论 |
| --- | --- | --- |
| Domain docs（root CONTEXT + docs/adr） | SessionHost 词条（公共工厂轨形态 + `_Avoid_`）字节存续；ADR 0032 附录字节存续 × #423 注记并存 | ✅ |
| Module guidance（改 `packages/` 前读嵌套 AGENTS） | 全流水线援引 `packages/ws-replication/AGENTS.md`；本轮 Host 提示重读并逐条对照 §4.2 | ✅ |
| Instance replication（ADR 0010 + 协议 v1 为规范） | 本交付零 wire/错误码/事件变化（协议文本对父零 diff）；#423 的协议 §17/§23.1 注册为父侧 append-only 演进（字段集零变化），本路线只承接不修订 | ✅ |
| Git worktrees（`.worktrees/`） | SA3 干跑 scratch worktree 先例合规（用后移除）；本轮零新 worktree | ✅ |

### 4.2 `packages/ws-replication/AGENTS.md`（本轮 Host 提示重读）

| 条款 | rebased 树核验 | 结论 |
| --- | --- | --- |
| 「Export production APIs through `src/index.ts`…」 | 并集 `index.ts` 13 值导出、零逻辑；内部缝类型（含 #423 `HubSendAccounting`）不进公共面；夹具仍只落 `test/` | ✅ |
| 「Keep admission bounded…」 | 夹具 pending 界 ≤16 + `CONNECTION_POLICY_VIOLATION`(1008) 字节存续（:93–94/:503）；先例符号本体在 `hub-upgrade-admission.ts:26`（值 16 不变——#421 守约面，父侧零 diff） | ✅（头注指针滞后 → §8-M8） |
| 「Preserve protocol ordering and FSM invariants」 | `hub-namespace.ts` 对父零 diff（§2.4）；session 侧 `expectedSequence` grep = 0；出站占位 0 + edge mux 盖章单点不动 | ✅ |
| 「Route namespace ownership…through public Registry leases」 | 公共工厂只组装既有 splice，不接 Runtime/Persistence/Y.Doc（字节存续） | ✅ |
| 「Preserve shutdown safety…§21」 | `close()` 幂等单 promise 等对称面字节存续（前轮 §8 逐项） | ✅ |
| 「Bind Hub connections to the trusted identity…」 | `remoteInstanceId` = edge 认证后身份（夹具 `verifyToken` 结算面字节存续） | ✅ |
| 「Verification」：聚焦 + 包 typecheck + 根 typecheck/test | 已归档门证据绑定 `1f5809b` 基树（包 87 files/749 tests 等），对 `25c51cd` 基树不构成形式闭合——RA2' 重取门挂 Controller + SA4/SA7（§8-M9）；本票各轮全量/聚焦证据链完整在册 | ✅（形式闭环见 M9） |

### 4.3 `docs/AGENTS.md`

显式修订（#420 附录 + #423 注记均 append-only 追加，非静默改文）、CONTEXT 同步（词条字节存续）、不复制规则（援引 ADR/源码锚）、`git diff --check`（三 commit 串均 RC=0）——全部符合。

## 5. ADR / 协议符合性（rebased 树，含 #420×#423 交互专项）

- **决策 1（FSM 单份/沿内缝拆分）**：`hub-namespace.ts`/`hub-edge.ts` 对父零 diff；公共工厂复用 `createHubSessionSink` 单份组装——字节存续。✅
- **决策 2（缝只过 Uint8Array/纯 JSON、零 worker）**：worker 面 grep = 0（§2.6）；#423 记账投影为纯 JSON `{sendQueueMs?}`（缝纯度不变）；test-d/夹具字节存续。✅
- **决策 3（authorize 在 edge、投影传递）**：描述子/闭包回放面字节存续；test-d 负控字节存续。✅
- **决策 4（路由键契约）**：#419 守卫零触碰（DENY 空）。✅
- **决策 5（dormant 降级/事件 append-only/发射点 = 事实所有者）**：adapterPort 面字节存续；**#420×#423 发射归属一致性本轮亲验**——`hub-namespace.ts` 通道经注入 host 的 `emitObserver` 发 namespace 域事件（公共缝拓扑下 = adapterPort → `dispatchReplicationObserver` 单点，session 侧）；`hub-edge.ts:262–269` `update-sent` 唯一发射点 = 连接级 data 帧出面（edge 侧），与 #423 归属表「连接域在 edge、namespace 域在 session」在两种拓扑下均一致。✅
- **#420×#423 缝签名交互**：`HubSessionEdgePort.sendDataFrame(frame, accounting?)`（父侧 append-only 可选参）× #420 单参实现（`hub-session-host.ts:184`、夹具 `:440`）——少参实现恒可赋值，结构化合法；accounting 在公共 byte 缝整键缺席 ⇒ `update-sent` 不带 `sendQueueMs` = **#423 ADR 注记明文注册的合法 dormant 形态**（「工厂/宿主直驱 data 帧无 session 记账 ⇒ 该键整键缺席」），且 #420 断言面零 `sendQueueMs`/`update-sent` 依赖（§2.6）。✅
- **后果节（公开面 append-only 冻结）**：并集 = 两侧 append-only 追加的字面机械应用；冻结表 13 项与导出 13 名逐名一致；二段 rebase 零手工（树 OID 逐位 = 预演）。✅
- **附录/注记文本**：#420 附录 A1/A2/A3 字节存续 × #423 决策 5 注记并存；实现面字节存续 ⇒ 一致性存续。✅
- **关联面（ADR 0010/0012、协议 §4/§7.1/§13/§14/§17/§19/§23.1）**：本路线零触碰；#423 的 §17/§23.1 append-only 注册为父侧自有权威链（经其 SA8 闭合），按 `25c51cd` 形态原样承接。✅

## 6. 模块责任 / 架构惯例 / 单一事实源 / 生命周期

### 6.1 模块责任
生产侧新增面仍只有 `hub-session-host.ts`；一切协议判定仍由零 diff 通道产出；桥只落 `test/` 且字节存续；#421/#423 模块（`hub-edge-host.ts`/`hub-upgrade-admission.ts`/`update-channel.ts` 等）属父增量、非本交付触碰面（§2.4）。✅

### 6.2 既有架构惯例
工厂命名/配置注入惯例、内部重命名让出公共名、测试族命名布局、有界窗口先例（值 16 不动）、commit 信息风格（feat/chore 双轨与 #418/#419/#421 同口径）、wiki/artifacts 入档先例（两归档 commit 合计 25 路径 = RA6/RA6' 口径）——全部符合。✅

### 6.3 单一事实源
协议 FSM 单份、wire 序单点（edge mux）、codec 单份、observer 分发/时钟折叠单点（`dispatchReplicationObserver`/`safeNow`，#423 的 `cidField` 亦单点在 `observer.ts:113`）、admission 台账单点、错误码映射单点、`MAX_EARLY_FRAMES` 常量单点（`hub-upgrade-admission.ts:26`）——权威源全部零 diff 或字节存续；并集未复制任何规则成第二份文本。✅

### 6.4 生命周期对称性
open/close/terminate/onFrame/onSignal/pending/terminateWaiters/桥 close 的对称释放与响亮失败路径全部字节存续（前轮 §8 逐行判定）；二段 rebase 未触碰任何生命周期代码（零手工落地）。✅

## 7. 文件范围与测试质量

### 7.1 ALLOW
rebased 交付的 13 个业务路径 = 设计 §11 ALLOW 清单逐名同一（§2.1/§2.2 核验）；授权编辑两处（contract 测试冻结表插入 + structure 测试机械跟随）在 rebased 树上形态正确（§2.5）。

### 7.2 DENY
§2.4 全空；协议文本零 diff；7 listen 矩阵、7 个 #421 测试、3 个 #423 测试全部零 diff。

### 7.3 测试质量标准
零 skip/only/todo、session 侧零 `expectedSequence`、零 worker 依赖/类型（§2.6）；test-d 双面发现与 6 负控字节存续；红/绿证据链与变异敏感性证据随 RA6 全量入档（前轮 M3 闭合态存续）；夹具 mock 安全（仅深路径 import）与反空跑锚字节存续。✅

## 8. 非阻断 MINOR 观察（不阻断 approve）

| # | 观察 | 现状/处置 | 来源 |
| --- | --- | --- | --- |
| M1 | 设计 wiki §7 D7 `namespaceFrame` 行字面滞后于载体提交机制 | SA8 RA1'' 登记 wiki 内务（三重登记在场）；沿用前轮 | 前轮 M1 |
| M2 | ADR 0032 附录 A2 β「按准入结局」措辞未覆盖「按帧到达形态」第三判据 | SA8 已裁非冲突；措辞对齐随 RA1'' 落 | 前轮 M2 |
| M4 | SA6 三个诊断探针 `.mts` import 旧名 `createHubSessionHost`（重跑前需改 `createHubSessionSink`） | 转交 SA6/Controller；探针不在任何 gate include 面 | 前轮 M4 |
| M5 | 夹具探针 `handles` 以 namespaceId 为键（多连接同 ns 覆盖） | SA4 O3 登记：多连接断言使用前改复合键 | 前轮 M5 |
| M6 | 公共 host `sessions` Map 无删除路径 | 冻结语义字面兑现；后续宿主接线票定生命周期约定 | 前轮 M6 |
| M7 | M1-a12 变异日志缺命令行回显 | SA4 O7 登记证据卫生 | 前轮 M7 |
| M8 | RA3 卫生项在二段 rebased 交付中仍未落：夹具头注 :93「镜像 `hub-connection.ts` 的 `MAX_EARLY_FRAMES` 先例」指向未随 #421 拆分改指 `hub-upgrade-admission.ts`（符号本体 :26，值 16 未动——守约面完好；夹具字节 = 前轮授权字节，两段 rebase 均零手工、未也不得顺手改） | SA8 RA3 明文**非门禁**；登记留待后续卫生票 | 前轮 M8 存续（本轮复核） |
| M9 | **RA2' 形式闭环未落树（状态更新）**：`25c51cd` 基树上的五门重取（#418 契约 13/13 + #420 三契约、双 test-d、包全量预期 90 files、根 typecheck 覆盖 #423 缝签名 × `hub-session-host.ts`/夹具编译面、AC3 矩阵于 #423 拆分后 src 上逐字重跑）之 SA4/SA7 证据日志尚未入档（本轮 grep `4e5ff0a`/`eb5ec09`/`aff4bc0` 于 artifacts+wiki 零命中；已归档全部门证据绑定 `1f5809b` 基树）。#420×#423 交互的结构面本轮已静态核验合法（§5），行为决定性证据属该重跑 | 属 SA8 RA2'/Controller + SA4/SA7 流程门（阻断交付合并，非本交付标准违例）；本报告 `requiresConflictRecheck: true` 与此联动（§9） | 本轮核验 |
| M10（新，流程登记） | SA10 iteration 1 报告为归档 commit `aff4bc0` 之后的活性编辑（工作区 1 条 tracked-modified），与本报告同为下轮归档对象 | RA6' 账目延续（同前轮 SA9/SA10 活报告形态）；非缺陷 | 本轮核验 |

（前轮 M3「证据集未完整入档」已于 `52a9e56`/`eb5ec09` + `aff4bc0` 双归档闭合，不再列示。）

## 9. 结论

**`approve`**。第二段 rebased 最终交付在全部标准轴上符合仓库与工程标准：

1. **Rebase 保真性（RA1' 全要素成立）**：父基逐位 = 授权 OID `25c51cd…`；交付树 `7b5c1cbc…` 与全 tip 树 `2cee6d03…` 同 SA8 iteration 5 / SA3 iteration 3 双方独立零冲突预演树**逐位相同** ⇒ 纯机械重放、零手工消解、零顺手改动的铁证；`index.ts` 并集 blob `08fa49a1…` 零重算原样过继（旧手工配方按 SA8 裁决作废且确未使用）。
2. **实质面存续与并集正确**：10/13 交付路径与前轮 approve 面逐字节同一；3 个 auto-merge 路径双向核验——交付侧增量恰为授权 #420 改动（ADR 附录 / 机械重命名 / 头注），父侧 #423 内容（`HubSendAccounting`、记账透传、决策 5 注记）俱在，零丢失零互斥。
3. **#420×#423 交互面**：缝签名 append-only 可选参 × 单参实现结构化合法；`sendQueueMs` 整键缺席 = #423 注册的合法 dormant；observer 发射归属（namespace 域在 session 经 `dispatchReplicationObserver` 单点、`update-sent` 唯一漏斗在 edge）两拓扑一致；#420 断言面对两字段零依赖。
4. **冻结面与范围**：DENY 面（含 #421/#423 模块本体、7 listen 矩阵、7+3 个邻票测试、协议文本、上游包）对父零 diff；交付 commit 零越界；双归档纯证据；三 commit 串 `git diff --check` 均净；公开面 append-only（13 值导出与冻结表逐名一致）。
5. **流程面**：前轮 M3 闭合态存续（25 路径双归档在册）；RA3 卫生项（M8）与 RA2' 五门形式闭环（M9）登记——均非门禁、均非本交付代码正确性或标准符合性问题；SA10 iteration 1 活报告（M10）与本报告并待 Controller 追加归档。

**requiresConflictRecheck: true**——依据：SA8 iteration 5 武装的窄域 recheck 触发条件（「五门（含 `index.ts` 并集公共面、#420×#423 缝交互的行为证据）在 `25c51cd` 基树的重放谱系上落地并核对」= RA1'+RA2'）中，RA1'（零冲突落地 + blob 机核）已由本轮核验**事实成立**，RA2'（五门真实树重取的 SA4/SA7 证据落档 + SA8 形式核对）尚未落盘（§8-M9）。本标志驱动该形式闭环的调度，不表示本轮发现新的决策冲突面（本轮裁决面：0 hard-conflict、0 evolution-required）。
