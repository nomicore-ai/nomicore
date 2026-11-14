# SA4 实现静态评审 — issue #471：Cordis rc.12 Hub/Peer/SessionHost 全链兼容

状态：**implementation-review，iteration 0 → iteration 2（增量复审）**。iter-0 dispatch：`sa-5fee5e6c-1e68-490d-8da0-22a3b05cb96b`；iter-2 dispatch：`sa-3e297789-841a-4cdb-a609-9f11e2176022`。本会话只读核证（唯一写入 = 本文件）；未修改任何实现/测试/设施（iter-2 按其 dispatch 授权**只读复跑了 `gates.mjs`**，其余 `.cache/` 证据为「落盘核对」）。iter-0 verdict（reject，1 MAJOR SA4-1）见 §10/§15；**iter-2 增量复审：SA4-1 已闭合，verdict = approve**，见文末「iteration 2 增量复审」章节。
被审对象：工作树实际 diff（基线 `d59a4d1`，HEAD 即基线、全部改动在工作树）＝ 3 修改设施 + 7 新增测试/台账，恰 SA8 §9.1 十文件闭合 ALLOW。

---

## 1. Reviewed inputs

| 输入 | 核对方式 |
|---|---|
| `wiki/raw/task_issue-471_design.md`（rev 3，§9.2 rev 2.1） | 全文 620 行 |
| `wiki/raw/task_issue-471_sa6_acceptance_contract.md`（AC1–AC9） | 全文 641 行 |
| `wiki/raw/task_issue-471_design_conflict_report.md`（iter-0/1/2/3；§9.1 十文件、T-1…T-4、B-1…B-5、§9.3、§14 I-1@rev2.1/I-2/I-3） | 全文 566 行 |
| `wiki/raw/task_issue-471_sa3_impl.md` | 全文 211 行 |
| `wiki/raw/task_issue-471_sa2_review.md`（终裁 approve，§19.7 实现期指令） | 关键节逐字 |
| 实际 diff：`baselines.json` / `run-baseline.mjs` / `gates.mjs`（`git diff d59a4d1` 全量）；7 新文件全文实读 | 逐行 |
| 落盘证据（`.cache/`，gitignored，只读核对）：`evidence/matrix/{matrix.json,matrix.log,unit-union.json}`、`evidence/B*/…`、`evidence/gates/gates.log`、`evidence/root-test{,- base}/…`、`evidence/negative/{N1-N2-faults.log,N6-gates.log}`、`mutations/mutations.json` | 机械读取比对 |
| 仓库事实：`vitest.config.ts`、根 `package.json`、`apps/yjs-server/src/main.ts:36–37`、既有 `harness.ts`/`issue420-shim-hub.ts`/`issue447-async-seam.ts` | 抽查实读 |

## 2. Verdict

**reject（1 项 MAJOR：SA4-1）**。骨架质量高：十文件闭合守界、零生产 diff、四测试文件可证伪性真实、台账/负控/变异证据链完整、设施 diff 无任何谓词放宽；唯一阻断点是新 gate **G10 对 SA8 钉死语义 I-1③（M4 跨行实参位 fail-closed）未实现且实现报告声称已落实**——该缺口是纯 `gates.mjs` 单点（或回 SA8 精确化语义）的外科手术式修订，不动摇其余交付面。MINOR 4 项见 §10/§12。

---

## 3. 上游要求落实（Owner 9 条 AC → 实现证据）

| AC/义务 | 实现证据（file:line） | 判定 |
|---|---|---|
| AC1（A1-1…A1-7） | `ws-replication-cordis-root-channel.test.ts:266–467`（29 用例：5 形态 ×3 入口、malformed/双缺席/服务缺失×2、级联 4 例、sentinel 3、通道身份 1）；文案逐字 `:54–55` | pass |
| AC1（A1-8 十二族） | `ws-replication-cordis-root-timers.test.ts:336–770`（`T.*` ×12，三段断言齐备，见 §6 逐族表）；证据 `evidence/B1/ws-cordis-timers.json` 12 族名在场、repeat=3 | pass |
| AC2（3×3×7 + β/γ） | `ws-replication-cordis-baseline-lifecycle.test.ts:260–571`（21 单元 + β `:450` + γ `:510` + `coverage` `:575`）；runner `units={23,23,[]}` ×3 基线（matrix.json）+ 并集 69（`unit-union.json`） | pass |
| AC3（A3-2/A3-4；A3-1/3/5 经既有文件进 cell） | `third-party-timer-ownership-red.test.ts:119–144`（A3-2 deadline 断言）；A3-4 = timers `T.fence-watchdog:617–640`；composition-root/unload suite 注册（`run-baseline.mjs:85–99`） | pass |
| AC4（A4-1…A4-4） | ownership `:61–117`（含正向对照 `:113`）；`dsh-profile-direct-apply-order.test.ts:22–90`（顺序 + 幂等 + 真实 timer 驱动 flush） | pass |
| AC5（A5-1/A5-2/A5-3/A5-4） | G10（gates.mjs:343–620）；5 形态 describe 枚举；4 fixture 零 diff（G3 + git status）+ 66/66×3；A1-1/A1-2 即通道证据 | pass（G10 语义缺口见 SA4-1） |
| AC6 | guard-proxy 六文件 suite（`run-baseline.mjs:77–84`）+ `a64` 文件级判定 `:765–783`；三基线 38/38、a64 三 true（matrix.json） | pass |
| AC7 | suites 尾部追加 6 项（baselines.json 语义 diff 恰 3 处，经 JSON.parse 双向比对核证）；E1–E7+E4a 落地；NEW_FILES +7（`run-baseline.mjs:125–132`） | pass |
| AC8 | typecheck cell 原样；3×15/15（`evidence/B*/B*-typecheck.json` 实读全 exit0）；41 行矩阵全 pass；A8-4 披露在 impl §8-2 与 root-test cell `disclosure` | pass |
| AC9 | G1′/G6/G7/G9/G11/G12 PASS（gates.log）；命令面 node/git/tsc/vitest（`pnpm --version` 探针为 BASE 既有） | pass |

Owner 评论：`[]`（SA6 §2、SA8 §2 复核一致），无遗漏评论义务。

## 4. 设计落实审查（含偏差裁决）

