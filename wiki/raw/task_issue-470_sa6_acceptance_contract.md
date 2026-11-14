# SA6 诊断与验收契约 — issue #470：Cordis rc.12 双形态 Root tracer bullet 与工件验真

状态：**conflict（requires conflict recheck）** — 诊断、能力缺口与验收契约本身可信且可执行；但 Issue/ADR 的「每个基线通过全仓 typecheck」与「本 Issue 只做 Persistence、Replication 留待后续 ticket」在 rc.12 类型面上**逻辑不相容**（实测 13 个 TS2576，其中 12 个在 `packages/ws-replication`）。该 scope 冲突需 SA8/Host 仲裁，详见 §15.1；不是 diagnostic reject。

HEAD：`279dba4ac81b7c7520e3d0b87b5c4d621a86a517`（worktree 分支 `mabf/issue-470`；base = PR #469 / `spec/468-cordis-rc12-root`）
任务类型：**feature（tracer bullet / acceptance contract）**，不是 bug 修复。本文只建立能力缺口、工件身份与可执行验收判据；**不设计实现、不写实现代码、不写可执行测试代码**。
写面：**仅本文件**。本会话没有修改 `packages/**`、`docs/**`、`artifacts/**` 或根清单；`git status` 仅 Host 提供的两个 untracked brief/dispatch（§16）。

---

## 1. Task type and inputs

- **任务类型**：feature。目标能力 = 同一个公开发布的 Persistence 插件在 legacy Root 与 rc.12 symbol Root 两种 Cordis 工件上，通过真实 Timer 完成 flush/retry/drain/dispose/service-revoke；并建立可复用的工件身份与 Root 通道验真设施。当前缺口是**能力缺失 + 验证覆盖面缺失**，不是某个既有实现的 bug 根因。
- **输入与缺失输入**：

| 输入 | 位置 | 状态 / 用途 |
|---|---|---|
| Host 任务简报 | `wiki/raw/task_issue-470.md`（untracked） | Issue 正文、What to build、Acceptance criteria、Comments 空 |
| Dispatch log | `wiki/raw/task_issue-470_dispatch.md`（untracked） | Round 1、唯一 SA6、base 279dba4、issue comments `[]` |
| 架构决策（normative） | `docs/adr/0035-cordis-rc12-root-compatibility.md` | 双形态 Root、三基线、工件绑定、验收必须断言解析路径、依赖范围不变 |
| 生命周期交叉决策 | `docs/adr/0006-server-persistence-docstore.md`、`0009-namespace-registry-leases-and-host-lifecycle.md`、`0012-instance-identity-and-websocket-plugin-ownership.md` | dirty notification、adapter dispose 边界、Host 逆序停机、Persistence/Registry/Timer 所有权 |
| 模块契约 | `packages/persistence/AGENTS.md`、`packages/dsh-persistence/AGENTS.md` | 核心/Dsh 边界、scheduler 注入、确定性与 loud failure |
| 现行代码/测试 | `packages/persistence/src/service.ts`、`memory.ts`、`file.ts`、`lifecycle.ts`、`testing.ts`；`packages/dsh-persistence/src/profile.ts` 与 `test/`；`packages/persistence/test/**`；`packages/namespace-registry/test/registry-sa7-rev1.test.ts` | §10 逐处清单 |
| ADR 点名的另一 Host adapter | `packages/ws-replication/src/plugin.ts`、`packages/ws-replication/test/` | 本 Issue **不修改**；但它是 AC6 全仓 typecheck 的 scope 冲突源（§15.1） |
| SA8 工件 | `wiki/raw/task_issue-470_sa8_*`、`_design.md`、`_relevant_decisions.md`、`_conflict_report.md`、既有 SA6 报告 | **全部不存在**（iteration 0）。替代约束面 = 简报 + ADR 0035 + 模块 AGENTS；不影响契约可执行性 |
| Issue comments | `gh api .../issues/470/comments` → `[]`；brief `## Comments` 空 | **无 owner 附加要求** |

- **AC 条数核对（必须记录，不臆造第 10 条）**：Issue 正文 checklist 实际是 **8 条**（brief L21–L28）。Host dispatch 称“9 条 acceptance criteria”。为避免遗漏，本文把“What to build”中的**“Host 不需要新增配置或条件装配”**单列为 **AC9（派生条件，标记 derived）**；其余 AC1–AC8 与 checklist 逐条对应。任何后续设计/验收不得声称存在第 9 条 checklist 而未在本文映射。

---

## 2. Owner comment mapping

- Issue #470 当前**没有任何评论**（dispatch 与 brief 均记录 `[]`），无 owner 额外要求。
- 需求面 = Issue checklist AC1–AC8 + What to build 的 AC9 派生条件 + ADR 0035 决策 1–6 + ADR 0006/0009/0012 的既有生命周期条款。逐条映射见 §12。

---

## 3. SA8 constraints

- 本 Issue 无 SA8 设计、无 conflict report、无 relevant-decisions 文件（iteration 0）。可用的规范约束只有：
  1. 简报 What to build / AC1–AC8；
  2. ADR 0035（normative，status 提议）决策 1–6；
  3. ADR 0006/0009/0012 的 Persistence/Registry/Host 生命周期原文；
  4. `packages/persistence/AGENTS.md`、`packages/dsh-persistence/AGENTS.md`；
  5. 本 SA6 dispatch 的写面限制（唯一 artifact；不改生产实现）。
- **本文不把任何未成文的设计选择当成约束**。例如“兼容缝放在哪个文件”“用 `Reflect.get` 还是 `ctx[Context.root]`”属于实现设计，本文只固定可观察行为与工件身份判据。

---

## 4. Environment and baseline

| 项 | 值 / 证据 |
|---|---|
| 运行时 | Node `v24.13.0`；TypeScript `5.9.3`；vitest `3.2.7`；tsx `4.23.12`；yjs 由 pnpm workspace 链接提供 |
| 仓库状态 | `git rev-parse HEAD` = `279dba4ac81b7c7520e3d0b87b5c4d621a86a517`；`git status --porcelain` 仅两个 Host untracked 文件 |
| 依赖安装 | `node_modules` 已由 Controller 后台安装；`packages/*/node_modules` 的 pnpm workspace 链接存在（`@deepseek-ai/cordis` → `4.0.1`，timer → `1.1.3`，cosmokit → `1.8.2`） |
| pnpm | 直接 `pnpm` 被 corepack 拒绝：repo `packageManager: pnpm@10.28.2`，当前 corepack pnpm `11.28.5`；本会话改用 `./node_modules/.bin/{tsc,vitest}` 取得有效证据。验收命令不得依赖裸 `pnpm`，或必须显式 `corepack pnpm@10.28.2` |
| 网络 | npm registry 可达；`github.com/deepseek-ai/deepseek-harness` 可达；DSH 目标 commit 已 sparse clone 验证 |
| 当前默认基线 | 仓库安装 = npm `@deepseek-ai/cordis@4.0.1` + `@deepseek-ai/cordis-plugin-timer@1.1.3` + cosmokit `1.8.2`。这是基线 1 的现成布局，但不是三基线夹具 |

### 4.1 本会话已取得的基线证据

| 检查 | 命令（直接二进制） | 结果 |
|---|---|---|
| 默认全仓 typecheck | 按根 `package.json` `scripts.typecheck` 的 15 个 project 逐个 `./node_modules/.bin/tsc -p <project>` | **15/15 OK，exit 0** |
| 默认 Persistence/DSH/Registry 聚焦测试 | `NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run packages/persistence/test/core-dsh-boundary.test.ts packages/persistence/test/persistence-contract.test.ts packages/dsh-persistence/test/dsh-profile-acceptance.test.ts packages/namespace-registry/test/registry-sa7-rev1.test.ts` | **4 files / 30 tests passed；Type Errors: no errors；exit 0** |
| npm 4.1.0 类型面全仓 typecheck | 临时 tsconfig `extends tsconfig.typecheck.json`，`paths` 指向 npm `cordis@4.1.0` / `timer@1.2.0` 的 `lib/types` | **exit 0**（legacy root 类型仍在） |
| rc.12 类型面全仓 typecheck | 临时 tsconfig 同上，`paths` 指向 DSH commit 源码构建出的 rc.12 `lib/types` | **13 个 TS2576**：`packages/persistence/src/service.ts:54` 1 个 + `packages/ws-replication` 12 个（§15.1） |
| rc.12 Runtime Root 探针 | 源码构建 DSH commit 的 cordis/timer/cosmokit，`new Context()` + `new TimerService(root)`，`Reflect.get(ctx,'root')` / `Reflect.get(ctx, Symbol.for('cordis.root'))` | root ctx：legacy `undefined`，symbol = root，symbol.timeout = function；plugin fiber：legacy 读取 **throw** `cannot get property "root" without inject`，symbol = root |
| npm 4.0.1 Runtime Root 探针 | 仓库 pnpm store 的 cordis 4.0.1 + timer 1.1.3 | legacy root = root，symbol `undefined`；child legacy 继承 root；timeout 均为 function |
| npm 4.1.0 Runtime Root 探针 | npm tarball cordis 4.1.0 + timer 1.2.0 + cosmokit 1.9.0 | 同 npm 4.0.1：legacy root = root，symbol `undefined`；`Context.root` static 不存在 |
| rc.12 当前 Persistence 最小复现 | `/tmp` 隔离装配：DSH rc.12 工件 + 当前 `packages/persistence/src` 副本 + `@nomicore/clock` 副本；`createMemoryPersistencePlugin().apply(root)`，`saveDoc` | 3/3 稳定：booted=true、service 已提供、`saveDoc` reject `TypeError: Cannot read properties of undefined (reading 'timeout')` |
| rc.12 当前 Persistence（plugin fiber 形态） | 同一隔离装配，`root.plugin(plugin)` + `await fiber`，`saveDoc` | 3/3 稳定：booted=true、service 已提供、`saveDoc` reject `Error: cannot get property "root" without inject` |
| npm 4.1.0 当前 Persistence | 同一隔离装配，替换 npm 4.1.0/1.2.0/1.9.0 工件 | 两种形态均 `saveDoc.ok=true`（legacy 通道工作） |
| 历史 artifacts / 清单现状 | `git diff --name-only 279dba4 -- artifacts/`；`git diff --name-only 279dba4 -- pnpm-lock.yaml package.json 'packages/*/package.json'` | 均为 **0**（变更前基线） |

> 说明：默认聚焦测试的 30 个通过**不证明 rc.12 可用**——这些测试里没有一条在真实 rc.12 Root 上执行 flush；`core-dsh-boundary` 只检查 service/status/dispose，`file-persistence` 的 plugin 用例用 fake timer 注入（§10.2）。这正是“假绿”缺口。

---

## 5. Positive reproduction（能力缺口，逐条可运行）

### 5.1 rc.12 上当前 Persistence 的真实失败面

最小输入（非测试代码，仅诊断记录）：

