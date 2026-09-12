# SA10 独立 Spec 审查 — issue #350 原子变更信封（mutateData 批量 ops，ADR 0026）

| 项 | 值 |
|---|---|
| 审查对象 | 已提交最终 diff：commit `ac0cecd`「feat(doc-runtime): add atomic batch mutation envelope」（分支 `mabf/issue-350`，工作区干净，仅 Host brief 未跟踪） |
| 审查基准 | issue #350 正文 + AC1–AC8（`wiki/raw/task_issue-350.md`）；ADR 0026（已接受）；SA6 验收契约（approve）；SA8 前置门禁与实现后复审（均 clear）；CONTEXT.md L116–118「原子变更」词条；模块 AGENTS（doc-runtime / namespace-runtime） |
| Owner 评论 | 无（dispatch 预读确认）——无额外映射义务 |
| 审查方式 | 静态审查（SA10 纪律：不运行测试、不改代码/设计/测试）；动态证据引用 SA7 报告并核对其与被审 diff 的一致性（SA7 所审「HEAD 211c5fa + 未提交 diff」与本 commit 内容逐文件吻合，`git status` 干净） |
| **Verdict** | **approve**（AC1–AC8 全达成；无 unmet/partial/unachievable 项；无 scope creep；下文 MINOR 均不阻断） |

---

## 1. Diff 范围核对（无 scope creep）

生产改动恰 2 文件、守卫登记 1 文件、测试 6 文件、wiki 证据文书 9 文件：

- `packages/doc-runtime/src/mutation.ts`（+250/−14）：双形态分发、E1–E5、逐操作 prepare 聚合、阶段 C 组合期望边界、单事务按序提交 + 逐操作验证、两公共类型、包内 `MAX_BATCH_OPS=16`（不导出）、单操作解析核抽取。
- `packages/doc-runtime/src/index.ts`（+2）：`BatchedMutation`/`MutationEnvelope` **类型**导出（无新值导出）。
- `packages/doc-runtime/test/public-surface-type-guard.test-d.ts`（+27）：正例 + 三类 `@ts-expect-error` 编译期负例。
- 新增测试：SA6 两契约文件（断言零改动、由实现转绿）+ 设计 §12.1 两共享边界文件 + SA7 两补充文件（TD/NF，纯测试侧）。
- **DENY 面零改动**（diff stat 实证）：`namespace-runtime/src/**`、`namespace-diagnostic-log/**`、`mutation-local.ts`、`install-verify.ts`、`packages/vfsl/**`、`docs/**`、`CONTEXT.md`、`.agents/**`、复制/wire/持久面全部未触。

## 2. Issue AC 逐条核对

| AC | 实现落点 | 验收证据（committed 测试） | 判定 |
|---|---|---|---|
| AC1 全合法批量 → 单事务按序提交、全部值落盘、观察者要么见全部要么不见 | `applyValidatedMutation` 批量分支：单 `transactGuarded` 内按序 `commitPrepared`；事务后按序 `verifyBoundaryIntact` | B1（1 事务 1 update、update 时刻 observed 恰一全效态）、B2、R1、S1–S7、NS-1 | ✅ met |
| AC2 任一失败 → ok:false + **聚合**全部失败操作 issues（非 fail-fast）+ 文档逐字节不变 | P 循环逐元素 `prepareLocalMutation`，`{kind:'fail'}` 整体追加、按 ops 序拼接、事务前裁决（禁 write-then-undo 保持） | B3（≥2 issues、`atN < atA`、字节不变、0 事务 0 update）、R2、NS-2（记录面 `issues.policy='full'`、顺序=ops 序） | ✅ met |
| AC3 形状错误零写入无码：双形态同现 / ops 空数组 / 超 16 / 元素非完整信封 / 元素未知键（含 guard）/ 批内嵌套 | E1 顶层键封闭（含 `op` 同现=双形态、其余=未知键）→ E2 数组/非空/≤16 → E3 逐元素同一解析核（封闭键集天然排 guard 与未知键）→ E4 `set([])` 禁令 → E5 两两非嵌套（拒绝域精确「祖先-后代或相同」，兄弟放行） | B5（16 接受/空/17 拒）、B6（九类矩阵含顶层未知键）、B7（兄弟 anchor + 嵌套/相同拒）、R4（rejected/validation/`code===undefined`/无 effect/digest） | ✅ met |
| AC4 跨实体路径批量同样原子 | 单 Yjs 事务覆盖整个 doc | B2（不同 Record 条目 + 不同集合四动词）、R1、S6、NS-1 | ✅ met |
| AC5 单操作形态（无 ops）逐字节不变 | 分发为纯读（`plainObjectOf`+`Object.hasOwn`）；无自有 `ops` 键的输入走原路径原代码；`parseMutation` → `parseMutationCore(input,'')`，13 处消息模板空前缀插值 = 字符级等价（diff 逐条核）；提交/验证编排零改动 | N1–N4（四动词/失败单 issue/`未知信封键 "zzz"（操作 set）` 文案锚/`set([])` legacy）、R3 前段、R5、R6；SA7 全仓回归 345 文件/3629 用例绿 | ✅ met |
| AC6 一尝试一条记录、单事务单条 update bytes（对照顺序写 N 条） | namespace-runtime 与诊断包零改动；批量封闭在 S5 单次调用内；D-B 捕获窗口天然单条 owned bytes | R3（3 顺序写=3 条对照、批量第 4 条 committed/update、基态+bytes 重放见全部值）、R4、NS-1、NS-2 | ✅ met |
| AC7 端到端公共面透传、lifecycle 停接纳次序不变 | `mutateData(mutation: unknown)`/接纳门零改动 | R1（透传 ok:true）、R5（close 后零入队/Proxy 零访问/`RUNTIME_WRITE_DISABLED`/`not-accessed`）、R7（排队期改动 → 槽起点快照获胜）、NS-1 | ✅ met |
| AC8 根 `pnpm typecheck` + 相关测试通过 | — | SA7 证据：根 `pnpm typecheck` exit 0（tsc -p ×14）；根 `vitest run --typecheck` 345 文件/3629 用例绿、Type Errors no errors；两包 76 文件/774 用例绿；6 个 issue-350 文件 36/36 绿 | ✅ met（见 §6 观察 3 的运行窗口说明） |

