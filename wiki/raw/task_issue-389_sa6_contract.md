# SA6 诊断与验收契约 — issue #389 复制来源与订阅终止（变更订阅 T3）

- 任务类型：**feature**（能力缺口证明 + 目标行为验收契约；不虚构 Bug 根因）。
  AC1（复制来源 origin）经实测**在 HEAD 已具备**（T1 交付态的结构性结果）→ 本票对其
  的交付是**验收补锚**（HEAD 即绿的保持性断言），红面由 AC2–AC6 的 `watch-end` 终止
  编排承担。诊断与契约按 feature 形态建立，不伪称 AC1 为红灯。
- 被审对象：issue #389「复制来源与订阅终止（变更订阅 T3）」
  （brief `wiki/raw/task_issue-389.md`；Parent PR #386 = ADR 0030；前置 #387 = T1 tracer，已在 HEAD 合并）。
- Worktree / 基线：`/home/wangjian/nomicore-fix-issue-389`，branch `mabf/issue-389`，
  HEAD `28faeae7a0c619e1352f05d19a83ba46e562879c`
  （`fix(#387): watchMap 无谓词形态垂直通路（变更订阅 T1/tracer bullet） (#395)`）。
- Issue 评论 **0 条**（本轮 `gh issue view 389 --json comments` 实读 `[]`；labels `[in-progress]`，
  state OPEN）→ 无 owner override / 无范围收缩。
- **Host dispatch 约束（本轮）**：只建立诊断与验收契约，**不实现、不作者可执行测试**
  （「Do not implement or author executable tests」）。因此本轮交付 = 诊断证据 + 可执行契约
  **规格**（路径/装置/断言/红灯机理/负控），契约文件的落盘归实现切片；红证据由诊断探针
  在 HEAD 实跑承担（§5/§13），不伪称已有契约测试红灯。
- 结论：**`approve`（附 SA1 冻结条件）** —— AC2/AC3 的能力缺口稳定可证（4 条探针实跑，
  本地 schema 变更 / Peer re-arm / reset 三条路径均零 `watch-end`，且订阅静默存活）；
  AC1 的 origin 分类实测在产（`local` / `replication` 两态）→ 作为保持性验收；契约规格
  可执行、入口真实、负控在 HEAD 即绿；唯一承重开放项 **B-T3-3（doc-replaced 与
  lease force-release 的投递顺序）必须由 SA1 冻结后方可进入实现**（§12.1/§15-1）。

---

## 1. Task type and inputs

| 输入 | 用途 | 状态 |
|---|---|---|
| `wiki/raw/task_issue-389.md` | Host brief：What-to-build + AC1–AC7 + Blocked by #387 | 在场 |
| `wiki/raw/task_issue-389_relevant_decisions.md` | SA8 决策摘录（固定位置） | **缺席**（实查不存在） |
| `wiki/raw/task_issue-389_conflict_report.md` | SA8 前置/设计冲突报告（固定位置） | **缺席**（实查不存在） |
| `artifacts/sa8-*389*` | SA8 门禁产物 | **缺席**（`ls artifacts` 零命中 389） |
| `docs/adr/0030-change-subscription.md` | **规范权威**：§4 通知流（三 kind / `watch-end` 两 reason / FIFO 流末条 / origin 两态）、§5 判定纪律、§6 分发（挂点=事务提交后异步分发、三来源全覆盖、有界队列）、§7 分层 | 在场（HEAD） |
| `docs/adr/0018-peer-schema-rearm.md` | Peer 复制 apply 槽 schema re-arm（§1 同步段位置、§2 成功语义、§3 失败 fatal） | 在场（HEAD） |
| `docs/adr/0010-hub-peer-websocket-ydoc-replication.md` | 复制面边界 / 角色权限（L118/L120）/ reset-backfill 语义 | 在场（HEAD） |
| `CONTEXT.md` L65–67「变更订阅（change subscription）」词条 | 词表与边界：`watch-end`（schema 变更 / doc 替换，流末条）、`origin: 'local' \| 'replication'`（self-echo 抑制）、_Avoid_ 禁用措辞 | 在场（HEAD） |
| `packages/namespace-registry/test/issue-387-watch-map-fixture.ts` + `...tracer-red.test.ts` | **先例与实测基线**：T1 三件套之一（fixture + 行为契约）；HEAD 21/21 绿 | 在场且绿 |
| `packages/namespace-registry/test/issue-369-window-read-lease-contract-red.test.ts` | 先例（lease 契约家族）；HEAD 33/33 绿 | 在场且绿 |
| `packages/namespace-runtime/src/watch-map.ts`（488 行） | T1 交付的实现载体：簿记 / 判定 / 队列 / 泵 / `shutdown` | 在场（HEAD） |
| `packages/namespace-runtime/src/{schema-write,schema-rearm,replication-session,runtime}.ts` | 两处 schema 安装段（本地 S5.5 / peer R5.6）、reset fence 与 `closeAfterFence` | 在场（HEAD） |
| `packages/namespace-registry/src/{lease,registry}.ts` | lease 透传 / 释放清理 / reset 槽（`startCloseAfterFence` → `forceReleaseOutstandingLeases`） | 在场（HEAD） |
| `packages/namespace-registry/AGENTS.md`、`packages/namespace-runtime/AGENTS.md` | 公共面纪律（仅 `src/index.ts`）、包边界、验证门 | 在场（HEAD） |
| issue #387 交付事实（git log） | 前置票已合并（HEAD = #395），无阻塞 | 实读 |
| issue #389 comments / labels | 0 条评论；labels `[in-progress]`；state OPEN | 实读（REST） |

Issue 评论 **0 条** → 无 owner 条款需并入，需求源 = issue body「What to build」+ AC1–AC7 +
ADR 0030 §4/§5/§6 + ADR 0018 + CONTEXT 词条。**SA8 产物缺席的处置**（skill：输入缺失时用
任务简报、源码、日志与现有测试继续）：以任务简报 + ADR + 源码事实 + 探针证据建立契约；
把本应由设计门裁定的空白（§12.1 B-T3-2/B-T3-3/B-T3-6）显式登记为 **SA1 冻结项**，不阻塞
诊断与契约建立，但阻塞实现前冻结（见 Verdict 条件）。

## 2. Owner comment mapping

- issue #389 评论数 = **0**（`gh issue view 389 --json comments` → `[]`，本轮实读；
  `artifacts/sa6-issue389-probe-6-inputs-and-tree.log`）。
- 因此无 owner 条款需映射；需求源 = issue body「What to build」+ AC1–AC7 + ADR 0030 决策 4/6。
- 与相邻票的边界（ADR 0030 §验收 + spec #385 Out of Scope + #387 SA6 §12.1，写进本契约非目标）：
  谓词 `where` 与 `WATCH_MAP_OPTIONS_INVALID`（T2 #388）；`invalidate-all` 的**触发编排**
  （队列溢出测试注入、父路径删除）与运行时键集纯加法（T4 #390）；三方 agent 文档面（T5 #391）；
  数组载体订阅 `watchArray`、含值通知 / 序号 / 对账（ADR v2 开放问题）。

