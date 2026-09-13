# SA6 诊断与验收契约 — issue #348 条件写语义矩阵补全：深相等、读失败路径、XML 与 set([])（guard II）

- 被诊对象：`wiki/raw/task_issue-348.md`（issue #348，8 条验收标准）
- Worktree：`/home/wangjian/nomicore-fix-issue-348`；HEAD `61e2daa37e21b467e7ce130d5c4db7be38bde982`（branch `mabf/issue-348`）
- 报告时间：iteration 0；本报告原位覆盖式修订（此前无 SA6 报告）
- 一句话结论：**ADR 0025「评估语义」的全部边角在当前实现下已可执行且与 ADR 一致（92 用例 0 偏差）；本票的必要实现修正范围为 ∅**——缺的是把这套语义固化为可执行锚（AC8），并附变异敏感度证明（§9/§13）。

## 1. Task type and inputs

- **任务类型：Feature 验收契约（既有决策兑现 / 语义矩阵锚定），非 Bug。** issue 正文自述「本票以测试为主，若边角暴露 #347 实现的偏差，以 ADR 0025 为准修正实现」；本报告不虚构根因，只对「能力缺口 = 可执行锚缺失」建立契约，并给出修正范围裁定。诊断未发现需要修正的行为偏差（§5、§9、§11）。
- 固定输入（均已读）：
  - `wiki/raw/task_issue-348.md`（issue body + 8 条 AC + `Blocked by #347`）
  - `wiki/raw/task_issue-348_conflict_report.md`（SA8 门禁：verdict clear，无冲突、无 evolution、无 override，前置满足，requiresConflictRecheck=false）
  - `wiki/raw/task_issue-348_relevant_decisions.md`（决策摘录与实现事实核对）
- 规范与模块契约：`docs/adr/0025-guarded-mutation-conditional-write.md`（L42–44、L48–51、L53–58、L72–74、L86–90、L94）、`docs/adr/0026-atomic-mutation-envelope.md`（L29、L53–55、L65）、`docs/adr/0007-…`（L29、L93–96）、`docs/adr/0008-…`（L18、L23、L26、L40–51、L109）、`docs/adr/0016-…`（L74）、`CONTEXT.md`（L85–87、L113–122）、`packages/doc-runtime/AGENTS.md`。
- 既有锚：`packages/doc-runtime/test/issue-347-guard-envelope-red.test.ts`（G/M/O/S/N/P 组，41 用例，全绿）、`issue-350-*.test.ts`、`read-logical-value-at-path-*.test.ts`、`public-surface-*`。
- 只读边界：本轮未修改任何生产实现，未编写任何入库测试（dispatch 指示「Do not author implementation or executable tests」）；诊断用探针为临时脚本，收尾已删（§16）。

## 2. Owner comment mapping

issue 评论经 REST 读取：**无**。无 Owner 要求、无 override 授权在册；AC1–AC8 全部来自 issue 正文，无外部附加要求需要映射。

## 3. SA8 constraints（逐条纳入）

| SA8 结论 | 本契约的落实 |
|---|---|
| 无 hard conflict；全部对照项 no-conflict / implements-existing-decision | 契约不引入新语义、不扩词表（恰 `equals`/`absent`）、不动 wire/schema/持久化/状态机/生命周期 |
| 无 evolution、无 override（§3） | 契约不请求任何决策面演进；不修改 ADR |
| 冻结面（§4）：稳定码字面量、不满足 issue 形态、guard 形状错误族、谓词词表、单操作无 guard 逐字节契约、doc-runtime 公共导出集、评估位置与次序、`set([])` 管线归属 | §12.9 负控逐项锚定保持；§12.11 明确任何实现修正不得改动这些面 |
| §8 第 2 条（条件性再核） | 若矩阵暴露偏差而修正触及冻结面任一项 → 回 SA8 复核，不得在本票内静默改契约 |
| §8 第 3 条 | 若修正触及 mutation/read 契约 → 按 `packages/doc-runtime/AGENTS.md` 跑根 `pnpm test`（AC8 只列 typecheck + doc-runtime 测试） |
| §7 前置 | `#347`（61e2daa）与传递前置 `#350`/ADR 0026（1b55d5c）已在当前 worktree 落地；guard 双形态落点已在库中 |

## 4. Environment and baseline

| 项 | 值 / 证据 |
|---|---|
| HEAD | `61e2daa37e21b467e7ce130d5c4db7be38bde982`，`mabf/issue-348`，工作区无生产改动（§16） |
| 运行时 | node v24.13.0；pnpm 10.28.2；vitest 3.2.7；yjs 13.6.32；`NODE_OPTIONS=--conditions=nomicore-source`（仓内 source 条件解析） |
| 依赖 | `pnpm install --offline --frozen-lockfile`（lockfile 与主仓逐字节相同，store 命中，exit 0） |
| doc-runtime 基线 | `pnpm exec vitest run packages/doc-runtime/test` → **28 files / 447 tests passed**，`Type Errors  no errors`（9.72s） |
| 根 typecheck（AC8 门） | `pnpm typecheck` → **exit 0**（14 个 tsconfig 串行全过） |
| 根 test（影响面，非 AC8 必需） | `pnpm test` → **349 files / 3686 tests passed**，no type errors（592.82s，exit 0） |
| fixture 权威 | ADR 0025/0008 + `mutation.ts`（guard 面）、`read.ts`（投影面）；探针 schema 见 §12.0 |

## 5. Positive reproduction（能力缺口复现）

