# SA10 Spec Review — issue #470：Cordis rc.12 双形态 Root tracer bullet 与工件验真

- **Reviewed range**：`279dba4ac81b7c7520e3d0b87b5c4d621a86a517..473f83e9ce1dbf44f46c2156768e36099a35a0a1`；已核 `473f83e` 的 parent 恰为 BASE `279dba4`。
- **Owner 需求账本**：Issue 正文 What to build（`wiki/raw/task_issue-470.md:15-17`）+ **8 条** checklist（`:21-28`）；AC9 只是 SA6 从 What to build 尾句派生的验收项，不是第 9 条 checkbox。`## Comments` 为空，无额外 owner 要求。
- **方法**：只读核对最终 diff、生产/测试源码、SA3/SA4/SA6/SA8 工件及 `.cache/cordis-baselines/{evidence,evidence-base}/**`；独立执行了只读 `git diff`/`git diff --check`/路径核销，**未运行测试、未启动服务、未改被审文件**。

## 1. Verdict

# **reject**

功能主体和三基线设施大部分已忠实交付，但有两项必须在收口前修正；不得以其余绿 cell 抵销：

1. **交付叙述违反最终 I-6.1（明确阻断）**：`wiki/raw/task_issue-470_sa4_review.md:155` 实际写下“`contract 242/242 + root-test 全绿证明无既有 caller 被破坏`”。这与同文件 `:25`、`:181` 的禁止声明及红色现场证据直接矛盾，属于本轮 dispatch 明文规定的“任何一处越界宣称即 reject”。
2. **AC3 按 SA6 验收契约为 partial**：三基线 R5P 确实转绿，但契约 `wiki/raw/task_issue-470_sa6_acceptance_contract.md:334` 的 **(c)“随后 flush 在 deadline 内提交最新 snapshot”** 没有任何直接断言或证据。既有 R5P 只证明 dirty notification、fatal=null、事件序与零 unhandled，不能替代该持久化结果判据。

两项都不是可以静默带入 PR 的 MINOR；第二项也未列入 I-7，不能借“后续票”掩盖本票验收义务。

### 必须修项

- **M1（叙述）**：修正 `task_issue-470_sa4_review.md:155`，不得再把 `root-test` 整体或任何等价面写成全绿/通过/CI 全绿。可改成有边界的“本票相关文件在 root-test 中通过”，并同时保留整体 cell 的红色事实。最终交付摘要必须完整保留本文 §5 的限定披露。
- **M2（AC3 证据）**：在经授权的验收测试内增加可证伪的持久化结果断言：在 dependent/Persistence `UNLOADING` 窗口释放已接纳写后，观察真实 Timer 驱动最新 generation 的 snapshot 提交，且仍满足 shutdown 先于 adapter dispose、零 unhandled；三基线分别留绿证据，并保留 BASE/B3 的目标原因红证据。若新增/修改 Registry 测试文件超出现行 ALLOW，须先修订并复审设计范围；不得只把此项追加到 I-7 后收口。

---

## 2. AC1–AC9 逐条核销

