# SA6 诊断与验收契约 — issue #471：Cordis rc.12 Hub/Peer/SessionHost 全链兼容

状态：**approve**（诊断可信、契约可执行；本轮未发现生产实现红线缺陷——见 §5.1，禁止把本票写成 bug 红灯票）
HEAD：`d59a4d141c6c5ac7f267295829157d9570cde36e`（worktree 分支 `mabf/issue-471`；本提交即 PR #473「Merge pull request #473 from nomicore-ai/mabf/issue-470」，其三项提交为 `473f83e` / `9f5afda` / `bcc1c75`，父提交 `279dba4` = ADR 0035 提议提交）
任务类型：**feature（验收能力 / 三基线行为矩阵 + 验收设施扩展）**；不是 bug 修复，也不是纯 refactor
写面：**仅本文件**。本会话未修改 `packages/**`、`apps/**`、`docs/**`、`artifacts/**`、根清单或任何仓库内测试；`git status --porcelain` 只有 Host 提供的两个 untracked brief/dispatch 与本文件（§19）

---

## 1. Task type and inputs

- **任务类型**：feature。目标能力 = 「Hub、Peer、免 listen SessionHost 在 B1/B2/B3 三个精确工件基线上，通过现有公开 plugins/services 完成启动、连接 timer 调度与取消、drain/stop、服务撤销和重新挂载」的**可执行验收能力**；以及把 Ticket 1（#470）的工件验真设施扩展到 Replication 行为面，且不建立第二套机制。
- **本票不是 bug 票的证据**：本会话在 HEAD `d59a4d1` 上以三基线真实 `TimerService` 实测（§5.1、§9.1）——hub/peer/sessionhost 的 hello/bootstrap/backoff/liveness timer 均在三基线正确武装、触发、取消；双形态 Root 优先级与兜底在三基线全部成立。**因此本契约不主张「生产实现在目标断言处失败」**；红灯维度是「验收证据缺失 + 矩阵口径不含这些 cell」以及「矩阵一旦建立后可能暴露的真实缺陷」。
- **输入与缺失输入**：

| 输入 | 位置 | 状态 / 用途 |
|---|---|---|
| Host 任务简报 | `wiki/raw/task_issue-471.md`（untracked） | Issue 正文：Parent PR #469、What to build、**9 条** Acceptance criteria、`Blocked by: #470`、`## Comments` 空 |
| Dispatch 台账 | `wiki/raw/task_issue-471_dispatch.md`（untracked） | Round 1、唯一 SA6、base `d59a4d1`、`gh api .../issues/471/comments --paginate → []` |
| 架构决策（normative） | `docs/adr/0035-cordis-rc12-root-compatibility.md`（提议，tracking #468） | 双形态 Root、三基线矩阵、工件绑定、`Reflect.get` 形态、生命周期不变、验收须绑定解析路径与通道 |
| 交叉 ADR（normative） | `docs/adr/0032-transport-decoupling-edge-session-split.md`（已接受）；`docs/adr/0010`、`0012`、`0023`、`0006`、`0009` | edge/session 拆分的冻结面；plugin 所有权；冻结服务面构造纪律；drain/dispose 与 Host 停机序 |
| wire 契约（normative） | `docs/protocols/instance-replication-v1.md`（1154 行；§21 停机、§24 γ 缝） | 关闭/排空/重认证语义与帧布局不变的依据 |
| 宿主接入契约 | `docs/integration/cordis-plugin-hosting.md` L14–L66、L454–L488 | Instance → Clock/Timer → Persistence → Registry → replication 装配序；单条拆卸链；Timer 覆盖整个排空过程 |
| 模块契约 | `packages/ws-replication/AGENTS.md`、`packages/persistence/AGENTS.md`、`packages/namespace-registry/AGENTS.md`、`apps/yjs-server/AGENTS.md` | 各自验证门与冻结面 |
| #470 全量证据 | `wiki/raw/task_issue-470_sa6_acceptance_contract.md`(§12/§15.1/§16)、`task_issue-470_conflict_report.md`(R1–R9)、`task_issue-470_design.md`(§8/§11)、`task_issue-470_sa3_impl.md`、`task_issue-470_sa9_standards.md`(§8)、`task_issue-470_sa10_spec.md` | 继承/扩展/取代账本（§3）；三基线口径（§14） |
| #470 交付工件（本会话实测可复用） | `packages/persistence/test/fixtures/cordis-baselines/{baselines.json,acquire.mjs,run-baseline.mjs,root-probe.mjs,gates.mjs,provenance-b3.json,public-surface.base.json}`；`packages/persistence/test/{cordis-baseline-provenance,cordis-root-channel,cordis-root-real-timer,cordis-public-surface}.test.ts` | 复用面评估见 §5.2、§12（AC7） |
| 运行期产物（未入库） | `.cache/cordis-baselines/{overlay,dsh,workspaces,evidence}/` | 本会话由 `acquire.mjs --all` 现购现建（§4.1） |
| **缺失输入** | `wiki/raw/task_issue-471_sa8_*`、`_design.md`、`_relevant_decisions.md`、`_conflict_report.md` | **全部不存在**（iteration 0）。替代约束面 = 简报 + ADR 0035 + #470 R1–R9 + 模块 AGENTS；不影响契约可执行性（但 §18 列出 SA8 必须追认的 3 项） |
| Issue 评论 | `gh api repos/nomicore-ai/nomicore/issues/471/comments --paginate` → `[]`（本轮实跑） | **无 owner 附加要求**；issue 标签 `bug`/`in-progress`，state OPEN，updated_at `2026-11-14T17:03:12Z` |

- **AC 条数核对**：Issue 正文 checklist **恰 9 条**（brief L21–L29），本报告逐条编号 AC1–AC9，**不派生第 10 条、不合并、不改写**。与 #470（owner checkbox 8 条 + derived AC9）不同，本票无 derived 项——`What to build` 的每一句都被 9 条 checkbox 覆盖。

---

## 2. Owner comment mapping

- Issue #471 **无任何评论**（本轮 `gh api` 实跑返回 `[]`；dispatch 台账同结论）。无 owner 追加要求、无豁免、无 override。
- 需求面 = Issue 正文 9 条 AC + `What to build` 叙事 + `Parent: PR #469` + `Blocked by: #470`（已由 PR #473 合并而解除）+ ADR 0035 决策 1–6。
- 逐条映射（不增不减）：

| Issue 原文锚点 | 本报告 | 语义 |
|---|---|---|
| L21 Host timer adapter symbol 优先/legacy 兜底/loud fail/无 ambient timer | AC1 | 能力形态与失败纪律 |
| L22 Hub/Peer/SessionHost 免 listen × 三基线 × 七场景 | AC2 | 行为矩阵主体 |
| L23 Registry→Persistence、Replication→Registry 单向拆卸；waiting 不成环；watchdog/有界 drain 保留 | AC3 | 生命周期与拆卸结构 |
| L24 Timer 由 Host 最后释放；不得把 dependent tracking 当自动依赖边；直接 apply profile 的显式 dispose 顺序不变 | AC4 | 所有权与释放顺序 |
| L25 现行 Host fixtures 的 legacy Root 直读全部迁移；npm 与 rc.12 通道都有行为证据 | AC5 | 迁移完备性 + 双通道证据 |
| L26 Registry/Hub/Peer/Clock 冻结 getter 继续过 guard-Proxy；公共类型/服务名/wire/持久化布局不变 | AC6 | 冻结面回归 |
| L27 复用 Ticket 1 工件验真夹具、模块解析断言与 Root 通道探针；不建第二套 | AC7 | 设施复用 |
| L28 每基线全仓 typecheck + Registry Cordis/Hub-Peer plugin/SessionHost/guard-Proxy/DSH profile/第三方组合根测试 | AC8 | 三基线验收口径 |
| L29 不采用 volatile config / internal config-update-commit 事件；不改历史 artifacts；不真实部署或 patch 移除 | AC9 | 边界与禁令 |

---

## 3. SA8 constraints（#470 R1–R9 的继承 / 扩展 / 取代账本）

本 Issue 尚无自己的 SA8 工件，因此**唯一可用的绑定裁决**是 #470 冲突报告 §8 的 R1–R9（`wiki/raw/task_issue-470_conflict_report.md` L160–L170）。这些裁决对 #470 是「本票」级约束；对 #471 必须先分类再继承，否则会出现「用上一票的范围裁决否决本票 owner 文本」的错误。

| #470 裁决 | 对 #471 的效力 | 说明 |
|---|---|---|
| **R1** 全仓 typecheck = 根 `scripts.typecheck` 15-project 清单，逐基线全绿、逐 project 留证；禁子集/known-red/默认 node_modules 冒充/tsconfig 掩蔽 | **原样继承** | AC8 直接落在 R1 上（§14） |
| **R2** ws-replication 允许改动面 = `src/plugin.ts`（或单个包内私有 seam）+ **恰好 4 个具名 fixture**；其余零改动 | **扩展（须 #471 SA8 追认）** | #470 的「恰好 4 个」是 #470 的收口边界；本票 AC2/AC5/AC8 要求新增 replication 行为测试，必然超出该集合。**不是冲突**：R2 的语义是「#470 不扩大改动面」，非「ws-replication 永久只允许这 5 个文件」 |
| **R3** ws-replication 在 #470 = 编译面 + seam 语义 + B1 门禁；**不承担三基线行为矩阵**，不得宣称三基线行为兼容 | **被本票取代（显式）** | 见 §18 S1：R3 明确把三基线行为矩阵「留后续票」；#471 即该后续票，owner 文本 L22/L28 直接要求三基线行为验收。ADR 0035 §5 L92 的行为清单亦点名 Hub/Peer/SessionHost。取代无 ADR 冲突 |
| **R4** seam 决策形态：symbol 优先、legacy 兜底、同步 loud fail（稳定文案）、无 ambient timer、包内私有、cast 不扩散、生命周期语义不变 | **原样继承** | 本票 AC1 的形态判据逐条落 R4；AC1 额外固定 **`timer.ctx` → `ctx` 两跳级联**（§12 AC1-6） |
| **R5** B3 provenance 8 项（commit 钉死/clean、ls-tree blob、构建配方、输出哈希、双位置 realpath、symbol 探针、四负控实跑、非官方流水线诚实标注） | **原样继承** | AC7 要求复用同一套 identity 判据，不重写 |
| **R6** AC 账本：owner checkbox 恒 8 条、AC9 恒标 derived | **仅对 #470 有效** | #471 owner checklist = **9 条**；不得把 #470 的 8+derived 账本套到本票（会吞掉一条 AC） |
| **R7** 机械 gate 增补：ws diff allowlist、`src/index.ts` 零 diff、公共面快照含 ws entry、manifest/lock/artifacts gate | **扩展（须 #471 SA8 追认）** | allowlist 需按本票新增测试文件更新；`index.ts` 零 diff、manifest/lock/artifacts 零 diff 原样保留 |
| **R8** ADR 0023 冻结面：hub/peer 服务对象 accessor + freeze 构造不动；guard-Proxy 断言面原样保留 | **原样继承** | AC6 覆盖；扩展为 clock/registry/sessionhost 四处同纪律 |
| **R9** 无阻塞性 Host/owner 问题 | **原样继承** | 本票同样无阻塞（§17） |

---

## 4. Environment and baseline

### 4.1 环境事实（本轮实测）

