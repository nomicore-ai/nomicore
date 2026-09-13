# task_issue-347 设计 — 条件写核心（guard I）：doc-runtime 信封解析、槽前评估与 `MUTATION_GUARD_MISMATCH`

- 设计角色：SA1（mabf-sa1，iteration=0，design）
- 被设计对象：issue #347「条件写核心：doc-runtime 信封解析、槽前评估与 MUTATION_GUARD_MISMATCH（guard I）」
- 实现基线：`mabf/issue-347` @ `1b55d5c`（= `origin/adr0025-guarded-mutation`；ADR 0025/0026、CONTEXT 词条、
  typed-access guard 小节、#350 批量信封实现均已就位；Blocked-by #350 已满足）
- 上游输入：`wiki/raw/task_issue-347.md`（brief）、`…_sa6_contract.md`（验收契约）、
  `…_relevant_decisions.md` / `…_conflict_report.md`（SA8）。无 SA2 评审输入（文件不存在，本轮为首次设计）。

---

## 1. 任务类型、目标与非目标

**类型：feature（能力实现）**。ADR 0025（含 0026 组合节）已立法、SA6 已证明能力缺口 100% 确定存在
（`wiki/raw/task_issue-347_sa6_contract.md` §5/§8）：任何携带 `guard` 的信封在信封解析期被按
「未知信封键」拒绝，guard 的全部语义（解析、评估、两态错误域、导出）不存在。

**目标**：

1. 四操作（set / delete / array-insert / array-delete）信封与批量信封顶层纳入可选单条件 `guard`；
   形状校验在信封解析期完成（无码、零写入、不可重试）。
2. 评估在 prepare 阶段（单操作：解析成功后、局部/legacy 分叉前；批量：E 校验后、逐操作 prepare 前）、
   先于 schema 校验，对 guard 路径的 committed 当前载体投影逻辑值断言 `equals`（结构深相等）/
   `absent`（无值）；不满足 → 零写入单 issue，携带稳定码 `MUTATION_GUARD_MISMATCH`、
   `issue.path` = guard 条件路径、message 含期望/实际摘要（截断防爆）。
3. `MutationGuard` 类型与 `MUTATION_GUARD_MISMATCH` 稳定码经 `src/index.ts` 导出；公共面审计测试同步。
4. 批量顶层 guard：评估一次、读批前 committed、先于逐操作 prepare；不满足整体零写入单 issue；
   批量元素携带 `guard` 维持形状错误（冻结面）。
5. 不携带 guard 的既有调用行为逐字节不变（含无 guard 拒绝路径的消息）。

**非目标**（ADR 0025 L64–66、L94 开放问题；SA8 §2 no-conflict 行）：

- 不做谓词词表演进（`exists`、数值比较、`neq`、多条件/and-or 组合、guard 路径放开 `[]`）。
- 不触复制 apply / wire 协议 / `replaceSchema` / META / 跨实例执法。
- 不改 namespace-runtime 写槽槽序与 R9 语义、不改诊断 record schema（指纹冻结）。
- 不在本任务内实现代码或落地测试文件（SA3/SA6 后续轮次执行；本设计给出实现与测试规格）。

## 2. 当前行为与证据锚点（源码事实）

| # | 事实 | 锚点 |
|---|---|---|
| 1 | 单操作解析核按动词封闭键集：`set:['op','path','value']`、`delete:['op','path']`、`array-insert:[…,'index','values']`、`array-delete:[…,'index','count']`；未知键 → `未知信封键 "k"（操作 <op>）` | `packages/doc-runtime/src/mutation.ts` L534–572（specs L540–545、未知键 L549–550） |
| 2 | 批量 E1 顶层键封闭恰 `{'ops'}`：`Object.keys(env).filter(k => k !== 'ops')`；`op` 同现 → 双形态消息；其余 → `未知信封键 "k"（批量信封只允许 "ops"）` | `mutation.ts` L186–193 |
| 3 | 批量元素解析复用同一解析核（前缀 `批量元素 #i：`）→ 元素 guard 现被键封闭天然排除 | `mutation.ts` L205–212 |
| 4 | 单操作 prepare：parse（L132）→ derived.structure root 检查（L134–136，fatal）→ `isRootReplace` 分叉（L140）→ 局部管线 `prepareLocalMutation`（L142）/ legacy 全量管线（L146–159）；schema 校验发生在两管线内部（局部：`applyMutationAtBoundary` validateSubtree；legacy：`validateLogicalSnapshot`） | `mutation.ts` L124–171；`mutation-local.ts` 头注 S3–S9 |
| 5 | 批量 prepare：E1–E5 → root 检查（L234）→ P 循环逐操作 `prepareLocalMutation` 聚合失败（L237–247）→ C 组合边界 → 单事务提交 | `mutation.ts` L181–250 |
| 6 | `MutationIssue = { message: string; path: Array<string \| number> }`——无码载体 | `mutation.ts` L38–41 |
| 7 | 投影读取底座已在位：`readLogicalValueAtPath`（G0 形态守卫 → N0 probeRoot → N1 导航 D3/D4 → P1 投影；失败单通道 `PATH_NOT_ALLOWED`；同步不抛错 INV-R1；零写入零事件 INV-R9） | `packages/doc-runtime/src/read.ts` L53–135、L146 |
| 8 | 深相等底座已在位：`logicalValuesEqual`（undefined 键过滤的结构深相等；现服务 union 成员仲裁） | `mutation.ts` L483–495 |
| 9 | 导出面：`src/index.ts` 导出 `applyValidatedMutation` + 类型名目；零稳定码值导出 | `packages/doc-runtime/src/index.ts` L20–28；SA6 §5 probe |
| 10 | e2e 写槽：S3 `snapshotMutation` 受控深冻快照（拒绝非有限数/undefined 值/非 plain data → `MUTATION_INPUT_NOT_PLAIN_DATA`，先于 doc-runtime）→ S5 `applyValidatedMutation(derived, doc, snap.value)` → 领域失败 R9 `diagValidation(diag, result.issues as DiagnosticIssue[])` 同源透传（公共联合 `issues: unknown[]`） | `packages/namespace-runtime/src/write.ts` L139–146、L187、L205–209；`diagnostic.ts` L269–274 |
| 11 | 诊断 `DiagnosticIssue` 已含可选 `code?: string`；投影 full 策略确定性截断（code 256B / message 4096B）、redacted 保留 code | `packages/namespace-diagnostic-log/src/schema.ts` L139–146；`projection/issues.ts` L135、L156–164 |
| 12 | 冻结锚：#350 B5–B7 测试（`expectShapeReject` 只断言 ok:false + 逐字节零写入，**不**逐字锁消息尾）；公共面审计 `public-surface-guard.test.ts`、类型守卫 `public-surface-type-guard.test-d.ts` 现绿 | `packages/doc-runtime/test/issue-350-batch-envelope-red.test.ts` L269–292；`public-surface-guard.test.ts`；`public-surface-type-guard.test-d.ts` L74–91 |

