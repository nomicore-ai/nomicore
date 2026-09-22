# MABF Task Brief

Repository: nomicore-ai/nomicore
Issue: #447
Title: Ticket(ws-replication): γ-T1 公共会话工厂 + 延迟注入异步管道夹具 + 首个跨缝协议回合（OPEN→bootstrap→close）
State: open
Issue updated at: 2026-09-22T05:39:44Z

## Issue body

## Parent

PR #446（spec/445-gamma-async-seam）

## What to build

γ 异步缝的第一个可验证纵切。交付新的公共 γ 会话工厂/句柄类型（`src/index.ts` 导出 append-only；β `createHubSessionHost` 冻结面逐字不动）：出站帧携 tag fire-and-forget 过缝，入站以 `handleReceipt(tag, sequence)` 消费序回执；session 侧第三种 port 形态与 pending 两相记账（控制面先行）；`bootstrapSnapshotSeq` 扩为三态（未发 / pending / 已盖章）。同时交付测试基础设施：每 (连接, namespace) 一对专用 FIFO 通道、延迟可注入的显式异步内存管道夹具（零 worker_threads；夹具只做字节/JSON 中继与信号搬运、零协议决策，沿用 issue420/424 夹具纪律）与宿主桥样例（test-only：ingress 侧同步调 edge egress 取盖章序、异步投回执到 worker）。最终行为：宿主可驱动 OPEN→bootstrap→close 完整协议回合穿过显式异步边界，wire 与 β 形态逐字节等价。

设计契约：ADR 0032 附录 A4、协议 §24；spec #445。

## Acceptance criteria

- [ ] 新 γ 公共工厂/句柄面导出（append-only）；β 冻结签名与行为逐字不动（既有 issue420 矩阵全绿）
- [ ] 缝消息词汇落地：`frame{tag,bytes,lane}` / `receipt{tag,sequence}` / `frame` / `close` / `terminateUnauthorized` / `settled` / `connection-fatal`——无拒纳/闸门/信用词汇
- [ ] session 控制面 pending 两相记账；`bootstrapSnapshotSeq` 三态；BOOTSTRAP_ACK 到达时锚已回填（保序条款结构性保证，非 park 机制）
- [ ] 延迟可注入异步 FIFO 管道夹具（每会话一对通道；FIFO/不丢/不重；零 worker_threads）
- [ ] OPEN→bootstrap→close 回合与 β wire 逐字节等价（复用 issue424 cross-seam 断言族）
- [ ] 新公共面 test-d 快照（按 issue420 `api.test-d` 先例）

## Blocked by

None (can start immediately)

## Comments