1. 从 DSH commit `1511a6ed442c207919142a4b0e6c4916f96d2c3b` 的 `vendor/cordis`、`vendor/timer`、`vendor/cosmokit` 源码构建（本会话用 tsc 5.9.3，记录见 §12.1/附录 A）。
2. 在隔离目录装配：`@deepseek-ai/cordis` = rc.12 构建物；`@deepseek-ai/cordis-plugin-timer` = 1.2.0 构建物；`@deepseek-ai/cosmokit` = 1.9.0 构建物；`@nomicore/clock` = 当前源码副本；`packages/persistence/src` = 当前 HEAD 副本。
3. `new Context()` → `createSystemClockPlugin().apply(root)` → `new TimerService(root)` → `createMemoryPersistencePlugin({schedule:{debounceMs:10,maxDirtyMs:50}}).apply(root)`。
4. 通过 `createMemoryHandleForTest(instance, {userId:'u'}, 'd')` 取得 handle，调用 `await instance.saveDoc(handle)`。

实际结果（重复 3 次，稳定）：

| 装配形态 | boot | service provided | 首次 `saveDoc` |
|---|---|---|---|
| root ctx 直接 `plugin.apply(ctx)`（DSH profile 同款） | true | true | reject `TypeError: Cannot read properties of undefined (reading 'timeout')` |
| `ctx.plugin(plugin)` + `await fiber`（第三方 Host 推荐形态） | true | true | reject `Error: cannot get property "root" without inject` |

两个结果都发生在 **首次 dirty notification**，不是 plugin apply：`assertPersistenceHostDependencies`（service.ts:26–35）只检查 `ctx.get('timer').timeout`，不检查 Root 通道；`createCordisPersistenceScheduler`（service.ts:48–56）把 `ctx.root` 留在闭包里，`saveDoc → scheduleFlush → scheduler.setTimeout`（lifecycle.ts:765–775、1111–1123）才第一次读取。

### 5.2 同一最小输入换 npm 工件

| 工件 | 结果 |
|---|---|
| npm `cordis@4.0.1` + `timer@1.1.3`（仓库默认；聚焦测试已覆盖 real Timer R5P/DSH profile） | 绿：R5P、DSH profile、core-dsh-boundary 等 30 tests 通过 |
| npm `cordis@4.1.0` + `timer@1.2.0` + `cosmokit@1.9.0`（本会话最小探针） | 绿：两种装配形态 `saveDoc.ok=true` |
| DSH commit vendored rc.12 + `timer@1.2.0` + `cosmokit@1.9.0` | 红：上表两种 reject |

这证明失败**不是** Timer 1.2.0 或 Cosmokit 1.9.0 的通用缺陷，而是 **rc.12 Root 公共面缺席 + Persistence 仅读 legacy `ctx.root`** 的组合。

### 5.3 类型面复现

- rc.12 声明 `Context` 只有 `[symbols.root]: this` + `static readonly root: unique symbol`；没有实例 `root` 属性（DSH commit `vendor/cordis/src/context.ts:14–22, 59–76`）。
- 当前 `packages/persistence/src/service.ts:54` 的 `ctx.root` 在 rc.12 类型面下是 **TS2576**（`Property 'root' does not exist on type 'Context'. Did you mean to access the static member 'Context.root' instead?`）。这不是测试环境噪声，而是 AC1/AC4 的直接红判据。

---

## 6. Negative control

### 6.1 已执行的正/负对照

| 对照 | 目的 | 结果 |
|---|---|---|
| npm 4.0.1 + Timer 1.1.3 | legacy 基线，正控 | 绿（30 tests / typecheck 15/15） |
| npm 4.1.0 + Timer 1.2.0 | **同名版本但仍是 legacy** 的负控：证明“版本号 = rc.12”是伪判据 | 绿（legacy `ctx.root` 存在；rc.12 探针的 symbol 断言应失败） |
| DSH rc.12 + Timer 1.2.0 + Cosmokit 1.9.0 | 目标基线 | 红（saveDoc reject；typecheck 13 错误） |
| rc.12 root ctx vs plugin fiber | 失败形态对照：证明同一源码在两种 ctx 形态下给出不同错误，当前无稳定 loud failure | root ctx → TypeError；fiber → proxy Error |
| npm 4.1.0 最小探针 | 排除 Timer/Cosmokit 通用缺陷 | saveDoc ok |

### 6.2 契约要求新增的负控（尚未实现，必须由夹具/测试建立）

1. **symbol 优先短路负控**：先在 ctx 上定义可记录的 legacy `root` getter（返回 legacy timer），再定义合法 symbol root（返回 symbol timer）；`saveDoc` 后必须只 arm symbol timer，legacy getter 读取次数 = 0。若实现先读 legacy，当前代码会 arm legacy、symbol 计数 0 ⇒ 红。
2. **malformed symbol 不回落负控**：symbol root 对象存在但 `timeout` 非 function；legacy getter 合法且可记录；plugin apply 必须同步 throw 稳定错误，legacy 读取次数 = 0、legacy timer arm = 0。若回落到 legacy 或延迟到 saveDoc，红。
3. **双通道皆缺席负控**：删除/遮蔽 symbol 与 legacy，仅保留 `timer` service；plugin apply 必须同步 throw；不能延迟到 saveDoc，不能使用 ambient timer。
4. **Timer service 形状负控**：`ctx.get('timer')` 存在但 `timeout` 非 function（现有 core-dsh-boundary 负向 B 的扩展）→ apply 同步 throw，不提供 service。
5. **解析回退负控**：基线运行器故意移除 overlay（回退到仓库默认 node_modules）→ 解析路径/工件身份断言必须失败；rc.12 基线尤其必须失败于 `expected symbol / got legacy` 或 `artifact identity mismatch`。
6. **同名工件替换负控**：把 npm `cordis@4.1.0` 放进 rc.12 overlay（同名同版本）→ channel 探针必须失败于 legacy；把 DSH rc.12 放进 npm 基线 → 必须失败于 symbol。Timer/Cosmokit 的 DSH vendored 源码与 npm 1.2.0/1.9.0 **逐字节相同**（§9.3），因此这两个包的替换只能靠 realpath/provenance/output hash 发现，不能靠 source hash。
7. **通道错配负控**：rc.12 基线的 probe 若观察到 legacy 命中即失败；npm 基线若观察到 symbol 命中即失败；不能写成“至少命中一个通道”。

**负控的验收方式**：每个负控命令必须被**实际执行并断言 exit != 0**，证据 JSON 记录 `{expected:'fail', observed:'fail', code}`；负控意外通过 = 验收失败，不能只写在文档里。

---

## 7. Stability, scale and timing

| 场景 | 次数 / 观察 | 结果 |
|---|---|---|
| rc.12 最小复现（root ctx / plugin fiber 两形态） | 各 3 次 | 3/3 相同错误消息，无偶发绿 |
| 默认聚焦测试 | 1 次（4 files / 30 tests） | 全绿；本会话未观察到 flake |
| 真实 Timer 行为测试（契约要求） | 每个基线 × adapter × 场景，至少 `--repeat 3` 或 CI 3 次 | 通过判据：每次都在 deadline 内完成；失败判据：任一次 timeout/偶发 |
| 真实等待上限 | 建议 5s deadline（沿用 `dsh-profile-acceptance` 的 waitFor 纪律），不得用固定轮数 settleRealIo | 慢机/CI 下不因固定轮数误红 |
| 性能/规模 | 本 Issue 不涉及大数据量；flush 文档量小（1 个 generation 标量），无需规模曲线 | 记录为不适用 |

竞态纪律：AC3 的 unload 窗口必须用 **gate/deferred + fiber `UNLOADING` 状态**拉开，不得用 sleep 猜测；真实 Timer 场景允许 wall-clock deadline，但每步都断言可观察谓词（write count/status/snapshot 内容）。

---

## 8. Root-cause chain / capability gap

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| 1. 症状 | rc.12 上 Persistence 插件能 boot、能 provide service，但任何已接纳写的 dirty notification 都 reject；在 Registry 场景会被 S6 映射为 `notify-dirty-failed` fatal（committed:true） | rc.12 最小复现 3/3；`namespace-runtime/src/write.ts:214–226` | high |
| 2. 直接故障点 | scheduler 的 `setTimeout` 实现读取 `ctx.root.timeout`；rc.12 的 Context 没有实例 `root` 属性 | `packages/persistence/src/service.ts:54`；DSH commit `vendor/cordis/src/context.ts` | high |
| 3. 触发条件 | `saveDoc` 首次登记 dirty → `scheduleFlush` → `scheduler.setTimeout`；不是 plugin apply | `lifecycle.ts:765–775, 1111–1123`；复现只在 saveDoc 处失败 | high |
| 4. 深层缺口 | 没有包内私有 Root 解析缝：symbol 优先、legacy 兜底、缺席/形状不符时同步 loud fail；也没有任何测试/夹具能暴露 legacy-only 假设 | `service.ts:26–56`；全仓 `ctx.root` grep（§10）；测试清单（§10.2） | high |
| 5. 放大因素 | DSH vendored Cordis **仍标 4.1.0**；npm 4.1.0 也是 legacy。版本号、package name、semver range 都不能区分两种 Root 形态 | DSH `vendor/cordis/package.json` 4.1.0 + rc.12 源码；npm 4.1.0 源码 | high |
| 6. 未证实假设 | “DSH Host 在所有 profile 都把 TimerService 构造在 root ctx 上”。ADR/装配文档如此规定；若某 Host 把 Timer 构造在子 ctx，symbol root 可能没有 `timeout`。契约要求这种情形也必须 loud fail（AC1），不得用子 ctx timer 兜底 | ADR 0035 §3；`dsh-persistence/src/profile.ts:87–93`；`ws-replication/src/plugin.ts:214–217` 已有 root 形状检查先例 | medium（不影响红判据） |
| 7. 排除项 | Timer 1.2.0 删除 `ctx.timeout`；Cosmokit 1.9.0 不存在/不兼容；Persistence lifecycle 逻辑本身在 rc.12 坏掉；ambient timer 兜底掩盖了失败 | npm 4.1.0/1.2.0 最小探针绿；timer 1.2.0 源码 timeout 未变；npm 有 cosmokit 1.9.0；当前代码无 ambient fallback（是 TypeError/reject，不是静默成功） | high |

### 8.1 “接纳写在 dependent 卸载期间仍能完成 dirty notification”当前靠什么成立

当前成立机制（**只在 legacy Root 基线上成立**）：

1. `createCordisPersistenceScheduler(ctx)` 在 plugin apply 时创建，但 `setTimeout` 每次调用才读 `ctx.root`（service.ts:48–56）。
2. 在 npm Cordis 4.0.1/4.1.0 中，`Context.root` 是构造期 `this.root = self` 的实例属性，子 context 通过原型链继承；`ctx.root` 恒为 root context（`vendor/cordis` 4.0.1 `src/context.ts:21–22, 75`）。
3. `new TimerService(root)` 的 `timeout()` 在 **TimerService 自己的 ctx（root）** 上注册 `ctx.effect`，所以返回的 disposer 生命周期属于 root fiber，而不是 persistence fiber；persistence fiber 进入 `UNLOADING` 后，root fiber 仍活，`ctx.root.timeout` 仍能武装 timer。
4. `bindPersistenceAdapterLifecycle`（service.ts:93–116）把 service revoke 与 adapter dispose 纳入同一个有序 effect：先 revoke → await 依赖 fiber 卸载/settle → 再 `adapter.dispose()`；`PersistenceLifecycle.dispose()`（lifecycle.ts:812–845）`clearTimers` 每个 entry（1211–1217），用 scheduler disposer 取消 root fiber 上的 timer。因此 timer 不会泄漏到 adapter 生命周期之外。
5. R5P（registry-sa7-rev1.test.ts:396–504）用真实 TimerService 把窗口拉开：persistence fiber `UNLOADING`、Registry shutdown 未 settle、adapter dispose 未发生；释放 save gate 后 `writePromise` 必须 `{ok:true}` 且 `runtime.fatal === null`，随后 shutdown settle **严格早于** adapter dispose 事件。

