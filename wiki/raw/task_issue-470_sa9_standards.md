# SA9 Standards Review — issue #470（最终交付）

- Dispatch：`sa-ca1b2d68-091e-4e1a-b84b-650477093320`，phase = standards-review，iteration 0。
- Reviewed subject：commit `473f83e9ce1dbf44f46c2156768e36099a35a0a1`；base/parent = `279dba4ac81b7c7520e3d0b87b5c4d621a86a517`（PR #469 head）。
- 范围：`git diff 279dba4..473f83e`，产品面恰为 **6 修改 + 11 新增**；另有 10 个 `wiki/raw/task_issue-470*.md` MABF 证据文件。工作树产品文件与 commit 一致；审查开始时仅有 Controller 后续更新的 `wiki/raw/task_issue-470_dispatch.md` 未提交修改，不纳入本 commit verdict。
- 方法：逐行审查两处生产 seam、4 个迁移 fixture、4 个新测试与 7 个 fixture 文件；对照根/模块 AGENTS、CONTEXT、ADR 0035/0006/0009/0012/0023 与 SA6/SA8/SA1/SA2/SA3/SA4 证据链；执行只读 git 范围、whitespace、worktree/ignore/status 检查，并读取已有 `.cache` 证据。**本轮未把既有测试证据冒充为本轮重跑证据。**

## Verdict

**approve — 0 BLOCKER / 0 MAJOR / 4 MINOR。**

两处生产 seam 的包边界、私有导出、Root 解析与生命周期所有权符合 ADR 0035 和模块 AGENTS；新增测试/fixture 的发现、类型扫描隔离、确定性与证据落盘符合本票已批准测试纪律；`docs/**`、`CONTEXT.md`、协议、manifest/lock、artifacts、tsconfig/vitest.config、版本/release 面均为零 diff。4 项 MINOR 都是验收工具的健壮性/卫生问题，不改变已交付产品行为，也未在当前仓库形成 tracked/index/worktree 残留；最小修法见 §6。交付叙述必须遵守 §8，尤其 SA8 iteration-2 的 I-6 七条限定，不得声称根 test 全绿。

## 1. 代码标准与所有权 — 通过

### 1.1 两个 seam 均在既有 Host 接线叶子，未新增公共 export

- Persistence：`packages/persistence/src/service.ts:37-89` 将 Root 解析全部收在该 Cordis wiring leaf；`:106-115` 的既有 `createCordisPersistenceScheduler` 在 apply 同步段解析一次并捕获 `rootTimer` 对象，`:113` 以 `rootTimer.timeout(callback, delayMs)` 方法调用武装，未 detach。`assertPersistenceHostDependencies`（`:26-35`）与既有 adapter 直连路径未被塞入 Root 前置条件。
- ws-replication：`packages/ws-replication/src/plugin.ts:206-254` 为包内私有同规实现；`:256-297` 保留 `timer.ctx → ctx` host 级联及 `OwnedTimer` 所有权，`:279-296` 仍是对象引用 + 方法调用 + 既有 disposer 集合，未创建/销毁上游 Registry、Persistence、Clock 或 Timer，符合 `packages/ws-replication/AGENTS.md:16,23` 与 ADR 0012:5,33-37。
- 两包的私有 helper 均未 export；`packages/persistence/src/index.ts:1-60` 与 `packages/ws-replication/src/index.ts:1-110` 相对 base 零 diff。`cordis-public-surface.test.ts:21-40` 对 persistence、`/testing`、dsh-persistence、ws-replication 四 entry 做 runtime 名集合快照，`public-surface.base.json:1-70` 未增加名字。符合 ADR 0035:45-56 与两包 AGENTS 的导出纪律。
- Persistence 核心、Registry、DSH、Replication 状态机没有兼容逻辑扩散；实际 diff 仅有允许的 `service.ts`、`plugin.ts` 与 4 个具名 fixture。`service.ts:6-18` 的模块 DAG 注释仍明确该叶子的地位。
- ADR 0023 冻结面未动：`plugin.ts` 的服务对象构造不在 diff hunk 内；`ws-replication-guard-proxy-consumption.test.ts` 净 diff 仅 `dependencies()` 的 timer shim，guard-Proxy 断言保持原样。已有证据 `.cache/cordis-baselines/evidence/B1/ws-package.json:76-77,88-92` 记录两条 guard-proxy 用例及总计 66/66 通过。

### 1.2 `Reflect.get` / cast 位置与错误文案合格

