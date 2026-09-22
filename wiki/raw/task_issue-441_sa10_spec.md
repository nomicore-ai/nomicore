# SA10 Spec 审查 — issue #441：doc-runtime Record/parent fast path 接线与 S9 收窄（ADR 0034）

- 审查对象：**最终已提交交付** `61778bca5ce18ea68147b30cefa15e9f59961466`
  （`feat(doc-runtime): add record mutation fast path`，分支 `mabf/issue-441`，父提交 =
  设计/SA6/SA2/SA8 基线 `3fd6aa8`）。
- Verdict：**approve**（AC1–AC6 全部达成并有可核证据；无 unmet / partial / unachievable 项；
  无 scope creep；4 项非阻塞观察登记于 §7，均不阻断）。
- Owner 评论：**无**（Host dispatch 明文 REST comment read 为空；简报 L38–39 Comments 段空；
  SA6 §2 / SA2 §4 / SA8 两报告 / SA3 报告五源一致）——无 owner-comment 要求面。
- 审查方法：静态审查最终提交 diff + 只读取证（git/sha256/mtime/字节比对）+ 既有门禁证据日志
  核对；未运行测试、未启动服务（SA10 技能边界）。

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-441.md`（简报；AC1–AC6；Blocked by #440 已于 HEAD 解除——`08497d9`/`3fd6aa8` 在历史中） | 已读 |
| `wiki/raw/task_issue-441_sa6_contract.md`（approved：18 红契约 + 27 负控 + 49 项探针；B-1..B-6 绑定点） | 已读（全文） |
| `wiki/raw/task_issue-441_design.md`（SA1 iteration 1，683 行；§7.2 闸门 / §7.3 F1–F5 / §7.5 S9 / §7.6 注记计划 / §11 ALLOW-DENY / §12 判据 1–6 / §12.1 探针 12+37 分类） | 已读（全文） |
| `wiki/raw/task_issue-441_sa2_review.md`（approve）、`_design_conflict_report.md`（SA8 clear）、`_sa3_impl.md`、`_sa4_review.md`（approve）、`_implementation_conflict_report.md`（SA8 实现后 clear） | 已读（全文） |
| `docs/adr/0034-record-and-parent-elementwise-validation.md`（母法，决策 1–6 + 后果节） | 已读（全文，逐决策对照实现） |
| `docs/adr/0007-*.md`（#237 修订节条款 1/4(ii)/7 + 0033 注记 + 新落地 0034 注记 L142–159）、ADR-0010 L345–347、CONTEXT.md L144/L202、`docs/AGENTS.md` 义务句、`packages/doc-runtime/AGENTS.md` | 已读/核对 |
| 最终提交 diff：`61778bc`（numstat：ADR-0007 +19/−0、`mutation-local.ts` +74/−2、`mutation.ts` +12/−9、契约三件套 +973、wiki 证据面） | 逐 hunk 审查 |
| 源码：`mutation-local.ts`（闸门 L292–343 + legacy L344–381）、`mutation.ts`（注释-only 程序化验证）、`install-verify.ts`（`VerifyPlan`/`verifyBoundaryInstallFacts`/`verifyPrepared`）、`validate-patch.ts`（union 冻结 L798–801 复核） | 已读（关键面） |
| 冻结验收面：契约/负控/夹具 + 探针（sha256 `6030e0b8…97c1f9` 本审复算一致） | 已读 + 取证 |
| 门禁证据：`artifacts/sa3-issue441-{focused,root-test,root-typecheck,probe-post-impl,probe-flipset-check}*`、`artifacts/sa6-issue441-*`（含 contract-red.json 冻结红名单） | 已核对 |

## 2. AC 逐条裁决

### AC1 闸门正确 —— **达成**

- 闸门位于 `mutation-local.ts` L304–305：`plan.node.kind === 'object' && resolve(boundaryNode).kind === 'map'`
  （双条件合取，O(1)）；命中走 F1–F5 fast path，未命中落入 legacy（永久双轨）。
- **非 union Record 位走 fast**：契约 FA1–FA8（`tasks`/`codes`/深路径 `outer.inner`/批量）转绿。
- **封闭对象 delete 走 fast**：FA9–FA11（optional/required/unknown 三形态）转绿；plan.kind='parent'
  + object 节点入闸门。
- **union map 位回退 legacy**：规划层 `planMutationBoundary` 首次 union 穿越即冻结 kind=`union`
  （`validate-patch.ts` L798–801 本审复核），结构上进不了 record/parent 分支；负控 NA1–NA5
  （union 位污染照旧拒绝、union 穿越照旧 E201-C、干净写成功）保持绿。
- **Record 值位 union 仍走 fast**：值位 union 不参与闸门条件（`plan.node` 是容器节点）；FA6
  （`blobs` 值位 `Item | Alt`，兄弟污染不连坐）转绿；探针 G1f 列入预期翻转集并实证翻转。
- 第三重锁：vfsl 接缝 `applyElementwiseEntryMutation` 对违约计划 fail closed（#440 冻结面，
  本票零改动）。

### AC2 不再提取/重建整个 map（基准证据）—— **达成**

- fast path 步骤链 F1 载体 O(1) → F2 `Y.Map.has` O(1) → F3 接缝 O(正则)/O(新值) → F4 detached
  构造 O(新值) → F5 收窄计划：无 `walk` 整 map 提取、无 `applyMutationAtBoundary` 全量重建、
  无边界重投影（源码逐行核对；legacy 轨代码与 HEAD 逐字节一致，diff 比对 `LEGACY_IDENTICAL`）。
- **结构性成本证据（契约硬判据，机器无关）**：FB1–FB3 转绿——值读 ≤2 且 n=512 与 n=4096 相等；
  封闭对象父值读 ≤2 且 4/14 字段相等。
- **基准证据（issue 例示形态，探针软证据）**：`artifacts/sa3-issue441-probe-post-impl.log`——
  G3 读计数 n=512/4096 → set 1/1、delete 0/2、封闭对象 0/2（与 n/字段数完全解耦）；
  G3c 软时序：10⁵ entry map 单键 set **1 ms** vs 10³ **0 ms**（实现前 1115 ms vs 12 ms）——
  耗时与 n 解耦。契约禁绝对毫秒阈值（设计 §7.7），探针报告值满足 ADR 0034 后果节的基准验证项。

### AC3 commit 的 update 事件形态不变 —— **达成**

- `commitPrepared` 零改动：`mutation.ts` diff 经程序化验证**全部改动行均为注释**（非注释行
  过滤结果为空）；commit 构造形态（`{kind:'set'|'delete', parent, key, value}`）与 legacy 同款。
- 负控 ND1–ND6 保持绿：终态与增量字节 ≡ 同 clientID 手写最小 edit、恰 1 个 update、增量长度与
  n 解耦、同基态对端复制收敛、批量单事务单 update——复制与诊断捕获面零回归。
- 探针保持绿组 G5f/G5g/G5g2/G5j/G5k（字节 oracle + 敏感性反证 G5k）实证形态不变。

### AC4 零写入 —— **达成**

- fast path 一切失败分支（F1 载体错位、F3 no-op/键 Pattern/值 schema/静态必填/接缝违约、
  F4 构造失败）全部在 prepare 期 `return`，先于 `transactGuarded`（代码序核对）；批量任一元素
  失败聚合零写入（NC9）。
- 负控 NC1–NC5/NC10/NC11 保持绿：逐字 message/path + `Y.encodeStateAsUpdate` 逐字节不变 +
  0 update 事件（NC1 抽样复核：断言面含 `count===0` ∧ `sameBytes`）。

### AC5 S9 收窄 —— **达成**

- fast path 返回 `verify: { kind: 'install-facts', facts }`（L341–342），无 `proposedBoundary`
  ——仅安装事实核（`get`/`has` 同一性，O(1)）。
- `install-verify.ts` **零改动**（commit 文件面核对）：`VerifyPlan` 判别联合与共享单实现
  `verifyBoundaryInstallFacts` 纯复用（#436 建立）。
- legacy 轨返回 `kind:'boundary'` 双核（L368–381，含 `proposedBoundary`）逐字不变；NA3/NA4/NB5
  保持绿。
- FC1–FC4 转绿：触达面外同事务篡改静默通过、doc 保持篡改态（ADR 0034 决策 3 已确认取舍）。
- NB1–NB5 保持绿：目标键覆写/重插/同值异实例仍 E201-C；`expectE201`（control L35–41）断言
  变体语义四要素——fatal、`phase='post-commit-verification'`、`committed===true`、`DOCRT-E201`
  ——E201 变体语义保持。

### AC6 门禁 —— **达成（证据留档）**

| 门 | 证据 | 结果 |
|---|---|---|
| 聚焦对（契约 18 + 负控 27） | `artifacts/sa3-issue441-focused.log` | **45/45 passed**，Type Errors: no errors，`FOCUSED_EXIT=0` |
| 包 tsc | SA3 报告 Verification 表 | `PKG_TSC_EXIT=0` |
| 根 `pnpm typecheck` | `artifacts/sa3-issue441-root-typecheck.log` | `ROOT_TYPECHECK_EXIT=0`（15 包 tsconfig 全过） |
| 根 `pnpm test` | `artifacts/sa3-issue441-root-test.log` | **471 files / 5757 tests passed**，Type Errors: no errors，`ROOT_TEST_EXIT=0`（含契约 18 与负控 27 双绿行） |
| 探针确认信号（非 AC 判据，设计 §12.1） | `artifacts/sa3-issue441-probe-post-impl.log` + `-probe-flipset-check.txt` | exit 1、`checks=49 failures=12`，失败集**恰为**设计命名 12 项（`EXACT_MATCH`）；探针文件 sha256 本审复算 = `6030e0b8…97c1f9`（字节不变） |

## 3. SA6 契约符合性

- **契约 18 条未被弱化**：committed 契约文件 `it()` ID 集合与 SA6 冻结红名单
  （`artifacts/sa6-issue441-contract-red.json`，18 failed）**逐一相等**（程序化比对 `MATCH`）——
  红灯经实现自然转绿，非修改契约伪绿。
- **负控 27 条 ID 集合精确**（NA1–5/NB1–5/NC1–11/ND1–6）且保持绿。
- **冻结面取证**：契约/负控/夹具 mtime 18:04–18:10 早于源码改动 19:08（本审 stat 复核）；
  探针 sha256 一致。
- **绑定点 B-1..B-6 兑现**：观察入口 `applyValidatedMutation`（零新公共导出——`src/index.ts`
  不在提交面，`public-surface-guard.test.ts` 绿）；闸门/成本/零写入/commit 形态/S9 五锚全部
  由对应契约组覆盖且转绿/保持绿。
- SA6 §12.2-8「探针 exit 0 不变」半句与探针自身断言不相容——固定工件未改（正确），歧义经
  设计 §12.1 消歧并以 §12 判据 1–5 为准（SA2/SA4/SA8 同口径，本审确认执行一致）。

## 4. ADR 0034 与规范面符合性

| 决策 | 实现对照 | 判定 |
|---|---|---|
| 决策 1（fast path 管线序：导航验载体→键 Pattern→新值 schema+构造→单键 commit 旧值不读；delete `has` 拒 no-op；闸门；union 永久回退；值位 union 不阻断；issue 路径兼容） | F1–F5 步骤序逐条对应；issue rebase `[...plan.prefix, ...issue.path]` 由 #440 接缝保证（NC2/NC3/NC8 逐字绿） | 符合 |
| 决策 2（封闭对象 delete 静态必填判定） | F3 纯消费 `judgeClosedObjectDelete`（vfsl 零改动）；FA10 静态 `缺少必填字段 "req"`、FA9/FA11 允许 | 符合 |
| 决策 3（S9 收窄；legacy 双核不变；E201 语义不变） | install-facts 复用；install-verify.ts 零改动；FC/NB/NA3/NA4 双组钉死边界 | 符合 |
| 决策 4（触达面 = 载体 + 目标键位；载体位响亮拒绝；标题点名扩展 ADR-0010） | fast path 无 sibling 读/无整 map walk（diff 内仅 carrier + `has(key)` + 接缝 + 构造）；F1 `carrierMismatchIssue([], 'Y.Map', …)` 逐字复刻 legacy S5 首错（G1k/G1l PASS） | 符合 |
| 决策 5（禁止 map 级约束特判） | 域规则单源 = vfsl 接缝单 entry 合成视图过共享解释器，无容器级特判 | 符合 |
| 决策 6（复用 0033 seam 语义，不另起平行机制） | 闸门+F1–F5+install-facts 镜像 #436 数组接线结构；vfsl 纯消费 | 符合 |
| 后果节验证面（双轨/零写入/S9 收窄/public-surface guard/基准/根 gates） | §2 全表 | 符合 |

**规范文档一致性（SA8 evolution-required 项的落地复核）**：`docs/adr/0007-*.md` 追加
「ADR 0034 修订注记（2026-09-22）」（+19/−0 纯追加，既有 140 行零改写）；注记文本与设计 §7.6
建议文案**逐字一致**（本审归一化机械比对 `NOTE_TEXT_MATCH`）；条款 1/4(ii)/7 三处陈旧句面被
显式修订，union 容器/union 穿越/其余边界种类/条款 4(i) 明示保持；ADR-0010 沿标题点名先例不
另行注记（零漂移）；0033 注记作用域句零改写（时序层叠自洽）；注记与实现**同一提交**交付
（同变更集纪律兑现）。ADR 0033/0034、CONTEXT.md、协议文档零改动（提交面核对）。

## 5. Scope 审查

- **ALLOW 命中**：3 个 tracked 源码/文档改动全部命中设计 §11 ALLOW（mutation-local 闸门+F1–F5；
  mutation.ts 注释-only；ADR-0007 有界追加）。
- **DENY 零触碰**（commit 文件面核对）：`packages/vfsl/**`、`install-verify.ts`、`src/index.ts`、
  既有测试、ADR 0033/0034/0010、CONTEXT.md、协议文档、tsconfig/vitest.config/pnpm-lock。
- **无 scope creep**：无新公共导出、无新 S9 核、无第二校验源、无异步审计/前像捕获（ADR 0034
  「不做什么」遵守）；测试三件套 + wiki 证据面随提交建档（沿仓惯例，SA6 契约三件套本就属
  交付验收面）。
- 既有测试零迁移/零重锚（无任何 tracked 测试文件改动——SA8 实现后报告 §6 清单③ vacuously
  成立，本审 commit 面复核一致）。

## 6. PR 必须披露的未达成项

**无 unmet / partial / unachievable 的 AC 项。** 需随交付如实披露的已确认取舍与登记项
（均非本票义务，上游已登记）：

1. **E201 检出面收窄（ADR 0034 决策 3 已确认取舍）**：触达面外同事务篡改由检出变为静默通过
   （FC1–FC4 即其目标行为契约）；目标键位篡改仍 E201-C（NB 组）。
2. **污染检测面收窄（决策 4 已确认取舍）**：对污染容器的写由连带拒绝变为目标键合法即成功；
   未触达 entry/字段不再承担 trusted raw replication 非法数据的检测职责；触达面内载体位仍
   响亮拒绝（G1k/G1l 冻结）。
3. **登记的非阻塞残余观察（SA2/SA4 O-1/O-2/O-3）**：`undefined` 值键在场性谓词微观分歧
   （fast 轨用 ADR 字面谓词 `Y.Map.has`，忠实母法）；提交后整载体替换的静默残余（与 #436
   数组轨同形）；手造槽形态分歧呈现为领域 issue 而非 E204（fail-closed 方向，#440 冻结面）。
4. **明确 follow-up（ADR 0034「不做什么」/设计 §13）**：触达面外污染的异步/抽样审计、被删
   entry 前像捕获、union 穿越既有 E204 观察（E8）、实现后目标行为探针（如需须另行命名并经
   Controller/SA6 路由）。

## 7. 非阻塞观察（MINOR，不阻断 approve）

- **M1（上游证据工件元数据微差）**：SA8 实现后报告 §2 记录 diff 规模为 mutation-local (+76/−3)、
  mutation (+21/−11)，最终提交 numstat 实为 +74/−2、+12/−9（与 SA4 §1 记录一致）。差异仅在
  证据报告的元数据陈述，不涉及交付内容与任何行为结论。
- **M2（worktree 卫生）**：仓库根有未跟踪临时文件 `cur-legacy.txt`（1945B）/ `head-legacy.txt`
  （0B），系评审期提取残留，未进提交；建议收尾清理，不影响交付。
- **M3（SA4 N-A 承接）**：`install-verify.ts` L396/L437 的 @internal 注释仍称 install-facts
  「fast-path 数组提交」——DENY 冻结面正确未触碰；属注释漂移，建议后续顺路票刷新。
- **M4（探针证据语义）**：G1h 实现后仍 PASS 但拒绝理由由 S5 父值载体错位变为 F3 静态必填判定
  （断言面仅 `ok===false`）——设计 §12.1/SA2 N3 已明示，探针失败集实证不含 G1h，口径一致。

## 8. Verdict

**approve**。最终提交 `61778bc` 忠实满足 issue #441 正文 AC1–AC6、approved SA6 契约
（18 红转绿且零弱化 + 27 负控保持绿 + 探针字节不变且翻转集精确命中设计命名 12 项）、
ADR 0034 决策 1–6 与相关规范面（ADR-0007 显式修订注记同变更集落地、ADR-0010/0033/CONTEXT
零漂移）；无 scope creep；门禁证据齐备（聚焦 45/45、包 tsc、根 typecheck、根 test
471 files/5757 tests 全绿）。§6 披露项全部为 ADR 已确认取舍或上游已登记的非本票义务。
