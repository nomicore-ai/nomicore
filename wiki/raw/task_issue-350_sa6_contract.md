# SA6 诊断与验收契约 — issue #350 原子变更信封（mutateData 批量 ops，ADR 0026）

- 任务类型：**feature**（能力缺口证明 + 目标行为验收契约；不虚构 Bug 根因）
- 被审对象：issue #350「原子变更信封：mutateData 批量 ops 多操作全有或全无（ADR 0026，guard 前置）」
  （brief `wiki/raw/task_issue-350.md`；labels: in-progress/feature）
- 诊断基线：HEAD `211c5fa7f3b03ddf9666939691d104ff8778d76b`（2026-09-13T00:09:03+08:00，
  「docs(adr): ADR 0026 原子变更信封（批量多操作）——先行于 0025 条件写」）
- 结论：`approve`（能力缺口稳定可证；契约可执行、红在正确断言处、负控全绿、测试入口真实；
  一项设计边界 `set([])` 元素按 SA8 移交 SA1 封口，本契约以 decision-neutral 断言钉住两闭口公共不变量）

---

## 1. Task type and inputs

| 输入 | 用途 |
|---|---|
| `wiki/raw/task_issue-350.md` | Host task brief：issue #350 正文、AC1–AC8 |
| `wiki/raw/task_issue-350_conflict_report.md` | SA8 前置门禁：决策分类、override、冻结面、移交义务、verdict `clear` + `requiresConflictRecheck: true` |
| `wiki/raw/task_issue-350_relevant_decisions.md` | SA8 决策摘录（ADR 0026/0007/0008/0025/0011/0014/0023 与现状代码事实） |
| `docs/adr/0026-atomic-mutation-envelope.md` | 主决策（已接受，commit `211c5fa`） |
| `docs/adr/0007`（含 #237 修订节）、`0008`、`0025`、`0011`、`0014` | 逐操作管线 / 槽机械 / guard 组合 / 诊断记录契约 |
| `CONTEXT.md` L89–122、`.agents/skills/nomicore/typed-access.md` L163–201 | 词汇表与批量信封使用范式（文档义务已随 `211c5fa` 完成） |
| 源码现状 | `packages/doc-runtime/src/{mutation,mutation-local,index}.ts`、`packages/namespace-runtime/src/{runtime,write,diagnostic}.ts`、既有测试与 fixture |

Issue 评论：**无**（REST 预读，无 owner 评论、无 override 要求）——见 §2。

## 2. Owner comment mapping

| Owner 评论 | 映射 |
|---|---|
| （无） | 无额外要求；契约完全由 issue 正文 AC1–AC8 + ADR 0026 + SA8 冻结面推导 |

## 3. SA8 constraints（逐条纳入，含冻结面）

