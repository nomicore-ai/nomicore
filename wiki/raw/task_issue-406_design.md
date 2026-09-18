# SA1 实施架构设计 — Issue #406 窗口面同轴：`readArray` / `readMap` 的 `maxBytes`

- 派发：`sa-7feb911c-c02b-4069-85da-d95ab5f35b83`（role `mabf-sa1`，phase `design`，iteration 0）
- Worktree：`/home/wangjian/nomicore-fix-issue-406`（branch `mabf/issue-406`，HEAD `56cf5428…` = `fix(#405)`，与 SA6 契约基线一致）
- 验收权威：`wiki/raw/task_issue-406_sa6_contract.md`（rev1，verdict **approve**；18 冻结锚 + 六份契约测试已落盘 + 两处既有类型锁原位延伸）
- 上游设计基座：`docs/adr/0031-readdata-byte-budget.md`（决策 1–6）+ 父票 `#405` 实现（`56cf542`，readData 面镜像对象）

---

## 1. 任务类型、目标与非目标

**类型 = Feature（能力缺口）**。HEAD 上不存在「窗口读返回了错误的预算结果」的故障；存在的是
预算闸能力整体不存在——携带 `maxBytes` 的任何窗口调用在 W1 options 键空间门被拒
（`WINDOW_OPTIONS_INVALID`「未知键：maxBytes」，与值无关；SA6 §5 P1 A1–A20/M1–M4 实测）。

**目标**：`readArray` / `readMap` 的 options 追加与 `readData` 同形的 `maxBytes?`
（≥1 有限整数 ≤ 2^53−1；非法 → `WINDOW_OPTIONS_INVALID`，message 含 `maxBytes` 域标识）；
总量 = 条目列表（含 key/index 包装）紧凑 JSON UTF-8 + 元素口径投影文本 UTF-8
（✂ 窗口事实块 / `‡` 折叠页脚 / 正文自然计入；`schema:null` 计 0）；超限 → 与 `readData`
**同码同文同载荷**的 `READ_BUDGET_EXCEEDED` 恰五键零交付分支（`path` = 窗口目标路径新鲜回显，
`measuredBytes` = 两通道合计）；`≤` → 成功，交付物与同参无预算读**逐字节相同**；where 过滤窗口
超限走同一分支，装满判定（`kept === n`）与「✂ 永不装配」不受预算影响，无任何静默条目丢弃；
registry lease 别名零改动跟随（options + 结果联合）。

**非目标**（全部沿 CONTEXT.md「字节预算」`_Avoid_` 与 ADR 0031 备选否决表）：

- 不做裁剪 / 部分交付 / 降深度拟合（超限 = 零交付拒绝，非修剪）；
- 不做错误载荷拆分值/口径分项（`measuredBytes` 只报合计）；
- 不新增校验码（窗口面域违约复用 `WINDOW_OPTIONS_INVALID`，超限复用 `READ_BUDGET_EXCEEDED`）；
- 不改 doc-runtime（类型五键 + 行为未知键拒，ADR 0031 决策 4 零改动面）；
- 不改成功面恒四键 / ✂ 文法 / 头行（窗口 schema 无头行，本就零预算段）/ `DeepOptional` / 渲染器；
- 不动窗口 O(N) 选窗与物化纪律（`#368/#369/#381/#382/#383` 既有面）；本票新增成本 = 一次
  `JSON.stringify` + `Buffer.byteLength` 度量（不塑形、不重物化）；
- 不承诺 ADR 0031 登记的演进位（可选裁剪 `over:'trim'`、载荷拆分、where 计数通道）。

## 2. 当前行为与证据锚点（HEAD `56cf542`）

| # | 事实 | 锚点 |
|---|---|---|
| B1 | W1 `validateWindowOptions` 白名单恰五键（`n/orderBy/depth/maxChildrenPerNode/where`），未知键（含 `maxBytes`、present-undefined 未知键）→ `WINDOW_OPTIONS_INVALID`「window options 含未知键（封闭形状）：<key>」 | `packages/doc-runtime/src/window.ts` L311–L315（W-1 键集门） |
| B2 | W1 内核定序：G0（非数组 path → `PATH_NOT_ALLOWED`，**零 options 读取**）→ OPT（options 校验）→ N0 ROOT 探针 → N1 导航（缺席 → `WINDOW_TARGET_ABSENT`）→ 载体面（`WINDOW_CARRIER_MISMATCH`）→ 枚举/过滤/排序/物化 → `{ok, value: entries, total}` | 同上 L205–L255（`windowCore`） |
| B3 | runtime `readArray`/`readMap` 编排 = S1 lifecycle gate（`readDisabled`，零 options 读取）→ S2 W1 **raw options 直通** → 成功后 `composeArrayWindowRead`/`composeMapWindowRead`（S3 canonical 五键镜像 → S5 锚链投影 → S6 四键结算） | `packages/namespace-runtime/src/runtime.ts` L861–L882；`window-read.ts` L171–L211 |
| B4 | S3 `canonicalWindowBudget` 五键白名单镜像 W1 判据；视图不稳定 → 重派发 W1（raw）→ 出口①失败透传 / 出口②接缝终态 `WINDOW_OPTIONS_INVALID`（「视图不稳定」） | `window-read.ts` L250–L310、L179–L184、L551–L557 |
| B5 | S6 结算：`truncated = total === undefined ? kept === canonical.n : kept < total`；`total === undefined` ⟺ where 在场（✂ 永不装配由分支结构保证）；✂ 窗口事实块仅在无 where ∧ 截断 ∧ 正文非 null 时装配 | `window-read.ts` L195–L210 |
| B6 | 窗口 options 类型 = doc-runtime 五键**纯别名**（`NamespaceRuntimeReadArrayOptions = ReadArrayWindowOptions`）；结果联合 = 成功四键 \| `WindowReadFailure` \| `RuntimeReadDisabledResult`（无预算失败成员） | `window-read.ts` L69–L98 |
| B7 | `readData` 面 `maxBytes` 已落地（本票镜像对象）：S2b-0 G0 前置分支 → `splitReadDataOptions`（raw 第一读者，`maxBytes` 剥离/域拒前置）→ T1(relay) 权威校验 → `canonicalReadOptions`（三键白名单 + `maxBytes` 复读为**闸门权威**）→ 投影 → S2b-5 预算闸（`deliveryBytes` = `utf8(JSON.stringify(value)) + utf8(schemaText)`）→ 超限 `readDataBudgetExceeded` 恰五键 | `runtime.ts` L764–L846、L1107–L1325 |
| B8 | `readData` 超限文案（三面同文镜像基准）：`READ_BUDGET_EXCEEDED: 读交付总量 N 字节超出 maxBytes M——零交付拒绝（不裁剪、不降深度；ADR 0031）` | `runtime.ts` L1321–L1324；契约模板 `issue-406-window-maxbytes-fixture.ts` L201–L203 |
| B9 | lease `readArray`/`readMap`：released 短路（冻结三键）先于透传；active 期 raw 引用直传；类型 = runtime 单源别名（`types.ts` L482/L487/L492/L495；Equal 锁 `lease.ts` L492–L502） | `packages/namespace-registry/src/lease.ts` L338–L345 |
| B10 | 无预算窗口读敌意面描述符**计数锚**：状态化 trap（第 3 次起抛）→ 总计 **4** 次 descriptor 读；交替 trap（仅第 3 次抛）→ 总计 **5** 次（W1 #1/#2 → canonical #3 → 重派发 W1 #4/#5） | `packages/namespace-runtime/test/issue-369-window-read-composition-red.test.ts` L226–L246 |
| B11 | 契约测试已落盘且被真实入口收集：5 新文件 + 2 处既有 `.test-d.ts` 原位延伸（纯别名 `Equal` → `Omit<…,'maxBytes'>` 中继锁）；HEAD 红 = 恰 4 个 `issue-406-*` 契约文件（22 tests），其余 418 files / 5073 tests 全绿 | `git status`（M ×2 + ?? ×5）；`artifacts/sa6-issue406-fulltest-with-contract.log` |
| B12 | `tsconfig.base.json` `exactOptionalPropertyTypes: true`（显式 `maxBytes: undefined` 对 TS 字面量调用者编译红——D1 只在运行时/JS 调用者可观测） | SA6 §4；`tsconfig.base.json` |

