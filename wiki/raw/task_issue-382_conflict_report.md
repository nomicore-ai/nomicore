# 冲突门禁报告

- 被审对象：GitHub issue #382 任务简报（[ADR 0029] P2 — where 过滤原语（缝 1：doc-runtime）：窗口原语两面接受可选 `where` 合取过滤，管线序 where → orderBy → n，位置序短路选窗，where 在场 `total` 为 undefined）
- 冲突基准：`docs/adr/` 全集 26 份逐个盘点（无整体 superseded；0029 为最新、accepted）+ `CONTEXT.md` 现行词条 + 模块 AGENTS 收录边界。评论 REST 快照为空——**无 Owner 评论，无任何 override 权威在场**。
- 门禁阶段：前置门禁（SA 派发之前；iteration 0）
- 产出日期：2026-09-16（SA8，dispatch `sa-c398d6ca-9c80-4aeb-948e-7f9b177cbcd5`）
- 配套决议清单：`wiki/raw/task_issue-382_relevant_decisions.md`
- 基线快照：worktree `mabf/issue-382` HEAD `1b639e0`（ADR 0029 设计基线 `8a4fa40` + P1 前置重构 #381 已入；前置票 #381 CLOSED）

## 1. Reviewed subject

**task**（前置门禁）：issue #382 任务简报 vs ADR 全集 + CONTEXT.md。

## 2. Inputs and decision set

