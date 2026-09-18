# SA8 冲突门禁报告 — Issue #406 SA1 实施架构设计（设计后复审）

- 派发：`sa-d5f39a02-d3e4-4a49-ae49-532f3c7da16d`（role `mabf-sa8`，phase `conflict-gate`，iteration 0）
- Worktree：`/home/wangjian/nomicore-fix-issue-406`（branch `mabf/issue-406`，HEAD `56cf5428…` = `fix(#405)`，与 SA6 契约基线一致——本次 `git rev-parse` 复核在案）
- 被审对象 = **SA1 设计本体** `wiki/raw/task_issue-406_design.md`（426 行，派发 `sa-7feb911c…`，iteration 0）。SA6 契约 `task_issue-406_sa6_contract.md`（rev1，verdict approve）在案为验收权威。
- **SA2 review 追加在场**：`task_issue-406_sa2_review.md`（派发 `sa-0001336d…`，iteration 0，verdict **approve**，无 BLOCKER/MAJOR、4 条非阻断观察 O-1–O-4）在本复审进行中落盘（设计 §14 与本次首次 `ls` 复核时确实不存在；收尾前 `git status` 发现新文件后补读并入本报告——其 §5/§7 事实链与本次独立实读一致，O-2 已折入 §3 行 19 与 RA-406-5，O-1 计数笔误核验见 §2 末注）。
- 本票 SA8 前置门禁产物缺席（无 `task_issue-406_relevant_decisions.md` / `_conflict_report.md`，glob 复核确认）。处置：本次复审**直接实读决策全集**自建冲突基准（见 §2），设计的对齐义务链（§6）逐条复核——前置缺位不阻塞设计复审，但落实为 §10 复查标志的理由之一。

## 1. Reviewed subject

**design** —— `wiki/raw/task_issue-406_design.md`。复审重点（按任务与设计自报面）：

1. **窗口面公共 API 扩张**：两面 options 闭合形状五→六键（DD-2）+ 两结果联合追加共享预算成员 `READ_BUDGET_EXCEEDED`（DD-8）。
2. **拆分读/中继/接缝语义**：`splitWindowOptions` raw 第一读者 + W1 单一权威保持（DD-3）、canonical 六键镜像与闸门权威（DD-5）、重派发闭包（DD-9）、G0 前置分支（DD-4）。
3. **度量与失败分支**：S6.5 预算闸（塑形后两通道度量，DD-6）、三面同码同文同载荷（DD-7 共享模板单源 `read-budget.ts` + `readData` 构造点迁移）。
4. **父票 SA8 义务兑现方式**：OBL-WIN-1/RA-I1（窗口面三面义务 + message 逐字镜像）、RA-1（域钉死）、RA-3→OBL-DOC-406-1（文档挂账）。
5. **ALLOW/DENY 清单与冻结面**（§11）：doc-runtime/vfsl/渲染器/registry src/index.ts/CONTEXT/ADR 零 diff 的授权依据。

本报告不评价设计优劣、断言充分性或实现可行性（SA2/下游维度）。

## 2. Inputs and decision set

