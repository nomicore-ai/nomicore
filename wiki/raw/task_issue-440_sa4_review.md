# SA4 实现静态审查 — issue #440：vfsl 逐 entry 校验扩展（Record + 封闭对象 delete）与一致性 fixture 扩展（ADR 0034）

- 角色：SA4（实现静态审查 / Red Team）｜iteration 0｜2026-09-22
- 被审对象：SA3 实现（`git diff` @ worktree `mabf/issue-440`，HEAD `0a91f14`，2 files changed / 151 insertions / 0 deletions）+ SA6 冻结测试四件
- 审查基准：`wiki/raw/task_issue-440.md`（简报）、`_design.md`（SA1）、`_sa2_review.md`（approve）、`_sa6_contract.md`（approve 契约）、`_sa6_capability_probe.mts`、`_design_conflict_report.md`（SA8 verdict clear，R1–R4）
- 方法：只读静态审查——源码逐行比对、Git 只读命令、md5 复算、证据日志实读；未运行测试、未启动服务、未修改任何被审产物（唯一可写产物 = 本文件）

## 1. Reviewed inputs

| 输入 | 状态 | 核验方式 |
|---|---|---|
| `wiki/raw/task_issue-440.md` | 在场 | 全文读取；AC1–AC6 + What to build + Blocked by #437；REST comments 空（无 owner 需求面） |
| `wiki/raw/task_issue-440_design.md` | 在场 | 全文读取；§7.2 D1–D7、§8.1 管线、§10 ALLOW/DENY 逐项对照实现 |
| `wiki/raw/task_issue-440_sa2_review.md` | 在场 | 全文读取；verdict approve、3 条 MINOR 的落实情况核对 |
| `wiki/raw/task_issue-440_sa6_contract.md` | 在场 | 全文读取；§12.1 B-1…B-6、§13 绿判据、§16 冻结指纹 |
| `wiki/raw/task_issue-440_sa6_capability_probe.mts` | 在场 | md5 复算（见 §6）；G1–G5/REF/O/NC 机制读解 |
| `wiki/raw/task_issue-440_design_conflict_report.md` | 在场 | 全文读取；R1（ADR 0007 注记，doc-only 归 #441 前）/R2（范围）/R3（探针口径）/R4（实现期清单）逐条核对 |
| `wiki/raw/task_issue-440_sa3_impl.md` | 在场 | 全文读取；声明与实际 diff/证据日志交叉核验 |
| SA6 冻结测试四件 | 在场 | contract（460 行）/control（327 行）/fixture（688 行）/test-d（51 行）逐断言读解 + md5 复算 |
| 源码 | 在场 | `validate-patch.ts`（全文 1289 行，重点 712–826/900–1025/1037–1289）、`validate.ts`（40–60/130–190/236–253/630–700/700–770）、`resolve.ts`（walkRefChain）、`derived.ts`、`index.ts`、`semantic.ts`（E106/E308）、根 `vitest.config.ts`、`tsconfig.typecheck.json`、`packages/vfsl/{package.json,tsconfig.json,AGENTS.md}` |
| 证据日志 | 在场 | `artifacts/sa3-issue440-{focused,vfsl-typecheck,root-typecheck,root-test,probe-post}.log` 逐件实读（head/tail/关键行 grep） |
| `task_issue-440_relevant_decisions.md` / `_conflict_report.md` | **不存在** | iteration 0 无 SA8 预检工件（SA6 §1/设计 §6/SA8 报告 §2 三方同口径）；SA8 职能由 `_design_conflict_report.md` 兼采——不构成阻塞 |

## 2. Verdict