| 设计决策 | 实现位置 | 判定 |
|---|---|---|
| D-1 零生产 diff | `git diff --name-only d59a4d1 -- 'packages/*/src' 'apps/*/src' 'domains/*/src'` = 空（本会话实跑） | pass |
| D-2 六新测试 + helper | 全部在盘；见 §6 | pass |
| D-3 suite 架构 12 项 | baselines.json suites = 6 既有 + 6 新（顺序保持 provenance→root-probe 前置）；E7 装载自检 `run-baseline.mjs:53–56` | pass |
| D-4 repeat 口径 | timers/lifecycle repeat=3（`:645`），channel/guard-proxy/composition-root/ws-package repeat=1 | pass |
| D-5 BASE 重钉 | `gates.mjs:41`、`baselines.json base` 均为 `d59a4d1…` | pass |
| D-6/S4 台账判定 | `run-baseline.mjs:863–911`（名级谓词 + failedUnexpected + disclosure）；台账文件内容见 §8 | pass |
| D-7 默认布局可运行 | 四测试仅读 runner env（`cordis-baseline-support.ts:33–42`），默认布局 24/29/12/… 全绿（matrix root-test failedUnexpected=[] 机械证明新文件零失败） | pass |
| D-8/D-9 | 4 fixture 逐字节零 diff；A4-4 用新文件 | pass |
| **D-2 偏差（timers bulk/assembly）** | 已收敛为真实 kind=2 chunked SYNC_STEP2 驱动 `armTimer('assembly')`（timers `:701–770`） | **建议接受**，见 §7.1 |
| **D-3 偏差（G8）** | 四类 src 全扫描 + 恰 2 行 BASE 合法 app 配置钉死（`gates.mjs:72–80,736–749`） | **建议接受 + SA8 增量追认**，见 §7.2 |

## 5. 文件范围审查

| Changed path | ALLOW 条目 | 判定 |
|---|---|---|
| `…/cordis-baselines/baselines.json`（M） | §9.1-1 | pass；语义 diff 恰三处（base 重钉、comment 追加、suites +6）。**字节级噪声**：整文件 JSON 重编码（`—`→`\u2014`、`§`→`\u00a7`）使未列编辑点的行产生 diff（MINOR SA4-5） |
| `…/cordis-baselines/run-baseline.mjs`（M） | §9.1-2 | pass；编辑点 ⊆ E1–E7+E4a（逐点见 §6.3），无谓词放宽 |
| `…/cordis-baselines/gates.mjs`（M） | §9.1-3 | pass（文件级）；G10 语义对 I-1③ 的偏离见 SA4-1 |
| 4 个 ws 新测试 + `cordis-baseline-support.ts`（??） | §9.1-4…7 | pass；G3 allowlist 恰此 4 文件（gates.mjs:52–58，实跑 PASS） |
| `apps/yjs-server/test/third-party-timer-ownership-red.test.ts`（??） | §9.1-8 | pass |
| `packages/dsh-persistence/test/dsh-profile-direct-apply-order.test.ts`（??） | §9.1-9 | pass |
| `…/cordis-baselines/root-test-known-red.json`（??） | §9.1-10 | pass |
| 其余仓库路径 | DENY | 零触碰（`git status` 恰 10 文件 + `wiki/raw/task_issue-471*.md` 任务文档）；生产 src 零 diff；manifests/lock/artifacts/docs/tsconfig/vitest.config 零 diff（G1′/G6/G7/G9 PASS） |

`cordis-baseline-support.ts` 不被根 glob 收集：`vitest.config.ts` include = `packages|domains|apps/*/test/**/*.test.ts`（`.ts` helper 排除）✓（本会话核证 include 模式）。

## 6. 测试质量审查（dispatch 项 1 —— 可证伪性）

### 6.1 channel（A1-1…A1-7）

| 面 | 断言（file:line） | 可证伪性证据 |
|---|---|---|
| A1-1 优先级 | `:295–310` symbol arm>0 ∧ legacy arm===0 ∧ **reads.legacy===0**（读取次数断言在位） | 变异 M-2 实跑红（9 红：`C.both.priority.*`/`C.malformed.*`/`C.symbol-only.*`，`mutations.json` B1/B2/B3 一致） |
| A1-2 legacy 兜底 | `:282–293` 三入口 ready + arm>0 + reads.legacy>0 | 变异 M-1 实跑红（恰 3 红 `C.legacy-only.*`） |
| A1-3 malformed | `:313–327` 同步 throw 冻结文案 + 服务 undefined + 双计数 0（`legacyRuntime.armCount===0` 证不回落） | M-2 红；文案逐字 `:54` |
| A1-4 双缺席 | `:330–337` | N-2 fault 实跑红（`C.absent.*` ×3，`evidence/B3/fault-legacy-shim.json`） |
| A1-5 服务缺失/畸形 | `:340–370` 冻结文案 `required Cordis service "timer" is unavailable` | 在场（失败判据：文案漂移即红） |
| A1-6 两跳级联 | `:373–417` 四例：timer.ctx 合法通道优先（`:374`）、`{}` 回落（`:387`）、属性缺席回落（`:398`）、**`timerCtx:null` loud fail 不回落**（`:409–416`，断言 pluginCtx arm===0） | 四态与设计 §8.1/A1-6 逐条对上 |
| A1-7 sentinel 无 ambient | `:420–447` arm≥1 → 后果 0 → `expectQuiet` 3× 窗口（`:433`）→ `fireDelay(配置值)` 显式 fire 后果出现 | N-4：错用 `setTimeout` 则 quiet 窗口内后果出现即红 |
| 生产 seam 驱动 | 插件 = 生产 `create{Hub,Peer}ReplicationPlugin`；宿主形状经 `controlledContext`（真 Context 的 Proxy，`cordis-baseline-support.ts:289–311`）注入，seam 两跳解析由生产代码完成；测试无等价逻辑重写 | 结构核证 |
| fault 消费纪律 | `support:293–295`：`FAULT==='legacy-shim'` 时**同一受控 ctx** 注入 legacy（F9 镜像），严格断言原样保留 | N-2 cells 2/2 fail（root-probe + channel） |
| 通道身份 | `:450–466` B3 legacy 必缺席 / B1/B2 symbol 必缺席 | N-1 红（`fault-substitute-npm.json` cells 3/3 fail，红因 `symbol baseline must not expose the legacy root property`） |

### 6.2 timers（A1-8 十二族）

真实基线 `TimerService`：`beforeAll` 内 `installRealTimerMeter()` patch `TimerService.prototype.timeout` **先于任何构造**（`support:83–143`；timers `:138–142`）；假 timer ⇒ `meter.arms===0` ⇒ 断言结构性红（R-5 自执行）。无 sleep 凑（全部 `waitFor`/`settleUntil` 谓词轮询 + 显式 per-test timeout 20–30s）。