## 3. 能力缺口（承接 SA6 §8 根因链）

guard 不在任一键封闭集（事实 #1/#2）⇒ 无读取/评估路径（`grep guard` 命中全为无关标识）⇒ 结果联合
无稳定码载体（事实 #6/#9）⇒ 形状错误族与评估不满足族在旧实现下不可区分（同款未知键文案、同零写入、
同无码）。缺口被 SA6 单点隔离在 doc-runtime 信封解析（键封闭）与 prepare 编排（无评估步），不在文档
状态、值域或写槽（SA6 §9 E1–E7）。

## 4. Owner 要求落实

REST 预读 `comments=[]`：**无 Owner 评论，无额外要求或 override**（brief §Comments；SA6 §2；SA8 §1）。
任务要求完全来自 issue 正文 AC1–AC9 + ADR 0025/0026：

| 来源 | 要求 | 设计落点 |
|---|---|---|
| Issue body What to build | 四操作信封可选 guard、形状校验完备、槽前评估、两态错误域、导出 | §5 D1–D8 |
| AC1 合法 guard 且满足 → 提交落盘 | §5 D5/D6、§8 数据流路线 1/2 | |
| AC2 equals 不满足 → 单 issue + 码 + path + 零写入 | §5 D2/D5/D8 | |
| AC3 absent 两态 | §5 D5 | |
| AC4 形状错误全家桶无码零写入 | §5 D4 | |
| AC5 guard 先于 schema 校验 | §5 D6 | |
| AC6 无 guard 逐字节不变 + 结果联合透传 | §5 D3/D7、§9 调用方矩阵 | |
| AC7 两导出 + 审计同步 | §5 D2/D9 | |
| AC8 批量顶层 guard（评估一次、先于逐 op prepare、单 issue）；元素 guard = 形状错误 | §5 D3/D6 | |
| AC9 根 typecheck + doc-runtime 测试通过 | §13 验收映射 | |

## 5. 设计决策与主要备选方案

### D1 `MutationGuard` 公共类型（ADR 0025 L23–27 逐字定稿判别联合）

```ts
/** ADR 0025 条件写判别联合（定稿）：`equals` 结构深相等 / `absent` 无值，恰其一。 */
export type MutationGuard =
  | { path: readonly (string | number)[]; equals: unknown }
  | { path: readonly (string | number)[]; absent: true };
```

- 静态 fail-closed（T1 冻结负例全部由联合 + 对象字面量 excess-property 检查自然成立）：
  `absent:false`（不满足成员二的 `true`、成员一无 `absent`）、`equals`+`absent` 同现（两成员各自
  excess）、缺 `path`、缺判别键（两成员各自缺必需属性）均编译期报错。
- `path` 用 `MutationPath` 同款 `readonly (string | number)[]`（T1 断言 `guard.path` 投影）。

### D2 码载体裁决（SA6 §12.0 提请项）：**采纳 `issue.code`**

**批准 SA6 契约口径**：评估不满足的单 issue 携带 `code` 属性，值等于从 `src/index.ts` 导出的
`MUTATION_GUARD_MISMATCH`；形状错误的 issue `code === undefined`（键缺席构造，非显式 undefined）。

```ts
/** ADR 0025 稳定码：guard 评估不满足（可重试 CAS 竞争拒绝）——doc-runtime 首个领域拒绝稳定码。 */
export const MUTATION_GUARD_MISMATCH = 'MUTATION_GUARD_MISMATCH';

export interface MutationIssue {
  message: string;
  path: Array<string | number>;
  /** 模块稳定码；键缺席 = 无码信封/形状错误（不可重试）。现役值：MUTATION_GUARD_MISMATCH。 */
  code?: string;
}
```

理由：(a) 仓内先例 `DiagnosticIssue.code?: string`（事实 #11）；(b) 写槽 R9 以
`result.issues as DiagnosticIssue[]` 结构化透传，`MutationIssue` 增可选 `code?: string` 后两侧结构
兼容，namespace-runtime 与诊断包零改动即可让码流入 `issues.items[].code`（E3/E5 断言面）；
(c) 两态可判别性成立：`code === MUTATION_GUARD_MISMATCH` ⟺ 可重试评估不满足；`code === undefined`
⟺ 不可重试信封/形状错误。`exactOptionalPropertyTypes: true`（`tsconfig.base.json` L10）下
`code?: string` 禁止显式 `code: undefined`，与「键缺席」构造纪律一致。

