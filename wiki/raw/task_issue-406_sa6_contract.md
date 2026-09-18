# SA6 诊断与验收契约 — Issue #406 窗口面同轴：`readArray` / `readMap` 的 `maxBytes`

- 任务类型：**Feature**（能力缺口型；无既有运行时故障，缺的是窗口面预算闸）
- Issue：`nomicore-ai/nomicore#406`「窗口面同轴：readArray/readMap 的 maxBytes」（State: open）
- 父票：`#405` `readData` 面 tracer（已落地：HEAD `56cf542`）
- 设计依据：`docs/adr/0031-readdata-byte-budget.md`（决策 1/2/3/4/5；`readData`/`readArray`/`readMap` 三读面）
- 执行者：SA6（acceptance-contract，iteration 0）；worktree `mabf/issue-406`

## 0. 修订记录

| rev | 内容 |
|---|---|
| rev1（本版） | 首版。HEAD 实测能力缺口、18 锚冻结表、参考闸门 + 6 变异体反证、六份契约测试落盘（runtime 红/控制/类型 + registry 红/类型 + lease fixture）、既有别名锁原位延伸（`Omit` 中继）、完整证据日志。 |

## Verdict

**approve**。窗口面 `maxBytes` 能力缺口稳定复现（红因单一：`maxBytes` ≡ W1 未知键），
根因归因完整（组合层缺预算校验/度量/失败分支三级），18 锚冻结、参考闸门 18/18 全绿
（目标语义可满足）、6 个变异体各被 ≥1 条判据击穿（断言敏感），契约测试被仓库真实
vitest 入口发现且旧实现按预期红、负控按预期绿。唯一挂账为文档重录（OBL-DOC-406-1，
非阻塞；不影响契约可执行性）。

## 1. 任务类型与输入

**类型 = Feature**：Issue 要求给两个窗口读面追加与 `readData` 同形的 `maxBytes` 交付总量
收/拒闸。HEAD 上并不存在「窗口读返回了错误的预算结果」这类故障；存在的是**能力不存在**
（携带 `maxBytes` 的任何调用都在 options 键空间门被拒）。因此契约形态 = 能力缺口证明 +
目标行为验收契约（不虚构 Bug 根因）。

输入清单（固定路径）：

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-406.md`（Host task brief） | **在场**（Issue 正文 + AC1–AC7 + Blocked by #405） |
| `wiki/raw/task_issue-406_relevant_decisions.md` | **缺席**（Host 未提供） |
| `wiki/raw/task_issue-406_conflict_report.md` / `task_issue-406_design.md`（SA8 产物） | **缺席**；SA8 门禁尚未运行（§3） |
| `wiki/raw/task_issue-405_design.md`、`task_issue-405_relevant_decisions.md`、`task_issue-405_design_conflict_report.md`、`task_issue-405_sa6_contract.md` | 在场（父票设计/裁决/契约；本票继承其分层与同文义务） |
| `docs/adr/0031-readdata-byte-budget.md` | 在场（三读面权威依据） |
| `CONTEXT.md`「字节预算」「窗口读」「过滤窗口」词条 | 在场（L53–L54、L65–L67、L69–L71；L54 已声明三读面） |
| 既有 `#405` 实现 + 测试（`issue-405-*`） | 在场（HEAD `56cf542`；本票的镜像对象与文案来源） |

缺失输入不阻塞：任务简报 + ADR + 源码 + 父票 SA8/SA6 产物足以完成复现、根因归因与契约建立
（§15 记录 SA8 缺位的影响）。

## 2. Owner 评论映射

无 owner 评论。REST Issue-comment 快照为空（`[]`）——不存在评论来源的 override、豁免或
附加义务。契约全部义务 = Issue #406 AC1–AC7 + ADR 0031 决策 1–6 与其「验收」节 +
父票 SA8 遗留义务（OBL-WIN-1；§3）+ `CONTEXT.md` 三词条；映射见 §12.1。

## 3. SA8 约束采纳

SA8 本票产物缺席（无 `task_issue-406_design.md` / `_conflict_report.md`）；可继承的 SA8 约束
来自父票 `#405`（`task_issue-405_design_conflict_report.md`，verdict `reject`，hard conflict 0）
的 required actions：

| RA | 内容 | 本契约处置 |
|---|---|---|
| **RA-4 / OBL-WIN-1**（父票挂账，本票兑现对象） | 窗口面三面义务：`readArray`/`readMap` 的 `maxBytes`（决策 2 窗口同构度量、同码同文同载荷形、`WINDOW_OPTIONS_INVALID` 负控）；message 措辞须**镜像** `readData` 面选定文案 | **本契约直接兑现**：G4 冻结度量等式；G3 三面同码同文同载荷断言（模板 = `readData` 现行文案，逐字节）；G5 `WINDOW_OPTIONS_INVALID` 负控 + 域可区分。§12.3 |
| RA-1（域钉死） | `maxBytes` 规范域 = 有限整数 1..2^53−1（`Number.isSafeInteger(v) && v >= 1`） | 窗口面沿同域：G5 C-LIMIT 域顶收（`2^53−1`）、`2^53`/`2^53+2`/`1e21` 拒（组级判据，反伪绿） |
| RA-3（文档） | `maxBytes` 词汇重录不得悬空 | 本票对应 **OBL-DOC-406-1**（§12.6；窗口读词汇在 `.agents/skills/nomicore/typed-access.md` 的窗口读小节重录） |
| RA-2（路径校正） | 作用域文档实名 = `SCOPE_DOCS` 三文件（`.agents/skills/nomicore/typed-access.md`、`docs/integration/cordis-plugin-hosting.md`、`docs/integration/external-project-vfsl-codegen.md`） | 本票文档义务落点按实名；另加 `CONTEXT.md`（已就绪，零 diff） |

**SA8 缺位的保守处理**：本契约不引入任何需要 SA8 裁决的新语义（全部行为可回溯到 ADR 0031
决策 1–5 或父票既有实现），设计自由位收敛为 §12.7 的 D1–D7，并在实现送审时随
`requiresConflictRecheck` 一并送门禁。

## 4. 环境与基线

- 运行时：Node `v24.13.0`；pnpm `10.28.2`；typescript `5.9.3`；vitest `3.2.7`；tsx `4.23.12`。
- 依赖：`pnpm install --frozen-lockfile` exit 0（16 workspace projects，store 复用；仅 pnpm
  提示 esbuild build script 被忽略——vitest/tsx/tsc 实测全部可用）。
  `artifacts/sa6-issue406-install.log`。
- 语义环境：`tsconfig.base.json` `exactOptionalPropertyTypes: true`（显式 `maxBytes: undefined`
  对 TS 字面量调用者是编译错误 → D1 只在运行时/JS 调用者可观测）。
- HEAD：`56cf54281574ba15a2c471bb79ea57e813a94868`（`fix(#405): readData 面 maxBytes …`）。