| 族 | arm | 触发后果 | 取消后 pending=0 |
|---|---|---|---|
| hello `:336` | delay 35 命中 | close 1002 | fiber dispose `:374` ✓ |
| auth/upgrade `:380` | helloTimeoutMs 载体（F-6 ✓） | close 1008 `upgrade-timeout` + `auth-upgrade-rejected{auth-timeout}` | transport close `:402` ✓ |
| bootstrap `:408` | 4321 可辨识 | `namespace-failed{bootstrap-timeout}`（fast 装配 `:444`） | session close `:427` ✓ |
| close/drain `:457` | closeTimeoutMs（GOAWAY） | close 1001 | hub.close `:492` ✓ |
| reauth `:500` | closeTimeoutMs + `requestReauth` 触发路径区分（F-6 ✓） | close(1001,`hub-reauth`) | `:530` ✓ |
| peer backoff/reset `:536` | full-jitter `random=0.5` ⇒ 确定性 4ms + resetAfterMs 20 | 第二次 dial | dispose `:578–579` ✓ |
| waitForLive `:586` | 25ms 字面量读取点（F-6 ✓） | stop ⇒ waiter reject | `:610` ✓ |
| fence-watchdog `:617` | ackTimeoutMs 双节奏 re-arm ≥2（A3-4） | —（watchdog 保留即判据） | session close `:635` ✓ |
| liveness `:642` | pingIntervalMs/pongTimeoutMs | close(1001,`pong-timeout`) | hub.close `:677` ✓ |
| reconcile `:683` | reconcileIntervalMs | ≥1 回合 | peer.stop `:695` ✓ |
| bulk-ACK `:701` | assemblyTimeoutMs，**真实 kind=2**（`kind2Chunks.length>=2` 断言 wire 实帧 `:725–728`） | 停滞期 pending>0（滑动 deadline 可观察） | hub.close `:733` ✓ |
| assembly-timeout `:739` | assemblyTimeoutMs | `*-aborted{reason:'timeout'}` | aborted 后 `:766` ✓ |

三段判据与设计 §9.1 表（12 行旋钮 = 11 TIMEOUT/BACKOFF 键 + 1 字面量读取点）逐行一致；证据 cell `testNames` 12 族名在场 ×3 基线（`evidence/B1/ws-cordis-timers.json` 实读）。

### 6.3 lifecycle（23 单元 + coverage）

- 23 名与 runner `LIFECYCLE_UNITS`（`run-baseline.mjs:103–115`）**同名同序**（测试文件 `:83–91` 自持枚举）；`coverage` 非 `L.` 前缀（T-1a-2 ✓）。
- **七场景分列**：startup（互斥服务可见性 `:272–274`）/ timer-fired（每入口 arm+后果 `:286–315`）/ timer-cancelled（pending 归 0 + `expectQuiet`「未发生」`:318–351`）/ explicit-stop（**两次 stop 同一 Promise** `:357–359` + drain 期与结束后服务仍注册 `:360/:367`）/ fiber-dispose（有序 effect 清 timer + 零 unhandledRejection `:373–393`）/ service-revoked（**独立单元**：get undefined + require 抛 `/unavailable/` `:396–411`）/ remount（撤销后重挂 ready + **N-5 双挂负控** `duplicate.await() rejects /registered|provided|already/i` `:436–437`）。stop 与撤销分列 ✓、dispose 经有序 effect ✓、双挂 negative control ✓。
- **coverage 自检真能发现枚举缺失**：`completedUnits` 仅在单元体成功后 add（`:282` 等），缺/改名/失败 ⇒ `missing≠[]` 红（`:575–585`）——与 runner 侧 `units.observed===23 ∧ coverage ∧ foreignUnits=[]`（`:602–690`）构成双面锚（runner 改不动测试文件侧）。
- **T-1a fail-closed 落地**：runner 对 title 以 `L.` 起头且 ∉ 枚举 ⇒ `foreignUnits` 非空 ⇒ cell 红（`:606–608/:685–688`）；矩阵三基线 foreign=[] 实证。
- issue420 归置：`WS_LIFECYCLE_FILES`（`:71–75`）+ cell 级文件在场判定 `:675–681`（present + tests>0）——AC8-③ 载体成立（三基线 `issue420={present:true,tests:10}`）。
- 提取口径偏离（title 而非 `' > '` 全名切分）：实现注释 `:591–597` 说明 vitest JSON reporter 以空格拼 ancestorTitles——机械必要且已披露（impl §6.1）；钉死枚举语义不变。**MINOR SA4-6**（口径变化应随 G10 对账同款回 SA8 备案，见 §11）。

### 6.4 ownership / dsh（A3-2、A4-1…A4-4 非恒真）

- A4-1 `O.timer-alive`：persistenceFiber.dispose 后 timer 可取**且 1ms arm 真触发**（`:74–80`）——Host 误 dispose 根 ctx 即红。
- A4-3 `O.no-auto-edge`：**正向对照** `ctx.get('nomicorePersistence')===undefined`（`:113`）证明 fiber 卸载确已发生 ⇒ timer 存活断言非恒真。
- A4-2 `O.last-release`：根 dispose 后 get undefined + arm throw（`:87–96`）。
- A3-2 `O.no-cycle`：stop/shutdown/fiber/root 四段各 5s deadline，死锁即红（`:34–42,119–144`）。
- A4-4：包装**生产对象**的 dispose 入口记录顺序（adapter-dispose→adapter-disposed→root-fiber-dispose）+ 幂等（二次 dispose 零新链）+ 真实 TimerService 驱动 flush（`:61–90`）；交换两个 await 即红——判据与 `profile.ts:98–109` 锚点一致。

**红性总证**：M-1/M-2 三基线定向红（channel 3/9 红）+ 同变异下 ws-package 66/66 绿（缺口证明）+ N-1/N-2 fault 逐 suite cells fail + N-6 gate 红（§9）。无 skip/only/todo（grep 零命中）。

## 7. 偏差裁决建议（dispatch 项 5）

### 7.1 D-2（bulk/assembly 两族）——**建议接受（已收敛，不再是偏差）**

- 判据三段与设计一致：arm `delay===assemblyTimeoutMs`（meter 逐 arm）、后果 = `chunked-sync-aborted{reason:'timeout'}` 族事件 + 停滞期 `pending>0`（滑动 deadline 诚实陈述）、取消 = 连接 close（`:733`）与 abort（`:766`）两路径 `pendingFor===0`。
- 生产性锚：`kind2Chunks.length>=2` 对 wire 实帧解码断言（`:725–728`）排除 kind=0 手工注入；`gate.held()>0` 证明尾帧 withhold 在**测试侧 transport seam**（`stallAfterFirstKind2Chunk:107–133`，`wrapHubEnd` 注入，零生产改动）；「丢帧会成 SEQUENCE_VIOLATION 而非装配停滞」的弃用理由已记录（impl §8-3）。
- 触发链（100KB 写 → live 不可分块 → 恢复 round diff>maxSyncDiffBytes → kind=2）复用 `issue300-chunked-sync-ac-red` 既有配方（`:75–83` 注释锚）。