- 输入：`wiki/raw/task_issue-406.md`（简报；`## Comments` 段空）、`wiki/raw/task_issue-406_design.md`（被审对象）、`wiki/raw/task_issue-406_sa6_contract.md`（rev1，验收权威——wiki/raw 属证据非规范契约，但其 pins 编码 ADR 派生义务，设计对齐性纳入核对）、`wiki/raw/task_issue-406_sa2_review.md`（approve；评审输入）、父票 SA8 产物 `task_issue-405_design_conflict_report.md`（iteration 2，clear，RA-D1–D5）与 `task_issue-405_implementation_conflict_report.md`（iteration 3，clear，RA-I1–I4——OBL-WIN-1=RA-I1 挂账链头）。
- 决策集（本次全部实读）：`docs/adr/**` 全集 31 篇全部「已接受」，无整篇 superseded；**修订链在状态行在案**——ADR 0024（决策 1 经 0031 再修订 +maxBytes、终态 no-op 例外注记、开放问题「字节级预算」收口）、ADR 0027（决策 1 options 句经 0031 再修订三键；头行/✂/渲染器条款不动）；ADR 0031 为本票母法（决策 1–6 + 对既有 ADR 的修订 + 验收 + 开放问题）。ADR 0028/0029 未带状态行回注，但 ADR 0031 决策 1 明文立法「`readData` / `readArray` / `readMap` 三读面 options 追加 `maxBytes`」——后法显式覆盖先法 options 形状，与 0029 之于 0028 的词表演进同一仓内惯例（CONTEXT.md 为词汇同步点），不构成静默矛盾。
- 词汇与收录纪律：`CONTEXT.md`「字节预算」（L54，**已声明三读面**）、「形状预算」、「窗口读」（L66–67）、「过滤窗口」（L70–71）、「投影文本」、「截断省略」、「截断事实段」词条；`docs/AGENTS.md` Editing 规则（本次系统注入文本与文件一致）；`packages/{namespace-runtime,namespace-registry,doc-runtime}/AGENTS.md`。
- Owner 评论：**无**（简报 `## Comments` 段空 + REST Issue-comment 快照 `[]`（派发说明）+ SA6 契约 §2 三方一致）——无 override 来源，无评论来源附加义务。
- 事实核验（源码实读，用于锚定设计 §2 B1–B12 与冻结面判断，非冲突基准）：
  - B1 ✓ `doc-runtime/src/window.ts`（`validateWindowOptions`）：白名单恰五键、未知键「`window options 含未知键（封闭形状）：<key>`」、accessor「`window options.<key> 不得为 accessor（零 accessor 执行纪律）`」、探测期「`window options 探测期异常（敌意对象）——已收编为 WINDOW_OPTIONS_INVALID`」、n 域「`window options.n 必须是 ≥1 的有限整数…`」——DD-7 三条窗口面 message 确为 W1 无码前缀措辞族（同族句式实测在案）。
  - B5 ✓ `window-read.ts` S6 结算：`truncated = total === undefined ? kept === canonical.n : kept < total`；✂ 窗口事实块仅在无 where ∧ 截断 ∧ 正文非 null 时装配。
  - B6 ✓ `window-read.ts`：两面 options = doc-runtime 纯别名；结果联合 = 成功四键 | `WindowReadFailure` | `RuntimeReadDisabledResult`（无预算成员）；`canonicalWindowBudget` 白名单恰五键。
  - B3 ✓ `runtime.ts` `readArray`/`readMap` 编排 = S1 lifecycle gate → W1 raw 直通 → compose（S3/S5/S6）。
  - B7/B8 ✓ `runtime.ts` readData 面 `#405` 实现在案：S2b-0 G0 前置分支（含 fail-loud 不变式守卫）、`splitReadDataOptions`、`canonicalReadOptions`（`maxBytes` 复读为闸门权威）、S2b-5 预算闸（`deliveryBytes(value, schemaText)`）、超限文案模板逐字 = `READ_BUDGET_EXCEEDED: 读交付总量 N 字节超出 maxBytes M——零交付拒绝（不裁剪、不降深度；ADR 0031）`；**其 JSDoc 明记「窗口面票（OBL-WIN-1）须逐字镜像本文案」**——镜像义务在源码注释在案。`src/read-budget.ts` 尚不存在（设计将新建）。
  - B9 ✓ `lease.ts`：released 冻结三键短路先于透传、active 期 raw 引用直传；`types.ts` 两 options/两结果均为 runtime 单源别名。
  - B10 ✓ `issue-369-window-read-composition-red.test.ts`：状态化 trap `descriptorCalls() === 4`、交替 trap `=== 5` 计数锚在案（设计 R-1 parity 义务的对象实测存在）。
  - B11 ✓ `git status`：M ×2（两既有 `.test-d.ts` 原位 `Omit` 中继锁延伸）+ ?? ×5 新契约文件 + ?? wiki/raw ×3——与 SA6 §12.2 清单逐条一致，生产 `src/**` 零 diff。
  - B12 ✓ `tsconfig.base.json` L10 `exactOptionalPropertyTypes: true`。
  - 文档义务对象 ✓ `.agents/skills/nomicore/typed-access.md` 窗口读小节（~L148–L205）实测：**未误述**（「closed」表述限定在 `orderBy`/`where` 词表；无「窗口 options 不含 maxBytes」句）——OBL-DOC-406-1 的「清退对象 = 无、仅补词汇」定性属实；「Element-scope projection text」段明记窗口 schema 为「ADR 0027 form **without a readData head line**」——设计「窗口 schema 无头行、头行计字条款空转」的事实主张属实。
  - 公共面 ✓ `index.ts` 四个窗口类型名已导出（L86–89）；`ReadDataBudgetExceededResult` 无 index.ts 按名导出、registry 零按名消费（grep 实测）——DD-1 迁移 `read-budget.ts` 并自 `runtime.ts` 回导出可保模块面名字不变；值导出审计只钉值键集 `['RuntimeWriteFatalError']`。
  - CONTEXT.md L54 ✓ 实测：「`readData`/`readArray`/`readMap` options 可选的交付总量上限……跨三读面同码同文（ADR 0031）」——词汇已覆盖三读面，零 diff 主张成立。
  - 根 `AGENTS.md` 实测（SA2 O-2 并读复核）：「Instance replication」前的 Nomicore 集成段以签名形态枚举窗口 options `{ n, orderBy, where?, depth?, maxChildrenPerNode? }`——实现落地后该枚举将 stale-by-omission 少 `maxBytes`；处置见 §3 行 19 与 RA-406-5。
  - SA2 O-1 核验 ✓：设计 §11 ALLOW「runtime/test/issue-406-*（5 文件）」实测 runtime 包 4 文件（fixture/red/control/test-d）+ registry 包 3 文件；与 B11「5 新文件」（跨两包测试文件口径）混用——笔误级，glob 语义与决策面零影响。
