# SA6 诊断与验收契约 — Issue #393

**标题**：FileDiagnosticLog 在 registry 接缝静默半工作——自然组合零 runtime 记录（segments 无
`root-mutation` 根因）

- 仓库：`welltop-jim-wang/nomicore`；worktree：`/home/wangjian/nomicore-fix-issue-393`
- HEAD：`dcb37669e209b1aa7d50abefa208530213f147e2`（`docs(integration): … (#378)`，2026-09-14 13:09:23 +0800）
- 任务类型：**Bug**（复现 → 根因证明 → 红灯验收契约；不改生产实现）
- 日期：2026-09-14
- Verdict：**approve**（可稳定复现、根因经差分实验定位、契约双向可翻转、测试入口真实）

---

## 1. Task type and inputs

| 输入 | 位置 | 状态 |
|---|---|---|
| Host-owned task brief（issue 正文 + comment 5664521867 维护者裁决 + P0/P1/P2 + AC） | `wiki/raw/task_issue-393.md` | 存在（本次 dispatch 前为未跟踪文件） |
| `task_issue-393_relevant_decisions.md` | `wiki/raw/` | **不存在**（固定输入缺失；以 issue 正文/裁决、ADR、源码与既有测试替代，不阻塞） |
| `task_issue-393_conflict_report.md` | `wiki/raw/` | **不存在**（同上） |
| 上游证据（适用） | `wiki/raw/20260905-bug-issue-226.md`（#226 泵路径/无归属通道缺陷链与修复）、`wiki/raw/task_249_design.md`（泵丢弃上报）、`wiki/raw/task_diagnostic-log-file-adapter-r2_*.md`（File adapter 冻结面） | 已读；用于 seam 冻结面与 legacy 语义核对 |
| 治理文档 | ADR 0011、ADR 0014-LOG、`packages/namespace-registry/AGENTS.md`、`packages/namespace-diagnostic-log/AGENTS.md`、根 `CONTEXT.md` | 已读 |

本次为 issue #393 的 SA6 首轮（iteration 0），此前无 SA6 报告；工作区中 issue 备注提到的差分
harness `packages/namespace-registry/test/zz-ndcl-empty-segments-repro.test.ts` **在本 worktree
中不存在**（未被携带），由本轮最小夹具重新建立并已转正/清理（§16）。

## 2. Owner comment mapping

维护者 comment **5664521867**（2026-09-14T13:12:42Z）与 issue 正文的裁决逐条落地到契约：

| Owner 裁决 | 本契约落地 |
|---|---|
| 自然组合（`createFileDiagnosticLog(...)` 产物直传 `diagnosticLog`）必须直接工作；不工作 = 产品 bug，非配置错误 | 契约主载体 = **raw log 对象直传**的端到端用例（R1/R2/R3/R4），不使用「正确 manager binding」当主路径；G4 是隔离证明而非契约目标 |
| P0 = `FileDiagnosticLog` 自绑定：增 `runtimeEmitterFor(namespaceId) = ns === this.namespaceId ? emitter : undefined`；registry 探测逻辑零改动 | R0（identity/undefined 语义）+ R1/R2（端到端落盘）+ NDCL 包内 R1–R3（适配器边界）+ 类型面 `.test-d.ts`；测试不触碰 registry 既有探测成员名 |
| 不加 `initStream`（泵路径缺席成员已有 no-op；stream 构造期已 eager 建立，resume 照常） | G3（`initStream` 缺席守卫）+ NDCL R3（resume 路径自绑定） |
| 无归属公共入口拒绝（namespaceId 生成前的 create 拒绝）经共享 emitter 落该流——须显式定案并写入契约测试 | **R4 + §12.3 显式定案（接受落盘）** |
| 原「类型收紧 fail-fast」作废 | 契约不含任何 fail-fast/类型拒绝断言；裸 `{emitter}` 弱化为文档陷阱（P2） |
| 「legacy 观测事件」弱化（`diag-pump-drop` 管道缺口独立处理） | 不在本契约范围；仅保留 legacy 行为零漂移守卫（G2） |
| P1 = `@nomicore/yjs-server` 导出泛化 manager；app 内部消费同一导出 | P1-R1…R4（公共入口导出 + `{onEvent, now}` 泛化面 + 多 ns 路由 + 丢弃语义） |
| P2 = `cordis-host.md` 诊断日志配置节 + `SKILL.md` 路由；单 ns 直传 / 多 ns manager / 裸 `{emitter}` 陷阱 / Hub·Peer 示例 | P2-R1/R2（文档交付物契约） |
| AC：`namespace-diagnostic-log` 版本 bump（公共面变化）；根 typecheck + 相关包测试全绿 | §12.5 完成门禁（版本 bump 属发布评审门，不作测试断言） |