| SA8 约束（来源） | 本契约落点 | 证据 |
|---|---|---|
| 单操作信封行为逐字节不变（frozen surface 表第 1 行；0026 L17/L65；issue AC5） | doc-runtime N1–N4；namespace R3 前段顺序写对照、R5、R6 | N1–N4、R5、R6 当前全绿；全仓 341/343 文件、3602/3615 用例零回归 |
| 一个写槽 = 一次变更尝试；S1–S7 不重排；S3 对整个信封一次快照；不新建槽类型 | R7（排队期间改动 ops → 槽起点快照获胜）、R5（停接纳先于输入访问）、R6（`{ops}` 信封整体 plain-data 快照） | R5/R6 绿；R7 红点为批量本身（快照语义在批量落地后由同一 S3 承接） |
| 稳定码 append-only、批量无新增稳定码（0026 L42） | R4（形状错误 record `code === undefined`）、R5（`RUNTIME_WRITE_DISABLED` 文案路径不变） | 断言均为运行时 record/结果观察 |
| 诊断词表与记录形态冻结：operation 仍 `root-mutation`、stage/result 联合不变、一尝试一最终 record、rejected 禁携带 update、槽外 emission | R3（批量恰 1 条 record + 单条 owned update bytes，对照 3 次顺序写 3 条）、R4（形状错误 rejected、无 effect、无 code） | 断言记录字段；emission 调用点未改（同一 `.then` 槽外路径，SA3 不得移动） |
| 聚合 issues 经 R9 同源透传进同一记录（SA8 required action 4） | R2（聚合 ≥2 条失败 path）、R4（rejected issues 存在） | 红：当前仅 1 条 `未知操作 "undefined"` |
| `ops` ≤16、元素禁 `guard` 为冻结词表（0026 L29/L73、0025 L74、issue AC3） | B5（16 接受 / 空数组与 17 拒绝零写入）、B6（元素 guard 键 → 形状错误） | B5/B6 红点被合法批量 anchor 保护（防与当前未实现状态同义反复） |
| 批内路径互不嵌套（祖先-后代或相同）（0026 L30） | B7（兄弟路径接受 anchor + 祖先-后代/相同路径拒绝；每个元素先证单独合法） | `expectEachOpLegalAlone` 构造前置，杜绝「因元素非法而空转的拒绝」 |
| 最小 edit 不降级（0026 L36） | B4（700k 兄弟字段下 update < 1000 字节 + unrelated Y 载体身份保持） | 红：批量未实现；实现后整父/整根替换必然超限 |
| 跨实体路径同样原子（0026 L35；issue AC4） | B2（不同 Record 条目 + 不同集合的四动词）、R1（端到端） | 红点为批量未实现 |
| `MUTATION_INPUT_NOT_PLAIN_DATA` 对整个 `{ops}` 信封的 S3 快照拒绝保持（required action 6） | R6（class 实例 + accessor 元素 → 整体拒绝、零写入、accessor 零执行） | R6 绿（当前与目标同路径） |
| lifecycle 停接纳次序不变（issue AC7） | R5（close 后批量 → acceptance/`RUNTIME_WRITE_DISABLED`/`not-accessed`/零输入访问） | R5 绿 |
| 公共面纪律：新公共类型只经 `src/index.ts`、同步登记 public-surface 守卫测试（required action 3） | **未在契约中发明类型名**；作为 SA1/SA3 义务写入 §12/§15（类型名属设计决定，SA6 不预占） | `packages/doc-runtime/AGENTS.md`；`public-surface-guard.test.ts` / `public-surface-type-guard.test-d.ts` 现状 |
| 未决设计边界：`set([])` 作为批量元素（SA8 conflict report §4/§8 移交 SA1） | **B8 decision-neutral**：闭口必须为「形状错误零写入」或「legacy 等价原子全量重装」二者之一；确定性；不得 fallback/部分写 | B8 的 anchor 在批量未实现时红；两闭口分支各自带完整原子/零写入断言 |
| 不触复制 wire / apply / META / readData / `replaceSchema`（0026 L50–51） | 契约零涉及；无新增测试 | SA8 Decision analysis「范围外条款」行 |
| fatal 通道不变、无新增稳定码 | 契约不新增 fatal 触发测试（无可确定性触发点且通道未改）；由既有 fatal 套件锚定 | 见 §15 未知项 |

## 4. Environment and baseline

| 项 | 值 |
|---|---|
| 环境 | Linux；node v24.13.0；pnpm 10.28.2；vitest 3.2.7；`pnpm install --frozen-lockfile --prefer-offline`（65 包复用本地 store） |
| 运行入口 | `NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run <path>`；根 `pnpm test` = `vitest run --typecheck`，include `packages/*/test/**/*.test.ts`，`maxWorkers: 1` |
| 基线（改动前现状，绿） | `packages/doc-runtime/test/apply-validated-mutation-operations.test.ts` 21 passed；`packages/namespace-runtime/test/runtime-mutate-root-sequencer.test.ts` 12 passed；`tsc -p packages/doc-runtime/tsconfig.json` OK |
| 全仓基线（含新契约文件） | `pnpm test`：343 文件 / 3615 用例；**仅 2 个新契约文件红（13 断言）、341 文件 3602 用例绿**；typecheck 无错 |
| fixture 合法性 | 批量元素逐个先以单操作形态在 scratch doc 上验证合法（probe 表见 §5；测试内 `expectEachOpLegalAlone` 同款前置） |

