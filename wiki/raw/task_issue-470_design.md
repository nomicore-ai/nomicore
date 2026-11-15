# SA1 实现设计 — issue #470：Cordis rc.12 双形态 Root tracer bullet 与工件验真

- HEAD/base：`279dba4ac81b7c7520e3d0b87b5c4d621a86a517`（worktree `mabf/issue-470`）
- 任务类型：**feature（tracer bullet + 验收设施）**。目标 = 同一公开发布的 Memory/File Persistence 插件在 legacy npm Cordis 与 DSH rc.12 Cordis 工件上通过真实 Timer 完成 flush/retry/drain/dispose/service-revoke；并建立可复用的三基线工件身份与 Root 通道验真设施。
- 输入账本：owner 8 条 checklist（`wiki/raw/task_issue-470.md` L21–L28）+ derived AC9（L17 尾句）；SA6 契约 `wiki/raw/task_issue-470_sa6_acceptance_contract.md`；SA8 冲突报告（verdict **clear**，绑定裁决 R1–R9）`wiki/raw/task_issue-470_conflict_report.md`。本设计**逐条吸收 R1–R9**，不重开任何已被否决选项（O1–O7）。
- **iteration 1（定向修订）**：两份独立评审均 reject 且必须修订项收敛一致——SA2 设计评审 `wiki/raw/task_issue-470_sa2_review.md`（F1/F2/F3 MAJOR；F4–F10 非阻塞）与 SA8 设计后冲突复查 `wiki/raw/task_issue-470_design_conflict_report.md`（RA-1/RA-2 必修；A-1–A-5 附注；§3 特别裁定 C-R4a–d 绑定约束）。本版保留 iteration 0 已通过评审的部分（seam 落点与形态、R2 迁移面、三基线设施、AC 账本、机械 gate 主体、TDD 红灯设计），只关闭上述阻塞项与裁定项；逐条映射见 §20「评审修订映射」。

---

## 1. 目标与非目标

**目标**

1. `@nomicore/persistence` 与 `@nomicore/ws-replication` 各自的 Host 接线叶子迁移为 symbol 优先、legacy 兜底的包内私有 Root 解析缝（ADR 0035 §2）；缺席/形状不符在 **apply 期同步 loud fail**，文案稳定单句；绝不 fallback 到 ambient timer。
2. 恰好 4 个具名 ws-replication Host fixture 的直接 `ctx.root` 读取完成同款迁移（R2）。
3. 建立 B1/B2/B3 三基线夹具：npm tarball（integrity 钉死）、DSH commit `1511a6ed442c207919142a4b0e6c4916f96d2c3b` sparse clone + 最小 tsc source-build + 8 项 provenance（R5）、隔离 workspace、双位置解析断言、独立 root probe、4 个负控、每基线 15-project 全仓 typecheck（R1）、runner 输出契约与 `--all --matrix` 聚合。
4. TDD 红灯清单、AC→证据映射、机械 gate 脚本化（R7 补齐 + G9 反掩蔽）、R8 冻结面持守、Controller 精确交付清单；**B1 包门禁四件套全部有执行载体**（focused tests / 包 typecheck / 根 typecheck / 根 test，见 §8.6 `ws-package` + `root-test`）。

**非目标（R3 / ADR 0035 §5–§6）**

- 不做 Replication 三基线行为矩阵（Hub/Peer/SessionHost 启停、timer 清理）——那是后续 Replication 票；本票对 ws-replication 交付「编译面绿 + seam 语义正确 + B1 包门禁四件套」（四件套的执行载体见 §8.6/§8.8），**不宣称 Replication 已在 rc.12 行为兼容**。
- 不做 `apps/yjs-server` 三基线行为验收（SA6 X4）；其 typecheck project 仍在 15-project 清单内（R1）。
- 不改依赖 range/归属、不修改历史 `artifacts/`、不执行真实 MABF/DSH 部署或 patch 移除、不修改 ADR 追认实现、不新增公共生产 API。

---

## 2. 当前行为与证据锚点（源码事实）

| # | 事实 | 锚点 |
|---|---|---|
| C1 | 生产 `ctx.root` 直接读取全仓恰好 2 处：persistence `setTimeout: (cb, ms) => ctx.root.timeout(cb, ms)`；ws-replication `const root = timer.ctx?.root ?? ctx.root` | `packages/persistence/src/service.ts:54`；`packages/ws-replication/src/plugin.ts:214`（SA8 §1 全仓清点） |
| C2 | persistence 的读取是**惰性**的：闭包在每次 `setTimeout` 调用（首次 dirty notification）才读 `ctx.root`；`assertPersistenceHostDependencies` 只检查 `ctx.get('timer').timeout`，不检查 Root 通道 → rc.12 上 boot 成功、首次 `saveDoc` 才 reject | `service.ts:26–35, 48–56`；`lifecycle.ts:765–775, 1111–1123`；SA6 §5.1（3/3 稳定） |
| C3 | ws-replication 的解析在 plugin `apply()` 内同步执行（hub `plugin.ts:454`、peer `:649` 调 `timerFromContext(ctx)`），且已有形状检查与稳定文案 `required Cordis root timer context is unavailable` | `plugin.ts:206–239, 454, 649` |
| C4 | cordis 4.0.1 `Context` 构造期以 ReflectService Proxy 包装自身并赋 `this.root = self`——`ctx.root` 是实例属性（Proxy 包装的 root）；rc.12 无实例 `root`，只有 `[symbols.root]`（= `Symbol.for('cordis.root')`）与 static `Context.root` | npm cordis 4.0.1 `src/context.ts`（`Context` 构造器内 `this.root = self` 赋值 + `Context.root` static 定义；SA6 §5.3/§9.1）。**行号注记（SA2 F10）**：外部工件行号随安装副本漂移，本设计与后续产物引用一律以**符号事实**为准 |
| C5 | rc.12 运行时：root ctx 上 legacy 读 = `undefined`；plugin fiber 上 legacy 读 **throw** `cannot get property "root" without inject`；symbol 读两形态均 = root 且 `timeout` 为 function。npm 4.0.1/4.1.0：legacy = root（原型继承），symbol = `undefined`，`Context.root` static 不存在。**三基线实测中 symbol 读取从不抛错**（B6 裁定的可达性依据） | SA6 §4.1 Runtime Root 探针表（三基线实测） |
| C6 | `assertPersistenceHostDependencies` 另被 memory/file 的 adapter `apply()` 直接调用（除 scheduler 工厂外第二条调用路径），而 adapter 直连路径（显式注入 scheduler）**不读 root** | `memory.ts:199, 239`；`file.ts:143, 280` |
| C7 | `service.ts` 不经 `src/index.ts` 再导出（index 只再导出 contract/lifecycle/memory/file 面）——service.ts 的一切符号本就是包内私有面 | `packages/persistence/src/index.ts`（全文核对） |
| C8 | 4 个 fixture 的直接读取共 10 处 = `ws-replication-plugin.test.ts:24,25,41`、`ws-replication-issue299-ac-red.test.ts:173,177`、`ws-replication-issue422-listen-false.test.ts:44,83,84`、`ws-replication-guard-proxy-consumption.test.ts:101,102`；与本会话全仓 grep 一致。`ctx.rootValue`/`ctx.root('hub',…)` 是 harness helper（`test/driver.ts:427` 等），与 Cordis `Context.root` 无关，**零触碰** | 本会话 grep + SA8 §1 |
| C9 | 根目录 `.gitignore` 已含 `node_modules/`、`.cache/`、`.pnpm-store/`、`.worktrees/`、`*.tsbuildinfo`、`**/tsconfig.build.json`——overlay/缓存/证据可落在已忽略路径，**无需改 `.gitignore`** | `.gitignore`（全文） |
| C10 | 全仓 typecheck = 根 `package.json` `scripts.typecheck` 15 个 project（含 `packages/ws-replication/tsconfig.json`、`apps/yjs-server/tsconfig.json`）；vitest 发现规则 `packages/*/test/**/*.test.ts` 且 `passWithNoTests: true`（runner 必须覆写为 false）；根 `scripts.test` = `NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck` | `package.json` scripts；`vitest.config.ts` |
| C11 | rc.12 类型面 base HEAD 实测 13 个 TS2576：persistence 1（service.ts:54）+ ws-replication 12（src 3 + 4 fixture 10）；npm 4.0.1 与 4.1.0 类型面均 exit 0 | SA6 §9.4、§15.1 |
| C12 | 仓库装配 = B1 现成布局（cordis 4.0.1 + timer 1.1.3 + cosmokit 1.8.2，pnpm per-package `node_modules/@deepseek-ai/*` 链接）；根 `node_modules` 仅 typescript/vitest/tsx | 本会话 `ls node_modules`、`packages/persistence/node_modules` |
| C13 | `core-dsh-boundary.test.ts` 有反向依赖守卫 `expect(() => import.meta.resolve('@nomicore/dsh-persistence')).toThrow()`——临时 workspace **不得**把全部 `@nomicore/*` 平铺到任何祖先 `node_modules` | `core-dsh-boundary.test.ts:82` 附近；SA6 §14 |
| C14 | DSH vendored timer 1.2.0 / cosmokit 1.9.0 源码与 npm 同版本**逐字节相同**；cordis 4.1.0 源码不同——同名替换对前两者只能靠 realpath + output hash 发现 | SA6 §9.3、附录 A（G18） |
| C15 | **timer `timeout` 的 `this` 依赖（B1/F1 事实依据）**：`@deepseek-ai/cordis-plugin-timer` 的 `timeout(...args)` 实现体在 `callback` 分支首行即 `this.ctx.effect(...)`（1.1.3 与 1.2.0 同形）——若把 `rootTimer.timeout` **detach 成函数引用**（`const t = rootTimer.timeout`）再调用，`this === undefined`，首个 arm 即 `TypeError: Cannot read properties of undefined (reading 'effect')`，精确复刻本票要消灭的「延迟到首次调度才炸」故障形态 | 本会话复核：`.pnpm/@deepseek-ai+cordis-plugin-timer@1.1.3_@deepseek-ai+cordis@4.0.1/.../lib/index.js` `timeout(...args)` 体；SA2 §8 E1/F1 |
| C16 | 现状 `OwnedTimer`（plugin.ts:218–238）已持有 `root` **对象引用**并以 `root.timeout(callback, delayMs)` 方法调用形态武装——ws-replication 侧的 B1 纪律与现状同形，迁移只需保持该形态 | `plugin.ts:214, 220–228` |

---

## 3. 能力缺口（承接 SA6 §8/§16）

G1–G3（生产无 symbol 通道、无解析缝、失败延迟到首次 saveDoc）、G4–G7（无 B2/B3 夹具、无 provenance、无解析断言设施）、G8（无 probe/负控）、G9–G11（无每基线 typecheck/矩阵/DSH profile 运行）、G12（无机械 gate）、G19–G22（既有测试假绿、注释失实、无 symbol 引用）逐条由本设计 §5–§8、§10–§14 承接。G13（scope 冲突）已由 SA8 R1+R2+R3 消解；G14 由 R6 账本承接；G15/G16/G17/G18 由 §18 风险表承接。

---

## 4. Owner 要求落实

Issue #470 **无任何评论**（brief `## Comments` 为空；SA6 §2），无 owner 附加要求或后续改写。需求面 = 正文 What to build + 8 条 checkbox：

| 来源 | Requirement | 设计章节 |
|---|---|---|
| L21（AC1） | symbol 优先、legacy 兜底、缺席/形状不符 loud fail、无 ambient timer | §5.1、§13（AC1 行） |
| L22（AC2） | 三基线 × Memory/File 真实 Timer flush/retry/drain/dispose/撤销 | §8、§13 |
| L23（AC3） | dependent 卸载期间 dirty notification 完成；adapter 只在既有排空边界后释放；ADR 0006/0009 语义不变 | §5.4、§8.6 |
| L24（AC4） | rc.12 夹具钉 commit、source-built/provenance、测试开始断言解析路径 | §8.2–§8.4 |
| L25（AC5） | runtime 探针证明 npm=legacy、rc.12=symbol；回退/替换/错配必红 | §8.5、§8.7 |
| L26（AC6） | 每基线全仓 typecheck + contract/真实 Timer/DSH profile；不得抵销 | §8.6、§8.8（R1 严格读法） |
| L27（AC7） | 不新增公共生产 API；不扩散到 Persistence 核心/Registry | §5.3、§11、§15 |
| L28（AC8） | 不改依赖 range/归属、不改 artifacts、不部署不 patch | §11、§15 |
| L17 尾句（AC9，derived） | Host 不需要新增配置或条件装配 | §5.5、§13（AC9 行） |

R6 账本：owner checkbox 恒 **8** 条；AC9 恒标 **derived** 并引 L17 原句「Host 不需要新增配置或条件装配」；任何产物不得声称存在第 9 条 checklist。

---

## 5. 设计决策 A/B：Seam 决策形态（两包同规，R4）

### 5.1 决策形态（唯一实现形态；O4 cast-only、O6 硬切 symbol-only、硬升依赖均已被 SA8 否决）

两包各自新增一个**包内私有** Root 解析函数（无新文件、无新 export、无跨包共享——ADR 0035 §2「不新增公共包、公共 export 或跨领域依赖」；两包各持一份 ~20 行同规实现是有意复制，非 DRY 缺陷）：

通道解析（对单一 host 对象）：

```ts
// 参考形态（两包同构；常量与错误文案各自包内私有）
const CORDIS_ROOT_SYMBOL = Symbol.for('cordis.root')

// 通道读取（SA8 C-R4a）：try/catch 收窄到单次 Reflect.get 本身——只包读取本身，
// 不包 assertRootTimerShape、不包级联与最终 throw
function safeReadChannel(host: object, key: PropertyKey): unknown {
  try {
    return Reflect.get(host, key)
  } catch {
    return undefined   // 读取被 proxy 拒绝 ≡ 该 host 该通道缺席（判据与裁定见下文 safeGet 节）
  }
}

// 返回值：可用的 root timer 源（具备 timeout 方法的对象；persistence 侧 = root Context，
// ws-replication 侧 = timer.ctx 或 root Context）；undefined = 该 host 双通道皆缺席（含读取被拒的归一）
function tryResolveRootTimer(host: object): RootTimerSource | undefined {
  if (host === null || typeof host !== 'object') {
    throwRootTimerUnavailable()   // F5：宿主非对象 = malformed，立即稳定 throw（不进 Reflect.get、不被 safeGet 归一转级联）
  }
  const symbolRoot = safeReadChannel(host, CORDIS_ROOT_SYMBOL)
  if (symbolRoot !== undefined && symbolRoot !== null) {
    return assertRootTimerShape(symbolRoot)   // 在 catch 之外（C-R4a）：缺 timeout/非 function → 立即 throw（malformed 不回落）
  }
  const legacyRoot = safeReadChannel(host, 'root')
  if (legacyRoot !== undefined && legacyRoot !== null) {
    return assertRootTimerShape(legacyRoot)   // 同上：malformed legacy 同样 throw，不跨通道/跨 host 回落
  }
  return undefined
}
```

