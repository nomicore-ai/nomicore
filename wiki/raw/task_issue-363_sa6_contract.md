# SA6 诊断与验收契约 — issue #363

**T1：投影文本渲染器——`renderProjectionText` 经 `@nomicore/vfsl` 公共导出（ADR 0027 决策 2/3）**

- 任务类型：**Feature**（能力缺口证明 + 目标行为验收契约；本票纯加法，零既有行为变化）
- 诊断 HEAD：`12674544d2f24eb7d47c47ca4613b894043711d4`（短号 `1267454`，2026-09-13 16:58:14 +0800）
- 判定：**approve**（能力缺口可稳定复现、根因即「能力未实现」、契约可执行、测试入口真实）
- 交付边界：本迭代**不实现生产代码、不编写可执行测试**（dispatch 明令）；本报告即契约本体，
  §12 的断言组交 SA3/SA7 逐条落成测试与 fixture。

---

## 1. Task type and inputs

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| `wiki/raw/task_issue-363.md`（Host-owned task brief） | 在场（worktree 内 untracked） | 票面 What-to-build / AC 5 条 |
| `wiki/raw/task_issue-363_relevant_decisions.md` | **缺席** | 以 ADR 0027 + CONTEXT.md + 包 AGENTS 取代 |
| `wiki/raw/task_issue-363_conflict_report.md` | **缺席** | 同上 |
| `wiki/raw/task_issue-363_sa8_*.md`（SA8 产物） | **缺席**（`ls wiki/raw/*363*` 仅 brief） | 无设计门额外约束；本契约不代 SA8 裁决 |
| `docs/adr/0027-readdata-projection-text.md` | 在场（HEAD 提交即设计基线） | 决策 2（渲染器 API）/决策 3（规范文法）/验收缝 1 |
| `CONTEXT.md` L41–59 | 在场 | 投影、投影文本、✂ 段、截断省略的规范词汇 |
| `docs/adr/0016`（交付条款被 0027 修订）、`0024`（#359 amendment） | 在场 | 渲染器**输入语义**（可见性切片、标记线索）不动 |
| 既有测试/fixture（#272/#335/#306/#359/#315） | 在场 | 预算夹具家族、M4 夹具、手造派生物、冻结摘要 |
| Issue REST comments snapshot | **空**（无 owner 需求、无 comment ID） | 无逐字判据需转写 |

Issue #363 与父 PR #362 的关系已核实：`git rev-parse HEAD origin/adr0027-projection-text` 同值
（`1267454`），即父分支只交付 ADR 0027 设计基线，**不含渲染器实现**（§5/§11 证据）。

## 2. Owner comment mapping

Issue comments snapshot 为空；无 owner 补充要求、无 comment ID、无 comment 内判据需要转写。
契约判据全集 = issue body 的 What-to-build + AC 5 条 + ADR 0027 决策 2/3/验收缝 1
（缝 2/缝 3 属后续票，见 §10 范围切割）。

## 3. SA8 constraints

SA8 产物缺席，本契约不引入 SA8 红线，只继承以下既有约束：

- **包边界**（`packages/vfsl/AGENTS.md`）：公共 API 只经 `src/index.ts`；parser/evaluator/validator
  保持同步、确定、错误走判别联合；IR/派生物保持环境中立、JSON 可序列化；不在本包引入 Yjs 运行时关注。
- **typed Namespace 写纪律**（根 `AGENTS.md`）：与本票无关（本票不碰写路径、不碰生成物）。
- **ADR 0027 决策 2**：零选项签名、同步、逐字节确定；输入类型 = `ReadDataSchemaProjection` 系
  （保留为公共类型，vfsl 包面零破坏）。
- **ADR 0027 决策 3**：字段行 / 标量域照源文法 / Record/union / 别名块闭包发现序 / 口径恒
  first-line / 敌意 docs 防御 / `‡`+页脚 / `[...]‡` 如实 / 可见性切片不增删 / ✂ 段在场时才出现。
- **根 `AGENTS.md` 模块指引**：改动 `packages/` 前读 nearest `AGENTS.md`（已读）。
- 本契约不触碰 `docs/`、不新增 ADR、不改 `CONTEXT.md`（ADR 0027 已把词汇写完）。

## 4. Environment and baseline

```
node v24.13.0 · pnpm 10.28.2 · vitest 3.2.7 · TypeScript 5.9.3 · tsx 4.23.12
依赖：pnpm install --frozen-lockfile（65 包，store 复用，无网络下载）
```

基线（HEAD `1267454`，全部本次实测）：

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| 根测试 | `pnpm test`（`NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`） | **378 files / 4384 tests passed，Type Errors: no errors**（593.48s） |
| 根 typecheck | `pnpm typecheck`（14 个 tsconfig 串行） | **exit 0** |
| vfsl 聚焦 | `NODE_OPTIONS=--conditions=nomicore-source vitest run packages/vfsl/test --typecheck` | **48 files / 960 tests passed，no type errors**（56.8s） |