## 3. SA8 constraints

- 固定位置**无** `task_issue-393_sa8_review.md` / `_relevant_decisions.md` / `_conflict_report.md`
  （本 dispatch 未携带 SA8 产物）。适用的冻结约束改由以下已读上游文本承担，本轮契约零新增成员名：
  - **seam 成员名冻结**（#150/#155/#226）：`diagnosticLog.emitter` / `initStream` /
    `runtimeEmitterFor`；Runtime 侧 `diagnosticEmitter` + `clock` 成对（`20260905-bug-issue-226.md`
    §152「seam 字段名冻结：修复不得漂移」）。本契约不发明任何新字段名。
  - **生产供应方形状对照**（#226/#228）：`apps/yjs-server/src/diagnostics.ts` 的 binding 语义
    （共享 `emitter` 恒丢弃 + 计数；`runtimeEmitterFor` 数据键控；`initStream` 建流；
    retire/close 丢弃桩）作为 P1 契约的对照面，不作为 P0 的自然组合面。
  - **File adapter 冻结面**（#152 R2 / AGENTS.md）：`emit` 为有界同步 append；接线必须在
    write sequencer slot 之外；`manifest.json` 创建后不可变（#153）——本 issue 的「segments
    无 runtime 记录」判读不受 manifest 不可变性影响（同一 stream 的 append 面照常）。
  - **模块边界**：registry 侧诊断装配（`create-diagnostic.ts`）零导出到公共面；NDCL 新成员经
    `src/index.ts` 公共面与版本 bump 承载。
- 约束冲突检查：无。P0（adapter 自绑定）与 P1（manager 导出）互不冲突——单 ns 与多 ns 两条正路
  的分工即 issue 裁决本身。

## 4. Environment and baseline

- 环境：Node `v24.13.0`；pnpm `10.28.2`；vitest `3.2.7`；`pnpm install --frozen-lockfile
  --prefer-offline` 完成（store 复用，零网络下载）；测试统一经
  `NODE_OPTIONS=--conditions=nomicore-source`。
- 基线（新增契约文件**之前**，`artifacts/sa6-issue393-baseline-registry.log`）：
  registry 诊断五套（#150 red 契约、#150 sa7-dynamic、code-source、#226、#249 泵）
  **55 tests / 5 files 全绿**，`Type Errors no errors`，EXIT 0。
- 基线（`artifacts/sa6-issue393-baseline-ndcl-app.log`）：NDCL 包全部测试 +
  apps/yjs-server 诊断四套 **481 tests / 35 files 全绿**；该次 EXIT 1 的 4 个
  `Unhandled Source Error` 全部来自本轮临时夹具 `zz-ndcl-empty-segments-repro.test.ts`
  的类型错误（`OpenReplicationSessionResult.session` 收窄），临时夹具删除后由 §13 的全量
  套件结果取代（零残留噪声）。
- 全量套件（新增契约后、修复前，`artifacts/sa6-issue393-full-suite.log`）：
  `Test Files 4 failed | 392 passed (396)`、`Tests 15 failed | 4737 passed (4752)`、
  `Type Errors 1 failed`；**4 个失败文件全部是本票新增契约**，其余 392 文件零失败——no-regression
  面成立（§13）。
- 注入夹具：固定 Clock `1_700_000_000_000`；确定性计数随机源（首候选 `ns-…01`、第二 `ns-…02`）；
  MemoryPersistence（`createTestScheduler`）；pump 排空 = 有界 `setImmediate` 轮次（零 real sleep、
  零到达型 poll）。

## 5. Positive reproduction

**症状**：DSH Hub（`nomicore-host`）与 Peer（`mabf-runner`）两侧只产出 `manifest.json` 与
`current.json`，`segments/` 无 runtime 级记录（bugreport-ndcl-empty-segments）。

**最小复现（A/B/C 三臂差分；现红）**：`raw log = createFileDiagnosticLog({rootDir, namespaceId})`
→ `createNamespaceRegistryForTesting(persistence, { diagnosticLog: raw log })` → `create`（建流前
无记录可落，File adapter 构造期已建 manifest/current.json）→ `release` → `open` → `mutateData`
（差分仪器运行证据 = `artifacts/sa6-issue393-differential-arms.log`，仪器本体为临时文件、已删，§16）：

