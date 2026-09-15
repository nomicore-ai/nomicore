# SA6 诊断与验收契约 — issue #382 P2：`where` 过滤原语（缝 1：doc-runtime）

- 任务类型：**Feature（已接受决策的能力兑现票）**——ADR 0029 验收缝 1 的落地：`@nomicore/doc-runtime`
  载体级窗口原语 `readArrayWindowAtPath` / `readMapWindowAtPath` 的 options 增可选 `where`
  （谓词合取过滤）、管线序 where → orderBy → n、`total: number | undefined`。
  不虚构 Bug 根因；本票不是缺陷修复，而是**能力缺口**的补齐（HEAD 对 `where` 响亮拒绝、对过滤语义零支持）。
- 本报告路径固定为 `wiki/raw/task_issue-382_sa6_contract.md`；本轮**未**创建/修改任何生产实现或可执行测试
  （dispatch：「Do not implement or author executable tests」）——§12 给出可由实现票/复核票机械执行的验收契约。
- 只读诊断产物：三个一次性探针（行为 / 预言机 / lease 中间态）与一个一次性类型探针，全部已删除（§16）。
- Verdict：`approve`（能力缺口稳定复现、契约可执行、红/绿证据齐备；详见 §13–§16）。

---

## 1. Task type and inputs

| 输入 | 状态 |
|---|---|
| 任务简报 `wiki/raw/task_issue-382.md`（Host-owned） | 在场（35 行；What to build + AC1–AC8 + Blocked by #381） |
| `wiki/raw/task_issue-382_relevant_decisions.md`（SA8） | 在场（86 行；ADR 0029/0028/0027/0024/0023/0002/0008 摘录 + CONTEXT.md 词条 + 代码事实） |
| `wiki/raw/task_issue-382_conflict_report.md`（SA8） | 在场（86 行；裁决 `clear` + A1–A5 执行义务 + F1–F8 冻结面 + R1–R16 对照） |
| Owner comment | **无**（简报 Comments 段空；dispatch 明示 REST 刷新为空：无 comment ID/时间戳） |
| 规范权威 | `docs/adr/0029-filtered-window-read.md`（accepted，2026-09-16）§1–§8 + 验收缝 1；基契约 `docs/adr/0028-window-read.md` |
| 历史证据（非规范） | `wiki/raw/task_issue-368_*`（W1 交付 + 测试家族先例）、`wiki/raw/task_issue-381_sa6_contract.md`（P1 前票契约）、`packages/doc-runtime/test/issue-368-*.test.ts`、`issue-381-window-total-red.test.ts` |
| 基准快照 | worktree `/home/wangjian/nomicore-fix-issue-382`，HEAD `1b639e0ebe825ffbbfce377850c01ef620734f47`（#381 P1 已入；`where` 实现不在场） |

任务类型判定依据：ADR 0029 已接受（`8a4fa40`）并把验收拆为三缝；#382 即缝 1（doc-runtime 原语公共入口）
的实现票（简报 L17 的「What to build」逐字引用 ADR 0029 §1/§2/§4/§5）。HEAD 上 `where` 不是错误行为而是
**未实现的词表位**：`window.ts` 的 options 键集白名单恰四键（L276–279），`where` 命中「未知键」→
`WINDOW_OPTIONS_INVALID`。本票目标 = 把该词表位实现为 ADR 0029 的过滤语义，且不回归任何 P1/ADR 0028 语义。

## 2. Owner comment mapping

无 owner comment（简报 Comments 段空；dispatch 明示评论 REST 快照为空，无 comment ID/时间戳）。
验收面 = 简报 AC1–AC8 逐字 + ADR 0029 §1–§8 的规范约束 + SA8 的 A1–A5 执行义务与 F1–F8 冻结面。
§12.2 给出 AC ↔ 验收面映射；无额外 owner 口径需要对齐。

## 3. SA8 constraints（clear 门禁 + 执行义务的契约化）

SA8 裁决 `clear`（implements-existing-decision ×7、no-conflict ×9、evolution-required ×0、hard-conflict ×0），
`requiresConflictRecheck: true`。其 A1–A5 义务与 F1–F8 冻结面在本契约中的落点：

| SA8 项 | 约束原文要点 | 本契约落点 |
|---|---|---|
| A1 词表纪律 | 严格 ADR 0029 §2–§6 缝 1 范围；in/范围/OR/NOT/多段 field、容器深相等一律 v1 词表外响亮拒绝 | §12.3.1 C1–C8（v1 闭集正例）+ §12.3.3 V1–V21（闭集外一律 `WINDOW_OPTIONS_INVALID`）+ §12.7 反伪绿 |
| A2 缝序一致性 | `NamespaceLeaseReadArrayOptions = NamespaceRuntimeReadArrayOptions = ReadArrayWindowOptions` 会把 W1 options 类型扩展透传到 lease 类型面；缝 1 后、缝 2 前的中间态 lease 面实传 `where` 必须**响亮失败**（S3 四键白名单 fail-closed），不得引入绕过 S3 的静默通道；S3 镜像扩展由缝 2 票闭合 | §12.3.7 F3（lease 中间态响亮纪律）+ §12.6 结构审计 S2 + §12.8 敏感度（禁止 `?? 0`/`as` 兜底）+ §15-O4 |
| A3 公共面守卫 | 新公共类型（`WhereTerm`）须经 `src/index.ts` 导出并纳入 public-surface guard 记账 | §12.3.8 Y1–Y4 + §12.4 M2 |
| A4 冻结面纪律 | `read.ts` 零 diff；`window.ts` 原地扩展；无 where 路径行为逐字节不变 | §12.3.7 F1/F2 + §12.6 S1/S3 + §12.4 M3/M4 + §6 NC1–NC4 |
| A5 测试先例 | 缝 1 测试沿 issue #368 契约家族同款风格（contract-red + design-pins；#381 已在场）；全仓 typecheck + 测试绿 | §12.5 测试路径 + §12.9 家族风格对齐 + §14 运行器触发 |
| F1 | `readData` options 闭合形状零变化 | §6 NC4（姊妹 `where` → `READ_OPTIONS_INVALID`） |
| F2 | lease 恒四键 + 十四键 runtime 面不动 | §6 NC8 + §12.3.7 F3 |
| F3 | 三窗口失败码语义不漂移；where 形状非法收编进 `WINDOW_OPTIONS_INVALID` | §12.3.3 V 组 + §12.3.7 F4 |
| F4 | orderBy v1 词表（readArray 仅 `by:'index'`）不被 where 触碰 | §12.3.1 C8 + §12.3.3 V18 + §6 NC5 |
| F5 | `where` 自身形状永不再变（v1 只收标量闭集等值） | §12.3.1 C1–C8 与 V 组的闭集边界 |
| F6 | `read.ts` 零 diff + `copied from read.ts@36a73bb` 镜像纪律 | §12.6 S1 + §13 证据（sha256 / `git diff` 空） |
| F7 | where 缺席行为零回归（total = 标识计数等 P1 语义） | §6 NC1–NC3 + §12.3.5 T1–T3 |
| F8 | ✂ 段 where 在场永不装配（缝 2） | §12.1 B-10 范围排除 + §15-O4 |

## 4. Environment and baseline

