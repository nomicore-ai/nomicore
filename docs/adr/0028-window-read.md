# ADR 0028：窗口读——readArray / readMap 的确定性选窗

日期：2026-09-14（设计敲定：本仓 grill 会话）
状态：已接受（影响包 `@nomicore/doc-runtime`、`@nomicore/namespace-runtime`、`@nomicore/namespace-registry`；schema 通道形态依赖 ADR-0027 交付，实现排其阶段之后）

## 背景

ADR 0024 的 width（`maxChildrenPerNode`）是护栏：每个展开节点保留**前** K 个子项（数组下标序、map 插入序）。实测暴露三个问题（mabf-center 场景）：

1. **错端**：宽容器几乎全是 append 日志（`workRecords` / `history` / `runHistory`）——有信息量的是**最新** K 条，first-K 恰好反向；
2. **不确定**：Y.Map 插入序在复制合并下漂移，同一读两次调用可能保留不同子集；
3. **无规则**：索引类 map（`tasks`）的"前 K 个"既非最新也无领域意义。

根因：**选哪 K 个从未被设计**。且有意义的选窗需要值感知（按字段值排序）——与 readData 预算的**结构盲**纪律（形状预算不看数据值做谓词）冲突。结论：选窗是另一种能力，独立公共面，不进 readData options。

## 决策

### 1. 公共面：两个窗口读方法（lease 层）

- `readArray(path, { n, orderBy?, depth?, maxChildrenPerNode? })`——序列容器窗口（Y.Array 与 plain array）；
- `readMap(path, { n, orderBy?, depth?, maxChildrenPerNode? })`——键容器窗口（Y.Map 与 plain object）；
- `n` 必填、≥1 整数（`n:0` 非法——计数探针太 tricky，要计数正常读）；`depth` / `maxChildrenPerNode` 为既有预算轴（组合语义见决策 4）。

### 2. 排序项（WindowTerm）

```ts
type Dir = 'asc' | 'desc';                                   // 缺省 asc
type WindowTerm =
  | { by: 'index'; dir?: Dir }     // readArray 专属；缺省即此（asc = 自 [0] 取）
  | { by: 'key';   dir?: Dir }     // readMap 键基
  | { field: string; dir?: Dir };  // readMap 值属性基；v1 恰单段
```

- **by 与 dir 同项成对**——多字段演进 = `orderBy` 变项列表（每项自带 dir），零形状变化；
- v1 词表：readArray 仅 `by:'index'`；readMap 为 `by:'key'`（缺省）或单段 `field`；`'key'` / `'index'` 字面量与字段名无歧义（字段基用独立键名 `field`）。

### 3. 值形态：统一条目列表

- `readArray` → `[{ index, value }, …]`；`readMap` → `[{ key, value }, …]`；
- **身份随行**：desc 窗口可回溯原容器，下一轮深读 / mutation 定位直接拼 `[...path, entry.index | entry.key]`；
- 呈现序 = 有序基之序（列表序是硬的，不依赖对象插入序）；`{index|key, value}` 包装是传输形态，不进 schema 口径；
- 敌意键免疫：map 的 key 是**条目字段值**而非属性名（`__proto__` 类键零危害）；空容器 → `value: []`（两 API 同形）。

### 4. depth 组合式语义

- **每个入选项 ≡ `readData(项路径, { depth, maxChildrenPerNode })`**：标量项原样（`number[]` 在 depth:0 也返回 n 个 number）；容器项 depth:0 = 同形空壳、depth:1 = 第一层属性；
- **终点宽度由 `n` 治理**；`maxChildrenPerNode` 只治理入选项**内部**的嵌套容器（护栏职责从终点下移一层）；
- `value` 不含容器壳——窗口即结果。

### 5. 排序纪律（总序确定性）

- 类型组序：**number（数值序）→ string（码点序）→ 不可比组**（缺失 / null / 布尔 / 容器）；组间序恒定，`dir` 只翻转组内序；
- **不可比组恒居有序序列的尾端（无论 dir）**——窗口是序列前 n 前缀 ⟹ 两个方向都先装可比项，缺字段的脏项永远不挤掉正常项；
- 平局锚：key（map）/ 下标（array）**asc 恒定**，不随 dir 翻转——同一数据同一窗口。

