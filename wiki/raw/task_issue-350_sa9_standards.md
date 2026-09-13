# SA9 Standards Review（仓库与工程标准轴）— Issue #350 原子变更信封：mutateData 批量 ops 多操作全有或全无（ADR 0026）

- 派发：`sa-3df93222-9d02-4c2f-bc82-dc25b7bb48f6`（role `mabf-sa9`，phase `standards-review`，iteration 0）
- **Verdict：`approve`**（无 BLOCKER、无 MAJOR；MINOR 5 项不阻断，见 §7）
- 审查对象：最终已提交 diff `211c5fa` → `ac0cecd`（`feat(doc-runtime): add atomic batch mutation envelope`，branch `mabf/issue-350` HEAD）
- Worktree：`/home/wangjian/nomicore-fix-issue-350`；`git status` 跟踪面零改动（工作树 == HEAD），未跟踪仅任务简报 `wiki/raw/task_issue-350.md`（见 §7-M2）
- Issue-comments REST：`[]`（无 Owner 评论来源的附加义务；Host 预读「none; there are no owner-comment requirements」与简报、SA6/SA8 记录三方一致）
- 审查方式：静态实读 + 只读命令独立复核（`git diff`/`git diff --check`/`git diff --stat` 范围核对/全仓 grep/逐行比对/vitest 与 tsconfig 入口实读）。**未运行测试、未启动服务、未修改任何代码/设计/测试**——绿证据采信已入库 SA3/SA7 报告，本审查只对证据链真实性与入口真实性做抽验。

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| 任务简报 `wiki/raw/task_issue-350.md`（Issue #350 正文 AC1–AC8；Comments 空） | 已读（未跟踪，见 §7-M2） |
| 母法 `docs/adr/0026-atomic-mutation-envelope.md`（L14–55 决策全文、L65–74 后果与开放问题） | 已读全文 |
| 关联 ADR：0007（含 #237 修订节）、0008、0025、0011、0014、0023 | 已读（经 `task_issue-350_relevant_decisions.md` 摘录 + 关键条款原文抽读） |
| 设计 `task_issue-350_design.md`（iteration 3；D1–D7、§7.5.2 阶段 C、引理 1–4′、§11 ALLOW/DENY、§12.1 S1–S8/NS-1/NS-2、§14/§14.1 修订映射） | 已读全文 |
| SA2 iteration 2 评审 `approve`（F1–F6 处置记录；F5/F6 经源码级复核已解决） | 已读 |
| SA3 实现报告（含 Deviations §1 S8 fixture 替换 + 反向实验 A/B + 验证命令表） | 已读 |
| SA4 实现静态审查 `approve`（含 §11 后续动态验证项、§12 非阻断观察 1–7） | 已读 |
| SA6 验收契约 `approve`（B1–B8/N1–N4、R1–R7；红绿证据与入口真实性） | 已读 |
| SA7 动态验证报告 `approve`（命令 1–8 逐字；补充测试 TD-0–TD-3/NF-1；P-A–P-D 探针输出存档） | 已读 |
| SA8 前置门禁 `clear`（`requiresConflictRecheck:true`）+ 实现后复审 `clear`（`=false`）+ 决策摘录 | 已读 |
| 模块 `AGENTS.md`（root / docs / packages/doc-runtime / packages/namespace-runtime）、`.agents/skills/nomicore/typed-access.md` 纪律段 | 已读（注入 + 实读） |
| 最终 diff 全部 18 文件（2 源文件 + 7 测试文件 + 9 wiki 报告） | 已读/独立复核 |

## 2. 独立复核（非转述 SA 声明）