**缺口口径（Feature 验证缺口，非行为缺口）**：`#347` 已把 guard 语义（信封解析、槽前评估、稳定码、双形态）落成实现与红线锚；但 ADR 0025「评估语义」的**边角**（深相等细节、读失败两态、XML 两形态、数组下标段纪律、`set([])` legacy 先过 guard、批量顶层同语义、大子树比较）尚无一个测试锚定 `packages/doc-runtime/test` 中的任何用例可覆盖（§8）。缺口 = 这些边角一旦被错误重构，仓内既有 447 用例中的多数不会被击穿（§9 实证：M2/M3 两个错误实现模型下既有套件**全绿**）。

**正向复现（运行时观察，HEAD）**：临时探针按 §12 的表逐条执行，92 个一致性用例全部与 ADR 0025 期望一致（0 偏差）。分组计数：

| AC | 用例数 | HEAD DEV |
|---|---|---|
| AC1 深相等细节 | 16 | 0 |
| AC2 读失败两态 | 31 | 0 |
| AC3 XML 两形态 | 7 | 0 |
| AC4 数组下标段纪律 | 15 | 0 |
| AC5 `set([])` legacy 先过 guard | 7 | 0 |
| AC6 大子树结构比较 | 4 | 0 |
| AC7 批量顶层 guard 同语义 | 12 | 0 |
| 合计 | **92** | **0** |

关键运行时观察（非断言，作证据）：

- `X0`：XML 终点 `readLogicalValueAtPath(doc, ['body'])` → `{ok:true, value:'<p>hi</p>'}`，与 `(root.get('body') as Y.XmlFragment).toString()` 逐字相等 → 「指向 XML 终点 → 与其投影逻辑值比较」有可观察口径。
- `A1c`：`n:-0` 经 `materializeRoot` 后读回 `Object.is(value,-0) === true`（-0 未被归一）→ AC1 的 `-0`/`0` 用例是真实比较，不是同义反复。
- 边界观察（非 AC 项）见 §9.3。

## 6. Negative control

契约要求每个 AC 组至少一条**同源负控**（同 fixture、同 op、仅 guard 极性/存在性不同），且负控在 HEAD 必须为绿：

| 负控 | 内容 | HEAD |
|---|---|---|
| N-A（无 guard 基线，冻结面） | `#347` N1–N4：四动词无 guard 各自 `ok:true`、各 1 事务/1 update；无 guard 批量 `ok:true`（1/1）；批量元素携带 guard = 形状错误；无 guard `set([])` 全量重装 `ok:true` | 全绿（既有 447 用例中） |
| N-B（equals 反极性） | A1/A1b/A8/A12（-0 满足）↔ A1d（1 vs 0 不满足）；A3（数组同序）↔ A4（异序不满足）；A2+A5+A6（键过滤后相等）↔ A7（缺键不满足）；F1/F2（大子树相等）↔ F3/F4（一元素差异不满足） | 全绿 |
| N-C（absent 反极性） | B2/B4/B6/B8/B10/B11/B13/B14/B17/B19/B20/B21/B22/B24/B28（读失败或越界 → absent 满足）↔ B25/C3/E6/G3（有值 → absent 不满足） | 全绿（B25 见下） |
| N-D（次序对照） | E4（guard 满足 + 新值非法 → 无码 schema issue，含 `类型不匹配`）↔ E7（guard 不满足 + 同款非法新值 → 唯一 guard issue，含稳定码） | 全绿 |
| N-E（批量 vs 单操作配对） | 同一 guard 值 + 同一批前状态，单操作形态与 `{ops,guard}` 顶层形态判决一致（A2/A5/A6/A8/A12/B3–B6/C1–C5/D1–D4/G1–G12 的成对声明） | 全绿 |

注：`B25` 是「空 XML fragment 终点」，投影值 `''` 属**有值**，故 absent 不满足（mismatch）——它是 N-C 的正极性成员（反例），不是负控失败。见 §9.3 探针标注修正。

## 7. Stability, scale and timing

- **确定性/复现率**：探针定稿后清洁运行 4 次（含 3 次带边界观察），每次 92/92 一致、0 偏差；未出现 flake。开发期两处与预期不符经查**均为探针自身缺陷**（E3 的新快照违反 schema 必填 `more`；B25 误把「空 XML 终点」标注为 detached 载体），修正夹具/标注后消失——不是产品行为波动。
- **规模**：`F1` 64 键 `Record<string, Task>`（每项 3 字段含嵌套数组）整树 equals；`F2` 256 元素 `YArray<number>` 整树 equals；`F3/F4` 同规模差异一元素/一键 → 稳定拒绝。等值比较成本随目标子树线性，无规模门槛被触碰。
- **消息有界**：`F3/F4` 的 `issue.message.length` 实测 594/593（截断单侧 ≤256 + 模板），满足 ADR 0025 L58「截断防爆」；`#347` M8（1 MiB equals）另有 `< 65536` 锚。
- **时序/并发**：本票语义在槽内 prepare 的纯读阶段（ADR 0025 L49–51），原子性归写序列器 FIFO（ADR 0008），不新增并发面；序列器竞争面由既有 `packages/namespace-runtime/test/issue-347-guard-passthrough-red.test.ts` 与根套件覆盖（§4 全绿）。
- **耗时**：探针单轮 ≈2s；doc-runtime 套件 9.7s；根 typecheck 串行完成；根 `pnpm test` 592.82s。