### 7.2 D-3（G8 两行钉死）——**可接受且已明示；建议 SA8 增量追认为 G8 钉死值**

- 现形态：四类 src（packages/apps/domains）全扫描；通道标记（`CORDIS_BASELINE|ROOT_CHANNEL|NOMICORE_CORDIS_|rc.12`）**任何行恒红**；`process.env` 仅允许 `apps/yjs-server/src/main.ts:36,37`（BASE 既有 NOMICORE_CONFIG 应用配置读，行级钉死，gates.mjs:72–80/746）。
- 强于替代方案（apps 整树豁免）：行级 Set 使该两行的任何编辑（含行号漂移）即红并强制重裁；本会话独立 grep 复核全仓 src 无其他 env 读取（`domains/*/src` 不存在，无遗漏面）。
- 设计 §7.3 G8 行只规定扫描面扩展、未预见 BASE 既有 2 行；impl §8-4 已如实设问。**建议路由**：acceptance-conflict（SA8 增量追认；无需 ADR、无生产改动）。

## 8. 台账合规（dispatch 项 3；B-3a…B-3e 逐条）

| 条款 | 核证 | 判定 |
|---|---|---|
| B-3a 来源冻结 | `ledger-capture.json`：`baseHead=d59a4d1`、BASE 干净副本捕获 32 失败；ledger 32 条与 BASE 失败名集**双向精确相等**（本会话机械比对：BASE 失败不在账 0 条、账内不在 BASE 失败 0 条） | pass |
| ⊆ #470 裁定红集 | knownRed 4 条全部为 `ws-replication-issue421-edge-factory-api.test-d.ts`（#470 I-5.2 归因逐条在 `attribution`）；environmentRed 28 条全部带 pnpm 11.28.5≠10.28.2 归因 | pass |
| 新文件失败入账痕迹 | 无：32 条名字无一来自本票 7 新文件；矩阵 root-test `failedUnexpected=[]`（新文件失败会落 failedUnexpected ⇒ 红，机制上不可入账） | pass |
| B-3b 提取核证 | BASE 捕获 `base-root-test.vitest.json` 实读：issue421 test-d 4 名**实际出现**于 failed 名单（`--typecheck` 在 root-test cell 命令内，`run-baseline.mjs:879`） | pass |
| B-3d 名级谓词 + 披露 | `failedUnexpected = failedTestNames − (knownRed ∪ environmentRed)`（`:906`）；root-test.json `disclosure.statement` 含表述禁令；impl §8-2 逐条披露 + 「不得声称全绿」 | pass |
| 对齐环境复跑证据链 | `aligned-capture.json`：PATH 前置 corepack pnpm@10.28.2 复跑 `5913/5909/4`，失败恰 = 4 knownRed（实读 failedTestNames 与台账 knownRed 一致）、`failedUnexpected=[]`；冻结台账取环境原生 32 条超集形态（两种环境均判绿，B-3a 两形态条款） | pass |

## 9. 负控与变异（dispatch 项 4）

| 项 | 落盘证据 | 判定 |
|---|---|---|
| N-1 逐 suite cells fail + 外层 exit 0 | `evidence/B3/fault-substitute-npm.json` cells = provenance/root-probe/ws-cordis-channel **各 status:'fail'**；`N1-N2-faults.log` `N1_EXIT=0`（编排事实）；红因可核（provenance resolved-outside-overlay + `C.channel-identity.B3` 通道断言） | pass |
| N-2 同口径 | `fault-legacy-shim.json` cells = root-probe/ws-cordis-channel 各 fail；`N2_EXIT=0`；正控（无 fault 同 suite 三基线全绿，V-6） | pass |
| M-1/M-2 应红实红 | `mutations.json`：B1/B2/B3 各 M-1 恰 3 红（`C.legacy-only.*`）、M-2 恰 9 红（`C.symbol-only.*`+`C.both.priority.*`+`C.malformed.*`）；同变异 ws-package 66/66 绿 ×6 | pass |
| 6 次逐字节还原 | `mutations.json` `restores[]`：三基线 × 两变异 `sameAsPristine=true ∧ sameAsHead=true`（bytes 39033）；最终 gates.log G2/G3 PASS 佐证工作树无残留 | pass |
| N-6 gate 自证伪 | `N6-gates.log`：G10 class 6=3（三注入形态）FAIL + G11 FAIL（`internal/update`），3/12 failed；注入位于设计钉死路径（persistence test/src），删除后恢复 | pass（注：G11 注入同时触发 G2 红——G11 扫描面即 src 的固有伴生，非缺陷） |
| 4 fixture 逐字节 + 66/66 | G3 PASS（tracked 零 diff ∧ untracked ⊆ 4 新文件）；ws-package 三基线 pass（matrix） | pass |

## 10. Required revisions

| Finding ID | 严重度 | 证据 | 问题 | Required change | Acceptance | Suggested routing |
|---|---|---|---|---|---|---|
| **SA4-1** | **MAJOR** | `gates.mjs:430–437`（`calleeOfLiteral` 仅本行回溯、遇 `)` 或无可匹配被调名 ⇒ null）+ `:504–505`（`if (callee === null) continue` —— M4 分支首个判定即**静默丢弃**，先于 allowlist/注释/字符串检查） | **G10 未实现 SA8 钉死的 I-1③：M4 跨行实参位/被调点链空白形态的 fail-closed**。设计 §9.2 R1 M4 明文「实参位判定须覆盖跨行调用形态…无法机械归属所属调用时记为不可解析 ⇒ 候选 ⇒ 类 6（fail-closed），**不得静默按非候选丢弃**」；SA8 iter-2 §13.8-2/iter-3 §14.8-2 把它列为落地义务（「以设计文本为准，不照抄脚本」）；SA2 §19.7 末条实现期指令同款点名「M4 跨行实参位」。impl 报告 §4 F-8 行「G10 以 §9.2 文本语义落地（不照抄脚本）—已落实」与代码不符。后果：未来以跨行形态写入的 `Reflect.get(\n  ctx,\n  'root'\n)` 类回归对 G10 **不可见**——这正是三轮 SA8 迭代要封堵的通道；N-6 三形态均为单行，探测不到该盲区。BASE 影响为零（本会话以同款算法复扫 738 文件：57 处 same-line 不可解析丢弃全部为 case 标签/类型联合/模板 JSON/注释等非实参位形态；I-1@rev2.1 计数对账不受影响——impl §5 的对账通过部分源于 gate 与干跑脚本**共享同一局限**） | 二选一：(a) `gates.mjs` M4 分支补跨行调用归属（按文件维护跨行 `(` 栈/记录前行被调链），对「处于实参位但被调不可机械归属」的 `'root'` 字面量记不可解析 ⇒ 类 6；N-6 增一条跨行注入样本；(b) 若认为钉死句按字面不可满足（57 处非实参位形态会被卷入类 6 致 BASE 恒红），**停手回 SA8** 精确化「实参位」判定规则后再落地——不得维持「声称已落实」现状 | 修订后 G10 对跨行 `Reflect.get(ctx, 'root')` 注入样本定向红，且 BASE 首跑计数不漂移（或漂移逐项解释并回 SA8）；实现报告与代码一致 | design（SA8 语义精确化）+ implementation（gates.mjs 落地） |

