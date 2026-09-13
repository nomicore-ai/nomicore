# SA3 Implementation Report

任务：issue #350「原子变更信封：mutateData 批量 ops 多操作全有或全无（ADR 0026，guard 前置）」
（Feature；Issue 评论：无——Host REST 预读「none; there are no owner-comment requirements」）。

| 项 | 值 |
|---|---|
| 实现基线 | HEAD `211c5fa`（工作区起始状态：SA6 两红灯契约文件 + Host wiki 产物未跟踪，生产代码零 `ops` 引用） |
| 角色 | SA3（TDD 执行者；使指定红灯契约转绿 + 受影响包 typecheck + 设计指定静态 check） |
| 结论 | 实现完成：SA6 红灯契约 13 红 → 0 红（19/19 绿）；设计新增 S1–S8/NS-1/NS-2 落点 12/12 绿；受影响两包 769 用例零回归；根 `pnpm typecheck` OK。**一项设计字面 fixture 不可执行，已按语义等价构造替换并留证**（见「Deviations」§1）。 |

---

## Inputs consumed

| 输入 | 用途 |
|---|---|
| `wiki/raw/task_issue-350.md` | Issue #350 正文与 AC1–AC8 |
| `wiki/raw/task_issue-350_design.md`（iteration 2） | 最新批准设计（D1–D7、§7.5.2 阶段 C、§11 ALLOW/DENY、§12.1 新增用例规格） |
| `wiki/raw/task_issue-350_sa2_review.md`（iteration 2，verdict approve） | F1–F6 处置与 Required revisions（无残留 BLOCKER/MAJOR/MINOR） |
| `wiki/raw/task_issue-350_sa6_contract.md`（approve） | 红灯契约（B1–B8/N1–N4、R1–R7）与验收映射 |
| `wiki/raw/task_issue-350_conflict_report.md`（clear，`requiresConflictRecheck: true`） | SA8 冻结面、required actions 1–7 |
| `wiki/raw/task_issue-350_relevant_decisions.md` | ADR 0026/0007/0008/0025/0011/0014/0023 摘录与现状代码事实 |
| `docs/adr/0026-atomic-mutation-envelope.md`、`docs/adr/0007`（#237 节）、`0008`、`0025`、`0011`、`0014` | 主决策与冻结语义 |
| 源码 | `packages/doc-runtime/src/{mutation,mutation-local,index,install-verify,detached-build,extract}.ts`、`packages/vfsl/src/validate-patch.ts`（plan/apply 纯函数）、`packages/namespace-runtime/src/{write,runtime,diagnostic}.ts`（只读核对） |
| 测试 | SA6 两红灯契约文件全文；`public-surface-guard.test.ts` / `public-surface-type-guard.test-d.ts`；`vitest.config.ts`、`tsconfig*.json`、`package.json` |

无缺失输入使范围或契约不可确定；设计内部一致、可实施（唯一例外见 Deviations §1），SA2 无未落实 BLOCKER/MAJOR。

## Existing worktree reconciliation

