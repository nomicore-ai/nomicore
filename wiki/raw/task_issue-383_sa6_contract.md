# SA6 诊断与验收契约 — issue #383 P3：组合面与 lease 类型（缝 2：runtime + registry）

> 任务类型：**Feature（能力缺口）**——已接受 ADR 0029 的验收缝 2 兑现票，不是 Bug 修复。
> 契约纪律：全部断言锚定**运行时行为**（结果联合、own 键集、条目列表与身份、Y.Doc 值、异常观测）；
> 禁止源码字符串/正则断言代替行为验证；禁止 skip/only/todo、env override、fallback、吞错；
> 期望一律由**独立预言机**（Yjs/native 直数、同一次运行的公共面 oracle）派生，禁止与实际从同一实现路径派生（§12.7）。
> §12.6 结构审计单独标注为「结构性证据」，不得替代行为断言。

## 1. Task type and inputs

| 输入 | 位置 | 用途 |
|---|---|---|
| 任务简报 | `wiki/raw/task_issue-383.md`（What to build + AC1–AC8；评论为空） | 验收面与缝 2 范围 |
| SA8 冲突门禁 | `wiki/raw/task_issue-383_conflict_report.md`（verdict `clear`；R1–R16、F1–F11、A1–A6、`requiresConflictRecheck: true`） | 冻结面/执行义务 |
| SA8 决议摘录 | `wiki/raw/task_issue-383_relevant_decisions.md` | 条款锚点 |
| 规范权威 | `docs/adr/0029-filtered-window-read.md` §1–§8 + 验收缝 2；`docs/adr/0028-window-read.md` §1/§3/§4/§7/§9；`docs/adr/0027-*` §1；`docs/adr/0008` L123/L178–179；`docs/adr/0009` §NamespaceLease；`docs/adr/0024` 决策 6 | 语义与冻结面 |
| 现行词汇表 | `CONTEXT.md`「窗口读」（L61–63）、「过滤窗口」（L65–67） | 语义逐点一致 |
| 前置票产物 | `de2ff55`（#382 缝 1：doc-runtime `where` + `total: number \| undefined`）；`1b639e0`（#381 W1 total 下沉） | 基线 |
| 先例测试 | `packages/namespace-runtime/test/issue-369-window-read-composition-red.test.ts`、`runtime-data-interface.test-d.ts`、`packages/namespace-registry/test/issue-369-window-read-lease-contract-red.test.ts`、`issue-369-window-read-lease-surface.test-d.ts`、`issue-382-lease-where-no-silent-pass.test.ts`、`issue-369-window-read-fixture.ts` | AC8 测试先例 |

**非目标（dispatch 明令）**：本票不设计实现、不 author 任何测试/fixture 到仓内（探针为临时诊断物，收尾已删，§16）；
不修改生产实现；不 commit/push/创建 PR。

## 2. Owner comment mapping

- issue #383 评论 REST 快照为空（`[]`）——**无 Owner 评论、无 override 权威在场**（沿 SA8 §4）。
- SA8 `clear`（implements-existing-decision ×7 + no-conflict ×9；hard-conflict ×0、evolution-required ×0）。
- 因此验收契约的唯一权威 = ADR 0029 + 简报 AC1–AC8 + CONTEXT.md 词条；Any A1–A6 义务按下文契约化，无外部裁决悬置。

## 3. SA8 constraints（契约化）

| SA8 条 | 契约落点 |
|---|---|
| A1 词表纪律（in/范围/OR/NOT/多段 field/深相等一律 v1 外响亮拒绝；不得以「实现方便」扩词表） | §12.1 B-2；§12.3.2 V 组（非法形状矩阵）；§12.7 变异守卫 |
| A2 S3 镜像扩 `where` 且判据与 W1 一致（两出口同步；S3 是镜像非第三权威） | §12.1 B-11；§12.3.5 Z 组（含 S3 两出口）；§12.6 S4 |
| A3 S6 双语义 + 单源纪律（判据键于 W1 `total === undefined`；canonical `n`；✂ 永不装配；组合层零计数/零谓词求值镜像） | §12.1 B-4/B-5/B-6；§12.3.3 T 组；§12.3.6 S 组；§12.6 S2/S3 |
| A4 类型面与公共导出（既有单源别名链 + Equal 锁；`WhereTerm` 具名再导出为**可选**且须走 `src/index.ts` + 公共面守卫） | §12.1 B-14；§12.3.7 Y 组 |
| A5 测试先例与中间态清账（#369 家族 + `runtime-data-interface.test-d` + registry 内部缝先例；#382 条件不变式继续绿；严格缝 1 审计断言不得留作持久测试） | §12.4 M1/M2；§12.5；§12.7 |
| A6 文档对齐（根 `AGENTS.md` lease 窗口签名补注可选 `where`；非阻塞） | §12.4 M5 |
| F1 `readData` options 闭合形状零变化 | §12.3.8 N1（行为）+ Y 组（类型） |
| F2 恒四键 own 键集（无第五键 `total`） | §12.1 B-7；§12.3.4 K1 |
| F3 十四键 runtime 面 / 十五键 lease 面不动 | §12.3.7 L5/L6（既有键集断言保持） |
| F4 失败码族不新增、语义不漂移；where 非法收编 `WINDOW_OPTIONS_INVALID`；停接纳恰四键 | §12.1 B-8；§12.3.2 F 组；§12.3.9 C 组 |
| F5/F6 `where` 与 orderBy v1 词表永不再变 | §12.1 B-2/B-12；§12.3.2 V 组 |
| F7 无 where 路径零回归（total 计数、truncated 精确、✂ 逐字节） | §12.3.1 A 组 |
| F8 ✂ B-8 冻结文法；where 在场永不装配、不呈现过滤槽 | §12.1 B-6；§12.3.3 T/X 组 |
| F9 doc-runtime W1 面零改动（缝 2 落点 = runtime + registry） | §12.6 S1；§12.4 M4 |
| F10 lease released 短路先于透传；lease 层零解释/零校验、raw 直传 | §12.3.7 L2/L3；§12.3.9 C3；§12.6 S6 |
| F11 失败形 own 键集（窗口失败 `{code,ok,path,message}`；停接纳 `{ok,code,path,message}`） | §12.1 B-8；§12.3.2 K2/F5；§12.3.9 C1 |

## 4. Environment and baseline

| 项 | 值 |
|---|---|
| worktree | `/home/wangjian/nomicore-fix-issue-383`（Host 固定 cwd） |
| branch / HEAD | `mabf/issue-383` / `de2ff55571e3d91a3b1bde3a761154c2fade6242`（`de2ff55`：ADR 0029 基线 `8a4fa40` + P1 `1b639e0` + P2 缝 1 `de2ff55` 已入） |
| 工具链 | node v24.13.0；pnpm 10.28.2；vitest 3.2.7；typescript 5.9.3 |
| 依赖 | `pnpm install --frozen-lockfile --offline` → 65 packages / 438ms / exit 0（`node_modules` gitignored，非仓内跟踪物） |
| 测试入口 | `pnpm test` = `NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`；include `packages/*/test/**/*.test.ts`，typecheck include `packages/*/test/**/*.test-d.ts`（`tsconfig.typecheck.json`）；`maxWorkers: 1` |
| 基线（既有家族，实跑） | `doc-runtime/issue-382-where-window-contract-red.test.ts` + `registry/issue-382-lease-where-no-silent-pass.test.ts` + `registry/issue-369-window-read-lease-contract-red.test.ts` + `runtime/issue-369-window-read-composition-red.test.ts` → **4 files / 129 tests 全绿；Type Errors no errors；1.64s；exit 0** |
| 全仓基线（实现前） | `pnpm typecheck` **exit 0**（14 个 tsc 工程）；`pnpm test` 见 §13（探针删除后实跑） |
| 工作树洁净 | `git status --porcelain` 仅 Host 四件（`task_383_dispatch.md`、`task_issue-383.md`、`..._conflict_report.md`、`..._relevant_decisions.md`）+ 本报告；无生产/测试/fixture 改动 |

## 5. Positive reproduction / capability gap（目标契约在 HEAD 处为红）

探针（临时 `.mts`，已删，§16）：自建 schema（`Task = YMap<{title,state,priority}>`）+ `tasks`（t1 claimed(2)/t2 done(9)/t3 claimed(5)/t4 open(7)/t5 claimed(1)）、`taskList`（[claimed(2),done(9),claimed(5)]）、`bigTasks`（2000 条、恰 3 claimed）、`exactTasks`（20 条、恰 5 claimed）、`emptyTasks`；经 `MemoryPersistence` + `createNamespaceRuntimeWithSeam` 构造 runtime，经 `createNamespaceRegistryForTesting` + 同 doc StubPersistence 打开 lease；直接调 W1 `readMapWindowAtPath` 作 oracle。