## 11. 后续动态验证项

| 风险 | Driver | Expected observation | Failure condition |
|---|---|---|---|
| SA4-1 修复后 G10 BASE 首跑 | `node …/gates.mjs` | `cat_6=0`，计数与 I-1@rev2.1 逐项一致（或差异逐项归因并经 SA8 追认） | 新类间移动/第 286 条无解释 |
| lifecycle title 提取口径（SA4-6）与 T-1a 钉死谓词的长期一致性 | 任一基线 `--suite replication-lifecycle` | `units.observed===23 ∧ coverage ∧ foreign=[]`（vitest 升级若改 reporter 字段需同口径复核） | observed≠23 或 foreign 非空 |
| 环境红对齐窗口 | 对齐 `corepack pnpm@10.28.2` 后矩阵 root-test | failedTestNames 收敛为 4 knownRed，failedUnexpected 仍 [] | 出现第 5 条失败未入账 |
| N-1/N-2 fault 通道在 seam 演进后的持续红性 | `--fault substitute-npm / legacy-shim` | 目标 suite cells 逐个 fail | 任一目标 suite 绿 |

## 12. Non-blocking observations（MINOR，不阻断）

1. **SA4-2（MINOR）G10 分类顺序与钉死表序不一致**：设计 R2「判定顺序自上而下首中即定」（1→2→3→4→5→5D→6）；impl 实际 1→5(注释)→3(字符串)→2(helper)→5D→6（`gates.mjs:464–502`）。BASE 计数与 I-1@rev2.1 逐项一致（无行为漂移，两类均为排除+全量记录），但属对钉死表文的字面偏离——随 SA4-1 一并回 SA8 备案追认即可。
2. **SA4-3（MINOR）装饰性断言/死参数**：`G10_SAMPLES` 第二列 `void minimum`（gates.mjs:570–583）；lifecycle `:584` `expect(createNamespaceRegistryForTesting).toBeTypeOf('function')`（为消化未用 import）；timers `:493` `expect(peerAssembly.timer).toBeDefined()`（恒真）。不影响判定强度，建议清理。
3. **SA4-4（MINOR）交付摘要缺 §16.3 调用方影响矩阵成段核对**（§9.3-12）：impl 报告各节散见等价事实（矩阵 41 行、gates 12、root-test 台账、零生产 diff），但无 §16.3 五行矩阵的显式核对段。补文档即可。
4. **SA4-5（MINOR）baselines.json 整文件重编码**：`\u2014`/`\u00a7` 转义使 §7.1 三编辑点之外的行产生字节级 diff（语义级经 JSON.parse 比对恰三处，已核证）。后续设施文件请以最小 diff 书写。
5. **SA4-6（MINOR/备案）units 提取口径的机械必要性披露已到位**（run-baseline `:591–597` 注释 + impl §6.1），建议随 SA4-1 回 SA8 时顺带备案「title 直读」为 T-1a 的实现口径。

## 13. §9.3 十二条交付条件静态核对（dispatch 项 7；动态面以落盘为准）

| # | 条款 | 判定 | 依据 |
|---|---|---|---|
| 1 | 零生产 diff ⊆ 十文件 | **pass** | §5 表；src pathspec diff 空（本会话实跑） |
| 2 | gates 12/12 | **pass（附 SA4-1）** | gates.log 全 PASS；G10 语义忠实度缺口单列 |
| 3 | 三基线 15/15 | **pass** | `B*-typecheck.json` 3×15 exit0（实读） |
| 4 | 矩阵 41 行 / units 23 / 69 并集 / 12 族 | **pass** | matrix.json 41 cells pass；unit-union 69；timers 12 族名 ×3 |
| 5 | A1 三基线全绿 + 文案 | **pass** | channel cells pass ×3；冻结文案断言在盘 |
| 6 | N-1…N-6 应红实红 + M-1/M-2 + 6 次还原 | **pass** | §9 表（全部落盘证据实读） |
| 7 | 4 fixture 零字节 + 66/66 | **pass** | G3 + matrix |
| 8 | S4 台账 B-3a…e | **pass** | §8 表 |
| 9 | 新测试默认布局必绿 | **pass** | root-test failedUnexpected=[]（新文件失败机械落 unexpected） |
| 10 | 反向闸门执行记录 | **pass** | 本轮红 cell 全部归类为实现/设施缺陷并修复（impl §6.1），无就地修 src 痕迹（src 零 diff 佐证） |
| 11 | AC9 全机械面 | **pass** | G1′/G6/G7/G9/G11/G12；命令白名单未扩（`pnpm --version` 为 BASE 既有探针） |
| 12 | 交付摘要 §13.2 + A8-4 + §16.3 矩阵 | **pass（附 SA4-4）** | 披露与禁令在位；§16.3 矩阵缺成段核对 |

## 14. 架构一致性 / 契约连锁 / 错误与并发（摘要）

- **责任归属/单一事实源**：工件表/acquire/probe/runner 单点未动（A7-1/2/3）；测试 helper 不构成第二套验真设施（`support` 头注 + 实文）；`core-dsh-boundary` 守卫面零影响（S3 前提保持）。
- **相似能力对照**：channel 测试镜像既有 `cordis-root-channel.test.ts` F9 纪律（fault 同 ctx 注入）；timers 插桩镜像 `cordis-root-real-timer.test.ts` 原型先于构造纪律；lifecycle β/γ 复用 `issue420-shim-hub`/`issue447-async-seam` 既有装配范本——全部复用而非平行机制。
- **契约连锁**：runner CLI 面零变化（仅 `'gates'` 死字面量清理，E3 授权）；`--fault` 载荷 `cells[]` 语义保留且成为 N-1/N-2 判定载体（E4a/F-1 收紧）；root-test cell 判定从 exit 码改台账（S4 授权面内，新红仍 gate）。
- **错误/恢复/并发**：cell 可单点重跑；repeat 早停为既有语义；测试竞态以谓词轮询 + deadline + `expectQuiet` 拉开；每用例清理（fiber/root dispose、meter restore、unhandledRejection 监听成对 off）。
- **生命周期对称**：`installRealTimerMeter` patch/restore 成对（beforeAll/afterAll）；`controlledContext` 经 base.fiber.dispose 收口；变异副本还原双向校验。