- 冲突基准：**ADR 0031（母法）+ ADR 0028/0029（窗口读决策族，经 0031 显式立法演进）+ ADR 0027/0024（修订链后）+ ADR 0008 + ADR 0023 + CONTEXT.md 词条族 + 模块/文档 AGENTS 收录纪律 + 父票 SA8 裁决（RA-1/RA-3/RA-D5→RA-I1）**。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（SA1 设计） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0031 决策 1（三读面 options 域句） | 「`readData`/`readArray`/`readMap` 的 options 闭合形状追加 `maxBytes?: number`：≥1 的有限整数（≤ 2^53−1）；`0`、负数、非整数、非有限数、未知键 → 各面既有 options 校验码响亮拒绝（窗口面 `WINDOW_OPTIONS_INVALID`）……缺席 ≡ 不设预算……不内建任何魔法默认」 | DD-2 runtime 自持六键闭合 interface（`maxBytes?: number`）；DD-3/DD-5 split 与 canonical 双处同判据 `Number.isSafeInteger(v) && v >= 1`；`2^53`/`2^53+2`/`1e21` 拒、`2^53−1` 域顶收（G5 C-LIMIT 组级判据）；present-undefined ≡ 缺席（D1，沿 W1 顶层已知轴豁免同款——window.ts 实测「键在场、值 undefined ≡ 缺席」）；非 enumerable ≡ 缺席（C4）；域违收敛 `WINDOW_OPTIONS_INVALID` | **implements-existing-decision** | ADR 0031 L16–17；设计 §7 DD-2/DD-3/DD-5、§12 G5 | 实现后核对（RA-406-3） |
| 2 | ADR 0031 决策 1（不新增校验码）× W1 单一权威 × 接缝豁免先例 | 「不新增校验码」；决策 4 校验住组合层 | DD-7：`maxBytes` 域/accessor/探测期违约由 runtime 构造 `WINDOW_OPTIONS_INVALID` 恰四键成员（`windowBudgetAxisInvalid`），W1 保持五键/未知键/宿主 message 单源（split 消费 `maxBytes` 不进 relay，`{n:1,maxBytes:1,nope:1}` 仍以「未知键：nope」被 W1 拒）；豁免登记沿父票 `budgetAxisInvalid`/`seamReadOptionsInvalid` 先例（父 SA8 设计门禁行 16 已裁「maxBytes 域违约在 T1 两键视野内结构性不可观测」同款逻辑；形状经 `WindowReadFailure` 单源类型注解锁死） | **implements-existing-decision** | ADR 0031 L16/L42；设计 §7 DD-3/DD-7、§13 R-4；父票设计门禁 §3 行 16 先例 | 实现后核对 |
| 3 | ADR 0031 决策 2（窗口同构度量） | 「窗口面同构：总量 = 条目列表（含 key/index 包装）的紧凑 JSON + 元素口径投影文本」「整体序列化即度量……账本不进公共面（成功面恒四键不变）」「头行与 ✂ 段在文本内，自然计入、不豁免；`schema: null` 计 0」 | DD-6 S6.5 预算闸：`deliveryBytes(entries, schema)` = `utf8(JSON.stringify(entries)) + utf8(schema)`（复用 `#405` 共享件，组合式记账零镜像代码）；✂ 窗口事实块/`‡` 折叠页脚自然计入；`schema:null` 计 0；窗口 schema 无头行（typed-access.md 实测「without a readData head line」——头行计字条款空转，非豁免）；闸门透明，成功面恒四键不加 bytes 键；度量等式构造性成立（G4 property） | **implements-existing-decision** | ADR 0031 L21–25；设计 §7 DD-6、§12 G4/G8 | 实现后核对 |
| 4 | ADR 0031 决策 3（超限零交付 + 三面同形） | 五键失败分支、`measuredBytes` 只报合计、≤ 判定（恰等成功）、不裁剪不降深不拟合、「**三面同码同文同载荷形**……面区分靠调用现场，不靠 message」 | DD-6 恰五键零交付（`path` = 窗口目标路径新鲜回显、`measuredBytes` 两通道合计）；DD-7/DD-8 共享 `readDataBudgetExceededResult` 成员（`read-budget.ts` 唯一模板常量，`readData` 构造点同变更集迁共享件、文案逐字节不变——C8 锚）；成功交付物与无预算读逐字节相同（G1/G2/G8）；`measuredBytes` 不拆分分项 | **implements-existing-decision** | ADR 0031 L29–38；设计 §7 DD-6/DD-7/DD-8、§13 R-2 | 实现后核对 |
| 5 | ADR 0031 决策 4（分层落点 + 零变化清单） | 「校验与度量住 `@nomicore/namespace-runtime` 组合层……`@nomicore/doc-runtime` 零改动……registry lease 结果类型与 options 类型别名跟随透传（既有别名锁断言延伸）」「恒四键成功面、✂ 文法、投影文本渲染器、头行文法、`DeepOptional` 类型面、无 options 逐字节行为：全部零变化」 | DD-1 全部生产改动集中 `packages/namespace-runtime/src/**`（window-read.ts + runtime.ts + 新建 read-budget.ts）；split 消费 `maxBytes` → W1 直下传 relay 保持五键视野（doc-runtime 零 diff = 「下传仍五键」的窗口面同构兑现）；registry `src/**` 零改动按名单源别名自动跟随（types.ts 实测纯别名）；§11 DENY 逐面冻结（doc-runtime/vfsl/渲染器/registry src/index.ts/CONTEXT/ADR/protocols） | **implements-existing-decision** | ADR 0031 L42–43；设计 §7 DD-1、§11 | 实现后核对（DENY 面 git diff 证据，RA-406-3） |
| 6 | ADR 0031 决策 5（边界：where 无对撞） | 「没有静默丢弃，装满判定（`kept === n` → 可能还有）永不说谎；超限走同一报错分支，与 ADR 0029 的『✂ 永不装配』不冲突」 | DD-6 预算闸在 S6 结算**之后**、return 之前，只读不写：`truncated` 双语义与 ✂ 装配分支结构原样先结算（B5 实测结构不动）；where 侧无特殊分支；G6/R12（WM4/WM5 同字节 305 判定相反各自保持；预算不驱动 truncated；超限恰五键无 value 键 = 零静默丢弃） | **implements-existing-decision** | ADR 0031 L47–49；设计 §7 DD-6、§12 G6 | 无 |
| 7 | ADR 0031 决策 6 + 验收「文档负控」行 + `docs/AGENTS.md` Editing（OBL-DOC-406-1） | 「指引进 typed-access 纪律与作用域文档」「作用域文档词汇重录」「When code behavior changes, update every normative document whose stated contract changed」 | §11 ALLOW：`.agents/skills/nomicore/typed-access.md` 窗口读小节补窗口 `maxBytes` 词汇（同码同文、总量 = 条目列表 JSON + 元素口径投影文本、where × 预算三条语义、预算不塑形）；窗口 = 同变更集或紧随同迭代（`#405` 先例 = 同 commit 落地）；义务关闭前不得宣告完成（R-6）；清退对象 = 无（实测该小节未误述）；CONTEXT.md L54 已声明三读面零 diff（实测）、`docs/integration/*` 仅述 readData 面无需改 | **implements-existing-decision**（义务登记且窗口闭合；兑现属实现期） | ADR 0031 L53/L76；`docs/AGENTS.md` Editing；SA6 §12.6；设计 §11、§12 文档义务行、§13 R-6 | RA-406-2 兑现监督 |
| 8 | ADR 0031「验收」节（主接缝/度量 property/lease 透断言/门禁/minor bump） | 「lease 透传断言：registry 既有别名锁测试延伸（options 形状 + 新失败分支）」「全套门禁 + root typecheck/test；发布随 minor bump」 | §12 AC1–AC7 逐组承接（G1–G10/T1–T5/C1–C10）；AC6 lease 别名锁断言延伸（G9 行为 + T5 类型）；AC7 门禁四步 + DENY 面 git diff；§8 明记接口变化「0.x minor 语义，发布/版本 bump 归 Runner Host，不在本设计文件范围」——bump 义务未丢，登记 RA-406-4 挂账（父票 RA-I2 同款，发布门非代码门） | **implements-existing-decision**（门禁面；发布 bump 见 RA-406-4） | ADR 0031 L73–77；设计 §8、§12 AC6/AC7 | RA-406-4（发布门） |
| 9 | 父票 SA8 OBL-WIN-1 / RA-I1（+ RA-D5、RA-1） | 「窗口面三面义务：同构度量、同码同文同载荷形、`WINDOW_OPTIONS_INVALID` 负控；message 措辞**逐字镜像** `readData` 面选定文案（runtime.ts L1311–1327）」；RA-1 域钉死 1..2^53−1 | 本票即兑现票：DD-7 共享模板单源（`read-budget.ts` 唯一事实源；模板逐字节 = `#405` 冻结文案——runtime.ts 实测与 fixture `budgetMessageTemplate` 实测逐字一致）；G3 三面（readData/readArray/readMap）键集·码·message 一致锚；G5 负控 + 域可区分（RA-1 落 DD-3/DD-5，行 1） | **implements-existing-decision**（父票挂账本票兑现；镜像模板与豁免/负控面设计层齐备） | 父票设计门禁 §8 RA-D5、实现门禁 §8 RA-I1；runtime.ts 冻结文案 + JSDoc 镜像义务句（实测）；设计 §6 行 1–2、§7 DD-7 | 实现后核对（镜像逐字节 + G11/C8 前两条断言届时原位改写——父票 RA-I1 明记） |
| 10 | ADR 0028 决策 1/7/9（窗口公共面、结算与失败、分层） | options 词表（n/orderBy/depth/maxChildrenPerNode，经 0029 +where、0031 +maxBytes 演进链）；「恒四键 `{ ok, value, schema, truncated }`」；三稳定码；「namespace-runtime：组合选窗与元素口径投影文本；registry：lease 公共面与类型别名」 | 六键形状 = 演进链最新态（0031 决策 1 明文三读面立法）；恒四键成功面不动（闸门透明）；三码族复用零新增（A3 否决复用 `READ_OPTIONS_INVALID`/新码）；分层不动——预算轴加在第三层组合（W1 载体原语零 diff），registry 零 diff | **no-conflict** | ADR 0028 L20–22/L63–67/L75–79；ADR 0031 L16；设计 §7 DD-1/DD-8、§8 编排 | 无 |
| 11 | ADR 0029 决策 5/8（结算双语义、✂ 永不装配、组合层纪律） | 「`truncated` 双语义」「有 where 永不装配」「runtime 收缩为纯组合层（S3 净化 / S5 锚链 / S6 ✂ 装配）」 | S5/S6 逐字节不变（§7 DD-9「不变」行）；预算闸加在 S6 之后（S6.5 只读不写）；组合层零计数/零谓词求值镜像不触碰（闸门不触碰选窗与 total） | **no-conflict** | ADR 0029 L45–53/L68–70；设计 §7 DD-6/DD-9、§12 G6/C9 | 无 |
| 12 | ADR 0027（修订链后） | 决策 2 渲染器「零选项纯函数」；决策 3 头行/✂ 文法；`schema:null` 单义 | §11 DENY：`packages/vfsl/**`、`read-schema-projection.ts` 零 diff；窗口 schema 无头行（实测）→ 头行文法面本票结构不可触及；`schema:null` 单义与计 0 保持（WM8/WA3/WA4 锚） | **no-conflict** | ADR 0027 状态行 + L29/L42；设计 §11 DENY、§1 非目标 | 无 |
| 13 | ADR 0024（修订链后） | 决策 1 三键（readData 面）；决策 2 E1 输出端吸收纪律；决策 7 `DeepOptional` | 本票零触碰 readData 值面与类型面（DD-1 仅迁移共享件、行为零变化）；E1 不动；`DeepOptional` 不动（§1 非目标明列） | **no-conflict** | ADR 0024 状态行；设计 §1 非目标、§11 DENY | 无 |
| 14 | ADR 0008 + 三包 AGENTS | 「读取不进 sequencer」；同步结果联合；lifecycle 停接纳稳定码 `RUNTIME_READ_DISABLED`；「Public APIs expose detached projections only」；registry「Add public APIs only through src/index.ts」；doc-runtime「Add public APIs only through src/index.ts」 | §8/§9：全同步纯读、零状态写入、零订阅、零 sequencer；S1 lifecycle gate 原样且先于一切 options 读取（C6/N5）；registry/doc-runtime src 零改动即无公共 API 新增；runtime 侧新失败成员经既有导出联合结构可达（无新方法、无重载——DD-2「第二参必填、无重载」） | **no-conflict** | ADR 0008 L16–18/L123；三包 AGENTS（实测）；设计 §7 DD-2、§8、§9 | 无 |
| 15 | ADR 0023 + 值导出审计（issue #93） | 公共面演进可控；值导出键集冻结 | DD-1：`index.ts` 零改动（四个窗口类型名已导出实测；联合在原类型上原地加宽）；零新导出名、零新值导出；`ReadDataBudgetExceededResult` 无 index.ts 按名导出、registry 零按名消费（grep 实测）——迁 `read-budget.ts` + `runtime.ts` 回导出保模块面名字不变，值导出面仍恰 `RuntimeWriteFatalError` | **no-conflict** | ADR 0023；`runtime-acceptance-exports-audit.test.ts` L29（实测）；`index.ts` L86–89；设计 §7 DD-1/DD-8 | 无 |
| 16 | CONTEXT.md 词条族（字节预算/窗口读/过滤窗口/投影文本/截断省略/截断事实段） | L54 字节预算词条已声明三读面同码同文；`_Avoid_` 全家（裁剪/部分交付/载荷拆分/降深度拟合/✂ 找字节事实） | 设计语义面与词条逐点一致（零交付、合计、≤ 逐字节相同、缺席照常计量）；非目标显式排除 `_Avoid_` 全部形态（§1）；L54 已覆盖窗口面 → CONTEXT 零 diff 主张成立（实测）；「窗口读」L66/_Avoid_ L67 无被本票违反的陈述 | **no-conflict** | CONTEXT.md L53–54/L65–71（实测）；设计 §1 非目标、§11 DENY | 无 |
| 17 | 既有敌意面/定序/计数锚（#369 计数锚 4/5、G0/lifecycle 定序、无预算逐字节） | 仓内测试冻结的回归锚（非 ADR 面，但 #405 同款 parity 义务经父票 RA-D1 确立为实现验收必要条件） | DD-3 split 读纪律逐字镜像 W1（每键恰 2 次 descriptor 读 = 现行次序）；DD-5 重派发闭包 = re-split + re-W1(relay₂)，A2「剥离视图」备选因计数锚 4/5 直接红被硬否决；DD-4 G0 前置零 options 读取；R-1 明记「计数锚绿 = 实现验收必要条件，不得伪装成 follow-up」——诚实且与父票 RA-D1 同构 | **no-conflict**（结构前提在设计中成立；兑现为实现期义务） | `issue-369-window-read-composition-red.test.ts` L226–L246（实测 4/5 锚）；设计 §7 DD-3/DD-5、§13 R-1 | RA-406-1（实现验收） |
| 18 | 层内 message 源变化面（`{n:0, maxBytes:0}` message 由 n 域变 maxBytes 域；状态化 trap exit① message 构造点由 W1 转 split） | 无决策文本钉死该组合输入的 message 措辞或层内次序（ADR 0028 决策 7 只钉码族；SA6 G10 只钉码「非法 options 同现 → `WINDOW_OPTIONS_INVALID`」；ADR 0031 决策 1 只钉码不钉层内次序——SA6 §12.7 D7 明记「同层内不钉死次序（只钉发生层）」） | 设计如实披露（DD-9 层内次序说明 + R-7）：split 探测条与 W1 L351 **逐字相同**（实测对照）→ 状态化 trap 路径 message 文本零漂移；域/accessor 条为新面（HEAD 该分支不可达，无既有文本可漂移）；设计实测 grep 无测试钉这些文本 | **no-conflict**（已披露微偏离；不触碰任何决策文本约束面——与父票实现门禁行 16 S2b-0 守卫 throw 同款处置） | window.ts 探测条实测；SA6 §12.7 D7；设计 §7 DD-9、§13 R-7；SA2 §8 E-4 同判 | 无 |
| 19 | ADR 0031 验收「文档负控」行的作用域界定 × 根 `AGENTS.md` 窗口 options 签名枚举（SA2 O-2） | ADR 0031 验收节义务对象 =「**作用域文档**词汇重录」；父票 RA-2 已把作用域文档实名钉死为 SCOPE_DOCS 三文件（`.agents/skills/nomicore/typed-access.md`、`docs/integration/cordis-plugin-hosting.md`、`docs/integration/external-project-vfsl-codegen.md`）+ `CONTEXT.md`；`docs/AGENTS.md` Editing 规则的 Authority 节界定的规范文档类 = CONTEXT/ADR/protocols/vfsl/phases | 设计的文档义务面（OBL-DOC-406-1 → typed-access.md 窗口读小节；CONTEXT L54 零 diff；integration 仅述 readData 面）与 ADR 0031 验收行 + 父票 RA-2 实名清单逐条吻合；根 `AGENTS.md` 不在作用域文档实名清单内（其为 agent 工作流指引，非 Authority 节规范文档类；`#405` 落地同样未触碰），设计未登记该文件不构成对决策文本的违反——但其签名形态枚举（实测在案）在本票实现后将 stale-by-omission 少 `maxBytes`，属 Editing 规则精神下的低代价同步项 | **no-conflict**（义务对象按 ADR 验收行与父票实名清单裁定；stale-by-omission 为实现期才结晶的同步缺口，非设计层冲突） | ADR 0031 L76；父票设计门禁 §8 RA-2；`docs/AGENTS.md` Authority/Editing；根 AGENTS.md 签名枚举实测；SA2 §14 O-2 | RA-406-5（非阻断同步项） |