| 项 | 值 |
|---|---|
| Worktree | `/home/wangjian/nomicore-fix-issue-382`（dispatch 一次性；唯一未跟踪文件 = Host 三件：`task_issue-382.md` / `_relevant_decisions.md` / `_conflict_report.md`） |
| HEAD | `1b639e0ebe825ffbbfce377850c01ef620734f47`「refactor(#381): W1 total 下沉与组合层收缩 (#392)」 |
| 依赖 | 初始无 `node_modules`；`pnpm install --offline --frozen-lockfile` → 65 包复用 store，exit 0（0.435s） |
| 工具链 | node v24.13.0；pnpm 10.28.2；vitest 3.2.7；tsx 4.23.12；typescript 5.9.3；yjs 13.6.32 |
| 运行器 | root `pnpm test` = `NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`；`maxWorkers: 1`；include = `packages/*/test/**/*.test.ts`（+ `domains|apps`），typecheck.include = `packages/*/test/**/*.test-d.ts`（tsconfig `./tsconfig.typecheck.json`） |
| 基线（聚焦窗口家族，8 文件） | **144 passed / 0 failed**（#368 契约 47 + #368 pins 11 + #381 14 + public-surface 6 + public-surface-type `.test-d` 14 + #369 组合 17 + #369 lease 33 + lease-surface `.test-d` 2）；`Type Errors no errors`；7.34s |
| 基线（doc-runtime 包 typecheck） | `tsc -p packages/doc-runtime/tsconfig.json --noEmit` **exit 0** |
| 冻结面指纹 | `packages/doc-runtime/src/read.ts` sha256 `3bf6b8b016e4066dd089f2cfd17d9c5bf3ad161ab3285c91b71298d983b1b312`；`git diff --stat -- packages/doc-runtime/src/read.ts` **空** |
| 基线（全仓，实现前） | `pnpm test` **exit 0**：393 文件 / 4745 用例全绿、`Type Errors no errors`（599.68s）；`pnpm typecheck` exit 0（14 个 tsc 工程，见 §13） |

## 5. Positive reproduction / capability gap（目标契约在 HEAD 处为红）

诊断探针（一次性，`packages/doc-runtime/test/__sa6_382_probe.mts`，运行后已删除；输出 `/tmp/sa6-382-probe.out`）。
HEAD 实际 vs 目标：

| 观察（探针编号） | HEAD 实际 | 目标契约 | 结果 |
|---|---|---|---|
| A1 `readMap(['tasks'], {n:5, where:[{field:'state',equals:'claimed'}]})`（Y.Map 载体） | `ok:false, code=WINDOW_OPTIONS_INVALID` | `ok:true`，条目 t1/t3/t5，`total: undefined` | **FAIL（红）** |
| A2 同上（plain object 载体） | `WINDOW_OPTIONS_INVALID` | 条目 t1/t3/t5 | **FAIL（红）** |
| A3 `readArray(['list'], {n:5, where:[…claimed]})`（Y.Array 载体） | `WINDOW_OPTIONS_INVALID` | 条目 index 0/2（位置序） | **FAIL（红）** |
| A4 同上（plain array 载体） | `WINDOW_OPTIONS_INVALID` | 条目 index 0/2 | **FAIL（红）** |
| A5 匹配数 > n（n=1） | `WINDOW_OPTIONS_INVALID` | 恰 1 条 + `total: undefined` | **FAIL（红）** |
| A6 标量元素数组面（`[1,2,3]`，0 匹配） | `WINDOW_OPTIONS_INVALID` | `ok:true, value: [], total: undefined` | **FAIL（红）** |
| A7 空容器 + where | `WINDOW_OPTIONS_INVALID` | `ok:true, value: []` | **FAIL（红）** |
| A8 管线 where → orderBy(`field priority desc`) → n=2 | `WINDOW_OPTIONS_INVALID` | t3(5) → t1(2) | **FAIL（红）** |
| A9 合取 `claimed ∧ priority=5` | `WINDOW_OPTIONS_INVALID` | t3 | **FAIL（红）** |
| A10 同 field 重复项 `claimed ∧ done` | `WINDOW_OPTIONS_INVALID` | `ok:true, value: []`（AND 自然收敛，不响亮） | **FAIL（红）** |
| A13 安静不匹配矩阵（脏条目 + 1 正常匹配，n=50） | `WINDOW_OPTIONS_INVALID` | 恰 d2 | **FAIL（红）** |
| A14 `equals: null`（在场 null 匹配、缺席不匹配） | `WINDOW_OPTIONS_INVALID` | 恰 nullState/nullState2 | **FAIL（红）** |
| A15/A16 零物化哨兵（1998 NaN + 2 claimed） | `WINDOW_OPTIONS_INVALID` | `ok:true`，恰 2 条命中 | **FAIL（红）** |
| A17 null-proto WhereTerm（合法 plain 链） | `WINDOW_OPTIONS_INVALID` | `ok:true` 按过滤结果 | **FAIL（红）** |
| C5 有 where 时 `total` | 失败结算无 `total` 键 | own 键在场且 `=== undefined` | **FAIL（红）** |
| D14 公共值导出 `/Window/` 过滤 | `["readArrayWindowAtPath","readMapWindowAtPath"]` | 不变（`WhereTerm` 为 type-only） | PASS（负控） |
| D8 姊妹 `readLogicalValueAtPath(tasks)` | `ok:true, keys=[ok,value]` | 不变 | PASS（负控） |
| D9 姊妹 + `where` | `READ_OPTIONS_INVALID` | 不变（不得拓宽 readData options） | PASS（负控） |
| D13 同调用重复两次 | JSON 逐字节一致 | 不变 | PASS（负控） |

**类型层探针**（一次性 `packages/doc-runtime/test/__sa6_382_type_probe.ts`，运行后已删除；
`npx tsc -p packages/doc-runtime/tsconfig.json --noEmit`）：

```
__sa6_382_type_probe.ts(8,3):  TS2305: Module '"../src/index.js"' has no exported member 'WhereTerm'.
__sa6_382_type_probe.ts(17,50): TS2353: 'where' does not exist in type 'ReadArrayWindowOptions'.
__sa6_382_type_probe.ts(18,48): TS2353: 'where' does not exist in type 'ReadMapWindowOptions'.
__sa6_382_type_probe.ts(20,40): TS2339: Property 'where' does not exist on type 'ReadArrayWindowOptions'.
__sa6_382_type_probe.ts(24,18): TS2344: Type 'false' does not satisfy the constraint 'true'.   // total ≠ number | undefined（array）
__sa6_382_type_probe.ts(26,18): TS2344: Type 'false' does not satisfy the constraint 'true'.   // total ≠ number | undefined（map）
```

即目标类型契约（`WhereTerm` 可导入、两面 options 收 `where`、成功面 `total: number | undefined`）在 HEAD 处
编译红；红因与运行时红因同源（能力缺口 = 词表位与结算值域未扩）。类型探针删除后
`tsc -p packages/doc-runtime/tsconfig.json --noEmit` 复绿 exit 0。

**独立预言机（反伪绿前提）**：`__sa6_382_oracle_probe.mts`（已删除）用 native/Yjs 直数派生期望，
零实现复用，逐位对上目标：`tasks` where claimed → `t1|t3|t5`；`plainTasks` → `t1|t3|t5`；
n=1 → `t1`；priority desc n=2 → `t3|t1`；合取 → `t3`；dirty claimed → `d2`；dirty null → `nullState|nullState2`。
**反事实（ignore-where 变异在 HEAD 的可观测形态）**：同 fixture 不传 where 得 `t1|t2|t3|t4|t5`（n=5）/
`t1|t2`（n=2）——与目标 `t1|t3|t5` / `t1|t3` 明确不同，证明「接受 where 但忽略它」的实现必被 Q 组击穿。

**红不来自环境/fixture/入口**：同探针内 D8/D9/D13/D14 与 C1–C4（无 where 三键 + total 计数）全 PASS；
fixture 值经姊妹 `readLogicalValueAtPath` 可正常物化；宿主 `maxWorkers:1`、全同步、零时钟/网络。

## 6. Negative control（HEAD 全绿；实现后必须保持绿）

| # | 负控 | HEAD 证据 |
|---|---|---|
| NC1 | 无 where 三键成功面：own 键集恰 `{ok, value, total}`；`total` = 标识计数（Y.Array/plain array `length`；Y.Map 非 undefined 值键数；plain object own-enumerable data 且值非 undefined） | 探针 C1–C4 / D1 全 PASS（`total=5/3`）；#381 T1–T5 绿 |
| NC2 | `value.length === min(n, total)`、排序基/方向/预算轴不变性（P1 语义零回归） | #381 T4/T6/T7 绿；探针 C3 desc 位置序 `i2|i1` PASS |
| NC3 | 无 where 零物化哨兵：`[30,10,NaN×1998]` + n=2 → `ok:true, total=2000` | 探针 D7 PASS；#368 W1-F5、#369 E3 绿 |
| NC4 | 姊妹 `readLogicalValueAtPath` 冻结：无 options → 恰两键 `{ok,value}`；带 `where` → `READ_OPTIONS_INVALID`（`where` 不得进 readData options，ADR 0024/0027/0029 §1） | 探针 D8/D9 PASS；`read.ts` 零 diff（§4） |
| NC5 | orderBy v1 词表不变：`readArray` 传 `field`/`by:'key'`、`readMap` 传 `by:'index'`（无 where）→ `WINDOW_OPTIONS_INVALID` | 探针 D10–D12 PASS；#368 W1-G4 绿 |
| NC6 | 公共值导出面纯加法：`Object.keys(ns)` 的 `/Window/` 过滤恰两枚；`WhereTerm` 为 type-only（不出现在运行时键空间） | 探针 D14 PASS；`public-surface-guard.test.ts` P-W1/P-W2 绿 |
| NC7 | 确定性：同一 doc 重复调用逐字节一致 | 探针 D13 PASS；#368 W1-H1 绿 |
| NC8 | lease 面恒四键 + `truncated === kept < total` + ✂ 事实行逐字节不变（无 where 路径） | 探针 D17/D18 PASS（`[ok,schema,truncated,value]`，`truncated=true`）；#369 lease T1–T7 绿 |
| NC9 | 既有窗口家族测试零改动保持绿（#368 contract/pins、#381、#369 组合/lease、surface guards） | 聚焦 8 文件 144/144 绿（§4） |
| NC10 | 失败结算形状不变：恰四键 `{code, ok, path, message}`；三码 + `PATH_NOT_ALLOWED` 透传；无 `value`/`total` | 探针 D2–D6 PASS；#368 pins P7 失败半、#381 T9 绿 |
| NC11 | lease 中间态响亮（SA8 A2）：经 lease 面实传 `where` **不得**静默通过 | 探针独立 lease 探针（§9-E5）：`lease.readMap(['tasks'],{n:2,where:…})` → `ok:false, code=WINDOW_OPTIONS_INVALID`；`lease.readArray` 同；无 where 基线 `[ok,schema,truncated,value]` |
| NC12 | 稀疏/undefined/accessor 条目的**条目空间**语义不变（undefined 值键出空间、accessor/non-enumerable 不出 now） | #381 T5、#368 P4 绿（本票不得改条目空间） |

## 7. Stability, scale and timing

- 全链路同步、单 `Y.Doc`、零网络/零时钟/零订阅；`maxWorkers: 1`；同 fixture 重复调用逐字节一致（探针 D13）。
- 规模哨兵：N=2000（Y.Array 前 1998 项 NaN + 尾部 2 条命中；Y.Map 1998 个 NaN 值键 + 2 条命中；
  plain array 1998 空洞 + 2 条命中）——任何「先全量物化再过滤」的实现必红（PATH_NOT_ALLOWED，
  ADR 0028 §8 零物化纪律 × ADR 0029 §3 安静不匹配）。
- 位置序短路（ADR 0029 §5「凑满 n 个匹配即停」）是**成本纪律**：它与「过滤全部再取前缀」在
  可观测结果上等价（value/total/顺序全一致），因此本契约**不**把它写成行为断言（禁止伪造红灯），
  改为：①`total` 有 where 恒 `undefined`（任何为给 total 而全扫计数的实现可被击穿）；
  ②zero-materialization 哨兵（Z 组）；③结构审计（§12.6 S2「不得为短路引入第二读路径/静默通道」）。
  以 traps 观测「是否扫描到尾部」的测试被明确排除（§11-H8：会强加 ADR 未规定的敌意数据语义）。
- 时序/并发：唯一可在两次导航之间运行的用户代码是 options/where 的 Proxy/descriptor trap（V 组覆盖，
  零外抛、零 `[[Get]]`）；无竞态面（单线程同步、无 await/yield）。

## 8. Root-cause chain / capability gap chain

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| 1（症状） | 任何合法 `where` 调用在 HEAD 得到 `ok:false, WINDOW_OPTIONS_INVALID`（message「window options 含未知键（封闭形状）：where」） | 探针 A1–A17 / §5；`window.ts` L276–279 | 高（实跑） |
| 2（直接缺口点） | W1 options 封闭形状白名单恰四键 `n/orderBy/depth/maxChildrenPerNode`；`where` 在 OPT 阶段被拒，零 doc 触碰 | `window.ts` L259–312（L276–279 键集、L280–286 descriptor 读） | 高（源码+实跑） |
| 3（为什么存在） | ADR 0028 交付的窗口原语 v1 不含谓词维度；#381 只做了 total 下沉，`where` 由 ADR 0029 §8 明文留给本票（「window.ts 原地扩 where 与 total」） | ADR 0029 §8 L67；#381 契约 §12.9 非目标「不加 where」 | 高（规范） |
| 4（触发条件） | 任何调用方按 ADR 0029 §1 传 `where`（含 lease 面经类型别名透传） | `window.ts` L57–70（options 类型无 where）；探针 A 组 | 高（规范+实跑） |
| 5（放大因素） | 类型别名链把 `where?` 透传到 lease 类型面，而 lease 组合层 S3 仍按四键白名单 fail-closed → 缝 1 后中间态必须保持**响亮**（SA8 A2），且 W1 `total` 加宽 `number\|undefined` 会在 `runtime.ts` L691/L703 产生编译张力（必须显式响亮处理，禁 `?? 0`/cast） | `types.ts` L470/480、`lease.ts` L447–450；`window-read.ts` L213–216/L157–162；`runtime.ts` L689–703 | 高（源码+探针 E5） |
| 6（最深根因） | **载体级窗口原语缺「值感知的候选集筛选」维度**：过滤必须发生在选窗之前（runtime 层后滤会得到「前 n 个里滤剩 0 个且匹配规模未知」的错序结果），故 where 必须进 doc-runtime 原语 | ADR 0029 §4 结构推论 L43；ADR 0024 结构盲纪律背景 | 高（规范） |
| 7（未证实假设） | 无承重未证实假设。`where` 在场时 message 文本、内部校验函数命名、短路实现方式均为实现自由（§15） | — | — |
| 8（排除项） | 不是环境/fixture/入口问题（§6 NC）；不是 lease/runtime 组合层缺陷（无 where 路径逐字节不变）；不是 readData 预算缺陷（ADR 0024 边界未触碰）；不是 authority/schema 缺陷（ADR 0029 §7 划界：比较实际数据值，schema 无关） | 探针 D8/D9/D17/D18；§6 | 高 |

## 9. Causal experiments（控制变量 / 反证；全部只读或已回滚，证据见 §16）

- **E1 — HEAD 行为探针**（`__sa6_382_probe.mts`）：§5 全表。红因 = 合法 where 被 OPT 键集拒绝；
  同探针 C/D 组负控全绿 → 红不来自 fixture/环境/入口。
- **E2 — 独立预言机**（`__sa6_382_oracle_probe.mts`）：期望由 Yjs/native 直数派生（§5），
  与 HEAD 实际 `DIFF`；证明断言可判定、不依赖实现、不伪绿。
- **E3 — 反事实对照（ignore-where）**：无 where 同 fixture 返回 `t1|t2|t3|t4|t5` / `t1|t2`，
  与目标 `t1|t3|t5` / `t1|t3` 不同 → Q 组对「接受但忽略 where」敏感。
- **E4 — 类型层探针**（`__sa6_382_type_probe.ts` + `tsc -p packages/doc-runtime/tsconfig.json --noEmit`）：
  TS2305/TS2353/TS2339/TS2344 六处；删除后 tsc exit 0。
- **E5 — lease 中间态探针**（`__sa6_382_lease_probe.mts`，自建 doc + registry testing 装配）：
  `lease.readMap/readArray` 实传 where → `WINDOW_OPTIONS_INVALID`（响亮，非静默）；无 where 基线四键
  `[ok,schema,truncated,value]`、`truncated=true`。证明中间态现状满足 SA8 A2，且本票契约不得把它改成静默。
- **E6 — 生产实现零改动**：dispatch 明令「不得修改生产实现」，故**未做**变异实验（#381 先例的变异
  A/B 在本票以 E3 反事实 + E2 预言机替代敏感度证明）；`git status --porcelain` 证明生产文件零修改（§16）。

## 10. Impact surface

| 面 | 位置 | 影响 |
|---|---|---|
| W1 公共面（唯一实现落点） | `packages/doc-runtime/src/window.ts` 原地扩 | 新增 `WhereTerm` 类型、options 增 `where?`、成功面 `total: number\|undefined`；OPT 校验扩 where 封闭形状；C/E 枚举后、S 排序前插入过滤；A 装配 `total` 分支 |
| 公共导出 | `packages/doc-runtime/src/index.ts` | `export type { WhereTerm }`（A3）；两值导出不变 |
| 冻结面 | `packages/doc-runtime/src/read.ts` | **零 diff**（sha256 见 §4；`copied from read.ts@36a73bb` 纪律维持） |
| 类型别名链 | `namespace-runtime/src/index.ts` → `namespace-registry/src/types.ts` L470/480 → `lease.ts` L447–450 | `where?` 随别名自动透传到 lease 类型面（SA8 A2）；类型等价断言继续成立；运行时中间态必须响亮（§12.3.7 F3） |
| 组合层 | `namespace-runtime/src/window-read.ts` L203–248（S3 四键白名单） | **本票不改语义**；中间态 fail-closed 响亮保持（A2）；S3 镜像扩展属缝 2 |
| runtime 消费边界 | `namespace-runtime/src/runtime.ts` L689–703 | W1 `total` 加宽后必须在消费点显式处理 `undefined`（响亮分支，禁 `?? 0`/cast/fallback）；否则 `pnpm typecheck`（AC8）红 |
| 测试迁移 | `public-surface-type-guard.test-d.ts` L208–222（尤其 L215–216 `total` 钉 `number`） | 必须同步迁移为 `number \| undefined`（本票类型面变更的直接后果；M2） |
| 测试零改动 | `issue-368-window-read-contract-red.test.ts`、`issue-368-window-read-design-pins.test.ts`（P7 键集）、`issue-381-window-total-red.test.ts`（无 where 面）、`public-surface-guard.test.ts`、`#369` 组合/lease 测试 | 全部无 where 调用 → 期望不变；若某断言因 where 而红，先报设计修订，不得就地改软（M3/M4） |
| schema/authority | 全链 | 零触碰（ADR 0029 §7：谓词比较实际数据值；schema 通道不受影响） |

## 11. Ruled-out hypotheses

| # | 假设 | 结论 | 反证 |
|---|---|---|---|
| H1 | owner comment 有额外要求 | 排除 | 简报 Comments 空 + dispatch 明示 REST 为空（§2） |
| H2 | 这是 Bug（HEAD 行为违反既有契约） | 排除 | HEAD 对 `where` 的拒绝是 options 封闭形状 v1 的**预期行为**；缺口是词表未实现（Feature，§8-3） |
| H3 | HEAD 把 `where` 静默忽略 | 排除 | 探针 A 组实测 `WINDOW_OPTIONS_INVALID`，message 明示未知键 |
| H4 | where 缺席路径需要改动 | 排除 | C/E/S/A 无 where 分支逐字节不变（§6 NC1–NC3、§12.1 B-8） |
| H5 | 本票同时改 lease 四键/✂/truncated（缝 2） | 排除 | ADR 0029 §5/§1、SA8 F2/F8；简报 AC7 只要求不回归三码与词表 |
| H6 | `where` 可进 readData options / 预算轴 | 排除 | ADR 0024 结构盲纪律 + ADR 0029 §1；NC4 钉死 `READ_OPTIONS_INVALID` |
| H7 | V 组（入参响亮）用例在 HEAD 是红的 | 排除（**伪绿登记**） | HEAD 一并以「未知键」得同码；V 组只在实现后作为变异守卫，红证据必须由 Q/T/Z/P 组承担 |
| H8 | 位置序短路可用行为断言（尾部 trap 观测） | 排除 | 显式结果（value/total/顺序）在全扫与短路下完全相同；用敌意 Proxy 观测会强加 ADR 未规定的数据侧语义并制造假红（§7） |
| H9 | 数组面 where 面词表被放宽（`readArray` + field 过滤被误读为接受 field 排序） | 排除 | ADR 0029 §4 明文「过滤与排序正交；where 不触碰 orderBy 面词表」→ C8/V18 |
| H10 | `equals` 的 non-finite / 容器类型可在编译期兜住 | 排除 | TypeScript 无法排除 `NaN`；容器类型在类型层可见但按 §2/§3 仍须运行时响亮 → V4/V5 运行时断言 |
| H11 | 需要新增第四个读方法 / 新公共值导出 | 排除 | ADR 0029 §1 明文否决；A3 只加 type-only 导出；P-W2 值导出审计保持两枚 |

## 12. Acceptance contract and test paths

> 契约纪律：全部断言锚定**运行时行为**（结果联合、own 键集、条目列表与身份、Y.Doc 值、异常观测）；
> 禁止源码字符串/正则断言代替行为验证；禁止 skip/only/todo、env override、fallback、吞错；
> 期望一律由**独立预言机**（Yjs/native 直数）派生，禁止与实际从同一实现路径派生（§12.7）。
> §12.6 的结构审计单独标注为「结构性证据」，不作为行为断言的替代。

### 12.1 绑定表与不变量（实现期不得漂移）

| 绑定 | 值 | 来源 |
|---|---|---|
| B-1 原语入口 | `readArrayWindowAtPath(doc, path, options)` / `readMapWindowAtPath(doc, path, options)`（名字/形状不变） | ADR 0029 §1「词表演进，非新方法」 |
| B-2 options 面 | 两面 options 增可选 `where?: readonly WhereTerm[]`；`n`/`orderBy`/`depth`/`maxChildrenPerNode` 语义不变 | ADR 0029 §1/§2 |
| B-3 `WhereTerm` | `{ field: string; equals: string \| number \| boolean \| null }`；v1 恰单段字面键（点号不拆分）；`number` 须 `Number.isFinite`（运行时） | ADR 0029 §2 |
| B-4 合取与边界 | `where` 数组 = AND（全满足）；空数组非法；长度上限 16（16 合法 / 17 非法）；同 field 重复项合法（自然收敛） | ADR 0029 §2 |
| B-5 管线序 | **where（候选筛选）→ orderBy（匹配集总序）→ n（前缀）**；位置序（index/key 基）短路是成本纪律，不改变可观测结果 | ADR 0029 §4/§5 |
| B-6 安静不匹配 | field 缺席 / 条目值非可下钻对象（标量、数组面标量元素、稀疏空洞）/ field 值非标量（容器/载体）/ field 值 non-finite / accessor 或 non-enumerable field → **安静不匹配**；脏项不挤出正常项、不废整次查询 | ADR 0029 §3 |
| B-7 入参侧响亮 | 空数组、超 16、equals 非闭集类型、equals number 非 finite、WhereTerm 未知键/非法原型/形状漂移、`where` 非数组、accessor/hole/Proxy trap → `WINDOW_OPTIONS_INVALID`；零 `[[Get]]`、零 accessor 执行、零外抛 | ADR 0029 §3/§6 |
| B-8 成功结算 | own 键集**恰三键** `{ok, value, total}`；`total` 键**恒在**：无 where = 标识计数（= P1 语义，数值）；有 where = `undefined` | ADR 0029 §5；#381 |
| B-9 失败结算 | own 键集恰四键 `{code, ok, path, message}`；三稳定码 + `PATH_NOT_ALLOWED` 透传；无 `value`/`total`/`truncated` | ADR 0028 §7；#368 pins P7 |
| B-10 类型面 | `WhereTerm` 经 `src/index.ts` 导出；`where` 投影 `readonly WhereTerm[] \| undefined`；成功面 `total: number \| undefined`；`readArray.orderBy` 仍仅 `IndexWindowTerm` | ADR 0029 §1/§2/§5；模块 AGENTS A3 |
| B-11 范围冻结 | 只动 W1；`read.ts` 零 diff；`window.ts` 原地；lease 四键/`truncated`/✂ 不动（缝 2）；lease 面 where 中间态保持响亮 | SA8 A2/A4、F1–F8 |

### 12.2 Issue AC ↔ 验收面映射

| AC（简报 L21–28） | 验收面 | 用例组 |
|---|---|---|
| AC1 合取语义正确性矩阵（多条件/field 缺席/值非标量/non-finite/同 field 重复/标量元素数组面/四载体族） | 行为 | §12.3.1 C1–C11、§12.3.2 D1–D12、§12.3.4 P1–P5 |
| AC2 安静不匹配纪律（含 equals:null 对缺席不匹配、在场 null 匹配；不炸读、不挤掉正常条目） | 行为 | §12.3.2 D1–D12 |
| AC3 入参侧响亮（空数组/超 16/非 finite/非闭集/未知键/非法原型/形状漂移） | 行为 | §12.3.3 V1–V21 |
| AC4 敌意 options（accessor/Proxy/trap 异常）零 `[[Get]]`、零外抛、收编响亮 | 行为 | §12.3.3 V11–V17 |
| AC5 零物化哨兵（未匹配条目埋 non-finite/稀疏空洞毒值必须 `ok:true`） | 行为 | §12.3.6 Z1–Z8 |
| AC6 where 在场 `total === undefined`；缺席 `total` = 标识计数（P1 零回归） | 行为 | §12.3.5 T1–T6 |
| AC7 三失败码语义不回归；where 不触碰 orderBy 词表（readArray 仍仅 `by:'index'`） | 行为 | §12.3.7 F1–F6、§12.3.3 V18 |
| AC8 缝 1 测试先例（#368 家族同款）+ 全仓 typecheck/测试绿 | 测试路径 + 门 | §12.5、§12.6、§14 |

### 12.3 行为契约

Fixture 统一为 `FIX-382-A`（`buildWhereDoc()`；断言全部可判定、零随机）：

```
ROOT
├─ tasks        Y.Map: t1{state:'claimed',priority:2} t2{done,9} t3{claimed,5} t4{open,7} t5{claimed,1}
│                     （child 均 Y.Map，另带 title；默认 orderBy = key asc、字段下钻恰一次）
├─ plainTasks   plain object：同 5 键 plain 记录（plain 载体族）
├─ list         Y.Array: [claimed(2), done(9), claimed(5)]（child Y.Map；index 基位置序）
├─ plainList    plain array：同 3 条 plain 记录
├─ scalarArray  Y.Array: [1,2,3]；scalarPlain plain array [1,2,3]
├─ edge         Y.Map: e0{state:'',flag:false,count:0} e1{state:'x',flag:true,count:1}
├─ dotted       Y.Map: c1{'a.b':'v'} c2{a:{b:'v'}}
├─ emptyKey     Y.Map: k{'' : 'v'}（字段名空串合法字面键）
├─ dirty        Y.Map（安静不匹配矩阵，见 §12.3.2）
├─ poisonArr    Y.Array: [NaN×1998, claimed(1), claimed(2)]
├─ poisonMap    Y.Map: p0..p1997 = NaN，p1998/p1999 = claimed 记录
├─ sparseArr    plain array：length 1998 全空洞，[1998]=claimed，[1999]=claimed
├─ poisonRecArr plain array: [{state:'done',payload:NaN}×1998, claimed(1), claimed(2)]（未匹配条目内埋毒）
├─ poisonPayloadMap plain object: p0..p1997={state:'done',payload:NaN}，m1/m2=claimed（键面同款）
├─ poisonHoleArr plain array: [{state:'done',inner:[<hole>,1]}×1998, claimed(1), claimed(2)]（嵌套空洞）
├─ poisonScored Y.Array: [30,10,NaN×1998]（无 where 哨兵，NC3）
├─ emptyMap     Y.Map；emptyPlain {}
└─ undefKey     Y.Map: u1('state' 显式 set undefined) u2{state:'claimed'}（条目空间语义回归锚）
```

记号：下文 `…claimed` = `{field:'state',equals:'claimed'}`；`t3(5)` = 记录 key `t3`、`priority` 值 5。

#### 12.3.1 合取正确性矩阵（AC1；HEAD 红 → 目标绿）

| # | 最小输入 | 可观察断言（目标） |
|---|---|---|
| C1 | `readMap(['tasks'], {n:5, where:[{field:'state',equals:'claimed'}]})` | `ok:true`；条目 key 依次 `t1,t3,t5`；`value[i].value.state === 'claimed'`；`total` 在场且 `undefined`；own 键集恰 `{ok,total,value}` |
| C2 | `readMap(['plainTasks'], …C1 同参)` | 同 C1（plain object 载体族同构） |
| C3 | `readArray(['list'], {n:5, where:[…claimed]})` | `ok:true`；条目 index 依次 `0,2`（位置序）；`total === undefined` |
| C4 | `readArray(['plainList'], …C3 同参)` | 同 C3（plain array 载体族同构） |
| C5 | `readMap(['edge'], {n:5, where:[{field:'state',equals:''}]})`；`equals false`；`equals 0` | 依次 1 条 `e0`（falsy 合法标量；防「truthiness 校验」变异） |
| C6 | `readMap(['edge'], {n:5, where:[{field:'flag',equals:true}]})`；`equals 1` | 1 条 `e1` |
| C7 | `readMap(['dotted'], {n:5, where:[{field:'a.b',equals:'v'}]})`；再 `field:'b'` | 首者恰 `c1`（点号不拆分）；后者 0 条（AND 视角） |
| C8 | `readArray(['list'], {n:2, where:[…claimed], orderBy:{field:'state'}})`；`orderBy:{by:'key'}`；`readMap(['tasks'], …orderBy:{by:'index'})` | 三向均 `WINDOW_OPTIONS_INVALID`（面词表不因 where 放宽；F4） |
| C9 | `readMap(['emptyKey'], {n:5, where:[{field:'',equals:'v'}]})` | `ok:true`，恰 1 条（空串字段名合法） |
| C10 | null-proto WhereTerm（`Object.assign(Object.create(null), {field:'state',equals:'claimed'})`） | `ok:true`，同 C1（plain 链含 null 原型；ADR 0029 §6） |
| C11 | `readMap(['undefKey'], {n:5, where:[{field:'state',equals:'claimed'}]})` | `ok:true`，恰 `u2`（`u1` 的 `state` 显式 undefined ≡ 缺席 → 安静不匹配） |

#### 12.3.2 安静不匹配矩阵（AC2；HEAD 红 → 目标绿）

`dirty` 装载：`d1{done}`、`d2{claimed}`（唯一 claimed 正常命中）、`sNum=42`、`sStr='claimed'`、`sNull=null`、
`sBool=true`、`sArr=[1,2]`、`nanState{state:NaN}`、`infState{state:+∞}`、`nInfState{state:-∞}`、
`cym{state:Y.Map{}}`、`cpo{state:{x:1}}`、`carr{state:[1,2]}`、`nullState{state:null}`、`nullState2{state:null}`、
`absentState{title:'x'}`（无 state 键）、`undefState{state:undefined}`、
`accField`（plain object：own accessor `state`（getter 计数并对 'claimed' 返回）＋ non-enumerable `state2`）。

| # | 最小输入 | 可观察断言（目标） |
|---|---|---|
| D1 | `readMap(['dirty'], {n:50, where:[{field:'state',equals:'claimed'}]})` | `ok:true`；恰 `d2` 一条；脏条目零挤出（n=50 > 全部候选，排除截断巧合） |
| D2 | 同上但 `equals:'done'` | 恰 `d1`（`sStr='claimed'` 标量条目不匹配任何 equals） |
| D3 | `equals:null` | 恰 `nullState, nullState2`（在场 null 匹配）；`absentState`/`undefState` **不**匹配；`sNull` 标量条目不匹配 |
| D4 | `equals:'claimed'` 于 `nanState/infState/nInfState` | 三者均不匹配（field 值 non-finite → 安静） |
| D5 | `equals:'claimed'` 于 `cym/cpo/carr` | 三者均不匹配（field 值非标量 → 安静） |
| D6 | `equals:'claimed'` 于 `sNum/sStr/sNull/sBool/sArr` | 五者均不匹配（条目值非可下钻对象 → 安静） |
| D7 | `accField`：读 `dirty` 后断言 accessor 计数器 | `accField` 安静不匹配 ∧ 计数器 `=== 0`（零 accessor 执行）；`state2` non-enumerable 不参与 |
| D8 | `readArray(['scalarArray'], {n:5, where:[{field:'state',equals:'claimed'}]})` | `ok:true, value: []`（标量元素数组面 = 全安静不匹配，不响亮） |
| D9 | `readArray(['sparseArr'], {n:5, where:[{field:'state',equals:'claimed'}]})` | `ok:true`；恰 index `1998,1999`；空洞安静跳过、不物化（AC5） |
| D10 | `readMap(['emptyMap'], …)`；`readMap(['emptyPlain'], …)` | 均 `ok:true, value: []` |
| D11 | `readMap(['dirty'], {n:50, where:[{field:'state',equals:'claimed'},{field:'state',equals:'done'}]})` | `ok:true, value: []`（同 field 重复项 AND 收敛，**不响亮**） |
| D12 | 四载体 ×（0 匹配）：`scalarArray`/`scalarPlain`（标量元素）/`dirty` + `equals:'nonexistent'`（值不存在） /`emptyMap`/`emptyPlain` | 全 `ok:true` + `value: []` + `total: undefined` |

#### 12.3.3 入参侧响亮（AC3/AC4；**HEAD 伪绿**——同码不同因，仅作实现后变异守卫）

目标一律 `ok:false, code:'WINDOW_OPTIONS_INVALID'`，且零外抛、零 `[[Get]]`、零 accessor 执行。

| # | 最小输入（options.where / 相邻面） | 备注 |
|---|---|---|
| V1 | `where: []` | 空数组非法（「要全集」= 不传 where） |
| V2 | `where`: 17 项 | 超上限 16 |
| V3 | `where`: **恰 16 项**（distinct 字段） | **反向边界**：必须**不**响亮 → `ok:true, value: []`（证明校验器不是「见 where 即拒」） |
| V4 | `equals: NaN` / `+Infinity` / `-Infinity` | `typeof number` 但 `!Number.isFinite` → 响亮 |
| V5 | `equals: {}` / `[1]` / `1n` / `Symbol()` / `() => 1` / `new Date(0)` / `new Map()` | 闭集外类型 → 响亮 |
| V6 | `equals` 缺失 / `equals: undefined`（显式） | 形状漂移 → 响亮 |
| V7 | `field` 缺失 / `field: undefined` | 形状漂移 → 响亮 |
| V8 | `field: 1` / `field: Symbol()` / `field: {toString(){throw}}` | 非 string → 响亮；**零强制转换**（不得调 `toString`） |
| V9 | 未知键：`{field, equals, extra: 1}`；`{field, equals, extra: undefined}` | 键集白名单**恰两键**（未知键在场即响亮，含 undefined 值） |
| V10 | WhereTerm 非 plain 原型：class 实例 / 数组 / `new Map()` / 函数 | 原型链纪律 → 响亮 |
| V11 | `where` 数组下标 accessor（`defineProperty(arr, 0, {get(){counter++}})`） | 响亮 ∧ 计数器 `=== 0` |
| V12 | `where` 数组含空洞（`const a=[]; a.length=1`） | 响亮（非 undefined continue） |
| V13 | WhereTerm Proxy：`get`/`ownKeys`/`getOwnPropertyDescriptor`/`getPrototypeOf` 抛 trap | 响亮 ∧ 零外抛 |
| V14 | options Proxy：同上四 trap 抛 | 响亮 ∧ 零外抛 |
| V15 | `options.where` 为 own accessor（getter 抛/计数） | 响亮 ∧ 计数器 `=== 0`（零 `[[Get]]`） |
| V16 | `where` 非数组：`'claimed'` / `{…}` / `null` / `42` / `[undefined]` / `[null]` / Y.Array 实例 | 响亮 |
| V17 | `n` 非法（缺失/0/-0/-1/1.5/NaN/Infinity/'1'）+ **合法 where** | 响亮（n 纪律不因 where 放宽） |
| V18 | where + 语境外 orderBy：`readArray` 传 `field` 或 `by:'key'`；`readMap` 传 `by:'index'` | 响亮（F4；where 与排序正交） |
| V19 | 顶层未知键 + 合法 where（如 `{n, where, bogus:1}`） | 响亮（options 封闭形状不回退） |
| V20 | `where: undefined`（own key、值 undefined） | **反向**：≡ 缺席 → `ok:true`，无过滤、`total` 为数值（与既有「present-undefined ≡ 缺席」纪律一致，防键集白名单回归把合法调用拒掉）。注意：该豁免只作用于**顶层 options 已知轴**；WhereTerm 内部「恰两键」白名单不豁免 present-undefined（V9，沿 `validateOrderBy` 先例） |
| V21 | `readMap(['nope'], {n:1, where: []})`（非法 where + 缺席路径） | `WINDOW_OPTIONS_INVALID`（OPT 先于 N0/N1：options 校验零 doc 触碰，**不**得先报 `WINDOW_TARGET_ABSENT`；与 F1 的合法 where 变体成对） |

> **伪绿登记（必须写进实现后复核）**：V1/V2/V4–V19/V21 在 HEAD 亦得 `WINDOW_OPTIONS_INVALID`（因「未知键」
> 而非因 where 形状校验）。它们**不能**充当红灯证据；其价值只在实现后充当变异守卫（见 §12.7）。
> 真正的红证据由 C/D/P/T/Z 组与类型面 Y 组承担；V3/V20 是唯一在 HEAD 红（或行为不同）的响亮面反向边界。

#### 12.3.4 管线序 where → orderBy → n（ADR 0029 §4；HEAD 红 → 目标绿）

| # | 最小输入 | 可观察断言（目标） |
|---|---|---|
| P1 | `readMap(['tasks'], {n:2, where:[…claimed], orderBy:{field:'priority',dir:'desc'}})` | 条目 `t3(5), t1(2)`（匹配集总序前缀）；「排序→取 n→过滤」变异必红（会得 `[]` 或 t2/t4） |
| P2 | `readMap(['tasks'], {n:3, where:[…claimed], orderBy:{field:'priority',dir:'asc'}})` | `t5(1), t1(2), t3(5)`（dir 只翻组内序、平局锚 key asc 恒定） |
| P3 | `readArray(['list'], {n:1, where:[…claimed], orderBy:{by:'index',dir:'desc'}})` | 恰 index `2`（位置序 desc 的匹配前缀） |
| P4 | `readMap(['tasks'], {n:5, where:[{field:'state',equals:'claimed'},{field:'priority',equals:5}]})` | 恰 `t3`（合取跨字段） |
| P5 | `readMap(['tasks'], {n:5, where:[…claimed]})` vs `{n:1}` vs `{n:99}` | 匹配集相同、前缀长度 `min(n, matches)`；`total` 三向恒 `undefined`；`value.length` 分别 3/1/3 |

#### 12.3.5 `total` 双形态（AC6；HEAD 红 → 目标绿）

| # | 最小输入 | 可观察断言 |
|---|---|---|
| T1 | 无 where：`readMap(['tasks'],{n:5})`；`{n:2}` | own 键集恰 `{ok,total,value}`；`total === 5`（独立预言机 = 非 undefined 值键数）；`value.length === min(n,total)` |
| T2 | 无 where：`readArray(['list'],{n:5})`；`{n:2,orderBy:{by:'index',dir:'desc'}}` | `total === 3`；desc 条目 `2,1`（位置序） |
| T3 | 无 where：`readArray(['poisonScored'],{n:2})` | `ok:true`；`total === 2000`；`value.length === 2`（零物化，NC3 同锚） |
| T4 | 有 where：C1（matches ≥ n） | `Object.prototype.hasOwnProperty.call(r,'total') === true` ∧ `r.total === undefined`；禁止用 JSON 快照判定（`JSON.stringify` 丢 undefined 键——反伪绿要点） |
| T5 | 有 where：matches < n（C1 n=5 时 3 条、D12 0 条） | 同样 `total` own 键在场且 `undefined`（**恒不承诺**；不得返回匹配计数） |
| T6 | 有 where成功面 | own 键集恰 `{ok,total,value}`（无 `truncated`/`schema`/过滤槽；B-8；缝 2 才谈 ✂） |

#### 12.3.6 零物化哨兵（AC5；HEAD 红 → 目标绿）

| # | 最小输入 | 可观察断言（目标） |
|---|---|---|
| Z1 | `readArray(['poisonArr'], {n:5, where:[…claimed]})` | `ok:true`；恰 index `1998,1999`；前 1998 个 NaN 标量条目零物化（「全量物化再过滤」实现 → `PATH_NOT_ALLOWED` 必红） |
| Z2 | `readMap(['poisonMap'], {n:5, where:[…claimed]})` | `ok:true`；恰 `p1998,p1999` |
| Z3 | `readArray(['sparseArr'], {n:5, where:[…claimed]})` | `ok:true`；恰 `1998,1999`（空洞毒值未触） |
| Z4 | `readMap(['poisonMap'], {n:5, where:[{field:'state',equals:'done'}]})` | `ok:true, value: []`（全不匹配时同样零物化；NaN 值键不炸读） |
| Z5 | 规模 N=2000 与 n=2/5 两向（Z1 变体） | `ok:true`、命中数正确；成本纪律：不得出现「为拿匹配总数而扫到底再物化入选」的可观测失败（与 T4 同锚） |
| Z6 | `readArray(['poisonRecArr'], {n:5, where:[…claimed]})` | `ok:true`；恰 `1998,1999`——**未匹配条目内埋** non-finite（`payload:NaN`，谓词不触及的字段）：全量物化/整项深读的实现必红 |
| Z7 | `readMap(['poisonPayloadMap'], {n:5, where:[…claimed]})` | `ok:true`；恰 `m1,m2`（键面同款「未匹配条目内埋毒值」） |
| Z8 | `readArray(['poisonHoleArr'], {n:5, where:[…claimed]})` | `ok:true`；恰 `1998,1999`——未匹配条目**递归内埋稀疏空洞**（谓词只下钻 `state` 单段，绝不整项物化/递归） |

#### 12.3.7 失败码与冻结面（AC7；必须保持绿）

| # | 断言 | HEAD 证据 |
|---|---|---|
| F1 | `WINDOW_TARGET_ABSENT`：终点缺键/中间缺键/数组越界（含带合法 where 时）——缺席响亮、不被 where 吸收 | 探针 D2 PASS；新增：`readMap(['nope'],{n:1,where:[…]})` 目标仍 `WINDOW_TARGET_ABSENT`（where 合法不得改变缺口码；**新用例**） |
| F2 | `WINDOW_CARRIER_MISMATCH`：数组面收 Y.Map/plain object/标量；键面收 Y.Array/plain array（同样在 where 在场时优先于过滤） | 探针 D3/D4 PASS；扩展 where 在场变体 |
| F3 | `WINDOW_OPTIONS_INVALID`：where 全部形状非法（V 组）+ `n`/orderBy 既有非法面不回归 | 探针 D5/D6、V 组 |
| F4 | `PATH_NOT_ALLOWED` 透传：入选项物化失败（如命中项内是 detached 载体）在 where 在场时仍 fail-fast、path 精确到项、无半窗 | #368 pins P1/P6b 绿；新增 where 变体 |
| F5 | 失败面形状：恰四键、无 `value`/`total`/`truncated` | 探针 D2–D6 PASS |
| F6 | 三码互异、各就各位（同一调用位置恰得对应码） | #368 W1-G8 绿 |
| F7 | **lease 面中间态响亮（SA8 A2）**：`lease.readMap/readArray(…, {n, where})` → `ok:false, code:'WINDOW_OPTIONS_INVALID'`（不得静默通过、不得回落到未过滤四键成功面）；无 where 基线四键 + `truncated === kept < total` 不变 | 探针 E5 实测（§6 NC11）；缝 2 落地后此条预期改变（§15-O4） |

#### 12.3.8 类型面与公共导出（A3/AC8）

| # | 断言（编译期；`vitest --typecheck` 采集 `.test-d.ts`） | HEAD |
|---|---|---|
| Y1 | `import type { WhereTerm } from '../src/index.js'` 可导入（TS2305 消失） | 红（TS2305） |
| Y2 | 两面 options 接受 `where: [{field:'state',equals:'claimed'}]`（对象字面量直传，TS2353 消失）；`where` 投影 = `readonly WhereTerm[] \| undefined` | 红（TS2353/TS2339） |
| Y3 | 成功面 `Extract<ReadArrayWindowResult,{ok:true}>['total']` 与 map 同款 = `number \| undefined`（TS2344 消失）；own 键集恰 `{ok,total,value}`（#381 既有键集锁不变） | 红（TS2344 ×2） |
| Y4 | 编译期负例 fail-closed（`@ts-expect-error` 真实报错）：`equals` 闭集外（对象/数组）、WhereTerm 未知键、`where` 非数组、语境外 orderBy | 不可判（WhereTerm 尚不存在）；实现后必须绿 |
| Y5 | 公共值导出面：`Object.keys(ns)` 中 `/Window/` 恰两枚值导出；`WhereTerm` 为 type-only（运行时键空间零新增） | 绿（P-W1/P-W2） |

### 12.4 迁移契约（本票自身引起的既有测试/类型面变更；其余零改动）

| # | 位置 | 动作 |
|---|---|---|
| M1 | `packages/doc-runtime/test/public-surface-type-guard.test-d.ts` L214–216 | `total` 类型锁 `number` → **`number \| undefined`**（ADR 0029 §5；不迁移则实现后该行 TS2344 红——这正是类型面变更的自证） |
| M2 | 同文件 L25–57 导入区 + L77–90 声明区 | 增 `WhereTerm` 导入与投影断言（Y1/Y2；纳公共面守卫记账，A3） |
| M3 | `packages/doc-runtime/test/issue-368-window-read-contract-red.test.ts` 头注 B-5（L29–33） | 注释级同步（「B-5 不锁键集；成功面恰三键由 P7/类型锁承载；#382 起 `total` 值域加宽」）——非断言 |
| M4 | `issue-368-*.test.ts`、`issue-381-window-total-red.test.ts`、`public-surface-guard.test.ts`、`#369` 组合/lease 测试、`issue-369-window-read-lease-surface.test-d.ts` L43–44 | **零改动**：无 where 调用的期望（三键、键集、total 数值、词表、别名等价）在 where 缺席语义下全部不变；若出现红，先报设计修订，不得就地改软 |
| M5 | `packages/namespace-runtime/src/runtime.ts` L691/L703 + `window-read.ts` 消费签名 | `total` 加宽后必须在消费边界**显式**分支（响亮失败或缝 2 语义），禁 `total ?? 0`、`as number`、静默兜底；`pnpm typecheck` 是机械门 |

### 12.5 测试路径与红线（本轮未创建；供实现票落地）

| # | 路径 | 动作 |
|---|---|---|
| P1 | `packages/doc-runtime/test/issue-382-where-window-contract-red.test.ts`（推荐新文件） | §12.3.1–§12.3.7 全部用例组（C/D/V/P/T/Z/F），同 #368 家族风格：`import * as docRuntime` 绑定 + 运行时行为断言 + 独立预言机 + 负控组 |
| P2 | `packages/doc-runtime/test/issue-382-where-window-type-guard.test-d.ts`（推荐新文件；或并入 `public-surface-type-guard.test-d.ts`） | §12.3.8 Y1–Y4 |
| P3 | `packages/doc-runtime/test/public-surface-type-guard.test-d.ts` | M1/M2 迁移 |
| P4 | `packages/namespace-registry/test/issue-382-lease-where-no-silent-pass.test.ts`（可选） | NC11 的**耐久形态**：条件不变式——lease where 调用若 `ok:true`，则返回条目必须全部满足谓词（禁止静默未过滤通过）；若 `ok:false` 则码必须是 `WINDOW_OPTIONS_INVALID`。此形态在缝 1/缝 2 两态都真，无退役义务；严格的「缝 1 后必须 ok:false」仅作为实现期审计证据（§12.3.7 F7），不写成会随缝 2 变红的持久测试 |
| P5 | `packages/namespace-runtime/test/**`、`packages/namespace-registry/test/issue-369-*.test.ts` | **零改动**（回归面） |
| P6 | 结构审计输出（§12.6） | 记入实现票/复核票 artifacts |

**边界与非目标（不得越界）**：不改 `read.ts`；不改 `readData`/预算四键；不改 lease 四键/`truncated`/✂ 文法；
不新增公共值导出或第四读方法；不实现缝 2（lease where 接收、truncated 双语义、✂ 永不装配）；
不实现 in/范围/OR/NOT/多段 field/容器深相等（A1）。

### 12.6 结构契约（结构性审计，非行为测试，不得替代行为断言）

| # | 审计 | 期望 |
|---|---|---|
| S1 | `git diff --stat -- packages/doc-runtime/src/read.ts`；sha256 | 空 diff；sha256 仍 `3bf6b8b0…b1b312`；`copied from read.ts@36a73bb` 标记数不减 |
| S2 | 过滤落点：`window.ts` 原地（C/E 枚举后、S 排序前）；无新读路径/模块/memo/订阅 | ADR 0029 §4/§8；`grep` 新文件零命中（结构性证据，不作行为断言） |
| S3 | 无 where 分支逐字节：C/E/S/A 的既有输出与 #381 基线一致（total/序/条目列表） | §6 NC1–NC3 + §12.3.5 T1–T3 |
| S4 | lease 中间态：S3 白名单不得被本票放宽绕过（A2） | §12.3.7 F7 审计证据 |

### 12.7 敏感度与反伪绿防线

| 变异（实现后植入即应被击穿） | 击穿用例 | 依据 |
|---|---|---|
| 接受 `where` 但忽略（不筛选） | C1–C4、P1–P5、D1/D3 | E3 反事实（无 where 结果 ≠ 目标） |
| 见 `where` 即拒（未实现词表） | C1–C11、V3、V20 | HEAD 现状的镜像 |
| 接受但不校验（空数组/超限/非 finite/闭集外/未知键/非 plain/hole/accessor/Proxy 直接放行） | V1–V21 | ADR 0029 §2/§3/§6 |
| 全量物化后再过滤 | Z1–Z4、Z6–Z8 | ADR 0028 §8 × ADR 0029 §3 |
| 谓词下钻走整项深读/递归（而非单段） | Z6–Z8 | ADR 0029 §4/§6（单段下钻；未匹配零物化） |
| orderBy → 取 n → 再过滤（管线错序） | P1 | ADR 0029 §4 |
| 有 where 时 `total` = 匹配计数 / 键缺席 / `null` | T4–T6 | ADR 0029 §5 |
| 有 where 时回落到 `?? 0` / 静默未过滤 | T4–T6、F7 | SA8 A2 |
| readArray 面放宽 orderBy 词表以「顺便支持」过滤 | C8、V18 | ADR 0029 §4 |
| `where` 渗入 readData options / 预算轴 | NC4 | ADR 0024/0027/0029 §1 |
| 以 truthiness 校验 `equals`（拒 `''`/`0`/`false`/`null`） | C5、D2、T 组 | ADR 0029 §2 闭集含 falsy |
| 下钻走 `[[Get]]`/执行 accessor | D7、V11、V15 | ADR 0029 §6 |
| 期望与实际同源派生（伪绿） | 纪律：全部期望由独立预言机（Yjs/native 直数）派生；`total` 判定用 `hasOwnProperty` 而非 JSON | #381 §12.8 先例 |
| 以 skip/only/todo/env override/fallback/吞错软化 | 纪律：禁止（§12 契约纪律） | 诊断与契约 skill |

### 12.8 Red/green 判定

- **C/D/P/T/Z 组与 Y1–Y3 在 HEAD 红**（红因 = 词表位缺席 + `total` 值域未扩，实证 §5）；目标实现后绿。
- **V 组（除 V3/V20）在 HEAD 绿但为「伪绿」**（同码不同因）：只作实现后变异守卫，不充当红证据（§12.3.3 登记）。
- **V3/V20 在 HEAD 红/行为不同**（HEAD 均 `WINDOW_OPTIONS_INVALID`）：实现后必须 `ok:true`——校验器正确性的反向边界。
- **F 组与 NC 组在 HEAD 绿**，目标实现后**必须仍绿**；其中 F7（lease 中间态）在缝 2 落地前必须绿。
- **M1 是「实现后必须同步迁移」项**：迁移前 `total: number` 锁会因值域加宽而红——这是形状变更的自证，不是回归。
- **全仓门（AC8）**：目标实现后 `pnpm typecheck` 与 `pnpm test` exit 0。

---

## 13. Red/green evidence

| 证据 | 命令/位置 | 结果 |
|---|---|---|
| HEAD 行为红基线（A/B/C/D 全表） | `__sa6_382_probe.mts`（tsx；输出 `/tmp/sa6-382-probe.out`） | 合法 where 全 `WINDOW_OPTIONS_INVALID`；无 where 面三键/total 计数/零物化/确定性全 PASS |
| 独立预言机期望 | `__sa6_382_oracle_probe.mts`（输出 `/tmp/sa6-382-oracle-probe.out`） | oracle `t1\|t3\|t5` 等 8 组 vs HEAD `DIFF`；反事实 ignore-where `t1\|t2…` ≠ 目标 |
| HEAD 类型层红基线 | `__sa6_382_type_probe.ts` + `tsc -p packages/doc-runtime/tsconfig.json --noEmit` | TS2305/TS2353×2/TS2339/TS2344×2；删除探针后 exit 0 |
| lease 中间态（SA8 A2） | `__sa6_382_lease_probe.mts`（输出 `/tmp/sa6-382-lease-probe.out`） | lease where → `WINDOW_OPTIONS_INVALID`（两方法）；无 where 四键 `[ok,schema,truncated,value]`、`truncated=true` |
| 既有窗口家族基线（8 文件） | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run <8 文件>` | 8 passed / **144 tests** / `Type Errors no errors`；7.34s |
| 全仓基线（实现前） | `pnpm test` | **393 文件 / 4745 用例全绿**；`Type Errors no errors`；599.68s；exit 0 |
| 全仓基线（实现前） | `pnpm typecheck` | exit 0（14 个 tsc 工程；输出 `/tmp/sa6-382-typecheck.out`） |
| 冻结面 | `git diff --stat -- packages/doc-runtime/src/read.ts`；sha256 | 空 diff；`3bf6b8b0…b1b312` |
| 期望实现后的绿面 | §12.3 全部目标断言 + §12.4 迁移 + 全仓门 | 待实现票执行（本票不实现） |

## 14. Runner trigger evidence

| 运行器入口 | 命令 | 实测 |
|---|---|---|
| 聚焦（本 ticket 家族） | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/doc-runtime/test/issue-368-window-read-contract-red.test.ts packages/doc-runtime/test/issue-368-window-read-design-pins.test.ts packages/doc-runtime/test/issue-381-window-total-red.test.ts packages/doc-runtime/test/public-surface-guard.test.ts packages/doc-runtime/test/public-surface-type-guard.test-d.ts packages/namespace-runtime/test/issue-369-window-read-composition-red.test.ts packages/namespace-registry/test/issue-369-window-read-lease-contract-red.test.ts packages/namespace-registry/test/issue-369-window-read-lease-surface.test-d.ts` | 8 文件 / 144 用例绿；`✓ TS` 16；`Type Errors no errors`；7.34s（exit 0） |
| 全仓门（AC8） | `pnpm typecheck`；`pnpm test` | `pnpm test` = 393 文件 / 4745 用例 / no type errors / 599.68s / exit 0；`pnpm typecheck` exit 0 |
| 采集规则 | `vitest.config.ts` include `packages/*/test/**/*.test.ts`；typecheck.include `packages/*/test/**/*.test-d.ts`（tsconfig `./tsconfig.typecheck.json`）；`maxWorkers: 1` | 新文件按既有命名（`issue-382-*-red.test.ts` / `*.test-d.ts`）自动被采集，无需改配置 |
| 别名/条件 | `NODE_OPTIONS=--conditions=nomicore-source` + vitest alias `@nomicore/*` → `src/index.ts` | 源码态运行；探针与测试同一解析链 |
| 家族风格对齐（#368 先例） | `expectWindowOk`/`expectWindowErr` 形态（只锁 `ok`/`code`，键集锁由 pins P7 + 类型锁承载）；fixture builder + 四载体矩阵；独立预言机组；NC 组「毒值哨兵有牙」 | `issue-368-window-read-contract-red.test.ts` L68–117、L794+；`issue-368-window-read-design-pins.test.ts` P7 L325–338 |

## 15. Unknowns and blockers

- **O1（实现自由，不阻塞）**：16 上限是「实现票可调的哨兵值」（ADR 0029 §2）——本契约按简报 AC3 钉死
  「16 合法 / 17 非法」；若实现票想改哨兵需先改 ADR/简报口径，不得静默偏离。
- **O2（实现自由，不阻塞）**：where 校验助手命名/位置（OPT 阶段内）、message 文本、内部结算字段名——
  不影响任何可观察断言（message 非契约字段）。
- **O3（实现自由，不阻塞）**：短路实现方式（流式扫描 vs 枚举后过滤）——只要可观测结果相符且不引入
  第二读路径/静默通道；§7 已说明短路不可行为断言。
- **O4（缝 2 边界，不阻塞本票）**：lease where 接收、`truncated` 双语义、✂ 有 where 永不装配属缝 2；
  本票必须保持中间态响亮（F7）。缝 2 落地时 F7 的严格断言（ok:false）预期改变——P4 给出无退役义务的
  条件不变式形态，避免留下会腐烂的测试。
- **O5（非阻断）**：`accField`（accessor field 安静不匹配 + 零执行）与稀疏空洞**作为候选条目本身**
  的安静处置，由 ADR 0029 §3 安静不匹配纪律 + §6 零 accessor 执行 + AC5 共同支撑；若实现票认为
  「空洞候选」应响亮，须先报设计问题（不得就地弱化 D9/Z3）。
- **无阻塞项**：能力缺口稳定复现（探针 + 类型探针双向）、契约红在正确原因、负控全绿、
  运行器真实可触发、修复范围自足（无 owner 决策需求）。

## 16. Temporary diagnostics cleanup

| 临时物 | 位置 | 清理 |
|---|---|---|
| 行为探针 `__sa6_382_probe.mts` | `packages/doc-runtime/test/` | `rm` 删除；输出留存 `/tmp/sa6-382-probe.out`（非仓内） |
| 预言机探针 `__sa6_382_oracle_probe.mts` | `packages/doc-runtime/test/` | `rm` 删除；输出 `/tmp/sa6-382-oracle-probe.out` |
| 类型探针 `__sa6_382_type_probe.ts` | `packages/doc-runtime/test/` | `rm` 删除；删除后 `tsc -p packages/doc-runtime/tsconfig.json --noEmit` **exit 0** |
| lease 探针 `__sa6_382_lease_probe.mts` | `packages/namespace-registry/test/` | `rm` 删除；lease `release()` 已调用；无遗留进程/timer |
| 生产实现 | — | **零修改**（dispatch 明令）；`git status --porcelain` 仅 Host 三件 + 本报告 |
| 依赖安装 | `node_modules/`（gitignored） | 保留（运行器需要）；无仓内跟踪物 |

清理复核：`ls packages/doc-runtime/test | grep sa6_382` 与 `ls packages/namespace-registry/test | grep sa6_382`
均无命中；`git status --porcelain` 无生产/测试文件改动；`git diff --stat`（除本报告外）为空。

---

## Verdict

**`approve`**。

理由：① 能力缺口在 HEAD 稳定复现（行为探针 A/C 组 + 类型探针六处编译红），红因 = `where` 词表位与
`total` 值域未扩，**不是**环境/fixture/入口问题（同探针负控全绿、独立预言机派生期望、`read.ts` 零 diff）；
② 契约把 AC1–AC8 与 ADR 0029 §1–§8、SA8 A1–A5 / F1–F8 转成可执行断言面：合取矩阵、安静不匹配矩阵、
入参响亮矩阵、管线序、`total` 双形态、零物化哨兵、三码冻结面、类型面 fail-closed、公共导出守卫，
并给出迁移契约（M1–M5）与结构审计（S1–S4）；③ 负控在 HEAD 全绿且实现后必须保持；④ 反伪绿防线明确：
期望由独立预言机派生、V 组伪绿登记在案、伪红（短路的 trap 观测）被排除、禁止软化手段；
⑤ 运行器真实可触发（聚焦 8 文件 144 用例已实跑 + 全仓门），`where` 中间态（lease 响亮）与缝序
约束已按 SA8 A2 处置，无悬空开放问题。
