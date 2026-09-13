# SA1 架构与实现设计 — issue #363（T1：投影文本渲染器）

- Dispatch：`sa-7e77ebe2-a64e-4e70-8497-60cbbebbc825`（mabf-sa1 / design / iteration 2）
- 修订基础：iteration 1 设计（dispatch `sa-72e66102-b57d-42bf-99a2-229e0d3cee3a`）收到
  SA2 设计评审 iteration 1 **reject**（`wiki/raw/task_issue-363_sa2_review.md`：R4–R5 两项
  MAJOR + O1–O5 非阻塞观察；prior R1–R3/N1–N6 已被该评审 §5/§6 核验为**全部落实**）。
  本版为原位修订的当前一致设计：R4（CT-8⑤ 环安全零变异观测，§12.1）/ R5
  （`InternalError` 单一类身份 import）逐条落实，O1–O4 采纳修订（O5 无需修订）；失效措辞
  （stringify 观测口径、自有类定义、d1 根形态误述、漂移锚点）已就地删除或改写；映射见 §14
- 任务：**Feature（纯加法）**——`renderProjectionText` 经 `@nomicore/vfsl` 公共入口导出
  （ADR 0027 决策 2/3、验收缝 1）；钉死 SA6 契约 §12.9 的 P1–P5 设计待钉项与公共 API 细节
- 基准 HEAD：`12674544d2f24eb7d47c47ca4613b894043711d4`（= SA6 契约 / SA8 报告登记值，
  本次 `git rev-parse HEAD` 复核一致；`origin/adr0027-projection-text` 同 SHA——父分支
  只含 ADR 0027 设计基线，无实现）
- 交付边界：本设计**不含实现与测试**（dispatch 明令）；SA3 按 §7/§11 落地，SA7 按 §12 验收

---

## 1. 任务类型、目标与非目标

**任务类型**：Feature——能力缺口（SA6 契约 §5/§8 已证明：公共面 20 导出中无
`renderProjectionText`，全仓 0 符号命中，静态 import TS2305 红）。

**目标**：

1. `@nomicore/vfsl` 新增 1 个值导出 `renderProjectionText(projection, truncations?)`——
   零选项、同步、纯函数、逐字节确定（ADR 0027 决策 2）；
2. 按 ADR 0027 决策 3 的规范文法渲染投影文本：字段行 / 标量域照源文法拼写 / Record 与
   union 形态 / 别名块闭包发现序 / first-line 口径 / docs 文本防御 / `‡` 位标 + 页脚 /
   `[...]‡` 如实 / 可见性切片不增删 / ✂ 段在场时才出现；
3. 钉死 P1（无渲染宿主 docs 键）、P2（后缀歧义 tie-break）、P3（`xml` 拼写）、
   P4（排版逐字行格）、P5（truncations 类型名/导出），并钉死 SA8 D18 建议的畸形投影
   失败语义；
4. **（本版新增，R1–R3）**钉死裸宿主行（`名:` / `type X =` 后接展开）的注释归属；
   钉死 optional 在全部宿主位 × 全部内层形态（含块形态）的 `?` 合成；把环终止与
   畸形输入 `InternalError` 从「酌情验收」升级为**强制验收契约**（CT-8/CT-9）；
5. 冻结面零触碰：resolver 语义、readData 公共面、doc-runtime 值通道、20 个既有导出、
   wire / 持久化 / 诊断日志 / 复制面、ADR 与 CONTEXT 词汇。

**非目标**（后续票 / 明确出范围）：

- 头行 `# readData [<path>] {depth:N}` 前贴——readData 组合层职责（ADR 0027 决策 2；
  缝 2 票）。渲染器不知道实参 path，产出头行 = 伪造事实（SA6 §11 排除项；G1.4 反断言）；
- 恒四键 readData、`truncations` 键删除、detach 深拷贝退役（ADR 0027 决策 1/4；缝 2/缝 3 票）；
- 破坏性 minor bump（ADR 0027 决策 5 的破坏面 = readData 交付形态变化，挂缝 2 票）；
- 投影文本缓存、value-aware 渲染、marker 紧凑表示（ADR 0027 开放问题，不动）；
- 修改 `docs/`、`CONTEXT.md`、新增 ADR（ADR 0027 已写完词汇；本设计的文法钉死属其
  文法粒度内的实现钉死，SA8 §5 已裁定不构成 ADR/CONTEXT 修订）。

---

## 2. 当前行为与证据锚点

| 事实 | 锚点 |
| --- | --- |
| `resolveSchemaAtPath(derived, path[, options])` 返回 ok 四件套 `{valueSchema, aliases, docs, aliasDocs}`（+`ok:true`）；预算读 value/闭包成员值位可含 `SchemaTruncationMarker` | `packages/vfsl/src/resolve-schema-at-path.ts` L103–118（`ReadDataSchemaProjection`/`BudgetedReadDataSchemaProjection`）、L76–92（marker/clue） |
| **单候选终点原样返回候选节点**（ref 终点 → 根 = `ref` 节点，渲染为别名名直写）；多候选 = 合成 union（恰 `kind`+`members` 两键、恒无判别式）；读路径终点保留字段值原样节点 ⟹ **投影根可为 optional 包装** | `resolve-schema-at-path.ts` L300–333（终点合成区：单候选原样 L304–305、多候选合成 L304–306、预算分支 `budgetShell` L317–323——O2 锚点修正，原引 L589–595 实为值侧规范化区）；#272 夹具 `VALUE_ROOT` L163–169（`config` = `optional{object{retries}}`）、L160（`notes` = `optional{scalar}`） |
| ValueSchema 冻结 11 kind：`object{fields,keyPattern?}` / `array{element}` / `xml` / `union{members,discriminator?}` / `enum{values}` / `pattern{regex}` / `int{min?,max?}` / `range{min,max}` / `scalar{type}` / `optional{value}` / `ref{name}`；**optional「仅对象字段 ?: 包装」**（求值器产出位）；**int 零参形态两键皆缺席、带参形态两键必在场**（both-or-neither 契约） | `packages/vfsl/src/derived.ts` L44–58（L51–53 int 契约注释、L57 optional 注释） |
| docs/aliasDocs 键 = 绝对语法路径（`ROOT.x`、`Alias.<member 0>`、`<item>`/`<key>`/`<member N>` 合成段，`.` 连接）；内容 = `readonly string[]`（field→marker→member 末位合并）；空合并过滤 | `resolve-schema-at-path.ts` L799–860（`sliceDocs`）；`derived.ts` L83–96 |
| 别名表键序 = 闭包发现序（插入序物化） | `resolve-schema-at-path.ts` L417–431（`closureOrder`/`aliases()`）、L753–797 |
| 预算 docs 切片：docs 在场 ⟺ 位置在返回的预算类型树可见（已渲染宿主槽位随宿主）∪ 脊柱键；`[]` d1 保留全部 10 个 ROOT 字段槽位键（含 `ROOT.inlPair`） | 同上 L326–333；ADR 0024 #359 amendment；夹具 `BUDGET_DOCS_MATRIX` L300–318（d1 键集）、`BUDGET_NO_BUDGET_DOCS_KEYS` L73–92（含 L83 `ROOT.inlPair`，内容 `内联联合位`） |
| 截断标记成员级线索：ref 名优先、无 ref 名时容器 kind | `resolve-schema-at-path.ts` L76–89、L449–538（`BudgetWalk.render`） |
| 预算游走两相环防御：`inProgress` 对环重入**透传原节点引用**（不构造、不 emit、不抛）；`memo` 对 DAG 记忆化——**带环投影是 resolver 设计内合法产物**（充足预算/无预算读的输出含环） | `resolve-schema-at-path.ts` L399–407（类注释）；夹具环构造器 `optionalRingDerived`/`optionalTwoCycleDerived`/`unionRingDerived`/`containerRingDerived`（`resolve-schema-at-path-budget-fixture.ts` L489–574） |
| 公共面 20 值导出、无 `renderProjectionText`；全仓生产源 0 命中 | `packages/vfsl/src/index.ts` L139–169（resolver 导出块 L139–149）；SA6 E1/E2 探针（本仓复核 grep = 0 命中，2026-09-13） |
| doc-runtime 值通道截断条目 `ReadLogicalValueTruncationEntry = { path: readonly (string\|number)[]; kind: 'depth'\|'width'; omitted: number }` | `packages/doc-runtime/src/read.ts` L88–92 |
| vfsl 零运行时依赖（真叶包）；公共 API 只经 `src/index.ts`；IR/派生物环境中立、JSON 可序列化；判别联合纪律 + trusted-domain `InternalError` 例外（**唯一定义于 `resolve.ts` L26–31**：`export class InternalError extends Error`、构造器置 `name = 'InternalError'`；跨模块 import 消费——`resolve-schema-at-path.ts` L57 / `validate.ts` L39 / `evaluate.ts` L20 / `validate-patch.ts` L33 四处，**不经 index 导出**） | `packages/vfsl/package.json`（无 dependencies）；`packages/vfsl/AGENTS.md` L9–14；`packages/vfsl/src/resolve.ts` L26–31；本仓 grep 复核（R5 事实基线） |
| 源文法权威：`string & Pattern<"…">` / `number & Int[<min, max>]` / `number & Range<min, max>` 交集白名单；enum 字面量联合；`Record<K, V>`；`T[]`；联合前导 `\|`；**`?:` 是（字段）可选属性修饰符——类型位无 `?` 语法**；**括号分组不在子集**（`( string \| number )[]` → VFSL-E100） | `docs/vfsl/v1-spec.md` §2 EBNF + 注记 1–8（L32、L129） |
| 渲染拼写只保留约束侧（`Int<1, 9999999999>` 不带 `number &` 基类型）——渲染文法权威 = ADR 0027，v1-spec 权威 = schema 源文本，辖域不同不冲突 | ADR 0027 决策 3；SA8 D5 辖域注记；`docs/adr/0027-readdata-projection-text.md` L38 |
| `YXmlFragment<T>` 求值后值侧 = 不透明 `{kind:'xml'}`（实参丢弃）；`YPlainArray<T>`/`YArray<T>` 值侧同形 `{kind:'array'}` | `packages/vfsl/src/evaluate.ts` L319–334 |
| Record 求值为「恰一个 `<key>` 字段 + 可选 keyPattern」的对象 | `evaluate.ts` L304–310（决策 F2） |
| 测试入口：`vitest.config.ts` include `packages/*/test/**/*.test.ts`、typecheck include `…*.test-d.ts`；根 `pnpm typecheck` 含 `tsc -p packages/vfsl/tsconfig.json`；包 tsconfig include `test/**/*.ts` | `vitest.config.ts` L16–22；根 `package.json` scripts；SA6 §4/§14（E6 实测收集） |

---

## 3. 能力缺口（根因承接）

最深根因 = **能力未实现**（SA6 §8 Step 6）：ADR 0027 决策 2/3 已接受并进 HEAD，实现票
open，父分支 tip ≡ HEAD 无实现可复用。输入契约（resolver ok 四件套 + marker 线索 +
#359 可见性切片）已就绪且有冻结夹具与绿基线（SA6 §4：根 378 files / 4384 tests、
typecheck 0；`BUDGET_NO_BUDGET_DIGESTS['[]']` = `e600851a…` 逐字节对账）。本设计不重复
复现，直接承接。iteration 0 设计的架构方向（渲染器落 vfsl、零选项纯函数、冻结面零触碰、
P1–P5 逐项钉死）经 SA2 两轮评审确认成立；两轮 reject 均不触及架构：iteration 0 的三处
钉死缺口（R1 样张与规则矛盾、R2 optional 合成未 total、R3 设计自加行为无强制验收）已在
iteration 1 闭合并经 SA2 iteration-1 §5/§6 逐项核验；本轮（iteration 1 reject）的 R4
（验收观测口径不可执行）与 R5（失败类身份偏离包内惯例）为本版闭合（§14）。

---

## 4. Owner要求落实

Issue REST comments snapshot 为**空**（任务简报 §Comments；SA6 §2；SA8 §1；SA2 §4
复核一致）——无 owner 补充要求、无 comment ID、无逐字判据需转写。判据全集 = issue 正文
What-to-build + AC + ADR 0027 决策 2/3 + SA6 契约 §12。故本表无行；正文中如出现与 Owner
意图相关表述，均已 §7 逐条对应票面 AC。

---

## 5. 复现和根因承接

