# SA10 Spec 审查 — Issue #406「窗口面同轴：readArray/readMap 的 maxBytes」

- 派发：`sa-a84c04e8-caf6-4cb6-9a98-518c438732f4`（role `mabf-sa10`，phase `spec-review`，iteration 0）
- 审查对象：**已提交最终交付** commit `f1f9cd0dbc6c82fd9138e6eff4584cab6619b0bd`（`feat(namespace-runtime): add window read byte budgets`），父 PR #403 基座 `docs/adr-0031-readdata-byte-budget` 稳定于 `56cf54281574ba15a2c471bb79ea57e813a94868`（= HEAD~1，实测 `git log` 一致）；工作树与该 commit 零 diff（`git status --porcelain` 为空）。
- 审查方式：静态规格核对——经 `gh` 实读 Issue #406 正文与 AC①–⑦、ADR 0031 全文、SA6 契约 rev1（验收权威，18 冻结锚 + G1–G10/C1–C10/T1–T5）、SA1 设计（DD-1–DD-9）、SA2 评审（approve）、SA3 实现报告、SA4 评审（approve）、SA8 设计/实现两道冲突门禁（均 `clear`），并对最终 diff 全量（src 3 文件、契约族 7 文件、2 处既有类型锁延伸、2 处授权内测试修订、typed-access.md 文档）逐面独立核对。按角色约束**未运行测试/服务**；门禁绿证据采纳 SA3 报告与 SA4/SA8 对其实跑日志的独立复读（见 §5-4 披露项）。
- Owner 评论：无（派发说明 REST Issue-comment 快照为空 `[]`；SA6 §2 / 设计 §4 / SA2 §4 / SA8 两道门禁四方一致）——无评论来源义务或 override。

## Verdict

**`approve`** —— Issue #406 正文「What to build」全部要件与 AC①–⑦ **逐条达成**；ADR 0031 决策 1–6 与验收节在窗口面（本票范围面）全部兑现；父票挂账 OBL-WIN-1 闭合、OBL-DOC-406-1 同变更集落地闭合；无遗漏、无部分实现、无错误实现、无 scope creep。须随 PR 披露的未达成/挂账项全部为**已登记的非阻塞递延**（见 §5），不构成本票 AC 的 partial/unmet。

## 1. Issue AC 逐条核对

