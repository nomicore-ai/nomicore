# 冲突门禁报告（实现后复审）

- 被审对象：issue #382（[ADR 0029] P2 — where 过滤原语·缝 1：doc-runtime）的 **SA3 实现**——
  worktree `/home/wangjian/nomicore-fix-issue-382` 当前未提交 diff（5 个修改文件 + 3 个新测试文件 +
  12 份证据日志）+ 实现报告 `wiki/raw/task_issue-382_sa3_impl.md`（dispatch
  `sa-34864478-43cc-451c-a169-8f49c7860975`，iteration 0）。
- 冲突基准：`docs/adr/` 全集 26 份逐个盘点（本次复核：全部 accepted，无整体 superseded——0007 的
  Runtime/open/read 条款被 0008 部分取代、0027 对 0016/0024 的交付条款修订均与本 diff 无交集；
  0029 accepted 2026-09-16 为规范权威）+ `CONTEXT.md` 现行词条（「窗口读」「过滤窗口」「形状预算」）
  + 模块 AGENTS 收录边界（doc-runtime / namespace-runtime / namespace-registry）。
- Owner 评论：**REST 快照为空（0 条）——无 owner 需求、无 comment ID、无时间戳；无任何 override
  权威在场**（与前置门禁、设计后复审、SA2 §4、SA6 §2 五方一致）。
- 门禁阶段：实现后复审（SA1 设计 §15 明示要求；设计后复审 `requiresConflictRecheck: true` 的
  既定核对项 F3–F7 + A2′ 分支形态纪律 + A6′ 双态证据在本轮闭合）。
- 产出日期：2026-09-16（SA8，dispatch `sa-785c2fba-3402-42a5-9442-23eb8b3172bf`；iteration 1）。
- 上位产物：前置门禁 `task_issue-382_conflict_report.md`（`clear`，A1–A5 + F1–F8 + R1–R16）→
  设计后复审 `task_issue-382_design_conflict_report.md`（`clear`，DR-1–DR-20 + A1′–A4′ + A6′）。
- 基线快照：HEAD `1b639e0ebe825ffbbfce377850c01ef620734f47`（#381 P1 已入；本次独立复核
  `git rev-parse HEAD` 一致）。

## 1. Reviewed subject

**implementation**（实现后复审）：SA3 实际 diff vs ADR 全集 + CONTEXT.md + 模块 AGENTS + SA6 契约
（§12.1 B-1–B-11、§12.4 M1–M5）+ SA1 设计（§8 判据/管线、§11 ALLOW/DENY、D1–D10）+ SA2 评审
（R-1–R-4 落实）+ 前两轮 SA8 义务（A1–A5、F1–F8、A1′–A4′、A6′）。指定重点：**compose 边界
fail-closed 机制（D8）的实现形态与敌意漂移证据**。

## 2. Inputs and decision set

输入：SA3 实现报告全文（137 行）、当前 diff 全量（`git diff` 逐 hunk + 新文件通读）、SA6 契约、
SA1 设计 iteration 1、SA2 评审、前两轮 SA8 报告、`docs/adr/0029`、`docs/adr/0028` 全文，
`CONTEXT.md` L48–67，三个模块 AGENTS，12 份 `artifacts/sa3-issue382-*.log`。源码仅作事实确认；
裁决只锚定决策文本与已裁决义务。

**本次独立复核的关键实现事实**（每项实跑/实算，非转抄 SA3 报告）：

