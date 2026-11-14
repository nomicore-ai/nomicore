# SA8 实现级冲突复查 — issue #470：Cordis rc.12 双形态 Root tracer bullet（implementation 复查）

> **iteration 2 复审（证据闭合核销）结论：verdict = `clear`，requiresConflictRecheck = `false`** —— iteration 1 的 `reject`（仅证据面）所列 §8 Required actions 已全部第一手核销闭合；交付条件在当前证据状态下重裁为「按 §4.2(c) 七条限定声明（iteration 2 修订版，见文末 I-6）收口，无需 owner 表态作为前置」。当前结论与裁定以文末「iteration 2 复审」小节为准；上文 iteration 1 内容按 dispatch 要求原样保留，仅作历史记录。

1. **Reviewed subject**: implementation（工作树未提交 diff：6 修改 + 11 新增；HEAD = BASE = `279dba4ac81b7c7520e3d0b87b5c4d621a86a517`，分支 `mabf/issue-470`）。触发依据 = SA8 设计后复查（iteration 1）§8「实现后必须复查项」+ 设计 §21 OPEN 1/2/5 + dispatch 专项（root-test 红 cell 规范裁定）。
2. SA8 dispatch：`sa-24e49b7a-b51a-4332-92f7-fec7079b4c4d`，iteration 0。本报告为该被审对象的**首份**实现级报告（不覆盖设计后复查报告）。
3. 复查方式：只读核证 + 只读验证命令（独立重跑 `gates.mjs`、重跑一条负控、当前树与 **BASE detached worktree** 上的定向单文件复现、pnpm 探针）；未改任何 src/test/fixtures/docs/artifact（唯一写入 = 本报告 + `.cache/` 证据再生）。

---

## 1. Inputs and decision set

| 输入 | 位置 | 本会话核对方式 |
|---|---|---|
| 实现笔记 | `wiki/raw/task_issue-470_sa3_impl.md`（§3 逐处改动/§5 红-绿矩阵/§6 负控与 gates/§7 provenance/§8.1 root-test 红/§10 清单） | 全文 |
| 已批准设计 | `wiki/raw/task_issue-470_design.md`（iteration 1） | 全文（含 §5.1/§5.2/§8.6/§8.8/§11/§13/§14/§15/§16/§17/§21） |
| SA8 前置门禁 | `wiki/raw/task_issue-470_conflict_report.md`（R1–R9、O1–O7、§5 冻结面、§6 环境事实先例） | 全文 |
| SA8 设计后复查 | `wiki/raw/task_issue-470_design_conflict_report.md`（C-R4a–d、§8 实现后复查清单、A′-1） | 全文 |
| Owner 原文 | `wiki/raw/task_issue-470.md`（8 checkbox L21–L28 + L17 尾句；Comments 空，本会话再核） | 全文 |
| SA6 契约 | `wiki/raw/task_issue-470_sa6_acceptance_contract.md`（§12.2 AC6、§12.4、§12.5） | AC6/证据契约节 |
| ADR | 0035（§2/§5）、0006、0009、0012、0023、0032（经 AGENTS 收录） | 相关条款重核 |
| 模块契约 | `packages/persistence/AGENTS.md` L17（root `pnpm typecheck` + `pnpm test`）、`packages/ws-replication/AGENTS.md` L25–L27（focused + 包 typecheck + 根 typecheck + 根 test） | 逐字 |
| 实际 diff | `git status --porcelain` / `git diff --name-only/--stat 279dba4` / `git ls-files --others` | 逐文件 + diff 全文（M1/M2 全量、M3–M6 全量） |
| 证据树 | `.cache/cordis-baselines/evidence/**`（matrix/gates/root-test/B1–B3）、`evidence-base/red-matrix-summary.json`、`green-matrix.log`、`red-matrix(-phase).log`、`root-test.vitest.json` | 逐 JSON/日志 + 脚本化提取 |
| 只读验证（本会话第一手） | 见 §3 各行「本会话验证」 | 独立执行 |

---

## 2. 逐条核销总览

| # | 复查项 | 结论 | 详见 |
|---|---|---|---|
| 1 | R2 迁移面（实际 diff） | **持守**（恰 6+11；DENY 面零 diff） | §3.1 |
| 2 | R1 三基线 15-project typecheck | **持守**（15/15 ×3；B3 TS2576=0；无掩蔽载体） | §3.2 |
| 3 | R4 seam 失败语义实际形态（含 read-throw 裁定） | **持守**（C-R4a–d 逐条对上；文案逐字节核） | §3.3 |
| 4 | R7 gates 首落地 | **持守**（独立重跑 9/9；G5 捕获+清理第一手） | §3.4 |
| 5 | R8 ADR 0023 冻结面 | **持守**（服务构造/断言面零触碰；1 条 cosmetic 注记） | §3.5 |
| 6 | R3 / root-test 红 cell 规范裁定（本轮核心） | **裁定成立**：非 R1/AC6 违反；R3 第四件在本环境未满足 ⇒ 有条件交付 + owner 升级 | §4 |
| 7 | O1–O7 红线回归 | **零回归**（无超范围宣称） | §3.6 |
| 8 | 负控证据完整性（SA8 主动扩查） | **缺口**：4 枚声明的 fault 证据 JSON 缺失 3 枚（1 枚已由本会话再生成验证机制） | §5 |
| — | Verdict | **reject**（窄域可修：证据补齐 + 交付限定；无 hard-conflict） | §8/§9 |

---

## 3. Decision analysis（逐项）

### 3.1 R2 迁移面（实际 diff）— no-conflict（持守）

| 检查 | 事实（本会话核证） | 证据 |
|---|---|---|
| tracked 修改 | `git diff --name-only 279dba4` **恰 = M1–M6**：`packages/persistence/src/service.ts`、`packages/ws-replication/src/plugin.ts`、4 个具名 fixture | git 命令输出 |
| 新增 | untracked **恰 = N1–N11**：`packages/persistence/test/` 下 4 个 `.test.ts` + `test/fixtures/cordis-baselines/` 下 7 个文件（baselines.json/provenance-b3.json/public-surface.base.json/acquire.mjs/run-baseline.mjs/root-probe.mjs/gates.mjs）+ `wiki/raw/**`（Host/Controller 既有工件，非实现面，SA3 §2 已申报） | `git ls-files --others` |
| ALLOW 外零 diff | manifests/lock/artifacts（G1′ 19 pathspec）、两包 `src/index.ts`（G4）、`docs/`（G7）、tsconfig/vitest.config（G9 19 pathspec）、persistence 核心/dsh/registry src（G2 changed=[service.ts]）、replication-protocol、apps/、`.gitignore`、CONTEXT.md、domains —— 全部不在 diff 清单 | git diff + gates |
| 语义面 | M1/M2 diff 全文逐行核对：仅 Root 解析缝 + 捕获纪律 + 文档注释；`assertPersistenceHostDependencies` 零改动；plugin.ts 其余（服务构造、hub/peer apply 调用点）零触碰 | diff 全文 |
| **本会话验证** | 独立重跑 `node …/gates.mjs`：**9/9 PASS，exit 0**（G2 changed=[service.ts]；G3 changed=[plugin.ts + 4 fixture]） | gates 输出 |

