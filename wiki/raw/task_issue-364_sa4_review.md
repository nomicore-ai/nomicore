# SA4 实现静态审查 — issue #364（T2 readData 投影文本化原子切换）

- 角色：SA4（Red Team Hacker / 实现静态审查）· dispatch `sa-1b18e8a3-7944-4508-a53a-590acac46d0e` · iteration 0
- 审查对象：SA3 iteration 1 工作树未提交实现（28 modified + 5 untracked 测试文件，`git diff --stat` = +1417 / −1085），基线 HEAD `f8a06fe`（分支 `mabf/issue-364`）
- 审查方式：只读静态审查——逐文件实读 diff 与当前源码、grep/符号级复核、SA3 证据 log 逐份复读；**未修改任何实现/测试/文档**，未运行测试（绿证据取自 SA3 log 复读 + 结构面独立复核）
- Issue REST comments：空（dispatch 明示 none）——无 owner 逐字判据

## 1. Reviewed inputs

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| `wiki/raw/task_issue-364.md`（Host brief） | 在场 | What-to-build 5 条 + AC 10 条（判据全集之一） |
| `wiki/raw/task_issue-364_sa6_contract.md`（approve） | 在场 | CT-1..CT-10、附录 A/B/C、U1–U7、M1–M8 |
| `wiki/raw/task_issue-364_design.md`（SA1） | 在场 | §7-D1..D9、§8 接口/数据流、§11 ALLOW/DENY、§12 验证映射 |
| `wiki/raw/task_issue-364_sa2_review.md`（approve，O1–O6） | 在场 | 非阻断观察的落实核对（O1 caveat/O2 C6 约束/O5 helper 签名/O6 A1 假红规避） |
| `wiki/raw/task_issue-364_relevant_decisions.md` + `_conflict_report.md`（SA8 iteration 0，clear） | 在场 | 冻结面 11 项、W1–W4、必行动作 2（CT-8 解释采纳） |
| `wiki/raw/task_issue-364_implementation_conflict_report.md`（SA8 实现后复查，clear） | 在场 | 实现面冲突裁决 20 项 + 冻结面 14 项零改动结论（本审查交叉复核） |
| `wiki/raw/task_issue-364_sa3_impl.md` + 9 份证据 log | 在场 | 实现报告、red/green/typecheck/root-test（双轮）、M1 受控突变探针 |
| `docs/adr/0027/0016/0024`、`CONTEXT.md`、根/包 AGENTS（runtime/registry/vfsl） | 实读 | 权威契约、词表、包边界（公共面只交付 detached 投影、读在 sequencer 外） |
| 实际 diff（`git status --porcelain` 33 路径 + 逐 hunk 实读） | 实读 | 本审查的审查对象本体 |

## 2. Verdict

