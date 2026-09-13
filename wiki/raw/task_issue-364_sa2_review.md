# SA2 设计攻击评审 — issue #364（T2 readData 投影文本化原子切换）

- 评审对象：`wiki/raw/task_issue-364_design.md`（SA1 首版设计，iteration 0，基线 HEAD `f8a06fe`）
- 评审人：SA2（独立攻击评审；本文件为唯一可写产物）
- 评审日期基线：与设计同 worktree（`/home/wangjian/nomicore-fix-issue-364`，HEAD `f8a06fe` 实读复核）
- 评审纪律：只读源码/ADR/AGENTS/测试与固定流水线产物；不运行测试、不启动服务、不修改设计与业务代码

## 1. Reviewed inputs

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| `wiki/raw/task_issue-364.md`（Host brief） | 在场 | 需求全集（What-to-build 5 条 + AC 10 条；comments 快照为空） |
| `wiki/raw/task_issue-364_design.md` | 在场 | 被审对象 |
| `wiki/raw/task_issue-364_sa6_contract.md`（approve） | 在场 | 验收契约（CT-1..CT-10 + 附录 A/B/C + U1–U7 + M1–M8） |
| `wiki/raw/task_issue-364_relevant_decisions.md` | 在场 | SA8 决策摘录 |
| `wiki/raw/task_issue-364_conflict_report.md`（clear） | 在场 | SA8 冲突门禁（required action 2、W1–W4、冻结面清单） |
| `wiki/raw/task_issue-364_sa6_probe.log` / `_sa6_baseline.log` | 在场 | 红灯签名与基线证据 |
| `docs/adr/0027` / `0016` / `0024`（含 #359 amendment）/ `0008` 状态行与正文 | 实读 | 决策文本核对 |
| `CONTEXT.md` L38–58 | 实读 | 词表基准（已含投影文本/✂ 段/截断省略词条 + U4 诚实句） |
| 源码：`runtime.ts`、`read-schema-projection.ts`、`lease.ts`、`types.ts`、`index.ts`（runtime/registry）、`render-projection-text.ts`、`vfsl/src/index.ts` | 实读 | 设计锚点逐项复核（见 §5–§10 各表） |
| 测试/仪器：`readdata-ok-shape.ts`、`readdata-shape-assertion-scan.ts`、shape-budget/schema-projection red+control、hostile-path-guard、int-range、passthrough、sync-control/red、contract-fixture、phase5-r2-internal、mutate-root-sequencer | 实读（抽样行锚全查） | 翻新清单与现状耦合核对 |
| 文档：`typed-access.md`、`cordis-plugin-hosting.md`、`external-project-vfsl-codegen.md` | 实读 | D8 重录锚点核对 |
| `apps/yjs-server/src/app.ts` L609、`packages/ws-replication/src/testing.ts` L47 | 实读 | 零改动消费方核对 |

Issue #364 REST comments 为空（brief `## Comments` 节空 + dispatch 明示 none）——无 owner 逐字判据。

## 2. Verdict

**approve** —— 无 BLOCKER、无 MAJOR。设计对任务简报、SA6 契约（CT-1..CT-10、附录 A/B、U1–U7、M1–M8）与 SA8 门禁（CT-8 解释采纳、W1–W4 处置、冻结面）逐项落实且可安全实施；全部源码锚点经本评审在 HEAD `f8a06fe` 独立实读复核属实（含设计自行修正 SA6 行号引用的三处精确定位，复核均为设计正确）。5 条非阻断观察见 §14。`pass` 仅指设计通过审查；实现与活链路验证仍归 SA4/SA7。

## 3. 需求覆盖

