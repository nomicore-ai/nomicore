# SA4 实现静态审查 — issue #383：[ADR 0029] P3 组合面与 lease 类型（缝 2：runtime + registry）

- 被审对象：worktree `/home/wangjian/nomicore-fix-issue-383`（branch `mabf/issue-383`，基线 HEAD `de2ff55` 之上的未提交实现 diff）。
- 审查人：SA4（mabf-sa4，dispatch `sa-e6a73f68-08f8-4ef6-9635-26ac5079ba04`，iteration 0）。
- 审查日期：2026-09-16。
- 审查方式：纯静态（源码/diff/测试/文档逐行核读 + 只读 git/grep）；未运行测试、未启动服务、未修改任何实现/设计/测试文件（本报告为唯一产物）。

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-383.md`（简报 AC1–AC8；评论 REST 快照 `[]`） | 已读 |
| `wiki/raw/task_issue-383_sa6_contract.md`（approve；B-1–B-15、§12.3 用例组、§12.4 M1–M7、§12.5 P1–P6、§12.6 结构审计、§12.7 反伪绿、§15-O1–O7） | 已读（全文 511 行） |
| `wiki/raw/task_issue-383_design.md`（SA1 iteration 1；§5.1–§5.6、§7 ALLOW/DENY、§8 验收映射） | 已读（全文 361 行） |
| `wiki/raw/task_issue-383_sa2_review.md`（approve；F-383-S2-1 消解 + 观察 1–5） | 已读 |
| `wiki/raw/task_issue-383_sa3_impl.md`（实现报告；Changed paths / Verification / Deviations） | 已读 |
| `wiki/raw/task_issue-383_implementation_conflict_report.md`（SA8 implementation 复查 `clear`；I1–I16、F1–F11 逐项） | 已读 |
| 实际 diff：`git diff` 全文核读（`window-read.ts` 570 行现文全文、`runtime.ts` diff、四文档 diff）+ 5 个新增测试/fixture 全文 | 已读 |
| W1 权威源码 `packages/doc-runtime/src/window.ts`（985 行全文；`validateWindowOptions`/`validateWhere`/`validateWhereTerm`/`validateWhereEquals`/`WHERE_TERM_LIMIT`） | 已逐行比对 |
| `packages/namespace-registry/src/lease.ts` L300–320、`src/types.ts` L460–490（透传与别名链现状） | 已读 |
| `docs/adr/0029-filtered-window-read.md`（§1–§8 + 备选 + 验收缝 2 全文） | 已读 |
| `CONTEXT.md` L58–70（「窗口读」「过滤窗口」词条全文） | 已读 |
| 运行器配置：`vitest.config.ts`（include / typecheck.include / alias）、`tsconfig.typecheck.json` | 已读 |
| 先例：`issue-369-window-read-fixture.ts`、`issue-369-window-read-composition-red.test.ts`（import 形态）、`issue-369-window-read-lease-contract-red.test.ts`（清理形态）、`issue-382-lease-where-no-silent-pass.test.ts`（条件不变式全文）、`readdata-shape-assertion-consolidation-gate.test.ts`（作用域） | 已读 |

Owner 评论：REST 快照为空（dispatch 明示 none）——无 Owner 评论映射义务；权威 = 简报 AC1–AC8 + ADR 0029 + 设计 iteration 1。

## 2. Verdict

**`approve`** —— 无 BLOCKER、无 MAJOR。3 条 MINOR 观察不阻断（§11）。

实现把设计 §5.1–§5.6 逐项落地且逐条可溯源：S6 双语义单源判据 + ✂ 结构性永不装配、S3 五键白名单 + `canonicalWhere` 判据逐条镜像 W1（本审查对两侧源码逐行比对，判据集合零漂移）、registry/doc-runtime/index 零 diff、四文档措辞与 CONTEXT.md「过滤窗口」/ADR 0029 §5 逐点一致、文件范围与 ALLOW/DENY 完全吻合、测试先例真实可触发且断言由独立预言机派生。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| AC1 无 where 结算与 ADR 0028 快照逐字节一致 | `window-read.ts` L203–209：`total !== undefined` 分支表达式与旧代码逐项等价（`kept < total` + `truncated ∧ anchor ≠ null ∧ segments ≠ null` 才装配 ✂）；`windowFactsBlock`/`appendWindowFacts`/`foldSegment` 零改动 | 落实（既有 #369/#382 家族零改动零改红，SA3 实测 6 文件 199 用例绿） |
| AC2 有 where `truncated === (kept === n)`；✂ 永不装配、无过滤槽；schema 仍元素口径 | L204 `total === undefined ? kept === canonical.n : kept < total`；L205–209 `appendWindowFacts` 仅出现在 `total !== undefined` 分支（结构性排除，非布尔开关）；两分支 schema 同源 `anchor` | 落实；匹配恰 n 亦 true（T4/S2 击穿计数型） |
| AC3 恒四键 own 键集、条目身份随行 | L210 `return { ok: true, value: entries, schema, truncated }` 原样；`CanonicalWindowBudget` ok 分支加 `n` 为模块私有类型（未导出，不上公共面）；K1/K4/K5 断言 index 不重编号、key 原键 | 落实 |
| AC4 组合式 depth 等价锚 | 零新逻辑（条目值 = W1 物化产物直通）；S5 锚链/预算消费零改动；D1–D5 测试以同预算 `readData(项路径)` 为 oracle + D5 毒埋 | 落实 |
| AC5 S3 两出口对 where 判据同步、敌意 where 零外抛 | `canonicalWhere` 全程 descriptor 纪律 + 双层 try 收编；两出口（出口① W1 失败透传 L181–182 / 出口② `seamWindowOptionsInvalid` L183）机制复用零新码；Z1–Z11 + S1b | 落实 |
| AC6 registry lease 类型 fail-closed + 透传 | registry `src/**` 零 diff（实测）；`WhereTerm` 经 doc-runtime type-only 导出 + 单源别名链（`types.ts` L468–485 现状确认）；两个 test-d（14 条 `@ts-expect-error` + Equal 锁 + Y5 TS2694 双侧锁定） | 落实（具名再导出按设计 §5.3 明确不采，L6「未加不构成违约」） |
| AC7 close 后带 where 读 → `RUNTIME_READ_DISABLED` 四键 | `runtime.ts` S1 gate 区间零改动（diff 仅注释，逐行核对）；C1–C3 trapCounting 断言零 options 触达 | 落实 |
| AC8 测试先例 + 全仓门 | 5 个新文件按 `issue-383-*` 命名，匹配 `vitest.config.ts` include `packages/*/test/**/*.test.ts` 与 typecheck.include `packages/*/test/**/*.test-d.ts`（自动采集，零配置改动）；fixture 非 `.test.ts` 不被收集；SA3 报告 `pnpm typecheck` exit 0 + `pnpm test` 400 files / 4903 tests exit 0（数目对账：396+4 文件、4827+70+6 用例，逐位一致） | 落实（运行为 SA3 自报证据，静态核对其内部一致性成立；见 §10 动态验证项） |
| SA2 `F-383-S2-1` ①–④（文档对齐范围） | 四文档 diff 全文核读：根 `AGENTS.md` 签名 `where?` + 双语义限定句 + 指向 CONTEXT.md；`typed-access.md` 词表段/✂ 段/失败处置三处 + L170 完备性从句（观察 1 收编）；`cordis-plugin-hosting.md` 三处；`SKILL.md` L15 短语级 `optional where equality filter` 且不陈述截断语义；`app-data-access-skill.md` 零 diff | 落实 |
| SA2 观察 1（canonical n 承载） | `CanonicalWindowBudget` ok 分支 `{ ok, budget, term, n: number }`（L232–240）；S6 消费 `canonical.n` | 落实（ALLOW ② 点名改形，非越权） |
| SA2 观察 5（哨兵具名常量） | `const WHERE_TERM_LIMIT = 16`（L230）+ 出处注释（doc-runtime `window.ts` L74 同值；不导出——导出违 F9） | 落实 |
| SA8 A1–A6 / F1–F11 / R16 | SA8 implementation 复查已逐项闭合（I1–I16，`clear`）；本审查独立复核关键面：`seamWhereNotImplemented` 全仓 grep 零命中；`git diff --stat` 对 doc-runtime src / registry src / runtime index.ts 均为空；全仓 `kept < total` 文档面（排除 wiki//adr//CONTEXT）恰 4 处且全部带 where 限定 | 落实 |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| D1 §5.1：删入口 fail-closed 与 `seamWhereNotImplemented`；双语义单点 `total === undefined`；canonical `n` 装满判定；✂ 结构性排除 | `window-read.ts` L171–211（骨架）、L195–210（S6）、L547–557（`seamWindowOptionsInvalid` 保留、`seamWhereNotImplemented` 已删） | 与设计伪代码逐表达式一致；无 `total ?? 0`、无 `as number` 兜底（唯一 `as number` 为 `isScalarEquals` 的 `Number.isFinite` 收窄 L389，非 total 路径）；无 `kept < undefined` 通道 | —— |
| D2 §5.2：白名单四→五键；`canonicalWhere` 判据镜像（W-4–W-13）；哨兵具名常量；present-undefined 顶层剥离；宿主/轴值判据不动；镜像不产出 canonical 值 | L262–296（键循环）、L300–302（where 镜像调用点）、L312–391（三镜像函数）、L230（哨兵） | 逐判据与 W1 `window.ts` L362–474 比对**零漂移**（详见 §5 判据对照表）；L221–254 区间内仅白名单条件与返回形状两处改写，宿主/轴值判据逐字节保持 | —— |
| D3 §5.3：registry 零代码、不再导出 `WhereTerm` | registry `src/**` 零 diff；L6/Y5 测试锁定值导出面零新增 | 落实 | —— |
| D4 §5.4：锚链/身份/预算零改动 | `anchorSchemaBody`/`windowFactsBlock`/`appendWindowFacts`/`windowPathText` 不在 diff 区间（git diff 核对） | 落实 | —— |
| D5 §5.5：S1 gate / released 短路 / W1 失败透传零改动 | `runtime.ts` diff 仅 readArray doc 注释（行为零改动，逐行核对）；`lease.ts` L307–317 现状未动 | 落实 | —— |
| D6 §5.6：四文档补注 + `app-data-access-skill.md` 显式不改 | 四文档 diff 与 §5.6 表逐行对应；grep 门实测 4 处命中全带限定 | 落实 | —— |
| 设计 §5.2「结构合法但隐藏 where 的视图必须通过」 | S1 测试（`statefulOptionsProxy` 两视图）+ 实现（S6 判据键于 total，S3 对 `{n:2}` 视图判稳定） | 一致：结算按 W1 已过滤结果、truncated 取 canonical n、无 ✂——SA6 §15-O4 的 A3 路线正确落地，无静默改期望 | —— |

**S3 镜像判据逐条对照（本审查独立比对两侧源码）**：

| 判据 | W1（doc-runtime `window.ts`） | S3（runtime `window-read.ts`） | 一致 |
|---|---|---|---|
| W-4 数组性 | L368 `Array.isArray` | L329 同 | ✓ |
| W-5 length 经 own data descriptor + 非负整数 | L372–379 | L331–334 | ✓ |
| 非空 / ≤16 | L380–385（`WHERE_TERM_LIMIT`） | L335–336（同值具名常量） | ✓ |
| W-6 逐下标 descriptor、空洞/accessor 拒 | L387–395 | L337–342 | ✓ |
| W-7 元素非 undefined/null/数组、typeof object | L412–414（try 外，无抛点） | L353（try 外，同构） | ✓ |
| W-8 原型链恰 Object.prototype/null | L416–420 | L355–357 | ✓ |
| W-9 键白名单恰 field/equals | L425–429 | L362–364 | ✓ |
| descriptor 缺失 ≡ 非 own（continue） | L430–431 | L365–366 | ✓ |
| accessor 拒 | L432–434 | L367 | ✓ |
| W-12 两键必填闭环 | L443–446 | L376 | ✓ |
| W-10 field 恰 string | L447–450 | L377 | ✓ |
| W-11 equals 标量闭集 + finite | L462–474 | L384–391（`isScalarEquals`） | ✓ |
| trap 收编（零外抛） | L401–402/L457–459 + 外层 L350–352 | L345–347/L379–381 + 外层 L307–309 | ✓ |
| 顶层键集五键白名单 / present-undefined 剥离 / n·depth·maxChildrenPerNode 判据 | L311–343 | L262–297 | ✓（逐字节同判据） |

镜像只返回布尔、不构造归一化数组、不参与过滤语义（B-3/B-15）；在场判据在 S6 单点键于 `total`（B-4）。两出口对 where 同样可达（Z7/Z8/S1b 实证路径推演成立）。

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| where 合法性权威校验 + 过滤 + total 双形态 | doc-runtime W1 | `window.ts`（零 diff） | 正确（F9） |
| 接缝净化镜像 + 双语义结算 + ✂ 装配 | runtime 组合层 | `window-read.ts` 唯一落点 | 正确（S3 是镜像非第三权威；零计数/零谓词求值镜像——`canonicalWhere` 无匹配求值） |
| 透传 / released 短路 | registry lease | `lease.ts`（零 diff） | 正确（F10） |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| 窗口契约共享 fixture | `issue-369-window-read-fixture.ts`（StubPersistence/StubHandle/manualClock/deterministicRandomBytes/schema-ready 轮询） | 新 fixture 逐件同构（类名换 Filtered*，同纪律）；跨包 import `../../namespace-runtime/src/runtime.js` 与 #369 L37 同款 | 一致 | 设计推荐新建保 #369 fixture 零漂移 |
| 组合面红灯契约测试 | `issue-369-window-read-composition-red.test.ts`（`expectReadDataOkKeys`、字节锚、独立预言机、`bodyBlocks` 剥离对账） | 新测试同 helper 同形态 | 一致 | —— |
| lease 面契约 + 类型锁 | `issue-369-window-read-lease-contract-red.test.ts` / `issue-369-window-read-lease-surface.test-d.ts`（Equal 锁 + `@ts-expect-error`） | 新 lease 测试与 test-d 同形态 | 一致 | —— |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| where 在场判据 | W1 结算 `total === undefined` | S6 结算分支 | 低：单点消费，S1 交替视图用例守卫 |
| 过滤/计数/排序 | W1 | 组合层零镜像求值 | 低：D5/S3 毒埋击穿任何重走 |
| `WHERE_TERM_LIMIT = 16` | doc-runtime 模块私有常量 | runtime 侧具名常量 + 出处注释镜像 | 低（可漂移面登记）：Z9（16 合/17 非法）行为锚 + §12.6 S4 审计；导出即违 F9，镜像是设计明选 |
| 截断双语义措辞 | CONTEXT.md「过滤窗口」+ ADR 0029 §5 | 四文档补注（措辞限定） | 低：grep 门 + 零行为发明核读 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| 每用例独立 fixture（runtime / lease / pair） | runtime 用例逐个 `close()`；lease 用例 `release()`（部分加 `registry.shutdown()`） | 同步纯读、零资源泄漏通道；清理形态与 #369 lease 先例一致（§382 先例用 try/finally 更严，见观察 2） | 通过 |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 第二套 where 校验权威？ | W1 `validateWhere` | S3 `canonicalWhere` 判据镜像 | 非平行机制：S3 只答「视图是否与 W1 判据一致」，任何分歧走既有两出口响亮处置（A2「S3 是镜像非第三权威」的既定形态，与 #369 `canonicalOrderBy` 同族） |
| 新 fixture / 新测试家族？ | #369 fixture 家族 | 独立新文件（设计明选） | 无漂移：#369 家族零改动零改红 |

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/namespace-runtime/src/window-read.ts`（M） | §7 ALLOW ①②③④ | 唯一生产落点 | 吻合：入口分支/`seamWhereNotImplemented` 删除、五键白名单、`canonicalWhere` 三函数、ok 分支携 `n`、S6 双语义、头注/类型注释同步——四项全部在场，无越权改形 |
| `packages/namespace-runtime/src/runtime.ts`（M） | §7 ALLOW ②（仅注释、可选） | 注释同步 | 吻合：diff 逐行为 doc 注释（L675–683），行为零改动 |
| `AGENTS.md`（M） | §7 ALLOW | A6/M5 | 吻合（签名 + 双语义限定） |
| `.agents/skills/nomicore/typed-access.md`（M） | §7 ALLOW | `F-383-S2-1` ① | 吻合（词表/✂/计数/失败处置/L170 从句） |
| `docs/integration/cordis-plugin-hosting.md`（M） | §7 ALLOW | `F-383-S2-1` ① | 吻合（三处注释/样张标注） |
| `.agents/skills/nomicore/SKILL.md`（M） | §7 ALLOW | `F-383-S2-1` ③ | 吻合（短语级 gloss，无截断语义） |
| 5 × `issue-383-*` 测试/fixture（新增） | §7 ALLOW（SA6 P1–P5 同名路径） | 红灯契约与类型边界 | 吻合（路径逐一对应） |

DENY 面实测（`git diff --stat` / `git status`）：`packages/doc-runtime/src/**` 空、`packages/namespace-registry/src/**` 空、`packages/namespace-runtime/src/index.ts` 空、`CONTEXT.md`/`docs/adr/**` 空、`docs/integration/app-data-access-skill.md` 空、既有 #369/#382 测试与 fixture 及守卫测试零改动、配置文件零改动。**无超范围改动。**

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| 窗口成功成员 `truncated` 语义加宽（where 读从响亮失败 → 成功 + 装满判定） | 生产唯一调用方 `lease.ts`（透传）；其余为测试 | raw 直传原样返回，零包装；调用方影响 = 纯加法（先前失败的输入现成功），无 where 路径逐字节不变 | 无 | —— |
| `composeArrayWindowRead/composeMapWindowRead` 签名（`total: number \| undefined`） | `runtime.ts` 唯一消费方 | 签名零变化（#381 已加宽）；`windowResult.total` 直通 | 无 | —— |
| W1 面（`window.ts` 三键结算/判据） | doc-runtime 消费方 | 零 diff（F9） | 无 | —— |
| 文档读者（简报点名的截断信号消费方） | `typed-access.md`/`cordis-plugin-hosting.md`/根 `AGENTS.md` 读者 | 三处无条件 `kept < total` 陈述全部补 where 限定；L170 完备性张力以从句收编；`SKILL.md` 能力发现面补提及 | 低 | —— |
| 类型面（options 单源别名链 / Equal 锁） | TS 调用方 | 零类型改动；两个 test-d 锁边界（14 条负例真命中 + Y5 事实） | 无 | —— |

## 8. 错误、恢复与并发

- **失败语义零漂移**：三稳定码 + `PATH_NOT_ALLOWED` 透传 + `RUNTIME_READ_DISABLED` 停接纳 + `NAMESPACE_LEASE_RELEASED` 三键——全部构造器未动（`windowFailure`/`seamWindowOptionsInvalid`/`readDisabled`/`RELEASED_ISSUE`）；失败 own 键集 `{code,ok,path,message}` 由 `expectWindowFailure` 逐用例断言。
- **零外抛**：S3 镜像全程 descriptor 读 + 双层 try 收编；`canonicalWhereTerm` 的 W-7 前置检查在 try 外但无抛点（与 W1 同构）；Z1–Z6/S1b 以 `capture()` 显式断言 `escaped === undefined`。
- **无静默通道**：S3/W1 判据分歧必落两出口之一（Z7 出口①透传 / Z8 出口②终态）；双合法视图值漂移（canonical n 取 S3 视图）为 #369 已接受暴露类，Z 组头注文档化（SA2 观察 3 处置正确），且为纯读路径——无数据损坏通道。
- **并发/幂等**：纯同步读、零状态、零缓存、零订阅；A6 幂等用例（同参两次 `toStrictEqual`）。
- **无部分完成**：F4 断言失败面无 `value/schema/truncated` 键（无半窗）。

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| `issue-383-window-where-composition-red.test.ts`（54 用例：A5/T9/X6/K4/D4/Z12/S4/F5/C2/N3） | A/T/X/K/D/Z/S/F/C 全组：双语义边界（装满/扫完/恰 n——T4/S2）、✂ 字节锚（X1–X3 与对照字节相等、X6 无 where 锚）、恒四键、身份回环、毒埋零重物化、敌意零 `[[Get]]` 零外抛、两出口、单源判据（S1 交替视图）、失败码冻结、停接纳 | `vitest run --typecheck`（include 匹配，自动采集）；实现前红 38/68 → 后绿 70/70（SA3 `/tmp/sa3-383-red.out`） | T4 用集合等价对账（排序后比较）而非精确序——序语义已由 A1/A2/K5/T12 承载，AC2 核心（truncated）仍精确 | MINOR（观察 1） |
| `issue-383-lease-where-contract-red.test.ts`（16 用例） | L1–L6 + T11/X8/D3/C4/M1：lease ≡ 同 doc 直调 runtime（`toStrictEqual`）、released 短路零 options 触达、lease 零解释（accessor 计数 0）、十五/十四键冻结、readData 冻结、值导出面零新增、#382 条件不变式承接 | 同上（同 run 绿） | 多数用例 `lease.release()` 后未 `registry.shutdown()`（#369 lease 先例同款；test scheduler + manual clock 无真实定时器） | MINOR（观察 2） |
| `issue-383-window-where-type-guard.test-d.ts`（3 it + 9 Equal 锁） | Y1/Y2/Y3/Y6：14 条 `@ts-expect-error` 真命中（含 readData where / 第二参必填）、Y3 三项注册为运行时用例（Z6b 在场）、成功成员 keyof 恰四键、失败码恰四枚 | `vitest --typecheck`（typecheck.include 匹配；`tsc -p tsconfig.typecheck.json` exit 0） | 无 | —— |
| `issue-383-lease-where-type-guard.test-d.ts`（3 it + 10 Equal 锁） | Y1/Y4/Y5：lease↔runtime 别名 Equal 锁、签名形状、Y5 双侧 TS2694 锁定 | 同上 | 无 | —— |
| `issue-383-filtered-window-fixture.ts`（非测试文件） | FIX-383-A 数据面（dirty/nullState/badHit/poisonScored/rawHidden 全在场）；确定性（manualClock/deterministicRandomBytes/零随机） | 不收集（非 `.test.ts`）；被两测试引用 | 无 | —— |

测试纪律核验：零 skip/only/todo/env override（grep 实测）；零源码字符串断言（message 子串断言仅用于区分出口①/②，见观察 3）；期望由独立预言机派生（Yjs 原生直数 `claimedKeys`/`claimedIndexes`/`nativeMap`、同运行公共面 `readData` oracle、字节锚常量 `factsLine`）；成功形状经 `expectReadDataOkKeys` 集中化（收敛门作用域含两测试树，SA3 实跑 46 用例绿）；红绿诚实（SA3 实现前 38 failed 实证红因 = 缝 2 缺口；F1/F2/F4 HEAD 颜色实测回填为预绿守卫，与设计 §12 预测一致）；SA6 契约 A3/A4 两处内部不一致按「fixture 事实 + 独立预言机」落地并登记（`taskList` total=3、`scalarList` 非空拆分等价断言）——无断言弱化、无验收语义漂移。

## 10. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| SA3 自报的运行证据（70/70、199 家族、tsc/typecheck/test 全绿）需独立复跑确认 | Controller 指派的动态验证角色（SA7/验收） | 聚焦 6 文件 + `pnpm typecheck` + `pnpm test` 全绿；新 4 文件被真实采集（400 files / 4903 tests 口径） | 任一红/文件数不符 |
| S1 交替视图（视图②隐藏 where）运行时行为 | 同上 | `ok:true`、value=[t1,t3]、truncated=true、无 ✂、viewCount=2 | 实现改判「视图不稳定」拒绝（须回门禁，SA6 §15-O4） |
| 规模用例时序（bigTasks/poisonScored 各 2000 条 × heavy 装载） | 同上 | 秒级完成、无超时 | 慢到拖垮 maxWorkers:1 的全仓 run |
| close/release 期读的时序稳定性（C2 在 close promise 在途时读） | 同上 | 稳定 `RUNTIME_READ_DISABLED`（closing/closed 同形） | 间歇性出现 ready 期结果（竞态） |

## 11. Non-blocking observations

1. **T4 精确序断言弱化（MINOR）**：`exactTasks` 用例以排序后集合等价对账（`[...keys].sort()` vs `[...oracle].sort()`），未断言键面码点序的精确呈现序。理由注释在场（键插入序 vs 码点序），序语义由 A1/A2（t1..t5 码点序精确）与 K5/T12（field 基总序精确）覆盖；AC2 的承重断言（kept 5 === n 5 → truncated true）保持精确。不阻断。
2. **lease 测试清理不对称（MINOR）**：新 lease 用例多数只 `lease.release()` 不 `registry.shutdown()`（D3/L2/L3/Z 镜像/M1 有 shutdown，L1/L4-L6/N2/AC1 负控无）。与 #369 lease 契约先例同款（release-only），且 test scheduler + manual clock 下无真实定时器/后台任务；#382 先例的 `withLease` try/finally 更严。后续测试家族可考虑统一 adopt try/finally 形态。不影响本票验收。
3. **Z8/S1b 的 message 子串断言（MINOR）**：`toContain('视图不稳定')` 锚定 `seamWindowOptionsInvalid` 的 message 文本。message 为非契约字段（SA6 §15-O2），未来措辞改写会假红这两条（假红优于假绿，方向安全）；出口归属的结构判别（视图③合法 ⟹ 唯一失败来源是出口②）本身不依赖 message。不阻断。

## 12. Required revisions

无。无 BLOCKER / MAJOR finding。

## 13. 结论

实现忠实落实批准设计（iteration 1）与 SA6 验收契约：S6 双语义 + ✂ 结构性永不装配 + S3 五键判据镜像（与 W1 逐判据零漂移，本审查独立逐行比对）+ registry/doc-runtime/index 零 diff + 四文档对齐（grep 门通过、零行为发明）+ 文件范围与 ALLOW/DENY 完全一致 + 测试先例真实可触发、断言独立预言机派生、红绿诚实。SA3 登记的三处 SA6 契约内部不一致处置（A3/A4/F1-F2-F4）均以 fixture 事实与独立预言机落地、无弱化。`requiresConflictRecheck`：本审查未发现新的 ADR 冲突风险（SA8 implementation 复查已 `clear` 且 `requiresConflictRecheck: false`；本审查独立复核其关键闭合项成立）。

**Verdict：`approve`**（3 条 MINOR 观察见 §11，不阻断）。
