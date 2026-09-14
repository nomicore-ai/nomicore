# SA1 实现设计 — issue #381：[ADR 0029] P1 W1 冻结解除与 total 下沉（prefactor）

- 任务：`nomicore` issue #381（Parent：PR #380 adr-0029-filtered-window）
- 设计轮次：iteration 0（无既有设计稿、无 SA2 评审输入）
- 输入基线：HEAD `8a4fa404076afdae9d974c1ad15bd985e24d58ac`（PR #380 设计基线；`where` 实现不在场）
- 规范权威：`docs/adr/0029-filtered-window-read.md` §5/§8；`docs/adr/0028-window-read.md` §7/§8/§9
- 上游验收：`wiki/raw/task_issue-381_sa6_contract.md`（verdict approve；§12 验收契约 + §13–§16 红/绿证据）

---

## 1. 任务类型、目标与非目标

**任务类型：Refactor（ADR 0029 前置重构票）+ 一处刻意加法的原语面形状变更**（W1 成功结算两键 → 三键）。非 Bug 修复：不消除任何故障，只把候选计数的权威从组合层下沉到载体级原语，并清偿 #368 冻结期留下的镜像复制件。

**目标（issue AC1–AC5 逐条承接）**：

1. doc-runtime 窗口原语两面（`readArrayWindowAtPath` / `readMapWindowAtPath`）成功结算恰三键 `{ok, value, total}`；`total` = 候选标识计数（数组面 = length；键面 = 非 undefined 值键数）；失败结算形状不变。
2. namespace-runtime 组合层删除 S4 候选计数与全部 W1 出处标记镜像复制件，收缩为纯组合层（S3 净化 / S5 锚链 / S6 ✂ 装配）；`total` 消费自 W1 单源；W1 冻结与「copied from」镜像纪律备注同步清账（ADR 0028 §13 R2 执行 = ADR 0029 §8）。
3. registry lease 公共面行为逐字节不变（既有组合面/lease 测试零语义改动）。
4. doc-runtime 窗口测试家族完成两键 → 三键断言迁移。
5. 全仓 `pnpm typecheck` + `pnpm test` 绿。

**非目标（票面 + SA6 §12.9 边界，不得越界）**：

- 不实现 `where`（词表 / 校验 / 语义均不动；ADR 0029 §5 的 `total: number | undefined` 双形态、装满判定 `truncated`、✂ 永不装配等语义属后续 P2 票——本票 `total` 恒为数值）。
- 不改 `readLogicalValueAtPath`（`read.ts` 零 diff 纪律维持，SA6 H7）。
- 不改 readData / 预算四键 / ADR 0028 四键语法与 ✂ 文法（B-8 冻结）。
- 不做「专用 count 能力 / n=0 计数探针」（ADR 0029 §5 备案演进位）。
- 不新增公共值导出（P-W2 守卫：窗口面值导出恒两枚）。
- 不为 E4 对抗场景一致性写断言，也不为实现它引入新读路径（SA6 §12.9 非阻断边界）。

## 2. 当前行为与证据锚点

### 2.1 W1 原语（`packages/doc-runtime/src/window.ts`，749 行）

| 事实 | 锚点 |
|---|---|
| 公共两面入口：`windowCore(doc, path, options, face)` 共用骨架，成功返回 `{ ok: true, value: entries }` 恰两键 | `window.ts` L109–117（array，成功字面量 L116）、L123–131（map，L130）、`windowCore` 成功返回 L208；头注 A-装配 L24「恰两键（D9/B-5）」 |
| 结果联合成功成员无 `total` | L97–100（`ReadArrayWindowResult` / `ReadMapWindowResult` 注释「成功恰两键」）；`WindowCoreResult` L139 |
| 候选枚举先于选窗：`collectCandidates` → `candidates`（O(N) 标识枚举，决策 8）→ 排序 → `kept = Math.min(n, candidates.length)` → 逐项物化 | L189–196（candidates L191、kept L196）、L198–207 |
| `total` 的语义数据已在 `candidates.length` 就位，只是未随结算携带 | L191（`candidates`）、L196（`kept` 已消费同一长度） |
| 失败构造 `windowFailure`：own 键集恰 `{code, ok, path, message}`，path 新鲜副本 | L217–219 + `safeSpreadPath` L221–229 |
| `read.ts` 零 diff 复制纪律（≠ W1 冻结；本票不动） | 头注 L27–29；复制件 L221/231/639/644/649/655/673/686/715 |

### 2.2 组合层（`packages/namespace-runtime/src/window-read.ts`，742 行）

| 事实 | 锚点 |
|---|---|
| S3 canonical 接缝净化（descriptor 纪律重读 options，两出口：重派发失败透传 / 接缝终态 `WINDOW_OPTIONS_INVALID`） | `composeWindowRead` L154–160、`canonicalWindowBudget` L205–250 |
| S4 候选计数：W1 成功后**第二次独立导航**枚举计数（`probeRoot` → `navigate` → `classify*Target` → `countMapEntries`） | L162–164（调用点）；`countWindowCandidatesAtPath` L412–433（`export`）、`countMapEntries` L435–447；防御位 `countingDefectFailure` L468–474 |
| S5 锚链 + S6 结算：`kept = entries.length`、`total = counted.total`、`truncated = kept < total`、✂ 块装配 | L166–183（total 消费 L178–179） |
| W1 出处标记镜像复制件整块 267 行（`copied from window.ts@ab6e390` / `carrier.ts@ab6e390` 共 11 处） | L476–742；标记位于 L478/488/493/498/504/522/535/553/671/706/722 |
| 头注声称 W1 面与包范围冻结 → 镜像纪律（本票清账对象） | L35–38 |
| `foldSegment` 出处是 `read-schema-projection.ts`（非 W1 冻结面，保留件） | L393–398 |
| `countWindowCandidatesAtPath` 的 `export` 无包外消费者：`src/index.ts` 只转出类型（L64–70），runtime.ts 只导入 `composeArrayWindowRead`/`composeMapWindowRead` 与类型（L65–71）；全仓测试零引用（grep 实证） | `packages/namespace-runtime/src/index.ts` L64–70；`runtime.ts` L65–71 |