| 臂 | 操作 | segments 记录 | 结论 |
|---|---|---|---|
| A | `log.emitter.emit(root-mutation)` 直发 | `[root-mutation]` ✅ | 适配器写面无缺陷 |
| B | 自然组合（raw log 直传）+ open + mutate | `[namespace-create]`（**0 条 root-mutation**）❌ | 精确复现症状 |
| C | `{emitter, runtimeEmitterFor}` 显式 binding（**无** `initStream`） | `[namespace-create, root-mutation]` ✅ | 缺口边界 = log 未自绑定 |

扩展臂（同一夹具，见 §9）：D（跨 ns 写入）、E（无归属拒绝）、G2（成功 replication apply）。
症状链完整解释：DSH 的 workload 是「open 既有 namespace + 持续 root-mutation / replication-apply」，
其中 `open`/`importReplica` **结构性不发射** create 记录（`registry.ts` 仅 create 路径调用
`diag.emitOutcome/emitStreamOutcome`），而 runtime 级 emission 因 §8 根因从不产生——于是
`segments/` 字面为空，且 manifest/current.json 因构造期 eager 建立而存在（外观「正常」）。

## 6. Negative control

契约内嵌四类对照（全部现绿、修复后必须保持）：

| 负控/正控 | 断言 | 作用 |
|---|---|---|
| G1（NDCL + registry） | `log.emitter.emit(root-mutation)` 直发落盘 | 排除「File adapter 静默失败/缓冲/写不进 segments」假设 |
| G2 | `{emitter: log.emitter}` legacy 字面量 + create + mutate → 恰 1 条 `namespace-create`、**0 条 runtime 记录** | #150 冻结语义零漂移；同时证明 R1 的断言不是「任何 shape 都会红」 |
| G3 | `initStream` 成员缺席 | P0 明文纪律（不加成员）；泵路径缺席 → no-op |
| G4 | 显式 `{emitter, runtimeEmitterFor}` binding → root-mutation 落盘 | 证明 registry/runtime 装配面本身可用；根因精确到 `FileDiagnosticLog` 未自绑定 |

## 7. Stability, scale and timing

- **重复率**：同一契约文件两轮独立复跑（`artifacts/sa6-issue393-red-first-pass.log` 与
  `artifacts/sa6-issue393-red-contracts.log`）失败集合与失败文本逐条一致；全量套件第三轮同样
  只失败本票 4 个文件。复现率 = 100%（确定性）。
- **时序**：唯一异步面 = diag-pump 的 `setImmediate` macrotask；测试以有界 `setImmediate` 轮次
  （12）排空，零 real timer、零轮询型到达断言。`replication-apply` 用例先等 schema `ready`
  再开 session（既有先例的微任务预算内）。
- **规模条件**：命名空间 = 1 或 2 个；记录 = 个位数；无规模相关阈值。无竞态（归因键 = 数据，
  #155 纪律）。
- **环境敏感面**：文件系统（tmp 目录）+ strict reader；无网络、无端口、无外部服务。

## 8. Root-cause chain or capability gap

### Root-cause chain

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| 1 症状 | raw log 直传时 segments 只有 create 尝试、零 runtime 记录；DSH 的 0 记录可解释为「无 create 流量 + 无 runtime 记录」 | 臂 B；`registry.ts` create-only 发射点；issue body | 高 |
| 2 直接故障点 | registry `createDiagRuntime` 对 raw log 取 legacy 回落：`readRuntimeEmitterResolver` 非抛读取返回 undefined → `resolveRuntimeDiag() => undefined` → RuntimeFactory 第三参无 emitter/clock → Runtime `diagEnv.emitter === undefined` → slot diag 不构造、该 Runtime 的全部发射点 no-op | `create-diagnostic.ts:309-318, 417-463`；`registry.ts:817-860`；`runtime.ts:740/748`；`replication-session.ts:484-492`；R1/R2 红灯（记录仅 `namespace-create`） | 高 |
| 3 触发条件 | `diagnosticLog` 是 `FileDiagnosticLog` 产物：成员 = `emitter`/`streamId`/`rootDir`/`namespaceId`/`sweepRetention` + 内部符号，**无 `runtimeEmitterFor`** | `file.ts:118-131`（接口）、`:1529-1544`（构造产物）；R0 红灯 `typeof === 'undefined'`；类型面红灯 | 高 |
| 4 最深根因 | adapter 已持数据键控归因所需的全部事实（`namespaceId` + `emitter`），但没有把 #155 生产泵路径所需的解析成员作为公共面暴露；两个公共导出的「自然组合」因此落入 #150 过渡态形状——runtime 级可观测性从不产生，且**零错误/零警告/零输出** | owner 裁决（comment 5664521867）；`types.ts:899-903`（seam 三成员）；仓内无任何测试/应用以 raw log 直传（全部 `{emitter}` 字面量或完整 manager binding）+ 显式 binding 立即工作（G4/臂 C） | 高 |
| 5 放大因素 | (a) 静默回落是「受支持形状」，无告警；(b) manifest/current.json 构造期 eager 建立 → 日志外观存活；(c) 损失是结构性的（非竞态）；(d) **同根因第二缺陷**：legacy 共享 emitter 恰是本 ns 的写面，导致其它候选 namespace 的 create 记录被写进本流（实测计数 1→2） | 臂 D0；R3 红灯 `before=1, after=2`；`file.ts` 构造期建流；`create-diagnostic.ts:417-463` | 高 |

