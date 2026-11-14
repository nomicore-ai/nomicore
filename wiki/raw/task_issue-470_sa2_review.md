# SA2 设计攻击评审 — issue #470：Cordis rc.12 双形态 Root tracer bullet 与工件验真

- 被评审对象：`wiki/raw/task_issue-470_design.md`（**iteration 1 定向修订稿，684 行**）
- 评审基线：HEAD `279dba4ac81b7c7520e3d0b87b5c4d621a86a517`（worktree `mabf/issue-470`）
- 评审者：SA2（独立攻击评审；不修改设计/代码/测试）
- 本轮性质：**iteration 1 定向核销复审**——逐条核销本评审 iteration 0 的 F1/F2/F3（MAJOR）与 F4–F10（非阻塞）+ SA8 设计后复查 RA-1/RA-2 是否真关闭（以修订稿文本与仓库事实为准，不信自述），并审查修订是否引入新的不一致或越权。不重做全套架构评审。

---

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-470_design.md`（iteration 1，684 行） | 全文；重点 §1/§2 C15/C16/§5.1（捕获形态纪律、safeGet 判据与裁定、C-R4a–d 映射、F5 守卫）/§8.4（物化并集 + 解析通道分析）/§8.6（`ws-package`/`root-test`）/§8.8/§13/§14（红灯证据纪律）/§15 G1′/G9/§16/§17/§20/§21 |
| `wiki/raw/task_issue-470_sa2_review.md`（本评审 iteration 0） | 全文（§13 F1–F3 acceptance 列、§14 F4–F10） |
| `wiki/raw/task_issue-470_design_conflict_report.md`（SA8 设计后复查） | 全文（RA-1①②③/RA-2、§3 C-R4a–d 绑定约束、A-1–A-5、§12 reject） |
| 仓库事实（本会话独立复核，非转信设计文本） | `service.ts:1–60`（惰性 `ctx.root.timeout`、`assertPersistenceHostDependencies` 只查 timer service、:11–17 宿主接线契约注释）；`plugin.ts:200–249`（`timerFromContext` 现状 = `timer.ctx?.root ?? ctx.root` + `OwnedTimer` 持 `root` 对象引用并以 `root.timeout(...)` 方法调用武装）；timer 1.1.3 `lib/index.js` `timeout(...args)` callback 分支首行 `this.ctx.effect(...)`（C15 属实）；4 个具名 fixture 存在且探测分支行号 = :24–25/:41、:173/:177、:44/:83–84、:101–102（与 C8 一致）；全仓 `grep "ctx: null"` src/test **零命中**（F5 可达性论证成立）；根 `package.json` `scripts.test` = `NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`、`scripts.typecheck` 恰 15 project；`vitest.config.ts` include `packages/*/test/**/*.test.ts` + `passWithNoTests: true` + alias 全套；`tsconfig.base.json` `customConditions: ["nomicore-source"]`；`persistence/tsconfig.json` include `src/**`+`test/**`（fixture `.mjs` 不入面）；persistence test 现有 19 `.test.ts` + 2 `.test-d.ts`（A-1 口径正确）；`.gitignore` 含 `node_modules/`/`.cache/`/`*.tsbuildinfo`；`git ls-files '*package.json'` = 根 + 14 packages + apps/yjs-server + domains/vfs3-assets，全部落在 G1′ 三 glob 内；本 worktree 根 `node_modules` 有 tsx/typescript/vitest（root-test 可执行） |

---

## 2. Verdict

**approve（0 × BLOCKER，0 × MAJOR；3 × MINOR 非阻塞）**。

iteration 0 的三项 MAJOR（F1 文/码矛盾、F2 B1 门禁无运行承载、F3 物化清单漏未 tracked 新文件）**全部真实关闭**，核销证据见 §3；F4–F10 非阻塞项逐条落地；SA8 RA-1①②③/RA-2/A-1–A-5/C-R4a–d 全部落实或转为显式实现期 OPEN 约束。修订新增面（`ws-package`/`root-test` cell、G9/G1′、NEW_FILES 常量、§21 OPEN 清单）与既有设计自洽，未发现越权或新的阻断性不一致；仅余 3 条 MINOR（§12 N-1/N-2/N-3，均为计数/措辞级，不影响安全实施与验收判真）。

`requiresConflictRecheck: false`（相对本评审已知面）——本轮未发现 ADR 治理决策面上的**新**风险：F4 的 safeGet 失败语义面已被 SA8 §3 特别裁定（C-R4a–d）收编且修订稿裁定与之一致；G9/G1′ 新执法面、ws-replication diff 面均已由设计 §21(a)–(c) 申报为实现后复查，SA8 §13(i) 对 RA-1/RA-2 修订稿的复审亦在流程内。SA10/SA7 仍须按 §21 OPEN 清单在实现期核销（见 §13 纪律）。

---

## 3. iteration 1 复审——逐条核销表

### 3.1 MAJOR 项核销

| Finding | 结论 | 证据（修订稿位置 + 本会话仓库核对） |
|---|---|---|
| **F1**（捕获形态文/码矛盾） | **已关闭** | (i) 全文 grep「捕获」：L123–127（捕获形态纪律节）、L153–157（persistence 骨架注释，含 ✅ `rootTimer.timeout(callback, delayMs)` / ❌ detach 示例 + C15 理由）、L163–164、L263（§7 行）、L417（§9 数据流行）、L431（§10 并发节）——**全部且仅指「对象引用 + 方法调用形态武装」**，iteration 0 的 L121/L374「捕获 `rootTimer.timeout`」措辞已不存在；「detach」仅出现于禁止性语境（C15 事实、纪律节、骨架 ❌ 注释）与无关的 git `--detach`（L291/L313）。(ii) detach 理由明文：`TimerService.timeout` 实现体首行 `this.ctx.effect(...)`——本会话重读 timer 1.1.3 `lib/index.js` 属实（callback 分支 `const dispose = this.ctx.effect(...)`）。(iii) §5.1 骨架 / §7 / §9 / §10 四处一致（grep 逐行核对）。(iv) C16 属实：现状 `OwnedTimer` 即持 `root` 对象引用并以 `root.timeout(callback, delayMs)` 方法调用武装（`plugin.ts:220–228` 本会话复读），ws-replication 骨架注释 L178–183 同规。核销面剩余部分（实现期 code review 两处 seam 方法调用形态 + real-timer 三基线绿）已正确列入 §21 OPEN 5 |
| **F2 + RA-1**（B1 包门禁无运行承载；锚点失实） | **已关闭** | **RA-1①**：§8.6 `ws-package` 行——B1 专属 cell，在 **B1 workspace** 内以 vitest `--root <ws>` 逐文件实跑 4 个具名 fixture（`ws-replication-plugin`/`issue299-ac-red`/`issue422-listen-false`/`guard-proxy-consumption`，4 文件本会话确认存在）；`--passWithNoTests=false` + 逐文件 `fs.existsSync` 预检；JSON reporter 落证据 + 每文件测试计数（§8.8「`ws-package` cell 额外记录逐文件存在性预检结果」）；证据路径三处一致（§8.1 `evidence/B1/ws-package.json`、§8.6、§8.8）；纳入 `--all --matrix`（§8.8「B1 专属 `ws-package`」+ §13 AC6 行 + §14 步⑤ + §17 步 1）。§11.1 M3–M6 行、§18 I6、§19 R3/R8 行同步。**RA-1②**：§8.6 `root-test` 行——命令 `NODE_OPTIONS=--conditions=nomicore-source node <repo>/node_modules/vitest/vitest.mjs run --typecheck`，本会话对照根 `scripts.test` **逐字等价**（env 与 `run --typecheck` 参数完全一致，仅 `vitest` → node 直调，且不调裸 pnpm，符合 G16/I4）；证据 `evidence/root-test/root-test.json`（exit code + 测试计数 + logPath）；失败语义三处明确（§8.6「任何红 ⇒ 该 cell 红 ⇒ 交付阻断」、§14 步⑤、§17 步 3「不得以矩阵其余绿抵销」）。**RA-1③**：§6 末段与 §16 首行的「B1 必绿」锚点均已改指 `ws-package` B1 cell + `root-test` 默认布局复证，并保留修正记录；全文 grep「AC6 B1 cell」仅余两处修正记录自身，无残留失实锚点。**不整目录跑**的取舍有明示理由（B1 门禁不耦合无关测试健康度；整目录覆盖由 root-test 承载），且 R3 边界（B2/B3 可跑非验收）写明 |
| **F3**（物化清单漏未 tracked 新文件） | **已关闭** | (i) §8.4 步 1 重写为并集：`git ls-files -z` ∪ **NEW_FILES 显式常量**（runner 内置 §11.1 N1–N11 的 11 条路径）；二者**按路径从当前工作树复制内容**（明示非 index blob）；NEW_FILES 逐条 `fs.existsSync` 预检、任一缺失 ⇒ materialize **exit 2 响亮失败并打印缺失清单**。(ii) §14 新增「红灯证据纪律（B3/F3）」段：双记录（`filesPresent: true` + 失败断言/错误文案与「目标原因」列比对）；**missing-file 红一律判为无效证据**，修复后重跑不得记账；§8.8 固化「materialize 侧存在性预检先于 vitest 侧预检」。(iii) 场景成立性核验：TDD 步③ 时 N1–N11 已由步①② 建为**未 tracked 工作树文件**（M1–M6 未修改）——`git ls-files` 只见 index，并集机制恰使 ws 物化含新文件、且复制的是工作树内容；步⑤ 时 M1–M6 已修改，同一机制复制被测内容。机制在两个阶段均正确。F3 acceptance（未 commit 工作树上步③、D1–D7 红因与目标原因列一致）属实现期落证，已正确列入 §21 OPEN 4（SA3 落证 + SA10 复核） |

### 3.2 非阻塞项核销（F4–F10）

| Finding | 结论 | 证据 |
|---|---|---|
| **F4**（safeGet 语义判据化） | **已关闭** | (i) 判据化：§5.1「通道存在性判据」=「该 key 的 `Reflect.get` 读取**成功完成**且返回值非 `null`/`undefined`」，读取抛错与 nullish 同归一为缺席，并给出归一理由（消费者无从得知被拒读取背后是否有值）。(ii) 裁定单一无歧义：§5.1「显式裁定」——symbol 读取抛错 ⇒ 归一为缺席 ⇒ 读同 host legacy ⇒ legacy 合法则 **arm legacy**；legacy 亦缺席/抛错 ⇒ 下一 host ⇒ 最终稳定单句 throw；明文「不以『读取被拒』为硬失败」（那会在 C-R4b 推进链外引入第四种结局 + 把 proxy 噪声升级为失败面，违反冻结面）。与 C-R4a–d 映射表逐行自洽（catch 收窄到单次 `Reflect.get`、assert 在 catch 之外、catch 唯一动作 = return undefined、无 undefined 泄漏给调用方、无 ambient 兜底——骨架 L90–114 逐条对应）。(iii) pin 有效性核验：D11（symbol 读取抛错 + legacy 可读 → arm legacy、proxy 异常零泄漏）**base 即绿**（base 代码从不读 symbol）——若实现者把 read-throw 做成硬失败，apply 将 throw 而非 arm legacy ⇒ D11 红；若异常泄漏 ⇒ 「零泄漏」断言红。D10（双通道读取皆拒 → 稳定单句 throw）base 红（首个 `ctx.root` 读即 proxy 噪声泄漏 ≠ 稳定文案）。§14 反证敏感性明文「把 safeGet catch 做成硬失败/异常泄漏 ⇒ D11 或 D10 必红」。AC1(a) sentinel（symbol 可读时 legacy getter 读取数 = 0）保留为 R4 字面运行时锚。F4 (i)(ii)(iii) 三点全落；其失败语义面已并入 §21(a) 复查申报 |
| **F5**（null-host 守卫） | **已关闭** | `tryResolveRootTimer` 首行 `if (host === null || typeof host !== 'object') throwRootTimerUnavailable()`——null 判断在前（`typeof null === 'object'` 陷阱已规避）；ws-replication 骨架 `timer.ctx !== undefined ? tryResolveRootTimer(timer.ctx) : undefined` 使 `null` 进入守卫（稳定 throw，不产生 `Reflect.get(null,…)` TypeError、不被 safeGet 吞为级联），`undefined` 仍级联（与现状 `?.` 逐行为等价）。行为对比注记（null 由静默级联收紧为 loud fail）附可达性论证——本会话全仓 grep `ctx: null` **零命中**，4 个 fixture shim 均提供 object `ctx` 或省略、统一 shim 提供 `ctx: { [Symbol.for(…)]: … }`（object），「合成畸形形态不可达」属实。§5.2 文案表两行均注明「宿主非对象共用该文案」 |
| **F6**（G5 capture 执行细节）+ A-2 | **已关闭** | §15 G5 五步流程：① `git worktree list --porcelain` 预检（陈旧 `.worktrees/base-snapshot` ⇒ 响亮失败 + 清理指引，不静默复用）；② `worktree add --detach`；③ base worktree 内最小声明驱动 symlink farm——`@deepseek-ai/*` 与外部依赖 symlink 至**主仓 realpath** 默认安装（点明 base worktree 无 node_modules、Node 上溯不可达 = A-2 缺口所在），`@nomicore/*` 不需链接、经 `node --import <主仓>/node_modules/tsx` + `NODE_OPTIONS=--conditions=nomicore-source` 直载 base worktree 自身 `src/`；④ 逐 entry 写快照；⑤ trap 兜底 remove（A-5 同落）。快照值不受加载方式影响的论证保留 |
| **F7**（解析通道 / NODE_OPTIONS 差异） | **已关闭** | §8.4 新增「解析通道分析」段：tsc 靠 `customConditions: nomicore-source`（本会话对照 `tsconfig.base.json` 属实）、vitest 靠 config alias（对照 `vitest.config.ts` alias 全套属实）、`@deepseek-ai/*` 靠 overlay exports 的 types/default/import 条件（customConditions 对其落空属预期）；ws 内 tsc/vitest 命令**均不携带**该 env，根布局 `scripts.test` 携带它（root-test 命令逐字保留）——「布局差异而非遗漏」双向写明（误加会掩盖 overlay exports 实际解析事实、误删会破坏根布局），实现者无猜测空间 |
| **F8**（instrument 时机 + hedge） | **已关闭** | §8.6 real-timer 行：`TimerService.prototype.timeout` patch **必须先于 TimerService 构造/provide**（timer 经 `ctx.mixin` 在 provide 期捕获绑定，事后 patch 原型可能不被拦截）；「若时序不可控，以**等价可观察计数**替代——SA6 hedge 恢复」原文在场 |
| **F9**（legacy-shim 同一受控 ctx） | **已关闭** | §8.7 `--fault legacy-shim` 行 F9 落实句：channel 测试从 env 读取 fault 后，在**该测试自建的受控 ctx** 上同时完成 shim 注入与「legacy 缺席」形状断言，「二者不跨对象、不跨进程」；外层语义（observed='pass' → exit 1）保证不会假绿 |
| **F10**（行号漂移） | **已关闭** | §2 C4 改符号事实锚定（`Context` 构造器内 `this.root = self` 赋值 + `Context.root` static 定义）+ 行号注记「外部工件行号随安装副本漂移，本设计与后续产物引用一律以符号事实为准」 |

### 3.3 SA8 设计后复查项核销

| 项 | 结论 | 证据 |
|---|---|---|
| RA-1①②③ | 已关闭 | 同 §3.1 F2 行 |
| RA-2（G9 + G1′ 扩展） | 已关闭 | §15 G9：`git diff --exit-code $BASE -- tsconfig.base.json tsconfig.typecheck.json vitest.config.ts 'packages/*/tsconfig.json' 'apps/*/tsconfig.json' 'domains/*/tsconfig.json'`——pathspec 与 SA8 建议逐字一致；ws-replication tsconfig 与 G3 的重叠以「G9 严格更紧（零 diff ⊂ allowlist）」注记正确消解。G1′ 扩展 pathspec（lock + 根 + 全部 `packages/*`/`apps/*`/`domains/*` package.json + artifacts）+ R7(d)「原样 = 不放松」保义论证；本会话 `git ls-files '*package.json'` 核对：全部 16 份 manifest 恰好落在三 glob 内，无遗漏、无嵌套层级逃逸。§11.2/§13 AC7-AC8/§19 R1/R7 行同步 |
| A-1（contract 口径） | 已关闭 | §8.6 contract 行：全目录 glob 动态求值（base 19 → N1–N4 后 23，本会话实测 19 个 `.test.ts` 起点正确），新文件双跑幂等无害，不用硬编码文件数 |
| A-2 | 已关闭 | 同 F6 |
| A-3（seam 文件形态备案） | 已吸收为 OPEN | §5.6 注记 + §21 OPEN 3：触发条件在实现期（若改走私有 seam 文件形态，G3 allowlist 同步扩展并回 SA8 备案）；本稿维持 in-file 收口，当前一致。非本稿可核销项，处置正确 |
| A-4 | 已关闭 | 同 F1（全文无第二形态表述） |
| A-5 | 已关闭 | 同 F6（G5 步①/步⑤） |
| C-R4a–d | 已关闭 | §5.1 映射表四行 + 骨架实现逐条对应（见 F4 行）；C-R4d 的 sentinel + legacy-shim 负控在 §8.5/§8.7/§13 AC5 行原样保留 |