| # | 事实 | 复核方式 |
|---|---|---|
| K1 | diff 范围恰 5 修改 + 3 新测试：`window.ts`/`index.ts`/`window-read.ts`（src）+ M1/M2/M3 迁移 + 3 新测试文件；`read.ts`/`runtime.ts`/`lease.ts`/`types.ts`/`CONTEXT.md`/`docs/**`/配置 **零 diff**（= 设计 §11 ALLOW 全集，无越界） | `git status --porcelain` + `git diff --stat` |
| K2 | `read.ts` sha256 `3bf6b8b016e4066dd089f2cfd17d9c5bf3ad161ab3285c91b71298d983b1b312` 实算 = F6 冻结值；`git diff HEAD -- read.ts` 空 | `sha256sum` + `git diff` |
| K3 | 冻结逻辑体逐字节：`validateOrderBy`（window.ts）、`canonicalWindowBudget`、`canonicalOrderBy`、`windowFailure`、`seamWindowOptionsInvalid`、`safePathCopy` HEAD vs 工作区函数体 sha256 全部 **SAME** | awk 函数体提取 + sha256 对比 |
| K4 | D8 分支形态：`window-read.ts` L158 `composeWindowRead` 函数体**第一句**（注释后）L168 `if (input.total === undefined) return seamWhereNotImplemented(input.path);`；其后 `const total = input.total;` 类型收窄（**无 `?? 0`、无 `as number`、无兜底**）；先于 S3（`canonicalWindowBudget` L230 白名单仍恰四键）；新私有构造器 L440 经本模块单源 `windowFailure`（四键 + `safePathCopy`） | diff hunk + structural-audit.log + 源码通读 |
| K5 | W1 `window.ts`：`WhereTerm` 类型逐字 = ADR 0029 §2；`WHERE_TERM_LIMIT = 16`；两面 options `where?: readonly WhereTerm[]`；成功面 `total: number \| undefined`（三键 own 集不变）；OPT 五键白名单；`validateWhere`/`validateWhereTerm`/`validateWhereEquals`（descriptor 纪律、plain 原型链、恰两键、零强制转换、闭集 + finite、禁 truthiness、try 收编、防御性浅拷贝）；E+W 枚举循环内联过滤（`whereMatches`/`matchesWhereTerm` 复用 `drillField` 单段下钻，`where !== undefined` 守卫——缺席时 array 面零元素读）；A 阶段 `total: where === undefined ? candidates.length : undefined` | diff 全量通读 |
| K6 | `index.ts`：`WhereTerm` 并入既有 `export type` 块（type-only）；值导出面零新增（`public-surface-guard.test.ts` P-W1/P-W2 两枚断言绿） | diff + 测试日志 |
| K7 | 全仓门：`pnpm test` 396 文件 / 4827 用例 / `Type Errors no errors` / exit 0；`pnpm typecheck`（14 tsc 工程）exit 0；聚焦家族 11 文件 226 用例绿；红灯基线（还原 src 后）契约 44 failed + 类型 3 failed（红因 = 词表位缺席，非环境） | 4 份 artifacts 日志尾段复核 |
| K8 | A6′ 双态证据齐全：① 变异态（删分支 + `?? 0`）分视图 Proxy 经 lease → `ok:true truncated:false keys=["t3"]`（静默已过滤成功面，探针有牙）∧ 同态 plain where 仍 `ok:false`（隔离漂移通道）；② 还原态同调用 → `ok:false WINDOW_OPTIONS_INVALID`、`ownKeysCalls=1`（先于 S3）；③ 纯删除变体 `tsc` exit 2（TS18048 + TS2345）；临时探针文件已删除（grep 零命中） | `sa3-issue382-d8-probe*.log` + `ls` 复核 |
| K9 | 新测试文件 import 面：doc-runtime 两文件仅 `vitest`/`yjs`/`../src/index.js`（零跨包反向依赖，SA2 R-3）；registry P4 文件用集中化 helper `expectReadDataOkKeys`（跨包测试树相对导入，`issue-369`/`registry-*` 等 5 处既有先例）+ `#369` fixture | `grep import` + 先例 grep |
| K10 | 全仓门首轮捕获并修复的违规 = **测试树纪律**（新 registry 测试字面量断言恒四键，违反 #333/#336/#364 形状断言收敛门 family B）→ 改用集中化 helper 后复跑全绿；方向是**收敛**非放宽 | pre-fix-gate-red.log + P4 文件 L30–31/L116–117 |

## 3. Decision analysis

| # | Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| IR-1 | ADR 0029 §1 | options 增可选 `where: readonly WhereTerm[]`；不新增第四读方法、不改 readData；恒四键结算与十四键 runtime 面不动 | 两面 options 对称加 `where?`（K5）；无新读方法、无新值导出（K6）；`read.ts`/`runtime.ts`/`lease.ts` 零 diff（K1） | implements-existing-decision | ADR 0029 §1；K1/K5/K6 | 无 |
| IR-2 | ADR 0029 §2 | WhereTerm v1 两键全必填、标量闭集、number finite、合取、空数组拒、上限 16（恰 16 合法）、同 field 重复合法、「形状永不再变」 | 类型逐字对应；`validateWhere` 空数组拒 / `len > 16` 拒 / 恰 16 放行；无 field 去重（重复项按序全评估 = AND 自然收敛）；`validateWhereEquals` 闭集 + `Number.isFinite` 门；词表零扩大（无 in/范围/OR/NOT/多段/深相等入口） | implements-existing-decision | ADR 0029 §2；K5；契约 V1–V3/V20 绿 | 无（F5 保持） |
| IR-3 | ADR 0029 §3 | 数据侧安静不匹配（field 缺席/不可下钻/非标量/non-finite）× 入参侧响亮（非 finite/非闭集/形状漂移 → `WINDOW_OPTIONS_INVALID`） | `whereMatches`：`drillField → undefined` ⇒ false（安静）；`matchesWhereTerm`：typeof 门 + finite 门 + 严格 `===`（非标量/non-finite 恒 false，零深比较）；入参侧三校验函数全响亮收编 | implements-existing-decision | ADR 0029 §3；K5；D 组/Z 组绿 | 无 |
| IR-4 | ADR 0029 §4 | 管线 **where → orderBy → n**；readArray 对称获得；where 不触碰 orderBy 面词表 | 过滤内联在枚举循环（E+W，先于 S 排序与 M 物化/前缀截取）；两面 options 对称；`validateOrderBy` 函数体 sha256 SAME（逐字节不动） | implements-existing-decision | ADR 0029 §4；K3/K5；P 组/C8/V18 绿 | 无 |
| IR-5 | ADR 0029 §5 | W1 结算 `total` 键恒在：无 where = 标识计数、有 where = `undefined`；匹配总数恒不承诺；truncated 双语义 / ✂ 永不装配属缝 2 | A 阶段单点分支（`where === undefined ? candidates.length : undefined`，own 键恒在的三键字面量）；过滤后匹配数**有意不报告**；truncated/✂ **未实现**（缝 2 面正确未做——where 路径在 compose 入口即拒，到不了 S6） | implements-existing-decision | ADR 0029 §5；K4/K5；T4–T6 绿 | 缝 2 义务见 A1″ |
| IR-6 | ADR 0029 §6 | W1 权威校验：键集白名单（恰 field/equals）、plain 原型链、零 `[[Get]]`、零 accessor 执行、trap 收编；三码族复用；「W1 与 runtime S3 镜像两层同步扩」 | W1 层逐判据落地（K5：五键顶层白名单 + 两键 term 白名单 + descriptor 纪律 + try 收编）；失败全收编 `WINDOW_OPTIONS_INVALID`（零新码）；**S3 镜像未扩**——缝 2 后置（前置门禁 A2 与设计后复审 DR-6/DR-11 已裁决该分阶段合法：中间态由 D8 分支保持响亮，严于 S3 单独把关） | implements-existing-decision（W1 层兑现；S3 镜像义务在缝 2 票闭合，非本票缺陷） | ADR 0029 §6；K3/K4/K5；F7 探针 + P4 不变式绿 | A1″（缝 2 收官前闭合） |
| IR-7 | ADR 0029 §7 + ADR 0002 | 谓词比较**实际数据值**、schema 无关；谓词无领域语义、不得援引为规则引擎先例 | `whereMatches` 只消费 `drillField` 载体原始值；全链零 schema 触碰、零领域语义注入 | no-conflict | ADR 0029 §7；ADR 0002；K5 | 无 |
| IR-8 | ADR 0029 §8 | 「window.ts 原地扩 where 与 total」；S4 候选计数已下沉 W1（#381） | 零新 src 文件/模块（K1）；total 单源于 W1 A 阶段（组合层零计数零重算维持，`WindowComposeInput.total` 单源直通注释在场） | implements-existing-decision | ADR 0029 §8；K1/K4/K5 | 无 |
| IR-9 | ADR 0028 §5/§7/§8 | 排序总序/平局锚/不可比尾组；三稳定码语义；O(N) 枚举 + 单段下钻 + 只物化入选项、未入选零物化 | S/M 阶段零改动（匹配集照搬总序纪律）；零新失败码；谓词每 child 每 term 恰一次单段原始读、未匹配候选零物化 | no-conflict（义务性保持，实证保持） | ADR 0028 §5/§7/§8；K3/K5；#368/#369/#381 家族 + Z1–Z8 绿 | 无 |
| IR-10 | ADR 0028 §9 + ADR 0029 影响包行 | 分层：doc-runtime 载体原语 / namespace-runtime 组合选窗 / registry lease 零校验透传 | 载体机制落 `window.ts`；`window-read.ts` 改动**仅限**两 compose 入口签名 + `WindowComposeInput.total` 加宽 + 入口分支 + 新构造器 + 注释（SA6 M5 已批准的消费边界，设计后复审 DR-10 裁定为 §5 值域经既有直通消费点的机械必然后果）；registry 侧零改动 | implements-existing-decision | ADR 0028 §9；K1/K3/K4 | 无 |
| IR-11 | ADR 0027 §1 + ADR 0029 备选 | lease 恒四键 `{ok,value,schema,truncated}`；「结算加第五键 total」已否决 | compose 成功面构造零改动（where 路径在成功面构造前已响亮失败）；`total` 不上 lease 结算——P4 负控断言 `'total' in result === false` 绿 | no-conflict | ADR 0027 §1；K4；P4 负控 | 无 |
| IR-12 | ADR 0024 + CONTEXT「形状预算」 | 预算结构盲；值感知选择不进 readData options | `read.ts`/`runtime.ts` 零 diff；where 零渗入预算通道（姊妹 `READ_OPTIONS_INVALID` 负控绿） | no-conflict | ADR 0024；K1/K2 | 无 |
| IR-13 | ADR 0023 | 冻结服务对象字面量构造纪律（registry/ws-replication/clock 服务面） | 不触碰任何服务对象构造（compose 为 namespace-runtime 模块内部函数） | no-conflict（无关面） | ADR 0023；K1 | 无 |
| IR-14 | ADR 0008 + namespace-runtime AGENTS | 读不重编译/不重校验 VFSL、只观察已提交 live Y.Doc、读不进 sequencer | 全链同步纯读、零状态、零生命周期触点 | no-conflict | ADR 0008；K5 | 无 |
| IR-15 | SA8 前置 A1（词表纪律） | in/范围/OR/NOT/多段 field/容器深相等一律 v1 词表外响亮拒绝，不得以实现方便扩大 | 实现面无任何演进位入口：term 键集恰两键、equals 闭集运行时校验、`matchesWhereTerm` 标量严格等值永不深比较；16 哨兵未改（具名常量 `WHERE_TERM_LIMIT`） | implements-existing-decision | 前置门禁 A1；K5 | 无 |
| IR-16 | **SA8 前置 A2 + 设计后复审 A2′（中间态响亮 + D8 分支形态纪律）** | 「lease 面实传 where 必须响亮失败、不得引入绕过 S3 的静默通道」；A2′ 四条形态：① 分支位于 `composeWindowRead` 函数体第一句（先于 S3）② 判据键于 W1 结算 `total === undefined`（不得 options 重读）③ 失败经单源四键构造器 ④ S3 判据体逐字节不动 + runtime.ts/lease.ts/types.ts 零 diff | **四条全部实证**（K3/K4）：L168 分支 = L158 函数体第一句；判据 `input.total === undefined`（W1 结算单源，不重读 options、不校验 where 形状——非第三套校验器）；`seamWhereNotImplemented` 经 `windowFailure` + `safePathCopy` 单源四键；`canonicalWindowBudget`/`canonicalOrderBy` sha256 SAME；三文件零 diff；中间态可观察结果与 HEAD E5 **同码同向**（`WINDOW_OPTIONS_INVALID`） | implements-existing-decision（A2/A2′ 的忠实落地） | 前置门禁 A2；设计后复审 A2′/DR-6/DR-8；K3/K4；D8 探针 ② 态 + P4 不变式 | A1″（缝 2 票整体取代该分支时复核） |
| IR-17 | SA8 前置 A3 + `packages/doc-runtime/AGENTS.md` | 新公共类型经 `src/index.ts` 导出并纳入 public-surface guard 记账 | `WhereTerm` type-only 导出（运行时键空间零新增；P-W1/P-W2 值导出恰两枚断言绿）；M2 记账/投影断言在场（`.test-d.ts`） | implements-existing-decision | 模块 AGENTS；K6；type-guard 绿 | 无 |
| IR-18 | SA8 设计后复审 A6′（敌意漂移行为级证据义务） | 「删/软化分支 → 必须观测静默已过滤成功面（探针有牙）；恢复 → `WINDOW_OPTIONS_INVALID`；双态证据与 S1–S4 同列；不得以编译期收窄钉替代」 | 双态证据齐全（K8）：变异态 `ok:true truncated:false keys=["t3"]`（已过滤静默面）∧ plain 对照仍拒（隔离漂移通道）∧ `stackDiscriminated=true ownKeysCalls=2`；还原态 `ok:false WINDOW_OPTIONS_INVALID` ∧ `ownKeysCalls=1`；编译期第二道（纯删除 exit 2）作为补充而非替代；S1–S4 审计（含 S4 增补位）同列登记；临时探针零残留 | implements-existing-decision | 设计后复审 A6′/DR-8；K8 | 无 |
| IR-19 | SA8 前置 A4/A5（冻结面 + 测试先例） | read.ts 零 diff；window.ts 原地；无 where 路径逐字节不变；#368 家族同款；全仓 typecheck + 测试绿 | K2（sha256 实算一致、镜像标记 10→10）；`where !== undefined` 守卫使无 where 路径零新增读（#368/#381/#369 家族 + T1–T3/NC1–NC3 全绿 = 行为级零回归证据）；新三文件沿 #368 家族形态（`import * as docRuntime` + 独立预言机 + 负控）；全仓 396/4827 + typecheck exit 0 | implements-existing-decision | 前置门禁 A4/A5；K2/K5/K7/K9 | 无 |

