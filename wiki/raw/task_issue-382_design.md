# 实现设计 — issue #382：[ADR 0029] P2 `where` 过滤原语（缝 1：doc-runtime）

- 角色：SA1（防御性架构设计）；dispatch `sa-6596f9d9-6b9f-4a1c-82ef-1255849d6623`；iteration 1（评审修订版；iteration 0 首版 dispatch `sa-efc631cb-05ff-457b-9bf9-213ffacf4c54`，架构与范围不变）。
- 基准快照：worktree `/home/wangjian/nomicore-fix-issue-382`，HEAD `1b639e0ebe825ffbbfce377850c01ef620734f47`（#381 P1 已入；与 SA6 契约 §4 基准一致）。
- 规范权威：`docs/adr/0029-filtered-window-read.md`（accepted，2026-09-16）§1–§8 + 验收缝 1；基契约 `docs/adr/0028-window-read.md`。
- 上游产物：SA6 验收契约 `wiki/raw/task_issue-382_sa6_contract.md`（approved，§12 C/D/V/P/T/Z/F/Y 组 + §12.4 M1–M5 迁移 + §12.6 S1–S4 结构审计）；SA8 `wiki/raw/task_issue-382_relevant_decisions.md` + `wiki/raw/task_issue-382_conflict_report.md`（裁决 `clear`，A1–A5 义务 + F1–F8 冻结面）。
- 评审输入：`wiki/raw/task_issue-382_sa2_review.md` 在场（SA2 独立设计攻击评审，dispatch `sa-ccd143d5-ed2e-476c-bc9b-1407b05aaf73`；verdict `approve`——0 BLOCKER / 0 MAJOR / 4 MINOR finding R-1–R-4）→ §14 评审修订映射逐条落实；本 iteration 1 为原位修订，已批准架构与文件范围零变化。
- 本设计只做设计，不实现、不编写验收测试、不运行验证命令；测试与实现归后续票。

---

## 1. 任务类型、目标与非目标

**任务类型：Feature（已接受决策的能力兑现票）**。ADR 0029 已接受并把验收拆为三缝；本票 = 缝 1（doc-runtime 窗口原语公共入口）。HEAD 对 `where` 的行为是 options 封闭形状 v1 的**预期响亮拒绝**（`WINDOW_OPTIONS_INVALID`，「未知键」），不是缺陷；缺口是词表位未实现 + `total` 值域未扩。

**目标**（全部落在 ADR 0029 缝 1 范围内）：

1. `packages/doc-runtime/src/window.ts` 两公共原语 `readArrayWindowAtPath` / `readMapWindowAtPath` 的 options 增可选 `where?: readonly WhereTerm[]`（合取谓词过滤），管线序 **where（候选筛选）→ orderBy（匹配集总序）→ n（窗口前缀）**。
2. `WhereTerm` v1 = `{ field: string; equals: string | number | boolean | null }`（单段字面键、点号不拆分；number 须 `Number.isFinite`），经 `src/index.ts` type-only 导出并纳入公共面守卫记账（SA8 A3）。
3. W1 成功结算 `total` 值域加宽为 `number | undefined`：**total 键恒在**（own 键），无 where = 候选标识计数（P1 语义零回归），有 where = `undefined`（匹配总数恒不承诺）。
4. 入参侧响亮（形状校验收编进 `WINDOW_OPTIONS_INVALID`，零 `[[Get]]`、零 accessor 执行、零外抛）与数据侧安静不匹配（field 缺席 / 条目不可下钻 / 值非标量 / 值 non-finite / 稀疏空洞 → 安静跳过，不挤掉正常项）。
5. 零物化纪律：谓词下钻 = 每 child 每 term **恰一次单段原始读**，绝不整项物化/递归；只物化入选项。
6. **缝序中间态显式保持**（SA8 A2）：类型别名链把 `where?` 透传到 lease 类型面后，lease 面实传 `where` 必须继续**响亮失败**（`WINDOW_OPTIONS_INVALID`），绝不静默未过滤通过、绝不回落未过滤四键成功面；S3 镜像扩展留给缝 2。
7. 既有测试的精确迁移（M1–M3）与零改动面（M4/M5 中的 runtime/registry 侧）+ 新契约测试家族（沿 #368 先例）。

**非目标**（全部为词表/缝外事项，一律不做）：

- 不实现缝 2：lease 面接收 `where`、`truncated` 双语义（`kept === n` / `kept < n` 装满判定）、✂ 段「有 where 永不装配」、S3 镜像扩展（ADR 0029 §5/§6；SA8 A2/F2/F8）。
- 不实现 `in` / 范围 / OR / NOT / 多段 `field` / 容器深相等（v1 词表外响亮拒绝；A1/F5 备案演进位）。
- 不新增第四读方法、不新增公共值导出（`WhereTerm` 为 type-only；P-W1/P-W2 值导出审计保持两枚）。
- 不触碰 `readData` options / 预算轴（ADR 0024 结构盲纪律；F1）、lease 恒四键与十四键 runtime 面（F2）、orderBy v1 面词表（readArray 仍仅 `by:'index'`；F4）。
- 不改 `read.ts`（零 diff 冻结面；F6）、不改 CONTEXT.md / ADR（缝 3 已闭合：CONTEXT.md L61–67「窗口读」/「过滤窗口」词条已在场）。
- 不改 16 上限哨兵（O1：改哨兵须先改 ADR/简报口径）。

## 2. 当前行为与证据锚点

| # | 当前行为 | 证据锚点 |
|---|---|---|
| CB-1 | W1 options 封闭形状白名单恰四键 `n/orderBy/depth/maxChildrenPerNode`；`where` 命中「未知键」→ `WINDOW_OPTIONS_INVALID`（OPT 阶段、零 doc 触碰） | `packages/doc-runtime/src/window.ts` L276–279（键集门）、L259–312（`validateWindowOptions` 整体）；SA6 §8-2 |
| CB-2 | 编排骨架 G0 → OPT → N0 → N1 → C/E（枚举）→ S（排序）→ M（逐项物化）→ A（装配 `{ok,value,total}` 恰三键，`total = candidates.length` 恒数值） | `window.ts` L175–222（`windowCore`）；模块头 L10–27 |
| CB-3 | map 面 E 阶段每 child 已读原始值（Y.Map `get(k)` / plain `readableOwnDataValue`），field 基排序另有 `drillField(child, field)` 单段下钻（detached→undefined、Y.Map→`get(field)`、plain record→descriptor 读、其余→undefined） | `window.ts` L533–551（`enumerateMapCandidates`）、L560–571（`drillField`） |
| CB-4 | array 面 E 阶段**不读元素**（index 基 = 位置序，排序键 = 下标本身）；plain array 空洞计入 `length` 口径且全下标入候选（空洞仅在入选物化时经 `readableArrayElement` 判 violation → `PATH_NOT_ALLOWED`） | `window.ts` L512–531（`enumerateArrayCandidates`）、L695–708（`readableArrayElement`）；#381 fixture `sparse`（`arrayTotal=4`） |
| CB-5 | 类型面：`ReadArrayWindowResult`/`ReadMapWindowResult` 成功成员 `total: number`；`ReadArrayWindowOptions`/`ReadMapWindowOptions` 无 `where`；`WhereTerm` 不存在（TS2305/TS2353/TS2344 六处编译红，SA6 E4 探针实证） | `window.ts` L56–70、L103–109；SA6 §5 类型探针 |
| CB-6 | 类型别名链单源：`NamespaceLeaseReadArrayOptions = NamespaceRuntimeReadArrayOptions = ReadArrayWindowOptions`（map 同构），Equal 锁在 lease.ts / lease-surface.test-d.ts；W1 options 类型扩展**自动透传**到 lease 类型面 | `packages/namespace-runtime/src/window-read.ts` L57–60；`packages/namespace-registry/src/types.ts` L468–480；`lease.ts` L446–450 |
| CB-7 | 组合层 S3 `canonicalWindowBudget` 对 options 键集白名单**恰四键**，四键外任意键 → `{ok:false}` → 重派发 W1 一次 → 仍接受则接缝终态 `WINDOW_OPTIONS_INVALID`（响亮）；runtime `readArray`/`readMap` 在 S1/S2 后把 `windowResult.value/total` 交组合层，`compose*` 参数 `total: number` | `window-read.ts` L203–248（S3）、L109–148（compose 入口）；`runtime.ts` L683–704（S2 与消费点 L691/L703） |
| CB-8 | lease 面实传 `where` 现状（HEAD）：W1 自身以「未知键」拒 → `WINDOW_OPTIONS_INVALID`（探针 E5 实测；无 where 基线恒四键 `[ok,schema,truncated,value]`） | SA6 §9-E5、§6 NC11 |
| CB-9 | 既有窗口测试家族全绿基线：聚焦 8 文件 144/144；全仓 393 文件 / 4745 用例 / typecheck 14 工程 exit 0；`read.ts` sha256 `3bf6b8b0…b1b312`（本设计开工时本地复核一致） | SA6 §4/§13；本次 `sha256sum` 复核 |
| CB-10 | `#381` 既有用例 T9c 以 `{n:1, where:'x'}` 断言 `WINDOW_OPTIONS_INVALID`（label「未知键」）；#368 契约文件头注 B-5（L29–33）说明「成功面恰三键由 P7 + 类型锁承载」；`public-surface-type-guard.test-d.ts` L215–216 把 `total` 钉死 `number`（注释已预告 P2 加宽） | `issue-381-window-total-red.test.ts` L383–388；`issue-368-window-read-contract-red.test.ts` L29–33；`public-surface-type-guard.test-d.ts` L208–216 |

