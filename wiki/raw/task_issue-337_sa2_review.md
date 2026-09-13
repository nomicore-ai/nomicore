# SA2 设计攻击评审 — Issue #337 `[shape-budget] T4: DeepOptional 预算读类型面`

- 派发：`sa-6d330e24-1bce-4164-96a5-fac35f0a6b35`（role `mabf-sa2`，phase `design-review`，iteration 0）
- Worktree：`/home/wangjian/nomicore-fix-issue-337`（branch `mabf/issue-337`，HEAD `cb8aaff0297a802432ba7532a407c65218852dce`）
- 评审日期基点：2026-09-13；评审前 `wiki/raw/task_issue-337_sa2_review.md` 不存在（首版）

## 1. Reviewed inputs

| 输入 | 路径 | 状态 |
|---|---|---|
| 任务简报 | `wiki/raw/task_issue-337.md` | 已读；Issue #337 正文 AC1–AC4；Comments 为空（REST 刷新，无 Owner 要求） |
| SA1 设计 | `wiki/raw/task_issue-337_design.md` | 已读全文（340 行）——被审对象 |
| SA6 契约 | `wiki/raw/task_issue-337_sa6_contract.md` | 已读全文（382 行，verdict approve） |
| SA8 前置门禁 | `wiki/raw/task_issue-337_conflict_report.md` | 已读（clear；§8 行动 1–4；§10 recheck=true） |
| SA8 设计后复审 | `wiki/raw/task_issue-337_design_conflict_report.md` | 已读（clear；24 项对照） |
| 决议摘录 | `wiki/raw/task_issue-337_relevant_decisions.md` | 存在（经前置/设计后两份冲突报告交叉核验） |
| 源码锚点 | `packages/vfsl-protocol/src/index.ts`（全读 157 行）、`packages/vfsl-codegen/src/protocol-surface.ts`、`packages/vfsl-codegen/src/emitter.ts` L144、`packages/namespace-runtime/src/runtime.ts` L138–229、`packages/namespace-registry/src/lease.ts` L282–327/L404–424、`packages/namespace-registry/src/types.ts` L445–462/L670–682、`packages/doc-runtime/src/read.ts` L74–77/L515–600/L690–715、`apps/yjs-server/src/app.ts` L600–615 | SA2 独立复核，逐条比对设计 §2 B1–B12 |
| 既有测试 | `packages/vfsl-protocol/test/*`（3 文件）、`packages/vfsl-codegen/test/generate-alias-collision-guard.test.ts` + `tsc-helper.ts`、`packages/namespace-runtime/test/runtime-readdata-shape-budget.test-d.ts`（`_optionsAlias` L71–73）、`test/helpers/readdata-ok-shape.ts`、`domains/vfs3-assets/test/vfs3-assets-projection.test-d.ts`、`packages/namespace-registry/test/readdata-docs-adr0016-contract-fixture.ts`（`readDataOptionUsages` 正则） | 已读相关段 |
| 配置 | `tsconfig.base.json`（EOPT + `noUncheckedIndexedAccess: true`）、`tsconfig.typecheck.json`、`vitest.config.ts`、root `package.json`（typecheck=14 projects / test / generate）、四包 tsconfig、`packages/vfsl-protocol/package.json`（无 dependencies） | 已读 |
| 母法 | `docs/adr/0024-readdata-shape-budget.md` L85–135（决策 7 / L113 / L127 / L130）、`docs/adr/0004-vfsl-protocol-type-projection.md` D2–D5、`CONTEXT.md` L40–47（「形状预算」词条） | 已读 |
| SA6 证据 | `artifacts/sa6-issue337-{export-surface,guard-sensitivity,type-probes,runner-probe,baseline-gates}.log` | 已读全部（type-probes 97 行逐段） |
| 附加独立核验 | `node_modules/typescript/lib/typescript.js`（TS 5.9.3 checker 源）：`resolveMappedTypeMembers`/`instantiateMappedArrayType`/`instantiateMappedTupleType`/`instantiateMappedTypeTemplate`/`getOptionalType`/`addOptionality`/`missingType`/`createTemplateLiteralType` | SA2 为核验 D-1 表示 pin 的索引签名断言所做（只读，未运行任何进程） |
| 独立 grep | `VfslTypedAccess` 全仓消费者、`keyof VfslTypedAccess`、`readBudgeted`、`DeepOptional`、硬编码导出计数断言 | 见 §9/§10 |

SA2 纪律声明：本评审零运行（无 tsc/vitest/服务/临时进程/临时文件），全部结论基于源码、既有测试、SA6 落盘证据与 TS checker 源码阅读。

## 2. Verdict