**备选（否决）**：码只进 message 不设字段——机器可判别性弱（调用方解析文本），且仓内既有稳定码
（`MUTATION_INPUT_NOT_PLAIN_DATA` 等）均为字段/前缀双载体；码设为字面量联合
`'MUTATION_GUARD_MISMATCH'`——排除未来第二码的结构扩展，且与 `DiagnosticIssue.code: string`
先例不一致。

### D3 信封键封闭演进（SA8 required action 1）

1. **单操作四动词**：`parseMutationCore` 的 specs 保持必需键不变，另设可选键集 `OPTIONAL_KEYS = ['guard']`：
   未知键判定改为 `!allowed.includes(k) && !OPTIONAL_KEYS.includes(k)`。无 guard 输入的未知键消息
   （`未知信封键 "zzz"（操作 set）`）逐字节不变。
2. **函数签名**：`parseMutationCore(input, prefix, allowGuard: boolean)`；默认语义上仅单操作顶层
   调用（`parseMutation`）传 `true`，批量元素循环（E3）传 `false` ⇒ **元素携带 guard 维持现状
   `未知信封键 "guard"（操作 set）`（含 `批量元素 #i：` 前缀）**——B6/N3/E7 冻结面逐字节保持。
3. **批量 E1**：`extra = Object.keys(env).filter(k => k !== 'ops' && k !== 'guard')`；`op` 同现的
   双形态判定与消息不变；`{ops, zzz}` 仍报 `未知信封键 "zzz"（批量信封只允许 "ops"）`。
   **明示接受的失真**：该消息尾在 guard 放开后语义上略窄（顶层现已允许 guard），但 SA8 §4 冻结面
   要求「无 guard 调用消息逐字节不变」且 #350 B6/N4 锚不锁尾——保消息、记入残余问题（§14 R1），
   演进须另过设计评审。
4. `{ops, guard, zzz}` → extra 仍只含 `zzz`，同款消息；`{op, ops, guard}` → 双形态消息（`op`
   优先判定不变）。

**备选（否决）**：把 `guard` 写进各动词 specs 数组——会使 `missing` 必需键检查把 guard 误判为缺键，
需再分支，徒增复杂度；把元素排除逻辑放 E3 调用点做键剔除——第二套封闭逻辑、消息分叉，违背
「唯一解析核」现状。

### D4 guard 形状校验核（新增 `parseGuard`；无码 fail-fast 单 issue）

`parseGuard(value: unknown, prefix: string)` 返回
`{ kind:'ok'; guard: MutationGuard } | { kind:'fail'; issues }`，失败一律 `failIssue([], msg)`
（envelope 级错误、path `[]`、无 code）。**确定性检查序**：

| 序 | 检查 | 消息（前缀拼接） |
|---|---|---|
| ① | `plainObjectOf(value) === null`（非对象/null/array/42/'x'/undefined） | `guard 形状错误：必须是普通对象（实际 ${wordOf}）` |
| ② | 未知键 ∉ {`path`,`equals`,`absent`} | `guard 形状错误：未知键 "${k}"（只允许 "path" 与 "equals"/"absent" 恰其一）` |
| ③a | `equals` 与 `absent` 键同现 | `guard 形状错误："equals" 与 "absent" 不得同时出现` |
| ③b | 两者皆缺 | `guard 形状错误：缺判别键（"equals" 与 "absent" 必须恰现其一）` |
| ④ | `absent` 键存在且 `!== true`（字面） | `guard 形状错误："absent" 必须是字面 true（实际 ${wordOf}）` |
| ⑤a | `equals` 键存在且值 `=== undefined` | `guard 形状错误："equals" 不得为 undefined（无值断言请用 absent: true）` |
| ⑤b | `equals` 任意深度含非有限数（`containsNonFiniteNumber`） | `guard 形状错误："equals" 含非有限数（NaN/Infinity 值域外）` |
| ⑥a | 缺 `path` 键 | `guard 形状错误：缺 "path"` |
| ⑥b | `path` 非数组 | `guard 形状错误：path 必须是数组（段为 string|number）` |
| ⑥c | 段类型非 string|number | `guard 形状错误：path 段类型错误：期望 string|number，实际 ${typeof seg}` |
| ⑥d | `path.length === 0` | `guard 形状错误：path 不得为空数组（ROOT 整树 CAS v1 拒绝——ADR 0025）` |

- **SA6 §15 未决项的三项设计裁定（回写请求，见 §14 R2）**：② guard 内未知键 = 形状错误（封闭判别
  联合，与整个信封 loud 封闭键哲学及 ADR 0025「词表封闭」一致；SA6 下轮可补 S9）；⑤a
  `{path, equals: undefined}` = 形状错误（顶层 equals 必须是确定值；嵌套 undefined **值键**不属此列
  ——G7-① 依 D4 过滤纪律合法）；①含 `{guard: undefined}`（键在值 undefined）= 形状错误（同
  `{ops: undefined}` 走 E2 拒绝的现役先例；e2e 面由 S3 以 `键 "guard" 值为 undefined` 先拒）。
- `containsNonFiniteNumber(v)`：number → `!Number.isFinite`；array → 任一元素递归；
  `plainObjectOf` 通过的对象 → 逐 own enumerable 键递归（**批准 SA6「任意深度含」读法**，S7 嵌套
  负例成立）；其余标量/非 plain 对象（string/boolean/null/bigint/Date…）→ 不含（留给评估期自然
  不相等，不扩大立法面）。循环引用 equals → 递归栈溢出由 `prepareMutation` 既有 catch 收编为
  E205 无码 issue（与 cyclic `set` value 走 `cloneJson` 抛错→E205 的现役行为同构；e2e 面 S3
  先拒循环）。