---

## 4. 新增面审查（本轮第 6 问）

| 新增面 | 检查 | 结论 |
|---|---|---|
| `root-test` cell「仓库现成安装缺失 ⇒ 响亮 exit 2」 | 是否使交付不可判定？否——exit 2 响亮、有明确成因与可执行补救（默认布局按既有 lockfile 安装，属环境前置条件，同类于 acquire 的网络前置）；runner 永不安装（G16/I4「全链路零裸 pnpm」指 runner 链路，SA3 手工准备环境不违约、AC8 禁的是 manifest 变更非安装）。本 worktree 已有默认安装（根 node_modules tsx/typescript/vitest + per-package `@deepseek-ai` 链接，C12 属实） | 自洽；**N-2（MINOR）**：设计未写明该前置与补救路径，建议 §8.6 root-test 行补一句「交付验证前由 SA3 确认默认布局安装就绪；缺失 ⇒ exit 2，补救 = 按既有 lockfile 安装，非不可满足门禁」 |
| `ws-package` 只对 B1 必绿 vs `--all --matrix`「绿不得抵销红」 | §8.8 明文把「B1 专属 `ws-package`」列为 matrix 必含 cell，且「任一 cell fail 或缺失 → exit != 0；绿不得抵销红」；B2/B3 运行属允许附加证据（R3 非验收），不放松任何 cell | 一致，无削弱 |
| G9 vs「实现期改 tsconfig 的合法需求」 | 本设计自身文件计划**不需要**任何 tsconfig/vitest 改动：N1–N4 落在 persistence tsconfig `test/**/*.ts` include 内（实测）；fixture `.mjs` 不匹配任何 include；A-3 备选形态（私有 seam 文件）亦匹配 `src/**/*.ts`。§11.2 本就把 tsconfig 面列入 DENY（R1 反掩蔽），G9 只是机械化既有义务，不与任何合法需求冲突 | 自洽 |
| NEW_FILES 常量（runner 内置 N1–N11） | 与 §11.1 逐条对应（11 条）；「存在即复制；任一缺失 exit 2 + 打印缺失清单」语义完备（全部必须存在）；按工作树内容复制使步③/步⑤ 均取被测内容；§8.8 固化预检先于 vitest 预检；§9 数据流行同步 | 自洽 |
| §21 OPEN 清单（6 项） | 全部为实现期核销义务（diff 面复查、gates 首跑、A-3 触发、红灯落证、F1 code review、F8 时机），与 SA8 §13(b)(c) 对应，不掩盖设计期缺口 | 自洽 |
| `--suite root-test` 与命令 synopsis | §8.8 synopsis 把 `--baseline <B1|B2|B3>` 写在必选位置，同 bullet 又明文「`--suite root-test` 不需要 `--baseline`」 | **N-3（MINOR）**：synopsis 应将 `--baseline` 标为可选（`[--baseline …]`）以免与例外句打架；语义无实歧义 |
| 证据路径 `evidence/root-test/root-test.json` | baseline 槽位放 suite 名——§8.1/§8.6/§8.8 三处一致，evidence JSON 内 `baseline: 'default'` 字段承担语义 | 无漂移，不构成 finding |

