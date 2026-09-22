# SA10 独立 Spec 审查 — issue #440：vfsl 逐 entry 校验扩展（Record + 封闭对象 delete）与一致性 fixture 扩展（ADR 0034）

- 角色：SA10（独立 Spec 审查者）｜phase：spec-review｜iteration 0
- 审查对象：**已提交交付 diff** `08497d9 feat(vfsl): validate record entry mutations`（分支 `mabf/issue-440`）
- 权威基线：parent PR 基 `spec/adr-0034-record-elementwise-validation` @ `0a91f1429c3818320eaacdf2a33d2a267d79620e`——`git merge-base --is-ancestor` 实测 **是 HEAD 祖先**（ANCESTOR_OK），diff 区间 `0a91f14..HEAD` 恰 1 提交
- 审查基准：`wiki/raw/task_issue-440.md`（Host 简报：What to build + AC1–AC6 + Blocked by #437）、`task_issue-440_sa6_contract.md`（approve 契约，B-1…B-6 冻结）、`task_issue-440_design.md` / `_sa2_review.md`（approve）/ `_sa3_impl.md` / `_sa4_review.md`（approve）/ `_design_conflict_report.md` + `_implementation_conflict_report.md`（SA8 两份均 clear）、母法 `docs/adr/0034-record-and-parent-elementwise-validation.md`（accepted @ 基线）、`docs/adr/0033`、`packages/vfsl/AGENTS.md`、`CONTEXT.md`
- Owner 评论面：`gh issue view 440 --json comments` 本次实读 → **`[]`**（state OPEN；与简报/派发指令「no owner feedback applies」一致）——无适用 owner 评论
- 方法：只读静态审查——交付 diff 逐行、冻结产物 md5 独立复算、证据日志实读、legacy 语义源码逐字比对、scope grep；未运行测试、未启动服务、未修改任何被审产物（本文件为唯一新增产物）

---

## 1. Verdict

**approve**。交付 diff 忠实满足 Issue #440 正文与 AC1–AC6、SA6 契约绑定点 B-1…B-6 逐字落位、ADR 0034 决策 1/2/4/5 在本票范围内全部兑现（决策 3/6 的接线与基准面按 Blocked-by 链正确归 #441/#442）；纯加法（生产面 2 文件 +151/-0），五件 SA6 冻结产物 md5 与 §16 登记 5/5 恒同，零 scope creep。唯一字面例外（探针 exit 0 判据）有设计 §13 残余 1 / SA2 观察 1 / SA8 R3 三处预立法口径支撑，且实现后探针留档（恰 G1.1/G1.2 红 = 缺口正向闭合，其余 25 项绿）。§6 列出 PR 必须披露的未达成/延期项（均非本票验收面缺口，不阻断 approve）。

## 2. 交付 diff 范围核验（独立实测）

| 面 | 实测 | 判定 |
|---|---|---|
| 生产代码 | `packages/vfsl/src/validate-patch.ts` +143（头注 3 行 + #440 节 140 行）、`packages/vfsl/src/index.ts` +8（注释 5 行 + 导出 3 名）；**0 删除** | 纯加法；与设计 §10 ALLOW 行 1/2 逐字一致 |
| 测试面 | SA6 落位四件（contract 460 行 / control 327 行 / fixture 688 行 / test-d 51 行）随交付提交；md5 本次独立复算 = SA6 §16 登记（fixture `ce86199a…`、contract `a595c8ae…`、control `46829054…`、test-d `0fe31a97…`、探针 `0b598041…`）**5/5 恒同** | 冻结验收面零改动 |
| 证据/wiki | `artifacts/sa3-issue440-*.log` 5 件 + `artifacts/sa6-issue440-probe.log` + 六件 wiki 角色工件 | 仓库既有惯例（#435 提交 `006e416` 同款范围） |
| DENY 面（设计 §10） | `validate.ts`/`derived.ts`/`resolve.ts`/`pattern.ts` 零 diff；`packages/vfsl/test/issue-435-*` 四件零 diff；`packages/doc-runtime/**`、`packages/namespace-runtime/**` 零条目；`docs/adr/**`、`CONTEXT.md`、`docs/vfsl/**` 零条目 | **越界 = 零**（grep 复核：`applyElementwiseEntryMutation` 在 doc-runtime 等消费方零引用——接线属 #441） |
| 排序前提（ADR 0034 决策 6 / Blocked by #437） | `ca0ab53`（PR #434，ADR 0033 家族）在 HEAD 祖先链实测成立；数组位产物在 HEAD 内容面全部在场（`validate-patch.ts:1039-1146` 接缝、`mutation-local.ts:40,348` doc-runtime 接线、`issue-435-*` 四测试文件） | 满足 |

