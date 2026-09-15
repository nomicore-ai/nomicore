# SA3 Implementation Report — issue #389：复制来源与订阅终止（变更订阅 T3）

- 任务类型：**feature**（ADR 0030 既有决策的 T3 实现切片；TDD 红→绿）
- Worktree：`/home/wangjian/nomicore-fix-issue-389`（branch `mabf/issue-389`，基线 HEAD `28faeae`
  = #395 T1 tracer 已合并）
- 输入：SA6 验收契约（approve 附 SA1 冻结条件）+ SA1 设计 iteration 1（SA2 approve，F-1 已解决）
  + SA2 iteration-1 批准 + SA8 conflict report（clear，requiresConflictRecheck=true）
- 结果：**红灯契约 C3–C9/CAP/C11 → 全绿**（17/17）；根 typecheck、测试程序 typecheck、runtime
  包 typecheck、runtime+registry 包套件（1080 测试）、全仓 `pnpm test`（4770 测试）全绿；
  4 项 mutation 全部被契约击穿

---

## 1. Inputs consumed

| 输入 | 用途 | 状态 |
|---|---|---|
| `wiki/raw/task_issue-389.md`（Host brief：What-to-build + AC1–AC7） | 需求源 | 在场（issue 评论 **0 条**——dispatch 明示 REST 实读空数组，与 brief/SA6 §2 一致；无 owner 条款） |
| `wiki/raw/task_issue-389_sa6_contract.md` | **红灯契约**：C1–C11 / NC1–NC6 / B-T3-0–B-T3-6 / §12.3 最小输入 / §12.5 断言纪律 / §12.6 红线 | 在场（approve 附 SA1 冻结条件） |
| `wiki/raw/task_issue-389_design.md`（iteration 1） | 实现权威：§5 SA1 冻结裁定（全部 = SA6 默认）、§7-D1–D6、§11 ALLOW/DENY、§12 验收映射 | 在场（SA2 iteration 1 approve） |
| `wiki/raw/task_issue-389_sa2_review.md`（iteration 1） | F-1 MAJOR 落实核对 + N-1–N-5 处置 | 在场（approve，Required revisions = 无） |
| `wiki/raw/task_issue-389_relevant_decisions.md` / `..._conflict_report.md` | SA8 约束面（ADR 0030 §4/§5/§6/§7；ADR 0018；ADR 0010 #133） | 在场（clear） |
| `packages/namespace-runtime/src/{watch-map,runtime,schema-write,replication-session}.ts` | 实现载体（逐点实读，含 S5.5 / R5.6 / 关闭 admission / lease 释放清理） | 实读 |
| `packages/namespace-registry/src/{registry,lease,types,index}.ts`、`schema-rearm.ts` | 零改动主张核对（reset 槽 ⑥ 次序、lease 16 键透传、index 导出面） | 实读（未修改） |
| `artifacts/sa6-issue389-*.log`（15 份探针/基线） | 红灯机理与基线对齐（watch-end 计数恒 0；#387 21/21、#369 33/33） | 实读 |
| 先例 fixture：`issue-387-watch-map-fixture.ts`、`issue-369-window-read-fixture.ts`、`registry-phase5-bootstrap-reset-r2-red.test.ts`、`registry-phase5-replication-session-round2-red.test.ts` | 装置形态、replica stub 持久化、session/import/reset 编排 | 实读 |

**SA1 冻结位对账（实现取值 = 设计冻结值 = SA6 默认，逐条一致）**

| # | 冻结值 | 实现落点 | 结果 |
|---|---|---|---|
| B-T3-0 | 零新增公共成员（lease 16 键 / runtime 15 键 / index 导出面） | 全部新增面为包内模块面（hub 方法、env 字段）；C11 断言 `Object.keys` 16/15 全绿 | ✅ |
| B-T3-1 | 挂点：安装成功后、同槽 `await notifyDirty()` 之前的同步段 | `schema-write.ts` S5.6（S5.5 installed 判定后、S6 前）；`replication-session.ts` R5.7（R5.6 text 块内、R6 前） | ✅ |
| B-T3-2 | peer re-arm **failed** 也发 watch-end | R5.7 在 `text` 变化块内、re-arm 结局与 diag 配对之后（覆盖 applied/failed）；C4b 断言 | ✅ |
| B-T3-3 | reset 关闭 admission 内嵌终止 + 投递结算并入 close 承诺（registry 零改动） | `closeAfterFenceReset`（共享首步 fanout → `terminateAll('doc-replaced')` → barrier.then(await delivered; shutdown)）；C5 免 poll 断言 | ✅ |
| B-T3-4 | 终止项队尾追加（先入队 invalidate-all 照 FIFO 先投）；终止后零通知 | 队尾 push + 摘除集合；CAP/C6/C8 断言 | ✅ |
| B-T3-5 | 终止后重建语义（schema：lease active + 重新 watchMap；doc：released 通道 + 重新 open） | C9/C10 断言 | ✅ |
| B-T3-6 | 滞留 data **必达**（终止不丢已入队 data） | terminated 订阅免于一切清队点（unsubscribe no-op / shutdown 后置 / 溢出只在 data 入队路径）；C8(ii) 断言 | ✅ |
| §15-4 | doc-replaced 的 lease 可观察场景收窄为 reset | C5/C10 仅 reset 场景（import/genesis 排他创建结构性不可达） | ✅ |
| §15-5 | deleteNamespace / lease 释放 / shutdown **不发** watch-end | 正常 close 风味保持静默 shutdown；reason 词表恒两值 | ✅ |

