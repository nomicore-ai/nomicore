# SA6 诊断与验收契约 — issue #412（persistence：公开完成式排空 `drain()` + `retryDelayMs` 与 `debounceMs` 解耦）

- 任务类型：**Feature（能力缺口）**——issue 请求为「公开完成式排空 API」+「独立 retry 配置」，非 Bug 修复
- 仓库 / worktree：`/home/wangjian/nomicore-fix-issue-412`，分支 `mabf/issue-412`
- HEAD：`c3f7bd9e474d465e95e870def353a65c70363076`（`docs(protocols): UPDATE_CHUNK 单形态发布状态同步——0.2.0 线首次携带 0x42`）
- 判定：**approve**（能力缺口稳定可证、契约红因正确、参考实现实验确认契约可绿且零既有回归）

---

## 1. Task type and inputs

| 输入 | 路径 | 状态 |
| --- | --- | --- |
| Host task brief | `wiki/raw/task_issue-412.md` | 存在（Issue #412 正文，state=open，updated 2026-09-20T17:31:48Z） |
| relevant decisions | `wiki/raw/task_issue-412_relevant_decisions.md` | **不存在**（缺失；以 ADR 0006 + 既有测试冻结审计为替代权威来源，见 §3） |
| conflict report | `wiki/raw/task_issue-412_conflict_report.md` | **不存在** |
| SA8 产物 | `wiki/raw/task_issue-412_sa8*` | **不存在**（无 SA8 前置门禁产物；契约约束逐条从源码/ADR/既有测试反推，见 §3） |
| 既有 SA6 报告 | `wiki/raw/task_issue-412_sa6_contract.md` | 本文件为新建（原位修订规则不适用） |
| GitHub 侧信息 | dispatch 明示：Issue REST comments 为空，无 owner requirements | 无 owner 追加约束 |

Issue 请求要点（原文证据）：

- 缺口 1：`PersistenceLifecycle` 公开面无完成式排空入口；`dispose()` = `abort` + `clearTimers` + `doc.destroy`；宿主只能 `await sleep(FILE_PERSISTENCE_DRAIN_MS /* 固定 5500ms */)` 猜窗口；请求把归档路径的强制排空一般化为公开 `drain()`（对所有 live 脏 entry 含零 handle 立即 `startFlush` 跳过 debounce、await 全部 settle、不 abort/不 destroy、可选参数只 drain 指定 key 集合）。
- 缺口 2：`retryDelayMs: this.schedule.debounceMs || 1` 使重试节奏与防抖节奏耦合；请求独立 `retryDelayMs` 配置，缺省保持现行为。

## 2. Owner comment mapping

Issue REST comments = 空（dispatch 明示），**无 owner requirements 生效**。因此以 issue 正文的「语义建议」+「请求」两节作为 request 面；下表把 request 逐条映射到契约项（§12），不做任何超出正文的 owner 意图推断。

| Issue request（正文措辞） | 契约项 | 测试锚 |
| --- | --- | --- |
| 「把所有脏 entry 落完盘再退」 | C1 | 1a/1d |
| 「对所有 live 脏 entry（含零 handle）立即 startFlush（跳过 debounce）」 | C1 / C3 | 1a / 1d |
| 「await 全部 settle（复用 archiveWaiters 通知面或等价机制）」 | C2 | 1b / 1g |
| 「不 abort、不 destroy、不清定时器之外的任何状态」 | C4 / C5 | 1a（getStatus/续写）/ 1b（不被 abort） |
| 「drain 返回后 dispose() 可以安全立即执行」 | C6 | 1d / 1a |
| 「可选参数：只 drain 指定 key 集合」 | C7（临时形状） | 1e |
| 「独立的 retryDelayMs 配置」 | C8 / C9 | 2a / 2c |
| 「缺省保持现行为」 | C10 | 2b / 3a / 3b |
| 「固定睡眠窗口可被击穿（慢盘/并发 flush；schedule 调长）」 | C11（缺口正复现证据，保持性） | 0a / 0b |

## 3. SA8 constraints

无 SA8 产物。以下为从规范文档与既有冻结审计反推的**硬约束**（契约不得与之冲突）：