## 3. 根因 / 能力缺口（承接 SA6 §8）

**能力缺口**：载体级窗口原语缺「值感知的候选集筛选」维度。ADR 0028 窗口读只回答「确定性选窗」，不回答「哪些条目满足谓词」；现有兜底 = 全量读回客户端过滤（全量物化、不知匹配规模）。过滤必须发生在**选窗之前**（runtime 层后滤会得到「前 n 个滤剩 0 个且匹配规模未知」的错序结果），故 `where` 必须进 doc-runtime 原语（ADR 0029 §4 结构推论）。HEAD 的 `WINDOW_OPTIONS_INVALID` 拒绝是 v1 词表的预期行为，不是 bug——本票把该词表位实现为 ADR 0029 过滤语义，且不回归任何 P1/ADR 0028 语义。缺口链六步（症状 → OPT 键集 → ADR 留位 → 类型链透传张力 → 组合层编译张力 → 结构根因）已由 SA6 §8 建立，本设计全部承接，不重复复现。

## 4. Owner 要求落实

| Comment ID | Updated at | Requirement | Design section |
|---|---|---|---|
| ——（无） | ——（无） | 无 owner 评论：简报 Comments 段空；dispatch 明示 issue 评论 REST 刷新为空（无 comment ID/时间戳） | 验收面 = 简报 AC1–AC8 + ADR 0029 §1–§8 + SA8 A1–A5/F1–F8 → §12 验收映射、§6 SA8 约束落实 |

无 owner 口径需要对齐；无最新评论与旧设计冲突问题（首版设计）。

## 5. 复现和根因承接

| 上游事实 | 证据位置 | 设计响应 |
|---|---|---|
| 合法 `where` 调用（四载体族、合取、管线序、短路 n=1、脏矩阵、equals:null、毒值哨兵）在 HEAD 全部 `WINDOW_OPTIONS_INVALID`（红） | SA6 §5 探针 A1–A17/C5 | §8 设计后目标断言逐组转绿（§12 映射 C/D/P/T/Z 组） |
| 类型层红：`WhereTerm` TS2305、两面 options TS2353、`total` TS2344×2 | SA6 §5/E4 | §8.2 类型面扩展 + §8.5 M1 迁移（`number` → `number \| undefined`） |
| 独立预言机与反事实（ignore-where 变异可被击穿）：无 where 同 fixture 得 `t1\|t2…` ≠ 目标 `t1\|t3\|t5` | SA6 §5/E2/E3 | §12 验收锚点沿用「期望由独立预言机派生」纪律；P 组钉管线序 |
| V 组在 HEAD 伪绿（同码不同因），仅 V3/V20 是反向边界 | SA6 §12.3.3/§12.8 | 设计把入参校验判据逐条钉死（§8.3 V-判据表）；红证据责任归 C/D/P/T/Z/Y 组 |
| lease 中间态现状响亮（E5）：lease 实传 where → `WINDOW_OPTIONS_INVALID`；无 where 四键基线不变 | SA6 §9-E5、NC11 | §8.6 中间态设计：compose 入口 fail-closed 分支（显式保持，且比 S3 单独把关更严） |
| 无承重未证实假设（message 文本/助手命名/短路实现方式 = 实现自由） | SA6 §8-7/§15-O2/O3 | §8 只钉可观察契约；实现自由项显式登记 |

上游事实与源码无矛盾（本设计逐点核对 window.ts/window-read.ts/runtime.ts/types.ts/lease.ts 与 SA6 引用行号一致）。

## 6. SA8 约束落实

| 决议或义务 | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|
| A1 词表纪律（in/范围/OR/NOT/多段 field/深相等一律 v1 外响亮拒绝） | §8.3 判据表 + §1 非目标 | 键集恰两键 `field/equals`、equals 标量闭集 + finite、field 恰 string（零强制转换）；词表零扩大 | 否（照文执行；F5 实现后核对） |
| A2 缝序一致性（lease 中间态响亮；不得引入绕过 S3 的静默通道；S3 镜像扩展归缝 2） | §8.6 + §10 行 R-3 | compose 签名加宽 + **入口 fail-closed 分支**（键于 W1 结果 `total===undefined`，先于 S3）——比 S3 白名单单独把关多封一条敌意漂移通道；S3 四键白名单零改动 | **是**（新增组合层失败分支是 A2 落地机制的设计选择，SA8 未见；见 §15） |
| A3 公共面守卫（`WhereTerm` 经 index.ts 导出并记账） | §8.2 + §11 M2 | `export type { WhereTerm }`；type-only（值导出面保持两枚，P-W1/P-W2 绿）；M2 迁移导入/声明/投影断言 | 否 |
| A4 冻结面纪律（`read.ts` 零 diff；`window.ts` 原地；无 where 路径逐字节不变） | §8.4 + §11 DENY | `read.ts` 不入 ALLOW；所有新读路径以 `where !== undefined` 守卫（无 where 时不新增任何元素读/判定） | 否（F6/F7 实现后核对） |
| A5 测试先例（#368 家族同款 + 全仓 typecheck/测试绿） | §12 | 新契约文件沿 contract-red 家族形态（`import * as docRuntime` 绑定 + 运行时行为断言 + 独立预言机 + 负控组）；全仓门 `pnpm typecheck` + `pnpm test` | 否 |
| F1 readData options 闭合形状零变化 | §1 非目标 / §11 DENY | 姊妹通道零触碰（D9 负控钉 `READ_OPTIONS_INVALID`） | 否 |
| F2 lease 恒四键 + 十四键 runtime 面不动 | §8.6 | 组合层成功面构造零改动（where 路径在成功面构造前已响亮失败） | 否 |
| F3 三失败码语义不漂移；where 形状非法收编 `WINDOW_OPTIONS_INVALID` | §8.3/§8.7 | 复用三码族；不新增码；OPT 先于 N0/N1（V21/F1 配对） | 否 |
| F4 orderBy v1 词表不被 where 触碰 | §8.4 | `validateOrderBy` 零改动（C8/V18 三向负例锚定） | 否 |
| F5 `where` 自身形状永不再变 | §8.2 | v1 闭集即终态形状；演进只走「数组项形态加法」 | 否 |
| F6 `read.ts` 零 diff + 镜像纪律 | §11 DENY + §12 S1 | sha256 审计 `3bf6b8b0…b1b312`；`copied from read.ts@36a73bb` 标记数不减 | 否 |
| F7 where 缺席行为零回归 | §8.4 | 无 where 分支全链逐字节（E 不读元素、A 恒数值 total）；T1–T3/NC1–NC3 锚定 | 否 |
| F8 ✂ 段 where 在场永不装配（缝 2 面） | §8.6 | 本票 where 路径到不了 S6（入口即响亮）；✂ 装配规则零触碰 | 否 |
| R1–R16（implements-existing-decision ×7 / no-conflict ×9） | 全文 | 逐条款对应；无 override、无 evolution、无 hard-conflict | 否（SA8 已裁 `clear`） |

