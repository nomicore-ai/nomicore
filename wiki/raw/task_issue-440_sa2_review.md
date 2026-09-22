# SA2 设计攻击评审 — issue #440：vfsl 逐 entry 校验扩展（Record + 封闭对象 delete）与一致性 fixture 扩展（ADR 0034）

- 角色：SA2（独立设计攻击评审）｜iteration 0｜2026-09-22
- 评审对象：`wiki/raw/task_issue-440_design.md`（SA1，worktree `mabf/issue-440` @ HEAD `0a91f14`）
- Verdict：**approve**（无 BLOCKER / 无 MAJOR；3 条 MINOR 见 Non-blocking observations）

## 1. Reviewed inputs

| 输入 | 状态 | 核验方式 |
|---|---|---|
| `wiki/raw/task_issue-440.md`（Host 简报） | 在场 | 全文读取；AC1–AC6 + What to build + Blocked by #437 |
| `wiki/raw/task_issue-440_design.md`（SA1 设计） | 在场 | 全文读取 + 逐锚点独立核验 |
| `wiki/raw/task_issue-440_sa6_contract.md`（approve 契约） | 在场 | 全文读取；§12.1 绑定点 B-1…B-6、§12.2 用例组 A–F、§13 红/绿证据 |
| `wiki/raw/task_issue-440_sa6_capability_probe.mts`（探针） | 在场 | 全文读取；G1–G5 / REF / O1–O3 / NC1–NC2 机制核验 |
| `docs/adr/0034-record-and-parent-elementwise-validation.md`（母法，HEAD 合入） | 在场 | 全文读取；决策 1–6 逐条对照 |
| `docs/adr/0033`（同族先例） | 在场 | 经 `applyElementwiseArrayMutation` 实现（`validate-patch.ts:1039-1146`）与提交 `006e416` 范围核验 |
| `packages/vfsl/AGENTS.md` / 根 `AGENTS.md` / `docs/AGENTS.md` | 在场 | 包纪律（公共面只经 index.ts、纯函数不抛错、message/顺序/path 兼容行为）逐条对照 |
| 源码锚点 | 在场 | `validate-patch.ts`（全文 1146 行）、`validate.ts`（关键段）、`derived.ts`、`index.ts:118-157`、`doc-runtime/src/mutation-local.ts:255-374`、根 `vitest.config.ts` |
| SA6 落位的冻结测试四件 | 在场 | contract（460 行，26 tests）、control（327 行，19 tests）、fixture（688 行，117 例）、test-d（51 行）逐断言核验 |
| `task_issue-440_relevant_decisions.md` / `_conflict_report.md` | **不存在** | `ls wiki/raw | grep 440` 仅 4 件；iteration 0 无 SA8 工件（SA6 §1 / 设计 §6 同口径） |
| REST Issue comments | 空 | 简报 + SA6 §2 双重确认 `[]`——无 owner 需求面 |

本评审为独立攻击：不依赖 SA6/SA1 的自述结论，所有关键断言（导出面、legacy 行为、规划形状、消息逐字、契约断言可满足性）均在源码与冻结测试上重新推导。

## 2. Verdict

**approve**。设计的接缝形状（B-1…B-6 原样采纳）、判定管线（D2 单 entry 视图过共享解释器 / D3 仅域规则 / D4 静态必填）、闸门 fail-closed 矩阵、文件范围（纯加法两文件）、验收映射（冻结契约翻绿即执法）均可在不触碰任何冻结面与 ADR 边界的前提下安全实施。逐条攻击（等价性反例搜寻、闸门误接管、消息漂移、`__proto__`/undefined/空键对抗输入、调用方破坏、导出面破坏既有 guard）均未找到可实现的设计缺口。3 条 MINOR 不阻断。

## 3. 需求覆盖

