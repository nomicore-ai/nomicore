# SA4 实现静态审查 — issue #435：vfsl 数组逐元素校验 seam + 一致性 fixture（ADR 0033）

- 角色：SA4（实现后红队静态审查；不改实现/设计/测试，不运行测试）
- 审查对象：`packages/vfsl/src/validate-patch.ts` 与 `packages/vfsl/src/index.ts` 的当前工作树改动
  （`git diff --numstat` = `+119/-2` 与 `+11/-1`，合计 +130/-3）+ SA6 四个测试交付件的测试质量
- 上游基准：SA1 设计（SA2 `approve`）、SA6 验收契约（`approve`，绑定 B-1…B-6）、
  SA8 设计冲突复查（`clear`，§8 Required actions 1/2/4）
- 审查日期基线：HEAD `f6b27da8eadc5cad3bf65c728094767ecb8c601b`（与 SA1/SA2/SA6/SA8/SA3 一致）

## 1. Reviewed inputs

| 输入 | 状态 | 说明 |
|---|---|---|
| `wiki/raw/task_issue-435.md`（简报） | 在场 | AC1–AC6；Comments 空（Host 明示 no owner requirements apply） |
| `wiki/raw/task_issue-435_design.md`（SA1） | 在场 | §7 D1–D8、§8.1–§8.5 冻结面、§11 ALLOW/DENY、§12 验收映射 |
| `wiki/raw/task_issue-435_sa2_review.md` | 在场 | `approve`，0 BLOCKER/0 MAJOR，O-1…O-6 非阻断观察 |
| `wiki/raw/task_issue-435_sa6_contract.md` | 在场 | §12.1 绑定 B-1…B-6、§12.2 目标行为、§13 红/绿证据与期望值 |
| `wiki/raw/task_issue-435_design_conflict_report.md`（SA8 补位裁决） | 在场 | `clear`；§8 行 1（message 逐字义务）、行 2（实现后复查清单）、行 4（探针解读） |
| `wiki/raw/task_issue-435_sa3_impl.md`（SA3 报告） | 在场 | Changed paths、验证矩阵、MUT-B/E/F/D 判据敏感性实验 |
| SA6 四测试件 + 探针 | 在场 | mtime 11:49–11:51，早于实现（12:30+），未被 SA3 触碰 |
| `artifacts/sa3-issue435-*.log`、`artifacts/sa6-issue435-*.log` | 在场 | 红/绿/typecheck/根命令/探针/守卫探针/变异实验证据（只读核对） |
| 源码/配置锚点核对 | 完成 | `validate-patch.ts` 全量（L923–1146）、`index.ts` 导出面、`validate.ts` L44–70（ValidateIssue/Result、ISSUE_LIMIT/WORK_LIMIT）、`vitest.config.ts` include/typecheck、根 `package.json` scripts、`.github/workflows/ci.yml`、`docs/adr/0033`（决策 1–6 逐条）、`packages/vfsl/package.json` exports（仅 `.`） |
| `task_issue-435_relevant_decisions.md` / `_conflict_report.md` | 缺席（iteration 0） | SA8 已以 design_conflict_report 补位裁决（`clear`）；约束语义全部可从 ADR 0033 + SA6 冻结绑定恢复，不构成无法判断安全性的缺口 |

## 2. Verdict

**approve**。无 BLOCKER、无 MAJOR。实现与批准设计 §7/§8 逐条一致且为纯加法（两文件 +130/-3，
legacy 轨与既有 22 运行时导出逐字节不动）；SA6 红契约 21 → 绿、负控 17 恒绿、类型契约 TS 干净、
根 `pnpm typecheck`/`pnpm test` 复绿均有日志证据；测试真实进入 runner 与 CI 发现面、判据敏感性经
4 组变异实验证明。5 条非阻断观察与 2 项后续动态验证项见 §10–§12。

关键审查结论：

1. **冻结面逐字命中**：§8.3 message 冻结表 7 条（D-I/D-D 逐字复用 legacy L994/L1004；G-A/G-B/F-1/P-1/P-2
   新词表）与实现 L1089/L1096/L1103/L1109/L1128/L1113/L1132 逐字符比对一致（含 `${plan.kind}`/
   `${node.kind}` 插值形）；SA8 §8 行 1 的逐字义务落实。
