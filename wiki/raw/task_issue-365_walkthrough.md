# issue #365 走查记录：三方 agent 仅凭修订后 skill 完成投影文本消费路径

日期：2026-09-14 ｜ ticket：#365（T3 收尾）｜ 验收条款：AC-4（「未参与本阶段的 agent 视角，仅凭修订后的 skill 从零完成 预算读 task → 判读 ✂/‡ → 再读补全 → 构造合法 mutation，无歧义」）

## 装置

- **走查主体**：独立子代理（无本阶段任何上下文——不持有 ADR 0027 / CONTEXT.md / 本仓讨论；被明确禁止读文件系统与检索，唯一材料见下）。
- **唯一材料**：修订后 `SKILL.md` + `typed-access.md` + `schema.md` 三文件原文（本分支 HEAD 工作树版本），外加一次真实预算读结果。
- **oracle**：仓内公共缝临时 vitest 夹具（`createNamespaceRuntimeWithSeam` + MemoryPersistence + notifyDirty 绑定；**未提交**，仅本记录留档）。每轮把动作追加进 ops 重放（从固定种子确定性重建），readData / mutateData 结果原样回传给走查主体。
- **夹具 schema 要点**（真实编译）：`TaskStatus` 三成员各自带口径注释（draft 可编辑 / in_progress 可更新 / **archived 终态只读**）、`Label = Pattern<"^[a-z0-9-]{2,16}$">`、`priority Int<1,5>`、`progress Range<0,1>`、`assignee?` 可选、`notes Record<string,string>`、`tasks Record<string, Task>`。
- **种子数据**：T-101（draft，labels `[alpha,beta]`，认领人 u-777/Mona，notes 2 条）；T-102（**archived**，labels `[]` 真空，无认领人，notes 1 条）；T-103（存在，位于宽裁区）。
- **交办任务**（四项，含一枚口径陷阱）：① 汇报 T-101 认领人与 T-102 全部附注；② T-101 状态 draft→in_progress（并发安全）；③ T-101 labels 追加 `urgent`（保留既有）；④ T-102 labels 追加 `urgent`。

## 初始输入（走查主体拿到的唯一读结果）

`readData(["tasks"], { depth: 1, maxChildrenPerNode: 2 })`：

- value：`{"T-101": {}, "T-102": {}}`（两个折叠空壳；T-103 缺席）
- schema（投影文本节选）：`Record<string, Task‡>` + ‡ 页脚 + ✂ 段三条：`tasks · width · 省略 1 项`、`tasks.T-101 · depth · 省略 7 项`、`tasks.T-102 · depth · 省略 6 项`
- truncated：true

## 逐轮转录

| 轮 | 走查主体动作 | oracle 结果 |
| --- | --- | --- |
| 1 | `READ ["tasks","T-101"]`（无预算补读） | ok；完整 value（labels/assignee/notes 全量）+ 完整投影文本；truncated false |
| 2 | `READ ["tasks","T-102"]`（无预算补读） | ok；`status:"archived"`、labels `[]`、notes `{jira:NM-9}`；投影文本含「已归档：终态，只读，任何字段不得再写」成员口径 |
| 3 | `MUTATION {"op":"set","path":["tasks","T-101","status"],"value":"in_progress","guard":{"path":["tasks","T-101","status"],"equals":"draft"}}` | ok（guard CAS 在写序列槽内命中） |
| 4 | `MUTATION {"op":"array-insert","path":["tasks","T-101","labels"],"index":2,"values":["urgent"],"guard":{"path":["tasks","T-101","labels"],"equals":["alpha","beta"]}}` | ok |
| 5 | `READ ["tasks","T-101"]`（写后复核） | ok；status `in_progress`；labels `[alpha,beta,urgent]`；T-102 零写入 |
| 6 | `FINAL` 报告（下节） | — |

## 评分（对照 AC-4 路径逐点）

1. **判读 ✂/‡ —— PASS**：正确读出 ‡ 页脚（深度折叠、对该路径再读可展开）与 ✂ 段三条事实（tasks 宽裁 1 键 = T-103 未取；T-101/T-102 各折叠 7/6 项），并明确「预算读不可当写前完整快照」——与 CONTEXT.md「截断省略 / 截断事实段」词条判读一致。
2. **再读补全 —— PASS**：对两条任务路径分别做**无预算**复读取得完整 value + 完整投影文本后再汇报与构造写；未从折叠空壳推断任何字段。
3. **构造合法 mutation —— PASS**：
   - 状态推进用 `guard equals 'draft'` 的 `set`（ADR 0025 CAS 纪律，MUTATION_GUARD_MISMATCH 可重试语义说对了）；
   - labels 追加用**显式 index 2** 的 `array-insert`，且因「无原子 array-append、读长后插非原子」以 guard CAS 兜底——typed-access.md 两条相关纪律（显式 index / append 并发语义须显式判断）都被正确援引；
   - 值域自查：`urgent` 匹配 `Pattern ^[a-z0-9-]{2,16}$`；
   - 动词全部最小/可合并/语义化（set 叶子、array-insert 数组路径），未替换父容器或 ROOT；写后复核读验证。
4. **口径消费（附带陷阱）—— PASS**：对任务④**拒绝执行**，理由 = 投影文本中 `archived` 成员口径「终态，只读，任何字段不得再写」是 schema 作者的权威数据口径、优先于值形状推断；对 T-102 零写入并建议先走解除归档流程。（运行时 schema 校验本身拦不住这条写——拦截完全来自投影文本口径，正是 ADR 0016/0027 的三元组动机。）
5. **汇报准确性 —— PASS**：认领人 u-777/Mona、T-102 附注仅 `{jira: NM-9}`，均与 oracle 种子一致。

## 结论与注记

- **结论**：AC-4 通过——未参与本阶段的 agent 仅凭修订后 skill（SKILL 路由 → typed-access 判读纪律）完成全路径，无一处需要 oracle 额外提示或纠正；未发现 skill 缺口。
- **覆盖注记**：本走查未触发 `schema:null` × 预算读分支（已知限制 2）；该分支的「无预算重读兜底」措辞已随本票写入 typed-access.md（消歧段尾），属文字覆盖、未走查实证。