- 生产 `Reflect.get` 仅见两个叶子的 `safeReadChannel`：`service.ts:64-70`、`plugin.ts:229-235`；try/catch 只包单次读取，形状断言在 catch 外。窄 cast 仅在 `service.ts:72-77`、`plugin.ts:237-242` 的 `RootTimerSource` 形状收窄及既有 timer disposer 边界，没有 `as any`、生产 `as never`、`@ts-ignore` 或 `@ts-expect-error` 扩散。
- fixture/probe 中的 `Reflect.get` 是 ADR 0035:58 明确要求的现行 Host fixture 迁移及独立运行时探针，不是生产兼容逻辑外溢。`as never` 只用于 `ctx.provide('timer', …)` 的本地 fake service/故意畸形 service 注入（如 `ws-replication-plugin.test.ts:29-36`、`cordis-root-channel.test.ts:209,380`）；对象含测试专用 `ctx` shim 或刻意不满足完整 TimerService 类型，cast 必要、局部，且沿用同目录既有测试注入惯例，不属于生产类型掩蔽。
- Persistence 新错误为单一稳定句子，常量在 `service.ts:47-49`，所有 Root 缺席/畸形路径共用 `throwRootTimerUnavailable`（`:56-58`）。ws 两条既有文案在 `plugin.ts:224-226,261-263` 逐字保留。既有 `packages/persistence/test/core-dsh-boundary.test.ts:71` 的 timer-service regex 与新 Root 文案不相交。
- 符号优先、仅 nullish 时读 legacy、malformed 不跨通道/host 回落、双通道均缺席时同步 throw 的结构分别见 `service.ts:79-89,106-113` 与 `plugin.ts:244-253,269-271`；无 ambient timer 或新增配置分支。调度/dispose 所有权与 ADR 0006:86、ADR 0009:99-103、ADR 0035:60-70 保持一致。

## 2. 测试标准 — 通过（无 skip/only/降级；时序纪律见下）

- **位置与发现**：4 个新文件均位于 `packages/persistence/test/cordis-*.test.ts`，匹配 `vitest.config.ts:14-21` 的 `packages/*/test/**/*.test.ts`；4 个迁移 fixture 仍在 ws-replication/test 原位。contract suite 通过 `run-baseline.mjs:500-510` 动态枚举 `.test.ts`，不是硬编码数量。
- **非空测试纪律**：统一 `runVitest` 在 `run-baseline.mjs:389-399` 注入 `--passWithNoTests=false`；`:513-518` 先检查目标文件存在，`:561-562` 要求每次 run `counts.failed === 0` 且 `counts.total > 0`，ws-package 还在 `:607-629` 逐文件执行并检查非空。root-test 是例外形态：`:685-695` 运行与根 `scripts.test` 等价的全仓发现命令，不冒充定向文件 suite；已有全量证据为 486 files/5912 tests，不存在空路径假绿，且 G9 冻结发现配置。该例外与已批准设计 §8.6 一致，不是 skip/降级。
- **无 skip/only/todo**：4 个新测试及 4 个迁移 fixture 没有 `.skip`、`.only`、`.todo` 或断言删除。`cordis-baseline-provenance.test.ts:202-206` 的 `b3Suite?.(...)` 是 B3 专属 suite 的条件注册；默认布局是 B1，B3 cell 内全部 8 条均注册执行，并非在 B3 中 skip。
- **真实等待而非固定轮数 settle**：正等待均为可观察谓词 + wall-clock deadline（`cordis-root-channel.test.ts:180-187`、`cordis-root-real-timer.test.ts:111-118`）。`createRootTimerProbe.fireAll` 的 100 次 guard（channel `:78-85`）是失控上界，达到上界会 throw，不是固定轮数后宣布异步工作完成。real-timer runner 顺序跑 3 次且任一失败即红（`run-baseline.mjs:538-548,561-562`）。
- **`delay` 的用途不是猜正向完成时序**：channel `:405-410` 在 sentinel 未 fire 时验证超过 debounce 仍零写，再显式 fire 并以 deadline 等 flush；real-timer `:319-324,427-432` 在 drain 已返回后验证 stale timer 静默窗，`:334-339,442-447` 在 dispose 已返回后验证零新写。它们都是负向 quiescence 断言，不以 sleep 代替对目标完成的等待。真实 Timer 正路径均由 deadline 谓词锚定。
- **确定性与清理**：真实 Timer meter 在 `cordis-root-real-timer.test.ts:54-88` 于任何 TimerService 构造前 patch/恢复；临时 File 根目录在 `:203-207,262-264` 登记并清理；unhandled rejection listener 在 `:348-371,456-478` 对称移除。文件 retry 的 POSIX rename 依赖已明示，非 POSIX 不允许 skip。
- **证据路径**：runner 的 `EVIDENCE` 在 `run-baseline.mjs:42-44` 固定为 `.cache/cordis-baselines/evidence`，`writeEvidence`（`:478-483`）只写该树；G5 临时脚本也在 `.cache`（`gates.mjs:239-241`）。根 `.gitignore:18` 覆盖 `.cache/`，`git check-ignore` 本轮实测命中。没有向 tracked `artifacts/` 写证据。
- **`.mjs` 隔离类型扫描**：4 个可执行 fixture 均为 `.mjs`，3 个数据 fixture 为 `.json`；`packages/persistence/tsconfig.json:1-4` 仅 include `src/**/*.ts` 与 `test/**/*.ts`，所以这些脚本不会被 persistence typecheck 当作 TS 输入，也不匹配 vitest 的 `*.test.ts` 收集规则。