| 基线命令 | 结果 | 日志 |
|---|---|---|
| `pnpm typecheck`（root，14 tsc project；**落盘契约文件前**） | **exit 0** | `artifacts/sa6-issue406-baseline-typecheck.log` |
| `pnpm typecheck`（落盘契约文件后复跑；`src` 面零改动） | **exit 0** | `artifacts/sa6-issue406-typecheck-root-final.log` |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/namespace-runtime/test packages/namespace-registry/test packages/doc-runtime/test --typecheck`（落盘前） | **exit 0；167 files / 2085 tests passed；Type Errors: no errors** | `artifacts/sa6-issue406-baseline-focused.log` |
| 同上（落盘后，排除新契约文件的回归复跑） | 唯一行为失败 = `readdata-shape-assertion-consolidation-gate.test.ts`（新测试字面键集违规）→ **已原位修正**；修正后门禁 + 控制组复跑绿（§13） | `artifacts/sa6-issue406-baseline-focused-recheck.log`、`artifacts/sa6-issue406-runner-gate-clean.log` |
| root `pnpm test` 全量（首次，依赖未装时误跑） | exit 1（`ERR_MODULE_NOT_FOUND`；非产品原因，装依赖后重跑） | `artifacts/sa6-issue406-baseline-fulltest.log`（作废留档） |
| root `pnpm test` 全量（落盘契约文件后） | **exit 1；422 files（4 failed \| 418 passed）；5095 tests（22 failed \| 5073 passed）；Type Errors 2 failed**——4 个失败文件**恰为**本票红灯契约（§13）；其余 418 files / 5073 tests 全绿（零其它回归） | `artifacts/sa6-issue406-fulltest-with-contract.log` |

- 运行期公共面（探针 P0）：runtime 15 键（`bumpReplicationEpoch, close, enableReplication,
  getActiveSchema, getMetadata, getSchema, getStatus, mutateData, namespaceId, owner, readArray,
  readData, readMap, replaceSchema, watchMap`）；`lifecycle='ready'`、`schema.state='ready'`。
- 现状锚（源码确认，不构成决策依据）：`NamespaceRuntimeReadArrayOptions = ReadArrayWindowOptions`
  （doc-runtime 五键单源**纯别名**）；S3 `canonicalWindowBudget` 键空间白名单恰五键
  （`packages/namespace-runtime/src/window-read.ts` L262–L272）；W1 `validateWindowOptions`
  白名单恰五键（`packages/doc-runtime/src/window.ts` L311–L315，未知键 → 响亮拒绝）；
  结果联合 `NamespaceRuntimeReadArrayResult` = 成功四键 | `WindowReadFailure` | `RuntimeReadDisabledResult`；
  registry 别名 `NamespaceLeaseReadArrayResult = NamespaceRuntimeReadArrayResult | NamespaceLeaseReleasedIssue`。

## 5. 正例复现（能力缺口，HEAD 实测）

Feature 无「运行时故障」；可复现的是**能力缺口**。全部探针均为临时文件/inline 脚本，收尾
删除（§16）；日志 `artifacts/sa6-issue406-probe-{runtime,anchors,types,gate}.log`。

**P1 — 行为缺口：窗口面 `maxBytes` ≡ 未知键（`artifacts/sa6-issue406-probe-runtime.log` §P1）**

| # | 最小输入 | HEAD 结果（逐字） |
|---|---|---|
| A1 | `readArray(['taskList'], {n:3, maxBytes:1})` | `ok:false code:WINDOW_OPTIONS_INVALID keys=[code,message,ok,path] message="window options 含未知键（封闭形状）：maxBytes"` |
| A2 | `{n:3, maxBytes:100000}` | 与 A1 **逐字相同**（预算大小零影响） |
| A3 | `{n:3, maxBytes:2**53-1}`（域顶） | 与 A1 逐字相同 |
| A4 | `{n:3, maxBytes:2**53}`（域外） | 与 A1 逐字相同 |
| A5–A10 | `0` / `-1` / `1.5` / `NaN` / `Infinity` / `'100'` | 与 A1 逐字相同（值域判定从未发生） |
| A11 | `{n:3, maxBytes:undefined}` | 与 A1 逐字相同（键在场即未知键） |
| A12 | `{n:1, nope:1}` | 同码，message「…：nope」（**唯一差异 = 键名**） |
| A14 | `{n:0, maxBytes:0}` | `message="window options.n 必须是 ≥1 的有限整数…"`（`n` 判据先触发，与 maxBytes 无关） |
| A13/A16/M5 | `{n:3}` / 非 enumerable `maxBytes` / `{n:2}` | `ok:true` 恒四键（已知键通道健康——负控，§6） |
| A15 | accessor `maxBytes` | 同 A1，getter **0 次执行** |
| A17 | `Object.freeze({n:3, maxBytes:1})` | 同 A1（冻结宿主不豁免） |
| A18 | 非数组 path + 非法 `maxBytes` | `PATH_NOT_ALLOWED`（G0 先于 options 校验；负控，§6） |
| A19/A20 | 目标缺席/载体不符 + 合法 `maxBytes` | 同 A1（`maxBytes` 在场即未知键——预算判定从未到达） |
| M1–M4 | 键面同款矩阵 | 与数组面逐字同型（面差异仅 path/条目身份） |

判读：HEAD 的拒绝发生在 **options 键空间判定**（W1 `validateWindowOptions` L311–L315），
与预算值、值大小、schema 状态、目标载体全部无关 → 缺口是**能力不存在**，不是既有行为错误。

**P2 — 类型面缺口（`artifacts/sa6-issue406-probe-types.log`；tsc 5.9.3 独立探针实跑 exit 2）**

```
probe-types.ts(24,61): error TS2353: Object literal may only specify known properties, and 'maxBytes' does not exist in type 'ReadArrayWindowOptions'.   // runtime.readArray 字面量调用点
probe-types.ts(25,54): error TS2353: ... 'ReadMapWindowOptions'.      // runtime.readMap
probe-types.ts(26,64): error TS2353: ... 'ReadArrayWindowOptions'.    // lease.readArray
probe-types.ts(27,84): error TS2353: ... 'ReadMapWindowOptions'.      // NamespaceRuntimeReadMapOptions 字面量
probe-types.ts(28,64): error TS2353: ... 'ReadArrayWindowOptions'.    // NamespaceRuntimeReadArrayOptions 字面量
probe-types.ts(33,45): error TS2339: Property 'measuredBytes' does not exist on type 'never'.   // Extract<窗口联合, READ_BUDGET_EXCEEDED>
probe-types.ts(34,41): error TS2339: ... 'never'.                     // 键面同款
probe-types.ts(38,3):  error TS2344: Type 'false' does not satisfy the constraint 'true'.       // 六键闭合形状断言
probe-types.ts(44,3):  error TS2344: ...                                                       // keyof 六键断言
```

判读：① runtime 与 lease 两个调用点都不接受 `maxBytes`；② 窗口结果联合**没有**
`READ_BUDGET_EXCEEDED` 名目，`measuredBytes` 载荷不可达（`never`）；③ 恒绿控制
（doc-runtime 五键锁、成功面四键锁、未知第六键/`n` 必填/`string` 值型 `@ts-expect-error`）
**零诊断**——探针装置本身健康。

**P3 — 断言可实现性对照（`artifacts/sa6-issue406-probe-gate.log`）**：18 锚 × 判据组
（对目标语义的**公共 API 组合参考闸门**求值）= 0 失败；同一判据组对 6 个变异体求值，
每个变异体 ≥1 锚失败（§9 E2）。⇒ 契约断言**可满足**且**敏感**。

## 6. 负控（HEAD 必须绿；实现后必须保持）

| # | 场景 | HEAD |
|---|---|---|
| N1 | 18 锚无预算窗口读（四键、冻结字节、✂ 事实行、`schema:null`） | 绿（`sa6-issue406-runner-control-head.log` 12/12） |
| N2 | 非数组 path + 非法/合法 `maxBytes` → `PATH_NOT_ALLOWED`（G0 定序） | 绿 |
| N3 | 非 enumerable `maxBytes` ≡ 无预算（逐字节一致） | 绿 |
| N4 | doc-runtime 载体原语 `readArrayWindowAtPath/readMapWindowAtPath` 携 `maxBytes` → `WINDOW_OPTIONS_INVALID`（未知键） | 绿 |
| N5 | lifecycle 停接纳先于 options：`close()` 后 + 抛错 get trap → `RUNTIME_READ_DISABLED`、trap 0 次 | 绿 |
| N6 | 敌意 options（stateful descriptor trap / get trap）→ `WINDOW_OPTIONS_INVALID`，零外抛、零 `[[Get]]` | 绿 |
| N7 | `readData` 面既有超限分支（恰五键 + `measuredBytes` 合计 + 冻结文案模板）= 三面同文的镜像对象 | 绿 |
| N8 | 无预算过滤窗口装满判定（`kept===n` → true / `kept<n` → false）+ ✂ 永不装配 | 绿 |
| N9 | 既有形状集中化门（`readdata-shape-assertion-consolidation-gate`，family A/B 归零） | 绿（新测试字面键集违规已原位修正） |

## 7. 稳定性、规模与时序

- **稳定性**：探针与契约测试均为确定性语义（零随机、零时钟参与、零并发写）。红侧在同一
  HEAD 上重复运行结果一致：`G1–G6/G8/G10` 全红，红因单一（未知键）。重复次数：红契约
  行为文件在本迭代实跑 3 次（落盘后 2 次、探针 1 次），失败集合逐次相同。
- **规模**：锚表含 3/5 条小容器（`items`/`itemMap`/`exactMap`/`emptyMap`/`scores`）；
  参考闸门与变异体求值覆盖全 18 锚。窗口原语本身的 O(N) 选窗/物化纪律不在本票范围
  （既有 `#368/#369/#381/#382/#383` 承担）；本票新增成本 = 一次 `JSON.stringify` +
  `Buffer.byteLength` 度量（收/拒判定不塑形、不重物化）。
