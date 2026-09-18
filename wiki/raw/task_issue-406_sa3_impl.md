# SA3 Implementation Report — Issue #406 窗口面同轴：`readArray` / `readMap` 的 `maxBytes`

- 派发：`sa-32f8adfc-9706-489d-bb8f-0267edab8ffd`（role `mabf-sa3`，phase `implementation`，iteration 0）
- Worktree：`/home/wangjian/nomicore-fix-issue-406`（branch `mabf/issue-406`，基线 HEAD `56cf5428…` = `fix(#405)`）
- 结果：SA6 rev1 契约 7 文件 45 用例 **全绿**（落盘时 22 用例红）；包内门禁 + 定点 `--typecheck` + root `pnpm typecheck` + root `pnpm test` 全绿；DENY 面零 diff。
- 本文件为**首版**（迭代 0 前无 `task_issue-406_sa3_impl.md`、无未提交实现——开局 `git status` 实测：生产 `src/**` 零 diff，仅两处 SA6 原位类型锁 + 5 份契约测试未跟踪）。

## Inputs consumed

| 输入 | 状态 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-406.md`（Host task brief；`## Comments` 段空） | 在场，实读 | Issue 正文 AC1–AC7 + `Blocked by #405`（解除：HEAD 即父票落地提交） |
| `wiki/raw/task_issue-406_sa6_contract.md`（rev1，verdict approve；18 冻结锚 + 7 契约文件） | 在场，全读 | 验收权威：G1–G10 / C1–C10 / T1–T5 / §12.0 锚 / §12.5 反伪绿 / §12.7 pins / §12.8 门禁 |
| `wiki/raw/task_issue-406_design.md`（SA1，426 行） | 在场，全读 | DD-1–DD-9、ALLOW/DENY、验收映射、风险 R-1–R-8 |
| `wiki/raw/task_issue-406_sa2_review.md`（SA2，verdict approve；O-1–O-4） | 在场，全读 | 无 BLOCKER/MAJOR；O-2/O-4 处置见下 |
| `wiki/raw/task_issue-406_design_conflict_report.md`（SA8，verdict clear；RA-406-1…5） | 在场，全读 | RA-406-1（parity 实现验收）、RA-406-2（OBL-DOC-406-1 收尾阻塞）、RA-406-3（实现后复审触发） |
| 父票 SA8 实现门禁 `task_issue-405_implementation_conflict_report.md` §8 **RA-I1** | 在场，实读 | 「G11 前两条断言届时原位改写并送门禁复核」——本票落地的**授权依据**（见 §Deviations） |
| 源码实读：`packages/doc-runtime/src/window.ts`（W1 校验/定序/计数）、`packages/namespace-runtime/src/{runtime.ts,window-read.ts,index.ts,p0.ts}`、`packages/namespace-registry/src/{lease.ts,types.ts}` | 完成 | 落点/定序/别名跟随事实 |
| 测试实读：`issue-406-*`（5 文件）+ registry `issue-406-*`（3 文件）+ `issue-369-window-read-composition-red.test.ts`（S3 计数锚 4/5）+ `issue-405-maxbytes-control.test.ts`（G11）+ `readdata-shape-assertion-consolidation-gate.test.ts` + `readdata-docs-adr0016-*` | 完成 | 断言口径、装置纪律、回归锚 |
| REST Issue-comment 快照 | **空（`[]`）**——与派发说明一致 | 无评论来源义务 |
| `task_issue-406_relevant_decisions.md` / `_conflict_report.md`（本票 SA8 前置） | **缺席** | 由 SA8 设计门禁（`_design_conflict_report.md`）自建冲突基准并逐条裁决，本报告不重做裁决 |

## Existing worktree reconciliation

开局实测（`git status --short` / `git log --oneline -5`）：

