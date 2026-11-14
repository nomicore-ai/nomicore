# SA4 实现评审（implementation-review）— issue #470：Cordis rc.12 双形态 Root tracer bullet 与工件验真

- Reviewed at：2026-11-14 23:30（+0800）；worktree `/home/wangjian/nomicore-fix-issue-470`，分支 `mabf/issue-470`，HEAD = BASE = `279dba4`，实现全部在工作树未提交（与 SA3 报告一致）。
- SA4 dispatch：`sa-d649e1ce-eed3-47c3-80fc-08ccb56dffc4`，iteration 0。
- 验证方式：逐行读 6 个修改文件 diff + 11 个新增文件全文；独立重跑只读验证命令（gates、单测、typecheck、ws-package cell、三个 fault 负控、acquire 缓存复核、pnpm shim 探针）；逐字节核对证据缓存（`.cache/cordis-baselines/evidence*`、red/green matrix 日志）。**未修改任何 src/test/fixture/配置/文档**。

## 1. Reviewed inputs

| 输入 | 使用方式 |
|---|---|
| `wiki/raw/task_issue-470_sa3_impl.md` | 全文（§3/§5/§6/§7/§8/§9/§10 逐项对照） |
| `wiki/raw/task_issue-470_design.md` | iteration 1 全文（§5/§6/§8/§11/§13/§14/§15/§16/§17/§18/§21） |
| `wiki/raw/task_issue-470_sa6_acceptance_contract.md` | §12.1–§12.5、§13.3、附录 A |
| `wiki/raw/task_issue-470_conflict_report.md` | 全文（R1–R9、O1–O7、§5 冻结面） |
| `wiki/raw/task_issue-470.md` | owner 原文（8 checkbox + L17 尾句；Comments 空） |
| `git diff`（6 修改）+ 11 新增文件 | 逐行读，不信自述 |
| `.cache/cordis-baselines/evidence*/**`、`red-matrix*.log`、`green-matrix.log`、`matrix/matrix.json` | 只读核对 + 关键命令独立重跑 |

---

## 2. Verdict

**approve**（无 BLOCKER / MAJOR 实现面 finding）。实现忠实执行已批准设计，测试具备真实证伪力，无掩蔽/空转/降级/越权。

**附强制性交付限定（SA9/SA10 交付叙述必须逐字遵守，见 §10 之后「交付限定」）**：`root-test` cell 为**红**（32 failures = 28 环境性 corepack/pnpm 版本错配 + 4 既有 `ws-replication-issue421-edge-factory-api.test-d.ts` 与 vitest 3.2.7 的 API 不兼容；两者均与本票 diff 无因果、本票 6 文件不在失败清单）。SA3 已如实上报、未 skip、未伪绿；按已批准设计 §8.6/§17「任一红 ⇒ 交付阻断」，该 cell 的最终放行属 Controller/SA10 裁决事项，交付叙述**不得声称「根 test 全绿」**。

---

## 3. 逐项结论（对应任务 1–9 问）

### 3.1 M1 — persistence seam（`packages/persistence/src/service.ts`）