2. **算法同构**：闸门三条件（kind=array ∧ node.kind=array ∧ relPath=[]）fail closed → F-1 → P-1/P-2 →
   域规则（与 legacy L993/L1003 同式）→ insert 逐值 `validateSubtree(derived.values, node.element, values[j])`
   + `[...arrayPath, index+j, ...issue.path]` rebase / delete 仅域规则——与设计 §8.2 伪代码逐行对应；
   rebase 与 legacy「整数组重建 + `validateValue(element, v, [i])` + `validateBoundary` prefix rebase」
   数学同构（同源解释器、同遍历序 ⇒ 合法基线上逐字节一致）。
3. **范围纪律**：`git status` 仅两 ALLOW 文件被修改（`M packages/vfsl/src/index.ts`、
   `M packages/vfsl/src/validate-patch.ts`）；DENY 全清单（`validate.ts`、SA6 四件+探针、doc-runtime、
   namespace-runtime、docs、CONTEXT、既有测试）零触碰；新导出未被接线进任何生产调用方（非目标边界保持）。
4. **测试质量**：21 契约 + 17 负控零 skip/only/todo/env override；期望值二源（legacy oracle 逐字节比较 /
   ADR 冻结常量）；E1 对 132 例逐字节比较且 `checked === length` 防空转；MUT-B/MUT-E（各 6 红）、
   MUT-F（2 红）证明判据敏感，MUT-D 诚实登记为 covered 域上的等价变异。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| AC1 insert 逐新值过 element 子 schema；issue 路径 `[...arrayPath, index+j]`；与全量逐字节一致 | `validate-patch.ts` L1115–1124（j 升序单循环 + rebase）；契约 B1–B7/E1 绿（`sa3-issue435-final-focused.log` 38/38） | 落实 |
| AC2 delete 仅域规则（越界/no-op 拒绝），不触碰元素值 | L1126–1134：域检查后直接 `{ok:true}`；`ArrayCarrierFacts` 结构性无元素值输入面 | 落实 |
| AC3 域规则逐字对齐（不 clamp、批量一次判定、中间态不参与） | L1111/L1130 与 legacy L993/L1003 同式；message 与 L994/L1004 逐字节相同；域检查先于元素循环；单循环收集一次返回 | 落实 |
| AC4 一致性 fixture（随机/参数化逐字节一致） | SA6 fixture（132 例）+ 契约 E1/E2 绿；负控 NC5 oracle 自洽恒绿 | 落实 |
| AC5 公开面只经包公共入口导出 + guard 覆盖新导出 | `src/index.ts` L132–147 导出块追加；A1 经 `../src/index.js` 断言自有导出键 + typeof function；test-d 签名断言 + 3 条 `@ts-expect-error`；运行时导出静态清点 = 23（7 顶层函数 + 各 re-export 块） | 落实 |
| AC6 包测试 + 根 typecheck/test 绿 | `sa3-issue435-package-tsc.log`（exit 0）、`-root-typecheck.log`（EXIT:0）、`-root-test.log`（462 files/5622 tests，Type Errors: no errors，harness exit 0） | 落实（证据时点注记见 O-1） |
| SA6 B-1…B-6 绑定 | 函数名/四参签名/`{readonly length}`/两支载荷词表/`ValidateResult` 直出/闸门 fail closed 全部逐字命中；test-d 7 断言 + 3 负面夹具绿 | 落实 |
| SA8 §8 行 1（message 逐字） | 见 §2 结论 1；另经 `artifacts/sa3-issue435-guard-probe.log`（21/21）运行时逐字复核 | 落实 |
| SA8 §8 行 2（实现后复查清单） | 本报告即执行面：导出纯加法 22→23 ✓、DENY 零触碰 ✓、NC + legacy 锚保持绿（根 test 证据）✓、契约 21 翻绿 ✓ | 落实 |
| SA8 §8 行 4（探针解读） | `sa3-issue435-probe-post.log`：`exports(23)`、51 PASS、failures=2 恰 = G1.1/G1.2（断言导出缺席的预期翻转） | 落实 |
| Owner 评论 | 无（REST 快照空；简报/设计/SA6/SA8 四方一致登记） | 不适用 |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| D1 单接缝函数（判别联合载荷） | `applyElementwiseArrayMutation`（L1079–1136） | 一致 | 无 |
| D2 就地扩展 `validate-patch.ts` | 文件尾追加 +114 净行；复用 L36 `validateSubtree` import 与 E100 惯例 | 一致 | 无 |
| D3 判定管线 O(k)、无整数组输入面 | 只读 `facts.length` + k 个新值；任何路径不随 length 增长 | 一致 | 无 |
| D4 闸门三条件 fail closed | L1087–1099；union 数组目标（node.kind=union）由第二条件排除（F2 绿） | 一致 | 无 |
| D5 域外载荷/事实守卫（新词表响亮拒绝） | L1102–1104（F-1）、L1108–1110（P-1）、L1127–1129（P-2）；`isSafeNonNegInt` = 设计式（外加 `typeof` 前置，行为等价——`Number.isSafeInteger` 对非数恒 false） | 一致 | 无 |
| D6 逐值 `validateSubtree` + rebase（单一解释器来源） | L1118–1122；未聚合跨调用 issue 上限/预算（病态域分歧按设计显式接受） | 一致 | 无 |
| D7 返回 `ValidateResult` 直出 | L1084 返回型；无 proposedBoundary/无 result 包装（test-d 第 3 负面夹具钉死） | 一致 | 无 |
| D8 公共导出面纯加法 | `index.ts` +1 运行时 +2 类型导出；既有 22 名字节不变；头注释补 issue #435 说明 | 一致（注释行数略超「一句」，见 O-4） | 无 |
| §8.3 message 冻结表（7 条） | 逐字符比对全部一致（§2 结论 1） | 一致 | 无 |
| §9 纯函数/不抛错/幂等 | `wrapElementwise` E100 同款文案（L1144）；path 一律新数组；零模块级态 | 一致 | 无 |