**approve** —— 无 BLOCKER、无 MAJOR。

设计在四个关键位上经得起独立攻击：(1) **落点**（D-2 访问面 `readBudgeted`）落在 SA6 G3.6 预声明的备选分支内，runtime/lease 零 diff 使 AC1 以最稳形态成立，五点否决链每点都有源码级证据（本评审复核了「runtime/registry 无 vfsl-protocol 依赖」「typed-stub 编译锁」「重载序/Equal 锁」三处关键事实）；(2) **表示 pin**（D-1 三分支）与 SA6 E4 实测逐点吻合，SA6 未探测的索引签名位由本评审对照 TS 5.9.3 checker 源独立证实为正确（详见 §6/§14-N1）；(3) **名单跟名**（D-4）从守卫测试源码到发射器 `PROTOCOL_EXPORT_NAMES.has()` 全链路核验，因果成立；(4) **验收设计**（§12）断言观察类型行为而非源码文本、红灯协议前置、变异矩阵映射完整。4 条非阻断观察见 §14。

## 3. 需求覆盖

| Requirement | Design section | Assessment |
|---|---|---|
| `DeepOptional` 通用递归映射类型进协议类型面、与 `PathAt` 并列导出（What-to-build ①；ADR-0024 L92） | §7 D-1（精确形态 + 域 pin）、§7 D-4、§8、§11 ALLOW `index.ts` | 覆盖。纯 type 声明、只从协议包出口、`dependencies` 零新增（package.json 实核无 dependencies 段）、`Object.keys===[]` 锚保持。记法 `DeepOptional<PathAt<…>>` 经 doc-comment 桥接为 `DeepOptional<PathValue<PathAt<…>>>`（值域），与 E6 载体壳反证一致 |
| 对象全字段可选并递归（AC2） | D-1 对象分支、§12.2 G1.2（Equal + `{}` 正例 + EOPT 负例 + 嵌套断言） | 覆盖。E4 `vObj` 实测同形；EOPT 负例判据与 E7/probe-eopt TS2375 吻合 |
| 数组元素递归可选化（AC2） | D-1 变长数组分支（同态映射不加 `?`）、G1.4 三态断言、G3.1 `kw`/`plainArr` 接缝断言 | 覆盖。「元素递归 + 无多余 `| undefined` + readonly 保留」= SA6 G1.4 契约默认判据（E4 `Q_ArrAware_plain/ Q_ArrReadonlyAware=true`）。元组可选化有诚实性论证（width 可裁定长位置）。索引形（array 载体 `Record<`${number}`, E>`）值位 `| undefined` 的正确性见 §14-N1 |
| 在场标量保留精确类型（联合字面量）（AC2） | G1.3、G3.4（`NonNullable<BudgetValue['kind']>` Equal `'image'\|'text'`） | 覆盖。标量分支原样（E4 `vScalar/vLitUnion` 实测） |
| readData 类型分叉：无 options 保持 `PathAt` 完整子树承诺（AC1） | D-3 零 diff、G2.1–G2.5 既有锚 + G2.3 差分锁 | 覆盖。零 diff + 差分断言是最强形态；`read`/runtime/lease/yjs-server 面本评审实核零触碰 |
| 带 options 返回 `DeepOptional<PathAt<…>>`（AC1/AC2 接缝） | D-2 `readBudgeted` 返回 `DeepOptional<PathValue<PathAt<Map, NoInfer<P>>>>` | 覆盖（落点=SA6 G3.6 预声明备选分支；「PathAt 承诺」现行为实证只在 typed 面——runtime readData 恒 `value: unknown`，设计的谱系论证成立，见 §5） |
| 判别联合附注 narrowing test-d 锚定（AC3） | D-6（退路不启用 + G4 双文件锚） | 覆盖。E5 实测唯一 TS2322；G4.3 退路条款如实镜像 ADR-0024 L94（未触发不预防性豁免） |
| 未知路径/错误值既有负向锚保持红 + 全套包门禁（AC4） | D-4/D-7、§12.2 G0/G5、§12.3 六道门 + 红灯重捕获步 0 | 覆盖。fail-closed 复用 `FailClosedRest` 不放松；49 条既有负锚零改动保持 |
| Blocked-by #336 已解除 | SA6 §1（HEAD `cb8aaff` = T3 合入点） | 覆盖，非设计义务 |

目标/非目标（§1）：六条非目标逐条有归属（T5 #338 文档面、ADR-0005 生成物、ADR-0008 运行时边界），无静默扩大，无静默缩小。

## 4. Owner评论覆盖

REST Issue-comments 刷新为空（派发说明 + 简报 `## Comments` 空段 + SA6 §2/SA8 §4 Overrides 表空三重一致）。

