# SA2 设计攻击评审 — issue #387：watchMap 无谓词形态垂直通路（变更订阅 T1 / tracer bullet）

- 被审对象：`wiki/raw/task_issue-387_design.md`（SA1 设计，**修订轮 iteration 2**，649 行）
- 评审轮：**iteration 2（2026-09-14）**——实现重试前的正确性与完备性复审。评审链：
  iteration 0（reject：F-1/F-2 两 MAJOR）→ iteration 1（approve）→ SA3 实现轮
  iteration 0（**reject：范围不足**，B-1/B-2/A-1）→ SA1 iteration 2 修订 → SA8 设计后冲突
  复审 iteration 2（**clear**，30 项，`requiresConflictRecheck=true`）→ 本轮。
- Worktree：`/home/wangjian/nomicore-fix-issue-387`（branch `mabf/issue-387`，HEAD `6df1c61`；
  SA3 iteration 0 实现已落盘未提交——`git status` 本轮实读 = 17 处 ALLOW 内修改 +
  4 新文件〔watch-map.ts + 契约三件套〕，DENY 域零 diff，与设计/SA8 陈述一致）
- 评审方法：对 SA3 三项 finding（B-1①②③ / B-2 / A-1）的整改**逐条独立复核**——五类检索
  模式本轮独立全树 grep、逐命中实读、非结构点排除逐处验证、编译器仲裁日志与当前盘面
  逐一对账；设计↔已落盘实现的语义一致性全文对读（watch-map.ts 488 行全文、lease.ts /
  runtime.ts / errors.ts 关键段、四处键集守卫、P0 契约锚点、⑧⑨⑩ 三现场实读）。

---

## 1. Reviewed inputs