**新发现的 MINOR（本轮唯一新增问题）**：

- **N-1（MINOR）**：§13 AC6 cell 汇总「3×(typecheck+**5** 基线 suites)」计数错误——基线 suites = **6**（provenance、root-probe、contract、real-timer、dsh-profile、unload；§8.6 suite 顺序行、§8.8「全部基线 suites」、§17 步 1 枚举均为 6）。规范文本（§8.8/§17）无歧义，runner 按 `--all` 语义实现不受影响，但 SA10 按 AC6 cell 文字对账会差一项。修法：改「5」为「6」或写「全部 6 个基线 suites」。

分级说明：N-1/N-2/N-3 均不改变任何验收判据的真假可判性、不放松任何门禁、不影响安全实施，按本评审严重度标准归 MINOR，不阻断 approve。

---

## 5. 需求覆盖（iteration 0 结论维持，修订后状态）

| Requirement（owner checklist） | Design section | Assessment |
|---|---|---|
| L21 AC1 / L22 AC2 / L23 AC3 / L24 AC4 / L25 AC5 | §5.1、§8、§13 | 覆盖；AC1 判据 (a)–(f) 全部落测试名，**新增 D10/D11 两条 read-throw 判据**（F4 落实后语义完备） |
| L26 AC6 每基线全仓 typecheck + contract/真实 Timer/DSH profile；不得抵销 | §8.8、§14 D7、§13 AC6 行 | 覆盖；ws-replication 运行面经 `ws-package@B1` + `root-test` 补齐执行载体（F2/RA-1 关闭）；仅 N-1 计数笔误 |
| L27 AC7 / L28 AC8 / L17 尾句 AC9（derived） | §5.3、§5.5、§11、§15 | 覆盖；G1′ 扩展 + G9 使 manifest/tsconfig 面零 diff 全机械化 |