## 8. Root-cause chain（能力缺口链）

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| 1 | ADR 0025 冻结的评估语义**多于** `#347` 落地时锚定的面：深相等细节、读失败两态的全形态、XML 两形态、数组下标段纪律全表、`set([])` 先过 guard、大子树、批量顶层一致语义 | ADR 0025 L42–44/L48/L74；`issue-347-guard-envelope-red.test.ts` 用例清单（G1–G9/M1–M10/O1–O3/S0–S11/N1–N4/P1–P2）逐条比对 | 高（文本+用例清单） |
| 2 | 实现侧语义已在库中（`parseGuard` 形状全表 → 槽前 `evaluateGuard` 纯读 → 稳定码单 issue；批量 E6/G 段同构） | `mutation.ts` L173–178/L287–291/L540–552/L644–683/L711–729；本轮 92 用例运行时实测一致 | 高（运行时） |
| 3 | 缺口表现为**锚缺失**：错误实现模型 M2（-0/0 误判不等）与 M3（`set([])` 跳过 guard）下，既有 447 用例**全绿**（无一击穿） | §9.2 变异实验实测 | 高（运行时） |
| 4 | 另有 M1（读失败误判 equals 满足）被 `#347` M5 捕获、M4（去 undefined 键过滤）被 `#347` G7 捕获 → 既有锚覆盖部分边角，但不覆盖 AC5 不满足态与 AC1 `-0` 等 | §9.2 | 高 |
| 5 | 结论：本票需要的是**可执行锚补全**（AC8 落位）+ 修正范围裁定（§12.11），而非行为修正 | 92/0 + 变异敏感度 | 高 |

## 9. Causal experiments

### 9.1 锚定实验（语义来源）

`X0`：`readLogicalValueAtPath(['body'])` 与 `Y.XmlFragment.toString()` 逐字相等 → 证明 AC3「指向 XML 终点」的比较对象就是读面投影值，不存在第二套语义；`A1c`：`-0` 在 doc 中保号 → 证明 AC1 比较是真实的 `-0` vs `0`。

### 9.2 变异敏感度（控制变量：仅改一处生产语义，跑完立即回滚）

对 `packages/doc-runtime/src/mutation.ts` 注入 4 个「像真的错误实现」模型；每个模型跑探针（92 用例）与既有 doc-runtime 套件（447 用例）；回滚后校验文件 sha1 与 HEAD 逐字节相同（§16）。

| 变异 | 语义改动 | 探针击穿（DEV 用例） | 既有套件是否检出 |
|---|---|---|---|
| M1 | `evaluateGuard` 中 equals 对读失败误判满足（`!read.ok \|\| …`） | 13：B1/B7/B9/B15/B23/B27/B29/B30/C4/C7/D4/D6/G4 | **检出 1 例**（#347 M5） |
| M2 | 数值用 `Object.is` 式比较 → `-0` 与 `0` 判不等 | 5：A1/A1b/A8/A12/G6 | **全绿（盲区）** |
| M3 | `set([])`（`path.length===0`）跳过 guard 评估（评估落到分叉后） | 3：E1/E6/E7 | **全绿（盲区）** |
| M4 | 去掉 undefined 键过滤（`Object.keys` 不 filter） | 3：A5/A6/G8 | **检出 1 例**（#347 G7） |

结论：新矩阵对 4 个错误模型全部敏感；其中 M2/M3 证明 **AC1 的 `-0`/`0` 与 AC5 的「`set([])` 不满足态」是既有套件无法替代的增量锚**。

### 9.3 边界观察（非 AC 项，不请求修正）

| 观察 | 实测 | 裁定 |
|---|---|---|
| `Z1` 环状 `equals`（`cyc.b.self=cyc`） | 2ms 内 `ok:false`、`code===undefined`、message = `DOCRT-E205 …Maximum call stack size exceeded`、零写入 | 递归发生在形状检查 `containsNonFiniteNumber`（非评估）；fail-closed、无挂起、无半写。ADR 未定义 equals 的循环输入；**非 AC 项、不请求修正**（如未来要收口，属形状错误语义演进，须回 SA8） |
| `Z2` 5000 层深 `equals` 自身 | `ok:false`、`code===undefined`、E205（同上，形状检查递归深度），`readLogicalValueAtPath` 对同值亦 `ok:false`（读面自身栈边界），13ms、零写入 | 同上；「大子树」在 AC6 的语义是**宽**（64 键 / 256 元素）而非万层**深**，已由 F1–F4 锚定 |
| `Z3` 100k 层深值 + `absent:true` | 读面栈溢出被自身 try/catch 收编为 `PATH_NOT_ALLOWED` → absent 满足 → 写入执行（`n 4711→2`） | 与 ADR 0025 L43 字面一致（读失败 ⇒ absent 满足）；值为探针经 live `Y.Map.set` 直造（schema 受控写路径不可产出）。**非 AC 项、不请求修正** |
| `A15` `equals` 侧自定义 plain 原型链（`Object.create` 中继链） | 判 mismatch（`plainObjectOf` 严格 Object.prototype/null；读面 `isPlainRecord` 接受中继链） | ADR 0025 L42 只定义「与投影逻辑值结构深相等」；投影侧被 `copyPlainStrict` 归一为 Object.prototype，equals 侧非 JSON 形态属调用方越界输入。**非 AC 项、不请求修正**；若设计要放开，属新语义，须回 SA8 |
| `D14`/`D15` 「非安全整数/NaN」段 | `['values', 2^53]`/`['values', NaN]` → 读面按 D3 判非下标（或越界）→ 读失败/缺席 → absent 满足、equals 不满足（稳定码）；两段均**不是** guard 形状错误 | 与 ADR 0008 D3（严格非负整数段）一致；guard 段纪律「同 mutation path」= 类型纪律（string=键 / number=下标），值域边界沿读面 |

