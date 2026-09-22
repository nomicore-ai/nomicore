# task_issue-424 SA9 标准审查（Standards Review）— 分片形态端到端等价性验收（spec #415 T7）

- 被审对象：**已提交最终交付 diff** = commit `a62f23f423dc80de08e8a34db5748358e77a63f9`（`test(ws-replication): cover sharded hub equivalence`），基线 = 当前稳定父基 `efd958f`（`fix(#420)… (#430)`，main 谱系尖端）。
- dispatch：`sa-f500e2c0-82c2-4f01-8404-a44b20567cbd`（role=mabf-sa9，phase=standards-review，iteration=0）；Issue 评论 REST 快照为空（`[]`，dispatch 明示）——**无 Owner 评论要求可纳入**（与 SA6/SA8/SA2/SA3/SA4 五方结论一致）。
- 审查范围（SA9 纪律）：仓库 AGENTS、ADR、模块责任、既有架构惯例、单一事实源、生命周期对称性、文件范围、测试质量标准。**不**审查 Issue 需求是否完整实现（归 SA10）；未修改任何代码/设计/测试，未运行测试/启动服务，未调度其他 SA，未 commit/push/PR。
- 审查方式：交付 diff 五文件全读（841+257+212+215+340 行）+ 设计/SA2/SA3/SA4/SA6/SA7/SA8 产物全读或抽验 + 仓库标准原文（根/模块 AGENTS、ADR 0032、协议 v1、CONTEXT.md、vitest/tsconfig/CI）+ **独立 git/grep 亲验**（不沿用任何上游报告的核验结论代替本人核验）。

## Verdict

**`approve`** —— 无 BLOCKER、无 MAJOR。交付 diff 在全部八个标准维度上合规（§1–§8 逐维证据）；MINOR 观察 M1–M5（§9）全部不阻断。

## 0. Reviewed inputs

| 输入 | 位置 | 状态 |
|---|---|---|
| 交付 diff | `git show a62f23f`（30 文件，7157 行新增，零删除零修改） | 全量核验 |
| 五交付文件 | `packages/ws-replication/test/issue424-sharded-hub.ts` + 4 个 `ws-replication-issue424-*.test.ts` | 全读 |
| 设计（迭代 1） | `wiki/raw/task_issue-424_design.md`（642 行） | 全读 |
| SA2 复审 / SA3 实现 / SA4 红队 / SA7 动态 / SA8 实施冲突 | 同目录对应文件 | 全读/抽验（verdict 分别为 approve/完成/approve/approve/clear） |
| SA6 契约 + 决策摘录 | `task_issue-424_sa6_contract.md`、`task_issue-424_relevant_decisions.md` | 抽验 |
| 仓库标准 | 根 `AGENTS.md`、`packages/ws-replication/AGENTS.md`、`docs/adr/0032-…md`（68 行全读）、`docs/protocols/instance-replication-v1.md`（行锚抽验）、`CONTEXT.md`（L225-235 抽验）、`vitest.config.ts`、`packages/ws-replication/tsconfig.json`、`.github/workflows/ci.yml` | 亲验 |
| 生产源码锚点 | `src/{index,types,defaults,hub-edge-host,hub-session-host}.ts`、`test/driver.ts`、`packages/namespace-registry/src/testing.ts` | 逐点亲验（只读） |
| 门禁证据日志 | `artifacts/issue424-{gate-full-suite,gate-typecheck,gate-scope,focused-determinism,sa7-full-suite,sa7-focused-post-removal}.log` | 抽验（尾部计数/exit 码与声明一致） |

## 1. 仓库 AGENTS 与模块 AGENTS 合规

