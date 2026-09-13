# SA9 标准审查报告 — issue #363 最终提交 diff（标准合规性）

- **阶段**：standards-review（SA9，iteration 0）| **日期**：2026-09-13 | **Dispatch**：sa-2a78311a-d0a1-47c0-a7c9-ea1018da464e
- **Verdict**：**approve**（无 BLOCKER / 无 MAJOR；无新增 MINOR——4 项上游已登记非阻塞观察见 §5）
- **审查对象**：最终提交 `d956b42c39946386ad9377c45da3cd9d5ae67285`（`feat(vfsl): render schema projections as text`）；父提交 = PR #362 head `12674544d2f24eb7d47c47ca4613b894043711d4`（ADR 0027 设计基线）。`git merge-base --is-ancestor` 实测：**ANCESTOR-CONFIRMED**；diff = `git diff 1267454..d956b42`（16 files，+5270/−0，**纯加法**）；工作树干净（`git status` 零输出）
- **输入（全部读过）**：票面 `task_issue-363.md`、SA1 设计 `task_issue-363_design.md`（iteration 2，971 行）、SA2 `task_issue-363_sa2_review.md`（iteration 2 approve）、SA3 `task_issue-363_sa3_impl.md`（iteration 1 返工版）、SA4 `task_issue-363_sa4_review.md`（approve）、SA6 契约 `task_issue-363_sa6_contract.md`、SA7 `task_issue-363_sa7_report.md`（approve）、SA8 三产物（relevant_decisions / conflict_report clear / implementation_conflict_report iteration 2 clear）、ADR 0027 全文、根 AGENTS.md、packages/vfsl/AGENTS.md、docs/AGENTS.md、实现与测试六件全量逐行
- **独立核验（本评审执行，非转抄）**：diff 逐文件实读（`render-projection-text.ts` 1002 行全文、index diff、测试四件全文）；`git diff --check`；EOF/缩进字节核验；grep 冲突标记 / skip·only·todo / console·process.env·Date.now·Math.random / `class InternalError` 定义数 / 既有测试 import 内部模块先例 / node:crypto 先例；测试「每测试首语句 = 接缝获取」机械解析（43/43 通过，其余目检）；金标与设计附录 A 样张抽查逐字比对；根 package.json / vitest.config.ts / 两级 tsconfig 测试入口链核验；Issue REST comments snapshot = 空（dispatch 明示）——无 owner 要求、无 comment ID 适用
- **角色边界**：不审查 Issue 需求是否完整实现（SA10 辖域）；不修改代码/设计/测试；不运行测试；本文件为唯一产物

---

## 1. 仓库标准合规（AGENTS / ADR / 模块责任 / 惯例）