### 2.3 runtime 消费点与 registry 透传

| 事实 | 锚点 |
|---|---|
| S1 lifecycle gate → S2 W1 直通（只消费 `windowResult.value`）→ 交组合层 | `runtime.ts` L681–690（readArray，L689）、L693–702（readMap，L701）；JSDoc L672–680 含「S4 O(N) 计数」措辞（L678） |
| lease 原样透传 runtime 联合（`readArray`/`readMap` raw 引用直传） | `packages/namespace-registry/src/lease.ts` L309–315；类型别名 `types.ts` L468–482 |
| 全仓 `ReadArrayWindowResult`/`ReadMapWindowResult`/两原语消费者清点：doc-runtime（src 2 + test 4）、namespace-runtime（src 2 + composition test 1）、namespace-registry（lease contract test 1）；apps/domains 零命中 | `grep -rl` 实证（SA6 §10 同款结论） |

### 2.4 测试基线（SA6 §4/§13，实跑证据）

- 聚焦窗口家族 5 文件 114/114 绿（两次运行一致）；全仓 `pnpm typecheck` exit 0、`pnpm test` exit 0（392 文件 / 4730 用例）。
- 两键锁唯一所在：pins P7（`issue-368-window-read-design-pins.test.ts` L325–338）；契约 helper B-5 显式「允许额外字段，不锁键集」（contract-red L29/L83）。
- lease↔W1 `toStrictEqual` 断言仅出现在**失败成员**（E4 L706、F1、F2）——成功面无整对象对比（SA6 H4）。
- 组合面 S4 矩阵用独立预言机（native/Yjs 直数）对账，只观察 runtime 公共 seam（composition test L252–325）。
- 形状集中化门扫描域 = `namespace-runtime/test` + `namespace-registry/test`；doc-runtime 键集断言是负样本（gate L58–61、L171–197）→ M1 迁移不触发该门（SA6 H8）。

## 3. 根因（能力缺口链，承接 SA6 §8）

| Step | 事实 | 证据 |
|---|---|---|
| 症状 | W1 成功结算缺 `total`，计数权在组合层 | SA6 §5 探针：两面 own 键集 = `["ok","value"]`，`total === undefined` |
| 直接缺口 | W1 枚举完成的候选空间（`candidates`）未随结算携带，组合层只能再导航一次自算 | `window.ts` L191/L208；`window-read.ts` L162–164 |
| 为什么存在 | #368 的包范围冻结把 `window.ts` 钉为不可改，组合层被迫以出处标记镜像复用导航/分类并自算计数（#369 设计 §13 R2 预知并接受该成本，登记 follow-up） | `window-read.ts` L35–38、11 处镜像标记；#369 设计 L396–400 |
| 最深根因 | **计数权威归属错层**：候选标识计数应属载体级原语（枚举/过滤/计数同源），当前由组合层第二次导航复算，留下「W1 数的候选集 ≠ runtime 数的匹配集」接缝漂移 | ADR 0029 §8 L68；SA6 §9-E4 漂移探针实证（`kept 3/total 4` 而 `value` 取自 3 项快照） |
| 触发条件 | ADR 0029 §8 解除冻结并要求 total 下沉 + 镜像清账；本票 AC1–AC5 执行 | ADR 0029 L65–70；简报 L17/L21–25 |

## 4. Owner 要求落实

无 owner comment（简报「## Comments」段为空；dispatch 明示 REST comment 读回无评论）。验收面 = 简报 AC1–AC5 逐字 + ADR 0029 §5/§8 规范约束，无额外 owner 口径可映射（SA6 §2 同款结论）。

| 来源 | 要求 | 设计承接位置 |
|---|---|---|
| Issue body「What to build」L17 | 窗口原语成功结算新增 `total` 键（无 where 时恒为候选标识计数）；组合层删除自算计数与全部出处标记镜像复制件；行为除该键外零变化；lease 公共面逐字节不变 | §5 D1/D2（加键）、D3（删计数与镜像）、§7 调用方矩阵（lease 零改动） |
| Issue AC1 | 两面成功恰三键；total 语义；失败形状不变 | §5 D1/D2、§8 验收映射 T1–T9 |
| Issue AC2 | 组合层不再持有候选计数逻辑与镜像复制件；W1 冻结注释与「copied from」备注清理 | §5 D3/D5、§8 验收映射 X1–X5 |
| Issue AC3 | lease 公共面行为逐字节不变；既有组合面测试零语义改动 | §5 D6-M4、§8 验收映射 R1–R6 |
| Issue AC4 | doc-runtime 窗口测试家族两键 → 三键迁移 | §5 D6-M1/M2/M3、§8 验收映射 |
| Issue AC5 | 全仓 `pnpm typecheck` + `pnpm test` 绿 | §8 验收映射 G1/G2 |

## 5. 复现和根因承接

### 5.1 上游事实承接