裁决分布：**no-conflict 10 项（#10–#19）、implements-existing-decision 9 项（#1–#9）、evolution-required 0 项、hard-conflict 0 项、override 0 项**。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| —（无） | — | — | — |

- Owner 评论为空（简报 Comments 段空 + REST 快照 `[]` + SA6 §2 三方一致）→ 无评论来源 override。
- 无新 ADR 修订/废弃、无协议版本升级；ADR 0031 域句无允许域外值的演进条款（设计未重开域——`2^53`/`2^53+2`/`1e21` 拒锚在 G5）。
- 设计未造任何 override：SA6 §12.7 pins D1–D7 全部采推荐解、无「条件解」→「原位修订契约」触发条件未发生；已否决备选 A1–A9 全部以决策文本/既有锚为据，非 silent override；`ReadDataBudgetExceededResult` 接口名沿用（名面历史性指向 readData）为注释级处置，无决策文本约束接口命名。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（设计态度） |
|---|---|---|---|
| 窗口成功面恒四键 `{ok,value,schema,truncated}`，不加 bytes 键 | ADR 0031 决策 2 + ADR 0028 决策 7 | ADR 0031 L25；ADR 0028 L63 | 闸门透明（S6.5 只在超限时短路，成功路径不触碰已组装四键）——一致 |
| ✂ 窗口事实块文法 / `‡` 折叠页脚 / where 永不装配 | ADR 0027 决策 3 + ADR 0029 决策 5 | ADR 0029 L52 | S6 装配规则逐字节不变，闸在其后只读——一致 |
| doc-runtime W1 五键类型/校验/行为（含直调拒 `maxBytes` 未知键） | ADR 0031 决策 4「doc-runtime 零改动」 | ADR 0031 L42 | §11 DENY + C5/N4 + `keyof` 硬锁双向锚定——一致 |
| 投影渲染器零选项纯函数（`packages/vfsl/**`、`read-schema-projection.ts`） | ADR 0027 决策 2 + ADR 0031 决策 4 | ADR 0027 L29 | §11 DENY——一致 |
| 头行文法（readData 面不记 `maxBytes`；窗口面无头行） | ADR 0031 决策 4 + ADR 0027 决策 3 | ADR 0031 L43；typed-access.md 实测 | 窗口 schema 结构上无头行（本票不可触及）；readData 面 canonical 剥离机制不动——一致 |
| 校验码词表：不新增校验码；唯一预算码 `READ_BUDGET_EXCEEDED`（恰五键） | ADR 0031 决策 1/3 | ADR 0031 L16/L31–33 | 域违约复用 `WINDOW_OPTIONS_INVALID`（A3 否决）；超限复用共享五键成员——一致 |
| 失败优先序阶梯：lifecycle > G0（非数组 path，零 options 读取）> options 校验 > W1 目标/载体/其余键 > S3 接缝 > 预算判定（最后） | ADR 0008 修订节 + ADR 0028 决策 7 + 父票 DD-8 阶梯先例 | ADR 0008 L123；ADR 0028 L65–67 | DD-9 阶梯逐行对应；G10/C3/C6 锚定（预算不吸收目标/载体失败；`WINDOW_TARGET_ABSENT`/`WINDOW_CARRIER_MISMATCH` 原样）——一致 |
| readData 面冻结文案（迁移 `read-budget.ts` 后逐字节不变） | 父票 OBL-WIN-1 镜像基准 + ADR 0031 决策 3 三面同文 | runtime.ts 冻结模板 + JSDoc 镜像义务句（实测）；C8/G3 锚 | 模板单源共享件、`readData` 构造点同变更集迁入、行为零变化——一致（R-2 双锚） |
| lease released 冻结三键短路先于透传 + active 期 raw 引用直传 + 单源别名 | ADR 0031 决策 4 + ADR 0028 决策 1（lease 公共面） | lease.ts 实测 L338–L345 | registry `src/**` 零改动、别名按名自动跟随（G9/T5）——一致 |
| 公共导出面：`index.ts` 零改动、零新导出名、零新重载、值导出键集恰 `RuntimeWriteFatalError` | ADR 0023 + issue #93 值导出审计 + 模块 AGENTS | 导出审计实测；`index.ts` L86–89 实测 | DD-1/DD-8 结构可达不加名——一致 |
| `maxBytes` 规范域 1..2^53−1（`Number.isSafeInteger(v) && v >= 1`） | ADR 0031 决策 1 域句 + 父票 RA-1 | ADR 0031 L16 | split/canonical 双处同判据 + G5 C-LIMIT 组级判据——一致 |
| 无预算窗口读逐字节行为 + `#369` 敌意计数锚 4/5 + G0/lifecycle 定序 | ADR 0031 决策 1/4（无 options 逐字节不变）+ 仓内冻结测试锚 | window.ts/runtime.ts 实测；#369 L226–246 实测 | split 读纪律逐字镜像 + 重派发闭包结构 + R-1 实现验收必要条件——一致（parity 落地为 RA-406-1） |
| `DeepOptional` 类型面 / E1 输出端吸收纪律 | ADR 0031 决策 4 + ADR 0024 决策 2（amendment） | ADR 0031 L43；ADR 0024 L45 | 零触碰（§1 非目标、§11 DENY）——一致 |
| 契约冻结锚（`WINDOW_ANCHORS_406`、`TXT_406`、种子、六份契约测试） | SA6 契约 §12.0/§12.2（验收权威） | SA6 §12.0/§13 | §11「默认零改动；仅装置缺陷时原位修订并记录」+「改锚 = 重立契约（须回 SA6 流程）」——一致 |

