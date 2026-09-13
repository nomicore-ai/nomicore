# SA2 设计攻击评审 — issue #369 W2：lease 公共面 `readArray` / `readMap`（ADR 0028）

- 评审对象：SA1 冻结设计 `wiki/raw/task_issue-369_design.md`（**iteration 1 修订版**——F-1 修订轮；
  基线 worktree `/home/wangjian/nomicore-fix-issue-369`，HEAD `ab6e390`，零代码零测试落盘）。
- 评审轮次：**iteration 1**（对 iteration 0 `reject` 的 F-1 复审 + 全维度再攻击）。
- 评审方式：独立全维度攻击——设计声明逐条对照 ADR 0028/0027/0024/0016/0008/0009 原文、
  模块 AGENTS、CONTEXT 词条与 HEAD 源码，不接受设计自述为证据。本轮重点：F-1 修订的
  源码级核验（orderBy field 折叠规则 + W2-T 敌意 field 用例充分性），以及冻结面在修订后
  保持正确完备的确认。

## Reviewed inputs

| 输入 | 状态 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-369.md`（Host brief） | 在场 | 需求源（What-to-build + AC1–AC6；评论数 0） |
| `wiki/raw/task_issue-369_design.md`（SA1 冻结设计 **iteration 1**） | 在场 | 被审对象（F-1 修订版） |
| `wiki/raw/task_issue-369_sa2_review.md`（本文件 iteration 0 版） | 在场（已被本轮原位更新取代） | 前轮 reject 依据（唯一 MAJOR = F-1）与验收标准 |
| `wiki/raw/task_issue-369_sa6_contract.md`（SA6 诊断与验收契约，verdict approve 附冻结条件） | 在场 | 上游义务（§12.1 B-1–B-11、§15-1 B-6 裁决、§15-3 计数路径） |
| `wiki/raw/task_issue-369_design_conflict_report.md`（SA8 设计后冲突复查，iteration 0，verdict `clear`） | 在场 | SA8 冲突门禁结果（对 iteration 0 设计执行；本轮修订的重查处置见 §15 对账） |
| `wiki/raw/task_issue-368_design.md` / `task_issue-368_sa10_spec.md` | 在场 | W1 冻结面移交（kept/total 否决 L358–360、成功面恰两键） |
| `docs/adr/0028-window-read.md`、`0027-readdata-projection-text.md`、`0024-readdata-shape-budget.md`、`0016-readdata-semantic-schema-projection.md`、`0008-namespace-runtime.md`、`0009-namespace-registry-leases-and-host-lifecycle.md` | 已读 | 规范权威 |
| `packages/{doc-runtime,namespace-runtime,namespace-registry,vfsl}/AGENTS.md`、`docs/AGENTS.md` | 已读 | 模块边界与文档纪律（本轮经系统注入再确认：读不进 sequencer、公共 API 仅经 src/index.ts、载体机制归 doc-runtime、vfsl 冻结面） |
| **本轮源码重点核验**（SA2 独立实读）：`doc-runtime/src/window.ts` L44–131（options 类型联合 + 成功面恰两键 + 公共入口）、**L300–371（`validateOrderBy` 全函数——L343 dir 闭合 asc\|desc、L353 by 闭合 index\|key、L363–367 field 仅 `typeof==='string'` 且原样入 `NormalizedTerm`、L366 仅 map 面收 field）**；`namespace-runtime/src/read-schema-projection.ts` L115–177（**foldSegment L175–177 与 L127–128「行注入防御」注释逐字核验**、headLine、ownAxis）；`vfsl/src/render-projection-text.ts` L60–63（`TRUNCATION_FOOTER`/`TRUNCATION_HEADER='✂ 截断事实：'` 常量）、L140–168（块拼装 `\n\n` + 尾恰一 `\n`、truncations 块居末）、L317–340（`validateTruncations` kind 闭合 depth\|width）、L975–1002（`foldText`、`firstLineText`、✂ 行文法与**空路径 `[]` 约定 L998**）；`foldSegment` 全仓 grep（src 私有 + 三个既有测试文件本地拷贝先例） | 逐项核实 | **F-1 修订证据锚点真伪** |
| 测试面核验（iteration 0 已全量、本轮抽查保持）：4 处键集守卫、`readdata-ok-shape.ts` helper、`readdata-shape-assertion-scan.ts` 扫描域（runtime+registry 两树）、readData 字节锚、3 个接口 `.test-d.ts`、vitest include、apps/yjs-server 消费面 | 逐项核实 | 调用方与验收义务完备性 |
| SA6 探针日志 `artifacts/sa6-issue369-*.log`（12 件在场） | 在场 | B-6 实证基础（iteration 0 已独立复核 anchor.*/equiv.* 段） |
| Owner 评论 | 0 条（dispatch 明示 REST 读为空） | 无条款需映射 |

## Verdict

**approve** —— iteration 0 的唯一 MAJOR（F-1）**已落实并通过源码级核验**：
B-8 现对全部四个插值槽（pathText/basis/dir/kept-total）给出确定性渲染规则，
`field:<单段名>` 槽的 field 名经与 pathText 同款 `foldSegment`
（`replace(/\r\n|\n|\r/g, ' ').trim()`——仓内既有行注入防御纪律，源码逐字核验一致）
折叠后拼入 `field:` 前缀，且冻结「✂ 窗口事实块恒头行 + 恰一行事实行、不可经任何
插值槽注入换行」不变式；W2-T 增补敌意 field 名边界用例（`\n`/`✂`/行首 `- ` 三类
结构字符载荷 + 单行断言 + 值通道不受折叠影响断言 + Byte 冻结），满足 iteration 0
开出的全部验收标准。修订面严格限于呈现规则（canonical 项与 S2 值通道保持 raw），
锚链（B-6）、计数路径（§7.4）、分层、键集义务（B-11）、失败面（B-4/B-10）等承重
裁决零变化，经本轮再攻击全部保持成立。O-1/O-2 顺带钉死。

## F-1 修订核验（本轮重点 1：orderBy field 文本是否被安全折叠）

| 核验点 | 设计声明（§7.1 B-8 / §7.3 S6） | SA2 独立源码核验 | 结论 |
|---|---|---|---|
| 敌意面真实存在（否则 F-1 无的放矢） | W1 `validateOrderBy` 对 field 仅 `typeof === 'string'`，含换行/`✂`/行首 `- ` 者通过且原样入归一化项 | `window.ts` L363–365：`if (typeof field !== 'string') return {ok:false,…}`——唯一检查；L367 `return { ok:true, term:{kind:'field', field, dir} }`——raw 原样入 `NormalizedTerm`；L366 仅 map 面收 field | ✅ 属实 |
| 折叠规则与仓内纪律同款 | `replace(/\r\n|\n|\r/g, ' ').trim()`（foldSegment/foldText 同款） | `read-schema-projection.ts` L175–177 与 `render-projection-text.ts` L984–986 两处实现**逐字符相同**；L127–128 注释即名「行注入防御」 | ✅ 属实 |
| 折叠施加点与语义边界 | S6 ✂ 装配点施加；纯呈现规则——canonical 归一化项与 S2 值通道保持 raw field 名（排序下钻语义不受折叠影响） | 与 W1 结构一致：`windowCore` 消费 raw options（L114/L128 raw 引用透传），折叠只在组合层文本装配发生——不存在「先折叠再选窗」的实现歧义（W2-T 值通道断言锁定） | ✅ 成立 |
| 「对 field 名全程折叠 ≡ 对全槽折叠」等价论证 | `index`/`key` 系 W1 校验闭合字面、`field:` 前缀系常量 | L353–354：by 恒 `'index'|'key'`（其它值拒）；L343：dir 恒 `'asc'|'desc'`（其它值拒）；前缀与 `index`/`key` 字面无换行能力——等价论证成立 | ✅ 成立 |
| 伪造目标与防线闭合 | 不变式：块恒「头行 + 恰一行事实行」，敌意 field 名不可伪造第二个 `✂ 截断事实：` 头或伪造事实行 | 伪造目标 `TRUNCATION_HEADER='✂ 截断事实：'`（L63）只能经换行拆行才能成为新行首——折叠消灭全部 `\r\n/\n/\r` 后，任何残余 `✂`/`- ` 只能滞留单行内部（inline 呈现残差，与 pathText 段含 `·`/`.` 同类、ADR-0027 已知限制 1 的呈现不承诺 round-trip 同族）；`validateTruncations` kind 闭合（L332–333）使窗口行不经渲染器第二参、组合层追加是唯一路径——SA8 §3.2 结构论证保持 | ✅ 成立 |
| 槽① pathText（顺带复核） | 逐段 foldSegment + `.` 连接；空路径取渲染器 ✂ 行约定字面 `[]` | `render-projection-text.ts` L997–998 逐字核验（`entry.path.length === 0 ? '[]' : …`）；头行空路径空串分叉（`read-schema-projection.ts` L145）已被 B-8 显式钉死取 `[]`——O-1 消解 | ✅ 成立 |
| 槽③④（顺带复核） | dir ∈ asc\|desc（W1 闭合词表，归一化缺省 asc）；kept/total 非负整数 `String()` | L343/L324（缺省 `dir='asc'`）；kept = `w.value.length`、total = 计数产物，均数值无换行能力 | ✅ 成立 |

**结论：orderBy field 文本已被安全折叠进窗口事实文法**——四个插值槽全部有确定性
渲染规则，无任何消费方可控字符串能以未折叠形态进入 ✂ 窗口事实块。

## F-1 修订核验（本轮重点 2：敌意 field 测试义务是否充分）

iteration 0 开出的验收标准：① B-8 文法对全部四个插值槽均有确定性渲染规则；
② W2-T 含敌意 field 名用例且断言输出单行。逐项对照修订后的 §12 AC3/W2-T：

| 义务要素 | 修订后设计（§12 AC3 行） | 充分性评估 |
|---|---|---|
| 载荷覆盖 | `orderBy:{field:'x\n✂ 截断事实：\n- p.0 · depth · 省略 999 项'}`——单载荷同时覆盖 `\n`、`✂`、行首 `- ` 三类结构字符（恰好是伪造头/伪造行所需的全部结构材料） | ✅ 充分：伪造能力 = 换行（拆行）+ 头常量（`✂ 截断事实：`）+ 事实行前缀（`- `）；三者同场即最坏情形 |
| 触发面正确 | `readMap` 面（W1 仅 map 面收 field——L366 核验） | ✅ 唯一可达面，无漏面（readArray 面拒 field 属 W1 #368 既有契约） |
| 前置条件 | kept<total 使 ✂ 块在场（T 族期望「✂ 行含 `窗口`、基/方向 token、kept n/total N」同场锚定块在场性；schema 为 path 键控、与 field 无关，正文非 null 不受载荷影响） | ✅ 非空转：块在场性经 `窗口`/基/方向 token 断言锚定，敌意用例继承同 fixture 同期望，结构性排除 vacuous green |
| 结构断言 | ✂ 窗口事实块仍为头行 + 恰一行事实行；schema 文本中无第二个 `✂ 截断事实：` **行**；无换行拆行的伪造事实行；field 名折叠为空格连接形态进基槽 | ✅ 行锚定（line-anchored）断言正确——inline 残差（同滞单行内的 `✂`/`- `）非结构性伪造、不承诺清除（与 pathText 段呈现纪律同族）；「折叠为空格连接形态」同时锁定折叠函数行为 |
| 值通道非污染 | 值通道按 raw 名正常选窗/排序（不受折叠影响） | ✅ 关键补强：锁定「纯呈现规则」——任何把折叠提前到 W1 之前（改变选窗语义）的实现必红 |
| 冻结强度 | B-8 冻结后升 Byte 级断言（测试内单点常量） | ✅ 折叠 regex 的三分支（`\r\n`/`\n`/`\r`）行为随 Byte 冻结整体锁定 |

**结论：敌意 field 测试义务充分**——超出 iteration 0 最低验收标准（增补了值通道
非污染断言与 Byte 冻结强度）。残余仅一处卫生建议（见 N-3：载荷可顺带加 `\r`/
`\r\n` 变体直击 regex 另两分支——Byte 冻结已间接锁定，非阻断）。

## 需求覆盖

| Requirement | Design section | Assessment |
|---|---|---|
| 恒四键 `{ok,value,schema,truncated}`；`value` = 条目列表（身份随行）；`truncated === kept < total` | §7.1 B-4/B-9、§7.3 S6 | ✅ 成立（iteration 0 核验保持：S6 返回恰四 own 键字面量；helper 键集断言；收敛门扫描域覆盖 runtime+registry 两测试树） |
| schema = 元素口径投影文本：入选项类型块 + docs；`{index\|key,value}` 包装不进口径；路径键控与数据无关；空容器照常返回 | §7.2 B-6/B-7、§8.1 | ✅ 成立（B-7 D1 无头行 + B-6 锚链；iteration 0 已探针级复核，本轮修订未触碰） |
| 封闭对象 map 的元素口径可满足性 | §7.2 专项裁决 | ✅ 保持成立（容器回退锚链；iteration 0 SA2 独立重算与 SA6 探针/SA8 §3.1 互证；本轮无变化） |
| ✂ 窗口事实段：`kept n/total N` + 基与方向；total=0 无 ✂、truncated:false | §7.1 B-8、§7.3 S6 | ✅ **本轮由 ⚠️ 升为 ✅**：B-8 四插值槽确定性渲染 + 单行不变式冻结（见上两节核验） |
| 组合式 depth 等价锚：窗口项 ≡ 同预算 `readData(项路径)` | §7.3 S2 直通、§12 W2-E | ✅ 成立（W1 M 段同预算物化；SA6 §9-3 equiv.* 全 equal；W2 零改制；折叠为纯呈现不触值通道——本轮新增核验） |
| 失败面直通 W1 三码（形状语义不变） | §7.1 B-4、§7.3 S2 | ✅ 成立（绝不吸收与 readData 缺席吸收成对方向相反；fail-fast 无半窗） |
| registry lease 类型别名与透传跟随 | §7.1 B-5/B-10、§8.1 | ✅ 成立（`_readAlias`/`_readBudgetAlias` Equal 锁先例；released 短路先于透传） |
| 作用域文档同步（typed-access / cordis-plugin-hosting 窗口读消费段 + 分工句） | §11 文件面 | ✅ 成立（两文档锚点节在场；R1 封闭对象披露句已课入文档面义务 = N-2） |
| 非目标：doc-runtime/readData/ADR-0024 options/wire/持久化/诊断零改动；ADR 0028 开放问题不裁决 | §1 非目标、§11 DENY LIST | ✅ 成立（F-1 修订不扩文件范围——§11 注记核验：折叠逻辑落已列 window-read.ts、敌意用例落已列 lease 契约测试） |

## Owner评论覆盖

| Comment ID | Updated at | Design section | Assessment |
|---|---|---|---|
| （无评论） | — | — | Issue #369 评论数 = 0（dispatch 原文明示 REST 读为空）。设计 §4 如实记录，无虚构条款。✅ |

## 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| SA6 §12.1 绑定表 B-1–B-11 全量冻结 | §7.1 全表 + §7.2 B-6 裁决 + §7.4 计数路径 | ✅ 逐条在场（B-8 本轮增补折叠规则后仍为单条冻结值，未裂解表结构） |
| SA6 §15-1：B-6 可满足性裁决 | §7.2 三候选 + 冻结规则 1–4（本轮 +O-2 对称从句） | ✅ 保持；对称从句补入消除实现期疑虑 |
| SA6 §15-3 / §12.7-1：total 不得借全量 readData 计数、doc-runtime 零改动 | §7.4 组合层 O(N) 标识枚举 | ✅ 保持（E3 毒值哨兵锚定） |
| SA6 §12.6-3：新用例四键形状经集中化 helper | §10 收敛门行 | ✅ 保持 |
| SA8 冲突门禁 verdict `clear`（19 项对照） | 设计 §6/§15 对账 | ✅ 保持；F-1 修订后的重查处置见下「本轮再攻击」第 7 点 |
| SA8 RA-1–RA-5 实现期义务 | §11/§12/§13 落点 | ✅ 全部落点（RA-5 B-8 Byte 冻结因 F-1 修订而更实） |
| ADR 0008/0009、模块 AGENTS 边界 | §7.3 S1、§9、§8.1、§11 | ✅ 保持（本轮经模块 AGENTS 注入再对照：读不进 sequencer、公共 API 仅经 src/index.ts、lease 代理条款均吻合） |

## 设计内部一致性

- §7.1 绑定表 ↔ §7.3 编排 ↔ §8.1/§8.2 类型与数据流 ↔ §11 文件面 ↔ §12 验收 ↔ §14 修订映射
  逐项交叉一致；F-1 修订的六个落点（B-8、S6、§8.2 ✂ 行、§12 AC3、§2 锚点两行、§13 R3 澄清）
  相互引用一致，无「附录承认但正文未改」的伪修订。
- §13 R3 新澄清自洽：折叠只保证事实行**结构不可伪造**（恒单行、无注入），不保证基描述与
  实际选窗基一致（后者 = canonical 残余既有范围，与 readData 头行同等处置）——诚实、不越权承诺。
- §14 修订映射逐条对得上 iteration 0 的 finding 清单（F-1 + O-1…O-6），无遗漏、无新增未映射变更。
- 未发现死引用、旧 API、前后相反描述。

## 状态机与并发攻击

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| SM-1 | runtime lifecycle = closing/closed | 调 readArray/readMap | `RuntimeReadDisabledResult`（同步、非抛、零 options 读取、零 doc 触碰） | 无 | 无 |
| SM-2 | lease released | 调任一窗口方法 | 冻结 `NAMESPACE_LEASE_RELEASED` issue，先于一切透传 | 无 | 无 |
| SM-3 | active 同步调用内 | S2 物化 → S4 计数 → S5 锚解析交错 | 三跳同快照（JS 单线程 + 写/apply 经 sequencer 异步槽） | 无 | 无 |
| SM-4 | active 但 schemaState ≠ ready | 窗口读成功路径 | 值通道照常四键；schema:null | 无 | 无 |
| SM-5 | 重复调用/重试 | 任意失败后重试 | 纯读零副作用、幂等 | 无 | 无 |
| SM-6 | released 后 release 再调用 | release 幂等语义 | 沿 lease 既有语义 | 无 | 无 |

（iteration 0 六项攻击全部保持成立；F-1 修订不触任何状态面——折叠是装配期纯函数变换。）

## 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| ER-1 | W1 失败（三码 + PATH_NOT_ALLOWED） | S2 原样透传，绝不吸收、无半窗 | 低 | 无 |
| ER-2 | 敌意 options 视图不稳定 | canonical 重读失败 → 重派发 W1；竟接受 → 接缝终态 `WINDOW_OPTIONS_INVALID` | 低 | 无 |
| ER-3 | 计数镜像意外（防御位） | 坍缩 `PATH_NOT_ALLOWED` + 内部不一致 message | 低 | 无 |
| ER-4 | 锚解析失败（无 schema/偏离/敌意 path/异形） | `schema:null` 照常四键 | 低 | 无 |
| ER-5 | `schema:null` × `truncated:true` | 窗口事实仅剩布尔（R4 如实登记） | 低 | 无 |
| ER-6 | 项级值通道截断事实不可得 | B-7 不携带（R5 登记；depth 经 `‡` 可观察） | 低 | 无 |
| ER-7 | canonical 残余（双读间自洽漂移） | 值通道正确、✂ 行基可能失真（R3 + 本轮结构/真值边界澄清） | 低 | 无 |
| ER-8（本轮新增） | 敌意 field 名进入 ✂ 装配 | **B-8 ② 折叠后渲染**：换行折叠 + trim，块恒单行；inline 残差滞留单行内部非结构性伪造 | 低（原 F-1 洞已闭合；源码级核验见上） | 无 |

## 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| lease 13→15 键 / runtime 12→14 键（纯加法） | 无遗漏（4 处键集断言全在 ALLOW；apps/yjs-server 无键集断言、无窗口名引用——iteration 0 全仓 grep） | grep 实证 | 无 |
| 值导出面不变 | 无（exports-audit 仅断言值导出；type-only 追加不可见——N-6） | 实读 | 无 |
| readData 既有调用方 | 逐字节不变有测试锚（int-range 字节断言等；共享件抽取漂移即红） | 实读 | 无 |
| W1 既有契约（#368） | doc-runtime 全包 DENY；S2 只消费 raw | window.ts L98–100/L109–131 本轮再读 | 无 |
| 类型消费方 | 3 个 `.test-d.ts` + registry index 类型块同步 +2 | 实读 | 无 |
| 形状断言收敛门 | 新用例必须经 helper（扫描域两树） | 实读 | 无 |
| **✂ 窗口事实的文本消费方**（本轮新增行） | 无：单行不变式使任何按行解析 ✂ 段的消费方（含把 `✂ 截断事实：` 行首视为段头的解析器）不可能被敌意 field 名欺骗出多行/多头结构 | B-8 ② + `TRUNCATION_HEADER` 常量 + 折叠 regex 三分支全覆盖 | 无 |

## 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| 载体级选窗原语 | doc-runtime | W1 在位；W2 零改动 | ✅ |
| 组合选窗 + 元素口径投影文本 + 四键结算 | namespace-runtime | 新 `window-read.ts` + runtime.ts 闭包 | ✅ |
| lease 公共面与类型别名 | namespace-registry | types.ts + lease.ts + Equal 锁 | ✅ |
| ✂ 行注入防御 | 呈现层（组合层装配点） | B-8 ② 折叠施加于 S6 装配 | ✅ 归属正确：与 read-schema-projection 头行折叠、渲染器 foldText 同层同款（消费方可控字符串进文本行前必折叠——仓内纪律三处一致，本轮第四处镜像） |
| 候选计数 | （无 ADR 指派层） | 组合层镜像（§7.4） | ✅ 张力如实登记 R2 + 防线（iteration 0 裁定保持） |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| 消费方可控字符串进投影文本行的折叠 | `foldSegment`（头行 pathText，src 私有）+ `foldText`（渲染器 ✂ 行/口径 first-line）；三个既有测试文件本地拷贝 `foldSegment` | B-8 ② 对 field 名施加同款（规则冻结 = regex 本身，非符号导入） | 一致 | 冻结规则而非符号与仓内先例吻合（src 私有 + 测试本地拷贝是既有形态；见 N-4 卫生建议） |
| lease 读透传 / runtime 读组合 / 接缝失败构造 / 追加 lease 成员 / 文档消费段 | iteration 0 表五项 | 同款 | 一致 | 无变化 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| options 类型与失败类型 | doc-runtime | type-only 别名 + Equal 锁 | 低 |
| options 合法性 | W1 OPT 单权威 | `canonicalWindowBudget` 只净化 | 低 |
| 候选条目空间 | W1 D6 枚举 | 镜像计数（出处标记） | 中——R2 登记 + 防线（保持） |
| schema 文本 | vfsl 渲染器 | 组合层追加 ✂ 窗口块 | 低——kind 闭合 + AC2 oracle（保持） |
| **折叠规则**（本轮新增行） | regex 冻结于 B-8（≡ read-schema-projection/render-projection-text 两处既有实现） | window-read.ts 装配点第四处实现 | 低——Byte 冻结 + 敌意用例锁定；规则文本与两处源码逐字符核验一致 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| 无新增 acquire（纯读、零订阅/后台/缓存） | 无新增 release | 失败可直接重试 | ✅ 完全对称 |

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 第二条截断事实载体 / 第二套 options 校验 / 计数第二事实源 | iteration 0 表三项 | 同款 | 非重复 / 非重复 / R2 登记（保持） |
| 第二套行注入防御 | foldSegment/foldText 既有 | B-8 ② 同款规则的第四处施加 | 非重复——同规则多处施加是仓内既有形态（头行、✂ 行、口径注释、窗口事实行各一处），非平行机制 |

## 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW LIST 19 项逐一核验 | iteration 0 全量核验保持；F-1 修订**零文件范围变化**（§11 注记：折叠逻辑落已列 window-read.ts ✂ 装配、敌意用例落已列 lease 契约测试宿主） | 无 |
| ALLOW 无无理由扩张 | 每行有原因列并回指设计章节 | 无 |
| DENY LIST 与正文零冲突 | doc-runtime/vfsl 全包、readData 三件、CONTEXT、docs/adr、wire/持久化/诊断、vitest.config——修订后正文各处仍均未宣称触碰 | 无 |
| follow-up 未掩盖必要项 | R2/R1/R5 均任务外真实项 | 无 |

## 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1 四键/条目形/空容器 | W2-A A1–A6 + helper 键集断言 | 无 | 无 |
| AC2 oracle 不漂移 | W2-S 双侧剥离逐字节对账（剥离逻辑与渲染器块文法逐字吻合——iteration 0 核验保持） | 无 | 无 |
| AC3 ✂/truncated 一致 | W2-T T1–T4 + 边界矩阵 + 独立预言机计数 + **敌意 field 名用例** + Byte 冻结 | 无（iteration 0 的缺口已闭合；充分性论证见上节） | 无 |
| AC4 等价锚 + 零物化 | W2-E E1–E4（E3 N=2000 毒值 + n=2；E4 入选毒项 fail-fast） | 无 | 无 |
| AC5 三码透传 + 类型面 | W2-F F1–F6 + Y1 | 无 | 无 |
| AC6 文档 + 全绿 | W2-Y + NC1–NC6 + 根 typecheck/test + 收敛门归零 | 无 | 无 |
| 计数-空间零漂移 | 边界矩阵 + 出处标记（RA-3 实现期兑现——N-1） | 无 | 无 |
| 红灯真实性 / 测试入口真实性 | SA6 探针 3/3 + 2/2 逐字节复现；vitest include 实读命中 | 无 | 无 |

## 本轮再攻击（iteration 1 新增探针，全部未成立为 finding）

1. **折叠前施加攻击**：若实现把折叠提前到 W1 调用前（折叠后的 field 名参与排序/下钻），
   值通道语义改变。防线：S6 明文「canonical 项与 S2 值通道保持 raw」+ W2-T 值通道
   raw 名断言。不成立。
2. **inline 残差攻击**（无换行的 `✂`/`- `/`· 窗口 ·` 模仿）：滞留单行内部，非行首、非新行，
   不构成结构性伪造；与 pathText 段含 `.`/空白的呈现残差同族（ADR-0027 已知限制 1，
   不承诺 round-trip）。设计未过度承诺清除——正确。不成立（呈现保真非本票义务）。
3. **空 field 名退化**：`field:''` 通过 W1 typeof 检查 → 折叠后基槽呈 `field:`——退化但
   确定性、单行、无害；Byte 冻结下稳定。不成立。
4. **`\r` 单独/`\r\n` 变体**：regex 三分支覆盖（源码核验），Byte 冻结锁定行为；测试载荷
   仅直击 `\n` 分支——见 N-3 卫生建议，非缺口。
5. **slot ② 等价论证证伪**：尝试构造 `index`/`key`/前缀含换行的输入——W1 L343/L353 闭合
   词表 + 常量前缀使构造不可达。论证成立。
6. **修订外溢检查**：diff 面是否触碰承重裁决——§14 映射 + 本轮全文再读确认仅呈现规则
   与对应测试义务变化；锚链/计数/分层/键集/失败面原文零变化。不成立。
7. **SA8 重查必要性**：F-1 修订镜像仓内既有行注入防御纪律（ADR-0027 决策 1 的✂ 唯一
   载体性被*加强*而非削弱）、零新 API、零 ADR 冻结面触碰——设计 §15 裁
   `requiresConflictRecheck: false`，SA2 独立复核同意（与 iteration 0 预判一致）。

## Required revisions

| Finding ID | Severity | Evidence | Problem | Required change | Acceptance |
|---|---|---|---|---|---|
| F-1 | MAJOR（**已解决，iteration 1**） | 设计 §7.1 B-8 ② + §7.3 S6 + §12 AC3 + §14；SA2 源码核验：`window.ts` L363–367（敌意面属实）、`read-schema-projection.ts` L127–128/L175–177 与 `render-projection-text.ts` L984–986（折叠纪律同款属实）、L63（`✂ 截断事实：` 伪造目标）、L332（kind 闭合） | （iteration 0）B-8 `field:<单段名>` 槽缺行注入折叠纪律 | 已按 iteration 0 验收标准落实：四插值槽确定性渲染 + foldSegment 同款折叠 + 单行不变式 + W2-T 敌意 field 用例（含值通道非污染断言） | **满足**：① 四槽均有确定性规则（核验表逐槽通过）；② W2-T 含敌意 field 用例且断言单行（载荷覆盖 `\n`/`✂`/行首 `- `，kept<total，块在场性锚定） |

（无未解决 finding。）

## Non-blocking observations

| ID | Observation |
|---|---|
| N-1（承 O-3） | R2 计数镜像防线依赖 RA-3 实现期兑现（出处标记 + 独立预言机矩阵随契约测试同变更集落地），否则漂移防线停留在纸面。 |
| N-2（承 O-4） | R1 封闭对象 depth 计量披露是 AC6 验收属性而非可选：两作用域文档窗口读段必须明示「封闭对象 map schema = 容器口径 + depth 自容器起算 + `depth ≥ 1` 得完整字段口径」。 |
| N-3（新） | W2-T 敌意 field 载荷可顺带加 `\r` 与 `\r\n` 变体各一条，直击折叠 regex 另两分支（当前载荷只含 `\n`；Byte 冻结已间接锁定三分支行为，属低成本卫生加固，非缺口）。 |
| N-4（新） | `foldSegment` 在 `read-schema-projection.ts` 为 src 私有；window-read.ts 的折叠助手将是第四处同款实现（仓内已有三个测试文件本地拷贝先例，冻结规则=regex 与先例形态吻合）。建议实现期对该拷贝一并施加 §7.4 的出处标记纪律（`copied from read-schema-projection.ts@ab6e390 (foldSegment)`），便于 W1/呈现纪律演进时单点发现。 |
| N-5（承 O-5） | SA8 §3.1 论证 1「数据依赖」措辞偏松（field 是请求参数而非 doc 数据），结论经「路径键控」clause 独立成立——仅记录措辞精度。 |
| N-6（承 O-6） | exports-audit 列 ALLOW 属预防性预留（该测试仅断言值导出键集，type-only 追加结构性不可见；实现零 diff 该文件亦合规）。 |

## 裁决说明

- F-1 已按 iteration 0 验收标准完整落实并经 SA2 源码级核验（折叠规则与仓内纪律逐字符一致、
  敌意面与伪造目标属实、四插值槽全覆盖、单行不变式冻结、测试义务充分且含值通道非污染补强）。
  无 BLOCKER/MAJOR → **approve**。
- O-1（空路径 `[]`）与 O-2（数组面单锚无回退对称从句）已顺带钉死；O-3…O-6 以 N-1/N-2/N-5/N-6
  承接为实现期/验收期义务，均非阻断。
- `approve` 仅覆盖设计冻结面的正确与完备；实现与活链路验证归 SA4/SA7。SA8 RA-1–RA-5 与
  N-1/N-2（含 N-3/N-4 卫生建议）应在实现票兑现。
- 本轮无需要重新执行 ADR 冲突检查的新风险面（修订为仓内既有纪律的镜像施加，不新增 ADR 张力）
  → `requiresConflictRecheck: false`。