---

## 2. Existing worktree reconciliation

- 起始无 `wiki/raw/task_issue-389_sa3_impl.md`，无未提交实现（`git diff --stat HEAD` 空；SA6 §16 同证）；
  worktree 内未提交内容仅 SA6 证据日志与 Host 输入文档——**全部保留，未改动**。
- SA6 临时探针目录 `packages/namespace-registry/.sa6-389/` 已按其 §16 清理（本实查不存在）。
- 本轮新增：4 个 runtime 源文件改动 + 2 个新契约文件（1 fixture + 1 行为契约）。
- 无过时/冲突实现需删除；既有测试零改动（`git status` 已核对）。

---

## 3. Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/namespace-runtime/src/watch-map.ts` | §7-D1/D2（B-T3-4/B-T3-6） | ① `NamespaceRuntimeWatchHub` + `terminateAll(reason): Promise<void>`（快照迭代 + 队尾追加恰两键 `{kind,reason}` + 摘除集合 + 容量豁免 + 投递结算承诺）；② `WatchSubscription` + `terminated` / `drainResolve`；③ 泵 `finally` 中 `terminated && queue.length === 0` → resolve drain（恰一次）；④ 句柄 `unsubscribe` 首行 `terminated` → 幂等 no-op（**不清队**）；⑤ 头注 T3 交付说明（watch-end 从「T1 非目标」改为已交付） |
| `packages/namespace-runtime/src/runtime.ts` | §7-D5-a/b/c（B-T3-3；F-1） | ① `createWatchHub` 构造位前移至 `schemaWriteEnv` 之前（依赖仅 doc/state）；② `schemaWriteEnv` / `replicationHost` 各捕获同一 `watchHub` 局部量（INV-N14）；③ 关闭 admission 分型：`closeAfterFenceNormal`（fanout 终止 + 静默 `watchHub.shutdown()` + barrier，现状逐字保持）与 `closeAfterFenceReset`（共享首步 fanout 终止 → `terminateAll('doc-replaced')` → `lazyCloseBarrier().then(await delivered; watchHub.shutdown())`，缓存完整 admission 承诺、第二入口早退复用同一实例）；④ `close()` 走正常风味 |
| `packages/namespace-runtime/src/schema-write.ts` | §7-D3（B-T3-1；SA2 N-3） | `SchemaWriteEnv` + `watchHub` 字段（`import type` 包内通道）；S5.5 `sync.kind === 'installed'` 之后、S6 `await notifyDirty()` 之前 `void env.watchHub.terminateAll('schema-changed')`；头注补 S5.6 + 本地无 text 门的不对称注记 |
| `packages/namespace-runtime/src/replication-session.ts` | §7-D4（B-T3-1/B-T3-2） | `RuntimeReplicationHost` + `watchHub` 字段；R5.6 `text` 变化块内（re-arm 结局与 failed-diag 配对之后、R6 `dirtyStart` 之前）`void host.watchHub.terminateAll('schema-changed')` |
| `packages/namespace-registry/test/issue-389-change-subscription-t3-fixture.ts`（新增，631 行） | SA6 §12.4 | 共享 fixture：hub/peer 双 Registry 装配（`createNamespaceRegistryForTesting` + runtimeFactory 保留 runtime 引用）、replica-capable stub 持久化（import/archive/readPersistedReplicationIdentity）、`enableReplication`/`openReplicationSession`/`importReplica` 编排、owned update 捕获、`T3Sink`、微任务预算、reset 种子装置、readData helper 口径 |
| `packages/namespace-registry/test/issue-389-change-subscription-termination-red.test.ts`（新增，594 行 / 17 用例） | SA6 §12.4 | 主契约 C1–C11 + NC3/NC5/NC6 回归锚 + CAP 容量豁免 + 3 条装置自检（前提 oracle） |