| 检查点 | 结论 | 证据 |
|---|---|---|
| symbol 优先且存在时绝不读 legacy | ✅ | `service.ts:82-86`：`safeReadChannel(host, CORDIS_ROOT_SYMBOL)` 非 nullish 即 `return assertRootTimerShape(symbolRoot)`，legacy 读取（:87）仅在 symbol nullish 后发生 |
| try/catch 只包单次 `Reflect.get` | ✅ | `safeReadChannel`（:66-72）try 体仅 `return Reflect.get(host, key)`；`assertRootTimerShape`（:74-78）、host 级联、`throwRootTimerUnavailable` 全在 catch 之外（C-R4a） |
| 解析在 apply 期完成（非首次调度） | ✅ | `createCordisPersistenceScheduler`（:110-111）工厂体内 `tryResolveRootTimer(ctx) ?? throwRootTimerUnavailable()`；`memory.ts:239`/`file.ts:280` 在 `apply(ctx)` 内同步调用、先于 `instance.apply(ctx)`（service provision）——AC1(c)「service 仍 undefined」结构成立并被测试断言（`cordis-root-channel.test.ts:297,314,325,341,371,385`） |
| malformed 立即同步 throw、不回落 | ✅ | `assertRootTimerShape`：`timeout` 非 function → `throwRootTimerUnavailable()`（稳定单句）；不试另一通道/另一 host。红证据：base 上该用例 `<no throw>` 红（`evidence-base/B1/B1-root-probe.vitest.json`） |
| 双通道（含读取皆被拒）同步 throw | ✅ | `tryResolveRootTimer` 返回 undefined → `?? throwRootTimerUnavailable()`；读取抛错在 `safeReadChannel` 归一为缺席（C-R4b/B6 裁定），D10 用例断言文案稳定且不含 proxy 噪声（`cordis-root-channel.test.ts:331-345`） |
| 宿主非对象守卫（F5） | ✅ | `service.ts:80`：`host === null || typeof host !== 'object'` → throw（首行，先于 Reflect.get，不被 safeGet 归一） |
| 零 ambient timer | ✅ | 无 `setTimeout(`/`globalThis`；`module-graph-regression.test.ts:129-166` 静态守卫绿（root-test 4/4）；G8 零命中 |
| 捕获对象 + 方法调用（无 detach） | ✅ | :111 `const rootTimer = …`（对象引用）；:117 `setTimeout: (callback, delayMs) => rootTimer.timeout(callback, delayMs)`——方法调用形态；全文无 `const t = rootTimer.timeout` detach 形态；doc comment 明文 ❌ detach + C15 理由（:100-104） |
| 新文案单句稳定、不误匹配既有 regex | ✅ | `ROOT_TIMER_UNAVAILABLE`（:47-49）与设计 §5.2 逐字节一致；全仓无既有断言被误匹配（grep「root timer context」仅 seam 两文件 + 新测试；既有 `/required Cordis service "timer" is unavailable/` 不含 "root timer context"）；`core-dsh-boundary.test.ts` 6/6 绿（root-test 证据） |
| `assertPersistenceHostDependencies` 零改动 | ✅ | :26-35 与 BASE 逐字节相同（diff 无该 hunk；仍只查 clock/timer service） |
| cast 局限 leaf | ✅ | 仅 `assertRootTimerShape` 内两处窄 cast（:75-77）+ 既有 `(handle as () => void)`；无 ts-ignore/ts-expect-error |
| 文档注释同步 | ✅ | 模块头 :15、:95-107、:144 注释随实现更新（含禁 detach 理由），无失实残留新增 |

### 3.2 M2 — ws-replication seam（`packages/ws-replication/src/plugin.ts`）

| 检查点 | 结论 | 证据 |
|---|---|---|
| 同规私有解析（symbol 优先/malformed 不回落/F5/窄 catch） | ✅ | `plugin.ts:206-249`（`CORDIS_ROOT_SYMBOL`/`throwRootTimerUnavailable`/`safeReadChannel`/`assertRootTimerShape`/`tryResolveRootTimer`，与 persistence 同构） |
| host 级联 `timer.ctx → ctx` | ✅ | `plugin.ts:262-264`：`(timer.ctx !== undefined ? tryResolveRootTimer(timer.ctx) : undefined) ?? tryResolveRootTimer(ctx) ?? throwRootTimerUnavailable()`；级联仅发生在「整 host 双通道皆缺席（含归一）」 |
| B1/B2 与旧 `timer.ctx?.root ?? ctx.root` 逐 case 等价 | ✅（三处设计裁定的收紧除外，均不可达于 B1/B2 真实形态） | 逐 case 推演：① `timer.ctx` 存在且 legacy root 非 nullish → 旧取 `timer.ctx.root`，新经 symbol（npm 上缺席）→ legacy 同值；② `timer.ctx.root` nullish → 旧 `?? ctx.root`，新归一为缺席后级联 `ctx` 同值；③ `timer.ctx === undefined` → 两边都级联；④ `timer.ctx.root` malformed → 旧最终形状检查 throw 同文案，新 `assertRootTimerShape` throw 同文案。收紧点（均为设计明文裁定，B1/B2 不可达）：`timer.ctx === null` 旧静默级联 → 新 F5 throw（§5.1 F5 注记）；legacy 读取抛错旧透传噪声 → 新归一级联（C-R4b）；「symbol malformed + legacy 可读」旧可能用 legacy → 新不跨通道回落（malformed 不回落纪律） |
| timer service 缺失文案逐字节不变 | ✅ | `plugin.ts:258-260` `'required Cordis service "timer" is unavailable'` 与 BASE 相同 |
| Root 文案逐字节不变 | ✅ | `plugin.ts:219` `'required Cordis root timer context is unavailable'` 单句无后缀，与 BASE :216 相同（两条既有文案零漂移） |
| `OwnedTimer` 与服务冻结面未触碰 | ✅ | diff 仅 `root` → `rootTimer` 局部改名 + 方法调用（:281-284）；`clearTimeout`/`dispose`（:288-296）、`OwnedTimer` 接口、两服务构造体、`src/index.ts`（G4 零 diff）全部未动；调用点 `:513/:708` apply 期语义不变 |

### 3.3 M3–M6 — 四 fixture 迁移（恰好 10 处读取）

