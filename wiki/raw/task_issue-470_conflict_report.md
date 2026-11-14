# SA8 冲突报告 — issue #470：Cordis rc.12 双形态 Root tracer bullet 与工件验真（前置门禁 + SA6 契约仲裁）

1. **Reviewed subject**: task（issue #470 任务简报 + SA6 验收契约 `wiki/raw/task_issue-470_sa6_acceptance_contract.md` 的已报告规范/范围冲突）
2. SA8 dispatch：`sa-5b34a21b-fa74-4beb-b1af-5c946e9d9673`，iteration 0，HEAD `279dba4ac81b7c7520e3d0b87b5c4d621a86a517`（worktree `mabf/issue-470`）。

---

## 1. Inputs and decision set

| 输入 | 位置 | 角色 |
|---|---|---|
| Owner 原文 | `wiki/raw/task_issue-470.md` L9–L36（What to build L17；8 条 checklist L21–L28；Comments 空；Blocked by: None） | 被审任务要求；无任何 owner 评论（dispatch log L6 `[]`） |
| SA6 验收契约 | `wiki/raw/task_issue-470_sa6_acceptance_contract.md`（§12.2 AC1–AC9、§12.4、§15.1、§15.3、§16 G13） | 被审上游契约（证据工件，非规范） |
| ADR 0035 | `docs/adr/0035-cordis-rc12-root-compatibility.md`，状态**提议**（tracking #468；L5「生产代码迁移尚未实施」） | normative。Issue 正文 L17 明文「实现 ADR 0035 的……tracer bullet」——owner 已将本 ADR 收编为本票治理设计；未被 superseded，构成约束 |
| 交叉 ADR | 0006（L86 root 绑定；L242+ drain/dispose 硬契约）、0009（L99–L103 shutdown/有序 disposer）、0012（L5/L37 plugin 所有权与不销毁上游）、0023（L45/L62 冻结服务面构造纪律）、0032（经 ws-replication AGENTS L21 收录：公共工厂 append-only） | normative 交叉面 |
| CONTEXT.md | 「服务表面（service surface）」L173–L175 等术语 | 术语基准；本仲裁无需术语演进 |
| 模块契约 | `packages/persistence/AGENTS.md`、`packages/dsh-persistence/AGENTS.md`、`packages/ws-replication/AGENTS.md`（L25–L26 Verification）、`packages/namespace-registry/AGENTS.md` | 模块边界与验证门 |
| 事实证据（本会话逐处复核） | `packages/persistence/src/service.ts:54`（`ctx.root.timeout`，仅此一处生产读取）；`packages/ws-replication/src/plugin.ts:214`（`timer.ctx?.root ?? ctx.root`，ws-replication src 全部 `.root` 读取仅此一行）；4 个 test fixture 的 Cordis `ctx.root` 读取：`ws-replication-plugin.test.ts:24–25,41`、`ws-replication-issue299-ac-red.test.ts:173,177`、`ws-replication-issue422-listen-false.test.ts:44,83–84`、`ws-replication-guard-proxy-consumption.test.ts:101–102`；全仓 grep 确认 `apps/`、`packages/dsh-persistence/`、其余包**零**直接 `ctx.root` 读取（ws-replication 测试里大量 `ctx.rootValue(...)`/`ctx.root('hub',...)` 是测试 harness helper，与 Cordis `Context.root` 无关，**不得**误列入迁移面） | 事实锚点 |

**清点结论（ADR 0035 §2「统一迁移」的完备面）**：全仓直接 `ctx.root` 读取 = 生产 2 处（persistence service.ts:54；ws-replication plugin.ts:214）+ Host fixture 4 文件（均在 ws-replication/test）。这与 ADR 0035 背景 L24–L26 点名的影响面（persistence scheduler、ws-replication Host timer adapter、现行 Host fixture）逐处吻合，无第三包、无遗漏。

**引文精确性更正**：任务简报与 SA6 §15.1 所引「ADR 0035 §5『不得用降级替代』」**不是 ADR 原文字句**（grep `降级|skip` 于 ADR 0035 全文零命中）。§5 的操作性约束是：L82「每个目标基线分别执行**全仓 typecheck** 和同一组外部行为测试；一个基线的绿色结果不得抵销另一个基线失败」+ L90 第 5 条反掩蔽（回退/同名替换/版本元数据错配/通道错配必须失败）。设计引用时须引原文，不得引用该转述。