## 3. 机械 gate 与 runner 仓库纪律 — 基本通过，附 S9-M1/M2/M3

- G1′/G2/G3/G4/G7/G9 通过 `gates.mjs:109-139,383-410` 对 base + 当前工作树和未忽略 untracked 文件做范围检查；G5 默认模式不写 tracked 快照，只有显式 `--write-surface-snapshot` 才写（`:324-342`）。acquire 的 `--write-provenance` 同样是显式维护模式，不是默认 gate 的隐式写。
- G5 worktree 位置正确：`gates.mjs:41-44` 固定 `.worktrees/base-snapshot`，`:213-225` 预检并 `git worktree add --detach`，符合根 `AGENTS.md:45-47` 与 `.agents/WORKTREES.md:3-17`，未在 `/tmp` 或仓外建 worktree。`:259-267` 有 finally 清理；当前 `git worktree list --porcelain` 只有主仓和本任务 worktree，无 base-snapshot 残留。已有 `.cache/cordis-baselines/evidence/gates/gates.log:1-13` 也记录 G5 与 9/9 PASS。清理失败时仍可 PASS 的缺口单列为 S9-M1。
- 默认 gates 不是字面意义上的“零系统写”：G5 会短暂改变 git worktree 元数据并写 ignored `.cache/g5-capture.mjs`，随后移除 worktree；但没有默认 tracked/index 写入，当前 status/index 检查未见产品面残留。`--write-*` 维护模式必须在交付说明中与默认只读核验区分。
- runner 的基线获取不使用裸 npm/pnpm：`acquire.mjs:126-155` 使用带 60 秒 timeout 的 HTTPS fetch + 固定 sha512，`:193-212` 固定 DSH commit/clean，`:370-454` 重建并校验 provenance/output hash；任何失败响亮中止，未回退到仓库默认工件。workspace 的 tsc/vitest 都由 `run-baseline.mjs:46-48,383-447` 直接调 node 本地二进制。
- 但 root-test 后有一次裸 `pnpm --version` 诊断（`run-baseline.mjs:715-717`），与文件头“no bare pnpm/npm”（`:16`）字面不一致。它只写 diagnostics（`:729-732`），不决定 cell 状态、不安装依赖、不选择工件、不构成降级；因此列 MINOR S9-M2，而非把整条验收链判为失控。
- G6 的 whitespace gate 在最终已提交形态下存在覆盖面盲点（S9-M3）：`gates.mjs:369-380` 运行的是无 base 的 `git diff --check`，只检查当前工作树相对 index/HEAD；commit 后产品工作树干净时不会检查 `base..HEAD` 的交付 hunks。本轮独立执行 `git diff --check 279dba4..473f83e` 已通过，故无实际 whitespace 缺陷，也不构成阻断。

## 4. 文档、术语与 wiki 职责 — 通过