- 解析成功返回的 `guard.path` 为新鲜副本（`[...env.path]`），段为原始 string|number。

### D5 评估语义（SA8 required action 4：复用既有底座，不新起第二套）

```ts
type GuardVerdict = { kind: 'satisfied' } | { kind: 'mismatch'; issue: MutationIssue };

function evaluateGuard(doc: Y.Doc, guard: MutationGuard): GuardVerdict {
  const read = readLogicalValueAtPath(doc, guard.path);   // 既有公共投影读取（INV-R1/R9：同步、零写入、零事件）
  const satisfied = 'absent' in guard
    ? (!read.ok || read.value === undefined)              // absent：读失败（PATH_NOT_ALLOWED/E100）或缺键吸收均满足（ADR 0025 L43）
    : (read.ok && logicalValuesEqual(read.value, guard.equals)); // equals：读失败不满足；深相等为既有 undefined 键过滤实现
  if (satisfied) return { kind: 'satisfied' };
  return { kind: 'mismatch', issue: { message: …, path: [...guard.path], code: MUTATION_GUARD_MISMATCH } };
}
```

- `equals` 与缺键吸收：投影值 `undefined` ≠ 任何合法 `equals`（⑤a 已排除 `equals: undefined`，
  `logicalValuesEqual(undefined, v)` 对确定 v 恒 false）⇒ M3/M10 语义成立；G7 三形态（undefined 键
  过滤、键序无关、数组下标段+数组值）由 `logicalValuesEqual` 既有实现直接满足。
- 穿越不可下钻终态/段型不符 → `read.ok === false` → equals 不满足（M5）、absent 满足（G6；
  `['tasks',0]` number 段落 Y.Map → PATH_NOT_ALLOWED，非形状错误——段类型本身合法）。
- `'absent' in guard` 判别：parse 产物恰携其一（D4 ③），判别安全。

### D6 评估插入点（SA8 required action 2/3：槽前、纯读、不进事务、先于 schema 校验）

- **单操作**（`prepareMutation`）：`parseMutation`（含 guard 形状校验）成功 → derived.structure
  root 检查（既有 fatal 位，保持在先——internal 不变量 fatal 不被领域结果掩盖）→ **guard 评估**
  → `isRootReplace` 分叉 → 局部/legacy 管线。mismatch → `return { kind:'fail', issues:[issue] }`。
  legacy `set([])` 同样过评估（分叉前，G5）。schema 校验在两管线内部 ⇒ guard 先于 schema 校验
  （O1/O2/O3 由编排次序自然成立）。
- **批量**（`prepareBatchMutation`）：E1（键封闭含 guard）→ E2–E5（既有）→ **E6 顶层 guard 形状
  校验（`parseGuard`，无码 fail-fast）** → derived.structure root 检查（既有）→ **G 顶层 guard
  评估（恰一次）** → P 循环逐操作 prepare。mismatch 在任何 op prepare 之前 ⇒ 恰 1 issue、无聚合
  （M6/M7）；评估读的是批前 committed（G9/M6b：ops 的写入发生在其后的事务里）。
- 评估全程在 `transactGuarded` 之外（prepare 阶段先于任何事务调用；ADR 0025 L49 反对事务内条件读，
  原子性归属写序列器 FIFO）；`readLogicalValueAtPath` 是纯读（事实 #7）⇒ 零写入、零事件。
- 结构不可达边界记录：手造非 root derived + 不满足 guard 的组合下，评估返回 ok:false 而 E204
  fatal 不触发——该输入对合规调用方结构性不可达（derived 仅可由 evaluate 产出），行为差异仅存于
  不可达路径，备案不改判。

### D7 类型面演进（`ValidatedMutation` 冻结；新增包裹类型）

```ts
/** ADR 0025 单操作信封：四操作 + 可选顶层 guard（缺席即现役无 guard 契约）。 */
export type GuardedMutation = ValidatedMutation & { guard?: MutationGuard };

export type BatchedMutation = { ops: readonly ValidatedMutation[]; guard?: MutationGuard };

export type MutationEnvelope = GuardedMutation | BatchedMutation;
```

- `ValidatedMutation`（四操作裸联合）**不动** ⇒ `BatchedMutation.ops` 元素类型不变，元素携带
  guard 仍被静态拒绝（`guard` 键 excess → TS2353；既有 `public-surface-type-guard.test-d.ts`
  L84–85 负例保持红），与运行时元素禁令（D3.2）双层一致；typed-access「错形 fail-closed」纪律保持。
- 既有类型断言全保持：`batchedMutation.ops` 仍 `readonly ValidatedMutation[]`；
  `mutationEnvelope`（= `GuardedMutation | BatchedMutation`）对 `ValidatedMutation | BatchedMutation`
  仍 `toMatchTypeOf`（交集/可选键增量均为结构子类型）。
- `exactOptionalPropertyTypes` 下 `guard?: MutationGuard` 静态拒绝显式 `guard: undefined`（与
  D4 ①运行时裁定同向）。`applyValidatedMutation` 第三参公共类型本为 `ValidatedMutation | unknown`
  （即 unknown），签名零改动。
- `BatchedMutation`/`mutation.ts` 头注 JSDoc 同步：顶层可选 guard（ADR 0025）、元素禁 guard 维持。

**备选（否决）**：直接给 `ValidatedMutation` 各成员加 `guard?`——会使 `ops` 元素静态接纳合法
guard，与运行时元素禁令矛盾，破坏 fail-closed 分层；不改公共类型只加运行时——调用方无法以类型
表达 guard 信封，违背 ADR 0025 公共面演进意图。

