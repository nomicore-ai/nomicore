# SA7 动态验证报告 — issue #389：复制来源与订阅终止（变更订阅 T3）

- 验证轮：2026-09-15（iteration 0；dispatch `sa-25bbf904-12ba-4514-af78-b0221d96deb2`，phase = final-verification）
- 被验对象：SA3 交付切片（tracked 修改恰 4 个 runtime 源文件 + 契约 2 件）；SA4 verdict =
  **approve**（本报告在其基础上独立动态验证，未发现下调事实）
- 验证域（dispatch 点名）：复制来源 origin、schema 变更两条终止路径、doc 替换（reset）、
  FIFO 终止序、终止后重建（resubscription）——数据流 + 生命周期/状态机动态行为
- 结论速览：**verdict = approve**。三条变更路线（L1 本地 schema / L2 peer re-arm /
  L3 doc-replaced reset）按设计运行；声明不变的全部路线保持不变；订阅状态机与关闭
  admission 状态机转换及关键值正确、禁止转换未出现；错误与清理路径符合设计；
  零临时日志添加（无需——全部关键跳点经 sink / lease 公共面 / 返回结果 / stub 计数可观察）。

---

## 1. Inputs（固定输入，全部实读）

| 输入 | 状态 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-389.md`（Host brief；issue 评论 **0 条**——dispatch 明示 REST 实读空数组，无 owner 要求） | 在场 | 需求源 AC1–AC7 |
| `wiki/raw/task_issue-389_design.md`（SA1 iteration 1） | 在场 | 变更/保持路线权威（§8 数据流 L1–L3、§7-D1–D6、§5 冻结位、§9 错误/并发、§12 验收映射） |
| `wiki/raw/task_issue-389_sa6_contract.md` | 在场 | 契约 C1–C11 / NC1–NC6 / B-T3-0–6 / §12.5 断言纪律 / §12.6 红线 |
| `wiki/raw/task_issue-389_sa3_impl.md` | 在场 | 交付自述与验证证据索引 |
| `wiki/raw/task_issue-389_sa4_review.md`（approve） | 在场 | §11「后续动态验证项」（本报告 §8 矩阵的 Source）+ §12-N-O3 覆盖缺口 |
| `wiki/raw/task_issue-389_relevant_decisions.md` / `..._conflict_report.md` / `..._implementation_conflict_report.md` | 在场 | 协议边界识别（ADR 0030 §4–§7、ADR 0018、ADR 0010 #133 冻结次序） |
| 实现本体：`packages/namespace-runtime/src/{watch-map,runtime,schema-write,replication-session}.ts` diff | 实读 | 跳点核对（S5.6 / R5.7 / closeAfterFenceNormal/Reset / terminateAll / 泵 finally drain / unsubscribe 豁免） |
| 契约装置：`issue-389-change-subscription-t3-fixture.ts` + `...termination-red.test.ts` | 实读 + 实跑 | 既有驱动面（SA7 优先使用既有测试） |

SA8 相关决议仅用于识别不可改变的协议边界（reason 词表封闭两值、通知不出进程、
registry 零改动、ADR 0010 #133 reset 冻结次序）——全部在动态观察中作为不变量核对。

## 2. Runtime environment

| 项 | 值 |
|---|---|
| Worktree / branch / HEAD | `/home/wangjian/nomicore-fix-issue-389`；`mabf/issue-389`；`28faeae7a0c619e1352f05d19a83ba46e562879c` |
| 运行时 | Linux；node `v24.13.0`；pnpm `10.28.2`；vitest `3.2.7`（`artifacts/sa7-issue389-env.log`） |
| 依赖 | `node_modules` 在场（SA6 轮 `pnpm install --offline --frozen-lockfile` 复原；本轮零安装） |
| 被验实现 | tracked diff 恰 4 文件（+144/−16，与 SA3/SA4 记录一致）；SA7 零生产代码改动 |
| 驱动形态 | 既有契约 + 回归门一次性 vitest 前台命令 + **1 个 SA7 补充动态测试文件**（7 场景，复用交付 fixture；skill 允许的最小新增，见 §7/§10） |
| 服务/后台 | 零服务、零后台 job、零网络、零墙钟（全微任务/expect.poll 屏障驱动） |

## 3. Changed Data Flow Verification

| Route | Design change | Runtime driver | Observed hops | Expected result | Actual result | Verdict |
|---|---|---|---|---|---|---|
| L1 schema-changed（Hub 本地 `replaceSchema`） | S5 事务 data 入队 → S5.5 `installed` → **S5.6 `terminateAll('schema-changed')` 队尾追加**（S6 前）→ 槽外泵投递；`void` fire-and-forget | 契约 C3/C6/C8/CAP/C9/C11 复跑 + SA7 D-S4（连续 3 次 replaceSchema）/ D-S3a（throw 隔离） | `replaceSchema ok` → `getSchema().text` 切 V2（oracle）→ 流 `[data…, {kind:'watch-end',reason:'schema-changed'}]`（恰两键）→ lease 仍 `active` → 终止后写零新通知 → 重建订阅按 V2 投递 | 流末条 schema-changed；滞留 data 必达（C8: `['t3','t4','t5']` 全先达）；溢出降级 `invalidate-all` 后终止项仍末条（CAP）；逐代恰一条终止 | 17/17 全绿（C3 流 `[data,watch-end]`；C8 三断言绿；CAP invalidate-all ≥1 且末条 watch-end；D-S4 三次变更后第一代 sink 恒 1 条 watch-end、重建 sink 恰 1 条、再重建后 data 正常投递） | ✅ |
| L2 schema-changed（Peer 复制 apply 槽 re-arm，ADR 0018） | R5 apply 事务（origin=per-session symbol）data 入队 → R5.6 `text` 变化门 → re-arm 结局（applied/**failed 均**，B-T3-2）+ diag 配对 → **R5.7 `terminateAll('schema-changed')` 队尾追加**（R6 前） | 契约 C4（applied + 指纹双侧一致 oracle）/ C4b（fatal INVALID）+ **SA7 D-S1：单笔混合 update（SCHEMA text=V2 + ROOT tasks 新键 t9 同一 update）** | peer apply → `{ok:true, schemaRearm:{kind:'applied'}}` → 流 `[data(origin='replication',t9), watch-end]` → 终止后 V2 下写 t10 → 旧 sink 零僵尸通知 | 同一 update 的 data 与终止项同槽 FIFO：data 先达、watch-end 末条（SA4 §11-1 点名的缺口场景）；failed 分支终止项照发且 apply 仍 ok | D-S1 绿：kinds 恰 `['data','watch-end']`、data 逐字 `{origin:'replication',changes:[{path:['tasks'],key:'t9'}]}`、终止后 `received.length` 恒 2；C4 流 `[data(local),watch-end]`；C4b `schemaRearm.kind='failed'` 且末条 schema-changed | ✅ |
| L3 doc-replaced（reset） | fence 槽（双源核验 + 同步 arm closing）→ `closeAfterFenceReset`：**共享首步 `fanout.terminateAll('runtime-close')`** → `watchHub.terminateAll('doc-replaced')` 同步入队+注销 → `lazyCloseBarrier()` → admission = barrier ∧ **全部终止项已投递**（`await delivered`）→ 防御 `shutdown()` 后置；registry 零改动（force-release → await closePromise → archive） | 契约 C5/C10 复跑 + SA7 D-S2（2 lease × 3 sink 含零 data 的 ghost 订阅）/ D-S3b（坏消费者 throw 下 reset 结算） | `resetReplica ok` + `archiveCalls=1` → **结算时（免 poll）** 各 sink 流末条 `{kind:'watch-end',reason:'doc-replaced'}` → 全部 lease `released` → `unsubscribe` ×2 no-op → 重新 open + 新订阅零终止信号（C10） | reset 结算即已投递（B-T3-3 冻结机制，强于「最终送达」）；force-release 清理对 terminated 为 no-op（队列保全） | D-S2 绿：sinkTasks `[data,watch-end]` / sinkGhost 恰 `[watch-end]` / sinkSecondLease `[data,watch-end]`，双 lease released，×2 退订零新增；D-S3b 绿：坏 sink 在自己的 doc-replaced 投递上 throw，reset 结算仍含其 drain（`bad.received=[data,watch-end]`）；C5/C10 绿 | ✅ |

设计标记的关键中间跳点（S5.6 / R5.7 入队时机、共享 fanout 首步、投递结算并入 close
承诺、force-release no-op）全部有运行时证据，非仅最终返回值。

## 4. Preserved Data Flow Verification

| Route | Preserved invariant | Runtime driver | Baseline observation | Current observation | Verdict |
|---|---|---|---|---|---|
| P1 origin 分类与零过滤（AC1/ADR 0030 §5） | 本地写恒 `origin:'local'`；复制 apply 恒 `'replication'`；同流 FIFO；数据面零 watch-end | 契约 C1/C2 + NC3 补充复跑 + D-S1 | SA6 探针 1：`["local","replication"]`（HEAD `28faeae`） | 同值复现：origin 逐字、`['data','data']` FIFO、`watchEnds()==[]`；混合 update 的 data 亦 `'replication'` | ✅ |
| P2 非 terminated 退订语义（T1 L1 冻结：清队 + 摘除；lease 释放清理） | 退订后在途投递停止；lease release 自动清理订阅 | #387 契约 21/21 复跑（L1/L2 锚） | #387 21/21（SA6 基线） | 21/21（`artifacts/sa7-issue389-regression-gates.log`） | ✅ |
| P3 溢出降级语义（`invalidate-all`）+ 终止项容量豁免 | 溢出清队只发生在 data 入队路径；终止项恒入队且为末条（B-T3-4） | 契约 CAP（64 笔快连）复跑 | SA3 V2 17/17（含 CAP） | CAP 绿：invalidate-all ≥1 且 watch-end 恒末条 | ✅ |
| P4 正常 close 风味静默（§15-5：delete/idle/shutdown ≠ 终结三因） | 正常风味 = 共享 fanout 首步 + 静默 `watchHub.shutdown()`，零 watch-end | **SA7 D-S6（deleteNamespace + 活 lease/活订阅）** + round2 25/25（共享首步 R2-2）+ phase5 7/7（close admission/同承诺） | SA6 探针 4 / 设计 §3.3（HEAD 静默行为） | D-S6 绿：delete ok（deleteDoc 1 次）、`watchEnds==[]`、已投递流保持 `['data']` 无新通知、lease released；round2/phase5 复跑绿 | ✅ |
| P5 读面冻结（readData 四键） | 零读面改动（ADR 0027/0028，NC2） | 契约 C11（`expectReadDataOkKeys`）+ #369 契约 33/33 复跑 | SA6 基线 33/33 | C11 绿 + 33/33 复跑绿 | ✅ |
| P6 registry reset 槽冻结次序与 mismatch 零破坏（ADR 0010 #133；设计 §9） | fence → closing → 唯一 barrier → archive 零破坏；mismatch/missing 零终止、订阅照旧存活 | **SA7 D-S5（错误身份 reset → 更正 reset）** + phase5 族 7/7 | phase5 契约族 HEAD 绿 | D-S5 绿：mismatch 显式 `NAMESPACE_RESET_IDENTITY_MISMATCH`、零 watch-end、lease `active`、`archiveCalls=0`、后续写照常投递（`['t3','t4']`）；更正 reset 后 `[data,data,watch-end]` 末条 doc-replaced | ✅ |
| P7 公共面零新增（AC7：lease 16 键 / runtime 15 键 / kind ⊆ 三 kind 闭集） | 键集与通知闭集冻结 | 契约 C11 复跑 + `tsc -p tsconfig.typecheck.json --noEmit`（含 SA7 新文件） | SA3 V5 exit 0 | C11 绿；typecheck exit 0（`artifacts/sa7-issue389-test-typecheck.log`） | ✅ |

## 5. State Machine Verification

### 5.1 订阅状态机（每订阅）

| Initial state | Trigger | Expected transitions | Observed transitions | Forbidden transitions absent | Verdict |
|---|---|---|---|---|---|
| 活跃 | `unsubscribe()`（非 terminated） | → 已退订：清队 + 摘除、此后静默（T1 冻结） | #387 契约 21/21（L1 锚）复跑绿 | — | ✅ |
| 活跃 | `terminateAll(reason)`（槽内同步段） | → terminated：队尾追加终止项 + 摘除（零入队点）→ 泵排空 → 静默终态（drain resolve） | C3/C5/D-S1/D-S2/D-S4：流末条后零新通知；D-S3b drain 在 throw 下照常 resolve（reset 结算达成） | 终止后再入队 data/invalidate-all（C6、D-S1 终止后写、D-S4 后续变更）——未出现 | ✅ |
| terminated | `unsubscribe()`（含 lease force-release 清理路径经句柄） | 幂等 no-op：不清队、零副作用；终止项照常投递 | C7（×2 零 throw 零通知）、D-S2（×2 + 三 sink 恒 1 条）、D-S4（旧句柄 no-op） | 退订清队吞掉终止项/滞留 data（M3 变异红面即此）——未出现 | ✅ |
| terminated | 消费方重新 `watchMap`（AC6 resubscription） | 新订阅独立对象/独立泵；schema 路径 lease 仍 active、按新 schema 建立；doc 路径 lease released（`NamespaceLeaseReleasedError`）→ 重新 open 后新订阅零终止信号 | C9（重建 + V2 投递 + 旧句柄静默）、C10（released 通道 + re-open + 新订阅 `watchEnds==[]`）、D-S4（逐代重建各恰一条） | 旧订阅复活 / 新订阅继承旧流——未出现 | ✅ |
| 活跃 | 数据缺席 / 容器删除（NC5） | 不终结（终止只与 lease 和 schema 耦合） | NC5 复跑绿：ghost/optionalTasks 订阅零终止、重建后定位符照达 | 删除触发 watch-end——未出现 | ✅ |
| 活跃 | schema 写 S3/S4 领域拒绝（NC6） | 零事务零通知零终止 | NC6 复跑绿（`['data']` 恰一条） | 拒绝写发 watch-end——未出现 | ✅ |

### 5.2 关闭 admission 状态机（runtime 层）

| Initial state | Trigger | Expected transitions | Observed transitions | Forbidden transitions absent | Verdict |
|---|---|---|---|---|---|
| ready | 公共 `close()`（idle/delete/shutdown 消费点） | 正常风味：fanout 终止（同步）→ 静默 `watchHub.shutdown()` → barrier；close 同步停接纳/终止 sessions/幂等 | round2 25/25（R2-2 族：close 同步终止 session、终态 throw、同实例幂等）+ D-S6（delete 路径静默收口） | 普通 close 产出 watch-end / 漏 fanout 首步——未出现 | ✅ |
| ready → armed（fence 槽双源核验通过，同步 arm closing） | `startCloseAfterFence()` | reset 风味：fanout 首步 → `terminateAll('doc-replaced')` → barrier ∧ delivered → shutdown；缓存完整 admission 承诺 | C5/D-S2/D-S3b（结算即已投递）+ phase5 7/7（T2 双向 same-promise：`startP===closeP`/`closeP===startP`） | 第二 barrier / admission 重跑 / reset 结算早于投递——未出现 | ✅ |
| armed 前置 | mismatch/missing（fence 槽核验失败） | 零破坏期拒绝，lifecycle 保持 ready、订阅照旧存活 | D-S5：mismatch 后 lease active、数据照常投递、随后正确 reset 成功 | 零破坏期发终止/降级为伪成功——未出现 | ✅ |

### 5.3 `terminateAll` 幂等与逐代语义（设计 §7-D1-4；SA4 N-O3-④）

连续 3 次 `replaceSchema`（同文本——本地路径无 text 门，设计 §7-D3 N-3）：第一代订阅恰
1 条终止项（第二次调用作用于空集合，零重复）；重建后的新订阅在第三次变更时恰得 1 条；
旧订阅流不再变化；再重建订阅在新 schema 下正常收 data（D-S4 全绿）。

## 6. Error and Cleanup Flow

- **错误分类不伪成功**：reset 身份不符 → 显式 `NAMESPACE_RESET_IDENTITY_MISMATCH`（D-S5），
  零归档、零终止、零 lease 破坏；随后正确 reset 成功——失败面与成功面互不污染。
- **listener throw 隔离（X1 延伸到终止项）**：坏消费者在 data 与 watch-end 投递上均 throw
  ——好消费者收齐全部、`mutateData`/`replaceSchema`/`resetReplica` 结果均 ok、坏消费者自身
  投递序列不被 throw 中断（`[data,watch-end]` 均达）、drain 照常 resolve（reset 结算免 poll
  达成，即 throw 不悬挂结算）（D-S3a/D-S3b）。
- **清理到达 quiescence**：终止后旧订阅在「后续写 + 微任务双预算 400 ×2」下零新增通知
  （C6/D-S1/D-S4——已注销 = 零入队点的结构性静默）；deleteNamespace 静默清场后已投递流
  保持、无复活（D-S6）。
- **重入安全**：终止投递期间/之后的重建（listener 外重新 `watchMap`）——独立订阅对象，
  新流只含自己的 data、零终止信号（C9/C10/D-S4）。
- **不复活旧路径**：终止不可逆；重建是唯一恢复路径且走全新订阅（AC6）——D-S4 中第一代
  sink 在后续两次 schema 变更与重建后流恒定不变。

## 7. Temporary Diagnostics

- **添加的 `[SA7-DATAFLOW]` 临时日志：0。** 全部关键跳点与状态转换经既有/新增测试的 sink
  数组、lease/registry 公共面返回值、oracle（`schemaRearm.kind`/指纹/`getSchema().text`）、
  stub 计数（`archiveCalls`/`deleteCalls`/`importCalls`）观察，未达添加临时日志的必要条件。
- **新增持久产物（非临时诊断）**：`packages/namespace-registry/test/issue-389-sa7-dynamic-verification.test.ts`
  （7 场景，复用交付 fixture，零生产代码改动）——dynamic-verify skill 允许的最小补充测试，
  承载 SA4 §11 移交的观察缺口；建议后续并入契约加固（见 §10 Deviations/§8 routing）。
- **残留检查**：`git diff HEAD | grep -c SA7-DATAFLOW` = **0**；`grep -rn SA7-DATAFLOW packages/`
  = **0**（wiki/raw 命中均为其他票历史报告的既有文本）；tracked 改动集合仍恰为 SA3 的
  4 个源文件（SA7 零实现改动）。
- **Post-removal 等价验证**：本报告全部证据本就在零日志注入状态下取得；关键场景双跑
  （SA7 场景 7/7 ×2 次，`artifacts/sa7-issue389-dynamic-scenarios{,-rerun}.log`）结果一致、
  契约 + SA7 合跑 24/24——无诊断依赖、无 flake。

## 8. Dynamic Evidence Matrix

| Source | Requirement or risk | Driver | Expected | Actual | Evidence | Result | Suggested routing |
|---|---|---|---|---|---|---|---|
| SA4 §11-1 | peer 单笔混合 update（schema+ROOT data）的滞留 data FIFO——data 在 R5 入队、终止在 R5.7 队尾 | SA7 D-S1 | `[data(replication), watch-end]`；终止后零通知 | 恰如此（data 逐字 origin='replication'/key t9；末条 schema-changed；终止后写零僵尸） | `artifacts/sa7-issue389-dynamic-scenarios.log` | ✅ | 契约加固轮可将 D-S1 收编为正式用例（对应 SA4 N-O3-②） |
| SA4 §11-2 | reset 多订阅/多 lease 的投递结算（drain=Promise.all 并发泵） | SA7 D-S2 | 每个 reset 前存活 sink 结算时已收末条 doc-replaced（免 poll）；lease 全 released | 2 lease × 3 sink（含零 data 的 ghost 订阅）全部结算即已投递；双 lease released | 同上 | ✅ | 对应 SA4 N-O3-①；建议并入 T4 #390 或契约加固轮 |
| SA4 §11-3 | watch-end 投递的 listener throw 隔离与 drain 结算（X1） | SA7 D-S3a/D-S3b | 坏消费者 throw 不影响好消费者/写结果/drain；reset 结算仍含坏消费者投递 | 全部达成（含 reset 结算时 `bad.received=[data,watch-end]`） | 同上 | ✅ | 对应 SA4 N-O3-③ |
| SA4 §11-4 | CAP/全仓在 CI 调度下的稳定性 | —（SA7 不等待 PR CI、不读远端 CI 日志、不运行全仓回归） | — | 本地双跑零 flake；全仓 4770 绿为 SA3 V10 在案记录 | `artifacts/sa7-issue389-dynamic-scenarios{,-rerun}.log` | 不适用（范围外，如实登记） | CI 观察归 Host/总控 |
| SA4 §11-5 | `closeAfterFenceReset` 早退风味在真实 registry 编排下带活订阅不可达 | phase5 族 7/7（T2 双向 same-promise）复跑 + D-S2（真实 reset 编排） | same-promise 绿、无 silent-watch-loss | 7/7 绿；D-S2 全量终止项送达 | `artifacts/sa7-issue389-regression-gates.log` | ✅ | — |
| SA4 N-O3-④ | `terminateAll` 连续两次幂等无直接断言 | SA7 D-S4 | 已终止订阅零重复终止项；重建订阅各恰一条 | 三次变更逐代恰一条；重建后 data 正常 | `artifacts/sa7-issue389-dynamic-scenarios.log` | ✅ | 契约加固轮 |
| Design §9 | reset mismatch/missing 零破坏期（订阅照旧存活、零终止） | SA7 D-S5 | 显式 mismatch issue、零终止、数据照投、更正 reset 成功 | 逐项达成 | 同上 | ✅ | — |
| Design §5-§15-5 | deleteNamespace/lease 释放/shutdown 不发 watch-end（正常 close 风味静默） | SA7 D-S6（delete 动态驱动）+ #387 21/21（lease 释放清理）+ round2 25/25（共享首步） | 零 watch-end、静默清场、lease released | 逐项达成 | 同上 + `artifacts/sa7-issue389-regression-gates.log` | ✅ | registry.shutdown 直驱路径未单独驱动（与 delete 共用 `closeAfterFenceNormal`，见 §10） |
| SA6 §12.2 C1–C11 | 交付契约全量（AC1–AC7 + NC3/NC5/NC6 + CAP + 装置自检） | 契约复跑 | 17/17 绿 | 17/17 绿（exit 0） | `artifacts/sa7-issue389-contract-rerun.log` | ✅ | — |
| Design §12 回归锚 | #387 21 / #369 33 / phase5 fence 7 / round2 25（F-1/R2-2/键集/NC1/NC2） | 回归门复跑 | 86/86 绿 | 86/86 绿（exit 0） | `artifacts/sa7-issue389-regression-gates.log` | ✅ | — |
| SA6 §12.6 红线 | 键集 16/15、readData 四键、通知闭集、测试程序类型面 | C11 + `tsc -p tsconfig.typecheck.json --noEmit`（含 SA7 文件） | 全绿 / exit 0 | 全绿 / exit 0 | `artifacts/sa7-issue389-test-typecheck.log` | ✅ | — |

## 9. Commands and Evidence

| # | 命令 | 结果 | 日志 |
|---|---|---|---|
| 1 | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/namespace-registry/test/issue-389-change-subscription-termination-red.test.ts --typecheck.enabled=false` | **exit 0；17/17 绿**（交付契约复现） | `artifacts/sa7-issue389-contract-rerun.log`（合跑版含命令 2） |
| 2 | 同款 + `issue-389-sa7-dynamic-verification.test.ts` | **exit 0；24/24 绿**（契约 17 + SA7 场景 7） | `artifacts/sa7-issue389-contract-rerun.log` |
| 3 | SA7 场景单跑（首跑 / 复跑） | **7/7 ×2，exit 0，零 flake** | `artifacts/sa7-issue389-dynamic-scenarios.log`、`...-rerun.log` |
| 4 | 回归门：issue-387 + issue-369 + runtime-phase5-reset-fence-r2 + runtime-replication-session-round2 | **exit 0；86/86**（21+33+7+25） | `artifacts/sa7-issue389-regression-gates.log` |
| 5 | `npx tsc -p tsconfig.typecheck.json --noEmit`（测试程序，含 SA7 新文件） | **exit 0** | `artifacts/sa7-issue389-test-typecheck.log` |
| 6 | `git diff HEAD | grep -c SA7-DATAFLOW`；`grep -rn SA7-DATAFLOW packages/`；`git status --porcelain` | **0 / 0**；tracked 恰 SA3 的 4 文件，SA7 增量 = 1 测试文件 + 6 日志 + 本报告 | 会话实录（§7） |
| 7 | 环境事实采集 | node v24.13.0 / pnpm 10.28.2 / vitest 3.2.7 / HEAD `28faeae` | `artifacts/sa7-issue389-env.log` |

