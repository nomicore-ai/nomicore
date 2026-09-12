# SA7 动态验证报告 — issue #350 原子变更信封（mutateData 批量 ops，ADR 0026）

| 项 | 值 |
|---|---|
| 任务 | issue #350「原子变更信封：mutateData 批量 ops 多操作全有或全无（ADR 0026，guard 前置）」（Feature；无 owner 评论） |
| 被验证实现 | SA3 落地、SA4 approve、SA8 实现后 clear 的当前工作区（HEAD `211c5fa` + 未提交 diff：`packages/doc-runtime/src/{mutation,index}.ts`、`test/public-surface-type-guard.test-d.ts` 修改，4 个 issue-350 测试文件新增——`git status` 复核与 SA3/SA4 记录逐条一致） |
| 结论 | **approve**——设计声明改变的批量数据流按设计变化运行；声明保持的单操作/槽机械/诊断/复制面保持不变；批量 E201-C 真实偏离/组合失败/E204/E205 错误流符合设计；S8 fixture 调和未改变语义；临时诊断已清理 |

---

## 1. Inputs

| 输入 | 用途 |
|---|---|
| `wiki/raw/task_issue-350.md` | 任务简报（AC1–AC8；无 owner 评论） |
| `wiki/raw/task_issue-350_design.md`（iteration 3） | 批准设计：D1–D7、§7.5.2 阶段 C 组合期望边界、§8.3 数据流路线 1–7、§12.1 S1–S8/NS-1/NS-2、§11 ALLOW/DENY、§14.1 S8 fixture 回写 |
| `wiki/raw/task_issue-350_sa6_contract.md`（approve） | 红灯契约 B1–B8/N1–N4、R1–R7 与验收映射 |
| `wiki/raw/task_issue-350_sa3_impl.md` | 实现报告（含 Deviations §1 S8 fixture 替换、反向实验 A/B） |
| `wiki/raw/task_issue-350_sa4_review.md`（approve） | §11 后续动态验证项 1–4（全仓回归 / 批量 E201-C 真实偏离 / 复制合并冒烟 / 阶段 C 性能）；§12 观察 1（S8 fixture 根因独立复核） |
| `wiki/raw/task_issue-350_conflict_report.md`、`task_issue-350_implementation_conflict_report.md`（均 clear）、`task_issue-350_relevant_decisions.md` | SA8 冻结面 / override / required actions（识别不可改变的协议边界——复制 wire/apply、META、readData、`replaceSchema` 零改动） |
| 实际源码 | `packages/doc-runtime/src/mutation.ts`（全文）、`install-verify.ts`（E201-C/D 抛点）、`fatal.ts`、`packages/namespace-runtime/src/{write,errors}.ts`（只读核对） |
| 测试 | 4 个 issue-350 测试文件 + 本轮新增 2 个 SA7 补充测试文件（§7） |

无缺失输入。SA4 verdict 为 approve（SA7 在其基础上独立验证，未发现下调事由）。

## 2. Runtime environment

| 项 | 值 |
|---|---|
| Host | Linux；node v24.13.0；pnpm 10.28.2 |
| 依赖 | vitest 3.2.7（root `node_modules/.bin/vitest`）；tsx（探针）；yjs **13.6.32**（`packages/doc-runtime/node_modules/yjs`，与 CI `--frozen-lockfile` 同版） |
| 测试入口 | `NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run [--typecheck] <path>`（include `packages/*/test/**/*.test.ts`，`maxWorkers: 1`） |
| 实现状态核验 | `git status --short`：3 M（`doc-runtime/src/index.ts`、`src/mutation.ts`、`test/public-surface-type-guard.test-d.ts`）+ 6 `??` issue-350 测试文件（4 上游 + 2 本轮 SA7）+ wiki 产物；DENY 路径（`namespace-runtime/src/**`、`namespace-diagnostic-log/**`、`mutation-local.ts`、`install-verify.ts`、`packages/vfsl/**` 等）零改动（`git diff` 为空核实） |

## 3. Changed Data Flow Verification（设计声明改变的路线）