| Requirement（issue What-to-build / AC） | Design section | Assessment |
| --- | --- | --- |
| 无条件文本化、一次调用返回 `{ok,value,schema,truncated}`（AC1） | §1 目标 1、§7-D5、§8.3 R1/R2 | 覆盖；两处组装点 + 两联合成功成员同步四键化（与 HEAD 现状 runtime.ts L572–578/L600–606、L148–172 实读一致） |
| 组装序：头行（实参 path + 预算）→ renderProjectionText → ✂（AC2/AC3） | §7-D1 步 4、§7-D2、§8.3 | 覆盖；头行规格逐字节冻结（含 W1 对齐），renderer 接线在组合层单点 |
| detach 深拷贝层退役、文本天然 detached（AC7） | §7-D4、§9 | 覆盖；clone 家族 L134–303 实读在场，删除清单与符号一一对应 |
| 结果类型坍缩、双联合成功成员同型；lease 别名跟随零语义（AC1/AC8） | §7-D3（CT-8 解释）、§10 | 覆盖；采纳 SA8 唯一自洽解释，「合并联合」列为已否决备选 A2 |
| `schema:null` 单义三情形、失败分支不带 schema/truncated（AC5） | §7-D1 步 1–3、§9 负控层 2 | 覆盖；守卫顺序（状态→敌意 path→resolver）与现状逐位相同（read-schema-projection.ts L75–94 实读一致） |
| options 闭合形状零变化（AC6） | §7-D7、§7-D2 预算段事实源 | 覆盖；唯一接触点 = canonical 成功点多传一跳，options 对象零复制零触达（canonicalReadOptions L834–861 实读核对：own-enumerable 键空间、零 `[[Get]]`、present-undefined 剥离、-0 归一） |
| 消费测试翻新（恒五键/深等 → 恒四键/文本）（AC8） | §7-D9、§11 ALLOW LIST | 覆盖；SA6 §10.2 清单 16 必改 + 3 建议同步逐文件落位，本评审 grep 交叉复核一致 |
| 作用域文档 + fixture 词汇重录（AC9） | §7-D8 | 覆盖；三文档逐行锚点 + fixture 六谓词处置（与 fixture 实读逐项一致） |
| root 全绿、版本 bump 归发布流程（AC10） | §12、§11 DENY LIST | 覆盖；DENY 明列版本/发布链 |

目标与非目标无静默扩大：非目标清单（渲染器/resolver/值通道/ADR 正文/版本号/缓存）与 SA6 §10.4 红线一致；`ReadDataOkResult` 具名导出列为 follow-up 而非本票扩张（§13 R9）。

## 4. Owner评论覆盖

Issue #364 comments 快照为空（无 comment ID / updated_at 可转写）。设计 §4 明示该事实并正确地把判据全集收敛为 issue body + ADR 0027 + SA6 CT 组。无遗漏义务。

## 5. 上游事实与SA8约束

