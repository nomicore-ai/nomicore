# SA3 Implementation Report

- Dispatch：`sa-cbf81ed8-a557-4de8-8d67-8de27a7a651b`（mabf-sa3 / implementation / **iteration 1**）
  ——承接 iteration 0（`sa-4b47d6ec-fca9-4b3f-b434-c0375eb4a451`）的首版实现与
  SA8 实现复查（`task_issue-363_implementation_conflict_report.md`，verdict **reject**，I7）返工
- 任务：issue #363（T1：投影文本渲染器——`@nomicore/vfsl` 公共导出；ADR 0027 决策 2/3）
- 基准 HEAD：`12674544d2f24eb7d47c47ca4613b894043711d4`（SA6 / SA1 / SA2 / SA8 登记一致；本次复核未变）
- 本轮变更：**SA8 I7 修复**（optional 包装截断标记在 own-line 宿主位计入段标记数 →
  `m>0` 恒页脚、`countOccurrences('‡') === m+1`）+ **红先回归覆盖**（G3.7a–d）
  + 受影响 package / 根门禁全量复跑
- 结果：**I7 红先转绿**；86 金标格逐字节零漂移（零重录）；`pnpm typecheck` / `pnpm test`
  exit 0（381 files / 4540 tests，0 failed / 0 type errors）

## 1. Inputs consumed

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| `wiki/raw/task_issue-363.md`（Host brief） | 在场 | 票面 What-to-build + AC 6 条 |
| `wiki/raw/task_issue-363_sa6_contract.md` | 在场（approve） | CT-1…CT-7、86 金标格、红因机制、测试入口纪律；§12.4 CT-3 计数不变量 |
| `wiki/raw/task_issue-363_design.md` | 在场（iteration 2，SA1） | §7 文法钉死、§7.4 点 1/2（`‡` 页脚 + 计数不变量）、§11 ALLOW/DENY、§12 验收、附录 A 样张 |
| `wiki/raw/task_issue-363_sa2_review.md` | 在场（iteration 2，**approve**，`Required revisions: 无`） | R1–R5 / O1–O8 基线 |
| `wiki/raw/task_issue-363_relevant_decisions.md` | 在场（SA8 D1–D18 摘录） | 包边界 / 导出纪律 / 失败通道 |
| `wiki/raw/task_issue-363_conflict_report.md` | 在场（verdict clear） | frozen surfaces / 复查路由 |
| `wiki/raw/task_issue-363_implementation_conflict_report.md` | 在场（verdict **reject**，I7） | **本轮返工输入**：§6 hard-conflict、§7 Required actions 1–3 |
| 本文件 `task_issue-363_sa3_impl.md`（iteration 0 版） | 在场 | 首版实现与录制纪律记录；本轮**原位更新**为当前实现与当前验证结果 |
| Issue REST comments snapshot | 空 | 无 owner 需求、无 comment ID、无合法 override |
| 源码 / fixture 实读 | 本次 | `render-projection-text.ts` 全文、`resolve-schema-at-path-budget-fixture.ts`（twin / `BUDGET_OPTIONAL_TWIN_PATHS`）、runtime 测试 `countMarkers`、金标四件 |

## 2. Existing worktree reconciliation

- 本轮进入时工作树 = iteration 0 的完整实现与测试四件（`index.ts` +6 行纯加法、渲染器
  999 行、runtime 契约 675 行、类型面 66 行、恒绿控制组 169 行、共享 fixture 577 行）
  + Host/SA 文档 untracked；无遗留临时探针、无未提交的半成品。
- 与最新设计（iteration 2，SA2 approve）逐条核对：与设计 §7/§11/§12 一致，**无过时或
  冲突实现需删除/修正**，iteration 0 的全部改动按设计保留。
- SA8 实现复查的**唯一硬冲突 = I7**（optional 包装截断标记不计数 ⟹ twin 投影缺页脚）；
  本轮按该报告 §7 行 1–3 执行：修复实现 → 补强制覆盖 → 复跑门禁并核对 86 金标稳定性。
  SA8 报告 §7 行 4（尾缀→最小键映射草图的非阻塞登记）与行 5（跨票台账）**无需行动**，
  未触发任何设计修订（I7 正确行为由 ADR 0027 决策 3 + 设计 §7.4 唯一确定，零 redesign）。

