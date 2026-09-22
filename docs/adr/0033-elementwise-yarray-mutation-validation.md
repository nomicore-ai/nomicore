# ADR 0033：YArray 数组操作的逐元素校验——触达面收窄至变更区间

日期：2026-09-22（设计敲定：与 Owner 讨论会话）
状态：已接受（tracking issue #433；影响包 `@nomicore/vfsl`、`@nomicore/doc-runtime`；复制协议、诊断捕获、`@nomicore/namespace-runtime` 写槽零改动）

## 背景

`array-insert` / `array-delete` 的写路径按「边界 = 整个数组」工作（issue #237 局部 mutation 管线，`planMutationBoundary` kind=`array`）：S5 整数组提取（walk）、S6 全量重建 + `validateSubtree` 整体验证、S9 边界重投影比对——单笔写付出 4 次全数组遍历（O(n)），而 Yjs 提交本就是 O(k) 最小 edit（`Y.Array.insert/delete` 区间操作）。往 10⁵ 元素数组 append 一个元素，成本与变更量完全脱钩。

phase-1 契约选择「拷贝式重建 + 整体验证」是用统一蛮力换正确性论证的简洁（「重建后的边界整体过子 schema」一句话证完）。但两个事实使这个取舍值得重开：

1. **VFSL v1 数组没有数组级约束**——校验器对数组只做逐元素分发（无长度/唯一性/有序性语义），组合性定理成立：旧数组合法（归纳不变式）∧ 新元素各自合法 ⇒ splice 后的数组合法。整体验证在当前语义下是冗余工作；
2. **使用方 schema 不可限定**——不能假设数组永远短小，日志/事件流型数组会无限增长。

范围限定：**仅 YArray 载体**（schema 声明 `T[]` 的数组操作）。plain 数组（YPlainArray）作为 plain 值整体替换，无 array-insert/delete 入口，不在本次范围。

## 决策

### 1. fast path 闸门与永久双轨

- 闸门：`planMutationBoundary` 产出 kind=`array` **且**边界值节点（`descendValues(derived.values, plan.prefix)` 经 ref 解析后）kind 为 `array`——即声明类型为 `T[]` 的数组目标；
- union 数组目标（`A[] | B[]`）：成员判别需要完整值，无法在不做边界提取的情况下确定元素 schema，**永久回退既有全量边界路径**。双轨是有意保留，不是待清理的债；
- 规划层（`planMutationBoundary`）完全不动——边界定夺、数组候选前置拒绝照旧，只动执行层。

### 2. fast path 管线（O(k)）

- **越界检查**读 live 载体 `Y.Array.length`（O(1)）；域规则与现行逐字一致：不 clamp、拒越界 no-op、批量一次判定、空批量经 hasContent 守卫为 noop；
- `array-insert`：逐新值过 element 子 schema（复用 `validateSubtree` 于 element 节点）+ `buildDetachedValue` 逐值构造，O(k)；**issue 路径 `[...arrayPath, index+j]`（插入后数组中的位置）与现状逐字节一致**——issue 路径/顺序是兼容行为，钉回归测试；
- `array-delete`：仅越界检查，O(1)——删除不可能使既有元素变非法（归纳不变式）；
- commit 形态（最小 edit）不变 ⇒ update bytes 形态不变 ⇒ 复制协议与诊断捕获窗口零改动；
- 零写入纪律不变：一切拒绝先于 live Y.Doc 写，fast path 不引入 write-then-undo。

### 3. S9 收窄

- 安装事实核**原样保留**（长度算术 + 插入项同一性，本就 O(k)）；
- 边界重投影核对 fast-path 提交**省略**（无 proposedBoundary 可比对）；legacy 路径双核不变；
- 后果：observer 同事务篡改区间外元素从「检出 E201」变为「静默通过」。可接受——该防线防包缺陷而非业务错误，且长度算术仍能抓住多数干扰形态。

### 4. 触达面重定义（修订 ADR-0010 issue #237 修订节的数组含义）

- 数组写的触达面从「整个数组」收窄为「**数组载体本身 + 变更区间**」（载体由 S4 导航 O(1) 验证）；未触达元素不再承担 trusted raw replication 非法数据的检测职责；
- 具体行为变化：**对污染数组的 delete 从响亮拒绝变为照常成功**。这是向既有哲学的对齐而非破坏——kind=target 的 set 早就是「合法 payload 写入即修复、触达面外不发现」（R6 / CONTEXT.md trusted-raw-replication 词条）；收窄后数组与 map 的审计纪律一致，消除不对称；
- 不补异步/抽样审计机制（需要时另行设计）。

### 5. 立法：数组约束逐元素可组合

「**VFSL 数组的合法性 ⟺ 逐元素合法**」成为规范性承诺：

- 禁止未来以校验器内部特判引入数组级约束（长度、唯一性、有序性等）；若 schema 演进确需数组级约束，必须先恢复整体验证路径或设计双轨，不得直接加；
- enforcement = 钉死测试 + 本文档：一致性 fixture 在参数化/随机用例下断言 fast path 与全量 `validateSubtree` 的接受/拒绝及 issue 逐字节一致——若有人引入数组级约束，该 fixture 红灯。

### 6. 性能验收（软）

复杂度从 O(n) 降为 O(k)，以基准测试为证据（如 10⁵ 元素 YArray 的单元素 insert/delete 耗时与 n 解耦），不钉绝对毫秒数。

## 不做什么

- plain 数组（YPlainArray）：无 array 操作入口，整体值替换语义不动；
- union 穿越的数组写（kind=`union`）：边界提取语义不动；
- 数组级约束语法：本阶段被立法禁止，而非被实现；
- raw-replication 污染的异步/抽样审计：不建；
- 历史/回滚的前像捕获：独立议题。仅记录一个事实——fast path 后 `array-delete` 的被删元素不再从整数组 walk 免费获得，未来前像方案需主动读区间（O(count)，仍 ≤ O(变更)）。

## 后果

- **正**：数组写 CPU/内存从 O(n) 降为 O(k)，与变更量成正比；数组与 map 的审计纪律对齐；管线对大数组可预期；
- **负/约束**：raw-replication 污染检测面缩小（未触达元素不再被普通写发现）；schema 演进受永久约束（决策 5）；E201 检测面收窄到变更区间（决策 3）；charge 计数变化（未触达元素不再计入校验 budget——内部机制，issue 输出不变）；
- **验证**：vfsl 域规则/兼容/一致性 fixture 测试；doc-runtime fast/legacy 双轨、零写入、S9 收窄后 E201 行为、public-surface guard 测试；基准测试；根 `pnpm typecheck` 与 `pnpm test`。