- `git diff --name-only 279dba4..473f83e -- docs CONTEXT.md docs/protocols/instance-replication-v1.md` 为空；`docs/AGENTS.md:5` 所述规范文档未被改动。协议零 diff，ws-replication 改动仅限 Host timer 解析，不触 wire/FSM。
- ADR 0035 仍保持原状态（`docs/adr/0035-cordis-rc12-root-compatibility.md:5`），未被本票越权改为 accepted/implemented；其实施状态更新按上游 I-7 留待收官。CONTEXT 无需新增术语，也未修改。
- commit subject `feat(persistence): Cordis rc.12 双形态 Root tracer bullet 与三基线工件验真 (#470)` 符合仓库近期 `feat/fix/docs/chore(scope): …` 惯例；正文只声明 seam、fixture 与验真设施，没有“全测试通过”“Replication 行为已兼容”“可删除 Host patch”等越权表述。
- 10 个 wiki 文件均为任务 brief/dispatch/SA6/SA8/设计/SA2/SA3/SA4 证据，标题和正文明确角色与迭代，不位于 `docs/**`，未冒充 ADR、协议或 CONTEXT 的规范来源。`docs/AGENTS.md:5` 明确 `wiki/raw/` 是 evidence；本票文档链也始终以 ADR 0035 为 normative。

## 5. 工程完整性 — 通过

- 下列只读 diff 均为空：`pnpm-lock.yaml`、根及全部 `packages/*/package.json`、`apps/*/package.json`、`domains/*/package.json`、`artifacts/**`、`scripts/**`、`.github/**`、全部 tsconfig/tsconfig.build/vitest.config、两包 `src/index.ts`。`package.json:6` 的 packageManager、各包 version/release metadata 与 release scripts 均未动。
- 没有新增/修改 generated artifacts、schema、持久化布局、public package entry、依赖 range 或 dependency/peerDependency 归属；`baselines.json`/`provenance-b3.json` 是测试验真数据，不是发布清单。
- 新测试均带用途/契约头注释；4 个 `.mjs` 带 shebang + 职责/失败语义头注释（如 `acquire.mjs:1-18`、`gates.mjs:1-32`），JSON 按同目录数据文件惯例不加头注释。仓库同层源码和 `scripts/*.mjs` 并不要求逐文件 licence 头，故无遗漏 licence/头注释问题。
- 产品新增/修改路径与批准 ALLOW 完全一致，无 marker、`.gitignore`、部署或 Host patch 改动。`git diff --check 279dba4..473f83e` 本轮通过。

## 6. MINOR findings 与最小修法

### S9-M1（MINOR）— G5 清理失败只警告，仍可能以 PASS 留下 worktree

- **证据**：`gates.mjs:259-266` 在 finally 中调用 `worktree remove`，但 catch 仅 `console.error(...WARN...)`；`gateG5` 随后仍可返回 pass（`:324-342`），main 也可打印全绿（`:411-420`）。因此“正常路径已清理”成立，但“任何结果都不会残留”不成立。下一次运行会由 `:213-220` 的陈旧 worktree 预检响亮失败，限制了影响；当前实际也无残留，故评 MINOR 而非 MAJOR。
- **最小修法**：记录 cleanup error，在原始 capture 完成/失败后都让 G5 返回 `ok:false` 或以 exit 2 中止；清理后再检查 `git worktree list --porcelain` 不含 `BASE_WORKTREE`。不能用 WARN 替代非零结果。

### S9-M2（MINOR）— runner 仍有一次裸 pnpm 诊断，文件头声明过宽

- **证据**：`run-baseline.mjs:16` 声称 `no bare pnpm/npm`，`:717` 却 `spawnSync('pnpm', ['--version'])`。该调用仅是诊断，不参与 gate/工件选择；真实获取与执行链没有裸 pnpm 降级，故不阻断。
- **最小修法**：优先把该探针移出 runner，由验收现场单独记录；若必须保留，改为显式受控的 `corepack pnpm@10.28.2 --version` 并把输出标为诊断，同时把头部声明改成准确的“test/acquire 执行不依赖裸 pnpm/npm”。交付说明不得宣称“runner 全链路零裸 pnpm”。

### S9-M3（MINOR）— G6 在 commit 后不检查交付 diff 的 whitespace

- **证据**：`gates.mjs:372` 为 `git(['diff', '--check'])`，缺少 `BASE`；与 `changedPaths` 在 `:109-117` 已采用 base-aware 比较不一致。最终 commit 干净工作树下该命令可为空，即使交付 hunk 自身有 whitespace error。
- **最小修法**：改为 `git(['diff', '--check', BASE])`（覆盖 base→当前工作树，含已提交与未提交改动），保留现有 artifacts status 检查。当前交付已由本轮 base-range 检查独立证明无实际问题。

### S9-M4（MINOR）— 局部死代码/死路径，不影响 canonical matrix

