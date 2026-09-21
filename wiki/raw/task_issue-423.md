# MABF Task Brief

Repository: nomicore-ai/nomicore
Issue: #423
Title: observer 发射点拆分与降级口径（spec #415 T6）
State: open
Issue updated at: 2026-09-21T20:10:37Z

## Issue body

## Parent

PR #416（spec/415-replication-transport-decoupling）

## What to build

ADR 0032 决策 5 的观测面：分片形态下 observer 事件按「拥有事实的一侧」拆分发射——edge 发连接域事件（connection-state-changed/auth-upgrade-rejected/connection-failed/send-paused/send-resumed）、依赖盖章后 sequence 的出站事件（update-sent 族）、授权拒绝事件（edge 复现拒绝路径时的 namespace-error{sent}/namespace-failed{open-failed}）；session 发 namespace 域事件（channel-state-changed/bootstrap/sync/update-applied/update-acked/resync/namespace-failed 等，update-acked{sequence} 关联入站 sequence、留在 session）。事件字段集 append-only 不变。缺面 dormant 纪律平移：session 侧 transport shim 无 bufferedAmount/ping/onPong 时对应字段按既有「缺面 = 字段缺失」语义缺席。`maxConcurrentAssembliesPerConnection` 在分片形态降级为 per-session 计数（聚合上界 = limits 值 × worker 数）并文档化。

## Acceptance criteria

- [ ] 每型事件的发射侧（edge/session）有测试锚定；字段集与既有 §23 注册表逐字一致
- [ ] 缺面降级：shim 无 bufferedAmount/onPong 时对应字段缺失（非 0/非 undefined 值），有 conformance 断言
- [ ] 授权拒绝路径的 namespace-error/namespace-failed 由 edge 发射且字段正确（connectionId 在场纪律不变）
- [ ] observer throw 隔离纪律在两侧均成立（dispatchReplicationObserver 单点语义不变）
- [ ] maxConcurrentAssembliesPerConnection 分片口径变化写入协议/ADR 文档对应章节；listen 模式计数口径不变（回归测试锚）
- [ ] 单体进程内组合形态的事件序列与拆分前逐字一致（无重复、无缺失、无乱序断言）

## Blocked by

- #421（T4 Edge 公共工厂）

## Comments