| Comment ID | Updated at | Design section | Assessment |
|---|---|---|---|
| （无评论） | — | — | 无 Owner 评论要求可映射；全部义务 = Issue 正文 AC1–AC4 + ADR-0024 决策 7（见 §3） |

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| SA6 P1：实测导出面 12 名、无 `DeepOptional`（`artifacts/…export-surface.log`） | D-1/D-4 新增第 13 名纯类型导出 | 复核一致（`index.ts` 157 行 12 个 export 实数） |
| SA6 P2：目标语义 HEAD 不可表达（TS2305）+ 预算价值列 `unknown`（TS2344） | §3 缺口链承接；§12.3 步 0 红灯重捕获 | 一致（type-probes.log §(a) 逐行核对） |
| SA6 P3：无 options 基线指纹 HEAD 零诊断 | D-3 零 diff | 一致（probe-baseline 零诊断，log §(b)） |
| SA6 P4：真实 vitest typecheck 入口红 TS2305 | §11 实现序（两测试文件先落盘复红） | 一致（runner-probe.log：探针红、同目录既有 3 文件绿——红因正确） |
| SA6 P5：加名不跟名单 → `silent=['DeepOptional']` 必红 | D-4 同变更集跟名（G1.7） | 因果链本评审从源码独立复核：守卫测试经 `protocolExportNames()`（checker 实测枚举）逐一断言必抛，发射器 `emitter.ts` L144 `PROTOCOL_EXPORT_NAMES.has(name)` 判碰撞——加导出而不跟名单 → 新名不抛 → `silent` 非空 → 红。成立 |
| SA8 §8.1 名单跟名（阻塞级） | §6 表行 1、§11 ALLOW `protocol-surface.ts` | 落实。头注「如实追加 T4 注记、不静默改写 2026-08-21 基点」与该文件头注纪律（L8–11「名单更新只改本文件一处」）相容；本评审确认无任何测试硬编码「12」计数断言（仅历史注释提及） |
| SA8 §8.2 现行为基准与落点钉死 | D-2/D-3 + §10 调用方矩阵 | 落实。无 options 分支逐点零改动；`apps/yjs-server` app.ts L609 单参动态调用实核在案；Equal 锁/重载序零触碰（lease.ts L410–421、types.ts L675–679 实核） |
| SA8 §8.3 实现纪律（纯类型/零依赖/零 per-schema 生成/不触 docs 带参示例） | D-1/D-4、§11 DENY、§12.2 G1.8/G5.4/G5.5 | 落实。协议 package.json 无 dependencies 段；`readDataOptionUsages` 负控正则扫 docs/integration——设计零文档触碰且 doc-comment 位于 src（不在扫描域、不含带参调用形态） |
| SA8 §8.4 / §10(b) AC3 退路义务 | D-6 不启用（E5 证据）+ G4.3 条件路径登记 | 落实。未触发不预防性豁免；意外红灯的处置路径（票内记录 + SA8 复核）已在设计内 |
| SA6 §15 Q1 载体语义/记法桥接 | D-1 Q1 pin（值域 + PathValue 桥接） | 收口。拒绝载体感知第二套剥壳的理由（单一剥壳权威 `VfslValueOf`/`PathValue`、brand 不泄漏）成立；G1.6 以「载体直套当 `string` 用 → 编译错」负例锚定域外用法 |
| SA6 §15 Q2 数组/元组/readonly 表示 | D-1 Q2 pin（三分支） | 收口。与 E4 全部实测点吻合（`Q_ArrAware_plain`、`Q_ArrReadonlyAware`、vTuple 同态 `[string?, {a?: number}?]`）；同态 `?` 单分支否决有 `Q_ArrH_plain=false` 实证 |
| SA6 §15 Q3 落点接缝 | D-2 访问面 pin | 收口（sanctioned 集内选择，SA6 G3.6 预声明备选分支，SA8 前置门禁 §8.2 明文设计自由） |
| SA6 §15 Q4/Q7 runtime/lease 泛型化与 Equal 锁义务 | §7 Q4/Q7 处置（前提不成立 → 义务消解） | 合理。零 diff 下 `_readAlias`/`_readBudgetAlias`/`_readOverloadOrder` 与「legacy 恒为最后」原样保持即绿 |
| SA6 §15 Q5 EOPT 判据 | D-5 相等 + 赋值双向叠加 | 收口。E7 盲点对策落为断言形态 |
| SA6 §15 Q6 未知路径/失败面 | D-7（TS2554 不放松；`ok:false`/`READ_OPTIONS_INVALID`/released 零接触） | 收口。机制描述一处不精确见 §14-N2（不影响安全方向与验收） |
| SA6 §15 Q8 导出与依赖边界 | D-4（只在协议包出口，无再导出） | 收口 |
| ADR-0024 L91/L92/L94/L95/L113/L127/L130 | 全设计 | 逐条落实（ADR 原文本评审实读；L127「数组元素递归」与 AC2「数组元素递归可选化」在值域读法下同一） |
| ADR-0004 D2/D3/D4/D5 | D-1 域外声明、D-2 零依赖、D-5 判据、§12.2 根路径锚 | 逐条落实（D3 的 12 名枚举为决策时点描述——SA8 已裁，与本设计加法相容） |

