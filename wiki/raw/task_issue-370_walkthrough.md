# issue #370 走查记录：三方 agent 仅凭修订后 skill 完成窗口读消费路径

日期：2026-09-14 ｜ ticket：#370（W3 收尾）｜ 验收条款：AC-4（「以未参与本阶段的 agent 视角，仅凭修订后的 skill 完成 选 API → 窗口读 → ✂/身份判读 → 回拼深读 → 构造 mutation 路径无歧义」）

## 装置

- **走查主体**：独立子代理（无本阶段任何上下文——不持有 ADR 0028 / CONTEXT.md / W1-W2 设计与讨论；被明确限制唯一材料为下列三文件，禁止读仓库其余文件与检索）。
- **唯一材料**：修订后 `SKILL.md` + `typed-access.md` + `schema.md` 三文件原文（本分支工作树版本）；外加 host 接入方常识（schema 文本 + ROOT 两容器路径），不给任何种子值。
- **oracle**：仓内未提交临时 vitest 夹具（`createNamespaceRegistryForTesting` + StubPersistence 同一 doc 引用 + 手动时钟/确定性随机源；走查后已删除，本记录留档）。从 `/tmp/issue-370/actions.json` 读动作序列，固定种子确定性重建后依序重放，lease 公共面结果（含失败码）原样写入 results.json 回传走查主体。
- **走查 schema 要点**（真实编译）：`TaskStatus` 三成员各自带口径（draft 任意可编 / in_progress 可追加工时 / **archived 终态只读**）、`WorkRecord`（`doneAt Int<0,2147483647>` 完成时间口径「越大越新」、`hours Range<0,1000>`、`note?` 可缺省）、`priority Int<1,5>`「越大越优先」、`tasks Record<string, Task>`、`log YLeaf<string>[]`（append-only）。
- **种子数据**（走查主体事先不可见）：
  - `log = ['boot','sync','archive','review']`（下标 0–3）；
  - `tasks` 五键：T-101（draft，prio 2，2 条工时）；T-102（**archived**，prio **5**，1 条工时——Top-1 口径陷阱）；T-103（in_progress，prio 4，**0 条工时**）；T-104（in_progress，prio 4——与 T-103 平局，1 条工时）；T-990（in_progress，**priority 键缺席**——脏项，排序不可比组）。
- **交办任务**（六项，含两探针 + 一口径陷阱）：
  1. 汇报优先级最高的两个任务的标题与状态；
  2. 汇报 `log` 中按值序最大的两条日志；
  3. 给交办 1 中优先级最高、且按其口径仍可写的任务追加一条工时记录（`doneAt=4000`、`hours=1.25`、`note='w3'`；不可写者明确说明并跳过）；
  4. 探针：对 `tasks` 用 `readArray` 取 `n:1`，报告结果与处置；
  5. 探针：窗口读探测 `tasks` 下键 `'T-777'`，报告结果与处置；
  6. 复核交办 3 的写入结果。

## 逐轮转录（4 轮 / 7 动作）

| 轮 | 走查主体动作 | oracle 结果 |
| --- | --- | --- |
| 1 | `READ-MAP ["tasks"] {n:2, orderBy:{field:'priority',dir:'desc'}, depth:1}`；`READ-ARRAY ["log"] {n:2, orderBy:{by:'index',dir:'desc'}}` | 双 ok：条目 T-102(prio 5)、T-103（平局 4 组内 key asc 首位）；✂ `tasks · 窗口 · 基 field:priority desc · kept 2/total 5`、`log · 窗口 · 基 index desc · kept 2/total 4`；T-990 脏项未入窗；log 得 `sync`(1)、`review`(3)（字符串码点值序 desc） |
| 2 | `READ-DATA ["tasks","T-103","workRecords"]`（无预算全量深读——判第一轮 `[]` 为 `‡` 折叠壳非真空）；`READ-ARRAY ["tasks"] {n:1}`（探针 4）；`READ-MAP ["tasks","T-777"] {n:1, orderBy:{by:'key'}}`（探针 5） | 深读 ok：`value:[]`、`truncated:false`、无 ✂（真真空）；探针 4 → `WINDOW_CARRIER_MISMATCH`；探针 5 → `WINDOW_TARGET_ABSENT` |
| 3 | `MUTATE array-insert ["tasks","T-103","workRecords"] index:0 values:[{doneAt:4000,hours:1.25,note:'w3'}] guard{equals:[]}`；`READ-DATA ["tasks","T-103","workRecords"]`（复核） | 写 ok（guard CAS 命中）；复核 ok：恰一条新记录，`truncated:false` |
| 4 | `FINAL` 报告（下节） | — |

