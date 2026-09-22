# SA3 Implementation Report — issue #436：doc-runtime 数组 fast path 接线与 S9 收窄（ADR 0033）

- 实现基线 HEAD：`7407ce01367b6d7a3fe497cd78c4bcf085f3ddbb`（分支 `mabf/issue-436`；实现前
  `git status` = SA6 的 untracked 测试/夹具/探针/报告/证据日志，生产代码零改动）。
- 轮次：iteration 0（无既有 `task_issue-436_sa3_impl.md`、无既有未提交实现——本轮为首次实现）。
- 结论：**实现完成，SA6 红灯契约 8/8 转绿、负控 17/17 保绿、包 tsc / 根 typecheck / 根 test 全绿**；
  唯一偏差 = SA6 探针的「exit 0」判据（该探针 G 组断言的是「HEAD 现状 / fast path 未接线」这一
  能力缺口本身）——详见 §Deviations，未修改任何探针/契约断言。

## Inputs consumed

| 输入 | 状态 | 消费点 |
|---|---|---|
| `wiki/raw/task_issue-436.md`（Host 简报，comments = 空） | 已读 | AC1–AC7 映射；无 Owner 评论要求 |
| `wiki/raw/task_issue-436_sa6_contract.md` | 已读（全文） | 8 条红灯契约 + 17 条负控 + B-1..B-6 锚 + §12.2 目标行为 |
| `packages/doc-runtime/test/issue-436-array-fastpath-{contract,control,fixture}.ts` | 已读（全文）；**零修改** | 验收面（FA/FB/FC 红 → 绿；NA/NB/NC/ND 恒绿） |
| `wiki/raw/task_issue-436_sa6_capability_probe.mts` | 已读（头部纪律 + 逐组语义）；**零修改** | 证据面（G/U/S/O/N 组；见 Deviations） |
| `wiki/raw/task_issue-436_design.md`（iteration 1 修订版） | 已读（全文，含 ALLOW/DENY） | §7.1–§7.7 逐项实现；§11 文件范围核对 |
| `wiki/raw/task_issue-436_sa2_review.md`（approve；F-1 MAJOR + O-1..O-4） | 已读（全文） | F-1/O-1..O-4 落实（§SA2 Finding 落实） |
| `wiki/raw/task_issue-436_design_conflict_report.md`（SA8：clear + requiresConflictRecheck=true） | 已读（全文） | §8 required actions：同变更集交付 + 复查清单 ①/② 材料 |
| `task_issue-436_relevant_decisions.md` / `_conflict_report.md` | 不存在（iteration 0 仍无） | 以 SA8 设计后冲突门禁报告 + ADR 0033 为替代规范面（与设计 §6 一致） |

## Existing worktree reconciliation

- 无既有实现报告、无既有 `packages/doc-runtime/src` 未提交改动 ⇒ 无「修订/删除过时实现」面。
- SA6 交付面（三件套 + 探针 + 报告 + `artifacts/sa6-issue436-*.log`）**原样保留**；本轮未修改
  SA6 三件套任何一行（md5 记录于 `artifacts/sa3-issue436-sa6-trio-md5.txt`：contract
  `2dd066f4788179651d0314428478f997` / control `c9e0e6c124e65028fd8df3ecec6347cc` /
  fixture `8358d45443d60095d0af9e5db0886c58`）。