| Fact or constraint（SA6/SA8） | Design response | Assessment（本评审独立复核） |
| --- | --- | --- |
| E1 恒五键 + object schema（probe log） | §7-D5 删键、四处组装点同步 | 复核属实：runtime.ts L572–578/L600–606 恒五键、schema 位为 detached 对象 |
| E2 红灯签名（恰四键断言处红） | §5 承接、§12 CT-1 落 A1/A2 | 复核属实（probe log 原文在场） |
| E4/E5 头行 0 命中 / 渲染器零接线 | §7-D1/D2 新增组装 | 复核属实：`# readData` 与 `renderProjectionText`（排除 vfsl/src）src 树 0 命中 |
| E3 lease 面同缺口（sync-control L145–165） | ALLOW #29 翻新 | 复核属实：该文件现行断言恰五键 + 四件套投影体 + `truncations === []` |
| E7 类型面 Equal 锁使双形态编译不可行 | §7-D3 原子切换依据 | 复核属实：shape-budget.test-d L32–39 五键 keyof 锁在场 |
| SA8 required action 2：显式采纳 CT-8 解释 | §7-D3 采纳 + 备选 A2 否决 | 落实；零泄漏注释原文保留、联合名/重载序保留（runtime.ts L146–147/L215–221、lease.ts L410–421 实读一致） |
| SA8 W1：附录 A 空路径伪公式与 C1/B 张力 | §7-D2 设计冻结 `# readData []`（C1/B 口径） | 落实且正确：伪公式字面代入得 `[[]]`，操作性断言 C1/附录 B 样张均为 `[]`；SA8 W1 指定程序（契约 U1 内对齐、不动 ADR）被遵守 |
| SA8 W2/U2：不演示「投影独截」格，取值通道口径 | §7-D5、§13 R2 | 落实；`truncated` 逐字段透传（B14），演进路径照录（先修订 CT-4 再改实现） |
| SA8 W3/U3：`ReadLogicalValueTruncationEntry` 显式决断 | §7-D6 决断退役 + 依据 (a)–(d) | 落实；复核：index.ts L46 转出在场、仓内从 `@nomicore/namespace-runtime` 导入者唯 `runtime-readdata-shape-budget.test-d.ts` L15–22（其锁随票删除）；registry 无转出/无引用；doc-runtime 本体不动（DENY）——零仓内破坏成立 |
| SA8 W4：ADR 健全性门保持在场且绿 | §7-D8 末条、ALLOW #29 明令保留 L294–313 | 落实；该门现行断言（`schema: ReadDataSchemaProjection \| null`、`truncations: TruncationsEntry[]` 在 ADR 正文）实读在场 |
| 冻结面 11 项（SA8 §4） | §9 负控层 + §11 DENY 逐项 | 落实；DENY 覆盖 vfsl/src、resolver 测试、doc-runtime、docs/adr、CONTEXT 语义、版本链、runner 配置、写路径、诊断、registry index |
| typed-access 写纪律（组合层零 cast） | §6 末行、CB8 | 落实；`ProjectionTruncation`（vfsl L44–51）与 `ReadLogicalValueTruncationEntry`（doc-runtime read.ts）实读结构同构 `{path,kind,omitted}`，结构类型保证零 `as` |
| SA6 J1 行号引用（L126/L130/L132）与设计 L128 之分歧 | §7-D8 精确定位 | **设计正确**：实读 typed-access.md，预算纪律三句（静态完整性/DeepOptional 可选访问/非写前快照）是 **L128 单句**；L126/L130/L132 为邻域段（shape-budget 段/值内截断形态段/预算后写纪律段）。`hasBudgetDisciplineParagraph` 四正则（fixture L150–161 实读）恰锚定 L128 段落——设计「原文保留 L128」与负控锚一致，SA6 行号引用不精确但不构成设计偏差 |

上游事实与源码矛盾：**未发现**。设计 CB1–CB13 全部锚点本评审实读复核一致（含三处设计对 SA6 行号的精化：L128 纪律句、sync-control 行为锚、fixture 谓词现状）。

## 6. 设计内部一致性

| 检查点 | 结果 |
| --- | --- |
| §7 决策 ↔ §8.1 接口清单 ↔ §11 ALLOW LIST ↔ §12 验证映射 交叉引用 | 一致：D1/D2→read-schema-projection.ts 行；D3/D5→runtime.ts 行；D6→index.ts 行；D9→helpers 行；D8→三文档 + fixture 三文件；每条 CT 组在 §12 有落点 |
| 头行规格（D2）与 SA6 附录 A/C1/附录 B | 一致（采纳 C1/B 操作性口径；`foldSegment` 与渲染器 `foldText` L984–986 同规则；数字段 `String(n)` 与 ✂ 段 L998 同规则） |
| D3 类型坍缩与 CT-8 H1–H4 | 一致：`ReadDataOkResult` 单一四键形成员、两联合名保留、`Extract<…,{truncations:unknown}> === never` 可满足、Equal 组合锁两侧同变仍相等 |
| D5 `truncated` 口径与 CT-4 D1/D2/D6 | 一致：预算透传 / legacy 硬编码 false；null×预算共存合法（诚实形态） |
| D1 签名演化与调用点 | 一致：`projectReadDataSchema` 唯一调用方 = runtime.ts L575/L603（grep 复核），四参预算重载与 L603 组装（canonical.options + result.truncations）匹配 |
| JSDoc 重录范围（§8.1 表）与 ALLOW 生产文件 5 个 | 一致；registry 两文件仅注释级改动，Equal 锁/透传代码零变化（lease.ts L282–295 实读一致） |
| Step 1 RED 顺序（helpers 先行）与 R6（family B 仪器纪律） | 一致：`expectReadDataOkKeys` 在 helper L73 在场；`SUCCESS_SHAPE_KEYS.length` 驱动 family B 元数判定（scan.ts L192 实读），常量四键化自动随动 |
| 死引用/旧 API/前后矛盾 | 未发现；设计引用的 `ResolveSchemaBudgetOptions`、`renderProjectionText`、`ProjectionTruncation` 均为 vfsl 现行公共导出（vfsl index L154–155 实读），`@nomicore/vfsl` 已是 namespace-runtime 依赖（package.json L25 实读，无需包清单改动） |

