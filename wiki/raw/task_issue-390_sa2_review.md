# SA2 设计攻击评审 — issue #390：溢出降级与父路径删除（变更订阅 T4）

- 评审对象：`wiki/raw/task_issue-390_design.md`（iteration 0 全新产物；设计自述无前序 SA2 评审输入，经核查 `wiki/raw/task_issue-390_sa2_review.md` 此前不存在，本文件为首轮）
- 评审人：SA2（独立攻击视角；不修改设计、不实现、不运行测试）
- 评审基线：分支 `mabf/issue-390`，HEAD `28faeae`（与 SA6/SA8 基线一致）

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-390.md`（任务简报，issue #390 六条 AC） | 已读 |
| `wiki/raw/task_issue-390_design.md`（被审设计） | 已读（449 行全文） |
| `wiki/raw/task_issue-390_sa6_contract.md`（SA6 契约，verdict = approve） | 已读 |
| `wiki/raw/task_issue-390_relevant_decisions.md`（SA8 决策摘录 A–F） | 已读 |
| `wiki/raw/task_issue-390_conflict_report.md`（SA8 前置门禁，verdict = clear、recheck = true） | 已读 |
| 源码现场核对：`watch-map.ts`（全文 488 行）、`runtime.ts`（seam/capture/构造栈相关段）、`registry.ts`（resolveIdleTimeoutMs / RegistryRuntimeOptions / createRegistryInternal / runtimeOptionsFor / 三处 factory 调用点 / 生产入口）、`testing.ts`（全文）、`internal.ts`（全文）、`types.ts`（message 常量段）、`plugin.ts`（config 门）、`index.ts`（导出面）、`lease.ts`（watchMap 透传）、`runtime-registry-internal-type-guard.test-d.ts`（全文）、`registry-open.test.ts`（16 键断言）、`issue-387-watch-map-fixture.ts`（装配形态）、`read-schema-projection.ts`（normalizeReadPath 段域）、`vitest.config.ts`、`tsconfig.typecheck.json`、`docs/adr/0030-change-subscription.md`（全文） | 已读 |
| `artifacts/sa6-issue390-*.log`（8 份探针/基线日志，存在性核对） | 在场 |
| Owner 评论：REST `issues/390/comments` = []（简报 §Comments、SA6 §2、SA8 §2、本 dispatch 四方一致） | 无适用评论 |

## 2. Verdict

**approve**。零 BLOCKER、零 MAJOR；4 条 MINOR 观察项（§14）。

设计可安全实施：全部 14 个源码锚点现场核实**零漂移**；容量注入链（D2）每一跳均为加法式可选字段且类型可判定贯通（RegistryRuntimeOptions 与 RuntimeForRegistryDiagnostic 需同步加字段，设计已正确列入 §8-A）；结构性失效检测（D3）的算法对全部边界（严格祖先、链上键、条目级、ROOT 订阅、序列载体段、同事务混合、add 旁路）经本评审独立推演正确；降级单点（D4）为既有溢出分支的逐字节等价重构 + 复用；冻结面（三 kind 形状 / lease 16 键 / arity type-guard / WATCH_MAP_* / 复制面 / sequencer 槽序 / plugin config）零触碰且结构性不可破；验收映射（§12）行为锚定、负控与回归边界齐备。

## 3. 需求覆盖

| Requirement（issue AC） | Design section | Assessment |
|---|---|---|
| AC1 有界队列：上限 = 构造参数 + 实现默认，数值不进公共契约 | §1-G1、§7-D1/D2/D5、§8-A、§12-A1/A8 | 覆盖。构造参数位既有（`watch-map.ts` L365–369 实核）；缺省路由 `undefined → createWatchHub 缺省参数` 保持 `WATCH_QUEUE_CAPACITY_DEFAULT` 单点定义（无双常量副本）；生产入口 `createNamespaceRegistry` 逐一显式转发（实核 L2306–2321）不含新字段 ⇒ 结构性不可达；index.ts 对 types.js 仅 type-only 白名单转出（实核）⇒ message 常量值不进公共面 |
| AC2 溢出 → `{kind:'invalidate-all', origin}` + 订阅存活 + 自愈 | §1-G2、§7-D4、§8-C①、§12-A2/NC1 | 覆盖。D4 与既有 L397–413 溢出分支逐字节等价（本评审逐行比对确认）；触发确定性由 SA6 §7-1（10/10 先提交后投递）承担；NC1 反伪绿在场 |
| AC3 父级删除 → invalidate-all、订阅存活 | §1-G3、§7-D3、§8-C②、§12-A3/A3b/A4/A5/NC2 | 覆盖。严格祖先 delete + 整替 update + 同事务原子 + 条目级负控（NC2）齐备；A5（整替）为 SA6 B-4/SA8 §8-2（明文「容器创建/删除/整替」）预先授权，非静默扩张 |
| AC4 订阅横跨缺席期（删→重建→条目 `data`） | §1-G4、§7-D3 add 旁路、§7-D7、§8-C④、§12-A6 | 覆盖。簿记冻结 path 快照（实核 L127–137/L456）+ `add` 旁路使创建事务与 T1 逐字节一致；AC4 为基线绿（SA6 H7），设计正确按回归边界处理而非伪称红灯 |
| AC5 溢出可测：既有 testing 工厂 overrides 注入（零新接缝） | §7-D1/D2、§11、§12-A1/A2、断言纪律 6 | 覆盖。唯一注入面 = `NamespaceRegistryTestingOverrides` 加法字段（实核该接口现无容量位）；契约文件仅 import `@nomicore/namespace-registry/testing`（package.json exports 实核在场）；无第二 seam / 公共 API |
| AC6 溢出不阻塞写；降级分发在写序列器槽之外 | §1-G5、§7-D4、§9、§12-A7 | 覆盖。降级三步（清队+入队+泵调度）全为观察器内同步有界操作（SA8 §8-3 原文对齐）；投递复用既有单飞微任务泵（实核 L318–341）；零 sequencer await |

非目标（§1）：T2/T3/T5、复制面、readData/窗口读/诊断日志、sequencer 槽序、watchArray/含值/序号——与 SA6 §12.1 非目标、SA8 §3 冻结面逐项一致，无越界。

## 4. Owner评论覆盖

| Comment ID | Updated at | Design section | Assessment |
|---|---|---|---|
| （无——REST `issues/390/comments` = []，0 条） | — | 设计 §4 已显式记录空集 + 「无 override 载体」 | 正确。无适用 Owner 评论要求；全部要求由 issue 正文 6 AC + ADR 0030 决策 3/4/6 + 验收缝导出，设计 §1/§7/§12 逐条承接 |

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| SA8 §8-1：注入只经 testing overrides 加法字段 + internal 装配缝；不得新开公共 API / 第二 seam | §7-D2 唯一通路链（7 跳全列出）；否决备选 A（第四位置参破 type-guard）/ 备选 B（testing.ts 闭包偏离点名装配点且引入 internal 值导入） | 落实。链路每跳实核存在且为加法模式（testing.ts L36–64 / registry.ts L404–433 / L832–860 / runtime.ts L112–128 / L914–932 / L1043 / L576）；internal.ts 零改动即保持 type-guard 绿（断言实核为 `Parameters extends [DocHandle, () => Promise<void>, unknown?]`，第三参对象加字段不触） |
| SA8 §8-2：形状恒两键；FIFO；删→重建→data 不要求重建订阅；宁多勿漏加强不削弱真变过滤 | §7-D3（isRealChange 复用、add 旁路、序列段保守失效）、§7-D4（恰两键 freeze、清队 B-7 授权）、§7-D7 | 落实。真变判定零第二套；`add` 旁路保证创建事务与 T1 逐字节一致（不削弱）；整替经 isRealChange 保守失效（宁多方向） |
| SA8 §8-3：槽外红线（清队+入队+泵调度 = 观察器内有界同步；零 sequencer await；异常零外泄） | §7-D4 全同步单点、§9 并发论证 | 落实。检测为 O(订阅×事件) 常量工作，无 await、无 throw 新点 |
| SA8 §8-4 复查清单①–⑦ | §15 逐项自证表 | 落实。设计自判 recheck=true 并按先例（T1）留实现后闭合路径 |
| SA8 §3 冻结面（三 kind / 数值 / lease 签名 / WATCH_MAP_* / 复制 wire / 单 FIFO / 谓词与 watch-end 词表） | §8-A 冻结面行、§11 DENY | 落实。零新错误码、零签名变化、零码族触碰 |
| ADR 0030 决策 3（L38 缺席合法） | §7-D7 + 簿记零 live 探测（实核 L440–456 注释） | 落实 |
| ADR 0030 决策 4（L50 触发源 / L51 终结三因） | §7-D3/D7：父删 invalidate-all + 簿记零摘除 + 无 watch-end | 落实（L50/L51 原文实核） |
| ADR 0030 决策 6（L64–67 挂点 / 有界 / 数值治理 / 事务级原子 + FIFO） | §7-D4/D5、§9 | 落实；与 ADR 0010 L267 复制 fanout 冻结常量的相反纪律辨析正确（SA8 §8-4②） |
| SA6 §12.1 绑定 B-1..B-7 | §7-D1 采纳契约默认（无需回写 §12.1）、B-2 触发模式 / B-3 两键 / B-4 严格祖先+整替+add 不钉 / B-5 存活 / B-6 不断言数值 / B-7 清队授权 | 逐项一致 |
| SA6 §5 缺口 G-1..G-5、§9 X-1..X-7、§7 时序事实 | §3 缺口表、§5 承接表、§12 触发设计 | 一致承接；H7（AC4 基线绿）未被伪称红灯 |

## 6. 设计内部一致性

- **锚点真实性**：§2 全部 14 项锚点本评审逐一实读核对，行号与语义零漂移（含 L576 两参调用、L799–802 缺省工厂、三处调用点 L1310/L1563/L1707、生产入口显式转发、type-guard 断言形态、resolveIdleTimeoutMs 二分先例、plugin config 键门、16 键断言、vitest L15/L20 采集面）。
- **正文/伪代码/接口表/状态机/数据流/验收映射互相一致**：§7-D3 伪代码与 §8-B 状态机、§8-C 四路线、§10 调用方矩阵、§12 用例逐一对得上；`detectStructuralInvalidation` 的 `eventPath.length >= depth continue` 与 L270 既有 C-4 分支的方向互补关系（两处 isPathPrefix 实参交换、互不干扰）经独立推演确认正确。
- **加字段锁步**：§8-A 将 `watchQueueCapacity?` 同时列入 RegistryRuntimeOptions 与 RuntimeForRegistryDiagnostic——这是链路类型贯通的必要条件（缺一则 createNamespaceRuntime 的条件展开编译红），设计已正确成对列出；测试 overrides 的 runtimeFactory 两参形对三参可选工厂类型保持可赋值（既有事实，实核 L37 vs L216–220）。
- **无死引用/旧 API/前后矛盾**：未发现。§14 评审修订映射如实声明 iteration 0 无前序评审。
- **A5 范围裁决诚实**：整替纳入附 SA6 G-3 红证据 + SA8 §8-2 原文「容器创建/删除/整替」，非静默扩张；D5 校验门超出契约断言面（SA6 §15-4）的设计裁决有显式 fail-loud 论证。

## 7. 状态机与并发攻击

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| SC-1 | 订阅 active，队列含未投递 data（容量未满） | 观察器内结构性失效（父删） | 清队 + 单条 invalidate-all + 泵调度；恰一条 | 无——D4 单点即此；清队发生在观察器同步段，泵在让步点重检 `queue.length===0 → return` / `finally` 复位 pumpScheduled，丢失唤醒不可能（既有交错论证原样延伸，实核 L318–341） | 无 |
| SC-2 | 泵 mid-delivery（让步点间）挂起 | 观察器清队 + 入队 | 旧泵重检非空继续投递新条目；schedulePump 因 pumpScheduled=true 不二飞 | 无——单线程 run-to-completion，清队与 shift 无同步段交错 | 无 |
| SC-3 | capacity=1，队列 1 条 invalidate-all 未投递 | 新事务条目写（enqueueData） | `length ≥ 1` → 再降级：清队（含旧 invalidate-all）+ 新单条 ⇒ 仍恰一条待投递 | 无——连续降级自然折叠，语义幂等（§7-D4） | 无 |
| SC-4 | 双触发源叠加（同事务溢出 + 父删） | 同事务多事件 | 恰一条 invalidate-all | 无——同一单点；§13 风险表已列 | 无 |
| SC-5 | 订阅退订瞬间（unsubscribed=true） | 观察器回调迟到 / enqueueInvalidateAll | 零投递、零复活 | 无——D4 单点首行 unsubscribed 门 + 既有 unsubscribe 清队 | 无 |
| SC-6 | 同步段两次 un-awaited 写（A2 触发） | capacity=1 | 第 2 次入队必见满 ⇒ 恰一条 invalidate-all、零 data | 无——SA6 §7-1 十轮实测事件序钉死，设计禁 sleep 竞猜（§12 断言纪律 3/4） | 无 |
| SC-7 | 删除→重建→条目写（AC4 跨缺席期） | 三连事务 | invalidate-all → （add 旁路零通知）→ data；零重新订阅 | 无——簿记冻结快照 + add 旁路；A6 断言锚定「重建后条目写」 | 无 |
| SC-8 | Runtime close/shutdown | 降级信号在队 | 队列清空、observer 摘除，无残余投递 | 无——既有 shutdown 路径零触碰（实核 L477–486） | 无 |

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| ER-1 | 注入垃圾容量（'1' / 0 / 1.5 / 2^31） | 构造期同步 TypeError/RangeError（registry 单点，resolveIdleTimeoutMs 同款二分；稳定 message 零插值）；seam 侧第二道防御门 | 无静默「恒溢出」fallback；throw 前置于任何 enqueue（INV-N4），零副作用 | 无（fail-loud 正确落位） |
| ER-2 | 注入门失败后重试 | 修复入参重建 Registry | 构造期拒绝天然可重试；无半构造状态（既有 createRegistryInternal 纪律） | 无 |
| ER-3 | listener throw（含 invalidate-all 投递时） | 逐投递 try/catch 静默隔离；写结果零影响 | 零外泄红线保持（实核 L328–332） | 无 |
| ER-4 | 检测/降级路径内部异常 | handler 整体 try/catch 吞没（零 throw 硬红线） | 理论上吞没 = 该事务零通知（宁漏方向），但 D3/D4 全部操作（Map.get / 数组读 / freeze / push）无非抛点，与 T1 collectChanges 同一既有权衡，非新风险 | 无 |
| ER-5 | 自愈语义 | invalidate-all 即自愈指令（消费协议 v1 全量重拉；无 needs-resync 接触） | 复制面零涉（SA8 §3/§6 冻结） | 无 |
| ER-6 | 伪降级掩盖 | D5 裁决④显式拒绝「垃圾值静默按恒溢出运行」；NC1 反伪绿证明断言对注入敏感 | 无 | 无 |

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| `createWatchHub` 第三参 | 无——唯一调用方 runtime.ts L576（全仓 grep 实核恰一处）；undefined → 缺省参数，生产行为逐字节不变 | §2 #4、本评审 grep | 无 |
| registry 三处 factory 调用点（open/create/import） | 无——同签名第三参对象加字段，`runtimeOptionsFor` 两条返回路径单点注入（设计 §10 已列明两路径，与实核 L839–841/L855–859 对应） | §2 #6/#7 | 无 |
| `NamespaceRegistryTestingOverrides` 消费者 | 无——加法可选字段；既有逐字段拷贝增一行；TS2353 红转绿 | testing.ts L119–170 实核 | 无 |
| 既有 runtimeFactory 覆盖式测试（#387 fixture） | 无——两参函数对三参可选签名兼容；容量对其无效果（自定义工厂自辖）已声明 | issue-387 fixture L218–233 实核 | 无（见 §14 M1 的措辞性观察） |
| lease 面 / 生产入口 / plugin config | 无——16 键、显式转发、`{idleTimeoutMs?}` 键门全部零触碰 | registry-open.test.ts L935–945、index.ts、plugin.ts 实核 | 无 |
| 消费方（watchMap listener） | 无——协议 v1 已覆盖全量重拉；在队未投递 data 被清为 B-7 显式授权并在 §13 记录 | ADR 0030 L60/L66 | 无 |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| 结构性失效检测 / 宁多勿漏判定 / 有界队列降级 | runtime（ADR 0030 §7） | watch-map.ts 模块内函数（零导出变化） | 正确 |
| testing 注入面 / lease 透传零变化 | registry（testing surface 显式面） | testing.ts + internal 装配缝 | 正确（registry AGENTS「hostile/test 控件留在显式 testing surface」对齐） |
| 容量校验单点 | registry（构造门，resolveIdleTimeoutMs 同款） | registry.ts `resolveWatchQueueCapacity` + types.ts message | 正确（#112 先例同构） |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| 数值可选注入校验 | `resolveIdleTimeoutMs`（TypeError/RangeError 二分 + types.ts 稳定文案） | `resolveWatchQueueCapacity` 同款 | 一致 | 显式援引先例，文案风格实核匹配 |
| 第三参通道加法 | clock / replicationObservability 经 `RuntimeForRegistryDiagnostic` 条件展开进 seam | 同通道加 `watchQueueCapacity?` | 一致 | L914–932 既有模式复用 |
| 溢出降级 | watch-map.ts L397–413 内联 | 提取 `enqueueInvalidateAll` 单点 + 结构性失效复用 | 一致（收敛而非平行） | 消除潜在双实现，行为逐字节等价 |
| 前缀判定 | `isPathPrefix`（L238–247） | 交换实参复用（严格祖先） | 一致 | 零新 helper |
| lease 契约三件套 | #369 / #387 fixture/red/surface 模式 | 新三件套同目录同后缀 | 一致 | 采集面实核（vitest L15/L20 + tsconfig include 含 `packages/*/test/**/*.ts`） |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 容量默认值 | `WATCH_QUEUE_CAPACITY_DEFAULT`（watch-map.ts 单点） | 注入路由 undefined → 缺省参数（不复制数值） | 无——resolver 返回 undefined 而非默认值，无双常量 |
| 订阅生命周期 | subscriptions 集 + unsubscribed 标志 | 降级仅为队列事件，零第二状态字段 | 无 |
| 失效信号形状 | `Object.freeze({kind,origin})` 单点构造 | — | 无 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| watchMap 建立（六门全前置） | unsubscribe 幂等清队 / shutdown 防御收口（既有） | 构造期拒绝零副作用 | 对称；本设计零新增 acquire/release 面 |

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 第二 testing seam | testing.ts overrides | 复用唯一 overrides 字段 | 无平行 |
| 第二判定体系 | isRealChange/isPathPrefix | 全复用 | 无平行 |
| 第二泵/清理 worker | schedulePump 单飞微任务泵 | 复用 | 无平行 |
| fixture 助手小拷贝（sink/排空屏障） | #387 fixture | #390 fixture 自包含 | 已裁决：避免触碰冻结契约支撑文件；SA6 §12.4 备选注记兼容；可接受 |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW 8 项 vs 设计正文触面 | watch-map.ts/runtime.ts/testing.ts/registry.ts/types.ts + 新三件套——与 §7 决策、§8-A 接口表、§10 调用方所需改动严格一一对应 | 无 |
| DENY 与正文冲突 | internal.ts（type re-export 面，加字段经 runtime.ts 类型直达，internal.ts 零改动成立——实核 L77 类型 re-export）；index/lease/plugin/errors/sequencer 族/复制族/ADR/CONTEXT/vitest 配置——正文无任何触碰声明 | 无冲突 |
| DENY `packages/namespace-runtime/test/**` 行措辞 | 该行理由列「既有测试」；严格字面读会同时禁止新增 runtime 包测试（如 captureSeamInput 防御门的直连测试）。设计未要求任何新 runtime 测试，seam 门已显式定位为防御面（registry 单点已挡） | 无阻断；建议实现期把该行读作「既有测试冻结」（见 §14 M2） |
| 无理由扩张 | 无——全部新增文件即 SA6 §12.4 冻结路径；无 follow-up 掩盖任务内必要项（§13 残余均为 T2/T3/T5/v2 真实外延） | 无 |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1/A1 注入位类型+运行双红转绿 | TS2353 探针红 + `openWatchLease({watchQueueCapacity:1})` 运行敏感（NC1 对照）+ `@ts-expect-error` 负例 | 无 | 无 |
| AC2/A2 溢出恰一条 + 自愈 | B-2 确定触发 + `syncCallbacks===0` 断言 + `toStrictEqual` 两键 + 后续写等 data | 无 | 无 |
| AC3/A3/A3b/A4/A5 四变体 + NC2 | 可选容器正控 → 四触发变体各恰一条；条目级删除仍 data | 无 | 无 |
| AC4/A6 回归边界 | 删→重建→条目写 data、零重新订阅（基线绿，诚实标注非红灯） | 无 | 无 |
| AC5/A1 零新接缝 | 契约文件 import 面单一（仅 testing 子路径）；无直连 createWatchHub/seam | 无 | 无 |
| AC6/A7 槽外 + 不阻塞写 | 触发写全 ok:true、同步段零回调、三 kind 闭集 | 无 | 无 |
| A8/A9/NC6 冻结面 | lease 16 键、类型负锚、两键/三键形状、kind 闭集 | 无 | 无 |
| NC3/NC4/NC5 负控 | 无关路径零通知、必填整删/非法批量写面拒绝零通知 | 无 | 无 |
| 回归边界复跑 | #387 契约 21 用例、根 typecheck、测试树 tsc、registry/runtime 全量族——全部真实仓库入口 | 无 | 无 |
| 断言纪律 | 零 skip/only/todo、零源码文本断言、零通知断言带同订阅屏障、expect.poll | 无（与 SA6 §12.5 逐条对齐） | 无 |

红灯真实性：两红因（G-1..G-4 通知面 / G-5 注入面）互相独立、机械可区分；AC4/A7/A8/A9/NC* 基线绿未被伪称红灯（SA6 §13/H7）——设计的红绿表诚实。

## 13. Required revisions

无 BLOCKER / MAJOR finding。（全部攻击线——注入链类型贯通、D3 边界矩阵、D4 等价性、并发交错、冻结面结构不可破、文件范围、验收可执行性——均未产生实施前必须修订的缺口。）

## 14. Non-blocking observations

| ID | Observation | Suggestion（非阻断） |
|---|---|---|
| M1 | §7-D2「组合语义」称容量「随第三参到达自定义工厂；自定义工厂自行决定消费与否」——但 `NamespaceRegistryTestingOverrides.runtimeFactory` 的类型为两参函数形（testing.ts L37 实核），TS 调用方无法声明三参工厂去消费该字段；该组合语义仅在 JS/经 cast 的运行面可达，类型面不可表达。对本任务无承重影响（#390 fixture 显式走缺省生产 factory 通路，SA8 §8-1 点名的也是该通路） | 实现期在 D2 段补一句「类型面 overrides.runtimeFactory 仍为两参形，消费第三参的自定义工厂非类型可达」或删去该句，避免实现者误以为可类型化表达；零代码/测试改动 |
| M2 | §11 DENY 行 `packages/namespace-runtime/test/**` 的理由列为「既有测试」——严格字面读会禁止为 D5 的 captureSeamInput 防御门新增 runtime 包直连测试。该门已显式定位为防御面（registry 单点已挡垃圾值，契约测试只达 registry 门），设计不要求新 runtime 测试，故无实际冲突 | 实现期把该行语义钉为「既有测试冻结；本设计不新增 runtime 包测试」即可；无需改 ALLOW/DENY 集合 |
| M3 | 容器「创建」事务（add 旁路）若写面以单条 plain 整值 set 落盘（无嵌套物化事件），重建时刻对持「缺席视图」的消费方零信号——T1 N4 未钉边界，SA6 B-4 与设计 §13 残余均已显式记录，ADR L50 亦只承诺「重建后条目照常到达」 | 无需本任务动作；维持设计 §13 的显式记录即可，消费方如有需求走新 AC |
| M4 | D5 seam 侧防御门对形状与域违例统一 TypeError（registry 单点为 TypeError/RangeError 二分）——与 captureSeamInput 既有逐字段纯形状门先例一致，且为不可达防御面 | 可保持现状；如实现期希望完全对齐二分，将 seam 门域违例改 RangeError 为可选润色 |

## 15. requiresConflictRecheck 判定

SA2 本轮**未发现需要重新执行 ADR 冲突检查的新风险**：设计全部行为落在 ADR 0030 决策 3/4/6 + 验收缝 + SA8 §8 义务的既有授权内，无决策修订、无 override、无新冻结面触碰。SA8 既有的实现后复查义务（§8-4 清单）独立存续，由设计 §15 表与 Controller 跟踪，不因本评审追加。

---

## 评审方法附记（证据可复核性）

- D3 算法独立推演覆盖：严格祖先 delete / 祖先链中段 update（含同值 plain 过滤与 live 载体保守失效）/ `add` 旁路（缺席→在场，含链式创建 add+add+嵌套）/ 条目级事件（length==depth 走 C-1，NC2 保形）/ ROOT 订阅（depth 0 结构不可达）/ 链途径序列段（nextSeg 非 string 保守失效，实核 normalizeReadPath 段域含 number）/ 同事务混合（ROOT 单事件多键：目标键命中短路、无关键 skip）/ 事件与订阅链无交集（prefix false，NC3 保形）。
- 注入链类型贯通核验：RegistryRuntimeOptions 与 RuntimeForRegistryDiagnostic 成对加字段（§8-A）是 createNamespaceRuntime 条件展开编译绿的必要条件；testing overrides 两参工厂形对三参可选 RuntimeFactory 保持可赋值（参数逆变方向正确）；type-guard `Parameters extends [DocHandle, () => Promise<void>, unknown?]` 因「两参重载居末」（internal.ts L48–56 实核）恒见两参形，第三参对象加字段不触断言。
- 公共面零泄漏核验：index.ts 对 types.js 仅 type-only 白名单（L39–90），message 常量值结构性不可达主入口；plugin config 键门 `keys.some(k => k !== 'idleTimeoutMs')` 实核；internal.ts 值导出恰两键实核。