**测试入口（真实发现路径）**：`vitest.config.ts`

- `test.include = ['packages/*/test/**/*.test.ts', 'domains/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts']`
  → 新增 `packages/vfsl/test/*.test.ts` 自动发现；
- `test.typecheck.include = ['packages/*/test/**/*.test-d.ts', ...]`、`tsconfig: './tsconfig.typecheck.json'`
  → 新增 `.test-d.ts` 进 `pnpm test --typecheck`；
- 包级 `tsc`：`packages/vfsl/tsconfig.json` 的 `include = ["src/**/*.ts", "test/**/*.ts"]`
  → 新测试与 fixture 也进 `pnpm typecheck`。

**测试入口触发实测（临时探针，已清理）**：新建 `packages/vfsl/test/zz-sa6-discovery-probe.test.ts`
后 `vitest run <该文件>` 输出 `✓ ... (1 test) 1ms / Test Files 1 passed`，删除后 `ls` 计数 0、
`git status --short` 仅余 brief。

## 5. Positive reproduction（能力缺口，稳定复现）

**缺口陈述**：任何持有 resolver ok 产物（`ReadDataSchemaProjection` 四件套）的消费方，
当前**没有任何公共入口**得到其确定性投影文本；`@nomicore/vfsl` 公共面 20 个导出中不存在
`renderProjectionText`，仓内也不存在实现符号。

E1 导出面探针（命令与实测输出，HEAD 可重复）：

```bash
./node_modules/.bin/tsx -e "
import * as vfsl from './packages/vfsl/src/index.ts';
console.log('exportCount=' + Object.keys(vfsl).length);
console.log('hasRenderProjectionText=' + ('renderProjectionText' in vfsl));"
# → exportCount=20
# → hasRenderProjectionText=false
```

20 个既有导出名（冻结清单，供控制组做超集断言）：
`FileSchemaSource, SchemaSourceError, applyMutationAtBoundary, assertVfslDialect, compilePattern,
compileSchemaEnvelope, evaluate, getCompiled, getCompiledWith, isSchemaTruncationMarker,
matchPattern, parseSchemaEnvelope, parseVfsl, planMutationBoundary, resolveSchemaAtPath,
validateAppendToArray, validateDeleteFromArray, validateInsertIntoArray, validateLogicalSnapshot,
validatePatch`。

E2 符号面：`grep -rn "renderProjectionText" packages/ apps/ domains/` → 0 命中；
全仓仅 `wiki/raw/task_issue-363.md` 与 `docs/adr/0027-readdata-projection-text.md` 提及（设计面）。

E3 类型面（临时探针，已清理）：`packages/vfsl/test/zz-sa6-tsc-probe.test-d.ts` 内静态
`import { renderProjectionText } from '../src/index.js';` →

```
packages/vfsl/test/zz-sa6-tsc-probe.test-d.ts(2,10): error TS2305:
  Module '"../src/index.js"' has no exported member 'renderProjectionText'.
TSC_EXIT=2
```

删除探针后 `tsc -p packages/vfsl/tsconfig.json` → `TSC_EXIT=0`。即「静态 import 红 / 清理后绿」
的因果由同一命令对控制变量证明，红因 = 导出缺失，不是环境或入口错误。

E4 运行时红机制（契约测试将复用的接缝语义）：运行时红文件经
`import * as vfsl from '../src/index.js'` + 动态属性读取得导出，缺失时 `typeof candidate === 'undefined'`；
契约要求接缝助手在非 function 时 **loud 抛错并携带能力缺口文案**（不得裸 `TypeError: ... is not a function`
式失败，避免红因不可归因）。

## 6. Negative control

负控分两层，均为**红文件内嵌负断言** + **独立绿色控制文件**：

1. **既有行为不动（绿，且实现前后都必须绿）**：
   - `resolveSchemaAtPath(derived, path)` 无预算读 ok 分支仍恒四键 `{ok,valueSchema,aliases,docs,aliasDocs}`；
   - 预算夹具家族冻结摘要不变：本次实测
     `sha256(JSON.stringify(resolveSchemaAtPath(budgetFixtureDerived(), [])))`
     = `e600851a81744bd5ebca61aed5c7011bef6ca535c9a1d5deef6ee9020db45121`
     ≡ `BUDGET_NO_BUDGET_DIGESTS['[]']`（逐字节相等，`digestMatchesFixture=true`）；
   - `BUDGET_MARKER_MATRIX` / `BUDGET_DOCS_MATRIX` / `M4_*` 既有断言全绿（§4 基线）。