- **时序**：全部同步读取（零 Promise、零 sequencer、零订阅）；lifecycle 门在 options 之前
  （N5 以 0 次 trap 调用锚定）。无竞态面。

## 8. 根因链（能力缺口链）

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| 1（症状） | 两个窗口面任何合法 `maxBytes` 调用被拒 `WINDOW_OPTIONS_INVALID` | P1 A1–A4/A19/A20（跨值域/跨面逐字相同） | 高（实测） |
| 2（直接故障点） | 拒绝发生在 W1 `validateWindowOptions` 的**键集门**（白名单恰五键，未知键即拒） | 源码 `packages/doc-runtime/src/window.ts` L311–L315 + P1 message「未知键…：maxBytes」 | 高（源码+实测） |
| 3（触发条件） | `maxBytes` 键在场即触发；与值域/预算大小/数据/载体/schema 状态无关 | P1 A1≡A2≡A3≡A4≡A5–A11；A19/A20 | 高（控制变量实测） |
| 4（深层能力缺口①） | 窗口 options 类型面（runtime/lease 两面）**没有** `maxBytes` 轴（纯别名到 doc-runtime 五键） | P2 TS2353 ×5；typecheck 程序 TS2344（六键形状断言 false） | 高（编译实测） |
| 5（深层能力缺口②） | 组合层没有**窗口交付总量度量**（唯一同时见到条目列表与元素口径投影文本的层未接入度量） | 源码：`window-read.ts` S3/S6 只产 `{ok,value,schema,truncated}`；`deliveryBytes`/`readDataBudgetExceeded` 仅被 `readData` 消费 | 高（源码） |
| 6（深层能力缺口③） | 结果联合没有预算失败分支（`READ_BUDGET_EXCEEDED` 在窗口联合结构不可达） | P2 TS2339 ×2（`measuredBytes` on `never`）；`Extract<窗口联合, READ_BUDGET_EXCEEDED>` = never | 高（编译实测） |
| 7（放大因素） | 无。缺口是纯加法能力，不涉及既有语义缺陷；`readData` 面文案/域/形状已在场（HEAD `#405`） | P4 D1–D3（readData 超限分支实跑） | 高 |
| 8（未证实假设） | 无阻塞性假设；设计自由位（§12.7）以观测面锁定 | — | — |

## 9. 因果实验（最小控制变量）

- **E1 控制变量：值域/键名/数据**。同一路径同一 options，仅改 `maxBytes` 值（1 → 100000 →
  2^53−1 → 2^53 → 0 → 非法型）结果**逐字不变**；仅改键名（`maxBytes` → `nope`）message 仅
  键名不同 ⇒ 拒绝因子 = 键在场，与值无关（P1）。
- **E2 参考闸门 + 变异体（反证敏感；`artifacts/sa6-issue406-probe-gate.log`）**：

| 变异体 | 语义偏差 | 失败锚数/18 | 首个击穿判据 |
|---|---|---|---|
| reference | 目标语义（域校验 + 无预算读 + 独立两通道度量 + 收/拒） | **0** | —（ALL-PASS） |
| value-only | 仅价值通道计量（漏 schema 通道） | 15 | G2/拒侧不再是预算失败（`total−1` 被放行） |
| utf16 | UTF-16 码元计量（非 UTF-8） | 18 | G2/拒侧放行（CJK 下低估） |
| trim | 超限时裁剪交付前缀而非零交付 | 18 | G2/拒侧非零交付（返回成功前缀） |
| no-validation | 不做域校验（非法值当预算） | 18 | G5/`maxBytes:0` 未报 `WINDOW_OPTIONS_INVALID` |
| where-count | 过滤窗口把装满判定写成 `kept < n` | 4 | G1/交付物不再逐字节一致（`truncated` 漂移；4 = 全 where 锚） |
| schema-records-max | 投影文本记录 `maxBytes` | 18 | G1/交付物漂移（schema 字节变化） |

- **E3 边界成对**：18 锚各 `total` 收 + `total−1` 拒成对求值（参考闸门全绿）⇒ 排除「预算被
  系统性放大/缩小」的实现。