| AC | 判定 | 实现与证据位置 |
|---|---|---|
| **AC1** symbol 优先 / legacy 兜底 / apply 期 loud fail / 无 ambient timer | **满足** | `packages/persistence/src/service.ts:46-89` 仅先读 `Symbol.for('cordis.root')`，仅 nullish/读取归一缺席后读 legacy；`:72-88` 对 malformed 立即稳定 throw；`:106-115` 在 scheduler 创建时完成解析并以 `rootTimer.timeout(...)` 方法调用武装。`memory.ts:233-242`、`file.ts:274-283` 均在 `instance.apply(ctx)`/service provision 前调用。`cordis-root-channel.test.ts:242-414` 实有 symbol 优先级与 legacy 零读取、legacy fallback、malformed symbol/legacy、双缺席、双读取拒绝、timer service 缺失/畸形、未 fire sentinel 不 flush 等断言；三份 `.cache/cordis-baselines/evidence/{B1,B2,B3}/root-probe.json` 均 12/12、exit 0。`evidence-base/red-matrix-summary.json:15-52,107-144,199-237` 证明 BASE 上相关用例实际红，具备证伪力。 |
| **AC2** 三基线 × Memory/File × flush/retry/drain/dispose/service-revoke | **满足** | `cordis-root-real-timer.test.ts:54-88` 在任何 TimerService 构造前 instrument 真实 prototype；`:268-480` 两个 adapter 各五场景，含真实 arm、degraded→ready、最新 generation、drain 后零新增写、dispose pending=0、service revoke 与零 unhandled。`.cache/.../evidence/B1/real-timer.json:39-77`、`B2/real-timer.json:39-77`、`B3/real-timer.json:39-77` 均为 **10/10 × 3 次顺序运行、每次 exit 0**，realpath 分别钉在对应 overlay。BASE/B3 曾 0/10 红（`evidence-base/red-matrix-summary.json:251-261`），不是不可证伪的绿。File retry 的 POSIX rename 限定已在 SA3 `:240` 明示。 |
| **AC3** UNLOADING 窗口 dirty notification / adapter 只在既有边界后释放 / 生命周期不变 | **partial（M2）** | 正向部分：R5P 源码 `packages/namespace-registry/test/registry-sa7-rev1.test.ts:396-500` 用 gate 拉开窗口，`:462-471` 断言 fiber=UNLOADING、写 `{ok:true}`、fatal=null，`:481-500` 断言 shutdown 严格先于 adapter dispose 与零 unhandled。`.cache/.../evidence/{B1,B2,B3}/unload.json` 均 6/6、`r5p.present=true`、`r5p.passed=true`；BASE/B3 的 R5P 红见 `evidence-base/red-matrix-summary.json:284-296`。生产 `bindPersistenceAdapterLifecycle` 的有序 effect 未改。**缺口**：R5P 全文没有 writeSnapshot/store/snapshot 内容或 flush deadline 断言；`run-baseline.mjs:556-562` 只检查测试名存在和 cell 绿。AC2 的普通 flush 不能证明“该 UNLOADING 窗口内接纳的写随后提交最新 snapshot”，故 SA6 AC3(c) 未核销。 |
| **AC4** 精确 commit、source-built/provenance、测试开始解析路径断言 | **满足** | `baselines.json:3-5,68-104` 钉死 DSH commit 与三包来源；`acquire.mjs:193-227` 每轮核 HEAD/clean/ls-tree，`:257-318` source-build，`:370-454` 复核 blob/output hash 后物化 overlay。`cordis-baseline-provenance.test.ts:134-198` 先执行双位置 realpath、版本、唯一 Cordis、integrity 断言，`:206-282` 执行 B3 commit/clean、32-blob 全表、配方/诚实标注、实际 overlay 输出哈希。`.cache/.../evidence/B3/provenance.json:11-55` 为 **8/8、exit 0**；B1/B2 各 4/4。`provenance-b3.json:16-77` 记录命令、Node/TS 与每包配方，`:22` 明写非官方 DSH 流水线。 |
| **AC5** npm=legacy / rc.12=symbol；回退、同名替换、通道错配必失败 | **满足（含已披露的负控形态限定）** | 独立 `root-probe.mjs:82-187` 不 import production seam，逐项比较精确期望。`B1/root-probe.json:48-69` 与 `B2/root-probe.json:48-69` 均 legacy 命中、symbol/static 缺席；`B3/root-probe.json:48-69` 为 symbol=root、legacy 缺席、`Context.root===Symbol.for('cordis.root')`、fiber legacy 抛既有 proxy 文案。四负控均落盘且 `{expected:fail, observed:fail, code:1, status:pass}`：`evidence/B3/fault-fallback.json`、`B3/fault-substitute-npm.json`、`B2/fault-substitute-rc12.json`、`B3/fault-legacy-shim.json`；`evidence/negative-controls-r1.json:18-184` 记录四次外层 exit 0 与具体判红点。**限定**：substitute-rc12 的 root-probe 在装载期缺 cosmokit 即红，通道级“实得 symbol”不可达；替换仍由 provenance realpath 响亮检出（见该汇总 `:121-154`），满足 AC5 的失败义务，但不能宣称该负控另外证明了通道级判红。 |
| **AC6** 每基线全仓 typecheck + contract/真实 Timer/DSH profile；不得抵销 | **满足，表述必须限定于 owner 点名族** | `run-baseline.mjs:635-664` 从根 `scripts.typecheck` 动态取 project 清单并逐个 `tsc -p`，不是子集。`.cache/.../evidence/{B1,B2,B3}/typecheck.json` 均 **15/15、每 project exit 0**；B3 现场日志 `evidence/B3/**typecheck*.log` 无 `TS2576`/`error TS`，而 `evidence-base/B3/B3-typecheck-packages_ws-replication_tsconfig_json.log:1-13` 留有所需 13 个目标 TS2576（含跨 project 重复不计作新位置），红→绿成立。行为侧：contract = **242/242、242/242、246/246**（`matrix/matrix.json:489-502,1193-1206,1905-1918`）；real-timer 各 10/10×3；dsh-profile 各 12/12；unload 各 6/6。聚合仍 `root-test=fail`（`matrix.json:2286-2297`），未以这些绿抵销任何红。**不得**由此写成“根 test/CI/所有既有 DSH 相关测试全绿”；广义 DSH 相邻测试只有在 packageManager 对齐复跑下才可称绿。 |
| **AC7** 不新增公共生产 API；兼容不扩散到 Persistence 核心或 Registry | **满足** | 最终产品面恰 6 修改 + 11 新增；生产只改 `persistence/src/service.ts` 与裁决要求的 `ws-replication/src/plugin.ts`。Persistence `index/contract/lifecycle/memory/file/testing`、Registry src、Replication 状态机均零 diff。`cordis-public-surface.test.ts:21-42` 对 persistence、`/testing`、dsh、ws 四 entry 做运行时名集合快照；`evidence/gates/gates.json:11-20` 记录 G1′–G9 全过。SA10 独立 `git diff BASE..HEAD` 复核两 `src/index.ts`、docs/configs 均零 diff。cast/Reflect 仅两个 Host 接线叶子；probe 仅在 test/fixtures。 |
| **AC8** 依赖范围/归属、历史 artifacts、部署与 patch 边界 | **满足** | 最终 range 中根/全部 workspace manifests、`pnpm-lock.yaml`、`artifacts/` 均零 diff；SA10 独立检查亦为 zero-diff，`git diff --check BASE..HEAD` clean，当前 `git status --porcelain -- artifacts/` 为空。`acquire.mjs` 只用 Node/git/registry GET；runner 没有部署、MABF 或 patch 移除调用。`root-test` 的只读 `pnpm --version` 诊断（`run-baseline.mjs:715-733`）不是部署/依赖变更；其相对设计白名单的 cosmetic 偏差不构成 owner AC8 违反。 |
| **AC9（derived）** Host 不需要新增配置或条件装配 | **满足** | 来源原句是 `task_issue-470.md:17`：**“Host 不需要新增配置或条件装配”**。两插件 signatures/options 与 DSH profile 文件零 diff；生产无 env/baseline/feature-flag/条件 import 分支。`cordis-root-channel.test.ts:419-438` 在三基线 root-probe cell 均以既有公开 Memory factory 完成 boot+saveDoc+flush；File 与 DSH profile 由 AC2/AC6 三基线 cell 覆盖，传入的都是既有 `rootDir`/schedule/adapter 等选项，没有 Root/channel/baseline 参数。G8 机械结果见 `evidence/gates/gates.json:18`。 |