| Route | Design change | Runtime driver | Observed hops | Expected result | Actual result | Verdict |
|---|---|---|---|---|---|---|
| 1. 信封接纳（§8.3 路线 1） | `mutateData({ops})` 经公共面 `unknown` 透传；lifecycle 停接纳先于输入访问 | R1/R5/R7（既有契约，本轮全绿复跑）；NS-1 | 公共面 → 队列 → 写槽；close 后 Proxy 零访问、`RUNTIME_WRITE_DISABLED`/`not-accessed`；排队期改 `ops[0].value` → 槽起点快照获胜（99） | 透传零改动、次序不变 | 与契约逐条一致（36/36 绿的组成部分） | ✅ |
| 2. S3 整信封快照（路线 2） | 对整个 `{ops}` 一次受控冻结快照；class/accessor 整体拒绝 | R6（绿锚保持） | snapshotter 数组/对象分支四查；`MUTATION_INPUT_NOT_PLAIN_DATA`、accessor 零执行、零写入 | 保持既有行为 | 一致（全绿） | ✅ |
| 3. 批量分发 + 信封校验 E1–E5（D1/D3） | 自有 `ops` 键 → 批量分支；双形态/空数组/超 16/元素非完整信封/元素 guard/`set([])` 元素/嵌套 = 形状错误零写入无码 | B5（16 接受、空/17 拒）、B6（九类形状矩阵）、B7（兄弟放行 + 祖先-后代/相同拒）、B8（`set([])` 闭口 B）、R4（诊断面 rejected/validation/`code===undefined`） | 拒绝均在任何 prepare 与任何 live 读之前、fail-fast 单 issue、0 事务 0 update、字节不变 | 全部形状错误零写入无码 | 一致（全绿） | ✅ |
| 4. 逐操作 prepare + 聚合（D4） | 任一操作失败 → 聚合**全部**失败操作 issues（按 ops 顺序）、整体零写入 | B3、R2、NS-2 | 两失败夹一合法：issues ≥2、顺序 = ops 序（NS-2 记录面 `issues.items` 路径序 `[['n'],['tasks','t1','status']]`）、字节不变、0 事务 0 update、notifier 0 | 聚合非 fail-fast、零写入 | 一致（全绿） | ✅ |
| 5. 阶段 C 组合期望边界（D5.2，F1 修复核心） | 共享 record/parent/union 边界的兄弟足迹（含 array-\* 载荷）折入 `proposedBoundary`；组合无成员可容 → fail-closed 聚合 | S1–S7（六形态 + S6 包含精度 + S7 array 折迭）、S8（组合失败负向）、NS-1（端到端含 array 元素） | 合法共享边界批量全部 `ok:true`（throw 通道断言到达即证无伪 E201-C）、值全对、1 事务 1 update；S8 `ok:false`、issues ≥1、字节不变、0 事务 0 update、后续单操作仍 ok | 组合不伪触发、不误拒、不空转 | 一致（全绿；探针 P-B 复证镜像 fixture 下两单操作各自 ok、批量聚合拒绝零写入） | ✅ |
| 6. 单事务按序提交（D5 提交半边） | 单 `transactGuarded` 内按序 N 个最小 edit；观察者要么见全部要么不见；最小 edit 不降级 | B1（observed 单态）、B2（跨实体四动词）、B4（700k 兄弟 + update <1000B + 载体身份）、R1；探针 P-A 独立计数 | 恰 1 本地事务、1 update 事件；update 时刻终态全可见（S1 `observed` 恰一态）；批量 update 体量 = 增量 | 单事务单 update、原子可见 | 一致（全绿 + P-A：batch=1 update vs 顺序写=2 updates） | ✅ |
| 7. 逐操作边界验证（D5 验证半边） | 事务后按序 `verifyBoundaryIntact`（期望边界已组合）；**真实**偏离 → E201-C | 本轮新增 TD-0–TD-3（`issue-350-sa7-batch-divergence.test.ts`）+ NF-1（`issue-350-sa7-batch-fatal.test.ts`） | TD-0 无干扰对照 `ok:true`；TD-1 observer 覆写 `t1.status` → throw `DOCRT-E201`（phase=`post-commit-verification`、committed:true）、doc 保持覆写值、delete 足迹不虚假回滚；TD-2 重插已删键 → 事实核「疑似 observer 重插」E201-C；TD-3 向 notes 追加元素 → 重投影核 E201-C（array 足迹折入后验证不空转）；NF-1 端到端 → `RuntimeWriteFatalError`（phase 透传、committed=true）→ 后续 `mutateData` `RUNTIME_WRITE_DISABLED`、readData 照常、notifier 恰一次 | 组合后期望边界只吸收同批足迹；真实偏离仍检出（验证不空转、不漏检） | 一致（5/5 绿；触发机制与既有 `create-initial-document.test.ts` observer 篡改面同款，确定性） | ✅ |
| 8. 诊断 emission（路线 7） | 一次变更尝试 = 一条 record；单事务单条 owned update bytes；聚合 issues 同源进同一 rejected record | R3（对照 3 顺序写 3 条；批量第 4 条 committed/update；重放见全部值）、R4、NS-1（恰 2 条：批量 committed + 后续单操作）、NS-2 | `root-mutation`/`transaction`/committed 单 update；rejected/validation/无码/`issues.policy==='full'` 且顺序 = ops 序 | 一槽一记录、单 update bytes | 一致（全绿） | ✅ |

