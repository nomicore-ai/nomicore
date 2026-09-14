# ADR 0029：过滤窗口——窗口读的 where 词表演进

日期：2026-09-16（设计敲定：本仓 grill 会话）
状态：已接受（影响包 `@nomicore/doc-runtime`、`@nomicore/namespace-runtime`、`@nomicore/namespace-registry`；实现排 ADR 0028 全阶段之后）

## 背景

ADR 0028 的窗口读解决"确定性选窗"（最新 K 条 / 按键序取 K 个），刻意不回答"哪些条目满足谓词"。典型缺口（mabf-center 场景）：`tasks` 键容器要找**所有** `state == 'claimed'` 的条目。现有兜底是全量读回客户端过滤——全量物化、不知匹配规模、未匹配项白白付出物化成本，恰是 ADR 0028 背景里批评过的问题原样回潮。

值感知的谓词筛选与 ADR 0024 形状预算的结构盲纪律冲突（预算不看数据值做决定），故与窗口读同理：另一种能力，不进 readData options。

## 决策

### 1. 公共面：窗口读 options 增可选 `where` 键（词表演进，非新方法）

- `readArray` / `readMap` 的 options 增可选 `where`：`readonly WhereTerm[]`；
- 不新增第四个读方法、不改 readData；恒四键结算 `{ ok, value, schema, truncated }` 与十四键 runtime 面不动。

### 2. 谓词项（WhereTerm）v1 形状

```ts
type WhereTerm = {
  field: string;                                   // v1 恰单段字面键（点号不拆分）
  equals: string | number | boolean | null;        // 标量闭集；number 须 Number.isFinite
};
```

- **数组 = 合取**（全部满足）——最小惊讶默认，词表不出现 `and` 关键字；
- 空数组 `WINDOW_OPTIONS_INVALID`（与 `n:0` 非法同纪律：无意义形状不留给调用方两个等价表达，"要全集"的唯一写法是不传 `where`）；
- 数组长度上限 16（实现票可调的哨兵值，防敌意载荷放大每条目评估成本）；
- 同 field 重复项合法：AND 下自然语义（恒空或收敛），且为将来同字段区间组合（`gte` + `lt`）保留表达方式；
- equals 收**标量闭集**（覆盖全部已知需求：state/assignee/kind 等值）；容器结构深相等、`in`、范围、OR/NOT、多段 field 全部是备案演进位（数组项形态加法，`where` 自身形状永不再变）。

### 3. 不匹配处置：安静不匹配（数据侧容忍、入参侧响亮）

谓词下钻遇到以下情形**安静不匹配**，绝不响亮失败：field 缺席、条目值非可下钻对象（如数组面元素本身是标量）、field 值非标量（容器/载体）、field 值 non-finite（投影不可表示值）。沿排序"不可比组恒尾"同哲学：脏项不挤掉正常项、一个脏条目不废掉整次查询。入参侧相反：非 finite number、非闭集值类型、形状漂移一律 `WINDOW_OPTIONS_INVALID`（沿 S3 对 `n`/`depth` 的 isFinite 纪律）。

### 4. 管线序与对称性

- 规范管线：**where（候选集筛选）→ orderBy（匹配集总序）→ n（窗口前缀）**——"在匹配子集上选窗"；
- 排序总序、平局锚、组合式 depth、条目列表、身份随行照搬 ADR 0028；
- readArray **对称获得** `where`：过滤与排序正交（ADR 0028 否决的是 array 属性**排序**，不是属性**过滤**）；`where` 不触碰 orderBy 面词表（readArray 仍仅 `by:'index'`）；
- 结构推论：过滤必须发生在选窗之前——runtime 层后滤会得到"前 n 个里滤剩 0 个且匹配规模未知"的错序结果，故 where 必须进 doc-runtime 原语。

### 5. 结算：total 不承诺、truncated 双语义、✂ 段不装配

- **匹配总数恒不承诺**（计数不可短路）：位置序（index/key 基）下流式扫描凑满 n 个匹配即停，说出 `total` 须评估全部 N 条——十万级容器找前 K 个匹配，短路与全扫是实打实的成本差。field 基排序虽必须全枚举（total 恰好免费），但让 total 可见性取决于排序基会使 API 语义依赖实现路径，恒不承诺最干净；
- W1（doc-runtime 窗口原语）成功结算从恰两键扩为 `{ ok: true, value, total: number | undefined }`——**total 键恒在**：无 where = 零值域标识计数（ADR 0028 现状语义）；有 where = `undefined`；
- `truncated` 双语义：
  - 无 where：精确（`kept < total`，照旧）；
  - 有 where：**装满判定**——`kept === n` → `true`（可能还有匹配未入窗）；`kept < n` → `false`（扫完了，确定没有更多）。两个布尔值对任何实现都不撒谎；
