# MABF Task Brief

Repository: welltop-jim-wang/nomicore
Issue: #389
Title: 复制来源与订阅终止（变更订阅 T3）
State: open
Issue updated at: 2026-09-14T22:10:38Z

## Issue body

## Parent

PR #386（adr-0030-change-subscription）

## What to build

在 T1（#387）之上补齐两类来源与订阅终止：复制 apply 的远端变更与本地写触发同一套通知（Peer 场景 UI/agent 不因变更来自远端而失明）；schema 变更与 doc 替换以 `watch-end` 终止订阅（流末条），杜绝"谓词语义失效后订阅静默死亡"。规范权威 = ADR 0030 决策 4 / 6。

## Acceptance criteria

- [ ] 复制 apply（经 lease `openReplicationSession` + `applyRemoteUpdate` 驱动，测试先例 = replication-session lease 面家族）触发 `data` 通知且 `origin:'replication'`；本地写恒 `origin:'local'`（self-echo 抑制的消费依据）
- [ ] schema 变更 → 该 namespace 全部存活订阅收到 `{kind:'watch-end', reason:'schema-changed'}`，覆盖两条路径：Hub 本地 `replaceSchema` 与 Peer 复制 apply 槽的 schema re-arm（ADR 0018）
- [ ] doc 替换（reset / bootstrap import / genesis 一族）→ `watch-end: 'doc-replaced'`
- [ ] `watch-end` 是**流末条**：其后订阅静默、已注销；此后 `unsubscribe` 幂等 no-op
- [ ] FIFO：`watch-end` 与滞留的 `data` 通知同流有序——不会先终止、后到僵尸 data 通知
- [ ] 终止后消费方重建订阅（重新 `watchMap`）行为正确——订阅生命周期只与 lease 和 schema 耦合
- [ ] 上述全部经 lease 公共面可观察（零新接缝）

## Blocked by

- #387（T1 tracer bullet）

## Comments
