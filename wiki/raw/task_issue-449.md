# MABF Task Brief

Repository: nomicore-ai/nomicore
Issue: #449
Title: Ticket(ws-replication): γ-T3 reconcile 与分块 transfer 跨缝（ownStep2Seq 三态、chunked kind 0/1/2）
State: open
Issue updated at: 2026-09-22T08:56:19Z

## Issue body

## Parent

PR #446（spec/445-gamma-async-seam）

## What to build

reconcile 与分块 transfer 穿过 γ 异步缝：`ownStep2Seq` 扩为三态（未发 / pending / 已盖章），sync round（SYNC_STEP1 / SYNC_STEP2 / SYNC_APPLIED）全回合；SYNC_APPLIED 保序锚（锚回填恒先于合法 SYNC_APPLIED 到达，round-engine 因果不变量的依据 = 缝保序契约）；chunked kind 0/1/2 全回合——逐 chunk 乐观推送、末 chunk 回执结算入 inFlight（transfer 槽位 1→1 转换）、连接死亡时 transfer 整体 abort（无洞中 transfer 形态）；session 自驱 drain 的第三触发点（transfer 末 chunk 回执）落地。

## Acceptance criteria

- [ ] `ownStep2Seq` 三态；sync round 全回合与 β wire 逐字节等价
- [ ] SYNC_APPLIED / BOOTSTRAP_ACK 保序锚（延迟注入编排：锚回填恒先于引用帧序的回答帧）
- [ ] chunked kind 0 全回合：中间 chunk 零 inFlight / 零事件，末 chunk 回执结算（`chunked-update-sent`/`chunked-update-acked` 语义不变）
- [ ] chunked kind 1/2（bootstrap / sync diff）全回合
- [ ] 连接死亡 → transfer 整体 abort；无洞中 transfer 形态锚（连接存活 ⟹ 逐 chunk 已盖章）
- [ ] drain 第三触发点（末 chunk 回执）落地

## Blocked by

- Blocked by #448

## Comments