**14/14 全部一致，无一漂移。**

## 6. Evolution requirements

**无待计划的 evolution-required 项。** 设计不改变任何既有契约：全部条款为 ADR 0031 已授权面（三读面 options/度量/失败分支/分层/边界/文档）的兑现，或父票已裁决义务（OBL-WIN-1）的落地；ADR 0028/0029 的 options 词表演进由 ADR 0031 决策 1 显式立法覆盖（后法明文、CONTEXT.md 词汇已同步——非静默矛盾，无需回注修订）。ADR 0031 登记的合法演进位在设计中处置均为「不承诺/维持登记状态」：可选裁剪 `over:'trim'`（开放问题）、载荷拆分分项（决策 3 登记加法演进）、where 计数通道（ADR 0029 演进位）——与登记状态一致。若未来任一演进位被启动，须携修订计划先送本门禁（沿父票设计门禁 §6 要件）。

## 7. Hard conflicts

**无。** 逐项核对未发现任何与既有决策不兼容且无合法 override 的条款。五个复审重点结论：

1. **窗口面公共 API 扩张** = ADR 0031 决策 1/3/4 的逐条兑现：六键闭合形状（演进链最新态）、共享预算成员恰五键、组合层落点、registry 别名跟随、0.x minor 语义（验收节授权）；成功面恒四键与无预算逐字节行为冻结保持。
2. **拆分/中继/接缝机制** = 组合层内部机制，落在决策 4 授权面内：W1 对五键/未知键/宿主/探测的单一权威与 message 单源经「消费 `maxBytes` + 原样复制其余 descriptor」忠实保持；`maxBytes` 域拒走 runtime 构造成员沿父票 `budgetAxisInvalid` 豁免先例（父 SA8 已裁同款）；闸门权威 = canonical 复读值与 `#405` 逐字同构；A2 备选因 `#369` 计数锚硬红被否决——结构前提正确。
3. **度量与失败分支** = 决策 2/3 的构造性落地：条目列表 JSON + 元素口径投影文本两通道合计、✂/`‡` 自然计入、`schema:null` 计 0、超限恰五键零交付、≤ 逐字节相同；三面同文经模板单源共享件 + `readData` 构造点同变更集迁移（C8 逐字节锚）。
4. **父票义务兑现方式** = OBL-WIN-1 三面义务齐备（同构度量/同码同文同载荷/负控/逐字镜像——模板与冻结文案实测逐字一致）；RA-1 域钉死双处同判据；OBL-DOC-406-1 落点实名、窗口闭合（同变更集或紧随同迭代）、清退对象真空定性属实（实测）。
5. **ALLOW/DENY 清单** = 与决策 4 零变化清单逐面对齐；全部生产改动集中 runtime `src/**`；doc-runtime/vfsl/渲染器/registry src/index.ts/CONTEXT/ADR/protocols 零 diff 有决策依据；契约冻结锚不动。

