# SA9 Standards Review — Issue #337（T4：DeepOptional 预算读类型面）

> SA9（独立 Standards 审查者），iteration 0。被审对象：worktree
> `/home/wangjian/nomicore-fix-issue-337` 上**最终已提交**的 Issue #337 diff——commit
> `7654f85ecd14e11c9abb60b4ed3c6fbf69bcd9ba`「feat(protocol): add budgeted read type surface」
> （权威基线 `cb8aaff0297a802432ba7532a407c65218852dce` = 本 commit 之父，`git rev-parse` 实核；
> 2 源文件修改 + 2 新 test-d 文件 + 8 wiki 过程产物）。审查面**仅限**仓库/工程标准：
> AGENTS、ADR 条款、模块责任、既有架构惯例、单一事实源、生命周期对称性、文件范围与
> 测试质量。Issue 需求完整性属 SA10 面，不在本报告裁决。Issue #337 REST comments 经
> Host 刷新为空——**无 Owner 评论要求适用**。本迭代全部关键结论均经本人对最终 diff、
> 源码、母法文本与落盘证据日志亲自核对（非仅转述上游 SA 产物）；按角色边界零运行
> （无 tsc/vitest/服务/临时进程），运行级证据核对落盘日志。

## Inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-337.md`（任务简报；Issue 正文同源；Comments 空段） | 已读 |
| `wiki/raw/task_issue-337_sa6_contract.md`（SA6 approve；§12.1–12.6 断言组/文件清单/红灯机制/变异矩阵/验证门） | 已读相关节 |
| `wiki/raw/task_issue-337_conflict_report.md`（SA8 前置门禁 clear；§8 行动 1–4；§10 recheck=true） | 已读全文 |
| `wiki/raw/task_issue-337_relevant_decisions.md`（ADR 0024/0004/0005/0016/0008/0009/0003 条款行号摘录） | 已读全文 |
| `wiki/raw/task_issue-337_design.md`（SA1 iteration 0；§7 D-1–D-7 pin / §11 ALLOW-DENY / §12 验收规格 / §13 风险） | 已读全文 |
| `wiki/raw/task_issue-337_design_conflict_report.md`（SA8 设计后复审 clear；24 项对照；§8 实现期核对清单） | 已读全文 |
| `wiki/raw/task_issue-337_sa2_review.md`（SA2 approve；§14 N1–N5 非阻断观察） | 已读全文 |
| `wiki/raw/task_issue-337_sa3_impl.md`（SA3 iteration 1 实现报告 + 红/绿/变异验证表） | 已读全文 |
| `wiki/raw/task_issue-337_sa4_review.md`（SA4 approve；§12 O1–O4 非阻断观察） | 已读全文 |
| 最终 diff 亲核 | `git diff cb8aaff..7654f85` 全量 hunk：`packages/vfsl-protocol/src/index.ts`（+52/−1）、`packages/vfsl-codegen/src/protocol-surface.ts`（+5/−1）、两新 test-d 全文（175+233 行）逐行读；范围外路径 diff 实测 **0 行**（runtime/registry/doc-runtime/vfsl/domains/docs/apps/CONTEXT/lockfile） |
| 母法亲读 | `docs/adr/0024-readdata-shape-budget.md` L80–137（决策 6/7、修订节、备选、验收）、`docs/adr/0004-vfsl-protocol-type-projection.md` 全文（D1–D5）、`CONTEXT.md` L38–55（形状预算/截断词条）、根 `AGENTS.md`、`packages/vfsl-protocol/AGENTS.md`、`packages/vfsl-codegen/AGENTS.md`、`docs/AGENTS.md` |
| 现状源码亲核 | `index.ts` 全文（207 行终态）、`protocol-surface.ts` 头注与名单、`packages/doc-runtime/src/read.ts` L70–82（`ReadLogicalValueAtPathOptions` 单源）、`packages/vfsl-protocol/package.json`（无 dependencies 段）、`packages/vfsl-codegen/src/emitter.ts` L24/L144（`PROTOCOL_EXPORT_NAMES.has` 碰撞判据）、`generate-alias-collision-guard.test.ts` L65–80（实测枚举驱动、无硬编码计数）、`vitest.config.ts` L18–21、`tsconfig.typecheck.json`、`packages/vfsl-protocol/tsconfig.json` |
| 独立 grep | `DeepOptional` 全仓命中恰在协议包 src+两新测试+codegen 名单（无第二出口再导出）；`readBudgeted` 除 `packages/vfsl-protocol` 外零命中；`keyof VfslTypedAccess` 全仓零命中（无方法集穷尽锚）；两新测试零 `skip/only/todo/@ts-ignore/@ts-nocheck/as any` |
| 落盘证据核对 | `artifacts/sa3-issue337-{red-package-tsc,red-contract,package-tsc,targeted-vitest,root-typecheck-generate,root-test,export-surface,mutation-sensitivity,final-state}.log`、`artifacts/sa6-issue337-*.log`；sha256 独立复验 `index.ts`=`0d55884f…c47b6` 与 SA3 L46/SA4 §1 逐字一致——**交付 commit 内容 = SA3/SA4 已审内容** |