- 生产实现：`packages/**/src/**` **零 diff**（本节即首次实现落盘）。
- SA6 冻结面在场且保持零改动（沿用）：`issue-406-window-maxbytes-fixture.ts`、`issue-406-window-maxbytes-red.test.ts`、`issue-406-window-maxbytes-control.test.ts`、`issue-406-window-maxbytes.test-d.ts`、`issue-406-window-maxbytes-lease-fixture.ts`、`issue-406-lease-window-maxbytes-red.test.ts`、`issue-406-lease-window-maxbytes-surface.test-d.ts`。
- 两处既有类型锁原位延伸（SA6 落盘，HEAD 即绿）：`issue-369-window-read-lease-surface.test-d.ts`、`issue-383-window-where-type-guard.test-d.ts` —— **本次零改动**，实现后仍绿（中继锁 `Omit<…,'maxBytes'>` 自动成立）。
- 无过时/冲突实现需清退；无既有 `_sa3_impl.md` 需原位修订。

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/namespace-runtime/src/read-budget.ts`（**新建**，100 行） | DD-1 / DD-7（共享件单源） | 三面共享件：`ReadDataBudgetExceededResult`（自 `runtime.ts` 迁入）+ 超限文案模板 `budgetExceededMessage`（逐字节 = #405 冻结文案，唯一事实源）+ `readBudgetExceeded(path, measuredBytes, maxBytes)`（恰五键、path 新鲜回显）+ `deliveryBytes(value, schemaText)` 两通道度量 + `echoReadPath` 回显。包内内部模块，不经 `index.ts` 导出 |
| `packages/namespace-runtime/src/window-read.ts` | DD-2 / DD-5 / DD-6 / DD-8 | ① 两面 options 纯别名 → **runtime 自持六键 interface**（`maxBytes?: number`；`orderBy`/`where`/term 类型仍单源 import doc-runtime）；② 两面结果联合追加共享预算成员 `ReadDataBudgetExceededResult`；③ `canonicalWindowBudget` 白名单五→六键 + `maxBytes` 域镜像 + ok 分支回传 `readonly maxBytes: number \| undefined`；④ `composeWindowRead` 加 **S6.5 预算闸**（`deliveryBytes(entries, schema)`，`>` → `readBudgetExceeded`；在 S6 结算之后只读不写）；⑤ 组合入口签名：`doc` 形参 → **`redispatch` 闭包形参**（`WindowRedispatch` 具名类型；re-split + re-W1(relay₂) 由 runtime.ts 提供——DD-5/DD-9）；⑥ 模块/成员注释同步（S3 五→六键、S6→S6.5） |
| `packages/namespace-runtime/src/runtime.ts` | DD-1 / DD-3 / DD-4 / DD-7 / DD-9 | ① `readArray`/`readMap` 编排：S2-G0 前置分支（非数组 path → W1(raw) 单源拒 + G0 后成功 loud throw）→ `splitWindowOptions` → W1(relay) → `compose*(raw, 重派发闭包)`；② 新增 `splitWindowOptions`（泛型宿主 `O`、读纪律逐字镜像 W1：`Object.keys` + 每键恰 1 次显式 descriptor、零 `[[Get]]`、宿主门 relay=raw、域/accessor 前置拒、其余 descriptor 原样复制）+ `windowBudgetAxisInvalid`（`WINDOW_OPTIONS_INVALID` 恰四键，返回类型 = doc-runtime `WindowReadFailure` 单源）+ 三条窗口面 message 常量；③ `readData` 面共享件迁出改 import（`deliveryBytes` / `readBudgetExceeded` / `echoReadPath`），本地 `deliveryBytes` / `readDataBudgetExceeded` / `echoReadPath` 定义删除，`ReadDataBudgetExceededResult` 原位 `export type { … } from './read-budget.js'`（模块面名字不变）；④ `maxBytes` 域 message 的镜像义务边界注释修正（三面同文只覆盖超限分支）；⑤ readArray/readMap 接口 JSDoc 补 `maxBytes` 轴与失败优先级阶梯 |
| `.agents/skills/nomicore/typed-access.md` | OBL-DOC-406-1（RA-406-2 / 父票 RA-3） | 窗口读小节补 **Byte budget on windows: `maxBytes`** 词汇：三面同码同文同载荷、域（≥1 有限整数 ≤2^53−1 → 窗口面 `WINDOW_OPTIONS_INVALID`）、总量 = 条目列表（含 `{index\|key,value}` 包装）紧凑 JSON + 元素口径投影文本（✂/`‡` 自然计入、`schema:null` 计 0）、`≤` 逐字节相同 / `>` 五键零交付且不塑形、where × 预算三语义（超限同分支 / 装满判定不受影响 / ✂ 永不装配）、定序（options → 目标/载体 → 预算）与确定性重试；`WINDOW_OPTIONS_INVALID` 词条补域外 `maxBytes`；失败词表补 `READ_BUDGET_EXCEEDED` 条 |
| `packages/namespace-runtime/test/issue-406-window-maxbytes-control.test.ts`（SA6 落盘文件，**原位修订 1 用例**） | SA6 §12.2「实现方沿用/原位修订」+ 设计 §11 ALLOW | C7 第二个 `it`（抛错 get trap Proxy）实参 `maxBytes: 1` → `maxBytes: 0` + 注释记录理由；补 message 域断言。**契约自相矛盾处置**，详见 §Deviations D-2 |
| `packages/namespace-runtime/test/issue-405-maxbytes-control.test.ts`（父票既有测试，**原位改写 G11 前两条断言**） | 父票 SA8 RA-I1（#406 SA8 RA-406-3 引用） | G11 窗口面 `describe`/`it` 标题与断言：`WINDOW_OPTIONS_INVALID`（恰四键）→ `READ_BUDGET_EXCEEDED`（恰五键，键集经 `BUDGET_FAILURE_KEYS` 单源常量）；`maxBytes` 域内值不再当未知键；无预算侧与 doc-runtime 侧断言零改动。详见 §Deviations D-1 |

> 未改动（DENY 面零 diff，实测 `artifacts/sa3-issue406-scope-diff.log`）：`packages/doc-runtime/**`、`packages/vfsl/**`、`read-schema-projection.ts`、`packages/namespace-registry/src/**`、`packages/namespace-runtime/src/index.ts`、`CONTEXT.md`、`docs/**`、`docs/protocols/**`、契约冻结 fixture/锚、其余既有测试。

## SA2 Finding落实

| Finding ID | Implementation | Result |
|---|---|---|
| §13 Required revisions | 无 BLOCKER / MAJOR → 无需设计修订 | 设计中全部 DD 逐条落地（见 §Changed paths 的 Design section 列） |
| §2 verdict 面（契约 pins D1–D7 全采推荐解） | D1 present-undefined ≡ 缺席（split 剥离 + canonical 剥离，G5/D1 锚绿）；D2 联合直接追加共享成员（T1/T5 `Equal` 锁绿）；D3 runtime 自持六键 + doc-runtime 五键零 diff（`Omit` 中继锁 + `keyof` 硬锁绿）；D4 校验/度量住组合层（C5/G10 绿）；D5 超限文案逐字节镜像（C8/G3 绿）；D6 度量对象 = 塑形后交付物（G4/G8 绿）；D7 定序 lifecycle > G0 > options > W1 目标/载体 > 接缝 > 预算（C3/C6/G10 绿） | 全部绿 |
| §11（O-1 计数笔误，非阻断） | ALLOW glob 语义沿用（未因计数笔误扩大范围） | 已处置（沿用） |
| §14 O-2（根 `AGENTS.md` 窗口 options 枚举 stale-by-omission） | 非本票决策义务；#406 SA8 记为 **RA-406-5（advisory）**；根 `AGENTS.md` 不在设计 ALLOW 清单内 → 未修改，挂账移交（见 §Deferred verification） | 记录不处理 |
| §14 O-3（`deliveryBytes` 的 `JSON.stringify` 无 try 包裹） | 与已验收 #405 readData 面同阶（同一 helper、同为 yjs 物化域）；本次迁移**零行为变化** | 备案（未扩大暴露） |
| §14 O-4（三处内部签名联动：`CanonicalWindowBudget.maxBytes` / compose 返回加宽 / `redispatch` 闭包由 runtime 提供） | **作为单一联动单元落地**（一次变更集内完成，无中间红态） | 已闭合 |
| §5 pin D5 镜像边界（域拒走 W1 无码前缀族、不带 `READ_OPTIONS_INVALID:` 前缀） | 窗口面三条 message 独立常量（`window options.maxBytes …` 族）；`READ_MAXBYTES_DOMAIN_MESSAGE` 注释的镜像义务边界同步修正 | 已落实（G5 message 断言绿） |
| §7 C-1/C-2 计数锚重推导（R-1/RA-406-1） | split 读纪律逐字镜像 W1 + 重派发闭包 = re-split + re-W1(relay₂)（重派发只读 relay） | 实测绿：状态化 trap 总 descriptor 读 **4**；交替 trap **5**；`issue-369` S3 组 + `issue-383` A/T/X 组全绿（`artifacts/sa3-issue406-r1-counting-anchors.log`） |
| §5 A2 硬否决（W1/canonical 消费剥离视图） | canonical 与 split 均读 **raw**；W1 只读 relay | 结构遵守（未触碰否决面） |

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/namespace-runtime/src/read-budget.ts` | ALLOW「**新建**：共享 message 模板 + `readBudgetExceeded` + `deliveryBytes` + `echoReadPath` + `ReadDataBudgetExceededResult`」 | 三面同文单源（DD-1/DD-7） |
| `packages/namespace-runtime/src/window-read.ts` | ALLOW「六键 options interface、联合追加预算成员、canonical 六键镜像 + `maxBytes` 回传、S6.5 预算闸、模块/成员注释」 | DD-2/DD-5/DD-6/DD-8 |
| `packages/namespace-runtime/src/runtime.ts` | ALLOW「`readArray`/`readMap` 编排、`splitWindowOptions` + `windowBudgetAxisInvalid` + 三条 message 常量、`readData` 共享件迁出改 import、接口 JSDoc」 | DD-1/DD-3/DD-4/DD-7/DD-9 |
| `.agents/skills/nomicore/typed-access.md` | ALLOW「窗口读小节补窗口 `maxBytes` 词汇：同码同文、总量 = 条目列表 JSON + 元素口径投影文本、where × 预算三条语义、预算不塑形」 | OBL-DOC-406-1（RA-406-2） |
| `packages/namespace-runtime/test/issue-406-window-maxbytes-control.test.ts` | ALLOW「`packages/namespace-runtime/test/issue-406-*`…仅当实现期发现装置缺陷时原位修订并记录理由」 | C7 装置缺陷原位修订（§Deviations D-2） |
| `packages/namespace-runtime/test/issue-405-maxbytes-control.test.ts` | **设计 ALLOW 未列**（DENY 行「其余 `packages/*/test/**` 既有测试」） | 父票 SA8 **RA-I1** 明记的「G11 前两条断言届时原位改写」（§Deviations D-1；送门禁复核） |

## Verification

| Command | Result | Evidence |
|---|---|---|
| `pnpm exec vitest run <7 契约文件> --typecheck`（NODE_OPTIONS=--conditions=nomicore-source） | **exit 0；7 files（45 tests）全绿；Type Errors: no errors**（落盘红灯基线 = 4 files failed / 22 tests failed） | `artifacts/sa3-issue406-contract-family.log` |
| `pnpm exec vitest run packages/namespace-runtime/test packages/namespace-registry/test packages/doc-runtime/test --typecheck` | **exit 0；172 files / 2125 tests 全绿；Type Errors: no errors**（SA6 §4 基线 167 files / 2085 tests；+5 文件 / +40 用例 = 本票契约族） | `artifacts/sa3-issue406-focused-typecheck.log` |
| `pnpm exec vitest run <#369/#383 窗口族> --reporter=verbose`（R-1 计数锚） | **exit 0；2 files / 71 tests 全绿**；状态化 trap = 4 次 descriptor 读、交替 trap = 5 次（`issue-369` S3 组断言原文零改动） | `artifacts/sa3-issue406-r1-counting-anchors.log` |
| `pnpm typecheck`（root，14 tsc project） | **exit 0** | `artifacts/sa3-issue406-root-typecheck.log` |
| `pnpm test`（root 全量 `vitest run --typecheck`） | **exit 0；422 files / 5095 tests 全绿；Type Errors: no errors**（SA6 §13 基线 422 files（4 failed \| 418 passed）/ 5095（22 failed \| 5073 passed）——4 个红灯文件全转绿、零其它回归）；**冻结修订复跑二次确认**（全部 changed path 落盘后重跑）：exit 0 / 422 files / 5095 tests / no type errors | `artifacts/sa3-issue406-full-test.log`（首次）、`artifacts/sa3-issue406-full-test-final.log`（冻结修订复跑，结论一致） |
| DENY 面 `git diff --stat` + `git status --porcelain` | **全部为空**（doc-runtime / vfsl / 渲染器 / registry src / `index.ts` / CONTEXT / docs / protocols） | `artifacts/sa3-issue406-scope-diff.log` |
| 契约文件零 `skip`/`only`/`todo`/env override | **none**（grep 实测） | `artifacts/sa3-issue406-scope-diff.log` |
| 形状集中化门（`readdata-shape-assertion-consolidation-gate`，family A/B） | 24/24 绿（无新增字面键集——#405 G11 改写复用 `BUDGET_FAILURE_KEYS` 单源常量） | 见 focused log |
| doc-sync 门禁（`readdata-docs-adr0016-sync-{control,red}`） | 43/43 绿（OBL-DOC-406-1 落地不触判据） | 见 focused log |

### 断言组 → 目标实现判定（SA6 §12.4 对照）

| 组 | HEAD | 本次实现 | 证据 |
|---|---|---|---|
| G1–G6、G8、G10（红灯主体，20 用例） | 18 红 / 2 巧合绿 | **20/20 绿** | `issue-406-window-maxbytes-red.test.ts` |
| G9 行为（lease 透传，4 用例） | 2 红 / 2 绿 | **4/4 绿**（收/拒两侧 lease ≡ runtime 逐字段、`measuredBytes` 逐字、released 短路三键 + get trap 0 次） | `issue-406-lease-window-maxbytes-red.test.ts` |
| C1–C10（控制组，12 用例） | 12 绿 | **12/12 绿**（C7-get-trap 用例装置原位修订后，见 D-2） | `issue-406-window-maxbytes-control.test.ts` |
| T1–T5 类型（4 用例） | 2 红 / 2 绿 | **4/4 绿** | 两个 `issue-406-*.test-d.ts` |
| 既有类型锁（`#369` 中继 / `#383` 中继，5 用例） | 绿 | **5/5 绿**（零改动） | `issue-369-window-read-lease-surface.test-d.ts`、`issue-383-window-where-type-guard.test-d.ts` |
| R-1 计数锚 parity（RA-406-1） | 绿 | **绿（4 / 5）** | `issue-369-…-composition-red.test.ts` S3 组 |

## Deferred verification

1. **root `pnpm test` 冻结终态复跑**：**已完成**——`artifacts/sa3-issue406-full-test-final.log`（在 §Changed paths 全部落盘后复跑）：exit 0 / 422 files / 5095 tests / no type errors，与首次复跑（`…-full-test.log`）结论一致。
2. **实现后冲突/冻结面复查（RA-406-3）**：按 implementation 模式核对 SA8 设计门禁 §5 的 14 项冻结面 + DD-1–DD-9 落点 + `read-budget.ts` 迁移后 readData 面逐字节（C8）；本报告提供 DENY 零 diff 证据与门禁日志。
3. **发布门（RA-406-4）**：`@nomicore/namespace-runtime` 公共面加法（六键 options + 联合新成员）须随 **minor bump** 发布（ADR 0031 验收节），归 Runner Host，不在本变更集。
4. **RA-406-5（advisory，未做）**：根 `AGENTS.md` Nomicore 集成段的 `readArray/readMap` options 枚举 stale-by-omission 少 `maxBytes`。该文件**不在设计 ALLOW 清单**（SA8 明确其为非决策义务、不阻断收尾），故未修改；建议并入下一次文档巡扫（连同 #405 遗留 readData 口径一并巡检）。
5. **SA4/SA7 动态验证**：本报告的验证限于 SA3 职责面（红灯转绿 + 受影响 package typecheck + 设计指定静态 check）；SA4 实现审查与 SA7 活链路验证另行执行。

## Deviations or blockers

**无阻塞**。两处测试文件修订（均为「断言跟随已登记变更」，非验收语义弱化），逐项登记如下并要求门禁复核：

### D-1 `issue-405-maxbytes-control.test.ts` G11 前两条断言原位改写（设计 DENY 面，父票 SA8 直接授权）

- **依据**：父票 `task_issue-405_implementation_conflict_report.md` §8 **RA-I1**「…G11 前两条断言届时原位改写并送门禁复核」；本票 SA8 设计门禁 §3 行 9 与 **RA-406-3** 引用该句。
- **原文断言**（HEAD 事实）：`readArray/readMap` 携 `maxBytes` → `WINDOW_OPTIONS_INVALID`（未知键，恰四键）。
- **改写后**：`{n:1, maxBytes:1}` → `READ_BUDGET_EXCEEDED`（恰五键零交付，键集复用 `BUDGET_FAILURE_KEYS` 单源常量）；无预算窗口读现状与 doc-runtime 直调断言**零改动**。
- **理由**：#406 的**目标语义本身**就是让窗口面接受 `maxBytes`（G5 有效域接受锚明文「`{maxBytes:1}` 必须走 `READ_BUDGET_EXCEEDED`，**不是** options 码」）；原文断言与目标语义互斥，不修改则验收不可满足。
- **未弱化证明**：改写后的断言对 #406 实现的**回退敏感**（若窗口面退回「maxBytes ≡ 未知键」即红）；窗口面预算语义的完整验收由 #406 契约族 G1–G10 / T1–T5 / C1–C10 承担。

### D-2 `issue-406-window-maxbytes-control.test.ts` C7-get-trap 用例装置原位修订（契约**自相矛盾**处置）

- **矛盾事实**：C7 第二用例原实参 `{n:2, maxBytes:1}` 断言 `WINDOW_OPTIONS_INVALID` 四键；同契约 G5 有效域接受锚明文要求 `{maxBytes:1}` 必须走 `READ_BUDGET_EXCEEDED`（恰五键零交付）。`maxBytes: 1` 是 ADR 0031 域内合法值（≥1 有限整数），故**不存在**任何同时满足两断言的实现（HEAD 上 C7 只因「未知键」而巧合落 options 码）。
- **处置**：保持用例意图「敌意 get trap Proxy（descriptor 诚实）+ 零 `[[Get]]` → 响亮 options 码」不变，实参改为**域外** `maxBytes: 0`（options 违约面，唯一能承载该意图的值），并**增强** message 域断言（`toContain('maxBytes')`）；用例标题/判据结构/零外抛与零 trap 断言零弱化。
- **纪律依据**：SA6 §12.2「实现方沿用/**原位修订**」+ 设计 §11 ALLOW「仅当实现期发现装置缺陷时原位修订并记录理由」。**未修改任何 G 组（目标语义）断言**。
- **实测**：`artifacts/sa3-issue406-contract-family.log`（C7 两个用例全绿；G5 有效域接受锚全绿）。

### 其它

- **未新增校验码 / 未新增公共导出名 / 未加重载**：`splitWindowOptions` 的窗口面域拒复用 `WINDOW_OPTIONS_INVALID`；超限复用共享 `READ_BUDGET_EXCEEDED` 成员；`index.ts` 零 diff（值导出键集仍恰 `RuntimeWriteFatalError`，`runtime-acceptance-exports-audit` 绿）。
- **零 fallback / 零 env override / 零吞错**：敌意输入零外抛由 split 内层 try + canonical 两出口 + W1 单源收编三层覆盖（C7/G5/G10 绿）；`splitWindowOptions` 的 `{} as O` 单点类型断言为 descriptor 动态复制构造的静态化（运行时 relay 恒五键视图），非行为 cast。
- **`requiresConflictRecheck = true`**：沿设计 §15 与 SA8 §10 四条理由（公共 API 加法待实现核对 / 本票 SA8 前置产物缺席 / 结构决策 parity / OBL 未关闭）；本报告即 RA-406-3 的送审材料。

## Suggested commit message

```
feat(#406): 窗口面同轴——readArray/readMap 的 maxBytes 交付总量收/拒闸 (ADR 0031)

- options 五→六键（runtime 自持 maxBytes?: number；doc-runtime 五键面零 diff）；
  结果联合追加共享 READ_BUDGET_EXCEEDED 成员（与 readData 面同码同文同载荷形）
- 编排镜像 #405：S2-G0 → splitWindowOptions（读纪律逐字镜像 W1、零 [[Get]]）→
  W1(relay) → S3 canonical 六键镜像 → S5/S6 结算 → S6.5 预算闸（塑形后两通道度量）
- 新建包内共享件 src/read-budget.ts：message 模板 / 五键构造器 / deliveryBytes /
  echoReadPath 单源；readData 面构造点迁移，文案逐字节不变（C8 锚）
- where × 预算三语义保持：超限同分支、装满判定不受影响、✂ 永不装配、无静默丢弃
- OBL-DOC-406-1 / RA-406-2：typed-access.md 窗口读小节补 maxBytes 词汇
- 测试：#406 契约族 7 文件 45 用例全绿（原 22 红）；#369 计数锚 4/5 parity 保持；
  #405 G11 前两条断言按父票 SA8 RA-I1 原位改写；C7 get-trap 装置缺陷原位修订
```