### What to build 其余原句

- “同一个公开发布插件”由 Memory/File 公共 factory 的源码入口在三基线执行同一组真实 Timer 行为来承载；没有另写 Host 专用插件或条件装配。
- “建立后续 Replication 与发布收官可复用的工件身份和 Root 通道验真能力”已有真实、tracked 载体：`acquire.mjs`、`run-baseline.mjs`、`root-probe.mjs`、两份钉值 JSON 与四负控。后续票可复用/扩展这些入口；这**只证明设施可复用**，不证明 Replication 行为或发布收官已经完成。
- Issue `Blocked by: None` 仍成立：实现与验真设施均已在仓内落地，没有新增上游阻塞；本报告的 M1/M2 是本交付自身的叙述/证据缺口，不是外部 blocker。

---

## 3. ADR 0035 与交叉 ADR 逐条核销

| 条款 | 判定 | 证据 / 边界 |
|---|---|---|
| **§1 双形态与固定目标矩阵** | **落实** | 同一生产 seam 同时保留 symbol/legacy；B1/B2/B3 定义与实际 realpath/probe 相符。未把其他 Cordis/Timer 或后续 DSH master 写成已支持。 |
| **§2 两包各自私有缝；symbol 优先；不新增公共 export；cast 不扩散；现行 fixture 统一迁移** | **落实** | `service.ts:37-115` 与 `plugin.ts:206-297` 是两份包内私有实现；ws 保留 `timer.ctx → ctx` host 级联。最终 diff 中 ws 仅 `plugin.ts` + 恰好 4 个具名 fixture；原 10 处 Cordis `ctx.root` 读取均消失。测试里的 `ctx.rootValue`/`ctx.root('hub',…)` 是无关 harness helper，未误改。AC7 的四 entry 快照与零 diff gate 证明公共面未扩张；Registry/Persistence 核心/Replication 状态机无兼容 cast。 |
| **§3 调度所有权与停机语义不变；不得假定 Timer 自动最后释放** | **落实（但不补掉 AC3(c) 的证据缺口）** | 两处均捕获 rootTimer 对象并以方法调用保持 TimerService `this`；没有新增对上游 Clock/Timer/Registry/Persistence 的销毁调用。`service.ts:11-17` 仍明写 Host 必须先装 timer、后停 persistence；`bindPersistenceAdapterLifecycle` 的 service revoke → dependent settle → adapter dispose 代码未改。R5P 三基线绿支撑既有窗口和次序；最新 snapshot 的契约证据仍按 M2 补齐。 |
| **§4 依赖 range/归属与公共契约不变** | **落实** | 所有 manifests/lock 零 diff；未提升 `^4.0.1`/`^1.1.3`，未改 dependency/peerDependency。Namespace/Registry/Replication/Persistence/Instance/Clock 公共 entry 无新增 export；无 volatile config、私有 Fiber store 或无关 Cordis 能力读取。 |
| **§5 每基线全仓 typecheck + 同组外部行为；精确夹具/解析断言/探针/反掩蔽** | **落实本票 tracer slice；发布级剩余项明示出界** | 三基线各 15-project 与六套同组 suite 有独立证据；`--all --matrix` 在任一 cell 红时 exit 1（`run-baseline.mjs:798-827`）。B3 commit/source-build/输出身份、双位置解析、通道探针、fallback/substitute/legacy-shim 失败均落实，未使用旧 rc.3 POC。行为清单中 Memory/File、Registry shutdown、DSH profile、guard-Proxy 有本票证据；**Replication 三基线 Hub/Peer/SessionHost 行为、`apps/yjs-server` 组合根行为及发布收官不属本票**（R3/O7），不得宣称完成。生产构建/发布检查没有被改写成已绿，也不存在发布认证声明。 |
| **§6 不部署、不移 patch、不宣称 Host 可删 patch** | **落实** | diff/命令面无真实 MABF/DSH 部署、无 patchedDependencies 修改、无“可删 patch”声明。真实 Host 部署结果仍未验证，且这是 ADR 明示排除而非本票缺漏。 |

