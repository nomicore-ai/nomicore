# SA4 实现静态审查 — Issue #337 `[shape-budget] T4: DeepOptional 预算读类型面`

- 派发：`sa-cd9e5cee-00af-4df4-bc13-0a1c49a63b07`（role `mabf-sa4`，phase `implementation-review`，iteration 0）
- Worktree：`/home/wangjian/nomicore-fix-issue-337`（branch `mabf/issue-337`，基线 HEAD `cb8aaff0297a802432ba7532a407c65218852dce`）
- 审查对象：SA3 实现报告（iteration 1 重试派发，`wiki/raw/task_issue-337_sa3_impl.md`）+ 当前 worktree 的实际 diff 与测试
- 纪律声明：SA4 零运行（无 tsc/vitest/服务/临时进程/临时文件），全部结论基于源码静态阅读、既有落盘证据日志（`artifacts/sa3-issue337-*.log`）交叉核对与独立 sha256 复验。

## 1. Reviewed inputs

| 输入 | 路径 | 状态 |
|---|---|---|
| 任务简报 | `wiki/raw/task_issue-337.md` | 已读；AC1–AC4；Comments 为空（REST 刷新，无 Owner 要求） |
| SA6 契约 | `wiki/raw/task_issue-337_sa6_contract.md` | 已读全文（382 行；§12.2 G0–G5 断言组、§12.3 文件清单、§12.4 红灯机制、§12.5 变异矩阵、§12.6 验证门） |
| SA1 设计 | `wiki/raw/task_issue-337_design.md` | 已读全文（§7 D-1–D-7 pin、§11 ALLOW/DENY、§12.2 断言规格、§12.3 门禁） |
| SA2 设计评审 | `wiki/raw/task_issue-337_sa2_review.md` | 已读（approve；§14 N1–N5 非阻断观察） |
| SA8 前置门禁 | `wiki/raw/task_issue-337_conflict_report.md` | 已读（clear；§8 行动 1–4；§10 recheck=true） |
| SA8 设计后复审 | `wiki/raw/task_issue-337_design_conflict_report.md` | 已读（clear；§8 实现期核对清单） |
| 决议摘录 | `wiki/raw/task_issue-337_relevant_decisions.md` | 已读（ADR-0024 决策 7 / ADR-0004 D2–D5 / ADR-0005 等） |
| SA3 实现报告 | `wiki/raw/task_issue-337_sa3_impl.md` | 已读全文（iteration 1 重试复核 + 红灯重捕获） |
| 生产 diff | `git diff`（`packages/vfsl-protocol/src/index.ts` +52/−1、`packages/vfsl-codegen/src/protocol-surface.ts` +5/−1） | 逐行审查（见 §4/§6） |
| 新测试 | `packages/vfsl-protocol/test/vfsl-protocol-deep-optional.test-d.ts`（175 行 / 19 tests）、`packages/vfsl-protocol/test/vfsl-protocol-budget-access.test-d.ts`（233 行 / 20 tests） | 全文逐行审查（见 §9） |
| 既有测试与锚 | protocol 3 个 test-d、`generate-alias-collision-guard.test.ts` + `tsc-helper.ts`、`vfsl-protocol-empty-module.test.ts`、runtime/registry T3 系（`git status` 零改动实证） | 已读相关段 |
| 配置 | `vitest.config.ts`、`tsconfig.typecheck.json`、`tsconfig.base.json`、`packages/vfsl-protocol/{package.json,tsconfig.json}`、root `package.json` | 已读（发现入口实证） |
| SA3 证据日志 | `artifacts/sa3-issue337-{red-package-tsc,red-contract,package-tsc,targeted-vitest,root-test,root-typecheck-generate,export-surface,mutation-sensitivity,final-state}.log` | 全部交叉核对（数字逐项对账） |
| 独立复验 | `sha256sum index.ts` = `0d55884f…c47b6`（与 SA3 报告 L46 逐字一致）；`sha256sum protocol-surface.ts` 在案 | 通过 |

## 2. Verdict

**approve** —— 无 BLOCKER、无 MAJOR。

