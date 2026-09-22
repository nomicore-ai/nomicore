# SA2 设计攻击评审 — issue #436：doc-runtime 数组 fast path 接线与 S9 收窄（ADR 0033）

- 评审对象：`wiki/raw/task_issue-436_design.md`（**iteration 1 修订版**——对 iteration 0 verdict
  reject〔F-1 MAJOR + O-1..O-4 MINOR〕的逐条修订）。
- 评审性质：**复审**。聚焦面 = F-1 的既有测试钉死面处置是否正确且不弱化意图、范围是否充分、
  全部前轮 finding 是否解决；核心架构面（闸门/O(k)/S9 收窄/零写入/最小 edit）按 iteration 0
  已逐锚点攻击确认的结论复核（本轮抽验锚点再次全中，见 §6/附录 A）。
- 评审基线：HEAD `7407ce01367b6d7a3fe497cd78c4bcf085f3ddbb`（`git log` 本轮复核 = PR #444 merge，
  即 #435 接缝 + ADR 0033；`git status` 生产代码零改动；SA6 证据日志 8 件在位）。
- 评审方法：独立攻击——对修订面逐行核对两测试文件实文/断言/共享面、union 数组走
  walk/build 的机制级可行性（extract.ts walkUnion/trialMember、detached-build.ts buildUnion）、
  ADR-0007/0010/0033 与 CONTEXT/docs-AGENTS 的陈旧面与义务链、并**独立重扫全仓测试面**
  验证「钉死 Δ1/Δ2 旧语义的恰为两条」。

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-436.md`（Host 简报，comments = 空） | 已读；AC1–AC7 与修订版 §12 映射复核 |
| `wiki/raw/task_issue-436_design.md`（iteration 1 被评审设计） | 全文逐节攻击；重点 §7.6/§7.7/§11/§12/§13/§14/§15 |
| `wiki/raw/task_issue-436_sa6_contract.md`（已批准契约） | 全文核对；§4/§13 数字与 `artifacts/sa6-issue436-post-test.log` 复核一致（464 files/5647 tests，8 failed 恰 = 契约文件） |
| SA6 三件套 + 探针 | 抽验：契约 8 `it`、负控 NA1（union 拒绝面 L41-48）、夹具 union 数组 seed（L26/L70 `uarr: YArray<number> \| YArray<string>` 经 materializeRoot） |
| **P-1 实文**：`apply-validated-mutation-fatal-contract.test.ts` L208–236 | 逐行核对（W5_TEXT 局部常量 L218、断言 L230–234）——与设计 §7.7 表逐字一致 |
| **P-2 实文**：`issue-237-path-localized-validation-red.test.ts` L548–569 + 夹具区 L91–113 | 逐行核对（TEXT_LIB_ITEM 共享 L91–93、污染 L553–555、断言 L565–568）——与设计 §7.7 表逐字一致 |
| 生产源码（mutation-local/mutation/install-verify/extract/detached-build/carrier + vfsl validate-patch/index） | 逐锚点复核（§5–§10、附录 A）；本轮新增 detached-build buildUnion L140–148 与 extract walkUnion L160–177 的 union 机制核对 |
| 全仓测试面（doc-runtime 10 个含 array-* 的测试文件 + namespace-runtime/vfsl/domains/apps/tests 仓级扫描） | **独立重扫**：钉死 Δ1 旧义 = 恰 P-1/P-2 两条；钉死 Δ2 旧义（非 union 区间外等长篡改 → E201）= **零条**（见 §12） |
| `docs/adr/0007`（L62–124 #237 修订节）、`docs/adr/0010`（L333–361）、`docs/adr/0033`（全文）、`CONTEXT.md` L144/L202、`docs/AGENTS.md`、`packages/doc-runtime/AGENTS.md`、`packages/vfsl/AGENTS.md` | 逐条核对陈旧句面/义务句/授权链（§5） |
| `task_issue-436_relevant_decisions.md` / `_conflict_report.md` / SA8 门 | 不存在（iteration 1 仍无；`ls wiki/raw` 核对，仅 5 件 436 产物）——与设计 §0 声明一致 |

## 2. Verdict

**approve** —— iteration 0 的唯一 MAJOR（F-1）已被 §7.7 完整、正确地解决：两条既有恒绿测试的
处置采取「定向重锚到 union 数组载体」，经本轮独立验证**不弱化两用例的意图锚**（断言语义面
逐字保留、意图在 union 永久 legacy 面原样成立、实现中性两态均绿、机制可行性经
walkUnion/buildUnion 源码与 SA6 实证双重核实）；ALLOW LIST 覆盖该处置且约束收紧（文件内其余
用例与 SA6 三件套仍 DENY）；AC7 预测修正为两态判据且与 SA6 证据算术一致。O-1..O-4 全部落实。
本轮对修订面与核心面的再攻击**未发现新的 BLOCKER/MAJOR**。

`pass` 仅表示设计通过审查；实现与活链路验证仍归 SA4/SA7。设计 §15 请求收窄范围的 ADR 冲突
复查（本票现编辑 ADR-0007 决议文本 + 迁移既有验收锚）——**SA2 认同**（见 §15）。

## 3. 需求覆盖

| Requirement（简报 AC） | Design section | Assessment |
|---|---|---|
| AC1 闸门分流 | §7.1；§12 | 覆盖（iteration 0 已核；本轮复核双条件 + 接缝第三锁 fail-closed validate-patch L1086–1099 不变）。**通过** |
| AC2 O(n)→O(k) | §7.2；§12 | 覆盖（读计数预算结构性核算不变）。**通过** |
| AC3 live 长度越界 + 域规则一致 | §7.2 F2/F3；§7.3 | 覆盖（域文案逐字：接缝 L1113/L1132 与 legacy 双核对）。**通过** |
| AC4 update 事件形态 | §7.2 F5；§10 | 覆盖（`commitPrepared` 零改动）。**通过** |
| AC5 零写入 | §7.2/§9 | 覆盖。**通过** |
| AC6 S9 收窄 | §7.4 | 覆盖（`VerifyBoundaryIntactInput` L350–359 `proposedBoundary` 必填不变——本轮复核；事实核 L397–428 抽取面可行）。**通过** |
| AC7 包测试 + 根门绿 | §7.7 + §12（两态判据） | **通过（本轮修复）**：iteration 0 的「全绿预测事实错误」已按 F-1 修订要求改正——实现前（重锚+注记落、src 未动）失败面恰 = 契约 8 条（重锚两用例在 HEAD 即绿——union 轨两态均 legacy）；实现后 464 files/5647 tests 全绿（两用例为改写非新增，计数不变；post-test log 复核 8 failed 恰 = 契约文件）。算术与证据一致 |
| 目标/非目标未静默扩大 | §1（新增目标 5 + 非目标末条） | 覆盖：新增面恰为 F-1/O-1 所需（测试重锚 + ADR-0007 注记），且非目标明示「不借 §7.7 重锚弱化意图锚」。**通过** |

## 4. Owner评论覆盖

Host 简报明文「Current Issue REST comments: none (no owner requirements)」；SA6 §2、设计 §4
声明一致，本轮再核对无误。**无 Owner 评论要求需要映射**；替代规范面 = Issue AC1–AC7 + ADR 0033
决策 1–6 + CONTEXT L144/L202（§6 表逐条）。

## 5. 上游事实与SA8约束

无 SA8 工件（iteration 1 仍无）。替代规范面落实核对（本轮新增/复核项加粗）：

| Fact or constraint | Design response | Assessment |
|---|---|---|
| ADR 0033 决策 1（闸门双条件；union 永久回退；规划层不动） | §7.1 | 落实（ADR 全文本轮重读核对：L21-23 与设计双条件逐字对应） |
| ADR 0033 决策 2（O(1) 长度/逐字域规则/逐字节 issue 路径/最小 edit/零写入先序） | §7.2/§7.3 | 落实（ADR L27-31） |
| ADR 0033 决策 3（事实核保留、重投影省略、legacy 双核不变、区间外静默为已确认取舍） | §7.4 | 落实（ADR L35-37） |
| ADR 0033 决策 4（触达面 = 载体+变更区间；污染数组 delete 转成功；不补审计） | §7.2 F1/§7.3 Δ1/§7.7 | 落实；**修订版把「既有测试钉死该旧义」的处置（§7.7）与「ADR-0007 陈旧句面注记」（§7.6）同批纳入，授权链闭合**（见下两行） |
| **ADR 0033 对 ADR 文档的点名范围** | §7.6/§6 | **本轮独立核实**：决策 4 标题（ADR 0033 L39）只点名 ADR-0010 #237 修订节；全文 grep 无任何「0007」引用 ⇒ 设计「ADR-0007 #237 节条款 1（L76-77「不逐元素」）/条款 4(ii)（L102-103「数组位」）为残留陈旧面、需本票注记」的判定**准确**；ADR-0010 L333-361 后备句以 ADR-0007 损坏条款为单一真相源、且已被决策 4 标题点名 ⇒ 0010 零注记的裁决**有据** |
| **`docs/AGENTS.md` 义务句** | §7.6（默认执行） | **核实**：「When code behavior changes, update every normative document whose stated contract changed」为义务句；O-1 的默认执行修订与之对齐。CONTEXT.md L144/L202 本轮抽读：两词条已按 ADR-0033 目标状态立法（「数组位例外」「对污染数组的 delete 由响亮拒绝变为照常成功」）⇒ 零改动声明**成立** |
| ADR 0033 决策 5/6 | §6 表；§12 | 落实（vfsl 零改动；软验收） |
| ADR-0007 损坏条款 (i) 载体违规仍拒 / (iv) 触达面外不发现 | §7.2 F1/§7.7 | 落实；F1 与 A-4 载体冒充面（issue-237 测试）保绿 |
| ADR 0025/0026（guard 先序；批量 E1–E6） | §7.5 | 落实（`composeBatchVerify` L350 无条件 `verify.proposedBoundary` 读取本轮复核在案——判别化必要） |
| doc-runtime AGENTS / vfsl AGENTS 纪律 | §6/§9/§11 | 落实：无新公共导出（vfsl `src/index.ts` L129-146 已导出接缝三符号、doc-runtime `package.json` 既有 `@nomicore/vfsl: workspace:*`——本轮核实 import 面零配置变化）；@internal 面符合包惯例 |
| SA6 契约 §15（不绑定内部名形） | §7.4 自由度内 | 落实 |

## 6. 设计内部一致性

- **修订映射自洽**：§14 表声称的 F-1/O-1..O-4 落实位置逐一经正文核对存在且内容相符
  （F-1 → §1 目标 5/§2 钉定面段/§3 G-6/§6 决策 4 行/§7.7/§8.2 legacy 行/§10 两行/§11 两定向
  ALLOW 项/§12 F-1+AC7 行/§12.1/§13 R8+R9；O-1 → §7.6/§6/§11/§7.8/§13 R7；O-2 → §12.1；
  O-3 → §7.2 伪代码（`const values = mutation.values!`、`let commit`/`let facts` 局部声明、
  `failIssue`/`walkResultIssues` 锚 L57/L203 本轮核实存在）；O-4 → §7.1 末段 + §9 同步）。
- **§7.7 表格与两测试实文逐字一致**：P-1（W5_TEXT L218、污染 L225、insert L227-229、断言
  L230-234）；P-2（TEXT_LIB_ITEM L91-93、污染 L553-555、insert L559-562、断言 L565-568）。
  设计声称的「P-1 只断言 `issues.length > 0`、P-2 不查 issues、无路径断言可破」**与实文相符**
  ——重锚后 union walk 的 issue 形状（声明序首真 issue）不触碰任何断言面。
- **§7.6 注记建议文案与实文一致**：所引条款 1「批量 values[] / count 一次整体判定，不逐元素」
  （L76-77）、条款 4(ii) 边界清单含「数组位」（L102-103）、条款 7 成本句「array……按边界规模」
  （L121-124）均逐字在案；文案对 4(i)/union/其余边界种类「逐字保持」的保留声明与设计闸门
  （§7.1）不矛盾。
- **AC7 两态判据内部一致**：重锚 = 改写既有用例（计数不变）⇒「实现后 464 files/5647 全绿」
  与 post-test log 基线（464/5647，8 failed 恰 = 契约）衔接自洽；「实现前失败面恰 = 契约 8」
  依赖重锚用例在 HEAD 绿（union 轨 HEAD 即 legacy——成立）。
- **§15 与 §6 的「需冲突复查」标记一致**（决策 4/ADR-0007/docs-AGENTS 三行标「是」，范围收窄
  为注记文案一致性 + 重锚授权链）。
- 未发现死引用、旧 API、前后相反描述或「附录承认但正文未改」的伪修订。

## 7. 状态机与并发攻击

iteration 0 的 C1–C7 攻击面在本轮修订后均未被触碰（闸门/fast path/S9 形态零实质变化）；本轮
新增攻击针对修订引入的面：

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| C8 | 重锚后 P-1/P-2 在 HEAD（实现前）执行 | union 数组目标 + 元素级污染 + insert | legacy S5 walk 以 union 仲裁失败 → `{kind:'fail'}` ⇒ `ok:false` 零写入（两态判据的前半） | 无——机制核实：`walkUnion`（extract.ts L160-177）全成员拒且存在真 issue ⇒ 返回 issue（**不 throw**，无 fatal 通道误入）；`YArray<Item>` 成员在 `qty` 污染处产真 issue、`YArray<string>` 成员对 Y.Map 元素产载体错位真 issue ⇒ firstIssue 必非 undefined | — |
| C9 | 重锚后 P-2 的 `doc.transact` 污染窗口 | 污染经 raw Yjs 写入（绕过校验） | 物化种子先消歧到 Item 成员，污染后整数组两成员皆不容 | 无——`buildUnion`（detached-build.ts L140-148）对任意成员形态（含 array 成员）按声明序试验，`YArray<Item>` 首选成功；SA6 夹具已实证 primitive 成员 union 数组经 materializeRoot 物化（fixture L26/L70），record 成员走同一通用路径 | — |
| C10 | 批量内 install-facts 项与 legacy 边界项并存 | 阶段 C 折迭循环遇到 `verify.kind === 'install-facts'` | 跳过折迭（无 proposedBoundary 可保护）；legacy 边界项对批内数组足迹的吸收照旧（parsed 驱动） | 无——`composeBatchVerify` L347-371 本轮复核：折迭内层只读 `parsed[j]`，判别化不影响 legacy 项语义；引理 3（E5 禁嵌套 ⇒ 严格前缀零命中）依旧成立 | — |

C1–C7（同步单线程无 TOCTOU；批内 E5 长度有效性；afterTransaction 篡改检出面 = 事实核；
载体实例交换两轨等价漏检；闸门两树分歧回退 legacy；闸门 resolve 抛错同 catch 同分类 E204）
维持 iteration 0 结论：无缺口。

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| E-1..E-6 | （iteration 0 已攻击：载体错位/域拒绝/事实核偏离/批内聚合/折迭误判/S9 静默降级） | 修订版未改实质；锚点复核不变 | 无 | — |
| E-7（=F-1） | 既有测试钉死 legacy Δ1 拒绝语义 | **已解决**：§7.7 盘点 + 定向重锚 + ALLOW 扩展 + AC7 预测修正（见 §9/§12/§13） | 无 | — |
| E-8（新） | 重锚执行走样（SA3 现场改断言/动共享夹具/波及文件内其余用例） | §7.7「范围与禁区」+ §11 DENY「其余用例」行 + §13 R8（SA4 复核 diff 面 = 仅 schema 文本/局部常量/注释授权链） | 低——约束已写死且可复核（断言语义面不放宽为 SA4 复核点） | — |
| E-9（新） | 重锚与实现分批落地（红窗/无授权改测试） | §7.7 明示同批交付（同一变更集）；§13 R9 | 低——分批时红面可观察（10 failed ≠ 预期 8），不静默 | — |

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| `applyValidatedMutation` 公共面 | 无（签名/结果面零变化；差异仅 Δ1/Δ2/Δ3） | `src/index.ts` 导出零变化；SA6 B-1 | — |
| `MutationPrepared.local`/`BatchItem.verify` 类型面（`VerifyBoundaryIntactInput` → `VerifyPlan`） | 已覆盖：两处验证调用（mutation.ts L153/L164 本轮复核在案）改经 `verifyPrepared`；mutation-local 4 处 `verify: {` 构造点全部保持 boundary 变体形 | §7.4 第 3 点/§8.1 | — |
| `composeBatchVerify` L350 无条件 `verify.proposedBoundary` | 已覆盖：判别化跳折迭 | 本轮源码复核 | — |
| **既有测试 P-1**（fatal-contract W5，L209–235） | **已覆盖（F-1 修订）**：§10 调用方矩阵新增行 + §7.7 a 处置（W5_TEXT → union 数组声明；W5_TEXT 为 it 内局部常量 L218，**无共享面**——本轮核实文件内无第二处引用） | 实文核对 | — |
| **既有测试 P-2**（issue-237 对称面，L548–569） | **已覆盖（F-1 修订）**：§7.7 b 处置（新增局部 `TEXT_LIB_ITEM_UNION`，**不动共享 `TEXT_LIB_ITEM`**——本轮核实共享常量消费面 = A-1〔L151/L171〕、A-6 CASES 10 例〔L467-475〕、A-7〔L520〕，均零触碰则全保绿） | 实文核对 | — |
| 复制协议/诊断捕获 | 无（update bytes 零变化） | ND 组；ADR 0033 | — |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| 闸门分流/域规则消费/事实核/载体文案 | doc-runtime 执行层 / vfsl 接缝 / install-verify / extract 助手 | §7.1–§7.4 | 正确（iteration 0 结论不变） |
| **既有语义钉死面处置** | 设计正文（授权 + 范围）→ SA3 执行 → SA4 复核 | §7.7 + §11 + §13 R8 | 正确：处置有授权链（ADR 0033 决策 4 + ADR-0007 注记同批）、有禁区（断言不放宽/其余用例零触碰）、有复核点（diff 面） |
| **规范文档修订** | docs/AGENTS.md 义务句 → ADR-0007 追加修订注记 | §7.6 | 正确：沿仓库「显式修订节 + 授权链」惯例（ADR-0007 #237 节自身、ADR-0010 #237 节同款先例）；不重写既有条款 |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| 测试锚迁移（改锚定载体保意图） | issue #237 修订期 W5 自身的历次修订（L211-217 注释载明「原形态……合法转 ok:true……W5 意图改为边界内损坏形态锚定」） | §7.7 重锚（换 union 载体，意图/断言原样） | 一致 | 同款「意图锚不变、载体随语义演进」的既有实践；且本次附完整授权链注释 |
| union 面既有护栏 | SA6 NA1（union 拒绝）、NB4（union E201） | P-1/P-2 重锚后成为 union 面第三/四锚 | 一致（互补） | W5 的 fatal-通道护栏与对称面三分面语义独立成锚（§7.7 裁决表拒绝删除的理由成立） |
| VerifyPlan 判别联合 / 接缝消费 / 载体助手复用 | （iteration 0 表） | 未变 | 一致 | — |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 数组合法性 ⟺ 逐元素合法 / 域规则文案 / S9 事实核 | ADR 0033 + vfsl 接缝 / 接缝单实现 / install-verify 单实现 | 无第二实现 | 无（iteration 0 结论不变） |
| **非 union 数组位触达面语义的成文规范** | ADR 0033（母法）+ CONTEXT L144/L202（已立法）+ **ADR-0007 #237 节注记（本票补齐）** | 重锚测试的授权链引用 | 无——注记落地后规范链闭合（此前 ADR-0007 两句为唯一残留陈旧面，本轮逐字核实） |

### 生命周期对称性

不适用（纯同步函数管线；无资源/订阅/后台任务面）。

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| （iteration 0 三行：第二套域规则/验证分派/载体判定） | — | — | 无平行（结论不变） |
| **为重锚新增测试基建** | 两文件既有夹具（derivedOf/fixtureOf/librarySeed/stateBytes/eventsOf） | 仅新增局部 schema 常量 | 无平行——零新基建，复用既有夹具函数 |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW 四个 src 文件 + 条件 extract.ts | 与 §7/§8 改造面逐一对应（条件项「二选一不得两端都改」纪律在案；`makeIssue`/`mismatchIssue` 现为 extract.ts 私有 L346/L361——本轮核实导出化前提成立） | — |
| ALLOW ADR-0007 注记（无条件，O-1） | 陈旧句面逐字核实（L76-77/L102-103）；授权链完整；建议文案与正文其余条款、ADR 0033、ADR-0010 引句关系经本轮核对无矛盾 | — |
| **ALLOW 两定向测试文件（F-1）** | P-1：W5_TEXT 局部无共享（核实）；P-2：局部常量方案隔离共享夹具（核实 6+ 消费面零触碰）；两文件均限定「仅该用例」且 DENY 行显式冻结文件内其余用例 | — |
| `packages/doc-runtime/test/**` 其余「仅新增文件」+ SA6 三件套 DENY | 与 §12 验收面一致；三件套冻结维持 SA6 §12.4 纪律 | — |
| DENY 其余（vfsl/**、index.ts、信封/guard 区、0010/0033/CONTEXT、配置） | 与正文非目标一致；**0010 零注记的豁免有母法依据**（决策 4 标题点名，本轮核实）；CONTEXT 两词条已目标态（本轮抽读核实） | — |
| **范围充分性（本次复审核心问题）** | AC7 所需改动面 = src 三/四文件 + 两测试定向修订 + ADR-0007 注记——ALLOW 全覆盖，无缺漏；无无理由扩张（每项新增均对应 F-1/O-1 修订要求并注明授权） | — |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1–AC6 | SA6 契约 8 红 + 负控 17 绿 + 探针（零修改） | 无（iteration 0 结论复核不变；NC3 全收集升序两轨同语义） | — |
| **F-1 处置（两测试重锚）** | §7.7 + §12 F-1 行：重锚后两态判据（实现前绿——union 轨 HEAD 即 legacy；实现后绿——union 永久 legacy） | **无——本轮独立验证**：①两用例实文/断言与设计表逐字一致；②意图锚不弱化（W5「领域失败留 ok:false 联合不被 fatal 吞并」在 union 面成立——walkUnion 全拒返 issue 不 throw；对称面「提取型边界内损坏仍响亮拒绝」在 union 面成立且更贴题——union 恒走 S5 提取）；③断言语义面逐字保留（P-1 三断言/P-2 四断言零改动）；④可行性（union-of-arrays 物化/走查均为通用成员试验路径，primitive 成员已由 SA6 夹具+NA1+U3 实证，record 成员同路径；无路径断言可破）；⑤实现中性（闸门条件二对 union 恒假） | — |
| **AC7 两态判据** | §12 AC7 行 + post-test log 复核（464/5647、8 failed 恰 = 契约文件、Type Errors: no errors） | 无——算术自洽（重锚为改写非新增）；「实现前失败面恰 = 契约 8」可由 SA4 直接复用为落地产序核对点 | — |
| 既有测试面扫描结论（O-2） | §12.1 表 | **本轮独立重扫一致**：doc-runtime 含 array-* 的测试恰 10 文件（grep 复核）；钉死 Δ1 = 恰 P-1/P-2；钉死 Δ2（非 union 区间外**等长**篡改 → E201）= 零条——TD-1（set 边界篡改，legacy boundary 变体重投影保留）、TD-2（键重插，事实核）、TD-3（数组 push = 长度变化，事实核长度算术）三者检出机理在 fast path 后均保留；S6/S7 折迭 parsed 驱动；`apply-validated-mutation-operations` 100k 用例（index 50_000 < 100_000 在界、载体同一性、单 update、字节上限）fast path 下全保持；A-1 计数锚（fullExtract/fullLogicalValidate/verifySnapshotIntact）只覆盖 ROOT 级全量管线，数组边界 walk 不经之——计数零变化；namespace-runtime 四文件均为干净数组操作、无污染锚 | — |
| 读计数预算 ≤8/≤4 | 结构性预测（insert=1/delete=0/越界=0） | 无 | — |

## 13. Required revisions

**无**（无 BLOCKER/MAJOR）。前轮 finding 处置状态：

| Finding ID | 前轮严重度 | 处置状态 | 复核结论 |
|---|---|---|---|
| F-1 | MAJOR | **已解决**（§7.7/§10/§11/§12/§13 R8-R9） | 两测试正确处置且不弱化意图；范围充分；AC7 可达且预测修正——本轮逐项独立验证（§9/§11/§12） |
| O-1 | MINOR | **已解决**（§7.6 默认执行 + 唯一 Controller 豁免 + 与 §7.7 同批） | 义务句/陈旧面/授权链逐字核实（§5） |
| O-2 | MINOR | **已解决**（§12.1） | 独立重扫结论一致（§12） |
| O-3 | MINOR | **已解决**（§7.2 伪代码修订） | 锚点核实（§6） |
| O-4 | MINOR | **已解决**（§7.1 末段 + §9） | 核实（§6） |

## 14. Non-blocking observations

- **N-1（MINOR）**：§7.7 b 的 `TEXT_LIB_ITEM_UNION` 未钉死放置位（模块级 vs 用例内）。两者
  均满足「不动共享 `TEXT_LIB_ITEM`」；建议 SA3 取模块级紧邻共享常量处以便对照，SA4 复核以
  「共享常量 diff 为零」为核对点。
- **N-2（MINOR，覆盖面说明）**：重锚后 W5 的 fatal-通道护栏与对称面的提取边界拒绝锚仅存于
  union 面；非 union fast-path 的领域拒绝（越界/非法新值/载体错位 → `ok:false` 零写入）由
  SA6 NC1/NC2/NC4 + 既有 A-4/A-5 锚定，覆盖无缺口——建议 SA4 报告引用该映射即可，无需动作。
- **N-3（MINOR，SA4 指引）**：§12 AC7「实现前」态把 §7.6 注记与 §7.7 重锚绑为同批；注记本身
  不影响测试绿性（docs 面），SA4 宜把注记在位作为 R7 的 docs 义务核对项（`git diff` 含
  ADR-0007 修订注记），而非测试门禁项。

---

## 15. 设计后 ADR 冲突复查评估（SA2 意见）

**认同设计 §15：需要（范围收窄）**。iteration 0 判「不需要」的依据对 fast path 实现面仍成立
（该面本轮再攻击未发现新冲突）；iteration 1 新增两类交付物使独立冲突复查重新必要：

1. 本票**编辑 ADR 决议文本**（ADR-0007 #237 修订节追加修订注记）——注记建议文案与 ADR-0007
   条款 1/4(ii)/7、ADR 0033 决策 1–4、ADR-0010 L343-347 引句的一致性本轮经 SA2 单方核对无
   矛盾，但应由冲突复查独立裁验（无 SA8 工件在先，此前仅设计自证 + 本轮 SA2 复核）。
2. **既有验收锚迁移**（P-1/P-2 重锚）的授权链与意图保持判定随注记同批复核。

复查范围同意收窄为：① 注记文案一致性；② 重锚授权链与意图保持；③ fast path 实现管线不重查。

---

## 附：正面确认（复审后仍然成立的关键论断）

1. **F-1 处置正确性**：重锚到 union 数组载体 = 锚定 ADR 0033 决策 1 立法永久保留的 legacy
   拒绝面——意图锚（W5 领域失败不进 fatal / 对称面提取型边界响亮拒绝）原样成立、断言语义面
   零放宽、实现中性（两态均绿）、与 SA6 契约零重叠（FA 锚非 union 新行为 / 重锚锚 union 不变
   行为，互补不重复）；期望翻转/删除两选项的拒绝理由（重复 FA 覆盖、意图锚丢失、删锚弱于
   移锚）成立。
2. **「恰两条」盘点准确**：本轮独立重扫（doc-runtime 10 文件 + 仓级 namespace-runtime/vfsl/
   domains/apps/tests）与设计 §12.1 一致——Δ1 翻转面恰为 P-1/P-2，Δ2 翻转面为零。
3. **union 机制可行性**：`walkUnion`/`buildUnion` 均为「声明序成员试验、首成功胜、全拒返首真
   issue」的通用路径（成员形态不限）；record 元素 union 数组的污染拒绝与合法物化皆循此路径，
   primitive 成员已获 SA6 夹具 + NA1/U3 实证。
4. **闸门/O(k)/S9/零写入/最小 edit 核心架构**：iteration 0 七项正面确认全部维持（本轮锚点
   抽验：validate-patch L1086-1099/L1113/L1132、install-verify L350-359/L397-428、
   mutation.ts L117-124/L153/L164/L329-374、mutation-local L296-347、carrier 助手私有面）。
5. **规范链闭合**：ADR 0033（母法）→ CONTEXT L144/L202（已立法）→ ADR-0007 注记（本票补齐
   唯一残留陈旧面）→ 两测试重锚（引用成文授权链）——四层同批交付后无漂移源。