## 10. Impact surface

- 受影响面（仅锚定）：`@nomicore/doc-runtime` 的 guard 语义可观察行为——`applyValidatedMutation` 结果联合（`ok`/`issues`/`code`/`path`）、目标写入落盘、本地事务与 update 事件计数、`Y.encodeStateAsUpdate` 字节快照。
- 不受影响（本票不改代码；若修正则须证明）：`read.ts`（ADR 0008/0016 schema-independent 读面）、`index.ts` 公共导出集、`namespace-runtime` 写槽与诊断透传（R9）、ADR 0026 批量信封既有契约、`set([])` legacy 全量管线归属。
- 无 wire/schema/持久化/状态机/生命周期面变更；无词表演进。
- 非目标（明示排除）：equals 侧非 JSON 输入（自定义原型/循环）、万层深结构、guard 路径 `[]`、批内元素 guard、多条件/`exists`/数值比较谓词。

## 11. Ruled-out hypotheses

| # | 假设 | 裁定 | 依据 |
|---|---|---|---|
| H1 | 「`-0`/`0` 深相等被 Object.is 式比较破坏」 | **排除**：HEAD 满足（A1/A1b/A8/A12/G6）；M2 证明该假设若成立必被本矩阵击穿 | §9.2 |
| H2 | 「读失败被误判为 equals 满足」 | **排除**：B1/B7/B9/B15/B23/B27/B29/B30/C4/C7/D4/D6/G4 全部稳定码拒绝 | §9.2 M1 |
| H3 | 「guard 路径数组下标段纪律与 mutation/read 面不一致」 | **排除**（类型纪律）：number 段落 Y.Array 按位置读（D1/D2/D3/D12/D13）；string 段落数组（D4/D11）与 number 段落 Y.Map（D6）均读失败 → equals 不满足/absent 满足，非形状错误 | §5、§9.3 |
| H4 | 「`set([])` 绕过 guard」 | **排除**：E1/E6/E7 稳定码 + 零写入；E2/E3 证明满足时仍走 legacy 全量管线；E4/E7 证明评估先于 schema 校验 | §9.2 M3 |
| H5 | 「批量顶层 guard 语义与单操作形态不同」 | **排除**：G1–G12 与 A/B/C/D/E 对应用例判决一一相同；两形态共用 `parseMutationCore`/`parseGuard`/`evaluateGuard`，message 前缀与 path 一致 | §5、§12.8 |
| H6 | 「XML 终点 absent 会因读得字符串而被误判为『无值』」 | **排除**：C1/C2 按投影字符串比较；C3（非空）与 B25（空 fragment，投影 `''`）absent 均不满足；B25b `equals:''` 满足 | §5 |
| H7 | 「detached 载体被静默投影为空值从而绕过 equals」 | **排除**：B28（absent 满足）/B29/B30（equals 不满足，即使内容字面相等——读面 R2 #2 loud 拒绝） | §5 |
| H8 | 「大子树比较不可用或消息无界」 | **排除**：F1/F2 满足、F3/F4 稳定拒绝且 message 594/593 字符（< 4 KiB，远小于 #347 M8 的 64 KiB 锚） | §7 |
| H9 | 「本票需要修正实现以对齐 ADR」 | **排除**：92/92 与 ADR 一致（含 A15/Z1–Z3 边界在 ADR 文义内）→ 修正范围 ∅；若实现阶段出现红灯，按 §12.11 有界范围处理 | §5、§12.11 |

## 12. Acceptance contract and test paths

### 12.0 接口约定与 fixture（本契约的可观察口径）

- **满足判决**：`result.ok === true`；目标写入落盘（如 `root.get('n')===2`）；恰 1 次本地 `afterTransaction`（`transaction.local && changed.size>0`）+ 恰 1 次 `update`。
- **不满足判决**：`result.ok === false`；`issues.length === 1`；`issues[0].code === MUTATION_GUARD_MISMATCH` 且 `=== (ns as any).MUTATION_GUARD_MISMATCH`（公共导出同源）；`JSON.stringify(issues[0].path) === JSON.stringify(guard.path)`；**零写入** = `Y.encodeStateAsUpdate(doc)` 逐字节不变 + 0 次本地事务 + 0 次 update。
- **形状错误判决**（本票不新增族外成员）：`ok:false`；`code === undefined`；零写入。
- **禁止**：skip/only/todo、env override、fallback、吞错、软化断言、以源码字符串/正则断言代替运行时行为、以 message 文案替代 `code`/`path` 断言（文案仅辅助）。断言必须观察结果联合、活动 Y.Doc 值、事务/update 事件与字节快照。
- **fixture（建议与 `#347` 同风格：每文件自带 `derivedOf`/`fixture`）**：

```ts
const TEXT = `type Task = { status: string; reviewer?: string; tags?: YArray<string> };
type ROOT = {
  n: number; a: string;
  tasks: Record<string, Task>;
  values: YArray<number>; more: YArray<string>;
  body: YXmlFragment<{ p: string }>;
  blob: YPlainArray<YLeaf<string>>;
  free: unknown;
};`;
// 快照：{ n:4711, a:'guarded-scalar',
//   tasks:{ t1:{status:'draft',reviewer:'r0',tags:['x','y']}, t2:{status:'open',reviewer:'r0',tags:[]}, t3:{status:'draft'} },
//   values:[1,2,3], more:['m'], body:'<p>hi</p>', blob:['b1','b2'],
//   free:{ arr:[10,20,{k:'v'}], obj:{ nested:{deep:true}, nil:null } } }
```