SA6 契约是否需要原位修订：否——落点选择落在 G3.6 预声明备选分支内（SA8 设计后复审同判），非「另有选择」。

## 6. 设计内部一致性

逐面核验结果：

- **正文 ↔ 精确形态 ↔ 测试规格**：§7 D-1 的 TS 字面形态与 §12.2 G1.x 断言 oracle 逐条同形（对象/标量/变长数组/元组/判别联合/`unknown` 兜底）；D-2 签名与 G3 系断言同形（含 `NoInfer<P>`、`FailClosedRest` 位序——options 在 path 后、rest 前，与 `patch` 的 value 位序同构）。
- **B 锚点复核**：B1（157 行/12 名）、B2（六方法 + `read` 返回 L126–129）、B4（array 载体 → `Record<`${number}`, E>`，`PathElementValue` L96–103 与 vfs3 `ExpectedEntityValue.tags` 双证）、B5（runtime.ts L148–220/lease.ts L282–295/L410–421/types.ts L450–459/L675–679）、B6（`ReadDataOkShape` 头注明文编译锁）、B7（名单机制 + 守卫测试 L66–76 + tsc-helper L76–88）、B8（`projectValue`/`budgetFold`/`copyPlainStrict` 头注：plain 值域同样递归受预算——元组/定长可裁的诚实性论证依据成立）、B9（共享 program + 既有增广键清单 + `LocalEmptyMap` 隔离先例）、B10（protocol/codegen tsconfig 含 `test/**`、runtime 仅 `src/**`——四文件实读）、B11（EOPT + E7）、B12（六门全绿 log）——**全部与源码/证据一致，无死引用、无旧 API、无前后相反描述**。
- **SA6 未探测位的独立核验（本评审补充证据）**：D-1 对象分支对**索引签名**的断言（值位 `DeepOptional<E> | undefined`；G1.4 `V['0']`=`string \| undefined`；G3.1 `kw` → `Record<`${number}`, {v?: string} | undefined>`）在 SA6 E4 探针集中**没有对应探针**（probe-model.ts 仅 vObj/vScalar/vNullable/vLitUnion/vArr*/vTuple/vEntity*）。本评审对照 TS 5.9.3 checker 源逐机制核实为**正确**：① `resolveMappedTypeMembers` 的 keyof 同态路径按源索引信息迭代，`createTemplateLiteralType` 仅携带 `TemplateLiteral` flag（不含 `String` flag），故 `indexKeyType = propNameType`——模板字面量索引键**保留**（这也正是 B4 中 `VfslValueOf` 映射保键的既有机制，vfs3 Equal 锚在 HEAD 绿为其在库实证）；② `?` 修饰经 `addOptionality(..., isProperty=true)` → `getOptionalType` → EOPT 下并入 `missingType`，而 `X | missingType` 与 `X | undefined` 在 Equal 判据下不可区分——E4 自身的 `Q_ArrH_undef=true`（元素位同机制）即为该等价的实测先例；③ `noUncheckedIndexedAccess: true` 不改变该 oracle（读索引签名值位本已含该成员）。结论：pin 正确、oracle 可字面化；证据归属瑕疵记为 §14-N1。
- **接口变化清单 ↔ 文件范围**：§8 声明仅两处源文件，§11 ALLOW 恰两源 + 两测试，§13 回滚 = revert 两源 + 删两测试——闭合无泄漏。
- **§12.1 AC 映射 ↔ §12.2/§12.3**：AC1→G2（绿→绿）、AC2→G1+G3（红→绿）、AC3→G4（红→绿）、AC4→G0/G5（绿→绿）+ SA8 三行复核项——与 SA6 §12.1 契约总表逐行对齐；变异 D1–D10 落点映射无孤儿（D7/D8/D10 标注「零改动下不可发生 + 若发生的击穿锚」——诚实）。
- **§14 修订映射**：如实记录 iteration 0 无 SA2 输入，与事实一致（本文件为首版）。

## 7. 状态机与并发攻击