裁决分布：**implements-existing-decision ×13（IR-1–IR-6、IR-8、IR-10、IR-15–IR-19）、no-conflict ×6
（IR-7、IR-9、IR-11–IR-14）、evolution-required ×0、hard-conflict ×0**。

### 指定重点专述：compose 边界 fail-closed 机制（D8）——implements-existing-decision，实现形态与已裁决设计逐点一致

设计后复审 DR-6/DR-8/DR-10 已裁定该分支为 A2「中间态必须响亮」的唯一交集解落地机制（非第三套
校验器、非缝 2 偷跑、无冻结面触碰）。本次实现核对：① **位置**——`composeWindowRead` 函数体第一句
（L168），先于 S3（`canonicalWindowBudget` L230），`ownKeysCalls=1` 行为证据佐证零 S3 重读/零 W1
重派发；② **判据**——`input.total === undefined`，键于 W1 结算结果（B-8 单源不变量：A 阶段无 where
时 `candidates.length` 恒数值），不重读 options、不校验 where 形状；③ **失败面**——`seamWhereNotImplemented`
经 `windowFailure`（`WINDOW_OPTIONS_INVALID`，四键 + `safePathCopy`），与既有接缝终态
`seamWindowOptionsInvalid` 同族同码同构造源，message 非契约字段（SA6 §15-O2）；④ **类型收窄**——
早退后 `const total = input.total;` 单点收窄，无 `?? 0`/`as number`/静默兜底（SA6 M5 禁令），纯删除
变体 `tsc` exit 2 证明收窄钉在场；⑤ **冻结邻面**——S3/canonicalOrderBy 判据体、runtime.ts、lease.ts、
types.ts 全部逐字节/零 diff。敌意漂移通道（SC-2：同一 raw options 对 W1 呈五键、对 S3 呈干净四键）
经变异探针实证被该分支封死（K8 ①态），A6′ 义务闭合。缝 2 落地时该分支须被「truncated 双语义 +
✂ 永不装配 + S3 镜像扩展」**整体取代**（A2′ 明文），本轮实现未提前兑现任何缝 2 语义。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| ——（无需任何 override） | ——（评论 REST 快照 0 条，无 Owner 评论；无新 ADR/协议版本援引；issue 正文与 SA2/SA6 approve 均非冲突豁免权威） | —— | —— |