rc.12 上同一机制**只差通道解析**：root context 仍存在，TimerService 在 root 上仍有 `timeout` effect（本会话 probe：`symbolHasTimeout: function`），但公开面从 `ctx.root` 改为 `ctx[Symbol.for('cordis.root')]`。只要解析缝符号优先、legacy 兜底，ADR 0006/0009 的生命周期语义无需改变；反之（当前代码）在第一次 dirty notification 就 reject，已接纳写被升级为 fatal。这是 AC3 的核心。

---

## 9. Causal experiments

### 9.1 工件源码对照（证明“版本号不可作判据”）

| 探针 | npm 4.0.1 | npm 4.1.0 | DSH commit 1511a6e |
|---|---|---|---|
| `Context` 实例 `root` 属性 | 有（`this.root = self`） | 有 | **无** |
| `Context.root` static | 无 | 无 | **有**（`unique symbol`） |
| global symbol `Symbol.for('cordis.root')` | 未定义 | 未定义 | `symbols.root` 的定义值 |
| `ctx.root` 运行时 | root context | root context | root ctx 上 `undefined`；plugin fiber 上 **throw** `cannot get property "root" without inject` |
| package version | 4.0.1 | 4.1.0 | **4.1.0**（与 npm 同名同版本） |

### 9.2 rc.12 源码构建验证（本会话实际执行）

- `git clone --filter=blob:none --no-checkout --sparse https://github.com/deepseek-ai/deepseek-harness.git`；`git checkout --detach 1511a6ed442c207919142a4b0e6c4916f96d2c3b`；`git rev-parse HEAD` 精确匹配；`git status --porcelain` 空。
- commit 元数据：`2026-11-05T20:34:44+08:00`，subject `chore(cordis): upgrade core to 4.0.0-rc.12`。
- vendored 版本：cordis `4.1.0`、timer `1.2.0`、cosmokit `1.9.0`（package.json 逐字读取）。
- 用仓库 TypeScript 5.9.3 + 生成 tsconfig（`rootDir: src`、`outDir: lib`、`declarationDir: lib/types`、`allowImportingTsExtensions`、`rewriteRelativeImportExtensions`、`paths` 指向 vendored cosmokit/cordis 类型）构建三个包，均 exit 0；runtime probe 证明 symbol Root 行为与源码一致。
- 该构建是**最小 source-built**，不等于 DSH 官方 `tsc -b` + `tsdown` 流水线；ADR 允许“从该 revision 的 vendored 源码构建”，但若 SA8 要求官方流水线，需在夹具 provenance 中记录并批准（§15.3）。

### 9.3 DSH vendored 与 npm 同名工件的逐字节比较

| 包 | DSH commit 源码 vs npm 同版本源码 | 含义 |
|---|---|---|
| Timer 1.2.0 | `vendor/timer/src/index.ts` SHA-256 与 npm tarball **完全相同** | source hash 不能区分 vendored/npm；必须 realpath + provenance/output hash |
| Cosmokit 1.9.0 | 7 个 `src/*.ts` SHA-256 与 npm tarball **全部相同** | 同上；并且 Controller 提供的“cosmokit 最高 1.8.1 / 1.9.0 只在 DSH”事实**已过时**：本会话 `npm view @deepseek-ai/cosmokit versions` 含 `1.9.0`，`dist.integrity` 可取得 |
| Cordis 4.1.0 | 源码**不同**（legacy `root` vs `[symbols.root]`） | content digest/probe 可区分；但同名同版本，单看版本仍会误判 |

### 9.4 类型面实验

| 类型面 | 命令 | 结果 |
|---|---|---|
| 默认 npm 4.0.1 + timer 1.1.3 | 15 个 project 逐个 `tsc -p` | 15/15 OK |
| npm 4.1.0 + timer 1.2.0 | 全仓临时 tsconfig `paths` | exit 0 |
| DSH rc.12 + timer 1.2.0 | 全仓临时 tsconfig `paths` | 13 errors：`packages/persistence/src/service.ts:54` + `packages/ws-replication` 12 个（§15.1） |

### 9.5 行为实验

| 实验 | 结论 |
|---|---|
| rc.12 root ctx / plugin fiber 两形态 saveDoc | 均 reject；错误形态不同；3/3 稳定 |
| npm 4.1.0 两形态 saveDoc | 均 resolve；排除 Timer/Cosmokit 通用缺陷 |
| npm 4.0.1 R5P / DSH profile / core-dsh-boundary | 30 tests 绿；证明 legacy 路径与既有生命周期锚 |

---

## 10. Impact surface：逐处 `ctx.root` / Timer 装配清单

### 10.1 生产代码（Persistence 范围内）

| # | 位置 | 实际行为 | 对 timer 能力的依赖形状 | 失败模式 |
|---|---|---|---|---|
| P1 | `packages/persistence/src/service.ts:54` | `setTimeout: (cb, ms) => ctx.root.timeout(cb, ms)` | 依赖 `ctx.root` 存在且 `timeout` 为 function；每次调度读取 | rc.12 root ctx：`ctx.root` undefined → `TypeError: Cannot read properties of undefined (reading 'timeout')`；rc.12 plugin fiber：proxy 抛 `cannot get property "root" without inject`；均在首次 saveDoc 才发生 |
| P2 | `packages/persistence/src/service.ts:26–35` | `assertPersistenceHostDependencies` 只检查 `ctx.get('timer').timeout` | 不检查 Root 通道；timer service 存在即可 boot | timer service 在但 root 通道无 timeout（例如 Timer 装在子 ctx）→ apply 通过、首次调度才炸；无稳定错误 |
| P3 | `packages/persistence/src/service.ts:15, 85` | 注释声明 scheduler 通过 `ctx.root.timeout` 武装；依赖 Host 装配顺序 | root fiber 生命周期 ⊇ adapter；Timer fiber 后停 | Host 违约时（先拆 timer）会在 native 回调续体抛 INACTIVE_EFFECT；不在 persistence 内防御（既有契约） |
| P4 | `packages/persistence/src/memory.ts:239`、`file.ts:280` | plugin factory 在 apply 时调用 `createCordisPersistenceScheduler(ctx)` | 与 P1 相同；工厂选项不接收 scheduler | 同 P1；adapter 直接构造路径（显式注入 scheduler）不受影响 |
| P5 | `packages/persistence/src/memory.ts:24–29`、`file.ts:33–37` | 文档注释说“production plugin path derives it from `ctx.timeout` via `createCordisPersistenceScheduler`” | **与实现不符**：实际是 `ctx.root.timeout` | 文档误导；误导读者以为 rc.12 `ctx.timeout` 已覆盖 |
| P6 | `packages/persistence/src/lifecycle.ts:765–775` | `saveDoc` 递增 dirtyGeneration 后同步调 `scheduleFlush` | scheduler 必须同步返回 disposer | scheduler 抛 → `saveDoc` reject；dirtyGeneration 已递增但定时器未武装；Runtime 映射 notify-dirty-failed fatal |
| P7 | `packages/persistence/src/lifecycle.ts:1111–1123` | `scheduleFlush` 先 maxDirty、后 debounce，均 `scheduler.setTimeout` | 需要同步、可用、可 clear 的 timer | 任一抛错 → saveDoc reject；后续 close/evict 无 timer 可清（entry 可能滞留 dirty 但无调度） |
| P8 | `packages/persistence/src/lifecycle.ts:812–845, 1211–1217` | `dispose` 同步段 `clearTimers` 每个 live entry，再 `allSettled(inFlight)` | disposer 幂等；必须在 root fiber 上有效 | 若 scheduler 的 disposer 不来自 root timer，dispose 可能无法清 root；当前 legacy 路径由 TimerService disposer 保证 |
| P9 | `packages/persistence/src/service.ts:93–116` | 有序 effect：revoke → await 依赖 settle → `adapter.dispose()` | 不依赖 Root 形态；依赖 effect 顺序 | Root 通道失效时，adapter dispose 仍会执行，但已接纳写的 dirty notification 已 fatal；AC3 红 |

### 10.2 dsh-persistence 与 Persistence 相关测试 fixture

| # | 位置 | 行为 / 装配 | 是否能在 rc.12 暴露问题 | 失败/假绿说明 |
|---|---|---|---|---|
| F1 | `packages/dsh-persistence/src/profile.ts:87–93` | `new Context()`；clock → timer（缺省 `new TimerService(ctx)`）→ `createMemory/FilePersistencePlugin().apply(ctx)`；持久化插件直接 apply 到 **root ctx** | **能**（flush 时 `ctx.root` undefined） | profile 自身不读 root；但它是 rc.12 Host 形态的代表，DSH profile 测试会红在 saveDoc |
| F2 | `packages/dsh-persistence/test/dsh-profile-acceptance.test.ts:103–158, 138, 266, 374, 409` | memory/file profile；部分用真实 TimerService 缺省，部分用 `createProbeTimeline` 注入 clock/timer | **部分能**：真实 Timer profile → saveDoc；fake timeline 也仍走 root ctx 上的 `ctx.root`（若 fake timer 插件只提供 service/mixin，root 仍需存在） | 当前默认 npm 4.0.1 全绿；rc.12 下预期红；现有测试未跑过 rc.12 |
| F3 | `packages/persistence/test/core-dsh-boundary.test.ts:35–58` | 两个真实 `new Context()` + `createSystemClockPlugin` + `new TimerService(ctx)`；`createMemory/FilePersistencePlugin().apply(ctx)`；只断言 service/status/dispose | **不能**（没有任何 saveDoc/flush） | **假绿**：rc.12 下 apply/status/dispose 仍可过，因为从未调用 scheduler；不能作为 AC1/AC2/AC3 锚 |
| F4 | `packages/persistence/test/core-dsh-boundary.test.ts:67–82` | 缺 clock / 缺 timer 的 loud throw 负控 | 只覆盖 service 缺失 | 不覆盖 Root 通道缺失/形状不符；AC1 需要扩展 |
| F5 | `packages/persistence/test/file-persistence.test.ts:468–490` | `createFilePersistencePlugin` + `createManualClockPlugin` + `createFakeTimerPlugin(createTestScheduler())`；直接注入 fake scheduler | **不能** | fake timer plugin 绕过 `ctx.root`；rc.12 下也绿；是“scheduler seam 绿”不是“Root 通道绿” |
| F6 | `packages/persistence/test/memory-persistence.test.ts:84–95`、`issue-79-entry-status.test.ts`、`issue-79-file-entry-status.test.ts`、`file-persistence-sa7-dynamic.test.ts`、`persistence-contract.test.ts` | 显式注入 `createTestScheduler()`/ManualTimer；不经过 Cordis Root | **不能** | 测的是 adapter scheduler seam；契约必须保留，但不能替代 Root 验真 |
| F7 | `packages/persistence/src/testing.ts:122, 159–171` | `createTestScheduler` / `createFakeTimerPlugin` 的 `timeout` 形状 | 不涉及 root | 作为 scheduler 契约形状的参照；不是 Root 证据 |
| F8 | `packages/namespace-registry/test/registry-sa7-rev1.test.ts:396–504`（R5P） | 真实 TimerService + `ctx.plugin(memoryPlugin)` + Registry plugin；gate saveDoc；fiber UNLOADING 窗口；断言 dirty notification 成功、shutdown 先于 adapter dispose、零 unhandled | **能，且是本 Issue 最重要的 AC3 锚** | 默认 npm 4.0.1 绿；rc.12 下预期在 saveDoc reject 处红；必须把 R5P 跑进三基线矩阵，不能只跑默认 |
| F9 | `packages/persistence/test/module-graph-regression.test.ts:56–57, 134–145` | 源码文本正则扫 host-global timer API（有正反样本判别表） | 辅助 | 作为“无 ambient timer”的**辅助静态守卫**；不能单独替代运行时 sentinel 行为断言 |
| F10 | `packages/persistence/test/persistence-issue-412-drain-*.test.ts` | drain 语义/预算/静息观察点；多为 fake timer | 不涉及 Root | AC2 的 drain 场景需要真实 Timer 版本，不能只复用 fake timer |

