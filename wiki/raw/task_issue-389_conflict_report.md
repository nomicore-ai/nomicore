# SA8 前置门禁冲突报告 — issue #389：复制来源与订阅终止（变更订阅 T3）

- 复审对象：**task**（issue #389 验收契约 = 任务简报 `wiki/raw/task_issue-389.md` What-to-build +
  AC1–AC7，与已批准的 SA6 验收契约 `wiki/raw/task_issue-389_sa6_contract.md`：C1–C11 / NC1–NC6 /
  B-T3-0–B-T3-6 / §12.6 实现期红线 / §10 影响面）
- 复审轮：2026-09-15（iteration 0；dispatch `sa-c801694c-bed8-461a-a875-b7aeab353d70`；
  本报告为 issue #389 首份前置门禁冲突报告）
- Worktree：`/home/wangjian/nomicore-fix-issue-389`（branch `mabf/issue-389`，HEAD `28faeae`
  = #395「fix(#387): watchMap 无谓词形态垂直通路（变更订阅 T1/tracer bullet）」；ADR 全集 /
  CONTEXT.md / docs/protocols 相对 HEAD 零 diff——规范基准未被本任务触碰，本轮 `git status` 实读）
- 结论速览：**verdict = clear**；27 项对照 = **11 × implements-existing-decision + 16 × no-conflict**；
  0 hard-conflict；0 override；0 evolution-required（含修订计划缺失项）；三个 SA1 冻结位
  （B-T3-2/B-T3-3/B-T3-6，承重 = **B-T3-3**）均为**决策文本未覆盖缺口的实例化**，不构成冲突，
  但 **B-T3-3 未冻结前不得进入实现**；
  **requiresConflictRecheck = true**（终止编排横跨 reset/lease 生命周期、re-arm fatal 失败语义、
  schema 安装状态机段与通知公共行为——全部尚待实现核对）

---

## 1. Reviewed subject

**task**（前置门禁：任务要求 vs ADR 全集 + CONTEXT + 模块 AGENTS + 协议文档）。被审文本两件：

1. `wiki/raw/task_issue-389.md`——Host brief：issue #389（state OPEN，Parent PR #386 =
   adr-0030-change-subscription；Blocked by #387 已合并于 HEAD）「What to build」+ AC1–AC7；
   **规范权威自我声明 = ADR 0030 决策 4 / 6**（brief L17）；
2. `wiki/raw/task_issue-389_sa6_contract.md`——SA6 已批准（approve 附 SA1 冻结条件）的验收契约：
   AC↔用例映射（§12.2）、契约绑定表 B-T3-0–B-T3-6（§12.1）、断言纪律与红线（§12.5/§12.6）、
   影响面（§10）、能力缺口证据（§5 探针 1–5、§8、§13）。

Issue 评论 = **0 条**（REST 实读 `[]`；SA6 `artifacts/sa6-issue389-probe-6-inputs-and-tree.log`
同证）→ **无 owner override / 无范围收缩**；需求源 = issue body + ADR 0030 §4/§6 + ADR 0018 +
CONTEXT 词条。前置票 #387 的 SA8 设计/实现复审（均 clear）在场作先例裁决输入（wiki/raw 属
evidence 非规范——`docs/AGENTS.md` Authority 节明文）。

## 2. Inputs and decision set