一处措辞级不对称（不构成矛盾）：§10 调用方矩阵称 helper「双参签名保持」，§7-D9 实际规格为 `readDataOk(value, schema, truncated = false)`（三参含默认）。语义相容——既有调用点全部 ≤2 参（registry 树 grep 复核：`readDataOk(marker, null)` 等 8 处样本均为两参），缺省参数保持零改调用点。见 §14 O5。

## 7. 状态机与并发攻击

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
| --- | --- | --- | --- | --- | --- |
| S1 | ready，schemaState=ready | 同参连续/交错读 | 逐字节相等（零缓存零 memo） | 无（§8.2/§9 明示无新增状态；renderer 纯函数 + resolver 确定性，B4 锚） | — |
| S2 | ready | `replaceSchema(newEnv)` 后同路径读 | 文本反映新 derived，无陈旧缓存 | 无（D4 零缓存；P0/SCHEMA 写槽完成后 activeTools 更新，读面每次重新 resolve） | — |
| S3 | closing/closed | readData 调用（含敌意 options） | `RUNTIME_READ_DISABLED` 恰四键失败形，先于一切 options 读取与 doc 触碰 | 无（D7 lifecycle gate 定序不动；CT-5 E3/E4 回归锚） | — |
| S4 | schemaState≠ready（preparing/fatal） | readData 成功值读后投影 | `schema:null`、`ok:true`、value 照常 | 无（D1 步 1 状态守卫先于 path 守卫，与现状 L75–79 逐位相同） | — |
| S5 | released lease | lease.readData | 冻结 `RELEASED_ISSUE` 短路先于透传 | 无（lease.ts L289 实读一致；CT-1 A5） | — |
| S6 | ready，敌意 path（Proxy/重定义迭代器） | 预算读 | 敌意面**单读**：头行段值取自 normalizeReadPath 快照，敌意对象不被二次读取 | 无（D2 防御要点 1；normalizeReadPath L114–132 实读为普通数组副本、段值原样拷贝、迭代器同一性比较不调用迭代协议） | — |
| S7 | ready，敌意 options（视图漂移） | 预算读 | canonical 两出口响亮（重派发 / seamReadOptionsInvalid），绝不静默 | 无（D7 零改动；runtime.ts L587–599 实读一致） | — |
| S8 | 任意 | InternalError（可信域畸形 derived/truncations） | throw 逃逸，不收敛 null、无部分输出 | 无（D1 步 5；渲染器 L21–22/L139–141 实读：validateProjectionShape/validateTruncations 确以 InternalError throw；组合层零 catch；sequencer 测试 L795–812 逃逸锚保留） | — |