1. **ADR 0006:34**「不设外部 flush/cron 协调器……retry 同属持久层内部，以退避策略重试直到成功或插件停止」→ 排空不得引入外部协调器；degraded 期间重试继续由内部退避驱动（drain 必须等待而非热循环）。
2. **ADR 0006:195**「降级等待期内（任一可观察时刻）retry 退避即该 entry 的唯一 flush 调度源（退避上限 max-dirty 间隔）」→ drain 在 degraded 回退窗内**不得**强制即时重试（1f 断言）。
3. **ADR 0006:226 + contract.ts:75**「optional 成员——13 个既有 stub 与三成员字面量绿守卫在 required 形态下全部编译红」→ `drain` 若进入 `DocPersistence` 必须为 optional 成员（required 保证面放派生接口，如既有 `ReplicaPersistence` 先例）；类型面守卫 `legacyThreeMemberAdapter: DocPersistence` 锚定之。
4. **ADR 0006 §228-5**「dispose() 语义不变」→ 本 issue 不改变 dispose 的有损/abort 语义；`drain` 是**并列**入口（0a/0b 以基线+目标双态保持绿，锚定该不变量）。
5. **既有冻结审计（must not silently break）**：
   - `persistence-contract.test.ts:32` `expect(DEFAULT_PERSISTENCE_SCHEDULE).toEqual({ debounceMs: 500, maxDirtyMs: 5_000 })`
   - `persistence-contract.test.ts:34-37` `expect(resolvePersistenceSchedule({ debounceMs: 0, maxDirtyMs: 12 })).toEqual({ debounceMs: 0, maxDirtyMs: 12 })`
   - `file-persistence.test.ts:50` / `file-persistence-sa7-dynamic.test.ts:36` `const TEST_SCHEDULE: PersistenceSchedule = { debounceMs: 10, maxDirtyMs: 50 }`
   - `dsh-persistence/src/record.ts:5,20` 探针记录格式冻结 `schedule=debounceMs:…,maxDirtyMs:…`
   → 这些**不是**本契约的断言，而是设计必须显式裁决的既有冻结面（见 §15 D-2/D-3）。
6. `apps/yjs-server/src/app.ts:84-87,566-571` 仓库内消费方实例：`drainMs = (schedule?.maxDirtyMs ?? 5_000) + 500` 后 `sleep` → 与 issue 描述的 nomic-server 固定 5500ms 同构（同款猜测窗口）。

## 4. Environment and baseline

- 工具链：Node v24.13.0、pnpm 10.28.2、vitest 3.2.7、TypeScript 5.9.3、yjs ^13.6.30（真实依赖，非 mock）。
- 依赖安装：`pnpm install --offline --frozen-lockfile`（65 packages reused，504ms；无网络依赖）。
- 基线（**加入本契约文件之前**）：`NODE_OPTIONS=--conditions=nomicore-source npx vitest run --typecheck packages/persistence/test` → **18 files / 180 tests 全绿，Type Errors: no errors**（含既有 180 绿守卫逐条通过）。
- 基线（**加入本契约文件之后**）：20 files = 2 failed（本契约 2 文件）/ 18 passed；**212 tests = 21 failed / 191 passed**；`Type Errors 3 failed`（三个类型锚点）+ 4 处 TS2353（`Partial<PersistenceSchedule>` 不认识 `retryDelayMs`）。
- 真实故障面：MemoryPersistence（共享 hook store）+ FilePersistence（真实 tmpdir、真实 fs mkdir/writeFile/rename）；零 mock 本地服务、零真实 sleep。

## 5. Positive reproduction

缺口正复现（**基线绿、目标态仍须绿**——锚定 dispose 语义不变与「固定睡眠≠完成式」）：

- **0a（Memory + File 双 adapter）**：`schedule={debounceMs:60_000, maxDirtyMs:300_000}`；`createDoc`（初始 n=1 已提交）→ `ROOT.n=77` → `saveDoc`（ACK 已登记）→ `release()`（消费方 registry.shutdown 语义：全部 lease 释放）→ `advanceBy(5_500)`（消费方固定睡眠窗）→ 窗口内**新增 write 尝试 = 0** → `dispose()` → 新实例 `loadDoc` 见 **n=1（77 丢失）**。
- **0b（Memory + File 双 adapter，issue 条件 1「跨 key 并发 flush 无上界」的动态构造）**：三个 key 各 `saveDoc`（n=77）→ 三条 debounce 同时到点发起 3 个并发 flush → 全部挂起在提交段前（慢盘等价：I/O 未结算）→ 固定睡眠窗 `advanceBy(5_500)` → `dispose()` → release 后三个 key 的 77 **全部丢失**（新实例均见 n=1）。
- 仓库内同款宿主链路证据：`apps/yjs-server/src/app.ts:566-571`（`maxDirtyMs + DRAIN_MARGIN_MS` 固定睡眠 + 追加注释「dispose() 只 abort+destroy，**不冲刷 dirty**」）。

