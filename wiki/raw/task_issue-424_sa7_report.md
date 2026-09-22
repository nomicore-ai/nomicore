# task_issue-424 SA7 动态验证报告 — 分片形态端到端等价性验收（spec #415 T7）

- 被验对象：SA3 迭代 1 交付（test-only：`packages/ws-replication/test/issue424-sharded-hub.ts` + 4 个 `ws-replication-issue424-*.test.ts`）；SA4 verdict = `approve`（本报告只在 SA4 pass 基础上独立验证，不下调）
- **当前基线（rebased）**：`/home/wangjian/nomicore-fix-issue-424` / **`efd958f4df94527c8df047bccabb83e34787af3b`**（`fix(#420): SessionHost 公共工厂 … (#430)`）。SA3/SA4 验证时 HEAD = `cab3e8c`；`git diff --name-only cab3e8c..efd958f` 全部落在 `artifacts/sa6-issue420-ci-repair/*`（36）与 `wiki/raw/*`（6）——**生产包/配置/规范零变化**（`git diff cab3e8c..HEAD -- packages/ apps/ domains/ docs/ vitest.config.ts tsconfig*.json package.json` 均为空输出，亲验）。因此本报告全部动态证据在 rebased 基线上重新采集，不沿用 SA3 自证日志。
- 上游输入：简报 `task_issue-424.md`（AC1–AC6）、批准设计 `task_issue-424_design.md`（迭代 1）、SA6 契约 `task_issue-424_sa6_contract.md`、SA3 报告 `task_issue-424_sa3_impl.md`、SA4 审查 `task_issue-424_sa4_review.md`（含 §10 后续动态验证项）
- 结论：**`approve`** —— 四套件 25/25 绿（×3 轮 + 全量同轮）；根全量 459 文件/5584 测试/0 类型错误/exit 0；包 tsc + 根 typecheck exit 0；设计 §8.4 全部八条路线的关键跳点取得运行期观测值；状态机合法序与禁止态缺席均获动态证据；错误/收口/清理到 quiescence；临时探针已删净并复跑确认。

---

## 1. Inputs

| 输入 | 用途 |
|---|---|
| `wiki/raw/task_issue-424.md` | AC1–AC6 验收行为面 |
| `wiki/raw/task_issue-424_design.md`（迭代 1，642 行） | §7.2 三层硬门、§7.3–§7.5 SD 裁决、§8.1–§8.3 夹具/adopt 装配、§8.4 R1–R8 数据流路线、§8.5 状态机、§12 验收映射、§12.6 门禁命令 |
| `wiki/raw/task_issue-424_sa6_contract.md` | AUTH/ROUND/SHARD/SEQ/TERM/REVOKE/REAUTH/GATE 契约条目与负控（NC1–NC4、AUTH-C5、SD-2(b)） |
| `wiki/raw/task_issue-424_sa3_impl.md`、`task_issue-424_sa4_review.md` | 交付清单、D1–D6 登记差异、SA4 §10 指定动态验证项（全量复跑/多轮稳定/收窄脆弱性） |
| 交付五文件 + `test/{harness,driver}.ts`（只读） | 动态驱动面 |

## 2. Runtime environment

| 项 | 值（本轮亲测） |
|---|---|
| 运行环境 | node `v24.13.0`、pnpm `10.28.2`、vitest `3.2.7`、tsc `5.9.3`（与 SA6 §4 基线一致） |
| 工作树 / HEAD | `/home/wangjian/nomicore-fix-issue-424` / `efd958f`（rebased；生产面与 `cab3e8c` 零 diff） |
| 聚焦套件 | `vitest run ws-replication-issue424-*.test.ts` → **4 文件/25 测试全绿、Type Errors no errors、exit 0**（×3 轮：初跑、日志轮、探针删除后复跑；`artifacts/issue424-sa7-focused.log` / `-focused-post-removal.log`） |
| 根全量门禁 | `NODE_OPTIONS=--conditions=nomicore-source pnpm test` → **459 文件/5584 测试全绿、Type Errors no errors、exit 0**（435.28s；4 个新套件同轮 ✓；`artifacts/issue424-sa7-full-suite.log`） |
| 类型检查 | `tsc -p packages/ws-replication/tsconfig.json` exit 0；根 `pnpm typecheck`（15 tsconfig 串行）exit 0（`artifacts/issue424-sa7-typecheck.log`） |
| 生产/规范面改动 | **零**：`git diff --stat HEAD` 空输出（全仓零 tracked 修改）；DENY 面 `git status --short` 空（§Commands） |
| 数据流探针 | 临时驱动脚本（`[SA7-DATAFLOW]` 前缀）经 tsx 运行，证据采毕即删（§7） |