**approve** —— 无 BLOCKER、无 MAJOR。实现忠实落实 SA1 设计 D1–D9 与 SA6 契约 CT-1..CT-10 的可执行面；冻结面（含 SA8 iteration-0 全部 11 项与实现后复查新增 3 项）经本审查独立复核**零改动**；组合层零 cast、clone 符号全仓归零、两联合未合并（CT-8 解释正确落地）；仓内消费面翻新完整（残留 `truncations` 仅值通道 oracle 与 `@ts-expect-error` 负例）；测试先红后绿、oracle 独立构造、无 skip/only/todo，红点可归因；根 typecheck / 根测试双轮 exit 0 与工作树状态自洽。4 条 MINOR 观察见 §12，均不阻断。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
| --- | --- | --- |
| AC1 成功分支恒四键、`truncations` 键退役（负控） | `runtime.ts` 两处组装删 `truncations` 键位（legacy L578–584 / 预算 L605–611）；单一内部 `ReadDataOkResult` 四键形；A1/A2 运行时负控（`'truncations' in r === false` + `JSON.stringify` 词汇）+ H3 类型面 `Extract<…,{truncations:unknown}>===never` × 6 处 | 落实 |
| AC2 `schema` ≡ 头行 + `renderProjectionText(resolveSchemaAtPath(derived,…), truncations)` | B1/B3 双夹具矩阵（10+14 路径 × 9 预算 = strict/raw 共 216 格）逐字节 `===` 对照独立编译 oracle（`compileSchemaEnvelope` → `resolveSchemaAtPath` → `renderProjectionText`，模块级 `DERIVED_336` 独立构造） | 落实（B5 反向锚在场） |
| AC3 头行事实性（实参 path + 预算；无预算省略） | `headLine` 实现逐字节符合附录 A（含 W1 对齐：空路径 `# readData []`）；C1–C7 全组在场（空路径/多段/数字段/实参非别名/预算段三形/canonical 等价/行注入折叠/null 无头行） | 落实 |
| AC4 `truncated` 语义与 ✂ 段一致 | 预算分支逐字段透传 `result.truncated`、legacy 硬编码 `false`（无 OR 合成——U2 契约口径）；D1/D3/D4/D5/D6/D7 在场（width-only ‡ 缺席对偶、null×预算诚实共存、值通道 oracle 直调对照） | 落实 |
| AC5 `schema:null` 三情形单义；失败分支形状语义不变 | E1 三情形严格 null（非空串）、E2 敌意 trap 零调用（迭代器零调用 + Proxy Symbol.iterator 读计数 >0 但不调用）、E3/E4 lifecycle 定序、E5 InternalError 逃逸（构造名断言）、E6 敌意零 throw；A4 失败分支恰 `{ok,code,path,message}` | 落实 |
| AC6 options 闭合形状零变化 | F1 十三类非法矩阵 → `READ_OPTIONS_INVALID` 恰四键失败形；F2 差分矩阵 ≡ `readLogicalValueAtPath` 权威；F3 canonical 等价全文逐字节（含 `Object.prototype` 污染防护用例）；registry B′2 raw options 同一引用 + 敌意 Proxy get trap 零触达；生产代码 `canonicalReadOptions`/`seamReadOptionsInvalid`/lifecycle gate **零改动**（diff 符号扫描 0 命中） | 落实 |
| AC7 detach 深拷贝层退役 + detached 行为锚 | clone 家族 6 符号全仓 grep 0 命中（本审查独立复核）；G1（`typeof === 'string'`、JSON 无 `"valueSchema"`/`"aliasDocs"`）、G2（连续/交错读逐字节、改写 `r.value` 后文本不变）；G4 类型锚 `string \| null` 在 test-d | 落实 |
| AC8 仓内全部消费测试翻新 | 20 文件翻新 + 5 新契约文件 + 7 helper 随动文件零编辑通过；phase5 L271 两键伪形 → 四键（建议同步项已做）；收敛门 family A/B = 0（含退役五键识别）；残留 `.truncations` grep 全部为值通道 oracle 或 `@ts-expect-error` 负例 | 落实 |
| AC9 作用域文档 + fixture 词汇重录 | 三文档重录（typed-access 四键/投影文本/✂ 载头行/truncated 机器信号；cordis 四键 + 文本样张 + 跨 realm 节零触碰；codegen L288 恒四键 + `.value` 适配器零代码变化明示）；**L127 预算纪律整句逐字保留**（HEAD L128 → 工作树 L127，本审查双版本 grep 比对一致）；fixture 六谓词重录（R3′/R4′、`staleAnnotationViolations` 双向、`adr0016Refs` 放宽为 0027 ∧ 0016/0024、新增 J4 `retiredVocabularyViolations`）；ADR-0016/0024 权威源健全性门**保持在场**（L369/L376）+ 追加 ADR-0027 门 | 落实 |
| AC10 root 全绿、版本 bump 归发布流程 | 根 typecheck `TYPECHECK_EXIT=0`（14 tsconfig）；根测试 clean 轮 386 files / 4607 tests / Type Errors: no errors / `ROOT_TEST_EXIT=0`（606.78s）；`git diff -- '**/package.json'` 0 行、无 lockfile/publish 改动 | 落实 |
| SA8 必行动作 2（CT-8 解释采纳） | 两联合**未合并**：`NamespaceRuntimeReadDataResult = ReadDataOkResult \| ReadLogicalValueFailure \| RuntimeReadDisabledResult`、预算联合失败面分立；零泄漏注释原文在场（「该联合**不含** READ_OPTIONS_INVALID…」）；重载序 legacy 最后（`ReturnType` 取末签名）；`ReadDataOkResult` 未公共导出 | 落实 |
| SA8 W1/W3 决断落地 | 空路径 `# readData []`（C1/附录 B 口径，附录 A 伪公式字面 `[[]]` 未采用）；`ReadLogicalValueTruncationEntry` 转出退役（index.ts 注释记录理由 + 直依 doc-runtime 替代路径）；仓内原唯一消费者 Equal 锁随票删除 | 落实 |
| SA2 O1–O6 处置 | O1 caveat 在 `typed-access.md`（消歧句后紧接 null×预算诚实句 + ADR-0027 known limitation 引用）；O2 C6 只断折叠/行数不增；O5 helper `readDataOk(value, schema, truncated = false)`；O6 夹具键域无 `truncations` 业务键；O4 以内容锚复核纪律句成立 | 落实 |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
| --- | --- | --- | --- |
| D1 组合单点升格（保留函数名、`string\|null`、预算重载第 4 参、守卫序逐位相同、InternalError 逃逸面扩盖渲染器零 catch） | `read-schema-projection.ts` L67–102（状态守卫→`normalizeReadPath`→resolver 两/三分流→`assembleProjectionText`）；try 仅包敌意扫描（L198–214 原样） | 一致 | — |
| D2 头行规格（pathText/foldSegment/budgetSuffix 键序逗号、空路径 `[]`、敌意单读快照、行注入折叠） | L141–177：`headLine` + `ownAxis` + `foldSegment`；段值取自规范化快照（`normalized` 传参） | 一致；`ownAxis` 为实现级加固（设计内——canonical 产物只含 own 键，own 读取防原型链污染，SA3 Deviation 3 已登记，不改契约语义） | — |
| D3 类型坍缩（单一 `ReadDataOkResult`、联合名/零泄漏注释/重载序保留、投影类型导入移除、registry 别名自动跟随、Equal 锁原文保持） | `runtime.ts` L146–172（新增内部类型 + 两联合）；registry `types.ts`/`lease.ts` diff 全部为 JSDoc（类型体与透传代码零变化；`_readAlias`/`_readBudgetAlias`/`_readOverloadOrder` 未出现在 diff） | 一致 | — |
| D4 detach 退役（clone 家族删除、渲染器直读、文本天然隔离） | 原 L134–303 整段删除（diff −216 行）；全仓符号 grep 0 命中 | 一致 | — |
| D5 `truncations` 键删除与 `truncated` 口径 | legacy `truncated: false` 硬编码；预算 `truncated: result.truncated` 透传；无 OR 合成 | 一致 | — |
| D6 U3 转出退役 | `index.ts` 原 L46 删除 + 头注增量段（理由 + 替代路径）；导出清单其余键集不变（本审查实读 L44–60） | 一致 | — |
| D7 options 闭合形状零变化（负控设计） | 生产 diff 中 `canonicalReadOptions`/`seamReadOptionsInvalid`/`readDisabled`/失败短路零出现；唯一接触点 = 预算成功点多传 `canonical.options` + `result.truncations` 两跳 | 一致 | — |
| D8 文档与 fixture 词汇重录 | 见 §3 AC9 行；O1 caveat 就位 | 一致 | — |
| D9 仪器四键化 | `READDATA_OK_KEYS`/`ReadDataOkShape`/`readDataOk`/`expectReadDataOk` 四键 + 删 truncations 参（反伪绿双侧独立构造保留）；`SUCCESS_SHAPE_KEYS` 四键 + `RETIRED_SUCCESS_SHAPE_KEYS` 五键陈旧识别（family B 元数判定随动）；收敛门正负样本重录（四键正样本、退役五键正样本、schema 投影体四元素键集负样本不误伤） | 一致（CT-9 I2 内部措辞张力的唯一自洽读法，SA3 Deviation 2 已登记，门语义完整保留） | — |

