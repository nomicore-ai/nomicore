# SA6 诊断与验收契约 — Issue #337 `[shape-budget] T4: DeepOptional 预算读类型面`

- 派发：`sa-d4cbc6b1-d724-49bd-aef8-f502c2e9a639`（role `mabf-sa6`，phase `acceptance-contract`，iteration 0）
- Worktree：`/home/wangjian/nomicore-fix-issue-337`（branch `mabf/issue-337`，HEAD `cb8aaff0297a802432ba7532a407c65218852dce`；T0 #333 / T1 #334 / T2 #335 / T3 #336 均已合入，本票 Blocked-by #336 已解除）
- 任务类型：**Feature**（ADR-0024 决策 7 已接受、类型面未落地 = 能力缺口；不虚构 Bug 根因）
- 派发约束：**只做诊断与契约定义，不实现代码、不落盘可执行测试**——红在 HEAD 由临时最小探针实跑证明（§5/§13），契约断言组与测试路径在本报告钉死（§12），测试文件由下游实现迭代落盘
- 上游：SA8 冲突门禁 `clear`（no-conflict 13 / implements-existing-decision 8 / evolution 0 / hard-conflict 0）+ `requiresConflictRecheck=true`；Issue comments REST 读取为空（无 Owner 要求、无可应用 override）

## Verdict

`approve` —— 能力缺口已证实且可用最小探针稳定呈现：`DeepOptional` 在协议导出面**不存在**（tsc checker 实测 12 名，无该名；全仓 `*.ts` 零命中，仅 ADR-0024 / CONTEXT.md 有词），预算读价值列在 HEAD 恒为 `unknown`（runtime/lease 预算重载现状，零结构感知），协议类型面无任何可表达「全字段可选」的名目（临时 test-d 经真实 vitest typecheck 入口报 `TS2305 ... has no exported member 'DeepOptional'`）。SA8 两条核心义务已逐条落为契约断言组：**协议导出覆盖**（G1.7：实测导出面新增第 13 名且 `PROTOCOL_EXPORT_NAMES` 同变更集跟名——探针实测今日以 `DeepOptional` 为领域别名 `generateProjection` **静默产出**，若协议加名而名单未跟，既有碰撞守卫 `silent` 清单必为 `['DeepOptional']` → 红）与**无 options 基线零降级**（G2：legacy 联合 `value: unknown` / 五键形状 / `ReturnType` 末签名锁 / `_readAlias` 系 Equal 锁 / `VfslTypedAccess.read` 的 `PathValue<PathAt<…>>` 承诺逐点指纹化）。负控在 HEAD 全绿（root typecheck exit 0；root 350 files / 3841 tests；四包 107 files / 979 tests；全 test-d 31 files / 164 tests；`generate --check` exit 0）。AC3 判别字段 narrowing 由临时模型实测：**TS 5.9.3 支持**可选化判别字段的 `switch`/`if` 窄化（唯一 TS2322 证明窄化后成员独有字段为 `T | undefined`，非 TS2339），退路当前不需启用（若启用须 test-d 红灯 + 票内记录）。ADR 未逐字钉死的实现自由位（载体语义、数组元素表示、落点接缝、命名泛型化）在 §15 列为 SA1 必须收口的设计 pin，并映射 SA8 后置 recheck。**无 blocker。**

---

## 1. 任务类型与输入

| 输入 | 路径 | 用途 |
|---|---|---|
| 任务简报 | `wiki/raw/task_issue-337.md` | Issue #337 正文「What to build」+ AC1–AC4；`Comments` 段为空 |
| Issue-comments REST 快照 | 派发说明（REST 刷新） | 空——无 owner 评论要求、无 comment ID/时间戳可应用 |
| SA8 冲突门禁 | `wiki/raw/task_issue-337_conflict_report.md` | Verdict `clear`；§8 required actions 1–4；§10 `requiresConflictRecheck=true`（a 公共类型面/重载落点、b 判别字段条件退路、c 名单跟名/Equal 锁/生成物零漂移/负向锚） |
| SA8 决议摘录 | `wiki/raw/task_issue-337_relevant_decisions.md` | ADR 0024/0004/0005/0016/0008/0009/0003 条款行号摘录 + 模块 AGENTS + 现状事实 |
| 母法（本票直接授权） | `docs/adr/0024-readdata-shape-budget.md` L91–95、L113、L127、L130 | 决策 7 全段（无 options 承诺 L91 / 带 options 类型 L92 / typed 纪律 L93 / 判别联合附注 L94 / 写前快照禁令 L95）+ 备选否决 L113 + 类型面验收行 L127 + 影响包门禁 L130 |
| 落点包母法 | `docs/adr/0004-vfsl-protocol-type-projection.md` L20–32、L24–28、L36、L44–48 | D2 联合投影宽度与 JS 原生窄化、D3 纯类型零运行时零依赖、D4 test-d 装置（正例 `expectTypeOf` / 负例 `@ts-expect-error`）、D5 路径含根 |
| 生成面纪律 | `docs/adr/0005-projection-generation-pipeline.md` L43–55/L65；`domains/AGENTS.md` | 生成物入仓 + `generate --check` 新鲜度；协议包不含生成器；零 per-schema 生成 |
| 读域与代理面 | `docs/adr/0008-...md` L16–27；`docs/adr/0009-...md` L38；`docs/adr/0016-...md` L69/L77 | 读语义（经 0024 修订）、lease 只代理同步读取、always-on 与加法兼容 |
| 冻结面 | `docs/adr/0003-evaluator-derived-schema.md` L46；`docs/adr/0024` L115 | ValueSchema 9-kind 冻结；`kind:'truncated'` 已否决（DeepOptional 是 TS 映射类型，零接触） |
| 术语面 | `CONTEXT.md` L45–47 | 「形状预算」词条已含 `DeepOptional<PathAt<…>>` 口径与 Avoid 项（无需新词条） |
| 模块契约 | `packages/vfsl-protocol/AGENTS.md`、`packages/vfsl-codegen/AGENTS.md`、`packages/namespace-runtime/AGENTS.md`、`packages/namespace-registry/AGENTS.md`、`domains/AGENTS.md`、根 `AGENTS.md` | 纯类型空模块、公共兼容契约、负例 test-d、协议 wiring 变更跑 root 门、生成物禁手改、typed-access 纪律 |
| 现状实现锚 | `packages/vfsl-protocol/src/index.ts`（157 行，L59 `PathAt`/L72 `PathValue`/L118 `VfslTypedAccess`/L157 `VfslPathMap`）；`packages/vfsl-codegen/src/protocol-surface.ts` L13–16；`packages/namespace-runtime/src/runtime.ts` L148/L151/L163/L166/L214–220；`packages/namespace-registry/src/lease.ts` L282–295/L410–420、`src/types.ts` L450/L457/L675–679；`apps/yjs-server/src/app.ts` L609 | 落点现状、名单同步机制、重载序与 Equal 锁、单参动态消费方 |
| 现存测试 | `packages/vfsl-protocol/test/vfsl-protocol-{empty-module.test.ts,empty-fail-closed.test-d.ts,projection.test-d.ts}`；`packages/vfsl-codegen/test/generate-alias-collision-guard.test.ts` L66–76 + `tsc-helper.ts` L76–88；`packages/namespace-runtime/test/runtime-readdata-shape-budget.test-d.ts`；`packages/namespace-registry/test/registry-readdata-budget-passthrough.test-d.ts`；`domains/vfs3-assets/test/*.test-d.ts`；`domains/vfs3-assets/generated.ts` L16/L23–26 | 基线与回归锚、负向 `@ts-expect-error` 锚（49 条）、判别联合 fixture（`AssetEntity`）、守卫机制 |
| 运行入口 | `vitest.config.ts` L15/L20；`tsconfig.typecheck.json`；`tsconfig.base.json` L10（`exactOptionalPropertyTypes`）；包 tsconfig；`package.json` scripts | 测试发现、类型门、EOPT 语义、门禁命令 |