| Requirement | Design section | Assessment |
|---|---|---|
| Issue 正文：Record set = 键 Pattern 校验 + 新值过值 schema（不读旧值） | §7.2 D2、§8.1 ④ set 支 | 覆盖。单 entry 视图 `{[key]: value}` 过 `validateSubtree(plan.node)`，键 Pattern/值校验/issue 序/截断/E100/预算全部单源继承自 `validate.ts:655-667` + `:369-379`（本评审逐行核对该继承链真实存在且 Record 形态无 map 级约束） |
| Issue 正文：Record delete 只做在场/no-op 域规则 | §7.2 D3、§8.1 ④ delete-record | 覆盖。`has=false` → no-op（文案/路径与 legacy `validate-patch.ts:973-974` 逐字同源）；`has=true` → `{ok:true}`（空对象合法推论） |
| Issue 正文：封闭对象 delete 静态必填判定全矩阵 | §7.2 D4、§8.1 ④ delete-parent | 覆盖。算法镜像 `validate.ts:670-682`（optional 先查 → ref 解析 → scalar∧unknown 跳过 → 必填拒），含「未找到字段 fail closed」分支 |
| Issue 正文：issue 路径 `[...mapPath, key]` 与全量路径逐字节兼容 | §7.2 D2 rebase、§8.2 矩阵 | 覆盖。rebase 式与 legacy `validateBoundary`（`validate-patch.ts:1015-1022`）/`finish`（`:565-572`）逐字符相同 |
| Issue 正文：一致性 fixture 扩展（Record + parent；未来 map 级约束红灯） | §7.2 D6、§12 AC4 行 | 覆盖。fixture 已由 SA6 落位（107 等价 + 10 触达面，md5 登记），实现使其 E1/E2/E3 全绿即执法 |
| AC1 Record set 键 Pattern/新值拒绝 + 逐字节路径 | §3 缺口表、§8.2（B1–B5/B7 行） | 覆盖；契约断言逐条可满足（本评审对 B2/B3/B4/B5/B7 手工推导单 entry 视图输出与 oracle 逐字节一致） |
| AC2 Record delete 仅域规则、不触碰其他 entry | §8.2（C1–C5 行）、§7.2 D5 | 覆盖 |
| AC3 封闭对象 delete 静态规则全矩阵（必填拒/optional 允/unknown 必填允/no-op 拒） | §8.2（D1–D6 行） | 覆盖；D 组四象限 + 嵌套 panel.node 全在场 |
| AC4 一致性 fixture 两形态逐字节一致 | §12 AC4 行 | 覆盖 |
| AC5 公开面只经包公共入口导出 + guard 覆盖新导出 | §7.2 D1/D7、§10、§11 | 覆盖。新增 1 运行时导出 + 2 类型导出全经 `src/index.ts:132-147` 导出块；A1 以 `hasOwnProperty` 锚自有导出键；本评审另证既有 guard（NC5 超集锚、`validate-number-domain-narrowing` 负名锚、`validate-logical-snapshot` 旧名锚）均为超集/负名断言，纯加法不破坏任何一面 |
| AC6 包测试 + 根 typecheck/test 绿 | §12 AC6 行、§13 | 覆盖。绿判据与 SA6 §13 一致；根 `vitest.config.ts` include/typecheck 实核（`packages/*/test/**/*.test.ts` + `.test-d.ts`） |
| 非目标未被静默扩大 | §1 非目标清单 | 覆盖。doc-runtime 接线/S9/基准（#441）、lease 端到端（#442）、union map 位（永久 legacy）、map 级约束（立法禁止）、封闭对象 set（ADR「不做什么」）全部显式排除且与 Blocked-by 链一致 |

无未落点需求；无范围蔓延。

## 4. Owner评论覆盖

REST Issue comments = `[]`（简报与 SA6 §2 双确认）。无适用 owner 评论——设计 §4 表以 AC1–AC6 + 兄弟票消歧逐行代替，处理正确。兄弟票消歧三则（#439「测试 seam 不新增」指观察面；未声明键规划层已拒；端到端钉正归 #442）与 SA6 §2.1–2.3 逐字一致，且经本评审在 `planMutationBoundary`（`validate-patch.ts:739-822`）与 NC2.4 上独立复核成立。