## 7. 设计决策与主要备选方案

| # | 决策 | 内容 | 主要备选与拒绝理由 |
|---|---|---|---|
| D1 | 落点：`window.ts` 原地扩 | 不新建模块/方法/读路径；W 阶段（过滤）内嵌进既有 E 阶段（见 D3） | 独立 query/find API：ADR 0029 备选明文否决（形状复制多、接口面变宽） |
| D2 | 类型面：`WhereTerm` + options `where?: readonly WhereTerm[]` + 成功面 `total: number \| undefined` | `WhereTerm = { field: string; equals: string \| number \| boolean \| null }`（两键全必填、无可选键）；两面 options 对称获得 `where`；成功成员 own 键集仍恰三键 | （a）`where` 可写数组 `WhereTerm[]`——拒绝：B-2/Y2 钉 `readonly`；（b）结算加第五键或 total 键缺席——拒绝：ADR 0029 §5「total 键恒在」+ ADR 0027 恒键纪律 |
| D3 | 过滤落点：**E 阶段内联过滤**（枚举循环内逐候选评估谓词，单遍、零二次容器读） | `enumerateArrayCandidates`/`enumerateMapCandidates` 增 `where` 形参；map 面复用循环内已读的 child 原始值，array 面 where 在场时逐下标**原始读一次**（Y.Array `get(i)` / plain `readableArrayElement`）；不匹配 `continue`；`where === undefined` 时零新增读 | （a）枚举后二次遍历过滤 `Candidate[]`——拒绝：array 面候选表不携带原始值，二次过滤须重读全部元素（双倍读）且须把 target 引用穿透；（b）runtime 层后滤——拒绝：ADR 0029 §4 结构推论（错序结果） |
| D4 | 谓词下钻：**复用 `drillField` 单段原始读** + 新增标量等值判定 `matchesWhereTerm` | 下钻语义与 orderBy field 基同源（detached→undefined、attached Y.Map→`get(field)`、plain record→`readableOwnDataValue`、其余→undefined）；`undefined ⇒ 安静不匹配`；命中值再过 typeof 标量闭集 + finite 门 + 严格 `===`（`-0 ≡ 0`；NaN/±∞ 安静不匹配；`true ≠ 1`） | 整项物化后取字段——拒绝：破坏零物化（Z6–Z8 击穿）；多段拆分 field——拒绝：v1 恰单段（C7 锚） |
| D5 | 校验落点：**OPT 阶段内**扩 `where`（五键白名单 + `validateWhere` 助手），先于 N0/N1 | options 键集门扩为五键；`where` 走 descriptor 读（accessor → 响亮；present-undefined ≡ 缺席——顶层已知轴豁免沿既有纪律，V20）；数组性与逐元素形状校验全部在 OPT 内、零 doc 触碰 | 导航后校验——拒绝：V21（缺席路径 + 非法 where 必须 `WINDOW_OPTIONS_INVALID` 而非 `WINDOW_TARGET_ABSENT`） |
| D6 | `total` 结算：A 阶段单点分支 `where === undefined ? candidates.length : undefined` | own 键恒在（`{ok:true, value, total: undefined}` 字面量构造）；过滤后 `candidates.length` 恰为匹配数但**有意不报告**（total 可见性不得依赖实现路径，ADR 0029 §5） | （a）有 where 时返回匹配计数——拒绝：T4/T5 击穿 + ADR「恒不承诺」；（b）`total ?? 0` / 键缺席——拒绝：SA8 A2/M5 明令禁止 |
| D7 | 短路：**v1 不做流式短路**（单遍全枚举 + 内联过滤 + 匹配集排序 + 取前缀） | 与「凑满 n 个匹配即停」可观测等价（value/total/顺序全一致）；SA6 §7 明确短路是成本纪律、不可行为断言，且 S2 结构审计禁止「为短路引入第二读路径」 | 位置序专属短路分支（index/key 基自头部/尾部凑满即停）——拒绝：在同骨架内引入条件分叉的第二执行路径（S2 审计风险），无可观测收益；N=2000 哨兵两态皆绿；若未来出现真实规模压力（ADR 备选触发条件 ~10⁵）再评估——简报「位置序短路选窗（凑满 n 个匹配即停）」表述即按此以可观测等价兑现（口径注见 §13 Follow-up ②） |
| D8 | 中间态机制：**compose 入口 fail-closed 分支**（SA8 A2 的显式落地） | `window-read.ts` 两 `compose*` 入参与 `WindowComposeInput.total` 加宽为 `number \| undefined`；`composeWindowRead` 函数体**第一句**判 `total === undefined` → 构造 `WINDOW_OPTIONS_INVALID` 失败返回（新私有构造器，message 非契约）；S3/S5/S6 零语义改动；分支自身的存活由 §12 S4 增补检查位（结构）+ D8 变异探针双态证据（行为）钉死 | （a）只靠 S3 四键白名单（现状机制，where 键漂移 → 出口②）——**不足以单独承担**：敌意 options Proxy 可对 W1 呈 `where` 视图、对 S3 呈干净四键视图，S3 判据通过后 S6 将算出 `kept < undefined → false`，静默产出「已过滤四键成功面」——恰是 A2 禁止的绕过 S3 静默通道；分支键于 **W1 结果本身**（`total === undefined` ⟺ W1 应用了 where，B-8 不变量），对正常中间态与漂移态同判响亮；（b）分支放 runtime.ts——拒绝（R-1 修正后论据，结论不变）：① **类型收窄必须发生在消费点**——S6 `kept < total`（window-read.ts L176–177）消费 `total` 形参，runtime.ts 的分支收窄不了组合层内部计算，window-read.ts 仍须独立处理 `number | undefined`（双点处理、两处皆可被 `?? 0`/`as number` 软化）；② **窗口域失败构造单源**——四键失败构造器单源于 window-read.ts（`windowFailure` L400 / `seamWindowOptionsInvalid` L408）；runtime.ts 的 `seamReadOptionsInvalid`（L980）属 readData 预算域（返回 `ReadLogicalValueBudgetFailure`），产不出窗口失败面，在 runtime.ts 另造窗口失败即第二构造源；（c）S3 白名单扩五键——拒绝：缝 2 范围（A2），且会让 lease 面在 truncated 双语义缺席的情况下接收 where |
| D9 | runtime/registry/lease：**零 diff** | 类型别名链自动透传（Equal 锁继续成立）；runtime L691/L703 直通 `windowResult.total` 对加宽参数天然 typecheck（无 cast、无兜底）；lease 裸透传不变 | 在 runtime.ts 手写分支/在 registry 校验——拒绝：违反「W1 单权威 + lease 零校验透传」分层（ADR 0028 §9）且无必要 |
| D10 | 测试家族：新契约文件 + 最小迁移 | 行为契约 → 新 `issue-382-where-window-contract-red.test.ts`（C/D/V/P/T/Z 组 + F1–F6；**F7 不入该文件**——它是 lease 级审计项，处置见 §12：严格形态仅实现期审计证据 + P4 条件不变式耐久形态落 registry 新测试）；类型契约 → 新 `issue-382-where-window-type-guard.test-d.ts`（Y1–Y4）；既有面迁移仅 M1（total 钉加宽）/M2（WhereTerm 记账）/M3（注释同步）；lease 不变式 → 新 `issue-382-lease-where-no-silent-pass.test.ts`（SA6 P4 条件不变式形态，缝 1/缝 2 两态皆真、无退役义务） | （a）类型断言全部并入 `public-surface-type-guard.test-d.ts`——拒绝：该文件章程是公共面记账，issue 号契约文件是家族先例（P2 二选一，取新文件 + 既有文件只做 M1/M2）；（b）F7 严格断言（缝 1 后必须 ok:false）写成持久测试——拒绝：缝 2 落地即腐烂（SA6 P4/O4），严格形态仅作实现期审计证据 |