**approve**。实现是忠实的纯加法落地：SA6 契约 26/26 转绿、负控 19/19 保持绿、test-d 类型红转绿、根 `pnpm typecheck` / `pnpm test` exit 0（证据日志实读核验，内部自洽）；五件冻结产物 md5 逐字节恒同（本次独立复算）；既有 23 运行时导出与 #435 签名面零改动；判定语义经 `validateSubtree` 单源继承、两条域规则文案与 legacy 逐字节一致（本次独立比对 `validate-patch.ts:977` / `validate.ts:680` / `validate.ts:253`）。无 BLOCKER、无 MAJOR；4 条 MINOR 级观察（§12）不阻断。探针 exit-0 字面判据的例外按设计 §13 残余 1 / SA2 观察 1 / SA8 R3 已立法口径核验成立（`sa3-issue440-probe-post.log`：恰 G1.1/G1.2 红、其余 25 项绿）。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| AC1 Record set：键 Pattern 违规、新值非法写入前拒绝；issue 路径 `[...mapPath, key, ...]` 与全量逐字节一致 | `validate-patch.ts:1281-1287`：单 entry 视图 `{[key]: value}` 过 `validateSubtree(derived.values, node, proposed)`，issue 经 `[...plan.prefix, ...issue.path]` rebase（与 legacy `validateBoundary`:1019-1023 同式）；契约 B1–B5/B7 转绿（`sa3-issue440-focused.log` L6；root-test L623 `✓ …contract.test.ts (26 tests)`） | 落实。键 Pattern/值消息/序/截断全部单源继承自 `validate.ts:655-667/253`，零消息复制 |
| AC2 Record delete：仅在场/no-op 域规则，不触碰其他 entry | `validate-patch.ts:1275-1277`：`has ? {ok:true} : singleIssue('delete 目标键不存在（拒绝 no-op）', entryPath)`；契约 C1–C5 转绿 | 落实。文案与 legacy `:977` 逐字节一致（本次复算）；不查键 Pattern（C4）、不读其他 entry（C3/E2） |
| AC3 封闭对象 delete 静态规则全矩阵 | `validate-patch.ts:1178-1195`（`judgeClosedObjectDelete`）+ `:1265-1273`（parent 分派：no-op 先行）；契约 D1–D6 转绿 | 落实。镜像 `validate.ts:670-682` 次序（optional 先查 → ref 解析 → unknown 标量跳过 → 必填拒）；`缺少必填字段 "${key}"` 与 `validate.ts:680` 逐字节一致 |
| AC4 一致性 fixture 两形态逐字节一致 | 契约 E1（107/107）/E2（10/10 可分）/E3 转绿（focused log 45/45 含 E 组）；负控 NC4 保持绿 | 落实。fixture md5 `ce86199a…` 未动（SA6 §16 登记，本次复算一致） |
| AC5 公开面只经包公共入口导出，guard 覆盖新导出 | `index.ts` diff：`validate-patch.js` 值导出块 +`applyElementwiseEntryMutation`、类型块 +`EntryCarrierFacts`/`ElementwiseEntryMutationPayload`、#435 注释块后追加 #440 注释；A1（自有导出键断言）+ test-d + NC5 超集锚全绿 | 落实。包纪律「公共 API 只经 src/index.ts」满足；23 既有导出在场（probe-post log L5：24 导出 = 23+1） |
| AC6 包测试 + 根 typecheck/test 绿 | `sa3-issue440-focused.log`（45/45，`FOCUSED_EXIT:0`）、`-vfsl-typecheck.log`（`VFSL_TSC_EXIT:0`）、`-root-typecheck.log`（`ROOT_TYPECHECK_EXIT:0`）、`-root-test.log`（469 files/5712 tests，`ROOT_TEST_EXIT:0`；基线 466/5667 + 45 = 数字对账成立） | 落实（静态采信证据日志；见 §11 动态复跑项） |
| ADR 0034 决策 1（闸门/union 永久 legacy/值位 union 不排除/旧值不读） | 闸门四条件 `:1226-1248` fail closed；F2/F3 转绿；set 不读 `facts.has`（B6） | 落实 |
| ADR 0034 决策 2（静态必填矩阵，不读父值） | `judgeClosedObjectDelete`；D1–D6 转绿 | 落实 |
| ADR 0034 决策 3（`ValidateResult` 直出，无 `proposedBoundary`） | 返回类型 `ValidateResult`（`:1224`）；A2 `Object.hasOwn(result,'result')===false` 断言过；test-d L50 负面夹具命中 | 落实 |
| ADR 0034 决策 4（触达面 = 载体 + 目标键位） | 输入面只收 `{has}`（`:1250`）；E2/E3 + NC7 对照 | 落实（端到端钉正归 #442，Blocked-by 链一致） |
| ADR 0034 决策 5（fixture 执法、禁 map 级约束） | E1/E2/E3 转绿 + NC4/NC6 保持绿 | 落实 |
| SA8 R2（仅 validate-patch.ts #440 节 + index.ts 导出 + 证据日志；冻结 md5 恒同；23 导出不变） | `git status --short`：生产改动恰 2 文件；md5 复算 5/5 一致 | 落实 |
| SA8 R3（探针 G1 翻红口径） | `sa3-issue440-probe-post.log`：恰 G1.1/G1.2 FAIL（断言导出缺席——缺口正向闭合），G2–G5/REF/O1–O3/NC1–NC2 全 ok，`PROBE_EXIT:1` | 落实（探针文件未修改，md5 一致） |
| SA8 R1（ADR 0007 修订注记，doc-only，最迟 #441 前） | SA3「Deferred verification」第 2 条如实登记；本票零 doc-runtime 改动（grep 复核：`applyElementwiseEntryMutation` 在 doc-runtime 零引用），代码与 ADR 0007 现行措辞仍一致 | 正确延期（归立法路径/#441 前时点，非本票范围） |
| SA2 Required revisions | 无 BLOCKER/MAJOR；3 条 MINOR 的处置见 SA3 报告「SA2 Finding 落实」——MINOR 1 探针口径已落实、MINOR 2 常量提取未采纳（理由：避免在负控锚定的 legacy 冻结面 `:941-981` 上扩 diff；双锚 NC1.3/NC1.4 + E1 逐字节已覆盖漂移风险，本次验证 NC1 19/19 绿）、MINOR 3 闸门文案原样采用 | 落实/合理豁免（可选优化，非义务） |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| D1 签名与冻结名目（B-1/B-2/B-3/B-4） | `validate-patch.ts:1161`（`EntryCarrierFacts = { readonly has: boolean }`）、`:1167-1169`（载荷词表恰两支）、`:1219-1224`（`applyElementwiseEntryMutation(derived, plan, facts, payload): ValidateResult`） | 与 SA6 §12.1 绑定点逐字一致；test-d `toEqualTypeOf` 断言 + 3 条 `@ts-expect-error` 全命中（root-test L10 `✓ TS`） | — |
| D2 Record set = 单 entry 视图过共享解释器 | `:1281-1287`：`{ [key]: raw?.value }` → `validateSubtree` → rebase `[...plan.prefix, ...i.path]`；计算键展开（`'__proto__'` 落自有属性，JS 计算键语义核实） | 与设计伪代码逐字符同构；rebase 式与 legacy `validateBoundary:1023` 完全相同；等价论证的规范基础（Record 无 map 级约束，`validate.ts:655-667` 实核：逐键 keyPattern + 逐值校验、全收集、键先值后）成立 | — |
| D3 Record delete = 仅域规则 | `:1275-1277` | 文案/路径与 legacy `:977`（`issueAt(..., plan.relPath)` → `[...prefix, key]`）逐字节同源 | — |
| D4 封闭对象 delete = 静态必填判定 | `:1178-1195` + `:1272-1273`（no-op 先于静态判定） | `field.value.kind === 'optional'` 先查 → `walkRefChain(field.value, valueLens(derived.values))`（与 `resolveValues`=`validate.ts:147-149` 同算法同文案；memo 参数可选、缺省仅影响性能不影响结果——`resolve.ts:87-106` 实核）→ `scalar ∧ unknown` 跳过 → 必填拒；缺字段 fail closed（新面文案，规划层不可达：NC2.4 锚定） | — |
| D5 触达面输入表达 | `:1250`：只读 `facts.has`，结构上不携带其他 entry/父值 | 落实 | — |
| D6 一致性 fixture 执法 | fixture 未改（md5 一致）；E1/E2/E3 转绿 | 落实 | — |
| D7 公开面纪律 | `index.ts` 追加 3 名；`validate-patch.ts` 复用既有私有助手（`singleIssue`:1063、`wrapElementwise`:1142、`valueLens`:81、`walkRefChain` import:39、`validateSubtree` import:41），零新 import、零模块级状态、零 Yjs 引用 | 落实 | — |
| §8.1 闸门管线次序 ①→④ | `:1226-1234`（①a/①b 合并查 kind∈{record,parent} ∧ relPath 单段 string，message 携带实参）→ `:1236-1241`（②node.kind=object）→ `:1242-1248`（③kind↔形态一致：record ⇒ `<key>` 槽 ∧ parent ⇒ 无）→ `:1250-1253`（④facts 守卫 @ `[...prefix]`）→ `:1255-1262`（⑤载荷词表守卫 @ `[...prefix]`）→ `:1263-1273`（⑥parent∧set 拒 @ entryPath 后分派） | 与设计管线逐条对应；守卫次序、路径、fail-closed 方向一致；闸门 message①–⑥ 原样采用设计建议文案（SA6 §15.3 不冻结，仅钉 `ok:false ∧ 带 issue ∧ 不抛`，F1–F3 全绿证实） | — |
| §7.1 纯加法 / 回滚 | diff 无删除行；既有函数/导出零字节改动 | 成立（移除 #440 节 + 3 导出名即回 HEAD 行为） | — |
| 实现自决细节：敌意通道语义读取（facts/payload 可为 null/undefined/畸形） | `:1250`（`(facts as … | null | undefined)?.has`）、`:1255-1256`（`(payload as …)?.op`） | SA3 已如实登记为「设计未强制、实现自决」；行为面与设计 §8.1 ②③ 完全相容（守卫响亮拒绝而非 E100），更确定性；冻结断言未覆盖该形状，无契约影响 | MINOR（观察 5，备案） |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| Record/parent 逐 entry 判定语义 | `@nomicore/vfsl` | `validate-patch.ts` #440 节（#435 节后追加，同文件同布局） | 正确；与数组位先例同构，零 Yjs 关切 |
| 在场性 O(1) 事实采集（`Y.Map.has`/`hasOwn`） | doc-runtime（#441 接线） | 本票零接线（grep 复核 doc-runtime 无新导出引用） | 正确移交（Blocked-by 链） |
| 判定语义单源 | `validate.ts` 共享解释器 | set 支直调 `validateSubtree`；parent 支镜像 `validate.ts:672-681`（同文件同款 `valueLens`/`walkRefChain`） | 正确；无第二解释器 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| 数组逐元素接缝（#435/ADR 0033） | `applyElementwiseArrayMutation`（`validate-patch.ts:1082-1139`：闸门 → 事实守卫 → 载荷守卫 → 域规则 → 逐值 → `wrapElementwise`） | `applyElementwiseEntryMutation`（`:1219-1289` 同构管线 + 同命名族 `EntryCarrierFacts`/`ElementwiseEntryMutationPayload`） | 一致 | ADR 0034 §6「复用而非另起平行机制」；#435 面零改动（diff 实核 + NC5.2 绿） |
| SA6 见证实现 | 探针 `witness()`（单 entry 视图 / 静态必填） | D2/D4 即见证语义面的直接实现，且补齐 ref 链解析 | 一致且更严 | 干跑 26/26 → 实现 26/26，同一断言面 |
| 路径级接缝（`applyMutationAtBoundary`） | 边界值驱动全量判定 | 不复用不修改（纯加法并列） | 一致 | E1 以其为 oracle 逐字节对照 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| Record 判定语义（键 Pattern/值/消息/序/截断/预算） | `validate.ts` 解释器 | 无镜像（直调 `validateSubtree`） | 无；`期望整数区间 [0, 100]，实际 101` 等冻结常量本次溯源到 `validate.ts:253` 单点 |
| 封闭对象必填语义 | `validate.ts:670-682` | `judgeClosedObjectDelete` 镜像（同文件同款 `valueLens`——validate-patch.ts:81 既有，非本次新增重复） | 低：NC1.4 常量锚 + E1 逐字节双锚 |
| delete 域规则文案 | `validate-patch.ts:977` | `:1272/:1277` 字面复用 | 低：NC1.3 常量锚；SA2 MINOR 2 的可选常量提取未采纳（理由成立：避免触碰负控锚定的 legacy 冻结支） |
| 计划形状 | `planMutationBoundary`（`:742-825`） | 接缝只消费不重算 | 无 |