---

## 2. 逐条仲裁（任务 7 问）

### Q1 — AC6「每个基线分别通过全仓 typecheck」的读法

**裁决：严格读法成立并绑定；「in-scope project 子集全绿 + 明文 known-red debt」不可辩护。**

依据：
- Owner checkbox 原文（`task_issue-470.md` L26）：「每个基线分别通过**全仓** typecheck 与现有 Persistence contract、真实 Timer、Nomicore DSH profile 相关测试；一个基线的绿色结果不得抵销另一基线失败。」——owner 亲笔、无歧义、无任何评论改写。
- ADR 0035 §5 L82 逐字重复同一要求。「全仓」在本仓有唯一规范锚点：根 `package.json` `scripts.typecheck` 的 **15 个 project**（L13，含 `packages/ws-replication/tsconfig.json` 与 `apps/yjs-server/tsconfig.json`）。不存在把某包排除出「全仓」的合法读法。
- 子集读法的实质是把红验收单元改写为「记录在案的债务」——这是 SA6 §12.2 AC6 失败判据明文禁止的形态（「被 skip/从 tsconfig 删除而未仲裁」），也违反 L26/§5 L82 的「不得抵销」纪律的同一精神（按 project 维度）。按 SA8 override 规则，合法 override 只能来自 owner 评论、ADR 修订、协议升级或决策文本自带的演进条款——**四者皆无**（comments `[]`；ADR 0035 未修订；本仲裁不创设 override）。
- 子集读法**且不必要**：13 个 TS2576 全部落在 ADR 0035 §2 已强制迁移的面内（见 Q2），冲突可在规范集合内部消解，无需降级验收。

绑定细则（R1）：「全仓 typecheck」= 逐基线对根 `scripts.typecheck` 的 15-project 清单（或其超集）全部 `tsc -p` exit 0；不得以仓库默认 node_modules 类型面冒充基线 typecheck（SA6 §15.3.5）；不得 tsconfig 删项/skip/skipLibCheck 扩张/整体 cast 掩蔽；每 cell 独立留证，任一 project 红即该基线红。

### Q2 — ws-replication 生产 seam + 4 个 fixture 的迁移是否在授权范围内

**裁决：是——且不只是授权，是 AC6 × ADR 0035 §2 联合下的义务（mandatory）。**

依据：
- **ADR 0035 §2 L45**：「**两个**受影响包各自保留一个包内私有 Root 解析缝」——两个受影响包由背景 L24–L25 点名：`@nomicore/persistence` 的 Host scheduler 与 `@nomicore/ws-replication` 的 Host timer adapter（L25 逐字链接 `packages/ws-replication/src/plugin.ts`）。
- **ADR 0035 §2 L58**：「**生产代码和现行 Host fixtures 中的直接 `ctx.root` 读取统一迁移到该解析缝**。」——ws-replication plugin.ts:214 是生产代码直接读取；4 个 fixture 是「现行 Host fixtures 中的直接读取」（背景 L26：「现行测试还有若干直接读取 `ctx.root` 的 Host fixture，必须**随生产适配一起**覆盖两种形态」）。本会话全仓清点（§1）证明迁移面恰好 = 这 2+4 处，无遗漏也无扩大。
- **Issue AC7（L27）的排除项**是「不把兼容逻辑扩散到 **Persistence 核心或 Registry**」——未列 ws-replication；与 ADR 0035 §2 L56 的平行边界（「兼容 cast 不得扩散到 Registry、Persistence 核心、**Replication 状态机**或业务 API」）互证：被排除的是 Replication **状态机**，不是 ws-replication 的 Host adapter seam——后者恰是 ADR 点名的第二受影响包。
- **Issue AC6（L26）** 要求三基线全仓 typecheck 绿，而 rc.12 类型面 12 个 TS2576 在 ws-replication（SA6 §15.1 实测；src/plugin.ts:214 ×3 + 4 fixture ×10）——不迁移则 owner checkbox 不可满足。
- 「Replication 留待后续 ticket」（dispatch 措辞；Issue 正文 L17 的对应事实是「建立**后续 Replication** 与发布收官**可复用**的工件身份和 Root 通道验真能力」）指向的是 Replication 的**行为验收**（ADR 0035 §5 L92 行为清单中的「Hub/Peer/SessionHost 启停和 timer 清理」）与其自身 tracer bullet，不指向 typecheck 编译面与 §2 已点名的 seam 迁移。在「owner 无歧义 checkbox」与「dispatch 范围措辞」冲突时，checkbox 胜出。

