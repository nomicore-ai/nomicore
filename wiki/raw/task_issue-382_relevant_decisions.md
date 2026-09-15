# 相关决议（Relevant Decisions）— 全链 SA 复用

> SA8 前置门禁产出（issue #382：[ADR 0029] P2 — where 过滤原语（缝 1：doc-runtime））。
> 只摘录相关决策、条款与关联点，不重写原义、不作业务设计；引用处保留原文措辞，
> 需要时按编号回查 ADR 全文。裁决见 `wiki/raw/task_issue-382_conflict_report.md`。
>
> 基准快照：worktree `mabf/issue-382` HEAD `1b639e0`（含 `8a4fa40` ADR 0029 设计基线、
> `1b639e0` #381 P1 前置重构）；`docs/adr/` 共 26 份逐个盘点，无一被整体 superseded
> （0027 对 0016/0024 的交付条款修订、0018 对 0010 的局部取代均与本任务无交集）；
> CONTEXT.md 为现行词汇表。issue #382 评论 REST 快照为空（无 Owner 评论）。

## 相关 ADR

### ADR 0029 过滤窗口——窗口读的 where 词表演进（accepted，2026-09-16）——核心相关（本任务的规范权威）

- 与本任务的关联点：issue #382 即其验收「缝 1（doc-runtime 原语公共入口）」实现票（P2；P1 前置重构 #381 已 CLOSED）。
- 核心条款（原文摘录）：
  - §1 公共面：「`readArray` / `readMap` 的 options 增可选 `where`：`readonly WhereTerm[]`；不新增第四个读方法、不改 readData；恒四键结算 `{ ok, value, schema, truncated }` 与十四键 runtime 面不动。」
  - §2 谓词项 v1：`WhereTerm = { field: string（v1 恰单段字面键，点号不拆分）, equals: string | number | boolean | null（标量闭集；number 须 Number.isFinite）}`；「数组 = 合取（全部满足）——最小惊讶默认，词表不出现 `and` 关键字」；「空数组 `WINDOW_OPTIONS_INVALID`（与 `n:0` 非法同纪律……『要全集』的唯一写法是不传 `where`）」；「数组长度上限 16（实现票可调的哨兵值）」；「同 field 重复项合法：AND 下自然语义（恒空或收敛）」；「容器结构深相等、`in`、范围、OR/NOT、多段 field 全部是备案演进位（数组项形态加法，`where` 自身形状永不再变）」。
  - §3 不匹配处置：「谓词下钻遇到以下情形**安静不匹配**，绝不响亮失败：field 缺席、条目值非可下钻对象（如数组面元素本身是标量）、field 值非标量（容器/载体）、field 值 non-finite……脏项不挤掉正常项、一个脏条目不废掉整次查询。入参侧相反：非 finite number、非闭集值类型、形状漂移一律 `WINDOW_OPTIONS_INVALID`（沿 S3 对 `n`/`depth` 的 isFinite 纪律）。」
  - §4 管线序与对称性：「规范管线：**where（候选集筛选）→ orderBy（匹配集总序）→ n（窗口前缀）**——『在匹配子集上选窗』」；「排序总序、平局锚、组合式 depth、条目列表、身份随行照搬 ADR 0028」；「readArray **对称获得** `where`：过滤与排序正交……`where` 不触碰 orderBy 面词表（readArray 仍仅 `by:'index'`）」；「结构推论：过滤必须发生在选窗之前……故 where 必须进 doc-runtime 原语」。
  - §5 结算：「**匹配总数恒不承诺**（计数不可短路）：位置序（index/key 基）下流式扫描凑满 n 个匹配即停」；「W1（doc-runtime 窗口原语）成功结算从恰两键扩为 `{ ok: true, value, total: number | undefined }`——**total 键恒在**：无 where = 零值域标识计数（ADR 0028 现状语义）；有 where = `undefined`」；「`truncated` 双语义：无 where 精确（`kept < total`）；有 where 装满判定（`kept === n` → true / `kept < n` → false）」；「✂ 段：无 where 照现状按 truncated 装配（既有快照逐字节不变）；**有 where 永不装配**，过滤槽不呈现」；「计数诉求诚实降级为无兑现渠道：要计数给大 n；专用 count 是独立演进位」。
  - §6 敌意校验与失败面：「where 形状校验沿 S3 canonical 纪律：键集白名单（恰 `field`/`equals` 两键）、plain object 原型链、零 `[[Get]]`、零 accessor 执行、trap 异常收编——doc-runtime W1 权威校验与 runtime S3 镜像**两层同步扩**」；「失败码复用三码族：`WINDOW_TARGET_ABSENT` / `WINDOW_CARRIER_MISMATCH` / `WINDOW_OPTIONS_INVALID`」。
  - §7 schema 无关与 authority 划界：「谓词比较的是**实际数据值**，doc-runtime 过滤原语不依赖 schema；schema 通道（元素口径投影文本）不受 where 影响」；「`where` 是读侧选择机制、谓词无领域语义（机制而非策略）——与 ADR 0002 排除的写侧 authority 规则……不冲突；本决策不得被援引为在 where 上生长规则引擎的先例」。
  - §8 W1 冻结解除与镜像清账：「解除 doc-runtime 窗口原语的包范围冻结：`window.ts` 原地扩 where 与 total」；「S4 候选计数自 namespace-runtime **下沉**进 W1」；「runtime 删除 S4 与全部出处标记镜像复制件……收缩为纯组合层（S3 净化 / S5 锚链 / S6 ✂ 装配）」。
  - 备选（已否决）：独立 query/find API；readData options 绑定（破坏 ADR 0024 结构盲纪律）；引擎级派生索引；恒输出匹配总数；「结算加第五键 total：破坏恒四键 own 键集纪律」；✂ 段呈现过滤槽；容器深相等 equals。
  - 验收三缝：「**缝 1（doc-runtime 原语公共入口）**：过滤正确性矩阵（合取 / field 缺席 / 非标量 / non-finite / 同 field 重复 / 标量元素数组面）、total 双形态（无 where 计数 / 有 where undefined）、零物化哨兵（未匹配项埋毒值必须 ok）、where 敌意形状校验、三失败码；先例 = issue #368 窗口契约测试家族」；缝 2（lease 两方法公共面：truncated 双语义、✂ 装配规则、恒四键 own 键集、类型面 fail-closed）；缝 3（文档缝：CONTEXT.md 词条）。
  - 开放问题（备案演进位）：`in`/范围/OR/NOT；多段 field；`after` keyset 翻页；专用 count；深相等 equals；派生索引。