| # | 最小输入 | HEAD 实测（`/tmp/sa6-383-probe.out`） | 目标（ADR 0029 缝 2） |
|---|---|---|---|
| O1 | W1 直调 `readMapWindowAtPath(doc,['tasks'],{n:5,where:[{field:'state',equals:'claimed'}]})` | `{ok:true, value:[t1,t3,t5], total:undefined, ownKeys:[ok,total,value]}` | （下层能力已在） |
| O1b | W1 直调 `…{n:2,where:[{field:'priority',equals:5}]}` | `{ok:true, value:[t3], total:undefined}` | （同上） |
| **O2** | `runtime.readMap(['tasks'], {n:5, where:[claimed]})`（×3 轮） | `{ok:false, code:'WINDOW_OPTIONS_INVALID', ownKeys:[code,message,ok,path], message:"…where 已在 W1 生效而 lease 组合面接收属缝 2…"}`（三轮逐字节相同） | `ok:true`；`value=[t1,t3,t5]`；`truncated=false`；无 ✂ |
| **O3** | `lease.readMap(['tasks'], {n:5, where:[claimed]})`（×3 轮） | 同 O2（lease 与 runtime 结果一致） | 同 O2（含 lease 透传） |
| **O4** | `runtime.readArray(['taskList'], {n:1, where:[{field:'title',equals:'alpha'}]})` | `{ok:false, code:'WINDOW_OPTIONS_INVALID', …seam 缝 2 message}` | `ok:true`；`value=[{index:0,…}]`；`truncated=true`（kept 1 === n 1） |
| **O5** | `lease.readArray(…同 O4)` | 同 O4 | 同 O4 |
| O8 | `runtime/lease.readMap(['tasks'], {n:2, where: undefined})`（present-undefined ≡ 缺席）与 W1 直调对照 | `runtime/lease`: `{ok:false, code:'WINDOW_OPTIONS_INVALID', message:"…视图不稳定（options 视图在读取期间漂移…）"}`；W1 直调：`{ok:true, value:[t1,t2], total:5}` | `ok:true`；`value=[t1,t2]`；`truncated=true`（kept 2 < total 5）；键集含 `where`（present-undefined）不得被当作漂移 |
| O9 | 规模两轮：`bigTasks`（2000 条/3 claimed）`{n:2,where}`、`{n:5,where}`；`exactTasks`（恰 5 claimed）`{n:5,where}`；W1 直调 `bigTasks {n:2,where}` | runtime 三向均 `{ok:false, WINDOW_OPTIONS_INVALID…}`（两轮一致）；W1 直调 `{ok:true, [b0,b1], total:undefined}` | `{n:2}` → kept 2 === n → `truncated:true`；`{n:5}` → kept 3 < 5 → `false`；`exactTasks {n:5}` → kept 5 === n → `true`（**恰好 n 个匹配也不得回落计数**） |
| O10 | `emptyTasks {n:5, where}` | runtime: `{ok:false, WINDOW_OPTIONS_INVALID…}`；W1: `{ok:true, value:[], total:undefined}` | `ok:true`；`value:[]`；`truncated=false`；无 ✂ |
| O11 | `close()` 后 `runtime.readArray(['taskList'], trapCounting({n:2,where}))` | `{ok:false, code:'RUNTIME_READ_DISABLED', ownKeys:[code,message,ok,path]}`；**optionTouches = 0** | 不变（停接纳不豁免；lifecycle gate 先于 options） |
| O12 | `lease.release()` 后 `lease.readMap/readArray(…where)` | `{ok:false, code:'NAMESPACE_LEASE_RELEASED', ownKeys:[code,message,ok]}`（两方法） | 不变（released 短路先于透传） |

**能力缺口结论（稳定复现，3 轮 × 双面 × 双方法）**：同一 `where` 输入在 W1（doc-runtime）**成功并正确过滤**，
在 runtime 组合层与 registry lease 面**响亮失败** `WINDOW_OPTIONS_INVALID`；调用方在 lease 公共面上
**无法**完成简报点名的「找到所有 `state == 'claimed'` 的 task」并读出截断信号。失败不是环境/fixture/入口问题：
同一进程同一次运行里 W1 直调同参成功（O1）、无 where 路径三面一致成功（§6 N 组）、生命周期/释放路径正常（O11/O12）。

## 6. Negative control（HEAD 全绿；实现后必须保持绿）

| # | 负控 | HEAD 实测 | 作用 |
|---|---|---|---|
| N1 | `runtime.readMap(['tasks'], {n:2})`（无 where） | `{ok:true, value:[t1,t2], ownKeys:[ok,schema,truncated,value], truncated:true, 无 total 键, schema 含 ✂}` | 无 where 精确语义与恒四键基线健康 |
| N2 | `lease.readMap(['tasks'], {n:2})` / `{n:3}` / `lease.readArray(['taskList'], {n:2})` | 与 runtime 逐字段一致（N2 实测 digest 相同） | lease 无 where 面零漂移；fixture 健康 |
| N3 | W1 直调同参 `where`（O1/O1b/O9/O10） | 全 `ok:true` 且过滤正确 | 证明失败由组合层引入，非数据/载体/词表 |
| N4 | 既有 4 文件 129 用例（#369 组合/lease 家族 + #382 lease 不变式 + #382 W1 契约） | 全绿、Type Errors no errors、exit 0 | 回归面健康（A5） |
| N5 | 类型面正向（§12.3.7 Y1，探针实测） | `lease.readMap/runtime.readArray/runtime.readMap` 直传 `{n, where:[…]}`、`as const` 只读数组**编译通过**；`tsc -p tsconfig.typecheck.json` exit 0 | 类型别名链已透传 `where`（缺口不在类型面） |
| N6 | `readData` 无 where 读 + 非法 options 行为（`READ_OPTIONS_INVALID`） | `read.ts` L337–357 封闭形状（仅 depth/maxChildrenPerNode，未知键即拒）在 HEAD 保持 | F1 冻结面 |

## 7. Stability, scale and timing

- **稳定性**：O2/O3 各 3 轮、O9 各 2 轮，结果逐字节一致；无时钟/并发/随机参与（fixture 全确定性；registry 注入 manualClock + 确定性 randomBytes）。
- **规模**：`bigTasks` 2000 条（恰 3 匹配）与 `exactTasks` 20 条（恰 5 匹配）覆盖「装满 / 扫完 / 恰好 n」三边界；无性能门槛断言（ADR 0029 §5 的成本差只在实现纪律，不作行为断言）。
- **时序**：`where` 读不进 sequencer、零订阅、同步返回（`runtime.ts` readArray/readMap 函数体：lifecycle gate → W1 直通 → 组合）；无异步竞态面。探针整套（含 schema ready 轮询）秒级完成；聚焦家族 1.64s。
- **重复性条件**：`NODE_OPTIONS=--conditions=nomicore-source` + vitest alias（源码态）；registry 测试用确定性 clock/randomBytes。

## 8. Capability gap chain（Feature：能力缺口链，非 Bug 根因）

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| 1 症状 | lease/runtime 面合法 `where` 读 → `ok:false, WINDOW_OPTIONS_INVALID`；调用方拿不到过滤窗口 | O2–O5、O8–O10 | 确证（3 轮复现） |
| 2 直接故障点 | 组合入口 fail-closed 分支：`input.total === undefined` → `seamWhereNotImplemented(path)`（响亮失败，缝 1 中间态） | `window-read.ts` L161–168、L432–446；O2–O5 message 与之逐字对应 | 确证 |
| 3 触发条件 | 任何 W1 接受的 `where`（W1 成功结算 `total === undefined`，B-8 单源不变量） | O1/O1b（W1 `total:undefined`）↔ O2（同调 runtime 失败） | 确证 |
| 4 第二独立阻塞点 | S3 `canonicalWindowBudget` options 键集白名单**恰四键**（`n`/`orderBy`/`depth`/`maxChildrenPerNode`）；`where` 键即「键集漂移」→ 出口①重派发 → 出口②接缝终态 | **隔离实验 O8**：`where: undefined` 使 W1 `total` 保持数值（入口分支不触发），S3 仍以「视图不稳定」出口②响亮拒绝 → 证明 S3 白名单是独立于入口分支的第二阻塞点 | 确证 |
| 5 更深根因 | 缝 1 中间态是**有意设计**的待取代态（`window-read.ts` 头注与 L164–167 明言「缝 2 落地时本分支被『truncated 双语义 + ✂ 永不装配 + S3 镜像扩展』整体取代」）——缺口 = ADR 0029 缝 2 未实现，而非缺陷 | ADR 0029 §5/§6；`window-read.ts` L10–18、L161–168；SA8 R16 | 确证 |
| 6 层位正确性 | 类型面已透传 `where`（`lease → runtime → doc-runtime` 单源别名链 + Equal 锁）；W1 已实现过滤与 `total` 双形态 | Y1 探针编译通过；`types.ts` L468–485；`lease.ts` L440–450；`doc-runtime/window.ts` L307–313、L362–474 | 确证 |
| 7 放大因素 | 无（确定性、同步、无并发/时钟/规模依赖）；唯一「放大」是错误码同码不同因（入口分支与 S3 出口②都给 `WINDOW_OPTIONS_INVALID`），需按 message/轨迹区分——见 §12.7 伪绿登记 | O2 vs O8 message | 确证 |
| 8 未证实假设 | 无（修复范围自足：runtime 组合层 S3/S6 + 既有类型/透传链） | — | — |