| 标准 | 证据（独立核验） | 裁决 |
|---|---|---|
| 根 AGENTS「改 packages/* 前读就近 AGENTS.md」 | packages/vfsl/AGENTS.md 已对照逐条（下四行）；本票不触写路径/schema  authoring/复制/诊断日志等专项纪律辖域 | ✅ |
| vfsl AGENTS：同步、确定、环境中立、JSON 可序列化、无 Yjs 运行时关注 | 渲染器零模块级可变状态（仅只读 const 集 L60–80）、零 memo、零 I/O；grep `console.`/`process.env`/`Date.now`/`Math.random`/`new Date`/`performance.` 于全部六件 = **0 命中**；无 Yjs import；package.json 未改（叶包零运行时依赖保持） | ✅ |
| vfsl AGENTS：公共 malformed-input 走判别联合；**显式例外** trusted-domain `InternalError`（ADR 0016） | 渲染器返回 `string` 被 ADR 0027 决策 2 钉死（判别联合不可行）；projection/truncations 按 trusted-domain 处理 `throw InternalError`（L173–340 浅层 + 全树守卫）——ADR 0016 既有例外向渲染器输入的延伸，经设计 §7.5 钉死、SA2 approve、SA8 I12 裁定 no-conflict（授权内通道裁定）；无顶层 catch、无部分输出、无静默降级（唯一 `try` L223 为 finally 栈清理） | ✅ |
| vfsl AGENTS：公共 API 只经 `src/index.ts` | index.ts 纯 +6 行（4 注释锚 + `export { renderProjectionText }` + `export type { ProjectionTruncation }`），置于 ADR-0016/0024 resolver 导出块之后（SA6 §10 定点）；既有 20 值导出零改动（控制组 C1 `FROZEN_EXPORTS` 超集断言钉死） | ✅ |
| vfsl AGENTS：验证门（包 typecheck + 公共类型变更须根门禁） | 入口链静态核验为真：根 `pnpm typecheck` 首步 = `tsc -p packages/vfsl/tsconfig.json`；包 tsconfig `include: src/**/*.ts, test/**/*.ts` 覆盖 fixture 与 .test-d；`vitest.config.ts` include `packages/*/test/**/*.test.ts` + typecheck include `*.test-d.ts` 覆盖新测试三件；运行证据采 SA3/SA7 记录（381 files/4540 tests 双记录一致，本角色不复跑） | ✅ |
| ADR 0027 决策 2（渲染器 API） | `renderProjectionText(projection, truncations?)` 两参零选项签名（L135–138）；入参 = `ReadDataSchemaProjection \| BudgetedReadDataSchemaProjection` 联合（两类型均既有公共，包面零破坏）；同步纯函数逐字节确定（G6/G8 断言）；无 `RenderProjectionOptions`（已否决项未复活，test-d G1.8 双 `@ts-expect-error` 封第三参与选项对象） | ✅ |
| ADR 0027 决策 2（头行归组合层） | 全文无 `# readData [` 产出行（grep 0 命中 + G1.3 反断言）；缝 2 职责未越权 | ✅ |
| ADR 0027 决策 3（文法，规范性） | 抽查金标 ↔ 附录 A 逐字一致：A.1↔`F2 [] d9`（含裸宿主行 `inlPair: // 内联联合位`、`type Mode = "on" \| "off" // 开 · 关`）、A.2↔`F2 [] d1`（m=11→‡12、页脚恰 1 行）、A.4↔`F2 ["shallow","title"]`=`string\n`、A.5↔`F1 ["config"]`=`{?` 块 / `F1 ["notes"]`=`string?`、A.6↔`F1 ["assets","img1"]`（裸别名宿主行承载 aliasDocs）、A.7↔`F1 ["u","x"]`（根位合成 union 成员行缩进 0 起）；标量域拼写 `Pattern<"…">`/裸 `Int`/`Int<1, 9999999999>`/`Range<0, 100>`/数字 enum `1 \| 2`/`YXmlFragment`/超 100 列折行续行逐字在场（G2.F6）；`Record<string, T>` + 行尾 keyPattern 注释；union 恒展开不渲染判别式（全文无 discriminator 读取）；别名块 = `Object.keys(aliases)` 闭包发现序；docs 换行折叠 + first-line + `…`；`‡` 位标 `<名>‡`/`[...]‡` + 页脚一行（页脚文案与设计 §7.4 逐字同）；✂ 段仅 truncations 非空时在场（三态等价 G5.1）、空路径 `[]` 拼写（N5）、条目输入序 | ✅ |
| ADR 0027 决策 1/4/5（范围切割） | `packages/namespace-runtime/**`、`packages/doc-runtime/**`、版本号/发布链零触碰（diff --stat 16 文件全枚举）；`packages/vfsl/package.json` 0.2.4 未动（bump 挂缝 2 票，ADR 决策 5）；detach/恒四键/头行未提前落地 | ✅ |
| ADR 0016/0024（输入契约冻结面） | `resolve-schema-at-path.ts`、`resolve.ts`、`derived.ts`、`evaluate.ts`、`validate*.ts` 零改动（diff 全枚举）；`SchemaTruncationMarker` 形态只读消费；doc-runtime `ReadLogicalValueTruncationEntry` 以结构类型 `ProjectionTruncation` 逐字段同构（L44–51；test-d G1.9 双向 `toMatchTypeOf`），叶包未引 doc-runtime | ✅ |
| docs/AGENTS.md | 本票零 docs 改动——ADR 0027 词汇已写全（投影文本/✂ 段/标记类型），实现未引入新领域术语（`…`/`YXmlFragment` 属 ADR 0027 文法粒度内记号，`YXmlFragment` 已在 CONTEXT「标记类型」词表）；wiki/raw 产物为证据非规范契约，符合该文件定位 | ✅ |
| 模块责任（渲染器落点） | ADR 0027 已否决「独立叶包 / namespace-runtime」——渲染器落 vfsl（文法权威单源：resolver、docs 文法、切片规则同包）；与 vfsl-codegen emitter 非重复（输入/输出/消费方三轴皆异，设计 §10.1 裁定维持） | ✅ |
| 既有惯例：导出块注释锚 / import 路线 | index.ts 新块注释锚（issue #363 / ADR 0027 决策 2/3）与相邻块（issue #25 等）同款；`import { InternalError } from './resolve.js'` 与 4 处既有生产消费方（resolve-schema-at-path L57 / validate L39 / evaluate L20 / validate-patch L33）同路线；测试 import 内部模块 `../src/resolve.js` 有 **5 个既有测试先例**（grep 实测：budget-control/member-docs/resolve-schema-at-path/budget/pattern-errors）；`.js` 后缀 import、`import type`（verbatimModuleSyntax）、`!` 非空断言（noUncheckedIndexedAccess 下标准写法） | ✅ |
| 提交形态惯例 | wiki/raw 任务产物随实现提交同 commit 入仓有先例（`f16011b` ADR 0025 集成提交含 task_issue-347/348 等产物）；commit message `feat(vfsl): …` 符合仓内 conventional 风格 | ✅ |