- **优先级**：`Symbol.for('cordis.root')` → legacy `'root'`（ADR 0035 §2 逐字形态）。symbol **存在**（读取成功且非 null/undefined）时绝不读 legacy —— 这同时消解 rc.12 fiber 上 legacy 读会抛 proxy Error 的风险。
- **`??` 语义**：null 视同缺席（ADR 形态原文即 `??`）；只有「存在但形状不符」才阻断回落。
- **malformed 不回落**：候选通道存在但 `timeout` 非 function → **立即同步 throw** 稳定文案；不尝试另一通道、不尝试另一 host、不延迟到 saveDoc。
- **宿主非对象（F5）**：host 为 `null`/非对象（ws-replication 侧 `timer.ctx === null` 的畸形 fake service 形态）→ 首行守卫**立即同步 throw** 稳定文案；不得让 `Reflect.get(null, …)` 抛 TypeError 噪声，也不得被 safeGet 吞掉转级联。行为对比注记：现状 `timer.ctx?.root ?? ctx.root` 对 `timer.ctx === null` 会静默级联到 `ctx.root`——本守卫把该**合成畸形形态**（真实 TimerService 与全部 fixture shim 均不产生 null host：shim 提供 object `ctx` 或整个省略）从「静默级联/TypeError 噪声」收紧为「malformed 立即 loud fail」，与冻结面「稳定文案不随 ctx 形态漂移」（SA8 §5 末行）一致；`timer.ctx === undefined` 仍按「host 缺席 → 级联下一 host」处理，与 `?.` 语义逐行为等价。
- **双通道皆缺席**（所有候选 host 均未解析出，含读取被拒归一）→ 同步 throw 同一稳定文案。**绝不** fallback 到 `setTimeout`/globalThis/ambient timer（AC1；`module-graph-regression.test.ts:56–57` 的静态守卫继续持守）。
- **能力形状**：只要求既有消费所需的 `timeout(cb, ms)` 可调用（persistence scheduler 只用 `timeout`；ws-replication `OwnedTimer` 同样只经 `root.timeout` 武装）。不探测 `interval` 等无关能力，不新建类型面。

**捕获形态纪律（B1 / SA2 F1 / SA8 A-4——全文统一，不得出现 detach 形态）**

- 解析结果一律**捕获 `rootTimer` 对象引用**；此后每次调度一律以 **`rootTimer.timeout(callback, delayMs)` 方法调用形态**武装。
- **明文禁止 detach 函数引用**（`const t = rootTimer.timeout; t(cb, ms)` 或 `setTimeout: rootTimer.timeout` 形式的属性直取）：`TimerService.timeout` 实现体首行即 `this.ctx.effect(...)`（C15，1.1.3 与 1.2.0 同形），detach 后 `this === undefined`，首个 arm 即 `TypeError: Cannot read properties of undefined (reading 'effect')`——精确复刻本票要消灭的「延迟到首次调度才炸」故障形态。apply 期解析/校验（loud fail 语义）与调用期属性读取（`this` 绑定保持）**各司其职、缺一不可**。
- 本纪律覆盖两处 seam 的全部 prose 与骨架：persistence `service.ts` 闭包捕获 `rootTimer` 对象；ws-replication `OwnedTimer` 现状已是对象引用 + 方法调用（C16），迁移原样保持。实现代码评审核对两处均为方法调用形态；real-timer suite 三基线绿是运行时佐证。

**safeGet 判据与显式裁定（B6 / SA2 F4——与 C-R4a–d 自洽）**

- **通道存在性判据**：「某 host 的某通道存在 ≡ 该 key 的 `Reflect.get` 读取**成功完成**且返回值非 `null`/`undefined`」。读取抛错与返回 nullish **同归一为「该 host 该通道缺席」**——消费者无从得知被拒读取背后是否有值，归一为缺席是唯一不引入臆测的分类（SA8 §3 裁定该归一不构成对 R4 的偏离）。
- **显式裁定（形态：symbol 读取抛错 + legacy 可读）**：按 C-R4b 推进链处理——symbol 读取抛错 ⇒ 归一为 symbol 缺席 ⇒ 读同 host legacy ⇒ legacy 合法则 **arm legacy**；若 legacy 亦缺席/读取抛错 ⇒ 下一 host（ws-replication 级联）⇒ 最终稳定单句 throw。**不以「读取被拒」为硬失败**：那会在 C-R4b 允许的推进链之外引入第四种结局，并把 proxy 噪声重新升级为失败面（违反冻结面）。同理「双通道读取皆抛错」归一为「双通道皆缺席」→ 稳定 throw（§14 D10）。
- **pin 用例**（消除实现者自行猜测）：§13 AC1 行与 §14 D11 新增 `symbol 读取抛错（Proxy 拒绝）+ legacy 可读：归一为缺席，arm legacy，proxy 异常零泄漏`——base 即绿（base 恒读 legacy、从不读 symbol），pin 的作用是**防止实现者把 read-throw 误做成硬失败或异常泄漏**（那会使本 pin 红）。
- **可达性说明**：SA6 §4.1 三基线实测中 symbol 读取在任何真实基线（4.0.1/4.1.0/rc.12 的 root ctx 与 plugin fiber）均不抛——该形态只经测试内受控 Proxy 构造，本裁定将其定为**确定性支持面**而非行为变更；真实基线上「symbol 可读 ⇒ legacy 零读取」仍由 AC1(a) sentinel（symbol 可读时 legacy getter 读取数 = 0）承载，作为 R4 字面的运行时锚（SA2 F4(iii)）。

**SA8 §3 特别裁定的绑定约束 C-R4a–C-R4d（B5——原样收录并映射实现）**

| 约束 | 原文要点（SA8 design_conflict_report §3） | 实现映射 |
|---|---|---|
| **C-R4a** | try/catch 只包两个通道键的 `Reflect.get` 读取本身；不得包裹 `assertRootTimerShape`（形状断言 throw 必须原样穿透），不得包裹级联与最终 throw | `safeReadChannel` 把 try/catch 收窄到单次 `Reflect.get`；`assertRootTimerShape` 在 catch 之外被调用（骨架见上）；host 间级联（`??` 链）与 `throwRootTimerUnavailable()` 均在函数体顶层，无任何 try/catch 包裹 |
| **C-R4b** | 「按缺席处理」后只允许推进：同 host 另一通道 → 下一 host（ws-replication 级联）→ 最终稳定单句 throw；不得引入任何 ambient/`setTimeout`/globalThis/子 ctx timer 兜底（AC1/R4 红线） | `tryResolveRootTimer` 内 symbol→legacy 顺序推进；`timerFromContext` 内 `timer.ctx → ctx` host 级联仅在「host 双通道皆缺席（含归一）」发生；两处终点都是 `throwRootTimerUnavailable()` 稳定单句。无任何 ambient 兜底（`module-graph-regression.test.ts:56–58` 静态守卫 + AC1 sentinel 持守） |
| **C-R4c** | 不得把 catch 扩展为通用异常吞噬（如捕获后静默返回 undefined 给调用方继续运行）；最终结果必须二选一：成功解析出具备 `timeout` 的 root timer 源，或 apply 期同步稳定 throw | catch 的唯一动作 = `return undefined`（语义 = 该通道缺席），且该返回值只被「继续推进或最终 throw」消费；`createCordisPersistenceScheduler` / `timerFromContext` 的出口仅有「已验证形状的 rootTimer」或「稳定 throw」两种，不存在把 undefined 交给调用方继续运行的路径 |
| **C-R4d** | 保留 AC5 生产通道 sentinel（B3 legacy 零读取）与 `--fault legacy-shim` 负控——它们是「catch 不被用来蒙混通道断言」的机械证明 | §8.5 生产通道 sentinel（symbol 可读时 legacy getter 读取数 = 0；B3 只 arm symbol）+ §8.7 `--fault legacy-shim`（同一受控 ctx 上 shim 注入与「legacy 缺席」形状断言对质，见 F9 落实）原样保留并纳入 §13 AC5 行 |

**persistence 侧（`service.ts` 内收口，单 host = `ctx`）**：

```ts
export function createCordisPersistenceScheduler(ctx: Context): PersistenceScheduler {
  assertPersistenceHostDependencies(ctx)              // 行为零变化（见下）
  const rootTimer = tryResolveRootTimer(ctx)
    ?? throwRootTimerUnavailable()                    // 稳定文案（见 §5.2）；apply 期同步
  return {
    // 捕获的是 rootTimer 对象引用（B1/F1 纪律）；调度一律以方法调用形态武装：
    //   ✅ rootTimer.timeout(callback, delayMs)
    //   ❌ const t = rootTimer.timeout; t(...)   —— timeout 体首行 this.ctx.effect(...)（C15），
    //      detach 后首个 arm 即 TypeError，复刻本票要消灭的延迟故障
    setTimeout: (callback, delayMs) => rootTimer.timeout(callback, delayMs),
    clearTimeout: (handle) => { (handle as () => void)() },   // 不变
  }
}
```

- 解析 + 形状校验从「每次 `setTimeout` 惰性读」改为 **plugin apply 时一次解析并捕获 `rootTimer` 对象引用**（非 detach 函数引用——见上文捕获形态纪律；R4/AC1：apply 期同步 loud fail，不是首次 saveDoc 的 TypeError/proxy 噪声）。`createCordisPersistenceScheduler` 由 memory/file 插件工厂在 `apply(ctx)` 内同步调用（`memory.ts:239`、`file.ts:280`），且先于 `instance.apply(ctx)`（service provision）——throw 时 service 尚未提供（AC1 通过判据 (c)「`ctx.get('nomicorePersistence')` 仍 undefined」天然成立）。
- 捕获对象引用后，apply 之后才销毁 root fiber 的既有宿主违约路径（service.ts:11–17 注释、R1/#15 接线契约）行为不变：disposer 仍在 root fiber 效果面，native 回调续体抛 INACTIVE_EFFECT 的既有契约原样保留（每次 arm 仍经 `rootTimer.timeout` 方法调用，`this` 绑定与现状 `ctx.root.timeout` 一致）。
- **`assertPersistenceHostDependencies` 零改动**：它还被 memory/file 的 adapter `apply()` 直接调用（C6），且 adapter 直连路径（注入 scheduler）不读 root——把 root 校验塞进该函数会让「显式注入 scheduler 的 adapter 测试」在无 root 通道的 Context 上误炸。root 校验只属于派生 plugin 路径，归属 `createCordisPersistenceScheduler`。由此 AC1(e)（timer service 缺失/形状不符 → 既有文案）与 AC1(c)(d)（root 通道 → 新文案）判据泾渭分明。

**ws-replication 侧（`plugin.ts` 内 `timerFromContext` 收口，host 级联保留既有语义）**：

```ts
function timerFromContext(ctx: Context): OwnedTimer {
  const timer = ctx.get('timer') as { ctx?: object | null; timeout?: unknown } | undefined
  if (timer === undefined || typeof timer.timeout !== 'function') {
    throw new Error('required Cordis service "timer" is unavailable')   // 逐字节不变
  }
  const rootTimer = (timer.ctx !== undefined ? tryResolveRootTimer(timer.ctx) : undefined)
    ?? tryResolveRootTimer(ctx)
    ?? throwRootTimerUnavailable()      // 文案 = 既有 'required Cordis root timer context is unavailable'，逐字节不变
  // OwnedTimer 构造体不变：继续持有 rootTimer 对象引用，setTimeout 以
  // rootTimer.timeout(callback, delayMs) 方法调用形态武装（现状即此形态，C16；
  // 本迁移不引入 detach 函数引用——B1/F1 纪律同规）。
  // timer.ctx === null / 非对象：由 tryResolveRootTimer 首行守卫按「宿主非对象」
  // 立即稳定 throw（F5）；timer.ctx === undefined 仍级联到 ctx（与现状 ?. 等价）。
}
```

- host 级联 `timer.ctx → ctx` 逐字保留现状 `timer.ctx?.root ?? ctx.root` 的 host 选择语义（ADR 0035 §3「不改变生命周期决策」）；级联只发生在「host 双通道皆缺席（含读取被拒归一）」，**不**发生在「present-but-malformed」（后者立即 throw）。legacy 形状的 TimerService/fixture shim 下该级联与现状逐行为等价（`timer.ctx === null` 的收紧见上文 F5 注记——合成畸形形态，不可达于真实基线与 fixture）。
- 调用点不变（hub `plugin.ts:454`、peer `:649`，apply 期同步），`OwnedTimer` 接口与三方法实现不动（`root.timeout` 改名 `rootTimer.timeout` 仅是局部变量改名，武装形态不变）。

### 5.2 错误文案（冻结面纪律，SA8 §5「稳定错误文案纪律」）

| 场景 | 文案 | 状态 |
|---|---|---|
| clock service 缺失 | `required Cordis service "clock" is unavailable` | 不变（`@nomicore/clock/src/contract.ts:41`） |
| timer service 缺失/形状不符（persistence） | `required Cordis service "timer" is unavailable: install @deepseek-ai/cordis-plugin-timer before the persistence plugin` | **逐字节不变**（`service.ts:30–33`；core-dsh-boundary 负向 A/B/C 的既有断言面） |
| timer service 缺失（ws-replication） | `required Cordis service "timer" is unavailable` | **逐字节不变**（`plugin.ts:212`） |
| Root 通道缺席/形状不符/宿主非对象（ws-replication） | `required Cordis root timer context is unavailable` | **逐字节不变**（`plugin.ts:216`；既有可能存在的断言与文案纪律零漂移）。F5 的宿主非对象守卫、C-R4b 的最终 throw、双通道读取皆被拒（D10）共用本文案 |
| Root 通道缺席/形状不符/宿主非对象（persistence，新） | `required Cordis root timer context is unavailable: the host root context must expose a callable timeout via Symbol.for('cordis.root') or the legacy root property` | **新增**，单句、稳定、不随 ctx 形态漂移；与 ws-replication 文案同族（同前缀），不与任何既有文案 regex 误匹配（`/required Cordis service "timer" is unavailable/` 不含 "root timer context"） |