**零改动核对**：`schema-rearm.ts`、`registry.ts`、`lease.ts`、`types.ts`、`index.ts`、`ws-replication/**`、
`docs/**`、`CONTEXT.md`、读面/诊断面全部零 diff（`git status --porcelain` 仅上述 6 路径）。

---

## 4. SA2 Finding 落实

| Finding ID | 严重度 | 实现 | 验证 |
|---|---|---|---|
| **F-1** | MAJOR | **已落实**：关闭 admission 的**共享同步首步** `fanout.terminateAll('runtime-close')` 上提至分型之前、两种风味中显式保持；正常风味 = fanout 终止 + 静默 `watchHub.shutdown()`（现状逐字保持，缺一即非现状）；reset 风味 = 同一首步 + watch 终止 + 投递结算 | `runtime-replication-session-round2.test.ts` **25/25**（R2-2 族：close 同步终止 session、conflicted 不降级、终态文案）+ `runtime-phase5-reset-fence-r2.test.ts` **7/7**（T2 双向 same-promise、release 恰一次）→ `artifacts/sa3-issue389-regression-gates.log` |
| N-1 | 非阻断 | 已落实为**实现注记**：reset 风味 barrier reject 时 `.then` 成功臂不执行 → 后置防御性 `watchHub.shutdown()` 跳过（良性）；`.then` 内零抛点，未构造可 reject 的第二承诺链 | 代码注释 + phase5 fence 契约族绿 |
| N-2 | 非阻断 | 机制零改动；`doc-replaced` 语义（所订阅 generation 的终结信号，不以 archive 成败为条件）留 T5 #391 措辞输入 | 无本票动作 |
| N-3 | 非阻断 | 不对称已写入 `schema-write.ts` S5.6 注释（本地无 text 门、peer 有 text 门，两读法均与 ADR 0030 §4 相容）；C3 fixture 使用 **text 实变**信封（V2 = V1 + Task.`note?`），**未**设置同文本零终止断言 | C3 绿 |
| N-4 | 非阻断 | `closeAfterFenceReset` 同步段 `lazyCloseBarrier()` 后立即以完整 admission 承诺覆写缓存；第二入口 `closePromise !== undefined` 早退直接复用同一实例、不重跑风味体 | phase5 T2 `startP === closeP` / `closeP === startP` 双向绿 |
| N-5 | 非阻断（升格「优选落盘」） | **已落盘**：CAP 用例 64 笔快连事务 → 流含 `invalidate-all`（溢出降级语义不变）且 `watch-end` 恒为末条 | CAP 绿（单测连跑 5 次稳定） |

---

## 5. File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/namespace-runtime/src/watch-map.ts` | ALLOW 行 1 | D1/D2 终止原语与订阅状态机 |
| `packages/namespace-runtime/src/runtime.ts` | ALLOW 行 2 | D5-a 构造序、D5-b 关闭 admission 分型、D3/D4 字段接线 |
| `packages/namespace-runtime/src/schema-write.ts` | ALLOW 行 3 | D3 本地 schema 路径挂点（S5.6） |
| `packages/namespace-runtime/src/replication-session.ts` | ALLOW 行 4 | D4 peer re-arm 路径挂点（R5.7） |
| `packages/namespace-registry/test/issue-389-change-subscription-t3-fixture.ts` | ALLOW 行 5 | 契约可执行性（SA6 §12.4 规格） |
| `packages/namespace-registry/test/issue-389-change-subscription-termination-red.test.ts` | ALLOW 行 6 | C1–C11 + NC3/NC5/NC6 红绿验证 |

**DENY LIST 核对（零触碰）**：`registry.ts`/`lease.ts`/`types.ts`/`index.ts`（B-T3-3 机制全在
runtime 侧）、`ws-replication/**`、`docs/**`/`CONTEXT.md`、读面（`read-schema-projection`/`window-read`/
`projection`）、`namespace-diagnostic-log/**`、`schema-rearm.ts`/`p0.ts`/`close.ts`/`write.ts` 既有语义段、
既有测试（#387/#369/phase5/键集守卫等）——全部零 diff。未扩大 ALLOW、未新增公共成员。

---

## 6. Verification

### 6.1 TDD 红→绿（SA6 契约核心）