设计明确但实现缺失项：**未发现**。

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
| --- | --- | --- | --- |
| 头行组装 + 渲染器接线 + 截断清单喂入 | namespace-runtime 组合层（ADR 0027 决策 2「组合层前贴头行」） | `read-schema-projection.ts`（单点） | 正确：维持「readData 成功分支 schema 附加单点」；头行事实源（规范化快照 + canonical）归本模块，敌意面单读 |
| 值通道预算/截断 | doc-runtime（冻结） | 零触碰 | 正确 |
| 渲染文法 | vfsl 渲染器（T1 冻结） | 零触碰（`packages/vfsl` git status 空） | 正确：头行不进渲染器 |
| lease 透传/生命周期 | registry | 仅 JSDoc | 正确（`NamespaceLease` 独立 caller capability、released 短路语义未动） |
| options 校验单源 | doc-runtime 权威 + runtime 接缝净化 | 零改动 | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
| --- | --- | --- | --- | --- |
| 组合层产出 schema 附加 | `projectReadDataSchema`（单点、守卫序、resolver 分流） | 保留函数名与守卫序，仅产出形态换文本 + 头行 | 一致 | 形态换代非结构重排；G4 类型锚要求保留函数名 |
| 头行 path 记法 | 渲染器 ✂ 段 `renderTruncations`（点分、空路径 `'[]'`、`foldText`） | `headLine` 同规则（`foldSegment` 逐字镜像 `foldText` 正则） | 一致 | 与冻结渲染器同族记法 |
| canonical 净化 | `canonicalReadOptions`（#336） | 原样复用为预算段事实源 | 一致 | 零新机制 |
| 类型面锁 | Equal 组合锁 / keyof 锁 / `@ts-expect-error`（#336/#338） | 同款姿势四键化 + 新 `.test-d` | 一致 | 沿用既有仪器与命名（`*-red`/`*-control`/`.test-d.ts`） |
| 文档负控 | contract-fixture 谓词 + sync-control/red（#273/#316） | 谓词重录 + 双向敏感性自控 | 一致 | J6 双向防关键词空转 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
| --- | --- | --- | --- |
| 截断事实 | 值通道 `result.truncations`（doc-runtime） | ✂ 段（渲染交付）；`truncated` 布尔（透传） | 无：同一清单单点喂入渲染器（D1），无第二清单/合成 |
| 活 schema | live derived（P0/SCHEMA 写槽） | 每次读重新 resolve + render 的文本 | 无：零缓存（B4/G2 锚 + 实现无 memo） |
| 有效预算 | `canonicalReadOptions` 产物 | 头行预算段（own-axis 读取） | 无：同源单点 |
| 生命周期 | state.lifecycle / released 标志 | 失败联合/短路 issue | 无：零改动 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
| --- | --- | --- | --- |
| 无新增资源获取（纯函数链、零 memo/缓存/订阅/句柄） | 无需释放；lease release 幂等 + released 短路保持 | InternalError 逃逸不留部分状态；读可重试 | 对称：本票不引入非对称生命周期面 |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
| --- | --- | --- | --- |
| 第二渲染通道 | `renderProjectionText`（T1 公共导出） | 组合层直连调用（唯一接线点，无包装） | 非平行 |
| 第二截断清单 | 值通道 truncations | ✂ 段渲染 | 非平行（交付形态，非第二事实源） |
| 第二 options 解析 | doc-runtime 权威 + canonical 接缝 | 原样复用 | 非平行 |
| 新公共 API 面 | — | 无新增导出（`ReadDataOkResult` 未导出；无姊妹方法/双通道） | 正确收敛 |

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
| --- | --- | --- | --- |
| `packages/namespace-runtime/src/read-schema-projection.ts` | 生产 #1 | D1/D2/D4 | 命中 |
| `packages/namespace-runtime/src/runtime.ts` | 生产 #2 | D3/D5/D7 | 命中 |
| `packages/namespace-runtime/src/index.ts` | 生产 #3 | D6/U3 | 命中 |
| `packages/namespace-registry/src/types.ts` | 生产 #4 | 别名 JSDoc | 命中（类型体零变化） |
| `packages/namespace-registry/src/lease.ts` | 生产 #5 | 透传 JSDoc | 命中（代码零变化） |
| 5 个新契约测试（runtime red/control/test-d + registry red/test-d） | 新契约 #1–#5 | CT-1..CT-8 | 命中 |
| 20 个存量翻新（helpers ×2、收敛门、shape-budget red/control/test-d、schema-projection red/control、hostile-path-guard、int-range、data-interface ×2、passthrough test/test-d、schema-red test-d、phase5-r2、fixture、sync-control、sync-red） | 存量 #1–#20 | CT-9/CT-10 | 命中 |
| 3 文档（typed-access / cordis-plugin-hosting / external-project-vfsl-codegen） | 文档 #1–#3 | CT-10 | 命中 |
| DENY 面（`packages/vfsl/**`、`packages/doc-runtime/**`、`docs/adr/**`、`CONTEXT.md`、版本链、runner 配置、写路径、诊断、registry index、ws-replication、apps） | — | — | `git status` 定向核对**全空**（本审查独立执行）；`git diff -- '**/package.json'` 0 行 |
| untracked：5 新测试 + 24 份 wiki/raw 产物 | — | 证据/任务产物 | 无越界（wiki/raw 为流水线产物区） |