## 6. Negative control

- **1c（drain 负控）**：空 lifecycle `drain()` → 0 次 write、立即结算；干净 live entry `drain()` → 0 次 write、`getStatus()==='ready'`、drain 后 `saveDoc` + 调度窗仍能落盘（调度面未被清除）。空/干净场景不产生伪 flush。
- **2b（配置负控）**：`{debounceMs:40, maxDirtyMs:1_000}`（未配置 `retryDelayMs`）→ 失败后重试基准仍 = 40ms（基线绿、目标态绿）：证明缺省未漂移。
- **3a/3b（保持性守卫）**：`resolvePersistenceSchedule({})` 仍为 `debounceMs=500/maxDirtyMs=5000`；缺省 schedule 下 flush 仍按 debounce 到点触发、单飞 + generation 语义不变；`resolvePersistenceSchedule({…, retryDelayMs: 200})` 不 throw。
- **3c（既有面保持）**：`createDoc` 共享 live doc + 独立 handle、`saveDoc`/`loadDoc` 语义、`dispose → getStatus()==='disposed'` 不变。
- **相近负控（非 drain 路径的对照）**：§2 的解耦断言全部经**既有 flush 调度路径**（debounce 触发）驱动，不经 drain——排除「drain 顺带修好重试」造成的伪相关。

## 7. Stability, scale and timing

- **稳定性**：红灯文件连续 5 次运行结果完全一致（`18 failed | 9 passed (27)` ×5，见 §13 命令）。
- **确定性手段**：fake scheduler（零 real sleep）+ 失败注入（pre-commit，store 不变）+ **结算屏障 `whenSettled(n)`**（File 侧真实 fs I/O 无法用微任务计数覆盖；屏障在红判据之后使用，不作为红判据）+ 竞态一律 `withTimeout(…, 2_000)`（挂起即失败，不静默超时）。挂起构造用探针 `holdNextWrites(n)`（n 个并发在途，一次性放行）。
- **时序表（问题 2 的因果最小实验）**：配置 `{debounceMs:60_000, maxDirtyMs:300_000, retryDelayMs:200}`，首次 debounce flush 于 t=60_000 失败：
  - 基线（`retryDelayMs` 被忽略）：**首次重试 t=120_000**（基准 = debounceMs=60s）→ 在 t=60_200 断言「已发生重试」失败（`expected 1 to be 2`）。
  - 目标态：**首次重试 t=60_200**（基准 = 200ms）→ 落盘 n=77。
  - 退避增长/cap（2c，`{debounceMs:50, maxDirtyMs:350, retryDelayMs:100}`）：目标态尝试时刻 = 50 / 150 / 350 / 700（基准 100 → ×2 → cap=maxDirtyMs=350）；基线 = 50 / 100 / 200 / 400。断言在 t=149（期望 1 实际 2）处即红。
- **规模**：3 个 key 并发在途（0b/1g）；key 间并发无上界这一结构性事实由「固定窗口与 I/O 结算无关」表达（窗口是时间量、完成是事件量），不虚构 2.2s 慢盘数值。

## 8. Root-cause chain or capability gap（能力缺口链）