- **E4 单位敏感**：CJK 锚 `WA3/WA4`（schema:null）实测 `utf8=77/39 ≠ utf16=57/29`；
  变异体 `utf16` 被击穿 ⇒ 断言对计量单位敏感。
- **E5 通道敏感**：双通道锚（`WA1/WA2/WA5/WM1/WM2/WM3/WM9`）断言
  `measuredBytes ≠ valueBytes ∧ ≠ schemaBytes`（G4 第三例）⇒ 单通道实现必红。

## 10. 影响面

| 面 | 变化 | 依据 |
|---|---|---|
| `@nomicore/namespace-runtime` 公共读面（`readArray`/`readMap` 的 options 与结果联合） | **目标变更面**（新增 `maxBytes?` 与预算失败成员） | ADR 0031 决策 1/2/3/4 |
| `@nomicore/namespace-runtime` 组合层（`runtime.ts`，可选 `window-read.ts` S3 镜像） | 预算域校验 + 度量 + 失败分支（唯一同时见两通道的层） | ADR 0031 决策 4 |
| `@nomicore/namespace-registry` lease 别名（options/结果联合） | **零代码改动即跟随**（纯别名；类型锁延伸已在契约测试） | ADR 0031 决策 4「别名跟随」 |
| `@nomicore/doc-runtime` | **零改动**（类型五键 + 行为拒未知键；契约以 C5 + 类型锁双向锚定） | ADR 0031 决策 4 |
| `@nomicore/vfsl`、投影渲染器 | 零改动 | ADR 0031 决策 4 |
| 成功面恒四键 / ✂ 文法 / 头行 / `DeepOptional` 类型面 / 无预算逐字节行为 | 零变化（G1/G6/G8 + 控制组锚定） | ADR 0031 决策 4 |
| 作用域文档（`SCOPE_DOCS` + `CONTEXT.md`） | `CONTEXT.md` L54 已声明三读面（零 diff）；`typed-access.md` 窗口读小节需补窗口 `maxBytes` 词汇 → **OBL-DOC-406-1**（§12.6） | `docs/AGENTS.md` 同步规则 |
| 既有测试 | 两处**原位延伸**（不是弱化）：纯别名 `Equal` → `Omit<…,'maxBytes'>` 中继锁（HEAD 即绿、实现后仍绿） | §12.6 |

## 11. 已排除假设

| 假设 | 排除依据 |
|---|---|
| 「窗口面已有预算闸，只是边界实现有错」 | P1：任何 `maxBytes` 值（含域顶）都在键空间门被拒 ⇒ 无预算语义在场 |
| 「缺口在 doc-runtime W1 的预算度量」 | W1 只见条目列表与计数，**看不到**元素口径投影文本（schema 通道在组合层生成）⇒ 度量结构性不可能住 W1；ADR 0031 决策 4 亦将校验/度量归组合层 |
| 「`maxBytes` 可只做类型面加法（运行时忽略）」 | 忽略即静默放行 → 与 ADR「超限零交付响亮拒绝」冲突；G5 有效域接受锚 + G2 超限锚必红 |
| 「窗口面可复用 `READ_OPTIONS_INVALID`」 | ADR 0031 决策 1 明文各面既有码：窗口面 = `WINDOW_OPTIONS_INVALID`；G5 断言该码 |
| 「本轮红是测试装置/入口问题」 | 控制组 12/12 绿、参考闸门 18/18 绿、旧契约（`#405`/`#369`/`#383`）全绿；红仅出现在携 `maxBytes` 的调用点 |
| 「where 过滤窗口的预算需特殊语义（计数/容量）」 | ADR 0031 决策 5：无静默丢弃、装满判定永不说谎；G6 三态断言（装满/扫完/恰好装满）全绿 |
| 「非 enumerable `maxBytes` 也应生效」 | 键空间纪律 = own-enumerable（镜像既有五键）；C4 锚定「≡ 无预算」，杀 `in`/直读实现 |

## 12. 验收契约

### 12.0 冻结 fixture 与字节锚

fixture：`packages/namespace-runtime/test/issue-406-window-maxbytes-fixture.ts`（**非测试文件**，
零 vitest 依赖，可被探针直接 import）+ `packages/namespace-registry/test/issue-406-window-maxbytes-lease-fixture.ts`
（lease/同 doc 双面装配）。冻结 schema 文本（逐字）：

```text
type Item = YMap<{
  /** 名称 */
  name: YLeaf<string>;
  /** 状态 */
  state: YLeaf<string>;
  /** 权重 */
  weight: YLeaf<number>;
}>;
type ROOT = YMap<{
  /** 条目数组（位置序） */
  items: Item[];
  /** 条目表（键空间） */
  itemMap: Record<string, Item>;
  /** 分数数组 */
  scores: YLeaf<number>[];
  /** 空条目表 */
  emptyMap: Record<string, Item>;
  /** 恰五条就绪表 */
  exactMap: Record<string, Item>;
}>;

ROOT 种子（确定性、零随机、零时钟）：
  items   = [甲一(claimed,w1), 乙二(done,w3), 丙三(claimed,w2)]
  itemMap = a1(claimed,1) a2(done,9) a3(claimed,5) a4(open,7) a5(claimed,3)
  scores  = [7,8,9]；emptyMap = {}；exactMap = e0..e4 全 claimed
  rawItems = ['你好，世界','甲乙丙丁戊']（schema 外 raw 数组 → schema:null + CJK 价值通道）
  rawMap   = {r1:'子一', r2:'丑二'}（schema 外 raw 键容器 → schema:null）
```

**锚表（无预算窗口读；HEAD 实测冻结；`artifacts/sa6-issue406-probe-anchors.log`）**——
`total = utf8(JSON.stringify(value)) + utf8(schema ?? '')`：