### 10.3 其他相关位置（本 Issue 不改，但影响验收边界）

| # | 位置 | 行为 | 与本 Issue 关系 |
|---|---|---|---|
| X1 | `packages/ws-replication/src/plugin.ts:214` | `const root = timer.ctx?.root ?? ctx.root`；随后 `typeof root.timeout !== 'function'` throw `required Cordis root timer context is unavailable` | ADR 点名的另一 Host adapter；**本 Issue 明确不改**。rc.12 下它自己也 legacy-only，且导致全仓 typecheck 12 个错误（§15.1） |
| X2 | `packages/ws-replication/test/ws-replication-plugin.test.ts:24–25, 41`、`ws-replication-issue299-ac-red.test.ts:173–177`、`ws-replication-issue422-listen-false.test.ts:44, 83–84`、`ws-replication-guard-proxy-consumption.test.ts:101–102` | 测试 fixture 用 `ctx.root` / `typeof ctx.root.timeout` 判别并构造 fake timer 的 `ctx.root` shim | 同 X1；rc.12 类型面下 10 个错误；不在本 Issue 范围 |
| X3 | `packages/namespace-registry/src/plugin.ts:137` | `setTimeout: (cb, ms) => ctx.timeout(cb, ms)`（plugin-lifetime idle timer，不是 root） | 不需要 Root 迁移；不要在 AC7 中误改 Registry |
| X4 | `apps/yjs-server/src/app.ts:299` | `new TimerService(ctx)`；停机链 `registry.shutdown → persistence drain/dispose → root fiber dispose` | ADR §5 的第三方 composition root 行为测试范围；Issue #470 的 AC2/AC6 未点名要求 yjs-server 三基线；可在后续发布收官覆盖，不能拿来替代 Persistence 矩阵 |
| X5 | `packages/namespace-runtime/src/write.ts:214–226` | notifyDirty rejection → `RuntimeWriteFatalError('notify-dirty-failed', true)` | 解释 AC3 的后果：saveDoc reject 不是“无害丢失一次 flush”，而是已提交写被标 fatal |

---

## 11. Ruled-out hypotheses

| 假设 | 排除证据 |
|---|---|
| “把依赖提升到 `^4.1.0` / Timer `^1.2.0` 就获得 symbol Root” | npm cordis 4.1.0 仍是 `root: this`，无 symbol；ADR 0035 已否决；本会话 probe 确认 |
| “Timer 1.2.0 移除了 `ctx.timeout` 或改坏了 root timer” | timer 1.2.0 `vendor/timer/src/index.ts` 与 npm 1.2.0 逐字节相同；`timeout` 实现未变；rc.12 symbol root 上 `timeout` 为 function |
| “Cosmokit 1.9.0 只存在于 DSH，npm 无法取得，所以基线 2 不可搭” | 本会话 `npm view @deepseek-ai/cosmokit versions` 含 1.9.0，`dist.integrity` 可取得；baseline 2 的 timer 1.2.0 peer `~4.1.0`、cosmokit `~1.9.0`，可搭 |
| “rc.12 上插件 apply 就会炸，所以失败在启动期” | 复现显示 boot=true、service provided=true；失败在首次 `saveDoc`；`assertPersistenceHostDependencies` 不检查 Root |
| “Persistence lifecycle/core 需要改” | memory/file adapter 与 lifecycle 不 import cordis；npm 基线全绿；缺口只在 Host 接线叶子 `service.ts` |
| “R5P 在 rc.12 也会绿，因为只测 Registry” | R5P 的 persistence plugin 走 production scheduler，`saveDoc` 在 UNLOADING 窗口内调用；rc.12 下该调用 reject，R5P 的 `{ok:true}`/fatal null 断言会红 |
| “现有 core-dsh-boundary / fake timer 测试已经覆盖 Root” | 它们要么不调用 saveDoc/flush，要么显式注入 scheduler；rc.12 下可全绿，是假绿 |
| “ambient timer 兜底只是理论风险” | 当前实现没有 fallback；failing path 是 TypeError/proxy error。契约仍必须用 sentinel 测试封堵未来引入 fallback |
| “全仓 rc.12 typecheck 只差 Persistence 一个错误” | 实测 13 个：Persistence 1 + ws-replication src 3 + ws-replication test 10（§15.1） |

---

## 12. Acceptance contract and test paths

### 12.1 三基线工件矩阵（source / 获取 / 构建 / 解析断言）

规范夹具根（名称可变，结构不变）：`packages/persistence/test/fixtures/cordis-baselines/`。每个基线必须有独立 `provenance.json`（npm）或 `provenance.json` + DSH clean clone（rc.12），并在**测试开始时先做身份断言**，再跑行为。

| ID | 基线 | 工件来源 | 获取方式 | 构建方式 | 必须断言的解析路径/身份 |
|---|---|---|---|---|---|
| B1 | npm Cordis `4.0.1` + Timer `1.1.3` | npm registry tarballs：cordis `sha512-YBdskTU2Po1kru3GgcUWUbkTsPMA9LkSQDAY8rBkFJeajdgcQad3QPJZE26JyK99Xb6HaASvoXg2DSUTeN/0Nw==`；timer `sha512-IOkey1VNmJwYa5U8bksyMOnM7mtirqjjbWLr3xA8QybLMK0sMooG3a6iJwtvd8P3MFwo3FQibEg+JPixp37MEw==`；cosmokit `1.8.2` `sha512-muBOKtSrUKU5m/xpq8ZXWL6hQ/jgd4PhU2PqH97bcxIiLEJfNwZOGQEx4t/aS/GgxRAR+ra9pMHPMtTHU4sqqA==`（pin 与仓库 lock 一致） | `npm pack` / `pnpm fetch` 到 fixture cache；`--ignore-scripts`；若 cache 命中，必须用 tarball integrity 复核 | 无（用发布版 `lib/`） | ① `import.meta.resolve('@deepseek-ai/cordis')` 从 test 模块与从 `packages/persistence/src/service.ts` 所在目录（`createRequire`）解析到**同一个** realpath；② realpath 必须在 B1 overlay 内；③ package.json name/version 精确 `4.0.1`/`1.1.3`/`1.8.2`；④ tarball integrity 重算匹配 provenance；⑤ runtime probe：legacy 命中、symbol 缺席；⑥ 无第二份 `@deepseek-ai/cordis`（workspace 内 `find`/resolution trace） |
| B2 | npm Cordis `4.1.0` + Timer `1.2.0` | npm：cordis `sha512-CJrjNyBkKn1SfvBQUcgFYKFnLjS+uKrhdMsbHU60xabvi12d+xQ+IQSNlME5Z+B+4Zi6n4BDknKY94tEPeo47w==`；timer `sha512-DTFp2IcK4Xnp0BWG546fwgeKjrBcSm9a9QjCtaV5Ko9hxiB/Cg03FINSNiR7OEbeg7/s4Y7QBxgQYFVYRl9V+g==`；cosmokit `1.9.0` `sha512-5O1S53mZiJyZYcvxxD0Qv1EY7qFPSxbGyD8CbVK6gw7W9FvcXZj2YIX1ZkOqyQQ3Xt2rFkZDHJv0+V3Zmmp8CA==` | 同 B1 | 无（用发布版 `lib/`） | 同 B1，但版本为 `4.1.0`/`1.2.0`/`1.9.0`；**runtime probe 必须仍是 legacy 命中、symbol 缺席**（这是“同名同版本但不是 rc.12”的关键负控） |
| B3 | DSH commit `1511a6ed442c207919142a4b0e6c4916f96d2c3b` 的 vendored Cordis `4.1.0`（rc.12）+ Timer `1.2.0` + Cosmokit `1.9.0` | `github.com/deepseek-ai/deepseek-harness` commit `1511a6ed...`（commit 日期 `2026-11-05T20:34:44+08:00`；subject `chore(cordis): upgrade core to 4.0.0-rc.12`）；`vendor/{cordis,timer,cosmokit}` | `git clone --filter=blob:none --sparse` → `git sparse-checkout set vendor/cordis vendor/timer vendor/cosmokit tsconfig.base.json` → `git checkout --detach <sha>`；**断言 `git rev-parse HEAD` 精确等于 commit 且 `git status --porcelain` 空**；随后 source-built | **source-built**（默认）或 provenance-verified prebuilt。source-built 必须记录：build command、tsc/node 版本、`rootDir/outDir/declarationDir/rewriteRelativeImportExtensions` 设置、`paths` 指向 vendored 依赖；产出 `lib/index.js` + `lib/types/index.d.ts`。**不得**用 npm 4.1.0 工件替代 | ① 同 B1 的双位置解析；② realpath 必须在 B3 overlay（DSH build 目录）内；③ provenance 的 commit 精确、clone clean；④ `git ls-tree` 的 vendored source blob 哈希与 provenance 记录逐文件一致（至少 `vendor/cordis/src/context.ts`、`utils.ts`、timer/cosmokit 全部 `src/*.ts`）；⑤ 构建输出哈希与 provenance 一致；⑥ package.json 版本 `4.1.0`/`1.2.0`/`1.9.0`（**只作辅助，不作形态证明**）；⑦ runtime probe：symbol 命中、legacy 缺席；⑧ `Context.root === Symbol.for('cordis.root')`；⑨ 不得用 npm cosmokit/timer 替换（source 可能逐字节相同，必须靠 realpath + output hash） |

**关键事实**：B3 的 Timer 1.2.0 / Cosmokit 1.9.0 与 npm 同版本**源码逐字节相同**（§9.3）；因此“同名工件替换”对这两个包不能靠 source hash 发现，必须靠 **realpath + provenance + output hash**。B3 的 Cordis 与 npm 4.1.0 源码不同，channel probe 与 content digest 都能发现替换。

### 12.2 AC1–AC9 可执行判据