## 3. Changed paths

| Path | Design section | Change |
| --- | --- | --- |
| `packages/vfsl/src/render-projection-text.ts`（1002 行） | §7.4 点 2（I7 修复） | `emitValue` optional 链解包后 `default` 分支：`inner` 为 `kind:'truncated'` 时 `ctx.section.markers += 1`（+3 行含注释；其余 999 行为 iteration 0 首版实现，零改动） |
| `packages/vfsl/test/render-projection-text.test.ts`（733 行） | §12 CT-3 / SA6 §12.4；§11 ALLOW 行 3 | 新增 G3.7a–d 红先回归（4 tests）；import 增补 `BUDGET_OPTIONAL_TWIN_PATHS`、`optionalWrappedProjection`、类型 `OptionalMarkerHost` |
| `packages/vfsl/test/render-projection-text-fixture.ts`（631 行） | §11 ALLOW 行 6（加法） | 新增 `OptionalMarkerHost` + `optionalWrappedProjection(host, marker?)`（`optional{value:marker}` 四宿主位手造 + m=0 负控孪生）；文件头内容清单补一行。**`RENDER_GOLDENS` 录制区零改动** |
| `packages/vfsl/src/index.ts` | §7.0、§11 ALLOW 行 2 | iteration 0 的 +6 行（1 值导出 + 1 类型导出 + 注释锚）**本轮零改动**（`git diff --stat` = 6 insertions） |
| `packages/vfsl/test/render-projection-text-control.test.ts`（169 行） | §11 ALLOW 行 5 | 本轮零改动 |
| `packages/vfsl/test/render-projection-text.test-d.ts`（66 行） | §11 ALLOW 行 4 | 本轮零改动 |
| `wiki/raw/task_issue-363_sa3_impl.md`（本文件） | skill 固定产物 | 原位更新为当前实现与当前验证结果 |

`git status --short` 复核：仅上述 5 个包内代码/测试路径（1 modified + 4 untracked 新文件）
+ Host-owned `wiki/raw/*363*`；**DENY 面零触碰**。

## 4. SA2 Finding落实

SA2 iteration 2 verdict = **approve**，`Required revisions: 无`。设计承接的 R1–R5 与观察项
在 iteration 0 已落实，本轮零回归（下表为当前实现状态）：

| Finding ID | Implementation | Result |
| --- | --- | --- |
| R1 裸宿主行注释归属 | `emitUnion`/`emitArray`/`emitRecord` 裸宿主行照常 `registerPosition`；`renderComment` 与行形态无关 | 保持：金标 `inlPair: // 内联联合位`、`type AssetEntity = // 资产实体：封闭联合` 逐字节在场（G2 绿） |
| R2 optional 全位合成 | `unwrap`/`inlineAttach`/`blockIndentOf` 四款附着 + 链任意深度解包单 `?` | 保持：`F1 ["notes"]`=`string?`、`F1 ["config"]`=`{?` 块（G2 绿）；本轮 I7 修复显式断言 `[...]‡?`（G3.7a/b） |
| R3 环 / 畸形强制验收 | §12.1 环安全审计 + 环 9 格；全量守卫 `throw InternalError` | 保持：G8/G9 全绿（151 项契约+控制全绿） |
| R4 CT-8⑤ 环安全零变异观测 | `auditProjection`（节点身份 + 环安全摘要、禁 stringify） | 保持：9 格审计绿 |
| R5 `InternalError` 单一类身份 | `import { InternalError } from './resolve.js'` | 保持：包内 `class InternalError` 定义数 = 1 |
| O1–O8（非阻塞观察） | iteration 0 逐条落实/登记 | 保持（无新增偏差） |

## 5. SA8 I7 落实（本轮重点）