## 2. 单一事实源

| 事实 | 权威源 | 派生态 | 漂移风险 |
|---|---|---|---|
| 投影内容 / 截断事实 / 别名闭包序 | resolver ok 四件套 / truncations 第二参 / `aliases` 键序 | 渲染文本（纯函数） | 无（渲染器不缓存、不再收窄闭包——G4.7 未引用别名照渲染） |
| `InternalError` 类身份 | `resolve.ts` L26 唯一定义 | import 复用，无第二定义（grep `class InternalError` 全包 = **恰 1 处**）；不经 index 导出（公共面未扩） | 无（R5 闭合维持） |
| 投影文法 | `render-projection-text.ts` 单文件 + ADR 0027 决策 3 | 86 金标快照（录制区隔离注释 L221/310，录制 HEAD/日期/命令/5 条人工核对清单在案） | 无（`EXPECTED_CELL_KEYS` 由路径集**独立推导**反空转，G2.0 键集断言 86） |
| 页脚/✂ 段文案 | 实现内单 const（L60/L63） | 测试侧 FOOTER 局部常量 = 期望数据（方向正确：实现漂移即红） | 无 |
| resolver 既有行为 | `resolve-schema-at-path.ts`（未改） | 控制组 C2.1 全路径 sha256 冻结摘要、C2.2 失败码、C3 预算抽格 | 无（恒绿锚） |

## 3. 生命周期对称性

纯函数：无 acquire/release/后台任务/订阅/句柄。渲染栈语义 add/delete 配对逐一枚举核对（L540/549、L590/592、L627/629、L667/677、L744/746、L751/753 六对）；`validateNode` 唯一 `try` 为 `finally { stack.delete(node) }`（L312–314）——异常路径栈不残留；optional 链防环 `seen` 均为局部集。回滚 = 删 1 实现文件 + index 6 行 + 4 测试件（纯加法，无状态迁移）。✅

## 4. 文件范围