| 项 | 值 / 证据 |
|---|---|
| 运行时 | Node `v24.13.0`；TypeScript `5.9.3`；vitest `3.2.7`；tsx `4.23.12` |
| 仓库 | `git rev-parse HEAD` = `d59a4d1…`；`git status --porcelain` = `?? wiki/raw/task_issue-471.md`、`?? wiki/raw/task_issue-471_dispatch.md`（+本文件） |
| **依赖安装缺失（本轮起始事实）** | 本 worktree 起始 **无 `node_modules`**（`ls node_modules` → No such file）。以 `corepack pnpm@10.28.2 install --frozen-lockfile` 安装成功（65 packages，`Done in 500ms`），workspace 链接（`packages/*/node_modules/@nomicore/*`、`@deepseek-ai/*`）到位 |
| pnpm | 裸 `pnpm` 被 corepack 拒绝（ambient `11.28.5` ≠ `packageManager: pnpm@10.28.2`）→ 必须 `corepack pnpm@10.28.2` 或本地二进制（`./node_modules/.bin/{tsc,vitest}`） |
| **基线缓存缺失（本轮起始事实）** | `.cache/cordis-baselines/` 起始不存在。`acquire.mjs --all` 现购：B1/B2 npm tarball（integrity 复核）+ B3 DSH `1511a6ed…` sparse clone 与最小 tsc source-build。**首次 B3 构建失败** `Cannot find module '@types/node/package.json'`（因依赖未安装）；装依赖后成功 → 记录为**环境前置条件**，不是产品缺陷 |
| 网络 | npm registry 可达（`npm view @deepseek-ai/cordis version` → `4.1.0`）；`git ls-remote https://github.com/deepseek-ai/deepseek-harness.git HEAD` 可达 |

### 4.2 三基线工件矩阵（ADR 0035 §1；本轮实际身份）

| ID | 组成 | 实际取得的身份 | Root 通道（探针实测） |
|---|---|---|---|
| **B1** | npm Cordis `4.0.1` + Timer `1.1.3` + Cosmokit `1.8.2` | overlay `node_modules` 三包版本逐个复核 = `4.0.1`/`1.1.3`/`1.8.2` | legacy `ctx.root` |
| **B2** | npm Cordis `4.1.0` + Timer `1.2.0` + Cosmokit `1.9.0` | `4.1.0`/`1.2.0`/`1.9.0`（**同名同版本但不是 rc.12**：关键负控） | legacy `ctx.root` |
| **B3** | DSH commit `1511a6ed442c207919142a4b0e6c4916f96d2c3b` vendored Cordis `4.1.0`（rc.12 行为）+ Timer `1.2.0` + Cosmokit `1.9.0` | `provenanceDigest = 9d6633550e82c2960ec58e31a8626af7482d53ad323a612c0dce2f3e0a44221c`；三包 `4.1.0`/`1.2.0`/`1.9.0`（最小 tsc source-build，非 DSH 官方 `tsc -b + tsdown`——诚实标注沿用 #470） | `Symbol.for('cordis.root')` |

> 本契约**不扩大**支持基线：其他 Cordis/Timer 版本与后续 DSH master 仍未验证（ADR 0035 §1 L41）。

### 4.3 本轮已取得的基线证据（全部可复核，路径见附录 A）

| 检查 | 命令 | 结果 |
|---|---|---|
| 三基线全仓 typecheck | `node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs --baseline B{1,2,3} --mode typecheck` | **3 × 15/15 projects，exit 0，零失败**（`evidence/B*/B*-typecheck.json`） |
| `ws-package`（#470 的 4 个具名 fixture） | 同上 `--suite ws-package` × 3 基线 | **66/66 × 3，pass**（`evidence/B*/ws-package.json`） |
| 第三方组合根 | 三基线 workspace 内 `vitest run apps/yjs-server/test/third-party-composition-red.test.ts` | **3/3 × 3，pass** |
| ws-replication 整包（B3，除 probe） | 三基线 workspace B3 内 `vitest run packages/ws-replication/test` | **104 文件 / 941 tests passed；4 failed = 既有 `ws-replication-issue421-edge-factory-api.test-d.ts` 类型 lane**（#470 SA10 §5 已记录为 BASE 既有红，非本票引入） |
| Rc.12 真实 Timer 行为探针 | `.cache/cordis-baselines/sa6-probe/issue471-probe.test.ts`（本会话新增诊断脚本，**未入库**） | **10/10 × 3 基线 pass**（§9.1） |
| 通道优先级 / 兜底 / loud fail 探针 | 同上 | **同 10 项内含 6 项，× 3 基线 pass**（§9.2） |
| 变异反证 | 在 workspace 副本内注入两处 seam 变异（§9.4） | 现有 4 fixture **66/66 全绿**（不敏感）；探针 2/10 定向红（敏感） |

---

## 5. Positive reproduction / capability gap

### 5.1 生产岸能力现状：**已绿**（禁止伪称红灯）

本会话以三基线真实 `TimerService`（`new TimerService(ctx)`，与 `apps/yjs-server` 及 hosting 文档 L98 同款）实测 HEAD `d59a4d1` 的生产 seam：

| # | 场景（探针） | B1 | B2 | B3 | 观察到的机制 |
|---|---|---|---|---|---|
| P1 | hub listen：apply → `accept` → hello timer（35 ms）武装并**触发**（transport `close(1002)`）→ `fiber.dispose()` 后 pending=0 → 服务撤销 → 重新挂载 ready | ✅ | ✅ | ✅ | `timerFromContext(ctx)` → `createHubReplication({timer})` |
| P2 | hub：HELLO→ready 后 liveness ping timer（40 ms）武装、ping 实际发出、pong timer（12 ms）超时 → `close(1001,'pong-timeout')` | ✅ | ✅ | ✅ | 同一注入 wrapper 传给 `startLiveness` |
| P3 | peer：dial → hello timer（30 ms）超时关闭 → backoff 重拨 timer（full-jitter `random=0.5` → 200 ms）武装 → `stop()` 后 pending=0；**`stop()` 是 drain 不是 revoke**（服务仍可见、state=`stopped`）；`fiber.dispose()` 后才 `/unavailable/` | ✅ | ✅ | ✅ | `timerFromContext(ctx)` → `createPeerReplication({timer})`（含 `waitForLive` 轮询） |
| P4 | 免 listen SessionHost：`listen:false` → 真实 registry namespace → `open` + `OPEN_NAMESPACE` → bootstrap timer（4321 ms）武装 → `stop()` 后 pending=0、sessions=0 → `fiber.dispose()` 撤销 → 重新挂载 ready | ✅ | ✅ | ✅ | `timerFromContext(ctx)` → `createHubSessionHost({timer})` |
| P5 | symbol 优先（symbol + legacy 双通道时 legacy getter 读取次数 = **0**）、legacy 兜底、malformed symbol **不回落**（稳定文案 `required Cordis root timer context is unavailable`，服务不 provide）、双缺席同文案 | ✅ | ✅ | ✅ | `tryResolveRootTimer` 的两通道顺序 + `safeReadChannel` 归一 |
| P6 | 对 sessionhost / peer 入口重复 P5 的 legacy-only 通道 | ✅ | ✅ | ✅ | 三入口共用同一 seam |

**结论**：`packages/ws-replication/src/plugin.ts:200–298` 的双形态 Root 缝在 HEAD 上**已经覆盖** Hub、Peer、免 listen SessionHost 的启动、timer 触发/取消、显式 stop、Fiber dispose、服务撤销与重新挂载，并在三基线成立。这不是本票的「待修缺陷」。

### 5.2 验收岸能力缺口（本票的真实缺口，逐条可复核）

| ID | 缺口 | 事实证据（HEAD） | 影响 AC |
|---|---|---|---|
| **G1** | **三基线行为矩阵不存在**：runner 的 `--all --matrix` 只把 `ws-package` 挂在 B1（`run-baseline.mjs` 主流程 `runBaselineCells('B1', {…suites:['ws-package']})`），且 #470 设计 §8.6/§8.8 明文把 B2/B3 的 `ws-package` 定为「允许的附加证据、非验收条件」 | `run-baseline.mjs` 主流程 + `task_issue-470_design.md` §8.6 行「**B1 专属 cell**…B2/B3 上运行本 suite 属允许的附加证据」 | AC2/AC8 |
| **G2** | **legacy 兜底通道零测试覆盖**：4 个已迁移 fixture 的 fake timer 一律只注入 **symbol-only** root 宿主（`ctx: { [Symbol.for('cordis.root')]: { timeout } }`），生产 seam 的 legacy 分支在任何基线上都不被走到 | `grep "ctx: {"` → 4 文件各一处，形如 `ctx: { [Symbol.for('cordis.root')]: { timeout: timer.timeout } }` | AC1/AC5 |
| **G3** | **真实 baseline TimerService 与 replication 行为无任何交叉**：`packages/ws-replication/test/**` 内零 `TimerService` 引用；`ws-package` 用 effect-fake timer（内部还是原生 `setTimeout`） | `grep -rn "cordis-plugin-timer\|TimerService" packages/ws-replication` → 仅 `src/plugin.ts:2` 的类型 import | AC1/AC2 |
| **G4** | **timer 族覆盖不完整**：ACK（bulk-transfer kind=2 自持 ACK）、periodic reconcile interval、fence-watchdog 双节奏、reauth/close drain deadline、peer `waitForLive` 轮询 timer 均**无**三基线证据（本会话 P1–P4 只覆盖 hello/bootstrap/backoff/liveness） | `grep -c "timer\.\(setTimeout\|clearTimeout\|dispose\)"` ：hub-namespace 8、peer-namespace 8、peer-connection 10、liveness 5、hub-edge 4、hub-edge-host 4、backpressure 2、hub-connection 2 | AC1/AC2 |
| **G5** | **两跳级联无测试**：seam 先读 `timer.ctx` 的 Root、再回落 plugin `ctx` 的 Root；现有 fixture 只构造第一跳（`timer.ctx` = symbol-only 假宿主），第二跳（`timer.ctx` 无通道 / `undefined`）无覆盖 | `plugin.ts:269–271`；4 个 fixture 的 `dependencies()` 都直接给 `timer.ctx` | AC1 |
| **G6** | **第三方组合根未进矩阵**：`apps/yjs-server`（deployable composition root，`new TimerService(ctx)` + 两 replication plugin + 单条拆卸链）只在默认布局跑过；三基线无 cell（本会话手跑 3/3 绿，但仓库不强制） | `run-baseline.mjs` suites 清单无 app 面；`apps/yjs-server/test/third-party-composition-red.test.ts` 未列入任何 suite | AC3/AC4/AC8 |
| **G7** | **拆卸序/所有权无三基线断言**：`replication-drained → registry-stopped → persistence-disposed → app-stopped` 的次序只在默认布局的 app 测试里断言；「Timer 在 persistence dispose 之后仍可武装」无任何断言；「不得靠 dependent tracking 自动释放 Timer」无断言 | `apps/yjs-server/test/issue270-regression-anchors.test.ts:120–128`；全仓无 `ctx.get('timer')` 存活性断言 | AC3/AC4 |
| **G8** | **runner 注册面必须同步**：`run-baseline.mjs` 的 `NEW_FILES` 常量是 materialize 的白名单并集（`copyNewFiles` 对缺失文件**响亮 exit 2**）；新增测试文件不入该表即不可运行；`baselines.json.suites` 是 suite 白名单（未知 suite 直接 `fail('usage')`） | `run-baseline.mjs:67–79`（NEW_FILES）、`:50`（`BASELINE_SUITES`）、`:138–140`（unknown suite） | AC7/AC8 |