纯类型面（零运行时状态、零运行时数据流）——设计 §8/§9 的「不适用」声明与全部改动为 type 声明 + const 名单字符串的事实一致。仍按纪律攻击可攻击位：

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| S-1 | HEAD（名单 12 名、守卫绿） | 同一变更集内导出名先落、名单未跟（实现序中间态） | 守卫 `silent=['DeepOptional']` 红（P5 实证机制） | 无缺口——R-6 登记为流程风险并给「同变更集成对」纪律；SA8 设计后复审 §8 行动 1 列为实现期核对项 | 无 |
| S-2 | HEAD（协议包 12 名） | 测试文件先落盘（红灯协议步 0） | 两文件因 TS2305/TS2339 红；协议包 tsc 连带红（tsconfig 含 `test/**`）；root typecheck 亦红 | 无缺口——§11 实现序明文预期该连带红（与 #24/#335 先例同款）；§12.3 步 0 用 `--passWithNoTests=false` 防静默假绿 | 无 |
| S-3 | 实现后（13 名、名单 13 名） | 删除名单条目（回滚半途） | 守卫过度拦截（fail-closed 方向，无害） | 无缺口——protocol-surface.ts 头注 L10 明文该方向不红但无害 | 无 |
| S-4 | 任意态 | 重复编译同一 program | 类型求值确定（SA6 §7 逐字节一致） | 无缺口 | 无 |
| S-5 | 任意态 | 进程重启/并发编译 | 不适用（零运行时、零持久化、零 wire） | 无缺口（SA8 冻结面「wire/持久化/状态机」行确认零接触） | 无 |

多事实源分叉检查：导出面唯一事实源 = `index.ts` 实测（守卫经 checker 枚举自动跟随，不依赖手抄名单作事实源——名单仅是发射器碰撞判据）；读值剥壳唯一权威 = `PathValue`（D-1 拒绝第二套剥壳）；预算 options 事实源 = doc-runtime（协议侧为结构字面双站，R-4 如实登记，见 §14-N3）。

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| E-1 | 未知字面量路径调用 `readBudgeted` | `FailClosedRest` → `[error:'路径不可解析 (UnknownPath)']` → 缺参 TS2554（与 `read` 同机制同文，G3.6 锚 + D7 变异覆盖） | 无——fail-closed 不放松 | 无 |
| E-2 | options 形状外键（`{depth:1, schema:true}`） | 内联封闭形状 → TS2353（G3.6 负例）——比「预算参数不是 schema opt-in」更严 | 无 | 无 |
| E-3 | 预算值必填误用（`b.n` 当 `number`） | TS2322（G3.3 负例；CONTEXT L47 Avoid 的断言化） | 无 | 无 |
| E-4 | 非 EOPT 实现漂移（`{a?: string \| undefined}`） | `{a: undefined}` 负例自反转（TS2375，D-5 判据 2；D2 变异探针） | 无 | 无 |
| E-5 | 判别窄化在实现期意外 TS 不容 | G4.3 条款：票内记录 + SA8 复核后方可启用退路（不静默改形） | 低且有处置路径（R-2 哨兵 = G4 锚先红） | 无 |
| E-6 | 回滚 | revert 两源 + 删两测试；生成物/lockfile/其他包零触及（§13） | 无——本评审核验改动面确实闭合于四文件 | 无 |
| E-7 | options 双站漂移（doc-runtime 演进、协议字面未跟） | 消费侧 TS2353（新字段不可传）或运行时 `READ_OPTIONS_INVALID`（旧字段名）——均响亮、非静默；两侧各有 Equal 锚 | 低——跨站**相等性**无编译期锚（单向可观测），R-4 已登记、跨包单源合并显式延后 | 无（阻断级不成立：协议包按 ADR-0004 D3 不得 import runtime 包，反向边属公共面变更；残余见 §14-N3） |
| E-8 | 载体直套误用（`DeepOptional<PathAt<…>>` 当值类型） | 产壳形状不可当值用 → G1.6 负例编译错（E6 反证 + doc-comment 域外声明） | 无 | 无 |

无静默失败路径；无「fallback 掩盖必填不变量」路径——预算读的必填承诺弱化本身即产品语义（ADR-0024 决策 7 立法），且以负例锚定而非含糊其辞。

## 9. 契约影响审查