| 维度 | 核验结果 |
|---|---|
| ALLOW 命中 | 设计 §11 / SA6 §10 六行全部命中且仅这些：`src/render-projection-text.ts`（新，1002 行）、`src/index.ts`（+6）、`test/render-projection-text.test.ts`（733 行 / 144 it）、`.test-d.ts`（66 行 / 5 it）、`-control.test.ts`（169 行 / 7 it）、`-fixture.ts`（631 行，非测试文件）+ `wiki/raw/*363*` 任务产物十件 |
| DENY 零触碰 | diff 16 文件全枚举：resolver/`resolve.ts`/`derived.ts`/`evaluate.ts`/`validate*.ts`、既有 `packages/vfsl/test/**` 全部文件、`namespace-runtime`、`doc-runtime`、`docs/**`、`CONTEXT.md`、`vitest.config.ts`、两级 tsconfig、版本链——**均未出现**；`InternalError`/投影类型/环夹具/docs 键集均为只读 import 消费（import ≠ 修改） |
| 纯加法 | +5270/−0；`git diff --check` exit 0；五件新码文件 EOF 单 `\n`、无 tab、无尾随空白（.editorconfig 合规） |
| 冲突/残留 | 冲突标记 grep 0 命中；`git stash list` 空；无遗留探针文件入仓（SA3/SA7/SA8 探针均 /tmp 仓外） |

## 5. 测试质量标准

| 标准 | 证据 | 裁决 |
|---|---|---|
| 红灯纪律（SA6 §12.1） | 运行时红文件顶层**不静态 import 新名目**（`import * as vfsl` + `seamRenderer()` 动态属性读，非 function 时 loud 抛「能力缺口」文案）；机械解析 43/43 `it` 块首语句 = `const render = seamRenderer()`（含循环展开块），余量目检一致——红因恒归因能力缺口；`.test-d.ts` 静态 import（红在类型面 TS2305 双入口） | ✅ |
| 控制组恒绿且不引用新名目 | `-control.test.ts` import 仅既有夹具与 `../src/index.js`；C1 20 导出超集 / C2 冻结摘要 + 失败码 / C3 预算抽格；范围反断言（无头行）按 SA6 §12.8 放红文件 G1.3 | ✅ |
| 无弱化 | grep `skip`/`only`/`todo`/env override/fallback = 0 命中；断言为精确逐字节（金标 `toBe`）与结构前缀逐行相等；负控齐备（G3.3/G3.7c/d m=0、G5.1 三态、G4.8 无宿主键不出现特判） | ✅ |
| 独立推导防空转 | `EXPECTED_CELL_KEYS`（F1 12 + F2 37 + F3 16 + F4 9 + F5 3 + F6 9 = 86）由路径集推导而非金标反推；G2.0 键集 ≡ 断言 | ✅ |
| 敏感性 | 删标记 ‡ 减 1（G3.4）、换线索形态变（G3.2）、删/增/清 docs 结构行不变（G4.4–G4.6）、✂ 删条目/改 kind/改 omitted（G5.4）、乱序清单确定性（G5.6） | ✅ |
| CT-8 环组（设计新增强制） | 9 格（三构造器 × 无预算/d1/d9）+ §12.1 环安全审计局部助手（节点身份 `toBe` 逐位 + 环安全摘要逐字节；**禁 stringify**——R4 病灶规避）；O4 澄清（optionalRing d1 合法含 `…`）断言在场 | ✅ |
| CT-9 畸形组（设计新增强制） | 8 抽样（缺四键/坏 kind/坏 truncations kind/docs 值非 string 数组/int 半参/节点非对象/别名体坏 kind/truncations 非数组）× `toBeInstanceOf(InternalError)` + `name==='InternalError'` + G9.1 可归因消息（`bogus`、`min\|max\|int`） | ✅ |
| 类型面负向夹具 | 5 个 `@ts-expect-error`（第三参、选项对象、kind 封闭、omitted 类型、path 类型）+ 双向 `toMatchTypeOf` 结构同构锚 | ✅ |
| 测试计数与上游一致 | 144 契约 + 7 控制 + 5 类型 = 156，与 SA4 §9 / SA7 §9 记录一致（含 I7 回归 G3.7a–d 红先敏感性证据：expected 2 / received 1） | ✅ |

## 6. 发现

