# SA10 Spec 审查报告 — issue #364（T2 readData 投影文本化原子切换）

- 角色：SA10（独立 Spec 审查）· dispatch `sa-56d3b946-8af8-4791-b72f-a7ec7ea48f4d` · phase spec-review · iteration 0
- 审查对象：已提交最终 diff `f8a06fea4285a61bf0f48570b0269d47dfa03fb0..HEAD`（commit `1a72b98`，分支 `mabf/issue-364`；父 PR #362 head 已核实 = f8a06fe，与 dispatch 一致）
- 判据来源：issue #364 正文（What-to-build 5 条 + AC 10 条）、SA6 验收契约 CT-1..CT-10 + 附录 A/B/C、ADR 0027 决策 1/2/3/4/5、SA1 设计 D1–D9；issue REST comments 为空（无 owner 追加要求）
- 审查方式：只读静态审查生产 diff / 测试 diff / 文档 diff + 核对 SA3 红绿日志、SA4 审查、SA7 动态验证、SA8 复查产物；未运行测试、未改动任何文件

## 1. 验收标准逐条核对（AC1–AC10）

| AC | 判定 | 证据 |
| --- | --- | --- |
| AC1 成功分支恒四键；truncations 不在场（负控） | **met** | `runtime.ts` 两处组装点坍缩为 `{ok,value,schema,truncated}`；单一 `ReadDataOkResult` 供两联合共用；`runtime-readdata-projection-text-red.test.ts` A1–A4 锚 own 键集 sort、无 symbol、`'truncations' in r === false`、JSON 无该词；类型面 H1/H3 `Extract<…,{truncations:unknown}> === never` + `@ts-expect-error` 负例双锁 |
| AC2 schema ≡ 头行 + `renderProjectionText(resolveSchemaAtPath(derived, normalized, options), truncations)` | **met** | `read-schema-projection.ts` `assembleProjectionText` = `headLine(normalized, options) + '\n\n' + renderProjectionText(resolved, truncations)`；B1 oracle 经公共 API 独立求值（`compileSchemaEnvelope(ENV_336)` 模块级独立编译 → `resolveSchemaAtPath` → `renderProjectionText`），`toBe` 逐字节锚，strict 10 路径 + raw 14 路径 × 9 预算 = 216 格；B5 反伪绿（期望串绝不从 `r.schema` 反推） |
| AC3 头行事实性（实参 path + 预算；无预算省略） | **met** | `headLine` 逐字落实附录 A/设计 D2 冻结格式：`# readData [<点分 path>]` + 预算段三形（键序 depth→maxChildrenPerNode、逗号无空格）；空路径 `# readData []`（W1 对齐口径，与 C1/附录 B 一致）；段值取自 `normalizeReadPath` 普通数组快照（实参原样、敌意单读）；`foldSegment` 与渲染器 `foldText` 同规则（行注入折叠）；C1–C7 测试全锚 |
| AC4 truncated === 本次读发生过截断；与 ✂ 段一致 | **met** | 预算分支 `truncated: result.truncated` 逐字段透传（零合成）、legacy 恒 false；D1 `===` 值通道布尔、D2 `⟺ ✂ 段在场`、D3 depth 三信号齐、D4 width-only 正文无 `‡` 对偶、D5 无截断零信号、D6 `schema:null`×预算截断诚实共存、D7 值通道语义零变化 |
| AC5 schema:null 三情形单义；失败分支形状语义不变 | **met** | E1 三情形严格 null（非空串）+ ok 恒真 + value 照常；E2 敌意 trap 零调用；E3 lifecycle 恰四键失败形先于 options 触达；E4 定序保持；E5 `InternalError` 唯一逃逸通道（组合层对 resolver/renderer 零 try/catch，源码核实）；失败三分支代码路径 diff 零触碰 |
| AC6 options 闭合形状零变化 | **met** | `canonicalReadOptions`/`seamReadOptionsInvalid`/doc-runtime 校验单源零改动（diff 核实）；F1 非法矩阵响亮拒绝、F2 差分 ≡ doc-runtime 权威、F3 canonical 等价全文逐字节（`ownAxis` own 读 + present-undefined 剥离保证）、F4 lease raw options 同一引用透传 |
| AC7 detach 深拷贝层退役 + detached 行为锚 | **met** | `detachReadSchemaProjection`/`cloneValueSchema` 家族/`cloneDiscriminator`/`cloneNumberRecord`/`cloneDocsRecord`/`CloneMemo` 物理删除（L134–303 整段移除）；文本原始值天然隔离；G1 `typeof schema === 'string'` + JSON 无 `"valueSchema"`、G2 连续/交错读逐字节 + 改写 `r.value` 后文本不变 + `replaceSchema` 无陈旧；旧 `Object.isFrozen`/引用互异断言整组退役（G3 纪律执行，hostile-guard L81 冻结断言已删） |
| AC8 仓内全部 readData 消费测试翻新 | **met** | 5 个新契约文件（runtime red/control/test-d + registry red/test-d）全部在场且覆盖 CT 全组；16 必改文件全部翻新（helpers 四键化、shape-budget/schema-projection/int-range/hostile-guard/docs fixture 等）；3 建议同步项全部落实（含 phase5 L271 两键替身 → 四键）；扫描仓内残留 `.truncations` 读取仅值通道 oracle + `@ts-expect-error` 负例 + 缺席负控，零行为断言遗留；收敛门四键化且五键字面量改列负样本（family B 双识别） |
| AC9 作用域文档 + fixture 词汇重录 | **met** | `typed-access.md` 恒四键/投影文本/✂/truncated 机器信号重录，**L128 预算纪律三句原文保留**（diff 上下文核实），权威源挂 ADR 0027 + 0016/0024；`cordis-plugin-hosting.md` 四键 + 文本样张，跨 realm 节零触碰；`external-project-vfsl-codegen.md` L288 重录；fixture `staleAnnotationViolations` 双向修复（四键不红/五键必红）、`adr0016Refs` 按 J1 放宽（0027 ∧ 0016/0024）、新增 `retiredVocabularyViolations` 清退扫描；三作用域文档 grep 旧词汇（truncations/恒五键/valueSchema 交付陈述）归零；ADR 0016/0024 历史正文健全性门保持在场且未改写（J7 执行） |
| AC10 root 门禁全绿；版本号不动 | **met** | `task_issue-364_sa3_iter1b_root_test_clean.log`：386 files / 4607 tests passed / Type Errors: no errors / exit 0；`task_issue-364_sa3_typecheck.log`：root typecheck exit 0（SA7 复跑同绿）；diff 中零 `package.json`/`pnpm-lock.yaml` 改动（stat 核实） |