## 8. Required actions

| # | 动作 | 对象 | 阻塞性 | 状态 |
|---|---|---|---|---|
| **RA-406-1** | **split/canonical 读纪律 parity 验收**（父票 RA-D1 同构）：`splitWindowOptions` 逐字镜像 W1 键循环（`Object.keys` + 每键恰 1 次显式 descriptor、零 `[[Get]]`、宿主门单源、try 收编）；`#369` 计数锚 4/5 与既有窗口测试族（`#369/#381/#382/#383`）回归绿 = 实现验收必要条件（设计 §13 R-1 已如实列为任务内必要条件，不得伪装成 follow-up） | SA3/SA4 实现 + SA9 | 阻塞**实现验收**（不阻塞设计放行） | open |
| **RA-406-2** | **OBL-DOC-406-1 兑现监督**（父票 RA-D3 同构）：`typed-access.md` 窗口读小节补窗口 `maxBytes` 词汇（同码同文 / 总量 = 条目列表 JSON + 元素口径投影文本 / where × 预算三条语义 / 预算不塑形），同变更集或紧随同迭代落地；义务关闭前不得宣告本票完成 | 实现变更集 / 总控排票 | 阻塞**本票收尾** | open |
| **RA-406-3** | **实现后复审**（本报告 `requiresConflictRecheck` 落点，父票 RA-D4 同构）：实现 diff 就绪后按 implementation 复查模式核对 §5 冻结面 14 项——六键 options + 联合预算成员落地形态、DD-1–DD-9 落点选择（含 `read-budget.ts` 迁移后 readData 面 C8 逐字节）、DENY 面 git diff 证据、OBL-DOC-406-1 形态、父票 RA-I1 明记的「G11/C8 前两条断言届时原位改写」 | SA4/SA9 触发 + 本门禁 | 流程 | open |
| **RA-406-4** | **发布 minor bump 挂账延续**（父票 RA-I2 同款，非本票新增）：本票在 `@nomicore/namespace-runtime` 追加公共面变化（六键 options + 联合新成员），与 `#405` 变更同包——发布时不得以 patch 位发布（ADR 0031 验收节「0.x 破坏性 minor」）；设计 §8 已如实声明 bump 归 Runner Host，义务未丢 | 发布流程 | 阻塞**发布**（不阻塞代码交付评审） | open（沿父票 RA-I2） |
| 参照（非本票义务） | 父票 RA-I3（doc-sync 扫描器 `BUDGET_OPTION_KEYS` 三键化）维持 open：`readData(x,{maxBytes})` 调用字面限制仍在；本票窗口面词汇不涉该扫描器（其正则只锚 `readData(` 调用点），OBL-DOC-406-1 落地不受其阻塞 | 后续票 | 非阻塞 | open（父票挂账） |
| **RA-406-5** | **根 `AGENTS.md` 窗口 options 枚举对齐**（SA2 O-2 接盘；§3 行 19）：实现落地后根 `AGENTS.md` Nomicore 集成段的 `readArray/readMap` options 签名枚举 stale-by-omission 少 `maxBytes`——建议并入 RA-406-2 同窗口（同变更集或紧随同迭代）顺手对齐（一次枚举补 `maxBytes?`，连同父票遗留的 readData 描述口径一并巡检）；非决策义务（作用域文档实名清单不含该文件），不阻断本票收尾，但 Editing 规则精神下不宜长期悬空 | 实现变更集 / 文档巡扫 | 非阻断（advisory） | open |

