# SA8 冲突门禁报告 — Issue #406 实现与文档交付前复审（implementation 复查）

- 派发：`sa-57fcbc1c-113c-4f23-8ff7-33b12d1d8dc1`（role `mabf-sa8`，phase `conflict-gate`，iteration 0）
- Worktree：`/home/wangjian/nomicore-fix-issue-406`（branch `mabf/issue-406`，HEAD `56cf5428…` = `fix(#405)`，与设计门禁/SA6 契约基线一致——本次 `git log` 复核在案）
- 本报告为该票**实现后复审**（SA8 设计门禁 `task_issue-406_design_conflict_report.md` §8 **RA-406-3** 落点，父票 `#405` 实现门禁 RA-I1「G11 前两条断言届时原位改写并送门禁复核」的指定复核点）。被审对象 = 当前工作区变更集（生产代码 3 文件 + 文档 1 文件 + 测试修订 2 处 + SA6 契约族沿用）与上游定稿产物（SA3 报告、SA2 review `approve`、SA6 契约 rev1）。
- Issue-comment REST 快照为空（派发说明明示 `[]`；简报 `## Comments` 段空、SA6 §2、设计 §4 四方一致）——**无 owner 评论，无 override 来源，无评论来源附加义务**。
- SA4/SA9 产物尚未落盘（glob 复核确认）：实现质量审查与活链路验证归 SA4/SA7/SA9 维度，不属本门禁裁决面；本报告只裁决与既有决策集的冲突。

## 1. Reviewed subject

**implementation** —— 当前 diff（`git diff --stat`：6 M 文件 +320/−119；?? 新文件 = `src/read-budget.ts` + SA6 契约族 7 文件 + wiki/artifacts）+ OBL-DOC-406-1 文档落地。复审焦点（设计门禁 RA-406-3 指定 + 本次实读核对）：

1. **窗口面公共 API 扩张落地形态**：两面 options 五→六键（DD-2）+ 两结果联合追加共享 `READ_BUDGET_EXCEEDED` 成员（DD-8）+ `read-budget.ts` 共享件迁移后 readData 面 C8 逐字节。
2. **DD-1–DD-9 落点选择**：S2-G0 前置 / S2-split / W1(relay) / canonical 六键镜像（闸门权威 = 复读值）/ 重派发闭包（re-split + re-W1(relay₂)）/ S6.5 预算闸位置。
3. **设计门禁 §5 十四项冻结面**逐项对实际 diff 核对 + DENY 面 git diff 证据。
4. **OBL-WIN-1（父票 RA-I1）兑现方式**：三面同码同文同载荷、message 逐字镜像冻结文案、`WINDOW_OPTIONS_INVALID` 负控、G11 前两条断言原位改写复核。
5. **RA-406-1（split/canonical 读纪律 parity，#369 计数锚 4/5）**与 **RA-406-2（OBL-DOC-406-1）** 的闭合状态。
6. **SA3 登记的两处测试修订**（D-1 G11 改写、D-2 C7 装置缺陷原位修订）是否越出授权面。

本报告不评价实现质量、断言充分性或性能（SA2/SA4/SA6 维度）；不运行测试（SA3/SA6 日志作为「实现后事实」的证据采纳，冲突裁决以决策文本与源码实读为准）。

## 2. Inputs and decision set