## 3. SA8 constraints（无 SA8 产物时的替代约束面）

| 约束（来源） | 本契约落点 | 证据 |
|---|---|---|
| §4 通知流三 kind 封闭；`data` 定位符 `{path,key}`；`origin: 'local' \| 'replication'`（无过滤） | C1/C2/C11 | ADR L43–53；CONTEXT L65–67 |
| §4 `watch-end` 两 reason（`schema-changed` / `doc-replaced`），**流末条、此后静默**；订阅终结三因 = lease 释放 / schema 变更 / doc 替换；数据缺席与删除**从不**终结 | C3–C10 | ADR L51；CONTEXT L66 |
| §6 挂点 = 写序列器事务提交后异步分发；**全覆盖本地受控写、复制 apply、schema 安装三来源**；回调 throw 静默隔离；有界队列溢出 `invalidate-all` | C3/C4/C8；NC4 | ADR L64–66 |
| §7 分层：runtime 承担「schema 安装 / doc 替换的终止编排」；registry 承担 lease 公共面与透传 | §10 影响面；B-T3-1 | ADR L70–73 |
| ADR 0018：peer apply 槽 R5.6 schema 同步段（提交后、`await notifyDirty` 前）；成功 = `schemaRearm.kind==='applied'`；失败 = fatal 双码、tools 不动、apply 仍 ok | C4 前提 oracle；B-T3-2 | ADR 0018 §1–§3；实测 P10 |
| issue AC1–AC7（复制来源、两路径 schema-changed、doc-replaced、流末条静默、FIFO、终止后重建、零新接缝） | §12.2 映射表 C1–C11 | brief L19–27 |
| #369/#387 先例纪律：公共 API 仅经 `src/index.ts`；断言锚 lease 公共面；三件套 = fixture + 行为契约（+ 类型面，仅在公共类型变化时） | §12.4/§12.5 | `packages/namespace-registry/AGENTS.md`；#387 fixture |
| 无 SA8 决策摘录/冲突报告 | 绑定表 B-T3-2/B-T3-3/B-T3-6 交 SA1 冻结（§15） | §1 输入表 |

## 4. Environment and baseline

| 项 | 值 |
|---|---|
| 环境 | Linux；node `v24.13.0`；pnpm `10.28.2`；vitest `3.2.7`；typescript `5.9.3`；`maxWorkers: 1` |
| 依赖 | 本 worktree 起始**无 `node_modules`**（与 #387 轮不同）；本轮以 `pnpm install --offline --frozen-lockfile`（store 复用，65 包全 reused、零下载）复原 → 探针/测试直跑（`node_modules` 为 gitignore，不入产物） |
| 根 typecheck（基线） | `pnpm typecheck` → **exit 0**（14 个 tsconfig 全过，零 TS error）`artifacts/sa6-issue389-baseline-typecheck.log` |
| #387 T1 watchMap 契约（基线） | `vitest run .../issue-387-watch-map-tracer-red.test.ts --typecheck.enabled=false` → **21/21 绿**、exit 0 `artifacts/sa6-issue389-baseline-387-contract.log` |
| #369 窗口读 lease 契约（基线） | 同款命令 → **33/33 绿**、exit 0 `artifacts/sa6-issue389-baseline-369-contract.log` |
| lease / runtime 公共面现状 | lease 恰 **16 键**（T1 的 #369 前 15 键 + `watchMap`）；runtime 恰 **15 键**（14 + `watchMap`，见 `runtime-phase5-reset-fence-r2.test.ts` L131–146） |
| 测试入口 | `vitest.config.ts` L15 runtime include `packages/*/test/**/*.test.ts`；L20 typecheck include `packages/*/test/**/*.test-d.ts`；`tsconfig.typecheck.json` include `packages/*/test/**/*.ts` |
| 基线—红灯边界 | 基线在**任何** T3 契约文件落盘之前采集（本轮不落盘测试）；HEAD 无预存在红，零 tracked 修改（§16） |
| 工作树状态 | `git diff --stat HEAD` 空（生产实现零改动）；`git status --porcelain` = 探针目录 + `artifacts/sa6-issue389-*.log` + Host brief（§16） |

## 5. Positive reproduction（能力缺口；feature 的「正例」= 目标能力不存在 / 部分已存在）

四类场景全部经**真实 Registry 装配 + 真实 Runtime + 真实 Yjs**（stub 仅持久化 seam），
零 mock 本地服务、零网络、零墙钟（微任务预算 + sink 屏障）。

### 5.1 AC1（复制来源与本地来源）——**HEAD 已具备**（`artifacts/sa6-issue389-1-origin.log`）

装置：hub 角色 Registry → `open` → schema ready → `enableReplication()`(`ok:true`) →
`openReplicationSession({localRole:'hub',remoteInstanceId:'peer-a'})`(`ok:true`) →
`lease.watchMap(['tasks'], sink)`（lease 16 键）。

```text
本地写 t3   → { kind:'data', origin:'local',       changes:[{path:['tasks'],key:'t3'}] }
远端 apply  → { kind:'data', origin:'replication', changes:[{path:['tasks'],key:'t4'}] }
origin 序列 ["local","replication"]；watch-end 计数 0；applyRemoteUpdate → {"ok":true}
```

远端 apply 的 update 构造 = 由 live doc 全量状态 bootstrap 的独立 `Y.Doc` 上写**新键** t4
（Yjs 确定性纪律：新键无并发项），经 `session.applyRemoteUpdate(bytes)` 进入 apply 槽
（`Y.applyUpdate(doc, bytes, ctx.applyOrigin)`，applyOrigin = per-session symbol →
`classifyOrigin` → `'replication'`）。
⇒ **AC1 的目标行为在 HEAD 已由 T1 结构性交付**（与 #387 设计 F-2 判定一致：T1 无过滤、
T3 只补验收编排）；本票对该项的义务 = 验收补锚 + 回归锁（不得引入 origin 过滤）。

### 5.2 AC2-A（Hub 本地 `replaceSchema`）——**HEAD 缺口**（`artifacts/sa6-issue389-2-schema-local.log`）

```text
S2 replaceSchema(V2)          → {"ok":true}
S4 watch-end 计数             → 0
S5 getSchema().text           → V2（active schema 已切换）
S7 订阅流                     → [data(local,t3), data(local,t4)]     // 无 watch-end
S9 lease 状态                 → active（旧订阅未被终结）
S11 schema 变更后新建订阅     → 收到 data(local,t5)（新 schema 下 V2 字段 note 写合法）
S12 旧订阅计数                → 3（旧订阅在 schema 变更后**继续投递** t5 = 静默存活）
```

⇒ 直接缺口：schema 变更后订阅**静默存活**（ADR §4 明示「终止信号 + 消费方重建才是机制
正确形态」；备选节已否决「schema 变更作为通知 kind」的静默方案）。