## 9. Verdict

**`clear`** —— 十九项对照全部为 no-conflict（10）或 implements-existing-decision（9），无 hard conflict、无需 override、无待计划的 evolution-required。本票为父票 OBL-WIN-1 挂账的**兑现票**：窗口面 `maxBytes` 三面义务（同构度量、同码同文同载荷、`WINDOW_OPTIONS_INVALID` 负控、message 逐字镜像冻结文案）在设计中全部齐备且有单源共享件 + 契约锚双保险；全部生产改动落在 ADR 0031 决策 4 授权的组合层面；DENY 面冻结有决策依据；SA6 §12.7 pins D1–D7 全采推荐解、无「另有选择」触发；两处既有测试锁原位延伸沿父票 B11 先例（锁期望跟随已登记演进链）。SA2 review（approve，追加在场）未发现 BLOCKER/MAJOR，其 4 条观察（O-1 计数笔误 / O-2 根 AGENTS.md 枚举 / O-3 stringify 包裹性同阶 / O-4 实现联动单元）经本次并读核验均不触及决策冲突面，O-2 已登记 RA-406-5。**门禁放行；实现迭代可按本设计推进**（RA-406-1 为实现期约束、RA-406-2 阻塞收尾、RA-406-3 为实现后复审触发点、RA-406-4 为发布门、RA-406-5 为 advisory 同步项）。

## 10. requiresConflictRecheck

**true**。理由：

1. **公共 API 加法变化尚待实现核对**：两面 options 闭合形状五→六键 + 两结果联合追加 `READ_BUDGET_EXCEEDED` 共享成员（消费方 `code` 穷举窄化面受影响，minor bump 语义）——实现 diff 就绪后须按 implementation 复查模式核对（RA-406-3，即本标志落点）；
2. **本票 SA8 前置门禁产物缺席**（无 relevant_decisions / conflict_report）：冲突基准由本报告直接实读决策全集自建（§2），实现后须整链复核；
3. **结构决策的实现 parity 义务**：split/canonical 读纪律与 W1 的逐字同构、重派发闭包、`read-budget.ts` 迁移后 readData 面逐字节不变（C8）——RA-406-1/RA-406-3 落实；
4. **OBL-WIN-1（兑现方式核对）与 OBL-DOC-406-1（文档兑现监督）未关闭**；父票 RA-I1 明记「G11 前两条断言届时原位改写并送门禁复核」。