## 15. 结论

实现质量整体高于门槛：可证伪性有变异/fault 双向实证、台账与负控证据链完整可复核、设施 diff 无一处谓词放宽、守界精确。**唯一阻断 = SA4-1（G10 M4 跨行 fail-closed 未实现且被声称已落实）**——属对 SA8 钉死值（§13.5/§14.8-2）与 SA2 实现期指令（§19.7）的忠实度缺口，修复面单一（gates.mjs M4 分支或回 SA8 精确化），不影响本票其余任何交付面的有效性。修毕后可连同 SA4-2/SA4-6 备案一并回 SA8 增量追认。

**verdict = reject（1 MAJOR / 4 MINOR）**；`requiresConflictRecheck = true`（SA4-1 触碰 §13.5 钉死值语义面，修复方案须回 SA8；D-3 两行钉定建议随同一轮追认）。

---

# iteration 2 增量复审（implementation-review iter-2）

状态：**SA4-1 已闭合；verdict = approve（0 BLOCKER / 0 MAJOR；新增 3 项 MINOR 观察，均不阻断）**。SA4 dispatch：`sa-3e297789-841a-4cdb-a609-9f11e2176022`。本轮只核验 delta（SA3 iteration 2 窄面修复）与 iter-0 接受判据；唯一写入 = 本文件。

## I2-1. Reviewed inputs（iter-2 增量）

| 输入 | 核对方式 |
|---|---|
| `wiki/raw/task_issue-471_sa4_review.md` iter-0（本人上轮，SA4-1…SA4-6） | 全文重读 |
| `wiki/raw/task_issue-471_impl_conflict_report.md` §8-1(a)(b)(c)/§8-2/§9/§10 | 逐字 |
| `wiki/raw/task_issue-471_sa3_impl.md` §9（9.1–9.7）+ §3/§4 F-8/§5 更正 | 全文 |
| 实际 delta：`gates.mjs`（+606/−28 vs BASE，mtime 04:34）、`baselines.json`（+9/−3，mtime 04:30）；`git show d59a4d1` BASE 字节对照 | 逐行 + 机械比对 |
| **本会话实跑**：`node packages/persistence/test/fixtures/cordis-baselines/gates.mjs` → **12/12 PASS，exit 0**（G10 全量 289 条命中落盘后与归档 `evidence/gates/gates.log` 记录级 diff 为空） | 第一手复跑 |
| 落盘证据：`evidence/gates/{gates.log,gates-final.log,gates-prefix.log}`、`evidence/negative/{N6-gates-final,N6-crossline-gates,N6-crossline-blank-gates,M3-no-crossline-probe,M4-old-vctx-probe,N1-N2-faults}.log`、`evidence/matrix/{matrix.json,matrix.log,unit-union.json}`、`.cache/mutations/mutations.json`、`.cache/m4-alignment/*` | 机械读取 + 记录级 diff |
| 零改动面：mtime 证据（`run-baseline.mjs` 03:42、7 新测试 ≤03:51，均早于 iter-2 窗口 04:30+）+ iter-0 行号锚点抽查（`LIFECYCLE_UNITS:103–115`、`:591–597` 注释、`:906` failedUnexpected 均在位） | 机械 |

## I2-2. Verdict（iter-2）

**approve**。iter-0 唯一 MAJOR SA4-1 真实闭合且有第一手复跑证据；4 项 MINOR 逐一闭合或给出可接受理由；不得回退面零回退。新增 3 项 MINOR（SA4-7/8/9，见 I2-8），均为残余角落/文书 nits，不阻断。

## I2-3. SA4-1 闭合核验（dispatch 项 1，重点）

**判定：已闭合（第一手可机械验收）。**

| 判据 | 证据 | 结果 |
|---|---|---|
| 同被调行判定保留 | `calleeOfLiteral`（gates.mjs:434–445）仍是 iter-1 已追认形态；`m4CandidateOf:542–543` 先跑同被调行判定，非 null 即返回（跨行判定只补其 null 分支） | ✓ |
| 跨行实参位 fail-closed ⇒ 类 6 | `m4ContextsOf:463–535` 整文件词法器：字符串/块注释/行注释状态机（`:500–514`，`'`/`"` 行末容错 `:532`，backtick 跨行保持）；括号栈按 `(` push/`)` pop（`:515/:530`，注释/字符串内的括号不入栈）；**分组括号透明**（`record:483–487` 只找最内层 `callLike`）；**点链跨行回溯**（`:516–522` 从 `(` 前越过空白（含换行）后回扫 `[A-Za-z0-9_$.]` 链）；被调点链空白（`(`/`<`/`=` 等非链形）⇒ `callee=null`；`m4CandidateOf:546` callee null ⇒ `callee=UNRESOLVED-CROSSLINE` 候选 ⇒ sweep `:624` 落类 6 | ✓ |
| 静默丢弃消除 | sweep M4 分支 `:620` 的 `continue` 仅对 `!m4.candidate`（= 非实参位：case 标签/类型联合/模板 JSON/注释散文/数组对象元素/箭头体/定义位），与钉死 R1「调用实参位」语义一致；实参位不可归属不再有丢弃路径 | ✓ |
| **不引入误判**（非实参位不得误升类 6） | 双重实证：(a) 本会话复跑 `cat_6=0`；(b) **修复前（`gates-prefix.log`）与修复后（`gates.log`/本会话复跑）289 条全量命中记录逐字节相同**（本会话 diff 为空）⇒ BASE 零条被升类/迁移 | ✓ |
| 复跑 12/12 + cat_6=0 + 计数对账 | 本会话实跑：12/12 PASS exit 0；`scanned=738 cordis_faced=51 categories={"1":20,"2":13,"3":9,"5":4,"6":0,"5D-R":197,"5D-C":46}`；独立分桶：**新增 6 个测试文件恰 4 条命中**（class1 ×`ws-replication-cordis-root-channel.test.ts:453 [allowlist callee=Reflect.get]`、class3 ×`cordis-baseline-support.ts:44`+`third-party-timer-ownership-red.test.ts:87`、5D-R ×`ws-replication-cordis-root-timers.test.ts:212`）⇒ **BASE 子集 = 285 = `1=19 2=13 3=7 5=4 5D-R=196 5D-C=46 6=0`，与 I-1@rev2.1 逐项一致** | ✓ |
| G10 自检/探针随代码走 | 复跑 G10 detail：samples 16/16、cast probes 18/18、**cross-line M4 probes 8/8**、seam 2/2（探针分类器 `classifyM4SampleText:690–706` 复用 sweep 同一 `m4ContextsOf`/`m4CandidateOf`，代码同源） | ✓ |

