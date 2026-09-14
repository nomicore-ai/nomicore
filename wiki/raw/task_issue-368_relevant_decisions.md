# 相关决策摘录 — Issue #368 W1: doc-runtime 载体级窗口原语（ADR 0028）

- 任务：Issue #368（W1：doc-runtime 载体级窗口原语——确定性选窗、条目列表、零物化、三失败码）
- 简报：`wiki/raw/task_issue-368.md`（Issue 正文 + 验收标准；评论数为 0）
- 阶段：task 前置门禁（SA 派发前）
- 决策集：本 worktree `docs/adr/` 现存全部 26 个 ADR 文件（0001–0014、0016–0026、0028；编号 0015 与 0027 空缺——0027 由并行阶段 PR #362 占用、未进入本 worktree）+ 根 `CONTEXT.md` + `docs/protocols/instance-replication-v1.md` + 模块 AGENTS 明确收录的决策
- 本文件只摘录与被审对象相关的决策、条款与关联点，不重写原义、不作业务设计

## 1. ADR 0028 窗口读（docs/adr/0028-window-read.md）——本任务主契约

状态行（L4）：「已接受（影响包 `@nomicore/doc-runtime`、`@nomicore/namespace-runtime`、`@nomicore/namespace-registry`；**schema 通道形态依赖 ADR-0027 交付，实现排其阶段之后**）」

### 决策 2（L24–35）排序项 WindowTerm —— 任务「排序项」段的直接依据

- `{ by: 'index'; dir? }`（readArray 专属；缺省即此，asc = 自 [0] 取）｜`{ by: 'key'; dir? }`（readMap 键基）｜`{ field: string; dir? }`（readMap 值属性基；v1 恰单段）；`dir` 缺省 asc；
- v1 词表：readArray 仅 `by:'index'`；readMap 为 `by:'key'`（缺省）或单段 `field`；by 与 dir 同项成对。

### 决策 3（L37–42）统一条目列表 —— 任务「条目列表」段的直接依据

- readArray → `[{ index, value }, …]`；readMap → `[{ key, value }, …]`；身份随行；呈现序 = 有序基之序；`{index|key, value}` 包装是传输形态，不进 schema 口径；敌意键免疫；空容器 → `value: []`（两 API 同形）。

### 决策 4（L44–48）depth 组合式语义 —— 任务「组合式 depth」段的直接依据

- 每个入选项 ≡ `readData(项路径, { depth, maxChildrenPerNode })`：标量项原样；容器项 depth:0 = 同形空壳、depth:1 = 第一层属性；
- 终点宽度由 `n` 治理；`maxChildrenPerNode` 只治理入选项内部的嵌套容器；`value` 不含容器壳。

### 决策 5（L50–54）排序总序 —— 任务「排序总序」段的直接依据

- 类型组序：number（数值序）→ string（码点序）→ 不可比组（缺失 / null / 布尔 / 容器）；
- 不可比组恒居有序序列尾端（无论 dir）——窗口是序列前 n 前缀；组间序恒定、dir 只翻转组内序；
- 平局锚：key（map）/ 下标（array）asc 恒定，不随 dir 翻转。

### 决策 7（L61–68）结算与失败 —— 任务「失败三码」段的直接依据

- 恒四键 `{ ok, value, schema, truncated }`（lease 层结算形态）；
- 稳定码三枚、响亮不抛：`WINDOW_TARGET_ABSENT`（目标缺席，不做 readData 式缺席吸收）、`WINDOW_CARRIER_MISMATCH`（readArray 收 Y.Array + plain array、readMap 收 Y.Map + plain object；标量 / XmlFragment / 异类一律 mismatch）、`WINDOW_OPTIONS_INVALID`（n=0 / 非整数、非法枚举、readArray 传 field、readMap 传 `by:'index'`、orderBy 非法形状）；
- 敌意通道：options / orderBy 封闭数据形状校验，零外抛、零 accessor 执行（沿 readData options 纪律）。

### 决策 8（L70–73）成本纪律 —— 任务「成本纪律」段与「零物化哨兵」AC 的直接依据

- O(N) 子项枚举 + `field` 基每 child 一次单段下钻 + 只物化入选项（O(n × depth)）；
- 未入选子项零物化——行为哨兵锚定：未入选项内埋投影不可表示值（non-finite / 稀疏空洞）必须 `ok:true`。

### 决策 9（L75–80）分层与契约归属 —— 任务作用域与归属的直接依据

- L77：`@nomicore/doc-runtime`：载体级窗口原语（`readLogicalValueAtPath` 姊妹；**schema 无关**——字段排序比较的是实际数据值，不需要 schema）；
- L78：`@nomicore/namespace-runtime`：组合选窗与元素口径投影文本；`@nomicore/namespace-registry`：lease 公共面与类型别名；
- L79：**readData 与 ADR-0024 的 options 零改动**；「形状预算」词条补分工句（护栏 vs 选择器）；
- L80：**实现时序：依赖 ADR-0027 阶段渲染器（T1）与 readData 文本形态（T2）落地。**

### 决策 6（L56–59）schema 通道（W1 范围外，时序条款的依赖对象）

- 元素口径投影文本；「形态 = ADR-0027 投影文本（实现依赖其渲染器与 readData 文本形态落地）」——该依赖的消费方是 namespace-runtime 层组合，不是 doc-runtime 载体原语。

### 验收缝 1（L93）—— W1 测试契约