## 5. Positive reproduction（能力缺口复现）

最小复现（临时 probe，命令见 §16；输出逐字）：

```
batch-all-legal -> {"ok":false,"issues":[{"message":"未知操作 \"undefined\"","path":[]}]}
batch-zero-write? true
batch-empty -> {"ok":false,"issues":[{"message":"未知操作 \"undefined\"","path":[]}]}
dual-shape -> {"ok":false,"issues":[{"message":"未知信封键 \"ops\"（操作 set）","path":[]}]}
batch-element-guard -> {"ok":false,"issues":[{"message":"未知操作 \"undefined\"","path":[]}]}
single-op {"op":"set","path":["tasks","t1"],"value":{"status":"held","reviewer":"r1"}} -> {"ok":true}
single-op {"op":"set","path":["tasks"],"value":{...完整 Record...}} -> {"ok":true}
single-op {"op":"delete","path":["tasks","t2","reviewer"]} -> {"ok":true}
single-op {"op":"array-insert","path":["values"],"index":3,"values":[4]} -> {"ok":true}
single-op {"op":"array-delete","path":["more"],"index":0,"count":1} -> {"ok":true}
single-op {"op":"set","path":["a"],"value":"y"} -> {"ok":true}
single-op {"op":"set","path":["values",1],"value":8} -> {"ok":false,"issues":[{"message":"set 终态不支持数组下标","path":["values",1]}]}（数组下标 set 本就不支持，未用于契约构造）
single-op set([]) -> {"ok":true}
op-element-alone (t17) -> {"ok":true}
batch-17-elements -> {"ok":false,"issues":[{"message":"未知操作 \"undefined\"","path":[]}]}
```

- 期望（ADR 0026）：`{ops:[...]}` 全部合法 → `{ok:true}`、全部值落盘、单事务单 update；
  任一失败 → `ok:false` + 聚合 issues + 整体零写入；形状错误 → 无码拒绝零写入。
- 实际：`{ops}` 落单操作解析路径 → `未知操作 "undefined"`（`env.op === undefined`）；
  零写入但**整个批量能力不存在**（正例、聚合、单事务、诊断 committed 记录全部不可达）。
- 生产代码零 `ops` 引用证据：`grep -n "ops" packages/doc-runtime/src/mutation.ts packages/namespace-runtime/src/write.ts` → 无匹配。
- 复现率：确定性 100%（同步纯谓词；3 次重复运行结果逐字节一致，见 §7）。

## 6. Negative control（当前全绿，实现后必须保持）

| 负控 | 断言 | 当前 |
|---|---|---|
| N1 单操作四动词幸福路径 | 各恰 1 事务 1 update；值正确 | 绿 |
| N2 单操作失败 | 零写入 + 恰 1 条 issue（path 精确、含「类型不匹配」） | 绿 |
| N3 单操作未知信封键 loud 拒绝 | 零写入 + 文案含 `未知信封键 "zzz"` / `操作 set`（SA8 frozen surface 明文锚） | 绿 |
| N4 单操作 `set([])` | legacy 全量重装合法（ADR 0008 L47 唯一全量形态） | 绿 |
| R5 close 停接纳 | 批量信封零入队拒绝、`RUNTIME_WRITE_DISABLED`、`not-accessed`、Proxy 零输入访问、字节不变 | 绿 |
| R6 S3 快照边界 | `{ops}` 内 class 实例/accessor → `MUTATION_INPUT_NOT_PLAIN_DATA`、零写入、accessor 零执行 | 绿 |
| R3 前段（顺序写对照） | 3 次顺序单操作写 → 3 条 committed record（证明「批量 1 条」断言非空转） | 绿 |

## 7. Stability, scale and timing

- 全部契约断言为同步/微任务内的确定性观察，无 sleep、无墙钟阈值、无竞态窗口；
  R7 用 `p0Gate` 显式制造「已接纳未开槽」窗口（确定性），不依赖调度时序。