**排除项**：配置错误（owner 已裁决为非配置问题，且两导出均为公共面、JSDoc 自述生产构造器）；
类型收紧 fail-fast（owner 作废，且自然用法修复后不存在需响的错误用法）。

## 9. Causal experiments

全部通过**控制变量**在同一夹具上换 binding 形状（唯一变量 = 是否存在 identity `runtimeEmitterFor`）。
仪器运行输出（含各臂实际记录序列）= `artifacts/sa6-issue393-differential-arms.log`：

| 实验 | 变量/操作 | 观察 | 判定 |
|---|---|---|---|
| A | 直发 `log.emitter` | 落盘 1 条 `root-mutation` | 排除适配器写面 |
| B | raw log 直传 + open + mutate | 仅 `namespace-create` | 复现（红） |
| C | `{emitter, runtimeEmitterFor}`（不加 `initStream`） | `namespace-create` + `root-mutation` | 根因 = 缺自绑定成员；泵路径本身可用 |
| D | identity binding + 第二 ns create | 本流计数 1 → 1 | 修复后无跨 ns 写入 |
| D0 | raw log + 第二 ns create | 本流计数 1 → **2** | 现状存在跨 ns 写入（第二个缺陷，红） |
| E | identity binding + shutdown 后 create | `REGISTRY_NOT_ACCEPTING` rejected 记录恰 1 条落本流 | AC5「接受落盘」定案可满足（见 §12.3） |
| G | identity binding + 非法 raw update apply | `replication-apply` rejected 记录落盘 | runtime 级 emission 共用同一装配 |
| G2 | identity binding + 合法远端 update | apply `ok:true`，`replication-apply` committed 记录落盘 | AC2 的正向见证 |
| 双向绿推演（临时 probe，已删） | 仅在适配器实例上注入 identity `runtimeEmitterFor`（生产源码零改动） | R0/R1/R2/R3/R4 断言 **4/4 绿**（`artifacts/sa6-issue393-green-capability.log`） | 契约可翻转、非不可满足 |
| P1 泛化敏感性（临时 probe，已删） | 以 `{onEvent, now}` 调**未泛化** manager | 数据键控 emit 静默、无归属 emit 抛 `TypeError: deps.sink is not a function`、`events=[]` | P1 断言对「仅导出未泛化」也敏感 |
| P1 双向绿推演（临时 probe，已删） | 泛化镜像实现（本地副本）跑同一断言 | root-mutation 落盘、`unattributed` / `namespace-deleted` / `manager-closed` 事件齐备 | P1 契约可翻转 |

## 10. Impact surface

- **P0 变更面**：`packages/namespace-diagnostic-log/src/adapters/file.ts`（`FileDiagnosticLog`
  接口 + 构造产物 + 公共 re-export 类型；版本 bump「公共面变化」）。
- **行为变化（无需改 registry）**：raw log 直传的装配进入 #226 泵路径 →
  本 ns 的 runtime 级 emission（`root-mutation` / `schema-replacement` / `replication-enable`
  / `replication-epoch-bump` / `replication-apply`）经泵 drain 落本流；其它 ns 解析 undefined →
  泵内丢弃（消除跨 ns 写入）；无归属拒绝落本流（定案，见 §12.3）。
- **P1 变更面**：`apps/yjs-server/src/diagnostics.ts`（签名泛化）+
  `apps/yjs-server/src/index.ts`（导出）+ app 内部消费同一导出（`app.ts` 现值仍为
  `./diagnostics.js`，P1 要求单一实现）。
