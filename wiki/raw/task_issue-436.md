# MABF Task Brief

Repository: nomicore-ai/nomicore
Issue: #436
Title: doc-runtime：数组 fast path 接线与 S9 收窄（ADR 0033）
State: open
Issue updated at: 2026-09-22T05:03:14Z

## Issue body

## Parent

PR #434（spec/433-yarray-elementwise-validation）

## Task Type

feature

## What to build

把 mutation 管线的数组分支改造成按闸门分流的双轨：当边界规划为数组位且数组目标的声明类型是非 union 的 `T[]` 时走 fast path——跳过整数组提取与全量重建，越界检查读 live 数组长度（O(1)），逐新值完成校验与 detached 构造（O(k)），提交形态（Y.Array 区间最小 edit）不变；union 数组目标（`A[] | B[]`）回退既有全量边界路径（永久双轨，非临时债）。

S9 提交后验证对 fast-path 提交收窄：保留安装事实核原样（长度算术 + 插入项同一性），省略边界重投影核（新增收窄的验证输入变体）；legacy 路径双核不变。零写入纪律不变：一切拒绝先于 live 写；E201 语义保持（收窄后 observer 干扰的检出面限于变更区间，属已确认取舍）。

## Acceptance criteria

- [ ] 闸门正确：非 union `T[]` 目标走 fast path，union 数组目标回退 legacy，两轨行为各自正确
- [ ] fast path 下 array-insert/delete 不再提取/重建整个数组（以基准或等价证据证明 O(n)→O(k)，如 10⁵ 元素数组单元素操作耗时与 n 解耦）
- [ ] 越界检查基于 live 长度，域规则行为与 legacy 路径一致（不 clamp、拒越界 no-op）
- [ ] commit 的 update 事件形态不变（复制与诊断捕获零回归）
- [ ] 零写入：fast path 的一切失败分支零写入、零 update 事件
- [ ] S9：fast-path 提交仅安装事实核；legacy 路径重投影核不变；E201 变体语义保持
- [ ] 包测试 + 根 `pnpm typecheck` 与 `pnpm test` 绿

## Blocked by

- #435

## Comments