本 iteration 无 SA1 设计产物（`wiki/raw/task_issue-337_design.md` 不存在）。SA1 若对 §12/§15 的契约或 pin 另有选择，须先原位修订本契约并触发 SA8 复核。

## 2. Owner 评论映射

无 owner 评论：REST Issue-comments 读取为空（`[]`），不存在评论来源的 override 或附加义务（SA8 §4 Overrides 表为空）。契约全部义务 = Issue #337 正文 AC1–AC4 + ADR-0024 决策 7（SA8 判定 13 项 `no-conflict` + 8 项 `implements-existing-decision`）。AC → 契约落点见 §12.1。

## 3. SA8 约束采纳

SA8 §8 required actions 逐条落点：

| # | SA8 required action | 契约落点 |
|---|---|---|
| 1 | **名单跟名（阻塞级门禁义务）**：协议包新增 `DeepOptional` 导出的同一变更集必须在 `PROTOCOL_EXPORT_NAMES` 增补 `'DeepOptional'`，否则 `generate-alias-collision-guard.test.ts`（实测枚举）必红 | G1.7（实测导出面 = 冻结名单 = 13 名含 `DeepOptional`）+ G0.2/G0.5 负控（今日 `guardSilent=[]` 绿；探针实测「假想第 13 名」→ `silent=['DeepOptional']`，证明该红机制敏感且因果成立）；§12.4 红灯机制 4 |
| 2 | **SA1 设计须钉死「现行为」基准与落点**：无 options 分支静态类型逐点一致；`apps/yjs-server` 单参消费方不破；lease 面 Equal 锁与「legacy 恒为最后」重载序为包内公共契约锁，如需变动须同变更集有意更新；结果类型如从 `unknown` 改型依 0.x minor bump 先例 | G2.1–G2.5（legacy 联合/`ReturnType` 锁/Equal 锁/typed 读/动态消费方逐点指纹）；§15 Q3–Q7（落点、泛型化命名、lease 镜像与 Equal 锁更新义务） |
| 3 | **实现纪律**：纯类型导出（零运行时值、零依赖、编译后空模块）；零 per-schema 生成（生成器输出规格与 `domains/*/generated.ts` 零改动、`generate --check` 零漂移）；不得在 docs/integration 作用域文档引入 `readData(path, …)` 带参示例（现行负控正则禁一切带参用法，修订归 T5） | G1.8（`Object.keys` 仍 `[]`、`dependencies` 零新增）+ G5.4（`generate --check` 零漂移）+ G5.5（改动面纪律：不触 `docs/integration`、不触 `domains/*/generated.ts`、不触 T5 负控 fixture/正则） |
| 4 | **AC3 退路义务**：判别字段「保持必选」退路仅在 test-d 红灯实证 TS 不容后启用，触发时票内记录；未触发不得预防性豁免 | G4.1–G4.3；§9 E5 实测 TS 5.9.3 窄化成立（退路当前不需启用）；若 SA1 另行选择退路 → 必附 test-d 红灯证据 + 票内记录 + SA8 复核 |

SA8 §10 `requiresConflictRecheck=true` 三项在后置复核中的核对物：

- **(a) 公共类型面/重载落点**：G1（协议第 13 名导出的纯类型语义）+ G3（预算读接缝的字面量路径类型）+ §15 Q1–Q4（载体语义、数组表示、落点、命名泛型化）——落点与命名由 SA1 钉死后本契约相应断言字面化。
- **(b) 判别字段条件退路**：G4 + §9 E5（今日实测不退路）；若退路触发，公共类型面形状改变（判别字段保持必选）→ 触发 test-d 红灯 + 票内记录 + SA8 复查。
- **(c) 名单跟名 / Equal 锁 / 生成物零漂移 / 负向锚**：G1.7（名单覆盖）+ G0.2/G0.5（守卫负控）+ G2.2（Equal 锁）+ G5.4（`generate --check`）+ G0.5/G5.1/G5.2（49 条既有 `@ts-expect-error` 负向锚保持真错误、root 门全绿）。

## 4. 环境与基线

- 运行时：Node v24.13.0；pnpm 10.28.2；typescript 5.9.3；vitest 3.2.7；tsx 4.23.12。
- 依赖：`pnpm install --frozen-lockfile` → exit 0（16 workspace projects，65 包全部 store 复用）；pnpm 提示 `esbuild@0.28.2` build script 被忽略——实测 vitest/tsx/tsc 全部可用，未影响任何门禁。
- **基线（HEAD `cb8aaff`，未做任何生产改动；详见 `artifacts/sa6-issue337-baseline-gates.log`）**：

| 命令 | 结果 |
|---|---|
| `pnpm typecheck`（root，14 个 tsc project） | exit 0 |
| `pnpm exec tsc -p tsconfig.typecheck.json --noEmit`（vitest typecheck 引擎 program） | exit 0 |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck.only --passWithNoTests=false` | exit 0；**31 files / 164 tests passed；Type Errors: no errors** |
| `... vitest run packages/vfsl-protocol/test packages/namespace-runtime/test packages/namespace-registry/test packages/vfsl-codegen/test --typecheck` | exit 0；**107 files / 979 tests passed；Type Errors: no errors**（含 `generate-alias-collision-guard.test.ts (4 tests)` 绿、`vfsl-protocol-empty-module.test.ts` 绿） |
| `pnpm generate --check` | exit 0（生成物新鲜，零漂移） |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm test`（root） | exit 0；**350 files / 3841 tests passed；Type Errors: no errors**（592.58s） |

- 现状（源码确认，不构成决策依据）：
  - `packages/vfsl-protocol/src/index.ts` 纯类型模块（157 行）：导出面 12 名，`PathAt` L59 / `PathValue` L72 / `VfslTypedAccess` L118 / `VfslPathMap` L157；`DeepOptional` 零命中（§5 P1）。
  - `packages/vfsl-codegen/src/protocol-surface.ts` L13–16 冻结 12 名（2026-08-21 基点 `5907dc3`）；文件头 L8–11 明文同步锚：「协议导出面【增名】而本名单未跟 → 实测新名不抛 → silent 清单非空 → 该测试红」「名单更新只改本文件一处」。
  - `packages/namespace-runtime/src/runtime.ts`：legacy 联合 L148（成功成员 L151 `value: unknown`）、预算联合 L163（L166 `value: unknown`）、双重载 L214–220（预算在前、legacy 在后，`ReturnType` 取末签名）。
  - `packages/namespace-registry/src/lease.ts` L282–295（lease 双重载镜像，legacy 排最后；released 短路先于透传）；Equal 锁 L410 `_readAlias` / L415 `_readBudgetAlias` / L419 `_readOverloadOrder`；`src/types.ts` L450/L457 两别名、L675–679 接口面重载。
  - `apps/yjs-server/src/app.ts` L609 `lease.readData(path)` 单参动态消费方（非字面量 path）。
  - `domains/vfs3-assets/generated.ts` L16 判别联合 `AssetEntity`、L23 `declare module '@nomicore/vfsl-protocol'`、L26 `assets: PathSchema<Record<string, PathSchema<AssetEntity, 'map'>>, 'map'>`——判别联合 + 数组元素 fixture 现成形态。
  - 既有负向类型锚 49 条 `@ts-expect-error`：`vfsl-protocol-empty-fail-closed.test-d.ts`(6) / `vfsl-protocol-projection.test-d.ts`(14) / `vfs3-assets-projection.test-d.ts`(21) / `vfs3-assets-migration.test-d.ts`(8)。