## 9. Causal experiments（控制变量 / 隔离；全部只读，探针已回滚）

| # | 实验 | 控制变量 | 观察 | 推论 |
|---|---|---|---|---|
| E1 | 同一 options 对象分别喂 W1 与 runtime | 数据/路径/options 全同 | W1 `ok:true` + 正确过滤；runtime `ok:false` | 失败由组合层引入，排除 fixture/数据/词表 |
| E2 | 无 where 三面（W1/runtime/lease）同参 | 仅去掉 `where` | 三面全 `ok:true`、恒四键、`truncated:true`、schema 含 ✂ | 装置健康；缺口键控于 `where` 在场 |
| E3 | `where: undefined`（present-undefined） | W1 视角 ≡ 缺席 → `total` 数值 → 入口分支不触发 | runtime/lease 仍 `WINDOW_OPTIONS_INVALID`，message = 「视图不稳定」出口② | **隔离 S3 白名单**：即使入口分支不存在，S3 也会拒绝 `where` 键 → 缝 2 必须两处同改 |
| E4 | `where` 项挂 throwing `get` trap（descriptor 诚实） | 只换 term 实现 | runtime/lease 均零外抛、`getCalls === 0`；当前失败在入口分支（W1 本已接受该视图） | 零 `[[Get]]` 纪律成立；缝 2 后此类「合法但带陷阱」视图必须**成功**（Z1 红证据） |
| E5 | `close()` 后带 `where` 读 + trapCounting options | 只换 lifecycle | `RUNTIME_READ_DISABLED`（四键）；optionTouches = 0 | S1 gate 先于 options；停接纳覆盖与 where 无关 |
| E6 | `release()` 后带 `where` 读 | 只换 lease 状态 | `NAMESPACE_LEASE_RELEASED`（三键）；lease 层零 options 触达 | released 短路先于透传（F10） |
| E7 | 类型探针：12 条 `@ts-expect-error` 负例 + 2 条命名导出负例 | 编译期 | `tsc -p tsconfig.typecheck.json` **exit 0**（全部指令命中 = 全部真报错）；同面 `{by:'key', field:'x'}`、`equals: NaN`、`where: []` **不报错** | `where` 类型面已 fail-closed；「by/dir 词表混用」须区分跨面（编译期）与同面同现（运行时） |

## 10. Impact surface

| 面 | 现状 | 缝 2 预期 |
|---|---|---|
| `packages/namespace-runtime/src/window-read.ts` | 入口 fail-closed + S3 四键白名单 + S6 `kept < total` | 唯一实现落点：取代入口分支、S3 白名单扩 `where`（判据镜像 W1）、S6 双语义 + ✂ 有 where 不装配 |
| `packages/namespace-runtime/src/runtime.ts` | S1 gate + W1 直通 + 组合调用；`total` 直通 | 行为零改动（注释同步可选）；十四键面不动 |
| `packages/namespace-registry/src/lease.ts` / `types.ts` | released 短路 + raw 直传；单源别名 + Equal 锁 | **零改动**（透传即代理语义；`where` 经既有通道） |
| `packages/doc-runtime/src/**` | W1 已交付 `where`/`total` 双形态 | **零改动**（F9；若需动 W1 须回门禁） |
| 公共导出面（三包 `src/index.ts`） | `where` 经类型别名链已在；`WhereTerm` 未具名再导出 | 零值导出变化；可选具名再导出须走 index + 守卫记账 |
| 测试 | #369/#382 家族全绿；#382 条件不变式耐久 | 新增 #383 组合面 + lease 面 + 类型面契约测试；既有文件零改红 |
| 文档 | 根 `AGENTS.md` 签名句未含 `where` | A6 补注（非阻塞） |

## 11. Ruled-out hypotheses

| 假设 | 反证 | 结论 |
|---|---|---|
| H1「W1 不支持 `where`」 | O1/O1b/O9/O10：W1 直调成功且过滤正确、`total:undefined` | 排除 |
| H2「fixture/数据/载体问题」 | E2 无 where 三面全绿；E1 同对象 W1 成功 | 排除 |
| H3「lease 层解释/校验 options 导致失败」 | `lease.ts` L309–316 raw 直传；O12 released 短路；E6 零 options 触达 | 排除 |
| H4「类型面挡住 `where`（编译红）」 | Y1 正向探针编译通过（exit 0） | 排除 |
| H5「close/释放后 where 绕开停接纳」 | O11/O12：稳定码 + 四键失败形 | 排除 |
| H6「where 被静默忽略（未过滤成功面）」 | O2–O5 全 `ok:false`；另 #382 条件不变式耐久测试在 HEAD 绿 | 排除（且为缝 2 后必须保持的防线） |
| H7「不确定性/竞态/时序」 | 3 轮 × 双面逐字节一致；零订阅零并发面 | 排除 |
| H8「S3 白名单已接受 `where`」 | E3/O8：`where: undefined` 走 S3 仍出口②拒绝 | 排除（第二阻塞点确证） |
| H9「需要新增第四个读方法或第五键才能表达」 | ADR 0029 §1 + 备选节明文否决；O1 W1 三键已够 | 排除（契约 B-7/F2） |

## 12. Acceptance contract and test paths

### 12.1 绑定表与不变量（实现期不得漂移）

| 绑定 | 值 | 来源 |
|---|---|---|
| B-1 缝 2 入口 | `runtime.readArray/readMap(path, options)`（第二参必填、无重载）与 `lease.readArray/readMap(path, options)`（released 短路先于透传；raw 引用直传） | ADR 0029 §1；ADR 0028 §1；F10 |
| B-2 `where` 词表 v1 | `readonly WhereTerm[]`；`WhereTerm = { field: string（单段字面键，点号不拆分）, equals: string \| number \| boolean \| null（number 须 Number.isFinite）}`；合取；空数组非法；≤16；同 field 重复合法；形状永不再变 | ADR 0029 §2 |
| B-3 管线序 | **where（候选筛选）→ orderBy（匹配集总序）→ n（前缀）**；过滤权威只在 W1；组合层零筛选、零排序、零重算 | ADR 0029 §4/§8 |
| B-4 where 在场判据（单源） | `W1 结算 total === undefined` ⟺ 已应用 where（B-8 单源不变量）；**禁止重读 options 判定**；组合层不重滤、不重排 | SA8 A3/R2；`window-read.ts` L161–167 |
| B-5 `truncated` 双语义 | 无 where：`truncated === kept < total`（total = 标识计数，精确）；有 where：`truncated === (kept === canonical.n)`（`kept === n` → true，即使匹配恰 n；`kept < n` → false）；`kept = value.length`；n = S3 canonical `n` | ADR 0029 §5 |
| B-6 ✂ 装配 | 无 where：按 `truncated ∧ schema ≠ null` 照旧装配（既有快照逐字节不变）；有 where：**永不装配**、不呈现过滤槽；`schema` 通道 = 元素口径投影文本（where 不影响） | ADR 0029 §5；ADR 0027 §1 |
| B-7 成功 own 键集 | 恰 `{ok, value, schema, truncated}`；恒四键（无 `total`、无第五键） | ADR 0028 §7；ADR 0029 §1/备选 |
| B-8 失败面 | 三稳定码 `WINDOW_TARGET_ABSENT`/`WINDOW_CARRIER_MISMATCH`/`WINDOW_OPTIONS_INVALID` + `PATH_NOT_ALLOWED` 透传；窗口失败 own 键集恰 `{code, ok, path, message}`；停接纳 `{ok, code, path, message}`；lease released `{ok, code, message}` | ADR 0028 §7；ADR 0008 L123；ADR 0009 |
| B-9 schema 锚链 | 数组面 `[...path, 0]`（无回退）；键面 `[...path, '<key>']` → `[...path]` 容器口径；皆不可解析 → `null`（非读失败）；where 不改变锚链与预算轴 | ADR 0028 §4/§9；`window-read.ts` L337–349 |
| B-10 条目身份 | `{index, value}` / `{key, value}`；index = 原容器位置（过滤后不重编号）、key = 原键；`[...path, entry.index\|entry.key]` 深读 ≡ `entry.value`（同预算） | ADR 0028 §3/§4；ADR 0029 §4 |
| B-11 S3 镜像（非第三权威） | options 键集白名单**恰五键** `{n, orderBy, depth, maxChildrenPerNode, where}`；`where` 判据与 W1 `validateWhere/validateWhereTerm` 一致：数组形态、length 为 data 属性且非负整数、非空、≤16、逐下标 descriptor（空洞非法）、零 accessor、plain 原型链（Object.prototype/null）、元素恰 `field`/`equals` 两键、field 为 string、equals 标量闭集（finite number）；全程零 `[[Get]]`、trap 异常收编；判据不一致 → 出口①重派发（失败成员原样透传）/ 出口②接缝终态 `WINDOW_OPTIONS_INVALID`；**两出口对 where 判据同步** | ADR 0029 §6；SA8 A2；E3/E4 |
| B-12 present-undefined | 顶层已知轴 `where: undefined`（own key、值 undefined）≡ 缺席（W-3 纪律）：入口/镜像不得当作键集漂移；WhereTerm 内部恰两键**不豁免** present-undefined | ADR 0029 §2；W1 `validateWindowOptions` L322；#382 契约 V20 |
| B-13 v1 词表外 | in/范围/OR/NOT/多段 field/容器深相等一律响亮拒绝（运行时 `WINDOW_OPTIONS_INVALID`、编译期 fail-closed） | ADR 0029 §2；CONTEXT.md _Avoid_ |
| B-14 类型面 | 既有单源别名链 + Equal 锁不动；`where` 类型收/拒边界见 §12.3.7 Y 组；`WhereTerm` 具名再导出为**可选**（须走各包 `src/index.ts` + public-surface 守卫记账） | SA8 A4；模块 AGENTS |
| B-15 冻结范围 | `readData` options `{depth?, maxChildrenPerNode?}` 零变化；无第四读方法；十四键 runtime / 十五键 lease 面不动；doc-runtime 零改动；组合层零计数函数、零谓词求值镜像 | ADR 0029 §1/§8；F1/F3/F9 |