- 重复性：两文件合并运行 3 次 → 每次 `Tests 13 failed | 6 passed (19)`、`Type Errors no errors`，结果一致。
- 规模：B4 用 700 000 字符兄弟字段 + `< 1000` 字节 update 上界（最小 edit 的量级判别，
  非性能断言）；B5 用 17 个 Record 条目构造 16/17 元素边界。
- 时长：doc-runtime 文件 ~36ms、namespace-runtime 文件 ~60ms；全仓 `pnpm test` 580.77s（maxWorkers 1）。
- 无 skip/only/todo/env override；无软断言；无吞错。

## 8. Root-cause chain（能力缺口）

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| 1 | ADR 0026 已接受并要求双形态信封：`{ops:[...]}` 合法批量、逐操作 prepare、单事务、聚合 issues、单条诊断 | `docs/adr/0026` L14–46；commit `211c5fa`；issue #350 AC1–AC8 | 高 |
| 2 | 现状解析器先读 `env.op`；`{ops}` 无 `op` → 立即 `未知操作 "undefined"`，从不读取 `ops` 键 | `mutation.ts` L317–333（`op`/specs 判定先于任何 `ops` 识别）；probe 输出 | 高 |
| 3 | 因此不存在批量解析 / 逐操作 prepare / 聚合 / 单事务提交路径；`{ops}` 的「零写入」是拒绝副产物而非原子性实现 | probe `batch-zero-write? true` 但 `batch-all-legal` 拒绝；生产代码零 `ops` 引用 | 高 |
| 4 | 端到端面同源透传：写槽 S5 把整信封交给 `applyValidatedMutation`，拒绝经 R9 变 `ok:false` | `write.ts` L186–208；`runtime.ts` L512–533；R1/R2 红 | 高 |
| 5 | 诊断面因此只有 rejected/validation 一条记录、无 update bytes，正例 committed 记录不可达 | R3/R4 红：`committedUpdateOf` 抛「预期 committed/effect=update，实际 {kind:'rejected'}'」 | 高 |
| 6 | 冻结面（S3 快照、停接纳、单操作形态）不依赖 `ops` 识别，故负控全绿 | R5/R6/N1–N4 绿 | 高 |

## 9. Causal experiments

| 实验 | 控制变量 | 观察 | 结论 |
|---|---|---|---|
| E1 信封键替换 | 同一 fixture/doc，仅把 `{op,path,value}` 换成 `{ops:[同元素]}` | 单操作 `{ok:true}`；批量 `{ok:false,未知操作 "undefined"}` | 差异被单点隔离在信封键 → 缺口在信封解析，不在文档/元素值 |
| E2 元素合法性前置 | 每个契约用到的批量元素单独以单操作 apply 到 scratch doc | 全部 `{ok:true}`（`set` 容器/可选字段 delete/array-insert/array-delete/set([])/16+1 元素） | 后续「拒绝」类断言不会因元素本身非法而空转 |
| E3 槽内阶段定界 | `{ops}` 内放 class 实例 / accessor | `MUTATION_INPUT_NOT_PLAIN_DATA`、accessor 零执行、零写入 | S3 快照先于批量解析；纯 plain data 的 `{ops}` 能穿过 S3 到达 S5，缺口确在 S5 解析 |
| E4 接纳层定界 | close 后以 Proxy 包 `{ops}` 调 `mutateData` | `RUNTIME_WRITE_DISABLED`、`not-accessed`、Proxy 零访问、字节不变 | lifecycle 门先于批量处理；停接纳次序不受缺口影响 |
| E5 诊断计数敏感性 | 3 次顺序单操作写 vs 1 次批量 | 顺序写恰 3 条 committed record（当前绿、非空转对照） | 「批量恰 1 条」断言的计数口径有效，不会恒真 |

## 10. Impact surface

