# SA4 实现后静态审查 — issue #350 原子变更信封（mutateData 批量 ops，ADR 0026）

| 项 | 值 |
|---|---|
| 被审对象 | SA3 实现后实际 diff：`packages/doc-runtime/src/mutation.ts`（+250/−14）、`src/index.ts`（+2）、`test/public-surface-type-guard.test-d.ts`（+27）、4 个测试文件（SA6 两红灯契约 + 两新增共享边界文件） |
| 审查基线 | HEAD `211c5fa`；worktree `/home/wangjian/nomicore-fix-issue-350`（git status 复核：生产改动恰 3 文件，DENY 路径零 diff） |
| 审查人 | SA4（实现静态审查；不运行测试、不改实现/设计/测试） |
| Verdict | **approve**（无 BLOCKER/MAJOR；MINOR 观察项不阻断，见 §10/§11） |

---

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-350.md`（brief，AC1–AC8，无 owner 评论） | 在位 |
| `wiki/raw/task_issue-350_design.md`（iteration 2，§7.1–§7.9、§12.1 S1–S8/NS-1/NS-2、§11 ALLOW/DENY） | 在位，全文审读 |
| `wiki/raw/task_issue-350_sa2_review.md`（iteration 2，approve；F1–F6 处置记录） | 在位 |
| `wiki/raw/task_issue-350_sa3_impl.md`（SA3 报告，含 Deviations §1） | 在位 |
| `wiki/raw/task_issue-350_sa6_contract.md`（approve；B1–B8/N1–N4、R1–R7 契约） | 在位 |
| `wiki/raw/task_issue-350_conflict_report.md`（SA8 前置门禁 clear + requiresConflictRecheck:true） | 在位 |
| `wiki/raw/task_issue-350_implementation_conflict_report.md`（SA8 实现后复审 clear + false） | 在位 |
| `wiki/raw/task_issue-350_relevant_decisions.md`（ADR 0026/0007/0008/0025/0011/0014/0023 摘录） | 在位 |
| 实际源码 | `mutation.ts` 全文 + git diff 逐行；`mutation-local.ts`、`install-verify.ts`、`validate-patch.ts`（plan/apply/kind 判定/wrapPlan）、`extract.ts`（walkUnion/trialMember）、`write.ts`（S3–S5/R9/D-B/snapshotter）、`vfsl/src/index.ts`（公共导出块）、`vitest.config.ts`、`tsconfig*.json` |
| 测试 | 4 个 issue-350 测试文件全文、`public-surface-guard.test.ts`（值面，零改动）、type-guard diff |

无缺失输入。Owner 评论：无（Host REST 预读确认；SA6/SA2/SA3 报告一致）。

## 2. Verdict

**approve**。实现经逐接缝静态核对忠实落实批准设计（iteration 2）与 SA6/SA8 契约：

- **单操作逐字节不变**（AC5/冻结面第 1 行）：`parseMutation` → `parseMutationCore(input, '')` 委托，全部消息模板以空前缀插值（diff 逐条核对，13 处 failIssue 全部 `${prefix}` 前缀化、空前缀 = 字符级等价）；单操作分支主体代码与 HEAD 相同；`plainObjectOf + Object.hasOwn('ops')` 分发为纯读，无 `ops` 自有键的输入所经分支与现状字符级一致。`{op,…,ops}` 同现输入从 `未知信封键 "ops"` 变为批量分支双形态形状错误——该输入类不在冻结面内（SA8 override 表第 4 行已裁）。
- **E1–E5 信封校验**：次序（顶层键封闭→数组/非空/≤16→逐元素解析核→`set([])` 禁令→两两非嵌套）、消息词表、fail-fast 单 issue、无码、零写入——与设计 §7.3 逐条一致；E5 拒绝域精确「祖先-后代或相同」（`isPrefixOrEqual` 严格段 `===`，共享边界兄弟放行，未扩大）。
- **聚合与零写入**（AC2）：P 循环只收编 `{kind:'fail'}` 领域结果、按 ops 顺序拼接、失败先于事务开启；fatal（DerivedInvariantError/意外异常）穿出至既有 catch → E204/E205，不进聚合——与 §7.4/§7.6 一致。
- **阶段 C 组合期望边界**（F1 修复核心）：`composeBatchVerify` 在全部 prepare 成功后、事务前，plan 纯函数复跑 + 严格前缀谓词 `plan_i.prefix ⊊ path_j` 折迭 + 合成 plan 调用**未改动的** `applyMutationAtBoundary`；只改 `proposedBoundary`，`facts`/`boundaryLive`/`structureNode`/比较器原样；`verifyBoundaryIntact`/`mutation-local.ts`/`install-verify.ts`/`packages/vfsl/**` 零改动（DENY 保持）。组合失败 fail-closed 聚合（可达收口非死代码）。统一谓词下 target/array 天然零匹配（引理 3），ROOT 级 record 边界折迭（prefix `[]`）同机械覆盖（本审查独立推演核实，见 §8）。
- **单事务 + 逐操作验证**（AC1/AC4/AC6）：单 `transactGuarded` 内按序 `commitPrepared`、事务后按序 `verifyBoundaryIntact`；namespace-runtime/诊断包零改动，D-B 首-赋值窗口天然单条 owned update bytes，一槽一记录由槽机械保持。
- **公共类型面**：`BatchedMutation`/`MutationEnvelope` 只经 `src/index.ts` 类型导出（无新值导出，值面守卫原样通过——type-only 导出不进运行时命名空间）；`MAX_BATCH_OPS=16` 包内不导出；type-guard 正例投影 + 三类 `@ts-expect-error` 负例（双形态 TS2353/元素 guard TS2353/非信封 TS2322）登记齐全。
- **测试**：SA6 契约文件断言与 SA6 §12/§13 逐条对上（未被弱化迹象）；两新增文件按 §12.1 规格落地（S1–S8 + 文件内负控 = 10 用例；NS-1/NS-2 = 2 用例），全部行为断言、无 skip/only/todo/源码字符串断言，vitest 默认 glob + typecheck include 均真实覆盖。

唯一实现偏差（S8 fixture 语义等价替换）经本审查对源码独立复核**成立且必要**（§9/§10.1）。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| Issue AC1（全合法批量单事务、观察者原子可见） | `applyValidatedMutation` 批量分支 L102–110；B1（observed 单态断言）/S1–S7/R1 | 落实 |
| Issue AC2（任一失败聚合 + 整体零写入） | `prepareBatchMutation` P 循环 L237–247；B3/R2/NS-2（issues ≥2 按 ops 序、字节不变、0 事务 0 update） | 落实 |
| Issue AC3（形状错误矩阵：双形态/空数组/超 16/元素非完整信封/未知键含 guard/嵌套） | E1 L186–193、E2 L194–204、E3 L205–212（解析核封闭键集天然排 guard）、E4 L213–222、E5 L223–232；B5/B6/B7/R4 | 落实（全部无码 `ok:false` 零写入） |
| Issue AC4（跨实体路径同样原子） | 单 Yjs 事务覆盖整个 doc；B2（四动词跨 Record/集合）/R1/S6 | 落实 |
| Issue AC5（单操作形态逐字节不变） | diff 逐行核对（§2）；N1–N4/R3 前段/R5/R6 负控 + SA3 两包 769 用例零回归证据 | 落实 |
| Issue AC6（一尝试一条记录、单条 update bytes） | namespace-runtime/诊断包零 diff；R3（对照 3 顺序写）/R4/NS-1 重放断言 | 落实 |
| Issue AC7（公共面透传、停接纳次序不变） | `mutateData`/write.ts 零改动；R5（Proxy 零访问）/R7（快照获胜） | 落实 |
| Issue AC8（typecheck + 相关测试） | SA3：两包 769/769 + `tsc -p` ×14 全绿（vitest/typecheck 入口本审查核实真实：include `packages/*/test/**/*.test.ts` + `.test-d.ts` typecheck 块）；全仓 `pnpm test` 列后续动态验证项 | 落实（全仓跑转后续） |
| SA2 F1（组合期望边界） | `composeBatchVerify` L263–308；S1–S7/NS-1 全绿证据 + SA3 反向实验 A（禁折迭 → 11 用例红） | 落实 |
| SA2 F2（共享边界验收零敏感） | 两新增文件落地 | 落实 |
| SA2 F3（E205 返回值非 throw） | 批量各阶段意外异常经 `prepareMutation` 既有 catch L160–170 返回单条 E205 issue；`fatal.ts` 零 diff（phase 联合仍三值） | 落实 |
| SA2 F4（聚合 issues 进记录载荷） | 诊断面零改动 + R9 同源透传；NS-2（`issues.policy==='full'`、items 顺序 = ops 序） | 落实 |
| SA2 F5（array-* 载荷折入共享边界） | `payloadOf` 四分支穷尽（与 mutation-local 各 case 逐字同款）；S7/NS-1 + SA3 反向实验 B（array-insert 载荷置空 → 恰 S7/负控/NS-1 红） | 落实 |
| SA2 F6（组合失败可达、S8 守卫） | 阶段 C 整体校验保留（合成应用失败 → 聚合零写入无 fatal）；S8 落地 | 落实 |
| SA8 required action 1–7 | 1 照抄 0026 ✓；2 `set([])` 封口闭口 B（E4）✓；3 类型经 index.ts + 守卫登记 ✓；4 一条 root-mutation record/聚合同源/槽外 emission ✓；5 单操作回归锚 ✓；6 复制/META/readData 零改动、`MUTATION_INPUT_NOT_PLAIN_DATA` 整体拒绝保持（R6）✓；7 上限 16/guard 禁令冻结（常量不导出）✓ | 落实 |
| Owner 评论 | 无（三方预读一致） | 无义务遗漏 |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| D1 分发判据（`plainObjectOf` + `Object.hasOwn(env,'ops')`；`{ops:undefined}` 入批量分支由 E2 兜底；原型链 `ops` 不入） | `mutation.ts` L126–131 | 与设计逐字一致；经 `mutateData` 的 `{ops:undefined}` 先被 S3 以「键值为 undefined」拒绝（snapshotter 对象分支 `raw === undefined` throw——本审查核对 write.ts copyFrozen），直调面由 E2 兜底 `（实际 undefined）` | — |
| D2 `set([])` 元素 = 形状错误（闭口 B；非 set 空路径元素不特判） | E4 L213–222（消息与设计逐字一致）；非 set 空路径元素落入 `prepareLocalMutation`（`planMutationBoundary` normalizePath/终段规则拒绝）进聚合，零特判 | 一致；B8 decision-neutral 断言在闭口 B 下闭合 | — |
| D3 信封校验 E1–E5（fail-fast 单 issue、无码、S5 槽内位置、次序、消息词表、`MAX_BATCH_OPS=16` 不导出） | L186–232、L63 | 次序/词表/路径语义逐条一致；E1 双形态优先于未知键（`extra.includes('op')` 先判）与设计「若含 op → 双形态」一致；E3 失败保留解析核原 issue path、仅加消息前缀 | — |
| D4 逐操作 prepare 聚合（E 后 P 前一次性 root 检查；只收 `{kind:'fail'}`；fatal 穿出） | L234–247 | 与 §7.4 伪代码逐行对应；`set([])` 禁令 ⇒ 元素结构性只走局部管线 | — |
| D5 阶段 C 组合期望边界（方案 (a)：plan 复跑 + 严格前缀折迭 + 合成 plan + fail-closed；只改期望值；实际侧/比较器零改动） | `composeBatchVerify` L263–308 + `payloadOf`/`isStrictPrefix` L311–327 | 与 §7.5.2 伪代码语义等价（唯一微差：合成失败以 `break` 退出内层后仍执行 `items[i]` 更新——因紧随 `compIssues.length>0` return fail，items 被丢弃，可观察行为零差异）；`planMutationBoundary`/`applyMutationAtBoundary` 签名与返回形状（`PlanResult`/`ApplyBoundaryResult`）经 vfsl 源码核对匹配；合成 plan 只消费 relPath/prefix/node（kind 不参与 apply 分支——validate-patch L923–1009 分支仅按 `mutation.op`，C13 保持） | — |
| D5 提交/验证编排（单 transactGuarded 按序 commit；事务后按序 verify；batch 不走 legacy verify） | `applyValidatedMutation` L102–110 | 一致；`assertOutermostTransactionContext` 保持函数首行 | — |
| D6 namespace-runtime/诊断零改动 | git diff：两包 src 空 | 一致；S5 单次调用承载批量（含阶段 C 在内、事务前）；R9 同源透传 `result.issues`（write.ts L205–208 未动） | — |
| D7 公共类型名目与守卫登记 | `mutation.ts` L54–60、`index.ts` L25–26、type-guard diff | 类型定义与设计 §7.8 逐字一致（含 doc 注释）；`applyValidatedMutation` 参数类型 `ValidatedMutation | unknown` 不动；`mutateData(mutation: unknown)` 不动 | — |
| §7.6 错误域表（形状/操作失败/组合失败均返回无码；fatal 恰 E201-C/D、E203、E204；E205 返回） | L186–247（返回）、L160–170（catch 分类）、`verifyBoundaryIntact`/`transactGuarded` 未改动 | 一致；`errors.ts`/`fatal.ts` 零 diff，无新码 | — |
| 非目标（guard/复制/wire/META/readData/上限放宽/新词表/E5 扩大） | DENY 路径零 diff；E5 拒绝域未扩大（B7 兄弟 anchor + S1–S7 兄弟正例同过） | 一致 | — |

设计明确但实现缺失：未发现。实现必要偏离设计：仅 S8 fixture（§10.1，语义等价、已留证、路由 SA1 回写）。

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| 信封双形态解析/批量编排/组合期望边界/单事务 | doc-runtime（事务所有权，`assertOutermostTransactionContext`） | 全部在 `mutation.ts` 批量分支 | 正确 |
| 槽机械/诊断/接纳门/快照 | namespace-runtime | 零改动 | 正确 |
| 边界规划/重建校验/整边界比较 | vfsl 纯函数 + install-verify 冻结核 | 逐元素复用 + 期望值组合（编排层职责） | 正确（无越界改动） |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| issue #237 局部管线 | `mutation-local.ts` + `install-verify.ts` | 批量 = 逐元素复用同一 prepare + 同一 verify（仅期望值组合） | 一致 | 无第二管线/第二验证器 |
| issues 多条先例 | `validateSubtree` 多 issues | 跨操作聚合、操作内不拆（解析核/prepare 结果整体追加） | 一致 | 0026 L41 演进语义 |
| 契约测试形态 | SA6 两契约文件（fixture/`expectEachOpLegalAlone`/`countLocalTransactions`/setup/`waitAttempts`） | 两新增文件逐款复用同形态（含 namespace-runtime seam 先例 `createNamespaceRuntimeWithSeam` + `real-persistence-scheduler`） | 一致 | 无平行 fixture 机制 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 信封合法性/原子性/期望边界/`ops` 上限 | doc-runtime 解析 + 阶段 C 组合值 + `MAX_BATCH_OPS`（不导出） | 无第二解析器/状态机/镜像 | 低 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| D-B update 订阅（write.ts try/finally 退订，未动） | finally 收口 | 异常路径同退订 | 对称 |
| 无新增资源/句柄/后台任务（阶段 C 为槽内同步纯计算） | — | — | 对称 |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 第二验证器/第二解析器/plan 携带扩展/live 反推期望 | install-verify / parseMutation / LocalPreparedResult / — | 均未出现（备选 H/I/J 未采纳） | 无平行 |

### 文件范围审查

见 §6。

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/doc-runtime/src/mutation.ts`（M） | ALLOW 第 1 行 | D1–D5/D7 全部落点 + 模块头注更新（含 ADR 0026 段） | 在范围内；DENY 接缝零触碰 |
| `packages/doc-runtime/src/index.ts`（M） | ALLOW 第 2 行 | 恰两类型导出 | 在范围内 |
| `packages/doc-runtime/test/public-surface-type-guard.test-d.ts`（M） | ALLOW 第 3 行 | 正例 + 三类编译期负例 | 在范围内；值面守卫未动 |
| `packages/doc-runtime/test/issue-350-batch-envelope-red.test.ts`（??） | ALLOW 第 4 行（仅红转绿） | SA6 契约 B1–B8/N1–N4 | 内容与 SA6 §12/§13 逐条吻合（断言族、anchor、红绿口径）；无弱化迹象 |
| `packages/namespace-runtime/test/issue-350-batch-envelope-red.test.ts`（??） | ALLOW 第 5 行（仅红转绿） | SA6 契约 R1–R7 | 同上 |
| `packages/doc-runtime/test/issue-350-batch-shared-boundary.test.ts`（??新增） | ALLOW 第 6 行 | S1–S8 + 文件内负控（10 用例，与 §12.1 规格一致） | 在范围内 |
| `packages/namespace-runtime/test/issue-350-batch-shared-boundary.test.ts`（??新增） | ALLOW 第 7 行 | NS-1/NS-2（与 §12.1 规格一致；自有 fixture 不动契约文件） | 在范围内 |
| `wiki/raw/*`（??） | Host/上游产物 + 本审查产物 | 证据文书 | 非代码 |

