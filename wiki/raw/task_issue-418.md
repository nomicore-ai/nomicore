# MABF Task Brief

Repository: nomicore-ai/nomicore
Issue: #418
Title: 〔wide refactor〕HubConnectionImpl 拆分 Edge/SessionHost + 单体进程内组合（spec #415 T2）
State: open
Issue updated at: 2026-09-21T14:20:32Z

## Issue body

## Parent

PR #416（spec/415-replication-transport-decoupling）

## What to build

ADR 0032 决策 1 的地基重构：沿既有 `HubChannelHost` 内缝把 hub 侧连接实现劈为连接级半边（Edge：envelope/sequence 纪律、HELLO 与 capability 协商、liveness、GOAWAY/reauth、连接级背压）与 namespace 级半边（SessionHost：通道全部状态机、Registry open、session 驱动、出站合并），单体 listen 模式改为两者的进程内组合（缝 = 函数调用）。本票**零新公共 API、零配置变化、wire 逐字节不变**——协议状态机从此单份实现，后续票在其上导出面。入站 sequence 由 edge 半边校验；出站帧 session 半边以 sequence=0 占位编码、edge 半边定偏移盖章后发出。

## Acceptance criteria

- [ ] 连接级与 namespace 级状态机成为两个可独立实例化的内部模块，单体 = 进程内组合
- [ ] 出站 sequence 单点分配在 edge 半边（盖章语义），入站 expectedSeq 校验在 edge 半边
- [ ] 通道实现零改动（authorize 仍经注入的 host 接口调用）
- [ ] 既有全量测试逐字节绿灯：golden vectors、real-transport 动态、fault 注入矩阵、observer 契约锚、auth/HELLO/backpressure/liveness/close/GOAWAY/epoch 全部状态机路径
- [ ] 包 typecheck + 根 pnpm typecheck 与 pnpm test 绿灯

## Blocked by

None (can start immediately).

## Comments