fixture 迁移形态与设计 §6 逐字一致：每文件内联 `resolveRootForTest`、`effectTimer` 改用 helper、探测分支删除 → 统一 symbol shim（`ctx: { [Symbol.for('cordis.root')]: { timeout } }`）。harness 的 `ctx.rootValue`/`ctx.root('hub',…)` 零触碰（grep 复核）。

### 3.2 R1 三基线全仓 typecheck — implements-existing-decision（持守）

- `matrix.json`：B1/B2/B3 typecheck cell 均 `pass`，`projectCount: 15`，15 个 project（含 `packages/ws-replication/tsconfig.json`、`apps/yjs-server/tsconfig.json`）逐条 `exitCode: 0`。
- B3：全部 15 个 project 日志 grep `error TS`/`TS2576` **零命中**（base 实测 13 TS2576 → 0，D7 红→绿成立；BASE 侧 `evidence-base` B3 typecheck 记录 7 project 红 + TS2576 在案）。
- 反掩蔽：清单由 runner 从根 `package.json` `scripts.typecheck` 解析（`run-baseline.mjs` `tsc -p (\S+)` 正则，非内置副本）；G9 对 19 条 tsconfig/vitest pathspec 零 diff（本会话独立重跑 PASS）；无 skip（全套件 `--passWithNoTests=false`；实现未引入任何 skip/删项/cast——TS2576 的消除机制 = 源码不再出现 `ctx.root` 属性访问，grep 复核生产 src + 4 fixture 仅剩注释级引用 `plugin.ts:264`）。
- 注记（与 §4 裁定相关）：15-project `tsc -p` 与根 `scripts.test` 的 vitest `--typecheck` 通道是**两条不同 lane**——4 例 test-d 类型错误只出现在后者（见 §4.1）；R1 的规范锚定于前者（SA8 前置 R1 绑定 + 根 `scripts.typecheck`），前者全绿。

### 3.3 R4 失败语义实际形态 — implements-existing-decision（持守，C-R4a–d 逐条）

| 约束 | 实现形态（diff 逐行） | 核销 |
|---|---|---|
| C-R4a | `safeReadChannel`（两包同构）：try/catch **只包单次 `Reflect.get`**，catch 唯一动作 `return undefined`；`assertRootTimerShape` 在 catch 之外、两通道分支各一次；host 级联与最终 throw 在函数体顶层、无包裹 | ✓ |
| C-R4b | 推进链 = 同 host symbol→legacy →（ws）下一 host `timer.ctx → ctx` → `throwRootTimerUnavailable()` 稳定单句；级联仅发生于「整 host 缺席（返回 undefined）」，present-but-malformed 立即 throw；无任何 ambient/`setTimeout`/globalThis 兜底（G8 零命中） | ✓ |
| C-R4c | 两 seam 出口严格二选一：已验证形状的 `rootTimer`，或 apply 期同步稳定 throw；`undefined` 只被「继续推进或最终 throw」消费，无泄漏给调用方继续运行 | ✓ |
| C-R4d | sentinel（channel 测试 symbol 可读时 legacy 零读取）+ `--fault legacy-shim` 负控原样保留；**本会话重跑负控**：`--baseline B3 --suite root-probe --fault legacy-shim` → `{expected:'fail', observed:'fail', code:1}` 外层 exit 0，证据 `evidence/B3/fault-legacy-shim.json` 落盘 | ✓ |
| read-throw 裁定（§5.1） | 实现即设计骨架：读取抛错 → `undefined` → 归一缺席 → 推进；D10（双通道皆拒 → 同一稳定文案）与 D11 pin（symbol 读抛 + legacy 可读 → arm legacy）在 `cordis-root-channel.test.ts`（red-matrix B1 root-probe 6 失败 = D1/D2/D3/D10 族 + legacy-malformed；绿矩阵 12/12 ×3 基线） | ✓ |
| F5 守卫 | `tryResolveRootTimer` 首行 `host === null || typeof host !== 'object'` → 立即稳定 throw（不进 `Reflect.get`、不级联）；`timer.ctx === undefined` 仍级联 | ✓ |
| B1/F1 捕获形态 | 两处均为 `rootTimer.timeout(callback, delayMs)` **方法调用**、零 detach（diff 逐行；doc comment 明示 ❌ detach 与 C15 理由）；real-timer 三基线 10/10 ×3 连跑绿为运行时佐证 | ✓ |
| 文案（§5.2 冻结） | persistence 新文案 = `required Cordis root timer context is unavailable: the host root context must expose a callable timeout via Symbol.for('cordis.root') or the legacy root property` —— 与设计 §5.2 **逐字节一致**（源码两段字符串拼接后精确相等）、单句；ws-replication 文案 `'required Cordis root timer context is unavailable'` 逐字节不变；既有 timer service 文案两条逐字节不变（`assertPersistenceHostDependencies` 零改动 + plugin timer 分支零改动）；clock 文案零触碰 | ✓ |

### 3.4 R7 gates 首落地 — implements-existing-decision（持守）

- **本会话独立重跑 `gates.mjs`：9/9 PASS，exit 0**（G1′ 19 pathspec / G2 / G3 / G4 / G5 / G6 / G7 / G8 / G9）。
- G5 五步：worktree 预检 → `worktree add --detach .worktrees/base-snapshot` → 声明驱动 farm（16 包 109 链；`@nomicore/*` → base worktree 兄弟包，A′-1 歧义按「不链主仓 @nomicore 安装」消除）→ 四 entry 快照比对（BASE 捕获 vs tracked 快照）+ 默认布局 runtime surface test → finally `worktree remove --force`。**清理第一手核证**：重跑后 `git worktree list` 仅剩主仓与本 worktree，`.worktrees/` 空。
- 失败语义：gate 失败 → `exit 1` 并打印 gate 编号与路径；harness 自身故障 → `exit 2`；G5 陈旧 worktree → 响亮失败并给清理指引（不静默复用）。矩阵侧 gates cell 任一红 ⇒ cell 红 ⇒ 聚合 exit 1（`MATRIX FAIL … green cells never offset a red cell`，green-matrix.log 实测）。
- D-a（工作树 vs `$BASE..HEAD` 比较）：本会话核对 `changedPaths` 实现 = `git diff --name-only BASE -- <pathspec>` ∪ `git ls-files --others`——在 HEAD==BASE 且未提交的工作树上是对设计语义的**严格超集**（零 diff 义务一项不减、untracked 亦被覆盖），非放松。
- G9 执法面：pathspec 实为 19 条（含各包 `tsconfig.build.json`/`vitest.config.ts` 探测）——设计 G9 的超集，更严。