2. **渲染器负断言（目标实现下必须为真，且是正控的相近反例）**：
   - truncations 缺席 / `undefined` / `[]` → 输出**无** `✂`；
   - 投影无截断标记 → 输出**无** `‡`、无页脚；
   - `docs`/`aliasDocs` 为空 → 输出**无**注释标记（`//`）；
   - 渲染调用前后 `JSON.stringify(projection)` 与 `JSON.stringify(truncations)` 不变（纯函数、零变异）。

## 7. Stability, scale and timing

- 本票无竞态、无并发、无网络、无 I/O：渲染器是同步纯函数，稳定性判据 = **确定性**
  （同输入重复调用逐字节相同；与无预算 resolver 调用交错后仍逐字节相同），不涉概率/时钟。
- 规模：契约矩阵约 **86 个金标单元**（预算 37 格 + M4 16 路径 + #272 12 路径 + 手造槽位 3 深度
  + 文法形态 9 + M4 预算交叉 9），每个单元格投影为 O(文本规模) 纯数据；渲染应为
  O(投影节点数)，全套断言远低于秒级。
- 无跨调用状态要求：不得引入 memo/缓存使「先渲染 A 再渲染 B 再渲染 A」发生变化；
  交错调用断言即此不变量。
- 时间/时序条件：不适用（无时钟、无调度）；`deep`/规模放大只影响输出字节数，不影响确定性。

## 8. Root-cause chain（能力缺口链）

| Step | Fact | Evidence | Confidence |
| --- | --- | --- | --- |
| 1 症状 | 消费方拿不到「投影 → 文本」的确定性编码；模型上下文只能吃 JSON 四件套 | issue #363 What-to-build；ADR 0027 背景（45.8KB vs 1.2KB，38 倍） | 高 |
| 2 直接故障点 | `@nomicore/vfsl` 公共面无 `renderProjectionText`（20 导出，0 命中） | E1/E2 探针 | 高（运行时实测） |
| 3 类型面同因 | 静态 import 报 TS2305；`.test-d.ts` 与 `tsc -p packages/vfsl/tsconfig.json` 双入口红 | E3 探针 | 高 |
| 4 触发条件 | 任何「持有 resolver ok 产物、需要文本呈现」的调用点（readData 组合层、会话级探针工具） | ADR 0027 决策 1/2/4 | 高 |
| 5 输入契约已就绪 | `resolveSchemaAtPath` ok 四件套 + `SchemaTruncationMarker`（ref/container 线索）+ #359 可见性切片，均有冻结夹具与绿基线 | §4 基线；§9 E5 输入面探针 | 高 |
| 6 最深根因 | **能力未实现**：ADR 0027 决策 2/3 已接受并进 HEAD（设计基线），实现票 #363 仍 open；父分支 tip ≡ HEAD，无任何实现可复用 | `git rev-parse HEAD origin/adr0027-projection-text` 同值；E2 | 高 |
| 7 放大因素 | 无（本票不触碰 readData，不存在既有行为放大面） | — | — |
| 8 未证实假设 | 文法细节（缩进/块头拼写/页脚文案/✂ 行格）ADR 未逐字给死 → 由实现期快照冻结（§12 契约边界） | ADR 0027 决策 3 措辞粒度 | 已登记 |

相关性不替代因果：Step 6 的因果实验 = 在 HEAD 上只加「一行静态 import」即红（E3），
删掉即绿；导出面探针在无任何其它改动下稳定复现（E1，重复执行结果一致）。

## 9. Causal experiments（最小因果实验）

| # | 实验 | 控制变量 | 观察 | 结论 |
| --- | --- | --- | --- | --- |
| E1 | 导出面探针（tsx 动态读 index） | 同一 HEAD、同一安装 | `exportCount=20`、`hasRenderProjectionText=false` | 缺口在公共面，非内部实现 |
| E2 | 符号 grep（packages/apps/domains） | 排除 docs/wiki | 0 命中 | 无隐藏实现 |
| E3 | 静态 import 探针（临时 `.test-d.ts` + `tsc -p packages/vfsl/tsconfig.json`） | 加探针 / 删探针 | `TS2305` exit 2 → 删除后 exit 0 | 红因 = 导出缺失，可归因、可复现 |
| E4 | 派生物输入面探针（37 格预算矩阵 + M4 16 路径 + 无预算整读） | 既有 resolver 不改 | 每格输出四件套；docs 键锚定文法恒定；`truncated` 标记仅按 depth 出现 | 渲染器输入契约完整、可构造 |
| E5 | 负控摘要探针 | 同上 | `digestMatchesFixture=true`（`e600851a…`） | 既有 JSON 通道未受影响，红不是环境问题 |
| E6 | 测试入口探针（临时 `.test.ts`，已删） | vitest include glob | 新文件被收集并通过（1 test） | 契约测试路径将被真实 runner 发现 |

