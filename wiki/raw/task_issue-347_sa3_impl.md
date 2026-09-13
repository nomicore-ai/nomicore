# SA3 Implementation Report — issue #347 条件写核心（guard I）

- 任务：issue #347「条件写核心：doc-runtime 信封解析、槽前评估与 `MUTATION_GUARD_MISMATCH`（guard I）」
- 角色/轮次：SA3（mabf-sa3，iteration=0，implementation）
- 实现基线：`mabf/issue-347` @ `1b55d5c`（= `origin/adr0025-guarded-mutation`；ADR 0025/0026、CONTEXT 词条、
  typed-access guard 小节、#350 批量信封实现均已就位）
- Owner 评论：无（REST `comments=[]`；brief §Comments / SA6 §2 / SA8 §1 一致）——无额外 owner 要求，
  任务要求完全来自 issue 正文 AC1–AC9 + ADR 0025（含 0026 组合节）

## Inputs consumed

| 输入 | 用途 |
|---|---|
| `wiki/raw/task_issue-347.md`（brief，AC1–AC9，comments=[]） | 任务要求与验收条目 |
| `wiki/raw/task_issue-347_design.md`（SA1 设计，§5 D1–D9/§10 范围/§12 验收映射） | 实现落点、ALLOW/DENY、类型与错误域 |
| `wiki/raw/task_issue-347_sa2_review.md`（approve，无 BLOCKER/MAJOR；N1–N9 MINOR） | 修订落实与残余项处理 |
| `wiki/raw/task_issue-347_sa6_contract.md`（approve；§12.1 冻结测试路径与 §12.2–§12.9 用例表） | 红灯契约用例落地规格（G/M/O/S/N/P/T/E 组） |
| `wiki/raw/task_issue-347_relevant_decisions.md` / `…_conflict_report.md`（SA8，verdict clear） | ADR 条款、冻结面、required actions 1–5 |
| 源码 `packages/doc-runtime/src/{mutation,read,index}.ts`、`packages/namespace-runtime/src/{write,diagnostic}.ts`、诊断投影 | 复用底座与零改动面核验 |
| 既有测试 `issue-350-batch-envelope-red.test.ts`、`public-surface-guard.test.ts`、`public-surface-type-guard.test-d.ts`、ns-runtime `issue-350-batch-envelope-red.test.ts` | fixture 形态复用与冻结锚（负控） |

## Existing worktree reconciliation

- 进入时 `git status`：无任何已修改的实现/测试文件；仅有 Host 预置的 `wiki/raw/task_issue-347*.md`
  未跟踪文件。无既有 `task_issue-347_sa3_impl.md`，无未提交实现需修订。
- 基线自检：`NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run packages/doc-runtime/test`
  → **27 文件 / 402 用例通过、Type Errors no errors**（与 SA6 §4/§14 基线逐字一致）。