并发面：读在 FIFO sequencer 之外、同步无 await、单线程无竞态（runtime AGENTS 边界；设计 §9 与之一致）。无第二事实源：截断事实的内部事实源仍是值通道清单（doc-runtime），✂ 段是该清单经确定性纯函数的**交付渲染**——两通道由同一 `result.truncations` 单点喂入（D1），不存在分叉输入。

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
| --- | --- | --- | --- | --- |
| F1 | 非法 options（未知键/非整数/Proxy 等） | `READ_OPTIONS_INVALID` 恰 `{ok,code,path,message}` 响亮，绝不 `schema:null` 静默 | 无（D7 零改动；F1/F2 回归锚） | — |
| F2 | resolver 失败（路径偏离/raw 键） | `!resolved.ok → null`（两码同收敛，null 单义） | 无（D1 步 3 与现状 L88/L92 一致；CT-5 E1/B3） | — |
| F3 | 渲染器对畸形 trusted 输入 | InternalError throw 逃逸（fail loud），无部分输出 | 无（renderer 实读确认；「唯一逃逸通道」纪律扩盖渲染器，语义与 ADR 0016 resolver 条款同构） | — |
| F4 | `schema:null` × 预算截断 | `truncated:true` 与 `schema:null` 合法共存（诚实形态，不谎称可消歧） | 无（D5/CT-4 D6；CONTEXT.md 截断省略词条已含同款诚实句） | — |
| F5 | 部分成功伪成功 | 不存在：渲染器无部分输出；失败分支零 schema 工作；值失败短路先于投影 | 无（§8.3 R1–R3 数据流逐行列出错误出口） | — |
| F6 | 回滚 | 纯读面零副作用，回滚 = revert 整票（原子性由类型锁保证半截不可编译） | 无（R8） | — |
| F7 | 清理失败 / 资源泄漏 | 文本 string 无所有权；resolver 产物进程内即弃 | 无（§9 资源所有权行） | — |

