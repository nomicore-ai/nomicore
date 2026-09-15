# MABF Task Brief

Repository: welltop-jim-wang/nomicore
Issue: #390
Title: 溢出降级与父路径删除（变更订阅 T4）
State: open
Issue updated at: 2026-09-14T22:10:40Z

## Issue body

## Parent

PR #386（adr-0030-change-subscription）

## What to build

在 T1（#387）之上补齐通知面的背压与结构性失效：有界队列溢出时显式降级为全失效信号（消费面是读，全量重拉即自愈——无需 ReplicationSession 的 needs-resync 重协商）；父路径删除发全失效而订阅存活横跨缺席期。规范权威 = ADR 0030 决策 4 / 6。

## Acceptance criteria

- [ ] 每订阅通知队列为**有界**：上限是构造参数 + 实现默认值，**数值不进公共契约**（语义进：有界、溢出行为）
- [ ] 溢出 → 订阅收到 `{kind:'invalidate-all', origin}`，且**订阅存活**——溢出后新变更恢复正常通知（消费方全量重拉一次即自愈）
- [ ] 订阅容器 path 的父级删除（容器被删）→ `invalidate-all`、订阅存活
- [ ] **订阅横跨缺席期**：容器删除后重建，重建后条目变更照常以 `data` 通知到达——数据在场性从不终结订阅（ADR 0030：读对缺席报错、订阅宽容等待）
- [ ] 溢出路径可测：经既有 testing 工厂 overrides 注入小队列上限触发（零新接缝）
- [ ] 溢出不阻塞写路径：降级信号的分发同样在写序列器槽之外

## Blocked by

- #387（T1 tracer bullet）

## Comments