## 3. ADR 0026 条款核对

| 条款 | 核对结果 |
|---|---|
| L28–29 双形态互斥；ops 非空 ≤16；元素完整单操作信封；元素禁 guard | ✅ E1–E3 逐项兑现；`MAX_BATCH_OPS=16` 包内常量不导出（开放问题 1 纪律）；元素 guard 即刻形状错误（`批量元素 #i：未知信封键 "guard"…`） |
| L30 批内路径互不嵌套，解析期拒绝 | ✅ E5 严格段 `===` 两两判定，位于任何 prepare 之前；共享边界兄弟路径未误扩（B7/S1–S7 正例同过） |
| L34 槽内次序：逐操作 prepare → 任一失败整体零写入 → 单事务按序提交 → 逐操作边界验证 | ✅ 逐字兑现；阶段 C 组合期望边界为保持 E201-C 冻结语义（0007 #237 §5 只对真实偏离触发）的实现层填充——SA8 实现后复审裁 no-conflict；SA7 TD-0–TD-3/NF-1 证明伪触发消除且真实偏离仍检出（验证不空转） |
| L35 跨实体同样原子（Yjs 事务覆盖整个 doc） | ✅ |
| L36 最小 edit 不以载体降级换取 | ✅ E4 排除 `set([])` ⇒ 批量元素结构性只走局部管线；B4（700k 兄弟字段下 update <1000B + unrelated 载体身份保持） |
| L40–42 错误域：形状错误无码不可重试；操作失败聚合全部 issues；fatal 通道不变、无新增稳定码 | ✅ 形状/聚合/组合三类失败均返回无码 `ok:false`（R4 `code===undefined`）；fatal 仍 E201-C/D、E203、E204（phase 三值联合未动）；E205 仍为既有 catch **返回**单 issue；`errors.ts`/`fatal.ts` 零 diff |
| L46 一写槽=一尝试=一条诊断记录；单事务单条 update bytes | ✅ R3/R4/NS-1/NS-2 逐项断言 |
| L50–51 边界：复制 apply/`replaceSchema` 不适用；跨实例语义不变 | ✅ 相关路径零 diff；SA7 P-A 复制合并冒烟（批量单条 update 与等价顺序写合并等价、逆序/并发收敛） |
| L55 与 0025 组合：批内元素永不携带 guard；顶层 guard 不实现不预留半成品 | ✅ 元素 guard 即拒；顶层 `{ops, guard}` 经 E1 按未知键 loud 拒（无半成品） |
| L65–69 后果义务 | 单操作逐字节不变 ✅；CONTEXT.md「原子变更」词条在位（L116–118，随 `211c5fa` 完成）；验证门槛（批量解析/prepare/单事务测试、端到端与诊断单条测试、根 typecheck+test）✅ 经 SA7 证据满足 |

## 4. 接受契约（SA6）与上游义务核对

- **B1–B8/N1–N4、R1–R7**：两契约文件断言零改动提交、由实现转绿（SA3 前后对照：13 红 → 19/19 绿；SA7 复跑 36/36）。红转绿纪律保持。
- **B8 `set([])` 元素边界**：设计裁定闭口 B（形状错误零写入，与 ADR 0008 L47 唯一性句最一致），SA8 就地裁决成立；decision-neutral 断言在闭口 B 下闭合并保持确定性。单向化升级列为 SA6 follow-up（已披露、非阻塞）。
- **SA1/SA3 三义务**：① `set([])` 封口 ✅；② 公共类型定型 + 守卫登记 ✅（`BatchedMutation`/`MutationEnvelope` 仅经 `src/index.ts` 类型导出；type-guard 正例投影 + 双形态/元素 guard/非信封三类编译期负例；值面守卫不动）；③ 聚合经 R9 同源透传、emission 槽外、无新增 operation/stage/result 词与稳定码 ✅（NS-2 记录面断言 + 诊断面零 diff）。
- **S8 fixture 唯一偏差**：设计 iteration 2 字面 union fixture 在 HEAD 不可执行（空值仲裁恒选成员 0 ⇒ 单操作即 E204，pre-existing 行为），SA3 以镜像成员构造等价替换（ops 与断言语义逐字不变），经 SA4 独立复核、SA8 no-conflict 裁定、设计 iteration 3 回写闭合。证据链完整，无静默分歧。

