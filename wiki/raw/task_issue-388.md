# MABF Task Brief

Repository: welltop-jim-wang/nomicore
Issue: #388
Title: 谓词订阅与宁多勿漏判定（变更订阅 T2）
State: open
Issue updated at: 2026-09-14T17:19:06Z

## Issue body

## Parent

PR #386（adr-0030-change-subscription）

## What to build

在 T1（#387）的无谓词通路上叠加谓词订阅与完整判定纪律：`watchMap(path, { where })` 只收到匹配条目的变更信号，且信号遵守宁多勿漏不变量——漏一条等于消费方永久持有过时数据（不可接受），多一条只是多拉一次（可接受）。规范权威 = ADR 0030 决策 2 / 5。

## Acceptance criteria

- [ ] 谓词词表：`{ field, equals }` / `{ field, in }`，值域恒标量（string / number / boolean / 字面量）；`in` 集合语义（顺序无关、去重）
- [ ] 建立时按 active schema 裁决：field 不存在 / 非标量域 / `in` 空数组 → `WATCH_MAP_OPTIONS_INVALID`（建立后通知流零参数错误）
- [ ] 缺失 / null 恒不匹配，所有算子一视同仁（NULL 三值逻辑不存在）
- [ ] 同值写不通知：载体 delta 存在（Yjs 同值 set 仍产生 update delta）但条目投影值未变 → 语义比较过滤
- [ ] 匹配条目变更 → 通知；不匹配条目变更 → 不通知（降噪是谓词的存在理由）
- [ ] **退出匹配集也通知**：旧值匹配、新值不匹配（如 task 状态离开 `in:['open']` 列表）→ 收到信号，消费方拉终态自辨删除视图项——订阅者视图不残留过时条目
- [ ] 嵌套 Y.Map 部分更新（容器浅 delta 无条目级 oldValue）→ 保守通知（宁多勿漏）；plain object 条目整值替换（oldValue 恒在场）→ 恒精确判定
- [ ] 判定矩阵契约测试锚定上述全部行为（先例 = 窗口读 lease 契约家族；场景矩阵基于 ADR 0030 记录的 Yjs 事实）

## Blocked by

- #387（T1 tracer bullet）

## Comments