- 运行入口：`vitest.config.ts` L15 `include: packages|domains|apps */test/**/*.test.ts`；L20 `typecheck.include: packages|domains */test/**/*.test-d.ts`（`tsconfig: ./tsconfig.typecheck.json`；`maxWorkers: 1`）；跨包源码解析走 `customConditions: ["nomicore-source"]` + `NODE_OPTIONS=--conditions=nomicore-source`（无需 build）。
- 语义环境：`tsconfig.base.json` L10 `exactOptionalPropertyTypes: true`——EOPT 对「可选属性是否含显式 `undefined`」有可观测差异（§9 E4），契约断言须相应设计（§15 Q5）。

## 5. 正例复现（能力缺口，HEAD 实测）

Feature 无「运行时故障」，可复现的是**能力缺口**：协议类型面无 `DeepOptional` 名目；预算读静态价值列恒 `unknown`。全部探针为临时文件/inline 脚本，收尾前已删除（§16）。

**P1 — 协议导出面实测（tsc checker API，可复核）**：`artifacts/sa6-issue337-export-surface.log`

```
actual.count=12
actual=["VfslKind","PathSchema","UnknownPath","RootSchema","PathAt","VfslValueOf","PathValue","PathKind","PathPatchValue","PathElementValue","VfslTypedAccess","VfslPathMap"]
frozen.count=12  frozen 同上
actual-only=[]  frozen-only=[]
has_DeepOptional_actual=false  has_DeepOptional_frozen=false
```

判读：`@nomicore/vfsl-protocol` 实测导出面 12 名、与 `PROTOCOL_EXPORT_NAMES` 逐名相等，`DeepOptional` 不在其中——ADR-0024 L92「进协议类型面与 `PathAt` 并列导出」在本 HEAD 零落地。全仓 `*.ts` grep `DeepOptional` 零命中（仅 `CONTEXT.md` L46 与 ADR-0024 L92/L94/L113 有词）。

**P2 — 类型面缺口（tsc 编译探针；`artifacts/sa6-issue337-type-probes.log` §(a)/(b)）**：

```
probe-gap.ts(5,15):  error TS2305: Module '"@nomicore/vfsl-protocol"' has no exported member 'DeepOptional'.
probe-gap.ts(12,23): error TS2344: Type 'false' does not satisfy the constraint 'true'.   // DeepOptional<{a;nested}> = {a?;nested?}
probe-gap.ts(13,23): error TS2344: Type 'false' does not satisfy the constraint 'true'.   // DeepOptional<string> = string
probe-gap.ts(14,23): error TS2344: Type 'false' does not satisfy the constraint 'true'.   // DeepOptional<'image'|'text'> = 'image'|'text'
probe-gap.ts(21,23): error TS2344: Type 'false' does not satisfy the constraint 'true'.   // 预算读价值列 ≠ DeepOptional<…>
```

判读：目标语义（对象递归可选 / 标量原样 / 字面量联合保留）在 HEAD 不可表达（TS2305）；主候选接缝 `runtime.readData(literalPath, {depth:0})` 的价值列 **`unknown` ≠ 目标 deep-optional 结构**（TS2344），即 ADR-0024 L113 被否决的 `unknown` 方案正是现状。

**P3 — 既有面基线指纹（同探针文件，HEAD 零诊断）**：`probe-baseline.ts` 编译干净（§13 绿证据），锚定 `ReturnType<NamespaceRuntime['readData']> = NamespaceRuntimeReadDataResult`、legacy/预算成功成员 `value = unknown`、五键 `keyof` 精确集合、`ReturnType<NamespaceLease['readData']> = NamespaceLeaseReadDataResult`、`VfslTypedAccess.read(['name']) = string`、动态单参调用可编译。这是 AC1「零降级」的逐点指纹。

**P4 — 真实测试入口红灯（临时 test-d 经 vitest typecheck；`artifacts/sa6-issue337-runner-probe.log`）**：

```
❯  TS  packages/vfsl-protocol/test/zz-sa6-337-probe.test-d.ts (2 tests)
   ✓ 绿：既有 no-options 投影面在 HEAD 不变
   ✓ 红：DeepOptional 语义（HEAD 预期 TS2305——导出不存在）
 FAIL  ... > SA6 #337 runner 探针
TypeCheckError: Module '"@nomicore/vfsl-protocol"' has no exported member 'DeepOptional'.
 Test Files  1 failed | 3 passed (4)   Tests  22 passed (22)
```

判读：真实入口（`packages/*/test/**/*.test-d.ts` + `--typecheck`）**发现**目标模式文件并在正确原因（导出不存在）失败；同文件内既有面断言为绿、同目录既有 3 个文件（20 tests，含 20 条 `@ts-expect-error`）全绿——该次运行 3 files passed / 22 tests passed（22 含探针内 2 条绿断言）——红不是环境/fixture/入口错误。文件运行后即删（§16）。

**P5 — 守卫敏感性与名单跟名义务（`artifacts/sa6-issue337-guard-sensitivity.log`）**：

```
alias<DeepOptional> -> NO-THROW(silent,len=447)
alias<PathSchema>   -> THROW(code=alias-protocol-export-collision)
alias<PathAt>       -> THROW(code=alias-protocol-export-collision)
alias<VfslPathMap>  -> THROW(code=alias-protocol-export-collision)
guardSilent_withActualExports=[]
guardSilent_afterHypothetical13thExport=["DeepOptional"]
```

判读：`generateProjection` 的碰撞守卫名单 = `PROTOCOL_EXPORT_NAMES`；`DeepOptional` 今日不在名单 → 以其为领域别名**静默产出**。一旦协议导出面新增第 13 名 `DeepOptional` 而名单未跟，既有守卫测试（`protocolExportNames()` 实测枚举 × 逐一必抛，`generate-alias-collision-guard.test.ts` L66–76）的 `silent` 清单即为 `['DeepOptional']` → 红。SA8 §8.1 的阻塞级义务由此获得**行为级因果证据**（断言敏感、非纸面）。

**AC → 缺口映射**：AC1 由 P3 指纹化（今日绿、实现后必须仍绿）；AC2 无任何实现/出口（P1/P2）；AC3 无锚（P2；§9 E5 已实测 TS 行为）；AC4 基线已绿（§4；负向锚 49 条在 HEAD 均为真错误）。

## 6. 负控

| 负控 | 构造 | HEAD 实测 |
|---|---|---|
| 既有导出名碰撞必抛 | 12 名实测导出逐一作领域别名 `generateProjection` | 全 THROW（`silent=[]`）→ 守卫绿（P5） |
| 无 options 类型指纹不变 | `probe-baseline.ts` 9 组 Equal 锚 + 2 个动态调用编译 | 零诊断（P3） |
| 既有协议 test-d 全绿 | `vfsl-protocol-{empty-fail-closed,projection}.test-d.ts` | 绿（19 tests，含 20 条 `@ts-expect-error` 真错误） |
| 既有跨包类型锚全绿 | `runtime-readdata-shape-budget.test-d.ts` / `registry-readdata-budget-passthrough.test-d.ts` 等 31 files | 164 tests 全绿、0 type errors |
| 空模块零运行时 | `vfsl-protocol-empty-module.test.ts`：`Object.keys(import) === []` | 绿（DeepOptional 必须保持 type-only） |
| 生成物新鲜度 | `pnpm generate --check` | exit 0（零漂移） |
| 诚实对照（缺口非环境） | 同一 test-d 中既有面断言绿、目标断言红且原因 = TS2305 | 绿/红各就位（P4） |
| 门禁基线 | root typecheck / root test / 四包门禁 | 全 exit 0（§4） |

## 7. 稳定性、规模与时序