### 3.5 R8 ADR 0023 冻结面 — no-conflict（持守）

| 冻结面 | 实际结果 |
|---|---|
| 两 replication 服务访问器 + `Object.freeze` 构造（ADR 0023 L45） | plugin.ts diff 全部 hunk限于 `timerFromContext` + 新私有函数 + `OwnedTimer.setTimeout` 内部；服务构造体、互斥入口、公共工厂零触碰；`src/index.ts` 零 diff（G4） |
| `ws-replication-guard-proxy-consumption.test.ts` 断言面 | diff 仅 `dependencies()` 改写 + 文件头新增 helper；guard-Proxy 断言面原样；B1 实跑绿（ws-package cell 2/2） |
| ws-package cell | 4 文件逐个实跑 66/66（15/7/42/2），逐文件存在预检 + `--passWithNoTests=false`；`evidence/B1/ws-package.json` 落位 |
| Cosmetic 注记（非冲突） | guard-proxy 文件新增的 `resolveRootForTest`（:35）在本文件内**未被使用**（其余 3 文件均使用）。属 ALLOW 内死代码，无决策冲突；建议 Controller add 前顺手删除或留待后续（不构成必修） |

### 3.6 O1–O7 红线回归 — 零回归

- O1（子集 typecheck/带债收口）：15-project 全绿无子集；root-test 红被如实上报为 cell fail + 矩阵 exit 1，无「绿抵销红」、无 skip/降级（runner 代码 + 证据双核）。
- O2：同上——未以任何形式宣称红 cell 通过。
- O3：ws-replication 恰按 R2 授权面改动。
- O4（cast-only/tsconfig 压静）：TS2576 由源码形态消除；G9 机械封锁（19 pathspec 零 diff）。
- O5（官方流水线强求）：provenance `honestyNote` 明记 minimal tsc source-build 非官方流水线（§7 第 8 项）。
- O6（升依赖/硬切）：G1′ 零 diff；seam 有 legacy 兜底（非 symbol-only）。
- O7（Replication 行为宣称）：SA3 §8.2 明文「本票不宣称 Replication rc.12 行为兼容」；建议 commit message（§11）只写 seam/fixture/设施事实；证据 JSON 无任何 Replication 行为 cell 或宣称。**无超范围表述**。

---

## 4. R3 / root-test 红 cell 的规范裁定（本轮核心）

### 4.1 事实认定（全部第一手复核）

- Cell 形态：`root-test` = 默认布局全量 `NODE_OPTIONS=--conditions=nomicore-source node <repo>/node_modules/vitest/vitest.mjs run --typecheck`（cwd=仓库根），与根 `scripts.test` 等价、env 逐字保留、**未注入 pnpm shim、未 skip、未过滤**（`run-baseline.mjs runRootTestCell` 逐行核）；`pnpm --version` 探针仅记入 `diagnostics`（明注 "not a gate"）。结果：5880/5912，**32 failed，exit 1**，矩阵 `MATRIX FAIL: 1/24`。
- 32 例构成（`root-test.vitest.json` 脚本化提取，按文件：6+1 dsh-persistence 探针、6 vfsl schema-check、15 vfsl-codegen generate、4 ws-replication issue421 test-d）：
  - **28 例 = 环境归因成立（本会话第一手三重证明）**：(i) `pnpm --version` 在本环境**独立 exit 1**（corepack 报「project 配置 10.28.2，当前 11.28.5」——环境 pnpm 违反仓库自身 `packageManager: pnpm@10.28.2` 声明）；(ii) 失败形态全部是子进程 exit 1（测试断言 `expected 1 to be 0`）；(iii) 把 `.cache/pnpm-shim/pnpm`（`exec corepack pnpm@10.28.2`）置 PATH 首部 + 同款 `NODE_OPTIONS` 后，抽检 3 文件（dsh-probe-cli 7/7、dsh-file-probe-determinism、schema-check-cli 合计 8/8）**全部转绿**——即补齐仓库声明的 pnpm 版本即绿，零仓库改动。
  - **4 例 = 既有不兼容归因成立（本会话第一手双证明）**：(i) 机制定位——4 处失败全部是 `expectTypeOf(...).parameters.toEqualTypeOf<[…可选参数元组…]>()` 断言（`overrides?`/`request?`/`code?`/`wsCloseCode?`），expect-type 的「0 参调用仅在类型精确相等时合法」使不匹配呈现为 `Expected 1 arguments, but got 0`；同文件无可选成员的同类断言（如 `[frame: Uint8Array]`）与 issue447 的断言**全绿** ⇒ 失败判别面 = 可选参数元组 × expect-type@1.4.0（vitest 3.2.7 解析）的比较行为，非被测类型漂移；(ii) **BASE detached worktree（279dba4 + 同款 farm）上单文件复现：`4 failed | 4 passed`，逐条相同**（本会话执行；`createHubReplicationPlugin` 签名 M2 零改动，4 处失败中 3 处主体类型来自零 diff 文件）。
  - 9 个失败文件**全部不在本票 diff 内**（diff 面 = M1–M6，无交集）。
- BASE 复现（dsh-probe-cli @ BASE：`6 failed | 1 passed`，同款）——SA3 §8.1 的「BASE 逐条复现 + shim 后 28 例转绿」两项主张**内容属实**；但注意其**未持久化**为 `.cache` 工件（见 §5 关联注记），本会话已用独立复现补齐第一手证据。

### 4.2 裁定

**(a) 是否构成 R1 / owner AC6 / R3 的实质违反**

- **R1（全仓 typecheck 严格读法）：不违反。** R1 的规范锚 = 根 `scripts.typecheck` 15-project 清单逐基线 `tsc -p` exit 0——三基线全绿、B3 TS2576=0、无掩蔽。4 例类型错误只存在于根 `scripts.test` 的 vitest test-file typecheck lane，其全部输入（test-d 文件、tsconfig/vitest 配置、lockfile 工具链）零 diff 且已在 BASE 复现；R1 未被触碰。
- **owner AC6：不违反，但表述受约束。** AC6 的测试义务族 =「现有 Persistence contract、真实 Timer、Nomicore DSH profile 相关测试」——contract/real-timer/dsh-profile/unload 四族三基线全绿（242/242、10/10×3、12/12、6/6 ×3 基线）；32 例失败文件既不在 AC6 点名族内，也不在本票 diff 内，且归因独立于本票。**约束**：交付叙述不得由此引申「根 test 全绿」或「既有测试全绿」——7 例 dsh-persistence 探针失败属既有 DSH 相邻测试的环境红，任何「现有 DSH 相关测试全绿」的表述必须带环境限定。
- **R3（B1 包门禁四件套）：第四件在本环境未满足——形式缺口，非决策冲突。** persistence AGENTS L17 与 ws-replication AGENTS L27 均要求 contract/lifecycle/wire 改动跑根 `pnpm test`；本票改动落入两者适用面。前三件（focused tests=66/66、包 typecheck、根 typecheck 15/15）全绿；第四件已**真实执行**且诚实判红（无 skip/无降级/无 shim 掩蔽），红因经第一手归因 = 环境（28）+ 既有（4），零本票因果。同时触发的还有**已批准设计 §17-3 自设交付规则**（root-test 任一红 ⇒ 交付阻断，不得以矩阵其余绿抵销）——SA3 遵守了该规则（矩阵 exit 1、cell 如实红、上报待裁），未擅自绕过。