| 上游事实 | 证据位置 | 设计响应 |
|---|---|---|
| 目标契约在 HEAD 红：两面成功 own 键集 `["ok","value"]`、`total=undefined`；失败面四键 PASS；fixture/零物化负控 PASS（红因 = total 缺席，非环境/入口） | SA6 §5 探针（`/tmp/sa6-381-probe.ts`，tsx 实跑） | §5 D1 成功字面量加 `total`；红因与本设计改动一一对应 |
| 类型层 HEAD 红：`Equal<keyof Extract<ReadArrayWindowResult,{ok:true}>, 'ok'\|'value'\|'total'>` = false（两面同款） | SA6 §5 类型探针（TS2344/TS2322，运行后已删除） | §5 D1 类型联合加必填 `total`；D6-M2 类型锁迁移 |
| `total` 在 lease 面承重：变异 A（组合层 `total := kept`）→ 16/50 红（lease A/T 组、composition S3/S4/S5、E3） | SA6 §9-E2（已回滚） | 被删的 S4 语义必须由 W1 单源**等价**承接（D2 逐位一致证明），组合层不得以 kept 顶替 |
| P7 是唯一两键锁；错语义 `total` 不被 HEAD 测试族抓到 | SA6 §9-E3（变异 B：仅 P7 红） | D6-M1 迁移 + D6-P3 新增独立预言机断言（T2–T5/T8），否则实现可伪绿 |
| 单源必要性的行为证据：对抗性 options Proxy trap 在 S3 canonical 重读时插改 doc，HEAD 的 `truncated`/✂ 按 4 项快照叙述而 `value` 取 3 项快照 | SA6 §9-E4 漂移探针 | 下沉后 `total` 与 `value` 同一次枚举产出 → `total=3`、`truncated:false`。该差异无既有契约覆盖，登记为**非阻断边界**（§9 残余）：不写断言、不引入新读路径 |
| 结构缺口：S4 计数 + 267 行镜像（11 处出处标记）在场 | SA6 §5 grep 清点 | D3 整块删除（保留件见 §5 D3-保留集） |
| 还原检查点干净：变异/探针全部回滚，聚焦 114/114、全仓 typecheck/test 绿 | SA6 §16 | 设计基于干净 HEAD `8a4fa40`，无遗留改动 |

### 5.2 上游事实与源码矛盾检查

未发现矛盾：SA6 报告的行号/符号（`window.ts` L97–100/L109–131/L166–213、`window-read.ts` L162–164/L400–447/L468–474/L476–742、`runtime.ts` L676–702、`lease.ts` L309–315、`types.ts` L468–482）经本轮实读逐一对上；镜像标记 11 处、`countWindowCandidatesAtPath` 导出无外部消费者经 grep 复核成立。

## 6. SA8 约束落实（无 SA8 产物，替代约束面）

`wiki/raw/task_issue-381_relevant_decisions.md` 与 `_conflict_report.md` 均不存在（`ls wiki/raw | grep 381` 仅命中简报与 SA6 契约）。按 skill 规程以规范文本 + 包边界契约替代，并标记设计后冲突复查（§11）。

| 决议或义务 | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|
| ADR 0029 §5（L45–53）：W1 成功结算 `{ok:true, value, total}`，`total` 键恒在；无 where = 零值域标识计数（= ADR 0028 现状语义） | §5 D1/D2 | 成功成员加必填 `total: number`；本票无 where ⟹ 恒数值（不得 `undefined`） | 是（公共 API 类型面变化） |
| ADR 0029 §8（L65–70）：解冻 `window.ts`；S4 计数下沉；删除 S4 与全部出处标记镜像；测试家族机械迁移 | §5 D1/D3/D6 | 逐条执行；`where` 留后续票（§1 非目标） | 是（解除既有冻结面 + 修订 #368/#369 设计级纪律） |
| ADR 0028 §7（L63）：lease 恒四键 `{ok,value,schema,truncated}`；`truncated === kept < total`；✂ 承载窗口事实 | §5 D3-S6、§8 R1–R3 | 四键形状与 ✂ 文法零改动；`total` 单源化不改变 lease 可观察行为 | 否（语义不变） |
| ADR 0028 §8（L70–73）：成本纪律——只物化入选项、未入选子项零物化 | §5 D2、§8 T8 | `total = candidates.length` 由既有 O(N) 枚举顺带产出，零额外遍历、零额外物化；N=2000 毒值哨兵保持 | 否 |
| #369 设计 §13 R2：计数镜像层间张力 = 已登记 follow-up；缓解前提 = 独立预言机边界矩阵不得删除 | §5 D2/D6 | 本票执行该 follow-up；composition S4 矩阵（独立预言机）零改动保留（M4） | 否 |
| `packages/doc-runtime/AGENTS.md`：公共 API 只经 `src/index.ts`；公共面守卫逐导出记账；读不进写 sequencer | §5 D1/D3、§11 DENY | 零新值导出（`index.ts` 零改动）；既有类型名目已导出，仅成员形状变化；纯读路径 | 否 |
| `packages/namespace-runtime/AGENTS.md`：公共 API 只暴露 detached 投影；读在 sequencer 外 | §5 D3/D4 | 组合层收缩仍纯同步读、零 sequencer、零可变态 | 否 |

## 7. 设计决策与主要备选方案

### D1 — W1 成功结算三键化（`total` 声明类型 = `number`）

`packages/doc-runtime/src/window.ts`：

1. **结果联合**（L97–100）：

```ts
/** 数组面结算联合：成功恰三键 `{ok,value,total}`（ADR 0029 §5；total = 候选标识计数）。 */
export type ReadArrayWindowResult =
  | { ok: true; value: ArrayWindowEntry[]; total: number }
  | WindowReadFailure;
/** 键面结算联合：成功恰三键 `{ok,value,total}`（同上）。 */
export type ReadMapWindowResult =
  | { ok: true; value: MapWindowEntry[]; total: number }
  | WindowReadFailure;
```

   **类型选择 `number`（非 `number | undefined`）**：本票无 `where`，运行时恒为数值（SA6 §12.3-T2 强制）；最小足迹让组合层在类型上就无兜底可写。ADR 0029 §5 终态 `number | undefined` 属 P2（where）票的类型加宽——届时加宽是纯类型变更，本设计不预占。

2. **内核结算**（`WindowCoreResult` L139 成功成员加 `total: number`；`windowCore` 成功返回 L208 改 `{ ok: true, value: entries, total: candidates.length }`）。

3. **公共入口包装**（L116 / L130）：`return { ok: true, value: core.value as ArrayWindowEntry[], total: core.total };`（map 面同款）。键序 = 字面量序 `ok, value, total`（ADR 0029 §5 字面序；T1 断言 `Object.keys(...).sort()` = `['ok','total','value']` 等价允许）。