- **改动面精确**：`ws-replication-plugin.test.ts`（:27-33 探测分支删除 + :51 `effectTimer` 改 helper）、`issue299`（:173-180 分支删除）、`issue422`（:50 helper + :89-93 分支删除）、`guard-proxy`（:107-111 仅 `dependencies()` 改写）。旧 10 处 `ctx.root` 读取（plugin 3 / 299 2 / 422 3 / guard 2）全部消失，全 ws-replication/test 无残留 Cordis `ctx.root` 读取（grep 验证；harness `ctx.rootValue`/`ctx.root('hub',…)` 零触碰）。
- **内联 helper 与生产优先级一致**：`resolveRootForTest` = `Reflect.get(ctx, Symbol.for('cordis.root')) ?? Reflect.get(ctx, 'root')`（与 seam 同序）；统一 shim `{ timeout, ctx: { [Symbol.for('cordis.root')]: { timeout } } }` 在任何基线上命中同一 fake root（symbol 优先 ⇒ 探测分支可删；与设计 §6 论证一致）。
- **断言面零弱化**：guard-proxy 的 guard-Proxy 断言（冻结/defineProperty 拒绝/包装不变量）原样保留（diff 仅 dependencies() + helper 插入）；`ws-package` B1 cell 实跑 66/66（**SA4 独立重跑 `--baseline B1 --suite ws-package` exit 0, 66/66**），root-test 默认布局同文件全绿（guard-proxy 2/2 + 4/4、issue299 7/7、issue422 42/42、plugin 15/15）。
- 无 skip/`.only`/删断言/恒真改写（grep 零命中）。

### 3.4 N1–N4 — 新测试证伪力（逐 AC）

| AC | 结论 | 关键证据 |
|---|---|---|
| AC1（N1 `cordis-root-channel.test.ts`，12 用例） | ✅ 真能判真假 | (a) sentinel 用**通道身份计数**断言：`symbolTimer.armCount > 0` ∧ `legacyTimer.armCount === 0` ∧ `controlled.reads.legacy === 0`（:255-257，Proxy get-trap 计数，非「至少命中一个」弱断言）；(c) malformed symbol：`apply` 同步 throw + **`ctx.get(NOMICORE_PERSISTENCE_SERVICE)` 仍 undefined**（:297）+ legacy 零读取 + `vi.spyOn(globalThis,'setTimeout')` 零调用；(d) 双缺席 throw（:320-329）；(e) timer service 缺失/形状不符 → 既有文案两例（:367-389）；D10 双拒（:331-345）+ D11 read-throw 归一 pin（:347-365，断言不 throw、arm legacy、零泄漏——若实现把 read-throw 做成硬失败/异常泄漏该 pin 必红）；ambient 检出真实：sentinel 用例在 capability 静默时等 8×debounce 断言零写（:406-407），ambient 兜底会使 flush 发生 ⇒ 红 |
| AC2（N2 `cordis-root-real-timer.test.ts`，10 用例） | ✅ | 三基线 × {memory,file} × {flush,retry,drain,dispose,service-revoke} 全存在；真实 `TimerService`（meter 在 `beforeAll` patch `TimerService.prototype.timeout`，**先于任何构造/provide**，F8）；flush/retry 断言 `meter.arms > 0`；dispose 后 `meter.pending === 0`（arm/自然到期/显式 disposer 三路归零）；drain 后超 debounce 零新增写；retry：memory 注入前 2 次写失败、file 用「snapshot 路径预置目录」确定性 rename 失败 → `persistence-degraded` → 恢复 → 最新 generation；**service-revoke 断言真实存在**（:348-372, :456-479：fiber dispose 后 service undefined、adapter disposed、`unhandledRejection` 收集器零事件）；全部 deadline 5s 谓词轮询（禁固定轮数）；runner 侧 3 连跑（`repeatRuns` 落证） |
| AC4/AC5（N3 `cordis-baseline-provenance.test.ts`） | ✅ | 双位置 realpath（test 模块 + `src/service.ts` 目录）逐包相等 ∧ overlay 包含 ∧ 版本钉值；cosmokit 按声明者位置（cordis/timer 各一）传递绑定；workspace 内声明 `@deepseek-ai/cordis` realpath 集合恰 1；integrity 钉值防下调（与 SA6 附录 A 参照值硬编码比对）；B3-only suite：commit 钉死 + porcelain 空 + `ls-tree` 全表 vs `provenance-b3.json` + 4 个交叉锚 + 配方/诚实标注 + **从安装 overlay 重算 libTree/libIndex/typesIndex 哈希**比对 |
| AC7（N4 `cordis-public-surface.test.ts`） | ✅ 能检出新增导出 | 4 entry（persistence、/testing、dsh、ws-replication）`Object.keys(module).sort()` 与快照严格相等（新导出/删导出均红）；「快照覆盖 4 entry」自检用例；G5 机械半边在 gates（BASE worktree 捕获 vs 快照）——双闭合。SA4 独立重跑通过（4 文件 31 tests 全绿 + gates G5 PASS） |
| AC9 | ✅ | 默认 options（真实 TimerService、无 root/channel 参数）boot+saveDoc+flush（:419-438）；G8 机械扫零命中 |