> **诚实边界**：G1–G8 都是「证据/设施」缺口，不是「产品行为」缺口。本票完成后若矩阵在某 cell 判红，那才是行为缺口，按 §12 的失败判据处理；**不得**在矩阵尚未建立时声称「Replication 三基线行为已验证」，也不得反过来声称「生产实现在 rc.12 上坏掉」。

---

## 6. Negative control

### 6.1 本轮已执行的正/负对照

| 对照 | 目的 | 结果 |
|---|---|---|
| B1（npm 4.0.1，legacy 通道）正控 | 基线可用性 | 66/66 + 10/10 + 15/15 projects 全绿 |
| B2（npm 4.1.0，**同名同版本但仍 legacy**）负控 | 证明「版本号 = rc.12」是伪判据 | 同 B1 全绿；探针 legacy 命中 |
| B3（DSH rc.12，symbol 通道）目标基线 | 目标工件 | 同 B1 全绿；探针 symbol 命中、legacy 缺席 |
| 真实 vs 假 timer 对照 | 证明 `ws-package` 的假 timer 不构成真实 Timer 证据 | `ws-package` 用的 `effectTimer` 内部是原生 `setTimeout`（`ws-replication-plugin.test.ts:46–70`）；本会话另以真实 `TimerService.prototype.timeout` 插桩取得 P1–P4 |
| 变异 M-1：删除 legacy 兜底（仅 workspace 副本） | 证明现有 fixture 对 legacy 分支**不敏感**、契约探针**敏感** | 见 §9.4 |
| 变异 M-2：legacy 优先（仅 workspace 副本） | 证明现有 fixture 对**优先级**不敏感、契约探针敏感 | 见 §9.4 |

### 6.2 契约要求新增的负控（实现阶段必须真跑并断言失败）

1. **通道错配负控**：把 B3 的 `@deepseek-ai/cordis` 链接指回 npm 4.1.0（复用 #470 `--fault substitute-npm`），replication 行为 cell 必须红（provenance/realpath 或行为面通道断言）。
2. **legacy shim 负控**：在 B3 的受控 ctx 上注入 legacy `root` 属性（复用 `NOMICORE_CORDIS_FAULT=legacy-shim`），通道断言必须红（证明「legacy 缺席」断言不能被 shim 蒙混）。
3. **回归灵敏度负控**：在**测试副本**里把 seam 改成 legacy-only 或 legacy-first（本会话 M-1/M-2 已验证可行），新行为测试必须定向红；现有 4 fixture 允许仍绿（这正是缺口证明）。
4. **ambient timer 负控**：只记录、不自走的 sentinel timer 存在时，任何 hello/bootstrap/backoff/liveness 都不得自行发生（错用 `setTimeout` 即红）。

> 负控纪律：`--passWithNoTests=false`、目标测试名必须存在且 passed、`fault` 命令外层 exit 0 **当且仅当**内层 observed=fail（#470 既有语义，原样复用）。

---

## 7. Stability, scale and timing

| 维度 | 要求 |
|---|---|
| 时序 | 所有等待用**谓词轮询 + deadline**（建议 5 s），禁固定 sleep 轮数；deadline 耗尽 = 红，不是 skip |
| 重复性 | 行为 suite 每基线 `--repeat 3` 顺序运行，任一 repeat 红即该 cell 红（沿用 #470 real-timer 口径） |
| 竞态 | timer 触发 vs `stop()` 的窗口用**显式闸门/observer 事件**拉开（`settled`/`channel-state-changed`），不用睡眠凑；对同一 cell 至少记录一次「触发前 stop」与「触发后 stop」两条路径 |
| 规模 | 不引入大载荷：connection timer 用 ms 级 timeout（10–50 ms）、bootstrap 用可辨识 delay（如 4321）以便凭 arm 记录识别；ACK/reconcile 用最小 delta（≥1 次） |
| 抖动 | peer backoff 是 full-jitter（`random()*cap`）→ 测试必须注入 `random: () => 常量`，断言确定性 delay，不得依赖墙钟 |
| 资源 | 每 cell 结束必须 `fiber.dispose()` + `ctx.fiber.dispose()`；禁止遗留真实 TCP listener（`listen` 用注入 adapter 或以 `port: 0` + 立即 close） |
| 平台 | B1/B2 npm tarball 与 B3 tsc 构建依赖 Node ≥ 24.9（B3 侧）；不满足 = 响亮失败，不得 skip |

---

## 8. Root-cause chain / capability gap

本票无 bug 根因链；以下为**能力缺口链**（承接 §5.2）：

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| 1 | Ticket 1 只交付 replication 的**编译面 + seam 语义 + B1 包门禁**，行为矩阵被显式推迟 | `task_issue-470_conflict_report.md` R3、`task_issue-470_sa10_spec.md` §6 行「Replication 三基线行为矩阵 + apps/yjs-server 行为 → 是（可留后续票）」 | 高（明文） |
| 2 | 因此 runner 的 suite 清单里没有任何「replication 行为」suite；`--all` 只把 `ws-package` 挂 B1 | `run-baseline.mjs` 主流程；`task_issue-470_design.md` §8.6/§8.8 | 高（代码 + 设计） |
| 3 | 被迁移的 4 fixture 为「基线无关」目的把 fake root 宿主写成 **symbol-only**，于是 legacy 分支在 B1/B2/B3 都不被走到 | 4 处 `ctx: { [Symbol.for('cordis.root')]: { timeout } }` | 高（代码） |
| 4 | 行为面的真实 Timer 交叉为零 → 「timer 触发/取消」在 B2/B3 上无任何仓库内证据 | `grep TimerService packages/ws-replication/test` 空；本会话 P1–P4 为新写探针 | 高（代码 + 实测） |
| 5 | 变异实验证明缺口是**可证伪的**：删 legacy 兜底 / 反转优先级后，现有 66 个断言全绿 | §9.4 | 高（实跑） |
| 6 | 生产 seam 本身已覆盖全部调用点（唯一 Cordis 面 = `plugin.ts`；其余 src 零 Cordis 依赖） | §10.1 清单 + 探针 P1–P6 | 高（实跑） |

**放大因素**：`NEW_FILES` / `suites` 白名单是硬门（G8）——新 suite 不注册就根本跑不起来，容易诱使实现者「在 ws 包内自建 runner」，那会直接违反 AC7（第二套验真机制）。

---

## 9. Causal experiments

### 9.1 三基线真实 TimerService 行为探针（P1–P4）

- **最小输入**：`new Context()` → `createInstancePlugin().apply` → `ctx.plugin(createSystemClockPlugin())` → `new TimerService(ctx)` → `ctx.plugin(createMemoryPersistencePlugin())` → `ctx.plugin(createNamespaceRegistryPlugin())` → 目标 replication plugin。
- **观测手段**：在 `new TimerService(ctx)` **之前** patch `TimerService.prototype.timeout`，记录每次 `{delay, fired, disposed}`（与 #470 `cordis-root-real-timer.test.ts` 同款纪律：patch 必须先于 TimerService 构造/provide）。
- **断言**：arm 记录中存在配置的 delay 值；触发产生可观察后果（`close(1002)` / `close(1001,'pong-timeout')` / ping 计数 > 0）；`dispose()`/`stop()` 后同类 delay 的 outstanding = 0；重新挂载 ready。
- **结果**：B1/B2/B3 各 10/10 pass（探针文件 `.cache/cordis-baselines/sa6-probe/issue471-probe.test.ts`，可复跑，§附录 A）。

### 9.2 通道优先级与两跳级联（P5–P6）

- 假 timer service = `{ timeout, ctx: <宿主> }`，宿主取 5 种形态：symbol-only / legacy-only / both（legacy getter 计数）/ malformed symbol + legacy / `{}`。
- 断言：symbol-only ready；legacy-only ready；both 时 `legacyReads === 0`；malformed 时 apply 同步 throw 稳定文案且 `legacyReads === 0` 且服务未 provide；`{}` 时同文案；sessionhost/peer 入口重复 legacy-only。
- 结果：三基线一致通过（说明 seam 的 `timer.ctx` 第一跳与 `ctx` 第二跳都按 ADR 0035 §2 语义工作；第二跳**尚无仓库内测试** = G5）。

### 9.3 工件身份与解析路径（复用 #470 设施，本轮未重写）

- `acquire.mjs` 每轮复核 tarball integrity / DSH `rev-parse` / `git status --porcelain` / `ls-tree` blob / 输出哈希（实测：B3 `provenanceDigest 9d663355…`）。
- `root-probe.mjs` 独立于生产 seam，按基线给精确通道期望（B1/B2 legacy、B3 symbol）。
- 本会话以**同一 runner** 取 B1/B2/B3 证据，未新建 acquire/probe。

### 9.4 变异反证（M-1 / M-2，仅 workspace 副本，已还原）

| 变异 | 注入点（workspace 副本） | 现有 4 个已迁移 fixture | 本会话探针 |
|---|---|---|---|
| **M-1** 删除 legacy 兜底（symbol 缺席 → 直接 `throwRootTimerUnavailable`） | `tryResolveRootTimer` 内 `legacyRoot` 两支替换为 `return undefined` | **66/66 pass（不敏感）** | **2/10 红**：`legacy channel alone is accepted`、`legacy-only fake host also works for session-host and peer` |
| **M-2** legacy 优先（先读 `'root'` 再读 symbol） | 交换两通道读取顺序 | **66/66 pass（不敏感）** | **2/10 红**：`symbol wins when both channels exist (legacy read count = 0)`、`malformed symbol does not fall through to legacy` |

- 意义：AC1/AC5 要求的「双通道行为证据」不是形式主义——现有套件对这两类回归**完全没有判别力**。
- 清理：两处变异均在 `.cache/cordis-baselines/workspaces/B3` 内，已用原始备份还原，并与 `git show HEAD:packages/ws-replication/src/plugin.ts` 做 `diff` 校验**逐字节一致**；仓库工作树 `git status` 无变化（§19）。

---

## 10. Impact surface

### 10.1 生产岸：唯一 Cordis 面 = `packages/ws-replication/src/plugin.ts`

- `grep "from '@deepseek-ai/cordis'" packages/ws-replication/src/*.ts` → **仅 `plugin.ts:1`**（type-only import）。
- `declare module '@deepseek-ai/cordis'` → 仅 `plugin.ts:169`（服务面类型声明）。
- `ctx.provide` / `ctx.effect` → 仅 `plugin.ts:584/675/783`（三处有序 effect）。
- 因此 Root 兼容面**不可能**扩散到 `hub-edge.ts` / `hub-edge-host.ts` / `hub-session-host.ts` / `hub-session-async-host.ts` / 状态机（ADR 0035 §2 L56 的 cast 不扩散自动满足，且必须由 gate 守住）。

### 10.2 注入 `ReplicationTimer` 的子组件（零 Cordis 依赖，只消费 wrapper）

