# SA6 诊断与验收契约 — issue #388 谓词订阅与宁多勿漏判定（变更订阅 T2）

- 任务类型：**feature**（能力缺口证明 + 目标行为验收契约；不虚构 Bug 根因）
- 被审对象：issue #388「谓词订阅与宁多勿漏判定（变更订阅 T2）」（brief `wiki/raw/task_issue-388.md`，
  8 条 AC；Parent PR #386 = ADR 0030 设计基座；Blocked by #387 已合入）
- Worktree / 基线：`/home/wangjian/nomicore-fix-issue-388`，branch `mabf/issue-388`，
  HEAD `28faeae`（`fix(#387): watchMap 无谓词形态垂直通路（变更订阅 T1/tracer bullet） (#395)`）
- 本轮 dispatch 明确：**只交付验收契约与诊断产物，不实现代码、不落盘测试**
  （「Cover the requested predicate vocabulary, validation failures, matching/no-match and
  conservative-notification semantics in an acceptance-focused artifact; do not implement code
  or tests」）→ 本报告为**契约规格 + 旧实现实测**；契约测试文件由后续实现相位按 §12.4 落盘。
- Owner 条款：issue #388 评论 **0 条**（dispatch owner feedback「REST comments read returned
  none」；`wiki/raw/task_issue-388_conflict_report.md` §2/§4 同口径）→ **无 owner 要求/override 需并入**。
- 结论：**`approve`（诊断与能力缺口可信、契约可执行、测试入口真实、证据足以进入设计）**；
  旧实现（HEAD `28faeae`）在**建立判定（谓词非法三情形静默接受）**、**精确降噪行**
  （新增非匹配条目通知、混合事务非匹配 key 未剔除、plain 快照旧态可判时未静默）与**类型面**
  （options 参数/别名/`WATCH_MAP_OPTIONS_INVALID` 全缺席）三处与目标断言冲突（§13 实测）；
  负控（T1 无谓词 21/21、registry 41 文件/496 用例、根 typecheck）全绿；唯一需 SA1 冻结的
  语义分叉是 **AC7 保守分支的执行粒度**（§12.1 B-6 / §15-1，默认按 AC7 逐字保守）。

---

## 1. Task type and inputs

| 输入 | 用途 | 状态 |
|---|---|---|
| `wiki/raw/task_issue-388.md` | Host brief：What to build（T1 通路上叠加谓词）+ AC1–AC8 + Blocked by #387 | 在场（35 行） |
| `wiki/raw/task_issue-388_relevant_decisions.md` | SA8 决策摘录（ADR 0030 §1–§7/验收、ADR 0028/0025/0008/0009/0023、CONTEXT、模块 AGENTS） | 在场（195 行） |
| `wiki/raw/task_issue-388_conflict_report.md` | SA8 前置门禁冲突报告：verdict clear、26 项对照（14 implements + 12 no-conflict）、0 override、requiresConflictRecheck=true、§8 六条 required actions | 在场（143 行） |
| `docs/adr/0030-change-subscription.md` | **规范权威**：§2 谓词词表（L20–31）/§3 建立判定（L33–39）/§5 宁多勿漏（L55–60）/§7 分层（L69–73）/验收缝（L88–97） | 在场（HEAD，零 diff） |
| `CONTEXT.md` L65–67「变更订阅」词条 | 词表/边界/`_Avoid_`（effect 分型、version/rev、混用） | 在场（HEAD） |
| 源码现状（T1 交付面） | `packages/namespace-runtime/src/watch-map.ts`（488 行）、`errors.ts` L241–255、`runtime.ts` L285–312/L753、registry `types.ts` L490–493/L749–752、`lease.ts` L330–360、两包 `index.ts` | 实读 |
| T1 契约三件套（先例形态） | `issue-387-watch-map-fixture.ts`（381 行）/`issue-387-watch-map-tracer-red.test.ts`（623 行）/`issue-387-watch-map-lease-surface.test-d.ts`（113 行） | 在场且绿（§4） |
| `wiki/raw/task_issue-387_sa6_contract.md` | T1 验收契约（绑定表 B-1–B-7、分期义务「T2 签名简写对账」、断言纪律/守卫门） | 在场（evidence 非规范） |
| 测试入口 | `vitest.config.ts` L15 `packages/*/test/**/*.test.ts`；L20 `packages/*/test/**/*.test-d.ts`；`tsconfig.typecheck.json` | 实读（§14） |
| 模块决策面 | `packages/namespace-runtime/AGENTS.md`（reads outside sequencer / 公共 API detached projections）、`packages/namespace-registry/AGENTS.md`（公共 API 仅经 `src/index.ts`） | 在场 |

## 2. Owner comment mapping

- issue #388 评论 = **0**（dispatch owner feedback；SA8 §2/§4 两处独立确认 `comments:[]`）。
- 因此**无 owner 条款需映射**；需求源 = issue body「What to build」+ AC1–AC8 + ADR 0030
  决策 2/3/5（简报自锚）+ CONTEXT 词条。
- 与既有票的边界（写进契约非目标，§12.1 非目标段）：`watch-end` 终止编排与 `'replication'` 验收（T3 #389）、
  队列溢出注入与**父路径/容器整替编排**（T4 #390）、文档缝（T5 #391）、数组载体订阅
  `watchArray`（v2）、`notEquals`/`and`/key 过滤（ADR 备选已否决）、含值通知/序号/对账（v2）。

## 3. SA8 constraints（前置门禁对本契约的硬约束）

| SA8 结论（来源） | 本契约落点 | 证据 |
|---|---|---|
| 26 项对照 0 hard-conflict / 0 evolution / 0 override；任务可进入设计 | 契约不引入任何 ADR 之外的行为面；全部行为逐条映射 ADR 0030 条款 | 冲突报告 §3/§7/§9 |
| Required action 1：**设计轮签名对账**——ADR §1 简写 `watchMap(path,{where?})` vs T1 冻结绑定 `watchMap(path, listener, options?)`，明示纯加法 + `Namespace{Runtime,Lease}WatchMapOptions` 别名引入 | §12.1 B-1/B-8；类型面契约 | 冲突报告 §8-1；`types.ts` L493 明文「T2 #388 随 `{where}` 加法引入」 |
| Required action 2：**新码 append-only 注册** `WATCH_MAP_OPTIONS_INVALID`（既有两码零改动；message 恒含码前缀、非空、可区分、零 path/身份回显） | §12.2 E11；§12.1 B-7 | 冲突报告 §8-2；`errors.ts` L241–255 |
| Required action 3：**建立门次序不回退**——谓词校验全部前置于登记（失败零订阅登记）；schema 门/载体门次序保持；数据缺席宽容不得引入 live 载体探测 | §12.1 B-9；§12.2 E8/E9；负控 NC3/NC6 | 冲突报告 §8-3；`watch-map.ts` L416–476 |
| Required action 4：**判定矩阵完备性**——锚定 AC 全集 = ADR 验收 L93 矩阵行；AC5「不匹配不通知」∧ AC7「保守通知」的合取边界须有显式矩阵行 | §12.2 判定矩阵 N 行（尤其 N2/N6 与 N7/N8/N9 的对偶） | 冲突报告 §8-4 |
| Required action 5：**槽外与零 throw 纪律延续**——谓词求值属观察器内纯读，不进 sequencer 槽、不得引入 observer 内 throw | §12.2 N15；§12.6-3 | 冲突报告 §8-5；`watch-map.ts` L374–392 |
| Required action 6：**实现后复查清单**（公共 API 加宽/新失败语义/矩阵红绿/DENY 面零 diff） | §10 影响面；§12.6 红线；§13 | 冲突报告 §8-6，`requiresConflictRecheck=true` |
| 冻结面：readData 四键 / 窗口读三码 / 复制 wire / 通知三 kind 与 data 形状 / 谓词封闭词表 / WATCH_MAP 既有两码 / lease 生命周期 / 诊断日志面 / Registry 服务字面量 / guard 信封面 | §12.6 红线；负控 NC2 | 冲突报告 §5 |