- 本票为**纯类型面**（type-level only）：断言全部在编译期完成，无异步、无计时、无并发、无随机源；重复运行结果确定（探针多次重跑逐字节一致）。
- 无规模/性能断言：`DeepOptional` 是通用映射类型（零 per-schema 生成），其成本体现为 tsc 实例化开销而非运行时可测量量；契约不设时间阈值，只以门禁（root `pnpm typecheck` / `pnpm test`）覆盖编译可行性与回归。
- 边界输入矩阵：对象（0/1/多键、嵌套多层、可选与必填混排）、标量（`string`/`number`/`boolean`/`null`/字面量联合）、数组（元素为标量/对象/判别联合；空数组；readonly）、联合（判别联合、成员独有字段）、根路径 `[]`、未知路径、动态（非字面量）path。
- EOPT 维度：`exactOptionalPropertyTypes: true`（`tsconfig.base.json` L10）下「可选属性是否含显式 `undefined`」可观测（§9 E4）——契约同时用 `expectTypeOf` 相等 + 赋值负例锚定（§12.5 D2）。

## 8. 能力缺口链

| 步 | 事实 | 证据 | 置信 |
|---|---|---|---|
| 症状 | 预算读的静态类型丢掉全部结构感知（价值列 `unknown`），ADR-0024 L113 明列该方案为「过保守」并已否决 | ADR-0024 L113/L127；P2（预算接缝 TS2344） | 高（母法 + 实测） |
| 直接缺口 | 协议类型面**无** `DeepOptional` 导出（12 名实测无该名）；预算读无 deep-optional 类型出口 | P1（`has_DeepOptional_*=false`）；全仓 grep 零命中 | 高（实测） |
| 触发条件 | 任何 `readData(path, options)` 调用：静态价值列恒 `unknown`（预算重载成功成员 L166），调用方拿不到「全字段可选 + 在场标量精确」的口径 | P2；`runtime.ts` L163–166；`lease.ts` L282–295 | 高（实测） |
| 类型面缺口 | 协议包无通用递归映射类型；`PathAt` 完整子树承诺只活在无预算面（`VfslTypedAccess.read` L126–129 + 宿主适配器模式） | P3 指纹；`index.ts` L59/L118–134；typed-access 文档 §5 | 高（实测） |
| 协议覆盖缺口 | 导出面增名不跟 `PROTOCOL_EXPORT_NAMES` → 碰撞守卫静默失效（名单驱动的发射器不抛） | P5（`DeepOptional` 别名 NO-THROW；`silent=['DeepOptional']`）；`protocol-surface.ts` L8–16 | 高（实测 + 机制明文） |
| 判别字段条件路径 | 可选化判别字段的 narrowing 兼容性未锚定；ADR 给条件退路（判别字段保持必选） | ADR-0024 L94；§9 E5（TS 5.9.3 实测窄化成立 → 退路当前不需启用） | 高（实测） |
| 上游依据 | ADR-0024 决策 7 L91/L92 + 验收 L127 明文指派协议类型面加法导出 + readData 类型面分叉；L130 影响包门禁 | ADR-0024 L91–95/L127/L130；SA8 §3/§8 | 高 |
| 未实现面 | 全仓 `*.ts` 无 `DeepOptional`；无预算读类型接缝测试；无名单第 13 名 | P1/P2；grep 零命中 | 高 |
| 未证实假设（需 SA1 收口） | `DeepOptional<PathAt<…>>` 载口语义、数组/元组/readonly 表示、落点接缝、命名泛型化、EOPT 精确断言的判据 | ADR 未逐字钉死（§9 E4/E6 已给出实测数据） | 见 §15 Q1–Q8 |

## 9. 因果实验

| 实验 | 控制 | 观察 | 结论 |
|---|---|---|---|
| E1 导出面枚举 | tsc `checker.getExportsOfModule`（与守卫测试同源 API）× `PROTOCOL_EXPORT_NAMES` | 12 = 12，`actual-only=[]`，无 `DeepOptional` | 缺口 = 类型面无导出（非文档/记忆问题）；名单同步机制今日处于一致态（守卫绿） |
| E2 预算读价值列 | 同字面量路径：无 options 调用 vs `(path, {depth:0})` 调用（类型级） | 无 options → legacy 联合；预算调用成功成员 `value: unknown`；目标 `DeepOptional<…>` 不等（TS2344） | 预算读静态结构感知为零 → AC2 目标断言在 HEAD 必然红 |
| E3 名单跟名敏感性 | 同一别名 fixture：`DeepOptional` vs 既有 12 名逐一 `generateProjection` | `DeepOptional` NO-THROW（silent）；`PathSchema`/`PathAt`/`VfslPathMap` THROW；`silent=['DeepOptional']`（假想第 13 名） | 若加名不跟名单 → 既有守卫必红；SA8 §8.1 义务与断言敏感均实证 |
| E4 DeepOptional 语义模型（非交付实现，仅测量） | 两种自然写法（同态映射 P2 vs 数组显式分支 ArrAware）× 仓库选项（EOPT=true） | 对象：`{a?: string; n?: {b?: number}}`（EOPT 精确、无多余 `\| undefined`）；标量/`null`/字面量联合原样；同态数组 `({a?: string} \| undefined)[]`（元素加 `undefined`）；数组显式分支 `{a?: string}[]`；readonly 输入在同态写法保留 `readonly`、在 `Array<…>` 分支丢失 readonly；元组 `[string?, {a?: number}?]`；判别联合 `{kind?: 'image'; url?: string} \| {kind?: 'text'; body?: string}` | 目标语义可实现且已测出两种写法的可观测差异 → 数组/readonly 表示必须由 SA1 pin（Q2）；契约默认要求无多余元素 `\| undefined` + 修饰符保留 |
| E5 判别字段 narrowing | 可选化判别联合模型 + `switch (v.kind) { case 'image': ... }` / `if` | 成员独有字段可访问（无 TS2339）；`const s: string = v.kind === 'image' 分支的 v.url` 报**唯一** TS2322（`string \| undefined`） | TS 5.9.3 **支持**可选判别字段窄化且窄化后字段为精确 `T \| undefined` → AC3 退路（判别字段保持必选）当前**不需启用**；仍应由 test-d 锚定（G4） |
| E6 载口语义反证 | 朴素把 deep-optional 套在 `PathAt` 节点载体上 | 产型 `{readonly __brand?; readonly __value?: string; readonly __kind?: 'leaf'}`——是**载体壳**不是读值类型 | `DeepOptional<PathAt<…>>` 记法必须经载体感知或 `PathValue` 桥接（Q1）；否则消费者拿到的类型无意义 |
| E7 EOPT 判据盲点 | 经典 `Equal` 助手下 `{a?: string}` vs `{a?: string \| undefined}`；对照直接赋值 | `Equal = true`（**无法区分**）；直接赋值 `{a?: string \| undefined}` → `{a?: string}` 报 TS2375（EOPT 下确实不同） | 契约对 EOPT 精确性必须叠加赋值负例（`// @ts-expect-error` 于 `{a: undefined}`），不得只靠 `toEqualTypeOf`/`Equal`（Q5） |
| E8 运行入口可触发 | 真实 `vitest --typecheck` × 临时 `packages/vfsl-protocol/test/zz-*.test-d.ts` | 文件被发现；目标断言红因 TS2305；同目录既有文件全绿 | 契约测试路径可被真实入口发现，红在正确原因（非入口/环境） |

## 10. 影响面

**改造面（实现迭代的最小面；SA1 落点选择见 Q3）**：

| 面 | 现形态 | 目标形态 | 约束 |
|---|---|---|---|
| `packages/vfsl-protocol/src/index.ts` | 12 名纯类型导出，无 deep-optional 名目 | 第 13 名 `DeepOptional`（通用递归映射类型） | 纯类型、零依赖、零运行时值（ADR-0004 D3）；`PathAt` 并列语义；不触既有 12 名语义 |
| `packages/vfsl-codegen/src/protocol-surface.ts` | `PROTOCOL_EXPORT_NAMES` 冻结 12 名 | 增补 `'DeepOptional'`（同变更集） | 单文件单处（文件头明文）；冻结面机制自身义务；不触生成器输出规格 |
| 预算读类型接缝（落点自由：runtime/lease `readData` 预算重载、`VfslTypedAccess` 预算方法、宿主适配器文档面或其组合） | 预算重载成功成员 `value: unknown`；typed 读只覆盖无预算面 | 字面量路径 → 价值列为 `DeepOptional<PathValue<PathAt<Map, P>>>`（ADR 记法下须桥接，Q1） | 无 options 分支逐点不变（AC1）；五键形状不变；lease 镜像与 Equal 锁如需变动须同变更集有意更新；动态非字面量调用不破（`apps/yjs-server` L609） |
| 测试面（下游交付） | 无预算读类型面 test-d | §12.3 清单 | 正例 `expectTypeOf`、负例 `@ts-expect-error`（ADR-0004 D4）；不得 skip/only/todo/软化断言 |