| 锚 | 读（无预算） | valueBytes | schemaBytes | **total** | truncated | ✂ 事实行 / 备注 |
|---|---|---|---|---|---|---|
| WA0 | `readArray(['items'], {n:3})` | 199 | 100 | **299** | false | — |
| WA1 | `readArray(['items'], {n:2})` | 132 | 174 | **306** | true | `- items · 窗口 · 基 index asc · kept 2/total 3` |
| WA2 | `readArray(['scores'], {n:2})` | 45 | 82 | **127** | true | `- scores · 窗口 · 基 index asc · kept 2/total 3`（标量口径） |
| WA3 | `readArray(['rawItems'], {n:2})` | 77 | 0 | **77** | false | `schema:null` + CJK（utf16=57） |
| WA4 | `readArray(['rawItems'], {n:1})` | 39 | 0 | **39** | true | `schema:null`（截断无 ✂ 载体） |
| WA5 | `readArray(['items'], {n:2, depth:0})` | 47 | 187 | **234** | true | 折叠 `‡` 页脚 + ✂ |
| WA6 | `readArray(['items'], {n:3, maxChildrenPerNode:1})` | 115 | 100 | **215** | false | width 塑形 |
| WA7 | `readArray(['items'], {n:1, where:claimed})` | 68 | 100 | **168** | true | where：kept 1 === n 1；**无 ✂** |
| WM0 | `readMap(['itemMap'], {n:5})` | 335 | 100 | **435** | false | — |
| WM1 | `readMap(['itemMap'], {n:2})` | 134 | 174 | **308** | true | `- itemMap · 窗口 · 基 key asc · kept 2/total 5` |
| WM2 | `readMap(['itemMap'], {n:3, orderBy:{by:'key',dir:'desc'}})` | 202 | 175 | **377** | true | `… 基 key desc · kept 3/total 5` |
| WM3 | `readMap(['itemMap'], {n:2, orderBy:{field:'weight',dir:'desc'}})` | 131 | 184 | **315** | true | `… 基 field:weight desc · kept 2/total 5` |
| WM4 | `readMap(['itemMap'], {n:3, where:claimed})` | 205 | 100 | **305** | true | where：filled（3===3）；无 ✂ |
| WM5 | `readMap(['itemMap'], {n:5, where:claimed})` | 205 | 100 | **305** | false | where：扫完（3<5）；**与 WM4 同字节、判定相反** |
| WM6 | `readMap(['exactMap'], {n:5, where:claimed})` | 346 | 100 | **446** | true | 匹配恰 n（5===5） |
| WM7 | `readMap(['emptyMap'], {n:1})` | 2 | 100 | **102** | false | 空容器（`value: []`、schema 照常） |
| WM8 | `readMap(['rawMap'], {n:1})` | 31 | 0 | **31** | true | `schema:null` |
| WM9 | `readMap(['itemMap'], {n:2, depth:0})` | 49 | 187 | **236** | true | 折叠 `‡` + ✂ |

边界锚（目标实现必须收/拒的**精确**字节）：每个锚 `total` → 收（逐字节一致）；
`total − 1` → 拒且 `measuredBytes = total`。

### 12.1 AC → 契约组绑定

| Issue #406 AC | 契约组 |
|---|---|
| ① 两窗口面 `maxBytes` 校验负控（`WINDOW_OPTIONS_INVALID`，message 区分 maxBytes 域） | G5（runtime）+ T3/T4（类型） |
| ② 超限同码同文同载荷；三面（readData/readArray/readMap）报错形态一致性 | G3 |
| ③ ≤ 边界成功；无预算窗口读逐字节回归锚 | G1/G2 + C1/C2/C10 |
| ④ where 过滤窗口：超限报错、装满判定不受影响、无静默丢弃 | G6 |
| ⑤ 度量等式在窗口面成立（条目列表 JSON + 元素投影文本，构造性断言） | G4 |
| ⑥ registry lease 别名锁断言延伸（窗口 options + 结果联合） | G9 行为 + T5 类型 |
| ⑦ 包内门禁 + root `pnpm typecheck` / `pnpm test` | §12.8 |

### 12.2 契约文件路径（本报告作者已落盘；实现方沿用/原位修订）

| 文件（新/改） | 承载 | 发现入口 |
|---|---|---|
| `packages/namespace-runtime/test/issue-406-window-maxbytes-fixture.ts` | §12.0 冻结锚 + 双向 oracle + 形状断言 helper + runtime 装配 | 非 `*.test.ts`，不被收集 |
| `packages/namespace-runtime/test/issue-406-window-maxbytes-red.test.ts` | G1–G6、G8、G10（红契约主体，20 用例） | `vitest.config.ts` L15 `packages/*/test/**/*.test.ts` |
| `packages/namespace-runtime/test/issue-406-window-maxbytes-control.test.ts` | C1–C10（回归/负控；HEAD 即绿，实现后必须保持，12 用例） | 同上 |
| `packages/namespace-runtime/test/issue-406-window-maxbytes.test-d.ts` | T1–T3（options 六键/结果联合/doc-runtime 锁，2 用例） | L20 `typecheck.include` + `--typecheck` |
| `packages/namespace-registry/test/issue-406-window-maxbytes-lease-fixture.ts` | lease/同 doc 双面装配（依赖方向：registry → runtime） | 非 `*.test.ts`，不被收集 |
| `packages/namespace-registry/test/issue-406-lease-window-maxbytes-red.test.ts` | G9 行为（lease ≡ runtime、released 短路、无预算回归，4 用例） | L15 |
| `packages/namespace-registry/test/issue-406-lease-window-maxbytes-surface.test-d.ts` | T4–T5（lease options/结果别名锁，2 用例） | L20 |
| **原位修订** `packages/namespace-runtime/test/issue-383-window-where-type-guard.test-d.ts` | 纯别名 `Equal` → `Omit<…,'maxBytes'>` **中继锁**（#406 延伸；HEAD 即绿、实现后仍绿） | L20 |
| **原位修订** `packages/namespace-registry/test/issue-369-window-read-lease-surface.test-d.ts` | 同上（runtime 侧中继锁；lease 侧单源别名锁保留） | L20 |
| 复用 | `helpers/readdata-ok-shape.ts`（既有集中化形状 helper；本票新文件经自有 helper 表达窗口四键，不新增字面键集） | — |

### 12.3 断言组（最小输入 / 可观察断言 / 旧实现 / 目标实现）

**G1 总量 ≤ 预算成功且交付物逐字节一致（AC3）** — 数组面 8 锚 + 键面 10 锚：
`readArray/readMap(path, {...options, maxBytes: total})` 与 `…{maxBytes: 2**53−1}` 均
`toStrictEqual(同参无预算读)`（四键全等：value/schema/truncated/ok）+ 恰四键。
旧实现：`WINDOW_OPTIONS_INVALID`（红）。目标：逐字节一致。

**G2 边界对（AC3/AC5）** — 18 锚：`total` 收（≡ 无预算读）；`total−1` 拒且
`measuredBytes === 冻结锚 total === 同运行无预算读的独立两通道合计`。
旧实现：全红。目标：全绿（边界与 oracle 双锚定）。

**G3 超限零交付 + 三面同码同文同载荷（AC2）** — 拒侧 own 键集**恰**
`[code, measuredBytes, message, ok, path]`（无 value/schema/truncated）；`path` 深等实参且
**非同一引用**（实参事后变异不影响结果）；`message === budgetMessageTemplate(measuredBytes, maxBytes)`
（模板 = `readData` 面现行文案逐字节：`READ_BUDGET_EXCEEDED: 读交付总量 N 字节超出 maxBytes M——零交付拒绝（不裁剪、不降深度；ADR 0031）`）；
同步零外抛；三面（`readData(['items'],{maxBytes:1})` / `readArray` / `readMap`）键集、码、
模板一致。旧实现：窗口两面红（readData 侧绿）。目标：全绿。

**G4 度量等式 property（AC5）** — 18 锚：`measured.measuredBytes === utf8(JSON.stringify(oracle.value)) + utf8(oracle.schema ?? '')`；
双通道锚额外断言 `≠ valueBytes ∧ ≠ schemaBytes`；CJK 锚断言 `utf8 ≠ utf16` 且
`schema:null` 计 0（单通道）。旧实现：全红。目标：全绿。

