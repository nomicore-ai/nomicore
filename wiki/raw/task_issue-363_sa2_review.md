# SA2 设计评审 — issue #363（T1：投影文本渲染器）· iteration 2

- Reviewed dispatch：`sa-19f3adb5-6cc5-4518-9b20-d7797b0d90bc`（mabf-sa2 / design-review / iteration 2）
- 评审对象：`wiki/raw/task_issue-363_design.md`（iteration 2 原位修订版；design dispatch
  `sa-7e77ebe2-a64e-4e70-8497-60cbbebbc825`；基准 HEAD
  `12674544d2f24eb7d47c47ca4613b894043711d4` 本次 `git rev-parse HEAD` 复核一致；工作树
  仅 `wiki/raw/*363*` 六个 untracked 产物、零生产改动）
- 评审任务：核验 iteration-1 **R4/R5** 两项 MAJOR 与 O1–O5 非阻塞观察的落实 + 整体
  正确性/完备性/架构一致性/与 SA6 已批契约及 SA8 门禁对齐
- 评审角色：SA2 独立设计攻击（不修改设计/代码/测试；本文件为唯一产物）
- 评审链：iteration 0（reject，R1–R3）→ iteration 1（reject，R1–R3 核验落实、新发现
  R4/R5 + O1–O5）→ **本版（iteration 2）**。prior findings 的处置状态一览：
  R1–R3 落实（iteration-1 §5/§6 核验，正文基线化）→ R4/R5 **本轮核验已落实**（§5/§6）
  → O1–O4 采纳修订 → O5 维持无需修订。

## 1. Reviewed inputs

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| `wiki/raw/task_issue-363.md`（Host brief） | 在场 | 票面 What-to-build + AC 6 条；Comments 快照空 |
| `wiki/raw/task_issue-363_design.md` | 在场（被审对象，iteration 2） | SA1 设计本体（970 行；含新增 §12.1） |
| `wiki/raw/task_issue-363_sa6_contract.md` | 在场（SA8 已批） | CT-1…CT-7、P1–P5 待钉项、86 金标格、基线数字 |
| `wiki/raw/task_issue-363_relevant_decisions.md` | 在场 | SA8 决议摘录（ADR 0027/0016/0024/0003/0019/0020/0021、CONTEXT、v1-spec、AGENTS） |
| `wiki/raw/task_issue-363_conflict_report.md` | 在场（verdict clear） | D1–D18 逐条、frozen surfaces、Required actions |
| `wiki/raw/task_issue-363_sa2_review.md`（iteration 1） | 在场（本文件前身） | R4/R5/O1–O5 落实核验基线 |
| Issue REST comments snapshot | **空**（无 owner 需求、无 comment ID） | 无逐字判据 |
| 源码/fixture 独立核验 | 本次实读 | `resolve-schema-at-path.ts`（终点合成 **L300–333** 实读：单候选原样 L304–305、多候选 L304–306、`budgetShell` L317–323；`BudgetWalk.walk` L437–446 `inProgress` 命中 **L440 `return node`** 原引用透传；ref case L508–524：budget 0 → ref 标记且**不登记闭包**（L509–510）、budget>0 → 登记闭包 + 首渲染别名体（L519）+ **`return node` 原样（L523）**；optional case L502–506 透明不耗层；object/array budget 0 先裁 L452/L474）；`resolve.ts` **L26–31** `export class InternalError extends Error`（构造器置 `name='InternalError'`）——全包 `class InternalError` 定义数 = 1；四处消费方 import 实读（`resolve-schema-at-path.ts` L57 / `validate.ts` L39 / `evaluate.ts` L20 / `validate-patch.ts` L33，均为 `from './resolve.js'` 组合 import）；`index.ts` L139–149 resolver 导出块（20 值导出、无 `renderProjectionText`、不导出 `InternalError`）；`derived.ts` L44–58（11 kind + int both-or-neither L50–52 + optional「仅对象字段 ?: 包装」L57）；fixtures：budget-fixture 环构造器 L489–574（`unionRingDerived`/`containerRingDerived`/`optionalRingDerived`/`optionalTwoCycleDerived`/`optionalRingSkeleton`）、marker 矩阵 `[]` d1 = **11 条**（L144–155）、`['shallow','audit']` byDepth **L195–198**（d0 = ref:Audit 单标记；d1 = `Audit.notes => container:array` 唯一标记）、`BUDGET_NO_BUDGET_DOCS_KEYS` 含 `ROOT.inlPair`；`#272` `VALUE_ROOT` L160（`notes`=optional{scalar}）/L163–169（`config`=optional{object{retries}}）；设计文本 grep（「自有」「L589」「JSON.stringify」全部落点核对）；`packages/vfsl/AGENTS.md` |