| 输入 | 状态 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-387.md`（任务简报） | 在场 | AC1–AC10 + 演示场景；评论 0 条（iteration 2 dispatch 复确认 REST `[]`） |
| `wiki/raw/task_issue-387_design.md`（iteration 2 修订版，649 行） | 在场 | 被审对象 |
| `wiki/raw/task_issue-387_sa3_impl.md`（SA3 实现报告 iteration 0，**reject：范围不足**） | 在场 | B-1①②③ / B-2 / A-1 + 四项最小整改请求——本轮整改核验基准 |
| `wiki/raw/task_issue-387_design_conflict_report.md`（SA8 设计后复审 **iteration 2**，30 项对照，verdict clear、`requiresConflictRecheck=true`） | 在场 | ⑨⑩ 改判与 D10 的冲突门裁决（行 23/27/28/29/30）+ 实现后复查清单 ①–⑪ |
| `wiki/raw/task_issue-387_sa6_contract.md` | 在场 | 绑定表 B-1–B-7、红灯基线、非目标 |
| `docs/adr/0030-change-subscription.md`（HEAD 零 diff） | 在场 | 规范权威（D8/③b 裁决基准；iteration 1 已逐条复读，本轮增量面复对 §3 码族） |
| 编译器仲裁日志（SA3 落盘、本轮逐行对账当前盘面） | 在场 | `artifacts/sa3-issue387-test-tsc2.log`（门禁① 恰 2 处 TS2741 = ⑨ `issue-369…(871,3)` + ⑩ `testing.ts(44,3)`）、`-root-typecheck.log`（门禁③ 恰 1 处 = ⑩）、`-root-test-final.log`（行为面 394 files / 4753 tests 全绿、`Type Errors: no errors`、`Errors 2` = 同两处 Unhandled Source Error、exit 1）、`-contract-run2.log`（21/21）、`-affected-suites.log`（14 files / 172 tests 全绿，#369 契约 33/33）、`-p0-and-contract.log`（P0 7/7 + 387 契约 21/21） |
| 本轮独立 grep（五类模式全树） | — | `implements NamespaceRuntime` 恰 5（①–⑤）；`: NamespaceRuntime = {` 字面量恰 2（⑥–⑦）+ runtime.ts L745 本体；`): NamespaceRuntime` 返回注解命中 = registry-open L182（⑧，**已修**：stub 现于 L189–193）+ issue-369 L870（⑨，**待落盘**：L871 起 return 字面量无 watchMap）+ 其余全为工厂委托/参数注解/类型引用；`): NamespaceLease` = lease.ts L216 本体 + testing.ts L42（⑩，**待落盘**：L44 `Object.freeze({` 无 watchMap）+ `okLease` 全族 `as` 收窄 + issue256 `proxyLease` `Object.create` 原型委托；`satisfies Namespace*` 零命中；`keyof NamespaceRuntime/Lease` 穷举断言零命中（仅 `keyof NamespaceLeaseReleasedIssue` 异型面） |
| 已落盘实现全读 | — | `watch-map.ts`（488 行全文：①–⑥ 建立状态机含 ③b / C-1–C-4 / D 真变 / E 泵与溢出 / `captureRootMap` / `classifyOrigin` 无过滤 / 守卫式 `shutdown`）、`lease.ts`（watchMap L347 起：released throw → 透传 → 双幂等登记；doRelease 清理位于 `entry.leases.delete` 后、`dispatchObserver` 前；五 Equal 锁 L501 起）、`runtime.ts`（L576 V3c'''' 位 hub 构造、L633 `closeAfterFence` 并置 `watchHub.shutdown()`、L753 第 15 键、接口 L309）、`errors.ts`（两码 append-only + `WatchMapError` + getter 词表 `'watchMap'` additive）、四处键集守卫（registry-open 16 键 / internal-seam·phase5·close-lifecycle 15 键，负向词表未动且不含 watchMap）、`runtime-p0-sequencer.test.ts` L148 AC5（`rootCarrier: 'text'` → 照常 ready） |
| `tsconfig.typecheck.json` / `vitest.config.ts` / 两包 `tsconfig.json` / `packages/ws-replication/AGENTS.md` L18 | 在场 | 三门禁 include 语义（测试树门含 `packages/*/src/**` → ⑩ 直接入域；根门 14 包 `src/**`）+ testing surface 纪律（「keep programmable adapters and test controls in the explicit testing surface」——⑩ 落位的模块契约依据；testing.ts 文件头 L5–6 自证不进 `src/index.ts` 生产 API） |

## 2. Verdict

**approve（0 × BLOCKER，0 × MAJOR）**。

iteration 2 修订把 SA3 实现轮暴露的三项缺口全部闭合，且本轮独立复核**全部属实**：

- **B-1（范围不足）——已闭合**。十处结构实现点清单经本轮独立五类模式 grep + 逐命中实读
  + 编译器日志对账为**完备精确**：⑧ 已在 ALLOW 路径内修复（registry-open L189–193，
  本轮实读在场）；⑨⑩ 两行改判已入 ALLOW（恰一行冻结形态）且待落盘现场与设计描述
  逐字符吻合（⑨ issue-369 L871 起 return 字面量无 watchMap、L863 陈旧「14 键面」注释；
  ⑩ testing.ts L44 `Object.freeze({` 15 成员全 `.bind(lease)` 无 watchMap）。剩余非结构点
  （工厂委托 ×7 处形态、`as` 收窄、原型委托）经编译器实证零 TS2741，排除依据成立。
- **B-2（事实陈述被实现否决）——已闭合**。§2.14 重写为「lease 侧结构实现点恰两处」、
  §10「零改动」行拆出 ⑨⑩ 两例外行——本轮全文扫描无残留旧陈述；检索模式扩为五类 +
  「仲裁者 = 编译器」纪律（§13-R8）是对 B-2 教训的正确制度化。
- **A-1（ROOT 载体构造期抛错）——已吸收为设计冻结（D10/③b）**。构造期容错捕获
  （`captureRootMap`，零抛零副作用）+ 建立场 ③b 响亮拒绝（复用
  `WATCH_MAP_CARRIER_MISMATCH` 码 + 专属 message，不新增注册表条目）+ `shutdown`
  对称守卫；frozen 契约 P0 AC5 在树为回归锚点（本轮实读 L148 + SA3 V6b 7/7 全绿）；
  与 AC1「数据缺席合法」的分界论证（③b 是 doc 级载体事实，非容器级 live 探测；
  缺席容器无载体不触发）经 fixture E3（ghost/optionalTasks 建立成功，21/21 绿）行为证实。

### SA3 finding 整改核验（iteration 2 专项）

| Finding | 整改声明（设计 §14） | 本轮独立复核结果 |
|---|---|---|
| **B-1①**（registry-open `makeRuntime` 漏记；路径在 ALLOW） | §2.13⑧ 入账 + 已修状态；§10/§11 双义务合并表述 | **属实**。L182–183 形态命中（返回类型注解 + return 字面量）；stub 现于 L189–193（注释 + 恒 throw，D9(a) 形态）；门禁① 日志从首轮 3 错降为 2 错的插值与该修复吻合 |
| **B-1②**（issue-369 `makeStubRuntime`；原 DENY 明文） | §2.13⑨ + §11 ALLOW 新行（恰一行 D9(a) stub）+ DENY 行改判（断言零改动 + 逐行级例外）；33/33 保持全绿 | **属实**。L870/L871 现场无 watchMap（TS2741 于 871,3——编译器日志与盘面一致）；L203–209 实读确为成员存在性断言（`toBeTypeOf('function')`）非键集断言 → 加 stub 行零断言影响；SA3 V6 实测 33/33 为该文件行为面不变性的运行证据；DENY 改判行 + §11 头部同路径重叠优先序在文 |
| **B-1③**（ws-replication `decorateLease`；原 ALLOW 外） | §2.13⑩/§2.14 重写 + §11 ALLOW 新行（恰一行 `.bind(lease)` 透传）+ DENY wire 行改判（唯一例外 = testing.ts 类型面） | **属实**。L38–60 实读：15 成员全 `.bind(lease)` 透传 + `openReplicationSession` 包装注入探针，D9(b) 透传形态与邻成员逐字同款；testing.ts 文件头自证不进生产 API，`ws-replication/AGENTS.md` L18 明文把 test controls 归 testing surface（本轮实读）——改判落位模块契约自留面；根 typecheck 唯一红 = 该文件（44,3），与设计陈述一致 |
| **B-2**（两处事实陈述被否决 + 检索模式不完备） | §2.13 五类模式 + 非结构点排除依据、§2.14 撤回重写、§10 拆行、§13-R8 编译器仲裁 | **属实**。本轮独立 grep 全部落入十处 + 本体两处；`proxyLease`（L164 `Object.create(lease) as`——成员经原型链继承）、`createBudgetRuntimeFromHandle`（L122 签名 / L126 `return createNamespaceRuntimeWithSeam({...})` 纯委托）、`runtime-replication-schema-lifecycle` `makeRuntime`（handle 构造 + 工厂委托）逐处实读排除成立；「17 处成员索引全为具名成员」有效内容维持（见 N-3） |
| **A-1**（字面「构造期挂接」与 P0 AC5 冲突） | §2.15 锚点 + §7-D10（三否决备选）+ §8-B ③b + §8-G 容错捕获 + §9 六拒绝位 + §12 ③b 行 + §13-R10 | **属实且实现语义一致**。`watch-map.ts` L353–359 `captureRootMap`（try/catch → undefined）、L372 构造期单次捕获、L395 条件挂接、L432–434 ③b throw、L480 `root !== undefined` 守卫摘除——设计 §8-B/§8-G 逐句有实现对应；P0 AC5（L148）在树为 frozen 回归锚点，SA3 V6b 7/7 绿 |
| SA3 最小整改请求 1–4 | §14 逐条「已采纳」 | **逐条属实**：请求 1（ALLOW 增两行）= §11 两新行；请求 2（DENY 两行改判）= §11 两改判行 + 头部优先序；请求 3（计数 ×10 + lease 第二实现点）= §2.13/§2.14/§12 全部同步（本轮全文扫描无「七桩/八文件/无第二实现点」残留旧计数——存量「七桩」字样均为历史陈述或「七桩+⑧」插值算式，语境正确）；请求 4（SA8 复查清单同步）= §6 两行 + §15 理由 4/5，SA8 iteration 2 已按十处清单重裁（其 §8-3 ①–⑪） |

## 3. 需求覆盖

iteration 1 的 AC1–AC10 + 演示场景逐条落点复核**全部维持**（§7 冻结表 / §8 机制 / §12
映射三层未回退；本轮抽读 §8-A 类型面与已落盘实现逐字段一致）。iteration 2 增量面的
增量核对：

| Requirement（issue #387） | Design section | Assessment |
|---|---|---|
| AC1 含「数据缺席合法」 | §7-D3/D10 分界、§8-B⑤、§12 E3 行 | 落实且经行为证实（E3 21/21 绿）；③b 不触发缺席容器——fixture `ghost?`/`optionalTasks?` 建立成功 |
| AC3 `WATCH_MAP_CARRIER_MISMATCH` message 区分 | §8-B 文案表**六**拒绝位（iteration 2 增 ROOT 载体位） | 落实；六文案互异、零 path/身份回显（errors 面 L109–123 实读与文案表逐字一致） |
| AC8 lease 释放自动清理 | §8-F、§7-D6 | 落实；doRelease 清理位次本轮实读（`entry.leases.delete` → activeWatches 遍历 → `dispatchObserver`）与设计 §8-F「delete 之后、onReleased 之前」一致 |
| AC10 registry 公共面纯加法 + 影响面完整 | §2.12/§2.13/§2.14（四处键集 + 十实现点）、§11、§12 门禁 | **完整（B-1 闭合后）**；四处键集守卫已落盘为 16/15/15/15（本轮实读），⑨⑩ 两行为剩余唯一缺口且已逐行冻结 |
| 演示场景 | §12 最小调用映射 | 落实（N1 定位符 + `[...path,key]` readData 回环断言在契约内，21/21 绿） |
| 非目标（T2–T5/watchArray/含值通知/origin 过滤） | §1 | 边界三向一致维持；D8 无过滤与 T3 #389「补验收编排而非接线」的读法在 iteration 1 已裁且未被本轮修订扰动 |

## 4. Owner评论覆盖

| Comment ID | Updated at | Design section | Assessment |
|---|---|---|---|
| （无） | — | issue #387 评论数 = 0（iteration 2 dispatch 复确认 "Owner requirements: none; current issue comments REST snapshot is empty ([])"） | 无 owner 条款需映射；需求源 = issue 正文 + ADR 0030 + SA6 契约，已在 §3 覆盖（设计 §4 同款登记，本轮复核一致） |

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| SA3 实现报告 B-1/B-2/A-1（本轮核心上游事实） | §14 iteration 2 映射表（逐条「已落实」） | 逐条闭合，本轮独立复核属实（见 §2 整改核验表）——设计不再含被实现否证的陈述 |
| SA8 设计后复审 iteration 2（30 项，clear） | §6 全表 + §15 理由 4/5 | 五条分期义务 + ⑨⑩ 落盘义务 + 实现后复查清单 ①–⑪ 由设计 §6/§8/§13 与 SA8 §6/§8-3 双侧登记，闭合链完整 |
| SA8 行 23（十点清单独立复核完备） | §2.13 编译器仲裁 | 本轮第三方复核（SA2 独立 grep + 日志对账）得出同结论——三方（SA3 编译器日志 / SA8 / SA2）交叉一致 |
| SA8 行 27/28（D10 对 ADR 0008 读取能力节 + P0 AC5 的兑现；③b 为 §3 码族缺口实例化） | §7-D10、§8-B/§8-G | 与 ADR 0008 L18/L139「open 结果与 ROOT 载体形态解耦」相容（容错捕获正是解耦的实现形态）；③b 复用码不新增条目（errors.ts 实读：仅两新常量 + 类，既有码零改动） |
| SA8 行 29（⑩ 改判落 testing surface） | §7-D9(b)、§11 | `ws-replication/AGENTS.md` L18 本轮实读证实；装饰器透传与其余 15 成员同款——不伪造能力（被包装 lease 真有该能力） |
| SA8 行 30（⑨ 改判保负控基线） | §11 DENY 改判行 | 「断言零改动 + 33/33 全绿」不变式经 SA3 V6 运行证据 + 本轮断言形态实读（成员存在性非键集）双重支撑 |
| ADR 0030 §5 宁多勿漏 / §6 三来源全覆盖 | §7-D8、§8-C/E | iteration 1 冻结维持；`classifyOrigin`（watch-map.ts L305–308）无过滤分支、symbol→replication，实现与冻结语义逐字一致 |
| SA6 B-2/B-3/B-4/B-5 四项冻结 | §7 冻结表 | iteration 0/1 已逐条核验维持；本轮抽读 §8-A/§8-F 与实现（五 Equal 锁、三别名单源、同步 throw 面）一致 |
| `packages/ws-replication/AGENTS.md`（testing surface 纪律） | §11 ⑩ 行 | 本轮实读 L18；改判不触「Export production APIs through `src/index.ts`」——testing.ts 不在生产 API 面 |

## 6. 设计内部一致性

- **iteration 2 增量的一致性**：十处计数在 §1（目标 6）、§2.13/§2.14、§7-D5（代价段）、
  §10（矩阵）、§11（ALLOW）、§12（门禁①「×10」）、§13-R6（回滚）/R8（维护债）八处
  口径统一为「四处键集 + 十结构实现点」；本轮全文扫描**无残留旧计数**（「七桩」字样
  仅存于历史语境与「七桩+⑧」插值算式，语义正确）。
- **⑨⑩ 改判的自洽**：§11 头部「同路径重叠优先序」（ALLOW 精确列出的逐行级改动形态
  优先；DENY 继续管辖同路径其余一切）+ 两 ALLOW 行「恰一行」冻结 + 两 DENY 行改判
  （各以一条不变式为界：⑨ 断言零改动 / ⑩ 导出面与 wire 零改动）——无漏洞、无歧义、
  可逐行审计。
- **③b 的全文贯穿**：§1（目标 3）、§2.15、§6（SA8 行）、§7-D10、§8-B（③b 门 +
  文案第六位）、§8-G（容错捕获 + 条件挂接 + 守卫摘除）、§9（六拒绝位）、§12（③b 行 +
  P0 回归锚点）、§13-R10 九处同一语义；与已落盘实现逐句对应（本轮全读 watch-map.ts）。
- **设计↔实现语义对账声明**（题头「本修订版全文与该实现语义一致」）：watch-map.ts /
  lease.ts / runtime.ts / errors.ts / 四键集守卫 / P0 锚点本轮实读**未发现语义偏差**
  （唯一文本级缺口见 N-5——设计 §8-B⑤ 的 kind 判定枚举漏写 `optional` 透明解包一步，
  实现已做且为 E3 绿所必需；不影响重试，因其不属重试改动面）。
- 抽样复核：§2.13 行号锚点与当前文件吻合（⑧ L182/L183/L191、⑨ L870/L871、⑩ L38/L44
  误差 ≤1 行且内容可唯一定位）；§12 门禁三命令与 `tsconfig.typecheck.json` /
  `vitest.config.ts` / 根 `package.json` include 语义吻合（测试树门含 `packages/*/src/**`
  → ⑩ 直接入域，与「⑩ 经 import 图入程序」的表述殊途同归）。

## 7. 状态机与并发攻击

iteration 1 的 SC-1–SC-13 结论全部维持（锚点本轮抽查未变化；SC-8′ 无过滤读法经
`classifyOrigin` 实读复核在产）。iteration 2 增量面的新攻击：

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| SC-14（③b 时序） | 异型 ROOT 文档、schemaState 已 ready（P0 AC5 证明该态可达——`rootCarrier:'text'` 下 schema.state → 'ready'） | `watchMap(path, listener)` | ③ 门（schema ready）通过后 ③b 门同步 throw `WATCH_MAP_CARRIER_MISMATCH`（ROOT 载体 message）；零登记零 observer 变更 | 无（watch-map.ts L427–434 实读：③ → ③b → ④ 次序与设计 §8-B 一致；该态可达性由 P0 AC5 用例结构证明） | — |
| SC-15（shutdown 对称） | hub 已挂接 observer | runtime close（普通 close / reset fence 汇合 `closeAfterFence`） | `unobserveDeep` 恰一次（`root !== undefined` 守卫）；全部订阅置 unsubscribed + 清队；幂等（`shutdownDone`） | 无（L477–486 实读；`closeAfterFence` 内与 `fanout.terminateAll` 并置，L631–636 实读） | — |
| SC-16（⑨ 落盘后负控） | #369 契约文件 33/33 绿、替身补一行 stub | 任意既有用例运行 | 断言面零变化（stub 从不被调用——该文件用例不触 watchMap） | 无（SA3 V6 已证该文件在替身缺成员时也 33/33 绿——运行时根本不触；类型面补成员只增不减） | — |
| SC-17（⑩ 落盘后透传） | decorateLease 包装真实 lease | ws-replication 测试调用 `watchMap`（现无调用方） | 得到真 lease 的真实行为（透传非伪造） | 无（`.bind(lease)` 与邻成员同款；T3 #389 复用 harness 时为真实行为面——D9(b) 论证成立） | — |

## 8. 错误与恢复攻击

iteration 1 的 ER-1–ER-8 结论维持。iteration 2 增量：③b 拒绝为**新增失败面**，其
fail-loud 定位经攻击复核成立——静默建立死订阅 = 永久漏通知态（ADR §5 判为不可接受），
构造期抛错 = 违反 P0 AC5 frozen 契约，两者均被设计显式否决（D10 否决备选段）；构造期
`getMap` 抛错路径零副作用（不创建、不替换既有载体——captureRootMap try/catch 语义，
Yjs `getMap` 对已定义异型名字的抛错不改变 doc 状态）。⑨⑩ 一行改动零新错误面（throw
stub 响亮拒绝 / 透传零行为差异）。无静默失败、无伪成功路径。

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| `NamespaceRuntime` 必填第 15 键的**十处**结构实现点 | **无（B-1 闭合）**：十处全入 ALLOW（七桩 + ⑧⑨ stub / ⑩ 透传）+ D9 两类冻结形态 + 门禁①③ 编译器仲裁；本轮独立 grep 无第 11 处（剩余命中 = 工厂委托 / `as` 收窄 / 原型委托，逐处实读 + 编译器实证排除） | 五类模式全树 grep；`-test-tsc2.log` / `-root-typecheck.log`；`tsconfig.typecheck.json` include 实读 | — |
| 四处键集断言（16/15/15/15） | 无：四处已落盘且负向事件订阅词审计保持原样（`watchMap` 不入词表——本轮实读 close-lifecycle L178–182 词表） | 四处实读（registry-open L924–942 / internal-seam L276 起 / phase5 L127–145 / close-lifecycle L157–176） | — |
| `NamespaceLease` 第 16 键 | 无：lease.ts 本体 + ⑩ 装饰器两实现点均入账；无 `keyof NamespaceLease` 穷举断言（本轮 grep 复证） | grep + §2.14 | — |
| ws-replication 导出面 / wire 帧 | 无：⑩ 仅成员行；testing.ts 不进 `src/index.ts`（文件头自证）；SA8 复查清单 ⑪（diff = 0 不变式）在册 | testing.ts L1–11 实读；SA8 §8-3 | — |
| #369 负控契约族 | 无：⑨ 以「断言零改动 + 33/33 全绿」为不变式；其余族文件（fixture 工厂委托）零触碰 | L203–209 断言形态实读；SA3 `-affected-suites.log` | — |
| `RuntimeReadDisabledError` 词表 / 稳定码注册表 | 无：additive / append-only（③b 复用码不新增条目） | errors.ts L56–75 / L241–268 实读 | — |

## 10. 架构一致性与惯例审查

iteration 1 全部结论维持（责任归属 / 相似能力对照〔泵镜像 fanout、`normalizeReadPath`
复用、#369 stub 先例〕/ 单一事实源 / 生命周期对称 / 平行机制检查）。iteration 2 增量：

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| ROOT 载体容错捕获 + ③b 拒绝 | runtime（doc 生命周期 Owner） | §7-D10、§8-B/G | 正确；lease 零载体知识、纯透传（§8-F 实读一致） |
| ⑨ 桩补齐 | 测试文件自身（#369 契约负控基线） | §11 ALLOW ⑨ 行 | 正确；替身类型满足性属该文件自身义务，断言面不动 |
| ⑩ 装饰器成员同步 | ws-replication testing surface | §7-D9(b)、§11 ⑩ 行 | 正确；模块 AGENTS L18 自留面，透传为唯一诚实形态 |

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 影响面清单的第二事实源 | 编译器（两门禁） | §2.13 grep 五类模式 | grep 自我定位为「线索」、编译器为仲裁（§13-R8）——无平行事实源，制度正确 |
| ③b 与 D3 的载体判定分叉 | schema 侧判定（D3） | doc 级一次性事实（③b） | 分界显式（构造期一次 ≠ 容器级 live 探测）；非重复机制 |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW LIST 完整性（B-1 核心） | 7 src（watch-map.ts 新增 + 6）+ 11 测试 + 2 新改判行（⑨⑩）+ 2 可选契约行；与 §2.12/§2.13/§2.14/§10 正文依据闭环；已落盘 17 修改 + 4 新文件全部落在 ALLOW 内（`git status` 本轮对账），剩余缺口恰 = ⑨⑩ 两行 | 无（完整） |
| ALLOW 无无理由扩张 | ⑨⑩ 两新行各挂 B-1 实测编译红证据 + 恰一行冻结形态 + 不变式（断言零改动 / 导出面不变）；其余行理由承袭 iteration 1 | 无 |
| DENY 与正文冲突 | 未发现：⑨⑩ 改判以同路径重叠优先序 + 逐行级例外收敛，DENY 对两路径其余覆盖域继续生效；wire/协议/持久化、readData/窗口读/复制/诊断、docs/CONTEXT 覆盖域与正文零矛盾 | 无 |
| follow-up 掩盖必要项 | ⑨⑩ 落盘义务被 SA8 §6 分期表**明列为本票**（非 follow-up 票）——不属被掩盖的必要项；T2–T5 分期维持 | 无 |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1–AC8 行为面 | 契约三件套 21/21 已绿（`-contract-run2.log`；实现前 20 红 / 1 绿基线在档） | 无 | — |
| AC10/AC9 影响面（B-1） | §12 门禁三命令 + 实测插值：①当前恰 2 处 TS2741（⑨⑩）→ 落盘后 exit 0；②当前 4753/4753 行为绿 + `Errors 2`（本轮实读 = 同两处 Unhandled Source Error）→ 落盘后 `Errors 0 / exit 0`；③当前唯一红 = ⑩ → 落盘后 exit 0；四处 `Object.keys` 审计 = 16/15/15/15 | 无（三命令与日志逐一对账吻合；预测值有实测插值支撑而非臆测） | — |
| ③b ROOT 载体门（新失败面） | P0 AC5 回归锚点（frozen，在树）+ §12 明示不新增断言（行为断言属非目标边界，R10 登记 T4/T5 过评审） | 无（分期一致；fail-loud 语义经门禁①③与 P0 文件间接锚定） | — |
| 负控不变式（⑨） | SA8 复查清单 ⑪：断言 diff = 0 + 33/33 全绿 | 无 | — |
| 复制来源通知（F-2 澄清面） | T1 不新增断言；T3 #389 判据逐字登记（SA8 行 5） | 无 | — |
| 溢出降级 / watch-end / 注入 | 非本票验收（T4/T3 有票；SA8 §6 分期义务表登记「否则 ADR §6 验收条款悬空」——闭合链在册） | 无 | — |

## 13. Required revisions

**无（0 × BLOCKER / 0 × MAJOR）。**

SA3 实现轮的 B-1①②③ / B-2 / A-1 与四项最小整改请求已按 §14 iteration 2 映射完整
落实，并经本轮独立 grep、逐文件实读、编译器日志与已落盘实现的全读复核闭合。设计对
实现重试给出的剩余工作面（⑨⑩ 两行恰一行的冻结形态 + 三门禁命令与预期值）**精确、
完备、可直接执行**。

## 14. Non-blocking observations

- **N-1（实现后复查，沿 SA8 §8-3）**：⑨⑩ 落盘后按 SA8 iteration 2 复查清单 ①–⑪
  执行 implementation 复查（尤其 ② 双 typecheck exit 0、⑤ D8 无过滤行为、⑩ ③b 分界
  行为、⑪ 负控不变式）；`requiresConflictRecheck` 维持 true 直至该清单闭合——本轮
  无需新增 ADR 冲突重查面。
- **N-2（重试执行提示，非设计缺口）**：剩余实现缺口恰两行——⑨
  `issue-369-window-read-lease-contract-red.test.ts` `makeStubRuntime` 字面量补
  D9(a) throw stub（建议同款注释；可选同步 L863「14 键面」→「15 键面」——R5）；
  ⑩ `ws-replication/src/testing.ts` `decorateLease` 补
  `watchMap: lease.watchMap.bind(lease),`。落盘后跑三门禁（预期值见 §12）。
- **N-3（沿袭微瑕）**：「17 处 `NamespaceRuntime['…']`」实数 16–17（视 test-d 计入），
  其有效内容（全为具名成员索引、无 keyof 穷举）成立；§2.13 个别行号有 ≤1 行误差
  （⑨ 函数签名实起 L866、闭合注解 L870）——内容可唯一定位，实现期以内容检索为准。
- **N-4（沿袭登记项）**：O-4/T1–T3 静默窗（R9）与 O-5/R1 可测性（T4 注入）、T4 溢出
  验收义务（SA8 §6 明示「否则 ADR §6 验收条款悬空」）、T2/T5 签名简写对账——重申
  勿在后续票关账时丢失。
- **N-5（新，设计文本完备性微瑕）**：§7-D3/§8-B⑤ 的载体判定规格写为「valueSchema
  （ref 经 aliases 闭包追尽）kind='object' → 通过；其余 kind → CARRIER_MISMATCH」，
  **未列 `kind:'optional'` 的透明解包步骤**——而 fixture 的 E3 正例（`ghost?` /
  `optionalTasks?`，fixture L62/L64）经 `resolveSchemaAtPath` 携带 optional 包装
  （`derived.ts` L57 该 kind 在产），已落盘实现 `resolveCarrierKind`（watch-map.ts
  L148–169）的 optional 解包正是 E3 绿所必需。按设计文本**从零**重实现会把 `ghost`/
  `optionalTasks` 误拒为「非键容器」。不影响本次重试（该代码已落盘且 21/21 绿、不在
  ⑨⑩ 改动面），建议 SA1 后续在 D3/§8-B⑤ 补一句「`optional` 包装透明解包（判定落在
  被包装值上）」，使规格文本与「全文语义一致」声明完全自洽。

---

## 裁决理由小结

iteration 2 修订把 SA3 实现轮的三项缺口从「清单遗漏」「事实陈述被否证」「实现缺陷
游离于设计外」修复为「编译器仲裁的完备清单」「撤回并制度化（五类模式 + 编译器终审）」
「吸收为带否决备选的设计冻结（D10/③b）」，且 ALLOW/DENY 改判以同路径重叠优先序 +
恰一行冻结形态 + 双不变式（断言零改动 / 导出面不变）收敛到可逐行审计的粒度。本轮对
全部关键声明做了独立三方交叉验证（SA2 grep + SA3 编译器日志 + SA8 复核）：十处清单
完备、⑧ 已修且 ⑨⑩ 现场与设计逐字吻合、已落盘实现与设计语义一致、三门禁当前红面恰
为 ⑨⑩ 且落盘后预期值有实测插值支撑。未发现新的 BLOCKER/MAJOR；设计对实现重试是
正确且完备的。按 skill 规则（无 BLOCKER/MAJOR ⇒ approve），verdict = **approve**。