设计明确但实现缺失：未发现。实现必要偏离设计：未发现。

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| 数组写判定语义（域规则 + 元素校验） | `@nomicore/vfsl` | `validate-patch.ts` 就地扩展 | 正确 |
| 载体长度投影（`Y.Array.length`） | 调用方（doc-runtime 接线票） | 接缝只收 `{length}` 事实 | 正确（vfsl 无 Yjs 关切保持） |
| 解释器语义 | `validate.ts` 单一来源 | 接缝只消费 `validateSubtree`，零改动 | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| `applyMutationAtBoundary`（legacy 边界接缝） | 整数组重建 + 整体验证 + proposedBoundary 包装 | 同文件同族：同参数前缀、判别联合、E100 同款；返回直出 | 一致（唯一有意分歧 = D7，ADR 决策 3） | test-d 负面夹具钉死 |
| `wrapApply` E100 边界 | L1025–1032 | `wrapElementwise`（L1139–1146）同文案、结果形直出 | 一致 | 同族惯例第三次实例化，非平行机制 |
| `validateInsertIntoArray` 等路径级三操作 | 路径尺度、消费数组值 | 边界计划尺度、消费载体事实 | 一致（不同尺度层） | 各服务各自管线 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| element 子 schema | `plan.node.element` | 无副本 | 无 |
| 域规则 message | legacy 分支字面量（L994/L1004） | 新接缝复用字面量 | 低——两侧被 NC1 与 C1/C2/D2/D3+E1 双向钉死（SA2 O-3 已登记；SA3 按 DENY 不抽共享常量，处置正确） |

### 生命周期对称性