### D8 mismatch 消息模板与有界摘要（防爆截断；收紧 SA6 宽松上界）

- equals：`` `${MUTATION_GUARD_MISMATCH}: guard 条件不满足（guard 路径 ${P}：期望 equals=${E}，实际=${A}）` ``
  ；读失败时 `A` = `不可读（PATH_NOT_ALLOWED）`。
- absent：`` `${MUTATION_GUARD_MISMATCH}: guard 条件不满足（guard 路径 ${P}：期望 absent 无值，实际=${A}）` ``
  （mismatch 仅发生于 read.ok 且值非 undefined，A 恒有值）。
- `P` = `renderGuardPath(path)`：`JSON.stringify(path)` 截断至 256 字符 + `…(截断)` 标记。
- `E`/`A` = `summarizeLogicalValue(v)`：`undefined` → `undefined（读得无值）`；否则
  `JSON.stringify(v)`（throw → 回退 `<不可序列化：${wordOf(v)}>`）截断至 256 字符 + `…(截断)`。
- 预算：单侧 ≤256+标记、路径 ≤256 ⇒ 消息总量 < 1 KiB，**低于诊断 message 4096B 预算**（full
  投影零截断、码/消息保真）且远低于契约 64 KiB 上界（M8 的 1 MiB equals → 摘要 ~260 字符）。
  M1/M2（期望/实际文本均在场）、M4（`absent`+`无值` 标记匹配 `/absent|无值|不存在|缺失|有值/i`）
  由模板直接满足；message 前缀带稳定码与 S3 层 `${CODE}: …` 先例一致。

### D9 导出与公共面审计（SA8 required action 3）

`src/index.ts` 追加：`export { MUTATION_GUARD_MISMATCH } from './mutation.js'`（值）与
`export type { MutationGuard, GuardedMutation } from './mutation.js'`（类型）。既有导出全部保持；
`public-surface-guard.test.ts` 追加 P4 断言（`hasOwnProperty('MUTATION_GUARD_MISMATCH')`、
`typeof === 'string'`、`=== 'MUTATION_GUARD_MISMATCH'`）；`public-surface-type-guard.test-d.ts`
追加 T1（`MutationGuard` 正/负例 + `guard.path` 投影）。既有审计第三断言（regex
`/^applyValidatedMutation$/` 恰一命中）不受新常量影响。

## 6. 复现和根因承接

| 上游事实（SA6 §5/§8，实测） | 证据位置 | 设计响应 |
|---|---|---|
| 任何携带 guard 的信封在信封解析期被「未知信封键」拒绝（单操作/批量两文案） | sa6_contract §5 probe 全表；`mutation.ts` L540–550、L186–193 | D3 键封闭演进（顶层放行、元素维持） |
| 形状错误族与评估不满足族不可区分（同文案/零写入/无码） | §5 shape 矩阵 vs 满足/不满足行 | D4 形状族无码 + D5/D8 评估不满足带码单 issue，两态可判别 |
| 导出面缺 `MUTATION_GUARD_MISMATCH`、`MutationIssue` 无 code 字段 | §5 public surface 段；`mutation.ts` L38–41 | D2/D9 |
| 无 guard 四动词/批量/`set([])`/`zzz`/元素 guard/S3 分层/读投影底座全绿（负控） | §6 N1–N6/E1/E6/E7 | D3.1/D3.2 消息与行为逐字节保持；零 namespace-runtime 改动 |
| S3 分层：`equals` NaN / undefined 值键经 mutateData 被 `MUTATION_INPUT_NOT_PLAIN_DATA` 先拒 | §5 端到端段；`write.ts` copyFrozen L340–437 | 保持两层模式：形状族验收直打 doc-runtime（S7），e2e 固化 S3 先拒（E6）——非缺陷 |
| 缺口不在文档状态/值域/写槽（E1–E7 单点隔离） | §9 | 改动收口于 `mutation.ts` + `index.ts` 两文件 |

## 7. SA8 约束落实

| 决议或义务（conflict_report §2/§4/§7） | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|
| 四动词封闭键集纳入可选 guard；未知键 loud 拒绝不变 | §5 D3.1 | OPTIONAL_KEYS 旁路必需键检查 | 是（公共 API/失败语义新增） |
| 批量 E1 演进 `{'ops','guard'}`；元素解析核不加 guard | §5 D3.2/D3.3 | `allowGuard` 参数，元素路径 false | 是（E1 键封闭演进属 SA8 点名复查项） |
| 评估位置：单操作 parse 后/分叉前；批量 E1–E5 后/逐 op prepare 前；槽内纯读、不进事务 | §5 D6 | prepare 阶段插入，`transactGuarded` 之外 | 否（按 ADR 次序落位） |
| 谓词 = `readLogicalValueAtPath` 投影 + `logicalValuesEqual`；absent 由 PATH_NOT_ALLOWED/缺键满足 | §5 D5 | 复用两既有符号，零新语义 | 否 |
| guard 路径禁 `[]`；两态错误域（形状无码不可重试/不满足带码可重试） | §5 D4 ⑥d、D2/D5/D8 | 按表落位 | 是（新失败语义） |
| `MutationGuard` + `MUTATION_GUARD_MISMATCH` 经 `src/index.ts` 导出 + 审计同步 | §5 D9 | 两导出 + P4/T1 | 是（新公共导出） |
| 诊断经 R9 透传（stage=validation/rejected）；namespace-runtime 写槽零改动；不给 `diagValidation` 加顶层 code | §9 调用方矩阵 | 零改动靠 `code?: string` 结构兼容达成 | 否 |
| 冻结面：N3/B6 文案与元素 guard 拒绝、诊断 record 指纹、wire、写槽 R9、批量 E2–E5 | §5 D3.2/D3.3、§10 DENY LIST | 消息与行为逐字节保持；相关文件零改动 | 否 |
| 测试分层知情（S7 直打 doc-runtime；E6 固化 S3 先拒） | §13 验收映射 | 按契约层级落位 | 否 |
| `issue` 码字段形态属 SA1 裁量 | §5 D2 | 采纳 `code`，回写口径记录于本设计 §14 R2 | 否（ADR 未冻结字段名） |