## 10. Deviations

1. **SA7 补充测试文件（新增 1 件，7 场景）**：SA4 §11 明确将 peer 混合 update FIFO、
   多订阅/多 lease reset 结算、终止项 throw 隔离列为「活链路验收（SA7 域）」且交付契约
   未覆盖（SA4 §12-N-O3）——按 dynamic-verify skill「观察数据流所必需的最小动态测试」
   新增；零生产代码改动、复用交付 fixture、断言纪律沿 SA6 §12.5。非偏差性越权：不替
   SA6 写验收契约（不改契约文件/断言），建议总控在收尾切片决定保留或将其场景收编进
   契约加固票（T4 #390 / 专用轮）。
2. **registry.shutdown 直驱未单独驱动**：§15-5 的三条正常关闭路径（idle/delete/shutdown）
   共用同一 `closeAfterFenceNormal` admission；本轮动态直驱 deleteNamespace（D-S6）+
   共享首步/同承诺回归族（round2 25/25 + phase5 7/7）；idle 路径的订阅清理经 #387 契约
   L2 锚覆盖。结构性同路，未逐一复驱——如实登记，非阻塞。
3. **全仓 `pnpm test` / CI 未运行**：SA7 不运行全仓回归、不等待 PR CI（skill 边界）；
   SA3 V10（4770 绿）与 SA4 抽检在案，本轮以设计点名契约 + 回归门（86/86 + 24/24）为证。