| 上游事实 | 证据位置 | 设计响应 |
| --- | --- | --- |
| 能力缺口稳定复现：`hasRenderProjectionText=false`（E1）、符号 0 命中（E2）、TS2305（E3） | SA6 契约 §5/§13 | §7.0 公共 API 落地（index.ts 加法导出 + 新实现文件） |
| 红/绿因果链：红因 = 导出缺失（非环境/入口），控制组恒绿钉死 | SA6 §12.8/§13 | §12 验收映射保留控制组设计（20 导出超集断言等） |
| 输入面探针（E4）：投影只带 docs 绝对语法路径键，不带读路径；存在无渲染宿主的脊柱/终点边键 | SA6 §9 E4 观察 | §7.2 docs 归位算法（P1/P2 钉死：别名精确 + 根树后缀 + 无宿主丢弃） |
| 86 个金标单元（预算 37 + M4 16 + #272 12 + 手造槽位 3 + 文法 9 + 交叉 9）；金标须实现期录制；**86 格输入全部无环** | SA6 §7/§12.3；SA2 iteration-1 §5 prior-R3 行复核确认（原 iteration-0 R3 证据） | §7.1 文法逐字钉死（P4）供快照冻结；§12 录制纪律 + **CT-8 环强制组**（覆盖缺口）；**CT-6 stringify 口径辖域依据（§12.1 边界）** |
| truncations 第二参须与 doc-runtime 条目结构兼容、原样透传 | SA6 §10 下游锚；SA8 D11 | §7.0 签名取结构类型 `ProjectionTruncation`（P5），字段逐一同构 |
| 渲染器对畸形投影输入失败语义未规定（D18 非阻塞建议） | SA8 §2 D18、§7.4 | §7.5 钉死：trusted-domain `InternalError`（loud、可归因）；**CT-9 强制验收** |
| 缝 2 一致性锚 `schema ≡ renderProjectionText(resolveSchemaAtPath(…))` | ADR 0027 验收缝 2 | §10 调用方矩阵登记为跨票台账（本票不实现） |
| SA2 评审 R1（iteration-0 finding，iteration-1 §5/§6.1 核验已落实）：`ROOT.inlPair` docs 键在场但旧样张把 `inlPair:` 渲染为无注释裸行——规则与样张矛盾；`['assets','img1']` 的 `type AssetEntity =`（aliasDocs 在场）同类 | SA2 iteration-1 §5 prior-R1 行/§6.1 逐格重推；`BUDGET_NO_BUDGET_DOCS_KEYS` L83、`BUDGET_DOCS_MATRIX` L309、`ALL_NONEMPTY_ALIAS_DOCS` | §7.1.4 钉死裸宿主行**承载**注释；A.1/A.2 样张修正、A.6 新增 `['assets','img1']` 全格样张 |
| SA2 评审 R2（iteration-0 finding，iteration-1 §5/§6.2 核验已落实）：optional 在根/元素/键值/成员位与块形态内层的 `?` 合成无规则可循；`['config']`（F1 金标 12 路径内）= 根位 `optional{object}` | SA2 iteration-1 §5 prior-R2 行/§6.2 重推；`VALUE_ROOT` L163–169；`BUDGET_NO_BUDGET_DIGESTS['["opt"]']` | §7.1.3 新增 optional 合成总则（四款附着 + 四宿位覆盖 + precedence）；A.5 新增 `['config']` 样张 |
| SA2 评审 R3（iteration-0 finding，iteration-1 §5/§6.3 核验主体落实、残留即 R4）：环终止/畸形守卫验收为「酌情」——无环防御/无守卫实现可全绿通过契约；`…` 类型位记号未登记复查 | SA2 iteration-1 §5 prior-R3 行/§6.3/§7 C2/§8 E2 | §12 CT-8/CT-9 强制化；§7.6 `…` 合成钉死；§15 复查枚举补登；**残留执行性缺陷（CT-8⑤ stringify）由 R4 行承接** |
| SA2 iteration-1 评审 R4：CT-8⑤「调用前后 `JSON.stringify(projection)` 不变」在环投影（循环对象图）上抛 `TypeError: Converting circular structure to JSON`——9 强制格中 7 格不可按字面执行，正确实现伪红 | SA2 iteration-1 §13 R4；`resolve-schema-at-path.ts` L399–407/L434–446（`inProgress` 命中 `return node` 原引用透传——本仓实读复核）；夹具环构造器 `budget-fixture` L489–574 | **§12.1（新增）环安全零变异观测钉死：节点身份保全审计 + 环安全摘要**；CT-8⑤ 改引 §12.1 并明令禁 stringify；`JSON.stringify` 口径仅保留在 CT-6（辖域 = 无环金标输入） |
| SA2 iteration-1 评审 R5：`InternalError` 钉为「新文件内自有同款类」无有效理由绕过既有能力——包内惯例是唯一类定义（`resolve.ts` L26）+ 跨模块 import（4 处），且渲染器本就必须从 `./resolve-schema-at-path.js` import 投影类型，「自包含」不成立 | SA2 iteration-1 §13 R5；本仓 grep 复核：`resolve-schema-at-path.ts` L57、`validate.ts` L39、`evaluate.ts` L20、`validate-patch.ts` L33 全部 `import { InternalError } from './resolve.js'` | §7.0/§7.5/§10.1/§11/CT-9 改为 `import { InternalError } from './resolve.js'`——单一类、单一事实源；`error.name === 'InternalError'` 断言面不变；import 是 DENY 面的只读消费（import ≠ 修改） |
| SA2 iteration-1 评审 O1–O4（非阻塞观察）：§7.2 `['shallow','audit']` d1 根形态误述（M1）；§2 行 2 锚点漂移（M2）；union 成员为 enum 的嵌套 `\|` 视觉不可分（O3）；optionalRing d1 含 `…` 属超集一致、防 SA7 误判（O4） | SA2 iteration-1 §14 | O1→§7.2 该行二度修正（d1 根 = `Audit` 单行直写，本仓 marker 矩阵 L196–198 复核）；O2→§2 锚点改 L300–333（本仓实读复核）；O3→§13 L7 已知限制登记；O4→§12 CT-8④ 半句澄清 |

## 6. SA8约束落实

| 决议或义务（SA8 relevant_decisions / conflict_report） | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
| --- | --- | --- | --- |
| D1 公共 API 只经 `src/index.ts`；置于 ADR-0016/0024 导出块之后，注释锚 ADR 0027 决策 2/3 | §7.0、§11 | index.ts 加法 re-export + `export type`；20 既有导出不动 | 复查项（新增公共 API——见 §15） |
| D2 零选项签名、同步纯函数、逐字节确定；`RenderProjectionOptions` 已否决 | §7.0、§7.7 | 两参签名，无第三参/无选项对象；无 memo/跨调用状态 | 否（直接兑现） |
| D3 入参 = `ReadDataSchemaProjection` 系（公共类型保留、包面零破坏） | §7.0 | 签名收 `ReadDataSchemaProjection \| BudgetedReadDataSchemaProjection` 联合（G1.6/G1.7 双入参） | 否 |
| D4 渲染器不产出头行（头行归组合层） | §1 非目标、§7.1.0 | 文法无头行元素；G1.4 反断言成立 | 否 |
| D5 标量域/Record/union/T[]/ref/optional 拼写照 ADR 0027 决策 3 | §7.1 | 逐字钉死（含约束侧-only 数值拼写、` \| ` 分隔、100 列折行、`名?:` 字段吸收、**§7.1.3 非字段位 `?` 合成**——R2） | 否（§7.1.3 属文法粒度内钉死，但为**新裁决面**，已并入 §15 枚举） |
| D6 别名块 = 闭包发现序 | §7.1.0 布局序 | `Object.keys(aliases)` 键序即块序；未引用别名照样渲染 | 否 |
| D7 口径恒 first-line + 敌意 docs 防御 | §7.1.5 注释规则 | 首条目 + `…`、换行折叠、trim、行尾注释不越行 | 否 |
| D8 `‡` 位标 + 一行页脚；`<name>‡` / `[...]‡` 不编造 | §7.4 | 逐字钉死（含页脚文案、计数 m+1 语义、optional/环组合形态） | 否 |
| D9 可见性切片不增删：已渲染宿主槽位 docs 在场、被截闭包省略 | §7.2 | docs 归位只按「投影表在场 + 位置已渲染」；加无宿主键零输出变化（§7.2 P1） | 否 |
| D10 ✂ 段：在场才出现；逐条 path/kind/omitted；缺席/undefined/`[]` 三者逐字节相同且无 ✂ | §7.4 | 逐字钉死段格式；空清单短路；空路径钉 `[]` 拼写（N5） | 否 |
| D11 truncations 结构兼容 doc-runtime 条目（叶包不得引 doc-runtime） | §7.0 | 结构类型 `ProjectionTruncation`（P5）；vfsl 零依赖不变 | 否 |
| D12 T1 纯加法、不触碰 resolver/namespace-runtime/doc-runtime | §11 DENY LIST | 文件范围钉死 | 复查项（快照冻结后按 frozen surfaces 核对 diff——SA8 §7.5） |
| D13 minor bump 挂缝 2 票 | §10 台账 | 本票不动版本号 | 否 |
| D14 同步、确定、环境中立、无 Yjs 关注、无 I/O/时钟/缓存 | §7.6、§9 | 纯函数实现纪律 | 否 |
| D15 P1–P5 由设计门先钉，且「不得为归位伪造位置或路径」 | §7.1–§7.4、§7.7 | 本设计逐项钉死（见 §7.7 备选记录）；**本版新增 R1 裸宿主行注释归属、R2 非字段位 `?` 附着两处文法粒度内新裁决面** | 复查项（P1 丢弃决策、P3 拼写、R1/R2 新裁决面——SA8 §9(b)；见 §15） |
| D16 既有 resolver 面为恒绿控制组 | §12 | 控制文件规格承接（SA6 §12.8） | 否 |
| D17 typed Namespace 写纪律不适用（不碰写路径/生成物） | §1 | 无写路径改动 | 否 |
| D18 畸形投影失败语义建议钉 loud、可归因 | §7.5、§12 CT-9 | `InternalError`（沿 ADR 0016 trusted-domain 先例）；**本版升级为强制验收（CT-9）+ 通道裁定列入 §15 复查枚举**（R3） | 复查项（trusted-domain 例外向渲染器延伸属新裁决面——见 §15） |

---

## 7. 设计决策与主要备选方案

### 7.0 公共 API（含 P5 钉死）

新文件 `packages/vfsl/src/render-projection-text.ts`；`src/index.ts` 在 resolver 导出块
（现行 L139–149）之后追加（注释锚：ADR 0027 决策 2/3、issue #363）：

```ts
export { renderProjectionText } from './render-projection-text.js';
export type { ProjectionTruncation } from './render-projection-text.js';
```

实现签名（零选项；同步；返回 `string`）：

```ts
/** ✂ 段条目（ADR 0027 决策 2/3；与 doc-runtime ReadLogicalValueTruncationEntry 结构同构——
 *  叶包不引 doc-runtime，以结构类型保证 T2 组合层原样透传零转换）。 */
export interface ProjectionTruncation {
  readonly path: readonly (string | number)[];
  readonly kind: 'depth' | 'width';
  readonly omitted: number;
}

export function renderProjectionText(
  projection: ReadDataSchemaProjection | BudgetedReadDataSchemaProjection,
  truncations?: readonly ProjectionTruncation[],
): string;
```

- **P5 裁定**：导出加法类型 `ProjectionTruncation`（非硬判据但采纳 SA6 §12.9 建议），
  字段与 `ReadLogicalValueTruncationEntry` 逐字段同构（`path` readonly 开放数组、
  `kind` 封闭两值、`omitted` number）→ SA6 §12.2 结构断言（`TruncationEntryLike` 可赋值、
  `kind:'height'`/`omitted:'2'`/`path:'x'` `@ts-expect-error` 反例）天然成立；
- 签名收**联合**：`ReadDataSchemaProjection`（默认 V=ValueSchema）与
  `BudgetedReadDataSchemaProjection`（V 含 marker）互不子类型，联合使 G1.6/G1.7 双入参
  编译；resolver ok 结果（多 `ok:true` 键）结构可赋值——T2 **窄化 ok 分支后**可直传
  `renderProjectionText(result)`（resolver 返回 ok|fail 判别联合，`ResolveSchemaAtPathResult`
  L121–128；直接透传联合不编译——N1 措辞修正）；
- 零选项验证面：第三参（arity 错误）与选项对象第二参（不匹配
  `readonly ProjectionTruncation[]`）均在类型面拒绝（G1.8）；