- **证据**：
  - `packages/ws-replication/test/ws-replication-issue299-ac-red.test.ts:170-173` 的 `resolveRootForTest` 只有定义、零调用；同文件 shim 已统一走 symbol，保留 helper 无用途。
  - `run-baseline.mjs:62-64` 的 `WS_ALLOW`/`PERSISTENCE_ALLOW`/`ALLOW` 均只定义不读；`:384,400` 的 `repeat` 解构后仅 `void repeat`；`:130` 的 `options.matrix` 只写不读。
  - `run-baseline.mjs:139` 接受 `--suite gates`，但 `runSuite` 在 `:522-633` 没有 gates 分支，最终 `:632` 必然 `unsupported suite`；canonical matrix 使用独立 `runGatesCell`（`:667-683,812-814`），不受影响。
  - `acquire.mjs:460` 的 `writeSurface: false` 从未读取。
- **最小修法**：删除未使用 helper/常量/参数/字段；`--matrix` 要么与 `--all` 强制绑定并在其他组合中报 usage，要么不作为独立状态保存；从 `--suite` 可选集合删除 `gates`，或在不 materialize baseline 的独立入口直接调用 `runGatesCell`。死代码无需本票功能修复，但不应在后续总结中声称“零死代码”。

## 7. 六项逐项总账

| 审查项 | 结论 | 关键证据 / 关联 finding |
|---|---|---|
| 1. 代码标准与所有权 | **通过** | 两个私有 leaf seam；公共 entry/runtime 导出零漂移；稳定单句错误；cast 局部；S9-M4 死代码非阻断 |
| 2. 测试标准 | **通过** | 4 测试位置正确；定向 suite 非空门 + 文件预检；无 skip/only/降级；deadline 正等待；`.mjs` 避开 `test/**/*.ts`；证据在 ignored `.cache` |
| 3. 机械 gate 仓库纪律 | **通过，附 MINOR** | worktree 正确落 `.worktrees` 且当前无残留；默认无 tracked/index 写；S9-M1 清理失败、S9-M2 裸 pnpm 诊断、S9-M3 G6 base 盲点需硬化 |
| 4. 文档与术语 | **通过** | `docs/**`、CONTEXT、协议零 diff；ADR 状态未越权；commit 符合 conventional 形式；wiki 仅证据 |
| 5. 工程完整性 | **通过** | lock/manifests/artifacts/config/release 零 diff；新文件头注释符合同层惯例；无部署/patch/marker |
| 6. Verdict | **approve** | 0 BLOCKER / 0 MAJOR / 4 MINOR；交付限定见 §8 |

## 8. approve 的交付说明限定（必须保留）

### 8.1 SA8 iteration-2 I-6 七条，逐条为强制披露义务

1. **不得声称**“根 test 全绿”“默认布局全量测试通过”“既有测试全绿”“CI 全绿”或任何等价表述。
2. 必须写明矩阵 `root-test` = **32 failed = 28 环境 + 4 既有**：28 来自 ambient corepack/pnpm 11.28.5 未遵守 `package.json:6` 的 `pnpm@10.28.2`，导致子进程失败；4 来自未改文件 `packages/ws-replication/test/ws-replication-issue421-edge-factory-api.test-d.ts` 的可选参数元组断言与 expect-type 1.4.0（vitest 3.2.7）不兼容，错误形态为 `Expected 1 arguments, but got 0`。
3. 必须提供 BASE 等量复现证据 `.cache/cordis-baselines/evidence-base/base-repro/**`：BASE 279dba4、逐族 4 条命令、32 failed/52 passed/84 total、9/9 文件与矩阵相等；必须诚实注明 BASE 侧是逐族复跑而非单次全量。
4. 必须写明 packageManager 对齐复跑 `.cache/cordis-baselines/evidence/root-test/root-test-pnpm10282.*`：**单次完整全量 5912 total / 5908 passed / 4 failed**，8 个环境归因文件 76/76 转绿；4 个 test-d 不受 shim 影响，且在仓库 CI 自身 test-d typecheck lane 于未改动布局即复现 4 failed/4 passed、Type Errors 4 failed。
5. 必须显式说明：该 cell 触发设计 §17-3 的字面阻断语义；带红收口依据是 SA8 iteration-2 I-5.2（AC6 文义满足、AGENTS 为执行 + 如实上报义务、§17-3 的非决策层属性及其事实前提被 BASE 证据证伪）；4 例修复另立后续票，因为文件在本票 ALLOW/G3 外且修改会触 issue #421 公共句柄冻结面 pin；owner 如另表态从其裁定。
6. AC6 只能按点名族声明全绿（15-project typecheck、Persistence contract、真实 Timer、DSH profile 相关验收）；任何“现有 DSH 相关测试全绿”的总括说法必须带 packageManager 对齐环境限定。
7. 原始矩阵证据、R-4 再生 `root-test.json`、对齐复跑 `root-test-pnpm10282.*` 三套必须并存；不得用对齐复跑覆盖原红证据，矩阵 cell 继续保持 `status=fail`/exit 1。现有 `root-test-pnpm10282.json:1-6,24-39,169-187` 已明确记录该并存关系。