- 临时状态：为核对设计 §12 的「两态判据」（重锚实现中性），曾两次以 `git stash push` 暂存 4 个
  src 文件跑实现前态测试，均已 `git stash pop` 还原（最终 `git diff --stat` = 7 文件与暂存前一致）。

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/doc-runtime/src/install-verify.ts` | §7.4/§8.1 | 事实核步骤 ① 逐字抽取为 `@internal verifyBoundaryInstallFacts(facts)`（L399）；`verifyBoundaryIntact` 改为调用抽取核（L468，行为逐字不变）；新增 `@internal VerifyPlan` 判别联合（L439）+ `verifyPrepared` 分派器（L444）；#237 段注释补 ADR 0033 收窄说明 |
| `packages/doc-runtime/src/mutation-local.ts` | §7.1/§7.2/§8.1 | `case 'array'`（L312）插入双条件闸门（L322）与 fast path F1–F5（L333–373）；legacy 全量分支原样保留（L375–…）；`LocalPreparedResult.verify` → `VerifyPlan`；四处 verify 构造点改 `{kind:'boundary', input:{…}}`（target/record/parent/union）；新增 vfsl 接缝 import；模块头 S5/S6/S9 注释更新为双轨描述 |
| `packages/doc-runtime/src/mutation.ts` | §7.4/§7.5/§8.1 | `MutationPrepared.local.verify` / `BatchItem.verify` → `VerifyPlan`；单操作（L167）与批量（L155）验证调用改 `verifyPrepared`；`composeBatchVerify` 阶段 C 按 `verify.kind` 判别（`install-facts` 项跳折迭，L356–360）+ 引理 3 依据注释；模块头补双轨验证描述 |
| `packages/doc-runtime/src/extract.ts` | §7.2 F1（条件 ALLOW 项，取「导出助手」一侧） | 私有 `mismatchIssue` 更名并 `@internal` 导出为 `carrierMismatchIssue`（L364）；两处内部调用点同改（`mismatch` L357 / `trialMember` L195）——单一实现，fast path F1 与 walk 首错**同文案同 path**（零手拼字面量） |
| `packages/doc-runtime/test/apply-validated-mutation-fatal-contract.test.ts` | §7.7 a（F-1） | **仅** W5 用例：`W5_TEXT` 的 `items` 改 union 数组声明（`YArray<Item> \| YArray<string>`）+ 注释追加授权链；seed/污染/操作/断言逐字未改 |
| `packages/doc-runtime/test/issue-237-path-localized-validation-red.test.ts` | §7.7 b（F-1） | **仅** A-7「对称面」用例：新增模块级局部常量 `TEXT_LIB_ITEM_UNION`（紧邻共享常量，N-1 建议位）并令该用例 `fixtureOf` 改用之 + 注释追加授权链；共享 `TEXT_LIB_ITEM` 与其余用例零触碰 |
| `docs/adr/0007-logical-validation-and-yjs-runtime-bridge.md` | §7.6（O-1，默认执行） | issue #237 修订节（文件末尾 L124 之后）追加「### ADR 0033 修订注记（2026-09-22）」+ 授权链说明 + 设计 §7.6 建议文案（逐字采用，仅把加粗标题升为小节标题）：条款 1「不逐元素」与条款 4(ii)「数组位」对**非 union `T[]`** 废止、条款 7 成本句相应为 O(变更量)；union 数组目标与其余边界种类逐字保持；条款 4(i) 不受影响；ADR-0010 #237 节已由母法点名、无需另注 |

证据产物（非交付代码，`artifacts/` 沿用 SA6 证据目录惯例）：`sa3-issue436-focused-final.log`、
`sa3-issue436-package-tsc.log`、`sa3-issue436-root-typecheck.log`、`sa3-issue436-root-test.log`、
`sa3-issue436-reanchor-neutrality.log`、`sa3-issue436-probe.log`、`sa3-issue436-probe-flip.txt`、
`sa3-issue436-recheck-diff.patch`（SA8 复查清单 ①/② 的 diff 材料）、`sa3-issue436-sa6-trio-md5.txt`。

## SA2 Finding 落实

| Finding ID | Implementation | Result |
|---|---|---|
| **F-1（MAJOR）** 两条既有恒绿测试钉死 Δ1 旧义 | P-1（W5）：`W5_TEXT` 仅 schema 文本改 union 数组；P-2（对称面）：新增局部 `TEXT_LIB_ITEM_UNION` 并只改该用例 fixture。两处断言语义面**零放宽**（P-1：`ok:false` + `issues.length>0` + `stateBytes` 不变；P-2：`ok:false` + 零写入 + `ev.count===0` + `length===3`），seed/污染/操作逐字保留；注释载授权链（ADR 0033 决策 1/4 + ADR-0007 注记，同批） | 完成；**两态绿**已实测：实现前（src 暂存回 HEAD）两文件 47 passed（`artifacts/sa3-issue436-reanchor-neutrality.log`），实现后同 47 passed。文件内其余用例（W1–W4/AC-6、A-1..A-7、R 组）零触碰 |
| **O-1（MINOR）** ADR-0007 注记默认执行 | 注记随实现同批落地（§Changed paths），未走豁免路径 ⇒ 无需 Controller 裁决引用 | 完成（R7 docs 义务项材料 = `artifacts/sa3-issue436-recheck-diff.patch`） |
| **O-2（MINOR）** 既有测试面扫描结论 | 直接消费设计 §12.1 结论（钉死 Δ1 = 恰 P-1/P-2；Δ2 = 零条）；本轮的实测反证 = 根 `pnpm test` 464 files/5647 tests 全绿（除契约外零意外翻红，等价于再验证「恰两条」） | 完成 |
| **O-3（MINOR）** 伪代码裸 `values` / 未声明 `commit`/`facts` | fast path 按修订稿：`const values = mutation.values!`；`let commit: PreparedCommit` / `let facts: BoundaryCommitFacts` 局部声明；复用既有 `failIssue`/`walkResultIssues` | 完成（逐行一致） |
| **O-4（MINOR）** 闸门 `resolve` 抛错分类 | 闸门 `resolve(boundaryNode)` 与 legacy `walk` 内 `resolve` 同处 `prepareLocalMutation` 单 try、同 catch 面 ⇒ 同分类 E204（`DerivedInvariantError` 收编路径未动）；代码注释显式登记；未新增可达向量（同一节点对象，正常 schema 恒不抛） | 完成 |

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/doc-runtime/src/mutation-local.ts` | ALLOW 第 1 行 | 闸门 + fast path + 类型面 + 注释 |
| `packages/doc-runtime/src/install-verify.ts` | ALLOW 第 2 行 | 事实核抽取 + VerifyPlan/verifyPrepared |
| `packages/doc-runtime/src/mutation.ts` | ALLOW 第 3 行 | 类型面 + 两处验证调用 + 阶段 C 判别 |
| `packages/doc-runtime/src/extract.ts` | ALLOW 第 4 行（**条件项**，取「@internal 导出助手」一侧；mutation-local 内联一侧**未取**，符合「不得两端都改」） | 反文案漂移的载体错位 issue 构造助手 |
| `docs/adr/0007-logical-validation-and-yjs-runtime-bridge.md` | ALLOW 第 5 行（**无条件**，O-1） | ADR 0033 修订注记 |
| `packages/doc-runtime/test/apply-validated-mutation-fatal-contract.test.ts` | ALLOW 第 6 行（定向修订） | 仅 W5 用例重锚 |
| `packages/doc-runtime/test/issue-237-path-localized-validation-red.test.ts` | ALLOW 第 7 行（定向修订） | 仅对称面用例重锚 |