## 2. 公共 API 行为与失败/生命周期不变量

- **结果类型坍缩按 CT-8 解释正确落地**：两联合**成功成员同一四键类型**，联合名（`NamespaceRuntimeReadDataResult`/`…BudgetResult` 及 lease 对偶）与双重载签名保留；legacy 联合「**不含** READ_OPTIONS_INVALID（零泄漏）」注释原文在场；公共接口重载序预算在前、legacy 最后（`ReturnType` 取末签名）未动，`_readAlias`/`_readBudgetAlias`/`_readOverloadOrder` Equal 锁原文保持且编译通过。
- **lease 透传零语义变化**：`leaseReadData` 代码行零改动（仅 JSDoc 重录）——released 短路先于一切透传、active 期 raw options 引用直传；B′1 released 恰 `{ok,code,message}` 三键、B′2 引用同一性锚在场。
- **失败分支与生命周期**：lifecycle gate、值失败短路、READ_OPTIONS_INVALID 两出口的代码路径 diff 零触碰；`InternalError` 逃逸面扩盖 renderer throw（同为 trusted-domain 零 catch，符合设计 D1-5）。
- **`ReadLogicalValueTruncationEntry` 公共转出退役**：设计 U3 显式决断（SA8 W3 核准），index.ts 头注如实登记退役理由与迁移路径（直依 `@nomicore/doc-runtime`）；SA7 负向类型探针证 TS2305 闭锁。属破坏性面，见 §5 披露项。
- **值通道（doc-runtime）冻结**：diff 核实 `packages/doc-runtime/**` 零改动；H5 保持性守卫（ok 恰两键、entry 形状不变）在场。