### ADR 0028 窗口读——readArray / readMap 的确定性选窗（accepted，2026-09-14）——核心相关（被 0029 词表演进的基契约）

- 与本任务的关联点：where 的载体原语落点（W1）、排序/失败/成本纪律全部照搬自它；#382 不得回归其任何条款。
- 核心条款（原文摘录）：
  - §1 公共面：`readArray(path, { n, orderBy?, depth?, maxChildrenPerNode? })` / `readMap(...)`；「`n` 必填、≥1 整数（`n:0` 非法……）；`depth` / `maxChildrenPerNode` 为既有预算轴」。
  - §2 排序项：v1 词表「readArray 仅 `by:'index'`；readMap 为 `by:'key'`（缺省）或单段 `field`」；index 基语义经 issue #376/#377 确立为**位置序**（排序键 = 下标本身；见 CONTEXT.md「窗口读」词条与 `window.ts:514`）。
  - §3 值形态：统一条目列表 `[{index,value}]` / `[{key,value}]`；「身份随行」；「呈现序 = 有序基之序」。
  - §4 depth 组合式语义：「每个入选项 ≡ `readData(项路径, { depth, maxChildrenPerNode })`」；「终点宽度由 `n` 治理」。
  - §5 排序纪律：类型组序 number→string→不可比组；「不可比组恒居有序序列的尾端（无论 dir）」；「平局锚：key（map）/ 下标（array）asc 恒定，不随 dir 翻转」。
  - §7 结算与失败：「恒四键 `{ ok, value, schema, truncated }`；`truncated === kept < total`；窗口事实……进 ✂ 段」（lease 层）；三稳定码 `WINDOW_TARGET_ABSENT`（响亮不吸收）/ `WINDOW_CARRIER_MISMATCH` / `WINDOW_OPTIONS_INVALID`；「敌意通道：options / orderBy 封闭数据形状校验，零外抛、零 accessor 执行」。
  - §8 成本纪律：「O(N) 子项枚举 + `field` 基每 child **一次单段下钻** + **只物化入选项**」；「未入选子项零物化——行为哨兵锚定：未入选项内埋投影不可表示值（non-finite / 稀疏空洞）必须 `ok:true`（递归未触及）」。
  - §9 分层与契约归属：「`@nomicore/doc-runtime`：载体级窗口原语……schema 无关」；「`@nomicore/namespace-runtime`：组合选窗与元素口径投影文本；`@nomicore/namespace-registry`：lease 公共面与类型别名」；「**readData 与 ADR-0024 的 options 零改动**」。

### ADR 0027 readData 投影文本化（accepted）——相关（恒四键结算权威）

- 关联点：lease 层窗口读结算沿用其恒四键形态；ADR 0029 备选明文否决「结算加第五键 total」。
- 条款摘录：§1「成功分支**恒四键** `{ ok, value, schema, truncated }`」；「`options` 闭合形状 `{ depth?, maxChildrenPerNode? }` **零变化**（预算单一权威与三层透传不动）」。

### ADR 0024 readData 形状预算（accepted）——相关（结构盲纪律，经 0027/0028/0029 引用）

- 关联点：值感知谓词筛选不进 readData options 的纪律源头；CONTEXT.md「形状预算」词条：「预算的 width 是**护栏**而非选择器——有意义的 N 项选择（按序取前/后、按键或值属性排序）走窗口读（ADR-0028）」。

