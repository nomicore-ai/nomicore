# ADR 0034：Record 与封闭对象 delete 的逐 entry 校验——触达面收窄至目标键位

日期：2026-09-22（设计敲定：与 Owner 讨论会话）
状态：已接受（实现排序在 ADR 0033（#435–437）完成之后；影响包 `@nomicore/vfsl`、`@nomicore/doc-runtime`；复制协议、诊断捕获、写槽零改动）

## 背景

ADR 0033 为数组操作立了逐元素校验。Record map 是同病灶的另一床位，且更常见、更贵：`tasks` / `users` 这类索引型容器天然大，每 entry 是嵌套记录。当前 kind=`record` 的写（如 `tasks/t1 = {...}`）付出 4 次全 map 遍历：S5 整 map 提取（walk）、S6 `rebuildAlong` 全量拷贝（`{…base, [key]: value}` 展开整个对象）+ `validateSubtree` 全量重校验、S9 重投影比对——而 commit 本是 O(1) 单键最小 edit。10 万 entry 的索引 map，改一条记录 = 40 万 entry 处理量。

关键事实：Record 校验是**纯逐 entry** 的——`validateObject` 的 Record 形态对每个键只做 keyPattern 逐键判定 + 值逐值校验，「空对象合法；无必填缺失、无未知键」，**没有任何 map 级约束**（无键数限制、无跨键语义）。`planMutationBoundary` 注释的「键 Pattern/键集随写入判定」被代码证伪：键判定是逐键的，不需要键集。组合性定理比数组更干净：Record 合法 ⟺ 逐键值合法，无位置语义。

同家族第三床位：kind=`parent` 的封闭对象 delete 也全量提取父值，但删除后的必填字段违规是**纯 schema 静态事实**（字段必填性写在 schema 里），读父值是冗余。

## 决策

### 1. Record set/delete 逐 entry fast path

- **set**：导航到 map 并验 Y.Map 载体（O(路径深度)）→ keyPattern 校验新键（O(正则)）→ 新值过值 schema + detached 构造（O(新值)）→ 单键 commit。**旧值不读**（整值替换，与 kind=target 的 R6 同款——Record 写本质即「target 式写 + 键检查」）；
- **delete**：`has(key)` 拒 no-op（O(1)）；空对象合法 ⇒ 删除永不可能使 Record 变非法；
- **闸门**：map 位声明类型（ref 解析后）为**非 union 的 Record 形态**（object 节点含 `<key>` 槽）。map 位为 union（如 `Record<K,V> | 封闭对象`）时成员归属判别需要完整 map 值 → 回退 legacy 全量路径（与 ADR 0033 同款永久双轨）；
- **Record 值位是 union 不影响 fast path**：entry 是整值替换，`validateValue` 对新值做 union 判别即可，不读旧值——闸门比数组案（`A[] | B[]` 需回退）宽，注意勿误读；
- 域规则不变：delete 拒 no-op；issue 路径 `[...mapPath, key]` 与现行逐字节兼容（兼容行为，钉回归测试）。

### 2. 封闭对象 delete 静态判定（kind=`parent`）

删除封闭对象字段后的合法性可由 schema 静态判定，不读父值：

- 目标字段**必填且非 `unknown` 标量** → 拒绝（现行全量校验的唯一数据无关产出；`unknown` 字段缺席视同接受，现行语义保留）；
- 目标字段 optional 或 `unknown` 标量 → 允许；
- 未知键不可能在场（封闭性），无需考虑；`has(key)` 拒 no-op 不变；
- 同胞字段值不重验（归纳不变式承载；审计面收窄见决策 4）。

### 3. S9 收窄

record/parent 的 set/delete 安装事实核本就 O(1)（`get`/`has` 同一性）；边界重投影核对 fast-path 提交省略（无 proposedBoundary）；legacy 路径双核不变。E201 检出面收窄到目标键位——同 ADR 0033 决策 3 的已确认取舍。

### 4. 触达面收窄（扩展 ADR-0010 issue #237 修订节）

- Record 写触达面 = **map 载体本身 + 目标键位**；封闭对象 delete 触达面 = **父载体 + 目标键位**；未触达 entry/字段不再承担 trusted raw replication 非法数据的检测职责；
- 对污染 map 的写从「连带拒绝」变为「目标键合法即成功」——与 ADR 0033 数组案、R6 set 修复哲学对齐；至此 map / 数组 / 封闭对象的审计纪律统一；
- 不补异步/抽样审计机制（需要时另行设计）。

### 5. 立法扩展：容器约束逐 entry 可组合

ADR 0033 的承诺扩展为容器级：

- **Record 合法 ⟺ 逐键值合法**（键过 Pattern ∧ 值过值 schema）；封闭对象 delete 合法性 = 目标字段必填性（静态）；
- 禁止未来引入 map 级约束（键数限制、跨键约束等）以校验器特判；若 schema 演进确需，必须先恢复整体验证路径或设计双轨；
- enforcement = 一致性 fixture（逐 entry 判定 vs 全量 `validateSubtree` 在随机/参数化用例下逐字节一致）+ 本文档；数组案 fixture 扩展覆盖 Record/parent 两形态。

### 6. 与 ADR 0033 的关系与排序

- 实现排序：ADR 0033 的 ticket（#435–437）完成后本 ADR 才开工；
- vfsl 逐 entry seam 的语义同构（数组元素 ↔ Record 键值对），0034 实现时应复用而非另起平行机制；但 #435 的既定范围不动（scope 纪律）；
- tracking issue 与实现 ticket 在开工时经 /to-spec、/to-tickets 补立。

## 不做什么

- union map 位、union 穿越的写（kind=`union`）：legacy 路径不动；
- map 级约束语法：本阶段被立法禁止，而非被实现；
- 封闭对象的 set：本就 kind=target（目标位整值替换、旧值不读），无优化空间，不涉及；
- raw-replication 污染的异步/抽样审计：不建；
- 历史/回滚的前像捕获：独立议题。仅记录：Record 的逆操作比数组更干净——无位置语义，`old value | absent` 即全部；fast path 后被删 entry 的旧值需主动读（O(条目)），不再从全 map walk 免费获得。

## 后果

- **正**：Record set 从 O(n) 降为 O(新值)，Record/封闭对象 delete 降为 O(1)；索引型大 map 的写路径成本与变更量成正比；三类容器的审计与校验纪律统一；
- **负/约束**：与 ADR 0033 同款——raw 污染检测面缩小、schema 演进受永久约束（决策 5）、E201 检出面收窄、charge 计数变化（未触达 entry 不再计入）；
- **验证**：vfsl 域规则/兼容/一致性 fixture 测试（Record + parent 两形态）；doc-runtime fast/legacy 双轨、零写入、S9 收窄、public-surface guard 测试；基准测试（如 10⁵ entry map 单键写耗时与 n 解耦）；根 `pnpm typecheck` 与 `pnpm test`。