### 5.3 AC2-B（Peer 复制 apply 槽 schema re-arm，ADR 0018）——**HEAD 缺口**（`artifacts/sa6-issue389-3-schema-peer.log`）

装置：Hub Registry（enableReplication + session(hub→peer) + `subscribeOwnedUpdates`）→
Peer Registry（`role:'peer'`）→ `importReplica(hub 快照 V1)`（`ok:true`）→
`openReplicationSession({localRole:'peer'})`（`ok:true`）→ peer `watchMap(['tasks'])` →
hub `replaceSchema(V2)` → 取 owned update（1 条）→ peer `applyRemoteUpdate(update)`。

```text
P10 peer apply → {"ok":true,"schemaRearm":{"kind":"applied",
                 "semanticFingerprint":"sha256:v1:1cbe5199…b8f1","updatedAt":"2023-11-14T22:15:23.456Z"}}
P11 peer active schema → V2（指纹与 hub V2 逐字节一致——re-arm 前置 oracle 绿）
P12 peer 订阅流        → [data(local,t3)]        // 无 watch-end
P13 peer watch-end 计数 → 0
```

⇒ 缺口在 Peer 路径同样成立；且该场景的**前置 oracle 可判**（`applyRemoteUpdate` 结果的
`schemaRearm.kind` + `getActiveSchema().semanticFingerprint`），红灯不会被误归因于「re-arm 没发生」。

### 5.4 AC3（doc 替换一族：`resetReplica`）——**HEAD 缺口**（`artifacts/sa6-issue389-4-reset.log`）

装置：Replica-capable stub 持久化（`archiveDoc` / `readPersistedReplicationIdentity`）+
种子文档（META `replicationId='a'*32` / `replicationEpoch=1`）→ `open` → `watchMap(['tasks'])` →
本地写 t3（屏障）→ `registry.resetReplica(owner, ns, expectedLocalIdentity)`。

```text
R2 reset 结果            → {"ok":true}（R5 archiveCalls = 1）
R3 reset 后订阅流        → [data(local,t3)]      // 无 watch-end
R4 watch-end 计数        → 0
R6 lease 状态            → released / runtime:null
R7 handle.unsubscribe ×2 → no-throw（幂等）
R8 reset 后 lease.watchMap → NamespaceLeaseReleasedError（released 通道，非新接缝）
```

⇒ 缺口：doc 替换（reset 成功、租赁失效）时订阅**静默销毁**——消费者看不到任何终止信号。

### 5.5 产出面（代码级，`artifacts/sa6-issue389-probe-5-emission-sites.log`）

```text
grep 'watch-end' packages/*/src  → 仅 3 处：类型联合成员（watch-map.ts:67）、
                                    registry types.ts:495 注释、watch-map.ts:37 注释
                                  → 零产出点（无 enqueue/emit 调用）
grep 'doc-replaced|schema-changed' packages/*/src → 仅 watch-map.ts:67 的联合成员字面量
grep 'createWatchHub|watchHub'    → 仅 runtime.ts（98 导入 / 576 构造 / 633 shutdown / 753 透传）
                                    + watch-map.ts 定义
grep 'watch' schema-write.ts / schema-rearm.ts / replication-session.ts / registry.ts → 零命中
```

## 6. Negative control（当前全绿；实现后必须保持全绿）

| # | 断言 | 证明什么 | 本轮实测 |
|---|---|---|---|
| NC1 | T1 行为契约 21/21（建立判定、一事务一通知、同 key 合并、槽外异步分发、回调 throw 隔离、退订幂等、lease 释放清理、16 键纯加法、readData 恒四键负控） | T1 交付面零回归；装置健康 | **绿**（`artifacts/sa6-issue389-baseline-387-contract.log`） |
| NC2 | #369 窗口读 lease 契约 33/33 | 既有读/窗口读冻结面零改动 | **绿**（`artifacts/sa6-issue389-baseline-369-contract.log`） |
| NC3 | **AC1 保持性**：本地写 `origin:'local'`、复制 apply `origin:'replication'`、二者同流 FIFO、零 watch-end | ADR §5「绝不按 origin 过滤」不变量：T3 不得为过契约引入过滤面（F-2 否决备选 B 的回归锁） | **绿**（探针 1：`["local","replication"]`） |
| NC4 | 回调 throw 隔离（T1 X1）：坏消费者不影响写结果与其他订阅；队列溢出 → `invalidate-all`（订阅存活） | 分发纪律零回归（ADR §6） | 绿（T1 契约 X1 在 NC1 内） |
| NC5 | 数据缺席 / 容器删除**不终结**订阅（T1 E3/N4：未物化 `ghost` 可订阅、删除后仍可重建订阅、容器重建后条目定位符照常到达） | ADR §4「数据缺席与删除从不终结」——T3 不得把终止挂到数据面 | 绿（T1 契约 E3/N4 在 NC1 内） |
| NC6 | 无效写（schema 拒绝）零事务零通知（T1 P2） | 通知面与写结果一致（一事务一通知的反面） | 绿（T1 契约 P2 在 NC1 内） |

## 7. Stability, scale and timing

- **确定性复现**：4 条探针在本轮内各复跑 1 次（`artifacts/sa6-issue389-*-rerun.log`，§13 表），与首跑日志 `diff` 为空（逐字节
  同构，同 HEAD、同 fixture）；全部为同步/微任务级进程内行为，零时钟、零网络、零外部服务、
  零真实定时器。
- **无竞猜等待**：探针与契约一律 = microtask budget（`microtasks(600–1600)`）+ sink 计数
  屏障（「等下一笔通知到达」作屏障，再断言上一笔的分类）；契约测试沿用仓内先例
  `expect.poll`（5ms/2s 上限）表达「最终送达」，`零通知` 断言一律用「已提交事务 + 屏障 +
  微任务预算」而非 sleep。
- **规模/时序条件**：fixture 规模 = 2–3 条目/容器、1 条 owned update、1 次 reset（tracer
  最小输入）；无性能断言（避免 CI 抖动）。
- **Yjs 确定性纪律**：远端 update 一律「live doc 全量状态 bootstrap → 只写**新键**」；
  不做同键并发写（clientID 决胜不可确定）。
- **异步分发时序事实（探针实测）**：每项投递前 20 次微任务让步（`WATCH_DELIVERY_DEFERRAL_MICROTASKS`）；
  因此「提交后、投递前」窗口真实存在——AC5 的 FIFO 断言必须在此窗口内成立（§12.3）。

## 8. Capability gap chain（feature：能力缺口链）