E4 的一个**关键观察**（写进契约边界，见 §12.9）：投影只带 `docs` 绝对语法路径键，
不带读路径；`path=["shallow","audit"]`、`["deep","mid","leaf"]`、`["shallow","title"]`、
`["req"]` 等单元格的 `docs` 里存在**无渲染宿主**的脊柱/终点边键（如 `ROOT.shallow`、`ROOT.deep`、
`Ledger.audit`、`ROOT.req`）。别名体内部键（`<aliasName>.<相对路径>`）可确定归位；
根内联树的字段键靠「相对路径后缀」归位（本契约全部断言单元内后缀唯一，无碰撞）。

## 10. Impact surface

实现期应触达（纯加法）：

- `packages/vfsl/src/index.ts`：新增 1 个值导出 `renderProjectionText`（+ 其入参清单类型的
  `export type`），置于 ADR-0016/0024 导出块之后，注释锚 ADR 0027 决策 2/3；
- `packages/vfsl/src/render-projection-text.ts`（新文件）：渲染器实现（同步纯函数）；
- 测试与 fixture（SA3/SA7）：`packages/vfsl/test/render-projection-text*.ts`（§12.1）。

**明确不触碰**（本票红线）：

- `packages/vfsl/src/resolve-schema-at-path.ts`（输入契约冻结；#359 语义不动）；
- `packages/namespace-runtime/*`（readData 五键 ↔ 四键、头行、detach 退役 = ADR 0027 决策 1/4，
  属后续票的验收缝 2/缝 3）；
- `packages/doc-runtime/*`（值通道 `ReadLogicalValueTruncationEntry` 形状冻结）；
- 版本号/发布链（本票加法，不构成破坏性 minor bump；发布动作不在 worktree 内）。

**下游一致性锚（跨票，不在本票断言）**：渲染器第二参必须与 doc-runtime
`ReadLogicalValueTruncationEntry = { path: readonly (string|number)[]; kind: 'depth'|'width'; omitted: number }`
**结构兼容**（T2 组合层要原样透传该清单，不得要求转换），此约束以结构类型在 §12.2 断言。

## 11. Ruled-out hypotheses（排除项）

| 假设 | 排除证据 |
| --- | --- |
| 实现已在父分支/远端可复用 | `origin/adr0027-projection-text` tip == HEAD（同 SHA），diff 为空；E2 零命中 |
| 导出已存在但换了名字 | E1 冻结 20 名清单逐个检视：无 render/projection/text 语义名 |
| 红是环境缺依赖导致 | 依赖自 store 复现安装；根 378 files/4384 tests 与根 typecheck 均绿 |
| 新测试不会被 runner 发现 | E6 实测收集并通过；include glob 与 typecheck include 均覆盖拟定路径 |
| 渲染器需从 doc-runtime 取 truncations 类型 | vfsl 是叶包（AGENTS 边界）；doc-runtime 定义已读，契约改用结构类型断言等价性 |
| 渲染器要输出头行 `# readData [path] {depth:N}` | ADR 0027 决策 2 明文「组合层前贴头行」；渲染器不知道实参 path，产出头行 = 伪造事实 → T1 出范围（§12.8 反断言） |
| 旧实现「静默忽略第二参」可作红机制（#335 先例） | 不适用：本票是新增函数，旧实现根本没有可调用的函数；红机制 = 接缝缺失 loud 抛错（E1/E3） |
| docs 文本会破坏文法（已发生） | 未见：现有源夹具的 docs 均为单行；契约以敌意手造派生物主动证明防御（§12.5） |

## 12. Acceptance contract and test paths

### 12.1 测试文件与职责（SA3/SA7 落成；本迭代未编写）

| 文件（worktree-relative） | 角色 | HEAD 期望 | 目标实现期望 |
| --- | --- | --- | --- |
| `packages/vfsl/test/render-projection-text.test.ts` | 红灯验收契约（运行时，全部正向断言 + 内嵌负断言） | **红**：接缝非 function → loud 能力缺口错误 | 绿 |
| `packages/vfsl/test/render-projection-text.test-d.ts` | 类型面契约（导出在场、零选项签名、入参结构） | **红**：TS2305（`vitest --typecheck` + 包 tsc 双入口） | 绿 |
| `packages/vfsl/test/render-projection-text-control.test.ts` | 负控/纯加法回归锚（既有 resolver 面） | **绿** | **绿**（恒绿） |
| `packages/vfsl/test/render-projection-text-fixture.ts` | 共享 fixture：金标快照 + 手造投影 + truncations 清单 + 文法形态文本 | 非测试文件（不被收集，进 tsc） | 非测试文件 |