DENY 核对（git diff --stat / status）：`namespace-runtime/src/**`、`namespace-diagnostic-log/**`、`mutation-local.ts`、`install-verify.ts`、`detached-build.ts`、`fatal.ts`、`carrier.ts`、`extract.ts`、`resolve.ts`、`tx-guard.ts`、`packages/vfsl/**`、值面 `public-surface-guard.test.ts`、`docs/**`、`CONTEXT.md`、`.agents/**`、复制/wire/持久面——全部零改动。**无范围越界**。遗留物检查：无 probe/tmp 文件、无 skip/only/todo/console/debugger。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| `applyValidatedMutation` 签名/返回联合 | `runRootWriteSlot`（write.ts L187，唯一生产调用点） | 零改动自然承载：合法批量 ok:true + D-B 单条 update；失败聚合 issues 经 R9 同源透传；throw 仍走 D5 fatal 分类（branded phase 透传） | 低 | — |
| `mutateData(mutation: unknown)` / `MutateDataResult` | 宿主/typed adapter | 零改动；`BatchedMutation` 服务宿主定型（元素 `readonly ValidatedMutation[]` 可经 `PathPatchValue` 组装）；无强制迁移 | 低 | — |
| `{op,…,ops}` 同现输入的拒绝文案变化 | 旧运行区对该输入的观察者 | 从 `未知信封键 "ops"（操作 set）` 变为批量分支双形态形状错误（无码 ok:false 零写入语义不变） | 无（SA8 override 表第 4 行已裁该输入类不在冻结面） | — |
| vfsl `planMutationBoundary`/`applyMutationAtBoundary` 新增消费 | 批量分支（阶段 C） | 既有公共导出（vfsl index.ts L108–114），签名/语义零改动；「apply 不消费 kind」跨包依赖由 S7 行为锚钉住 | 低 | — |
| 复制 apply / wire / readData / replaceSchema | 不经该入口 | 零关联（DENY 覆盖） | 无 | — |
| E201-C 触发面 | 写槽 fatal 处置（markWriteFatal） | 伪触发面消除（组合期望边界）；真实偏离仍 throw E201-C；S8/NS-1 断言写能力保持 | 低 | — |

