# SA6 诊断与验收契约 — issue #347 条件写核心（doc-runtime 信封解析 / 槽前评估 / `MUTATION_GUARD_MISMATCH`，guard I）

- 任务类型：**feature**（能力缺口证明 + 目标行为验收契约；不虚构 Bug 根因）
- 被审对象：issue #347「条件写核心：doc-runtime 信封解析、槽前评估与 `MUTATION_GUARD_MISMATCH`（guard I）」
  （brief `wiki/raw/task_issue-347.md`；State: open；Blocked-by #350 已在基线内满足）
- 诊断基线：HEAD `1b55d5c431982a9672b0c162b64f8366089c7654`（2026-09-13T08:02:53+08:00，
  「fix(#350): 原子变更信封：mutateData 批量 ops 多操作全有或全无（ADR 0026，guard 前置）(#354)」），
  worktree `/home/wangjian/nomicore-fix-issue-347`，分支 `mabf/issue-347`
- 结论：**approve**（能力缺口稳定可证、契约可执行且红在正确断言处、负控全绿、测试入口真实；一项
  接口口径 `issue.code` 属 SA6 解释性裁量并显式提请 SA1 批准/回写，见 §12/§15）
- 本轮范围声明：按 dispatch「do not implement code or tests」，**不实例化生产代码与测试文件**；
  验收契约以「用例 ID — 最小输入 — 可观察断言 — 旧/新预期」完整规格冻结于 §12，测试文件路径与
  用例 ID 已冻结，供 SA1 设计核对、SA3 实现前由 SA6 下一轮（或实现阶段）按表落地为红灯测试。

---

## 1. Task type and inputs

| 输入 | 用途 |
|---|---|
| `wiki/raw/task_issue-347.md` | Host task brief：issue #347 正文、AC1–AC9、What to build、Blocked-by #350 |
| `wiki/raw/task_issue-347_conflict_report.md` | SA8 前置门禁：逐条决策分类、零 override、冻结面、移交义务、verdict `clear` + `requiresConflictRecheck: true` |
| `wiki/raw/task_issue-347_relevant_decisions.md` | SA8 决策摘录（ADR 0025/0026/0007/0008/0002/0011/0014/0016/0023 + 基线源码事实） |
| `docs/adr/0025-guarded-mutation-conditional-write.md` | 主决策（已接受，commit `a9df692`；含与 0026 组合节） |
| `docs/adr/0026-atomic-mutation-envelope.md` | 批量信封与顶层 guard 组合约束（已接受，commit `211c5fa`/实现 `1b55d5c`） |
| `docs/adr/0007`（#237 修订节）、`0008`、`0002`、`0011`、`0014`、`0016` | 四操作契约 / 零写入 / 写槽槽序与载体投影读取 / 词表封闭 / 诊断 issues 投影 |
| `CONTEXT.md` L113–122 | 「条件写（guarded mutation）」「原子变更」「写序列器」「零写入」词条 |
| 源码现状 | `packages/doc-runtime/src/{mutation,read,index}.ts`、`packages/namespace-runtime/src/{write,runtime,diagnostic}.ts`、`packages/namespace-diagnostic-log/src/{schema,projection/issues}.ts` |
| 既有测试 | `packages/doc-runtime/test/issue-350-batch-envelope-red.test.ts` B5–B7、`public-surface-guard.test.ts`、`public-surface-type-guard.test-d.ts`、`apply-validated-mutation-operations.test.ts` |

Issue 评论：**无**（REST 预读 `comments=[]`）——见 §2。

## 2. Owner comment mapping

| Owner 评论 | 映射 |
|---|---|
| （无） | 无额外 owner 要求或 override；契约完全由 issue 正文 AC1–AC9 + ADR 0025（含 0026 组合节）+ SA8 required actions 推导 |

## 3. SA8 constraints（逐条纳入）

| SA8 约束（来源：conflict report §2/§4/§7） | 本契约落点 | 证据 |
|---|---|---|
| 单操作四动词封闭键集纳入可选 `guard`；未知键 loud 拒绝不变 | G1–G9；N1–N2（`zzz` 文案与零写入不变） | `mutation.ts` `parseMutationCore` L534–572（specs L540–545、未知键 L549–550）；N3 现绿 |
| 批量 E1 顶层键封闭演进为 `{'ops','guard'}`；元素解析核**不加** guard | G8/G9/M6/M7/O3（顶层 guard）；N3（元素 guard 维持形状错误） | `prepareBatchMutation` L186–193；`issue-350-batch-envelope-red.test.ts` B6 L286–289 |
| 评估位置：单操作 parse 成功后、局部/legacy 分叉前；批量 E1–E5 后、逐 op prepare 前；槽内纯读、不进事务 | G5（legacy `set([])` 同样生效）；M7（guard 先于逐 op prepare）；O1/O2（先于 schema 校验） | `prepareMutation` L124–159（parse L132、分叉 L140）；`prepareBatchMutation` L233–249（P 循环 L239） |
| 谓词语义 = `readLogicalValueAtPath` 投影逻辑值 + `logicalValuesEqual` 深相等（undefined 键过滤）；`absent` 由 PATH_NOT_ALLOWED 或缺键吸收满足 | G6/G7、M3/M4/M5/M10（含方向相反的正负对照） | `read.ts` D4 L79/L85/L94；PATH_NOT_ALLOWED L107/L115；`mutation.ts` `logicalValuesEqual` L483–495 |
| guard 路径禁 `[]`；两态错误域（形状错误无码不可重试 / 评估不满足带 `MUTATION_GUARD_MISMATCH` 可重试） | S6；M1–M10（码 + 单 issue + path）；M9（可重试语义） | ADR 0025 L44、L53–58 |
| `MutationGuard` 类型与 `MUTATION_GUARD_MISMATCH` 经 `src/index.ts` 导出，公共面审计测试同步 | P1–P4、T1 | ADR 0025 L58/L87；`packages/doc-runtime/AGENTS.md` L14；`index.ts` 现零稳定码导出（probe） |
| 诊断经写槽 R9 透传（stage=validation、result=rejected）；namespace-runtime 写槽零改动；不给 `diagValidation` 加顶层 code | E3/E5（record 级 `code===undefined`、issue item `code===MUTATION_GUARD_MISMATCH`）；E6（S3 层顶层码保持原语义） | `write.ts` L187/L205–207；`diagnostic.ts` L269–273；`schema.ts` L139–146；`projection/issues.ts` L135/L164–170 |
| 冻结面：N3/B6 文案与元素 guard 拒绝、诊断 v1 record schema 指纹、wire 协议、写槽 R9、批量 E2–E5 约束 | N1–N4 与 E1/E6/E7 全绿；契约零触诊断 schema/wire/写槽 | §6 负控表；`namespace-diagnostic-log/AGENTS.md` 冻结指纹 |
| 测试分层知情：`equals` 含非有限数 / 值为 undefined 键经 `mutateData` 会被 S3 以 `MUTATION_INPUT_NOT_PLAIN_DATA` **先行**拒绝 | S7 以 doc-runtime 直打为唯一合法层级；E6 把 S3 先拒固化为**绿负控**并禁止在 e2e 层断言无码形状错误 | 运行时实测：`snapshotMutation` 与 `mutateData` 双层输出（§5/§6） |
| 未决设计边界：`issue` 携带码的字段形态属 SA1 设计裁量 | 本契约把可观察口径钉为 `issue.code`（见 §12 接口约定与 §15 提请批准项）；形状错误 `code===undefined` | ADR 0025 L58「携带稳定码」；仓内先例 `DiagnosticIssue.code?: string` |

## 4. Environment and baseline

| 项 | 值 |
|---|---|
| 环境 | Linux；node v24.13.0；pnpm 10.28.2；typescript 5.9.3；vitest 3.2.7；tsx 4.23.12 |
| 依赖 | `pnpm install --frozen-lockfile --prefer-offline`（65 包全部复用本地 store，0 网络下载） |
| 运行入口 | `NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run <path>`；根 `pnpm test` = `vitest run --typecheck`（include `packages/*/test/**/*.test.ts`，`maxWorkers: 1`） |
| 基线（绿） | `packages/doc-runtime/test` 全目录：**27 文件 / 402 用例通过**，`Type Errors no errors`（9.49s） |
| 根门槛（绿） | `pnpm typecheck`：13 个 tsconfig 顺序编译，exit 0（含 `packages/doc-runtime/tsconfig.json` → `src/**/*.ts` + `test/**/*.ts`） |
| fixture | 复用 #350 既有 doc-runtime fixture 形态（`parseVfsl`→`evaluate`→`materializeRoot`）与 namespace-runtime `createNamespaceRuntimeWithSeam` + memory persistence + real scheduler 装配；见 §12 |
| 生产实现改动 | 零（`git status` 仅新增本报告与 Host 预置 brief 文件；临时 probe/日志已按 §16 删除） |

## 5. Positive reproduction（能力缺口复现）

最小复现：临时 probe `packages/doc-runtime/probe-347.tmp.ts`（doc-runtime 层）与
`packages/namespace-runtime/probe-runtime-347.tmp.ts`（端到端层），逐字输出（state 后缀为
`{n,a,t1,values,more}` 投影摘要；两 probe 各重复运行 2 次输出逐字节一致）：

```
=== single-op guard（doc-runtime 直打） ===
set+guard.equals satisfied -> {"ok":false,"issues":[{"message":"未知信封键 \"guard\"（操作 set）","path":[]}]} | zeroWrite=true updates=0 ...
delete+guard.equals satisfied -> {"ok":false,"issues":[{"message":"未知信封键 \"guard\"（操作 delete）","path":[]}]} | zeroWrite=true updates=0 ...
array-insert+guard.absent satisfied -> {"ok":false,"issues":[{"message":"未知信封键 \"guard\"（操作 array-insert）","path":[]}]} | zeroWrite=true updates=0 ...
array-delete+guard.equals satisfied -> {"ok":false,"issues":[{"message":"未知信封键 \"guard\"（操作 array-delete）","path":[]}]} | zeroWrite=true updates=0 ...
set+guard.equals UNSATISFIED -> {"ok":false,"issues":[{"message":"未知信封键 \"guard\"（操作 set）","path":[]}]} | zeroWrite=true updates=0 ...
set+guard.absent UNSATISFIED (key present) -> 同上
guard mismatch + schema-invalid new value -> 同上
guard satisfied + schema-invalid new value -> 同上
=== single-op guard shape errors（全 11 例同款） ===
guard non-object (42) / guard null / equals+absent both / neither equals nor absent /
missing path / absent non-literal (1) / path segment type error / path [] / equals NaN /
equals Infinity / equals undefined-key filtered object
  -> {"ok":false,"issues":[{"message":"未知信封键 \"guard\"（操作 set）","path":[]}]} | zeroWrite=true updates=0
=== batch top-level guard ===
batch3+guard.equals satisfied -> {"ok":false,"issues":[{"message":"未知信封键 \"guard\"（批量信封只允许 \"ops\"）","path":[]}]} | zeroWrite=true updates=0 ...
batch3+guard.equals UNSATISFIED -> 同上
batch guard reads pre-batch committed (equals 1, ops write n=2) -> 同上
batch guard mismatch + invalid op value -> 同上
batch+guard.absent satisfied -> 同上
batch top-level guard shape error (both) -> 同上
batch element carries guard -> {"ok":false,"issues":[{"message":"批量元素 #0：未知信封键 \"guard\"（操作 set）","path":[]}]} | zeroWrite=true updates=0
batch no-guard anchor (3 ops) -> {"ok":true} | zeroWrite=false updates=1
batch top-level unknown key zzz -> {"ok":false,"issues":[{"message":"未知信封键 \"zzz\"（批量信封只允许 \"ops\"）","path":[]}]}
=== single-op set([]) legacy + guard ===
set([])+guard satisfied -> {"ok":false,"issues":[{"message":"未知信封键 \"guard\"（操作 set）","path":[]}]} | zeroWrite=true updates=0
set([])+guard unsatisfied -> 同上
=== 端到端（mutateData 面） ===
single no-guard set (control) -> {"ok":true} | zeroWrite=false updates=1 notifier=1 n=2 status="open"
single set + satisfied guard.equals -> {"ok":false,"issues":[{"message":"未知信封键 \"guard\"（操作 set）","path":[]}]} | zeroWrite=true updates=0 notifier=0
   diag records=1 [{"stage":"validation","result":{"kind":"rejected"},"issues":{"policy":"full","items":[{"message":"未知信封键 \"guard\"（操作 set）","path":[]}]}}]
batch + satisfied guard.equals -> {"ok":false,"issues":[{"message":"未知信封键 \"guard\"（批量信封只允许 \"ops\"）","path":[]}]} | zeroWrite=true updates=0 notifier=0
single set + unsatisfied guard -> 同 single-op 未知键拒绝
single set + guard.equals NaN (S3 layering) -> {"ok":false,"issues":[{"message":"MUTATION_INPUT_NOT_PLAIN_DATA: 非有限 number（NaN）","path":[]}]} | zeroWrite=true notifier=0
   diag records=1 [{"stage":"input-snapshot","result":{"kind":"rejected"},"code":"MUTATION_INPUT_NOT_PLAIN_DATA","issues":{...,"items":[{"message":"MUTATION_INPUT_NOT_PLAIN_DATA: 非有限 number（NaN）","path":[]}]}}]
single set + guard.equals undefined-key object (S3 layering) -> {"ok":false,"issues":[{"message":"MUTATION_INPUT_NOT_PLAIN_DATA: 键 \"gone\" 值为 undefined","path":[]}]}
batch element carries guard (shape error) -> {"ok":false,"issues":[{"message":"批量元素 #0：未知信封键 \"guard\"（操作 set）","path":[]}]} | zeroWrite=true notifier=0
=== public surface（src/index.ts） ===
public value exports -> ["DocRuntimeFatalError","applyValidatedMutation","createInitialDocument","extractYjsSnapshot","materializeRoot","readLogicalValueAtPath","replaceRootContent","replaceSchemaAndRoot"]
MUTATION_GUARD_MISMATCH present -> false
```

- 期望（ADR 0025 / issue #347 AC1–AC9）：合法 guard 且条件满足 → `{ok:true}` 且值落盘；评估不满足 →
  `ok:false` 单 issue + 稳定码 `MUTATION_GUARD_MISMATCH` + `issue.path` = guard 路径 + 零写入；
  形状错误 → 无码零写入拒绝；guard 先于 schema 校验；批量顶层 guard 同款；导出面新增 2 项。
- 实际：**任何携带 `guard` 的信封都在信封解析期被按「未知信封键」拒绝**（单操作 `未知信封键 "guard"
  （操作 <op>）`；批量顶层 `未知信封键 "guard"（批量信封只允许 "ops"）`）。`guard` 键不在
  `parseMutationCore` 任一动词封闭键集（`mutation.ts` L540–545），也不在批量 E1 顶层允许键
  （L187 `filter(key => key !== 'ops')`）——guard 的全部语义（解析、评估、两态错误域、导出）不存在。
  旧实现的「零写入」是未知键拒绝的副产物，不是条件写实现。
- 能力缺失的直接源码事实：`grep -rn "guard" packages/doc-runtime/src packages/namespace-runtime/src`
  的全部命中均为无关既有标识/注释（`transactGuarded`、`tx-guard.ts`、`guardIssue`（schema-replace
  形状检查局部名）、`read.ts`/`materialize.ts` 的「守卫」措辞，以及 `mutation.ts` L55/L205 注释中
  「元素不得携带 `guard`」的既有说明）——无任何读取信封 `guard` 键、评估谓词或导出稳定码的代码；
  `MutationIssue` 无 `code` 字段（`mutation.ts` L38–41）；`index.ts` 值导出面零稳定码（probe 上表）。
- 复现率：确定性 100%（同步纯函数 + 单写槽；两 probe 各 2 次运行输出逐字节一致）。

## 6. Negative control（当前全绿，实现后必须保持）

| 负控 | 断言 | 当前（实测） |
|---|---|---|
| N1 单操作四动词幸福路径（无 guard） | 各 `{ok:true}`、值落盘、各 1 次 update | 绿（probe L33–36） |
| N2 单操作未知信封键 `zzz` | `ok:false`、文案含 `未知信封键 "zzz"（操作 set）`、零写入 | 绿（probe L37；既有 N3 同锚） |
| N3 批量无 guard 三操作 | `{ok:true}`、全部落盘、1 update（单事务） | 绿（probe L30） |
| N4 批量顶层未知键 `zzz` | 拒绝、零写入（E1 封闭面保持） | 绿（probe L31） |
| N5 批量元素携带 guard（形状错误） | `ok:false`、无码、零写入（ADR 0026 L29；#350 B6 冻结） | 绿（probe L29） |
| N6 `set([])` legacy 无 guard | `{ok:true}` 全量重装（ADR 0008 L47） | 绿（既有 N4） |
| E1 端到端无 guard 单操作 | `{ok:true}`、readData 见值、notifier 1、1 update | 绿（probe 端到端第 1 行） |
| E6 S3 分层（`equals` NaN / undefined 值键） | `MUTATION_INPUT_NOT_PLAIN_DATA`、零写入、record stage=input-snapshot 带顶层码 | 绿（probe 端到端第 5/6 行） |
| E7 端到端元素携带 guard | 无码拒绝、零写入、notifier 0 | 绿（probe 端到端第 7 行） |
| 读投影底座 | 缺键 → `{ok:true, value:undefined}`（`value` 键存在）；标量穿越 → `{ok:false, code:'PATH_NOT_ALLOWED'}` | 绿（probe L39–43） |

## 7. Stability, scale and timing

- 全部契约断言为同步（doc-runtime 层）或单写槽内确定性观察（端到端层），无 sleep 阈值、无墙钟
  竞态、无并发调度依赖；重复运行输出逐字节一致（§5）。
- 规模：M8 用 1 MiB `equals` 值验证 message 截断（断言上界 64 KiB，见 §12）；shape 矩阵逐例独立
  fixture（≤6 字段小文档），无性能面断言。
- 时长：doc-runtime probe ~0.5s/次；端到端 probe ~1.5s/次；doc-runtime 全目录测试 9.49s；
  根 `pnpm typecheck` 全绿（本机实测，无超时/重试）。
- 无 skip/only/todo/env override；无软断言；无吞错。

## 8. Root-cause chain（能力缺口）

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| 1 | ADR 0025（+0026 组合节）已接受并要求：四操作信封可选 `guard`、两种形态顶层适用、评估先于 schema 校验与逐 op prepare、两态错误域、`MutationGuard`/`MUTATION_GUARD_MISMATCH` 公共导出 | `docs/adr/0025` L21–58、L72–74、L86–88；`docs/adr/0026` L29、L53–55；issue #347 AC1–AC9 | 高 |
| 2 | 单操作解析核按动词封闭键集（`set:['op','path','value']` 等），`guard` 不在任何键集 → 任一 `guard` 键入 `Object.keys(env).find(k => !allowed.includes(k))` 分支 → `未知信封键 "guard"` | `mutation.ts` L540–545（specs）、L549–550（unknown 判定）；probe L2–21 | 高 |
| 3 | 批量顶层 E1 恰允许 `{'ops'}`：`extra.filter(key => key !== 'ops')` → `{ops, guard}` 落 `未知信封键 "guard"（批量信封只允许 "ops"）` | `mutation.ts` L186–193；probe L23–28 | 高 |
| 4 | 因此不存在 guard 读取/评估路径：`applyValidatedMutation`/`prepareMutation`/`prepareBatchMutation` 全链零 `readLogicalValueAtPath` 调用、零深相等调用点（`logicalValuesEqual` 仅服务既有 union 成员仲裁）；`grep -rn "guard" packages/doc-runtime/src packages/namespace-runtime/src` 命中全部为无关标识/注释（`transactGuarded`、`tx-guard`、`guardIssue`、既有「元素不得携带 guard」注释） | `mutation.ts` L94–171、L181–250；`grep` 实测（§5） | 高 |
| 5 | 结果联合无稳定码载体：`MutationIssue = {message, path}`；`index.ts` 值导出面零稳定码 | `mutation.ts` L38–41；probe public surface 段 | 高 |
| 6 | 旧实现的「零写入」与「无码拒绝」是未知键拒绝的副产物：形状错误族与评估不满足族在旧实现下**不可区分**（同款未知键文案、同为零写入、同为无码） | probe L11–21 vs L6–7；端到端 diag record 两态同 `未知信封键 "guard"` | 高 |
| 7 | 端到端面同源透传：写槽 S5 把整信封交 `applyValidatedMutation`，领域失败经 R9 进 `MutateDataResult.issues` 与诊断 record（stage=validation/rejected） | `write.ts` L187、L205–207；`runtime.ts` L512；probe 端到端段 | 高 |
| 8 | 因 Step 4，guard 拒绝的审计收益（ADR 0025 L60）与 CAS 可重试语义（L58）在旧实现下不可达 | 端到端 probe：guard 信封一律 rejected、无 committed 记录 | 高 |

## 9. Causal experiments

| 实验 | 控制变量 | 观察 | 结论 |
|---|---|---|---|
| E1 信封键单点替换 | 同一 fixture/doc，仅把无 guard 的 `{op,path,value}` 追加 `guard` 键 | 无 guard `{ok:true}`；带 guard `{ok:false, 未知信封键 "guard"}` | 缺口被单点隔离在信封解析（键封闭），不在文档状态/值域/写槽 |
| E2 四动词同款对照 | set/delete/array-insert/array-delete 各带合法 guard 与其单操作无 guard 版本 | 四动词带 guard 全部同一 `未知信封键 "guard"` 文案（仅 op 名不同）；无 guard 全部 `{ok:true}` | 缺口与操作种类无关（键封闭统一实现） |
| E3 批量顶层 vs 单操作 | 同一 guard 对象分别置于 `{ops,guard}` 与单操作信封 | 两条不同未知键文案（`批量信封只允许 "ops"` vs `操作 set`），同一根因 | 两处封闭键集是同一缺口的两个落点（SA8 required action 1/2 的落点） |
| E4 读投影底座定标 | `readLogicalValueAtPath` 缺键 / 标量穿越 / 记录 / 数组下标 | 缺键 `{ok:true, value:undefined}`；标量穿越 `PATH_NOT_ALLOWED` | 谓词语义底座已在位（guard 只需复用），契约可对 equals/absent 两态做方向相反断言 |
| E5 S3 分层定界 | 同一 guard（`equals: NaN`、`equals` 含 undefined 值键）分别经 doc-runtime 直打与 `mutateData` | 直打：信封未知键（本轮）/目标为无码形状错误；`mutateData`：S3 `MUTATION_INPUT_NOT_PLAIN_DATA` 先拒（record stage=input-snapshot 带顶层码） | 形状族验收必须直打 doc-runtime；e2e 层该输入由 S3 裁决（既有两层模式，非缺陷） |
| E6 公共面定标 | `Object.keys(import * as ns from src/index.ts)` | 8 个值导出、无 `MUTATION_GUARD_MISMATCH` | 导出义务未兑现（AC7 红灯面） |
| E7 冻结面定标 | 无 guard 单操作/批量、元素 guard、`set([])`、`zzz` 未知键 | 全部与 #350 基线一致（§6） | 负控有效；实现必须不触碰这些通道 |

## 10. Impact surface

| 面 | 影响 |
|---|---|
| `packages/doc-runtime/src/mutation.ts` | `parseMutationCore` 四动词键集纳入可选 `guard` + guard 形状校验核；`prepareMutation` parse 后、分叉前插入纯读评估；`prepareBatchMutation` E1 允许 `guard` + E 校验后、P 循环前评估一次；`MutationIssue` 增可选码载体；`MutationGuard` 类型定义 |
| `packages/doc-runtime/src/index.ts` | 新增 `MutationGuard` 类型导出与 `MUTATION_GUARD_MISMATCH` 值导出（该包首个领域拒绝稳定码） |
| `packages/namespace-runtime/src/write.ts` | **零改动**：S3 快照（含 guard 的 plain data）与 S5 调用、R9 issues 透传原样；`MutateDataResult.issues` 为 `unknown[]`，可直接承载带 `code` 的 issue |
| `packages/namespace-runtime/src/diagnostic.ts` | **零改动**：`diagValidation` 无顶层码；guard 码经 issue 条目随 issues 投影保留（`schema.ts` `DiagnosticIssue.code?` + `projection/issues.ts` 保留/截断） |
| 诊断日志 record schema | 零变更（指纹冻结面不动）；guard 拒绝落 rejected/validation 记录，码在 `issues.items[].code` |
| 复制 / wire / `replaceSchema` / META | 零影响（ADR 0025 L64–66 边界外；契约零断言） |
| 既有测试 | 全绿面保持（doc-runtime 27 文件/402 用例；`issue-350-*` B5–B7 与 N1–N4 是冻结锚） |

## 11. Ruled-out hypotheses

| 假设 | 反证 | 结论 |
|---|---|---|
| H1 环境/fixture 损坏导致 guard 信封失败 | 同 fixture/doc 无 guard 四动词全部 `{ok:true}`；失败文案是领域拒绝（未知键）而非异常/超时；两 probe 确定性一致 | 排除 |
| H2 guard 已实现、只是被更早的写槽层拒绝 | S3 快照通过（`snapshotMutation({...guard:{path:['n'],equals:1}})` → `kind:'ok'`，§5 分层探针输出）；拒绝发生在 S5 `applyValidatedMutation` 内信封解析 | 排除（缺口在 doc-runtime 信封解析） |
| H3 「guard 信封零写入 ⇒ 条件写安全的必要条件已满足」 | 零写入来自未知键整体拒绝；合法 guard 无法提交、评估不满足无稳定码、`issue.path` 不可达 | 排除 |
| H4 批量顶层 guard 已在 #350 预留可用 | E1 顶层键封闭恰 `{'ops'}`；probe 全部 `{ops,guard}` → 未知键拒绝 | 排除（预留的是落点，不是实现） |
| H5 元素级 guard 会被顶层放开误纳 | 元素解析复用 `parseMutationCore` 封闭键集（L209）；#350 B6 L286–289 已冻结拒绝；本契约 N3/E7 继续钉住 | 排除（但需实现时保持——N3 即防回归锚） |
| H6 `equals` 非有限数在 e2e 层可测为无码形状错误 | `mutateData` 面 S3 先拒（`MUTATION_INPUT_NOT_PLAIN_DATA`、record 顶层码），到不了信封解析 | 排除；S7 改直打 doc-runtime，E6 固化分层事实 |
| H7 `MutationIssue` 已含码字段 | `mutation.ts` L38–41 仅 `{message, path}`；探针输出 issue 无 `code` | 排除（码载体属本票新增面） |

## 12. Acceptance contract and test paths

### 12.0 接口约定（本契约的可观察口径）

- **码载体（提请 SA1 批准）**：评估不满足的单 issue 暴露 `code` 属性，值等于从 `src/index.ts`
  导出的值导出 `MUTATION_GUARD_MISMATCH`（字符串，字面 `'MUTATION_GUARD_MISMATCH'`）；形状错误
  的 issue `code === undefined`。依据：ADR 0025 L58「携带稳定码」+ 仓内既有先例
  `DiagnosticIssue.code?: string`（`namespace-diagnostic-log/src/schema.ts` L139–146，投影保留/截断
  `projection/issues.ts` L135/L164–170）+ 写槽 R9 issues 同源透传（`issues: unknown[]`）。
  ADR 未冻结字段名（SA8 §2 第 7 行明文「属 SA1 设计裁量」）——SA1 若不采纳 `code` 字段名，
  必须在设计中显式给出等价机器可读载体并回写本契约；**两态错误域的可判别性不得放弃**。
- **issue.path**：评估不满足时 `issue.path` 必须是 guard 条件路径的新鲜等价副本（深度相等）。
- **零写入**：`Y.encodeStateAsUpdate(doc)` 逐字节不变 + 0 次本地 `afterTransaction`（changed.size>0）
  + 0 次 `update` 事件。
- **旧实现预期**：下表中「HEAD 预期」列为探针实测（§5）。

### 12.1 测试文件路径（已冻结）

| 文件 | 层级 | 本轮状态 |
|---|---|---|
| `packages/doc-runtime/test/issue-347-guard-envelope-red.test.ts` | doc-runtime 直打（G/M/O/S/N/P 用例） | 未实例化（dispatch 指示）；SA3 实现前由 SA6 下一轮按表落地 |
| `packages/namespace-runtime/test/issue-347-guard-passthrough-red.test.ts` | mutateData 端到端透传（E 用例） | 未实例化（同上） |
| `packages/doc-runtime/test/public-surface-guard.test.ts` | 既有公共面审计（追加 P4） | 现有 3 用例绿；新导出断言待加 |
| `packages/doc-runtime/test/public-surface-type-guard.test-d.ts` | 既有类型守卫（追加 T1） | 现有 4 用例绿；`MutationGuard` 面待加 |

### 12.2 单操作 guard（正例：HEAD 红）

| 用例 | 最小输入（fixture：`n:4711, a:'guarded-scalar', tasks.t1:{status:'draft',reviewer:'r0'}, values:[1,2,3], more:['m']`） | 可观察断言 | HEAD 预期 | 目标预期 |
|---|---|---|---|---|
| G1 | `set tasks.t1.status='reviewing'` + `guard{path:['tasks','t1','status'], equals:'draft'}` | `ok:true`；status='reviewing'；恰 1 本地事务 + 1 update | 未知键拒绝 | 绿 |
| G2 | `delete tasks.t2.reviewer` + `guard{path:['tasks','t1','status'], equals:'draft'}` | `ok:true`；t2 无 reviewer 键 | 未知键拒绝 | 绿 |
| G3 | `array-insert values@1 [9]` + `guard{path:['tasks','t9'], absent:true}`（缺键吸收） | `ok:true`；values=[1,9,2,3] | 未知键拒绝 | 绿 |
| G4 | `array-delete more@0 count1` + `guard{path:['n'], equals:4711}` | `ok:true`；more=[] | 未知键拒绝 | 绿 |
| G5 | `set([])` 全量 + `guard{path:['n'], equals:4711}`（ADR 0025 L48 legacy 同样生效） | `ok:true`；ROOT 全等新快照；1 事务/1 update | 未知键拒绝 | 绿 |
| G6 | 两次：`set n=5252` + `guard{path:['a','deep'], absent:true}`（标量穿越 → PATH_NOT_ALLOWED）；`set n=5252` + `guard{path:['tasks',0], absent:true}`（number 段落在 Y.Map → PATH_NOT_ALLOWED） | `ok:true`；n=5252（读失败满足 absent，且 number 段不是形状错误） | 未知键拒绝 | 绿 |
| G7 | 三个 satisfied 深相等形态：① `guard{path:['tasks','t1'], equals:{status:'draft',reviewer:'r0',ghost:undefined}}`（undefined 键过滤）② `{equals:{reviewer:'r0',status:'draft'}}`（键序无关）③ `{path:['values'], equals:[1,2,3]}` 与 `{path:['values',0], equals:1}`（数组下标段 + 数组值） | 各 `ok:true`、值落盘 | 未知键拒绝 | 绿 |

### 12.2b 批量顶层 guard（正例：HEAD 红；ADR 0025 L74 / 0026 L29、L53–55）

| 用例 | 最小输入 | 可观察断言 | HEAD 预期 | 目标预期 |
|---|---|---|---|---|
| G8 | `{ops:[set tasks.t1.status='reviewing', set tasks.t1.reviewer='u9', array-insert values@1 [9]], guard:{path:['tasks','t1','status'], equals:'draft'}}` | `ok:true`；三项全部落盘；**恰 1 本地事务 + 1 update**（整批原子，guard 不破坏单事务） | `未知信封键 "guard"（批量信封只允许 "ops"）` | 绿 |
| G9 | 评估一次、读批前 committed：`{ops:[set n=5252, set a='y'], guard:{path:['n'], equals:4711}}`（guard 路径被批内操作自己改写） | `ok:true`；n=5252、a='y'（guard 只按批前状态评估一次，不因后续 op 写入而改变结论） | 未知键拒绝（批量） | 绿 |

（G9 的反向对照 = M6b：同一批量改为 `guard{equals:5252}`（仅批后意图值）→ 不满足、零写入——
证明 guard 读的是批前 committed 值；M7 证明 guard 先于逐 op prepare；M6 证明单 issue 不聚合。）

### 12.3 评估不满足（HEAD 红：无稳定码 / 单 issue / path 均不可达）

| 用例 | 最小输入 | 可观察断言 | HEAD 预期 | 目标预期 |
|---|---|---|---|---|
| M1 | `set tasks.t1.status='reviewing'` + `guard{path:['tasks','t1','status'], equals:'published'}` | `ok:false`；`issues.length===1`；`code===导出的 MUTATION_GUARD_MISMATCH` 且 `==='MUTATION_GUARD_MISMATCH'`；`path` 深等 `['tasks','t1','status']`；零写入；message 含 `published` 与 `draft`（期望/实际摘要） | 未知键、无码、path `[]` | 绿 |
| M2 | 数值摘要：`guard{path:['n'], equals:4242}` | 同 M1 结构；message 含 `4242` 与 `4711` | 未知键 | 绿 |
| M3 | 缺键吸收：`guard{path:['tasks','t9','status'], equals:'draft'}` | `code`=稳定码；path=guard 路径；零写入（读得 undefined ≠ 'draft'） | 未知键 | 绿 |
| M4 | `absent` 不满足：`guard{path:['tasks','t1','status'], absent:true}` | `code`=稳定码；path=guard 路径；零写入；message 含实际值 `draft` 与缺席语义标记（`/absent|无值|不存在|缺失|有值/i`） | 未知键 | 绿 |
| M5 | `equals` 因读失败不满足：`guard{path:['a','deep'], equals:'guarded-scalar'}`（PATH_NOT_ALLOWED） | `code`=稳定码；path=guard 路径；零写入 | 未知键 | 绿 |
| M6 | 批量顶层：`{ops:[set n=5252, set a='y'], guard:{path:['n'], equals:4242}}` | `ok:false`；**恰 1 issue**（guard 先于逐 op prepare，无聚合）；`code`=稳定码；path=guard 路径；零写入；0 事务/0 update | 未知键（批量） | 绿 |
| M6b | 批量顶层读到的是**批前 committed 值**：`{ops:[set n=5252], guard:{path:['n'], equals:5252}}` | `code`=稳定码、零写入（5252 只是批后意图值，不满足） | 未知键 | 绿 |
| M7 | guard 不满足 + 操作值 schema 非法：`{ops:[{set n='bad'}], guard:{path:['n'], equals:4242}}` | 恰 1 issue；`code`=稳定码；message **不含** `类型不匹配`；零写入 | 未知键 | 绿 |
| M8 | 截断防爆：`guard{path:['n'], equals:'x'.repeat(1_000_000)}` | `code`=稳定码；`message.length < 65536`（上界为契约选定宽松值；SA1 可收紧后回写） | 未知键（message 短） | 绿 |
| M9 | 可重试语义：先 M1 不满足（零写入）→ 无 guard `set status='published'` 提交 → 重放同一 guarded 信封 | 第二次 `ok:true`、status='reviewing'（state 依赖拒绝，非永久信封拒绝） | 两次均未知键 | 绿 |
| M10 | 深相等非子集：`guard{path:['tasks','t1'], equals:{status:'draft'}}` vs 实际 `{status:'draft',reviewer:'r0'}` | `code`=稳定码；零写入（缺键即不等，防「含子集即满足」误实现） | 未知键 | 绿 |

### 12.4 评估次序（HEAD 红）

| 用例 | 最小输入 | 可观察断言 | HEAD 预期 | 目标预期 |
|---|---|---|---|---|
| O1 | guard 不满足 + 新值违反 schema：`{op:'set', path:['n'], value:'bad', guard:{path:['n'], equals:4242}}` | 恰 1 issue；`code`=稳定码；message 不含 `类型不匹配`（只报 guard） | 未知键 | 绿 |
| O2 | 对照（guard 满足 + 新值非法）：同上但 `equals:4711` | `ok:false`；`code===undefined`；message 含 `类型不匹配`（schema 管线在 guard 之后可达） | 未知键、无 `类型不匹配` | 绿 |
| O3 | 对照（guard 满足 + 批量两操作非法）：`{ops:[{set n='bad'},{set a=5}], guard:{path:['n'], equals:4711}}` | 聚合 issues ≥2（path 含 `['n']` 与 `['a']`）；各 issue `code===undefined`；零写入（guard 满足不改变聚合语义） | 未知键（单 issue） | 绿 |

### 12.5 形状错误全家桶（HEAD 红：`message` 不得是未知键拒绝）

**每例共同断言**：`ok:false`；`issues.length===1`；`issue.code===undefined`（不可重试语义：无稳定码）；
文档逐字节不变；0 事务 / 0 update；`expect(issue.message).not.toMatch(/未知信封键\s*"guard"/)`。
测试开头先跑合法 guard anchor（G1 同款 satisfied 提交）证明 guard 面已被识别，防与「能力缺失」
同义反复。

| 用例 | 输入族（guard 部分；`op` 用 `set n=5252` 承载） | HEAD 预期 | 目标预期 |
|---|---|---|---|
| S1 guard 非对象 | `guard: 42` / `null` / `'x'` / `[]` | 未知键文案（红） | 无码形状拒绝 |
| S2 equals/absent 非恰其一 | `{path:['n'], equals:4711, absent:true}` / `{path:['n']}` | 红 | 无码形状拒绝 |
| S3 缺 path | `{equals:4711}` / `{absent:true}` | 红 | 无码形状拒绝 |
| S4 absent 非字面 true | `{path:['n'], absent:1}` / `absent:'true'` / `absent:false` | 红 | 无码形状拒绝 |
| S5 path 段类型错误 | `{path:['n',true],…}` / `{path:[{}],…}` / `{path:['n',null],…}` | 红 | 无码形状拒绝 |
| S6 path 为 `[]` | `{path:[], equals:4711}` / `{path:[], absent:true}` | 红 | 无码形状拒绝 |
| S7 equals 含非有限数 | `equals:NaN` / `Infinity` / `-Infinity` / 嵌套 `{v:[NaN]}` / `{v:{w:Infinity}}`（**直打 doc-runtime**；e2e 层见 E6） | 红 | 无码形状拒绝 |
| S8 批量顶层 guard 形状错误 | `{ops:[合法元素], guard:42}` / `guard:{path:['n']}` / `guard:{path:[], equals:4711}` / `guard:{path:['n'], absent:1}` | `未知信封键 "guard"（批量信封只允许 "ops"）`（红） | 无码形状拒绝 |

### 12.6 负控（HEAD 绿，实现后必须保持）

| 用例 | 断言 |
|---|---|
| N1 | 无 guard 四动词各自 `ok:true`、值落盘、各 1 事务/1 update；`{op:'set',path:['n'],value:2,zzz:1}` → 文案含 `未知信封键 "zzz"` 与 `操作 set`、零写入 |
| N2 | 无 guard 批量三操作 `ok:true`（1 事务/1 update）；`{ops:[…], zzz:1}` → 文案含 `未知信封键 "zzz"`、零写入 |
| N3 | 批量元素携带 guard → `ok:false`、`code===undefined`、零写入、0 事务/0 update（ADR 0026 L29；#350 B6 冻结面） |
| N4 | 无 guard `set([])` legacy 全量重装仍 `ok:true`（ADR 0008 L47） |

### 12.7 公共面（AC7）

| 用例 | 断言 | HEAD 预期 | 目标预期 |
|---|---|---|---|
| P1 | `import * as ns from '../src/index.js'`：`hasOwnProperty('MUTATION_GUARD_MISMATCH')`；`typeof === 'string'`；`=== 'MUTATION_GUARD_MISMATCH'` | 不存在（红） | 绿 |
| P2 | 行为绑定：M1 结果的 `issues[0].code === ns.MUTATION_GUARD_MISMATCH`（导出值与运行时拒绝码同源） | 不可达（红） | 绿 |
| P3 | 类型面：`import type { MutationGuard } from '../src/index.js'` 可导入（任意缺失 TS2305 红） | 红 | 绿 |
| P4 | 既有 `public-surface-guard.test.ts` 审计面新增该值导出断言（存在性 + 字符串类型）；既有值导出断言全部保持 | 红（新导出缺失） | 绿 |

### 12.8 端到端透传（mutateData 面；AC6）

| 用例 | 最小输入 | 可观察断言 | HEAD 预期 | 目标预期 |
|---|---|---|---|---|
| E1 | 无 guard `set n=2`（对照） | `{ok:true}`；readData 见 2；notifier 1；1 update | 绿 | 绿（不变） |
| E2 | 单操作 guard 满足：`set tasks.t1.status='reviewing'` + `guard{…equals:'open'}` | `{ok:true}`；readData 见 `reviewing`；notifier 1；恰 1 update | 未知键拒绝（红） | 绿 |
| E3 | 单操作 guard 不满足（M1 同款） | `{ok:false}`；`issues.length===1`；`issues[0].code===MUTATION_GUARD_MISMATCH`；字节不变；notifier 0；诊断恰 1 条 record：`stage==='validation'`、`result.kind==='rejected'`、record 级 `code===undefined`、`issues.items[0].code===MUTATION_GUARD_MISMATCH` | 未知键、无码（红） | 绿 |
| E4 | 批量顶层 guard 满足：`{ops:[3 合法 op], guard:{path:['tasks','t1','status'], equals:'open'}}` | `{ok:true}`；全部值落盘；notifier 1；1 update（单事务原子） | 未知键拒绝（红） | 绿 |
| E5 | 批量顶层 guard 不满足（`equals:4242`） | `{ok:false}`；恰 1 issue；`code`=稳定码；字节不变；notifier 0；诊断 record rejected/validation 且 `issues.items[0].code`=稳定码 | 未知键（红） | 绿 |
| E6 | 分层控制（绿负控）：`mutateData` 携带 `guard{equals:NaN}` 与 `guard{equals:{…,gone:undefined}}` | `MUTATION_INPUT_NOT_PLAIN_DATA`；stage=`input-snapshot`；record 级 `code`=该码；零写入——**禁止**在 e2e 层断言 guard 无码形状错误 | 绿 | 绿（不变） |
| E7 | 元素携带 guard（N3 同款，e2e 层） | 无码拒绝；零写入；notifier 0 | 绿 | 绿（不变） |

### 12.9 类型面（追加至 `public-surface-type-guard.test-d.ts`）

| 用例 | 断言（vitest `--typecheck`） | HEAD 预期 | 目标预期 |
|---|---|---|---|
| T1 | `MutationGuard` 可导入；`{path:['tasks','t1','status'], equals:'draft'}` 与 `{path:['values',0], equals:1717}`、`{path:['tasks','t1'], absent:true}` 合法赋值；`@ts-expect-error` 负例：`absent:false`、`equals` 与 `absent` 同现、缺 `path`、缺 `equals`/`absent` 判别键；`guard.path` 投影为 `readonly (string|number)[]` | TS2305 红 | 绿 |

### 12.10 AC 映射

AC1→G1–G5/G8；AC2→M1–M3/M5/M8/M10；AC3→G3/G6/M4；AC4→S1–S8；AC5→O1（+O2/O3 对照）；
AC6→N1–N4/E1–E5；AC7→P1–P4/T1；AC8→G8/G9（+M6/M6b/M7/O3 反向与次序对照）/E4/E5；AC9→§4/§14
（根 `pnpm typecheck` exit 0 + doc-runtime 全目录绿）。

### 12.11 SA1/SA3 义务（本契约不替设计决策的部分）

1. 批准或回写 §12.0 的 `issue.code` 载体口径（ADR 未冻结字段名）。
2. `guard` 键纳入四动词封闭键集与批量顶层 E1 允许键；元素解析核**不得**放行 guard。
3. 评估插入点：单操作 parse 成功后/分叉前；批量 E 校验后/逐 op prepare 前；纯读、不进事务、不改槽序。
4. 复用既有 `readLogicalValueAtPath` + `logicalValuesEqual` 深相等纪律（不新起第二套读取/相等语义）。
5. `MutationGuard` 类型与 `MUTATION_GUARD_MISMATCH` 只经 `src/index.ts` 导出并同步公共面审计。
6. 保持冻结面：N1–N4/E1/E6/E7 全绿、诊断 record schema 指纹、wire 协议、写槽 R9 语义零回归。

## 13. Red/green evidence

- **红（能力缺口，运行时实测）**：§5 全表——单操作/批量顶层/set([]) 全部 guard 信封在信封解析期
  「未知信封键」拒绝；形状错误族与评估不满足族不可区分；导出面缺 `MUTATION_GUARD_MISMATCH`；
  e2e 层 guard 拒绝无码、无 committed、notifier 0。
- **绿（负控，运行时实测）**：§6 全表（无 guard 四动词/批量/`set([])`/`zzz` 未知键、元素 guard 拒绝、
  S3 分层、读投影底座）；doc-runtime 全目录 27 文件/402 用例绿；根 `pnpm typecheck` exit 0。
- **红灯敏感度（反证）**：形状族断言若只有「ok:false + 无码 + 零写入」，旧实现会**伪绿**（未知键拒绝
  同形）——故 S 组强制 `message.not.toMatch(/未知信封键\s*"guard"/)` + 合法 guard anchor；M 组强制
  `code===稳定码`，旧实现无 `code` 字段必红；G 组强制 `ok:true` 落盘，旧实现必红。三组互为敏感度对照。
- 本轮不实例化测试文件（dispatch 指示）；上述红/绿均由最小复现 probe 运行时观察，规格已按
  §12 用例表冻结到可逐条落地。

## 14. Runner trigger evidence

- `NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run packages/doc-runtime/test`
  → `Test Files 27 passed (27)`、`Tests 402 passed (402)`、`Type Errors no errors`（9.49s）；
  证明 `vitest.config.ts` include `packages/*/test/**/*.test.ts` 对 `packages/doc-runtime/test/`
  新文件的真实收集能力（既有同类文件 `issue-350-batch-envelope-red.test.ts` 同路径模式已在收集面内）。
- `pnpm typecheck` → 13 个 tsconfig 顺序编译 exit 0；`packages/doc-runtime/tsconfig.json` 包含
  `src/**/*.ts` + `test/**/*.ts`，未来契约文件与其类型守卫落在编译门内。
- probe 运行入口（本轮证据来源）：
  `NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/tsx packages/doc-runtime/probe-347.tmp.ts`
  与 `… packages/namespace-runtime/probe-runtime-347.tmp.ts`（均已按 §16 删除）。
- 与 issue AC9 对齐：实现落地后根 `pnpm typecheck` + doc-runtime 相关测试必须通过；当前基线即绿，
  唯一预计新增面为 §12 契约文件。

## 15. Unknowns and blockers

| 项 | 状态 | 处置 |
|---|---|---|
| `issue.code` 字段名 / 码载体 | ADR 未冻结（SA8 §2 明文属 SA1 设计裁量） | §12.0 已给出可观察口径与仓内先例；SA1 批准或给出等价机器可读载体并回写；不得放弃两态可判别性 |
| `{guard: undefined}`（键存在但值为 undefined） | ADR 未列举；e2e 层被 S3 先拒（`键 "guard" 值为 undefined`） | 契约不冻结；§12 不含该用例；SA1 若裁定须回写升级 |
| `equals: undefined`（键存在、值为 undefined，absent 缺席） | ADR 判别联合字面允许，但与「读得 undefined 即相等」叠加有歧义；e2e 层被 S3 先拒 | 契约不冻结；§12 不含该用例；SA1 若裁定须回写升级 |
| guard 对象内部未知键（如 `{path, absent:true, zzz:1}`） | ADR 形状错误族未列举「guard 内未知键」 | 契约不冻结；SA1 若按封闭判别联合拒绝，SA6 下一轮追加 S9 |
| `equals` 非有限数的嵌套层级（`equals` 顶 vs 任意深度「含」） | 本契约按「含」取任意深度（S7 含嵌套负例）；字面未逐字展开 | 提请 SA1 确认；若不采纳嵌套，S7 仅保留顶层三例并回写 |
| message 摘要格式 / 截断上界 | ADR 只要求「含期望/实际摘要（截断防爆）」，未冻结格式与字节预算 | 契约断言：equals 两向值文本出现、absent 有缺席语义标记、1 MiB equals → message < 64 KiB（宽松上界）；SA1 可收紧并在 SA6 下一轮回写 |
| 「评估不进 Yjs 事务」 | doc-runtime 层无确定性负向观察点（事务内纯读在外部不可区分；零 update/零字节断言两实现同形） | 契约不新增断言；作为 SA1/SA3 设计义务（§12.11 第 3 条）与 SA9 审查面留档 |
| 跨实例/复制语义、`replaceSchema`、wire | ADR 0025 L64–66 边界外 | 零测试、零断言 |

无阻塞项：环境完备、缺口 100% 确定复现、红在正确断言处、负控全绿、测试入口真实。

## 16. Temporary diagnostics cleanup

- 临时 probe 脚本（**已删除**）：`packages/doc-runtime/probe-347.tmp.ts`、
  `packages/namespace-runtime/probe-runtime-347.tmp.ts`。
- 临时运行目录（**已删除**）：`.scratch/issue-347/`（probe 两轮输出日志 4 份；关键输出已逐字留档于
  §5/§6/§13）。`.scratch/vfsl-v1-parser`（先前存在，非本次产物）保持原样。
- 生产实现零改动：`git status` 仅显示本报告（`wiki/raw/task_issue-347_sa6_contract.md`）与 Host 预置的
  `wiki/raw/task_issue-347*.md` 文件。
- 依赖变更：`pnpm install --frozen-lockfile --prefer-offline` 仅物化 worktree `node_modules`
  （lockfile 未改）。
- 长命令/后台作业：doc-runtime 测试与根 `pnpm typecheck` 经后台作业运行并已回收；无遗留进程、
  无服务、无 nohup/setsid/PID 文件。