ALLOW 中未修改路径：helper 随动组 7 文件（idle/open/create/sa7-*/shutdown）经 helper 四键化零编辑通过（125 tests 绿）——设计已预判「调用点零改或小改」，属说明项非缺口。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
| --- | --- | --- | --- | --- |
| `NamespaceRuntimeReadDataResult`/`…BudgetResult` 成功面四键化 + `schema: string\|null` | `apps/yjs-server/src/app.ts` L609（仅 `.ok`/`.value`） | 零改动；根 typecheck exit 0 机器证明 | 无 | — |
| 同上 | `packages/ws-replication/src/testing.ts` L47（bind 透传） | 零改动；根测试绿 | 无 | — |
| `ReadLogicalValueTruncationEntry` 转出退役 | 全仓 grep：无第三方从 `@nomicore/namespace-runtime` 导入该符号；原唯一消费者锁随票删除；新 test-d 改自 doc-runtime 直依 | 零仓内破坏；仓外破坏在 ADR 0027 决策 5 破坏性 minor 包络（归发布流程） | 无 | — |
| `projectReadDataSchema` 签名演化（包内符号） | 唯一调用方 runtime.ts 两处（legacy 两参 / 预算四参） | 匹配；未进公共导出 | 无 | — |
| lease 别名 `NamespaceLeaseReadData*` | Equal 组合锁原文在场（两侧同变仍相等）；registry `src/index.ts` 零改动 | 自动跟随 | 无 | — |
| 测试替身/工厂 | `readDataOk(value, schema, truncated = false)`：registry 树 7 helper 使用文件零编辑通过（现存调用点全部 ≤2 参） | 零编译破坏（root typecheck） | 无 | — |
| 文档匹配器消费方 | fixture 六谓词 + 新增 J4；sync-control/red 双向敏感性自控样本 | 双向重录（新词正样本命中、旧词负样本被检出） | 无 | — |
| DSH 会话级只读探针（仓外） | 输出形态随包升级自然变化 | ADR 0027 决策 5 明文零代码改动 | 无（发布期事项） | — |