否决的替代形态（不可作为迁移实现）：仅加 cast/tsconfig 排除把 TS2576 压静而不做 symbol 优先解析——那是掩蔽（违反 R1 与 §5 L90），且 ws-replication 在 rc.12 上 plugin apply 即会因 root 解析失败而炸（plugin.ts:214–217 现状），类型绿将谎报兼容；同时 ADR §2 的决策形态义务仍未兑现。

绑定细则（R2）：本票 ws-replication 允许改动面 = `src/plugin.ts` 的 Root 解析（或新增一个**包内私有**、仅被 plugin.ts import 的 seam 文件）+ 恰好 4 个具名 fixture 文件；其余 ws-replication 文件零改动（机械 gate 见 R7）。

### Q3 — ws-replication 在 issue #470 中的角色边界

**裁决：双重身份——(a) 全仓 typecheck 的编译面（三基线必须绿）；(b) 其生产 Root seam 按 §2 决策形态迁移。不是 AC2/AC3 的行为验收对象。**

边界四分：
1. **在范围内（编译面）**：`packages/ws-replication`（src+test）在 B1/B2/B3 三基线 typecheck 全绿（Q1/R1）；12 个 TS2576 经 §2 seam 消除。
2. **在范围内（seam 语义）**：plugin.ts 的 Root 解析迁移为 symbol 优先、legacy 兜底、缺席/形状不符 loud fail、无 ambient timer（ADR 0035 §2 L47–L54）；root 绑定调度所有权与停机语义不变（§3 L64–L66；ADR 0012 L5/L37「不销毁上游服务」不受影响——seam 只改「如何找到 root Context」，不改「谁拥有什么」）。
3. **在范围内（默认基线包门禁）**：因为改动了 ws-replication 生产代码，`packages/ws-replication/AGENTS.md` Verification（L25–L26）适用：改动路径的 focused tests + 包 typecheck + 根 typecheck + 根 test（默认基线 B1）。4 个被迁移 fixture 本身就是包内测试，B1 必须保持绿。这不是「Replication 行为验收」，是触碰该包代码的标准包门禁。
4. **不在范围内（行为验收）**：三基线 Hub/Peer/SessionHost 启停、timer 清理、连接状态机行为矩阵（ADR 0035 §5 L92 的 Replication 条目）属于后续 Replication 票/发布收官；AC2/AC3 不为 Replication 设判据；本票不得宣称「Replication 已 rc.12 兼容」超出「编译面绿 + seam 语义正确」；也不得把本票 Persistence 矩阵绿当作 Replication 覆盖。B2/B3 上只强制 ws-replication 的 typecheck，不强制其行为套件（跑通是允许的附加证据，不是验收条件）。`apps/yjs-server` 三基线行为同理不在范围（SA6 X4）。

### Q4 — B3 provenance：最小 source-build 是否可接受

**裁决：接受。ADR 0035 §5 L87 原文是「从该 revision 的 vendored 源码构建，**或**校验既有构建产物确实对应该 revision」——两个分支都不涉及 DSH 官方 `tsc -b` + `tsdown` 流水线；绑定对象是 source revision 与工件身份，不是构建流水线。SA6 的 tsc 5.9.3 最小 source-build 在字面与目的（L18「package version 不能独立证明 Root API 形态；兼容目标必须绑定实际 commit 和源码/构建产物」）内。**