- 起始工作区：无 `wiki/raw/task_issue-350_sa3_impl.md`，无未提交实现；`git status` 仅 SA6 两契约文件与 Host wiki 产物未跟踪。
- SA6 两契约文件**只读消费、逐字未改**（B1–B8/N1–N4、R1–R7 断言零改动）；未新增 `skip/only/todo`。
- 设计 ALLOW 中「两新增文件」原不存在，本报告为其首次创建。
- 无冲突的旧实现需要保留或删除；无范围外改动遗留。

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/doc-runtime/src/mutation.ts` | §7.1 D1（分发）、§7.3 D3（E1–E5）、§7.4 D4（逐操作 prepare 聚合）、§7.5 D5（阶段 C 组合 + 单事务 + 逐操作验证）、§7.6/§7.8、§8.1/§8.2 | `BatchedMutation`/`MutationEnvelope` 公共类型、包内 `MAX_BATCH_OPS=16`、`MutationPrepared` 新增 `{kind:'batch';items}`、`parseMutation` 抽共享解析核 `parseMutationCore(input, prefix)`（空 prefix 消息逐字节不变）、`prepareBatchMutation`（E1–E5+P）、`composeBatchVerify`（阶段 C：plan 复跑 + 严格前缀折迭 + 合成 plan 应用 + fail-closed 聚合）、`payloadOf`/`isStrictPrefix`/`isPrefixOrEqual`/`issuesOf`、`applyValidatedMutation` 批量编排（单事务按序提交 + 逐操作 `verifyBoundaryIntact`）、模块头注更新 |
| `packages/doc-runtime/src/index.ts` | §7.8 D7（公共面纪律；SA8 required action 3） | 经公共入口导出 `BatchedMutation`、`MutationEnvelope` 两**类型**（无新值导出——值面守卫不动） |
| `packages/doc-runtime/test/public-surface-type-guard.test-d.ts` | §7.8 D7 守卫登记 | 正例：两类型可导入 + `batch.ops` 投影为 `readonly ValidatedMutation[]`；负例三类 `@ts-expect-error`（双形态同现 TS2353 / 元素携带 `guard` TS2353 / 非信封值 TS2322） |
| `packages/doc-runtime/test/issue-350-batch-shared-boundary.test.ts`（新增） | §11 ALLOW、§12.1 文件 A、§12 AC1′/组合失败行 | S1–S7 共享边界正例（含 S7 array-* 载荷折入）+ S8 组合失败负向守卫 + 文件内单操作负控/确定性（10 用例） |
| `packages/namespace-runtime/test/issue-350-batch-shared-boundary.test.ts`（新增） | §11 ALLOW、§12.1 文件 B、§12 AC1″/F4 行 | NS-1 端到端（含 array-* 元素折入 + 写能力保持 + 一条 committed/update record + owned bytes 重放）+ NS-2 rejected record 聚合 issues 载荷（2 用例） |
| `packages/doc-runtime/test/issue-350-batch-envelope-red.test.ts`（SA6 产物） | §11 ALLOW（仅红转绿） | **零改动**（未编辑） |
| `packages/namespace-runtime/test/issue-350-batch-envelope-red.test.ts`（SA6 产物） | §11 ALLOW（仅红转绿） | **零改动**（未编辑） |
| `wiki/raw/task_issue-350_sa3_impl.md` | 技能固定产物 | 本报告 |

未触碰任何 DENY 路径（`namespace-runtime/src/**`、`namespace-diagnostic-log/**`、`mutation-local.ts`、`install-verify.ts`、`detached-build.ts`、`fatal.ts`、`carrier.ts`、`extract.ts`、`resolve.ts`、`tx-guard.ts`、`packages/vfsl/**`、值面 `public-surface-guard.test.ts`、ADR/CONTEXT/typed-access 文档、复制/wire/持久面）。

## SA2 Finding落实

| Finding ID | Implementation | Result |
|---|---|---|
| **F1**（BLOCKER，iteration 0）：批量语境逐操作验证输入未适配——单操作「批前快照期望边界 + 提交后整边界重投影」在单事务批量下必然伪 E201-C | §7.5.2 方案 (a) 原样落实在 `mutation.ts` **批量分支内**：`composeBatchVerify` 在全部 prepare 成功之后、事务之前，逐 item 复跑 `planMutationBoundary`（纯函数、零 base 读），把同批中 `plan_i.prefix ⊊ path_j` 的操作足迹以合成 plan 调用**未改动**的 `applyMutationAtBoundary` 折入 `proposedBoundary`；`verifyBoundaryIntact`、实际侧与比较器零改动 | ✅ S1–S7 + NS-1 全绿（无伪 fatal、值全对、单事务单 update）；**反向实验 A**（禁用折迭）→ S1–S8+NS-1 共 11 用例红（折迭为真支撑） |
| **F2**（MAJOR，iteration 0）：验收对共享边界零敏感 | 两新增 ALLOW 文件落地（10 + 2 用例，含文件内负控） | ✅ 新文件全绿；SA6 契约文件对 F1 类缺陷不敏感（反向实验 A 下 19 用例仍全绿），新文件补足判别力 |
| **F3**（MINOR，iteration 0）：E205 为返回值非 throw | 批量循环（E/P/C 各阶段）的意外异常沿用既有 `prepareMutation` 顶层 catch → 返回 `ok:false` 单条 E205 issue；未新增 throw 通道；`DocRuntimeFatalPhase` 三值联合未改 | ✅ 无新增 fatal 触发点；`fatal.ts`、`install-verify.ts` 零改动 |
| **F4**（MINOR，iteration 0）：聚合 issues 进诊断记录载荷 | namespace-runtime/诊断包零改动；aggregation 数组经 `write.ts` R9 `diagValidation` 同源透传；NS-2 断言 record `issues.policy==='full'` 且 `items` 顺序 = ops 序 | ✅ NS-2 绿（rejected/validation、无码、issues ≥2 按 ops 序、零写入/0 update/notifier 0） |
| **F5**（MAJOR，iteration 1）：array-* 载荷折入共享边界无验收覆盖 | S7（doc-runtime：`delete ['tasks','t1','reviewer']` + `array-insert ['tasks','t1','notes']`）与 NS-1 第三元素（端到端）落地；`payloadOf` 的 array 分支 + 合成 plan 的 `applyMutationAtBoundary` array 分支（非空 relPath）首次在折迭位执行 | ✅ S7/NS-1 绿；**反向实验 B**（`payloadOf` array-insert 载荷置空）→ 恰 S7 + S1/S7 负控 + NS-1 三个用例红（其余 9 用例不动），判别力精确 |
| **F6**（MINOR，iteration 1）：组合失败分支「理论不可达」失真、契约锚悬空 | 阶段 C 整体校验完整实现且**不可死代码化**（合成应用失败 → 聚合 issues、零写入、无 fatal）；S8 负向守卫落地；`applyMutationAtBoundary` 的 `validateSubtree` 整边界校验保留 | ✅ S8 绿（HEAD 即绿；反向实验 A 下 S8 亦红——删/弱化阶段 C → verify 抛 E201-C 或 `ok:true`，双向判别成立）。**注意**：S8 fixture 字面构造不可执行 → 见 Deviations §1 |

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/doc-runtime/src/mutation.ts` | ALLOW 第 1 行（含「模块头注更新」） | 全部批量能力（分发/E1–E5/P/阶段 C/单事务/逐操作验证）唯一实现落点 |
| `packages/doc-runtime/src/index.ts` | ALLOW 第 2 行 | 仅新增两类型导出（公共面纪律） |
| `packages/doc-runtime/test/public-surface-type-guard.test-d.ts` | ALLOW 第 3 行 | 守卫登记（正例 + 三类编译期负例） |
| `packages/doc-runtime/test/issue-350-batch-envelope-red.test.ts` | ALLOW 第 4 行（仅红转绿，断言零改动） | 未被编辑；由实现转绿 |
| `packages/namespace-runtime/test/issue-350-batch-envelope-red.test.ts` | ALLOW 第 5 行（仅红转绿，断言零改动） | 未被编辑；由实现转绿 |
| `packages/doc-runtime/test/issue-350-batch-shared-boundary.test.ts` | ALLOW 第 6 行（新增文件，F2/F5/F6 落点） | S1–S8 + 文件内负控 |
| `packages/namespace-runtime/test/issue-350-batch-shared-boundary.test.ts` | ALLOW 第 7 行（新增文件，F2/F5 落点） | NS-1/NS-2 |
| `wiki/raw/task_issue-350_sa3_impl.md` | 技能固定产物（实现报告） | 本报告 |

`git status --short` 实际输出（实现后）：

```
 M packages/doc-runtime/src/index.ts
 M packages/doc-runtime/src/mutation.ts
 M packages/doc-runtime/test/public-surface-type-guard.test-d.ts
?? packages/doc-runtime/test/issue-350-batch-envelope-red.test.ts
?? packages/doc-runtime/test/issue-350-batch-shared-boundary.test.ts
?? packages/namespace-runtime/test/issue-350-batch-envelope-red.test.ts
?? packages/namespace-runtime/test/issue-350-batch-shared-boundary.test.ts
?? wiki/raw/task_issue-350.md
?? wiki/raw/task_issue-350_conflict_report.md
?? wiki/raw/task_issue-350_design.md
?? wiki/raw/task_issue-350_relevant_decisions.md
?? wiki/raw/task_issue-350_sa2_review.md
?? wiki/raw/task_issue-350_sa6_contract.md
```

（`??` 的 wiki 文件为 Host/上游产物，未编辑；两契约文件为 SA6 产物，未编辑。）

## Verification

| Command | Result | Evidence |
|---|---|---|
| `NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run packages/doc-runtime/test/issue-350-batch-envelope-red.test.ts packages/namespace-runtime/test/issue-350-batch-envelope-red.test.ts`（实现**前**，SA6 契约基线复核） | `Test Files 2 failed (2)`；`Tests 13 failed | 6 passed (19)`；`Type Errors no errors` | 与 SA6 §13 逐字一致（红点全部在「批量必须被识别/提交」处） |
| 同命令（实现**后**） | `Test Files 4 passed (4)`（含两新增文件）；`Tests 31 passed (31)`；`Type Errors no errors` | B1–B8/N1–N4、R1–R7 全绿；S1–S8、NS-1/NS-2 全绿 |
| `vitest run packages/doc-runtime/test packages/namespace-runtime/test`（受影响两包全量，含 `--typecheck`） | `Test Files 74 passed (74)`；`Tests 769 passed (769)`；`Type Errors no errors` | 单操作冻结面（fatal/nested-path/carrier/public-surface/sequencer/lifecycle 等）零回归 |
| 根 `pnpm typecheck` 等价命令（`tsc -p` × 14 个项目，逐条同 `package.json` `scripts.typecheck`） | 全部 OK（输出 `TYPECHECK_OK`） | vfsl / vfsl-protocol / vfsl-codegen / persistence / dsh-persistence / doc-runtime / namespace-runtime / clock / instance / namespace-registry / namespace-diagnostic-log / replication-protocol / ws-replication / yjs-server |
| `tsc -p packages/doc-runtime/tsconfig.json`（含 `test/**/*.ts`） | OK（迭代中单跑 + 最终全绿） | doc-runtime 契约/新增文件编译门 |
| **判别力反向实验 A**：临时禁用折迭（`isStrictPrefix` 判定短路）后跑四文件 | `Tests 11 failed | 20 passed`——S1–S8、两条文件内负控、NS-1 全红；SA6 契约 19 用例仍全绿 | 证明 (a) 阶段 C 折迭为 S1–S7/NS-1 的真支撑；(b) 新文件补上了 SA6 契约的共享边界盲区（SA2 F2 判断复核属实） |
| **判别力反向实验 B**：临时把 `payloadOf` 的 `array-insert` 载荷置空后跑两新文件 | `Tests 3 failed | 9 passed`——恰 S7、S1/S7 负控、NS-1 红；S1–S6/S8/NS-2 绿 | 证明 F5 落点（array-* 载荷折迭）判别力精确、无空转 |
| 实验后恢复 | `git diff --stat packages/doc-runtime/src/mutation.ts` → `236 insertions(+), 14 deletions(-)`；两包全量复跑 769/769 绿 | 实现已逐字恢复（实验仅本地、未提交） |

无 skip/only/todo、无 env override、无软断言、无源码字符串断言；临时 probe 脚本（`packages/doc-runtime/probe-350-s8.tmp.ts`）已删除。

## Deferred verification

| 项 | 归属 | 说明 |
|---|---|---|
| 根 `pnpm test`（全仓 343+2 文件 / 3615+12 用例） | SA4/SA7 | 本实现只改 doc-runtime 写入口行为；受影响两包全量已跑（769 用例零回归）。全仓运行约 10 分钟，按技能不属 SA3 范围 |
| 真实环境/活链路端到端验收 | SA7 | 本报告的端到端证据为内存 persistence + 诊断内存日志（`namespace-runtime` 测试面） |
| SA6 follow-up：B8 升级为闭口 B 单向断言、S1–S8/NS-1/NS-2 吸收为契约用例 | SA6/SA1 | 设计 §13 残余问题 1；本轮不动断言 |
| SA1 设计面回写：§12.1 S8 fixture 字面不可执行（本报告 Deviations §1） | SA1 | 需设计侧更正/回写，实现与测试已按语义等价构造落地 |
| `set([])` 元素禁令词表化、`ops` 上限/嵌套放宽 | 后续票 | 设计 §13 残余问题 2/4；`MAX_BATCH_OPS` 未导出，放宽需新决策 |

## Deviations or blockers

### 1（唯一偏差，非阻塞，需设计侧回写）S8 fixture 字面构造不可执行 → 语义等价构造替换

**设计字面要求**（§12.1 文件 A S8）：`u: { x?: number } | { label?: string }`，批量
`{set ['u','x']=5, set ['u','label']='L'}`，"两操作各自单独合法"+"`expectEachOpLegalAlone` 前置"。

**实测（probe 逐字输出，`packages/doc-runtime/probe-350-s8.tmp.ts`，已删除；同一 probe 在单操作/批量两路径上观察）**：

```
--- design fixture: u: { x?: number } | { label?: string } ---
single set u.x=5  {"ok":true}
single set u.label=L THROW DOCRT-E204: 写前 internal 不变量破坏（validated map child 缺少结构字段（label））…
batch  x + label    THROW DOCRT-E204: …（同上）
--- alternative fixture: u: { x?: number; label?: number } | { label?: string; x?: string } ---
single set u.x=5  {"ok":true}
single set u.label=L {"ok":true}
batch  x + label    {"ok":false,"issues":[{"message":"联合成员 1/2：类型不匹配：期望 number，实际 string","path":["u","label"]}, {…同…}]}
batch then single ok {"ok":true}
```

**根因**（现有单操作管线行为，非本实现引入）：`u` 为空 Y.Map 时，`walkUnion` 的成员试验对「全可选字段全缺席」**直接接受声明序首成员**（`extract.ts` `trialMember`）；写侧 `mutation-local.ts` union case 的 `navigateLive → resolveNode` 用同一「逻辑值相等」判据仲裁，恒选成员 0（仅声明 `x`），随后 `childNodeOf(member0, 'label')` 抛 `DerivedInvariantError` → E204 fatal。`mutation-local.ts` / `extract.ts` 均为 DENY 路径且本实现未改，故该 fatal 在 HEAD 即可复现（`set ['u','label']` 单操作路径同样 E204）——设计 §12.1 的 S8 前置「两操作各自单独合法」在字面 fixture 下不成立，SA2 §2 的可达性复核遗漏了 commit 导航（`resolveNode` 仲裁）这一步。

**替换（语义等价、构造等价，仅 member 类型声明镜像）**：`u: { x?: number; label?: number } | { label?: string; x?: string }`；**op 内容与设计逐字相同**（`{set ['u','x']=5, set ['u','label']='L'}`）。差异在：两成员都声明 `x`/`label`（保证两操作各自可导航），值类型互斥 ⇒ 单操作时各由不同成员容纳、折迭后 `{x:5,label:'L'}` 无成员可容。仍是非判别联合（无公共非可选字面量字段 → `detectDiscriminator` undefined → any-of 全扫描）+ 封闭对象 + 成员重叠，属设计 §7.5.2 明示的「union 成员 any-of 重叠」构造类。

**不变量保持**：S8 的断言语义逐字未改（`ok:false`、issues ≥1、字节不变、0 事务 0 update、无 fatal、后续单操作仍 `ok:true`）；HEAD 即绿、实现期双向判别（实验 A 下 S8 亦红）性质不变；D1–D7、公共 API、失败语义、frozen surfaces 均不受影响。测试文件内已内联记录该偏差与根因。

**待办**：设计 `wiki/raw/task_issue-350_design.md` §12.1 的 S8 fixture 字面文本需 SA1 回写更正（或由 SA6 下一轮吸收 S8 时按此构造固化）；如需，可将「union 歧义仲裁下非首成员字段不可导航（E204）」记入设计 §2 现状事实。

### 2 无其他偏差/阻塞

- 无 ALLOW 外改动；无 ALLOW 不足；无与红灯契约的矛盾（SA6 19 用例断言零改动且全绿）。
- 未新增稳定码、未改 fatal phase 联合、未动诊断词表/槽机械/emission 调用点、未动复制/wire/META/readData/`replaceSchema`。
- 环境无缺失：`pnpm`/`tsc`/`vitest` 均可用；未使用任何 env override 或 fallback。

## Suggested commit message

```
feat(doc-runtime): ADR 0026 批量原子变更信封（mutateData {ops} 全有或全无）