## 2. Verdict

**approve** —— iteration-1 两项 MAJOR **全部确认落实**：

- **R4 已落实**：新增规范性 §12.1「环安全零变异观测」——以节点身份保全审计（发现序
  可达对象序列逐位 `toBe` 同一引用）+ 环安全摘要（seen-set 回引占位、前后逐字节相等）
  统一覆盖 CT-8 全部 9 格；明令禁止对 projection 使用 `JSON.stringify`；CT-8⑤ 改引
  §12.1；CT-6 行加辖域澄清（stringify 口径只作用于 86 个无环金标输入，SA6 已批契约
  零修改、原样承接）。本轮对 §12.1 审计算法做了逐行攻击（环终止、确定性、检测力、
  观测自身安全性、TS 可编译性、与渲染器栈语义的辖域区分），并对其 7/9 含环事实基
  做了 BudgetWalk 代码级重推——全部成立（§6.1）。
- **R5 已落实**：§7.0/§7.5/§2/§10.1/§11/§12 CT-9 全部改为
  `import { InternalError } from './resolve.js'`——单一类、单一事实源。本仓 grep 复核：
  包内 `class InternalError` 定义数 = 1（`resolve.ts` L26–31）；四处既有消费方全部
  import 路线；`InternalError` 不经 index 导出（渲染器不新增公共面）；「自有类定义」
  字样仅存于 §5/§14 的 finding 引文（设计已显式标注引文性质），规范性章节零残留。
- O1–O4 采纳修订并经本仓实读复核成立（§5/§6.2）；O5 维持无需修订（同判）。

无 BLOCKER、无 MAJOR；无新增阻断项。设计在需求覆盖、上游事实、SA8 约束、状态机/
并发（纯函数等价攻击）、错误恢复、调用方影响、架构一致性、文件范围、验收设计九个
维度均足以安全实施。`pass` 仅指设计通过审查；实现与活链路验证仍归 SA4/SA7。

## 3. 需求覆盖

（iteration 1 §3 逐行核验结论在本版维持——本轮 diff 仅触 CT-8⑤/CT-6 观测口径、
InternalError 类身份、§2 锚点、§7.2 一行措辞、§13 登记，均不改变需求落点。）

| Requirement（票面 AC / What-to-build） | Design section | Assessment |
| --- | --- | --- |
| AC1 `renderProjectionText(projection, truncations?)` 经 index 导出、零选项、动态接缝 | §7.0、§11、§12（CT-1） | 覆盖（联合入参 + G1.6–G1.9 + 20 导出超集断言；R5 修订后渲染器复用 `./resolve.js` 唯一 `InternalError`，公共面仍只加 1 值 + 1 类型导出） |
| AC2 文法快照冻结（预算矩阵 / M4 / 手造 / 无预算整读） | §7.1（P4 逐字 + §7.1.3 optional 总则）、§12（CT-2 86 格） | 覆盖；86 格输入全部无环（SA6 §7/§12.3 + 本轮对环夹具与金标家族的辖域核对——环构造器不属任何金标族） |
| AC3 确定性（重复 + 与无预算读交错逐字节相同） | §7.6、§9、§12（CT-6/CT-8②③） | 覆盖；CT-6 stringify 辖域澄清后两口径不相交、不矛盾（§6.1） |
| AC4 first-line 口径 + docs 敌意防御 | §7.1.5、§12（CT-4） | 覆盖（裸宿主行承载注释后「有宿主」断言无歧义） |
| AC5 `‡`/`[...]‡`/✂ 段；truncations 缺席或空无 ✂ | §7.4、§12（CT-3/CT-5） | 覆盖（m+1 计数、页脚、三态等价、空路径 `[]` 拼写） |
| AC6 vfsl typecheck + 既有测试全绿；root 门禁 | §12 | 覆盖（命令承接 SA6 §4/§14） |
| 字段行/标量域/Record/union/别名块闭包序/可见性切片 | §7.1.0–§7.1.2、§7.2 | 覆盖（11 kind 与 `derived.ts` L44–58 冻结面逐一核对） |
| 纯加法、零既有行为变化、不触碰 readData | §1 非目标、§11 DENY、§12 CT-7 | 覆盖（工作树零生产改动复核 ✓；R5 import = 只读消费，DENY 零触碰） |
| 目标/非目标无静默扩大 | §1、§11 范围说明 | 确认（§11 声明 R1–R5 修订未扩权经核属实：审计助手落红文件局部、不进公共面/fixture） |

