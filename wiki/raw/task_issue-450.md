# MABF Task Brief

Repository: nomicore-ai/nomicore
Issue: #450
Title: Ticket(ws-replication): γ-T4 流控与生命周期收口——1011、close 冲刷 pending、revoke/settled 跨缝
State: open
Issue updated at: 2026-09-22T09:55:50Z

## Issue body

## Parent

PR #446（spec/445-gamma-async-seam）

## What to build

γ 的流控与生命周期收口语义（ADR 0032 A4.3/A4.5、协议 §24.5/§24.7）：连接账本投影越界 → `CONNECTION_BACKPRESSURE`(1011) 收口整条 γ 连接——无逐帧拒纳、无 deferred、无 ns 级 send-failed resync（与 β 的显式行为差）；edge 决定收口后 session→edge 方向后到的一切静默丢弃；close 信号整体冲刷 pending（含在管帧，按未发送清算）；`terminateUnauthorized` 不溯及已推帧；`settled` 晚到的 drain 行为（`closeTimeoutMs` 逃生舱不动）；OPEN 水位（≤16 帧/连接、≤4 并发 OPEN）在注入跨线程延迟下的故障参数复核——原值不误收口、打穿响亮收口。

## Acceptance criteria

- [ ] 账本溢出 → 1011 收口锚（慢对端 + 大突发编排）；逐帧拒纳 / ns 级 send-failed resync 路径在 γ 不可达
- [ ] 单帧超连接级上限 → 响亮收口 + 诊断（配置错误定性）
- [ ] close 后 session→edge 方向丢弃规则锚；close 冲刷 pending（含在管帧）无泄漏
- [ ] `terminateUnauthorized` 不溯及已推帧锚（信号到达前已推帧正常盖章）
- [ ] `settled` 晚到 drain 锚；`closeTimeoutMs` 行为不变
- [ ] OPEN 水位延迟复核：原值不误收口；打穿 = 响亮收口（故障参数定性，非流控调参）
- [ ] 内存安全链锚：session 队列 → 管道 → edge 账本逐跳有界；慢连接最坏账 = 预算上限后连接死亡释放

## Blocked by

- Blocked by #448

## Comments
