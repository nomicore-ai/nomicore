# MABF Task Brief

Repository: nomicore-ai/nomicore
Issue: #420
Title: SessionHost 公共工厂 + 内存管道完整协议回合（spec #415 T3）
State: open
Issue updated at: 2026-09-21T18:08:36Z

## Issue body

## Parent

PR #416（spec/415-replication-transport-decoupling）

## What to build

ADR 0032 决策 2/3 的 namespace 半边出面：导出 SessionHost 公共工厂——`open()` 输入含 connectionKey、remoteInstanceId、namespaceId、authorization 预授权投影（localOwner/read/submit，edge 授权结果的传递）、selectedCapabilities、可选 connectionId；会话句柄提供 `handleFrame`（fire-and-forget 入帧）/`onFrame`（出帧，sequence=0 占位）/`close`。authorize 不在 session 侧调用——shim 以闭包回放预授权投影，通道 OPEN 矩阵逐字复用。验收形态：内存管道对驱动完整协议回合，无 socket 无 worker。

## Acceptance criteria

- [ ] SessionHost 工厂从包公共入口导出，签名经 test-d 锁定（SA6 冻结纪律）
- [ ] 内存管道对驱动 OPEN→bootstrap→live update→reconcile→CLOSE 完整回合
- [ ] 现有 hub-namespace 测试矩阵在 shim 上重跑绿灯（通道零改动 + 状态机零 fork 的证据）
- [ ] 缝两侧只过 Uint8Array 与纯 JSON；包内零 worker_threads/MessageChannel/MessagePort 依赖或类型
- [ ] session 侧重检入站 sequence 的代码不存在（防御性断言或测试锚）

## Blocked by

- #418（T2 Edge/SessionHost 拆分重构）

## Comments