4. **注释同步**：头注 L24「A 装配：成功 `{ok:true, value:[…]} 恰两键（D9/B-5）」→ 三键措辞并引 ADR 0029 §5/§8（冻结解除 + total 下沉记载）；L97/L100 联合注释同步。`read.ts` 零 diff 复制纪律段（L27–29）**保持不动**（SA6 H7：ADR 0029 §8 只解冻窗口原语，`read.ts` 冻结维持）。

**失败面零改动**：`windowFailure`（L217–219）与全部失败路径不携带 `total`；三码 + `PATH_NOT_ALLOWED` 透传、own 键集恰四键（B-5）。

### D2 — `total` 语义 = 候选标识计数（枚举同源，逐位等价证明）

`total := candidates.length`，与 `value` 出自**同一次** `collectCandidates` 枚举（`windowCore` L189–196）：

- **数组面**：`enumerateArrayCandidates`（L503–522）对 Y.Array 按 `length`、plain array 按 `length` 逐下标 push（稀疏空洞计入）⟹ `candidates.length === target.length`，与被删 S4 的 `target.target.length`（window-read.ts L425）逐位一致。
- **键面**：`enumerateMapCandidates`（L524–542）Y.Map 按 `keys()` 过 `get(k) !== undefined`（L529 D6）、plain object 按 `Object.keys` 过 `readableOwnDataValue`（L536）⟹ `candidates.length` ≡ 被删 S4 的 `countMapEntries`（window-read.ts L435–447）逐位一致。
- **成本**：`candidates.length` 是枚举完成后的 O(1) 读，零额外遍历、零额外物化（ADR 0028 §8；SA6 §7）。
- **不变式**：`kept = Math.min(n, candidates.length)` ⟹ 结构上 `value.length ≤ total` 恒成立（S6 的 `truncated = kept < total` 无需防御分支；组合层**禁止** `total ?? 0` 之类兜底——O1 前提）。
- **排序/预算不变性**：`total` 在排序（S 段）与物化（M 段）**之前**由枚举产出，天然与 `orderBy` 基/方向、`depth`/`maxChildrenPerNode` 无关（T6/T7 的结构依据）。

**确定性等价（AC3「逐字节不变」的论证）**：全链路同步、无 await/yield；确定性调用下 S4 第二次导航必然重现同一候选空间（SA6 H6）⟹ 删除 S4 后 lease 可观察结果逐字节不变。唯一差异面 = 对抗性 trap 插入的文档变更（E4），属漂移修正且零契约覆盖（§9 边界）。

### D3 — 组合层收缩为纯组合层（删 S4 + 删镜像）

`packages/namespace-runtime/src/window-read.ts`：

**删除**：
- S4 调用点（L162–164）与 S4 函数块：`countWindowCandidatesAtPath`（L412–433，含 `export` 关键字——无包外消费者，实证见 §2.2）、`countMapEntries`（L435–447）、`countingDefectFailure`（L468–474，连同其 section 注释 L400）。
- W1 镜像整块（L476–742）中除 `safePathCopy` 外全部：`isNonNegInt`、`segMsg`、`yjsWord`、`isPlainRecord`、`readableOwnDataValue`、`readableArrayElement`、`NavCarrier`、`NavResult`、`navClassify`、`navigate`、`absentNav`、`notAllowedNav`、`TargetClassification`、`classifyArrayTarget`、`classifyMapTarget`、`describeCarrierWord`、`carrierOf`、`probeRoot`（即 SA6 X3 名单全部 + 两类型别名）。

**保留**（非 W1 冻结面，出处与理由重述）：
- `safePathCopy`（L479–486）：接缝失败构造 `windowFailure`/`seamWindowOptionsInvalid` 仍需新鲜安全 path 副本；window.ts 的 `safeSpreadPath` 是模块私有，而新增公共值导出被 P-W2/NC6 禁止 ⟹ 保留本地件，注文重述为「本地防御件（window.ts 同款纪律），非镜像纪律存续」（X2：`copied from window.ts@ab6e390` 至多此 1 命中且不再声称冻结/镜像；`copied from carrier.ts` 归零）。
- `foldSegment`（L393–398）：出处 `read-schema-projection.ts`（行注入防御纪律镜像，B-8 ②），非 W1 冻结面（X3 明示例外）。
- S3 全部（`canonicalWindowBudget` / `canonicalOrderBy`）、S5 全部（`anchorSchemaBody`）、S6 全部（`WINDOW_TRUNCATION_HEADER` / `windowFactsBlock` / `appendWindowFacts` / `windowPathText`）、`windowFailure` / `seamWindowOptionsInvalid`。

**签名与数据流**：
- `WindowComposeInput`（L93–104）：删除 `doc` 字段（S4 是其唯一体内消费者；redispatch 闭包在包装函数内直接捕获 `doc`）；新增 `readonly total: number`（W1 结算单源直通）。`redispatch` 声明类型维持 `{ readonly ok: true; readonly value: unknown[] } | WindowReadFailure`——三键成功成员结构可赋值（TS 结构化超类型），其成功成员字段本就不被消费（仅失败透传 + 出口②判据）。
- `composeArrayWindowRead` / `composeMapWindowRead`（L109–146）：追加末参 `total: number`：

```ts
export function composeArrayWindowRead(
  state: RuntimeState, doc: Y.Doc, path: readonly (string | number)[],
  options: NamespaceRuntimeReadArrayOptions, entries: ArrayWindowEntry[], total: number,
): NamespaceRuntimeReadArrayResult
```

  （内部签名自由，SA6 O2；本设计冻结为显式 `(…, entries, total)` 双参——数据流显式、改动最小。）
- `composeWindowRead`（L148–184）：编排收缩为 **S3 → S5 → S6**；S6 段 `const total = input.total;`（删除 `const counted = …` 与防御失败分支）；`truncated = kept < total`、✂ 装配判据逐字不变。
- 头注（L1–39）重写：删 S4 条目与「复制纪律（RA-3 / SA2 N-4）」段；职责句改为「total 消费自 W1 结算单源（ADR 0029 §8 下沉），本模块零计数、零镜像」。

**备选方案（已否决）**：
- **A1 保留 S4 作对账/防御双计数**：违反 AC2 结构契约（SA6 H9：票面明示「不再持有候选计数逻辑与镜像复制件」），且保留双份计数空间 = 保留 E4 漂移接缝，与单源根因相悖。
- **A2 抽共享模块合并镜像（window.ts ↔ read.ts 助手上移共享件）**：ADR 0029 §8 的动作是**删除**镜像而非抽取共享层；抽共享必触 `read.ts`（零 diff 红线，H7）或新建跨包共享面（加公共面）。镜像的规范归属本就是 doc-runtime——直接消费 W1 结算后组合层不再需要这些助手。
- **A3 导出 doc-runtime 公共 count 原语**：ADR 0029 §5「专用 count 是独立演进位」；且新增公共值导出违反 NC6/P-W2。
- **A4 组合层传整个 W1 成功成员 `compose*(…, w1)`**：与显式双参等价（O2 实现自由）；选双参以最小化签名churn并让「entries 与 total 同源」在调用点可见。

### D4 — runtime 消费点（`packages/namespace-runtime/src/runtime.ts`）

- `readArray`（L687–689）：`return composeArrayWindowRead(state, doc, path, options, windowResult.value, windowResult.total);`；`readMap`（L699–701）同款。
- JSDoc（L672–680）：L678「S3 canonical 接缝 → S4 O(N) 计数 → S5 锚链投影正文 → S6 四键结算 + ✂ 窗口事实块」删「S4 O(N) 计数」段，改述「W1 成功成员（含 total）交组合层：S3 canonical 接缝 → S5 锚链投影正文 → S6 四键结算 + ✂ 窗口事实块；total 消费自 W1 单源（ADR 0029 §8）」。
- S1/S2 语义零变化：lifecycle gate 先行、W1 失败成员原样透传（`if (!windowResult.ok) return windowResult;` 不动）。

### D5 — 注释/文档清账（X5）

| 位置 | 动作 |
|---|---|
| `window-read.ts` 头注 L1–39 | 删 W1 冻结/镜像纪律/S4 计数措辞（D3） |
| `runtime.ts` JSDoc L676–681 | 删「S4 O(N) 计数」措辞（D4） |
| `packages/doc-runtime/test/issue-368-window-read-contract-red.test.ts` 头注 B-5（L29–31） | 注释级措辞同步：「B-5 曾不锁键集；三键锁现由 P7 + 类型锁承载」（SA6 M3；非断言改动） |
| ADR 0028/0029、CONTEXT.md | **零改动**——PR #380 已写定（SA6 §10 文档行）；本设计不与任一 ADR 冲突（§11） |

### D6 — 测试迁移与增量（设计冻结；由实现票落地，本票不编写）

| # | 文件 | 动作（SA6 §12 承接） |
|---|---|---|
| M1 | `packages/doc-runtime/test/issue-368-window-read-design-pins.test.ts`（P7，L325–338） | 成功半 `toStrictEqual(['ok','value'])` → `toStrictEqual(['ok','value','total'])`；失败半两处四键断言零改动 |
| M2 | `packages/doc-runtime/test/public-surface-type-guard.test-d.ts`（L32–49 导入 / L85–90 声明处） | 增类型锁：`AssertTrue<Equal<keyof Extract<ReadArrayWindowResult,{ok:true}>, 'ok'\|'value'\|'total'>>` + `ReadMapWindowResult` 同款（HEAD 红，SA6 §5-E5） |
| M3 | contract-red 头注 B-5 | 见 D5（注释级） |
| M4 | `packages/namespace-runtime/test/**`、`packages/namespace-registry/test/**` | **零改动**（AC3）；`git diff --stat` 对两目录为空。若实现期发现某断言只在 W1 形状上耦合：先报设计修订，不得就地把期望改软 |
| P3 | `packages/doc-runtime/test/issue-381-window-total-red.test.ts`（新文件；或并入 #368 契约文件） | SA6 §12.3 T1–T9：三键 own 键集、total 数值性（T2）、独立预言机对账（T3：Y.Array length / plain array length 稀疏计入 / Y.Map 非 undefined 键 / plain object own-enumerable data 键非 undefined）、`min(n,total)`（T4）、边界矩阵（T5，沿 #369 S4/T7 fixture）、排序基不变性（T6）、预算轴不变性（T7）、N=2000 毒值零物化哨兵（T8）、失败面四键 + 三码 + `PATH_NOT_ALLOWED` 透传（T9） |
| P5 | `artifacts/sa3-issue381-*.log` | X1–X5 结构审计原始输出（grep 命中 + 行数清点），供 SA4/SA9 复核 |

**断言纪律（契约继承）**：全部锚定运行时行为；total 断言必须使用**独立预言机**（原生/Yjs 直数，零实现复用——禁把期望对象与实际从同一构造器派生）；禁 skip/only/todo、env override、fallback、吞错；T 组在 HEAD 红（红因 = total 缺席）、实现后绿；R 组实现前后均绿且文件零 diff（refactor 基线不伪称红）。

## 8. 接口、状态机与数据流

### 8.1 接口变化总览

| 面 | 变化 | 类型/性质 |
|---|---|---|
| doc-runtime `ReadArrayWindowResult` / `ReadMapWindowResult` | 成功成员增必填 `total: number` | 公共类型面加法成员（失败成员零变化） |
| doc-runtime 值导出集 | 零变化 | NC6/P-W2 守卫不动 |
| namespace-runtime `composeArrayWindowRead` / `composeMapWindowRead` | 追加 `total: number` 末参；`WindowComposeInput` 删 `doc` 增 `total` | 模块内部签名（不进 `src/index.ts`，无公共面影响） |
| namespace-runtime 公共类型（`NamespaceRuntimeRead*` 四名目） | 零变化（成功仍四键） | `src/index.ts` 零改动 |
| registry lease / types | 零变化 | AC3 |

无状态机变化（全部纯同步读，零可变态、零 sequencer、零订阅）。

### 8.2 数据流路线

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| ① W1 单遍枚举（doc → 候选空间） | `readArray/readMap`（runtime.ts S2）持 raw options 调 `readArrayWindowAtPath`/`readMapWindowAtPath` | 无写入（纯读 live Y.Doc） | G0→OPT→N0→N1→C/E 枚举：`candidates[]`（标识 + 排序键，零物化） | 进程内局部数组 | `windowCore` 内部 | `total = candidates.length` 与后续 `kept = min(n, total)` **同源** | 失败：三码 + `PATH_NOT_ALLOWED` 四键结算原样上抛；无清理义务 | T3/T5/T8（独立预言机 + 毒值哨兵） |
| ② W1 选窗物化（候选 → 条目） | 同①内（S 排序 → M 逐项 `readLogicalValueAtPath`） | 无写入 | 仅前 `kept` 项物化；任一项失败 fail-fast 整窗失败 | 进程内 | `entries[]` | 成功 `{ok:true, value: entries, total}`（恰三键） | 物化失败透传 `PATH_NOT_ALLOWED`（path 精确到项） | T1/T4/T9；NC4 |
| ③ S3 canonical 接缝（options 重读） | `composeWindowRead`（runtime 成功后） | 无写入 | descriptor 纪律重读 options 四键空间；不稳定 → 重派发 W1 一次（出口①失败透传 / 出口②接缝终态） | 进程内 | `canonical.budget` / `canonical.term` | 正常：归一化预算 + 排序项；异常：`WINDOW_OPTIONS_INVALID` 响亮失败 | 零外抛（trap 收编） | R 组既有用例（S3 两出口）零改动保持绿 |
| ④ S5 锚链投影 | `anchorSchemaBody(state, segments, face, budget)` | 无写入 | `normalizeReadPath` 单次快照 → `projectSchemaTextBody`（`[...path,0]` / `['<key>']`→容器两级） | 进程内 | schema 正文（string \| null） | 锚不可解析 → `schema: null`（非读失败） | 无 | R6（组合式 depth 等价锚）零改动 |
| ⑤ S6 结算（单源 total 消费） | `composeWindowRead` 尾段 | 无写入 | `kept = entries.length`；`total = input.total`（①同源直通，组合层零重算）；`truncated = kept < total`；truncated ∧ 正文非 null → ✂ 块 | 进程内 | lease 四键 `{ok, value, schema, truncated}` | 逐字节 ≡ HEAD（确定性输入下） | 无兜底、无防御分支（S4 防御位随单源消失） | R1–R3（四键 + ✂ 事实行 byte 级）；E2 变异防线 |
| ⑥ registry 透传 | `lease.readArray/readMap` | 无写入 | raw 引用直传 runtime 联合 | 进程内 | 调用方 | lease ≡ runtime（`toStrictEqual`） | released 短路先于透传 | R4/R5、NC7 |

跨模块/跨包边界：①②在 `@nomicore/doc-runtime`，③–⑤在 `@nomicore/namespace-runtime`（经 `@nomicore/doc-runtime` 公共入口跨包调用），⑥在 `@nomicore/namespace-registry`。全部同进程同步、单 Y.Doc、无网络/持久化/wire 形态变化；失败可见性 = 结果联合成员（不抛、不吞）。

### 8.3 错误、恢复、并发与幂等

- **错误**：失败词表与形状零变化（三码 + `PATH_NOT_ALLOWED`；own 键集恰四键、无 `value`/`total`）。删除的两个防御构造（`countingDefectFailure` 及其 `PATH_NOT_ALLOWED` 分支）随 S4 消失——其触发条件（W1 成功后第二次导航失败）在单源下结构性不存在，删除不缩小任何可达失败面。接缝终态 `seamWindowOptionsInvalid` 保留。
- **恢复/重试**：无新重试路径；S3 出口①重派发语义不变（重派发产物含 `total` 但不被消费——仅失败成员透传）。
- **回滚**：单变更集，`git revert` 即恢复两键 + S4；无数据迁移、无持久化格式、无 wire 影响。
- **并发/幂等**：读在写 sequencer 外（包契约）；全同步无 yield；模块级零可变态 ⟹ 天然幂等。`maxWorkers:1` 下测试确定性不变。

## 9. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| `namespace-runtime/src/runtime.ts` `readArray`/`readMap`（唯一直接值消费者） | 消费 `windowResult.value`；S4 在组合层自算 total | 消费 `windowResult.value` + `windowResult.total` 并传组合层 | D4（2 处调用 + JSDoc） | runtime.ts L687–701 |
| `namespace-runtime/src/window-read.ts` 组合层 | S4 自算 total；镜像导航 | 删 S4/镜像；消费传入 total | D3 | window-read.ts L162–184/L400–447/L476–742 |
| `namespace-runtime/src/index.ts` | type-only 转出四名目 | 零变化 | 无 | index.ts L64–70 |
| `namespace-registry/src/lease.ts` / `types.ts` | 原样透传 + 别名跟随 | 零变化（透传联合成员形状未变——lease 面恒四键） | 无 | lease.ts L309–315；types.ts L468–482 |
| `doc-runtime/src/index.ts` | 类型名目已全量导出 | 零变化（成员形状变化在 window.ts 内部） | 无 | index.ts L45–63 |
| doc-runtime pins / type-guard / contract-red 测试 | 两键锁 / 无类型锁 / B-5 注释 | 三键迁移 + 类型锁 + 注释同步 | D6-M1/M2/M3 | §2.4 |
| namespace-runtime composition / registry lease 测试 | 独立预言机 + 失败成员对比 + lease≡runtime | **零改动全绿**（M4；成功面无「lease 整对象 vs 原语整对象」断言，唯一 `toStrictEqual` 均在失败成员上） | 无 | composition L252–325；lease L706/F1/F2（失败面） |
| apps / domains | 零窗口面消费 | 零影响 | 无 | grep `-rl` 清点（§2.3） |
| `readLogicalValueAtPath` 姊妹面 | 两键/四键冻结 | 零变化（增键不回渗，NC1/NC2） | 无 | SA6 §6 |

## 10. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/doc-runtime/src/window.ts` | 结果联合成功成员加必填 `total: number`（L97–100）；`WindowCoreResult`（L139）与 `windowCore` 成功返回（L208）携 `candidates.length`；两公共入口成功字面量（L116/L130）；头注 L24 与联合注释三键措辞（引 ADR 0029 §5/§8） | AC1 加键 + 冻结解除记载（D1/D2） |
| `packages/namespace-runtime/src/window-read.ts` | 删 S4 调用点（L162–164）与函数块（L400–447、L468–474）；删镜像整块除 `safePathCopy`（L476–742，保留件注文重述）；`WindowComposeInput` 删 `doc` 增 `total`（L93–104）；`composeArray/MapWindowRead` 追加 `total` 末参（L109–146）；S6 消费 `input.total`（L175–183）；头注 L1–39 重写 | AC2 组合层收缩 + total 单源消费（D3） |
| `packages/namespace-runtime/src/runtime.ts` | 两处组合调用传 `windowResult.total`（L689/L701）；JSDoc L676–681 删「S4 O(N) 计数」措辞 | AC2 消费点 + X5 清账（D4/D5） |
| `packages/doc-runtime/test/issue-368-window-read-design-pins.test.ts` | P7 成功半两键 → 三键（L326–331 区段）；失败半零改动 | AC4 迁移（D6-M1；E3 实证唯一两键锁） |
| `packages/doc-runtime/test/public-surface-type-guard.test-d.ts` | 增两面成功成员键集类型锁（导入 L32–49 / 声明 L85–90 / 新断言） | AC4 类型锁（D6-M2；E5 实证 HEAD 红） |
| `packages/doc-runtime/test/issue-368-window-read-contract-red.test.ts` | **仅头注 B-5 措辞**（L29–31，注释级非断言） | X5 清账（D5/D6-M3） |
| `packages/doc-runtime/test/issue-381-window-total-red.test.ts`（新） | T1–T9 新用例组（§7 D6-P3；独立预言机纪律） | AC1/AC4 值断言增量（HEAD 测试族不校验 total 值——E3 反伪绿） |
| `artifacts/sa3-issue381-*.log`（模式） | X1–X5 结构审计输出（grep 命中、行数清点、聚焦/全仓门日志） | AC2 结构性证据留档（SA6 §12.6/P5；供 SA4/SA9 复核） |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/doc-runtime/src/read.ts` | 姊妹读原语（W1 逐项物化依赖） | `read.ts` 零 diff 红线维持（ADR 0029 §8 只解冻窗口原语；SA6 H7） |
| `packages/doc-runtime/src/carrier.ts` | `probeRoot`/`carrierOf` 的规范归属（window.ts 消费方） | 本票不动其单一来源；镜像删除后组合层不再需要它们 |
| `packages/doc-runtime/src/index.ts` | 公共面守卫 | 零新值导出、类型名目已全量导出（NC6/P-W2） |
| `packages/doc-runtime/test/public-surface-guard.test.ts` | 值导出守卫（P-W1/P-W2） | 守卫断言（恰两枚窗口值导出）在新形状下仍绿；零改动 |
| `packages/namespace-runtime/src/index.ts` | 公共类型转出 | 四名目形状未变（lease 面恒四键） |
| `packages/namespace-runtime/src/read-schema-projection.ts` | S5 依赖（`normalizeReadPath`/`projectSchemaTextBody`/`foldSegment` 出处） | S5 锚链零变化 |
| `packages/namespace-runtime/test/**`、`packages/namespace-registry/test/**` | AC3 回归面 | M4 零 diff（含 fixture `issue-369-window-read-fixture.ts` 与形状集中化门）；发现耦合先报设计修订 |
| `packages/namespace-registry/src/**`（lease.ts / types.ts 等） | lease 透传面 | AC3 逐字节不变 |
| `docs/adr/0028-window-read.md`、`docs/adr/0029-filtered-window-read.md`、`CONTEXT.md` | 规范文本 | PR #380 已写定；本票实现规范而非修订规范 |
| `vitest.config.ts` / `tsconfig.*` / `package.json` | 运行器配置 | 新测试文件按既有命名自动采集（SA6 §14） |
| `wiki/raw/task_issue-381.md`、`wiki/raw/task_issue-381_sa6_contract.md` | Host/上游产物 | 只读输入 |

## 11. 验收与验证映射

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1 两面成功恰三键 + total 语义 | SA6 §5 探针（HEAD 红：键集两键、total undefined）；E5 类型红 | P3-T1（own 键集恰三键，多/少一键红）、T2（`typeof number` + 整数 + ≥0）、T3（独立预言机逐位对账：Y.Array/plain array length 稀疏计入；Y.Map 非 undefined 键；plain object own-enumerable data 键非 undefined）、T4（`value.length === min(n, total)` 两向）、T5（边界矩阵沿 #369 fixture：空载体 / undefined 值键 / accessor / 稀疏 / ROOT 面 9）、T6/T7（排序基与预算轴不变性）、T9（失败面四键 + 三码 + 透传不变） | HEAD 红 → 实现后绿；失败半负控实现前后均绿 |
| AC1 零物化纪律 | NC4 探针 + lease E3（现状绿） | P3-T8：N=2000 毒值 + n=2 → `ok:true`、`value.length=2`、`total=2000` | 「为 total 全量物化」的实现必红；实现前后哨兵不削弱 |
| AC2 组合层去计数/去镜像 | SA6 §5 grep 清点（S4 + 11 标记在场） | X1：`grep -n "countWindowCandidatesAtPath\|countMapEntries\|countingDefectFailure" packages/namespace-runtime/src/*.ts` = 0 命中；X2：`copied from window.ts@ab6e390` ≤1（仅 `safePathCopy` 且注文重述）、`copied from carrier.ts` = 0；X3：镜像函数名全量 0 命中（`foldSegment` 例外）；X4：L476–742 镜像块除 `safePathCopy` 全删、无「保留但注释掉」；X5：头注/JSDoc/B-5 措辞清账。输出记 `artifacts/sa3-issue381-*.log` | 结构审计全过；`window-read.ts` 行数单调下降 |
| AC2 删 S4 后组合面行为不变 | E2 变异（total 承重 16 红）；确定性等价论证（§5-D2） | 既有 composition S4 矩阵（独立预言机）+ S3 两出口 + S5 oracle + lease T1–T7/E3/E4/F1–F6 **零改动全绿**（M4/R1–R6）；✂ 事实行 byte 级断言（`kept 2/total 3`、`kept 2/total 2000`、`- [] · 窗口 · 基 key asc · kept 2/total 9` 等） | 实现前后逐字节一致；两测试目录 `git diff --stat` 为空 |
| AC3 lease 公共面逐字节不变 | NC5–NC7（现状绿）；失败面 `toStrictEqual` 仅失败成员 | R1（恒四键 helper）、R2（truncated ≡ 预言机）、R3（✂ byte 级）、R4（失败透传 + released/lifecycle）、R5（lease ≡ runtime `toStrictEqual` + 类型锁 fail-closed）、R6（depth 等价锚） | 全部既有用例零改动保持绿 |
| AC4 测试家族迁移 | E3（P7 唯一两键锁）；E5（类型锁 HEAD 红） | M1（P7 三键）、M2（类型锁 `Equal<keyof Extract<…,{ok:true}>, 'ok'\|'value'\|'total'>` 两面）、M3（B-5 注释） | 迁移后绿；不迁移即红（红因 = 新增键，形状变更本体） |
| AC5 全仓门 | SA6 §4 基线（typecheck/test exit 0；392 文件/4730 用例） | G1：`pnpm typecheck` exit 0；G2：`pnpm test` exit 0（含 `--typecheck` 的 .test-d 采集） | 实现后全绿；聚焦窗口家族 5 文件 + 新文件先绿再全仓 |
| 反伪绿防线 | E3（HEAD 族不校验 total 值） | §7 D6 断言纪律：total 断言必用独立预言机（禁同构造器派生期望）；变异防线（`total := kept` / +1 / 负 / undefined / 物化全量 / where 式过滤计数）必须击穿 T2–T5/T8/X1–X3/R2–R3（SA6 §12.8） | 每条变异至少一个用例红 |

## 12. 风险、回滚和残余问题

| # | 风险/边界 | 等级 | 处置 |
|---|---|---|---|
| R-381-1 | **E4 对抗场景语义变化**：下沉后 lease 的 `truncated`/✂ 从「与 value 不同快照」（HEAD：`kept 3/total 4`）修正为「同源一致」（`total=3`、`truncated:false`）。无既有契约覆盖（现有测试全绿不受影响） | 低（非阻断边界） | 登记**不判负、不写断言、不引入新读路径**（SA6 §12.9/O4）；确定性调用下逐字节不变（§5-D2 论证）。若未来 Owner 要求对该场景立约，需新契约票 |
| R-381-2 | 大块删除（~300 行）误伤保留件 | 低 | X1–X4 结构审计 + `pnpm typecheck` 双护栏；保留件清单在 §5-D3 显式冻结（`safePathCopy`/`foldSegment`/S3/S5/S6/两失败构造） |
| R-381-3 | composition 测试 describe 标签含历史词「S4」（如「S4 total 计数独立预言机」） | 无 | M4 零 diff 优先级高于措辞洁癖：标签是历史锚，断言全部 oracle 化、不依赖实现分期；X5 清账范围不含该文件（SA6 §12.6 明示三处） |
| R-381-4 | P2（where）票加宽 `total: number \| undefined` 时组合层引入 `?? 0` 兜底 | 未来 | 本设计以 `number` 收窄类型 + 禁兜底纪律（O1 前提）预堵；P2 票设计期复查 |
| R-381-5 | `redispatch` 成功成员形状变化（多 `total` 键）被误消费 | 低 | 设计冻结：redispatch 产物仅用于失败透传与出口②判据（§5-D3）；声明类型维持结构超类型，成功字段零消费 |
| 回滚 | 单变更集 `git revert`；无迁移/持久化/wire | — | 全仓门在还原态复绿（SA6 §16 先例） |

**任务内必要条件**：全部满足（无未解决必要条件伪装为 follow-up）。**明确 follow-up（任务外）**：P2 `where` 词表落地（ADR 0029 §5/§6 全量语义）；`read.ts` 冻结解除评估（不属本票）；专用 count 演进位（备案）。

## 13. 评审修订映射

`wiki/raw/task_issue-381_sa2_review.md` 不存在（iteration 0，无评审输入）。无 finding 可映射；后续轮次收到评审后在此逐条落实。

## 14. 是否需要设计后 ADR 冲突复查

**需要（`requiresConflictRecheck: true`）**。理由：

1. **公共 API 类型面变化**：doc-runtime 两结果联合成功成员增必填 `total`（全仓唯二直接值消费者的签名联动）——命中「公共 API 变化」复查条件。
2. **解除既有冻结面**：`window.ts` 的包范围冻结是 #368/#369 设计级纪律，本票执行 ADR 0029 §8 的解除指令——命中「触碰冻结面 / 修订既有决策」条件。
3. **SA8 产物缺席**：`task_issue-381_relevant_decisions.md` 与 `_conflict_report.md` 均不存在，无法经固定产物确认与其他在册决议零交叠（§6 替代约束面已尽量收敛：ADR 0028/0029 文本、#369 R2、包 AGENTS.md 边界）。

自查结论（供复查输入）：本设计与 ADR 0029 §5/§8 逐字一致、与 ADR 0028 §7/§8 零冲突（lease 四键与 ✂ 文法不变、成本纪律不削弱）、与 ADR 0027（✂ 唯一事实载体）零接触、不触 wire/schema/持久化/状态机；预期复查结论为无冲突，但按门禁条件仍应过 SA8 复查。