| 复核项 | 命令/方法 | 实测结果 |
|---|---|---|
| diff 范围 | `git diff 211c5fa HEAD --name-only -- packages/` | 恰 9 文件：`doc-runtime/src/{mutation.ts, index.ts}` + `doc-runtime/test/public-surface-type-guard.test-d.ts` + 6 个 issue-350 测试文件——与设计 §11 ALLOW 七项一一对应，无越界 |
| DENY 面零触碰 | `git diff 211c5fa HEAD -- packages/namespace-runtime/src packages/vfsl packages/doc-runtime/src/mutation-local.ts packages/doc-runtime/src/install-verify.ts docs CONTEXT.md .agents` | 0 行输出（namespace-runtime src、vfsl、mutation-local.ts、install-verify.ts、docs、CONTEXT、.agents 全部零 diff） |
| diff 卫生 | `git diff 211c5fa HEAD --check` | 零输出（干净） |
| 测试削弱扫描 | grep `.(skip\|only\|todo)(` 于 6 个新测试文件 + type-guard | 零命中 |
| 源码杂质扫描 | grep `console.`/`debugger` 于 mutation.ts/index.ts | 零命中 |
| 测试确定性扫描 | grep `Date.now`/`Math.random`/`setTimeout` 于 6 个新测试文件 | 零命中（R7 排队窗口以 `p0Gate` 显式构造，非调度时序依赖） |
| 测试入口真实 | 实读 `vitest.config.ts` L15/L18–22、`tsconfig.typecheck.json`、`packages/doc-runtime/tsconfig.json` | 6 个新文件匹配 `packages/*/test/**/*.test.ts` 默认 glob；`.test-d.ts` 走 typecheck 块（include `packages/*/test/**/*.test-d.ts`）；doc-runtime tsconfig include `test/**/*.ts`——入口全部真实 |
| 单操作逐字节不变 | `git diff` 逐行核对 `parseMutation` → `parseMutationCore` 改造 | 13 处 failIssue 消息全部 `${prefix}` 前缀化，`parseMutation` 以 `parseMutationCore(input, '')` 委托——空前缀插值 = 字符级等价；单操作分支主体（L132–159）与 HEAD 相同；分发判据 `plainObjectOf + Object.hasOwn(env,'ops')` 纯读 |
| 公共值面守卫 | 实读 `public-surface-guard.test.ts` | 值面断言「恰 `applyValidatedMutation` 一枚 mutation 值导出」——本 diff 只加 `export type`（零运行时产物），值面守卫原样成立，未被触碰（DENY 保持） |
| `payloadOf` 逐字同款 | 比对 mutation.ts L311–318 vs mutation-local.ts L264–266/L307–309/L358–365 | 四动词穷尽、字段逐一相同（含 union 位 array-* 先例形态）；无 default 分支 |
| 阶段 C 索引安全 | 实读 `prepareBatchMutation`/`composeBatchVerify` 控制流 | P 循环任一失败 → L247 return fail ⇒ 进 composeBatchVerify 时 `items.length === parsed.length`，索引对齐；plan 复跑失败时 compIssues 已填充且循环尾 return fail——fail-closed 无空转 |
| 折迭谓词正确性 | 实读 `isStrictPrefix`/`isPrefixOrEqual` + 引理 2/3 对源码推演 | E5 禁「祖先-后代或相同」⇒ target/array（prefix===path）天然零匹配；record/parent/union 的 prefix 是 path_i 真前缀 ⇒ 折迭候选恰好是写位落在边界子树内的兄弟 op；ROOT 级 record 边界（prefix `[]`）折入全部兄弟足迹，与整 ROOT 重投影域匹配 |
| `{op,…,ops}` 同现演进 | diff 定位 E1 分支 | 同现输入从 HEAD 的 `未知信封键 "ops"（操作 set）` 变为批量分支双形态形状错误——SA8 override 表第 4 行已裁该输入类不在冻结面（ADR 0026 L28 明文同现=形状错误） |
| 测试计数自洽 | grep `it(` 逐文件计数 | 契约 12+7、共享边界 10+2、SA7 补充 4+1 = 36 用例——与 SA7「6 文件 36/36 绿」逐字一致 |
| wiki 产物一致性 | 抽读设计 §12.1 S8 行 vs 落地测试 L34/L61/L265–301 | 镜像成员 fixture、ops 与断言语义逐字一致；iteration 3 回写与代码内联记录吻合 |

## 3. 标准符合性逐项

### 3.1 ADR 0026（母法）—— ✅ 逐项符合