## 8. 接口、状态机和数据流

### 8.1 W1 `window.ts` 公共类型面（唯一实现落点）

```ts
/** ADR 0029 §2 谓词项 v1：单段字面键（点号不拆分）+ 标量闭集等值；形状永不再变。 */
export type WhereTerm = {
  field: string;
  equals: string | number | boolean | null;
};

export interface ReadArrayWindowOptions {
  n: number;
  orderBy?: IndexWindowTerm;
  depth?: number;
  maxChildrenPerNode?: number;
  where?: readonly WhereTerm[];        // ADR 0029 §1/§2
}
export interface ReadMapWindowOptions {
  n: number;
  orderBy?: KeyWindowTerm | FieldWindowTerm;
  depth?: number;
  maxChildrenPerNode?: number;
  where?: readonly WhereTerm[];        // readArray 对称获得（§4）
}
export type ReadArrayWindowResult =
  | { ok: true; value: ArrayWindowEntry[]; total: number | undefined }   // total own 键恒在
  | WindowReadFailure;
export type ReadMapWindowResult =
  | { ok: true; value: MapWindowEntry[]; total: number | undefined }
  | WindowReadFailure;
```

内部：`type NormalizedWhereTerm = { field: string; equals: string | number | boolean | null }`；`ValidatedWindowOptions` 增 `where: readonly NormalizedWhereTerm[] | undefined`（校验时逐项**防御性浅拷贝**进新鲜 plain 对象数组，与调用方对象零别名）。`WindowCoreResult` 成功成员 `total: number | undefined`。模块头注释 A 段「本票无 where ⟹ total 恒为数值」句原地改写为新语义（注释级）。

### 8.2 导出面（`src/index.ts`）

`export type { …, WhereTerm } from './window.js'`（并入既有窗口类型 `export type` 名单；type-only——运行时键空间零新增，P-W1/P-W2 值导出审计保持恰两枚）。文件头 ADR 0028 缝 1 注释补一句 ADR 0029 P2 加法说明（注释级）。

### 8.3 OPT 阶段 `where` 校验判据（全部响亮 → `WINDOW_OPTIONS_INVALID`，零 `[[Get]]`、零 accessor 执行、零外抛）

| 判据 | 规则 | 契约锚 |
|---|---|---|
| W-1 options 键集门 | 白名单四键 → **五键**（+`where`）；未知键在场即拒（含 present-undefined 未知键） | V19、F3 |
| W-2 options.where accessor | descriptor 读；`get/set` 在场 → 拒（计数器零执行） | V15 |
| W-3 present-undefined | `where` own 键、值 `undefined` ≡ 缺席 → 不过滤、total 数值（**顶层已知轴豁免**，沿 `n/depth` 既有纪律） | V20 |
| W-4 数组性 | `Array.isArray` 为假（string/object/null/number/`[undefined]` 外的标量/Y.Array 实例）→ 拒 | V16 |
| W-5 长度门 | 经 **descriptor 读 `length`**（与元素读同纪律，杜绝 Proxy `length` get trap）；descriptor 缺失/值非非负整数 → 拒；`length === 0` → 拒（「要全集」唯一写法 = 不传 where）；`length > 16` → 拒（哨兵常量 `WHERE_TERM_LIMIT = 16`；恰 16 合法） | V1/V2/V3、B-4、O1 |
| W-6 元素读纪律 | 逐下标 `Object.getOwnPropertyDescriptor(arr, String(i))`（仅索引空间 0..len-1；非索引 own 属性不参与语义）；descriptor 缺失（稀疏空洞）→ 拒；accessor → 拒（零执行） | V11/V12 |
| W-7 元素值 | `undefined` / `null` / 非对象 → 拒（WhereTerm 层无 present-undefined 豁免——与 W-3 的豁免边界相反，SA6 V20 注记） | V16 |
| W-8 元素宿主 | `Object.getPrototypeOf === Object.prototype \|\| === null`（class 实例/数组/Map/函数 → 拒；null 原型链合法） | V10、C10 |
| W-9 元素键集 | own 键集白名单**恰两键** `field`/`equals`（Object.keys 门：未知键在场即拒，含 present-undefined 未知键；原型链供给的键不计 own → 必填检查拒） | V9 |
| W-10 `field` | `typeof === 'string'`（空串合法；**零强制转换**——绝不调 `toString`，非 string 即拒） | V8、C9 |
| W-11 `equals` | 必填且值属闭集：`typeof string \| boolean` 直收；`typeof number` 须 `Number.isFinite`（NaN/±∞ → 拒）；`=== null` 收；`undefined`/对象/数组/bigint/Symbol/函数/Date/Map → 拒；**禁 truthiness 校验**（`''`/`0`/`false`/`null` 全合法） | V4/V5/V6、C5/C6 |
| W-12 必填闭环 | 键循环后 `hasField ∧ hasEquals` 双真，否则拒（两键皆必填、无判别互斥） | V6/V7 |
| W-13 trap 收编 | 全部探测在 `validateWindowOptions` 既有外层 try 内（或同级 try），任何抛出收编为响亮失败，绝不外抛 | V13/V14、AC4 |
| W-14 相邻面不放宽 | `n` 门（≥1 有限整数）与 `validateOrderBy`（face 词表/by-field 互斥/dir 闭集）**逐字节不动**——where 合法不放松 n，where 在场不放宽排序词表 | V17/V18、C8、F4 |

### 8.4 管线（G0 → OPT → N0 → N1 → C → **E+W** → S → M → A）