- `truncations === undefined`（缺省/显式）与 `[]` 运行时同路：无 ✂ 段，三者逐字节相同
  （G1.3/CT-5）；非空清单按**输入顺序**逐条渲染（乱序输入亦逐字节确定，不重排）；
- 除上述 1 值导出 + 1 类型导出外，index.ts 零改动；20 个既有导出名保持在场（超集断言）；
  渲染器内部复用的 `InternalError` 类**经 `import { InternalError } from './resolve.js'`
  复用包内唯一定义（R5 钉死）**：类定义唯一在 `resolve.ts` L26–31（`export class
  InternalError extends Error`、构造器置 `name = 'InternalError'`），与
  `resolve-schema-at-path.ts` L57 / `validate.ts` L39 / `evaluate.ts` L20 /
  `validate-patch.ts` L33 四处既有消费方同一路线（import 是只读消费，不修改 `resolve.ts`）；
  渲染器不重复定义、不新增第二个类身份，也不经 index 导出该类（§7.5）。

### 7.1 渲染文法总纲（P4 钉死）

以下为**规范性钉死**：实现与金标快照都必须逐字符合；SA3 不得引入此处未定义的形态。
术语：**结构前缀** = 行内首个 ` // ` 之前的文本；**结构行** = 结构前缀非空的行；
**宿主行** = 承载某类型位置的行（字段行 / 联合成员行 / 别名头行 / 根表达式行）；
**裸宿主行** = 宿主行上无类型表达式、后接展开形态的行（`名:`、`type X =`）。

#### 7.1.0 顶层布局与物理格式

1. 组装序：**正文**（valueSchema 渲染）→ 每个别名块 → `‡` 页脚（仅当标记数 m>0）→
   ✂ 段（仅当 truncations 非空）。相邻段落间恰 1 个空行；段内无空行；
2. 别名块序 = `Object.keys(aliases)` 键序（闭包发现序同源；D6）；未引用别名照样渲染
   （渲染器呈现输入表，不自作闭包再收窄——CT-4）；
3. 缩进：每级 2 空格；行终止 `\n`；输出以恰一个 `\n` 结尾（每行均终止）；无尾随空白；
4. 正文不含头行（D4）：任何单元格输出不含 `# readData [`。

#### 7.1.1 类型表达式（单行 inline 形态）

| 节点 | 拼写 |
| --- | --- |
| `scalar` | `string` / `number` / `boolean` / `null` / `unknown`（type 逐字） |
| `pattern` | `Pattern<"…">`——regex 经 `JSON.stringify`（重转义自包含、单行安全） |
| `int`（min/max 缺席） | `Int` |
| `int`（带参） | `Int<min, max>`（`", "` 分隔；数字 `String(n)`） |
| `range` | `Range<min, max>` |
| `enum` | 值以 ` \| ` 连接：字符串经 `JSON.stringify`（`"on"`）、数字裸写（`1 \| 2`）；声明序 |
| `xml` | `YXmlFragment`（P3 裁定，见 7.3；裸拼写，无 `<T>` 实参——值侧实参已丢弃） |
| `ref` | 别名名逐字直写（D5「ref 直写别名名」） |
| 截断标记 | ref 线索 → `<别名名>‡`（名直写 + `‡`，无尖括号）；container 线索 → 字面 `[...]‡`（不编造类型名，ADR 0024 决策 5 冻结面 / ADR 0027 已知限制 3） |
| 环省略 `…` | 重入祖先节点位渲染 `…`（U+2026；§7.6）——**属 inline 形态表达式**，与 `?`/`[]`/Record 值位/联合成员的组合照本表与 §7.1.3 普通合成（`…?`、`…[]`、`Record<string, …>`、`\| …`） |
| `optional`（非字段值位出现时） | `<内层>?`——内层拼写后缀 `?`；**全部宿主位 × 全部内层形态（含块形态）的合成细则见 §7.1.3（R2 钉死）**；字段值位吸收为 `名?:`（嵌套 optional 链任意位置解包为单个 `?`） |
| 空对象（0 字段） | `{}`（任何位置均 inline——内部无位置可载 docs，结构天然 docs 无关） |
| Record 形对象 | `Record<string, T>`（T 为 inline 表达式；keyPattern 呈现见 7.1.5） |
| 数组（元素为 inline 形态） | `T[]`（后缀紧贴，如 `string[]`、`Mode[]`、`Record<string, Mode>[]`、`Audit‡[]`、`string?[]`（可选元素）、`…[]`（环元素）） |

**precedence 边界（强制）**：

1. 元素为 **union/enum** 的数组**不得**写 `T[]`（`"p" | "q"[]` 按源文法读作
   `"p" | ("q"[])`，失真）——走 7.1.2 展开形态。Record 值位因 `<` `,` `>` 定界无此问题
   （`Record<string, "x" | "y">` 合法 inline）；
2. **（R2）非字段位的 optional 不得把 `?` 后缀于 ` \| ` 联合形态之后**（`"a" | "b"?`
   读作末成员可选，与第 1 款同类失真）——optional 包裹 enum 且处于非字段位时 enum
   **强制折行**（无视 100 列阈值；触发条件是类型形状而非 docs 在场，docs 无关性不破；
   见 §7.1.2/§7.1.3）；optional 包裹 union 时 union 既定恒展开，`?` 落首成员行
   （§7.1.3）。

#### 7.1.2 块形态（多行展开）

**统一裁定：结构形态选择与 docs 在场与否无关（docs 无关性）**。理由：CT-4「清空
docs/aliasDocs → 结构行逐行相同（仅注释不同）」与「删某 docs 条目 → 其余结构行不变」
要求结构不随 docs 漂移；一切「有 docs 才展开」的方案均违反（见 7.7 备选 3）。

| 形态 | 规则 |
| --- | --- |
| **对象块**（非 Record 形、非空） | 恒为块（任何位置）：开行 `{`、字段行缩进 +1、闭行 `}` 对齐开行。开行形态按宿主：根位置独占一行 `{`；字段值位 `名: {`；联合成员 `\| {`；别名体 `type X = {`；数组元素位独立块；Record 值位独立块。**optional 包裹的开行变体（R2）：`{?`、`名?: {`（吸收）、`\| {?`、`type X = {?`——细则见 §7.1.3** |
| **union 展开** | 恒展开：每成员一行 `<缩进>\| <成员>`（前导 `\|` + 空格，ADR 决策 3「union `\| { … }`」形态）。成员为对象 → `\| {` 开块；成员为 inline 形态 → 单行 + 行尾注释。判别式（discriminator）**不渲染**（非契约缓存，ADR 0003 §3；「不特判判别式」）。多候选合成 union 同形态。根位无宿主行：成员行直接从缩进 0 起（A.7）；字段位宿主行 `名:`（裸宿主行，§7.1.4）后成员行缩进 +1 |
| **enum 折行** | inline 优先：`<名>?: "a" \| "b"`（根位即裸表达式行 `"a" \| "b"`；别名头位 `type X = "a" \| "b"`）。**当且仅当**结构前缀（缩进 + 宿主前缀 + enum inline 表达式，**不含注释**）按 UTF-16 码元计 **> 100**，或 **该 enum 被 optional 包裹且处于非字段位**（§7.1.1 precedence 第 2 款）时折行：**首值留在宿主行**（根位即首值行 `"a"`；别名头 `type X = "a"`；字段位 `名?: "a"`），其余每值一行 `<缩进+1>\| "值"`（+ 行尾注释）。折行触发只看列宽/类型形状，不看 docs（docs 无关性；N3 钉死：统一「首值留宿主行」） |
| **数组展开** | 元素为对象块 / union / enum 时：宿主行只写 `名:`（裸宿主行，§7.1.4；根位置无宿主行），元素块/成员行缩进 +1，随后独占一行 `<缩进>[]` 作闭合（数组后缀不与任何值同行，避免 precedence 失真）。元素为 inline 形态（含标记、Record、ref、空对象、可选元素 `T?`、环省略 `…`）时用 `T?[]` / `…[]` 等 inline 合成 |
| **Record 展开** | 值为对象块 / **union** / 超宽 enum（或 §7.1.1 强制折行 enum）时：宿主行 `Record<string,`（根位即该行、字段位 `名: Record<string,`、别名头 `type X = Record<string,`），值块/成员行缩进 +1，随后独占一行 `<缩进>>` 闭合。值为 inline 形态时 `Record<string, T>` 单行（含可选值 `Record<string, T?>`）。union 值位与数组元素位同属 precedence 安全的展开触发（`Record<string, A \| B>` 虽因定界合法 inline，但 union 恒展开优先） |

Record 形判定（精确）：对象 `fields.length === 1 && fields[0].name === '<key>'` →
`Record<string, T>`（T = 该字段值渲染）；keyPattern 无论 docs 与否照 7.1.5 呈现。
手造「`<key>` + 其他字段」对象不属 Record 形 → 按普通对象块渲染（`<key>` 作普通字段行）。

#### 7.1.3 optional 合成（R2 钉死：全部宿主位 × 全部内层形态）

**前提事实**：求值器产出的 optional 只在对象字段值位（`derived.ts` L57「仅对象字段
?: 包装」；v1-spec §2 L32 `?:` 可选属性修饰符）；但读路径终点原样保留字段值节点 ⟹
**投影根可为 optional 包装**（resolver L301–306；#272 `['config']`、`['notes']`，
预算夹具 `['opt']`）；预算游走环重入透传与手造派生物可在任意宿主位出现 optional。
渲染器输入类型不禁止这些形态，「渲染不增删投影内容」一视同仁 ⟹ 文法必须 total 钉死
`?` 的呈现（iteration 0 只钉了 inline 合成与字段吸收，块形态与其余宿主位未钉——R2）。

**optional 链解包**：任意深度嵌套（`optional{optional{…}}`）解包为单个 `?`（与字段位
既定规则一致；层数不是渲染契约事实）。

**字段值位吸收（既定，优先于一切附着规则）**：`?` 前置进字段名——`名?: <inline>` /
`名?: {` / `名?:`（后接展开）/ `名?: <名>‡` / `名?: [...]‡`。适用于一切内层形态。
字段位是唯一把 `?` 放进宿主前缀（名后）的位——源文法 `?:` 字段修饰符形态（ADR 0027
决策 3 字段行拼写 `名?: 类型`）。

**非字段位附着总则**：`?` 附着于「该 optional 内层渲染区域的定界行」的**结构前缀末尾**
（任何行尾注释之前），按内层形态分四款：

| 款 | 内层形态 | `?` 落点 | 形态例 |
| --- | --- | --- | --- |
| ① | inline 表达式（scalar/pattern/int/range/xml/ref/截断标记/环省略/内联数组 `T[]`/内联 Record/空对象） | 表达式后缀 | `string?`、`Mode?`、`[...]‡?`、`…?`、`string[]?`、`Record<string, Mode>?`、`{}?` |
| ② | 对象块 | 块开行前缀末尾 | `{?`（根/元素/Record 值位）、`\| {?`（联合成员位）、`type X = {?`（别名头位） |
| ③ | 数组展开 / Record 展开 | 闭行之后 | `[]?`、`>?`（展开形态的开行属内层元素/值或 Record 定界，`?` 放闭行避免误归因到元素/值自身） |
| ④ | union 展开 / enum 折行 | **首成员行**前缀末尾 | `\| {?`（对象成员，同款②）、`\| string?`、`\| "a"?`（enum 首值留宿主行时即宿主行 `"a"?` / `type X = "a"?`） |

**四宿主位覆盖表**（根 / 数组元素 / Record 值 / 联合成员；字段位见上；别名头位同根位
语法）：

| 宿主位 | 内层 inline（①） | 内层对象块（②） | 内层数组/Record 展开（③） | 内层 union/enum 展开（④） |
| --- | --- | --- | --- | --- |
| 根 | `string?`（F1 `['notes']` 金标格） | `{?` … `}`（A.5 = F1 `['config']` 金标格） | 元素/值区 … `[]?` / `>?` | 首成员行 `\| …?`；enum 首值行 `"a"?` + 续行 |
| 数组元素 | `string?[]` | 元素块 `{?` … `}` + `[]` | 嵌套展开，`?` 落**最内被包裹层**的闭行 `[]?`/`>?` | 元素区首行 `\| …?` / `"a"?` |
| Record 值 | `Record<string, string?>` | `Record<string,` + `{?` … `}` + `>` | 嵌套展开，`?` 落最内被包裹层闭行 | 值区首行 `\| …?` / `"a"?` |
| 联合成员 | `\| string?` | `\| {?` | 成员区 … `[]?`/`>?`（`?` 落最内被包裹层闭行） | 嵌套 union：首成员行 `\| …?` |
| 别名头 | `type X = string?` | `type X = {?` | `type X =` 后接展开，`?` 落最内闭行 | `type X =` 后接展开，`?` 落首成员行 |