### 生命周期对称性

纯函数：无 register/dispose、订阅、事务、后台任务、IO/时钟/网络；一切中间态（合成视图、透镜实例）调用局部即弃；`wrapElementwise` 是唯一崩溃边界。回滚 = 删节（§4 纯加法）。不适用面如实标注——无缺口。

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 第二套校验解释器 | `validateSubtree` | 无（直调） | 不构成 |
| 第二套崩溃边界 | `wrapElementwise`（#435） | 复用同款 | 不构成 |
| 第二套域规则 | legacy delete 支 | 同文件字面复用冻结文案 | 不构成（双锚覆盖漂移） |
| 第二套测试入口 | 根 vitest include | 冻结测试已在真实发现面 | 不构成 |

## 6. 文件范围审查

`git status --short` + `git diff --stat`（只读）：生产改动恰 2 文件（151 insertions / 0 deletions）；untracked 新增 = SA3 证据日志 5 件 + 上游（SA6/SA1/SA2/SA8）工件 + SA3 报告 + SA6 阶段证据/测试（本就 untracked）。无 stash、`.scratch/` 仅含 checkout 期既有目录 `vfsl-v1-parser`、`.worktrees/` 空、`git worktree list` 仅主仓 + 本 worktree。

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/vfsl/src/validate-patch.ts`（+143：头注 3 行 + #440 节 140 行） | 设计 §10 ALLOW 行 1 | 接缝本体（类型 ×2 + 私有助手 + 公共接缝） | 合规；纯尾部追加 + 头注，#435 节及既有函数零字节改动 |
| `packages/vfsl/src/index.ts`（+8：注释 5 行 + 导出 3 名） | 设计 §10 ALLOW 行 2 | 公共入口（AC5） | 合规 |
| `artifacts/sa3-issue440-{focused,vfsl-typecheck,root-typecheck,root-test,probe-post}.log` | 设计 §10 ALLOW 行 3（`artifacts/sa3-issue440-*.log`） | 实现证据 | 合规（5 件全在 glob 内） |
| `wiki/raw/task_issue-440_sa3_impl.md` | SA3 技能规定角色产物（不在 DENY） | 实现报告 | 合规 |

**DENY 核对（逐项零触碰）**：五件冻结产物 md5 本次独立复算——fixture `ce86199a85f7787dcca529a87ff72408`、contract `a595c8ae4a2bd02cfcd1ed95375c514b`、control `46829054dc02ff6e9d1f2b760b84bea6`、test-d `0fe31a97f9207ef183b4e5a04305b9d9`、探针 `0b5980411662eab9b8964f0f1283ad33`——与 SA6 §16 登记全部一致；`validate.ts`/`derived.ts`/`resolve.ts`/`pattern.ts`（`git diff` 无条目）；`packages/vfsl/test/issue-435-*`（test 目录仅新增 issue-440 四件）；`packages/doc-runtime/**`/`namespace-runtime/**`（grep 零引用）；`docs/adr/**`/`CONTEXT.md`/`docs/vfsl/**`（status 无条目）。**越界 = 零**。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| `@nomicore/vfsl` 公共面 +1 值导出 +2 类型导出 | 编译期全部消费者 | 纯加法超集；既有 guard 全部为超集/负名断言（NC5.1 23 名、`render-projection-text-control` C1、#435 NC6 等），root test 469 files 全绿证明零破坏 | 无 | — |
| `applyElementwiseArrayMutation`（#435 冻结签名） | doc-runtime `case 'array'`（#436 已接线） | 零改动（diff 实核 + NC5.2 绿） | 无 | — |
| `planMutationBoundary` / `applyMutationAtBoundary` / `validateSubtree` / `validatePatch` 家族 | doc-runtime S6 等 | 零改动；负控 NC1–NC3/NC7 19/19 绿锚定 legacy 轨行为不变 | 无 | — |
| 新接缝自身（未来消费者 #441 doc-runtime、#442 lease） | 本票不存在 | 返回 `ValidateResult` 直出、同步纯函数、E100 崩溃边界 path `[]`（家族同款，见观察 1） | 低 | MINOR（观察 1） |
| 返回/抛错/nullable/异步/取消/生命周期 | 既有调用方 | 全部不变（纯加法；新面自身同步纯函数不抛错） | 无 | — |

## 8. 错误、恢复与并发

- **无静默 `ok:true`**：闸门/守卫/缺字段/域规则全响亮（`:1230/:1237/:1244/:1252/:1258/:1267`）；F1–F3 断言六类违约计划 + 违约载荷 fail closed，全部 `ok:false ∧ issues.length>0 ∧ 不抛`——静态推导每支均命中（union/array/target/手造 kind → ①；relPath≠[string] → ①；node 非 object → ②；形态不一致 → ③；facts 非布尔 → ④；array-* 载荷 → ⑤；parent+set → ⑥）。
- **E100 崩溃边界**：`wrapElementwise:1142` 收编 seam 本地异常（如手造派生物 ref 环——`walkRefChain` 抛 `InternalError`，文案与 `validate.ts:142-143` 透镜一致）。可达性收窄双证：`semantic.ts:120` E308 拒绝对象字段重名、`:128-166` E106 拒绝引用图成环——合法 derived 上 ref 环/缺名不可达，该边界仅服务可信域畸形输入（ADR 0016 家族纪律）。
- **并发/幂等**：同步纯函数、零共享可变状态、同输入恒同输出（fixture 种子冻结）；「重试」= 再次调用，幂等。
- **纯度**：`plan`/`derived`/`facts`/`payload` 零突变（A2 JSON 前后比对断言过；实现仅展开拷贝 `[...plan.prefix, …]`，`singleIssue` 内部再拷贝 path）。
- **对抗输入**：`__proto__` 计算键落自有属性（JS 语义核实，`Object.keys` 可见、无原型污染面）；`undefined` 新值过值 schema 响亮型错（与 legacy `{...base,[key]:undefined}` 同判）；敌意 facts/payload（null/`{}`/字符串）经守卫 ④⑤ 响亮拒绝（观察 5）。
- 静态无法确认的运行风险列入 §11（无——本票为纯函数面，无进程/持久化/时序面；仅证据日志复跑一项）。

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| `issue-440-elementwise-entry-contract.test.ts`（26，SA6 冻结） | A1 自有导出键 + typeof；A2 `{ok:true}` 直出/无 result 包装/plan 零突变；B1–B7 键 Pattern+值矩阵（冻结常量 `期望整数区间 [0, 100]，实际 101`、`Record 键 "nope" 不满足 Pattern 正则 /^(id-[0-9]+)$/`、键先值后序、值位 union 仲裁、has 翻转恒同、嵌套 rebase）+ oracle 逐字节；C1–C5 域规则；D1–D6 静态必填全矩阵；E1 107 例逐字节、E2 判据敏感、E3 触达面目标行为；F1–F3 闸门 fail closed | 根 `pnpm test` include `packages/*/test/**/*.test.ts`（`vitest.config.ts:15`）；显式聚焦命令亦真实（focused log） | 无 skip/only/todo（grep 零命中）、零 env override、零源码字符串断言（只观察运行时行为）、oracle 独立通道（`applyMutationAtBoundary`）；SA6 变异实验 M1b–M4（4/5/10/4 红）证明断言敏感 | — |
| `issue-440-elementwise-entry-control.test.ts`（19，SA6 冻结） | NC1 兼容面逐字冻结（含 `sa3-issue440-probe-post.log` G4 独立复算一致的三支 no-op/必填/union 消息）；NC2 规划闸门形状；NC3 legacy 输入契约；NC4 夹具自洽 + census；NC5 23 导出超集；NC6 立法前提；NC7 触达面对照 | 同上 | 实现后保持 19/19（focused log L7）——「红灯转绿且负控不破」双面成立 | — |
| `issue-440-elementwise-entry-fixture.ts`（117 例，非测试入口） | 等价集 107（26 参数 + 60 随机 mulberry32(440) + 21 矩阵）+ 触达面 10；census：accept 46/reject 61、set 46/delete 61、record 69/parent 38（SA6 §7 登记，NC4.2 运行时复核） | 供两测试文件与探针共用（零 vitest 依赖） | md5 恒同未动；「fixture 自证」由 oracle 逐字节 + 探针独立通道 + 变异实验排除 | — |
| `issue-440-elementwise-entry.test-d.ts`（SA6 冻结） | B-1…B-4 类型面：签名四参 + 返回、`EntryCarrierFacts` 恰 `{readonly has}`、词表两支、3 条负面夹具（省略 has / array-* 载荷 / result 包装） | `--typecheck` include `packages/*/test/**/*.test-d.ts`（`vitest.config.ts:20`，tsconfig `./tsconfig.typecheck.json` 含 `packages/*/test/**/*.ts`）；root-test L10 `✓ TS …(0 test)` 证实收集且绿；包 `tsc -p packages/vfsl/tsconfig.json` include `test/**/*.ts` 亦覆盖 | 无 | — |
| SA6 红灯基线（实现前） | 26 failed 全为 `Error: 能力缺口：@` 单一红因（SA6 §13 五轮 md5 恒同） | 同 contract 入口 | SA3 报告声明实现前复跑同结果——红因单一稳定 | — |

**测试行为质量结论**：SA3 未修改任何冻结测试（md5 逐字节复核）；红灯转绿由实现闭合能力缺口达成，非断言弱化；全部入口位于仓库真实发现面（vitest include + typecheck include + 包 tsconfig 三重实核）。**无效测试 = 零**。

## 10. Required revisions

| Finding ID | Severity | Evidence | Problem | Required change | Acceptance | Suggested routing |
|---|---|---|---|---|---|---|
| （无） | — | — | 无 BLOCKER / 无 MAJOR | — | — | — |

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| SA3 证据日志为静态采信（SA4 不运行测试） | Controller/SA7 在集成环境复跑聚焦 + 根 gates | `vitest run` 两文件 45/45；根 `pnpm typecheck` exit 0；根 `pnpm test` 469 files/5712 tests exit 0 | 任一失败或数字对账不成立（基线 466/5667 + 45） |
| #441 接线期消费面：E100 path `[]` 容忍 | #441（doc-runtime 分流） | 接线方对 fast-path 返回值按判别联合消费；E100（path `[]`，家族同款 #435）被上层诊断通道正常吸收，不假设 prefix 前缀 | 消费方按 `[...prefix, …]` 假设解析 fast-path issue path 且在 E100 分支崩溃/丢 issue |
| #441 行为翻转前 ADR 0007 修订注记（SA8 R1）落地 | 立法路径 | `docs/adr/0007` 含「ADR 0034 修订注记」后再合并 #441 行为翻转 | #441 合并时注记缺席（届时构成实现期冲突，SA8 已预警） |
| 10⁵ entry 性能基准（ADR 0034 决策 6 软验收） | #441 | 单键写判定耗时与 map 规模解耦 | 随 n 增长（本票只有结构面证据：输入不含其他 entry/父值） |

## 12. Non-blocking observations

1. **[MINOR] seam 本地 E100 的 path 未 rebase（`[]` vs legacy `[...prefix]`）**：set 支的 E100（源自 `validateSubtree` 内部）经 `:1284-1287` rebase 为 `[...prefix]`，与 legacy 逐字节一致；但 parent-delete 支 seam 本地异常（`judgeClosedObjectDelete` → `walkRefChain` 抛 InternalError）经 `wrapElementwise:1142-1148` 返回 path `[]`，而 legacy 同源异常在 `interpret` 内捕获后经 `validateBoundary` rebase 为 `[...prefix]`。仅手造派生物可达（E106/E308 使合法 derived 上 ref 环不可达——本次实核 `semantic.ts:120,128-166`），且与 #435 `wrapElementwise` 家族行为完全一致（设计 D4 明示「崩溃边界收编为 E100」，未钉 path）；ADR 0034 决策 3 面（返回直出）不受影响。无行动项；#441 消费方注意见 §11 第 2 行。
2. **[MINOR] 手造「重名字段封闭对象」角落的镜像分叉**：`judgeClosedObjectDelete:1184` 用 `find`（首个命中），`validate.ts:652-653` 用 Map（后名覆盖）+ `:672` 声明序全扫——重名字段（如 optional 在前、required 在后同名）下 seam 允许而 oracle 拒绝。E308（`semantic.ts:116-120`）使任何 evaluate 产物不可含重名字段，故仅手造派生物可达且两侧均响亮；设计 D4 原文即「fields 中 name === key 的声明字段」——实现忠实于设计。无行动项，备案 hostile-domain 角落。
3. **[MINOR] 探针 exit-0 字面判据与实现态不可同时满足**：SA6 §13 绿判据字面含「探针 exit 0」，而冻结探针 G1.1/G1.2 断言导出缺席、实现后必然翻红。设计 §12 末行/§13 残余 1、SA2 观察 1、SA8 R3 四处预声明同一解释口径；SA3 以 `sa3-issue440-probe-post.log` 留档（本次实读：恰 G1.1/G1.2 FAIL、其余 25 项 ok、`PROBE_EXIT:1`、24 运行时导出、NC2.2 超集仍绿）。处置正确；建议 Controller 在验收路由时继续传递该口径，避免 SA7 按字面误判。
4. **[MINOR] SA2 可选优化（域规则文案提取模块级常量）未采纳**：理由成立——提取须改 legacy `applyMutationAtBoundary:941-981` 两支（负控 NC1 锚定的冻结面），行为中性却在冻结面上扩 diff；双锚（NC1.3/NC1.4 常量 + E1 逐字节）已覆盖漂移风险且本次验证全绿。接受该取舍，非缺陷。
5. **[MINOR] 敌意通道语义读取（SA3 已登记的实现自决）**：`(facts as … | null | undefined)?.has` / `(payload as …)?.op` 使 null/`{}`/畸形 facts 与 array-* 载荷经守卫 ④⑤ 响亮拒绝（而非 TypeError → E100）。与设计 §8.1 ②③ 相容、更确定性、与包纪律「畸形输入走判别联合」一致；冻结断言面未覆盖该形状（F3 仅覆盖 array-* op），无契约影响。备案。

---

*SA4 只读审查：未修改任何实现、设计、测试或冻结产物；未运行测试/服务；未派发其他 SA。本文件为本次审查唯一新增产物。*