**G5 options 负控 + 有效域接受锚（AC1；组级判据）** —
非法矩阵（`0/-1/1.5/NaN/±Infinity/'100'/true/2**53/2**53+2/1e21/{}` × 两面）：
`WINDOW_OPTIONS_INVALID` + 恰四键 + message 含 `maxBytes` 域标识 + ≠ 未知键 message；
**同组有效域接受**：`{maxBytes:1}` 必须走 `READ_BUDGET_EXCEEDED`（**不是** options 码）、
`{maxBytes:2**53−1}` 必须成功且逐字节一致（C-LIMIT：域顶收、域外拒）；present-undefined ≡
缺席（D1）；accessor → 拒且 getter 0 次；`Object.freeze` 宿主接受。
旧实现：非法矩阵**巧合绿**（未知键路径）、有效域接受锚红 ⇒ **组级红**。目标：全绿。

**G6 where 过滤窗口 × 预算（AC4）** —
超限（WM4 装满 / WM5 扫完 / WM6 恰好装满 / WA7 数组面）→ 同一 `READ_BUDGET_EXCEEDED` 分支、
恰五键、`measuredBytes === 无预算过滤窗口的独立测量`、无 `value` 键（零静默条目丢弃）；
`≤` 预算 → 与无预算读逐字节一致、`truncated === (kept === n)` 三态保持（true/false/true）、
schema **不含** `✂ 截断事实：` 且事实行数为 0；WM4/WM5 同字节（305）而判定相反 ⇒ 预算不驱动
装满判定。旧实现：全红。目标：全绿。

**G8 不塑形交付（AC3）** — 带预算成功侧 `schema` 与无预算**逐字节相同**、不含 `maxBytes`；
`value` 条目列表/条目数不变；超限侧只出五键失败（无裁剪交付）；宽预算（total+1000）原样成功。
旧实现：红。目标：绿。

**G9 registry lease（AC6）** —
行为：真装配同 doc，lease 预算读 ≡ runtime 直调逐字段相等（收/拒两侧，含 where、desc、
`schema:null` 锚；`measuredBytes` 逐字相同、message 模板一致）；released 短路先于透传
（冻结三键 `[code,message,ok]` + 敌意 options get trap **0 次**）；无预算回归 18 锚
lease ≡ runtime（HEAD 即绿）。
类型（T5）：`NamespaceLeaseReadArrayResult/ReadMapResult = runtime 联合 | NamespaceLeaseReleasedIssue`
延续；`NamespaceLeaseReadArrayOptions = NamespaceRuntimeReadArrayOptions` 跟随（六键）；
`Extract<lease 窗口联合, READ_BUDGET_EXCEEDED>` 恰五键且 ≡ runtime 成员 ≡ lease.readData 预算成员
（三面同载荷形）；lease 窗口方法与 runtime 方法签名锁。
旧实现：行为收/拒红、released/回归绿；类型红。目标：全绿。

**G10 失败面优先级（预算法定序）** — 目标缺席/载体不符 + **合法** `maxBytes` → 原样 W1 码
（`WINDOW_TARGET_ABSENT` / `WINDOW_CARRIER_MISMATCH`，预算不吸收）；非法 options 同现 →
`WINDOW_OPTIONS_INVALID`（校验先于度量，不报预算码）。旧实现：前两例红、第三例绿 → 组红。

**C1–C10 控制组** — 见 §6（无预算冻结锚、零泄漏、G0 定序、键空间纪律、doc-runtime 零改动、
lifecycle、敌意、readData 镜像文案、where 既有语义、装置自洽）。HEAD 即绿，实现后必须保持。

**T1–T5 类型组** — options 六键闭合（两 face 精确 Equal + `keyof`）；结果联合预算成员恰五键、
零成功键、与 `readData` 成员同形；成功面四键不变；方法签名（第二参/返回）；doc-runtime 五键
类型锁（`keyof` + `Extract<…, {maxBytes}>` = never）；EOPT（显式 `undefined` 编译红）；
未知第七键/`string` 值型/缺 `n` 编译红；lease 别名锁（§12.3 G9 类型）。

### 12.4 红/绿判定表（HEAD 实测）

| 组 | HEAD | 目标实现 | 说明 |
|---|---|---|---|
| G1 | **红**（18/18 锚） | 绿 | 能力缺口主证 |
| G2 | **红** | 绿 | `≤` 边界成对 |
| G3 | **红**（窗口侧） | 绿 | 五键零交付 + 三面同文 |
| G4 | **红** | 绿 | 度量等式/单位/通道 |
| G5 | **红**（组级：接受锚红 + 2 例巧合绿） | 绿 | 反伪绿配平 |
| G6 | **红** | 绿 | where × 预算 |
| G8 | **红** | 绿 | 不塑形 |
| G9 行为 | 红 2 / 绿 2（released、无预算回归） | 绿 | lease 透传 |
| G9 类型 | **红** | 绿 | 别名锁延伸 |
| G10 | 红 2 / 绿 1（n:0 同现） | 绿 | 优先级 |
| C1–C10 | **绿**（12 用例） | 绿 | 回归锚（不得红） |
| T1–T4 类型 | **红 2 / 绿 2**（runtime test-d 1 红 1 绿、lease surface 1 红 1 绿；绿 = EOPT 编译红锚与 released 联合锚） | 绿 | 类型面 |
| 既有 `#369`/`#383` 类型锁（原位延伸） | **绿**（2 + 3 用例） | 绿 | 中继锁 |

### 12.5 反伪绿 / 反伪红设计（必读）