| 文件 | timer 调用点（`timer.setTimeout/clearTimeout` 计数） | 语义 |
|---|---|---|
| `hub-connection.ts` | 2 | auth（upgrade 认证封顶）timer |
| `hub-edge.ts` | 4 | hello timer、reauth drain deadline |
| `hub-edge-host.ts` | 4 | 同上的 host 形态 |
| `hub-namespace.ts` | 8 | bootstrap / close / assembly 三槽 + ACK 族 |
| `peer-connection.ts` | 10 | hello、backoff、reset、drain-close |
| `peer-namespace.ts` | 8 | 同 hub-namespace |
| `liveness.ts` | 5 | ping 周期 + pong 超时（双 timer） |
| `backpressure.ts` | 2 | poll timer（水位） |
| `fence-watchdog.ts` | 0 直接调用（经 `host.armTimer`/`clearTimer`） | 双节奏 watchdog：idle 探测每 `ackTimeoutMs` 重武装；微任务链预算 4096 |
| `bulk-transfer.ts` | 0 直接调用 | kind=2 自持 ACK 语义登记；实际武装点是宿主的 `armTimer('assembly')`（`hub-namespace.ts:1050`） |
| `hub-upgrade-admission.ts` | 0 直接调用 | accept() 认证超时的**台账**（arm 点在 `hub-connection.ts:179`） |
| `validate.ts` | 0（形状校验） | 各工厂入口校验 `options.timer.{setTimeout,clearTimeout}` 为函数（非函数 → 响亮 `TypeError`）——AC1 的「形状不符 loud fail」在工厂层已有承载 |
| `plugin.ts` | 6 | seam wrapper 自身 + peer `waitForLive` 轮询（25 ms） |

> 结论：**所有** timer 最终来自 plugin 的 `OwnedTimer`（`timerFromContext` 构造物）；`createHubReplicationEdge` / `createHubSessionHost` / `createHubAsyncSessionHost` 是**非 Cordis 工厂**，timer 由宿主注入——它们不读 `ctx.root`，其验收口径是「注入的 timer 被正确使用」（§12 AC2-EDGE）。

### 10.3 测试夹具与组合根（本票必须触碰的验收设施面）

| 位置 | 现状 | 本票要求 |
|---|---|---|
| `packages/ws-replication/test/ws-replication-plugin.test.ts` 等 4 个具名 fixture | symbol-only 假宿主；66 断言 | 保留原断言面；**不要求**改写为双通道（双通道证据由新测试承担，避免削弱既有基线无关性） |
| `packages/ws-replication/test/harness.ts` | `createRegistryTestScheduler()` 等测试调度器 | 允许作为「注入 timer」用于既有单元面；**不得**作为真实 Timer 证据 |
| `packages/persistence/test/fixtures/cordis-baselines/*` | 3 基线 acquire/runner/probe/gates | **扩展点**：新增 suite 注册 + NEW_FILES + `--all` 接线 + gate allowlist |
| `apps/yjs-server/test/third-party-composition-red.test.ts` | 3 个组合根断言（默认布局） | 提升为三基线 cell；新增拆卸序与 Timer 存活断言 |
| `apps/yjs-server/test/issue270-regression-anchors.test.ts`、`on-fatal-error-issue288.test.ts` | 默认布局的次序断言 | 在三基线运行（作为 AC3 证据载体） |

---

## 11. Ruled-out hypotheses

| 假设 | 排除依据 |
|---|---|
| 「rc.12 上 ws-replication plugin 根本无法 apply（root 解析炸）」 | 探针 P1–P6 三基线全绿；`ws-package` 66/66 on B3 |
| 「`TimerService.timeout` 在 rc.12 上需要特殊绑定，seam 会 detached-call 崩」 | seam 以对象方法调用（`rootTimer.timeout(...)`）；P1–P4 大量 arm 无异常 |
| 「B2（npm 4.1.0）其实就是 rc.12，所以 B2/B3 可互相替代」 | `root-probe` 口径：B2 legacy、B3 symbol；探针 P5 在 B2 走 legacy 分支通过、B3 走 symbol 分支通过——同名同版本但形态互斥（ADR 0035 背景 L18） |
| 「现有 4 fixture 已覆盖双通道（因为三基线都绿）」 | 变异 M-1/M-2：66/66 仍绿 ⇒ 对通道回归零判别力（§9.4） |
| 「`stop()` 会撤销服务」 | 探针 P3：peer `stop()` 后 `requirePeerReplication` 仍返回服务（state=`stopped`）；撤销在 fiber dispose。契约据此把「显式 stop」与「服务撤销」分成两个可观测断言（AC2） |
| 「Timer 会被 persistence 卸载自动释放（dependent tracking），Host 无需显式管理」 | `apps/yjs-server` 在根 ctx 上 `new TimerService(ctx)`，第 4 步才 `ctx.fiber.dispose()`；宿主文档 L488 明确「Timer 生命周期必须覆盖整个排空过程」。AC4 要求断言「persistence dispose 之后 timer 仍可武装」 |
| 「`packages/ws-replication/test/ws-replication-issue301-…test.ts` 直读 `ctx.root`」 | 该文件 `timer: hubNode.scheduler`（`createRegistryTestScheduler()`，见 `harness.ts`），是**直引工厂 + 注入假 timer**，零 Cordis `ctx.root`。全仓 `ctx.root` 直接读取在本轮 grep 中只剩 `plugin.ts` 的一行**注释**与 harness helper 名 `ctx.root(...)`/`rootValue(...)`（§12 AC5 的 gate 必须按此区分） |
| 「ADRC 0035 要求的 `Reflect.get(ctx, Symbol.for('cordis.root')) ?? Reflect.get(ctx,'root')` 形态被 ws seam 改坏了」 | seam 保留两通道顺序，并额外保留 legacy 的 host 级联（`timer.ctx?.root ?? ctx.root`）；P5/P6 与变异 M-2 均以优先级断言锁住 |

---

## 12. Acceptance contract

### 12.0 通用判据

- 证据载体一律为**工作树相对路径**；运行期 JSON 证据写 `.cache/cordis-baselines/evidence/<baseline>/<suite>.json`（未入库）；任何 cell 缺证据 = **不通过**。
- 所有 cell 必须被根 `vitest.config.ts` 的 `packages/*/test/**/*.test.ts` 或 runner 显式文件清单发现；`--passWithNoTests=false`；测试名必须出现在 JSON reporter 输出中且 `status=passed`。
- 行为断言只观察**运行时行为**（arm/触发/关闭码/事件序/服务可见性/导出名集合）；**禁止**以源码字符串/正则断言冒充行为验证（机械 gate 只用于形状/清单，且必须与行为证据分列）。
- 每条 AC 的失败判定都含同一句：**「无证据即不通过」**——不得以「实现看起来正确」「另一基线已绿」「root-test 大面已绿」替代。

### 12.1 AC1 — Host timer adapter 双形态解析（symbol 优先 / legacy 兜底 / loud fail / 无 ambient timer）

| 项 | 内容 |
|---|---|
| **可观测断言** | **A1-1 优先级**：同时提供 symbol 与 legacy 通道 → symbol 被用于 arm（arm 计数 > 0）、legacy getter 读取次数 = **0**、legacy arm = 0。<br>**A1-2 兜底**：仅 legacy 通道 → 三条入口（hub listen / peer / sessionhost listen:false）全部 ready 且 timer arm > 0。<br>**A1-3 形状违规**：symbol 存在但 `timeout` 非函数 → `plugin.apply(ctx)` **同步** throw `required Cordis root timer context is unavailable`；legacy 读取次数 = 0；`ctx.get(service)` 仍 undefined；零 timer arm。<br>**A1-4 双缺席**：同上稳定文案与零服务。<br>**A1-5 timer service 缺失/畸形**：throw `required Cordis service "timer" is unavailable`（既有文案不得漂移）。<br>**A1-6 两跳级联**：`timer.ctx` 提供合法通道 → 用之；`timer.ctx` 无通道（`{}` 或 `ctx` 属性 `undefined`）→ 回落 plugin `ctx` 的通道；`timer.ctx === null` → 视为**畸形宿主**并 loud fail（不回落到其它宿主）。<br>**A1-7 无 ambient timer（sentinel）**：提供只记录、不自走的 timer 能力 → 触发连接/会话动作后写计数 = 0、sentinel arm ≥ 1；不 fire sentinel 并等待 > 配置 timeout → 无 hello 关闭、无 bootstrap 收口；fire 后发生。<br>**A1-8 调用点覆盖矩阵**：以下 timer 族各自至少 1 条「arm（delay 命中配置）→ 触发（可观察后果）→ 取消（stop/dispose 后 outstanding=0）」三段证据：hello、auth/upgrade 认证封顶、bootstrap、close/drain deadline、reauth deadline、peer backoff/reset、bulk-transfer ACK、reconcile interval、liveness ping+pong、fence-watchdog、peer `waitForLive` 轮询、assembly/ACK 超时。 |
| **证据载体** | 新 `packages/ws-replication/test/ws-replication-cordis-root-channel.test.ts`（A1-1…A1-7；命名可变，判据不可变）；新 `packages/ws-replication/test/ws-replication-cordis-root-timers.test.ts`（A1-8，真实 baseline `TimerService`，`TimerService.prototype.timeout` 插桩须先于构造）；三基线 runner cell（§12 AC7 的 suite 注册）；AD 对照判据形态参考 `packages/persistence/test/cordis-root-channel.test.ts`（**不复制文件**、不共享生产 helper）。 |
| **通过判定** | A1-1…A1-8 全部断言在 **B1、B2、B3** 各自通过；每基线每子项有 JSON 证据与测试名；错误文案逐字体一致（稳定文案，不随 ctx 形态漂移）。 |
| **失败判定（无证据即不通过）** | 任一项缺失/红；用 fake timer 充当真实 Timer 证据；symbol 存在时仍读 legacy；malformed 回落到 legacy 或另一宿主；apply 成功而首个 timer 才 TypeError/proxy Error；文案随范围漂移；使用 `setTimeout`/`setInterval`/`queueMicrotask` 作为调度（无 ambient timer 断言缺失）。 |
| **验收主体包** | 主体：`@nomicore/ws-replication`（`src/plugin.ts` 行为；测试在 `packages/ws-replication/test`）。关联只读：`@deepseek-ai/cordis`、`@deepseek-ai/cordis-plugin-timer` 的基线工件；`@nomicore/{instance,clock,namespace-registry,persistence}` 仅作装配依赖。 |

### 12.2 AC2 — 三基线 × 三入口 × 七场景行为矩阵