| Finding ID | Implementation | Result |
| --- | --- | --- |
| **I7**（hard-conflict，可修正实现缺陷）：optional 包装截断标记在 own-line 宿主位不递增段标记计数 ⟹ 投影内标记全为 optional 包装时 `markerCount === 0` → 页脚被省略，违反设计 §7.4 点 2（`m>0` 恒页脚）与计数不变量 `countOccurrences('‡') === m+1` | `emitValue` 的 optional 链解包后（`inner` 非 optional）在 `default`（inline 叶子）分支补计数：`if (isSchemaTruncationMarker(inner)) ctx.section.markers += 1;`。该分支是 `inlineLeafText` case `'truncated'` 的唯一可达调用点，原先不经 `emitValue` 顶部（L442）与 `inlineText` 顶部（L711）两个既有计数点——现三个 `‡` 产生点全部计数，无非计数旁路、无新增机制、无双重计数（顶部检查在 optional 包装上恒 false） | **已修复**。冻结 resolver 真实产物 `resolveSchemaAtPath(budgetFixtureDerived(), ['opt'], {depth:0})`（`optional{value:marker}`）输出由 `"[...]‡?\n"`（1 位标、0 页脚）变为 `"[...]‡?\n\n‡ 截断标记：…\n"`（1 位标 + 1 页脚、计数 2 = m+1） |
| I7 回归覆盖（SA8 §7 行 2：保持 86 金标格集合不变，以 CT-3 手造投影 + resolver 真实产物作输入锚） | 新增 G3.7a–d：**a** 冻结真实产物 `['opt']` d0（`BUDGET_OPTIONAL_TWIN_PATHS.optional`）——首行 `[...]‡?`、`m=1`、`‡` 计 2、页脚恰 1 行、全文逐行 `['[...]‡?', '', FOOTER]`；**b** 手造 `optional{value:marker}` 四类 own-line 宿主位（root / field / member / alias）——位标拼写（`[...]‡?`、`cut?: [...]‡`、`| [...]‡?`、`type OptAlias = [...]‡?`）、`m=1`、`‡` 计 2、页脚恰 1 行且位于正文之后；**c** 负控：四宿主位 `marker=false` 同形孪生 `m=0` → 无 `‡`、无页脚、`?` 合成仍在；**d** 负控：`['opt']` d1（无标记）→ 无 `‡`、无页脚 | **已补齐**。4 项全绿；`bare` 位对 `optional{marker}` 不可达（容器展开谓词对标记恒 false），故按可达宿主位枚举并登记（`OptionalMarkerHost` 注释） |
| I7 敏感性 / 无双重计数 | 红先运行（修复前）：G3.7a/b 在 `countOccurrences(text,'‡')` 处红（expected 2 / received 1）；修复后 4 项全绿。附加只读探针（`/tmp/sa3-363-probe-invariant.ts`，仓外）覆盖 15 种形状：optional 链（`optional{optional{marker}}`）、field/member/alias/root 宿主、数组元素与 Record 值 inline、展开内层、`optional{object{…}}`、optional+直接标记混合（`m=2` → 3 个 `‡`，证明无双重计数）、无标记孪生（`m=0` → 0）——`failures=0` | **成立**：每个被渲染的 `‡` 位标恰 +1；`m=0` 恒无 `‡`/页脚 |
| I7 冻结面复核（SA8 §9 `requiresConflictRecheck`）：86 金标 + 附录 A 样张逐字节稳定、快照零重录 | 金标未重录（fixture 录制区零改动）；`RENDER_GOLDENS` 86 格在修复前（iteration 0 录制并绿）与修复后（本轮 G2 全绿）两次比对同一录制字节 ⟹ 修复前后 86 格输出逐字节相同。`F2 [] d1` 的 `opt?: [...]‡` 格计数由 11 → 12（其余 10 个已计数标记已撑起页脚），文本字节不变 | **零漂移**：G2 86 格 + G3.6 计数不变量全绿；附录 A.1/A.2/A.4/A.5/A.6/A.7 所对应金标格同在其中 |

## 6. File scope check