## Verdict

**approve** —— 最终已提交 diff 全面符合仓库与工程标准；无 BLOCKER / MAJOR。MINOR 观测
（均不阻断）见 §8。

---

## 1. 仓库 AGENTS 与模块契约

| 标准 | 证据 | 判定 |
|---|---|---|
| 根 AGENTS「改 packages/ 前读最近嵌套 AGENTS 并守其边界」 | 本审查对两模块 AGENTS 逐条对账（下行起）；SA1 §2 B 锚、SA6 §4 均已锚定 | ✅ |
| vfsl-protocol AGENTS「Keep the emitted JavaScript surface empty: type declarations and type exports only」 | 新增面 = `export type DeepOptional<T>`（type-only）+ 接口方法签名 `readBudgeted`（类型空间产物）；`index.ts` 终态全文无任何值导出新增；空模块锚 `vfsl-protocol-empty-module.test.ts` 零改动且 root 门绿（root-test log：352 files/3880 tests、Type Errors: no errors） | ✅ |
| vfsl-protocol AGENTS「Preserve fail-closed path resolution……union-member-only fields retain `undefined`」 | `readBudgeted` 复用既有 `FailClosedRest`（未重造）：未知字面量路径 → rest 缺参 TS2554（文件 2 G3.6 锚 + `read`/`kindOf` rest 门回归锚）；索引签名值位 `DeepOptional<E> \| undefined` 与 D2「成员独有字段 read → `T \| undefined`」同源口径（doc-comment L88–90 明文） | ✅ |
| vfsl-protocol AGENTS「Treat `PathSchema`/`PathAt`/value·kind projections/`VfslTypedAccess`/`VfslPathMap` as public compatibility contracts」 | 纯加法：既有 12 名导出与 `VfslTypedAccess` 既有六方法签名零 diff（diff 亲核 −1 行仅为接口头注计数注释）；文件 2 G2.3 组显式回归锚六方法语义；`keyof VfslTypedAccess` 全仓零命中（本审查 grep 复核 SA2 §9 结论）——接口加法无在库穷尽锚可破 | ✅ |
| vfsl-protocol AGENTS「Avoid importing runtime packages or domain-specific types」 | options 为内联封闭形状 `{ depth?: number; maxChildrenPerNode?: number }`，未 import doc-runtime；`package.json` 无 `dependencies` 段（亲读）、零改动 | ✅ |
| vfsl-protocol AGENTS「Validate behavior with both positive and negative `.test-d.ts` cases」 | 两新 test-d 恰为正（`expectTypeOf(...).toEqualTypeOf<手写 oracle>`/赋值正例）+ 负（`@ts-expect-error` 自反转）双装置，落既有 `packages/vfsl-protocol/test/` 入口 | ✅ |
| vfsl-protocol AGENTS 验证门（包 typecheck + 协议类型测试；导出类型变更 → root `pnpm typecheck`） | SA3 落盘：两包 tsc exit 0（package-tsc.log）、root typecheck 14 project exit 0（root-typecheck-generate.log）、四包 targeted vitest --typecheck 109/1018 绿（targeted-vitest.log）、root test 352/3880 绿（root-test.log）——命令与模块门逐字对应 | ✅ |
| vfsl-codegen AGENTS「deterministic and byte-stable；`generate --check` 检测一切漂移」 | `pnpm generate --check` exit 0（root-typecheck-generate.log）；`PROTOCOL_IMPORT_LINE` 与发射器输出规格零 diff（diff 亲核 codegen 面唯一改动 = 名单文件） | ✅ |
| vfsl-codegen AGENTS「emitted types or protocol wiring change → root `pnpm typecheck` and `pnpm test`」 | `PROTOCOL_EXPORT_NAMES` 跟名属 protocol wiring；root typecheck/test 均已跑绿（同上日志） | ✅ |
| vfsl-codegen AGENTS「export-name collisions fail loudly with stable diagnostics」 | 名单跟名后 `DeepOptional` 作领域别名从静默 NO-THROW 转为必抛 `alias-protocol-export-collision`（export-surface.log：`alias<DeepOptional> -> THROW`、`guardSilent=[]`）——fail-closed 方向加严，非软化 | ✅ |
| docs/AGENTS「wiki/raw 为证据非规范契约；修订 ADR 须显式」 | 本票零 `docs/**`、零 `CONTEXT.md` 改动（diff 亲核 0 行）；词条「形状预算」L45–47 已含 `DeepOptional<PathAt<…>>` 口径与 Avoid 项（亲读），无静默矛盾 | ✅ |