为使该接受成为**绑定**（可复核、不可冒充），provenance 记录必须齐备以下 8 项（缺一即 AC4 红）：
1. **commit 钉死**：`git rev-parse HEAD === 1511a6ed442c207919142a4b0e6c4916f96d2c3b` 且 `git status --porcelain` 空（§5 L86 第 1 条）；
2. **source blob 绑定**：`git ls-tree -r <sha>` 的 vendored 源文件 blob 哈希与 provenance 逐文件一致（至少 `vendor/cordis/src/context.ts`、`utils.ts`、timer/cosmokit 全部 `src/*.ts`；SA6 附录 A 已有示例哈希）——证明「构建输入确属该 revision」；
3. **构建配方**：build 命令、tsc/Node 版本、tsconfig 关键项（`rootDir/outDir/declarationDir/rewriteRelativeImportExtensions/paths`）完整记录，可复现；
4. **输出哈希**：三包构建产物（`lib/`）哈希与 provenance 一致——把「测试实际用的工件」钉到「记录的这次构建」；因 timer/cosmokit vendored 源与 npm 逐字节相同（SA6 §9.3），输出哈希 + realpath 是唯一区分通道；
5. **双位置解析断言**：测试开始时从 test 模块与 `packages/persistence/src/service.ts` 所在目录两处 resolve 三个包，realpath 相同且落在 B3 overlay 内（§5 L88 第 3 条；SA6 AC4(d)）；
6. **运行时通道探针**：symbol 命中、legacy 缺席、`Context.root === Symbol.for('cordis.root')`（§5 L89 第 4 条）；
7. **负控实跑**：fallback / substitute-npm / substitute-rc12 / legacy-shim 四命令实际执行并断言 exit != 0（§5 L90 第 5 条；SA6 §6.2）；
8. **诚实标注**：provenance 明记「minimal tsc source-build，非 DSH 官方 tsdown 流水线」——版本元数据（4.1.0/1.2.0/1.9.0）只作辅助不作形态证明（SA6 §12.1 B3 ⑥）。若未来 Host/owner 要求官方流水线等价性，那是新要求，须显式提出；现行 ADR 不要求，无需升级。

### Q5 — AC 条数与 owner 忠实度

**裁决：忠实；无遗漏、无越界。**
- Issue checklist 实际 **8 条**（L21–L28），SA6 AC1–AC8 与之逐条对应（本会话逐条核对：AC1←L21、AC2←L22、AC3←L23、AC4←L24、AC5←L25、AC6←L26、AC7←L27、AC8←L28，语义无损）。
- **AC9（derived）** 来自 What to build L17 尾句「Host 不需要新增配置或条件装配」——这是 owner 原文要求，SA6 把它升格为可验收判据并显式标注 derived（§1 L28 还明文禁止「声称存在第 9 条 checklist」），是忠实操作化而非新增要求。其判据 (b)(c)(d)（无 env/feature-flag/条件 import、装配序不变、DSH profile options 形状不变）分别是否定「条件装配」、ADR 0035 §3 装配不变与 AC7 公共面不变的直接投影，不构成越界。
- 遗漏检查：Issue 正文全部要求面 = What to build + 8 checkbox + Parent（base 已解析）+ Blocked by: None + Comments 空——已全覆盖。dispatch 侧「9 条 acceptance criteria」计数与 owner 8 条的偏差已由 SA6 记录（G14）并正确收敛为「8 + derived 1」。
- 绑定（R6）：后续设计/验收引用 AC 时必须维持该账本——owner checkbox 恒 8 条；AC9 恒标 derived 并引 L17 原句。

### Q6 — 其他 ADR/规范冲突与机械 gate 自洽性