| # | 防线 | 机制 | 证伪对象 |
|---|---|---|---|
| R1 | **期望不得从被测结果反推** | 期望 = §12.0 冻结锚 **或** 同运行同参无预算读的独立两通道测量；`expectBudgetFailure` 拒绝以被测载荷自证 | 自洽伪绿 |
| R2 | **负控必须与正向接受同组** | G5 非法矩阵后追加有效域接受锚（`1`、`2^53−1`）；非法矩阵在 HEAD 上**巧合绿**（未知键 message 恰含 `maxBytes`），组级判据才红——实测 G5 非法矩阵用例 HEAD 通过而有效域用例 HEAD 失败 | 未知键伪绿（最危险类） |
| R3 | **精确键集** | 成功恰四键（helper）、超限恰五键（`BUDGET_FAILURE_KEYS`）、窗口失败恰四键 | 半成品交付（失败带 value/schema） |
| R4 | **度量单位敏感** | CJK 锚（schema 文本 CJK 注释 + `rawItems`/`rawMap` CJK 值）：`utf8 ≠ utf16` 实测 77≠57 / 39≠29；变异体 `utf16` 被击穿 | UTF-16/字符数误度量 |
| R5 | **通道敏感 + 合计** | 双通道锚断言 `measured ≠ 任一单通道`；`schema:null` 锚单通道（= valueBytes）；变异体 `value-only` 15 锚被击穿 | 漏计 schema/✂ |
| R6 | **塑形后计量** | WM3（desc+field 基）、WM9/WA5（depth 折叠 `‡`）、WA1（✂ 段）的 total 分别锚定；参考闸门按交付物度量 | 预塑形/漏 ✂ 计量 |
| R7 | **键空间纪律** | 非 enumerable `maxBytes` ≡ 无预算（C4）；accessor 零执行（G5）；冻结宿主接受 | `in`/直读实现 |
| R8 | **失败优先级** | G10 + C3 + C6：lifecycle > G0（非数组 path）> options 校验 > W1 载体/缺席 > 预算 | 报码错位 |
| R9 | **oracle 前置 fail loud** | 装置前提（schema ready、oracle 读成功、锚字节相符）失败即 loud throw（`windowOk`/`expectWindowOkKeys`），不吞错、不降级为跳过 | 装置坏导致的伪红 |
| R10 | **禁 skip/only/todo/env/fallback/源码字符串断言** | 断言只观察公共接缝（方法结果联合、own 键集、字节、投影文本、异常观测、trap 计数）；全部文件零 `skip`/`only`/`todo`/env override | 伪红/伪绿与实现耦合 |
| R11 | **边界成对** | 18 锚 `total` 收 + `total−1` 拒成对（G2/G4） | 预算被系统性放大/缩小 |
| R12 | **where 双态同字节** | WM4/WM5 字节相同（305）而装满判定相反：断言 `truncated` 各自保持 | 「预算驱动 truncated」/「装满判定退化为计数」 |
| R13 | **变异体反证** | 6 变异体各被 ≥1 判据击穿（§9 E2） | 断言不敏感（伪绿） |

### 12.6 复用与不可触碰面

- 复用：`real-persistence-scheduler.ts`、`createNamespaceRuntimeWithSeam`、registry
  `createNamespaceRegistryForTesting` + `createRegistryTestScheduler` + stub handle/persistence
  （`issue-383` 先例）、`helpers/readdata-ok-shape.ts`（集中化形状表达）。
- **不可触碰（零 diff；若设计必须触碰须原位修订本契约并在报告中记录）**：
  `packages/doc-runtime/**`（类型五键 + 行为未知键拒；ADR 0031 决策 4）、`packages/vfsl/**`、
  投影渲染器、作用域文档（`SCOPE_DOCS` 三文件 + `CONTEXT.md`）**默认零 diff**。
- **允许变更面**：`packages/namespace-runtime/src/**`（`runtime.ts` 必改；`window-read.ts`
  S3 键空间镜像若消费 raw options 则须原位加键/或由 runtime 传剥离视图——两者皆为合法落点，
  观测面由 §12.3 锁定）+（可选）`index.ts` 若导出新具名类型；`packages/namespace-registry/src/**`
  预期零改动（纯别名跟随；若实现新增具名导出需同步 public-surface 守卫测试与别名锁）。
- **OBL-DOC-406-1（文档挂账；非阻塞但不得跨迭代悬空）**：`.agents/skills/nomicore/typed-access.md`
  窗口读小节（L148–L205）补窗口 `maxBytes` 词汇（同码同文、总量 = 条目列表 + 元素口径投影
  文本、`where` × 预算的三条语义：超限同分支/装满判定不受影响/✂ 永不装配）；**清退对象 = 无**
  （该小节未把窗口 options 误述为不含 `maxBytes`——只是尚未提及；窗口读小节现有「closed」
  表述限定在 `orderBy`/`where` 词表，语义不冲突）；落地窗口 = 实现变更集或紧随同迭代；
  `CONTEXT.md` L54 已声明三读面（零 diff）、`docs/integration/*` 两文件无需改动（仅述 readData 面）。

### 12.7 设计 pin（ADR 未逐字钉死；SA1 必须收口，D1/D5/D6 会改断言字面）

| # | Pin | 推荐解（契约默认） | 条件解（若 SA1 另选） |
|---|---|---|---|
| D1 | `{maxBytes: undefined}`（键在场、值 undefined） | **≡ 缺席**（沿 `readData` D1 纪律；EOPT 下 TS 调用者不可达） | 若定为非法：G5 该输入移入 `READ_OPTIONS_INVALID` 矩阵并记录理由 |
| D2 | 结果联合形态 | `NamespaceRuntimeReadArrayResult`/`ReadMapResult` **直接追加**共享预算成员（窗口 options 必填、无重载分叉）；lease 别名自动跟随 | 若另立具名预算联合：`Parameters/ReturnType` 与 lease 锁须原位改写并送复核 |
| D3 | options 宿主形态 | runtime **自持六键** `{n, orderBy?, depth?, maxChildrenPerNode?, where?, maxBytes?}`；doc-runtime 五键类型 + 行为零 diff（`Omit` 中继锁锚定） | 任何形态都必须满足：六键接受、第七键编译红、doc-runtime 五键（类型 + 行为）不变 |
| D4 | 校验/度量落点 | 组合层（`namespace-runtime`；唯一同时见两通道的层），W1 保持其余五键的**单一权威**（message 单源不漂移） | 任何落点都必须满足 G10 定序与 C5 doc-runtime 行为锁 |
| D5 | message 文案 | **逐字节镜像** `readData` 现行文案（三面同文义务；ADR 0031 决策 3） | 无——mirror 义务来自父票 OBL-WIN-1/ADR；若改文案须同变更集修订 `readData` 面与其控制锚 C8 |
| D6 | 度量对象 | **塑形后交付物**：条目列表（含 key/index 包装）紧凑 JSON + 元素口径投影文本（✂/`‡`/体自然计入；`schema:null` 计 0） | 无——ADR 0031 决策 2 明文 |
| D7 | 定序 | lifecycle > G0（非数组 path）> options 校验（含 `maxBytes` 域/accessor）> W1 目标/载体/其余键 > 预算判定；同层内不钉死次序（只钉发生层） | 任何定序都必须满足 G10 + C3 + C6 |

### 12.8 门禁清单（实现迭代必须全绿）

1. `pnpm typecheck`（root，14 project）exit 0。
2. `NODE_OPTIONS=--conditions=nomicore-source pnpm test`（root 全量）exit 0；文件/测试数 ≥
   （基线 167 files / 2085 tests 的 runtime+registry+doc-runtime 面）+ 新增契约文件；
   新契约文件全绿（本迭代落盘时 §13 的预期红必须全部转绿）。
3. 定点：`vitest run packages/namespace-runtime/test packages/namespace-registry/test --typecheck` exit 0。
4. `git diff --stat` 证明不可触碰面零 diff（doc-runtime / vfsl / 渲染器 / 作用域文档）；
   允许变更面仅 `packages/namespace-runtime/src/**`（+ 可选 registry 具名导出）。
5. 契约文件零 `skip`/`only`/`todo`/env override/fallback；无源码字符串断言
   （`readdata-shape-assertion-consolidation-gate` family A/B 归零保持）。