## 4. Environment and baseline

| 项 | 值 |
|---|---|
| 环境 | Linux；node `v24.13.0`；pnpm `10.28.2`；vitest `3.2.7`；typescript `5.9.3`；`maxWorkers: 1` |
| 依赖 | 本 worktree 起始**无 `node_modules`** → `pnpm install --frozen-lockfile` → **exit 0**（本地 store 454ms，`artifacts/sa6-issue388-install.log`）；此后全部基线/探针直跑 |
| T1 行为契约（基线） | `npx vitest run .../issue-387-watch-map-tracer-red.test.ts --typecheck.enabled=false` → **21/21 绿、exit 0**（`-baseline-t1-behavior.log`） |
| T1 类型契约（基线） | `npx vitest run --typecheck .../issue-387-watch-map-lease-surface.test-d.ts` → **2 tests passed / Type Errors: no errors、exit 0**（`-baseline-t1-surface.log`） |
| registry 包基线 | `npx vitest run packages/namespace-registry --typecheck.enabled=false` → **41 files / 496 tests 全绿、exit 0**（`-baseline-registry.log`） |
| 根 typecheck 基线 | `pnpm typecheck` → **exit 0**（14 个 tsconfig 全过，`-baseline-typecheck.log`） |
| 测试入口 | `vitest.config.ts` L15 runtime include `packages/*/test/**/*.test.ts`；L20 typecheck include `packages/*/test/**/*.test-d.ts`；`tsconfig.typecheck.json` include `packages/*/test/**/*.ts` |
| 本轮新增产物 | 本报告 + 基线/探针日志（`artifacts/sa6-issue388-*.log`）；**零生产实现改动、零测试文件新增**（§16） |
| HEAD 分区 | T1 `watch-map.ts` L36–38 明文边界：谓词 `where`/`WATCH_MAP_OPTIONS_INVALID` 属 T2 #388；`errors.ts` L241–255 只注册两码；registry `types.ts` L490–493 明文无 options 参数（T2 加法位） |

## 5. Positive reproduction（能力缺口；feature 的「正例」= 目标能力整体不存在）

**证据 1 — 运行时面（真实 Registry 装配探针，`artifacts/sa6-issue388-probe-gap.log`）**：

```text
lease.watchMap.type = function
lease.watchMap.arity(length) = 2                       // 第三参 options 槽位不存在
lease keys = [...15 键 + "watchMap"]                    // lease 恰 16 键（T1 面；无 options 参数）
establish[where.equals(status=open)]          = RETURNED handle=function
establish[where.in[] (ADR 0030 §2 空数组非法)] = RETURNED handle=function   // 应 thrown WATCH_MAP_OPTIONS_INVALID
establish[where.field-missing]                = RETURNED handle=function   // 应 thrown
establish[where.field-nonscalar (sub 嵌套 YMap)] = RETURNED handle=function // 应 thrown
establish[where.shape-violation (无算子键)]    = RETURNED handle=function   // 应 fail-closed
establish[where.extra-word (notEquals 不在词表)] = RETURNED handle=function  // 应 fail-closed
notify_after_nonmatching_change = 7             // 非匹配条目变更照常通知（谓词被整体忽略）
notify_after_same_value_write = 0               // T1 真变判定在产（同值写过滤）
notify_after_matching_entry_change = 7
readData.ok = true keys = ["ok","schema","truncated","value"]   // 读面在产（负控）
readMap.ok = true entries = 2
```

**证据 2 — 判定矩阵 HEAD 实测（`artifacts/sa6-issue388-probe-matrix-head.log`；谓词
`{field:'status', equals:'open'}`，容器 `tasks`，t1.status='open'、t2.status='done'）**：

```text
R1 匹配条目 in-place title 变更      | ok=true | HEAD notify=1 | keys=[["t1"]]
R2 非匹配条目 in-place title 变更    | ok=true | HEAD notify=1 | keys=[["t2"]]
R3 退出匹配集（t1 open→done）        | ok=true | HEAD notify=1 | keys=[["t1"]]
R4 进入匹配集（t2 done→open）        | ok=true | HEAD notify=1 | keys=[["t2"]]
R5 同值写（t2 open→open）            | ok=true | HEAD notify=0 | keys=[]
R6 非匹配整值替换（t2 open→closed）  | ok=true | HEAD notify=1 | keys=[["t2"]]
R7 新增非匹配条目（t9 status done）  | ok=true | HEAD notify=1 | keys=[["t9"]]   ← 目标应为 0（旧态=缺席可判）
R8 plain 条目整值替换（t3 done→closed，oldValue 为 plain 快照）| HEAD notify=1 | keys=[["t3"]] ← 目标应为 0
```

**证据 3 — 混合事务按 key 过滤（`artifacts/sa6-issue388-probe-mixed-gates.log`）**：

```text
P1 批量新增（t9 匹配 + t10 非匹配）| ok=true | HEAD notify=1 | keys=[["t9","t10"]]   ← 目标 keys 恰 [t9]
P2 非法路径 + 非法谓词  -> THREW WATCH_MAP_CARRIER_MISMATCH   （载体门先，须保持）
P3 alias 字段（type Status = YLeaf<string>）-> RETURNED handle
P4 字面量域字段（state: "open"|"done"）    -> RETURNED handle
P5 released lease + 非法谓词 -> THREW NAMESPACE_LEASE_RELEASED（released 短路先，须保持）
P6 legacy（无 active schema）+ 非法谓词 -> THREW WATCH_MAP_SCHEMA_UNAVAILABLE（schema 门先，须保持）
```

**证据 4 — 类型面/源码面（静态实读，零命中）**：

```text
grep -rn "where\b" packages/namespace-runtime/src packages/namespace-registry/src
  → 仅两处注释（watch-map.ts L36；types.ts L493），零实现
grep -rn "WATCH_MAP_OPTIONS_INVALID|WatchMapOptions|ScalarValue" packages/*/src
  → 仅 watch-map.ts L36 注释一处
runtime.ts L309–312：readonly watchMap: (path, listener) => Handle       // 2 参，无 options
registry types.ts L749–752：watchMap(path, listener): Handle             // 2 参，无 options
两包 index.ts：导出 WatchMapNotification/Change/Handle 三类型，无 *Options
errors.ts L241–255：WatchMapErrorCode = CARRIER_MISMATCH | SCHEMA_UNAVAILABLE（新码缺席）
```

（旧实现下目标断言的**首红位**：谓词非法三情形与 fail-closed 形态 → 今日静默建立；
R7/P1/R8 三条精确降噪行 → 今日多通知；类型面 → 今日 `watchMap(path, listener, {where})`
在 `tsc` 下报 excess property / 实参个数错误。）