## 6. Owner 评论覆盖

Issue #470 无任何评论（brief `## Comments` 空；SA6 §2、SA8 复核三源一致）。R6 账本正确（8 + derived 1），无臆造第 9 条。

## 7. 上游事实与 SA8 约束

iteration 0 §5 表结论维持；本轮增量核对：R1（G9 补强后闭环）、R2（allowlist 与 §11.1/§17/G2/G3 三方一致，NEW_FILES 不越出 persistence/test 树）、R3/R8（锚点改指后证据链闭合）、R4（C-R4a–d 映射 + safeGet 裁定 + F5 守卫齐备）全部落实；C15/C16 新事实独立复核属实。无回归被否决选项 O1–O7 的迹象（G9 封死 O4 载体；`--fault substitute-*` 三负控封死工件冒充）。

## 8. 设计内部一致性

- §5.1 捕获形态纪律/骨架、§7、§9、§10 四处统一（F1 关闭后全文唯一形态）。
- §8.1/§8.6/§8.8 三处 ws-package/root-test 证据路径一致；§14 步⑤/§17 步 1 与 §8.8 聚合口径一致（除 N-1 的 §13 计数笔误）。
- §14 D1–D11 红灯表与 §13 AC 行互证；D10/D11 与 §5.1 裁定互证；反证敏感性段落把 D10/D11 与 safeGet 误实现显式挂钩。
- §20 修订映射与正文逐条对得上（本评审按映射逐项回查原文均在）；「未吸收项：无」属实（A-3 为显式 OPEN，非未吸收）。
- 既有文案冻结面（§5.2 四条逐字节不变 + 新文案与 `core-dsh-boundary` regex 零误匹配）iteration 0 已实测，本轮修订未触碰。