遗漏关键 caller：**未发现**（全仓 readData 触及面 76 文件口径下，本审查以 grep 交叉复核 `.truncations`/`schema.valueSchema`/`expectReadDataOk` 残留，仅值通道 oracle 与 `@ts-expect-error` 负例）。

## 8. 错误、恢复与并发

| 检查点 | 结论 |
| --- | --- |
| 错误吞没/伪装成功 | 无：失败分支原样透传（零形状复制）；`InternalError` 逃逸面扩盖渲染器仍零 catch（`read-schema-projection.ts` try 仅包敌意扫描，本审查实读 L198–214）；`schema:null` 是单义交付非错误掩盖（ok 恒真） |
| 静默 fallback | 无：非法 options 响亮 `READ_OPTIONS_INVALID`（F1 含 `{}` 与敌意 Proxy 不得静默 `schema:null`）；renderer/resolver 畸形 trusted 输入 throw |
| 部分完成诚实性 | 渲染器整体渲染、失败即 throw（无部分输出）；值失败短路先于投影 |
| 重试幂等 | 同参重复读逐字节相等（B4/G2）；纯观察零副作用、无回滚需求 |
| 并发/竞态 | 读在 FIFO sequencer 外、同步无 await（runtime AGENTS 边界保持）；`replaceSchema` 后文本随新 derived（B4 实测锚） |
| 敌意面 | path：`normalizeReadPath` 迭代器同一性比较不调用迭代协议（E2 计数器锚：迭代器零调用、Proxy Symbol.iterator 读 >0）；options：canonical 零 `[[Get]]` + 头行 own-axis 读取（原型链污染防护，C5/F3 用例在场）——敌意对象单读纪律保持 |
| TOCTOU/双写/stale | 零缓存零 memo；canonical 快照一次成型 |
| close/dispose 竞态 | lifecycle gate 先于一切 options 读取与 doc 触碰（E3 敌意 descriptor trap 计数 = 0） |