## 4. Preserved Data Flow Verification（设计声明不变的路线）

| Route | Preserved invariant | Runtime driver | Baseline observation | Current observation | Verdict |
|---|---|---|---|---|---|
| 单操作信封逐字节不变（AC5/冻结面第 1 行） | 无 `ops` 自有键输入走原路径原代码；`未知信封键 "zzz"（操作 set）` 等文案与次序冻结 | N1–N4（四动词/失败单 issue/未知键文案/`set([])` legacy）+ R3 前段 + 全仓回归 | SA6 基线 341 文件 3602 用例绿 | 全仓 `vitest run --typecheck`：**345 文件 / 3629 用例全绿、Type Errors no errors**（13 契约红全翻绿 + 12 新用例，零回归）；受影响两包含本轮新增文件复跑 76 文件 / 774 用例全绿 | ✅ |
| 写槽槽序 S1–S7 / 一槽一尝试 / 不新建槽类型（0008 INV-W2） | `namespace-runtime/src/**` 零改动；批量封闭在 S5 单次调用内 | R5/R6/R7、NS-1 计数（1 update、1 notifier、逐槽一记录） | SA6 R5/R6 绿 | 保持绿；`git diff` 对该包 src 为空 | ✅ |
| 稳定码注册表 / fatal 通道（0026 L42） | 批量无新增稳定码；fatal 仍 E201-C/D、E203、E204（phase 三值）；E205 返回非 throw | R4（`code===undefined`）、既有 fatal 套件（`apply-validated-mutation-fatal-contract`、`sa7-fatal-dynamic-verify` 等）+ TD/NF + 探针 P-D | SA6/SA3 两包 769 用例绿 | 全仓绿；`errors.ts`/`fatal.ts` 零 diff；P-D：批量元素解析期意外 throw → **返回** `ok:false` 单条 `DOCRT-E205` issue、零写入、后续单操作 ok | ✅ |
| 诊断词表与记录形态（0011/0014） | operation `root-mutation`、stage/result 联合、rejected 禁 update、槽外 emission | R3/R4/NS-1/NS-2 | SA6 记录 | 保持（记录字段断言全绿；诊断包零 diff） | ✅ |
| 复制 wire / apply / META / readData / `replaceSchema`（0026 L50–51） | 零改动；批量不经复制 apply 路径 | 全仓复制面测试（ws-replication/replication-protocol/yjs-server 套件）+ 探针 P-A | SA6 基线绿 | 全仓绿；`Y.applyUpdate` 直接消费批量单条 update（无需特判，见 §5 冒烟） | ✅ |
| E201-C 触发语义（0007 #237 §5） | 只对真实提交后偏离触发（批量下伪触发面被组合期望边界消除 = 恢复冻结语义） | S1–S7/NS-1（合法共享边界无 fatal + 写能力保持）对照 TD-1–TD-3/NF-1（真实偏离必 fatal） | 单操作既有语义 | 同一批量仅 observer 干扰这一变量翻转结局（TD-0 对照）——伪触发消除且检出能力保持 | ✅ |
| vfsl 纯函数公共面 | `planMutationBoundary`/`applyMutationAtBoundary` 签名语义零改动 | `packages/vfsl/**` 全部测试 + S7（「apply 不消费 kind」跨包依赖行为锚） | 基线绿 | 全仓绿；vfsl 零 diff | ✅ |