**(b) 是否允许带该环境红交付（不改 ALLOW 外文件、不 skip/降级）**

**有条件允许——针对「仓库 diff 的交付」；条件如下（全部为绑定约束）：**

1. 归因证据链必须如本报告 §4.1 入 work records（BASE 等量复现 + 环境探针 + shim 转绿抽检），且 28 例必须在**尊重 `packageManager` 声明的环境**（如 PATH 前置 `corepack pnpm@10.28.2` shim 或对齐的 corepack 配置）下复跑 root-test 并记录 28→绿——这是 SA8 前置报告 §6 既有先例（「验收命令用本地二进制或显式 corepack pnpm@10.28.2」）的适用，**属补齐环境而非掩蔽**；SA3 不把 shim 固化进交付链路是正确选择（设计 §8.6 命令逐字冻结），复跑属验收现场动作（SA10/Controller）。
2. 复跑后仍余 **4 例既有 test-d 红**：其修复必在 ALLOW 之外（G3/R2 禁改该文件；G1′ 禁动工具链）⇒ 在本票内不可修。允许以「显式标注的既有红」带红交付**仅当 owner 接受**（见 (d)）；owner 未表态前，§17-3 的交付阻断保持有效。
3. 任何情况下：不得改 ALLOW 外文件、不得 skip/降级/过滤 root-test、不得把 shim 注入交付链路、不得让矩阵聚合语义放松（现状 runner 代码已符合，保持）。

**(c) 交付叙述必须遵守的限定声明清单（绑定，缺一即失实）**

1. **不得声称**「根 test 全绿」「默认布局全量测试通过」「既有测试全绿」或任何等价表述。
2. 必须写明：`root-test` cell 红 = **32 = 28 环境 + 4 既有**；28 = 环境 pnpm（corepack 11.28.5）违反仓库 `packageManager: pnpm@10.28.2` 声明所致子进程失败（`pnpm --version` 独立 exit 1）；4 = 既有 `ws-replication-issue421-edge-factory-api.test-d.ts` 的可选参数元组断言与 expect-type@1.4.0（vitest 3.2.7）不兼容。
3. 必须提供 **BASE 等量复现证据**（两族逐条；本报告 §4.1 的独立复现可引，SA10 交付现场应留存同等工件——SA3 原始 BASE 复现未落盘，见 §5）。
4. 必须写明 shim 实验：28 例在补齐声明版本后转绿（抽检 3 文件 15 例全绿，本会话复现）；4 例不受 shim 影响。
5. 必须在 work records/交付摘要**显式标注**：该 cell 触发设计 §17-3 交付阻断语义，带红交付系经 owner 裁定（或环境复跑 + owner 对 4 例既有红的接受）；4 例既有红的修复另立后续票（文件在 G3 allowlist 外）。
6. AC6 表述限定：AC6 点名族全绿可以声称；涉及「现有 DSH 相关测试」的任何总括表述必须带环境限定。
7. 复跑留证：交付现场在 packageManager 对齐环境下重跑 root-test 的完整证据（预期 5908/5912，余 4 既有红）应与矩阵证据并存，不得以复跑结果覆盖原证据。

**(d) 是否需要 owner 升级**

**需要——但仅一个窄问题**（默认优先在既有决策集合内裁定；以下已被集合内消解，无需升级）：28 例环境红的处置（先例 = SA8 前置 §6；补齐环境复跑即可，属验收现场动作）。**需要升级的窄问题**：在 §17-3「root-test 任一红 ⇒ 交付阻断」与「4 例既有红在本票 ALLOW 内不可修」之间，owner 需二选一：

> issue #470 是否允许在 (i) 不改 `ws-replication-issue421-edge-factory-api.test-d.ts`（本票 ALLOW 外）、(ii) 不 skip/降级、(iii) 按 §4.2(c) 全部限定声明交付的前提下，携带该 4 例 **BASE 即存在的既有类型断言红**收口本票（修复另立后续票）？若不允许，本票交付顺延至后续票修复 + root-test 复绿之后。

该问题不阻塞设计/diff 本身的合规性（本报告 §3 全项持守），只阻塞**收口时点**。若 owner 表态允许，不构成对 AC6 checkbox 的 override（AC6 点名族全绿；root-test 属 AGENTS/设计层门禁），无需回前置门禁重立契约；若 owner 表态「零容忍」，则按 §17-3 顺延，亦无冲突。

---

## 5. 主动扩查：负控证据完整性缺口（reject 的直接依据）

| 事实 | 证据 |
|---|---|
| SA3 §6.1/§9 声称四负控证据落位 `evidence/B3/fault-fallback.json`、`fault-substitute-npm.json`、`evidence/B2/fault-substitute-rc12.json`、`evidence/B3/fault-legacy-shim.json` | 报告原文 |
| **本会话核证：上述 4 枚 JSON 均不存在**（全树 `find`/`grep '"expected": "fail"'` 零命中；`evidence/B2`、`evidence/B3` 目录无 fault 文件） | find/grep 输出 |
| 时间线：四个 fault workspace 物化于 23:01:44–23:01:52；`run-baseline.mjs` mtime = **23:02:39**（晚于负控执行）⇒ 负控由**旧版 runner** 执行，现行 `runFault` 的证据落盘代码当时不存在 | stat 时间戳 |
| 负控机制本身可信：本会话以**现行 runner** 重跑 `--fault legacy-shim` → `{expected:'fail', observed:'fail', code:1}`、外层 exit 0、`evidence/B3/fault-legacy-shim.json` 落盘（内容与 SA3 声称语义一致）；四个 fault workspace 与引用的内层判红输出具体可信（运行确实发生过） | 本会话重跑输出 |
| 关联注记：SA3 §8.1 的 BASE root-test 复现与 shim 实验同样**未持久化**（`.cache` 无对应日志；`base-farm.mjs` 在但无运行记录）——本会话已以独立 BASE worktree 复现补齐第一手证据（§4.1） | 本报告 §4.1 |