### 12.2 Issue AC ↔ 验收面映射

| AC（简报 L21–28） | 验收面 | 用例组 |
|---|---|---|
| AC1 无 where 结算与 ADR 0028 快照逐字节一致（total 计数、`truncated = kept < total`、✂ 按 truncated） | 行为（保持绿 + 变异守卫） | §12.3.1 A1–A6 |
| AC2 有 where：`truncated === (kept === n)`；✂ 永不装配、无过滤槽；schema 仍元素口径 | 行为（HEAD 红 → 目标绿） | §12.3.3 T1–T14、§12.3.4 X1–X8 |
| AC3 恒四键 own 键集；条目身份随行可拼下一轮路径 | 行为（HEAD 红 → 目标绿） | §12.3.5 K1–K5 |
| AC4 组合式 depth 等价锚：过滤入选项 ≡ 同预算 readData(项路径) | 行为（HEAD 红 → 目标绿） | §12.3.6 D1–D5 |
| AC5 S3 两出口对 where 判据同步；敌意 where 组合层零外抛 | 行为（红证据 Z1/Z2 + 不变式 Z3–Z11） | §12.3.2 Z1–Z11 |
| AC6 registry lease 类型 fail-closed + 透传组合面 | 行为 + 编译期（HEAD 预绿守卫） | §12.3.7 L1–L6、Y1–Y6 |
| AC7 close 后带 where 读 → `RUNTIME_READ_DISABLED`（四键失败形） | 行为（保持绿） | §12.3.8 C1–C5 |
| AC8 缝 2 测试先例 + 全仓 typecheck/测试绿 | 测试路径 + 门 | §12.4、§12.5、§14 |

### 12.3 Fixture 与用例组

**Fixture FIX-383-A（推荐新建 `packages/namespace-registry/test/issue-383-filtered-window-fixture.ts`，非测试文件；断言全部可判定、零随机）**：

```
type Task = YMap<{ title: YLeaf<string>; state: YLeaf<string>; priority: YLeaf<number>; payload: YLeaf<number>; flag: YLeaf<boolean>; count: YLeaf<number> }>;
type ROOT = YMap<{
  tasks       : Record<string, Task>;   // t1{claimed,2} t2{done,9} t3{claimed,5} t4{open,7} t5{claimed,1}
  taskList    : Task[];                 // [claimed(2), done(9), claimed(5)]（位置序）
  exactTasks  : Record<string, Task>;   // 20 条、恰 5 条 claimed（装满判定边界：n=5）
  bigTasks    : Record<string, Task>;   // 2000 条、恰 3 条 claimed（规模 + 扫完/装满双边界）
  emptyTasks  : Record<string, Task>;   // {}
  scalarList  : YLeaf<number>[];        // [1,2,3]（数组面标量元素安静不匹配）
  edge        : Record<string, Task>;   // e0{state:'',flag:false,count:0} e1{state:'x',flag:true,count:1}
  nullState   : Record<string, Task>;   // n1{state:null} n2{}（field 缺席）
  dirty       : Record<string, Task>;   // d1{claimed} d2{state 缺席} d3{state:NaN} d4{state:{x:1}} d5=Y.Map{}（元素非可下钻）
  poisonScored: Record<string, Task>;   // 2000 条：1998 条 done + payload NaN，仅 2 条 claimed（未匹配项埋毒）
  badHit      : Record<string, Task>;   // h1{claimed, payload:NaN}（命中项埋毒 → 物化 fail-fast）
  rawHidden   : YMap（schema 外 raw 键容器）; // 键面窗口可读但 schema 锚不可解析（X5 schema:null 反证）
}>;
```

记号：`…claimed` = `where:[{field:'state',equals:'claimed'}]`；`t1(2)` = key `t1`、`priority` 值 2。
若复用 #369 共享 fixture：只许**纯加法**（既有键/数据零变），且 #369 家族零改红；推荐新建以保零漂移。

**schema 无关说明**：`dirty`/`nullState`/`badHit`/`poisonScored` 的若干记录含 schema 声明域外的值
（`state:null`、`state:NaN`、`state:{x:1}`、Y.Map 元素、`payload:NaN`）——读是 schema 无关的（ADR 0029 §7），
这些值只用于安静不匹配 / 闭集边界 / fail-fast 断言；**schema 通道断言只在 in-schema 且无域外值的路径上做**
（`tasks`/`taskList`/`exactTasks`/`emptyTasks`/`scalarList`/`edge`）。

#### 12.3.1 A 组 — AC1 无 where 零漂移（HEAD 绿 → 目标仍绿）

| # | 最小输入 | 可观察断言 |
|---|---|---|
| A1 | `lease.readMap(['tasks'], {n:2})` | `ok:true`；own 键集恰 `{ok,schema,truncated,value}`（集中化 helper）；`value` keys `['t1','t2']`；`truncated === true`（kept 2 < 独立预言机 total 5）；`schema` **逐字节** = 元素口径正文（oracle：同路径同预算覆盖全量读的正文） + `\n\n` + `✂ 截断事实：\n- tasks · 窗口 · 基 key asc · kept 2/total 5` + `\n` |
| A2 | `lease.readMap(['tasks'], {n:5})` | `ok:true`；keys `t1..t5`；`truncated === false`；`schema` 无 `✂` 且 = 元素口径正文（`Task` 块，字节锚） |
| A3 | `lease.readArray(['taskList'], {n:1, orderBy:{by:'index',dir:'desc'}, depth:1})` | value index `[2]`（位置序自尾取窗）；`truncated === true`（kept 1 < 独立预言机 total 2）；`schema` **逐字节** = 元素口径正文（oracle：`readData(['taskList',0],{depth:1})` 正文） + `\n\n` + `✂ 截断事实：\n- taskList · 窗口 · 基 index desc · kept 1/total 2` + `\n` |
| A4 | 空容器：`lease.readMap(['emptyTasks'],{n:2})`；`lease.readArray(['scalarList'],{n:2})` | 均 `ok:true`、`value:[]`、`truncated:false`、无 ✂ |
| A5 | `lease.readMap(['tasks'],{n:2})` / `{n:5}` / `{n:3,orderBy:{field:'priority',dir:'desc'}}` 与同参 `runtime.*` | `toStrictEqual`（透传/组合一致） |
| A6 | 既有家族零改红 | `issue-369-window-read-lease-contract-red.test.ts`（33 用例）与 `issue-369-window-read-composition-red.test.ts`（17 用例）保持绿（含既有 ✂ 字节锚、A5 身份回环、T1–T3 边界） |

#### 12.3.2 Z 组 — AC5 敌意 where 与 S3 两出口（红证据 Z1/Z2；其余为预绿守卫）

