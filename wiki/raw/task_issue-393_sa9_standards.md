# SA9 Standards Review — Issue #393（FileDiagnosticLog 自绑定 P0 + manager 泛化导出 P1 + skill 文档 P2）

> SA9（独立 Standards 审查者），iteration 0。被审对象：**最终已提交** diff——
> 权威基线 main `dcb37669e209b1aa7d50abefa208530213f147e2` → 交付 head
> `9ac50599eb195224c4fcc7d1d0fef02b6c20d21c`「fix(diagnostics): self-bind file diagnostic
> logs」（`git rev-parse HEAD` 实核；worktree `/home/wangjian/nomicore-fix-issue-393`，
> tracked tree 干净，仅未跟踪证据 log）。审查面**仅限**仓库/工程标准：AGENTS、ADR 条款、
> 模块责任、既有架构惯例、单一事实源、生命周期对称性、文件范围与测试质量；Issue 需求
> 完整性属 SA10 面，不在本报告裁决。Owner 要求（comment 5664521867，updated
> 2026-09-14T13:12:42Z）：自然直接组合 `createFileDiagnosticLog(...)` → `diagnosticLog`
> 必须经 **identity 匹配自绑定**工作，而非 configuration blame 或 fail-fast 收紧。
> 本迭代全部关键结论均经本人对最终 diff、head 源码、母法文本与落盘证据日志亲自核对
> （非仅转述上游 SA 产物）；按角色边界零运行（无 tsc/vitest/服务），运行级证据核对落盘日志。

## Inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-393.md`（任务简报：issue 正文 + Owner comment 5664521867 + P0/P1/P2 + AC） | 已读全文 |
| `wiki/raw/task_issue-393_sa6_contract.md`（SA6 approve；三臂差分/根因链/4 红灯契约文件/完成门禁） | 已读相关节 |
| `wiki/raw/task_issue-393_design.md`（SA1；§7.1-D1…D5 / §7.2 / §7.3 / §11 ALLOW-DENY / §12 验收映射 / §14 recheck=true） | 已读全文 |
| `wiki/raw/task_issue-393_design_conflict_report.md`（SA8 设计后复查 **clear**；15 no-conflict + 3 implements-existing-decision；§5 冻结面 10 项；§8-b 实现期核对清单 6 项；requiresConflictRecheck=true 待实现 diff 闭合） | 已读全文 |
| `wiki/raw/task_issue-393_sa2_review.md`（SA2 **approve**；O1–O4 非阻断观察） | 已读全文 |
| `wiki/raw/task_issue-393_sa3_impl.md`（SA3 实现报告；9 ALLOW 路径；15 红→0 绿 + 因果反转；根门禁全绿） | 已读全文 |
| `wiki/raw/task_issue-393_sa4_review.md`（SA4 **approve**；O1–O3 非阻断观察） | 已读全文 |
| `wiki/raw/task_issue-393_sa7_report.md`（SA7 **approve**；数据流①–④/状态机/错误清理运行时证据） | 已读全文 |
| 最终 diff 亲核 | `git diff dcb3766..9ac5059` 全量：9 实现/文档路径逐 hunk + 4 新契约测试文件（372+139+38+266 行）逐行读 + 8 wiki 过程产物；DENY 面（registry/runtime/replication src、NDCL index/schema/record/health/pipeline/emission/reader/retention/read-session、memory adapter、`docs/adr/**`、`CONTEXT.md`、app `config.ts`/`lifecycle.ts`、`pnpm-lock.yaml`）`git diff --stat` 实测 **0 行** |
| 母法亲读 | 根 `AGENTS.md`（诊断日志节：ADR-0011/0014 为规范契约 + NDCL AGENTS 必读；emit 永不 throw、接线在 write sequencer slot 外）；`packages/namespace-diagnostic-log/AGENTS.md`（契约测试 SA6 owned 改实现不改断言；环境绑定面；observer 白名单；不改 ADR）；`packages/namespace-registry/AGENTS.md`（诊断面须读 ADR 0011/0014；公共 API 只经 `src/index.ts`）；`apps/AGENTS.md` + `apps/yjs-server/AGENTS.md`（组合根只消费包公共导出；单一停机链 diagnostics O(1) close；stdout NDJSON 事件面；Verification = `tsc -p apps/yjs-server/tsconfig.json` + app 套件） |
| head 源码亲核 | `file.ts` 接口/产物 hunk、`diagnostics.ts` 终态（config 消费面/notify/unattributedEmitter/dropStub/ensureAdapter/binding）、`index.ts` 导出块、`app.ts` 调用点、registry seam `types.ts:885-903`（`runtimeEmitterFor?` 签名逐字同形）、`vitest.config.ts` include/typecheck globs、NDCL `tsconfig.json`（`include: src+test`）、根 `package.json` typecheck 14 链、`.github/workflows/ci.yml` 三入口、`apps/yjs-server/package.json`（deps 声明 workspace:*） |
| 独立 grep | 跨包源导入先例 7 处（`registry-create-diagnostic-red.test.ts:95` 等）；`Object.keys(log` 全仓零命中；新契约文件零 `skip/only/todo`；`zz-` 临时文件零残留（仅既有 tracked fuzz 测试误配）；`HostDiagnosticsManager` 名无碰撞；`as never` 透传先例（`registry-create-diagnostic-red.test.ts:302`） |
| 落盘证据核对 | `artifacts/sa3-issue393-rerun-red-and-typecheck.log` 尾（4 文件/22 tests 绿、Type Errors no errors、NDCL/app/registry tsc 与根 typecheck 全 EXIT 0）；`artifacts/sa3-issue393-rerun-full-suite.log` 尾（396 files/4752 tests 绿、EXIT 0）；对照 `artifacts/sa6-issue393-full-suite.log` 修复前基线（4 failed/392 passed、15 failed、Type Errors 1 failed）；`artifacts/sa7-issue393-post-removal-verify.log`（9 文件/77 tests 绿） |