| 条款 | 符合性 | 证据 |
|---|---|---|
| L28 双形态互斥（同现=形状错误） | ✅ | E1 顶层键封闭（`op` 同现 → 双形态错误；其余多余键 → `未知信封键`）；B6 双形态用例 |
| L29 `ops` 非空、≤16、元素为完整单操作信封、元素禁 `guard` | ✅ | E2 数组/非空/`MAX_BATCH_OPS=16`（包内常量**不导出**——L73 开放问题 1 词表纪律）；E3 复用同一 `parseMutationCore`（封闭键集天然排除 `guard` 与一切未知键）；B5（16 受/17 拒/空拒）、B6（九类矩阵） |
| L30 批内路径互不嵌套（信封解析期直接拒绝） | ✅ | E5 两两 `isPrefixOrEqual` 严格段 `===`，位于任何 prepare 与任何 live 读之前；**拒绝域精确「祖先-后代或相同」**——共享边界兄弟路径放行（B7 兄弟 anchor + S1–S7 正例），未为规避验证问题扩大（设计 §7.9 备选 G 未采纳） |
| L34 逐操作 prepare → 任一失败整体零写入 → 单事务按序提交 → 逐操作边界验证 | ✅ | `prepareBatchMutation`（E→root 检查→P 聚合→C 组合）全部裁决先于 `transactGuarded`；`applyValidatedMutation` L102–110 单事务按序 `commitPrepared` + 事务后按序 `verifyBoundaryIntact`；禁 write-then-undo 保持 |
| L35 跨实体路径同样原子 | ✅ | 单 Yjs 事务覆盖整个 doc；B2（四动词跨 Record/集合）、R1、S6 |
| L36 最小 edit 不降级 | ✅ | E4 `set([])` 元素禁令 ⇒ 元素结构性只走局部最小 edit 管线；B4（700k 兄弟字段下 update <1000B + 载体身份保持） |
| L40–42 错误域：形状错误无码不可重试；操作失败聚合非 fail-fast；fatal 通道不变、无新增稳定码 | ✅ | E1–E5 fail-fast 单 issue 无码；P 循环跨操作聚合按 ops 序（操作内部不拆）；阶段 C 组合失败 fail-closed 聚合（可达的保守收口，引理 4′+S8 守卫，非死代码）；`errors.ts`/`fatal.ts` 零 diff；fatal 仍恰 E201-C/D、E203、E204（phase 三值）；E205 保持 catch **返回**单 issue（F3 更正落实，SA7 P-D 探针复证） |
| L46 一写槽 = 一变更尝试 = 一条诊断记录；单事务单条 update bytes | ✅ | namespace-runtime src 与诊断包零 diff；批量封闭在 S5 单次调用内；R3（对照 3 顺序写 3 条，批量第 4 条 committed/update + 重放见全值）、R4、NS-1（恰 1 update/1 notifier/恰 2 条记录） |
| L50–51 复制 apply/`replaceSchema` 不适用；跨实例语义不变 | ✅ | 复制/wire/META/readData 零 diff；SA7 §5 P-A 探针：批量单条 update 与等价顺序写合并 `MERGE-EQUIVALENT: true` |
| L55/L73–74 与 0025 组合及开放问题 | ✅ | 元素 `guard` 即刻拒（B6/R4）；顶层 guard 未实现、未预留半成品（E1 拒 `{ops,guard}`）；`ops` 上限与嵌套放宽未私自动（`MAX_BATCH_OPS` 不导出） |
| L65 旧运行区对 `{ops}` loud 拒绝的演进声明 | ✅ | 反向冻结面：新运行区接受；N3 单操作未知键文案锚原样保持 |

### 3.2 ADR 0007（含 #237 修订节）—— ✅ 无违规

- §5 零写入、禁 write-then-undo：E/P/C 三阶段全部在触碰 live Y.Doc 前裁决（B3/S8/NS-2 字节不变 + 0 事务 0 update 断言）；阶段 C 只做逻辑值组合，零 live 读。
- §5 E201 变体 C 只对真实提交后偏离：组合期望边界使共享边界合法批量不再伪触发（S1–S7/NS-1 ok:true + 写能力保持），**恢复**冻结语义而非新增触发点；真实偏离仍检出——SA7 补充 TD-1/2/3（observer 篡改 → throw E201-C、committed:true、不虚假回滚）与 NF-1（端到端 `RuntimeWriteFatalError` → `markWriteFatal` → 后续 `RUNTIME_WRITE_DISABLED`、读保留）确定性锚定。
- L31 动词词表封闭四动词：specs 表原样；`payloadOf` 穷尽无新增。
- L46 聚合演进（0026 L41 合法演进）：跨操作聚合、操作内部不拆；单操作路径不经聚合代码（N2 恰 1 条 issue 锚）。

### 3.3 ADR 0008 / 0011 / 0014 / 0025 / 0023 —— ✅ 无违规