### 8.2 Standards 面附加边界

- 在本轮/后续任何 G5 重跑后，除 exit code 外还必须检查无 `WARN failed to remove base snapshot worktree`，并以 `git worktree list --porcelain` 证明 `.worktrees/base-snapshot` 不存在；在 S9-M1 修复前，不能只凭 gates exit 0 推断“绝无残留”。
- 不得宣称“runner 全链路零裸 pnpm”；准确说法是“baseline acquire 与 tsc/vitest 执行不依赖裸 pnpm/npm，root-test 另有只读版本诊断探针”。交付执行不应把该探针当作安装或工件解析入口。
- ws-replication 仅可宣称三基线编译面、Root seam 语义与 B1 focused gate 证据；不得宣称 Hub/Peer/SessionHost 三基线行为兼容。Replication 行为矩阵和 apps/yjs-server 行为验收仍属后续票。
- B3 只能描述为 pinned commit 的 **minimal tsc source-build**，不是 DSH 官方 `tsc -b + tsdown` 等价物；File retry 证据限 POSIX rename 语义；`substitute-rc12` 当前由 provenance realpath 检出，其通道级判红因构建目录依赖链接缺失不可达，不能把该负控描述成已直接观察到 channel mismatch。
- ADR 0035 状态更新、`memory.ts`/`file.ts` 旧 `ctx.timeout` 注释、4 个既有 test-d 红、S9-M4 死代码及本报告的工具硬化项均不得写成“本票已完成”。

## 9. 最终结论

本交付满足 SA9 所负责的仓库与工程标准面：生产所有权、导出与生命周期边界清楚；测试可发现、可判真假且无 skip/降级；规范文档和 release/frozen 面保持封闭。4 个 MINOR 已给出最小修法，均不阻断 approve。Controller/SA10 可直接以本文件 §8 作为交付摘要的 standards 限定清单。

---

## 10. iteration 1（delta 复审）

- Dispatch：`sa-90c51f3f-8430-4e16-965b-d418bc7a3e77`，phase = standards-review，iteration 1。
- Reviewed subject：最终 HEAD `9f5afdaede1f196c99599b8c203e578737b1240f`；delta = `473f83e9ce1dbf44f46c2156768e36099a35a0a1..9f5afda`；base 仍为 `279dba4ac81b7c7520e3d0b87b5c4d621a86a517`。父链实测为 `279dba4 → 473f83e → 9f5afda`。
- 范围：逐行审查 delta 的测试全文与 wiki 改动，核对 SA10 M1/M2、SA4 §14、SA3 §9.6、SA8 iteration-3 与既有 `.cache` 证据；执行只读 git 范围、hash、whitespace、ignore、worktree/status 检查。**本轮未运行测试或 `gates.mjs`，也未把既有测试证据冒充为本轮重跑证据。**

### 10.1 Delta verdict

**approve — 0 BLOCKER / 0 MAJOR；上轮 4 项 MINOR 原样存续、未被引入或加重；本轮无新增 finding。**

`473f83e..9f5afda` 的产品代码面恰为 `packages/persistence/test/cordis-root-real-timer.test.ts` **+222/−0 纯追加**；其余 6 个文件均为 `wiki/raw/task_issue-470*.md` 评审/台账产物。生产源码、runner/gates、manifests/lock、公共 entry、docs/ADR、配置与 artifacts 在 delta 中零变化。因此 iteration 0 对生产 seam、模块责任、生命周期、公共导出和冻结面的 approve 结论在 `9f5afda` 上无回归。

### 10.2 新增 AC3(c) 测试的仓库标准 — 通过