## 3. 根因（能力缺口链，承接 SA6 §8）

组合层（`@nomicore/namespace-runtime`）三级缺失：① options 类型面无 `maxBytes` 轴
（纯别名到 doc-runtime 五键）；② 无窗口交付总量度量（唯一同时见到条目列表与元素口径投影
文本的层未接入度量——W1 结构上只看条目与计数，看不到投影文本，度量不可能住 W1）；③ 结果
联合无预算失败分支（`READ_BUDGET_EXCEEDED` 在窗口联合结构不可达）。缺口为纯加法能力，
无既有语义缺陷（`readData` 面文案/域/形状已由 `#405` 就位）。

## 4. Owner 要求落实

当前任务简报（`wiki/raw/task_issue-406.md`，Host 经 GitHub REST 刷新，Issue updated
2026-09-18T02:09:17Z）`## Comments` 段为空；SA6 契约 §2 亦载 REST Issue-comment 快照 `[]`。
**本次复核确认：无评论来源的 override、豁免或附加义务。** 全部义务 = Issue #406 正文
AC1–AC7（§12 验收映射）+ ADR 0031 决策 1–6 与其「验收」节 + 父票 SA8 遗留 OBL-WIN-1/RA-1/RA-3
（§6）+ CONTEXT.md「字节预算 / 窗口读 / 过滤窗口」三词条。

| Comment ID | Updated at | Requirement | Design section |
|---|---|---|---|
| —（无评论） | — | — | — |

## 5. 复现和根因承接

| 上游事实（SA6 契约） | 证据位置 | 设计响应 |
|---|---|---|
| 缺口复现：任何合法 `maxBytes` 调用 → `WINDOW_OPTIONS_INVALID` 未知键（跨值域/跨面/跨 schema 状态逐字相同） | 契约 §5 P1 A1–A20/M1–M4（`artifacts/sa6-issue406-probe-runtime.log`） | §7 DD-3：split 拆分读把 `maxBytes` 从 W1 五键视野剥离，W1 直下传 relay |
| 类型面缺口：runtime/lease 调用点 TS2353 ×5；`Extract<窗口联合, READ_BUDGET_EXCEEDED>` = `never` | 契约 §5 P2（`…-probe-types.log`） | §7 DD-2/DD-8：runtime 自持六键 options + 两面联合追加共享预算成员 |
| 18 锚无预算冻结字节（`total = utf8(JSON.stringify(value)) + utf8(schema)`）与边界对（`total` 收 / `total−1` 拒） | 契约 §12.0 + fixture `WINDOW_ANCHORS_406` | §7 DD-6：度量等式构造性落地（`deliveryBytes` 复用，塑形后计量） |
| 参考闸门 18/18 绿、6 变异体各被 ≥1 判据击穿（断言可实现且敏感） | 契约 §9 E2（`…-probe-gate.log`） | 设计不触碰断言；实现只满足观测面 |
| 负控 N1–N9（HEAD 绿、实现后必须保持）：无预算冻结锚、G0 定序、非 enumerable ≡ 缺席、doc-runtime 拒 `maxBytes`、lifecycle 先行、敌意零外抛零 `[[Get]]`、readData 镜像文案、where 既有语义、形状集中化门 | 契约 §6 + 控制组测试 | §7 DD-4/DD-5/DD-9（定序与读纪律逐点保持）；§11 DENY（doc-runtime 零 diff） |
| SA6 §12.7 设计 pin D1–D7（ADR 未逐字钉死的自由位） | 契约 §12.7 | §7 逐 pin 收口（D1/D2/D3/D4/D5/D6/D7 全部采推荐解，无「另有选择」） |

## 6. SA8 约束落实

本票 SA8 产物缺席（无 `task_issue-406_relevant_decisions.md` / `_conflict_report.md` /
`_design_conflict_report.md`）——按纪律改为**直接实读 ADR 全集**并对齐父票 SA8 裁决；
`requiresConflictRecheck = true`（§15）。

