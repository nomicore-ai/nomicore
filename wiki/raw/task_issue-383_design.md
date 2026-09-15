# SA1 实现设计 — issue #383：[ADR 0029] P3 组合面与 lease 类型（缝 2：runtime + registry）

- 任务类型：**Feature（能力缺口兑现）** —— 已接受 ADR 0029 验收「缝 2（lease 两方法公共面）」的实现票；非 Bug 修复。
- 设计基线：worktree `mabf/issue-383` HEAD `de2ff55`（ADR 0029 基线 `8a4fa40` + P1 `1b639e0` + P2 缝 1 `de2ff55`）——与 SA2 评审基线一致（修订期 HEAD 未移动）。
- 输入：任务简报 `wiki/raw/task_issue-383.md`（评论 REST 快照为空）、SA8 冲突报告 `wiki/raw/task_issue-383_conflict_report.md`（verdict `clear`，R1–R16 / F1–F11 / A1–A6，`requiresConflictRecheck: true`）、SA8 决议摘录 `wiki/raw/task_issue-383_relevant_decisions.md`、SA6 验收契约 `wiki/raw/task_issue-383_sa6_contract.md`（verdict `approve`）、SA2 设计评审 `wiki/raw/task_issue-383_sa2_review.md`（verdict `reject`，MAJOR `F-383-S2-1` 一条 + 非阻塞观察 5 条——本版逐条落实，见 §14）、`docs/adr/0029-filtered-window-read.md`、`docs/adr/0028-window-read.md`、`CONTEXT.md` L61–67、`docs/AGENTS.md`（文档验证门）及源码。
- 本设计为 **iteration 1**（原位修订 iteration 0）：核心实现设计（§5.1–§5.5 运行时/registry 架构）经 SA2 源码级核验**全部成立、零变更**；本版修订 = `F-383-S2-1` 文档对齐范围补全（§5.6/§7/§8）+ 非阻塞观察 1/2/5 的措辞收编（§5.1/§5.2/§7）。全文按当前一致设计重写，无历史附录。

---

## 1. 任务模型：目标与非目标

### 1.1 能力缺口（症状）

调用方在 lease 公共面上传合法 `where`（如「找到所有 `state == 'claimed'` 的 task」）时，runtime 组合层与 registry lease 面均响亮失败 `WINDOW_OPTIONS_INVALID`；同一输入在 W1（doc-runtime `readMapWindowAtPath`）成功且过滤正确（SA6 §5 O1–O10，3 轮 × 双面 × 双方法稳定复现）。调用方当前**无法**在 lease 面完成过滤窗口读并读出截断信号。

### 1.2 目标（缝 2 范围，ADR 0029 验收缝 2 逐条）

1. **S3 镜像扩展**：`canonicalWindowBudget` options 键集白名单四键 → 五键（加 `where`），`where` 判据与 W1 `validateWhere`/`validateWhereTerm`（W-4–W-13）一致；接缝两出口（视图不稳定重派发 / 交替视图终态）对 `where` 判据同步；敌意 `where` 在组合层零外抛。
2. **S6 双语义结算**：删除缝 1 入口 fail-closed 分支（`seamWhereNotImplemented`）；`where` 在场判据键于 W1 结算单源 `total === undefined`（不重读 options）；`truncated` 双语义（无 where 精确 `kept < total` / 有 where 装满判定 `kept === canonical.n`）；✂ 段有 where 永不装配、无 where 逐字节不变。
3. **registry lease 透传与类型面**：`where` 经既有 raw 引用直传通道与单源别名链到达 lease 公共面（已在，零代码变化）；类型面 fail-closed 由既有别名链承载并加测试锁定。
4. 测试先例落地（SA6 §12.3/§12.5 P1–P6）与**文档对齐**（SA8 A6 扩展，非阻塞）：根 `AGENTS.md` 签名句 + `.agents/skills/nomicore/typed-access.md` + `docs/integration/cordis-plugin-hosting.md` 窗口读节补 `where` 措辞 + `.agents/skills/nomicore/SKILL.md` 路由行能力提及（`F-383-S2-1`；详 §5.6）。

### 1.3 非目标

- 不动 `readData`（options 闭合形状 `{depth?, maxChildrenPerNode?}` 零变化，F1/F12）。
- 不新增第四个读方法、不加第五键 `total`（F2）；runtime 十四键 / lease 十五键面不动（F3）。
- 不动 doc-runtime W1 面（F9：`packages/doc-runtime/src/**` 零 diff；过滤、`total` 双形态、W-1–W-13 判据已于 #398 交付）。
- 不动失败码族（F4：三码 + `PATH_NOT_ALLOWED` 透传 + `RUNTIME_READ_DISABLED` 停接纳；`where` 形状非法收编 `WINDOW_OPTIONS_INVALID`）。
- 不扩 `where`/orderBy v1 词表（F5/F6：in/范围/OR/NOT/多段 field/容器深相等一律 v1 外响亮拒绝）；不在 `where` 上生长领域规则语义（ADR 0029 §7 / ADR 0002 划界）。
- 不在组合层引入计数、谓词求值、导航/载体分类镜像（ADR 0029 §8 / B-3/B-15）。
- 文档对齐是**措辞补全**（§5.6）：只改陈述被缝 2 失真的消费方指导/集成文档句子，不发明实现行为、不改 `CONTEXT.md` 词条（缝 3 已闭合）、不改 `docs/adr/**`（ADR 只经 append/supersede 演进）。
- 本票不实现、不 author 验收测试文件到仓内（设计仅指明测试义务与路径）。

---

## 2. 当前行为与证据锚点

| # | 事实 | 锚点 |
|---|---|---|
| E-1 | runtime 公共面恰十四键（含第十三/十四键 `readArray`/`readMap`）；编排 = S1 lifecycle gate（closing/closed → `RUNTIME_READ_DISABLED`，零 options 读取、零 doc 触碰）→ S2 W1 直通（失败成员原样透传，无半窗）→ 组合（S3/S5/S6） | `packages/namespace-runtime/src/runtime.ts` L4、L181、L683–704、L895–903 |
| E-2 | 组合层入口 fail-closed 中间态：`input.total === undefined` → `seamWhereNotImplemented(path)` 响亮 `WINDOW_OPTIONS_INVALID`；注释明言「缝 2 落地时本分支被……整体取代」 | `packages/namespace-runtime/src/window-read.ts` L161–168、L432–446 |
| E-3 | S3 `canonicalWindowBudget` options 键集白名单**恰四键**（`n`/`orderBy`/`depth`/`maxChildrenPerNode`），`where` 在场即「键集漂移」→ `{ok:false}` → 出口①重派发 / 出口②接缝终态；独立于入口分支的第二阻塞点（SA6 隔离实验 O8：`where: undefined` 时 W1 `total` 保持数值、入口分支旁路，S3 仍以「视图不稳定」出口②拒绝） | `window-read.ts` L219–264（白名单 L229–232）、L172–178；SA6 §5 O8/§8 step 4 |
| E-4 | S6 现状：`kept = entries.length`、`truncated = kept < total`、`total` 只从 W1 结算直通（零重算）；✂ 窗口事实块仅在 `truncated ∧ schema ≠ null` 装配（B-8 冻结文法：头行 + 恰一行事实行、四插值槽、注入防御） | `window-read.ts` L189–197、L351–397 |
| E-5 | W1（doc-runtime `window.ts`）已交付 `where`：OPT 校验五键白名单（含 `where`，W-1）、`validateWhere`/`validateWhereTerm`（W-4–W-13：数组形态、length 经 descriptor、非空、≤16（`WHERE_TERM_LIMIT` 模块私有常量）、逐下标 descriptor 无空洞、零 accessor、plain 原型链、恰 `field`/`equals` 两键、field 字符串、equals 标量闭集 finite number）；成功结算恰三键 `{ok:true, value, total}`，`total` 无 where = 候选标识计数 / 有 where = `undefined`；管线序 where → orderBy → n 在 W1 内完成（枚举循环内过滤，未匹配零物化） | `packages/doc-runtime/src/window.ts` L74、L205–255（OPT→N0→N1 定序 L213–229）、L290–353（W-1–W-3）、L362–474（W-4–W-13）、L247–250 |
| E-6 | registry lease `readArray`/`readMap`：released 短路（`NAMESPACE_LEASE_RELEASED`）先于透传 → active 期 `entry.runtime.readArray/readMap(path, options)` **raw 引用直传**（零解释/零校验）；Equal 别名锁（lease options/result ≡ runtime 签名） | `packages/namespace-registry/src/lease.ts` L309–316、L440–450 |
| E-7 | 类型面已透传：`NamespaceLeaseReadArrayOptions = NamespaceRuntimeReadArrayOptions = ReadArrayWindowOptions`（含 `where?: readonly WhereTerm[]` 与 per-face `orderBy` 判别）——单源别名链 lease → runtime → doc-runtime；`WhereTerm` 自 doc-runtime `src/index.ts` type-only 导出，但**未**自 namespace-runtime / namespace-registry 再导出（Y5：TS2694） | `packages/namespace-registry/src/types.ts` L468–485；`packages/doc-runtime/src/window.ts` L68–92；`packages/doc-runtime/src/index.ts` L52–68；SA6 §6 N5/E7 |
| E-8 | 耐久不变式测试在场：`issue-382-lease-where-no-silent-pass.test.ts` 条件不变式（`ok:true` ⟹ 条目全满足谓词 / `ok:false` ⟹ 码恒 `WINDOW_OPTIONS_INVALID`）——缝 2 态无需退役、必须继续绿 | `packages/namespace-registry/test/issue-382-lease-where-no-silent-pass.test.ts` L1–68 |
| E-9 | 全仓基线（实现前，SA6 实跑）：`pnpm typecheck` exit 0（14 个 tsc 工程）；`pnpm test` 396 files / 4827 tests 全绿 / exit 0 | SA6 §13/§14 |
| E-10 | 生产调用链封闭：`window-read.ts` 组合入口仅 `runtime.ts` 消费；runtime `readArray`/`readMap` 的生产调用方仅 `lease.ts`（其余为测试） | 全仓 grep（本设计期）；`runtime.ts` L65、L689–703；`lease.ts` L309–316 |
| E-11 | 文档面窗口截断契约陈述清单（本设计期独立复核，与 SA2 §11 一致）：全仓 `.md` grep `kept < total` / `readArray(\|readMap(`——规范文档面陈述 `truncated === kept < total` 无条件精确语义者恰三处：根 `AGENTS.md` L31（签名句，D6 原覆盖）、`.agents/skills/nomicore/typed-access.md` L135–181（L172 ✂ 窗口事实段）与 `docs/integration/cordis-plugin-hosting.md` L390–424（L409/L412 注释 + 样张）；另两处**缩写引用**（未陈述截断语义）：`.agents/skills/nomicore/SKILL.md` L15（路由行 gloss）、`docs/integration/app-data-access-skill.md` L36–37/L129（速查调用形态）。`CONTEXT.md` L61–67 已含双语义全量词条（权威）；`docs/adr/0028` L63 为决策记录（ADR 0029 已演进其条款）；`wiki/raw/**` 为证据件非规范文档 | 本设计期 grep（`kept < total` 全仓 76 命中经逐文件归类）；SA2 §11/§13 `F-383-S2-1` |