| # | 命令 | 结果 | 证据 |
|---|---|---|---|
| V1 | **实现前**（`git stash` 暂存 4 个 src 改动 = HEAD 语义）：`NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/namespace-registry/test/issue-389-change-subscription-termination-red.test.ts --typecheck.enabled=false` | **exit 1；10 failed / 7 passed**。红面 = C3 / C4 / C4b / C5 / C10 / C6 / C8 / CAP / C9 / C11：前 8 条停在终止前置屏障（`waitForWatchEnd` 超时 = 通知流中不存在 watch-end），C5 更精确红为 `["data"] ≠ ["data","watch-end"]`；**首因统一 = 终止编排缺席**。绿 = C1/C2（AC1 origin 补锚 + NC3）、NC5、NC6、3 条装置自检（hub/peer/reset 前提 oracle）→ 红灯不来自环境/fixture/入口 | `artifacts/sa3-issue389-red-contract-final.log` |
| V2 | **实现后**（同命令） | **exit 0；17/17 绿**（C1–C11 + NC3/NC5/NC6 + CAP + 装置自检） | `artifacts/sa3-issue389-green-contract.log` |
| V3 | 稳定性复跑：同命令 ×4 全绿；CAP 用例单跑 ×5 全绿 | 无 flake（全微任务驱动、零墙钟、零 sleep） | 会话内实测（V2 日志同构） |

### 6.2 类型与静态检查

| # | 命令 | 结果 | 证据 |
|---|---|---|---|
| V4 | `pnpm typecheck`（14 个 tsconfig） | **exit 0** | `artifacts/sa3-issue389-typecheck.log` |
| V5 | `npx tsc -p tsconfig.typecheck.json --noEmit`（含 `packages/*/test/**/*.ts`——新契约两件在程序内） | **exit 0** | `artifacts/sa3-issue389-test-typecheck.log` |
| V6 | `npx tsc -p packages/namespace-runtime/tsconfig.json --noEmit` | **exit 0** | 会话内实测 |
| V7 | 设计未指定代码生成/`schema:check`（本票零 `domains/*/schema.vfsl` 改动、零生成物） | N/A（不适用，非跳过） | — |

### 6.3 回归门（设计 §12 明列）