无静默 fallback、无误降级：所有正常路径不变量缺失均 fail loud（F1/F3）；`schema:null` 是单义交付而非错误掩盖（ok 恒真）。

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence（本评审实读） | Required revision |
| --- | --- | --- | --- |
| `NamespaceRuntimeReadDataResult` / `…BudgetResult` 成功成员 | 无：仓内全部消费者清点于设计 §10，且本评审独立 grep 交叉复核——`apps/yjs-server/src/app.ts` L609 仅 `.ok`/`.value`；`ws-replication/src/testing.ts` L47 仅 bind 透传；doc-runtime 测试树零 readData 引用；domains/apps 测试树零 truncations/expectReadDataOk 暴露 | grep 实测 | — |
| `NamespaceLeaseReadData*` 别名 | 无：types.ts L450–459 为联合别名，代码零变化自动跟随；Equal 组合锁（lease.ts L410–421）两侧同变仍相等；重载序 legacy 最后（`ReturnType` 末签名前提自锁） | 实读 | — |
| `ReadLogicalValueTruncationEntry` 公共转出退役 | 无：唯一导入者随票翻新；registry 无转出；外部破坏在 ADR 0027 决策 5 破坏性 minor 包络内 | grep 实测 | — |
| `projectReadDataSchema` 内部签名演化 | 无：包内符号，唯一调用方 runtime.ts；返回类型锚（CT-7 G4 `string \| null`）保留函数名 | grep 实测 | — |
| 测试替身/工厂（`readDataOk` 等） | 无：registry 树 9 个使用 helper 的文件全部落位「随动组」；现存调用点均为 ≤2 参（`schema: null` 为主），helper 四键化后 `string\|null` 接受 null，零编译破坏 | grep 实测（create/idle/open/sa7-*/shutdown/passthrough/sync-control） | — |
| DSH 会话级探针（仓外） | 无：ADR 0027 决策 5 明文零代码改动，输出形态随包升级自然变化 | ADR 实读 | — |
| 文档匹配器消费方（fixture/sync-control/sync-red） | 无：六谓词现状与重录规格一一对应（`hasFourKeyParagraph`=valueSchema+aliasDocs、`hasKeyConventionParagraph`=aliasDocs+键规约、`staleAnnotationViolations` 现谓词要求 schema+truncated+truncations 全在场、`adr0016Refs` 只认 0016、`readDataOptionUsages` 预算负控、`hasBudgetDisciplineParagraph` 四正则锚 L128 段）——实读与设计 D8 描述逐项一致；cordis L344 `// { ok: true, …truncations: [] }` 行注恰为新谓词的改造样本 | 实读 | — |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
| --- | --- | --- | --- |
| 头行组装 + 渲染器接线 + 截断清单喂入 | namespace-runtime 组合层（ADR 0027 决策 2「组合层前贴头行」） | read-schema-projection.ts（D1） | 正确：维持「readData 成功分支 schema 附加单点」（模块头注既有职责）；头行事实源（规范化快照 + canonical）归本模块所有，避免敌意面二次读取 |
| 值通道预算/截断 | doc-runtime（冻结） | 零触碰（DENY） | 正确 |
| 渲染文法 | vfsl 渲染器（T1 冻结） | 零触碰（DENY） | 正确：头行不进渲染器（T1 G1.3 反断言尊重） |
| lease 透传/生命周期 | registry | 仅 JSDoc（代码零语义变化） | 正确 |
| options 校验单源 | doc-runtime 权威 + runtime 接缝净化 | 零改动（D7） | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
| --- | --- | --- | --- | --- |
| 组合层产出 schema 附加 | `projectReadDataSchema`（单点、守卫序、resolver 分流） | 保留函数名与守卫序，仅产出形态换文本 + 头行 | 一致 | 形态换代而非结构重排；G4 类型锚要求保留函数名 |
| 头行 path 记法 | 渲染器 ✂ 段 `renderTruncations`（L994–1002：空路径 `'[]'`、点分、`foldText`） | `headLine` 同规则（点分、空串、foldSegment） | 一致 | 与冻结渲染器同族记法；空路径视觉一致（`[]`） |
| canonical 净化 | `canonicalReadOptions`（#336） | 原样复用为预算段事实源 | 一致 | 零新机制；F3 等价由三层既有事实叠加（设计 D2 论证成立） |
| 类型面锁 | Equal 组合锁 / keyof 锁 / `@ts-expect-error` 负例（#336/#338 惯例） | 同款姿势四键化 + 新 `.test-d` 锚 | 一致 | 沿用既有测试仪器与命名（`*-red`/`*-control`/`.test-d.ts`） |
| 文档负控 | contract-fixture 谓词 + sync-control/red（#273/#316 惯例） | 谓词重录 + 双向敏感性自控 | 一致 | J6 双向防关键词空转，沿用既有自控样本惯例 |

未找到可比实现时已明示（设计 §7-D6 对 U3 无先例时的依据论证）。无凭空声称。

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
| --- | --- | --- | --- |
| 截断事实 | 值通道 `result.truncations`（doc-runtime） | ✂ 段（渲染交付形态）；`truncated` 布尔（透传） | 无：同一清单单点喂入渲染器（D1），布尔透传（B14），无第二清单/合成 |
| 活 schema | live derived（P0/SCHEMA 写槽） | 每次读重新 resolve + render 的文本 | 无：零缓存（B4/G2 锚） |
| 有效预算 | canonicalReadOptions 产物 | 头行预算段 | 无：同源单点（D2 预算段事实源） |
| 生命周期 | state.lifecycle / released 标志 | 失败联合/短路 issue | 无：零改动 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
| --- | --- | --- | --- |
| 无新增资源获取（纯函数链、零 memo/缓存/订阅/句柄） | 无需释放；lease release 幂等 + released 短路保持 | InternalError 逃逸不留部分状态；读可重试 | 对称：本设计不引入任何非对称生命周期面 |

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
| --- | --- | --- | --- |
| 第二渲染通道 | `renderProjectionText`（T1 公共导出） | 组合层直连调用 | 非平行：唯一接线点，无包装/适配层 |
| 第二截断清单 | 值通道 truncations | ✂ 段渲染 | 非平行：✂ 是交付形态，不是第二事实源 |
| 第二 options 解析 | doc-runtime 权威 + canonical 接缝 | 原样复用 | 非平行 |
| 新 helper/仪器 | readdata-ok-shape / scan / 收敛门 | 原位四键化 | 非平行：无新仪器文件 |
| 新公共 API 面 | — | 无新增导出（`ReadDataOkResult` 具名导出列为 follow-up） | 正确收敛 |