**红灯矩阵真实性（任务 5/§14 纪律）**：`evidence-base/**` 的失败栈含 `/home/wangjian/nomicore-fix-issue-470/.worktrees/red-matrix/.cache/...`——**硬证明红灯确在 detached BASE worktree（seam 未实现）内以同一 runner 取得**；红因逐条匹配设计目标列（D1 `expected 0 to be greater than 0`、D2/D3/D10 `expected '<no throw>' to be 'required Cordis root timer context is…'`、D4 real-timer B3 0/10、D5 R5P 红、D6 dsh-profile 8/12、D7 typecheck 7 project 红）；每 cell `filesPresent: true`，无 missing-file 红。设计 D9 行预测「sentinel base 即绿」与实际不符（sentinel 在 symbol-only 形态下 base 红）——**实际红集是设计预测的严格超集，方向为更强非更弱**，SA3 已如实记录红因。

### 3.5 N5–N11 — 设施是否真在测基线（不止 exit code）

- **acquire**：`ensureTarball` cache 命中仍重算 sha512 与钉值比对（:143-154），不符 exit 2（**SA4 重跑 `--baseline B1` exit 0 走 cache 复核路径**）；B3 每次 acquire 重跑 sparse-checkout/checkout/rev-parse/porcelain/ls-tree 全表 + **重建三包**并比对输出哈希（:386-444，无「信任缓存」路径）。
- **B3 provenance 8 项**：① commit/porcelain（clone 现存 HEAD=1511a6e…，porcelain 空——SA4 直查）；② ls-tree 全表——**SA4 独立执行 `git ls-tree -r <sha>` 得 32 blob，与 `provenance-b3.json` 逐文件哈希全等**（含 4 个 SA6 附录 A 锚：context.ts/utils.ts/timer index.ts/cosmokit types.ts）；③ 配方（toolchain + perPackage rootDir/outDir/declarationDir/rewrite/paths）；④ 输出哈希（overlay 重算比对，负控下实测 mismatch 红）；⑤ 双位置 realpath（evidence `resolvedRealpaths` 全在 overlay 内）；⑥ probe（B3 log：`rootCtxSymbol=root-context`、`rootCtxLegacy=absent`、`contextRootStatic=symbol`、fiber legacy `throws:cannot get property "root" without inject`——与 SA6 §12.3 逐项一致）；⑦ 四负控（下）；⑧ 诚实标注（`NOT the official DSH`，测试 `toContain` 断言）。
- **临时 workspace 物化**：`copyTrackedTree`（`git ls-files`）∪ `NEW_FILES`（11 条逐条 existsSync 预检，缺失 exit 2 + 清单）均按**工作树内容**复制（run-baseline.mjs:173-199）——F3 落实；红灯每 cell `filesPresent: true` 落证。
- **symlink farm/C13**：workspace 根 node_modules 实查仅 `tsx/@types/typescript/vitest`，**无任何 `@nomicore/*`**；`@nomicore/*` → ws 兄弟包、`@deepseek-ai/*` → overlay、其余 → 主仓 realpath；`core-dsh-boundary` 反向守卫在 ws contract suite（242/242）与 root-test 双绿——无假红/假绿。
- **`--mode typecheck`**：project 清单从根 `package.json` `scripts.typecheck` 动态解析（run-baseline.mjs:636-641），**15 project** 与 package.json 逐项一致（SA4 比对）；逐 project 日志；B3 红时恰 7 project 红含 ws-replication——敏感性实证；G9 机械封锁 tsconfig/vitest 载体零 diff（无 skip/skipLibCheck/cast 掩蔽路径）。
- **四负控「外层 exit 0 ⟺ 内层红」**：`runFault` 内层 `cells.some(status==='fail')` → observed/code/status，observed='pass' 时外层 exit 1（run-baseline.mjs:727-757）；内层用例为真实断言红（非 skip）：**SA4 独立重跑三条**——fallback（realpath 落 `node_modules/.pnpm/@deepseek-ai+cordis@4.0.1/…` + libTree hash drift）、substitute-npm（cordis realpath 落 overlay/B2 npm 4.1.0 + hash drift，同名同版本仍判红）、substitute-rc12（realpath 落 `dsh/build/cordis`）——三者均 `observed=fail, code=1, 外层 exit 0`；legacy-shim（F9 同一受控 ctx：`Object.defineProperty(ctx,'root',…)` 后断言 B3 legacy absent → 红）证据在库。
- ⚠ 证据留痕缺口（MINOR，见 §12-O1）：`evidence/B3/fault-fallback.json`、`evidence/B3/fault-substitute-npm.json`、`evidence/B2/fault-substitute-rc12.json` 三份在评审时**不在盘**（仅 `fault-legacy-shim` 留存；三条 fault workspace 及其污染链接在盘，run-baseline.mjs mtime 23:02 晚于三条 workspace 23:01:44-49，疑首次运行早于 runner 定稿、证据未持久化）。SA3 §6.1 引用的观测消息与 SA4 重跑输出逐字吻合（runs 真实发生过）；且设计 §17 本就将 `.cache` 证据列为不提交、以命令重跑为复核口径。**SA4 重跑已再生三份证据（时间戳 2026-11-14 23:28-23:29）**，交付链应以重跑为准。