实现与设计/契约逐字一致：`DeepOptional` 三分支形态 = 设计 §7 D-1 字面（含放置位 `PathValue` 后、`PathKind` 前）；`readBudgeted` 签名 = D-2 字面（`read` 后、`kindOf` 前，`const P` + 内联封闭 options + `FailClosedRest`，返回 `DeepOptional<PathValue<PathAt<Map, NoInfer<P>>>>`）；名单跟名 = D-4（13 名 + 头注如实追加，2026-08-21 基点描述原地保留）；AC1 零降级 = D-3 零 diff（runtime/registry/doc-runtime/vfsl/domains/apps/lockfile 全零改动，`git status` 实证）。测试 39 条（19+20）逐项映射 SA6 G1/G3/G4 + G2.3 差分组，全部观察类型行为、零源码字符串断言、零 skip/only/todo；红灯重捕获（HEAD 源 + 新测试）归因正确（TS2305/TS2339 + 级联 TS2578 自反转，既有 3 文件同跑全绿）；变异 D2/D3/D4 实跑敏感且逐字节复原（sha256 两次 OK，本审查独立复验哈希一致）。4 条非阻断观察见 §12（其中 1 条为 SA3 报告的断言计数笔误，不影响实现与测试本身）。

## 3. 上游要求落实