## 4. Owner评论覆盖

Issue comments snapshot 为空（brief §Comments；SA6 §2；SA8 §1；设计 §4）。无 comment
ID、无 updated_at、无逐字判据。设计 §4 如实登记「本表无行」。**无遗漏**。

## 5. 上游事实与SA8约束（含 R4/R5 落实核验）

| Fact or constraint | Design response | Assessment |
| --- | --- | --- |
| SA6 §5/§8 能力缺口（20 导出无渲染器、TS2305） | §3 承接 + §7.0 落地 | ✓（index 实读复核：20 值导出在场、无 renderProjectionText；全包生产源 0 符号命中） |
| SA6 §10 truncations 与 doc-runtime 条目结构兼容 | §7.0 `ProjectionTruncation`（P5） | ✓ `read.ts` L88–92 逐字段同构 |
| SA8 D1–D18 | §6 全表 | ✓ 18 行逐条核对（iteration-1 已核，本版未触） |
| SA8 §7.2 设计门先钉 P1–P5 | §7.1–§7.4、§7.7 | ✓ 全部钉死且备选否决可执行 |
| SA8 §7.4 D18 畸形输入失败语义 | §7.5 `InternalError` + CT-9 强制 | ✓ 通道裁定成立；类身份已收敛为 import（R5 落实，见下） |
| 环 projections 为合法 resolver 产物（`inProgress`/memo 原引用透传） | §7.6 `…` + CT-8 强制 + **§12.1 环安全审计** | ✓ 前提属实（L440 `return node`、L466/`pristine` 身份短路、memo 复用——本次实读；四环构造器 L489–574 在场）；CT-8⑤ 观测口径已可执行（R4 落实，见下） |
| **R4**（iteration-1 MAJOR）：CT-8⑤ stringify 观测在循环对象图上抛 TypeError，7/9 格不可执行 | **§12.1（新增规范性钉死）**、§12 CT-8⑤ 改引、CT-6 辖域澄清、§7.6 两处指针、§11 ALLOW 红文件行、§5/§14 映射 | **已落实**。逐项核验：(a) 7/9 含环事实基**代码级重推成立**——无预算 ×3（终点/闭包均原样透传）与 d9 ×3（budget 9 在环回前不耗尽：object 字段值位 budget-1、union/optional 透明同预算，重入即 `return node` 原引用）含环；optionalRing d1 因 optional 透明（L502–506 无 budget 检查）环穿透含环；unionRing/containerRing d1（ROOT 走 1 层后环位达 budget 0 → object/array 先裁出标记 shell）无环——恰 7 含 2 无；(b) 审计算法**逐行攻击通过**（见 §6.1）；(c) CT-6 辖域澄清与 SA6 §12.7 已批契约零修改、两口径辖域不相交；(d) 修订行含命令与预期观察（§12.1 钉死面第 4 条） |
| **R5**（iteration-1 MAJOR）：`InternalError` 钉为「新文件自有同款类」违背包内唯一类 + import 惯例 | §7.0 末条（import）、§7.5、§2 事实行、§10.1、§11 DENY 行 + 范围说明、§12 CT-9 注记、§5/§14 映射 | **已落实**。本仓 grep：`class InternalError` 定义数 = 1（`resolve.ts` L26–31）；四处消费方（L57/L39/L20/L33）全部 `from './resolve.js'`（实际为组合 import 语句——设计引文「`import { InternalError } from './resolve.js'`」为路线引述，路线与锚点准确）；`index.ts` 不导出该类；规范性章节无「自有定义」残留（grep 全文，「自有」仅见于 §5/§14 finding 引文与 CT-9「不区分 import 与自有类」的论证句）；`error.name === 'InternalError'` 断言面不变 |
| **O1**（§7.2 `['shallow','audit']` d1 根形态误述） | §7.2 该行二度修正 | **已落实且准确**：实读 ref case——budget>0 时登记闭包 + `return node`（L519–523）⟹ d1 根 = `ref{Audit}` 原样 → `Audit` 单行直写；marker 矩阵 L195–198 实测 d0 = `ROOT.shallow.audit => ref:Audit`、d1 = 唯一标记 `Audit.notes => container:array`（别名块内，Audit 体走 budget 1：`by` 标量终态无标记、`notes` 数组 budget 0 先裁）；d0 闭包空（L509–510 budget 0 不触达别名体）⟹ 无别名块。修正后与 §2 事实表、A.6 样张、实码三方一致 |
| **O2**（§2 行 2 锚点漂移 L589–595） | §2 行 2 锚点改 L300–333 | **已落实**：实读 L300–333 = 终点合成区（L304–305 单候选原样、L304–306 多候选、L317–323 `budgetShell`）；「L589」grep 仅存于修正说明/映射表引文 |
| **O3**（union 成员为 enum 嵌套 `\|` 视觉不可分） | §13 L7 新登记 | **已落实**（已知限制 + 否决强制折行的理由成文——为契约零覆盖位不新增形状触发规则，与 L6 同类） |
| **O4**（optionalRing d1 含 `…` 防 SA7 误判） | §12 CT-8④ 半句澄清 | **已落实**（「超集一致，非异常」——与 optional 透明的代码事实一致） |
| **O5**（L1/L2 产品性损失取舍） | — | 维持无需修订（同判） |