## 6. Negative control（当前全绿；实现后必须保持全绿）

| # | 断言 | 证明什么 | 本轮实测 |
|---|---|---|---|
| NC1 | T1 无谓词契约 21/21（能力存在性、E1–E6、N1–N4、B1–B2、D1–D2、X1、L1–L2、P1/P2、NC1） | T2 是**纯加法**：无 options 形态行为零改动（AC 非目标面不回退） | **绿**（`-baseline-t1-behavior.log`，exit 0） |
| NC2 | readData 恒四键 `{ok,value,schema,truncated}`；`readMap(['tasks'],{n})` 在产；窗口读三码/复制面/诊断面零 diff | 冻结面零改动（ADR 0030 状态行 + SA8 §5） | **绿**（探针证据 1；registry 41/496） |
| NC3 | 建立门次序：released→`NAMESPACE_LEASE_RELEASED`；无 active schema→`WATCH_MAP_SCHEMA_UNAVAILABLE`；非法 path/载体→`WATCH_MAP_CARRIER_MISMATCH`；四者先于谓词门 | 谓词校验插入不回退既有门（SA8 action 3） | **绿**（P2/P5/P6；`-probe-mixed-gates.log`） |
| NC4 | registry 包 41 文件/496 用例全绿 + 根 `pnpm typecheck` exit 0 | 实现前全网健康锚；无预存在红 | **绿**（§4） |
| NC5 | 同值写零通知（R5=0；Yjs 事件 `keys=[{status,update,oldValue:"open"}]` 在产） | 真变判定（AC4）不被谓词改造破坏 | **绿**（R5；`-probe-yjs-facts.log` Y2） |
| NC6 | 数据缺席合法：schema 已声明容器未物化/已删除仍建立成功；谓词校验纯 schema 侧（零 live 载体探测） | 谓词求值便利不得引入载体探测 | **绿**（T1 E3；实现后 E9 复验） |
| NC7 | 通知形状：`data` 恰三键、定位符恰两键、三 kind 闭集、JSON 不含值 | 谓词只改「是否通知」，不改载荷（ADR §4 零改动） | **绿**（探针证据 1 payload；T1 N1） |

## 7. Stability, scale and timing

- **确定性**：全部探针为进程内同步/微任务级行为，零时钟、零网络、零外部服务；同一 HEAD 下
  多轮探针输出逐字同构（`-probe-gap` / `-probe-matrix-head` / `-probe-mixed-gates` /
  `-probe-yjs-facts` 对同一场景给出相同 notify 计数与 keys）。
- **分发时序**：T1 单飞微任务泵每项投递前让步 20 次微任务（`watch-map.ts` L100–103/L318–341）；
  探针以 macrotask settle(30–60ms) 观察，notify 计数稳定。契约测试的等待纪律 = `expect.poll`
  （5ms 间隔 / 2s 上限）+ **屏障**（后续事务或第二订阅），禁止 sleep 竞猜（§12.6-3）。
- **规模**：tracer 最小输入 = 2–3 条目/容器（本契约矩阵同规模）；零性能断言（避免 CI 抖动）。
- **无竞态**：`maxWorkers: 1`；订阅/事务/分发全在单线程；`subscriptions` 集合遍历 + 单飞泵
  无交错（T1 已验证 21/21 稳定）。
- **探针异常项（诚实记录）**：`-probe-plain-entry.log` 的 C 段在事件句柄返回后再读
  `event.changes` 触发 Yjs「must not compute changes after the event-handler fired」——
  属**探针自身缺陷**（非产品行为）；同结论（受控写拒绝 plain 容器条目、旧 Y.Map 内容清空）
  已由 `-probe-plain-replace.log`、`-probe-oldvalue-identity.log`（在 handler 内读取）复测。

## 8. Capability gap chain（feature：能力缺口链）

| Step | 事实 | 证据 | 置信度 |
|---|---|---|---|
| 症状 | T1 交付的无谓词信号面**只做真变过滤**：任何条目的真变都通知（含与消费方视图无关的条目），消费方仍要按 key 全量补拉；谓词订阅（AC1 词表）不存在 | §5 证据 2（R2/R6/R7 全通知）；ADR 0030 背景/§5 | 高（实测） |
| 直接缺口 | `lease.watchMap` 签名 `(path, listener)`（arity=2），第三参 `{where}` 被静默忽略；`WatchMapErrorCode` 无 `WATCH_MAP_OPTIONS_INVALID`；两包 `index.ts` 无 `*WatchMapOptions` 类型 | §5 证据 1/4 | 高（实测） |
| 实现层缺口 | runtime 无谓词求值、无「新旧匹配态」判定、无建立期谓词校验；registry 无 options 透传与别名 | `watch-map.ts` L36–38（T2 非目标注释）、L416–476（建立六门无谓词门）、L262–290（collectChanges 无谓词） | 高（源码实读） |
| 触发条件 | 消费方（DSH agent/宿主 UI）需要「只订阅匹配条目的失效信号」以降噪；无谓词形态下每次无关条目变更都触发补拉，降噪是谓词的存在理由（issue AC5） | issue What-to-build；ADR §5 L58 | 高（决策） |
| 最深根因（本票） | T2 从未交付：谓词词表/建立判定/宁多勿漏判定矩阵缺失；T1 有意留白（`watch-map.ts` L36–38 与 registry `types.ts` L493 明文预留） | 源码实读；T1 SA6 §12.2 非目标行 | 高 |
| 放大因素 | 缺谓词时「多通知」虽不违反宁多勿漏，但把降噪/补拉成本转嫁消费方；且**非法谓词静默建立**会把配置错误伪装成恒不匹配死订阅（最坏结局 = 静默死亡，ADR 备选 L85） | §5 证据 1 建立行；ADR L29/L85 | 高（实测 + 决策） |
| 未证实假设/待冻结 | AC7 保守分支执行粒度（§15-1）；标量域闭包对 `union`/`scalar.type:'null'\|'unknown'`（§15-2）；`where` 形态错误的 fail-closed 词表（§15-3）；标量相等边界 NaN/±0（§15-4）；options 别名命名（§15-5） | §12.1 / §15 | 高（文本缺口实测确认） |
| 已排除项 | 能力已存在但命名不同 / 红在环境 fixture 或入口 / 谓词可由 guard 或窗口读替代 —— 见 §11 | §11 | 高 |

## 9. Causal experiments（控制变量 / 反证）

1. **同装配控制变量**：同一 Registry 装配下 lease 恰 16 键（含 T1 `watchMap`）、readData/readMap
   在产，仅谓词面缺席；同一 fixture 的 R1/R3/R4（应通知）已绿，R7/P1/R8（应静默）红 →
   差异只可能来自谓词求值/建立判定缺失，排除安装/条件导出（`--conditions=nomicore-source` 生效）。
2. **Yjs delta 事实（谓词判定可行性锚）**（`-probe-yjs-facts.log`）：

   ```text
   Y1 in-place 字段写(t2.title)  → 事件 path=["tasks","t2"] keys=[{title,update,oldValue:"beta"}]
                                    （条目级事件；容器浅 delta 无该条目记录）
   Y2 同值写(t1.status=open)     → keys=[{status,update,oldValue:"open"}]（载体 delta 存在）
   Y3 整值 set(t2 plain value)   → 事件 path=["tasks"] keys=[{t2,update,oldValue:Y.Map}]（oldValue 非当前对象）
   Y4 add(t3)                    → keys=[{t3,add,oldValue:undefined}]
   Y5 delete(t3)                 → keys=[{t3,delete,oldValue:Y.Map}]
   ```