## 9. 状态机与并发攻击（增量）

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| S3′ | timer service 合法但 symbol 读取被 proxy 拒绝、legacy 可读 | apply 期 safeReadChannel | 归一为缺席 → arm legacy，proxy 异常零泄漏；D11 pin 且反证敏感性挂钩 | 无（F4 关闭） | — |
| S5′（新） | `timer.ctx === null`（合成畸形 fake service） | `timerFromContext` → `tryResolveRootTimer(null)` | 首行守卫稳定 throw（不 TypeError、不被吞为级联）；全仓零 `ctx: null`，不可达面成立 | 无（F5 关闭） | — |
| S1/S2/S4 | （iteration 0 已核，时序/UNLOADING 窗口/重复 apply） | — | — | 无 | — |

## 10. 错误与恢复攻击（增量）

E1（detach）已被捕获形态纪律 + C15 事实 + §21 OPEN 5（实现期 code review）三层关闭；E3（null host）已由 F5 守卫关闭；E2/E4/E5 iteration 0 已核维持。read-throw 双拒（D10）归一为稳定 throw，不产生新静默面（C-R4c 出口二选一）。

## 11. 契约影响审查

iteration 0 §9 表结论维持：`PersistenceScheduler` 接口零变化、`timerFromContext`/`OwnedTimer` 三方法不动、4 fixture 消费面 B1/B2 等价 + B3 目标改进、adapter 直连路径无能力真空、既有负向断言面零破坏。增量：4 fixture 的运行时回归现在有 `ws-package@B1` + `root-test` 双载体（F2 关闭）。