## 3. 规范符合性（ADR 0027）与红线核对

- 决策 1（恒四键 + schema 文本化 + truncations 删除 + truncated 保留）✓；决策 2（组合层前贴头行 → 渲染器正文 → ✂，渲染器零选项冻结）✓；决策 3（头行/✂ 规范文法）✓；决策 4（detach 退役、文本天然 detached）✓；决策 5（破坏性 minor bump 归发布流程——本票零版本改动、DSH 探针零代码改动）✓。
- **T1 冻结面**：`packages/vfsl/**` 零改动（diff 核实）——渲染器 144 测试冻结基线随两轮聚焦运行全绿。
- **DENY LIST 全核**：vfsl、doc-runtime、docs/adr、CONTEXT.md、版本/lockfile、根 vitest/tsconfig、apps/yjs-server、ws-replication、namespace-diagnostic-log、registry index.ts、写路径文件——diff 全部零命中。
- **scope creep**：未发现。全部改动落在设计 §11 ALLOW LIST 内（生产 5 文件 + 新测试 5 + 存量翻新 19 + 文档 3 + 本票 MABF 证据 artifacts）。

## 4. 上游质量链核对（佐证，非重复其工作）

- SA2 设计评审 approve（无 BLOCKER/MAJOR）；SA4 实现审查 approve（4 条 MINOR 均信息性，不阻断）；SA7 动态验证 approve（M1–M8 突变全表击穿 + sha256 还原闭环，SA3 deferred 项全闭合）；SA8 实现后冲突复查 clear（冻结面 11+3 项零改动）。
- 红→绿证据链自洽：SA3 red log 22 failed（红点全部归因四键/字符串/头行/✂ 断言，received 多 `truncations`、`schema` 为 object——与 SA6 E2 红灯签名一致）→ clean 轮根测试全绿。新契约文件无 skip/only/todo（grep 核实）。

## 5. PR 必须披露的未达成/破坏性项（release 说明义务，非缺口）

1. **破坏性公共面变更（本票主旨）**：readData 成功分支恒五键 → 恒四键；`schema` 由 JSON 四件套对象改为投影文本 `string | null`；结构化 `truncations` 键删除（截断事实唯一载体 = 文本 ✂ 段）；`ReadLogicalValueTruncationEntry` 不再从 `@nomicore/namespace-runtime` 转出。**版本 bump 不在本票**（AC10 / ADR 0027 决策 5，归发布流程）——合入后发布时必须执行破坏性 minor bump。
2. **已知限制（诚实交付，ADR 0027 已知限制 2）**：`schema:null` × 预算读发生截断时键级消歧不可用，只剩 `truncated` 布尔（D6 锚 + typed-access/external-codegen 文档已如实陈述，未谎称可消歧）。
3. **遗留 MINOR（信息性，不阻断）**：SA4 MINOR-1（control 文件头注措辞略宽，断言本身正确）、MINOR-2（red log 对应中间测试态，红→绿已由 E2 + M1 + clean 轮独立闭环）、MINOR-3（`ownAxis` 实现级加固，生产路径无行为差异）、MINOR-4（测试面 narrowing cast，生产零新增 cast）。

## 6. 结论

**approve**。当前实现忠实满足 issue #364 正文全部 What-to-build 与 AC1–AC10、SA6 验收契约 CT-1..CT-10（含附录 A 字节格式冻结与 CT-8 解释）与 ADR 0027 决策 1/2/3/4/5；公共 API 行为、失败/生命周期不变量、文档义务全部达成；无遗漏、无部分实现、无错误实现、无 scope creep；§5 三项为 PR 披露义务而非验收缺口。