| Step | 事实 | 证据 | 置信度 |
|---|---|---|---|
| 症状 | schema 变更 / doc 替换后，活订阅**静默存活或静默死亡**：消费方既无终止信号，也无法判断谓词语义是否仍有效 | 探针 2（V2 后旧订阅仍投递）、探针 4（reset 后订阅静默销毁） | 高（实测） |
| 直接缺口 | 通知联合里有 `watch-end` 类型，但**零产出点**（源码仅类型字面量） | §5.5 grep；探针 2/3/4 `watch-end` 计数恒 0 | 高（实测） |
| 编排缺口 | watch hub 未接入两处 schema 安装段（本地 S5.5 `syncActiveSchemaFromCommittedDoc` / peer R5.6 `rearmPeerActiveSchema`），也未接入 reset 关闭链 | §5.5 grep（`watchHub` 仅 runtime.ts 4 处；`schema-write/schema-rearm/replication-session/registry` 零 watch 引用） | 高（实测） |
| 交付缺口 | reset 路径的 `closeAfterFence()` 同步调用 `watchHub.shutdown()`（静默清订阅），随后 registry `forceReleaseOutstandingLeases` 同步清理 lease 侧 handle 队列 → 即使入队 watch-end 也会被清队丢弃 | `runtime.ts` L633（shutdown）+ L1866（forceRelease，registry.ts）；探针 4 R4=0 | 高（实测+源码） |
| 触发条件 | 消费方（UI/agent）须区分「数据变了」「schema 换了口径」「doc 被替换了」三类事实；T1–T2 交付态只有第一类 | ADR §4；issue What-to-build | 高（决策） |
| 最深根因（本票） | T3 切片的**终止编排**从未交付：`watch-end` 无产出/入队/投递路径，且 schema 安装与 doc 替换两条链未与订阅生命周期耦合 | §5.2–5.5；ADR §7 分工 | 高 |
| 放大因素 | 无终止信号时，桥接层无法在 schema 演进后重建订阅，只能沿用旧 schema 口径（T1 设计 §13-R9 已登记的「T1–T3 静默窗」）；复制场景下 Peer 不因 schema re-arm 得到任何订阅面信号 | #387 设计 R9；ADR 0030 备选节 | 高 |
| 已排除项 | AC1 能力缺口 / 能力已存在但命名不同 / 红灯来自环境、fixture、超时、入口 —— 见 §11 | §11 | 高 |

## 9. Causal experiments（控制变量 / 反证）

1. **同装配控制变量（AC1）**：同一次装配内，本地写与远端 apply 命中同一订阅、同一容器，
   仅 origin 不同（`local` vs `replication`），且两者都到达（FIFO 序 `["local","replication"]`）。
   排除「复制 apply 不进 ROOT observeDeep」「session apply 被 origin 过滤」两种假设。
2. **schema 安装段可达性（AC2-A）**：`replaceSchema` 后 `getSchema().text` 切换为 V2 且 lease
   状态 `active`（探针 2 S5/S9）→ 证明 schema 安装段确实执行；同场旧订阅**继续投递** t5
   （S12=3）→ 证明缺口是「无终止编排」而非「订阅已死」。
3. **re-arm 前置 oracle（AC2-B）**：peer apply 结果携带 `schemaRearm.kind==='applied'`，peer
   指纹与 hub V2 指纹逐字节一致（探针 3 P10/P11）→ 证明红灯不来自「re-arm 未发生」或
   「update 未送达」；对照 = hub owned update 计数 1、peer `ok:true`。
4. **reset 编排时序（AC3）**：reset `ok:true` + archiveCalls=1 + lease `released`，而同场
   订阅零 `watch-end`（探针 4）→ 排除「reset 未执行」「租约仍活」两种归因；结合源码
   `watchHub.shutdown()`（closeAfterFence）与 `forceReleaseOutstandingLeases` 的同步顺序，
   定位缺口为**投递顺序需要设计裁决**（B-T3-3）。
5. **静默存活 vs 静默死亡对偶**：schema 路径 = 订阅**活着但语义失效**（探针 2）；doc 替换
   路径 = 订阅**被静默销毁**（探针 4）。两者都需要同一个流末条信号，且不得以 lease 释放
   通道（静默）代替。
6. **入口/环境反证**：根 typecheck exit 0、#369 33/33、#387 21/21（同 HEAD、同 worktree）
   → 红灯不可能来自工具链或装置；`vitest list` 实采集（§14）证明入口真实。
7. **断言敏感度（设计论证，实现后由 mutation 复核）**：若实现把 `watch-end` 直接同步调用
   listener（绕过队列）→ C8「watch-end 为末条 + 零 data 后置」红；若终止后继续投递 →
   C6「终止后静默」红；若用错 reason → C3/C5 的 reason 逐字断言红；若把终止挂到数据缺席/
   删除 → NC5 红；若引入 origin 过滤 → NC3 红。

## 10. Impact surface