## 5. Replication merge smoke（SA4 §11 项 3；ADR 0026 L50–51 范围外的输入面冒烟）

驱动：临时探针 P-A（同源 state bytes 克隆双写者——真实复制形态：同 origin ⇒ 同 Yjs item identity；批量写者发 1 条单事务 update，顺序写者发 2 条单操作 update；各自 `Y.applyUpdate` 到同基态 replica）。逐字观察（探针输出存档于 §9 命令 6）：

- `batch result {"ok":true}`、`batch update events: 1`；顺序写两操作各 `{"ok":true}`、`sequential update events: 2`（单事务 ⇒ 单 update，与 R3/NS-1 计数一致）。
- `replica(batch-update) ROOT == batch doc ROOT: true`；`replica(seq-updates) ROOT == seq doc ROOT: true`（两类 update 均可被复制 apply 面直接消费、无特判）。
- `MERGE-EQUIVALENT: true`——消费批量单条 update 的 replica 与消费等价顺序写 2 条 update 的 replica 终态逻辑 ROOT 逐值相等（`t1={status:'reviewing',notes:['n0']}`）。
- 顺序 update 逆序应用仍收敛（Yjs 因果合并）；并发形态（base + 顺序写 delete + 批量 update）合并不抛、收敛为 Yjs 元素语义结果。
- array 载荷批量（S7 形态）单条 update 重放：replica `t1 = {status:'open',notes:['n0','n1']}` 与源 doc 一致。

结论：批量单事务 update 作为复制输入与等价顺序写合并等价，无分歧（SA4 §11 失败条件未命中）。

## 6. State Machine / Error and Cleanup Flow

| 场景 | 触发 | 观察到的转换与终态 | 设计符合性 |
|---|---|---|---|
| 批量写槽状态机（S1–S7 槽内视角 §8.2） | 合法批量（NS-1） | 接纳 → 快照 → E1–E5 → P → C → 单事务 → 逐操作验证 → notifyDirty(1) → 槽释放 → 一条 committed record | ✅ 次序与 §8.2 一致 |
| 形状错误终止 | E1–E5 任一 | `ok:false` 单 issue、零写入、0 事务 0 update、rejected/validation record；无部分准备态外泄 | ✅ |
| 操作失败终止 | P 聚合 | `ok:false` 聚合 issues（ops 序）、字节不变、notifier 0、rejected record `issues.policy='full'` | ✅ |
| 组合失败终止 | C fail-closed | `ok:false` issues ≥1、字节不变、0 事务 0 update、无 fatal、**后续单操作仍 ok**（S8 + P-B 探针复证） | ✅ 非死代码、不 throw |
| E205（批量侧意外异常） | 元素 ownKeys trap 投递（P-D） | 返回 `ok:false` 单条 `DOCRT-E205` 前缀 issue、零写入、后续单操作 ok | ✅ 返回值非 throw（F3） |
| E204（既有语义，非本 diff 引入） | 空 `u` 上 `set ['u','label']`（P-B，设计字面 fixture） | 单操作即 throw `DOCRT-E204`（pre-commit-internal、committed:false、零写入）；批量同 | ✅ 与 SA3 Deviations §1/SA4 观察 1 根因链一致 |
| E201-C 真实偏离（批量） | afterTransaction observer 篡改（TD-1/2/3） | throw `DOCRT-E201`（post-commit-verification、committed:true）；doc 保持 observer 留下状态、足迹不虚假回滚；不出现 ok:false 假成功 | ✅ |
| fatal 后生命周期（NF-1） | 端到端批量 E201-C | `RuntimeWriteFatalError` rejection（phase/committed 透传）→ `markWriteFatal` → 后续 `mutateData` `RUNTIME_WRITE_DISABLED`（S1 gate）；**readData 照常**（含篡改值）；committed:true ⇒ best-effort notifier 恰一次 | ✅ 永久禁写、读保留（0008 L85–93） |
| close 停接纳次序 | R5 | close 后批量零入队、Proxy 零访问、字节不变 | ✅ |
| 重试/复活 | 非致命失败后重新发起 | 新尝试新记录；无补偿/回滚路径复活旧状态（NF-1 后写面永久关闭而非静默恢复） | ✅ |