- **G0/N0/N1/C**：零改动。失败序保持 OPT 先于 N0/N1（合法 where + 缺席路径 → `WINDOW_TARGET_ABSENT`，F1 新用例；非法 where + 缺席路径 → `WINDOW_OPTIONS_INVALID`，V21）。
- **E+W（枚举 + 内联过滤）**：
  - map 面：循环内已取 child 原始值（Y.Map `get(k)`——`undefined` 值键本就 `continue` 出条目空间；plain `readableOwnDataValue` miss `continue`）；where 在场时对该值跑 `whereMatches(child)`：每 term 先 `drillField(child, term.field)`（复用既有单段下钻；`undefined` ⇒ 安静不匹配，覆盖 field 缺席 / 显式 undefined / detached / 条目不可下钻），再 `matchesWhereTerm(v, term.equals)`（typeof 标量闭集 + finite 门 + 严格 `===`；null 仅匹配在场 null；容器值/载体值/non-finite ⇒ 安静不匹配）。合取按数组序短路评估；不匹配 `continue`。
  - array 面：where 在场时逐下标**原始读一次**：Y.Array `target.get(i)`；plain array `readableArrayElement(arr, i)` → `ok` 取值，`none`/`violation`（越界/空洞/下标 accessor/undefined 元素）⇒ **安静不匹配**（注意：与无 where 路径的 M 期判 violation → `PATH_NOT_ALLOWED` 不同——过滤位在选窗前，脏元素不入选即不物化）；再跑同一 `whereMatches`。**where 缺席时 array 面保持零元素读**（D-3 位置序现状逐字节不变）。
  - 排序键分类照旧：field 基 `drillField(child, term.field)` 的既有调用不因 where 改动（同 child 同 field 的两次单段读不去重——成本上界 N×16 次原始读即 16 上限的存在理由；正确性无虞：调用全程同步、doc 无并发写）。
- **S**：零改动（对过滤后的匹配集排序；总序/平局锚/组序纪律照搬 ADR 0028 §5）。
- **M**：零改动（只物化前 `min(n, 匹配数)` 项；任一项失败 fail-fast 透传 `PATH_NOT_ALLOWED`，path 精确到项、无半窗——F4 where 变体锚）。
- **A**：`total: validated.where === undefined ? candidates.length : undefined`（单点分支；own 键恒在）。

### 8.5 既有测试/类型面精确迁移（M1–M5 承接）

| # | 位置 | 动作 |
|---|---|---|
| M1 | `packages/doc-runtime/test/public-surface-type-guard.test-d.ts` L215–216 | `Extract<Read*WindowResult,{ok:true}>['total']` 类型锁 `number` → `number \| undefined`；L214 注释同步（去掉「P2 where 票按 ADR 0029 §5 加宽」预告语，改为已加宽事实）。**不迁移则实现后 TS2344 红——这是类型面变更的自证** |
| M2 | 同文件 L25–57 导入区 + L77–90 声明区 | 增 `WhereTerm` 导入（按字母序插于 `WindowDir` 前——`'Wh' < 'Wi'`）与 `declare const whereTerm: WhereTerm;`；窗口 describe 内增投影断言（`field: string`、`equals: string\|number\|boolean\|null`、两面 `where: readonly WhereTerm[] \| undefined`） |
| M3 | `packages/doc-runtime/test/issue-368-window-read-contract-red.test.ts` 头注 B-5（L29–33） | **注释级同步**：补「B-5 不锁键集；成功面恰三键由 P7/类型锁承载；#382 起 `total` 值域加宽为 `number \| undefined`」——零断言改动 |
| M4 | `issue-368-*.test.ts`、`issue-381-window-total-red.test.ts`、`public-surface-guard.test.ts`、`#369` 组合/lease 测试、`issue-369-window-read-lease-surface.test-d.ts` | **零改动**（设计已逐点核对：全部无 where 调用；`#381` T9c `{n:1,where:'x'}` 在新词表下因「where 非数组」仍 `WINDOW_OPTIONS_INVALID` → 断言不变绿，仅人类可读 label「未知键」语义过时——**观察项非改动项**（§13-R6）；lease-surface L43–44 Equal 锁经别名自动跟随；若实现后任何一处红，先报设计修订，不得就地改软） |
| M5 | `packages/namespace-runtime/src/window-read.ts` 消费签名 + `runtime.ts` L691/L703 | compose 两入口 + `WindowComposeInput.total` 加宽 `number \| undefined`；`composeWindowRead` 入口 fail-closed 分支（D8）；**runtime.ts 零 diff**（直通调用对加宽参数天然 typecheck，无 `?? 0`/`as number`）；`pnpm typecheck` 是机械门 |

### 8.6 缝序中间态（SA8 A2 显式保持）

lease 面实传 `where`（类型上经别名链已合法）的运行时路径：lease 裸透传 → runtime S1/S2 → W1 **接受并过滤**（缝 1 生效）→ compose 入口见 `total === undefined` → **响亮失败** `WINDOW_OPTIONS_INVALID`（新私有构造器，message 指明「where 已在 W1 生效、lease 组合面接收属缝 2」；message 非契约字段）。可观察结果与 HEAD 现状（E5 探针）**同码同向**：`ok:false, code:'WINDOW_OPTIONS_INVALID'`，绝无「ok:true + 未过滤条目」或「ok:true + 已过滤但 `truncated` 失真」的静默通道。该分支对两类输入同判响亮：① 正常中间态（S3 四键白名单本也会拒，出口②殊途同归，但省一次 W1 重派发）；② **敌意漂移态**（options Proxy 对 W1/S3 呈不同键视图——S3 单独把关会漏，D8 论证）。缝 2 落地时此分支被「truncated 双语义 + ✂ 永不装配 + S3 镜像扩展」整体取代（届时 F7 严格断言预期翻转，P4 条件不变式形态无需退役）。

### 8.7 失败词表（零新增）

`WINDOW_TARGET_ABSENT`（N1 缺席，where 合法不吸收）｜`WINDOW_CARRIER_MISMATCH`（C 面/载体不符，where 在场仍优先于过滤）｜`WINDOW_OPTIONS_INVALID`（OPT：n/orderBy 既有非法面 + **where 全部形状非法面（§8.3）** + S3 接缝/中间态）｜`PATH_NOT_ALLOWED`（G0/N1 纪律位/C detached/M 入选项物化失败，where 在场照旧 fail-fast）。失败结算 own 键集恰四键 `{code,ok,path,message}`，无 `value`/`total`。

## 数据流路线

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| R-1 W1 直读（无 where） | 调用方 → `read*WindowAtPath(doc, path, options)` | 无写入（纯读） | G0→OPT→N0/N1→C→E→S→M→A；只物化入选项 | 无（零持久化/网络；live Y.Doc 只读快照语义） | 逐入选项 `readLogicalValueAtPath` 同预算物化 | `{ok:true,value,total:number}` 恰三键 | 失败联合四键；trap 收编；**逐字节不变** | T1–T3、NC1–NC3、F1–F6 |
| R-2 W1 直读（有 where） | 调用方 → 同上 + `where: WhereTerm[]` | 无写入 | OPT 内校验（零 doc 触碰）→ E+W 单遍内联过滤（每 child 每 term 恰一次单段原始读；未匹配**零物化**）→ S 匹配集排序 → M 只物化入选 → A `total: undefined` | 无 | 仅入选项物化；谓词只下钻 field 单段 | `{ok:true,value,total:undefined}`（own 键在场）；条目 = 匹配前缀 | 形状非法 → OPT 响亮；入选项物化失败 → `PATH_NOT_ALLOWED` fail-fast 无半窗 | C1–C11、D1–D12、P1–P5、T4–T6、Z1–Z8、V1–V21 |
| R-3 lease 面中间态 | lease 调用方 → `lease.read*(path,{n,…,where})` | 无写入 | lease 裸透传 → runtime S1/S2 → W1（R-2）→ **compose 入口 fail-closed**（D8） | 无 | 组合层成功面构造**不发生** | `{ok:false,code:'WINDOW_OPTIONS_INVALID'}` 四键（与 HEAD E5 同码） | 响亮、零外抛、无半窗、无 ✂ | F7、NC11、P4（条件不变式） |
| R-4 类型面 | TS 消费方 import `WhereTerm` / options / result | 编译期 | 别名链 registry→runtime→doc-runtime 自动透传（零复制） | 无 | `vitest --typecheck` 采集 `.test-d.ts` | `WhereTerm` 可导入；两面收 `where`；`total: number\|undefined`；负例 `@ts-expect-error` 真实报错 | 编译红即门禁红（M1 自证） | Y1–Y5、M1/M2 |