---

## 3. 根因 / 能力缺口链（承接 SA6 §8）

| Step | 事实 | 证据 | 承接 |
|---|---|---|---|
| 症状 | lease/runtime 面合法 `where` 读 → `ok:false, WINDOW_OPTIONS_INVALID` | SA6 §5 O2–O5、O8–O10 | §4 设计目标 |
| 直接阻塞点 1 | 组合入口 fail-closed 分支（`total === undefined` → `seamWhereNotImplemented`） | `window-read.ts` L161–168 | §5.1 整体取代该分支 |
| 直接阻塞点 2 | S3 白名单恰四键（`where` 即键集漂移 → 两出口响亮拒绝） | `window-read.ts` L229–232；SA6 O8/E3 | §5.2 白名单扩五键 + `where` 判据镜像 |
| 深层定位 | 缝 1 中间态是**有意设计**的待取代态（#382 留下的缝序中间态），缺口 = 缝 2 未实现而非缺陷 | `window-read.ts` L10–18、L164–167；SA8 R16 | 本票即取代义务的兑现 |
| 层位正确性 | W1 已实现过滤与 `total` 双形态；类型面已透传 `where`——缺口只在 runtime 组合层 S3/S6 | SA6 §8 step 6；E-5/E-7 | 设计落点唯一：`window-read.ts` |

---

## 4. Owner 要求落实

Issue #383 评论 REST 快照为空（`[]`）——**无 Owner 评论、无 override 权威在场**（SA8 §4、SA6 §2）。Owner 要求以 Issue 正文 AC1–AC8 为唯一载体，逐条落实：

| AC（简报） | 要求 | 设计落实位置 |
|---|---|---|
| AC1 | 无 where 时 lease 面结算与 ADR 0028 快照逐字节一致（total = 标识计数、truncated = kept < total、✂ 按 truncated 装配，既有快照零漂移） | §5.1（`total !== undefined` 分支逐字节保持现状）；§8 验收 A 组 |
| AC2 | 有 where 时 `truncated === (kept === n)`；✂ 永不装配、不呈现过滤槽；schema 仍元素口径投影文本 | §5.1 双语义 + ✂ 结构性排除；§8 T/X 组 |
| AC3 | 恒四键 own 键集 `{ok, value, schema, truncated}` 不变；条目身份随行可拼下一轮路径 | §5.1（成功成员构造不变）；§8 K 组 |
| AC4 | 组合式 depth 等价锚：过滤入选项 ≡ 同预算 readData(项路径) | §5.4（零新逻辑，测试义务）；§8 D 组 |
| AC5 | S3 两出口对 where 判据同步；敌意 where 组合层零外抛 | §5.2 镜像判据 + 既有两出口复用；§8 Z 组 |
| AC6 | registry lease 类型 fail-closed（test-d）；registry 透传组合面 | §5.3（零代码 + 既有别名链）；§8 L/Y 组 |
| AC7 | close 后带 where 读 → `RUNTIME_READ_DISABLED`（停接纳不豁免，四键失败形） | §5.5（S1 gate 不动，where 与停接纳正交）；§8 C 组 |
| AC8 | 缝 2 测试先例 + 全仓 typecheck/测试绿 | §8 验收映射（SA6 P1–P6 路径）；§7 文件范围 |

---

## 5. 设计决策

### 5.1 D1 — 取代入口 fail-closed：S6 双语义结算 + ✂ 永不装配

**删除** `composeWindowRead` 的入口分支（`if (input.total === undefined) return seamWhereNotImplemented(input.path);`）与 `seamWhereNotImplemented` 函数整体（SA8 A3 / SA6 M3：注释明言被整体取代）。`where` 在场判据**键于 W1 结算单源** `total === undefined`（B-4/B-8 单源不变量），不重读 options、不校验 where 形状（合法性由 W1 单权威裁定，S3 只做接缝净化镜像——见 5.2）。

`composeWindowRead` 结算段改为（伪代码，`canonical` 为 S3 产物，`canonical.n` 必在场）：

```ts
// S5 不变：segments = normalizeReadPath(path) 单次快照；anchor = anchorSchemaBody(...)。
const kept = entries.length;
const truncated = total === undefined ? kept === canonical.n : kept < total;
const schema = total === undefined
  ? anchor                                    // 有 where：✂ 永不装配（结构性排除，非布尔开关）
  : truncated && anchor !== null && segments !== null
    ? appendWindowFacts(anchor, windowFactsBlock(segments, canonical.term, kept, total))
    : anchor;                                 // 无 where：现状逐字节保持（AC1/F7/F8）
return { ok: true, value: entries, schema, truncated };
```

不变量：

- **双语义单点**：`total === undefined` 是唯一在场判据；两分支互斥且完备——无 `total ?? 0`、无 `as number`、无 `kept < undefined → false` 静默路径（SA6 §12.6 S3）。
- **装满判定**用 **canonical `n`**（S3 镜像产物，已判 ≥1 有限整数），不用 W1 内部值（组合层拿不到也不需要）；`kept = value.length`（B-5）。匹配恰 n 个时 `truncated === true`（计数型实现必被 T4/S2 击穿）。
- **canonical `n` 的承载改形（预期改动，SA2 观察 1 收编）**：现行 `CanonicalWindowBudget`（`window-read.ts` L208–210）ok 分支为 `{ ok, budget, term }` **不携带 `n`**（L254 必填校验后弃值）。装满判定需要 canonical `n` 在场 ⟹ ok 分支扩为 `{ ok: true, budget, term, n: number }`（判过值原样携带，零新判据）；该返回类型扩展与 `canonicalWhere` 镜像同属 ALLOW ① 预期改动（SA6 §12.6 S3「canonical `n` 参与 `kept === n`」即其结构审计锚），非越权改形。
- **✂ 永不装配**由分支结构保证：`appendWindowFacts` 只出现在 `total !== undefined` 分支内——有 where 时 `schema === anchor` 原样（元素口径投影文本，where 不影响；X1–X3 与无 where 对照**字节相等**）。
- 成功成员恒四键构造不变（无 `total` 键、无第五键；F2）。
- `WindowComposeInput.total` 的文档注释与模块头注（L1–41）同步改写为双语义描述（缝 1 中间态叙述删除）。