| Comment ID | Updated at | Design section | Assessment |
|---|---|---|---|
| （无评论） | — | §4 全表 | 空评论面处理正确 |

## 5. 上游事实与SA8约束

#440 无 SA8 工件（iteration 0）。设计以 ADR 0033/0034 + 包纪律 + SA6 §3 构造替代约束面并逐条落实（设计 §6 表）；末行显式标记「缺 SA8 预检工件 → 设计后 ADR 冲突复查 = 是」，符合保守纪律。

| Fact or constraint | Design response | Assessment |
|---|---|---|
| SA6 G1：公共面 23 运行时导出零落点（运行时反射） | §2 C1；新增恰 1+2；NC5.1 超集锚 | 成立。`index.ts:132-147` 导出块实核；`/elementwise/i` 现仅数组位 |
| SA6 G2：legacy 必须消费整 map/父值（`{has}` 代 base 三支实测） | §2 C3、§5；接缝输入收窄为 `{has}` | 成立。set 支 `rebuildAlong`（`:954-960`）与 delete 支 `Object.hasOwn`（`:973`）实核 |
| SA6 G3 + NC2：规划闸门形状冻结 | §2 C4；接缝消费同一形状，不改 `planMutationBoundary` | 成立。边界定夺 `:791-818` 实核：record = finalViaRecord ∧ relPath=[last]；parent = delete ∧ 非 viaRecord；union = 穿越；未声明键结构面拒 |
| SA6 G4 + NC1：现状语义快照（键 Pattern 消息/序、rebase、no-op、必填、optional/unknown、值位 union、delete 不查键） | §5；判定语义经 `validateSubtree` 单源继承 | 成立。`validate.ts:374`（键消息）、`:660-665`（键先值后全收集）、`:680`（必填消息）逐字比对冻结常量一致 |
| SA6 G5/E6/NC6：Record 无 map 级约束（立法前提） | §2 C5；D2 等价论证的规范基础 | 成立。`validateObject` Record 形态（`:655-667`）实核：逐键 keyPattern + 逐值校验，空对象合法，无必填/未知键/map 级检查 |
| ADR 0034 决策 1（闸门/旧值不读/值位 union 不排除/union map 永久 legacy） | §6 表第 1 行、§8 ①④ | 落实。三重闸门 + `<key>` 槽形态一致检查；set 不读 `facts.has`；`blobs` 值位 union 经 `<key>` 槽整体过解释器（闸门不排除，B5 逐字复现仲裁） |
| ADR 0034 决策 2（静态必填矩阵 + `has` 拒 no-op + 不读父值） | §6 表第 2 行、§7.2 D4 | 落实。四象限 + 嵌套 + 缺字段 fail closed 全覆盖 |
| ADR 0034 决策 3（返回 `ValidateResult` 直出，无 `proposedBoundary`） | §7.2 D1、§8 返回 | 落实。`ValidateResult`（`validate.ts:49-51`）ok 支恰 `{ok:true}`，与 A2 `toEqual({ok:true})` + `hasOwn(result,'result')===false` 及 test-d 负面夹具三重吻合 |
| ADR 0034 决策 4（触达面 = 载体 + 目标键位） | §7.2 D5（输入面表达）+ fixture 触达面组 + NC7 对照 | 落实（本票份额）。端到端钉正归 #442 与 SA6 §15.2 一致 |
| ADR 0034 决策 5（立法 + enforcement = 一致性 fixture） | §7.2 D6 | 落实。fixture 已落位，实现翻绿即执法 |
| ADR 0034 决策 6/后果（基准、S9/E201/charge） | §1 非目标、§13 残余 5 | 落实（归 #441/#442）；charge 计数变化在 §13 风险表如实登记为「预期内」 |
| `packages/vfsl/AGENTS.md` 全部条款 | §6 表、§7.2 D1/D7、§10 | 落实。纯函数/不抛错（E100 收编）/畸形输入判别联合/零 Yjs/只经 index.ts/兼容面逐字节 |
| 根 `AGENTS.md` 测试纪律 | §12（测试已冻结，设计不改测试） | 落实 |