### 3.6 G1′–G9 gates 是否真执法

**SA4 独立重跑 `node gates.mjs` → exit 0，9/9 PASS**。要点：

- **比较方向（D-a 偏差成立且更强）**：`git diff --name-only <BASE> -- <pathspec>`（工作树 vs BASE）∪ `git ls-files --others --exclude-standard`——本 worktree HEAD==BASE 时 `$BASE..HEAD` 恒空会假绿，工作树比较是严格超集且把 untracked 新文件纳入；零 diff 义务一项不减。Controller 提交后该比较仍然成立（working tree == 含改动 HEAD，diff vs BASE 非空进 allowlist 判定）。
- G1′：19 pathspec（lock + 根 manifest + packages/apps/domains 全部 package.json + artifacts）零 diff；G2 `changed=[service.ts] ⊆ allowlist`；G3 `changed=[plugin.ts + 4 具名 fixture] ⊆ allowlist`；G4 两 index.ts 零 diff；G6 `diff --check` 干净 + artifacts porcelain 空；G7 docs/（含 adr）零 diff；G8 三生产 src 树零命中（SA4 独立 grep 复核）；G9 19 条 tsconfig/vitest pathspec 零 diff（动态枚举含各包 tsconfig.build.json/vitest.config.ts，超设计 pathspec）。
- **G5 快照 capture**：五步齐备——`worktree list --porcelain` 预检（陈旧即 exit 2 给清理指引）→ `worktree add --detach .worktrees/base-snapshot 279dba4` → 声明驱动 farm（`@nomicore/*`→base 兄弟包；`@deepseek-ai/*`/外部依赖→主仓 realpath；base worktree 无 node_modules 的 A-2 缺口由此闭合）→ tsx + `--conditions=nomicore-source` 逐 entry `Object.keys().sort()` 捕获 vs tracked 快照严格比较 → **finally** `worktree remove --force`。SA4 重跑后 `git worktree list` 无残留（`.worktrees/` 仅余空目录，已被 .gitignore 覆盖）。双闭合：BASE 捕获=快照（快照真伪）+ 当前树 runtime 测试=快照（不漂移）。
- **绕过路径排查**：tracked 文件的修改/删除必入 `git diff <BASE>`（ignore 文件无法隐藏 tracked diff）；untracked 新文件经 `--others --exclude-standard` 捕获（新测试/fixture 均未被 ignore）；唯一未被任何 gate pathspec 覆盖的新增面是 `packages/persistence/test/**`（G2 只盖 src 树，设计即如此）——SA4 实查该目录新增恰为 4 个 `.test.ts`，与 §11.1 一致，无夹带（见 §12-O3）。

### 3.7 `root-test` 红 cell 归因（独立核对）