## 3. Changed Data Flow Verification

本票为 test-only：设计 §8.4 明示「无生产运行时数据路径变化；R1–R8 全部为既有生产路径在新验收装配下的观察面」。因此「Changed」= **分片装配形态下这些路线的运行期事实**（相对：单体 listen 形态既有路线，见 §4）。全部观测值取自本轮探针 + 聚焦套件同轮绿。

| Route | Design change（§8.4） | Runtime driver | Observed hops（本轮实测值） | Expected result | Actual result | Verdict |
|---|---|---|---|---|---|---|
| R1 入站握手 | 脚本/peer 字节 → 公共 edge 全解码/协商 → HELLO_ACK（mux 盖章#1） | 探针 S1（pass/deny/throw 三形态）+ AUTH-C1~C3 | `HELLO_ACK#1` 且 `[8..12]=1`（三形态同值）；真 peer 形态 `HELLO_ACK#1 OPEN_OK#2 BOOTSTRAP_SNAPSHOT#3 SYNC_STEP1#4 SYNC_STEP2#5 SYNC_APPLIED#6` | 入口正确、首帧序=1 | 一致 | ✔ |
| R2 授权 + 会话解析（跨缝·纯 JSON） | authorize 在 edge 单点 → ok 才 `resolveSessionSink`（描述子纯 JSON）→ 桥查登记权威 → route → `host.open()` | 探针 S1/S2/S6 + AUTH-C2/C3、SHARD-C1、SD-2(b) 用例 | pass：`authorize mono=1 shard=1`、`sessions=1 opens=1`；deny/throw：`sessions=0 opens=0 resolves=[]` 且 authorize 仍恰 1 次；多 worker：`resolves=[nsA:w0, nsB:w1]`、两描述子同 `connectionKey=hub-omega-conn-0`；登记缺失：`registryEntries=0` → 响亮收口（见 §6） | 恰一次 authorize；denied/throw 零缝调用、零会话；pass 恰一会话 | 一致 | ✔ |
| R3 入站 ns 域帧（跨缝·字节） | edge 定偏移路由 → 桥 `encodeMessage(msg,{seq})` 重组 → `handleFrame`（session 不复检序）→ 真 Registry/Runtime | 探针 S2/S7 + SHARD-C2/C3、ROUND-C1 | nsA→w0 `[OPEN_OK#2 BOOTSTRAP_SNAPSHOT#3]`、nsB→w1 `[OPEN_OK#4 BOOTSTRAP_SNAPSHOT#5]`（per-ns 协议序）；boot 形态 BOOTSTRAP 后 `state=live`、`BOOTSTRAP_ACK.ackedSequence=3` 回指快照帧序 | 写入正确事实源（worker 各自真 Registry；boot 形态=被采纳 registry）；per-ns 帧序正确 | 一致 | ✔ |
| R4 出站 ns 域帧（跨缝·字节 + 盖章） | session `sequence=0` 占位 → 桥透传 → edge mux 单点重写 `[8..12]`（per-connection 1..N）→ 回传被分配序 | 探针 S2 + SEQ-C1、AUTH-C1 | 首连接 `values=[1,2,3,4,5] strictlyIncreasing1toN=true`；`sinkReturns=[2,3,4,5]`（HELLO_ACK#1 为 edge 自产、不经 sink —— 镜像面正确）；同工厂第二连接（`hub-omega-conn-1`）首帧 `[1]`（per-connection 重起算） | 盖章序严格递增；回传序零改写；第二连接从 1 起 | 一致 | ✔ |
| R5 session→edge 信号（跨缝·纯 JSON） | `settled`→`namespaceSettled`；`connection-fatal{code}`→`connectionFatal` | 探针 S4/S7 + ROUND-C3、REAUTH-C1/C2 | reauth：`GOAWAY×1 reasonCode=REAUTH_REQUIRED drainTimeoutMs=5000` → 入站 CLOSE → `settled:[settled:<ns>]×1` + `CLOSE_OK×1` → `hubClose={1001,"hub-reauth"}` 且 `timerFires=0`；boot 回合：`closeReqSeq=9 closeOkAcked=9 settledSignals=[settled:<ns>]`；阴性对照：`goaways=0 hubClose=undefined state=ready` | settled 恰一次/ns；drain 提前完成 close(1001)（零 deadline 触发）；无 reauth 不关连接 | 一致 | ✔ |
| R6 edge→session 控制信号 | `onConnectionClosed→handle.close()`；`terminateUnauthorized→handle.terminateUnauthorized()`；reject 归一 | 探针 S3/S5/S7 + TERM-C1~C3、REVOKE-C1~C3 | close：`A{closeCalls=1} B{closeCalls=0}`、`firstState=closed secondState=ready`（连接隔离）；推进 30s 后两 pipe 帧数均不变、`pending 2→0`；revoke：`terminateCalls=1`、末帧与单体 `revoke` **逐字节相等**（`ERROR(NAMESPACE_UNAUTHORIZED)#4`）；boot 收尾：`closeIdempotentSamePromise=true closeCalls=[1] pending 0→0 frames 9→9 unhandled=0` | 全会话收口、close 幂等、跨 worker 零外溢、无泄漏 | 一致 | ✔ |
| R7 facade 服务流（boot adopt 装配） | facade 进入即建 `AdoptedWorker` 于 `options.registry`/`options.timer` 之上；`accept` 成功即写登记权威；route 恒指向被采纳 worker | 探针 S7（非协商 + 协商两形态）+ ROUND 全 5 用例 | 两形态 `workerRegistry===hubNode.registry=true`（引用同一性前提）；peer 拨号被公共 edge 接纳（真 peer 回合成立）；hub→peer 骨架同 §R1 | registry 必填、无 route；错位装配不可表达；前提断言绿 | 一致 | ✔ |
| R8 文档数据流（round 收敛） | peer 写 →（R3）→ hub session apply → ACK 回指；hub fixture 写（boot registry）→ session 订阅 →（R4）UPDATE → peer apply | 探针 S7（两形态）+ ROUND-C1/C2/C4 | peer 写：`peerUpdateSeq=7 ackedSequence=7 hubRootN=7`；hub 写（经 `run.writeHub`→fixture lease→**被采纳** boot registry）：`newHubUpdates=1 peerRootN=43`；`encodeStateAsUpdateEqual=true`（hub/peer 收敛）；全程 `state=live`（零 resync） | 双向 ROOT 更新、ACK 回指、收敛相等 | 一致 | ✔ |