未触碰的 DENY 面（实测核对）：SA6 三件套（md5 见上）、两定向文件其余用例、`packages/vfsl/**`、
`packages/doc-runtime/src/index.ts`（公共导出面零变化——`public-surface-guard.test.ts` 绿）、
信封面/guard 区、`materialize/replace/create-initial-document/schema-replace/read`、
`packages/namespace-runtime/**`、`packages/namespace-diagnostic-log/**`、`apps/**`、
`docs/adr/0033-*.md`、`docs/adr/0010-*.md`、`CONTEXT.md`、`docs/vfsl/**`、`docs/protocols/**`、
`vitest.config.ts`、`tsconfig*.json`、`pnpm-lock.yaml`、各包 `package.json`。
`git status` 交付面 = 恰上表 7 个 M 文件（+ SA6 既有 untracked 面 + 本轮证据日志）。

## Verification

| Command | Result | Evidence |
|---|---|---|
| `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/doc-runtime/test/issue-436-array-fastpath-contract.test.ts packages/doc-runtime/test/issue-436-array-fastpath-control.test.ts` | **exit 0；2 files / 25 tests passed**（契约 8/8 转绿 + 负控 17/17 保绿）；`Type Errors: no errors` | `artifacts/sa3-issue436-focused-final.log`（实现前同命令 = 8 failed / 17 passed，`artifacts/sa6-issue436-focused-final.log`） |
| 契约红因逐条转绿核对 | FA1/FA2/FA3：污染数组 insert/delete（含批内）`ok:true` + 恰 1 update + 污染保留（Δ1 目标行为）；FB1/FB2：append 读计数 **1**、delete **0**（n=512 与 n=4096 相等，≤8）；FB3：越界 insert/delete 读计数 **0**（≤4）+ 域 message/path 逐字；FC1/FC2：区间外篡改不抛 fatal、`ok:true`、doc 保持篡改态 | 同上 + `artifacts/sa3-issue436-probe-flip.txt`（同一现象的探针面读数：reads=1/0、thrown=undefined） |
| 负控保绿核对 | NA1–NA4（union 数组目标/穿越永久 legacy：污染照旧拒绝 + 零写入零 update、区间外篡改照旧 E201-C、干净写照常）、NB1–NB4（事实核两轨保留：长度算术/插入项同一性 E201-C；NB4 union legacy 同款）、NC1–NC5（域规则逐字 + 一切拒绝零写入零 update + 批量干净 op ok）、ND1–ND4（终态/增量字节 ≡ 同 clientID 手写最小 edit + 复制面收敛） | 同上 |
| `npx tsc -p packages/doc-runtime/tsconfig.json` | **exit 0** | `artifacts/sa3-issue436-package-tsc.log` |
| `pnpm typecheck`（根，15 包 tsconfig） | **exit 0** | `artifacts/sa3-issue436-root-typecheck.log` |
| `pnpm test`（根 = `vitest run --typecheck`，AC7 门） | **exit 0；464 files passed / 5647 tests passed；Type Errors: no errors**（= SA6 post-contract 基线计数；重锚为改写非新增 ⇒ 计数不变；失败面 8→0） | `artifacts/sa3-issue436-root-test.log` |
| 两态判据（设计 §12 AC7）：src 暂存回 HEAD + 已重锚/注记在位，跑两重锚文件 + 契约 | 两重锚文件 **47 passed**（实现前绿 ⇒ 重锚实现中性）；契约 **8 failed**（实现前失败面恰 = 契约 8 条，无第 4 方） | `artifacts/sa3-issue436-reanchor-neutrality.log` |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-436_sa6_capability_probe.mts` | **exit 1；38 checks = 26 PASS / 12 FAIL**；12 FAIL 恰 = G 组（探针自标注「HEAD 现状 / fast path 未接线」的能力缺口断言），其观测值逐条 = 契约目标行为；探针自标注「post-change 必须不变/必须保持」的 U(7)/S(3)/O(5)/N(10) 组 + G2d(1) **全绿** | `artifacts/sa3-issue436-probe.log` + `artifacts/sa3-issue436-probe-flip.txt`；**偏差说明见下** |

## Deviations or blockers

**D-1（唯一偏差，非实现缺陷；请 SA4/SA7 裁决，SA8 复查清单③不涉）**：SA6/设计 §12.2 第 8 条与
SA6 §13 的绿色判据含「探针 exit 0 不变」。该判据在实现后**结构性不可达**：

- 探针自身头部纪律即把 G 组定义为「HEAD 现状（doc-runtime 数组写一律走 legacy 全量边界路径）：
  …fast path 未接线」（`task_issue-436_sa6_capability_probe.mts` L5–L10），并把 U/S/O/N 组标注为
  「post-change 必须不变 / 必须保持」。即探针是**变更前缺口诊断**，其 G 组断言「缺口存在」；
  本票的实现正是关闭该缺口 ⇒ G 组必翻。
- 实测 12 FAIL ≡ G1a/G1b/G1c（污染数组不再阻断 → `ok:true`）、G2a/G2b/G2c ×{512,4096}（读计数
  `1`/`0`，替代 1026/1023/512）、G5（n=10³ 0.2ms vs 10⁵ 0.3ms，×1.4，替代 ×89.2）、G4a/G4b
  （区间外篡改不再 E201，`thrown=undefined`）——**每条观测值都恰等于契约 §12.2 的目标行为**，
  与 FA/FB/FC 组断言一致，不是回归。其余 26 项（U/S/O/N + G2d）全绿。
- 处置：**未**修改探针或契约（修改探针 = 破坏变更前证据并等同于改写验收语义；SA6 §14 明示探针
  不在 vitest include 面、不参与门禁，仅作可执行证据）。本项按「check 与实现目标冲突」如实记录，
  建议 SA4/SA7 采纳口径：「探针 exit 0」的现役含义应为**U/S/O/N 组 + G2d 保持 26/26 绿，G 组
  12 项按设计预期翻转为目标行为」；若需机器判据，由 SA6 另出**变更后**探针（G 组改写为目标行为
  断言），SA3 不越权改写 SA6 证据。
- 无其他偏差：实现严格落在 ALLOW LIST；无新增公共导出；无 env override/fallback/吞错/skip；
  未改动任何既有断言语义；未使用 write-then-undo。

**同变更集纪律（SA8 §8.1）**：ADR-0007 注记 + P-1/P-2 重锚 + fast path 实现在同一工作区变更集
内落位（7 文件未提交，`git status` 可核）；SA8 复查清单 ①/② 的 diff 材料见
`artifacts/sa3-issue436-recheck-diff.patch`。

**docs 义务独立扫描（`docs/AGENTS.md` 义务句；复核 SA8 §2 结论）**：`grep -rn "不逐元素\|一次整体判定\|数组位"`
于 `docs/` + `CONTEXT.md`（排除 ADR 0033 自身）——陈述旧数组语义的**唯一残留面 = ADR-0007 #237
修订节条款 1（L77）/条款 4(ii)（L102）**，已被本次注记（L133/L135）按非 union `T[]` 显式修订；
`CONTEXT.md` L144 为「指向该节的转引 + ADR-0033 数组位例外」两段（后者已是目标态），注记落地后
转引自洽，无需改词；其余命中（`docs/integration/...`、ADR-0010）与数组校验语义无关。⇒ 无遗漏
的义务面，且未触碰 CONTEXT.md/ADR-0033/ADR-0010（DENY 面）。

## Deferred verification

- SA4/SA7 的独立复核、动态验证与最终验收（含本表全部结论的再验证）。
- D-1 的口径裁决（探针变更后判据形态）——归 SA4/SA7/SA6，SA3 不自行改写。
- SA8 实现后冲突复查（`requiresConflictRecheck=true`）：① 注记文案与 ADR-0007 条款 1/4(ii)/7、
  ADR 0033 决策 1–4、ADR-0010 L345–347 引句的一致性；② 重锚 diff 面（仅 schema 文本/局部常量/
  注释授权链/锚定载体，断言零放宽）。本轮已备好材料，不自裁。
- ADR 0033 决策 6 的毫秒级性能证据（n=10⁵ 解耦）继续为软证据（探针 G5 已显示 ×1.4），不入门禁。

## Suggested commit message

```
feat(doc-runtime): 数组写按闸门分流 fast path 并收窄 S9 重投影核（issue #436 / ADR 0033）

