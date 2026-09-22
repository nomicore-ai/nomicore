# MABF Task Brief

Repository: nomicore-ai/nomicore
Issue: #435
Title: vfsl：数组逐元素校验 seam + 一致性 fixture（ADR 0033）
State: open
Issue updated at: 2026-09-22T03:42:11Z

## Issue body

## Parent

PR #434（spec/433-yarray-elementwise-validation）

## Task Type

feature

## What to build

让 vfsl 的边界 mutation 判定支持数组逐元素校验：对 `array-insert` 逐新值过 element 子 schema、对 `array-delete` 只做域规则判定（越界/no-op），不再要求调用方提供整数组的边界提取值。域规则与现行逐字一致：不 clamp、拒绝越界 no-op、批量 values[]/count 一次判定；非法新元素的 issue 路径指向其在插入后数组中的位置（`[...arrayPath, index+j]`），与现行全量路径的输出逐字节兼容。

本 ticket 同时交付「逐元素可组合」立法的兜底 fixture（ADR 0033 决策 5）：参数化/随机用例下，逐元素判定与全量整体验证的接受/拒绝结论及 issue 内容完全一致——未来若有人引入数组级约束（长度/唯一性/有序性），该 fixture 红灯。

## Acceptance criteria

- [ ] array-insert：逐新值按 element 子 schema 校验，非法值在任一位置被拒绝且 issue 路径为 `[...arrayPath, index+j]`，与全量路径输出逐字节一致
- [ ] array-delete：仅做域规则判定（下标越界、范围越界、越界 no-op 拒绝），不触碰元素值
- [ ] 域规则逐字对齐：不 clamp、批量一次判定、中间态不参与
- [ ] 一致性 fixture：随机/参数化用例下逐元素判定 vs 全量整体验证结果逐字节一致
- [ ] 公开面只经包公共入口导出，public-surface guard 测试覆盖新导出
- [ ] 包测试 + 根 `pnpm typecheck` 与 `pnpm test` 绿

## Blocked by

None (can start immediately)

## Comments