**授权等价性硬门（AC1 核心）观测**：pass/deny/throw 三形态 `parityOf` 全部 `控制帧逐字节=等；骨架=等；数据帧文档语义=等`；deny/throw 形态**全轨迹逐字节相等**（`full_trace_hex=equal`）；pass 形态全轨迹字节不等（`DIFFER`）——这是设计 §7.2/O7 登记的语料属性（BOOTSTRAP_SNAPSHOT 载荷内 Yjs clientID 随机性），硬门三层判据（L1 控制帧字节/L2 文档语义/L3 骨架）全部相等，非拓扑归因、非偏差（AUTH-C5(a) 负控在套件中冻结该属性）。

## 4. Preserved Data Flow Verification

设计声明不变的路线（单体 listen 形态、wire 语义、既有套件面）——验证其在 rebased 基线上保持不变：

| Route | Preserved invariant | Runtime driver | Baseline observation | Current observation | Verdict |
|---|---|---|---|---|---|
| 单体 listen 全量套件 | 455 文件/5559 测试全绿（SA6 §4 基线，`cab3e8c`） | 根全量 `pnpm test`（同轮含新 4 套件） | SA6 基线 455/5559 exit 0 | **459 文件/5584 测试全绿 exit 0**（恰 +4 文件/+25 测试 = 交付件；既有套件零失败零修改，`git diff --stat HEAD` 空 ⟹ 既有断言未被触碰） | ✔ |
| 四态 wire 拒绝/通过语义（协议 §7.1/§13） | 单体与分片对同一字节脚本产出相同 wire | 探针 S1 + AUTH-C1~C4/NC2/NC4 | SA6 探针 O1/O2/O2-latch（`cab3e8c`） | deny：`ERROR(NAMESPACE_UNAUTHORIZED)#2 + ERROR(NAMESPACE_REOPEN_REQUIRES_RECONNECT)#3` 全轨迹等；throw：`ERROR(INTERNAL_ERROR)#2` + 重开拒答#3 全轨迹等、连接存活；闩锁重开恰一帧逐字节等且 authorize 恰一次；pass 重开 `OPEN_OK×2`（NC2）；协商形态 parity 成立且协商位可见（NC4） | ✔ |
| per-connection 序纪律（协议 §3 L57） | 从 1 严格递增、第二连接重起算 | 探针 S2 + SEQ-C1 | SA6 O3/O6 | `[1..5]` 严格递增；第二连接首帧 `[1]`；首连接序列不受影响 | ✔ |
| revoke wire 与单体一致（协议 §13.2/§21） | 末帧逐字节相等 + 终结信号恰一次 | 探针 S3 + REVOKE-C1~C3 | SA6 O5 | 末帧 `ERROR(NAMESPACE_UNAUTHORIZED)#4` 与单体逐字节等；`terminateCalls=1`；跨 worker 零外溢（REVOKE-C2 绿）；未知/已终态 ns revoke 无副作用 resolve（REVOKE-C3 绿） | ✔ |
| 合法无 sink → 合成 `NAMESPACE_STATE_VIOLATION`、连接存活（ADR 决策 4） | wire 面不变 | SHARD-C3（NC1）+ 套件绿 | SA6 NC1 | 未 OPEN 的 ns 帧 → 恰一帧合成违例、零会话、连接存活、不落任一 worker、双形态逐字节等 | ✔ |
| sink 解析失败响亮收口（CONTEXT/ADR 决策 3） | 连接级 INTERNAL_ERROR + 1011、零会话 | 探针 S6 + SD-2(b) 用例 | SA6 O10 | `HELLO_ACK#1 ERROR(INTERNAL_ERROR)#2`（连接级、无 namespaceId）+ `close(1011,"protocol-error")` + `sessions=0` | ✔ |
| 类型面/发现面 | 包 tsc + 根 typecheck + runner 发现 | GATE-C2 命令 | SA6 §4 exit 0 | 包 tsc exit 0；根 typecheck exit 0；4 新套件被 include 面发现并在全量轮执行 | ✔ |