静态无法确认项列入 §11。

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
| --- | --- | --- | --- | --- |
| `runtime-readdata-projection-text-red.test.ts`（新，32 tests） | CT-1 A1–A4 / CT-2 B1–B5（strict 90 + raw 126 格逐字节）/ CT-3 C1–C7 / CT-4 D1–D7 / CT-5 E1–E6 / CT-6 F1–F3 / CT-7 G1–G2 | `vitest.config.ts` include `packages/*/test/**/*.test.ts`（自动发现；SA6 E6 已实测入口真实性；GREEN log 含该文件） | 无 skip/only/todo；oracle 独立构造（B5 含反向锚：改写 derived 注释 → 期望串必变）；装置前提 fail loud（`okOrThrow`/模块级 throw） | — |
| `runtime-readdata-projection-text-control.test.ts`（新，8 tests） | 三层负控：值通道恰两键 + 截断两形态 + 缺席吸收；失败面/能力面（closed 后三 getter throw、getStatus 可观测）；T1 头行归属对照 | 同上 | 头注「旧实现与目标实现下都必须绿」措辞略宽（负控层 2 首条含目标形状断言）——SA3 Deviation 7 已登记，断言本身正确且必要 | MINOR-1 |
| `runtime-readdata-projection-text.test-d.ts`（新） | H1（两联合成功成员同型四键 keyof Equal）/ H2（`string\|null` 精确、boolean）/ H3（`Extract never` + `@ts-expect-error` ×4）/ H5（doc-runtime 保持性守卫）/ H6（零 cast 可赋值 + 双向同构抽检） | `test.typecheck.include` + `tsconfig.typecheck.json`（GREEN log Type Errors: no errors） | 无 | — |
| `registry-readdata-projection-text-red.test.ts`（新，6 tests） | A′1–A′4 真实 Registry 装配（lease ≡ runtime `toStrictEqual` 逐字段、头行/✂/null）；B′1 released 短路恰三键 + 零 runtime 触达 + 同参单例；B′2 raw options 同一引用 + 敌意 Proxy trap 零调用 + 单参 legacy 通道 argc=1 | 同上 | 无 | — |
| `registry-readdata-projection-text.test-d.ts`（新） | H4 镜像：别名组合锁 Equal / 重载序 legacy 最后 / 零泄漏双锁 / released issue 恰三键 | 同上 | 无 | — |
| 收敛门 + 扫描器 | family A/B 归零；四键/退役五键双正样本命中；schema 投影体四元素键集负样本不误伤；`filesScanned ≥ 80` 防仪器空转 | GREEN log（24 tests） | 无（CT-9 I2 张力按唯一自洽读法落地，门语义完整） | — |
| 存量翻新 20 文件 | 恒五键/深等/`r.truncations` → 四键/文本 oracle/✂/`‡`；失败分支字面断言保持（`registry-open` L959/L1002–1006 零改动——I4）；phase5 L271 四键（I3）；I5 失败面无新键锁保持 | GREEN log 22 files / 346 tests + root 386/4607 | 无 | — |
| 文档门 | 行为锚（真实 lease 四键 + 文本头行）+ 匹配器双向自控 + ADR-0016/0024/0027 权威源门 | GREEN log | 无（J7 watch 项闭合：ADR 门在场且绿） | — |
| 红灯真实性 | red log（21:44:48）：22 failed / 16 passed，失败签名 = 恰四键断言 received 多 `truncations`、`schema` 为 object（`startsWith` not a function）、`toBe` 对象恒假——红点全部可归因目标形状/文本面 | exit 1 | red log 时间戳早于部分测试终稿（≤21:55:11）——红灯证据对应中间测试态；敏感性由 SA6 E2 HEAD 探针 + SA3 M1 受控突变（A2/B1/B3 击穿，2 failed / 30 passed，sha256 还原 + 复跑 32 passed）独立闭环 | MINOR-2 |
| M1–M8 突变全表 | SA3 仅做 M1 sanity probe（自证非伪绿），M2–M8 明示归 SA7（报告 §Deferred verification 不代跑不伪造） | — | 契约要求实施期必做；静态审查不替代 | §11 动态项 1 |

## 10. Required revisions