## 6. 设计内部一致性

### 6.1 §12.1 审计算法逐行攻击（R4 修订的核心）

- **终止性**：`seen` Map 按对象身份登记发现序号，再访即返回 `` `@id` `` 回引不递归
  （L672）——环与 DAG 共享同法终止；`nodes`/`digest` 长度有限。7 个含环格均正常返回 ✓；
- **确定性**：深度优先发现序；plain 对象按 `Object.keys` 序（同对象两次审计键序一致）、
  数组按索引序；digest 由 `[id|tag]:{k=v,…}` 逐位拼接——同图两次审计逐字节相等 ✓；
- **零变异检测力**：身份面（`nodes` 逐位 `toBe`：节点替换/增删即红）+ 内容面（digest：
  键增删/重排（delete+重加重排改变 `Object.keys` 序）、原始值改写、数组元素增删换序、
  非 plain 宿主类别调包（`Object.prototype.toString` 标签入 digest）任一即红）——
  检测力 ≥ 原 stringify 口径（stringify 同为 own-enumerable 视图且无身份面）✓；
- **观测自身安全**：不对对象图用 `JSON.stringify`（仅对 string 原始值/键名转义——原始
  值无环）；`function`/`symbol` 只记在场不调用；不读符号键（`Object.keys` 只出 string
  键）；`seen.get` 以 `!== undefined` 判命中——发现序号 0 不会被误判为缺席（Map.get
  语义）✓；id 分配 `nodes.length` 先于 push，与断言 `after.nodes[i]` 索引对齐 ✓；
- **与渲染器栈语义的辖域区分**：§12.1 钉死面第 1 条显式声明审计 seen 为**全局**
  （发现序收集）而渲染器 §7.6 为**栈语义**（进行中集）——两者目的不同（全图指纹 vs
  呈现省略），已成名文区分，防 SA3 误抄 ✓；
- **TS 可编译性**：typeof 收窄、`Array.isArray` narrow、`as object`/`as Record` 显式
  断言——按设计原文落红文件（进 `tsc -p packages/vfsl/tsconfig.json` 的 `test/**/*.ts`
  include）可编译 ✓；
- **断言形态可执行**：`before` → `render` → `after` 三段式 + 四条 expect 全部可在 9 格
  规定输入上按原文执行、观测自身不抛 ✓；「truncations 非空的格可用同一助手顺带审计」
  为可选加强，不构成执行缺口；
- **与 CT-6 辖域边界**：SA6 §12.7 的 stringify(projection)/stringify(truncations) 辖域 =
  86 无环金标输入（可执行，approved contract 原样承接零修改）；环投影零变异独占 §12.1
  ——两口径辖域不相交、不矛盾，且 CT-8 为设计新增组（SA6 无此行），不构成对已批契约
  的修改 ✓；