- 「最内被包裹层」：`?` 唯一对应它所包裹的那一层渲染区域——嵌套组合（如
  `optional{array{element: object 块}}` 的元素块展开 + 数组闭行）中每层 optional 各自
  按其内层形态落点，互不抢占；
- 语义无损不变量：任何投影中的 optional 包装（求值产物、预算透传、手造）在输出中
  `?` 恰呈现一次（链解包后）；「静默丢 `?`」= 内容损失，禁止（SA2 R2）；
- 敌意/罕见手造组合（optional 包裹 union、enum、嵌套数组展开等）金标矩阵无格，由
  §12 CT-2 的 F1 `['config']`/`['notes']` 金标格 + 设计推导覆盖，读感代价登记 §13 L6。

#### 7.1.4 字段行 / 成员行 / 头行 / 裸宿主行（R1 钉死）

- 字段行：`<缩进><名><?>: <inline 表达式>` 或 `<缩进><名><?>: {`（开块）或
  `<缩进><名><?>:`（**裸字段宿主行**，后接 union/数组/Record/enum 展开）。`?` 当且仅当
  字段值（完全解包后）曾为 optional 包装；
- 联合成员行：`<缩进>| <inline 表达式>` 或 `<缩进>| {`（开块）；
- 别名头行：`type <名> = <inline 表达式>` / `type <名> = {` / `type <名> =`
  （**裸别名宿主行**，后接展开）；
- 闭行 `}` / `>` / `[]` 独占一行，不携注释（`[]?` / `>?` 的 `?` 是结构记号，非注释——
  闭行携结构记号但不携 ` // ` 注释）；
- **裸宿主行注释归属（R1 裁定：承载）**：裸宿主行是该位置（字段位 / 别名头位）的
  **呈现行**——归位到该位置的 docs 条目与（别名头位的）aliasDocs 条目照常以行尾注释
  呈现，与行的形态（inline / 开块 / 裸）无关。即：

  ```
  inlPair: // 内联联合位
      | { … }
  type AssetEntity = // 资产实体：封闭联合
    | { … }
  ```

  依据：① §7.1.5 第 1 款「注释 = 归位到该行的 docs 条目集合」+ §7.2 规则 3（`ROOT.inlPair`
  尾缀 `[inlPair]` 命中正文位置 `inlPair`）+ SA6 CT-4「每个有宿主的 docs 条目文本出现
  在其位置所在行」三处共同要求承载——裸宿主行就是「该位置所在行」；② 备选「裸宿主行
  不载注释」（§7.7 备选 10）迫使为 CT-4 的「有宿主」补第二义（「有类型表达式的行」），
  断言边界复杂化且有信息损失。夹具确证：`ROOT.inlPair` docs 键在 `[]` 无预算
  （`BUDGET_NO_BUDGET_DOCS_KEYS` L83）与 `[]` d1（`BUDGET_DOCS_MATRIX` L309）均在场；
  `AssetEntity` aliasDocs 在场（`ALL_NONEMPTY_ALIAS_DOCS`）。

#### 7.1.5 行尾注释（口径 first-line + 防御，D7）

一行至多一段 ` // ` 注释，位于该行结构前缀之后（裸宿主行的结构前缀即整个宿主前缀，
如 `inlPair:` / `type AssetEntity =`；`{?` / `[]?` 等结构记号亦属结构前缀）：

1. **归位到该行的 docs 条目集合**（算法见 7.2）+（别名头行）aliasDocs 条目，排序：
   aliasDocs（按 aliasDocs 表键序）在前，docs 条目按**键字典序**（UTF-16 码元序）在后；
2. **每条目渲染**：取 `entries[0]`，把 `\r\n` / `\n` / `\r` 折叠为单个空格，再 strip
   首尾空白；随后若 `entries.length >= 2` 追加 `…`（无空格直贴，ADR 拼写「口径首行…」）。
   第 2 条及以后的文本不得出现在输出（CT-4）；注释段内无裸换行（折叠保证）；
3. **多条目拼接**：渲染结果以 ` · `（U+00B7，两侧空格）连接；全部为空 → 整段注释省略
   （该行无 ` // `）；
4. **keyPattern 后缀**：对象携 keyPattern（Record 形或手造对象）时，在该对象**开行**
   （Record 行 / `{` 行）注释末尾追加 ` · keyPattern: <JSON.stringify(regex)>`
   （docs 为空时注释即 `// keyPattern: "…"`）。keyPattern 呈现与 docs 无关（ADR 决策 3
   「行尾 keyPattern 注释」是 Record 拼写的一部分；CT 负断言夹具均无 keyPattern，无交叠）；
5. **防御不变量**（CT-4 敌意用例的机制根源）：注释只出现在完整结构前缀之后、永不置于
   闭行、永不内嵌于类型表达式（`}`、`|`、`>`、`?` 永不被注释吞没）→ 敌意文本与良性孪生
   「行数相同 + 结构前缀逐行相同」由构造保证。

### 7.2 docs 归位算法（P1 / P2 钉死）

渲染器把 docs / aliasDocs 条目归位到**已渲染位置**；位置标识 = 相对路径段序列（自渲染
锚点到该位置，`.` 连接，合成段 `<item>` / `<key>` / `<member N>` 逐字）。**「已渲染位置」
包含裸宿主行**：字段位（无论该行 inline、开块还是裸）、别名头位（同理）、
`<item>`/`<key>`/`<member N>` 槽位、inline 表达式内的成员值位（枚举值/联合 inline 成员
——注释合并于其所在行，§13 L2 已知限制）。

**位置集**：

- 正文（valueSchema）树内每个已渲染位置：根位置（相对路径 `[]`）+ 内部位置
  （字段名 / `<item>` / `<key>` / `<member N>` 逐段累积；标记替换类型不替换位置——
  标记所在行照常承载该槽位 docs，#359「槽位随宿主」）；
- 每个别名块 A（A ∈ `Object.keys(aliases)`）体内位置：相对路径以 A 为锚。

**归位规则（按序适用）**：

1. **aliasDocs**：`aliasDocs[A]`（A 在 aliases 表内）→ 别名头行注释（含裸别名宿主行，
   §7.1.4）；不在表内的 aliasDocs 键无宿主 → 丢弃；
2. **别名块精确归位**：docs 键 `K` 的首段 ∈ aliases 键集 ⟹ K **专属**锚定到该别名块：
   目标位置 = K 去首段的相对路径；该位置已渲染则归位，否则丢弃（**不回流**到正文后缀
   匹配——锚名可知时让键漂移到正文属错误归因）。`K` 恰等于别名名（单段）→ 归位到该
   别名头行（aliasDocs 之后）；
3. **正文树后缀匹配（P2）**：对正文内部位置（相对路径**非空**），候选键 = 剩余 docs 键
   （首段非 aliases 键集成员者）中「键段序列尾部 == 位置段序列」者（允许等长完全相等）；
   - 恰一 → 归位；多个 → **字典序最小键胜出**（UTF-16 码元序；与 docs 表键插入序无关，
     保证同内容不同键序的输入输出一致）；其余丢弃；
   - 无 → 不归位；
   - 正文**根位置（相对路径空）永不匹配**——空后缀退化匹配一切键，且渲染器不知道读
     路径锚（P1 红线：不得伪造位置或路径）；
4. **P1 裁定：无渲染宿主的 docs 键一律静默丢弃**。覆盖：正文根位锚键（脊柱/终点边键，
   如 `ROOT.shallow`、`Ledger.audit`）、别名块内不存在位置的别名前缀键、后缀匹配落败键、
   无闭包别名的 aliasDocs 键。**不新增汇总段/头注段**。依据（三重）：
   - CT-4 敏感性「增加 1 个未渲染位置（脊柱类）docs 条目 → 输出结构行不变」按行数 +
     结构前缀逐行比较的解释最强——任何汇总段都会增加行，唯一无条件满足的选项是丢弃；
   - ADR 0027 规范文法元素封闭（字段行/别名块/`‡`页脚/✂ 段），新增段落超出 SA8 裁定的
     「ADR 0027 文法粒度内钉死」授权（SA8 §5）；
   - 「不得为归位而伪造位置或路径」——渲染器不知道读路径，任何归位尝试都是编造。
   信息损失登记为已知限制（§13 L1）：根位 docs（被读字段自身的注释）不呈现，消费方读
   父路径或经组合层头行（缝 2）取回上下文。

**实现指引（每调用局部状态，无跨调用缓存）**：先一趟构建「尾缀 → 字典序最小键」映射
（对每个剩余键枚举全部非空尾缀长度），位置查找 O(1)；总成本 O(投影节点数 + docs 键数 ×
平均深度)。

**对照矩阵验证**（设计推演，SA3 以金标冻结；逐格与夹具 docs 键集核对）：

| 单元格 | 推演 | 结果 |
| --- | --- | --- |
| `[]` 无预算（预算夹具，18 docs 键 + 2 aliasDocs） | `ROOT.*` 字段键经尾缀匹配落正文字段行——`shallow`/`pair`/`mode`/`modes`/`modeMap` 落 inline 行，`deep`/`plain`/`opt`/`req` 落块开行，**`inlPair` 落裸字段宿主行（`inlPair: // 内联联合位`，R1）**；`Ledger.*`/`Audit.*`/`Pair.*`/`Mode.*` 经规则 2 锚定各别名块（`type Pair =` 裸别名头行无 aliasDocs ⟹ 无注释；`type Mode = "on" \| "off" // 开 · 关` 成员注释按字典序合并于头行） | A.1 逐字一致 ✓ |
| `[]` d1（10 个 ROOT 字段槽位键在场） | 每个字段槽位键随宿主行在场——标记行 `deep: [...]‡ // 深链位` 等；**`inlPair: // 内联联合位`（裸宿主行，R1）** 后接 `\| [...]‡` 成员行；m=11 ⟹ `‡` 计 12（A.2） | A.2 逐字一致 ✓ |
| `['shallow','audit']` d0/d1（N4 措辞修正；O1 二度修正 d1 根形态） | d0：根 = 标记（ref:Audit）→ 单行 `Audit‡` + 页脚；闭包空 ⟹ 无别名块；docs 键 `ROOT.shallow`/`Ledger.audit` 均无宿主 → **零贡献**（根行无注释）。d1：根 = **`Audit` 单行直写**（ref 终点原样返回 `ref` 节点——终点不经再游走；marker 矩阵 d1 唯一标记 `Audit.notes => container:array` 落**别名块内**、`by` 为标量终态无标记，夹具 L196–198 实读）；Audit 体型块仅为**别名块**（闭包 {Audit}）：`type Audit = { // 审计`（aliasDocs 归位）+ `by: string // 审计员` + `notes: [...]‡ // 备注行`（`Audit.by`/`Audit.notes` 首段 ∈ aliases ⟹ 规则 2 专属锚定别名块）+ 页脚（m=1 ⟹ `‡` 计 2）；`ROOT.shallow`（尾缀 `[shallow]` 无正文匹配位）/`Ledger.audit`（首段 Ledger ∉ aliases={Audit}，尾缀 `[audit]` 无匹配位）→ **该两枚键零贡献，Audit 别名块注释照常在场** | ✓ |
| `['assets','img1']`（F1 金标格，R1 新增推演） | 根 = 单候选原样 `ref{AssetEntity}` → 单行 `AssetEntity`；别名闭包 `{AssetEntity, Audit}`（发现序）；`type AssetEntity = // 资产实体：封闭联合`（**裸别名宿主行承载 aliasDocs，R1**）后接两成员块；`type Audit = { // 审计子文档` + `Audit.createdBy` → `createdBy: string // 谁创建的`（规则 2 精确归位）；`ROOT.assets` 无 docs 条目 | A.6 逐字一致 ✓ |
| `['notes']` / `['config']`（F1 金标格，R2） | `['notes']`：根 = `optional{scalar}` → 单行 `string?`（§7.1.3 款①）；docs `ROOT.config`/`ROOT.notes` 等根位锚键丢弃。`['config']`：根 = `optional{object{retries}}` → `{?` 块（款②，A.5）；`ROOT.config` 丢弃（根位锚） | ✓ |
| `['u','x']`（F1 金标格） | 根 = 合成 union（scalar string ∣ array number，两成员 inline）→ 根位无宿主行，成员行从缩进 0 起：`\| string` / `\| number[]`；成员无 refs ⟹ 闭包空、无别名块 | A.7 ✓ |
| slotDocs `[]` d2 | `ROOT.workRecords.<item>` 尾缀 `[workRecords, <item>]` 命中 `workRecords: WorkRecord‡[]` 行 ✓；`IssueState.<member 0>` 经规则 2 锚定 IssueState 块（正文不串位）✓ | ✓ |
| M4 `ROOT.pair.<member 0>` | 尾缀 `[pair, <member 0>]` 命中成员行 ✓；`IssueState.<member 0>` 规则 2 锚定 IssueState 块 ✓ | ✓ |