| Step | Fact | Evidence | Confidence |
| --- | --- | --- | --- |
| 症状 | 优雅停机后最新已 ACK 写丢失（新实例见陈旧快照） | 0a/0b 动态复现（Memory+File）；issue 消费方证据；`apps/yjs-server/src/app.ts:566-571` | 高 |
| 直接故障点 1 | `dispose()` 同步段 `abort()`（:808）+ `clearTimers()`（:812）+ `doc.destroy()`（:821）+ `cells.clear()`（:824），随后仅 `allSettled(inFlight)`（:825）——只覆盖**已发起**的在途操作，不覆盖「定时器未点火/重试窗内/尚未 startFlush」的待落盘脏状态 | 源码逐行；0a（0 次 write 后 dispose）；`maybeEvict`（:1126-1132）对脏 entry 早退（不驱逐、不保护） | 高 |
| 直接故障点 2 | 公开面无完成式入口：`DocPersistence`（contract.ts:80-139）与两个 adapter（memory.ts/file.ts）均无 drain；唯一排空通知面 `archiveWaiters`（lifecycle.ts:96-98）为私有，且仅由 `settleEntryForArchive`（:690-709）填充 | `Object.getPrototypeOf(adapter)` 运行时枚举面（既有 SA7 §7 守卫）；类型面无成员（类型锚点红） | 高 |
| 直接故障点 3 | `retryDelayMs` 初值（:1030）与 flush 成功回落（:1088）均取 `schedule.debounceMs \|\| 1`，无独立配置键 | 源码；2a/2c 行为红；类型面 TS2353 | 高 |
| 触发条件 | 宿主在 dispose 前用**时间量**近似**事件量**（固定睡眠）；或 debounce/maxDirty 被调长使推导关系断裂；或存在跨 key 并发在途 I/O | 0a（5.5s < 60s 零落盘）、0b（窗口与 I/O 结算无关） | 高 |
| 最深根因 | 生命周期把「pending dirty 的完成」表达为**内部定时器状态**（debounce/maxDirty/retry）而非**可 await 的完成事件**；归档路径曾以 `settleEntryForArchive` 把该语义局部兑现，但未升格为公开能力，且该私有先例带 `handles.size>0 → DocArchiveActiveHandleError`（:695）而不能直接复用于停机排空 | lifecycle.ts:679-709 vs :801-826；issue「请求」节 | 高 |
| 放大因素 | (a) degraded 重试基准被 debounceMs 拉长（问题 2）→ 调长 schedule 的场景里丢一个 debounce 周期；(b) key 间 flush 并发无上界 → 慢盘下固定窗口同时被多个在途写击穿；(c) 宿主无法在 drain 前观察「还剩多少脏 entry」（无完成语汇） | 2a/2c 时序表；0b；issue 问题 1 条件 1/2 | 高 |
| 未证实假设 | 生产 nomic-server 实测 `io.write ≈ 2.2s`（issue 消费方单点数据，本仓库无法复测）→ 仅作背景，不作为契约断言；改为构造等价的「在途未结算」条件 | §7 规模说明 | 中（背景） |
| 排除项 | 见 §11 | — | — |

## 9. Causal experiments

1. **缺口因果实验（0a，控制变量 = 时间 vs 完成）**：同一输入（create+saveDoc+release），唯一变量 = 是否推进到 debounce 窗口：`advanceBy(5_500)` 后 dispose → 0 次 write、丢 77；对照组 `saveDoc` 后推进 60_000 → 1 次 write、落盘 77（§3b/1a 中的推进臂）。→ 丢失由「dispose+未点火定时器」而非 harness 造成。
2. **并发在途实验（0b）**：3 个 key 的在途写全部挂起（尚未结算）时，固定睡眠窗推进 5_500ms 不改变任何在途状态 → dispose 后 3 个 key 全丢。→ 证明「窗口」无法表达 I/O 结算。
3. **重试基准实验（2a/2c，单变量 = retryDelayMs 是否被解析）**：同配置仅 `retryDelayMs` 参与/被忽略 → 首次重试时刻 60_200 vs 120_000（2a）；退避时刻序列 50/150/350/700 vs 50/100/200/400（2c）。→ 排除「重试本来就快」的可能。
4. **参考实现实验（证明契约可满足、断言敏感、零既有回归）**：临时在 4 个生产文件上加最小参考实现（见下方 diff 摘要）→ **212 tests 全绿 + `tsc -p packages/persistence/tsconfig.json` 零错误**；随后 `git checkout -- packages/persistence/src/` 全量恢复（md5 与实验前一致，见 §16）。实验占位注释 `TEMP-SA6-EXPERIMENT`。
5. **mutation/反证（反-cheat 敏感性）**：
   - 「drain = 直接调 dispose」→ 1a 在 `getStatus()==='disposed'` / 续写 saveDoc 处红，1b/1g 在 store 陈旧处红（abort 令提交段不执行）。
   - 「drain = 只返回 Promise.resolve()」→ 1a/1d 在落盘断言处红（0 次 write）。
   - 「drain = 对在途写重复 startFlush」→ 1b/1g 在 `attempts` 增量处红（single-flight 计数）。
   - 「drain 在 degraded 窗内热循环重试」→ 1f 在「回退窗内 attempts 保持 1」处红（ADR 0006:195 地基）。
   - 「retry 基准改硬编码固定值」→ 2b 红（缺省必须 = 动态 debounceMs）。
   - 「retry 解耦但丢 cap」→ 2c 在 t=700 处红（cap=maxDirtyMs）。