新文案与既有文案的关系：persistence 此前没有 Root 失败文案（现状是 TypeError/proxy Error 噪声，SA6 §5.1）；新文案是其**唯一**替代。两包文案不需逐字节相同（R4「同规」= 解析/失败纪律同规，非文案同文）；ws-replication 侧保持既有文案不变以零风险满足「不被削弱」。

### 5.3 边界与不扩散（AC7 / R4 / ADR 0035 §2 L56）

- `Reflect.get` + 窄化 cast **只存在**于两处 seam 叶子：`packages/persistence/src/service.ts` 与 `packages/ws-replication/src/plugin.ts`。Registry（`namespace-registry/src/plugin.ts:137` 的 `ctx.timeout` 是 plugin-lifetime idle timer，非 root——**零触碰**，SA6 X3）、Persistence 核心（lifecycle/memory/file/contract/index/testing）、Replication 状态机（replication-protocol / hub-edge-host / hub-session-host / hub-connection / peer-connection 等）、业务 API 一律零改动（§11 DENY LIST + §15 机械 gate）。
- TS2576 消除机制 = 源码不再出现 `ctx.root` 属性访问（改 `Reflect.get(ctx, 'root')`，在两个互斥类型面上均合法）——**不是** cast 压静或 tsconfig 排除（O4 已否决；G9 机械封锁 tsconfig/vitest 配置面）。

### 5.4 生命周期语义不变（ADR 0006/0009/0012/0035 §3；AC3）

- **调度所有权**：解析结果仍是 Host root Context 的 TimerService（B1/B2 经 legacy 实例属性命中 root proxy；B3 经 symbol 命中 root）；`timeout` effect 仍注册在 TimerService 自己的 ctx（root）上，disposer 生命周期仍属 root fiber——ADR 0006 L86「Persistence 内部 timer 绑定 Host root Context 而非 adapter fiber」语义仅换通道不改所有权。
- **AC3 机制链零变化**（SA6 §8.1 五点全部保留）：`bindPersistenceAdapterLifecycle`（service.ts:93–116）有序 effect（revoke → await 依赖 settle → adapter.dispose()）不动；persistence fiber `UNLOADING` 窗口内 root fiber 仍活、`rootTimer.timeout` 仍可武装；`PersistenceLifecycle.dispose()` `clearTimers`（lifecycle.ts:1211–1217）经同一 disposer 面 cancel。R5P（`registry-sa7-rev1.test.ts:396–504`）在 B3 基线上从「saveDoc gate 后 reject」转绿即为可观察证明。
- **停机序**（ADR 0009 L99–L103 有序 disposer、ADR 0012 L5/L37「不销毁上游」）：seam 只改「如何找到 root Context」，不改任何 listener/dialer/controller/连接所有权，不新增对 Registry/Persistence/Clock/Timer 的销毁调用；ws-replication plugin 卸载仍先停自身网络接纳、撤自身 service。

### 5.5 无新配置/条件装配（AC9）

seam 只读 ctx 自身：无 `process.env`、无 baseline/通道参数、无 feature flag、无按工件版本分支的 import；`createMemoryPersistencePlugin`/`createFilePersistencePlugin`/`createDshPersistenceProfile` options 形状与默认装配序（clock → timer → persistence，`dsh-persistence/src/profile.ts:87–93`）零变化。`§15` gate G8 以 `rg` 形状检查 + `§13` AC9 行为判据双重持守。

### 5.6 主要备选方案与未选原因

| 备选 | 未选原因 |
|---|---|
| persistence/ws-replication 各新增一个私有 seam 文件（如 `src/root-channel.ts`） | 两处均被 R2 允许，但：两文件已是唯一 Cordis 接线叶子（service.ts 模块注释明示 DAG 地位；`timerFromContext` 已是孤立函数）；新文件会扩大 R7 diff allowlist、增加模块图节点且不能被 fixture 复用（R2「仅被 service.ts/plugin.ts import」使 fixture 无法 import 它），净收益为零。**A-3 注记**：若实现期改走此形态，G3 allowlist 须同步扩展并回 SA8 备案（实现期 OPEN 项，见 §21） |
| fixture import 生产 seam | 违反 R2 私有文件「仅被生产叶子 import」约束；fixture 用本地 `Reflect.get` helper 同样消除 TS2576（§6） |
| 把 root 校验并入 `assertPersistenceHostDependencies` | 会让 adapter 直连路径（memory.ts:199 / file.ts:143）在无 root 通道的 Context 上误炸，改变既有测试语义（C6） |
| `timer.ctx` 与 `ctx` 双 host 各自全量尝试后再决定 | 现「per-host symbol→legacy，host 间仅在皆缺席时级联」已与现状逐行为等价且 malformed 语义最严格 |
| 把「读取被拒」做成硬失败（不归一为缺席） | 违反 SA8 §3 裁定 + C-R4b 推进链（引入第四种结局）与冻结面（proxy 噪声升级为失败面）；见 §5.1 safeGet 显式裁定（B6） |

---

## 6. 设计决策：4 个具名 fixture 的迁移（R2）

迁移面**恰好** 10 处读取（C8）；harness 的 `ctx.rootValue`/`ctx.root('hub',…)`（`driver.ts:427`、`issue137-driver.ts:90,228`、`issue301` 等大量出现）是测试 harness 的 ROOT 值读取 helper，与 Cordis `Context.root` 无关——**一律不触碰**（判别标准：`ctx.root` 后无 `.`属性链且实参以 role 开头的调用形态 = harness helper；`ctx.root.timeout`/`{...ctx.root}`/`const root = ctx.root` = Cordis Root 读取）。

每个文件内联一个 ~4 行私有 helper（**不**新增共享 helper 文件——R7 allowlist 封闭为 plugin.ts + 4 fixture，多一个新文件即越权）：

```ts
/** Test-only root resolution mirroring the production seam precedence (ADR 0035 §2). */
function resolveRootForTest(ctx: Context): Context {
  return (Reflect.get(ctx, Symbol.for('cordis.root')) ?? Reflect.get(ctx, 'root')) as Context
}
```

两类改写：

1. **`effectTimer` 内 `const root = ctx.root`**（plugin.test.ts:41、issue422:44）→ `const root = resolveRootForTest(ctx)`。B1/B2 上与原值逐字节相同（legacy 返回 root proxy）；B3 上返回 symbol root——`root.effect` 语义不变。
2. **依赖 shim 的基线探测分支**（`if (typeof ctx.root.timeout === 'function') … else {…timer, ctx:{root:{...ctx.root, timeout}}} `；plugin.test.ts:24–25、issue299:173–177、issue422:83–84、guard-proxy:101–102）→ 删除分支，统一形态：

```ts
ctx.provide('timer', {
  timeout: timer.timeout,
  ctx: { [Symbol.for('cordis.root')]: { timeout: timer.timeout } },
} as never)
```

统一 shim 的正当性：生产 seam 在 `timer.ctx` 存在时以 symbol 优先解析——该 shim 在**任何**基线上都命中同一 fake root，行为与原「legacy 探测 + shim」在 B1/B2 完全等价（service 形状检查 + root.timeout 武装同一函数），并使 fixture 自身基线无关。「npm 基线必须命中 legacy 通道」的正控不依赖这些 unit fixture（它们本来就用 fake timer），由 §8.5 root-probe（真实 TimerService，无 shim）+ §8.6 real-timer/AC5 sentinel 承载。

R8 冻结面：`ws-replication-guard-proxy-consumption.test.ts` 只改 `dependencies()` 的 101–102 行；guard-Proxy 断言面（服务对象成员冻结/包装不变量，文件其余部分）**原样保留**，B1 必须继续全绿——**锚点 = §8.6 `ws-package` B1 cell**（该 cell 在 B1 workspace 内实际运行本文件；§8.6 `root-test` 默认布局全量复证。修正记录：iteration 0 曾把该锚点指向并不运行此文件的「AC6 B1 cell」，失实，已按 RA-1③ 改指）。

---

## 7. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| `memory.ts`/`file.ts` 插件工厂 `apply`（调用 `createCordisPersistenceScheduler`） | apply 期创建 scheduler，惰性读 `ctx.root` | apply 期同步解析+校验+捕获 rootTimer **对象引用**（方法调用形态武装，B1 纪律）；B1/B2 行为不变，B3 从「首次 saveDoc reject」变「正常工作」，root 缺席/畸形从「延迟噪声」变「apply 期稳定 throw」 | 零（签名/返回形状不变） | memory.ts:239、file.ts:280 |
| memory/file adapter `apply`（调用 `assertPersistenceHostDependencies`） | 只查 clock/timer service | 完全不变 | 零 | memory.ts:199、file.ts:143 |
| PersistenceLifecycle（`scheduler.setTimeout/clearTimeout`） | 同步要求 disposer | 不变（`PersistenceScheduler` 接口零变化；disposer 仍为 root fiber 效果） | 零 | lifecycle.ts:1111–1123, 1211–1217 |
| `dsh-persistence` profile（默认/注入 timeline 两形态） | 经插件工厂间接受益 | B3 上从「saveDoc reject」转绿；options/装配序不变 | 零 | profile.ts:75–93 |
| Registry 插件与 R5P | root-scoped TimerService + plugin 工厂 | B3 上 R5P `{ok:true}`/fatal null/事件序断言转绿 | 零 | registry-sa7-rev1.test.ts:396–504 |
| hub/peer replication plugin `apply`（`timerFromContext`） | `timer.ctx?.root ?? ctx.root` + 形状检查 | host 级联保留 + 每通道 symbol 优先 + malformed 立即 throw + null-host 守卫（F5）；B1/B2 逐行为等价，B3 从 apply 期 proxy throw 变 symbol 正常命中 | 仅 plugin.ts 内两函数 | plugin.ts:206–239, 454, 649 |
| `OwnedTimer` 消费者（hub/peer 连接与活性 timer） | 接口三方法 | 零变化（对象引用 + `rootTimer.timeout` 方法调用形态保持，C16/B1） | 零 | plugin.ts:200–239 |
| 4 个 fixture（§6） | legacy 探测分支 + `ctx.root` 读取 | 统一 symbol shim + 本地 helper；断言面（含 guard-Proxy）不变；**运行时回归由 §8.6 `ws-package` B1 cell 与 `root-test` 承载** | 每文件内联改写 | C8 行号清单 |
| `apps/yjs-server` | 组合根，零直接 root 读取 | 仅经 ws-replication/persistence 工厂间接受益；typecheck 转绿 | 零 | SA8 §1 清点（apps/ 零读取） |
| 既有负向测试（core-dsh-boundary A/B/C 等） | 断言既有文案 | 文案逐字节不变 → 断言继续绿 | 零 | core-dsh-boundary.test.ts:60–82 |

---

## 8. 设计决策 C：三基线验收设施

### 8.1 夹具根目录与 tracked/untracked 划分

```
packages/persistence/test/fixtures/cordis-baselines/   ← tracked（新增）
  baselines.json          # 三基线清单：npm 版本+sha512 integrity、DSH commit、期望通道/§12.3 probe 表、suite 文件清单
  provenance-b3.json      # R5 期望值：vendored 源文件 blob 哈希全表（git ls-tree -r <sha> -- vendor/{cordis,timer,cosmokit}）、构建配方、期望输出哈希、诚实标注
  public-surface.base.json# base 279dba4 的三个+1 entry 运行时导出名快照（capture 自 base worktree，流程见 §15 G5）
  acquire.mjs             # 幂等获取：npm tarball（HTTPS + integrity 复核）/ DSH sparse clone + 最小构建
  run-baseline.mjs        # 规范 runner（§8.8）
  root-probe.mjs          # 独立于生产 seam 的通道探针（只 import baseline Context/TimerService）
  gates.mjs               # 机械 gate（§15）
.cache/cordis-baselines/  ← untracked（.gitignore 既有 `.cache/` 覆盖，零 .gitignore 改动）
  npm/<pkg>@<ver>/        # tarball + 解包
  dsh/clone/              # sparse clone（--filter=blob:none --sparse，detach 1511a6e…）
  dsh/build/<pkg>/        # source-built lib/ + lib/types/
  workspaces/<B?>/        # 每基线临时 workspace（可复用、每 run 重建）
  evidence/<baseline>/<suite>.json   # ws-package 落 evidence/B1/ws-package.json；root-test 落 evidence/root-test/root-test.json
```

**`.gitignore` 决策：零改动。** overlay/证据/缓存全部落在已忽略的 `.cache/`（C9）；fixture 自身的 `node_modules`（如 acquire 解包布局需要）由既有 `node_modules/` 规则覆盖。代价说明：`packages/persistence/tsconfig.json` include `test/**/*.ts` 会把 fixture 下任何 `.ts` 纳入 typecheck——因此 fixture 脚本一律 `.mjs`（且不被 vitest `*.test.ts` include 收集）；唯一 `.ts` 面就是 4 个新 `.test.ts`（在 `test/` 直下，非 fixtures/ 内）。

### 8.2 B1/B2：npm tarball 获取 + integrity 复核