## 评分（对照 AC-4 路径逐点）

1. **选 API —— PASS**：Top-K 优先级选 `readMap` 单段 `field` 基（援引「Window reads」第三典型路径，与交办逐字同构）；标量字符串数组值序最大 K 选 `readArray` `by:'index'` desc（援引「array face orders by the item's own value」+ 排序 total）；未把 width 预算当选窗手段。
2. **窗口读 + ✂/身份判读 —— PASS**：正确读出两条 ✂ 窗口事实行（`基 field:priority desc · kept 2/total 5` / `基 index desc · kept 2/total 4`）并解释 total=候选数、未入窗 3+2 项被基排序淘汰、不读取不推断；正确识别 T-103/T-104 平局由 key asc 锚定、T-990 脏项归不可比组不挤掉正常项（种子值事先不可见，结论与种子一致）。
3. **回拼深读 —— PASS**：身份回拼 `['tasks','T-103','workRecords']` 深读；**关键纪律点**：第一轮 depth:1 呈现的 `workRecords: []` 带 `‡` 被判为折叠壳、不可当写基准，先无预算全量复读确认真真空（`truncated:false`、无 ✂ 条目）后才取长度 0 为 insert 基准——「✂ 段为截断事实唯一载体 / never inherit from a truncated value」两条纪律被正确援引。
4. **构造 mutation —— PASS**：`array-insert` 显式 index 0 + `guard equals []` CAS（读长后插并发语义显式判断）；值域对照投影文本自查（`Int` / `Range` / `note` 可缺省）；动词最小/可合并/语义化，未替换父容器。
5. **口径陷阱 —— PASS**：交办 3 对 T-102（Top-1，archived）**明确跳过并说明**——以 TaskStatus 成员口径「终态，只读，任何字段不得再写」为权威，不从值形状猜；对 T-103 以「in_progress 可追加工时记录」放行。
6. **失败码处置 —— PASS**：`WINDOW_CARRIER_MISMATCH` → 切换另一 API、身份字段 index↔key 随之变化；`WINDOW_TARGET_ABSENT` → 刻意停止、不重试同一调用、不期待 readData 式缺席吸收——两处置与「Failure dispositions」一码一处置逐条一致。

## 结论与注记

- **结论**：AC-4 通过——未参与本阶段的 agent 仅凭修订后 skill（SKILL 路由 → typed-access 窗口读纪律）完成「选 API → 窗口读 → ✂/身份判读 → 回拼深读 → 构造 mutation」全路径，4 轮零纠正、零歧义追问。
- **走查主体两点如实观察的处置**：
  1. *「readMap 作用于 closed YMap 是否合法 keyed carrier 材料未明说」*——属实（本次走查被缺席判定先于载体判定掩盖）。已随本票在「Element-scope projection text」段补一句：载体检查是 schema 盲的，任何键容器（Record 形或封闭 `YMap<{…}>`）都是合法 readMap 目标，Record/封闭之分只影响 schema 锚（动态 `'<key>'` 槽 vs 容器路径回退）——与 W2 契约（fixture `meta` 封闭对象形）一致。
  2. *「typed-access.md L129 尾部疑似截断」*——经核实为走查主体自身读取管道截断，文件本体完整（该行以「`maxChildrenPerNode` does not affect the projection body.」完整收尾），非文档缺陷。
- **覆盖注记**：本走查未触发 `WINDOW_OPTIONS_INVALID`（三码中仅两码被实测）；该码的处置（修参数——调用方 bug）已随本票写入「Failure dispositions」，属文字覆盖、未走查实证。`schema: null` × 窗口读分支同样未触发（无 active schema / 路径偏离 schema），其判读纪律（null 非读失败）与 readData 同款、已有 ADR 0027 T3 走查覆盖。