输入：`wiki/raw/task_issue-382.md`（issue #382 正文快照，评论为空）、`CONTEXT.md`、`docs/adr/**`、`packages/doc-runtime/AGENTS.md`（模块收录边界）；代码（`window.ts` / `window-read.ts` / registry 类型面）仅作当前事实确认，不构成裁决依据。决策集状态：ADR 0029（accepted，2026-09-16，规范权威）演进 ADR 0028（accepted，基契约）；ADR 0027（恒四键）、0024（结构盲预算）、0008（读边界）、0002（authority 出范围）、0023（冻结服务面）为关联约束；无 superseded ADR 参与对照。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| R1 | ADR 0029 §4/§8 | 「过滤必须发生在选窗之前……故 where 必须进 doc-runtime 原语」；「解除 doc-runtime 窗口原语的包范围冻结：`window.ts` 原地扩 where 与 total」 | #382 在 `readArrayWindowAtPath`/`readMapWindowAtPath` 两面原地扩可选 `where`（缝 1 = doc-runtime 原语公共入口） | implements-existing-decision | `docs/adr/0029-filtered-window-read.md` §4/§8；issue #382 正文 | 按 ADR 原地扩展，不新建模块/方法 |
| R2 | ADR 0029 §2 | WhereTerm v1 = `{field: 单段字面键, equals: string\|number\|boolean\|null}`，number 须 finite；合取；空数组非法；上限 16（实现票可调哨兵）；同 field 重复合法；「`where` 自身形状永不再变」 | 简报 WhereTerm v1 逐字对应；AC「空数组、超 16 项、非 finite number、非闭集值类型、WhereTerm 未知键 → `WINDOW_OPTIONS_INVALID`」 | implements-existing-decision | ADR 0029 §2；issue #382 正文 + AC3 | v1 只收标量闭集等值，词表不得扩大（见 F5） |
| R3 | ADR 0029 §3 | 「安静不匹配，绝不响亮失败：field 缺席、条目值非可下钻对象、field 值非标量、field 值 non-finite」；「入参侧相反：……一律 `WINDOW_OPTIONS_INVALID`」 | AC2 安静不匹配纪律（含 equals:null 对缺席 field 不匹配、在场 null 匹配）+ AC3 入参侧响亮 | implements-existing-decision | ADR 0029 §3；issue #382 AC2/AC3 | 无（照文执行） |
| R4 | ADR 0029 §4 | 「管线：where → orderBy → n」；「readArray 对称获得 where」；「where 不触碰 orderBy 面词表（readArray 仍仅 `by:'index'`）」 | 简报管线序 + AC7「where 不触碰 orderBy 面词表」；两面均获得 where | implements-existing-decision | ADR 0029 §4；issue #382 正文 + AC7 | 无 |
| R5 | ADR 0029 §5 | 「total 键恒在：无 where = 标识计数；有 where = undefined」；「匹配总数恒不承诺（计数不可短路）：位置序……凑满 n 个即停」 | AC6「where 在场：`total === undefined`；where 缺席：`total` = 标识计数（P1 语义零回归）」+ 简报位置序短路 | implements-existing-decision | ADR 0029 §5；issue #382 正文 + AC6 | truncated 双语义 / ✂ 永不装配属 lease 层（缝 2），#382 正确地不触碰 |
| R6 | ADR 0029 §6 | 「键集白名单（恰 field/equals 两键）、plain object 原型链、零 `[[Get]]`、零 accessor 执行、trap 异常收编——W1 权威校验与 runtime S3 镜像两层同步扩」；失败码复用三码族 | AC3/AC4 敌意 options 零 `[[Get]]`、零外抛、收编为响亮失败；AC7 三失败码语义不回归 | implements-existing-decision | ADR 0029 §6；issue #382 AC3/AC4/AC7 | W1 权威校验随本票落地；S3 镜像扩展义务由缝 2 票在阶段内闭合（见 A2；当前 S3 对四键外键 fail-closed，中间态响亮） |
| R7 | ADR 0029 §7 | 「谓词比较的是实际数据值，doc-runtime 过滤原语不依赖 schema」；「谓词无领域语义……不得援引为在 where 上生长规则引擎的先例」 | where 为等值筛选，比较实际载体值，无 domain 语义注入 | no-conflict | ADR 0029 §7 | 无 |
| R8 | ADR 0029 验收缝 1 + ADR 0028 §8 | 缝 1 验收矩阵：过滤正确性矩阵（含标量元素数组面）、total 双形态、零物化哨兵（未匹配项埋毒值必须 ok）、敌意校验、三失败码；先例 = issue #368 家族 | #382 AC1/AC5/AC8 与验收矩阵逐项对应（含四载体族、毒值哨兵、#368 同款风格） | implements-existing-decision | ADR 0029 验收节；ADR 0028 §8；issue #382 AC1/AC5/AC8 | 测试落 `packages/doc-runtime/test/`，沿 contract-red + design-pins 先例 |
| R9 | ADR 0028 §2/§5（+ CONTEXT.md「窗口读」index 基位置序，issue #376） | 排序总序、不可比组恒尾、平局锚 asc 恒定；词表 readArray 仅 `by:'index'` | where 在匹配子集上选窗，排序纪律/平局锚原样照搬；词表不动 | no-conflict（义务性保持） | ADR 0028 §2/§5；CONTEXT.md L61–63 | 实现不得改变无 where 路径的排序行为 |
| R10 | ADR 0028 §7 | 三稳定码语义（缺席响亮不吸收 / 载体不符 / 规则非法）+ 敌意通道零外抛 | AC7 三失败码语义不回归 | no-conflict（义务性保持） | ADR 0028 §7；issue #382 AC7 | 无 |
| R11 | ADR 0028 §9 + `packages/doc-runtime/AGENTS.md` | 「doc-runtime：载体级窗口原语……schema 无关」；模块边界「Keep reads schema-independent / Keep carrier mechanics here / Add public APIs only through `src/index.ts`，public-surface guard tests must account for every export」 | where 落 `window.ts`（载体机制、schema 无关）；WhereTerm 新公共类型需导出并纳入守卫 | no-conflict（附执行义务 A3） | ADR 0028 §9；packages/doc-runtime/AGENTS.md | 见 A3 |
| R12 | ADR 0027 §1 + ADR 0029 备选 | lease 结算恒四键 `{ok,value,schema,truncated}`；「结算加第五键 total：破坏恒四键 own 键集纪律」已否决；readData options 闭合形状零变化 | #382 只动 W1 三键结算内的 total 值域（`number` → `number \| undefined`），不动 lease 四键面与 readData | no-conflict | ADR 0027 §1；ADR 0029 备选节 | 无 |
| R13 | ADR 0024（经 0027 §1/0028 背景/0029 背景引用）+ CONTEXT.md「形状预算」 | 预算结构盲纪律；值感知选择走窗口读独立公共面，不进 readData options | #382 不触碰 readData/预算轴 | no-conflict | ADR 0029 背景；CONTEXT.md L50 | 无 |
| R14 | ADR 0023 | 冻结服务对象字面量构造纪律（registry/ws-replication/clock 服务面） | #382 不触碰任何服务对象构造 | no-conflict（无关面） | ADR 0023 | 无 |
| R15 | ADR 0002 | authority 规则体系（enum/range/conditional/state-machine）完全排除、不保留接口 | where 谓词无领域语义（ADR 0029 §7 划界），非 authority 回潮 | no-conflict | ADR 0002；ADR 0029 §7 | 实现与后续设计不得在 where 上生长规则引擎语义 |
| R16 | ADR 0008 | 「普通 open/read 不应再次编译或校验 VFSL」；读只观察已提交 live Y.Doc | where 过滤只比较实际载体值，无 schema 依赖 | no-conflict | ADR 0008 §读取能力 | 无 |

裁决分布：**implements-existing-decision ×7（R1–R6、R8）、no-conflict ×9（R7、R9–R16）、evolution-required ×0、hard-conflict ×0**。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| ——（无需任何 override） | ——（评论快照为空，无 Owner 评论；亦无新 ADR/协议版本援引） | —— | —— |