- 输入：`wiki/raw/task_issue-406.md`（简报；`## Comments` 段空）、`task_issue-406_design.md`（SA1，426 行）、`task_issue-406_sa6_contract.md`（rev1，验收权威——wiki/raw 属证据非规范契约，但其 pins 编码 ADR 派生义务）、`task_issue-406_sa2_review.md`（`approve`，O-1–O-4）、`task_issue-406_sa3_impl.md`（首版，两处 Deviations D-1/D-2 在案）、`task_issue-406_design_conflict_report.md`（本票设计门禁，`clear`，RA-406-1…5）、父票 `task_issue-405_implementation_conflict_report.md`（iteration 3，`clear`，RA-I1–I4）与 `task_issue-405_design_conflict_report.md`（RA-1/RA-3/RA-D5=OBL-WIN-1 挂账链头）。
- 本票 SA8 前置门禁产物缺席（无 `task_issue-406_relevant_decisions.md` / `_conflict_report.md`，本次 glob 复核确认）——处置沿设计门禁先例：直接实读决策全集自建冲突基准；前置缺位由本实现后复审整链收口（全链 = SA6 契约 → SA1 设计 → SA2 → SA3 → 本报告）。
- 决策集（本次全部实读）：`docs/adr/**` 全集（31 篇，`0020`–`0031` 可见；无整篇 superseded）；**修订链在状态行在案**——ADR 0024（决策 1 经 0031 再修订 +`maxBytes`）、ADR 0027（决策 1 options 句经 0031 再修订）；ADR 0031 为母法（决策 1–6 + 修订节 + 备选否决表 + 验收节 + 开放问题，本次全文实读）；ADR 0028（决策 7 恒四键 `{ ok, value, schema, truncated }`、`WINDOW_OPTIONS_INVALID` 稳定码、L63/L67 实锚）、ADR 0029（决策 5 装满判定 `kept === n` /「有 where 永不装配」L51–52 实锚）、ADR 0008、ADR 0023。
- 词汇与收录纪律：`CONTEXT.md` L54「字节预算」词条（实测已声明**三读面**同码同文——窗口面零 diff 的依据）、L65–71「窗口读」「过滤窗口」；`docs/AGENTS.md` Authority/Editing 规则；`packages/{namespace-runtime,namespace-registry,doc-runtime}/AGENTS.md`；根 `AGENTS.md`（RA-406-5 对象，实测窗口 options 枚举仍少 `maxBytes`）。
- 实读核对对象（当前 diff 全量）：
  - `packages/namespace-runtime/src/window-read.ts`（+140/−部分）：六键 interface ×2、联合追加 `ReadDataBudgetExceededResult`、`canonicalWindowBudget` 白名单五→六键 + `maxBytes` 域镜像 + ok 分支 `readonly maxBytes: number | undefined`、`composeWindowRead` S6 之后新增 S6.5 预算闸（只读不写）、组合入口签名改 `redispatch` 闭包（`WindowRedispatch` 具名类型，`doc` 形参移除）、S6 结算逻辑（`truncated` 双语义 + ✂ 装配分支）**逐字节不动**（diff 无该区 hunk）。
  - `packages/namespace-runtime/src/runtime.ts`（+245/−119）：`readArray`/`readMap` S1 → S2-G0（非数组 path → W1(raw) 单源拒 + loud throw 不变式守卫）→ S2-split（`splitWindowOptions`）→ S2-W1(relay) → compose(raw, 重派发闭包)；三条窗口面 message 常量（W1 无码前缀族）；`windowBudgetAxisInvalid`（`WINDOW_OPTIONS_INVALID` 恰四键，返回类型注解 = doc-runtime 单源 `WindowReadFailure`）；readData 面共享件迁出改 import（`readDataBudgetExceeded`/`deliveryBytes`/`echoReadPath` 本地定义删除，`ReadDataBudgetExceededResult` 原位 `export type { … } from './read-budget.js'`）；`READ_MAXBYTES_DOMAIN_MESSAGE` 注释镜像义务边界修正（三面同文只覆盖超限分支）。
  - `packages/namespace-runtime/src/read-budget.ts`（新建，100 行，包内内部模块不经 index.ts 导出）：`budgetExceededMessage` 模板（实测与 #405 删除前 runtime.ts 模板**逐字符一致**：`` READ_BUDGET_EXCEEDED: 读交付总量 ${measuredBytes} 字节超出 maxBytes ${maxBytes} `` + `'——零交付拒绝（不裁剪、不降深度；ADR 0031）'`）、`readBudgetExceeded` 恰五键构造器、`deliveryBytes` 两通道度量（与 #405 原实现逐字同构）、`echoReadPath`、`ReadDataBudgetExceededResult` 接口。
  - `.agents/skills/nomicore/typed-access.md`（+9 段行）：窗口读小节新增「**Byte budget on windows: `maxBytes`**」三段 + `WINDOW_OPTIONS_INVALID` 词条补域外 `maxBytes` + 失败词表补 `READ_BUDGET_EXCEEDED` 条。
  - `packages/namespace-runtime/test/issue-405-maxbytes-control.test.ts`（+21/−）：G11 窗口面 describe/it 标题与断言原位改写（`WINDOW_OPTIONS_INVALID`+`FAILURE_KEYS` → `READ_BUDGET_EXCEEDED`+`BUDGET_FAILURE_KEYS` 单源常量 import）；doc-runtime 直调用例与无预算窗口读用例**零改动**（实读）。
  - `packages/namespace-runtime/test/issue-406-window-maxbytes-control.test.ts`（SA6 落盘文件，C7 第二用例原位修订，实读）：`maxBytes: 1` → `maxBytes: 0` + 装置理由注释 + 新增 `toContain('maxBytes')` message 域断言。
  - 两处既有类型锁（`issue-369-window-read-lease-surface.test-d.ts`、`issue-383-window-where-type-guard.test-d.ts`）：diff 内容恰为 SA6 契约 §12.2 登记的 `Omit<…,'maxBytes'>` 中继锁原位延伸（纯别名 `Equal` 改写 + 相邻注释），与本票实现同变更集在位（SA3「零改动」声明与 diff 形态一致——该两文件的 M 即 SA6 基线本身）。