SA2 独立 grep 全仓 `VfslTypedAccess`（含 `keyof VfslTypedAccess`、`satisfies`/实现体）与 `readBudgeted`/`DeepOptional`：

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| `VfslTypedAccess<Map>` 方法集（6→7） | 无。全部在库消费者为 `declare const access`（protocol projection/empty-fail-closed、codegen narrow、vfs3-assets projection/migration），无方法集穷尽锚（`keyof VfslTypedAccess` 零命中）、无实现体 | 本评审 grep 实核 6 处测试消费点全部 `declare const`；设计 §10 行 1/B3 与源码一致 | 无 |
| `read`（无 options typed 读） | 无——签名零改动；G2.3 差分锁防可选化泄漏 | `index.ts` L126–129 | 无 |
| runtime/lease `readData` 双重载与结果联合 | 无——零 diff；Equal 锁/重载序/stub 编译锁原样 | runtime.ts L148–220、lease.ts L282–295/L410–421、types.ts L675–679、`readdata-ok-shape.ts`（实核） | 无 |
| `apps/yjs-server` L609 单参动态调用 | 无——命中 legacy 重载，root typecheck 保护 | app.ts L605–612 实核 | 无 |
| `generate-alias-collision-guard.test.ts` | 无——零测试改动；中间态红为预期（S-1），跟名后 13=13 绿 | 守卫源码 L66–76 + emitter.ts L144 实核 | 无 |
| 发射器领域别名碰撞守卫 | 无——名单含 `DeepOptional` 后行为变化 = 该名作领域别名从静默转为必抛（fail-closed 加严方向，预期内且记入 §10） | emitter.ts L144 `PROTOCOL_EXPORT_NAMES.has` | 无 |
| 外部宿主（typed-access 适配器） | 无破坏——接口加法只影响「实现者」；宿主为消费者，可自择接线（T5 文档归 #338，谱系完整） | `.agents/skills/nomicore/typed-access.md`「one narrow assertion may bridge」实核在案 | 无 |
| 外部实现者（如存在） | R-5 登记：0.x minor bump 先例（ADR-0024 L130「发布随各包 minor bump」）随发布流处理 | 在库零实现者（grep 实核） | 无 |
| `domains/*/generated.ts` / 生成器 | 无——`PROTOCOL_IMPORT_LINE` 不动、输出规格不动、`generate --check` 零漂移为验证门 | protocol-surface.ts L18–19 | 无 |
| 动态（非字面量）路径的预算读 | 动态面归宿 = `lease.readData(path, options)`（编译、`unknown` 值、非 never 非壳）——G3.6 动态条款在该面满足；访问面对动态 `string[]` 走 `FailClosedRest` 编译期拒绝（fail-closed，强于设计正文「返回 never」的表述——见 §14-N2） | `PathAtImpl` 对非元组 `Remaining` → `never` → `FailClosedRest` 真 → TS2554；与 `read` 现行为一致 | 无（措辞精化建议见 §14-N2） |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| 预算读静态类型契约 | `@nomicore/vfsl-protocol`（typed 访问契约 Owner，ADR-0004 D3） | `index.ts` `DeepOptional` + `VfslTypedAccess.readBudgeted` | 正确。应用层零参与；无底层状态机复制 |
| 预算读运行时语义/校验 | doc-runtime / runtime（既有，T1–T3） | 零触碰 | 正确（类型票不越权） |
| 导出面事实与碰撞名单 | codegen `protocol-surface.ts`（#45 冻结面单一数据源） | 同变更集跟名，单文件单处 | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| 递归类型映射 | `VfslValueOf`（`index.ts` L62–69，惰性递归先例） | `DeepOptional` 同款条件递归 | 一致 | 复用惰性求值形态；R-1 引用该先例 |
| 访问面方法签名惯例 | `read`/`patch`/`kindOf`（`const P` + `NoInfer<P>` + rest 标记） | `readBudgeted` 逐要素镜像 | 一致 | fail-closed 机制复用非重造 |
| 数组载体的 `Record<`${number}`, E>` 投影 | `PathValue`/`PathElementValue`（L61–103） | `DeepOptional` 对象分支承接该产型 | 一致 | 保键机制同源（§6 独立核验①） |
| 类型测试装置 | ADR-0004 D4（expectTypeOf 正例 + @ts-expect-error 自反转负例） | D-5 相等 + 赋值双向叠加 | 一致（判据加强不偏离） | E7 盲点对策 |
| 类型锁惯例 | lease `Equal` 锁族、T3 `_optionsAlias` | G2.3 差分锁、G1.x Equal | 一致 | — |