**Cleanup/quiescence**：全部失败形态字节级零写入（B3/S8/R2/NS-2/P-B/P-D 断言 `encodeStateAsUpdate` 不变）；探针与临时产物已删除（§7）；后台全仓作业已回收（exit 0，无遗留进程）。

## 7. Temporary Diagnostics 与新增补充测试

| 类别 | 内容 | 处置 |
|---|---|---|
| 临时探针（已删除） | `packages/doc-runtime/sa7-probe-350.tmp.ts`（tsx 独立脚本：P-A 复制合并冒烟 / P-B S8 fixture 调和 / P-C 阶段 C 性能冒烟 / P-D 批量 E205）。**未改动任何生产/测试代码**，仅 console.log 观察公共入口返回值与 Y.Doc 状态；未使用 `[SA7-DATAFLOW]` 插桩（无代码内日志注入必要——返回值/事件/字节快照已覆盖全部关键跳点） | 已删除；逐字输出存档于本报告 §5/§8/§9（观察记录，不入 artifactPaths） |
| Post-removal 验证 | 删除后复跑 6 个 issue-350 文件 → **36/36 绿、Type Errors no errors**（与探针在场时一致）；`git diff HEAD -- packages/ apps/ domains/ tests/ scripts/` 中 `SA7-DATAFLOW` 计数 = **0**；`ls *.tmp.ts` 零残留 | ✅ |
| 新增补充测试（保留，非临时诊断） | `packages/doc-runtime/test/issue-350-sa7-batch-divergence.test.ts`（TD-0–TD-3，4 用例）与 `packages/namespace-runtime/test/issue-350-sa7-batch-fatal.test.ts`（NF-1，1 用例）——SA4 §11 项 2 落点：批量 E201-C 真实偏离此前**无确定性触发覆盖**（SA6 §15「无可确定性触发点」）；本轮证实 `afterTransaction` observer 篡改即确定性触发（既有 `create-initial-document.test.ts` 同款机制先例），按 Skill「必要的补充测试」与仓内 SA7 先例（`sa7-fatal-dynamic-verify.test.ts`、`runtime-mutate-root-sa7-dynamic.test.ts`）固化为回归锚。纯测试侧新增，生产代码零改动 | 保留（76 文件/774 用例合跑绿；root `pnpm typecheck` 绿） |

## 8. S8 fixture 调和语义确认（dispatch 专项）与性能冒烟

**S8 调和（探针 P-B 逐字）**：设计 iteration 2 字面 fixture `u: { x?: number } | { label?: string }` 下——`single set u.x=5 {"ok":true}`、`single set u.label=L THROW pre-commit-internal/committed=false DOCRT-E204: …validated map child 缺少结构字段（label）`、批量同 throw（E204 在**单操作路径**即命中 ⇒ 「两操作各自单独合法」前置在 HEAD 不成立，证实 SA3 Deviations §1 / SA4 §12 观察 1 / SA8 Required action 1 三源记录）。落地镜像 fixture `u: { x?: number; label?: number } | { label?: string; x?: string }` 下——两单操作各自 `{"ok":true}`；批量 `{"ok":false,"issues":[…联合成员 1/2：类型不匹配…×2]}`、`zero-write: true | updates: 0`、`then single n=2 {"ok":true}`。**结论：调和只换了 fixture 成员声明形态（同构造类：非判别联合 any-of 重叠、同键集全可选），ops 与断言语义逐字保持，组合失败 fail-closed 路径被真实执行且语义未变**——设计 iteration 3 回写与落地测试一致。