**只读耦合（本票不得改，但会被 root 门禁保护）**：

- `packages/namespace-runtime/src/runtime.ts` L148–172 两结果联合与 L214–220 重载序；`packages/namespace-registry/src/lease.ts` L282–295/L410–420 与 `src/types.ts` L450–L460/L675–679——若落点选在两类公共面，任何形状/泛型化变动都会触发包内 Equal 锁与 root typecheck 红，须同变更集有意更新（SA8 §8.2）。
- `apps/yjs-server/src/app.ts` L609 单参动态消费方：无 options 重载若被改型即 root typecheck 红——AC1 的行为级保护。
- 既有 49 条 `@ts-expect-error` 负向锚（§4）：实现后必须仍为真错误（AC4）。
- `packages/namespace-registry/test/readdata-docs-adr0016-contract-fixture.ts` 的 `readDataOptionUsages` 负控正则（扫 `docs/integration`，现行禁一切带参用法）——本票不得在作用域文档引入 `readData(path, …)` 示例；正则修订归 T5 #338。

**明确不改（可验证排除面）**：`domains/*/generated.ts` 与生成器输出规格（零 per-schema 生成）；`docs/adr/*`、`CONTEXT.md`（词条已就位）、`docs/integration/*`（T5 面）；`packages/vfsl` / `doc-runtime` 公共面（T1/T2 已落）；`.github` 工作流；现有测试文件（除实现迭代有意新增/必要修订并记录）。

**票谱系依赖**：T5 #338（typed-access 预算纪律文档、文档负控正则修订、`docs/integration` 形状注记、ADR 回填）——本票不触碰、不代验；本票为其提供类型面前提。

## 11. 排除的假设

1. **「`DeepOptional` 已在别处/别名下实现」**——全仓 `*.ts` 零命中；协议实测导出面无该名（P1）→ 排除。
2. **「预算读已有结构感知类型，只差文档」**——预算重载成功成员 `value: unknown`（`runtime.ts` L166），目标结构断言 TS2344 红（P2）→ 排除。
3. **「加导出名不影响既有门禁」**——名单未跟时碰撞守卫 `silent` 非空 → 守卫必红（P5 实测）→ 排除；名单跟名是硬义务。
4. **「无 options 面可以在本票顺带升级为 `PathAt`/deep-optional」**——AC1 + SA8 §8.2 要求与**现行为逐点一致**（legacy `value: unknown`、typed 读承诺位置不变）；升级属决策面变化，须先修订契约并 SA8 复核 → 排除。
5. **「`DeepOptional` 可以做成运行时工具/生成物」**——ADR-0024 L92「零 per-schema 生成」+ ADR-0004 D3 纯类型空模块 + 既有 `Object.keys === []` 测试 → 排除。
6. **「判别字段可以预防性豁免（保持必选）」**——ADR-0024 L94 明文由 test-d 红灯触发退路；E5 实测 TS 5.9.3 窄化成立，退路当前无触发理由 → 排除（若触发须证据 + 记录）。
7. **「`DeepOptional<PathAt<…>>` 可直接套在节点载体上」**——E6 实测产型是 `{__brand?; __value?; __kind?}` 载体壳，非读值类型 → 必须桥接（Q1）。
8. **「数组元素可以不管 `| undefined` / readonly」**——E4 实测两种写法给出不同产型（`({a?: string} \| undefined)[]` vs `{a?: string}[]`，readonly 是否保留亦不同）→ 必须 pin（Q2）；契约默认要求无多余元素 `| undefined` 且修饰符保留。
9. **「`toEqualTypeOf`/`Equal` 足以锚定 EOPT 精确性」**——E7 实测经典 `Equal` 无法区分 `{a?: string}` 与 `{a?: string \| undefined}`（而 EOPT 下两者语义不同）→ 契约叠加赋值负例（`@ts-expect-error`）→ 排除单靠相等断言。
10. **「既有负向锚会自动覆盖新面」**——既有 49 条锚全部针对无预算/空表/投影既有语义，不触 `DeepOptional` 与预算类型接缝 → 需新增 test-d（§12.3）。

## 12. 验收契约与测试路径

> **派发约束**：本 iteration 只**定义**契约范围与红灯机制，不落盘可执行测试（§12.3 的文件清单为下游实现迭代交付物）。红在 HEAD 已由 P1–P5 在**契约将断言的同一场景**上实跑证明（§5/§13），非纸面推测。

### 12.1 契约总表（AC1–AC4 + SA8 required actions → 落点）

| Issue AC / SA8 | 断言组 | 测试文件（下游交付） | 最小输入 | HEAD 预期 | 目标预期 |
|---|---|---|---|---|---|
| AC1 无 options 静态类型与现行为完全一致（PathAt 承诺零降级） | G2（+G0.4） | 包级 type-surface test-d + 既有 Equal 锁文件 | legacy/budget 联合类型、`VfslTypedAccess.read`、动态单参调用 | 绿（P3 指纹） | 仍绿（逐点恒等；无新增可选化） |
| AC2 预算读全字段可选 / 在场标量精确类型 / 数组元素递归 | G1（协议语义）+ G3（接缝） | `vfsl-protocol-deep-optional.test-d.ts` + 落点包 type-surface test-d | 对象/标量/字面量联合/数组/判别联合 fixture + 字面量路径预算调用 | 红（TS2305 / TS2344，P2） | 绿：`DeepOptional` 语义精确 + 接缝价值列 = deep-optional |
| AC3 判别字段 narrowing 由 test-d 锚定；TS 不容时退路 + 票内记录 | G4 | 同上（narrowing 段） | 可选化判别联合 + `switch`/`if` 窄化 | 红（无 `DeepOptional`） | 绿：窄化成立、成员独有字段为 `T \| undefined`（E5 实测）；退路未触发、无需记录 |
| AC4 未知路径/错误值既有负向锚保持红；全套包门禁 + root typecheck/test | G0/G5 | 既有 4 个 test-d + §12.6 命令 | 49 条 `@ts-expect-error`；root 门 | 绿（基线） | 仍绿 + 新文件被收集 |
| SA8 §8.1 名单跟名 | G1.7 + G0.2 | `generate-alias-collision-guard.test.ts`（既有）+ `protocol-surface.ts`（实现） | 实测导出面 13 名 × 冻结名单 | HEAD 绿（12=12，P5）；加名不跟名单即 `silent` 非空 → 红 | 绿：名单含 `DeepOptional`、实测面 = 名单 |
| SA8 §8.2 现行为基准与落点 | G2 + §15 Q3–Q7 | 落点包 test-d | 落点接缝无 options/options 两调用 | 指纹绿（P3） | 无 options 分支逐点不变 |
| SA8 §8.3 实现纪律 | G1.8/G5.4/G5.5 | 门禁命令 + 改动面审计 | 包依赖表、`Object.keys`、`generate --check` | 绿 | 仍绿 |
| SA8 §10(a)(b)(c) recheck | G1/G2/G3/G4/G5 | 上述全部 | — | — | SA8 后置复核逐项核对 |

### 12.2 断言组（契约范围；observation = 类型投影行为/编译期判据，禁止源码字符串断言）