## 2. ADR 条款符合性（架构契约）

| ADR 条款 | 实现落点 | 判定 |
|---|---|---|
| 0024 决策 7 L91（无 options 保持 `PathAt` 完整子树承诺，编译期权威不降级） | 以最稳形态成立 = **零 diff**：runtime/lease/`VfslTypedAccess.read`/yjs-server 全部零触碰（范围外 diff 实测 0 行）；文件 2 G3.2 差分锁：`read(['box'])` 仍 Equal 完整形 `{n: number}`、完整→预算单向可赋、反向 `@ts-expect-error`——可选化无泄漏 | ✅ |
| 0024 决策 7 L92（带 options → `DeepOptional`；通用递归映射；**与 `PathAt` 并列进协议类型面**；**零 per-schema 生成**） | 第 13 名导出 `DeepOptional` 落在 `index.ts` `PathValue` 之后、`PathKind` 之前，只从 `@nomicore/vfsl-protocol` 出口（grep 全仓无第二出口）；`domains/**`、生成器输出规格零改动、`generate --check` 零漂移；记法桥接（`DeepOptional<PathAt<…>>` ≡ `DeepOptional<PathValue<PathAt<…>>>`）在 doc-comment 显式声明（L79–85），与 SA8 设计后复审「消歧非改约」裁决一致 | ✅ |
| 0024 决策 7 L94（判别字段**不豁免**；narrowing 由 type-level 测试锚定；退路由 test-d 红灯触发、不预防性承诺） | 实现经联合逐成员分发天然不豁免；G1.5 Equal 锚 `{kind?: 'image'; url?: string} \| {kind?: 'text'; body?: string}`；G4 双文件 if/switch 窄化锚：成员独有字段访问行无 expect-error（无 TS2339）、`const exact: string = v.url` expect-error（TS2322，`T \| undefined`）——退路**未触发且未预防性启用**，票内无豁免记录 | ✅ |
| 0024 决策 7 L95（预算读非写前完整快照） | `DeepOptional` 与 `readBudgeted` doc-comment 双载警示；文件 2 根路径锚反向赋值负例断言「预算形不可赋给完整根值」 | ✅ |
| 0024 L113 备选否决（预算读静态 `unknown` 被否） | 未采用 unknown——`readBudgeted` 返回 `DeepOptional<PathValue<PathAt<…>>>`，保结构感知与在场标量精确 | ✅ |
| 0024 验收 L127/L130（类型面行 + 影响包全套门禁 + root typecheck/test） | §12.6 六道门全跑（含步 0 红灯重捕获前置），日志数字自洽（基线 107/979 → +2 files/+39 tests = 109/1018；root 350/3841 → 352/3880，恰为两新文件 19+20 tests） | ✅ |
| 0004 D3（纯类型+接口、编译后空模块、零依赖、fail-closed；空表 fail-closed） | 见 §1 第 2/3/5 行——形态约束全保持；空 `VfslPathMap` 语义零触碰 | ✅ |
| 0004 D2（成员独有字段 read → `T \| undefined`；整值读发射判别联合吃 tsc 原生窄化） | 索引签名值位 `| undefined` 同源口径；判别联合逐成员映射后窄化锚定（G4） | ✅ |
| 0004 D4（正例 expectTypeOf、负例 @ts-expect-error 自反转） | 全套遵守并叠加设计 D-5「相等+赋值双向」判据（E7 Equal 盲点对策：EOPT 负例 `{a: undefined}` TS2375）；负例全部被 root 门 0 type errors 证明为真错误（无 TS2578） | ✅ |
| 0004 D5（路径无 ROOT 前缀；`PathAt` 含 `[]` 分支） | 文件 2 根路径锚 `readBudgeted([], {depth:1})` → 全表递归可选形（`{}` 正例 + 自有键 `string \| undefined` 锚） | ✅ |
| 0005（生成管线纪律；生成物入仓 + 新鲜度） | 零 per-schema 生成兑现；`generate --check` exit 0 | ✅ |
| 0008/0009/0016（读域运行时语义 / lease 代理语义 / always-on 与 typed-access 加法兼容） | 纯类型票零运行时变更：runtime/registry/lease Equal 锁（`_readAlias`/`_readBudgetAlias`/`_readOverloadOrder`）与「legacy 恒为最后」重载序零 diff；结果形状/schema 通道不触 | ✅ |
| 0003 L46（ValueSchema 9-kind 冻结面） | `DeepOptional` 是 TS 映射类型，非 ValueSchema 成员；`packages/vfsl/**` 零 diff | ✅ |

