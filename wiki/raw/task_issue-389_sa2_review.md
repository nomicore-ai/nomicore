# SA2 设计攻击评审 — issue #389：复制来源与订阅终止（变更订阅 T3）

- 评审轮：2026-09-15（**iteration 1**；被审对象 = SA1 修订版设计 `wiki/raw/task_issue-389_design.md`（iteration 1，原位修订）；既往输入 = 本文件 iteration 0（reject，1 × MAJOR F-1））
- 评审方法：独立实读源码（watch-map.ts 488 行全读、runtime.ts 构造栈/关闭 admission/close()/公共面、schema-write.ts S1–S6、replication-session.ts fanout/R4/A3/R5–R7、schema-rearm.ts 入口、registry.ts idle-close/forceRelease/reset 槽/delete/shutdown、lease.ts 16 键面、index.ts、internal.ts、两键集守卫、phase5 fence r2 与 replication-session round2 测试锚）、ADR 0030/0018/0010(#133 round-2 修订节 L279–291) 全文、CONTEXT L65–67、SA6 契约与 15 份探针日志索引；对 F-1 修订的 8 处落点逐一独立复核；不运行测试、不实现。
- 结论速览：**verdict = approve**。iteration 0 唯一阻断项 **F-1 已完整解决**（§7-D5-b 共享同步首步 `fanout.terminateAll('runtime-close')` 上提至分型之前、两种风味显式保持，与 runtime.ts L628–635/L866–878 现状及 runtime AGENTS「close() … terminates live sessions」逐字一致；修订已一致传播至 §3.1/§3.3/§5-B-T3-3/§10/§11/§12/§13 八处，§12 新增回归锚引用的测试族实存且断言内容核实无误）。B-T3-3 承重机制（终止先于 force-release 入队 + 投递结算并入 close 承诺 + registry 零改动）再次独立核验**成立**；修订未引入新的 BLOCKER/MAJOR。剩余仅非阻断观察（见 §14）。

---

## 1. Reviewed inputs

| 输入 | 状态 | 核验方式 |
|---|---|---|
| `wiki/raw/task_issue-389.md`（Host brief，AC1–AC7，评论 0 条） | 在场 | 实读 |
| `wiki/raw/task_issue-389_design.md`（SA1 设计 **iteration 1**，含 §14 评审修订映射） | 在场 | 逐节实读 + 源码逐点对账（本轮重点 = F-1 修订八处落点） |
| `wiki/raw/task_issue-389_sa2_review.md`（本文件 iteration 0：reject，F-1 MAJOR + N-1–N-5） | 在场 | 原位更新为本轮结论 |
| `wiki/raw/task_issue-389_sa6_contract.md`（approve 附 SA1 冻结条件） | 在场 | 实读；C1–C11/NC1–NC6/B-T3-0–6/§12.6 红线逐条对照 |
| `wiki/raw/task_issue-389_relevant_decisions.md`（SA8 摘录） | 在场 | 实读；与 ADR 原文抽检一致（本轮含 L138–139 close admission 现状记载） |
| `wiki/raw/task_issue-389_conflict_report.md`（SA8 clear，requiresConflictRecheck=true） | 在场 | 实读 |
| 源码（runtime / watch-map / schema-write / schema-rearm / replication-session / registry / lease / close 相关 / index.ts / internal.ts） | 在场 | 独立实读（本轮重读，行号与修订版设计逐点核对） |
| `docs/adr/0030-change-subscription.md`、`docs/adr/0018-peer-schema-rearm.md`、ADR 0010 #133 round-2 修订节（L279–291） | 在场 | 全文实读 |
| `CONTEXT.md` L65–67（变更订阅词条） | 在场 | 实读 |
| 测试锚（`registry-open.test.ts` 16 键、`runtime-phase5-reset-fence-r2.test.ts` 15 键 + T2 双向 same-promise、`runtime-replication-session-round2.test.ts` R2-2 族） | 在场 | 实读断言（F-1 回归锚真实性核验） |
| `artifacts/sa6-issue389-*.log`（15 份） | 在场 | `ls` 核对；`packages/namespace-registry/.sa6-389/` 保持不存在（本轮 `ls` 复核） |
| issue #389 owner 评论 | **0 条**（dispatch 明示 REST 实读空数组；brief/SA6 §2/探针 6 一致） | — |

---

## 2. Verdict

**approve** —— iteration 1 设计可安全进入实现。F-1（iteration 0 唯一 MAJOR）已按修订要求完整解决且未留残余矛盾：规范伪代码与自身事实陈述、HEAD 源码（runtime.ts L628–635 共享 admission 首步 `fanout.terminateAll('runtime-close')` → `watchHub.shutdown()` → `lazyCloseBarrier()`；公共 `close()` L866–878 同步迁移 + 共享入口 + R2-2 注释 L873–875）、runtime AGENTS「`close()` synchronously stops acceptance, terminates live sessions, drains accepted slots, releases exactly once」三方一致；「现状逐字保持」注记更正为「fanout 终止 + 静默收口（缺一即非现状）」并附「为何共享首步不可省」根因段；§12 增列的回归锚（`runtime-replication-session-round2.test.ts` R2-2 族 L425/L438–479 + phase5 fence 契约族 L199/L204/L217）经实读全部实存且断言内容与描述逐字相符。B-T3-3 承重机制、B-T3-0–B-T3-6 冻结值（全部 = SA6 默认）、D1–D6 机制可行性、registry/lease 零改动主张、ADR 0010 #133 冻结次序与 ADR 0018 槽语义相容性，本轮独立复核全部维持 iteration 0 的成立结论。N-1–N-5 逐条有落点（§7-D5-b 实现注记 / §13 follow-up 登记 / §7-D3 不对称注记 / §7-D5-c 补述 / §12 升格优选落盘）。无 BLOCKER、无 MAJOR；`pass` 后续仍须 SA4/SA7 对实现与活链路验证，SA8 requiresConflictRecheck=true（实现后按 §8-3 ①–⑦）不受本裁决影响。

---

## 3. 需求覆盖

| Requirement（issue AC） | Design section | Assessment |
|---|---|---|
| AC1 复制 apply → data + `origin:'replication'`；本地恒 `'local'` | §1-1、§4（已具备行）、§12 AC1 行 | **覆盖正确**（本轮复核维持）。`classifyOrigin`（watch-map.ts L305–308）无过滤；`onRootTransaction` 对集合内全部订阅投递（L383–388），复制 apply 经 per-session symbol（replication-session.ts L408/L764）结构性直达。零新实现 + NC3 回归锁 + C1/C2 补锚成立。 |
| AC2 schema 变更 → 全部存活订阅 `watch-end:'schema-changed'`，两路径 | §5-B-T3-1、§7-D3（本地）/§7-D4（peer） | **覆盖正确**。挂点本轮再次实读核实：本地 = schema-write.ts S5.5 `sync.kind !== 'installed'` 判定（L291–306）之后、S6 `await notifyDirty()`（L308–310）之前；peer = replication-session.ts R5.6 `text` 不等块内（L803）、re-arm 结局与 failed-diag 配对（L814）之后、R6（L819/824）之前。hub 角色会话经 R4 受保护字段检查结构性不可能携带 SCHEMA 变化（`RAW_PROTECTED_FIELDS.hub.schema=true`，L375–378），无需第三挂点——正确。 |
| AC3 doc 替换 → `watch-end:'doc-replaced'` | §5-B-T3-3、§7-D5、§15-4 | **覆盖正确**。registry reset 槽 ⑥ 次序本轮重读核实（L1860 cancelIdleArm → L1865 `closePromise = fence.startCloseAfterFence()` → L1866 `forceReleaseOutstandingLeases` ——同一 try 块同步段零 await → L1884 await closePromise → L1895 archiveDoc → L1902 返回）：终止入队先于 force-release 的排序在既有 registry 代码上零改动成立；mismatch/missing 零破坏期不终止（L1852–1853 先返回）。import/genesis 收窄为 reset 的论证维持（排他创建/新 doc ⟹ 订阅在场时结构性不可达），与 SA6 §15-4、SA8 行 2 一致。 |
| AC4 流末条静默 + `unsubscribe` 幂等 no-op | §7-D1-1、§7-D2 | **覆盖正确**。terminated 摘除出集合 ⟹ `onRootTransaction` 结构性零入队（L383 迭代不到）；`unsubscribe` 首行 terminated 检查 → no-op（不清队），与 lease 层双幂等包装（lease.ts L354–360）兼容：lease 包装仍摘 `activeWatches` 登记，仅 hub 侧 no-op。 |
| AC5 FIFO（watch-end 与滞留 data 同流有序） | §7-D1-2、§7-D2、§9 | **覆盖正确**。单写者序列论证与源码相符：data 在槽内事务观察器同步入队（observeDeep 事务提交同步回调）；终止项同槽/同 admission 同步段队尾追加；泵 L318–341 单飞微任务逐项 FIFO（L319 单飞守卫、L325 让步后重检、L338 finally 与退出检查同同步段无丢失唤醒）；唯一清队点（退订 L471、shutdown L483、溢出 L405）均不触及 terminated 队列。 |
| AC6 终止后重建 | §5-B-T3-5、§12 C9/C10 | **覆盖正确**。schema-changed 后 lease active、重建按 S5.5 已安装的新 tools（installActive 先于 terminateAll 入队）；doc-replaced 后 released 通道（探针 4 R8）→ 重新 open/import。 |
| AC7 零新接缝 | §7-D6、§3.4 | **覆盖正确**。本轮实读：index.ts 值导出恰 `RuntimeWriteFatalError` 一键（L56）、watch 三类型 type-only（L79–83）；`internal.ts` 零 `SchemaWriteEnv`/`RuntimeReplicationHost`/`WatchHub` re-export（grep 核实）——hub 接口方法与 env 字段加法均为包内模块面。两键集守卫在场：registry-open.test.ts L935–943 十六键含 watchMap（L942）；phase5 r2 L127–150 十五键 + non-enumerable + index 一键（L151）。 |

目标与非目标未被静默扩大：非目标逐项对齐 SA6 §12.1（T2 谓词/T4 溢出编排/T5 文档/deleteNamespace 终止信号/数组载体），iteration 1 修订未越界承接。

## 4. Owner评论覆盖

| Comment ID | Updated at | Design section | Assessment |
|---|---|---|---|
| —（评论数 = 0；dispatch 明示 REST 实读空数组，brief 与 SA6 §2/探针 6 一致） | — | §2（设计自证无 owner 条款） | 无 owner override、无范围收缩。需求源 = issue body + ADR 0030 §4/§6 + ADR 0018 + CONTEXT 词条，设计逐条落点；F-1 修订不触碰 owner 需求面（设计 §2 同款结论，核实成立）。 |

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| ADR 0030 §4 L51：三 kind 封闭、`watch-end {kind,reason}` 两 reason、流末条、终结三因封闭、数据缺席/删除从不终结 | §7-D1（两键冻结字面量）、§7-D2（静默结构性） | 一致（ADR L43–53 本轮重读）；实现为产出既有联合成员（watch-map.ts L67），非扩词表。 |
| ADR 0030 §5：绝不按 origin 过滤 | §1-AC1、§12 NC3 | 一致；classifyOrigin 零改动。 |
| ADR 0030 §6：挂点 = 事务提交后异步分发、三来源全覆盖、throw 静默隔离、有界队列 | §7-D1/D3/D4/D5（容量豁免仅限终止项） | 一致。溢出清队只在 data 入队路径（L404–406），terminated 订阅已无 data 入队点——豁免与溢出语义不冲突。 |
| ADR 0030 §7：runtime 承担终止编排；registry 仅公共面；通知不出进程 | §7-D5（registry.ts/lease.ts 零改动） | **独立核验成立**：reset 槽既有次序已满足「终止先于 force-release 入队」（L1865/L1866 同步 try 块），仅 close 承诺内部组成变化，registry 零 diff 可行。 |
| ADR 0030 备选 L80/L85/L86 否决项 | §9 Alt-1/Alt-2；D4/B-T3-2 | 一致；未复活任何否决形态（onEnd 独立回调 / schema 变更作通知 kind / origin 'admin'）。 |
| ADR 0018 §1：R5.6 同步段位置、零新槽类型、零插队 | §7-D4（R5.6 块内、R6 前、`void` fire-and-forget） | 一致（ADR L26–38 重读；插入点 L803–819 实读核实）；槽结果联合/dirty/ACK 语义零漂移。 |
| ADR 0018 §3：re-arm fatal 双码、tools 不动、apply 不回滚 | §5-B-T3-2（失败也发 watch-end） | 一致（= SA6 默认）。终止因 = 已提交 text 变更使旧谓词语义失效，与 re-arm 成败正交；R4 残余（fatal 后重建按旧 tools）诚实登记 §13。 |
| ADR 0018 §4：不加 lease 级 promise/事件 | §7 全部经 watchMap 通知流 | 一致；零 observer 借道。 |
| ADR 0010 #133 round-2：fence 槽绝不创建/等待 barrier；懒 continuation 才建唯一 barrier；此后归档；公共 close 同一 promise 不建第二 barrier | §5-B-T3-3 约束核验、§7-D5 | **一致**（本轮重读 ADR L283–285 + 源码）：fence 槽本体零改动（L462–484）；终止入队发生在 `startCloseAfterFence()`（fence 槽结算后的 lazy continuation = ADR 明文允许创建 barrier 的层）；barrier 本体（enqueueCloseBarrier）不变且恰创建一次；`await closePromise` 先于 archive（L1884→L1895）；「同一懒创建 close promise」经 D5-c 承诺缓存持完整 admission 承诺保持（phase5 T2 双向 same-promise 断言 L199/L204/L217 为既有锚——本轮实读核实断言存在且将锁住该行为）。 |
| ADR 0008 修订节槽序 + runtime AGENTS：单一 FIFO、槽序不变、**close 同步终止 sessions** | §7-D1（入队槽内/投递槽外）、§7-D5-b | **F-1 已解决**：D5-b 共享同步首步在两种风味中显式画出并与 runtime.ts L628–629/L866–878、AGENTS 契约、R2-2 注释（L873–875）一致；§12 回归锚行真实。 |
| ADR 0009 #134 + deleteNamespace 修订节：release 幂等/released 通道/删除≠替换 | §7-D2、§5-B-T3-5/§15-5 | 一致；退订 no-op 不改 release 语义；delete/shutdown/idle close 的 watch 订阅静默保持（§15-5 表述消歧后不含 session 终止——fanout 终止照常，两概念不再混读）。 |
| ADR 0011/0014、0027/0028、0023、模块 AGENTS | §11 DENY LIST、§12 NC2/C11 | 一致；读面/诊断面/协议面零接触。 |

SA6 探针证据与源码事实无矛盾（本轮 8 组锚点复核一致，含 close admission 现状 = F-1 证据的再次确认）。

---

## 6. 设计内部一致性

| # | 检查点 | 结果 |
|---|---|---|
| C-1 | §3.1/§3.3 对 `closeAfterFence` 现状的描述 | **与源码一致且两节自洽**（L628–635：fanout.terminateAll → watchHub.shutdown → lazyCloseBarrier；L866–878 close() 同步迁移 + 共享入口；L615–623 lazyCloseBarrier 幂等缓存；L488–495 startCloseAfterFence 懒 continuation）。iteration 0 的 C-2 矛盾（§7-D5-b vs §3.3）消除。 |
| C-2 | §7-D5-b 修订版伪代码 vs HEAD 现状 vs AGENTS | **一致**：共享首步 `fanout.terminateAll('runtime-close')` 上提至分型之前（两风味共同逐字保持）；正常风味 = fanout 终止 + 静默 `watchHub.shutdown()`（注记「缺一即非现状」——正确）；reset 风味 = 同一首步 + `watchHub.terminateAll('doc-replaced')` + 投递结算并入 close 承诺。「为何共享首步不可省」根因段引用的行号/注释（L628–629、L873–875、registry 消费点 L1145/L1992/L2148）逐点实存。 |
| C-3 | §5-B-T3-3 机制枚举（⓪ 共享首步 + ①②③④）vs ADR 0010 #133 与源码 | 一致；⓪ 为 F-1 修订新增并标注「现状保持」，与 ①–④ 的排序论证无冲突（fanout 终止与 watchHub 终止作用对象分立、幂等汇合）。 |
| C-4 | D5-c「缓存持完整 admission 承诺 + 第二入口不重跑风味体」与现状赋值点（lazyCloseBarrier L621、close() L876） | 可实现且不变量保持：reset 风味内 lazyCloseBarrier 先落 raw barrier 后同步覆写为 wrapped，全程同步无交错；「close()/startCloseAfterFence 同一实例」双向由 phase5 T2（L196–205 close 先行 `startP === closeP` + 幂等 close；L208–219 fence 先行 `closeP === startP`）既有断言锁死——本轮实读核实。 |
| C-5 | D2 状态机表 vs 泵实现（L318–341） | 一致：terminated 订阅 `unsubscribed` 恒 false ⟹ 排空至队空自然收尾；`finally` 中 `terminated && queue.length===0` → resolve drain 承诺恒可达（terminateAll 必然入队终止项 ⟹ 泵必有工作）。 |
| C-6 | D1-4 幂等语义 vs 快照迭代 | 一致（摘除后天然不重复；二次变更终止重建后的新订阅）。 |
| C-7 | §8 数据流表 vs §7 决策；§10 调用方矩阵 | 一致；close 路径行（§10）现状/设计后描述与 D5-b 完全对齐（iteration 0 的 F-1 所在行已修正）。 |
| C-8 | §12 验收映射 vs SA6 §12.2/§12.3 + 新增 F-1 回归锚行 | 一致；新锚引用的 `runtime-replication-session-round2.test.ts` L425（conflicted 不降级）/L438–479（R2-2 族：close 后终态 closed、apply → `RUNTIME_WRITE_DISABLED` 且文案含「close 已停止接纳会话 apply」、重复 close 同实例、终态 throw）与 phase5 L199/L204/L217 本轮实读全部实存且与描述逐字相符。 |
| C-9 | 死引用/旧 API/失效表述扫描 | 未发现。C4 failed 分支断言可行性成立（peer 角色放行 SCHEMA 变化——`RAW_PROTECTED_FIELDS.peer.schema=false`，损坏 text 可经 R4 直达 R5/R5.6 构造 fatal）。修订版头部明示「失效表述已删除/改写」，抽查 §3.3/§10/§13 无残留旧表述。 |
| C-10 | §14 评审修订映射 vs 实际修订 | **逐条核实**：F-1 行列出的 8 处落点（§7-D5-b/D5-c、§5-B-T3-3、§3.1、§10、§11-②、§12、§13-R5/R6）全部在场且内容正确；N-1–N-5 处置与正文落点一一对应。 |

## 7. 状态机与并发攻击

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| S-1 | 活跃订阅 ×N，S5 事务已提交、泵在 20 微任务让步中 | `replaceSchema(V2)` S5.5 `terminateAll('schema-changed')` | 滞留 data 全部先于 watch-end（FIFO），此后零通知 | 无缺口：入队序 = 槽内同步序（observeDeep 事务提交同步回调先于 S5.5 同步段）；泵 FIFO；单飞守卫与重检同同步段（L338）无丢失唤醒。终止项入队时泵在让步中：push 后 schedulePump 为 no-op，泵于 L325 重检见新项继续投递——恰一个泵 continuation、无重复投递 | — |
| S-2 | terminated 订阅在途投递 | 消费方 `unsubscribe()`；lease force-release 遍历退订；reset 路径 `shutdown()` | 均不清队、投递继续（B-T3-6） | 无缺口：D2 no-op 覆盖前两者（lease 包装层照常摘登记，hub 侧 no-op——lease.ts L354–360 兼容）；shutdown 只作用于集合内存活订阅（terminated 已摘除）；`enqueueData` 对 terminated 不可达 | — |
| S-3 | 终止投递窗口内 listener 重入（重新 watchMap / 再写） | C9 场景 | 新订阅独立对象独立泵；旧 terminated 不受影响 | 无缺口：D1-4 + §9；lifecycle/schemaState 门照常裁决 | — |
| S-4 | reset：fence armed（lifecycle='closing'）与 `startCloseAfterFence()` 之间 | 并发公共 close()（idle/delete/shutdown 发起）抢首调用 | 风味由首调用者固定，无双重 admission | 无缺口（本轮再次结构性核验）：idle close 被 `entry.phase!=='idle'` 门挡（registry L1141）；delete/reset 同 key carrier FIFO 串行（admitResetSlot L1721–1726 / admitDeleteSlot L1909–1911）；shutdown 先逐 key await carrier tail（L2130）。F-1 修复后两种风味均含 fanout 终止——本窗口不再有 session 终止缺口 | — |
| S-5 | schema 槽已接纳、close() 先行（lifecycle='closing'）后槽排空 | S5.5 在 closing 期执行 `terminateAll` | 零副作用（集合已被正常风味 shutdown 清空） | 无缺口：terminateAll 对空集合立即 resolve | — |
| S-6 | 连续两次 schema 变更 | `terminateAll` 二次调用 | 各订阅恰一条流末终止项；第二次终止重建后的新订阅 | 无缺口（D1-4 快照迭代 + 摘除语义） | — |
| S-7 | peer apply 槽已接纳、fence 后排空（barrier 前驱） | R5 data 入队 + R5.6 终止 | 同槽 FIFO：data 先、watch-end 后 | 无缺口：apply 槽先于 fence 任务执行（FIFO）；终止在 admission 层晚于一切已接纳槽；fence 后新 apply 被 A3 lifecycle 门拒（replication-session.ts L546–551 本轮实读核实） | — |
| S-8 | reset 终止已入队、barrier 排空中 | barrier 期间 ROOT observer 仍挂接（reset 风味 shutdown 后置） | 零僵尸 data | 无缺口：terminated 已摘除（observer 迭代不到）+ `watchMap` 门①（watch-map.ts L418–421）在 'closing' 拒新订阅 | — |
| S-9 | reset：mismatch/missing（零破坏期） | fence 槽判 mismatch | 不终止，订阅照旧存活 | 无缺口：terminateAll 只挂在 armed 后的 admission（registry L1852–1853 先返回；ADR 0010 #133「零破坏性动作」相容） | — |

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| E-1 | listener 在 watch-end 投递时 throw | 泵逐投递 try/catch（X1）静默隔离；drain 承诺照常 resolve | 无（沿 T1 交付形态） | — |
| E-2 | `terminateAll` 自身异常 | 纯同步无抛点结构保证（集合/队列/冻结字面量操作；schedulePump 起异步函数不同步抛） | 无 | — |
| E-3 | close barrier reject（handle.release 失败 → NamespaceRuntimeCloseError） | reset 风味 `.then` 成功臂不执行：admission 承诺 reject → registry §⑥ catch → lifecycle-slot-failed + branded fatal（L1883–1889 现状保持）；终止项仍经独立微任务泵送达；仅防御性 `watchHub.shutdown()` 被跳过 | 低（防御性收口缺席 = 良性；D5-b 实现注记已明示并禁止补出可 reject 的第二链） | — |
| E-4 | reset armed 后 archive 失败 | 终止项已投递（await closePromise 先于 archive）；reset 返回 RESET_FAILED/fatal | 低（语义注记）：消费者收到 'doc-replaced' 而旧 doc 字节仍在。可接受（fence armed + close 已毁灭 generation 与全部 lease；重建后重拉自愈）；设计 §13 已登记为 T5 #391 措辞输入 | — |
| E-5 | pump 意外死亡（结构性不可达） | drain 承诺可能悬挂 → reset 承诺悬挂 | 极低（外层 catch L334 + finally 兜底） | — |
| E-6 | 终止投递结算的有界性 | ≤(capacity+1)×20 微任务/订阅、并发泵、无墙钟无 I/O | 无 | — |
| E-7 | S5.5 不可达防御分支（S4 已编译成功） | 不发终止（fatal 结算逐字不动） | 极低（R3 已登记） | — |

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| 公共 `close()`（idle close L1145 / deleteNamespace ④ L1992 / shutdown L2148 的消费面）与 `startCloseAfterFence()` 共享 admission | **无（F-1 已解决）**：修订后伪代码两风味均以 `fanout.terminateAll('runtime-close')` 为共享同步首步；正常风味保留静默 `watchHub.shutdown()`；「现状逐字保持」注记更正；§12 增列 R2-2 族回归锚 | runtime.ts L628–635（共享首步现状）vs 设计 §7-D5-b 修订版——一致；L866–878（close() 同步迁移 + 共享入口 + R2-2 注释）；`runtime-replication-session-round2.test.ts` L425/L438–479（回归锚实存） | — |
| `applyRemoteUpdate` 结果联合（含 `schemaRearm`） | 无（副作用新增：text 变化时 peer 订阅终止；形状/语义零改动） | replication-session.ts L859–863 结果组装零改动 | — |
| `resetReplica` 调用方 | 无（结算时序多含一段有界投递；archive 时序不变） | registry L1884/L1895；R1/R6 | — |
| watchMap 消费方（lease） | 无（watch-end 首次投产；重建指引归 T5 #391） | §10 行 1 | — |
| `unsubscribe()` 调用方 | 无（非 terminated 行为逐字不变；terminated no-op = AC4 本义） | watch-map.ts L466–475；lease.ts L354–360 | — |
| phase5 fence 契约（close/startCloseAfterFence same-promise 双向、barrier 恰一次、release 恰一次） | 无：D5-c 不变量与 T2 断言逐字兼容（wrapped 承诺对两入口同一实例；barrier 仍经 lazyCloseBarrier 恰创建一次） | runtime-phase5-reset-fence-r2.test.ts L196–219（本轮实读：`startP === closeP` / `close() === closeP` / `closeP === startP` / releaseCalls===1） | — |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| 终止编排（入队/注销/投递结算） | runtime（ADR 0030 §7） | watch-map.ts + runtime.ts 构造栈/关闭 admission | 正确；hub 接口方法为包内模块面（index 零 re-export + internal.ts 零泄漏，本轮 grep 核实）。 |
| lease 公共面/释放清理 | registry（lease.ts） | 零改动（既有遍历退订对 terminated no-op） | 正确；无双写第二状态。 |
| reset 槽编排/force-release | registry 既有冻结次序 | 零改动（排序已天然满足，L1865/L1866 同步段核验） | 正确。 |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| 扇出终止（session） | `fanout.terminateAll('runtime-close')`（replication-session.ts L327–332：迭代 finalize、幂等、conflicted 终态不降级——本轮实读） | `watchHub.terminateAll(reason)`（快照注销 + 队尾追加 + 结算承诺） | 一致（同形异义，命名先例沿 `terminateAll`）；差异（追加通知 vs 静默 finalize、返回结算承诺）由 ADR 0030 §4 流末条义务正当化 | — |
| 微任务泵/有界队列 | `createSessionFanout.schedulePump`（容量 16 + 20 微任务让步） | watch 泵复用同款（L98/L103） | 一致（T1 已建立） | — |
| schema 安装共享段接线 | #286 `compile` 字段进 env（runtime.ts L611 / replication-session.ts L351 先例实存） | `watchHub` 字段进 SchemaWriteEnv/RuntimeReplicationHost | 一致（INV-N14 捕获局部量纪律延续；D5-a 构造序微调纯语句序） | — |
| 事务后同步段挂点 | S5.5/R5.6 既有段位 | 终止入队进同段、投递槽外 | 一致 | — |

未找到可比实现时已如实记录（`watch-end` 产出为本能力首建，仓内无先例——SA6 探针 5 同证）。

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 订阅存续状态 | hub `subscriptions` 集合 + `unsubscribed`/`terminated` 标志（单点） | lease `activeWatches` 登记（清理通道，非状态镜像） | 无新增漂移。 |
| close admission | runtime `closePromise` 单缓存（D5-c 持完整 admission 承诺；第二入口不重跑风味体） | registry `entry.closePromise`（I2 记账，既有） | 无新增漂移；风味由首调用者固定且双向结构性闭合（S-4）。 |
| schema 身份 | state.activeTools/activeInfo（installActive 单点） | 终止信号只引用 reason 字面量 | 无。 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| watchMap 登记（集合 + lease 登记） | unsubscribe / lease 释放清理 / terminateAll（三路均幂等收敛） | 终止不可逆、重建即恢复（AC6） | 对称。 |
| observer 挂接（构造期一次） | shutdown 摘除（幂等） | reset 风味后置到投递结算后；barrier reject 时跳过（N-1 良性，已入设计注记） | 可接受（防御性收口）。 |
| close admission（幂等缓存 + 共享 fanout 首步恰执行一次） | barrier release 恰一次 | reject 双通道（closeIssue + CloseError） | 既有不变量保持（F-1 修复后两风味一致）。 |

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 第二套投递通道（终止专用） | 订阅 FIFO 泵 | 复用（队尾追加 + 既有泵） | 无平行机制。 |
| registry/lease 侧清队豁免 | — | 不采用（Alt-4 否决） | 正确。 |
| onEnd 独立回调 | — | 不采用（Alt-2） | 正确。 |
| 诊断日志承载终止 | — | 不采用 | 正确。 |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW：watch-map.ts / runtime.ts / schema-write.ts / replication-session.ts + 2 个新测试文件 | §7-D1–D6 改动落点全部在四源文件内（本轮逐项复核：D1/D2→watch-map；D5-a/b/c→runtime；D3→schema-write（含 `import type` 包内通道）；D4→replication-session）；close.ts（barrier 本体）与 schema-rearm.ts（L122/L209 入口实存、纯调用方接线）零改动——ALLOW 未列二者与改动面自洽 | 无 |
| DENY：registry/lease/ws-replication/docs/读面/诊断/schema-rearm 等 | 与正文一致：registry/lease 零改动主张经 L1865/L1866/L1181–1190/L354–360 核验成立；`.sa6-389/` 保持不存在（本轮 `ls` 复核） | 无 |
| ALLOW 无无理由扩张；follow-up（T4 #390/T5 #391/T2 #388）不掩盖本票必要项 | §13 分期边界与 SA8 §6 一致；F-1 修订未扩范围 | 无 |
| 新测试路径可采集性 | `packages/namespace-registry/test/issue-389-*.test.ts` 命中 vitest include（`packages/*/test/**/*.test.ts`）；fixture（非 `.test.ts`）不被收集，沿 #369/#387 先例 | 无 |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| C1–C11 + NC3/NC5/NC6 | §12 映射表逐行；C8 三断言变异敏感；C4 增补 failed 分支断言；C5 免 poll（D5-d 结算即已投递） | 无实质缺口 | — |
| **close 同步终止 sessions（F-1 修订回归锚，iteration 1 新增行）** | `runtime-replication-session-round2.test.ts` R2-2 族（L438–479 + L425 conflicted 不降级）+ phase5 fence 契约族（L199/L204/L217）实现后全量重跑 | 无：锚引用的测试与断言本轮实读核实实存（L448 终态 closed、L458–459 `RUNTIME_WRITE_DISABLED` + close 域文案、L474–476 重复 close 同实例、L425–434 conflicted 保持、phase5 L199/L204/L217 双向 same-promise + releaseCalls===1） | — |
| 容量豁免不变量 | §12 行升格「优选落盘」（N-5 处置）；>16 笔快连后 replaceSchema → invalidate-all 后随 watch-end | 定位合理（溢出注入编排归 T4；落盘裁量归实现切片） | — |
| 回归门 | NC1（#387 21/21）/NC2（#369 33/33）/phase5 reset+re-arm+replication 契约族/键集守卫/root typecheck | 覆盖充分（F-1 锚已补入） | — |
| 断言纪律 | 沿 SA6 §12.5（toStrictEqual、零 skip/env、屏障式静默断言、readData helper 门、Yjs 确定性）；C3 fixture 用 text 实变信封（N-3 注记落点） | 无 | — |
| 「旧实现真红」 | SA6 探针 2/3/4（watch-end 计数 0）+ 产出面 grep；本轮独立复核一致 | 无 | — |

---

## 13. Required revisions

无（无 BLOCKER、无 MAJOR）。

### Finding 处置记录（稳定 ID 映射）

| Finding ID | Iteration 0 严重度 | 处置 | 核验结论 |
|---|---|---|---|
| F-1 | MAJOR | **已解决（iteration 1）** | 修订要求全部满足且超预期：① §7-D5-b 伪代码重写——`fanout.terminateAll('runtime-close')` 上提为两种风味共享同步首步（或等价地两分支各自画出——设计采前者，更优）；② 注记更正为「fanout 终止 + 静默收口（现状逐字保持——缺一即非现状）」+ 根因段；③ §11 runtime.ts ② 补述；④ §12 增列 R2-2 族回归锚（测试实存）；⑤ 传播至 §3.1/§3.3/§5-B-T3-3/§10/§13-R5/R6 八处，全文无残留矛盾（§6 C-1/C-2/C-10 逐点核验）。接受条件（两风味均含 fanout 终止 + 既有 session-termination-on-close 契约族绿 + C1–C11 红绿不受影响）在设计层面满足；实现层面的绿由 SA4/SA7 验证。 |

## 14. Non-blocking observations

| # | 观察 | 说明 |
|---|---|---|
| N-1' | D5-c「缓存持完整 admission 承诺」下，reset 风味中 `lazyCloseBarrier()` 先把 raw barrier 落入缓存（L621 现状）再同步覆写为 wrapped 承诺 | 结构性安全（风味体全程同步、无 await、无交错读取窗口）；ADR 0010 #133「普通 close() 返回同一懒创建 close promise」在 admission 层语义上保持（barrier 仍恰一次、两入口同一实例）。实现保持 phase5 T2 双向断言绿即锁死该行为；无需设计变更。 |
| N-2' | reset 风味 barrier reject 时防御性 `watchHub.shutdown()` 被跳过；`.then` 内的 shutdown 调用自身须维持零抛点 | 设计已登记良性论证与「禁止补出可 reject 第二链」注记（§7-D5-b 实现注记）；实现期以注释锚 + 泵 X1 隔离保持「admission 承诺除 barrier reject 外不新增 reject 面」。 |
| N-3' | reset armed 后 archive 失败：`doc-replaced` 已投递而旧 doc 字节仍在 | 设计 §13 已登记为 T5 #391 文档措辞输入（「doc-replaced = 所订阅 generation 的终结信号」，不以 archive 成败为条件）；本票无动作。 |
| N-4' | 同文本 `replaceSchema` 本地仍终止（无 text 门）vs peer 仅 text 变化才终止的不对称 | 设计 §7-D3 已注记来源与 fixture 纪律（C3 用 text 实变信封、勿设零终止断言）；实现注释标注即可。 |
| N-5' | 「第二入口不重跑任何风味体」须以缓存前置检查实现（`startCloseAfterFence` 的 `started ??=` + `close()` L868 早退已足够） | 现状代码第二入口会重跑幂等体（无害）；修订语义在 reset 风味下是必要强化。phase5 T2 为行为锚，实现保持绿即可。 |

---

## 附：评审结论路由建议

iteration 1 达到 `approve` 门槛：F-1 完整解决、八处传播一致、新增回归锚真实；其余全部攻击面（需求/评论/上游事实/状态机/并发/错误恢复/契约/架构/范围/验收）维持通过。设计可进入实现切片；实现后仍须：SA4/SA7 活链路验证（C1–C11 红绿 + §12 全部回归门含 R2-2 族）、SA8 按 conflict report §8-3 ①–⑦ 执行 implementation 复查闭合 requiresConflictRecheck=true。本评审未发现需要重新执行 ADR 冲突检查的新风险（F-1 修订还原的是现状共享 admission 组成，SA8 摘录 L138–139 早有记载），故 `requiresConflictRecheck = false`。