| 面 | 影响 |
|---|---|
| `packages/doc-runtime/src/mutation.ts` | `parseMutation` 双形态互斥 + `ops` 约束/嵌套检查 + 逐操作 prepare/聚合/单事务提交（SA3 实现） |
| `packages/doc-runtime/src/index.ts` | 新公共类型（若设计新增）只经此导出；public-surface 守卫测试同步登记（SA1/SA3） |
| `packages/namespace-runtime/src/write.ts` | 信封无关（S3 已整体快照 plain data）；预计零改动，但诊断 R9/单记录口径须验证 |
| 诊断日志 | operation 词表仍 `root-mutation`、stage/result 不变、无新增稳定码；一次尝试一条记录（不变式，无包改动） |
| typed access 技能/文档 | `211c5fa` 已完成文档义务；实现只需让契约成真 |
| 复制/协议/持久化 | 零影响（SA8 无冲突；契约不涉） |
| 既有测试 | 全仓 341/343 文件保持绿；新增 2 个契约文件 13 红待实现翻绿 |

## 11. Ruled-out hypotheses

| 假设 | 反证 | 结论 |
|---|---|---|
| H1 环境/fixture 损坏导致失败 | 同 fixture 单操作四动词、`set([])` 全绿（N1/N4）；失败文案是领域拒绝而非异常/超时 | 排除 |
| H2 公共面缺 `mutateData` | `runtime.mutateData` 存在且顺序单操作写成功（R3 前段 3/3 绿） | 排除 |
| H3 S3 快照器把 `{ops}` 判为非 plain data | 纯 plain data 批量被拒文案为 `未知操作 "undefined"` 而非 `MUTATION_INPUT_NOT_PLAIN_DATA`；反之含 class 实例才触发快照码（R6） | 排除（S3 不是缺口位置） |
| H4 「批量已零写入 ⇒ 原子性已满足」 | 零写入来自整体拒绝（无任何合法批量被接受）；聚合、单事务、committed 记录均未实现 | 排除 |
| H5 `{ops}` 走的是「未知信封键」形式门（符合 ADR 0026 L65 旧运行区描述） | probe：`{ops}` 文案是 `未知操作 "undefined"`；`未知信封键 "ops"` 只在 `op` 与 `ops` 同现时出现——当前是单操作解析失败，不是形式门 | 排除（描述性差异，非缺陷；能力缺口证据更强） |
| H6 诊断面已满足「一条记录」 | 当前确实只有 1 条，但为 rejected/validation、无 update bytes；正例 committed 记录不可达 | 排除（计数巧合≠契约） |

## 12. Acceptance contract and test paths

测试文件（本契约即行为规格，SA3 改实现不改断言）：

1. `packages/doc-runtime/test/issue-350-batch-envelope-red.test.ts`（12 用例：B1–B8 红 / N1–N4 绿）
2. `packages/namespace-runtime/test/issue-350-batch-envelope-red.test.ts`（7 用例：R1–R4、R7 红 / R5–R6 绿）

| 用例 | 观察断言 | 旧实现（HEAD）预期 | 目标实现预期 |
|---|---|---|---|
| B1 | 批量三操作全合法 → `ok:true`；值全落盘；恰 1 本地事务 + 1 update；update 事件时刻已见全部值 | `ok:false`（未知操作） | 绿 |
| B2 | 跨 Record 条目 + 不同集合四动词批量 → 单事务、全部生效 | `ok:false` | 绿 |
| B3 | 两失败 + 一合法 → `ok:false`、issues ≥2 且按 ops 顺序含各自 path、字节不变、0 事务 0 update | 1 条 issue（path `[]`） | 绿 |
| B4 | 700k 兄弟字段下批量 → 载体身份保持 + update < 1000 字节 | `ok:false` | 绿 |
| B5 | 16 元素接受；空数组 / 17 元素拒绝零写入 | 16 拒绝 | 绿 |
| B6 | 合法单元素批量 anchor 接受；双形态/ops 非数组/元素缺键/未知 op/非对象/未知键/guard 键/顶层未知键全部拒绝零写入 | anchor 拒绝 | 绿 |
| B7 | 兄弟路径接受；祖先-后代与相同路径拒绝（元素先证单独合法） | 兄弟路径拒绝 | 绿 |
| B8 | `set([])` 元素：合法 anchor 后，闭口必须为「形状错误零写入」或「legacy 等价原子全量重装」；且确定性 | anchor 拒绝 | 绿（任一闭口） |
| N1–N4 | 单操作四动词/失败/未知键文案/`set([])` 逐字节不变 | 绿 | 绿（不变） |
| R1 | 端到端批量 `ok:true`、readData 见全部、1 notifier、1 update | `ok:false` | 绿 |
| R2 | 端到端失败：聚合 issues、字节不变、notifier 0 | 1 条 issue | 绿 |
| R3 | 3 次顺序写 = 3 条 committed 记录（对照，绿）；批量后总记录恰 4 条、第 4 条 committed/effect=update，重放基态 + bytes 见全部批量值 | 批量 `ok:false` | 绿 |
| R4 | 合法批量 1 条 committed；两次形状错误各 1 条 rejected（stage validation、`code===undefined`、无 effect、capture digest）；字节不变 | 合法批量非 committed | 绿 |
| R5 | close 后批量零入队拒绝（`RUNTIME_WRITE_DISABLED`/`not-accessed`/零访问/零字节） | 绿 | 绿（不变） |
| R6 | `{ops}` 含非 plain data 整体拒绝、accessor 零执行、零写入 | 绿 | 绿（不变） |
| R7 | 排队期间改动 `ops[0].value` → 槽起点快照获胜（99） | `ok:false` | 绿 |