- **落位**：助手为红文件内局部函数（§11 ALLOW 行明示「不进公共面/不进 fixture 数据」）
  ——不扩权、不触 DENY ✓。

### 6.2 O1/O2 修正后的三方一致性

- `['shallow','audit']` d1：§7.2 修正行 ⟷ resolver 实码（ref L519–523 原样返回 + 闭包
  首渲染）⟷ marker 矩阵 L195–198（d1 唯一标记在别名块内）三方一致；docs 归位推演
  （`Audit.by`/`Audit.notes` 规则 2 专属锚定；`ROOT.shallow` 尾缀无正文匹配位、
  `Ledger.audit` 首段 Ledger ∉ aliases={Audit} 且尾缀无匹配位 → 双键零贡献）与
  §7.2 规则 1–4 逐条可推导 ✓；
- §2 行 2 锚点 L300–333 与实码逐段对齐（单候选/多候选/预算 shell 三分支锚点各自
  准确）✓。

### 6.3 其余一致性

正文规则（§7.1–§7.6）与附录 A 样张、§8 流水、§10/§10.1 调用方矩阵、§11 范围、§12
验收映射、§13 风险（含 L7 新登记）、§14 修订映射相互一致；§14 旧→新映射与实际文本
相符（R4/R5/O1–O5 七行逐一对照修订位置核验属实）；§12.1 新增节被 §5/§7.6/§11/§12
CT-8⑤/CT-6/§14 引用一致，无死引用；未发现「附录承认但正文未改」的伪修订。grep 复核
「自有」「L589」等失效措辞仅存于引文语境。iteration-1 的 M1/M2 已随 O1/O2 闭合并从
观察项移除。

## 7. 状态机与并发攻击

无状态机（纯函数）。等价攻击逐项核验（iteration-1 C1–C7 结论维持，C2/C4 的观测口径
缺口已由 §12.1 闭合）：

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
| --- | --- | --- | --- | --- | --- |
| C1 | 任意 projection | 重复/交错调用 | 逐字节相同 | 无（§7.6 零跨调用状态；tie-break 与 docs 表键序解耦） | — |
| C2 | 手造环投影（四构造器合法产物） | descent 重入祖先 | 终止 + `…` 位标 | 无（栈语义钉死；CT-8 9 格强制；⑤观测 = §12.1 审计，可执行且观测自身不抛） | — |
| C3 | 别名体引用主树同环节点 | 主树完成后渲染别名块 | 终止（栈已弹出 → 别名体内自重入 `…`） | 无（`optionalRingSkeleton` 的 RingAlias 即此形态；全局 visited 误用已显式排除） | — |
| C4 | 任意输入 | 调用前后对账 | 零变异 | 无（非环：CT-6 stringify（辖域 = 无环金标）；环：CT-8⑤ §12.1 审计——两口径各在其辖域内可执行） | — |
| C5 | truncations 三态 | 渲染 | 逐字节相同、无 ✂ | 无（空清单短路） | — |
| C6 | docs 表同内容不同键序 | 渲染 | 输出一致 | 无（字典序 tie-break） | — |
| C7 | 环 × 预算交互多位分布 | 不同 depth 读 | 各自确定、终止、`…` 位置可推导 | 无（§7.6 + §7.1.3 组合；CT-8④ 已含 optionalRing d1 超集澄清） | — |
| C8（本轮新增） | 审计助手自身对 DAG 共享图 | 同一节点经两条路径可达 | 回引占位、不重复展开、digest 稳定 | 无（全局 seen 对环/DAG 同法；§12.1 第 1 条成文） | — |

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
| --- | --- | --- | --- | --- |
| E1 | 畸形 projection/truncations | `InternalError`（import 唯一类；loud、可归因、无部分输出）+ CT-9 五抽样强制 | 无（int both-or-neither 已入清单；类身份单一，`instanceof`/诊断分流无歧义） | — |
| E2 | 环输入 | `…` 省略 + 终止（throw 备选 8 否决成立） | 无（CT-8 强制；观测口径 §12.1 可执行） | — |
| E3 | 敌意 docs 文本 | 注释只在结构前缀后 + 折叠/strip；闭行不携注释 | 无（构造性保证；CT-4 敏感性成立） | — |
| E4 | 敌意 getter/Proxy 抛错 | 不收敛（trusted-domain） | 已登记（§7.5 边界 + §13 F1 + §12.1 第 3 条「resolver 产物为 plain 对象图」） | — |
| E5 | 静默失败面 | 无降级 string、无吞错、无部分输出；回滚 = 删 5 文件 | 无 | — |
| E6（本轮新增） | 观测助手自身异常（如对环图 stringify） | §12.1 明令禁止 + 注释锚「R4 病灶」成文 | 无（观测自身不抛为 CT-8 预期观察的一部分） | — |

