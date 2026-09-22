# SA10 Spec 审查报告 — issue #435：vfsl 数组逐元素校验 seam + 一致性 fixture（ADR 0033）

- 角色：SA10（独立 Spec 审查者；只判断实现是否忠实满足 Issue 正文 / Owner 评论 / 验收标准；不审查通用架构风格（SA9 面），不改代码/设计/测试，不运行测试）
- 审查对象：committed final diff `f6b27da..ae1024f`（13 files，+2762/−3）——生产面仅
  `packages/vfsl/src/validate-patch.ts`、`packages/vfsl/src/index.ts`（纯加法），测试面为 SA6 冻结交付件 4 件，
  其余为 wiki 工件。基线 = PR #434 head `f6b27da8eadc5cad3bf65c728094767ecb8c601b`（与 SA1/SA2/SA6/SA8/SA3/SA4 一致）
- Owner 评论：REST 快照为空，**无 Owner 追加要求**（Host 简报明文，四方工件同证）
- 裁决：**approve**（AC1–AC6 全部 met；0 项 partial/unmet；5 项 MINOR 非阻断披露项见 §5）

---

## 1. 审查输入

| 输入 | 路径 | 状态 |
|---|---|---|
| Issue 正文 + AC1–AC6 | `wiki/raw/task_issue-435.md` + `gh issue view 435` 实时复核 | 一致；comments=`[]` |
| SA6 验收契约 | `wiki/raw/task_issue-435_sa6_contract.md`（approve；绑定 B-1…B-6） | 已逐条核对 |
| SA1 设计 / SA2 评审 | `task_issue-435_design.md` / `_sa2_review.md`（approve，0 BLOCKER/0 MAJOR） | 已读 |
| SA8 设计/实现冲突复查 | `task_issue-435_design_conflict_report.md`（clear）/ `_implementation_conflict_report.md`（clear，recheck=false） | 已读 |
| SA3 实现报告 / SA4 静态审查 | `task_issue-435_sa3_impl.md` / `_sa4_review.md`（均 approve/无偏差声明） | 已读并独立抽验 |
| 母法 | `docs/adr/0033-elementwise-yarray-mutation-validation.md`（accepted，决策 1–6） | 已逐条对照 |
| 规范/纪律 | `packages/vfsl/AGENTS.md`（公共入口/纯函数不抛错/兼容行为/无 Yjs 关切）；`CONTEXT.md`「重建校验」「复制未校验」数组位例外句 | 已对照 |
| 实现 diff | `git diff f6b27da..ae1024f -- packages/vfsl/src/**`（本报告自行审读全文） | 见 §2/§3 |
| 测试件 | `packages/vfsl/test/issue-435-elementwise-array-{contract,control}.test.ts`、`-fixture.ts`、`.test-d.ts` | 已全文审读 |
| 验证证据 | `artifacts/sa3-issue435-{final-focused,package-tsc,root-typecheck,root-test,probe-post,guard-probe,pre-fix-focused,mutation-*}.log` | 已抽验（§4） |

## 2. AC 逐条裁决（独立复核，非转述上游）

### AC1 array-insert 逐新值按 element 子 schema 校验；issue 路径 `[...arrayPath, index+j]`；与全量路径逐字节一致 —— **MET**

- 实现（`validate-patch.ts` 尾追加段）：`for j` 单循环逐值 `validateSubtree(derived.values, node.element, values[j])`，
  issue 收集为 `{ message, path: [...arrayPath, payload.index + j, ...issue.path] }`；任一非法 ⇒ 整批 `ok:false`。
- 逐字节同构独立推证：legacy 路径 = 整数组 splice 重建后 `validateSubtree(plan.node, proposed)`，解释器数组分发
  以 `validateValue(element, v, [i])` 发射、`validateBoundary` 以 `[...plan.prefix, ...issue.path]` rebase
  （现状 L1016–1020）——合法基线上元素 issue 绝对路径 = `[...arrayPath, index+j, ...相对路径]`，与新接缝公式恒等；
  两侧序均为插入后位置升序。**合法基线**上逐字节一致由契约 E1（132 例）实证转绿。