AC 映射：AC1→B1/B2/R1；AC2→B3/R2；AC3→B5/B6/B7/R4；AC4→B2/R1；AC5→N1–N4/R3 前段/R5/R6；
AC6→R3/R4；AC7→R1/R5/R7；AC8→§4 与 §14 的 typecheck / 全仓 test 入口。

SA1/SA3 义务（类型名与 `set([])` 边界不在本契约冻结，见 §15）：① 设计封口 `set([])` 元素边界；
② 定型批量公共类型名目并同步登记既有 public-surface 守卫测试（值导出面与类型守卫各自门禁）；
③ 保持聚合 issues 经 R9 同源透传、emission 槽外、无新增 operation/stage/result 词与稳定码。

## 13. Red/green evidence

命令与结果（日志原文见 §16 清理说明；关键输出逐字）：

```
$ vitest run packages/doc-runtime/test/issue-350-batch-envelope-red.test.ts
 Test Files  1 failed (1)
      Tests  8 failed | 4 passed (12)
Type Errors  no errors

$ vitest run packages/namespace-runtime/test/issue-350-batch-envelope-red.test.ts
 Test Files  1 failed (1)
      Tests  5 failed | 2 passed (7)
Type Errors  no errors

$ vitest run <both files>   # ×3 次一致
 Test Files  2 failed (2)
      Tests  13 failed | 6 passed (19)
Type Errors  no errors
```

红点全部落在「批量必须被识别/提交」处，失败原文示例：

```
doc-runtime B1 (L157): 批量全部合法必须 ok:true；实际 {"ok":false,"issues":[{"message":"未知操作 \"undefined\"","path":[]}]}
doc-runtime B3 (L212): 必须聚合两个失败操作的全部 issues；实际 issues=[{...path:[]}]: expected 1 to be greater than or equal to 2
doc-runtime B4 (L236): 最小 edit 批量必须 ok:true；实际 {"ok":false,...}
doc-runtime B5 (L256): 16 个元素（冻结上限）必须接受；实际 {"ok":false,...}
doc-runtime B6 (L273)/B7 (L304)/B8 (L351): 批量形态必须已被识别（合法 anchor 拒绝）
namespace R1 (L186): 批量经公共面必须透传为 ok:true: expected {ok:false,...} to deeply equal {ok:true}
namespace R2 (L212): 必须聚合全部失败操作的 issues；expected 1 to be greater than or equal to 2
namespace R3 (L242): 一次批量尝试必须 ok:true（对照 3 条顺序写记录已先行通过）
namespace R4 (L265): 合法单元素批量必须 ok:true（红：当前 {ops} 未实现）——该记录断言的前置
namespace R7 (L309): pending rejects {ok:false,...}
```

绿点：N1–N4、R5、R6（6 用例）——与 §6 负控表一一对应。