## 3. 单一事实源

| 事实 | 单源 | 派生方式 | 判定 |
|---|---|---|---|
| 协议导出面 | `index.ts` 实测导出（守卫测试经 checker `getExportsOfModule` 实测枚举驱动，非手抄） | `PROTOCOL_EXPORT_NAMES` 同变更集跟名（13 名，排 `'PathValue'` 后 = 声明序）；export-surface.log：actual 13 = frozen 13、actual-only/frozen-only 皆 `[]`——守卫自动对账，增名不跟即红（SA6 P5 因果成立） | ✅ |
| 读值类型剥壳 | `PathValue`/`VfslValueOf`（index.ts L62–72） | `DeepOptional` 只定义在**读值域**、复用单一剥壳权威；载体感知第二套剥壳未创建；G1.6 负例锚定载体直套产壳不可当值用 | ✅ |
| 预算 options 形状 | doc-runtime `ReadLogicalValueAtPathOptions`（read.ts L74–77，亲读 `{depth?; maxChildrenPerNode?}`） | 协议侧内联字面双站（ADR-0004 D3 禁 import 运行时包所致，设计 R-4 如实登记）；本审查逐字段比对**一致**；漂移哨兵 = T3 `_optionsAlias` Equal 锁 + 本票 TS2353 形状外键负例——响亮非静默；跨包单源合并显式归后续演进 | ✅（残余 LOW 已登记） |
| ADR/CONTEXT 记法 `DeepOptional<PathAt<…>>` | 决策文本（0024 L92 / CONTEXT L46，零改动） | 协议 doc-comment 桥接声明承载展开口径；T5 #338 文档同步沿用同口径（谱系完整，无悬空） | ✅ |

## 4. 模块责任与既有架构惯例