纪律（沿仓内 SA6 先例）：运行时红文件**顶层不静态 import 新名目**（`import * as vfsl` + 动态属性读）
以保住包 tsc 对红文件零报错；`.test-d.ts` 才用静态 import（红在类型面）；无 skip/only/todo/env
override/fallback/吞错/软化断言；不 grep 生产源码。

### 12.2 CT-1 公共导出与零选项签名（红组 G1）

运行时（G1.1–G1.4）：

- 接缝助手：`const candidate = (vfsl as Record<string, unknown>)['renderProjectionText'];`
  非 function 时 `throw new Error('能力缺口：renderProjectionText 未经 @nomicore/vfsl 公共入口导出（ADR 0027 决策 2）')`；
  每个测试**第一条语句**先经该助手取函数（保证红因始终是能力缺口，不会先撞金标缺失）。
- `typeof candidate === 'function'`；返回值 `typeof === 'string'`；
- 一参调用合法（无 truncations）；二参 `undefined` 显式调用与一参调用**逐字节相同**；
- 输出**不含**组合层头行：`expect(text.includes('# readData [')).toBe(false)`（§12.8 范围反断言）。

类型（G1.5–G1.9，`.test-d.ts`）：

- `import { renderProjectionText } from '../src/index.js'` 编译通过；`expectTypeOf(renderProjectionText).toBeFunction()`；
  `expectTypeOf(renderProjectionText).returns.toEqualTypeOf<string>()`；
- `renderProjectionText(noBudgetProjection)` 与 `renderProjectionText(budgetedProjection)` 均编译，
  结果为 `string`（`ReadDataSchemaProjection` 与 `BudgetedReadDataSchemaProjection` 双入参）；
- 零选项：`// @ts-expect-error` 覆盖 ①第三参 `renderProjectionText(p, [], {})`；
  ②呈现选项对象作第二参 `renderProjectionText(p, { depth: 1 })`；
- truncations 元素形状：以下字面量编译通过（结构类型，证明与 doc-runtime 条目同构）：

```ts
interface TruncationEntryLike {
  readonly path: readonly (string | number)[];
  readonly kind: 'depth' | 'width';
  readonly omitted: number;
}
declare const entries: readonly TruncationEntryLike[];
const s: string = renderProjectionText(budgetedProjection, entries);
```

- 封闭判别反例（`// @ts-expect-error`）：`kind: 'height'`；`omitted: '2'`；`path: 'x'`。

**旧实现预期结果**：G1.1 在 `expect(typeof candidate).toBe('function')` 处红（显式缺口文案）；
G1.5 在 `vitest --typecheck` 与 `tsc -p packages/vfsl/tsconfig.json` 处红（TS2305）。
**目标实现预期结果**：全绿；且除新增导出外，20 个既有导出名保持在场（控制组超集断言）。

### 12.3 CT-2 文法快照冻结矩阵（红组 G2）

输入单元格（evaluate 产物家族，全部经真实 `parseVfsl → evaluate → resolveSchemaAtPath` 产出，
或经既有手造派生物构造器）与断言：

| 族 | 单元格 | 断言 |
| --- | --- | --- |
| F1 无预算整读（#272 `FIXTURE_TEXT`） | 12 路径：`[]`、`['notes']`、`['audit']`、`['audit','createdBy']`、`['config']`、`['keywords']`、`['assets']`、`['assets','img1']`、`['assets','img1','url']`、`['assets','img1','body']`（xml 覆盖）、`['u','x']`、`['attachments']` | `render(projection)` 逐字节 ≡ `RENDER_GOLDENS[cell]` |
| F2 预算矩阵（`BUDGET_FIXTURE_TEXT`） | `BUDGET_MARKER_MATRIX` 全 12 path × 各 `byDepth` 键 = **37 格**（path 含 `[]` d0–d4/d9、`['shallow']` d0–d4、`['deep','mid','leaf']` d0–d3、`['shallow','audit']` d0–d2、`['req']` d0/d1、`['plain']` d0/d1、`['pair']` d0/d1、`['inlPair']` d0/d1、`['mode']` d0/d1/d9、`['modes']` d0–d2、`['modeMap','k']` d0/d1、`['shallow','title']` d0/d1/d3） | 同上（预算投影，含 `kind:'truncated'` 标记） |
| F3 M4 成员注释（`M4_TEXT`） | `M4_CONTRACT_PATHS` 全 **16 路径**（无预算） | 同上；另断言 `EXPECTED_DOCS` 中每个「有渲染宿主」的成员注释文本按 first-line 出现在成员行 |
| F4 M4 × 预算交叉 | `[]` d0/d1/d2、`['pair']` d0/d1、`['mode']` d0/d1、`['items']` d0/d1（**9 格**） | 同上；`<member N>` 槽位注释随宿主渲染在场、宿主被截时缺席（#359 语义在文本面的呈现） |
| F5 手造槽位派生（`slotDocsDerived()`） | `[]` × depth {0,1,2}（**3 格**） | 同上；`<item>`/`<key>`/`<member N>` 槽位注释随宿主在场 |
| F6 文法形态文本（新增 `RENDER_GRAMMAR_TEXT`，evaluate 产物） | `[]` + 逐字段路径（`code`/`bare`/`amount`/`ratio`/`level`/`body`/`plain`/`long`，**9 格**） | 同上；覆盖 `Pattern<"…">`、裸 `Int`、`Int<1, 9999999999>`、`Range<0, 100>`、数字 enum `1 | 2`、`xml`、`T[]`、超 100 列 enum 折行 |