| 决议或义务 | 出处 | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|---|
| **OBL-WIN-1**（父票 RA-5/RA-D5 挂账，本票兑现对象）：窗口面三面义务——同构度量、同码同文同载荷形、`WINDOW_OPTIONS_INVALID` 负控、message 逐字镜像 `readData` 选定文案 | `task_issue-405_design_conflict_report.md` §3/#9、§8 RA-D5 | §7 DD-6/DD-7 | 兑现：共享文案模板单源（`read-budget.ts`）+ G3 三面一致性锚 | 是（兑现方式核对） |
| RA-1（域钉死）：`maxBytes` 规范域 = 有限整数 1..2^53−1（`Number.isSafeInteger(v) && v >= 1`） | 同上 §3/#1 | §7 DD-3/DD-5 | split 与 canonical 双处同判据；`2^53`/`2^53+2`/`1e21` 拒（G5 C-LIMIT 组级判据） | 是（实现后核对） |
| RA-3 / **OBL-DOC-406-1**（文档挂账，非阻塞但不得跨迭代悬空）：`.agents/skills/nomicore/typed-access.md` 窗口读小节（L148–L205）补窗口 `maxBytes` 词汇；清退对象 = 无（该小节未误述，只是尚未提及） | 契约 §3/§12.6 | §11 ALLOW（文档落点）+ §12 | 同变更集或紧随同迭代落地：同码同文、总量 = 条目列表 JSON + 元素投影文本、where × 预算三条语义（超限同分支 / 装满判定不受影响 / ✂ 永不装配） | 是（兑现监督） |
| ADR 0031 决策 1/3：窗口面用既有码 `WINDOW_OPTIONS_INVALID`，不新增校验码；决策 2：窗口同构度量；决策 4：校验与度量住 runtime 组合层、doc-runtime 零改动、lease 别名跟随 | `docs/adr/0031` L16/L24/L42–43 | §7 DD-1/DD-3/DD-6/DD-8 | 全部条款直接兑现；doc-runtime/vfsl/渲染器零 diff | 是（RA-D4 同款实现后核对） |
| ADR 0028：窗口读组合分层（W1 载体原语 + 第三层组合）；`WINDOW_OPTIONS_INVALID` 稳定码 | `docs/adr/0028` | §8 编排 | 分层不动，预算轴加在第三层 | 否（分层未变） |
| ADR 0029：where × ✂ 永不装配；装满判定 `kept === n`；`total` 结算单源；§8 组合层零计数/零谓词求值镜像 | `docs/adr/0029` | §7 DD-6 | 预算闸在 S6 结算**之后**，不触碰 truncated 与 ✂ 分支结构 | 否（G6/C9 锚定） |
| ADR 0027：投影文本形态；✂ 唯一载体；渲染器零选项纯函数；头行文法不动（窗口 schema 无头行） | `docs/adr/0027` | §11 DENY | 渲染器 / `read-schema-projection.ts` 零 diff | 否 |
| ADR 0008 + 三包 AGENTS：reads 不进 sequencer、同步结果联合、lifecycle 停接纳稳定码、公共面只暴露 detached 投影 | `docs/adr/0008`；模块 AGENTS | §9 | 全同步、零状态写入、零 sequencer；S1 lifecycle gate 原样 | 否 |
| ADR 0023 + 值导出审计：公共面演进可控、值导出键集恰 `RuntimeWriteFatalError` | `runtime-acceptance-exports-audit.test.ts` | §7 DD-1 | index.ts 零改动、零新导出名（预算成员经 `Extract` 结构可达） | 否 |
| `docs/AGENTS.md` Editing：代码行为变化须同步每份陈述该契约的规范文档 | `docs/AGENTS.md` | §11（OBL-DOC-406-1 唯一落点） | `CONTEXT.md` L54 已声明三读面（零 diff）；`docs/integration/*` 仅述 readData 面（无需改） | 是（兑现监督） |

## 7. 设计决策（DD）与主要备选方案

> SA6 §12.7 pins 全部收口如下；无任何 pin 选「条件解」，故不触发「原位修订契约」义务。

### DD-1 变更落点与模块布局（ADR 0031 决策 4）

全部生产改动集中在 `packages/namespace-runtime/src/**`：

| 文件 | 改动 |
|---|---|
| `src/window-read.ts` | ① 两 options 别名 → **runtime 自持六键 interface**（DD-2）；② 两结果联合**追加共享预算成员**（DD-8）；③ `canonicalWindowBudget` 白名单五→六键 + `maxBytes` 域镜像 + ok 分支携 `maxBytes`（DD-5）；④ `composeWindowRead` 在 S6 schema 装配后新增 **S6.5 预算闸**（DD-6） |
| `src/runtime.ts` | ① `readArray`/`readMap` 编排改造：S2-G0 前置分支 + S2-split + W1(relay) + compose(raw, 重派发闭包)（DD-4/DD-9）；② 新增 `splitWindowOptions` + `windowBudgetAxisInvalid` + 三条窗口面 `maxBytes` message 常量（DD-3/DD-7，镜像 `#405` 段落布局）；③ `readData` 的 `readDataBudgetExceeded`/`deliveryBytes`/`echoReadPath` 局部定义迁往 `read-budget.ts` 并改 import（行为零变化，模板逐字节不变——C8 锚） |
| `src/read-budget.ts`（**新**，包内内部模块，不经 `index.ts` 导出） | 三面共享件单源：`READ_BUDGET_EXCEEDED` message 模板构造器、`readBudgetExceeded(path, measuredBytes, maxBytes)` 恰五键构造器（内含 `echoReadPath` 新鲜回显）、`deliveryBytes(value, schemaText)` 两通道度量、`ReadDataBudgetExceededResult` 接口（自 `runtime.ts` 迁入，`runtime.ts` 原位 `export type {…} from './read-budget.js'` 保持模块面名字不变；仓内零外部按名消费方，实测 grep） |
| `src/index.ts` | **零改动**（四个窗口类型名已导出，联合在原类型上原地加宽；值导出面仍恰 `RuntimeWriteFatalError`） |

`packages/namespace-registry/src/**` 零改动：`NamespaceLeaseReadArrayOptions/ReadMapOptions`
= runtime 单源别名自动跟随六键；`NamespaceLeaseReadArrayResult/ReadMapResult` = runtime
联合 \| released 自动含新成员；lease.ts 透传零解释。`packages/doc-runtime/**` 零改动。

> 模块方向：`window-read.ts` → `read-budget.ts`（值导入）、`window-read.ts` → `runtime.ts`
> （维持既有 type-only 导入，扩为 `RuntimeReadDisabledResult` + `ReadDataBudgetExceededResult`
> 双类型）；`runtime.ts` → `read-budget.ts`（值导入）。零运行时环。

### DD-2 options 宿主形态（D3 pin → 推荐解）

`window-read.ts` 中两面 options 由纯别名改为 runtime 自持六键闭合形状（镜像 `#405`
`NamespaceRuntimeReadDataOptions` L152–L171 的自持先例与注释结构）：