**无 BLOCKER、无 MAJOR、无新增 MINOR。** 以下 4 项为上游已登记的非阻塞观察，本评审复核其登记准确、维持非阻断定性（不重复计为 SA9 新发现）：

1. **SA4 O-D**：`validateNode` optional 分支向内层传递同一 `where` 标签（L298–301）——深 optional 链畸形消息定位精度略降（仍含键名/kind 语境，G9.1 通过）；非验收面，后续票可微调。
2. **SA4 O-B**：`needsExpansion` enum 折行宽判据未计尾随定界符（`>`/`[]`/`?`）——100 列边界组合格与朴素读法可差 1–2 列；行为确定且已被 86 金标冻结（P4 快照权威）；重钉排版须整族重录并过 SA8 冻结面复核。
3. **SA4 O-C / SA8 §7 行 2**：docs 尾缀匹配实现为「位置渲染序 + 消费式」（`assignComments` L909–926），与设计 §7.2 非规范性「实现指引」草图在退化格上不同——实现取规范规则文本一侧（「剩余 docs 键」语义含消费）；金标族无碰撞格，P2 契约边界内。
4. **设计 L6/L7 + SA4 O-A**：optional 包裹 union/enum 的罕见读感边（`\| "a" \| "b"?` 同形歧义、`?` 落首成员行/闭行的误归因读感）——逐字节确定性/无损性不受影响，86 金标无此格，跨票台账（T2 若产出该形态，ADR 0027 文法粒度内再议）。

另有两处实现内部观察，经核验**不构成发现**：① `emitValue` L499–503 与 `inlineText` L761–764 的「不可达」防御分支（占位 vs throw 姿态不一）——`validateProjectionTree` 前置 + 解包循环保证真不可达，属防御性死码，无行为面；② `validateProjectionShape` 对空 enum `values: []` 不拒——trusted-domain 输入契约（resolver 永不产出），设计 §7.5 校验清单仅要求类型判定，未越清单。

## 7. 结论

**approve**。最终提交 `d956b42` 在全部八个标准维度合规：

- **AGENTS**：根与 vfsl 模块边界逐条满足——同步/确定/环境中立/无 Yjs/公共 API 仅经 index/兼容性面未动；畸形输入 `InternalError` 属 ADR 0016 trusted-domain 显式例外经设计钉死与 SA2/SA8 裁定的授权内延伸（ADR 0027 钉死返回 `string`，判别联合不可行）；
- **ADR**：0027 决策 2/3 逐字兑现（零选项签名、first-line 口径、文法各形态、别名闭包序、`‡` 页脚、✂ 段、无头行越权）；决策 1/4/5 范围切割守住（namespace-runtime/doc-runtime/版本链零触碰）；0016/0024 冻结面只读消费；
- **模块责任**：渲染器落 vfsl（文法权威单源），doc-runtime 条目仅以结构类型同构（叶包零依赖保持）；
- **惯例**：导出块注释锚、`InternalError` import 路线（生产 4 处 + 测试 5 处先例）、wiki 产物随 commit 入仓先例、commit message 风格全部一致；
- **单一事实源**：`InternalError` 定义数 = 1、文法单文件权威、金标单次录制 + 独立推导反空转、resolver 冻结摘要恒绿锚；
- **生命周期对称性**：纯函数零资源面，栈配对 6 处 + finally 清理核对无误；
- **文件范围**：ALLOW 六行全命中、DENY 全零触碰、+5270/−0 纯加法、`git diff --check` 净；
- **测试质量**：红灯纪律机械核验通过、无弱化、负控/敏感性/独立推导齐备、CT-8 环安全审计与 CT-9 畸形强制组落地、控制组恒绿且不引用新名目、类型面负向夹具 5 反例。

`requiresConflictRecheck: false`（SA9 侧）：本 diff 未引入任何超出设计 §15 已登记且已由 SA8 实现门 iteration 2 闭合（clear / false）的裁决面；SA4/SA7 同判 false。缝 2（恒四键/头行/一致性锚/minor bump）、缝 3（文档词汇重录）、敌意 getter 边界为跨票台账事项，不属本 diff 义务。