### 5.2 D2 — S3 镜像扩展：五键白名单 + `canonicalWhere` 判据镜像

`canonicalWindowBudget` 的 options 键集白名单四键 → **五键**（`n`/`orderBy`/`depth`/`maxChildrenPerNode`/`where`，镜像 W1 W-1）。键循环内对 `where` 与 W1 同款收集（`rawWhere`/`hasWhere`；present-undefined 顶层剥离 ≡ 缺席，W-3/B-12——`where: undefined` 不得被当作键集漂移，SA6 O8/T10）。校验序列镜像 W1 `validateWindowOptions` 定序：键循环 → `n` 必填 → `orderBy` → **`where`**（序列一致性只为审计可对齐；S3 内部单一 `{ok:false}` 出口使序列不产生行为差异）。

新增 `canonicalWhere(raw)`：**判据逐条镜像** W1 `validateWhere`/`validateWhereTerm`（W-4–W-13），全程 descriptor 纪律（`Object.keys` + `Object.getOwnPropertyDescriptor`，零 `[[Get]]`、零 accessor 执行）、整体 try 收编 trap 异常：

| 镜像判据 | W1 锚点 | S3 镜像 |
|---|---|---|
| W-4 数组性：`Array.isArray`，否则不稳定 | `window.ts` L366–370 | 同 |
| W-5 长度：`length` 经 own data descriptor、非负整数，否则不稳定 | L372–379 | 同 |
| 非空（len === 0 → 不稳定）与 ≤16 上限 | L380–385（`WHERE_TERM_LIMIT = 16` 模块私有） | 同判据；哨兵上限以**具名模块私有常量** `const WHERE_TERM_LIMIT = 16` + 出处注释镜像（见下） |
| W-6 逐下标：`getOwnPropertyDescriptor(raw, String(i))`，descriptor 缺失（稀疏空洞）或 accessor → 不稳定 | L387–395 | 同 |
| W-7 元素值：非 undefined/null、typeof object、非数组 | L412–414 | 同 |
| W-8 元素宿主：原型链恰 `Object.prototype` 或 `null` | L416–420 | 同 |
| W-9 元素键集：白名单恰 `field`/`equals`（未知键即不稳定） | L425–429 | 同 |
| W-12 必填闭环：两键皆须以 own data 属性在场 | L443–446 | 同（注意：WhereTerm 层**无** present-undefined 豁免——`field`/`equals` 值 undefined 由 W-10/W-11 值判据击落，镜像同） |
| W-10 `field`：`typeof === 'string'`（空串合法，零强制转换） | L447–450 | 同 |
| W-11 `equals`：标量闭集 `string | number(finite) | boolean | null`（禁 truthiness 校验；`''`/`0`/`false`/`null` 全合法） | L451–455、L462–474 | 同 |
| trap 抛出 → 收编为不稳定（零外抛） | L401–402、L457–459 | 同 |

要点：

- **S3 是镜像不是第三套权威**（SA8 A2/R3）：合法性由 W1 单权威裁定；S3 镜像的唯一职责是**接缝净化**——判定「S3 视图与 W1 已接受视图是否判据一致」，任何违例 ⟹ 视图不稳定 ⟹ 走**既有**两出口（`{ok:false}` → 出口①重派发 W1 一次：失败成员原样透传；竟又接受 → 出口②接缝终态 `WINDOW_OPTIONS_INVALID`）。两出口机制、`seamWindowOptionsInvalid`、`redispatch` 通道全部复用，**零新出口、零新码**。
- **镜像不产出 `where` canonical 值**：`canonicalWhere` 只返回稳定/不稳定布尔；不构造归一化数组、不向下游传递——组合层零谓词求值镜像、零过滤语义参与（B-3/B-15）。在场判据在 S6 单点键于 `total`（5.1）。
- **结构合法但隐藏 `where` 的视图必须通过**（SA6 §12.3.10 S1）：视图②呈 `{n:2}`（五键白名单内、无 where）⟹ 结构合法 ⟹ 非不稳定 ⟹ canonical 通过；结算仍按 W1 已过滤结果（`total === undefined` → 装满判定）。这与「present-undefined ≡ 缺席」同族：canonical 是稳定性探测器，**不是** where 在场探测器。若实现改判该情形为「视图不稳定」，与 SA8 A3 判据文本不符，须回门禁复核并同步 S1 期望，不得静默（SA6 §15-O4）。
- **哨兵 16 的镜像形态（SA2 观察 5 收编）**：`WHERE_TERM_LIMIT` 是 doc-runtime 模块私有常量，不导出（导出即扩 doc-runtime 公共面，违反 F9 零 diff）。S3 在 `window-read.ts` 内以**具名模块私有常量** `const WHERE_TERM_LIMIT = 16` + 出处注释镜像（与 doc-runtime 形态对称、单点定位，便于 Z9 与结构审计锚定；不散落字面量）；仓内出处标记先例：`foldSegment`「copied from read-schema-projection.ts@ab6e390」。判据漂移风险由 §8 Z9（恰 16 合法 / 17 非法）与 §12.6 S4 结构审计守住。
- 顶层 options 宿主判据（plain 原型链、非数组、非 null）与 `n`/`depth`/`maxChildrenPerNode` 值判据**逐字节保持现状**（SA2 观察 2 收编措辞）：`window-read.ts` L221–254 区间内仅两处预期改写——键循环白名单条件（L230）四键 → 五键（加 `where`）、成功返回形状按 §5.1 增携带 `n`；**宿主判据与轴值判据本身不动**。

### 5.3 D3 — registry 透传与类型面：零代码、锁边界

- `packages/namespace-registry/src/lease.ts`、`types.ts`、`index.ts` **零改动**：`where` 经既有 raw 引用直传（E-6）与单源别名链（E-7）已到达 lease 公共面；透传即代理语义（ADR 0009 / ADR 0024 决策 6 / F10），released 短路先于透传保持。
- **不新增 `WhereTerm` 具名再导出**（SA6 L6/O5 明示「未加不构成 AC 违约」；SA8 A4 列为可选）：
  - AC6 的类型 fail-closed 义务已由既有别名链完整承载（Y1 正向 / Y2 十四条 `@ts-expect-error` 负向在 HEAD 即绿——缺口不在类型面，SA6 §6 N5）；
  - 调用方需要具名类型时，直依 `@nomicore/doc-runtime` 公共面（`WhereTerm` type-only 导出既有且冻结）——与 runtime `src/index.ts` 既有先例同款（#364 退役 `ReadLogicalValueTruncationEntry` 时「需要值通道截断事实类型的消费方直依 `@nomicore/doc-runtime`」）；
  - 结构化书写 `{ field: 'state', equals: 'claimed' }` 本身可赋值，简报点名的调用方能力不依赖具名导入；
  - 零新增导出 ⟹ 三包值导出键集不变 ⟹ 公共面守卫测试零改动（M6 零变化路径）。
- `packages/namespace-runtime/src/index.ts` 零改动（同上；窗口类型导出面维持 #369 形态）。

### 5.4 D4 — 组合式 depth 等价锚与 schema 通道（零新逻辑）

- 条目值 = W1 入选项物化产物原样直通（每项物化 ≡ `readLogicalValueAtPath(doc, [...path, id], 同预算)`，`window.ts` L237–246）——等价锚是**测试义务**（§8 D1–D5：对入选项逐条目与同预算 `readData(项路径)` `toStrictEqual`），组合层零重物化、零重过滤（D5/S3 毒埋用例击穿任何重走）。
- S5 锚链不变：数组面 `[...path, 0]` 单锚 / 键面 `'<key>'` → 容器口径两级回退；只消费 `canonical.budget`（`depth`/`maxChildrenPerNode` 两轴，where 不进入预算）与 schema——有 where 时 `schema` 与同预算无 where 读**字节相等**（X1–X3），不可解析 → `null`（非读失败，X5）。
- 条目身份随行不变：`{index, value}` / `{key, value}`，index = 原容器位置（过滤后不重编号，K4）、key = 原键（K5）。

### 5.5 D5 — 生命周期与失败面（零改动，验收保持）