参考实现 diff 摘要（**已恢复，非交付物**；`git diff` 103 行，实验后 md5 校验一致）：

```text
contract.ts   : PersistenceSchedule += `readonly retryDelayMs?: number`（optional 建模）
                resolvePersistenceSchedule: `...(config.retryDelayMs !== undefined ? { retryDelayMs: config.retryDelayMs } : {})`
lifecycle.ts  : createEntry/flush 成功回落: `(this.schedule.retryDelayMs ?? this.schedule.debounceMs) || 1`
                + public async drain(targets?) —— live cells 环：flushing → 等 waiter；
                  retryTimer 武装 → 等 waiter（尊重回退，不热循环）；脏且非在途 → startFlush；
                  waiter 复用 archiveWaiters（await 全部 settle 后重入环，直到无 pending）
memory.ts     : drain(targets?) → this.core.drain(targets)
file.ts       : drain(targets?) → this.core.drain(targets)
```

## 10. Impact surface

| 面 | 落点 | 影响 |
| --- | --- | --- |
| 内核 | `packages/persistence/src/lifecycle.ts`（dispose:801、settleEntryForArchive:690、startFlush:1074、flush:1079-1114、createEntry:1030、scheduleRetry:1116-1124、clearTimers:1144） | 新增公开 `drain` 与独立 retry 基准；dispose 语义不变 |
| 配置面 | `packages/persistence/src/contract.ts`（PersistenceSchedule:473、resolvePersistenceSchedule:494、DocPersistence:80） | `retryDelayMs` 配置键；`drain` 的可选/派生放置 |
| Adapter | `memory.ts`（:144 getStatus 邻位）、`file.ts`（:88 邻位） | 两个 adapter 均须委派实现（行为等价，issue 要求「公开面」） |
| 导出面 | `packages/persistence/src/index.ts` | 若新增 drain 类型别名（如目标形状）需经 barrel 显式导出；`PersistenceIO` 已是唯一 lifecycle 导出先例 |
| 既有冻结审计 | `persistence-contract.test.ts:32-37`；`file-persistence.test.ts:50`；`file-persistence-sa7-dynamic.test.ts:36`；`persistence-phase5-archive-surface.test-d.ts:100-108`；`persistence-contract.test.ts:18-27` | 设计必须显式裁决（见 §15 D-2/D-3）；本契约不重复其断言以避免伪冲突 |
| DSH 探针（第二实现点） | `packages/dsh-persistence/src/probe.ts:445-464`（`let delay = schedule.debounceMs \|\| 1` … `delay = Math.min(delay*2, schedule.maxDirtyMs)`）；`record.ts:5,20`（记录头格式）；`test/dsh-profile-acceptance.test.ts`（记录 golden） | 探针时间线必须与内核退避锁步，否则 `save-degraded` 场景时序漂移；记录头是否扩展需裁决（golden 会变） |
| 消费方 | `apps/yjs-server/src/app.ts:566-571`（固定睡眠） | 消费方把睡眠替换为 `await persistence.drain()`（issue「消费方配合」；是否纳入本次改动集由设计裁决） |
| 文档 | `docs/adr/0006-server-persistence-docstore.md`（:34 retry 条款、:195 退避唯一调度源、:226 optional 先例、§228-5 dispose 不变） | 新增 `drain` 语义节 + `retryDelayMs` 配置语义（ADR 0006 增补节；docs/AGENTS.md 要求「行为变更同步规范文档」） |
| 运行时/Registry | `packages/namespace-registry`（shutdown → lease release → 依赖 persistence） | 无接口破坏；registry 停机链路可选改用 drain（本 issue 未要求） |

## 11. Ruled-out hypotheses