实现不与任何现行决策冲突，不存在也无需 override；D8 分支经设计后复审裁定为既有义务（A2）的落地
机制而非契约变更，本次实现未扩大其范围。

## 5. Frozen surfaces（F1–F8 实现逐项核对）

| Surface | Must remain unchanged | Evidence | Actual result（本次实测） |
|---|---|---|---|
| F1 readData options 闭合形状 `{depth?, maxChildrenPerNode?}` | 三层透传零变化 | ADR 0027 §1；ADR 0024 | `read.ts`/`runtime.ts` 零 diff；姊妹 `READ_OPTIONS_INVALID` 负控绿 → **保持** |
| F2 lease 恒四键 + 十四键 runtime 面 | own 键集不动；total 不上 lease 结算 | ADR 0027 §1；ADR 0029 §1/备选 | runtime/lease/types 零 diff；P4 负控四键 + `'total' in result === false` 绿 → **保持** |
| F3 三窗口失败码（+ `PATH_NOT_ALLOWED` 透传） | 不新增码、语义不漂移；where 形状非法与中间态收编 `WINDOW_OPTIONS_INVALID` | ADR 0028 §7；ADR 0029 §6 | 零新码；中间态与 HEAD E5 同码同向；F1–F6 断言绿 → **保持** |
| F4 orderBy v1 词表（readArray 仅 `by:'index'`） | where 不触碰排序词表 | ADR 0028 §2；ADR 0029 §4 | `validateOrderBy` 函数体 sha256 SAME；C8/V18 三向负例绿 → **保持** |
| F5 `where` 自身形状永不再变 | v1 只收标量闭集等值；演进只走数组项形态加法 | ADR 0029 §2 | 类型 + 运行时校验均闭集即终态；`WHERE_TERM_LIMIT=16` 具名单点 → **保持** |
| F6 `read.ts` 零 diff + `copied from read.ts@36a73bb` 镜像纪律 | sha256 `3bf6b8b0…b1b312` + 标记数不减 | 前置门禁 F6；window.ts 模块头 | diff 空、sha256 实算一致、标记数 10→10（structural-audit S1）→ **保持** |
| F7 where 缺席行为零回归 | total = 标识计数、truncated = kept < total、序/条目列表/零物化逐字节（P1 语义） | ADR 0029 §5；#381 | `where !== undefined` 守卫（array 面缺席零元素读）；#368(47+11)/#381(14)/#369(17+33) 家族 + 本票 T1–T3/NC1–NC3 全绿 → **保持** |
| F8 ✂ 段 where 在场永不装配 | 缝 2 面终态语义；缝 1 期间 where 路径到不了 ✂ 装配 | ADR 0029 §5 | where 路径在 compose 入口即拒（早于 S3→S5→S6）；✂ 装配代码零触碰 → **中间态保持（终态待缝 2 票核对翻转）** |