- 获取：`acquire.mjs` 经 registry HTTPS 下载 tarball（不依赖裸 `pnpm`；`npm` CLI 亦非必需——node 原生 fetch + `npm view` 不可用时直接 GET registry metadata，G16 缓解）。**integrity 以 `baselines.json` 钉死的 sha512 为准**（值取 SA6 附录 A：cordis 4.0.1 `sha512-YBdskTU2Po1kru3GgcUWUbkTsPMA9LkSQDAY8rBkFJeajdgcQad3QPJZE26JyK99Xb6HaASvoXg2DSUTeN/0Nw==`、timer 1.1.3 `sha512-IOkey1VNmJwYa5U8bksyMOnM7mtirqjjbWLr3xA8QybLMK0sMooG3a6iJwtvd8P3MFwo3FQibEg+JPixp37MEw==`、cosmokit 1.8.2 `sha512-muBOKtSrUKU5m/xpq8ZXWL6hQ/jgd4PhU2PqH97bcxIiLEJfNwZOGQEx4t/aS/GgxRAR+ra9pMHPMtTHU4sqqA==`、cordis 4.1.0 `sha512-CJrjNyBkKn1SfvBQUcgFYKFnLjS+uKrhdMsbHU60xabvi12d+xQ+IQSNlME5Z+B+4Zi6n4BDknKY94tEPeo47w==`、timer 1.2.0 `sha512-DTFp2IcK4Xnp0BWG546fwgeKjrBcSm9a9QjCtaV5Ko9hxiB/Cg03FINSNiR7OEbeg7/s4Y7QBxgQYFVYRl9V+g==`、cosmokit 1.9.0 `sha512-5O1S53mZiJyZYcvxxD0Qv1EY7qFPSxbGyD8CbVK6gw7W9FvcXZj2YIX1ZkOqyQQ3Xt2rFkZDHJv0+V3Zmmp8CA==`）。下载后本地重算 sha512 必须逐字节匹配；cache 命中也强制复核。
- `--ignore-scripts` 等价物：解包只取 `package/` 内容，不执行 lifecycle scripts（纯解压，天然满足）。
- 外部依赖闭包：overlay `node_modules/` 内联 cordis 的 `@deepseek-ai/cosmokit` + `@standard-schema/spec`（按 overlay cordis package.json 声明逐个获取并钉 integrity 到 `baselines.json`）；timer 的 cosmokit 同理。
- 网络失败/缺任一 tarball/integrity 不符 → `acquire` exit 2 响亮失败；**不得**用仓库默认 4.0.1/1.1.3 代替 B2（SA6 §15.2）。

### 8.3 B3：DSH clone + 最小 tsc source-build + 8 项 provenance（R5）

获取（幂等，全部失败即 exit 2，不用 npm 工件或 rc.3 checkout 顶替）：

```
git clone --filter=blob:none --no-checkout --sparse https://github.com/deepseek-ai/deepseek-harness.git .cache/cordis-baselines/dsh/clone
git -C clone sparse-checkout set vendor/cordis vendor/timer vendor/cosmokit tsconfig.base.json
git -C clone checkout --detach 1511a6ed442c207919142a4b0e6c4916f96d2c3b
# 断言：git rev-parse HEAD === 1511a6e…（精确）且 git status --porcelain 为空
```

构建（SA6 §9.2 配方为规范；tsc 用仓库 `node_modules/typescript` 5.9.3）：三包各自生成 tsconfig（`rootDir: src`、`outDir: lib`、`declarationDir: lib/types`、`declaration`、`allowImportingTsExtensions`、`rewriteRelativeImportExtensions`、`paths` 指向 vendored 依赖类型），产出 `lib/index.js` + `lib/types/index.d.ts`；overlay package 目录 = vendored `package.json`（exports 指向 `./lib/types/index.d.ts`/`./lib/index.js`，与 npm 形态一致）+ 构建产物。

R5 八项 provenance（`provenance-b3.json` tracked；运行时逐项复核，缺一即 AC4 红）：

| # | 项 | 落实 |
|---|---|---|
| 1 | commit 钉死 | clone `rev-parse HEAD` 精确等于 `1511a6e…` 且 `status --porcelain` 空；provenance `commit` 字段同值 |
| 2 | source blob 绑定 | `git ls-tree -r <sha> -- vendor/cordis vendor/timer vendor/cosmokit` 的 blob 哈希与 provenance **逐文件全表一致**（SA3 实现期从钉死 commit 生成全表并提交；SA6 附录 A 四个抽查值——`vendor/cordis/src/context.ts=951a0dda…`、`utils.ts=4337b9d6…`、`vendor/timer/src/index.ts=8d133e5c…`、`vendor/cosmokit/src/types.ts=0aab4420…`——作为生成正确性的交叉校验锚） |
| 3 | 构建配方 | build 命令、tsc/Node 版本、tsconfig 关键项（rootDir/outDir/declarationDir/rewriteRelativeImportExtensions/paths）完整记录于 provenance，可复现 |
| 4 | 输出哈希 | 三包 `lib/` 哈希与 provenance 一致——timer/cosmokit 源码与 npm 逐字节相同（C14），**realpath + output hash 是唯一区分通道** |
| 5 | 双位置解析断言 | §8.4/§8.5 |
| 6 | 运行时通道探针 | §8.5（symbol 命中、legacy 缺席、`Context.root === Symbol.for('cordis.root')`） |
| 7 | 负控实跑 | §8.7 四命令实际执行并断言内层 exit != 0，证据 `{expected:'fail', observed:'fail', code}` |
| 8 | 诚实标注 | provenance 明记「minimal tsc source-build，非 DSH 官方 tsdown 流水线」；版本元数据（4.1.0/1.2.0/1.9.0）只作辅助不作形态证明（R5/SA6 §12.1 B3⑥；O5 已否决官方流水线强求） |

B3 的 timer/cosmokit **必须来自 DSH 构建**（不得用 npm 1.2.0/1.9.0 tarball 顶替同名包）——由 #4 输出哈希 + #5 realpath 断言机械化（G18）。

### 8.4 临时 workspace materialize 与 workspace-link 重建（G6 修复 + B3/F3 + F7）

每基线一个隔离 workspace（`.cache/cordis-baselines/workspaces/<B?>/`），每次 run 重建：