- DENY 面零 diff 实测（本次 `git diff --stat HEAD -- <DENY 路径>` 全空，exit 0）：`packages/doc-runtime`、`packages/vfsl`、`packages/namespace-runtime/src/read-schema-projection.ts`、`src/index.ts`、`packages/namespace-registry/src`、`CONTEXT.md`、`docs/`、`apps/`、`domains/`、`vitest.config.ts`、`tsconfig.base.json`、根 `package.json`。
- 运行证据（SA3 日志，本门禁采纳为「实现后事实」）：契约族 7 files/45 tests 绿 + no type errors（`sa3-issue406-contract-family.log`）；#369/#383 计数锚族 2 files/71 tests 绿（`sa3-issue406-r1-counting-anchors.log`）；定点 `--typecheck` 172 files/2125 tests 绿；root `pnpm typecheck` exit 0（0 条 error TS）；root 全量 `pnpm test` **422 files / 5095 tests 全绿、FULLTEST_EXIT=0**、冻结修订复跑二次确认一致（`sa3-issue406-full-test-final.log`）；DENY 零 diff + 契约零 skip/only/todo/env（`sa3-issue406-scope-diff.log`）。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（当前 diff） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0031 决策 1（三读面 options 域句） | 「`readData`/`readArray`/`readMap` 的 options 闭合形状追加 `maxBytes?: number`：≥1 的有限整数（≤ 2^53−1）；`0`、负数、非整数、非有限数、未知键 → 各面**既有** options 校验码响亮拒绝（窗口面 `WINDOW_OPTIONS_INVALID`），不新增校验码」「缺席 ≡ 不设预算（现行为逐字节不变）」 | 两面六键闭合 interface（`window-read.ts` L77–99：`n` 必填 + 五可选 + `maxBytes?: number`，成员无 `readonly`、term/`WhereTerm` 单源 import doc-runtime）；split（`runtime.ts` `splitWindowOptions`）与 canonical（`window-read.ts` L370–375）**双处同判据** `typeof v === 'number' && Number.isSafeInteger(v) && v >= 1`；域外 → `WINDOW_OPTIONS_INVALID` 恰四键（message 含 `maxBytes` 域标识且 ≠ 未知键文案）；present-undefined 双处剥离（split `value === undefined → continue`；canonical L355 同）；非 enumerable ≡ 缺席（split/canonical 均只走 `Object.keys` 可见键）；`Object.freeze` 宿主接受（descriptor 复制到新鲜 relay）；缺席 → 零预算路径逐字节保持（G1/C1 绿） | **implements-existing-decision**（设计门禁行 1「实现后核对」本次闭合） | ADR 0031 L16–17；window-read.ts L77–99/L370–375；runtime.ts `splitWindowOptions`；G5/C4 锚（契约族 45/45 绿） | 无 |
| 2 | ADR 0031 决策 1（不新增校验码）× W1 单一权威 × 接缝豁免先例 | 「不新增校验码」；决策 4「校验…住组合层」 | `maxBytes` 域/accessor/探测期违约由 runtime `windowBudgetAxisInvalid` 构造 `WINDOW_OPTIONS_INVALID` 恰四键成员（**零新码**）；W1 保持五键/未知键/宿主 message 单源——split **消费**合法 `maxBytes`（不进 relay），`{n:1, maxBytes:1, nope:1}` 仍以「未知键：nope」被 W1 拒；宿主门 relay = raw 原样直传（判据与 message 单源留 W1）；豁免登记沿父票 `budgetAxisInvalid`/`seamReadOptionsInvalid` 先例（JSDoc 在案），形状经 `WindowReadFailure` 单源类型注解锁死；唯一预算码 `READ_BUDGET_EXCEEDED` 复用共享五键成员 | **implements-existing-decision** | ADR 0031 L16/L42；runtime.ts `#406` 段；G5/G10 锚 | 无 |
| 3 | ADR 0031 决策 2（窗口同构度量） | 「窗口面同构：总量 = 条目列表（含 key/index 包装）的紧凑 JSON + 元素口径投影文本」「头行与 ✂ 段在文本内，自然计入、不豁免；`schema: null` 计 0」「整体序列化即度量……账本不进公共面（成功面恒四键不变）」 | S6.5（window-read.ts L272–277）：`deliveryBytes(entries, schema)` = `utf8(JSON.stringify(entries)) + utf8(schema)`——共享件单源、组合式记账零镜像代码；schema 通道 = **最终装配文本**（S6 的 ✂ 窗口事实块装配**之后**计量 → ✂/`‡` 自然计入）；`schema:null` 计 0（`deliveryBytes` null 分支）；窗口 schema 无头行（头行计字条款结构空转，非豁免）；闸门透明——成功路径不触碰已组装四键、不加 bytes 键；度量对象 = 塑形后交付物（G4 度量等式 property 以独立两通道 oracle 锚定，绿） | **implements-existing-decision** | ADR 0031 L21–25；window-read.ts L264–277；read-budget.ts L75–79；G4/G8 锚 | 无 |
| 4 | ADR 0031 决策 3（超限零交付 + 三面同形） | 「`{ ok:false; code:'READ_BUDGET_EXCEEDED'; path; measuredBytes; message }`」「`measuredBytes` 只报合计」「**三面同码同文同载荷形**……面区分靠调用现场，不靠 message」「不裁剪、不降深度、不拟合」「恰好等于 → 成功（≤ 判定）」 | `readBudgetExceeded`（read-budget.ts L88–100）恰五键、零成功键、`path` 经 `echoReadPath` 新鲜回显、`measuredBytes` 两通道合计不拆分；**模板逐字节 = #405 冻结文案**（本次对照删除前 runtime.ts 原文与 fixture `budgetMessageTemplate` 三方逐字符一致）；三面同一构造器单源（`runtime.ts` readData 构造点同变更集迁引，本地副本删除——C8 逐字节锚绿）；`measuredBytes > canonical.maxBytes` 才拒（≤ 含恰等收）；`≤` 侧交付物与无预算读逐字节相同（G1/G2 边界成对 18 锚绿）；无裁剪路径（失败成员结构上无 value/schema/truncated） | **implements-existing-decision**（OBL-WIN-1 同码同文同载荷义务的实现闭合） | ADR 0031 L29–38；read-budget.ts L52–55/L88–100；runtime.ts L849–853；C8/G1/G2/G3 锚 | 无 |
| 5 | ADR 0031 决策 4（分层落点 + 零变化清单） | 「校验与度量住 `@nomicore/namespace-runtime` 组合层……`@nomicore/doc-runtime` **零改动**……registry lease 结果类型与 options 类型别名跟随透传」「恒四键成功面、✂ 文法、投影文本渲染器、头行文法、`DeepOptional` 类型面、无 options 逐字节行为：全部零变化」 | 全部生产改动集中 `packages/namespace-runtime/src/**` 三文件；doc-runtime/vfsl/渲染器/registry `src/**`/`index.ts`/CONTEXT/docs/protocols git diff 全空（本次实测）；W1 收 relay（五键视野——split 消费 `maxBytes`）；registry 零改动按名单源别名自动跟随（`types.ts` 纯别名未触碰；G9 lease ≡ runtime 逐字段 + T5 类型锁绿）；无 options 逐字节行为由 C1/C2/C10 + 全量回归绿锚定 | **implements-existing-decision** | ADR 0031 L42–43；`git diff --stat HEAD -- <DENY>` 全空实测；G9/T5 锚 | 无 |
| 6 | ADR 0031 决策 5（边界：where 无对撞） | 「没有静默丢弃，装满判定（`kept === n`）永不说谎；超限走同一报错分支，与 ADR 0029 的『✂ 永不装配』不冲突」 | 预算闸在 S6 结算**之后**、return 之前，只读不写：`truncated` 双语义与 ✂ 装配分支结构原样先结算（diff 无 S6 逻辑 hunk，实读）；where 侧无特殊分支；WM4/WM5 同字节 305 判定相反各自保持（fixture 冻结值实测在案；G6 三态 + 无 `value` 键 = 零静默丢弃，绿）；超限 where 窗口走同一五键分支（G6 超限侧绿） | **implements-existing-decision** | ADR 0031 L47–49；window-read.ts L264–271（S6 原样）+ L272–277（S6.5）；G6/C9 锚 | 无 |
| 7 | ADR 0031 决策 6 + 验收「文档负控」行 + `docs/AGENTS.md` Editing（OBL-DOC-406-1 / RA-406-2） | 「指引进 typed-access 纪律与作用域文档」「作用域文档词汇重录」「When code behavior changes, update every normative document whose stated contract changed」 | `typed-access.md` 窗口读小节**同变更集**落地：三段「Byte budget on windows」词汇（三面同一契约 same code/message/payload、域、总量 = 条目列表含 `{index\|key,value}` 包装紧凑 JSON + 元素口径投影文本、✂/`‡` 自然计入、`schema:null` 计 0、`≤` 逐字节相同 / `>` 恰五键零交付不塑形、**where × 预算三语义**（同分支/装满判定不受预算驱动/✂ 永不装配）、定序 options → 目标/载体 → 预算、确定性重试）+ `WINDOW_OPTIONS_INVALID` 词条补域外 `maxBytes` + `READ_BUDGET_EXCEEDED` 失败词条；**清退对象 = 无**（纯加法，与 SA6 §12.6 定性一致）；CONTEXT.md L54 已声明三读面（零 diff 正确）；`docs/integration/*` 仅述 readData 面（零 diff 正确）；doc-sync 门禁 43/43 绿；RA-I3 约束未触碰（新增文本无 `readData(x,{maxBytes})` 调用字面——grep 实测） | **implements-existing-decision**（义务关闭，RA-406-2 闭合） | ADR 0031 L53/L76；typed-access.md diff 实读；`docs/AGENTS.md` Editing；SA6 §12.6 | 无（RA-406-2 闭合） |
| 8 | ADR 0031「验收」节（门禁 + minor bump） | 「全套门禁 + root `pnpm typecheck` / `pnpm test`；发布随 minor bump（0.x 破坏性 minor）」 | root typecheck exit 0（0 error）；root 全量 422 files/5095 tests exit 0（SA6 基线 4 红文件全转绿、零其它回归）；定点 `--typecheck` 172/2125 绿；契约零 skip/only/todo/env（grep）；形状集中化门 family A/B 归零保持（#405 G11 改写复用 `BUDGET_FAILURE_KEYS` 单源常量，不新增字面键集）；**minor bump 未随 diff 落地**（`namespace-runtime` 版本未动）——发布时动作，登记 RA-406-4 延续，不构成本变更集冲突 | **implements-existing-decision**（门禁面；发布 bump 见 RA-406-4） | ADR 0031 L73–77；`sa3-issue406-{root-typecheck,full-test-final,focused-typecheck,scope-diff}.log` | RA-406-4（发布门） |
| 9 | 父票 SA8 OBL-WIN-1 / RA-I1（+ RA-D5、RA-1） | 「窗口面三面义务：同构度量、同码同文同载荷形、`WINDOW_OPTIONS_INVALID` 负控；message 措辞**逐字镜像**本票冻结文案」「G11 前两条断言届时原位改写并送门禁复核」 | **本票即兑现票且已闭合**：①同构度量（行 3）；②同码同文同载荷 = 共享构造器单源（行 4）；③`WINDOW_OPTIONS_INVALID` 负控（行 1/2）；④message 逐字镜像——超限分支模板三方逐字符一致（read-budget.ts × #405 冻结文案 × fixture 模板）；⑤G11 前两条窗口面断言**按 RA-I1 授权原位改写**：`WINDOW_OPTIONS_INVALID`+四键 → `READ_BUDGET_EXCEEDED`+五键（键集经 `BUDGET_FAILURE_KEYS` 单源常量），改写后断言对「窗口面退回 maxBytes ≡ 未知键」**回退敏感**（回退即红）；doc-runtime 直调用例（`READ_OPTIONS_INVALID` 两键面锚）与无预算窗口读用例零改动（实读）；镜像义务边界注释修正（`READ_MAXBYTES_DOMAIN_MESSAGE` 注释明示三面同文只覆盖超限分支、域拒走各面措辞族——与 SA2 §5 pin D5 裁定一致） | **implements-existing-decision**（父票挂账本票兑现；RA-I1 的「送门禁复核」= 本报告此行） | 父票实现门禁 §8 RA-I1；`issue-405-maxbytes-control.test.ts` diff 实读；read-budget.ts L52–55；C8/G3 锚 | 无（RA-I1 窗口面部分闭合） |
| 10 | ADR 0028 决策 7/9（恒四键、三稳定码、分层） | 「恒四键 `{ ok, value, schema, truncated }`」「`WINDOW_OPTIONS_INVALID`——规则非法」「namespace-runtime 组合选窗 + registry lease 公共面别名」 | 成功面恒四键零漂移（闸门只在超限时短路；S6 return 原样）；三码族复用零新增；分层不动——预算轴加在第三层组合（W1 载体原语 doc-runtime 零 diff）；registry 零 diff 别名跟随；六键形状 = 0028→0029→0031 演进链最新态（0031 决策 1 明文三读面立法） | **no-conflict** | ADR 0028 L63/L67/L94 实锚；ADR 0031 L16；window-read.ts 联合与 S6；G1/C1 锚 | 无 |
| 11 | ADR 0029 决策 5/8（结算双语义、✂ 永不装配、组合层纪律） | 「有 where：装满判定 `kept === n`」「有 where 永不装配」「runtime 收缩为纯组合层」 | S5/S6 结算逻辑逐字节不动（diff 无 hunk）；闸门只读不写、不触碰 `total`/`truncated`/✂ 装配；组合层零计数/零谓词求值镜像不触碰（where 过滤仍全在 W1） | **no-conflict** | ADR 0029 L51–52/L85 实锚；window-read.ts diff 形态；G6/C9 锚 | 无 |
| 12 | ADR 0027（修订链后） | 决策 2 渲染器「零选项纯函数」；决策 3 头行/✂ 文法；`schema:null` 单义 | `packages/vfsl/**`、`read-schema-projection.ts` 零 diff（实测）；窗口 schema 结构上无头行（typed-access.md「without a readData head line」在案）→ 头行文法面不可触及；readData 面头行不记 `maxBytes`（canonical 剥离机制零改动）；`schema:null` 单义与计 0 保持（WA3/WA4/WM8 锚绿） | **no-conflict** | ADR 0027 状态行 + L29/L42；git diff 全空实测；G4/G8 锚 | 无 |
| 13 | ADR 0024（修订链后） | 决策 1 三键（readData 面）；决策 2 E1 吸收纪律；决策 7 `DeepOptional` | readData 值面/类型面零触碰（共享件迁移行为零变化：模板/判据/构造逐字同构，C8 绿）；E1 不动；`DeepOptional` 不动（vfsl-protocol 零 diff） | **no-conflict** | ADR 0024 状态行；read-budget.ts × 删除前 runtime.ts 对照；C8 锚 | 无 |
| 14 | ADR 0008 + 三包 AGENTS + runtime AGENTS（本次注入文本复核一致） | 「读取不进 sequencer」；同步结果联合；lifecycle 停接纳稳定码；「Public APIs expose detached projections only」；registry/doc-runtime「公共 API 仅经 src/index.ts」 | 读路径全同步纯读、零状态写入、零订阅、零 sequencer（编排实读）；S1 lifecycle gate 先于一切 options 触达（代码序静态核实 + C6「closed 期 Proxy → `RUNTIME_READ_DISABLED`、get trap 0 次」）；registry/doc-runtime src 零改动即无公共 API 新增；产物 detached（条目列表 W1 原样、投影文本新鲜、`path` 回显新鲜副本） | **no-conflict** | ADR 0008 L16–18/L123；三包 AGENTS；runtime.ts S1 序；C6/N5 锚 | 无 |
| 15 | ADR 0023 + 值导出审计（issue #93） | 公共面演进可控；值导出键集冻结 | `index.ts` **零 diff**（实测）；四个窗口类型名已按名导出（L86–89）、联合在原类型上原地加宽；`ReadDataBudgetExceededResult` 无 index.ts 按名导出（`#405` 起即如此）、runtime.ts 原位 re-export 保模块面名字不变；零新导出名/零新重载/零新值导出（导出审计测试未触碰且全量绿） | **no-conflict** | ADR 0023；index.ts 零 diff 实测 + L86–89 实读；`runtime-acceptance-exports-audit`（全量套件内绿） | 无 |
| 16 | CONTEXT.md 词条族 | L54「字节预算」已声明三读面同码同文；`_Avoid_` 全家（裁剪/部分交付/载荷拆分/降深度拟合/✂ 找字节事实/maxBytes 当形状替身） | 实现语义与词条逐点一致（零交付、合计、≤ 逐字节相同、缺席照常、跨三读面同码同文）；`_Avoid_` 全家排除：无裁剪路径、无部分交付（零成功键锁）、失败分支无 ✂ 装配、`measuredBytes` 只报合计、`maxBytes` 不塑形不进投影文本；词条已覆盖窗口面 → CONTEXT 零 diff 主张成立（L54 实测） | **no-conflict** | CONTEXT.md L53–54 实测；G8「schema 不含 maxBytes」锚 | 无 |
| 17 | 既有敌意面/定序/计数锚 + RA-406-1（split/canonical 读纪律 parity） | `#369` 计数锚 4/5（仓内冻结回归锚）；G0/lifecycle 定序；无预算逐字节（父票 RA-D1 同款 parity = 实现验收必要条件） | `splitWindowOptions` 读纪律逐字镜像 W1：宿主门（非对象/数组/null/非 plain 原型 → relay = raw，仅一次 `getPrototypeOf`）→ `Object.keys` + 每键恰 1 次显式 `getOwnPropertyDescriptor`（= W1 每键 2 次的现行次序）→ 全程零 `[[Get]]` → 整体 try 收编；**重派发闭包 = re-split（raw 现场）+ re-W1(relay₂)**（W1 读 plain relay 零 raw 触达——A2 备选未复活的实读证明；canonical 仍读 raw）；G0 前置分支零 options 读取（W1 G0 先于其 OPT 的 doc-runtime 既有事实）；实测 `#369` 计数锚族 2 files/71 tests 绿（状态化 trap 4 / 交替 trap 5 / get trap 0），`#369` S3 组断言原文零改动 | **implements-existing-decision**（RA-406-1 实现验收必要条件闭合） | `issue-369-window-read-composition-red.test.ts`（未触碰）；runtime.ts `splitWindowOptions` 实读；`sa3-issue406-r1-counting-anchors.log` | 无（RA-406-1 闭合） |
| 18 | SA6 契约 §12.2/设计 §11「契约测试沿用/原位修订」纪律 × D-2（C7 装置缺陷原位修订） | SA6 §12.2「实现方沿用/**原位修订**」；设计 §11 ALLOW「仅当实现期发现装置缺陷时原位修订并记录理由」；SA6 §12.3 G5「`{maxBytes:1}` 必须走 `READ_BUDGET_EXCEEDED`（**不是** options 码）」 | C7 第二用例原装置 `{n:2, maxBytes:1}` 断言四键 `WINDOW_OPTIONS_INVALID` 与同契约 G5 有效域接受锚**互斥**（`maxBytes:1` 域内合法——红灯测试 L242 注释与断言实读在案；HEAD 上 C7 只因「未知键」巧合落 options 码，任何满足 G 组的实现必使原装置红）——属契约**自相矛盾型装置缺陷**；修订以域外 `maxBytes: 0` 承载同一用例意图（敌意 get trap Proxy + descriptor 诚实 + 零 `[[Get]]` → 响亮 options 码），并**增强** `toContain('maxBytes')` 域断言；G 组（目标语义）断言零改动；冻结锚表 `WINDOW_ANCHORS_406` 逐值对 SA6 §12.0 表 spot-check 一致（WA0 299 … WM9 236，18/18）；C7 第一用例（descriptor trap）零改动且绿 | **no-conflict**（授权面内的装置原位修订，理由在案；非冻结锚改写、非验收弱化——修订后仍对「域拒缺失/[[Get]] 触发/外抛」敏感） | SA6 §12.2/§12.3 G5；control 测试 C7 段实读；red 测试 L242；fixture 锚表 vs 契约 §12.0 对照 | 无 |
| 19 | 根 `AGENTS.md` 窗口 options 枚举（RA-406-5 对象；SA2 O-2） | 无决策文本约束该文件（设计门禁 §3 行 19 已裁：不在 SCOPE_DOCS 实名清单，agent 工作流指引非 Authority 节规范文档类） | 根 `AGENTS.md` Nomicore 集成段仍以签名形态枚举 `readArray/readMap` options 五键（实测）——实现落地后 stale-by-omission 少 `maxBytes` **已结晶**；SA3 如实未触碰（不在 ALLOW 清单）并挂账移交 | **no-conflict**（advisory 同步项；不阻断本票收尾——沿设计门禁 RA-406-5 裁定） | 根 AGENTS.md 实测；设计门禁 §8 RA-406-5；SA3 §Deferred #4 | RA-406-5（advisory，open） |

裁决分布：**no-conflict 10 项（#10–#19）、implements-existing-decision 9 项（#1–#9）、evolution-required 0 项、hard-conflict 0 项、override 0 项**。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| —（无） | — | — | — |

- Owner 评论为空（派发说明 REST 快照 `[]` + 简报 Comments 段空 + SA6 §2 + 设计 §4 四方一致）→ 无评论来源 override。
- 无新 ADR 修订/废弃、无协议版本升级（`docs/**` 零 diff——决策集自 HEAD 起未变）；ADR 0031 域句无允许域外值的演进条款（实现未重开域：split/canonical 双处 `Number.isSafeInteger && ≥1`，`2^53` 拒锚绿）。
- 实现未造任何 override：DENY 面零 diff（无越界触碰即无「既成事实型」违规）；G11 改写有父票 SA8 RA-I1 **明文授权**（合法 override 权威之一种——既有 SA8 裁决指定），C7 修订有 SA6 §12.2 + 设计 ALLOW 明文授权且理由在案；`ReadDataBudgetExceededResult` 接口名沿用（名面历史性）为注释级处置，无决策文本约束接口命名。

## 5. Frozen surfaces

设计门禁 §5 十四项冻结面逐项对实际 diff 核对（implementation 复查模式核心）：

| Surface | Must remain unchanged | Evidence | Actual result（实际 diff 核对） |
|---|---|---|---|
| 窗口成功面恒四键 `{ok,value,schema,truncated}`，不加 bytes 键 | ADR 0031 决策 2 + ADR 0028 决策 7 | ADR 0031 L25；ADR 0028 L63 | **保持**：S6 return 原样；S6.5 仅超限时短路；G1/G8 恰四键断言绿 |
| ✂ 窗口事实块文法 / `‡` 折叠页脚 / where 永不装配 | ADR 0027 决策 3 + ADR 0029 决策 5 | ADR 0029 L52 | **保持**：`appendWindowFacts`/`windowFactsBlock` 零 hunk；闸在其后只读；G6「schema 无 ✂ 且事实行数 0」绿 |
| doc-runtime W1 五键类型/校验/行为（含直调拒 `maxBytes` 未知键） | ADR 0031 决策 4「doc-runtime 零改动」 | ADR 0031 L42 | **保持**：`packages/doc-runtime` git diff 全空；C5/N4 + `keyof` 硬锁 + `Extract<{maxBytes}> = never` 锁绿 |
| 投影渲染器零选项纯函数（`packages/vfsl/**`、`read-schema-projection.ts`） | ADR 0027 决策 2 + ADR 0031 决策 4 | ADR 0027 L29 | **保持**：git diff 全空（实测） |
| 头行文法（readData 面不记 `maxBytes`；窗口面无头行） | ADR 0031 决策 4 + ADR 0027 决策 3 | ADR 0031 L43 | **保持**：canonical 下传 resolver 的 `budget` 恒两轴（`maxBytes` 不进）；readData 剥离机制零改动；G8 头行断言绿 |
| 校验码词表：不新增校验码；唯一预算码 `READ_BUDGET_EXCEEDED`（恰五键） | ADR 0031 决策 1/3 | ADR 0031 L16/L31–33 | **保持**：域违约复用 `WINDOW_OPTIONS_INVALID`；超限复用共享五键成员；`BUDGET_FAILURE_KEYS` 恰五键 |
| 失败优先序阶梯：lifecycle > G0（零 options 读取）> options 校验 > W1 目标/载体 > S3 接缝 > 预算（最后） | ADR 0008 修订节 + ADR 0028 决策 7 + 父票阶梯先例 | ADR 0008 L123；ADR 0028 L65–67 | **保持**：编排实读逐级对应（S1 → S2-G0 → S2-split → S2-W1 → S3 → S6.5）；G10/C3/C6 锚绿（目标/载体失败不被预算吸收） |
| readData 面冻结文案（迁移 `read-budget.ts` 后逐字节不变） | 父票 OBL-WIN-1 镜像基准 + ADR 0031 决策 3 | #405 冻结模板 × read-budget.ts L52–55 | **保持**：模板逐字符一致（三方对照：删除前 runtime.ts 原文 / read-budget.ts / fixture 模板）；构造点同变更集迁引；C8 逐字节锚绿 |
| lease released 冻结三键短路先于透传 + active 期 raw 引用直传 + 单源别名 | ADR 0031 决策 4 + ADR 0028 决策 1 | lease.ts（零 diff） | **保持**：registry `src/**` git diff 全空；G9 released 三键 + get trap 0 次 + lease ≡ runtime 逐字段绿 |
| 公共导出面：`index.ts` 零改动、零新导出名、零新重载、值导出键集恰 `RuntimeWriteFatalError` | ADR 0023 + issue #93 审计 + 模块 AGENTS | index.ts 零 diff 实测；L86–89 实读 | **保持**：预算成员经既有按名导出联合结构可达；导出审计测试全量绿 |
| `maxBytes` 规范域 1..2^53−1 | ADR 0031 决策 1 域句 + 父票 RA-1 | ADR 0031 L16 | **保持**：split/canonical 双处同判据；G5 C-LIMIT 组级判据（`2^53−1` 收 ∧ `2^53`/`2^53+2`/`1e21` 拒）绿 |
| 无预算窗口读逐字节行为 + `#369` 敌意计数锚 4/5 + G0/lifecycle 定序 | ADR 0031 决策 1/4 + 仓内冻结测试锚 | #369 L226–246（未触碰） | **保持**：split 读纪律逐字镜像 + 重派发只读 relay；计数锚族 71 tests 绿（4/5/get-trap-0）；C1/C2/C10 + 全量 5095 绿 |
| `DeepOptional` 类型面 / E1 输出端吸收纪律 | ADR 0031 决策 4 + ADR 0024 决策 2（amendment） | ADR 0031 L43；ADR 0024 L45 | **保持**：vfsl-protocol 零 diff；readData 值面零触碰 |
| 契约冻结锚（`WINDOW_ANCHORS_406`、`TXT_406`、种子、契约测试） | SA6 契约 §12.0/§12.2（验收权威） | SA6 §12.0 表 × fixture 锚表 | **保持（一处授权内装置修订）**：18 锚冻结字节逐值 spot-check 一致；G 组断言零改动；唯一修订 = C7 第二用例装置缺陷原位处置（§3 行 18，SA6 §12.2「原位修订」+ 设计 ALLOW 授权面内，理由注释在案） |

**14/14 全部保持，无一漂移。**

## 6. Evolution requirements

**无待计划的 evolution-required 项。** 本次实现不改变任何既有契约：全部行为在 ADR 0031 决策 1–6 授权面内兑现，或为父票已裁决义务（OBL-WIN-1）的落地；ADR 0028/0029 的 options 词表演进由 ADR 0031 决策 1 显式立法覆盖（修订链状态行在案，CONTEXT.md 词汇已同步）。ADR 0031 登记的合法演进位在当前 diff 中的处置：可选裁剪 `over:'trim'`（未实现，正确——开放问题）；错误载荷拆分分项（未实现，正确——决策 3 登记加法演进位）；where 计数通道（未实现，正确——ADR 0029 演进位）。若未来任一演进位被启动，须携修订计划先送本门禁。

## 7. Hard conflicts

**无。** 逐项核对未发现任何与既有决策不兼容且无合法 override 的实现条款。六个复审焦点结论：

1. **窗口面公共 API 扩张落地形态** = ADR 0031 决策 1/3/4 的忠实落地：六键闭合 interface（成员形态满足 `Equal`/`keyof`/`Omit` 中继锁）、联合追加共享五键成员（`Extract` 双面 ≡ readData 成员）、registry 按名别名零改动自动跟随（G9/T5 绿）；`read-budget.ts` 迁移后 readData 面逐字节不变（模板三方对照 + C8 锚绿）。
2. **DD-1–DD-9 落点选择** = 设计收口值的兑现：S2-G0/S2-split/W1(relay)/canonical 六键镜像（闸门权威 = canonical 复读值）/重派发闭包（re-split + re-W1(relay₂)，A2 备选未复活）/S6.5 在 S6 结算后只读不写——全部与设计 DD 逐条对应，无「另有选择」触发。
3. **十四项冻结面** = §5 表逐项保持，DENY 面 git diff 全空有实测证据。
4. **父票义务兑现** = OBL-WIN-1 三面义务齐备闭合（同构度量/同码同文同载荷/负控/逐字镜像）；G11 前两条断言按 RA-I1 授权原位改写且改写后回退敏感（本报告即 RA-I1 指定的「送门禁复核」落点，复核通过）。
5. **RA-406-1 / RA-406-2** = 双双闭合：计数锚 4/5 parity 实测绿（71 tests）；typed-access.md 窗口 `maxBytes` 词汇同变更集落地且内容逐项对上 SA6 §12.6 台账（清退对象 = 无、纯加法、doc-sync 门禁绿）。
6. **两处测试修订（D-1/D-2）** = 均有明文授权（父票 SA8 RA-I1 / SA6 §12.2 + 设计 ALLOW）、理由在案、断言强度不降反升（G11 五键 + 回退敏感；C7 增 message 域断言）；无 G 组目标语义断言被触碰，冻结锚表逐值一致。

## 8. Required actions

| # | 动作 | 对象 | 阻塞性 | 状态 |
|---|---|---|---|---|
| **RA-406-1**（split/canonical 读纪律 parity） | `#369` 计数锚 4/5 与既有窗口族回归绿 = 实现验收必要条件 | SA3/SA4 实现 | 前次阻塞**实现验收** | **已闭合**（`splitWindowOptions` 逐字镜像实读 + 计数锚族 2 files/71 tests 绿 + 全量回归绿；本次实读复核） |
| **RA-406-2**（OBL-DOC-406-1 兑现监督） | `typed-access.md` 窗口读小节补 `maxBytes` 词汇，同变更集或紧随同迭代；义务关闭前不得宣告完成 | 实现变更集 | 前次阻塞**本票收尾** | **已闭合**（同变更集落地；内容逐项对上台账：同码同文/总量等式/where × 预算三语义/预算不塑形 + 失败词表两词条；doc-sync 门禁 43/43；RA-I3 调用字面约束未触碰） |
| **RA-406-3**（实现后复审） | 按 implementation 复查模式核对设计门禁 §5 十四项冻结面 + DD 落点 + C8 逐字节 + G11 改写复核 | 本门禁 | 流程 | **本次闭合**（§5 表 14/14 保持；§3 十九项裁决；G11 改写复核通过） |
| **RA-406-4**（发布 minor bump 挂账延续） | `@nomicore/namespace-runtime` 公共面加法（六键 options + 联合新成员）不得以 patch 位发布（ADR 0031 验收节「0.x 破坏性 minor」） | 发布流程 | 阻塞**发布**（不阻塞代码交付评审） | open（沿父票 RA-I2） |
| **RA-406-5**（根 `AGENTS.md` 窗口 options 枚举对齐，advisory） | 实现落地后 stale-by-omission 已结晶（实测仍五键枚举）；建议并入下一次文档巡扫（连同 `#405` 遗留 readData 口径、父票 RA-I3 scanner 三键化一并巡检） | 文档巡扫 / 后续票 | 非阻断（advisory） | open |
| 参照（父票挂账，非本票义务） | RA-I2（minor bump，与 RA-406-4 同一件事）/ RA-I3（doc-sync 扫描器 `BUDGET_OPTION_KEYS` 三键化——本票窗口面词汇不涉该扫描器，OBL-DOC-406-1 落地未触其判据）/ RA-I4（CI 终态复跑 + SA4/SA7 动态验证） | 发布/后续票/CI | 非本变更集阻塞 | open（父票挂账） |

## 9. Verdict

**`clear`** —— 十九项对照全部为 no-conflict（10）或 implements-existing-decision（9），无 hard conflict、无需 override、无待计划的 evolution-required。本票为父票 OBL-WIN-1 挂账的**兑现票且兑现闭合**：三面义务（同构度量、同码同文同载荷、`WINDOW_OPTIONS_INVALID` 负控、message 逐字镜像冻结文案）经共享件单源 + 契约锚双保险落地；全部生产改动落在 ADR 0031 决策 4 授权的组合层面；设计门禁 §5 十四项冻结面逐项核对**全部保持**（DENY 面 git diff 全空实测）；两处测试修订均有明文授权（父票 RA-I1 / SA6 §12.2）且断言强度不降反升；RA-406-1（计数锚 parity）与 RA-406-2（OBL-DOC-406-1）均已闭合；G11 改写按父票 RA-I1 送本门禁复核**通过**。剩余事项均为已登记的发布门（RA-406-4）、advisory 文档巡扫（RA-406-5）与父票挂账（RA-I3 scanner / RA-I4 CI 与 SA4/SA7 维度），不含任何须先修订决策才能继续的阻塞。**交付放行。**

## 10. requiresConflictRecheck

**false**。理由：本报告即设计门禁预留的「实现后复查」落点（RA-406-3），四条置 true 理由已逐条闭合——

1. **公共 API 加法已随本次 diff 逐项核对闭合**：两面 options 六键闭合形状 + 两结果联合追加 `READ_BUDGET_EXCEEDED` 共享成员（§3 行 1/4/5、§5 全表）——不存在尚待实现核对的公共 API/wire/schema/持久化/状态机/生命周期/失败语义面；
2. **本票 SA8 前置缺位的冲突基准已整链收口**：SA6 契约（冻结锚 + pins）→ SA1 设计（DD-1–DD-9）→ SA2 → SA3 → 本实现后报告，基准自建且逐环复核完毕；
3. **结构决策 parity 义务闭合**：split/canonical 读纪律与 W1 逐字同构（实读）+ `#369` 计数锚 4/5 复跑绿（RA-406-1）；`read-budget.ts` 迁移后 readData 面 C8 逐字节（模板三方对照）；
4. **OBL-WIN-1 与 OBL-DOC-406-1 均已关闭**（§3 行 7/9、§8）；父票 RA-I1 指定的「G11 前两条断言原位改写并送门禁复核」已由本报告复核通过。

本变更集内无正式 override、无新决策面。剩余义务全部住在**独立未来变更集**且各自自带门禁触发条件：发布 minor bump（RA-406-4 = 父票 RA-I2）、scanner 三键化后续票（父票 RA-I3）、根 `AGENTS.md` 文档巡扫（RA-406-5，advisory）。纯 no-conflict 与既有决策兑现，且实现后复查已闭合——按裁决规则置 false。