- S1 gate 先行不变：`closing`/`closed` → `readDisabled`（own 键集恰 `{ok, code, path, message}`，`RUNTIME_READ_DISABLED`），零 options 读取（含 where 通道零触达）——停接纳与 where 正交（AC7/C 组）。
- released 短路先于透传不变（`{ok:false, code:'NAMESPACE_LEASE_RELEASED'}` 三键，零 options 触达；C4/L2）。
- W1 失败成员原样透传不变：`WINDOW_TARGET_ABSENT` / `WINDOW_CARRIER_MISMATCH` / `PATH_NOT_ALLOWED`（含命中项物化失败，path 精确到项、无半窗）一律不被 options 面吸收（F 组；见 §9 登记的 F1/F2/F4 HEAD 颜色事项）。

### 5.6 D6 — 文档对齐（SA8 A6 扩展；`F-383-S2-1`，非阻塞）

**范围依据**：`docs/AGENTS.md` 文档验证门——「When code behavior changes, update every normative document whose stated contract changed; documentation-only wording changes must not invent implementation behavior」+「search for stale terminology and contradicted decisions」。缝 2 改变 lease/runtime 窗口读的截断结算语义 ⟹ 每份**无条件陈述该契约**的规范/消费方指导文档必须同 PR 补注；否则按文档解读的调用方（正是简报点名的「找到所有 claimed task 并正确读出截断信号」者）会把装满判定的 `truncated === false`（kept < n = 扫完了、确定没有更多）误读成「未截断、无更多信号」。清单经本设计期全仓 grep 独立复核（E-11，与 SA2 §11 一致）：陈述面恰下列四处（三处必改 + 一处路由 gloss）加一处**显式登记不改**。

**措辞权威**：CONTEXT.md「过滤窗口」词条（L65–67，缝 3 已闭合）与 ADR 0029 §5——文档补注只做措辞限定与能力提及，不得发明实现行为、不得陈述词条/ADR 之外的语义。

| 文档 | 位置 | 现状（失真点/缺口） | 预期补注（措辞补全，零行为发明） |
|---|---|---|---|
| 根 `AGENTS.md` | 「Typed Namespace writes」节 lease 窗口读签名句 | 两处签名 `readArray(path, { n, orderBy, depth?, maxChildrenPerNode? })` / `readMap(…)` 未含 `where`；同句「`truncated === kept < total` with the ✂ section carrying the window facts (basis + direction + kept/total)」为无条件陈述 | 签名增补可选 `where`（`{ n, orderBy, where?, depth?, maxChildrenPerNode? }`）；truncated/✂ 句补限定——无 where 时成立；有 where 时 `truncated` 为装满判定（`kept === n` → true 可能还有；`kept < n` → false 确定没有）且 ✂ 永不装配，指向 CONTEXT.md「过滤窗口」词条 |
| `.agents/skills/nomicore/typed-access.md` | 「Window reads: `readArray` / `readMap`」节（L135–181）——L151 v1 词表段、L172「✂ window facts」段 | 整节未含 `where`；L172 无条件「`truncated === kept < total`, where `total` is the target's candidate entry count … `total: 0` means `truncated: false` and no `✂` section」——对 where 读失真；本文件被根 `AGENTS.md` 指定为消费方必读（「follow `.agents/skills/nomicore/typed-access.md`」），失真即误导目标调用方 | ① L151 词表段补可选 `where`：等值谓词项数组（每项 `{field, equals}`，v1 标量闭集 string/finite number/boolean/null），合取语义，空数组/超上限/词表外形态响亮 `WINDOW_OPTIONS_INVALID`（沿该段既有「closed vocabulary / rejected loudly, never reinterpreted」行文）；② L172 补 where 分支限定：where 缺席沿精确语义；where 在场匹配总数不承诺（`total` 不上四键面）、`truncated` 退化为装满判定（`kept === n` → true 可能还有匹配未入窗；`kept < n` → false 扫完了）、✂ 窗口事实段**永不装配**（调用方自知查询参数）；③ 计数指引诚实降级：where 语境「要计数给大 n」（沿 ADR 0029 §5 原句），不与「do a normal read to count」的容器计数句混淆 |
| `docs/integration/cordis-plugin-hosting.md` | 「窗口读（`readArray` / `readMap`，ADR 0028）」节（L390–424）——L396 options 注释、L409 truncated 注释、L412–414 ✂ 样张 | 整节未含 `where`；L409「`truncated = kept < total；total=0 时 false 且无 ✂ 段`」无条件；L412 样张注释「kept < total 时存在于 schema 文本末块」未区分 where | ① L396 行注释补可选 `where` 一句（等值过滤合取、v1 词表、空数组/词表外响亮拒绝）；② L409 补限定：无 where 精确；有 where 匹配总数不承诺、装满判定（`kept === n` → 可能还有 / `kept < n` → 确定没有）、✂ 永不装配；③ L412 样张注释标注「where 缺席形态」（样张本身无 where、保持有效不动） |
| `.agents/skills/nomicore/SKILL.md` | L15 typed-access 路由行 gloss | 窗口读括注「(`n` + sort term, entry identity back-stitching, the `✂` window-facts line, loud failure codes)」未提 `where`——缩写引用、无失真陈述；但该行是根 `AGENTS.md` 指定技能入口（「use the `nomicore` skill in `.agents/skills/nomicore/`」）的**能力发现面**：缝 2 后「找所有 `state == 'claimed'` 的 task」类任务须路由到 typed-access.md | 括注最小增补一短语级能力提及（如 "`n` + sort term + optional `where` equality filter"）；**gloss 不陈述截断语义**——语义单源在 typed-access.md（docs/AGENTS.md「link to the authoritative source instead of copying its rules」纪律） |

**显式登记不改（`F-383-S2-1` ③ 后半的裁决）**：`docs/integration/app-data-access-skill.md` L36–37 / L129——速查调用形态 `readArray(path, { n, orderBy })` / `readMap(path, { n, orderBy })`。理由：① 属**调用形态缩写**：本就省略可选轴 `depth`/`maxChildrenPerNode`，`where` 缺席同款；该调用形态在缝 2 后仍为合法公共 API 形态，**全文件零陈述被缝 2 失真**（grep 证实无 `kept < total`/截断语义陈述，E-11）；② 该文档自身两级纪律（L45/L116）把「✂ 段解读、预算/窗口完整纪律、边界行为」划入**深水区**、明确「指向 GitHub 的 nomicore skill 随时取最新，复制一份即制造漂移面」——把 where 双语义内联进模板恰违反其禁复制规则；本票已修上游单源（typed-access.md），模板的深水区指针自动继承修正；③ `docs/AGENTS.md` 门只要求更新「stated contract changed」的文档——该文件陈述的契约未变。列入 §7 DENY（防实现票顺手扩写制造第二信源）。

**零改动面**：`CONTEXT.md`、`docs/adr/**`（R14：词条已全文落定、缝 3 已闭合；0029 已 accepted 无决策修订，ADR 只经 append/supersede 演进）；`docs/integration/app-data-access-skill.md`（上文登记）；`.agents/skills/nomicore/` 其余分支文件（`schema.md`/`cordis-host.md`/`replication.md` 无窗口读契约陈述，grep 证实 E-11）。

### 5.7 主要备选方案与不选原因

| 备选 | 不选原因 |
|---|---|
| 组合层自行重读 options 判 where 在场（不走 `total === undefined` 单源） | SA8 A3 明令禁止；被 S1 交替视图用例击穿（视图②隐藏 where → 误判缺席 → `kept < total` 静默错语义）；也违背 B-4 单源纪律 |
| S3 镜像产出归一化 `where` 数组供 S6 消费 | 制造「第三套 where 语义载体」表象，违背零谓词求值镜像（B-15）；在场判据双源化；无任何行为收益 |
| S3 只放行键名、不镜像 where 判据 | 键名放行 + 判据缺位 ⟹ 敌意视图漂移可 `ok:true` 静默通过（Z7/Z8 击穿）；SA8 A2 明令判据一致 |
| 自 doc-runtime 导出 `WHERE_TERM_LIMIT` 供 S3 引用 | 扩 doc-runtime 公共面，违反 F9 零 diff；组合层内具名模块私有常量镜像 + 出处注释 + Z9 审计已够（§5.2） |
| lease/runtime 公共面具名再导出 `WhereTerm` | AC6 不要求（L6「未加不构成违约」）；扩冻结面 + 守卫记账成本；消费方已有 doc-runtime 公共面通道（§5.3） |
| 有 where 时 ✂ 呈现过滤槽 / 结算加第五键 `total` | ADR 0029 备选节明文否决（F2/F8） |
| 组合层计数匹配数（`candidates.length` 语义）或回落 `kept < undefined → false` | ADR 0029 §5「匹配总数恒不承诺」；T2/T4/S1/S2 击穿 |
| 文档对齐仅改根 `AGENTS.md`（SA8 A6 登记的最小面） | `F-383-S2-1`：docs/AGENTS.md 验证门要求「代码行为变化时更新**每份**陈述该契约的规范文档」；typed-access.md（消费方必读）与 cordis-plugin-hosting.md 的无条件 `kept < total` / ✂ 陈述将被缝 2 失真，漏改即留下与已接受决策矛盾的陈旧文档（「search for stale terminology and contradicted decisions」视为缺陷） |
| 把 where 双语义内联进 `app-data-access-skill.md` 模板速查 | 该文档自身两级纪律把窗口截断语义划入深水区并明令禁复制（「复制一份即制造漂移面」）；内联即制造第二信源（§5.6 显式登记项） |