**阶段 C 性能冒烟（探针 P-C，SA4 §11 项 4）**：k=16 共享 record 边界批量（16 个 `set tasks` 全折入同一 record 边界）——边界 2 条既有 entries：42.3ms；100 条：269.2ms；500 条：1217.7ms。随边界规模近线性（k² 折迭 × O(boundary) 校验的预期量级），秒级内完成，无病态放大。

## 9. Dynamic Evidence Matrix

| Source | Requirement or risk | Driver | Expected | Actual | Evidence | Result | Suggested routing |
|---|---|---|---|---|---|---|---|
| SA6 | AC1/AC4 批量原子（单事务、观察者原子可见、跨实体） | B1/B2/R1 + S1 observed 断言（复跑） | ok:true、1 事务 1 update、observed 单态 | 一致 | 命令 1/2/7 | ✅ | — |
| SA6 | AC2 失败聚合 + 整体零写入 | B3/R2/NS-2 | issues ≥2 按 ops 序、字节不变、notifier 0 | 一致 | 命令 1/2/7 | ✅ | — |
| SA6 | AC3 形状错误矩阵 + AC3′ `set([])` 封口 | B5/B6/B7/B8/R4 | 无码零写入、闭口 B | 一致 | 命令 1/2 | ✅ | — |
| SA6 | AC6 一尝试一记录/单 update bytes | R3/R4/NS-1 | 恰 1 committed/update record；重放见全部值 | 一致 | 命令 2/7 | ✅ | — |
| SA6 | AC7 端到端透传 + 停接纳次序 | R1/R5/R7 | 公共面零改动语义 | 一致 | 命令 2 | ✅ | — |
| SA6 | AC5 单操作逐字节不变 | N1–N4 + 全仓 | 全绿零回归 | 345 文件/3629 绿 | 命令 3 | ✅ | — |
| SA4 | §11-1 全仓回归（SA3 只跑两包） | 根 `vitest run --typecheck` | 全绿 | 345 文件/3629 用例绿、Type Errors no errors、586.18s（运行窗口先于本轮 2 个补充文件创建；补充文件经命令 2 两包全量合跑 + 命令 4 typecheck 覆盖） | 命令 3/2/4 | ✅ | — |
| SA4 | §11-2 批量 E201-C 真实偏离（observer 干扰） | TD-0–TD-3/NF-1（新增） | 真实偏离 throw E201-C、committed:true、永久禁写；组合不吸收真实偏离 | 全部命中（含 array 载荷位与事实核/重投影核两核各自触发面） | 命令 5/7 | ✅ | 已固化为补充测试 |
| SA4 | §11-3 复制合并冒烟 | 探针 P-A | 批量 update 与等价顺序写合并一致 | MERGE-EQUIVALENT: true（含逆序/并发/array 形态） | 命令 6 | ✅ | — |
| SA4 | §11-4 阶段 C 性能量级 | 探针 P-C | 16 元素共享边界秒级内 | 最大 1217.7ms（500 条边界） | 命令 6 | ✅ | — |
| Design | §7.5.2/引理 4′ 组合失败 fail-closed 可达且不 throw | S8 + 探针 P-B | ok:false 聚合、零写入、无 fatal、写能力保持 | 一致 | 命令 1/6 | ✅ | — |
| Design | §7.6 E205 返回值非 throw（批量侧） | 探针 P-D | ok:false 单条 E205 issue、零写入 | 一致 | 命令 6 | ✅ | — |
| Design/SA3/SA4/SA8 | S8 fixture 调和不改语义（iteration 3 回写核实） | 探针 P-B + 落地 S8 用例 | 字面 fixture 单操作即 E204（前置不可过）；镜像 fixture 语义等价 | 逐字证实 | 命令 6/1 | ✅ | — |
| SA8 | 冻结面（槽序/词表/稳定码/复制面/vfsl） | 全仓 + git diff 核验 | 零扰动 | 全绿、DENY 零 diff | 命令 3/8 | ✅ | — |