```ts
export interface NamespaceRuntimeReadArrayOptions {
  n: number;
  orderBy?: IndexWindowTerm;
  depth?: number;
  maxChildrenPerNode?: number;
  where?: readonly WhereTerm[];
  maxBytes?: number;   // ADR 0031 决策 1 域：Number.isSafeInteger(v) && v >= 1
}
// ReadMapOptions 同款（orderBy?: KeyWindowTerm | FieldWindowTerm）
```

- 成员形态逐字满足 T1 锁（`Equal<…, {n; orderBy?; depth?; maxChildrenPerNode?; where?; maxBytes?}>`
  + `keyof` 六键 + `Omit<…,'maxBytes'> ≡ ReadArrayWindowOptions` 中继锁）——成员不带
  `readonly`（doc-runtime 五键原形如此，`Equal` 对修饰符敏感）；
- term / `WhereTerm` 形状仍单源自 `@nomicore/doc-runtime` 导入（不复制第二份）；
- doc-runtime 五键面（类型 + 行为）零 diff，由 split relay（DD-3）+ C5/N4 + `keyof` 硬锁双向锚定；
- 方法签名不变：第二参必填、**无重载**（`Parameters<NamespaceRuntime['readArray']>[1]` 锁）。

### DD-3 拆分读 `splitWindowOptions`（raw 第一读者；W1 单一权威保持）

镜像 `#405` `splitReadDataOptions`（`runtime.ts` L1237–L1270），落 `runtime.ts` `#406` 段：

- **读纪律逐字镜像 W1 `validateWindowOptions`**：宿主门（非 object / 数组 / null /
  非 `Object.prototype|null` 原型 → **relay = raw 原样直传**，宿主判据与 message 单源留在 W1；
  只耗一次 `getPrototypeOf`）→ plain 宿主逐 own-enumerable string 键（`Object.keys` + 每键**一次**
  显式 `getOwnPropertyDescriptor`，全程零 `[[Get]]`）→ 整体 try 收编探测期 trap。**每键恰 2 次
  descriptor 读 = W1 现行次序**——这是 B10 计数锚（总计 4/5）保持的结构前提（§13 R-1）；
- `maxBytes` 键四分支：accessor → 拒（getter 零执行）；present-undefined → 剥离（D1 ≡ 缺席）；
  域外（`typeof !== 'number' || !Number.isSafeInteger(v) || v < 1`）→ 拒（RA-1 域）；合法 →
  **消费**（不进 relay——W1 保持五键视野的单一权威，`{n:1, maxBytes:1, nope:1}` 仍以
  「未知键：nope」被 W1 拒，message 单源不漂移）；
- 其余键（五键 / 未知键 / accessor / present-undefined / 非法值）：`Object.defineProperty`
  **原样复制 descriptor**（保留 accessor 性与 data 值，不判域）——W1 对 relay 继续作五键域、
  未知键、宿主的单一权威；
- `Object.keys` 谎报键（`desc === undefined`）→ 跳过（镜像 W1/canonical 处置）；
- 本函数**不提取** `maxBytes` 值供闸门消费（闸门权威 = canonical 复读值，DD-5——组合层接缝
  单源事实，与 `#405` 同款声明）；其域判定只为**前置拒绝定序**服务（非法 `maxBytes` 在 W1
  触碰前短路，先于目标/载体失败——G10「校验先于度量」）。

### DD-4 G0 前置分支（path 守卫单源保持）

`readArray`/`readMap` 在 split 之前加非数组 path 前置分支（镜像 `readData` S2b-0，
`runtime.ts` L791–L799）：`!Array.isArray(path)` → 调 W1（raw options）——W1 G0 先于其
options 校验，`PATH_NOT_ALLOWED` 成员原样返回，**零 options 读取**（C3/N2：非数组 path +
非法/合法 `maxBytes` → `PATH_NOT_ALLOWED`）；G0 后成功（结构不可达）→ `throw` 响亮不变式
守卫。数组 path 零额外派发。

### DD-5 canonical 六键镜像 + 闸门权威（否决「传剥离视图」）

`canonicalWindowBudget` 白名单五→六键：`maxBytes` 键处置镜像 split 判据（accessor →
`{ok:false}`；present-undefined → 剥离；域镜像 `Number.isSafeInteger(v) && v >= 1` →
`{ok:false}`；合法 → 捕获）；`CanonicalWindowBudget` ok 分支追加
`readonly maxBytes: number | undefined`。canonical 仍**读 raw**（`composeWindowRead` 的
`options` 形参语义不变），不稳定性判定与出口①/②结构不变；**重派发闭包**由 `runtime.ts`
提供：re-split（raw 现场）→ 失败 → 返回 split 拒绝成员（出口①语义）；成功 → W1(relay₂) →
失败透传 / 成功 → 出口②接缝终态。

**闸门权威 = canonical 复读的 `maxBytes`**（非 split 首读值）：交付两通道中 schema 通道消费
canonical 视图（S5 锚链吃 `canonical.budget`）、值通道经 W1 吃 split relay——canonical 是组合
seam 的单源事实，与 `#405`「闸门权威 = canonical 后读值」逐字同构。

**否决的备选 A2（SA6 §12.6 提及的「runtime 传剥离视图」落点）**：若 compose 收剥离视图，
canonical 将读 relay（split 的一次性快照，构造上恒稳定）→ 接缝退化（split 与 canonical 间的
raw 漂移不可见），且 W1 也读 relay → raw 上只发生一次 descriptor 读 → **B10 计数锚 4/5 直接红**
（`issue-369` 两个既有测试实锚）。此为硬否决，不是风格偏好。

### DD-6 S6.5 预算闸（度量对象 = 塑形后交付物）

`composeWindowRead` 在 S6 结算（`truncated` 双语义 + ✂ 窗口事实块装配）**之后**、return 之前：

```ts
// S6.5 预算闸（#406 / ADR 0031 决策 2/3）：值通道 = 条目列表（含 key/index 包装）紧凑
// JSON UTF-8（entries 恒数组，undefined 分支结构不可达，共享 helper 空转不害）；schema
// 通道 = 最终装配文本（✂ 窗口事实块 / ‡ 折叠页脚自然计入；null 计 0）。≤ 收（含恰等），
// > 零交付；闸门透明——成功路径不触碰已组装四键。
if (canonical.maxBytes !== undefined) {
  const measuredBytes = deliveryBytes(entries, schema);
  if (measuredBytes > canonical.maxBytes) {
    return readBudgetExceeded(path, measuredBytes, canonical.maxBytes);
  }
}
return { ok: true, value: entries, schema, truncated };
```