| # | 最小输入 | 目标断言 | HEAD |
|---|---|---|---|
| Z1 | `where` 项 = throwing `get` trap 代理（descriptor 诚实：`field:'state'`, `equals:'claimed'`），经 runtime 与 lease | `ok:true`；条目恰匹配；`getCalls === 0`（零 `[[Get]]`） | **红**（当前入口分支拒；缝 2 后须成功） |
| Z2 | `where` **数组** = throwing `get` trap 代理（`length` 与索引 descriptor 诚实） | 同 Z1 | **红** |
| Z3 | where 元素为 own accessor（getter 计数并对 `'claimed'` 返回） | `ok:false`、码 `WINDOW_OPTIONS_INVALID`、accessor 计数 `=== 0` | 绿（伪绿登记：W1 权威拒） |
| Z4 | where 项含未知键 `{field,equals,extra:1}` / `{field,equals,extra:undefined}` | 同 Z3 码 | 绿（伪绿） |
| Z5 | where 项/数组挂抛错 `getOwnPropertyDescriptor` / `ownKeys` / `getPrototypeOf` trap | 同 Z3 码、零外抛 | 绿（伪绿） |
| Z6 | where 非数组（`'claimed'`/`{}`/`null`/`42`/`Y.Array`）；数组空洞；空数组；17 项；`equals:NaN/±Infinity/{}/[]/symbol/function`；非 plain 原型项 | 全部 `ok:false` + `WINDOW_OPTIONS_INVALID` + 零外抛 | 绿（伪绿） |
| Z7 | 状态化 options Proxy：视图①（W1）= 合法 `where`；视图②（S3）= 违规 `where`（元素 accessor）；视图③（重派发 W1）= 仍违规 | 出口①：`ok:false` + `WINDOW_OPTIONS_INVALID`（W1 失败成员原样透传）+ 四键失败形 + 零外抛 | 绿（伪绿） |
| Z8 | 同 Z7 但视图③ = 合法（交替视图） | 出口②：接缝终态 `ok:false` + `WINDOW_OPTIONS_INVALID`（**不得** `ok:true` 静默通过） | 绿（伪绿；缝 2 后为镜像判据的变异守卫） |
| Z9 | where 恰 16 项（distinct 字段，全不匹配） | `ok:true`、`value:[]`、`truncated:false`（反向边界：不是「见 where 即拒」） | **红**（HEAD 拒） |
| Z10 | 同 field 重复项 `[{state,claimed},{state,claimed}]` | `ok:true`、matches 恰 claimed 集合 | **红** |
| Z11 | `where` 元素 `equals` 取 falsy 闭集：`''` → `field:'state'`（e0）；`false` → `field:'flag'`（e0）；`0` → `field:'count'`（e0）；`null` → `field:'state'`（n1 命中；n2 field 缺席**不**匹配） | `ok:true` 且命中各恰 e0 / e0 / e0 / n1（防 truthiness 校验与真值匹配变异；闭集含 falsy 标量） | **红** |

#### 12.3.3 T 组 — AC2 `truncated` 双语义（HEAD 红 → 目标绿）

统一不变量：**有 where 时 `truncated === (value.length === n)`**；无 where 时 `truncated === (value.length < 独立预言机 total)`。

| # | 最小输入 | 目标断言 |
|---|---|---|
| T1 | `runtime.readMap(['tasks'], {n:5, …claimed})` | `ok:true`；keys `[t1,t3,t5]`；`value.length 3 < n 5` → `truncated === false` |
| T2 | 同 T1 `{n:3}` | kept 3 === n 3 → `truncated === true`（**匹配恰 3 也不得回落计数**） |
| T3 | 同 T1 `{n:2}` | kept 2 === n → `true` |
| T4 | `exactTasks {n:5, …claimed}`（恰 5 匹配） | kept 5 === n → `true`（计数型实现必红） |
| T5 | `bigTasks {n:5, …claimed}`（2000 条/3 匹配） | kept 3 < 5 → `false`（扫完了） |
| T6 | `bigTasks {n:3, …claimed}` | kept 3 === n → `true` |
| T7 | `scalarList {n:5, …claimed}`（标量元素全安静不匹配） | `ok:true`；`value:[]`；`0 === 5` 假 → `false` |
| T8 | `emptyTasks {n:5, …claimed}` | `ok:true`；`value:[]`；`false` |
| T9 | `taskList {n:1, …claimed}`；`{n:2}`；`{n:3}` | index `[0]` tr true；`[0,2]` tr true；`[0,2]` tr false（2 < 3） |
| T10 | `runtime.readMap(['tasks'], {n:2, where: undefined})`（present-undefined ≡ 缺席，B-12） | `ok:true`；`value` 未过滤前 2 条；`truncated === true`（2 < 5，走**无 where 精确语义**）；`schema` 含 ✂ |
| T11 | lease 面镜像 T1–T5、T9（`lease.readMap/readArray` 同参） | 与 runtime 同参结果 `toStrictEqual` |
| T12 | 管线序：`tasks {n:2, …claimed, orderBy:{field:'priority',dir:'desc'}}`；`{…dir:'asc'}`；`taskList {n:1, …claimed, orderBy:{by:'index',dir:'desc'}}` | desc → `[t3(5),t1(2)]`；asc → `[t5(1),t1(2)]`；数组 desc → index `[2]`（「先取 n 再过滤」/「排序后过滤」变异必红） |
| T13 | `dirty {n:5, …claimed}` | `ok:true`；恰 `d1`；`truncated:false`（1 < 5）；安静不匹配不挤掉正常项、不炸读 |
| T14 | 无 where 同场对照：`tasks {n:2}` | `truncated === true`（2 < 5）——与 T3 同 kept 不同语义，双语义对照锚 |

#### 12.3.4 X 组 — AC2 ✂ 永不装配 + schema 通道（HEAD 红 → 目标绿）

| # | 最小输入 | 目标断言 |
|---|---|---|
| X1 | `runtime.readMap(['tasks'], {n:2, …claimed})`（truncated=true）与对照 `readMap(['tasks'],{n:5})`（无 where、total 覆盖） | 二者 `schema` **字节相等**（元素口径正文）；where 结果 `schema` 不含 `✂ 截断事实：` |
| X2 | `{n:2, …claimed, depth:1, maxChildrenPerNode:1}` 与对照 `{n:5, depth:1, maxChildrenPerNode:1}` | `schema` 字节相等（canonical 预算两轴在 where 在场时仍被完整消费） |
| X3 | `taskList {n:1, …claimed, depth:1}` 与对照 `{n:2, depth:1}` | `schema` 字节相等；无 ✂ |
| X4 | `scalarList {n:5, …claimed}` | `schema` 非 null（元素口径 `number` 正文）；无 ✂ |
| X5 | 敌意/错误锚：where + 路径**偏离 schema**（fixture 内 schema 外 raw 键容器 `['rawHidden']`） | `schema === null`（锚失败非读失败），四键仍然、`truncated` 语义照 B-5 |
| X6 | 无 where 截断对照：`tasks {n:2}` | `schema` 必含 ✂ 且与既有 #369 字节锚一致（F8 冻结：有 where 不装配 ≠ 无 where 不装配） |
| X7 | `dirty`/`badHit` 之外的 where 成功面对照：`schema` 内不得出现 `where` / `过滤` 文本槽 | 以 X1/X2/X3 的字节相等为主断言；附加 `schema.includes('✂') === false` |
| X8 | lease 面镜像 X1/X3 | 与 runtime 同参 `toStrictEqual` |

#### 12.3.5 K 组 — AC3 恒四键 + 身份随行（HEAD 红 → 目标绿）

| # | 最小输入 | 目标断言 |
|---|---|---|
| K1 | T1/T9 的 where 成功面（runtime + lease） | own 键集恰 `{ok, value, schema, truncated}`（顺序无关）；`'total' in result === false`；无第五键 |
| K2 | where 非法输入（Z6 任一） | 失败 own 键集恰 `{code, ok, path, message}`；无 `value/schema/truncated` |
| K3 | 过滤窗口每条目：`runtime.readData([...path, entry.index])`（数组面）/ `[...path, entry.key]`（键面），同预算 | 与 `entry.value` `toStrictEqual`（组合式深度等价锚 AC4 的逐条目形态） |
| K4 | 数组面 `taskList {n:2, …claimed}` | 条目 index = **原容器位置** `[0,2]`（不重编号）；`[...['taskList'],2]` 深读命中第三项 |
| K5 | 键面 `tasks {n:5, …claimed, orderBy:{field:'priority',dir:'desc'}}` | keys `[t3,t1,t5]`（匹配集总序）；身份拼路径可回读 |

#### 12.3.6 D 组 — AC4 组合式 depth 等价锚（HEAD 红 → 目标绿）

| # | 最小输入 | 目标断言（oracle = 同一次运行的公共面 `readData(项路径, 同预算)`） |
|---|---|---|
| D1 | `runtime.readMap(['tasks'], {n:5, …claimed, depth:1, maxChildrenPerNode:2})` | 每条目 `value` ≡ `readData(['tasks', key], {depth:1, maxChildrenPerNode:2}).value` |
| D2 | `runtime.readArray(['taskList'], {n:2, …claimed, depth:1})` | 每条目 ≡ `readData(['taskList', index], {depth:1}).value`（含未匹配项零物化：只对入选项断言） |
| D3 | `lease.readMap/readArray` 镜像 D1/D2（`lease.readData` 为 oracle） | 同上 |
| D4 | `depth:0` 与 `maxChildrenPerNode:0` 组合（where 在场） | 入选项折叠壳与同预算 `readData` 一致 |
| D5 | `poisonScored {n:2, …claimed, depth:1}`（未匹配项内埋 `payload:NaN`） | `ok:true`、命中恰 2 条、条目值 ≡ 同预算 readData；**组合层零重物化/零重过滤**（若组合层重走未匹配项将得 `PATH_NOT_ALLOWED` → 必红） |