无状态纯函数（无 register/subscribe/缓存/后台任务）——对称性平凡成立；`wrapElementwise` 收编一切异常，无资源持有。

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 第二套数组写判定路径 | legacy `applyMutationAtBoundary` | 新接缝 | ADR 决策 1 裁决的永久双轨（union 目标走 legacy）；两轨行为差异全部显式文档化并双轨锚定，非漂移性重复 |
| 新接缝生产接线 | — | 无（grep 全仓：新名仅出现于 src、SA6 四件、探针） | 正确保持非目标边界（doc-runtime 接线归后续票） |

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/vfsl/src/validate-patch.ts`（+119/−2：头注释 1 行扩为 4、import type 加 `ValidateIssue`、尾追加 114 行） | §11 ALLOW 行 1 | 接缝本体 | 合规；唯一「删除」行 = 注释行与 import 行（类型导入，零运行时效应）；既有符号字节不动 |
| `packages/vfsl/src/index.ts`（+11/−1：头注释 4 行、导出块注释 1 行扩为 5、+3 导出名） | §11 ALLOW 行 2 | 公共面唯一入口 | 合规；纯加法导出（22→23 运行时 + 2 类型） |
| `wiki/raw/task_issue-435_sa3_impl.md`、`artifacts/sa3-issue435-*` | 非源码面（报告/证据惯例） | SA3 固定产物 | 合规（不在 vitest include 面） |
| DENY 清单核对 | `validate.ts`、SA6 四件 + 探针（mtime 11:49–11:51 早于实现）、doc-runtime/namespace-runtime/diagnostic/apps/domains/docs/CONTEXT、`validate-patch.ts` 内既有符号 | — | 零触碰（`git status`/`git diff` + mtime 三重实证） |

无超出 ALLOW 的改动；无 DENY 触碰。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| 新导出 `applyElementwiseArrayMutation` + 2 类型 | 仓库内无生产消费者（grep 全仓实证）；目标消费方 doc-runtime 明确归接线票 | 接缝形状按该消费面最小化（只收 `{length}`、直出 ValidateResult） | 无 | 无 |
| 既有 22 运行时导出 | namespace-runtime / diagnostic-log / 各测试 | 逐字节不变（纯加法；根 test 462/5622 含全部消费方测试绿） | 无 | 无 |
| `ElementwiseArrayMutationPayload` 与 `BoundaryMutationPayload` 同名支字段 | 类型面 | 逐字一致（`op/index/values`、`op/index/count`） | 无 | 无 |
| wire/schema/持久化消费者 | — | 纯函数无运行时数据路径（ADR 0033 范围句） | 无 | 无 |
| 域外载荷语义（负 index/非数组 values/畸形 length） | 未来直调接缝者 | P-1/P-2/F-1 响亮拒绝（与 legacy 重建产物语义不同——设计 §8.4 行 6 显式文档化；message 自述修复方式） | 低（接线票须维持 doc-runtime E3 前置，设计 §13 R4 已登记） | 无 |

## 8. 错误、恢复与并发

| 检查点 | 结论 |
|---|---|
| 静默成功路径 | 无：一切失败经 `ok:false + issues`；无 `ok:true` 伴吞错；E100 兜底不抛错 |
| 部分完成诚实报告 | 批量一次判定、整批 `ok:false`、issue 按插入后位置升序全量收集（B3/B4/E1 锚定） |
| 错误分类稳定性 | 7 条 message 发布即冻结（§8.3）；与 legacy 两条逐字同源 |
| 重试幂等 | 纯函数零残留态；重复调用逐字节相同（guard-probe 第 8 组实测） |
| 输入突变 | path 一律新数组；四输入 JSON 前后比对不变（契约 A2 + guard-probe） |
| 崩溃边界 | `wrapElementwise` 收编手造 plan 缺字段等 TypeError → E100 单 issue path `[]`（guard-probe 第 6 组实测） |
| 并发 | 零共享可变态；`validateSubtree` memo 为调用局部（validate.ts L80–99 注释契约） |
| 数值边界 | `index+count` 上限 2×(2⁵³−1) 的浮点舍入不产生误接受（length ≤ 2⁵³−1 时两子句仍正确触发；且与 legacy 同式同算术） |
| 病态域分歧（>100 issue/预算粒度） | 设计 §8.4/D6/R2 显式接受；fixture（批量 ≤3、元素浅层）远离该界；SA3 未在实现内静默聚合上限（SA8 §8 行 5 义务保持） |

静态无法确认的风险 → §11 动态验证项。

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| `issue-435-elementwise-array-contract.test.ts`（21） | A1/A2 导出面+纯度；B1–B7 逐元素+rebase+批量序+空批量+联合元素；C1/C2 域规则逐字；D1–D5 delete 仅域规则+决策 4；E1 132 例逐字节；F1–F3 闸门 | vitest include `packages/*/test/**/*.test.ts`；根 `pnpm test`；CI test 分片（磁盘枚举自动落片） | 无 skip/only/todo/env override；`seam()` 动态绑定 + loud throw；E1 `checked===length` 防空转；期望二源（oracle 逐字节/冻结常量） | 无 |
| `issue-435-elementwise-array-control.test.ts`（17） | NC1 legacy 语义冻结；NC2 污染 delete 对照；NC3 闸门前提；NC4 立法前提；NC5 oracle 自洽；NC6 超集锚 | 同上 | 不引用新名目（恒绿锚独立于实现） | 无 |
| `issue-435-elementwise-array.test-d.ts` | B-1…B-5 签名 + 3 条 `@ts-expect-error` 负面夹具 | `--typecheck`（根 test「Type Errors: no errors」+ CI typecheck 作业 `--typecheck.only`） | 无 | 无 |
| `issue-435-elementwise-array-fixture.ts` | 132 例（6 路径×12 参数化 + 60 随机 mulberry32(435)）；污染组不进等价集 | 经两测试文件消费 | 死导出 `unionArrayPlan`/`VerdictIssue`（SA6 交付件，DENY 不可清） | O-3 |
| 判据敏感性（SA3 变异实验） | MUT-B（rebase off-by-one）/MUT-E（跳过元素校验）各 6 红；MUT-F（insert 域放宽）2 红；MUT-D（delete 首子句）0 红 | 聚焦 vitest（`artifacts/sa3-issue435-mutation-*.log` 逐条核对测试名与失败数） | MUT-D 为 covered 域等价变异（count≥1 使首子句被吸收）——SA3 诚实登记，实现仍逐字镜像 legacy | O-2 |

SA6 红灯断言保持：四件 mtime（11:49–11:51）早于实现（12:30+），SA3 未改一个字节；红→绿由实现单独达成。

## 10. Required revisions

无 BLOCKER / MAJOR finding。无需强制修订。

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| 证据时点：根 `pnpm test`（462/5622）执行窗口为 12:31:37–12:38:47，而 `validate-patch.ts` 最终写入 mtime 为 12:39:15.275（final-focused 于 12:39:15.172 完成后 100ms）；最终字节的行为证据 = guard-probe 21/21（12:39:52）+ 根 typecheck exit 0（12:40:52），全量 vitest 未在最终字节上复跑 | Controller 路由的验证角色（聚焦对 + 根 test 各一次） | 聚焦 38/38 绿；根 test 462 files/5622 tests 绿、Type Errors: no errors | 任一失败即说明最终写入引入了 S0→S1 行为差（静态审查判定概率极低：当前 diff 纯加法且逐行核对通过） |
| CI 首跑（新测试文件落片 + typecheck 作业） | push/PR 触发 `.github/workflows/ci.yml` | Node 20/24 × 6 分片全绿；typecheck 作业绿 | 分片漏跑或 typecheck 红 |

## 12. Non-blocking observations

| ID | Observation | 建议 |
|---|---|---|
| O-1 | 根 test 绿的证据锚定在最终源写入之前的字节状态（时间线见 §11 行 1；guard-probe + typecheck 已覆盖最终字节，静态审查另已闭合） | 按 §11 行 1 补一次收尾复跑即闭环；无需改代码 |
| O-2 | delete 域首子句 `index >= length` 在当前契约域（count ≥ 1）不可测分（MUT-D 0 红）；实现逐字镜像 legacy，无现行缺陷 | 若未来 count=0 形态进契约（doc-runtime E3 放宽时），须同步补 `index===length ∧ count===0` 用例 |
| O-3 | SA6 fixture 死导出 `unionArrayPlan`、`VerdictIssue`（无消费者） | DENY 件不清理；后续触碰该文件的票顺带收口 |
| O-4 | 设计 ALLOW「头注释补一句」实际各落 3–4 行注释（index.ts 头 4 行 + 导出块注释 4 行、validate-patch.ts 头 4 行） | 注释面、同一 ALLOW 条目内，无行为效应；记录即可 |
| O-5 | 污染基线 insert 的 issue 列表分歧（legacy 报旧+新元素 issue，接缝只报新元素 issue）为设计 §8.4 决策 4 族显式接受且不进契约——当前无测试锚定该边界 | doc-runtime 接线票引入 wired 行为测试时顺带锚定，避免未来误判为回归 |

---

## 附：一句话结论

实现把批准设计逐字落成 `applyElementwiseArrayMutation(derived, plan, {length}, payload) → ValidateResult`
（三条件 fail-closed 闸门 → 事实/载荷守卫 → 逐字域规则 → insert 逐值 `validateSubtree(element)` +
`[...prefix, index+j]` rebase / delete 仅域规则），两文件纯加法（+130/−3，运行时导出 22→23），
DENY 全清单零触碰，SA6 21 红契约翻绿、17 负控恒绿、类型契约干净、根门禁有日志证据，测试判据敏感性
经变异实验证明——**approve**，附 5 条非阻断观察与 2 项后续动态验证项。