### ADR 0023 Cordis 冻结服务表面（accepted）——弱相关

- 关联点：冻结的是**服务对象字面量构造纪律**（registry/ws-replication/clock 等含函数成员的服务面）；窗口读 options 类型词表不在其冻结面内。#382 不触碰任何服务对象构造。

### ADR 0002 全新重写，authority 完全出范围（accepted）——相关（authority 划界）

- 条款摘录：「旧系统既有的 authority 规则体系（`__authority__` manifest：enum / range / conditional / state-machine）**完全排除在范围外，不保留接口**」。
- 关联点：ADR 0029 §7 已划界——where 谓词无领域语义（机制而非策略），非 authority 回潮；且不得援引为规则引擎先例。

### ADR 0008 NamespaceRuntime 读写能力与单序列器（accepted）——相关（读边界）

- 条款摘录：「普通 open/read 不应再次编译或校验 VFSL」；「读取只观察调用瞬间已经提交的 live Y.Doc」。
- 关联点：where 过滤只比较实际载体值，schema 无关，符合读侧不重编译/不重校验边界。

### ADR 0016 / 0017 / 0018 / 0019 / 0020 / 0021 / 0022 / 0025 / 0026 等——无关或弱相关

- 与窗口读 where 无条款交集（schema 投影语义、schema 生命周期、chunked 传输、条件写、原子信封均不在 #382 触碰面内）。

## CONTEXT.md 词条（现行词汇表）

- 「形状预算」（L50）：预算护栏 vs 窗口读选择器分工句（见上）。
- 「窗口读（window read）」（L61–63）：两方法、n 必填 ≥1、WindowTerm 词表、条目列表身份随行、组合式 depth、排序总序与平局锚、index 基位置序（issue #376）、schema 通道元素口径投影文本、三失败码；结尾「其谓词过滤词表演进（where）见『过滤窗口』」。
- 「过滤窗口（filtered window read）」（L65–67）：「窗口读的词表演进（ADR 0029）……**合取**语义……在选窗前过滤候选集（管线序 where → orderBy → n……readArray 对称获得）。**匹配总数不承诺**……where 在场时结算 `total` 位为 undefined、✂ 段永不装配，`truncated` 退化为装满判定……field 缺席 / 值非标量 / non-finite / 不可下钻安静不匹配……不得援引为在 where 上生长规则引擎的先例」；_Avoid_：「期望匹配总数或计数探针（要计数给大 n）」「OR/NOT/in/范围/多段 field（v1 词表外响亮拒绝，均为备案演进位）」等。

## 模块 AGENTS（明确收录的边界）

- `packages/doc-runtime/AGENTS.md`：「Keep reads schema-independent」（where 比较实际数据值，合规）；「Keep carrier mechanics here」（where 过滤属载体机制，落点正确）；「Add public APIs only through `src/index.ts`; public-surface guard tests must account for every export」（WhereTerm 等新公共类型导出义务）。

## 当前代码事实（证据，非决策文本；仅用于确认基线状态）

- `packages/doc-runtime/src/window.ts`（HEAD `1b639e0`，#381 后状态）：模块头声明 ADR 0028 缝 1 权威 + ADR 0029 §5/§8；成功结算恰三键 `{ok:true, value, total}`，`total` = 候选标识计数（「本票无 `where` ⟹ `total` 恒为数值」——即 #382 要把它扩为 `number | undefined`）；「`read.ts` **零 diff**（冻结面）」+ `copied from read.ts@36a73bb` 镜像纪律（D2/SA2-F4）；index 基位置序注释（L514）。
- `packages/namespace-runtime/src/window-read.ts`：S3 `canonicalWindowBudget` 对 options 键集白名单**恰四键**（`n`/`orderBy`/`depth`/`maxChildrenPerNode`），四键外任意键 → `{ok:false}` → `WINDOW_OPTIONS_INVALID`（「键集漂移：W1 视角本应拒绝 → 视图不稳定」）——缝 1 落地后、缝 2 落地前的中间态对 lease 面传入的 `where` **响亮失败**，不静默。
- 类型别名链：`NamespaceLeaseReadArrayOptions = NamespaceRuntimeReadArrayOptions = ReadArrayWindowOptions`（registry → runtime → doc-runtime）——W1 options 类型扩展会透传到 lease 类型面（缝序设计须处置，见冲突报告 A2）。
- 测试先例在场：`packages/doc-runtime/test/issue-368-window-read-contract-red.test.ts`、`issue-368-window-read-design-pins.test.ts`、`issue-381-window-total-red.test.ts`。
- 前置票状态：#381（P1 W1 冻结解除与 total 下沉）CLOSED（commit `1b639e0`）；父 PR #380（阶段集成基线）OPEN——实现票同支累积、阶段收官人工合并（中间态不污染 main）。