未发现可比实现缺失需要凭空声称惯例的位置；未创建平行通道。

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 协议导出面 | `index.ts`（checker 实测枚举） | `PROTOCOL_EXPORT_NAMES`（发射器碰撞判据；守卫以实测面驱动自动对账） | 低——增名不跟即红（P5 行为级实证） |
| 读值类型剥壳 | `PathValue`/`VfslValueOf` | `DeepOptional` 的值域组合 | 无第二套剥壳（载体感知备选被否决，理由成立） |
| 预算 options 形状 | doc-runtime `ReadLogicalValueAtPathOptions`（实核 `{depth?; maxChildrenPerNode?}` 与协议字面逐字段一致） | 协议方法内联字面形状 | 中低——R-4 登记双向锚缺口（见 §14-N3） |
| ADR/CONTEXT 记法 `DeepOptional<PathAt<…>>` | 决策文本（不改） | 协议 doc-comment 桥接声明（≡ 值域展开） | 低——R-7 登记、T5 文档同步沿用同口径 |

### 生命周期对称性

不适用（零运行时、零注册/订阅/后台任务）。唯一准生命周期项 = 实现序（测试先行红 → 实现转绿 → 全门禁），§11/§12.3 成对规定；回滚对称（§13）。

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 第二套载体剥壳 | `PathValue` | （未创建——载体感知备选被否决） | 无重复 |
| 第二份 options 校验 | doc-runtime 校验器（`READ_OPTIONS_INVALID` 单一权威） | 协议侧仅类型形状（零校验、零解释） | 无重复——类型面不越权描述失败（D-2/D-7） |
| 通用 `DeepOptional` 的 per-schema 变体 | 零 per-schema 生成纪律 | 通用映射类型单定义 | 无重复 |
| 新测试入口 | `packages/*/test/**/*.test-d.ts` + vitest typecheck | 两文件落同一入口 | 无平行入口 |

阻断项清单核对：行为 Owner 无错位；无绕过既有能力（`FailClosedRest`/`PathValue`/名单机制全复用）；无第二可漂移事实源（见上表）；无生命周期不对称；无「以改动少解释架构偏离」（D-2 的取舍理由是架构耦合/发布面/脆弱面/契约自洽/改动面五点证据链，非便利性）。

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW `packages/vfsl-protocol/src/index.ts`（DeepOptional + readBudgeted + doc-comment） | 设计 §8 接口变化清单恰两处，均在本文件 | 无 |
| ALLOW `packages/vfsl-codegen/src/protocol-surface.ts`（名单 +1 + 头注注记） | SA8 §8.1 阻塞级义务；该文件头注「名单更新只改本文件一处」 | 无 |
| ALLOW 两新测试文件（`vfsl-protocol-deep-optional.test-d.ts`、`vfsl-protocol-budget-access.test-d.ts`） | SA6 §12.3 文件 1 + 文件 4（备选落点行）；路径命中 `typecheck.include` glob；protocol tsconfig 含 `test/**` 使包门同覆盖 | 无 |
| DENY runtime/registry src + package.json + lockfile | D-2 落点否决 + 零 diff 论证；runtime/registry 实无 vfsl-protocol 依赖（package.json 实核） | 无 |
| DENY `domains/**`、`docs/integration/**`、typed-access 文档、`docs/adr/**`、`CONTEXT.md`、既有测试、`apps/**` | 与 §1 非目标逐条对账（T5 #338 归属、生成物禁手改、词条已在位、负控正则域） | 无 |
| ALLOW 无无理由扩张；正文涉及的每个路径都在 ALLOW/DENY 有归属 | §8/§11/§13 交叉核对无孤儿路径 | 无 |
| follow-up（T5 #338）未掩盖本任务必要项 | 本票必要项 = 类型面 + 名单 + 测试锚，全部在 ALLOW；文档/正则/ADR 回填非本票必要项（SA8 双报告裁定归 #338/PR #332） | 无 |