> 证据位置均为工作树相对路径；`<runner>` = `packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs`（规范入口；名称可变，输出契约不变）。所有测试文件必须被根 `vitest.config.ts` 的 `packages/*/test/**/*.test.ts` 发现，且 runner 必须用 `--passWithNoTests=false` 并先检查文件存在，防止“路径写错=绿”。

#### AC1 — symbol 优先、legacy 兜底、形状不符 loud fail、无 ambient timer

| 项 | 内容 |
|---|---|
| 验证对象 | `createMemoryPersistencePlugin` / `createFilePersistencePlugin` 的 production scheduler 接线；`createCordisPersistenceScheduler` 行为 |
| 证据位置 | 新 `packages/persistence/test/cordis-root-channel.test.ts`；B1/B2/B3 matrix；现有 `core-dsh-boundary.test.ts:67–82` 的 timer 缺失负控保留 |
| 通过判据 | (a) symbol 合法且 legacy 也可读：symbol timer 被 arm、legacy getter 读取次数 = 0、legacy timer arm = 0；(b) symbol 缺席、legacy 合法：legacy timer 被 arm、flush 正常；(c) symbol 存在但 `timeout` 非 function：plugin apply **同步** throw 稳定错误，`ctx.get('nomicorePersistence')` 仍 undefined，legacy 读取次数 = 0、ambient 调度 = 0；(d) 两通道皆缺席：apply 同步 throw 同一稳定错误；(e) `timer` service 缺失/形状不符：apply 同步 throw（沿用现有 `required Cordis service "timer" is unavailable`）；(f) sentinel 测试：提供只记录、不自走的 timer capability，saveDoc 后立即断言写计数=0、sentinel arm=1；不 fire sentinel，等待超过 debounce，断言 flush 未发生；fire 后 flush 发生 ⇒ 未使用 ambient timer |
| 失败判据 | symbol 存在时仍读 legacy；malformed symbol 回落到 legacy；apply 成功、首次 saveDoc 才 TypeError/proxy Error；service 已提供后才失败；ambient timer 让 flush 在 sentinel 未 fire 时发生；错误文案随 ctx 形态变化（不稳定的 TypeError/proxy message） |
| 当前状态 | 红：symbol 优先未实现；rc.12 首次 saveDoc 失败（§5.1）；malformed/双缺席延迟失败 |

#### AC2 — 三基线 × Memory/File 的真实 Timer flush/retry/drain/dispose/service-revoke

| 项 | 内容 |
|---|---|
| 验证对象 | `createMemoryPersistencePlugin`、`createFilePersistencePlugin` 在 B1/B2/B3 的公开插件路径；真实 baseline TimerService |
| 证据位置 | 新 `packages/persistence/test/cordis-root-real-timer.test.ts`；`<runner> --baseline <B1|B2|B3> --suite real-timer`；现有 `persistence-contract.test.ts`、`memory-persistence.test.ts`、`file-persistence.test.ts`、`issue-79-*`、`persistence-issue-412-drain-semantics.test.ts` 作为同基线 contract suite |
| 通过判据 | 对每个基线 × 每个 adapter：<br>• **flush**：`createDoc`（META.docId 设置）→ mutate ROOT → `saveDoc`；saveDoc 返回时 store 写计数仍 0（dirty 登记非同步写）；在 deadline（建议 5s）内 store 出现含最新 generation 的 snapshot；<br>• **retry**：Memory 用 `writeSnapshot` 前 2 次注入失败、File 用“snapshot 路径先放一个目录使 rename 确定性失败”制造 degraded；观察 `getStatus()==='persistence-degraded'`，期间 `saveDoc` 仍 resolve（AC3 的 dirty notification 语义），解除故障后 deadline 内恢复 `ready` 且最终 snapshot 含最新 generation；<br>• **drain**：dirty 状态下 `await instance.drain()`；返回后 store 已提交最新 snapshot；再等待 > debounce，写计数不再增加；<br>• **dispose**：dirty 后直接 `dispose()`；status `disposed`；timer pending = 0；等待 > debounce 无写；load/save 后续响亮拒绝；重复 dispose 幂等；<br>• **service revoke**：`ctx.fiber.dispose()`（或 DSH profile `dispose()`）后 `ctx.get('nomicorePersistence')===undefined`、adapter status disposed、零 unhandled；<br>• **真实 Timer 证据**：instrument baseline `TimerService.prototype.timeout`（或等价可观察计数），断言 flush/retry 期间 arm 次数 > 0；**dispose 后 pending = 0**；drain 后**不要求** pending = 0（ADR 0006 修订节明确 drain 不清调度面），但 drain 后到 stale timer 到期必须零新增写；<br>• 每个 cell 独立记录；三个基线全部绿 |
| 失败判据 | 任一基线 × adapter × 场景红/缺失；使用 fake scheduler 代替真实 Timer；rc.12 在首次 saveDoc 就 reject；retry 未经过真实 Timer 退避；drain 返回后仍有写；dispose 后 timer 仍 fire；service 仍可见；一个基线绿被用来抵销另一个基线红 |
| 当前状态 | B1 已有部分绿（30 tests），但无 matrix 矩阵；B2 仅最小 saveDoc 探针绿；B3 红（§5.1） |

#### AC3 — dependent 卸载期间已接纳写仍完成 dirty notification；adapter 只在既有排空边界后释放

| 项 | 内容 |
|---|---|
| 验证对象 | Persistence plugin 在 `ctx.plugin()` fiber `UNLOADING` 窗口；Registry 依赖排空；adapter dispose 顺序 |
| 证据位置 | 现有 `packages/namespace-registry/test/registry-sa7-rev1.test.ts:396–504` R5P 在三基线 matrix 下运行（可用 `<runner> --suite unload` 只跑 `-t "R5P"` 并断言该名字存在/通过）；新增 `packages/namespace-registry/test/registry-cordis-baseline-unload.test.ts`（可选，若需要保留 baseline 显式断言；不得复制生产逻辑） |
| 通过判据 | (a) saveDoc 被 gate 在 S6；persistence fiber 状态 = `UNLOADING`；adapter dispose 未发生；registry shutdown 未 settle；(b) gate 释放后 write promise `{ok:true}`、`lease.getStatus().runtime?.fatal === null`；(c) 随后 flush 在 deadline 内提交最新 snapshot；(d) registry shutdown settle **严格早于** adapter dispose（事件序）；(e) 零 unhandled rejection；(f) adapter dispose 只在依赖 settle/既有 drain 边界之后；不新增/改变 ADR 0006/0009 的 lifecycle 语义 |
| 失败判据 | saveDoc 在 UNLOADING 窗口 reject；Runtime 进入 `notify-dirty-failed` fatal；adapter 在 shutdown settle 前 dispose；写丢失/零 flush；unhandled rejection |
| 当前状态 | B1 R5P 绿；B2 预期绿（legacy）；B3 红（saveDoc 在 gate 后 reject） |

#### AC4 — rc.12 夹具固定 commit、source-built/provenance、测试开始断言解析路径

| 项 | 内容 |
|---|---|
| 验证对象 | B3 fixture/provenance；`@deepseek-ai/cordis`、timer、cosmokit 的实际解析路径与构建来源 |
| 证据位置 | `packages/persistence/test/fixtures/cordis-baselines/`；新 `packages/persistence/test/cordis-baseline-provenance.test.ts`（或在 channel test 的 `beforeAll` 中做同一组断言）；`<runner> --baseline B3 --suite provenance` |
| 通过判据 | (a) provenance `commit === 1511a6ed442c207919142a4b0e6c4916f96d2c3b`、clone `git rev-parse HEAD` 相同、clone `git status --porcelain` 空；(b) vendored source blob 哈希等于 `git ls-tree -r <sha>`（至少 §12.1 B3 列表）；(c) build command/toolchain 记录完整，输出哈希匹配；(d) 测试开始时从 test 模块与 production `src/service.ts` 目录两处解析三个包，realpath 相同且在 B3 overlay；非 B3 overlay 即失败；(e) package.json 版本精确（辅助）；(f) runtime probe symbol 命中、legacy 缺席；(g) 不允许“版本号正确但工件来自 npm”通过 |
| 失败判据 | 未固定 commit；用 npm 4.1.0 替代；clone dirty/HEAD 不符；source blob 或 output hash 不符；解析路径落在仓库默认 node_modules；测试先跑行为、后补身份断言（顺序不合格）；缺 provenance |
| 当前状态 | 红/缺失：仓库无任何 B3 fixture、无 provenance、无 DSH clone 缓存 |

#### AC5 — 运行时探针证明 npm 基线 legacy、rc.12 symbol；回退/同名替换/通道错配必须失败

| 项 | 内容 |
|---|---|
| 验证对象 | 基线实际 Context 实例的 Root 通道；production 选择通道的行为 |
| 证据位置 | `packages/persistence/test/fixtures/cordis-baselines/root-probe.ts`（只使用 `Reflect` + `Symbol.for('cordis.root')`，不 import production seam）；`cordis-root-channel.test.ts`；negative-control 命令 `<runner> --baseline <id> --fault {fallback|substitute-npm|substitute-rc12|legacy-shim}` |
| 通过判据 | B1/B2：`Reflect.get(ctx,'root')` 是 root context；`Reflect.get(ctx,Symbol.for('cordis.root')) === undefined`；`Context.root` static 不存在/undefined；<br>B3：`Reflect.get(ctx,Symbol.for('cordis.root'))` 是 root context；legacy 在 root ctx 上 `undefined`、在 plugin fiber 上抛 `cannot get property "root" without inject`；`Context.root === Symbol.for('cordis.root')`；symbol root `timeout` 为 function；<br>production 选择：B1/B2 必须走 legacy，B3 必须走 symbol（用 sentinel/precedence 证据，不只看成功）；<br>负控：fallback/substitute/legacy-shim 命令必须 exit != 0，错误码分别为解析不匹配/工件身份不匹配/channel mismatch |
| 失败判据 | probe 只断言“有任意通道”；B3 观察到 legacy 仍通过；npm 观察到 symbol 仍通过；fallback 命令 exit 0；同名替换后 version 通过即通过；负控未执行或未断言失败 |
| 当前状态 | 红/缺失：无 probe、无负控；B3 当前 legacy-only 代码会失败，但无测试把它判红 |

#### AC6 — 每个基线分别通过全仓 typecheck 与 Persistence contract / 真实 Timer / DSH profile 测试；不得相互抵销

| 项 | 内容 |
|---|---|
| 验证对象 | B1/B2/B3 各自的 types + 行为 suites |
| 证据位置 | `<runner> --baseline <id> --mode typecheck`（按根 `package.json` `scripts.typecheck` 的完整 15-project 列表；每个 project 一条日志）；`<runner> --baseline <id> --suite contract|real-timer|dsh-profile|unload`；证据 JSON 每 cell 独立 |
| 通过判据 | **严格读法**：15/15 projects × 3 基线全绿；`packages/persistence/test` 全 suite、`packages/dsh-persistence/test/dsh-profile-acceptance.test.ts`、R5P 在每个基线绿；`--passWithNoTests=false`；每个 suite 用 JSON reporter，断言目标测试名存在且 passed；聚合 `--all` 在任何 cell 失败时 exit != 0，且输出矩阵；<br>**仲裁读法（仅当 SA8 明确批准）**：in-scope project 列表全绿 + 被排除 project 明文列入 known-red debt + 不声称“全仓通过” |
| 失败判据 | 任一 project/ suite 红或缺失；rc.12 的 `ws-replication` 12 错误被 skip/从 tsconfig 删除而未仲裁；一个基线绿抵销另一个；`passWithNoTests` 让空路径绿；只跑默认 node_modules 类型面冒充 baseline typecheck |
| 当前状态 | B1 绿（15/15 + 30 tests）；B2 typecheck 绿（临时 paths 实测）；B3 红：13 errors（Persistence 1 + ws-replication 12）⇒ **严格 AC6 当前不可满足**（§15.1） |