1. **源树复制（物化清单 = 并集）**：`git ls-files -z`（仓库根）列出的 tracked 文件 ∪ **NEW_FILES 显式常量**（runner 内置 §11.1 N1–N11 的 11 条路径）。二者均按路径从**当前工作树**复制文件内容（非 index blob——TDD 步③时 M1–M6 未修改、步⑤时已修改，工作树内容即被测内容）。NEW_FILES 逐条 `fs.existsSync` 预检于源树：存在即复制；**任一缺失 ⇒ materialize exit 2 响亮失败并打印缺失清单**（不静默跳过）。理由（SA2 F3）：`git ls-files` 只见 tracked/index 文件，TDD 步③执行时 N1–N11 尚未 commit/add——没有并集，ws 内没有新测试文件，`fs.existsSync` 预检会把 D1–D7 判红为「文件缺失」而非目标原因红，红灯证据失真。
2. **workspace 依赖链接**（声明驱动，逐包重建）：
   - 对每个 `packages/*`、`apps/*`、`domains/*` 的 package.json `dependencies`+`devDependencies`：
     - `@nomicore/*`（workspace 协议）→ symlink 指向 workspace 内兄弟包目录；
     - `@deepseek-ai/{cordis,cordis-plugin-timer,cosmokit}` → symlink 指向**该基线 overlay 包目录**（这是唯一的基线差异点）；
     - 其余外部依赖（yjs、ws、lib0、y-protocols、@standard-schema/spec、@types/*…）→ 从**仓库现有安装**逐 realpath 解析后 symlink（版本与三基线无耦合）。
   - workspace 根 `node_modules/` 只放 `typescript`/`vitest`/`tsx`（symlink 至仓库 realpath）与必要的 `@types/*`；**禁止**出现任何 `@nomicore/*`（C13：否则 `core-dsh-boundary` 的 `import.meta.resolve('@nomicore/dsh-persistence')` 反向依赖守卫假红）；`packages/persistence/node_modules` 只含其声明依赖（无 dsh-persistence → 守卫真绿）。
3. **overlay 内部闭包**：`@deepseek-ai/cordis` 的 `cosmokit`/`@standard-schema/spec`、timer 的 `cosmokit` 在 overlay `node_modules/` 内解析（§8.2/§8.3）。
4. **命令入口**：vitest 以 `node <repo>/node_modules/vitest/vitest.mjs run --root <ws> --config <ws>/vitest.config.ts …`（config 内 alias 以 `import.meta.url` 相对 ws 解析 → ws 源码）；tsc 以 `node <repo>/node_modules/typescript/bin/tsc -p <project>`（cwd=ws）。全程不调用裸 `pnpm`（G16）。

**解析通道分析（SA2 F7）——runner 在 ws 布局不设 `NODE_OPTIONS=--conditions=nomicore-source`**：

- tsc 面：各包 tsconfig `extends ../../tsconfig.base.json`（相对解析，无 references/paths），`customConditions: ["nomicore-source"]` 使 `@nomicore/*` 走各包 exports 的 `nomicore-source` 条件命中 ws `src/index.ts`；
- vitest 面：`vitest.config.ts` alias 把 `@nomicore/*`（含 `/testing`、`namespace-runtime/internal`、`vfs3-assets`、`yjs-server`）钉到 ws `packages/*/src`；
- `@deepseek-ai/*` 面：overlay package.json `exports` 的 `types`/`default`/`import` 条件解析（overlay exports 无 `nomicore-source` 条件，`customConditions` 对其落空属预期——类型经 `types` 条件命中 B3 `lib/types/index.d.ts` 或 npm tarball 类型）。

因此 ws 内 tsc/vitest 命令**均不携带**该 env；根 `package.json` `scripts.test` 携带它服务于**根布局**的运行时解析路径（`vitest run --typecheck` 的根布局全量跑，见 §8.6 `root-test`，命令与根 script 逐字一致含该 env）。两处差异是**布局差异而非遗漏**：实现者不得在 runner 的 ws 命令里误加该 env（会掩盖 overlay exports 的实际解析事实），也不得因 runner 不设它而误删根布局命令里的它。

### 8.5 双位置解析断言 + 独立 root probe（AC4/AC5）

**双位置解析断言**（`cordis-baseline-provenance.test.ts`，测试开始时执行）：

- `@deepseek-ai/cordis` 与 `@deepseek-ai/cordis-plugin-timer`（persistence 的声明依赖）：从 test 模块（`import.meta.resolve`）与 `createRequire(dirname(packages/persistence/src/service.ts))` 两处 resolve → `fs.realpath` **必须相同**；runner 模式（env `NOMICORE_CORDIS_BASELINE_ROOT` 存在）额外断言 realpath 落在该基线 overlay 目录内（非 overlay 即红——`--fault fallback` 的判红点）；默认模式（仓库布局）断言两位置一致 + 版本匹配 `baselines.json` 的 B1 钉值。
- `@deepseek-ai/cosmokit`：persistence 未声明它（C12），从 persistence 两位置不可解析——按声明依赖事实改为**从已解析的 cordis 与 timer 包 realpath 位置**各 resolve 一次，两者 realpath 相同且（runner 模式）在 overlay 内。此为对 SA6 §12.1「三个包」的忠实精化：传递依赖经其声明者位置断言，不放松任一包的身份绑定。
- 附加：对 workspace 内每个声明 `@deepseek-ai/cordis` 的包位置 resolve 并收集 realpath 集合 —— 必须恰为 1 个（无第二份 cordis 可达，SA6 B1⑥）。

**独立 root probe**（`root-probe.mjs`，runner 在 suite `root-probe` 内直接执行）：只 dynamic-import overlay 的 `Context`/`TimerService`，只用 `Reflect` + `Symbol.for('cordis.root')`，**不 import** `service.ts`/`plugin.ts`/任何 `@nomicore/*` 内部（AC7 判据 (e)：probe 只在 test/fixtures、不被生产 import）。逐项断言 SA6 §12.3 表：

| 观察项 | B1/B2 期望 | B3 期望 |
|---|---|---|
| root ctx `Reflect.get('root')` | root context | `undefined` |
| root ctx `Reflect.get(Symbol.for('cordis.root'))` | `undefined` | root context |
| plugin fiber `Reflect.get('root')` | root（原型继承） | `undefined` 或 throw `cannot get property "root" without inject` |
| `Context.root` static | `undefined` | `=== Symbol.for('cordis.root')` |
| 命中通道的 `.timeout` | function | function |

**生产通道选择**（sentinel，`cordis-root-channel.test.ts`）：在可记录 getter/计数 timer 下断言 B1/B2 只 arm legacy、B3 只 arm symbol（legacy getter 读取数=0）——「精确命中期望通道」，不接受「至少命中一个」。

### 8.6 行为 suites（AC2/AC3/AC6 行为面 + B1 包门禁执行载体）

| suite | 文件 | 要点 |
|---|---|---|
| contract | `packages/persistence/test/*.test.ts` **全目录 glob（动态求值）** | **A-1 口径**：base 上 19 个既有文件；N1–N4 落地后同目录为 23 个 `.test.ts`——suite 按 glob 收集**当时**目录内全部 `.test.ts`（不含 `.test-d.ts` 与 testkit helper），新文件被 contract 与各自专属 suite 双跑（幂等无害），**不用硬编码文件数**；`--passWithNoTests=false` + 按 glob 结果逐文件存在检查 |
| real-timer | 新 `cordis-root-real-timer.test.ts` | 基线 × {memory,file} × {flush, retry, drain, dispose, service-revoke}；真实 baseline `TimerService`（instrument `TimerService.prototype.timeout` 计 arm/dispose，**patch 必须先于 TimerService 构造/provide**——timer 经 `ctx.mixin` 在 provide 期捕获绑定，事后 patch 原型可能不被拦截；若时序不可控，以**等价可观察计数**替代——SA6 hedge 恢复，见 F8）；deadline 5s 的 waitFor 谓词轮询（禁固定轮数）；vitest `--repeat 3`，任一 repeat 红即红；File retry 用「snapshot 路径预置目录使 rename 确定性失败」（POSIX）制造 degraded，Memory 用 store hook 前 2 次失败；dispose 后 pending=0、drain 后 stale 到期零新增写（ADR 0006 #412 修订：drain 不清调度面） |
| dsh-profile | `packages/dsh-persistence/test/dsh-profile-acceptance.test.ts` | 默认与注入 timeline 两形态，三基线 |
| unload | `packages/namespace-registry/test/registry-sa7-rev1.test.ts` 全文件（含 R5P） | JSON reporter 断言测试名 `R5P.` 存在且 passed；gate/deferred 拉开 UNLOADING 窗口（SA6 §7 竞态纪律，文件内已实现） |
| provenance | 新 `cordis-baseline-provenance.test.ts` | §8.3–§8.4 全部断言 |
| root-probe | `root-probe.mjs` + 新 `cordis-root-channel.test.ts` | §8.5 + §13 AC1 全判据（含 B6 两条 pin） |
| **ws-package**（B2/RA-1 新增） | **恰好 4 个具名 fixture 文件**（§11.1 M3–M6）：`packages/ws-replication/test/ws-replication-plugin.test.ts`、`ws-replication-issue299-ac-red.test.ts`、`ws-replication-issue422-listen-false.test.ts`、`ws-replication-guard-proxy-consumption.test.ts` | **B1 专属 cell**：在 **B1 workspace** 内实际运行 4 文件（vitest `--root <ws>` 逐文件指定 ×4）；`--passWithNoTests=false` + 逐文件 `fs.existsSync` 预检；JSON reporter 落证据 + 每文件测试计数。承载 AGENTS L25–L26「focused tests」件套与 R8「guard-Proxy B1 必绿」锚点（§6/§16）。**不整目录跑**：把 B1 门禁耦合到无关测试的健康度（整目录覆盖由 root-test 承载）。B2/B3 上运行本 suite 属允许的附加证据（R3：非验收条件）；`--all --matrix` 只对 B1 列标记必绿 |
| **root-test**（B2/RA-1 新增） | 仓库**默认布局**全量 vitest：`NODE_OPTIONS=--conditions=nomicore-source node <repo>/node_modules/vitest/vitest.mjs run --typecheck`（cwd = 仓库根；命令与根 `scripts.test` 等价、逐字保留 env，不调裸 pnpm——G16；仓库现成安装缺失 ⇒ 响亮 exit 2） | **基线无关 cell（baseline='default'）**：AGENTS L26「根 test」件套——默认 B1 安装下全仓测试（含 4 个新 persistence 测试、全部 ws-replication 测试与 4 个被迁移 fixture 的默认布局运行）。证据 `.cache/cordis-baselines/evidence/root-test/root-test.json`（exit code + 测试计数 + logPath）；**任何红 ⇒ 该 cell 红 ⇒ 交付阻断**（§14 步⑤/§17） |

suite 执行顺序在 runner 内固定为 provenance → root-probe → contract → real-timer → dsh-profile → unload（SA6 §12.1「测试开始时先做身份断言，再跑行为」；单跑某 suite 时不涉顺序）；`ws-package` 依 B1 workspace；`root-test` 独立于基线 workspace（默认布局）。

### 8.7 四个负控（`--fault`，必须实际执行并断言内层 exit != 0）

| fault | 实施 | 必须的判红 |
|---|---|---|
| `--baseline B3 --fault fallback` | workspace 链接 `@deepseek-ai/*` 改指仓库默认安装（4.0.1/1.1.3） | provenance/real-timer/root-probe 内层红：realpath 落 overlay 外 + 版本/通道错配（B3 期望 symbol、实得 legacy） |
| `--baseline B3 --fault substitute-npm` | 仅 cordis 链接改指 npm 4.1.0 tarball | provenance 红（blob/output hash/realpath）+ probe 红（legacy 命中而期望 symbol；同名同版本 4.1.0 不能作为通过依据） |
| `--baseline B2 --fault substitute-rc12` | 仅 cordis 链接改指 DSH 构建 | provenance 红（npm integrity 不符）+ probe 红（symbol 命中而期望 legacy） |
| `--baseline B3 --fault legacy-shim` | 运行 channel 测试时注入测试侧 shim：在受控 ctx 上定义 legacy `root` 属性（env `NOMICORE_CORDIS_FAULT=legacy-shim`，仅测试代码读取） | B3 形状断言「legacy 缺席/legacy 零读取」必须红——证明通道断言不可被 legacy shim 蒙混（SA6 §6.2-7/§13.3；C-R4d）。**F9 落实**：env 注入的 shim 与被判红的「legacy 缺席」形状断言必须作用于**同一受控 ctx**——channel 测试从 env 读取 fault 后，在该测试自建的受控 ctx 上**同时**完成 shim 注入与形状断言，二者不跨对象、不跨进程；外层语义（observed='pass' → exit 1）保证不会假绿 |

`--fault` 命令的外层语义：materialize 被污染的 workspace → 执行目标 suites → **断言内层进程 exit != 0** → 写证据 `{expected:'fail', observed:'fail'|'pass', code}` → 外层 exit 0 当且仅当 observed='fail'（负控通过=被污染运行确实失败）；observed='pass'（负控意外通过）时外层 exit 1。SA6「断言 exit != 0」指被记录进证据的内层 code。

### 8.8 Runner 输出契约与聚合（`run-baseline.mjs`）

- 单命令：`node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs --baseline <B1|B2|B3> [--mode typecheck] [--suite <name>]… [--fault <name>]`；`--suite ws-package` 仅对 `--baseline B1` 为验收 cell（B2/B3 可跑、记附加证据）；`--suite root-test` 不需要 `--baseline`（默认布局，evidence 记 `baseline: 'default'`）；`--all --matrix` 聚合。
- 每 cell 证据 JSON（SA6 §12.5 契约逐字）：`{ baseline, suite, status: pass|fail, resolvedRealpaths, provenanceDigest, testNames, logPath }`，写 `.cache/cordis-baselines/evidence/<baseline>/<suite>.json`；`ws-package` cell 额外记录逐文件存在性预检结果；`root-test` cell 记录 vitest exit code 与汇总计数。
- `--mode typecheck`（R1 严格读法）：在 ws 内对根 `scripts.typecheck` 的 **15-project 清单**逐个 `tsc -p`（清单从根 package.json 解析，不得内置副本后漂移），每 project 一条日志与 exit code；任一 project 红即该 cell 红；**禁止**子集/删项/skip/skipLibCheck 扩张/cast 掩蔽/以默认 node_modules 类型面冒充（O1/O2/O4 已否决；G9 机械封锁 tsconfig/vitest 配置载体零 diff）。
- vitest 调用统一：`--passWithNoTests=false` + 每目标文件 `fs.existsSync` 预检（路径写错≠绿）；JSON reporter 落证据、default reporter 落 log；断言目标测试名存在且 passed（unload 的 `R5P.`）。**materialize 侧存在性预检（§8.4 步 1 NEW_FILES 并集）先于本预检**——红灯阶段的「文件缺失」在 materialize 即响亮失败，不会流到测试面伪装成测试红。
- `--all --matrix`：3 基线 × 全部基线 suites + typecheck + **B1 专属 `ws-package`** + 基线无关 `gates` + 基线无关 `root-test`，输出完整矩阵；**任一 cell fail 或缺失 → exit != 0；绿不得抵销红**（owner L26/ADR 0035 §5 L82）。
- 离线/cache 语义：cache 命中仍强制 integrity/output-hash/ls-tree 复核（B2 的 tarball、B3 的 clone 与构建产物）；网络/构建失败一律响亮 exit 2，无任何降级路径（§18）。

---

## 9. 数据流路线

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| Root 通道解析（生产，无新数据） | plugin `apply(ctx)`（memory/file 工厂、hub/peer plugin） | apply 闭包捕获 `rootTimer` **对象引用**（B1 纪律） | `safeReadChannel(symbol) ?? safeReadChannel('root')`（窄 try/catch，C-R4a），双类型面合法 | 无（内存） | scheduler `setTimeout` / `OwnedTimer.setTimeout`（均以 `rootTimer.timeout(cb, ms)` 方法调用武装） | B1/B2 arm legacy root timer；B3 arm symbol root timer | 缺席/畸形/读取皆拒/宿主非对象 → apply 期稳定 throw，service 未提供；无 ambient 兜底 | §13 AC1/AC5 行 |
| dirty→flush 调度 | `saveDoc` → `scheduleFlush`（lifecycle.ts:1111–1123） | debounce/maxDirty/retry timer（root fiber 效果面） | 不变（仅 arming 的通道来源换形） | 无 | store 写计数/snapshot | deadline 内最新 generation snapshot 提交 | dispose `clearTimers` 幂等清理 | AC2/AC3 |
| 三基线工件获取 | `acquire.mjs` | `.cache/…/npm/*`、`dsh/clone`、`dsh/build/*` | tarball 解包 / sparse clone / tsc 最小构建 | 仅本地 `.cache/`（gitignored） | overlay realpath + provenance | 每基线唯一、可复核的 cordis/timer/cosmokit | 任一环节失败 exit 2，无替代工件 | AC4/AC8 |
| workspace 物化 | `run-baseline.mjs` | `.cache/…/workspaces/<B>` | tracked 源树 ∪ NEW_FILES（§8.4 步 1）+ 声明驱动 symlink farm | 本地 | vitest/tsc 以 `--root ws` 消费 | 基线隔离的测试/typecheck 执行 | 每 run 重建；NEW_FILES 缺失 exit 2；假红守卫（C13）持守 | AC6 |
| 证据 | runner 每 cell | `.cache/…/evidence/**.json` | JSON 契约（§8.8） | 本地（不写 tracked `artifacts/`） | SA10 核销 / `--all` 聚合 | 矩阵全绿或非零 exit | cell 缺失视为失败 | AC1–AC9 |

无持久化布局、wire、schema、快照格式变化（ADR 0035 §4；AC8）。

---

## 10. 错误、恢复、并发与幂等

- **失败语义**：root 通道失败 = apply 期同步 `Error`（稳定单句，§5.2；含双通道读取皆拒的归一结局与宿主非对象守卫）；timer/clock service 失败 = 既有文案不变；无新异步失败面、无新取消语义。AC3 的 notify-dirty-failed fatal 升级路径（`namespace-runtime/src/write.ts:214–226`）在 B3 上由「saveDoc reject」消除为正常 resolve。
- **重试/退避**：persistence 既有 retry backoff、degraded→ready 恢复、drain/dispose 幂等全部不动；seam 只换 arming 来源。
- **并发**：解析在 apply 同步段完成（无线程交互）；捕获的 `rootTimer` 对象引用（经方法调用形态武装，`this` 绑定与 TimerService 生命周期一致）与 Host 接线契约 R1/#15 一致：先装 timer、后停 persistence——service.ts:11–17 注释语义原样。
- **幂等**：acquire/clone/build/workspace 全部幂等可重跑；evidence 每 run 覆盖写。

---

## 11. 设计决策 A：封闭改动清单（ALLOW / DENY）

### 11.1 ALLOW LIST（tracked 改动 = 6 修改 + 11 新增）

| # | 路径 | 类型 | 承载 |
|---|---|---|---|
| M1 | `packages/persistence/src/service.ts` | 修改 | persistence seam（§5.1）；AC1/AC2/AC3/AC6/AC9；R4；消除 service.ts:54 TS2576 |
| M2 | `packages/ws-replication/src/plugin.ts` | 修改 | ws-replication seam（§5.1）；R2/R4；AC6（plugin.ts:214 ×3 TS2576）；B1 包门禁对象 |
| M3 | `packages/ws-replication/test/ws-replication-plugin.test.ts` | 修改 | fixture 迁移 :24,25,41；R2；AC6（×3 TS2576）；`ws-package` cell 运行对象 |
| M4 | `packages/ws-replication/test/ws-replication-issue299-ac-red.test.ts` | 修改 | fixture 迁移 :173,177；R2；AC6（×2）；`ws-package` cell 运行对象 |
| M5 | `packages/ws-replication/test/ws-replication-issue422-listen-false.test.ts` | 修改 | fixture 迁移 :44,83,84；R2；AC6（×3）；`ws-package` cell 运行对象 |
| M6 | `packages/ws-replication/test/ws-replication-guard-proxy-consumption.test.ts` | 修改 | fixture 迁移 :101,102；R2；AC6（×2）；R8（guard-Proxy 断言面原样保留，`ws-package` B1 cell 必绿） |
| N1 | `packages/persistence/test/cordis-root-channel.test.ts` | 新增 | AC1 全判据 + AC5 生产通道 sentinel + AC9 默认 options 用例 + B6 两条 pin（read-throw 归一） |
| N2 | `packages/persistence/test/cordis-root-real-timer.test.ts` | 新增 | AC2 三基线 × 两 adapter × 五场景（真实 Timer） |
| N3 | `packages/persistence/test/cordis-baseline-provenance.test.ts` | 新增 | AC4/AC5 身份断言（双位置 realpath、版本/integrity/output-hash、无第二份） |
| N4 | `packages/persistence/test/cordis-public-surface.test.ts` | 新增 | AC7 runtime 导出面快照（含 `@nomicore/ws-replication` entry，R7(c)） |
| N5 | `packages/persistence/test/fixtures/cordis-baselines/baselines.json` | 新增 | §8.1/§8.2（integrity 钉值、期望通道表、suite 清单）；AC4/AC5 |
| N6 | `packages/persistence/test/fixtures/cordis-baselines/provenance-b3.json` | 新增 | R5 八项的期望值载体；AC4 |
| N7 | `packages/persistence/test/fixtures/cordis-baselines/public-surface.base.json` | 新增 | base 279dba4 快照（capture 自 base worktree，流程 §15 G5）；AC7 |
| N8 | `packages/persistence/test/fixtures/cordis-baselines/acquire.mjs` | 新增 | §8.2/§8.3 获取+构建；AC4/AC8 |
| N9 | `packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs` | 新增 | §8.4/§8.6–§8.8 runner（含 NEW_FILES 常量、ws-package/root-test cell）；AC2–AC6 |
| N10 | `packages/persistence/test/fixtures/cordis-baselines/root-probe.mjs` | 新增 | §8.5 独立探针；AC5 |
| N11 | `packages/persistence/test/fixtures/cordis-baselines/gates.mjs` | 新增 | §15 机械 gate（G1′/G2–G9）；AC7/AC8；R7/RA-2 |

理由小结：seam 选择「`service.ts`/`plugin.ts` 内收口」而非新私有文件——见 §5.6；fixture 用文件内联 helper 而非共享文件/生产 import——见 §6；`.gitignore` **零改动**（C9）。

### 11.2 DENY LIST（零改动清单，gate 机械化于 §15）

| 路径/类别 | 与任务的关系 | 禁止原因 |
|---|---|---|
| `pnpm-lock.yaml`、根与所有包 `package.json`（全部 `packages/*`、`apps/*`、`domains/*`） | 依赖面 | AC8/ADR 0035 §4/R7(d)；G1′ 扩展 pathspec 机械承载；fixture 安装只落 `.cache/` |
| `artifacts/**` | 历史证据 | AC8/ADR 0035 §4；证据只写 `.cache/` |
| `docs/**`（含 `docs/adr/` 全部） | 规范面 | 「不修改 ADR 追认实现」（SA6 §17.8；SA8 §6）；gate G7 |
| `packages/persistence/src/{index,contract,lifecycle,memory,file,testing}.ts` | Persistence 核心 | AC7（byte-identical）；cast 不扩散（R4）；含 memory/file:24–29/33–37 失实注释（G20）的修正**不在本票**（见 §19 残余） |
| `packages/persistence/src/index.ts`、`packages/ws-replication/src/index.ts` | 公共导出面 | R7(b)/ADR 0035 §2「不新增公共 export」；gate G4/G5 |
| `packages/namespace-registry/src/**`、`packages/dsh-persistence/src/**` | Registry/DSH | AC7；`plugin.ts:137` 的 `ctx.timeout` 是 plugin-lifetime idle timer，非 root（X3） |
| `packages/replication-protocol/**`、`packages/ws-replication/src/**` 中 plugin.ts 以外全部（hub-edge-host/hub-session-host/hub-session-async-host/hub-connection/peer-connection/…）与 `test/**` 中 4 fixture 以外全部 | Replication 状态机/协议/冻结面 | R2「其余文件零改动」；ADR 0035 §2 L56；R7(a) allowlist（G3） |
| `apps/**` | yjs-server | R3（行为不在范围）；typecheck 经 ws 覆盖 |
| `CONTEXT.md`、`domains/**`、其余 `packages/*/src/**`（clock/instance/doc-runtime/namespace-runtime/namespace-api/namespace-diagnostic-log/vfsl*/…） | 无关或间接受益 | SA8 §1 清点：零直接读取；无需改动 |
| `.gitignore` | 忽略策略 | C9 已覆盖；改它即扩大 diff（dispatch 要求单列说明——本设计选择不改） |
| `tsconfig.base.json`、`tsconfig.typecheck.json`、`vitest.config.ts`、根/各包 tsconfig | 测试/构建配置 | R1 禁 tsconfig 变更掩蔽；runner 以外部命令覆写 `passWithNoTests`，无需改 config；**G9 零 diff 机械封锁（RA-2）** |
| 根/各包 `package.json` scripts | 测试/构建命令面 | R1/G1′；root-test 步骤以等价 vitest 命令直跑，不改 scripts |