额外发现（不扩大验证范围，仅记录）：无。未发现实现与设计/契约的任何运行时分歧。

## 10. Commands and Evidence

| # | 命令 | 结果（关键输出逐字） |
|---|---|---|
| 1 | `NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run <4 个 issue-350 契约/边界文件>` | `Test Files 4 passed (4)`；`Tests 31 passed (31)`；`Type Errors no errors` |
| 2 | `… vitest run packages/doc-runtime/test packages/namespace-runtime/test` | `Test Files 76 passed (76)`；`Tests 774 passed (774)`；`Type Errors no errors`（769 上游用例 + 5 本轮补充） |
| 3 | 根全仓 `… vitest run --typecheck`（bash 后台作业，已回收 exit 0） | `Test Files 345 passed (345)`；`Tests 3629 passed (3629)`；`Type Errors no errors`；Duration 586.18s |
| 4 | `pnpm typecheck`（tsc -p ×14） | exit 0（含两个补充测试文件的编译门） |
| 5 | `… vitest run packages/doc-runtime/test/issue-350-sa7-batch-divergence.test.ts` / `…/issue-350-sa7-batch-fatal.test.ts` | 分别 `4 passed (4)` / `1 passed (1)`、`Type Errors no errors` |
| 6 | `NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/tsx packages/doc-runtime/sa7-probe-350.tmp.ts`（已删除；逐字输出全文存 §5/§8 与本表） | P-A/P-B/P-C/P-D 输出见上文引用；`MERGE-EQUIVALENT: true`；镜像批量 `zero-write: true | updates: 0`；E205 `{"ok":false,"issues":[{"message":"DOCRT-E205: …「element-ownKeys-boom」","path":[]}]}` |
| 7 | Post-removal：删除探针后复跑 6 个 issue-350 文件 | `Test Files 6 passed (6)`；`Tests 36 passed (36)`；`Type Errors no errors` |
| 8 | `git status --short` / `git diff HEAD -- packages/ apps/ domains/ tests/ scripts/ \| grep -c SA7-DATAFLOW` | 变更集 = SA3 的 3 M + 6 测试文件（4 上游 + 2 本轮）+ wiki 产物；计数 `0` |

## 11. Deviations

1. **全仓运行窗口说明（非缺陷）**：命令 3 启动于本轮 2 个补充测试文件创建之前（收集期 27.5s 内完成，文件未入列）；补充文件经命令 2（两包全量 76/774，一次 vitest 进程内与全部同包文件合跑）+ 命令 4（root typecheck）覆盖。三证据合取等价于全量门：全仓其余 13 包零涉及（不导入 doc-runtime 测试面）。
2. **探针构造修正（方法论记录）**：P-A 首版以两个独立物化 doc 作双写者——Yjs item identity 不同致 update 无法跨 doc 应用（replica 停留基态）；修正为「同一 state bytes 克隆双写者」（真实复制形态）后全部等价性成立。该修正只影响探针构造，不涉及被测实现。
3. **新增 2 个补充测试文件**（§7）：SA7 职责内的必要补充（SA4 §11 项 2 落点、Skill 允许、仓内先例），生产代码零改动；已在命令 2/4/5/7 中验证。
4. 无其他偏差；无阻断项；无环境缺失。

## 12. Verdict

**approve**。批量原子性/零写聚合、公共面端到端与停接纳次序、单事务/单条诊断 update、共享边界（含 array 载荷折迭）、真实 E201-C 偏离、复制合并等价、S8 调和语义、E204/E205/E201-C/D/E203 错误域与 fatal 生命周期均经活链路证据与设计一致；声明保持的面（单操作逐字节、槽机械、诊断词表、稳定码、复制/wire、vfsl）零漂移；临时诊断已清理且清理后结果不变。