#### AC7 — 不新增公共生产 API；兼容逻辑不扩散到 Persistence 核心或 Registry

| 项 | 内容 |
|---|---|
| 验证对象 | 公共导出面、包清单、源码 diff scope、probe 位置 |
| 证据位置 | 机械 diff gate（§12.4）；新 `packages/persistence/test/cordis-public-surface.test.ts`（runtime `Object.keys` 快照）；fixture `public-surface.base.json`（base 279dba4 的导出名快照） |
| 通过判据 | (a) `packages/persistence/src/index.ts`、`contract.ts`、`lifecycle.ts`、`memory.ts`、`file.ts`、`testing.ts` 与 base 逐字节相同（或仅允许 `service.ts` 改动）；`packages/dsh-persistence/src/index.ts` 与 `packages/namespace-registry/src/**` 零改动；(b) 若新增私有源文件，只允许在 `packages/persistence/src/` 且不被 `index.ts` 导出、只被 `service.ts` import；(c) runtime 导出名快照与 base 完全相同（persistence 主 entry + `/testing` + dsh entry）；(d) 不新增 `exports`/package entry；(e) root probe 只在 test/fixtures，不在 `src/`，不被任何生产模块 import |
| 失败判据 | 新增公共 export / 新包 / 新公共 helper；Registry src 出现 Root 逻辑；Persistence 核心（lifecycle/memory/file/contract）出现 Root 逻辑或 cast；probe 被生产 import；package.json `exports` 变化 |
| 当前状态 | 基线满足；契约需持续机械守住 |

#### AC8 — 不改依赖 range/归属、不改历史 artifacts、不执行真实部署或 patch 移除

| 项 | 内容 |
|---|---|
| 验证对象 | 包清单、lockfile、artifacts、运行命令日志 |
| 证据位置 | §12.4 的 `git diff --exit-code` 命令；`<runner>` 命令白名单/日志；CI evidence |
| 通过判据 | (a) `pnpm-lock.yaml`、根 `package.json`、`packages/persistence/package.json`、`packages/dsh-persistence/package.json`、`packages/ws-replication/package.json` 与 base 逐字节相同；(b) `artifacts/` 与 base 逐字节相同，且验收运行后 `git status --porcelain artifacts/` 空（证据写到 fixture/gitignored 目录，不写 tracked artifacts）；(c) 不新增/改变 Cordis/Timer dependency/peerDependency 归属或 range；fixture 的 npm 安装只发生在 test fixture 目录，不改 workspace 清单/lock；(d) runner 不调用 `dsh`/MABF/`patch`/部署命令，只调用 node/tsc/vitest/git/npm（获取阶段）；(e) 不修改 ADR/文档来“追认”实现 |
| 失败判据 | 任一 manifest/lock/artifacts diff；fixture 安装污染 workspace lock；执行真实 MABF/DSH 部署或 patch 移除；改 ADR 以绕过判据；用 `git update-index`/忽略文件隐藏 diff |
| 当前状态 | base 满足（artifacts/manifest diff = 0）；契约需守住 |

#### AC9（derived）— Host 不需要新增配置或条件装配

| 项 | 内容 |
|---|---|
| 来源 | 简报 “What to build”：`Host 不需要新增配置或条件装配`（checklist 无独立 checkbox；本文派生） |
| 验证对象 | `createMemoryPersistencePlugin` / `createFilePersistencePlugin` / `createDshPersistenceProfile` 的公开 options 与默认装配 |
| 证据位置 | `cordis-root-channel.test.ts` 默认 options 用例；dsh profile 默认 options 用例；`public-surface.base.json`；manifest diff |
| 通过判据 | (a) 默认 options（无 root/channel/baseline 参数）在 B1/B2/B3 均可 boot + saveDoc + flush；(b) 生产代码无 `process.env`/baseline 分支/feature flag/条件 import 选择 Cordis 形态；(c) Host 装配顺序仍是 clock → timer → persistence；(d) DSH profile options 形状不变 |
| 失败判据 | 新增必填 option、env var 或 feature flag；Host 必须显式传 Root 通道；按工件版本分支装配；probe/fixture 逻辑进入生产装配 |
| 当前状态 | 基线满足（无新配置）；rc.12 当前失败是能力缺失，不是配置问题 |

### 12.3 Root 通道运行时探针（规范判据）

探针必须**独立于 production seam**：只 import baseline 的 `Context`/`TimerService`，用 `Reflect` + `Symbol.for('cordis.root')`，不 import `service.ts`/任何 `@nomicore/persistence` 内部 helper。

| 观察项 | B1/B2（npm legacy） | B3（DSH rc.12） |
|---|---|---|
| root ctx `Reflect.get('root')` | root context | `undefined` |
| root ctx `Reflect.get(Symbol.for('cordis.root'))` | `undefined` | root context |
| child/plugin ctx `Reflect.get('root')` | root context（原型继承） | `undefined`（root-derived ctx）或 **throw** `cannot get property "root" without inject`（fiber ctx） |
| `Context.root` static | `undefined` | `Symbol.for('cordis.root')`（`===`） |
| `root.timeout` / `symbolRoot.timeout` | function | function |
| production choice（sentinel） | legacy timer arm > 0；symbol arm = 0 | symbol timer arm > 0；legacy getter read = 0；legacy arm = 0 |

失败条件（任一即红）：probe 只能报告“某通道存在”而非精确期望；B3 legacy 命中；npm symbol 命中；production 在 symbol 合法时读 legacy；malformed symbol 回落；两通道皆缺席时 apply 不 throw；ambient timer 被使用。

### 12.4 机械检查（AC7/AC8；不依赖源码字符串行为断言）

> 这些是**仓库形状/工件清单** gate，不是行为证明；行为由 AC1–AC6 的 runtime 断言承担。所有命令使用 `set -e` 风格：非零即失败。

```bash
BASE=279dba4ac81b7c7520e3d0b87b5c4d621a86a517

# 1) 依赖范围/归属与历史 artifacts 不变
git diff --exit-code "$BASE" -- \
  pnpm-lock.yaml package.json \
  packages/persistence/package.json \
  packages/dsh-persistence/package.json \
  packages/ws-replication/package.json \
  artifacts/

# 2) 生产源码 diff scope：只允许 service.ts（或经 SA8 allowlist 的单个私有文件）
git diff --name-only "$BASE"..HEAD -- \
  packages/persistence/src packages/dsh-persistence/src packages/namespace-registry/src

# 期望：
#   packages/persistence/src/service.ts
# 若出现任何其它文件（尤其 lifecycle.ts / memory.ts / file.ts / contract.ts /
# index.ts / testing.ts / packages/namespace-registry/src/**）→ 失败。
# 若新增私有文件：必须不在 index.ts 的 export 列表，且只被 service.ts import。

# 3) 公共导出面 runtime 快照（test/fixtures 内的 base 快照）
#    测试文件 cordis-public-surface.test.ts 对以下三个 entry 取 Object.keys().sort()
#    与 public-surface.base.json 严格相等，再断言 package.json exports 未变：
#      @nomicore/persistence
#      @nomicore/persistence/testing
#      @nomicore/dsh-persistence
```

额外机械 gate：

- `git status --porcelain artifacts/` 必须为空；验收 evidence 只能写 `packages/persistence/test/fixtures/cordis-baselines/evidence/`（gitignored）或 CI artifact，不写 tracked `artifacts/`。
- `git diff --exit-code "$BASE" -- docs/adr/`：不得通过改 ADR/文档追认实现。
- fixture 目录内的 `package.json`/lock 只允许在 `packages/persistence/test/fixtures/**`；不得出现在 workspace `packages/*/package.json` 或根 lock。
- `rg -n "process\.env|CORDIS_BASELINE|ROOT_CHANNEL|rc\\.12" packages/persistence/src packages/dsh-persistence/src`：生产 src 不得出现 baseline/通道选择的环境分支（AC9）。该检查是辅助形状 gate，最终仍以默认 options 行为为准。

### 12.5 运行入口与命令（规范）

```bash
# 1) 默认基线（B1 现成布局）聚焦验证
NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run \
  packages/persistence/test/cordis-root-channel.test.ts \
  packages/persistence/test/cordis-root-real-timer.test.ts \
  packages/persistence/test/cordis-baseline-provenance.test.ts \
  packages/persistence/test/persistence-contract.test.ts \
  packages/persistence/test/memory-persistence.test.ts \
  packages/persistence/test/file-persistence.test.ts \
  packages/persistence/test/core-dsh-boundary.test.ts \
  packages/persistence/test/issue-79-entry-status.test.ts \
  packages/persistence/test/issue-79-file-entry-status.test.ts \
  packages/persistence/test/persistence-issue-412-drain-semantics.test.ts \
  packages/dsh-persistence/test/dsh-profile-acceptance.test.ts \
  packages/namespace-registry/test/registry-sa7-rev1.test.ts \
  --passWithNoTests=false

# 2) 单基线全量（runner 负责 materialize overlay/provenance；命令名可变，输出契约不变）
node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs \
  --baseline B1 --mode typecheck --suite contract --suite real-timer \
  --suite dsh-profile --suite unload --suite provenance --suite root-probe

node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs \
  --baseline B2 --mode typecheck --suite contract --suite real-timer \
  --suite dsh-profile --suite unload --suite provenance --suite root-probe

node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs \
  --baseline B3 --mode typecheck --suite contract --suite real-timer \
  --suite dsh-profile --suite unload --suite provenance --suite root-probe

# 3) 聚合（一个基线绿不得抵销另一个；任一 cell 红 → exit != 0）
node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs --all --matrix

# 4) 负控（必须实际执行并断言 exit != 0）
node .../run-baseline.mjs --baseline B3 --suite root-probe --fault fallback
node .../run-baseline.mjs --baseline B3 --suite root-probe --fault substitute-npm
node .../run-baseline.mjs --baseline B2 --suite root-probe --fault substitute-rc12
node .../run-baseline.mjs --baseline B3 --suite root-probe --fault legacy-shim
```

Runner 输出契约（每 cell）：`{ baseline, suite, status: pass|fail, resolvedRealpaths, provenanceDigest, testNames, logPath }`；`--all` 输出完整 3×N 矩阵，任一 `status=fail` 或单元格缺失 → 非零。

### 12.6 当前红/绿矩阵（契约执行前的真实状态）

