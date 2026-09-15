# SA9 标准审查 — issue #389：复制来源与订阅终止（变更订阅 T3）

- 审查轮：2026-09-15（iteration 0；dispatch `sa-b5f6c17f-c6f4-446d-be0e-42c217c14b48`，phase = standards-review）
- 被审对象：**已提交最终交付** commit `55900b1 feat(namespace): terminate change subscriptions`
  （基线 `28faeae` = #395 T1 已合并）。tracked 改动恰 7 个 package 文件：4 个
  `packages/namespace-runtime/src/{watch-map,runtime,schema-write,replication-session}.ts`
  + 3 个新测试文件（fixture 631 行 / 主契约 594 行 17 用例 / SA7 动态补充 373 行 7 场景）+
  wiki/raw 流程文档 9 件
- Owner 要求：issue #389 评论数 = **0**（dispatch 明示 REST 实读空数组）——无 owner 条款可核对
- 审查方法：独立实读最终 diff 全部 4 源文件与周边段（watch-map 泵/队列/句柄/terminateAll/
  shutdown 全读；runtime 构造栈/关闭 admission/close()/beginResetFence；schema-write S5–S7；
  replication-session R5–R6；registry reset 槽 ⑥ 与 lease doRelease 释放清理——两者零 diff
  但作为承重依赖复核）、3 个新测试文件全读/抽检、ADR 0030 全文与 ADR 0018/0010(#133) 相关节、
  两包 AGENTS.md、根 AGENTS.md、证据日志抽检（绿契约 17/17、回归门 86/86、typecheck EXIT=0）；
  未修改任何文件、未运行测试、未启动服务
- 结论速览：**verdict = approve**。0 BLOCKER / 0 MAJOR；4 条 MINOR（证据卫生 1、提交信息
  卫生 1、注释计数陈旧 1、测试文件归并路由 1），均不阻断。

---

## 1. 标准维度逐项裁决

### 1.1 仓库与模块 AGENTS

| 标准 | 核验 | 裁决 |
|---|---|---|
| 根 AGENTS「改动前读最近嵌套 AGENTS.md」 | SA 链路与本轮均实读两包 AGENTS；改动面与包契约一致 | ✅ |
| runtime AGENTS「单一严格 FIFO；reads/信号在 FIFO 之外」 | 终止项入队全部发生在槽内同步段（S5.6 schema-write.ts:323 / R5.7 replication-session.ts:828 / reset 关闭 admission runtime.ts:658），投递在槽外既有单飞微任务泵——零新槽类型、零插队；close barrier 仍唯一懒创建 | ✅ |
| runtime AGENTS「close() 同步停接纳、终止存活 sessions、排空已接纳槽、恰释放一次、幂等」 | 共享同步首步 `fanout.terminateAll('runtime-close')` 在两种风味中逐字保持（runtime.ts:647/657）；公共 `close()` = 正常风味（:902–916），与改前逐字等价；`lazyCloseBarrier` 唯一入口、单缓存同实例（phase5 T2 双向 same-promise 7/7 在案绿） | ✅ |
| runtime AGENTS「公共 API 只暴露 detached 投影；fanout host/queues/seams 保持内部」 | `NamespaceRuntimeWatchHub` 为包内模块面——index.ts 无该导出（L70–83 仅 T1 既有三 type-only）、internal.ts 零 `WatchHub`/`SchemaWriteEnv`/`RuntimeReplicationHost` 引用（本轮 grep）；index.ts/internal.ts 零 diff | ✅ |
| registry AGENTS「公共 API 仅经 src/index.ts；生命周期次序显式」 | `packages/namespace-registry/src/**` **零 diff**（本轮 `git diff --name-only` 核实）；reset 槽既有次序被机制性复用而非修改 | ✅ |
| docs AGENTS「代码行为变化时更新契约已变的规范文档」 | 本票是 ADR 0030 既定义务的兑现，零决策变更（ADR 0030 §4/§6 本已规定 watch-end）；CONTEXT 词条在 HEAD 已在；文档面归 T5 #391（SA8 分期批准）——无规范文档与实现矛盾 | ✅ |

### 1.2 ADR 符合性

| ADR 条款 | 实现落点 | 裁决 |
|---|---|---|
| 0030 §4：三 kind 封闭；`watch-end` 恰 `{kind,reason}` 两键、无 origin；流末条；终结三因封闭；数据缺席/删除从不终结 | watch-map.ts:526 `Object.freeze({kind:'watch-end',reason})` 恰两键；产出点**恰 3 处**（本轮 grep：schema-write.ts:323 / replication-session.ts:828 / runtime.ts:658）；reason 词表全仓恰 `'schema-changed'\|'doc-replaced'`；摘除集合 ⟹ 此后零入队点（结构性静默）；NC5 用例锁「缺席/删除不终结」 | ✅ |
| 0030 §5：绝不按 origin 过滤 | `classifyOrigin`（watch-map.ts:331–334）零改动；C1/C2/NC3 锁两态同流 FIFO | ✅ |
| 0030 §6：事务提交后异步分发、三来源全覆盖、回调 throw 静默隔离、有界队列 | 终止项复用订阅既有 FIFO 队列与泵（无第二通道——M1 变异被击穿为证）；逐 listener try/catch（X1）沿用；容量上界仍只治理 data 入队，终止项容量豁免（防「静默死亡」复活，设计 §7-D1-2 冻结，CAP 用例落盘） | ✅ |
| 0030 §7：终止编排归 runtime；registry 仅 lease 公共面；通知不出进程 | 机制全在 runtime 四文件；registry/lease/ws-replication/诊断面零 diff | ✅ |
| 0018 §1：R5.6 同步段位置、零新槽类型、槽继续 dirty/ACK | R5.7 在 `text` 变化块内、re-arm 结局与 failed-diag 配对之后、R6 之前；`void` fire-and-forget（不 await 投递） | ✅ |
| 0018 §3：re-arm fatal 双码、tools 不动、apply 不回滚 | R5.7 覆盖 applied/failed 两结局（B-T3-2 冻结 = 发）；fatal 结算路径逐字不动；C4b 锁 failed 分支 | ✅ |
| 0010 #133 round-2：fence 槽不创建/不等待 barrier；冻结次序（fence → closing → 唯一 barrier → 归档） | fence 槽体零改动（`createBeginResetFence` 仅改传参）；终止在槽后 lazy continuation 的关闭 admission 层（ADR 明文允许建 barrier 的层）；registry 槽 ⑥ `startCloseAfterFence()`（:1865）→ `forceReleaseOutstandingLeases`（:1866）→ `await closePromise`（:1884）→ archive（:1895）次序原样（本轮实读零 diff） | ✅ |
| 0009：release 幂等、released 通道 | lease.ts 零 diff；terminated 订阅经句柄 `unsubscribe()` no-op（watch-map.ts:503–506），force-release 清理收敛为 no-op、队列保全（M3 变异被击穿为证） | ✅ |
| 0027/0028、0011/0014：读面/诊断面冻结 | 读面三文件、诊断面包零 diff；C11 经 `expectReadDataOkKeys` 集中化形状门 | ✅ |

### 1.3 模块责任与架构惯例

| 检查 | 事实 | 裁决 |
|---|---|---|
| 责任归属 | 终止编排（簿记/入队/注销/投递结算）全在 runtime；registry 编排零改动即满足契约——与 ADR 0030 §7 分层逐字一致 | ✅ |
| 相似能力对照 | `watchHub.terminateAll(reason)` 沿 `createSessionFanout.terminateAll('runtime-close')` 命名与「快照迭代 + 摘除 + 幂等」先例（对象分立：订阅集 vs session 集）；env 字段加法沿 #286 `compile` 先例；构造栈捕获局部量纪律（INV-N14）延续 | ✅ |
| 单一事实源 | 订阅存续 = hub `subscriptions` 集合单点（`terminated`/`unsubscribed` 标志不镜像状态）；close 承诺 = `closePromise` 单缓存；schema 身份 = `state.activeTools`（终止只消费安装结果，无第二 schema 状态）；lease `activeWatches` 是清理登记非状态镜像 | ✅ |
| 生命周期对称性 | acquire `watchMap` ↔ release 三路（`unsubscribe` 幂等 / `terminateAll` 摘除+队尾终止项+drain 承诺 / `shutdown` 幂等防御收口）；observer 构造期挂接 ↔ shutdown 摘除（`shutdownDone` 幂等）；close admission 恰一次（缓存 + 早退）；barrier reject 时后置收口跳过 = 良性（terminated 已摘除、独立泵照送达——设计注记明文，禁止补第二可 reject 链，实现遵守） | ✅ |
| 平行机制 | 无第二投递通道/第二清理 worker/onEnd 回调/诊断承载——备选 Alt-1/2/4 均未复活 | ✅ |

### 1.4 关键机制独立复核（本轮亲证，非转述上游）

- **泵/终止无丢唤醒、无悬挂 drain**：`terminateAll` 同步段内「置 terminated → 摘除 → push →
  executor 同步置 `drainResolve` → `schedulePump`」与泵的让步后重检（:351）/`finally`
  （:367–371）在 run-to-completion 下无交错窗口；terminated 订阅 `unsubscribed` 恒 false
  （退订首行 no-op、shutdown 只作用集合内）⟹ 泵只以队空退出 ⟹ drain 恒 resolve。
- **B-T3-6 必达**：清队点穷举（主动退订 / lease 释放清理 / shutdown / 溢出降级）均不触
  terminated 队列——前三者结构性（no-op / 已摘除），溢出清队只在 `enqueueData` 路径。
- **close 承诺不变量**：`closeAfterFenceReset` 早退（:656）+ `close()` 早退（:904）双保险，
  admission 恰执行一次、两入口同一实例；`lazyCloseBarrier` 先置 barrier 后被 admission
  同步覆写，无观察窗口。
- **风味竞抢窗口**（公共 close 抢先于 `startCloseAfterFence`）：runtime seam 层可达但
  registry 层带活订阅结构性不可达（idle 相位门 / delete·reset 同 key carrier FIFO /
  shutdown 先 await carrier tail——SA2 S-4 核验成立，本轮复核 registry 代码一致）；
  设计 D5-c 明文语义、phase5 T2 既有断言锁死。
- **reset 承重次序**：`startCloseAfterFence()`（同步段完成终止入队）先于
  `forceReleaseOutstandingLeases`（lease.ts:232–244 清理经句柄 → terminated no-op）——
  registry 零 diff 下 `resetReplica` 结算即「流已含已投递末条」成立（C5 免 poll 断言）。

### 1.5 文件范围

| 检查 | 事实 | 裁决 |
|---|---|---|
| ALLOW 恰合 | 4 源文件 = 设计 §11 ALLOW 行 1–4；3 新测试文件（fixture + 主契约 + SA7 补充——SA7 补充属 dynamic-verify skill 允许的最小新增，SA4 §11 移交项） | ✅ |
| DENY 零触碰 | `git diff 28faeae..55900b1 -- packages/namespace-registry/src packages/namespace-runtime/src/{index,internal,close,schema-rearm,p0,write,read-schema-projection,window-read,projection}.ts` 等全空；ws-replication/docs/CONTEXT/诊断包零 diff；`.sa6-389/` 探针目录不存在；`git diff --check` 干净 | ✅ |
| 公共面零新增 | C11 断言 lease 16 键 / runtime 15 键 / kind ⊆ 三 kind 闭集；既有键集守卫（registry-open / phase5 r2 / exports-audit）在回归门 86/86 内绿 | ✅ |
| 测试可采集 | 两 `.test.ts` 命中 vitest include（`packages/*/test/**/*.test.ts`）；fixture 非 `.test.ts` 不被收集（#369/#387 先例）；`tsconfig.typecheck.json` 含新文件（EXIT=0 在案） | ✅ |

### 1.6 测试质量标准

| 标准 | 事实 | 裁决 |
|---|---|---|
| 真实 runner 触发、真实装配 | 真实 Registry（`createNamespaceRegistryForTesting`）+ 真实 Runtime（`createNamespaceRuntimeWithSeam`，`runtimeFactory` 既有测试 seam 保留引用——#387/#369 逐字先例） | ✅ |
| 断言纪律 | 形状全部 `toStrictEqual`（data 恰三键 / watch-end 恰两键 / 定位符恰两键、reason 逐字）；零 skip/only/todo、零 setTimeout/sleep、零 env override、零 `as any`/`@ts-ignore`（本轮 grep）；静默断言 = 后续写 + 微任务双预算 400（> 容量+1 × 20 让步上界）；等待 = `expect.poll` 5ms/2s 先例 | ✅ |
| 只经公共面 | 全部断言经 lease/registry 公共面与 stub 计数；scratch Y.Doc 仅用于构造远端 update（Yjs 确定性纪律，#387 家族同款） | ✅ |
| 红绿与首因 | 实现前 10 failed/7 passed（首因统一 = `waitForWatchEnd` 超时 = watch-end 缺席；装置自检 3 条绿证红不来自 fixture）→ 实现后 17/17；SA7 合跑 24/24、场景双跑零 flake | ✅ |
| 变异敏感度 | M1 绕队列→C8+CAP 红；M2 清队→C8 红；M3 撤退订豁免→C5+C10 红；M4 错 reason→C3 红——四类错误实现全击穿，注入全部还原 | ✅ |
| oracle 前置防误归因 | C4 断言 re-arm applied + 双侧指纹一致；C4b 断言 failed 分支可达；C3 用 text 实变信封（N-3 纪律，未设同文本零终止断言） | ✅ |
| 回归基线原样 | #387 21/21、#369 33/33、phase5 fence 7/7、round2 25/25（86/86）复跑绿；既有测试零 diff | ✅ |

---

## 2. Findings（全部 MINOR，非阻断）

| ID | 严重度 | 观察 | 依据与处置建议 |
|---|---|---|---|
| M1 | MINOR | **证据卫生**：`artifacts/sa3-issue389-test-typecheck.log` 为中间态 stale 捕获（含 4 条 TS 错误），与 SA3 §6.2-V5 引用它证明的 exit 0 相矛盾 | SA4 N-O1 已登记；最终事实由 SA4 独立 `tsc --noEmit`（exit 0）与 SA7 重捕 `artifacts/sa7-issue389-test-typecheck.log`（EXIT=0，本轮抽检）双重成立。该日志为 untracked 证据文件、不在提交内，不影响交付本体；建议收尾切片重捕或删除 |
| M2 | MINOR | **提交信息卫生**：最终提交 `feat(namespace): terminate change subscriptions` 缺 issue 引用与验证体——仓内惯例为 `type(#issue): 摘要`（如 `fix(#387): … (#395)`），SA3 §9 曾给出含验证摘要的建议信息 | 单行信息不影响代码与测试标准；PR 合并面可补救（标题带 #389 即链路闭合） |
| M3 | MINOR | **注释计数陈旧（pre-existing 携带）**：runtime.ts:675 附近被本 diff 重排的注释仍写「Object.keys 十二键审计」，runtime.ts:2 头注仍写「十四键公共面」——实际公共面 15 键（#387 第十五键已在 L286 注明） | `git log -S` 证实陈旧计数源自 #130/#369 时代、#387 未全量扫尾；本 diff 重排该注释行时顺带携带。键集真锚 = exports-audit/phase5/C11 测试（绿）。建议 T5 #391 文档轮顺带扫尾 |
| M4 | MINOR | **测试归并路由**：SA7 补充场景以独立 `issue-389-sa7-dynamic-verification.test.ts` 提交而非并入主契约文件 | SA7 §10 已声明「保留或收编归总控/契约加固轮（T4 #390）」；文件本身满足断言纪律且被 include 命中、双跑零 flake。非缺陷，属组织归属裁量 |

## 3. 复核边界声明

- 本轮为**标准符合性**审查：只判断实现是否符合 AGENTS/ADR/模块责任/架构惯例/单一事实源/
  生命周期对称/文件范围/测试质量标准；**不**重复裁决 issue 需求是否完整实现（SA10 域）、
  不重复运行动态验证（SA7 域）、不重复实现静态审查（SA4 域，其 approve 与本轮独立结论一致）。
- 本轮未修改任何代码/设计/测试；未运行测试或服务；只读 git/grep/sed + 实读文件。
- SA8 实现后冲突门（`task_issue-389_implementation_conflict_report.md`：clear /
  requiresConflictRecheck=false）的承重主张（产出点恰 3、reason 词表封闭两值、registry
  零 diff、键集不变）经本轮独立复核成立；本轮未发现新 ADR 冲突风险，requiresConflictRecheck
  不提交（= false）。

## 4. 结论

**approve** —— 已提交最终交付（commit `55900b1`）在全部九个标准维度上符合仓库与工程
标准：ADR 0030 §4–§7、ADR 0018 §1/§3、ADR 0010 #133 冻结次序、ADR 0009 释放语义逐条
落位；模块责任分层严格（registry/lease 零 diff）；单一事实源与生命周期对称性保持；
文件范围 ALLOW 恰合、DENY 零触碰、公共面零新增；测试真实、可判、变异敏感、纪律合规。
4 条 MINOR 均为卫生/路由类观察，不阻断批准。