- **32 failures 分布**（SA4 解析 `root-test.vitest.json`）：`dsh-probe-cli` 6 + `dsh-file-probe-determinism` 1 + `vfsl/schema-check-cli` 6 + `vfsl-codegen/generate-*` 5 文件 15 = **28**（全部 spawn `pnpm …` 子进程）+ `ws-replication-issue421-edge-factory-api.test-d.ts` **4**。失败文件与本票 6 修改文件、4 迁移 fixture、4 新测试**零交集**；本票相关文件在 root-test 中全绿（channel 12/12、real-timer 10/10、provenance 4/4、public-surface 5/5、plugin 15/15、issue299 7/7、issue422 42/42、guard-proxy 2/2、core-dsh-boundary 6/6、module-graph 4/4、R5P 6/6、dsh-profile 12/12）。
- **28 = 环境性**：`pnpm --version` 实测输出 corepack 错误（项目声明 `pnpm@10.28.2`，当前 corepack 11.28.5 不切换版本）；matrix.json root-test `diagnostics.pnpmProbe` 已诚实记录。**SA4 复验**：把 `.cache/pnpm-shim/pnpm`（`exec corepack pnpm@10.28.2`）置 PATH 首部后，`schema-check-cli` + `dsh-probe-cli` 两文件 13/13 全绿——环境归因成立，修复无需任何仓库改动。
- **4 = 既有 test-d 不兼容**：**SA4 在当前树独立重跑该文件 → 4 failed（`Expected 1 arguments, but got 0`，`expectTypeOf(...).parameters` 与 vitest 3.2.7 的 API 不匹配）**；文件本票零改动、不在 ALLOW。SA3 声称的 BASE 复现与此一致（文件内容与依赖均未变，失败与 worktree 状态无关）。
- **义务判断**：AGENTS「根 test」与设计 §8.6 root-test cell 的字面义务（全绿）在当前环境不可满足，但红因 100% 先在且与本票无因果；SA3 未修 ALLOW 外文件、未 skip、未降级、未伪绿，并提供了可操作的补救路径。这不是实现缺陷，而是**交付条件问题**：按已批准设计的失败语义（任一红 ⇒ 交付阻断、绿不抵红），是否放行属 Controller/SA10 裁决。**实现面结论：可交付（条件见下）**；交付叙述必须按 §10 限定书写。

### 3.8 过度/越权改动（任务 8 问）

- `git status --porcelain -uall` 全量核对：改动**恰好** = 6 修改 + 11 新增，与 §11.1/§17 清单逐路径一致；无第三处生产读取、无ALLOW 外文件、无 `.gitignore`/manifest/lock/artifacts/docs/tsconfig/vitest 改动（G1′/G7/G9 机械证明 + SA4 复跑）。
- 无 marker 文件（无 REPORT.md/.mabf-done）；`.cache/**`、`.worktrees/**` 均为既有 ignore 覆盖；`wiki/raw/**` 为 Host 既有工件。
- 无 skip/`.only`/`todo`/`--passWithNoTests` 滥用（runner 统一注入 `--passWithNoTests=false` 并逐文件 existsSync 预检；root-test cell 保持根 script 等价命令不覆写——该 cell 全量跑不存在空路径风险）。
- 无 ts-ignore/ts-expect-error/`any` 扩散；cast 只在两 seam 叶子。
- 生产 src 零 env/flag 分支（G8 + AC9 行为判据）。

---

## 4. 上游要求落实（R1–R9 / AC 账本摘要）

| Requirement | Implementation evidence | Assessment |
|---|---|---|
| R1 严格 AC6（15 project × 3） | typecheck cell 动态解析根 script，B1/B2/B3 15/15 绿（evidence + project 日志）；无子集/skip/cast 掩蔽；G9 封锁配置面 | ✅ |
| R2 迁移面封闭 | 恰好 service.ts/plugin.ts + 4 fixture；harness helper 零触碰（grep 验证）；G2/G3 allowlist 执法 | ✅ |
| R3 ws 角色边界 | 无 Replication 行为 cell/宣称；ws-package(B1) + 15-project typecheck + root-test 三载体；`ws-package` 66/66（SA4 重跑） | ✅（root-test 红见 §3.7） |
| R4 seam 决策形态 | §3.1/§3.2 逐点核（含 C-R4a–d、F5、B6、禁 detach、无 ambient） | ✅ |
| R5 provenance 8 项 | §3.5（commit/ls-tree 全表/配方/输出哈希/双位置/probe/负控/诚实标注） | ✅ |
| R6 AC 账本 | 8 checkbox + AC9 derived 引 L17；无第 9 条 checklist 宣称 | ✅ |
| R7 机械 gate | G1′/G2/G3/G4/G5/G9 全数落地并独立重跑通过 | ✅ |
| R8 冻结面 | guard-Proxy 断言面原样 + B1 必绿锚点（ws-package cell 实跑）；服务构造/公共工厂/index 零触碰 | ✅ |
| R9 | 无升级项触发 | ✅ |

---

## 5. 设计偏差核对（SA3 §3.3 D-a–D-g）