逐项裁定（详细分类见 §3 Decision analysis）：
- **ADR 0012**（plugin 所有权/不销毁上游）：no-conflict。seam 只改 root Context 的**解析方式**，不改 listener/dialer/controller/连接所有权，不新增对 Registry/Persistence/Clock/Timer 的销毁调用（L5、L37）。
- **ADR 0023**（冻结服务面）：no-conflict + 冻结面。`nomicoreHubReplication`/`nomicorePeerReplication` 维持访问器 + `Object.freeze` 构造（L45）；4 个被迁移 fixture 之一 `ws-replication-guard-proxy-consumption.test.ts` 正是 ADR 0023 的验收测试——迁移其 `ctx.root` 读取时断言面（guard-Proxy 可消费性）必须原样保留。
- **ADR 0035 §2 L56 cast 不扩散**：no-conflict + 设计红线。`Reflect.get` cast 只许存在于两个包的 seam 叶子（persistence service.ts 一侧；ws-replication plugin.ts 一侧），不得进入 replication-protocol、edge/session 状态机、业务 API、Registry、Persistence 核心（lifecycle/memory/file/contract）。
- **ws-replication AGENTS**：no-conflict + 门禁适用（Q3 第 3 分）；其 L23「Export production APIs through `src/index.ts`」与 R7 的 index.ts 零改动 gate 一致。
- **§12.4 机械 diff gate 与范围扩展的关系**：**不是自相矛盾，是欠执法，必须补齐**。gate #2 的 pathspec 只覆盖 `packages/{persistence,dsh-persistence,namespace-registry}/src`，ws-replication 改动根本不进入其输出——按现状跑 gate #2 会「看起来全绿」而对已授权的 ws-replication 迁移零检查，AC7 的意图（兼容逻辑不越界）对该包失去机械承载。gate #1 已含 `packages/ws-replication/package.json`（清单不变），#3 快照未覆盖 ws-replication 公共 entry。绑定补齐见 R7。
- **ADR 0006/0009 生命周期**：no-conflict。AC3 明文不改变其语义；seam 迁移后 root 绑定调度（ADR 0006 L86）与有序 disposer（ADR 0009 L103）语义不变，仅通道解析换形。
- **CONTEXT.md**：无需术语演进；「服务表面」词条与 ADR 0023 约束互相印证。
- 环境事实（非决策冲突，记录在案）：pnpm/corepack 版本不匹配（G16）→ 验收命令用本地二进制或显式 `corepack pnpm@10.28.2`；Controller 的 cosmokit 版本事实过时（G15，npm 已有 1.9.0）→ 只提高同名替换风险，R5 第 4/5 项已覆盖。

### Q7 — Host/owner 升级问题

**无阻塞性升级问题（「若 Host 不裁决则无法推进」列表：无）。** SA6 报告的 G13 blocker 在规范集合内部即可消解（R1 严格读法 + R2 迁移授权）：满足全部 owner checkbox 与全部 ADR 条款的解存在且唯一。B3 最小构建（Q4）与 AC 账本（Q5） likewise 无需 owner 裁决。

**一条非阻塞 advisory**（仅当 owner 实际意图是「本票零 ws-replication diff」时才需要；若采纳则等于 owner override AC6 checkbox，届时须回本门禁复审）：
> 「issue #470 是否允许在本票内把 `packages/ws-replication/src/plugin.ts` 的 Root 解析与 4 个测试 fixture 的直接 `ctx.root` 读取按 ADR 0035 §2 迁移（仅为满足 AC6 三基线全仓 typecheck；Replication 行为验收仍留后续票）？若不允许，请改写 AC6 checkbox 为明文的 project 子集 + known-red 清单。」

---

## 3. Decision analysis

| Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| Issue #470 checklist | L26（AC6） | 三基线各自全仓 typecheck 绿，不得抵销 | implements-existing-decision | `wiki/raw/task_issue-470.md` L26；根 `package.json` L13 15-project 清单 | R1 严格读法绑定 |
| ADR 0035 §5 | L82 | 同上（规范层重复） | implements-existing-decision | `docs/adr/0035-...md` L82 | 同 R1 |
| ADR 0035 §2 | L45–L58 | 两个受影响包各留一个包内私有 seam；生产 + Host fixture 直接 `ctx.root` 读取统一迁移 | implements-existing-decision | ADR 0035 L45、L58、L24–L26（影响面点名）；`service.ts:54`；`plugin.ts:214`；4 fixture（§1 清点） | R2/R4 迁移面与决策形态绑定 |
| ADR 0035 §2 | L56 | 兼容 cast 不得扩散到 Registry/Persistence 核心/Replication 状态机/业务 API | no-conflict（设计红线） | ADR 0035 L56 | R4 |
| ADR 0035 §3 | L60–L70 | 调度所有权、停机序、plugin 不销毁上游不变 | no-conflict | ADR 0035 L64–L66；ADR 0012 L5/L37 | R4 |
| ADR 0035 §4 | L72–L78 | 依赖 range/归属、公共契约不变 | no-conflict | ADR 0035 L74–L76；Issue L28 | R7（manifest gate 沿用 SA6 §12.4 #1） |
| ADR 0035 §5 | L84–L94 | 夹具钉 commit/source-built/provenance/解析断言/探针/负控；行为清单 | implements-existing-decision | ADR 0035 L86–L90、L92 | R5（B3 provenance 8 项）；L92 的 Replication/yjs-server 行为条目归后续票（Q3） |
| ADR 0035 §6 | L96–L102 | Host 侧部署/patch 排除 | no-conflict | ADR 0035 L98 | 边界维持（SA6 §15.3.1） |
| ADR 0006 | L86、L242–L278（#412 修订） | root 绑定 persistence timer；drain/dispose 硬契约 | no-conflict | ADR 0006 L86、L270 | AC3 语义不变（R4） |
| ADR 0009 | L99–L103 | shutdown 编排、有序 disposer | no-conflict | ADR 0009 L99–L103 | 同上 |
| ADR 0012 | L5、L33–L37 | ws plugin 所有权、不销毁上游、逆序释放 | no-conflict | ADR 0012 L5、L37 | seam 不触碰所有权（Q3） |
| ADR 0023 | L45、L62、L90 | 服务面访问器 + freeze 构造纪律；guard-proxy 回归 | no-conflict（冻结面） | ADR 0023 L45、L90–L92；`ws-replication-guard-proxy-consumption.test.ts` | R8 |
| ADR 0032（经 ws-replication AGENTS 收录） | AGENTS L21 | 公共工厂 append-only；两服务入口互斥 | no-conflict（冻结面） | `packages/ws-replication/AGENTS.md` L21 | R7（index.ts 零改动） |
| ws-replication AGENTS | L25–L26 Verification | 改动路径 focused tests + 包/根 typecheck + 根 test | no-conflict | `packages/ws-replication/AGENTS.md` L25–L26 | Q3 第 3 分（B1 门禁） |
| persistence / dsh-persistence AGENTS | 全文 | 核心/DSH 边界、确定性、公共 export 纪律 | no-conflict | 两 AGENTS 全文 | R4/R7 承载 |
| CONTEXT.md | L173–L175「服务表面」 | 术语一致 | no-conflict | CONTEXT.md L173–L175 | 无 |
| SA6 契约 §12.4 | gate #2/#3 | 机械 diff gate 未覆盖 ws-replication | 证据工件欠执法（非决策冲突） | SA6 §12.4 L429–L445 | R7 补齐 |
| Issue What to build | L17 | 「后续 Replication 可复用」的能力建设定位 | no-conflict（解读裁定） | `task_issue-470.md` L17 | Q3 边界 |

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| —（无） | — | — | — |

无任何合法 override 存在：issue #470 评论为空（dispatch log L6）；无新 ADR 修订/废弃 ADR 0035；无协议版本升级；ADR 0035 无被触发的自带演进条款。SA6 与本报告均不创设 override。若 owner 未来就 §2 advisory 表态「零 ws-replication diff」，那将构成对 AC6 checkbox 的 owner override，须回本门禁复审后按子集读法重立契约。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| 复制 wire 协议/帧布局/状态机 | 零改动（seam 不触协议） | `docs/protocols/instance-replication-v1.md`；ws-replication AGENTS L11–L22 | 本票预期零改动（R2 允许面外零 diff） |
| ws-replication 公共导出面 | `src/index.ts` 导出清单逐字节不变；seam 包内私有不导出 | ws-replication AGENTS L21/L23；ADR 0035 L45「不新增公共 export」 | 待设计后/实现后复查核对 |
| 冻结服务面构造形态 | `nomicoreHubReplication`/`nomicorePeerReplication`（及 clock/registry）维持访问器 + freeze | ADR 0023 L45；CONTEXT.md L174 | 同上 |
| persistence 公共导出面 | index/contract/lifecycle/memory/file/testing 与 base 相同（AC7） | Issue L27；SA6 §12.4 #2/#3 | 同上 |
| 包清单/lock/artifacts | `pnpm-lock.yaml`、根与四包 package.json、`artifacts/` 与 base 逐字节相同 | Issue L28；ADR 0035 §4；SA6 §12.4 #1 | 基线满足；待 gate 持守 |
| ADR 0006/0009 生命周期语义 | drain/dispose/degraded/shutdown 编排不变 | Issue L23；ADR 0035 §3 L62 | 设计不得触碰（R4） |
| 「全仓 typecheck」定义 | 根 scripts.typecheck 15-project 清单 | `package.json` L13 | R1 绑定 |
| 稳定错误文案纪律 | 既有单句稳定文案（`required Cordis service "timer" is unavailable`、`required Cordis root timer context is unavailable`）不被削弱；新 Root 通道失败用稳定文案，不得随 ctx 形态漂移成 TypeError/proxy 噪声 | `service.ts:30–33`；`plugin.ts:211–216`；SA6 AC1 失败判据 | 设计须显式承诺（R4） |