- 选窗正确性矩阵（基 × dir × 类型组序 × 不可比尾组 × 平局稳定锚）、零物化哨兵（未入选项埋毒值必须 ok）、三失败码、敌意 options 校验；先例 = readLogicalValueAtPath 预算测试家族。

## 2. ADR 0024 形状预算（docs/adr/0024-readdata-shape-budget.md，含 #359 amendment）

- 决策 1（L22–31）：`depth` / `maxChildrenPerNode` 轴语义（容器各计一层；标量与 `Y.XmlFragment` 终态；depth:0 = 目标容器折叠同形空壳）；非法 options（含未知多余键）响亮拒绝 `READ_OPTIONS_INVALID`（同步、不抛、不执行 accessor）——W1 敌意 options 纪律与 `WINDOW_OPTIONS_INVALID` 的先例；
- 决策 4（L67–78）：readData 成功分支恒五键形状（W1 不触碰；lease 层窗口结算的四键形态由 ADR 0028 决策 7 另立）；
- 验收（L138）：零物化行为哨兵先例——被截子树内埋 non-finite / 稀疏空洞必须 `ok:true`，「先全量物化再裁剪」的退化实现触发 `PATH_NOT_ALLOWED` 变红；
- ADR 0028 决策 9 明文：ADR-0024 的 options 零改动——W1 只能复用轴语义，不得改 readData/readLogicalValueAtPath 的 options 形状。

## 3. ADR 0016 readData 语义 schema 投影（docs/adr/0016-readdata-semantic-schema-projection.md）

- L82（分层与兼容面，经 ADR-0024 修订节登记）：`@nomicore/doc-runtime` 不动——读取保持 schema 无关（ADR 0008），`readLogicalValueAtPath(doc, path)` 签名加法扩展为三参 `options?`、无 options 时签名与语义逐字不变——W1 的「姊妹原语」必须维持该签名与语义不变。

## 4. ADR 0008 NamespaceRuntime 读写能力与单序列器（docs/adr/0008-…md）

- L20（残余有效条款）：`readLogicalValueAtPath(doc, path)` 去掉 `derived` 参数、从固定 ROOT 按实际载体投影普通逻辑值——schema 无关读域的基线；W1 同域加法；
- L229（经 ADR-0024 修订）：「预算内投影 + 截断清单」；`readLogicalValueAtPath(doc, path)` 签名加法扩展——W1 不得触碰。

## 5. ADR 0003 求值器与派生 schema（边界参考）

- ValueSchema 为 9-kind 封闭语义联合（ADR 0024 决策 5 引用为冻结面）——W1 schema 无关，零接触；窗口值形态（条目列表）是传输形态，不进 schema 口径（ADR 0028 决策 3 同义）。

## 6. 模块 AGENTS（packages/doc-runtime/AGENTS.md）

- 「Keep reads schema-independent」「Add public APIs only through `src/index.ts`; public-surface guard tests must account for every export」——W1 新导出必须经 `src/index.ts` 且公共面守卫测试逐导出记账；
- 「Run root `pnpm typecheck` / `pnpm test` when public types or mutation/read contracts change」——与任务门禁 AC 同向。

## 7. CONTEXT.md 词汇锚点

- L58「窗口读」词条：两方法 / WindowTerm / 条目列表 / 组合式 depth / 排序总序 / 三失败码 / 与形状预算分工——与 ADR 0028 措辞一致；**词条内无实现时序语句**；
- L45–46「形状预算」词条：已含护栏 vs 选择器分工句（「预算的 width 是护栏而非选择器——有意义的 N 项选择走窗口读（ADR-0028）」）——ADR 0028 决策 9 要求的词条补句已随设计基线落地；
- L101–102「载体投影读取（readLogicalValueAtPath）」词条：schema 无关、不重复结构/逻辑校验——W1 姊妹原语的词汇基线。

## 8. 外部依赖事实（ADR-0027 阶段状态——时序条款裁定的证据）

- `docs/adr/` 无 0027 文件（编号被并行阶段占用：PR #362「ADR 0027 readData 投影文本化」OPEN、未合并）；
- T1（#363 投影文本渲染器 `renderProjectionText`，`@nomicore/vfsl` 导出）OPEN；T2（#364 readData 投影文本化原子切换）OPEN；`packages/vfsl/src/` 无渲染器文件——**ADR-0027 阶段交付物在本 worktree 均未落地**；
- 相关阶段口径（非决策基准，意图佐证）：spec issue #366「本阶段实现 ticket 须排 0027 阶段 T1 与 T2 落地之后，挂各自 base PR」；PR #367「实现 ticket 待 ADR-0027 阶段（#363/#364）收官后由 /to-tickets 派生」；
- Issue #368（welltop-jim-wang 2026-09-13 创建）「Blocked by: None（可立即开始——载体层原语与 ADR 0027 阶段零依赖）」；评论数为 0（无 Owner override 评论）。

## 9. 决策集完整性注记

- 26 个现存 ADR 逐个盘点于冲突报告「ADR 盘点」表；除上述 0028/0024/0016/0008/0003 外，其余 ADR（0001/0002/0004–0007/0009–0014/0017–0023/0025/0026）与 W1 无条款交叠（全仓「窗口」字样其余命中均为崩溃窗口/竞态窗口/in-flight 槽/TOCTOU 窗口等无关语义）；
- `docs/protocols/instance-replication-v1.md`：W1 纯 doc-runtime 读原语，零 wire 接触。