- 全部改动按最新设计从零落地，无过时/冲突实现需要删除。

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/doc-runtime/src/mutation.ts` | §5 D2–D8 | `MUTATION_GUARD_MISMATCH` 常量、`MutationIssue.code?`、`MutationGuard`/`GuardedMutation`/`BatchedMutation.guard?`/`MutationEnvelope`；`parseMutationCore` 第三参 `allowGuard` + 可选键旁路；新增 `parseGuard`/`containsNonFiniteNumber`/`evaluateGuard`/`isAbsentGuard`/`mismatchIssue`/`renderGuardPath`/`summarizeLogicalValue`/`truncateSummary`；`prepareMutation` 与 `prepareBatchMutation` 插入 E6 + G 评估；头注 JSDoc 同步 ADR 0025 |
| `packages/doc-runtime/src/index.ts` | §5 D9 | 追加值导出 `MUTATION_GUARD_MISMATCH` 与类型导出 `MutationGuard`/`GuardedMutation`；头注同步 |
| `packages/doc-runtime/test/issue-347-guard-envelope-red.test.ts` | SA6 §12.1（冻结路径）/§12.2–§12.7、§12.9 | 新建：G1–G9、M1–M10（含 M6b）、O1–O3、S0–S11、N1–N4、P1/P2 共 41 用例（红→绿） |
| `packages/namespace-runtime/test/issue-347-guard-passthrough-red.test.ts` | SA6 §12.1（冻结路径）/§12.8 | 新建：E1–E7 共 7 用例（e2e 透传/诊断/分层负控，红→绿） |
| `packages/doc-runtime/test/public-surface-guard.test.ts` | §5 D9 / SA6 §12.7 P4 | 追加 P4 值导出审计断言（存在性 + 字符串型 + 冻结字面量）；既有 3 断言原样 |
| `packages/doc-runtime/test/public-surface-type-guard.test-d.ts` | §5 D9 / SA6 §12.9 T1 | 追加 T1a/T1b/T1c（`MutationGuard` 正例与 path 投影、四类编译期负例、`GuardedMutation.guard?` 投影） |
| `wiki/raw/task_issue-347_sa3_impl.md` | 技能固定产物 | 本实现报告 |

## SA2 Finding 落实

| Finding | Implementation | Result |
|---|---|---|
| BLOCKER/MAJOR：无 | — | 无需修订 |
| N1（§14/§13 交叉引用失准） | 属设计文档笔误，未涉实现 | 记录不处理（不影响实施） |
| N2（D6 不可达边界备注自相矛盾） | 实现采用同节选定次序：parse → `derived.structure` root fatal 检查 → guard 评估 → 分叉（单操作）；E1–E5 → E6 → root 检查 → G → P（批量） | 已按选定次序落位，无两种互斥次序 |
| N3（`parseGuard` 相对 op 字段检查位次未钉死） | 采纳推荐：op 自身全部形状检查通过后才调 `parseGuard`（`parseMutationCore` 末尾），非 guard 缺陷消息保持既有优先级 | 已落实（注释标注 SA2 N3） |
| N4（`GuardedMutation` 审计锚缺失） | T1c 追加 `GuardedMutation` 正例与 `guard?` 投影断言（另 T1b 覆盖 `MutationGuard` 四类负例） | 已落实 |
| N5（E8 序列器竞争用例） | 契约增强项（非 #347 AC）；本次以 E2–E5 透传 + G9/M6b 批前语义覆盖 | 未实现，记入 Deferred（非阻塞） |
| N6（M9 映射记账） | M9 已按契约 §12.3 落地为独立用例（拒绝 → 状态改写 → 重放通过） | 已落实 |
| N7（摘要截断成本/回退纪律） | `summarizeLogicalValue`：`JSON.stringify` 后截断（单侧 ≤256 字符 + `…(截断)`）；抛错或返回非字符串 → `<不可序列化：类型>` | 已落实 |
| N8（R1 批量未知键消息尾失真） | 保消息：`未知信封键 "k"（批量信封只允许 "ops"）` 逐字节不变（N2 钉住） | 保持，记入残余 R1 |
| N9（`equals: undefined` 静态/运行时差异） | 运行时按设计 ⑤a 拒为形状错误（S10）；类型保持 `equals: unknown`（不引入 `unknown` 减 `undefined` 的脏写法） | 已落实，e2e 面由 S3 先拒（E6 负控绿） |

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/doc-runtime/src/mutation.ts` | ALLOW 行 1（D2–D8 唯一实现文件） | guard 解析/形状校验/评估/稳定码/公共类型 |
| `packages/doc-runtime/src/index.ts` | ALLOW 行 2（D9 公共入口） | 两导出（值 + 类型） |
| `packages/doc-runtime/test/issue-347-guard-envelope-red.test.ts` | ALLOW 行 3（SA6 §12.1 冻结路径） | doc-runtime 直打契约用例 |
| `packages/namespace-runtime/test/issue-347-guard-passthrough-red.test.ts` | ALLOW 行 4（SA6 §12.1 冻结路径） | mutateData 端到端透传用例 |
| `packages/doc-runtime/test/public-surface-guard.test.ts` | ALLOW 行 5（P4 审计追加） | 公共面值导出审计 |
| `packages/doc-runtime/test/public-surface-type-guard.test-d.ts` | ALLOW 行 6（T1 类型用例追加） | 公共面类型守卫 |
| `wiki/raw/task_issue-347_sa3_impl.md` | 技能固定产物（实现报告） | 本报告 |

DENY LIST 核验：`packages/namespace-runtime/src/**`（含 `write.ts`/`diagnostic.ts`）、
`packages/namespace-diagnostic-log/**`、`packages/doc-runtime/src/read.ts`、
`packages/doc-runtime/src/mutation-local.ts`、doc-runtime 其余 src、`issue-350-*` 冻结锚、
ADR/CONTEXT/typed-access、wire/复制、配置与 lockfile **全部零改动**（`git status` 仅上表 7 路径）。
grep 核验：namespace-runtime/诊断包源码零改动（R9 `diagValidation` 无顶层 code；稳定码仅经
`issues.items[].code` 结构透传）。