## 14. Runner trigger evidence

- 根 `pnpm test`（`vitest run --typecheck`，include `packages/*/test/**/*.test.ts`）实测（2026-09-13）：
  `Test Files 2 failed | 341 passed (343)`；`Tests 13 failed | 3602 passed (3615)`；`Type Errors no errors`；
  Duration 580.77s。**全仓红点恰为本契约 13 条**，无环境/夹具/入口错误，无既有测试被破坏。
- 两文件均被默认 glob 收集（无需额外配置）；`--typecheck` 面（`.test-d.ts`）零新增错误。
- `tsc -p packages/doc-runtime/tsconfig.json`（含 `test/**/*.ts`）通过——doc-runtime 契约文件编译门成立。
- 与 issue AC8 对齐：实现落地后应满足「根 `pnpm typecheck` + doc-runtime / namespace-runtime 相关测试通过」；
  当前唯一失败即契约红灯，实现后即绿。

## 15. Unknowns and blockers

| 项 | 状态 | 处置 |
|---|---|---|
| `set([])` 作为批量元素（SA8 移交 SA1 的封口项） | **未决**（ADR 0026 未明示；0008 L47 唯一全量句存在解释张力） | B8 decision-neutral：钉住两闭口公共不变量（形状错误零写入 / legacy 等价原子全量重装）与确定性，不替设计选择；SA1 封口后 SA6 下一轮升级为单向断言 |
| 批量公共类型名目与 public-surface 守卫登记 | 未决（属设计） | 不在契约中发明类型名；SA3 按 SA8 required action 3 登记既有守卫测试与负例 |
| 形状错误在诊断面落 `stage: 'validation'`、`input.capture: 'digest'` | 依据槽序推导（S3 快照先于 S5 解析→R9 diagValidation），当前实现与目标实现同路径 | 已作为 R4 断言；若 SA1 改变信封校验在槽内的位置，须回写本契约 |
| 批量顶层未知键（`{ops, zzz}`）为形状错误 | ADR「恰提供两种形态之一」+ 单操作未知键 loud 拒绝类推；AC3 未逐字列出 | 已纳入 B6；属解释性锚点，SA1 若另有决定须回写 |
| 批量 fatal 通道（post-commit 偏离 → E201 变体 C） | 无可确定性触发点且 SA8 冻结通道不变 | 契约不新增；沿用既有 fatal 套件（`apply-validated-mutation-fatal-contract` 等） |
| 顶层 `guard` / `MUTATION_GUARD_MISMATCH` | 属 #347–#349，本票不含 | 契约仅要求元素 `guard` 即刻拒（B6/R4） |
| `ops` 上限 16 放宽、批内嵌套受控放宽 | ADR 0026 开放问题 1/2 | 契约按冻结值 16 与全拒嵌套锚定；放宽须新决策并回写 |
| 跨实例/复制语义 | 边界外（0026 L50–51） | 零测试、零断言 |

无阻塞项（无环境缺失、无不可复现、无红在错误原因）。

## 16. Temporary diagnostics cleanup

- 临时 probe 脚本：`packages/doc-runtime/probe-350.tmp.ts`（运行时观察当前行为 + 元素合法性前置），**已删除**。
- 临时日志/运行目录：`.scratch/issue-350/`（probe 输出、契约红运行日志、全仓 test tail），**已删除**；
  `.scratch/vfsl-v1-parser`（先前存在，非本次产物）保持原样。
- 生产实现零改动：`git status` 仅显示 2 个新增测试文件与本报告（及 Host 预置的 `wiki/raw/task_issue-350*.md`）。
- 长命令：全仓 `pnpm test` 经 bash 后台作业运行并已回收（无遗留进程/服务/nohup）。
- probe 原始命令（供复跑）：
  `NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/tsx packages/doc-runtime/probe-350.tmp.ts`
  （脚本内容为「构造 ROOT fixture → 分别以单操作/批量信封 applyValidatedMutation → 打印结果与字节不变性」，
  已按上表逐字留档于 §5，不再保留脚本本体）。