（`reviewer?`/`tags?` 为可选字段：`t3` 缺 `reviewer` 是 AC1「显式 undefined 过滤」与 AC5「legacy 全量替换可观察」的必要条件；`free: unknown` 提供嵌套 plain 对象/数组与读失败形态。）

### 12.1 测试文件路径（落点已冻结）

| 文件 | 层级 | 本轮状态 |
|---|---|---|
| `packages/doc-runtime/test/issue-348-guard-semantics-matrix.test.ts` | doc-runtime 直打（AC1–AC7 全矩阵 + 负控） | **未实例化**（dispatch 指示不编写可执行测试）；由实现票按 §12.2–§12.9 落地 |
| `packages/doc-runtime/test/issue-347-guard-envelope-red.test.ts` | guard I 既有锚（N 组负控、S 形状族、M/O 次序） | 保持全绿，不得修改语义 |
| `packages/doc-runtime/test/public-surface-guard.test.ts` | 公共面审计（导出集不变） | 保持全绿 |

- AC8 门（逐字）：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/doc-runtime/test` 全绿 + 根 `pnpm typecheck` exit 0。若实现阶段修正了 mutation/read 契约，追加根 `pnpm test`（AGENTS.md Verification）。
- 组织方式照 `#347`：文件头 doc-comment 引 ADR 0025 行号 + 本契约 §12 用例 ID；共用 `watchWrites`/`bytes`/`expectGuardMismatch`/`expectShapeError` 助手；按 AC 分组 `describe`；每文件自带 fixture（仓内既有惯例）。

### 12.2 AC1 深相等细节（16 用例；HEAD 全绿）

| ID | 最小输入（guard 以 `{path, …}` 简写；op 用 `set n=2` 承载，除注明） | 可观察断言 | HEAD 观察 | 目标 |
|---|---|---|---|---|
| A1 | doc `n:0`；`equals:-0` | `ok:true`；`n=2` | 绿 | 绿 |
| A1b | doc `n:-0`；`equals:0`（探针另证 `Object.is(read,-0)===true`） | `ok:true`；`n=2` | 绿 | 绿 |
| A1d | doc `n:0`；`equals:1`（A1 反极性负控） | 不满足判决（稳定码 + path `['n']` + 零写入） | 绿 | 绿 |
| A2 | `path:['tasks','t1']`；`equals:{status:'draft',reviewer:'r0',tags:['x','y']}`（嵌套对象+嵌套数组） | `ok:true` | 绿 | 绿 |
| A3 | `path:['tasks','t1','tags']`；`equals:['x','y']` | `ok:true` | 绿 | 绿 |
| A4 | 同 A3；`equals:['y','x']`（数组顺序敏感负控） | 不满足判决 | 绿 | 绿 |
| A5 | `path:['tasks','t1']`；`equals:{status:'draft',reviewer:'r0',tags:['x','y'],ghost:undefined}`（undefined 键过滤） | `ok:true` | 绿 | 绿 |
| A6 | `path:['tasks','t3']`（实际仅 `status`）；`equals:{status:'draft',reviewer:undefined}`（显式 undefined ≡ 缺键） | `ok:true` | 绿 | 绿 |
| A7 | `path:['tasks','t1']`；`equals:{status:'draft',reviewer:'r0',ghost:undefined}`（实际还有 `tags`） | 不满足判决（键完整，非子集语义） | 绿 | 绿 |
| A8 | doc `values:[1,0,3]`；`path:['values']`；`equals:[1,-0,3]` | `ok:true` | 绿 | 绿 |
| A9 | `path:['free']`；`equals:{arr:[10,20,{k:'v'}],obj:{nested:{deep:true},nil:null}}` | `ok:true` | 绿 | 绿 |
| A10 | `path:['free','obj','nested']`；`equals:{deep:true}` | `ok:true` | 绿 | 绿 |
| A11 | 同 A9；`nested.deep=false` | 不满足判决 | 绿 | 绿 |
| A12 | doc `free:{z:0}`；`path:['free']`；`equals:{z:-0}`（嵌套 -0） | `ok:true` | 绿 | 绿 |
| A13 | `equals:undefined`（形状对照，与 `#347` S10 同源） | `ok:false`；`code===undefined`；零写入 | 绿 | 绿 |
| A14 | `free` 为 24 层嵌套对象；`equals` 同结构 | `ok:true` | 绿 | 绿 |

### 12.3 AC2 读失败路径（31 用例；HEAD 全绿）

共同：行首的 `equals` 用例期望「不满足判决」，`absent` 用例期望 `ok:true`+写入；负控对（同路径两极性）必须成对出现。