1. **「maybeEvict 会保护脏 entry」——排除**：`maybeEvict`（lifecycle.ts:1126-1132）在 `savedGeneration !== dirtyGeneration` 时直接 return（不驱逐也不排空）；`releaseHandle`（:1040-1045）只是让 entry 成为驱逐候选。0a 已证零保护。
2. **「归档 settle 路径可直接复用为 drain」——排除**：`settleEntryForArchive` 对 `handles.size > 0` 抛 `DocArchiveActiveHandleError`（:695），且非公开；1a 以 live handle 场景锚定 drain 必须支持有 handle 的 live entry。
3. **「dispose 已经 await 在途，所以只差一点点」——排除**：`allSettled(inFlight)` 只覆盖已 track 的操作，且 `abort()` 使尚未跨过 adapter 入口门的写在放行后仍不提交（0b 中 release 后 store 不变）。「在途」≠「待落盘」。
4. **「retry 有 cap（maxDirtyMs），所以 debounce 耦合无害」——排除**：cap 作用于 `delay*2` 之后的下一次（:1119），**首次**重试取的是未 cap 的 `schedule.debounceMs`；2a 实测首重试 = 60s。
5. **「固定睡眠只要取 maxDirtyMs 上界就安全」——排除**：0b 证明窗口是时间量、完成是事件量，与 I/O 结算无关；调长 schedule 时推导关系断裂（0a）。
6. **「契约红是超时/环境造成的」——排除**：红判据全部先于任何 I/O 结算屏障（TypeError 立即抛；2a/2c 的 attempts 断言在屏障之前）；红文件总时长 < 400ms，无 2s 级超时失败；5 次重复运行结果一致。
7. **「drain 缺失只是类型面问题」——排除**：12 个运行期锚点在基线上以 `TypeError: asDrain(...).drain is not a function` 红（特征缺失的运行时红），类型面另有 3 个锚点红，两者独立。

## 12. Acceptance contract and test paths

测试路径（新增，真实被 runner 发现）：

- `packages/persistence/test/persistence-issue-412-drain-red.test.ts`（运行期契约，27 tests）
- `packages/persistence/test/persistence-issue-412-drain-surface.test-d.ts`（类型面锚点，5 tests）

契约项（C = 必须满足；所有断言只观察运行时行为，零源码字符串/正则断言）：

| 编号 | 契约 | 测试 |
| --- | --- | --- |
| C1 | 存在公开 `drain()`；对 dirty live entry（**含**有 handle 与零 handle）**跳过 debounce** 强制 flush，resolve 时受信 store 已持有最新完整快照 | 1a（live handle、零时间推进落盘 n=77）、1d（零 handle 消费方链路） |
| C2 | `drain()` resolve ⟺ 所有在途 flush 已结算且被排空的 dirty 状态已提交；不得在途未结算时提前返回，不得重复发起（key 内 single-flight） | 1b（单在途 hold）、1g（3 key 并发 hold） |
| C3 | `drain()` 对干净状态（空 lifecycle、干净 live entry）零 write、立即 resolve | 1c |
| C4 | `drain()` 不 abort：在途 `io.write` 的提交段必须真实执行（release 后落盘） | 1b、1g（store 含 77） |
| C5 | `drain()` 不 destroy、不清调度面：drain 后 lease 仍 `ready`、`handle.doc` 可续写、`saveDoc` + 调度窗仍能落盘 | 1a（n=88 第二轮）、1c |
| C6 | `drain()` 后 `dispose()` 可立即安全执行，且已排空内容不丢（新实例可见） | 1d、1a |
| C7 | 可选参数：只排空指定 `(owner, docId)` 集合；未指定 key 保持脏、零多余 write；零参形式排空全部 | 1e（**临时形状**：`targets?: readonly {owner, docId}[]`，待设计冻结，仅调用点形状可调） |
| C8 | `PersistenceSchedule` 配置面接受 `retryDelayMs`；显式配置时首重试基准 = `retryDelayMs`（与 debounceMs 正交） | 2a（t=60_200 落盘）、类型锚 `keyof PersistenceSchedule ∋ 'retryDelayMs'` |
| C9 | 退避增长与上限保持：首基准 = `retryDelayMs`，其后 ×2、cap = `maxDirtyMs`（ADR 0006:195「退避上限 max-dirty 间隔」） | 2c（t=50/150/350/700） |
| C10 | 缺省保持现行为：未配置 `retryDelayMs` 时重试基准 = 解析后的 `debounceMs`（动态，非固定默认值） | 2b（40ms 基准）、3a |
| C11 | 缺口正复现（保持性，基线绿）：固定睡眠 + dispose 会丢已 ACK 写（单 key 调长 schedule、多 key 并发在途两形态）；dispose 语义不因本 issue 改变 | 0a、0b |
| C12 | drain 在 degraded 回退窗内**不热循环**：失败后仅一次强制尝试，回退窗内零新增尝试，等待 retry 到点成功后 resolve（ADR 0006:195） | 1f（t=150 重试成功） |
| C13 | 既有公开语义零改动：`createDoc/loadDoc/saveDoc/getStatus/dispose` 行为不变；缺省 schedule 常量与解析语义不变；`drain` 不得成为 `DocPersistence` 的 required 成员 | 3a/3b/3c、类型锚 `legacyThreeMemberAdapter` |
| C14 | 两个 adapter（Memory/File）行为等价——C1–C7 全部在双 adapter 矩阵上成立 | 全部 §0/§1/§2 用例按 adapterName 双跑 |