| 标准条款 | 交付落点 | 判定 |
|---|---|---|
| 根 AGENTS「Instance replication」：改复制行为以 ADR 0010 为架构、协议 v1 为规范契约；chunked 变更另遵 ADR 0013/0022 | 本票**零复制行为改动**（test-only）；套件是这些契约的验收面：头注逐条引用协议节次（行锚抽验属实，见 §8）；chunked 深度矩阵按 SD-4 裁决正确让位既有资产锚（#243/#246/#300/#301，协议 §22 登记），不把 ADR 0013/0022 验收面拉进 ADR 0032 等价性票 | ✔ |
| 模块 AGENTS「Export production APIs through `src/index.ts`; keep … test controls in the explicit testing surface」 | 夹具载入面 = `@nomicore/ws-replication`（公共入口）+ `@nomicore/replication-protocol` + `@nomicore/namespace-registry/testing`（显式 testing 面）+ `./harness.js`/`./driver.js`；**零深路径 import 生产模块**（grep `from '(\.\./src\|@nomicore/[^']*/src)` 命中 0，亲验 exit=1） | ✔ |
| 模块 AGENTS「Use injected transport, scheduler, randomness, and optional observer/clock seams」 | 全虚拟时间（`makeAccountingTimer` 记账不触发 + `createRegistryTestScheduler` + `settle/settleUntil`）；内存管道 transport；seeded `randomBytes`（128-bit 纪律，非 16 即抛） | ✔ |
| 模块 AGENTS「Preserve shutdown safety and follow §21 as the authority」 | REAUTH-C1/C2 与 TERM 组断言 drain 提前完成 close(1001)/deadline 兜底纪律，行锚 §21 L684 抽验属实 | ✔ |
| 模块 AGENTS 验证门（changed state-machine path → 聚焦 + 包 typecheck + 根 typecheck/test） | 聚焦 4 套件 ×3 轮逐行一致（`focused-determinism.log`/`sa7-focused*.log`）；包 tsc exit 0；根 typecheck exit 0 ×2；根全量 459 文件/5584 测试绿 exit 0（`gate-full-suite.log` L 尾部计数亲验；SA7 在 rebased 基线复采一致） | ✔ |
| 根 AGENTS「typed Namespace writes 强制」 | 不适用面：本票无应用侧 Namespace 数据写入路径（测试文档由既有 `makeHubNamespace`/boot fixture lease 基建承载，非新写入面） | ✔（不触发） |

## 2. ADR 0032 合规（核心母法逐条）

| 决策条款 | 交付事实（本人亲验） | 判定 |
|---|---|---|
| 决策 1：协议状态机单份，只许分布式实例化；宿主自写连接级半边 = fork，否决 | 夹具零自写协议行为：被装配对象恒为公共工厂真身（`createHubReplicationEdge`/`createHubSessionHost`/`createHubReplication`/真 Registry）；桥（`makeShardedHost`，fixture L293-422）只做字节/JSON 中继与信号搬运——无应答合成、无错误码选择、无缓冲/重排/重试、无准入管线复制（非目标纪律与头注第 1 条一致） | ✔ |
| 决策 2：缝只过字节与纯 JSON；出站 `sequence=0` 占位 + edge mux 点重写 `[8..12]` | 桥投影逐行对应：`openNamespace` → `handleFrame(encodeMessage(message,{sequence:0}))`（L391）；`onFrame` 出站原样透传并**零改写回传被分配序**（L370-377）；`selectedCapabilities` 唯一事实源 = `egress.chunkedUpdateNegotiated()`（L331，与 egress 接口注释「唯一事实源」原文吻合） | ✔ |
| 决策 3 + A2-β：authorize 在 edge 单点；未授权 OPEN 不过缝；OPEN 准入管线全为 edge 规范职责 | authorize wrapper 只记录调用序后直 delegation（L318-321）；deny/throw 形态 `sessions=0/opens=0/resolves=[]` 有专测（AUTH-C2/C3）；无第二准入管线；SD-2(b) 退化路径（登记缺失 → 连接级 INTERNAL_ERROR + 1011 响亮收口）冻结为可执行负控而非静默兜底 | ✔ |
| 决策 4：路由键定偏移；合法无 sink → 合成 `NAMESPACE_STATE_VIOLATION` | SHARD-C3 只**观察**合成帧与连接存活；路由本身零 harness 实现 | ✔ |
| 决策 5 + A1/A3：信号公共载体与降级面 | `settled`→`namespaceSettled`、`connection-fatal`→`connectionFatal` 映射逐行对应（L378-387）；观察面（observer 事件集/assembly 口径）正确排除在 parity 硬门之外（H8/协议 §23.1 文档化差异） | ✔ |
| 后果 L64-66：公共面发布即冻结，append-only | 交付零公共面变更：`git diff efd958f..a62f23f -- packages/ apps/ domains/ docs/ vitest.config.ts 'tsconfig*.json' package.json …` 仅 5 个新测试文件（1865 行）；src/协议/registry/docs/配置**零 diff**（亲验） | ✔ |
| 决策 2 附款：nomicore 零 worker_threads/MessageChannel 依赖 | 进程内内存管道为载体抽象；零相关 import（通读亲验） | ✔ |

## 3. 模块责任