跨模块/跨进程/跨持久化边界：无（全链同步、单 Y.Doc、零网络零时钟零订阅）；唯一跨包边界 = 类型别名链（R-4）与 runtime→doc-runtime 调用（R-3），均无数据形态复制。

## 9. 错误、恢复、并发和幂等

- **错误面**：全部同步返回、响亮不抛；三码 + `PATH_NOT_ALLOWED` 语义零漂移（§8.7）。where 新增失败全部收编 `WINDOW_OPTIONS_INVALID`；敌意 options/where（accessor/Proxy/trap）零 `[[Get]]`（W-2/W-6 descriptor 纪律）、零 accessor 执行、零外抛（W-13 收编）。
- **恢复/重试**：读操作零副作用、天然可重试；失败无部分状态（无半窗、无 memo、模块级零可变态）。
- **并发**：调用全程同步（无 await/yield）；唯一可在两次导航间运行的用户代码 = options/where 的 Proxy/descriptor trap，已全部收编（V13/V14）；与写 sequencer 无交集（读不进 sequencer，ADR 0008/namespace-runtime AGENTS）。
- **幂等**：同一 doc + 同一实参重复调用逐字节一致（D13/NC7 现状保持；where 校验时对 term 做防御性浅拷贝，调用后调用方改写原数组不影响已结算结果）。
- **生命周期**：不触碰 lifecycle（W1 无状态；runtime S1 gate 在 W1 之前，行为不变）。

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| doc-runtime 直读调用方（测试/未来应用） | `where` → `WINDOW_OPTIONS_INVALID`（未知键） | 合法 where → 过滤结果；非法 where → 同码（形状因） | 无（纯加法；类型面加宽对合法旧调用零影响） | SA6 §5 A 组/CB-1 |
| `namespace-runtime` `runtime.readArray/readMap`（L683–704） | 直通 W1，`windowResult.total: number` 交 compose | 直通不变；`total: number\|undefined` 交加宽后的 compose；where 实参经 S2 原样进 W1 | **零代码改动**（typecheck 自然通过；无 cast/兜底） | CB-7、M5 |
| `namespace-runtime` `window-read.ts` compose（唯一组合消费点） | `total: number`；S3 四键白名单拒 where 键 | 签名加宽 + 入口 fail-closed 分支（D8）；S3/S5/S6 零语义改动 | 签名 + 分支 + 注释（ALLOW #3） | CB-7、SA6 §10 组合层行 |
| `namespace-registry` `lease.readArray/readMap`（L309–315 裸透传）+ `types.ts` 别名（L468–480） | options 类型 = 四键别名 | 别名自动含 `where?`（Equal 锁继续成立）；运行时中间态响亮（R-3） | **零改动** | CB-6/CB-8 |
| 既有窗口测试家族（#368 契约/pins、#381、#369 组合/lease、surface guards） | 全部无 where 调用 | 期望全部不变绿（M4 逐点核对） | 零改动（M1/M2/M3 除外） | CB-10、M4 |
| `readLogicalValueAtPath` 姊妹 / readData 预算通道 | 冻结 | 冻结不变（`where` 不得进 readData options；带 where → `READ_OPTIONS_INVALID`） | 零改动（DENY） | NC4、F1 |

无未覆盖调用方（全仓 grep：`readArrayWindowAtPath`/`readMapWindowAtPath`/`compose*` 消费点 = 上表全集；apps/domains 无引用）。

## 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/doc-runtime/src/window.ts` | §8.1 类型 + §8.3 OPT 校验 + §8.4 E+W 内联过滤 + A 阶段 total 分支 + 模块头注释 | 唯一实现落点（ADR 0029 §8「window.ts 原地扩 where 与 total」；A4） |
| `packages/doc-runtime/src/index.ts` | `export type { WhereTerm }` + 头注释一句 | A3 公共面守卫记账义务 |
| `packages/namespace-runtime/src/window-read.ts` | compose 两入口 + `WindowComposeInput` 签名加宽；`composeWindowRead` 入口 fail-closed 分支 + 新私有失败构造器 + 注释 | M5 消费边界显式分支；SA8 A2 中间态响亮的落地机制（D8） |
| `packages/doc-runtime/test/public-surface-type-guard.test-d.ts` | M1（L215–216 total 钉加宽 + L214 注释）+ M2（导入/声明/投影断言） | 本票类型面变更的自证迁移与记账 |
| `packages/doc-runtime/test/issue-368-window-read-contract-red.test.ts` | M3 头注 B-5 注释级同步（L29–33） | 防注释与 widened 事实矛盾；零断言改动 |
| `packages/doc-runtime/test/issue-382-where-window-contract-red.test.ts`（新建） | 行为契约：C/D/V/P/T/Z 组 + **F1–F6**（SA6 §12.3.1–§12.3.7）；**F7 不入本文件**——它是 lease 级断言（需 registry 装配才能触达），处置见 §12：严格形态仅实现期审计证据 + P4 条件不变式耐久形态落 registry 新测试 | 缝 1 验收（A5/#368 家族先例；AC1–AC7）；与 §12/D10 单一口径；新契约文件零跨包 import（doc-runtime 测试不反向依赖 namespace-registry/namespace-runtime） |
| `packages/doc-runtime/test/issue-382-where-window-type-guard.test-d.ts`（新建） | 类型契约：Y1–Y4 + 编译期负例（AC8/A3） | 类型面 fail-closed 验收 |
| `packages/namespace-registry/test/issue-382-lease-where-no-silent-pass.test.ts`（新建） | P4 条件不变式：lease where 调用若 `ok:true` 则条目全满足谓词，若 `ok:false` 则码 = `WINDOW_OPTIONS_INVALID` | NC11/F7 的耐久形态（缝 1/缝 2 两态皆真、无退役义务；D10） |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/doc-runtime/src/read.ts` | 姊妹读冻结面 | F6：零 diff + sha256 `3bf6b8b0…b1b312` + `copied from read.ts@36a73bb` 镜像纪律 |
| `packages/namespace-runtime/src/runtime.ts` | S2 直通消费点（L689–703） | M5 经 compose 签名加宽即可 typecheck；runtime 保持零 diff——分支若落 runtime.ts 将造成消费点双点处理 + 窗口失败构造第二源（D8 备选 (b) 拒绝理由；D9）。若实现发现必须改 runtime.ts，即为设计偏离，先回报 |
| `packages/namespace-runtime/src/window-read.ts` 的 S3 `canonicalWindowBudget`/`canonicalOrderBy` 逻辑体 | 四键白名单 | A2：S3 镜像扩展属缝 2；本票放宽即制造静默通道（文件本身在 ALLOW，但改动仅限签名/入口分支/注释——S3 判据逐字节不动） |
| `packages/namespace-registry/src/lease.ts`、`packages/namespace-registry/src/types.ts` | 别名链/裸透传 | 零校验透传分层（ADR 0028 §9）；别名自动跟随 |
| `packages/doc-runtime/test/issue-368-window-read-design-pins.test.ts`、`issue-381-window-total-red.test.ts`、`public-surface-guard.test.ts`、`#369` 全部测试 | 回归面 | M4：无 where 期望零变化；红了先报设计修订（#381 T9c label 过时是观察项非改动项） |
| `CONTEXT.md`、`docs/adr/**`、`docs/protocols/**` | 缝 3 文档面 | 缝 3 已闭合（SA8 §6：词条已落，PR #380 集成基线）；本票无决策演进 |
| `vitest.config.ts`、各 `package.json`、`tsconfig*.json` | 采集/构建 | 新测试文件按既有命名自动被 include（SA6 §14）；零配置改动 |
| `packages/doc-runtime/src/window.ts` 中 `validateOrderBy`/`navigate`/`collectCandidates` 面检查/`compareCandidates`/`materializeItem`/read.ts 复制件 | 相邻冻结逻辑 | F4/F7：词表与无 where 路径逐字节不变（文件在 ALLOW，但改动仅限 §8 列出的位点） |