## 6. Evolution requirements

**无新增 evolution 项**（evolution-required ×0）。实现零 ADR/CONTEXT/协议修订需求：决策演进
（ADR 0029、CONTEXT 词条、缝 3、P1 #381）已于任务前正式完成（前置门禁 §6 已核）；本 diff 是已接受
决策缝 1 的兑现。设计后复审裁定的唯一「新失败位点」（D8 分支）经本轮实现核对确认未改变任何冻结面
（失败面四键形状、S3 判据体、成功面构造、runtime/registry 零 diff），维持「A2 既有义务的落地机制」
裁定，无需修订计划。缝 2 义务（truncated 双语义 / ✂ 规则 / S3 镜像「两层同步扩」）为 ADR 0029 既有
验收项的后置兑现，非本实现引入的演进需求（见 A1″）。

## 7. Hard conflicts

无（hard-conflict ×0）。指定重点（compose 边界 fail-closed）落入 implements-existing-decision，
形态与已裁决设计逐点一致（§3 专述）。

## 8. Required actions（后续票义务，非阻塞）

- **A1″（缝 2 收官义务，承接 A2/A2′/DR-5/DR-11）**：ADR 0029 §5/§6 缝 2 面——lease 面 `where`
  接收、`truncated` 双语义、✂ 有 where 永不装配、S3 镜像「两层同步扩」——须在 **PR #380 阶段收官前**
  由缝 2 票闭合，届时**整体取代 D8 分支**（`seamWhereNotImplemented`）并按 DR-5/A2′ 复核取代完整性与
  F7（P4 条件不变式无退役）/F8 终态翻转。在该票落地前，「两层同步扩」保持未闭合状态，不得视为已履行。