- 度量等式由构造成立（组合式记账零镜像代码）→ G4 property 断言可行；单位 = UTF-8
  （`Buffer.byteLength`，CJK 锚 WA3/WA4 实测 utf8 ≠ utf16）；
- where 侧**无特殊分支**：S6 的装满判定与「✂ 永不装配」分支结构原样先结算，闸门只读不写
  → G6/R12（WM4/WM5 同字节 305 而判定相反；预算不驱动 `truncated`）；
- `path` 实参经 `readBudgetExceeded` 内 `echoReadPath` 新鲜回显（G3：深等、非同一引用、
  事后变异不影响）。

### DD-7 失败成员与文案（三面同文单源）

- **域/accessor/探测期违约**（split 前置拒）：`windowBudgetAxisInvalid(path, msg)` 构造
  `WINDOW_OPTIONS_INVALID` 恰四键成员；返回类型注解 = `WindowReadFailure`（doc-runtime 单源
  类型锁，W1 改形即编译红）；三条 message 采 **W1 无码前缀措辞族**（`window options.<键>…`，
  与 `window.ts` L314/L319/L326/L331/L344/L351 同族；满足 G5「message 含 maxBytes ∧ ≠ 未知键
  message」；域两条含 `maxBytes` 域标识，探测条与 W1 L351 **逐字相同**——状态化 trap 下
  exit① 的 message 文本与 HEAD 零漂移）：
  - `window options.maxBytes 必须是 ≥1 的有限整数（≤ 2^53−1）`
  - `window options.maxBytes 不得为 accessor（零 accessor 执行纪律）`
  - `window options 探测期异常（敌意对象）——已收编为 WINDOW_OPTIONS_INVALID`
- 豁免登记（镜像 `#405` `budgetAxisInvalid` 对 D1 的登记先例）：`maxBytes` 域违约在 W1
  五键视野内结构性不可观测，W1 无法作为该分支的拒绝权威；形状以单源类型注解锁死；
- **超限零交付**：共享 `readBudgetExceeded`（`read-budget.ts` 唯一模板常量；`readData` 面同
  一构造点改引共享件，文案逐字节不变——C8/G3 三面同文同载荷锚）。message 模板为唯一事实源，
    任何面改文案须同变更集改 `read-budget.ts` 并同步三面控制锚。

### DD-8 结果联合与别名跟随（D2 pin → 推荐解）

```ts
export type NamespaceRuntimeReadArrayResult =
  | NamespaceRuntimeWindowReadOk<ArrayWindowEntry>
  | WindowReadFailure
  | ReadDataBudgetExceededResult   // #406：共享预算成员（三面同载荷形）
  | RuntimeReadDisabledResult;
// ReadMapResult 同款
```

- 不另立具名「窗口预算联合」、不加方法重载、不新增公共导出名（D2 推荐解）；
  `Extract<…, {code:'READ_BUDGET_EXCEEDED'}>` ≡ `readData` 面成员（T 锁 `Equal` 双面成立）；
- 接口名 `ReadDataBudgetExceededResult` 沿用（名面历史性指向 readData，实为三面共享成员；
  注释更新为三面共用说明；改名 = 破坏性导出面变化，无必要）；
- registry `types.ts`/`lease.ts` 零改动即跟随（G9 行为 + T5 类型锁自动成立）。

### DD-9 编排与失败优先级阶梯（D7 pin）

```
readArray/readMap(path, options):
  S1  lifecycle gate（≠ready → RUNTIME_READ_DISABLED；零 options 读取、零 doc 触碰）   [不变]
  S2-G0  非数组 path → W1(raw) 单源 G0 拒（零 options 读取）；成功 → loud throw        [新，DD-4]
  S2-split  splitWindowOptions(raw)：maxBytes 域/accessor/探测 → WINDOW_OPTIONS_INVALID
            （四键，窗口面 message）                                                 [新，DD-3]
  S2-W1  readArrayWindowAtPath(doc, path, split.relay)：三码 + PATH_NOT_ALLOWED
            原样透传（五键判据/宿主/未知键 message 单源全在 W1）                       [改：raw→relay]
  S3  canonicalWindowBudget(raw)（六键镜像）：不稳定 → 重派发闭包（re-split + re-W1(relay₂)）
            → 出口①失败透传 / 出口②接缝终态                                          [改：五→六键]
  S5/S6  锚链投影 + 结算（truncated 双语义、✂ 装配规则）——逐字节不变                    [不变]
  S6.5  预算闸（canonical.maxBytes；deliveryBytes(entries, schema)；> → 五键零交付）    [新，DD-6]
  → 恒四键成功
```

与 D7 钉死面一致：lifecycle > G0 > options 校验（split 的 `maxBytes` 域与 W1 的五键校验同层，
层内次序由 split-先行结构决定——split 必须先读才能剥离，`{n:0, maxBytes:0}` 以 `maxBytes` 域
message 拒（G10 只钉码不钉层内次序））> W1 目标/载体 > S3 接缝 > 预算判定（最后）。

### 已否决备选（汇总）

| # | 备选 | 否决依据 |
|---|---|---|
| A1 | doc-runtime 类型/行为加 `maxBytes` | ADR 0031 决策 4 明文零改动；C5/N4 + `keyof` 硬锁红 |
| A2 | canonical/W1 消费 runtime 剥离视图（relay） | 接缝退化 + B10 计数锚 4/5 红（DD-5） |
| A3 | 窗口面复用 `READ_OPTIONS_INVALID` 或新码 | ADR 0031 决策 1 各面既有码；G5 断言 `WINDOW_OPTIONS_INVALID` |
| A4 | 超限裁剪前缀 / 降深度 / 拟合 | ADR 0031 决策 3 + 备选否决表；G8 锚 |
| A5 | 预算判定先于 W1 目标/载体（或先于 G0） | D7/G10/C3 定序；且 W1 前结构上无两通道可度量 |
| A6 | 闸门放 `runtime.ts` compose 之后 | canonical 的 `maxBytes` 无法经公共四键联合逃逸；需私有双返回形状，纯增噪 |
| A7 | 每面独立预算联合 / 独立文案常量 | 三面同文义务 + 别名锁复杂化；模板单源在共享件 |
| A8 | 度量住 W1 | W1 看不到元素口径投影文本（schema 通道在组合层生成）——结构性不可能（SA6 已排除假设） |
| A9 | `maxBytes` 只做类型加法（运行时忽略） | 静默放行与 ADR「超限零交付响亮拒绝」冲突；G2/G5 必红 |