- 基线含既存非法元素时的 insert 分歧（legacy 报旧+新、接缝只报新）= ADR 0033 决策 4 同族有意收窄，
  设计 §8.4 显式文档化、不进等价契约（见 §5 披露项 D4）。

### AC2 array-delete 仅域规则判定（下标越界/范围越界/越界 no-op 拒绝），不触碰元素值 —— **MET**

- delete 支：守卫 → `index >= length || index + count > length` 拒绝 → 否则 `{ok:true}`；
  `ArrayCarrierFacts = { readonly length: number }` **结构性排除元素值输入面**（无元素值可触）。
- 契约 D4 钉死决策 4（污染数组 delete 照常成功）、D5 钉死「同 length 污染/合法基线判决逐字节相同」——均绿。

### AC3 域规则逐字对齐：不 clamp、批量一次判定、中间态不参与 —— **MET**

- 本人逐字符比对实现与 legacy 现状源码（`validate-patch.ts` L993–994/L1003–1004）：
  - `array-insert index 越界（不 clamp）` @ `[...arrayPath, index]`——判定式 `index > length` 同式（不 clamp，append 位 `index === length` 接受）；
  - `array-delete 范围越界（不 clamp、不接受越界 no-op）` @ `[...arrayPath, index]`——判定式 `index >= length || index+count > length` 同式（两子句逐字保留，含 MUT-D 证实的 covered 域冗余子句，未擅自简化）。
- 批量一次判定：单循环一次收集整批 issue、中间态不参与（新值只过 element 子 schema，不从重建中间数组读取）；
  空批量恒等 `ok:true`（B6 + fixture `P-*-insert-empty-batch`）。

### AC4 一致性 fixture：随机/参数化用例下逐元素 vs 全量逐字节一致 —— **MET**

- fixture = 72 参数化边界例（6 条非 union 数组路径 × 12）+ 60 确定性随机例（mulberry32 种子 435 冻结）= **132 例**，
  覆盖两 op、接受/拒绝两支、union 元素（variants/scalars）、嵌套路径（nested.inner）；
  用例生成零真实时钟/零网络，同输入恒同用例集。
- 契约 E1 逐字节比较（JSON 全序，含 issue 序）且 `checked === length` 防空转；E2 以 6 例污染 delete 证明比较判据
  可分（非恒真）。立法前提（数组层无数组级约束）由负控 NC4 锚定——未来引入数组级约束时 E1/NC4 同红灯，
  ADR 0033 决策 5 执法面成立。

### AC5 公开面只经包公共入口导出，public-surface guard 测试覆盖新导出 —— **MET**

- `packages/vfsl/package.json` exports 仅 `.`（本人核对）；新导出只经 `src/index.ts` 既有导出块追加
  （运行时 `applyElementwiseArrayMutation` + 类型 `ArrayCarrierFacts`、`ElementwiseArrayMutationPayload`），
  既有 22 个运行时导出名/序逐字节不变（diff 纯加行；探针 post 运行时反射 `exports(23)` = 原 22 名单 + 新 1）。
- guard 覆盖：契约 A1 经公共入口 `../src/index.js` 断言自有导出键 + typeof function（动态命名空间读取、单点绑定）；
  test-d 静态断言 B-1…B-5 签名 + 3 条 `@ts-expect-error` 负面夹具（缺 length / `op:'set'` / result 包装形均 fail closed）。

### AC6 包测试 + 根 `pnpm typecheck` 与 `pnpm test` 绿 —— **MET**（附 1 条 MINOR 证据时点注记）

- `artifacts/sa3-issue435-package-tsc.log`：exit 0（无输出）；
  `-root-typecheck.log`：15 tsconfig 全链 `EXIT:0`；
  `-root-test.log`：**462 files / 5622 tests 全 passed，Type Errors: no errors，harness exit 0**（= SA6 §13 期望值 5584 基线 + 17 负控 + 21 契约转绿）；
  `-final-focused.log`：聚焦对 **38/38 passed**（21 契约 + 17 负控）。