词法器逐路核证补充：`previousNonSpace` 跨行取「前一非空白字符」；argumentStart = 前一非空白 ∈ {`(`,`,`}（`:493`）；数组元素/对象键/箭头体因无 callLike 括号包裹而结构性非候选（`[`/`{` 不入括号栈）——三条 `none` 探针（`:743–745`）实证。cast/分组形 `(ctx as Fn)\n('root')`：分组括 `callLike=false`（前邻 `=`）透明、`('root')` 括前邻 `)` ⇒ callLike ⇒ 链空 ⇒ UNRESOLVED-CROSSLINE ⇒ 类 6（探针 `:741` 红）。

## I2-4. 自证伪证据可信度（dispatch 项 2）

| 证据 | 核验 | 判定 |
|---|---|---|
| `N6-crossline-gates.log`（cat_6=1 callee=Reflect.get） | **真实注入**：`scanned=739`（738+1）；类 6 记录 `packages/persistence/test/n6-crossline-injection.ts:4 [M4 (callee=Reflect.get)] 'root',` —— 命中行原文 `'root',` 即字面量独占一行（被调跨行的真实文件形态，非合成探针文案）；其余 11 gate PASS、`1/12 failed` exit 1；G12 PASS 证明注入在设施目录外、G2/G3 PASS 证明在 persistence test（与其范围一致） | ✓ 可信 |
| `N6-crossline-blank-gates.log`（callee=UNRESOLVED-CROSSLINE） | 同款：739 扫描、类 6 记录 `:4 [M4 (callee=UNRESOLVED-CROSSLINE)] ('root')`（空链跨行形）、其余 11 gate 绿、exit 1 | ✓ 可信 |
| `M3-no-crossline-probe.log`（判据回退为静默丢弃 ⇒ 5 探针 FAIL） | 逐条 FAIL 文案：4 条 `expected 6/callee=…, got (no candidate)` + 1 条 `expected 5D-C/callee=writeFatal, got (no candidate)`——恰为 5 条依赖跨行判定的候选探针；3 条 `none` 探针不红（回退后仍非候选，方向正确）；`1/12 failed` | ✓ 修复可证伪 |
| `M4-old-vctx-probe.log` | 旧正则回退 ⇒ `ACtx`/`$ctx` 两探针 `expected 6, got 5D-R` —— 边界探针真实在测 | ✓ |
| 证据与终版代码的一致性 | 三份注入日志的**非注入部分 289 条记录与本会话终版代码复跑逐字节相同**（diff 为空）⇒ 注入证据虽落盘于 04:30（gates.mjs 终写 04:34），其分类器行为与终版完全一致，证据有效 | ✓ |
| 注入残留 | `find packages apps -name "*n6*" -o -name "*injection*"` 仅命中 BASE 既有 `diag-pump-scheduler-injection.test.ts`（tracked，非本票）；`git status` 非 wiki 改动恰 §12.1 十文件，无 `n6-*`/注入条目；变异副本 `gates-no-crossline.mjs`/`gates-old-vctx.mjs` 均在 gitignored `.cache/m4-alignment/` | ✓ 无残留 |

## I2-5. 同文件其余偏差（dispatch 项 3）