## 6. Evolution requirements

**无。** 本仲裁全部结论落在现有决策集合内（implements-existing-decision / no-conflict）：不需要修订任何 ADR、CONTEXT.md 或协议文档；不需要新 ADR；不需要 owner override。SA6 §17.8「不修改 ADR 追认实现」与之一致——迁移本身即 ADR 0035 §2 的兑现，无需追认。

## 7. Hard conflicts

**无（仲裁后）。** SA6 报告的唯一 conflict 根因（§15.1/G13：AC6 全仓 typecheck vs 「Replication 留待后续」）是**表观冲突**：把「后续 Replication」误读为覆盖 §2 已点名的 ws-replication typecheck 面。按 R1（严格 AC6）+ R2（迁移授权/义务）+ Q3（行为验收归后续票）三层切分后，owner 8 条 checkbox、ADR 0035 全部条款、模块 AGENTS 门禁同时可满足，无不可解残项。

## 8. Required actions — 绑定裁决清单（设计必须逐条遵守）

- **R1（AC6 读法）**：「全仓 typecheck」= 根 `package.json` `scripts.typecheck` 15-project 清单，B1/B2/B3 逐基线全绿、逐 project 留证；禁止子集 + known-red 债务读法、禁止默认 node_modules 类型面冒充、禁止 tsconfig 删项/skip/cast 掩蔽。
- **R2（ws-replication 迁移面）**：授权且要求迁移 `packages/ws-replication/src/plugin.ts` 的 Root 解析 + 恰好 4 个具名 fixture（`ws-replication-plugin.test.ts`、`ws-replication-issue299-ac-red.test.ts`、`ws-replication-issue422-listen-false.test.ts`、`ws-replication-guard-proxy-consumption.test.ts`）的直接 `ctx.root` 读取；ws-replication 其余文件零改动；`packages/persistence` 侧改动仍限 `service.ts`（或单个仅被其 import 的包内私有文件）。测试 harness 的 `ctx.rootValue`/`ctx.root(...)` helper 与 Cordis Root 无关，不得误改。
- **R3（角色边界）**：ws-replication 在本票 = 编译面（三基线 typecheck）+ seam 语义 + B1 包门禁（focused tests/包 typecheck/根 typecheck/根 test）；不承担三基线行为矩阵，不为 Replication 作超出「编译面绿 + seam 语义正确」的兼容宣称。
- **R4（seam 决策形态，两包同规）**：`Reflect.get(ctx, Symbol.for('cordis.root')) ?? Reflect.get(ctx, 'root')` 形态的 symbol 优先解析；仅 symbol 缺席才读 legacy；结果必须具备所需 `timeout`，缺席/形状不符**同步 loud fail**（稳定文案），不 fallback 到 `setTimeout`/ambient timer；seam 包内私有、不进公共 export；cast 不得扩散到 Registry、Persistence 核心（lifecycle/memory/file/contract）、Replication 状态机（replication-protocol/edge/session）、业务 API；root 绑定调度所有权与 ADR 0006/0009/0012/0035§3 生命周期语义不变。
- **R5（B3 provenance）**：接受最小 source-build；provenance 必须齐备 §2-Q4 的 8 项（commit 钉死/clean、ls-tree blob 哈希、构建配方与工具链版本、输出哈希、双位置 realpath 断言、symbol 通道探针、四负控实跑、「非官方流水线」诚实标注）；版本元数据仅辅助。
- **R6（AC 账本）**：owner checkbox 恒 8 条；AC9 恒标 derived 并引 `task_issue-470.md` L17 原句；不得声称存在第 9 条 checklist。
- **R7（机械 gate 补齐）**：在 SA6 §12.4 基础上增补——(a) ws-replication diff allowlist gate：`git diff --name-only 279dba4..HEAD -- packages/ws-replication` 的输出 ⊆ {`src/plugin.ts` 或经 SA8 复审认可的单个私有 seam 文件} ∪ 4 个具名 test 文件；(b) `git diff --exit-code 279dba4 -- packages/ws-replication/src/index.ts` 必须空；(c) §12.4 #3 公共面快照增加 `@nomicore/ws-replication` entry（或以 (b) 等价承载）；(d) gate #1（manifest/lock/artifacts）原样保留。
- **R8（ADR 0023 冻结面）**：两 replication 服务对象构造形态不动；`ws-replication-guard-proxy-consumption.test.ts` 迁移后其 guard-Proxy 断言面原样保留并通过（B1）。
- **R9（升级状态）**：无阻塞性 Host/owner 问题；§2-Q7 advisory 仅在 owner 意图为「零 ws-replication diff」时激活，届时属 owner override AC6，须回本门禁复审。