交叉 ADR：

- **ADR 0006**：root-bound timer、saveDoc=dirty notification、drain/dispose 分工未被改写；AC2 的 retry/drain/dispose 与 AC3 的 unload 窗口均有行为锚，唯 SA6 AC3(c) 需 M2。
- **ADR 0009**：有序 disposer 和 Registry→Persistence 次序未被修改，R5P 的事件序断言在三基线通过。
- **ADR 0012**：ws plugin 仍只拥有自身 listener/dialer/controller/连接/service；没有销毁上游资源。
- **ADR 0023**：两个冻结服务的 getter+freeze 构造代码未动；guard-proxy 测试只改 `dependencies()`，原断言面保留，`.cache/.../evidence/B1/ws-package.json:76-77,88-137` 证明 guard-proxy 2/2 且四 fixture 合计 66/66。

---

## 4. I-6 七条最终限定声明逐条审查

以 `wiki/raw/task_issue-470_impl_conflict_report.md:296-304` 的 **iteration-2 最终版**为准，不采用文中保留的 iteration-1 owner 前置旧口径。

| # | 判定 | 核销 |
|---|---|---|
| **1. 不得声称根 test/默认全量/既有测试/CI 全绿** | **违反（M1）** | `task_issue-470_sa4_review.md:155` 的“root-test 全绿证明……”是无边界实际宣称；不能用同文件其他位置的禁止句抵销。SA3 主体和 SA8 iteration-2 的表述本身保持红色口径，但交付包中任一文件越界即足够 reject。 |
| **2. 写明 32 = 28 环境 + 4 既有及机制** | **满足** | SA3 `:5`、`:210-234` 与 SA8 I-6.2 均写明。`evidence/root-test/root-test.json:5955-5969` 为 exit 1、5880/5912/32，pnpmProbe 记录当前 11.28.5 与声明 10.28.2 冲突；`root-test.log:1426-1463` 给出 4 个 `Expected 1 arguments, but got 0`。 |
| **3. BASE 等量复现落盘** | **满足** | `.cache/cordis-baselines/evidence-base/base-repro/base-root-test-repro-summary.json:1-22` 钉 BASE/工具链，`:23-151` 四族合计 32 failed/52 passed/84 total，`:153-284` 九文件与矩阵逐项 `allEqual:true`；并诚实标注 per-family、非单次全量。 |
| **4. 对齐环境完整复跑 + CI test-d lane 既有性** | **满足** | `evidence/root-test/root-test-pnpm10282.json:1-40` 记录单次完整全量 **5912 total / 5908 passed / 4 failed**；`:41-167,201-206` 证明八环境文件 76/76 转绿、4 例 test-d 不受 shim 影响。`impl_conflict_report.md:274-279` 另记录按 `.github/workflows/ci.yml:43-44` 的 test-d typecheck lane 在未改动布局复现为 4 failed/4 passed；本 SA10 未重跑测试，仅核对该第一手记录与现场 JSON。 |
| **5. 显式标注设计 §17-3 阻断字面语义与带红收口依据；4 例另立票** | **满足最终口径，但必须进入 PR 摘要** | 设计 `:568-573` 明写 root-test 任一红即交付阻断。SA8 iteration-2 `impl_conflict_report.md:281-302` 最终裁定：AC6 文义满足、AGENTS 是执行+如实上报义务、§17-3 属设计自设规则且其事实前提被 BASE 既有性证伪；可带红收口而无需 owner 前置，owner 若另表态则从其裁定。I-7 `:310` 把 4 例修复另立票。此口径不能回退成 iteration-1 的“已获 owner 接受”——Issue 实际无评论。 |
| **6. AC6 表述限定** | **满足，继续约束最终摘要** | 可声称的是三基线 15-project typecheck 与 contract/real-timer/dsh-profile/unload 点名族绿；不可概括为根 test/CI 全绿。默认矩阵中 7 个 DSH 相邻探针用例属 28 环境红；只有对齐环境的完整复跑可支撑更广 DSH 相关绿色表述。 |
| **7. 三套证据并存、不得覆盖；矩阵 cell 保持 fail/exit 1** | **满足** | 现场同时存在 `root-test.matrix-run-2026-11-14T2311.{json,log,vitest.json}`、R-4 再生 `root-test.{json,log,vitest.json}`、`root-test-pnpm10282.{json,log,vitest.json}`。原矩阵 JSON `:4-13` 与 R-4 JSON `:2-5,5955-5960` 均保持 fail/32，未被对齐复跑覆盖。 |