| # | 命令 | 结果 | 证据 |
|---|---|---|---|
| V8 | `vitest run issue-387-watch-map-tracer-red + issue-369-window-read-lease-contract-red + runtime-phase5-reset-fence-r2 + runtime-replication-session-round2 --typecheck.enabled=false` | **exit 0；86/86**（21 + 33 + 7 + 25）——NC1/NC2 与 F-1/R2-2 回归锚全绿 | `artifacts/sa3-issue389-regression-gates.log` |
| V9 | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/namespace-runtime packages/namespace-registry --typecheck`（设计 §11「runtime + registry 契约族」） | **exit 0；114 files / 1080 tests 通过，Type Errors no errors** | `artifacts/sa3-issue389-package-tests.log` |
| V10 | `pnpm test`（全仓，额外证据） | **exit 0；4770 tests 通过，Type Errors no errors** | `artifacts/sa3-issue389-full-suite.log` |

### 6.4 Mutation 敏感度（SA6 §9-7 复核）

| # | 注入的错误实现 | 期望红面 | 实测 |
|---|---|---|---|
| M1 | 终止项**绕过队列**同步直调 listener（违反 ADR §4 FIFO） | C8(i) / CAP | **2 failed**（C8 + CAP）→ `artifacts/sa3-issue389-mutation-M1-bypass-queue.log` |
| M2 | `terminateAll` 入队前**清队**（丢弃滞留 data，违反 B-T3-6 必达） | C8(ii) | **1 failed**（C8）→ `artifacts/sa3-issue389-mutation-M2-drop-stranded.log` |
| M3 | 撤销 terminated 退订豁免（force-release 清队，违反 AC3/B-T3-3） | C5 / C10 | **2 failed**（C5 + C10）→ `artifacts/sa3-issue389-mutation-M3-unsub-not-exempt.log` |
| M4 | 本地 schema 路径发错 reason（`doc-replaced` 冒充 `schema-changed`） | C3 reason 逐字 | **1 failed**（C3）→ `artifacts/sa3-issue389-mutation-M4-wrong-reason.log` |

四个变异全部被契约击穿；变异注入全部还原（`grep MUTATION-M` 零命中、`git diff --stat` 与还原前逐字节一致），
还原后 V2 复跑 17/17 绿。

### 6.5 断言纪律自查（SA6 §12.5）

零 `skip/only/todo`、零 `setTimeout`/sleep、零 env override（仅仓内既有 `NODE_OPTIONS=--conditions=nomicore-source`）、
零吞错/软化断言、零源码字符串断言；通知形状逐键 `toStrictEqual`（data 恰三键 / watch-end 恰两键 / 定位符恰两键、
reason 逐字）；静默断言 = 提交后续写 + 微任务双预算 400；`readData` 成功形状经集中化 helper `expectReadDataOkKeys`
（#333/#336/#364 门）；全部断言仅经 lease 公共面（`watchMap/getSchema/getActiveSchema/getStatus/mutateData/
replaceSchema/openReplicationSession` + registry `open/importReplica/resetReplica`），零 runtime 内部/Y.Doc 读数。

---

## 7. Deferred verification

- **SA4/SA7 活链路与最终动态验收**：C1–C11 全量红绿复现、ADR 0010 #133 reset 冻结次序与 ADR 0018 槽语义的
  实现后动态复核（本报告仅承担 SA3 规定范围）。
- **SA8 implementation 复查**：`requiresConflictRecheck = true` 待按 conflict report §8-3 ①–⑦ 对账闭合
  （本实现未越出 ADR 0030/0018 既定义务；零 wire/持久化/诊断/读面改动）。
- **T4 #390 / T5 #391 面**：`invalidate-all` 触发编排（队列溢出注入、父路径删除）与消费方文档
  （watch-end 重建指引、re-arm fatal 态语义、shutdown 静默说明）。本票 CAP 用例只锁「溢出语义不变 +
  终止项恒入队」，未承接溢出注入编排。
- **已知残余（设计 §13 登记，非本票义务）**：R3 本地 S5.5 不可达防御分支不发终止；R4 peer re-arm fatal 后
  重建订阅按旧 tools 判定（T1 建立门冻结行为）；reset armed 后 archive 失败时 `doc-replaced` 已投递而旧字节
  仍在（T5 措辞）。
- V9/V10 为本角色主动补证（设计 §11 亦要求 runtime+registry 契约族通过）；全仓套件结论不改变 SA4/SA7 的
  最终裁决权。

---

## 8. Deviations or blockers

- **无设计偏差、无阻塞。** 设计内部一致且可实施；ALLOW/DENY 边界充分；SA2 F-1 与 N-1–N-5 全部有落点；
  SA8 约束在设计范围内可实现。
- 实现期注记（非偏差）：
  1. `closeAfterFenceReset` 以「`closePromise !== undefined` 早退」落地 SA2 N-5'「第二入口不重跑风味体」，
     同时保持 phase5 T2 的**同一实例**断言（`startP === closeP` / `closeP === startP`）——设计 §7-D5-c 明文要求。
  2. 关闭 admission 分型保留 `lazyCloseBarrier()` 作为唯一 barrier 懒创建入口（barrier 本体/`close.ts` 零改动，
     ADR 0010 #133 冻结次序零破坏）。
  3. 注释标签 `V3c''-pre`（watch hub 构造位前移后的序号标注）；纯注释面，零语义。
  4. 契约文件对 `dataNotifications()` / `watchEnds()` 的 type predicate 使用窄联合（`'local'|'replication'` /
     `'schema-changed'|'doc-replaced'`）以通过 `tsconfig.typecheck.json` 全程序类型检查（V5）。
- 零公共面新增：lease 16 键、runtime 15 键、`index.ts` 导出面、通知三 kind 形状全部不变（C11 断言）。

---

## 9. Suggested commit message

```text
fix(#389): 复制来源补锚与订阅终止编排（变更订阅 T3）

- runtime: watch hub 新增 terminateAll(reason) 终止原语（队尾追加 watch-end +
  注销订阅 + 投递结算承诺；终止项容量豁免、terminated 退订幂等 no-op 不清队）
- runtime: S5.6（本地 replaceSchema）与 R5.7（peer R5.6 re-arm，含 failed 分支）
  在安装成功后的同步段发 {kind:'watch-end',reason:'schema-changed'}
- runtime: reset 关闭 admission 分型——共享首步 fanout.terminateAll('runtime-close')
  逐字保持（R2-2），reset 风味追加 terminateAll('doc-replaced') 且投递结算并入
  close 承诺（registry 零改动；reset 结算即已投递末条）
- test(#389): 新增 T3 契约 fixture + 行为契约 C1–C11 / NC3 / NC5 / NC6 / CAP
  （实现前 10 红 → 实现后 17/17 绿；4 项 mutation 全部击穿）

验证：pnpm typecheck exit 0；tsconfig.typecheck.json exit 0；
runtime+registry 套件 114 files / 1080 tests 绿；全仓 pnpm test 4770 tests 绿；
#387 21/21、#369 33/33、phase5 fence 7/7、replication-session round2 25/25 绿。
```