裁定：R5 第 7 项（四负控实跑 + 证据 `{expected:'fail', observed:'fail', code}`）与 C-R4d 的机械证明义务在**证据面**未闭合——运行真实性与机制正确性已由本会话部分再证实，但**绑定要求的持久化证据缺 3 枚**，且实现笔记声称其存在属**可修正的不一致**。修复 = 以现行 runner 重跑三条负控命令补齐证据（每条分钟级）：

```
node …/run-baseline.mjs --baseline B3 --suite provenance --suite root-probe --fault fallback
node …/run-baseline.mjs --baseline B3 --suite provenance --suite root-probe --fault substitute-npm
node …/run-baseline.mjs --baseline B2 --suite provenance --suite root-probe --fault substitute-rc12
```

（`legacy-shim` 已由本会话再生成；重跑不触碰任何 tracked 文件。）

次要证据注记（非阻塞）：`root-test.json` 的 `testNames/failedTestNames` 为空，失败清单仅存于 `root-test.log`/`root-test.vitest.json`（§12.5 契约字段未填全）；建议 Controller 交付前让 runner 补记或在摘要中指向 vitest.json。

---

## 6. Frozen surfaces

| Surface | Must remain unchanged | Actual result（本次实际 diff 复查） |
|---|---|---|
| 复制 wire 协议/帧布局/状态机 | 零改动 | 持守（G3 changed ⊆ allowlist；diff 无协议文件） |
| 两包公共导出面（`src/index.ts` ×2） | 逐字节不变 | 持守（G4 零 diff；G5 快照 4 entry 相等 + runtime 测试绿） |
| ADR 0023 冻结服务构造（访问器+freeze+互斥入口+公共工厂 append-only） | 不动 | 持守（plugin.ts diff 范围核证，§3.5） |
| persistence 公共导出面（index/contract/lifecycle/memory/file/testing） | byte-identical | 持守（G2 changed=[service.ts]；G5） |
| 包清单/lock/artifacts | 与 base 逐字节相同 | 持守（G1′ 19 pathspec 零 diff + G6） |
| ADR 0006/0009 生命周期语义 | drain/dispose/degraded/shutdown 不变 | 持守（seam 仅换解析通道；R5P unload 三基线绿，B3 由红转绿） |
| 「全仓 typecheck」定义（15-project） | 根 scripts.typecheck 清单 | 持守（清单从根 package.json 解析；G9 封锁配置面） |
| 稳定错误文案纪律 | 四条既有文案逐字节不变；新 Root 失败单句稳定 | 持守（§3.3 逐字节核） |
| guard-Proxy 断言面（R8） | 断言原样 + B1 绿 | 持守（diff 仅 dependencies()；ws-package 2/2 绿） |
| docs/（含 ADR） | 零 diff | 持守（G7） |

## 7. Evolution requirements / Hard conflicts

**均无。** 实现未触碰 wire/schema/持久化/状态机/公共 API/术语；seam 与失败语义为 ADR 0035 §2 的兑现（implements-existing-decision）；read-throw 归一、F5、B6 pin 与 C-R4a–d/冻结面自洽；无 hard-conflict、无待补 ADR 修订、无 override 需求（§4.2(d) 的 owner 问题属交付时点裁定，非决策演进）。

## 8. Required actions

**交付前必须修（证据补齐，全部不触 tracked 文件）：**

1. 以现行 runner 重跑三条负控（§5 命令），使 `evidence/{B3,B2}/fault-*.json` 四枚齐备（legacy-shim 已补）；SA3 笔记 §6.1/§9 的证据指针随之坐实。
2. 交付现场在 `packageManager` 对齐环境复跑 root-test 并留存证据（预期余 4 例既有红），与原矩阵证据并存（§4.2(b)-1/(c)-7）。

**交付时必须写入的限定声明：** §4.2(c) 全部 7 条（逐条绑定）。

**Owner 升级：** §4.2(d) 窄问题（4 例既有红的带红收口 vs 顺延）。28 例环境红不需要升级（先例已覆盖）。

**非阻塞注记：** guard-proxy 文件未使用的 `resolveRootForTest`（ALLOW 内死代码，可顺手删）；root-test 证据 `testNames` 空缺（指向 vitest.json 即可）。

**无需修改实现代码**：两处 seam、fixture 迁移、runner/gates 的决策符合性全部核销（§3）。

## 9. Verdict

**reject** —— 与决策集合**无冲突**（§3 全项持守、§7 无 hard-conflict/演进），但按 SA8 标准构成「证据不足/可修正的不一致」：(i) 四负控的绑定证据缺 3 枚且实现笔记声称其存在（§5）；(ii) root-test 红 cell 的带红交付尚未满足 §4.2(b) 的复跑条件与 owner 裁定，且交付叙述尚未附 §4.2(c) 限定声明。两项均可在不触任何 tracked 文件的前提下闭合；闭合后本实现即可按 §4.2 路径交付。**reject 不针对 seam/迁移/gates 的实现质量或决策符合性——该面全部 clear。**

## 10. requiresConflictRecheck

**true** —— (i) 三条负控补跑后的证据闭合需复核（含与 SA3 §6.1 声称的判红输出一致性）；(ii) owner 对 §4.2(d) 窄问题的表态若为「允许带红收口」，交付摘要的 §4.2(c) 声明合规需在 SA10/收官门核对；(iii) packageManager 对齐环境的 root-test 复跑结果（28→绿）落地后需与归因记录并档核销。纯实现面（seam/迁移/gates/冻结面）已在本报告闭合，无需再查。

---

# iteration 2 复审（证据闭合核销）

- **Reviewed subject**: 同一 implementation 工作树（HEAD = BASE = `279dba4ac81b7c7520e3d0b87b5c4d621a86a517`，分支 `mabf/issue-470`，改动未提交），叠加 SA3 iteration-1 闭合动作（两处 ALLOW 内改动 + `.cache` 证据落盘）。SA8 dispatch：`sa-ba56fa38-c454-4890-82f8-20977e2dfe8f`，iteration 2。
- **范围（窄）**：仅 (a) 第一手核销本报告 iteration 1 §8 Required actions 是否闭合；(b) 在当前证据状态下重裁交付条件（§4.2(b)/(d) 框架）。**不重做实现质量/决策符合性评审**——iteration 1 §3 已全项 clear、SA4 已 approve，本轮零事实指向该面变化，仅作边界复核（I-4）。
- **方法**：只读核证 + 只读验证命令。本会话第一手执行：独立重跑 `gates.mjs`（9/9 PASS，exit 0，G5 worktree 用毕清理、`git worktree list` 仅主仓+本 worktree）；以仓库 CI 自身 typecheck lane 命令在**当前未改动该文件的默认布局**单文件复跑（I-5(c)）；对四枚负控 JSON、BASE 复现件、对齐复跑件逐字段/逐计数独立重算（不信自述）。唯一写入 = 本报告。未改任何 src/test/fixtures/docs/artifact、未改 runner、未 push/commit/finalize。