---

## 5. 必须带入交付摘要/PR 的限定事实（不是放行宣称）

1. **默认矩阵 root-test 仍为红**：5880 passed / 5912 total / **32 failed = 28 环境 + 4 既有**。28 来自环境 pnpm/corepack 11.28.5 违反仓库 `packageManager: pnpm@10.28.2`，使相关子进程失败；4 来自未改的 `packages/ws-replication/test/ws-replication-issue421-edge-factory-api.test-d.ts` 可选参数元组断言与 expect-type@1.4.0（vitest 3.2.7）不兼容，错误为 `Expected 1 arguments, but got 0`。
2. **BASE 证据**：`evidence-base/base-repro/**` 在 BASE 279dba4 上以四次逐族命令复现同 32 例（32/52/84，9/9 文件相等）；不是单次 BASE 全量。
3. **对齐环境证据**：`evidence/root-test/root-test-pnpm10282.*` 是单次完整全量 **5912/5908/4**；八环境文件 76/76 绿，4 例 test-d 仍红。该 4 例在 CI 自身 test-d lane 的未改动布局也有 4 failed/4 passed 的第一手记录。三套 root-test 证据并存，矩阵 cell 仍 fail/exit 1。
4. **设计阻断与裁定**：该红 cell 触发设计 §17-3 字面阻断；带红收口依据只能是 SA8 iteration-2 I-5.2 的最终裁定及完整披露，不能伪称 owner 已批准（Issue 无评论）。4 例修复另立票，因为改断言/工具链均越出本票 ALLOW/G1′/G3，并需保护 issue #421 冻结面。
5. **AC6 只可写点名族全绿**；任何“现有 DSH 相关测试”总括必须附“packageManager 对齐环境下”。不得写根 test、默认布局全量、既有测试或 CI 全绿。
6. **本 SA10 另发现 M2**：即使上述 root-test 限定全部照写，也仍须补齐 SA6 AC3(c) 的最新 snapshot 提交证据后才能 spec approve。