| Cell | B1 npm 4.0.1 | B2 npm 4.1.0 | B3 DSH rc.12 | 说明 |
|---|---|---|---|---|
| 工件 fixture/provenance | 现成 pnpm layout；无 fixture provenance | **缺** | **缺** | AC4 红/缺失 |
| Root probe | legacy（已实测） | legacy（已实测） | symbol（已实测） | 行为事实已取得；测试设施缺失 |
| production channel | legacy 工作 | legacy 工作（最小探针） | **red：legacy-only** | AC1/AC2/AC3 |
| 全仓 typecheck | 15/15 OK | exit 0（临时 paths） | **13 errors** | AC6 严格读法红 |
| Persistence contract | 30 tests 中已覆盖部分绿 | 未跑全量 | 未跑全量；最小 saveDoc 红 | AC2/AC6 |
| 真实 Timer flush/retry/drain/dispose | 部分有真实 Timer（R5P/profile）；无 B1 matrix | 未跑 | 未跑；预期首次 saveDoc 红 | AC2 |
| unload R5P | 绿 | 预期绿 | **预期红** | AC3 |
| DSH profile | 绿 | 未跑 | **预期红** | AC6 |
| 公共 API/manifest/artifacts | 基线满足 | 基线满足 | 基线满足 | AC7/AC8 待 gate |

---

## 13. Red/green or baseline evidence

### 13.1 绿面（证明失败不是环境/fixture 入口错误）

- 默认全仓 typecheck：15/15 project OK。
- 默认聚焦测试：4 files / 30 tests passed，Type Errors: no errors。
- npm 4.1.0 类型面 full typecheck：exit 0。
- npm 4.1.0 最小 runtime：两种 ctx 形态 saveDoc ok。
- rc.12 root probe：`symbolIsRoot=true`、`symbolHasTimeout=function`，证明 rc.12 工件本身完好。

### 13.2 红面（契约必须判红，且红在目标原因）

| 红判据 | 当前证据 |
|---|---|
| rc.12 上 `ctx.root` 不存在 | TS2576 at `service.ts:54`；runtime `undefined` |
| rc.12 首次 saveDoc reject | 3/3 TypeError（root ctx）或 proxy Error（fiber） |
| rc.12 会升级为 notify-dirty-failed fatal | `namespace-runtime/src/write.ts:214–226`；R5P 的 `{ok:true}`/fatal null 断言会失败 |
| rc.12 全仓 typecheck 不可能仅靠 Persistence 变绿 | 12 个 ws-replication TS2576（§15.1） |
| 当前测试无法判红 rc.12 | core-dsh-boundary 不调 saveDoc；fake timer 测试绕过 root；无 baseline matrix |

### 13.3 断言敏感性（反证）

- 若把 production seam 改回 legacy-only，AC1 的 symbol 优先 sentinel 测试必须红（legacy arm>0 / symbol arm=0）。
- 若把 symbol root 换成 npm 4.1.0，AC5 的 B3 legacy 断言必须红。
- 若删掉 `saveDoc` 的 dirty notification 或调度，AC3 的 R5P `writePromise`/flush 断言必须红。
- 若把 baseline overlay 回退到仓库默认，AC4 的解析路径断言必须红。
- 若新增公共 export，AC7 的 runtime 快照必须红。
这些反证由 §6.2 负控与 §12.4 diff gate 承担；不得用“删除断言/改名测试/跳过文件”取得绿。

---

## 14. Runner trigger evidence

| 项 | 证据 |
|---|---|
| 根 vitest 发现规则 | `vitest.config.ts`：`include: ['packages/*/test/**/*.test.ts', 'domains/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts']`；`passWithNoTests: true`（**验收 runner 必须覆盖为 false**） |
| 根 test 入口 | `package.json` `scripts.test = "NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck"`；`scripts.typecheck` 15 个 project |
| 现有真实锚可触发 | 本会话 `./node_modules/.bin/vitest run ...` 实际执行 4 files/30 tests，exit 0；R5P 名字/计数可在 JSON reporter 中核对 |
| 新测试文件可被真实 entry 发现 | 新文件放在 `packages/persistence/test/*.test.ts`、`packages/namespace-registry/test/*.test.ts`，匹配 `packages/*/test/**/*.test.ts`；不得放 `wiki/`/`artifacts/` |
| 单基线隔离运行 | runner 必须显式给出文件列表并用 `--passWithNoTests=false`；先 `fs.existsSync` 检查每个目标文件；只运行矩阵选中的文件，不依赖默认 include 的偶然覆盖 |
| 基线与默认隔离 | runner materialize 临时 workspace（排除 `node_modules`/`.git`/`wiki`/`artifacts`），按各 package 的声明依赖重建 workspace links；不得把全部 `@nomicore/*` 平铺到 root（否则 `core-dsh-boundary` 的 `import.meta.resolve('@nomicore/dsh-persistence')` 守卫会假红） |
| pnpm 环境 | 本会话 corepack pnpm 版本不匹配；runner 用 `./node_modules/.bin/vitest`/`tsc` 或显式 `corepack pnpm@10.28.2`，不得依赖裸 `pnpm` |

---

## 15. Unknowns, blockers, and external dependencies

### 15.1 **Blocking conflict：AC6 全仓 typecheck vs “Replication 留待后续 ticket”**

- Issue AC6 原文：`每个基线分别通过全仓 typecheck 与现有 Persistence contract、真实 Timer、Nomicore DSH profile 相关测试；一个基线的绿色结果不得抵销另一基线失败。`
- ADR 0035 §5 原文：`每个目标基线分别执行全仓 typecheck 和同一组外部行为测试；一个基线的绿色结果不得抵销另一个基线失败。`
- Dispatch/Issue 范围：`本 Issue 只做 Persistence 范围，Replication 留待后续 ticket`；ADR 点名的另一 Host adapter = `packages/ws-replication/src/plugin.ts`。
- 实测：rc.12 类型面下全仓 typecheck **13 errors**：
  - `packages/persistence/src/service.ts:54` ×1；
  - `packages/ws-replication/src/plugin.ts:214` ×3；
  - `packages/ws-replication/test/ws-replication-plugin.test.ts:24,25,41`、`ws-replication-issue299-ac-red.test.ts:173,177`、`ws-replication-issue422-listen-false.test.ts:44,83,84`、`ws-replication-guard-proxy-consumption.test.ts:101,102` ×10。
- 结论：不修改 `packages/ws-replication` 就无法通过严格“全仓 typecheck”；修改它则违反“Replication 留待后续 ticket”。三种出路都不满足全部原文：
  1. **扩展本 Issue 范围**到 ws-replication 生产 seam + 4 个测试 fixture（违反 dispatch 范围，但满足 AC6/ADR）；
  2. **把 AC6 改为 in-scope project 列表**并明文记录被排除的 ws-replication known-red debt（违反“全仓”字面，且接近 skip/降级，ADR §5 不允许用降级替代）；
  3. **接受 AC6 红并带债收口**（违反 AC6 checkbox）。
- 需 SA8/Host 明确选择并记录；本契约提供两种可执行读法（§12.2 AC6 严格/仲裁），但**不自行选择**。这是 `conflict` verdict 的唯一原因；诊断与其余 AC 契约可信。

### 15.2 网络/构建依赖（失败策略：响亮失败，不降级）

| 依赖 | 用于 | 是否可离线 | 必须如何失败 |
|---|---|---|---|
| npm registry（cordis 4.0.1/4.1.0、timer 1.1.3/1.2.0、cosmokit 1.8.2/1.9.0） | B1/B2 fixture | 若本地 cache 有且 integrity 复核通过则可离线 | 缺任一 tarball/integrity 不符 → `acquire` 阶段 exit != 0；**不得**用仓库默认 4.0.1/1.1.3 代替 B2 |
| GitHub DSH commit | B3 fixture | 不可离线（除非已有 clean clone cache，仍须复核 HEAD/clean/source blobs） | clone/checkout/blob 任一失败 → exit != 0；**不得**用 npm cordis 4.1.0 或旧 rc.3 checkout 代替；ADR 明确禁止 rc.3 POC 作证据 |
| Node >= 24.9（DSH root engines） | B3 build/runtime | 环境事实 | Node <24.9 → B3 响亮失败/单独 Node 24 job；**不得 skip B3** |
| TypeScript 5.9 / `rewriteRelativeImportExtensions` | B3 source build | 本地依赖 | 构建配置无法复现 → 失败；不得改用未记录的手工拼接产物 |
| 真实 Timer / wall clock | AC2/AC3 | 本地 | 超过 deadline → 失败（可重试 3 次仍失败即红）；不得用 fake timer 替代真实 Timer 验收 |
| Filesystem rename 语义（File retry） | AC2 File retry | 本地 | 目录占位法在不支持的平台（如 Windows 行为差异）→ 该 cell 响亮失败并要求 Linux CI，不能用 skip 代替 |

### 15.3 不可验收的边界（明确声明）

1. **真实 MABF/DSH 部署、Host 侧 patchedDependencies 移除**：ADR 0035 §6 明确排除；本 Issue 不部署、不 patch、不宣称 Host 可删 patch。仓库内最多能证明“未执行部署命令”，不能证明外部环境状态。
2. **DSH 官方构建流水线等价性**：本会话用 tsc 最小 source build 验证了 rc.12 行为；若 SA8 要求 DSH 官方 `tsc -b`+`tsdown` 产物，必须把官方 build command 写入 provenance 并重跑，不能用本会话的最小构建冒充。ADR 只要求“从该 revision 的 vendored 源码构建，或 provenance-verified”，最小 source build 在字面上满足，但属于需要 SA8 确认的解释边界。
3. **同名工件替换的对抗性**：fixture cache 若被有写权限的人伪造 provenance/path，验收无法提供密码学签名；本契约的威胁模型是“误解析/误替换/回退”，不是恶意篡改宿主缓存。
4. **Timer 在所有 DSH profile 都构造于 root ctx**：本契约按 ADR/Host 文档假设 root-scoped Timer；若 Host 实际在子 ctx 构造 Timer，AC1 要求 loud fail（这是正确行为），但“DSH profile 真实部署”仍不在本 Issue 验收范围。
5. **全仓 typecheck 字面 AC6**：见 §15.1，当前不可满足；不以“默认 node_modules typecheck 绿”冒充。
6. **跨平台 File retry 故障注入**：目录占位法依赖 POSIX rename 行为；若 CI 只保证 Linux，需在 evidence 记录；Windows 差异不得用 skip 掩盖。
7. **历史 npm registry 元数据**：integrity 是当前取得的 registry 元数据；npm 不保证永久可重放 UI 页面，但 tarball-by-integrity 是当前最强工件绑定。

### 15.4 其他已知环境/事实风险

- **Controller 环境事实过时**：声称 `cosmokit 最高 1.8.1（1.9.0 只存在于 DSH）`；实测 npm registry 已有 `1.9.0`（且 `1.8.2`/`1.8.3`…）。这提高了“用 npm 1.9.0 冒充 DSH vendored”的风险，必须靠 realpath/provenance，不能靠版本。
- **pnpm/corepack 版本不匹配**：裸 `pnpm` 在本环境不可用；验收命令必须显式本地二进制或 `corepack pnpm@10.28.2`。
- **DSH vendored Timer/Cosmokit 源码与 npm 逐字节相同**：source hash 不能区分；必须 output hash + realpath + provenance。
- **现有测试假绿**：`core-dsh-boundary`、fake timer 注入、`dsh-profile-acceptance` 的 fake timeline 部分都不能在 rc.12 上暴露 Root 缺失；验收不能只跑它们。
- **`service.ts`/memory/file 选项注释与实现不一致**：memory/file 选项注释写 `ctx.timeout`，实际 `ctx.root.timeout`；如果设计照注释做，会把 rc.12 问题误判为已解决。