| 项 | 内容 |
|---|---|
| **矩阵** | **3 基线** {B1,B2,B3} × **3 入口** {hub `listen` 正常模式, peer 拨号, hub `listen:false` SessionHost} × **7 场景** {启动, timer 触发, timer 取消, 显式 stop, Fiber dispose, 服务撤销, 重新挂载} = **63 个必绿单元**（每个单元至少 1 条断言，允许一个测试覆盖同单元的多个断言但必须可单独定位） |
| **可观测断言（逐场景）** | **启动**：`fiber.await()` 正常 resolve；`listener.listen`/`dial` 各恰 1 次；服务可取（`require*` 不抛）；`status.state === 'ready'`；该入口**不**提供另一入口的服务（hub listen 无 `nomicoreHubSessionHost`；listen:false 无 `nomicoreHubReplication`）。<br>**timer 触发**：真实 baseline `TimerService` 的 arm 记录命中配置 delay（hello/bootstrap/liveness 等）；触发产生规定后果（hello→`close(1002)`；pong→`close(1001,'pong-timeout')`；bootstrap→会话终态/`ns` 超时事件；backoff→第二次 dial）。<br>**timer 取消**：触发前关闭连接或 `stop()` → 该 delay 的 outstanding 归 0 且约定窗口内不再触发（用谓词轮询 + deadline 断言「未发生」）。<br>**显式 stop**：`stop()` 幂等（`stop()` 两次返回同一 Promise）；drain 期间服务仍可取；结束后 `status.state === 'stopped'`、`sessions`/`connections` 归 0；**服务仍注册**（撤销属下一场景）。<br>**Fiber dispose**：不显式 `stop()` 直接 `fiber.dispose()` → 经有序 effect 完成 stop → 该入口所有 arm outstanding = 0；零 unhandled rejection。<br>**服务撤销**：`ctx.get(<service>) === undefined`；`require*` 抛 `/unavailable/`；另一入口服务从始至终未出现。<br>**重新挂载**：同一 `ctx` 再 `apply` 一个新插件实例 → ready、服务可取、旧句柄不再影响新实例；同一服务名**不得**双挂（重复 provide 必须响亮失败——作为负控）。<br>**EDGE/ASYNC（补充单元）**：`createHubReplicationEdge` + `createHubSessionHost`（β）与 `createHubAsyncSessionHost`（γ）在每基线各跑 1 条最小回合（注入该基线 `new TimerService(ctx)` 解出的 timer）：OPEN→OPEN_OK、帧过缝、`close()` 收口、arm outstanding=0。（它们是**非 Cordis 工厂**，验收的是「宿主注入 timer 被正确使用」，不是 `ctx.root` 解析。） |
| **证据载体** | 新 `packages/ws-replication/test/ws-replication-cordis-baseline-lifecycle.test.ts`（可拆多文件，suite 名统一）；runner 新 suite（建议 `replication-lifecycle`）在 `baselines.json.suites` + `run-baseline.mjs` 注册；`--all --matrix` 必须输出 **B1/B2/B3 × 该 suite 三个必绿 cell**；每 cell JSON 证据含 `{baseline,suite,status,resolvedRealpaths,provenanceDigest,testNames,logPath}`。 |
| **通过判定** | 63 单元 + EDGE/ASYNC 单元全部有独立证据且绿；每基线独立留证；`--all` 聚合 exit 0 当且仅当所有 cell 绿。 |
| **失败判定（无证据即不通过）** | 任一单元缺失或红；以 `effectTimer`/`createRegistryTestScheduler` 等假 timer 取代 baseline `TimerService`；以「B1 已绿」抵销 B2/B3；把 `stop()` 与「服务撤销」合成一条断言（会掩盖「drain 期服务在场」契约）；用 `sleep` 代替谓词轮询；把 listener 关闭时序留给宿主默认。 |
| **验收主体包** | `@nomicore/ws-replication` 为**主体**（三入口的 plugin 装配与 controller 生命周期）；`@nomicore/{persistence,namespace-registry,clock,instance}` 为**装配依赖**（每基线以其基线工件运行）；`apps/yjs-server` **不**在 AC2（其组合根归 AC3/AC4/AC8）。 |

### 12.3 AC3 — 单向拆卸顺序、无等待环、watchdog 与有界 drain 保留

| 项 | 内容 |
|---|---|
| **可观测断言** | **A3-1 顺序单调**：组合根事件序满足 `replication-drained` < `registry-stopped` < `persistence-drained/disposed` < `app-stopped`；且每步 settle 后下一步才开始（以 sink 事件 + 门闩断言，不用时间戳排序）。<br>**A3-2 无环**：replication 的 `stop()` **不** await Registry shutdown；Registry shutdown **不**等待 replication 重新启动；整体在 deadline（建议 5 s）内 settle（超时即红，证明无死锁）。<br>**A3-3 provider/dependent 等待**：Registry 服务在 replication 卸载期间仍可取（反向 yield 序 [stop, revoke]）；`registry-sa7-rev1` R5P 在三基线仍通过（dependent 卸载窗口内写仍 `{ok:true}`）。<br>**A3-4 watchdog 保留**：`fence-watchdog` 双节奏仍武装（arm 记录含 watchdog budget），dispose 后清零；不得以「移除 watchdog」换取确定性。<br>**A3-5 有界 drain 保留**：app 侧 `awaitDrainWithBudget` 预算路径仍存在且可观察（预算尽 → `persistence-drain-budget-exceeded` 事件；drain 本体未被无界 await 取代；`dispose()` 前仍 `await drain()`）。 |
| **证据载体** | `apps/yjs-server/test/issue270-regression-anchors.test.ts`、`issue270-server-integration-red.test.ts`、`on-fatal-error-issue288.test.ts`（三基线运行）；`packages/namespace-registry/test/registry-sa7-rev1.test.ts`（R5P，三基线）；`packages/ws-replication/test/*` 的 watchdog arm 断言（新）；托管文档 L454–L488 作为口径来源。 |
| **通过判定** | A3-1…A3-5 在三基线全部通过；事件序断言以事件索引单调判定；R5P 测试名存在且 passed（`r5p.present && r5p.passed`）。 |
| **失败判定（无证据即不通过）** | 顺序倒置或不可观测；出现循环等待/超时；R5P 缺失或红；watchdog 被删；drain 变无界或 `dispose()` 不再前置 drain；只用「进程没崩」近似顺序。 |
| **验收主体包** | `apps/yjs-server`（组合根拆卸链）+ `@nomicore/ws-replication`（自身 drain 边界）+ `@nomicore/namespace-registry`（shutdown/lease）+ `@nomicore/persistence`（drain/dispose 契约）。 |

### 12.4 AC4 — Timer 由 Host 最后释放；不得依赖 dependent tracking 自动释放；直接 apply profile 顺序不变

| 项 | 内容 |
|---|---|
| **可观测断言** | **A4-1 存活断言**：`persistenceFiber.dispose()` 之后、根 `ctx.fiber.dispose()` 之前，`ctx.get('timer')` 仍可取，且 `ctx.get('timer').timeout(() => {}, 1)` 仍能 arm（证明 Timer 未被上游卸载提前带走）。<br>**A4-2 最后释放**：根 `ctx.fiber.dispose()` 之后 timer 服务不可取/不可 arm。<br>**A4-3 非自动边**：`new TimerService(ctx)` 构造在**根 ctx**（不是 persistence/registry 的 fiber 内）；断言 persistence fiber 卸载**不**导致 `ctx.get('timer')` 消失（即证明没有把 dependent tracking 当作 Timer 自动依赖边）。<br>**A4-4 直接 apply profile**：不通过 Cordis fiber、直接 `apply(ctx)` 的 profile（如 DSH profile / 第三方最小装配）仍保持「显式 adapter dispose → 再释放 root Context」的既有顺序（事件序断言）。 |
| **证据载体** | 新 `apps/yjs-server/test/*`（或既有 `third-party-composition-red.test.ts` 扩展）中的 A4-1…A4-3 断言；`packages/dsh-persistence/test/dsh-profile-acceptance.test.ts` + 直接 apply 装配用例（A4-4）；三基线 cell。 |
| **通过判定** | 四条断言在三基线通过；断言内容必须能在「Host 漏掉显式 dispose」时变红（即断言不是恒真）。 |
| **失败判定（无证据即不通过）** | 无 Timer 存活断言；把「Timer 在根 ctx 构造」写成注释而非断言；A4-3 只在默认布局有；A4-4 用 fake timer 替代；以「进程退出即释放」代替断言。 |
| **验收主体包** | `apps/yjs-server`（Host 侧所有权）+ `@nomicore/dsh-persistence`（直接 apply profile）+ `@nomicore/persistence`（drain/dispose 边界）。 |

### 12.5 AC5 — Host fixtures 的 legacy Root 直读全部迁移（零残留）+ npm/rc.12 双通道行为证据

| 项 | 内容 |
|---|---|
| **可观测断言** | **A5-1 零残留（机械 gate）**：`packages/*/src/**`、`packages/*/test/**`、`apps/*/{src,test}/**`、`domains/*/{src,test}/**` 内不存在对 Cordis Context 的 `ctx.root` / `ctx['root']` **直接属性读取**；允许清单仅两类：① `packages/persistence/src/service.ts` 与 `packages/ws-replication/src/plugin.ts` 的 seam 内部 `Reflect.get(host,'root')`；② 专用 Root 通道探针/测试中以 `Reflect.get` 显式同时读取两通道。**必须排除**无关同名 helper：`ctx.rootValue(...)`、`ctx.root('hub', …)`、`root:`（注册数据字段）不得误判——gate 需按标识符/接受者白名单实现并给出命中清单。<br>**A5-2 fixture 通道自述**：每一处向生产 seam/工厂注入 Root 的 Host fixture 必须显式声明被测通道（symbol / legacy / both），集合覆盖 5 形态：symbol-only、legacy-only、both（优先级）、malformed、absent。<br>**A5-3 迁移面断言面保留**：4 个具名 fixture 迁移后其原有断言面（guard-Proxy 可消费性、instance role 负控、limits/timeouts 值域负控）逐条仍在且通过。<br>**A5-4 双通道行为证据**：A1-1/A1-2 的三基线证据即为本条的通道证据（同一份测试可同时承载 AC1/AC5，但报告中必须分别引用）。 |
| **证据载体** | `packages/persistence/test/fixtures/cordis-baselines/gates.mjs` 新增 gate（A5-1，输出命中清单 + 允许清单 diff）；`ws-replication-cordis-root-channel.test.ts`（A5-2/A5-4）；`ws-package` cell 三基线（A5-3）。 |
| **通过判定** | A5-1 命中清单 = 允许清单（逐条路径:行 + 理由）；A5-2/A5-3/A5-4 全部绿。 |
| **失败判定（无证据即不通过）** | 任一新增直读；gate 仅用裸 `grep ctx.root` 导致 helper 误判并因此放宽（或反之放行真直读）；只提供 symbol 通道证据（**当前态**）；以 grep 注释/字符串断言充当通道行为证据；声称「已迁移」但无命中清单。 |
| **验收主体包** | 主体：`@nomicore/ws-replication`（4 fixture + 新测试）；**迁移完备性**覆盖 `@nomicore/persistence`、`@nomicore/namespace-registry`、`@nomicore/clock`、`@nomicore/dsh-persistence` 的既有夹具（当前零直读，须由 gate 持续守住）。 |

### 12.6 AC6 — 冻结服务 getter + guard-Proxy；公共类型/服务名/wire/持久化布局不变