- ✂ 段：无 where 照现状按 truncated 装配（既有快照逐字节不变）；**有 where 永不装配**，过滤槽不呈现（呈现文法复杂且 16 条件数组输出可能很长）；
- 计数诉求诚实降级为无兑现渠道：要计数给大 n；专用 count 是独立演进位。

### 6. 敌意校验与失败面

- where 形状校验沿 S3 canonical 纪律：键集白名单（恰 `field`/`equals` 两键）、plain object 原型链、零 `[[Get]]`、零 accessor 执行、trap 异常收编——doc-runtime W1 权威校验与 runtime S3 镜像**两层同步扩**；
- 失败码复用三码族：目标缺席 `WINDOW_TARGET_ABSENT`、载体不符 `WINDOW_CARRIER_MISMATCH`、规则非法（含 where 形状）`WINDOW_OPTIONS_INVALID`。

### 7. schema 无关与 authority 划界

- 谓词比较的是**实际数据值**，doc-runtime 过滤原语不依赖 schema；schema 通道（元素口径投影文本）不受 where 影响；
- `where` 是读侧选择机制、谓词无领域语义（机制而非策略）——与 ADR 0002 排除的写侧 authority 规则（state machine / enum / range 不变式）不冲突；本决策不得被援引为在 where 上生长规则引擎的先例。

### 8. W1 包冻结解除与镜像清账（ADR 0028 R2 执行）

- 解除 doc-runtime 窗口原语的包范围冻结：`window.ts` 原地扩 where 与 total；
- S4 候选计数自 namespace-runtime **下沉**进 W1（枚举 / 过滤 / 计数同源，total 的可知性由 W1 内部自决，消除"W1 数的候选集 ≠ runtime 数的匹配集"接缝漂移）；
- runtime 删除 S4 与全部出处标记镜像复制件（`navigate`/`navClassify`/`probeRoot`/`carrierOf`/`readableOwnDataValue` 等约 270 行），收缩为纯组合层（S3 净化 / S5 锚链 / S6 ✂ 装配）；
- W1 成功结算形状变化（两键 → 三键）牵动 doc-runtime 窗口测试家族断言的机械迁移。

## 备选（已否决）

- **独立 query/find API**：查询有自己的词条但形状复制多（depth 组合、条目列表、四键结算、失败码族）、接口面变宽——浅模块化；窗口读词表加一个可选键达到同等表达。
- **readData options 绑定**：谓词筛选破坏预算的结构盲纪律（ADR 0024 已否决同类，ADR 0028 重申）。
- **引擎级派生索引**（state → keys 反向索引，写时维护）：CRDT 下索引载体、复制合并漂移、写放大皆为大承诺——搁置；触发条件 = 线性扫描出现真实规模压力（10⁵ 条目或高频轮询）。调用方**今天就能**用现有能力做应用层反向索引（mutation 时维护派生 map），那是调用方策略，引擎不背。
- **恒输出匹配总数**：计数不可短路；为 total 废掉位置序短路路径，或让 total 可见性依赖排序基（语义依赖实现路径）——两者都不可接受。
- **结算加第五键 total**：破坏恒四键 own 键集纪律，牵连 readData 对称性。
- **✂ 段呈现过滤槽**：文法复杂、输出可能很长；✂ 不装配后调用方自知查询参数。
- **容器深相等 equals**（沿 ADR 0025 词汇）：呈现与敌意形状校验皆贵，已知需求全是标量等值——备案演进位。

## 验收（三缝，沿 ADR 0028 先例）

- **缝 1（doc-runtime 原语公共入口）**：过滤正确性矩阵（合取 / field 缺席 / 非标量 / non-finite / 同 field 重复 / 标量元素数组面）、total 双形态（无 where 计数 / 有 where undefined）、零物化哨兵（未匹配项埋毒值必须 ok）、where 敌意形状校验、三失败码；先例 = issue #368 窗口契约测试家族；
- **缝 2（lease 两方法公共面）**：truncated 双语义、✂ 装配规则（无 where 逐字节不变 / 有 where 永不装配）、恒四键 own 键集、组合式 depth 等价锚、registry 透传、类型面 fail-closed（where 词表 / 数组形态 / 标量闭集）；先例 = issue #369 组合面测试家族与 runtime-data-interface.test-d；
- **缝 3（文档缝）**：CONTEXT.md「过滤窗口」词条与「窗口读」词条分工句锚定，无与 readData 预算 / 窗口读语义混淆的措辞。

## 开放问题（备案演进位）

- 项内比较算子演进：`in`（集合）、`gt`/`gte`/`lt`/`lte`（范围）、OR/NOT（项形态或顶层 `mode:'any'`）；
- 多段 `field`（段数组）；
- `after` keyset 翻页（与"窗口读非分页"纪律的冲突及 CRDT 并发删除漏项窗口届时须记录）；
- 专用 count 能力；
- 容器结构深相等 equals（引 ADR 0025 词汇）；
- 引擎级派生索引（触发条件见备选节）。