| ID | guard 路径 / 谓词 | 语义类别 | HEAD |
|---|---|---|---|
| B1/B2 | `['a','deep']` equals 'guarded-scalar' / absent | 标量穿越（读失败） | 绿 |
| B3/B4 | `['tasks','t9','status']` equals 'draft' / absent | 中间容器缺失（缺键吸收） | 绿 |
| B5/B6 | `['values',99]` equals 1 / absent | Y.Array 越界吸收 | 绿 |
| B7/B8 | `['values',-1]` equals 1 / absent | 负下标 → 读失败（非形状错误） | 绿 |
| B9/B10 | `['values',1.5]` equals 1 / absent | 非整数下标 → 读失败 | 绿 |
| B11/B12 | `['free','arr',99]` absent / equals 10 | plain array 越界吸收 | 绿 |
| B13 | `['blob','x']` absent | string 段落 plain array → 读失败 | 绿 |
| B14/B15/B16 | `['free','obj','nil','deep']` absent / equals null；`['free','obj','nil']` equals null | null 穿越 vs null 终点（null 是合法值） | 绿 |
| B17/B18 | `['free','obj','missing','deep']` absent / equals 1 | plain 缺键立即结束（缺席吸收） | 绿 |
| B19 | `['free','obj','nested','deep','x']` absent | 布尔标量穿越 | 绿 |
| B20 | `['values',99,'x']` absent | 越界先于后续段（立即 ok undefined） | 绿 |
| B21 | `['values','0','x']` absent | 段型不符先于后续段 | 绿 |
| B22/B23/B24 | `['free']` absent / equals 't'；`['free','x']` absent（fixture 直接 `root.set('free', new Y.Text('t'))`） | Y.Text 不可下钻（terminal 读失败 + 穿越失败） | 绿 |
| B25/B25b | `['free']` absent / equals `''`（fixture 直接 `root.set('free', new Y.XmlFragment())`） | **空 XML 终点**：投影 `''` 是「有值」→ absent 不满足、equals '' 满足 | 绿 |
| B26/B27 | `['free','x']` absent；`['free']` equals 0（fixture `root.set('free', new Date(0))`） | 非 plain 原型对象（Date）不可下钻 | 绿 |
| B28/B29/B30 | `['free','frag']` absent / equals 'x' / equals '<p>hi</p>'（fixture：detached XmlFragment 嵌入 plain 容器） | detached 载体 loud 拒绝（absent 满足、equals 不满足——**禁止**静默投影/借道） | 绿 |

### 12.4 AC3 XML 两形态（7 用例；HEAD 全绿）

| ID | 最小输入 | 可观察断言 | HEAD |
|---|---|---|---|
| C1 | `path:['body']`；`equals:'<p>hi</p>'`（= `body.toString()`，`X0` 已证读面同值） | `ok:true` | 绿 |
| C2 | 同 C1；`equals:'<p>bye</p>'` | 不满足判决；message 含实际 `<p>hi</p>` | 绿 |
| C3 | `path:['body']`；`absent:true` | 不满足判决（字符串是值） | 绿 |
| C4/C5 | `path:['body','p']` equals 'hi' / absent | 穿越 XML 不可下钻终态：equals 不满足 / absent 满足 | 绿 |
| C6/C7 | `path:['body',0]` absent / equals 'hi' | 穿越 XML（number 段）：absent 满足 / equals 不满足 | 绿 |

### 12.5 AC4 数组下标段纪律（15 用例；HEAD 全绿）

| ID | 最小输入 | 可观察断言 | HEAD |
|---|---|---|---|
| D1 | `['values',1]` equals 2 | `ok:true`（按数组位置读） | 绿 |
| D2 | `['tasks','t1','tags',1]` equals 'y' | `ok:true`（嵌套 Y.Array 位置） | 绿 |
| D3 | `['values',-0]` equals 1 | `ok:true`（-0 归一 0，读面 D3） | 绿 |
| D4/D5 | `['values','0']` equals 1 / absent | string 段落 Y.Array → 读失败：equals 不满足 / absent 满足 | 绿 |
| D6/D7 | `['tasks',0]` equals 'x' / absent | number 段落 Y.Map → 读失败：equals 不满足 / absent 满足 | 绿 |
| D8 | `['values',3]` absent（index == length） | `ok:true`（越界吸收） | 绿 |
| D9 | `['free','arr',1]` equals 20 | `ok:true`（plain array 位置） | 绿 |
| D10 | `['free','arr',2,'k']` equals 'v' | `ok:true`（下标段 + 键段混用） | 绿 |
| D11 | `['free','arr','2']` absent | string 段落 plain array → 读失败 | 绿 |
| D12 | `['blob',0]` equals 'b1' | `ok:true`（YPlainArray 位置） | 绿 |
| D13 | `['free','arr',-0]` equals 10 | `ok:true`（-0 归一） | 绿 |
| D14 | `['values',Number.MAX_SAFE_INTEGER+2]` absent | `ok:true`（读面 D3 边界：整型段越界吸收；见 §9.3） | 绿 |
| D15 | `['values',NaN]` absent | `ok:true`（非下标 → 读失败；**非** guard 形状错误） | 绿 |

### 12.6 AC5 `set([])` legacy 全量替换先过 guard（7 用例；HEAD 全绿）

| ID | 最小输入 | 可观察断言 | HEAD |
|---|---|---|---|
| E1 | `{op:'set', path:[], value:{…base, n:99}, guard:{path:['n'], equals:4242}}` | 不满足判决 + 零写入（0 事务/0 update/字节不变） | 绿 |
| E2 | 同 E1；`equals:4711`（满足） | `ok:true`；ROOT 全等新快照；恰 1 事务 + 1 update | 绿 |
| E3 | 同 E2，但新快照省略可选 `tasks.t1.reviewer` | `ok:true`；提交后 `tasks.t1` **无** `reviewer` 键（证明走完整 ROOT 清空重装，非合并/补丁） | 绿 |
| E4 | 同 E2，但 `value.n='bad'`（schema 非法） | `ok:false`；`code===undefined`；message 含 `类型不匹配`（guard 满足后 schema 管线可达） | 绿 |
| E5 | `set([])` + `guard:{path:['tasks','t9'], absent:true}` | `ok:true` | 绿 |
| E6 | `set([])` + `guard:{path:['tasks','t1'], absent:true}` | 不满足判决（有值） | 绿 |
| E7 | `set([])` + `value.n='bad'` + `guard:{equals:4242}` | 不满足判决：恰 1 issue、稳定码、message **不含** `类型不匹配`（评估先于 schema 校验，legacy 分支同样） | 绿 |