## 5. 公共面与生命周期核对

- **公共面纪律**（doc-runtime AGENTS「Add public APIs only through src/index.ts; public-surface guard tests must account for every export」）：✅ 两类型仅经 `src/index.ts` 导出、无新值导出、守卫两面对应登记。
- **typed-access 完成门**：✅ `BatchedMutation = { ops: readonly ValidatedMutation[] }`——元素可经生成 `PathPatchValue` 静态组装；`applyValidatedMutation` 参数类型与 `mutateData(unknown)` 不动，零迁移涟漪。
- **lifecycle**：namespace-runtime src 零改动 ⇒ S1–S7 槽序、S3 整信封快照、停接纳先于输入访问、fatal 永久禁写读保留全部结构性保持（R5/R6/R7/NF-1 锚）。
- **诊断生命周期**：一槽一记录、rejected 禁 update、槽外 emission、词表/record 形态冻结——诊断包与 `diagnostic.ts` 零 diff 实证。

## 6. Non-blocking observations（不阻断 approve）

1. **doc-runtime 契约文件头注陈旧措辞**：`issue-350-batch-envelope-red.test.ts` L25 写「B7 的 decision-neutral 断言」，实际 decision-neutral 用例为 B8（SA6 §12 契约文本正确）。头注还保留「红灯现状（HEAD 211c5fa）」与「未决边界」描述——属刻意的契约留档（断言零改动纪律），建议随 SA6 follow-up（B8 单向化）一并刷新。
2. **SA7 两补充测试文件超出设计 ALLOW 列表**（设计只列 2 个新增测试文件）：`issue-350-sa7-batch-divergence.test.ts`（TD-0–TD-3）与 `issue-350-sa7-batch-fatal.test.ts`（NF-1）为纯测试侧回归锚，钉住批量 E201-C 真实偏离（此前无确定性触发覆盖），生产代码零改动，SA7 §7 已按技能「必要的补充测试」与仓内先例留证。流程注记，非业务范围蔓延。
3. **AC8 全仓运行窗口**：SA7 全仓 `vitest run --typecheck`（345/3629 绿）启动于 2 个补充测试文件创建之前；该两文件经两包全量合跑（76/774 含同包全部文件）+ 根 typecheck + 删除探针后 6 文件复跑（36/36）覆盖，SA7 已作 Deviation 1 留证。三证据合取满足 AC8 入口要求。
4. **`mutation.ts` L569 `未知操作` 分支未加 `${prefix}`**：`Object.hasOwn(specs, op)` 前置过滤后结构性不可达的防御死代码，可观察行为零影响（SA4 观察 2，备查）。
5. **ROOT 级 record 边界折迭、非 set 空路径元素、直调 `{ops:undefined}` E2 兜底无专测**：均为 SA4 §12 观察 4–6 已核低风险项（统一谓词/同款路由静态成立），留 SA6 契约吸收轮补锚。
6. **流程缺角（已在链上披露）**：设计后冲突复审产物缺失于 `wiki/raw/`；`set([])` 封口的 ADR 符合性由 SA8 实现后复审就地裁决（其 Required action 4 记录）。证据链完整（SA2 approve + SA8 clear）。
7. **pre-existing 行为转移观察**：空值歧义 union 上单操作写非首成员字段即 E204（HEAD 既有、DENY 路径、与本 diff 无关）——SA8 Required action 5 已建议转独立评审/issue，不属本票义务。

## 7. 结论

**approve**。已提交最终 diff 忠实满足 issue #350 正文与 AC1–AC8、接受契约与 ADR 0026 全部条款：原子性（写序列器 FIFO 独占 + 单 Yjs 事务、逐操作 prepare/提交/验证）、零写聚合（形状 fail-fast 单 issue、操作失败跨操作按 ops 序聚合、组合失败 fail-closed）、形状矩阵（双形态/空数组/超 16/元素非完整/未知键含 guard/嵌套/`set([])` 元素）、兼容性（单操作逐字节不变、旧输入零影响、带 ops 信封的演进经 SA8 裁定合法）、诊断（一尝试一记录、单条 owned update bytes、词表冻结）、公共面（两类型经 index.ts + 守卫登记）与生命周期（停接纳次序、fatal 通道、复制/wire/META/readData 零改动）全部达成；DENY 冻结面经 diff 实证零扰动。无 unmet/partial/unachievable 项需在 PR 披露；§6 各项均为已披露的非阻断观察或既有 follow-up 路由。