## 12. 文件范围审查

ALLOW（6 修改 + 11 新增）与 §17 Controller 清单、G2/G3/G9 allowlist 三方一致；NEW_FILES 常量 = §11.1 N1–N11 逐条对应，不构成范围扩张；`.gitignore` 零改动维持（C9 实测）；DENY 面经 G1′（全 manifest）/G7（docs）/G9（tsconfig/vitest）机械化。无越权。

## 13. 验收设计审查（增量）

- `ws-package` cell：逐文件预检 + `--passWithNoTests=false` + JSON 证据 + 每文件计数——判真假可执行，SA10 可复核（`evidence/B1/ws-package.json`）。
- `root-test` cell：与根 `scripts.test` 逐字等价（本会话对照属实）、exit code + 计数落证据、任何红阻断交付——「根 test」件套从宣称变为可核销 cell。
- 红灯证据纪律：`filesPresent` 双记录 + missing-file 红无效——封死「文件缺失红伪装目标原因红」的证据失真路径。
- D10/D11 pin 与反证敏感性挂钩——safeGet 误实现（硬失败/异常泄漏）必然可检出。

---

## 14. Required revisions（实现前必须修订）

**无。** iteration 0 的 F1/F2/F3（MAJOR）全部关闭（§3.1），无新增 BLOCKER/MAJOR。