**G0 前提与负控（HEAD 现绿）**
- G0.1 协议实测导出面（`checker.getExportsOfModule`）在 HEAD = 12 名且与 `PROTOCOL_EXPORT_NAMES` 逐名相等（P1）。
- G0.2 既有碰撞守卫绿：12 名实测导出逐一作领域别名 `generateProjection` 必抛（`silent=[]`，P5）。
- G0.3 空模块锚绿：`Object.keys(await import('@nomicore/vfsl-protocol')) === []`（`vfsl-protocol-empty-module.test.ts`）。
- G0.4 无 options 基线指纹（probe-baseline 同型断言集）在 HEAD 编译干净：G2.1–G2.4 的 Equal 锚 + 动态调用。
- G0.5 既有负向锚：4 个 test-d 的 49 条 `@ts-expect-error` 均为真错误；`--typecheck.only` 31 files / 164 tests 绿。
- G0.6 `pnpm generate --check` exit 0（生成物零漂移）。

**G1 `DeepOptional` 协议类型（AC2 语义面；强制，与 `PathAt` 并列导出；ADR-0024 L92）**
- G1.1 可从 `@nomicore/vfsl-protocol` 以 `import type` 导入 `DeepOptional`（HEAD：TS2305 红，P4）；运行时键集合仍 `[]`（type-only）。
- G1.2 对象 → 全字段可选并递归（EOPT 精确）：`DeepOptional<{a: string; n: {b: number}}>` 等于 `{a?: string; n?: {b?: number}}`；`{}` 可赋值（字段确实可选）；`// @ts-expect-error` 于 `{a: undefined}`（EOPT 下显式 `undefined` 不得被接受——E7 判据）。
- G1.3 标量原样：`DeepOptional<string>` = `string`；`DeepOptional<string | null>` = `string | null`；`DeepOptional<'image' | 'text'>` = `'image' | 'text'`。
- G1.4 数组 → 元素递归：数组性保留；元素类型 = `DeepOptional<E>`（元素字段递归可选）；**不得**给元素引入多余 `| undefined`（E4 同态写法产型为 `({a?: string} | undefined)[]`，默认判为不符）；readonly 输入保留 `readonly`（Q2 pin；若 SA1 选择同态表示，须显式记录并触发 SA8 复核后改写本条）。
- G1.5 判别联合不豁免：`DeepOptional<Entity>` = `{kind?: 'image'; url?: string} | {kind?: 'text'; body?: string}`（`kind` 可选化、精确字面量保留）。
- G1.6 值域/载体桥接（Q1）：消费方可见的预算读**值类型** = `DeepOptional<PathValue<PathAt<Map, P>>>`；若保留 ADR 字面记法 `DeepOptional<PathAt<…>>`，该记法必须解析为同一值类型（E6 反证：朴素套用节点载体产出 `{__brand?; __value?; __kind?}` 壳）。
- G1.7 导出覆盖与名单（SA8 §8.1）：实测导出面含 `DeepOptional`（共 13 名）且 `PROTOCOL_EXPORT_NAMES` 含 `'DeepOptional'`、实测面 = 冻结名单；碰撞守卫仍绿（G0.2 在增名后重跑）。
- G1.8 零运行时/零依赖：`packages/vfsl-protocol/package.json` `dependencies` 零新增；`Object.keys` 仍 `[]`；零 per-schema 生成（G0.6）。

**G2 无 options 基线零降级（AC1；强制）**
- G2.1 runtime legacy 面：`NamespaceRuntimeReadDataResult` 成功成员 `keyof` = `'ok'|'value'|'schema'|'truncated'|'truncations'`、`value = unknown`、schema/truncated/truncations 类型不变；`ReturnType<NamespaceRuntime['readData']>` = legacy 联合（重载序 legacy 末位）。
- G2.2 lease legacy 面：`NamespaceLeaseReadDataResult` = runtime legacy ∪ `NamespaceLeaseReleasedIssue`；`ReturnType<NamespaceLease['readData']>` = lease legacy；`_readAlias`/`_readBudgetAlias`/`_readOverloadOrder` 三 Equal 锁成立（包 typecheck 绿）。
- G2.3 typed 读面：`VfslTypedAccess<M>['read'](['name'])` = `PathValue<PathAt<M, ['name']>>`（精确、无 deep-optional 泄漏）；`patch`/`kindOf`/序列编辑签名与 fail-closed rest 标记不变。
- G2.4 动态消费面：`runtime.readData(dynamicPath)` / `lease.readData(dynamicPath)`（`string[]`）编译并命中 legacy 重载；`apps/yjs-server` L609 经 root typecheck 保护。
- G2.5 既有 T3 类型锚文件（五键精确集合、零泄漏 `READ_OPTIONS_INVALID`、失败面无新键、`ReturnType` 锁）一字不改保持绿；如确需修订（泛型化，Q4/Q7），必须同变更集有意更新并在实现说明记录。

**G3 预算读类型接缝（AC2 接缝面；落点由 SA1 pin，≥1 个公共接缝强制）**
- G3.1 字面量路径预算调用（主候选：`runtime.readData(literalPath, options)` 与 lease 镜像）：成功分支价值列 = `DeepOptional<PathValue<PathAt<Map, literalPath>>>`（HEAD：`unknown`，TS2344 红，P2）。
- G3.2 差分锁：同一字面量路径，无 options 调用类型**不得**被 deep-optional 污染（与 G2 一致）——两调用类型分叉即 ADR-0024 L91/L92 的承诺边界。
- G3.3 全字段可选：`{}` 可赋给预算读值类型；对该值类型的必填字段访问/非可选使用必须编译失败（`// @ts-expect-error`，CONTEXT.md L47 Avoid）。
- G3.4 在场标量精确：`NonNullable<BudgetValue['<scalar field>']>` = 原字面量联合（如 `'image' | 'text'`），不得宽化为 `string`/`unknown`。
- G3.5 形状不变量：预算结果成功成员 `keyof` 仍恰五键、失败成员形状不变（`READ_OPTIONS_INVALID` 只在预算联合；released channel 只在 lease 别名）。
- G3.6 动态（非字面量）路径：预算调用仍编译、返回类型可用（非 `never`、非误导性载体壳）；未知路径的字面量调用保持 fail-closed 语义（Q6）。若落点选 `VfslTypedAccess` / 宿主适配器（备选），则同组断言迁移到该接缝：无 options 仍 `PathValue<PathAt<…>>`、预算方法返回 `DeepOptional<PathValue<PathAt<…>>>`、未知路径仍编译错误（ADR-0004 D3 fail-closed 不放松）。

**G4 判别字段 narrowing（AC3；test-d 锚定）**
- G4.1 可选化判别联合上 `switch (v.kind) { case 'image': … }` 与 `if (v.kind === 'image')`：成员独有字段可访问（无 TS2339）。
- G4.2 窄化后成员独有字段类型精确为 `T | undefined`（E5：`const s: string = v.url` 报 TS2322）——"可选但类型不丢"。
- G4.3 退路条款：若 SA1 实证 TS 不容（须 test-d 红灯证据）而选择「判别字段保持必选」，必须在票内记录结论、修订本契约 G1.5/G4 并触发 SA8 复核；未触发不得预防性豁免。

**G5 门禁与纪律（AC4；review/runner 级）**
- G5.1 `pnpm typecheck`（root 14 project）exit 0。
- G5.2 `NODE_OPTIONS=--conditions=nomicore-source pnpm test`（root）exit 0；新 test-d 被 `--typecheck` 收集（`--passWithNoTests=false` 防静默假绿）。
- G5.3 落点包与协议/生成包目标测试全绿（含 `--typecheck`）。
- G5.4 `pnpm generate --check` exit 0（零 per-schema 生成、生成物零 diff）。
- G5.5 改动面纪律：除协议类型面、名单跟名文件、落点接缝与 §12.3 新测试/必要 Equal 锁更新外无改动；不触 `docs/integration`（T5 负控仍禁带参示例）、不触 `domains/*/generated.ts`、不触既有 49 条负向锚语义。
- G5.6 无 skip/only/todo/env override/fallback/吞错/软化断言/源码字符串断言。