Issue comments 为空（REST 刷新）——无 Owner 评论义务；全部义务 = Issue 正文 AC1–AC4 + ADR-0024 决策 7 + SA6 契约 + SA8 §8 行动 1–4 + SA2 N1–N5。

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| AC1 无 options 静态类型零降级 | D-3 零 diff：`git diff --stat` 仅 2 源文件（均在 ALLOW）；runtime/lease/yjs-server 零触碰；既有 T3 Equal 锁/`ReturnType` 末签名锁/typed-stub 编译锁文件零改动；root typecheck 14 project exit 0（log）；文件 2 G3.2 差分锁（`read(['box'])` 仍 Equal `{n: number}`、完整→可选单向赋值 + 反向 `@ts-expect-error`） | 落实（结构级：零改动即逐点一致；差分锚在位） |
| AC2 预算读全字段可选 / 在场标量精确 / 数组元素递归 | `DeepOptional`（index.ts L98–105）+ 文件 1 G1.2–G1.5（对象 EOPT 递归、`{}`/部分/满赋值正例、`{a: undefined}` TS2375 负例、标量/`unknown`/`T \| undefined` 原样、数组三态 + 索引签名 + readonly、判别联合不豁免）+ 文件 2 G3.1/G3.3/G3.4 六路径形态 + 根路径 | 落实（正负例齐备；变异 D2/D3/D4 实跑证明断言敏感） |
| AC3 判别字段 narrowing test-d 锚定；退路未触发不启用 | 文件 1 G4（if + switch 两形态：成员独有字段访问行无 expect-error、`const exact: string = v.url` TS2322 expect-error）+ 文件 2 G4 接缝镜像；实现无判别豁免分支；退路未启用、票内无预防性豁免记录 | 落实（TS2322 形态 = SA6 E5 实测口径；红灯日志证明 HEAD 红因 TS2339/TS2305） |
| AC4 既有负向锚保持红 + 全套包门禁 | 既有 4 test-d（6+14+21+8=49 条 `@ts-expect-error`）零改动；root test 352 files/3880 tests、Type Errors: no errors（log）；四包 targeted 109 files/1018 tests 绿；`generate --check` exit 0 | 落实 |
| SA8 §8.1 名单跟名（阻塞级） | `protocol-surface.ts` 13 名含 `'DeepOptional'`；发射器 `emitter.ts` L144 `PROTOCOL_EXPORT_NAMES.has(name)` 判碰撞；SA3 export-surface log：actual 13 = frozen 13、`alias<DeepOptional>` THROW、`guardSilent=[]`；守卫测试（实测枚举驱动）targeted 运行 4 tests 绿 | 落实（同变更集成对：两文件同 git diff 集） |
| SA8 §8.2 现行为基准与落点 | 落点 = `VfslTypedAccess.readBudgeted`（设计 D-2 pin，SA6 G3.6 预声明备选分支，SA8 设计后复审认可）；`apps/yjs-server` L609 单参动态消费方零影响（root typecheck 绿）；Equal 锁零触碰 | 落实 |
| SA8 §8.3 实现纪律 | `index.ts` 全部为 type 声明/导出（`export type DeepOptional<T>`）；`Object.keys === []` 锚（empty-module 测试）targeted 绿；`package.json` 零改动、无 `dependencies` 段（实读）；`generate --check` 零漂移；零 `docs/integration` 触碰（git status） | 落实 |
| SA8 §8.4 AC3 退路义务 | 未触发即未启用；G4.3 条件路径在设计与测试头注登记 | 落实 |
| SA2 N1（索引签名 oracle 不放宽） | 文件 1 L107–111 断言 `Rec['0']` = `string \| undefined` + 整型 Equal；文件 2 L84–88 `kw` 索引形 Equal；SA3 报告 §4 N1 行记录实测且未放宽 | 落实 |
| SA2 N2（动态路径 = TS2554 非 never） | SA3 报告 §4 N2 行按 TS2554 表述记录 | 落实（记录义务） |
| SA2 N3（options 双站字段对照） | 协议内联 `{ depth?: number; maxChildrenPerNode?: number }`（index.ts L177）× doc-runtime `ReadLogicalValueAtPathOptions`（read.ts L76–79）——本审查逐字段比对**一致**；报告 §4 N3 行记录 | 落实 |
| SA2 N4（`DeepOptional<X \| undefined>` 锚，可选加强） | 已采纳：文件 1 L83–85 | 落实 |
| SA2 N5（守卫测试头注 12 名历史引述无需更新） | 既有测试零改动（git status 实证） | 落实 |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| D-1 `DeepOptional` 精确形态（三分支：变长数组同态不加 `?` / 元组可选 / 对象全可选 / 标量原样） | `index.ts` L98–105 | 与设计 §7 D-1 代码块**逐字一致**（含行内注释）；放置位 = `PathValue`（L72）后、`PathKind`（L108）前 ✓ | 无 |
| D-1 doc-comment（ADR 引注、值域声明、记法桥接 `DeepOptional<PathAt<…>> ≡ DeepOptional<PathValue<PathAt<…>>>`、域外输入、判别不豁免、非写前快照警示） | `index.ts` L74–97 | 全部在位，措辞与设计 §8 接口变化 1 一致 | 无 |
| D-2 `readBudgeted` 签名与落点（`read` 后 `kindOf` 前；`const P` + options + `...rest: FailClosedRest<Map, P>`） | `index.ts` L175–179（接口序：patch/read/readBudgeted/kindOf/…） | 与设计 §7 D-2 代码块逐字一致；返回 `DeepOptional<PathValue<PathAt<Map, NoInfer<P>>>>` ✓ | 无 |
| D-2 doc-comment（L91/L92 分叉、失败通道归动态联合、fail-closed、options 与 doc-runtime 关系） | `index.ts` L163–174 | 在位 | 无 |
| D-3 无 options 基线零改动 | 全仓 diff 仅 2 源文件 | 结构级落实 | 无 |
| D-4 名单跟名 + 头注如实注记 | `protocol-surface.ts` L15–19（13 名，`'DeepOptional'` 排 `'PathValue'` 后 = `index.ts` 声明序）；L5–6 T4 注记两行，L4 基点行原地保留 | 与设计一致（「不静默改写历史基点描述」逐字遵守） | 无 |
| D-5 断言判据（相等 + 赋值双向 + EOPT 负例 + `NonNullable` 精确 + 差分锁） | 两测试文件全套（见 §9） | 逐项落实 | 无 |
| D-6 判别不豁免 + G4 双文件锚 + 退路不启用 | 实现（联合分发天然不豁免）+ 文件 1 G4 + 文件 2 G4 | 落实 | 无 |
| D-7 未知路径 fail-closed 复用 `FailClosedRest` | 签名直接复用既有 `FailClosedRest`（未重造）；文件 2 G3.6 未知路径 TS2554 负例 | 落实（未放松） | 无 |
| Q4/Q7 runtime/lease 泛型化消解 | runtime/registry 零 diff | 前提不成立 → 义务消解，如实 | 无 |
| §8 接口头注计数「六个→七个」 | `index.ts` L150 | 设计未逐条列出的注释维护；SA3 §8 已申报为 deviation；同一 ALLOW 文件内、零语义 | 无（观察 O2） |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| 预算读静态类型契约 | `@nomicore/vfsl-protocol`（ADR-0004 D3） | `index.ts` `DeepOptional` + `readBudgeted` | 正确；零运行时参与 |
| 预算读运行时语义/校验 | doc-runtime / runtime（T1–T3 既有） | 零触碰 | 正确（类型票不越权） |
| 导出面事实与碰撞名单 | codegen `protocol-surface.ts` 单一数据源 | 同变更集跟名，单文件单处 | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| 递归类型映射 | `VfslValueOf`（L62–69 惰性递归） | `DeepOptional` 同款条件递归 | 一致 | 复用先例形态 |
| 访问面方法惯例 | `read`（`const P` + `NoInfer<P>` + rest 门） | `readBudgeted` 逐要素镜像 | 一致 | fail-closed 复用非重造 |
| 数组载体索引形投影 | `PathValue`/`PathElementValue` 产型 `Record<`${number}`, E>` | `DeepOptional` 对象分支承接 | 一致 | 保键机制同源 |
| test-d 装置 | ADR-0004 D4（expectTypeOf + @ts-expect-error 自反转） | 全套遵守 + D-5 赋值双向加强 | 一致 | — |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 协议导出面 | `index.ts` 实测 | `PROTOCOL_EXPORT_NAMES`（守卫自动对账） | 低——增名不跟即红（SA3 export-surface log：13=13、silent=[]） |
| 读值剥壳 | `PathValue`/`VfslValueOf` | `DeepOptional` 值域组合 | 无第二套剥壳（载体感知备选按设计否决；G1.6 负例锚定） |
| 预算 options 形状 | doc-runtime `ReadLogicalValueAtPathOptions` | 协议内联字面（双站，R-4 登记） | 中低——字段对照已记录（N3），两侧各有锚 |