版本 bump 面：ALLOW 不含 `packages/vfsl-protocol/package.json`——minor bump 随发布流（ADR-0024 L130），与 DENY 三项（runtime/registry package.json、lockfile）共同闭合依赖面零改动。一致。

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1 零降级（type-level） | 零 diff + G2.1–G2.5 既有锚（P3 指纹）+ G2.3 差分锁（`read(['box'])` Equal 完整形 + 双向赋值） | 无——既有锚观察类型行为，非源码文本 | 无 |
| AC2 语义面 | G1.1–G1.6：Equal（手写 oracle，防同源自证）+ `{}` 正例 + EOPT 负例 + 嵌套递归 + 数组三态 + 判别不豁免 + 载体桥接负例 | 无 | 无 |
| AC2 接缝面 | G3.1（box/kw/plainArr/根路径五形）+ G3.3/G3.4 + G3.6 三负例（TS2554/缺参/TS2353） | 无——索引形 oracle 的 TS 行为已由本评审对照 checker 源核实（§6/§14-N1） | 无 |
| AC3 narrowing | G4 双文件：成员独有字段访问行**无** expect-error + `const s: string = v.url` expect-error（TS2322，`T \| undefined`）——观察窄化行为本身 | 无 | 无 |
| AC4 负锚保持红 + 全门禁 | G0（49 条既有 `@ts-expect-error` + empty-module + 守卫 + `generate --check`）+ §12.3 六道门 | 无 | 无 |
| 旧实现真实为红 | §11 实现序 + §12.3 步 0（HEAD 复跑捕获 TS2305/TS2339；SA6 P4 已在真实入口同型实证） | 无 | 无 |
| 错误路径伪绿风险 | 负例全部 `@ts-expect-error` 自反转（D4 装置）；无 skip/only/todo（G5.6）；`--passWithNoTests=false` | 无 | 无 |
| 变异敏感性 | D1–D10 全数沿用并落点映射（D2/D3/D4/D5/D6 有专断言；D7/D8/D10 标注不可发生路径 + 击穿锚） | 无 | 无 |
| 测试落位真实入口 | `packages/vfsl-protocol/test/*.test-d.ts` ∈ `typecheck.include`（vitest.config L20）∩ protocol tsconfig `test/**` ∩ `tsconfig.typecheck.json` `packages/*/test/**` | 无 | 无 |
| G3.3 取型陷阱 | 设计明文「不得经 `ReturnType` 取型」（泛型方法签名擦除） | 无 | 无 |

SA2 未运行任何测试（纪律）；以上为对断言设计与入口可达性的静态审查结论。

## 13. Required revisions

无 BLOCKER、无 MAJOR finding。设计可安全进入实现迭代。

## 14. Non-blocking observations

- **N1（证据归属精化，不改裁决）**：D-1 对象分支的索引签名断言（G1.4 末项 `V['0']`=`string \| undefined`；G3.1 `kw` 索引形；§5 引「E4 `vObj`」）在 SA6 探针集中无对应探针（E4 未测 `Record` 输入）。SA2 已对照 TS 5.9.3 checker 源独立证实 pin 正确（模板字面量索引键保留 + `?` 的 EOPT missing 标记在 Equal 判据下与 `| undefined` 等价——E4 自身 `Q_ArrH_undef=true` 即同机制先例；`noUncheckedIndexedAccess` 不改变观感）。建议：实现迭代在实现说明中记录该核验一句话；若索引形 Equal 断言意外红，先复核 TS 行为与设计 pin 的出入，不得以放宽 oracle 方式转绿（该形态属公共类型面 pin，改动须回设计 + SA8）。
- **N2（措辞精化）**：D-7 称动态（非字面量）`string[]` 路径「`PathAt` → `never` → 返回 `never`」——实际机制是 `FailClosedRest` 判真 → rest=`[error]` → 调用**编译期 TS2554**（与 `read` 现行为一致），返回类型永不物化。安全方向相同且更强（fail-closed），无验收影响；建议实现说明按 TS2554 表述，避免实现者按「可用 never 返回值」误设断言。
- **N3（R-4 的落地建议）**：options 双站字面（协议内联 vs doc-runtime 单源）当前逐字段一致（SA2 实核）；两侧 Equal 锚各自独立，跨站**相等性**无编译锚。建议实现说明中记录一次字段对照（`{depth?; maxChildrenPerNode?}` × 2）作为基线，doc-runtime 演进时以 T3 `_optionsAlias` 红 + 消费侧 TS2353/`READ_OPTIONS_INVALID` 响亮提示为漂移哨兵；跨包单源化维持「后续演进」归属不变。
- **N4（可选加强）**：`DeepOptional<X | undefined>`（成员独有字段读的 `T | undefined` 透传位）目前仅由联合分发性质隐式覆盖，可在文件 1 增补一行 Equal 锚（`DeepOptional<{a:string} | undefined>` = `{a?: string} | undefined`）。非必要——分发性质已被 G1.5 判别联合（同为联合逐成员）覆盖。
- **N5（信息性）**：`generate-alias-collision-guard.test.ts`/`tsc-helper.ts` 头注中「实测 12 名」为历史探针引述（无计数断言），加名后无需更新（DENY 既有测试）；权威计数注记由 `protocol-surface.ts` 头注追加行承载，设计 D-4 已按「不静默改写历史基点」处理。

---

SA2 结论：**approve**。设计的证据密度高（每个 pin 均可回溯到源码行、SA6 实测或本评审补充核验），落点与表示选择均在上游 sanctioned 集内且论证充分，文件范围闭合，验收断言观察行为而非文本。实现迭代按 §11 实现序与 §12.3 门执行即可；`pass` 不替代 SA4/SA7 对实现与活链路的后续验证。