### 12.3 测试文件清单（下游实现迭代落盘；本迭代不落盘）

| 文件（worktree-relative） | 角色 | 内容 |
|---|---|---|
| `packages/vfsl-protocol/test/vfsl-protocol-deep-optional.test-d.ts` | **协议语义红灯/绿灯** | G1.1–G1.6 全部断言（对象递归可选 EOPT 精确、标量/字面量联合原样、数组元素递归、判别联合不豁免、载体桥接）+ G4 判别字段 narrowing；正例 `expectTypeOf(...).toEqualTypeOf<...>()`、负例 `// @ts-expect-error`（含 `{a: undefined}` EOPT 负例）。HEAD 红因：TS2305（P4 同型） |
| `packages/namespace-runtime/test/runtime-readdata-budget-type-surface.test-d.ts` | **主落点接缝红灯**（若 SA1 选 runtime/lease 落点） | G3.1–G3.6（字面量路径预算价值列、五键不变量、动态路径可用性、未知路径 fail-closed）+ G2.1/G2.4/G2.5 回归锚 |
| `packages/namespace-registry/test/registry-readdata-budget-type-surface.test-d.ts` | **lease 镜像**（若落 runtime/lease） | G2.2/G2.3 + G3.1 的 lease 镜像与 released 通道不变量 |
| `packages/vfsl-protocol/test/vfsl-protocol-budget-access.test-d.ts` | **备选落点**（若 SA1 选 `VfslTypedAccess`/宿主适配器面） | G3.1/G3.3/G3.4/G3.6 在访问器接缝的镜像断言；fail-closed 不放松 |
| 既有 4 个 test-d + `vfsl-protocol-empty-module.test.ts` + `generate-alias-collision-guard.test.ts` | 回归/负控 | 默认零改动；G0 系列在实现后重跑必须仍绿；名单跟名后半红转绿的唯一变化在守卫（`silent=[]` 恢复） |

实现面（非测试，SA6 不触碰）：`packages/vfsl-protocol/src/index.ts`（`DeepOptional` 定义与导出）、`packages/vfsl-codegen/src/protocol-surface.ts`（名单跟名）、SA1 钉死的预算读接缝源文件。

### 12.4 HEAD 红灯机制（实现后必须翻绿；四重、各自单因）

1. **协议导出红灯（设计无关、最稳）**：`import type { DeepOptional } from '@nomicore/vfsl-protocol'` → TS2305（P4 实测；实现后自动转绿）。
2. **语义红灯**：G1.2–G1.5 的 `expectTypeOf` 相等断言在 HEAD 因名不存在无法编译（同一 TS2305 归因）；实现后按 §9 E4 实测形态断言。
3. **接缝红灯**：G3.1 字面量路径预算调用价值列 = `unknown` ≠ `DeepOptional<...>`（P2 实测 TS2344）；实现后转绿。
4. **名单覆盖红灯（增名后、跟名前）**：实测导出面含 `DeepOptional` 而 `PROTOCOL_EXPORT_NAMES` 未跟 → `generate-alias-collision-guard.test.ts` 的 `silent` 清单 = `['DeepOptional']` → 红（P5 实测该谓词）；跟名后转绿。

### 12.5 变异敏感性矩阵（实现/复核期临时执行并复原）

| 变异 | 预期转红的断言 |
|---|---|
| D1 仅加名单不实现 `DeepOptional`（或导出名拼写漂移） | G1.1（TS2305）、G1.7（实测面 ≠ 名单） |
| D2 `DeepOptional` 用非 EOPT 语义（`{a?: string \| undefined}`） | G1.2 的 `@ts-expect-error`（`{a: undefined}` 被放行 → 自反转失败），G3.3 同类负例 |
| D3 对象字段不递归（浅层可选） | G1.2 嵌套断言、G3.4 深层字面量字段 |
| D4 数组元素不做元素递归 / 引入多余 `\| undefined` / 丢 readonly | G1.4 |
| D5 判别字段豁免（保持必选） | G1.5（`kind` 非可选 → 相等断言红）、G4.1（若同时移除可选化则窄化断言形态不符） |
| D6 把 `DeepOptional` 套在载体上直接当值类型 | G1.6/G3.1（产型为 `{__brand?; __value?; __kind?}` 壳，E6 反证） |
| D7 无 options 分支被顺带改型/可选化 | G2.1–G2.4（legacy Equal 锚、`ReturnType` 锁、typed 读精确性、动态消费编译）、root typecheck |
| D8 lease 别名/重载序漂移 | G2.2（`_readAlias`/`_readBudgetAlias`/`_readOverloadOrder`）、包 typecheck |
| D9 `DeepOptional` 泄露为运行时值/新增依赖/生成物改动 | G1.8（`Object.keys` 非空 / `dependencies` 非零）、G5.4（`generate --check` 非零） |
| D10 预算结果成功成员加键/失败面混入 `READ_OPTIONS_INVALID` 到 legacy | G3.5、G2.5（既有五键/零泄漏锚） |

### 12.6 验证门（实现完成后必须全部通过）

```bash
pnpm exec tsc -p packages/vfsl-protocol/tsconfig.json
pnpm typecheck                                   # root 14 project（含 namespace-runtime / namespace-registry / yjs-server）
pnpm generate --check                            # 零 per-schema 生成、生成物零漂移
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run \
  packages/vfsl-protocol/test packages/vfsl-codegen/test \
  packages/namespace-runtime/test packages/namespace-registry/test \
  --typecheck --passWithNoTests=false
NODE_OPTIONS=--conditions=nomicore-source pnpm test   # root vitest run --typecheck
```

范围外：T5 #338（typed-access 纪律文档、文档负控正则修订、`docs/integration` 形状注记、ADR 回填）——本票不触碰、不代验。

## 13. 红/绿证据

| 证据 | 类型 | 位置 | 摘要 |
|---|---|---|---|
| P1 导出面枚举 | 红·能力缺口（实测） | `artifacts/sa6-issue337-export-surface.log` | 12 名实测 = 冻结名单；`has_DeepOptional=false` |
| P2 类型面探针 | 红·TS2305 + 4×TS2344 | `artifacts/sa6-issue337-type-probes.log` §(a) | 目标语义不可表达；预算价值列 `unknown` |
| P3 基线指纹 | 绿·AC1 逐点 | 同上 §(b) | `probe-baseline.ts` 零诊断（legacy 联合/`ReturnType`/typed 读/动态调用） |
| E4 语义模型 | 判据·实测 | 同上 §(d)/(e) | 对象 `{a?: string; n?: {b?: number}}`；同态数组 `({a?: string} \| undefined)[]` vs 数组显式分支 `{a?: string}[]`；EOPT `Equal` 盲点 `Q_Eopt_plain_vs_undef=true` |
| E5 narrowing | 判据·实测 | 同上 §(c) | 唯一 TS2322：窄化后成员独有字段 = `string \| undefined`；无 TS2339 → TS 5.9.3 支持 |
| P4 runner 红灯 | 红·真实入口 | `artifacts/sa6-issue337-runner-probe.log` | `TypeCheckError: ... has no exported member 'DeepOptional'`；3 files passed / 22 tests passed（既有 3 文件 20 tests 全绿 + 探针内 2 条绿断言） |
| P5 守卫敏感性 | 红机制·实测 | `artifacts/sa6-issue337-guard-sensitivity.log` | `alias<DeepOptional>` NO-THROW；假想第 13 名 → `silent=['DeepOptional']` |
| G0 基线门禁 | 绿·负控 | `artifacts/sa6-issue337-baseline-gates.log` | root typecheck exit 0；root 350 files / 3841 tests；四包 107 files / 979 tests；全 test-d 31 files / 164 tests；`generate --check` exit 0 |