#### 12.3.7 L 组 — AC6 registry 透传与类型面

| # | 断言 | HEAD |
|---|---|---|
| L1 | `lease.readMap/readArray` where 成功面与同 doc 直调 `runtime` 同参结果 `toStrictEqual`（含 `value/schema/truncated/ok`） | **红**（两侧同码失败；成功面待实现） |
| L2 | released 后 `lease.readMap/readArray(…where)` → `{ok:false, code:'NAMESPACE_LEASE_RELEASED'}`、own 键集恰 `{code,message,ok}`、trapCounting options 触达 `=== 0`（released 短路先于透传，F10） | 绿 |
| L3 | lease 零解释：options 顶层 own accessor `where`（getter 计数）→ `WINDOW_OPTIONS_INVALID` 且计数 `=== 0`；lease 不读 options | 绿（伪绿登记） |
| L4 | `lease` 公共面键集恰十五键（无第十六键/无新方法）；`runtime` 恰十四键 | 绿（`registry-open.test.ts`、`runtime-close-lifecycle.test.ts` 既有断言保持） |
| L5 | `readData` 冻结：`runtime.readData(['tasks'], {where:[…]} as never)` → `ok:false, code:'READ_OPTIONS_INVALID'`；`readData(path,{depth:1})` 行为不变 | 绿（F1） |
| L6 | 公共值导出面零新增（三包 `src/index.ts` 值导出键集不变）；`WhereTerm` 具名再导出**可选**（若加：`src/index.ts` + 守卫记账），未加不构成 AC 违约 | 绿 |

**Y 组（编译期，`vitest --typecheck` 采集 `.test-d.ts`；HEAD 预绿守卫）**：

| # | 断言 | HEAD |
|---|---|---|
| Y1 | 正向：`runtime.readArray/readMap`、`lease.readArray/readMap` 直传 `{n, where:[{field:'state',equals:'claimed'}]}` 与 `as const` 只读数组编译通过；options/results 单源别名 `Equal` 锁不变 | 绿（探针 exit 0） |
| Y2 | 负向（`@ts-expect-error` 必须真报错）：`where` 非数组；项未知键；`equals` 为对象/数组/`undefined`；`equals` 缺失；`field` 缺失；跨面 orderBy（`readArray` + `by:'key'`；`readArray` + `field`；`readMap` + `by:'index'`）；`dir:'up'`；`readData` 带 `where` | 绿（14 条指令全命中） |
| Y3 | **不得**写成编译期负例（否则 TS2578 伪红）：同面 `{by:'key', field:'x'}`（联合 excess 不报错 → 运行时 `WINDOW_OPTIONS_INVALID`）、`equals: NaN`、`where: []` | 注册项（探针实证） |
| Y4 | 成功成员 `keyof` 恰 `'ok'\|'value'\|'schema'\|'truncated'`；lease 结果别名 = runtime 联合 \| released issue（既有 Equal 锁保持） | 绿 |
| Y5 | `WhereTerm` 具名导入：当前自 `namespace-runtime` / `namespace-registry` 公共面**不可导入**（TS2694）；是否补齐见 L6 | 绿（当前事实） |
| Y6 | 无新增失败码类型；`WindowFailureCode` 恰四枚；`RuntimeReadDisabledResult` 恰四键 | 绿 |

#### 12.3.8 C 组 — AC7 生命周期覆盖（HEAD 绿 → 目标仍绿）

| # | 最小输入 | 断言 |
|---|---|---|
| C1 | `close()` 已结算后 `runtime.readArray/readMap(path, {n, where})` | `ok:false`；`code === 'RUNTIME_READ_DISABLED'`；own 键集恰 `{ok,code,path,message}`；`path` = 实参副本 |
| C2 | `close()` 返回前（closing 期）同款读 | 同 C1（同步进 closing 即停接纳） |
| C3 | trapCounting options（`{n:2, where}`）在 closing/closed 读 | 触达计数 `=== 0`（lifecycle gate 先于 options，E5） |
| C4 | `lease.release()` 后 where 读 | `NAMESPACE_LEASE_RELEASED`（三键）；与 C1 各自就位（lease 先短路，不落到 runtime） |
| C5 | 无 where 同款生命周期读 | 与既有行为逐字节一致（负控） |

#### 12.3.9 F 组 — 失败码与冻结面（保持绿）

| # | 最小输入 | 断言 | HEAD |
|---|---|---|---|
| F1 | `runtime.readMap(['nope'], {n:1, …claimed})`；`readMap(['tasks','x','y'], …)` | `WINDOW_TARGET_ABSENT`（合法 where 不吸收缺席；不得先报 options 错） | **红**（HEAD 得 WINDOW_OPTIONS_INVALID） |
| F2 | `runtime.readArray(['tasks'], {n:1, …claimed})`（数组面收 Y.Map）；`readMap(['taskList'], …)` | `WINDOW_CARRIER_MISMATCH`（载体码优先于过滤） | **红**（同上） |
| F3 | Z6 全矩阵 | `WINDOW_OPTIONS_INVALID` | 绿（伪绿） |
| F4 | `badHit {n:2, …claimed, depth:1}`（命中项 `payload:NaN` 物化失败） | `PATH_NOT_ALLOWED` 透传、path 精确到项、无半窗 | **红**（HEAD options 面先拒） |
| F5 | F1/F2/F4 与 Z6 的失败成员 | own 键集恰 `{code,ok,path,message}`、`message` 非空、无 `value`/`schema`/`truncated` | 绿 |
| F6 | 无 where 的 F1/F2/F4 变体 | 同码（回归锚） | 绿 |
| F7 | W1 三码互异、各就各位（同调用位置恰对应码） | 无新增码、无语义漂移 | 绿 |

#### 12.3.10 S 组 — 单源纪律变异守卫（红证据 S1；S2/S3 为强守卫）

| # | 最小输入 | 目标断言 | HEAD |
|---|---|---|---|
| S1 | 状态化 options Proxy：视图①（W1）合法 `where` + `n:2`；视图②（S3）呈现**合法但无 where** 的视图（`{n:2}`）；无重派发（视图②结构合法） | 结果仍按 **W1 已应用过滤** 结算：`ok:true`；`value` = 过滤后前 2（`[t1,t3]`）；`truncated === true`（kept 2 === canonical n 2）；`schema` 无 ✂。**「重读 options 判定 where 在场」的实现会得 `truncated:false` 且静默** → 必红 | **红**（HEAD 入口分支拒） |
| S2 | `exactTasks {n:5, …claimed}` | `truncated === true`（匹配恰 n 不得计成 false）——与 T4 同锚，反「计数后比较」 | **红** |
| S3 | `poisonScored {n:2, …claimed}` | `ok:true`、命中 2 条（组合层零重物化/零重过滤；重走未匹配项即 `PATH_NOT_ALLOWED`） | **红** |

> S1 的判据文本来源 = SA8 A3「where 在场判据键于 W1 结算单源（`total === undefined`），不重读 options」；
> 若实现选择把该视图漂移判为「不稳定」而拒绝，将与 A3 文本不符——见 §15-O4。

### 12.4 迁移契约（本票自身引起的既有测试/类型面变更）

| # | 位置 | 动作 |
|---|---|---|
| M1 | `packages/namespace-registry/test/issue-382-lease-where-no-silent-pass.test.ts` | **零改动、必须继续绿**：条件不变式（`ok:true` ⟹ 条目全满足谓词；`ok:false` ⟹ 码 `WINDOW_OPTIONS_INVALID`）在缝 2 态由成功分支承载；不得退役、不得改写为严格断言 |
| M2 | 全仓检索缝 1 严格审计断言（「缝 1 期间 lease where 必须 ok:false」形态） | **不得留作持久测试**；HEAD 已无此类持久文件（§12.5 P5 核查），实现期新增测试一律用 §12.3 目标形态 |
| M3 | `packages/namespace-runtime/src/window-read.ts` 头注/`seamWhereNotImplemented` 注释 | 实现期同步（注释非契约；`seamWhereNotImplemented` 分支整体取代） |
| M4 | `packages/doc-runtime/**` | **零 diff**（F9）；若实现需动 W1（`window.ts`/`read.ts`）→ 先回 SA8 门禁复核，不得就地扩权限 |
| M5 | 根 `AGENTS.md`「Typed Namespace writes」lease 窗口读签名句 | A6 补注可选 `where` 键（非阻塞、无测试义务） |
| M6 | 公共面守卫测试（`runtime-acceptance-exports-audit.test.ts`、`registry-surface.test.ts`、`doc-runtime/public-surface-guard.test.ts`） | 零键集变化则零改动；若新增 `WhereTerm` 具名再导出 → 同步记账 |
| M7 | `issue-369-window-read-lease-contract-red.test.ts`、`issue-369-window-read-composition-red.test.ts`、`issue-369-window-read-lease-surface.test-d.ts`、`issue-382-where-window-contract-red.test.ts` | **零改动、零改红**（无 where 期望与 W1 期望均不因缝 2 变化） |