| 行为 | 应有归属 | 实际位置 | 判定 |
|---|---|---|---|
| 连接级/namespace 级 FSM、准入台账 | 生产 edge/session 半边 | 夹具零实现（被测对象恒真身） | ✔ |
| authorize / 拒绝帧 / 准入管线 / drain 门 | edge（决策 3；CONTEXT.md L226 Avoid 项） | 夹具只注入授权桩（缝另一侧），不复制任何拒绝路径 | ✔ |
| 出站序盖章 | edge mux 单点（决策 2） | 桥透传 + 回传值零改写；`sinkReturns` 探针只镜像 | ✔ |
| 连接→egress 登记（测试装配态） | `ShardedHost.accept/acceptTrusted` 单点（SD-2(a)） | `register()` 唯一写点（L403-409，返回后第一动作）；resolver 只读、取不到即同步 throw（L325-328）；facade 与 pipe 共享同一实现（D1——**避免第二写点**） | ✔ |
| 宿主分派决策 | 测试替身 `routeByNamespace` | 无命中即抛（L225，响亮、无静默兜底） | ✔ |
| boot 形态 hub 文档事实源 | boot `hubNode.registry` | adopt 装配直引（`AdoptedWorker.registry = options.registry`，无副本）+ 每形态 boot 后引用同一性前提断言（cross-seam-round L56-59）——F-R1 三重闭合（签名不可表达错位/前置断言/头注明文）全部在位 | ✔ |

## 4. 既有架构惯例

| 惯例 | 先例 | 交付 | 判定 |
|---|---|---|---|
| 夹具命名/头注纪律 | `issue420-shim-hub.ts`（拓扑图 + 职责边界 + 规范引用 + 「非规范宿主样例」登记） | `issue424-sharded-hub.ts` 同构（头注 7 条登记：非规范样例/SD-2(a)(b)/SD-3/boot 同一性约束/限值纪律/零深路径） | ✔ |
| 套件命名 | `ws-replication-issueNNN-*.test.ts`（issue137~issue423 共 90+ 文件） | 4 个 `ws-replication-issue424-*.test.ts` | ✔ |
| 证据日志惯例 | `artifacts/issueNNN-*.log`、`artifacts/sa6-issueNNN-*.log`（issue 420/422 前序票同款） | `artifacts/issue424-*.log` ×10 + SA6 保留件 ×4 原样入档 | ✔ |
| 流水线产物位 | `wiki/raw/task_issue-NNN_*.md` | 设计/评审/冲突/SA 报告同位 | ✔ |
| commit 消息格式 | `test(ws-replication): …`（如 2c87b3b） | `test(ws-replication): cover sharded hub equivalence` | ✔ |
| 既有基建零修改就范禁令（SA6 §12.0） | — | `git diff --stat HEAD` 空（工作树零 tracked 修改）；交付 diff 对 `test/{harness,driver,issue420-shim-hub}.ts` 与既有 455 测试文件零触碰；基线只增（455→459 文件、5559→5584 测试，恰 +4/+25） | ✔ |

## 5. 单一事实源（SSOT）

| 事实 | 权威源 | 派生态处置 | 漂移风险 |
|---|---|---|---|
| 限值/超时取值 | 公共 `DEFAULT_REPLICATION_LIMITS/TIMEOUTS` 冻结常量 | `LIMITS` 直赋（`ResolvedLimits` 空扩展，types.ts:1009 亲验）；`TIMEOUTS` 同值收窄（见 M5）；edge 侧不传 → 工厂内 resolve 同组缺省（defaults.ts:61-69 亲验）——**无第二组值、无 fallback 复制**；harness `CONTRACT_*` 旧形（缺 5 分块字段）被显式弃用并登记理由 | 低 |
| UPDATE_CHUNK 协商位 | edge `chunkedUpdateNegotiated()` | 描述子 `selectedCapabilities` 由桥单点投影 | 低 |
| 连接登记 | `connections` Map 单写点 | resolver 只读；无预登记/占位回填等第二状态 | 低 |
| wire 出站序 | edge OutboundQueue | 断言读 `[8..12]` 原字节（`rawSequence`），不重建计数 | 低 |
| namespace 身份 | seeded randomBytes（同 seed 同 id） | 每场景 `expect(worker.namespaceId).toBe(scriptNamespaceId(script))` 逐场景锚同源前提（auth-parity L73/L80） | 低 |
| 协议常量 | `@nomicore/replication-protocol` 导入（`CAP_CHUNKED_UPDATE`/`encodeMessage`/`decodeMessage`）+ `LIMITS.maxFrameBytes` | 零字面量复制 | 低 |
| boot hub 文档 | `run.hubNode.registry`（被采纳） | adopt 直引 + 前提断言；无镜像 registry | 低 |

## 6. 生命周期对称性