| 面 | 预计改动 | 约束 |
|---|---|---|
| `packages/namespace-runtime/src/watch-map.ts` | `watch-end` 入队（复用订阅 FIFO 队列）、终止后静默/注销语义、`terminateAll(reason)` 形态的编排入口、与 `shutdown` 的分工 | 不得改变 data/invalidate-all 既有语义；回调仍逐条 try/catch 隔离；通知仍不含值 |
| `packages/namespace-runtime/src/runtime.ts` | 构造栈把 watch hub 传给 schema 安装段与 reset 关闭链（V3c''''/V3d'' 位）；`closeAfterFence` 的静默 shutdown 与显式终止的次序 | 公共面零新增键（runtime 15 键不变） |
| `packages/namespace-runtime/src/schema-write.ts`（S5.5）/ `schema-rearm.ts` / `replication-session.ts`（R5.6） | 安装/切换成功后的 `watch-end: 'schema-changed'` 编排（同段、事务提交后、`await notifyDirty` 之前） | 位置不得进事务栈；不得改变 fatal/ACK/dirty 语义（ADR 0018 §1） |
| `packages/namespace-registry/src/registry.ts`（reset 槽）/ `lease.ts` | doc 替换一族（reset）的终止编排与 lease force-release 的前后关系（**依赖 B-T3-3 裁决**） | lease 16 键不变；released 通道语义不变；reset 槽既有冻结次序（fence → closing → archive）不得被破坏 |
| 冻结面（零改动） | `readData` / 窗口读 / 复制协议与 session 公共面 / 诊断日志 / wire / 持久化 / 既有通知三 kind 形状 | §12.6 红线；NC1–NC6 |
| 测试面 | 新契约两件（fixture + 行为契约，§12.4）；实现前为红 | 不得 skip/only/todo、不得 env override、不得源码字符串断言 |
| 文档面（T5 #391 正位） | CONTEXT 词条已在（HEAD）；skill / 集成指南属 T5 | 本票零文档改动 |

## 11. Ruled-out hypotheses

| 假设 | 结论 | 反证 |
|---|---|---|
| 1. AC1（复制来源）在 HEAD 是能力缺口 | **排除** | 探针 1：复制 apply 经 lease `openReplicationSession` + `applyRemoteUpdate` 驱动，命中订阅并产出 `origin:'replication'`；本地写 `origin:'local'`（T1 D8 无过滤分类在产） |
| 2. `watch-end` 已实现，只是命名不同 | **排除** | §5.5：`watch-end`/`doc-replaced`/`schema-changed` 在 `packages/*/src` 只出现在类型联合字面量与注释；`watchHub` 未接入 schema/replication/reset 任一路径 |
| 3. 红灯来自环境 / 工具链 / 装置 | **排除** | 根 typecheck exit 0；#369 33/33、#387 21/21 同 HEAD 绿；探针在真实 Registry+Runtime+Yjs 上运行且前置断言（open/schema ready/replaceSchema ok/reset ok/re-arm applied）逐条为绿 |
| 4. 红灯来自 fixture 错误（写不进去 / schema 无效） | **排除** | 探针 2 S2 `replaceSchema` ok:true 且 `getSchema().text` 切换 V2；探针 2 S10/S11 在 V2 下写 `note` 成功并被新订阅收到；探针 3 P4 import ok / P7 写 ok |
| 5. peer 路径的「无 watch-end」是 re-arm 没发生 | **排除** | 探针 3 P10 `schemaRearm.kind==='applied'`、P11 peer 指纹 == hub V2 指纹 |
| 6. reset 路径「无 watch-end」是 reset 没执行 | **排除** | 探针 4 R2 `ok:true`、R5 archive 1 次、R6 lease released |
| 7. 终止信号可用 lease 释放通道（静默）代替 | **排除（规范）** | ADR §4 明示 `watch-end` 统一进通知流以保 FIFO，且备选节否决「onEnd 独立回调」；issue AC4 要求「流末条 + 此后静默 + unsubscribe 幂等」 |
| 8. 终止可绕过队列、直接同步调用 listener | **排除（规范）** | ADR §4 FIFO + §6 槽外异步分发；AC5 明示「不会先终止、后到僵尸 data 通知」 |
| 9. 契约可用源码字符串/正则断言替代行为验证 | **排除** | 全部断言锚 lease 公共面运行时的通知流对象与状态投影；§5.5 grep 仅作诊断证据 |
| 10. 该票可复用 T4（#390）的溢出/父路径删除编排 | **排除（范围）** | ADR §4 `invalidate-all` 触发源（溢出 / 父路径删除）属 T4；本契约仅断言「watch-end 之后无 invalidate-all」（B-T3-4） |

## 12. Acceptance contract and test paths

### 12.1 契约绑定表（SA1 冻结；语义断言不随绑定变化）

| # | 绑定 | 契约默认取值 | 依据 / 若 SA1 另择的处置 |
|---|---|---|---|
| B-T3-0 | 继承 #387 冻结的 B-1–B-7（方法名/回调位/单据形状/建立失败面/类型别名/通知形状/定位符） | 不变；T3 **零新增公共成员** | #387 SA6 §12.1；HEAD 实现（lease 16 键 / runtime 15 键） |
| B-T3-1 | `watch-end` 入队点 | schema 路径 = 安装/切换**成功后**、同槽 `await notifyDirty` 之前的同步段（本地 `schema-write.ts` S5.5 / peer `replication-session.ts` R5.6）；同事务已产出的 data 通知先于 `watch-end`（FIFO） | ADR §4 流末条 + §6 挂点；实测两段位置（P10/S2） |
| B-T3-2 | 【SA1 必裁】peer re-arm **失败**（fatal INVALID/INTERNAL）是否也发 `watch-end` | 默认**发**（终止因 = 已提交的 schema `text` 变更使谓词语义失效；与 re-arm 成败正交）；若 SA1 另裁，需同时说明「fatal 后订阅按旧 schema 存活」的消费方语义 | ADR 0018 §3（apply 仍 ok、tools 不动）；ADR §4 备选节（静默死亡被否决） |
| B-T3-3 | 【**承重，SA1 必裁**】doc-replaced（reset）的投递与 lease force-release 的顺序保证 | 契约默认 = `registry.resetReplica(...)` 结算时，reset 前已建立的订阅流**已含** `watch-end:'doc-replaced'` 且为末条。HEAD 结构（`watchHub.shutdown()` 静默 + 同步 `forceReleaseOutstandingLeases`）**结构性不可能**，必须由 SA1 冻结机制（例如 reset 槽在 force-release 前交付终止信号 / 终止项不被 lease 释放清队）。若 SA1 裁决「force-released lease 一律静默」，则 issue AC3 在 lease 公共面不可满足 → 回到设计门重裁（SA6 不得私自降级契约） | runtime.ts L633；registry.ts L1866；探针 4 |
| B-T3-4 | `invalidate-all` 与 `watch-end` 关系 | `watch-end` 之后零通知（含 `invalidate-all` 不后置）；终止前已入队的 `invalidate-all` 照 FIFO 先投递。T4 #390 的溢出注入语义不变 | ADR §4/§6；NC4 |
| B-T3-5 | 终止后重建语义 | schema-changed：lease 仍 `active`，消费方**重新 `watchMap`**（按新 schema 建立），旧 handle 恒幂等 no-op；doc-replaced：lease 已 released（`NamespaceLeaseReleasedError` 既有通道），重建 = 重新 open / import（Registry 编排）；**订阅生命周期只与 lease 和 schema 耦合** | issue AC4/AC6；探针 2 S9/S11、探针 4 R7/R8 |
| B-T3-6 | 滞留 data 的「必达」语义 | 默认**必达**：终止不丢已入队 data（`watch-end` 只是队尾追加），断言 = 终止前已提交事务的 data 全部先于 `watch-end` 到达。若 SA1 裁决终止可丢滞留 data，则降级为「零 data 位于 `watch-end` 之后」并回写本表 | issue AC5「watch-end 与滞留 data 同流有序」 |

**非目标（不得越界）**：谓词 `where` / `WATCH_MAP_OPTIONS_INVALID`（T2 #388）；`invalidate-all`
触发编排（溢出注入 / 父路径删除）与 runtime 键集纯加法（T4 #390）；文档面（T5 #391）；
lease 释放 / `deleteNamespace`（删除 ≠ 替换）的终止信号（ADR reason 词表封闭两值）；
数组载体订阅、含值通知、序号/对账（ADR v2）。

### 12.2 Issue AC ↔ 契约用例映射

| Issue AC | 用例 | 关键可观察断言 | HEAD |
|---|---|---|---|
| AC1 复制 apply → `data` 且 `origin:'replication'`；本地写恒 `'local'` | C1/C2 | 两笔各恰一条 `{kind:'data',origin,changes:[{path:['tasks'],key}]}`；origin 逐字；同流 FIFO；无过滤 | **绿（补锚）** |
| AC2 schema 变更 → 全存活订阅 `watch-end:'schema-changed'`（Hub 本地 + Peer re-arm 两路径） | C3/C4 | C3：`replaceSchema` ok 后流末条 = `{kind:'watch-end',reason:'schema-changed'}`；C4：re-arm 前置 oracle 绿（`schemaRearm.kind==='applied'` + 指纹一致）后同断言 | **红** |
| AC3 doc 替换（reset / import / genesis 一族）→ `watch-end:'doc-replaced'` | C5 | `resetReplica` ok（archive 1 次）后流末条 = `{kind:'watch-end',reason:'doc-replaced'}` | **红** |
| AC4 `watch-end` 是流末条：此后静默、已注销；`unsubscribe` 幂等 no-op | C6/C7 | 终止后「写 + 双预算屏障」零新增通知；`unsubscribe()` ×2 零 throw 零通知 | **红**（因终止信号缺席） |
| AC5 FIFO：`watch-end` 与滞留 data 同流有序 | C8 | 终止前多笔事务的 data 全部先于 `watch-end`；`watch-end` 下标 = 末位；终止后零 data | **红** |
| AC6 终止后消费方重建订阅行为正确 | C9/C10 | C9（schema-changed）：lease `active` + 新订阅按新 schema 建立并投递；旧订阅静默。C10（doc-replaced）：旧 lease released 通道 + 重新 open/import 后新订阅可用 | C9 部分绿（重建能力在产）；终止前置条件红 |
| AC7 全部经 lease 公共面可观察（零新接缝） | C11 | lease 恰 16 键、runtime 恰 15 键；通知 kind ⊆ 三 kind 闭集；零新增公共成员/零新子路径导出 | 绿 |

### 12.3 最小输入与期望（旧实现 vs 目标实现）

**共享 fixture 要素**（schema 与 #387 tracer 同族，可扩）：
`tasks: Record<string,Task>`（Y.Map 载体，物化 t1/t2）+ 封闭对象 `meta`；`Task = {title: YLeaf<string>; priority: YLeaf<number>}`；
V2 = `Task` 追加可选 `note?: YLeaf<string>`（**文本真变**——触发 re-arm / schema-changed）。

- **C1/C2 最小调用**：hub 角色装配 → `enableReplication()` → `openReplicationSession({localRole:'hub',remoteInstanceId:'peer-a'})` →
  `watchMap(['tasks'], sink)` → ① `mutateData(set tasks.t3)` ② `applyRemoteUpdate(bootstrap+新键 t4)` →
  期望 `[data(local,[t3]), data(replication,[t4])]`。
- **C3 最小调用**：hub lease + `watchMap(['tasks'])` → 本地写（屏障）→ `replaceSchema(V2)`（无 `root`）→
  期望流末条 `watch-end:'schema-changed'`，且终止前 data 先到。
- **C4 最小调用**：hub session `subscribeOwnedUpdates` 捕获 → hub `replaceSchema(V2)` → peer
  `applyRemoteUpdate(update)` → 断言 re-arm oracle（`schemaRearm.kind==='applied'` 且 peer
  `getActiveSchema().semanticFingerprint` == hub 新指纹）→ 断言 peer 流末条 `watch-end:'schema-changed'`。
- **C5 最小调用**：Replica stub 种子（META 身份）→ open → `watchMap` → 本地写（屏障）→
  `resetReplica(owner, ns, expectedLocalIdentity)` → 期望流末条 `watch-end:'doc-replaced'`。
- **C8 FIFO 构造（确定性配方）**：`watchMap` 建立后，**不等泵投递**连续提交若干事务
  （`await mutateData(...)` ×2–3；每笔提交后泵仍需 20 次微任务让步），随后立即
  `await replaceSchema(V2)`；断言 (i) `watch-end` 为流末条；(ii) 终止前已提交事务的 data
  通知计数 == 事务数（B-T3-6 默认必达）；(iii) 终止后零通知。**变异敏感度**：绕过队列的实现
  会先到 `watch-end`（(i) 红）；清队丢滞留 data 的实现 (ii) 红。

**旧实现（HEAD `28faeae`）对照**：C1/C2 绿（补锚）；C3/C4/C5/C6/C7/C8 首因统一 = 通知流中
**不存在 `watch-end`**（`sink.watchEnds().length === 0`，探针 2/3/4 逐例实测）；C9 的重建能力
在产但「终止后」语义不可达；C11 绿。任何以「lease 释放通道 / 独立 onEnd 回调 / 同步直调
listener」冒充的实现，会在 C6/C8（流末条与静默）与 C11（零新接缝）处同样红。

### 12.4 测试路径（**本轮未落盘**——Host dispatch 明确不作者可执行测试）

| 路径（计划） | 内容 | 采集 |
|---|---|---|
| `packages/namespace-registry/test/issue-389-change-subscription-t3-fixture.ts` | 共享 fixture：hub/peer 双 Registry 装配、replica-capable stub 持久化、`enableReplication`/`openReplicationSession`/`importReplica` 编排、update 捕获、Sink、终止屏障、readData 四键 helper 导入 | 非测试文件（不被收集） |
| `packages/namespace-registry/test/issue-389-change-subscription-termination-red.test.ts` | 主契约：C1–C11 + NC3/NC5/NC6 回归锚（NC1/NC2 由既有套件承担） | `packages/*/test/**/*.test.ts`（vitest.config.ts L15） |
| （不需要新的 `*.test-d.ts`） | T3 零新增公共类型/成员；`watch-end` 联合成员与 lease 别名已在 T1 类型契约（`issue-387-watch-map-lease-surface.test-d.ts`）冻结 | L20 既有 |

**实现切片落盘后的预期红灯**：C3–C8 全部红，首因统一为「订阅流无 `watch-end`」；
C1/C2/C9（重建）/C11 与 NC1–NC6 绿 —— 即红面精确落在「终止编排缺席」。

### 12.5 断言纪律与反伪绿防线

1. **精确形状**：通知恰三键 `{kind,origin,changes}`（data）/ `{kind,origin}`（invalidate-all）/
   `{kind,reason}`（watch-end）；`watch-end.reason` 逐字字符串相等（`schema-changed` /
   `doc-replaced`）；`data.changes` 定位符恰两键。全部 `toStrictEqual`。
2. **禁止伪红/伪绿手段**：零 skip/only/todo、零 env override（仓内标准
   `NODE_OPTIONS=--conditions=nomicore-source` 除外）、零吞错、零软化断言、零
   `expect.anything()`、零源码/正则字符串断言。
3. **每条用例的终止前置屏障**：用例先「等 `watch-end` 到达」（微任务预算 / `expect.poll` +
   屏障），使红灯首因统一；不得用「无 watch-end 也通过」的弱断言。
4. **oracle 不漂移**：schema-changed 的两条路径各自带前置 oracle —— 本地 = `getSchema().text`
   切换 + `replaceSchema ok:true`；peer = `applyRemoteUpdate.schemaRearm.kind==='applied'` +
   `getActiveSchema().semanticFingerprint` 双侧一致。oracle 红 = 装置问题（非契约红）。
5. **静默断言用屏障**：终止后的「零通知」= 提交一笔后续写 + 微任务双预算 + sink 计数不变；
   禁止 sleep 竞猜。
6. **readData 形状守卫门合规**：任何 `readData` 成功形状断言必须经集中化 helper
   `expectReadDataOkKeys`（`packages/namespace-runtime/test/helpers/readdata-ok-shape.ts`；
   先例 = #369/#387 契约），禁止内联四键/退役五键字面量（#333/#336/#364 验收门）。
7. **Yjs 确定性**：远端 update 一律 bootstrap live 状态 + 只写新键；同键并发写禁用。
8. **零新接缝**：全部断言只经 `registry.open/create/importReplica/resetReplica` +
   `lease.watchMap/getSchema/getActiveSchema/getStatus/mutateData/replaceSchema/openReplicationSession`
   公共面；不得读 runtime 内部或 Y.Doc。

### 12.6 实现期红线（交 SA1/SA3/SA7 复核，非本契约执行）

1. `readData` / 窗口读（`readArray`/`readMap`）/ 复制协议与 session 公共面 / 诊断日志 /
   wire / 持久化零改动（NC1/NC2 承重）。
2. 公共 API 仅经各包 `src/index.ts`；**lease 16 键、runtime 15 键不变**（T3 零新增成员——
   AC7「零新接缝」）。
3. **不得按 origin 过滤**（ADR §5 唯一不变量）；不得为终止引入 `onEnd` 独立回调或同步
   直调 listener（绕过队列即违反 FIFO）。
4. 终止信号必须走订阅 FIFO 队列、逐 listener try/catch 隔离、通知不含值；不得改变
   data/invalidate-all 既有形状与判定纪律（同值写过滤、宁多勿漏）。
5. 数据缺席 / 容器删除**不终结**订阅（NC5 承重）；lease 释放与 `deleteNamespace` 不加
   `watch-end`（reason 词表封闭两值）。
6. 不得为过契约修改本报告 §12.1 绑定；若 SA1 冻结不同取值（B-T3-2/B-T3-3/B-T3-6），
   只改 fixture 单点/断言表达并回写本表。

## 13. Red/green evidence

| 运行 | 命令 | 结果 | 日志 |
|---|---|---|---|
| 环境/输入核对 | `gh issue view 389 --json …`、`git rev-parse HEAD`、`git status` | comments `[]`；HEAD `28faeae`；零 tracked 修改 | `artifacts/sa6-issue389-probe-6-inputs-and-tree.log`、`artifacts/sa6-issue389-env.log` |
| 探针 1（AC1 origin） | `NODE_OPTIONS=--conditions=nomicore-source npx tsx packages/namespace-registry/.sa6-389/probe-1-origin.ts` | **exit 0**；`lease 16 键`；本地 `data(local,t3)`；复制 apply `data(replication,t4)`；`["local","replication"]`；watch-end 0 | `artifacts/sa6-issue389-1-origin.log` |
| 探针 2（AC2-A 本地 schema） | 同 tsx（probe-2-schema-local.ts） | **exit 0**；`replaceSchema ok`；active schema → V2；**watch-end 0**；旧订阅静默存活并在 V2 下继续投递（S12=3） | `artifacts/sa6-issue389-2-schema-local.log` |
| 探针 3（AC2-B peer re-arm） | 同 tsx（probe-3-schema-peer.ts） | **exit 0**；`importReplica ok`；peer session ok；hub owned update 1；peer apply `{ok:true,schemaRearm:{kind:'applied',…}}`；peer active → V2；**watch-end 0** | `artifacts/sa6-issue389-3-schema-peer.log` |
| 探针 4（AC3 reset/doc-replaced） | 同 tsx（probe-4-reset.ts） | **exit 0**；`resetReplica ok`、archive 1、lease released；**watch-end 0**；`unsubscribe ×2` no-throw；re-watch → `NamespaceLeaseReleasedError` | `artifacts/sa6-issue389-4-reset.log` |
| 探针 5（产出面 grep） | `grep -rn 'watch-end\|watchHub' packages/*/src` 等 | `watch-end` 仅类型字面量 + 注释；`watchHub` 仅 runtime.ts 4 处；schema/replication/reset 路径零 watch 引用 | `artifacts/sa6-issue389-probe-5-emission-sites.log` |
| 探针复跑（稳定性） | 同 4 条 tsx 命令各再跑 1 次 | **4/4 exit 0 且与首跑逐字节同构**（`diff` 空） | `artifacts/sa6-issue389-1-origin-rerun.log`、`sa6-issue389-2-schema-local-rerun.log`、`sa6-issue389-3-schema-peer-rerun.log`、`sa6-issue389-4-reset-rerun.log` |
| 基线（根 typecheck） | `pnpm typecheck` | **exit 0**（14 tsconfig 全过） | `artifacts/sa6-issue389-baseline-typecheck.log` |
| 基线（#387 T1 契约） | `vitest run .../issue-387-watch-map-tracer-red.test.ts --typecheck.enabled=false` | **21/21 绿**、exit 0 | `artifacts/sa6-issue389-baseline-387-contract.log` |
| 基线（#369 窗口读契约） | 同款（issue-369 文件） | **33/33 绿**、exit 0 | `artifacts/sa6-issue389-baseline-369-contract.log` |
| runner 采集 | `vitest list packages/namespace-registry --filesOnly` + `cat vitest.config.ts` | exit 0；#369/#387 两契约文件实命中（log L83/L84）；include 面见 §14 | `artifacts/sa6-issue389-runner-include.log` |

**旧实现失败点（目标契约首红位）**：`watch-end` 通知缺席（所有终止类用例 C3–C8 的首因 = 流中
不存在 `{kind:'watch-end',…}`）——红在「终止编排能力缺失」，不在环境、fixture、超时或入口；
C1/C2/C9(重建)/C11 与 NC1–NC6 绿，红面精确可控。

## 14. Runner trigger evidence

- **include 正则**（实读 `vitest.config.ts`）：L15 runtime `packages/*/test/**/*.test.ts`；
  L20 typecheck `packages/*/test/**/*.test-d.ts`；`tsconfig.typecheck.json` include
  `packages/*/test/**/*.ts`。
- **采集实证**：`NODE_OPTIONS=--conditions=nomicore-source npx vitest list packages/namespace-registry --filesOnly`
  → exit 0，清单含 `packages/namespace-registry/test/issue-369-window-read-lease-contract-red.test.ts`
  与 `.../issue-387-watch-map-tracer-red.test.ts`（`artifacts/sa6-issue389-runner-include.log` L83/L84）。
  计划路径 `packages/namespace-registry/test/issue-389-change-subscription-termination-red.test.ts`
  与既有两文件同目录、同 `*.test.ts` 后缀 → 同 glob 命中（fixture 文件为无 `describe/it` 的
  `.ts`，不被收集，先例 = #369/#387 fixture）。
- **零 skip/only/todo、零 env override**：计划契约文件不含 skip/only/todo；唯一环境量是仓内既有
  `NODE_OPTIONS=--conditions=nomicore-source`（非本契约引入）。

## 15. Unknowns and blockers

1. **【承重，SA1 必裁】B-T3-3 doc-replaced 的投递与 lease force-release 顺序**：HEAD 结构
   （`closeAfterFence()` 同步静默 `watchHub.shutdown()` + 同步 `forceReleaseOutstandingLeases`
   清队）使「reset 时把 `watch-end` 送达活订阅」结构性不可达。契约默认要求 reset 结算时
   订阅流已含末条 `watch-end:'doc-replaced'`；SA1 必须冻结机制（终止信号先于 force-release
   交付 / 终止项免于释放清队 / reset 槽内 await 终止投递）。若 SA1 裁决 force-released lease
   静默，则 issue AC3 在 lease 公共面不可满足 → 必须回设计门重裁（SA6 不降级契约文本）。
2. **B-T3-2 peer re-arm 失败语义**：fatal INVALID/INTERNAL 时是否仍发 `watch-end`
   （默认发）；SA1 冻结后写入契约。
3. **B-T3-6 滞留 data 必达性**：ADR §4 AC 文本读出为「同流有序且不被终止吞掉」；SA1 若允许
   丢弃滞留 data，C8(ii) 降级为「零 data 后置」。
4. **「bootstrap import / genesis 一族」的可观察场景**：`importReplica` 为**排他创建**
   （live entry / committed snapshot 在场 → `NAMESPACE_ALREADY_EXISTS`；见
   `packages/namespace-registry/src/types.ts` importReplica 契约与 phase-5 测试 AC-2），
   genesis = 新 doc 建立 → 两者在**订阅存在**的前提下结构性不可达；本契约把 doc-replaced
   的 lease 面可观察场景收窄为 **reset**，并把「import/genesis 亦须信号」的读法登记为待设计门
   澄清项（若需覆盖，须先指名可观察场景）。
5. **`deleteNamespace`（删除 ≠ 替换）是否发终止信号**：契约默认**不发**（ADR reason 词表封闭
   两值；lease 释放即静默终结，handle 幂等 no-op）。SA1 若另裁需回写。
6. **queue/`invalidate-all` 交互细节**（B-T3-4）：终止前已入队 `invalidate-all` 的投递顺位
   契约按 FIFO 先投；T4 #390 的溢出注入点不在本票范围。
7. **本轮未落盘可执行测试**（Host dispatch 约束）：契约以规格形式交付（路径/装置/断言/红灯
   首因/负控齐备），由实现切片落盘并自证红；SA6 红证据由 §5 探针实测承担。若下游要求 SA6
   直接落盘红灯契约，需 Host 解除该约束（改动仅 = 新增 §12.4 两文件，语义断言不变）。

**无阻塞项**：AC2/AC3 缺口在三条路径上稳定可证（探针 1–4，同 HEAD 重跑逐字同构）；
AC1 为已具备能力的补锚；负控 NC1–NC6 在 HEAD 全绿；契约规格可执行、入口真实、绑定面明确
→ 可在 SA1 冻结 §12.1（尤其 B-T3-3）后进入实现。

## 16. Temporary diagnostics cleanup

- **零生产实现改动**：`git diff --stat HEAD` 空；`git status --porcelain` 仅显示
  `packages/namespace-registry/.sa6-389/`（临时探针）、`artifacts/sa6-issue389-*.log`
  （证据保留）与 Host 既有输入 `wiki/raw/task_issue-389.md`（`artifacts/sa6-issue389-probe-6-inputs-and-tree.log`）。
- **临时诊断清理（收尾执行）**：`packages/namespace-registry/.sa6-389/` 整目录删除
  （harness.ts + probe-1..4），复核 `ls packages/namespace-registry/.sa6-389` → 不存在。
- **保留证据（仅日志）**：`artifacts/sa6-issue389-*.log`（环境/输入、4 探针、产出面 grep、
  runner、根 typecheck、#369/#387 基线）。
- **依赖复原说明**：本 worktree 起始无 `node_modules`；`pnpm install --offline --frozen-lockfile`
  经本地 store 复原（零下载），`node_modules` 为 gitignore，不入 tracked 产物、不影响实现面。
- **零服务/后台残留**：全部为同步脚本或有限时长 vitest 运行；无 nohup/setsid/PID 文件/轮询
  marker；收尾时后台 job（bash-8 = 根 typecheck）已结算、无遗留 Job。
- 收尾核对：本报告写入固定路径 `wiki/raw/task_issue-389_sa6_contract.md`；删除后 `git status`
  复核仅剩本报告 + 证据日志 + Host 输入。

---

## Verdict

**approve（附 SA1 冻结条件）** —— T3 的能力缺口稳定可证：`watch-end` 在两处 schema 安装段
（Hub 本地 `replaceSchema` S5.5 / Peer 复制 apply 槽 R5.6 re-arm）与 doc 替换一族（reset）三条
路径上**均零产出**（探针 2/3/4：`watch-end` 计数恒 0；探针 5：`packages/*/src` 内
`watch-end` 仅存在于类型联合字面量），且订阅在 schema 变更后**静默存活**（探针 2 S12：
旧订阅在新 schema 下继续投递）、在 reset 后**静默销毁**（探针 4）；AC1 的复制来源 origin
（`local` / `replication` 两态、无过滤）实测**在 HEAD 已具备** → 作为保持性验收补锚（NC3）。

契约规格可执行且可判：C1–C11 断言全部锚 lease 公共面运行时的通知流与状态投影（零新接缝，
lease 16 键 / runtime 15 键不变）；schema-changed 两路径各带**前置 oracle**（`replaceSchema ok`
+ `getSchema().text` 切换 / `applyRemoteUpdate.schemaRearm.kind==='applied'` + 指纹一致），
红灯不会被误归因于 re-arm 未发生或装置错误；C8 的 FIFO 断言按「`watch-end` 为末条 + 滞留 data
先达 + 终止后零通知」构造且对绕过队列/清队丢通知两类错误实现敏感；负控 NC1（#387 21/21）、
NC2（#369 33/33）、NC3–NC6 在 HEAD 全绿，根 `pnpm typecheck` exit 0，runner 采集实证通过。

**实现前置条件**：SA1 必须冻结 **B-T3-3（doc-replaced 投递与 lease force-release 顺序保证）**；
并顺带冻结 B-T3-2（re-arm 失败是否终止）与 B-T3-6（滞留 data 必达性）。冻结结果需与本报告
§12.1 对账后回写；若 SA1 裁决与默认取值不同，只需改测试侧单点（fixture 编排/断言表达），
语义断言（三 kind、流末条、reason 逐字、零新接缝）不变。

**本轮交付边界（Host dispatch）**：只建立诊断与验收契约，**未实现生产代码、未作者可执行测试**
（§1/§12.4/§15-7）；红证据由 §5 探针实测承担，契约文件路径与断言已冻结待实现切片落盘。