### 12.5 测试路径与红线（本轮**未创建**；dispatch 明令 SA6 不 author 测试/fixture；供实现票落地）

| # | 路径 | 内容 |
|---|---|---|
| P1 | `packages/namespace-runtime/test/issue-383-window-where-composition-red.test.ts`（新建） | §12.3 用例组（runtime 组合面：A/T/X/K/D/Z/S/F/C）+ §6 N 组负控；沿 #369 组合家族风格：公共面行为断言 + 独立预言机 + 字节锚 + 负控 |
| P2 | `packages/namespace-registry/test/issue-383-lease-where-contract-red.test.ts`（新建） | L 组 + runtime 镜像对（T11/L1 形态）；沿 #369 lease 家族风格 |
| P3 | `packages/namespace-registry/test/issue-383-filtered-window-fixture.ts`（新建，非测试文件） | FIX-383-A（§12.3）；镜像 `issue-369-window-read-fixture.ts` 构造纪律（MemoryPersistence + StubPersistence 同 doc + 确定性 clock/randomBytes） |
| P4 | `packages/namespace-runtime/test/issue-383-window-where-type-guard.test-d.ts`（新建；或零改红地扩展 `runtime-data-interface.test-d.ts`） | Y1/Y2/Y3/Y6（runtime 面 + 跨面导入） |
| P5 | `packages/namespace-registry/test/issue-383-lease-where-type-guard.test-d.ts`（新建） | Y1/Y4/Y5（lease 面 + 别名 Equal 锁） |
| P6 | 既有文件（§12.4 M1/M7） | 零改动 |

**红线**：不得用 skip/only/todo/env override/fallback/吞错/软化断言；不得以源码字符串断言替代行为断言；
不得把 §12.3.2/§12.3.9 中标注「伪绿」的用例声称为红证据（§12.7/§12.8 登记）；不得为通过断言而为生产实现开口子（反向）。

### 12.6 结构契约（结构性证据，不得替代行为断言）

| # | 审计 | 期望 |
|---|---|---|
| S1 | `git diff --stat -- packages/doc-runtime/src` | 空（F9；`read.ts` 与 `window.ts` 均零 diff） |
| S2 | 组合层职责 | `window-read.ts` 仍是唯一组合点；零新增计数函数、零 `where` 谓词求值镜像、零导航/载体分类镜像、零新模块/订阅/缓存（ADR 0029 §8） |
| S3 | 单源分支 | 入口 `seamWhereNotImplemented` 分支被整体取代；在场判据键于 `total === undefined`；无 `total ?? 0`、无 `as number`、无 `kept < undefined` 静默路径；canonical `n` 参与 `kept === n` |
| S4 | S3 镜像判据一致性 | `canonicalWindowBudget` 键集白名单恰五键；`where` 判据逐条对应 W1 `validateWhere`/`validateWhereTerm`（数组/长度/空洞/accessor/原型/恰两键/field/equals-finite）；两出口（重派发 / 终态）对 `where` 同样可达 |
| S5 | 冻结面 | runtime 恰十四键、lease 恰十五键；三包 `src/index.ts` 值导出键集不变；`WindowFailureCode` 恰四枚 |
| S6 | registry 零解释 | `lease.ts`/`types.ts` 零 diff（released 短路 + raw 直传 + 单源 alias + Equal 锁），除非 L6 选择具名再导出（须同 PR 守卫记账） |

### 12.7 敏感度与反伪绿防线

| 变异（实现后植入即应被击穿） | 击穿用例 | 依据 |
|---|---|---|
| 保留入口 fail-closed（缝 1 中间态） | T/Z9/Z10/Z11/K/D/X/L1/S1 全红 | SA8 A3 |
| 接受 `where` 但忽略（静默未过滤） | T1/T2/T13（条目集）+ #382 条件不变式 | ADR 0029 §4/§5 |
| 计数匹配后比较（`matches === n` → false） | T4/S2 | ADR 0029 §5 装满判定 |
| `truncated` 回落 `kept < undefined → false` | T2/T3/S1 | B-5 |
| 有 where 时装配 ✂ / 呈现过滤槽 | X1–X3/X6 | ADR 0029 §5 |
| 有 where 时 schema 变 null 或改变锚链 | X1–X4 | ADR 0029 §7 |
| 组合层重读 options 判 where 在场 | S1 | SA8 A3 |
| 组合层重物化/重过滤未匹配项 | D5/S3 | ADR 0029 §3/§8 |
| S3 只放行键名、不镜像 `where` 判据 | Z7/Z8（漂移视图必须响亮失败，禁 `ok:true`） | ADR 0029 §6；SA8 A2 |
| 镜像 `where` 判据走 `[[Get]]`/执行 accessor | Z1/Z2（合法性）与 Z3（零执行计数） | ADR 0029 §6 |
| present-undefined `where` 被当键集漂移 | T10 | W-3 纪律；#382 V20 |
| 过滤后重编号（数组 index 变过滤序号） | K4 | ADR 0028 §3/§4 |
| lease 面加第五键 `total` 或新方法 | K1/L4 | ADR 0029 §1/备选 |
| `where` 渗入 readData options | L5 | ADR 0024/0027；F1 |
| 词表外形态被静默接受（in/范围/OR/深相等） | Z6/Y2 | ADR 0029 §2 A1 |
| 期望与实际同源派生（伪绿） | 纪律：期望由独立预言机（Yjs/native 直数、同运行公共面 oracle、字节锚常量）派生 | #381/#382 §12.8 先例 |
| 以 skip/only/todo/env override/fallback/吞错软化 | 纪律：禁止 | 诊断与契约 skill |

### 12.8 Red/green 判定

- **HEAD 红（能力缺口；目标实现后绿）**：
  - **T 组**（T1–T14）、**X 组**（X1–X5、X7、X8）、**K 组**（K1–K5）、**D 组**（D1–D5）、
    **Z1/Z2/Z9/Z10/Z11**、**L1**、**S1/S2/S3**、**F1/F2/F4**（合法 where 下预期非 options 码）。
  - 红因统一 = 「缝 2 未实现」（入口 fail-closed + S3 四键白名单），实证 §5 O2–O10；不是环境/fixture/入口问题（§6 N 组同场全绿）。
- **HEAD 绿且实现后必须保持绿（部分成为变异守卫）**：A 组、C 组、F3/F5/F6/F7、N 组、L2–L6、Y1–Y6、
  Z3–Z8（**伪绿登记**：HEAD 同码不同因——W1 权威/接缝先拒；其价值在实现后充当镜像判据与漂移守卫，不充当红证据）、X6（无 where ✂ 字节锚）。
- **类型面**：Y1–Y6 在 HEAD 即绿（单源别名链已透传 `where`）——本票类型面义务是**锁边界**而非造红；
  Y2 的 `@ts-expect-error` 必须真命中（否则 TS2578 伪红），Y3 明令不得写成编译期负例。
- **全仓门（AC8）**：目标实现后 `pnpm typecheck` 与 `pnpm test` exit 0；实现前基线见 §13。

---

## 13. Red/green evidence