## I-1. R-1 核销：四负控证据 — **闭合**

| 检查项 | 第一手事实 | 证据 |
|---|---|---|
| 四枚 JSON 齐备 | `evidence/B3/fault-fallback.json`（mtime 2026-11-14 23:38:40，sha256 `666df90c…a260`）、`evidence/B3/fault-substitute-npm.json`（23:38:44，`bf42016…a773`）、`evidence/B2/fault-substitute-rc12.json`（23:38:45，`92fc25f2…ea4a`）、`evidence/B3/fault-legacy-shim.json`（23:38:48，`1344527…067f`）——sha256 与 SA3 §6.1 逐枚相等 | stat + sha256sum（本会话） |
| 由现行 runner 生成 | 四枚 mtime 全部晚于 runner mtime 23:37:47；runner sha256 `6928b740…984b`（含 R-4 增补；`--fault` 路径零触碰——runFault 代码核读无涉 root-test cell）；`negative-controls-r1.json` 记录同 sha256 | stat/摘要 JSON |
| 证据形态 | 四枚均 `{expected:'fail', observed:'fail', code:1, status:'pass'}`；外层 exit 0 ×4（`negative-controls-r1.log` 四段 `outer-exit=0` 逐条读得） | JSON 字段 + log |
| SA3 §6.1 声称与磁盘一致 | **一致，含更正成立**：`substitute-rc12` 的 root-probe cell 判红于**模块装载失败**（内层 log：`Error: Cannot find package '@deepseek-ai/cosmokit' imported from …/dsh/build/cordis/lib/events.js`，`Test Files 1 failed (1)`、无测试执行），非「B2 期望 legacy、实得 symbol」；provenance cell 判红于 realpath 包含性断言（`@deepseek-ai/cordis resolved outside the B2 overlay: …/dsh/build/cordis`）——即设计 §8.7 要求的 provenance 判红点成立，替换被响亮检出 | fault-substitute-rc12/{B2-provenance,B2-root-probe}.log |
| R5 第 7 项 / C-R4d 机械证明义务 | **满足**：R5-7（四负控实跑 + 证据形态）四枚齐备；C-R4d 锚定的 `legacy-shim` 负控精确红在形状断言（`1 failed | 11 passed`，红断言 = 「基线通道精确命中期望形态」→ `expected { timeout: [Function timeout] } to be undefined`，probe 本体 ok、shim 只作用自建受控 ctx）——sentinel/「legacy shim 蒙混不可行」的机械证明完整 | fault-legacy-shim/B3-root-probe.log |

**非阻塞注记（新发现，入后续边界）**：`substitute-rc12` 的通道级判红点（「symbol 命中而期望 legacy」）在当前负控工件形态下**不可达**——`dsh/build/cordis` 下无 `node_modules` 链接，替换件在装载期即失败；该 fault 的替换检出完全由 provenance realpath 断言承载（成立）。SA3 已如实披露。若项目日后需要该 fault 的**通道级**同名替换判别，需后续票给 DSH build 目录补 cosmokit/cordis 解析链接（fixture 加固，本票不必）。

## I-2. R-2 核销：BASE 等量复现证据 — **闭合**

- 证据在盘：`.cache/cordis-baselines/evidence-base/base-repro/`（4× `<family>.log` + 4× `<family>.vitest.json` + `base-repro-run.log` + 汇总 `base-root-test-repro-summary.json`）。
- **本会话独立重算**（直接解析各 `<family>.vitest.json`，不信汇总自述）：dsh-persistence **7 failed/2 passed**、vfsl-schema-check **6/0**、vfsl-codegen **15/46**、ws-issue421-test-d **4/4** → 合计 **32 failed / 52 passed / 84**，四条命令真实 exit 均 1（run log 逐条）。
- 与矩阵侧相等：汇总 `comparison` 9/9 文件 `equal: true`（逐文件 failed/passed 与矩阵 root-test 比对）；`expectedCounts` 与绿矩阵逐族相等。
- BASE 身份：`worktree.head = baseCommit = 279dba4…`、`clean: true`；farm 16 packages/109 links（`@nomicore/*` → base 兄弟包，工具链 vitest 3.2.7/typescript 5.9.3/node v24.13.0 与矩阵侧同源——等量复现的方法学成立）。
- **诚实标注在案**：`coverageMode: "per-family rerun (4 sequential vitest commands) — NOT a single full-suite run"`。逐族而非单次全量属可接受取证形态（覆盖矩阵 root-test 全部 9 个失败文件、逐项相等），SA3 §8.1 表述与磁盘一致。
- 取证后 BASE worktree 已删（本会话 `git worktree list` 复核仅 2 项，`.worktrees/` 空）。

## I-3. R-3 核销：packageManager 对齐复跑 — **闭合**

| 分项 | 第一手事实 |
|---|---|
| (i) shim 仅进程内 | shim = `.cache/cordis-baselines/pnpm-shim-10.28.2/pnpm`（42 字节 `#!/bin/sh` + `exec corepack pnpm@10.28.2 "$@"`，gitignored、PATH 局部）；**runner 零命中** `pnpm-shim/corepack/10.28.2/packageManager`（grep 全文）——未固化进 runner/交付链路；仓库洁净性 pre/post `git status` sha256 相同（`pre/post-r3-git-status.txt`） |
| (ii) 命令与 §8.6 一致 | `NODE_OPTIONS=--conditions=nomicore-source node node_modules/vitest/vitest.mjs run --typecheck`（cwd=仓库根）逐字，仅追加与矩阵 cell 同款 `--reporter/default/json + --outputFile.json` 捕获 flags；无选择过滤/skip/降级（evidence `command`/`commandNote` 字段 + log 复核） |
| (iii) 结果与归因 | **本会话独立重算** `root-test-pnpm10282.vitest.json`：5912 total / 5908 passed / **4 failed**，exit 1；4 例全部位于 `ws-replication-issue421-edge-factory-api.test-d.ts`（EF-C1 ×1、EF-C2 ×3，名字逐条读出）；8 个环境归因文件 **76/76 passed、0 failed**（dsh 9/9、schema-check 6/6、codegen 61/61）——28 例环境红全数转绿，4 例不受 shim 影响 |
| (iv) 证据并存 | 三套并存未覆盖：原件归档 `root-test.matrix-run-2026-11-14T2311.{json,log,vitest.json}`（23:11，counts 32 failed 本会话复读）＋ R-4 再生 `root-test.json`（23:53，同 32 failed，`testNames`=5912/`failedTestNames`=32）＋ `root-test-pnpm10282.{json,log,vitest.json}`（23:45–23:46）。R-4 对原件的「归档再生成」已在 SA3 §9.5 R-4 如实申报，失败集不变 |