| 项 | 内容 |
|---|---|
| **可观测断言** | **A6-1 guard-Proxy 消费**：`clock`（system/manual）、`nomicoreRegistry`、`nomicoreHubReplication`、`nomicorePeerReplication`、`nomicoreHubSessionHost` 五个服务面在 guard-Proxy 下：成员可读、函数成员为稳定闭包（多次 `get` 全等）、写入与 `defineProperty` 抛 `TypeError`、`Object.isFrozen === true`、成员描述符 `'value' in descriptor === false` 且 `set === undefined`。<br>**A6-2 公共导出面**：`@nomicore/persistence`、`@nomicore/persistence/testing`、`@nomicore/dsh-persistence`、`@nomicore/ws-replication`、`@nomicore/ws-replication/testing`、`@nomicore/clock`、`@nomicore/namespace-registry` 的运行时导出名集合与 base 快照严格相等。<br>**A6-3 服务名**：`nomicoreInstance`/`clock`/`timer`/`nomicorePersistence`/`nomicoreRegistry`/`nomicoreHubReplication`/`nomicorePeerReplication`/`nomicoreHubSessionHost` 字面不变。<br>**A6-4 wire protocol**：帧布局/sequence/握手/capability 协商不变 → `ws-replication-issue246-interop-matrix.test.ts` 与 `issue418-*` 结构守卫在三基线通过；**零** wire 帧字节快照变化。<br>**A6-5 持久化布局**：snapshot/META/诊断 JSONL 布局不变 → persistence contract suites 在三基线通过，且不新增/改名持久化键。 |
| **证据载体** | `packages/ws-replication/test/ws-replication-guard-proxy-consumption.test.ts`、`packages/clock/test/clock-guard-proxy-consumption.test.ts`、`packages/namespace-registry/test/registry-guard-proxy-consumption.test.ts`（三基线）、`packages/persistence/test/cordis-public-surface.test.ts`（快照含 ws entry）、`ws-replication-issue246-interop-matrix.test.ts`、`ws-replication-issue418-edge-session-split-{contract,structure}.test.ts`。 |
| **通过判定** | A6-1…A6-5 在三基线通过；快照文件随本票仅在**确有**新增导出时更新并给出理由（否则零 diff）。 |
| **失败判定（无证据即不通过）** | 任一导出增删/改名；服务名变化；帧布局或字段序变化；guard-Proxy 断言被弱化成「能访问即可」；只在默认布局跑 guard-Proxy / interop。 |
| **验收主体包** | `@nomicore/ws-replication`（hub/peer/sessionhost 服务面）+ `@nomicore/clock` + `@nomicore/namespace-registry`（冻结 getter）；`@nomicore/replication-protocol` 与 `@nomicore/persistence` 为**只读守卫**（零 diff）。 |

### 12.7 AC7 — 复用 Ticket 1 的工件验真夹具 / 模块解析断言 / Root 通道探针；不建第二套

| 项 | 内容 |
|---|---|
| **可观测断言** | **A7-1 单点工件表**：三基线的 npm integrity / DSH commit / 期望通道仍**只**定义在 `packages/persistence/test/fixtures/cordis-baselines/baselines.json`（+ `provenance-b3.json` 输出哈希）；仓库内不存在第二份 baseline 定义。<br>**A7-2 单点获取与构建**：仍**只**由 `acquire.mjs` 物化 overlay；不新增第二套 acquire/clone/build 脚本。<br>**A7-3 单点 runner**：新 suite 通过 `baselines.json.suites` 注册并经 `run-baseline.mjs` 执行；测试只读 runner 注入的 `NOMICORE_CORDIS_BASELINE{,_ROOT}/_EXPECTED_CHANNEL` 等 env，**不**自行解析 `.cache` 路径或 baseline id。<br>**A7-4 身份先行**：每 cell 执行顺序为 `provenance → root-probe → 行为 suite`；行为 suite 不得先于身份断言。<br>**A7-5 注册完备**：新增测试文件必须进入 `run-baseline.mjs` 的 `NEW_FILES`（否则 materialize 响亮 exit 2；本轮已读源码确认该预检）；未注册的 suite 名必须 `fail('usage')`。<br>**A7-6 聚合口径**：`--all --matrix` 输出包含新 cell；任一 cell `fail` 或缺失 → exit != 0（绿不得抵销红）。 |
| **证据载体** | `run-baseline.mjs` / `baselines.json` 的 diff scope（本票唯一允许改动的验收设施文件）；`--all --matrix` 的运行日志与 `evidence/matrix/matrix.json`；`root-probe.mjs`（B1/B2 legacy、B3 symbol 断言原样复用）。 |
| **通过判定** | A7-1…A7-6 全部成立；`git diff` 证明未新增第二套 runner/probe/baseline 表；matrix 输出含 3 基线 × 新 suite。 |
| **失败判定（无证据即不通过）** | 新 acquire/probe/runner；测试内硬编码 `.cache` 绝对/相对路径；复制一份 integrity 表；行为 suite 先跑后补身份断言；新 suite 未注册（假装跑过）；`--all` 不纳入 B2/B3。 |
| **验收主体包** | 验收设施：`packages/persistence/test/fixtures/cordis-baselines/**`（共享设施，本票扩展点）；消费方：`@nomicore/ws-replication` 与 `apps/yjs-server` 的行为 suite。 |

### 12.8 AC8 — 每基线全仓 typecheck + 点名测试面

| 项 | 内容 |
|---|---|
| **可观测断言** | **A8-1 全仓 typecheck**：B1/B2/B3 各自对根 `package.json` `scripts.typecheck` 的 **15 个 project** 逐个 `tsc -p` exit 0，逐 project 一条日志与 exit code；清单从根清单**动态**解析（禁内置副本）；禁子集/known-red 债务/删项/`skipLibCheck` 扩张/整体 cast/默认 `node_modules` 类型面冒充。<br>**A8-2 点名测试面（每基线）**：① Registry Cordis（`registry-sa7-rev1`、registry plugin/生命周期相关）；② Hub/Peer plugin（`ws-replication-plugin` 等 4 个具名 fixture）；③ SessionHost（`ws-replication-issue422-listen-false`、`ws-replication-issue420-session-host-round`）；④ guard-Proxy（clock/registry/ws 三处）；⑤ Nomicore DSH profile（`packages/dsh-persistence/test/dsh-profile-acceptance.test.ts`）；⑥ 第三方组合根（`apps/yjs-server/test/third-party-composition-red.test.ts` + 组合根契约/停机序测试）。<br>**A8-3 聚合**：`--all --matrix` 在任一 cell 红时 exit != 0，输出完整矩阵。<br>**A8-4 如实披露**：默认布局 `root-test` 当前有 **4 个既有 test-d 红**（`ws-replication-issue421-edge-factory-api.test-d.ts`，expect-type 1.4.0 可选参数元组不兼容；#470 SA10 §5 已记载为 BASE 既有）+ #470 记录的 28 环境红（packageManager 对齐后可闭合）。本票**不得**声称「root-test/CI/所有既有测试全绿」。 |
| **证据载体** | `run-baseline.mjs --mode typecheck`（三基线，每 project 日志）；`evidence/<baseline>/<baseline>-typecheck.json` 等 cell 证据；点名 suite 的三基线 cell；`evidence/matrix/matrix.json`。 |
| **通过判定** | A8-1/A8-2/A8-3 全绿且逐 cell 留证；A8-4 的披露逐条写入交付摘要。 |
| **失败判定（无证据即不通过）** | 任一 project/cell 红或缺失；用默认 `node_modules` 类型面冒充基线 typecheck；以 `passWithNoTests` 让空路径变绿；B1 绿抵销 B2/B3；把 4 个既有 test-d 红静默为「已知债务」而不披露；删 tsconfig 项或加 cast 压静 TS2576。 |
| **验收主体包** | 全仓 15 project（`vfsl*`、`persistence`、`dsh-persistence`、`doc-runtime`、`namespace-runtime`、`clock`、`instance`、`namespace-registry`、`namespace-api`、`namespace-diagnostic-log`、`replication-protocol`、`ws-replication`、`apps/yjs-server`）；点名测试面按 ①–⑥ 分列归属包。 |

### 12.9 AC9 — 无 volatile config / internal 事件；不改历史 artifacts；不真实部署或 patch 移除

| 项 | 内容 |
|---|---|
| **可观测断言** | **A9-1**：`packages/*/src`、`apps/*/src`、`domains/*/src` 内零 `volatile config`、零 `internal/config`、零 `internal/update`、零 `internal/commit`、零 Cordis 私有 Fiber store 读取（机械扫描 + 人工复核命中）。<br>**A9-2**：`git diff --exit-code <base> -- artifacts/` 必须空；运行后 `git status --porcelain artifacts/` 空；证据只写 `.cache/`（gitignored）。<br>**A9-3**：`git diff --exit-code <base> -- docs/adr/` 空（不得以改 ADR 追认实现）。<br>**A9-4**：验收命令白名单 = `node`/`git`/`tsc`/`vitest`/registry HTTPS GET；无 `dsh`/MABF/`patch`/`patch-package`/部署命令；不新增或修改 `patchedDependencies`。<br>**A9-5**：依赖面零 diff（`pnpm-lock.yaml`、根与各包 `package.json` 的 dependency/peerDependency/range），除非本票 SA8 明确授权并留证。 |
| **证据载体** | `gates.mjs` 新增 gate（A9-1/A9-2/A9-3/A9-5）；runner 命令日志（A9-4）；`git diff --exit-code` 输出。 |
| **通过判定** | A9-1…A9-5 全部机械通过，命中清单为空或已批准。 |
| **失败判定（无证据即不通过）** | 任一 diff；出现 volatile config/internal 事件；执行真实部署或 patch 移除；改 ADR/文档追认；用 `git update-index`/`.gitignore` 隐藏 diff。 |
| **验收主体包** | 全仓（清单/命令/工件层面），不含任何业务包行为断言。 |

### 12.10 每条 AC 的验收主体包一览（与 12.1–12.9 一致）

| AC | 主体包（必改/必测） | 关联只读/仅装配 |
|---|---|---|
| AC1 | `ws-replication`（plugin seam + 新通道/定时器测试） | `cordis`/`cordis-plugin-timer` 基线工件 |
| AC2 | `ws-replication`（三入口 × 七场景） | `persistence`/`namespace-registry`/`clock`/`instance` 作为装配依赖 |
| AC3 | `apps/yjs-server` + `ws-replication` + `namespace-registry` + `persistence` | `replication-protocol`（§21 语义，只读） |
| AC4 | `apps/yjs-server` + `dsh-persistence` + `persistence` | `clock`（Timer 边界的共存者） |
| AC5 | `ws-replication`（4 fixture + 新测试）+ gate 覆盖其余包夹具 | `persistence`/`namespace-registry`/`clock`/`dsh-persistence` 既有夹具（零直读，由 gate 守） |
| AC6 | `ws-replication` + `clock` + `namespace-registry`（冻结 getter）；公共面快照 | `replication-protocol`、`persistence`（只读守卫，零 diff） |
| AC7 | `persistence/test/fixtures/cordis-baselines/**`（设施扩展） | 消费方 `ws-replication`、`apps/yjs-server` |
| AC8 | 全仓 15 project + ①–⑥ 点名测试面 | — |
| AC9 | 全仓（清单/命令/工件） | — |

---

## 13. 不得回归的边界（frozen surfaces）