| Changed path | ALLOW entry | Purpose |
| --- | --- | --- |
| `packages/vfsl/src/render-projection-text.ts` | ALLOW 行 1（新） | 本票全部生产改动（本轮 I7 修复 1 处分支 +3 行） |
| `packages/vfsl/src/index.ts` | ALLOW 行 2 | 公共 API 只经 index（SA8 D1）；iteration 0 的 +6 行，本轮未改 |
| `packages/vfsl/test/render-projection-text.test.ts` | ALLOW 行 3（新） | 运行时红契约（本轮 +G3.7a–d） |
| `packages/vfsl/test/render-projection-text.test-d.ts` | ALLOW 行 4（新） | 类型面契约（本轮未改） |
| `packages/vfsl/test/render-projection-text-control.test.ts` | ALLOW 行 5（新） | 恒绿控制组（本轮未改） |
| `packages/vfsl/test/render-projection-text-fixture.ts` | ALLOW 行 6（新） | 金标/手造/truncations/畸形 fixture（本轮 +`optionalWrappedProjection`，加法） |
| `wiki/raw/task_issue-363_sa3_impl.md` | skill 固定产物（报告路径） | 实现报告原位更新 |

未修改任何 DENY 路径：`resolve.ts`/`resolve-schema-at-path.ts`/`derived.ts`/`evaluate.ts`/
`validate*.ts`（仅 import 只读消费，`InternalError` 复用）、既有 `packages/vfsl/test/**`
全部文件（`BUDGET_OPTIONAL_TWIN_PATHS`/`budgetFixtureDerived` 等仅只读 import）、
`namespace-runtime`/`doc-runtime`、`docs/**`、`CONTEXT.md`、`vitest.config.ts`、
各 tsconfig、版本号/发布链。

## 7. Verification

红先（修复前，仅新回归组）：

| Command | Result | Evidence |
| --- | --- | --- |
| `NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run packages/vfsl/test/render-projection-text.test.ts -t "I7 回归"` | **红**：exit 1；`Tests 2 failed \| 2 passed \| 140 skipped (144)`——G3.7a `["opt"] d0` ‡ 计 expected 2 / received 1；G3.7b host=root 同因；负控 G3.7c/d 通过 | `/tmp/sa3-363-evidence/red-i7-regression.log` |
| 只读探针（修复前，仓外 tsx） | `["opt"]` d0 输出 `"[...]‡?\n"`（1 位标、0 页脚）；对照 `["req"]`/`["plain"]`/`[]` d0 均为 2 个 `‡` + 页脚 | 探针输出（`/tmp/sa3-363-probe-opt.ts`） |

绿灯（最终源；命令承接设计 §12 / SA6 §14）：

| Command | Result | Evidence |
| --- | --- | --- |
| 新回归组（修复后） | exit 0：`Tests 4 passed \| 140 skipped (144)`；`Type Errors no errors` | `/tmp/sa3-363-evidence/green-i7-regression.log` |
| `NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run packages/vfsl/test/render-projection-text.test.ts packages/vfsl/test/render-projection-text-control.test.ts --typecheck` | exit 0：**151 passed / 0 failed**（契约 144 + 控制 7），`Type Errors no errors` | `/tmp/sa3-363-evidence/green-contract-control.log` |
| `./node_modules/.bin/tsc -p packages/vfsl/tsconfig.json` | exit 0 | `/tmp/sa3-363-evidence/green-pkg-tsc.log`（空输出） |
| `NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run packages/vfsl/test --typecheck` | exit 0：**51 files / 1116 tests passed**，`Type Errors no errors`（iteration 0 为 51/1112 → +4 新回归） | `/tmp/sa3-363-evidence/green-vfsl-focused.log` |
| `pnpm typecheck`（14 tsconfig 串行） | exit 0（`ROOT_TYPECHECK_EXIT=0`） | `/tmp/sa3-363-evidence/green-root-typecheck.log` |
| `pnpm test`（`vitest run --typecheck` 全仓） | exit 0（`ROOT_TEST_EXIT=0`）：**381 files / 4540 tests passed**，`Type Errors no errors`（iteration 0 为 381/4536 → +4 新回归） | `/tmp/sa3-363-evidence/green-root-test.log` |

附加核对（超出最小命令，实现自证）：