---

## 6. 复现和根因承接 / SA8 约束落实

### 6.1 复现和根因承接

| 上游事实 | 证据位置 | 设计响应 |
|---|---|---|
| 能力缺口稳定复现（3 轮 × runtime/lease 双面 × 双方法 + 规模两轮）；W1 同参成功且过滤正确 | SA6 §5 O1–O10、§13 | §5.1/§5.2 为唯一实现落点；§8 验收把 O 组转正为 T/X/K/D/Z/L/S 用例 |
| 双阻塞点：入口 fail-closed 分支 + S3 四键白名单（O8 隔离实验确证第二点独立） | `window-read.ts` L161–168、L229–232；SA6 O8/E3 | §5.1 删分支、§5.2 扩白名单——**两处必须同改**，单改任一不闭合 |
| 类型面已透传（Y1 探针 exit 0）；`WhereTerm` 未具名再导出（TS2694） | SA6 §6 N5、E7、Y5 | §5.3 零代码 + 锁边界测试（Y 组） |
| 耐久不变式（#382 条件不变式）缝 2 态继续绿 | `issue-382-lease-where-no-silent-pass.test.ts` L15–19 | §8 验收 M1：零改动零改红 |
| 全仓基线 typecheck/test 双绿 | SA6 §13 | §8 AC8 门 |

### 6.2 SA8 约束落实

| SA8 条 | 设计位置 | 处理方式 | 需设计后冲突复查 |
|---|---|---|---|
| A1 词表纪律 | §1.3 非目标、§5.2 W-9–W-11 镜像 | v1 词表外形态运行时收编 `WINDOW_OPTIONS_INVALID`（W1 权威）+ 编译期 fail-closed（Y2）；不扩词表 | 否（实现后由 F5/F6 复核承担） |
| A2 S3 镜像扩 where、判据与 W1 一致、两出口同步 | §5.2 全节 + 镜像判据表 | 判据逐条镜像 W-4–W-13；两出口复用零新码；S3 非第三权威（不产出 canonical 值） | 是（判据一致性与两出口可达性属 F2–F11 实现后核对） |
| A3 S6 双语义 + 单源纪律 | §5.1 | `total === undefined` 单源判据；canonical `n`；✂ 结构性永不装配；取代 `seamWhereNotImplemented`；零计数/零谓词求值 | 是（同上） |
| A4 类型面与公共导出 | §5.3 | 既有单源别名链 + Equal 锁不动；`WhereTerm` 不再导出（可选项明确不采，理由记录） | 否 |
| A5 测试先例与中间态清账 | §8 验收映射（SA6 P1–P6、M1–M7） | #369 家族 + runtime-data-interface.test-d + registry 内部缝先例；#382 条件不变式继续绿；不留缝 1 严格断言持久测试（HEAD 已无，M2 核查过） | 否 |
| A6 文档对齐 | §5.6 | A6 登记根 `AGENTS.md` 签名句补注（SA8 输入清单未含 skills/docs-integration 面，SA2 §13 点名）；本设计按 docs/AGENTS.md 验证门将范围扩至**全部陈述该契约的文档**（根 `AGENTS.md` + `typed-access.md` + `cordis-plugin-hosting.md` + `SKILL.md` 路由行，均入 ALLOW LIST），`app-data-access-skill.md` 显式登记不改并给理由——扩展与 A6 自身援引的「更新每份陈述该契约的规范文档」原则一致，属 A6 义务的完备化而非冲突 | 否（非阻塞；纯措辞补全，零行为发明） |
| F1–F11 冻结面 | §1.3、§5.1、§5.3、§5.5、§7 DENY LIST | 逐面保持（readData / 恒四键 / 十四键 / 失败码族 / where·orderBy 词表 / 无 where 零回归 / ✂ 文法 / W1 零 diff / released·透传纪律 / 失败形键集） | 是（SA8 §10 已列 `requiresConflictRecheck: true`，本设计 §13 承接） |

---