- 金标完整性（反空转）：`expect(Object.keys(RENDER_GOLDENS).sort()).toEqual(EXPECTED_CELL_KEYS.sort())`，
  `EXPECTED_CELL_KEYS` 由上述矩阵在 fixture 内**独立推导**（不得从金标反推）。
- 金标录制纪律：实现期由 `renderProjectionText` 实际输出录制，fixture 头注明录制 HEAD/日期/命令；
  录制前必须人工核对（写进该文件头）：每个投影的 `Object.keys(aliases)` 全部有别名块、
  块序 = 闭包发现序、每个有宿主的 docs 键文本在正文出现、`‡` 覆盖全部标记。
- 语法形态的源文法拼写（ADR 0027 决策 3 逐字）：`Pattern<"…">`、`Int`、`Int<min, max>`、
  `Range<min, max>`、enum `"a" | "b"`（` | ` 分隔、超 100 列折行缩进续行）、`Record<string, T>`
  + 行尾 keyPattern 注释、ref 直写别名名、`T[]`、optional 字段 `名?: 类型`（`optional` 包装
  透明解包为 `?`，不改变字段名）。
- `xml` 形态拼写 ADR 未逐字给死 → 见 §12.9 契约边界 P3（设计门先钉，快照随钉）。

**旧实现预期结果**：G2 每条在取接缝时即红（能力缺口）。**目标实现**：逐字节绿。

### 12.4 CT-3 `‡` / `[...]‡` / 页脚（红组 G3）

- 标记计数：对每个输入投影，按其 `valueSchema` + 各 `aliases` 体递归统计 `kind:'truncated'`
  节点数 `m`（沿用既有 `collectMarkers` 口径）；断言
  `countOccurrences(text, '‡') === (m === 0 ? 0 : m + 1)`（m 个位标 + 1 行页脚；夹具 docs 文本不含 `‡`）。
- 线索如实：`clue.via==='ref'` → 该位置行含 `<name>‡`（别名名直写，不展开）；
  `clue.via==='container'` → 该位置**字面**含 `[...]‡`（ADR 0027 决策 3 / CONTEXT「不编造类型名」）。
- 页脚：`m > 0` 时恰有 1 行解释 `‡` 含义的页脚，且位于正文之后、✂ 段之前；
  `m === 0` 时无 `‡`、无页脚（负断言）。
- 敏感性：从手造投影中删掉 1 个标记节点 → `‡` 计数恰减 1；把 ref 线索换成 container 线索 →
  `[...]‡` 出现且原 `<name>‡` 消失。

**旧实现**：接缝红。**目标实现**：绿。

### 12.5 CT-4 口径 first-line 与 docs 敌意防御（红组 G4）

- first-line：`docs` 多条目（≥2 条）→ 注释只取第 1 条 + 省略号 `…`，第 2 条及以后文本**不出现**；
  单条目内嵌 `\n`/`\r\n` → 折叠为空格，**不得产生新行**。
- 归位：别名体内位置按 `<aliasName>.<相对路径>` 精确取 `docs[k]`；
  根内联树位置按「相对路径后缀唯一」取键（契约夹具保证唯一）；每个有宿主的 docs 条目文本出现在
  其位置所在行（同一行含该位置的类型表达式与 `// <text>`）。
- 敌意防御（手造派生 `HOSTILE_DOCS_DERIVED`，docs 值含 `} `、`*/ `、`` ` ``、`"`、`// `、`#`、`\n`、
  超长行）：
  - 结构不变性：与「良性文本孪生」逐行比较，**行数相同**且「首个 ` // ` 之前的前缀」逐行相同；
  - 注释段内不得含裸 `\n`（注释不越行）；
  - 敌意文本不得生成额外结构行（例如不得让 `}` 变成新块头）。