### 生命周期对称性

不适用（纯类型面，零运行时/注册/订阅/后台任务）。实现序生命周期（测试先红 → 实现转绿 → 全门禁）按 §11 执行并有日志；变异实验「改动—验证—逐字节复原」对称（sha256 两次 OK + 本审查独立复验）。

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 第二套载体剥壳 | `PathValue` | 未创建 | 无重复 |
| 第二份 options 校验 | doc-runtime 校验器 | 协议侧仅类型形状 | 无重复 |
| 第二测试入口 | `packages/*/test/**/*.test-d.ts` | 两文件落同入口 | 无平行入口 |

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/vfsl-protocol/src/index.ts`（+52/−1，含接口头注计数行替换） | §11 ALLOW 行 1 | `DeepOptional` + `readBudgeted` + doc-comment | 在范围（−1 行 = 头注计数准确性维护，SA3 已申报） |
| `packages/vfsl-codegen/src/protocol-surface.ts`（+5/−1） | §11 ALLOW 行 2 | 名单 13 名 + 头注 T4 注记 | 在范围 |
| `packages/vfsl-protocol/test/vfsl-protocol-deep-optional.test-d.ts`（新，175 行） | §11 ALLOW 行 3 | G1/G4 语义锚 | 在范围 |
| `packages/vfsl-protocol/test/vfsl-protocol-budget-access.test-d.ts`（新，233 行） | §11 ALLOW 行 4 | G3/G2.3/G4 接缝锚 | 在范围 |

`git status --short` 全量核对：生产改动恰 2 处、新测试恰 2 个，其余全部为 wiki/artifacts 证据产物（`.scratch/sa3-337/` 已删；`.scratch/` 残留 `vfsl-v1-parser/` 为他票既有目录，与本票无关）。DENY 全遵守：runtime/registry/doc-runtime/vfsl/domains/docs/CONTEXT/apps/lockfile/package.json/既有测试零触碰。**无越界。**

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| 协议第 13 名导出（加法） | 生成物（仅 import `PathSchema`）、四包消费方 | 加法零影响；`generate --check` exit 0 | 无 | 无 |
| `VfslTypedAccess` 6→7 方法 | 在库全部为 `declare const access` 消费（SA2 §9 grep；本审查复核新测试同型） | 接口加法只影响实现者，在库零实现者 | 无（外部实现者破坏面 = R-5，minor bump 先例随发布流，非本票） | 无 |
| 名单跟名 | 发射器守卫（`emitter.ts` L144）+ 守卫测试（实测枚举） | 13=13、silent=[]（log 实证）；`DeepOptional` 作领域别名从静默转必抛（fail-closed 加严方向，设计 §10 预登记） | 无 | 无 |
| `read`/`patch`/`kindOf`/序列编辑签名 | 既有测试 + 文件 2 G2.3 回归锚 | 零改动 + 显式回归断言（`PathElementValue` 组合含） | 无 | 无 |
| runtime/lease `readData` 双重载与 Equal 锁 | T3 系测试、`apps/yjs-server` L609 | 零 diff；root typecheck/test 绿 | 无 | 无 |
| 新负向锚的级联红（HEAD 态） | `@ts-expect-error` 自反转机制 | 红灯日志证明 TS2578 恰落在依赖新能力的 10 条负例上（其余 5 条被 TS2339/TS2554 消耗）——自反转机制真实可触发 | 无 | 无 |

## 8. 错误、恢复与并发

纯类型面（零运行时）——按纪律攻击可攻击位：

- **错误全编译期且 fail-closed**：未知路径 TS2554（rest 门，`readBudgeted` 与 `read` 同机制）；options 缺参 TS2554 / 形状外键 TS2353（内联封闭形状 + excess property check）；必填误用 TS2322；EOPT 违例 TS2375——文件 2 G3.6 三负例 + 文件 1 G1.2/G4 负例逐项锚定，全部 `@ts-expect-error` 自反转（红灯态 TS2578 实证反转性）。
- **无静默失败**：无 try/catch、无 fallback、无 env override、无吞错（grep 实证零 `skip/only/todo/@ts-ignore/as any`）。
- **变异敏感**（SA3 实跑 + 本审查复核日志归因）：D2 非 EOPT → 恰 1 错 = EOPT 负例 TS2578（精确命中判据）；D3 浅层不递归 → 30 错形状断言红；D4 数组元素加 `\| undefined` → 6 错三态 + plainArr 红；每次复原 sha256 OK。
- **回滚**：revert 两源 + 删两测试，无状态/无 lockfile/无迁移（设计 §13；diff 面闭合实证）。
- **并发/幂等**：不适用（零运行时；类型求值确定）。
- **诚实性**：接口头注计数更新如实（七个）；protocol-surface 头注不静默改写历史基点。

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| 文件 1（19 tests）：G1.2 对象递归/EOPT 负例/必填误用；G1.3 标量/`unknown`/`T\|undefined` 分发；G1.4 变长数组（元素无多余 undefined、readonly 保留）/元组可选/嵌套/索引签名/判别数组；G1.5 判别不豁免 + 字面量精确；G1.6 值域桥接正例 + 载体直套负例；G4 if/switch 窄化 | 全部类型投影行为（Equal 手写 oracle + 赋值双向 + 负例自反转） | `vitest.config.ts` L20 `typecheck.include: packages/*/test/**/*.test-d.ts` ✓；`tsconfig.typecheck.json` 含 `packages/*/test/**` ✓；protocol tsconfig 含 `test/**`（包 tsc 门同覆盖）✓；targeted/root 运行日志均含两文件（19+20 tests 绿）✓ | 无 skip/only/todo；无源码字符串断言；oracle 手写独立（文件 2 RootValue 为独立手写表）；不经 `ReturnType` 取型（L22–23 纪律注明并遵守） | 无 |
| 文件 2（20 tests）：G3.1 六路径（box/label/kind/ents.e1/kw/plainArr）+ 根路径（`[]` D5，`{}` 正例 + 单向赋值 + 反向负例 + 自有键 `string\|undefined`）；G3.2 差分锁；G3.3 `{}` 正例 + 必填误用；G3.4 `NonNullable` 精确；G3.6 三负例（TS2554 ×2 + TS2353）+ `read`/`kindOf` rest 门回归；G2.3 六方法零降级；G4 接缝镜像 | 同上 + 接缝组合（`P → PathAt → PathValue → DeepOptional`） | 同上 | 同上；本地 `LocalMap` 零 `declare module` 增广（顶层键与既有增广键清单零碰撞——B9 键单核对无碰撞） | 无 |
| 既有 4 test-d + empty-module + 守卫 | 回归/负控 | 同入口 | 零改动；49 条既有负锚经 root 门 0 type errors 证明仍为真错误 | 无 |
| 红灯重捕获（R1/R2） | HEAD 源 + 新测试 → TS2305（DeepOptional 导入）+ TS2339（readBudgeted ×13）+ 级联 TS2578 ×10；同目录既有 3 文件同跑全绿（2 failed \| 3 passed files） | 同入口（`--passWithNoTests=false`） | 归因正确（非环境/fixture/入口错误）；恢复 sha256 两次 OK + 本审查独立复验哈希一致 | 无 |

**断言计数核对**：文件 1 实际 `@ts-expect-error` 指令 5 条（L57/64/141/154/166）、文件 2 实际 10 条（L107/132/147/171/176/181/186/188/216/224）——SA3 报告称「18 条（7+11）」把两处 docstring 提及也计入，为报告笔误（见 O1），测试本身无任何问题。

## 10. Required revisions

无 BLOCKER、无 MAJOR finding。无需返工。

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| 门禁在 CI/合并环境复跑 | CI（root typecheck / root test / generate --check） | 全绿（352 files/3880 tests 口径 + 新增 39 tests） | 任一门非零 |
| TS 版本升级后判别窄化行为（R-2） | TS 升级时的 root typecheck/test | G4 锚保持绿（窄化成立、`T \| undefined` 形态不变） | G4 文件红（非 TS2322 形态）→ 按 G4.3 退路条款处理 |
| 病态深 schema 的实例化深度（R-1） | 未来大 schema 域的 typecheck | 无 TS2589、编译时长无异常劣化 | TS2589 或显著变慢 → 票内记录单独评估 |
| options 双站漂移（R-4） | doc-runtime options 演进 | T3 `_optionsAlias` 锚与消费侧 TS2353/`READ_OPTIONS_INVALID` 响亮提示 | 静默漂移（两侧锚同时绿但字段集已分叉——当前不可能：字段对照已记录为基线） |

## 12. Non-blocking observations

- **O1（报告笔误，MINOR）**：SA3 报告 §6 称新增「18 条 `@ts-expect-error`（文件 1 ×7、文件 2 ×11）」——实际指令为 15 条（5+10）；7/11 为 grep 计数混入两处 docstring 提及（文件 1 L19、文件 2 L20）。不影响实现、测试与红灯归因（红灯日志中 TS2578 恰 10 条 + TS2339/TS2554 消耗其余，与本审查逐行核对一致）。建议后续报告按指令行计数。
- **O2（已申报的注释维护，MINOR）**：`VfslTypedAccess` 接口头注「六个→七个类型严格方法」——设计 ALLOW 行未逐条列出该行，但属同一 ALLOW 文件内的纯注释准确性维护，SA3 §8 已如实申报，零语义影响。接受。
- **O3（历史引述残留，信息）**：`emitter.ts` L95/L138 注释与守卫测试/tsc-helper 头注仍含「12 名」字样——均为历史/探针引述，无计数断言（SA2 N5 已裁）；权威计数注记在 `protocol-surface.ts`（已按 D-4 更新）。这些文件在本票 DENY 内，不可顺手改；后续触碰那些文件的票可顺带清理。
- **O4（信息）**：`readBudgeted` 无动态（非字面量）`string[]` 路径的显式负例锚——设计 §12.2 未要求（SA2 N2 已记录机制 = `FailClosedRest` → TS2554，与 `read` 现行为一致）；`read` 的既有动态面锚（SA6 P3）与零 diff 共同覆盖该语义。可选加强项，非缺口。

---

SA4 结论：**approve**。实现忠实于批准设计与验收契约，文件范围闭合，测试为真实行为断言且红灯/绿灯/变异证据链完整自洽（本审查对哈希、日志数字、断言计数、发现入口均做了独立复核）。MINOR 观察不构成阻断。SA8 implementation 复查（`requiresConflictRecheck=true` 的既有既定流程）与本审查结论无冲突输入。