### 6. schema 通道：元素口径投影文本

- 描述**入选项的类型块 + docs**（`depth` 截断标记落在元素子树内）；schema 路径键控、与数据无关——空容器（total=0）照常返回元素口径；
- 形态 = ADR-0027 投影文本（实现依赖其渲染器与 readData 文本形态落地）。

### 7. 结算与失败

- 恒四键 `{ ok, value, schema, truncated }`；`truncated === kept < total`；窗口事实（`kept n/total N` + 基与方向）进 ✂ 段；total=0 时 `truncated:false`、无 ✂；
- 稳定码三枚，响亮不抛：
  - `WINDOW_TARGET_ABSENT`——目标**缺席**（中间或终点键不在 / 数组越界）：**响亮报错，不做 readData 式缺席吸收**；
  - `WINDOW_CARRIER_MISMATCH`——在场但载体不符（readArray 收 Y.Array + plain array、readMap 收 Y.Map + plain object；标量 / XmlFragment / 异类一律 mismatch）——agent 可程序化改选另一 API；
  - `WINDOW_OPTIONS_INVALID`——规则非法（n=0 / 非整数、非法枚举、readArray 传 field、readMap 传 `by:'index'`、orderBy 非法形状）；
- 敌意通道：options / orderBy 封闭数据形状校验，零外抛、零 accessor 执行（沿 readData options 纪律）。

### 8. 成本纪律

- O(N) 子项枚举 + `field` 基每 child **一次单段下钻** + **只物化入选项**（O(n × depth)）；
- 未入选子项零物化——行为哨兵锚定：未入选项内埋投影不可表示值（non-finite / 稀疏空洞）必须 `ok:true`（递归未触及）。

### 9. 分层与契约归属

- `@nomicore/doc-runtime`：载体级窗口原语（`readLogicalValueAtPath` 姊妹；schema 无关——字段排序比较的是**实际数据值**，不需要 schema）；
- `@nomicore/namespace-runtime`：组合选窗与元素口径投影文本；`@nomicore/namespace-registry`：lease 公共面与类型别名；
- **readData 与 ADR-0024 的 options 零改动**；「形状预算」词条补分工句（护栏 vs 选择器）；
- 实现时序：依赖 ADR-0027 阶段渲染器（T1）与 readData 文本形态（T2）落地。

## 备选（已否决）

- **readData options 绑定**（keep / mapOrder 轴）：值感知排序破坏预算的结构盲纪律；options 闭合形状三层贯通不纳呈现/选择键。
- **单 API readWindow + `from` 参数**：多字段方向无解（from 独立漂浮）；拆分后词表更窄、载体不符响亮、名字自文档。
- **readMap 值对象形**（`{key: value}`）：序是软的、敌意键要设防、与 readArray 不对称。
- **n=0 计数探针**：太 tricky；要计数正常读一次。
- **嵌套属性路径 / 多字段排序 / readArray 属性排序**：v1 复杂度控制——全部为零形状变化的加法演进位。
- **insertion 基窗口**：不确定序，不提供（要"最近"按时间字段排）。

## 验收（三缝）

- **缝 1（doc-runtime 原语公共入口）**：选窗正确性矩阵（基 × dir × 类型组序 × 不可比尾组 × 平局稳定锚）、零物化哨兵（未入选项埋毒值必须 ok）、三失败码、敌意 options 校验；先例 = readLogicalValueAtPath 预算测试家族；
- **缝 2（lease 两方法公共面）**：恒四键 own 键集、条目列表（身份随行、基序呈现）、元素口径 schema 文本、**组合式 depth 等价锚**（窗口项 ≡ 同预算 readData(项路径)）、truncated 与 ✂ 一致、registry 透传；先例 = runtime readData 测试家族；
- **缝 3（文档缝）**：「窗口读」词条与作用域文档锚定，无与 readData 预算语义混淆的措辞。

## 开放问题

- 多字段排序（`orderBy` 项列表，每项自带 dir）；
- 嵌套属性路径（`field` 段数组）；
- readArray 按属性排序；
- n=0 计数探针；
- 空容器上元素口径的呈现细节（元素类型块 vs 空窗提示行）——实现票定。