- **P2 变更面**：`.agents/skills/nomicore/cordis-host.md`（配置节）、`SKILL.md`（路由行）。
- **零漂移面**：`{emitter}` 字面量 legacy 路径逐字节保持（#150 契约套件 + 本票 G2）；
  registry 侧成员名与探测逻辑零改动；Runtime 包零改动；`manifest.json` 不可变语义不受影响。
- **部署面**：DSH 两部署零代码改动，下个 tarball + 重启后生效（自绑定在装配期成立；
  旧进程内已构造的 Runtime 不被回溯补挂——与 issue 的「重启即恢复」一致）。

## 11. Ruled-out hypotheses

| 假设 | 反证 | 状态 |
|---|---|---|
| H1 File adapter 静默失败 / 缓冲未 flush / 写不进 segments | G1 + 臂 A：直发即落盘；同一 stream 的 create 记录也在盘上 | 排除 |
| H2 segments 目录布局 / reader 判定错误 | `readStreamStrict` 对同 stream 读回 create 记录；`manifest.json` 不可变（#153）不影响 append | 排除 |
| H3 registry 泵路径或 RuntimeFactory 第三参装配损坏 | G4/臂 C：显式 `runtimeEmitterFor`（连 `initStream` 都不给）即落盘 | 排除 |
| H4 环境 / fixture / 超时 / 测试入口问题 | 全量套件 392/396 文件零失败；本票 6 条守卫绿；两轮复跑失败集合完全一致 | 排除 |
| H5 log 的 `namespaceId` 与创建出的 ns 不一致（DSH 配置写错） | 夹具断言 `lease.namespaceId === log.namespaceId`（`ns-…01`）；identity 语义按构造即匹配 | 排除 |
| H6 `updateCapture`/inputPolicy 等策略导致记录被丢弃 | 默认策略下 create 记录照常落盘；R1/R2 断言只依赖 operation/result.kind | 排除 |
| H7 macrotask 未排空导致的假阴性 | 有界 `setImmediate` 排空 12 轮；臂 C/G4 在同样排空下绿 | 排除 |
| H8 「应当」由 Host 侧类型收紧 fail-fast 拦截 | owner comment 5664521867 明确作废该方向 | 排除（裁决） |

## 12. Acceptance contract and test paths

### 12.1 P0 —— `FileDiagnosticLog` 自绑定（主契约）

`packages/namespace-registry/test/issue-393-ndcl-self-binding-red.test.ts`（端到端，raw log 直传）

| 用例 | 断言（运行时行为） | 当前 | 修复后 |
|---|---|---|---|
| R0 | `runtimeEmitterFor` 为函数；`resolver(ns) === log.emitter`；`resolver(otherNs) === undefined` | **红** | 绿 |
| R1 | raw log + `create`+`release`+`open`+`mutateData` → 本 ns 流出现 `root-mutation`（≥1，含 `result.kind='committed'`） | **红**（0 条） | 绿 |
| R2 | 同上装配 + `enableReplication` + `openReplicationSession` + 合法远端 update → `replication-apply`（≥1，含 committed） | **红**（0 条） | 绿 |
| R3 | 本 ns 流中不出现其它 ns 的 create 记录（本流记录数在第二 ns create 前后不变） | **红**（1→2） | 绿 |
| R4 | 无归属公共入口拒绝落本流（见 §12.3）：`runtimeEmitterFor` 在场（泵路径判别）+ shutdown 后 create → `REGISTRY_NOT_ACCEPTING` rejected 记录恰 1 条 | **红**（仅泵路径判别缺失；落盘语义今天经 legacy 共享 emitter 已绿，见 §12.3 实测） | 绿 |
| G1 | 直发 `log.emitter.emit(root-mutation)` 落盘 | 绿 | 绿（守护） |
| G2 | `{emitter}` 字面量：恰 1 条 create 记录、0 条 runtime 记录 | 绿 | 绿（#150 零漂移） |
| G3 | `initStream` 成员缺席 | 绿 | 绿（守护） |
| G4 | 显式 `{emitter, runtimeEmitterFor}` binding → `root-mutation` 落盘 | 绿 | 绿（装配面正控） |

`packages/namespace-diagnostic-log/test/issue-393-file-log-runtime-emitter-for-red.test.ts`
（适配器边界，独立于 registry）