## 7. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/namespace-runtime/src/window-read.ts` | ① 删入口 fail-closed 分支与 `seamWhereNotImplemented`（L161–168、L432–446）；② `canonicalWindowBudget` 白名单四键 → 五键（键循环条件 L230 扩 `where`）+ `canonicalWhere` 镜像新增（哨兵 = 具名模块私有 `const WHERE_TERM_LIMIT = 16` + 出处注释）+ **ok 分支返回形状扩携带 `n: number`**（§5.1 装满判定的承载，`CanonicalWindowBudget` L208–210 预期改形）；③ S6 结算双语义 + ✂ 有 where 结构性不装配（L189–197）；④ `WindowComposeInput.total` 注释、模块头注（L1–41）缝 1 中间态叙述改写 | 唯一生产实现落点（SA6 §10；E-10 调用链封闭）；② 的返回形状扩展系 SA2 观察 1 收编点名 |
| `packages/namespace-runtime/src/runtime.ts` | **仅注释同步（可选）**：`readArray`/`readMap` doc 注释中「total 消费自 W1 单源」句补双语义措辞；行为零改动 | 注释非契约（M3 同款）；不强制 |
| `AGENTS.md` | 「Typed Namespace writes」节两处窗口读签名增补 `where?` + truncated/✂ 句补限定（§5.6） | SA8 A6 / docs AGENTS「代码行为变化时更新每份陈述该契约的规范文档」 |
| `.agents/skills/nomicore/typed-access.md` | 窗口读节（L135–181）：L151 v1 词表段补可选 `where`（谓词项形态、合取、词表外响亮拒绝）；L172「✂ window facts」段补 where 分支限定（匹配总数不承诺、`truncated` 装满判定、✂ 永不装配）；计数指引补「要计数给大 n」诚实降级（§5.6） | `F-383-S2-1` ①：根 `AGENTS.md` 指定的消费方必读文档，其无条件精确语义陈述被缝 2 失真 |
| `docs/integration/cordis-plugin-hosting.md` | 窗口读节（L390–424）：L396 options 注释补可选 `where` 一句；L409 truncated 注释补双语义限定；L412 ✂ 样张注释标注「where 缺席形态」（样张本身不动）（§5.6） | `F-383-S2-1` ①：Cordis 集成规范文档的同款失真陈述（L409/L412） |
| `.agents/skills/nomicore/SKILL.md` | L15 typed-access 路由行括注最小增补「optional `where` equality filter」短语（§5.6；gloss 不陈述截断语义，语义单源在 typed-access.md） | `F-383-S2-1` ③：技能入口（根 `AGENTS.md` 指定）的能力发现面覆盖缝 2 新能力——简报点名的 where 查询任务须路由到 typed-access.md |
| `packages/namespace-runtime/test/issue-383-window-where-composition-red.test.ts`（新建） | SA6 §12.3 用例组（A/T/X/K/D/Z/S/F/C 的 runtime 面本）+ N 组负控，沿 #369 组合家族风格（公共面行为断言 + 独立预言机 + 字节锚） | AC1–AC5/AC7/AC8（SA6 P1） |
| `packages/namespace-registry/test/issue-383-lease-where-contract-red.test.ts`（新建） | L 组 + T11/X8/L1 镜像对（lease 面；fixture 经共享 fixture 构造） | AC1/AC2/AC6（SA6 P2） |
| `packages/namespace-registry/test/issue-383-filtered-window-fixture.ts`（新建，非测试文件） | FIX-383-A（SA6 §12.3；推荐新建以保 #369 fixture 零漂移；若复用只许纯加法且 #369 家族零改红） | P1/P2 数据底座（SA6 P3） |
| `packages/namespace-runtime/test/issue-383-window-where-type-guard.test-d.ts`（新建，或零改红扩展 `runtime-data-interface.test-d.ts`） | Y1/Y2/Y3/Y6（runtime 面 + 跨面；Y3 三项注册为运行时用例不得写成编译期负例） | AC6/AC8 类型锁边界（SA6 P4） |
| `packages/namespace-registry/test/issue-383-lease-where-type-guard.test-d.ts`（新建） | Y1/Y4/Y5（lease 面 + 别名 Equal 锁） | AC6（SA6 P5） |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/doc-runtime/src/**`（含 `window.ts`、`read.ts`、`index.ts`） | W1 已交付 where/total/判据；缝 2 预期零改动 | F9 冻结面（`read.ts` 零 diff 纪律沿袭）；若实现确需动 W1 → 先回 SA8 门禁复核（M4），不得就地扩权限 |
| `packages/namespace-registry/src/lease.ts`、`src/types.ts`、`src/index.ts` | 透传与类型面 | F10/S6：raw 直传 + 单源别名 + Equal 锁已承载 where；零改动（§5.3 决策不复再导出） |
| `packages/namespace-runtime/src/index.ts` | 公共导出面 | 零值导出/类型导出变化（§5.3；值导出面维持恰 `RuntimeWriteFatalError` 一键冻结） |
| `CONTEXT.md`、`docs/adr/**` | 词汇表与决策记录 | R14：词条已落定、缝 3 已闭合；0029 已 accepted 无修订（ADR 只经 append/supersede 演进） |
| `docs/integration/app-data-access-skill.md` | 速查调用形态缩写引用（L36–37/L129，`readArray(path, { n, orderBy })` 形态） | §5.6 **显式登记不改**（`F-383-S2-1` ③ 裁决）：调用形态缝 2 后仍为合法公共 API 形态、全文件零失真陈述（E-11）；该文档两级纪律把窗口截断语义划入深水区并禁复制（内联即第二信源）；上游单源 typed-access.md 已在本票修正，其深水区指针自动继承 |
| 既有测试/fixture：`issue-369-window-read-*-*.test.ts`/`.test-d.ts`/`-fixture.ts`、`issue-382-*.test.ts`、`runtime-data-interface.test-d.ts`、`registry-data-interface.test-d.ts`、`helpers/readdata-ok-shape.ts` | 回归面与先例 | M1/M7：零改动零改红（若 P4 选择扩展 runtime-data-interface.test-d.ts，只许纯加法且既有断言零变化） |
| 公共面守卫测试（`runtime-acceptance-exports-audit.test.ts`、`registry-surface.test.ts`、`doc-runtime/public-surface-guard.test.ts`） | 导出面审计 | M6：零键集变化 ⟹ 零改动；仅当实现改采具名再导出（本设计不采）才需同 PR 记账 |
| `vitest.config.ts`、`tsconfig*.json`、`package.json`（各包） | 采集与构建 | 新测试按 `issue-383-*.test.ts` / `.test-d.ts` 命名即自动采集（SA6 §14 实证）；零配置改动 |
| `packages/namespace-runtime/src/` 与 `packages/namespace-registry/src/` 其余源文件 | 无关面 | E-10 调用链封闭：无其它生产触点 |

---

## 8. 验收与验证映射

SA6 §12 已把 AC1–AC8 契约化为可执行用例组（fixture FIX-383-A + A/T/X/K/D/Z/L/Y/C/F/S 组）；本设计逐 AC 关联，实现票按 SA6 §12.5 P1–P6 落地。**期望一律由独立预言机派生**（Yjs/native 直数、同运行公共面 oracle、字节锚常量），禁止与实际同源（SA6 §12.7）；禁止 skip/only/todo/env override/fallback/吞错/源码字符串断言。

| AC / 风险 | 现有证据 | 所需行为测试或动态场景（SA6 组） | 预期观察 |
|---|---|---|---|
| AC1 无 where 零回归 | HEAD 全绿（N1/N2、#369 家族 129 用例） | A1–A6（含 ✂ 字节锚 `✂ 截断事实：\n- <path> · 窗口 · 基 <basis> <dir> · kept n/total N`；A5 lease↔runtime `toStrictEqual`） | 实现后仍绿；total = 标识计数、truncated = kept < total、✂ 逐字节 |
| AC2 双语义 + ✂ 永不装配 | HEAD 红（O2–O5/O8–O10） | T1–T14（装满/扫完/恰 n 边界：T2/T4/T6/T9；present-undefined T10；管线序 T12；脏数据安静不匹配 T13）；X1–X8（schema 字节相等、无 ✂、X5 off-schema → null、X6 无 where ✂ 字节锚对照） | HEAD 红 → 绿：`truncated === (value.length === n)`；where 在场 schema 无 `✂ 截断事实：` 且与对照字节相等 |
| AC3 恒四键 + 身份随行 | HEAD 红 | K1–K5（own 键集恰四键、`'total' in result === false`、K4 index 不重编号、K5 匹配集总序） | 恒四键；`[...path, entry.index\|entry.key]` 深读 ≡ `entry.value` |
| AC4 depth 等价锚 | HEAD 红 | D1–D5（同预算 `readData(项路径)` oracle；D4 depth:0/maxChildrenPerNode:0；D5 未匹配项埋毒 → 零重物化） | 逐条目 `toStrictEqual`；毒埋项不得引发 `PATH_NOT_ALLOWED` |
| AC5 S3 两出口 + 敌意零外抛 | Z1/Z2 红；Z3–Z8 伪绿（守卫） | Z1/Z2（descriptor 诚实 throwing get trap → `ok:true`、getCalls===0）；Z3–Z6（accessor/未知键/非 plain/词表外 → `WINDOW_OPTIONS_INVALID` 零外抛）；Z7/Z8（状态化视图两出口）；Z9–Z11（16 项/同 field 重复/falsy 闭集） | 合法视图成功；非法视图响亮；两出口对 where 同样可达 |
| AC6 透传 + 类型 fail-closed | Y 组 HEAD 绿；L1 红 | L1–L6（L1 lease↔runtime `toStrictEqual`；L2 released 短路零 options 触达；L3 lease 零解释；L4 十五/十四键；L5 readData 冻结 `READ_OPTIONS_INVALID`；L6 值导出面零新增）；Y1–Y6（Y2 十四负例真命中；Y3 不得写成编译期负例；Y4 成功成员 `keyof` 恰四键；Y5 TS2694 事实） | lease 同参镜像；编译期边界锁定 |
| AC7 停接纳不豁免 | HEAD 绿（O11/O12） | C1–C5（closing/closed、trapCounting options 触达 === 0、released、无 where 负控） | `RUNTIME_READ_DISABLED` 四键失败形保持 |
| 失败码冻结面 | F3/F5–F7 绿 | F1/F2/F4（合法 where 下目标缺席/载体不符/命中项物化失败 → 对应码透传，不得 options 面先拒）+ F5–F7 | 三码 + `PATH_NOT_ALLOWED` 互异、各就各位、own 键集 `{code,ok,path,message}` |
| 单源纪律 | S1–S3 红 | S1（视图②隐藏 where → 仍按 W1 过滤结算，`truncated === true`）；S2（恰 n 匹配不得 false）；S3（毒埋零重物化） | 「重读 options 判定」/「计数后比较」/「重物化」变异必红 |
| AC8 全仓门 | 基线双绿（E-9） | `pnpm typecheck` + `pnpm test`（`NODE_OPTIONS=--conditions=nomicore-source`；新文件自动采集） | exit 0；既有文件零改红 |
| 文档对齐（A6 + `F-383-S2-1` ④） | 四份目标文档现状：根 `AGENTS.md` / `typed-access.md` / `cordis-plugin-hosting.md` 均无 `where` 且无条件 `kept < total` 陈述；`SKILL.md` L15 gloss 无 where（E-11 清单） | 无行为测试义务（M5——文档非运行时面，不进 vitest）；`git diff` 审计对象扩列为：根 `AGENTS.md`、`.agents/skills/nomicore/typed-access.md`、`docs/integration/cordis-plugin-hosting.md`、`.agents/skills/nomicore/SKILL.md`；另核 `docs/integration/app-data-access-skill.md` diff 为空 | 实现后全仓 `grep -rn "kept < total" --include="*.md"`（排除 `wiki/`、`docs/adr/`、`CONTEXT.md`）文档面仅剩带 where 限定的陈述；四文档补注与 CONTEXT.md「过滤窗口」词条 / ADR 0029 §5 措辞逐点一致（零行为发明）；`SKILL.md` gloss 含 where 能力提及且不含截断语义 |

> 注（SA2 观察 3 收编，非新用例）：W1 视图与 S3 视图**各自合法但值漂移**（如 `n`：W1 视图 3、S3 视图 5）时，装满判定取 S3 canonical `n`，敌意调用方可得 false-negative `truncated`——与既有 `canonical.term`（✂ 基槽）/`canonical.budget`（锚链预算）的暴露类同族（#369 已接受：两出口纪律只覆盖**判据违例**，不覆盖双合法值漂移；组合层无 W1 视图 `n` 可比对，结构上无更优解）。属既有已接受暴露类、非本票新风险；实现票可在 Z 组测试文件以头注/说明形式文档化一条，不必新增用例、不开新出口。

---

## 9. 数据流路线

改动只落在组合层结算与净化两段；读路径整体（调用方 → lease → runtime → W1 → 组合 → 返回）结构与各跳数据形态不变，故逐跳列出并标注缝 2 触点：

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| 跳 1：调用方 → lease | 调用方 `lease.readArray/readMap(path, options)`（options 含可选 `where`，raw 引用） | 无 | released 判定（`NAMESPACE_LEASE_RELEASED` 三键短路，零 options 触达）；active 期 raw 引用直传（零解释/零校验/零复制） | 进程内同步调用 | — | 透传即代理 | released 短路先于透传（F10） | L2/L3/C4 |
| 跳 2：lease → runtime | `entry.runtime.readArray/readMap(path, options)` | 无 | S1 lifecycle gate（`closing`/`closed` → `readDisabled` 四键，零 options 读取、零 doc 触碰） | 同步调用 | — | 停接纳稳定码 | lifecycle 失败不借路径码（ADR 0008 L123） | C1–C3/C5 |
| 跳 3：runtime → W1（doc-runtime） | `readArrayWindowAtPath/readMapWindowAtPath(doc, path, options)` | 无 | G0 path 形态 → OPT 五键封闭校验（含 `where` W-1–W-13，descriptor 纪律、零 `[[Get]]`；非法 → `WINDOW_OPTIONS_INVALID` 零 doc 触碰）→ N0/N1 导航（缺席 → `WINDOW_TARGET_ABSENT`；载体不符 → `WINDOW_CARRIER_MISMATCH`）→ E+W 枚举循环内 where 过滤（未匹配零物化、安静不匹配）→ S 总序 → M 入选项物化（fail-fast `PATH_NOT_ALLOWED`） | live Y.Doc 只读观察（调用瞬间已提交状态；零 sequencer、零订阅） | W1 结算恰三键 `{ok:true, value, total}`（无 where = 标识计数 / 有 where = `undefined`，B-8 单源） | 过滤条目列表 + total 双形态 | W1 失败成员原样上透（无半窗） | SA6 §5 O1（W1 oracle）、F1/F2/F4、T12/T13 |
| 跳 4：runtime 组合（**缝 2 落点**） | `composeArrayWindowRead/composeMapWindowRead(state, doc, path, options, entries, total)` | 无 | ~~入口 fail-closed~~（**删除**）→ S3 `canonicalWindowBudget` 五键重读 + `canonicalWhere` 判据镜像（descriptor 纪律；不稳定 → 出口①重派发 / 出口②接缝终态）→ S5 `normalizeReadPath` 单次快照 + 锚链投影（只消费 canonical.budget 与 schema）→ S6 双语义结算 + ✂ 条件装配（`total === undefined` ⟹ 永不装配） | 全同步、模块级零可变态/零缓存 | 成功恒四键 `{ok, value, schema, truncated}` | 过滤窗口四键面（`truncated` 装满判定） | 两出口响亮 `WINDOW_OPTIONS_INVALID`；零外抛 | T/X/K/D/Z/S 组 |
| 跳 5：runtime → lease → 调用方 | 结果联合原样返回 | 无 | 零包装 | 同步返回 | 调用方消费四键/失败形 | 「找到所有 claimed task」+ 截断信号可读 | — | L1/T11/X8 |

缓存/最终一致性：全链零缓存、零派生状态、零异步——每次读独立观察 live doc 调用瞬间状态；无清理责任。无运行时数据创建/持久化变化（纯读路径）。文档对齐（§5.6）不触碰任何运行时数据路径——四份文档均为纯文本措辞补注/能力提及，对上表五跳零影响。

---

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| `packages/namespace-registry/src/lease.ts`（`readArray`/`readMap` 生产唯一调用方） | released 短路 → raw 引用直传；where 输入当前在 runtime 组合层被拒 | 同通道原样承载 where（透传语义不变，成功面从响亮失败变为过滤四键） | **零** | E-6/E-10；lease.ts L309–316 |
| `packages/namespace-runtime/src/runtime.ts`（`composeArrayWindowRead/composeMapWindowRead` 唯一消费方） | S1/S2 编排 + 组合调用（`total` 直通实参已为 `number \| undefined`） | 签名零变化；仅可选注释同步 | 零行为改动（可选注释） | runtime.ts L683–704 |
| 既有测试家族（#369 组合/lease/类型 ×4、#382 lease 不变式 + W1 契约 ×2） | 全绿（129 用例） | 无 where 期望与 W1 期望均不因缝 2 变化；#382 条件不变式由成功分支承载继续绿 | **零改动、零改红** | M1/M7；E-8 |
| 简报点名的调用方（lease 面 `state == 'claimed'` 查询） | 无法完成（O2/O3 响亮失败） | `lease.readMap(path, { n, orderBy?, where: [{ field: 'state', equals: 'claimed' }] })` 直接可用；截断信号 = `truncated` 布尔（装满判定；✂ 永不装配、无计数渠道——要计数给大 n） | 零适配（结构化 options 即可；具名 `WhereTerm` 需要时 type-only 直依 `@nomicore/doc-runtime`） | AC 正文；§5.3 |
| doc-runtime 消费方（W1 直调者） | W1 面冻结 | 零影响（F9 零 diff） | 零 | M4 |
| 公共面守卫测试（导出审计） | 键集断言在场 | 三包值导出键集不变；type-only 窗口导出面维持 #369 形态 | 零（M6 零变化路径） | L4/L6/Y4 |
| 消费方指导文档的读者（`typed-access.md` / `cordis-plugin-hosting.md` 的集成方与 agent——简报点名调用方的文档来源） | 文档无条件陈述 `truncated === kept < total` + ✂ 装配规则——缝 2 后对 where 读失真，读者会把装满判定 `false`（扫完了）误读为「未截断无信号」 | 文档补 where 限定（匹配总数不承诺 + 装满判定 + ✂ 永不装配）；`SKILL.md` 路由 gloss 补能力提及；`app-data-access-skill.md` 经深水区指针自动继承上游修正 | 文档措辞补全（§5.6 / ALLOW LIST 三路径；零代码零测试） | `F-383-S2-1`；E-11 |

无未覆盖调用方：E-10 全仓 grep 确认生产触点封闭（其余均为测试文件，属 ALLOW LIST 新增/ DENY LIST 保持项）。

---

## 11. 错误、恢复、并发和幂等

- **失败语义**（全部既有，零新增/零漂移）：窗口失败 own 键集恰 `{code, ok, path, message}`；停接纳 `{ok, code, path, message}`；released `{ok, code, message}`；成功恒四键。`where` 形状非法（W1 判定）→ `WINDOW_OPTIONS_INVALID`；S3 视图不稳定 → 出口①（W1 失败成员透传，通常 `WINDOW_OPTIONS_INVALID`）/ 出口②（接缝终态同码、message 区分）。
- **零外抛**：S3 镜像全程 descriptor 读 + try 收编（trap 异常 → 不稳定 → 两出口）；raw path 仅经 `normalizeReadPath` 单次快照消费；`windowFactsBlock` 只消费已验证快照——结构上零外抛通道保持。
- **并发/幂等**：纯同步读、零 sequencer、零订阅、零可变态、零缓存——每次调用独立幂等；无重试/回滚面（失败即同步结果，调用方可安全重试——读观察调用瞬间已提交状态）。
- **资源所有权**：无新增资源；组合层维持纯函数姿态（ADR 0029 §8 收缩形态保持）。

---

## 12. 风险、回滚和残余问题

| 风险/事项 | 等级 | 缓解 / 处置 |
|---|---|---|
| S3 镜像判据与 W1 漂移（含哨兵 16 具名常量镜像） | 中 | 出处注释 + 镜像判据表（§5.2）逐条锚 W1 行号；Z9（16 合法/17 非法）/Z11（falsy 闭集）/Z3–Z6 变异守卫；SA6 §12.6 S4 结构审计 |
| S1 交替视图语义被实现改判（视图②隐藏 where 判为不稳定） | 中 | 设计钉死「结构合法即通过」（§5.2）；S1 用例守卫；改判须回门禁 + 同步期望（SA6 §15-O4，不得静默） |
| ✂ 装配分支漏改（有 where 仍装配 / 无 where 漂移） | 中 | §5.1 结构性排除（`appendWindowFacts` 仅存于 `total !== undefined` 分支）；X1–X3/X6 字节锚双向守卫 |
| `truncated` 实现回落计数比较或 `kept < undefined` | 中 | T2/T4/S1/S2 专项击穿；§12.6 S3 结构审计（无 `total ?? 0`/`as number`） |
| **上游事实登记（非阻塞）**：SA6 §12.3.9 F1/F2/F4 标注「HEAD 红（HEAD 得 WINDOW_OPTIONS_INVALID）」，与源码直读不一致——合法 where 下目标缺席/载体不符/物化失败时 W1 在 OPT 之后以 `WINDOW_TARGET_ABSENT`/`WINDOW_CARRIER_MISMATCH`/`PATH_NOT_ALLOWED` 失败，runtime `if (!windowResult.ok) return windowResult;` 原样透传（runtime.ts L688–692/L700–703；windowCore OPT→N0→N1 定序 window.ts L213–229；absentNav L612–613；载体码 L645/L654），该失败**不经过**组合层入口分支，HEAD 应已呈对应码（即 F1/F2/F4 或为预绿守卫而非红证据；SA6 §5/§13 探针表未含此三向实测） | 低（设计无关） | 目标契约两侧一致（失败透传、不得 options 面吸收），设计不依赖其 HEAD 颜色；实现票落地 P1 时先实测三向 HEAD 颜色——若已绿则按回归守卫登记，若确红以实测为准并回填 SA6；不影响任何设计决策 |
| 实现期擅扩词表/借道再导出 | 低 | §1.3 非目标 + DENY LIST + L6/Y5 边界断言；词表演进只走 ADR 备案位 |
| 文档对齐遗漏或补注发明行为（漏改某份陈述契约的文档 / 措辞超出词条与 ADR §5） | 中 | E-11 全仓清单 + §7 ALLOW 三文档路径 + §8 验收 grep 门（`kept < total` 文档面仅剩限定陈述）+ §5.6 措辞权威钉死（CONTEXT.md 词条 / ADR 0029 §5，零行为发明）；`app-data-access-skill.md` 显式登记不改（§7 DENY） |
| 双合法视图值漂移的截断信号（W1/S3 视图各自合法但 `n` 不同 → 装满判定取 S3 canonical `n`，敌意调用方可得 false-negative `truncated`） | 低（既有已接受类） | 与 #369 已接受的 `canonical.term`（✂ 基槽）/`canonical.budget`（锚链预算）暴露类同族：两出口只覆盖判据违例，组合层无 W1 视图 `n` 可比对，结构上无更优解；§8 注收编（Z 组头注文档化，无新用例、无新出口） |
| 回滚 | — | 单文件生产改动（window-read.ts）+ 新增测试：`git revert` 生产提交即回到缝 1 中间态（该态自持响亮失败，无数据/协议迁移面）；无持久化/wire/状态机变化 |
| Follow-up（明确非本票义务） | — | ① `WhereTerm` 具名再导出（若未来调用方压力成立：走各包 `src/index.ts` + 守卫同 PR 记账）；② 词表演进位（in/范围/OR/NOT/多段 field/深相等/count/keyset 翻页）一律 ADR 备案位，本票不开口 |

---

## 13. 是否需要设计后 ADR 冲突复查及理由

**需要（`requiresConflictRecheck: true`）**，与 SA8 §10 一致：

1. 本票把 `where` 落到 runtime/lease **公共类型面**（options 词表加法经单源别名链）与**失败语义**（S3 镜像判据、两出口对 where 可达、`WINDOW_OPTIONS_INVALID` 收编、truncated 双语义与 ✂ 永不装配）——SA8 F2–F11 冻结面逐项标注「实现后核对」；
2. 取代缝 1 中间态分支属 R16 登记的取代义务，落地后须复核无残留（`seamWhereNotImplemented` 清账、无 strict 缝 1 断言留存）；
3. §12 登记的 F1/F2/F4 HEAD 颜色事项需实现期实测回填。

无 ADR/CONTEXT 修订需求（SA8 §6：evolution-required ×0；0029 已 accepted，缝 3 已闭合）。本版新增的文档对齐范围扩展（§5.6）不改变复查结论：四文档补注是对已接受决策（ADR 0029 §5）的措辞对齐，非决策修订，不新增复查事由；实现后复查时文档面以 §8 验收 grep 门为核对项之一。

---

## 14. 评审修订映射

评审输入：`wiki/raw/task_issue-383_sa2_review.md`（SA2 iteration 0，verdict `reject`——阻断项恰 1 条 MAJOR `F-383-S2-1`，无 BLOCKER；非阻塞观察 5 条）。核心实现设计（§5.1–§5.5 运行时/registry 架构）经 SA2 源码级核验**全部成立，本版零变更**（「纯范围补全，不触及任何设计决策」）；逐条映射：

| Finding / 观察 | 修订位置 | 处理结果 |
|---|---|---|
| **F-383-S2-1** ① D6 范围扩至 `typed-access.md` 与 `cordis-plugin-hosting.md`（窗口读节补可选 `where` + `truncated` 双语义限定 + 有 where ✂ 永不装配；措辞以 CONTEXT.md「过滤窗口」词条与 ADR 0029 §5 为权威，零行为发明） | §5.6 逐文档表前两行；§5.7 新增两条备选否决 | **已落实**：D6 整节重写——范围依据（docs/AGENTS.md 验证门）、措辞权威、四文档清单、显式登记不改项、零改动面；运行时架构零触碰 |
| **F-383-S2-1** ② ALLOW LIST 增补两路径（预期改动 = 窗口读节措辞补注） | §7 ALLOW LIST 新增 `typed-access.md`、`cordis-plugin-hosting.md` 两行 | **已落实**：与 §5.6 一一对应；AGENTS.md 原行保留 |
| **F-383-S2-1** ③ `SKILL.md` L15 与 `app-data-access-skill.md` L36–37/L129 缩写引用：补注或显式登记不做并给理由 | §5.6（SKILL.md 行 + 「显式登记不改」段三点理由）；§7（SKILL.md 入 ALLOW / app-data-access-skill.md 入 DENY）；§5.7 备选否决行 | **已裁决并落实（拆分处置）**：`SKILL.md` L15 = 技能入口（根 `AGENTS.md` 指定「use the nomicore skill」）的能力发现面，做**短语级最小补注**（`optional where equality filter`；gloss 不陈述截断语义，语义单源 typed-access.md——link-not-copy）；`app-data-access-skill.md` = 调用形态缝 2 后仍合法（全文件零失真陈述，E-11）、其自身两级纪律把窗口截断语义划入深水区并禁复制（内联即第二信源）——**显式登记不做**，DENY 防实现票顺手扩写 |
| **F-383-S2-1** ④ §8「文档（A6）」行 `git diff` 审计对象同步扩列 | §8 文档对齐行 | **已落实**：审计对象 = 四文档 diff + `app-data-access-skill.md` 零 diff 核对；预期观察加全仓 grep 门（`kept < total` 文档面仅剩限定陈述） |
| 观察 1（`CanonicalWindowBudget` ok 分支不携 `n`，返回形状扩展未在 ALLOW ② 点名） | §5.1 新增「canonical `n` 的承载改形」不变量；§7 ALLOW ①② 措辞点名 | **已收编**：`{ ok: true, budget, term, n: number }` 明示为预期改动（SA6 §12.6 S3 即结构审计锚），防 SA4 误判越权改形 |
| 观察 2（§5.2「L221–254 不动」措辞不精确——白名单条件 L230 在区间内且必将改写） | §5.2 末条 | **已修正**：改为「宿主判据与轴值判据本身不动；区间内仅两处预期改写（L230 白名单四键→五键、返回形状携 `n`）」 |
| 观察 3（SC-8 双合法视图值漂移：装满判定取 S3 canonical `n`，建议文档化、不必新增用例） | §8 表后注 + §12 新增风险行 | **已收编**：登记为 #369 已接受暴露类（`canonical.term`/`canonical.budget` 同族），Z 组头注文档化一条即可，无新用例、无新出口 |
| 观察 4（F1/F2/F4 HEAD 颜色：SA2 独立源码复核**支持**设计 §12 判断——W1 失败透传先于组合层，HEAD 应已呈对应码；设计处置正确、无需进一步修订） | §12 上游事实登记行（原文保留） | **维持**：既定处置（两侧目标契约一致 + 不依赖 HEAD 颜色 + 实现期实测回填 SA6）获评审确认，零改动 |
| 观察 5（哨兵镜像形态建议具名模块私有常量 + 出处注释，弃散落字面量） | §5.2 镜像表行 + 「哨兵 16 的镜像形态」条目；§7 ALLOW ②；§12 风险行措辞 | **已收编**：`const WHERE_TERM_LIMIT = 16`（模块私有、不导出——导出违 F9）+ 出处注释，与 doc-runtime 形态对称、Z9/结构审计单点定位 |