3. **旧态可判性（保守分支的因果来源）**（`-probe-oldvalue-identity.log`，在 handler 内读取）：

   ```text
   W1 整值替换 t2(done→closed) → oldValue === 原 t2 对象（identity=true），但其 get('status')=undefined、
                                 toJSON()={}  ← Yjs 删除旧子类型内容 → 旧态不可判 → 保守通知
   W2 delete t1(匹配 open 删除) → oldValue 的 Y.Map 内容同样清空 → 旧态不可判 → 保守通知
   ```

   ⇒ 「旧态不可判」在 T2 有两条实测来源：① in-place 部分更新（条目级事件，容器浅 delta 无条目级
   oldValue）；② 整值替换/删除 live `Y.Map` 条目（oldValue 引用在场但内容已清空）。ADR L59
   的「plain object 条目恒整值 set、oldValue 恒在场、判定恒精确」仅在 **oldValue 是 plain 快照**
   时成立：`-probe-plain-oldvalue.log` 实测 raw 替换 plain 条目 t3 时
   `oldValueKind=plain, oldPlainStatus="done", newStatus="closed"`（新旧两态皆可读 → 精确判定）；
   `-probe-plain-entry.log`/`-probe-oldvalue-identity.log` 为 live `Y.Map` 条目的对照（内容清空
   → 不可判）。

4. **Schema 侧字段域事实（建立判定可行性锚）**（`-probe-schema-facts.log`）：

   ```text
   resolveSchemaAtPath(derived, ['tasks'])        → {kind:'object', fields:[{name:'<key>', value:{kind:'ref',name:'Task'}}]}
   resolveSchemaAtPath(..., ['tasks','k'])        → {kind:'ref', name:'Task'}
   ['tasks','k','title']  → {kind:'scalar', type:'string'}
   ['tasks','k','status'] → {kind:'ref', name:'Status'}（别名闭包 values.Status = {kind:'scalar',type:'string'}）
   ['tasks','k','state']  → {kind:'enum', values:['open','done']}
   ['tasks','k','nested'] → {kind:'object', ...}   // 非标量域
   ['tasks','k','tags']   → {kind:'array', element:{...}} // 非标量域
   ['tasks','k','note']   → {kind:'optional', value:{kind:'scalar',...}}  // 可选包装透明
   ['tasks','k','missing']→ {ok:false, code:'SCHEMA_PATH_NOT_FOUND'}
   ```

   ⇒ 「field 不存在 / 非标量域」可由纯 schema 侧解析判定（ref 追尽 + optional 透明），零 live
   载体探测（满足 SA8 action 3 与 ADR L38「数据缺席合法」）。

5. **门次序控制变量**（P2/P5/P6）：非法谓词与更早门同时在场时，抛出的仍是既有码
   （CARRIER_MISMATCH / SCHEMA_UNAVAILABLE / NAMESPACE_LEASE_RELEASED）⇒ 谓词门是**第六门**、
   在登记前、在既有五门之后。
6. **旧实现归因**：R7/P1/R8 的红**不是** fixture 或入口错误——同场 R1/R3/R4/R5 的 notify 计数
   与目标语义一致（谓词被忽略时「应通知」的行天然绿），唯一差异是**是否按谓词过滤**；
   E4–E7 的红是「不存在的校验」而非「校验抛错」。
7. **反伪绿**：目标矩阵行分三类（必须通知 / 必须静默 / 允许保守），不把「多通知」写成 red；
   R2/R6 这类保守行在 HEAD 也是 notify=1（**行为上绿**），契约因此**不以其红绿作为能力缺口证据**，
   只作为 AC7 语义矩阵行（§12.2）。

## 10. Impact surface

| 面 | 预计改动 | 约束 |
|---|---|---|
| `packages/namespace-runtime/src/watch-map.ts` | 谓词求值 + 新旧匹配态判定 + 保守分支 + 建立第⑥门（谓词校验，登记前） | 纯读、零 throw、槽外；分发/队列/通知形状零改动（L36–38 边界注释同步更新） |
| `packages/namespace-runtime/src/errors.ts` | `WATCH_MAP_OPTIONS_INVALID` append-only 进 `WatchMapErrorCode`（既有两码零改动） | 码前缀 + 非空 + 可区分 + 零 path/身份回显（SA8 action 2） |
| `packages/namespace-runtime/src/runtime.ts` / `index.ts` | `watchMap(path, listener, options?)` 加法加宽 + `NamespaceRuntimeWatchMapOptions`（+ 标量值类型）导出 | 公共 API 仅经 `src/index.ts`；T1 三别名零改动 |
| `packages/namespace-registry/src/types.ts` / `lease.ts` / `index.ts` | lease 签名加宽、options raw 透传（lease 层零解释）、`NamespaceLeaseWatchMapOptions` 别名 + Equal 锁 | lease 16 键面保持（**不新增键**）；released 短路先于透传 |
| 既有守卫测试（实现期同步更新） | lease 键集守卫（16 键不变）、别名 Equal 锁断言、`*.test-d.ts` surface | 既有键全数保留；值导出面不变 |
| 冻结面（零改动） | readData / 窗口读 `readArray`/`readMap` / 复制面 / 诊断日志 / wire / 持久化 / guard 信封面 | §12.6 红线；NC2 |
| 测试面（实现相位落盘） | `issue-388-watch-map-predicate-*` 三件套（§12.4）；runner 经既有 include 采集 | 不得 skip/only/todo/env override |
| 文档面（T5 #391 正位） | CONTEXT 词条已覆盖谓词口径（L65–67），本票零文档改动 | 勿在 T2 抢跑 T5 |

## 11. Ruled-out hypotheses

| 假设 | 结论 | 反证 |
|---|---|---|
| 1. 谓词能力已存在（命名不同/内部通路） | **排除** | lease arity=2、第三参被忽略；`where`/`WATCH_MAP_OPTIONS_INVALID`/`*Options` 全树零实现命中；R7/P1/R8 多通知实测 |
| 2. 红灯来自环境/安装/入口 | **排除** | 安装 exit 0；T1 21/21、registry 496/496、根 typecheck exit 0；同场读面/无谓词面全绿 |
| 3. 红灯来自 fixture 构造错误 | **排除** | 探针 5 组独立装配（Y.Map 条目 / plain 容器 / plain 条目 / legacy / released）前提全部在产（R1/R5/P3/P4/P6 行为符合预期） |
| 4. 谓词可由 guard（ADR 0025）或窗口读（ADR 0028）替代 | **排除** | guard 是写条件、窗口读是拉取选择器；两者都不产生订阅信号；ADR 0030 §7 L71–73 明确谓词求值归 runtime 订阅面 |
| 5. 「不匹配条目不通知」是无条件规则（AC5 字面） | **排除（合取解释）** | ADR L57 条件式 = 真变 ∧（无谓词 ∨ 新旧匹配态任一成立 ∨ 旧态不可判保守）；AC7 明确嵌套 Y.Map 部分更新 → 保守通知。矩阵 N2/N6 与 N7/N8/N9 即该合取边界的显式行（SA8 action 4） |
| 6. plain object 条目的 oldValue 恒可读（照抄 ADR 字面） | **部分排除（实测收窄）** | live `Y.Map` 条目的整值替换/删除后 oldValue 内容被 Yjs 清空（W1/W2：`get()`=undefined、`toJSON()`={}）；「恒精确」只对 **plain 快照 oldValue** 成立 → 契约把载体/可判性写成显式矩阵列 |
| 7. 异步分发的不确定性使矩阵不可判 | **排除** | 探针多轮 notify 计数逐字同构；契约等待纪律 = poll + 屏障（无 sleep 断言） |
| 8. 契约可用源码字符串/正则断言替代行为验证 | **排除** | 本契约全部断言锚定 lease 公共面运行时结果、通知流对象与类型系统；零 grep/源码文本断言（§12.6-1） |
| 9. 容器整替（父路径事件）属 T2 | **排除（边界）** | 实测：plain 容器整替换受控写被拒（`-probe-plain-entry.log` A1）；整容器替换事件 = C-3 粗粒度路径 → T1 今日零条目定位符（`-probe-plain-replace.log` N1）；父路径/容器整替编排归 T4 #390（SA8 §3 行 18） |