---

## 6. 未处理项、后续票边界与 scope creep

### I-7 六项边界

| I-7 项 | 是否可合法留后续票 | 审查 |
|---|---|---|
| 4 例 test-d 修复 | **是** | BASE/CI lane 既有，本票文件与工具链零 diff；修复面在 ALLOW 外，已给后续修复选择及复绿要求。 |
| Replication 三基线行为矩阵 + `apps/yjs-server` 行为 | **是** | R3/O7 明确只延后行为验收；本票仍完成 ws 编译面、私有 seam 与 B1 66/66 门禁。不得把“可复用设施”写成这些行为已验证。 |
| memory/file 注释仍写 `ctx.timeout` | **是** | 失实注释由 SA3 `:242` 明示；本票为守 AC7 byte-identical 未修。后续文档票应改为 root 通道语义。 |
| ADR 0035 状态仍“提议” | **是** | 本票没有改 ADR 追认实现；状态更新归实施/发布收官，符合 SA6 §17.8。 |
| substitute-rc12 通道级判红加固 | **是，可选** | 当前 provenance realpath 已使同名替换失败，AC5 义务满足；后续只可被描述为让通道级判红可达的加固，不能说当前替换未检出。 |
| issue299 未使用 helper / 死代码 | **是，cosmetic** | 无行为或公共面影响；guard-proxy 的同类 helper 已删并复跑 66/66。 |

### 完整性结论

- **I-7 不覆盖 M2**：SA6 AC3(c) 是本票判据，不在上述后续票中，也不得新塞入后续票以规避 reject。
- root-test 的 28 例是环境准备问题，已通过完整对齐复跑闭合，不需要伪造成产品后续票；4 例既有红已明确归后续票。
- 除 M2 外，未发现 Issue What to build/8 checkbox 的另一项未交付面；工件身份和 Root 验真设施确有可复用入口，但其复用不等于未来行为验收已完成。
- **无 scope creep**：ws-replication 的 1 生产文件 + 4 fixture 是 R2 的强制范围，不是 Replication 行为扩张；没有修改依赖、公共 API、历史 artifacts、ADR，没有真实部署/patch 移除，也没有宣称 Replication 已 rc.12 行为兼容。
- SA4 `:155` 是交付叙述越界，不是代码 scope 授权；必须修正文案，而不能靠删除红色证据或改矩阵状态解决。

## 7. 最终结论

**reject**。M1 是 dispatch 明文规定的必拒叙述问题；M2 是关键 AC3 契约的未闭合证据面。修完这两项并保留全部既有红/绿证据后，方具备重新 spec 核销的条件。本评审不否定 AC1、AC2、AC4–AC9 已取得的实现与证据，也不把 root-test 红误算成 owner AC6 红；但当前交付不能无保留通过。