阻断项排查：行为错 Owner、绕过既有能力、双事实源、生命周期不对称、无迁移方案的协议分叉、「改动更少」式架构偏离——**均未发现**。

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
| --- | --- | --- |
| ALLOW 生产 5 文件 = SA6 §10.1 逐行对应（runtime.ts / read-schema-projection.ts / index.ts / registry types.ts / lease.ts） | 两清单交叉比对一致 | 无 |
| ALLOW 测试 = SA6 §10.2「必改 16 + 建议同步 3 + 新契约 5 + helper 随动组」全集；随动组 9 文件（idle/open/create/sa7-rev1/sa7-hostile/sa7-concurrency/shutdown/passthrough/sync-control）与 grep 实测使用 helper 的文件清单一致 | 交叉比对 + grep | 无 |
| ALLOW 文档 = SA6 §10.3 三文档 + CONTEXT 只读 | 一致 | 无 |
| DENY = SA6 §10.4 红线全集 + 写路径/诊断/registry index/runner 配置显式补充；无 ALLOW/DENY 冲突（同一文件不出现在两侧） | 交叉比对 | 无 |
| ALLOW 无无理由扩张：3 个「建议同步」文件入列附理由（phase5 L271 两键伪形实读在场：`readData: () => ({ ok: true, value: 1 })`；两个 test-d 补 `@ts-expect-error` 负例 = CT-9 I1 要求） | 实读 | 无 |
| follow-up（R9：文本缓存/marker 紧凑表示/bump/`ReadDataOkResult` 具名导出）均非本票必要项伪装 | §13 R9 | 无 |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
| --- | --- | --- | --- |
| CT-1..CT-10（AC1–AC9） | §12 映射表逐组给出断言面与预期观察；测试路径 = SA6 附录 C（真实 runner 入口，SA6 §14 已实测自动发现） | 无 | — |
| 先红后绿 | Step 0–5：测试先行（生产零改动）→ 聚焦红（红点可归因：四键/字符串/头行/✂/词汇/`r.truncations` 编译红）→ 生产 → 文档 → root 门禁 | 无 | — |
| 反伪绿 | B5 oracle 独立性（expected 独立编译 derived，不从 `r.schema` 反推）；J6 双向匹配器敏感性；R6 family B 仪器纪律（`expectReadDataOkKeys` 走标识符常量）；helper 反伪绿不变量保持 | 无 | — |
| 观察行为而非源码文本 | 断言纪律沿用 SA6 §12 头注（公共接缝 + 公共 API oracle；不做源码字符串断言）——唯一例外 CT-7 G4 结构面由 SA4 AST/符号证据承载（非测试），已明示为「补充非替代」 | 无 | — |
| 旧实现真红 | E2 红灯签名（HEAD 实测）+ Step 1 全测试面翻转后聚焦红的归因清单 | 无 | — |
| 错误路径伪绿 | M1–M8 突变敏感性（SA7 执行期必做，逐突变击穿面对照 CT 组）；F1 敌意 options 响亮锚 | 无 | — |
| 回归/并发/重启场景 | 确定性判据（同输入逐字节）替代竞态判据（读为同步纯观察，SA6 §7 同判）；B4/G2 replaceSchema 时序锚；lifecycle 定序锚 E3/E4 | 无 | — |
| root 门禁（AC10） | `pnpm typecheck` + `pnpm test`（--typecheck）+ `git diff --stat` 对照 DENY/版本零改动 | 无 | — |

## 13. Required revisions

无 BLOCKER、无 MAJOR finding。设计可安全交付 SA3/SA7 实施。

## 14. Non-blocking observations