## 12. Acceptance contract and test paths

### 12.1 契约绑定表（默认值；SA1 冻结项标 ★）

| # | 绑定 | 契约默认取值 | 依据 / 若 SA1 另择的处置 |
|---|---|---|---|
| B-1 | 方法签名（纯加法） | `watchMap(path, listener, options?) → { unsubscribe }`；`path` 同 `readMap` 路径面；无 options = T1 行为逐字不变 | ADR §1 简写 + §6 回调；T1 SA6 B-1/B-2 冻结（分期义务对账）；registry `types.ts` L493 预留位 |
| B-2 | `options.where` 词形（封闭小集） | 恰两算子：`{ field: string; equals: ScalarValue }` \| `{ field: string; in: ScalarValue[] }`；两算子互斥且必居其一；**未知键/缺算子/双算子 fail-closed** | ADR §2 L23–25/L30–31；★部分（形态错误码归属 SA1 冻结，默认 `WATCH_MAP_OPTIONS_INVALID`） |
| B-3 | `field` 语义 | 恰单段属性名（不做路径解析；`'a.b'` 视为字面属性名）；解析基准 = 订阅容器**条目值 schema**（container valueSchema 的元素域；`ref` 追尽、`optional` 透明） | ADR §2 L27；窗口读 `field` 单段先例（ADR 0028 L31）；探针 §9-4 |
| B-4 | 标量域闭包 | 标量域 = `{kind:'scalar', type:'string'\|'number'\|'boolean'}` \| `{kind:'enum'}` \| `{kind:'pattern'}` \| `{kind:'int'}` \| `{kind:'range'}`；非标量 = `object` / `array` / `xml` / `union`（含容器成员）→ 拒绝 | ADR §2 L27「值域恒标量（string/number/boolean/字面量）」；`derived.ts` L44–58；★`union`/`scalar.type:'null'\|'unknown'` 边界 SA1 冻结（默认 fail-closed 拒绝） |
| B-5 | 标量相等语义 | `equals` = 标量相等；`in` = 集合成员（顺序无关、去重）；承重断言只用无歧义值（`'open'`、`1`、`true`） | ADR §2 L29；★NaN/±0/负零边界 SA1 冻结（不进承重行） |
| B-6 | 判定条件（AC5 ∧ AC7 合取） | 通知 ⟺ 真变（T1 `isRealChange`）∧（无谓词 ∨ `oldMatch` ∨ `newMatch` ∨ **旧态不可判 → 保守通知**）；`oldMatch`/`newMatch` 均为「条目投影值在该 field 上匹配谓词」 | ADR §5 L57（条件式）L59（旧态不可判两来源）；issue AC5/AC7；★保守分支粒度见 §15-1 |
| B-7 | 新失败语义 | 谓词非法（field 不存在 / 非标量域 / `in` 空数组 + ★形态错误 fail-closed）→ 同步 throw `WatchMapError('WATCH_MAP_OPTIONS_INVALID', …)`；message 含码前缀、非空、可区分、零 path/身份回显 | ADR §3 L37；`errors.ts` L241–255 注册纪律（SA8 action 2） |
| B-8 | 类型别名 | `NamespaceRuntimeWatchMapOptions` + `NamespaceLeaseWatchMapOptions`（Equal 锁，沿 `Namespace{Runtime,Lease}WatchMap*` 公式）；标量值类型名 ★SA1 冻结（默认 `ScalarValue = string \| number \| boolean`） | 冲突报告 §8-1；T1 三别名先例（`lease.ts` L499–514） |
| B-9 | 建立门次序 | ① lifecycle → ② listener 形状 → ③ schema 可用 → ③b ROOT 载体 → ④ path 快照 → ⑤ schema 分类（载体）→ ⑥ **谓词校验** → ⑦ 登记；失败路径零订阅登记 | SA8 action 3；`watch-map.ts` L416–476（T1 六门）；探针 P2/P5/P6 |
| B-10 | 通知载荷 | 零改动：三 kind 闭集、`data` 恰三键 `{kind,origin,changes}`、定位符恰两键 `{path,key}`、不含值；谓词只影响「是否通知」与 `changes` 的 key 集合 | ADR §4 L44–53；SA8 §5 冻结面；issue 零载荷条目 |

**非目标（不得越界）**：`watch-end`/复制 origin 验收（T3 #389）；`invalidate-all` 溢出注入与父路径/
容器整替编排（T4 #390）；文档缝（T5 #391）；`notEquals`/`and`/key 过滤/数组载体/含值通知/序号对账
（ADR 备选 L78–L84 + 开放问题）。

### 12.2 判定矩阵（AC ↔ 可执行用例；**本契约核心**）

记号：容器 `tasks: Record<string, Task>`；`Task = YMap<{ title: YLeaf<string>; status?: YLeaf<string>;
sub?: YMap<{ x: YLeaf<string> }> }>`；谓词 P = `{ field:'status', equals:'open' }`（除注明外）。
「HEAD 实测」= HEAD `28faeae` 且第三参被忽略；「目标」= 实现后契约断言。