> 注：以上红证据全部落在**契约将断言的同一场景**（协议导出名、预算读价值列、碰撞守卫谓词、真实 typecheck 入口），失败原因是能力缺失本身，非环境/fixture/超时/入口错误。实现迭代落盘 §12.3 测试后，必须先在 HEAD 复跑捕获同型红，再实施改造——否则不得声称红。

## 14. 测试入口证据

- `vitest.config.ts` L15：`include: ['packages/*/test/**/*.test.ts', 'domains/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts']`；L20 `typecheck.include: ['packages/*/test/**/*.test-d.ts', 'domains/*/test/**/*.test-d.ts']`（`tsconfig: './tsconfig.typecheck.json'`）；`maxWorkers: 1`。
- §12.3 各路径均命中上述 glob（协议/运行时/registry 包 test 目录后缀同型）。
- 实跑证据：P4 临时文件 `packages/vfsl-protocol/test/zz-sa6-337-probe.test-d.ts` 被 `vitest run packages/vfsl-protocol/test --typecheck` **发现**并在目标导入处报 `TypeCheckError`（exit 1）；同目录既有 `vfsl-protocol-projection.test-d.ts`（16 tests）与 `vfsl-protocol-empty-fail-closed.test-d.ts`（3 tests）绿。
- 引擎门：`pnpm exec tsc -p tsconfig.typecheck.json --noEmit` 基线 exit 0（与 vitest typecheck 同 program 配置）。
- 包级门：`packages/vfsl-protocol/tsconfig.json` include `src/**/*.ts` + `test/**/*.ts`——新增 test-d 在运行期红灯阶段会连带包 tsc 红（预期红灯锚，与 #24/#335 先例同款纪律）；实现后包 typecheck 必须绿。
- 跨包解析：`NODE_OPTIONS=--conditions=nomicore-source` + `tsconfig.base.json` `customConditions`，无需 build。落点若在 runtime/registry 使用 `VfslPathMap`/`PathAt`，需先由 SA1 决定是否新增 `@nomicore/vfsl-protocol` 包依赖（SA8 §8.2：无 ADR 禁止，新包图边须在实现说明记录）。

## 15. 未知与阻塞（SA1 设计 pin；不阻塞契约执行）

下列位 ADR 未逐字钉死，是 SA8 `requiresConflictRecheck=true` 的直接对象；SA1 必须逐项在设计中裁决（含最小示例），实现测试按 pin 字面化：

- **Q1（最关键）载体语义与 `DeepOptional<PathAt<…>>` 记法桥接**：`DeepOptional` 的作用域是「投影读值」还是「协议节点载体」？E6 实测朴素套用 `PathSchema` 载体产出 `{__brand?; __value?; __kind?}` 壳——消费者可见的预算读值必须等于 `DeepOptional<PathValue<PathAt<Map,P>>>`；若保留 ADR 字面记法，须保证 `DeepOptional<PathAt<M,P>>` 与值域 deep-optional 恒等（载体感知或 `PathValue` 桥接）。两读法对 G1.6/G3.1 的字面化方式不同，必须钉死并附最小示例。
- **Q2 数组/元组/readonly 表示**：E4 实测同态写法 `({a?: string} | undefined)[]`（元素含 `undefined`、readonly 保留）vs 数组显式分支 `{a?: string}[]`（无多余 `undefined`、`Array<…>` 丢失 readonly）；元组同态写法为 `[string?, {a?: number}?]`。契约默认要求「元素递归 + 无多余 `| undefined` + 修饰符（mutable/readonly）保留」；若 SA1 选择其他表示，须在设计中显式裁决并在票内记录（数组元素 `| undefined` 属公共类型面形状，触发 SA8 复核）。
- **Q3 落点接缝与路径推断**：类型面落在 runtime/lease `readData` 预算重载、`VfslTypedAccess` 预算方法、宿主适配器文档面或其组合？字面量 path 是否以 `const P` 保留元组、非字面量（`string[]`）如何回退（不得 `never`、不得载体壳）、`VfslPathMap` 增广如何被使用、是否新增 `@nomicore/vfsl-protocol` 包依赖。
- **Q4 结果类型命名与泛型化**：预算重载返回具名 `NamespaceRuntimeReadDataBudgetResult`（保持非泛型、价值列 `unknown`）还是泛型内联对象类型（价值列 deep-optional）？若泛型化具名联合：五键 `keyof` 与失败成员形状必须逐点不变（G3.5/G2.5），`READ_OPTIONS_INVALID` 零泄漏锚须继续成立。
- **Q5 EOPT 精确断言的判据**：E7 实测经典 `Equal` 无法区分 `{a?: string}` 与 `{a?: string | undefined}`（EOPT 下语义不同）。实现测试须叠加赋值负例（`// @ts-expect-error` 于 `{a: undefined}` 或必填字段访问）；Q5 确认断言的最终形态与「在场标量精确类型」的判据（建议 `NonNullable<Value['field']>` 精确相等 + 直接可赋值性双向锚）。
- **Q6 未知路径/失败态的类型行为**：字面量未知路径的预算调用在类型面呈现什么（`UnknownPath` 经 `PathValue` 透传后 deep-optional 会把接口字段可选化——E6 同类问题）；必须保证 ok:false 面不被污染、未知路径 fail-closed 语义（ADR-0004 D3 / `VfslTypedAccess` rest 标记）不放松；`PathPatchValue`/`PathElementValue` 等既有写投影零改动。
- **Q7 lease 镜像与 Equal 锁更新义务**：若 runtime 预算结果泛型化，`NamespaceLeaseReadDataBudgetResult` 组合别名（`types.ts` L457）与 `_readBudgetAlias`/`_readAlias`/`_readOverloadOrder`（`lease.ts` L410–420）是否需同变更集有意更新？必须保持「legacy 恒为最后」重载序与 released 通道不变量。
- **Q8 导出与依赖边界**：`DeepOptional` 是否只在 `@nomicore/vfsl-protocol` 出口（ADR-0024 L92 字面），还是需从 `@nomicore/vfsl` 或其他包再导出？默认 = 只在协议包（零 per-schema 生成、零依赖、编译后空模块）；任何额外再导出属公共面加法，需在实现说明记录。

跨票依赖（非阻塞）：T5 #338（typed-access 纪律文档、文档负控正则修订、`docs/integration` 形状注记、ADR 0008/0016 回填）未落地——本票不触碰、不代验；T5 的文档负控现行「禁一切带参用法」意味着本票不得在作用域文档引入 `readData(path, …)` 示例。无环境缺失、无信息不足——**无 blocker**。

## 16. 临时诊断清理

- 临时探针目录 `.scratch/sa6-337/`（`tsconfig.probe.json` + `probe-baseline.ts` / `probe-gap.ts` / `probe-model.ts` / `probe-cond.ts` / `probe-narrow.ts` / `probe-eopt.ts` + 4 个 `run-*.ts` 运行器）在收尾前整体删除；`git status --porcelain` 不留痕。
- 临时 runner 探针 `packages/vfsl-protocol/test/zz-sa6-337-probe.test-d.ts` 运行后即删（§13 P4）；其后重跑 root `pnpm test` 得到干净基线（350 files / 3841 tests），证明基线未被探针污染。
- 探针证据落盘为 `artifacts/sa6-issue337-{export-surface,guard-sensitivity,type-probes,runner-probe,baseline-gates}.log`（可复核，含命令、HEAD、时间戳与退出码）。
- 生产实现、既有测试、生成物、`docs/`、`CONTEXT.md` 全程零改动；`pnpm install --frozen-lockfile` 产物（`node_modules/`）由 `.gitignore` 覆盖，`pnpm-lock.yaml` 零 diff。
- 未启动常驻服务；无遗留后台任务（root typecheck/test、四包门禁、探针作业均已收，exit 0 或预期红）。