| AC | 要求 | 交付证据（commit `f1f9cd0`，本次独立实读核对） | 判定 |
|---|---|---|---|
| ① | 两窗口面 `maxBytes` 校验负控（`WINDOW_OPTIONS_INVALID`，message 区分 maxBytes 域） | 六键自持 options interface（`window-read.ts` L90–L107，`maxBytes?: number`）；域判据 `typeof number && Number.isSafeInteger(v) && v >= 1` 双点同判（`runtime.ts` `splitWindowOptions` L1394 + `window-read.ts` canonical L370–L375）；三条窗口面 message 常量走 W1 无码前缀措辞族、含 `maxBytes` 域标识、≠ 未知键文案（L1335–L1343；探测条与 W1 收编条逐字相同）；G5 非法矩阵 ×12 × 两面 + 有效域接受锚（`{maxBytes:1}` 走预算码而非 options 码）+ C-LIMIT（`2^53−1` 收 / `2^53`/`2^53+2`/`1e21` 拒）+ D1 present-undefined ≡ 缺席 + accessor 拒且 getter 零执行 + frozen 宿主接受（red 测试 L204–L278 实读） | **达成** |
| ② | 超限同码同文同载荷；三面（readData/readArray/readMap）报错形态一致性断言 | 共享件 `read-budget.ts` 单源：`readBudgetExceeded` 恰五键 `{ok:false, code:'READ_BUDGET_EXCEEDED', path, measuredBytes, message}`（L88–L100，`path` 经 `echoReadPath` 新鲜回显）；模板 `budgetExceededMessage` 与 #405 基线（`56cf542` runtime.ts 删除前原文）及 fixture `budgetMessageTemplate` **三方逐字符一致**（本次 diff/grep 独立比对）；G3 第二用例实断三面键集·码·message 模板一致（red 测试 L139–L153 实读） | **达成** |
| ③ | ≤ 边界成功；无预算窗口读逐字节回归锚 | S6.5 闸在 S6 结算之后、return 之前只读不写（`window-read.ts` L271–L276），`>` 才拒（恰等收）；成功路径零触碰已组装四键 → 逐字节相同由构造保证；G1（18 锚 `total` 收 ∧ 域顶宽预算收，`toStrictEqual` 无预算读）+ G2（18 锚边界对：`total` 收 / `total−1` 拒且 `measuredBytes = total`）+ G8（宽预算原样、schema 不含 `maxBytes`）+ C1/C10（冻结锚与同运行 oracle 双源复验） | **达成** |
| ④ | where 过滤窗口：超限报错、装满判定不受影响、无静默丢弃 | 闸门**无 where 特殊分支**——`truncated` 双语义与「✂ 永不装配」分支结构先行结算（L257–L263 在闸前）；超限失败成员结构上无 `value` 键（零静默丢弃）；G6 三用例实读：超限同分支（恰五键 + `measuredBytes` = 无预算独立测量）、≤ 侧装满三态保持（WM4 true / WM5 false / WM6 true）+ schema 无 ✂、WM4/WM5 同字节 305 判定相反在预算下各自保持 | **达成** |
| ⑤ | 度量等式在窗口面成立（条目列表 JSON + 元素投影文本，构造性断言） | `deliveryBytes(entries, schema)` = `utf8(JSON.stringify(entries)) + utf8(schema ?? 0)`（read-budget.ts L75–L79；entries 恒数组，组合式记账零镜像代码）；schema 通道 = **最终装配文本**（✂ 窗口事实块 / `‡` 折叠页脚自然计入；`null` 计 0）；G4 三用例：18 锚构造性等式（期望值 = 冻结锚 ∧ 同运行独立两通道测量，绝不消费被测载荷）+ CJK 锚 `utf8 ≠ utf16` 单位敏感 + 双通道锚 `measuredBytes ≠ 任一单通道` | **达成** |
| ⑥ | registry lease 别名锁断言延伸（窗口 options + 结果联合） | registry `src/**` **零 diff**（本次 `git diff 56cf542 f1f9cd0` 实测为空）——`types.ts` L482–L496 纯别名按名自动跟随六键与新联合成员；`lease.ts` L338–L345 released 短路先于 raw 直传不变；G9 行为 4 用例（收/拒 lease ≡ runtime 逐字段、`measuredBytes` 逐字、released 冻结三键 + 敌意 options get trap 0 次、18 锚无预算回归）+ surface test-d T5（别名组合锁、六键 `keyof`、三面同载荷 `Equal`、签名锁）实读在案 | **达成** |
| ⑦ | 包内门禁 + root `pnpm typecheck` / `pnpm test` | SA3 报告：契约族 7 files/45 tests 全绿（落盘时 22 红全转绿）；定点 `--typecheck` 172 files/2125 tests；root typecheck exit 0；root 全量 422 files/5095 tests exit 0（冻结修订复跑二次确认）；#369 计数锚族 71 tests 绿（状态化 4 / 交替 5 / get trap 0）。本次独立可复核部分全部吻合：DENY 面 git diff 全空（实测）、契约文件零 `skip`/`only`/`todo`/`process.env`/`readFileSync`（grep 实测）、fixture 18 锚与 SA6 §12.0 表逐值一致、契约文件落在 `vitest.config.ts` 真实 include 模式内。运行证据日志未随 commit 入仓（见 §5-4 披露）；SA4 评审时对日志独立复读结论一致、SA8 实现门禁采纳为实现后事实 | **达成**（证据链形态见 §5-4；CI 终态复跑为已登记流程项） |

## 2. Issue「What to build」要件核对