## 8. 接口、状态机与数据流

**接口变化**（全部加法、0.x minor 语义，ADR 0031 验收节授权；发布/版本 bump 归 Runner Host，
不在本设计文件范围）：

- `NamespaceRuntimeReadArrayOptions` / `ReadMapOptions`：+`maxBytes?: number`（六键闭合）；
- `NamespaceRuntimeReadArrayResult` / `ReadMapResult`：+`ReadDataBudgetExceededResult` 成员；
- lease 两别名面零改动跟随；无重载变化、无新导出名。

**状态机**：无新状态机。读路径全同步、零状态写入、零订阅、零 sequencer（ADR 0008 不变量）；
唯一「状态」是 runtime lifecycle（ready/closing/closed），S1 门原样。

**数据流路线**（预算窗口读一次调用的真实执行序）：

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚 |
|---|---|---|---|---|---|---|---|---|
| ① 调用方 → runtime | `readArray/readMap(path, options)`（options 可携 `maxBytes`） | 无写入 | S1 lifecycle 判定（内存读） | — | — | ≠ready → `RUNTIME_READ_DISABLED` 四键 | 无清理（纯读） | C6/N5 |
| ② G0 前置 | 非数组 path（任意 options） | 无 | W1 G0 单源（raw options 零读取） | — | — | `PATH_NOT_ALLOWED` 四键 | 同上 | C3/N2 |
| ③ split 拆分读 | raw options（plain/敌意宿主） | 新鲜 relay 字面量（descriptor 复制） | `Object.keys` + 每键 1 次显式 descriptor；`maxBytes` 剥离/消费/拒 | — | — | 域/accessor/探测违约 → `WINDOW_OPTIONS_INVALID` 四键（窗口面 message）；成功 → relay（五键视图） | trap 由 try 收编，零外抛 | G5/C4/C7 |
| ④ W1 权威 | relay（五键） | 条目物化（读侧，零写） | OPT 五键校验 → 导航 → 载体 → 选窗/过滤/物化 | live Y.Doc 只读 | — | 失败：三码 + `PATH_NOT_ALLOWED` 原样；成功：`{value: entries, total}` | fail-fast 无半窗 | G10/C5 |
| ⑤ S3 canonical | raw options（六键镜像复读） | canonical 两键 budget + `n` + `maxBytes` | 不稳定 → 重派发（re-split + re-W1）→ 出口①/② | — | — | 交替视图 → 接缝 `WINDOW_OPTIONS_INVALID`（「视图不稳定」） | 计数锚 4/5 保持 | #369 S3 组/B10 |
| ⑥ S5/S6 组合 | canonical.budget + segments + entries/total | 无写入（纯组装） | 元素口径锚链投影（`schema:null` 单义）→ `truncated` 双语义 → ✂ 窗口事实块 | — | `projectSchemaTextBody`（live derived 进程内重渲染） | 四键中间态 | 快照缺席 → 正文 null | C1/C9 |
| ⑦ S6.5 预算闸 | canonical.maxBytes + entries + 最终 schema 文本 | 无写入 | `deliveryBytes` = `utf8(JSON.stringify(entries)) + utf8(schema)`（塑形后计量） | — | — | `≤` → 四键成功（逐字节 ≡ 无预算）；`>` → `READ_BUDGET_EXCEEDED` 恰五键零交付 | 拒绝即完整结果，无部分交付 | G1/G2/G3/G4/G6/G8 |
| ⑧ lease 透传 | lease.readArray/readMap | 无写入 | released 短路（三键）先于透传；active 期 raw 引用直传 | — | — | ≡ runtime 直调逐字段（收/拒同载荷） | 敌意 options 零触达 | G9/T5 |

## 9. 错误、恢复、并发和幂等

- **错误面全枚举**（同步结果联合，零 throw——敌意输入零外抛）：`RUNTIME_READ_DISABLED`
  （S1）→ `PATH_NOT_ALLOWED`（②G0 / ④物化透传）→ `WINDOW_OPTIONS_INVALID`（③split 域/
  accessor/探测、④W1 五键、⑤接缝终态）→ `WINDOW_TARGET_ABSENT` / `WINDOW_CARRIER_MISMATCH`
  （④W1，预算不吸收）→ `READ_BUDGET_EXCEEDED`（⑦最后）；唯一逃逸 throw = ②的 G0 后成功
  不变式守卫（internal-bug-only，生产不可达）。
- **恢复语义**：`READ_BUDGET_EXCEEDED` 后重试是**确定性调用方动作**（降预算 / 加形状或窗口
  预算缩小交付再读——ADR 0031 决策 6 指引，进 typed-access 纪律）；无自动重试、无回滚面。
- **并发/幂等**：纯读、零共享可变态、零缓存、每次调用全新对象；同 doc 同参重复调用结果
  逐字节确定（零随机零时钟）；无竞态面（SA6 §7 时序实测同判）。