## 3. AC 逐条判定（独立复核，非转述上游结论）

### AC1 Record set：键 Pattern 违规、新值非法均写入前拒绝；issue 路径 `[...mapPath, key]` 与全量路径逐字节一致 —— **MET**

- 实现（`validate-patch.ts:1281-1287`）：单 entry 合成视图 `{[key]: value}` 过共享解释器 `validateSubtree(derived.values, plan.node, proposed)`；键 Pattern 判定、值校验、键先值后全收集序、截断/预算/E100 全部**单源继承**自 `validate.ts:655-667`（Record 形态支）+ `:369-379`（`validateKeyPattern`）——零消息复制。
- issue rebase `[...plan.prefix, ...issue.path]`（`:1286`）与 legacy `validateBoundary`（`:1023`）**逐字符同式**；本次逐字比对 legacy set 支（`:957-963`：`rebuildAlong` 全量拷贝后同一 `validateSubtree` + 同一 rebase）确认：合法基线上两轨判定逐字节一致，唯一可观察差异 = 不收集其他键位 issue（= ADR 0034 决策 4 立法收窄，非偏差）。
- 契约 B1–B5/B7 转绿（`artifacts/sa3-issue440-focused.log` L6，45/45）；B2 常量锚 `期望整数区间 [0, 100]，实际 101` @ `['tasks','zz9','qty']`、B3 键 Pattern 文案逐字、B4 两 issue 键先值后、B5 值位 union 仲裁逐字复现、B7 嵌套 rebase——断言面全在场；E1 等价集 107/107 与全量 oracle 逐字节一致。
- 「写入前拒绝」在 vfsl 接缝面 = 纯函数判定先返 `ok:false`、零写入（实际提交面归 doc-runtime，#441 接线；与 #435 数组案同口径）。

### AC2 Record delete：仅在场/no-op 域规则判定，不触碰其他 entry —— **MET**

- 实现（`:1275-1277`）：`has ? {ok:true} : singleIssue('delete 目标键不存在（拒绝 no-op）', entryPath)`。文案与 legacy（`:977` `issueAt('delete 目标键不存在（拒绝 no-op）', plan.relPath)` → `[...prefix, key]`）**逐字节一致**（本次独立比对）；路径同形。
- 「不触碰其他 entry」由输入面结构性保证：接缝只收 `{has}`（`EntryCarrierFacts` 恰一键），delete 支不读 `payload.value`、不读其他键位；C3（邻位污染判决与干净基线逐字节同）+ E2/E3 锚定。
- 不查键 Pattern（C4：目标键违规但在场 → 照常 `{ok:true}`）、缺席违规键仅报 no-op（C5）——与 ADR 0034 决策 1 域规则不变条款一致。

### AC3 封闭对象 delete 静态规则全矩阵 —— **MET**

- 实现 `judgeClosedObjectDelete`（`:1178-1195`）+ parent 分派（`:1265-1273`）：no-op 先行（`has=false` → 拒，文案/路径逐字同源）→ 声明表查名（缺字段 fail closed，规划层不可达，G3.4/NC2.4 锚定）→ `optional` 包装先查 → `walkRefChain(field.value, valueLens(derived.values))` 解 ref（与 `resolveValues` = `validate.ts:147-149` 同算法同文案）→ `scalar ∧ unknown` 允许（**缺席视同接受的现行语义保留**）→ 其余必填拒 `缺少必填字段 "${key}"`（与 `validate.ts:680` 逐字一致，路径 `[...prefix, key]`）。
- 四象限 + 嵌套全矩阵由契约 D1–D6 覆盖并转绿：必填拒（req/child/u + 嵌套 panel.node.req）/ optional 允 / unknown 标量必填允 / no-op 拒 / 静态性（D4 目标字段值形态无关）/ 同胞不重验（D5 五字段 × 干净/污染恒同）。
- 不读父值：判定只消费 `plan.node.fields` + `derived.values` + `facts.has`，结构性成立。

