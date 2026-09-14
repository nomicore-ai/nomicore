# MABF Task Brief

Repository: welltop-jim-wang/nomicore
Issue: #368
Title: W1: doc-runtime 载体级窗口原语——确定性选窗、条目列表、零物化、三失败码（ADR 0028）
State: open
Issue updated at: 2026-09-13T10:09:45Z

## Issue body

## Parent

PR #367（adr0028-window-read）

## What to build

`@nomicore/doc-runtime` 新增载体级窗口原语（`readLogicalValueAtPath` 的姊妹，schema 无关）：对 path 终点容器做确定性选窗并只物化入选项。任何持有 Y.Doc 的调用方可按排序项取窗口——数组按下标基（asc = 自 [0] 取）、键容器按键码点序或单段值属性基排序，返回统一条目列表，未入选子项零物化。

行为要点（ADR 0028 决策 2/3/5/7/8）：

- **排序项 WindowTerm**：`{by:'index', dir?}` / `{by:'key', dir?}` / `{field: 单段属性名, dir?}`，dir 缺省 asc；v1 词表外组合（readArray 语境传 field / 'key'、readMap 语境传 'index'、多段 field）响亮拒绝；
- **排序总序**：number（数值序）→ string（码点序）→ 不可比组（缺失/null/布尔/容器）**恒居序列尾**（无论 dir——窗口为序列前缀，两方向都先装可比项）；组间序恒定、dir 只翻转组内序；平局按 key/下标 asc 恒定；
- **条目列表**：数组 `[{index, value}…]`、键容器 `[{key, value}…]`，呈现序 = 有序基之序；值不含容器壳；
- **组合式 depth**：每个入选项的物化 ≡ 同预算的逐项读（标量原样；容器项 depth:0 同形空壳、depth:1 第一层属性）；`maxChildrenPerNode` 只治理入选项内部嵌套容器，终点宽度由 `n` 治理；
- **成本纪律**：O(N) 子项枚举 + field 基每 child 一次单段下钻 + 只物化入选项（O(n×depth)）；
- **失败三码（响亮不抛）**：`WINDOW_TARGET_ABSENT`（中间/终点缺席，不做缺席吸收）、`WINDOW_CARRIER_MISMATCH`（在场但载体不符：序列面收 Y.Array+plain array、键面收 Y.Map+plain object，标量/XmlFragment 等一律 mismatch）、`WINDOW_OPTIONS_INVALID`（n=0/非整数、非法枚举、语境外排序项）；敌意 options 封闭数据形状校验、零外抛。

## Acceptance criteria

- [ ] 选窗正确性矩阵（基 × dir × 类型组序 × 不可比尾组 × 平局稳定锚）经公共入口行为断言（不读实现源码）
- [ ] 零物化哨兵：未入选子项内埋投影不可表示值（non-finite / 稀疏空洞）必须 `ok:true`（递归未触及）
- [ ] 条目列表形态：身份（index/key）随行、呈现序 = 有序基之序、空容器 → `[]`
- [ ] 组合式 depth 等价：入选项物化与逐项同预算读逐字节一致
- [ ] 三失败码各就各位（缺席 / 载体不符 / 规则非法），敌意 options 零外抛
- [ ] `@nomicore/doc-runtime` typecheck + 既有测试全绿（纯加法）；root `pnpm typecheck` / `pnpm test` 绿

## Blocked by

None（可立即开始——载体层原语与 ADR 0027 阶段零依赖）

## Comments