## 15. Non-blocking observations（不阻断 approve）

| ID | 内容 |
|---|---|
| N-1 | §13 AC6 cell「3×(typecheck+**5** 基线 suites)」应为 **6**（provenance/root-probe/contract/real-timer/dsh-profile/unload；§8.8/§17 为准）。修法：改数字或写「全部 6 个基线 suites」，供 SA10 对账 |
| N-2 | §8.6 `root-test` 行建议补一句环境前置与补救路径（「默认布局安装缺失 ⇒ exit 2；补救 = 按既有 lockfile 准备默认布局安装（B1 现成装配，C12）；runner 永不安装（G16）」），避免实现者把 exit 2 误读为不可满足门禁。本 worktree 已具备该安装，非现实阻塞 |
| N-3 | §8.8 命令 synopsis 的 `--baseline <B1|B2|B3>` 应标为可选（`[--baseline …]`），与同 bullet 的「`--suite root-test` 不需要 `--baseline`」例外句一致；语义无实歧义 |
| （已落地备注） | iteration 0 F4–F10 已全部关闭并转入正确的实现期 OPEN 项（§21 之 4/5/6 对应 F3 落证/F1 code review/F8 时机），不再列为观察项 |

---

## 16. 实现阶段必须遵守的最关键纪律（approve 附带条件）

