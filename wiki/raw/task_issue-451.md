# MABF Task Brief

Repository: nomicore-ai/nomicore
Issue: #451
Title: Ticket(ws-replication): γ-T5 观测面锚定与全量回归收官
State: open
Issue updated at: 2026-09-22T12:33:27Z

## Issue body

## Parent

PR #446（spec/445-gamma-async-seam）

## What to build

观测面锚定与阶段收官：`update-sent` 发射点留 edge 盖章点、其余 namespace 域事件在 session 侧的发射归属锚（协议 §24.8；跨线程事件无全序——测试不依赖 edge/session 事件的相对顺序）；新公共面 test-d append-only 复核；listen 模式与 β 公共工厂测试矩阵全绿；包 typecheck + 根 `pnpm typecheck` / `pnpm test` 全绿；集成分支（PR #446）实现与 ADR 0032 附录 A4 / 协议 §24 的同支一致性核对，收官转人工合并（不自动合 main）。

## Acceptance criteria

- [ ] `update-sent` 留 edge 盖章点锚；`update-acked` / chunked 族在 session 侧锚；γ 测试断言不依赖跨线程事件相对顺序
- [ ] 新公共面 test-d append-only 复核
- [ ] listen 与 β 矩阵（issue418/420/421/423/424 全套）+ route-key / wire parity guard 全绿
- [ ] 包 typecheck + 根 `pnpm typecheck` / `pnpm test` 全绿
- [ ] PR #446 实现与 ADR A4 / §24 一致性核对完成，阶段收官转人工合并

## Blocked by

- Blocked by #449
- Blocked by #450

## Comments