## 6. 设计内部一致性

- 正文 §1 目标 1–5 ↔ §7.2 D1–D7 ↔ §8.1 管线 ↔ §8.2 矩阵 ↔ §12 验收映射：逐行交叉比对无矛盾（B2/B3/B4/B7、C1–C5、D1–D6、E1–E3、F1–F3 每格在两处出现时语义一致）。
- D2 伪代码的 rebase（`[...plan.prefix, ...i.path]`）与 legacy `finish`/`validateBoundary` 逐字符相同（`validate-patch.ts:570`、`:1020`）——「逐字节兼容」主张有代码级依据。
- §7.3 备选 A2/A3/A4/A5 的否决理由与 §2 证据锚互洽；A3（委托 legacy + 合成基值）确为 SA6 见证形状，设计选 D2（更短同源路径）不损失语义。
- 全部源码行号锚点（C1–C10）经本评审逐一实核**全部命中**：`validate-patch.ts:926-1012/1015-1022/739-822/791-818/941-960/962-981/973/1039-1146/481-518`、`validate.ts:655-667/369-379/670-682/147-149`、`derived.ts:45/57-63`、`index.ts:132-147`、`mutation-local.ts:266-310/312+`。无死引用、无旧 API、无前后相反描述。
- §12 探针行如实声明「预期 G1.1/G1.2 翻红」并与 §13 残余 1 同口径——正文与附录一致，非伪修订。

## 7. 状态机与并发攻击

接缝是同步纯函数（无持久状态、无状态机、零共享可变、零 IO/时钟/网络）。攻击面收敛为「同输入恒同输出 + 输入不可变」：

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| S1 | 任意 | 重复调用/重试（同 plan/facts/payload） | 判决逐字节恒同 | 无（§9 明示；fixture 种子冻结可复现） | — |
| S2 | 任意 | 并发调用 | 无共享态 → 无竞态 | 无（一切中间态调用局部：合成视图、ref memo 均 per-call） | — |
| S3 | 任意 | 调用后检查 plan/derived | 输入零突变 | 无（A2 契约断言 plan JSON 前后比对；设计 §9 资源所有权明示只读） | — |
| S4 | 接缝外 | 迟到回调/取消/重启 | 不适用（无异步、无注册、无生命周期） | 无 | — |

对照 legacy 全量流（§8.3 第二行）如实标注「本票不动」，负控 NC1/NC3/NC7 锚定——无伪降级。

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| E1 | 违约计划（union map/target/array/手造 kind/relPath≠[key]/parent+set） | 闸门 fail closed：`ok:false` + 响亮 issue + 指路 legacy 轨；不抛、不静默 ok（§8.1 ①、§9） | 低——F2/F3 全组断言已核可满足；失败方向 = 多验证非漏验证 | — |
| E2 | 违约载荷（array-* 混入）/违约事实（has 非布尔） | 载荷词表守卫/载体域事实守卫 fail closed（§8.1 ②③） | 低——F3 badPayload 断言已核 | — |
| E3 | 手造派生物 ref 环/缺名、两树分歧、深嵌套 | `wrapElementwise` 收编单条 `VFSL-E100`（与 #435/全家同款，§9） | 低——D4 的 `walkRefChain` 异常路径与 legacy `resolveValues` 同算法同文案（`validate-patch.ts:78-86` vs `validate.ts:137-145` 双透镜实核一致） | — |
| E4 | 静默 `ok:true` 伪成功路径 | 不存在：闸门/守卫/缺字段/域规则全响亮；「无静默 fallback」为 §9 显式条款且经变异实验 M1b–M4（4/5/10/4 红）反证断言敏感 | 低 | — |
| E5 | 对抗输入：`__proto__` 键 / `undefined` 新值 / 空串键 / 整数形态键 | 计算键展开落自有属性（文件头纪律 L25-26 实核）；undefined 过值 schema 响亮型错（与 legacy `{...base,[key]:undefined}` 同构——本评审核对 `validateObject` Record 形态用 `obj[k]` 直读非 `present()`，两侧同判）；单键视图无跨键序问题 | 低 | — |
| E6 | 消息漂移（兼容面） | 既有语义 message 经 `validateSubtree` 单源继承零复制；唯二域规则文案（no-op/必填缺失）为同文件字面复用，由 NC1.3/NC1.4 冻结常量 + E1 oracle 逐字节比较双锚 | 低（见观察 2） | — |
| E7 | 回滚 | 纯加法：移除 #440 节 + 三行导出即回 HEAD 行为；无迁移/持久化/wire 面（§13） | 无 | — |