| 冻结面 | 必须保持 | 依据 | 机械/行为承载 |
|---|---|---|---|
| 公共类型与公共导出 | 各包 `src/index.ts` 导出名集合与 base 相同；不新增公共 helper/compat 包 | ADR 0035 §2 L45、§4 L76；Issue AC6 | `cordis-public-surface.test.ts`（含 ws entry）+ `git diff --exit-code` on `src/index.ts` |
| 服务名 | 8 个服务名字面不变（§12 AC6-3） | ADR 0009/0012/0032；CONTEXT.md「服务表面」 | 运行时 `ctx.get(name)` 断言 |
| wire protocol | 帧布局/字段序/sequence/握手/capability 不变 | `instance-replication-v1.md`；ADR 0010/0032 | interop matrix + edge/session 结构守卫（三基线） |
| 持久化布局 | snapshot/META/诊断 JSONL 布局与键名不变 | ADR 0006/0014 | persistence contract suites（三基线） |
| Host 装配与生命周期所有权 | Instance → Clock/Timer → Persistence → Registry → replication 顺序不变；plugin 不销毁上游服务 | hosting 文档 L14–L66；ADR 0012 L5/L37；ADR 0035 §3 | 组合根装配测试 + 服务撤销断言 |
| 单向拆卸顺序 | Replication → Registry（shutdown）→ Persistence（drain→dispose）→ Timer/Clock；**不出现等待环** | ADR 0009/0006；hosting 文档 L454–L488；Issue AC3 | 事件序 + deadline（AC3） |
| watchdog 与有界 drain | `fence-watchdog` 双节奏保留；app 侧 drain 预算 race 保留（预算尽诚实事件） | Issue AC3；ADR 0006 #412 修订 | arm 记录 + `persistence-drain-budget-exceeded` 可观察 |
| Timer 释放顺序 | Timer 由 Host 最后释放；不得把 dependent tracking 当 Persistence/Timer 自动依赖边；直接 apply profile 的显式 dispose 顺序不变 | ADR 0035 §3 L70；Issue AC4 | A4-1…A4-4 存活/顺序断言 |
| 服务面构造形态 | hub/peer/sessionhost/registry/clock 服务 = accessor + `Object.freeze` | ADR 0023 L45/L90–L92；#470 R8 | guard-Proxy 五处 |
| 配置形态 | 不引入 volatile config、不读 `internal/config`/`internal/update`/`internal/commit`、不读私有 Fiber store | ADR 0035 §4 L77–L78；Issue AC9 | A9-1 机械扫描 |
| 历史证据 | `artifacts/**` 与 `docs/adr/**` 零 diff | Issue AC9；#470 §17.5/17.8 | `git diff --exit-code` |
| 依赖面 | `pnpm-lock.yaml` 与各 `package.json` 依赖/peer/range 零 diff（未获授权时） | ADR 0035 §4 L74；#470 R7(d) | manifest gate |

---

## 14. 三基线「全仓 typecheck + 指定测试面」验收口径（与 #470 一致性）

**口径原文（继承 #470 R1 的严格读法，逐字复用含义）**：

> 「全仓 typecheck」= 逐基线对根 `package.json` `scripts.typecheck` 的 **15-project 清单**（或其超集）全部 `tsc -p` exit 0；不得以仓库默认 `node_modules` 类型面冒充基线 typecheck；不得 tsconfig 删项/skip/`skipLibCheck` 扩张/整体 cast 掩蔽；每 cell 独立留证，任一 project 红即该基线红。
> 「指定测试面」= 同一组外部行为测试（AC8-2 的 ①–⑥）在三个基线**各自**执行并留证；**一个基线的绿色结果不得抵销另一个基线失败**（owner L28 / ADR 0035 §5 L82）。

**与 #470 具体口径的关系（必须显式声明）**：

| #470 口径 | 本票处置 | 理由 |
|---|---|---|
| R1 全仓 typecheck 严格读法 | **原样沿用** | 无冲突 |
| R2 ws 改动面「恰好 4 fixture」 | **本票扩展**：允许新增 replication 验收测试 + runner/baseline 注册 | AC2/AC5/AC8 要求；#470 R2 是票级收口边界 |
| R3「ws 只做编译面/seam 语义/B1 门禁，不做三基线行为」 | **本票取代**：本票**必须**做三基线行为 | #470 明确「留后续票」；#471 即该票；ADR 0035 §5 L92 亦点名 Hub/Peer/SessionHost |
| #470 设计 §8.6/§8.8「`ws-package` 仅 B1 为验收 cell；B2/B3 属附加证据」 | **本票取代**：`ws-package` 提升为三基线必绿；新增 replication suite 亦三基线必绿 | 同上；且实测三基线 `ws-package` 已 66/66 全绿，提升口径零成本 |
| #470 SA6 §12.5「ws-package 仅对 B1 为验收 cell」 | **同上取代**（该文为证据工件，非规范） | `docs/AGENTS.md`：`wiki/raw/` 是证据，不是规范契约 |
| #470 SA9 §8.2「ws 仅可宣称三基线编译面…不得宣称三基线行为兼容」 | **仅约束 #470 交付叙述**；本票完成后可宣称**本票矩阵覆盖的**三基线行为 | 否则后续票永久无法收口 |
| #470 R5（B3 provenance 8 项）、R6（#470 AC 账本）、R8（ADR 0023 冻结面）、R9（无阻塞） | R5/R8/R9 原样沿用；R6 仅对 #470 生效（本票 9 条 AC） | 见 §3 |
| #470 已知既有红（4 个 test-d + 28 环境） | **必须如实披露**（A8-4），不作为本票红/绿判据 | #470 SA10 §5 记载；本会话在 B3 复现 4 个 test-d 红 |

**结论**：本票契约在「全仓 typecheck」与「不得抵销」两点上与 #470 **完全一致**；差异只在**范围**（把 ws 行为纳入验收）与**矩阵口径**（B2/B3 由「附加证据」升为「必绿 cell」）。这两点属本票 owner 文本授权的**取代**，不是对 ADR 0035 或既有规范条款的冲突（详见 §18）。

---

## 15. Red/green or baseline evidence

### 15.1 绿面（证明失败不是环境/入口错误）

| 证据 | 值 |
|---|---|
| 三基线 typecheck | B1/B2/B3 各 **15/15** project exit 0（`evidence/B*/B*-typecheck.json`） |
| `ws-package` 三基线 | **66/66 × 3**（`evidence/B*/ws-package.json`，4 文件存在性预检全真） |
| 第三方组合根三基线 | **3/3 × 3** |
| ws 整包（B3） | **941 passed / 4 failed**（4 = 既有 test-d lane，§15.2） |
| 真实 Timer 探针 | **10/10 × 3** |
| 通道优先级探针 | 同 10 项内 6 项，× 3 |

### 15.2 红面（本票必须判红或必须如实披露的既有红）

| 红判据 | 当前证据 |
|---|---|
| **契约新增 cell 尚不存在** | `baselines.json.suites` 无 replication 行为 suite；`--all` 只含 B1 `ws-package` ⇒ 新契约的 63 单元在 HEAD 上是「缺失」而非「绿」 |
| **legacy 分支零覆盖（可证伪）** | 变异 M-1：删 legacy 兜底后 4 fixture **66/66 仍绿**（§9.4） |
| **优先级零覆盖（可证伪）** | 变异 M-2：legacy 优先后 4 fixture **66/66 仍绿**（§9.4） |
| 既有 test-d 4 红（BASE 既有） | B3 整包运行：`ws-replication-issue421-edge-factory-api.test-d.ts` 4 failed（expect-type 1.4.0 可选参数元组不兼容）；#470 SA10 §5 已记载为 BASE 既有，本票不修但必须披露 |
| root-test 面已知红（#470 记录） | 28 环境红（packageManager 未对齐）+ 4 既有；本会话未重跑 root-test（不在本票诊断范围），#470 证据仍有效 |

> **纪律**：本票**不**把「新测试未写」包装成「产品红灯」，也**不**把「三基线探针已绿」包装成「AC2 已完成」——AC2 的完成标准是**仓库内可复核的 63 单元证据**，不是本会话的一次性探针。

---

## 16. Runner trigger evidence

| 入口 | 命令（工作树相对） | 真实触发结果 |
|---|---|---|
| 单基线全量 typecheck | `node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs --baseline B3 --mode typecheck` | exit 0，15 projects（本会话实跑 3 次，B1/B2/B3） |
| 单基线 behavior suite | `node …/run-baseline.mjs --baseline B3 --suite ws-package` | exit 0，66/66（三基线各 1 次） |
| 聚合矩阵 | `node …/run-baseline.mjs --all --matrix` | 本会话**未跑**（`--all` 会连跑 3×6 suites + typecheck + gates + root-test，root-test 面已知 4+28 红，且本票不要求）；契约要求实现阶段必须跑并留 `evidence/matrix/matrix.json` |
| 默认布局聚焦测试 | `NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run --passWithNoTests=false packages/ws-replication/test/ws-replication-plugin.test.ts …` | exit 0：5 文件 / **76 tests passed**、Type Errors 无 |
| 基线 workspace 内单文件 | `cd .cache/cordis-baselines/workspaces/B3 && …/vitest run --config vitest.config.ts --passWithNoTests=false <file>` | 实跑通过（探针、third-party、整包） |
| 变异实验 | 见 §9.4（workspace 副本内 patch + 还原 + `diff` 校验） | 4 fixture 66/66 绿；探针 2/10 定向红 |

> `--fault` 负控入口（#470 既有）本会话**未跑**（B2/B3 overlay 已用于正控；负控属实现阶段义务，§6.2 已列判据）。

---

## 17. Unknowns, blockers, external dependencies

### 17.1 无阻塞项

- Issue #471 `Blocked by: #470` 已因 PR #473 合并解除（`d59a4d1` 即合并提交）。
- 无 owner 评论豁免/加码；三基线工件可获取（本会话已现购成功）；无外部服务依赖。
- **结论：无 blocker**。以下为需要显式记录的边界。

### 17.2 必须显式记录的边界

1. **B3 构建非官方流水线**：最小 `tsc` source-build（诚实标注沿用 #470 R5 第 8 项）；若未来 owner 要求 DSH 官方 `tsc -b + tsdown` 等价，属新要求须显式提出。
2. **`--all --matrix` 的 root-test cell**：默认布局全量测试存在 4 个既有 test-d 红 + 28 环境红（packageManager 未对齐）。本票若把 `--all` 作为收口门，必须**预先**决定：是跑对齐 packageManager 的复跑并如实披露，还是把 root-test 排除在"本票必绿"之外并写明理由（推荐后者 + 披露，与 #470 处置一致）。
3. **真实 MABF/DSH 部署**：ADR 0035 §6 明确排除；本票只证明仓内工件与行为，不证明任何外部 Host 可删 patch。
4. **跨包测试设施依赖**：replication 行为 suite 运行在 `packages/persistence/test/fixtures/cordis-baselines` 产出的 workspace 中（同一 runner）。这构成「ws 的验收依赖 persistence 的测试设施」——是 AC7「不建第二套」的必然结果，须由 #471 SA8 明文确认（§18 S3）。
5. **File retry / POSIX rename**：属 persistence 既有 AC（#470），本票不重复；若新 suite 复用 File adapter 需限定 POSIX。
6. **Timer 精度**：所有 timer 断言使用基线真实 `TimerService`，以「arm/触发/取消」事件计数为准，不断言墙钟精度（避免 CI 抖动）；deadline 建议 5 s。
7. **`effectTimer` 类假 timer 的定位**：可继续用于单元面，但**不得**作为 AC2 的证据载体（本契约已在 AC2 失败判据中列明）。

---

## 18. 规范一致性账本与冲突判定

### 18.1 判定

**verdict = approve；requiresConflictRecheck = false。**

理由：本票与 owner 文本、ADR 0035、ADR 0009/0012/0023/0032、wire 协议与 hosting 文档**无规范冲突**；全部差异都是「#470（上一票）的票级设计/收口口径」被本票 owner 文本取代或扩展，属**票级 supersession**，不触碰任何 ADR。

### 18.2 需由 #471 设计/SA8 **追认**（非冲突，但必须留痕）的 3 项