无 BLOCKER、无 MAJOR finding。

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
| --- | --- | --- | --- |
| M2–M8 突变敏感性全表未逐条执行（SA3 仅 M1：schema 返对象 / 删 truncated / 去头行 / ✂ 失真 / 头行打印别名 / 敌意 null 收敛失效 / detach 复活） | SA7（契约 §12.11 指定执行者） | 每突变至少击穿对应 CT 断言组，还原后全绿 + sha256 比对 | 任一突变未击穿对应断言 → 测试面存在盲区，须回补断言 |
| released lease 完整生命周期 + DSH 仓外探针输出形态（object → string）实际消费 | SA7 / 发布流程 | 探针零代码改动下输出自然切换、无解析崩溃 | 仓外消费方对 string 形态抛错且无迁移路径 |
| C5/F3 的 `Object.prototype` 污染用例依赖 vitest 单文件隔离拓扑 | SA7（root 全量已绿一轮） | 污染在 try/finally 内同步完成、不外溢同进程其他文件 | 若 runner 拓扑改为同进程多文件串行且断言闪红，需将污染用例迁入独立文件 |
| 发布期破坏性 minor bump 与外部消费面 | 发布流程（AC10 归属） | 版本 bump + changelog 记录 `schema` string 化与 `ReadLogicalValueTruncationEntry` 转出退役 | 未 bump 即发布 → 违反 ADR 0027 决策 5 |

## 12. Non-blocking observations

| # | 观察 | 证据 | 建议 |
| --- | --- | --- | --- |
| MINOR-1 | control 文件头注「三层负控（旧实现与目标实现下都必须绿）」措辞略宽：负控层 2 首条用例含 `expectReadDataOkKeys(success)` 与 `truncations` 缺席断言，旧实现下会红（属目标形状断言）。SA3 已作为 Deviation 7 登记，断言与 SA6 附录 C「负控/回归锚」定位及设计 Step-1c 一致，不需修改 | `runtime-readdata-projection-text-control.test.ts` L5–13 vs L98–101 | 后续维护时收窄头注措辞（非本票义务） |
| MINOR-2 | red log（21:44:48）早于部分测试文件终稿（≤21:55:11）与 `runtime.ts` 的 M1 突变触碰（22:09:25）——红灯证据对应中间测试态；红→绿性质已由 SA6 E2（HEAD 探针 P1 红）+ SA3 M1 受控突变（复挂 `truncations` 即红、sha256 还原、clean 轮根测试 22:19–22:29 零失败）独立闭环 | 本审查 stat 时间戳 + `task_issue-364_sa3_red.log` / `…_m1_probe.log` / `…_iter1b_root_test_clean.log` | 信息性登记；SA7 验收时以 M1–M8 全表为准 |
| MINOR-3 | `ownAxis` 超出设计 §7-D2 字面（「canonical 净化产物」）的 own 属性读取是实现级加固——canonical 输出本身只含 own-enumerable 数据属性，故该读取在生产路径上无行为差异，仅防御内部直调者传原型污染对象；`options[key]` 在 own-key 前置检查后仍走 `[[Get]]`，对假想的 own accessor 输入会调用 getter，但该输入域在包内不可达（唯一调用方传 canonical 普通对象） | `read-schema-projection.ts` L164–172；runtime.ts 唯二调用点 L581/L608 | 信息性登记；若未来 `projectReadDataSchema` 被更多内部调用方使用，可考虑 descriptor 读纪律对齐 |
| MINOR-4 | 测试侧多处 `r.schema as string` / `as Record<string, unknown>` 窄化断言（red/registry-red 等 7 处）——测试面 narrowing，不违反「组合层零 cast」纪律（该纪律作用于生产 src，本审查确认生产 diff 零新增 cast：`git diff \| grep '^\+.* as '` 仅测试文件命中） | grep 实测 | 无需动作 |

## 收尾

- 本审查未修改任何实现、生产代码、测试或文档；唯一写入 = 本文件（`wiki/raw/task_issue-364_sa4_review.md`）。
- SA8 移交项（clone 符号 AST/符号级证据、零 cast 全量核对）已由本审查闭合：全仓 `detachReadSchemaProjection|cloneValueSchema|cloneDiscriminator|cloneNumberRecord|cloneDocsRecord|cloneValueSchemaRecord|CloneMemo` grep 0 命中；生产 diff 零新增 cast；`ReadLogicalValueTruncationEntry ↔ ProjectionTruncation` 零 cast 透传（结构类型 + H6 双向锚）。
- SA8 实现后复查（`task_issue-364_implementation_conflict_report.md`，clear）的冻结面 14 项结论与 W1–W4 闭合结论，经本审查在 diff 上独立复核一致；未发现新的 ADR 冲突风险，`requiresConflictRecheck = false`。
- 未运行测试、未启动服务、未 curl、未创建临时进程；未执行任何 git 写操作。