---

## 12. （并入 §8/§11/§15）

---

## 13. 设计决策 E：AC → 证据映射矩阵（供 SA10 逐条核销）

`<runner>` = `node packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs`。

| AC | 测试文件 / 测试名 | 命令 / cell |
|---|---|---|
| AC1 | `cordis-root-channel.test.ts`：`symbol 合法时优先：legacy 零读取、仅 symbol timer 武装（sentinel）`；`symbol 缺席时 legacy 兜底：flush 正常完成`；`symbol 存在但 timeout 非 function：apply 同步 throw 稳定文案，legacy 零读取`；`双通道皆缺席：apply 同步 throw 同一稳定文案`；`双通道读取皆被 Proxy 拒绝：apply 同步 throw 同一稳定文案（read-rejected 归一，D10）`；`symbol 读取抛错 + legacy 可读：归一为缺席，arm legacy，proxy 异常零泄漏（safeGet pin，D11）`；`timer service 缺失/形状不符：apply 同步 throw 既有文案`（两例）；`sentinel：未 fire 的 timer capability 不发生 flush（无 ambient timer）`；既有 `core-dsh-boundary.test.ts:60–82` 负向 A/B/C 原样保留 | `<runner> --baseline B1|B2|B3 --suite root-probe`；默认聚焦命令（SA6 §12.5-1） |
| AC2 | `cordis-root-real-timer.test.ts`：`flush/retry/drain/dispose/service-revoke` × {memory,file} describe 块（arm>0、dispose 后 pending=0、drain 后零新增写断言内嵌） | `<runner> --baseline B1|B2|B3 --suite real-timer`（`--repeat 3`） |
| AC3 | `registry-sa7-rev1.test.ts` 既有 `R5P. persistence 卸载排空在途写…`（零改动，三基线重跑）+ JSON 断言 `R5P.` 名存在且 passed | `<runner> --baseline B1|B2|B3 --suite unload` |
| AC4 | `cordis-baseline-provenance.test.ts`：`工件身份：版本+integrity/输出哈希+realpath 双位置一致`；`B3：clone commit/clean、ls-tree blob 与 provenance-b3.json 全表一致、构建配方记录完整`；`无第二份 @deepseek-ai/cordis 可达` | `<runner> --baseline B3 --suite provenance`（B1/B2 同 suite） |
| AC5 | `root-probe.mjs`（§8.5 表逐项）+ `cordis-root-channel.test.ts` 基线形状与 sentinel 块；负控 `<runner> --baseline B3 --suite provenance,root-probe --fault fallback`、`--fault substitute-npm`、`--baseline B2 --fault substitute-rc12`、`--baseline B3 --suite root-probe --fault legacy-shim`（shim 与形状断言同一受控 ctx，§8.7） | 如左四命令（外层 exit 0 当且仅当内层红） |
| AC6 | `<runner> --baseline <id> --mode typecheck`（15 project × 3，逐 project 日志）+ suites `contract|real-timer|dsh-profile|unload`；**ws-replication 运行面 = `<runner> --baseline B1 --suite ws-package`（4 个被迁移 fixture 在 B1 workspace 实跑）+ `<runner> --suite root-test`（默认布局全量 vitest，含全部 ws-replication 测试）**；聚合 `<runner> --all --matrix` | 3×(typecheck+5 基线 suites) + ws-package@B1 + root-test + gates cells |
| AC7 | `cordis-public-surface.test.ts`（三 entry+ws entry 快照 vs `public-surface.base.json`）；`gates.mjs` G2/G3/G4/G5/G9 | `<runner> --all --matrix`（gates cell）；`node …/gates.mjs` 可独立重跑 |
| AC8 | `gates.mjs` G1′（扩展 pathspec：lock + 根 + 全部 `packages/*`/`apps/*`/`domains/*` 的 package.json + artifacts）/G6/G7 + runner 命令白名单（只调 node/tsc/vitest/git/registry GET）+ `git status --porcelain artifacts/` 空 | `<runner> --all --matrix`（gates cell） |
| AC9（derived，L17） | `cordis-root-channel.test.ts` `默认 options：无新增配置即 boot + saveDoc`；`dsh-profile-acceptance` 默认 options 路径；`gates.mjs` G8（rg 生产 src 无 env/flag/条件分支）；options 类型面经 public-surface 快照间接锁定 | `<runner> --all --matrix`；G8 |

---

## 14. 设计决策 D：TDD 红灯设计（SA3 执行序）

实施序：① 建 N5–N11 夹具设施（无生产改动）→ ② 写 N1–N4 红灯测试 → ③ 在 **base HEAD**（seam 未实现；N1–N11 为**未 tracked 的工作树文件**——§8.4 步 1 的 `git ls-files` ∪ NEW_FILES 并集使 ws 物化含新文件）跑矩阵取证红灯 → ④ 实现 M1/M2 + 迁移 M3–M6 → ⑤ 全矩阵 + gates + **`--baseline B1 --suite ws-package`** + **`--suite root-test`（默认布局全量）**全绿 → ⑥ SA10 核销。

**红灯证据纪律（B3/F3）**：步 ③ 每条红灯证据必须双记录——(i) 文件存在性前置断言通过（materialize 的 NEW_FILES 逐条预检 + vitest 逐文件 `fs.existsSync` 预检均过，evidence JSON 记 `filesPresent: true`）；(ii) 失败断言/错误与下表「目标原因」列一致（错误文案/失败测试名比对）。**missing-file 红一律判为无效证据**：修复 runner/materialize 后重跑，不得记账为红灯证据。materialize 侧任一 NEW_FILE 缺失 ⇒ exit 2 响亮失败（§8.4），使「文件缺失」不可能流入测试面伪装成测试红。

红灯清单（文件 + 测试名 + 目标原因 + base HEAD 各基线预期）：

| # | 测试 | 目标原因（红在哪） | base+B1 | base+B2 | base+B3 |
|---|---|---|---|---|---|
| D1 | channel › symbol 优先 sentinel | base 代码恒读 legacy：symbol 在场仍 arm legacy、legacy getter 读取>0（功能缺失型红，与基线无关） | 红 | 红 | 红 |
| D2 | channel › symbol 存在但 timeout 非 function → apply 同步 throw | base 无 apply 期校验：scheduler 创建成功，legacy 被 arm，无 throw | 红 | 红 | 红 |
| D3 | channel › 双通道皆缺席 → apply 同步 throw | base 只查 timer service，apply 成功 | 红 | 红 | 红 |
| D4 | real-timer › B3 全场景 | base 在 B3 首次 saveDoc reject（SA6 §5.1 3/3：root ctx TypeError / fiber proxy Error） | 绿 | 绿 | **红（目标原因）** |
| D5 | unload R5P @ B3 | gate 释放后 `writePromise` 非 `{ok:true}`/fatal 非 null | 绿（SA6 实测 30 tests） | 绿（SA6 §5.2 npm 4.1.0 最小 saveDoc 绿 ⇒ 预期绿，SA3 首跑确证） | **红（目标原因）** |
| D6 | dsh-profile @ B3 | profile 直 apply root ctx，saveDoc reject | 绿 | 绿（同 D5 依据） | **红（目标原因）** |
| D7 | `--mode typecheck` @ B3 | 13 TS2576（service.ts:54 ×1 + ws-replication ×12，SA6 §9.4） | 15/15 绿 | 绿（SA6 实测） | **红（目标原因）** |
| D8 | provenance @ B2/B3 | 夹具建立前红于「工件缺失」；建立后 base HEAD 上即绿（身份断言不依赖 seam） | 绿 | 绿（建夹具后） | 绿（建夹具后） |
| D9 | channel › legacy 兜底 / timer service 负向 / sentinel 不自走 | 既有行为 pin（base 即绿），防回归 | 绿 | 绿 | legacy 兜底例在 B3 经受控 ctx 构造（见下） |
| D10（B6 新增） | channel › 双通道读取皆被 Proxy 拒绝 → apply 同步稳定 throw（read-rejected 归一为缺席） | base 无 apply 期解析：scheduler 创建成功，首个 `setTimeout` 处 proxy 噪声泄漏（非稳定文案） | 红 | 红 | 红 |
| D11（B6 新增 pin） | channel › symbol 读取抛错 + legacy 可读 → arm legacy（safeGet 归一 pin） | 既有行为 pin（base 恒读 legacy、从不读 symbol，base 即绿）——**防实现者把 read-throw 误做成硬失败或异常泄漏（那会使本 pin 红）** | 绿 | 绿 | 绿 |

「红在 base、绿在 npm」的依据即 SA6 §5.2/§9.4/§13.1–13.2（引用如上）；D5/D6 的 B2「预期绿」由 SA3 首跑落证。合成通道形态（symbol 注入/删除、malformed、双缺席、读取抛错）在测试内以 **Proxy 包装的受控 ctx** 构造（只拦截 `Symbol.for('cordis.root')`/`'root'` 两个 key，其余转发真实 ctx）——不依赖 Cordis `Context` 内部 Proxy 行为（C4），三基线同构可得；B3 的「symbol 缺席」用包装隐藏 symbol 通道实现（不删真实属性）；「读取抛错」用包装对目标 key 的 `get` trap 直接 throw 构造。红灯→绿灯判据：D1–D3、D10 在 seam 实现后全基线绿（symbol 优先/malformed throw/双缺席与读取皆拒同归一 throw）；D4–D7 在 seam + fixture 迁移后 B3 转绿且 B1/B2 不回退；D8/D9/D11 恒绿。反证敏感性（SA6 §13.3）：把 seam 改回 legacy-only ⇒ D1 必红；把 safeGet catch 做成硬失败/异常泄漏 ⇒ D11 或 D10 必红（B6 pin 的存在意义）；换 npm 4.1.0 工件 ⇒ AC5 B3 断言必红；删 dirty 调度 ⇒ D5 必红；overlay 回退 ⇒ D8 必红；新增公共 export ⇒ N4 必红。

---

## 15. 设计决策 F：机械 gate 脚本化（`gates.mjs`，R7 补齐 + RA-2）

`BASE = 279dba4ac81b7c7520e3d0b87b5c4d621a86a517`；每条 gate 非零即失败（`set -e` 语义），由 `gates.mjs` 顺序执行，作为 matrix 的 `gates` cell（基线无关，`--all` 必含）并可独立 `node …/gates.mjs` 运行；失败时打印 gate 编号与 diff 摘要后 exit 1。

| Gate | 检查 | 失败即 exit != 0 于 |
|---|---|---|
| G1′（RA-2 扩展） | `git diff --exit-code $BASE -- pnpm-lock.yaml package.json 'packages/*/package.json' 'apps/*/package.json' 'domains/*/package.json' artifacts/`。**R7(d)「gate #1 原样保留」的保义论证**：原 SA6 §12.4 #1 pathspec（pnpm-lock/根+三包 package.json/artifacts）的每一项都保留在扩展集内，零 diff 义务一项不减——「原样 = 不放松」指不得放松既有义务，超集只加面不放松；全仓 manifest 本就是 AC8「不改变 dependency/peerDependency 归属」的忠实读法（`domains/vfs3-assets`、`apps/yjs-server` 的 package.json 亦入零 diff） | 任一 manifest/lock/artifacts diff |
| G2 | `git diff --name-only $BASE..HEAD -- packages/persistence/src packages/dsh-persistence/src packages/namespace-registry/src` ⊆ `{packages/persistence/src/service.ts}` | 出现其它文件（lifecycle/memory/file/contract/index/testing/registry src/**） |
| G3（R7(a)） | `git diff --name-only $BASE..HEAD -- packages/ws-replication` ⊆ `{src/plugin.ts}` ∪ 4 个具名 test 文件（§11.1 M2–M6） | ws-replication 任何其它路径 diff |
| G4（R7(b)） | `git diff --exit-code $BASE -- packages/ws-replication/src/index.ts packages/persistence/src/index.ts` | 公共 entry 任何 diff |
| G5（R7(c)，行为化） | `cordis-public-surface.test.ts`：`Object.keys(import(…)).sort()` 对 `@nomicore/persistence`、`@nomicore/persistence/testing`、`@nomicore/dsh-persistence`、**`@nomicore/ws-replication`** 四 entry 与 `public-surface.base.json` 严格相等。**快照 capture 流程（F6/A-2/A-5 落实，五步，全程 trap 兜底清理）**：① `git worktree list --porcelain` 预检——存在陈旧 `.worktrees/base-snapshot` ⇒ 响亮失败并打印清理指引（`git worktree remove`/`prune`），不静默复用；② `git worktree add --detach .worktrees/base-snapshot $BASE`；③ 在 base worktree 内为 4 个 entry 包建**最小声明驱动 symlink farm**（复用 §8.4 步 2 机制）：`@deepseek-ai/*` 与外部依赖 symlink 至**主仓 realpath** 解析的默认安装（base worktree 自身无 node_modules，Node 上溯解析不可达——A-2 缺口即在此），`@nomicore/*` 不需链接——以 `node --import <主仓>/node_modules/tsx` + `NODE_OPTIONS=--conditions=nomicore-source` 经各包 exports 的 `nomicore-source` 条件直载 base worktree 自身 `src/`；④ 逐 entry `Object.keys(import(...)).sort()` 写 `public-surface.base.json`（快照值 = 导出名集合，不受加载方式影响）；⑤ `git worktree remove --force .worktrees/base-snapshot`（失败路径也清理） | 任一 entry 导出名集合变化 |
| G6 | `git diff --check` 干净；`git status --porcelain artifacts/` 为空 | whitespace 残留 / artifacts 污染 |
| G7 | `git diff --exit-code $BASE -- docs/ docs/adr/` | ADR/文档追认 |
| G8（AC9 形状） | `rg -n "process\.env|CORDIS_BASELINE|ROOT_CHANNEL|rc\.12" packages/persistence/src packages/dsh-persistence/src packages/ws-replication/src` 零命中（最终仍以 §13 AC9 行为判据为准） | 生产 src 出现 baseline/通道环境分支 |
| **G9（RA-2 新增）** | `git diff --exit-code $BASE -- tsconfig.base.json tsconfig.typecheck.json vitest.config.ts 'packages/*/tsconfig.json' 'apps/*/tsconfig.json' 'domains/*/tsconfig.json'`——tsconfig/vitest 配置面零 diff，机械化 R1 反掩蔽条款（skip/skipLibCheck 扩张/include 删项/新增 paths 掩蔽的载体全在 tracked tsconfig/vitest.config）。**豁免注记**：`packages/ws-replication/tsconfig.json` 同时落在 G3 的包树 allowlist 与 G9 的零 diff pathspec 内——G9 严格更紧（零 diff ⊂ allowlist），二者无冲突，SA8 RA-2 建议的豁免被更紧的超集自然吸收（对它零 diff 即最严检查），故 pathspec 原样保留不豁免 | 任一 tsconfig/vitest.config diff |