## Verdict

**approve** —— 最终已提交 diff 全面符合仓库与工程标准；无 BLOCKER / 无 MAJOR。
Owner 核心命题（自然组合经 identity 匹配自绑定工作、registry 探测零改动、无 fail-fast
收紧、无配置归罪）在交付中以最小公共面增量忠实兑现。3 条 MINOR 观测见 §8，均不阻断。

---

## 1. 仓库 AGENTS 与模块契约

| 标准 | 证据（最终 diff / head 亲核） | 判定 |
|---|---|---|
| 根 AGENTS「改 packages/ 前读最近嵌套 AGENTS 并守其边界」 | 全链（SA6/SA1/SA8/SA2/SA3/SA4/SA7）均已读并对账；本审查对三方 AGENTS 逐条独立复核（下行起） | ✅ |
| 根 AGENTS 诊断日志节「ADR-0011/0014 为规范契约；emit 永不 throw、永不改业务结果；生命周期调用点在 write sequencer slot 外」 | P0 新成员 = 纯闭包字符串比较（`file.ts` head：`(ns) => ns === namespaceId ? emitter : undefined`），零 IO/零 throw/零状态；emit 路径/调用点/泵接线零 diff（registry/runtime src 实测 0 行）；P1 `notify` 吞没 onEvent throw = ADR-0011 隔离条款正向收紧（SA8 §3 已裁定 no-conflict） | ✅ |
| NDCL AGENTS「契约测试 SA6 owned——改实现不改测试断言」 | 4 契约文件为本票新增文件（SA6 产物原样提交），内容与本审查所读 SA6 §12 断言面逐条对应；实现 diff 未触碰任何既有测试断言（SA4 复核 mtime 时序 21:19–21:21 契约 < 22:11–22:33 实现；本审查 `git diff` 亲核两 app 适配测试仅调用形状、零断言改动） | ✅ |
| NDCL AGENTS 环境绑定面（`node:fs` 仅 file.ts/reader.ts；零新增依赖；纯 TS 纪律） | `file.ts` diff 恰 12 行 = 接口成员 +JSDoc + 产物闭包成员 +注释；无 import 新增、无 IO、无依赖变化（`package.json` 仅版本字段 1 行） | ✅ |
| NDCL AGENTS 冻结面（schema 指纹/observer 白名单/record 词表/manifest/reader/retention） | 相关路径 diff 实测 0 行；`recordVersion:1` 不变（回滚可读性保持） | ✅ |
| NDCL AGENTS Verification（包 `pnpm test` --typecheck 覆盖本包 test/**） | `tsconfig.json` include `src+test` 覆盖新 `.test-d.ts`；根 test 脚本 = `vitest run --typecheck`；证据 log：NDCL tsc EXIT 0、4 契约 22 tests 绿、Type Errors no errors | ✅ |
| registry AGENTS「诊断发射面须读 ADR 0011/0014 + NDCL AGENTS」「公共 API 只经 src/index.ts」「testing seam 归 testing 面」 | registry src **零 diff**（Owner 裁决的 P0 形状成立）；新契约测试经 `@nomicore/namespace-registry/testing`（`createNamespaceRegistryForTesting`）注入——包内测试既有面，非公共 API 新增 | ✅ |
| apps/AGENTS「组合根只消费包公共导出；适配器选择/日志/停机编排在应用边」 | P1 逻辑本生于 app（非包内契约上移）；`diagnostics.ts` 只 import `@nomicore/namespace-diagnostic-log` / `@nomicore/namespace-registry` 公共导出（deps 声明 `workspace:*` 亲核）；新泛化类型摆脱 app 本地 `DiagnosticsConfig.enabled`/`EventSink` 语义，retention 单源引用 NDCL 公共 `FileRetentionConfig` | ✅ |
| yjs-server AGENTS「stdout 严格 NDJSON 生命周期事件面」「单一停机链 diagnostics O(1) close」 | 事件词表/字段零变更（`HostDiagnosticsManagerEvent` = 既有三事件形状的类型化公共面；`diagnostic-log*` 词表无新增）；`close()`/`retireNamespace()` 语义逐字未动（diff 唯一行为面变化 = 3 处 `deps.sink(...)` → `notify(...)` 收口），停机链次序无涉 | ✅ |
| yjs-server AGENTS Verification（`tsc -p apps/yjs-server/tsconfig.json` + app 套件） | 证据 log：app tsc EXIT 0（覆盖 O4 适配面，`onEvent: this.sink` 直传无需兜底）；全量套件 396 文件绿含两适配测试 | ✅ |
| 根 AGENTS「Nomicore integration skill 归 `.agents/skills/nomicore/` 宿主」 | P2 落点恰为 `cordis-host.md` 配置节 + `SKILL.md` 路由行/description，未新开分支文件（与「不发明 helper」Guardrail 同向的正路文档化） | ✅ |

## 2. ADR 条款符合性（架构契约）

| ADR 条款 | 实现落点（head 亲核） | 判定 |
|---|---|---|
| 0011 §产品契约（emit/排队/持久化/丢弃失败不得改变业务结果） | 自绑定成员纯闭包；append 仍在泵 macrotask drain 逐任务 try/catch 边界内（`diag-pump.ts` 零 diff）；契约 R1/R2 断言业务写 `{ok:true}` 与落盘并立 | ✅ |
| 0011 §覆盖范围（create/ROOT/SCHEMA/replication apply/management 应记录） | P0 使自然组合交付完整覆盖集——R1（root-mutation committed 落盘）、R2（replication-apply committed 落盘）契约锚；SA8 裁定 **implements-existing-decision**（兑现既有义务，非决策演进） | ✅ |
| 0011 §时序（acceptance 前拒绝在对应公共入口记录） | AC5 定案「接受落盘」= 该条款义务方向；R4 契约锚（shutdown 后 create → 恰 1 条 `REGISTRY_NOT_ACCEPTING` rejected 落本流）；实现侧零新代码（既有同步共享通道），SA6 实测现状即落盘 → 零行为漂移 | ✅ |
| 0014 §Writer + 首切片 amendment（有界同步 append；调用点在 write sequencer slot 外；emitter seam/schema/manifest 不随演进改变） | emit 路径与调用点零触碰；建流/append 时机仍由 #226 泵控制；不加 `initStream`（G3 + NDCL G1 双守卫绿）；record schema/词表/manifest 零 diff | ✅ |
| 0009（外部 Clock 注入，禁系统时钟 fallback） | P1 泛化 deps `now: () => number` 保持**必需**（只严不松）；app 调用点 `requireClock(this.ctx).now()` 不变 | ✅ |
| ADR 文本冻结（NDCL AGENTS/设计 DENY：`docs/adr/**` 零修订） | diff 实测 0 行；SA8 裁定无需演进（evolution-required × 0、hard-conflict × 0） | ✅ |

## 3. 模块责任归属

| Behavior | Expected owner（母法/惯例） | 交付落点 | 判定 |
|---|---|---|---|
| per-ns identity 解析（本 log 是否该 ns 的日志） | NDCL File adapter——事实（`namespaceId` + `emitter`）自持 | `file.ts` 接口 + 唯一构造点闭包 | ✅ registry 零感知 |
| 路由/泵/归因投递 | namespace-registry（#226 既有） | 零 diff（DENY 保持） | ✅ |
| 多 ns 生命周期（缓存/retire/close/丢弃桩） | yjs-server manager（#155/#226/#228 谱系） | `diagnostics.ts` 语义逐字未动，仅签名泛化 + 导出 | ✅ |
| 诊断日志配置正路文档 | `.agents/skills/nomicore/`（宿主集成指引 owner） | `cordis-host.md` 四要素节 + `SKILL.md` 路由 | ✅ |

## 4. 既有架构惯例

| 惯例 | 先例 | 交付 | 判定 |
|---|---|---|---|
| 生产供应方 seam 成员名（#150/#155/#226 冻结） | manager binding `runtimeEmitterFor` | 逐字复用同一成员名与 identity 语义——同一 seam 的第二供应方（per-ns 自绑定族），无平行通道、无新字段名 | ✅ |
| app 公共导出模式 | `createNodeHubListenAdapter`（index re-export） | `index.ts` re-export `./diagnostics.js`；app 内部经 `./diagnostics.js` 消费**同一模块符号**（单份实现；不从 `./index.js` 回导，无 app↔index 循环——index 已 `export … from './app.js'`） | ✅ |
| registry 测试跨包源引用 | `../../namespace-diagnostic-log/src/index.js` 7 处先例（`registry-create-diagnostic-red:95`、`registry-issue-226-red:66` 等） | 393 契约同款导入 | ✅ |
| `as never` seam 透传 | `registry-create-diagnostic-red.test.ts:302` | `makeRegistry` 同款 | ✅ |
| 契约文件命名 | `issue-<N>-*-red.test.ts` / `*.test-d.ts` 谱系 | 4 文件同名规范 | ✅ |
| wiki/raw 过程产物随交付提交 | `18c5d8f`（#337：wiki 12 文件 + artifacts）、`1b55d5c`、`cb8aaff` 等 | 8 个 `task_issue-393*.md` 随 commit | ✅ |
| 版本 bump 承载公共面变化 | 0.1.7→0.1.8 先例（patch 位惯例） | NDCL `0.1.8`→`0.1.9`（AC 明文；lockfile `link:`/`workspace:*` 引用无漂移面，diff 实测 0 行） | ✅ |

## 5. 单一事实源

| Fact | Authoritative source | Derived state | Drift risk | 判定 |
|---|---|---|---|---|
| log 归属 ns | 构造期 `namespaceId`（config） | `runtimeEmitterFor` 纯闭包比较；无镜像状态/无时间序（#155「归因键是数据不是时间」） | 无（构造期一次成型后只读；幂等——恒返回同一 emitter 实例） | ✅ |
| 流写面 | 构造期 `emitter`（`file.ts` 唯一构造点，一切模式形状完备） | resolver 返回同一实例 | 无 | ✅ |
| manager 实现 | `diagnostics.ts` 单模块 | app 经 `./diagnostics.js`、公共经 index re-export 同一符号 | 无（全仓一份） | ✅ |
| retention 配置类型 | NDCL 公共 `FileRetentionConfig` | manager 直接引用；app `DiagnosticsRetentionConfig` 保持 app 本地（`enabled` 属 app 决策，设计 §7.2-4/7 定案的边界） | 形状逐字段相同，边界显式 | ✅ |
| 事件词表 | `diagnostics.ts` 唯一产生点（`diagnostic-log*` 三事件） | `HostDiagnosticsManagerEvent` 类型化既有形状 | 无（词表/字段零变更） | ✅ |

## 6. 生命周期对称性

| Start/acquire | Stop/release | 判定 |
|---|---|---|
| P0 成员 = 纯闭包（无 acquire） | 无 release 面；零 IO/零 throw | ✅ 无新增生命周期面 |
| manager `createHostDiagnosticsManager` | `close()` 幂等 + `retireNamespace(ns)` 丢弃桩——语义逐字未动；P1-R3/R4 契约守护绿（close→`manager-closed`、retire→`namespace-deleted`、un-retire 复活面不变） | ✅ |
| stream/manifest/retention（#153/#154 面） | 零 diff；resume 路径同一构造产物自绑定（NDCL R3 锚：续写同 stream、identity 不变） | ✅ |
| 停机链（replication drain → registry shutdown → diagnostics O(1) close → persistence） | 无涉改动；P2 文档将 manager `close()` 位置写为与该次序一致 | ✅ |

## 7. 文件范围与测试质量

### 7.1 文件范围（对设计 §11 ALLOW/DENY + SA8 §8-b 清单）

- ALLOW 9 路径**逐一对应**（`file.ts` / NDCL `package.json` / `diagnostics.ts` / `index.ts` /
  `app.ts` / 两 app 测试 / `cordis-host.md` / `SKILL.md`），无越权、无缺失；
- 新增 4 契约文件 = SA6 owned 产物原样提交（改实现不改断言纪律成立）；
- 8 wiki/raw 过程产物 = 仓内交付惯例（§4）；
- DENY 全集（registry/runtime/replication src、NDCL index 与其余 src、memory adapter、
  `docs/adr/**`、`CONTEXT.md`、app `config.ts`/`lifecycle.ts`、`pnpm-lock.yaml`、SA6 证据 log）
  diff 实测 **0 行**；临时差分 harness `zz-ndcl-empty-segments-repro.test.ts` 未入库（AC 备注意图
  = B 臂转正为正式契约 R1，已兑现）；SA7 临时 harness 零残留（grep 复核）。
- SA8 §8-b 六项实现期核对清单逐项闭合（file.ts 面界 / binding 语义零漂移 / registry 等包零
  diff / 契约与 SA6 证据零改动 / 0.1.9 落盘 / P2 双语义写为供应方范围限定——「The two
  unattributed semantics are deliberately different and not interchangeable…」段在文）。
  SA8 `requiresConflictRecheck=true` 所列待闭合面（公共 API 兑现、R4/P1-R2 双语义边界、§5
  冻结面 10 项）经本轮对最终 diff 全部核对通过，**未发现新的 ADR 冲突风险**，故不提交
  conflict recheck。

### 7.2 测试质量

| 维度 | 证据 | 判定 |
|---|---|---|
| 红灯先行（red-first） | 契约文件为修复前产物（SA6 红灯 log 14 红/6 绿；用例名与现文件逐字一致——SA4 比对，本审查抽核 R0–R4 命名/断言面一致）；修复前全量基线 4 文件失败全部为本票（no-regression 面成立） | ✅ |
| 绿灯归因 | SA3 因果反转（stash P0 hunk → R0–R4 全红/G1–G4 全绿 → pop 逐字节恢复）+ SA6 修复前基线独立承载；修复后 4 文件/22 tests 绿、守卫 6/6 绿 | ✅ |
| 行为断言非源码文本 | 运行时断言全部经 strict reader 回读 segments / onEvent 事件回调 / 公共入口动态 import；P2 文档内容契约有 SA6 §12.4 论证（交付物本体即文档，不存在可运行行为面） | ✅ |
| 负控/正控 | G1（直发落盘排除适配器假设）、G2（#150 legacy 逐字节零漂移：恰 1 create/0 runtime）、G3（`initStream` 缺席）、G4（显式 binding 证明装配面可用）+ NDCL G1/G2——断言非恒红/恒绿 | ✅ |
| 弱化标记 | 零 `skip/only/todo`（grep 亲核）；无 env override、无吞错 fallback（SA3/SA4 同判） | ✅ |
| 夹具纪律 | 固定 Clock、确定性计数随机源、MemoryPersistence+fake scheduler、有界 `setImmediate` 泵排空（SUT 自身调度语义，非到达型 poll、零 real sleep）；R2 的 schema-ready 等待为有界 400 次 microtask 自旋 | ✅ |
| 清理 | `afterEach` 临时目录清除；lease release / session close / registry shutdown 成对（R1–R4/G2/G4 亲核） | ✅ |
| 测试入口真实 | 根 `vitest.config.ts` include（`packages/*/test/**`、`apps/*/test/**`）+ typecheck include（`packages/*/test/**/*.test-d.ts`）命中全部新文件；NDCL tsconfig `include: test/**`；CI 三入口（`pnpm typecheck` / `--typecheck.only` / 磁盘枚举分片）自动收入 | ✅ |
| 门禁结果（落盘证据） | 根 `pnpm typecheck` 14 链 EXIT 0；根 `pnpm test` 396 files/4752 tests 绿、Type Errors no errors、EXIT 0（对照修复前 4 failed/15 failed/Type Errors 1 failed——既有 392 文件零回归）；SA7 post-removal 9 文件/77 tests 绿 | ✅ |
| AC5 显式定案入契约 | R4 用例头注写死「接受落盘」定案 + 四条理由 + 与 manager `unattributed` 丢弃的互补边界（P1-R2 守护另一侧） | ✅ |

## 8. MINOR 观测（均不阻断 approve）

- **M1（证据 log 未随 commit 入库）**：wiki 报告引用的 `artifacts/sa{3,6,7}-issue393-*.log`
  （21 份）仍为未跟踪文件，未包含在交付 commit 中。仓内两种先例并存（`18c5d8f` 等随 fix
  commit 入库；`c78f808`/`7bea3b1` 等以独立 evidence commit 后补），`.gitignore` 不排斥；
  AC 未强制。建议按 #337 惯例以独立 evidence commit 落盘，使报告引用在克隆后可核。
- **M2（yjs-server 版本未 bump）**：app（published，`0.1.4`）新增公共导出未随票 bump——
  AC 仅强制 NDCL，设计 §13-R7 / SA2 O3 / SA4 O1 三方一致裁定留发布评审（与 NDCL
  0.1.9 vs 0.2.0 的严格 semver 取舍一并定案）。已备案的显式决策，非遗漏。
- **M3（commit message 从简）**：交付 commit 仅单行 subject「fix(diagnostics): self-bind
  file diagnostic logs」，未带 `#393` 引用与 SA3 建议的 P0/P1/P2 + 验证详情正文；仓内 fix
  commit 惯例（`4368aa4`/`d01aa99` 等）多带 issue 引用与详细正文。不影响代码面标准。

## 附：本轮独立复核清单（证据基础）

- **git 实测**：`git rev-parse HEAD` = `9ac5059…`；`git diff dcb3766..9ac5059 --stat` 全量
  21 文件；DENY 路径 `--stat` 空输出；`git status` tracked 干净（仅未跟踪证据 log）；
  `git log` 先例（`18c5d8f`/`4368aa4`/`d01aa99`/`019229c`/`c78f808`）用于惯例对账。
- **diff 逐 hunk**：`file.ts`（+12：接口成员 1 + JSDoc 7 + 产物闭包 4）、`package.json`
  （+1/−1 版本）、`diagnostics.ts`（6 hunk：imports / 三新类型 / 签名+docstring / notify+drop /
  observer / manager-failed——binding/unattributedEmitter/dropStub/ensureAdapter/retire/close
  逻辑零触碰）、`index.ts`（+11：factory + 5 类型导出，与 SA2 O2 列名清单一致）、`app.ts`
  （+4/−1：deps 键名 + 注释；`enabled` 门保持 app 侧）、两 app 测试（仅调用形状 4+8 行，
  零断言改动）、`cordis-host.md`（+53/−1：四要素节 + O1 namespaceId 一致性补句 + 双语义
  边界 + Hub/Peer 示例 + Process 第 5 步交叉引用；示例 `await ctx.plugin(…).await()` 与
  文档自身第 4 步纪律一致；版本指认「0.1.9 or newer」与 bump 对齐）、`SKILL.md`
  （路由行 + frontmatter description 同步）。
- **head 源码**：seam `types.ts:885-903` 签名逐字同形；`diagnostics.ts` 终态 config 消费面
  （rootDir/updateCapture/inputPolicy/retention，无 `enabled` 残留）；导出名零碰撞。
- **grep**：`Object.keys(log` 零命中；`zz-` 零残留；skip/only/todo 零命中；
  `runtimeEmitterFor` 于 memory adapter 零命中（非目标 R5 保持）。
- **证据 log 尾部**：sa3 rerun red-and-typecheck（4/22 绿、4×EXIT 0）、sa3 rerun
  full-suite（396/4752 绿、EXIT 0）、sa6 full-suite 基线（4 failed/15 failed/Type Errors 1）、
  sa7 post-removal（9/77 绿）。