## 5. State Machine Verification

状态机全部复用生产实现（零新状态机）；下表为本轮运行期观测（探针 + 套件）：

| Initial state | Trigger | Expected transitions（设计 §8.5） | Observed transitions | Forbidden transitions absent | Verdict |
|---|---|---|---|---|---|
| edge `handshaking` | 入站 HELLO（脚本/真 peer） | → `ready`（HELLO_ACK#1 盖章） | 三授权形态与 boot 两形态均达 `ready`（`state=ready`/后续回合推进） | 未握手即出 ns 域帧：SHARD-C3 → 合成违例、不建会话 | ✔ |
| edge `ready` | `beginReauth()` | → `draining`（GOAWAY drain>0）→ 全 settled **提前完成** 或 deadline 1001 | `draining→close(1001,"hub-reauth")` 且 `timerFires=0`（提前完成分支）；阴性对照无 reauth 不进入 draining（连接保持 ready） | deadline 兜底未被触发即收口（非提前完成路径缺席为设计判据）；无 GOAWAY 时不得关连接 | ✔ |
| edge `ready/draining` | `connection.close()` / facade `close()` | → `closed`；全会话 `onConnectionClosed` 投影 | `firstState=closed`；A 会话 `closeCalls=1`；boot 收尾 `closeCalls=[1]`；close 幂等同 promise | 第二连接不得被连带收口（`secondState=ready`、B `closeCalls=0` ✔）；close 后零新出站（30s 推进帧数不变 ✔） | ✔ |
| 准入台账 `pending` | authorize deny / throw | → `failed` 终态闩锁（零缝调用、零会话）；重 OPEN → `NAMESPACE_REOPEN_REQUIRES_RECONNECT` 且 authorize 不重复 | deny/throw：`sessions=0 opens=0 resolves=[]`、authorize=1；闩锁重开恰一帧拒答、authorize 恰一次（AUTH-C4 双形态绿） | denied/throw 不得建会话或过缝（观测零 ✔）；重开不得重新 authorize（恰 1 ✔） | ✔ |
| 准入台账 `pending` | authorize ok | → `established`（恰一次解析/会话）；pass 重 OPEN → `OPEN_OK×2`（非闩锁） | pass：`sessions=1`；NC2 `OPEN_OK×2` 绿；多 worker A/B 各恰一次解析各归其 worker | 不得重复建会话（每 ns OPEN_OK 恰一 ✔）；不得路由错 worker（`nsA:w0/nsB:w1` ✔） | ✔ |
| 会话/通道级 | OPEN→bootstrap→reconcile→live→CLOSE | OPEN_OK×1、BOOTSTRAP×1、SYNC 三段、`live`、CLOSE→CLOSE_OK+settled | `state=live`；`BOOTSTRAP_ACK acked=3`；`CLOSE_OK acked=9`；settled 恰一次；收敛相等 | 不得出现 resync-required（全程 live ✔）；settled 不得多次（恰 1 ✔） | ✔ |
| 登记权威（装配态） | `accept/acceptTrusted` 返回 | 第一动作写入登记表；resolver 只读 | `connectionKeys=[hub-omega-conn-0]`（单连接两 ns 同键）；第二连接 `hub-omega-conn-1`；绕过登记（factory 直连）→ 无键 → 响亮收口（SD-2(b)） | resolver 不得静默兜底（登记缺失 → 1011 收口而非建会话 ✔） | ✔ |