| 用例 | 断言 | 当前 | 修复后 |
|---|---|---|---|
| R1 | 成员在场 + identity 匹配 + 其它 ns → undefined | **红** | 绿 |
| R2 | 解析所得 emitter 是该流真实写面（emit 落盘） | **红** | 绿 |
| R3 | resume 路径（`resumeStreamId` 续写同一 stream）同样 identity 匹配且继续落盘 | **红** | 绿 |
| G1 | 不加 `initStream` | 绿 | 绿 |
| G2 | `emitter` 成员语义零漂移（直发落盘） | 绿 | 绿 |

`packages/namespace-diagnostic-log/test/issue-393-file-log-runtime-emitter-for-surface.test-d.ts`
（类型面，编译期红）

| 用例 | 断言 | 当前 | 修复后 |
|---|---|---|---|
| R | `FileDiagnosticLog` 满足 `{ runtimeEmitterFor?: (namespaceId: string) => NamespaceDiagnosticChangeEmitter \| undefined }`（条件类型 `true`） | **红**（`Actual: false`） | 绿 |
| G | `emitter` / `namespaceId` / `rootDir` / `streamId` 声明零漂移 | 绿 | 绿 |

### 12.2 P1 —— `@nomicore/yjs-server` 导出泛化 manager

`apps/yjs-server/test/issue-393-manager-export-and-skill-docs-red.test.ts`

| 用例 | 断言 | 当前 | P1 落地后 |
|---|---|---|---|
| P1-R1 | 公共入口（`src/index.ts`）导出 `createHostDiagnosticsManager` | **红** | 绿 |
| P1-R2 | 泛化调用面：`factory({ rootDir }, { onEvent, now })` 无 throw；`initStream`+`runtimeEmitterFor` 数据键控 → `ns-a` 流恰 1 条 `root-mutation`；共享 `emitter`（无归属）**不落任何流**且经 `onEvent` 上报 `{event:'diagnostic-log-emission-dropped', reason:'unattributed'}` | **红** | 绿 |
| P1-R3 | `close()` 后 `runtimeEmitterFor` 返回形状完备丢弃桩；迟到 emit 上报 `reason:'manager-closed'` | **红** | 绿 |
| P1-R4 | `retireNamespace` 后迟到解析上报 `reason:'namespace-deleted'`（retirement 语义不随泛化漂移） | **红**（导出缺席期统一红） | 绿 |

契约对「仅导出未泛化」同样敏感：临时 probe 实测未泛化 manager 在 `{onEvent, now}` 下
`deps.sink is not a function`（无归属 emit 抛错、事件捕获为空）。

### 12.3 AC5 —— 无归属公共入口拒绝的落盘语义：**接受落盘（显式定案）**

**定案**：泵路径下 `emitEarlyOutcome(namespaceId === undefined, …)`（acceptance/identity 拒绝，
namespaceId 生成前，`registry.ts:2201/2211`）经 #226 的**同步共享通道**
（`create-diagnostic.ts:530-541`）发射；自绑定 `FileDiagnosticLog` 的共享通道 `emitter`
**就是该 ns 自己的流写面** → 记录落本流，且不伪造 namespaceId 归属（record 面无 ns 字段）。

**理由**：
1. log 对象按构造即 per-namespace（`namespaceId` + 单 stream），落本流不构成跨流写入；
2. 该拒绝类无候选 id，数据键控解析结构性不可用（#155 归因键是数据不是时间）；
3. 丢弃会重演本 issue 定性的最坏失效模式——「无错误/无警告/零输出」；
4. 替代方案（另立丢弃通道成员）与 P0「最小公共面改动、不加 `initStream`」纪律相悖；
5. **该语义不是 P0 新增行为，而是保持现状**：临时 probe 实测（raw log 直传 + shutdown 后
   create，2026-09-14）今天即落 1 条 `namespace-create/REGISTRY_NOT_ACCEPTING` rejected 记录
   （legacy 共享通道 = 本流 emitter）——P0 只补齐 runtime 级通道，无归属面行为零漂移
   （证据追加于 `artifacts/sa6-issue393-green-capability.log`）。

**边界（写死进契约）**：该定案**仅**约束自绑定的 per-namespace `FileDiagnosticLog`；多 ns Host
的正路 = P1 导出的 manager，其共享 `emitter` 保持 **`unattributed` 恒丢弃 + 计数**
（#226/#228 冻结），由 P1-R2 守护。两条语义互补，不冲突。

**守护测试**：registry R4（判别 + 恰落一次 + `result.kind='rejected'`）。

### 12.4 P2 —— skill 文档交付物契约