- 不增删投影内容（双向敏感性）：
  - 删除某 docs 条目 → 该文本从输出消失（其余结构行不变）；
  - 增加 1 个未渲染位置的 docs 条目（脊柱类）→ 输出**结构行**不变（§12.9 P1 边界）；
  - `docs`/`aliasDocs` 清空 → 输出与全量渲染的**结构行**逐行相同（仅注释不同）；
  - 手造投影多带 1 个未被引用的别名 → 该别名块按 `aliases` 键序照样渲染（渲染器呈现输入表，
    不自作闭包再收窄）。

**旧实现**：接缝红。**目标实现**：绿。

### 12.6 CT-5 ✂ 截断事实段（红组 G5）

truncations 输入形状（与 doc-runtime 同构）：

```ts
[{ path: ['tags'], kind: 'width', omitted: 2 }]
[{ path: ['meta'], kind: 'depth', omitted: 2 }, { path: ['tags'], kind: 'width', omitted: 3 }]
[{ path: ['items', 0], kind: 'depth', omitted: 1 }]
```

- 缺席 / `undefined` / `[]` → 输出无 `✂`，且三者逐字节相同（负断言 + 等价锚）。
- 非空 → `✂` 在场；每个条目的路径段（含数字段 `0`）、裁因 token（`depth` / `width`）、
  omitted 计数均在输出出现；段为文末块（`lastIndexOf('✂')` 之后无正文行）。
- 敏感性：从 2 条输入删到 1 条 → 被删条目的 path/omitted 文本从输出消失；
  改 `kind` 或 `omitted` → 输出随之改变（不得只渲染 path 而吞掉裁因/计数）。
- 与 `‡` 共存：预算投影 + 非空 truncations → 两者同时在场，✂ 段在正文与页脚之后。
- 确定性：同输入重复调用逐字节相同；乱序输入亦逐字节确定（不要求与正序相等）。

**旧实现**：接缝红。**目标实现**：绿。

### 12.7 CT-6 确定性与纯函数（红组 G6）

- 同输入重复调用（无预算 / 预算 / 带 truncations 各一）→ 逐字节相同；
- 交错：`render(A)` → `resolveSchemaAtPath` 无预算重读 → `render(A)` → `render(B)` → `render(A)`，
  三次 A 逐字节相同；
- 零变异：调用前后 `JSON.stringify(projection)` 与 `JSON.stringify(truncations)` 不变；
- 无跨调用状态：同一 projection 对象在两次调用间被浅拷贝/冻结不影响输出（可选加强）。

**旧实现**：接缝红。**目标实现**：绿。

### 12.8 CT-7 纯加法回归锚 / 控制组（控制文件）

在 `render-projection-text-control.test.ts`（HEAD 与实现后**恒绿**）：

- 20 个既有导出名逐一 `typeof` 在场（超集断言，不锁死新增名）；
- `resolveSchemaAtPath` 无预算 ok 四键形状 + `BUDGET_NO_BUDGET_DIGESTS` 全路径逐字节摘要 +
  `BUDGET_MARKER_MATRIX` / `BUDGET_DOCS_MATRIX` 抽格；
- `resolveSchemaAtPath` 失败码/`SCHEMA_OPTIONS_INVALID` 抽格（预算通道未被动过）；
- 渲染器范围反断言放在**红文件**（G1.4，头行缺席）而非控制文件，避免控制文件在 HEAD 因新导出缺失而红。

控制组存在的意义：把「红」钉死在能力缺口（G1），排除环境/夹具/入口三类伪红。

### 12.9 契约边界与设计门待钉项（不进本票可执行断言，除非钉死）

| # | 边界 | 现状证据 | 本契约处理 |
| --- | --- | --- | --- |
| P1 | **无渲染宿主的 docs 键**：脊柱/终点边键（`ROOT.shallow`、`ROOT.deep`、`Ledger.audit`、`ROOT.req` 等）在投影 `docs` 里在场，但渲染器不知道读路径（头行归组合层），无法归位 | E4 探针（`["shallow","audit"]`、`["deep","mid","leaf"]`、`["req"]`） | 契约**只断言有宿主的键**；P1 键的呈现方式（丢弃 / 头部汇总）由设计门显式钉死后再补快照；不得为归位而伪造位置或路径 |
| P2 | **后缀歧义**：根内联树 docs 归位依赖相对路径后缀唯一；两个内联容器同名字段且都有注释时歧义 | E4：契约矩阵内后缀唯一 | 契约夹具保证唯一；设计门须钉确定性 tie-break（若选择后缀匹配）；歧义用例不进本票断言 |
| P3 | **`xml` 形态拼写**：ADR 0027 决策 3 未给 | `FIXTURE_TEXT` 的 `['assets','img1','body']` → `{kind:'xml'}`（另见 E4 探针） | 设计门先钉（建议源文法拼写 `YXmlFragment`），再冻结快照；未钉前该格只断言「确定、单行、不破坏结构」 |
| P4 | **排版细节**：块头拼写/缩进宽/换行策略/页脚与 ✂ 段逐字行格 | ADR 决策 3 只给规范性要素 | 实现期快照冻结；SA6 冻结复核清单见 §12.3 |
| P5 | **truncations 类型名/导出** | ADR 未命名；doc-runtime 已有同形条目 | 契约用**结构类型**断言兼容，不锁类型名；建议 vfsl 导出 `ProjectionTruncation`（加法），但非本票硬判据 |