### 12.7 AC6 大子树结构比较（4 用例；HEAD 全绿）

| ID | 最小输入 | 可观察断言 | HEAD |
|---|---|---|---|
| F1 | 64 键 `tasks`（每项含嵌套 `tags`）；`guard:{path:['tasks'], equals:<手写期望结构>}` | `ok:true` | 绿 |
| F2 | `values` 256 元素；`guard:{path:['values'], equals:Array.from({length:256},(_,i)=>i)}` | `ok:true` | 绿 |
| F3 | 同 F2，末元素改为 -1 | 不满足判决；`message.length < 4096`（实测 594） | 绿 |
| F4 | 同 F1，`k63.status` 改为 'open' | 不满足判决；`message.length < 4096`（实测 593） | 绿 |

（深度方向由 A14（24 层）覆盖；万层级深结构属非 AC 边界，见 §9.3。）

### 12.8 AC7 批量 `{ops, guard}` 顶层同语义（12 用例；HEAD 全绿）

共同断言：满足 → 全部 op 落盘 + 恰 1 事务 + 1 update；不满足 → 恰 1 issue（先于逐 op prepare、无聚合）+ 稳定码 + `path`=guard 路径 + 零写入。

| ID | 最小输入（`ops` 固定 `[set tasks.t1.status='reviewing', array-insert values@1 [9]]`，另有注明者除外） | 对应单操作配对 | HEAD |
|---|---|---|---|
| G1 | `guard:{path:['tasks','t1'], equals:{status:'draft',reviewer:'r0',tags:['x','y']}}` | A2 | 绿 |
| G2 | `guard:{path:['tasks','t9'], absent:true}` | B4 | 绿 |
| G3 | `guard:{path:['tasks','t1'], absent:true}` | B-polar | 绿 |
| G4 | `guard:{path:['body','p'], equals:'hi'}` | C4 | 绿 |
| G5 | `guard:{path:['body'], equals:'<p>hi</p>'}` | C1 | 绿 |
| G6 | `guard:{path:['n'], equals:-0}`（doc n=0） | A1 | 绿 |
| G7 | `guard:{path:['values',1], equals:2}` | D1 | 绿 |
| G8 | `guard:{path:['tasks','t3'], equals:{status:'draft',reviewer:undefined}}` | A6 | 绿 |
| G9 | `guard:{path:['values',99], absent:true}` | B6 | 绿 |
| G10 | `ops:[{set n='bad'}]` + `guard:{path:['n'], equals:4242}` | E7/O1 | 绿 |
| G11 | `guard:{path:['values','0'], absent:true}` | D5 | 绿 |
| G12 | `guard:{path:['free','arr',2], equals:{k:'v'}}` | A10/D10 | 绿 |

### 12.9 负控（HEAD 绿；实现后必须保持全绿）

| ID | 断言 |
|---|---|
| N-A | `#347` N1–N4 原样保持：无 guard 四动词/批量/`set([])` 行为与逐字节契约不变；批量元素携带 guard 仍为形状错误 |
| N-B | equals 反极性成对（A1↔A1d、A3↔A4、A9↔A11、F1/F2↔F3/F4），反极性必须走稳定码拒绝而非 `ok:true` |
| N-C | absent 反极性成对（读失败/越界 → 满足；有值（含空 XML 的 `''`）→ 不满足） |
| N-D | 次序对照 E4↔E7（schema 消息 vs guard 稳定码互斥出现） |
| N-E | 公共面：`MUTATION_GUARD_MISMATCH` 值导出不变；`MutationGuard`/`GuardedMutation`/`BatchedMutation`/`MutationEnvelope` 类型导出不变（`public-surface-guard.test.ts` 保持绿） |

### 12.10 AC 映射

| AC | 用例 |
|---|---|
| AC1 深相等（含 `-0`、undefined 过滤、嵌套结构） | A1/A1b/A1d/A2–A14 |
| AC2 读失败两态 / 缺席吸收（含中间缺失、越界） | B1–B30 |
| AC3 XML 穿越 / 终点 | C1–C7（+X0 口径） |
| AC4 数组下标段纪律 | D1–D15 |
| AC5 `set([])` legacy 先过 guard | E1–E7（+N4 保持） |
| AC6 大子树比较 | F1–F4（+A14 深度） |
| AC7 批量顶层 guard 同语义 | G1–G12（+N2 保持） |
| AC8 落位与门 | §12.1 路径 + `pnpm typecheck` + doc-runtime 套件 |

### 12.11 必要实现修正范围（裁定）

1. **当前 HEAD 无需任何实现修正**：AC1–AC7 的 92 个可执行用例全部与 ADR 0025 期望一致（§5），且 4 个错误实现模型全部被击穿（§9.2）。
2. **条件范围（仅在实现阶段出现红色时启用）**：以 ADR 0025 为准修正，且修正必须收敛于 doc-runtime guard 专属面——
   - 允许：`packages/doc-runtime/src/mutation.ts` 内 guard 专属逻辑（`parseGuard` 形状检查、`evaluateGuard` 两态判定、guard 专属深相等比较器、`mismatchIssue` 摘要）。
   - 禁止（SA8 §4 冻结面）：稳定码字面量、不满足 issue 形态（单 issue/`path`=guard 路径/摘要）、形状错误族与其无码性、谓词词表、单操作无 guard 逐字节契约、`index.ts` 导出集、评估位置与次序、`set([])` 管线归属。
   - 谨慎：`logicalValuesEqual` 同时被 `resolveNode`（union 成员判别，mutation.ts L535）消费；**不得**为 guard 需求整体重写该共享助手，优先新增 guard 局部比较器，并附 union 面回归证据。
   - 触及 `read.ts`（ADR 0008/0016 契约）或任何冻结面 → 回 SA8 复核；触及 mutation/read 契约 → 追加根 `pnpm test`（AGENTS.md Verification）。