| Start/acquire | Stop/release | 实测锚点 | 判定 |
|---|---|---|---|
| `accept/acceptTrusted` → `register()` | `connection.close()/settle()` → 生产适配器 `onConnectionClosed` → `handle.close()`（幂等**同 promise**） | TERM-C1（两会话 closeCalls≥1 + 推进 30s 零新出站）、TERM-C2（`handle.close()===handle.close()` 同 promise 断言 L135-139） | ✔ |
| facade 进入即建 `AdoptedWorker` | `facade.close()` 幂等 tail（closeTail 单 promise 缓存 L483-489）+ `run.peer.stop()` | ROUND 收尾用例：close 同 promise、pending 不增、零新出站、零 unhandled | ✔ |
| `makeAccountingTimer` set/clear 记账对称 | `pending()` 不增为无泄漏判据 | TERM-C2 / ROUND 收尾 | ✔ |
| `collectUnhandledRejections()` | `finally dispose()` | lifecycle L119-145、cross-seam-round L183-210 | ✔ |
| sink 四成员 ↔ handle 五成员投影 | 计数包裹 delegate 原句柄，无所有权吞没 | TERM/REVOKE 组全绿；`terminateUnauthorized`/`close` reject 归一沿用生产纪律 | ✔ |

资源释放判据（scheduler pending 不增 + close 后零新出站 + 零 unhandled）在 pipe 与 boot 两形态各有落点；连接隔离负控（TERM-C3：关其一另一零 close/零新出站）在位。无获取/释放不对称面。

## 7. 文件范围

| 维度 | 本人独立核验 | 判定 |
|---|---|---|
| 交付 diff 构成 | `git show a62f23f --stat`：5 测试文件（1865 行）+ `artifacts/issue424-*.log` ×10 + SA6 保留件日志 ×4 + `wiki/raw/task_issue-424_*.md` ×11 + SA6 探针 `.mts` —— 全部落在设计 §11 ALLOW（行 1-7）或「保留件原样入档」面 | ✔ |
| DENY 面零触碰 | `git diff efd958f..a62f23f -- packages/ws-replication/src packages/replication-protocol packages/namespace-registry` = 空；`-- apps domains docs vitest.config.ts tsconfig*.json package.json` = 空；工作树 `git status --short` 仅 `?? wiki/raw/task_issue-424.md`（任务简报，见 M1） | ✔ |
| SA6 保留件未覆写 | 保留件（`sa6-issue424-*`、探针）mtime 08:52-08:54 早于 SA3 产物 10:09+，内容与 SA4 核验时一致 | ✔ |
| 发现面/类型面 | `vitest.config.ts` include `packages/*/test/**/*.test.ts` 命中 4 新套件（CI ci.yml 全量 `vitest run` 真实触发）；夹具 `.ts` 入 `packages/ws-replication/tsconfig.json` include（包 tsc 覆盖）；零新公共类型面 ⟹ 无 `*.test-d.ts` 需求（SA6 §12.0） | ✔ |
| 范围扩缩纪律 | 设计 §11 明示「评审修订需要改变范围时显式更新本表」；F-R1 迭代零范围变化且全文登记；SA3 D1-D6 全部落在 ALLOW 的 test-only 文件内 | ✔ |

## 8. 测试质量标准

| 标准 | 核验 | 判定 |
|---|---|---|
| 零 skip/only/todo/env override/真实定时器 | grep `\.(skip\|only\|todo)\|process.env\|vi.useFakeTimers\|setInterval\|Date.now` 命中 0（exit=1）；唯一 `setTimeout(` 文本 = 假 timer 接口方法实现（fixture L128，注入面） | ✔ |
| 断言读运行时行为（禁源码 grep 断言） | 全部断言面向：wire 原字节 hex/`[8..12]` BE 序/解码 kind+code/`ackedSequence` 回指/close code+reason/会话与调用计数/描述子纯 JSON/`Y.applyUpdate` 后 ROOT/META 语义/scheduler pending/unhandled 事件 | ✔ |
| 负控/红臂保持 | AUTH-C5(a)(b)(c)（含「门非恒真」对照）、NC1-NC4、REAUTH-C2 阴性对照、TERM-C3 连接隔离、SD-2(b) 退化负控、ROUND 装配前提——全部在位且无一软化；既有 455 文件断言零修改（git 亲验） | ✔ |
| 确定性纪律（设计 §7.7/§7.8） | 聚焦 4 套件 ×3 轮逐行一致（SA3 日志；SA7 在 rebased 基线复采 3/3 + 探针删除后复跑一致）；套件零变异开关、零条件分支 | ✔ |
| 硬门口径（设计 §7.2 / 协议 §22 L701） | L1/L2 枚举白名单 + L3 骨架；禁 L2 字节断言；observer 面/assembly 口径不入 parity；硬门定义原文写进 auth-parity 头注（契约 §12.1 义务）；行锚抽验属实（§3 L57 序纪律、§13.1 L415 INTERNAL_ERROR→1011、§13.2 L424/L425/L430 终局表、§12 L375 ackedSequence、§6.1 L137 协商位、§21 L684 drain、CONTEXT.md L225-235 词表） | ✔ |
| fixture 隔离/清理 | 每用例新建 worker/host/pipe（无跨用例可变态）；SD-3 每场景一工厂防撞键（重复键由生产 `open()` 响亮 throw 守卫，hub-session-host.ts:247-253 亲验） | ✔ |
| 同轮门禁证据 | GATE-C1 459/5584 绿且 4 新套件同轮；GATE-C2 双 typecheck exit 0（文件冻结后复跑）；GATE-C3 双段 + 全仓 status + 纪律扫描——日志抽验与声明一致 | ✔ |