## 6. Error and Cleanup Flow

| 场景 | 运行期观测 | 判定 |
|---|---|---|
| deny（NAMESPACE_UNAUTHORIZED） | `ERROR(NAMESPACE_UNAUTHORIZED)#2` + 闩锁重开拒答#3，全轨迹与单体逐字节等；零会话；连接存活（namespace 域错误非连接 fatal） | 错误沿设计路径传播，无伪成功 ✔ |
| throw（INTERNAL_ERROR） | `ERROR(INTERNAL_ERROR)#2` + 重开拒答#3 全轨迹等；零会话；连接存活 | ✔ |
| 登记缺失（SD-2(b) 退化路径） | `HELLO_ACK#1` + 连接级 `ERROR(INTERNAL_ERROR)#2`（无 namespaceId）+ `close(1011,"protocol-error")` + 零会话 | 响亮收口、非静默 fallback ✔ |
| 合法无 sink（SHARD-C3） | 合成 `NAMESPACE_STATE_VIOLATION` 恰一帧、连接存活、不落任一 worker、双形态逐字节等 | ✔ |
| revoke 未知/已终态 ns | 无副作用 resolve（零新 wire、零 terminate 外溢）；重复 revoke 恒 resolve | 幂等 ✔ |
| reauth drain | GOAWAY(drain=5000)×1 → CLOSE → settled → `close(1001)` 于**零 timer 触发**下（提前完成）；阴性对照不关闭 | 清理到达收口 ✔ |
| 连接终结清理 | close 后：会话 closeCalls 齐、scheduler pending 不增（观测 `2→0`）、推进 30s 零新出站、`unhandled=0`、close 同 promise 幂等 | 到达 quiescence、无复活旧路径 ✔ |

## 7. Temporary Diagnostics