- **真实 Timer，非 fake**：新用例沿用 `createContext()` 的 `createSystemClockPlugin` + `new TimerService(ctx)`（`cordis-root-real-timer.test.ts:146-151,586`），从公开 Memory 插件和 Root 通道驱动调度；没有 fake scheduler/fake timer，也没有为新用例注入替代 scheduler。`TimerService.prototype.timeout` instrumentation 仍在任何用例构造服务前的 `beforeAll` 安装（`:63-91`），并在 `afterAll` 恢复原方法（`:93-97`）；delta 未改变这一全局 patch 的安装/恢复对称性。
- **deadline 谓词，而非猜时序**：新用例的正向等待全部复用 `waitFor` 的 5s wall-clock deadline + 5ms 谓词轮询（`:120-127,647,653-662,672-675`），等待 gate 进入、两个 fiber 的 UNLOADING 锚和最新 generation 提交。没有固定轮数 settle，也没有新增 `delay`/sleep 来猜正向完成。`:685-687` 的单个 `setImmediate` 只用于 unhandledRejection 的宏任务排空边界，与同目录/Registry 既有惯例一致，不是业务完成判据。
- **窗口、提交与事件序均可证伪**：放行前断言 service 已撤销、dependent 正在 unload、写仍在途、adapter dispose 未开始且 store 仍 gen1（`:647-665`）；随后等待 store 解码为 gen2，并断言真实 Timer arm 增量、adapter 仍未 dispose、persistence fiber 仍 UNLOADING（`:670-681`）。最后断言完整事件序 `snapshot-committed → adapter-dispose-start → adapter-dispose-complete`、严格偏序、disposed 状态和零 unhandled（`:683-693`）。没有用 drain/manual flush/测试直写 store 代替被测路径。
- **清理与泄漏边界合格**：`saveGate`、dependent barrier 在 finally 中释放，disposal 被等待，根 Context 被 dispose，process listener 对称移除（`:694-700`）。adapter 的 `saveDoc`/`dispose` monkey-patch 只作用于本用例创建并销毁的实例；文件级 prototype patch 由上述 `afterAll` 恢复，没有新增跨用例全局状态或 listener 泄漏。
- **测试卫生**：delta 无 `.only`/`.skip`/`.todo`/`xit`/`xdescribe`，无 `@ts-ignore`/`@ts-expect-error`/`as any`，无新增 `export`。新增 `DocPersistence` 仅为既有公共类型的 type-only import；`deferred`、`DependentWriter`、`FIBER_STATE_UNLOADING` 均有实际用途，没有新增死代码。SA4 §14.3 的 O8–O10 属可选加固/覆盖注记，不构成本轮新的 SA9 标准违例。
- **运行时长/既有证据**：三份 `.cache/cordis-baselines/evidence/{B1,B2,B3}/real-timer.json` 均记录 11/11、三次顺序运行 exit 0、`allFilesPresent:true`，且 `testNames` 含新用例；当前测试文件及 `9f5afda` 内 blob 的 sha256 均为 `6117927d…efc4f5`，与 M2 汇总及 BASE 取证钉值一致。B3 第三次日志为 11/11、tests 562ms / Duration 851ms；默认布局 M2 日志为两文件 17/17、real-timer tests 586ms。新用例没有固定长等待或显著运行时扩张。上述是既有证据复核，不是本轮重跑。

### 10.3 依赖、文件范围与证据落盘 — 通过

- delta 没有新增任何包 import；既有的 `@deepseek-ai/cordis`、`@deepseek-ai/cordis-plugin-timer`、`@nomicore/clock` 测试依赖保持不变，没有跨包逆向依赖或生产依赖扩散。`packages/persistence/src/**`、`packages/ws-replication/**`、`packages/namespace-registry/**` 在 delta 中零 diff。
- 最终 base→HEAD 产品路径仍恰为原 6 修改 + 11 新增；delta 未新增/删除产品路径，未触碰 Registry R5P 源文件、公共入口、docs、协议、manifests、lock、artifacts、tsconfig/vitest 配置或 release 面。
- M2 的运行证据位于 `.cache/cordis-baselines/{evidence,evidence-base,m2-green}/**`；`git check-ignore` 实测由根 `.gitignore:18` 的 `.cache/` 覆盖。delta 的 `.cache`/`.worktrees`/`artifacts` tracked diff 均为空，没有误写 tracked 证据。
- 审查开始时 worktree clean；`git worktree list --porcelain` 仅主仓与本任务 worktree，无 `base-snapshot`/`base-m2` 残留。

### 10.4 Gates、whitespace 与最终状态 — 通过，保留证据 vintage 限定