正常路径不变量（接受/拒绝结论 + issue 字节在合法基线上不变）不以 fallback 掩盖；刻意例外（触达面收窄）显式立法并有 E2/E3/NC7 对照基线。

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| `@nomicore/vfsl` 公共面（+1 值导出 +2 类型导出） | 无。编译期纯加法；本评审排查全部既有 guard：NC5.1（23 名超集）、`render-projection-text-control` C1（20 名超集）、`issue-435` NC6（7 名超集）、`validate-number-domain-narrowing` AC6（6 个内部名负锚）、`validate-logical-snapshot` AC2（旧名负锚）——无任何精确总数断言，加法零破坏 | `index.ts:132-147`；上述测试文件实读 | — |
| `applyElementwiseArrayMutation`（#435 冻结签名） | 无。设计 §7.1/§10 明示不动；NC5.2 锚定 | `validate-patch.ts:1079-1136` | — |
| `planMutationBoundary` / `applyMutationAtBoundary` / `validateSubtree` / `validatePatch` 家族 | 无。零改动（§7.1）；legacy 轨行为由负控 NC1–NC7 恒绿锚定 | `validate-patch.ts:623-698/739-822/926-1012` | — |
| doc-runtime `mutation-local.ts` `case 'record'/'parent'`（未来主要消费者） | 无弱处理：本票零改动（§11 行 2 实核 `:266-310` 现状 = S5 walk → S6 apply → S9 重投影）；#441 接线模板指向 `case 'array'` 先例（`:312+` fast path 五步 F1–F5 实核同构） | 源码实读 | — |
| `#442` lease 端到端（间接受益） | 不在本票（Blocked-by 链） | SA6 §10 | — |
| 返回/抛错/nullable/异步/取消/生命周期 | 全部不变（纯加法新面，同步纯函数） | §11 末行 | — |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| Record/parent 逐 entry 判定语义 | `@nomicore/vfsl`（校验语义 Owner；载体关切归 doc-runtime） | `validate-patch.ts` #440 节 | 正确。与 #435 数组位同文件同布局；零 Yjs 关切（包纪律） |
| 载体检查 / 在场性 O(1) 事实采集 | doc-runtime（#441 接线） | §11 行 2 显式移交 | 正确。`facts = { has: Y.Map.has(key) }` 只出现在 #441 列 |
| 判定语义单源 | `validate.ts` 共享解释器 | D2 经 `validateSubtree` 继承（内部导出 `validate.ts:768`，唯一 caller = validate-patch.ts 注释实核） | 正确。无第二解释器 |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| 数组逐元素接缝（#435/ADR 0033） | `applyElementwiseArrayMutation`（`validate-patch.ts:1079-1136`：闸门三条件 → 事实守卫 → 载荷守卫 → 域规则 → 逐新值 → `wrapElementwise`） | 同构管线 + 同命名族（`EntryCarrierFacts`/`ElementwiseEntryMutationPayload` 对 `ArrayCarrierFacts`/`ElementwiseArrayMutationPayload`） | 一致 | ADR 0034 §6「复用而非另起平行机制」的直接满足 |
| SA6 见证实现（可达性证明） | 探针 `witness()`（record = 单 entry 视图过 legacy；parent = 静态必填） | D2/D4 即见证语义面的直接实现，且 D4 补齐见证未做的 ref 链解析（更贴近 `resolveValues` 单源） | 一致且更严 | 探针 REF L91-124 实读比对 |
| 路径级接缝（#53/#237） | `validatePatch`/`planMutationBoundary`/`applyMutationAtBoundary` | 不复用不修改（纯加法并列新面） | 一致 | 词表与结果形状（`ValidateResult` 直出）同族 |