| 行 | 触发（最小输入） | 判定依据 | HEAD 实测 | 目标断言 | 性质 |
|---|---|---|---|---|---|
| **N1** | t1.status='open'，in-place 改 `t1.title` | 真变 ∧ newMatch | notify=1 `[t1]` | **通知**，含 key `t1` | 承重（no-miss） |
| **N2** | t2.status='done'（非匹配），in-place 改 `t2.title` | AC7：旧态不可判 → 保守 | notify=1 `[t2]` | **通知**（保守分支；AC7 逐字） | ★SA1 冻结（§15-1） |
| **N3** | t1.status 'open'→'done'（退出匹配集） | oldMatch=true | notify=1 `[t1]` | **通知**，含 key `t1`（AC6） | 承重（no-miss） |
| **N4** | t2.status 'done'→'open'（进入匹配集） | newMatch=true | notify=1 `[t2]` | **通知** | 承重（no-miss） |
| **N5** | t2.status='open' 同值写 | 真变判定 = false | notify=0 | **零通知**（AC4 语义过滤 ∧ 谓词） | 承重（反伪红） |
| **N6** | t2.status='done'，整值替换 `{title:'beta-2',status:'closed'}` | 旧 `Y.Map` 内容清空（W1）→ 保守 | notify=1 `[t2]` | **通知**（保守分支） | 承重（保守面） |
| **N7** | 新增 t9（`status:'done'`，非匹配） | add → 旧态=缺席（可判）；newMatch=false | notify=1 `[t9]` | **零通知** | **承重（首红行）** |
| **N8** | 批量新增 t9（匹配）+ t10（非匹配） | 逐 key 精确过滤（adds 可判） | notify=1 `[t9,t10]` | **通知恰含 `t9`**（`t10` 剔除） | **承重（首红行）** |
| **N9** | plain 条目 t3（`status:'done'`）整值替换为 `{status:'closed'}`（raw/复制 apply 驱动；oldValue 为 plain 快照） | 旧态可读（ADR L59）→ 精确 | notify=1 `[t3]` | **零通知** | **承重（首红行）** |
| **N10** | plain 条目 t3 'done'→'open'（进入）/ 反向（退出） | old/new 可读 | notify=1 | **通知** | 承重（no-miss） |
| **N11** | 条目无 `status`（可选字段缺失）或值 null：in-place 改兄弟字段 / 整值替换 / 新增 | ADR §2：缺失/null **恒不匹配**，不抛 | notify=1（in-place/替换）；add 视 N7 | **不匹配**（不抛、不产生 error kind）；通知行为按载体行：in-place/替换 → 通知（保守），add/plain → 零通知 | 承重（AC3）+ 边界 |
| **N12** | `in: ['open','open','blocked']` 与 `in: ['blocked','open']` 行为等价；`in: []` 建立拒绝 | 集合语义（顺序无关、去重） | 两形态均建立且不过滤 | 两形态行为**逐字节同构**；空数组 → `WATCH_MAP_OPTIONS_INVALID` | 承重（AC1） |
| **N13** | 任意匹配行通知 | 载荷零改动 | 三键/两键形状在产 | `{kind,origin,changes}` 恰三键、定位符恰两键、JSON 不含值、kind ∈ 三 kind 闭集 | 承重（冻结面） |
| **N14** | 建立后 `unsubscribe()` 重复调用 / lease 释放后写 | T1 生命周期 | 21/21 绿 | 退订幂等零回声；释放清理谓词订阅（T1 行保持） | 承重（零回归） |
| **N15** | 谓词求值期数据异常（非标量值、字段缺失、深层数据） + 后续合法写 | 槽外零 throw 红线 | mutateData ok；写不 fatal | 求值不抛、写结果不变、通知流无 error kind、订阅存活 | 承重（SA8 action 5） |

**建立判定矩阵（E 行）**：

| 行 | 触发 | 目标断言 | HEAD 实测 |
|---|---|---|---|
| E1 | `{field:'title', equals:'alpha'}`（标量叶） | 建立成功，句柄恰 `{unsubscribe}` | 建立成功（但不过滤） |
| E2 | `{field:'priority', in:[9,2]}`（非空、乱序） | 建立成功 | 建立成功（但不过滤） |
| E3 | alias 字段（`Status`）/ 字面量域（`state: "open"\|"done"`）/ 可选标量（`note?`） | 三类均建立成功（ref 追尽 + optional 透明 + enum ∈ 标量域） | 建立成功（P3/P4） |
| E4 | `{field:'missing', equals:'x'}`（field 不存在） | **`WATCH_MAP_OPTIONS_INVALID`** + 零登记 | 静默建立 ← 红 |
| E5 | `{field:'sub', equals:'nested'}`（非标量域：嵌套 YMap）；同族 array/xml/union-with-container | **`WATCH_MAP_OPTIONS_INVALID`** + 零登记 | 静默建立 ← 红 |
| E5b | 标量条目容器（封闭对象 map `meta` / `Record<string, scalar>`）上的任意 `field` | **`WATCH_MAP_OPTIONS_INVALID`**（条目无成员；key 级过滤不在词表） | 静默建立 ← 红 |
| E6 | `{field:'status', in: []}` | **`WATCH_MAP_OPTIONS_INVALID`** + 零登记 | 静默建立 ← 红 |
| E7 ★ | 形态错误：无算子 / 双算子 / 未知键（`notEquals`）/ 非标量算子 / `field` 非 string | **`WATCH_MAP_OPTIONS_INVALID`**（fail-closed） | 静默建立 ← 红 |
| E8 | 门次序：released / lifecycle≠ready / 无 active schema / 非法 path+非法谓词 | 抛更早门的既有码（P2/P5/P6） | 绿（必须保持，NC3） |
| E9 | 数据缺席容器（未物化/已删除）+ 合法谓词 | 建立成功（纯 schema 侧；零 live 载体探测） | 绿（T1 E3） |
| E10 | 省略 options | T1 行为逐字不变（NC1） | 21/21 绿 |
| E11 | 码注册与 message 纪律 | `WATCH_MAP_OPTIONS_INVALID` append-only 进 `WatchMapErrorCode`；既有两码零改动；message 含码前缀、非空、可区分、零回显 | 码缺席 ← 红 |

### 12.3 最小输入与期望（旧实现 vs 目标实现）

**最小 fixture**（实现相位按 §12.4 落盘；形态沿 T1 fixture）：

```vfsl
type Status = YLeaf<string>;
type Task = YMap<{
  /** 任务标题 */        title:  YLeaf<string>;
  /** 任务状态（可选：缺失/null 恒不匹配） */ status?: Status;
  /** 字面量域 */        state:  "open" | "done";
  /** 优先级 */          priority: YLeaf<number>;
  /** 嵌套子容器（非标量域） */ sub?: YMap<{ x: YLeaf<string> }>;
}>;
type ROOT = YMap<{
  /** 任务表（Y.Map 载体 + 条目） */ tasks:  Record<string, Task>;   // t1(open) t2(done) t3(缺失 status)
  /** plain 条目载体（raw/复制 apply 驱动 N9/N10） */ plainTasks: Record<string, Task>;
  /** 数组载体（载体门负控） */ workRecords: YLeaf<number>[];
  /** 根标量（非容器负控） */ title: YLeaf<string>;
}>;
```

**最小调用（首红行 N7）**：`open lease` → `lease.watchMap(['tasks'], sink.listener,
{ where: { field: 'status', equals: 'open' } })` → `mutateData({op:'set', path:['tasks','t9'],
value:{title:'gamma', status:'done', state:'done', priority:1}})` → **零通知**（HEAD：1 条
`{kind:'data',origin:'local',changes:[{path:['tasks'],key:'t9'}]}`）。

**旧实现（HEAD `28faeae`）对照**：E4–E7/E5b 静默建立（目标应 throw，§5 证据 1）；
N7/N8/N9 多通知（§5 证据 2/3）；类型面 `watchMap(path, listener, {where})` 无 `options` 形参
与类型（TS 实参个数/excess property）；`WATCH_MAP_OPTIONS_INVALID` 不在
`WatchMapErrorCode`。任何以「谓词字段写死」「只按 key 过滤」「别名/内部函数冒充」的实现，
会在 N2/N6（保守面）、N9/N10（plain 精确面）、E4–E7（建立面）与类型面同时红。

### 12.4 测试路径（**实现相位落盘**；本轮 dispatch 明确不落盘测试）