| 检查面 | 结论 | 判定 |
|---|---|---|
| 责任归属 | 预算读静态类型契约归 `@nomicore/vfsl-protocol`（typed 访问契约 Owner，ADR-0004 D3）；运行时语义/校验仍归 doc-runtime/runtime（T1–T3 既有，零触碰）；导出面事实与碰撞名单归 codegen `protocol-surface.ts` 单一数据源（该文件头注「名单更新只改本文件一处」被逐字遵守：单文件单处 + 头注如实追加 T4 注记、2026-08-21 基点描述原地保留不静默改写） | ✅ |
| 相似能力对照 | 递归类型映射复用 `VfslValueOf` 同款惰性条件递归形态；`readBudgeted` 逐要素镜像 `read`/`patch` 签名惯例（`const P` + `NoInfer<P>` + rest 门）；fail-closed 复用 `FailClosedRest` 非重造；test-d 装置 = ADR-0004 D4 先例；类型锁惯例 = 既有 Equal 锁族同型 | ✅ |
| 平行机制 | 无第二套载体剥壳、无第二份 options 校验（协议侧仅类型形状、零校验零解释）、无第二测试入口（两文件落 `packages/vfsl-protocol/test/*.test-d.ts` 既有 glob）、无平行读路径 | ✅ |
| 落点惯例 | 落点 = `VfslTypedAccess` 第 7 方法（`read` 后、`kindOf` 前）——SA6 G3.6 预声明备选分支、SA8 前置门禁 §8.2 裁定的设计自由内选择；runtime/lease 泛型化被五点证据链否决（架构耦合/发布面/stub 编译锁脆弱面/契约自洽/改动面），非便利性取舍 | ✅ |

## 5. 生命周期对称性

纯类型面（零运行时、零注册/订阅/后台任务、零 wire/持久化）——对称性条款不适用。准生命周期项
两项均对称闭合：① 实现序「测试先红 → 实现转绿 → 全门禁」按设计 §11 执行并有红灯重捕获证据
（red-contract.log：HEAD 源下两新文件红、同目录既有 3 文件同跑全绿，归因 = TS2305/TS2339 能力缺失
本身，非环境/fixture/入口错）；② 变异实验「改动—验证—逐字节复原」对称（sha256sum -c 两次 OK；
本审查独立复验当前 `index.ts` 哈希与 SA3/SA4 记录逐字一致）。回滚面 = revert 两源 + 删两测试，
无状态/无 lockfile/无迁移（diff 闭合亲核）。

## 6. 文件范围

| 项 | 实测 | 判定 |
|---|---|---|
| 交付 diff 面 | `git diff cb8aaff..7654f85 --stat`：恰 2 源文件（`index.ts` +52/−1、`protocol-surface.ts` +5/−1）+ 2 新 test-d（175+233 行）+ 8 wiki 过程产物——与设计 §11 ALLOW 行 1–4 逐条对应 | ✅ |
| DENY 遵守 | 范围外路径 diff 实测 **0 行**：`namespace-runtime/**`、`namespace-registry/**`、`doc-runtime/**`、`vfsl/**`、`domains/**`、`docs/**`、`CONTEXT.md`、`apps/**`、`pnpm-lock.yaml`、既有测试、`packages/vfsl-protocol/package.json` | ✅ |
| −1 行说明 | `index.ts` −1 行 = 接口头注计数「六个→七个类型严格方法」准确性维护（同一 ALLOW 文件内纯注释、零语义；SA3 §8 已申报、SA4 O2 已裁接受）；`protocol-surface.ts` −1 行 = 名单行换行重排（12→13 名同集） | ✅ |
| wiki/artifacts 惯例 | 8 wiki 过程产物随票入仓与 #336/#335 等前票 commit 模式一致；`artifacts/*.log` 为未跟踪工作树证据（与前票惯例一致）；`.scratch/` 仅剩他票既有 `vfsl-v1-parser/`，本票探针已清理 | ✅ |

## 7. 测试质量