| 面 | 核验 | 判定 |
|---|---|---|
| `inVctx` 后缀锚定 | `gates.mjs:366–368`：成员 {`ctx`,`context`,`host`} ∪ `endsWith('ctx')‖endsWith('Ctx')`——**大小写敏感、后缀锚定、无前置字符类**（对照探针 `ACtx`/`$ctx` ⇒ 6（`:719–720`）、`fiberCTX`/`Context` ⇒ 5D-R（`:718` 及 JSDoc `:364`）），与 SA8 §8-1(b) 钉死文一致 | ✓ 闭合 |
| 自检表 12→16 行 | `G10_SAMPLES:640–657` 恰 16 行，每行 `[锚点, 类, token]` 三元绑定；4 条新增行 = SA8 §8-1(c) 逐条（`service.ts:46`→3/string interior、`issue301:624`→2/root(、`app.ts:880`→5D-R/receiver=args、`materialize-root.test.ts:782`→**none**）；`gateG10:755–765` 对实跑 sweep 输出逐行断言（none 行断言「不得出现在任何命中类」，`:756–759`）——本会话复跑 16/16 PASS 即每行与实跑一致 | ✓ 闭合 |
| R2 分类顺序 | sweep `:586–600` 与 `classifySampleText:663–684` 均按钉死表序 **1→2→3→4→5→5D→6 首中即定**；行 2/3 限定「代码位」（`!inComment` 守卫）——注释内 token 两行皆跳过、落行 5，语义正确；该限定已明示（§9.2(e)）且为保住 SA8 已追认的 rev2.1 计数（7/4）所必需 | ✓ 闭合 |
| 分类迁移 | **0 条**：`gates-prefix.log`（修前，detail 12/12·15/15·无跨行探针，确系修前形态）与修后 289 条记录 diff 为空（本会话第一手） | ✓ 无迁移 |

## I2-6. 上轮 4 MINOR 闭合（dispatch 项 4）

| ID | 闭合方式 | 判定 |
|---|---|---|
| SA4-2 顺序 | I2-5（表序落地 + 零迁移） | ✓ 闭合 |
| SA4-3 装饰性断言/死参数 | gates 侧已删（`void minimum` 列、`ROOT_EXTS` 常量 grep 零命中）；测试侧 2 处恒真断言（lifecycle`:584`、timers`:493`）**保留**，理由（§9.2(h)）：窄面约束「只涉 gates.mjs」+ 不降低判定强度 + 需复跑对应 cell——**可接受**：两断言为消化 import/装配对象的恒真式，无弱化效应；文件零改动恰是本轮「不得回退」要求 | ✓ 闭合（gates）/可接受（tests 侧缓议，不阻断） |
| SA4-4 §16.3 矩阵 | impl §9.6 五行矩阵成段在位，每行含「当前处理/设计后处理/所需改动/本实现证据」 | ✓ 闭合 |
| SA4-5 baselines.json 最小 diff | 本会话核证：diff **+9/−3 单 hunk**，恰 3 处语义编辑（`base` 重钉 279dba4→d59a4d1、`comment` 追加 #471 句、`suites` +6）；`JSON.parse` 逐键比对：**变化键恰 {base,comment,suites}，`baselines` 节逐字节相等**，重编码噪声（`\u2014`/`\u00a7`）消除；还原后矩阵 41/41 复证（W-2，见 I2-7） | ✓ 闭合 |
| SA4-6（备案） | SA8 impl §2(b) 已 RATIFY「title 直读」；无动作面 | ✓ 已裁定 |

## I2-7. 不得回退面（dispatch 项 5）

| 面 | 本轮核验 | 判定 |
|---|---|---|
| 其余 8 文件零改动 | mtime：`run-baseline.mjs` 03:42:59、7 新测试文件 03:15–03:51（均早于 iter-2 起点 04:19 评审/04:30 首个改动）；iter-0 行号锚点抽查（`LIFECYCLE_UNITS:103–115`、`:591–597`、`:906`）原样；git status 形状与 iter-0 终态一致（3M+7??，G3/G12 实跑列出同款文件集） | ✓ |
| 生产 src 零 diff | 本会话 `git diff --name-only d59a4d1 -- 'packages/*/src' 'apps/*/src' 'domains/*/src'` = 0 文件；复跑 G2/G3/G4 PASS | ✓ |
| T-2 允许清单/G11/G12/扫描面/N-6 钉死内容 | `G10_LINE_ALLOW`（5 行级）/`G10_FILE_ALLOW`（2）/`FORBIDDEN_API_ALLOW`（空）/`FACILITY_ALLOW`（4）原样；`listScanRoots`/`listSrcRoots` 未触；G11 空集、G12 PASS；N-6 重取日志三形态逐字（`n6-g10-injection.ts:2–4` M1/M3/M1 可选链） | ✓ |
| 矩阵 41/41、units 23×3、并集 69 | 归档 `matrix.json`（generatedAt `2026-11-14T20:41:11Z` = 本地 04:41:11，**晚于** gates.mjs 04:34/baselines.json 04:30 终态 ⇒ 证据对终态新鲜）：41 cells/41 pass、三基线 `observed=23 coverage=true foreign=0`、gates cell pass、root-test `failedUnexpected=[] failed=32`；`unit-union.json` union=**69**（rule 注明 23×3）。**沿用依据**：矩阵输入（runner、测试文件、baselines.json 语义）自 W-2 起零变化（本节各行核证）+ gates cell 面由本会话复跑 12/12 直接复证 | ✓（归档 + 复跑锚定） |
| N-1/N-2/M-1/M-2 + 6 次逐字节还原 | 归档证据在盘：`N1-N2-faults.log`（03:44）、`mutations.json` 六条 `restores[]`（三基线 × M-1/M-2，`sameAsPristine=true ∧ sameAsHead=true`，bytes 39033）。**沿用依据**：其对象（生产 src、`run-baseline.mjs`、channel 测试与 helper）自 iter-1 终态起字节未变（mtime + git status + 锚点）， faults/变异只依赖这些未变面 ⇒ 证据仍有效；N-6 已按 SA8 要求以终版 gates 重取（I2-4） | ✓ 沿用成立 |

## I2-8. Non-blocking observations（iter-2 新增 MINOR）

1. **SA4-7（MINOR）M4 跨行 argumentStart 的注释盲区**：`previousNonSpace`（gates.mjs:471–474）不感知注释。复现形：`Reflect.get(\n  ctx,\n  // note\n  'root',\n)` —— `'root'` 前一非空白字符是注释尾字 ⇒ `argumentStart=false`（`:493`）⇒ 非候选静默丢弃（ enclosing callLike 仍在栈上）。该形同时满足 SA8 §8-1(a) 字面「行首实参续行形」（行首 token + 后随 `,`）。影响：BASE 零实存（记录逐字节不变间接证明无此类形态被改判）、需刻意排版才会出现，通道远窄于已闭合的 SA4-1 主通道；**不阻断**。建议后续加固：`previousNonSpace` 跳过注释 span，或把 §8-1(a) 的行首形作为 callLike 前提下的 OR 判据。
2. **SA4-8（MINOR）行级词法器的残余角落**：正则字面量含未配对 `)`（如 `bar(/)/)`）会 pop 真实栈帧、嵌套模板字面量会提前闭合 backtick 状态——两者均可使跨行归属失效（方向：误 5D-C/丢弃）。与 iter-1 已追认的 `commentSpan`/`insideString` 同一类行级局限，非本轮回归；列入动态验证项。
3. **SA4-9（nano）**：impl §9.2(g)/W-6 称 baselines.json diff「3 hunk」，实为 **1 hunk 含 3 处编辑**（+9/−3 本身无误）；探针族未覆盖「被调链自身跨 `(` 断行」形（`Reflect.get\n(ctx,'root')`，与已测形同一代码路径）。均为文书/覆盖面 nits。

## I2-9. 后续动态验证项（iter-2 更新）

| 风险 | Driver | Expected observation | Failure condition |
|---|---|---|---|
| SA4-7 注释盲区 | 以 4 行注入样本（含 `// note` 行）跑 gates | 类 6 红（加固后）/ 当前为静默不红（已知残余） | 加固后仍不红 |
| SA4-8 词法角落 | 含未配对 `)` 正则/嵌套模板的样本 | 归属不因角落漂移到 5D-C 之外 | 出现静默丢弃且无 UNRESOLVED 兜底 |
| G10 对未来跨行回归的真实拦截 | CI/本地 gates 于新提交 | 任何跨行 `Reflect.get(…,'root')` 新增即 cat_6>0 红 | 计数漂移无解释 |
| （iter-0 遗留）环境红对齐窗口、N-1/N-2 seam 演进红性 | 见 §11 | 同 iter-0 | 同 iter-0 |

## I2-10. 结论（iter-2）

iter-0 阻断面（G10 M4 跨行 fail-closed 缺位且被自述掩盖）已按 SA8 §8-1 的机械验收闭合：**跨行实参归属 + 空链 fail-closed 落地、同被调行判定保留、BASE 285 条对账逐项零漂移（本会话独立复跑+分桶）、289 条记录修前后逐字节相同（零迁移）、真实注入×2 + 变异×2 自证伪、注入零残留、报告自述已更正**；同文件三点（inVctx/16 行自检/表序）与 4 项 MINOR 逐一闭合或可接受；其余 8 文件零改动、零生产 diff、矩阵/units/并集/负控/还原证据链全部成立（归档证据对终态新鲜或按未变输入沿用）。新增 3 项 MINOR（SA4-7/8/9）均为残余角落与文书 nit，不构成阻断。

**verdict = approve**；`requiresConflictRecheck = false`（本轮未触碰新 ADR 面；SA8 §8-1 验收逐条满足；R2 行 2/3「代码位」限定与 SA4-6 title 口径已在 SA8 已追认计数包络内，如 Controller 需要可作例行备案，不构成冲突面）。