| 要件 | 交付 | 判定 |
|---|---|---|
| options 追加同形 `maxBytes`（≥1 有限整数；非法 → `WINDOW_OPTIONS_INVALID`） | 两面六键闭合 interface；split（raw 第一读者）+ canonical（闸门权威复读值）双处同判据；域/accessor/探测期违约前置 `WINDOW_OPTIONS_INVALID` 恰四键；W1 保持五键/未知键/宿主判据与 message 单源（split 对其余键 descriptor 原样复制中继） | 达成 |
| 总量 = 条目列表（含 key/index 包装）紧凑 JSON + 元素口径投影文本 UTF-8（✂/头行自然计入） | `deliveryBytes` 两通道合计；✂/`‡` 在最终文本内自然计入；窗口 schema 本无头行（头行计字条款结构空转，非豁免）；`schema:null` 计 0 | 达成 |
| 超限 → 同码同文同载荷 `READ_BUDGET_EXCEEDED`（`path` = 窗口目标路径、`measuredBytes` 合计） | 共享构造器恰五键零交付；path 新鲜回显（深等实参、非同一引用、事后变异不影响——G3 锚）；`measuredBytes` 只报合计不拆分 | 达成 |
| ≤ → 成功，交付物与无预算窗口读逐字节相同 | 闸门透明（只读不写、不超限时零短路）；G1/G2/G8 + C1 双源锚定 | 达成 |
| where 过滤窗口三语义（同分支 / 装满判定不受影响 / 无任何静默条目丢弃） | 结构保证（闸在 S6 后、无 where 分支、失败无 `value` 键）+ G6 三用例 | 达成 |
| lease 别名跟随 | registry 零代码改动按名跟随（ADR 0031 决策 4 的兑现形态） | 达成 |
| Blocked by #405 | 解除：HEAD~1 = `56cf542`（#405 落地提交），共享基建（度量/失败分支/类型形状）在位并经本票迁入 `read-budget.ts` 单源化 | 达成 |

## 3. ADR 0031 与适用规范核对

| 条款 | 交付核对 | 判定 |
|---|---|---|
| 决策 1（三读面 `maxBytes` 域句；各面既有码；不新增校验码；缺席 ≡ 不设预算） | 窗口面复用 `WINDOW_OPTIONS_INVALID`（域/accessor/探测三违约同码）；零新码；域 = 1..2^53−1 未重开（C-LIMIT 锚）；缺席/present-undefined/非 enumerable ≡ 无预算（C4/D1 锚） | 达成 |
| 决策 2（窗口同构度量；塑形后计量；账本不进公共面） | 度量对象 = 塑形后交付物（闸在 ✂/`‡` 装配后）；成功面恒四键不加 bytes 键（T 锁 + G1 恰四键断言） | 达成 |
| 决策 3（超限零交付；五键；合计；≤ 收；三面同码同文同载荷形；不裁剪不降深不拟合） | 全部兑现；模板单源唯一（grep 实测 src 无第二模板）；readData 构造点同变更集迁引共享件、行为与文案逐字节不变（C8 锚绿；迁移前后函数体 diff 比对一致） | 达成 |
| 决策 4（组合层落点；doc-runtime 零改动；registry 别名跟随；零变化清单） | 生产改动恰三文件（`runtime.ts`/`window-read.ts`/新建 `read-budget.ts`）；`packages/doc-runtime`、`packages/vfsl`、`read-schema-projection.ts`、registry src、`index.ts`、CONTEXT.md、docs、protocols **git diff 全空**（本次独立实测）；W1 直下传 relay 保持五键视野 | 达成 |
| 决策 5（where 无对撞：无静默丢弃、装满判定永不说谎、✂ 永不装配） | 见 AC④；G6/C9 锚 | 达成 |
| 决策 6（指引进 typed-access 纪律与作用域文档） | OBL-DOC-406-1 **同变更集闭合**：typed-access.md 窗口读小节新增「Byte budget on windows: `maxBytes`」三段（同码同文同载荷 / 域 / 总量构成 / ≤逐字节与>零交付不塑形 / where×预算三语义 / 定序 / 确定性重试）+ `WINDOW_OPTIONS_INVALID` 词条补域外 `maxBytes` + 失败词表补 `READ_BUDGET_EXCEEDED` 条（diff 实读）；CONTEXT.md L54 已声明三读面（零 diff 正确）；`docs/integration/*` 仅述 readData 面（零 diff 正确） | 达成 |
| 验收节（主接缝 / 度量 property / lease 透传断言 / 文档负控 / 门禁） | 逐条有 G/T/C 组与门禁对应（§1 表） | 达成 |
| 验收节「发布随 minor bump（0.x 破坏性 minor）」 | 未随代码变更集落地（`namespace-runtime` 版本未动）——SA8 登记 RA-406-4：阻塞**发布**、不阻塞代码交付评审 | **挂账（须披露，见 §5-1）** |
| ADR 0028/0029（恒四键、三稳定码、结算双语义、✂ 永不装配、组合层纪律） | S5/S6 结算逻辑 diff 零 hunk；三码族复用零新增；分层不动 | 达成 |
| ADR 0027/0024（修订链后；渲染器零选项纯函数；头行/✂ 文法；`DeepOptional`） | 渲染器与 vfsl 零 diff；窗口面无头行结构不可触及；readData 值面/类型面零触碰 | 达成 |
| ADR 0008 + 三包 AGENTS（读不进 sequencer、同步联合、lifecycle 稳定码、detached 投影、公共面仅经 index.ts） | 编排实读：S1 lifecycle 先行（零 options 读取）→ S2-G0 → split → W1(relay) → S3 → S6.5；全同步、零状态写入、零 sequencer；registry/doc-runtime src 零改动；`index.ts` 零 diff（零新导出名、值导出键集仍恰 `RuntimeWriteFatalError`） | 达成 |
| 敌意面/计数锚 parity（#369 锚 4/5；RA-406-1 实现验收必要条件） | `splitWindowOptions` 读纪律与 W1 `validateWindowOptions` 逐字同构（`Object.keys` + 每键恰 1 次显式 descriptor、零 `[[Get]]`、宿主门 relay=raw、try 收编）；重派发闭包 = re-split + re-W1(relay₂)（W1 只读 relay——A2 否决面未复活）；SA3 实跑 71 tests 绿；SA4 静态重推导一致 | 达成 |