- 本轮独立执行 `git diff --check 473f83e..9f5afda`、`git diff --check 279dba4..9f5afda` 和当前 `git diff --check`，均 clean。M2 过程中 SA3/SA8 记录的 **8/9** 唯一红点为未提交 `task_issue-470_dispatch.md` 的 EOF 空白行；该文件已进入最终 delta 且最终 range whitespace 检查通过，该临时 G6 原因不再存在。
- 既有 `.cache/cordis-baselines/evidence/gates/gates.{json,log}` 记录 **9/9 PASS / exit 0**，无 G5 cleanup WARN；但其 mtime 早于 M2 delta。M2 delta 对 G1′/G2/G3/G4/G5/G7/G8/G9 的 gated 输入零变化，G6 的最终交付 range 又已由本轮独立检查覆盖，因此没有 gate 回归事实。
- **不得把上一项写成“SA9 本轮对 9f5afda 重跑 gates 并新鲜取得 9/9”**：`gates.mjs` 的 G5 会调用 Vitest，本轮遵守 SA9 不运行测试的边界，未重跑该脚本。本轮结论是既有 9/9 证据仍适用、过程性 G6 红因已消除、最终静态/范围检查无回归；若交付流程要求 commit 后第一手 9/9 日志，应由获授权的执行角色补跑并另查无 cleanup WARN/worktree 残留。这是验证 vintage 限定，不是新增 finding。

### 10.5 提交拆分与叙述边界 — 通过

- `473f83e` 以 `feat(persistence)` 承载主体，`9f5afda` 以 `test(persistence)` 承载 AC3(c) 测试修复与评审产物；两个 commit 均沿仓库既有 conventional subject + issue 编号惯例，父子关系正确，拆分没有把主体修复混入无关产品面。
- `9f5afda` 正文声称的 AC3(c) 场景、三基线 11/11×3、BASE B3 目标原因红均有对应源码与 `.cache` 证据；“记录最终 SA9/SA10 评审”没有宣称 SA10 approve，也没有 root-test/CI 全绿表述。
- SA10 M1 所指 SA4 原越界句已改为“本票相关文件在 root-test 中全部通过”并同句保留整体 cell 红；SA4 `:84` 的等价歧义亦收窄为文件级 6/6。其余搜索命中均为历史引文、禁令、条件句或带文件/环境限定的表述，**当前没有新的未限定 root-test/默认全量/既有测试/CI 全绿宣称**。
- §8 的全部交付限定继续有效，并叠加 SA8 iteration-3 I3-8 的 vintage 口径：root-test 三套证据仍是 M2 前的 5912-total 记录，cell 保持 fail/exit 1、32 = 28 环境 + 4 既有；新用例使当前树若重跑的聚合总数增加 1，不得把旧 5912 记录描述为当前树的新鲜全量结果。M2 后点名族计数为 real-timer 11/11×3、contract 243/243/247；三基线 15-project 汇总 cell 也是 M2 前证据，persistence 新输入由 SA8 的三 overlay 单 project typecheck 桥接。不得声称根 test 全绿。

### 10.6 上轮 4 项 MINOR 现状

| Finding | 在 9f5afda 的现状 | 是否被 delta 引入/加重 |
|---|---|---|
| **S9-M1** G5 cleanup catch 仅 WARN | `gates.mjs:259-266` 零变化；当前无 worktree 残留 | 否；仍按原 MINOR 保留 |
| **S9-M2** root-test 后裸 `pnpm --version` 诊断 | `run-baseline.mjs:717` 零变化；仍只是 diagnostics | 否；仍按原 MINOR 保留 |
| **S9-M3** G6 无 base 的 `git diff --check` 盲点 | `gates.mjs:369-380` 零变化；本轮已独立检查 delta 与完整 base range，均 clean | 否；实际交付无 whitespace 缺陷 |
| **S9-M4** 局部死代码/死路径 | issue299 未用 helper、runner 未用常量/参数/`--suite gates` 死路径、acquire `writeSurface` 字段均零变化；新测试未新增死代码 | 否；仍按原 MINOR 保留 |

### 10.7 最终 re-review 结论

`9f5afda` 的纯追加测试满足 persistence 模块的确定性并发测试、生命周期次序、类型与导出纪律；没有新增依赖、tracked 证据、全局泄漏或范围越界。iteration 0 的 approve 对最终 HEAD 仍成立：**0 BLOCKER / 0 MAJOR / 4 既有 MINOR，0 新增 finding**。交付摘要仍须携带 §8 与本节 §10.4–10.5 的证据 vintage/叙述限定。