6. OBL-DOC-406-1 落地（同变更集或紧随同迭代）。

## 13. 红/绿证据

- **基线绿**：`artifacts/sa6-issue406-baseline-focused.log`（167 files / 2085 tests，exit 0）；
  `artifacts/sa6-issue406-baseline-typecheck.log` / `…-typecheck-root-final.log`（exit 0）。
- **能力缺口红（行为）**：`artifacts/sa6-issue406-runner-red-head.log` —— 20 用例 **18 红 / 2 绿**
  （2 绿 = G5 非法矩阵、G10 `n:0` 同现，均为**巧合绿**，其组判决由同组接受锚承担）；
  红因全部落 `失败码应为 READ_BUDGET_EXCEEDED，实际 WINDOW_OPTIONS_INVALID` 或等价未知键拒绝。
- **能力缺口红（类型）**：`artifacts/sa6-issue406-typecheck-program-head.log` —— 27 条诊断
  **全部**集中在本票两个新 `.test-d.ts`（16 + 11：TS2353 ×8、TS2339 ×6、TS2367 ×2、
  TS2344 ×11），其它文件（含两处原位延伸锁）零诊断。
- **参考闸门绿（可实现性）**：`artifacts/sa6-issue406-probe-gate.log` —— reference 0/18 失败；
  6 变异体分别 15/18/18/18/4/18 失败（§9 E2）。
- **锚冻结**：`artifacts/sa6-issue406-probe-anchors.log`（18 锚两通道实测 + `utf16` 对照）。
- **控制组绿**：`artifacts/sa6-issue406-runner-control-head.log`（12/12）+ `…-runner-gate-clean.log`
  （控制组 + 形状集中化门 + lease 回归 38 passed / 2 failed = lease 预算红侧）。
- **回归复跑**：`artifacts/sa6-issue406-baseline-focused-recheck.log` —— 唯一行为失败 =
  形状集中化门（新测试字面键集）→ 原位修正后 `…-runner-gate-clean.log` 转绿；
  typecheck 程序诊断仅新契约文件。
- **root 全量定位**：`artifacts/sa6-issue406-fulltest-with-contract.log` —— 422 files（4 failed |
  418 passed）/ 5095 tests（22 failed | 5073 passed）；`grep '^ FAIL '` 全部命中 `issue-406-*`
  四个红灯契约文件，**零非本票失败** ⇒ 红是局部且归因单一的。

## 14. Runner 触发证据

- 发现入口：`vitest.config.ts` L15 `include: ['packages/*/test/**/*.test.ts', …]`、L20
  `typecheck.include: ['packages/*/test/**/*.test-d.ts', …]`；根 script `test =
  NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`；跨包源码经
  `customConditions: ["nomicore-source"]` 解析（无需 build）。
- 实跑（`artifacts/sa6-issue406-runner-trigger.log`）：
  `vitest run --typecheck <7 个契约/延伸文件>` → **exit 1；4 files failed | 3 passed；22 failed |
  23 passed；Type Errors 2 failed**，逐文件：
  - `issue-406-window-maxbytes-red.test.ts`（20 | **18 红**）——能力缺口；
  - `issue-406-lease-window-maxbytes-red.test.ts`（4 | **2 红**，2 绿 = released/无预算回归）；
  - `issue-406-window-maxbytes-control.test.ts`（**12 绿**）；
  - `TS issue-406-window-maxbytes.test-d.ts`（2 | **1 红**，1 绿 = EOPT）；
  - `TS issue-406-lease-window-maxbytes-surface.test-d.ts`（2 | **1 红**，1 绿 = released 联合）；
  - `TS issue-383-window-where-type-guard.test-d.ts`（**3 绿**，原位延伸锁）；
  - `TS issue-369-window-read-lease-surface.test-d.ts`（**2 绿**，原位延伸锁）。
- 判读：新契约文件全部落在真实 include 模式内（`.test.ts` 经 vitest、`.test-d.ts` 经
  typecheck 引擎），无需改配置即被收集；实现落地后同一命令应转 exit 0。

## 15. Unknowns 与 blockers

- **Blockers：无。** 缺口稳定复现（探针可重跑，§16 留档源码）、根因/能力缺口可归因、
  契约可执行（参考闸门 18/18 绿）、测试入口真实（§14）、负控绿、基线绿。
- Unknowns（全部转为 §12.7 pins，不阻塞设计）：D1 present-undefined 语义；D2 联合/别名
  形态（观测面已锁）；D3 options 宿主形态（六键观测面 + doc-runtime 五键双锁已定）；
  D4 校验/度量落点（观测面已锁）；D5 文案（镜像对象已冻结——若实现改文案须同步 `readData`
  与其控制锚）；D6 度量对象（ADR 明文）；D7 同层次序（只钉发生层）。
- **SA8 门禁状态**：本票 SA8 产物缺席 → 契约送审时应带 `requiresConflictRecheck = true`
  （D1/D2/D5/D6 涉及实现自由位；RA-4/OBL-WIN-1 的兑现方式已由本契约锁定）。
- 挂账义务：**OBL-DOC-406-1**（§12.6；同变更集或紧随同迭代）。窗口面并无其它未兑现义务
  （父票 OBL-WIN-1 由本票兑现）。

## 16. 临时诊断清理

| 临时产物 | 处置 | 证据 |
|---|---|---|
| `packages/namespace-runtime/.sa6-406-probe/probe-runtime.ts`（行为缺口/锚/where/优先级探针） | **已删除**（源码留档 §16 末「探针源码」） | `git status --short` 无 `.sa6-406-probe` 残留 |
| `packages/namespace-runtime/.sa6-406-probe/probe-anchors406.ts`（18 锚两通道测量） | 同上 | 同上 |
| `packages/namespace-runtime/.sa6-406-probe/probe-gate406.ts`（参考闸门 + 6 变异体） | 同上 | 同上 |
| `packages/namespace-registry/.sa6-406-probe/probe-types.ts` + `tsconfig.probe.json`（类型面缺口探针） | 同上 | 同上 |
| `packages/namespace-runtime/.sa6-406-probe/probe-types.ts` + `tsconfig.probe.json`（早期副本；因 registry 依赖方向迁出） | 同上 | 同上 |
| 生产实现 | **零改动**（探针只读公共 API；零日志注入、零业务语义变更） | `git diff --stat` 仅两处既有 `.test-d.ts` 原位延伸；`git diff` 对 `packages/**/src/**`、`docs/**` 为空 |
| 证据日志（保留） | `artifacts/sa6-issue406-{install,baseline-typecheck,baseline-focused,baseline-focused-recheck,typecheck-root-final,typecheck-program-head,probe-runtime,probe-anchors,probe-gate,probe-types,probe-typecheck-program,runner-control-head,runner-red-head,runner-typed-head,runner-lease-red-head,runner-gate-clean,runner-trigger,fulltest-with-contract,baseline-fulltest}.log` | 未跟踪新增文件，不入分支提交 |