- 红→绿证据链闭合：`-pre-fix-focused.log` 实测 21 failed（能力缺口 loud throw）/ 17 passed → 实现后 38/38；
  SA6 四测试件 mtime（11:49–11:51）早于实现（12:30+），SA4/SA8 双重实证零字节改动（DENY 遵守）。
- MINOR（SA4 O-1 同指）：根 test 全量绿证据采集窗口（12:31:37–12:38:47）略早于最终字节写入（12:39:15，
  为末次变异实验的 `cp` 还原）；最终字节由聚焦 38/38 + guard-probe 21/21（12:39:52，覆盖全部冻结 message/域规则/
  rebase/E100/纯度）+ 根 typecheck exit 0（12:40:52）闭合，且 committed 内容与 guard-probe 所测一致（`git status` 无改动）。
  非阻断；建议验证角色按 SA4 §11 补一次收尾全量复跑（见 §5 D5）。

## 3. 绑定契约（SA6 B-1…B-6）与 ADR 0033 对照

| 绑定/决策 | 实现核对（本人对 diff 逐行） | 裁决 |
|---|---|---|
| B-1 名 `applyElementwiseArrayMutation` 经 `src/index.ts` | 逐字命中；运行时导出 22→23 纯加法 | ✅ |
| B-2 四参签名 `(derived, plan, facts, payload)` | 逐字命中；test-d parameter 断言绿 | ✅ |
| B-3 `ArrayCarrierFacts = { readonly length: number }` | 逐字命中；不含元素值 | ✅ |
| B-4 载荷词表恰两支、字段与 `BoundaryMutationPayload` 同名支逐字一致 | 逐字命中（`op/index/values`、`op/index/count`） | ✅ |
| B-5 返回 `ValidateResult` 直出（无 proposedBoundary/无 result 包装） | 逐字命中（决策 3）；test-d 负面夹具钉死 | ✅ |
| B-6 闸门 fail closed（`plan.kind='array'` ∧ `node.kind='array'`，违约 `ok:false` 不静默接受） | 命中；第三条件 `relPath=[]` 为 fail-closed 方向防御收紧（真实 array-* 计划恒满足，NC3.1 锚），SA8 已裁决 no-conflict | ✅ |
| 决策 1 union 数组目标永久 legacy、规划层零改动 | `node.kind==='union'` 由闸门第二条件排除（F2 绿）；`planMutationBoundary` 在 diff 中零行 | ✅ |
| 决策 2 域规则逐字/零写入纪律 | 见 AC3；纯函数只读四输入、path 一律新数组、零模块级态（契约 A2 + guard-probe 实证） | ✅ |
| 决策 4 触达面收窄 | delete 支域规则之外零判定（D4/D5/E2 绿）；wired 行为归接线票（分票执行，已登记） | ✅ |
| 决策 5 立法 + fixture | `validate.ts` 解释器零改动（diff 不含该文件）；fixture 132 例转绿 | ✅ |
| 决策 6 性能软验收 | 无阈值断言；结构性 O(k)（不读 `facts.length` 之外长度相关量）；规模证据留探针 G3 诊断面 | ✅ |
| 包纪律（同步/纯函数/不抛错/稳定 message 兼容/无 Yjs 关切） | 一切失败 `ok:false+issues`；`wrapElementwise` E100 文案与 sibling `wrapApply` 同款；新词表 G-A/G-B/F-1/P-1/P-2 与设计 §8.3 冻结表逐字符一致（本人比对，含 `${node.kind}` 插值同值） | ✅ |

**范围纪律（scope creep 检查）**：diff 生产面仅两 ALLOW 文件纯加法；doc-runtime / namespace-runtime /
诊断 / apps / domains / docs / CONTEXT 零触碰；SA6 四测试件与探针零改动（DENY 全清单遵守）。
Issue「What to build」本身只要求 vfsl 接缝 + fixture + 导出——doc-runtime 接线属后续票，
**不构成本票 unmet 项**（见 §5 D1 披露义务）。

**Owner 评论**：无（快照空），无 override 面。

## 4. 证据抽验记录（本人复核，非转述）

- 测试纪律：四测试件 `grep` 零 `.skip/.only/.todo`；契约顶层不静态 import 新名目（动态绑定 + loud throw），
  红因归因能力缺口；期望值二源（legacy oracle 逐字节 / ADR 冻结常量）——符合 SA6 §12.4 纪律。