### 7.3 P3：`xml` 拼写 = `YXmlFragment`

- 裁定：`{kind:'xml'}` 渲染为 `YXmlFragment`（裸名，无 `<T>` 实参）；
- 依据：CONTEXT「标记类型」词表（`YXmlFragment`，大小写是契约）——值侧 xml 节点与该
  标记 1:1 对应；求值器已丢弃实参（`evaluate.ts` L332），带实参渲染属编造；
- 否决备选：`xml`（非仓内词汇）、`YXmlFragment<{ … }>`（实参不可知，编造）。

### 7.4 `‡` 位标、页脚与 ✂ 段（D8/D10 逐字）

1. **位标**：每个截断标记恰产出一个 `‡`——ref 线索 `<别名名>‡`、container 线索
   `[...]‡`；复合上下文按 §7.1.1/§7.1.2/§7.1.3 组合：字段位 `名?: [...]‡` /
   `shallow: Ledger‡`、数组 `Audit‡[]`、Record 值 `Record<string, Mode‡>`、根位
   inline `[...]‡?`（optional 根）、根位对象块与联合成员的 `‡` 照常落标记自身的
   inline 拼写；
2. **页脚**（恰一行，m>0 时，位于正文与全部别名块之后、✂ 段之前）：

   ```
   ‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。
   ```

   计数不变量：`countOccurrences(text,'‡') === (m===0 ? 0 : m+1)`（m 个位标 + 页脚 1 个）；
   m=0 时输出无 `‡`、无页脚（CT-3）；
3. **✂ 段**（truncations 非空时，文末块——`lastIndexOf('✂')` 之后无正文行）：

   ```
   ✂ 截断事实：
   - <path> · <kind> · 省略 <omitted> 项
   ```

   - `path` = 逐段 `.` 连接（数字段 `String(n)`，如 `items.0`；**空路径渲染为 `[]`**
     （N5 钉死：与数组闭行记号同形，✂ 段语境无歧义，消除双空格观感））；段内换行折叠
     为空格（防御，与 docs 同法）；`kind` ∈ `depth`/`width` 逐字；`omitted` `String(n)`；
     条目序 = 输入序；
   - 缺席 / `undefined` / `[]` 三者输出逐字节相同且无 `✂`（CT-5）；
   - 与 `‡` 共存时序：正文 → 页脚 → ✂（空行分隔）。

### 7.5 畸形输入失败语义（D18 钉死；R3 升级为强制验收）

- **通道裁定**：`projection` 与 `truncations` 按 **trusted-domain** 处理——结构畸形
  `throw InternalError`（**`import { InternalError } from './resolve.js'` 复用包内唯一定义
  ——R5 钉死**，§7.0；`error.name === 'InternalError'` 断言面不变；该类本身不经 index
  导出，渲染器不新增公共面），**不进结果联合、无顶层 catch、无部分输出、无静默降级**。
  依据：ADR 0027 钉死返回 `string`（无法走判别联合）；vfsl AGENTS 判别联合纪律的既有例外即
  trusted-domain `InternalError`（ADR 0016 先例：`resolve.ts` L26–31 唯一定义 + 4 处跨模块
  import 的包内既定惯例，SA8 D18 同精神建议）；正常路径不变量缺失应 fail loud（skill
  铁律）；
- **校验清单**（消息须可归因，含位置/键名）：
  - 浅层：projection 非对象/缺四键（额外键容忍——resolver ok 结果携 `ok:true`）；
    aliases/docs/aliasDocs 非 plain 对象；docs/aliasDocs 值非 string 数组；
    truncations 在场但非数组、条目缺键/类型错（path 非 string|number 数组、kind 非两值、
    omitted 非 number）；
  - 游走期：节点非对象/无 string kind；kind 不在 11 kind + `truncated` 封闭集；各 kind
    载荷畸形（fields 非数组、字段名非 string、enum values 非 string|number 数组、
    pattern.regex 非 string、int/range 界非 number、**int 带参形态两键不同场
    （`{kind:'int',min:1}` 半参——both-or-neither 契约，`derived.ts` L51–53；N2 补洞）**、
    optional/array 缺内层、ref.name 非 string、marker clue 形状非法）；
- **验收（R3①）**：本语义为**强制契约**（CT-9，§12）——抽样（缺四键投影 / 坏 kind /
  坏 truncations 条目 / docs 值非 string 数组 / int 半参）断言 `throw` 且
  `error.name === 'InternalError'`、消息含可归因位置/键名、无部分输出。行为与覆盖同进
  退出（不采用「移除/延期守卫」路线：环与守卫都是 T2 合法读路径的必要行为，移除守卫
  违反 fail-loud 纪律且泄漏裸 `TypeError`——§7.7 备选 13）；
- **边界登记**：敌意 getter/Proxy 的抛错不专门收敛（输入按 resolver 产物信任域对待，
  与 ADR 0016 `derived` 先例一致）；登记 §13 F1 follow-up。

### 7.6 环、共享节点与纯度（D14；R3 强制验收）

- **按名 ref 不递归**：ref 渲染为名字，别名体只在别名块渲染一次——合法递归别名
  （如 `recursiveAliasDerived`）天然终止；
- **对象图环**（预算游走重入透传原引用的合法产物 / 手造：`optionalRingDerived`、
  `optionalTwoCycleDerived`、`unionRingDerived`、`containerRingDerived`，夹具
  L489–574）：渲染 descent 维护**进行中节点集**（栈语义，非全局 visited）：重入即环 →
  该位渲染 `…`（U+2026，「自引用/已在上方展开」诚实省略，**不抛**——此类投影是合法
  产物，T2 readData 组合层会遇到，抛错会把合法读变调用方崩溃）；DAG 共享（非祖先重复）
  照常各自完整渲染；别名体引用主树同环节点：主树完成后栈已弹出 → 别名体内自重入 →
  `…`（若误用全局 visited 会在别名体首层即 `…`——已显式排除）；
- **`…` 的文法地位（R3②）**：`…` 是 **inline 形态类型表达式**（§7.1.1），与 `?` / `[]` /
  Record 值位 / 联合成员的组合照普通合成（`…?`、`…[]`、`Record<string, …>`、`| …`）。
  该记号是 ADR 0027 封闭文法元素（字段行/别名块/`‡` 页脚/✂ 段）之外**首次成文的新
  文法记号**（与 P3 `YXmlFragment` 同类），登记 §15 复查枚举；
- **验收（R3①）**：环终止/确定性/`…` 在场为**强制契约**（CT-8，§12）——三个环夹具 ×
  无预算 + 预算读，断言终止、逐字节确定、透传格含 `…`、零变异（**零变异观测 = §12.1
  环安全审计，不是 `JSON.stringify`——环投影是循环对象图，stringify 抛 `TypeError`
  （R4）**）。不采用「移除环防御」路线：86 金标格全部无环，无环防御的实现可全绿通过
  CT-1…7 后在 T2 合法读上挂死（SA2 C2）；
- **纯度**：零模块级可变状态、零 memo、零 I/O/时钟/随机；不冻结/不变异输入
  （零变异断言分辖域：CT-6 `JSON.stringify`（无环金标输入）+ CT-8⑤ §12.1 环安全审计
  （环输入）；交错断言由构造成立）；每次调用全新对象图（含 7.2 尾缀映射）。

### 7.7 备选方案与否决理由

| # | 备选 | 否决理由 |
| --- | --- | --- |
| 1 | P1 头部/汇总段呈现无宿主 docs 键 | 增加行违反 CT-4 加键敏感性（行数不变）；超出 ADR 0027 封闭文法元素（SA8 §5 授权边界）；归位即伪造 |
| 2 | P2 键插入序 tie-break / 丢弃全部歧义键 / 多键并列渲染 | 插入序使输出依赖 docs 表键序（同内容异序不同输出，削弱确定性）；丢全部/并列渲染信息损失更大且无契约收益；字典序最小 = 序无关、单值、可解释 |
| 3 | 对象/联合「无 docs 时 inline、有 docs 时展开」（源码形态最贴近） | 结构随 docs 在场漂移 → 违反 CT-4 清空/删除敏感性（清空 docs 后 Pair 等块坍缩为 inline，结构行不再逐行相同）——**docs 无关性**为本设计硬约束 |
| 4 | inline 枚举成员注释前缀式（源 M4 形态 `/** 开 */ "on"`） | 注释进入结构前缀区间：敌意 docs 含 ` // ` 或 `}` 时破坏「首个 ` // ` 前缀逐行相同」与结构不变性（CT-4）；注释必须只出现在行尾 |
| 5 | 数组/Record 展开用 `YArray<…>` / 括号分组 `("p" \| "q")[]` | 值侧 array 不区分 YArray/YPlainArray（求值同形）——标记拼写属编造载体事实；括号不在 v1 源文法（v1-spec §2 注记 5 / L129）；`[]`/`>` 独立闭行零发明且 precedence 安全 |
| 6 | 渲染器住独立叶包 / namespace-runtime | ADR 0027 已否决：文法权威单源在 vfsl（resolver、docs 文法、切片规则同包） |
| 7 | 畸形输入走判别联合 / 静默跳过 | 返回类型已被 ADR 钉死为 string（联合不可行）；静默跳过违反 fail-loud；`InternalError` 是包内 trusted-domain 成熟先例 |
| 8 | 环输入 throw / 无限递归 | 合法预算产物含环（BudgetWalk 原引用透传）——throw 把合法读变崩溃；`…` 省略号已在文法词表（口径 `…`）内，语义自洽 |
| 9 | memo/缓存渲染结果 | CT-6 交错不变量（render A → B → A 逐字节同）+ 零跨调用状态纪律；性能在夹具规模无需求 |
| 10 | R1：裸宿主行不载注释（样张方向），同步收窄 CT-4「有宿主」断言边界 | 违反 SA6 CT-4「每个有宿主的 docs 条目文本出现在其位置所在行」的字面义——裸宿主行就是该位置所在行；迫使「有宿主」补第二义（「有类型表达式的行」），断言边界复杂化；且 `ROOT.inlPair`（两格在场）/`AssetEntity` aliasDocs 信息无端损失。承载方案机制统一（注释 = 归位条目集合，与行形态无关） |
| 11 | R2：`?` 统一闭行附着（`}?`）或统一首行附着（数组/Record 展开也标首行） | `}?` 把可选标记放在块尾，读感差且 SA2 建议形态为块开行（`{?`）；数组/Record 展开的首行属内层元素/值——`?` 落首行会误归因到元素/值自身（optional 包的是数组/Record 整体）；分形四款附着表精确、total、每格可唯一推导 |
| 12 | R2：非字段位静默丢弃 `?`（只渲染内层） | 内容损失：optional 语义是投影内容的一部分（「渲染不增删投影内容」）；F1 `['config']` 金标格会把丢 `?` 冻结成事实契约 |
| 13 | R3：环防御/畸形守卫移除或维持「酌情」验收 | 环投影是 resolver 设计内合法产物（重入透传语义 + 四个环夹具在场）——移除防御 = T2 合法读挂死；守卫移除 = fail-loud 纪律失守、泄漏裸 `TypeError`；「酌情」验收使无防御实现可全绿通过契约（86 金标格无环）——两者都必须行为 + 强制覆盖同进退出（CT-8/CT-9） |
| 14 | R2：`"a" \| "b"?` 以「全表达式绑定」解释保留 inline（渲染文法自定义结合规则） | 源文法优先级读感失真（读作末成员可选），与数组先例（备选 5/§7.1.1 第 1 款）的防御口径不一致；强制折行零歧义且 docs 无关性不破（触发条件是类型形状） |

---

## 8. 接口、状态机与数据流

**无状态机**（纯函数）。调用形态与内部流水：

```
调用方 ──(projection, truncations?)──▶ renderProjectionText
  ① 浅层形状守卫（7.5）──畸形→ throw InternalError
  ② docs 归位索引构建（7.2，每调用局部）
  ③ 正文渲染：递归 descent（进行中集 + 行汇；optional 合成按 7.1.3）──节点畸形→ throw
  ④ 别名块渲染（键序）
  ⑤ m>0 → 页脚；truncations 非空 → ✂ 段（truncations 条目校验在 ①）
  ⑥ 行汇 join('\n') + 尾 '\n' → string
```