未发现「已有扩展点可用却新增平行通道」：record/parent 逐 entry 判定在包内确无既有载体（G1 导出普查 + 本评审 grep 复核）。

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| Record 判定语义（键 Pattern/值/消息/序/截断/预算） | `validate.ts` 解释器 | 无镜像（D2 直调） | 无 |
| 封闭对象必填语义 | `validate.ts:670-682` | D4 镜像该循环（同文件同款 `valueLens` 文案） | 低——NC1.4 常量 + E1 逐字节双锚，漂移即红 |
| delete 域规则文案 | `validate-patch.ts:974` | D3 同文件字面复用 | 低——NC1.3 常量锚 |
| 计划形状 | `planMutationBoundary` | 接缝只消费不重算 | 无 |

无第二状态字段、无文件 marker、无标签反推。

### 生命周期对称性

纯函数无 register/dispose、订阅、事务或后台任务；无资源需释放（合成视图调用局部即弃）。回滚 = 删节（§13）。不适用面全部如实标注。

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 第二套校验解释器 | `validateSubtree` | 无（直调） | 不构成 |
| 第二套崩溃边界 | `wrapElementwise`（#435） | 复用同款 | 不构成 |
| 第二套域规则 | legacy `applyMutationAtBoundary` delete 支 | D3/D4 复用冻结文案（非新协议） | 不构成（见观察 2） |
| 第二套测试入口 | 根 vitest include | 冻结测试已在真实发现面（SA6 §14 收集性证据） | 不构成 |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW：`packages/vfsl/src/validate-patch.ts`（#435 节后追加 #440 节） | 与 #435 实现提交 `006e416` 的生产面（仅 validate-patch.ts + index.ts，`git show --stat` 实核）同款范围 | — |
| ALLOW：`packages/vfsl/src/index.ts`（导出块 +3 名 + 注释行） | 包纪律「公共 API 只经 src/index.ts」；AC5 | — |
| ALLOW：`artifacts/sa3-issue440-*.log` | 仓库既有实现证据惯例（`006e416` 含 `artifacts/sa3-issue435-*.log` 先例） | — |
| DENY：四个 SA6 冻结测试文件（md5 登记）+ 探针 + SA6 报告 | SA6 §16 指纹；设计 §10 逐文件列 md5 | — |
| DENY：`validate.ts`/`derived.ts`/`resolve.ts`/`pattern.ts`、#435 测试、doc-runtime/namespace-runtime、ADR/CONTEXT.md/docs | 设计零改动主张逐项核验成立：所需私有助手（`singleIssue`:1060、`wrapElementwise`:1139、`valueLens`:78、`walkRefChain` import:36）已全部在场于 `validate-patch.ts`，无需扩面；CONTEXT.md L144 已随 HEAD 立法「非 union Record 位与封闭对象 delete 自 ADR-0034 起走逐 entry 校验」（实核），实现不改变任何规范文档的既述契约 | — |
| ALLOW 无无理由扩张；DENY 与正文零冲突；follow-up（#441/#442）未掩盖本票必要项 | §1 非目标 ↔ §10 ↔ §11 三处互洽 | — |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1/AC2/AC3（B/C/D 组 18 tests） | 冻结契约断言（期望 = 冻结常量或 oracle 逐字节）；本评审逐条手工推导设计行为可满足（B2 恰 1 issue、B4 两 issue 键先值后、D1 恰 1 issue、C5 仅 no-op、B6 has 翻转恒同等） | 无 | — |
| AC4（E1–E3 + NC4） | 107 等价例逐字节 + 10 触达面可分 + census 非空；判据敏感性经 4 变异（4/5/10/4 红）与 A/B 判别反证 | 无 | — |
| AC5（A1/A2 + test-d + NC5） | 公共面自有导出键断言 + 类型面正/负夹具（3 条 `@ts-expect-error` 在 D1 类型下均必命中——本评审逐条核型） | 无 | — |
| AC6（根 gates） | SA6 §13 绿判据：契约 26/26、负控 19/19、test-d 转绿、根 typecheck exit 0、根 test 全绿；测试发现面实核（vitest include + typecheck include） | 无 | — |
| 旧实现真红 | HEAD 契约 26 红（红因单一 `能力缺口：@` × 26，5 轮 md5 恒同）+ 基线 466/5667 全绿——非伪红 | 无 | — |
| 错误路径伪绿 | 干跑 26/26 + 变异敏感（E9）排除恒真；零 skip/env/fallback/源码字符串断言（SA6 §12.5 + 本评审通读两测试文件确认） | 无 | — |
| 探针翻红口径 | §12 末行 + §13 残余 1 预声明 G1.1/G1.2 翻红（本评审实读探针 L148-157 确认该两项断言导出缺席，实现后必然翻红），绿判据以契约/负控/test-d/根 gates 为权威 | 无阻断（见观察 1） | — |