## 8. 接口、状态机和数据流

**接口变化汇总**：`applyValidatedMutation` 签名零改动（第三参本为 unknown）；新增公共导出
`MUTATION_GUARD_MISMATCH`（值）、`MutationGuard`/`GuardedMutation`（类型）、`BatchedMutation`/
`MutationEnvelope` 增可选 `guard?`、`MutationIssue` 增可选 `code?: string`；其余包零接口变化。
**无状态机新增**（guard 无自身状态；评估是 prepare 阶段一次性纯读判定）。

### 数据流路线

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| 1. doc-runtime 直打·单操作 guard | 测试/直接调用方 → `applyValidatedMutation(derived, doc, {op,…,guard})` | 无（评估纯读；成功才经既有 `transactGuarded` 提交最小 edit） | parseMutationCore 键封闭+parseGuard 形状校验（内存）→ evaluateGuard：`readLogicalValueAtPath` 投影 committed 逻辑值 → `logicalValuesEqual`/absent | 无跨边界存储；读 live Y.Doc ROOT（probeRoot 只碰 'ROOT'） | 投影值仅用于断言，不入结果 | 满足 → 既有管线 `{ok:true}` 落盘；不满足 → `{ok:false}` 单 issue（code/path/有界 message）、零事务零 update、字节不变 | 无需清理（零写入承诺）；无 fatal 新面 | G1–G7、M1–M10、O1/O2、S1–S7、P1–P4/T1 |
| 2. doc-runtime 直打·批量顶层 guard | 同上，`{ops:[…], guard}` | 同上（成功才单事务按序提交全部最小 edit） | E1–E5（既有）→ E6 parseGuard → G evaluateGuard（批前 committed，恰一次）→ P 循环 | 同上 | 同上 | 不满足 → 恰 1 issue、整体零写入；满足 → 既有批量原子提交（1 事务 1 update） | 同上 | G8/G9、M6/M6b/M7、O3、S8 |
| 3. e2e·mutateData 透传 | Host typed adapter → `lease.mutateData(envelope)` | 同路线 1/2（S5 唯一 Y.Doc 写入口） | S3 `snapshotMutation` 深冻快照（guard 属 plain data 通过；NaN/undefined 值/非 plain → `MUTATION_INPUT_NOT_PLAIN_DATA` 先拒，stage=input-snapshot）→ S5 路线 1/2 | 写槽 FIFO 独占（评估+提交同槽，无 TOCTOU） | R9 `diagValidation` 把 `result.issues`（含 code）结构化透传 | `{ok:false, issues:[{message,path,code}]}`；notifier 0；诊断恰 1 record：stage=validation、result=rejected、record 级无 code、`issues.items[0].code=稳定码`（full 投影 <4KiB 零截断保真） | 零写入由管线承诺；S6 不触发 | E1–E5、E6（S3 先拒绿负控）、E7 |

**依据**：本任务改变运行时数据「读取（新增 guard 投影读取）与错误传播（issues 增 code 载体）」路径；
写入/存储/复制路径零变化（DENY LIST 保证）。

## 9. 错误、恢复、并发和幂等

- **两态错误域**（ADR 0025 L53–58 逐条落位）：形状错误（D4 全表）→ 无码 `ok:false` 单 issue、
  path `[]`、零写入、不可重试（调用方缺陷）；评估不满足（D5）→ 带码单 issue、`issue.path`=guard
  条件路径新鲜副本、零写入、**可重试**（M9：状态依赖拒绝——重读旧值重构造后重放同一信封即可通过）。
- **失败诚实性**：mismatch 返回前无任何 `transactGuarded` 调用、读取零事件（INV-R9）⇒
  `Y.encodeStateAsUpdate` 逐字节不变 + 0 次 changed `afterTransaction` + 0 次 `update` 事件。
- **并发与原子性**：单 NamespaceRuntime 写序列器 FIFO 独占保证「guard 读到的 committed 值在本槽
  提交前不变」（ADR 0025 L49）；guard 评估与提交共享同一 S5 调用。doc-runtime 直打调用方（无序列器）
  无原子性承诺——与现役全部 mutation 一致，非本任务引入。跨实例/复制 apply 不受约束（ADR 边界）。
- **幂等**：guard 信封是纯数据；同一信封对同一状态确定性同结果（评估为纯函数 of committed 状态）。
- **恢复/回滚**：无需回滚（零写入拒绝）；实现回滚 = git revert 两 src 文件 + 测试文件（见 §12 R）。