| # | 观察 | 证据 | 建议 |
| --- | --- | --- | --- |
| O1 | D8 对 typed-access.md L130 的重录规格给出新消歧句式（「折叠壳列在 ✂ 段 = 被裁；✂ 段无条目的空壳 = 真空；键缺席且不在 ✂ 段 = 真缺席」）但未显式包含 U4 诚实句（`schema:null` × 预算读时键级消歧不可用、只剩 `truncated` 布尔）。该要求在设计 R4 与 SA6 U4 处置行在场（「不得谎称可消歧」），且 CONTEXT.md 截断省略词条已含同款句；但 D8 是 SA3 的操作性规格，字面跟随可能产出过度承诺的文档句，而 J4/J5 词汇门不校验该 caveat 的在场 | typed-access.md L130 实读；CONTEXT.md 截断省略词条（含 `schema:null` × 预算读 caveat）；SA6 §15 U4 | SA3 重录 L130 时在消歧句后补一句 null×预算 caveat（镜像 CONTEXT.md 措辞）；SA7 抽查 |
| O2 | `foldSegment` 折叠 + trim 后，纯空白段（如键名字面 `"\n"`）渲染为空——单段路径 `["\n"]` 的头行呈 `# readData []`，与空路径视觉不可分。与冻结渲染器 ✂ 段同规则（L998）、且 U5 已声明头行为呈现形态不承诺 round-trip，故可接受 | render-projection-text.ts L994–1002；设计 §7-D2 防御要点 3 | C6 测试不要断言此类段的可区分性；信息性登记 |
| O3 | fixture 函数名 `hasFourKeyParagraph` / `hasKeyConventionParagraph` 保留原名而语义重录为投影文本/✂ 词汇锚——名称不再自描述（原「四键」指投影四件套，易与结果恒四键混淆） | fixture L80/L85 实读；设计 §7-D8 | 可选：SA3 顺手改名（如 `hasProjectionTextParagraph`）；不改名不阻断 |
| O4 | SA6 J1 引用的「L126/L130/L132」行号不精确（预算纪律三句实为 L128 单句，`hasBudgetDisciplineParagraph` 四正则恰锚定该段）——设计已正确精化并明令原文保留 L128；SA7 验收时应以段落内容锚（谓词）而非行号复核保留 | typed-access.md L124–134 实读；fixture L150–161 四正则 | SA7 报告引用设计 §7-D2/§7-D8 的内容锚 |
| O5 | §10 调用方矩阵「helper 双参签名保持」与 §7-D9 `readDataOk(value, schema, truncated = false)` 措辞不一致（语义相容：现存调用点全部 ≤2 参，缺省参数零破坏） | registry 树 grep（create/idle/open/sa7-* 样本均 `readDataOk(x, null)`） | 无需修订；SA3 以 D9 规格为准 |
| O6 | CT-1 A1 的 `JSON.stringify(r)` 不含 `"truncations"` 断言对**业务数据键名字面为 `truncations`** 的夹具会假红（值通道透传该键属合法数据）。SA6 现行夹具（title/count/meta/tags/nick）不受影响 | SA6 CT-1 A1；设计 §12 照录 | 信息性：SA3 落 A1 时夹具避免业务键名 `truncations`，或将包含性检查限定在结果对象自有键（`Object.keys`） |

## 收尾

- 本评审未修改设计、生产代码、测试或文档；唯一写入 = 本文件。
- 设计自身结论 `requiresConflictRecheck = true`（§15）系承接 SA8 §9 三触发条件的登记，属任务级实现后复查程序，本评审确认其成立；本评审**未发现**需要重新执行 ADR 冲突检查的**新**风险（W1 对齐、U3 退役、CT-8 采纳均在 SA8 指定程序内），故不追加新的 conflict-recheck 触发。
- 后续路由建议：SA3 按设计 §11 ALLOW LIST 与 §12 TDD 序列实施；SA4 重点核对零 cast、clone 符号真实删除、联合未合并；SA7 执行 M1–M8 突变与冻结面 diff 复查。