目标态/基线态预期：

- 基线（HEAD `c3f7bd9`）：C1–C9、C12、C14 红（**14 × `TypeError: drain is not a function`**（§1 的 1a–1f ×2 adapter + 1g ×2 adapter）+ 2a×2 / 2c×2 行为断言红 + 3 类型锚红），C10/C11/C13 绿。
- 目标态：**全部 27 + 5 全绿**（已由参考实现实验确认，见 §9/§13）。

runner 触发：

```bash
# 全量（repo 标准入口，等价 pnpm test 的 persistence 切片）
NODE_OPTIONS=--conditions=nomicore-source npx vitest run --typecheck packages/persistence/test
# 类型面（root pnpm typecheck 的 persistence 段）
npx tsc -p packages/persistence/tsconfig.json
```

## 13. Red/green or baseline evidence

| 场景 | 命令 | 结果 |
| --- | --- | --- |
| 基线（无本契约文件） | 全量 persistence vitest | **18 files / 180 tests 全绿**，0 type errors |
| 基线（含本契约） | 全量 persistence vitest `--typecheck` | **2 files failed / 18 passed；212 tests: 21 failed / 191 passed；Type Errors 3 failed；Errors 4**（4 × TS2353：`retryDelayMs` 不在 `Partial<PersistenceSchedule>`） |
| 基线（契约文件单独） | `vitest run persistence-issue-412-drain-red.test.ts` | **18 failed / 9 passed (27)**，连续 5 次完全一致 |
| 基线（类型面 tsc） | `npx tsc -p packages/persistence/tsconfig.json` | 7 errors = 4 × TS2353（`retryDelayMs` 不在 `Partial<PersistenceSchedule>`）+ 3 × TS2322（drain/配置键类型锚 `true` 不可赋给 `never`） |
| 参考实现（临时） | 同一全量命令 + `tsc -p packages/persistence/tsconfig.json` | **20 files / 212 tests 全绿；typecheck 零错误** |
| 恢复后 | `git checkout -- packages/persistence/src/` + md5 | 与实验前逐文件一致（§16），`git status` 仅新增文件（2 测试 + 本报告 + Host task brief），`packages/persistence/src/` 零改动 |

红因分类（逐条对应，非环境/超时/入口错误）：

- 14 个运行期 TypeError 红 = `TypeError: asDrain(...).drain is not a function`（§1 的 1a–1f ×2 adapter = 12，+ 1g ×2 adapter = 2）——特征缺失的红。
- 2a（×2）：`AssertionError: expected 1 to be 2`（retryDelayMs 窗口内零重试）。
- 2c（×2）：`AssertionError: expected 2 to be 1`（t=149 已有基线重试）。
- 类型锚（3）：`TS2322: Type 'true' is not assignable to type 'never'`（Memory drain / File drain / PersistenceSchedule key）。
- 无 skip / only / todo / env override / fallback / 源码字符串断言。

## 14. Runner trigger evidence

