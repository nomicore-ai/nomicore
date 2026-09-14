# SA8 设计后冲突复审 — issue #387：watchMap 无谓词形态垂直通路（变更订阅 T1 / tracer bullet）

- 复审对象：**design**（`wiki/raw/task_issue-387_design.md`，SA1 产出，**修订轮 iteration 2**——
  SA3 实现报告〔iteration 0，verdict reject：范围不足〕B-1/B-2/A-1 的整改后重审）
- 复审轮：2026-09-14（iteration 2；dispatch `sa-45ade17d-68ea-435c-bf3f-400996ae3ae3`；
  本报告**原位取代** iteration 1 报告，只反映当前被审文本，不堆叠历史结论）
- Worktree：`/home/wangjian/nomicore-fix-issue-387`（branch `mabf/issue-387`，HEAD `6df1c61`；
  ADR 0030 / CONTEXT.md 相对 HEAD 零 diff——规范基准未被本任务触碰；SA3 iteration 0 实现
  已落盘未提交，`git status` 实读 = 17 处 ALLOW 内修改 + 4 新文件，DENY 域零 diff）
- 结论速览：**verdict = clear**；30 项对照 = 12 × implements-existing-decision + 18 × no-conflict；
  0 hard-conflict；0 override；0 未规划的 evolution-required；
  **requiresConflictRecheck = true**（公共面增长 + ③b 新失败语义分支 + 生命周期钩子 +
  D8 origin 产出语义 + **⑨⑩ ALLOW/DENY 改判的两行实现尚未落盘**——当前测试树类型门
  仍余恰 2 处 TS2741，均待实现核对）

---

## 1. Reviewed subject

**design**。被审文本 = `wiki/raw/task_issue-387_design.md` 全文（§1–§15 + 附表，649 行）。
本轮重点 = iteration 2 修订增量：

- **B-1/B-2**：F-1 影响面清单由「四处键集 + 七结构桩」扩为「四处键集 + **十结构实现点**」
  （§2.12/§2.13/§2.14/§10/§11/§12/§13-R8）——新增 ⑧ `registry-open.test.ts` `makeRuntime`
  （返回类型注解形态，实现轮已在 ALLOW 内修复）、⑨ `issue-369-window-read-lease-contract-red.test.ts`
  `makeStubRuntime`（原 DENY 明文行）、⑩ `ws-replication/src/testing.ts` `decorateLease`
  （lease 侧第二实现点，原「wire/协议/持久化包」DENY 覆盖域）；检索模式扩为五类
  （+ 返回类型注解 / 装饰器包装），仲裁者 = 编译器；
- **ALLOW/DENY 改判（本 dispatch 核心审查面）**：§11 ALLOW 新增 ⑨⑩ 两行（恰一行改动形态）+
  DENY 两行逐行级改判 + §11 头部「同路径重叠优先序」纪律；
- **A-1 吸收为设计冻结**：D10 / 建立场 **③b ROOT 载体门**（构造期容错捕获 + 复用
  `WATCH_MAP_CARRIER_MISMATCH` 码 + 专属 message，不新增注册表条目）。

对照基准 = ADR 全集 + `CONTEXT.md` 术语 + 模块 AGENTS 决策面 + `docs/protocols/`（wiki/raw
属 evidence 非规范——`docs/AGENTS.md` Authority 节明文）。SA2 评审（approve）与 SA3 实现
报告（reject：范围不足）本轮在场，作为修订映射的核验输入；全维度攻击评审属 SA2，不在本门
范围。issue #387 评论 = 0（本轮 `gh` REST 复读 `.comments | length` = 0；dispatch 确认
Owner requirements: none）。

## 2. Inputs and decision set