- **A2″（复核票敏感度项移交）**：SA6 §12.7 十四类变异中除 D8 类外的 13 类（ignore-where / 见 where 即拒 /
  不校验 / 全量物化 / 整项深读 / 管线错序 / total 计数 / truthiness / `[[Get]]` 下钻 / 词表放宽 /
  readData 渗入 / 期望同源 / 软化手段）由 SA3 移交 SA4/SA7——属测试敏感度/反伪绿防线（SA2/SA6/SA7
  职责域），**非冲突门禁事项**；本轮已核 D8 类（A6′ 明令项）双态证据齐全。
- **A3″（提交纪律）**：SA3 未 commit/push（正确）；commit message 已备（实现报告 §Suggested）。
  合入仍按阶段策略走 PR #380 同支累积。
- 观察项（非缺陷、无动作）：① 全仓门首轮红（新 registry 测试字面量四键断言违反 #333/#336/#364 收敛门）
  已向收敛方向修复（K10），属测试树纪律非决策面；② `#381` T9c label「未知键」语义过时（`where:'x'`
  新因 = 非数组，断言仍同码绿）——M4 零改动纪律维持。

## 9. Verdict

**`clear`**

实现 diff 对 ADR 0029/0028 及关联决策全集逐条款兑现或保持（implements-existing-decision ×13、
no-conflict ×6），SA6 契约（B-1–B-11、C/D/V/P/T/Z/F/Y、M1–M5、S1–S4）、SA1 设计（§8 判据/管线/
ALLOW-DENY、D1–D10）、SA2 R-1–R-4 与前两轮 SA8 义务（A1–A5、F1–F8、A1′–A4′、A6′）全部落实：
冻结面 F1–F8 逐项实测保持（read.ts sha256 实算一致、S3/orderBy 判据体逐字节 SAME、runtime/lease/
types 零 diff）；D8 compose 入口 fail-closed 分支形态四条纪律（第一句/键于 W1 结算/单源四键构造/
S3 不动）逐点实证，敌意漂移双态证据有牙且齐全；全仓 typecheck + 4827 用例全绿。无 evolution-required、
无 hard-conflict、无需 override。**缝 1 实现通过冲突门禁**；附 A1″–A3″ 后续义务（非阻塞）。

## 10. requiresConflictRecheck

**true** —— ① 本被审对象（缝 1 实现）的既定核对项已全部闭合（F3–F7 实测、A2′ 分支形态、A6′ 双态
证据）；② 但 ADR 0029 的**缝 2 面（公共 API 与失败语义）尚待实现核对**：lease 面 `where` 接收、
`truncated` 双语义、✂ 永不装配、S3 镜像「两层同步扩」仍未落地（Follow-up ①，PR #380 阶段收官前
必须闭合）——届时 D8 分支被整体取代、F7 严格断言预期翻转、F8 终态生效，须按 DR-5/A2′ 对缝 2 票
重开冲突门禁复核（A1″）。本报告的 `true` 只承载 ②；① 已闭合。