- `vitest.config.ts:15` include = `packages/*/test/**/*.test.ts` → 本契约运行期文件被发现（全量运行输出中列出 20 files）。
- `vitest.config.ts:20` typecheck include = `packages/*/test/**/*.test-d.ts` → 类型面文件以 `TS` 模式执行（参考实现态输出 `✓ TS packages/persistence/test/persistence-issue-412-drain-surface.test-d.ts (5 tests)`）。
- root `package.json` `test` 脚本 = `NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`（本报告命令与之等价，仅收窄到 `packages/persistence/test`）。
- root `package.json` `typecheck` 段含 `tsc -p packages/persistence/tsconfig.json`（其 include 覆盖 `test/**/*.ts`，故 4 处 TS2353 属类型面红灯的一部分）。

## 15. Unknowns and blockers

无阻塞项。设计需裁决的开放点（不阻塞契约，但影响实现落点）：

- **D-1（drain 放置面）**：建议 `DocPersistence` optional 成员 + 派生 required 面（既有先例）；或仅 adapter 类面。C13 的类型守卫已按 optional 语义锚定。
- **D-2（retryDelayMs 的解析形状）**：两种落点均满足 C8–C10：（A）解析面把缺省值物化进 resolved schedule（会命中 `persistence-contract.test.ts:32-37` 的 `toEqual` 冻结审计，需同步立法更新）；（B）resolved 键形状不变（仅显式配置时带上），缺省回退在 lifecycle 内（参考实现采用的零遗留路径，既有审计不改）。本契约只钉行为面，不钉键形状。
- **D-3（required vs optional 类型建模）**：若把 `retryDelayMs` 设为 required，`file-persistence.test.ts:50` 与 `file-persistence-sa7-dynamic.test.ts:36` 两处既有 `PersistenceSchedule` 字面量需要同步迁移。
- **D-4（C7 目标集合形状冻结）**：`targets?: readonly {owner, docId}[]` 为 SA6 最小提案（内部 `toKey` 词汇不公开）；设计冻结更精确形状时只改调用点（archive-red 的 `expectedReplicationIdentity` 同款先例）。
- **D-5（drain × dispose 交错 / drain 与 reading/creating/archiving/deleting cell 的关系 / drain 并发重入）**：本契约不锚定（未在 issue request 面内），设计需给出语义（当前参考实现只处理 live cell，且 closed 后立即 return）。
- **D-6（DSH 探针锁步与记录头）**：`probe.ts:445-464` 的退避镜像与 `record.ts` 记录头是否随 `retryDelayMs` 演进，需与内核同步裁决（golden 变更风险）。
- **D-7（消费方改动集范围）**：`apps/yjs-server/src/app.ts:566-571` 的睡眠→drain 替换与文档（ADR 0006 增补节）是否在同一变更集内。

## 16. Temporary diagnostics cleanup

- 临时参考实现（`contract.ts` / `lifecycle.ts` / `memory.ts` / `file.ts`）已全量恢复：`git checkout -- packages/persistence/src/`，实验后 md5 与实验前逐文件一致：
  - `contract.ts 1b58c72f4bfa07bbaa1db78fe4a18f09`
  - `file.ts ac0cbb3ab22530074d3d259aa3ed739f`
  - `lifecycle.ts c68f7a145fad08a000809a5cc81aa7c0`
  - `memory.ts 2dd8ca4a992c5ac88f27772d91758c61`
- 临时诊断脚本 `packages/persistence/.scratch-412-debug.mts` 已删除；实验补丁/备份位于 `/tmp`（`/tmp/sa6-412-*.diff|*.py|*.bak` 中的 `.bak` 与脚本已删除），仓库内零残留。
- `git status --porcelain` 仅 4 个 untracked 新增文件：`packages/persistence/test/persistence-issue-412-drain-red.test.ts`、`packages/persistence/test/persistence-issue-412-drain-surface.test-d.ts`、`wiki/raw/task_issue-412_sa6_contract.md`（本报告）、`wiki/raw/task_issue-412.md`（Host 提供）；`git diff`（tracked 面）为空。
- 无后台服务/进程遗留（全部命令为一次性 vitest/tsc 前台或已收尾的 Job）。
- 未修改任何生产实现、未 commit/push/建 PR、未调度其他 SA。

---

**Verdict: approve** — 能力缺口（无完成式排空入口；retry 基准耦合）以双 adapter 真实链路稳定复现；红因逐条归因于目标断言（14 运行期 TypeError + 4 行为断言 + 3 类型锚），负控与保持性守卫在基线绿；参考实现实验使 212 tests 全绿且既有 180 守卫零回归，证明契约可满足、断言敏感、边界（degraded 回退、并发在途、subset）可执行。