iteration 1 §4.2(b)-1 的复跑条件（28 例在对齐环境转绿并留证）**已满足**，且强于原要求（单次完整全量 5912 例，非抽检）。

## I-4. R-4/R-5 与 diff 面 — **闭合，无越界**

- **M6**（`ws-replication-guard-proxy-consumption.test.ts`）：相对 BASE 净 diff 仅剩单个 hunk（`dependencies()` 改写为统一 symbol shim）；未使用 helper 已删净（`resolveRootForTest` 全文 0 命中）；guard-Proxy 断言面原样；B1 `ws-package` 删除后复跑 **66/66**（15/7/42/2 逐文件 exit 0，`evidence/B1/ws-package.json` mtime 23:53:21 晚于删除）——R8 锚点保持。
- **N9**（`run-baseline.mjs`）：R-4 改动 = `runRootTestCell` 在 vitest 结束后**从 JSON reporter 回读补记** `testNames/failedTestNames`（§12.5 契约字段）；spawn 命令/参数/env（`NODE_OPTIONS` 逐字保留、cwd=REPO、不调 pnpm）/聚合语义（`MATRIX FAIL … green cells never offset a red cell`、任一红 exit 1）零变化——§8.6 命令与 `--all --matrix` 语义持守。
- **本会话独立重跑 `gates.mjs`：9/9 PASS，exit 0**（G1′ 19 pathspec / G2 changed=[service.ts] / G3 changed=[plugin.ts + 4 fixture] ⊆ allowlist / G4/G5/G6/G7/G8/G9）；G5 worktree finally 清理无残留。
- **总 diff 面持守**：`git diff --stat 279dba4` = **6 files changed, 177 insertions(+), 30 deletions(-)**；untracked packages 侧恰 11 文件（4 `.test.ts` + 7 fixtures）——与设计 §11.1/§17「6 修改 + 11 新增」零增减；ALLOW 外零 diff。两处 iteration-1 改动分别落在 M6 与 N9 既有 ALLOW 承载内（注：`run-baseline.mjs` 为 N9 **新增**文件而非 tracked 修改，SA3 §9.5 表述已如实区分）。
- 次要注记（非阻塞，ALLOW 内死代码）：`ws-replication-issue299-ac-red.test.ts` 的 `resolveRootForTest`（:170）仍无调用点（本会话 grep：定义 1 处、调用 0 处）——本轮 dispatch 清理范围仅 guard-proxy，SA3 已披露留待后续；分类同 iteration 1 cosmetic 注记，不构成冲突。

## I-5. 交付条件重裁（本轮核心）

### 5.1 事实基座（全部第一手）

1. **§4.2(b)-1 已满足**：28 例环境红在对齐环境单次完整全量复跑转绿（I-3），证据与归因链完整落盘。
2. **4 例既有 test-d 红的四重证明**：
   - (a) 文件与本票 diff **零交集**（`git diff --name-only 279dba4 -- <该文件>` = 0 行）；
   - (b) BASE（279dba4 + 同款 farm）复现 **4 failed | 4 passed**（iteration 1 本会话独立复现 + SA3 R-2 持久化件复核，I-2）；
   - (c) **Controller 侧独立核实（本会话执行）**：以仓库 CI 自身 typecheck lane 命令（`.github/workflows/ci.yml:44`「Typecheck tests (*.test-d.ts)」job 形态）`NODE_OPTIONS=--conditions=nomicore-source node node_modules/vitest/vitest.mjs run packages/ws-replication/test/ws-replication-issue421-edge-factory-api.test-d.ts --typecheck.only --passWithNoTests=false`，在**当前未改动该文件的仓库默认布局**下得 `Tests 4 failed | 4 passed (8)`、`Type Errors 4 failed`、exit 1——即 **base 分支在该 CI lane 本就是红的**（该 lane 无文件过滤、工具链来自零 diff 的 lockfile）；
   - (d) 修复必在 ALLOW/R2/G3 之外（改断言）或 G1′ 之外（升 expect-type 工具链）——本票内不可修。
3. AC6 文义核读（owner 第 6 checkbox）：要求「每基线全仓 typecheck + 现有 Persistence contract、真实 Timer、DSH profile 相关测试」——三基线对应面全绿（15-project ×3、contract 242/242/246、real-timer 10/10 ×3、dsh-profile 12/12 ×3）；对齐环境下连广义「DSH 相关」亦绿（I-3 76/76）。AC6 **文义满足**，无需任何 override。

### 5.2 裁定：4 例可在**不取得 owner 表态**的前提下按限定声明收口

**裁定：可以。** 依据（最小理由链，逐条对应 iteration 1 §4.2(d) 之所以要求升级的前提消解）：

1. **决策集合层面无任何被违反或需豁免的条款**：R1（15-project typecheck）全绿；owner AC6 按其文义满足（上列 3）；模块 AGENTS（persistence L17 / ws-replication L25–27）对该类改动的义务是「**跑**根 `pnpm test`」——执行 + 如实上报义务，已履行（矩阵 cell 如实红、exit 1、无 skip/降级/掩蔽、归因入档）；没有任何 ADR/CONTEXT/AGENTS 条款要求「触碰类工单必须修好 base 分支既有的红」。
2. **iteration 1 要求升级的唯一实质依据——设计 §17-3「root-test 任一红 ⇒ 交付阻断」——不是决策层规则**：SA8 冲突基准只有 ADR 全集 + CONTEXT.md；§17-3 是已批准设计的自设验证规则（wiki 工件，严于基准）。其规范根基（AGENTS 根 test 门禁）是执行/上报义务（上列 1）；其事实前提「root-test 红 ⇒ 本票所致或环境所致」已被 5.1-2 四重证明**证伪**（4 例 = base 分支自身 CI lane 既有红）。且 §17-3 与设计自身 §11.1 ALLOW 在该事实上**联合不可满足**（阻断要求修、ALLOW 禁止修）——一条因事后事实而不可满足的自设规则，不能自动升格为决策层阻断；退回决策基准（跑 + 如实上报 + 零回归）不构成 override，无需 SA8 替 owner 创设豁免。
3. **不修反而持守更硬的边界**：在票内改该文件将 (i) 越出 R2/G3 allowlist（本身需 Controller/owner 扩权），(ii) 触碰 issue #421「accept 双入口与公共句柄冻结面」的类型 pin 断言（EF-C2 族）而无专属评审——与决策集合的冻结纪律相悖的方向。
4. **升级问题因而已被既有决策集合消解**：iteration 1 §4.2(d) 之设问（「§17-3 阻断 vs ALLOW 内不可修」二选一）预设两者均为有效约束；在 5.1-2(c) 确立「base 分支自身 CI lane 既有红」后，阻断侧约束失去决策层效力，二选一不复存在。owner 表态**欢迎但不前置**：Controller 可选择在 PR 中一并向 owner 披露请求确认；若 owner 另有表态（含「零容忍顺延」），从其裁定——那是交付授权问题，不是冲突裁定问题。