SA8 实现后冲突复审（`task_issue-406_implementation_conflict_report.md`）裁决 **`clear`**：十九项对照 no-conflict 10 / implements-existing-decision 9，hard-conflict 0、override 0；设计门禁 §5 十四项冻结面逐项保持；RA-406-1/RA-406-2/RA-406-3 闭合；`requiresConflictRecheck = false`。本 SA10 独立核对与其结论一致。

## 4. 测试修订与评审发现核对（均不阻断）

| # | 事项 | 授权链与有效性 | 判定 |
|---|---|---|---|
| D-1 | `issue-405-maxbytes-control.test.ts` G11 前两条断言原位改写（窗口面 `WINDOW_OPTIONS_INVALID` 四键 → `READ_BUDGET_EXCEEDED` 五键，键集复用 `BUDGET_FAILURE_KEYS` 单源常量） | 父票 SA8 实现门禁 **RA-I1** 明文「届时原位改写并送门禁复核」+ 本票 SA8 RA-406-3 指定复核点；改写后断言对「窗口面退回 maxBytes≡未知键」**回退敏感**；无预算窗口读与 doc-runtime 直调断言零改动（diff 实读）；落在本票设计 ALLOW 之外属设计文档登记缺口（SA4 O-1），已有上游逐字授权兜底 | 授权内有效修订，不阻断 |
| D-2 | `issue-406-window-maxbytes-control.test.ts` C7 第二用例装置原位修订（实参 `maxBytes:1` → 域外 `maxBytes:0`，并**增强** `toContain('maxBytes')` 域断言） | 契约自相矛盾型装置缺陷（`maxBytes:1` 域内合法，按 G5 必走预算码——原断言在任何满足 G 组的实现上不可成立；矛盾论证在案）；SA6 §12.2「实现方沿用/原位修订」+ 设计 ALLOW 授权；用例意图（敌意宿主 + 零 `[[Get]]` → 响亮 options 码）与判据结构零弱化；G 组目标语义断言零触碰 | 授权内有效修订，不阻断 |
| 类型锁原位延伸 ×2 | `issue-369-window-read-lease-surface.test-d.ts`、`issue-383-window-where-type-guard.test-d.ts`：纯别名 `Equal` → `Omit<…,'maxBytes'>` 中继锁 | SA6 §12.2 登记的既有锁延伸（锁期望跟随已登记演进链；diff 内容恰为契约记载形态）——双向防倒灌/防丢失，非弱化 | 不阻断 |
| SA2 O-1–O-4 / SA4 O-1–O-5 | 计数笔误、根 AGENTS.md 枚举 stale（→RA-406-5）、`JSON.stringify` 包裹性同阶备案、三处签名联动单元、G5 字面键集冗余、`{} as O` 单点断言 | 全部经 SA4/SA8 复核为观察级；无未落实的 Required revisions（SA2/SA4 的 Required revisions 均为空表） | MINOR，不阻断 |

未发现以源码字符串断言、skip/only、env override 或装置改动吸收红灯的伪绿；红灯契约 22 用例（18 行为红 + 2 巧合绿 + 2 类型红）断言原文保持（fixture 冻结锚与 SA6 §12.0 逐字节一致），实现后转绿的证据链为 SA3 实跑 + SA4 独立复读。