| 用例 | 断言 | 当前 | P2 落地后 |
|---|---|---|---|
| P2-R1 | `cordis-host.md` 存在诊断日志配置节（标题含「诊断日志」），节内含 `createFileDiagnosticLog`（单 ns 正路）/ `createHostDiagnosticsManager`（多 ns 正路）/ 裸 `{emitter}` 与 legacy 语义的陷阱说明 / Hub 与 Peer 组合根示例 | **红** | 绿 |
| P2-R2 | `SKILL.md` 存在导流到 `cordis-host.md` 的路由行且覆盖诊断日志/observability 语义 | **红** | 绿 |

说明：P2 的交付物**本身就是文档文本**，不存在可运行行为面，故以文档内容契约锚定；本文件
其余全部断言均读取运行时产物（segments 落盘、strict reader、事件回调），不以源码字符串代替
行为验证。

### 12.5 完成门禁（修复后必须全绿）

- 本票 4 个契约文件（14 个运行时红灯 + 1 个类型面红灯）全部转绿，六个守卫锚保持绿。
- #150/#155/#226/#228/#249 既有契约零漂移（§4 基线 + §13 全量套件）。
- 根 `pnpm typecheck` 与相关包测试全绿（当前唯一红 = 本票类型契约，见 §13）。
- `namespace-diagnostic-log` 版本 bump（公共面变化；发布门禁，不作测试断言）。
- app 内部消费同一 manager 导出（单一实现；结构面由评审核验）。

## 13. Red/green or baseline evidence

| 证据 | 路径 | 结论 |
|---|---|---|
| 基线：registry 诊断五套 | `artifacts/sa6-issue393-baseline-registry.log` | 55/55 绿，EXIT 0，`Type Errors no errors` |
| 基线：NDCL 全包 + app 诊断四套 | `artifacts/sa6-issue393-baseline-ndcl-app.log` | 481/481 绿；EXIT 1 仅因临时夹具类型错误（已删，由全量套件取代） |
| 契约初轮红灯 | `artifacts/sa6-issue393-red-first-pass.log` | registry 契约 5 红 / 4 绿 |
| 差分臂仪器输出 | `artifacts/sa6-issue393-differential-arms.log` | A/B/C/G2/D0/E 各臂实际记录序列（§5/§9） |
| 契约聚合红灯（三文件） | `artifacts/sa6-issue393-red-contracts.log` | **14 红 / 6 绿**（红 = R0–R4 + NDCL R1–R3 + P1-R1…R4 + P2-R1/R2；绿 = G1–G4、NDCL G1/G2） |
| 类型面红灯 | `artifacts/sa6-issue393-typecheck-red.log` | `tsc -p packages/namespace-diagnostic-log/tsconfig.json` → `TSC_EXIT:2`；vitest `Type Errors 1 failed`（`Expected literal boolean true, Actual literal boolean false`） |
| 双向绿推演（P0） | `artifacts/sa6-issue393-green-capability.log` | 注入 identity `runtimeEmitterFor`（仅实例层）后 4/4 绿；追加无归属 legacy 落盘实测（§12.3 理由 5） |
| 根 typecheck | `artifacts/sa6-issue393-root-typecheck.log` | 仅 NDCL 包因本票类型契约红（EXIT 2）；`replication-protocol`/`ws-replication`/`apps/yjs-server` 单独复跑 EXIT 0 |
| **全量套件（修复前）** | `artifacts/sa6-issue393-full-suite.log` | `396 files: 4 failed / 392 passed`；`4752 tests: 15 failed / 4737 passed`；失败 4 文件**全部**为本票契约；`Type Errors 1 failed` |

红灯原因逐条为缺口本身（`typeof runtimeEmitterFor === 'undefined'`、runtime 记录 0 条、跨 ns 计数
+1、导出 undefined、文档节缺席），无环境/夹具/超时噪声；守卫锚 6/6 绿证明断言不是恒红。

## 14. Runner trigger evidence

- 根入口配置 `vitest.config.ts`：`include = ['packages/*/test/**/*.test.ts', 'domains/*/test/**/*.test.ts',
  'apps/*/test/**/*.test.ts']`，`typecheck.include = ['packages/*/test/**/*.test-d.ts', …]`。
- 本票四个文件分别落在 `packages/namespace-registry/test/`、`packages/namespace-diagnostic-log/test/`
  （含 `.test-d.ts`）、`apps/yjs-server/test/`，与 include 精确匹配。