- mutation-local: 非 union `T[]` 目标走 fast path（F1 载体 O(1) / F2 live 长度 O(1) /
  F3 vfsl 逐元素接缝 O(k) / F4 detached 构造 / F5 收窄验证计划）；union 数组目标与
  两树分歧永久回退 legacy 全量边界路径（原代码逐字保留）
- install-verify: 安装事实核抽取为 verifyBoundaryInstallFacts 共享单实现；新增
  VerifyPlan 判别联合（boundary / install-facts）+ verifyPrepared 分派器
- mutation: MutationPrepared/BatchItem 验证面改 VerifyPlan；composeBatchVerify 对
  install-facts 项跳折迭（引理 3：严格前缀结构性零命中）
- extract: 载体错位 issue 构造助手 @internal 导出（fast path F1 与 walk 首错同文案同 path）
- tests: W5 与 issue-237 对称面两用例定向重锚到 union 数组 legacy 载体（断言零放宽，
  授权链 = ADR 0033 决策 1/4）
- docs(adr): ADR-0007 #237 修订节追加 ADR 0033 修订注记（非 union T[] 逐元素/触达面收窄，
  union 与其余边界种类逐字保持）

验证：契约 8/8 转绿、负控 17/17 保绿、包 tsc exit 0、根 pnpm typecheck exit 0、
根 pnpm test 464 files/5647 tests 全绿（Type Errors: no errors）。
```