执行位置：`<runner> --all --matrix` 的 `gates` cell（任一 gate 红 ⇒ cell 红 ⇒ 聚合非零）；SA10 亦可单跑 `node packages/persistence/test/fixtures/cordis-baselines/gates.mjs`（exit 0 = 全过）。

---

## 16. 设计决策 G：R8 冻结面清单

| 冻结面 | 持守方式 |
|---|---|
| `ws-replication-guard-proxy-consumption.test.ts` guard-Proxy 断言面 | 迁移仅触 `dependencies()` :101–102；服务成员冻结/`Object.defineProperty` 拒绝/包装不变量断言**原样**；**B1 必绿——锚点 = §8.6 `ws-package` B1 cell**（该 cell 在 B1 workspace 内实际运行本文件；`root-test` 默认布局全量复证。RA-1③ 修正：iteration 0 曾锚在「AC6 B1 cell 即证」，该 cell 不运行此文件，锚点失实，已改指） |
| 两 replication 服务对象访问器 + `Object.freeze` 构造（ADR 0023 L45 纪律） | `plugin.ts` 改动仅限 `timerFromContext` + 新私有解析函数；服务构造体零触碰（G3 diff 范围 + code review） |
| `nomicoreHubReplication`/`nomicoreHubSessionHost` 互斥入口、公共工厂 append-only（ADR 0032 经 AGENTS L21 收录） | 同上；`src/index.ts` 零 diff（G4） |
| persistence 公共导出面（index/contract/lifecycle/memory/file/testing byte-identical） | G2 allowlist + G5 快照 |
| 既有错误文案四条（§5.2 表） | 文案常量零改动；既有断言测试不回退 |
| wire 协议/帧布局/状态机 | ws-replication 改动不触协议文件（G3）；Replication 行为矩阵不在本票（R3） |

---

## 17. 设计决策 H：Controller 交付清单（精确 `git add`）

**tracked 修改（6）**：`packages/persistence/src/service.ts`、`packages/ws-replication/src/plugin.ts`、`packages/ws-replication/test/ws-replication-plugin.test.ts`、`packages/ws-replication/test/ws-replication-issue299-ac-red.test.ts`、`packages/ws-replication/test/ws-replication-issue422-listen-false.test.ts`、`packages/ws-replication/test/ws-replication-guard-proxy-consumption.test.ts`。

**tracked 新增（11）**：`packages/persistence/test/cordis-root-channel.test.ts`、`packages/persistence/test/cordis-root-real-timer.test.ts`、`packages/persistence/test/cordis-baseline-provenance.test.ts`、`packages/persistence/test/cordis-public-surface.test.ts`、`packages/persistence/test/fixtures/cordis-baselines/{baselines.json, provenance-b3.json, public-surface.base.json, acquire.mjs, run-baseline.mjs, root-probe.mjs, gates.mjs}`。

**交付验证序（RA-1②/B2(b)——全部命令已在上文定义，证据统一落 `.cache/cordis-baselines/evidence/`）**：

1. `<runner> --all --matrix` 全绿 = 3 基线 ×（typecheck + provenance/root-probe/contract/real-timer/dsh-profile/unload）+ **`ws-package` @ B1** + **`root-test`（默认布局，`NODE_OPTIONS=--conditions=nomicore-source node <repo>/node_modules/vitest/vitest.mjs run --typecheck`）** + `gates`（G1′–G9）——任一 cell fail 或缺失 ⇒ exit != 0，绿不得抵销红；
2. `node …/gates.mjs` 独立重跑 exit 0（G9 含 tsconfig/vitest.config 零 diff）；
3. **失败语义**：`root-test` 或 `ws-package` 任一红 ⇒ 交付阻断（AGENTS L26「根 test」/L25「focused tests」件套不满足），修复后重跑，不得以矩阵其余绿抵销。

**不提交**：`.cache/cordis-baselines/**`（gitignored：tarball/clone/build/workspaces/evidence——证据由 SA10 现场重跑或读 logPath 复核）；`.worktrees/base-snapshot`（G5 capture 临时 worktree，五步流程用毕即删，含 trap 兜底）。**无 `.gitignore` 改动、无 marker 文件（REPORT.md/.mabf-done）、无 package.json/lock/artifacts/docs 改动**——与 §11 DENY 一致，G1′–G9 全绿即机械证明。

---

## 18. 设计决策 I：风险与不可验收边界（每条响亮失败策略）

| # | 风险 | 策略 |
|---|---|---|
| I1 | B3 网络（DSH clone / registry）或构建失败 | acquire/build 任一失败 → exit 2 + 明确 stage 标注；**不得**以 npm 4.1.0、旧 rc.3 checkout 或仓库默认件顶替（ADR 0035 明禁 rc.3 POC）；cache 命中仍复核 rev-parse/porcelain/ls-tree/output-hash |
| I2 | 真实 Timer deadline 抖动（慢机/CI） | 全部等待用 deadline 5s 的谓词轮询（禁固定轮数 settle）；real-timer `--repeat 3` 全过才算绿；超时即该 cell 红——不用 fake timer 顶替验收 |
| I3 | File retry 的 POSIX rename 依赖（目录占位法） | 依赖 POSIX rename 语义；非 POSIX 平台该 cell 响亮失败并在 evidence 记录平台，**不得 skip**（SA6 §15.3-6） |
| I4 | pnpm/corepack 版本不匹配（G16） | runner/脚本只调 `node <repo>/node_modules/{typescript,vitest}/…` 与 `node <repo>/node_modules/typescript/bin/tsc`；tarball 下载用 node 原生 fetch；root-test 以等价 vitest 命令直跑不经 pnpm；全链路零裸 `pnpm`/`npm` 依赖 |
| I5 | 同名工件替换（G18：timer/cosmokit 源码与 npm 逐字节相同） | 只靠 realpath 包含性（§8.4/§8.5）+ 构建输出哈希（R5-4）+ ls-tree blob 全表（R5-2）区分；`--fault substitute-npm` 实测判红 |
| I6 | 「不宣称 Replication rc.12 行为兼容」（R3） | 证据矩阵（§13）无任何 Replication 行为 cell；ws-replication 交付 = 编译面（typecheck cells）+ seam 语义（channel sentinel 不入其行为套件）+ **B1 包门禁四件套，载体明确**：focused tests ⇒ §8.6 `ws-package` cell（4 fixture 于 B1 ws 实跑）；包 typecheck + 根 typecheck ⇒ §8.8 `--mode typecheck` 15-project cell（B1 列，清单含 ws-replication 与全部 15 project）；根 test ⇒ §8.6 `root-test`（默认布局全量）。总结性表述一律「编译面绿 + seam 语义正确」 |
| I7 | Node 版本（G17：DSH root engines ≥24.9） | 本设计不运行 DSH 官方流水线，仅以仓库 tsc 构建 vendored 源；构建/运行 Node 版本记入 provenance；当前环境 Node 24.13 满足 |
| I8 | 历史 registry 元数据漂移（SA6 §15.3-7） | integrity 以 tracked `baselines.json` 钉死值为准，不信任运行时 registry 元数据；tarball-by-integrity 是最强可行绑定 |
| I9 | 恶意宿主缓存篡改 | 超出威胁模型（SA6 §15.3-3）；本设施防「误解析/误替换/回退」，不防有写权限的蓄意伪造 |
| I10 | 真实 MABF/DSH 部署、patch 移除 | ADR 0035 §6 明确排除；runner 命令白名单无 `dsh`/部署/patch（AC8(e)） |

残余（任务内不解决、显式 follow-up，不伪装完成）：memory.ts:24–29 / file.ts:33–37 注释仍写 `ctx.timeout`（实际经 root 通道解析）——修正需触碰 AC7 冻结的 byte-identical 文件，留待后续文档票；Replication 三基线行为矩阵、yjs-server 三基线行为（R3 后续票）；ADR 0035 状态由「提议」转「已实施」的更新归实施票/发布收官，不在本票（SA6 §17.8）。

---

## 19. 复现和根因承接 / SA8 约束落实

### 复现和根因承接

| 上游事实 | 证据位置 | 设计响应 |
|---|---|---|
| rc.12 上 boot 成功、首次 saveDoc reject（两形态 3/3） | SA6 §5.1 | §5.1 apply 期同步解析+校验替代惰性读取；D4/D5 红灯 |
| 失败根因 = rc.12 Root 公共面缺席 + 仅读 legacy | SA6 §8 步 2–4；C1/C4 | §5.1 seam 双形态；§8 三基线验证 |
| timer `timeout` 体依赖 `this.ctx.effect`（detach 即延迟 TypeError） | C15（本会话复核 timer 1.1.3 lib）；SA2 F1/E1 | §5.1 捕获形态纪律：对象引用 + 方法调用，明文禁 detach（全文统一） |
| 版本号/同名不可判据；timer/cosmokit 逐字节相同 | SA6 §9.1/§9.3（C14） | §8.2 integrity 钉值、§8.3 R5-2/4、I5 |
| 既有测试假绿（core-dsh-boundary 无 saveDoc；fake timer 绕 root） | SA6 §10.2 F3/F5/F6（G19） | §8.6 real-timer suite 补真实通道面；contract suite 保底 |
| R5P 是 AC3 最重要锚且 B3 预期红 | SA6 F8 | §8.6 unload suite 三基线重跑（测试文件零改动） |
| ws-replication 12 TS2576 阻塞严格 AC6 | SA6 §15.1（G13） | R1+R2+R3 已裁决；§5.1/§6 迁移；D7 |
| memory/file 注释与实现不符 | SA6 P5（G20） | 不修（AC7 byte-identical）；§18 残余记录 |

### SA8 约束落实（R1–R9 逐条）

| 决议 | 设计位置 | 处理方式 | 需设计后冲突复查 |
|---|---|---|---|
| R1 AC6 严格读法 | §8.8 `--mode typecheck`；§14 D7；**§15 G9** | 15 project × 3 基线逐 project 留证；禁子集/掩蔽/冒充；**G9 把 tsconfig/vitest.config 面零 diff 机械化（RA-2），skip/skipLibCheck/include 删项等掩蔽载体全部封死**；G1′ 同步扩展 manifest 面 | **是**（SA8 §10(c)/§13(c)：gates.mjs 新执法面首次落地属实现后核对项） |
| R2 迁移面封闭 | §5.1（M1/M2）、§6（M3–M6）、§11.1、G2/G3 | 恰好 service.ts/plugin.ts + 4 fixture；harness helper 零触碰（判别标准见 §6） | **是**（SA8 §10(b)/§13(b)：实现后以实际 diff 核对是否守住 allowlist——OPEN 项见 §21） |
| R3 角色边界 | §1 非目标、§13（无 Replication 行为 cell）、I6、§8.6 `ws-package`/`root-test` | 编译面 + seam 语义 + **B1 包门禁四件套（每件有执行载体：`ws-package` cell / 15-project typecheck cell / `root-test` cell）**；无行为宣称；RA-1①②③ 全部落实（cell + 根 test + 锚点改指） | 否 |
| R4 seam 决策形态 | §5.1–§5.4（含 C-R4a–d 映射表、safeGet 判据与显式裁定、捕获形态纪律、F5 守卫） | symbol 优先 → legacy 兜底；apply 期同步 loud fail（稳定单句 §5.2）；malformed/宿主非对象不回落；双缺席（含读取皆拒归一）throw；无 ambient；能力形状仅 `timeout`；cast 只在两 seam 叶子；捕获对象引用 + 方法调用武装（禁 detach）；所有权/生命周期不变 | **是**（新失败语义，SA8 §10(a)；F4/F5/B6 裁定一并入复查面） |
| R5 B3 provenance 8 项 | §8.3 表 | 逐项落实；最小构建诚实标注 | 否 |
| R6 AC 账本 | §4 表 | 8 checkbox + AC9 derived 引 L17 | 否 |
| R7 机械 gate 补齐 | §15 G1′/G2–G9（G3/G4/G5 即 R7(a)(b)(c)；G1′ 为 (d) 保义扩展；G9 为 RA-2 反掩蔽） | gates.mjs + matrix cell + 独立可跑 | **是**（新执法面，SA8 §10(c)） |
| R8 ADR 0023 冻结面 | §6、§16 | guard-Proxy 断言面原样；**B1 必绿锚点 = `ws-package` B1 cell（实跑本文件）+ root-test 复证**；访问器/freeze/互斥入口/公共工厂不动 | 否 |
| R9 升级状态 | §18 I6/I10；无阻塞升级项 | advisory 仅在 owner 表态「零 ws-replication diff」时激活（届时回门禁复审） | 否 |