| 路径 | 内容 | 采集 |
|---|---|---|
| `packages/namespace-registry/test/issue-388-watch-map-predicate-fixture.ts` | 共享 fixture：T1 fixture 扩展（可选 status / 字面量 state / 嵌套 sub / plain 条目载体 / raw-apply 驱动）；**fixture 单点**：`watchMapOf`/`establishWatch` 增加 options 位（T1 已预留单点） | 非测试文件（不被收集） |
| `packages/namespace-registry/test/issue-388-watch-map-predicate-red.test.ts` | 主契约：E1–E11 + N1–N15 + NC1/NC3/NC5/NC6 行 | `packages/*/test/**/*.test.ts`（vitest.config.ts L15） |
| `packages/namespace-registry/test/issue-388-watch-map-predicate-surface.test-d.ts` | 类型契约：options 形参加宽、`*WatchMapOptions` 别名 Equal 锁、正例窄化、`@ts-expect-error` 负例（未知算子/非标量算子/`in` 非数组/`field` 非 string） | `packages/*/test/**/*.test-d.ts`（L20） |

**采集性说明**：本轮未落盘上述文件（dispatch 禁止 implement code/tests），其采集由既有 include
正则保证；同形 T1 三件套已被 runner 实际采集（§14）。实现相位落盘后须补跑
`vitest list` 采集实证与红/绿证据（T1 SA6 §13/§14 同款）。

### 12.5 断言纪律与反伪绿防线

1. **只观察运行时行为**：全部断言锚定 lease 公共面（建立结果、thrown `code`、通知对象、
   通知序列），禁止 grep/源码字符串断言（§11-8）。
2. **精确形状**：通知恰三键、定位符恰两键、句柄恰 `{unsubscribe}`、失败 code 逐字相等；
   零 `expect.anything()`、零吞错、零 skip/only/todo、零 env override。
3. **异步确定性**：`expect.poll`（5ms/2s）+ **屏障**（后续事务或第二订阅）表达「送达」与
   「零通知」；禁止 sleep 竞猜（T1 先例）。
4. **逐 key 断言**：混合事务行断言 `changes` 的 key 集合（排序后 `toStrictEqual`），
   不用「至少含」软化承重行。
5. **oracle 不漂移**：谓词匹配以 `readData([...path,key])` 的投影值为独立预言机
   （字段值/缺席/null），窗口读条目身份为第二 oracle。
6. **反伪绿矩阵分档**：每行显式标注「必须通知 / 必须静默 / 允许保守」；N2/N6 保守行
   不得写成 red（HEAD 行为已是 notify=1），红证据只取 N7/N8/N9 + E4–E7 + 类型面。
7. **失败首因可机械区分**：建立类红首因 = `WATCH_MAP_OPTIONS_INVALID` 缺席（HEAD 静默建立）；
   降噪类红首因 = notify 计数/key 集合 ≠ 目标；类型类红首因 = options 形参/别名缺席。
8. **仓库守卫门合规**：凡断言 `readData` 成功形状（四键）必须经集中化 helper
   `expectReadDataOkKeys`（`packages/namespace-runtime/test/helpers/readdata-ok-shape.ts`；
   #333/#336/#364 验收门，T1 §12.5-8 教训），**禁止内联四键字面量**。
9. **零生产实现越界**：不得为过契约改 ADR/CONTEXT；若 SA1 冻结不同绑定（B-2/B-4/B-5/B-8），
   只改 fixture 单点 + 类型契约绑定块并回写本表。

### 12.6 实现期红线（交 SA1/SA3/SA7 复核，非本契约执行）

1. 谓词求值 = 观察器内**纯读**，不进写 sequencer 槽、不改写结果、不产生 observer 内 throw
   （SA8 action 5；`watch-map.ts` L374–392 零 throw 红线）。
2. 建立门次序不回退：谓词校验在既有五门之后、登记之前；失败零订阅登记（SA8 action 3）。
3. 谓词校验纯 schema 侧：不得因「谓词求值需要数据」引入 live 载体探测（ADR L38）。
4. 通知载荷/kind 闭集/队列/分发/生命周期零改动；`changes` 只按谓词条件逐 key 过滤。
5. 公共 API 仅经 `src/index.ts`；lease 恰 16 键（T2 **不新增** lease 键）；既有两码零改动。

## 13. Red/green evidence

| 运行 | 命令 | 结果 |
|---|---|---|
| 安装（前置） | `pnpm install --frozen-lockfile` | exit 0（本地 store，454ms；`-install.log`） |
| T1 行为基线 | `npx vitest run .../issue-387-watch-map-tracer-red.test.ts --typecheck.enabled=false` | **21/21 绿**，exit 0（`-baseline-t1-behavior.log`） |
| T1 类型基线 | `npx vitest run --typecheck .../issue-387-watch-map-lease-surface.test-d.ts` | **2 passed / Type Errors: no errors**，exit 0（`-baseline-t1-surface.log`） |
| registry 包基线 | `npx vitest run packages/namespace-registry --typecheck.enabled=false` | **41 files / 496 tests 绿**，exit 0（`-baseline-registry.log`） |
| 根类型基线 | `pnpm typecheck` | exit 0，14 tsconfig 全过（`-baseline-typecheck.log`） |
| runner 采集 | `npx vitest list packages/namespace-registry --filesOnly` | 54 文件；T1 行为契约第 5 行、类型契约第 45 行（`-runner-list.log`） |
| 缺口探针（运行时） | `node --import tsx --input-type=module`（stdin 探针，零落盘；真实 Registry 装配） | arity=2、六种非法/合法 where 全部静默建立、非匹配变更 notify=7、readData/readMap 在产（`-probe-gap.log`） |
| 判定矩阵 HEAD 实测 | 同 stdin 探针 | R1–R8 notify 计数与 keys（`-probe-matrix-head.log`；§5 证据 2） |
| 语义矩阵（可选字段/嵌套/混合） | 同 stdin 探针 | A–G 行（`-probe-semantics.log`）；P1 混合 keys=[t9,t10]（`-probe-mixed-gates.log`） |
| Yjs 事实（delta 形状） | 同 stdin 探针 | Y1–Y5（`-probe-yjs-facts.log`；§9-2） |
| 旧态可判性 | 同 stdin 探针（handler 内读取） | W1/W2：旧 `Y.Map` 内容清空（`-probe-oldvalue-identity.log`；§9-3） |
| plain 旧态可读性 | 同 stdin 探针（raw 替换 plain 条目） | `oldValueKind=plain, oldPlainStatus="done", newStatus="closed"`（`-probe-plain-oldvalue.log`；§9-3） |
| Schema 字段域事实 | `parseVfsl`+`evaluate`+`resolveSchemaAtPath` 探针 | 八条路径分类（`-probe-schema-facts.log`；§9-4） |
| 载体/驱动边界 | 同 stdin 探针 | plain 容器受控写拒绝、整容器替换 C-3 零定位符、plain oldValue 可读（`-probe-plain-entry.log`、`-probe-plain-replace.log`、`-probe-plain.log`） |

**旧实现失败点（目标契约首红位）**：
1. **建立判定**：E4/E5/E5b/E6/E7 在 HEAD **静默建立**（无 `WATCH_MAP_OPTIONS_INVALID`）——旧实现
   在该码上无能力，契约首红是「应 throw 而未 throw」。
2. **精确降噪**：N7（新增非匹配条目）、N8（混合 add 的 key 过滤）、N9（plain 快照旧态可判）
   在 HEAD **多通知**（notify=1 / keys 含非匹配 key）——目标断言的静默/剔除失败。