## 5. 必须随 PR 披露的未达成/挂账项（均为已登记递延，非本票 AC 缺口）

1. **RA-406-4（发布门）**：ADR 0031 验收节「发布随 minor bump（0.x 破坏性 minor）」——`@nomicore/namespace-runtime` 版本未随本变更集 bump；本票公共面加法（六键 options + 结果联合预算成员）不得以 patch 位发布。阻塞**发布**，不阻塞代码交付（沿父票 RA-I2 同款挂账）。
2. **RA-406-5（advisory 文档同步项）**：根 `AGENTS.md` Nomicore 集成段仍以签名形态枚举窗口 options 五键（少 `maxBytes`；readData 描述自 #405 起同样未补）——SA8 裁定非决策义务、不阻断收尾；建议并入下一次文档巡扫（连同父票 RA-I3 doc-sync 扫描器 `BUDGET_OPTION_KEYS` 三键化一并处理）。不宜长期悬空。
3. **SA7 活链路动态验证与 CI 终态复跑待执行**（SA3 §Deferred #5、SA4 §11、父票 RA-I4 同款流程项）：门禁绿证据为 SA3 本地实跑，SA4/SA8 已独立复读日志确认；CI 复跑为合并/交付流水线事项。
4. **运行证据日志与 Host 简报未入仓（本 SA10 新增登记，MINOR）**：SA3 验证表引用的 `artifacts/sa3-issue406-*.log`（contract-family / focused-typecheck / full-test-final / root-typecheck / r1-counting-anchors / scope-diff）与 SA6 §13/§16 引用的 `artifacts/sa6-issue406-*.log` 均未包含在 `f1f9cd0` 且当前工作树不存在；Host 简报 `wiki/raw/task_issue-406.md` 亦未入仓（父票 #405 的 commit 含 10 份 artifacts 日志与 `task_issue-405.md`——本票与该留存惯例不一致；SA6 §16 曾明示其日志「不入分支提交」）。门禁绿的结论由三份已入仓的独立产物（SA3 报告 + SA4 评审 + SA8 实现门禁）交叉佐证，本 SA10 对可静态复核部分（DENY 零 diff、冻结锚、断言形态、卫生项、模板三方逐字符一致）全部独立重核通过；但原始运行日志无法从分支状态独立重验，CI 终态复跑（§5-3）即最终兜底。
5. **ADR 0031 登记的演进位（正确未实现，非缺口）**：可选裁剪 `over:'trim'`（开放问题）、错误载荷拆分值/口径分项（决策 3 登记加法演进）、where 计数通道（ADR 0029 演进位）——维持登记状态，启动时须先送 SA8 门禁。

## 6. 范围与改动面核对

- diff 全量 21 文件：生产 src 恰 3 文件（ALLOW 内）；契约族 7 文件（SA6 §12.2 清单沿用）；既有锁延伸 ×2 + 授权测试修订 ×2（§4）；文档 1 文件（OBL-DOC-406-1）；wiki/raw 流程产物 7 份。
- DENY 面零 diff（本次独立实测 `git diff --stat 56cf542 f1f9cd0 -- <DENY 路径>` 全空）：doc-runtime / vfsl / 渲染器 / registry src / `index.ts` / CONTEXT.md / docs / protocols / apps / domains / vitest.config.ts / tsconfig.base.json / package.json。
- 无 scope creep：全部改动可回溯到 Issue 正文、SA6 契约、设计 ALLOW 或上游 SA8 明文授权（RA-I1 / RA-406-2）；readData 面共享件迁移为行为零变化的单源化收敛（OBL-WIN-1 三面同文义务的结构前提），非目标扩张。
- 目标无静默扩大：非目标清单（不裁剪/不拆分载荷/不新增校验码/不改 doc-runtime/不动选窗物化纪律/不承诺演进位）与交付逐条对齐。

## 7. 附：与既有评审/门禁的关系

- 本文件为该 slug 首份 SA10 规格审查（glob 复核无既往 `task_issue-406_sa10_spec.md`）。
- 职责边界遵守：未修改任何代码/设计/测试，未运行测试或服务，未调度其他 SA；通用架构风格与仓库规范维度归 SA9，本报告不重复裁决。
- 结论：`approve`。关键 AC 无 partial/unmet/unachievable；§5 五项均为已登记的非阻塞递延或 MINOR 披露项。