## 12. 验收与验证映射

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1 合取正确性矩阵（多条件/field 缺席/非标量/non-finite/同 field 重复/标量元素数组面/四载体族） | HEAD 红（SA6 §5 A1–A10/A13）；实现自由项已钉（§8.3/§8.4） | 新契约文件 C1–C11（fixture `FIX-382-A`；期望由独立预言机派生） | 逐组 `ok:true` + 匹配条目 + `total` own 键在场且 `undefined` |
| AC2 安静不匹配纪律（脏项不炸读、不挤正常项；equals:null 对缺席不匹配、在场 null 匹配） | HEAD 红 | D1–D12（dirty 矩阵 + accessor 计数器 + 空洞/标量元素/空容器） | 恰正常命中；accessor 计数器 `=== 0`；全 `ok:true` |
| AC3 入参侧响亮（空数组/超 16/非 finite/非闭集/未知键/非法原型/形状漂移） | HEAD 伪绿（同码不同因；SA6 §12.3.3 登记） | V1–V21（实现后变异守卫；红证据由 C/D/P/T/Z/Y 承担；V3/V20 反向边界必须 `ok:true`） | 一律 `WINDOW_OPTIONS_INVALID`（V3 除外）；零外抛、零 `[[Get]]` |
| AC4 敌意 options 零 accessor/Proxy trap 收编 | HEAD 伪绿 | V11–V17（计数器 + 抛 trap 四件套） | 响亮 ∧ 计数器 0 ∧ 零外抛 |
| AC5 零物化哨兵（未匹配条目内埋毒必须 `ok:true`） | HEAD 红 | Z1–Z8（N=2000：NaN 标量/NaN 值键/稀疏空洞/未匹配项内埋 NaN/嵌套空洞；四载体） | `ok:true`、恰命中项；任何「全量物化再过滤」或整项深读实现必红 |
| AC6 total 双形态 | HEAD 红（A/C5 + 类型 TS2344） | T1–T6（`hasOwnProperty` 判 own 键在场——禁 JSON 判定） | 无 where = 数值计数；有 where = own 键在场且 `undefined`（恒不承诺） |
| AC7 三失败码不回归 + orderBy 词表不动 | HEAD 绿（D2–D6、D10–D12；#368 G4/G8） | F1–F6（含合法 where + 缺席/载体不符/PATH_NOT_ALLOWED where 变体）+ C8/V18 | 码各就各位；`readArray` 传 field/`by:'key'` 仍拒 |
| AC8 缝 1 测试先例 + 全仓绿 | 聚焦 8 文件 144/144、全仓 4745 用例 + typecheck exit 0（SA6 §13/§14） | 新 3 文件落 ALLOW 路径；运行器命令沿 SA6 §14（聚焦 vitest run 8+3 文件；全仓 `pnpm typecheck` + `pnpm test`） | exit 0、`Type Errors no errors` |
| SA8 A2 中间态响亮（含 D8 独占防御的敌意漂移通道） | HEAD 绿（E5 探针）；**缺口（SA2 R-2）**：P4 条件不变式对「已过滤静默通过」恒绿、不能侦测该通道，D8 分支存活此前仅有编译期收窄钉 | F7（实现期审计：lease where → `WINDOW_OPTIONS_INVALID`）+ P4 条件不变式（耐久）+ **D8 变异探针（实现期审计，前后双态证据入实现票 artifacts，与 S1–S4 同列登记）**：① 临时删除入口分支（或软化为 `as number`/`?? 0`），构造对 W1 呈 `where` 键、对 S3 呈干净四键的敌意 options Proxy（ownKeys/descriptor trap 分视图），经 lease 调用 → 必须观测到**静默已过滤四键成功面**（`ok:true ∧ truncated:false`——证明探针有牙）；② 原样恢复分支后同一调用必须 `WINDOW_OPTIONS_INVALID` | lease 面 where 绝无 `ok:true` 通过（正常中间态与敌意漂移态同判响亮）；无 where 四键基线不变；探针双态证据齐全方算审计通过 |
| SA8 A3/F6 结构面 | read.ts sha256 复核一致（本设计） | S1（`git diff --stat` 空 + sha256）、S2（过滤落点 window.ts 原地、无新读路径）、S3（无 where 分支与 #381 基线一致）、S4（S3 白名单未放宽 + **增补检查位（SA2 R-2）：compose 入口 fail-closed 分支在场、位于 `composeWindowRead` 函数体第一句（先于 S3）、判据键于 W1 结算 `total === undefined` 而非 options 重读**）——记入实现票 artifacts | 结构审计四项全过（S4 含增补检查位） |
| 敏感度/反伪绿 | SA6 §12.7 十四类变异 | 变异守卫逐条由对应组击穿（ignore-where→C/P；见 where 即拒→V3/V20；不校验→V；全量物化→Z；管线错序→P1；total 计数→T4/T5；truthiness→C5；`[[Get]]` 下钻→D7/V11/V15；软化手段→契约纪律禁止；**删除/软化 D8 入口分支（含 `as number`/`?? 0` 变体）→D8 变异探针（分视图 Proxy 经 lease 见静默成功面）；编译期另有 S6 收窄钉——删分支即 S6 编译红或被迫 cast，两者皆可见**） | 每类变异至少一个击穿用例（D8 变异为前后双态证据） |

SA1 不编写/运行测试；上表为后续实现/复核票的可执行验收面（用例定义已由 SA6 §12 机械给出，本设计 §8 的判据表与其逐条对齐）。

## 13. 风险、回滚和残余问题