3. **类型面**：`watchMap` 第三参、`Namespace{Runtime,Lease}WatchMapOptions`、
   `WATCH_MAP_OPTIONS_INVALID` 全缺席（§5 证据 4）。
4. **保守行（N2/N6）不构成红证据**：HEAD 行为已等于目标（谓词被忽略 → 一律通知）；
   它们是 AC7 语义矩阵行（`§11-5`/`§12.5-6`）。
5. **绿灯项**：NC1–NC7（T1 无谓词 21/21、门次序 P2/P5/P6、同值写 R5=0、读面在产、通知形状）——
   实现后必须保持全绿。

## 14. Runner trigger evidence

- **include 正则（实读 `vitest.config.ts`）**：L15 `packages/*/test/**/*.test.ts`；
  L20 `packages/*/test/**/*.test-d.ts`；`tsconfig.typecheck.json` include `packages/*/test/**/*.ts`。
- **采集实证**：`NODE_OPTIONS=--conditions=nomicore-source npx vitest list packages/namespace-registry --filesOnly`
  → **exit 0、54 文件**（`-runner-list.log`），逐行含：
  - 第 5 行 `packages/namespace-registry/test/issue-387-watch-map-tracer-red.test.ts`（T1 行为契约同型）
  - 第 45 行 `packages/namespace-registry/test/issue-387-watch-map-lease-surface.test-d.ts`（类型同型）
- **计划路径可采集性**：§12.4 三路径落在同一 include 正则下（`packages/namespace-registry/test/`）；
  实现相位落盘后须复跑 `vitest list` 并留存采集行（T1 §14 同款）。
- **零 skip/only/todo、零 env override**：本报告与探针不含 skip/only；唯一环境量是仓内既有
  `NODE_OPTIONS=--conditions=nomicore-source`（T1/#369 契约同款，非本契约引入）。

## 15. Unknowns and blockers

1. **★【承重，SA1 必裁】AC7 保守分支的执行粒度（N2/N6）**：issue AC7 + ADR L59 逐字要求
   「嵌套 Y.Map 部分更新 → 保守通知」；但 T1 的 `observeDeep` 条目级事件携带逐字段
   `oldValue`（Y1/Y2），一个更精确的实现可以在「谓词字段未变更」或「该字段 oldValue 在场」时
   精确抑制。默认按 AC7 取**保守通知**（多通知在宁多勿漏下恒安全）；若 SA1 选择精确分支，
   必须显式论证无漏（字段级 oldValue 或「未变更即旧态」），并把 N2 行改记为「允许静默」。
   本契约的行默认值 **N2/N6 = 必须通知**。
2. **★标量域闭包边界**：`{kind:'enum'}`/`pattern`/`int`/`range` 归标量域（默认）；
   `{kind:'union'}`（全标量成员 vs 含容器成员）与 `{kind:'scalar', type:'null'|'unknown'}`
   未由 ADR 冻结——默认 fail-closed 拒绝，SA1 冻结。
3. **★`where` 形态错误**：ADR §3 只命名三情形；缺算子/双算子/未知键/非标量算子默认
   fail-closed → `WATCH_MAP_OPTIONS_INVALID`（封闭小集 + 「建立后通知流零参数错误」的必然延伸）；
   SA1 冻结措辞。
4. **★标量相等边界**：NaN / ±0 / `Object.is` vs `===` 未冻结；承重断言只用无歧义标量，
   边界留类型/行为契约的开放行（SA1 冻结后追加）。
5. **★options 别名与标量类型名**：`Namespace{Runtime,Lease}WatchMapOptions`（公式默认）与
   `ScalarValue`（默认 `string|number|boolean`）命名 SA1 冻结；冻结后类型契约追加 Equal 锁。
6. **N9/N10 驱动**：plain 快照 `oldValue` 仅当条目值是 plain（数据偏离 Y.Map 物化）时出现；
   受控写会把值物化为 `Y.Map`（实测 A1/B1），因此 N9/N10 由 **raw `Y.Doc` 事务 / 复制 apply**
   驱动（非受控来源，T2 谓词求值仍必须覆盖）。SA1 需在设计中对齐该驱动方式；容器**整替**
   （父路径事件、C-3 零定位符）不属 T2，交 T4 #390。
7. **AC5 与 AC7 的文本张力**：已按 ADR L57 条件式解为合取（§12.2 的 must/must-not/tolerated 分档）；
   若 SA1 采用其它分解，须逐行回写矩阵。
8. **无阻塞项**：能力缺口稳定可复现（多轮探针同构），首红位精确落在谓词建立/降噪/类型面，
   负控全绿，测试入口真实且同型文件已被采集 → 可在 SA1 冻结 §12.1（尤其 B-6）与 §15-1 后进入实现。

## 16. Temporary diagnostics cleanup

- **零生产实现改动**：`git status --porcelain` 仅列出未跟踪文件（本报告 + `artifacts/sa6-issue388-*.log`
  + Host 输入 `wiki/raw/task_issue-388{,_conflict_report,_relevant_decisions}.md`）；
  `git diff --stat` 对 HEAD **零改动**（`packages/**/src/**`、`docs/**`、`vitest.config.ts`、
  `package.json` 全部原样）。
- **零测试文件新增**：本轮按 dispatch「不实现代码、不落盘测试」执行；探针全部经
  `node --import tsx --input-type=module` **stdin 运行**（零脚本文件落盘），故无临时
  `.sa6-*` 目录/文件需要恢复；`packages/namespace-registry/test/` 仍只有既有文件。
- **依赖**：`pnpm install --frozen-lockfile` 生成的 `node_modules/` 为 `.gitignore` 面
  （`Dependencies` 段），非仓库内容改动；如需保持 worktree 干净可整体删除，不影响本报告证据。
- **保留证据（仅日志）**：`artifacts/sa6-issue388-*.log` 共 18 份（安装 1、基线 4、runner 1、探针 12）。
- **零服务/后台残留**：全部为有限时长 vitest/探针运行；无 nohup/setsid/PID 文件/轮询 marker；
  后台 job（安装、registry 基线、根 typecheck）均已结算（exit 0）。
- **收尾核对**：本报告写入固定路径 `wiki/raw/task_issue-388_sa6_contract.md`；无其它 worktree
  内临时产物。

---

## Verdict

**`approve`** — 能力缺口可信且稳定可复现：HEAD `28faeae` 的 `watchMap` 无谓词面（arity=2、
第三参被忽略、`WATCH_MAP_OPTIONS_INVALID` 未注册、`*WatchMapOptions` 类型缺席），实测六种
谓词形态全部静默建立、三条精确降噪行（N7/N8/N9）多通知；负控（T1 21/21、registry 496/496、
根 typecheck exit 0、门次序 P2/P5/P6、同值写 R5=0、读面在产）全绿；契约覆盖 issue AC1–AC8
（词表/建立判定/匹配与不匹配/退出匹配集/保守分支/类型面）且判定矩阵每行都有可观察断言与
HEAD 实测基线。唯一待 SA1 冻结的语义分叉是 **AC7 保守分支的执行粒度**（§15-1，默认按 AC7
逐字保守）与三处词形/域边界（§15-2..5）；这些**不阻塞**进入设计。按 dispatch 要求，本轮
未落盘实现与测试文件——实现相位须先落 §12.4 三件套并补跑 §13/§14 的红/绿与采集实证。