无遗漏关键 caller（`parseMutation` 无其他调用点——grep 复核；`prepareMutation` 仅 `applyValidatedMutation` 内部调用）。

## 8. 错误、恢复与并发

| 检查 | 结论 |
|---|---|
| 错误吞没/伪装成功 | 无：三类失败均诚实 `ok:false`（形状单 issue/操作聚合/组合聚合）；E205 catch 返回单条前缀 issue（非静默） |
| 部分完成 | 结构性排除：E1–E5、P、C 全部裁决先于 `transactGuarded`（禁 write-then-undo 保持）；B3/S8/NS-2 断言字节不变 + 0 事务 0 update |
| fatal 分类稳定性 | E204（DerivedInvariantError catch，含批量 root 检查 L234–236 与元素 prepare 抛出）、E205（意外异常返回）、E201-C/D（未改动 verify）、E203（未改动 transactGuarded）；phase 联合零变化 |
| 重试/幂等 | 无重试无补偿（与单操作同款）；重复发起 = 新尝试新记录 |
| 并发/TOCTOU | 写序列器 FIFO 独占不变；阶段 C plan 复跑为纯函数（wrapPlan 收编意外 throw 为 issues，零 doc 状态）；prepare 不写；E5 + 引理 1/2 排除足迹重叠与下标位移；同数组多操作被相同路径禁令排除 |
| ROOT 级折迭正确性（本审查独立推演） | 顶层 Record 键 delete（如 `delete ['tasks']`）plan.prefix=`[]`、kind record ⇒ 严格前缀谓词把**全部**非空兄弟路径折入 ROOT 期望边界——恰与重投影核的整 ROOT 比较域匹配，无误报/漏报（与 S2/S3 同机械；SA2 iteration 2 观察 3 判定一致，无专测——见 §11 观察 5） |
| 槽内快照语义 | S3 对整个 `{ops}` 一次快照（snapshotter 数组分支四查 + 对象分支四查，`{ops:null}` 过、`{ops:undefined}` 拒）；R6/R7 锚 |
| close/dispose 竞态 | 无新增生命周期资源；R5 停接纳先于输入访问保持 |

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| doc-runtime 契约 B1–B8/N1–N4 | ok 联合/值落盘/单事务单 update/observed 单态/聚合顺序/最小 edit（载体身份 + <1000B）/16-空-17/九类形状/兄弟 vs 嵌套/B8 双闭口/四动词/文案锚/`set([])` legacy | 根 `pnpm test`（include `packages/*/test/**/*.test.ts`）+ SA3 单文件运行证据 | 无 skip/only/源码断言；anchor 防同义反复；`expectEachOpLegalAlone` 防空转 | — |
| namespace 契约 R1–R7 | 端到端 ok/readData/notifier=1/update=1；聚合 + 零写入；对照 3 顺序写 → 批量第 4 条 committed + owned bytes 重放；形状错误 rejected/validation/无码/digest；R5 Proxy 零访问；R6 非 plain 整体拒；R7 快照获胜 | 同上 | 同上 | — |
| 文件 A S1–S8 + 负控 | 共享边界六形态 + array 折迭（S7）+ 包含精度（S6）+ union 兄弟（S5）+ 组合失败 fail-closed（S8：ok:false/issues ≥1/字节不变/0 事务 0 update/无 throw/后续单操作 ok）+ 单操作等价与确定性负控 | 同上 | 断言全为运行时观察；`ok:true` 到达即证无 fatal（throw 通道）；fixture 含 Record/判别联合/非判别联合（S8 偏差见 §10.1） | — |
| 文件 B NS-1/NS-2 | 端到端三元素含 array 折迭：ok/readData 三值/1 update/1 notifier/写能力保持/恰 2 条记录 + 重放全值；失败批量记录面 issues ≥2 按 ops 序/rejected/validation/无码/无 effect | 同上 | 依赖 memory log `issuesPolicy` 默认 'full'（C15 锚，成立） | — |
| type-guard 新 describe | 两类型导入 + 投影；三类 `@ts-expect-error` 编译期 fail-closed | vitest `--typecheck`（include `.test-d.ts`，tsconfig.typecheck.json 覆盖） | 负例注释标注 TS2353/TS2322；vitest typecheck 实际执行 | — |
| 判别力证据 | SA3 反向实验 A（禁折迭 → S1–S8+负控+NS-1 共 11 红、SA6 契约 19 仍绿）/B（array 载荷置空 → 恰 S7+负控+NS-1 红） | SA3 报告留证（本审查未复跑——SA4 不运行测试） | 实验为 SA3 声明；静态结构支持其可信度（折迭/载荷为 S1–S7/NS-1 断言的唯一支撑路径） | — |