SA1 不编写/运行测试、角色分工正确；所有「所需测试」已由 SA6 落位且位于仓库真实入口。

## 13. Required revisions

无 BLOCKER / 无 MAJOR。无阻断修订项。

## 14. Non-blocking observations

1. **[MINOR] 探针 G1 翻红与 SA6 §13 绿色判据字面冲突的处理口径**：SA6 §13 绿色判据字面包含「探针 exit 0」，而冻结探针 G1.1/G1.2 断言的正是新导出**缺席**（`task_issue-440_sa6_capability_probe.mts:148-157` 实读）——实现后探针必然 exit 非 0，该字面判据不可同时满足。设计 §12/§13 残余 1 已如实预声明并给出权威解释（契约 26/26 + 负控 19/19 + test-d 转绿 + 根 gates；探针为 wiki 证据、不在 vitest 发现面）。接受该解释；建议 Controller 把此口径显式传递给 SA4/SA7，避免验收阶段按字面误判。
2. **[MINOR] 两处域规则文案的同文件字面复用**：D3 的 `delete 目标键不存在（拒绝 no-op）` 与 D4 的 `缺少必填字段 "${key}"` 无法经 `validateSubtree` 继承（域规则住在 `applyMutationAtBoundary`，其判定绑在父值重建后），只能字面复用。设计已以 NC1.3/NC1.4 冻结常量 + E1 oracle 逐字节比较双锚定漂移风险（§13 风险表），且契约测试本身把这两条消息硬编码为字节常量——漂移必然响亮红灯。可选优化：在 `validate-patch.ts` 内提取模块级常量供新旧两支共用（不改公共面、不触 DENY），把「双锚」收敛为「单源 + 单锚」；非必需。
3. **[MINOR] 闸门 message①–⑥ 为新面文案建议**：与 SA6 §15.3「不冻结闸门文案」一致，实现可微调措辞；仅受 `ok:false ∧ issues.length>0 ∧ 不抛` 约束。设计的建议文案家族风格与数组位对齐（`validate-patch.ts:1088-1098`），无行动项，仅备案。

## 收尾

设计通过独立攻击审查：需求/上游事实/ADR 义务全覆盖、无范围蔓延、内部零矛盾、纯函数面无状态与并发缺口、错误面全响亮无伪成功、调用方与既有 guard 零破坏、责任归属与 #435 先例同构无平行机制、文件范围纯加法且 DENY 逐项可执行、验收全部落在已冻结且可满足的真实测试入口。同意 `requiresConflictRecheck: true`（设计 §15 自陈：公共 API 加法 + iteration 0 无 SA8 预检工件；本评审对 ADR 0007/0016/0021/0033/0034 的交叉核对未发现新冲突，预期复查结论为无冲突）。