| 证据 | 命令/位置 | 结果 |
|---|---|---|
| HEAD 能力缺口（双面 × 双方法 × 3 轮） | 临时探针 `packages/namespace-registry/test/__sa6_383_probe.mts`（tsx；输出 `/tmp/sa6-383-probe.out`；已删 §16） | O2/O3：runtime 与 lease 同码 `{ok:false, WINDOW_OPTIONS_INVALID}`（message = 缝 2 中间态）；3 轮逐字节一致 |
| W1 下层能力（oracle） | 同探针 O1/O1b/O9/O10 | W1 直调同参全 `ok:true` 且过滤正确（`[t1,t3,t5]`/`[t3]`/`[b0,b1]`/`[]`）、`total:undefined` |
| S3 白名单独立阻塞（隔离实验） | 同探针 O8（`where: undefined`） | W1 `ok:true, total:5`；runtime/lease `{ok:false, WINDOW_OPTIONS_INVALID, message:"…视图不稳定…"}`（出口②） |
| 规模/重复性 | 同探针 O9（2000 条 ×2 轮） | 两轮一致；W1 命中 `[b0,b1]` |
| 生命周期/释放 | 同探针 O11/O12 | `RUNTIME_READ_DISABLED`（四键，optionTouches=0）；`NAMESPACE_LEASE_RELEASED`（三键） |
| 敌意 where 零外抛/零 `[[Get]]` | 同探针 O7 | 无外抛；`getCalls === 0` |
| 类型面边界（正向 + 负向） | 临时 `__sa6_383_type_probe.ts` + `npx tsc -p tsconfig.typecheck.json --noEmit`（输出 `/tmp/sa6-383-typecheck-probe*.out`；已删） | 首轮：仅 `{by:'key', field:'x'}` 的 `@ts-expect-error` 未命中（TS2578）→ 修正为运行时注册项后 **exit 0**（14 条编译期负例全真报错、正向全通过） |
| 既有家族基线（实跑） | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run <4 文件>` | **4 passed / 129 tests / Type Errors no errors / 1.64s / exit 0** |
| 全仓基线（实现前） | `pnpm typecheck` | **exit 0**（14 个 tsc 工程；输出 `/tmp/sa6-383-typecheck.out`） |
| 全仓基线（实现前） | `pnpm test` | **396 files / 4827 tests 全绿；Type Errors no errors；609.01s；exit 0**（探针删除后实跑；输出 `/tmp/sa6-383-test.out`） |
| 冻结面 | `git status --porcelain`；`git diff --stat` | 仅 Host 四件 + 本报告；生产/测试/fixture 零改动 |
| 目标绿面 | §12.3 全组 + §12.4 迁移 + 全仓门 | 待实现票执行（本票不实现） |

## 14. Runner trigger evidence

| 运行器入口 | 命令 | 实测 |
|---|---|---|
| 聚焦（本 ticket 家族） | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/doc-runtime/test/issue-382-where-window-contract-red.test.ts packages/namespace-registry/test/issue-382-lease-where-no-silent-pass.test.ts packages/namespace-registry/test/issue-369-window-read-lease-contract-red.test.ts packages/namespace-runtime/test/issue-369-window-read-composition-red.test.ts` | 4 文件 / 129 用例绿；`Type Errors no errors`；1.64s（exit 0） |
| 类型段 | `npx tsc -p tsconfig.typecheck.json --noEmit`（探针在场） | exit 0（14 条 `@ts-expect-error` 全命中） |
| 全仓门（AC8 基线） | `pnpm typecheck`；`pnpm test` | `pnpm typecheck` exit 0（`/tmp/sa6-383-typecheck.out`）；`pnpm test` = **396 files / 4827 tests / Type Errors no errors / 609.01s / exit 0**（`/tmp/sa6-383-test.out`；探针删除后实跑） |
| 采集规则 | `vitest.config.ts` include `packages/*/test/**/*.test.ts`；typecheck.include `packages/*/test/**/*.test-d.ts`（`tsconfig.typecheck.json`）；`maxWorkers: 1` | 新文件按 `issue-383-*.test.ts` / `issue-383-*.test-d.ts` 命名即自动采集，无需改配置 |
| 别名/条件 | `NODE_OPTIONS=--conditions=nomicore-source` + vitest alias `@nomicore/*` → `src/index.ts` | 源码态运行；探针与测试同一解析链（探针 tsx 同条件） |
| 家族风格对齐 | #369 组合家族（`expectReadDataOkKeys`、字节锚、独立预言机、`bodyBlocks`/oracle 剥离对账）、`issue-369-window-read-lease-surface.test-d.ts`（`Equal` 锁 + `@ts-expect-error`）、`runtime-registry-internal-*`（registry 内部缝先例） | 新组沿用同一 helper 与形态 |
| fixture 复用先例 | `packages/namespace-registry/test/issue-369-window-read-fixture.ts`（`createNamespaceRegistryForTesting` + StubPersistence 同 doc + 确定性 clock/randomBytes + schema ready 轮询） | FIX-383-A 镜像该纪律 |

## 15. Unknowns and blockers

- **O1（实现自由，不阻塞）**：`where` 上限 16 是「实现票可调哨兵值」（ADR 0029 §2）——契约按简报/ADR 钉死「16 合法 / 17 非法」；若实现要改哨兵须先改 ADR 口径。
- **O2（实现自由，不阻塞）**：`message` 文本、组合层内部字段名/函数名、S3 镜像的抽取方式（内联 vs 子函数）——不影响任何行为断言（message 非契约字段）。
- **O3（实现自由，不阻塞）**：`truncated` 计算的表达式形态（`kept === canonical.n` 的实现位置）——只要观测语义符合 B-5；S3 结构审计（§12.6 S3/S4）只锁「单源判据 + canonical n」。
- **O4（契约按 A3 钉死，登记）**：§12.3.10 S1 的交替视图（S3 视图隐藏 `where`）按 SA8 A3「在场判据键于 W1 `total === undefined`」预期 `ok:true` + 装满判定；若实现选择把该漂移判为「视图不稳定」而拒绝，虽仍满足「零静默」，但与 A3 判据文本不符——实现若采此路线须回门禁复核并同步改 S1 期望，**不得静默改期望**。
- **O5（可选，不阻塞）**：`WhereTerm` 具名再导出（L6/Y5）——AC6 只要求「类型 fail-closed + 透传」，当前单源别名链已满足；是否具名再导出属实现票选择（若加须走 `src/index.ts` + 守卫记账）。
- **O6（frozen，登记）**：`total` 恒不上 lease/runtime 窗口结算（K1）——ADR 0029 备选节明文否决第五键；实现不得借 where 语义加键。
- **O7（非阻塞）**：简报 AC8「全仓 typecheck + 测试绿」的最终判定在实现票；本票只给实现前基线（§13/§14）。
- **无阻塞项**：能力缺口稳定复现（3 轮 × 双面 × 双方法 + 规模两轮 + S3 隔离）；红因正确（缝 2 未实现，非环境/fixture/入口）；
  负控同场全绿；契约可执行（真实 runner 采集 + 既有先例形态）；修复范围自足（无 Owner 决策需求；§2 无 override）。

## 16. Temporary diagnostics cleanup

| 临时物 | 位置 | 清理 |
|---|---|---|
| 行为探针 `__sa6_383_probe.mts` | `packages/namespace-registry/test/` | `rm` 删除；输出留存 `/tmp/sa6-383-probe.out`（非仓内）；探针内 runtime/registry 均已 `close()`/`shutdown()` |
| 类型探针 `__sa6_383_type_probe.ts` | `packages/namespace-registry/test/` | `rm` 删除；删除后 `npx tsc -p tsconfig.typecheck.json --noEmit` **exit 0**（§14） |
| 生产实现 | — | **零修改**（dispatch 明令）；`git status --porcelain` 仅 Host 四件 + 本报告 |
| 依赖安装 | `node_modules/`（gitignored） | 保留（运行器需要）；无仓内跟踪物 |

清理复核：`ls packages/namespace-registry/test | grep sa6_383` → 无命中；`git status --porcelain` 无生产/测试/fixture 改动；
无遗留后台服务/进程（探针为一次性脚本，无 nohup/setsid/PID 文件）。

---

## 门禁实测补记（收尾回填）

- `pnpm typecheck` → **exit 0**（14 个 tsc 工程；输出 `/tmp/sa6-383-typecheck.out`）。
- `pnpm test` → **exit 0**：`Test Files 396 passed (396)` / `Tests 4827 passed (4827)` / `Type Errors no errors` /
  `Duration 609.01s`（输出 `/tmp/sa6-383-test.out`；探针删除后的干净 HEAD 基线）。
- 探针删除后 `git status --porcelain`：仅 Host 四件 + 本报告（输出见 §16 清理复核）。

---

## Verdict

**`approve`**。

理由：① 能力缺口在 HEAD 稳定复现（3 轮 × runtime/lease 双面 × readArray/readMap 双方法 + 规模两轮），
红因 = ADR 0029 缝 2 未实现（入口 fail-closed + S3 恰四键白名单），**不是**环境/fixture/入口问题
（同进程 W1 直调同参成功、无 where 三面全绿、既有 129 用例全绿、生命周期/释放路径正常）；
S3 白名单的独立阻塞性由隔离实验 O8（`where: undefined`，`total` 保持数值、入口分支旁路）确证；
② 契约把简报 AC1–AC8 与 ADR 0029 §1–§8、SA8 A1–A6 / F1–F11 转成可执行断言面：
无 where 零漂移（A）、truncated 双语义（T）、✂ 永不装配与 schema 通道（X）、恒四键与身份随行（K）、
组合式 depth 等价锚（D）、敌意 where 与 S3 两出口（Z）、registry 透传与类型 fail-closed（L/Y）、
生命周期覆盖（C）、失败码冻结面（F）、单源纪律变异守卫（S），并给出迁移契约（M1–M7）、
结构审计（S1–S6）、测试路径（P1–P6）与反伪绿防线（§12.7）；
③ 分类诚实：HEAD 红组（T/X/K/D/Z-positives/L1/S/F1-F2-F4）与预绿守卫/伪绿组（A/C/F3-F7/L2-L6/Y/Z3-Z8）
逐项登记，类型面明确「锁边界而非造红」，Y3 标出 TS2578 伪红禁区；
④ 负控在 HEAD 全绿且实现后必须保持；期望由独立预言机（Yjs/native 直数、同运行公共面 oracle、字节锚）派生；
⑤ 运行器真实可触发（聚焦 4 文件 129 用例实跑 + 类型段 exit 0 + 全仓门基线），
`requiresConflictRecheck: true` 的实现后复查义务已由 §12.4/§12.6/§15 承接。