入口真实性：`packages/*/test/**/*.test.ts` 默认收集（vitest.config L15）；`.test-d.ts` 走 typecheck 块（L18–22）；`tsc -p packages/doc-runtime/tsconfig.json` include `test/**/*.ts`。全部真实。

## 10. Required revisions

无 BLOCKER/MAJOR/MINOR 阻断项。

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| 全仓回归（343+4 文件 / 3615+12 用例）——SA3 只跑受影响两包 | Controller → SA7（`pnpm test` 全量） | 全绿、Type Errors no errors | 任一既有文件红（尤其 doc-runtime/namespace-runtime 之外消费 `@nomicore/doc-runtime` 类型面的包） |
| 批量 E201-C 真实偏离路径（observer 干扰）——无确定性触发点，契约未覆盖批量形态 | SA7 动态探针（可选） | 真实偏离 throw E201-C、committed:true、永久禁写 | 组合后期望边界把真实偏离也吸收（验证空转）或偏离漏检 |
| 批量 + 复制合并（跨实例）——ADR 0026 L50–51 范围外，但单事务 update 是复制输入 | SA7 冒烟（可选） | 复制 apply 消费批量 update 与等价顺序写一致 | 合并结果分歧 |
| 阶段 C 性能（k=16、大边界）——B4 只锚小体量 | SA7 量级冒烟（可选） | 16 元素共享 record 边界批量在秒级内 | 病态放大（每 fold 整边界 validateSubtree ×k²） |