| 输入 | 状态 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-387.md`（任务简报） | 在场 | 需求源：AC1–AC10 + 演示场景 |
| `wiki/raw/task_issue-387_design.md`（iteration 2 修订版） | 在场 | 被审对象 |
| `wiki/raw/task_issue-387_sa3_impl.md`（iteration 0，reject：范围不足） | 在场（evidence） | B-1①②③/B-2/A-1 整改核验输入；`artifacts/sa3-issue387-*.log` 编译器仲裁证据 |
| `wiki/raw/task_issue-387_sa2_review.md`（approve） | 在场（evidence） | iteration 1 整改延续面核验 |
| `wiki/raw/task_issue-387_sa6_contract.md` | 在场（evidence，非规范） | 绑定表 B-1–B-7、非目标边界 |
| `docs/adr/0030-change-subscription.md` | **规范权威**（已接受，HEAD 零 diff） | §1/§3/§4/§5/§6/§7 逐条款对照（③b 裁决主基准之一） |
| ADR 0008（+词汇收口注册/修订节）、0009（+#131/#134/#228 修订节）、0010/0013/0022、0011/0014、0018、0023、0025/0026、0027、0028 | 已接受 | 决策集交叉面（P0/ROOT 读取能力、sequencer/槽序、lease 生命周期、稳定码注册、信封原子、readData 形状、窗口读载体面与负控、诊断槽外纪律、复制 wire） |
| `CONTEXT.md` L65–67（变更订阅词条，含「本地写 / 复制 apply 全覆盖」）、L70（ROOT：map 形保留名） | 在场 | 术语一致性（D8/③b 裁决输入——ROOT 词条证「map 形」为规范形态，异型载体 = doc 数据级偏离态） |
| `packages/namespace-runtime/AGENTS.md`、`packages/namespace-registry/AGENTS.md`、`packages/ws-replication/AGENTS.md`（L18）、`packages/doc-runtime/AGENTS.md` | 在场 | 模块决策面（FIFO/读槽外/public API 仅经 index/**testing surface 承载 test controls**） |
| spec #385、T3 票 #389（本轮 `gh` 复读标题与在场性） | 在场 | 分期边界（spec 从属 ADR；#389 = 复制来源验收编排 + watch-end） |
| 源码/工作树事实核验（本轮独立实读） | — | 见 §3 各行 Evidence 列；`git status` 全量对账（17 修改 + 4 新文件全在 ALLOW；ws-replication/persistence/replication-protocol/docs/CONTEXT/`issue-369-*`/`replication-session.ts` 零 diff） |

决策集状态核查：ADR 全集 28 篇均「已接受」；0007/0016/0024 为部分取代，被取代条款与本设计
无接触面。`docs/` 与 `docs/protocols/instance-replication-v1.md` 全树零 `watchMap` 名目
（本轮 grep 复核——复制 wire 零接触的独立确认）。ADR 0008 修订节（#132/#145 构造期复制
事实窄例外）先例已读：该节证明本仓对「构造期读取例外」的治理形态 = 显式 ADR 增补——本轮
D10 不落入该形态（见 §3 行 27 论证）。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（design iteration 2） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0030 §6（L64） | 挂点「全覆盖本地受控写、**复制 apply**、schema 安装三种来源」 | D8：hub 对一切触及已订阅容器的事务推导通知，不做 origin 过滤；复制 apply 经 `Y.applyUpdate(host.doc, bytes, ctx.applyOrigin)`（per-session symbol origin）在 ROOT `observeDeep` 单挂点下结构性直达观察器，无槽可接线 | **implements-existing-decision** | ADR L64 原文逐字；`replication-session.ts` L764（iteration 1 实读，本轮 HEAD 未动）；CONTEXT L66「（本地写 / 复制 apply 全覆盖）」同款；iteration 2 维持该冻结（§1/§7-D8/§8-C 唯一陈述） | 无 |
| 2 | ADR 0030 §4（L52） | `origin: 'local' \| 'replication'`——self-echo 抑制刚需（**消费方**过滤自己触发的写） | origin 仅作通知分类字段（`transaction.origin == null → 'local'`；symbol → `'replication'`）；过滤责任在消费方，hub 零过滤 | **implements-existing-decision** | ADR L52 把过滤动词赋予消费方；design §8-C/§7-D8 | 无 |
| 3 | ADR 0030 §5（L57–58） | 宁多勿漏唯一不变量：「漏 = 消费方永久持有过时数据（不可接受）」 | D8 明文以本条款否决读法 B（origin 过滤 = 对启用复制命名空间的蓄意漏通知）；`invalidate-all` 的 origin 携触发降级事务的分类（§8-E），无过滤 | no-conflict | ADR L57–58；design §7-D8 ③ | 无 |
| 4 | CONTEXT L65–67「变更订阅」词条 | 挂点 = 写序列器事务提交后异步分发（本地写 / 复制 apply 全覆盖）；origin 两态；三 kind；宁多勿漏 | 设计 §1/§8-A/§8-C/§8-E 措辞与词条逐项一致（含全覆盖口径）；`_Avoid_` 面（泛 watch/push/事件流/version）零触碰 | no-conflict | CONTEXT L66 本轮实读；design §15 对账声明经本门复核成立 | 无 |
| 5 | T3 #389 票面 | 复制 apply 的远端变更与本地写触发同一套通知；AC1 断言 `origin:'replication'` 经 `openReplicationSession` 驱动 | T1 交付机制（无过滤 + origin 分类在产）但契约只断言 `'local'`；T3 交付 `'replication'` 断言编排与 `watch-end`——「补齐的是验收与终止编排，不是 apply 信号接线」 | no-conflict（分期边界一致） | #389 本轮 `gh` 复读在场；design §1/§7-D1②/§12 | 无 |
| 6 | SA6 契约 §12.1 非目标（L229，evidence） | 「`origin:'replication'` 与 `watch-end`（T3 #389）」不得越界 | 设计 §12 明文本票不新增断言（fixture 无复制面）——非目标按测试范围边界遵守 | no-conflict | SA6 契约实读；wiki/raw 属 evidence 非规范，规范冲突面以 ADR 0030 为准（行 1/2 已裁决方向） | 无 |
| 7 | ADR 0030 §1（L14–18） | lease 层公共面；`{unsubscribe}` 幂等、主动退订零通知；键容器载体；订阅是 lease capability、释放即清理 | lease 第 16 键纯加法；B-2 位置参 listener；句柄恰一键；§8-F doRelease 同步段清理 | **implements-existing-decision** | ADR L14–18；§8-F；iteration 1 行 7 裁决维持（本轮文本无变化） | 无 |
| 8 | ADR 0030 §3（L33–39） | 建立判定全部由 active schema；无 active schema 整体拒绝；`WATCH_MAP_CARRIER_MISMATCH`（message 区分原因）；数据缺席合法；参数校验全在建立时刻 | D3 纯 schema 侧判定（`resolveSchemaAtPath` kind='object'）；B-4 `WATCH_MAP_SCHEMA_UNAVAILABLE`；O-3 空路径显式承认 | **implements-existing-decision** | ADR L33–39；`resolve-schema-at-path.ts` L262（iteration 1 实读）；③b 与本条款的分界另裁于行 28 | 无 |
| 9 | ADR 0030 §4（L43–53） | 三 kind 词表；data 恰三键；定位符恰两键；`[...path,key]` 可读；同事务同 key 合并 | B-6/B-7 维持；类型联合现在即冻结全词表；T1 产出 `data`（origin 含 `'replication'`）与溢出 `invalidate-all` | **implements-existing-decision** | ADR L44–47 形状逐字段；design §8-A 零漂移 | 无 |
| 10 | ADR 0030 §5（L57–59） | 同值写过滤（语义投影比较）；旧态不可判保守通知 | D4：可判定面精确深比较；Y 载体整值替换不可判 → 保守通知；O-2 深比较单点化 + 注释互指 | no-conflict（不变量内实现边界） | ADR L57 自带不可判条款；R3 残余登记 | R3 精化须过设计评审（已登记，非本票义务） |
| 11 | ADR 0030 §6（L66）+ 验收节 L94 | 有界队列溢出 → invalidate-all；数值不进公共契约；验收「testing 工厂注入小上限」 | 容量收在 `createWatchHub` 单一构造参数位（默认 16，O-1）；溢出降级语义 T1 实现；注入与溢出验收留 T4 #390 | **implements-existing-decision**（分期） | ADR L66 + L94；design §8-E | **登记未闭合义务**：T4（#390）交付注入 + 溢出验收，否则 ADR §6 验收条款悬空 |
| 12 | ADR 0030 §7（L69–73） | runtime：簿记/判定/分发/队列；registry：lease 公共面 + 别名 + 透传；读/复制面零改动 | D5 runtime 公共第 15 键 + `watch-map.ts` 新模块；registry 第 16 键 + 三别名 + Equal 锁；DENY 锁死 readData/窗口读/复制/诊断/wire/持久化 | **implements-existing-decision** | ADR L69–73；runtime.ts/lease.ts 本轮实读（接口与字面量同步加键） | 无 |
| 13 | ADR 0008 L101 | 「v1 不提供公共事件订阅；队列进度和内部事件属于日志、metrics 与 trace」 | watchMap = 业务数据信号面（三 kind 闭集、无队列进度/内部事件夹带）；close-lifecycle L177–182 负向事件订阅词审计不动、`watchMap` 不入负向词表 | no-conflict（窄读 + ADR 0030 后法特定授权） | ADR 0008 L101 语境 = status 可观测性段；本轮实读 close-lifecycle：词表 `on/off/subscribe/unsubscribe/emit/addEventListener/removeEventListener/once` 不含 `watchMap`，键集 15 加行后照绿（工作树实测形态） | 实现后复查项：通知面恒三 kind 闭集、无进度/内部事件夹带 |
| 14 | ADR 0008（修订节）+ runtime AGENTS L9 | 单一 write sequencer / 严格 FIFO / 槽序不变 / reads 不进 sequencer | watch 观察器事件驱动零槽位占用；投递全在槽外单飞微任务泵；`write.ts`/`sequencer.ts` DENY | no-conflict | ADR 0008 修订节「完整槽序不变」；design §8-E/§8-G；工作树 `sequencer.ts` 零 diff（`git status` 对账） | 无 |
| 15 | ADR 0008 §词汇收口注册（L121–131） | 稳定码以 `errors.ts` append-only 注册表为准；区分域靠 message | 两码 append-only（`WATCH_MAP_CARRIER_MISMATCH` ADR 逐字 + `WATCH_MAP_SCHEMA_UNAVAILABLE` B-4）；**③b 复用 CARRIER_MISMATCH 码不新增条目**（D10）；`WatchMapError` 类不进 index；getter 词表加 `'watchMap'`（additive） | **implements-existing-decision** | `errors.ts` L241–255 本轮实读（变更订阅域 append-only 段，既有码零改动）；D7 论证成立 | 无 |
| 16 | ADR 0009 §NamespaceLease + #134 修订节（L149） | lease 独立 capability；release 幂等；release 同步段清理先例；「release 不追踪/等待在途」 | `activeWatches` 登记 + 双幂等包装句柄；doRelease 首调同步段清理（guaranteed cleanup 段）；released lease → `NamespaceLeaseReleasedError` | **implements-existing-decision** | #134 修订节；iteration 1 行 16 证据维持；lease.ts 本轮实读（watchMap L347 起） | 无 |
| 17 | ADR 0009 L95 | Registry observer seam「v1 不提供公共事件订阅」 | observer seam 零触碰（registry.ts/observer 在 DENY）；watchMap 为 ADR 0030 背景节明文的第四面 | no-conflict | design §11 DENY；工作树 registry.ts 零 diff | 无 |
| 18 | ADR 0023（L41） | `ctx.provide` 服务对象访问器纪律；返回值不受影响 | `registry.ts` 服务字面量零触碰（DENY）；`Object.freeze({unsubscribe})` 为方法返回值 | no-conflict | ADR 0023 L41 豁免条款 | 无 |
| 19 | ADR 0026 | `ops` 批量信封 = 单 Yjs 事务、原子可见 | 一事务一通知（observeDeep 每事务恰一次回调 → 每订阅至多一条 data）+ key 去重 | **implements-existing-decision** | ADR 0026；SA6 §9.2 机制实验；design §8-C | 无 |
| 20 | ADR 0027 / 仓库守卫门 #333/#336/#364 | readData 恒四键；形状断言不内联字面量 | 零 readData 改动；通知不含值/投影文本；零 readData 形状新断言 | no-conflict | design §11 DENY + §12；`read-schema-projection.ts` 工作树零 diff | 无 |
| 21 | ADR 0028 + #369 契约族（负控基线，evidence） | 窗口读载体面（Y.Map + plain object）；`WINDOW_*` 码族；`issue-369-*.ts` 为 #369 验收负控 | 键容器判定纯 schema 侧并以 readMap 为 oracle（E2）；**⑨ ALLOW 改判：`makeStubRuntime` 补恰一行 D9(a) throw stub，断言零改动**——该文件保持负控基线（33/33 全绿，SA3 V6 实测） | no-conflict（改判 = 纯类型面成员在场性同步；#369 契约 L203–209 为成员存在性断言非键集断言，本轮实读——15/16 键面下天然绿；ADR 0028 冻结的是 API 与词表，不冻结测试文件内部替身） | 本轮实读 `issue-369-window-read-lease-contract-red.test.ts` L864（「14 键面」陈旧计数注释）/L870 签名/L871 字面量（无 watchMap 成员，待 ⑨ 落盘）；L203–209 成员存在性断言形态确认；SA3 `-affected-suites.log` 33/33 | 实现后复查：⑨ 落盘后该文件仍 33/33 全绿、断言 diff = 0 |
| 22 | ADR 0010/0013/0022 + `docs/protocols/instance-replication-v1.md` | 复制 wire 帧/错误码/reason 冻结 | 零 wire 改动；D8 仅读取 `event.transaction.origin` 分类，不触复制路径；`replication-*` 全 DENY；工作树 ws-replication/** 零 diff | no-conflict | ADR 0030 §7 L73「通知不出进程：复制协议零改动」；protocols 全树零 `watchMap` 名目（本轮 grep）；`git status` 对账 | 无 |
| 23 | ADR 0008/0009 公共面守卫纪律（**B-1 扩面核心，iteration 2 计数**） | 公共面增长必须同步键集守卫与结构性接口实现点（#369 先例在树） | §2.12/§2.13/§2.14 全清单：**四处键集守卫**（registry-open L924 lease；internal-seam L276、phase5 L129、close-lifecycle L160 runtime——本轮逐处实读确认）+ **十结构实现点**（①–⑦ 七测试桩 + ⑧ registry-open `makeRuntime`〔已修，L191 stub 本轮实读〕+ ⑨ issue-369 `makeStubRuntime`〔待落盘〕+ ⑩ ws-replication `decorateLease`〔待落盘〕）+ runtime.ts/lease.ts 本体——全部入 ALLOW；D9 桩形态分两类（替身 = 恒 throw；装饰器 = 诚实透传） | **implements-existing-decision**（守卫同步 = 公共面增长的可审计代价，#369 同款在树先例；计数由 iteration 1 的「四 + 七」修正为「四 + 十」） | 本轮独立复检：五类模式全树 grep（`implements`×5、`: NamespaceRuntime = {`×2〔+runtime.ts 本体〕、`): NamespaceRuntime` 与 `): NamespaceLease` 全命中、`satisfies` 零命中）+ 逐命中实读排除（internal.ts 双工厂纯委托、runtime.ts L508/L918 生产工厂、shape-budget fixture `createBudgetRuntimeFromHandle` 委托、seam 测试 `buildViaInternalFactory` 经工厂调用、schema-lifecycle `makeRuntime` 委托 `createNamespaceRuntimeWithSeam`、phase5 两文件 `runtimeFactory` 箭头委托、369-fixture `createWindowRuntimeFromHandle` 委托、`okLease` 全族 `as` 收窄、issue256 `proxyLease` `Object.create` 原型委托）+ 编译器仲裁（`artifacts/sa3-issue387-test-tsc2.log`：补①–⑧后余恰 ⑨⑩ 两处 TS2741；`-root-typecheck.log`：根门唯一红 = ⑩）——**十处清单经本门独立复核完备** | 无（实现期按十处清单落盘 ⑨⑩ 两行，见 §8） |
| 24 | 两包 AGENTS + ws-replication AGENTS L18 | registry/runtime：公共 API 仅经 `src/index.ts`；runtime：detached 投影 only、close 同步停接纳；**ws-replication：「Export production APIs through `src/index.ts`; keep programmable adapters and test controls in the explicit testing surface」** | 两 index type-only 追加（值导出面不变——phase5 L151 `['RuntimeWriteFatalError']` 审计照绿）；通知为深冻结纯数据；`closeAfterFence` 同步段 `watchHub.shutdown()`；**⑩ 落位 = testing surface**（`src/testing.ts` 文件头自证「不进 src/index.ts 生产 API」，本轮实读；`src/index.ts` 零 testing 引用，grep 实证） | no-conflict | registry AGENTS；runtime AGENTS；ws-replication AGENTS L18 本轮实读；design §8-A/§8-G/§11 | 无 |
| 25 | issue #387 AC1–AC10 | 任务简报验收条款 | 全部 AC 有机制落点；**AC10 影响面清单经 iteration 2 扩为十处后完整**（SA2 F-1 与 SA3 B-1 两代缺口先后闭合）；AC6「槽外」与 ADR §6 一致 | no-conflict | 任务简报 L23–32 vs design §12 逐条；非目标三向一致（issue/spec/SA6 §12.1） | 无 |
| 26 | spec #385（从属） | US19/US20/US21；决策摘要（origin 两态 + 三来源全覆盖） | §8-E/F 逐款实现；D8 与摘要全覆盖口径逐字一致 | no-conflict（spec 从属 ADR，无独立冲突面） | 本轮 `gh` 复读在场（#385 spec）；「冲突时以 ADR 为准」自我声明 | US21 构造参数分期义务同行 11（T4 #390） |
| 27 | **ADR 0008 L18「读取能力」+ 修订节 L139 + P0 冻结契约 AC5**（iteration 2 新增裁决面） | 「普通 open 不执行 schema、**ROOT 载体**或 logical validation」；修订节 L139「原规则保持：普通 open 不读取或验证 `SCHEMA`、`ROOT` 或任何 logical value」；frozen 契约 `runtime-p0-sequencer.test.ts` AC5「ROOT 载体非 Y.Map（Y.Text）仍照常 ready」 | **D10**：构造期 `captureRootMap` 容错捕获——异型载体捕获为 `undefined`，**构造零抛、零副作用**（不创建/不替换既有载体），照常 ready 不受 ROOT 载体形态影响；observer 仅捕获成功时挂接；`shutdown` 对称守卫。**读取/验证禁令管的是「依赖与拒绝」——open 结果与 ROOT 载体形态解耦**；容错捕获正是使解耦成立的实现形态（字面挂接会在 Y.Text-ROOT 文档构造即抛，被 P0 AC5 实测击破——SA3 A-1 首跑红） | **implements-existing-decision**（兑现 ADR 0008 读取能力节 + P0 冻结契约的既有义务；非构造期读取例外——#132/#145 式 ADR 增补形态不适用：D10 不因 ROOT 形态拒绝构造或 open，只在 watchMap 自己的建立面拒绝） | ADR 0008 L18/L139 本轮实读；P0 AC5 L148 本轮实读；`watch-map.ts` L353/L372（captureRootMap + 构造期调用）本轮实读；SA3 `-p0-and-contract.log` P0 7/7 全绿 = 解耦成立的运行证据 | 实现后复查：P0 文件保持全绿；异型 ROOT 文档构造照常 ready（③b 行为断言属 §12 非目标边界——设计明示不新增断言，依赖 P0 回归锚点） |
| 28 | **ADR 0030 §3 码族 + 数据缺席合法**（iteration 2 新增裁决面：③b） | 「path 在 schema 中非键容器（偏离 schema / 数组载体）→ `WATCH_MAP_CARRIER_MISMATCH`（**message 区分原因**）」；「**数据缺席合法**：schema 已声明的容器未物化/已删除均可订阅」 | ③b：ROOT 同名异型载体（doc 数据级偏离态——CONTEXT L70「map 形 ROOT」为规范形态）→ 建立场响亮拒绝，复用 `WATCH_MAP_CARRIER_MISMATCH` + 专属 message（第六类拒绝位），**不新增注册表条目**。分界论证（D3/D10）：③b 是构造期一次性 doc 级载体事实，非容器路径级 live 探测；**缺席容器无载体，③b 不触发**——E3 判定面（ghost/optionalTasks 照常建立）零触碰 | no-conflict（文本缺口实例化：ADR §3 枚举的判定域 = schema 分类空间，ROOT 异型偏离态在其考虑空间之外〔ADR 全文默认 ROOT map 形〕；对 ADR 已考虑的全部状态行为与 ADR 逐字一致——③b 只在未考虑的损坏态上加行为，属缺口实例化而非契约变更，与 B-2/B-3/B-4 同治理档；fail-loud 优于静默死订阅〔死订阅 = 永久漏通知态，ADR §5 判为不可接受〕） | ADR 0030 L36/L38；CONTEXT L70（ROOT map 形规范形态 + 「物化为 doc 根 `getMap('ROOT')`」）；design §7-D10 分界论证 + §8-B 文案表；`watch-map.ts` L433（③b throw 位）本轮实读；证据 2.5（写槽载体纪律拒绝非 Y.Map 载体 → 异型 ROOT 子树事务结构不可产生 = 通知面结构性不可达） | 实现后复查：map 形 ROOT 下缺席容器（ghost/optionalTasks）建立成功（E3 断言既有）+ ③b message 与其余五类可区分 |
| 29 | **ADR 0030 §7 L73「通知不出进程：复制协议零改动」+ ADR 0010/0013/0022 wire 冻结 + ws-replication AGENTS L18**（iteration 2 新增裁决面：⑩ ALLOW/DENY 改判） | 复制协议/wire/导出面冻结；test controls 归 explicit testing surface | **⑩ 改判**：`packages/ws-replication/src/testing.ts` `decorateLease` 补恰一行 `watchMap: lease.watchMap.bind(lease),`（D9(b) 装饰器诚实透传，与其余 15 成员同款）——**纯类型面成员满足性同步**：零 wire 帧、零协议消息、零错误码、零持久化、零导出面（testing.ts 不进 `src/index.ts`）；DENY 行改判 = 「唯一例外 = testing.ts 类型面同步（逐行级），其余一切 wire/协议/持久化路径零触碰」+ §11 头部同路径重叠优先序 | no-conflict（改判不触任何规范冻结面：wire 冻结条款约束的是协议行为与帧格式，testing.ts 为进程内测试 harness 装饰器；ws-replication AGENTS L18 明文把 test controls 归入 testing surface——改判恰落在模块决策自留的测试面内；装饰器透传不改变任何生产行为——被包装对象能力真实存在） | 本轮实读 testing.ts L38–L60（decorateLease 签名/`Object.freeze` 15 成员 `.bind(lease)` 透传 + openReplicationSession 包装/文件头「不进 src/index.ts 生产 API」注释）；`ws-replication/src/index.ts` grep 零 testing 引用；`ws-replication/tsconfig.json` include `src/**`（⑩ 入根 typecheck 域）；`-root-typecheck.log` 唯一红 = 该文件 TS2741（必填成员在场的编译器证据）；ADR 0030 L73；design §7-D9(b)/§11 | 实现后复查：⑩ 落盘后根 `pnpm typecheck` exit 0；testing.ts diff 恰一行成员；ws-replication 导出面与 wire 帧零 diff |
| 30 | **ADR 0028 负控纪律 + SA6/SA8 复查清单覆盖域**（iteration 2 新增裁决面：⑨ DENY 改判 + 计数修正） | #369 契约族 = 窗口读验收负控基线（保持绿证明零回归）；DENY「无需也无法改」的事实前提已被编译器否决（SA3 B-1②/B-2） | **⑨ 改判**：issue-369 契约文件 `makeStubRuntime` 补恰一行 D9(a) throw stub + 注释（可选同步 L864 陈旧计数措辞）；**断言零改动**；DENY 行改判 = 「断言与被测行为零改动 + 逐行级例外指向 ALLOW 行」；同路径重叠优先序使 ALLOW 精确列出的改动形态优先、DENY 管辖其余一切；SA8 复查清单②「七桩补齐后 tsc exit 0」由设计 §6 明示**按十处清单执行** | no-conflict（负控的规范价值在其**断言与被测行为**——改的只是替身的类型满足性；负控语义〔readData/窗口读面零回归〕不被一行类型桩削弱，33/33 保持全绿为证；DENY 行原文的事实陈述错误由 SA1 依 SA3 编译器证据改判，属设计自身范围文件的范围修正，非 ADR/CONTEXT/协议修订） | design §2.13⑨/§10/§11（ALLOW 新行 + DENY 改判行 + 优先序纪律）/§14；SA3 `-test-tsc2.log` 首行 = 该文件 TS2741；`-affected-suites.log` 33/33；本轮实读该文件（L864/L870/L871 现状无 watchMap——待落盘；L203–209 断言形态） | 实现后复查：⑨ 落盘后断言 diff = 0、33/33 全绿、测试树 tsc exit 0 |

裁决分布：**implements-existing-decision × 12**（行 1/2/7/8/9/11/12/15/16/19/23/27）、
**no-conflict × 18**（行 3/4/5/6/10/13/14/17/18/20/21/22/24/25/26/28/29/30）。
每项均引用决策路径与具体条款；无一项以「符合 ADR」了结。

**iteration 1 → 2 裁决变化说明**：iteration 1 的 26 项裁决无一被翻转——行 23 计数由
「四处键集 + 七结构桩」修正为「四处键集 + 十结构实现点」（同一决策条款下的清单扩面，
分类不变）；新增行 27/28/29/30 裁决 iteration 2 的三个新决策面（D10 ③b、⑩ 改判、⑨ 改判
+ 计数修正），全部落于 no-conflict / implements-existing-decision 档。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| —（无） | — | — | — |

无任何 override 被使用或被需要：issue #387 评论 = 0（本轮 `gh` 复读；Owner requirements:
none）；无新 ADR 修订/废弃旧 ADR；无协议版本升级；设计明示「无 ADR 被修订或推翻」（§15）。
§11 DENY 两行的改判对象是**设计自身的范围冻结文件**（iteration 1 由 SA1 写下、含被实现
否证的事实陈述），不是 ADR/CONTEXT/协议决策——改判依据 = 编译器事实（SA3 日志），非
override 权威。D8 是 ADR §6 原文的忠实实例化；B-2/B-3/B-4/B-5/D9/D10 均为规范文本未决
缺口的实例化，不构成对已决定条款的覆盖。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（design 承诺面 + 工作树现状） |
|---|---|---|---|
| readData 交付形状 | 恒四键 `{ok,value,schema,truncated}`；投影文本 + ✂ 段 | ADR 0027；仓库守卫门 | 保持（DENY `read-schema-projection.ts`；工作树零 diff） |
| 窗口读 API 与词表 | `readArray`/`readMap`、`WINDOW_*` 三码、条目身份形状 | ADR 0028；CONTEXT L62 | 保持（DENY `window-read.ts`；#369 契约断言零改动——⑨ 改判以「断言 diff = 0」为不变量） |
| **#369 负控契约断言**（iteration 2 新列） | `issue-369-*.ts` 断言与被测行为零改动（33/33 基线） | SA3 `-affected-suites.log`；design §11 DENY 改判行 | 保持（唯一例外 = `makeStubRuntime` 类型面一行 stub，逐行级、断言不触；其余族文件〔如 `issue-369-window-read-fixture.ts` 工厂委托〕零触碰） |
| **复制 wire / 协议 / 持久化与 ws-replication 导出面**（iteration 2 新列） | instance-replication-v1 帧/错误码/reason；`subscribeOwnedUpdates`；`ws-replication/src/index.ts` 导出面 | ADR 0010/0013/0022；ADR 0030 §7 L73；ws-replication AGENTS L18 | 保持（工作树 ws-replication/** 零 diff；唯一例外 = `src/testing.ts` 装饰器一行透传——testing surface、不进生产 API、不触 wire） |
| 诊断变更日志 | emission/record schema/retention/槽外纪律 | ADR 0011/0014 | 保持（DENY `diagnostic`；纪律仅被镜像） |
| 持久化格式 | snapshot docstore 语义 | ADR 0006 | 保持（零持久化包改动；工作树对账） |
| lease 既有 15 键 / runtime 既有 14 键 | 语义、released/角色通道、幂等、FIFO、槽序 | ADR 0009 + #131/#134/#228；ADR 0008 + 修订节 | 保持（纯加法第 16/15 键；守卫更新 = 键集数组加行 + **十处**结构实现点补最小成员——iteration 2 修正后清单完整） |
| **P0 构造契约（AC5）**（iteration 2 新列） | 构造/ready 不依赖 ROOT 载体形态；异型 ROOT 照常 ready | ADR 0008 L18/L139；`runtime-p0-sequencer.test.ts` L148 | 保持（D10 容错捕获——构造零抛零副作用；P0 7/7 全绿为回归锚点） |
| close-lifecycle 负向事件订阅词审计（L177–182） | on/off/subscribe/unsubscribe/emit/… 不在 runtime 键面 | ADR 0008 L101 窄读（行 13） | 保持原样照绿（本轮实读词表不含 `watchMap`，不得加入） |
| Registry `ctx.provide` 服务构造 | 访问器属性纪律 | ADR 0023 | 保持（`registry.ts` DENY；工作树零 diff） |
| 稳定码注册表 | `errors.ts` append-only、既有码零改动 | ADR 0008 L131 | 保持（只追加 `WATCH_MAP_*` 两码 + getter 词表 additive；③b 复用 CARRIER_MISMATCH **不新增条目**；`SCHEMA_UNAVAILABLE` 写域码不触碰——本轮实读 errors.ts L241–255） |
| mutation 信封语义 | 单/批两形态、guard 组合 | ADR 0025/0026 | 保持（watch 只观察不介入写路径） |

## 6. Evolution requirements

**无 evolution-required 项**：iteration 2 修订不改变任何已决定契约——D10 ③b 为 ADR 0030 §3
码族在 ADR 未考虑状态（doc 级 ROOT 载体偏离态）上的缺口实例化，对 ADR 已考虑状态行为与
原文逐字一致（行 27/28 论证）；⑨⑩ 改判对象是设计自身范围文件且不触任何规范冻结面
（行 29/30）；十处清单为工程影响面修正（不触决策面）。故无需随变更集修订 ADR/CONTEXT/协议。

分期兑现义务（均属**既有决策的实现分期**，各有其票，登记防丢失——非 evolution）：

| 义务 | 权威条款 | 承接票 | 本设计预留 |
|---|---|---|---|
| 谓词 `where` 词表 + `WATCH_MAP_OPTIONS_INVALID` + options 槽（含签名简写对账） | ADR 0030 §2/§3 | T2 #388 | B-2 第三参加宽路径 + 码族前缀 |
| `'replication'` 断言编排（经 `openReplicationSession` 驱动）与 `watch-end` 终止编排（含 Peer re-arm，ADR 0018） | ADR 0030 §4/§6 + 验收节；#389 AC | T3 #389 | D8 无过滤机制在产 + 类型三 kind + R7（T3 零拆除面；⑩ 透传形态已为其留好真实行为面） |
| 队列上限 testing 工厂注入 + 溢出/父路径删除验收 | ADR 0030 §6 + 验收节 L94；spec US21 | T4 #390 | `createWatchHub` 单参数位（默认 16）+ invalidate-all 语义在产 |
| 三方文档面（含 R9 消费指引） | ADR 0030 验收节「文档缝」 | T5 #391 | 本票零文档改动 |
| **⑨⑩ 两行 ALLOW 改判项落盘**（iteration 2 新登记——决策面已闭合、实现面未闭合） | 本设计 §11 ALLOW 两行（D9(a)/(b) 冻结形态） | 本票（SA3 续轮/SA7 验证） | 改动形态已逐行冻结：⑨ 恰一行 throw stub + 注释；⑩ 恰一行 `.bind(lease)` 透传 |

## 7. Hard conflicts

**无。** iteration 2 修订后的设计与 ADR 0030 及交叉决策集（0008/0009/0010/0013/0018/0022/
0023/0025/0026/0027/0028、CONTEXT、三包 AGENTS、spec #385、issue AC、T2–T5 票面）无不
兼容点。SA3 指认的三项缺口经本轮独立复核全部闭合且不引入新决策面冲突：

- **B-1 十处清单**：本门五类模式独立 grep + 逐命中实读 + 编译器日志对账——清单完备
  （剩余命中全部为工厂委托/`as` 收窄/原型委托，非结构实现点）；
- **B-2 事实陈述撤回**：§2.14 重写与 §10 拆行后，设计不再含被实现否证的陈述；
- **A-1 → D10 ③b**：与 P0 冻结契约（ADR 0008 读取能力节）和 ADR 0030 §3 码族/缺席条款
  相容（行 27/28 分界论证成立：构造零依赖、缺席容器无载体不触发 ③b）。

## 8. Required actions

1. **⑨⑩ 两行落盘（唯一剩余实现缺口）**：`issue-369-window-read-lease-contract-red.test.ts`
   `makeStubRuntime` 补 D9(a) throw stub 恰一行（断言零改动；可选同步 L864「14 键面」计数
   措辞）；`ws-replication/src/testing.ts` `decorateLease` 补 `watchMap: lease.watchMap.bind(lease),`
   恰一行。落盘后三条门禁应全绿：① `npx tsc -p tsconfig.typecheck.json --noEmit` exit 0
   （当前余恰 2 处 TS2741 = ⑨⑩，`artifacts/sa3-issue387-test-tsc2.log`）；② `pnpm test`
   exit 0（当前 4753/4753 行为全绿、exit 1 仅因该 2 处，`-root-test-final.log`）；
   ③ 根 `pnpm typecheck` exit 0（当前唯一红 = ⑩，`-root-typecheck.log`）。
2. **实现期红线执行**（SA3/SA4/SA7）：按 design §11 ALLOW/DENY 执行——**同路径重叠优先序**
   下，⑨⑩ 只允许各自恰一行的冻结形态；DENY 其余覆盖域（wire/协议/持久化、#369 族其余文件、
   readData/窗口读/复制/诊断、docs/CONTEXT）零触碰。
3. **实现后冲突复查清单（按十处清单执行；取代 iteration 1 §8-4 的七桩口径）**：
   ① lease 恰 16 键 / runtime 恰 15 键且既有键语义零改动，`Object.keys` 审计四处 =
   lease 16 / runtime 15；② **十处**结构实现点补齐后 ①门禁 tsc exit 0 与根 typecheck
   exit 0；③ `WATCH_MAP_*` 两码 append-only、无既有码改动、③b 无新注册表条目；
   ④ 通知面恒三 kind 闭集、无队列进度/内部事件夹带、不含值；⑤ D8 无过滤行为：复制 apply
   触及订阅容器 → `origin:'replication'` data 通知到达 listener（实现不得引入任何 origin
   过滤面）；⑥ doRelease 清理时序（`entry.leases.delete` 后、`onReleased` 前）；
   ⑦ 观察器零 throw（DOCRT-E203 红线）；⑧ released lease → `NamespaceLeaseReleasedError`；
   ⑨ 两 index type-only 追加、值导出面不变；⑩（iteration 2 新增）**③b 分界行为**：map 形
   ROOT 下缺席容器（ghost/optionalTasks）建立成功〔E3 既有断言〕+ P0 文件 7/7 保持全绿；
   ⑪（iteration 2 新增）**负控不变式**：issue-369 契约 33/33 全绿且断言 diff = 0；
   ws-replication 导出面/wire 帧 diff = 0（⑩ 仅一行成员）。
4. **T4 义务登记**：#390 必须交付队列上限 testing 工厂注入与溢出验收断言（ADR §6 + 验收节 +
   spec US21）——否则变更订阅 phase 关账时该条款悬空。
5. **T2/T5 对账义务**：#388 落 options 槽时（或 #391 文档面）补 ADR 0030 §1 与 CONTEXT
   「变更订阅」词条签名简写的回调位，保持规范文本与 B-2 冻结绑定一致。
6. **后续精化过评审**：R3（Y 载体条目精确双投影比较）与 R4（union 值形态容器接纳）属词表/
   判定演进面，须过设计评审后方可实施。

## 9. Verdict

**clear** —— iteration 2 修订后的设计对 ADR 0030 为忠实实现（T1 切片），且把 SA3 实现轮
暴露的三项缺口全部闭合为与决策集相容的设计内容：

- **十点清单（B-1/B-2）**：影响面由「四键集 + 七桩」扩为「四键集 + 十结构实现点」，经本门
  五类模式独立 grep、逐命中实读排除与编译器日志对账复核为**完备精确**——扩面本身是
  ADR 0008/0009 公共面守卫纪律的兑现（#369 在树先例），全部改动形态入 ALLOW；
- **ALLOW/DENY 改判（⑨⑩）**：两处改判均为纯类型面一行同步，不触任何规范冻结面——⑨ 以
  「断言零改动 + 33/33 保持全绿」保住 #369 负控基线语义；⑩ 落位 ws-replication AGENTS L18
  自留的 testing surface（不进生产 API、不触 wire/协议/持久化/导出面）；同路径重叠优先序
  使 DENY 对两路径的其余覆盖域继续生效；
- **③b ROOT 载体门（A-1 → D10）**：兑现 ADR 0008 读取能力节与 P0 冻结契约（构造与 ROOT
  载体形态解耦），在 ADR 0030 §3 码族 message 区分条款内实例化第六拒绝位（不新增码），
  与「数据缺席合法」经 D3/D10 分界论证无冲突。

30 项对照全部为 no-conflict 或 implements-existing-decision；无 override、无 hard-conflict、
无缺失的修订计划；分期义务（T2/T3/T4/T5 + ⑨⑩ 落盘）均已有承接位并在此登记。SA3 报告
B-1①②③/B-2/A-1 与四项最小整改请求逐条对应到修订文本（设计 §14 映射表）且经本门复核成立。

## 10. requiresConflictRecheck

**true**。依据：lease 16 键 / runtime 15 键公共面增长（十处结构实现点 + 四处键集守卫的同步
**尚未全部落盘**——⑨⑩ 两行待实现，测试树类型门当前仍余恰 2 处 TS2741）、`WATCH_MAP_SCHEMA_UNAVAILABLE`
新码注册与 `WatchMapError` throw 失败语义、**③b 新建立拒绝分支**（复用既有码、失败语义面
仍属复查触发条件）、lease release 同步段清理与 runtime close hub 关停等生命周期钩子、
D8 origin 产出语义（无过滤）、以及 **⑨⑩ 两处范围改判的落盘形态核对**（断言零改动 /
导出面零改动两条不变式）均**尚待实现核对**（公共 API / 失败语义 / 生命周期 / 正式范围
改判四类触发条件逐一命中）；实现落地后按 §8-3 清单（①–⑪）执行 implementation 复查，
闭合后转 false。
