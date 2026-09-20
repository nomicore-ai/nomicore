# MABF Task Brief

Repository: nomicore-ai/nomicore
Issue: #412
Title: persistence：请求公开完成式排空 API（drain）——dispose 语义为 abort+clearTimers+doc.destroy，宿主只能定时睡眠猜排空窗口；retryDelayMs 与 debounceMs 耦合
State: open
Issue updated at: 2026-09-20T17:31:48Z

## Issue body

## 背景（消费方证据）

nomic-server（Hub 部署）的优雅停机链路目前只能这样写：

```ts
await runtime.usersLease?.release()
await runtime.registry?.shutdown()      // 释放全部 lease/handle
await sleep(FILE_PERSISTENCE_DRAIN_MS)  // 固定 5500ms —— 按 maxDirtyMs=5000 推导的猜测值
await runtime.persistenceFiber.dispose()
```

`PersistenceLifecycle` 的公开面（loadDoc / createDoc / importDoc / archiveDoc / deleteDoc / saveDoc / getStatus / dispose）**没有任何完成式排空入口**，宿主无法表达「把所有脏 entry 落完盘再退」。

## 问题 1：dispose 语义使固定睡眠成为唯一选项，且窗口可被击穿

`packages/persistence/src/lifecycle.ts:801` 的 `dispose()`：

```ts
this.abortController.abort()            // abort 在途 io.write（flush 持有该 signal，:332）
for (const cell of this.cells.values()) {
  this.clearTimers(entry)               // 取消全部待触发的 debounce/maxDirty/retry 定时器
  entry.handles.clear()
  entry.doc.destroy()                   // 内存 doc 销毁——脏数据不可恢复
}
```

后果：**dispose 时刻未落盘的已 ACK 写全部丢失**，包括 debounce 定时器本会在 +500ms 触发的那部分。宿主的固定睡眠窗口可被两类现实条件击穿：

1. **慢盘/并发 flush**：跨 key 的 flush 并发无上界（每 key single-flight，key 间并发），registry shutdown 一次释放所有 namespace 时形成 flush 风暴；消费方部署实测单次 `io.write` ≈ 2.2s（慢盘），数个并发 flush 即可超过 5.5s 排水窗；
2. **schedule 调长**：若宿主为高频写场景把 `debounceMs` 调到 60s / `maxDirtyMs` 300s（合理的 I/O 减压诉求），固定睡眠窗口与 schedule 的推导关系断裂——**每次优雅停机都丢最多一个 debounce 周期的已 ACK 写**。

顺带说明：普通驱逐路径（`maybeEvict`）对脏 entry 是「不驱逐、等定时器落盘后再清理」，不构成额外保护；`settleEntryForArchive`（:690）的「零 handle 脏 entry → 立即 flush + 经 `archiveWaiters`（:96）await 完成」目前只在归档路径私有存在。

## 请求：把归档路径的强制排空一般化为公开 `drain()`

语义建议：

- 对所有 live 脏 entry（含零 handle）立即 `startFlush`（跳过 debounce），并 await 全部 settle（复用 `archiveWaiters` 通知面或等价机制）；
- 不 abort、不 destroy、不清定时器之外的任何状态；drain 返回后 `dispose()` 可以安全立即执行；
- 可选参数：只 drain 指定 key 集合。

宿主侧即可把固定睡眠替换为 `await persistence.drain()`，排空窗口从「猜测」变为「完成式」。

## 问题 2：`retryDelayMs` 与 `debounceMs` 耦合

`lifecycle.ts:1030`：

```ts
retryDelayMs: this.schedule.debounceMs || 1,
```

`debounceMs` 调大到 60s 后，一次瞬时 `io.write` 失败会让该 namespace 以 `persistence-degraded` 持续 60s 才首次重试。重试节奏与防抖节奏是两个正交关注点，建议解耦（独立的 `retryDelayMs` 配置，缺省保持现行为）。

## 消费方配合（供参考）

nomic-server 侧将把 `FILE_PERSISTENCE_DRAIN_MS` 固定睡眠替换为 `drain()` 完成式等待；该改动是消费方调整 persistence schedule（debounce/maxDirty 调长）的前置条件。

## Comments
