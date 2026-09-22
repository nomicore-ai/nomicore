# MABF Task Brief

Repository: nomicore-ai/nomicore
Issue: #441
Title: doc-runtime：Record/parent fast path 接线与 S9 收窄（ADR 0034）
State: open
Issue updated at: 2026-09-22T09:58:51Z

## Issue body

## Parent

PR #438（spec/adr-0034-record-elementwise-validation）

## Task Type

feature

## What to build

把 mutation 管线的 record/parent 分支改造成按闸门分流的双轨：map 位声明类型为非 union Record 形态（或封闭对象 delete）时走 fast path——跳过整 map/父值提取与全量重建，导航验载体后直接校验目标键位并做单键 commit；map 位为 union 类型时回退 legacy 全量路径（永久双轨）。Record 值位为 union 不影响 fast path（entry 整值替换，不读旧值判别）。

S9 提交后验证对 fast-path 提交收窄：保留安装事实核（`get`/`has` 同一性，本就 O(1)），省略边界重投影核（复用 ADR 0033 阶段建立的收窄验证输入变体）；legacy 路径双核不变。零写入纪律与 E201 语义保持。

## Acceptance criteria

- [ ] 闸门正确：非 union Record 位与封闭对象 delete 走 fast path；union map 位回退 legacy；Record 值位为 union 仍走 fast path
- [ ] fast path 下 Record set/delete 与封闭对象 delete 不再提取/重建整个 map（基准证据：如 10⁵ entry map 单键写耗时与 n 解耦）
- [ ] commit 的 update 事件形态不变（复制与诊断捕获零回归）
- [ ] 零写入：fast path 一切失败分支零写入、零 update 事件
- [ ] S9：fast-path 提交仅安装事实核；legacy 重投影核不变；E201 变体语义保持
- [ ] 包测试 + 根 `pnpm typecheck` 与 `pnpm test` 绿

## Blocked by

- #440

## Comments