- 判据敏感性：SA3 变异实验日志 MUT-B（rebase off-by-one）/MUT-E（跳过元素校验）各 6 红、MUT-F（insert 域放宽）2 红，
  MUT-D 诚实登记为 covered 域等价变异（实现仍逐字镜像 legacy）——判据非恒真。
- 探针 post 态：`exports(23)`、51 PASS、failures=2 恰 = G1.1/G1.2（断言导出**缺席**的两项预期翻转 = 缺口闭合），
  与设计 §5 矛盾记录 / SA8 §8 行 4 的既定解读逐字一致——非回归。

## 5. PR 必须披露的未达成/收尾项（均已在工件中登记；MINOR，不阻断 approve）

| # | 披露项 | 性质 | 出处 |
|---|---|---|---|
| D1 | **doc-runtime 接线不在本 PR**：数组写热路径仍走 legacy O(n) 轨；新接缝暂无生产消费者（S5 省略/S6 换缝/S9 收窄、E201 行为变化、`CONTEXT.md` 措辞-现实差与 O(k) 实际收益归后续接线票） | 分票执行（Issue 范围自定） | 设计 §1 非目标；SA3 §Deferred；SA8 实现报告 §8 行 1/2 |
| D2 | 决策 4 行为变化（污染数组 delete 由响亮拒绝变为照常成功）**仅落在未被接线的新接缝上**；legacy 轨现状不变（NC2 锚保持绿） | 有意变更，分票生效 | ADR 0033 决策 4；契约 D4/D5 |
| D3 | 病态域已知分歧：单元素 >100 条 issue / 预算耗尽粒度上，新接缝（每元素独立上限/预算）与 legacy（全数组单上限）不逐字节一致；fixture 与真实载荷远离该界，不进契约；未来如需对齐须另立契约，不得在接缝内静默聚合上限 | 显式接受的边界 | 设计 §7 D6/§8.4/§13 R2；SA4 O-5；SA8 §8 行 3 |
| D4 | 域外载荷守卫分歧：负 index / 非数组 values / 畸形 length 在新接缝响亮拒绝（P-1/P-2/F-1 新词表），与 legacy 依赖整数组的重建产物语义不同；真实调用域（doc-runtime E3）不达 | 显式接受的边界；接线票须维持 E3 前置 | 设计 §7 D5/§13 R4 |
| D5 | 根全量 test 绿证据时点略早于最终字节写入（最终字节由聚焦 38/38 + guard-probe 21/21 + 根 typecheck exit 0 闭合）；建议验证角色补一次收尾全量复跑 | 证据时点注记（MINOR） | SA4 §11 行 1 / O-1 |
| D6 | 探针 G1.1/G1.2 翻红 = 导出缺席断言的预期翻转（缺口闭合），勿据 exit code 误判回归；fixture 死导出 `unionArrayPlan`/`VerdictIssue`（SA6 DENY 冻结件，不清理） | 解读注记 / 装饰性 | 设计 §5；SA8 §8 行 4；SA4 O-3 |

## 6. 结论

**approve**。实现把 Issue #435 正文与 AC1–AC6 逐字落成：vfsl 公共面新增纯函数接缝
`applyElementwiseArrayMutation(derived, plan, {length}, payload) → ValidateResult`
（三条件 fail-closed 闸门 → 事实/载荷守卫 → 逐字域规则 → insert 逐新值过 element 子 schema +
`[...arrayPath, index+j]` rebase / delete 仅域规则不触碰元素值），与全量路径在合法基线等价域逐字节一致
（132 例 fixture + 21 契约 + 17 负控 + 根 462 files/5622 tests 全绿 + Type Errors: no errors）；
SA6 绑定 B-1…B-6 与 ADR 0033 决策 1–6 逐条兑现；无遗漏、无部分实现、无错误实现、无 scope creep；
未达成项（doc-runtime 接线、病态域/域外分歧、证据时点）均已显式登记且属既定分票/边界，
不构成本 Issue 验收标准的 partial/unmet。