正常路径不变量（m+1 计数、三态等价、docs 无关结构、空注释省略、`?` 无损）未见以
fallback 掩盖缺失。

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
| --- | --- | --- | --- |
| `@nomicore/vfsl` index 新增 1 值 + 1 类型导出 | 无：加法导出，20 既有名不动（超集断言） | §10 行 1；index 实读 | — |
| resolver 调用方（T2 缝 2） | 无：「窄化 ok 后直传」措辞正确；接线义务挂台账 | §7.0、§10 行 2 | — |
| doc-runtime truncations 生产方（T2） | 无：结构同构、透传零转换 | §7.0；`read.ts` L88–92 | — |
| 新契约测试四件 | 无：文件/职责/红绿机制与 SA6 §12.1 一致；CT-8/CT-9 落红文件、审计助手为局部函数、环夹具只读 import 既有导出 | §11/§12 | — |
| trusted-domain 失败通道消费方 | 无：单一类身份（import `resolve.ts` L26–31）——`instanceof` 分流、grep 取证、类演化均单点 | §7.0/§7.5；本仓 grep 复核 | — |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
| --- | --- | --- | --- |
| 投影文法权威 | vfsl（ADR 0027） | `packages/vfsl/src/render-projection-text.ts` | ✓ |
| 头行前贴 | readData 组合层（缝 2） | §1 非目标 + G1.4 反断言 | ✓ |
| truncations 事实源 | doc-runtime 值通道（本票只读同构） | §7.0 结构类型 | ✓ |
| trusted-domain `InternalError` | 包内单一定义（`resolve.ts`）+ 跨模块 import | §7.0 import（R5 修订后） | ✓ 已收敛 |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
| --- | --- | --- | --- | --- |
| schema→文本发射 | `vfsl-codegen/src/emitter.ts`（构建期 TS 类型文本） | 运行期投影→呈现文本 | 一致（不重复） | 输入/输出/消费方三轴皆异 |
| trusted-domain 失败通道 | `resolve.ts` L26–31 唯一定义 + 4 处 import | 渲染器同一路线 import | **一致（R5 修订后）** | 同精神、同包惯例延伸、定义数 = 1 |
| docs 归位/切片 | `sliceDocs`（resolver，切片） | §7.2（渲染侧归位，呈现） | 一致 | 切片已冻结，渲染侧只消费投影内键 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
| --- | --- | --- | --- |
| 投影内容 / 截断事实 / 别名闭包序 | resolver ok 四件套 / truncations 第二参 / `aliases` 键序 | 渲染文本（纯函数） | 无 |
| InternalError 类身份 | `resolve.ts` L26–31（唯一） | 无第二定义 | **无（R5 闭合）** |

### 生命周期对称性

纯函数：无 acquire/release/后台任务/订阅；回滚 = 删 5 文件（DENY 全零触碰复核）。✓

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
| --- | --- | --- | --- |
| 第二 `InternalError` 类 | `resolve.ts` L26 + 4 处 import | import（R5 修订后） | 已消除 |
| 零变异观测第二口径 | CT-6 stringify（无环辖域） | §12.1 审计（环辖域，测试侧局部） | 非重复（辖域切分成文，两口径互不侵入） |
| 第二 docs 归位/截断清单/文法权威 | `sliceDocs`/`ReadLogicalValueTruncationEntry`/v1-spec §2 | §7.2/`ProjectionTruncation`/§7.1 | 非重复（辖域切分已裁定） |