- **资源所有权**：条目列表与投影文本均为 detached 新鲜产物（string/字面量）；`path` 回显
  新鲜副本；调用方事后变异 path/options 不影响已返回结果（G3 锚）。

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| registry `lease.readArray/readMap` | released 短路 → raw 引用直传 runtime | 不变（透传面零解释；别名类型自动含六键/新成员） | **零改动** | `lease.ts` L338–L345；`types.ts` L480–L497 |
| `NamespaceLease` 消费方（TS） | 五键 options + 三失败码联合窄化 | options 加法接受一切旧调用；联合加法——对 `code` 穷举的窄化分支需认新码（0.x minor 授权，同 `#405` readData 面先例） | 消费方按需（非本仓内必需） | ADR 0031 验收节「minor bump」；仓内 grep 无穷举 `code` 的窗口消费方 |
| runtime 内部 seam（`createNamespaceRuntimeWithSeam` 装配） | `readArray/readMap` 闭包方法 | 方法签名类型不变（第二参必填）；编排内部改造 | 已含在 DD-1 | `runtime.ts` L861–L882 |
| doc-runtime W1 直调方（含 C5/N4 与 `#368/#381/#382` 契约） | 五键校验、拒 `maxBytes` 未知键 | **零变化**（C5 锚定行为保持） | 零改动 | `window.ts` L311–L315；`issue-406-…-control.test.ts` C5 |
| `readData` 面调用与 `#405` 契约 | `readDataBudgetExceeded`/`deliveryBytes` 局部定义 | 构造器/模板/度量迁 `read-budget.ts` 共享，`readData` 行为与文案逐字节不变 | 已含在 DD-1（C8 锚绿） | `runtime.ts` L1288–L1325；C8 |
| 既有窗口测试族（`#369/#381/#382/#383` + lease 面） | 无预算语义 + 敌意计数锚 4/5 | 无预算路径行为与 descriptor 计数逐点保持（split 计数 parity）；状态化 trap 下 exit① message 文本零漂移（split 探测条与 W1 L351 逐字相同，DD-7） | 零改动（回归绿） | `issue-369…test.ts` L226–L246；§13 R-1 |
| 契约测试 7 文件（SA6 落盘） | HEAD 红（预期） | 全部转绿；控制组/中继锁保持绿 | 沿用，仅在装置缺陷时原位修订并记录 | 契约 §12.2/§13/§14 |

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/namespace-runtime/src/window-read.ts` | 六键 options interface、联合追加预算成员、canonical 六键镜像 + `maxBytes` 回传、S6.5 预算闸、模块/成员注释 | DD-2/DD-5/DD-6/DD-8 |
| `packages/namespace-runtime/src/runtime.ts` | `readArray`/`readMap` 编排（S2-G0/S2-split/W1-relay/重派发闭包）、`splitWindowOptions` + `windowBudgetAxisInvalid` + 三条 message 常量、`readData` 共享件迁出改 import、接口 JSDoc 增 `maxBytes` 轴与失败阶梯 | DD-1/DD-3/DD-4/DD-7/DD-9 |
| `packages/namespace-runtime/src/read-budget.ts` | **新建**：共享 message 模板 + `readBudgetExceeded` + `deliveryBytes` + `echoReadPath` + `ReadDataBudgetExceededResult`（自 runtime.ts 迁入并回导出） | DD-1/DD-7（三面同文单源；零环模块方向） |
| `.agents/skills/nomicore/typed-access.md` | 窗口读小节（L148–L205 范围内）补窗口 `maxBytes` 词汇：同码同文、总量 = 条目列表 JSON + 元素口径投影文本、where × 预算三条语义、预算不塑形交付 | OBL-DOC-406-1（RA-3；同变更集或紧随同迭代；`#405` 先例 = 同 commit 落地） |
| `packages/namespace-runtime/test/issue-406-*`（5 文件）、`packages/namespace-registry/test/issue-406-*`（3 文件） | 默认零改动（沿用）；仅当实现期发现装置缺陷时原位修订并记录理由 | 契约 = 验收权威（SA6 §12.2「实现方沿用/原位修订」） |
| `packages/namespace-runtime/test/issue-383-window-where-type-guard.test-d.ts`、`packages/namespace-registry/test/issue-369-window-read-lease-surface.test-d.ts` | 零改动（SA6 已原位延伸为 `Omit` 中继锁，HEAD 即绿、实现后仍绿） | 契约 §12.2 |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/doc-runtime/**` | W1 载体原语与五键类型/校验 | ADR 0031 决策 4 零改动面；C5/N4 + `keyof` 硬锁 + doc-runtime 公共面守卫 |
| `packages/vfsl/**`、`packages/namespace-runtime/src/read-schema-projection.ts` | 投影渲染器与头行/正文渲染 seam | ADR 0027 决策 2 + ADR 0031 决策 4（渲染器零选项纯函数；无预算冻结字节锚依赖其逐字节确定性） |
| `packages/namespace-registry/src/**` | lease 别名与透传 | 纯别名按名自动跟随（G9/T5 即证）；改源码反而破坏单源纪律 |
| `packages/namespace-runtime/src/index.ts` | 公共导出面 | 零新导出名（预算成员经 `Extract` 结构可达；值导出键集冻结审计） |
| `CONTEXT.md`、`docs/adr/**`、`docs/integration/**`、`docs/protocols/**` | 词汇与决议 | L54 已声明三读面（零 diff）；ADR 无需修订（本票兑现既有决策 1–5，非新决策）；integration 文档仅述 readData 面 |
| fixture 冻结锚（`WINDOW_ANCHORS_406`、`TXT_406`、种子） | 契约期望来源 | 锚与种子同变更集冻结；改锚 = 重立契约（须回 SA6 流程） |
| 其余 `packages/*/test/**` 既有测试 | 回归锚 | 无预算语义与计数锚必须原样保持（改测试即毁锚） |

## 12. 验收与验证映射

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1 两面 `maxBytes` 域负控 + 有效域接受（反伪绿配平） | 契约 G5（HEAD 组级红） | `issue-406-window-maxbytes-red.test.ts` G5 组（非法矩阵 ×12 × 两面 + `{maxBytes:1}` 超限锚 + `2^53−1` 域顶收 + D1 + accessor/frozen） | 全绿：非法 → `WINDOW_OPTIONS_INVALID` 四键 + message 含 `maxBytes` 且 ≠ 未知键文案；域内走超限/成功 |
| AC2 超限同码同文同载荷；三面一致 | G3 + C8 | G3 五键/新鲜 path/模板/零外抛 + 三面（readData/readArray/readMap）键集·码·message 一致 | 全绿；message ≡ `budgetMessageTemplate(合计, maxBytes)` 逐字节 |
| AC3 ≤ 边界成功 + 无预算逐字节回归 | G1/G2/G8 + C1/C2/C10 | 18 锚 `total` 收（≡ 无预算读）/ `total−1` 拒（`measuredBytes = total` = 独立两通道合计）；宽预算原样 | 全绿；18 锚冻结字节复验 |
| AC4 where × 预算（同分支/装满判定/无静默丢弃） | G6 + C9 | WM4/WM5/WM6/WA7 超限（恰五键、无 `value`、合计 = 无预算独立测量）+ ≤ 侧逐字节一致 + `truncated` 三态保持 + schema 无 ✂ | 全绿；WM4/WM5 同字节 305 判定相反各自保持 |
| AC5 度量等式构造性成立 | G4 + 探针锚 | 18 锚 `measuredBytes === utf8(JSON.stringify(value)) + utf8(schema ?? '')`；双通道锚 ≠ 任一单通道；CJK `utf8 ≠ utf16`；`schema:null` 计 0 | 全绿 |
| AC6 lease 别名锁延伸 | G9 行为 + T5 | lease ≡ runtime 逐字段（收/拒、where、`schema:null`、`measuredBytes` 逐字）；released 短路三键 + get trap 0 次；无预算 18 锚回归 | 全绿（registry src 零 diff 下成立） |
| AC7 门禁 | 契约 §12.8 | ① root `pnpm typecheck` exit 0；② `NODE_OPTIONS=--conditions=nomicore-source pnpm test` 全量 exit 0（4 红文件转绿、零其它回归）；③ `vitest run packages/namespace-runtime/test packages/namespace-registry/test --typecheck` exit 0；④ `git diff --stat` 证 DENY 面零 diff；⑤ 契约文件零 skip/only/todo/env/源码字符串断言 | 全绿 |
| **R-1 无预算敌意面计数 parity（设计特有）** | B10（HEAD 锚 4/5） | `issue-369-window-read-composition-red.test.ts` S3 组不改动直接复跑 | 状态化 trap 总 descriptor 读 = 4；交替 trap = 5；get trap 恒 0（split 读纪律与 W1 逐字同构的结构证明） |
| 类型面（AC1/AC6 类型侧） | T1–T5（HEAD 红 2/绿 2 + 中继锁绿） | 两 `.test-d.ts` 转绿：六键闭合 `Equal`/`keyof`、`Omit` 中继、联合预算成员 ≡ readData 成员、EOPT 编译红锚、doc-runtime 五键锁、lease 签名锁 | 全绿 |
| 文档义务 | typed-access.md L148–L205 未提窗口 `maxBytes` | OBL-DOC-406-1 落地（§11 ALLOW）；义务关闭前不得宣告本票完成 | 窗口读小节含 `maxBytes` 词汇；readdata-docs 夹具族无回归 |

SA1 不编写或运行测试；上表第 2/3 列均为既有契约（SA6 落盘）或其直接复跑，实现迭代按
§12.8 门禁清单执行。

## 13. 风险、回滚和残余问题

| # | 风险 | 等级 | 缓解 / 任务内必要条件 |
|---|---|---|---|
| R-1 | split 读纪律与 W1 计数漂移（每键 descriptor 读次数不一致 → `#369` 计数锚 4/5 红） | 高 | split 逐字镜像 W1 键循环（`Object.keys` + 每键恰 1 次显式 descriptor）；重派发闭包 = re-split + re-W1(relay₂)（W1 读 relay 零 raw 触达）；**计数锚绿 = 实现验收必要条件，不得伪装成 follow-up** |
| R-2 | 三面文案漂移（窗口面另写模板） | 高 | 模板唯一住 `read-budget.ts`；`readData` 构造点同变更集迁共享件（C8/G3 双锚） |
| R-3 | canonical 六键镜像与 split/W1 判据漂移（三处近似拷贝已是仓内既定形态；`maxBytes` 域判据现存在于 split + canonical 两点——与 `#405` 双点同构） | 中 | 注释互指锚定（镜像 `#405`「T1 演进时本 helper 是唯一需同步复查点」）；G5 组级判据反伪绿 |
| R-4 | split 拒绝成员是 runtime 构造（非 W1 单源） | 低 | 豁免登记（DD-7，沿 `seamReadOptionsInvalid`/`budgetAxisInvalid` 先例）；形状经 `WindowReadFailure` 单源类型注解锁死 |
| R-5 | 类型锁脆弱（`Equal` 对成员修饰符/可选性敏感） | 中 | DD-2 锚定成员不带 `readonly`、可选性与 doc-runtime 五键一致；`Omit` 中继锁已在位（HEAD 绿） |
| R-6 | OBL-DOC-406-1 悬空 | 中 | 同变更集或紧随同迭代；义务关闭前不得宣告完成（RA-D3 同款监督） |
| R-7 | 状态化 trap 下 exit① 的 message 来源由 W1 构造变为 split 构造 | 低 | split 三条 message 采 W1 无前缀措辞族，探测条与 W1 L351 **逐字相同**（DD-7）→ 该路径 message 文本与 HEAD 零漂移；域/accessor 条为新面（HEAD 上该分支不可达，无既有文本可漂移）；实测无测试钉这些文本（grep） |
| R-8 | 全量门禁非本票回归（`#369/#381/#382/#383` 族） | 中 | 契约 §13 基线证据（418 files / 5073 tests 绿）；实现后全量复跑即判 |

**回滚**：单变更集 revert 即恢复 HEAD（纯代码加法，无数据/持久化/wire/schema 迁移）。
**残余问题**：无任务内未决项；演进位（可选裁剪、载荷拆分、where 计数通道）维持 ADR 登记
状态，非本票 follow-up。

## 14. 评审修订映射

`wiki/raw/task_issue-406_sa2_review.md` 不存在（本次 `ls`/glob 复核确认）——无评审输入，
本节空。SA6 契约的固定产物与 freeze 面已全量承接（§5/§11）。

## 15. 是否需要设计后 ADR 冲突复查

**`requiresConflictRecheck = true`**。理由（与 SA6 §15 一致）：

1. **公共 API 加法变化**：两面 options 闭合形状五→六键 + 结果联合追加 `READ_BUDGET_EXCEEDED`
   成员（消费方穷举窄化面受影响，minor bump 语义）——实现 diff 就绪后须按 implementation
   复查模式核对；
2. **本票 SA8 产物缺席**（无 relevant_decisions / conflict_report）：冲突基准由本设计直接
   实读 ADR 全集自建（§6），须送门禁裁冲；
3. **设计自由位已收口但含结构决策**：D1–D7 全采推荐解、A2 备选被硬否决（B10 计数锚）——
   落点选择（split/canonical 读 raw、W1 读 relay、共享件 `read-budget.ts`）与 RA-D1 同类
   parity 义务（R-1）须实现后核对；
4. **OBL-WIN-1 / OBL-DOC-406-1** 未关闭（兑现监督）。

冲突复查应携带的决议集：ADR 0031（决策 1–6 + 验收节）、ADR 0028、ADR 0029、ADR 0027
（含 0031 修订链）、ADR 0024（修订链后）、ADR 0008、ADR 0023；CONTEXT.md「字节预算 / 窗口读 /
过滤窗口 / 投影文本 / 截断省略 / 截断事实段」词条；`docs/AGENTS.md` 同步规则；三包 AGENTS
收录纪律；父票 `#405` SA8 裁决（RA-1/RA-3/RA-D5=OBL-WIN-1）。本设计不修订、不覆盖任何
既有决策——全部条款为 ADR 0031 已授权面的兑现。