- 0008 L47 唯一全量形态：E4 `set([])` 元素禁令（闭口 B，SA8 移交封口经设计 §7.2 裁决 + 实现后复审就地裁可）——批量内无第二全量形态；N4 单操作 `set([])` 不变。
- 0008 L49–51 槽序/INV-W2：namespace-runtime src 零 diff；S3 对整 `{ops}` 一次快照（R6/R7 保持）；不新建槽类型；emission 仍槽外 `.then`（0014 amendment C）。
- 0011/0014 诊断词表与记录形态：operation 仍 `root-mutation`、stage/result 联合、rejected 禁 update、无 record schema 版本变更；聚合 issues 经 R9 `diagValidation` 同源透传进同一记录（NS-2：`issues.policy==='full'`、items 顺序 = ops 序、`code===undefined`）。
- 0023 L41 服务表面纪律：`ctx.provide` 面零触碰。

### 3.4 模块 AGENTS 与根 AGENTS —— ✅ 无违规

- doc-runtime「Add public APIs only through `src/index.ts`; public-surface guard tests must account for every export」：两类型只经 `src/index.ts` 的 `export type`；类型守卫登记正例投影（`ops` → `readonly ValidatedMutation[]`）+ 三类 `@ts-expect-error` 编译期负例（双形态 TS2353/元素 guard TS2353/非信封 TS2322）；值面守卫不动（无新值导出）。
- doc-runtime「Never expose live writable ROOT/SCHEMA/META/prepared internal state」：`BatchItem`/`MAX_BATCH_OPS`/`prepareBatchMutation`/`composeBatchVerify`/`payloadOf`/`isStrictPrefix`/`isPrefixOrEqual` 均包内私有，未导出。
- namespace-runtime：src 零改动；新测试经既有 seam（`createNamespaceRuntimeWithSeam` + `realPersistenceScheduler` 先例形态），公共面纪律保持。
- 根 AGENTS typed-writes 强制（面向应用/独立项目）：本票为引擎面；完成门「引擎公共类型可被 typed adapter 组装」兑现——`BatchedMutation = { ops: readonly ValidatedMutation[] }` 元素可经生成 `PathPatchValue` 静态约束，类型负例证明元素 guard 编译期 fail-closed。
- docs/AGENTS「code behavior changes → update every normative document whose stated contract changed」：规范契约 ADR 0026/CONTEXT/typed-access 已在 `211c5fa` 先行成文（实现使契约成真）；`set([])` 禁令词表化经 SA8 两级裁定为开放问题复审随伴项（非本变更集缺失），设计 §13 残余问题 2 在案。

### 3.5 架构一致性（责任归属 / 相似能力 / 单一事实源 / 生命周期对称 / 平行机制）

| 检查 | 结论 |
|---|---|
| 责任归属 | 信封解析/批量编排/事务所有权全在 doc-runtime（`assertOutermostTransactionContext` 保持函数首行）；槽机械/诊断/生命周期留在 namespace-runtime（零改动）；边界规划/校验纯函数留在 vfsl（零改动）——无越界 |
| 相似能力对照 | 批量 = 逐元素复用 #237 局部管线（同一 `prepareLocalMutation`）+ 同一 `verifyBoundaryIntact`（仅期望值组合）；array 载荷折迭即 union 位 array-* 现役先例的同款调用形态——非新平行机制 |
| 单一事实源 | 一个解析核（`parseMutationCore`，单操作与批量元素共同消费）、一个 prepare、一个验证器、一对 vfsl 纯函数；无第二解析器/状态机/镜像缓存 |
| 生命周期对称 | 无新增资源/句柄/后台任务（阶段 C 为槽内同步纯计算）；D-B update 订阅 try/finally 未动 |
| 平行机制 | 备选 H（足迹受限第二验证器）/I（plan 携带扩展）/J（live 反推期望）均否决且未出现；`mutation-local.ts`/`install-verify.ts` 零 diff |

### 3.6 兼容性纪律 —— ✅

- 单操作形态逐字节不变（AC5 冻结面第 1 行）：§2 复核成立；N1–N4/R3 前段/R5/R6 锚 + SA7 全仓 345 文件/3629 用例零回归。
- 公共面纯增量：仅两个类型导出；`applyValidatedMutation(…, ValidatedMutation | unknown)` 与 `mutateData(unknown)` 签名不动——零 typecheck 涟漪、零强制迁移（宿主 typed adapter 可选采用）。
- 稳定码 append-only：无新增稳定码；形状/操作/组合失败均无码 `ok:false`（R4 `code===undefined`）。
- 唯一可观察演进（`{op,…,ops}` 同现拒绝文案）在 SA8 override 获批范围内、未扩大。
- 诊断记录形态、wire/schema/record 版本：零变化。

### 3.7 证据工件 —— ✅（两处缺角见 §7-M1/M2/M3）