- **添加项**：临时数据流探针 `packages/ws-replication/sa7-424-probe.mts`（tsx 驱动交付夹具/驱动器；位置在 `src/`、`test/` 与 vitest include 面之外；日志前缀 `[SA7-DATAFLOW]`；只读驱动、零生产/交付件修改、零控制流改变）。输出 = `artifacts/issue424-sa7-dataflow-probe.log`（R1–R8 全跳点观测值，§3 引用）。
- **删除项**：探针脚本已删除（`rm` 后 `git status` 无该路径）。
- **移除后验证**：聚焦套件复跑 **25/25 绿、exit 0、Type Errors no errors**（`artifacts/issue424-sa7-focused-post-removal.log`），与移除前逐行一致；`grep -rn "SA7-DATAFLOW" packages/ apps/ domains/ docs/` 零命中（唯一残留在 `artifacts/` 证据日志内，属 SA7 证据面，不进交付源码）。
- **git 检查**：`git diff --stat HEAD` 空输出——工作树无任何 tracked 修改，`[SA7-DATAFLOW]` 不存在于 diff。
- 临时日志未列入 artifactPaths 之外的生产/测试文件；探针不参与任何 runner 面。

## 8. Dynamic Evidence Matrix

| Source | Requirement or risk | Driver | Expected | Actual | Evidence | Result | Suggested routing |
|---|---|---|---|---|---|---|---|
| SA6 AUTH-C1~C5/NC2/NC4 | 四态授权等价矩阵（AC1） | 聚焦套件 + 探针 S1 | 绿；三层硬门相等 | 7 用例绿；三形态 L1/L2/L3 全等；deny/throw 全轨迹逐字节等 | focused.log / dataflow-probe.log | ✔ | — |
| SA6 ROUND-C1~C4 + 装配前提 | 跨缝完整协议回合（AC2；F-R1 adopt 装配） | 聚焦套件 + 探针 S7（两形态） | 绿；registry 同一；收敛相等 | 5 用例绿；两形态 `registry===hubNode.registry=true`；`encodeStateAsUpdateEqual=true`；ACK 回指 3/7/9 全对位 | focused.log / dataflow-probe.log | ✔ | — |
| SA6 SHARD-C1~C3 + SEQ-C1 | 一连接多 ns 多 host demux/mux + 出站序（AC3） | 聚焦套件 + 探针 S2 | 绿；`[1..N]` 严格递增；第二连接重起算 | 4 用例绿；`[1..5]` 严格递增；`sinkReturns=[2,3,4,5]`；第二连接 `[1]` | 同上 | ✔ | — |
| SA6 TERM-C1~C3 | 终结传播 + 无泄漏（AC4） | 聚焦套件 + 探针 S5/S7 | 绿；全会话收口；quiescence | 3 用例绿；closeCalls 齐且隔离；pending 不增；零新出站；零 unhandled | 同上 | ✔ | — |
| SA6 REVOKE-C1~C3 + REAUTH-C1/C2 | 经 edge 入口路由 + wire 与单体一致（AC5） | 聚焦套件 + 探针 S3/S4 | 绿；末帧逐字节等；drain 提前完成 | 5 用例绿；末帧等；`terminateCalls=1`；`close(1001)` 零 timer 触发；阴性对照不关 | 同上 | ✔ | — |
| SA6/设计 GATE-C1~C3 | 收官门禁（AC6） | 根全量 + 双 typecheck + git 双段 | 全绿；DENY 零 diff | 459/5584 exit 0；typecheck exit 0×2；`git diff --stat HEAD` 空、DENY 面 status 空 | full-suite.log / typecheck.log / scope.log | ✔ | — |
| SA4 §10-1 | SA3 自证门禁可复现性 | SA7 复跑全量 + typecheck | 459/5584 全绿 exit 0 | 复现一致（rebased 基线） | full-suite.log / typecheck.log | ✔ | — |
| SA4 §10-2 | 聚焦套件多轮稳定性（clientID 随机性/微任务深度假设） | 聚焦 ×3 轮 + 探针独立驱动 ×1 | 25/25 恒绿 | 3/3 轮 + 探针全绿，无间歇红 | focused*.log / dataflow-probe.log | ✔ | — |
| SA4 §10-3 | `DEFAULT_REPLICATION_TIMEOUTS as SessionHostTimeouts` 收窄脆弱性 | rebased 基线 src 零 diff + 包 tsc | 类型面未演进 ⟹ 收窄仍安全 | `cab3e8c..efd958f` 生产零变化；包 tsc exit 0 | scope.log / typecheck.log | ✔（登记：生产类型面演进时需重审，归 SA4 已登记 follow-up 新票） | — |
| Design §7.2/O7 | 数据帧字节不等的语料属性（防误判偏差） | 探针 S1 | pass 全轨迹不等、deny/throw 全轨迹等 | 观测一致（`pass=DIFFER, deny/throw=equal`），三层硬门全等 | dataflow-probe.log | ✔（非偏差） | — |