### 被否决选项与理由

| # | 选项 | 否决理由 |
|---|---|---|
| O1 | AC6 子集读法（in-scope 全绿 + known-red debt） | 违反 owner checkbox L26 与 ADR 0035 §5 L82 的「全仓」字面；实质是 skip/降级验收；无合法 override；且不必要（冲突可规范内消解） |
| O2 | 接受 AC6 红带债收口 | 直接违反 owner checkbox；违反「绿不得抵销红」纪律 |
| O3 | 本票完全不动 ws-replication（SA6 §17.4 立场作为终局） | 使 AC6 三基线不可满足；正确切口是只延后 Replication **行为验收**（Q3），不延后 §2 点名的编译面迁移 |
| O4 | cast-only / tsconfig 排除压静 TS2576 而不做 seam 迁移 | 掩蔽（违 R1 与 §5 L90）；ws-replication 在 rc.12 运行时仍 boot 即炸，类型绿谎报兼容；ADR §2 义务未兑现 |
| O5 | 强制 DSH 官方 `tsc -b`+`tsdown` 流水线 | ADR §5 L87 无此要求；绑定对象是 revision 与工件身份；最小构建 + R5 完整 provenance 即达标（若 owner 另行要求官方流水线，属新要求须显式提出） |
| O6 | 提升依赖 `^4.1.0`/`^1.2.0` 或硬切 symbol-only | ADR 0035 被否决方案 L107–L108 已否决；且违反 AC8/§4 |
| O7 | 把 Replication 三基线行为矩阵并入本票 | 超出 owner 范围（L17「后续 Replication」）；ADR §5 L92 行为清单是发布级清单，非本票切片义务 |

### 对 SA1 设计的不可协商约束（= R1–R8 摘要）

1. AC6 严格读法（15 project × 3 基线全绿，无子集/无掩蔽/无冒充）。
2. 迁移面封闭清单：persistence `service.ts`（或单个私有 seam 文件）+ ws-replication `plugin.ts`（或同款私有 seam 文件）+ 恰好 4 个具名 fixture；其余零改动。
3. seam 决策形态：symbol 优先、legacy 兜底、同步 loud fail（稳定文案）、无 ambient timer、包内私有、cast 不扩散、生命周期语义不变。
4. B3 provenance 8 项齐备，最小构建诚实标注。
5. AC 账本：8 owner checkbox + AC9（derived，引 L17）。
6. 机械 gate 按 R7 补齐后执行；manifests/lock/artifacts/index.ts 零 diff。
7. ADR 0023 服务构造形态与 guard-proxy 断言面不动。
8. ws-replication 只按编译面 + seam 语义 + B1 包门禁验收；不作 Replication 行为宣称。

## 9. Verdict

**clear** —— 全部对照项为 no-conflict 或 implements-existing-decision；SA6 报告的 G13 表观冲突已按 R1–R3 消解；无 hard-conflict、无待补演进计划、无待批 override。SA1 设计阶段可以放行，前提是逐条吸收 R1–R9。

## 10. requiresConflictRecheck

**true** —— 理由：(a) 两个生产 seam 将引入新失败语义（Root 通道缺席/形状不符的同步 loud fail），属失败语义决策面；(b) ws-replication 为本票新增的第二生产包改动面（生命周期相邻路径），其 diff 是否守住 R2/R7 允许清单需在设计后/实现后核对；(c) R7 机械 gate 为新增执法面。设计定稿后应做 design 复审（对照 R1–R9 逐条核销），实现后按需做 implementation 复审。