- 链完整：简报 → SA8 前置门禁（clear + recheck:true）→ SA6 契约（approve，红 13 条在正确断言处）→ 设计（iteration 3）→ SA2（approve）→ SA3（13 红→19/19 绿 + 反向实验 A/B 判别力证据）→ SA4（approve）→ SA7（approve，命令 1–8 逐字 + 探针输出存档）→ SA8 实现后复审（clear + recheck:false，Required actions 1–4 在案）。
- 红→绿证据：SA6 基线 13 红逐字留档（契约 §13）；实现后 31/31、两包 769/769、全仓 345 文件/3629 用例、6 文件 36/36——命令与输出逐字在案。
- S8 fixture 偏差三源留证（SA3 Deviations §1 / SA4 §12 观察 1 / SA8 Required action 1）并已经设计 iteration 3 回写 + SA7 §8 探针 P-B 复证调和——裁决链闭合，无静默分歧。
- 临时探针均声明删除（SA6 §16、SA7 §7），worktree 内无 `*.tmp.ts` 残留。

### 3.8 可维护性 —— ✅

- 模块头注增 ADR 0026 段（双形态/约束/阶段 C/单事务/逐操作验证/单操作冻结面）——后续维护者入口准确。
- 新函数均带注释契约（设计节号 + 引理引用 + 可达性标注）；`composeBatchVerify` 头注明示「不得弱化为死代码」的 SA3 禁事项（引理 4′）。
- commit message 符合仓内 conventional 形态（`feat(doc-runtime): …`）。
- 既有断言零改动：SA6 契约文件逐字未编辑即由红转绿（设计/SA3/SA4 三方记录 + 本审查 diff 核对一致——两文件在 diff 中为纯新增）。

## 4. 测试质量专项

| 维度 | 评估 |
|---|---|
| 行为断言纯度 | 全部断言运行时观察（返回值/live Y.Doc 值/事务与 update 计数/字节快照/readData/诊断 record 字段/重放终态）；无源码字符串断言、无软断言、无吞错 |
| 防同义反复 | `expectEachOpLegalAlone` 构造前置（防空转拒绝）；B6/B8 合法 anchor 先行（证明批量形态已被识别）；R3 顺序写对照（证明计数口径有效）；TD-0 无篡改对照（因果实验，篡改是唯一变量） |
| 原子性断言 | update 事件时刻观察者所见恰一终态（B1/S1 `observed`）；恰 1 本地事务 + 1 update；单条 owned update bytes 重放见全部值（R3/NS-1） |
| 零写入断言 | `encodeStateAsUpdate` 字节不变 + 0 事务 + 0 update + notifier 0（B3/S8/R2/NS-2） |
| 判别力证据 | SA3 反向实验 A（禁折迭 → 11 用例红、SA6 契约 19 仍绿）证明阶段 C 为 S1–S7/NS-1 真支撑且新文件补上契约盲区；反向实验 B（array-insert 载荷置空 → 恰 S7/负控/NS-1 红）证明 F5 落点判别精确——实验仅本地、未提交，实现已逐字恢复（报告留证） |
| 负向守卫 | S8（组合失败 fail-closed：ok:false/issues ≥1/字节不变/0 事务 0 update/无 throw/后续单操作 ok）防阶段 C 死代码化；TD-1–3/NF-1 防「组合吸收真实偏离」验证空转 |
| 覆盖矩阵 | 共享边界六形态（delete+兄弟 set/双 Record set/双 Record delete/record⊇兄弟/union 兄弟/包含精度）+ array-* 载荷折迭（S7/NS-1）+ 组合失败（S8）+ 端到端（R1–R7/NS-1/NS-2）+ 编译期 fail-closed（type-guard 三负例） |

## 5. 需求覆盖声明（标准轴视角）

本审查不裁 Issue AC 是否完整实现（属 SA10）；仅记录：AC1–AC8 每条在设计 §12 有映射、在契约/新增用例有行为锚、在 SA3/SA7 有绿证据，且未发现验收断言被弱化、未发现锚点与源码现状矛盾（SA2 iteration 2 与 SA4 的源码级复核经本审查抽验一致）。

## 6. 不需要冲突复查声明

标准轴 verdict 不改变公共 API/wire/schema/持久化/状态机/生命周期/失败语义/override 范围；SA8 两级门禁（前置 clear + 实现后 clear，requiresConflictRecheck 已闭合为 false）在位，本审查无新增冲突面。