说明：#382 不与任何现行决策冲突，故不存在也无需 override 权威；issue 正文自身也不是 override（它是对已接受 ADR 0029 的实现票）。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| F1 readData options 闭合形状 `{depth?, maxChildrenPerNode?}` | 三层透传零变化 | ADR 0027 §1；ADR 0024 | #382 不触碰 → 保持 |
| F2 lease 窗口读恒四键 `{ok,value,schema,truncated}` + 十四键 runtime 面 | own 键集不动；total 不上 lease 结算 | ADR 0027 §1；ADR 0029 §1/备选 | 缝 1 不触碰 → 保持 |
| F3 三窗口失败码 `WINDOW_TARGET_ABSENT`/`WINDOW_CARRIER_MISMATCH`/`WINDOW_OPTIONS_INVALID`（+ `PATH_NOT_ALLOWED` 透传） | 不新增码、语义不漂移；where 形状非法收编进 `WINDOW_OPTIONS_INVALID` | ADR 0028 §7；ADR 0029 §6 | 简报承诺不回归 → 保持（实现后核对） |
| F4 orderBy v1 词表（readArray 仅 `by:'index'`；readMap `by:'key'`\|单段 `field`） | where 不触碰排序词表 | ADR 0028 §2；ADR 0029 §4 | 简报 AC7 明示 → 保持（实现后核对） |
| F5 `where` 自身形状永不再变 | v1 只收标量闭集等值；in/范围/OR/NOT/多段 field 响亮拒绝（备案演进位） | ADR 0029 §2 | 简报 WhereTerm v1 一致 → 保持（实现后核对） |
| F6 `read.ts` 零 diff + `copied from read.ts@36a73bb` 镜像纪律 | where 扩展不得触碰 read.ts | window.ts 模块头（D2/SA2-F4） | #382 落点为 window.ts 原地扩 → 保持（实现后核对） |
| F7 where 缺席行为零回归 | total = 标识计数、truncated = kept < total、✂ 照旧逐字节（P1 语义） | ADR 0029 §5；#381 | 简报 AC6 明示 → 保持（实现后核对） |
| F8 ✂ 段 where 在场永不装配、过滤槽不呈现 | 缝 2（lease 层）面 | ADR 0029 §5 | #382 缝 1 不触碰 → 保持 |

## 6. Evolution requirements

**无新增 evolution 项**（evolution-required ×0）。决策演进已在本任务之前正式完成：ADR 0029 已接受并入库（commit `8a4fa40`）；CONTEXT.md「窗口读」分工句 + 「过滤窗口」词条已落（缝 3 已闭合，PR #380 集成基线）；P1 前置重构 #381（W1 冻结解除 + total 下沉 + 组合层收缩）已落地（commit `1b639e0`，CLOSED）。#382 是已接受决策的兑现票，自身不要求任何 ADR/CONTEXT/协议修订，计划完备性核对不适用。

## 7. Hard conflicts

无（hard-conflict ×0）。

## 8. Required actions

- **A1（词表纪律）**：严格按 ADR 0029 §2–§6 缝 1 范围执行；in/范围/OR/NOT/多段 field、容器深相等一律 v1 词表外响亮拒绝，不得以「实现方便」扩大词表。
- **A2（缝序一致性，设计/实现须显式处置）**：类型别名链 `NamespaceLeaseReadArrayOptions = NamespaceRuntimeReadArrayOptions = ReadArrayWindowOptions` 会把 W1 options 类型扩展透传到 lease 类型面。缝 1 落地后、缝 2 落地前的中间态：当前 S3 `canonicalWindowBudget` 对四键外键集漂移 fail-closed（`window-read.ts`「键集漂移……视图不稳定」→ `WINDOW_OPTIONS_INVALID`），lease 面实传 `where` 会**响亮失败**而非静默错组 ✂——该中间态必须保持响亮（设计不得引入绕过 S3 的静默通道），且 ADR 0029 §6「W1 权威校验与 runtime S3 镜像两层同步扩」须在阶段收官（PR #380 同支累积合并）前由缝 2 票闭合。
- **A3（公共面守卫）**：新公共类型（如 `WhereTerm`）须经 `packages/doc-runtime/src/index.ts` 导出并纳入 public-surface guard 测试（模块 AGENTS 义务）。
- **A4（冻结面纪律）**：`read.ts` 零 diff；`window.ts` 原地扩展（ADR 0029 §8）；无 where 路径行为逐字节不变（F7）。
- **A5（测试先例）**：缝 1 测试沿 issue #368 契约家族同款风格（`issue-368-window-read-contract-red` / `design-pins`；`issue-381-window-total-red` 已在场），全仓 typecheck + 测试绿（AC8）。

## 9. Verdict

**`clear`**

全部对照项为 no-conflict（×9）或 implements-existing-decision（×7）：issue #382 是已接受 ADR 0029 验收缝 1 的忠实实现票，逐条款与决策文本对应，无 evolution-required、无 hard-conflict、无需 override。**放行进入后续 SA 派发**；附带 A1–A5 执行义务（非阻塞）。

## 10. requiresConflictRecheck

**true** —— W1 公共入口签名（options 增 `where`、结算 `total: number | undefined`）与失败语义（where 形状校验收编进 `WINDOW_OPTIONS_INVALID`）尚待实现核对（F3–F7 冻结面逐项）；且 ADR 0029 §6「两层同步扩」与 §5 truncated 双语义/✂ 装配规则的缝 2 义务在本票之后仍待实现核对（A2）。