| 标准 | 实测 | 判定 |
|---|---|---|
| 真实 runner 入口 | 两文件命中 `vitest.config.ts` typecheck.include glob ∩ `tsconfig.typecheck.json`（`packages/*/test/**`）∩ 协议包 tsconfig（含 `test/**`，包 tsc 门同覆盖）；targeted/root 运行日志均实收两文件（19+20 tests） | ✅ |
| 断言观察行为非文本 | 全部断言为类型投影行为（Equal 手写独立 oracle + 调用点 `typeof <调用表达式>` 取型 + 赋值双向）；零源码字符串断言（亲读两文件全文）；oracle 不引用被测类型自证（文件 2 `RootValue` 独立手写表） | ✅ |
| 负例自反转 | 15 条 `@ts-expect-error`（文件 1 ×5：L57/64/141/154/166；文件 2 ×10）全部为真错误——root 门 0 type errors 反证无 TS2578；红灯态 TS2578 ×10 级联恰落在依赖新能力的负例上（red-contract.log），自反转机制真实可触发 | ✅ |
| 无弱化 | grep 零 `skip/only/todo/@ts-ignore/@ts-nocheck/as any`（exit 1 无命中）；无 env override/fallback/吞错 | ✅ |
| 红灯归因正确 | TS2305（`DeepOptional` 导入）+ TS2339（`readBudgeted` ×13）+ 级联 TS2578；同目录既有 3 文件（含 20 条既有 `@ts-expect-error`）同跑全绿；`--passWithNoTests=false` 防静默假绿 | ✅ |
| 变异敏感 | D2（非 EOPT → 恰 1 错 = EOPT 负例 TS2578）/D3（浅层不递归 → 30 错）/D4（数组元素多余 `\| undefined` → 6 错）实跑命中设计判据；每次复原 sha256 OK | ✅ |
| 既有负向锚 | 既有 4 test-d 49 条 `@ts-expect-error`、守卫、empty-module、runtime/registry T3 系、vfs3-assets 锚全部零 diff；root 352/3880 绿证明仍红/仍绿各在其位 | ✅ |
| 程序级隔离 | 两文件用本地 `MiniMap`/`LocalMap`/`RootValue` 表，零 `declare module` 增广（B9 隔离先例）；顶层键与既有增广键清单零碰撞 | ✅ |

## 8. 评审链一致性与 MINOR 观测

上游链：SA8 前置门禁 clear → SA8 设计后复审 clear → SA2 approve（无 BLOCKER/MAJOR）→
SA3 实现（iteration 1 原位复核 + 红灯重捕获）→ SA4 approve（无 BLOCKER/MAJOR）。SA2 N1–N5
全部落实（N4 已采纳落盘；N1/N2/N3 记录义务完成；N5 遵守）；SA4 O1–O4 均不阻断。本审查独立
复核了落点事实、名单机制、剥壳单源、options 双站字段一致性、范围外零 diff、哈希一致性与
全部日志数字，与上游结论无冲突输入。

**MINOR（不阻断 approve）**：

1. **提交信息未按系列惯例引用票号**（信息性）：交付 commit 题「feat(protocol): add budgeted read
   type surface」未含 `#337`，与 T0–T3 系列 `fix(#NNN): [shape-budget] TN: …` 题式不一致；仓库无
   明文 commit 题式规范（无 CONTRIBUTING.md；历史亦见 `docs(skill):` 等多式），且最终 PR 题面
   历来由 Host 合入流承载。建议 Host 建 PR 时按系列题式命名。不影响代码与测试本体。
2. **SA3 报告断言计数笔误**（SA4 O1 已裁，转录备查）：报告称新增「18 条（7+11）」
   `@ts-expect-error`，实际指令 15 条（5+10）——报告工件笔误，实现/测试/红灯归因无任何影响。
3. **流程待办提示（非缺陷）**：SA8 两份报告 `requiresConflictRecheck=true` 的实现后复查
   （implementation conflict report）与 SA7 活链路验证按既定管线尚在后序；本审查对其实现期
   核对清单逐项预核（名单成对 13=13、runtime/registry 零 diff、既有名/方法零语义改动、负锚
   保持、empty-module/依赖/生成物零漂移、doc-comment 桥接在位、红灯纪律执行）未发现冲突
   输入，该后序步骤不构成本次 approve 的阻塞。

## 9. 结论

最终已提交 diff 在仓库 AGENTS（根 + vfsl-protocol + vfsl-codegen + docs）、ADR-0024 决策 7 与
ADR-0004/0005/0008/0009/0016/0003 条款、模块责任、既有架构惯例、单一事实源、生命周期对称性、
文件范围与测试质量八个审查面上全部符合标准；无 BLOCKER、无 MAJOR；3 条 MINOR 观测均不阻断。

**Verdict：approve**