1. **捕获形态纪律（F1/C15）**：两处 seam 一律以 `rootTimer.timeout(callback, delayMs)` **方法调用形态**武装，禁止任何 detach 函数引用（`const t = rootTimer.timeout` / 属性直取）——timer `timeout` 体首行 `this.ctx.effect(...)`，detach 即复刻「首次调度才炸」故障。code review 逐处核对 + real-timer 三基线绿（§21 OPEN 5）。
2. **safeReadChannel 窄化纪律（C-R4a–c + F4/F5）**：try/catch 只包单次 `Reflect.get`；read-throw 一律归一为「该通道缺席」并沿推进链走（同 host 另一通道 → 下一 host → 稳定单句 throw），**不得**做成硬失败或异常泄漏（D10/D11 pin 必红）；`assertRootTimerShape`/级联/最终 throw 在 catch 之外；null/非对象 host 首行守卫立即稳定 throw，不被 safeGet 吞为级联。
3. **红灯证据纪律（F3）**：步③ 在未 commit/add 的工作树上执行；每条红灯双记录（materialize NEW_FILES 预检 + vitest 逐文件预检 `filesPresent: true` + 红因与 §14「目标原因」列比对）；missing-file 红一律无效、修复重跑，不得记账（§21 OPEN 4）。
4. **B1 包门禁不可抵销 + 命令面纪律（F2/RA-1/F7）**：`--all --matrix` 任一 cell 红（含 `ws-package@B1`、`root-test`、gates）⇒ exit != 0，修复后重跑不得抵销；root-test 命令与根 `scripts.test` 逐字等价（含 `NODE_OPTIONS=--conditions=nomicore-source`）；ws 内 runner 命令**不得**加该 env（布局差异而非遗漏，双向防误加/漏加）。
5. **配置面零 diff + A-3 备案（RA-2/G9）**：`tsconfig*.json`/`vitest.config.ts` 全程零改动，TS2576 只经源码 `Reflect.get` 迁移消除（O4 载体封死）；若实现期改走私有 seam 文件形态，G3 allowlist 同步扩展并回 SA8 备案（§21 OPEN 3）。

---

## 17. 结论

**approve**。iteration 1 修订稿对 F1/F2/F3（MAJOR）、F4–F10（非阻塞）与 SA8 RA-1/RA-2/A-1–A-5/C-R4a–d 逐条真实关闭（证据见 §3，全部经修订稿原文 + 仓库事实双重核对，未采信自述）；修订新增面自洽，仅余 N-1/N-2/N-3 三条 MINOR（计数/措辞级，建议实现期顺手修正，不阻断）。`requiresConflictRecheck: false`（本轮无 ADR 治理面上的新增风险；设计 §21 已申报的实现后复查面与 SA8 对 RA-1/RA-2 修订稿的复审按既定流程执行）。SA4/SA7 实现期须按 §16 五条纪律与 §21 OPEN 清单核销；`pass` 仅覆盖设计面，不替代实现与活链路验证。