**数据流路线**（本票新增的唯一运行时数据路径；无持久化/跨进程边界）：

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 投影 → 文本 | 任何持有 resolver ok 产物的消费方（本票：测试；后续：readData 组合层） | 无写入（纯函数，输出 string 新建） | 进程内函数调用；JSON 四件套 + truncations → 确定文本；无 I/O | 无（返回值即交付；快照仅存于测试 fixture 文件） | 模型上下文/断言直接消费 string | 逐字节确定文本（快照可锚定） | `InternalError`（trusted-domain，loud）；无资源需清理 | CT-1…CT-9 |

**本票不改变任何既有运行时数据创建/写入/存储/传输路径**（纯加法导出；resolver、
readData、doc-runtime 数据流原样）。

---

## 9. 错误、恢复、并发和幂等

- **错误**：唯一失败通道 = `InternalError`（§7.5 清单）；消息可归因；无部分输出、无降级
  string、无吞错；调用方可观察结果 = 同步 throw（`error.name === 'InternalError'`）；
- **恢复/重试**：纯函数——修复输入后重调即得全量输出；无资源泄漏面（无 I/O/句柄）；
- **回滚**：实现回滚 = 移除新文件 + index.ts 两行导出（加法，无状态迁移）；金标回滚 =
  删测试四件（见 §11）；
- **并发**：无可变共享状态（每调用局部对象图）——天然可重入；JS 单线程下无竞态面；
- **幂等**：同输入逐字节同输出（零 memo、零时钟/随机/locale 依赖；字典序 tie-break 与
  docs 表键序解耦）；交错调用不变（CT-6）；环输入同样确定（CT-8）。

---

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
| --- | --- | --- | --- | --- |
| `packages/vfsl/src/index.ts` 既有 20 导出的全部消费方（namespace-runtime、doc-runtime、apps、既有测试） | 不感知渲染器 | 完全不变（加法导出；既有符号零改动） | 无 | index.ts L139–169；SA6 §12.8 超集断言 |
| resolver 调用方（readData 组合层，缝 2 票） | 拿 JSON 四件套自行交付 | 拿同一四件套可另获文本；本票不改组合层 | 无（缝 2 票再接线：头行前贴 + 一致性锚 `schema ≡ renderProjectionText(窄化 ok 后的 resolveSchemaAtPath(…))`） | ADR 0027 决策 2/4、验收缝 2 |
| doc-runtime `ReadLogicalValueTruncationEntry` 生产方/消费方 | 值通道截断清单 | 不变；T2 将原样透传给渲染器第二参（结构同构，零转换） | 无（跨票台账） | `doc-runtime/src/read.ts` L88–92；SA8 D11 |
| 新契约测试四件（SA3/SA7） | 不存在 | 经 index 动态接缝 / 静态 import 消费 | 按 §12 与 SA6 §12.1 落成（CT-8/CT-9 断言在红文件内，见 §11） | SA6 §12/§14 |
| DSH 会话级探针工具 | 透传读结果 | 本票零代码改动（文本化在缝 2 生效） | 无 | ADR 0027 决策 5 |

### 10.1 相似能力对照（N6 补记）

| 相似能力 | 既有实现 | 本设计 | 异同 | 结论 |
| --- | --- | --- | --- | --- |
| schema → 文本发射 | `packages/vfsl-codegen/src/emitter.ts`/`valuetype.ts`（构建期从派生物发射 TS 类型文本，服务写路径类型化） | 运行期投影 → 呈现文本（VFSL 风格文法，服务读路径呈现） | 输入（全量 schema vs 路径键控投影）、输出（TS 声明 vs 呈现文本）、消费方（codegen 用户 vs 模型上下文）三轴皆异 | 非重复；渲染器落点由 ADR 0027 决策 2 裁定（文法权威单源 vfsl） |
| trusted-domain 失败通道 | `resolveSchemaAtPath` 等 4 处消费 `resolve.ts` L26–31 唯一定义的 `InternalError`（ADR 0016 例外；import 路线是包内既定惯例） | §7.5 对 projection/truncations 同通道**同一类**（`import { InternalError } from './resolve.js'`——R5） | 同精神、同包惯例延伸、单一类身份（包内 `class InternalError` 定义数 = 1） | 一致（SA8 D18；已列入 §15 复查枚举） |

---

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
| --- | --- | --- |
| `packages/vfsl/src/render-projection-text.ts`（新） | 渲染器实现：签名/类型（§7.0）、守卫（§7.5）、归位（§7.2）、文法（§7.1/§7.4）、optional 合成（§7.1.3）、环防御（§7.6） | 本票全部生产改动 |
| `packages/vfsl/src/index.ts` | resolver 导出块后追加 2 行（1 值导出 + 1 类型导出 + 注释锚 ADR 0027 决策 2/3） | 公共 API 只经 index（D1） |
| `packages/vfsl/test/render-projection-text.test.ts`（新） | 运行时红契约（G1–G6 正向 + 内嵌负断言 + **CT-8 环组（含 §12.1 环安全审计局部助手——测试侧观测函数，不进公共面/不进 fixture 数据）+ CT-9 畸形组**；顶层动态接缝，不静态 import 新名目；环夹具与 `resolveSchemaAtPath` 为既有导出，可静态 import） | SA6 §12.1；R3 强制验收落点；R4 观测口径落点 |
| `packages/vfsl/test/render-projection-text.test-d.ts`（新） | 类型面契约（G1.5–G1.9，静态 import） | SA6 §12.1 |
| `packages/vfsl/test/render-projection-text-control.test.ts`（新） | 恒绿控制组（20 导出超集、resolver 摘要/失败码抽格） | SA6 §12.8 |
| `packages/vfsl/test/render-projection-text-fixture.ts`（新） | 金标 `RENDER_GOLDENS` + `EXPECTED_CELL_KEYS`（独立推导）+ `RENDER_GRAMMAR_TEXT` + `HOSTILE_DOCS_DERIVED` + truncations 清单 + CT-9 手造畸形投影字面量；头部注明录制 HEAD/日期/命令与人工核对清单 | SA6 §12.1/§12.3；CT-8 夹具复用既有 `resolve-schema-at-path-budget-fixture.ts` 导出（环构造器），不新建文件 |

**范围说明（R1–R5 修订未扩权）**：CT-8/CT-9 断言（含 §12.1 环安全审计助手——红文件内
局部函数）全部落在上述既有四文件内；环夹具与 `slotDocsDerived` 等输入复用既有 fixture
文件的**导出**（只读 import，零修改）；金标矩阵单元数维持 SA6 §12.3 的 86 格不变
（`['config']`/`['notes']`/`['assets','img1']` 均已在 F1 12 路径内）；R5 的
`import { InternalError } from './resolve.js'` 是对 DENY 面的只读消费（import ≠ 修改），
DENY LIST 零变化（SA2 iteration-1 §11 同判）。

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
| --- | --- | --- |
| `packages/vfsl/src/resolve-schema-at-path.ts` | 渲染器输入契约 | 冻结面（ADR 0016/0024 #359；SA8 frozen surfaces） |
| `packages/vfsl/src/derived.ts`、`evaluate.ts`、`resolve.ts`、`validate*.ts`、`pattern.ts`、`envelope*.ts`、`schemasource.ts`、`ir.ts` 等其余 src | 只读消费（渲染器从 `./resolve.js` import `InternalError`、从 `./resolve-schema-at-path.js` import 投影类型——**import 是只读消费，不修改 `resolve.ts`**（R5）；DENY 面零触碰） | ValueSchema/派生物冻结形状；渲染器零改动需求 |
| `packages/vfsl/test/` 既有全部文件（含 `resolve-schema-at-path-budget-fixture.ts`、`resolve-schema-at-path-fixture.ts`、`resolve-schema-at-path-member-docs-fixture.ts`） | 负控/基线锚 + CT-8 环夹具来源（只读 import） | 既有断言是恒绿锚（改即破坏对照）；环/docs 键集字面量已冻结 |
| `packages/namespace-runtime/**` | 缝 2（恒四键/头行/detach） | 后续票生效点（ADR 0027 决策 1/4） |
| `packages/doc-runtime/**` | truncations 条目同构锚（只读引用形状） | 值通道冻结面 |
| `CONTEXT.md`、`docs/adr/**`、`docs/vfsl/v1-spec.md`、`docs/**` | 词汇/决策已写全 | ADR 0027 已完成词汇；P1–P5 与 R1/R2/R3 钉死属文法粒度内钉死，不构成文档修订（SA8 §5）；本设计即钉死载体 |
| `packages/vfsl/package.json` 及各版本号/发布脚本 | 加法不构成破坏性 minor bump | bump 义务挂缝 2 票（ADR 0027 决策 5；SA8 D13） |
| `vitest.config.ts`、根/包 tsconfig | 测试入口已覆盖拟定路径 | 零改动需求（SA6 §14 实测） |

---

## 12. 验收与验证映射

实现门禁（SA3 自查、SA7 复核；命令承接 SA6 §4/§14 基线）：

```
NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run packages/vfsl/test/render-projection-text.test.ts --typecheck
tsc -p packages/vfsl/tsconfig.json && pnpm typecheck && pnpm test
```