| 偏差 | SA4 裁定 |
|---|---|
| D-a gates 用工作树 vs BASE + untracked | 语义严格超集，成立（§3.6） |
| D-b `--repeat 3` = 3 次顺序 vitest（任一红即红，`everyRepeatGreen` 要求 total>0） | 与「每基线 ≥3 次、任一失败即失败」等价，成立 |
| D-c root-probe 独立 .mjs + `--resolve-from <ws>/packages/persistence` | 探针只 import baseline Context/TimerService、观测点即被测解析位置；成立 |
| D-d 测试侧 env 前缀 `NOMICORE_CORDIS_*` | 仅测试代码读取；G8 机械证明生产零 env | 成立 |
| D-e G5 双闭合 | 比单侧更强，成立 |
| D-f contract glob 动态收集、新文件双跑 | A-1 口径明文允许；幂等无害，成立 |
| D-g root-test 红如实上报 | 见 §3.7；不构成掩蔽 |

---

## 6. 架构一致性 / 责任归属 / 生命周期

- **责任归属**：root 解析收口在两包既有 Cordis 接线叶子（service.ts / plugin.ts `timerFromContext`），无新文件/新节点；root 校验未塞入 `assertPersistenceHostDependencies`（adapter 直连路径不读 root，C6 语义保住）。
- **相似能力对照**：两包 ~50 行同规私有实现为 ADR 0035 §2 明文要求的「各自保留一个包内私有 seam」，非 DRY 缺陷；无平行机制（无第二 cleanup/retry/状态面；`safeReadChannel`/`assertRootTimerShape` 各包私有不共享）。
- **生命周期对称**：apply 期解析 + 捕获对象引用；`rootTimer.timeout` 方法调用保持 `this` 绑定（C15）；disposer 面/`clearTimers`/R5P 排空窗口零变化（R5P 三基线绿；B3 从红转绿为可观察证明）；host 先装 timer 后停 persistence 的接线契约注释语义保留（service.ts:11-17 更新为 `rootTimer.timeout` 措辞，语义不变）。
- **单一事实源**：typecheck project 清单唯一源自根 package.json；基线钉值唯一源自 tracked baselines.json/provenance-b3.json（无第二份）；probe 不 import 生产 seam。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk |
|---|---|---|---|
| `createCordisPersistenceScheduler` 新增 apply 期 throw | memory/file 工厂 apply、dsh profile（间接） | throw 先于 service provision（AC1(c) 断言面）；旧「timer 在而 root 缺席」宿主从延迟噪声变 apply 稳定 throw——contract 242/242 + root-test 全绿证明无既有 caller 被破坏 | 低 |
| ws `timerFromContext` 失败时点不变（apply 期） | hub `:513`/peer `:708` | 时点/文案零漂移；唯一新结局为设计裁定的三类收紧（§3.2），B1/B2 不可达 | 低 |
| `PersistenceScheduler` 接口零变化 | lifecycle.ts 调度面 | 零改动 | 无 |

## 8. 错误、恢复与并发

- 失败语义：单句稳定 `Error`，四类 root 失败共用同一文案（缺席/形状不符/宿主非对象/双拒归一），与既有 timer service 文案判据泾渭分明；无吞错（catch 唯一动作=通道缺席，C-R4c：出口仅「已验证 rootTimer」或「稳定 throw」）。
- acquire/materialize 全链路响亮 exit 2 + stage 标注；无降级工件、无「以仓库默认件顶替」路径（负控 fallback 实测红）。
- 竞态：解析在 apply 同步段（无线程交互）；meter 三路归零使「dispose 后 pending=0」为诚实计数。

---

## 9. 测试质量审查（汇总）

| Test | 行为断言 | Runner 入口 | 弱化/缺口 |
|---|---|---|---|
| N1 channel 12 | 通道身份/读取计数/apply 同步 throw/service undefined/ambient spy | vitest 全局 include（`packages/*/test/**/*.test.ts`）+ runner root-probe/contract/ws? + root-test | 无（见 §3.4） |
| N2 real-timer 10 | arm/pending/degraded/drain/dispose/revoke/unhandled | 同上 + runner real-timer ×3 | 无 |
| N3 provenance 4(+4 B3) | 身份/哈希/全表 | 同上 + runner provenance | 无 |
| N4 public-surface 5 | 导出名集合快照 | 同上 + gates G5 | 无 |
| M3–M6 迁移 fixture | 原断言面 | ws-package cell + root-test | 无 |

## 10. Required revisions

无 BLOCKER/MAJOR。**交付限定（SA9/SA10 必须遵守，违反即失实交付）**：