- 真实入口复跑：`NODE_OPTIONS=--conditions=nomicore-source npx vitest run --typecheck`
  （等价于根 `pnpm test` 的测试面）→ 396 文件中本票 4 文件被收集并失败，其余 392 文件零失败
  （`artifacts/sa6-issue393-full-suite.log`）。无 skip/only/todo/env override/fallback/吞错。
- 类型契约在 `vitest run --typecheck` 下被识别（`Type Errors 1 failed`），且 `tsc -p` 包级
  typecheck 同样识别。

## 15. Unknowns and blockers

- **无 blocker**：环境完整，症状可稳定复现，根因经控制变量实验定位，四条契约路径均被真实测试
  入口发现。
- 未证实/需设计阶段定案（不阻塞 SA6 verdict）：
  1. **回溯性**：自绑定只在装配期生效；已构造的 Runtime 不被回溯补挂（DSH 走「新 tarball + 重启」
     路径，与 issue 期望一致）。契约不要求热修复既有进程。
  2. **disabled 模式语义**：`FileDiagnosticLog` 在 disabled/failed 模式下形状完备返回
     （`file.ts:1517-1544`）。本契约不要求其 `runtimeEmitterFor` 返回丢弃桩还是 `emitter`；
     若 SA1 选择让 disabled 模式也自绑定（返回同一 silent emitter），行为等价于「泵内静默」。
  3. **「全仓仅一份 manager 实现」**：P1 只能从行为面锚定公共导出；app 内部改消费同一导出属
     结构面，由评审/后续结构守卫核验（无跨桶模块同一性可观测面）。
  4. **版本 bump**：属发布元数据，不作测试断言，列入 §12.5 门禁。
  5. **DSH 部署零代码改动**：仓外验证，不在本 worktree 可证范围。
- 若 SA1 设计决定把 `runtimeEmitterFor` 声明为 required（本契约类型面用可选成员形态以容忍
  required/optional 两种声明）之外的第三种形状（如独立 resolver 对象），须回 SA6 对齐契约。

## 16. Temporary diagnostics cleanup

- 本轮建立的临时文件（全部删除，`git status` 已确认）：
  - `packages/namespace-registry/test/zz-ndcl-empty-segments-repro.test.ts`（A–G 差分 harness，首轮）
  - `packages/namespace-registry/test/zz-393-differential-arms.test.ts`（最终差分仪器：A/B/C/G2/D0/E）
  - `packages/namespace-registry/test/zz-probe-393-simulated-p0.test.ts`（双向绿推演）
  - `packages/namespace-registry/test/zz-probe-393-unattributed-legacy.test.ts`（无归属 legacy 落盘实测）
  - `apps/yjs-server/test/zz-probe-393.test.ts`（未泛化 manager 敏感性）
  - `apps/yjs-server/test/zz-probe-393-generalized.test.ts`（泛化镜像绿推演）
- 证据留存：上述仪器/probe 的 stdout/结果已固化在 `artifacts/sa6-issue393-differential-arms.log`、
  `artifacts/sa6-issue393-green-capability.log` 与 §5/§9/§12.3 记录中；临时文件不留任何收集面噪声
  （全量套件日志中零 `Unhandled Source Error`）。
- **生产实现零改动**：`git diff --stat` 为空；worktree 仅新增 4 个契约测试文件 + 10 个
  `artifacts/sa6-issue393-*.log` 证据 + 本报告（以及 dispatch 前即存在的未跟踪 `wiki/raw/task_issue-393.md`）。
- 无后台服务/进程残留（仅 vitest/tsc 一次性进程，均已退出）。

---

## 附：本轮产物清单

| 产物 | 角色 |
|---|---|
| `wiki/raw/task_issue-393_sa6_contract.md` | 本报告（固定路径） |
| `packages/namespace-registry/test/issue-393-ndcl-self-binding-red.test.ts` | P0 端到端红灯契约（AC1–AC5 主载体） |
| `packages/namespace-diagnostic-log/test/issue-393-file-log-runtime-emitter-for-red.test.ts` | P0 适配器边界红灯契约 |
| `packages/namespace-diagnostic-log/test/issue-393-file-log-runtime-emitter-for-surface.test-d.ts` | P0 类型面红灯契约 |
| `apps/yjs-server/test/issue-393-manager-export-and-skill-docs-red.test.ts` | P1 + P2 红灯契约 |
| `artifacts/sa6-issue393-*.log`（10 份） | 基线 / 差分臂 / 红灯 / 类型面 / 双向绿推演 / 无归属落盘实测 / 全量套件 / 根 typecheck 证据 |
