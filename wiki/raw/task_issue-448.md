# MABF Task Brief

Repository: nomicore-ai/nomicore
Issue: #448
Title: Ticket(ws-replication): γ-T2 live update 数据面——pending 窗口记账、ACK 结算与保序契约锚
State: open
Issue updated at: 2026-09-22T07:52:47Z

## Issue body

## Parent

PR #446（spec/445-gamma-async-seam）

## What to build

live update 数据面在 γ 异步缝上的完整链路：data 帧 pending→回执登记两相记账；pending 计入 `maxInFlightUpdates` 窗口（回执 tag→seq 换键不换槽，窗口占用自推送时刻起算）；UPDATE_ACK 结算在回执登记后与单体内核同构（`onAck` 的 ok/zombie/violation 判别零改动）；session 自驱 drain 落地（触发点 = 入队 / ACK 到达；推完即停、禁 busy loop）；保序契约的可执行锚（回执恒先于引用该序的 live UPDATE_ACK）；`update-acked` 在 session 回执/结算点发射，`ackLatencyMs` 的 t0 = 推送时刻（协议 §24.8 口径）。

## Acceptance criteria

- [ ] data 面 pending/receipt 全链，在途记账精确（无伪造序号、无 pending 泄漏）
- [ ] pending 计入 `maxInFlightUpdates` 窗口；乐观发送不击穿窗口上界（延迟注入锚）
- [ ] 保序契约锚：延迟注入编排下回执恒先于对应 UPDATE_ACK；`onAck` 三类判别语义与单体同构
- [ ] session 自驱 drain 两触发点（入队 / ACK）；无 busy loop（不新增轮询定时器）
- [ ] `update-acked` 发射点与 `ackLatencyMs` t0 口径锚（= 协议 §24.8）
- [ ] live update 成功路径与 β wire 逐字节等价

## Blocked by

- Blocked by #447

## Comments