**若无法取得 owner 表态时的合规收口路径（约束性）**：按 I-6 全部限定声明交付，并在交付摘要/PR 正文**显式挂起**该问题（root-test 4 例既有红 + 证据指针 + 后续票边界），不得阻断、不得静默、不得以任何「等价绿」表述替代。矩阵证据保持红且 exit 1 原样在档。

### 5.3 iteration 1 §4.2(c)-5 的相应修订

原第 5 条「带红交付系经 owner 裁定（或环境复跑 + owner 对 4 例既有红的接受）」修订为：「带红收口依据 = 环境复跑（R-3）+ SA8 iteration-2 裁定（既有决策集合内消解，见 I-5.2；4 例 = base 分支 CI lane 既有红 + 本票不可修 + 全套披露）」；其余 6 条不变（3/4/7 按 iteration 2 更强的落盘证据更新指针）。

## I-6. 交付时必须写入的最终限定声明清单（可直接被 SA9/SA10 与交付摘要引用；缺一即失实）

1. **不得声称**「根 test 全绿」「默认布局全量测试通过」「既有测试全绿」或任何等价表述（含「CI 全绿」）。
2. 必须写明：`root-test` cell 红 = **32 = 28 环境 + 4 既有**；28 = 环境 pnpm（corepack 11.28.5）违反仓库 `packageManager: pnpm@10.28.2` 声明所致子进程失败（`pnpm --version` 独立 exit 1）；4 = 既有 `packages/ws-replication/test/ws-replication-issue421-edge-factory-api.test-d.ts` 可选参数元组断言与 expect-type@1.4.0（vitest 3.2.7 解析）不兼容（`Expected 1 arguments, but got 0`）。
3. 必须提供 **BASE 等量复现证据**：`.cache/cordis-baselines/evidence-base/base-repro/**`（BASE 279dba4、逐族 4 条命令、32/52/84、9/9 文件与矩阵逐项相等、诚实标注「逐族复跑非单次全量」）。
4. 必须写明对齐环境复跑：`.cache/cordis-baselines/evidence/root-test/root-test-pnpm10282.*`——**单次完整全量 5912/5908/4**，8 个环境归因文件 76/76 绿（非抽检）；4 例 test-d 不受 shim 影响；且该 4 例在仓库 CI 自身 test-d typecheck lane（`ci.yml:44`）于未改动布局即 `4 failed | 4 passed / Type Errors 4 failed`（base 分支既有红）。
5. 必须显式标注：该 cell 触发设计 §17-3 字面阻断语义；带红收口依据 = SA8 iteration-2 裁定（I-5.2：AC6 文义满足、AGENTS 为执行+如实上报义务、§17-3 非决策层规则且其事实前提被证伪）；4 例修复**另立后续票**（文件在本票 ALLOW/G3 外，改写断言触碰 issue #421 公共句柄冻结面 pin，需专属评审）；owner 如另表态从其裁定。
6. AC6 表述限定：AC6 点名族全绿可以声称；涉及「现有 DSH 相关测试」的任何总括表述必须带环境限定（对齐环境下方可称绿）。
7. 复跑留证纪律：对齐复跑证据与矩阵证据**并存**（`root-test.matrix-run-2026-11-14T2311.*` 原件 + R-4 再生 `root-test.json` + `root-test-pnpm10282.*` 三套），不得以复跑结果覆盖或替代原证据；矩阵 cell 状态保持 `fail`/exit 1。

## I-7. 后续票处理的明确边界（本票不承载）

| 项 | 边界 |
|---|---|
| 4 例 test-d 修复 | 另立票：断言改写（触碰 issue #421 公共句柄冻结面 pin，需确认期望语义）或 expect-type 工具链升级（G1′ 面）二选一或并行；修复后 root-test/CI lane 复绿 |
| Replication 三基线行为矩阵 + `apps/yjs-server` 行为验收 | 后续票（SA3 §8.2；本票仅编译面 + seam 语义 + B1 包门禁） |
| memory/file 注释仍写 `ctx.timeout`（G20 失实注释） | 后续票（AC7 byte-identical 冻结，本票不修） |
| ADR 0035 状态更新（仍「提议」） | 归实施收官票（SA6 §17.8；本票 G7 零 docs diff） |
| substitute-rc12 负控的通道级判红点 | 后续票可选加固：为 DSH build 目录补 `@deepseek-ai/cosmokit` 解析链接，使通道形状判红可达（当前由 provenance realpath 承载检出，义务已满足；I-1 注记） |
| `ws-replication-issue299-ac-red.test.ts` 未使用 helper | ALLOW 内死代码（cosmetic），后续票或 Controller add 前顺手删（非必修） |

## I-8. Verdict（iteration 2，取代 iteration 1）

**clear** —— iteration 1 reject 的两项依据均已闭合：(i) 四负控证据四枚齐备且由现行 runner 生成、形态与外层语义正确、SA3 笔记声称与磁盘一致（含 substitute-rc12 判红因更正成立；R5-7 与 C-R4d 机械证明义务履行）；(ii) BASE 等量复现与 packageManager 对齐复跑证据落盘并存、归因与结果逐项核实；(iii) 两处 ALLOW 内 tracked 改动未越界、未触冻结面/断言面、§8.6 命令与矩阵聚合语义持守、总 diff 面仍恰 6+11。交付条件重裁（I-5）：28 例环境红已按 §4.2(b)-1 闭合；4 例既有 test-d 红按 I-6 七条限定声明收口，**无需 owner 表态前置**（I-5.2 最小理由链；owner 表态欢迎但属交付授权而非冲突裁定）。实现面（seam/迁移/gates/冻结面）iteration 1 已全项 clear，本轮零新事实指向变化。

## I-9. requiresConflictRecheck（iteration 2）

**false** —— 无 pending 的决策面实现核对：无 evolution-required、无 override（I-5.2 明示「退回决策基准」非 override）、无公共 API/wire/schema/持久化/状态机/生命周期/失败语义待核对项；iteration 1 所列三项复查触发条件（负控证据闭合、对齐复跑并档、owner 表态合规）已分别由 I-1/I-3/I-5.2 闭合或消解。剩余义务为**叙述性**（I-6 交付声明、I-7 后续票边界），归 SA9/SA10/Controller 交付时执行，不构成冲突复查触发。