---

## 20. 评审修订映射（iteration 1）

两份评审逐条核销表。F=SA2 设计评审 finding（`task_issue-470_sa2_review.md` §13/§14）；RA/A/C-R=SA8 设计后冲突复查（`task_issue-470_design_conflict_report.md` §11/§3）。

| Finding | 修订位置 | 处理结果 |
|---|---|---|
| **F1**（MAJOR，措辞与骨架矛盾 → detach 复刻故障形态）= B1 | §5.1「捕获形态纪律」节（新增，全文统一）；§5.1 两处骨架注释（persistence `rootTimer.timeout(callback, delayMs)` ✅ / detach ❌ 示例 + 理由）；§5.1 persistence bullet L121 改「捕获 `rootTimer` 对象引用（非 detach 函数引用）」；§7 调用方矩阵两行；§9 数据流行；§10 并发节；§2 新增 C15（timer `this.ctx.effect` 事实）与 C16（OwnedTimer 现状即对象引用+方法调用）；ws-replication 骨架注释（C16 同规） | **已修**：全文只剩「捕获对象引用 + 方法调用形态武装」一种表述，detach 形态明文禁止并写明理由（C15）。核销面：SA2 F1 acceptance = 文本修订（本节）+ 实现期 code review 两处 seam 方法调用形态 + real-timer 三基线绿（§13 AC2 行） |
| **F2**（MAJOR，B1 包门禁无运行承载）= B2(a)(c) | §8.6 suite 表新增 `ws-package` 行（B1 专属 cell：B1 workspace 内实跑 4 具名 fixture，`--passWithNoTests=false` + 逐文件 `fs.existsSync` 预检，纳入 `--all --matrix` 与证据 JSON `evidence/B1/ws-package.json`）；§8.8 runner 契约；§13 AC6 行；§14 步⑤；§16 首行锚点改指该 cell；§6 末段锚点同步；§17 交付验证序；§18 I6 四件套载体；§19 R3/R8 行 | **已修**（RA-1①③ 一并）：4 个被迁移 fixture 与 guard-Proxy 冻结面在 B1 上有实跑载体，锚点失实问题消除。核销面：SA2 F2 acceptance + SA8 RA-1①③ |
| **F2/RA-1②** 根 test 步骤 = B2(b) | §8.6 `root-test` 行（默认布局全量：`NODE_OPTIONS=--conditions=nomicore-source node <repo>/node_modules/vitest/vitest.mjs run --typecheck`，与根 `scripts.test` 等价、不调裸 pnpm）；§8.8（`--suite root-test`，baseline='default'，证据 `evidence/root-test/root-test.json`）；§14 步⑤；§17 交付验证序（含失败语义：任一红 ⇒ 交付阻断，不得抵销） | **已修**：命令、证据落位、失败语义三者明确。核销面：SA8 RA-1② |
| **F3**（MAJOR，物化清单漏未提交新文件）= B3 | §8.4 步 1 重写：物化清单 = `git ls-files` ∪ NEW_FILES 显式常量（runner 内置 N1–N11 路径，存在即复制、缺失 exit 2 响亮失败并打印清单；按工作树内容复制）；§8.8（materialize 预检先于 vitest 预检）；§14 新增「红灯证据纪律」段（`filesPresent` 双记录 + missing-file 红不得记账） | **已修**：红灯阶段的文件缺失在 materialize 即响亮失败，不可能流入测试面伪装目标原因红。核销面：SA2 F3 acceptance（未 commit 工作树上执行步③，D1–D7 红因与目标原因列一致）——实现期由 SA3 落证、SA10 复核（§21 OPEN） |
| **F4**（safeGet 语义判据化；requiresConflictRecheck 新增理由）= B6 | §5.1「safeGet 判据与显式裁定」节：通道存在性 = 读取成功且值非 nullish；「symbol 读取抛错 + legacy 可读」显式裁定 = 归一为缺席 → arm legacy（与 C-R4b 推进链自洽，不引入第四种结局）；补 pin 用例 D11（+ read-rejected 双拒 D10）；AC1(a) sentinel 保留为 R4 字面运行时锚；可达性说明（三基线实测 symbol 读从不抛） | **已修**：裁定明确且与 C-R4a–d 自洽，实现者无猜测空间。核销面：SA2 F4 (i)(ii)(iii) 三点全落；F4 失败语义面并入 §21 复查申报 |
| **F5**（null host 守卫） | §5.1 骨架 `tryResolveRootTimer` 首行守卫（宿主非对象 → 立即稳定 throw）；§5.1「宿主非对象（F5）」bullet（含与现状 `?.` 的行为对比注记：`undefined` 仍级联、`null` 收紧为 loud fail——合成畸形形态，真实基线与 fixture 不可达）；ws-replication 骨架注释；§5.2 文案表两行补「宿主非对象共用该文案」 | **已修**（一行守卫语义收进 `tryResolveRootTimer` 首行） |
| **F6**（G5 capture 执行细节）+ **SA8 A-2** | §15 G5 五步流程：worktree list 预检 → `worktree add --detach` → base worktree 内最小声明驱动 symlink farm（`@deepseek-ai/*`/外部依赖 symlink 至主仓 realpath——base worktree 无 node_modules，A-2 缺口即在此；`@nomicore/*` 经 tsx + `--conditions=nomicore-source` 直载 base worktree src）→ 逐 entry `Object.keys(import()).sort()` 写快照 → trap 兜底 remove | **已修**：capture 的依赖解析有明确载体；快照值不受加载方式影响的论证保留 |
| **F7**（解析通道分析 + NODE_OPTIONS 差异） | §8.4 新增「解析通道分析」段：tsc 靠 `customConditions`、vitest 靠 config alias、`@deepseek-ai/*` 靠 overlay exports——ws 布局 runner 不设该 env；根 `scripts.test` 携带它属根布局路径（root-test 命令逐字保留）；「布局差异而非遗漏，防误加/漏加」双向写明 | **已修** |
| **F8**（instrument 时机 + hedge） | §8.6 real-timer 行：`TimerService.prototype.timeout` patch **必须先于 TimerService 构造/provide**（mixin 期捕获绑定，事后 patch 原型可能不拦截）；恢复 SA6「（或等价可观察计数）」hedge | **已修** |
| **F9**（legacy-shim 同一受控 ctx） | §8.7 `--fault legacy-shim` 行 F9 落实句：shim 注入与「legacy 缺席」形状断言作用于同一测试自建受控 ctx，不跨对象/不跨进程；外层语义防假绿不变 | **已修** |
| **F10**（行号漂移） | §2 C4 行改符号事实锚定（`Context` 构造器内 `this.root = self`、`Context.root` static）+ 行号注记：外部工件行号随安装副本漂移，后续产物以符号事实为准 | **已修** |
| **RA-1**（SA8，B1 门禁载体 + 锚点失实） | 同 F2 三项：`ws-package` cell（RA-1①）+ root-test（RA-1②）+ §6 末段与 §16 首行锚点改指（RA-1③）；§19 R3/R8 行同步 | **已修**（三小项全落） |
| **RA-2**（SA8，tsconfig/vitest 面机械 gate） | §15 G9 新增（pathspec 原样 + ws-replication tsconfig 豁免被更紧超集吸收的注记）；G1 → G1′ 扩展全部 `packages/*`/`apps/*`/`domains/*` package.json + R7(d)「原样 = 不放松」保义论证；§11.2 tsconfig 行补 G9；§13 AC7/AC8 行；§19 R1/R7 行 | **已修** |
| **A-1**（contract suite 口径） | §8.6 contract 行：全目录 glob 动态求值（base 19 → N1–N4 落地后 23 个），新文件双跑幂等无害，不用硬编码文件数 | **已修** |
| **A-2**（G5 capture 依赖解析） | 同 F6（§15 G5 步 ③） | **已修** |
| **A-3**（seam 文件形态 → G3 扩展备案） | §5.6 备选表 A-3 注记 + §21 OPEN 项（实现期若改走私有 seam 文件形态，G3 allowlist 须同步扩展并回 SA8 备案；本设计维持 in-file 收口，当前一致） | **已吸收为 OPEN 约束**（非本稿可核销——其触发条件在实现期） |
| **A-4**（「捕获」措辞统一） | 同 F1：§5.1 捕获形态纪律全文统一（对象引用 + 方法调用），§7/§9/§10 同步；全文无第二形态表述 | **已修** |
| **A-5**（worktree 检查/清理纪律） | §15 G5 步 ①（`git worktree list --porcelain` 预检 + 陈旧项响亮失败与清理指引）+ 步 ⑤（trap 兜底 remove）；§17 不提交清单补「含 trap 兜底」 | **已修** |
| **C-R4a** | §5.1 C-R4a–d 映射表第 1 行 + 骨架 `safeReadChannel`（try/catch 收窄到单次 `Reflect.get`；`assertRootTimerShape`/级联/最终 throw 均在 catch 之外） | **已修**（原样收录 + 实现映射） |
| **C-R4b** | 映射表第 2 行 + §5.1 优先级/级联 bullet + B6 裁定（read-rejected 归一后只推进：同 host 另一通道 → 下一 host → 最终稳定单句 throw；无 ambient/globalThis/子 ctx 兜底） | **已修** |
| **C-R4c** | 映射表第 3 行 + §5.1 骨架出口分析（catch 唯一动作 = 通道缺席；seam 出口仅「已验证 rootTimer」或「稳定 throw」，无 undefined 泄漏给调用方继续运行） | **已修** |
| **C-R4d** | 映射表第 4 行 + §8.5 sentinel + §8.7 legacy-shim（F9 同 ctx 落实）+ §13 AC5 行保留 | **已修** |

**未吸收项：无。** 全部 F1–F10、RA-1、RA-2、A-1–A-5、C-R4a–d 均已落实或转为显式 OPEN 约束（仅 A-3，其触发条件在实现期）。

---

## 21. 是否需要设计后 ADR 冲突复查 + 实现期 OPEN 项

**requiresConflictRecheck: true**，与 SA8 §10/§13、SA2 §2 一致：

- (a) 两个生产 seam 引入新失败语义（Root 通道缺席/形状不符/宿主非对象/双通道读取皆拒的 apply 期同步 loud fail + 新稳定文案 + safeGet 读取失败归一语义）——失败语义决策面；**SA2 F4/F5 与 B6 显式裁定属该面，一并入复审范围**；
- (b) ws-replication 为本票新增的第二生产包改动面，其实际 diff 是否守住 R2/R7 allowlist 需在**实现后**核对；
- (c) R7 机械 gate（含本次新增 G9 与 G1′ 扩展）为新增执法面，首次落地属实现后核对。

本设计未触碰任何 wire/schema/持久化布局/状态机语义（§9），不需 ADR 修订或新 ADR（SA8 §6：无演进要求）。

**实现期（而非设计期）核销的 OPEN 项——本稿不假装已核销**：

1. **实际 diff 面复查**（SA8 §13(b)）：实现后以 implementation 复查核对 M1–M6 实际 diff 是否守住 §11.1/G2/G3/G9 allowlist；G2/G3/G9 绿是机械面，seam 代码语义面仍需复审。
2. **gates.mjs 首次落地执行核对**（SA8 §13(c)）：G1′–G9 在真实工作树上首次运行；G5 capture 五步流程（base worktree symlink farm + tsx/conditions 直载）的可行性在实现期验证——失败语义 = 响亮非零 exit 并打印 stage，不得静默降级为静态读源码。
3. **A-3 约束**：若实现期改走 R2 允许的「单个包内私有 seam 文件」形态，G3 allowlist 必须同步扩展并回 SA8 备案（本设计维持 in-file 收口）。
4. **红灯证据落证**（SA2 F3 acceptance）：SA3 在未 commit 的工作树上执行 §14 步③，逐条记录 D1–D7/D10 的「红因 = 目标原因」双记录；SA10 复核。D5/D6 的 B2「预期绿」由 SA3 首跑确证。
5. **B1/F1 实现核对**：code review 核对两处 seam 均为 `rootTimer.timeout(callback, delayMs)` 方法调用形态（无 detach）；real-timer 三基线绿为运行时佐证。
6. **F8 instrument 时机**：SA3 实现 real-timer suite 时确认 patch 先于 TimerService provide（或采用等价可观察计数并记录选择）。

---

## 附：关键输入已读清单

`wiki/raw/task_issue-470.md`（owner 原文，Comments 空）；`wiki/raw/task_issue-470_sa6_acceptance_contract.md`（全文，含 §4.1/§5/§6/§9/§10/§12/§13.3/§15/§16/附录 A）；`wiki/raw/task_issue-470_conflict_report.md`（全文，R1–R9/O1–O7/§5 冻结面）；**`wiki/raw/task_issue-470_sa2_review.md`（全文，§13 F1–F3/§14 F4–F10/§12/§16 verdict reject）；`wiki/raw/task_issue-470_design_conflict_report.md`（全文，§2 R1–R9 核销表/§3 特别裁定 C-R4a–d/§11 RA-1/RA-2/A-1–A-5/§12 verdict reject）**；`docs/adr/0035`（逐字）、`0006`（L86/§412 修订）、`0009`（L99–L103）、`0012`（L5/L33–L37）、`0023`（决策/冻结面）、`CONTEXT.md`（服务表面词条）；根/persistence/dsh-persistence/ws-replication/namespace-registry `AGENTS.md`（ws-replication L25–L26 Verification = B1 包门禁四件套依据）；源码：`service.ts`（全文）、`plugin.ts:200–244, 440–470, 640–660`（`timerFromContext` 与 `OwnedTimer` 现状）、`memory.ts:225–260`、`file.ts:265–300`、`lifecycle.ts:760–780, 1108–1126, 1205–1220`、`profile.ts:75–105`、4 fixture 具名行、R5P（:396–504）、`vitest.config.ts`、根 `package.json`（`scripts.test` 的 `NODE_OPTIONS=--conditions=nomicore-source`/`scripts.typecheck` 15 project）、`tsconfig.base.json`（`customConditions`）、`tsconfig.typecheck.json`、`persistence/tsconfig.json`、各包 package.json 依赖面与 manifest 位置（G1′ pathspec 核对）、npm cordis 4.0.1 `src/context.ts`（符号事实）、**timer 1.1.3 `lib/index.js` `timeout(...args)` 体（`this.ctx.effect` 依赖，C15）**、`.gitignore`。