3. **边界不属修正范围**（§9.3）：`A15`（equals 侧自定义 plain 原型链）、`Z1–Z3`（环状/万层深输入）、`D14/D15`（非安全整数/NaN 段）——均非 AC 项、非 ADR 条款、当前 fail-closed 且零写入；若要改变须独立决策（回 SA8）。

### 12.12 本契约不替设计决策的部分

- 不新增谓词、不改错误域形状、不放宽 guard 路径 `[]` 禁令；
- 不定义非 JSON 输入的 equals 语义（含原型链/循环/深度上限）；
- 不引入跨实例/复制面行为（ADR 0025 L62–66 边界照旧）；
- 不改变 `set([])` 管线归属与批量元素 guard 禁令。

## 13. Red/green 与基线证据

- **基线（HEAD 61e2daa）全绿**：doc-runtime 28 files/447 tests；根 typecheck exit 0；根 test 349 files/3686 tests、no type errors。语义矩阵 92/92 与 ADR 一致。
- **契约性质：锚定/回归矩阵（目标绿），不是红灯契约。** ADR 0025 的 guard 能力已由 `#347` 落地并有红灯证据；本票不伪称红灯——若把「未实例化」写成「HEAD 红」，即是伪造。真正被证明的缺口是**既有套件对两个错误实现模型完全盲**（§9.2 M2/M3）。
- **反伪绿证据**：M2/M3 下既有 447 用例全绿而新矩阵 DEV=5/3 → 用例非重言式；M1/M4 下既有套件与新矩阵均亮红 → 极性正确。所有断言观察运行时行为（结果联合、值、事务/update、字节），无源码字符串断言。
- **可触发**：§14。

## 14. Runner trigger evidence

- 在**冻结落点路径**临时放置 1 个 trivial 测试（仅用于证明真实入口发现性，随后删除）：

```text
$ NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest list \
    packages/doc-runtime/test/issue-348-guard-semantics-matrix.test.ts
packages/doc-runtime/test/issue-348-guard-semantics-matrix.test.ts > SA6 runner trigger probe (temporary, deleted after evidence) > real entry discovers this path

$ NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run \
    packages/doc-runtime/test/issue-348-guard-semantics-matrix.test.ts
 ✓ packages/doc-runtime/test/issue-348-guard-semantics-matrix.test.ts (1 test) 2ms
 Test Files  1 passed (1)
      Tests  1 passed (1)
```

- 根配置 `vitest.config.ts` 的 `test.include = ['packages/*/test/**/*.test.ts', …]` 覆盖该路径；临时文件已删除（`ls` 报 No such file；`git status` 无残留）。
- AC8 门命令（实现票执行）：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/doc-runtime/test` + 根 `pnpm typecheck`。

## 15. Unknowns and blockers

- **无阻塞**：诊断稳定复现（92/92，多轮一致）、根因链（锚缺失）已证实、契约可执行、落点可被真实入口发现、前置齐备。
- 明确登记的未知（均不阻塞本契约，且**不请求修正**，见 §9.3/§12.11）：
  1. `equals` 侧非 JSON 形态（自定义 plain 原型链 A15、循环输入 Z1、数千层深 Z2）的语义未被 ADR 定义；当前行为：前两者 fail-closed 零写入（A15 稳定码拒绝、Z1 走 E205 无码内部错误），Z2 亦 fail-closed。
  2. 读面栈边界（Z3）：`.doc` 直造的万层深值会让 `readLogicalValueAtPath` 自身栈溢出并收编为 `PATH_NOT_ALLOWED`，从而令 `absent` 满足并放行写入——与 ADR 0025 L43 字面一致，但在「不可读 ≡ 缺席」上存在理论上的语义张力；受控 schema 写路径不可产出该形态。
  3. 环境相关：本 worktree 依赖由离线 store 安装（`node_modules` 为 gitignored，非诊断改动）；AC8 门需在同一条件下执行。
- 未证实的猜测（不作契约依据）：无。

## 16. Temporary diagnostics cleanup

| 项 | 证据 |
|---|---|
| 生产实现未改动 | 4 次变异实验每次以 `git checkout -- packages/doc-runtime/src/mutation.ts` 回滚；回滚后 `git diff --quiet` 干净，`sha1sum` 与 `git show HEAD:…` 均为 `dd46e2bcec58dd8c6dab61175e08ce994f9de397` |
| 临时探针脚本 | `packages/doc-runtime/.sa6-probe/probe-issue-348.ts`（未入库、非 `.test.ts`）已整目录删除；`git status --short` 仅剩任务自带未跟踪文件 `wiki/raw/task_issue-348*.md` 与本报告 |
| 临时 runner-trigger 测试 | `packages/doc-runtime/test/issue-348-guard-semantics-matrix.test.ts` 已删除（§14） |
| 服务/进程 | 未启动任何常驻服务；无 nohup/setsid/PID 文件；所有命令前台或 job 收尾 |
| 依赖安装 | `pnpm install --offline --frozen-lockfile` 仅产生 gitignored `node_modules`，属验证必需环境，非诊断改动 |