## 10. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/doc-runtime/src/mutation.ts` | `MutationGuard`/`MUTATION_GUARD_MISMATCH`/`MutationIssue.code`/`GuardedMutation`/`BatchedMutation.guard?`/`MutationEnvelope` 定义；`parseMutationCore` 第三参 `allowGuard` + 可选键集；`parseGuard`/`containsNonFiniteNumber`/`evaluateGuard`/`renderGuardPath`/`summarizeLogicalValue` 新增；`prepareMutation`/`prepareBatchMutation` 插入评估；头注与 JSDoc 同步 | D2–D8 全部落点（唯一实现文件） |
| `packages/doc-runtime/src/index.ts` | 追加 `MUTATION_GUARD_MISMATCH` 值导出与 `MutationGuard`/`GuardedMutation` 类型导出 | D9（AGENTS：公共 API 仅经 src/index.ts） |
| `packages/doc-runtime/test/issue-347-guard-envelope-red.test.ts` | 新建（SA6 契约 §12.2–§12.7、§12.9 用例 G/M/O/S/N/P/T 落地；fixture 复用 #350 形态 `parseVfsl`→`evaluate`→`materializeRoot`） | SA6 §12.1 冻结路径；AC1–AC5/AC7 |
| `packages/namespace-runtime/test/issue-347-guard-passthrough-red.test.ts` | 新建（E 用例；`createNamespaceRuntimeWithSeam` + memory persistence + real scheduler 装配） | SA6 §12.1 冻结路径；AC6/AC8 e2e |
| `packages/doc-runtime/test/public-surface-guard.test.ts` | 追加 P4 审计断言（新值导出存在性+字符串型；既有断言保持） | AGENTS 公共面审计纪律；AC7 |
| `packages/doc-runtime/test/public-surface-type-guard.test-d.ts` | 追加 T1 类型用例（`MutationGuard` 正/负例 + path 投影） | 同上；AC7 |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/namespace-runtime/src/**`（含 `write.ts`、`diagnostic.ts`） | guard 经 S3/S5/R9 自然透传 | ADR 0025 L60「namespace-runtime 写槽零改动」；SA8 冻结面（槽序/R9 语义） |
| `packages/namespace-diagnostic-log/**` | `DiagnosticIssue.code?` 已支持码投影 | record schema 指纹冻结（`sha256:v1:dedad2ab…`）；本任务零 schema 变更 |
| `packages/doc-runtime/src/read.ts` | 谓词底座（`readLogicalValueAtPath`）原样复用 | SA8 required action 4：不新起第二套读取语义 |
| `packages/doc-runtime/src/mutation-local.ts` | 局部管线在评估点之后，无感知 | guard 评估在分叉前完成；管线零改动 |
| `packages/doc-runtime/src/` 其余文件（extract/fatal/carrier/detached-build/install-verify/replace/schema-replace/materialize/create-initial-document/resolve/tx-guard） | 与 guard 无交集 | 零接口/行为依赖 |
| `packages/doc-runtime/test/issue-350-batch-envelope-red.test.ts` | B5–B7 冻结锚（负控） | 回归锚只读；消息/行为必须保持 |
| `docs/adr/0025*`、`docs/adr/0026*`、`CONTEXT.md`、`.agents/skills/nomicore/typed-access.md` | ADR/词条/技能小节已在基线先行兑现（L120–122 / L181–201） | 文档义务已清；无需修订 |
| `docs/protocols/instance-replication-v1.md`、复制/wire 相关源码 | guard 是本地受控写信封，非 wire 协议 | ADR 0025 L64–66 边界；SA8 no-conflict |
| `vitest.config.ts`、各 `tsconfig*.json`、`package.json`/`pnpm-lock.yaml` | 无新依赖/新编译面 | 零配置变化 |

## 11. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| namespace-runtime 写槽 S5（`runRootWriteSlot` L187） | 整信封交 `applyValidatedMutation`；领域失败 R9 透传 `issues: unknown[]` | 不变；guard 信封经快照原样进入，mismatch issue（含 code）经 R9 结构化透传进 `MutateDataResult.issues` 与诊断 record | **零改动** | `write.ts` L180–209；`diagnostic.ts` L269–274 |
| namespace-runtime S3 snapshotter | plain-data 四查深冻 | 不变；guard 值（path 数组+equals plain 值）通过；NaN/undefined 值先拒（E6 分层负控保持绿） | **零改动** | `write.ts` L322–437 |
| `diagValidation` / 诊断投影 | issues 透传、record 无顶层 code、投影保留 `code?` | 不变；guard 码落 `issues.items[].code`（full 256B 截断预算内） | **零改动** | `diagnostic.ts` L271–274；`projection/issues.ts` L135/L156–164 |
| Host typed adapter（typed-access 纪律） | 信封对象经 `NamespaceLease.mutateData()`；重试循环在上层 | 可在信封顶层附 `guard`；`guard?: MutationGuard` 静态接纳、显式 `guard: undefined` 静默拒绝（exactOptionalPropertyTypes）；技能文档 L181–201 已就位 | 仓外宿主代码自理；仓内零改动 | `.agents/skills/nomicore/typed-access.md` L181–201 |
| 既有 doc-runtime 测试（27 文件/402 用例） | 无 guard 路径全绿 | 逐字节不变（D3 消息保持、失败 issue 无 code 键缺席构造 ⇒ JSON 序列化同形） | **零改动** | SA6 §4/§6 基线；`#350` B5–B7 |
| 公共面类型消费方（导入 `MutationIssue` 等） | 解构 `{message,path}` | 增量可选 `code?`，结构超集，非破坏 | **零改动** | `mutation.ts` L38–41；`write.ts` L74–77（DataMutationIssue 名目独立） |
| vfsl `validate-patch.ts` | 仅注释引用 `ValidatedMutation`（`BoundaryMutationPayload` 独立类型） | 不变 | **零改动** | `validate-patch.ts` L702/L832 |

## 12. 验收与验证映射（SA1 不编写/运行测试；以下为所需证据规格）

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1 单操作四动词 + `set([])` + 批量 guard 满足提交 | SA6 §6 N1/N3/N6/E1（无 guard 绿） | `issue-347-guard-envelope-red.test.ts` G1–G9 | 各 `ok:true`、值落盘、恰 1 事务 1 update（G8 批量单事务） |
| AC2 equals 不满足（值不同/缺键吸收/读失败/深相等非子集/截断） | 无（HEAD 全部未知键拒绝） | M1–M5、M8、M10 | 单 issue、`code===MUTATION_GUARD_MISMATCH`、path 深等 guard 路径、字节不变、message 含期望/实际摘要（M8 <64KiB；本设计 <1KiB） |
| AC3 absent 两态 | 读投影底座绿（SA6 §6 末行） | G3/G6、M4 | 缺键/读失败满足；有值不满足带码 |
| AC4 形状错误全家桶无码 | 无（与不满足不可区分） | S1–S8（+建议 S9，§14 R2） | 单 issue、`code===undefined`、零写入、message 不匹配 `/未知信封键\s*"guard"/`、合法 guard anchor 先行 |
| AC5 评估先于 schema 校验 | 无 | O1（+O2/O3 对照） | guard 不满足+新值非法 → 恰 1 issue 带码、无 `类型不匹配`；对照证明 schema 管线仍可达 |
| AC6 无 guard 逐字节不变 + 透传 | N1–N4/E1/E6/E7 绿 | 同款负控在新测试中重钉 + E2–E5 | 全绿不变；`issues[0].code` 经 mutateData/诊断 record 可观测 |
| AC7 导出面 | `index.ts` 零稳定码（probe） | P1–P4、T1 | 值导出存在且 `=== 'MUTATION_GUARD_MISMATCH'`；类型可导入、负例 fail-closed |
| AC8 批量语义（一次评估/批前 committed/先于逐 op/单 issue；元素禁） | B6/N3/E7 冻结绿 | G8/G9、M6/M6b/M7、O3、S8、N3/E7 保持 | 见 §5 D6；元素 guard 维持无码拒绝 |
| AC9 门槛 | 根 typecheck exit 0、doc-runtime 27/402 绿（SA6 §4） | 实现后重跑：`pnpm typecheck`；`NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run packages/doc-runtime/test packages/namespace-runtime/test`；根 `pnpm test` | 全绿；无 skip/only |
| ADR 0025 L90 序列器竞争 | E2–E5 覆盖透传；G9/M6b 覆盖批前语义 | 建议 SA6 增补 E8：同槽队列两写，后写 guard equals 前写已提交值 | 后写按 FIFO 见前写 committed 而通过（非阻塞项，§14 R3） |

## 13. 风险、回滚和残余问题

- **R1 消息尾失真（接受）**：`未知信封键 "k"（批量信封只允许 "ops"）` 在 guard 放开后语义略窄；
  为保 SA8 冻结面「无 guard 调用消息逐字节不变」而保留。演进（如改为「顶层只允许 ops 与可选
  guard」）须与 #350 冻结锚联动评审，列为 cosmetic follow-up，非本任务项。
- **R2 SA6 契约回写请求（不阻塞）**：本设计三项裁定超出契约冻结面——guard 内未知键 = 形状错误
  （建议 S9）、`equals: undefined` = 形状错误、`{guard: undefined}` = 形状错误（后两项 e2e 面由
  S3 先拒，doc-runtime 层建议补直打用例）；另批准 S7「任意深度含非有限数」与收紧 message 预算
  （<1KiB）。请 SA6 下一轮按此升级用例表；两态可判别性不依赖这些增补。
- **R3 ADR 0025 L90「序列器竞争测试」覆盖度**：E2–E5 + G9/M6b 已覆盖透传与批前语义；显式
  「排队第二写见第一写 committed」竞争用例（建议 E8）为增强项，不构成任务阻塞。
- **R4 敌意/病态 equals（doc-runtime 直打）**：循环引用 → 既有 catch 收编 E205 无码零写入（与
  cyclic set value 现役同构）；超大 equals → O(n) 扫描 + 有界摘要（e2e 面 S3 先拒同类输入）。
  不新增立法面。
- **R5 类型面回退风险**：`GuardedMutation` 交集类型分布语义依赖 TS 结构子类型——既有类型断言
  （`toMatchTypeOf`/`toEqualTypeOf`）在 T1/P4 落地时逐条验证；若出现不兼容，回退方案为
  `MutationEnvelope` 显式四成员展开（仍保元素无 guard）。
- **回滚**：`git revert` `mutation.ts` + `index.ts` 两个实现文件并删除新增测试文件即恢复
  `1b55d5c` 行为；无数据、schema、wire、持久化迁移；可选键语义对旧调用方零影响（前向兼容）。

## 14. 评审修订映射

无 `wiki/raw/task_issue-347_sa2_review.md`（本轮首次设计，无评审输入）。SA6 §12.0/§15 的提请项
处理见 §5 D2（采纳 `issue.code`）与 §5 D4/§13 R2（未决项裁定 + 回写请求）。

## 15. 是否需要设计后 ADR 冲突复查

**需要（`requiresConflictRecheck: true`）**。理由：(1) 新增公共 API 导出（`MutationGuard`、
`MUTATION_GUARD_MISMATCH`）与新失败语义（两态错误域、doc-runtime 首个领域拒绝稳定码）；
(2) 批量信封顶层键封闭 E1 演进为 `{'ops','guard'}`（SA8 点名复查项）；(3) `MutationIssue` 增
可选 `code` 载体（公共结果联合形状演进）。SA8 冲突报告 §9 已预置 same 判断；复查应对照其 §2/§4/§7
四点：E1 键封闭演进、元素级 guard 维持拒绝、单操作无 guard 逐字节不变、写槽 R9 零改动——本设计
§5 D3、§10 DENY LIST、§11 矩阵逐一对应，无 override、无 ADR 修订需求（ADR 0025/0026 均为
直接兑现面）。