## 9. Non-blocking observations（MINOR，均不阻断）

| ID | 观察 | 依据 | 建议处置 |
|---|---|---|---|
| M1 | 任务简报 `wiki/raw/task_issue-424.md` 未随交付 commit 入档（仍 untracked）；先例（`task_issue-171/226/227/242…`）简报通常随流水线产物入库，issue 420 亦有独立「archive evidence」后补 commit | `git status --short`；`git ls-tree` 对照 | finalize/归档 commit 补入；不影响任何代码/测试/验证标准 |
| M2 | `AccountingTimer.fires()` 硬编码 0 ⟹ REAUTH-C1 的 `expect(timer.fires()).toBe(0)` 结构性恒真；实际判别力由「零触发 timer 下观察到 close(1001)」承载，drain 未提前完成时测试仍正确红 | fixture L139；lifecycle L287（附议 SA4 O1） | 后续如要让 fires() 成真观察点可让假 timer 显式计数触发；本票无需改 |
| M3 | `docStateOf` 不 apply `UPDATE_CHUNK` 分块载荷（L2 白名单含 UPDATE_CHUNK 但判据 inert）；当前语料（SD-4 最小读法）不产生 UPDATE_CHUNK | fixture L658-679（附议 SA4 O2） | follow-up 扩 chunk 语料时同步扩 judge |
| M4 | AUTH-C5(a) 依赖两次独立 Y.Doc clientID 不碰撞（≈2⁻³²）——碰撞时负控**红**（失败方向安全，不会假绿）；部分 pipe 场景未显式 close 连接（per-test 进程内对象、无真实句柄、maxWorkers 1 串行） | auth-parity L200-204；fixture L784-826（附议 SA4 O5/O6） | 可接受；确定性 clientID 注入归 SA6 §15-4 follow-up 票 |
| M5 | D5 `DEFAULT_REPLICATION_TIMEOUTS as SessionHostTimeouts` 单点显式收窄：本人亲验 `ResolvedTimeouts` 重声明 ping/pong/assembly 三字段必填（types.ts:1010-1014）而常量声明类型三字段可选（defaults.ts:40-52）⟹ 裸赋不过 typecheck；收窄对象为**同一冻结常量**（零取值分叉、零 fallback）；SA8 设计复审 §8-2① 预授权两合法选项之一；test-only 夹具非根 AGENTS 所指 business code | fixture L107-110；types.ts/defaults.ts 亲验 | 生产侧放宽常量声明类型归新票（SA3 Deferred 4 已登记）；本票正确不就地改 DENY 面 |

## 10. 结论与证据基线

- verdict：**`approve`**（无 BLOCKER/MAJOR；M1–M5 全部 MINOR 不阻断）。
- 独立核验覆盖：交付 diff 全量、五交付文件全读、ADR 0032 全文、协议/CONTEXT 行锚抽验、公开导出面与生产锚点逐点亲验、git 范围/状态亲验、纪律 grep 亲验、门禁日志抽验。上游链（SA6 approve → SA8 前置 clear → SA1 迭代 1 → SA2 approve → SA8 设计复审 clear → SA3 完成 → SA4 approve → SA7 approve → SA8 实施 clear）与本人结论一致，未发现其遗漏的标准违例。
- `requiresConflictRecheck = false`：本轮未发现新的 ADR/规范冲突面（交付 test-only、零公共面、零决策文本；D1-D6 均已在 SA8 实施冲突报告 adjudication 内）。
- 唯一写入产物 = 本文件；未修改任何代码/测试/设计/证据文件；未运行测试/启动服务；未 commit/push/创建 PR。