## 12. Non-blocking observations

1. **S8 fixture 偏差（唯一实现偏离设计处，已留证、路由明确）**：设计 §12.1 字面 fixture `u: { x?: number } | { label?: string }` 的前置「两操作各自单独合法」在 HEAD 不成立——本审查对源码独立复核确认根因链：空 `u`（Y.Map 无键）上 `walkUnion` 的成员试验对全可选字段全缺席接受声明序首成员（`extract.ts` trialMember「封闭 map 形成员逐字段检查——缺必填置软标记」+ 首个接受者胜），写侧 `resolveNode` 以同一逻辑值等值判据仲裁恒选成员 0，`childNodeOf(member0,'label')` 抛 DerivedInvariantError → E204；该行为属 DENY 路径（`mutation-local.ts`/`extract.ts` 零改动）的既有语义。SA3 以镜像成员 fixture（`{ x?: number; label?: number } | { label?: string; x?: string }`）替换：ops 与断言语义逐字不变、构造类相同（非判别联合 any-of 重叠，`detectDiscriminator` 无公共非可选字面量字段 → any-of 全扫描），测试文件内联记录根因。**待办**：设计 §12.1 文本回写（SA8 实现后复审 Required action 1，路由 SA1/design）——证据文书更正，非规范契约变更。
2. `mutation.ts` L569 的 `未知操作 "${String(op)}"` 分支未加 `${prefix}` 前缀——该分支在 `Object.hasOwn(specs, op)` 前置过滤后结构性不可达（防御死代码），可观察行为零影响；与单操作逐字节不变声明无冲突。可在后续清理票统一处理。
3. `composeBatchVerify` 以 `break` 退出内层折迭后仍执行 `items[i]` 更新（设计伪代码为 `continue outer-for-i` 跳过）——因紧随 return fail，items 被丢弃，语义等价；记录备查。
4. 非 set 空路径元素（如单元素 `{ops:[{op:'delete',path:[]}]}`）的领域失败进聚合路径无专测——设计 §7.2 明示与单操作同款失败、零特判，实现按声明路由（`prepareLocalMutation` → plan 拒绝）；多元素含空路径元素已被 E5 覆盖（`[]` 为一切路径前缀）。低风险，可随 SA6 契约吸收轮补锚。
5. ROOT 级 record 边界折迭（`delete ['tasks']` + 任意兄弟写）无专测——统一严格前缀谓词天然覆盖（本审查 §8 独立推演核实：prefix `[]` 折迭全部兄弟足迹恰匹配整 ROOT 重投影域）；SA2 iteration 2 观察 3 已裁定「与 S2/S3 同机械，不另立用例」。维持不阻断。
6. 直调 `applyValidatedMutation({ops: undefined})` 的 E2 兜底分支无专测——经 `mutateData` 已被 S3 先拒（R6 同族）；设计 §7.1 声明的直调面兜底静态成立（`Array.isArray(undefined)` false → `（实际 undefined）`）。低风险。
7. SA8 前置门禁预告的「设计后冲突复审」产物不在 `wiki/raw/`（`task_issue-350_design_conflict_report.md` 缺失）——SA8 实现后复审已就地裁决并记录为流程缺角（其 Required action 4）；证据链完整（SA2 iteration 2 approve + SA8 实现后 clear），不阻断，后续任务应留存中间门禁产物。

## 13. 结论

实现把 ADR 0026 与批准设计（iteration 2，含 F1–F6 全部修订）逐条落地且封闭性成立：批量能力（分发/E1–E5/聚合/阶段 C 组合/单事务/逐操作验证/公共类型）全部在 `mutation.ts` 批量分支与 `index.ts`/type-guard 登记，DENY 冻结面（单操作逐字节、槽机械、诊断词表、稳定码、fatal 通道、vfsl、复制面）经 git diff 与逐行核对零扰动；验收面（SA6 19 契约用例 + S1–S8/NS-1/NS-2 + 类型守卫）真实入口、行为断言、判别力经 SA3 反向实验与本次静态结构复核支持。唯一偏离（S8 fixture 语义等价替换）经独立源码复核成立且已按 SA8 裁定路由设计回写。无 BLOCKER/MAJOR：**approve**。全仓 `pnpm test` 与活链路验证按分工转后续动态验证（§11）。