未发现绕过既有扩展点、双事实源或仅服务单一 Issue 的通用抽象。

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
| --- | --- | --- |
| ALLOW：`src/render-projection-text.ts`（新）、`src/index.ts`（+2 行）、测试四件 | 与 SA6 §10/§12.1 一致；§12.1 审计助手落红文件局部（ALLOW 行明示不进公共面/fixture）；fixture 非测试文件先例实测；CT-8/CT-9 断言落既有四文件、86 格不变 | — |
| DENY：resolver/derived/evaluate/resolve/validators、namespace-runtime、doc-runtime、docs/CONTEXT、版本链、vitest/tsconfig | 全部为 SA8 frozen surfaces 或后续票生效点；正文无触达；R5 的 `import from './resolve.js'` 是只读消费（import ≠ 修改），DENY 零变化 | — |
| ALLOW 无理由扩张 / follow-up 掩蔽 | 未发现：缝 2/3、bump、敌意 getter 均显式跨票台账 | — |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
| --- | --- | --- | --- |
| CT-1…CT-7（SA6 契约组） | §12 表逐行承接（录制纪律、`EXPECTED_CELL_KEYS` 独立推导、控制组恒绿）；CT-6 stringify 辖域澄清后与 SA6 §12.7 原样一致（approved contract 零修改） | 无 | — |
| CT-8 环投影（强制，9 格） | ①终止 ②重复逐字节同 ③交错逐字节同 ④`…` 在场（含 optionalRing d1 超集澄清）⑤零变异 = §12.1 环安全审计（禁 stringify） | 无——⑤ 观测在本轮逐项攻击下于全部 9 格可按设计原文执行且观测自身不抛；§12.1 第 4 条含命令与预期观察，SA7 清单可直接执行 | — |
| CT-9 畸形输入（强制，5 抽样） | throw + `error.name === 'InternalError'` + 可归因消息 + 无部分输出；类身份注记（单一类、定义数 = 1） | 无（断言面不变；类身份已在设计面钉死，`error.name` 断言不区分 import 与自有类的论证成立且已成名文） | — |
| 金标防漂移 | §7.1 规范性钉死 + 录制头部人工核对清单（含裸宿主行、`?` 在场）+ SA7 对照复核 | 无（规则↔样张矛盾已在 iteration 1 消除；O1 修正消除该 3 格录制的误导源） | — |

## 13. Required revisions

**无**（R4/R5 已于本版落实并经本轮代码级核验；prior R1–R3/N1–N6 为正文基线）。

## 14. Non-blocking observations

| # | Observation | Evidence | Suggestion |
| --- | --- | --- | --- |
| O6（本轮新登记，非阻断） | §12.1 审计的观测面 = own enumerable string-keyed 状态（`Object.keys` 遍历 + 数组索引 + 原始值）；对不可见变异（原型链修改、non-enumerable 属性定义、Symbol 键值）不敏感——与原 stringify 口径同类盲区且检测力严格更强（多身份面与键序面），对「渲染器为可信纯函数」的契约对象无实际暴露面 | §12.1 算法钉死面第 1/3 条；`Object.keys` 语义 | 无需修订；如日后渲染器输入面扩至非 plain 对象（与 §7.5 边界冲突时）再议 |
| O7（承 iteration-1 O5，维持） | L1/L2（根位 docs 不呈现；inline 枚举成员注释合并）产品性损失的登记与取舍维持认可 | §13 L1/L2、§7.7.3 | 无需修订 |
| O8（措辞性，不改不阻断） | 设计 §5/§14 对四处消费方的引文写作单名 import `import { InternalError } from './resolve.js'`，实际仓内语句为组合 import（如 `import { InternalError, walkRefChain } from './resolve.js'`）——路线与锚点准确，仅语句形态引述不逐字 | 本仓 L57/L39/L20/L33 实读 | 无需修订（渲染器确只需单名 import，引文指路线而非要求逐字复制既有语句） |

iteration-1 O1–O4 已被设计采纳并核实闭合，自观察表移除；O5 归并为本表 O7。

## 15. 复查路由建议

本轮无新 ADR 冲突风险面：R4 落实是验收观测口径修正（测试侧局部助手，不改公共
API/文法/失败语义，SA6 approved contract 零修改）；R5 落实是向包内既有惯例收敛
（import 唯一类定义——减少而非新增裁决面）。本评审 `requiresConflictRecheck: false`。
设计 §15 已登记的复查枚举（新增公共 API、P1/P3、`…` 记号、§7.5 通道、R1/R2 裁决面）
维持原路由：设计定稿后做设计面冲突复审，实现落地后按 SA8 frozen surfaces 表核对
diff——该义务由设计 §15 自行申报（`requiresConflictRecheck: true` 于设计侧），与本
评审结论不冲突（两者辖域不同）。