---

## 16. 现存缺口清单（Issue 要求 vs 仓库事实）

| ID | 缺口 | 证据 | 对应 AC |
|---|---|---|---|
| G1 | 生产 scheduler 只读 legacy `ctx.root`，无 symbol 通道 | `service.ts:54`；rc.12 复现 | AC1/AC2/AC3 |
| G2 | 无显式 Root 解析缝，无 symbol 优先/legacy 兜底/形状检查 | `service.ts:48–56`；全仓仅 `ws-replication` 有 root 形状检查（且也 legacy-only） | AC1 |
| G3 | Root 缺失/形状不符不是 apply 时 loud fail，而是首次 saveDoc 的 TypeError/proxy Error | rc.12 复现 3/3；`assertPersistenceHostDependencies` 只查 timer service | AC1 |
| G4 | 无 rc.12 fixture、无 DSH clone/build、无 provenance | `packages/persistence/test/fixtures/` 不存在该目录；全仓无 `1511a6e` 引用（除 ADR） | AC4/AC5 |
| G5 | 无 npm 4.1.0 + Timer 1.2.0 fixture | 仓库 lock 只有 4.0.1/1.1.3；无 overlay | AC2/AC6 |
| G6 | 无三基线 matrix runner / 无隔离 workspace | `vitest.config.ts` 单一 root resolution；`pnpm typecheck` 单一 node_modules | AC2/AC6 |
| G7 | 无解析路径断言设施 | 仅 `core-dsh-boundary` 有 `import.meta.resolve('@nomicore/dsh-persistence')`（反向依赖守卫，非工件身份） | AC4/AC5 |
| G8 | 无 Root 运行时探针 / 无 precedence / malformed / 双缺席 / 负控 | 全仓 `ctx.root` grep 无 probe；无 `Symbol.for('cordis.root')` 生产/测试引用 | AC1/AC5 |
| G9 | 无每基线 typecheck harness | 默认 `tsc` 只对 npm 4.0.1 类型面；rc.12 实测 13 errors | AC6 |
| G10 | 无 rc.12 上的 R5P/unload matrix | R5P 只在默认 npm 4.0.1 跑过（本会话绿） | AC3/AC6 |
| G11 | 无 DSH profile 三基线运行；fake timeline 部分绕过真实 Root | `dsh-profile-acceptance` 用 `createProbeTimeline`；默认 profile 用仓库 TimerService | AC2/AC6 |
| G12 | 无公共导出面/清单/artifacts 机械 gate | 现有 `core-dsh-boundary` 只查 DSH 依赖方向；无 export snapshot、无 artifacts diff gate | AC7/AC8 |
| G13 | **AC6 全仓 typecheck 与 Replication 留待后续 scope 冲突** | rc.12 typecheck 12 个 ws-replication 错误；§15.1 | AC6（blocker） |
| G14 | Issue checklist 8 条 vs dispatch 称 9 条 | brief L21–L28；本文派生 AC9 | 全 |
| G15 | Controller 的 cosmokit 版本事实过时 | `npm view @deepseek-ai/cosmokit versions` 有 1.9.0 | AC4/AC5 风险 |
| G16 | pnpm/corepack 版本不匹配 | `pnpm typecheck` 被 corepack 拒绝；本会话改用本地二进制 | 环境/runner |
| G17 | DSH build 需 Node >=24.9；仓库 engines >=20 | DSH root package.json；本机 24.13 | AC4/AC6 环境 |
| G18 | Timer/Cosmokit 的 vendored 与 npm 源码逐字节相同 | §9.3 | AC4/AC5 风险 |
| G19 | 现有 Persistence 测试在 rc.12 上假绿 | `core-dsh-boundary` 不调 saveDoc；fake timer 绕过 root | AC2/AC3 |
| G20 | memory/file 选项注释写 `ctx.timeout`，实际 `ctx.root.timeout` | `memory.ts:24–29`、`file.ts:33–37` | AC1 诊断 |
| G21 | `assertPersistenceHostDependencies` 只检查 timer service，不检查 Root | `service.ts:26–35` | AC1 |
| G22 | 无 `Symbol.for('cordis.root')` 的生产/测试引用 | 全仓 grep 为空（除 ADR） | AC1/AC5 |

---

## 17. 明确不做（scope guard）

1. **不设计实现方案**：本文不决定 Root helper 放在哪个文件、是否用 `Reflect.get`、是否需要新私有模块；这些交给 SA8/设计。
2. **不写实现代码**：不修改 `packages/persistence/src/**`、`packages/dsh-persistence/src/**` 或任何生产文件。
3. **不写可执行测试代码**：不创建 `*.test.ts`/fixture/probe 文件；只给判据、路径、命令与失败条件。
4. **不修改 `packages/ws-replication`**：本 Issue 只做 Persistence；Replication 迁移不在本文范围（但它是 §15.1 的 blocker，需要仲裁）。
5. **不改依赖范围或 dependency/peerDependency 归属**；不新增 npm 依赖；fixture 安装不得污染根 lock。
6. **不改历史 `artifacts/`**；不写 REPORT.md/.mabf-done 等 marker；不创建 PR/commit/push/finalize。
7. **不执行真实 MABF/DSH 部署、不 patch 移除、不修改 Host 侧配置**。
8. **不修改 ADR/文档**来追认实现；ADR 0035 仍为提议，生产迁移状态由实施票更新。
9. **不把默认 npm 4.0.1 的绿当作 rc.12 证据**；不把 fake timer 测试当作真实 Timer 证据；不把“版本号 4.1.0”当作 rc.12 证据。
10. **不新增公共生产 API**；不把兼容逻辑扩散到 Persistence 核心或 Registry（AC7）。

---

## 附录 A：本会话工件哈希/版本证据（诊断用，非规范性构建配方）

| 项 | 值 |
|---|---|
| npm cordis 4.0.1 integrity | `sha512-YBdskTU2Po1kru3GgcUWUbkTsPMA9LkSQDAY8rBkFJeajdgcQad3QPJZE26JyK99Xb6HaASvoXg2DSUTeN/0Nw==` |
| npm timer 1.1.3 integrity | `sha512-IOkey1VNmJwYa5U8bksyMOnM7mtirqjjbWLr3xA8QybLMK0sMooG3a6iJwtvd8P3MFwo3FQibEg+JPixp37MEw==` |
| npm cordis 4.1.0 integrity | `sha512-CJrjNyBkKn1SfvBQUcgFYKFnLjS+uKrhdMsbHU60xabvi12d+xQ+IQSNlME5Z+B+4Zi6n4BDknKY94tEPeo47w==` |
| npm timer 1.2.0 integrity | `sha512-DTFp2IcK4Xnp0BWG546fwgeKjrBcSm9a9QjCtaV5Ko9hxiB/Cg03FINSNiR7OEbeg7/s4Y7QBxgQYFVYRl9V+g==` |
| npm cosmokit 1.8.2 integrity | `sha512-muBOKtSrUKU5m/xpq8ZXWL6hQ/jgd4PhU2PqH97bcxIiLEJfNwZOGQEx4t/aS/GgxRAR+ra9pMHPMtTHU4sqqA==` |
| npm cosmokit 1.9.0 integrity | `sha512-5O1S53mZiJyZYcvxxD0Qv1EY7qFPSxbGyD8CbVK6gw7W9FvcXZj2YIX1ZkOqyQQ3Xt2rFkZDHJv0+V3Zmmp8CA==` |
| DSH commit | `1511a6ed442c207919142a4b0e6c4916f96d2c3b`，2026-11-05T20:34:44+08:00，`chore(cordis): upgrade core to 4.0.0-rc.12` |
| DSH vendored 版本 | cordis 4.1.0 / timer 1.2.0 / cosmokit 1.9.0 |
| DSH source blob 示例 | `vendor/cordis/src/context.ts` = `951a0ddae440787d15798144370bf57508c390d3`；`utils.ts` = `4337b9d6c213ef90f47b982675e92302ba117f9a`；`vendor/timer/src/index.ts` = `8d133e5c7ffab583e4612d51217d203b7913de72`；`vendor/cosmokit/src/types.ts` = `0aab4420c16776750ae4c5891ec3d6c3a1a8231b` |
| 本会话 rc.12 构建输出示例（非规范） | cordis `lib/index.js` sha256 `dbc5668cf4f6e728a0173dbbebace107d30d56ffe5698356f8e07cd3a9f57551`；timer `c450ed6cd120a92e936966d8e486b7524f8f888afbac3b25d87310d313e9c5ed`；cosmokit `79fdda555a902d1bbb66f93d2d5af13f2766ecd044916bb782967137dd5d6d69`（tsc 5.9.3 最小构建，不能替代 fixture 自己记录的 provenance） |
| npm timer 1.2.0 vs DSH timer source | `src/index.ts` SHA-256 均为 `abea90efa55dadef02ea7ef7810d5f1a578bacf1db78f0d376548efdde4875cc`（逐字节相同） |
| npm cosmokit 1.9.0 vs DSH cosmokit source | 7 个 `src/*.ts` SHA-256 全部相同（§9.3） |

## 附录 B：AC → 缺口 → 验收组映射

| AC | 缺口 | 验收组 | 当前红/绿 |
|---|---|---|---|
| AC1 | G1/G2/G3/G20/G21/G22 | `cordis-root-channel.test.ts`；B1/B2/B3 matrix | rc.12 红；npm 绿 |
| AC2 | G4/G5/G6/G9/G11/G19 | `cordis-root-real-timer.test.ts` + matrix suites | B1 部分绿；B2 最小探针绿；B3 红 |
| AC3 | G10/G19 | R5P 矩阵 + 事件序断言 | B1 绿；B2 预期绿；B3 红 |
| AC4 | G4/G7 | provenance + resolution 断言 | 缺失/红 |
| AC5 | G8 | root probe + 负控 | 缺失/红 |
| AC6 | G9/G13 | `--mode typecheck` + suites | B1/B2 绿；B3 红（scope blocker） |
| AC7 | G12 | diff gate + export snapshot | 基线满足；待 gate |
| AC8 | G12/G18 | manifest/artifacts diff + 命令白名单 | 基线满足；待 gate |
| AC9（derived） | G6/G20 | 默认 options + 无 env/分支 | 基线满足；rc.12 能力缺失 |
| 条数 | G14 | checklist 8 + derived 1 | 记录 |

---

**结论**：诊断证据足以支持“当前 Persistence 在 rc.12 上不具备双形态 Root 能力”这一能力缺口；AC1–AC5、AC7–AC9 的判据可执行、可判真假；AC6 在严格“全仓 typecheck”读法下被 `packages/ws-replication` 的 out-of-scope legacy 读取阻塞（13 个 TS2576，12 个在 Replication），需 SA8/Host 在“扩展 Issue 范围 / 修改 AC6 为 in-scope / 接受 known-red debt”之间仲裁。除该 scope 冲突外，本文契约可进入设计/实现阶段。