| 输入 | 状态 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-389.md`（任务简报） | 在场 | 需求源：AC1–AC7 + What-to-build + Blocked by |
| `wiki/raw/task_issue-389_sa6_contract.md`（已批准验收契约） | 在场 | 被审对象之二：绑定表 / 红线 / 非目标 / 证据索引 |
| `docs/adr/0030-change-subscription.md` | **规范权威**（已接受，零 diff） | §1/§3/§4/§5/§6/§7/验收节/备选节逐条款对照 |
| `docs/adr/0018-peer-schema-rearm.md` | 已接受（零 diff） | §1 同步段位置、§3 fatal 语义、§4 通知面边界、§6/§7 冻结与取代 |
| ADR 0008（+修订节）、0009（+#131/#134/deleteNamespace 修订节）、0010（+#133 round-2 reset 修订）、0011/0014、0023、0025/0026、0027、0028 | 已接受 | 交叉决策面（槽序/公共事件边界/lease 生命周期/reset 冻结次序/诊断槽外/构造纪律/信封原子/readData 形状/窗口读负控） |
| ADR 0013/0022 + `docs/protocols/instance-replication-v1.md` | 已接受 | wire 冻结面（帧/错误码/reason 词表） |
| `CONTEXT.md` L65–67（变更订阅词条）、L121（active schema）、L123–124（schema re-arm）、L186（ReplicationSession） | 在场，零 diff | 术语一致性（origin/watch-end/生命周期耦合口径/re-arm 成功切换） |
| `packages/namespace-registry/AGENTS.md`、`packages/namespace-runtime/AGENTS.md` | 在场 | 模块决策面（公共 API 仅经 src/index.ts；单一 FIFO；internal seam） |
| 前置票 #387 SA8 产物（design iteration 2 clear / implementation clear，`task_issue-387_*_conflict_report.md`） | 在场（evidence） | 先例裁决沿用（ADR 0008 L101 窄读、键集守卫纪律、分期义务表） |
| 源码事实核验（本轮独立实读） | — | §3 各行 Evidence：watch-map.ts / runtime.ts / registry.ts / schema-write.ts / schema-rearm.ts / replication-session.ts / 两键集守卫 / docs 全树 grep |
| `artifacts/sa6-issue389-*.log`（15 份） | 在场（evidence） | SA6 探针与基线证据索引核对（§5.1–5.5 与实读源码一致） |

决策集状态核查：ADR 全集 28 篇均「已接受」；0007（部分取代于 0008）、0016/0024（交付条款经 0027
修订）、0010（reset/重启切 schema 条款经 0018 §7 废止）的被取代条款与本票**零接触面**——不构成
约束。`docs/` 全树（ADR 0030 除外）零 `watchMap`/`watch-end` 名目（本轮 grep）——规范文档面与
本票词汇零接触的独立确认。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（issue AC + SA6 契约） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0030 §4（L51） | `watch-end` reason `'schema-changed'`（**本地 `replaceSchema` 或 Peer re-arm**）；流末条、此后静默；终结三因封闭；数据缺席/删除从不终结 | AC2：schema 变更 → 该 namespace **全部存活订阅**收到 `{kind:'watch-end',reason:'schema-changed'}`，覆盖 Hub 本地 `replaceSchema` 与 Peer 复制 apply 槽 re-arm（ADR 0018）两路径；SA6 C3/C4 各带前置 oracle | **implements-existing-decision** | ADR L51 逐字（两 reason 定义与两路径枚举原文一致）；CONTEXT L66 同款；HEAD 缺口 = 零产出点（`watch-map.ts` L67 仅类型联合；探针 2/3 watch-end 计数 0） | 无（实现义务，见 §8） |
| 2 | ADR 0030 §4（L51） | `'doc-replaced'`（**reset / bootstrap import / genesis 一族**） | AC3：doc 替换（reset / bootstrap import / genesis 一族）→ `watch-end:'doc-replaced'`；SA6 C5 锚 `resetReplica`（archive 1 次）后流末条 | **implements-existing-decision** | ADR L51 逐字；探针 4（reset ok + lease released + watch-end 0 = 缺口实证）；`registry.ts` L1865–1866 reset 槽实读 | B-T3-3 机制须 SA1 冻结（行 17） |
| 3 | ADR 0030 §4（L52） | `origin: 'local' \| 'replication'`——self-echo 抑制刚需（消费方过滤自己触发的写） | AC1：复制 apply 触发 `data` 且 `origin:'replication'`；本地写恒 `'local'`（self-echo 抑制的**消费依据**——过滤责任在消费方，契约零过滤断言）；SA6 C1/C2 + NC3 回归锁 | **implements-existing-decision** | ADR L52（过滤动词赋予消费方）；探针 1 实测 `["local","replication"]` 在 HEAD 已具备（T1 结构性交付）→ AC1 为验收补锚 + 回归锁 | 无 |
| 4 | ADR 0030 §5（L57–58） | 宁多勿漏唯一不变量；漏不可接受 | SA6 NC3：T3 不得为过契约引入 origin 过滤面；§12.6 红线 3「不得按 origin 过滤」（ADR §5 唯一不变量） | no-conflict | ADR L57–58；#387 SA8 行 3 裁决沿用（T1 已裁「origin 过滤 = 蓄意漏通知」被 §5 否决） | 无 |
| 5 | ADR 0030 §6（L64） | 挂点 = 写序列器事务提交后异步分发——**全覆盖本地受控写、复制 apply、schema 安装三种来源** | AC1 驱动面 = 经 lease `openReplicationSession` + `applyRemoteUpdate`（复制 apply 来源）；B-T3-1 schema 路径入队点 = 安装/切换成功后、同槽 `await notifyDirty` 之前的同步段（本地 `schema-write.ts` S5.5 / peer `replication-session.ts` R5.6） | **implements-existing-decision** | ADR L64 三来源枚举原文；`schema-write.ts` L282–290（S5.5 段位）+ L308–310（S6 `await notifyDirty`）实读；`schema-rearm.ts` L119 约束注释「事务提交之后、`await notifyDirty()` 之前」 | 无 |
| 6 | ADR 0030 §6（L65–66） | 回调 throw 静默隔离；有界队列溢出 → `invalidate-all`（订阅存活） | SA6 NC4（T1 X1 回归锚）+ B-T3-4：`watch-end` 之后零通知（含 `invalidate-all` 不后置）；终止前已入队 `invalidate-all` 照 FIFO 先投 | no-conflict | ADR L65–66；T1 契约 X1 在 NC1 内（21/21 基线绿）；溢出触发编排归 T4 #390（行 26 分期边界） | 无 |
| 7 | ADR 0030 §1（L16–18） | `unsubscribe` 幂等；主动退订零通知；订阅是 lease capability | AC4 后半：`watch-end` 后已注销、此后 `unsubscribe` 幂等 no-op（SA6 C7：×2 零 throw 零通知）；B-T3-0 继承 #387 冻结（句柄恰一键） | **implements-existing-decision** | ADR L16；`watch-map.ts` L466–475 双幂等句柄（#387 实现复审行 1 证据沿用）；探针 4 R7 no-throw 实测 | 无 |
| 8 | ADR 0030 §4 备选节（L80/L85/L86） | **onEnd 独立回调被否决**（相对顺序无保证）；**schema 变更作为通知 kind 被否决**（静默存活 = 静默死亡风险；终止信号 + 重建才是正确形态）；**origin 'admin' 被否决**（reset/import/schema 安装都走 watch-end，收敛两态） | AC4/AC5 要求终止统一进通知流保 FIFO；SA6 §12.6 红线 3「不得为终止引入 onEnd 独立回调或同步直调 listener（绕过队列即违反 FIFO）」；SA6 §11 反证 7/8 同款排除 | **implements-existing-decision** | ADR L80/L85/L86 逐字；issue AC5「不会先终止、后到僵尸 data 通知」= L80 否决理由的直接验收化 | 无 |
| 9 | ADR 0030 §3（L33–39） | 建立判定全部由 active schema；数据缺席合法；参数校验全在建立时刻 | AC6：终止后消费方**重新 `watchMap`**（按新 schema 建立）行为正确；B-T3-5：schema-changed 后 lease 仍 `active`、旧 handle 恒幂等 no-op；SA6 C9/C10 | **implements-existing-decision** | ADR L33–39；探针 2 S9（lease active）/S11（新订阅按 V2 建立并投递）实测重建能力在产 | 无 |
| 10 | ADR 0030 §7（L69–73） | runtime 承担「schema 安装 / doc 替换的**终止编排**」；registry 承担 lease 公共面与透传；**通知不出进程：复制协议零改动** | SA6 §10 影响面：终止编排落 `watch-map.ts`/`runtime.ts` 构造栈/schema 安装段/reset 关闭链；registry 仅 reset 槽次序与 lease 透传；§12.6 红线 1 复制协议与 session 公共面零改动 | **implements-existing-decision** | ADR L71（runtime 终止编排职责原文）+ L73；`git status` 基线零 ws-replication/replication-protocol 改动 | 无 |
| 11 | ADR 0030 验收节（L88–97） | 主缝 = **lease 公共面（零新接缝）**；验收明示「`watch-end` 两 reason（**含 Peer re-arm 路径**）与流末条静默」 | AC7：全部经 lease 公共面可观察（零新接缝）；SA6 C11：lease 恰 16 键、runtime 恰 15 键、通知 kind ⊆ 三 kind 闭集、零新增公共成员 | **implements-existing-decision** | ADR L90–92；键集守卫实读：`registry-open.test.ts` L942（16 键含 watchMap）、`runtime-phase5-reset-fence-r2.test.ts` L131–146（15 键含 watchMap） | 无 |
| 12 | ADR 0018 §1（L24–34） | Peer apply 槽 schema 同步段位于 live 事务提交后、`await notifyDirty()` 前；槽继续 dirty/ACK 照常；不产生新槽类型、strict FIFO 零改动 | B-T3-1 peer 位：watch-end 入队进 R5.6 **同段**（安装成功后、`await notifyDirty` 前）；SA6 §10 约束「位置不得进事务栈；不得改变 fatal/ACK/dirty 语义」 | **implements-existing-decision** | ADR 0018 L26–27/L34；`replication-session.ts` L9/L42（R5.6 段）实读；探针 3 P10（`schemaRearm.kind:'applied'` + 指纹一致 = oracle 可判） | 无 |
| 13 | ADR 0018 §3（L55–73） | re-arm **失败** = fatal 双码、tools 保持旧的不动、apply 不回滚、写永久禁用读保留、Peer 主动 CLOSE_NAMESPACE | B-T3-2【SA1 必裁】：re-arm 失败（fatal INVALID/INTERNAL）是否仍发 `watch-end`；SA6 契约默认**发**（终止因 = 已提交 schema text 变更使谓词语义失效，与 re-arm 成败正交）；若另裁须说明「fatal 后订阅按旧 schema 存活」的消费方语义 | no-conflict（**文本缺口实例化**：ADR 0030 §4 只定义 reason 词表与「Peer re-arm」触发面，未覆盖失败分支；ADR 0018 全文不涉订阅面——两读法均不与任何条款冲突，与 #387 ③b/缺口实例化同治理档） | ADR 0018 L57–73；ADR 0030 L51；CONTEXT L121（active schema 于 re-arm **成功**后切换 = 另一读法输入）；SA6 §12.1 B-T3-2 / §15-2 登记 | SA1 冻结后回写 SA6 §12.1；实现后核对失败分支行为 |
| 14 | ADR 0018 §4（L75–109） | 宿主通知复用 observer 注册表（`schema-rearm-applied/failed`）+ 拉取 seam；**ADR 0008「v1 不提供公共事件订阅」边界不破：不加 lease 级 promise/事件** | T3 的终止信号走 watchMap 通知流（ADR 0030 已授权的既有公共面），不借道 observer、不新增 lease 级事件 | no-conflict | ADR 0018 L88；SA6 §12.5-8 全部断言锚 lease 公共面（零 runtime 内部/Y.Doc 读取） | 无 |
| 15 | ADR 0018 §6/§7（L120–141） | wire 协议零变更；Hub 行为不变；Peer 无 SCHEMA 写权；废止 ADR 0010 旧 reset 条款 | SA6 §12.6 红线 1：复制协议与 session 公共面零改动；C4 仅消费 `applyRemoteUpdate` 结果与 `getActiveSchema()` 公共投影作 oracle | no-conflict | ADR 0018 L122–126；`git status` ws-replication 零 diff；docs/protocols 零 `watchMap` 名目（本轮 grep） | 无 |
| 16 | CONTEXT L65–67「变更订阅」词条 | 三 kind / origin 两态 / 挂点全覆盖 / 生命周期**只与 lease 和 schema 耦合** / 宁多勿漏 / `_Avoid_`（observer 撞词、push/事件流、与 subscribeOwnedUpdates/诊断日志混用） | issue AC6 措辞「订阅生命周期只与 lease 和 schema 耦合」逐字取自词条；AC1/AC4/AC5 与词条口径一致；SA6 契约通篇用「通知/订阅」词汇，零 `_Avoid_` 用语；C11 断言 kind ⊆ 三 kind 闭集 | no-conflict | CONTEXT L66–67 实读；issue brief L21–27 逐条对账 | 无 |
| 17 | ADR 0010 + issue #133 round-2 reset 修订（L279–291） | reset 冻结次序：reset-fence 槽双源核对 → 槽返回前同步进 closing → 槽结算后懒 close continuation 创建唯一 close barrier → 归档 → bootstrap 资格；**fence 槽绝不创建或等待 close barrier**；`NAMESPACE_RESET_*` 稳定码冻结 | B-T3-3【承重，SA1 必裁】：doc-replaced 投递与 lease force-release 的顺序保证；SA6 §10 约束「reset 槽既有冻结次序（fence → closing → archive）不得被破坏」；HEAD 结构（`closeAfterFence` 同步静默 `watchHub.shutdown()` + 同步 `forceReleaseOutstandingLeases` 清队）使默认契约结构性不可达 → SA1 须冻结机制（终止信号先于 force-release 交付 / 终止项免于释放清队 / 槽内 await 终止投递） | no-conflict（**义务 + 机制未裁**：AC3 的结果义务是 ADR 0030 §4 的直接命令（行 2）；ADR 0010 冻结的是次序而非「reset 期间订阅必须静默」——候选机制均可在不破坏 fence→closing→archive 与「fence 槽不等 barrier」的前提下成立；HEAD 的静默 shutdown 是**未实现义务**，不是已接受决策） | ADR 0010 #133 round-2 §2；`runtime.ts` L628–635 + `registry.ts` L1865–1866/L1181 实读；探针 4 R4=0；SA6 §8 交付缺口链/§12.1 B-T3-3/§15-1 | **实现前置条件**：B-T3-3 由 SA1 冻结后方可进入实现；若 SA1 裁「force-released lease 一律静默」→ AC3 在 lease 公共面不可满足 → 回设计门重裁（届时构成 evolution-required，见 §6） |
| 18 | ADR 0009 §NamespaceLease + #134 修订节 | release 幂等；首调同步段 released；released lease 后续操作走既有 `NAMESPACE_LEASE_RELEASED` 通道；release 同步段关 session、不追踪在途 | B-T3-5：doc-replaced 后 lease 已 released（重建 = 重新 open/import，Registry 编排）；探针 4 R8（re-watch → `NamespaceLeaseReleasedError` released 通道，非新接缝） | **implements-existing-decision** | ADR 0009 #134 修订节；探针 4 R6/R8 实测；SA6 C10 断言锚既有通道 | 无 |
| 19 | ADR 0009 deleteNamespace 修订节 | delete = forceRelease → cancelIdleArm → close admission → 删除（终态编排）；**删除 ≠ 替换** | SA6 非目标 + §12.6 红线 5：`deleteNamespace` 不加 `watch-end`（reason 词表封闭两值）；lease 释放（主动退订/普通 release）同样静默（ADR 0030 §1「释放即清理」+ 终结三因中 lease 释放无 reason） | no-conflict | ADR 0030 L51（reason 恰两值）+ L18；ADR 0009 修订节；`registry.ts` L1987 起 delete 破坏性段实读（与 reset 槽分立） | 无 |
| 20 | ADR 0008 L101 | 「v1 不提供公共事件订阅；队列进度和内部事件属于日志、metrics 与 trace」 | T3 零新增公共成员（AC7）：终止信号走 T1 已交付的 watchMap 面（三 kind 闭集、无队列进度/内部事件夹带）；close-lifecycle 负向事件词表不动 | no-conflict（窄读 + ADR 0030 后法特定授权——#387 SA8 设计复审行 13 裁决维持，本票无新接触面） | ADR 0008 L101 语境（status 可观测性段）；ADR 0030 背景节明示「v1 无 public subscription」为被超越的既定边界；B-T3-0 冻结零新增成员 | 无 |
| 21 | ADR 0008 修订节（槽序）+ runtime AGENTS | 单一严格 FIFO write sequencer；完整槽序（… → transaction → 同步投影 → `await notifyDirty()`）不变；reads/信号在 FIFO 之外 | B-T3-1 的入队/分发分工：watch-end **入队**在安装段同步段（槽内、事务栈外）、**投递**经订阅 FIFO 队列微任务泵（槽外）——零新槽类型、零插队（沿 T1 交付形态） | no-conflict | ADR 0008 修订节；runtime AGENTS Boundaries；#387 实现复审行 6/10（泵机制在产）；ADR 0018 L36–37「不产生新槽类型、不插队」同款纪律 | 无 |
| 22 | ADR 0011/0014 | 诊断变更日志 = best-effort 观测；emit never throws；lifecycle 调用点在 write sequencer slot 之外 | T3 通知不经诊断日志（CONTEXT `_Avoid_` 混用禁令）；ADR 0030 §6「沿诊断日志 sequencer slot 之外纪律」仅指**投递**槽外纪律的借用，非复用日志载体 | no-conflict | ADR 0011/0014 状态行；根 AGENTS.md Nomicore 条目；SA6 §12.5 断言全部锚通知流对象 | 无 |
| 23 | ADR 0027 + 仓库守卫门 #333/#336/#364 | readData 恒四键 `{ok,value,schema,truncated}`；形状断言经集中化 helper | SA6 §12.5-6：任何 readData 成功形状断言经 `expectReadDataOkKeys` helper（#369/#387 先例）；§12.6 红线 1 readData 零改动 | no-conflict | ADR 0027；`packages/namespace-runtime/test/helpers/readdata-ok-shape.ts` 在场；NC2（#369 33/33）基线绿 | 无 |
| 24 | ADR 0028 + #369 契约族 | 窗口读 API 与词表冻结；#369 契约 = 负控基线 | SA6 NC2：#369 33/33 保持绿（既有读/窗口读冻结面零改动）；窗口读/条目身份形状零触碰 | no-conflict | ADR 0028；`artifacts/sa6-issue389-baseline-369-contract.log`（33/33）；ADR 0030 头部「既有 readData / 窗口读 / 复制面零改动」 | 无 |
| 25 | ADR 0023 + 两包 AGENTS | `ctx.provide` 服务对象访问器纪律；「Add public APIs only through `src/index.ts`」；runtime 公共面仅 detached 投影 | SA6 §10：registry 改动限于 reset 槽次序编排与 lease 透传（`registry.ts` 服务字面量不触碰）；T3 零新增公共成员 = 无新 index 导出面 | no-conflict | ADR 0023 L41 豁免条款；registry AGENTS L15；runtime AGENTS Boundaries | 无 |
| 26 | ADR 0030 §2/§4/验收节（分期边界） | 谓词 `where` 词表 / `WATCH_MAP_OPTIONS_INVALID`；`invalidate-all` 触发源（溢出注入 / 父路径删除）；文档缝 | SA6 §12.1 非目标逐项对齐票面：T2 #388（谓词）、T4 #390（溢出编排 + runtime 键集纯加法）、T5 #391（文档面）；本票零文档改动（CONTEXT 词条已在 HEAD） | no-conflict（分期边界三向一致：issue/spec #385/SA6） | ADR 0030 §2（L27–31）/§4（L50）；SA6 §2 边界声明；#387 SA8 分期义务表（T3 行 = 本票） | 分期义务登记见 §6 |
| 27 | issue #389 AC1–AC7 ↔ SA6 §12.2 映射 | 任务简报验收条款须有契约落点且不降级 | C1–C11 逐 AC 映射完整（§12.2 表）；AC1 诚实标注「HEAD 已具备 = 验收补锚」而非伪红灯；红面（C3–C8）首因统一为 watch-end 缺席；SA6 明示不私自降级契约（B-T3-3 若不可满足回设计门） | no-conflict | SA6 §12.2/§12.3/§13；探针 1–4 + 产出面 grep（`artifacts/sa6-issue389-probe-5-emission-sites.log`：`watch-end` 零产出点）与本轮源码独立实读一致 | 无 |

裁决分布：**implements-existing-decision × 11**（行 1/2/3/5/7/8/9/10/11/12/18）、
**no-conflict × 16**（行 4/6/13/14/15/16/17/19/20/21/22/23/24/25/26/27）。
每项均引用决策路径与具体条款；无一项以「符合 ADR」了结。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| —（无） | — | — | — |

无任何 override 被使用或被需要：issue #389 评论 = **0 条**（REST 实读 `[]`——无 Owner 评论覆盖
具体决策）；无新 ADR 修订/废弃旧 ADR（ADR 全集相对 HEAD 零 diff）；无协议版本升级
（`docs/protocols/` 零接触）。SA8 不替 Owner 或 SA1 创建 override——B-T3-2/B-T3-3/B-T3-6 的
裁决权归 SA1 设计门，其产物是**缺口的实例化冻结**，不是 override 权威。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（任务要求面 + HEAD 现状） |
|---|---|---|---|
| 复制 wire / 协议 / session 公共面 | instance-replication-v1 帧/错误码/reason；`openReplicationSession` / `applyRemoteUpdate` / `subscribeOwnedUpdates` 签名与语义 | ADR 0030 §7 L73；ADR 0018 §6；ADR 0010/0013/0022 | 保持（SA6 §12.6 红线 1；docs/protocols 零 `watchMap` 名目；git status ws-replication 零 diff） |
| 通知三 kind 形状与词表 | `{kind,origin,changes}` / `{kind,origin}` / `{kind,reason}`；reason 恰 `'schema-changed' \| 'doc-replaced'`；origin 恰 `'local' \| 'replication'`；通知不含值 | ADR 0030 §4 L43–52 + 备选 L86；CONTEXT L66 | 保持（SA6 §12.5-1 精确形状 + 逐字 reason 断言；实现义务是**产出**既有联合成员，非扩展词表） |
| readData 交付形状 | 恒四键 + 投影文本 + ✂ 段；helper 门 | ADR 0027；守卫门 #333/#336/#364 | 保持（SA6 §12.5-6/§12.6-1） |
| 窗口读 API 与 #369 负控 | `readArray`/`readMap`/`WINDOW_*`；#369 契约 33/33 | ADR 0028；SA6 NC2 | 保持 |
| lease / runtime 公共键集 | lease 恰 16 键、runtime 恰 15 键；既有键语义零改动（T3 零新增成员） | AC7；ADR 0030 验收节「零新接缝」；#387 冻结 B-T3-0 | 保持（两键集守卫实读在场） |
| ADR 0018 槽语义 | 同步段位置（提交后、`await notifyDirty` 前）；槽继续 dirty/ACK；fatal 双码 / tools 不动 / apply 不回滚 | ADR 0018 §1/§3 | 保持（B-T3-1 入队点不得改变这些语义；SA6 §10 约束明示） |
| ADR 0010 reset 冻结次序与稳定码 | fence（双源核对）→ closing → 唯一 close barrier → 归档；fence 槽不创建/不等待 barrier；`NAMESPACE_RESET_*` 词表 | ADR 0010 #133 round-2 §2 | 保持（B-T3-3 机制的设计边界；SA6 §10「reset 槽既有冻结次序不得被破坏」） |
| ADR 0008/0009 生命周期与失败通道 | 槽序不变；`errors.ts` append-only；release 幂等 / released 通道 / 不追踪在途 | ADR 0008 修订节；ADR 0009 #134 | 保持（doc-replaced 重建走既有 released 通道——探针 4 R8） |
| 诊断变更日志 | emission / record schema / retention / 槽外纪律；与通知流不混用 | ADR 0011/0014；CONTEXT `_Avoid_` | 保持（通知不经诊断日志） |
| 持久化格式与 Registry 构造 | snapshot docstore 语义；`ctx.provide` 访问器纪律 | ADR 0006；ADR 0023 | 保持（零持久化包改动；registry 服务字面量不触碰） |

## 6. Evolution requirements

**无 evolution-required 项**：本票不改变任何已决定契约——AC1–AC7 全部是 ADR 0030 §4/§6/验收节
既有义务的兑现（§3 行 1–3/5/7–12/18）；三个 SA1 冻结位（B-T3-2/B-T3-3/B-T3-6）是决策文本
**未覆盖分支的实例化**（与 #387 ③b 同治理档：在未考虑状态上加行为，对已考虑状态行为与原文
逐字一致），不需要随变更集修订 ADR/CONTEXT/协议。

**唯一 evolution 触发预案**（登记不触发）：若 SA1 对 B-T3-3 裁决「force-released lease 一律
静默」，则 AC3（= ADR 0030 §4 `doc-replaced` 对 reset 族的命令）在 lease 公共面结构性不可满足
——届时该裁决与 ADR 0030 §4 构成正面对撞，**必须**走正式 ADR 修订（修订文件、新旧语义、
兼容与迁移、失败语义、验证、冻结面清单）后方可实施；SA6 已明示「不得私自降级契约、回设计门
重裁」，本门维持该约束。

**分期兑现义务**（既有决策的实现分期，各有其票，登记防丢失——非 evolution）：

| 义务 | 权威条款 | 承接票 | 本票预留 |
|---|---|---|---|
| 谓词 `where` + `WATCH_MAP_OPTIONS_INVALID` | ADR 0030 §2/§3 | T2 #388 | 非目标（SA6 §12.1） |
| `invalidate-all` 触发编排（溢出注入 / 父路径删除）+ runtime 键集纯加法验收 | ADR 0030 §4/§6/验收节 L94 | T4 #390 | B-T3-4 只断言「watch-end 后零 invalidate-all」 |
| 三方文档面（含消费指引） | ADR 0030 验收节「文档缝」 | T5 #391 | 本票零文档改动（CONTEXT 词条已在 HEAD） |
| B-T3-2/B-T3-3/B-T3-6 冻结与回写 | SA6 §12.1/§15（缺口实例化） | 本票 SA1 设计门 | 契约默认值已定，SA1 另裁只改测试侧单点 |

## 7. Hard conflicts

**无。** 27 项对照（§3）无一项落入 hard-conflict：issue AC1–AC7 与 SA6 契约对 ADR 0030 §4/§5/§6/§7/
验收节为忠实兑现（含两条 schema 路径、reset 族、流末条/FIFO/幂等、零新接缝）；对 ADR 0018 的
接触面（R5.6 同段入队、fatal 分支、oracle 消费公共投影）全部相容；对 ADR 0010 reset 冻结次序、
ADR 0008/0009 生命周期与公共面纪律、ADR 0011/0014/0023/0027/0028 交叉面均为零触碰或既有先例
裁决的延续。SA6 契约自身把三个未裁点显式登记为 SA1 冻结项而非私自定约（§12.1/§15），且明示
不可满足时回设计门——不存在「无合法 override 的硬冲突」形态。

## 8. Required actions

1. **【实现前置条件】SA1 冻结三个绑定**（承重 = B-T3-3）：doc-replaced 投递与 lease
   force-release 的顺序保证机制（不得破坏 ADR 0010 fence→closing→archive 冻结次序与
   「fence 槽不创建/不等待 close barrier」条款、不得新增公共接缝）；B-T3-2（re-arm 失败是否
   发 `watch-end`）；B-T3-6（滞留 data 必达性）。冻结结果与 SA6 §12.1 对账回写；若与契约默认
   取值不同，只改测试侧单点，语义断言（三 kind、流末条、reason 逐字、零新接缝）不变。
2. **实现期红线执行**（SA3/SA4/SA7 按 SA6 §12.6 + 本报告 §5 冻结面）：复制协议/session/
   readData/窗口读/诊断/持久化零改动；lease 16 键、runtime 15 键不变；不按 origin 过滤；
   不引入 onEnd/同步直调 listener；数据缺席/删除不终结订阅；lease 释放与 `deleteNamespace`
   不加 `watch-end`；watch-end 走订阅 FIFO 队列、逐 listener try/catch、通知不含值。
3. **实现后冲突复查清单**：① 三条路径（Hub 本地 / Peer re-arm / reset）流末条
   `{kind:'watch-end',reason}` 逐字且其后零通知（含 invalidate-all）；② origin 两态无过滤
   （复制 apply → `'replication'`，本地写 → `'local'`，同流 FIFO）；③ lease/runtime 键集
   守卫 16/15 照绿、零新增公共成员/导出；④ ADR 0018 槽语义零漂移（同步段位置、dirty/ACK、
   fatal 双码、tools 不动、apply 不回滚——既有 re-arm 契约测试全绿）；⑤ ADR 0010 reset 冻结
   次序零破坏（identity 前置、稳定码、close barrier 唯一性——phase5 reset 契约全绿）；
   ⑥ B-T3-2/B-T3-6 按 SA1 冻结值核对；⑦ NC1（#387 21/21）/NC2（#369 33/33）/NC3–NC6 全绿。
4. **分期义务交接**：T4（#390）必须交付溢出注入与父路径删除验收（否则 ADR 0030 §6 验收条款
   悬空）；T5（#391）交付文档面；T2（#388）谓词面——均非本票义务。
5. **设计门联动**：SA6 §15-4（import/genesis 的 doc-replaced 可观察场景收窄为 reset）与
   §15-5（`deleteNamespace` 不发终止信号）两项读法已在本门裁决为规范内（§3 行 2/19），
   SA1 设计冻结时确认即可，无须 ADR 修订。

## 9. Verdict

**clear** —— issue #389 验收契约（issue body AC1–AC7 + 已批准的 SA6 验收契约）对 ADR 0030 为
**忠实兑现型任务**：AC1（origin 两态、无过滤、复制 apply 全覆盖）是 §4/§5/§6 既有义务的验收
补锚（HEAD 已由 T1 结构性交付）；AC2/AC3（两 reason 三路径）是 §4 明文命令而 HEAD 零产出的
能力缺口（探针 2/3/4 实证 + 本轮源码独立复核：`watch-end` 仅存在于类型联合字面量）；AC4/AC5
（流末条静默 + FIFO）与 AC6/AC7（重建语义 + 零新接缝）逐字对应 §1/§4/验收节条款。对 ADR 0018
的接触面（R5.6 同段、fatal 分支、oracle 消费）与 ADR 0010 reset 冻结次序均相容；三个 SA1
冻结位是文本缺口实例化而非契约变更，且 SA6 已把承重项（B-T3-3）正确设为实现前置条件。

裁决分布：implements-existing-decision × 11、no-conflict × 16、hard-conflict × 0、
evolution-required × 0、override × 0。无输入缺失（issue 评论 0 条 = 无 owner 条款需并入；
需求源齐备）；无证据不足（SA6 探针证据与本轮独立源码核验一致）；无未经修订计划的契约变更。

## 10. requiresConflictRecheck

**true**。触发条件命中：本票实现将触碰**生命周期**（reset 槽内终止投递与 lease force-release/
runtime close 的次序、schema 安装段挂点）、**失败语义**（B-T3-2 re-arm fatal 分支是否终止）、
**状态机段**（S5.5/R5.6 同步段的入队时机）、**公共通知行为**（watch-end 形状/流末条/静默）——
均尚待实现核对；B-T3-3 的 SA1 冻结机制落盘后亦须按 §8-1 对账。实现落地后按 §8-3 清单 ①–⑦
执行 implementation 复查，闭合后转 false。