| 需求或风险（契约组） | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
| --- | --- | --- | --- |
| CT-1 公共导出 + 零选项签名（G1.1–G1.9） | E1/E3 红（导出面/类型面） | 动态接缝 + `.test-d.ts` 静态断言（含 `@ts-expect-error` 反例与 `TruncationEntryLike` 结构赋值） | 全绿；一参 ≡ 二参 `undefined` 逐字节；输出无 `# readData [` |
| CT-2 文法快照矩阵（86 单元：F1–F6） | E4 输入面 + 本设计 §7.1 逐字文法 | 金标 `RENDER_GOLDENS`（实现期录制，头部注明 HEAD/日期/命令 + 人工核对清单：别名块全覆盖/块序/有宿主 docs 文本在场（**含裸宿主行——`inlPair:`/`type AssetEntity =` 格**）/`‡` 覆盖全部标记/**`['config']` `{?` 块与 `['notes']` `string?` 的 `?` 在场**）；`EXPECTED_CELL_KEYS` 独立推导反空转 | 每格逐字节相等；F1 `['config']`/`['notes']`/`['assets','img1']` 三格可仅凭 §7.1–§7.2 唯一推导（R1/R2 验收）；F6 覆盖 `Pattern`/裸 `Int`/`Int<1, 9999999999>`/`Range<0, 100>`/`1 \| 2`/`YXmlFragment`/`T[]`/超 100 列折行 |
| CT-3 `‡` / `[...]‡` / 页脚（G3） | §7.4 计数不变量 | `countOccurrences('‡')===m+1`；线索敏感性（删标记位 ‡ 减 1；换 container 线索出 `[...]‡` 消 `<名>‡`） | m=0 无 ‡ 无页脚；页脚恰 1 行居 ✂ 前 |
| CT-4 first-line + 敌意防御（G4） | §7.1.5/§7.2 机制 | 多条目 `…`、换行折叠、敌意孪生行数 + 结构前缀逐行同、增删/清空 docs 敏感性、未引用别名照渲染 | 敌意文本零结构影响；docs 清空仅去注释；「有宿主 docs 文本在场」断言无歧义（裸宿主行承载——R1） |
| CT-5 ✂ 段（G5） | §7.4 段格式 | 缺席/undefined/`[]` 三态等价；条目 path/kind/omitted 呈现与敏感性（含数字段与**空路径 `[]` 拼写**）；与 ‡ 共存序 | 段为文末块；无截断无 ✂ |
| CT-6 确定性与纯函数（G6） | §7.6/§9 | 重复调用、与 resolver 交错、前后 `JSON.stringify` 不变（**辖域澄清（R4）：本行 stringify 口径只作用于契约金标输入——86 格全部无环，可执行、原样承接 SA6 §12.7；环投影的零变异断言独占 CT-8⑤ §12.1 环安全审计**） | 逐字节相同、零变异 |
| CT-7 纯加法回归锚（控制组恒绿） | SA6 §4 基线（378/4384、digest `e600851a…`） | 控制文件：20 导出超集 + resolver 摘要/失败码抽格 | HEAD 与实现后均绿；根门禁 0 failed / 0 type errors |
| **CT-8 环投影终止与确定性（设计新增，强制——R3①；⑤观测口径 R4 修订）** | §7.6 机制 + 既有环夹具（`budget-fixture` L489–574；resolver 重入透传 `resolve-schema-at-path.ts` L434–446 `return node` 原引用——既有测试以引用级同构钉死） | 红文件内：`optionalRingDerived()` / `unionRingDerived()` / `containerRingDerived()` × 读 `[]` × {无预算, `{depth:1}`, `{depth:9}`}（9 格）：①渲染返回 string（测试超时内终止）；②同输入重复调用逐字节相同；③与 resolver 交错重渲逐字节相同；④**无预算与 `{depth:9}` 格（环重入透传位）输出含 `…`（U+2026）**——optionalRing 的 `{depth:1}` 格因 optional 透明不耗层**同样合法含 `…`（超集一致，非异常，O4 澄清）**；⑤**调用前后零变异 = §12.1 环安全审计（节点身份保全 + 环安全摘要逐字节相等；禁止对 projection 使用 `JSON.stringify`——循环对象图上抛 `TypeError`，旧口径在 9 格中 7 格不可执行，R4）** | 无挂死、无裸异常、`…` 在场（透传格）、逐字节确定、9 格审计全过且**观测自身不抛** |
| **CT-9 畸形输入 InternalError（设计新增，强制——R3①）** | §7.5 清单（含 N2 int both-or-neither） | 红文件/fixture 内手造抽样：①`{}`（缺四键）；②`{kind:'bogus'}` 坏 kind 投影（四键形状完整）；③truncations 条目 `[{path:['a'], kind:'height', omitted:1}]`；④docs 值非 string 数组；⑤`{kind:'int', min:1}` 半参投影。断言 `expect(() => renderProjectionText(…)).toThrow()` 且 `error.name === 'InternalError'`、消息含可归因位置/键名（如键名/`kind` 值）；**throw 的类 = `resolve.ts` L26–31 唯一 `InternalError`（渲染器经 `./resolve.js` import——包内 `class InternalError` 定义数 = 1，R5；`error.name` 断言面不区分 import 与自有类，正因如此类身份必须在设计面钉死）** | loud 抛错、无部分输出（throw 即无返回值） |

- CT-1…CT-7 逐行承接 SA6 契约 §12.2–§12.8（命令、红因机制、录制纪律不变）；
  **CT-8/CT-9 为本设计在 SA6 契约基线（floor）之上新增的强制验收**（SA6 §12 断言全集限于
  resolver ok 产物与手造合法派生物——R3 指出的覆盖缺口由设计补齐，SA7 清单可直接执行）；
- 金标录制纪律（承接 SA8 §7.3）：录制前人工核对并写进 fixture 头——每个投影的
  `Object.keys(aliases)` 全部有别名块、块序 = 闭包发现序、每个有宿主的 docs 键文本在正文
  出现（含裸宿主行）、`‡` 覆盖全部标记、optional `?` 不丢失。

### 12.1 CT-8⑤ 零变异观测：环安全审计（R4 钉死，规范性）

**病灶**：环投影是循环对象图——`BudgetWalk.walk` 的 `inProgress` 命中分支 `return node`
透传**原节点引用**（`resolve-schema-at-path.ts` L434–446，类注释 L399–407；无预算读同
语义；CT-8 的 9 强制格中 7 格投影含环：三构造器无预算 ×3、optionalRing d1、三构造器
d9 ×3——仅 unionRing/containerRing 的 d1 两格无环）。`JSON.stringify(projection)` 在
循环对象图上抛 `TypeError: Converting circular structure to JSON`——旧 ⑤ 口径在其规定
输入的 7/9 格上不可执行，正确实现被伪红（SA2 R4）。

**裁定**：CT-8⑤ 的零变异观测 = **环安全输入完整性审计**——以 SA2 R4 选项①（节点身份
保全）为主：调用前后以 seen-set 遍历收集全部可达节点对象，断言发现序逐位同一引用
（`toBe`）；其遍历顺带产出选项②式的环安全摘要（遇环/共享输出回引占位）作内容指纹，
前后逐字节相等。选项③（stringify 仅限 2 个非环格、环格换口径）**不再需要**——统一
口径覆盖全部 9 格（2 个非环格为超集覆盖）。观测实现为红文件内局部助手（§11 ALLOW：
`render-projection-text.test.ts`；不进公共面、不进 fixture 数据）：

```ts
/** CT-8⑤ 零变异观测（R4）：环安全输入完整性审计。
 *  禁止对 projection 使用 JSON.stringify（循环对象图上抛 TypeError——R4 病灶）。 */
interface ProjectionAudit {
  nodes: object[]; // 发现序可达对象引用序列（身份面）
  digest: string;  // 根节点递归摘要（内容面：键名/键序/原始值/数组序/宿主标签/回引）
}
function auditProjection(projection: unknown): ProjectionAudit {
  const nodes: object[] = [];
  const seen = new Map<object, number>();
  const visit = (v: unknown): string => {
    if (v === null) return 'null';
    const t = typeof v;
    if (t !== 'object') {
      if (t === 'string') return `string:${JSON.stringify(v)}`; // 仅对原始值转义，非对象图
      if (t === 'function' || t === 'symbol') return `<${t}>`;   // 只记在场，不调用
      return `${t}:${String(v)}`;                                // number/boolean/bigint/undefined
    }
    const hit = seen.get(v as object);
    if (hit !== undefined) return `@${hit}`; // 环/DAG 共享：回引不递归——观测终止的根源
    const id = nodes.length;
    seen.set(v as object, id);
    nodes.push(v as object);
    if (Array.isArray(v)) return `[${id}|array]:{${v.map((e) => visit(e)).join(',')}}`;
    const tag = Object.prototype.toString.call(v); // 非 plain 宿主（Date/Map…）显式化
    const parts = Object.keys(v).map(
      (k) => `${JSON.stringify(k)}=${visit((v as Record<string, unknown>)[k])}`,
    );
    return `[${id}|${tag}]:{${parts.join(',')}}`;
  };
  return { nodes, digest: visit(projection) };
}
```

**断言形态**（红文件内每格执行；truncations 非空的格可用同一助手顺带审计）：

```ts
const before = auditProjection(projection);
const text = renderProjectionText(projection);
const after = auditProjection(projection);
expect(typeof text).toBe('string');
expect(after.nodes.length).toBe(before.nodes.length);
for (let i = 0; i < before.nodes.length; i += 1) expect(after.nodes[i]).toBe(before.nodes[i]);
expect(after.digest).toBe(before.digest);
```

**算法钉死面**（SA3 逐字实现，SA7 可直接执行）：

1. 遍历 = 深度优先、发现序确定性：plain 对象按 `Object.keys` 序（同一对象两次审计键序
   一致；键增删/delete+重加重排都会改变 digest ⟹ 可检测），数组按索引序；每个对象
   （含数组）仅在**首次发现**时递归，再访输出回引 `@<发现序号>`——环与 DAG 共享同法
   终止。注意：审计的 seen 是**全局**（发现序收集），与渲染器 §7.6 的**栈语义**
   （进行中集）不同——审计是只读观测，无「别名体引用主树环节点需各自完整」的呈现需求，
   全局去重恰使 nodes/digest 成为全图稳定指纹；
2. 身份面 `nodes` + 内容面 `digest` 合并检测：节点替换/新增/删除（nodes 序列长度或逐位
   `toBe` 失败）、键增删/重排、原始值改写、数组元素增删换序、非 plain 宿主对象类别调包
   （`Object.prototype.toString` 标签进 digest）——任一变异即红；
3. 观测自身安全性：不对 projection 调用 `JSON.stringify`（R4 病灶）；不读符号键、不调用
   任何函数值（token `<function>` 仅记在场）；getter 访问沿 §7.5 边界（resolver 产物为
   plain 对象图，无 getter 面）；
4. **命令与预期观察**：`NODE_OPTIONS=--conditions=nomicore-source
   ./node_modules/.bin/vitest run
   packages/vfsl/test/render-projection-text.test.ts --typecheck`（§12 门禁命令）——CT-8
   9 格全绿：`before/after.nodes` 长度相等、逐位 `toBe` 同一引用、`digest` 逐字节相等；
   审计在 7 个含环格上正常返回（回引终止、不抛 `TypeError`），在 2 个无环格同样通过。

**与既有口径的边界**：SA6 契约 CT-6（§12.7）的 `JSON.stringify(projection)` /
`JSON.stringify(truncations)` 零变异断言辖域 = 契约金标输入（86 格全部无环，SA6 §7/
§12.3）——在其辖域内可执行，**原样承接、零修改**（approved contract 不动）；环投影的
零变异断言独占本节。两口径辖域不相交、不矛盾。

---

## 13. 风险、回滚和残余问题

| # | 风险/限制 | 等级 | 处置 |
| --- | --- | --- | --- |
| L1 | **P1 信息损失**：被读位置自身（根位）与无宿主 docs 键不呈现（如 `['shallow','title']` 单元两键全丢，正文仅 `string`） | 中（产品性，非正确性） | 已知限制登记：消费方读父路径或经缝 2 组合层头行取回；如需改判属 ADR 0027 文法粒度再议（须重过 CT-4 敏感性） |
| L2 | **inline 枚举成员注释合并**（`mode: "on" \| "off" // 开 · 关`）：短枚举成员注释按字典序合并于行尾，逐成员归因靠位置推断；折行形态才有逐成员行 | 低 | docs 无关性（CT-4 清空敏感性）强制；产品影响限于 ≤100 列带成员注释枚举；登记为已知限制 |
| L3 | 后缀匹配为启发式（P2 契约已知）：罕见手造同尾缀多键靠字典序 tie-break 单值呈现 | 低 | 契约夹具保证无碰撞；tie-break 序无关确定性已钉；歧义用例不进本票断言 |
| L4 | 文法钉死与金标冻结的漂移面：SA3 若偏离 §7.1 任意逐字规则，快照即错 | 中 | §7.1 规范性钉死 + §12 录制纪律人工核对清单；SA7 对照设计复核；**R1/R2 修订后规则与样张（附录 A）已逐字对齐，消除 iteration 0 的二选一 ambiguity** |
| L5 | `…` 环省略号与口径 `…` 同形（语义按位置区分：类型位 = 环省略，注释尾 = 截断口径）；`…` 是 ADR 0027 封闭文法元素之外的新记号 | 低 | 语义不重叠（不同句位）；新记号已登记 §15 复查枚举（R3②） |
| L6 | **（R2 新登记）非字段位 `?` 附着于「定界行」的读感代价**：union/enum 展开下 `?` 落首成员行（`\| string?`）、数组/Record 展开落闭行（`[]?`/`>?`）——人读可能把 `?` 误归因到首成员/闭行所标容器内层 | 低（确定性/无损性不受影响） | 附着表 total 钉死（§7.1.3），金标矩阵无此类格（F1 仅 `['notes']` inline、`['config']` 对象块两格），罕见形态仅手造可达；CT-2 金标 + 推演覆盖 |
| L7 | **（O3 新登记）union 成员本身为 enum 时按 inline 合成**：`\| "a" \| "b"` 中成员内嵌 `\|` 与成员分隔在视觉上不可分（逐字节确定性/唯一可推导性不受影响——§7.1.1 enum 拼写与声明序仍钉死；86 金标格无此形态；§7.1.1 precedence 1/2 未覆盖该位的折行） | 低（读感，非正确性） | 登记为已知限制（与 L6 同类）；备选「比照数组先例强制折行」否决——为契约零覆盖的罕见成员位引入形状触发折行规则，徒增与 precedence 2（optional 包裹 enum 强制折行）的交互面且无断言收益；如需改判属 ADR 0027 文法粒度再议 |
| R1 | 回滚方案：删 4 测试文件 + 新实现文件 + index 2 行导出 → 完全回到 HEAD 形态（纯加法，无数据/状态迁移） | — | 已验证加法性（DENY LIST 全零触碰） |
| F1 | follow-up（跨票台账，非本票条件）：缝 2（恒四键 + 头行前贴 + 一致性锚 + minor bump）、缝 3（文档负控词汇重录）、敌意 getter 边界（§7.5 登记） | — | SA8 §7.5 台账承接 |

**无阻塞性残余**：P1–P5、D18、R1（裸宿主行注释归属）、R2（optional 全位合成）、
R3（环/畸形行为 + 强制覆盖 + `…` 记号登记）、R4（CT-8⑤ 环安全零变异观测）、R5
（`InternalError` 单一类身份 import）已全部钉死；金标录制依赖实现存在（SA3 期），
契约以三重防空转（单元格完整性 + 独立结构性断言 + 敏感性反例）+ CT-8（§12.1 审计）/
CT-9 强制组覆盖。