- **红先因果可归因**：新回归的两条失败**只**发生在计数/页脚断言（`‡` 计 1 ≠ 2），
  位标拼写断言（`[...]‡?`）与 `m` 前置断言均通过——红因即 I7 缺陷本身，不是夹具/入口伪红。
- **86 金标零漂移**：G2 的 86 格逐字节断言 + G2.0 键集 ≡ `EXPECTED_CELL_KEYS`（86）+
  G3.6 计数不变量全绿；`RENDER_GOLDENS` 录制区未被触碰（本轮 fixture 改动为加法段）。
- **无双重计数**：混合形状（1 个 optional 包装 + 1 个直接标记）输出 `a?: [...]‡` /
  `b: [...]‡` + 页脚，`‡` 计 3 = m(2)+1（仓外探针，15 形状 `failures=0`）。
- **范围反断言仍在红文件**：G1.3（无 `# readData [` 头行）与 CT-5 ✂ 段断言随 144 项全绿。

## 8. Deferred verification

- SA3 不承担：SA4/SA7 的代码与验收复核、SA8 的冲突复查闭合（`requiresConflictRecheck: true`
  的义务由 SA8 在修复后按 frozen surfaces 表复核）、真实环境验收、CI、提交/发布。
- 待 SA7 按设计 §12 复核：CT-1…CT-9 与设计 §7 逐字规则的对应性；金标「录制自实现」的
  独立推导复核（附录 A 为独立锚）；I7 新回归的断言强度复核（是否应再钉 `bare` 位不可达证明）。
- 跨票台账（本票不实现）：缝 2（readData 恒四键 + 头行前贴 + 一致性锚 + minor bump）、
  缝 3（文档词汇重录）、敌意 getter 边界（设计 §7.5 / §13 F1）。
- 版本号 / 发布链未动（ADR 0027 决策 5 bump 挂缝 2 票）。

## 9. Deviations or blockers

- **无阻塞、无设计偏离、无验收语义变更**。I7 修复严格落在设计 §7.4 点 2 与 ADR 0027
  决策 3 原文内（SA8 已裁定：正确行为由既有决策唯一确定，零 redesign / 零 ADR 修订）。
- SA6 红灯断言零修改、零 skip/only/todo、零 env override/fallback；新增回归只加强
  既有 CT-3 断言组，未弱化任何既有断言；渲染器公共面与签名零变化。
- 覆盖边界登记（非偏离）：`optional{value:marker}` 的 `bare` 宿主位不可达（容器展开谓词
  `needsExpansion` 对标记恒 false），故 `OptionalMarkerHost` 只枚举 root/field/member/alias
  四类可达 own-line 宿主位；该边界写在 fixture 类型注释内。
- iteration 0 的两处设计粒度内实现加固（`needsExpansion` 判定链防环、`inlineText` 下降
  栈语义）维持不变，不改变任何金标输出。

## 10. Suggested commit message

```
feat(vfsl): 投影文本渲染器 renderProjectionText 公共导出（ADR 0027 决策 2/3，issue #363）

- 新增 packages/vfsl/src/render-projection-text.ts：零选项纯函数，投影四件套 +
  可选 truncations → 确定性投影文本（字段行/标量域照源文法、Record/union/数组展开、
  别名块闭包发现序、optional 四宿主位附着、docs first-line 与敌意防御、‡ 页脚、
  ✂ 段；环重入 … 栈语义；畸形 trusted-domain InternalError）
- index.ts 追加 1 值导出 + 1 类型导出（既有 20 导出零改动）
- 新增契约测试四件：运行时红契约 144 项（含 86 金标格、CT-8 环 9 格 + 环安全审计、
  CT-9 畸形 8 抽样、I7 红先回归 G3.7a–d）、类型面契约、恒绿控制组、共享 fixture
  （金标实现期录制，与设计附录 A.1/A.2/A.4/A.5/A.6/A.7 逐字节一致，零重录）
- 修复 SA8 I7：optional 包装截断标记在 own-line 宿主位计入段标记数（m>0 恒页脚、
  ‡ 计 = m+1；冻结产物 ["opt"] d0 由 1 位标/0 页脚恢复为 1 位标 + 1 页脚）

Refs: #363, ADR 0027
```