## Verification

| # | Command | Result | Evidence |
|---|---|---|---|
| V1 | 红灯（实现前，HEAD 工作区含新测试）：`NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run packages/doc-runtime/test/issue-347-guard-envelope-red.test.ts packages/doc-runtime/test/public-surface-guard.test.ts packages/namespace-runtime/test/issue-347-guard-passthrough-red.test.ts` | **3 文件失败；42 failed / 10 passed（52）** | 失败原因全部为目标行为缺口：G/M/O/P 组 `ok:false`（`未知信封键 "guard"`）、`issue.code === undefined`、`ns.MUTATION_GUARD_MISMATCH === undefined`；S 组 `message` 匹配 `/未知信封键\s*"guard"/`。10 个绿者恰为负控（N1–N4、E1、E6、E7 + 既有公共面 3 断言） |
| V2 | 类型面红灯（实现前）：`./node_modules/.bin/tsc -p tsconfig.typecheck.json --noEmit` | 失败：`TS2339: Property 'code' does not exist on type 'MutationIssue'`（8 处）、`TS2305: no exported member 'MutationGuard'/'GuardedMutation'`、`TS2578` ×4 | T1/P2 类型面与运行时面同步红 |
| V3 | 绿灯（实现后，命令同 V1） | **3 文件通过；52 passed（52）**，Type Errors no errors | 契约全组转绿 |
| V4 | 类型面绿灯：`./node_modules/.bin/tsc -p tsconfig.typecheck.json --noEmit` | **exit 0** | 无 TS2578 ⇒ T1b 四条 `@ts-expect-error` 负例全部真实命中共编错误（fail-closed 已验证） |
| V5 | 受影响 package 全目录：`… vitest run packages/doc-runtime/test` | **28 文件 / 447 用例通过**（基线 27/402；+1 文件 +45 用例 = 新 41 + P4 + T1×3），Type Errors no errors | 既有 402 用例零回归（含 #350 B5–B7 冻结锚、元素 guard 拒绝） |
| V6 | 受影响 package 全目录：`… vitest run packages/namespace-runtime/test` | **50 文件 / 379 用例通过**，Type Errors no errors | e2e 面零回归（含 #350 R1–R7、写槽/诊断/生命周期） |
| V7 | 设计 §12 AC9 门槛：根 `pnpm typecheck` | **exit 0**（13 个 tsconfig 顺序编译） | 根类型门全绿 |
| V8 | 设计 §12 AC9 门槛：根 `pnpm test`（= `vitest run --typecheck`） | **349 文件 / 3686 用例通过**，Type Errors no errors，**exit 0**（587.9s） | 全仓回归零失败 |

关键行为证据摘要（V3 全绿细节）：

- G1–G9：四动词 + `set([])` legacy + 批量顶层 guard 满足均 `ok:true` 落盘；批量恰 1 事务 1 update（guard 不破坏整批原子）；G9（guard 读批前 committed）与 M6b（同批量改为批后意图值 → 拒绝）反向对照成立。
- M1–M10：`ok:false`、恰 1 issue、`code === 'MUTATION_GUARD_MISMATCH'` 且与 `src/index.ts` 导出同源、`issue.path` 深等 guard 路径、`Y.encodeStateAsUpdate` 逐字节不变 + 0 事务 + 0 update；M4 message 含实际值且匹配 `/absent|无值|不存在|缺失|有值/i`；M8（1 MiB equals）message 有界（< 64 KiB，实测 ≈ 300 字符）；M10 证明非子集不满足。
- O1/O2/O3：guard 不满足 + 新值非法 → 只报 guard（无 `类型不匹配`）；guard 满足 → schema 管线可达（有 `类型不匹配` / 聚合 ≥2 无码 issue）。
- S0–S11：合法 guard anchor 先行通过；形状族全部 `ok:false`、单 issue、`code === undefined`、零写入、`message` 不含 `未知信封键 "guard"`（含设计 §5 D4 三项裁定 S9 未知键 / S10 `equals: undefined` / S11 `{guard: undefined}`）。
- N1–N4：无 guard 四动词/批量/`set([])`/`zzz` 未知键文案与零写入、元素携带 guard 无码拒绝全部保持。
- E1–E7：E2–E5 经 `mutateData` 透传；E3/E5 诊断恰 1 条 `stage=validation`/`result.rejected`/record 级 `code === undefined`/`issues.items[0].code === MUTATION_GUARD_MISMATCH`、notifier 0、字节不变；E6 固化 S3 层 `MUTATION_INPUT_NOT_PLAIN_DATA`（stage=`input-snapshot`、record 级码）分层负控；E7 元素 guard 无码零写入。