---

## 14. 评审修订映射

评审输入：`wiki/raw/task_issue-363_sa2_review.md`（**iteration 1**，reviewed dispatch
`sa-72e66102-b57d-42bf-99a2-229e0d3cee3a`；verdict **reject**——R4/R5 两项 MAJOR +
O1–O5 非阻塞观察）。prior iteration-0 findings（R1–R3 MAJOR、N1–N6）经该评审 §5/§6
逐项核验为**全部落实**，其修订已是本设计正文基线（R1→§7.1.4/§7.1.5/§7.2/附录
A.1/A.2/A.6；R2→§7.1.1/§7.1.2/§7.1.3/A.5/A.7；R3→§7.5/§7.6/CT-8/CT-9/§15），本表不再
重复映射，只映射本轮适用 finding：

| Finding | 修订位置 | 处理结果 |
| --- | --- | --- |
| **R4**（MAJOR）CT-8⑤「调用前后 `JSON.stringify(projection)` 不变」在环投影（循环对象图）上抛 `TypeError`——9 强制格中 7 格不可按字面执行，正确实现伪红 | **§12.1（新增，规范性：环安全审计算法钉死——节点身份保全 + 环安全摘要、断言形态、命令与预期观察、与 CT-6 辖域边界）**、§12 CT-8 行⑤（改引 §12.1 并明令禁 stringify）、CT-6 行（辖域澄清：stringify 限无环金标输入，SA6 契约零修改）、§7.6 验收/纯度两处指针、§5 承接表新行、§11 ALLOW 红文件行 + 范围说明 | **已落实（裁定：选项①为体、②为用、③不需要——统一口径覆盖全部 9 格）**。每格零变异断言可按设计原文执行且观测自身不抛；修订行含明确命令与预期观察；SA7 验收清单可直接执行（R3 验收标准保持） |
| **R5**（MAJOR）`InternalError` 钉为「新文件内自有同款类」——无有效理由绕过既有能力（包内惯例 = 唯一类定义 `resolve.ts` L26 + 4 处跨模块 import；「不改 resolve.ts」对 import 路线不成立） | §7.0 末条（改 `import { InternalError } from './resolve.js'`，锚 L26–31 唯一定义 + 4 处既有 import）、§7.5 通道裁定、§2 事实行、§10.1 对照行、§11 DENY 行（import = 只读消费）+ 范围说明、§12 CT-9 行（同一类身份注记）、§5 承接表新行 | **已落实（import 路线；未发现 import 具体不可用的技术理由——渲染器本就从 `./resolve-schema-at-path.js` import 类型，「自包含」不成立）**。设计正文不再规定渲染器自有类定义（本表与 §5 的「自有」字样仅为 finding 引文）；包内 `class InternalError` 定义数 = 1；`error.name === 'InternalError'` 断言面不变；DENY LIST 零触碰 |
| O1（承 M1）§7.2 对照矩阵 `['shallow','audit']` d1 行把根误述为「Audit 体型块……根块两行裸」——与 resolver 实码（ref 终点原样返回）、§2 事实表、A.6 样张矛盾 | §7.2 对照矩阵该行（O1 二度修正） | 措辞修正：d1 根 = **`Audit` 单行直写**（无注释；marker 矩阵 d1 唯一标记 `Audit.notes => container:array` 在别名块内——夹具 L196–198 本仓复核）；Audit 体型块仅为别名块（by/notes 注释归位于此）——防 SA3 录该格金标被误导 |
| O2（承 M2）§2 行 2 锚点「L589–595」实为值侧候选去重/规范化区 | §2 行 2 | 锚点改 L300–333（终点合成区：L304–305 单候选、L304–306 多候选、L317–323 `budgetShell`）——本仓实读复核，事实本身已核为真 |
| O3 union 成员本身为 enum 时 inline 合成 `\| "a" \| "b"`，嵌套 `\|` 视觉不可分（确定性不受影响、金标矩阵无此格） | §13 L7（新登记） | 登记为已知限制（与 L6 同类）；「强制折行」备选否决理由成文（为契约零覆盖位徒增 precedence 交互面） |
| O4 CT-8④ 只断言无预算/d9 含 `…`；optionalRing d1 因 optional 透明同样含 `…`，防 SA7 误判 | §12 CT-8 行④ | 已加半句澄清：optionalRing `{depth:1}` 合法含 `…`（超集一致，非异常） |
| O5（承 N7）L1/L2 产品性损失登记与取舍维持认可 | — | 无需修订（SA2 同判） |

---

## 附录 A：全格示例（规范性对照样张；金标以实现实际输出录制，本附录钉死文法形态）

### A.1 预算夹具 `[]` 无预算整读（F2 家族之无预算基线）

输入 = `resolveSchemaAtPath(budgetFixtureDerived(), [])`；docs 含全部 18 键、aliasDocs
含 `Ledger`/`Audit`。输出（逐字；`·` = U+00B7）：

```
{
  shallow: Ledger // 浅引用位
  deep: { // 深链位
    mid: {
      leaf: Ledger
    }
  }
  pair: Pair // 联合位
  inlPair: // 内联联合位
    | {
        kind: "a"
        name: string
      }
    | {
        kind: "b"
        count: number
      }
  plain: { // 孪生位
    kind: "a"
    name: string
  }
  opt?: { // 可选位
    retries: number
  }
  req: { // 必填位
    retries: number
  }
  mode: Mode // 模式
  modes: Mode[] // 模式表
  modeMap: Record<string, Mode> // 模式字典
}

type Ledger = { // 账本
  title: string // 账本名
  audit: Audit // 审计引用
}

type Audit = { // 审计
  by: string // 审计员
  notes: string[] // 备注行
}

type Pair =
  | {
      kind: "a"
      name: string // 甲名
    }
  | {
      kind: "b"
      count: number // 乙量
    }

type Mode = "on" | "off" // 开 · 关
```

要点对照：根位无注释（P1：`ROOT` 锚不可知）；**`inlPair: // 内联联合位`——裸字段宿主行
承载归位 docs（R1 修订，iteration 0 样张此处误为无注释）**；`Ledger.*`/`Audit.*`/
`Pair.*`/`Mode.*` 经别名精确归位（`type Pair =` 无 aliasDocs ⟹ 裸行无注释——与 R1 规则
一致：无归位条目即无注释段）；`ROOT.*` 字段键经后缀匹配落正文字段行；union 恒展开、
成员对象恒块、判别式（Pair/AssetEntity 类）不渲染；可选位 `opt?:`、必填位 `req:`。

### A.2 `[]` depth=1 预算读（含 `‡` 页脚）

docs（10 个 ROOT 字段槽位键，含 `ROOT.inlPair`）：

```
{
  shallow: Ledger‡ // 浅引用位
  deep: [...]‡ // 深链位
  pair: Pair‡ // 联合位
  inlPair: // 内联联合位
    | [...]‡
    | [...]‡
  plain: [...]‡ // 孪生位
  opt?: [...]‡ // 可选位
  req: [...]‡ // 必填位
  mode: Mode‡ // 模式
  modes: [...]‡ // 模式表
  modeMap: [...]‡ // 模式字典
}

‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。
```

m = 11（`ROOT.mode` 等 11 个标记位）→ `‡` 共 12 次（11 位标 + 1 页脚）；无别名块
（d1 闭包空）；`inlPair` 的 union 透明不耗层、成员对象各自成标记；**`inlPair: // 内联联合位`
（R1 修订）**。

### A.3 ✂ 段（truncations 第二参非空；与任意正文组合）

```
✂ 截断事实：
- meta · depth · 省略 2 项
- items.0 · depth · 省略 1 项
- tags · width · 省略 3 项
```

（条目序 = 输入序；空路径条目渲染 `- [] · depth · 省略 N 项`（N5）；空清单/缺席/
undefined 三态无本段且逐字节相同。）

### A.4 简单单元（`['shallow','title']` 无预算：根位标量、双 docs 键均无宿主）

docs = `{ROOT.shallow:[浅引用位], Ledger.title:[账本名]}`，正文仅一行——P1 丢弃两键：

```
string
```

（输出以 `\n` 结尾；无别名块、无页脚、无 ✂。）

### A.5 根位 optional 对象块（F1 `['config']` 无预算；R2 新增）

输入 = `resolveSchemaAtPath(#272 derived, ['config'])`；根 = `optional{object{retries}}`
（单候选原样保留）；docs `ROOT.config` 为根位锚键 → 丢弃；闭包空：

```
{?
  retries: number
}
```

（§7.1.3 款②：`?` 附着块开行结构前缀末尾；无页脚（m=0）、无 ✂。同构格：预算夹具
`['opt']` 无预算同形。对照 F1 `['notes']`：根 = `optional{scalar}` → 款① 单行
`string?`。）

### A.6 裸别名宿主行注释（F1 `['assets','img1']` 无预算；R1 新增）

输入 = `resolveSchemaAtPath(#272 derived, ['assets','img1'])`；根 = 单候选原样
`ref{AssetEntity}` → 别名名直写单行；别名闭包发现序 `AssetEntity, Audit`；
aliasDocs 两键在场：

```
AssetEntity

type AssetEntity = // 资产实体：封闭联合
  | {
      kind: "image"
      url: string
      audit: Audit
    }
  | {
      kind: "text"
      body: YXmlFragment
      audit: Audit
    }

type Audit = { // 审计子文档
  createdBy: string // 谁创建的
}
```

（`type AssetEntity = // 资产实体：封闭联合`——**裸别名宿主行承载 aliasDocs（R1）**；
`Audit.createdBy` 经规则 2 精确归位 Audit 块；判别式不渲染。）

### A.7 根位合成 union（F1 `['u','x']` 无预算）

根 = 合成 union（成员 scalar string ∣ array number，均 inline；恒无判别式）；根位无
宿主行，成员行从缩进 0 起；成员无 ref ⟹ 闭包空、无别名块：

```
| string
| number[]
```

（若根被 optional 包裹（同形手造/求值输入）：`?` 落首成员行——`| string?` /
`| number[]`，§7.1.3 款④。）

---

## 15. 是否需要设计后 ADR 冲突复查

**需要（`requiresConflictRecheck: true`）**。理由：

1. **新增公共 API**：`renderProjectionText` + `ProjectionTruncation` 经 `@nomicore/vfsl`
   index 导出（skill 标准：公共 API 变化通常需复查；SA8 §9(a) 同判）；
2. **规范性文法快照冻结**：§7.1/§7.4 的逐字行格将由 86 格金标锚定为兼容行为（稳定文法
   = 事实契约面），实现后须对照 frozen surfaces 表核对实际 diff（SA8 §9(a)/§7.5）；
3. **P1（无宿主 docs 键丢弃）与 P3（`YXmlFragment`）是设计新裁决面**（SA8 §9(b) 明示
   设计定稿后应做设计面冲突复审）；P1 的「不新增文法段落」裁定与 P4 的「docs 无关
   结构」裁定均在 ADR 0027 文法粒度内，但属首次成文，值得复审确认未越授权；
4. **（R3② 新增）`…`（U+2026）类型位环省略记号**：ADR 0027 封闭文法元素（字段行/
   别名块/`‡` 页脚/✂ 段）之外首次成文的新文法记号（与 P3 `YXmlFragment` 同类），
   连同 **§7.5 trusted-domain `InternalError` 通道裁定**（ADR 0016 例外条款向渲染器
   输入的延伸）一并登记，供设计面冲突复审（SA2 §15 复查路由同判）；
5. **（R1/R2 新增）裸宿主行注释承载**（CT-4「有宿主」断言边界的澄清）与**非字段位
   optional `?` 附着规则**（`{?` / `| {?` / `[]?` / `>?` / 首成员行 + enum 强制折行）
   是 ADR 0027 决策 3 字段行拼写（`名?: 类型`）之外的文法粒度内新裁决面，一并送复审
   确认未越 SA8 §5 授权。
6. **（iteration 2 注记）R4/R5 修订不新增复查面**：R4 是验收观测口径修正（测试侧局部
   助手，不改公共 API/文法/失败语义，SA6 approved contract 零修改）；R5 是向包内既有
   惯例收敛（import 唯一类定义——减少而非新增裁决面）。SA2 iteration-1 §15 同判（两项
   均不引入新的 ADR 冲突风险）；上述 1–5 枚举维持 iteration 1 路由不变。

设计本身未发现与任何 accepted ADR 冲突：D1–D18 全部为 `implements-existing-decision`
或文法粒度内钉死（§6 表）；无需 override、无需修订 ADR/CONTEXT/协议。