| # | 风险/残余 | 等级 | 处置 |
|---|---|---|---|
| R-1 | 敌意 options 视图漂移（W1 见 where、S3 见干净四键）绕过 S3 → 静默已过滤四键成功面 | 高（若仅靠 S3） | **已封死**：D8 compose 入口分支键于 W1 结果 `total===undefined`，漂移态与正常中间态同判响亮（P4/Z 组之外的结构性保证） |
| R-2 | `total` 加宽引发编译断裂面外溢（未识别消费点） | 低 | 全仓 grep 消费点全集 = runtime.ts L691/L703 + window-read.ts（§10）；M5 机械门 `pnpm typecheck` |
| R-3 | where 校验误拒合法输入（falsy equals、null 原型、空串 field、恰 16 项、`where: undefined`） | 中 | §8.3 判据显式收这五类为**合法**（C5/C9/C10/V3/V20 反向边界）；实现后这五个用例是必绿项 |
| R-4 | array 面 where 过滤与无 where 路径的空洞语义分歧（过滤位安静跳过 vs 物化位 `PATH_NOT_ALLOWED`）引入实现混淆 | 中 | §8.4 显式写明两语义的分界（选窗前 vs 物化期）；D9/Z3 锚定前者、P6b/#368 锚定后者不变 |
| R-5 | V 组伪绿被误当验收完成证据 | 中 | §5/§12 已登记：红证据责任归 C/D/P/T/Z/Y；V 组仅实现后变异守卫 |
| R-6 | `#381` T9c label「未知键」语义过时（`where:'x'` 新因 = 非数组） | 极低 | 观察项非改动项（断言语义不变绿；M4 零改动纪律优先；如后续票想改 label 属注释级自由） |
| R-7 | 16 哨兵与未来词表演进的耦合 | 低 | O1：改哨兵须先改 ADR/简报口径；`WHERE_TERM_LIMIT` 具名常量单点定义 |
| R-8 | 回滚 | — | 单 commit 纯加法语义（无迁移数据、无 wire、无持久化）；回滚 = revert 该 commit + 还原 M1/M2/M3（M1 是唯一「迁移型」改动，随实现同票同滚） |
| Follow-up（明确非本票） | ① 缝 2（lease where 接收 + truncated 双语义 + ✂ 永不装配 + S3 镜像扩展，PR #380 阶段收官前闭合，SA8 A2）；② 位置序流式短路（真实规模压力出现时评估，ADR 备选触发条件 ~10⁵）——**口径注（SA2 R-4）**：简报「位置序短路选窗（凑满 n 个匹配即停）」按 SA6 §7/H8/O3 裁定以可观测等价兑现（value/total/顺序全一致；短路是成本纪律与实现自由，不作行为断言），成本短路为登记在案的演进位；实现票验收不以短路为门槛，后续票不得误读为「简报项未交付」；③ `in`/范围/OR/NOT/多段 field/count/深相等（备案演进位，A1） | — | 均已在 ADR 0029 开放问题/备选节登记，不构成本票未决前提 |

## 14. 评审修订映射

评审输入：`wiki/raw/task_issue-382_sa2_review.md`（SA2，verdict `approve`；4 项 MINOR finding R-1–R-4，dispatch 指定逐条落实）。全部 finding 已原位修订，无技术冲突、无等待决策项；已批准架构、文件范围（ALLOW/DENY 路径集）与验收目标零变化。

| Finding | 修订位置 | 处理结果 |
|---|---|---|
| R-1（MINOR）：D8 备选拒绝理由 (b) 事实错误——「runtime.ts 无构造器」不成立（runtime.ts L980 已有 `seamReadOptionsInvalid`） | §7 D8 备选 (b) 重写；§11 DENY `runtime.ts` 行论据同步 | **已修正**：(b) 改为「① 类型收窄必须发生在消费点（window-read.ts L176–177 `kept < total`；runtime.ts 分支收窄不了组合层内部计算，window-read.ts 仍须独立处理 `number | undefined`——双点处理）+ ② 窗口域失败构造单源（`windowFailure`/`seamWindowOptionsInvalid` 单源于 window-read.ts；runtime.ts L980 构造器属 readData 预算域 `ReadLogicalValueBudgetFailure`，产不出窗口失败面）」；全文不再含「runtime.ts 无构造器」类与源码矛盾断言；落点结论（compose 入口）不变 |
| R-2（MINOR）：D8 独占防御的敌意 Proxy 漂移通道（SC-2）无行为级验证钩子——P4 恒绿、F7 无漂移探针、变异表无删分支变异 | §12「SA8 A2 中间态响亮」行（D8 变异探针双态证据）；§12「SA8 A3/F6 结构面」行（S4 增补检查位）；§12「敏感度/反伪绿」行（新增删分支变异类）；§7 D8 行交叉引用 | **已增补**：① 变异探针——临时删除/软化入口分支 + 构造对 W1/S3 呈不同键视图的 options Proxy 经 lease 调用，必须先观测到静默已过滤成功面（探针有牙），恢复分支后同调用必须 `WINDOW_OPTIONS_INVALID`，双态证据入实现票 artifacts 且与 S1–S4 同列登记；② S4 审计增补「入口分支在场、先于 S3、键于 W1 结算 `total === undefined`」检查位；③ 变异表新增「删除/软化 D8 入口分支」击穿类（编译期 S6 收窄钉为第二道可见性） |
| R-3（MINOR）：F7（lease 级断言）与 doc-runtime 契约文件 ALLOW 组清单口径不一致，易致跨包反向 import | §11 ALLOW 新契约文件行；§7 D10；数据流 R-1 行验收锚点（F 组 → F1–F6） | **已澄清**：新契约文件组清单统一为「C/D/V/P/T/Z + F1–F6」；F7 显式标注不入该文件（需 registry 装配），处置 = 实现期审计证据 + P4 条件不变式耐久形态落 `packages/namespace-registry/test/issue-382-lease-where-no-silent-pass.test.ts`；文件范围与验收映射单一口径，新契约文件零跨包 import |
| R-4（MINOR）：简报「位置序短路选窗」散文表述与 D7「v1 不做流式短路」存在口径差，需防后续票误读为未交付 | §13 Follow-up ② 口径注；§7 D7 行尾交叉注 | **已增注**：简报「短路」表述按 SA6 §7/H8/O3 裁定以可观测等价兑现（value/total/顺序全一致；成本纪律/实现自由/非行为断言）；成本短路为登记在案的演进位（触发条件 ~10⁵）；实现票验收不以短路为门槛 |

SA2 非阻断观察项 N-1–N-6 处置核对：N-1（B-8 不变量注释锚）已由 §8.1 模块头注释改写覆盖；N-2（新构造器照 `seamWindowOptionsInvalid` 同款四键纪律）与 §8.6/§8.7 一致，实现票照既例；N-3（非索引 own 属性忽略）已在 §8.3 W-6 显式；N-4（短路口径）即 R-4，已落实；N-5（lease 中间态 message 变化非契约）与 §8.6「message 非契约字段」一致；N-6（#381 T9c label 观察项）与 §13-R6 一致。无新增风险项。

## 15. 是否需要设计后 ADR 冲突复查及理由

**需要（`requiresConflictRecheck: true`）**，复查点两处，均为窄口径：

1. **W1 公共入口类型面变化的事实核对**（SA8 F3–F7 已预告）：options 联合加 `where?`、成功面 `total: number | undefined` 落地后，按 SA8 冲突报告 §10 的既定要求对 F3（三码）/F4（orderBy 词表）/F5（where 形状终态）/F6（read.ts 零 diff）/F7（无 where 零回归）逐项实现后核对。本设计自身未修订任何 ADR（R1–R16 全部 implements/no-conflict 承接），复查是 SA8 既定门，非新冲突。
2. **D8 中间态机制的增量面**：本设计在 `window-read.ts` 组合层新增一个**入口 fail-closed 失败分支**（键于 W1 结果而非 options 重读）。这是 SA8 A2「中间态必须响亮、不得引入绕过 S3 的静默通道」的落地机制选择，且比 A2 字面描述的 S3 白名单机制更严（多封敌意漂移通道）；但它毕竟是 ADR 0028 §9 组合层与 ADR 0029 §6「两层同步扩」接缝上的新失败位点，其「响亮失败、零静默、缝 2 可整体取代」三性质值得在设计→实现传递时由冲突复查确认与 A2/缝 2 义务无语义冲突。

其余全部设计路线为 ADR 0029 逐条款兑现（词表/管线/结算/安静不匹配/敌意校验/导出面），无需新决策。