| 编号 | 事项 | 与既有工件的关系 | 追认要求 |
|---|---|---|---|
| **S1** | **矩阵口径升级**：`ws-package` 与新增 replication suite 在 B2/B3 由「附加证据」升为「必绿 cell」；`--all --matrix` 必须纳入 | 与 `task_issue-470_design.md` §8.6/§8.8、`task_issue-470_sa6_acceptance_contract.md` §12.5、`task_issue-470_sa9_standards.md` §8.2 的**票级**口径相反 | #471 SA8 明文记录「本票取代 R3 与 §8.6/§8.8 的 B1-only 口径」，并给 owner 文本锚点（L22/L28）。**不需要** ADR 修订：ADR 0035 §5 L82/L92 本就要求每基线与同一组行为测试 |
| **S2** | **改动面扩展**：ws-replication 允许新增行为测试；runner/baselines 允许新增 suite 注册与 gate allowlist 更新 | #470 R2/R7 是 #470 的 allowlist | #471 SA8 发布本票 ALLOW/DENY 清单（建议 ALLOW：`ws-replication/src/plugin.ts`（如需修缺陷时才允许）、`ws-replication/test/**` 新增验收测试、`persistence/test/fixtures/cordis-baselines/{baselines.json,run-baseline.mjs,gates.mjs}`、`apps/yjs-server/test/**`；DENY：`src/index.ts`、各 `package.json`/lock、`artifacts/**`、`docs/adr/**`、`replication-protocol/**`、状态机源文件） |
| **S3** | **跨包验收设施依赖**：ws 与 app 的行为 suite 由 `packages/persistence/test/fixtures/cordis-baselines` 的 runner/overlay 承载 | AC7「不建第二套验真机制」的直接结果 | #471 SA8 明文承认该依赖方向是**测试面**依赖（不是生产依赖），并禁止为此把 fixture 复制进 ws 包 |

### 18.3 与 #470 SA8 R1–R9 的逐条冲突判定（显式）

| 裁决 | 冲突? | 说明 |
|---|---|---|
| R1 | **否** | 原样沿用（§14） |
| R2 | **否（扩展）** | 「恰好 4 fixture」是本票级收口边界，非永久策略；需追认（S2） |
| R3 | **是（显式取代）** | R3 把三基线行为矩阵留后续票；#471 即该票。**取代依据 = owner 文本 L22/L28 + ADR 0035 §5 L92**，不需要 override、不需要 ADR 修订。冲突点记录在此，供 #471 SA8 逐字引用 |
| R4 | **否** | seam 形态原样保留；本票只补 `timer.ctx → ctx` 两跳的**验收断言**，不改代码 |
| R5 | **否** | provenance 8 项原样复用 |
| R6 | **否（不适用）** | #470 的 8+derived 账本只约束 #470；本票 9 条 |
| R7 | **否（扩展）** | allowlist 更新（S2）；`index.ts`/manifest/lock/artifacts 零 diff 保留 |
| R8 | **否** | ADR 0023 冻结面原样保留并扩到 clock/registry/sessionhost |
| R9 | **否** | 本票同样无阻塞 |

### 18.4 被排除的「伪冲突」

- **「AC7 要求复用持久化包的夹具 ⇒ 跨包测试依赖违规」**：不成立。`packages/persistence/test/fixtures/cordis-baselines` 是**验收设施**（runner + 工件表），不是运行时依赖；生产依赖图零变化，`core-dsh-boundary` 反向依赖守卫不受影响（#470 设计已用 workspace symlink farm 规避）。
- **「把 ws-package 提升为三基线必绿会违反 #470 SA9 的叙述边界」**：不成立。SA9 §8.2 是 #470 的**交付叙述**约束（不得把未验证说成已验证），不是「永久禁止验证」。
- **「`timer.ctx` 先于 `ctx` 的级联偏离 ADR 0035 §2 的单一 ctx 形态」**：不成立。ADR 0035 §2 固定的是「如何从一个 context 读 root」的通道顺序；seam 保留 legacy 的 host 选择语义（`timer.ctx?.root ?? ctx.root`，见 `plugin.ts:264–271`），是**既有行为**的忠实延续。本票 AC1-6 以断言把该解释冻结，避免后续实现漂移。

---

## 19. Temporary diagnostics cleanup

| 诊断活动 | 位置 | 状态 |
|---|---|---|
| 依赖安装 | 工作树 `node_modules/`（pnpm workspace links） | 保留（运行测试所必需；`node_modules` 不入版本控制） |
| 基线缓存 | `.cache/cordis-baselines/{overlay,npm,dsh,workspaces,evidence}/` | 保留（`.gitignore:18` 已忽略 `.cache/`；是 runner 的正常运行期产物，未入库） |
| 诊断探针脚本 | `.cache/cordis-baselines/sa6-probe/issue471-probe.test.ts` | 保留（未入库、不在任何 workspace 内、**不**被仓库 glob 收集；供复跑复核） |
| 探针副本（运行用） | `.cache/cordis-baselines/workspaces/{B1,B2,B3}/packages/ws-replication/test/zz-sa6-probe-471.test.ts` | **已全部删除**（`ls … \| grep -c zz-sa6` → 0） |
| 变异实验（M-1/M-2） | `.cache/cordis-baselines/workspaces/B3/packages/ws-replication/src/plugin.ts` | **已还原**：与 `git show HEAD:packages/ws-replication/src/plugin.ts` 做 `diff` **无输出**（逐字节一致）；备份 `/tmp/plugin.ts.orig` 未被放进仓库 |
| 后台作业 | 本会话启动的 bash 作业 | 全部 finished（`job_list` 无 running）；无 nohup/setsid/PID 文件/轮询 marker |
| 仓库工作树 | `git status --porcelain` | `?? wiki/raw/task_issue-471.md`、`?? wiki/raw/task_issue-471_dispatch.md`、`?? wiki/raw/task_issue-471_sa6_acceptance_contract.md`（本文件）——**无任何 `packages/`/`apps/`/`docs/`/`artifacts/` 改动** |

---

## 附录 A：本轮命令与产物（可复核）

```bash
# 0) 环境
node -v                                  # v24.13.0
corepack pnpm@10.28.2 install --frozen-lockfile

# 1) 三基线工件（未入库，运行期）
node packages/persistence/test/fixtures/cordis-baselines/acquire.mjs --all
#   B1/B2 npm overlay；B3 DSH 1511a6ed… sparse clone + 最小 tsc build
#   B3 provenanceDigest = 9d6633550e82c2960ec58e31a8626af7482d53ad323a612c0dce2f3e0a44221c

# 2) 三基线全仓 typecheck（每基线 15 project）
node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs --baseline B1 --mode typecheck
node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs --baseline B2 --mode typecheck
node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs --baseline B3 --mode typecheck
#   → 3 × 15/15 pass；evidence/B{1,2,3}/B*-typecheck.json

# 3) #470 的 4 个具名 fixture（三基线）
node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs --baseline B1 --suite ws-package
node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs --baseline B2 --suite ws-package
node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs --baseline B3 --suite ws-package
#   → 3 × 66/66 pass

# 4) 默认布局聚焦（证明入口真实）
NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run --passWithNoTests=false \
  packages/ws-replication/test/ws-replication-plugin.test.ts \
  packages/ws-replication/test/ws-replication-issue422-listen-false.test.ts \
  packages/ws-replication/test/ws-replication-guard-proxy-consumption.test.ts \
  packages/ws-replication/test/ws-replication-issue299-ac-red.test.ts \
  packages/ws-replication/test/ws-replication-issue420-session-host-round.test.ts
#   → 5 files / 76 tests passed；Type Errors: no errors

# 5) 诊断探针（三基线真实 TimerService + 通道优先级）
cp .cache/cordis-baselines/sa6-probe/issue471-probe.test.ts \
   .cache/cordis-baselines/workspaces/B3/packages/ws-replication/test/zz-sa6-probe-471.test.ts
cd .cache/cordis-baselines/workspaces/B3 && \
  /path/to/node_modules/.bin/vitest run --config vitest.config.ts --passWithNoTests=false \
    packages/ws-replication/test/zz-sa6-probe-471.test.ts
#   → 10/10 pass（B1/B2/B3 各一次）

# 6) 第三方组合根（三基线）
cd .cache/cordis-baselines/workspaces/Bx && \
  /path/to/node_modules/.bin/vitest run --config vitest.config.ts --passWithNoTests=false \
    apps/yjs-server/test/third-party-composition-red.test.ts
#   → 3/3 × 3 pass

# 7) ws 整包（B3，基线工件上）
cd .cache/cordis-baselines/workspaces/B3 && \
  /path/to/node_modules/.bin/vitest run --config vitest.config.ts --passWithNoTests=false \
    packages/ws-replication/test
#   → 941 passed / 4 failed（全部为既有 test-d lane：ws-replication-issue421-edge-factory-api.test-d.ts）
```

产物路径：

| 产物 | 路径 |
|---|---|
| 三基线 overlay | `.cache/cordis-baselines/overlay/{B1,B2,B3}/` |
| 临时 workspace | `.cache/cordis-baselines/workspaces/{B1,B2,B3}/`（每次 run 重建；已删探针副本） |
| 证据 JSON | `.cache/cordis-baselines/evidence/{B1,B2,B3}/`（typecheck 为 `B*-typecheck.json`，行为面为 `<suite>.json` 及其 `*.vitest.json`） |
| 诊断探针（可复跑） | `.cache/cordis-baselines/sa6-probe/issue471-probe.test.ts` |
| 本报告 | `wiki/raw/task_issue-471_sa6_acceptance_contract.md` |

## 附录 B：AC → 缺口 → 证据载体 → 当前状态

| AC | 缺口 | 证据载体（新增/复用） | HEAD 状态 |
|---|---|---|---|
| AC1 | G2/G3/G4/G5 | 新 `ws-replication-cordis-root-channel.test.ts` + `ws-replication-cordis-root-timers.test.ts`（三基线） | **缺失**（探针已证生产 seam 正确；仓库无断言） |
| AC2 | G1/G3/G4 | 新 `ws-replication-cordis-baseline-lifecycle.test.ts` + runner suite（3×3×7 单元） | **缺失**（探针 10/10 绿，但非仓库证据） |
| AC3 | G7 | `issue270-*`、`on-fatal-error-issue288`、`registry-sa7-rev1` R5P（三基线） | 部分绿（默认布局）；三基线 cell 缺失 |
| AC4 | G7 | 新 Timer 存活/顺序断言 + `dsh-profile-acceptance`（三基线） | **缺失**（全仓无 `ctx.get('timer')` 存活断言） |
| AC5 | G2 | gate（A5-1）+ 通道测试（A5-2/4）+ `ws-package`（A5-3） | 迁移部分**已达成**（零直读）；双通道证据**缺失** |
| AC6 | —（基线面已存在） | 三处 guard-Proxy + 公共面快照 + interop/结构守卫（三基线） | 默认布局绿；三基线 cell 缺失 |
| AC7 | G8 | `baselines.json`/`run-baseline.mjs`/`gates.mjs` 扩展 | 设施已存在；扩展**缺失** |
| AC8 | G1/G6 | `--mode typecheck` × 3 + ①–⑥ 测试面 | **typecheck 三基线已绿**；行为面三基线 cell 缺失 |
| AC9 | — | `gates.mjs` + `git diff --exit-code` | 基线满足；待 gate 守住 |

---

**结论**：诊断证据足以支持「Replication 生产 seam 在三基线已工作、但三基线行为验收能力与双通道证据缺失」这一能力缺口；AC1–AC9 的判据均可执行、可判真假，且给出了「无证据即不通过」的失败面。#470 的 R3 与本票 owner 文本的差异是**票级取代**（§18.3），不需要 ADR 修订或 owner override；因此本报告 `verdict = approve`、`requiresConflictRecheck = false`，契约可进入设计/实现阶段。