- mutation.ts：信封双形态互斥分发（自有 ops 键）→ E1 顶层键封闭 / E2 非空 ≤16 /
  E3 逐元素复用单操作解析核 / E4 set([]) 元素禁令 / E5 批内路径互不嵌套（祖先-后代或
  相同；共享边界兄弟路径放行）→ 逐操作 prepare（失败聚合全部 issues、整体零写入）→
  阶段 C 组合期望边界（plan 复跑 + 严格前缀折迭 + 合成 plan 应用；array-* 载荷折入；
  组合无成员可容 → fail-closed 聚合拒绝）→ 单 Yjs 事务按序提交最小 edit → 逐操作
  verifyBoundaryIntact。单操作路径逐字节不变（解析核 prefix 为空串，消息零变化）。
- index.ts：新增 BatchedMutation / MutationEnvelope 公共类型导出（无新值导出）。
- 测试：public-surface-type-guard 登记两类型正例 + 三类编译期负例；新增
  doc-runtime/namespace-runtime 共享边界用例（S1–S8 / NS-1 / NS-2）。
- 验证：SA6 契约 13 红 → 19/19 绿；两包 769 用例零回归；根 pnpm typecheck OK。
- 注（需设计回写）：设计 §12.1 S8 字面 fixture 在现有 union 导航语义下不可执行
  （set ['u','label'] 单操作即 E204），已按语义等价构造替换并留证（SA3 报告 Deviations §1）。
```

（SA3 不执行 commit；上列仅供 Controller 参考。）