## 7. Findings（MINOR，均不阻断）

| ID | 严重度 | 内容 | 证据 | 建议路由 |
|---|---|---|---|---|
| M1 | MINOR | 两契约测试文件头注引用 `wiki/raw/task_issue-350_sa6_red_probe.log`，该文件不在仓库（SA6 §16 按清理纪律删除，逐字输出已归档进 SA6 契约 §5/§13）——注释为悬引；证据本体在案 | grep 两测试文件 L16–17；`git ls-files`/`ls` 均无该 log | 清理票把注释改指 SA6 契约节号 |
| M2 | MINOR | 任务简报 `wiki/raw/task_issue-350.md` 未跟踪，而全部下游产物已提交并以其为输入锚——commit 内证据链缺简报本体（issue 正文可经 GitHub 恢复；issue-330 先例简报已入库，333/335/336 仅入库终审） | `git status --short`：`?? wiki/raw/task_issue-350.md` | Controller 入库卫生，随终审产物一并处理 |
| M3 | MINOR | 设计后 SA8 冲突复审中间产物（`task_issue-350_design_conflict_report.md`）缺失于 `wiki/raw/`——SA8 实现后复审已就地裁决 `set([])` 封口的 ADR 符合性并记录为流程缺角（其 Required action 4）；证据链经 SA2 iteration 2 approve + SA8 实现后 clear 闭合 | SA8 实现后复审 §2 过程观察 + §8-4 | 后续任务留存中间门禁产物（已在案，无需本票动作） |
| M4 | MINOR | 全仓最终态单进程跑缺位：SA7 全仓 `vitest run --typecheck`（345/3629 绿）启动早于其 2 个补充测试文件创建；补充文件经两包全量（76/774）+ 根 typecheck 覆盖——三证据合取风险近零（纯测试新增不触他包），但严格按 doc-runtime AGENTS「public types 变化须 root `pnpm test`」字面，最终 commit 态宜补一次单进程全仓 | SA7 报告 §9 命令 2/3/4 + §11 Deviation 1（已声明等价合取） | Controller/SA10 finalize 前补跑全仓（预期零增量成本） |
| M5 | MINOR | 代码层微瑕（沿 SA4 §12 观察 2/3 备查）：`parseMutationCore` 尾部防御分支（`op !== 'array-delete'` 后的 `未知操作`）未加 `${prefix}`——`Object.hasOwn(specs, op)` 前置过滤后结构性不可达，零可观察影响；`composeBatchVerify` 内层 `break` 后仍执行 `items[i]` 更新——随即因 compIssues return fail 被丢弃，语义等价但不如 `continue outer` 直白 | mutation.ts L569、L296–304 | 后续清理票统一处理 |

## 8. Non-blocking observations

1. 设计 iteration 3（S8 fixture 证据回写）未再经 SA2 评审轮——delta 为纯证据文书更正（实现与测试零改动），SA8 明文裁定不构成决策修订、不触发复查，SA7 §8 探针复证调和语义未变；流程可接受。
2. SA7 新增 2 个补充测试文件超出设计 §11 原 ALLOW 列表，但属 SA4 §11 项 2 的明示路由与 SA7 职责内「必要的补充测试」（仓内先例 `sa7-fatal-dynamic-verify.test.ts` 等），纯测试侧、生产零改动，已在 SA7 §7/§11.3 声明。
3. wiki 产物随 feat commit 同提交（issue-330 同例；333/335/336 以独立 `docs(mabf)` commit 入库终审）——两种先例并存，无规范冲突。
4. SA8 实现后复审 §8-5 转交观察（pre-existing 行为：空值歧义 union 上单操作写非首成员声明字段即 E204 fatal）与本 diff 无关（DENY 路径零改动、HEAD 即可复现），建议按 SA8 记录转独立评审/issue，不属本票标准轴阻断面。

## 9. 结论

最终 diff 忠实落地已批准设计（iteration 2 + iteration 3 证据回写）与 ADR 0026 全部条款；冻结面（单操作逐字节、槽序、稳定码、诊断词表、fatal 通道、复制面、词表常量、vfsl/mutation-local/install-verify 接缝）经独立 diff 核对零扰动；公共类型面纯增量且守卫登记齐备；36 个新用例全部行为断言、入口真实、判别力有反向实验证据；证据链完整可溯。无 BLOCKER、无 MAJOR；5 项 MINOR 均为文书/卫生类，不阻断。按裁决规则：**approve**。