1. `root-test` cell 只能表述为**红**：「32 failed（28 = 环境性 corepack/pnpm 10.28.2 vs 11.28.5 错配，置于 PATH 的 `corepack pnpm@10.28.2` shim 下转绿，SA4 已抽样复证；4 = 既有 `ws-replication-issue421-edge-factory-api.test-d.ts` 与 vitest 3.2.7 `expectTypeOf` API 不兼容，本票零改动、SA4 已在当前树复现）」。**不得写「根 test 全绿」「根 test 通过」**；本票相关文件在默认布局全绿可如实表述。
2. 负控证据口径：`fault-fallback`/`fault-substitute-npm`/`fault-substitute-rc12` 三份 evidence 为 SA4 于 2026-11-14 23:28–23:29 重跑再生（原报告 §6.1 所引三份在交付时点不在盘）；SA10 复核以现场重跑为准。
3. 若 Controller 要求 root-test 全绿再放行：环境侧用仓库声明 pnpm 重跑（预期仅剩 4 例既有 test-d 红，需另开票修 `test-d.ts`，超出本票 ALLOW，不得在本票内顺手修）。

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| 非 POSIX 平台 file retry | runner real-timer @ file | 目录占位使 rename 确定性失败 → degraded → 恢复 | cell 红（不 skip，evidence 记平台）——按设计 §18 I3 |
| Controller 提交后 gates 复跑 | `node gates.mjs`（提交后） | 9/9（allowlist 判定与 G5 双闭合不依赖未提交状态） | 任一 gate 红 |
| root-test 环境修复后全量 | `--suite root-test`（PATH 含 pinned pnpm） | 仅剩 4 例 test-d 红 | 出现第 33 例起的新红 |
| B3 网络重建 | `acquire.mjs --baseline B3`（清 cache 后） | 重建输出哈希与 provenance 全等 | 任一 hash/ls-tree 不符 exit 2 |

## 12. Non-blocking observations（MINOR）

- **O1（负控证据留痕）**：三份 fault evidence 交付时缺失（详见 §3.5 末段）；runs 真实（污染 workspace 在盘、引用消息与重跑逐字吻合），且 `.cache` 证据本就不提交、以重跑为口径。建议 SA3 今后在 runner 定稿后统一重跑负控再落报告。
- **O2（runner 命令白名单字面偏差）**：root-test cell 的 `pnpm --version` 诊断探针超出设计 §18 I4「只调 node/tsc/vitest/git/registry GET」的字面白名单；只读、不入 gate、结果仅落 diagnostics。建议后续票把诊断探针从白名单表述中豁免或移除。
- **O3（gate 覆盖缝隙，设计即如此）**：`packages/persistence/test/**` 新增文件不被任何 gate pathspec 覆盖（G2 只盖 src）。本次实查无夹带；如后续票扩大 persistence 测试面，建议 G2 或新增 gate 覆盖。
- **O4（死代码/死路径）**：`resolveRootForTest` 在 guard-proxy 与 issue299 两文件定义未使用（该两文件 10 处读取全在 dependencies 分支）；`--suite gates` 被 arg parser 接受但 `runSuite` 不支持（恒 exit 2 死路径）。无行为影响（noUnusedLocals 未开启）。
- **O5（probe 观测项未断言）**：`root-probe.mjs` 记录 `fiberSymbol` 但无期望键（仅观测）。SA6 §12.3 未要求；可后续补。
- **O6（设计 D9 行预测与实现差异）**：sentinel 用例在 base 为红（symbol-only 形态），非设计 D9 预测的「base 即绿」——红集更强，SA3 已如实记录；设计文本无需回改。
- **O7（G20 失实注释残余）**：memory.ts:26/file.ts:34 注释仍写 `ctx.timeout`——设计 §18 明示留待后续文档票（AC7 byte-identical 冻结），非遗漏。

---

## 13. 复核命令（SA10 可重复）

```
node packages/persistence/test/fixtures/cordis-baselines/gates.mjs                 # 9/9（SA4 重跑 exit 0）
node …/run-baseline.mjs --baseline B1 --suite ws-package                            # 66/66（SA4 重跑 exit 0）
node …/run-baseline.mjs --baseline B3 --fault fallback --suite provenance --suite root-probe       # observed=fail, outer 0
node …/run-baseline.mjs --baseline B3 --fault substitute-npm --suite provenance --suite root-probe # observed=fail, outer 0
node …/run-baseline.mjs --baseline B2 --fault substitute-rc12 --suite provenance --suite root-probe# observed=fail, outer 0
NODE_OPTIONS=--conditions=nomicore-source node node_modules/vitest/vitest.mjs run packages/persistence/test/cordis-*.test.ts  # 31/31
node node_modules/typescript/bin/tsc -p packages/persistence/tsconfig.json && node node_modules/typescript/bin/tsc -p packages/ws-replication/tsconfig.json  # 均 0
PATH=$PWD/.cache/pnpm-shim:$PATH … vitest run packages/vfsl/test/schema-check-cli.test.ts packages/dsh-persistence/test/dsh-probe-cli.test.ts  # 13/13（环境归因）
```