## Deviations or blockers

**无阻塞。** 一项设计级偏离（需冲突复查）与两项测试机制说明：

1. **`MutationGuard` 静态面 fail-closed 收紧（设计 §5 D1，`requiresConflictRecheck` 请复核）**：
   设计 D1 声称 T1 四类负例「由联合 + 对象字面量 excess-property 检查自然成立」。实测 TS
   联合类型 EPC 只拒绝「不存在于任一成员」的键，故字面联合
   `{path; equals: unknown} | {path; absent: true}` **静态接纳** `{path, equals: 1, absent: true}`
   （编译期 `TS2578 Unused '@ts-expect-error' directive` 实证），即契约 §12.9 T1「equals 与 absent
   同现 → 编译期报错」在字面联合下不可达。实现改为 exclusive-union 惯用法
   `{path; equals: unknown; absent?: never} | {path; absent: true; equals?: never}`：合法值集合
   与 ADR 0025 定稿一致（两成员本就不存在对方的键），仅额外静态拒绝「同现/显式 undefined」，
   与运行时 `parseGuard` ③a/⑤a 拒绝面完全一致。另新增 `isAbsentGuard` 谓词显式化收窄（可选
   `never` 键不影响调用点判别）。运行时语义、错误域、导出名与冻结面零变化。请 SA8 按设计
   §15 的 design 冲突复查一并核对本类型面收紧。
2. **T1a 联合断言机制**：`expectTypeOf(numericEqualsGuard)` 用 `toMatchTypeOf<MutationGuard>()`
   而非 `toEqualTypeOf`（vitest 的 `toEqualTypeOf` 对联合类型触发 TS2344；既有文件对
   `MutationEnvelope` 联合亦用 `toMatchTypeOf`）。正例合法性、`guard.path` 投影与四类负例均按
   契约保留，未弱化断言。
3. **设计 §5 D4 三项裁定（S9/S10/S11）与 message 预算收紧（<1 KiB）** 按设计实现并加测；
   这三项超出 SA6 契约冻结表（其 §15 未决项 + 设计 §13 R2 回写请求），属于回写面升级，
   不构成契约弱化（两态可判别性断言全部保留）。

## Deferred verification

| 项 | 责任方 | 说明 |
|---|---|---|
| SA6 契约回写升级（S9、`equals: undefined`、`{guard: undefined}`、<1 KiB 预算、T1 四类负例） | SA6 下一轮 | 本实现已按设计落地并加测；契约表待同步 |
| ADR 0025 L90「序列器竞争」显式用例（E8：同槽排队两写，后写 guard 见前写 committed） | SA6/SA7 | 契约增强项，非 #347 AC；本次以 E2–E5 + G9/M6b 覆盖透传与批前语义 |
| 设计后 ADR 冲突复查（设计 §15 `requiresConflictRecheck: true`） | SA8 | 尤其 E1 键封闭演进、元素级 guard 维持拒绝、单操作无 guard 逐字节不变、写槽 R9 零改动四点 + 本报告偏离 1 的类型面收紧 |
| 独立代码审查 / 最终动态验证 / CI | SA4 / SA7 | SA3 仅完成契约红转绿、受影响 package 与设计指定门槛（V1–V8） |
| R1 残余：批量顶层未知键消息尾「只允许 "ops"」语义略窄 | follow-up | 保冻结面消息的必然取舍；演进须与 #350 冻结锚联动评审 |

## Suggested commit message

```
fix(#347): doc-runtime 条件写核心：guard 信封解析、槽前评估与 MUTATION_GUARD_MISMATCH（ADR 0025）

- mutation.ts：四操作与批量顶层可选 guard（E1 键封闭演进；元素维持禁 guard）、
  parseGuard 形状错误族（无码不可重试）、prepare 阶段纯读评估（equals 深相等 / absent）、
  MutationIssue.code 载体与 MUTATION_GUARD_MISMATCH
- index.ts：新增值导出 MUTATION_GUARD_MISMATCH 与类型导出 MutationGuard/GuardedMutation
- 新增 issue-347 契约测试（doc-runtime G/M/O/S/N/P + ns-runtime E）+ 公共面审计 P4/T1
```

（仅供 Controller 选择；SA3 不执行 commit/push/PR。）