### AC4 一致性 fixture 覆盖 Record 与 parent 两形态，与全量整体验证逐字节一致 —— **MET**

- 夹具 `issue-440-elementwise-entry-fixture.ts`（md5 恒同未动）：107 等价例（26 参数 + 60 随机 `mulberry32(440)` + 21 矩阵/目标键位内污染）+ 10 触达面例；census 由 NC4.2 运行时强制非空（accept/reject、set/delete、record/parent 六支）。
- E1：107/107 逐字节一致（oracle = 既有公共导出 `applyMutationAtBoundary`，非本票实现——独立通道）；E2：触达面 10/10 可分（oracle 前置全拒）；E3：目标键合法即成功、issue 只落目标键位前缀、拒绝支 issue 数 < oracle。
- 未来引入 map 级约束（键数/跨键）将红 E1/E2 与 NC4/NC6——ADR 0034 决策 5 的 enforcement 兑现。
- 「扩展 ADR 0033 的一致性 fixture」以**同纪律姊妹文件**履行（不改 #435 冻结文件，与决策 6「#435 既定范围不动」相容；SA8 设计报告 §3 行 5 已立法该解读）。

### AC5 公开面只经包公共入口导出，public-surface guard 覆盖新导出 —— **MET**

- `src/index.ts` 既有 `validate-patch.js` 导出块追加恰 1 运行时导出 `applyElementwiseEntryMutation` + 2 类型导出 `EntryCarrierFacts`/`ElementwiseEntryMutationPayload`；无第二公共面（包纪律「公共 API 只经 src/index.ts」满足）。
- guard 三面在场并绿：A1（`import * as vfsl` 自有导出键 + typeof function）、test-d（静态 import + 签名四参/返回/`{readonly has}`/词表两支 + 3 条 `@ts-expect-error` 负面夹具全命中）、NC5.1（23 既有导出超集锚在场）+ NC5.2（#435 签名面不动）。

### AC6 包测试 + 根 `pnpm typecheck` 与 `pnpm test` 绿 —— **MET（以提交内证据采信）**

- `artifacts/sa3-issue440-vfsl-typecheck.log`：`VFSL_TSC_EXIT:0`；`sa3-issue440-root-typecheck.log`：`ROOT_TYPECHECK_EXIT:0`（15 包 `&&` 链不再停在 vfsl）；`sa3-issue440-root-test.log`：**469 files / 5712 tests 全绿、`ROOT_TEST_EXIT:0`**（数字对账成立：基线 466/5667 + 本票 45 tests = 469/5712，零第 4 方回归）；`sa3-issue440-focused.log`：契约 26 + 负控 19 = 45/45、`FOCUSED_EXIT:0`、Type Errors no errors。
- SA10 不运行测试（角色边界）；证据日志已随交付提交、内部自洽，且 SA4 静态审查（含 md5 复算与日志实读）独立核验一致。发现面真实（根 `vitest.config.ts:15,20` include `packages/*/test/**/*.test.ts` / `*.test-d.ts`，本次实核）。

## 4. SA6 契约绑定点与规范面符合性