4. **SA4 N-O1（stale typecheck 日志）**：本轮以最终树重捕等价证据
   （`artifacts/sa7-issue389-test-typecheck.log`，exit 0）——原 stale 日志属 SA3 产物，
   SA7 不代为改写，仅提供在案反证。
5. 无其它偏差：实现/设计/契约零改动；未发现任何需要 SA4 复核的设计冲突新事实
   （`requiresConflictRecheck` 不提交）。

## 11. Verdict

**approve** —— dispatch 点名的五个验证域全部取得活链路证据：

1. **复制来源**：本地写 `origin:'local'`、复制 apply `origin:'replication'`（含混合 update
   的 ROOT 变更），同流 FIFO、零过滤（C1/C2/NC3/D-S1）；
2. **schema 变更终止两路径**：本地 S5.6 与 peer R5.7（applied/failed 均）产出流末条
   `{kind:'watch-end',reason:'schema-changed'}` 恰两键（C3/C4/C4b/D-S1/D-S4/D-S3a）；
3. **doc 替换**：reset 关闭 admission 的终止编排 + 投递结算并入 close 承诺——多 lease/
   多订阅在 `resetReplica` 结算时已全部收到末条 `doc-replaced`（免 poll），lease released、
   重建经 released 通道 + 重新 open（C5/C10/D-S2/D-S3b/D-S5）;
4. **FIFO 终止序**：滞留 data（本地多笔快连、peer 单笔混合 update）全部先于 watch-end
   到达、终止项恒末条、终止后零僵尸通知、容量豁免成立（C8/CAP/D-S1）；
5. **重建**：schema 路径 lease 仍 active + 重新 `watchMap` 按新 schema 投递；doc 路径
   released 通道 + 重新 open 后新订阅零终止信号；订阅生命周期只与 lease 和 schema 耦合
   （C9/C10/D-S4）。

声明保持的路线（origin 分类、退订清队、溢出降级、正常 close 静默、读面、reset 冻结
次序、公共键集）全部不变；状态机合法顺序与关键值正确、禁止转换（终止后入队、重复终止、
删除/释放/关闭发终止、零破坏期终止、退订清队吞终止项）均未出现；错误路径不伪成功、
throw 全隔离、清理到达 quiescence。SA4 approve 维持，SA7 独立动态验证未发现任何 fail
事实。临时诊断零添加、零残留；SA7 增量 = 1 个补充测试文件 + 6 份证据日志 + 本报告。