## 13. Red/green or baseline evidence

**红（HEAD，已实测）**

- 运行时：E1 导出面探针 `hasRenderProjectionText=false` → 契约任何断言在接缝处 loud 红；
- 类型：E3 `TS2305`（`vitest --typecheck` 与 `tsc -p packages/vfsl/tsconfig.json` 同源双入口），
  删除探针后 `TSC_EXIT=0`（红因可归因、非环境）；
- 失败归因链：接缝非 function 是**第一条**断言，红不会伪装成金标缺失/夹具错误/超时。

**绿（HEAD 基线，已实测）**

- 根 `pnpm test`：378 files / 4384 tests passed，no type errors（593.48s）；
- 根 `pnpm typecheck`：exit 0；vfsl 聚焦：48 files / 960 tests passed；
- 负控锚：`sha256(JSON.stringify(resolveSchemaAtPath(budgetFixtureDerived(), [])))` ≡ 夹具冻结摘要
  `e600851a…`。

**目标实现预期**：CT-1…CT-7 全绿；控制组恒绿；根门禁维持 378/4384 + typecheck 0（新增文件计入后
数字上浮，断言看「0 failed / 0 type errors」）。

**本迭代未产出的东西（dispatch 约束，透明登记）**：SA6 未编写任何可执行测试或 fixture 文件；
因此「负控为绿」的**当前**证据 = 既有 378/4384 全绿 + 摘要探针 E5 + §12.8 控制组规格；
红/绿落成与证据留档由 SA3（实现）与 SA7（验收）执行，契约已把文件、断言、红因、敏感性写死。

## 14. Runner trigger evidence

| 证据 | 内容 |
| --- | --- |
| config | `vitest.config.ts`：`include: ['packages/*/test/**/*.test.ts', ...]`；`typecheck.include: ['packages/*/test/**/*.test-d.ts', ...]`，`tsconfig: './tsconfig.typecheck.json'` |
| 根脚本 | `pnpm test` = `NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`；`pnpm typecheck` 含 `tsc -p packages/vfsl/tsconfig.json` |
| 包配置 | `packages/vfsl/tsconfig.json` `include: ["src/**/*.ts", "test/**/*.ts"]` → 新 fixture/测试进包 tsc |
| 实测 | 临时 `packages/vfsl/test/zz-sa6-discovery-probe.test.ts` 被 `vitest run <路径>` 收集：`Test Files 1 passed (1) / Tests 1 passed (1)`；删除后目录计数 0、`git status --short` 仅余 brief |
| 聚焦命令（契约测试用） | `NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run packages/vfsl/test/render-projection-text.test.ts --typecheck` |

## 15. Unknowns and blockers

- **无阻塞**：能力缺口稳定复现、根因证实（能力未实现 + 输入契约就绪）、测试入口真实。
- 待设计门钉（不阻塞本契约成立，阻塞对应断言的逐字冻结）：§12.9 P1（无宿主 docs 键）、
  P2（后缀歧义 tie-break）、P3（`xml` 拼写）、P4（排版逐字）、P5（truncations 类型名）。
- 缺失输入：`task_issue-363_relevant_decisions.md`、`task_issue-363_conflict_report.md`、SA8 产物
  均不存在；Issue comments 空。本契约以 brief + ADR 0027 + CONTEXT + 代码/fixture 事实为准，
  未虚构裁决。
- 金标快照必须在实现期录制（HEAD 无实现，无法预先录制）；契约以「单元格完整性断言 +
  独立结构性断言 + 敏感性反例」三重防空转。

## 16. Temporary diagnostics cleanup

- `/tmp/sa6-363-probe.ts`（仓外只读探针）：删除（见收尾命令）。
- `packages/vfsl/test/zz-sa6-discovery-probe.test.ts`：已删除（`ls` 计数 0）。
- `packages/vfsl/test/zz-sa6-tsc-probe.test-d.ts`：已删除，删除后 `tsc -p packages/vfsl/tsconfig.json`
  exit 0。
- 未启动任何长驻服务/后台进程；未使用 nohup/setsid/PID 文件；未 commit/push/建 PR。
- 收尾核对：`git status --short` 预期仅 `?? wiki/raw/task_issue-363.md`（Host-owned，未改）
  与本报告 `?? wiki/raw/task_issue-363_sa6_contract.md`；生产实现零改动。