| 绑定点 / 规范条款 | 实现核验 | 判定 |
|---|---|---|
| B-1 `applyElementwiseEntryMutation(derived, plan, facts, payload)` 唯一新增运行时导出 | `:1219-1224` 逐字一致；改名未发生 | ✓ |
| B-2 `EntryCarrierFacts = { readonly has: boolean }` | `:1161` 逐字一致 | ✓ |
| B-3 `ElementwiseEntryMutationPayload = { op:'set'; value: unknown } \| { op:'delete' }` | `:1167-1169` 逐字一致 | ✓ |
| B-4 闸门（kind∈{record,parent} ∧ relPath 单段 string ∧ node.kind='object' ∧ kind↔形态一致）fail closed；返回 `ValidateResult` 直出 | `:1226-1248` 四重闸门 + `:1250-1262` 事实/载荷守卫 + `:1266-1270` parent∧set 拒；`wrapElementwise` E100 收编不抛；ok 支恰 `{ok:true}` 无包装（A2 `hasOwn(result,'result')===false` + test-d 负面夹具双锚） | ✓ |
| B-5 全量 oracle `applyMutationAtBoundary` 不动 | diff 零触碰（`:929-1015` 无修改行） | ✓ |
| B-6 夹具冻结 | md5 恒同（§2） | ✓ |
| ADR 0034 决策 1（闸门/union map 永久 legacy/值位 union 不排除/旧值不读/域规则不变/路径逐字节） | 闸门 ① fail closed（F2 union map 位不静默接受 + legacy 轨可用对照）；`blobs` 值位 union 经 `<key>` 槽整体过解释器（B5）；set 不读 `facts.has`（B6 has 翻转恒同 + 旧值污染不阻断） | ✓ |
| ADR 0034 决策 2（静态必填矩阵；`has` 拒 no-op；不读父值） | §3 AC3 行 | ✓ |
| ADR 0034 决策 3（返回直出无 `proposedBoundary`） | 签名即如此；S9 安装/重投影核归 #441（本票不接线，正确延期） | ✓ |
| ADR 0034 决策 4（触达面 = 载体 + 目标键位） | 输入面恰 `{has}`；夹具触达面组 10 例 + NC7 legacy 对照基线；端到端钉正归 #442 | ✓ |
| ADR 0034 决策 5（立法 + fixture enforcement；禁 map 级约束特判） | E1/E2/E3 + NC4/NC6；实现零特判（判定全经 `validateSubtree` 单 entry 视图或静态字段表） | ✓ |
| ADR 0034 决策 6（排序/复用非平行机制/#435 不动） | §2 排序行；命名族/管线/崩溃边界与 #435 同构；复用既有私有助手 `singleIssue:1063`/`wrapElementwise:1142`/`valueLens:81`/`walkRefChain` import `:39`/`validateSubtree` import `:41`——零新 import、零模块级状态、零 Yjs 引用 | ✓ |
| ADR 0034「不做什么」 | union map 位未接管（闸门拒）；map 级约束零实现；封闭对象 set 闸门 ⑥ 拒（kind=target 整值替换不涉及）；无异步审计 | ✓ |
| `packages/vfsl/AGENTS.md` | 公共面只经 index.ts；同步纯函数不抛错（畸形输入走判别联合）；message/序/path 兼容行为逐字节保持（NC1 19/19 绿 + E1 逐字节双锚）；零 Yjs 关切 | ✓ |
| 实现自决细节（SA3 已登记）：facts/payload 敌意通道语义读取 | `(facts as …\|null\|undefined)?.has` / `(payload as …)?.op` 使畸形 `{}`/null/array-* 载荷经守卫 ②③ 响亮拒绝而非 E100——与设计 §8.1 ②③ 判决形状相容、更确定性、符合包纪律；冻结断言未覆盖该形状，无契约影响 | ✓（备案） |

## 5. 错误实现 / 遗漏 / scope creep 排查结论

- **遗漏**：无。AC1–AC6 每条均有实现落点 + 冻结断言面 + 转绿证据；ADR 0034 本票范围决策全覆盖。
- **部分实现**：无。唯一「字面未命中」= SA6 §13 绿判据中的「探针 exit 0」——探针 G1.1/G1.2 断言的是导出**缺席**（HEAD 态缺口证据），实现后必然翻红；该口径在交付前已由设计 §12 末行/§13 残余 1、SA2 观察 1、SA8 R3 三处预立法，`artifacts/sa3-issue440-probe-post.log` 实读：恰 G1.1/G1.2 红、其余 25 项（G2–G5/REF/O1–O3/NC1–NC2）绿、`/elementwise/i` 命中 1→2、运行时导出 23→24、NC2.2 超集仍绿、`PROBE_EXIT:1`。权威绿判据（契约 26/26 + 负控 19/19 + test-d 转绿 + 根 gates）全部命中——**非缺口，是缺口的正向闭合**。
- **错误实现**：未发现。SA6 变异实验（M1b/M2/M3/M4 → 4/5/10/4 红）证明契约断言对键 Pattern/optional 规则/set 在场性/no-op 域规则四处关键语义敏感；实现使同一断言面 26/26 全绿，且 SA4 逐行比对实现与设计伪代码同构、与 legacy 兼容面逐字一致。
- **scope creep**：零（§2 DENY 面逐项零触碰；doc-runtime 接线、S9/E201/charge、基准、lease 端到端全部留在 #441/#442；未改任何规范文档；未实现 ADR 0034「不做什么」禁止项）。