额外发现：无（未发现需要扩大验证范围的新风险面）。

## 9. Commands and Evidence

```bash
# 环境/基线核对
git rev-parse HEAD                                   # efd958f4df94527c8df047bccabb83e34787af3b
git diff --name-only cab3e8c..HEAD                   # 仅 artifacts/sa6-issue420-ci-repair/* 与 wiki/raw/*（生产零变化）
# 聚焦套件（×3 轮，含探针删除后复跑）
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run \
  packages/ws-replication/test/ws-replication-issue424-*.test.ts   # 4 文件/25 测试绿，exit 0
# 根全量门禁（GATE-C1，4 新套件同轮）
NODE_OPTIONS=--conditions=nomicore-source pnpm test  # 459 文件/5584 测试绿，Type Errors no errors，exit 0
# 类型门禁（GATE-C2）
pnpm exec tsc -p packages/ws-replication/tsconfig.json   # exit 0
pnpm typecheck                                          # exit 0（15 tsconfig）
# 范围门禁（GATE-C3 双段 + 全仓）
git diff --stat -- packages/ws-replication/src packages/replication-protocol/src   # 空
git status --short -- packages/replication-protocol packages/namespace-registry \
  apps domains docs vitest.config.ts                   # 空
git diff --stat HEAD                                   # 空
# 临时数据流探针（已删除；证据留存）
NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx packages/ws-replication/sa7-424-probe.mts
```

证据文件（本轮新增，均 `artifacts/issue424-sa7-*`）：`focused.log`、`focused-post-removal.log`、`full-suite.log`、`typecheck.log`、`dataflow-probe.log`、`scope.log`。

## 10. Deviations

- **零偏差（无 SD-1 触发）**：所有设计声明改变的路线按设计变化（§3）；声明不变的路线保持不变（§4）；状态机合法序与关键值正确、禁止态未出现（§5）；错误与清理符合设计（§6）。
- 观测注记（非偏差）：pass 形态全轨迹字节不等 = 设计 §7.2/O7 登记的 Yjs clientID 语料属性，三层硬门（L1/L2/L3）全部相等；SA4 O1 的 `fires()` 恒真结构与本轮观测一致（判别力由「零触发 timer 下 close(1001)」承载）。
- 基线注记：SA3/SA4 证据采于 `cab3e8c`；本轮全部在 rebased 基线 `efd958f` 重新采集（两基线生产/配置零 diff，亲验），SA3 的 459/5584 结论在当前基线复现成立。

## 11. Verdict

**`approve`**

- 四套件 25/25 绿（×3 轮一致 + 全量同轮）；根全量 459/5584 绿、双 typecheck exit 0、DENY 面零 diff（rebased 基线 `efd958f`）。
- 设计 §8.4 R1–R8 全部关键跳点（授权单点/缝纯 JSON/字节重组/mux 盖章/信号二态/收口投影/adopt 同一性/双向收敛）取得运行期观测值且与设计一致；SA6 契约 AUTH/ROUND/SHARD/SEQ/TERM/REVOKE/REAUTH/GATE 全组与负控（NC1–NC4、AUTH-C5、REAUTH-C2、TERM-C3、SD-2(b)、装配前提）动态落绿。
- 状态机转换与关键值正确；禁止转换（未授权过缝、重复 authorize、连带收口、close 后复活、静默兜底）均未出现；错误沿设计路径传播、清理到达 quiescence。
- 临时诊断已删净并复跑确认；无新增 finding；SA4 §10 三项后续动态验证全部完成且通过。
