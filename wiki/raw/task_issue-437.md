# MABF Task Brief

Repository: nomicore-ai/nomicore
Issue: #437
Title: lease 端到端：数组逐元素校验行为钉死（ADR 0033）
State: open
Issue updated at: 2026-09-22T06:53:17Z

## Issue body

## Parent

PR #434（spec/433-yarray-elementwise-validation）

## Task Type

feature

## What to build

经 lease `mutateData` 的端到端测试，钉死 ADR 0033 带来的用户可见行为变化与不变量。本 ticket 不改实现，只把新语义在最高 seam 上立法成回归测试，防止后续演进悄悄漂移。

## Acceptance criteria

- [ ] 行为变化钉正：对被 raw-replication 污染（元素载体/值非法）的数组做 array-delete 照常成功（旧语义为响亮拒绝）；触达面外的非法数据不被普通写发现
- [ ] 不变量钉死：非法新元素零写入 + issue 路径 `[...arrayPath, index+j]` 不变；越界拒绝语义不变；空批量 noop 不变
- [ ] union 数组目标的端到端行为与性能路径不变（仍走全量边界校验）
- [ ] 诊断烟测：数组写经 fast path 后，诊断日志的 committed update bytes 记录形态不变
- [ ] 复制烟测：fast path 提交经 replication apply 在对端收敛，无协议面变化
- [ ] 根 `pnpm typecheck` 与 `pnpm test` 绿

## Blocked by

- #436

## Comments