## 6. PR 必须披露的未达成/延期项（均非本票验收面缺口）

1. **探针 exit 1 口径**：实现后复跑 `task_issue-440_sa6_capability_probe.mts` 为 `PROBE_EXIT:1`（恰 G1.1/G1.2 红 = 断言导出缺席的 HEAD 态证据项正向闭合，其余 25 项绿）。权威绿判据 = 契约 26/26 + 负控 19/19 + test-d 转绿 + 根 `pnpm typecheck`/`pnpm test`（设计 §13 残余 1 / SA2 观察 1 / SA8 R3 已立法）。PR 描述应带此口径，避免评审按字面误判。
2. **SA8 R1（跨票追踪，doc-only）**：`docs/adr/0007` 内「ADR 0034 修订注记」尚未落地（SA8 实现后复查全文实读确认注记止于 0033）。本票未接线 ⇒ 运行时行为仍逐字符合 ADR 0007 现行措辞，**不阻塞本票**；硬性时点 = **#441 行为翻转变更集合入前**，#441 前置门禁须核验（SA8 实现报告 §8 R1/R4）。
3. **归 #441 的延期面**：doc-runtime 按闸门分流接线、S9/E201/charge 收窄、10⁵ entry 基准（ADR 0034 决策 3/6 的接线与性能软验收面）。本票只交付 vfsl 接缝语义 + 输入面（只收 `{has}` 的结构面证据）。
4. **归 #442 的延期面**：触达面收窄的端到端用户可见行为钉正（污染文档经 lease 写/删）。
5. **SA4 MINOR 备案（非缺陷，不阻断）**：(a) parent-delete 支 seam 本地 E100 path 为 `[]`（legacy 同源异常 rebase 为 `[...prefix]`）——仅手造派生物可达（E106/E308 使合法 derived 不可达），与 #435 `wrapElementwise` 家族同款，#441 消费方勿对 E100 分支假设 prefix 前缀；(b) 手造「重名字段封闭对象」角落 `find`（首命中）vs `validate.ts` Map（后名覆盖）镜像分叉——E308 使合法产物不可达，两侧均响亮；(c) 敌意通道读取（本表 §4 末行）；(d) SA2 可选优化（域规则文案提取模块级常量）未采纳——理由成立（避免在负控锚定的 legacy 冻结支上扩 diff；NC1.3/NC1.4 常量锚 + E1 逐字节双锚覆盖漂移风险）。

## 7. 结论

交付 diff `08497d9` 在 Issue #440 正文与 AC1–AC6、SA6 契约 B-1…B-6、ADR 0034/0033 与包纪律四个基准面上**全部忠实命中**：逐 entry 接缝（Record set = 键 Pattern + 新值单源继承校验、旧值不读；Record delete = 仅在场/no-op 域规则；封闭对象 delete = 静态必填全矩阵不读父值）、issue 路径与域 message 逐字节兼容、一致性 fixture（107 等价例 + 10 触达面例）执法落位、公开面纯加法且 guard 三面覆盖、根 gates 证据全绿；零遗漏、零部分实现、零错误实现、零 scope creep；未达成项均为已立法的跨票延期（#441/#442/R1）并有明确归属与硬性时点。**verdict = approve**；§6 五项为 PR 披露义务。

---

*SA10 只读审查：未修改任何代码、设计、测试或冻结产物；未运行测试/服务；未派发其他 SA；未 commit/push/创建 PR。本文件为本次审查唯一新增产物。*
